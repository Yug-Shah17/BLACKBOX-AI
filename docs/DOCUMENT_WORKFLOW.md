# Document Workflow

## Scope

Black Box now has a second executable workflow, separate from arithmetic:
local document retrieval, source selection, extractive answer generation, and
validation. It records actual local step execution, inputs, outputs, timing,
errors, and pre-step checkpoints. No external API key is required.

This is a controlled document workflow, not an LLM agent. Retrieval matches
question words against document topic words. Generation copies the selected
document text. Validation requires a current, relevant source, exact source
text, and the matching citation. These checks are intentionally bounded;
they do not establish semantic correctness or document authenticity.

## Uploading Your Documents

In New run, select Document question answering, then Document source > Upload
documents. Choose 1-10 `.txt`, `.md`, text-based `.pdf`, or `.docx` files.
Text/Markdown must be UTF-8 and at most 40,000 bytes. PDF/DOCX files may be at
most 2,000,000 bytes; PDFs may contain at most 20 pages. Extracted text must
contain 1-10,000 characters. Scanned/textless or encrypted PDFs, legacy `.doc`,
empty content and malformed files are rejected; invalid batches do not partially load.
Choosing another batch replaces the previous batch. Individual sources can be
removed. Markdown is shown as plain text, never executed or rendered as HTML.
Replacement is atomic: if the new batch fails, previous files and edited metadata
remain usable. Cancelling extraction or closing the dialog stops waiting and
ignores late responses. Requests have a 20-second client timeout; the local
parser may continue until its separate 15-second execution timeout.

Review each Topic (derived from the filename and opening text, at most 200 characters)
and Current source checkbox. Topics drive keyword matching, not semantic search.
Use a short topic containing the words in your question; uncheck archived sources.
The current flag is user-provided metadata, not verified authenticity or recency.
Enter a question and execute. Upload mode defaults to successful execution;
controlled fault modes remain available for diagnosis/replay demonstrations.

Text/Markdown files are read in the browser. PDF/DOCX bytes are sent to a local
extraction endpoint before preview. On execution extracted text and metadata are sent to
the local backend and persisted in the run/checkpoint store. Do not upload secrets
or confidential documents. There is no external model service, raw-file hosting,
OCR, or automatic deletion. Raw PDF/DOCX files are not saved by the extractor.
Answers still copy the selected whole source;
uploads do not introduce an LLM or broaden the existing correctness claims.

## API Reference

- `POST /document-import?filename=name.pdf`: bounded PDF/DOCX extraction, raw
  bytes body, returning a document for preview (not a saved run). One parser at a
  time in a separate process with a 15-second timeout; ZIP expansion/page-content
  checks and safe XML parsing. DOCX body paragraphs/tables only; no headers, images,
  OCR, or guaranteed layout/reading-order preservation. This is not a security
  sandbox or hard memory quota; keep the unauthenticated service local.
  PDF decoder output, page-tree and form-invocation caps are applied before
  extraction, using the pinned pypdf configuration API. A busy parser returns
  503 with Retry-After rather than reporting a valid file as malformed.

Use the Document workflow section of the backend's `/docs` page.

- `POST /document-runs`: execute a question over local documents.
- `GET /document-scenarios`: three fictional scenario packs for the new-run picker.
- `GET /document-runs`: list document executions.
- `GET /document-runs/{run_id}`: inspect a recorded execution.
- `GET /document-runs/{run_id}/sources`: question and source context without private fault labels.
- `POST /document-runs/{run_id}/diagnose`: evidence-based rule diagnosis.
- `POST /document-runs/{run_id}/replay`: replace one step output and execute its suffix.
- `GET /document-runs/{run_id}/compare?replay={branch_id}`: compare a direct replay branch.
- `GET /document-evaluation`: validated controlled benchmark, or 503 if missing or stale.

Creating a default failure:

```json
{"failureType":"wrong_source"}
```

Correcting source selection:

```json
{
  "checkpointStep": 2,
  "alternativeAction": {
    "type": "replace_output",
    "output": {"documentId":"current"}
  }
}
```

