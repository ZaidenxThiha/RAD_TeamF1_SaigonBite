// UC3 voucher persistence. Author: Thin Lei Sandi (523K0075).
export class VoucherRepository {
  constructor(db) { this.db = db; }
  actor(username) {
    return this.db.prepare("SELECT id, username FROM users WHERE username = ? AND role = 'admin'").get(username ?? null);
  }
  hubs() { return this.db.prepare('SELECT id, name FROM hubs ORDER BY name').all(); }
  all() { return this.db.prepare('SELECT * FROM vouchers ORDER BY id DESC').all(); }
  find(id) { return this.db.prepare('SELECT * FROM vouchers WHERE id = ?').get(id); }
  duplicate(code, except = 0) {
    return this.db.prepare('SELECT id FROM vouchers WHERE code = ? AND id <> ?').get(code, except);
  }
  create(v) {
    return Number(this.db.prepare(`INSERT INTO vouchers
      (code, discount_type, discount_value, starts_on, ends_on, minimum_subtotal_vnd, hub_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)`).run(...this.values(v)).lastInsertRowid);
  }
  update(id, v) {
    this.db.prepare(`UPDATE vouchers SET code=?, discount_type=?, discount_value=?, starts_on=?,
      ends_on=?, minimum_subtotal_vnd=?, hub_id=? WHERE id=?`).run(...this.values(v), id);
  }
  values(v) { return [v.code, v.discountType, v.discountValue, v.startsOn, v.endsOn, v.minimumSubtotal, v.hubId]; }
  archive(id, at) { this.db.prepare('UPDATE vouchers SET archived_at=? WHERE id=?').run(at, id); }
  audit(id, actor, action, at) {
    this.db.prepare('INSERT INTO voucher_audit (voucher_id, actor_id, action, occurred_at) VALUES (?, ?, ?, ?)')
      .run(id, actor, action, at);
  }
  history(id) {
    return this.db.prepare(`SELECT a.action, a.occurred_at AS occurredAt, u.username AS administrator
      FROM voucher_audit a JOIN users u ON u.id=a.actor_id WHERE a.voucher_id=? ORDER BY a.id DESC`).all(id);
  }
  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = work(); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
}
