// UC2 post-condition tests. Author: Thin Lei Sandi (523K0075).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { KitchenService } from '../src/uc2/service.mjs';
import { demoCustomer, quoteOrder, submitCheckout } from '../src/checkout.mjs';

const riverside = 'kitchen-riverside';
const benThanh = 'kitchen-ben-thanh';
function setup(t, notify) {
  const db = openDatabase(':memory:');
  t.after(() => db.close());
  return { db, kitchen: new KitchenService(db, notify) };
}
function errorCode(code) { return error => error.code === code; }
function unchanged(db) {
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=1').get().status, 'Submitted');
  assert.equal(db.prepare('SELECT count(*) AS n FROM order_decisions WHERE order_id=1').get().n, 0);
  assert.equal(db.prepare('SELECT count(*) AS n FROM customer_notifications WHERE order_id=1').get().n, 0);
}

test('queue is scoped to the staff hub and contains only Submitted orders with item quantities', t => {
  const { kitchen } = setup(t);
  assert.deepEqual(kitchen.queue(benThanh).orders, []);
  const { staff, orders } = kitchen.queue(riverside);
  assert.equal(staff.hubId, 2);
  assert.equal(orders.length, 1);
  assert.equal(orders[0].id, 1);
  assert.equal(orders[0].itemCount, 1);
  const order = kitchen.details(riverside, 1);
  assert.equal(order.total, 67500);
  assert.equal(order.method, 'cod');
  assert.equal(order.address, 'Demo address, Central Saigon');
  assert.equal(order.items[0].unitPrice, 50000);
});

test('unknown/non-kitchen accounts and wrong hubs cannot review or decide', async t => {
  const { db, kitchen } = setup(t);
  for (const username of [undefined, 'missing', 'customer', 'administrator']) {
    assert.throws(() => kitchen.queue(username), errorCode('ACCESS_DENIED'));
    await assert.rejects(kitchen.decide(username, 1, { decision: 'Confirmed' }), errorCode('ACCESS_DENIED'));
  }
  assert.throws(() => kitchen.details(benThanh, 1), errorCode('ACCESS_DENIED'));
  await assert.rejects(kitchen.decide(benThanh, 1, { decision: 'Rejected', reason: 'Unavailable' }), errorCode('ACCESS_DENIED'));
  unchanged(db);
});

test('confirmation atomically saves staff/time, removes queue entry and retains order, items and payment', async t => {
  const { db, kitchen } = setup(t);
  const payment = db.prepare('SELECT * FROM payments WHERE id=1').get();
  const result = await kitchen.decide(riverside, 1, { decision: 'Confirmed', staffId: 3, hubId: 1, reason: 'ignored' });
  assert.equal(result.status, 'Confirmed');
  assert.equal(result.staffId, 4);
  assert.equal(result.reason, null);
  assert.match(result.decidedAt, /^\d{4}-\d{2}-\d{2} /);
  assert.equal(result.notificationStatus, 'sent');
  assert.deepEqual(kitchen.queue(riverside).orders, []);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=1').get().status, 'Confirmed');
  assert.equal(db.prepare('SELECT count(*) AS n FROM order_items WHERE order_id=1').get().n, 1);
  assert.deepEqual(db.prepare('SELECT * FROM payments WHERE id=1').get(), payment);
});

test('rejection requires a trimmed reason; invalid decisions and oversized reasons save nothing', async t => {
  const { db, kitchen } = setup(t);
  for (const reason of [undefined, '', ' \n\t ', 42, 'x'.repeat(1001)]) {
    await assert.rejects(kitchen.decide(riverside, 1, { decision: 'Rejected', reason }), errorCode('REASON_REQUIRED'));
    unchanged(db);
  }
  await assert.rejects(kitchen.decide(riverside, 1, { decision: 'Prepared' }), errorCode('INVALID_DECISION'));
  unchanged(db);
  const result = await kitchen.decide(riverside, 1, { decision: 'Rejected', reason: '  Out of ingredients.  ' });
  assert.equal(result.reason, 'Out of ingredients.');
  assert.equal(result.status, 'Rejected');
  assert.equal(result.staffId, 4);
  assert.equal(kitchen.queue(riverside).orders.length, 0);
});

