# UC4 management reports

Run `npm start` with `SAIGONBITE_MANAGER_PASSWORD` set to a local demo password. Open `http://127.0.0.1:4173/reports` and sign in as the seeded user `manager` with that password. The reports route checks the authenticated username's database role. This uses HTTP Basic authentication on the loopback prototype.

The initial range is the last seven calendar days, including today. The report and hub selectors submit with the date range. Both dates are inclusive in Vietnam time (`Asia/Ho_Chi_Minh`, UTC+07:00). The server translates the range to a UTC lower bound and exclusive upper bound before querying SQLite.

- **Sales** sums the saved order totals for confirmed orders and shows their count, average order value, and order numbers. The filter uses the order creation date. A later delivery failure does not change an order’s confirmed status in the current schema, so this metric measures confirmed order value.
- **Hub workload** groups orders by hub and current status. The filter uses the order creation date.
- **Delivery performance** groups recorded completed and failed outcomes by the order’s hub. The filter uses the date the outcome was recorded.

With fresh sample data and the default range, expect two confirmed Bến Thành orders totaling 130,000 VND, one submitted Riverside order, and one completed and one failed delivery at Bến Thành. Selecting Riverside for sales shows the empty state. `npm test` checks these metric rules using fixed timestamps at the date boundaries, plus hub filters, invalid input, and denied access.

## Design and prototype evidence

- [Original sketch and wireframe](sketch-wireframe.png)
- [Sales screen mockup captured from the implemented layout](sales-mockup.png)
- [Running prototype with the Bến Thành delivery filter applied](prototype.png)
- [Reporting query sequence](report-sequence.mmd)
