# October 7 Submission Verification

This is verification of a bounded student prototype, not a production certification.

## Automated checks

- Frontend: 26 tests passed, including backend-proxy URL normalization.
- Frontend lint: passed.
- Next.js production build: passed including the final proxy normalization and branded icon route.
- Backend: 65 tests and 98 subtests passed.
- Existing warnings: Node reports implicit module-type detection in test imports; Starlette reports a test-client dependency deprecation. Neither warning caused a failing check.

## Browser workflows

- TXT, MD, PDF and DOCX uploads all produced successful local word counts.
- "Number of times" phrasing produced the expected case-insensitive whole-word count.
- Cited-source navigation opened the disclosure and focused the correct source.
- Answer-step editing synchronized replacement JSON without changing other fields.
- Replay executed a suffix, reused its prefix and preserved the original exactly.
- A correct local correction succeeded; a deliberately wrong correction remained failed.
- Original/replay answers and detailed comparison exports remained available.
- Rapid duplicate submissions produced one request.
- Diagnosis failure displayed unavailable, then recovered through Try again.
- Upload-dialog focus returned to its trigger after Escape.
- Reduced-motion disabled automatic demonstration progression.
- Desktop and smaller-screen layouts, both themes and long content were checked.
- Blocked local storage did not crash settings; session-only preferences remained usable.
- Main pages had named controls, image alternatives, one primary heading and no page-level desktop overflow in the basic check. This is not a full accessibility audit.
- Footer links matched the supplied GitHub profile and LinkedIn URLs.
- API schema resolved through the same-origin proxy.

## Fresh hosted answer

One Gemini request used a newly created fictional museum policy, not a prepared catalog answer. Explicit UI consent was checked. The response correctly stated closing at 17:00 and closure on Mondays, with matching recorded quotes. The saved run is doc_7848e90b62a943a2930951cc349b1ceb.

No additional provider retries or paid fallback were used. One successful example does not establish general answer accuracy.

## Persistence and publication

Six baseline traces, including original and corrected branches, remained byte-equivalent as parsed JSON across a scoped launcher restart. Readiness and frontend serving passed.

No deployment, external hosting account or public resources were created. The owner must approve deployment. See SUBMISSION_HANDOFF.md for shared-history privacy, quota, single-worker storage and environment requirements.
