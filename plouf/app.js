// Plouf ! : démarrage, rôle (solo, hôte, invité), boucle de jeu, réseau via le Hub.
// Même schéma que Convoy Storm : l'hôte fait tourner la simulation à 60 Hz et diffuse l'état 20 fois par seconde ;
// les invités envoient leurs commandes (30 Hz), prédisent leur propre déplacement (stepPlayer, le même code que l'hôte)
// et voient les autres ~100 ms en retard, interpolés entre deux états. Une bourrade reçue de l'hôte arrive comme
// une vitesse : la prédiction la rejoue, et le petit écart restant se résorbe en douceur au lieu de téléporter.
// ?lag=150 simule 150 ms d'aller-retour sur chaque message (pour tester la prédiction entre deux onglets).
import { Sim, DT, ST, stepPlayer, playerFromRow, CHARGE_MAX, WIND_V } from './engine/sim.js';
import { Arena, SHAPES } from './engine/arena.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';
import { HUD, briefingHtml, menuHtml, endHtml } from './view/hud.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const LAG = Math.max(0, Math.min(1000, +QS.get('lag') || 0));
const $ = (s) => document.querySelector(s);
const screenEl = $('#screen');
const INTERP = 0.1;              // retard d'affichage des autres joueurs chez les invités (s)
const HOST_SILENCE = 2.5, HOST_GIVEUP = 15;
const MAX_BODIES = 8;            // joueurs et bots sur le radeau
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = {
  role: 'solo', myId: 0, cfg: null, sim: null, runId: 0, lobby: true, menu: false, alive: true,
  snaps: [], evq: [], last: null, off: null, endShown: false, reported: false, netEv: [], tick: 0, lastSend: 0, sentOver: false,
  acc: 0, inp: null, sentSeq: 0, sendT: 0, hist: [], pred: null, predEv: [], gotHost: false, hiT: 0, snapAt: 0, view: null,
  arena: null, count: 0, rounds: 0, overT: 0, prevPh: '',
};

// ------------------------------------------------------------------ réseau (avec latence simulée en option)
const send = (to, m, o) => { if (LAG) setTimeout(() => H.send(to, m, o), LAG / 2); else H.send(to, m, o); };

// ------------------------------------------------------------------ montage
const hud = new HUD();
const sfx = new Sfx();
let scene = null;
try { scene = createScene($('#stage'), { onLost: () => hud.toast('Affichage 3D interrompu : recharge la page', 6) }); }
catch (e) { console.error(e); }
const input = new Input(document.body, { menu: () => toggleMenu(), mute: () => { sfx.unlock(); DDVolume.toggle(); }, unlock: () => sfx.unlock(), enter: () => { const b = $('#btnGo') || $('#btnAgain'); if (b) b.click(); } });
input.onMenu = () => toggleMenu();
input.bindTouchButtons($('#tbtns'));
const SETTINGS = {
  accent: '#17c3d6',
  hint: 'Touche <kbd>M</kbd> : couper ou remettre le son.',
  test: () => sfx.play('plop'),
  sections: [{ title: 'Commandes', items: [{ keys: [
    ['Se déplacer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou flèches', 'stick gauche'],
    ['Pousser (maintenir pour armer)', '<kbd>Espace</kbd> ou clic gauche', 'Ⓐ'],
    ['Attraper, lancer', '<kbd>E</kbd> ou clic droit', 'Ⓧ'],
    ['Mouette : lâcher une sardine', '<kbd>Espace</kbd>', 'Ⓐ'],
    ['Pause', '<kbd>Échap</kbd>', 'Start'],
  ] }] }],
};
$('#btnSet').innerHTML = DDVolume.ICON;
DDVolume.panel($('#btnSet'), SETTINGS);
input.listen($('#btnMenu'), 'click', () => toggleMenu());
input.listen(document, 'visibilitychange', () => { if (document.hidden && S.role === 'solo' && S.sim && !S.menu && !S.endShown && !S.lobby && !QS.has('debug')) toggleMenu(); });

