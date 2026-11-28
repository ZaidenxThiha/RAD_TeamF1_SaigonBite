const view = document.querySelector('#checkout-view');
const dialog = document.querySelector('#checkout-feedback');
const menu = document.querySelector('.menu');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
const categories = ['Bowls', 'Noodles', 'Drinks', 'Sides'];
const steps = ['Select Hub & Brand', 'Browse Menu & Cart', 'Delivery Address & Eligibility',
  'Voucher & Order Review', 'Payment Method', 'Online Payment Processing', 'Order Confirmation', 'Payment Failed'];

let catalog;
let step = 0;
let category = 'Bowls';
let draft;
let quote;
let receipt;
let paymentAttempted = false;
let pending = false;
let error = '';
let alternatives = [];
let eligibility = false;

const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char]);
const icon = (name, size) => `<img src="/prototype/${name}.svg" alt="" width="${size}" height="${size}">`;
const format = value => money.format(value);
const reference = id => 'SB-' + String(id).padStart(6, '0');
const hubName = () => catalog.hubs.find(h => h.id === draft.hubId)?.name;
const menuItems = () => catalog.menu.filter(item => item.hubId === draft.hubId && item.brandId === draft.brandId);
const cart = () => menuItems().flatMap(item => draft.items.has(item.id) ? [{ ...item, quantity: draft.items.get(item.id) }] : []);
const count = () => cart().reduce((sum, item) => sum + item.quantity, 0);
const subtotal = () => cart().reduce((sum, item) => sum + item.price * item.quantity, 0);

async function api(action, body) {
  const response = await fetch('/api/checkout/' + action, body && {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message), { alternatives: data.alternatives });
  return data;
}

function brands() {
  return [...new Map(catalog.menu.filter(item => item.hubId === draft.hubId)
    .map(item => [item.brandId, item.brand]))];
}

function reset() {
  draft = { checkoutRef: crypto.randomUUID(), username: 'customer', hubId: catalog.hubs[0]?.id,
    brandId: undefined, areaId: catalog.areas[0]?.id, address: '', voucherCode: '',
    method: 'cod', items: new Map() };
  draft.brandId = brands()[0]?.[0];
  quote = receipt = undefined;
  category = 'Bowls';
  paymentAttempted = eligibility = false;
  go(0);
}

function body(overrides) {
  return { ...draft, items: cart().map(({ id, quantity }) => ({ itemId: id, quantity })),
    expectedTotal: quote?.total, ...overrides };
}

const button = (label, action, kind = 'primary', value = '') =>
  `<button type="button" class="${kind === 'link' ? 'text-button' : 'button ' + kind}" data-action="${action}" data-value="${escape(value)}">${escape(label)}</button>`;
const title = (headline, lead) => `<h1 tabindex="-1">${headline}</h1><p class="lead">${lead}</p>`;
const footer = (label, action, caption, kind) => `<footer class="footer">${caption || ''}${button(label, action, kind)}</footer>`;
const caption = text => `<p class="caption">${text}</p>`;
const row = (label, value, modifier = '') =>
  `<div class="line ${modifier}"><span>${escape(label)}</span><strong>${escape(value)}</strong></div>`;
const card = (content, name = '') => `<div class="card ${name}">${content}</div>`;
const selection = (label, description, hint, action, value, selected, marker) =>
  `<button type="button" class="choice" data-action="${action}" data-value="${escape(value)}" aria-pressed="${selected}" ${action === 'customer' && paymentAttempted ? 'disabled' : ''}>
     <strong>${escape(label)}</strong>${selected ? icon(marker, 20) : ''}
     <p>${escape(description)}</p><small>${escape(hint)}</small>
   </button>`;
const summary = (label, amount) => row(label, format(amount), 'caption');

function chooseHub() {
  return [title('Where should we deliver?', 'Choose a delivery hub and the virtual brand for your order.') +
    '<p class="legend">Select a delivery hub</p><div class="choices">' +
    catalog.hubs.map(h => selection(h.name, 'Delivery hub', 'Check availability at delivery', 'hub', h.id,
      draft.hubId === h.id, 'selected-hub')).join('') + '</div>' +
    `<div class="selected-label">${icon('hub-pin', 20)}Selected hub: <strong>${escape(hubName())}</strong></div>` +
    '<p class="legend">Choose a virtual brand</p><div class="choices">' +
    brands().map(([id, name]) => selection(name, 'Fresh Vietnamese favourites', 'Virtual brand', 'brand', id,
      draft.brandId === id, 'selected-brand')).join('') + '</div>' +
    '<p class="micro hint">Your selected hub determines menu availability and order capacity.</p>',
    footer('Continue to menu →', 'menu', caption('Step 1 of 8 · You can change your choices before checkout.'))];
}

