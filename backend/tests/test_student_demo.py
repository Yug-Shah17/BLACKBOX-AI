"""Exercise the student demo through the same HTTP contracts as the website."""
import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from backend.app.main import create_app
from scripts.student_demo import run_demo


class StudentDemoTests(unittest.TestCase):
    def test_demo_checks_good_and_bad_corrections_without_overwriting_original(self):
        with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as directory:
            with TestClient(create_app(data_dir=directory, fixture_path=Path(directory) / "absent")) as client:
                def call(method, path, body=None):
                    response = client.request(method, path, json=body)
                    response.raise_for_status()
                    return response.json()
                for scenario in ("eligibility", "registration", "submission"):
                    result = run_demo(call, scenario)
                    self.assertEqual(result["correctedOutcome"], "success")
                    self.assertEqual(result["wrongCorrectionOutcome"], "failed")
                    self.assertTrue(result["originalPreserved"])
                    self.assertEqual(result["reusedSteps"], [1])
                    self.assertEqual(result["executedSteps"], [2, 3, 4])

    def test_unknown_scenario_does_not_create_a_run(self):
        calls = []
        def call(method, path, body=None):
            calls.append((method, path))
            return []
        with self.assertRaisesRegex(ValueError, "Scenario unavailable"):
            run_demo(call, "unknown")
        self.assertEqual(calls, [("GET", "/document-scenarios")])
