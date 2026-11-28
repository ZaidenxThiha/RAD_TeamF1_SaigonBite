import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

test('UC3 voucher, UC1 checkout, UC2 confirmation and UC4 report share an order and total', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'saigonbite-integration-'));
  const server = spawn(process.execPath, ['src/server.mjs'], {
    env: { ...process.env, PORT: '0', SAIGONBITE_DB: join(directory, 'test.sqlite'),
      SAIGONBITE_MANAGER_PASSWORD: 'integration-test', SAIGONBITE_NOTIFICATION_FAIL: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exited = once(server, 'exit');
  t.after(async () => {
    try {
      server.kill();
      await exited;
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  const [ready] = await Promise.race([
    once(server.stdout, 'data'),
    exited.then(() => { throw new Error('SaigonBite stopped before listening.'); }),
  ]);
  const base = String(ready).match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  const administrator = { 'X-Demo-User': 'administrator' };
  const kitchen = { 'X-Demo-User': 'kitchen-ben-thanh' };
  const wrongHub = { 'X-Demo-User': 'kitchen-riverside' };
  const manager = { Authorization: 'Basic ' + Buffer.from('manager:integration-test').toString('base64') };

  async function request(path, status, headers = {}, input) {
    const response = await fetch(base + path, input === undefined ? { headers } : {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    assert.equal(response.status, status, path);
    return response.headers.get('content-type')?.includes('application/json')
      ? response.json() : response.text();
  }

  const voucher = await request('/api/vouchers', 201, administrator, {
    code: 'SPRINT10', discountType: 'percent', discountValue: 10,
    startsOn: '2000-01-01', endsOn: '2099-12-31', minimumSubtotal: 100000, hubId: 1,
  });
  assert.equal(voucher.status, 'Active');
  assert.equal(voucher.history[0].administrator, 'administrator');

  const draft = {
    username: 'customer', checkoutRef: 'integration-sprint10', hubId: 1, brandId: 1,
    areaId: 1, address: '123 Central Saigon', items: [{ itemId: 1, quantity: 2 }],
    voucherCode: voucher.code, method: 'online',
  };
  const quote = await request('/api/checkout/quote', 200, {}, draft);
  assert.equal(quote.voucherDiscount, 10000);
  assert.equal(quote.total, 105000);
  const submitted = { ...draft, expectedTotal: quote.total };

  const declined = await request('/api/checkout/submit', 200, {}, { ...submitted, simulation: 'decline' });
  assert.equal(declined.status, 'PaymentDeclined');
  assert.equal((await request('/api/kitchen/orders', 200, kitchen)).orders.length, 0);

  const approved = { ...submitted, simulation: 'approve' };
  const receipt = await request('/api/checkout/submit', 200, {}, approved);
  assert.equal(receipt.status, 'Submitted');
  assert.equal(receipt.total, quote.total);
  assert.deepEqual(await request('/api/checkout/submit', 200, {}, approved), receipt);

  const queue = await request('/api/kitchen/orders', 200, kitchen);
  assert.equal(queue.orders.length, 1);
  assert.equal(queue.orders[0].id, receipt.orderId);
  assert.equal(queue.orders[0].total, receipt.total);
  const orderUrl = '/api/kitchen/orders/' + receipt.orderId;
  const decisionUrl = orderUrl + '/decision';
  await request(orderUrl, 403, wrongHub);
  const missingReason = await request(decisionUrl, 422, kitchen, { decision: 'Rejected', reason: ' ' });
  assert.equal(missingReason.code, 'REASON_REQUIRED');
  assert.equal((await request(orderUrl, 200, kitchen)).status, 'Submitted');
  const decision = await request(decisionUrl, 200, kitchen, { decision: 'Confirmed' });
  assert.equal(decision.orderId, receipt.orderId);
  assert.equal(decision.status, 'Confirmed');
  assert.equal((await request('/api/kitchen/orders', 200, kitchen)).orders.length, 0);

  const statusInput = { username: draft.username, checkoutRef: draft.checkoutRef, orderId: receipt.orderId };
  const confirmedReceipt = await request('/api/checkout/status', 200, {}, statusInput);
  assert.equal(confirmedReceipt.status, 'Confirmed');
  assert.equal(confirmedReceipt.total, receipt.total);

  const report = await request('/reports?type=sales&hub=1', 200, manager);
  const reference = 'SB-' + String(receipt.orderId).padStart(6, '0');
  assert.ok(report.includes(reference + '</th><td>Bến Thành</td><td>105.000'), 'Sales report lists the same order and total');
  const empty = await request('/reports?type=sales&hub=1&from=1900-01-01&to=1900-01-01', 200, manager);
  assert.match(empty, /No matching records/);

  const archived = await request('/api/vouchers/' + voucher.id + '/archive', 200, administrator, { confirmed: true });
  assert.equal(archived.status, 'Archived');
  const archivedQuote = await request('/api/checkout/quote', 422, {}, { ...draft, checkoutRef: 'integration-archived-voucher' });
  assert.match(archivedQuote.message, /voucher is unavailable/i);
  assert.deepEqual(await request('/api/checkout/status', 200, {}, statusInput), confirmedReceipt);
});
