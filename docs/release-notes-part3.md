# Part 3 — v0.3.0-part3

Draft release notes. Publish only after replacing the verification fields below with
the actual verified revision and results.

## Included

- UC1: mobile customer checkout, delivery/capacity checks, server pricing, voucher
  application, COD/simulated payment recovery and customer receipt status refresh.
- UC2: assigned-hub order review, confirmation/rejection, required rejection reason,
  recorded staff/time and customer status integration.
- UC3: administrator voucher creation/editing/archiving, validation and audit history.
- UC4: sales, hub workload and delivery reports with Vietnam date/hub/brand filters,
  previous-period comparisons and consistent six-digit order references.
- SQL schema and sample data, editable models, design evidence, tests and deployment guide.

## Run

Install Node.js 22.13+ and npm. Download this release's source or clone its tag.
Run `npm ci`. Set `SAIGONBITE_MANAGER_PASSWORD` and optionally a new `SAIGONBITE_DB`
filename, then run `npm run init`, `npm test` and `npm start`.

Open checkout `/`, kitchen `/kitchen`, vouchers `/vouchers` and reports `/reports` at
`http://127.0.0.1:4173`. Reports username is `manager`, with the local password you set.
Follow [the complete deployment guide](deployment.md) for PowerShell/POSIX commands,
the 105,000 VND integrated demo and optional Chromium test.

## Verification to fill before publication

- Tested application candidate: `33632eeeefb9228094aef2d5fbed21ad3a60c08d`. Confirm the exact tag target before publication; these notes do not create a tag.
- Verification environment and date: Windows PowerShell; final test output supplied by Thin Lei Sandi on 29 November 2026. The earlier rehearsal recorded Node.js 24.21.0 and npm 11.19.0; versions were not reprinted in the final output.
- Clean checkout, dependency installation and initialization: passed during the earlier fresh-clone rehearsal at `bfdd9ed5d093933e8cae683853571539dd5402c9`. Final tests ran in that existing test checkout after updating it. Application code, SQL, dependency manifests and test/scripts trees are unchanged between these revisions.
- `npm test`: 41 passed, 0 failed, 0 skipped; duration 7469.552 ms at the tested candidate.
- `npm run test:browser`: not recorded for the final candidate; optional Chromium verification was not part of the supplied rerun.
- Integrated demonstration: user reported the earlier fresh-clone demo passed; the final automated UC1–UC4 integration test also passed. Separate teammate reproduction remains pending.

## Known limitations

Local classroom demo only. Customer/kitchen/admin identities, online payments and
notifications are simulated. Manager sign-in uses loopback HTTP Basic authentication.
Voucher eligibility supports minimum subtotal and hub, not “New customers only”.
Capacity can fill after repeated rehearsals. Reports use Confirmed order value rather
than settled revenue; recent report history resets with the server. Local developer
databases and credentials are intentionally excluded. Fresh data comes from SQL seeds.

## Submission evidence

- [Report/submission folder](https://drive.google.com/drive/folders/1XL-ni65WWc1v_II3sUq4APwcZI_YU_7_?usp=sharing)
- [Integration results](integration-test-results.md)
- [UC1/UC4 designs](https://www.figma.com/design/iD7ki5jjLIyrZrvBg7Fbe0/SaigonBite-%E2%80%94-UC1---UC4)
- [UC2/UC3 designs](https://www.figma.com/design/TuBvpDXqxV9uQK8TQkBaR4/UC-2---3-Protype)

When pasting these notes into GitHub, replace relative documentation links with links
to the corresponding files under `/blob/v0.3.0-part3/docs/` in this repository.
