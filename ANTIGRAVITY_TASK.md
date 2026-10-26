# Antigravity implementation and QA handoff

Status: PREPARED ONLY. No Antigravity agent has been started. Yug explicitly authorized bounded implementation as well as QA. Start when Yug opens this folder and submits this task; no need to wait for a Codex reset. Do not repeat completed coordinator work.

## Workspace and boundaries

Open THIS folder only: C:/Users/staff/Desktop/BLACKBOX-AI/worktrees/antigravity-manual
Branch: portfolio/antigravity-manual. Base integration: 242d836. This is a Git worktree, not a security sandbox. Stay inside this folder. Preserve existing changes and inspect Git status first. Read applicable AGENTS.md and project instructions. No other worker owns these assigned files.

Do not merge, deploy, push, delete records/files, change credentials/accounts, read secrets, call Gemini or other paid APIs, add dependencies, update lockfiles, or modify backend/retrieval/API schemas/frozen evaluation fixtures. Use fictional documents only. Preserve the visual direction and existing functionality. Do not change recorded results or classify answer correctness from invented heuristics. If a necessary fix exceeds ownership, report it rather than expanding scope.

## Task 1: truthful recorded-output labels

Ownership: frontend/src/components/workspace/document-evidence.tsx and frontend/src/components/workspace/trace.tsx, plus narrowly relevant tests under frontend/tests.

Inspect recorded generation metadata and existing local contracts before editing. Make source extracts, word counts, and provider-generated answers distinguishable using explicit recorded metadata. Explain near local source extracts that matching source text does not establish whether the user's question was answered. Keep run outcome/status intact: a passed execution is not a new accuracy score. Retain correct copy/download controls, citation inspection, and legacy-record fallbacks. If metadata cannot reliably distinguish a case, use neutral wording and document the ambiguity. No API/schema changes or new ML logic.

Acceptance: a literal source extract is clearly labeled as such; count output is accurately described when metadata supports it; provider output is not mislabeled as a local extract; missing/legacy metadata does not crash or produce a false claim. Add meaningful regression checks appropriate to the existing test setup. Commit this task separately.

## Task 2: fresh-browser QA and demonstrated small fixes

Ownership: frontend/src/components/workspace/new-run-dialog.tsx and narrowly scoped rules in frontend/src/app/globals.css, only for issues reproduced in this task. Existing task-1 files may receive directly related accessibility fixes. No redesign or broad formatting/refactoring.

Use fresh regular Chrome. A previous pass used an in-app browser with a four-format batch and source-selection replays; this task specifically checks FOUR separate original uploads and keyboard-only operation.

1. Using keyboard navigation, open Upload document. Use qa-fixtures/policy.txt ALONE, local word counts only, question: How many times does "integrity" appear? Execute once. Expect Successful, count 3 and the matching source. Record run ID and screenshot. If slow, inspect history before retrying; never double-submit blindly.
2. Repeat separately with policy.md, policy.pdf and policy.docx. All expect count 3. Never select Gemini/external processing.
3. Check keyboard access to source details, checkpoint tab, copy/download controls, and dialog. Escape should close the upload dialog and restore opener focus. Record exact failures.
4. Check Light and Dark with reload, then a 390px viewport for upload dialog and trace. Check clipping, page overflow and unreachable controls. Restore normal viewport.
5. Fix only reproduced focus, keyboard or responsive issues in owned files. Capture before/after and recheck the affected flow. If none exists, report that; do not invent changes.

## Runtime and validation

The existing local preview may be at http://127.0.0.1:3001/runs and backend at http://127.0.0.1:8000. Check availability; do not assume they are running. Never stop/restart those shared services. That preview does not show your edits.

For your own changed frontend, use this worktree's frontend directory. If needed install ONLY the exact existing lockfile with npm ci --cache C:/Users/staff/Desktop/BLACKBOX-AI/.npm-cache; do not install new packages or update versions. Set BACKEND_URL=http://127.0.0.1:8000 for your process and use a separate frontend port 3002 (npm run dev -- --port 3002). If backend is unavailable, finish independent code/tests and record browser checks as blocked; do not reconfigure storage or launch another backend. Keep track of your own process and stop only that process afterward.

Run npm test, npm run lint, npx --no-install tsc --noEmit, and npm run build from frontend. Record actual results, including failures; never claim a skipped check passed. No production deployment. Follow project documentation lookup rules for APIs you need to consult.

## Deliverables

Write docs/ANTIGRAVITY_RESULTS.md: commits, changed files and reasons, tests with actual output summary, Chrome version/time, observed versus expected results, run IDs, screenshots, remaining failures and exact next action. Screenshots go under docs/screenshots/antigravity/. Distinguish passed, failed, blocked and skipped checks. Keep metrics unchanged and disclose the known retrieval limitation: the frozen review's improved retriever abstained on 0/4 unsupported questions; this handoff does not fix retrieval.

Commit task 1 and any task-2 fixes separately, then commit the report/screenshots. Return commit IDs and a concise summary for Codex review. Do not integrate into portfolio/integration or main. Codex will inspect, test and decide what to cherry-pick; being on a branch does not guarantee correctness.

If Git reports differing ownership, use this exact command-scoped exception for each Git command: git -c safe.directory=C:/Users/staff/Desktop/BLACKBOX-AI/worktrees/antigravity-manual status --short. Apply the same flag to add/commit, never wildcard global trust. Stage exact owned paths, never all files blindly.
