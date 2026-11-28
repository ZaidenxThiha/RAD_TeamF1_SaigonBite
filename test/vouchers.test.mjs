// UC3 regression coverage. Author: Thin Lei Sandi (523K0075).
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { openDatabase } from '../src/database.mjs';
import { VoucherService } from '../src/uc3/service.mjs';
import { demoCustomer, quoteOrder, submitCheckout } from '../src/checkout.mjs';
const admin = 'administrator';
const clock = () => new Date('2026-11-28T09:00:00Z');
const valid = () => ({ code: 'NEWYEAR', discountType: 'percent', discountValue: 15,
  startsOn: '2026-11-01', endsOn: '2027-01-31', minimumSubtotal: 0, hubId: null });
function setup(t) {
  const db = openDatabase(':memory:'); t.after(() => db.close());
  return { db, service: new VoucherService(db, clock) };
}
function count(db, table) { return db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n; }

test('administrator creates, lists and views normalized voucher with audited actor and time', t => {
  const { db, service } = setup(t);
  const v = service.save(admin, null, { ...valid(), code: '  newyear  ' });
  assert.equal(v.code, 'NEWYEAR'); assert.equal(v.status, 'Active');
  assert.equal(v.canEdit, true); assert.equal(v.canArchive, true);
  assert.deepEqual(v.history.map(entry => ({ ...entry })), [{ action: 'create', administrator: admin, occurredAt: clock().toISOString() }]);
  assert.ok(service.list(admin).vouchers.some(row => row.id === v.id));
  assert.equal(service.list(admin).hubs.length, 2);
  assert.equal(count(db, 'vouchers'), 3);
});

test('all operations deny non-administrators and ignore forged actor input', t => {
  const { db, service } = setup(t);
  for (const actor of [undefined, 'customer', 'tourist', 'manager', 'kitchen-ben-thanh', 'missing']) {
    for (const action of [() => service.list(actor), () => service.details(actor, 1),
      () => service.save(actor, null, { ...valid(), actorId: 5, role: 'admin' }),
      () => service.save(actor, 1, valid()), () => service.archive(actor, 1, { confirmed: true })]) {
      assert.throws(action, e => e.status === 403);
    }
  }
  assert.equal(count(db, 'vouchers'), 2); assert.equal(count(db, 'voucher_audit'), 2);
});

test('duplicate code is case-insensitive on create and update without partial writes', t => {
  const { db, service } = setup(t), v = service.save(admin, null, valid());
  const before = service.details(admin, v.id);
  assert.throws(() => service.save(admin, null, { ...valid(), code: 'newyear' }), e => !!e.fields.code);
  assert.throws(() => service.save(admin, v.id, { ...valid(), code: 'demo10' }), e => !!e.fields.code);
  assert.deepEqual(service.details(admin, v.id), before);
  assert.equal(count(db, 'vouchers'), 3);
});

test('invalid discounts, calendar dates, eligibility and empty fields save no voucher or audit', t => {
  const { db, service } = setup(t);
  for (const patch of [{ code: '' }, { code: '<script>' }, { code: 'A'.repeat(81) },
    { discountType: 'other' }, { discountValue: 0 }, { discountValue: -1 }, { discountValue: 101 },
    { discountValue: 1.5 }, { discountValue: '10' }, { discountValue: Number.MAX_SAFE_INTEGER + 1 },
    { startsOn: '' }, { startsOn: '2026-02-30' }, { endsOn: '2026-11-31' },
    { startsOn: '2027-02-01' }, { minimumSubtotal: -1 }, { minimumSubtotal: null },
    { hubId: 999 }, { hubId: '1' }, { endsOn: '2026-11-27' }]) {
    assert.throws(() => service.save(admin, null, { ...valid(), ...patch }), e => e.status === 422);
  }
  assert.equal(count(db, 'vouchers'), 2); assert.equal(count(db, 'voucher_audit'), 2);
});

test('expiry uses inclusive Vietnam date and expired voucher can be extended to Active', t => {
  const { db } = setup(t);
  let now = new Date('2026-11-28T16:59:59Z');
  const service = new VoucherService(db, () => now);
  const v = service.save(admin, null, { ...valid(), endsOn: '2026-11-28' });
  assert.equal(v.status, 'Active');
  now = new Date('2026-11-28T17:00:00Z');
  const expired = service.details(admin, v.id);
  assert.equal(expired.status, 'Expired'); assert.equal(expired.canEdit, true); assert.equal(expired.canArchive, false);
  assert.throws(() => service.archive(admin, v.id, { confirmed: true }), e => e.status === 409);
  const updated = service.save(admin, v.id, { ...valid(), endsOn: '2027-01-31' });
  assert.equal(updated.status, 'Active'); assert.equal(updated.history[0].action, 'update');
});

