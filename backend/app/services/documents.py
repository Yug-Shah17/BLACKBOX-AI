"""Versioned local and consent-based hosted document workflows."""

import copy
import json
import re
import time
from datetime import datetime, timezone
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, ConfigDict, Field, model_validator

from backend.app.services import gemini

LEGACY_VERSION = "document-qa-v1"
VERSION = "document-qa-v2"
GEMINI_VERSION = "document-qa-gemini-v1"
KINDS = ("retrieval", "selection", "generation", "validation")


class Document(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    documentId: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=200)
    topic: str = Field(min_length=1, max_length=200)
    text: str = Field(min_length=1, max_length=10000)
    current: bool = True


def default_documents():
    return [Document(documentId="current", title="Current returns policy", topic="returns policy",
                     text="Returns are accepted within 30 days."),
            Document(documentId="archived", title="Archived returns policy", topic="returns policy",
                     text="Returns are accepted within 7 days.", current=False)]


class DocumentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)
    question: str = Field(default="What is the returns policy?", min_length=1, max_length=1000)
    documents: list[Document] = Field(default_factory=default_documents, min_length=1, max_length=30)
    failureType: Literal["normal", "missing_retrieval", "wrong_source", "unsupported_answer",
                         "incorrect_citation"] = "normal"
    answeringMode: Literal["local", "gemini"] = "local"
    allowExternalProcessing: bool = False

    @model_validator(mode="after")
    def unique_identifiers(self):
        if self.answeringMode == "gemini" and not self.allowExternalProcessing:
            raise ValueError("Explicit consent is required to send document text to Google")
        if len({item.documentId for item in self.documents}) != len(self.documents):
            raise ValueError("Document identifiers must be unique")
        return self


class DocumentContext(BaseModel):
    question: str
    documents: list[Document]


def word_count_target(question: str) -> str | None:
    """Recognize explicit single-word frequency questions, not arbitrary QA."""
    if not re.search(r"\b(?:how many times|number of times|how often|count|occurrences|frequency)\b", question, re.I):
        return None
    quoted = re.findall(r"[\"'](\w+)[\"']", question)
    if len(quoted) == 1:
        return quoted[0]
    match = re.search(r"\bword\s+[\"']?(\w+)[\"']?(?=\s|[?.!,]|$)", question, re.I)
    return match.group(1) if match else None


def expected_answer(question: str, document: dict, version: str = VERSION) -> str:
    target = word_count_target(question) if version != LEGACY_VERSION else None
    if target is None:
        return document["text"]
    count = re.findall(r"\w+", document["text"].casefold()).count(target.casefold())
    return (f'The word "{target}" appears {count} times in the selected document '
            '(case-insensitive, whole-word matches).')


def relevant(question, document, version: str = VERSION):
    if version == GEMINI_VERSION:
        return True
    if version != LEGACY_VERSION and word_count_target(question) is not None:
        return True
    words = set(re.findall(r"\w+", question.casefold()))
    return bool(words & set(re.findall(r"\w+", document["topic"].casefold())))


def answer_checks(question: str, selected: dict | None, generated: dict,
                  generation_input: dict, version: str) -> bool:
    if not selected or not selected["current"] or generated["citation"] != selected["documentId"]:
        return False
    if version != GEMINI_VERSION or word_count_target(question) is not None:
        return bool(relevant(question, selected, version)
                    and generated["answer"] == expected_answer(question, selected, version))
    if generation_input.get("providerError"):
        return False
    evidence = generation_input.get("answerEvidence")
    if evidence is None:
        # Manual replacements are accepted only as literal source extracts.
        return bool(isinstance(generated["answer"], str) and generated["answer"].strip()
                    and generated["answer"] in selected["text"])
    if not isinstance(evidence, dict):
        return False
    if generated["answer"] != evidence.get("answer"):
        return False
    quotes = evidence.get("quotes")
    if evidence.get("supported") is False:
        return generated["answer"] == gemini.ABSTENTION and quotes == []
    return bool(evidence.get("supported") is True and isinstance(quotes, list) and 1 <= len(quotes) <= 5
                and all(isinstance(quote, str) and quote.strip() and quote in selected["text"] for quote in quotes))


