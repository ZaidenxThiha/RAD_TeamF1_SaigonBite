const form = document.querySelector('#checkout');
const fields = form.elements;
const status = document.querySelector('#status');
const orderFields = document.querySelector('#order-fields');
const menu = document.querySelector('#menu');
const quotePanel = document.querySelector('#quote');
const quoteError = document.querySelector('#quote-error');
const alternatives = document.querySelector('#alternatives');
const payment = document.querySelector('#payment');
const paymentError = document.querySelector('#payment-error');
const simulation = document.querySelector('#simulation');
const receipt = document.querySelector('#receipt');
const review = document.querySelector('#review');
const place = document.querySelector('#place');
const cancel = document.querySelector('#cancel');
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

let catalog;
let quote;
let checkoutRef = crypto.randomUUID();
let alternativeFromHubId;
let pending = false;
let paymentAttempted = false;

async function api(action, body) {
  const response = await fetch('/api/checkout/' + action, body && {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message), { alternatives: data.alternatives });
  return data;
}

function showError(element, message = '') {
  element.textContent = message;
  element.hidden = !message;
}

function rows(element, details) {
  element.replaceChildren(...details.map(([label, value]) => {
    const row = document.createElement('div');
    const term = document.createElement('dt');
    const data = document.createElement('dd');
    term.textContent = label;
    data.textContent = value;
    if (label === 'Total') row.className = 'total';
    row.append(term, data);
    return row;
  }));
}

function renderMenu(preserve = new Map()) {
  const available = catalog.menu.filter(item => item.hubId === Number(fields.hubId.value));
  const previousBrand = fields.brandId.value;
  const brands = new Map(available.map(item => [item.brandId, item.brand]));
  fields.brandId.replaceChildren(...[...brands].map(([id, name]) => new Option(name, id)));
  if (brands.has(Number(previousBrand))) fields.brandId.value = previousBrand;

  menu.replaceChildren(...available.filter(item => item.brandId === Number(fields.brandId.value)).map(item => {
    const line = document.createElement('div');
    line.className = 'line';
    const description = document.createElement('div');
    const name = document.createElement('strong');
    const price = document.createElement('p');
    name.textContent = item.name;
    price.textContent = money.format(item.price);
    description.append(name, price);
    const label = document.createElement('label');
    label.append('Qty');
    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.min = '0';
    quantity.max = '99';
    quantity.step = '1';
    quantity.value = preserve.get(item.id) ?? 0;
    quantity.dataset.item = item.id;
    quantity.setAttribute('aria-label', 'Quantity for ' + item.name);
    label.append(quantity);
    line.append(description, label);
    return line;
  }));
  if (!menu.childElementCount) menu.textContent = 'There are no available items for this hub.';
}

function currentItems() {
  return [...menu.querySelectorAll('input')].map(input => ({
    itemId: Number(input.dataset.item), quantity: Number(input.value),
  })).filter(item => item.quantity > 0);
}

function requestBody() {
  return {
    checkoutRef, alternativeFromHubId,
    username: fields.username.value,
    hubId: Number(fields.hubId.value),
    brandId: Number(fields.brandId.value),
    areaId: Number(fields.areaId.value),
    address: fields.address.value,
    voucherCode: fields.voucherCode.value,
    items: currentItems(),
    method: fields.method.value,
    simulation: fields.simulation.value,
    expectedTotal: quote?.total,
  };
}

function syncControls() {
  orderFields.disabled = pending;
  fields.username.disabled = paymentAttempted;
  fields.voucherCode.disabled = pending;
  review.disabled = pending;
  payment.disabled = pending;
  cancel.disabled = pending;
  cancel.hidden = !quote && !paymentAttempted;
}

function clearQuote() {
  quote = undefined;
  quotePanel.hidden = true;
  payment.hidden = true;
  showError(quoteError);
  showError(paymentError);
  alternatives.replaceChildren();
  syncControls();
}

