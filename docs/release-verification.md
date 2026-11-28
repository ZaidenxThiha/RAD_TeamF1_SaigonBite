# Part 3 release verification

Owner: Thin Lei Sandi (523K0075). Issue #31.

Status: **Fresh-clone manual rehearsal reported passed at the earlier revision; all 41 tests rerun successfully at the final application candidate. Tag and release not yet published.**

| Item | Evidence or outcome |
|---|---|
| Preparation base | `bfdd9ed5d093933e8cae683853571539dd5402c9` |
| Working branch | `docs/31-part3-release-deployment` |
| Preparation environment | Windows, Node.js 24.21.0, npm 11.19.0 |
| Proposed version | `v0.3.0-part3` — not created |
| Manually rehearsed full SHA | `bfdd9ed5d093933e8cae683853571539dd5402c9` — read directly from the fresh clone; working tree clean |
| Final candidate full SHA | `33632eeeefb9228094aef2d5fbed21ad3a60c08d`. User supplied the full SHA and successful test output on 29 November 2026 after fast-forwarding the existing test checkout. |
| Clean-clone setup | User reported successful startup in the fresh clone on 28 November 2026. Clone located at `SaigonBite-Part3-Test/SaigonBite-Part3-Test` on the verification machine. |
| Dependency installation from lockfile | Pass. User supplied PowerShell output from the fresh clone: `npm ci` added 2 packages, audited 3 packages, and reported 0 vulnerabilities. |
| Database initialization and seed checks | Pass. `npm run init` created `runtime/part3-demo.sqlite`; the full suite's initialization and seed relationship checks passed. |
| Full test suite | Pass at `33632eeeefb9228094aef2d5fbed21ad3a60c08d`: 41 tests, 41 passed, 0 failed/cancelled/skipped/todo, duration 7469.552 ms. User supplied PowerShell output, including actual-server UC1–UC4 integration. Earlier fresh-clone run at `bfdd9ed5d093933e8cae683853571539dd5402c9` also passed all 41 tests. |
| Chromium test | Added on merged main after that review; pending release-candidate run |
| Startup and integrated demo rehearsal | Pass, reported by Thin Lei Sandi on 28 November 2026: app opened, voucher creation/application, 105,000 VND checkout, kitchen confirmation, customer status refresh, matching sales report and archived-voucher rejection completed. Browser actions were performed by the user, not independently observed by the assistant. |
| Health endpoint | Not separately recorded |
| Tracked file inventory | Preparation scan found no tracked runtime database, node_modules, `.env`, key, log or ZIP files matching the inventory check. Final candidate must be rechecked. |
| Report and design links | Added to deployment guide. Team must confirm lecturer access. |
| Tag and release URL | Pending owner publication |
| Teammate reproduction | Pending |

Use [the deployment instructions](deployment.md) without borrowing an existing runtime
database or node_modules folder. Capture actual command output and fill the pending
rows or record the outcome in issue #31 with its exact candidate SHA.

On completion, record: full SHA, date/time, verifier, OS, `node --version`, `npm --version`,
`npm ci` outcome, initialization, test totals, optional browser result, health response,
reference/total observed in UC1/UC2/UC4, archive-rejection result and teammate reproduction.
Distinguish Pass, Fail and Not run. A blocker during preparation is not an application defect.

## Fresh-clone command evidence

Thin Lei Sandi supplied the following PowerShell results on 28 November 2026 from
the fresh clone. The manager demo password is intentionally omitted from this record.

```text
git rev-parse HEAD
bfdd9ed5d093933e8cae683853571539dd5402c9
node --version
v24.21.0
npm --version
11.19.0
npm ci
added 2 packages, and audited 3 packages in 2s
found 0 vulnerabilities
npm run init
SaigonBite database ready at [fresh clone]/runtime/part3-demo.sqlite
npm test
tests 41
pass 41
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 6932.6097
```

The user also reported successfully opening the app and completing the integrated
manual demonstration. The optional Chromium test and a second teammate's clean-clone
reproduction have not been recorded. A tag must identify the verified revision;
do not describe a later untested code revision as this verified build.

## Final candidate test rerun — 29 November 2026

Thin Lei Sandi fast-forwarded the existing test checkout to the merged documentation
revision and supplied this output:

```text
git rev-parse HEAD
33632eeeefb9228094aef2d5fbed21ad3a60c08d
npm test
tests 41
pass 41
fail 0
cancelled 0
skipped 0
todo 0
duration_ms 7469.552
```

This was an updated existing test checkout, not another fresh clone. Dependency
installation, initialization and the manual demo remain evidence from the earlier
fresh-clone rehearsal. A Git comparison found no changes in `src/`, `public/`, `db/`,
`package.json`, `package-lock.json`, `test/` or `scripts/` between that earlier verified
revision and this candidate. Later changes organize documentation and design evidence.
The final rerun does not establish a new browser, health-endpoint or teammate result.
