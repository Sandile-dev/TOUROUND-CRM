# Review: support enquiry (commit 096460e)

Verdict: APPROVED. No blockers.

Checked against the task:
- Entry: "Support" item in the More menu Account section, `ownerOnly`. Staff are hidden by the existing filter in MoreMenuScreen. Route registered in MoreStack.
- API: `src/api/supportService.js` uses only POST /support, GET /support/my and GET /support/{id}. No admin endpoints. `toList` accepts a bare array or {content, data, enquiries, items}. `statusLabel` and `typeLabel` fall back to title case for unknown values.
- Screen: the list shows subject, type, status badge and date. It has pull to refresh, an empty state, and a load error message. There is no dummy data.
- Form: type chips (Enquiry/Complaint), subject and message validation, a loading state on Send, and a success alert after the sheet closes. Errors show inline in the sheet through `FormError`, not as an alert. I accepted this because iOS cannot stack an alert over a Modal. It is a minor deviation from "error alerts".
- Detail: shows the message and the admin response, or a "no response yet" note. It refreshes via GET /support/{id}.
- Platform safety: both sheets use bottom padding of `max(insets.bottom, 16) + 12`. The form uses KeyboardAvoidingView with `padding` on iOS only, which matches the other modals in f62c5ad.
- `scripts/live-test.js` has the support checks, and USER_GUIDE.md has a short section.

Evidence in the commit message: the Android export succeeded. live-test gave 20 passed and 2 failed. POST /support and GET /support/my returned 500 "No endpoint" on QA because the backend is not deployed there. I accept this as an environment limit that the coder disclosed. The live-test checks are written correctly. The type value ENQUIRY is a disclosed assumption.
