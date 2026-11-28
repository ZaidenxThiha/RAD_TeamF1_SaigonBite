CREATE TABLE hubs (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  max_distance_km REAL NOT NULL CHECK (max_distance_km > 0),
  delivery_base_vnd INTEGER NOT NULL CHECK (delivery_base_vnd >= 0),
  delivery_per_km_vnd INTEGER NOT NULL CHECK (delivery_per_km_vnd >= 0),
  quiet_incentive_vnd INTEGER NOT NULL CHECK (quiet_incentive_vnd >= 0)
) STRICT;
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('customer', 'kitchen', 'admin', 'manager')),
  customer_type TEXT CHECK (customer_type IN ('local', 'tourist')),
  hub_id INTEGER REFERENCES hubs(id),
  CHECK ((role = 'kitchen') = (hub_id IS NOT NULL)),
  CHECK ((role = 'customer') = (customer_type IS NOT NULL))
) STRICT;
CREATE TABLE brands (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
) STRICT;
CREATE TABLE menu_items (
  id INTEGER PRIMARY KEY,
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  name TEXT NOT NULL,
  UNIQUE (brand_id, name)
) STRICT;
CREATE TABLE hub_menu_items (
  hub_id INTEGER NOT NULL REFERENCES hubs(id),
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  price_vnd INTEGER NOT NULL CHECK (price_vnd > 0),
  available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
  PRIMARY KEY (hub_id, menu_item_id)
) STRICT;
CREATE TABLE delivery_areas (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
) STRICT;
CREATE TABLE hub_delivery_distances (
  hub_id INTEGER NOT NULL REFERENCES hubs(id),
  area_id INTEGER NOT NULL REFERENCES delivery_areas(id),
  distance_km REAL NOT NULL CHECK (distance_km >= 0),
  PRIMARY KEY (hub_id, area_id)
) STRICT;
CREATE TABLE vouchers (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL COLLATE NOCASE UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('fixed', 'percent')),
  discount_value INTEGER NOT NULL CHECK (discount_value > 0
    AND (discount_type = 'fixed' OR discount_value <= 100)),
  starts_on TEXT NOT NULL,
  ends_on TEXT NOT NULL CHECK (ends_on >= starts_on),
  minimum_subtotal_vnd INTEGER NOT NULL DEFAULT 0 CHECK (minimum_subtotal_vnd >= 0),
  hub_id INTEGER REFERENCES hubs(id),
  archived_at TEXT
) STRICT;
CREATE TABLE voucher_audit (
  id INTEGER PRIMARY KEY,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id),
  actor_id INTEGER NOT NULL REFERENCES users(id),
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'archive')),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE payments (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  checkout_ref TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cod', 'online')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'authorized', 'declined', 'cancelled')),
  amount_vnd INTEGER NOT NULL CHECK (amount_vnd >= 0),
  provider_ref TEXT,
  archived_at TEXT,
  UNIQUE (customer_id, checkout_ref),
  UNIQUE (id, customer_id)
) STRICT;
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES users(id),
  hub_id INTEGER NOT NULL REFERENCES hubs(id),
  brand_id INTEGER NOT NULL REFERENCES brands(id),
  payment_id INTEGER NOT NULL UNIQUE,
  delivery_area_id INTEGER NOT NULL REFERENCES delivery_areas(id),
  delivery_address TEXT NOT NULL CHECK (length(trim(delivery_address)) > 0),
  voucher_id INTEGER REFERENCES vouchers(id),
  status TEXT NOT NULL DEFAULT 'Submitted' CHECK (status IN ('Submitted', 'Confirmed', 'Rejected')),
  subtotal_vnd INTEGER NOT NULL CHECK (subtotal_vnd > 0),
  delivery_fee_vnd INTEGER NOT NULL CHECK (delivery_fee_vnd >= 0),
  quiet_incentive_vnd INTEGER NOT NULL DEFAULT 0 CHECK (quiet_incentive_vnd >= 0),
  voucher_discount_vnd INTEGER NOT NULL DEFAULT 0 CHECK (voucher_discount_vnd >= 0),
  total_vnd INTEGER NOT NULL CHECK (total_vnd = subtotal_vnd + delivery_fee_vnd
    - quiet_incentive_vnd - voucher_discount_vnd),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (quiet_incentive_vnd + voucher_discount_vnd <= subtotal_vnd),
  CHECK (voucher_id IS NOT NULL OR voucher_discount_vnd = 0),
  FOREIGN KEY (payment_id, customer_id) REFERENCES payments(id, customer_id)
) STRICT;
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id),
  menu_item_id INTEGER NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_vnd INTEGER NOT NULL CHECK (unit_price_vnd > 0),
  PRIMARY KEY (order_id, menu_item_id)
) STRICT;
CREATE TABLE order_decisions (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  staff_id INTEGER NOT NULL REFERENCES users(id),
  decision TEXT NOT NULL CHECK (decision IN ('Confirmed', 'Rejected')),
  rejection_reason TEXT,
  decided_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (decision <> 'Rejected' OR length(trim(coalesce(rejection_reason, ''))) > 0)
) STRICT;
CREATE TABLE customer_notifications (
  order_id INTEGER PRIMARY KEY REFERENCES order_decisions(order_id),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE TABLE deliveries (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('completed', 'failed')),
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
) STRICT;
CREATE INDEX order_queue ON orders(hub_id, status, created_at);
CREATE INDEX order_dates ON orders(created_at);
CREATE INDEX delivery_dates ON deliveries(occurred_at);
