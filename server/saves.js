'use strict';
// Sauvegardes en ligne des jeux du Hub (Odyssée) : rangées dans le dépôt GitHub, sur une branche à part (« saves »).
// Le disque de Render est effacé à chaque redémarrage : GitHub sert de stockage durable.
//
// Identité : la clé secrète du compte Hub (celle des amis, emportée par le code de transfert). Le serveur en tire le code
// ami public (8 caractères) et range la partie dans saves/<jeu>/<CODE>.json. Sans la clé, impossible d'écrire à la place
// de quelqu'un ; la clé ne quitte jamais le serveur et n'est jamais écrite dans le dépôt.
//
// Configuration (variables d'environnement sur Render) :
//   GITHUB_TOKEN   jeton GitHub (fine-grained) avec « Contents : Read and write » sur le dépôt — obligatoire
//   SAVES_REPO     dépôt, par défaut AmielMetier/duo-drift
//   SAVES_BRANCH   branche, par défaut saves (créée automatiquement si elle n'existe pas)
//   SAVES_API      adresse de l'API (tests), par défaut https://api.github.com
//
// Routes (corps en text/plain contenant du JSON : pas de requête préalable CORS) :
//   GET  /save/status                 → { on }
//   POST /save/<jeu>/get  { key }     → { ok, save | null }
//   POST /save/<jeu>/put  { key, code, meta } → { ok, updated }   (au plus une écriture GitHub par compte toutes les 20 s)
const crypto = require('crypto');

const TOKEN = process.env.GITHUB_TOKEN || '';
const REPO = process.env.SAVES_REPO || 'AmielMetier/duo-drift';
const BRANCH = process.env.SAVES_BRANCH || 'saves';
const API = (process.env.SAVES_API || 'https://api.github.com').replace(/\/$/, '');
const GAMES = new Set(['odyssee']);
const MAX_CODE = 400 * 1024, MAX_BODY = 450 * 1024;
const WRITE_GAP_MS = Number(process.env.SAVES_GAP_MS) || 20000;

const FID_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function fidOf(key) {
  const h = crypto.createHash('sha256').update('ddhub-friend:' + key).digest();
  let out = ''; for (let k = 0; k < 8; k++) out += FID_ALPHA[h[k] & 31];
  return out;
}
const validKey = (k) => typeof k === 'string' && k.length >= 16 && k.length <= 64;

// cache mémoire : dernière version connue de chaque fichier (sha GitHub, contenu) et écritures en attente
const files = new Map();   // chemin → { sha, data, t }
const pending = new Map(); // chemin → { data, timer, waiters }
let branchReady = null;

