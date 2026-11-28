INSERT INTO hubs VALUES
  (1, 'Bến Thành', 6, 5, 10000, 2500, 5000),
  (2, 'Riverside', 1, 6, 10000, 2500, 5000);
INSERT INTO users (id, username, role, customer_type, hub_id) VALUES
  (1, 'customer', 'customer', 'local', NULL),
  (2, 'tourist', 'customer', 'tourist', NULL),
  (3, 'kitchen-ben-thanh', 'kitchen', NULL, 1),
  (4, 'kitchen-riverside', 'kitchen', NULL, 2),
  (5, 'administrator', 'admin', NULL, NULL),
  (6, 'manager', 'manager', NULL, NULL);
INSERT INTO brands VALUES (1, 'Phở District');
INSERT INTO menu_items VALUES (1, 1, 'Phở bò');
INSERT INTO hub_menu_items VALUES (1, 1, 50000, 1), (2, 1, 50000, 1);
INSERT INTO delivery_areas VALUES (1, 'Central Saigon'), (2, 'Outside coverage');
INSERT INTO hub_delivery_distances VALUES (1, 1, 2), (2, 1, 3), (1, 2, 8), (2, 2, 9);
INSERT INTO vouchers (id, code, discount_type, discount_value, starts_on, ends_on, minimum_subtotal_vnd) VALUES
  (1, 'DEMO10', 'percent', 10, date('now', '+7 hours', '-1 day'), date('now', '+7 hours', '+30 days'), 100000),
  (2, 'EXPIRED10', 'percent', 10, date('now', '+7 hours', '-30 days'), date('now', '+7 hours', '-1 day'), 0);
INSERT INTO voucher_audit (voucher_id, actor_id, action) VALUES (1, 5, 'create'), (2, 5, 'create');
INSERT INTO payments (id, customer_id, checkout_ref, method, status, amount_vnd) VALUES
  (1, 1, 'seed-pending', 'cod', 'pending', 67500),
  (2, 1, 'seed-delivered', 'cod', 'pending', 65000),
  (3, 1, 'seed-failed-delivery', 'cod', 'pending', 65000);
INSERT INTO orders (id, customer_id, hub_id, brand_id, payment_id, delivery_area_id,
  delivery_address, status, subtotal_vnd, delivery_fee_vnd, total_vnd, created_at) VALUES
  (1, 1, 2, 1, 1, 1, 'Demo address, Central Saigon', 'Submitted', 50000, 17500, 67500, CURRENT_TIMESTAMP),
  (2, 1, 1, 1, 2, 1, 'Demo address, Central Saigon', 'Confirmed', 50000, 15000, 65000, datetime('now', '-2 days')),
  (3, 1, 1, 1, 3, 1, 'Demo address, Central Saigon', 'Confirmed', 50000, 15000, 65000, datetime('now', '-1 day'));
INSERT INTO order_items VALUES (1, 1, 'Phở bò', 1, 50000), (2, 1, 'Phở bò', 1, 50000), (3, 1, 'Phở bò', 1, 50000);
INSERT INTO order_decisions (order_id, staff_id, decision, decided_at) VALUES
  (2, 3, 'Confirmed', datetime('now', '-2 days', '+15 minutes')),
  (3, 3, 'Confirmed', datetime('now', '-1 day', '+15 minutes'));
INSERT INTO deliveries VALUES
  (2, 'completed', datetime('now', '-2 days', '+45 minutes')),
  (3, 'failed', datetime('now', '-1 day', '+45 minutes'));
