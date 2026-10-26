# Bounded Static Security Review

**Date**: 26 October 2026  
**Worktree**: `portfolio/antigravity-manual`  
**Reviewed Commit (HEAD)**: `a954465d413e4f5441b63de4d0306b434602ca24`  
**Comparison Base (`origin/main`)**: `0cebba76e175d1806ca64e90118f4e2dc8522819` (`merge-base`: `0cebba76e175d1806ca64e90118f4e2dc8522819`)  
**Scope**: Read-only, evidence-based bounded static code review focusing on integration changes across document upload/parsing, run/checkpoint persistence and replay, API validation/error responses, and public-demo/privacy configuration.

---

## 1. Executive Summary & Review Scope

This bounded static security review evaluates the security posture of the changes introduced between `origin/main` (`0cebba76e175d1806ca64e90118f4e2dc8522819`) and `HEAD` (`a954465d413e4f5441b63de4d0306b434602ca24`) on branch `portfolio/antigravity-manual`.

The evaluation centers on four critical areas:
1. **Document Upload and Parsing**: File type, size, and filename handling; parser isolation and failure behavior; temporary file cleanup; partial batch handling and resistance to corrupted inputs.
2. **Run Identity and Replay Integrity**: Checkpoint and run identifier generation and collision handling; immutability and preservation of original run records; strict validation of replay overrides and cross-trace isolation.
3. **API and Browser Boundary**: Client input validation; error detail exposure across HTTP status codes; CORS and reverse-proxy assumptions; handling of untrusted client-supplied metadata.
4. **Public Demo & Privacy Configuration**: Persistence behavior, shared run histories, data retention, environment variable leakage, and third-party LLM (Google Gemini) data flow and consent mechanisms.

### Commands Run During Review
All inspection operations were strictly read-only:
- `git status; git branch; git rev-parse HEAD; git rev-parse origin/main`
- `git diff origin/main...HEAD --name-only`
- `git diff origin/main...HEAD -- backend/app/ backend/tests/ frontend/src/`
- `git merge-base origin/main HEAD`
- `git log -n 5 --oneline`
- `git diff --check`

### Limitations
- **Bounded Code Review, Not a Penetration Test**: This review relies strictly on static source code analysis and test harness inspection. No dynamic fuzzing, network penetration testing, or automated vulnerability scanners were executed against live endpoints.
- **No Live Infrastructure Testing**: Neither the Uvicorn backend nor Next.js frontend dev servers were spawned; no real network requests were dispatched to hosted APIs (`generativelanguage.googleapis.com`); no live secrets or credentials were read.
- **Deployment vs. Code**: This review assesses what the codebase proves. Actual runtime risks in production depend on the surrounding deployment environment (e.g., whether the backend is exposed directly to the public Internet or strictly proxied through Next.js rewrite rules; OS process sandbox boundaries).

---

## 2. Findings by Severity

### Finding 1: Unsanitized Filename Reflected into Response and Search Topic (Low)
- **Files & Lines**:
  - `backend/app/routes/document_import.py:31-32`
  - `frontend/src/lib/document-upload.ts:44-45`
- **Preconditions**: An attacker or demo user uploads a document with path traversal sequences, control characters, or HTML tags in the `filename` query parameter (e.g., `filename=../../etc/passwd.pdf` or `filename=<script>.pdf`).
- **Realistic Impact**:
  - `document_import.py` validates that `len(filename) <= 200` and `Path(filename).suffix.lower() in (".pdf", ".docx")`, but does not sanitize the filename via `Path(filename).name` or strip directory separators.
  - While the file content is read into memory and not saved to disk using the filename (thus avoiding path traversal file write), the raw string is assigned directly to `title=filename` and interpolated into `topic=f"{Path(filename).stem} {text}"[:200]`.
  - In `frontend/src/lib/document-upload.ts:44-45`, client-side fallback parsing similarly incorporates raw filenames into document topics.
  - When displayed in the UI, React safely escapes JSX text, preventing stored XSS; however, if downstream loggers, exports, or third-party integrations consume `title` or `topic` without sanitization, directory traversal syntax or control characters could cause log injection or display spoofing.
- **Remediation Direction**: Sanitize `filename` in `document_import.py` using `Path(filename).name.strip()` or standard secure filename utilities, and strip non-printable or path-separating characters before populating `title` and `topic`.

### Finding 2: Denial of Service Risk via Process Slot Contention on Sequential Semaphore (Low)
- **Files & Lines**:
  - `backend/app/services/document_import.py:14, 80-86`
