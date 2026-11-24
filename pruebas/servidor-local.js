// Prueba local: node pruebas/servidor-local.js  ->  http://localhost:4173
// Los mails no se envían: se ven en http://localhost:4173/correos
const http = require('http');
const fs = require('fs');
const path = require('path');
const PUERTO = 4173;
const google = require('./google-simulado')(`http://localhost:${PUERTO}/`);
const raiz = path.join(__dirname, '../docs');
const TIPOS = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };

http.createServer((req, res) => {
  const ruta = new URL(req.url, 'http://x').pathname;
  if (req.method === 'POST' && ruta === '/api') {
    let cuerpo = '';
    req.on('data', (d) => { cuerpo += d; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(google.pedir(cuerpo)));
    });
    return;
  }
  if (ruta === '/correos') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(google.correos.map(({ to, name, replyTo, subject, body }) => ({ to, name, replyTo, subject, body })), null, 2));
    return;
  }
  const archivo = path.join(raiz, ruta === '/' ? 'index.html' : path.normalize(ruta));
  if (!archivo.startsWith(raiz) || !fs.existsSync(archivo)) { res.statusCode = 404; res.end('No existe'); return; }
  res.setHeader('Content-Type', TIPOS[path.extname(archivo)] || 'text/plain');
  res.setHeader('Cache-Control', 'no-store');
  res.end(fs.readFileSync(archivo));
}).listen(PUERTO, '127.0.0.1');
