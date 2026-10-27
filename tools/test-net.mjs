// Tests de bout en bout de la connexion : shared/net.js et shared/room.js tournent dans de faux navigateurs, reliés au
// vrai serveur relais par des mandataires TCP que l'on coupe, fige ou bloque, comme un wifi capricieux.
// node tools/test-net.mjs      (prérequis : cd server && npm install)
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
const { WebSocket: NodeWS } = createRequire(new URL('../server/package.json', import.meta.url))('ws');
// comme dans un navigateur, une erreur de connexion n'est qu'un événement (suivi de la fermeture)
class WebSocket extends NodeWS { constructor(u) { super(u); this.on('error', () => {}); } }

const ROOT = new URL('..', import.meta.url).pathname;
const ROOT_TMP = path.join(tmpdir(), 'relais-logs-'); // logs du serveur hors du dépôt
const SPORT = 8188;
let srv = null;
const startServer = async () => {
  srv = spawn('node', [ROOT + 'server/server.js'], { env: { ...process.env, PORT: String(SPORT), RELAY_GRACE_MS: '2500', RELAY_LOG_DIR: fs.mkdtempSync(ROOT_TMP) }, stdio: ['ignore', 'ignore', 'inherit'] });
  await sleep(400);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  ✗ ' + msg); } };
const until = async (pred, ms = 8000) => { const t = Date.now(); while (Date.now() - t < ms) { if (pred()) return true; await sleep(20); } return false; };

// Mandataire TCP : cut() coupe net, freeze() fige les connexions en cours (rien ne passe, rien ne se ferme), block() refuse tout
function proxy(port) {
  const P = { pairs: new Set(), blocked: false };
  P.server = net.createServer((c) => {
    if (P.blocked) { c.destroy(); return; }
    const up = net.connect(SPORT, '127.0.0.1');
    const pair = { c, up, frozen: false };
    P.pairs.add(pair);
    c.on('data', (d) => { if (!pair.frozen) up.write(d); });
    up.on('data', (d) => { if (!pair.frozen) c.write(d); });
    const end = () => { c.destroy(); up.destroy(); P.pairs.delete(pair); };
    for (const s of [c, up]) { s.on('close', end); s.on('error', end); }
  }).listen(port);
  P.cut = () => { for (const p of P.pairs) { p.c.destroy(); p.up.destroy(); } };
  P.freeze = () => { for (const p of P.pairs) p.frozen = true; };
  P.block = (b) => { P.blocked = b; if (b) P.cut(); };
  return P;
}

// Faux navigateur : un contexte isolé par joueur (comme un onglet), avec net.js et room.js
const SRC = ['shared/net.js', 'shared/room.js'].map((f) => fs.readFileSync(ROOT + f, 'utf8'));
function browser(port) {
  const L = {};
  const w = {
    console, setTimeout, clearTimeout, setInterval, clearInterval, performance, URLSearchParams, BroadcastChannel, MessageChannel, crypto: globalThis.crypto,
    location: { search: `?ws=ws://127.0.0.1:${port}`, origin: 'http://localhost', pathname: '/' },
    fetch: () => Promise.resolve(), WebSocket,
    document: { hidden: false, addEventListener: () => {} },
    addEventListener: (k, fn) => { (L[k] = L[k] || []).push(fn); },
  };
  w.window = w; w.fire = (k) => (L[k] || []).forEach((f) => f());
  vm.createContext(w);
  for (const s of SRC) vm.runInContext(s, w);
  return w;
}
function player(port, name, uid) {
  const b = browser(port), log = { got: [], ev: [] }, nets = [];
  const mk = b.DDNet.create; b.DDNet.create = (o) => { const n = mk(o); nets.push(n); return n; };
  const R = b.DDRoom.create({
    joined() { log.ev.push('joined'); }, update() {}, chat() {}, results() {}, left(p) { log.ev.push('left:' + p.name); },
    game(from, m) { log.got.push(m); },
    error(m) { log.ev.push('error:' + m); }, closed(m) { log.ev.push('closed:' + m); },
    migrating() { log.ev.push('migrating'); }, migrated() { log.ev.push('migrated'); }, net(s) { log.ev.push('net:' + s); },
  });
  return { b, R, log, nets, me: { name, color: '#2b8cff', lvl: 1, uid } };
}
const ids = (R) => R.players.map((p) => p.id).sort().join(',');
const seqOf = (log, tag) => log.got.filter((m) => m.tag === tag).map((m) => m.k);
const inOrder = (a, n) => a.length === n && a.every((k, i) => k === i + 1);
// rafale de messages pendant une coupure
async function burst(from, to, tag, n) { for (let k = 1; k <= n; k++) { from.R.sendGame(to, { tag, k }); await sleep(15); } }

await startServer();
const pH = proxy(8201), p1 = proxy(8202), p2 = proxy(8203);
const H = player(8201, 'Hôte', 'uidhost001'), A = player(8202, 'Alice', 'uidalice01'), B = player(8203, 'Bob', 'uidbobbb01');

/* ---------- salon ---------- */
H.R.host(H.me);
ok(await until(() => H.R.code), 'salon ouvert');
A.R.join(H.R.code, A.me); B.R.join(H.R.code, B.me);
ok(await until(() => H.R.players.length === 3 && A.R.myId > 0 && B.R.myId > 0 && A.R.players.length === 3), 'deux invités entrent');
const idA = A.R.myId, idB = B.R.myId;
ok(H.b.DDRoom && A.R.netStats().proto === 3, 'protocole 3 négocié');

/* ---------- 0. page figée (un jeu qui construit son décor) : pas de fausse coupure ---------- */
// la page fige juste après l'envoi d'une sonde (avec un vrai réseau, il y en a presque toujours une en route)
await sleep(800);
const ev0 = [H, A, B].map((P) => P.log.ev.length), rc0 = [H, A, B].map((P) => P.R.netStats().reconnects);
await until(() => A.nets.some((n) => n.probeAt), 3000);
const tf = Date.now(); while (Date.now() - tf < 6500) { /* tout le fil d'exécution est bloqué, comme un onglet occupé */ }
await sleep(1500);
ok([H, A, B].every((P, k) => !P.log.ev.slice(ev0[k]).includes('net:down') && P.R.netStats().reconnects === rc0[k]), 'page figée 6 s : pas de fausse coupure ' + JSON.stringify([H, A, B].map((P, k) => [P.log.ev.slice(ev0[k]), P.R.netStats().reconnects - rc0[k]])));

/* ---------- 1. coupure nette d'un invité ---------- */
p1.cut();
await Promise.all([burst(H, idA, 'c1', 30), burst(A, 'host', 'c1', 30)]);
ok(await until(() => inOrder(seqOf(A.log, 'c1'), 30) && inOrder(seqOf(H.log, 'c1'), 30)), 'coupure nette : tous les messages arrivent, dans l\'ordre, sans doublon ' + JSON.stringify([seqOf(A.log, 'c1').length, seqOf(H.log, 'c1').length]));
ok(ids(H.R) === `0,${idA},${idB}`.split(',').sort().join(',') && !H.log.ev.some((e) => e.startsWith('left')), 'coupure nette : personne ne quitte le salon');
ok(A.R.netStats().resumed >= 1, 'coupure nette : place reprise sur le serveur');

/* ---------- 2. connexion figée (wifi mort sans fermeture) ---------- */
p2.freeze();
await Promise.all([burst(H, idB, 'c2', 20), burst(B, 'host', 'c2', 20)]);
// une sonde sans réponse pendant 14 s (DEAD_MS) signe une connexion morte : on laisse le temps de la détecter et de reprendre
ok(await until(() => inOrder(seqOf(B.log, 'c2'), 20) && inOrder(seqOf(H.log, 'c2'), 20), 24000), 'connexion figée : détectée et reprise, messages complets ' + JSON.stringify([seqOf(B.log, 'c2'), seqOf(H.log, 'c2').length]));
ok(B.log.ev.includes('net:down') && B.log.ev.includes('net:up'), 'connexion figée : le joueur voit la coupure puis le retour');
ok(H.R.players.length === 3 && !H.R.players.some((p) => p.away), 'connexion figée : même salon, plus personne en reconnexion');

/* ---------- 3. coupure de l'hôte ---------- */
pH.cut();
await Promise.all([burst(H, 'all', 'c3h', 20), burst(A, 'host', 'c3a', 20)]);
ok(await until(() => inOrder(seqOf(A.log, 'c3h'), 20) && inOrder(seqOf(B.log, 'c3h'), 20) && inOrder(seqOf(H.log, 'c3a'), 20)), 'coupure de l\'hôte : tout arrive ' + JSON.stringify([seqOf(A.log, 'c3h').length, seqOf(B.log, 'c3h').length, seqOf(H.log, 'c3a').length]));
ok(!A.log.ev.includes('migrating') && !B.log.ev.includes('migrating'), 'coupure de l\'hôte : pas de migration');

/* ---------- 4. partie en cours : coupure trop longue d'un invité ---------- */
H.R.setGame('drift', {});
await until(() => A.R.game && B.R.game);
p2.block(true);
ok(await until(() => H.R.players.find((p) => p.id === idB)?.away, 5000), 'coupure longue : joueur marqué en reconnexion');
await sleep(3500); // la place expire sur le serveur
ok(H.R.players.some((p) => p.id === idB && !p.cid), 'coupure longue en partie : le joueur reste dans la partie');
p2.block(false);
ok(await until(() => H.R.players.find((p) => p.id === idB)?.cid && !H.R.players.find((p) => p.id === idB).away, 10000), 'coupure longue : il revient à sa place');
ok(B.R.myId === idB && H.R.players.length === 3, 'coupure longue : même numéro, pas de doublon ' + ids(H.R));
await burst(H, idB, 'c4', 10);
ok(await until(() => inOrder(seqOf(B.log, 'c4'), 10)), 'coupure longue : la partie reprend');

/* ---------- 5. salon sans partie : coupure trop longue ---------- */
H.R.setGame(null);
await until(() => !A.R.game);
p1.block(true);
await sleep(3500);
p1.block(false);
ok(await until(() => H.R.players.length === 3 && H.R.players.find((p) => p.id === idA)?.cid && A.R.players.length === 3, 10000), 'salon : retour après une longue coupure, même numéro ' + ids(H.R));
ok(A.R.myId === idA, 'salon : le joueur garde son numéro');

/* ---------- 6. redémarrage du serveur ---------- */
const before = { a: A.log.ev.length, b: B.log.ev.length };
srv.kill(); await sleep(300); await startServer();
ok(await until(() => H.R.players.length === 3 && H.R.players.every((p) => p.id === 0 || p.cid) && A.R.players.length === 3 && B.R.players.length === 3, 15000), 'redémarrage du serveur : tout le monde revient ' + ids(H.R));
ok(H.R.code && A.R.code === H.R.code && B.R.code === H.R.code, 'redémarrage du serveur : même code de salon');
ok(![...A.log.ev.slice(before.a), ...B.log.ev.slice(before.b)].some((e) => e.startsWith('closed') || e === 'migrating'), 'redémarrage du serveur : ni fermeture ni migration');
await Promise.all([burst(H, 'all', 'c6h', 10), burst(B, 'host', 'c6b', 10)]);
ok(await until(() => inOrder(seqOf(A.log, 'c6h'), 10) && inOrder(seqOf(H.log, 'c6b'), 10)), 'redémarrage du serveur : les messages circulent');

/* ---------- 7. l'hôte disparaît trop longtemps : les autres migrent, il les retrouve ---------- */
pH.block(true);
ok(await until(() => A.R.isHost || B.R.isHost, 12000), 'hôte injoignable : un invité reprend le salon');
pH.block(false);
ok(await until(() => { const N = A.R.isHost ? A : B; return N.R.players.length === 3 && H.R.mode === 'guest' && H.R.players.length === 3; }, 20000),
  'l\'ancien hôte rejoint le salon migré ' + JSON.stringify([A.R.players.length, B.R.players.length, H.R.mode, H.R.players.length]));
ok(H.R.myId === 0 && H.R.code === A.R.code && A.R.code === B.R.code, 'l\'ancien hôte garde son numéro');
const NH = A.R.isHost ? A : B;
await burst(NH, 0, 'c7', 10);
ok(await until(() => inOrder(seqOf(H.log, 'c7'), 10)), 'l\'ancien hôte reçoit de nouveau les messages');

/* ---------- 8. départ réel de l'hôte : migration ---------- */
const [X, Y] = NH === A ? [A, B] : [B, A]; // X est l'hôte actuel
X.R.leave();
ok(await until(() => H.R.isHost || Y.R.isHost, 8000), 'l\'hôte part : un invité reprend le salon');
ok(await until(() => H.R.players.length === 2 && Y.R.players.length === 2, 8000), 'migration : les deux restants se retrouvent');

for (const p of [H, Y]) p.R.leave();
srv.kill();
for (const p of [pH, p1, p2]) p.server.close();
console.log(fails ? `\n${fails} échec(s), ${passes} réussis` : `Connexion : ${passes} vérifications réussies`);
process.exit(fails ? 1 : 0);