- **Preconditions**: Multiple concurrent users or requests submit document extraction tasks (`/document-import`) simultaneously.
- **Realistic Impact**:
  - `backend/app/services/document_import.py` enforces extraction isolation with a strict non-blocking bounded semaphore: `PARSERS = threading.BoundedSemaphore(1)`.
  - When `not PARSERS.acquire(blocking=False)`, the route immediately raises `BlockingIOError("Another document is being extracted. Please try again.")`, which returns HTTP 503 (`Retry-After: 1`).
  - Because each extraction runs in a subprocess with a timeout of 15 seconds (`subprocess.run(..., timeout=15)`), a single long-running PDF extraction can block all other users from uploading documents for up to 15 seconds. In a multi-user public demo, repeated or intentionally heavy uploads can easily cause sustained denial of service for document parsing.
- **Remediation Direction**: Increase the worker pool concurrency limit (e.g., 2–4 workers depending on CPU capacity), queue requests with a short bounded wait time rather than immediately failing with non-blocking rejection, or process document parsing asynchronously with rate limiting per client IP.

### Finding 3: Windows Registry Lookup for API Key Fallback in Web Backend (Informational)
- **Files & Lines**:
  - `backend/app/services/gemini.py:26-38`
- **Preconditions**: Backend application runs on Windows (`os.name == "nt"`) without `GEMINI_API_KEY` defined in the process environment.
- **Realistic Impact**:
  - `backend/app/services/gemini.py` attempts to read `HKCU\Environment\GEMINI_API_KEY` via `winreg`.
  - While convenient for local Windows developer workflows, querying user registry hives from a server process can inadvertently elevate or leak host user environment configurations into a web service context if deployed on a multi-user Windows host.
  - The key itself is held strictly in memory and sent via HTTP headers (`x-goog-api-key`); it is never logged or returned in error payloads.
- **Remediation Direction**: In production deployment documentation, recommend passing secrets exclusively via standard container/process environment variables or secret managers, deprecating Windows user registry fallbacks in production configurations.

### Finding 4: In-Memory JSON State Concurrency Restricted to Single Worker (Informational)
- **Files & Lines**:
  - `backend/app/services/store.py:1, 31, 63-80, 95-105`
- **Preconditions**: Deploying the backend across multiple Uvicorn worker processes (`--workers > 1`) or multiple container instances.
- **Realistic Impact**:
  - `RunStore` uses a Python threading lock (`threading.RLock()`) and atomic file replacement (`os.replace`) targeting a single `state.json` file.
  - While atomic replacement and `RLock` protect against partial writes and intra-process race conditions within a single process, `RLock` does not coordinate file locks across separate operating system processes. Running multiple Uvicorn workers would cause race conditions and lost updates between workers.
  - As explicitly noted in the module docstring (`"Atomic local persistence, synchronized for a single Uvicorn worker"`), this is by design for the local student demo.
- **Remediation Direction**: Keep the deployment pinned to a single worker process as documented, or migrate to SQLite / PostgreSQL if scaling beyond a single worker demo.

---

## 3. Area-by-Area Review Findings

### 1. Document Upload and Parsing
- **File Type & Suffix Validation**:
  - `backend/app/routes/document_import.py:15-17` strictly restricts uploaded binary documents to `.pdf` and `.docx` (`suffix not in (".pdf", ".docx")`). Filename length is capped at 200 characters. Legacy `.doc` is explicitly rejected.
  - `frontend/src/lib/document-upload.ts:7-11` validates `.txt`, `.md`, `.pdf`, and `.docx` before sending requests.
- **Size Limits & Memory Safety**:
  - Streaming uploads in `document_import.py:18-22` enforce a hard cap of 2 MB (`MAX_BYTES = 2_000_000`). If exceeded, it terminates immediately with HTTP 413 without reading the remainder into memory.
  - Plaintext uploads (.txt, .md) handled in browser (`document-upload.ts:9, 42`) are capped at 40 KB and 10,000 characters. Control characters are rejected (`document-upload.ts:43`).
- **Parser Isolation & Subprocess Sandbox**:
  - `backend/app/services/document_import.py:84-86` executes extraction in an isolated subprocess (`subprocess.run([sys.executable, "-B", "-m", "backend.app.services.document_import", suffix], input=data, timeout=15)`).
  - The parser subprocess runs with strict limits:
    - **PDF**: `pypdf` configuration (`apply_configuration`) restricts stream lengths, output lengths, buffer sizes, page tree entries (max 256), depth (max 32), and xform invocations. Encrypted PDFs are rejected (line 33). Page count is capped at 20 (line 35). Total extracted text is strictly capped at 10,000 characters (line 45).
    - **DOCX**: Analyzed using `defusedxml.ElementTree` to prevent XML Entity Expansion (Billion Laughs / XXE) attacks. ZIP entries are bounded to 1,000 items and 10 MB total uncompressed size (line 54). Macro files (`word/vbaProject.bin`) are rejected (line 60). Content is bounded to 10,000 characters.
