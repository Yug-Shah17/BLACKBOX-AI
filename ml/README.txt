BLACK BOX ML: CONTROLLED ARITHMETIC STEP RANKER

Canonical setup and dependencies: repository README.md and requirements.txt.
The older ml/requirements.txt is an environment freeze, not the lean install path.

From the repository root, with the project Python environment:
python -m ml.generate_dataset --scenarios 100 --seed 42
python -m ml.train_model
python -m ml.predict --run-id scenario-42-00000-calculation_error
python -m ml.evaluate_model
python scripts/check.py

Observed traces: data/agent_ml/agent_runs.jsonl
Separate labels: data/agent_ml/evaluation_labels.jsonl
Trusted trained artifact: ml/models/step_ranker.joblib
Original split report: ml/outputs/metrics.json
Fresh-seed comparators: ml/outputs/benchmark.json
Executed replay report: ml/outputs/replay_benchmark.json

Training is grouped by scenario; answer_mismatch is excluded from training.
Root-cause labels never enter predictor features. IDs and timings are not inputs.
The model scores explicit errors, local inconsistencies, missing inputs and kind.
Scores are uncalibrated ranking signals, not confidence percentages.

The strong consistency-rule baseline matches the model on the fresh synthetic
benchmark. No ML advantage over those rules or real-world accuracy is established.
Replay corrections are supplied outputs, not generated model repairs.

See docs/MODEL_CARD.md and docs/EVALUATION.md for the tested scope and limitations.
No paid LLM API is used. Only load artifacts you trained or explicitly trust.
Restart the backend after retraining; model, schema, sklearn version and dataset
fingerprint checks protect compatibility but do not secure untrusted joblib files.
