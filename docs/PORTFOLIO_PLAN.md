# BLACKBOX-AI coordinator progress
Updated 26 October 2026 00:28 IST. Deadline 28 October 20:00 IST. Stop unattended edits at 26 October 08:00 IST and arrange later availability.

## Repository safety
Original ZIP folder BLACKBOX-AI-main untouched, no Git metadata. Fresh clone repository from Yug-Shah17/BLACKBOX-AI at 0cebba7; source comparison found no differences (only clone .git). Main must never be merged/deployed. Integration branch portfolio/integration. Worktrees under worktrees/frontend, backend, retrieval with portfolio/frontend, portfolio/backend, portfolio/retrieval.

## Bounded plan and acceptance
1. Baseline existing backend quality gate, frontend tests/lint/types/build; inspect hosted homepage/workspace without paid calls. Record unavailable checks honestly.
2. Frontend specialist owns frontend/** only: preserve visual direction; make existing fictional failure -> evidence diagnosis -> correction -> comparison flow guided, clear pending/error states and shared ephemeral public-demo labels. No redesign/dependencies. Acceptance: usable local deterministic demo, errors recoverable, original/replay distinguishable, test/build.
3. Backend specialist owns backend/** except backend/app/services/documents.py (retrieval ownership): inspect execute/replay validation, corruption/error handling and immutable originals; add focused regression checks and surgical fixes. Acceptance: invalid replacement rejects usefully, original record unchanged after correct/incorrect replay, existing suites pass.
4. Retrieval specialist owns backend/app/services/documents.py, new retrieval evaluation script/fixture/tests and docs/RETRIEVAL_EVALUATION.md: varied deterministic corpus and queries, measured unchanged baseline, improve lexical retrieval with existing dependencies, paired before/after output with failures. Avoid leakage/tuned claims; no generation/API calls. Acceptance: reproducible command, ranking metrics with denominators, negative/ambiguous cases and limitations, old workflow regression tests pass.
5. Coordinator integrates committed branches sequentially into portfolio/integration, verifies combined behavior, captures screenshots, writes demonstration and beginner explanation plus honest LinkedIn copy; push integration and open draft PR if authentication permits. No main merge or production deploy.

## API contract freeze
Preserve routes and existing JSON fields in backend/app/schemas.py and frontend/src/lib/api.ts. No breaking schema changes without coordinator agreement. Document pipeline remains retrieval(1), selection(2), generation(3), validation(4). Replay accepts checkpointStep + optional checkpointId + alternativeAction {type: replace_output, output: object}; creates new run with parentRunId and preserved original. Public run fields and comparison remain unchanged. Retrieval ranking may change for fresh runs; recorded prefixes must remain compatible. Local-only demo; no Gemini invocation. Prefer additive UI guidance using existing contracts.

## Runtime / blockers
System node and npm exist; python and gh not found on PATH. Bundled Python available C:/Users/staff/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe; must inspect installed packages. No dependency installation authorized. Codebase graph blackbox-portfolio indexed fast; coverage gaps require direct reads. codebase-memory SKILL.md path access denied: do not claim loaded. Ponytail entry and core read.
Usage verified 54% five-hour, 12% weekly; reset 26 October 03:14:57 IST. No reset credits used.
Two heartbeats ACTIVE per creation responses: blackbox-ai-coordinator-continuation 03:20 IST, blackbox-ai-8-am-checkpoint 08:00 IST. Read back before concluding schedule setup. Existing unrelated black-box-submission-polish remains PAUSED.
Live web fetch failed; browser inspection pending. Baseline tests pending.

## Exact next action
Launch bounded specialists in assigned worktrees; inspect bundled runtime packages and run baseline checks; inspect live site through browser; verify saved heartbeats. Update this file before stopping and after milestones, including commits/tests and live agent status.
