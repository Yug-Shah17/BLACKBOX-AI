"""Policy and metric checks for the offline study, independent of its corpus."""

import unittest
from unittest.mock import patch

from ml import abstention_study as study


class AbstentionStudyTests(unittest.TestCase):
    def test_coverage_bounds_and_existing_unicode_normalization(self):
        source = {"documentId": "a", "title": "Straße", "topic": "office", "text": "Hours"}
        self.assertEqual(study.coverage("STRASSE", source, [source]), 1)
        self.assertEqual(study.coverage("the and", source, [source]), 0)
        self.assertEqual(study.coverage("parking", source, [source]), 0)
        self.assertGreater(study.coverage("office parking", source, [source]), 0)
        self.assertLess(study.coverage("office parking", source, [source]), 1)

    def test_metrics_keep_ambiguous_relevance_and_undefined_denominators(self):
        rows = [{"id": "p", "expectedDocumentIds": ["a", "b"], "baseline": ["x", "b", "a"], "candidate": []},
                {"id": "n", "expectedDocumentIds": [], "baseline": ["a"], "candidate": []}]
        baseline = study.summary(rows, "baseline")
        self.assertEqual(baseline["mrr"], 0.5)
        self.assertEqual(baseline["meanRecallAt3"], 1)
        self.assertEqual(study.summary(rows, "candidate")["negativeAbstentions"], 1)
        self.assertIsNone(study.summary([], "candidate")["mrr"])
        self.assertFalse(study.evaluate_holdout({"documents": [], "queries": []}, 0)["acceptancePassed"])

    def test_calibration_enforces_retention_and_selects_smallest_tied_threshold(self):
        def scored(_split, threshold):
            rows = [{"id": str(i), "expectedDocumentIds": ["a"], "baseline": ["a"],
                     "candidate": ["a"] if threshold <= 0.5 else []} for i in range(20)]
            return rows + [{"id": "n", "expectedDocumentIds": [], "baseline": ["a"],
                            "candidate": [] if threshold >= 0.25 else ["a"]}]
        with patch.object(study, "score_split", side_effect=scored):
            self.assertEqual(study.calibrate({})["selectedThreshold"], 0.25)


if __name__ == "__main__":
    unittest.main()
