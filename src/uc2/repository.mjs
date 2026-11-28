// UC2 data access. Author: Thin Lei Sandi (523K0075).
export class KitchenRepository {
  constructor(db) { this.db = db; }

  staff(username) {
    return this.db.prepare(`SELECT u.id, u.username, u.role, u.hub_id AS hubId, h.name AS hubName
      FROM users u LEFT JOIN hubs h ON h.id = u.hub_id WHERE u.username = ?`).get(username);
  }

  queue(hubId) {
    return this.db.prepare(`SELECT o.id, o.created_at AS submittedAt, o.total_vnd AS total,
      o.status, (SELECT sum(quantity) FROM order_items WHERE order_id = o.id) AS itemCount
      FROM orders o WHERE o.hub_id = ? AND o.status = 'Submitted'
      ORDER BY o.created_at, o.id`).all(hubId);
  }

  order(id) {
    return this.db.prepare(`SELECT o.id, o.hub_id AS hubId, h.name AS hubName, o.status,
      o.delivery_address AS address, o.created_at AS submittedAt,
      o.subtotal_vnd AS subtotal, o.delivery_fee_vnd AS deliveryFee,
      o.quiet_incentive_vnd AS incentive, o.voucher_discount_vnd AS discount,
      o.total_vnd AS total, p.method, p.status AS paymentStatus
      FROM orders o JOIN hubs h ON h.id = o.hub_id JOIN payments p ON p.id = o.payment_id
      WHERE o.id = ?`).get(id);
  }

  items(id) {
    return this.db.prepare(`SELECT item_name AS name, quantity, unit_price_vnd AS unitPrice
      FROM order_items WHERE order_id = ? ORDER BY menu_item_id`).all(id);
  }

  decision(id) {
    return this.db.prepare(`SELECT d.order_id AS orderId, d.staff_id AS staffId,
      d.decision AS status, d.rejection_reason AS reason, d.decided_at AS decidedAt,
      n.status AS notificationStatus FROM order_decisions d
      LEFT JOIN customer_notifications n ON n.order_id = d.order_id WHERE d.order_id = ?`).get(id);
  }

  record(id, staffId, status, reason) {
    const result = this.db.prepare(`UPDATE orders SET status = ?
      WHERE id = ? AND status = 'Submitted'`).run(status, id);
    if (result.changes !== 1) throw new Error('Order status changed during decision.');
    this.db.prepare(`INSERT INTO order_decisions (order_id, staff_id, decision, rejection_reason)
      VALUES (?, ?, ?, ?)`).run(id, staffId, status, reason);
    // A durable failure flag survives even if delivery is interrupted after commit.
    this.db.prepare(`INSERT INTO customer_notifications (order_id, status) VALUES (?, 'failed')`).run(id);
  }

  notification(id, status) {
    this.db.prepare(`UPDATE customer_notifications SET status = ?, attempted_at = CURRENT_TIMESTAMP
      WHERE order_id = ?`).run(status, id);
  }

  transaction(work) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }
}
