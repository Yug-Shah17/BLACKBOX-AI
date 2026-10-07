"""Run the non-UI quality gate with the current Python environment."""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main():
    if not (ROOT / "ml" / "models" / "step_ranker.joblib").is_file():
        raise SystemExit("Model missing. Run python -m ml.generate_dataset then python -m ml.train_model.")
    commands = [
        ["-m", "pip", "check"],
        ["-B", "-m", "unittest", "ml.test_pipeline", "ml.test_evaluation",
         "backend.tests.test_api", "backend.tests.test_robustness", "backend.tests.test_documents", "backend.tests.test_gemini_documents", "backend.tests.test_document_import", "backend.tests.test_student_demo"],
        ["-B", "-m", "ml.evaluate_model"],
        ["-B", "scripts/replay_benchmark.py"],
        ["-B", "scripts/document_benchmark.py"],
    ]
    for arguments in commands:
        print(f"Checking: {' '.join(arguments)}", flush=True)
        subprocess.run([sys.executable, *arguments], cwd=ROOT, check=True)
    print("Non-UI quality gate passed. Reports are in ml/outputs/.")


if __name__ == "__main__":
    main()
