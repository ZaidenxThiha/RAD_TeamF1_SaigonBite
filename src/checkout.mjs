import { randomUUID } from 'node:crypto';

export class CheckoutError extends Error {
  constructor(message, status = 422, alternatives = []) {
    super(message);
    this.status = status;
    this.alternatives = alternatives;
  }
}

const demoAccounts = new Set(['customer', 'tourist']);
const vietnamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

function id(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new CheckoutError(`Choose a valid ${label}.`);
  return value;
}

function checkoutReference(value) {
  if (typeof value !== 'string' || !/^[a-z0-9-]{8,80}$/i.test(value)) {
    throw new CheckoutError('The checkout reference is invalid.');
  }
  return value;
}

function transaction(db, work) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = work();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function demoCustomer(db, username) {
  if (!demoAccounts.has(username)) throw new CheckoutError('Choose a demo customer account.', 403);
  const customer = db.prepare(
    "SELECT id, customer_type AS type FROM users WHERE username = ? AND role = 'customer'"
  ).get(username);
  if (!customer) throw new CheckoutError('Demo customer account is unavailable.', 403);
  return customer;
}

export function checkoutCatalog(db) {
  return {
    hubs: db.prepare('SELECT id, name FROM hubs ORDER BY id').all(),
    areas: db.prepare('SELECT id, name FROM delivery_areas ORDER BY id').all(),
    menu: db.prepare(`
      SELECT h.hub_id AS hubId, m.id, m.name, b.id AS brandId, b.name AS brand,
        h.price_vnd AS price
      FROM hub_menu_items h
      JOIN menu_items m ON m.id = h.menu_item_id
      JOIN brands b ON b.id = m.brand_id
      WHERE h.available = 1
      ORDER BY h.hub_id, b.name, m.name
    `).all(),
  };
}

function orderInput(input) {
  const { hubId, brandId, areaId, alternativeFromHubId, items } = input;
  const address = typeof input.address === 'string' ? input.address.trim() : '';
  const voucherCode = typeof input.voucherCode === 'string' ? input.voucherCode.trim().toUpperCase() : '';
  if (!address || address.length > 250) throw new CheckoutError('Enter a delivery address of up to 250 characters.');
  if (voucherCode.length > 80) throw new CheckoutError('The voucher code is too long.');
  if (!Array.isArray(items) || !items.length || items.length > 50) {
    throw new CheckoutError('Add at least one menu item before continuing.');
  }

  const quantities = new Map();
  for (const item of items) {
    const itemId = id(item?.itemId, 'menu item');
    const quantity = id(item?.quantity, 'quantity');
    if (quantities.has(itemId) || quantity > 99) {
      throw new CheckoutError('Use one line per item and a quantity between 1 and 99.');
    }
    quantities.set(itemId, quantity);
  }

  return {
    hubId: id(hubId, 'kitchen hub'), brandId: id(brandId, 'brand'), areaId: id(areaId, 'delivery area'),
    alternativeFromHubId: alternativeFromHubId == null ? null : id(alternativeFromHubId, 'original hub'),
    address, voucherCode, quantities,
  };
}

function checkHub(db, hubId, order) {
  const hub = db.prepare(`
    SELECT h.*, distance.distance_km AS distance, (
      SELECT count(*) FROM orders o
      WHERE o.hub_id = h.id AND o.status IN ('Submitted', 'Confirmed')
        AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.order_id = o.id)
    ) AS active_orders
    FROM hubs h
    LEFT JOIN hub_delivery_distances distance ON distance.hub_id = h.id AND distance.area_id = ?
    WHERE h.id = ?
  `).get(order.areaId, hubId);

  if (!hub) return { problem: 'Choose an available kitchen hub.' };
  if (hub.distance === null || hub.distance > hub.max_distance_km) {
    return { hub, problem: `${hub.name} cannot deliver to this area.` };
  }
  if (hub.active_orders >= hub.capacity) return { hub, problem: `${hub.name} is at capacity.` };

  const getItem = db.prepare(`
    SELECT m.id, m.name, h.price_vnd AS price
    FROM hub_menu_items h JOIN menu_items m ON m.id = h.menu_item_id
    WHERE h.hub_id = ? AND m.brand_id = ? AND m.id = ? AND h.available = 1
  `);
  const items = [];
  for (const [itemId, quantity] of order.quantities) {
    const item = getItem.get(hubId, order.brandId, itemId);
    if (!item) return { hub, problem: `Some items are unavailable at ${hub.name}.` };
    items.push({ ...item, quantity });
  }
  return { hub, items };
}

function voucherForOrder(db, { voucherCode, hubId }, subtotal, date) {
  if (!voucherCode) return null;
  const voucher = db.prepare('SELECT * FROM vouchers WHERE code = ?').get(voucherCode);
  if (!voucher || voucher.archived_at) throw new CheckoutError('This voucher is unavailable. Remove it or try another code.');
  const today = vietnamDate.format(date);
  if (today < voucher.starts_on || today > voucher.ends_on) {
    throw new CheckoutError('This voucher is outside its validity period. Remove it or try another code.');
  }
  if (subtotal < voucher.minimum_subtotal_vnd || (voucher.hub_id !== null && voucher.hub_id !== hubId)) {
    throw new CheckoutError('This order does not meet the voucher conditions. Remove it or try another code.');
  }
  return voucher;
}

