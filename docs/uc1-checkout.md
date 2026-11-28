# UC1 · Place an Order

The current browser prototype is available at the root URL printed by npm start. It uses the checkout routes and the same SQLite database as the later kitchen queue and reporting work.

## Prototype walkthrough

1. Select Bến Thành and two bowls of phở bò. Select Central Saigon and enter a sample delivery address.
2. Enter DEMO10 and select Review total. Expect a 100,000 VND subtotal, 15,000 VND delivery, 10,000 VND discount and 105,000 VND total.
3. Select Cash on delivery and place the order. The receipt shows the saved order number and Submitted status.
4. For the alternative-hub case, start another order at Riverside. Its sample queue is full. Review the same eligible cart and switch to Bến Thành using the suggested button.
5. For payment recovery, choose Online payment and first simulate Decline. Choose Approve to retry the same payment or use Cancel checkout to archive it.

The customer picker represents local sample accounts. It is a demo input on the loopback server. Address coverage uses the selected sample area and its stored hub distance. Local and tourist demo accounts can select COD or the simulator. Real payment authorization, production authentication, and the shared Figma shell are outside the behavior of this checkout preview.

## Report evidence

- Section 4.3.2 uses the [editable checkout sequence](uc1-checkout-sequence.mmd).
- Section 4.3.3 can use the running checkout as a prototype. The shared Figma shell and the team’s sketch and wireframe exports can be linked when available.
- Section 4.3.5 references quoteOrder, submitCheckout and cancelCheckout in [checkout.mjs](../src/checkout.mjs).
- Section 5.1 can use [checkout.test.mjs](../test/checkout.test.mjs) to reproduce the checks for a one-payment receipt, hub alternatives, invalid inputs, declined authorization, retry and cancellation.

For the UC2 handoff, a successful submission has status Submitted and the assigned hub in the orders table. It references the selected payment and its item snapshots. For the UC3 handoff, checkout reads the existing vouchers table. The seeded DEMO10 code lets UC1 work before the admin screens are merged.
