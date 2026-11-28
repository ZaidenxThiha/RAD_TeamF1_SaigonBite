// UC3 JSON boundary. Author: Thin Lei Sandi (523K0075).
import { VoucherError, VoucherService } from './service.mjs';
function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  response.end(JSON.stringify(body));
}
async function input(request) {
  if (request.headers['content-type']?.split(';')[0].trim() !== 'application/json') throw new VoucherError('Send a JSON request.', 415);
  let size = 0; const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 16000) throw new VoucherError('Request is too large.', 413);
    chunks.push(chunk);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw new VoucherError('Send a valid voucher request.', 400); }
}
export function createVoucherHandler(db, options = {}) {
  const service = new VoucherService(db, options.clock);
  return async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      // Local actor simulation follows UC2. Body actor/role fields never grant access.
      const username = request.headers['x-demo-user'];
      service.admin(username);
      if (path === '/api/vouchers') {
        if (request.method === 'GET') return json(response, 200, service.list(username));
        if (request.method === 'POST') return json(response, 201, service.save(username, null, await input(request)));
      }
      const match = /^\/api\/vouchers\/(\d+)(\/archive)?$/.exec(path);
      if (match) {
        const id = Number(match[1]);
        if (!match[2] && request.method === 'GET') return json(response, 200, service.details(username, id));
        if (!match[2] && request.method === 'PUT') return json(response, 200, service.save(username, id, await input(request)));
        if (match[2] && request.method === 'POST') return json(response, 200, service.archive(username, id, await input(request)));
      }
      json(response, 404, { code: 'NOT_FOUND', message: 'Voucher action not found.' });
    } catch (error) {
      if (error instanceof VoucherError) return json(response, error.status, { code: error.code, message: error.message, fields: error.fields });
      console.error(error);
      json(response, 500, { code: 'SAVE_FAILED', message: 'Could not complete the request. Refresh vouchers before trying again.' });
    }
  };
}
