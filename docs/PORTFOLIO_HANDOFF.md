# Portfolio handoff — 26 October 2026

Status: integrated and locally verified on `portfolio/integration`; review required before main merge or production deployment. The public demo still serves the previous release. No paid provider calls were made for this work. No dependencies were added or upgraded.

## What changed

- A direct **Start guided failure** action creates a fictional registration run in local mode. The trace explains diagnosis, correction and comparison. Shared/temporary demo labels replace personal-workspace claims, and broader document questions default to local source extraction until Gemini is deliberately selected with consent.
- Corrupt arithmetic observations produce a useful 409 conflict instead of crashing replay. Saving a run cannot reuse and overwrite an existing checkpoint identifier. Original records remain immutable.
- New local document runs rank exact words across title/topic/body instead of returning topic matches in input order. Recorded v1/v2 workflows keep their old semantics. Correction suggestions follow the new ranking and recorded retrieval order for v3.
- A frozen 12-source, 20-query offline retrieval fixture records unchanged baseline and improved results, including failures. See [retrieval evaluation](RETRIEVAL_EVALUATION.md).

## Two-minute demonstration

Start the local API/frontend using the README setup. Open `/runs`.

1. Click **Start guided failure**. It uses fictional data, local answering and a deliberately injected unsupported answer; it is not an observed Gemini failure.
2. Read the failed answer and its source. The evidence diagnosis flags **Compose answer**, step 3. Explain that these are rules over recorded observations, not a trained document-diagnosis model.
3. Click **Test a correction**. Review the suggested literal source extract and citation. Two earlier steps will be reused; generation and validation will execute in a new branch.
4. Click **Execute replay**. Compare the failed original with the successful replay. The answer changes to the fictional registration deadline. The original is still failed and unchanged.
5. For a negative demonstration, replay with `{"answer":"Registration closes tomorrow.","citation":"registration-current"}`. The validly shaped correction still fails evidence checks. Invalid JSON shows an inline error and can be corrected without losing the original.
6. Show the retrieval report separately: top-1 source selection improved **4/17 → 15/17**, MRR **0.2647 → 0.8824**, and the three easy negative queries abstain in both versions. Explain that this is a developer-authored synthetic stress set, not real-world answer accuracy or an independent held-out test.

Screenshots are actual local browser captures:

- [Failed answer and diagnosis](screenshots/guided-failure.jpg)
- [Correction checkpoint](screenshots/correction.jpg)
- [Successful comparison](screenshots/comparison.jpg)
- [Invalid JSON recovery](screenshots/correction-error.jpg)
- [Phone comparison](screenshots/comparison-mobile.jpg)

## Explain it in an interview

**What did you build?** A small document-workflow inspection tool. It records which sources were retrieved, which source was selected, what answer was produced, and which checks passed. You can replace a supported intermediate output and compare a new execution with the original.

**What is retrieval?** Choosing candidate sources before answering. The original implementation only checked topic words and kept input order. v3 removes common question words and counts exact matches: matching title/topic tokens count twice, matching body tokens once. Higher scores come first; ties keep source order. Archived sources remain visible for investigation, while normal selection skips them.

**Why not embeddings?** This project has at most 30 supplied documents and already has a transparent local pipeline. A lexical change was measurable without introducing another service, model or dependency. It still misses synonyms, word inflections and missing details, so it is not semantic search.

**What is a checkpoint?** A saved state immediately before a step, including the earlier trace. Replay reuses that recorded prefix, substitutes the reviewed output and runs the remaining steps. A new run ID and checkpoint IDs preserve the original. Collision guards stop accidental checkpoint overwrites.

**What does diagnosis prove?** A bounded rule can identify an archived source, missing retrieval, unsupported output or citation mismatch. It suggests a likely origin from evidence. A passing check does not establish general factual correctness. Arithmetic step ranking is a separate synthetic logistic-regression experiment, with no demonstrated advantage over domain rules.

**How did you evaluate it?** Freeze documents, questions and relevance labels; run the unchanged v2 and v3 against identical data; inspect every result; report source ranking and negative-query abstentions separately. Top-1 divides correct first current sources by 17 positive queries. MRR rewards the rank of the first relevant source. Two failures remain visible. The developer authored and inspected the challenge cases, so they are not independent held-out evidence.

## LinkedIn project description

Built **Black Box**, a student prototype for inspecting document-answer workflows with Next.js, TypeScript and FastAPI. It records retrieval, source selection, answers and validation, then supports checkpoint replay into a separate branch for comparison with the untouched original.

I improved the guided failure-to-correction demo, strengthened replay/persistence validation, and evaluated a transparent lexical retrieval change on a reproducible, developer-authored synthetic set: top-1 relevant-source selection rose from 4/17 to 15/17. The project documents failure cases and separates retrieval results from answer correctness. Document diagnosis uses rules; optional Gemini answering requires explicit consent.

This is a bounded public demonstration with shared, temporary history—not a private document service or an autonomous repair system.

Do not describe these metrics as real-world accuracy, trained document ML, production readiness, or an advantage over embedding retrieval. Do not imply this integration is already live.

## Verification and limits

- Python 3.14 quality gate: 84 tests passed, pip check passed, arithmetic/replay/document benchmark commands completed. Includes checkpoint collision, malformed observations, version compatibility, paired retrieval reproduction and original preservation checks.
- Frontend: 32 tests passed; lint, TypeScript and production build passed. Browser verified failure → diagnosis → correction → successful comparison, invalid JSON recovery, a wrong correction remaining failed, and 390px phone comparison without page overflow. This is a bounded smoke check, not an accessibility certification.
- Hosted baseline: homepage renders; health/readiness and both run-list endpoints return HTTP 200. Complete hosted upload/answer/replay was not verified. The hosted code remains unchanged.
- **Release blocker:** existing Next.js 16.3.8 is included in published critical advisory ranges. `npm audit` reports 1 critical and 4 high package entries. Updating existing versions is pending owner approval; manifests and lockfile remain unchanged. See [dependency findings](DEPENDENCY_FINDINGS.md).
- Shared history, ephemeral free hosting, single-worker storage, unverified source metadata, exact-token retrieval and no robust question-answerability guarantee remain limitations. The local default returns source extracts or word counts, not general LLM answers.
- No video recording was created; the screenshots and walkthrough are the demonstration deliverables.

At the 26 October 08:00 IST check-in, confirm later laptop availability before scheduling more unattended work. Deadline: Wednesday 28 October 2026, 20:00 IST.

