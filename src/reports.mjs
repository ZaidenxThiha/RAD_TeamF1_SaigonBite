import { createHash, timingSafeEqual } from 'node:crypto';

export const reportTypes = { sales: 'Sales', workload: 'Hub workload', delivery: 'Delivery performance' };
export const reportTimeZone = 'Asia/Ho_Chi_Minh';
const localDate = new Intl.DateTimeFormat('en-CA', { timeZone: reportTimeZone });
const day = 24 * 60 * 60 * 1000;
const offset = 7 * 60 * 60 * 1000;
const digest = value => createHash('sha256').update(value).digest();

export function managerAccess(db, authorization, password) {
  if (!password) return 503;
  if (!authorization?.startsWith('Basic ')) return 401;
  const credentials = Buffer.from(authorization.slice(6), 'base64').toString('utf8');
  const separator = credentials.indexOf(':');
  if (separator < 1 || !timingSafeEqual(digest(credentials.slice(separator + 1)), digest(password))) return 401;
  const username = credentials.slice(0, separator);
  return db.prepare('SELECT role FROM users WHERE username = ?').get(username)?.role === 'manager' ? 200 : 403;
}

export function defaultReportDates(now = new Date()) {
  return { from: localDate.format(new Date(now.getTime() - 6 * day)), to: localDate.format(now) };
}

function parseDate(value) {
  if (value.startsWith('0000-') || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return NaN;
  const date = new Date(value + 'T00:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date.getTime() : NaN;
}

function sqliteTime(time) {
  return new Date(time).toISOString().slice(0, 19).replace('T', ' ');
}

export function reportFilters(params, hubs, brands = []) {
  const defaults = defaultReportDates();
  const filters = {
    type: params.get('type') ?? 'sales',
    from: params.get('from') ?? defaults.from,
    to: params.get('to') ?? defaults.to,
    hub: params.get('hub') ?? '',
    brand: params.get('brand') ?? '',
    compare: params.get('compare') === '1',
  };
  const from = parseDate(filters.from);
  const to = parseDate(filters.to);
  let error;
  if (!Object.hasOwn(reportTypes, filters.type)) error = 'Choose a report type.';
  else if (!Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    error = 'Enter a valid date range with the start on or before the end.';
  } else if (filters.hub && !hubs.some(hub => String(hub.id) === filters.hub)) {
    error = 'Choose an available kitchen hub.';
  } else if (filters.brand && !brands.some(brand => String(brand.id) === filters.brand)) {
    error = 'Choose an available virtual brand.';
  }
  return { filters, error, start: error ? null : sqliteTime(from - offset),
    end: error ? null : sqliteTime(to + day - offset) };
}

export function runReport(db, { filters, start, end }) {
  const hub = filters.hub ? Number(filters.hub) : null;
  const params = [start, end];
  const predicates = [];
  if (hub !== null) {
    predicates.push('AND o.hub_id = ?');
    params.push(hub);
  }
  if (filters.brand) {
    predicates.push('AND o.brand_id = ?');
    params.push(Number(filters.brand));
  }
  const reportFilter = predicates.join(' ');
  if (filters.type === 'sales') {
    const orders = db.prepare(`
      SELECT o.id, h.name AS hub, o.total_vnd AS total,
        date(o.created_at, '+7 hours') AS day, d.outcome
      FROM orders o JOIN hubs h ON h.id = o.hub_id
      LEFT JOIN deliveries d ON d.order_id = o.id
      WHERE o.created_at >= ? AND o.created_at < ? AND o.status = 'Confirmed'
        ${reportFilter}
      ORDER BY o.created_at DESC, o.id DESC
    `).all(...params);
    return { orders, count: orders.length, total: orders.reduce((sum, order) => sum + order.total, 0) };
  }
  if (filters.type === 'workload') {
    const hubs = db.prepare(`
      SELECT h.name AS hub,
        SUM(o.status = 'Submitted') AS submitted,
        SUM(o.status = 'Confirmed') AS confirmed,
        SUM(o.status = 'Rejected') AS rejected,
        COUNT(*) AS total
      FROM orders o JOIN hubs h ON h.id = o.hub_id
      WHERE o.created_at >= ? AND o.created_at < ? ${reportFilter}
      GROUP BY h.id ORDER BY h.name
    `).all(...params);
    return { hubs, count: hubs.reduce((sum, row) => sum + row.total, 0) };
  }
  const hubs = db.prepare(`
    SELECT h.name AS hub, SUM(d.outcome = 'completed') AS completed,
      SUM(d.outcome = 'failed') AS failed, COUNT(*) AS total
    FROM deliveries d JOIN orders o ON o.id = d.order_id JOIN hubs h ON h.id = o.hub_id
    WHERE d.occurred_at >= ? AND d.occurred_at < ? ${reportFilter}
    GROUP BY h.id ORDER BY h.name
  `).all(...params);
  return { hubs, count: hubs.reduce((sum, row) => sum + row.total, 0) };
}

export function compareReport(db, criteria) {
  const start = Date.parse(criteria.start.replace(' ', 'T') + 'Z');
  const end = Date.parse(criteria.end.replace(' ', 'T') + 'Z');
  return runReport(db, { ...criteria, start: sqliteTime(start - (end - start)), end: criteria.start });
}