test('save-time staff/hub recheck prevents a decision after assignment changes', async t => {
  const { db, kitchen } = setup(t);
  kitchen.details(riverside, 1);
  db.exec("UPDATE users SET hub_id=1 WHERE username='kitchen-riverside'");
  await assert.rejects(kitchen.decide(riverside, 1, { decision: 'Confirmed' }), errorCode('ACCESS_DENIED'));
  unchanged(db);
});

test('two stale staff views cannot overwrite the first decision or send a second notification', async t => {
  let attempts = 0;
  const { db, kitchen } = setup(t, () => { attempts++; return 'sent'; });
  const other = new KitchenService(db);
  kitchen.details(riverside, 1);
  other.details(riverside, 1);
  const results = await Promise.allSettled([
    kitchen.decide(riverside, 1, { decision: 'Confirmed' }),
    kitchen.decide(riverside, 1, { decision: 'Rejected', reason: 'Too late' }),
  ]);
  assert.equal(results[0].status, 'fulfilled');
  assert.equal(results[1].reason.code, 'ORDER_UNAVAILABLE');
  assert.throws(() => other.details(riverside, 1), errorCode('ORDER_UNAVAILABLE'));
  assert.equal(attempts, 1);
  assert.equal(db.prepare('SELECT decision FROM order_decisions WHERE order_id=1').get().decision, 'Confirmed');
});

test('audit write failure rolls back status and creates no notification', async t => {
  const { db, kitchen } = setup(t);
  db.exec("CREATE TRIGGER fail_decision BEFORE INSERT ON order_decisions BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END");
  await assert.rejects(kitchen.decide(riverside, 1, { decision: 'Confirmed' }), /audit unavailable/);
  unchanged(db);
});

test('notification exception preserves saved decision and durable failed flag', async t => {
  const { db, kitchen } = setup(t, () => { throw new Error('Notification transport unavailable'); });
  const result = await kitchen.decide(riverside, 1, { decision: 'Rejected', reason: 'Out of stock' });
  assert.equal(result.status, 'Rejected');
  assert.equal(result.notificationStatus, 'failed');
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=1').get().status, 'Rejected');
  assert.equal(db.prepare('SELECT status FROM customer_notifications WHERE order_id=1').get().status, 'failed');
});

test('missing and invalid order IDs return domain errors without writes', async t => {
  const { db, kitchen } = setup(t);
  assert.throws(() => kitchen.details(riverside, 9999), errorCode('NOT_FOUND'));
  for (const id of [0, -1, NaN, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(kitchen.decide(riverside, id, { decision: 'Confirmed' }), errorCode('INVALID_ORDER'));
  }
  unchanged(db);
});

test('UC1 checkout appears in the assigned UC2 queue and can be decided with its original totals', async t => {
  const { db, kitchen } = setup(t);
  const input = { checkoutRef: 'uc1-uc2-integration', hubId: 1, brandId: 1, areaId: 1,
    address: 'Integration address', items: [{ itemId: 1, quantity: 2 }], voucherCode: 'DEMO10', method: 'cod' };
  const quote = quoteOrder(db, input);
  const receipt = submitCheckout(db, demoCustomer(db, 'customer'), { ...input, expectedTotal: quote.total });
  const queue = kitchen.queue(benThanh).orders;
  assert.equal(queue.length, 1);
  assert.equal(queue[0].id, receipt.orderId);
  assert.equal(queue[0].itemCount, 2);
  assert.equal(queue[0].total, 105000);
  assert.equal(kitchen.queue(riverside).orders.some(o => o.id === receipt.orderId), false);
  await kitchen.decide(benThanh, receipt.orderId, { decision: 'Confirmed' });
  assert.equal(kitchen.queue(benThanh).orders.length, 0);
});
