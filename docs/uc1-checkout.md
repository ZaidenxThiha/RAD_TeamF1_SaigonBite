# UC1 · Place an Order

The current browser prototype is available at the root URL printed by npm start. It uses the checkout routes and the same SQLite database as the later kitchen queue and reporting work.

## Prototype walkthrough

1. Select Bến Thành and Phở District. Continue to the menu and add two bowls of phở bò.
2. Open cart and delivery, select Central Saigon, enter an address, and check eligibility.
3. Continue to order review, enter DEMO10, and select Apply. Expect a 100,000 VND subtotal, 15,000 VND delivery, 10,000 VND discount and 105,000 VND total.
4. Confirm checkout and continue with Cash on Delivery. The receipt shows the saved order number and Submitted status. Use Refresh status after a kitchen decision.
5. For the alternative-hub case, start another order at Riverside. Its sample queue is full. Check delivery and accept the suggested Bến Thành alternative.
6. To test payment recovery, select Online payment and choose Payment failed. Return to order review to re-quote, retry using the same payment reference, or use Menu to cancel checkout.

The customer picker represents local sample accounts. It is a demo input on the loopback server. Address coverage uses the selected sample area and its stored hub distance. Local and tourist demo accounts can select COD or the simulator. Online payment and customer sign-in are simulated in the local app.

## Figma prototype screenshots

[Open the UC1 mobile prototype in Figma](https://www.figma.com/design/iD7ki5jjLIyrZrvBg7Fbe0/SaigonBite-%E2%80%94-UC1---UC4?node-id=116-2). These screenshots come from the Figma frames and show the prototype’s sample data.

### Checkout screens

- [Select Hub & Brand](uc1/prototype/01-select-hub-and-brand.png)
- [Browse Menu & Cart](uc1/prototype/02-menu-and-cart.png)
- [Delivery Address & Eligibility](uc1/prototype/03-delivery-eligibility.png)
- [Voucher & Order Review](uc1/prototype/04-voucher-and-review.png)
- [Payment Method](uc1/prototype/05-payment-method.png)
- [Online Payment Processing](uc1/prototype/06-online-payment.png)
- [Order Confirmation](uc1/prototype/07-order-confirmation.png)
- [Payment Failed](uc1/prototype/08-payment-failed.png)

### Feedback overlays

- [Added to Cart](uc1/prototype/overlay-added-to-cart.png)
- [Eligibility Passed](uc1/prototype/overlay-eligibility-passed.png)
- [Alternative Hub Suggested](uc1/prototype/overlay-alternative-hub.png)
- [Voucher Feedback](uc1/prototype/overlay-voucher-feedback.png)

## Report evidence

- Section 4.3.2 uses the [editable checkout sequence](uc1-checkout-sequence.mmd).
- Section 4.3.3 uses the Figma prototype screens and overlays linked above.
- Section 4.3.5 references quoteOrder, submitCheckout and cancelCheckout in [checkout.mjs](../src/uc1/service.mjs).
- Section 5.1 can use [checkout.test.mjs](../test/checkout.test.mjs) to reproduce the checks for a one-payment receipt, hub alternatives, invalid inputs, declined authorization, retry and cancellation.

For the UC2 handoff, a successful submission has status Submitted and the assigned hub in the orders table. It references the selected payment and its item snapshots. For the UC3 handoff, checkout reads the existing vouchers table. The seeded DEMO10 code lets UC1 work before the admin screens are merged.

After a kitchen decision, select **Refresh status** on the open customer receipt to read
the latest Confirmed or Rejected status (and rejection reason). The read-only lookup
requires the submitted order's owner and original checkout reference; it does not create
another order or payment. Account selection remains a local demo simulation.
