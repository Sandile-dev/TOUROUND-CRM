# Review: bank details (commit 623a5c8)

Verdict: APPROVED.

- Root cause stated: handleSaveSettings only showed an alert; no API call and no load. Matches the diff.
- Backend endpoint exists (GET/PUT /business/profile/payment-details). Service methods added; the screen loads on open (loadPaymentSettings) and re-populates from the server response after save. No local copy of the account number, no logging of it.
- accountType/payoutFrequency have no backend field; stored per user in AsyncStorage and the gap is flagged in the commit message.
- Validation covers required fields and digits only. Success/error go through useAlert (CustomAlert). KeyboardAwareScroll and useHeaderInsets are used.
- Evidence in commit message: live-test.js 27 passed, 0 failed (GET, PUT, re-read match, restore); expo export android succeeded. The live check was added to scripts/live-test.js and does not print account numbers.
- Unchanged callers checked: KeyboardAwareScroll forwards refreshControl; useAlert exposes showSuccess/showError.

No blockers.
