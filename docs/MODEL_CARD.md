# Model Card: demo-step-ranker-v1

## Intended Use

Rank the likely originating step of one controlled arithmetic-agent failure.
Useful for demonstrating trace observability, structured evidence, and replay.
Not suitable for general-agent diagnosis, safety decisions, or production use.

## Data and Model

- Training source: generated arithmetic traces, not user or real-world logs.
- Five ordered steps and four single-fault families plus healthy runs.
- 300 default training runs after scenario splitting and held-out fault exclusion.
- Balanced logistic regression with a dictionary vectorizer.
- Features: step type, explicit error, local arithmetic/selection mismatch, missing input.
- A fixed score threshold of 0.5 controls whether suspects are returned.
- Scores are not calibrated probabilities of root cause.

Evidence comes from deterministic observable checks, not generated natural-language
reasoning. The model ranks steps; it does not classify fault type or generate fixes.
Unsupported source tags abstain. Supported tags are not evidence of real-world
coverage; validation also enforces the bounded arithmetic contract.

## Evaluation

Original evaluation groups related traces by scenario and excludes
`answer_mismatch` from training. Fresh-seed testing uses seeds 101, 202, and 303
with no retraining. Both the model and first-local-evidence rules score perfectly
on these controlled traces. This exposes generator simplicity, not general
intelligence or demonstrated superiority to a strong rule baseline.

See EVALUATION.md and the machine-readable reports for exact measured counts.

## Important Limitations

- The local consistency features encode arithmetic domain knowledge.
- The held-out composition fault is a new injection family within the same
  workflow; its mismatch feature is already exercised by other fault types.
- Fixed topology, no simultaneous faults, no noisy/missing observations,
  no hidden semantic retrieval errors, and no independent real-world dataset.
- High synthetic accuracy is not a real-world accuracy estimate.
- No calibration study, automated correction generator, or external agent adapter.

## Artifact Safety

`joblib` deserialization can execute code. Load only a trusted locally trained
artifact, never an uploaded or downloaded unknown model. Schema and sklearn
version checks prevent accidental compatibility drift, not malicious artifacts.
The evaluation report stores the artifact SHA-256. Rebuild from seed-42 data
with root requirements when the environment changes; restart the API afterward.
