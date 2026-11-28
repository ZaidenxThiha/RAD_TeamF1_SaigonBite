# RAD_TeamF1_SaigonBite
RAD Final Project (SaigonBite Platform)

SaigonBite uses a shared SQLite database for customer checkout, kitchen order decisions, voucher administration, and management reports.

## Run locally

For reproducible Part 3 setup, sample data, the integrated demonstration and release
instructions, see the [deployment guide](docs/deployment.md) and
[release verification status](docs/release-verification.md).

Install Node.js 22.13 or newer. Run these commands from this directory.

```sh
npm ci
npm run init
npm test
npm start
```

### Demo screens

- **UC1 · Customer checkout.** Choose a hub, build an order, review the total, and submit it. [Open checkout](http://127.0.0.1:4173/) · [UC1 guide](docs/uc1/README.md)
- **UC2 · Kitchen decisions.** Use **Local demo account** to switch between the Bến Thành and Riverside staff. Submitted orders appear in the assigned hub’s queue. Staff can confirm or reject them, and the server checks the staff role and hub before saving. Notifications use a local simulator. [Open the kitchen queue](http://127.0.0.1:4173/kitchen) · [UC2 guide](docs/uc2/README.md)
- **UC3 · Voucher management.** Select the administrator demo account to create and manage vouchers. Active vouchers can be edited or archived, expired vouchers can be edited, and archived vouchers are view-only. Changes appear in the audit history, and checkout validates voucher eligibility. [Open voucher management](http://127.0.0.1:4173/vouchers) · [UC3 guide](docs/uc3/README.md)
- **UC4 · Management reports.** Follow the [manager sign-in setup](#manager-sign-in-for-uc4), then view sales, hub workload, and delivery performance. [Open reports](http://127.0.0.1:4173/reports) · [UC4 guide](docs/uc4/README.md)

UC2 and UC3 were implemented by Thin Lei Sandi (523K0075). Their account pickers simulate sign-in for the local demo.

### Manager sign-in for UC4

If the server is already running, stop it with Ctrl+C. From the repository root, choose a local demo password and start the server with it. Replace `your-demo-password` with the value you want to use.

**macOS or Linux**

```sh
SAIGONBITE_MANAGER_PASSWORD='your-demo-password' npm start
```

**Windows PowerShell**

```powershell
$env:SAIGONBITE_MANAGER_PASSWORD = 'your-demo-password'
npm start
```

Open the [reports page](http://127.0.0.1:4173/reports). At the browser sign-in prompt, use **`manager`** as the username and the password you set above.

### Server and sample data

The [health endpoint](http://127.0.0.1:4173/health) returns `{"status":"ok"}` when the server can read the database. Press Ctrl+C in the terminal to stop the server.

The default SQLite file is `runtime/saigonbite.sqlite`. Set `SAIGONBITE_DB` to a new file path to start with fresh sample data. Restarting with the same file preserves existing records.

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
