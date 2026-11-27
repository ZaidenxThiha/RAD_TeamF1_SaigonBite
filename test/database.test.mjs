import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';

test('initialization seeds a fresh database and preserves changes on reopen', (t) => {
  const directory = mkdtempSync(join(tmpdir(), 'saigonbite-'));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const filename = join(directory, 'test.sqlite');
  const first = openDatabase(filename);
  try {
    assert.equal(first.prepare('SELECT count(*) AS count FROM orders').get().count, 3);
    first.exec("UPDATE orders SET delivery_address = 'Updated sample address' WHERE id = 1");
  } finally {
    first.close();
  }

  const second = openDatabase(filename);
  try {
    assert.equal(second.prepare('SELECT count(*) AS count FROM orders').get().count, 3);
    assert.equal(second.prepare('SELECT delivery_address FROM orders WHERE id = 1').get().delivery_address,
      'Updated sample address');
    assert.deepEqual(second.prepare('PRAGMA foreign_key_check').all(), []);
  } finally {
    second.close();
  }
});

test('invalid order, hub and payment relationships are rejected', () => {
  const db = openDatabase(':memory:');
  try {
    assert.throws(() => db.exec("INSERT INTO order_items VALUES (999, 1, 'Phở bò', 1, 50000)"), /FOREIGN KEY/);
    assert.throws(() => db.exec('UPDATE orders SET hub_id = 999 WHERE id = 1'), /FOREIGN KEY/);
    assert.throws(() => db.exec('UPDATE orders SET customer_id = 2 WHERE id = 1'), /FOREIGN KEY/);
    assert.throws(() => db.exec('UPDATE orders SET payment_id = 2 WHERE id = 1'), /UNIQUE/);
  } finally {
    db.close();
  }
});
