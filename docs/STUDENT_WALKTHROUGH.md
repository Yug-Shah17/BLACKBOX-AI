# Understand One Run

This version deliberately stays small: one local document agent, four steps,
rule-based diagnosis, and manual checkpoint corrections. The arithmetic model
remains a separate component. This walkthrough uses local mode and does not call
an LLM. The website also offers optional consent-based Gemini answering; it is
separate from the local demonstration below. No external-agent recorder has been
added. Do not describe the HTTP demo client as another autonomous agent.

## Run The Demonstration

With the local website/backend running, from the repository root:

```powershell
.\.venv\Scripts\python.exe -B scripts\student_demo.py
```

The command creates a failed eligibility run, one correct replay and one wrong
replay. It checks outcomes, prefix reuse and original preservation, then prints
their IDs. History is not deleted. Open the original at
`http://127.0.0.1:3000/trace/<originalRunId>` and select Compare branches.

The script calls the same API as the website. It does not ingest arbitrary traces
or make an external framework replayable. No key or additional dependency is needed.

## What Happens

| Step | Meaning | Failure demonstration |
|---|---|---|
| 1. Retrieval | Find source IDs with matching topic keywords | Current and archived eligibility sources are retrieved |
| 2. Selection | Choose one retrieved source | The controlled fault chooses the archived source |
| 3. Generation | Copy that source's text and cite its ID | The answer faithfully copies an outdated document |
| 4. Validation | Check relevance, current flag, exact text and citation | The archived flag causes failure |

The final validation error is a symptom. Diagnosis points to step 2 because the
recorded selected source is archived. It does not read the private fault label.
The current flag is metadata we provide, not automatic fact checking.

## Why Replay Works

A checkpoint stores the state BEFORE a step. Correcting selection at checkpoint
2 reuses retrieval (step 1), then executes selection, generation and validation
(steps 2-4) again. A new branch is saved; the original stays unchanged.
Choosing the archived source again still fails. Replay is not guaranteed success.

## Read Only These Files First

1. `scripts/student_demo.py`: the short request-by-request demonstration.
2. `backend/app/services/documents.py`: DocumentRequest, relevant, execute, diagnose.
3. `backend/app/routes/documents.py`: saving, loading, replay validation and comparison.
4. `backend/tests/test_student_demo.py`: the same demonstration against isolated HTTP test storage.

Ignore upload parsers and arithmetic training while learning this run. They are
supporting features, not prerequisites for explaining these four steps.

## Your First Contribution

Run `--scenario registration` and then `--scenario submission`. Before each run,
predict the suspect step, which steps will be reused, and whether the wrong
correction will pass. Explain why the prediction stays the same across topics.

For a first tiny code edit, change the argparse `--scenario` default in
`scripts/student_demo.py` from `eligibility` to `registration`, run the command
without flags, and confirm that the topic changes but the replay boundary does
not. You do not need to change the model, catalog or checkpoint storage.

Next, use two small text files of your own in the UI: one current and one archived.
Set matching topics, ask a question, and reproduce the selection correction.
You can own the test document design and explain your expected results; that is
a meaningful contribution, even before changing the executor.

## Explain It In Your Own Words

Answer these without reading the code:
- Why is generation not the original fault in this example?
- Why is the checkpoint before step 2 rather than after it?
- Why is the validator not editable?
- Why can a structurally valid correction still fail?
- What is rule-based here, and where is the separate learned model?
- Why does this not prove arbitrary-agent or real-world generalization?

Do not claim you wrote or understand every component. Describe the parts you have
run, inspected and modified, and acknowledge AI assistance accurately.
