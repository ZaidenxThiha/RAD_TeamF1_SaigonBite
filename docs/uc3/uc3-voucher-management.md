# UC3 Manage Vouchers

Author: Thin Lei Sandi (523K0075). Issue #27.

## Requirements reviewed

The team's BRS/SRS report, section 2.2.3, and FR-13–FR-15 define administrator-only
voucher creation, viewing, editing and archiving. Changes must validate code uniqueness,
discounts, dates and eligibility, retain historical references, and audit administrator/time.
The supplied UC3 prototype establishes the list, form and details views. Archive confirmation
uses a modal over the current list or details screen, as requested during implementation.

| Current status | View | Edit | Archive |
|---|---|---|---|
| Active | Yes | Yes | Yes, after confirmation |
| Expired | Yes | Yes, including extending validity | No |
| Archived | Yes | No | No |

Archived status takes precedence. Otherwise, Expired means `ends_on` is before today's
Vietnam date. The end date is inclusive. A future start date does not add a new lifecycle
status: the voucher is Active for administration, but UC1 refuses it before its start date.
New vouchers cannot already be expired. Existing non-archived vouchers can be edited;
extending an expired voucher into the current validity period makes it Active again.

Eligibility uses the shared database's **minimum order subtotal** and optional **hub**.
The form exposes these actual constraints rather than a free-text rule that checkout
cannot enforce. The prototype's example “New customers only” is not implemented: the
existing schema and UC1 do not define that condition. Confirm and implement that rule
across UC1 and UC3 before offering it as an option. Discount values are positive integer
VND for fixed discounts, or whole percentages from 1 to 100. UC1 caps the applied discount
at the remaining item subtotal, preserving its existing pricing rules.

## Run and entry point

From the repository root:

```sh
npm run init
npm test
npm start
```

Open `http://127.0.0.1:4173/vouchers`. UC1 stays at `/` and UC2 at `/kitchen`.
No package installation or database migration is needed. Existing voucher and audit
tables are reused, and reopening the database preserves records. Use `SAIGONBITE_DB`
with a separate filename for a fresh demo; do not remove the shared runtime database.

The collapsed Local demo account picker defaults to `administrator`. Selecting a
customer, kitchen or manager account demonstrates access denial. The server resolves
the account's stored role on every operation, including inside each write transaction.
`X-Demo-User` is a local identity simulator shared with UC2, not production authentication.
An authenticated server session must replace this header before external deployment.
Body `actorId` or `role` fields never grant access.

## Implementation and data access

| Layer | Repository-relative file | Responsibility |
|---|---|---|
| View | `public/uc3/vouchers.html`, `vouchers.css` | Responsive screens, internal table scroll and status badges |
| Browser controller | `public/uc3/vouchers.js` | Navigation, filters, forms, inline errors and confirmation |
| Shared shell | `public/shared/layout.js`, `layout.css` | Existing sidebar, header and open/close toggle |
| HTTP controller | `src/uc3/http.mjs` | JSON boundary, actor resolution and error responses |
| Service | `src/uc3/service.mjs` | Access, validation, lifecycle rules and save-time checks |
| Repository | `src/uc3/repository.mjs` | SQL queries, transactional changes and audit records |
| Checkout integration | `src/checkout.mjs` | Existing live eligibility/pricing reads reused without modification |

The [editable data-access sequence](uc3-voucher-sequence.mmd) shows reads, access checks,
validation, transaction rollback and voucher/audit writes. The [Figma prototype](https://www.figma.com/design/TuBvpDXqxV9uQK8TQkBaR4/UC-2---3-Protype)
is the team's visual reference; automated tests do not verify its prototype connections.

No permanent deletion is offered. Archiving sets `archived_at`; order voucher IDs and
snapshotted discount/total values remain intact. Updates affect subsequent quotes, not
previous order totals. UC1 checks the latest voucher again on submit, so a changed total
requires review and an archived voucher cannot be used from an earlier quote.

All writes use `BEGIN IMMEDIATE`, verify current administrator permission and current
voucher state, write the voucher and audit record, then commit. Failure rolls back both.
Repeated archive or edits after archive return 409. Simultaneous non-archived edits use
the last successful save; this implementation does not introduce edit versions.

## API

All routes require local demo header `X-Demo-User: administrator`.

| Method | Path | Result |
|---|---|---|
| GET | `/api/vouchers` | Voucher list, allowed actions, hubs, current actor and Vietnam date |
| GET | `/api/vouchers/:id` | Voucher details and audit history |
| POST | `/api/vouchers` | Create voucher, HTTP 201 |
| PUT | `/api/vouchers/:id` | Update non-archived voucher |
| POST | `/api/vouchers/:id/archive` | Archive Active voucher with `{ "confirmed": true }` |

Create/update body:

```json
{
  "code": "SPRINT10",
  "discountType": "percent",
  "discountValue": 10,
  "startsOn": "2026-11-28",
  "endsOn": "2027-01-31",
  "minimumSubtotal": 100000,
  "hubId": null
}
```

Choose dates valid for the current demonstration. Codes are trimmed, normalized to
uppercase, limited to 80 letters/numbers/hyphens/underscores, and unique irrespective
of case, including Archived codes. Hub IDs come from stored hubs. Unknown or missing
IDs return 404, invalid input 422, unauthorized actors 403, disallowed lifecycle changes
409, malformed JSON 400, oversized body 413 and unsupported content type 415.
Validation includes field-level messages, and error/success responses use `no-store`.

## Test scenarios for the team

1. Create SPRINT10, 10%, valid today through a future date, minimum 100,000 VND,
   all hubs. Verify details, Active status and create audit administrator/time.
2. Create `sprint10` again. Verify duplicate-code error and no additional record.
3. Try a blank code, 0 or 101 percent, a reversed date range, an invalid calendar date
   through the API, or a negative minimum. Verify correction messages and unchanged data.
4. Edit a voucher, cancel, reopen it and verify nothing changed. Save a valid change
   and verify details and a new update audit entry.
5. View the seeded EXPIRED10. Verify Edit is available and Archive disabled. Extend
   its end date beyond today and verify Active. Archived vouchers must remain view-only.
6. Click Archive from the list or details. Verify a confirmation modal opens without
   leaving the current screen. Cancel or press Escape and verify unchanged status and
   focus returns to the triggering button. Reopen the modal and confirm archive,
   then verify Archived status, read-only details and retained history. A stale edit tab
   must receive an error when it tries to save after archive.
7. Select a non-admin demo account. Verify access denial, including direct HTTP attempts
   to read, edit or archive another voucher using forged actor fields.
8. In UC1, quote two bowls at 50,000 VND each using an eligible 10% voucher. Verify
   the voucher discount is 10,000 VND. Test the minimum subtotal and wrong-hub restrictions.
9. Place an order using the voucher. Edit/archive it in UC3. Verify new UC1 attempts use
   updated rules or reject archive, while the existing receipt's total remains unchanged.
10. Search/filter the list, verify an empty result, scroll within the table, toggle the
    sidebar and use the forms at mobile width and with keyboard navigation.

Automated coverage in `test/vouchers.test.mjs` and `test/vouchers-http.test.mjs` exercises
authorization, normalization, duplicate codes, field validation, Vietnam midnight expiry,
expired extension, archive confirmation, stale state, rollback after audit failure, HTTP
errors, and UC1 integration with historical-reference retention. Record manual browser
results and selected screenshots in the team report after running these scenarios.
