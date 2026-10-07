# Gemini Document Answers

## Local Setup

Keep the Google project on Free Tier. Store `GEMINI_API_KEY` in backend environment settings;
on Windows the backend also reads the current user's Environment registry setting.
Never put the key in frontend variables, source files, screenshots, or Git.
The backend uses Python standard-library HTTPS, with no new SDK dependency.

Choose **Gemini document answers** in New run and explicitly consent to external processing.
The selected document text and question are sent to Google. Free-tier data may be used
to improve Google products: use fictional or non-sensitive documents only.
The app cannot verify or enforce the Google project's billing tier.

## Workflow

1. Retrieval includes the provided documents, without claiming semantic search.
2. Selection chooses the first current document (or archived document in wrong-source demos).
3. Generation asks `gemini-3.5-flash-lite` for an answer and exact source quotes.
4. Validation checks citation, current source, quote presence and recorded answer integrity.

Answers do not aggregate across multiple documents. Reorder or upload the intended source first.
Explicit single-word counts remain deterministic and local, even in Gemini mode.
When information is absent, the answer is `The document does not contain this answer.`

Validation is **not a semantic accuracy guarantee**. A model can attach real quotes to an
incorrect interpretation or abstain incorrectly. Read the evidence before relying on an answer.
Prompt instructions reduce, but do not eliminate, document prompt-injection risk.

## Quota and Replay

There is one bounded request per executed hosted generation: 30-second timeout,
1024 maximum output tokens, no automatic retry, no paid provider or model fallback.
Missing keys, quota exhaustion, network errors and invalid responses become inspectable failed traces.
Replay from retrieval or selection can execute generation again and consume quota.
Manual generation replacement does not call Gemini; it accepts only literal source extracts.
This bounded replacement check is not general evaluation of a rewritten answer.

Existing local v1/v2 traces retain their semantics. Hosted traces use `document-qa-gemini-v1`.
Existing arithmetic and synthetic document benchmarks do not measure Gemini answer quality.
