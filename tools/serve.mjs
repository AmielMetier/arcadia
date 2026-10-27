/**
 * serve.mjs — Serveur HTTP local ultra-léger sans dépendances pour tester Duo-Drift et Phare dans la nuit.
 * Lancement : node tools/serve.mjs [port]
 */

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || process.env.PORT || '8000', 10);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.jsonl': 'application/x-ndjson; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

const CRASH_DIR = path.join(ROOT, 'logs', 'crash');
const JSONL_FILE = path.join(CRASH_DIR, 'crash-events.jsonl');
const LATEST_FILE = path.join(CRASH_DIR, 'latest.json');

function appendCrashLog(entry) {
  try {
    fs.mkdirSync(CRASH_DIR, { recursive: true });
    fs.appendFileSync(JSONL_FILE, JSON.stringify(entry) + '\n', 'utf8');
    let list = [];
    if (fs.existsSync(LATEST_FILE)) {
      try { list = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8')); } catch (e) { list = []; }
    }
    if (!Array.isArray(list)) list = [];
    list.unshift(entry);
    fs.writeFileSync(LATEST_FILE, JSON.stringify(list.slice(0, 200), null, 2) + '\n', 'utf8');
  } catch (e) {
    console.error('Erreur écriture log crash :', e);
  }
}

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);

  if (req.method === 'POST' && urlPath === '/api/log') {
    let body = '';
    req.on('data', (chunk) => { if (body.length < 32768) body += chunk; });
    req.on('end', () => {
      try {
        const entry = JSON.parse(body);
        if (entry && typeof entry === 'object') appendCrashLog(entry);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: false }));
      }
    });
    return;
  }

  if (req.method === 'GET' && urlPath === '/api/logs') {
    let list = [];
    try {
      if (fs.existsSync(LATEST_FILE)) list = JSON.parse(fs.readFileSync(LATEST_FILE, 'utf8'));
    } catch (e) {}
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify(list));
    return;
  }

  let safePath = path.normalize(path.join(ROOT, urlPath));

  if (!safePath.startsWith(ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Accès interdit');
    return;
  }

  // Si c'est un dossier, tenter d'ouvrir index.html
  if (fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()) {
    safePath = path.join(safePath, 'index.html');
  }

  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Non trouvé : ' + urlPath);
    return;
  }

  const ext = path.extname(safePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': contentType,
    'Cache-Control': 'no-cache, no-store, must-revalidate'
  });
  fs.createReadStream(safePath).pipe(res);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n============================================================`);
  console.log(`  Serveur Duo-Drift en ligne : http://localhost:${PORT}/`);
  console.log(`  Jeu direct Phare :         http://localhost:${PORT}/phare/`);
  console.log(`============================================================\n`);
});
