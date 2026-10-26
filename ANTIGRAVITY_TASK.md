# Antigravity manual QA handoff

Status: PREPARED ONLY. No Antigravity worker has been started. Start this task only when Yug or the Codex coordinator explicitly hands it over, normally after Codex usage reaches 95%. Do not repeat a case if the latest coordinator checkpoint says it is already complete.

Repository: Yug-Shah17/BLACKBOX-AI. Your branch: portfolio/antigravity-manual. This folder is an isolated Git worktree; Codex edits a different checkout. Base integration commit is 242d836. Do not edit application code, dependency files, other branches, or main. Do not deploy, call Gemini, add services, delete records or change accounts/credentials for this task.

## Exact manual task

Use a fresh regular Chrome browser window against the running LOCAL preview http://127.0.0.1:3001/runs. If unavailable, record that and stop; do not restart services yourself. No project dependency installation is needed for these browser steps. This task checks a fresh-browser, keyboard-only journey and separate standalone uploads; prior checks used an in-app browser and a four-format batch with source replays.

1. With keyboard navigation only, reach Upload document and open it. Use only the fictional fixtures under C:/Users/staff/Desktop/BLACKBOX-AI/qa-fixtures. Select local extracts and word counts; never select Gemini or external processing.
2. Upload policy.txt ALONE. Ask: How many times does "integrity" appear? Execute once. Expected: Successful, count 3, cited source policy.txt. Record outcome and screenshot. Do not double-submit if slow; check history before retry.
3. Repeat as separate original runs for policy.md ALONE, policy.pdf ALONE, and policy.docx ALONE. Expected count 3 and the corresponding citation in each.
4. Verify keyboard access to the run's source details, checkpoint tab and download JSON control. Use Escape to close a newly opened upload dialog; focus should return to the opener. Record any unreachable control without fixing it.
5. Through settings, use Light and Dark and reload once in each. At a 390px Chrome device viewport, capture the upload dialog and a trace; note clipped text, page overflow or inaccessible controls. Restore normal viewport afterward.

## Allowed outputs only

Write docs/ANTIGRAVITY_MANUAL_RESULTS.md with browser/version, date/time, each exact step, observed vs expected result, run IDs, any errors and screenshots. Save screenshots only under docs/screenshots/antigravity/. Distinguish skipped/blocked/failed from passed. Do not diagnose architecture, redesign, improve retrieval, modify tests or fix code. If something fails, copy the observed error, capture it, and continue independent remaining cases.

Commit ONLY that report and screenshots on portfolio/antigravity-manual; do not merge or push unless Yug explicitly asks. Return the commit ID and remaining failures to Yug/Codex. Codex reviews before integrating.
