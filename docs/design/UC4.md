# UC4 management reports

Follow the [manager sign-in setup](../../README.md#manager-sign-in-for-uc4) to set a local demo password before starting the server. Open `http://127.0.0.1:4173/reports` and sign in as the seeded user `manager` with that password. The reports route checks the authenticated username's database role. This uses HTTP Basic authentication on the loopback prototype.

Select a report from the dashboard to open its criteria. The initial range is the last seven calendar days, including today. Filters include kitchen hub and virtual brand. The optional comparison uses the immediately preceding range of the same length. Recent reports reflect previews generated during the current server session. Both dates are inclusive in Vietnam time (`Asia/Ho_Chi_Minh`, UTC+07:00). The server translates the range to a UTC lower bound and exclusive upper bound before querying SQLite.

- **Sales** sums the saved order totals for confirmed orders and shows their count, average order value, and order numbers. The filter uses the order creation date. A later delivery failure does not change an order’s confirmed status in the current schema, so this metric measures confirmed order value.
- **Hub workload** groups orders by hub and current status. The filter uses the order creation date.
- **Delivery performance** groups recorded completed and failed outcomes by the order’s hub. The filter uses the date the outcome was recorded.

With fresh sample data and the default range, expect two confirmed Bến Thành orders totaling 130,000 VND, one submitted Riverside order, and one completed and one failed delivery at Bến Thành. Selecting Riverside for sales shows the empty state. `npm test` checks these metric rules using fixed timestamps at the date boundaries, plus hub filters, invalid input, and denied access.

## Implementation files

- Browser assets live in [public/uc4/](../../public/uc4/).
- The [HTTP handler](../../src/uc4/http.mjs) renders the reports workspace at `/reports`.
- The [report service](../../src/uc4/service.mjs) validates criteria and runs read-only SQLite queries.

## Design and prototype evidence

- [Sketch](sketches/UC4_Sketch.png) · [Wireframe](wireframes/UC4_wireframe.png)
- [Open the UC4 desktop prototype in Figma](https://www.figma.com/design/iD7ki5jjLIyrZrvBg7Fbe0/SaigonBite-%E2%80%94-UC1---UC4?node-id=47-56)
- [Reporting query sequence](../diagrams/UC4%20-%20Produce%20Management%20Reports/UC4_Modified_Sequence_Diagram/UC4_Modified_Sequence_Diagram.drawio)

### Figma prototype screenshots

These screenshots come from the Figma frames and show the prototype’s sample report figures.

- [Reports Dashboard](prototypes/UC4/01-reports-dashboard.png)
- [Report Criteria](prototypes/UC4/02-report-criteria.png)
- [Sales Report Preview](prototypes/UC4/03-sales-report-preview.png)
- [Invalid Criteria](prototypes/UC4/04-invalid-criteria.png)
- [No Matching Records](prototypes/UC4/05-no-matching-records.png)
- [Report Generation Error](prototypes/UC4/06-report-generation-error.png)
