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

- Verified full commit SHA: pending.
- Verification environment and date: pending.
- Clean checkout, dependency installation and initialization: pending.
- `npm test` result: pending release-candidate run.
- `npm run test:browser` result: pending, or explicitly state Not run and why.
- Integrated demonstration and teammate reproduction: pending.

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
