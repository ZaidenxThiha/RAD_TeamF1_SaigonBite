import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { cancelCheckout, demoCustomer, quoteOrder, submitCheckout } from '../src/checkout.mjs';

const order = {
  checkoutRef: 'checkout-test-1', hubId: 1, brandId: 1, areaId: 1,
  address: 'Sample address, Central Saigon', items: [{ itemId: 1, quantity: 2 }],
  voucherCode: 'DEMO10', method: 'cod', expectedTotal: 105000,
};

function setup(t) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  return { db, customer: demoCustomer(db, 'customer') };
}

test('COD saves a submitted order, one linked payment and its item snapshot; replay returns the same receipt', t => {
  const { db, customer } = setup(t);
  const first = submitCheckout(db, customer, order);
  const second = submitCheckout(db, customer, order);
  assert.deepEqual(first, second);
  assert.equal(first.total, 105000);
  assert.equal(first.status, 'Submitted');
  assert.equal(first.paymentStatus, 'pending');
  assert.equal(db.prepare('SELECT count(*) AS count FROM orders').get().count, 4);
  assert.equal(db.prepare('SELECT count(*) AS count FROM payments').get().count, 4);
  const row = db.prepare(`
    SELECT o.hub_id, p.checkout_ref, i.quantity, i.unit_price_vnd
    FROM orders o JOIN payments p ON p.id = o.payment_id JOIN order_items i ON i.order_id = o.id
    WHERE o.id = ?
  `).get(first.orderId);
  assert.deepEqual({ ...row }, { hub_id: 1, checkout_ref: order.checkoutRef, quantity: 2, unit_price_vnd: 50000 });
});

test('a full hub suggests a valid alternative and only an eligible switch gets the quiet incentive', t => {
  const { db } = setup(t);
  assert.throws(() => quoteOrder(db, { ...order, hubId: 2 }), error =>
    error.message.includes('at capacity') && error.alternatives[0]?.id === 1);
  const quote = quoteOrder(db, { ...order, alternativeFromHubId: 2 });
  assert.equal(quote.quietIncentive, 5000);
  assert.equal(quote.total, 100000);
  assert.equal(quoteOrder(db, { ...order, alternativeFromHubId: 999 }).quietIncentive, 0);
});

test('coverage, unavailable items, expired vouchers and stale totals do not create a payment or order', t => {
  const { db, customer } = setup(t);
  assert.throws(() => submitCheckout(db, customer, { ...order, areaId: 2 }), /cannot deliver/);
  assert.throws(() => submitCheckout(db, customer, { ...order, voucherCode: 'EXPIRED10' }), /validity period/);
  assert.throws(() => submitCheckout(db, customer, { ...order, expectedTotal: 1 }), /quote has changed/);
  db.exec('UPDATE hub_menu_items SET available = 0 WHERE hub_id = 1');
  assert.throws(() => submitCheckout(db, customer, order), /unavailable/);
  assert.equal(db.prepare('SELECT count(*) AS count FROM payments').get().count, 3);
  assert.equal(db.prepare('SELECT count(*) AS count FROM orders').get().count, 3);
});

test('a declined authorization retains one payment without an order, and approval retries it', t => {
  const { db, customer } = setup(t);
  const online = { ...order, method: 'online', simulation: 'decline' };
  assert.equal(submitCheckout(db, customer, online).status, 'PaymentDeclined');
  const find = db.prepare('SELECT id, status, provider_ref FROM payments WHERE checkout_ref = ?');
  const declined = find.get(order.checkoutRef);
  assert.equal(declined.status, 'declined');
  assert.match(declined.provider_ref, /^DEMO-/);
  assert.equal(db.prepare('SELECT count(*) AS count FROM orders').get().count, 3);
  assert.equal(submitCheckout(db, customer, { ...online, simulation: 'approve' }).status, 'Submitted');
  const approved = find.get(order.checkoutRef);
  assert.equal(approved.id, declined.id);
  assert.equal(approved.status, 'authorized');
});

test('cancelling archives a failed payment and abandoning a quote saves no new records', t => {
  const { db, customer } = setup(t);
  quoteOrder(db, order);
  assert.equal(cancelCheckout(db, customer, order).status, 'Cancelled');
  assert.equal(db.prepare('SELECT count(*) AS count FROM payments').get().count, 3);

  submitCheckout(db, customer, { ...order, method: 'online', simulation: 'decline' });
  cancelCheckout(db, customer, order);
  const payment = db.prepare('SELECT status, archived_at FROM payments WHERE checkout_ref = ?').get(order.checkoutRef);
  assert.equal(payment.status, 'cancelled');
  assert.ok(payment.archived_at);
  assert.throws(() => submitCheckout(db, customer, order), /was cancelled/);
  assert.equal(db.prepare('SELECT count(*) AS count FROM orders').get().count, 3);
});

test('a stale checkout after decline can be edited and re-quoted against the same payment', t => {
  const { db, customer } = setup(t);
  const online = { ...order, method: 'online', simulation: 'decline' };
  const find = db.prepare('SELECT id, status, provider_ref, amount_vnd FROM payments WHERE checkout_ref = ?');

  assert.equal(submitCheckout(db, customer, online).status, 'PaymentDeclined');
  const declined = find.get(order.checkoutRef);
  db.exec('UPDATE hub_menu_items SET price_vnd = 55000 WHERE hub_id = 1 AND menu_item_id = 1');

  const retry = { ...online, simulation: 'approve' };
  assert.throws(() => submitCheckout(db, customer, retry), /quote has changed/);
  assert.deepEqual(find.get(order.checkoutRef), declined);
  assert.equal(db.prepare('SELECT count(*) AS count FROM orders WHERE payment_id = ?').get(declined.id).count, 0);

  const revised = { ...retry, items: [{ itemId: 1, quantity: 3 }] };
  const quote = quoteOrder(db, revised);
  assert.equal(quote.total, 163500);
  const receipt = submitCheckout(db, customer, { ...revised, expectedTotal: quote.total });
  assert.equal(receipt.status, 'Submitted');
  assert.equal(receipt.total, quote.total);
  assert.deepEqual({ ...find.get(order.checkoutRef) }, {
    ...declined, status: 'authorized', amount_vnd: quote.total,
  });
  assert.equal(db.prepare('SELECT count(*) AS count FROM payments').get().count, 4);
  assert.equal(db.prepare('SELECT count(*) AS count FROM orders WHERE payment_id = ?').get(declined.id).count, 1);
});
