// UC3 browser controller. Author: Thin Lei Sandi (523K0075).
import { renderWorkspaceLayout } from '/shared/layout.js';
import { enableIntegerFormatting, parseIntegerInput } from './number-input.js';
const shell = renderWorkspaceLayout({ workspace: 'Admin workspace', home: '/vouchers',
  breadcrumb: 'Workspace / Vouchers', description: 'SaigonBite voucher management',
  role: 'Administrator', initials: 'AD', navigation: [{ label: 'Vouchers', href: '/vouchers', icon: 'vouchers', active: true }] });
const content = document.querySelector('#content'), message = document.querySelector('#message');
const account = document.querySelector('#demo-account');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });
let hubs = [], generation = 0, saving = false, archiveDialog = null, noticeTimer;
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function button(label, action, primary = false, disabled = false, title = '') {
  const node = el('button', label, primary ? 'primary' : '');
  node.type = 'button'; node.disabled = disabled; node.title = title; node.onclick = action;
  return node;
}
function go(path = '') { if (location.hash === `#${path}` || (!path && !location.hash)) void render(); else location.hash = path; }
function notice(text = '', error = false) {
  clearTimeout(noticeTimer);
  message.replaceChildren();
  if (text) {
    message.append(el('p', text, error ? 'error-message' : 'success'));
    if (!error) noticeTimer = setTimeout(() => message.replaceChildren(), 3000);
  }
}
async function api(path = '', method = 'GET', body) {
  const response = await fetch(`/api/vouchers${path}`, { method,
    headers: { 'X-Demo-User': account.value, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const value = await response.json();
  if (!response.ok) throw Object.assign(new Error(value.message), value);
  return value;
}
function heading(title, subtitle) {
  content.append(el('h1', title));
  if (subtitle) content.append(el('p', subtitle, 'subtitle'));
}
function badge(status) { return el('span', status, `badge ${status.toLowerCase()}`); }
function discount(v) { return v.discountType === 'percent' ? `${v.discountValue}%` : money.format(v.discountValue); }
function date(value) { return value.split('-').reverse().join('/'); }
function hubName(id) { return id === null ? 'All hubs' : hubs.find(h => h.id === id)?.name ?? 'Hub unavailable'; }
function controls(v) {
  const actions = el('div', undefined, 'actions');
  actions.append(button('Edit', () => go(`${v.id}/edit`), false, !v.canEdit, v.canEdit ? '' : 'Archived vouchers are view-only'),
    button('Archive', () => archive(v), false, !v.canArchive, v.canArchive ? '' : 'Only Active vouchers can be archived'));
  return actions;
}
function list(data) {
  heading('Voucher management');
  const toolbar = el('div', undefined, 'toolbar'), filters = el('div', undefined, 'filters');
  const searchLabel = el('label', 'Search code'), search = el('input'); search.type = 'search'; search.placeholder = 'Voucher code';
  const statusLabel = el('label', 'Status'), status = el('select');
  for (const text of ['All statuses', 'Active', 'Expired', 'Archived']) status.add(new Option(text, text));
  searchLabel.append(search); statusLabel.append(status); filters.append(searchLabel, statusLabel);
  toolbar.append(button('Create voucher', () => go('create'), true), filters, button('Refresh list', () => go('')));
  const card = el('div', undefined, 'card table-card'), scroll = el('div', undefined, 'table-scroll');
  scroll.tabIndex = 0; scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Voucher list');
  const table = el('table'), caption = el('caption', 'Vouchers and available actions', 'sr-only'); table.append(caption);
  const head = el('thead'), row = el('tr');
  for (const text of ['Code', 'Discount', 'Valid from', 'Valid until', 'Status', 'Actions']) { const th = el('th', text); th.scope = 'col'; row.append(th); }
  head.append(row); const body = el('tbody'); table.append(head, body); scroll.append(table); card.append(scroll); content.append(toolbar, card);
  function update() {
    body.replaceChildren();
    const values = data.vouchers.filter(v => v.code.toLowerCase().includes(search.value.trim().toLowerCase()) && (status.value === 'All statuses' || v.status === status.value));
    for (const v of values) {
      const tr = el('tr'); for (const text of [v.code, discount(v), date(v.startsOn), date(v.endsOn)]) tr.append(el('td', text));
      const state = el('td'); state.append(badge(v.status)); const actionCell = el('td'), actions = controls(v);
      actions.prepend(button('View', () => go(String(v.id)))); actionCell.append(actions); tr.append(state, actionCell); body.append(tr);
    }
    if (!values.length) { const tr = el('tr'), td = el('td', 'No vouchers match your selection.', 'empty'); td.colSpan = 6; tr.append(td); body.append(tr); }
  }
  search.oninput = update; status.onchange = update; update();
}
function details(v) {
  heading(`${v.code} voucher details`);
  const card = el('div', undefined, 'card'), dl = el('dl', undefined, 'details');
  const values = [['Code', v.code], ['Discount', discount(v)], ['Valid from', date(v.startsOn)], ['Valid until', date(v.endsOn)],
    ['Minimum order subtotal', money.format(v.minimumSubtotal)], ['Eligible hubs', hubName(v.hubId)]];
  for (const [label, value] of values) dl.append(el('dt', label), el('dd', value));
  const state = el('dd'); state.append(badge(v.status)); dl.append(el('dt', 'Status'), state); card.append(dl);
  const actions = controls(v); actions.classList.add('end'); actions.append(button('Back to list', () => go())); card.append(actions);
  if (v.history.length) {
    const section = el('details'), summary = el('summary', 'Change history'), history = el('ul', undefined, 'history');
    for (const entry of v.history) history.append(el('li', `${entry.action} · ${entry.administrator} · ${new Date(entry.occurredAt.includes('T') ? entry.occurredAt : entry.occurredAt.replace(' ', 'T') + 'Z').toLocaleString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh' })} (Vietnam time)`));
    section.append(summary, history); card.append(section);
  }
  content.append(card);
}
function form(v, today) {
  heading(v ? 'Edit voucher' : 'Create voucher');
  const node = el('form', undefined, 'card form-card'); node.noValidate = true;
  const error = el('div'); error.setAttribute('role', 'alert'); node.append(error);
  const fields = new Map(), errors = new Map();
  function field(name, label, type, value, options, help) {
    const wrapper = el('div', undefined, 'field'), labelNode = el('label', label);
    const input = el(options ? 'select' : 'input'); input.id = `voucher-${name}`; input.name = name;
    labelNode.htmlFor = input.id;
    if (options) for (const [text, value] of options) input.add(new Option(text, value));
    else input.type = type === 'number' ? 'text' : type;
    input.value = value ?? ''; input.required = true;
    if (type === 'number') enableIntegerFormatting(input);
    if (name === 'code') { input.maxLength = 80; input.autocomplete = 'off'; }
    const feedback = el('p', '', 'field-error'); feedback.id = `${input.id}-error`;
    input.setAttribute('aria-describedby', feedback.id);
    wrapper.append(labelNode, input);
    if (help) { const description = el('small', help, 'help'); description.id = `${input.id}-help`; wrapper.append(description); input.setAttribute('aria-describedby', `${description.id} ${feedback.id}`); }
    wrapper.append(feedback); fields.set(name, input); errors.set(name, feedback); return wrapper;
  }
  node.append(field('code', 'Voucher code', 'text', v?.code),
    field('discountType', 'Discount type', '', v?.discountType ?? 'percent', [['Percentage', 'percent'], ['Fixed amount (VND)', 'fixed']]),
    field('discountValue', 'Discount value', 'number', v?.discountValue));
  const dates = el('div', undefined, 'columns');
  dates.append(field('startsOn', 'Valid from', 'date', v?.startsOn ?? today), field('endsOn', 'Valid until', 'date', v?.endsOn ?? today)); node.append(dates);
  const eligibility = el('div', undefined, 'columns');
  eligibility.append(field('minimumSubtotal', 'Minimum order subtotal (VND)', 'number', v?.minimumSubtotal ?? 0, undefined, 'Use 0 for no minimum subtotal.'),
    field('hubId', 'Eligible hub', '', v?.hubId ?? '', [['All hubs', ''], ...hubs.map(h => [h.name, String(h.id)])]));
  node.append(el('h3', 'Eligibility rules'), eligibility);
  const actions = el('div', undefined, 'actions end'), save = button('Save', null, true); save.type = 'submit';
  actions.append(save, button('Cancel', () => go(v ? String(v.id) : ''))); node.append(actions); content.append(node);
  node.onsubmit = async event => {
    event.preventDefault(); if (saving) return;
    error.replaceChildren(); for (const [name, input] of fields) { input.removeAttribute('aria-invalid'); errors.get(name).textContent = ''; }
    const data = Object.fromEntries([...fields].map(([name, input]) => [name, input.value]));
    // Empty numeric values stay invalid instead of becoming zero.
    for (const name of ['discountValue', 'minimumSubtotal']) data[name] = parseIntegerInput(data[name]);
    data.hubId = data.hubId === '' ? null : Number(data.hubId);
    saving = true; account.disabled = true; for (const control of node.elements) control.disabled = true;
    try {
      const saved = await api(v ? `/${v.id}` : '', v ? 'PUT' : 'POST', data);
      notice(`Voucher ${saved.code} ${v ? 'updated' : 'created'}. Status: ${saved.status}.`); go(String(saved.id));
    } catch (problem) {
      error.append(el('p', problem.message || 'Could not save the voucher. Please try again.', 'form-error'));
      for (const [name, text] of Object.entries(problem.fields ?? {})) {
        if (fields.has(name)) { fields.get(name).setAttribute('aria-invalid', 'true'); errors.get(name).textContent = text; }
      }
    } finally {
      saving = false; account.disabled = false; for (const control of node.elements) control.disabled = false;
      node.querySelector('[aria-invalid=true]')?.focus();
    }
  };
}
function archive(v) {
  if (archiveDialog || saving || !v.canArchive) return;
  const opener = document.activeElement;
  const dialog = el('dialog', undefined, 'archive-modal'), error = el('div');
  const title = el('h2', `Archive ${v.code}?`); title.id = 'archive-title';
  const description = el('p', 'This voucher will be kept for history but can no longer be applied to new orders.');
  description.id = 'archive-description';
  dialog.setAttribute('aria-labelledby', title.id);
  dialog.setAttribute('aria-describedby', description.id);
  error.setAttribute('role', 'alert');
  dialog.append(title, description, error);
  const actions = el('div', undefined, 'actions end');
  const cancel = button('Cancel', () => dialog.close());
  cancel.autofocus = true;
  actions.append(button('Confirm archive', async () => {
    if (saving) return;
    saving = true; account.disabled = true; for (const control of actions.querySelectorAll('button')) control.disabled = true;
    try {
      await api(`/${v.id}/archive`, 'POST', { confirmed: true });
      dialog.close(); notice(`Voucher ${v.code} archived.`); void render();
    } catch (problem) { error.replaceChildren(el('p', problem.message || 'Could not archive this voucher. Please try again.', 'form-error')); }
    finally { saving = false; account.disabled = false; for (const control of actions.querySelectorAll('button')) control.disabled = false; }
  }, true), cancel);
  dialog.append(actions);
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
  dialog.addEventListener('close', () => {
    if (archiveDialog === dialog) archiveDialog = null;
    dialog.remove();
    if (opener?.isConnected) opener.focus();
  });
  archiveDialog = dialog;
  document.body.append(dialog);
  dialog.showModal();
}
async function render() {
  if (archiveDialog?.open) archiveDialog.close();
  const token = ++generation;
  content.setAttribute('aria-busy', 'true'); content.replaceChildren(el('p', 'Loading vouchers…'));
  try {
    const data = await api();
    if (token !== generation) return;
    hubs = data.hubs;
    shell.updateIdentity({ accountLabel: `${data.actor.username} · ID ${data.actor.id}`, contextLabel: 'Voucher administration' });
    const route = location.hash.slice(1);
    if (!route) { content.replaceChildren(); list(data); }
    else if (route === 'create') { content.replaceChildren(); form(null, data.today); }
    else {
      const match = /^(\d+)(?:\/(edit|archive))?$/.exec(route);
      if (!match) throw new Error('This voucher page could not be found.');
      const v = await api(`/${match[1]}`);
      if (token !== generation) return;
      content.replaceChildren();
      if (match[2] === 'edit' && !v.canEdit) throw new Error('This voucher is archived and cannot be edited.');
      if (match[2] === 'archive' && !v.canArchive) throw new Error('Only Active vouchers can be archived.');
      if (match[2] === 'edit') form(v, data.today);
      else if (match[2] === 'archive') {
        // Keep old archive bookmarks working without a separate confirmation page.
        history.replaceState(null, '', `#${v.id}`);
        details(v); archive(v);
      }
      else details(v);
    }
  } catch (problem) {
    if (token !== generation) return;
    content.replaceChildren(); heading(problem.code === 'ACCESS_DENIED' ? 'Access denied' : 'Voucher unavailable', problem.message || 'Could not load vouchers. Try again.');
    const actions = el('div', undefined, 'actions');
    actions.append(button('Back to list', () => go()), button('Retry', () => void render()));
    content.append(actions);
  } finally { if (token === generation) content.setAttribute('aria-busy', 'false'); }
}
account.onchange = () => { notice(); shell.updateIdentity({ accountLabel: account.selectedOptions[0].text, contextLabel: 'Checking access…' }); void render(); };
window.addEventListener('hashchange', () => void render());
void render();
