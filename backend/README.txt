BLACK BOX BACKEND: SINGLE-WORKER LOCAL DEMO

Use the root README.md and requirements.txt for complete setup.
From the repository root:
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --workers 1
python scripts/check.py

GET /health: process liveness.
GET /ready: trusted model loading, report/version/fingerprint match, readable store.
GET /docs: interactive API documentation.

POST /runs: {"a":12,"b":30,"failureType":"calculation_error"}
POST /diagnose: {"runId":"RETURNED_ID"}
POST /runs/RETURNED_ID/replay:
{"checkpointStep":3,"alternativeAction":{"type":"replace_output","output":{"result":42}}}
GET /compare?original=RETURNED_ID&replay=REPLAY_ID
GET /runs, /runs/{runId}, /runs/{runId}/trace, /runs/{runId}/observed, /metrics

Public step IDs/checkpointStep are one-based. Canonical ML stepIndex is zero-based.
Checkpoints are before the named step. Supported replacement outputs:
1: {"documents":[{"documentId":"primary","values":[12,30]}]}
2: {"documentId":"primary"}
3: {"result":42}
4: {"answer":42}
Step 5 validation cannot be overridden. Incorrect corrections can remain failed.
Prefix steps are reused; suffix tools execute. Original runs remain unchanged.
Private fault-injection config stays outside observed predictor traces.

Storage uses backend/data/state.json with an in-process lock and atomic replace.
Run exactly one worker, localhost only. There is no authentication or cloud DB.
Legacy travel fixtures have no supported diagnosis or restorable checkpoints.
Unmeasured metrics remain null; no fake predictions or confidence percentages.
See docs/ARCHITECTURE.md, docs/EVALUATION.md and docs/DEMO.md.
