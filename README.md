# RAD_TeamF1_SaigonBite
RAD Final Project (SaigonBite Platform)

This starter contains the shared SQLite schema, reproducible sample data, and a local server health check for the four Part 3 use cases. The ordering, kitchen, voucher, and reporting screens and APIs are the next four issues.

## Run locally

Install Node.js 22.13 or newer. Run these commands from this directory.

```sh
npm run init
npm test
npm start
```

Open http://127.0.0.1:4173/health and expect `{"status":"ok"}`. Stop the server with Ctrl+C. The default database lives in `runtime/saigonbite.sqlite`. Set `SAIGONBITE_DB` to a new path to start with fresh sample data. Reopening the existing file preserves records.

## Sample records for the next issues

- Users `customer` and `tourist`, kitchen staff at Bến Thành and Riverside, `administrator`, and `manager` are database fixtures. Authentication is a later implementation task.
- Riverside has capacity for one order and starts with one submitted order. Bến Thành is available and offers the same phở bò.
- Central Saigon is 2 km from Bến Thành. Two bowls at 50,000 VND each, a 15,000 VND delivery fee, and a 10,000 VND discount using the seeded `DEMO10` code produce **105,000 VND**. Use `SPRINT10` when testing live voucher creation as part of the integrated demo.
- `EXPIRED10` provides the failure case. Two older confirmed orders have completed and failed delivery records for reports.

The [class-to-table mapping](docs/database-mapping.md) explains the shared data contract. The editable Mermaid sources are [subsystem classes](docs/subsystem-classes.mmd) and [packages](docs/subsystem-packages.mmd). They show the shared structure and planned use case components. Add your student IDs and update the diagrams against the implementation before exporting them for the report.
