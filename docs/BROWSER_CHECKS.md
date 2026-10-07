# Browser Regression Check

The optional `scripts/browser-smoke.js` check exercises the running local website
through Playwright CLI. It is separate from `scripts/check.py` and `npm test`.
It creates three fictional original runs and six replay branches in the local
history. It never deletes existing records. Run it against a disposable local
history when you do not want extra demo records.

## Windows PowerShell

With Black Box already running, use the repository directory:

```powershell
npx.cmd --yes --package @playwright/cli playwright-cli open http://127.0.0.1:3000/runs
npx.cmd --yes --package @playwright/cli playwright-cli run-code --filename=scripts/browser-smoke.js
```

The CLI package must be available through the local npm cache or npm network
access. Its supported browser must be installed. No additional app service or
paid API is used. The check accepts only a localhost/127.0.0.1 HTTP origin.

## Coverage

- Catalog loading failure and in-place recovery without unintended submission.
- Whitespace-only question rejection and dialog keyboard focus restoration.
- Registration missing retrieval, eligibility wrong source, submission bad citation.
- Corrected replay, intentionally wrong replay, original preservation in the UI.
- Checkpoint prefix/suffix counts and selected-branch changed-step counts.
- Comparison failure without an endless spinner and same-branch retry.
- Mobile page-width check, actual trace JSON download, and selected-comparison export.
- Document-only run history and complete filter reset from an empty search.

Expected injected HTTP 503 responses may appear in the browser console. They
are negative recovery tests, not unexpected product errors. The script removes
its request interception routes in a finally block.

Backend regression tests separately compare original record bytes, validate
checkpoint/configuration/observation consistency, and check zero writes after
invalid requests. Browser navigation preservation alone is not that proof.
