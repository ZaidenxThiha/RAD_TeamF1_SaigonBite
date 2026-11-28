import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { openDatabase } from './database.mjs';
import { handleCheckout } from './uc1/http.mjs';
import { handleReports } from './reports-page.mjs';
import { createKitchenHandler } from './uc2/http.mjs';

const db = openDatabase();
const managerPassword = process.env.SAIGONBITE_MANAGER_PASSWORD;
const handleKitchen = createKitchenHandler(db, {
  notify: () => process.env.SAIGONBITE_NOTIFICATION_FAIL === '1' ? 'failed' : 'sent',
});
const assets = new Map([
  ['/reports.js', ['reports.js', 'text/javascript; charset=utf-8']],
  ['/reports.css', ['reports.css', 'text/css; charset=utf-8']],
  ['/', ['uc1/checkout.html', 'text/html; charset=utf-8']],
  ['/checkout.css', ['uc1/checkout.css', 'text/css; charset=utf-8']],
  ['/checkout.js', ['uc1/checkout.js', 'text/javascript; charset=utf-8']],
  ['/kitchen', ['uc2/kitchen.html', 'text/html; charset=utf-8']],
  ['/kitchen/', ['uc2/kitchen.html', 'text/html; charset=utf-8']],
  ['/uc2/kitchen.css', ['uc2/kitchen.css', 'text/css; charset=utf-8']],
  ['/uc2/kitchen.js', ['uc2/kitchen.js', 'text/javascript; charset=utf-8']],
  ['/shared/layout.js', ['shared/layout.js', 'text/javascript; charset=utf-8']],
  ['/shared/layout.css', ['shared/layout.css', 'text/css; charset=utf-8']],
]);
const server = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    try {
      db.prepare('SELECT 1 FROM hubs LIMIT 1').get();
      response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}');
    } catch {
      response.writeHead(503, { 'Content-Type': 'application/json' }).end('{"status":"unavailable"}');
    }
    return;
  }

  if (request.method === 'GET' && request.url.split('?')[0] === '/reports') {
    return handleReports(db, request, response, new URL(request.url, 'http://localhost'), managerPassword);
  }

  if (request.method === 'GET' && /^\/prototype\/[a-z-]+\.svg$/.test(request.url)) {
    const file = new URL('../public/shared' + request.url, import.meta.url);
    if (!existsSync(file)) return response.writeHead(404).end();
    return response.writeHead(200, {
      'Content-Type': 'image/svg+xml', 'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    }).end(readFileSync(file));
  }

  const asset = request.method === 'GET' && assets.get(request.url);
  if (asset) {
    const [name, contentType] = asset;
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'self'; frame-ancestors 'none'; form-action 'self'",
    }).end(readFileSync(new URL(`../public/${name}`, import.meta.url)));
    return;
  }

  if (request.url.startsWith('/api/kitchen/')) {
    void handleKitchen(request, response);
    return;
  }
  if (request.url.startsWith('/api/checkout/')) {
    void handleCheckout(db, request, response);
    return;
  }
  response.writeHead(404).end();
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, '127.0.0.1', () => {
  console.log(`SaigonBite checkout at http://127.0.0.1:${server.address().port}/`);
});
server.on('close', () => db.close());
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
