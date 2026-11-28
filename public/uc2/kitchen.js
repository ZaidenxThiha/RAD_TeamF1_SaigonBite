// UC2 browser controller. Author: Thin Lei Sandi (523K0075).
import { renderWorkspaceLayout } from '/shared/layout.js';

const layout = renderWorkspaceLayout({
  workspace: 'Kitchen workspace',
  home: '/kitchen',
  breadcrumb: 'Kitchen / Incoming orders',
  description: 'SaigonBite kitchen workspace',
  role: 'Kitchen staff',
  initials: 'KS',
  navigation: [{ label: 'Incoming orders', href: '/kitchen', icon: 'orders', active: true }],
});
const view = document.querySelector('#view');
const account = document.querySelector('#account');
const announcement = document.querySelector('#announcement');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const date = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', dateStyle: 'medium', timeStyle: 'short',
});
let pending = false;
let screen = 'queue';
let selected;
let staff;

// Database text is always inserted with textContent, never HTML interpolation.
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(text, action, className = '') {
  const b = el('button', text, className);
  b.type = 'button';
  b.onclick = action;
  return b;
}
function orderName(id) { return `SB-${id}`; }
function timestamp(value) { return date.format(new Date(value.replace(' ', 'T') + 'Z')); }
function heading(title, subtitle) {
  const h = el('h1', title);
  h.tabIndex = -1;
  view.replaceChildren(h, el('p', subtitle, 'subtitle'));
  view.setAttribute('aria-busy', 'false');
  h.focus();
}
function badge(status) { return el('span', status, `badge ${status.toLowerCase()}`); }
function card(...children) {
  const c = el('div', undefined, 'card');
  c.append(...children);
  return c;
}
function detail(dl, label, value) { dl.append(el('dt', label), el('dd', value)); }
function table(headers) {
  const t = el('table');
  const head = t.createTHead().insertRow();
  for (const label of headers) {
    const th = el('th', label);
    th.scope = 'col';
    head.append(th);
  }
  const wrap = el('div', undefined, 'table-scroll');
  wrap.append(t);
  return { wrap, body: t.createTBody() };
}
async function api(path, body) {
  const response = await fetch('/api/kitchen/orders' + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'X-Demo-User': account.value, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message), { code: data.code });
  return data;
}
async function run(work) {
  if (pending) return;
  pending = true;
  account.disabled = true;
  view.setAttribute('aria-busy', 'true');
  view.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { await work(); }
  catch (error) { renderError(error); }
  finally {
    pending = false;
    account.disabled = false;
    view.setAttribute('aria-busy', 'false');
    view.querySelectorAll('button').forEach(b => { b.disabled = false; });
  }
}

function renderQueue(data) {
  screen = 'queue';
  selected = undefined;
  staff = data.staff;
  layout.updateIdentity({
    contextLabel: `Assigned hub · ${staff.hubName}`,
    accountLabel: `${staff.username} · ID ${staff.id}`,
  });
  heading('Incoming orders', `Review Submitted orders for ${staff.hubName}.`);
  const count = data.orders.length;
  announcement.textContent = `${count} ${count === 1 ? 'order' : 'orders'} waiting for a decision.`;
  const refresh = button('Refresh queue', loadQueue);
  if (!count) {
    const empty = card(el('h2', 'No incoming orders'), el('p', 'There are no Submitted orders awaiting a decision.', 'muted'), refresh);
    empty.classList.add('empty');
    view.append(empty);
    return;
  }
  const { wrap, body } = table(['Order', 'Submitted at', 'Items', 'Total', 'Status', 'Actions']);
  wrap.classList.add('queue-scroll');
  wrap.tabIndex = 0;
  wrap.setAttribute('role', 'region');
  wrap.setAttribute('aria-label', 'Incoming orders table. Scroll to view more orders.');
  for (const order of data.orders) {
    const tr = body.insertRow();
    tr.insertCell().append(el('span', orderName(order.id), 'order-link'));
    tr.insertCell().textContent = timestamp(order.submittedAt);
    const quantity = order.itemCount ?? 0;
    tr.insertCell().textContent = `${quantity} ${quantity === 1 ? 'item' : 'items'}`;
    tr.insertCell().textContent = money.format(order.total);
    tr.insertCell().append(badge(order.status));
    const review = button('Review', () => loadDetails(order.id), 'primary');
    review.setAttribute('aria-label', `Review order ${orderName(order.id)}`);
    tr.insertCell().append(review);
  }
  const queueCard = card(wrap);
  queueCard.classList.add('queue-card');
  view.append(queueCard, refresh);
}
function loadQueue() { return run(async () => renderQueue(await api(''))); }
function loadDetails(id) { return run(async () => renderDetails(await api('/' + id))); }

