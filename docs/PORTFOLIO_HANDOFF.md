# Portfolio handoff — 26 October 2026

Status: integrated and locally verified on `portfolio/integration`; review required before main merge or production deployment. The public demo still serves the previous release. No paid provider calls were made for this work. No new direct dependencies were added. Existing Next.js/ESLint configuration and the transitive Zod dependency were upgraded with owner approval.

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

A separate frozen, agent-authored synthetic review improved supported-question source ranking from 7/12 to 12/12, while exposing weaker abstention on unsupported questions (3/4 to 0/4). This is a bounded public demonstration with shared, temporary history—not a private document service or an autonomous repair system.

Do not describe these metrics as real-world accuracy, trained document ML, production readiness, or an advantage over embedding retrieval. Do not imply this integration is already live.

## Verification and limits

- Python 3.14 quality gate: 86 tests passed, pip check passed, arithmetic/replay/document benchmark commands completed. Includes checkpoint collision, malformed observations, version compatibility, paired retrieval reproduction and original preservation checks.
- Frontend: 37 tests passed; lint, TypeScript and production build passed. Browser verified failure → diagnosis → correction → successful comparison, invalid JSON recovery, a wrong correction remaining failed, and 390px phone comparison without page overflow. This is a bounded smoke check, not an accessibility certification.
- Hosted old release: four-format upload previews, local DOCX word count, injected failure diagnosis, corrected replay, comparison export and original preservation were verified through the browser. The hosted code remains unchanged; see [broader QA](QA_OCT26.md).
- **Dependency remediation:** owner-approved updates pin Next.js and eslint-config-next to 16.4.1 and update transitive Zod to 4.6.7. The post-update npm audit reports zero known vulnerabilities. All 37 frontend tests, lint, TypeScript and production build passed again. See [dependency findings](DEPENDENCY_FINDINGS.md); an empty registry audit is not a security certification.
- Shared history, ephemeral free hosting, single-worker storage, unverified source metadata, exact-token retrieval and no robust question-answerability guarantee remain limitations. The local default returns source extracts or word counts, not general LLM answers.
- No video recording was created; the screenshots and walkthrough are the demonstration deliverables.

The owner cancelled the 26 October 08:00 IST checkpoint boundary and authorized continued QA. Both completed/cancelled schedules have been deleted. Deadline: Wednesday 28 October 2026, 20:00 IST.


## Final local validation / review

Historical milestone checks: 86 Python tests plus all quality-gate benchmarks; 37 frontend tests, lint, TypeScript and production build passed during earlier integration. Review against origin main found one Unicode normalization discrepancy between retrieval and correction suggestions; it was fixed with shared explicit normalization and regression cases. The Spec pass reported no actionable implementation gaps. This is a bounded review, not a full security audit.

Draft integration PR: https://github.com/Yug-Shah17/BLACKBOX-AI/pull/1. Feature branches and integration are pushed. Main remains unchanged; no production deployment was requested or performed. The owner cancelled the 08:00 IST checkpoint; it was deleted, as was the completed reset-continuation schedule. Approved existing-dependency patches are now included; main and production remain unchanged.

## Additional review and QA

A separately agent-authored frozen stress set and its paired results are documented in [Retrieval Review Protocol](RETRIEVAL_REVIEW_PROTOCOL.md). It exposes worse unsupported-question abstention in v3 despite better positive-query ranking. [Broader QA](QA_OCT26.md) records four-format uploads, parser error recovery, real local API outage/restart, hosted old-release replay/export, keyboard/mobile/theme checks and remaining limits.

## Reviewed output labels and rejected abstention experiment — 26 October

Output labels now distinguish matching literal source text, a recorded expected word count and provider output backed by matching response evidence. Manual replay metadata does not imply that a provider generated the replacement. Comparison uses each side's own recorded steps. Two new regressions first reproduced the remaining Antigravity bugs; the coordinator fixed them and a second review found no substantive remaining issue in that scope. See [coordinator review](ANTIGRAVITY_COORDINATOR_REVIEW.md).

Current validation: **48 frontend tests**, lint, explicit TypeScript and production build passed in the integration checkout (head `09c91d7`). The existing **86 Python tests** and all quality-gate benchmarks passed; **3 additional offline-study tests** also passed after integration (89 Python tests total via `scripts/check.py`). Four separate original browser uploads (TXT, MD, PDF and DOCX) each returned count 3 with their own citation. Browser checks also verified wrong manual count and literal-extract replay labels against actual retained checkpoint metadata. Original count 3 / success stayed unchanged.

The remaining new-label mobile/theme, Escape/focus and final download checks are blocked by a saved browser origin permission. The owner approved continuing in chat, but the tool still reports a saved permission or managed policy denying access. No workaround was attempted. Earlier mobile/theme/export checks apply to their documented earlier revision and do not establish the new labels' mobile layout. Regular Chrome control is unavailable. This is a bounded tested prototype, not a claim that every website interaction is complete.

A further offline study [tested a lexical coverage abstention gate](ABSTENTION_STUDY_RESULTS.md) on separately frozen calibration and holdout questions. Aggressive thresholds lost too many correctly retrieved calibration positives, so the predeclared rule selected threshold 0. Holdout predictions stayed unchanged: top-1 agreed with frozen relevance labels 20/20; unsupported abstention 1/20. One positive relevance label is debatable and disclosed (`hold-p2`). The candidate failed acceptance and was **not adopted into runtime**. These synthetic results must remain separate from the original 4/17 → 15/17 and review 7/12 → 12/12 reports.

Interview explanation: “I also measured a possible abstention filter. It rejected useful supported questions, so I published that negative result and kept the working behavior rather than presenting it as an improvement.”

For a beginner-friendly architecture walkthrough, replay example, metric definitions and interview practice, see [Understand the project](UNDERSTAND_THE_PROJECT.md).
