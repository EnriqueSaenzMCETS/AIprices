'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { pipeline } = require('node:stream');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function inside(root, filename) {
  const relative = path.relative(root, filename);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function createServer(directory = __dirname) {
  const root = fs.realpathSync(directory);
  return http.createServer(async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');

    function reply(status, message) {
      response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end(request.method === 'HEAD' ? undefined : message);
    }

    if (!['GET', 'HEAD'].includes(request.method)) {
      response.setHeader('Allow', 'GET, HEAD');
      reply(405, 'Método no permitido.');
      return;
    }

    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
      if (pathname.includes('\0') || pathname.includes('\\')) throw new Error('Ruta inválida');
    } catch {
      reply(400, 'Ruta inválida.');
      return;
    }

    if (pathname.endsWith('/')) pathname += 'index.html';
    const filename = path.resolve(root, '.' + pathname);
    if (!inside(root, filename)) {
      reply(403, 'Ruta no permitida.');
      return;
    }

    try {
      const realFilename = await fs.promises.realpath(filename);
      if (!inside(root, realFilename)) {
        reply(403, 'Ruta no permitida.');
        return;
      }
      const stat = await fs.promises.stat(realFilename);
      if (!stat.isFile()) {
        reply(404, 'Archivo no encontrado.');
        return;
      }
      response.writeHead(200, {
        'Content-Type': MIME_TYPES[path.extname(realFilename).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
      });
      if (request.method === 'HEAD') {
        response.end();
        return;
      }
      pipeline(fs.createReadStream(realFilename), response, () => {});
    } catch (error) {
      if (!response.headersSent) reply(['ENOENT', 'ENOTDIR'].includes(error.code) ? 404 : 500, 'No se pudo leer el archivo.');
      else response.destroy();
    }
  });
}

function main(args = process.argv.slice(2)) {
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Uso: node server.js [--port 8000]\nTambién admite PORT. Servidor local en 127.0.0.1.');
    return;
  }
  let portValue = process.env.PORT || '8000';
  if (args.length) {
    if (args.length !== 2 || args[0] !== '--port') {
      console.error('Uso: node server.js [--port 8000]');
      process.exitCode = 1;
      return;
    }
    portValue = args[1];
  }
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('El puerto debe ser un entero entre 1 y 65535.');
    process.exitCode = 1;
    return;
  }
  const server = createServer();
  server.once('error', error => {
    console.error(`No se pudo iniciar el servidor: ${error.message}. Prueba --port 8001.`);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Abre http://127.0.0.1:${port}/ — Ctrl+C para detener.`);
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close());
}

if (require.main === module) main();
module.exports = { createServer };
