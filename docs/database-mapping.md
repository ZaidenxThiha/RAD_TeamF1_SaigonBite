# SaigonBite database mapping

## Catalog and users

- User → `users`. The primary key is `id`. The role separates customers, kitchen staff, administrators, and managers. Kitchen staff have a foreign key to their assigned hub.
- Hub → `hubs`. Includes capacity, maximum coverage distance, delivery fee settings, and quiet-hub incentive.
- Brand and MenuItem → `brands` and `menu_items`. A menu item references a brand. `hub_menu_items` joins hubs to items and records price and availability.
- DeliveryArea → `delivery_areas`. `hub_delivery_distances` joins hubs to areas and supplies sample distances.

## Checkout and kitchen

- Voucher → `vouchers`. A case-insensitive unique code describes the discount, dates, minimum subtotal, and optional eligible hub. `archived_at` preserves a voucher in history while indicating that checkout should refuse it.
- VoucherAudit → `voucher_audit`. Each successful change records the voucher, the actor, the action, and its time.
- Payment → `payments`. The pair of customer ID and checkout reference is unique. This lets a retry use the same payment record. Failed attempts can remain without an order.
- Order → `orders`. Each order references a customer, hub, brand, delivery area, and exactly one payment belonging to that customer. The optional voucher ID and stored amounts preserve the final quote. Payment IDs cannot be shared across orders.
- OrderItem → `order_items`. The primary key is the order and menu-item pair. The name and unit price are copied from the quote at submission.
- OrderDecision and CustomerNotification → `order_decisions` and `customer_notifications`. Each order can have one decision with staff and time, followed by a notification result. A rejection requires a reason.

## Reporting and service responsibilities

- Delivery → `deliveries`. Each sample delivery references an order and stores the terminal outcome and time. Reports read orders, hubs, decisions and deliveries. Report results are generated when requested.
- Currency is stored as whole VND. SQLite's event timestamps are UTC. Voucher date windows are seeded for Vietnam local dates.
- The checkout service will validate customer roles, hub availability, brand, voucher eligibility, and payment status, then save the order and line items in one transaction. SQLite enforces references and amount constraints.
- The decision service will check the kitchen staff role and hub on the server, transition only submitted orders, and save the status and decision in one transaction. Voucher changes and their audit entries should also be written together.
- Checkout counts submitted and confirmed orders without a terminal delivery outcome toward active hub capacity.

## Query indexes

- `order_queue (hub_id, status, created_at)` supports listing and sorting submitted orders for one kitchen.
- `order_dates (created_at)` supports date filters for order-based reports.
- `delivery_dates (occurred_at)` supports date filters for delivery reports.

The class diagram shows the checkout rule that a submitted order contains at least one line item. The checkout service will enforce this rule when it saves an order and its items. The schema already rejects line items that reference missing orders.
