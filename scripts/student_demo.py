"""Small HTTP client for the existing document agent, not an external-agent adapter."""
import argparse
import json
from typing import Any, Callable
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

ApiCall = Callable[[str, str, dict[str, Any] | None], Any]


def run_demo(call: ApiCall, scenario_id: str = "eligibility") -> dict[str, Any]:
    catalog = call("GET", "/document-scenarios", None)
    scenario = next((item for item in catalog if item["id"] == scenario_id), None)
    if scenario is None:
        raise ValueError("Scenario unavailable; no run was created.")
    sources = scenario["documents"]
    archived = next((item for item in sources if not item["current"]), None)
    if archived is None:
        raise ValueError("Demo requires an archived source; no run was created.")
    original = call("POST", "/document-runs", {"question": scenario["question"],
        "documents": sources, "failureType": "wrong_source"})
    path = f"/document-runs/{original['runId']}"
    diagnosis = call("POST", f"{path}/diagnose", {})
    if original["outcome"] != "failed" or diagnosis["predictedFailureStep"] != 2:
        raise ValueError("Expected an archived-source failure at selection; demo stopped.")

    def replay(document_id: str) -> dict[str, Any]:
        return call("POST", f"{path}/replay", {"checkpointStep": 2,
            "alternativeAction": {"type": "replace_output", "output": {"documentId": document_id}}})

    corrected = replay(scenario["expectedCitation"])
    wrong = replay(archived["documentId"])
    comparison = call("GET", f"{path}/compare?replay={corrected['replayRunId']}", None)
    preserved = call("GET", path, None) == original
    reused = [step["stepId"] for step in comparison["steps"] if step["replay"]["executionMode"] == "reused"]
    executed = [step["stepId"] for step in comparison["steps"] if step["replay"]["executionMode"] == "executed"]
    if (corrected["replayOutcome"] != "success" or wrong["replayOutcome"] != "failed"
            or not preserved or reused != [1] or executed != [2, 3, 4]):
        raise ValueError("Demo verification failed; inspect recorded branches before presenting.")
    return {"scenario": scenario_id, "originalRunId": original["runId"],
        "correctedRunId": corrected["replayRunId"], "wrongRunId": wrong["replayRunId"],
        "correctedOutcome": corrected["replayOutcome"], "wrongCorrectionOutcome": wrong["replayOutcome"],
        "predictedFailureStep": diagnosis["predictedFailureStep"], "evidence": diagnosis["evidence"],
        "reusedSteps": reused, "executedSteps": executed, "originalPreserved": preserved,
        "scope": "Existing local non-LLM document agent; rule diagnosis; controlled failure."}


def main() -> None:
    parser = argparse.ArgumentParser(description="Create one failed run and two replay branches; history is preserved.")
    parser.add_argument("--scenario", choices=("eligibility", "registration", "submission"), default="eligibility")
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    parsed = urlparse(args.api)
    if parsed.scheme != "http" or parsed.hostname not in ("127.0.0.1", "localhost", "::1") or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ("", "/"):
        parser.error("Use a local HTTP API origin without credentials or a path.")

    def call(method: str, path: str, body: dict[str, Any] | None = None) -> Any:
        request = Request(args.api.rstrip("/") + path, method=method,
            data=json.dumps(body).encode("utf-8") if body is not None else None,
            headers={"Content-Type": "application/json"} if body is not None else {})
        with urlopen(request, timeout=30) as response:
            raw = response.read(2_000_001)
        if len(raw) > 2_000_000:
            raise ValueError("API response is too large.")
        return json.loads(raw)

    try:
        print(json.dumps(run_demo(call, args.scenario), indent=2))
    except (HTTPError, URLError, OSError, ValueError, KeyError, TypeError) as error:
        raise SystemExit(f"Demo stopped: {error}. Check the local backend and saved history.") from None


if __name__ == "__main__":
    main()
