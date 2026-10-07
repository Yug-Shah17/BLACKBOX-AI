"""Run from the repository root: python -m uvicorn backend.app.main:app."""

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend.app.routes import compare, diagnose, document_import, document_metrics, documents, metrics, runs
from backend.app.services.diagnosis import DiagnosisService
from backend.app.services.store import RunStore, StorageError
from backend.app.services.document_scenarios import scenarios

ROOT = Path(__file__).resolve().parents[2]


def create_app(data_dir=None, model_path=None, metrics_path=None, fixture_path=None):
    application = FastAPI(title="Black Box API", version="1.1.0")
    application.add_middleware(CORSMiddleware,
                               allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
                               allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
    application.state.store = RunStore(data_dir or ROOT / "backend" / "data",
                                       fixture_path or ROOT / "backend" / "data" / "runs.json")
    application.state.document_store = RunStore(Path(data_dir or ROOT / "backend" / "data") / "documents")
    application.state.diagnoser = DiagnosisService(Path(model_path or ROOT / "ml" / "models" / "step_ranker.joblib"))
    application.state.metrics_path = Path(metrics_path or ROOT / "ml" / "outputs" / "metrics.json")
    application.state.document_metrics_path = ROOT / "data" / "document_benchmark.json"

    @application.exception_handler(StorageError)
    async def storage_error(request: Request, error: StorageError):
        return JSONResponse(status_code=503, content={"detail": str(error)})

    for router in (runs.router, diagnose.router, compare.router, metrics.router, documents.router, document_metrics.router, document_import.router):
        application.include_router(router)

    @application.get("/document-scenarios", tags=["Document workflow"])
    def document_scenarios():
        return scenarios()

    @application.get("/health")
    def health_check():
        return {"status": "ok", "workflow": "arithmetic-demo-v1", "scope": "controlled local demo"}

    @application.get("/ready")
    def readiness_check(request: Request):
        predictor = application.state.diagnoser.ensure_loaded()
        try:
            measured = metrics.get_metrics(request)
        except HTTPException as error:
            raise HTTPException(503, "Measured metrics are not ready") from error
        if (measured.modelVersion != predictor.artifact["modelVersion"]
                or measured.schemaVersion != predictor.artifact["schemaVersion"]
                or measured.datasetSha256 != predictor.artifact.get("datasetSha256")):
            raise HTTPException(503, "Model and metrics versions do not match")
        application.state.store.list_runs()
        application.state.document_store.list_runs()
        return {"status": "ready", "modelVersion": measured.modelVersion,
                "schemaVersion": measured.schemaVersion, "scope": "controlled local demo"}

    return application


app = create_app()
