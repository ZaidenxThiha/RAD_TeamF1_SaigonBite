import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';

test('management reports enforce manager access and use Vietnam date boundaries', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'saigonbite-reports-'));
  let processHandle;
  let exited;
  t.after(async () => {
    try {
      if (processHandle) {
        processHandle.kill();
        await exited;
      }
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
  const filename = join(directory, 'test.sqlite');
  const db = openDatabase(filename);
  try {
    db.exec(`
      UPDATE orders SET created_at = '2026-11-27 17:00:00' WHERE id IN (1, 2);
      UPDATE orders SET created_at = '2026-11-28 17:00:00' WHERE id = 3;
      UPDATE deliveries SET occurred_at = '2026-11-28 16:59:59' WHERE order_id IN (2, 3);
    `);
  } finally {
    db.close();
  }
  processHandle = spawn(process.execPath, ['src/server.mjs'], {
    env: { ...process.env, PORT: '0', SAIGONBITE_DB: filename, SAIGONBITE_MANAGER_PASSWORD: 'report-test' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  exited = once(processHandle, 'exit');
  const [ready] = await Promise.race([
    once(processHandle.stdout, 'data'),
    exited.then(() => { throw new Error('Report server stopped before listening.'); }),
  ]);
  const base = String(ready).match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  const auth = (user, password = 'report-test') => ({
    Authorization: 'Basic ' + Buffer.from(user + ':' + password).toString('base64'),
  });
  const url = base + '/reports?from=2026-11-28&to=2026-11-28';
  assert.equal((await fetch(url)).status, 401);
  assert.equal((await fetch(url, { headers: auth('manager', 'wrong') })).status, 401);
  assert.equal((await fetch(url, { headers: auth('customer') })).status, 403);
  const headers = auth('manager');

  const sales = await fetch(url, { headers });
  assert.equal(sales.status, 200);
  const salesPage = await sales.text();
  assert.match(salesPage, /Total sales<\/dt><dd>65\.000/);
  assert.match(salesPage, /Confirmed orders<\/dt><dd>1/);
  assert.match(salesPage, />#2<\/th>/);
  assert.doesNotMatch(salesPage, />#[13]<\/th>/);

  const workload = await (await fetch(url + '&type=workload', { headers })).text();
  assert.match(workload, /Riverside<\/th><td>1<\/td><td>0<\/td><td>0<\/td><td>1<\/td>/);
  assert.match(workload, /Bến Thành<\/th><td>0<\/td><td>1<\/td><td>0<\/td><td>1<\/td>/);
  const delivery = await (await fetch(url + '&type=delivery&hub=1', { headers })).text();
  assert.match(delivery, /Bến Thành<\/th><td>1<\/td><td>1<\/td><td>2<\/td>/);
  const empty = await (await fetch(url + '&hub=2', { headers })).text();
  assert.match(empty, /No records match/);

  for (const query of ['from=2026-11-29&to=2026-11-28', 'from=2026-02-30', 'hub=99', 'type=invalid']) {
    const invalid = await fetch(base + '/reports?' + query, { headers });
    assert.equal(invalid.status, 400);
    assert.match(await invalid.text(), /role="alert"/);
  }
});
