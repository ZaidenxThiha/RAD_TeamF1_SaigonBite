# UC2 — Confirm or Reject an Incoming Order

Author: Thin Lei Sandi (523K0075). Issue #26.

## Design evidence

Author: Thin Lei Sandi (523K0075).

The images below document the UI design and prototype scenarios. Prototype exports
contain sample data and are not screenshots proving that the implemented application
passed a test. Record actual test results separately using the demonstration scenarios below.

[Open the shared UC2 and UC3 Figma prototype](https://www.figma.com/design/TuBvpDXqxV9uQK8TQkBaR4/UC-2---3-Protype).

### Sketches and wireframe

- [UC2-Wireframe](wireframes/UC2-Wireframe.png)
- [UC2 sketch page1](wireframes/UC2_sketch_page1.png)
- [UC2 sketch page2](wireframes/UC2_sketch_page2.png)

### Prototype screens

- [UC2 01 — Incoming Orders — Submitted](prototype/UC2%2001%20%E2%80%94%20Incoming%20Orders%20%E2%80%94%20Submitted.png)
- [UC2 02 — SB-1042 — Review](prototype/UC2%2002%20%E2%80%94%20SB-1042%20%E2%80%94%20Review.png)
- [UC2 03 — SB-1042 — Reject — Empty Reason](prototype/UC2%2003%20%E2%80%94%20SB-1042%20%E2%80%94%20Reject%20%E2%80%94%20Empty%20Reason.png)
- [UC2 04 — SB-1042 — Reject — Required Reason Error](prototype/UC2%2004%20%E2%80%94%20SB-1042%20%E2%80%94%20Reject%20%E2%80%94%20Required%20Reason%20Error.png)
- [UC2 05 — SB-1042 — Reject — Reason Entered](prototype/UC2%2005%20%E2%80%94%20SB-1042%20%E2%80%94%20Reject%20%E2%80%94%20Reason%20Entered.png)
- [UC2 06 — SB-1042 — Confirmed](prototype/UC2%2006%20%E2%80%94%20SB-1042%20%E2%80%94%20Confirmed.png)
- [UC2 07 — SB-1042 — Rejected](prototype/UC2%2007%20%E2%80%94%20SB-1042%20%E2%80%94%20Rejected.png)
- [UC2 08 — Incoming Orders — Empty](prototype/UC2%2008%20%E2%80%94%20Incoming%20Orders%20%E2%80%94%20Empty.png)
- [UC2 09 — Access Denied](prototype/UC2%2009%20%E2%80%94%20Access%20Denied.png)
- [UC2 10 — SB-1043 — Order Unavailable — Before Decision](prototype/UC2%2010%20%E2%80%94%20SB-1043%20%E2%80%94%20Order%20Unavailable%20%E2%80%94%20Before%20Decision.png)
- [UC2 11 — Incoming Orders — SB-1042 Only — Refreshed](prototype/UC2%2011%20%E2%80%94%20Incoming%20Orders%20%E2%80%94%20SB-1042%20Only%20%E2%80%94%20Refreshed.png)
- [UC2 12 — Incoming Orders — SB-1043 Only — After Decision](prototype/UC2%2012%20%E2%80%94%20Incoming%20Orders%20%E2%80%94%20SB-1043%20Only%20%E2%80%94%20After%20Decision.png)
- [UC2 13 — SB-1043 — Order Unavailable — After Decision](prototype/UC2%2013%20%E2%80%94%20SB-1043%20%E2%80%94%20Order%20Unavailable%20%E2%80%94%20After%20Decision.png)

The implemented kitchen now formats order references as `SB-000004`. The prototype
exports retain the original sample references such as `SB-1042`.


## Run

Use the existing Node.js/SQLite app:

```sh
npm run init
npm test
npm start
```

Open `http://127.0.0.1:4173/kitchen`. The checkout remains at `/`.
The shared database is preserved on restart. Order IDs, prices and hub names come from
SQLite; the implementation does not hardcode the Figma sample SB-1042 or its total.

Expand **Local demo account** to select Bến Thành or Riverside staff. The server resolves
the selected username to the stored kitchen role and hub for each request. This is a
loopback demonstration of actor context, consistent with UC1's account picker; it is
not production authentication. Before exposing the app beyond the local demo, replace
`X-Demo-User` with an authenticated server session. Client-supplied staff IDs and hub IDs
never authorize a decision.

## Implementation mapping

| Layer | File | Responsibility |
|---|---|---|
| View | `public/uc2/kitchen.html`, `kitchen.css` | Shared-theme shell, responsive queue, review, rejection and result layouts |
| Browser controller | `public/uc2/kitchen.js` | Requests, real reason input, loading states, refreshed queue and errors |
| Shared UI shell | `public/shared/layout.js`, `layout.css` | Reusable sidebar/header with configurable navigation and actor details |
| HTTP controller | `src/uc2/http.mjs` | JSON boundary, demo actor context and HTTP error mapping |
| Service | `src/uc2/service.mjs` | Assigned-hub authorization, save-time status checks, decision validation and notification attempt |
| Repository | `src/uc2/repository.mjs` | SQL reads and transactional status/decision/notification persistence |

No database migration is needed. Existing `orders`, `order_items`, `payments`,
`order_decisions`, `users`, `hubs` and `customer_notifications` tables are reused.
The [editable sequence diagram](diagrams/uc2-kitchen-sequence.mmd) shows the data-access flow.

The kitchen page mounts the shared shell with `renderWorkspaceLayout(...)`. The
UC3 page also loads `/shared/layout.css` and imports `/shared/layout.js`, with its own
workspace label, breadcrumbs, navigation and actor context. Only implemented destinations
are shown in navigation; the shell does not add placeholder Overview or Settings pages.

## API

All routes require `X-Demo-User: kitchen-ben-thanh` or `kitchen-riverside`.

| Method | Route | Result |
|---|---|---|
| GET | `/api/kitchen/orders` | Actor/hub and Submitted queue, oldest first |
| GET | `/api/kitchen/orders/:id` | Same-hub Submitted order and item/payment snapshots |
| POST | `/api/kitchen/orders/:id/decision` | `{ "decision": "Confirmed" }` or `{ "decision": "Rejected", "reason": "Out of ingredients" }` |

Customer status integration: `POST /api/checkout/status` accepts the original checkout's
`username`, `checkoutRef`, and `orderId`. The lookup requires both the stored order owner
and matching payment checkout reference. A different owner, reference or missing order
returns the same 404 response. This uses UC1's existing demo identity convention; the
customer username must come from an authenticated session in a production deployment.
The customer receipt's **Refresh status** button reads the latest saved status and displays
the rejection reason when present. It does not resubmit checkout or create another payment.

Errors: 400 malformed input/invalid ID; 403 unauthorized role or wrong hub; 404 missing
order/route; 409 order no longer Submitted; 422 invalid decision or blank/oversized reason;
413 body too large; 415 unsupported content type; 500 unexpected storage failure.
Decision and status are saved together in a `BEGIN IMMEDIATE` transaction. Notification
delivery is attempted only after commit. Repeating a decision returns 409 rather than
creating another audit or notification. It does not modify payments or delete history.

Notification delivery is a local simulator: the default records `sent` without sending
external messages. Set `SAIGONBITE_NOTIFICATION_FAIL=1` before starting to simulate failure.
The decision remains saved and the failed notification is retained for follow-up.
Automatic retry policy is not implemented because the report leaves it unconfirmed.

## Demonstration and manual checks

1. On a fresh database, Bến Thành has no Submitted orders. Verify the empty state.
2. Select Riverside; the seeded Submitted order appears. Review and check its items,
   address, payment method, totals and hub. Back returns to the queue without saving.
3. Choose Reject, submit a blank or whitespace-only reason, and verify inline validation.
   Cancel returns to current order details without recording a decision.
4. Enter a reason and submit. Verify Rejected, staff ID, timestamp and reason. Return to
   the queue; that order is absent. Refreshing/restarting preserves the decision.
5. At `/`, submit a new UC1 order to Bến Thành. At `/kitchen`, select Bến Thành and
   refresh. The same ID, total, quantity and payment choice appear. Confirm it and verify
   the result and queue removal. The item/payment records remain intact.
   Keep the customer receipt open in a second tab and click **Refresh status**: the same
   order must now show Confirmed. Repeat using a new order and a rejection; its receipt
   must show Rejected and the saved reason. A failed refresh preserves the prior receipt
   and allows retry. **Start another order** clears the previous receipt lookup context.
6. **Order unavailable:** create another order in UC1. Open its review in two browser
   tabs using the same hub. Confirm in tab A, then Confirm or submit a rejection in tab B.
   Tab B must show Order unavailable; Refresh queue removes the handled order. This is a
   real stale-order scenario, not a deliberately broken Review link.
7. **Denied access:** an HTTP request using the other kitchen username for that order
   must return 403. Customer/admin identities cannot access the kitchen API.
8. Optional notification-failure check: restart with the failure environment variable,
   decide a new order, and verify that the result still shows the saved decision plus
   the failure message. Reset the variable after the demonstration.
9. At mobile width, the cards stack and tables scroll within their cards; the full page
   should not require horizontal scrolling. Check keyboard focus, textarea validation,
   disabled controls during requests, Cancel, Back and Refresh.

Do not add fabricated second orders to production data. Use UC1 checkout to create
the orders required for a demonstration. Reading details and cancelling never save a decision.

## Test evidence

`npm test` includes the existing eight database/UC1 checks plus 12 UC2 checks in
`test/kitchen.test.mjs` and `test/kitchen-http.test.mjs`, and three customer-status
integration checks in `test/customer-order-status.test.mjs` (23 total).
They cover hub-scoped queues, role/hub denial, confirmation/history, rejection validation,
save-time reassignment, stale views, audit rollback, notification failure, missing IDs,
UC1 integration and malformed/oversized HTTP requests. HTTP checks require loopback access.
Record the actual manual browser results in the team test report; automated service/HTTP
checks do not prove visual browser behavior.
