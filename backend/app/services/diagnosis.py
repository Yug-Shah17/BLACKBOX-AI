"""Map saved observable traces to the ML predictor and frontend display IDs."""

import threading

from fastapi import HTTPException

from ml.predict import Diagnoser


class DiagnosisService:
    def __init__(self, model_path):
        self.model_path = model_path
        self.predictor = None
        self.lock = threading.Lock()

    def ensure_loaded(self):
        with self.lock:
            if self.predictor is None:
                if not self.model_path.exists():
                    raise HTTPException(503, "Trained model is unavailable; run the ML training command")
                try:
                    self.predictor = Diagnoser(self.model_path)
                except Exception as error:
                    raise HTTPException(503, "Trained model could not be loaded") from error
        return self.predictor

    def diagnose(self, record):
        public = record["public"]
        observed = record.get("observed")
        if observed is None:
            return {"runId": public["runId"], "mode": "model", "status": "unsupported_trace",
                    "explanation": "Legacy travel fixture has no supported structured arithmetic trace."}
        self.ensure_loaded()
        result = self.predictor.diagnose(observed)
        mapping = {step["traceStepId"]: step["stepId"] for step in public["steps"]}
        suspects = [{**suspect, "traceStepId": suspect["stepId"], "stepId": mapping[suspect["stepId"]]}
                    for suspect in result["suspects"]]
        best = suspects[0] if suspects else None
        return {**result, "suspects": suspects,
                "predictedFailureStep": best["stepId"] if best else None,
                "score": best["score"] if best else None, "confidence": None,
                "failureType": None,
                "evidence": [item["message"] for item in best["evidence"]] if best else []}