def validate_output(index, output, config, state):
    documents = {item["documentId"]: item for item in config["documents"]}
    if index == 0:
        ids = output.get("documentIds")
        valid = (set(output) == {"documentIds"} and isinstance(ids, list)
                 and all(isinstance(item, str) and item in documents for item in ids)
                 and len(set(ids)) == len(ids))
    elif index == 1:
        valid = (set(output) == {"documentId"} and isinstance(output.get("documentId"), str)
                 and output["documentId"] in state.get("documentIds", []))
    else:
        valid = (set(output) == {"answer", "citation"}
                 and isinstance(output.get("answer"), str) and 0 < len(output["answer"].strip()) <= 10000
                 and isinstance(output.get("citation"), str) and output["citation"] in documents)
    if not valid:
        raise ValueError("Replacement output is invalid for this document step")


def execute(config, checkpoint=None, prefix=None, override=None, version: str = VERSION):
    if checkpoint:
        version = checkpoint["workflowVersion"]
    elif config.get("answeringMode") == "gemini":
        version = GEMINI_VERSION
    identifier = f"doc_{uuid4().hex}"
    steps = copy.deepcopy(checkpoint["prefix"]) if checkpoint else []
    state = copy.deepcopy(checkpoint["state"]) if checkpoint else {}
    start = len(steps)
    snapshots = {}
    for index, step in enumerate(steps):
        key = f"{identifier}-checkpoint-{index + 1}"
        snapshot = copy.deepcopy(prefix[index])
        snapshot.update(runId=identifier, prefix=copy.deepcopy(steps[:index]))
        snapshots[key] = snapshot
        step.update(checkpointId=key, executionMode="reused")
    documents = {item["documentId"]: item for item in config["documents"]}
    fault = config["failureType"]
    for index in range(start, 4):
        key = f"{identifier}-checkpoint-{index + 1}"
        snapshots[key] = {"runId": identifier, "workflowVersion": version, "stepIndex": index,
                          "config": copy.deepcopy(config), "state": copy.deepcopy(state),
                          "prefix": copy.deepcopy(steps)}
        timer = time.perf_counter()
        if index == 0:
            inputs = {"question": config["question"], "topics": {
                key: item["topic"] for key, item in documents.items()}}
            if version != LEGACY_VERSION and word_count_target(config["question"]) is not None:
                inputs["operation"] = "word_count"
            elif version == GEMINI_VERSION:
                inputs["operation"] = "provided_documents"
            output = {"documentIds": [] if fault == "missing_retrieval" else [
                key for key, item in documents.items() if relevant(config["question"], item, version)]}
        elif index == 1:
            candidates = [documents[key] for key in state["documentIds"]]
            inputs = {"documents": candidates}
            selected = next((item for item in candidates if item["current"] != (fault == "wrong_source")), None)
            output = {"documentId": selected["documentId"] if selected else None}
        elif index == 2:
            selected = documents.get(state["documentId"])
            inputs = {"question": config["question"], "document": selected}
            if selected and version != LEGACY_VERSION and word_count_target(config["question"]) is not None:
                inputs["expectedAnswer"] = expected_answer(config["question"], selected, version)
            output = {"answer": expected_answer(config["question"], selected, version) if selected else None,
                      "citation": selected["documentId"] if selected else None}
            if version == GEMINI_VERSION and selected and word_count_target(config["question"]) is None:
                inputs["model"] = gemini.MODEL
                if not (index == start and override is not None):
                    try:
                        evidence = gemini.answer(config["question"], selected)
                        inputs["answerEvidence"] = evidence
                        output["answer"] = evidence["answer"]
                    except gemini.ProviderError as error:
                        inputs["providerError"] = {"code": error.code, "message": str(error)}
                        output["answer"] = None
            if fault == "unsupported_answer" and selected:
                output["answer"] = "This answer is not supported by the selected document."
            if fault == "incorrect_citation" and selected:
                output["citation"] = next((key for key in documents if key != selected["documentId"]), "missing")
        else:
            selected = documents.get(state["documentId"])
            inputs = {"answer": state["answer"], "citation": state["citation"], "document": selected}
            output = {"passed": answer_checks(config["question"], selected,
                       {"answer": state["answer"], "citation": state["citation"]},
                       steps[2]["inputData"], version)}
            if version == GEMINI_VERSION:
                inputs["validationScope"] = "Citation, verbatim quotes and output integrity; not semantic correctness proof."
        if index == start and override is not None:
            validate_output(index, override, config, state)
            output = copy.deepcopy(override)
        state.update(output)
        failed = ((index == 0 and not output["documentIds"])
                  or (index == 1 and output["documentId"] is None)
                  or (index == 2 and output["answer"] is None)
                  or (index == 3 and not output["passed"]))
        steps.append({"stepId": index + 1, "stepType": KINDS[index],
                      "input": json.dumps(inputs), "output": json.dumps(output),
                      "inputData": inputs, "outputData": output,
                      "toolName": "local_document_store" if index == 0 else gemini.MODEL if index == 2 and version == GEMINI_VERSION and "model" in inputs else None,
                      "latencyMs": round((time.perf_counter() - timer) * 1000, 4),
                      "status": "error" if failed else "success",
                      "error": inputs.get("providerError", {"code": "NO_EVIDENCE" if index < 3 else "VALIDATION_FAILED"}) if failed else None,
                      "checkpointId": key, "executionMode": "executed", "parentStepIds": [index] if index else []})
    public = {"runId": identifier, "task": config["question"], "agentName": "gemini-document-agent" if version == GEMINI_VERSION else "local-document-agent",
              "outcome": "success" if state["passed"] else "failed",
              "timestamp": datetime.now(timezone.utc).isoformat(), "steps": steps,
              "durationMs": sum(step["latencyMs"] for step in steps if step["executionMode"] == "executed"),
              "source": "controlled-local-document-workflow", "schemaVersion": version,
              "parentRunId": checkpoint["runId"] if checkpoint else None,
              "replayCheckpointStep": start + 1 if checkpoint else None}
    return {"public": public, "config": copy.deepcopy(config), "observed": {"steps": steps}}, snapshots


