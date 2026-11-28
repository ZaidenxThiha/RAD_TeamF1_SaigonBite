import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';

test('checkout and kitchen display the same padded order reference', { timeout: 45000 }, async t => {
  const directory = mkdtempSync(join(tmpdir(), 'saigonbite-browser-'));
  const server = spawn(process.execPath, ['src/server.mjs'], {
    env: { ...process.env, PORT: '0', SAIGONBITE_DB: join(directory, 'test.sqlite'),
      SAIGONBITE_NOTIFICATION_FAIL: '0' },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const exited = once(server, 'exit');
  let browser;
  t.after(async () => {
    try {
      await browser?.close();
    } finally {
      try {
        server.kill();
        await exited;
      } finally {
        rmSync(directory, { recursive: true, force: true });
      }
    }
  });
  const [ready] = await Promise.race([
    once(server.stdout, 'data'),
    exited.then(() => { throw new Error('SaigonBite stopped before listening.'); }),
  ]);
  const base = String(ready).match(/http:\/\/127\.0\.0\.1:\d+/)[0];
  browser = await chromium.launch();
  const context = await browser.newContext();
  context.setDefaultTimeout(8000);
  const button = (page, name) => page.getByRole('button', { name, exact: true });

  const checkout = await context.newPage();
  await checkout.goto(base);
  await button(checkout, 'Continue to menu →').click();
  await button(checkout, 'Add').click();
  await checkout.getByRole('dialog').getByRole('button', { name: 'View cart & delivery' }).click();
  await checkout.getByPlaceholder('Customer address').fill('123 Central Saigon');
  await button(checkout, 'Check eligibility').click();
  await checkout.getByRole('dialog').getByRole('button', { name: 'Continue to order review' }).click();
  await button(checkout, 'Confirm checkout →').click();

  const [submission] = await Promise.all([
    checkout.waitForResponse(response => new URL(response.url()).pathname === '/api/checkout/submit'),
    button(checkout, 'Continue →').click(),
  ]);
  assert.equal(submission.status(), 200);
  const receipt = await submission.json();
  assert.ok(Number.isSafeInteger(receipt.orderId) && receipt.orderId > 0);
  assert.equal(receipt.status, 'Submitted');
  const expectedReference = 'SB-' + String(receipt.orderId).padStart(6, '0');
  await checkout.getByRole('heading', { name: 'Order submitted!' }).waitFor();
  const displayedReference = await checkout.locator('.reference').innerText();
  assert.equal(displayedReference, expectedReference);

  const kitchen = await context.newPage();
  await kitchen.goto(base + '/kitchen');
  const orderRow = kitchen.getByRole('row').filter({
    has: kitchen.getByText(displayedReference, { exact: true }),
  });
  await orderRow.waitFor();
  await orderRow.getByRole('button', { name: 'Review order ' + displayedReference }).click();
  await kitchen.getByRole('heading', { name: 'Order ' + displayedReference, exact: true }).waitFor();
  await button(kitchen, 'Confirm order').click();
  await kitchen.getByRole('heading', { name: displayedReference + ' · Confirmed', exact: true }).waitFor();
});
