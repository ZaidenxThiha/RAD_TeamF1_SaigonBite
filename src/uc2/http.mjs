// UC2 HTTP adapter. Author: Thin Lei Sandi (523K0075).
import { KitchenError, KitchenService } from './service.mjs';

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function input(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') {
    throw new KitchenError('Send a JSON request.', 415, 'INVALID_INPUT');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16000) throw new KitchenError('Request is too large.', 413, 'INVALID_INPUT');
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch {
    throw new KitchenError('Send a valid decision request.', 400, 'INVALID_INPUT');
  }
}

export function createKitchenHandler(db, options = {}) {
  const service = new KitchenService(db, options.notify);
  return async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      // Loopback demo identity, consistent with UC1. Never trust body staffId/hubId.
      const username = request.headers['x-demo-user'];
      service.staff(username);
      if (path === '/api/kitchen/orders' && request.method === 'GET') {
        json(response, 200, service.queue(username));
        return;
      }
      const match = /^\/api\/kitchen\/orders\/(\d+)(\/decision)?$/.exec(path);
      if (match && request.method === 'GET' && !match[2]) {
        json(response, 200, service.details(username, Number(match[1])));
        return;
      }
      if (match && request.method === 'POST' && match[2]) {
        const body = await input(request);
        json(response, 200, await service.decide(username, Number(match[1]), body));
        return;
      }
      json(response, 404, { code: 'NOT_FOUND', message: 'Kitchen action not found.' });
    } catch (error) {
      if (error instanceof KitchenError) json(response, error.status, { code: error.code, message: error.message });
      else {
        console.error(error);
        json(response, 500, { code: 'SAVE_FAILED', message: 'Could not complete the request. Refresh the queue before trying again.' });
      }
    }
  };
}