let raf = 0;
function teardown() {
  if (!S.alive) return;
  S.alive = false;
  cancelAnimationFrame(raf);
  input.dispose();
  scene && scene.dispose();
  sfx.dispose();
  removeEventListener('pagehide', teardown);
}
addEventListener('pagehide', teardown);
function exitToLobby() { if (!H.embedded) { location.reload(); return; } teardown(); H.exit(); }

// ------------------------------------------------------------------ réglages et joueurs
const GOALS = [2, 3, 5], LEVELS = ['facile', 'normal', 'expert'];
function readCfg(settings = {}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('plouf_cfg') || '{}'); } catch (e) {}
  const src = H.embedded ? settings : { ...saved, ...Object.fromEntries(QS) };
  const num = (v, d) => (v === undefined || v === '' || !Number.isFinite(+v) ? d : +v);
  return {
    goal: GOALS.includes(num(src.goal, 3)) ? num(src.goal, 3) : 3,
    bots: clamp(num(src.bots, H.embedded ? 1 : 3) | 0, 0, MAX_BODIES - 1),
    level: LEVELS.includes(src.level) ? src.level : 'normal',
    items: num(src.items, 1) ? 1 : 0,
    wind: num(src.wind, 1) ? 1 : 0,
  };
}
function localProfile() {
  const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  return { name: String(g('dd_name', '') || 'Baigneur').slice(0, 12) || 'Baigneur', color: g('dd_color', '#ff6b4a') };
}
const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2'];
function humanPlayers() {
  if (!H.embedded) { const p = localProfile(); return [{ id: 0, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#ff6b4a' }]; }
  return H.players.map((p, i) => ({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[i % PALETTE.length] }));
}
const isReady = (id) => id === S.myId || !H.embedded || H.readyMap[id] === 'plouf';
const squad = () => humanPlayers().map((p) => ({ ...p, me: p.id === S.myId, ready: isReady(p.id) }));
const botCount = () => Math.max(0, Math.min(S.cfg.bots, MAX_BODIES - squad().filter((p) => p.ready).length));

// ------------------------------------------------------------------ démarrage
function boot(info) {
  S.role = H.embedded ? info.role : 'solo';
  S.myId = H.embedded ? info.myId : 0;
  S.cfg = readCfg(info.settings || {});
  H.on('msg', (from, m) => { if (LAG) setTimeout(() => onMsg(from, m), LAG / 2); else onMsg(from, m); });
  H.on('roster', onRoster);
  if (H.embedded) H.signalReady();       // après on('msg') : sinon les premiers messages de l'hôte se perdent
  if (!scene) { showNoGL(); if (H.shown) H.shown(); return; }
  showBriefing();
  if (H.shown) H.shown();                // l'écran de chargement commun d'Arcadia peut s'effacer
  if (S.role === 'guest') send('host', { t: 'hi' });
  raf = requestAnimationFrame(loop);
  // ?debug : __plouf.run(2) fait avancer le jeu de 2 s image par image (même quand l'onglet est caché)
  if (QS.has('debug')) window.__plouf = { S, scene, input, hud, sfx, teardown, run: (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) step(1 / 60); } };
  if (QS.has('autostart') && S.role !== 'guest') setTimeout(startRun, 300);
}
if (H.embedded) H.on('init', boot); else boot({});

function showNoGL() {
  screenEl.hidden = false; screenEl.className = 'screen dim';
  screenEl.innerHTML = `<div class="nogl"><p>Ton navigateur n'arrive pas à afficher la 3D (WebGL).</p>${H.embedded ? '<button class="btn" id="btnExit">Retour au salon</button>' : ''}</div>`;
  const b = $('#btnExit'); if (b) b.onclick = exitToLobby;
}

function showBriefing() {
  if (!S.lobby) return;
  screenEl.className = 'screen'; screenEl.hidden = false;
  screenEl.innerHTML = briefingHtml({ role: S.role, squad: squad(), cfg: S.cfg, embedded: H.embedded, bots: botCount() });
  hud.show(false);
  const go = $('#btnGo'); if (go) { go.onclick = () => { sfx.unlock(); startRun(); }; go.focus({ preventScroll: true }); }
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
  for (const b of screenEl.querySelectorAll('.seg button')) b.onclick = () => {
    const k = b.dataset.k, v = b.dataset.v;
    S.cfg[k] = k === 'level' ? v : +v;
    try { localStorage.setItem('plouf_cfg', JSON.stringify(S.cfg)); } catch (e) {}
    sfx.unlock(); sfx.play('click'); showBriefing();
  };
}
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ''; S.menu = false; hud.show(true); }

// ------------------------------------------------------------------ hôte
function startRun() {
  if (S.role === 'guest') return;
  const dbg = QS.has('debug'), seed = dbg && QS.get('seed') ? +QS.get('seed') : (Math.random() * 2 ** 31) | 0;
  const sim = new Sim({ seed, goal: S.cfg.goal, items: !!S.cfg.items, wind: !!S.cfg.wind });
  for (const p of squad()) if (p.ready) sim.addPlayer({ id: p.id, name: p.name, color: p.color });
  sim.addBots(Math.max(botCount(), sim.players.size < 2 ? 1 : 0), S.cfg.level); // seul, au moins un adversaire
  sim.start();
  if (dbg && SHAPES[QS.get('arene')]) { sim.arena = new Arena(QS.get('arene'), null, sim.players.size >= 6); sim.lastShape = ''; [...sim.players.values()].forEach((p, i, a) => sim.place([p], i, a.length)); sim.events.push({ e: 'round', rd: 1, sh: QS.get('arene') }); }
  S.sim = sim; S.runId = Date.now(); S.lobby = false; S.endShown = false; S.reported = false; S.netEv = []; S.acc = 0; S.tick = 0; S.sentOver = false; S.rounds = 0;
  hud.clearTags();
  hideScreen();
  if (H.embedded) send('all', { t: 'go', run: S.runId });
}

function hostFrame(dt) {
  const sim = S.sim;
  const paused = S.menu && S.role === 'solo';
  if (!paused) S.acc += Math.min(0.1, dt);
  const frameEv = [];
  while (S.acc >= DT) {
    S.acc -= DT;
    if (S.inp) sim.setInput(S.myId, S.inp);
    sim.step(DT);
    const ev = sim.drainEvents();
    frameEv.push(...ev);
    if (H.embedded && H.players.length > 1) S.netEv.push(...ev);
    S.tick++;
  }
  const snap = sim.snapshot(); snap.run = S.runId;
  // 20 Hz ; l'état final part tout de suite, garanti, pour que tout le monde voie la fin en même temps
  if (H.embedded && H.players.length > 1 && (S.tick - S.lastSend >= 3 || (snap.ph === 'over' && !S.sentOver))) {
    const final = snap.ph === 'over' && !S.sentOver;
    S.lastSend = S.tick; if (final) S.sentOver = true;
    send('all', { t: 's', s: snap }, { volatile: !final });
    if (S.netEv.length) send('all', { t: 'e', run: snap.run, ts: snap.t, e: S.netEv });
    S.netEv = [];
  }
  S.last = snap;
  const view = buildView(snap, snap, 0);
  for (const e of frameEv) fxEvent(e, view);
  if (snap.ph === 'over') report(sim);
  return view;
}

function onRoster() {
  if (!S.alive) return;
  if (S.role === 'guest' && H.info.role === 'host') becomeHost();
  if (S.role !== 'host') { if (S.lobby) showBriefing(); return; }
  if (S.lobby) { showBriefing(); return; }
  const sim = S.sim; if (!sim) return;
  // départ : le joueur quitte le radeau ; arrivée en cours de partie : mouette jusqu'à la manche suivante
  const ids = new Set(H.players.map((p) => p.id));
  for (const p of [...sim.players.values()]) if (!p.bot && p.id !== S.myId && (!ids.has(p.id) || !isReady(p.id))) sim.removePlayer(p.id);
  for (const p of squad()) if (p.ready && !sim.players.has(p.id)) { sim.addPlayer({ id: p.id, name: p.name, color: p.color }); send(p.id, { t: 'go', run: S.runId }); }
}

// Le Hub a désigné ce joueur comme nouvel hôte : la partie repart du dernier état reçu
function becomeHost() {
  S.role = 'host'; S.snaps = []; S.evq = []; S.pred = null; S.hist = [];
  const snap = S.last;
  if (snap && snap.ph !== 'over' && !S.lobby) {
    try {
      const sim = Sim.restore(snap);
      const ids = new Set(H.players.map((p) => p.id));
      for (const p of [...sim.players.values()]) if (!p.bot && !ids.has(p.id)) sim.removePlayer(p.id);
      sim.drainEvents();
      S.sim = sim; S.runId = snap.run || Date.now(); S.acc = 0; S.tick = 0; S.lastSend = -99;
      hud.toast('Tu deviens l\'hôte : la partie continue', 3);
      return;
    } catch (e) { console.error(e); }
  }
  S.sim = null; S.lobby = true; S.endShown = false; showBriefing();
}

function report(sim) {
  if (S.reported || !H.embedded || S.role === 'guest') return;
  S.reported = true;
  const ranked = sim.ranking();
  H.report({
    id: `plouf-${S.runId}-${ranked.filter((p) => !p.bot).map((p) => p.id).join('.')}`,
    mode: `Premier à ${sim.goal} manches`,
    players: ranked.map((p, k) => ({ id: p.bot ? null : p.id, name: p.name, color: p.color, bot: p.bot, rank: k + 1, score: p.pts })),
  });
}

// ------------------------------------------------------------------ messages
function onMsg(from, m) {
  if (!S.alive || !m || typeof m !== 'object') return;
  if (S.role === 'host' || S.role === 'solo') {
    if (m.t === 'hi') { if (!S.lobby && S.sim) send(from, { t: 'go', run: S.runId }); }
    else if (m.t === 'i' && S.sim) S.sim.setInput(from, cleanInput(m)); // `from` vient du Hub : seule identité fiable
    return;
  }
  if (from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  S.gotHost = true; S.snapAt = performance.now();
  if (m.t === 'go') { S.lobby = false; S.endShown = false; hud.clearTags(); hideScreen(); }
  else if (m.t === 's' && m.s) receiveSnap(m.s);
  else if (m.t === 'e' && Array.isArray(m.e)) receiveEvents(m);
}

function cleanInput(m) {
  const n = (v, a, b) => (Number.isFinite(+v) ? clamp(+v, a, b) : 0);
  return { mx: n(m.mx, -1, 1), mz: n(m.mz, -1, 1), push: !!m.push, pc: m.pc | 0, gc: m.gc | 0, q: m.q | 0 };
}

// ------------------------------------------------------------------ invité
function receiveSnap(s) {
  const now = performance.now() / 1000;
  if (S.lobby || (S.last && s.run !== S.last.run)) {
    S.lobby = false; S.endShown = false; S.snaps = []; S.evq = []; S.off = null; S.pred = null; S.hist = []; hud.clearTags(); hideScreen();
  }
  const o = now - s.t;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snaps.push(s); if (S.snaps.length > 12) S.snaps.shift();
  S.last = s;
  arenaFor(s);
  reconcile(s);
}
function receiveEvents(m) {
  if (S.lobby || !S.last || m.run !== S.last.run) return;
  for (const e of m.e) S.evq.push({ t: m.ts, e });
}
// le radeau de l'invité, pour prédire où il marche : rebâti à chaque manche, mis à jour à chaque instantané
function arenaFor(s) {
  const A = S.arena;
  if (!A || A.key !== s.sh || A.big !== (s.bg ? 1 : 0) || S.arenaRd !== s.rd) { S.arena = new Arena(s.sh, s.ti, !!s.bg); S.arenaRd = s.rd; }
  else A.decode(s.ti);
  return S.arena;
}
const windOf = (s) => (s.wd && s.wd[1] <= 0 ? { x: Math.sin(s.wd[0]) * WIND_V, z: Math.cos(s.wd[0]) * WIND_V } : { x: 0, z: 0 });
const ctxFor = (s) => ({ arena: S.arena || arenaFor(s), wind: windOf(s), frozen: s.ph === 'count' });

function reconcile(s) {
  const row = s.P.find((a) => a[0] === S.myId); if (!row) { S.pred = null; return; }
  const P = S.pred;
  const old = P ? { x: P.x + P.ox, z: P.z + P.oz, st: P.st } : null;
  const np = { ...playerFromRow(row), ox: 0, oz: 0 };
  S.hist = S.hist.filter((h) => h.q > np.q);
  const ctx = ctxFor(s);
  for (const h of S.hist) stepPlayer(np, h, h.dt, ctx, null);
  // petit écart (une bourrade arrivée en retard, un choc) : on le résorbe en douceur au lieu de téléporter
  if (old && old.st === np.st && np.st === ST.RUN && Math.hypot(old.x - np.x, old.z - np.z) < 4) { np.ox = old.x - np.x; np.oz = old.z - np.z; }
  S.pred = np;
}

function predictLocal(dt) {
  const s = S.last; if (!s || !S.pred || !S.inp || s.ph === 'over') return;
  const h = { ...S.inp, q: S.sentSeq + 1, dt };
  const ev = [];
  stepPlayer(S.pred, h, dt, ctxFor(s), ev);
  for (const e of ev) if (e.e === 'lunge') sfx.play('whoosh', { k: e.k }); // sa propre ruée s'entend tout de suite
  S.hist.push(h); if (S.hist.length > 240) S.hist.shift();
  const k = Math.exp(-dt * 9); S.pred.ox *= k; S.pred.oz *= k;
}

function guestFrame(dt) {
  if (!S.snaps.length) return null;
  const now = performance.now() / 1000;
  const rt = now - S.off - INTERP;
  let a = S.snaps[0], b = S.snaps[S.snaps.length - 1];
  for (let i = 0; i < S.snaps.length - 1; i++) if (S.snaps[i].t <= rt && S.snaps[i + 1].t >= rt) { a = S.snaps[i]; b = S.snaps[i + 1]; break; }
  if (rt >= b.t) a = b;
  if (a.rd !== b.rd) a = b;
  const f = a === b ? 0 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
  predictLocal(dt);
  const view = buildView(a, b, f);
  const due = []; S.evq = S.evq.filter((x) => (x.t <= rt + 0.001 ? (due.push(x.e), false) : true));
  for (const e of due) fxEvent(e, view);
  return view;
}

// ------------------------------------------------------------------ vue commune (hôte et invités)
function buildView(a, b, f) {
  const lerp = (x, y) => x + (y - x) * f;
  const lerpA = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return x + d * f; };
  const names = new Map(b.N.map(([id, n, c, bot]) => [id, [n, c, bot]]));
  const pa = new Map(a.P.map((r) => [r[0], r]));
  const players = b.P.map((rb) => {
    const ra = pa.get(rb[0]) || rb;
    const q = playerFromRow(rb);
    const [name, color, bot] = names.get(q.id) || ['?', '#888888', 0];
    let x = lerp(ra[1], rb[1]), z = lerp(ra[2], rb[2]), y = lerp(ra[3], rb[3]), yaw = lerpA(ra[7], rb[7]);
    const me = q.id === S.myId;
    let o = q;
    if (me && S.role === 'guest' && S.pred && (S.pred.st === ST.RUN || S.pred.st === ST.AIR || S.pred.st === ST.GULL)) {
      const P = S.pred; x = P.x + P.ox; z = P.z + P.oz; y = P.y; yaw = P.yaw; o = { ...q, vx: P.vx, vz: P.vz, chg: P.chg, lun: P.lun, stun: P.stun, tee: P.tee, st: P.st, cd: P.cd };
    }
    return { id: q.id, name, color, bot: !!bot, me, x, y, z, yaw, vx: o.vx, vz: o.vz, st: o.st, chg: o.chg, chgK: Math.min(1, o.chg / CHARGE_MAX), lun: o.lun, stun: o.stun,
      tee: o.tee, cd: o.cd, ck: q.ck, buoy: q.buoy, pts: q.pts, ko: q.ko, order: q.order, surv: q.surv, alive: b.ph === 'play' };
  });
  const oa = new Map(a.O.map((o) => [o[0], o]));
  const objs = b.O.map((o) => { const p = oa.get(o[0]); const same = p && p[5] === o[5]; return { id: o[0], k: o[1], x: same ? lerp(p[2], o[2]) : o[2], z: same ? lerp(p[3], o[3]) : o[3], y: same ? lerp(p[4], o[4]) : o[4], st: o[5] }; });
  const w = b.wd;
  return {
    ph: b.ph, pt: b.pt, rd: b.rd, rt: b.rt, go: b.go, rw: b.rw, win: b.win, sh: b.sh, bg: b.bg, ti: b.ti,
    wind: w && w[1] <= 0 ? windOf(b) : null, windWarn: !!(w && w[1] > 0), windA: w ? w[0] : 0,
    players, objs, me: players.find((p) => p.me) || null,
  };
}

// ------------------------------------------------------------------ effets, sons, annonces
const nameOf = (id) => { const p = S.view && S.view.players.find((q) => q.id === id); return p ? `<b style="--c:${esc(p.color)}">${esc(p.name)}</b>` : '?'; };
let bumpT = 0, creakT = 0;
function fxEvent(e, v) {
  const fx = scene && scene.fx;
  S.view = v;
  switch (e.e) {
    case 'round': S.rounds++; S.count = 0; hud.banner(`Manche ${e.rd}<small>${esc(SHAPES[e.sh]?.name || '')}</small>`, 2.2); sfx.play('round'); break;
    case 'go': hud.banner('PLOUF !', 0.9, 'big win'); sfx.play('go'); break;
    case 'lunge': if (e.id !== S.myId || S.role !== 'guest') sfx.play('whoosh', { k: e.k }); break;
    case 'hit': fx && fx.hit(e.x, e.z, e.k); sfx.play('hit', { vol: 0.6 + e.k * 0.5 }); break;
    case 'bump': if (bumpT <= 0) { bumpT = 0.15; fx && fx.bump(e.x, e.z); sfx.play('bump'); } break;
    case 'fall': fx && fx.splash(e.x, e.z, 1); sfx.play('plouf'); break;
    case 'out': {
      if (e.id === S.myId) hud.banner('Plouf !<small>Tu deviens mouette : lâche des sardines sur les autres</small>', 2.6, 'warn');
      hud.feed(e.by >= 0 ? `${nameOf(e.by)} envoie ${nameOf(e.id)} à l'eau 💦` : `${nameOf(e.id)} tombe tout seul 💦`);
      break;
    }
    case 'bob': sfx.play('bob'); if (e.id === S.myId) hud.toast('La bouée te sauve !', 1.6); break;
    case 'rebound': break;
    case 'grab': sfx.play('grab'); if (e.who === S.myId) hud.toast('On te soulève ! Martèle Espace', 1.5); break;
    case 'miss': if (e.id === S.myId) sfx.play('miss'); break;
    case 'throw': sfx.play('throw'); break;
    case 'escape': sfx.play('grab'); break;
    case 'land': fx && fx.land(e.x, e.z); sfx.play('land'); break;
    case 'splat': fx && fx.splat(e.x, e.z); sfx.play('splat'); break;
    case 'thud': sfx.play('thud'); break;
    case 'plop': fx && fx.plop(e.x, e.z); sfx.play('plop'); break;
    case 'drop': sfx.play('drop'); break;
    case 'buoy': sfx.play('buoy'); { const p = v.players.find((q) => q.id === e.id); if (p && fx) fx.sparkle(p.x, 0.8, p.z, 0xff3b30); } hud.feed(`${nameOf(e.id)} enfile une bouée 🛟`); break;
    case 'caw': sfx.play('caw'); break;
    case 'fish': fx && fx.fish(e.x, e.z, e.w); sfx.play(e.w ? 'plop' : 'fish'); break;
    case 'shake': if (creakT <= 0) { creakT = 0.4; sfx.play('creak'); } break;
    case 'sink': sfx.play('sink'); break;
    case 'windWarn': hud.banner('Coup de mistral !', 1.6, 'warn'); sfx.play('windWarn'); break;
    case 'roundEnd':
      if (e.id >= 0) {
        const w = e.win >= 0;
        hud.banner(e.id === S.myId ? (w ? 'Tu gagnes la partie !' : 'Tu gagnes la manche !') : `${esc(v.players.find((p) => p.id === e.id)?.name || '?')}<small>${w ? 'remporte la partie !' : 'gagne la manche'}</small>`, 3, 'win');
        sfx.play('win');
      } else { hud.banner('Personne au sec !<small>Manche nulle</small>', 2.6); sfx.play('nobody'); }
      break;
  }
}

// ------------------------------------------------------------------ fin, menu
function showEnd(reason) {
  if (S.endShown) return;
  S.endShown = true;
  const v = S.view; if (!v && reason !== 'host') return;
  const ranking = v ? [...v.players].sort((a, b) => b.pts - a.pts || b.ko - a.ko || b.surv - a.surv) : [];
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = endHtml({ ranking, canReplay: S.role !== 'guest' && reason !== 'host', embedded: H.embedded, reason });
  hud.show(false);
  const again = $('#btnAgain'); if (again) { again.onclick = () => startRun(); again.focus({ preventScroll: true }); }
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
}
function toggleMenu() {
  if (S.lobby || S.endShown) return;
  S.menu = !S.menu;
  if (!S.menu) { hideScreen(); return; }
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = menuHtml({ solo: S.role === 'solo', embedded: H.embedded });
  $('#btnResume').onclick = () => toggleMenu();
  DDVolume.panel($('#btnSettings'), SETTINGS);
  $('#btnQuit').onclick = exitToLobby;
  $('#btnResume').focus({ preventScroll: true });
}

// ------------------------------------------------------------------ boucle
let lastT = performance.now();
function loop(now) {
  if (!S.alive) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  step(dt);
}
function step(dt) {
  bumpT -= dt; creakT -= dt;
  const blocked = S.lobby || S.endShown || S.menu;
  const raw = input.sample();
  S.inp = blocked ? { ...raw, mx: 0, mz: 0, push: false } : raw;

  let view = null;
  if (S.role !== 'guest' && S.sim) view = hostFrame(dt);
  else if (S.role === 'guest') {
    S.hiT -= dt;
    if (!S.gotHost && S.hiT <= 0) { S.hiT = 1.5; send('host', { t: 'hi' }); }
    if (S.last && !S.lobby) {
      S.sendT += dt;
      if (S.sendT >= 1 / 30) { S.sendT = 0; S.sentSeq++; send('host', { t: 'i', ...S.inp, q: S.sentSeq }); }
      const silent = (performance.now() - S.snapAt) / 1000;
      if (S.last.ph !== 'over' && silent > HOST_SILENCE && !S.endShown) { if (!S.warned) { S.warned = true; hud.toast('Liaison avec l\'hôte interrompue…', 4); } if (silent > HOST_GIVEUP) showEnd('host'); }
      else S.warned = false;
    }
    view = guestFrame(dt);
  }
  if (!view) {
    // en attendant : le radeau vide qui flotte derrière l'écran d'accueil
    if (scene) scene.frame({ sh: 'radeau', bg: 0, rd: 0, ti: '', players: [], objs: [], wind: null }, dt);
    sfx.update(dt, { music: S.lobby ? 'calm' : 'off' });
    return;
  }
  S.view = view;
  // compte à rebours : 3, 2, 1
  if (view.ph === 'count') {
    const n = Math.ceil(view.pt);
    if (n !== S.count && n > 0 && n <= 3) { S.count = n; hud.banner(String(n), 0.8, 'big'); sfx.play('tick'); }
  }
  if (view.ph === 'over' && !S.endShown) { if (S.prevPh !== 'over') S.overT = 1.8; S.overT -= dt; if (S.overT <= 0) showEnd(); }
  S.prevPh = view.ph;
  if (scene) scene.frame(view, dt);
  hud.update(view, dt, { toScreen: scene ? scene.toScreen : () => ({ x: 0, y: 0 }), input, myId: S.myId, tips: S.rounds <= 2 && view.rt < 14 });
  const standing = view.players.filter((p) => p.st !== ST.GULL && !(p.st === ST.FALL && !p.buoy)).length;
  sfx.update(dt, { wind: view.wind ? 1 : 0, music: view.ph === 'play' ? 'play' : view.ph === 'over' ? 'off' : 'calm', tense: clamp(1 - (standing - 2) / 4, 0, 1) });
}