async function gh(method, url, body) {
  const res = await fetch(API + url, {
    method,
    headers: { Authorization: 'Bearer ' + TOKEN, Accept: 'application/vnd.github+json', 'User-Agent': 'duo-drift-relay', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null; try { json = await res.json(); } catch (e) {}
  return { status: res.status, json };
}

/** la branche des sauvegardes existe-t-elle ? sinon on la crée depuis la branche par défaut */
function ensureBranch() {
  if (!branchReady) branchReady = (async () => {
    const r = await gh('GET', `/repos/${REPO}/git/ref/heads/${BRANCH}`);
    if (r.status === 200) return true;
    const repo = await gh('GET', `/repos/${REPO}`);
    const base = repo.json && repo.json.default_branch;
    const ref = base && await gh('GET', `/repos/${REPO}/git/ref/heads/${base}`);
    const sha = ref && ref.json && ref.json.object && ref.json.object.sha;
    if (!sha) throw new Error('branche introuvable');
    const c = await gh('POST', `/repos/${REPO}/git/refs`, { ref: `refs/heads/${BRANCH}`, sha });
    if (c.status !== 201 && c.status !== 422) throw new Error('création de branche : ' + c.status);
    return true;
  })().catch((e) => { branchReady = null; throw e; });
  return branchReady;
}

async function readFile(p) {
  const c = files.get(p);
  if (c && Date.now() - c.t < 60000) return c;
  const r = await gh('GET', `/repos/${REPO}/contents/${p}?ref=${encodeURIComponent(BRANCH)}`);
  if (r.status === 404) { const e = { sha: null, data: null, t: Date.now() }; files.set(p, e); return e; }
  if (r.status !== 200 || !r.json) throw new Error('lecture GitHub : ' + r.status);
  let data = null;
  try { data = JSON.parse(Buffer.from(r.json.content || '', 'base64').toString('utf8')); } catch (e) {}
  const e = { sha: r.json.sha, data, t: Date.now() };
  files.set(p, e);
  return e;
}

async function writeFile(p, data, msg) {
  await ensureBranch();
  for (let attempt = 0; attempt < 3; attempt++) {
    const cur = files.get(p) || await readFile(p);
    const body = { message: msg, content: Buffer.from(JSON.stringify(data, null, 1) + '\n').toString('base64'), branch: BRANCH };
    if (cur.sha) body.sha = cur.sha;
    const r = await gh('PUT', `/repos/${REPO}/contents/${p}`, body);
    if (r.status === 200 || r.status === 201) { files.set(p, { sha: r.json.content.sha, data, t: Date.now() }); return; }
    if (r.status === 409 || r.status === 422) { files.delete(p); await readFile(p); continue; } // sha périmé : on relit
    throw new Error('écriture GitHub : ' + r.status);
  }
  throw new Error('écriture GitHub : conflit');
}

/** regroupe les écritures d'un même compte : la plus récente part au plus tard WRITE_GAP_MS après la précédente */
function queueWrite(p, data, msg) {
  return new Promise((resolve, reject) => {
    let q = pending.get(p);
    if (!q) { q = { data, msg, waiters: [], last: (files.get(p) || {}).written || 0 }; pending.set(p, q); }
    q.data = data; q.msg = msg; q.waiters.push({ resolve, reject });
    if (q.timer || q.running) return;
    const go = async () => {
      q.timer = null; q.running = true;
      const { data: d, msg: m } = q, ws = q.waiters.splice(0);
      try { await writeFile(p, d, m); files.get(p).written = Date.now(); ws.forEach((w) => w.resolve()); } catch (e) { ws.forEach((w) => w.reject(e)); }
      q.running = false; q.last = Date.now();
      if (q.waiters.length) q.timer = setTimeout(go, WRITE_GAP_MS); else pending.delete(p);
    };
    const wait = Math.max(0, q.last + WRITE_GAP_MS - Date.now());
    q.timer = setTimeout(go, wait);
  });
}

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}

/** renvoie true si la requête concerne les sauvegardes (et y répond) */
function handle(req, res, route) {
  if (!route.startsWith('/save/')) return false;
  if (route === '/save/status') { send(res, 200, { ok: true, on: !!TOKEN }); return true; }
  const m = /^\/save\/([a-z]+)\/(get|put)$/.exec(route);
  if (!m || req.method !== 'POST' || !GAMES.has(m[1])) { send(res, 404, { ok: false, error: 'route' }); return true; }
  if (!TOKEN) { req.resume(); send(res, 503, { ok: false, error: 'off' }); return true; }
  let body = '', big = false;
  req.on('data', (c) => { if (body.length + c.length > MAX_BODY) { big = true; return; } body += c; });
  req.on('end', async () => {
    if (big) { send(res, 413, { ok: false, error: 'big' }); return; }
    let q; try { q = JSON.parse(body); } catch (e) { send(res, 400, { ok: false, error: 'json' }); return; }
    if (!q || !validKey(q.key)) { send(res, 400, { ok: false, error: 'key' }); return; }
    const fid = fidOf(q.key), p = `saves/${m[1]}/${fid}.json`;
    try {
      if (m[2] === 'get') {
        const f = pending.get(p) ? { data: pending.get(p).data } : await readFile(p);
        send(res, 200, { ok: true, fid, save: f.data || null });
        return;
      }
      if (typeof q.code !== 'string' || !q.code.startsWith('ODY1.') || q.code.length > MAX_CODE) { send(res, 400, { ok: false, error: 'code' }); return; }
      const meta = q.meta && typeof q.meta === 'object' ? q.meta : {};
      const clean = (s, n) => String(s || '').replace(/[<>&"\n\r]/g, '').slice(0, n);
      const data = {
        v: 1, game: m[1], fid, updated: new Date().toISOString(),
        name: clean(meta.name, 12), badges: Math.max(0, Math.min(8, meta.badges | 0)), dex: Math.max(0, Math.min(999, meta.dex | 0)), time: Math.max(0, Number(meta.time) || 0),
        code: q.code,
      };
      const msg = `Sauvegarde ${m[1]} · ${fid} · ${data.name} (${data.badges} badges)`;
      // écriture regroupée si le joueur sauvegarde souvent : on attend au plus 8 s, sinon elle suit en arrière-plan
      const w = queueWrite(p, data, msg);
      w.catch((e) => console.error(new Date().toISOString(), 'sauvegarde', fid, e.message));
      const done = await Promise.race([w.then(() => 'saved'), new Promise((r) => setTimeout(() => r('queued'), 8000))]);
      send(res, 200, { ok: true, fid, updated: data.updated, [done]: true });
    } catch (e) {
      console.error(new Date().toISOString(), 'sauvegarde', e.message);
      send(res, 502, { ok: false, error: 'github' });
    }
  });
  return true;
}

module.exports = { handle, fidOf, _state: { files, pending } };