- **Temporary Files & State Corruption**:
  - Upload parsing uses purely in-memory buffers (`io.BytesIO`) and pipes over standard input (`input=data`). No temporary files are written to disk during document import.
  - Documents imported via `/document-import` are not saved directly into `RunStore`; they are returned as transient `Document` objects to the client. Persistence only occurs if and when a user submits a run via `POST /document-runs`.
- **Verdict**: *No high or critical issues found. The parser isolation, XML defusing, and size bounding are robustly designed.* (Low-severity findings noted in Section 2).

### 2. Run Identity and Replay Integrity
- **Identifier Collision Handling**:
  - `backend/app/services/documents.py:162` assigns cryptographic UUIDs to runs (`doc_{uuid4().hex}`).
  - `backend/app/services/workflow.py:79` assigns `run_{uuid4().hex}`.
  - `backend/app/services/store.py:98-102` explicitly verifies before persistence:
    ```python
    if identifier in state["runs"]:
        raise StorageError("Run identifier already exists")
    if state["checkpoints"].keys() & checkpoints.keys():
        raise StorageError("Checkpoint identifier already exists")
    ```
- **Preservation of Original Records**:
  - Replays never mutate the original record. In `backend/app/routes/documents.py:134-140` and `backend/app/routes/runs.py:100-109`, replaying generates a brand new run record with its own run ID and checkpoint IDs.
  - The original run ID is referenced as `parentRunId`, and the original record remains completely untouched in the store (verified by `backend/tests/test_robustness.py:56, 86, 246` and `backend/tests/test_documents.py:99`).
- **Validation of Replay Inputs & Overrides**:
  - Replay overrides are strictly type- and schema-validated before execution:
    - In `backend/app/services/documents.py:139-155` (`validate_output`), step 0 requires valid `documentIds` matching existing document keys; step 1 requires `documentId` present in retrieval candidates; step 2 requires valid `answer` (non-empty string <= 10,000 chars) and `citation` matching a known document. Step 4 (validator) cannot be overridden (`documents.py:111`).
    - In `backend/app/services/workflow.py:15-36` (`validate_override`), integer bounds (`abs(value) <= 10_000_000`) and structure are enforced.
  - Checkpoint state consistency is verified prior to replay (`backend/app/routes/documents.py:122-132` and `backend/app/routes/runs.py:10-21, 97-98`). Any mismatch between prefix history, saved state, workflow version, or configuration triggers an immediate HTTP 409 Conflict.
- **Replay Cross-Execution Isolation**:
  - Replays reuse existing prefix snapshots without re-executing previous steps. The execution environment does not invoke external shell commands or untrusted dynamic code.
- **Verdict**: *No issue found in this bounded static review.*

### 3. API and Browser Boundary
- **Input Validation**:
  - FastAPI endpoints use Pydantic models with strict schemas:
    - `DocumentRequest` (`backend/app/services/documents.py:40-56`): `question` min 1, max 1000 chars; `documents` min 1, max 30 items; `extra="forbid"`; uniqueness validator on `documentId`.
    - `ExecuteRequest` (`backend/app/schemas.py:52-56`): integers strictly bounded between `-1,000,000` and `1,000,000`; `extra="forbid"`.
    - `ReplayRequest` (`backend/app/schemas.py:65-70`): `checkpointStep` 1 to 4; `extra="forbid"`.
- **Error Detail Exposure**:
  - `backend/app/main.py:29-31` catches `StorageError` and returns generic HTTP 503 `{"detail": str(error)}` without stack traces.
  - In `backend/app/services/gemini.py:79-89`, provider HTTP errors and timeouts are translated to predefined error codes (`QUOTA_EXCEEDED`, `AUTH_FAILED`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `INVALID_RESPONSE`) with sanitized messages. Internal exception details and traceback chains are explicitly suppressed (`raise ProviderError(...) from None`).
  - In `frontend/src/lib/api.ts:68-87`, HTTP errors from backend are parsed safely; server 500 errors display a friendly user notification rather than raw system internals.
- **CORS & Proxy Assumptions**:
  - `backend/app/main.py:19-21` configures CORS middleware with `allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"]`.
  - In Next.js (`frontend/next.config.ts:5-8`), browser traffic is proxied through `/api/blackbox/:path*` to `BACKEND_URL` (`http://127.0.0.1:8000` default), so external browser clients do not directly interact with the backend port in production deployments.