function menuCategory(name) {
  if (/tea|coffee|juice|drink|trà|cà phê/i.test(name)) return 'Drinks';
  if (/noodles|bún|mì/i.test(name)) return 'Noodles';
  if (/rolls?|bánh mì|snack/i.test(name)) return 'Sides';
  return 'Bowls';
}

function browseMenu() {
  const cards = menuItems().filter(item => menuCategory(item.name) === category).map(item => {
    const qty = draft.items.get(item.id) || 0;
    const controls = qty ? `<div class="quantity">
      <button type="button" data-action="amount" data-value="${item.id}:-1" aria-label="Remove one ${escape(item.name)}">−</button>
      <strong aria-label="Quantity">${qty}</strong>
      <button type="button" data-action="amount" data-value="${item.id}:1" aria-label="Add one ${escape(item.name)}">+</button>
    </div>` : button('Add', 'add', 'primary', item.id);
    const illustration = /phở|pho/i.test(item.name) ? `<span class="thumbnail">${icon('pho', 60)}</span>` : '';
    return card(illustration + `<div><strong>${escape(item.name)}</strong><p class="micro">${escape(item.brand)}</p><strong class="money">${format(item.price)}</strong></div>` + controls, 'menu-item');
  });
  return [title('Explore the menu', 'Fresh favourites prepared by your selected hub.') +
    `<div class="kitchen-brand"><span><b>${escape(hubName())}</b><strong>${escape(brands().find(([id]) => id === draft.brandId)?.[1])}</strong></span>
    <span class="pill">${icon('cart', 18)}${count()} items</span></div>` +
    '<div class="categories" aria-label="Menu categories">' + categories.map(label =>
      `<button type="button" data-action="category" data-value="${label}" aria-pressed="${label === category}">${label}</button>`
    ).join('') + '</div>' + `<p class="legend menu-label">${category}</p>` +
    (cards.join('') || card('No items in this category are available for this hub and brand.')),
    footer('View cart & delivery →', 'delivery', summary('Cart subtotal', subtotal()))];
}

function delivery() {
  const field = card(`<label class="field"><span>${icon('address-pin', 18)} Full delivery address</span>
    <input name="address" maxlength="250" autocomplete="street-address" placeholder="Customer address" value="${escape(draft.address)}">
    <small class="micro">Include street, building, district and delivery notes.</small></label>
    <label class="field">Delivery area<select name="areaId">${catalog.areas.map(area =>
      `<option value="${area.id}"${draft.areaId === area.id ? ' selected' : ''}>${escape(area.name)}</option>`).join('')}</select></label>`);
  const results = card(`<div class="inline-heading"><h2>Delivery eligibility</h2><span class="pill status money">${eligibility ? 'Available' : 'Awaiting check'}</span></div>` +
    (eligibility ? ['Hub capacity', 'Menu availability', 'Delivery distance'].map(label =>
      `<div class="line">${icon('eligibility-check', 18)}<span>${label}</span><strong>${label === 'Delivery distance' ? 'WITHIN RANGE' : 'PASS'}</strong></div>`).join('')
      : '<p class="micro">Check your address to confirm capacity, menu availability and delivery distance.</p>'), 'eligibility');
  return [title('Where should we bring it?', 'Enter your address and check all delivery requirements.') + field +
    `<div class="inline-heading check-row"><strong class="legend menu-label">Check your address</strong>${button('Check eligibility', 'check', 'secondary')}</div>` +
    results + (alternatives.length ? button('Try an alternative hub →', 'alternative', 'link', alternatives[0].id) : '') +
    '<p class="micro hint">If the selected hub is busy, we can suggest an eligible alternative and recheck.</p>',
    footer('Continue to order review →', 'review', caption('All delivery checks must pass before checkout.'))];
}

