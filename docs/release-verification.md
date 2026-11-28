# Part 3 release verification

Owner: Thin Lei Sandi (523K0075). Issue #31.

Status: **Preparation in progress. Not yet a verified tagged release.**

| Item | Evidence or outcome |
|---|---|
| Preparation base | `bfdd9ed5d093933e8cae683853571539dd5402c9` |
| Working branch | `docs/31-part3-release-deployment` |
| Preparation environment | Windows, Node.js 24.21.0, npm 11.19.0 |
| Proposed version | `v0.3.0-part3` — not created |
| Final candidate full SHA | Pending after documentation review/merge |
| Clean-clone setup | Pending. Local clone attempt was blocked by the sandbox; the requested retry was not authorized. No clean-checkout pass is claimed. |
| Dependency installation from lockfile | Pending in clean checkout |
| Database initialization and seed checks | Pending in clean checkout |
| Full test suite | Prior integration review at `0bc999b` independently passed 41 tests. Re-run against the final candidate. |
| Chromium test | Added on merged main after that review; pending release-candidate run |
| Startup, health and demo rehearsal | Pending in clean checkout |
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