- **Trust Placed in Client-Supplied Identifiers**:
  - When diagnosing a run (`POST /diagnose` or `POST /document-runs/{run_id}/diagnose`), the server retrieves the verified recorded trace from the server's authoritative `RunStore` (`backend/app/routes/runs.py:24-42` and `backend/app/routes/documents.py:14-56`). Client modifications to run body parameters are ignored (`backend/tests/test_robustness.py:212-219`).
- **Verdict**: *No issue found in this bounded static review.*

### 4. Public Demo & Privacy Configuration
- **Persistence & Shared History**:
  - Runs and checkpoints are persisted to local JSON files (`state.json`) inside the backend data directory (`backend/app/services/store.py:29`).
  - In a public demo environment where multiple anonymous users access the same instance, all runs stored in `state.json` are returned by `GET /runs` and `GET /document-runs`. Any user who uploads a custom document with sensitive text will have that document stored in `state.json` and visible to any other demo visitor via `/document-runs/{run_id}/sources` or `/document-runs/{run_id}`.
  - The UI explicitly warns the user of this limitation in `frontend/src/components/workspace/new-run-dialog.tsx:96`: *"Answers use the first current document. Google processes its text; free-tier data may be used to improve Google products. Use non-sensitive documents."*
- **Retention & Ephemeral Scope**:
  - There is no automated TTL or background retention cleanup worker for `state.json`. Run records persist until the local file is manually reset or deleted.
- **Third-Party Provider Calls & User Consent**:
  - `backend/app/services/documents.py:51-52` enforces that `answeringMode == "gemini"` requires `allowExternalProcessing: True`:
    ```python
    if self.answeringMode == "gemini" and not self.allowExternalProcessing:
        raise ValueError("Explicit consent is required to send document text to Google")
    ```
  - The UI forces explicit user interaction with a mandatory checkbox (`new-run-dialog.tsx:97`): *"I consent to sending the selected document and question to Google."*
  - In `backend/app/services/gemini.py:55-57`, external calls are made directly to `generativelanguage.googleapis.com` via standard HTTPS with `temperature: 0` and strict output JSON schemas. No paid fallback or unprompted secondary calls are made.
- **Credential & Secret Protection**:
  - `backend/app/services/gemini.py:57` transmits the API key via standard HTTPS request headers (`x-goog-api-key`).
  - No credentials, tokens, or `.env` files are tracked in the repository (`.gitignore` protects `.env*`).
- **Verdict**: *Confirmed that external provider calls require explicit opt-in consent and that credentials are not leaked. Public-demo multi-tenant data sharing is bounded by the demo scope and clearly documented.*

---

## 4. Summary Matrix of Findings

| ID | Title | Component | Severity | Realistic Impact | Remediation Direction |
|---|---|---|---|---|---|
| **SEC-01** | Unsanitized Filename Reflected into Response and Search Topic | `backend/app/routes/document_import.py:31-32`, `frontend/src/lib/document-upload.ts:44-45` | **Low** | Malicious filenames with directory traversal sequences or special characters populate `title` and `topic`, presenting log injection or display spoofing risks. | Sanitize input filenames with `Path(filename).name.strip()` and strip path separators. |
| **SEC-02** | Process Slot Contention on Sequential Extraction Semaphore | `backend/app/services/document_import.py:14, 80-86` | **Low** | A single concurrent upload blocks the non-blocking semaphore, returning HTTP 503 to concurrent users and risking demo DoS. | Use a bounded worker pool or short queued wait times with rate-limiting. |
| **SEC-03** | Windows Registry Query for Fallback API Key | `backend/app/services/gemini.py:26-38` | **Informational** | Reading `HKCU\Environment` introduces host user state dependency in server environments. | Standardize secret injection via container/process environment variables only. |
| **SEC-04** | Single-Worker File-Locking Scope | `backend/app/services/store.py:31, 63-80` | **Informational** | Multi-worker deployments would encounter race conditions in `state.json` atomic replacement. | Retain single-worker constraint as documented, or migrate to a transactional database. |

---

## 5. Conclusion & Verification

This bounded static review confirms that the integration changes between `origin/main` and `HEAD` maintain high standards of defensiveness:
- File uploads are strictly isolated in a separate, time-limited, memory-bounded subprocess with safe XML and PDF parsing configurations.
- Run persistence uses atomic replace operations with explicit collision rejection for both runs and checkpoints.
- Replays operate on immutable original records and enforce strict schema validation for all replacement actions.
- External calls to Google Gemini require explicit, non-bypassable opt-in consent from the user and avoid leaking provider or credential details.
- Identified findings are limited to low-severity filename sanitization and concurrency availability bounds, appropriate for a bounded student demo project.

The review is completed with zero application code mutations and full fidelity to repository constraints.
