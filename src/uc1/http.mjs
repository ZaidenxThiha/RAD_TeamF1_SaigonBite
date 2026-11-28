import { cancelCheckout, CheckoutError, checkoutCatalog, customerOrderStatus, demoCustomer, quoteOrder, submitCheckout } from './service.mjs';

const actions = {
  '/api/checkout/quote': (db, customer, input) => quoteOrder(db, input),
  '/api/checkout/submit': submitCheckout,
  '/api/checkout/cancel': cancelCheckout,
  '/api/checkout/status': customerOrderStatus,
};

function sendJson(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(data));
}

async function readInput(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json') {
    throw new CheckoutError('Send a JSON request.', 415);
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 16000) throw new CheckoutError('The order request is too large.', 413);
    chunks.push(chunk);
  }
  try {
    const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error();
    return input;
  } catch {
    throw new CheckoutError('Send a valid order request.', 400);
  }
}

export async function handleCheckout(db, request, response) {
  try {
    if (request.method === 'GET' && request.url === '/api/checkout/catalog') {
      sendJson(response, 200, checkoutCatalog(db));
      return;
    }
    if (request.method === 'POST' && Object.hasOwn(actions, request.url)) {
      const input = await readInput(request);
      const customer = demoCustomer(db, input.username);
      sendJson(response, 200, actions[request.url](db, customer, input));
      return;
    }
    sendJson(response, 404, { message: 'Checkout action not found.' });
  } catch (error) {
    if (error instanceof CheckoutError) {
      sendJson(response, error.status, { message: error.message, alternatives: error.alternatives });
      return;
    }
    console.error(error);
    sendJson(response, 500, { message: 'Checkout could not complete. Try again.' });
  }
}
