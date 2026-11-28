# Part 3 deployment and release guide

Owner: Thin Lei Sandi (523K0075).

This guide runs UC1–UC4 together on a local computer using reproducible sample data.
The proposed release name is **Part 3 — v0.3.0-part3**. The tag must be created only
after the final revision passes the clean-checkout verification below.

## Prerequisites

- Git, Node.js 22.13 or newer, and npm. Node.js 24.21.0 / npm 11.19.0 were available
  on the Windows preparation machine; the final clean-checkout outcome is recorded separately.
- A current browser and an available loopback port, normally 4173.
- Network access for cloning and `npm ci`. Chromium installation is needed only for
  the optional browser test. The application uses built-in Node.js HTTP and SQLite.

## Obtain the released source

After the tag is published, use a new directory:

```sh
git clone --branch v0.3.0-part3 --depth 1 https://github.com/ZaidenxThiha/RAD_TeamF1_SaigonBite.git SaigonBite-Part3
cd SaigonBite-Part3
git rev-parse HEAD
node --version
npm --version
npm ci
```

Compare the printed commit with the verified full SHA in the release notes. Before
publication, a teammate must instead clone the repository and check out the exact
candidate SHA supplied by the author; do not verify a moving branch and tag a different revision.
GitHub's automatically generated source ZIP is an alternative: extract it and run the
same npm commands from the directory containing `package.json`. Git commands require a clone.

## Initialize a fresh demonstration database

Use a new filename so existing orders are preserved. The following variable values must
be set in the same terminal used to run initialization and startup.

Windows PowerShell:

```powershell
$env:SAIGONBITE_DB = 'runtime/part3-demo.sqlite'
$env:SAIGONBITE_MANAGER_PASSWORD = 'choose-a-local-demo-password'
$env:SAIGONBITE_NOTIFICATION_FAIL = '0'
$env:PORT = '4173'
npm run init
npm test
npm start
```

macOS / Linux:

```sh
export SAIGONBITE_DB='runtime/part3-demo.sqlite'
export SAIGONBITE_MANAGER_PASSWORD='choose-a-local-demo-password'
export SAIGONBITE_NOTIFICATION_FAIL='0'
export PORT='4173'
npm run init
npm test
npm start
```

Replace the password example with your own local value. It is not committed or supplied
as a release credential. Startup reads it from the environment. Reports require username
`manager` and that password at the browser's HTTP Basic sign-in prompt.

Initialization creates the schema and seeds an empty database once; running it again
does not reset the database. To rehearse from scratch, stop the server with Ctrl+C and
choose another unused database filename. Tests create their own disposable databases.
No external SQLite server or manual import is necessary. A Node SQLite experimental
warning on some supported Node releases does not by itself indicate initialization failed.

## Open and check the application

| Address | Expected result |
|---|---|
| `http://127.0.0.1:4173/health` | HTTP 200 and `{"status":"ok"}` |
| `http://127.0.0.1:4173/` | UC1 customer checkout |
| `http://127.0.0.1:4173/kitchen` | UC2 assigned-hub queue |
| `http://127.0.0.1:4173/vouchers` | UC3 voucher management |
| `http://127.0.0.1:4173/reports` | UC4 reports after manager sign-in |

The server listens on `127.0.0.1`, not the public network. Keep the terminal open while
using it. Stop it with Ctrl+C and wait for shutdown before copying its SQLite file.
If port 4173 is occupied, stop the previous instance or set `PORT` to another available
number and use the matching URL. If reports say the password is unconfigured, stop the
server, set the variable in its terminal and restart. If npm cannot find `package.json`,
change into the extracted/cloned repository directory.

## Sample accounts and data

| Local actor | Username | Purpose |
|---|---|---|
| Customer | `customer`, `tourist` | Checkout demo selections |
| Kitchen | `kitchen-ben-thanh`, `kitchen-riverside` | Hub-scoped local account picker |
| Administrator | `administrator` | Voucher local account picker |
| Manager | `manager` | Reports sign-in with configured demo password |

`db/schema.sql` and `db/seed.sql` are the authoritative release sample data. Bến Thành
starts with capacity 6. Riverside has capacity 1 and a Submitted sample order, deliberately
demonstrating a full hub. Previously changed capacities in a developer's local database
are not part of the release. Two older Confirmed orders provide completed/failed delivery
records. `DEMO10` is a currently valid 10% voucher with a 100,000 VND minimum;
`EXPIRED10` is expired. Seed dates are calculated when the fresh database is initialized.

## Reproduce the integrated demonstration

1. Open UC3 as administrator. Create `SPRINT10`, Percentage 10, minimum subtotal
   100,000 VND, Bến Thành hub, and dates including today. On a fresh database it is unique.
