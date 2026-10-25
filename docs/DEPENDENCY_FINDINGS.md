# Existing dependency findings — 26 October 2026

A locked `npm ci` and `npm audit --json` reported five package entries: Next.js critical, eslint-config-next high, eslint-plugin-react-hooks high, zod high, and zod-validation-error high. These findings predate this change; no dependency manifests or versions were modified. The raw registry report is [dependency-audit.local.json](dependency-audit.local.json). Package-entry counts include transitive reporting and are not counts of independently exploitable application paths.

Next.js 16.3.8 falls within these published advisory ranges:

- [Image optimization / SVG RCE](https://github.com/advisories/GHSA-2464-fhr4-w9xw): patched Next.js 16.4.1; advisory also describes sharp >=0.35.5 as a workaround for the affected upstream library. Runtime/platform applicability requires separate verification.
- [Cache-component typed-array RCE](https://github.com/advisories/GHSA-673q-mjm6-r5xr): patched Next.js 16.4.1; affected use-cache functions returning multiple typed arrays are a prerequisite. No exploitation or complete reachability assessment was performed.
- [App Router Server Actions denial of service](https://github.com/advisories/GHSA-p3m5-59mp-jv5r): registry also flags the installed Next.js version.

The registry's automatic-fix field returned false for several entries despite published patched Next.js versions. Do not run a blind audit-fix or infer that no patch exists. A controlled existing-version update with compatibility checks is pending owner approval, because this task restricts dependency changes. No production merge/deployment should be approved until this is resolved or explicitly assessed by the owner.

No secrets were accessed for this audit, no exploit was run, and no production configuration was changed. The audit does not replace a security review.
