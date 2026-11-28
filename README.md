# RAD_TeamF1_SaigonBite
RAD Final Project (SaigonBite Platform)

SaigonBite uses a shared SQLite database for customer checkout, kitchen order decisions, voucher administration, and management reports.

## Run locally

Install Node.js 22.13 or newer. Run these commands from this directory.

```sh
npm run init
npm test
npm start
```

Open http://127.0.0.1:4173/ to try [UC1 checkout](docs/uc1/README.md). At http://127.0.0.1:4173/health expect `{"status":"ok"}`. Stop the server with Ctrl+C. The default database lives in `runtime/saigonbite.sqlite`. Set `SAIGONBITE_DB` to a new path to start with fresh sample data. Reopening the existing file preserves records.

Open http://127.0.0.1:4173/kitchen for [UC2 kitchen decisions](docs/uc2/uc2-kitchen-decisions.md)
(author: 523K0075). Expand **Local demo account** to switch between the two seeded kitchen
staff. UC1-created Submitted orders appear in their assigned hub's queue. Kitchen API
authorization rechecks the stored actor role and hub; account selection is a local demo,
not production sign-in. Notifications are simulated and do not send external messages.

Open http://127.0.0.1:4173/vouchers for [UC3 voucher management](docs/uc3/uc3-voucher-management.md)
(author: 523K0075). The administrator can create, view, edit and archive vouchers, with
validation, audit history and eligibility rules shared with checkout. Active vouchers
can be edited/archived, Expired vouchers can be edited, and Archived vouchers are view-only.
The local demo account picker follows UC2's identity simulation.

For [UC4 management reports](docs/uc4/README.md), set `SAIGONBITE_MANAGER_PASSWORD` before starting the server, then open `/reports` and sign in as `manager`.

## Run the UC1–UC4 integration test

Run this command from the repository root to test voucher creation, checkout, kitchen confirmation, and sales reporting against one fresh SQLite database.

```sh
node --test test/use-case-integration.test.mjs
```

The test starts and stops its own local server. It verifies that the order reference and 105,000 VND total match across checkout, the kitchen queue, and the sales report. See the [integration test results](docs/integration-test-results.md) for the failure cases and Chrome retests.

## Sample records

- Users `customer` and `tourist`, kitchen staff at Bến Thành and Riverside, `administrator`, and `manager` are database fixtures. The reports preview requires the configured manager password.
- Riverside has capacity for one order and starts with one submitted order. Bến Thành is available and offers the same phở bò.
- Central Saigon is 2 km from Bến Thành. Two bowls at 50,000 VND each, a 15,000 VND delivery fee, and a 10,000 VND discount using the seeded `DEMO10` code produce **105,000 VND**. Use `SPRINT10` when testing live voucher creation as part of the integrated demo.
- `EXPIRED10` provides the failure case. Two older confirmed orders have completed and failed delivery records for reports.

The [class-to-table mapping](docs/database-mapping.md) explains the shared data contract. The editable Mermaid sources are [subsystem classes](docs/subsystem-classes.mmd) and [packages](docs/subsystem-packages.mmd). They show the shared structure and planned use case components. Add your student IDs and update the diagrams against the implementation before exporting them for the report.