function renderDetails(order) {
  selected = order;
  screen = 'details';
  heading(`Order ${orderName(order.id)}`, 'Review the details before confirming or rejecting this order.');
  const { wrap, body } = table(['Item', 'Quantity', 'Unit price']);
  wrap.querySelector('table').classList.add('items-table');
  for (const item of order.items) {
    const tr = body.insertRow();
    [item.name, String(item.quantity), money.format(item.unitPrice)].forEach(s => { tr.insertCell().textContent = s; });
  }
  const totals = el('div', undefined, 'totals');
  for (const [name, amount] of [['Subtotal', order.subtotal], ['Delivery fee', order.deliveryFee],
    ['Quiet-hub incentive', -order.incentive], ['Voucher discount', -order.discount], ['Total', order.total]]) {
    if (!amount && name !== 'Total') continue;
    const row = el('div', undefined, name === 'Total' ? 'total' : '');
    row.append(el('span', name), el('span', money.format(amount)));
    totals.append(row);
  }
  const info = el('dl');
  detail(info, 'Status', order.status);
  detail(info, 'Assigned hub', order.hubName);
  detail(info, 'Delivery address', order.address);
  detail(info, 'Payment method', order.method === 'cod' ? 'Cash on delivery' : 'Online payment');
  detail(info, 'Payment status', order.paymentStatus);
  const grid = el('div', undefined, 'grid');
  grid.append(card(el('h2', 'Order items'), wrap, totals), card(el('h2', 'Delivery and payment'), info));
  const actions = el('div', undefined, 'actions');
  actions.append(button('Reject order', () => renderRejection(), 'danger'), button('Confirm order', () => save('Confirmed'), 'primary'));
  const bar = card(button('Back to orders', loadQueue), actions);
  bar.classList.add('actionbar');
  view.append(grid, bar);
}

function renderRejection(reason = '', error = '') {
  screen = 'reject';
  heading(`Reject order ${orderName(selected.id)}`, 'A rejection reason is required before saving the decision.');
  const form = el('form');
  const label = el('label', 'Rejection reason (required)');
  label.htmlFor = 'reason';
  const input = el('textarea');
  input.id = 'reason';
  input.name = 'reason';
  input.maxLength = 1000;
  input.placeholder = 'Enter a reason';
  input.value = reason;
  input.setAttribute('aria-required', 'true');
  input.setAttribute('aria-invalid', String(Boolean(error)));
  input.setAttribute('aria-describedby', 'reason-help reason-error');
  const errorNode = el('p', error, 'error');
  errorNode.id = 'reason-error';
  errorNode.setAttribute('role', 'alert');
  const help = el('p', 'The reason is saved with your staff ID and decision time. Maximum 1000 characters.', 'muted');
  help.id = 'reason-help';
  const actions = el('div', undefined, 'actions right');
  const submit = el('button', 'Submit rejection', 'primary');
  submit.type = 'submit';
  actions.append(button('Cancel', () => loadDetails(selected.id)), submit);
  form.append(label, input, help, errorNode, actions);
  form.onsubmit = event => {
    event.preventDefault();
    if (pending) return;
    const value = input.value.trim();
    if (!value) {
      input.setAttribute('aria-invalid', 'true');
      errorNode.textContent = 'Please enter a rejection reason.';
      input.focus();
      return;
    }
    void save('Rejected', value);
  };
  view.append(card(el('h2', 'Why is this order being rejected?'), form));
  if (error) input.focus();
}

function save(decision, reason) {
  const id = selected.id;
  return run(async () => {
    try { renderResult(await api(`/${id}/decision`, { decision, reason })); }
    catch (error) {
      if (error.code === 'REASON_REQUIRED') renderRejection(reason, error.message);
      else if (!error.code || error.code === 'SAVE_FAILED') {
        // Keep the draft on transport failure; a refreshed queue resolves an uncertain save.
        if (decision === 'Rejected') renderRejection(reason);
        else renderDetails(selected);
        const notice = el('p', 'The save could not be confirmed. Refresh the queue before retrying; the decision may already have been recorded.', 'notice');
        notice.setAttribute('role', 'alert');
        notice.append(button('Refresh queue', loadQueue));
        view.append(notice);
      } else renderError(error);
    }
  });
}
function renderResult(result) {
  screen = 'result';
  const rejected = result.status === 'Rejected';
  heading(rejected ? 'Order rejected' : 'Order confirmed', 'Your decision has been saved.');
  view.querySelector('.subtitle').classList.add('success-message');
  const details = el('dl');
  detail(details, 'Staff ID', String(result.staffId));
  detail(details, 'Decision time', timestamp(result.decidedAt));
  const reason = result.reason ? el('section', undefined, 'rejection-summary') : null;
  if (reason) {
    reason.setAttribute('aria-label', 'Rejection reason');
    reason.append(el('h3', 'Rejection reason'), el('p', result.reason, 'reason'));
  }
  const content = card(el('h2', `${orderName(result.orderId)} · ${result.status}`, rejected ? 'rejected-text' : 'confirmed-text'), details,
    ...(reason ? [reason] : []),
    el('p', result.notificationStatus === 'sent' ? 'Customer notified.' : 'Customer notification failed. Your decision is saved.', result.notificationStatus === 'sent' ? 'success-message' : 'notice'),
    button('Back to incoming orders', loadQueue, 'primary'));
  content.classList.add('result');
  view.append(content);
}
function renderError(error) {
  screen = 'error';
  const title = error.code === 'ACCESS_DENIED' ? 'Access denied' : error.code === 'ORDER_UNAVAILABLE' ? 'Order unavailable' : error.code === 'NOT_FOUND' ? 'Order not found' : 'Could not load orders';
  heading(title, 'Your request could not be completed.');
  const message = el('p', error.message);
  message.setAttribute('role', 'alert');
  view.append(card(message, button(error.code === 'ORDER_UNAVAILABLE' ? 'Refresh queue' : 'Back to incoming orders', loadQueue, 'primary')));
}
account.onchange = () => { selected = undefined; void loadQueue(); };
// Refresh only the idle queue. Preserve an in-progress decision so save-time checks can detect stale orders.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && screen === 'queue' && !pending) void loadQueue();
});
void loadQueue();
