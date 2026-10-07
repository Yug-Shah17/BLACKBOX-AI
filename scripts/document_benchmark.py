"""Measure controlled fictional document failures; this is not an ML benchmark."""

import copy
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from backend.app.services.document_scenarios import scenario_fingerprint, scenarios
from backend.app.services.documents import VERSION, DocumentRequest, diagnose, execute


def evaluate():
    cases = []
    healthy_count = 0
    for scenario in scenarios():
        base = {"question": scenario["question"], "documents": scenario["documents"]}
        healthy, _ = execute(DocumentRequest.model_validate(base).model_dump())
        if healthy["public"]["outcome"] != "success" or diagnose(healthy)["predictedFailureStep"] is not None:
            raise AssertionError("Healthy document scenario failed")
        healthy_count += 1
        outputs = {1: {"documentIds": [item["documentId"] for item in scenario["documents"]
                                      if item["topic"] != "library maintenance"]},
                   2: {"documentId": scenario["expectedCitation"]},
                   3: {"answer": scenario["expectedAnswer"], "citation": scenario["expectedCitation"]}}
        for fault, step in (("missing_retrieval", 1), ("wrong_source", 2),
                            ("unsupported_answer", 3), ("incorrect_citation", 3)):
            config = DocumentRequest.model_validate({**base, "failureType": fault}).model_dump()
            original, checkpoints = execute(config)
            saved = copy.deepcopy(original)
            checkpoint = checkpoints[original["public"]["steps"][step - 1]["checkpointId"]]
            prefix = [checkpoints[item["checkpointId"]] for item in original["public"]["steps"][:step - 1]]
            corrected, _ = execute(config, checkpoint, prefix, outputs[step])
            wrong = ({"documentIds": []} if step == 1 else
                     {"documentId": f"{scenario['id']}-archived"} if step == 2 else
                     {"answer": "Unsupported fixture answer.", "citation": scenario["expectedCitation"]})
            incorrect, _ = execute(config, checkpoint, prefix, wrong)
            cases.append({"scenario": scenario["id"], "fault": fault, "expectedStep": step,
                          "predictedStep": diagnose(original)["predictedFailureStep"],
                          "correctedOutcome": corrected["public"]["outcome"],
                          "wrongCorrectionOutcome": incorrect["public"]["outcome"],
                          "originalPreserved": original == saved,
                          "reusedSteps": [item["stepId"] for item in corrected["public"]["steps"]
                                          if item["executionMode"] == "reused"],
                          "executedSteps": [item["stepId"] for item in corrected["public"]["steps"]
                                            if item["executionMode"] == "executed"]})
    return {"dataSource": "fictional-demo", "diagnosisMode": "rules", "workflowVersion": VERSION,
            "scenarioSha256": scenario_fingerprint(), "caseCount": len(cases),
            "healthyCaseCount": healthy_count,
            "top1Localization": sum(item["predictedStep"] == item["expectedStep"] for item in cases) / len(cases),
            "fixtureCorrectionSuccessRate": sum(item["correctedOutcome"] == "success" for item in cases) / len(cases),
            "wrongCorrectionFailureRate": sum(item["wrongCorrectionOutcome"] == "failed" for item in cases) / len(cases),
            "limitations": "Three fictional document sets, four injected faults, fixed four-step workflow; rule diagnosis, no learned document model or real-world generalization evidence.",
            "cases": cases}


def main():
    report = evaluate()
    if any(item["predictedStep"] != item["expectedStep"] or item["correctedOutcome"] != "success"
           or item["wrongCorrectionOutcome"] != "failed" or not item["originalPreserved"]
           for item in report["cases"]):
        raise SystemExit("Document scenario regression detected")
    output = ROOT / "data" / "document_benchmark.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "cases"}, indent=2))
    print(f"Report: {output}")


if __name__ == "__main__":
    main()