def diagnose(record):
    run = record["public"]
    steps = run["steps"]
    suspect, evidence = None, []
    question = steps[0]["inputData"]["question"]
    version = run["schemaVersion"]
    if run["outcome"] != "success":
        if not steps[0]["outputData"]["documentIds"]:
            suspect, evidence = 1, ["Retrieval returned zero document IDs for the recorded question."]
        else:
            selected = steps[2]["inputData"]["document"]
            generated = steps[2]["outputData"]
            if not selected:
                suspect, evidence = 2, ["Selection did not identify a retrieved source document."]
            elif not selected["current"]:
                suspect, evidence = 2, [f"Selected source '{selected['documentId']}' is marked archived in the recorded input."]
            elif not relevant(question, selected, version):
                suspect, evidence = 2, [f"Selected source '{selected['documentId']}' has topic '{selected['topic']}', which does not match the recorded question keywords."]
            else:
                suspect = 3
                if not answer_checks(question, selected, generated, steps[2]["inputData"], version):
                    provider_error = steps[2]["inputData"].get("providerError")
                    evidence.append(provider_error["message"] if provider_error else
                                    f"Answer failed source evidence or recorded output integrity checks for '{selected['documentId']}'.")
                if generated["citation"] != selected["documentId"]:
                    evidence.append(f"Recorded citation '{generated['citation']}' does not match selected source '{selected['documentId']}'.")
    return {"runId": run["runId"], "predictedFailureStep": suspect, "mode": "rules",
            "status": run["outcome"], "evidence": evidence,
            "explanation": "Rule-based source and output checks; not a trained diagnosis model or proof of semantic correctness.",
            "suspects": [{"stepId": suspect, "evidence": evidence}] if suspect else []}