test('archive requires explicit confirmation and leaves archived vouchers view-only', t => {
  const { db, service } = setup(t), v = service.save(admin, null, valid());
  for (const confirmed of [false, undefined, 'true', 1]) assert.throws(() => service.archive(admin, v.id, { confirmed }), e => e.status === 422);
  assert.equal(service.details(admin, v.id).status, 'Active');
  const archived = service.archive(admin, v.id, { confirmed: true });
  assert.equal(archived.status, 'Archived'); assert.equal(archived.canEdit, false); assert.equal(archived.canArchive, false);
  assert.throws(() => service.save(admin, v.id, valid()), e => e.status === 409);
  assert.throws(() => service.archive(admin, v.id, { confirmed: true }), e => e.status === 409);
  assert.equal(service.details(admin, v.id).history.length, 2);
  assert.equal(count(db, 'vouchers'), 3);
});

test('save-time role and archive state are rechecked after a stale editor was opened', t => {
  const { db, service } = setup(t), v = service.save(admin, null, valid());
  service.details(admin, v.id);
  service.archive(admin, v.id, { confirmed: true });
  assert.throws(() => service.save(admin, v.id, { ...valid(), discountValue: 50 }), e => e.status === 409);
  db.exec("UPDATE users SET role='manager' WHERE username='administrator'");
  assert.throws(() => service.save(admin, null, { ...valid(), code: 'DENIED' }), e => e.status === 403);
  assert.equal(count(db, 'vouchers'), 3);
});

test('audit failure rolls back creation, update and archive together with the data write', t => {
  const { db, service } = setup(t), v = service.save(admin, null, valid());
  const before = service.details(admin, v.id);
  db.exec("CREATE TRIGGER fail_voucher_audit BEFORE INSERT ON voucher_audit BEGIN SELECT RAISE(ABORT, 'audit unavailable'); END;");
  assert.throws(() => service.save(admin, null, { ...valid(), code: 'ROLLBACK' }), /audit unavailable/);
  assert.throws(() => service.save(admin, v.id, { ...valid(), discountValue: 20 }), /audit unavailable/);
  assert.throws(() => service.archive(admin, v.id, { confirmed: true }), /audit unavailable/);
  assert.equal(count(db, 'vouchers'), 3); assert.deepEqual(service.details(admin, v.id), before);
});

test('missing voucher and invalid ID have explicit errors', t => {
  const { service } = setup(t);
  for (const action of [() => service.details(admin, 999), () => service.save(admin, 999, valid()),
    () => service.archive(admin, 999, { confirmed: true })]) assert.throws(action, e => e.status === 404);
  assert.throws(() => service.details(admin, 0), e => e.status === 422);
});

test('UC3 changes affect UC1 eligibility and new pricing while historical order totals and links survive archive', t => {
  const { db } = setup(t), service = new VoucherService(db);
  const today = service.list(admin).today;
  const fields = { ...valid(), startsOn: today, endsOn: today, minimumSubtotal: 100000, hubId: 1 };
  const v = service.save(admin, null, fields);
  const input = { hubId: 1, brandId: 1, areaId: 1, address: 'UC3 integration address',
    items: [{ itemId: 1, quantity: 2 }], voucherCode: v.code, checkoutRef: 'uc3-voucher-history', method: 'cod' };
  assert.equal(quoteOrder(db, input).voucherDiscount, 15000);
  assert.throws(() => quoteOrder(db, { ...input, items: [{ itemId: 1, quantity: 1 }] }), /conditions/);
  const receipt = submitCheckout(db, demoCustomer(db, 'customer'), { ...input, expectedTotal: quoteOrder(db, input).total });
  service.save(admin, v.id, { ...fields, discountType: 'fixed', discountValue: 20000 });
  assert.equal(quoteOrder(db, input).voucherDiscount, 20000);
  service.archive(admin, v.id, { confirmed: true });
  assert.throws(() => quoteOrder(db, input), /unavailable/);
  const history = db.prepare('SELECT voucher_id, total_vnd, voucher_discount_vnd FROM orders WHERE id=?').get(receipt.orderId);
  assert.equal(history.voucher_id, v.id); assert.equal(history.total_vnd, receipt.total); assert.equal(history.voucher_discount_vnd, 15000);
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
});

test('UC1 rejects expired, future-dated and wrong-hub vouchers maintained by UC3', t => {
  const { db } = setup(t), service = new VoucherService(db);
  const today = service.list(admin).today;
  const input = { hubId: 1, brandId: 1, areaId: 1, address: 'Eligibility checks', items: [{ itemId: 1, quantity: 2 }], voucherCode: 'WRONGHUB' };
  service.save(admin, null, { ...valid(), code: 'WRONGHUB', startsOn: today, endsOn: '2099-12-31', hubId: 2 });
  assert.throws(() => quoteOrder(db, input), /conditions/);
  const v = service.save(admin, null, { ...valid(), code: 'FUTURE', startsOn: '2099-01-01', endsOn: '2099-12-31' });
  assert.throws(() => quoteOrder(db, { ...input, voucherCode: v.code }), /validity/);
  service.save(admin, v.id, { ...valid(), code: 'FUTURE', startsOn: '2020-01-01', endsOn: '2020-12-31' });
  assert.throws(() => quoteOrder(db, { ...input, voucherCode: v.code }), /validity/);
});
