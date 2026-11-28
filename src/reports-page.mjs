import { compareReport, managerAccess, reportFilters, reportTypes, runReport } from './reports.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const number = new Intl.NumberFormat('en-US');
const timestamp = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short' });
const labels = { ...reportTypes, sales: 'Sales report' };
const descriptions = {
  sales: 'Revenue, orders and average order value across your hubs.',
  workload: 'Compare order volume and current status by hub.',
  delivery: 'Review completion rates and delivery outcomes.',
};
const recent = [];
let reportCount = 0;

function link(label, href, variant = '') {
  return `<a class="${variant === 'text' ? 'text-link' : 'action ' + variant}" href="${escape(href)}">${escape(label)}</a>`;
}

function urlFor(filters, view, extra = {}) {
  const query = new URLSearchParams({
    view, type: filters.type, from: filters.from, to: filters.to,
    hub: filters.hub, brand: filters.brand, ...extra,
  });
  if (filters.compare) query.set('compare', '1');
  return '/reports?' + query;
}

function intro(title, detail, action) {
  return `<div class="page-intro"><div><h1>${escape(title)}</h1><p class="muted">${escape(detail)}</p></div>${action}</div>`;
}

function layout(content) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Management reports | SaigonBite</title><link rel="stylesheet" href="/shared/layout.css">
<link rel="stylesheet" href="/reports.css"><script type="module" src="/reports.js"></script></head>
<body><aside class="sidebar" data-sidebar></aside><div class="workspace"><header class="header" data-header></header>
<main class="reports-main" aria-label="Management reports">${content}</main></div></body></html>`;
}

function table(caption, headings, rows) {
  return `<div class="panel table-frame"><table>${caption ? `<caption>${caption}</caption>` : ''}
    <thead><tr>${headings.map(heading => `<th scope="col">${heading}</th>`).join('')}</tr></thead>
    <tbody>${rows.length ? rows.map(([label, ...values]) => `<tr><th scope="row">${escape(label)}</th>${
      values.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')
      : `<tr><td colspan="${headings.length}" class="empty-row">No reports generated yet.</td></tr>`}</tbody></table></div>`;
}

function tiles(items) {
  return `<dl class="tiles ${items.length === 4 ? 'four' : ''}">${items.map(([label, value, context]) =>
    `<div class="panel"><dt>${label}</dt><dd>${escape(value)}</dd>${context ? `<p class="eyebrow">${escape(context)}</p>` : ''}</div>`
  ).join('')}</dl>`;
}

function period(filters, hubs) {
  const selected = hubs.find(hub => String(hub.id) === filters.hub);
  return `${filters.from} — ${filters.to} · ${selected?.name || 'All hubs'}`;
}

function dashboard(hubs, filters) {
  const newest = recent[0];
  const rows = recent.map(report => `<tr><th scope="row">${escape(labels[report.filters.type])}</th>
    <td>${escape(report.period)}</td><td>${escape(timestamp.format(report.time))}</td><td>Ready</td>
    <td>${link('View report →', urlFor(report.filters, 'preview'), 'text')}</td></tr>`).join('');
  return intro('Reports & analytics', 'Track sales, hub workload and delivery performance across your workspace.',
    link('Create new report', urlFor(filters, 'criteria'), 'primary')) +
    tiles([['Reports generated', reportCount, 'This server session'], ['Active hubs', hubs.length, hubs.map(hub => hub.name).join(' · ')],
      ['Latest report', newest ? timestamp.format(newest.time) : 'No reports yet', newest && labels[newest.filters.type]]]) +
    '<h2>Start with a report</h2><p class="muted">Choose a report type to define the data you want to review.</p>' +
    `<div class="tiles start-cards">${Object.entries(labels).map(([type, label], index) =>
      `<article class="panel"><p class="eyebrow">${['Popular', 'Operations', 'Delivery'][index]}</p><h3>${label}</h3>
      <p class="micro">${descriptions[type]}</p>${link('Create report →', urlFor({ ...filters, type }, 'criteria'), 'text')}</article>`
    ).join('')}</div><div class="section-heading"><h2>Recent reports</h2></div>
    <div class="panel table-frame"><table><thead><tr><th>Report</th><th>Period and hub</th><th>Generated</th><th>Status</th><th>Action</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="empty-row">No reports generated yet.</td></tr>'}</tbody></table></div>`;
}

function option(value, label, selected) {
  return `<option value="${escape(value)}"${String(value) === selected ? ' selected' : ''}>${escape(label)}</option>`;
}

function criteriaPage(filters, hubs, brands, error) {
  const typeOptions = Object.entries(labels).map(([key, label]) => option(key, label, filters.type)).join('');
  const sampleDate = '2000-01-01';
  const highlights = {
    sales: ['Confirmed sales and order volume', 'Average order value', 'Hub-level sales breakdown'],
    workload: ['Order volumes by hub', 'Submitted, confirmed and rejected counts'],
    delivery: ['Completed and failed deliveries', 'Delivery outcomes by hub'],
  };
  const tests = [
    ['Test invalid dates', urlFor({ ...filters, from: '2026-05-31', to: '2026-05-01' }, 'preview')],
    ['Preview empty state', urlFor({ ...filters, from: sampleDate, to: sampleDate }, 'preview')],
    ['Preview error state', urlFor(filters, 'preview', { example: 'error' })],
  ];
  return intro('Create a report', error ? 'Review the criteria to continue.' : 'Select a report type and define the reporting period.',
    link(error ? 'Back to reports' : 'Cancel', '/reports')) +
    `<div class="grid criteria-grid"><form class="panel" action="/reports" method="get" id="report-criteria">
      <input type="hidden" name="view" value="preview">
      <div class="criteria-fields"><div class="field-pair"><label class="field">Report type<select name="type">${typeOptions}</select></label></div>
      <div class="field-pair"><label class="field">Start date<input type="date" id="report-from" name="from" value="${escape(filters.from)}" required></label>
        <label class="field">End date<input type="date" name="to" value="${escape(filters.to)}" required></label></div>
      <div class="field-pair"><label class="field">Hub<select name="hub">${option('', 'All hubs', filters.hub)}${
        hubs.map(hub => option(hub.id, hub.name, filters.hub)).join('')}</select></label>
      <label class="field">Virtual brand<select name="brand">${option('', 'All brands', filters.brand)}${
        brands.map(brand => option(brand.id, brand.name, filters.brand)).join('')}</select></label></div>
      <label class="check-label"><input type="checkbox" name="compare" value="1"${filters.compare ? ' checked' : ''}>Compare with previous period</label>
      ${error ? `<div class="validation" role="alert"><strong>Invalid report criteria</strong><p class="micro">${escape(error)}</p></div>` : ''}
      </div><div class="form-actions">${error ? link('Edit date range', '#report-from') : ''}<button class="action primary" type="submit">${error ? 'Try again' : 'Generate report →'}</button></div>
      ${error ? '' : `<div class="notice-links">${tests.map(([name, url]) => link(name, url, 'text')).join('')}</div>`}
    </form><aside class="panel"><h2>${error ? 'What needs fixing?' : 'Report summary'}</h2>
      <p class="eyebrow" id="summary-type">${escape(labels[filters.type] || '')}</p>
      <p class="muted" id="summary-description">${escape(error || descriptions[filters.type] || '')}</p>
      ${error ? '' : `<hr class="rule"><p class="micro">Included in this report</p>
        <ul class="summary-list" id="summary-highlights">${(highlights[filters.type] || []).map(item => `<li>${item}</li>`).join('')}</ul>`}
      <hr class="rule"><p class="micro">Reporting period</p><strong class="summary-period" id="summary-period">${escape(filters.from)} — ${escape(filters.to)}</strong>
      <p class="micro bottom-note">Both dates are inclusive in Vietnam time (UTC+07:00).</p></aside></div>
    <p class="micro bottom-note">Reports are read-only. Generating a report does not modify operational records.</p>`;
}

function emptyPeriodComparison(type, previous) {
  if (!previous) return '';
  if (type === 'sales') {
    return tiles([
      ['Current period sales', money.format(0)], ['Previous period sales', money.format(previous.total)],
      ['Current period orders', 0], ['Previous period orders', number.format(previous.count)],
    ]);
  }
  return tiles([['Current period', 0], ['Previous period', number.format(previous.count)]]);
}

function statePage(filters, hubs, { failed = false, example = false, previous } = {}) {
  const title = failed ? "We couldn't generate this report" : 'No matching records';
  return intro(failed ? 'Report generation' : 'Report preview', (labels[filters.type] || 'Report') + ' · ' + period(filters, hubs),
    link('Back to reports', '/reports')) +
    emptyPeriodComparison(filters.type, previous) +
    `<section class="panel state-panel"><div><img src="/prototype/${failed ? 'error' : 'empty'}.svg" alt="" width="88" height="88">
      <h2>${title}</h2><p class="muted">${failed ? 'Something went wrong while processing your request.' : 'No records match the selected dates and hub.'}</p>
      <p class="micro">${failed ? 'Your operational data has not changed. You can try again.' : 'Widen the date range or select a different hub or virtual brand.'}</p>
      <div class="state-actions">${link('Back to reports', '/reports')}${link(failed ? 'Try again' : 'Adjust filters',
        urlFor(filters, failed && !example ? 'preview' : 'criteria'), 'primary')}</div></div></section>`;
}

function salesTrend(result) {
  const totals = new Map();
  for (const order of result.orders) totals.set(order.day, (totals.get(order.day) || 0) + order.total);
  const points = [...totals].sort(([a], [b]) => a.localeCompare(b));
  const max = points.reduce((peak, [, total]) => Math.max(peak, total), 1);
  const first = Date.parse(points[0][0]);
  const span = Math.max(86400000, Date.parse(points.at(-1)[0]) - first);
  const coordinates = points.map(([day, total]) => [12 + 616 * (Date.parse(day) - first) / span, 145 - total / max * 126]);
  const positions = coordinates.map(point => point.join(',')).join(' ');
  return `<article class="panel"><div class="section-heading chart-heading"><h2>Sales trend</h2><span class="micro">Daily confirmed sales</span></div>
    <svg class="chart" viewBox="0 0 640 155" role="img" aria-label="Daily confirmed sales for days with orders">
      ${[19, 61, 103, 145].map(y => `<line x1="12" x2="628" y1="${y}" y2="${y}"/>`).join('')}
      <polygon points="12,145 ${positions} ${coordinates.at(-1)[0]},145"/>
      <path d="M ${positions.replaceAll(',', ' ')}"/>
      ${coordinates.map(([x, y], index) => `<circle cx="${x}" cy="${y}" r="4"><title>${escape(points[index][0])} · ${escape(money.format(points[index][1]))}</title></circle>`).join('')}
    </svg><div class="chart-labels micro"><span>${escape(points[0][0])}</span><span>${escape(points.at(-1)[0])}</span></div></article>`;
}

function salesReport(result, previous) {
  const hubs = new Map();
  for (const { hub, total } of result.orders) {
    const row = hubs.get(hub) || { count: 0, total: 0 };
    row.count++;
    row.total += total;
    hubs.set(hub, row);
  }
  const rows = [...hubs].sort(([, a], [, b]) => b.total - a.total);
  const completed = result.orders.filter(order => order.outcome === 'completed').length;
  const deliveryCount = result.orders.filter(order => order.outcome).length;
  const percent = (part, total) => total ? (100 * part / total).toFixed(0) + '%' : '0%';
  const average = result.total / result.count;
  const comparison = previous ? 'Previous: ' + money.format(previous.total) : 'Confirmed orders only';
  return tiles([['Total sales', money.format(result.total), comparison], ['Confirmed orders', number.format(result.count),
    previous && 'Previous: ' + number.format(previous.count)], ['Average order value', money.format(average)],
    ['Fulfilment rate', deliveryCount ? percent(completed, deliveryCount) : '—', 'Of recorded delivery outcomes']]) +
    `<div class="grid chart-grid">${salesTrend(result)}<article class="panel"><h2>Sales by hub</h2>
      <p class="micro">Share of total confirmed sales</p>${rows.map(([name, row]) =>
        `<div class="section-heading"><strong>${escape(name)}</strong><span>${percent(row.total, result.total)}</span></div>
        <progress class="share" aria-label="${escape(name)} sales share" value="${row.total}" max="${result.total || 1}"></progress>`).join('')}
    </article></div>` +
    table('Hub performance', ['Hub', 'Orders', 'Sales', 'Avg. order', 'Share'], rows.map(([name, row]) =>
      [name, row.count, money.format(row.total), money.format(row.total / row.count), percent(row.total, result.total)])) +
    `<div class="bottom-note">${table('Confirmed orders', ['Order', 'Hub', 'Total'], result.orders.map(
      ({ id, hub, total }) => [`SB-${String(id).padStart(6, '0')}`, hub, money.format(total)]))}</div>`;
}

function preview(filters, hubs, result, previous) {
  let detail;
  if (filters.type === 'sales') detail = salesReport(result, previous);
  else if (filters.type === 'workload') {
    detail = table('Orders placed by hub', ['Hub', 'Submitted', 'Confirmed', 'Rejected', 'Total'],
      result.hubs.map(row => [row.hub, row.submitted, row.confirmed, row.rejected, row.total]));
  } else {
    detail = table('Delivery outcomes by hub', ['Hub', 'Completed', 'Failed', 'Total'],
      result.hubs.map(row => [row.hub, row.completed, row.failed, row.total]));
  }
  return intro(labels[filters.type], period(filters, hubs) + ' · Generated just now',
    link('Edit filters', urlFor(filters, 'criteria'), 'primary')) +
    `<div class="section-heading">${link('Back to reports', '/reports')}</div>` +
    (previous && filters.type !== 'sales' ? tiles([['Current period', result.count], ['Previous period', previous.count]]) : '') + detail +
    '<p class="micro bottom-note">Reporting dates use Vietnam time. Currency is shown in VND.</p>';
}

export function handleReports(db, request, response, url, password) {
  const headers = {
    'Cache-Control': 'no-store',
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; form-action 'self'",
    'X-Content-Type-Options': 'nosniff',
  };
  const access = managerAccess(db, request.headers.authorization, password);
  if (access !== 200) {
    if (access === 401) headers['WWW-Authenticate'] = 'Basic realm="SaigonBite reports", charset="UTF-8"';
    return response.writeHead(access, headers).end(access === 503
      ? 'Configure a manager password to enable reports.' : 'Manager access is required.');
  }
  const respond = (status, markup) => response.writeHead(status, headers).end(layout(markup));
  let hubs = [];
  let filters = reportFilters(new URLSearchParams(), []).filters;
  try {
    hubs = db.prepare('SELECT id, name FROM hubs ORDER BY name').all();
    const brands = db.prepare('SELECT id, name FROM brands ORDER BY name').all();
    const criteria = reportFilters(url.searchParams, hubs, brands);
    ({ filters } = criteria);
    if (criteria.error) return respond(400, criteriaPage(filters, hubs, brands, criteria.error));
    const view = url.searchParams.get('view');
    if (view === 'criteria') return respond(200, criteriaPage(filters, hubs, brands));
    if (!url.search) return respond(200, dashboard(hubs, filters));
    if (url.searchParams.get('example') === 'error') return respond(200, statePage(filters, hubs, { failed: true, example: true }));
    const result = runReport(db, criteria);
    const previous = filters.compare ? compareReport(db, criteria) : undefined;
    if (!result.count) return respond(200, statePage(filters, hubs, { previous }));
    const markup = preview(filters, hubs, result, previous);
    recent.unshift({ filters, period: period(filters, hubs), time: new Date() });
    recent.splice(5);
    reportCount++;
    return respond(200, markup);
  } catch (error) {
    console.error('Unable to generate management report', error);
    return respond(500, statePage(filters, hubs, { failed: true }));
  }
}
