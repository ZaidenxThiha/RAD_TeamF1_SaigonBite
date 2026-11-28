// UC2 domain/controller operations. Author: Thin Lei Sandi (523K0075).
import { KitchenRepository } from './repository.mjs';

export class KitchenError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class KitchenService {
  constructor(db, notify = () => 'sent') {
    this.repo = new KitchenRepository(db);
    // Local notification simulator; no external customer messages are sent.
    this.notify = notify;
  }

  staff(username) {
    const staff = typeof username === 'string' && this.repo.staff(username);
    if (!staff || staff.role !== 'kitchen' || !staff.hubId) {
      throw new KitchenError('Access denied: kitchen staff only.', 403, 'ACCESS_DENIED');
    }
    return staff;
  }

  order(username, id, submitted = true) {
    const staff = this.staff(username);
    if (!Number.isSafeInteger(id) || id < 1) {
      throw new KitchenError('Choose a valid order.', 400, 'INVALID_ORDER');
    }
    const order = this.repo.order(id);
    if (!order) throw new KitchenError('Order not found.', 404, 'NOT_FOUND');
    if (order.hubId !== staff.hubId) {
      throw new KitchenError('This order is outside your assigned hub.', 403, 'ACCESS_DENIED');
    }
    if (submitted && order.status !== 'Submitted') {
      throw new KitchenError('This order is no longer Submitted. Refresh the incoming queue.', 409, 'ORDER_UNAVAILABLE');
    }
    return { staff, order };
  }

  queue(username) {
    const staff = this.staff(username);
    return { staff, orders: this.repo.queue(staff.hubId) };
  }

  details(username, id) {
    const { order } = this.order(username, id);
    return { ...order, items: this.repo.items(id) };
  }

  async decide(username, id, input) {
    const saved = this.repo.transaction(() => {
      // Resolve identity, hub and status again at save time inside the write transaction.
      const { staff, order } = this.order(username, id);
      const status = input?.decision;
      if (!['Confirmed', 'Rejected'].includes(status)) {
        throw new KitchenError('Choose Confirmed or Rejected.', 422, 'INVALID_DECISION');
      }
      const reason = typeof input.reason === 'string' ? input.reason.trim() : '';
      if (status === 'Rejected' && (!reason || reason.length > 1000)) {
        throw new KitchenError('Enter a rejection reason of 1 to 1000 characters.', 422, 'REASON_REQUIRED');
      }
      this.repo.record(id, staff.id, status, status === 'Rejected' ? reason : null);
      return { ...this.repo.decision(id), hubName: order.hubName };
    });

    let notificationStatus = 'failed';
    try {
      if (await this.notify(saved) === 'sent') notificationStatus = 'sent';
      this.repo.notification(id, notificationStatus);
    } catch {
      // The decision already committed. Leave the durable failed notification flag.
      notificationStatus = 'failed';
    }
    return { ...saved, notificationStatus };
  }
}