2. In UC1, select Bến Thành and Phở District. Add two bowls of Phở bò at 50,000 VND each.
   Select Central Saigon, enter a sample street address, and check eligibility.
3. Apply `SPRINT10`. Check subtotal 100,000 VND + delivery 15,000 VND − voucher
   10,000 VND = **105,000 VND**. Review and confirm the displayed amount.
4. Use COD to submit, or choose simulated online payment, decline once and retry
   successfully. Note the numeric order's padded reference, normally `SB-000004` for
   the first new order in an otherwise untouched fresh seed.
5. In UC2, select Bến Thành staff and review that order. Check reference and total.
   Confirm it, verify it leaves the pending queue, then refresh the UC1 receipt to see Confirmed.
6. Sign into UC4 as manager. Generate a Sales report for Bến Thành covering today.
   Locate the same reference and **105,000 VND** total. Default-range aggregate totals
   may also include seeded orders; compare the new order's row, not the whole sales total.
7. Archive `SPRINT10` in UC3 using the confirmation modal. A new checkout with that code
   must fail validation; the existing receipt keeps its original discount and total.

For error paths, test wrong-hub access, blank rejection reasons, expired vouchers,
invalid voucher values and report filters with no matches. See the per-use-case guides
and [integration results](integration-test-results.md) for expected outcomes and prior results.
The previous automated integration run passed 41 tests; this does not replace verification
of the final tagged candidate.

Optional browser verification, from another terminal in the same source directory:

```sh
npx playwright install chromium --only-shell
npm run test:browser
```

The checked-in browser test starts its own server and database. It checks the customer
and kitchen reference displays. `npm test` does not require Chromium. Chromium is a local
test prerequisite, not a release attachment.

## Contents and evidence

- Application: `src/`, `public/`; SQL/schema/sample data: `db/`.
- Reproducible dependencies: `package.json`, `package-lock.json`.
- Service/HTTP tests: `test/`; browser check: `scripts/check-order-reference.mjs`.
- Editable models: overall `.drawio` / `.drawio.xml` files in `docs/diagrams/overall/`,
  Mermaid subsystem models and per-use-case sequence sources under `docs/`.
- [UC1](design/UC1.md), [UC2](uc2/README.md), [UC3](uc3/README.md), [UC4](design/UC4.md)
  guides include design/prototype evidence.
- [Team report and submission folder](https://drive.google.com/drive/folders/1XL-ni65WWc1v_II3sUq4APwcZI_YU_7_?usp=sharing).
- [UC1/UC4 Figma](https://www.figma.com/design/iD7ki5jjLIyrZrvBg7Fbe0/SaigonBite-%E2%80%94-UC1---UC4),
  [UC2/UC3 Figma](https://www.figma.com/design/TuBvpDXqxV9uQK8TQkBaR4/UC-2---3-Protype).

The team must confirm lecturer access to the Drive/Figma links and include any additional
editable report models required for submission. This guide does not change sharing permissions.

## Known limitations

- UC1/UC2/UC3 identities, payment and customer notifications are local simulations.
  Reports use HTTP Basic authentication on loopback. This is a classroom demo, not a public deployment.
- Eligibility is minimum subtotal and hub restriction. “New customers only” is not supported.
- Capacity includes Submitted/Confirmed orders without delivery outcomes; repeated rehearsal
  can fill a hub. Use a new database filename for a clean rehearsal.
- Reports measure saved Confirmed order value, not settled revenue. Report history is
  in-memory for the current server session. Dates are inclusive in Vietnam time.
- Local SQLite and receipt browser state are not a production backup/account-history system.
- Design exports retain sample screen data; current archive confirmation is a modal.

## Verification and publication checklist

Record outcomes in [release verification](release-verification.md). Do not mark a check
passed solely because it was performed on a different commit.

1. Merge the deployment-guide PR after teammate review, and agree the final candidate SHA.
2. From a clean clone at that SHA, run `npm ci`, initialization, `npm test`, startup/health
   and the integrated demonstration. Run the browser check when Chromium is available.
3. Record the exact SHA, OS/Node/npm versions, commands, outcomes and remaining limitations
   in issue #31. If tracked code changes after verification, verify the new candidate again.
4. Inspect `git ls-files`: only intentional sharing files should be tracked. Exclude local
   SQLite databases, credentials, `.env`, logs, dependencies, review copies and generated test output.
   Do not attach a developer runtime database. The source archive includes the SQL sample data.
5. Create an annotated `v0.3.0-part3` tag on the verified SHA, push that tag and publish
   a GitHub release using [release notes](release-notes-part3.md). Do not move an existing tag.
6. Record the release URL and verified SHA in issue #31 and the final submission `Readme.txt`.
   Have a teammate start the tagged build before closing the issue.

Commit/tag/push and release publication are performed by the repository owner. No tag
or GitHub release has been created by preparing these documents.
