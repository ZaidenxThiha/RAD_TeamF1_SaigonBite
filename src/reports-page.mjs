import { managerAccess, reportFilters, reportTypes, runReport } from './reports.mjs';

const escape = value => String(value).replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

function table(caption, headings, rows) {
  return `<table><caption>${caption}</caption>
    <thead><tr>${headings.map(heading => `<th scope="col">${heading}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(([label, ...values]) => `<tr><th scope="row">${escape(label)}</th>${
      values.map(value => `<td>${escape(value)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

function results(type, result) {
  if (!result.count) return '<p class="panel">No records match the selected dates and hub.</p>';
  if (type === 'sales') {
    const statistics = [
      ['Total sales', money.format(result.total)],
      ['Confirmed orders', result.count],
      ['Average order value', money.format(result.total / result.count)],
    ];
    return `<dl class="sales-totals">${statistics.map(([label, value]) =>
      `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}</dl>` +
      table('Confirmed orders', ['Order', 'Hub', 'Total'], result.orders.map(
        ({ id, hub, total }) => [`#${id}`, hub, money.format(total)],
      ));
  }
  if (type === 'workload') {
    return table('Orders placed by hub', ['Hub', 'Submitted', 'Confirmed', 'Rejected', 'Total'],
      result.hubs.map(row => [row.hub, row.submitted, row.confirmed, row.rejected, row.total]));
  }
  return table('Delivery outcomes by hub', ['Hub', 'Completed', 'Failed', 'Total'],
    result.hubs.map(row => [row.hub, row.completed, row.failed, row.total]));
}

const definitions = {
  sales: 'Sales sum the saved totals of confirmed orders by order date.',
  workload: 'Workload counts orders by current status and order date.',
  delivery: 'Delivery performance counts completed and failed deliveries by outcome date.',
};

function option(value, label, selected) {
  return `<option value="${escape(value)}"${String(value) === selected ? ' selected' : ''}>${escape(label)}</option>`;
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

  try {
    const hubs = db.prepare('SELECT id, name FROM hubs ORDER BY name').all();
    const criteria = reportFilters(url.searchParams, hubs);
    const { filters, error } = criteria;
    const report = error ? '' : results(filters.type, runReport(db, criteria));
    const typeOptions = Object.entries(reportTypes).map(([value, label]) => option(value, label, filters.type)).join('');
    const hubOptions = hubs.map(({ id, name }) => option(id, name, filters.hub)).join('');
    response.writeHead(error ? 400 : 200, headers).end(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Management reports | SaigonBite</title>
  <link rel="stylesheet" href="/checkout.css">
  <link rel="stylesheet" href="/reports.css">
</head>
<body>
  <header><div class="site"><strong>Saigon<span>Bite</span></strong></div></header>
  <main class="site">
    <h1>Management reports</h1>
    <form action="/reports" method="get" class="panel report-filters">
      <label>Report <select name="type">${typeOptions}</select></label>
      <label>From <input name="from" type="date" value="${escape(filters.from)}" required></label>
      <label>Through <input name="to" type="date" value="${escape(filters.to)}" required></label>
      <label>Hub <select name="hub">${option('', 'All hubs', filters.hub)}${hubOptions}</select></label>
      <button class="primary" type="submit">Run report</button>
    </form>
    <p class="report-note">Dates include both endpoints in Vietnam time (UTC+07:00).</p>
    ${error ? `<p class="notice" role="alert">${escape(error)}</p>` : `
    <section class="report-results" aria-labelledby="report-heading">
      <h2 id="report-heading">${reportTypes[filters.type]}</h2>
      <p class="report-note">${definitions[filters.type]}</p>
      ${report}
    </section>`}
  </main>
</body>
</html>`);
  } catch (error) {
    console.error('Unable to generate management report', error);
    response.writeHead(500, headers).end('Unable to generate the report. Try again.');
  }
}
