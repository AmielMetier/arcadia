import { fileURLToPath } from 'node:url';
// tools/test-accounts.mjs — comptes Arcadia (identifiant + mot de passe) du serveur relais (server/accounts.js),
// contre une fausse API GitHub, avec le vrai code du navigateur (hub/account.js) exécuté sous Node.
// Usage : node tools/test-accounts.mjs   (le serveur ws doit être installé : cd server && npm install)
import http from 'node:http';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

let fails = 0;
const ok = (c, msg) => { if (!c) { fails++; console.error('ÉCHEC :', msg); } else console.log('ok -', msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- fausse API GitHub : refs et contenus d'une seule branche ---------- */
const store = new Map(); let refs = { main: 'abc' }, puts = 0, delayPut = 0;
const api = http.createServer((req, res) => {
  let body = ''; req.on('data', (c) => (body += c));
  req.on('end', async () => {
    const u = new URL(req.url, 'http://x'), send = (code, o) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(o)); };
    if (req.headers.authorization !== 'Bearer jeton-test') return send(401, {});
    let m;
    if (req.method === 'GET' && (m = /^\/repos\/o\/r\/git\/ref\/heads\/(.+)$/.exec(u.pathname))) return refs[m[1]] ? send(200, { object: { sha: refs[m[1]] } }) : send(404, {});
    if (req.method === 'GET' && u.pathname === '/repos/o/r') return send(200, { default_branch: 'main' });
    if (req.method === 'POST' && u.pathname === '/repos/o/r/git/refs') { const b = JSON.parse(body); refs[b.ref.replace('refs/heads/', '')] = b.sha; return send(201, {}); }
    if ((m = /^\/repos\/o\/r\/contents\/(.+)$/.exec(u.pathname))) {
      const p = m[1];
      if (req.method === 'GET') { const f = store.get(p); return f ? send(200, { sha: f.sha, content: f.content }) : send(404, {}); }
      if (req.method === 'PUT') {
        const b = JSON.parse(body), f = store.get(p);
        if (b.branch !== 'saves' || !refs.saves) return send(422, {});
        if (f && b.sha !== f.sha) return send(409, {});
        if (delayPut) await sleep(delayPut);
        puts++; const sha = crypto.randomBytes(8).toString('hex'); store.set(p, { sha, content: b.content });
        return send(f ? 200 : 201, { content: { sha } });
      }
    }
    send(404, {});
  });
});
await new Promise((r) => api.listen(0, r));
const apiPort = api.address().port;

const start = (port, env) => {
  const p = spawn('node', [fileURLToPath(new URL('../server/server.js', import.meta.url))], { env: { ...process.env, PORT: String(port), RELAY_LOG_DIR: '/tmp/ddtest-accounts-logs', ...env }, stdio: ['ignore', 'ignore', 'inherit'] });
  return p;
};
// coffre VIP des Backrooms : une clé de test, son témoin (même format que backrooms/data/e0.bin) et une liste VIP de
// test (comme hub/vip.js) : « amiel » VIP d'origine (ACCOUNTS), « carla » VIP ajoutée depuis (HASHES, tools/vip-add.mjs)
const VIP_KEY = crypto.randomBytes(32).toString('base64');
const VIP_FILE = '/tmp/ddtest-accounts-vip.js', VIP_CHECK_FILE = '/tmp/ddtest-accounts-e0.bin';
(await import('node:fs')).writeFileSync(VIP_FILE, `const HASHES = [\n    '${crypto.createHash('sha256').update('arcadia-vip:carla').digest('hex')}', // ca…\n  ];\n  const ACCOUNTS = [\n    '${crypto.createHash('sha256').update('arcadia-account:amiel').digest('hex').slice(0, 32)}',\n  ];\n`);
{
  const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', Buffer.from(VIP_KEY, 'base64'), iv);
  const ct = Buffer.concat([c.update('arcadia · backrooms · vip', 'utf8'), c.final()]);
  (await import('node:fs')).writeFileSync(VIP_CHECK_FILE, Buffer.concat([Buffer.from('ARV1'), iv, ct, c.getAuthTag()]));
}
const SRV_ENV = { GITHUB_TOKEN: 'jeton-test', SAVES_REPO: 'o/r', SAVES_API: `http://127.0.0.1:${apiPort}`, SAVES_GAP_MS: '400', BACKROOMS_VIP_KEY: '', VIP_FILE, VIP_CHECK_FILE };
let srv = start(8141, SRV_ENV);
const off = start(8142, { GITHUB_TOKEN: '' });
await sleep(700);
const post = async (port, path, o) => { const r = await fetch(`http://127.0.0.1:${port}${path}`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: typeof o === 'string' ? o : JSON.stringify(o) }); return { status: r.status, json: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') }; };


// le module du navigateur, tel quel, avec un faux window / location / localStorage
import fs from 'node:fs';
const ls = new Map();
globalThis.window = globalThis;
globalThis.location = { search: '?ws=ws://127.0.0.1:8141' };
globalThis.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)), removeItem: (k) => ls.delete(k) };
globalThis.atob ??= (s) => Buffer.from(s, 'base64').toString('binary');
globalThis.btoa ??= (s) => Buffer.from(s, 'binary').toString('base64');
new Function(fs.readFileSync(new URL('../hub/account.js', import.meta.url), 'utf8'))();
const A = globalThis.HubAccount;

