"""Measure diagnosis and replay on isolated local executions, not UI mocks."""

import argparse
import json
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.tests.test_robustness import run_matrix


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "ml" / "outputs" / "replay_benchmark.json")
    args = parser.parse_args()
    with tempfile.TemporaryDirectory() as temporary:
        directory = Path(temporary)
        with TestClient(create_app(data_dir=directory, fixture_path=directory / "absent.json")) as client:
            cases = run_matrix(client)
    count = len(cases)
    summary = {"caseCount": count,
               "top1Localization": sum(c["predictedStep"] == c["expectedStep"] for c in cases) / count,
               "fixtureCorrectionSuccessRate": sum(c["correctedOutcome"] == "success" for c in cases) / count,
               "incorrectCorrectionRejectionRate": sum(c["wrongCorrectionOutcome"] == "failed" for c in cases) / count,
               "originalPreservationRate": sum(c["originalPreserved"] for c in cases) / count}
    report = {"scope": "20 controlled executions: four faults x five numeric boundary pairs",
              "correctionSource": "Fixture-provided correct outputs; not model-generated repairs",
              "storage": "Temporary isolated store; live run history untouched",
              "summary": summary, "cases": cases,
              "limitations": "Not evidence of general automatic repair or real-world agent reliability."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, allow_nan=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))
    print(f"Report: {args.output}")
    if any(summary[key] != 1 for key in summary if key != "caseCount"):
        raise SystemExit("Replay regression detected")


if __name__ == "__main__":
    main()