function review() {
  const items = quote?.items || cart();
  const pricing = quote ? card([
    row('Subtotal', format(quote.subtotal)), row('Delivery fee', format(quote.deliveryFee)),
    row('Quiet-hub incentive', format(-quote.quietIncentive)), row('Voucher discount', format(-quote.voucherDiscount)),
    row('Final total', format(quote.total), 'divider final-total'),
  ].join('')) : card('Review the latest total before continuing.');
  return [title('Review your order', 'Check your items, savings and final total.') +
    card(`<div class="inline-heading"><h2>Voucher code</h2><small class="status money">One per order</small></div>
      <div class="voucher-input"><input aria-label="Voucher code" name="voucherCode" maxlength="80"
        placeholder="Enter code" value="${escape(draft.voucherCode)}">${button('Apply', 'quote', 'secondary')}</div>
      ${quote?.voucherDiscount ? `<p class="voucher-feedback">Voucher applied · ${format(quote.voucherDiscount)} off</p>` : ''}
      <div class="voucher-actions">${button('Test invalid', 'test-voucher', 'link', 'INVALID-DEMO')}
        ${button('Test expired', 'test-voucher', 'link', 'EXPIRED10')}${button('Remove', 'remove-voucher', 'link')}</div>`) +
    card(`<div class="inline-heading"><h2>Review your order</h2><span class="status">${count()} items</span></div>` + items.map(item =>
      row(`${item.name} × ${item.quantity}`, format(item.price * item.quantity))).join('')) +
    pricing + `<div class="voucher-actions">${button('Edit cart items →', 'menu', 'link')}${button('Edit delivery', 'delivery', 'link')}</div>`,
    footer('Confirm checkout →', 'payment', quote ? summary('Amount due', quote.total) : '')];
}

function payment() {
  return [title('How would you like to pay?', 'Choose your customer type and payment method.') +
    '<div class="choice-group"><p class="legend">Customer type</p><div class="choices">' +
    selection('Local Customer', 'Standard local checkout', 'Choose option', 'customer', 'customer', draft.username === 'customer', 'selected-customer') +
    selection('Foreign Tourist', 'Tourist checkout', 'Choose option', 'customer', 'tourist', draft.username === 'tourist', 'selected-customer') +
    `</div><div class="selected-label">Selected: <strong>${draft.username === 'tourist' ? 'Foreign Tourist' : 'Local Customer'}</strong></div></div>` +
    '<div class="choice-group divider"><p class="legend">Choose payment method</p><div class="choices">' +
    selection('Cash on Delivery', 'Pay when your order arrives', 'Choose option', 'method', 'cod', draft.method === 'cod', 'selected-payment') +
    selection('Online payment', 'Simulated payment provider', 'Choose option', 'method', 'online', draft.method === 'online', 'selected-payment') +
    '</div></div><div class="stack">' + card('<strong>Cash on Delivery</strong><p class="micro">Submit your order immediately.</p><strong>Online payment</strong><p class="micro">Continue to simulated processing.</p>') + '</div>',
    footer('Continue →', 'continue-payment', (quote ? summary('Amount due', quote.total) : '') +
      (paymentAttempted ? caption('Your original customer and payment reference are retained.') : ''))];
}

function processing() {
  return [title('Complete your payment', 'Your order is waiting for payment authorization.') +
    card(`<p class="status">Checkout reference</p><strong class="reference">${escape(draft.checkoutRef.slice(0, 8).toUpperCase())}</strong>` + summary('Amount to pay', quote?.total)) +
    card(`<div class="inline-heading">${icon('payment-provider', 24)}<div><strong class="status money">Payment request ready</strong>
      <p class="micro">Awaiting authorization from the simulated provider.</p></div></div>
      <p class="micro divider">Choose a prototype payment outcome below to continue.</p>`) +
    '<p class="legend hint">Prototype outcome controls</p><div class="action-pair">' +
    button('Payment successful', 'approve') + button('Payment failed', 'decline', 'secondary') +
    '</div><p class="micro hint">No order is submitted until payment succeeds.</p>',
    footer('Back to payment method', 'payment-back', caption('Need to change your choice?'), 'secondary')];
}

