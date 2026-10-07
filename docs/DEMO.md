# Five-Minute Demo

## Before Presenting

Run `python scripts/check.py` with the repository Python environment. Save the
evaluation reports. Open the existing UI and confirm its API-connected indicator.
Use a recording as a backup; do not claim a recording has been created unless
you actually record one. API docs can demonstrate the backend if the UI fails.

## Primary Demo: Document Failure And Correction

Start on the homepage, open the workspace, and choose Try example. Select
Local extracts and word counts, select Team eligibility, then expand Failure
simulation and choose Wrong source. This demonstration does not require a key.
All supplied documents are fictional demo material. The archived
source says exactly 3 final-year students; the current source says 2 to 4
currently enrolled college students.

Open the failed run. Inspect its recorded answer and expand the source documents.
Diagnosis should identify selection, step 2, with evidence that the selected
source is archived. This diagnosis uses rules, not the arithmetic ML model.

Replay step 2 with `{"documentId":"eligibility-current"}`. Compare the successful
branch with the failed original: retrieval is reused, while selection, generation,
and validation execute again. The original stays unchanged.

As a negative check, replay with `{"documentId":"eligibility-archived"}`.
The branch must still fail. Registration and submission are additional fictional
sets with different questions and source text, not alternate names for addition.

Open Evaluation. Show the separate document report: three healthy cases and
twelve injected faults. Its corrections are known fixture outputs, not AI-generated
repairs. Download the report or source context when supporting evidence is needed.

## Arithmetic Scenario 1: Healthy Execution

Create a normal run with values 12 and 30. Inspect the five-step trace and final
validation. Diagnosis should abstain rather than invent a suspicious step.

## Arithmetic Scenario 2: Find and Correct an Upstream Failure

Create a `calculation_error` run with 12 and 30. The calculation reports 46 and
the downstream validator fails. The model should rank calculation (step 3), not
simply point to the final failed validator. Inspect evidence: 46 is not 12 + 30.

Replay from checkpoint 3 with `{"result":42}`. Show the successful branch, two
reused prefix steps, three executed suffix steps, and real changed outputs.
Show that the failed original still exists unchanged.

## Arithmetic Scenario 3: A Correction Is Not Guaranteed To Work

Replay the original calculation fault using `{"result":99}`. The branch should
remain failed. This proves replay does not force success. An earlier-step replay
can also leave a later injected fault intact.

## API Requests

```json
{"a":12,"b":30,"failureType":"calculation_error"}
```

Send this to `POST /runs`, then use the returned run ID in `POST /diagnose`:

```json
{"runId":"RETURNED_ID"}
```

For `POST /runs/RETURNED_ID/replay`:

```json
{"checkpointStep":3,"alternativeAction":{"type":"replace_output","output":{"result":42}}}
```

Compare with `GET /compare?original=RETURNED_ID&replay=REPLAY_ID`.

## What To Say About Results

"This is a bounded agent-debugging prototype. We evaluate grouped synthetic
traces, compare learned ranking with both a naive baseline and simple domain
rules, and verify checkpoint replay independently. The model matches the domain
rules here; real-agent generalization is still untested."
