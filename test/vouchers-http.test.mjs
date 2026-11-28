// UC3 boundary and workflow tests. Author: Thin Lei Sandi (523K0075).
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { createVoucherHandler } from '../src/uc3/http.mjs';
async function setup(t) {
  const db = openDatabase(':memory:'); const handler = createVoucherHandler(db);
  const server = createServer((req, res) => void handler(req, res));
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(async () => { await new Promise(resolve => server.close(resolve)); db.close(); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = async (path = '', method = 'GET', body, actor = 'administrator', type = 'application/json') => {
    const response = await fetch(base + '/api/vouchers' + path, { method,
      headers: { 'X-Demo-User': actor, 'Content-Type': type },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    return { status: response.status, cache: response.headers.get('cache-control'), body: await response.json() };
  };
  const today = (await request()).body.today;
  return { db, request, value: { code: 'HTTP15', discountType: 'percent', discountValue: 15, startsOn: today, endsOn: today, minimumSubtotal: 0, hubId: null } };
}
test('HTTP create, edit, archive and read use the same persisted voucher with no-store responses', async t => {
  const { request, value } = await setup(t);
  const created = await request('', 'POST', value); assert.equal(created.status, 201); assert.equal(created.cache, 'no-store');
  const path = `/${created.body.id}`;
  const edited = await request(path, 'PUT', { ...value, discountValue: 20 }); assert.equal(edited.body.discountValue, 20);
  assert.equal((await request(path + '/archive', 'POST', { confirmed: false })).status, 422);
  const archived = await request(path + '/archive', 'POST', { confirmed: true }); assert.equal(archived.body.status, 'Archived');
  assert.equal((await request(path, 'PUT', value)).status, 409);
  assert.equal((await request(path + '/archive', 'POST', { confirmed: true })).status, 409);
  assert.equal((await request(path)).body.history.length, 3);
});
test('HTTP rejects malformed, oversized and unauthorized writes without changing stored records', async t => {
  const { request, value, db } = await setup(t);
  for (const actor of ['', 'customer', 'manager', 'kitchen-riverside']) {
    assert.equal((await request('', 'GET', undefined, actor)).status, 403);
    assert.equal((await request('', 'POST', { ...value, actorId: 5, role: 'admin' }, actor)).status, 403);
    assert.equal((await request('/1', 'PUT', value, actor)).status, 403);
    assert.equal((await request('/1/archive', 'POST', { confirmed: true }, actor)).status, 403);
  }
  for (const malformed of ['{', '[]', 'null']) assert.equal((await request('', 'POST', malformed)).status, 400);
  assert.equal((await request('', 'POST', value, 'administrator', 'text/plain')).status, 415);
  assert.equal((await request('', 'POST', { ...value, code: 'X'.repeat(17000) })).status, 413);
  const invalid = await request('', 'POST', { ...value, discountValue: 101 });
  assert.equal(invalid.status, 422); assert.ok(invalid.body.fields.discountValue);
  assert.equal((await request('/9999')).status, 404);
  assert.equal((await request('/1', 'DELETE')).status, 404);
  assert.equal(db.prepare('SELECT count(*) AS n FROM vouchers').get().n, 2);
  assert.equal(db.prepare('SELECT count(*) AS n FROM voucher_audit').get().n, 2);
});