function confirmation() {
  const status = receipt.status;
  const headline = status === 'Rejected' ? 'Order rejected' : status === 'Confirmed' ? 'Order confirmed!' : 'Order submitted!';
  const message = status === 'Rejected' ? receipt.rejectionReason || 'The kitchen rejected your order.'
    : status === 'Confirmed' ? 'The kitchen has accepted your order.' : 'Your order has been sent to the kitchen and is awaiting acceptance.';
  return [`<div class="receipt-hero">${icon(status === 'Rejected' ? 'declined' : 'submitted', 68)}${title(headline, escape(message))}</div>` +
    card(`<p class="status">Order reference</p><strong class="reference money">${reference(receipt.orderId)}</strong>`) +
    card(row('Selected hub', receipt.hubName) + row('Delivery address', draft.address) +
      row('Items', count() + ' items') + row('Payment method', receipt.method === 'cod' ? 'Cash on Delivery (COD)' : 'Online payment') +
      row('Final total', format(receipt.total), 'divider final-total')) +
    card(`<div class="inline-heading status"><strong class="money">${escape(status)}</strong>${status === 'Submitted' ? 'Awaiting acceptance' : 'Kitchen decision'}</div>
      <p class="micro status-detail">${escape(message)}</p>${button('Refresh status', 'refresh', 'link')}`),
    footer('Back to menu →', 'restart', caption('Thank you for ordering with SaigonBite.'))];
}

function failed() {
  return [`<div class="receipt-hero">${icon('declined', 68)}${title('Payment not completed', 'The payment provider declined this transaction.')}</div>` +
    card('<div class="inline-heading status"><strong class="money">Payment declined</strong>Not confirmed</div><div class="divider"><strong>Order status: Not confirmed</strong><p class="micro status-detail">No successful payment has been recorded.</p></div>') +
    '<p class="micro hint">Your order has not been submitted. You can retry, change payment method or return to review.</p><div class="stack">' +
    button('Retry payment →', 'processing') + button('Change payment method', 'payment-back', 'secondary') +
    button('Return to order review →', 'review', 'link') + '</div>',
    footer('Back to payment method', 'payment-back', caption('Payment must succeed before order confirmation.'), 'secondary')];
}

const screens = [chooseHub, browseMenu, delivery, review, payment, processing, confirmation, failed];

function render(focus = false) {
  const [content, actions] = screens[step]();
  view.innerHTML = `<section class="content screen-${step + 1}"><div class="step"><b>0${step + 1} / 08</b>${steps[step]}</div>
    <div class="track"></div>${error ? `<p class="notice" role="alert">${escape(error)}</p>` : ''}${content}</section>${actions}`;
  view.setAttribute('aria-busy', String(pending));
  menu.querySelector('[data-action="back"]').hidden = step === 0 || step === 6;
  menu.querySelector('[data-action="cancel"]').hidden = step === 6;
  if (focus) view.querySelector('h1')?.focus();
}

function go(next) {
  step = next;
  error = '';
  if (dialog.open) dialog.close();
  render(true);
}

function feedback(titleText, description, actions) {
  dialog.innerHTML = `${icon('feedback', 56)}<h2 id="feedback-title">${escape(titleText)}</h2>
    <p class="micro">${escape(description)}</p><div class="stack">${actions}</div>`;
  if (!dialog.open) dialog.showModal();
}

async function run(work) {
  if (pending) return;
  pending = true;
  error = '';
  view.setAttribute('aria-busy', 'true');
  view.querySelectorAll('button, input, select').forEach(control => { control.disabled = true; });
  try {
    await work();
  } catch (failure) {
    error = failure.message;
    alternatives = failure.alternatives || [];
    if (alternatives.length) {
      const alternative = alternatives[0];
      step = 2;
      feedback('Try ' + alternative.name, failure.message,
        button('Use ' + alternative.name, 'use-alternative', 'primary', alternative.id) +
        button('Keep current hub', 'dismiss', 'secondary'));
    }
  } finally {
    pending = false;
    render();
  }
}

async function checkDelivery(showFeedback) {
  quote = undefined;
  eligibility = false;
  quote = await api('quote', body({ voucherCode: '' }));
  eligibility = true;
  alternatives = [];
  if (showFeedback) feedback('Delivery available', 'Hub capacity, menu availability and delivery distance have passed.',
    button('Continue to order review', 'review'));
}

async function refreshQuote() {
  quote = undefined;
  quote = await api('quote', body());
}

async function submit(simulation) {
  try {
    const result = await api('submit', body({ simulation }));
    if (result.status === 'PaymentDeclined') {
      paymentAttempted = true;
      go(7);
      return;
    }
    receipt = result;
    go(6);
  } catch (failure) {
    quote = undefined;
    step = 3;
    throw failure;
  }
}

