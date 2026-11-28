# UC1–UC4 integration test results

Engineering evidence for [issue #29](https://github.com/ZaidenxThiha/RAD_TeamF1_SaigonBite/issues/29).

## Setup

Run `npm test` for the full suite or `node --test test/use-case-integration.test.mjs` for the four-use-case flow. The integration test starts the actual Node.js server on an ephemeral loopback port, seeds a disposable SQLite database, and stops the server before deleting the database. Test inputs use demo accounts and sample addresses.

The test creates `SPRINT10` for Bến Thành with a 10% discount and a 100,000 VND minimum subtotal. Two bowls of phở bò cost 100,000 VND. With 15,000 VND delivery and a 10,000 VND discount, the expected order total is **105,000 VND**.

## Results

- **UC3 voucher creation and archive — Pass.** Expected an active voucher with an administrator audit entry. The server returned the new voucher and identified the administrator in its history. After archiving, a new UC1 quote returned a voucher validation error. The original receipt kept its recorded amount.
- **UC1 checkout and retry — Pass.** Expected a declined authorization to leave the kitchen queue empty. The decline produced no queue entry. Retrying with the same checkout reference created one Submitted order for 105,000 VND. Replaying the submission returned the same receipt.
- **UC2 kitchen decision — Pass.** Expected the order in the Bến Thành queue, denial at Riverside, and rejection validation for a blank reason. The queue contained the same order and amount. Riverside received 403, and blank rejection received 422 while the order remained Submitted. Confirmation removed the order from the queue, and refreshing UC1 showed Confirmed.
- **UC4 sales report — Pass.** Expected the confirmed order in the Bến Thành sales report and an empty state for a date range without orders. The report showed the same order reference and 105,000 VND. The empty range showed “No matching records.”

### Browser verification

Chrome on macOS reproduced the four-use-case flow against a fresh database. The checkout receipt, kitchen decision, and sales report all showed **SB-000004**. Checkout, the kitchen queue, and the sales report showed **105,000 VND**. Archiving the voucher blocked a new quote and preserved the confirmed receipt.

### Defect retests

- **UC1 price changes — Pass.** The browser repro confirmed that both a change during review and a later change before submission require a new confirmation. Neither price change created an order. One order was saved only after the final amount of 123,000 VND was shown and accepted. [PR #42](https://github.com/ZaidenxThiha/RAD_TeamF1_SaigonBite/pull/42)
- **UC4 empty-period comparison — Pass.** Chrome showed zero current sales and 65,000 VND in the previous period while retaining the empty-state message. [PR #43](https://github.com/ZaidenxThiha/RAD_TeamF1_SaigonBite/pull/43)
- **Order reference consistency — Pass.** The three browser views used the same padded reference. [PR #41](https://github.com/ZaidenxThiha/RAD_TeamF1_SaigonBite/pull/41) and [PR #43](https://github.com/ZaidenxThiha/RAD_TeamF1_SaigonBite/pull/43)

### Test output

```text
✔ UC3 voucher, UC1 checkout, UC2 confirmation and UC4 report share an order and total
ℹ tests 41
ℹ pass 41
ℹ fail 0
```

No failures observed in this integration run. Rehearsal on the tagged release is pending.
