// UC2 HTTP boundary tests. Author: 523K0075.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { createKitchenHandler } from '../src/uc2/http.mjs';

async function setup(t) {
  const db = openDatabase(':memory:');
  const handler = createKitchenHandler(db);
  const server = createServer((req, res) => { void handler(req, res); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    db.close();
  });
  const root = `http://127.0.0.1:${server.address().port}/api/kitchen/orders`;
  const get = (path = '', user = 'kitchen-riverside') => fetch(root + path, { headers: { 'X-Demo-User': user } });
  const post = (body, headers = {}) => fetch(root + '/1/decision', { method: 'POST',
    headers: { 'X-Demo-User': 'kitchen-riverside', 'Content-Type': 'application/json', ...headers }, body });
  return { get, post, db, root };
}

test('HTTP enforces account, hub, decision validation and stale-order responses', async t => {
  const { get, post, db, root } = await setup(t);
  assert.equal((await fetch(root)).status, 403);
  assert.equal((await get('', 'administrator')).status, 403);
  assert.equal((await get('/1', 'kitchen-ben-thanh')).status, 403);
  const queue = await get();
  assert.equal(queue.headers.get('cache-control'), 'no-store');
  assert.equal((await queue.json()).orders[0].id, 1);
  assert.equal((await get('/999')).status, 404);
  const invalid = await post(JSON.stringify({ decision: 'Rejected', reason: '  ' }));
  assert.equal(invalid.status, 422);
  assert.equal((await invalid.json()).code, 'REASON_REQUIRED');
  const saved = await post(JSON.stringify({ decision: 'Confirmed', staffId: 3, hubId: 1 }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).staffId, 4);
  assert.equal((await get('/1')).status, 409);
  assert.equal((await post(JSON.stringify({ decision: 'Confirmed' }))).status, 409);
  assert.equal(db.prepare('SELECT count(*) AS n FROM order_decisions WHERE order_id=1').get().n, 1);
});

test('HTTP rejects malformed JSON, wrong types, wrong media and oversized bodies without saving', async t => {
  const { post, db } = await setup(t);
  assert.equal((await post('{')).status, 400);
  assert.equal((await post('[]')).status, 400);
  assert.equal((await post('null')).status, 400);
  assert.equal((await post('{}', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(JSON.stringify({ reason: 'x'.repeat(17000) }))).status, 413);
  assert.equal(db.prepare('SELECT status FROM orders WHERE id=1').get().status, 'Submitted');
});