view.addEventListener('input', event => {
  const { name, value } = event.target;
  if (name === 'areaId' || name === 'address' || name === 'voucherCode') {
    draft[name] = name === 'areaId' ? Number(value) : value;
    quote = undefined;
    if (name !== 'voucherCode') {
      eligibility = false;
      alternatives = [];
      const status = view.querySelector('.eligibility');
      if (status) {
        status.querySelector('.pill').textContent = 'Awaiting check';
        status.querySelectorAll('.line').forEach(line => line.remove());
      }
      view.querySelector('[data-action="alternative"]')?.remove();
    }
  }
});

const actions = {
  hub(value) {
    draft.hubId = Number(value);
    draft.alternativeFromHubId = undefined;
    if (!brands().some(([id]) => id === draft.brandId)) draft.brandId = brands()[0]?.[0];
    quote = undefined;
    eligibility = false;
    render();
  },
  brand(value) { draft.brandId = Number(value); quote = undefined; eligibility = false; render(); },
  menu() { if (draft.brandId) go(1); },
  category(value) { category = value; render(); },
  add(value) {
    draft.items.set(Number(value), 1);
    quote = undefined;
    eligibility = false;
    render();
    feedback('Added to your cart', menuItems().find(item => item.id === Number(value)).name,
      button('Continue shopping', 'dismiss') + button('View cart & delivery', 'delivery', 'secondary'));
  },
  amount(value) {
    const [id, delta] = value.split(':').map(Number);
    const quantity = Math.min((draft.items.get(id) || 0) + delta, 99);
    if (quantity > 0) draft.items.set(id, quantity);
    else draft.items.delete(id);
    quote = undefined;
    eligibility = false;
    render();
  },
  delivery() {
    if (count()) go(2);
    else { error = 'Add an item before continuing.'; render(); }
  },
  check() { return run(() => checkDelivery(true)); },
  alternative() {
    const alternative = alternatives[0];
    if (alternative) feedback('Try ' + alternative.name, 'Switch to this hub and recheck delivery eligibility.',
      button('Use ' + alternative.name, 'use-alternative', 'primary', alternative.id) +
      button('Keep current hub', 'dismiss', 'secondary'));
  },
  'use-alternative'(value) {
    dialog.close();
    draft.alternativeFromHubId = draft.hubId;
    draft.hubId = Number(value);
    return run(() => checkDelivery(true));
  },
  review() {
    if (dialog.open) dialog.close();
    return run(async () => {
      if (!eligibility) await checkDelivery(false);
      if (draft.voucherCode) {
        step = 3;
        await refreshQuote();
      }
      go(3);
    });
  },
  quote() {
    return run(async () => {
      await refreshQuote();
      feedback('Voucher updated', 'Your voucher status and order total have been updated.', button('Got it', 'dismiss'));
    });
  },
  'test-voucher'(value) { draft.voucherCode = value; return run(refreshQuote); },
  'remove-voucher'() { draft.voucherCode = ''; return run(refreshQuote); },
  payment() {
    return run(async () => {
      const reviewedTotal = quote?.total;
      await refreshQuote();
      if (reviewedTotal !== quote.total) {
        error = reviewedTotal === undefined
          ? 'Review the latest total, then confirm checkout.'
          : 'Your total changed. Review the updated amount, then confirm checkout again.';
        return;
      }
      go(4);
    });
  },
  'payment-back'() { go(4); },
  customer(value) { if (!paymentAttempted) { draft.username = value; render(); } },
  method(value) { draft.method = value; render(); },
  'continue-payment'() { if (draft.method === 'online') go(5); else return run(() => submit()); },
  processing() { go(5); },
  approve() { return run(() => submit('approve')); },
  decline() { return run(() => submit('decline')); },
  refresh() {
    return run(async () => {
      receipt = await api('status', { orderId: receipt.orderId, username: draft.username, checkoutRef: draft.checkoutRef });
    });
  },
  restart: reset,
  cancel() {
    return run(async () => { await api('cancel', body()); reset(); });
  },
  dismiss() { dialog.close(); },
  back() { if (step !== 0 && step !== 6) go(step === 7 ? 4 : step - 1); },
};

document.querySelector('.checkout').addEventListener('click', event => {
  const target = event.target.closest('button[data-action]');
  if (!target || pending || !catalog) return;
  menu.open = false;
  void actions[target.dataset.action]?.(target.dataset.value);
});

try {
  catalog = await api('catalog');
  reset();
} catch (failure) {
  view.setAttribute('aria-busy', 'false');
  view.textContent = failure.message;
}
