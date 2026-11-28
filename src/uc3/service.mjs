// UC3 rules and authorization. Author: Thin Lei Sandi (523K0075).
import { VoucherRepository } from './repository.mjs';

export class VoucherError extends Error {
  constructor(message, status = 422, code = 'INVALID_INPUT', fields = {}) {
    super(message); Object.assign(this, { status, code, fields });
  }
}
const vietnamDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
});
function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01') return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export class VoucherService {
  constructor(db, clock = () => new Date()) { this.repo = new VoucherRepository(db); this.clock = clock; }
  admin(username) {
    const actor = this.repo.actor(typeof username === 'string' ? username : null);
    if (!actor) throw new VoucherError('Administrators only.', 403, 'ACCESS_DENIED');
    return actor;
  }
  current(id) {
    if (!Number.isSafeInteger(id) || id < 1) throw new VoucherError('Choose a valid voucher.');
    const voucher = this.repo.find(id);
    if (!voucher) throw new VoucherError('This voucher could not be found.', 404, 'NOT_FOUND');
    return voucher;
  }
  present(v, today) {
    const status = v.archived_at ? 'Archived' : v.ends_on < today ? 'Expired' : 'Active';
    return { id: v.id, code: v.code, discountType: v.discount_type, discountValue: v.discount_value,
      startsOn: v.starts_on, endsOn: v.ends_on, minimumSubtotal: v.minimum_subtotal_vnd,
      hubId: v.hub_id, archivedAt: v.archived_at, status,
      canEdit: status !== 'Archived', canArchive: status === 'Active' };
  }
  list(username) {
    const actor = this.admin(username), today = vietnamDate.format(this.clock());
    return { actor, today, hubs: this.repo.hubs(), vouchers: this.repo.all().map(v => this.present(v, today)) };
  }
  details(username, id) {
    this.admin(username);
    return { ...this.present(this.current(id), vietnamDate.format(this.clock())), history: this.repo.history(id) };
  }
  validate(input, id = 0) {
    const fields = {};
    const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
    if (!/^[A-Z0-9][A-Z0-9_-]{0,79}$/.test(code)) fields.code = 'Use 1–80 letters, numbers, hyphens or underscores.';
    else if (this.repo.duplicate(code, id)) fields.code = 'This voucher code already exists.';
    if (!['fixed', 'percent'].includes(input.discountType)) fields.discountType = 'Choose a discount type.';
    if (!Number.isSafeInteger(input.discountValue) || input.discountValue < 1 ||
      (input.discountType === 'percent' && input.discountValue > 100)) {
      fields.discountValue = input.discountType === 'percent' ? 'Enter a whole percentage from 1 to 100.' : 'Enter a positive whole VND amount.';
    }
    if (!validDate(input.startsOn)) fields.startsOn = 'Enter a valid start date.';
    if (!validDate(input.endsOn)) fields.endsOn = 'Enter a valid end date.';
    if (!fields.startsOn && !fields.endsOn && input.endsOn < input.startsOn) fields.endsOn = 'End date must be on or after the start date.';
    if (!Number.isSafeInteger(input.minimumSubtotal) || input.minimumSubtotal < 0) fields.minimumSubtotal = 'Enter a nonnegative whole VND amount.';
    if (input.hubId !== null && (!Number.isSafeInteger(input.hubId) || !this.repo.hubs().some(h => h.id === input.hubId))) fields.hubId = 'Choose an available hub or all hubs.';
    if (Object.keys(fields).length) throw new VoucherError('Please correct the highlighted fields.', 422, 'VALIDATION_FAILED', fields);
    return { ...input, code };
  }
  save(username, id, input) {
    return this.repo.transaction(() => {
      const actor = this.admin(username);
      if (id !== null && this.current(id).archived_at) throw new VoucherError('Archived vouchers cannot be edited.', 409, 'ARCHIVED');
      const value = this.validate(input, id ?? 0);
      const at = this.clock();
      if (id === null && value.endsOn < vietnamDate.format(at)) {
        throw new VoucherError('A new voucher must not already be expired.', 422, 'VALIDATION_FAILED', { endsOn: 'Choose today or a later end date.' });
      }
      const action = id === null ? 'create' : 'update';
      if (id === null) id = this.repo.create(value); else this.repo.update(id, value);
      this.repo.audit(id, actor.id, action, at.toISOString());
      return this.details(username, id);
    });
  }
  archive(username, id, input) {
    return this.repo.transaction(() => {
      const actor = this.admin(username), current = this.current(id), at = this.clock();
      if (!this.present(current, vietnamDate.format(at)).canArchive) {
        throw new VoucherError('Only Active vouchers can be archived.', 409, 'CANNOT_ARCHIVE');
      }
      if (input.confirmed !== true) throw new VoucherError('Confirm before archiving this voucher.');
      this.repo.archive(id, at.toISOString());
      this.repo.audit(id, actor.id, 'archive', at.toISOString());
      return this.details(username, id);
    });
  }
}