The retrieved prefix is reused. Selection, generation, and validation execute
again. The original is never overwritten. A replay branch can itself be
replayed. Missing or inconsistent checkpoints return 409 without saving a run.
The complete four-step original and every checkpoint are checked before replay,
including suffix observations beyond the selected replay boundary. Missing
checkpoint identifiers, incompatible versions, contradictory verdicts, and
malformed recorded answers return explicit conflicts instead of creating branches.

## Inputs And Faults

The UI offers registration deadline, team eligibility, and submission requirements.
Each fictional pack includes a current source, an archived contradictory source,
and an unrelated notice. The form previews these documents before execution;
the trace shows the recorded answer, citation, and original source context.
The legacy API default remains the returns-policy example shown above.

Optional `question` and `documents` allow custom local inputs. Each document
requires `documentId`, `title`, `topic`, and `text`; `current` defaults to true.
Identifiers must be unique. Limits: 30 documents, 10,000 characters per text,
and 1,000 characters per question.

Fault modes: `normal`, `missing_retrieval`, `wrong_source`,
`unsupported_answer`, and `incorrect_citation`. These are controlled injected
faults for testing, not automatically discovered real-world failure labels.

Replacements have step-specific shapes:

- Step 1: `{"documentIds":["current","archived"]}`
- Step 2: `{"documentId":"current"}` (must be a retrieved document)
- Step 3: `{"answer":"Returns are accepted within 30 days.","citation":"current"}`

Step 4 is the validator and cannot be overridden. Structurally valid but
unsupported answers remain failed. Invalid replacement shapes return 422.

## Diagnosis And Integration Boundaries

Document diagnosis is explicitly `mode: rules`, with no probability or learned
model claim. It reads recorded step inputs and outputs, not private injection
labels. The existing arithmetic model has not been retrained for documents.
Document records use a separate store at `backend/data/documents/state.json`;
the frontend runs and exports pages combine arithmetic and document records.
Run history can filter documents, arithmetic, or legacy examples. Outcome counts,
the latest failed execution, search results, and history exports follow that
workflow filter; the top-level recorded-run totals remain global.
The new-run dialog selects a workflow, and document traces expose rule diagnosis,
eligible replay steps, and direct-branch comparison. Existing visual styling is
unchanged. Arbitrary imported traces are not replayable.

The UI uses the successful replay response directly to retain the saved branch;
it does not mistake a redundant follow-up fetch failure for an execution failure.
Comparison requests have same-branch retry and branch-specific errors. Catalog
loading can retry in place, and whitespace-only questions are rejected before
execution. Structured backend validation errors retain field-level messages.
The comparison view can export the currently selected before/after diff as JSON,
including outcomes, first divergence, and observed step outputs. It does not
export private fault configuration.
The trace's report icon downloads a plain-text summary with the recorded run,
diagnosis evidence, step statuses, optional selected comparison and honest limits.
It omits raw source bodies and private execution configuration. Missing diagnosis
is labeled unavailable, never inferred healthy.

Next milestones are broader labeled document traces and learned-model evaluation, then external
trace recording with adapter-dependent replay.

## Verification

`backend.tests.test_documents` covers four injected faults, evidence and suspect
steps, corrected and incorrect replay results, prefix reuse, suffix execution,
original preservation, branch replay, custom documents, healthy diagnosis,
invalid corrections, protected validation, checkpoint corruption, persistence,
and isolation from arithmetic runs. The project quality gate includes this suite.

`python scripts/document_benchmark.py` executes three healthy cases and all four
faults over all three fictional packs. It checks localization, known corrections,
wrong-correction failure, prefix reuse, suffix execution, and original preservation.
The report at `data/document_benchmark.json` includes a SHA-256 of the scenario
catalog; the API rejects a report for a different catalog or workflow version,
malformed or duplicate cases, inconsistent checkpoint lists, or summary ratios
that disagree with the per-case results.
This is controlled regression evidence, not learned-model or real-world accuracy.