try {
  ok(A.normUser('Amiel') === 'amiel' && A.normUser('Élodie M') === 'elodie_m' && A.normUser('ab') === '', 'identifiants normalisés');
  ok(await A.status() === true, 'statut : comptes actifs');
  const profil = { v: 1, n: 'Amiel', c: '#2b8cff', u: 'abc123def', fr: { k: 'k'.repeat(36), f: [['ABCDEFGH', 'Nico', '#ff4b2b']] } };
  await A.create('Amiel', 'motdepasse1', profil);
  ok(A.session() && A.session().user === 'amiel', 'compte créé et connecté');
  // ce qui est rangé sur GitHub : chiffré, et le nom du fichier ne contient pas l'identifiant
  const files = [...store.keys()];
  ok(files.length === 1 && files[0].startsWith('accounts/') && !files[0].includes('amiel'), `fichier anonyme (${files[0]})`);
  const raw = Buffer.from(store.get(files[0]).content, 'base64').toString('utf8');
  ok(!raw.includes('Amiel') && !raw.includes('Nico') && !raw.includes('kkkk') && !raw.includes('motdepasse1'), 'rien de lisible sur GitHub (ni pseudo, ni amis, ni clé, ni mot de passe)');
  let e = await A.create('amiel', 'autre', profil).catch((x) => x);
  ok(e && e.code === 'taken', 'identifiant déjà pris');
  A.logout();
  ok(!A.session(), 'déconnecté');
  e = await A.login('amiel', 'mauvais').catch((x) => x);
  ok(e && e.code === 'auth', 'mauvais mot de passe refusé');
  const back = await A.login('AMIEL', 'motdepasse1');
  ok(back.n === 'Amiel' && back.fr.f[0][1] === 'Nico' && back.fr.k === profil.fr.k, 'connexion : profil retrouvé et déchiffré');
  await A.save({ ...profil, n: 'Amiel2', c: '#ffc531' });
  A.logout();
  const back2 = await A.login('amiel', 'motdepasse1');
  ok(back2.n === 'Amiel2' && back2.c === '#ffc531', 'mise à jour enregistrée');
  // la clé du coffre VIP : le relais l'apprend (seule la vraie passe), la garde enveloppée, la donne au compte VIP connecté
  const status = async (port = 8141) => (await (await fetch(`http://127.0.0.1:${port}/account/status`)).json()).vipkey;
  ok(await status() === false, 'statut : le relais neuf n\'a pas la clé du coffre VIP');
  ok(await A.vipKey() === null, 'relais sans la clé : le compte VIP n\'a rien (monstres classiques)');
  let v = await post(8141, '/account/vipseed', { key: crypto.randomBytes(32).toString('base64') });
  ok(v.status === 403 && v.json && v.json.error === 'wrong', 'apprendre une autre clé : refusé (elle n\'ouvre pas le témoin)');
  v = await post(8141, '/account/vipseed', { key: 'pas une clé' });
  ok(v.status === 403, 'apprendre n\'importe quoi : refusé');
  ok(await status() === false && !store.has('vip/backrooms.json'), 'rien de gardé après un refus');
  ok(await A.vipSeed(VIP_KEY) === true, 'le navigateur qui a la clé la réapprend au relais');
  const kept = store.get('vip/backrooms.json');
  const rec = kept && JSON.parse(Buffer.from(kept.content, 'base64').toString('utf8'));
  const keptText = kept ? Buffer.from(kept.content, 'base64').toString('utf8') : '';
  ok(rec && rec.v === 1 && !keptText.includes(VIP_KEY) && !keptText.includes(Buffer.from(VIP_KEY, 'base64').toString('hex')), 'branche saves : la clé y est enveloppée, pas en clair');
  const unwrapWith = (token) => {
    try {
      const d = crypto.createDecipheriv('aes-256-gcm', crypto.createHmac('sha256', token).update('arcadia-backrooms-vip-wrap').digest(), Buffer.from(rec.iv, 'base64'));
      d.setAuthTag(Buffer.from(rec.tag, 'base64'));
      return Buffer.concat([d.update(Buffer.from(rec.ct, 'base64')), d.final()]).toString('utf8');
    } catch (e) { return null; }
  };
  ok(unwrapWith('jeton-test') === VIP_KEY && unwrapWith('un-autre-jeton') === null, 'enveloppe : s\'ouvre avec le jeton du relais, pas avec un autre');
  ok(await status() === true, 'statut : le relais a la clé du coffre VIP');
  ok(await A.vipKey() === VIP_KEY, 'compte VIP connecté : le relais lui donne la clé du coffre');
  const putsBefore = puts;
  ok(await A.vipSeed(VIP_KEY) === true && (await post(8141, '/account/vipseed', { key: VIP_KEY })).status === 200 && puts === putsBefore, 'la renvoyer : rien de réécrit');
  // le relais redémarre (Render le fait souvent) : il la retrouve dans la branche saves
  srv.kill(); await sleep(200);
  srv = start(8141, SRV_ENV); await sleep(700);
  ok(await status() === true && await A.vipKey() === VIP_KEY, 'après un redémarrage du relais : la clé est toujours là');
  const amielAuth = JSON.parse(ls.get('hub_login')).auth;
  A.logout();
  ok(await A.vipKey() === null, 'déconnecté : pas de clé');
  await A.create('Bob', 'motdepasse2', { ...profil, n: 'Bob' });
  ok(await A.vipKey() === null, 'compte ordinaire : pas de clé');
  const bobAuth = JSON.parse(ls.get('hub_login')).auth;
  v = await post(8141, '/account/vipkey', { user: 'bob', auth: bobAuth });
  ok(v.status === 403 && !JSON.stringify(v.json || '').includes(VIP_KEY), 'compte ordinaire : 403, la clé ne part pas');
  await A.create('Carla', 'motdepasse3', { ...profil, n: 'Carla' });
  const carlaAuth = JSON.parse(ls.get('hub_login')).auth;
  // un VIP ajouté depuis (tools/vip-add.mjs) : le grade, mais pas la clé sans la phrase
  ok(await A.vipKey() === null, 'VIP ajouté depuis, connecté : pas de clé sans la phrase');
  v = await post(8141, '/account/vipkey', { user: 'carla', auth: carlaAuth });
  ok(v.status === 403 && v.json && v.json.error === 'phrase' && !JSON.stringify(v.json).includes(VIP_KEY), 'VIP ajouté depuis : 403 « phrase », la clé ne part pas');
  ok(await A.verify() === 'vip', 'VIP ajouté depuis : le relais confirme bien le grade');
  v = await post(8141, '/account/vipkey', { user: 'carla', auth: bobAuth });
  ok(v.status === 403 && !JSON.stringify(v.json || '').includes(VIP_KEY), 'compte VIP sans son mot de passe : 403');
  v = await post(8141, '/account/vipkey', { user: 'amiel', auth: amielAuth });
  ok(v.status === 200 && v.json && v.json.key === VIP_KEY, 'compte VIP avec sa clé d\'accès : la clé');
  ok(await status(8142) === false, 'relais sans jeton GitHub : statut sans clé');
  // envoyer des clés au hasard : bloqué au bout de 8 ratés
  const seeds = [];
  for (let i = 0; i < 9; i++) seeds.push((await post(8141, '/account/vipseed', { key: crypto.randomBytes(32).toString('base64') })).status);
  ok(seeds.slice(0, 8).every((c) => c === 403) && seeds.at(-1) === 429, `clés au hasard : attente (${seeds.join(',')})`);
  // la liste du relais est celle du Hub (hub/vip.js)
  const { parse } = (await import('node:module')).createRequire(import.meta.url)('../server/vip.js');
  const real = parse(fs.readFileSync(new URL('../hub/vip.js', import.meta.url), 'utf8'));
  ok(real.accounts.size >= 1 && [...real.accounts].every((h) => /^[0-9a-f]{32}$/.test(h)), `liste VIP du Hub lue par le relais (${real.accounts.size} comptes, ${real.hashes.size} empreintes)`);
  // le grade VIP ne vient que de la liste du dépôt : le relais vérifie la session du Hub à chaque visite
  const amielSess = { user: 'amiel', auth: amielAuth, ek: 'x' };
  const verifyAs = async (sess) => { if (sess) ls.set('hub_login', JSON.stringify(sess)); else ls.delete('hub_login'); return A.verify(); };
  ok(await verifyAs(amielSess) === 'vip', 'session VIP vraie : confirmée, VIP');
  ok(await verifyAs({ user: 'bob', auth: bobAuth, ek: 'x' }) === 'ok', 'session ordinaire vraie : confirmée, pas VIP');
  ok(await verifyAs({ user: 'carla', auth: bobAuth, ek: 'x' }) === 'bad' && !ls.has('hub_login'), 'identifiant VIP sans son mot de passe : session oubliée');
  ok(await verifyAs({ user: 'amiel', auth: 'nimporte', ek: 'x' }) === 'bad' && !ls.has('hub_login'), 'session trafiquée (clé d\'accès inventée) : oubliée');
  ok(await verifyAs({ user: 'zz_inconnu', auth: '0'.repeat(64), ek: 'x' }) === 'bad', 'compte qui n\'existe pas : session oubliée');
  ok(await verifyAs(null) === null, 'pas de session : rien à vérifier');
  // hub/vip.js lui-même, avec la liste de test à la place de la vraie
  const vipSrc = fs.readFileSync(new URL('../hub/vip.js', import.meta.url), 'utf8')
    .replace(/const ACCOUNTS = \[[\s\S]*?\];/, `const ACCOUNTS = ['${crypto.createHash('sha256').update('arcadia-account:amiel').digest('hex').slice(0, 32)}'];`);
  const runHubVip = async (sess) => {
    if (sess) ls.set('hub_login', JSON.stringify(sess)); else ls.delete('hub_login');
    ls.set('backrooms_vip_key', 'cle-gardee');
    let reloaded = false;
    globalThis.location.reload = () => { reloaded = true; };
    globalThis.HUB_GAMES = [{ id: 'backrooms', settings: [{ key: 'monsters', options: [['normal', 'Normal'], ['vip', 'VIP', { vip: true }]] }] }];
    new Function(vipSrc)();
    const shown = globalThis.HubVIP.is(), keptNow = ls.has('backrooms_vip_key');
    await sleep(1500);
    return { shown, keptNow, reloaded, kept: ls.has('backrooms_vip_key'), sess: ls.has('hub_login'), vipOpt: globalThis.HUB_GAMES[0].settings[0].options.length === 2 };
  };
  let h = await runHubVip(amielSess);
  ok(h.shown && h.vipOpt && h.kept && h.sess && !h.reloaded, 'Hub, vrai compte VIP : grade, option VIP et clé gardés');
  h = await runHubVip({ user: 'amiel', auth: '0'.repeat(64), ek: 'x' });
  ok(h.reloaded && !h.sess, 'Hub, session VIP écrite à la main : oubliée, la page se recharge sans le grade');
  h = await runHubVip({ user: 'bob', auth: bobAuth, ek: 'x' });
  ok(!h.shown && !h.vipOpt && !h.keptNow && h.sess && !h.reloaded, 'Hub, compte ordinaire : pas d\'option VIP, la clé des Backrooms est oubliée');
  h = await runHubVip(null);
  ok(!h.shown && !h.keptNow, 'Hub, sans compte : pas de grade, pas de clé');
  delete globalThis.location.reload;
  A.logout();
  await A.login('amiel', 'motdepasse1');
  // essais à la chaîne : bloqués au bout de 8 ratés
  let codes = [];
  for (let i = 0; i < 9; i++) codes.push((await A.login('amiel', 'x' + i).catch((x) => x)).code);
  ok(codes.slice(0, 7).every((c) => c === 'auth') && codes.at(-1) === 'wait', `trop d'essais : attente (${codes.join(',')})`);
  // le serveur refuse une clé d'accès fausse même en écrivant directement
  const r = await post(8141, '/account/put', { user: 'zz_test', auth: '0'.repeat(64), blob: { iv: 'a', ct: 'b' } });
  ok(r.status === 403, 'écriture sans le bon mot de passe refusée');
  const r2 = await post(8142, '/account/login', { user: 'amiel', auth: '0'.repeat(64) });
  ok(r2.status === 503, 'sans jeton GitHub : 503');
} finally {
  srv.kill(); off.kill(); api.close();
}
if (fails) { console.error(`\n${fails} ÉCHEC(S)`); process.exit(1); }
console.log('\nCOMPTES ARCADIA : TOUS LES TESTS SONT AU VERT');
process.exit(0);
