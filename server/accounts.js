'use strict';
// Comptes Arcadia : identifiant + mot de passe, rangés dans le dépôt GitHub (branche « saves », dossier accounts/).
//
// Le mot de passe ne quitte jamais le navigateur. Le navigateur en tire deux clés (PBKDF2, 250 000 tours) :
//   - une clé d'accès, envoyée ici : le serveur n'en garde qu'une empreinte scrypt salée (comme un mot de passe) ;
//   - une clé de chiffrement, qui reste dans le navigateur : le profil (pseudo, couleur, code ami, amis…) est chiffré
//     en AES-GCM avant d'être envoyé. Le dépôt GitHub ne contient donc que du chiffré ; même le nom du fichier est une
//     empreinte de l'identifiant.
// Conséquence : un mot de passe oublié ne peut pas être récupéré (personne, pas même le serveur, ne peut déchiffrer).
//
// Routes (corps text/plain contenant du JSON, comme les sauvegardes) :
//   POST /account/create { user, auth, blob }  → { ok } | 409 identifiant pris
//   POST /account/login  { user, auth }        → { ok, blob, updated } | 403 mauvais mot de passe
//   POST /account/put    { user, auth, blob }  → { ok, updated }
//   POST /account/vipkey { user, auth }        → { ok, key } | 403 mauvais mot de passe ou pas VIP | 503 pas de clé
//   POST /account/vipseed { key }              → { ok } | 403 la clé n'ouvre pas le coffre
//   GET  /account/status                       → { on, vipkey }
//
// /account/vipkey : la clé du coffre VIP des Backrooms, que le relais garde lui-même (voir vip.js : jamais dans le
// dépôt), donnée aux seuls comptes VIP (liste de hub/vip.js) qui prouvent leur mot de passe. /account/vipseed la lui
// apprend : seule la vraie clé (celle qui ouvre le témoin du coffre) est acceptée.
const crypto = require('crypto');
const saves = require('./saves');
const vip = require('./vip');

const MAX_BODY = 200 * 1024, MAX_BLOB = 150 * 1024;
const USER_RE = /^[a-z0-9_.-]{3,20}$/;
const AUTH_RE = /^[0-9a-f]{64}$/;
// essais de connexion : au plus 8 ratés par identifiant et par adresse en 10 minutes (contre les essais à la chaîne)
const FAILS = new Map(); const FAIL_WIN = 10 * 60 * 1000, FAIL_MAX = 8;

const pathOf = (user) => `accounts/${crypto.createHash('sha256').update('arcadia-account:' + user).digest('hex').slice(0, 32)}.json`;
const scrypt = (auth, salt) => new Promise((ok, ko) => crypto.scrypt(auth, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? ko(e) : ok(k))));
const validBlob = (b) => b && typeof b === 'object' && typeof b.iv === 'string' && typeof b.ct === 'string' && b.iv.length <= 64 && b.ct.length <= MAX_BLOB;

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj));
}
function tooMany(key) {
  const now = Date.now(), f = (FAILS.get(key) || []).filter((t) => now - t < FAIL_WIN);
  FAILS.set(key, f);
  return f.length >= FAIL_MAX;
}
function failed(key) { (FAILS.get(key) || FAILS.set(key, []).get(key)).push(Date.now()); }

async function check(rec, auth) {
  if (!rec || !rec.hash || !rec.salt) return false;
  const k = await scrypt(auth, Buffer.from(rec.salt, 'base64'));
  const want = Buffer.from(rec.hash, 'base64');
  return want.length === k.length && crypto.timingSafeEqual(want, k);
}

