import http from 'node:http';
import fs from 'node:fs/promises';

const port = Number(process.env.PORT || 4173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

const publicRoot = new URL('../public/', import.meta.url);
const routes = new Map([
  ['/', ['index.html', 'text/html; charset=utf-8']],
  ['/index.html', ['index.html', 'text/html; charset=utf-8']],
  ['/app.js', ['app.js', 'text/javascript; charset=utf-8']],
  ['/model.js', ['model.js', 'text/javascript; charset=utf-8']],
  ['/style.css', ['style.css', 'text/css; charset=utf-8']],
]);

const server = http.createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = new URL(request.url, 'http://localhost').pathname;
  } catch {
    response.writeHead(400);
    response.end('Invalid request');
    return;
  }

  const route = routes.get(pathname);
  if (!route) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  try {
    const data = await fs.readFile(new URL(route[0], publicRoot));
    response.writeHead(200, {
      'Content-Type': route[1],
      'Content-Length': data.byteLength,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch (error) {
    console.error('Could not serve ' + route[0] + ': ' + error.message);
    response.writeHead(500);
    response.end('Could not load the requested file');
  }
});

server.on('error', (error) => {
  console.error(error.code === 'EADDRINUSE'
    ? 'Port ' + port + ' is already in use. Set PORT to another available port.'
    : error.message);
  process.exitCode = 1;
});

server.listen(port, '127.0.0.1', () => {
  console.log('Cave Workshop: http://localhost:' + port);
  console.log('Press Ctrl+C to stop. No installation or build step is required.');
});
