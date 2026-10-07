# Black Box Submission Handoff

Owner: Yug Shah. This is an independent student project, not a Bitwin team submission.

## Product scope

Black Box records a bounded document-answering workflow, exposes the answer and its source evidence, flags failed recorded checks, and supports checkpoint replay into a separate branch. It is not a general-purpose debugger or an automatic repair system.

## Demonstration sequence

1. Open the homepage and enter the workspace.
2. Upload a non-sensitive TXT, MD, PDF or DOCX.
3. Ask a quoted single-word frequency question using local mode, or use Gemini with explicit consent for broader questions.
4. Inspect the recorded answer, citation, passages and execution stages.
5. Open a failed fictional execution. Inspect the flagged stage, replay a supported correction, then compare the original and replay answers.
6. Download the answer or execution report.

Failure simulation is optional and deliberately injected; do not present it as an organically observed model failure. Passed evidence checks do not prove every claim is factually correct. Local mode returns source text for questions outside supported word-count requests; it is not a general local language model.

## Verified gates

The October 7 verification passed frontend lint, production build and 26 frontend tests. All four upload formats were exercised through the browser using local word counting. The new trace layout, failed-stage finding and plain-language replay comparison were inspected. One fresh consented Gemini answer from a new fictional document succeeded. Prior checks verified immutable originals and persistence across a scoped restart. See FINAL_VERIFICATION.md for the detailed record and limitations.

## Deployment boundaries

Deployment is NOT authorized yet. Wait for the owner's approval before publishing, provisioning services or changing external resources.

The app currently has no user authentication or per-user storage isolation. Run history and uploaded source text are shared within the backend instance. A public deployment must therefore be presented as a non-sensitive demonstration, not a private document service. Do not upload personal or confidential data. Public execution can consume the configured Gemini quota; the free tier does not remove abuse risk.

The frontend needs a server supporting Next.js; this is not a static-only export. Its rewrite uses BACKEND_URL, defaulting to the local backend. A hosted frontend must have the hosted backend URL configured before building. The backend must include the model artifact, measured metrics and document benchmark files used by readiness checks. Its file-based storage needs persistence if runs must survive a host restart or redeployment. Run one backend worker: the current store synchronizes within one process, not across workers. Do not assume a free host provides persistent disks.

Keep GEMINI_API_KEY only in the backend host's secret environment. Never place it in NEXT_PUBLIC variables, source code, screenshots or the repository. The local Windows registry fallback does not configure a hosted backend.

The workspace's API-schema shortcuts use the same-origin /api/blackbox/openapi.json proxy rather than a visitor's localhost. No hosted provider, pricing plan or deployment URL has been selected or verified.

## Owner links

- GitHub profile: https://github.com/Yug-Shah17
- LinkedIn: https://www.linkedin.com/in/yug-shah-lnkdn/

The GitHub profile is not a project repository URL. Obtain the actual repository URL for submission rather than inventing one.
