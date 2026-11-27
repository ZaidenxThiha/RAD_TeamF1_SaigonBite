import { createServer } from 'node:http';
import { openDatabase } from './database.mjs';

const db = openDatabase();
const server = createServer((request, response) => {
  if (request.method !== 'GET' || request.url !== '/health') {
    response.writeHead(404).end();
    return;
  }

  try {
    db.prepare('SELECT 1 FROM hubs LIMIT 1').get();
    response.writeHead(200, { 'Content-Type': 'application/json' }).end('{"status":"ok"}');
  } catch {
    response.writeHead(503, { 'Content-Type': 'application/json' }).end('{"status":"unavailable"}');
  }
});

const port = Number(process.env.PORT ?? 4173);
server.listen(port, '127.0.0.1', () => {
  console.log(`SaigonBite health check at http://127.0.0.1:${server.address().port}/health`);
});
server.on('close', () => db.close());
process.once('SIGINT', () => server.close());
process.once('SIGTERM', () => server.close());
