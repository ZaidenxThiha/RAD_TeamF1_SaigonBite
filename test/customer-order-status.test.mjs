// UC1 -> UC2 -> customer receipt regression. Author: 523K0075.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { handleCheckout } from '../src/checkout-http.mjs';
import { createKitchenHandler } from '../src/uc2/http.mjs';

async function setup(t) {
  const db = openDatabase(':memory:');
  const kitchen = createKitchenHandler(db);
  const server = createServer((req, res) => {
    if (req.url.startsWith('/api/kitchen/')) void kitchen(req, res);
    else void handleCheckout(db, req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.close();
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = async (path, input, headers = {}) => {
    const response = await fetch(base + path, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(input) });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  const input = { username: 'customer', checkoutRef: 'customer-status-integration', hubId: 1, brandId: 1,
    areaId: 1, address: 'Status integration address', items: [{ itemId: 1, quantity: 2 }],
    voucherCode: 'DEMO10', method: 'cod' };
  const quote = await post('/api/checkout/quote', input);
  assert.equal(quote.status, 200);
  const placed = await post('/api/checkout/submit', { ...input, expectedTotal: quote.body.total });
  assert.equal(placed.status, 200);
  return { db, post, orderId: placed.body.orderId,
    owner: { username: input.username, checkoutRef: input.checkoutRef, orderId: placed.body.orderId } };
}

for (const decision of ['Confirmed', 'Rejected']) {
  test(`customer refresh reads ${decision} for the same UC1 order after UC2 decides it`, async t => {
    const { db, post, orderId, owner } = await setup(t);
    const before = await post('/api/checkout/status', owner);
    assert.equal(before.body.status, 'Submitted');
    const saved = await post(`/api/kitchen/orders/${orderId}/decision`,
      { decision, reason: 'Out of ingredients' }, { 'X-Demo-User': 'kitchen-ben-thanh' });
    assert.equal(saved.status, 200);
    const refreshed = await post('/api/checkout/status', owner);
    assert.equal(refreshed.status, 200);
    assert.equal(refreshed.cache, 'no-store');
    assert.equal(refreshed.body.orderId, orderId);
    assert.equal(refreshed.body.status, decision);
    assert.equal(refreshed.body.total, 105000);
    assert.equal(refreshed.body.rejectionReason, decision === 'Rejected' ? 'Out of ingredients' : null);
    assert.equal(db.prepare('SELECT count(*) AS n FROM orders').get().n, 4);
    assert.equal(db.prepare('SELECT count(*) AS n FROM payments').get().n, 4);
  });
}

test('status lookup requires the owner and checkout reference and does not expose other orders', async t => {
  const { db, post, owner } = await setup(t);
  const otherCustomer = await post('/api/checkout/status', { ...owner, username: 'tourist' });
  const otherReference = await post('/api/checkout/status', { ...owner, checkoutRef: 'wrong-reference' });
  const otherOrder = await post('/api/checkout/status', { ...owner, orderId: 1 });
  const missing = await post('/api/checkout/status', { ...owner, orderId: 9999 });
  for (const response of [otherCustomer, otherReference, otherOrder, missing]) {
    assert.equal(response.status, 404);
    assert.deepEqual(response.body, missing.body);
    assert.equal(Object.hasOwn(response.body, 'total'), false);
  }
  assert.equal((await post('/api/checkout/status', { ...owner, username: 'administrator' })).status, 403);
  assert.equal((await post('/api/checkout/status', { ...owner, orderId: 0 })).status, 422);
  assert.equal((await post('/api/checkout/status', { username: 'customer', orderId: owner.orderId })).status, 422);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=?').get(owner.orderId).status, 'Submitted');
});