export function quoteOrder(db, input, date = new Date()) {
  const order = orderInput(input);
  const { hub, items, problem } = checkHub(db, order.hubId, order);
  if (problem) {
    const alternatives = db.prepare('SELECT id, name FROM hubs WHERE id <> ? ORDER BY id').all(order.hubId)
      .filter(candidate => !checkHub(db, candidate.id, order).problem);
    throw new CheckoutError(problem, 422, alternatives);
  }

  const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
  const deliveryFee = Math.round(hub.delivery_base_vnd + hub.distance * hub.delivery_per_km_vnd);
  const original = order.alternativeFromHubId && order.alternativeFromHubId !== hub.id
    ? checkHub(db, order.alternativeFromHubId, order) : null;
  const quietIncentive = original?.hub && original.problem && hub.active_orders * 2 < hub.capacity
    ? Math.min(subtotal, hub.quiet_incentive_vnd) : 0;
  const voucher = voucherForOrder(db, order, subtotal, date);
  const requestedDiscount = voucher?.discount_type === 'percent'
    ? Math.floor(subtotal * voucher.discount_value / 100) : (voucher?.discount_value ?? 0);
  const voucherDiscount = Math.min(requestedDiscount, subtotal - quietIncentive);
  return {
    hubId: hub.id, hubName: hub.name, brandId: order.brandId, areaId: order.areaId,
    address: order.address, items, distance: hub.distance, subtotal, deliveryFee, quietIncentive,
    voucherId: voucher?.id ?? null, voucherDiscount,
    total: subtotal + deliveryFee - quietIncentive - voucherDiscount,
  };
}

function previousPayment(db, customerId, reference) {
  return db.prepare(`
    SELECT p.id, p.status, p.archived_at, o.id AS orderId
    FROM payments p LEFT JOIN orders o ON o.payment_id = p.id
    WHERE p.customer_id = ? AND p.checkout_ref = ?
  `).get(customerId, reference);
}

function receipt(db, orderId) {
  return db.prepare(`
    SELECT o.id AS orderId, o.status, h.name AS hubName, o.total_vnd AS total, p.method,
      p.status AS paymentStatus
    FROM orders o JOIN hubs h ON h.id = o.hub_id JOIN payments p ON p.id = o.payment_id
    WHERE o.id = ?
  `).get(orderId);
}

export function submitCheckout(db, customer, input) {
  const reference = checkoutReference(input.checkoutRef);

  return transaction(db, () => {
    const previous = previousPayment(db, customer.id, reference);
    if (previous?.orderId) return receipt(db, previous.orderId);
    if (previous?.archived_at || previous?.status === 'cancelled') {
      throw new CheckoutError('This checkout was cancelled. Start a new checkout.', 409);
    }

    const { method, simulation } = input;
    if (!['cod', 'online'].includes(method)) throw new CheckoutError('Choose a payment method.');
    if (method === 'online' && !['approve', 'decline'].includes(simulation)) {
      throw new CheckoutError('Choose a simulated online payment outcome.');
    }
    const quote = quoteOrder(db, input);
    if (input.expectedTotal !== quote.total) {
      throw new CheckoutError('The quote has changed. Review the updated amount before placing the order.', 409);
    }

    let paymentId = previous?.id;
    if (paymentId) {
      db.prepare("UPDATE payments SET method = ?, status = 'pending', amount_vnd = ? WHERE id = ?")
        .run(method, quote.total, paymentId);
    } else {
      paymentId = Number(db.prepare(`
        INSERT INTO payments (customer_id, checkout_ref, method, status, amount_vnd)
        VALUES (?, ?, ?, 'pending', ?)
      `).run(customer.id, reference, method, quote.total).lastInsertRowid);
    }

    if (method === 'online') {
      const status = simulation === 'approve' ? 'authorized' : 'declined';
      db.prepare('UPDATE payments SET status = ?, provider_ref = COALESCE(provider_ref, ?) WHERE id = ?')
        .run(status, `DEMO-${randomUUID()}`, paymentId);
      if (status === 'declined') return { status: 'PaymentDeclined' };
    }

    const orderId = Number(db.prepare(`
      INSERT INTO orders (customer_id, hub_id, brand_id, payment_id, delivery_area_id, delivery_address,
        voucher_id, subtotal_vnd, delivery_fee_vnd, quiet_incentive_vnd, voucher_discount_vnd, total_vnd)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(customer.id, quote.hubId, quote.brandId, paymentId, quote.areaId, quote.address,
      quote.voucherId, quote.subtotal, quote.deliveryFee, quote.quietIncentive, quote.voucherDiscount, quote.total).lastInsertRowid);
    const insertLine = db.prepare(`
      INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price_vnd) VALUES (?, ?, ?, ?, ?)
    `);
    for (const item of quote.items) insertLine.run(orderId, item.id, item.name, item.quantity, item.price);
    return receipt(db, orderId);
  });
}

export function cancelCheckout(db, customer, input) {
  const reference = checkoutReference(input.checkoutRef);
  return transaction(db, () => {
    const previous = previousPayment(db, customer.id, reference);
    if (previous?.orderId) throw new CheckoutError('This order has already been submitted.', 409);
    if (previous && !previous.archived_at) {
      db.prepare("UPDATE payments SET status = 'cancelled', archived_at = CURRENT_TIMESTAMP WHERE id = ?")
        .run(previous.id);
    }
    return { status: 'Cancelled' };
  });
}
