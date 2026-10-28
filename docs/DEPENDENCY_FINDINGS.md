# Existing dependency findings — 26 October 2026

A locked `npm ci` and `npm audit --json` reported five package entries: Next.js critical, eslint-config-next high, eslint-plugin-react-hooks high, zod high, and zod-validation-error high. These findings predated the authorized remediation below. The raw registry report is [dependency-audit.local.json](dependency-audit.local.json). Package-entry counts include transitive reporting and are not counts of independently exploitable application paths.

The original Next.js 16.3.8 fell within these published advisory ranges:

- [Image optimization / SVG RCE](https://github.com/advisories/GHSA-2464-fhr4-w9xw): patched Next.js 16.4.1; advisory also describes sharp >=0.35.5 as a workaround for the affected upstream library. Runtime/platform applicability requires separate verification.
- [Cache-component typed-array RCE](https://github.com/advisories/GHSA-673q-mjm6-r5xr): patched Next.js 16.4.1; affected use-cache functions returning multiple typed arrays are a prerequisite. No exploitation or complete reachability assessment was performed.
- [App Router Server Actions denial of service](https://github.com/advisories/GHSA-p3m5-59mp-jv5r): registry also flags the installed Next.js version.

The registry's automatic-fix field returned false for several entries despite published patched Next.js versions. Do not run a blind audit-fix or infer that no patch exists. The owner approved controlled existing-version updates on 26 October. The remediation below resolves the reported registry findings on the integration branch; production remains unchanged.

No secrets were accessed for this audit, no exploit was run, and no production configuration was changed. The audit does not replace a security review.

## Authorized remediation

Next.js and eslint-config-next are pinned to **16.4.1**. The existing transitive Zod package is now **4.6.7**; React remains **19.2.8** and sharp remains **0.35.5**. No direct libraries were added. Only the package manifest/lockfile and this reporting documentation changed.

`npm audit --json` after the update reports **0 vulnerabilities**, compared with the original 1 critical and 4 high package entries. The post-update report is [dependency-audit-patched.json](dependency-audit-patched.json); the original report is retained for provenance.

Retesting passed: 32 frontend tests, ESLint, TypeScript and Next.js 16.4.1 production build. A browser smoke test of the local production build checks the guided failed run and successful replay comparison. Registry audit results are time-specific and do not establish the absence of vulnerabilities or replace an application security assessment. No production merge/deployment was performed.