/** renvoie true si la requête concerne les comptes (et y répond) */
function handle(req, res, route) {
  if (!route.startsWith('/account/')) return false;
  if (route === '/account/status') {
    vip.vaultKey().catch(() => '').then((k) => send(res, 200, { ok: true, on: saves.enabled(), vipkey: !!k }));
    return true;
  }
  const m = /^\/account\/(create|login|put|vipkey|vipseed)$/.exec(route);
  if (!m || req.method !== 'POST') { send(res, 404, { ok: false, error: 'route' }); return true; }
  if (!saves.enabled()) { req.resume(); send(res, 503, { ok: false, error: 'off' }); return true; }
  let body = '', big = false;
  req.on('data', (c) => { if (body.length + c.length > MAX_BODY) { big = true; return; } body += c; });
  req.on('end', async () => {
    if (big) { send(res, 413, { ok: false, error: 'big' }); return; }
    let q; try { q = JSON.parse(body); } catch (e) { send(res, 400, { ok: false, error: 'json' }); return; }
    if (m[1] === 'vipseed') {
      // la clé du coffre VIP : pas de compte à prouver, seule la vraie clé passe (et les ratés comptent)
      const lim = 'vipseed|' + String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
      if (tooMany(lim)) { send(res, 429, { ok: false, error: 'wait' }); return; }
      try {
        const r = await vip.seed(q && q.key);
        if (r === 'wrong') failed(lim);
        send(res, r === 'ok' ? 200 : r === 'wrong' ? 403 : 503, r === 'ok' ? { ok: true } : { ok: false, error: r });
      } catch (e) {
        console.error(new Date().toISOString(), 'coffre VIP', e.message);
        send(res, 502, { ok: false, error: 'github' });
      }
      return;
    }
    const user = String((q && q.user) || '').toLowerCase();
    if (!USER_RE.test(user) || !AUTH_RE.test(String(q.auth || ''))) { send(res, 400, { ok: false, error: 'input' }); return; }
    const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim();
    const p = pathOf(user), lim = user + '|' + ip;
    try {
      const f = await saves.readFile(p);
      const rec = f.data;
      if (m[1] === 'create') {
        if (rec) { send(res, 409, { ok: false, error: 'taken' }); return; }
        if (!validBlob(q.blob)) { send(res, 400, { ok: false, error: 'blob' }); return; }
        const salt = crypto.randomBytes(16);
        const hash = await scrypt(q.auth, salt);
        const data = { v: 1, salt: salt.toString('base64'), hash: hash.toString('base64'), blob: { iv: q.blob.iv, ct: q.blob.ct }, created: new Date().toISOString(), updated: new Date().toISOString() };
        await saves.queueWrite(p, data, 'Compte Arcadia créé');
        send(res, 200, { ok: true, updated: data.updated });
        return;
      }
      if (tooMany(lim)) { send(res, 429, { ok: false, error: 'wait' }); return; }
      if (!rec || !(await check(rec, q.auth))) { failed(lim); send(res, 403, { ok: false, error: 'auth' }); return; }
      if (m[1] === 'login') { send(res, 200, { ok: true, blob: rec.blob, updated: rec.updated }); return; }
      if (m[1] === 'vipkey') {
        if (!(await vip.isVip(user))) { send(res, 403, { ok: false, error: 'vip' }); return; }
        const key = await vip.vaultKey();
        send(res, key ? 200 : 503, key ? { ok: true, key } : { ok: false, error: 'nokey' });
        return;
      }
      if (!validBlob(q.blob)) { send(res, 400, { ok: false, error: 'blob' }); return; }
      const data = { ...rec, blob: { iv: q.blob.iv, ct: q.blob.ct }, updated: new Date().toISOString() };
      const w = saves.queueWrite(p, data, 'Compte Arcadia mis à jour');
      w.catch((e) => console.error(new Date().toISOString(), 'compte', e.message));
      await Promise.race([w, new Promise((r) => setTimeout(r, 8000))]);
      send(res, 200, { ok: true, updated: data.updated });
    } catch (e) {
      console.error(new Date().toISOString(), 'compte', e.message);
      send(res, 502, { ok: false, error: 'github' });
    }
  });
  return true;
}

module.exports = { handle, pathOf };