function showAlternatives(options = []) {
  alternatives.replaceChildren(...options.map(hub => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Try ' + hub.name;
    button.onclick = () => {
      if (pending) return;
      const items = new Map(currentItems().map(item => [item.itemId, item.quantity]));
      alternativeFromHubId = Number(fields.hubId.value);
      fields.hubId.value = hub.id;
      renderMenu(items);
      void reviewOrder();
    };
    return button;
  }));
}

async function reviewOrder() {
  if (pending || !form.reportValidity()) return;
  clearQuote();
  status.textContent = '';
  const body = requestBody();
  pending = true;
  syncControls();
  try {
    quote = await api('quote', body);
    rows(quotePanel, [
      ...quote.items.map(i => [`${i.quantity} × ${i.name}`, money.format(i.price * i.quantity)]),
      ['Subtotal', money.format(quote.subtotal)],
      ['Delivery fee', money.format(quote.deliveryFee)],
      ['Quiet hub incentive', money.format(quote.quietIncentive)],
      ['Voucher discount', money.format(quote.voucherDiscount)],
      ['Total', money.format(quote.total)],
    ]);
    quotePanel.hidden = payment.hidden = false;
    place.textContent = 'Place order · ' + money.format(quote.total);
  } catch (error) {
    showError(quoteError, error.message);
    showAlternatives(error.alternatives);
  } finally {
    pending = false;
    syncControls();
  }
}

review.onclick = reviewOrder;
form.addEventListener('input', (event) => {
  if (payment.contains(event.target)) {
    simulation.hidden = fields.method.value !== 'online';
    return;
  }
  if (event.target === fields.hubId) {
    alternativeFromHubId = undefined;
    renderMenu();
  } else if (event.target === fields.brandId) {
    renderMenu();
  }
  clearQuote();
});

form.onsubmit = async (event) => {
  event.preventDefault();
  if (pending || !quote) return;
  showError(paymentError);
  const body = requestBody();
  pending = true;
  syncControls();
  try {
    const result = await api('submit', body);
    if (result.status === 'PaymentDeclined') {
      paymentAttempted = true;
      showError(paymentError, 'Payment declined. Retry, switch to cash on delivery, or edit your order and review the total again.');
      return;
    }
    rows(receipt.querySelector('dl'), [
      ['Order', '#' + result.orderId], ['Status', result.status], ['Kitchen hub', result.hubName],
      ['Payment', result.method === 'cod' ? 'Cash on delivery' : 'Online payment'],
      ['Total', money.format(result.total)],
    ]);
    form.hidden = true;
    receipt.hidden = false;
    document.querySelector('#restart').focus();
  } catch (error) {
    showError(paymentError, error.message);
  } finally {
    pending = false;
    syncControls();
  }
};

cancel.onclick = async () => {
  if (pending) return;
  const body = requestBody();
  pending = true;
  syncControls();
  try {
    await api('cancel', body);
    checkoutRef = crypto.randomUUID();
    paymentAttempted = false;
    clearQuote();
    status.textContent = 'Checkout cancelled.';
  } catch (error) {
    showError(payment.hidden ? quoteError : paymentError, error.message);
  } finally {
    pending = false;
    syncControls();
  }
};

document.querySelector('#restart').onclick = () => {
  checkoutRef = crypto.randomUUID();
  paymentAttempted = false;
  alternativeFromHubId = undefined;
  form.reset();
  renderMenu();
  clearQuote();
  simulation.hidden = receipt.hidden = true;
  form.hidden = false;
  syncControls();
  fields.hubId.focus();
};

try {
  catalog = await api('catalog');
  fields.hubId.replaceChildren(...catalog.hubs.map(hub => new Option(hub.name, hub.id)));
  fields.areaId.replaceChildren(...catalog.areas.map(area => new Option(area.name, area.id)));
  renderMenu();
  form.hidden = false;
} catch (error) {
  status.textContent = error.message;
}
