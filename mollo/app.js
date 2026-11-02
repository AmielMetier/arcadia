// Mollo ! : démarrage, rôle (solo, hôte, invité), boucle de jeu, réseau via le Hub.
// L'hôte fait tourner la physique à 60 Hz et diffuse l'état 20 fois par seconde ; les invités envoient leurs commandes (30 Hz)
// et affichent tous les corps ~100 ms en retard, interpolés entre deux états. Pas de prédiction : un pantin physique ne se rejoue pas à bas prix.
// ?lag=150 simule 150 ms d'aller-retour sur chaque message.
import { Sim, DT, ST, FL, ITEM_KEYS } from './engine/sim.js';
import { ARENAS } from './engine/arena.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';
import { HUD, briefingHtml, menuHtml, endHtml } from './view/hud.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const LAG = Math.max(0, Math.min(1000, +QS.get('lag') || 0));
const $ = (s) => document.querySelector(s);
const screenEl = $('#screen');
const INTERP = 0.1;              // retard d'affichage chez les invités (s)
const HOST_SILENCE = 2.5, HOST_GIVEUP = 15;
const MAX_BODIES = 8;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = {
  role: 'solo', myId: 0, cfg: null, sim: null, runId: 0, lobby: true, menu: false, alive: true,
  snaps: [], evq: [], last: null, off: null, endShown: false, reported: false, netEv: [], tick: 0, lastSend: 0, sentOver: false,
  acc: 0, inp: null, sentSeq: 0, sendT: 0, gotHost: false, hiT: 0, snapAt: 0, view: null, prev: new Map(),
  count: 0, rounds: 0, overT: 0, prevPh: '',
};

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
  accent: '#ffc531',
  hint: 'Touche <kbd>M</kbd> : couper ou remettre le son.',
  test: () => sfx.play('hit'),
  sections: [{ title: 'Commandes', items: [{ keys: [
    ['Marcher', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou flèches', 'stick gauche'],
    ['Sauter · se hisser · soulever', '<kbd>Espace</kbd>', 'Ⓐ'],
    ['Frapper (maintenir : gros coup) · en l\'air avec de l\'élan : coup de pied sauté', '<kbd>F</kbd> ou <kbd>J</kbd>, clic gauche', 'Ⓧ'],
    ['Saisir un adversaire ou un rebord (maintenir) · lâcher : jeter', '<kbd>E</kbd> ou <kbd>K</kbd>, clic droit', 'Ⓑ'],
    ['Ramasser un objet · le lancer', 'appui sur <kbd>E</kbd>', 'Ⓑ'],
    ['Assommé : revenir à soi · porté : se dégager', 'marteler <kbd>F</kbd>', 'Ⓧ'],
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
  try { saved = JSON.parse(localStorage.getItem('mollo_cfg') || '{}'); } catch (e) {}
  const src = H.embedded ? settings : { ...saved, ...Object.fromEntries(QS) };
  const num = (v, d) => (v === undefined || v === '' || !Number.isFinite(+v) ? d : +v);
  return {
    goal: GOALS.includes(num(src.goal, 3)) ? num(src.goal, 3) : 3,
    bots: clamp(num(src.bots, H.embedded ? 1 : 3) | 0, 0, MAX_BODIES - 1),
    level: LEVELS.includes(src.level) ? src.level : 'normal',
    hazards: num(src.hazards, 1) ? 1 : 0,
    items: num(src.items, 1) ? 1 : 0,
  };
}
function localProfile() {
  const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  return { name: String(g('dd_name', '') || 'Mollasson').slice(0, 12) || 'Mollasson', color: g('dd_color', '#ef6a2a') };
}
const PALETTE = ['#ef6a2a', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2'];
function humanPlayers() {
  if (!H.embedded) { const p = localProfile(); return [{ id: 0, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#ef6a2a' }]; }
  return H.players.map((p, i) => ({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[i % PALETTE.length] }));
}
const isReady = (id) => id === S.myId || !H.embedded || H.readyMap[id] === 'mollo';
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
  if (H.shown) scene.ready.then(() => H.shown());
  if (S.role === 'guest') send('host', { t: 'hi' });
  raf = requestAnimationFrame(loop);
  // ?debug : __mollo.run(2) fait avancer le jeu de 2 s image par image (même quand l'onglet est caché)
  if (QS.has('debug')) window.__mollo = { S, scene, input, hud, sfx, teardown, run: (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) step(1 / 60); } };
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
    try { localStorage.setItem('mollo_cfg', JSON.stringify(S.cfg)); } catch (e) {}
    sfx.unlock(); sfx.play('click'); showBriefing();
  };
}
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ''; S.menu = false; hud.show(true); }

// ------------------------------------------------------------------ hôte
function startRun() {
  if (S.role === 'guest') return;
  const dbg = QS.has('debug'), seed = dbg && QS.get('seed') ? +QS.get('seed') : (Math.random() * 2 ** 31) | 0;
  const sim = new Sim({ seed, goal: S.cfg.goal, hazards: !!S.cfg.hazards, items: !!S.cfg.items });
  for (const p of squad()) if (p.ready) sim.addPlayer({ id: p.id, name: p.name, color: p.color });
  sim.addBots(Math.max(botCount(), sim.players.size < 2 ? 1 : 0), S.cfg.level); // seul, au moins un adversaire
  sim.start();
  if (dbg && ARENAS[QS.get('arene')]) { sim.rd = 0; sim.drainEvents(); sim.startRound(QS.get('arene')); }
  S.sim = sim; S.runId = Date.now(); S.lobby = false; S.endShown = false; S.reported = false; S.netEv = []; S.acc = 0; S.tick = 0; S.sentOver = false; S.rounds = 0; S.prev = new Map();
  hud.clearTags();
  hideScreen();
  if (H.embedded) send('all', { t: 'go', run: S.runId });
}

const hasGuests = () => H.embedded && H.players.length > 1;

function hostFrame(dt) {
  const sim = S.sim;
  const paused = S.menu && S.role === 'solo';
  // le coup décisif au ralenti (seulement sans invités : ils verraient l'état à 7 images par seconde)
  const slow = !hasGuests() && sim.ph === 'round' && sim.pt > 2.7 ? 0.3 : 1;
  if (!paused) S.acc += Math.min(0.1, dt) * slow;
  const frameEv = [];
  while (S.acc >= DT) {
    S.acc -= DT;
    if (S.inp) sim.setInput(S.myId, S.inp);
    for (const b of sim.players.values()) { let a = S.prev.get(b.id); if (!a) { a = new Float32Array(21); S.prev.set(b.id, a); } b.p.forEach((q, i) => { a[i * 3] = q.x; a[i * 3 + 1] = q.y; a[i * 3 + 2] = q.z; }); }
    sim.step(DT);
    const ev = sim.drainEvents();
    frameEv.push(...ev);
    if (hasGuests()) S.netEv.push(...ev);
    S.tick++;
  }
  if (hasGuests() && (S.tick - S.lastSend >= 3 || (sim.ph === 'over' && !S.sentOver))) {
    const final = sim.ph === 'over' && !S.sentOver;
    S.lastSend = S.tick; if (final) S.sentOver = true;
    const snap = sim.snapshot(); snap.run = S.runId;
    send('all', { t: 's', s: snap }, { volatile: !final });
    if (S.netEv.length) send('all', { t: 'e', run: snap.run, ts: snap.t, e: S.netEv });
    S.netEv = [];
    S.last = snap;
  }
  const view = hostView(sim, S.acc / DT);
  for (const e of frameEv) fxEvent(e, view);
  if (sim.ph === 'over') report(sim);
  return view;
}

// la vue de l'hôte : les corps entre les deux derniers pas de physique (l'écran n'est pas calé sur 60 Hz : sinon, ça saccade)
function hostView(sim, f) {
  const players = [...sim.players.values()].map((b) => {
    let pos = null;
    if (b.st !== ST.OUT) {
      pos = new Float32Array(21); const a = S.prev.get(b.id);
      b.p.forEach((q, i) => {
        const ax = a ? a[i * 3] : q.x, ay = a ? a[i * 3 + 1] : q.y, az = a ? a[i * 3 + 2] : q.z, far = Math.abs(ax - q.x) + Math.abs(ay - q.y) + Math.abs(az - q.z) > 2;
        pos[i * 3] = far ? q.x : ax + (q.x - ax) * f; pos[i * 3 + 1] = far ? q.y : ay + (q.y - ay) * f; pos[i * 3 + 2] = far ? q.z : az + (q.z - az) * f;
      });
    }
    return { id: b.id, name: b.name, color: b.color, bot: b.bot, me: b.id === S.myId, st: b.st, yaw: b.yaw, dz: b.dz, fl: flagsOf(b), pts: b.pts, kos: b.kos, order: b.order, surv: b.surv, pos };
  });
  return { ph: sim.ph, pt: sim.pt, rd: sim.rd, rt: sim.rt, at: sim.at, go: sim.goal, rw: sim.rw, win: sim.win, ar: sim.arena.key, hz: sim.hazards ? 1 : 0, gu: sim.gust ? 1 : 0, players, items: sim.items.map((i) => ({ id: i.id, k: i.k, x: i.x, y: i.y, z: i.z, holder: i.holder ? i.holder.id : -1, fuse: i.fuse })), me: players.find((p) => p.me) || null };
}
const flagsOf = (b) => (b.grip[0] ? 1 : 0) | (b.grip[1] ? 2 : 0) | (b.lifting ? FL.LIFTING : 0) | (b.charge > 0.05 ? FL.CHARGE : 0) | (b.kick > 0 ? FL.KICK : 0) | (b.grounded ? FL.GROUND : 0) | (b.liftedBy >= 0 ? FL.LIFTED : 0) | (b.heldBy > 0 ? FL.HELD : 0) | (b.grip.some((q) => q && q.box) ? FL.HANG : 0);

function onRoster() {
  if (!S.alive) return;
  if (S.role === 'guest' && H.info.role === 'host') becomeHost();
  if (S.role !== 'host') { if (S.lobby) showBriefing(); return; }
  if (S.lobby) { showBriefing(); return; }
  const sim = S.sim; if (!sim) return;
  const ids = new Set(H.players.map((p) => p.id));
  for (const p of [...sim.players.values()]) if (!p.bot && p.id !== S.myId && (!ids.has(p.id) || !isReady(p.id))) sim.removePlayer(p.id);
  for (const p of squad()) if (p.ready && !sim.players.has(p.id)) { sim.addPlayer({ id: p.id, name: p.name, color: p.color }); send(p.id, { t: 'go', run: S.runId }); }
}

// Le Hub a désigné ce joueur comme nouvel hôte : la partie repart du dernier état reçu
function becomeHost() {
  S.role = 'host'; S.snaps = []; S.evq = [];
  const snap = S.last;
  if (snap && snap.ph !== 'over' && !S.lobby) {
    try {
      const sim = Sim.restore(snap);
      const ids = new Set(H.players.map((p) => p.id));
      for (const p of [...sim.players.values()]) if (!p.bot && !ids.has(p.id)) sim.removePlayer(p.id);
      sim.drainEvents();
      S.sim = sim; S.runId = snap.run || Date.now(); S.acc = 0; S.tick = 0; S.lastSend = -99; S.prev = new Map();
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
    id: `mollo-${S.runId}-${ranked.filter((p) => !p.bot).map((p) => p.id).join('.')}`,
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
  return { mx: n(m.mx, -1, 1), mz: n(m.mz, -1, 1), jump: !!m.jump, punch: !!m.punch, grab: !!m.grab, pc: m.pc | 0, jc: m.jc | 0, gc: m.gc | 0 };
}

// ------------------------------------------------------------------ invité
function receiveSnap(s) {
  const now = performance.now() / 1000;
  if (S.lobby || (S.last && s.run !== S.last.run)) {
    S.lobby = false; S.endShown = false; S.snaps = []; S.evq = []; S.off = null; hud.clearTags(); hideScreen();
  }
  const o = now - s.t;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snaps.push(s); if (S.snaps.length > 12) S.snaps.shift();
  S.last = s;
}
function receiveEvents(m) {
  if (S.lobby || !S.last || m.run !== S.last.run) return;
  for (const e of m.e) S.evq.push({ t: m.ts, e });
}

function guestFrame() {
  if (!S.snaps.length) return null;
  const now = performance.now() / 1000;
  const rt = now - S.off - INTERP;
  let a = S.snaps[0], b = S.snaps[S.snaps.length - 1];
  for (let i = 0; i < S.snaps.length - 1; i++) if (S.snaps[i].t <= rt && S.snaps[i + 1].t >= rt) { a = S.snaps[i]; b = S.snaps[i + 1]; break; }
  if (rt >= b.t) a = b;
  if (a.rd !== b.rd) a = b;
  const f = a === b ? 0 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
  const view = guestView(a, b, f);
  const due = []; S.evq = S.evq.filter((x) => (x.t <= rt + 0.001 ? (due.push(x.e), false) : true));
  for (const e of due) fxEvent(e, view);
  return view;
}
function guestView(a, b, f) {
  const lerpA = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return x + d * f; };
  const names = new Map(b.N.map(([id, n, c, bot]) => [id, [n, c, bot]]));
  const pa = new Map(a.P.map((r) => [r[0], r]));
  const players = b.P.map((rb) => {
    const ra = pa.get(rb[0]) || rb, [name, color, bot] = names.get(rb[0]) || ['?', '#888888', 0];
    let pos = null;
    if (rb[1] !== ST.OUT && rb.length >= 30) {
      pos = new Float32Array(21);
      const from = ra.length >= 30 ? ra : rb;
      for (let i = 0; i < 21; i++) pos[i] = (from[9 + i] + (rb[9 + i] - from[9 + i]) * f) / 100;
    }
    return { id: rb[0], name, color, bot: !!bot, me: rb[0] === S.myId, st: rb[1], yaw: lerpA(ra[2], rb[2]), dz: rb[3], fl: rb[4], pts: rb[5], kos: rb[6], order: rb[7], surv: rb[8], pos };
  });
  return { ph: b.ph, pt: b.pt, rd: b.rd, rt: b.rt, at: a.at + (b.at - a.at) * f, go: b.go, rw: b.rw, win: b.win, ar: b.ar, hz: b.hz, gu: b.gu, players, items: guestItems(a, b, f), me: players.find((p) => p.me) || null };
}
function guestItems(a, b, f) {
  const from = new Map((a.I || []).map((r) => [r[0], r]));
  return (b.I || []).map((r) => { const q = from.get(r[0]) || r; return { id: r[0], k: ITEM_KEYS[r[1]], x: (q[2] + (r[2] - q[2]) * f) / 100, y: (q[3] + (r[3] - q[3]) * f) / 100, z: (q[4] + (r[4] - q[4]) * f) / 100, holder: r[5], fuse: r[6] / 10 }; });
}

// ------------------------------------------------------------------ effets, sons, annonces
const nameOf = (id) => { const p = S.view && S.view.players.find((q) => q.id === id); return p ? `<b style="--c:${esc(p.color)}">${esc(p.name)}</b>` : '?'; };
let stopT = 0, stopCd = 0;
// arrêt sur image : l'affichage se fige un instant au moment du choc (la partie, elle, continue)
function hitStop(t) { if (stopCd > 0) return; stopT = Math.max(stopT, t); stopCd = 0.22; }
function fxEvent(e, v) {
  const fx = scene && scene.fx;
  S.view = v;
  const mine = e.id === S.myId || e.by === S.myId;
  switch (e.e) {
    case 'round': S.rounds++; S.count = 0; hud.banner(`Manche ${e.rd}<small>${esc(ARENAS[e.ar]?.name || '')}</small>`, 2.2); sfx.play('round'); break;
    case 'go': hud.banner('Baston !', 0.9, 'big win'); sfx.play('go'); break;
    case 'swing': sfx.play('swing', { k: e.k }); break;
    case 'kick': sfx.play('swing', { k: 1 }); break;
    case 'jump': if (e.id === S.myId) sfx.play('jump'); break;
    case 'hit': scene && scene.hurt(e.id); fx && fx.hit(e.x, e.y, e.z, e.k); sfx.play(e.pan ? 'pan' : e.head ? 'head' : 'hit', { vol: 0.55 + e.k * 0.5 }); if (mine || e.k > 0.5) hitStop(0.03 + e.k * 0.06); break;
    case 'ko': scene && scene.hurt(e.id); fx && fx.ko(e.x, e.y, e.z); sfx.play('ko'); hitStop(0.09); if (e.id === S.myId) hud.toast('Assommé ! Martèle les boutons', 1.8); else if (e.by === S.myId) hud.feed(`Tu assommes ${nameOf(e.id)} 💫`); break;
    case 'wake': if (e.id === S.myId) sfx.play('wake'); break;
    case 'land': fx && fx.dust(e.x, e.y, e.z, e.k); sfx.play('land', { vol: e.k }); break;
    case 'grab': sfx.play('grab'); if (e.who === S.myId) hud.toast('On t\'attrape ! Martèle pour te dégager', 1.3); break;
    case 'hold': if (e.id === S.myId) sfx.play('hold'); break;
    case 'slip': if (e.id === S.myId) { sfx.play('slip'); hud.toast('Tes mains glissent !', 1.1); } break;
    case 'climb': if (e.id === S.myId) sfx.play('climb'); break;
    case 'lift': sfx.play('lift'); if (e.who === S.myId) hud.toast('On te soulève ! Martèle pour te dégager', 1.4); break;
    case 'throw': sfx.play('throw'); hud.feed(`${nameOf(e.id)} jette ${nameOf(e.who)} 💪`); break;
    case 'ball': scene && scene.hurt(e.id); fx && fx.clang(e.x, e.y, e.z); sfx.play('clang'); hitStop(0.08); hud.feed(`${v.ar === 'tri' ? 'La barre balaie' : 'Le boulet écrase'} ${nameOf(e.id)} ${v.ar === 'tri' ? '📦' : '🏗️'}`); break;
    case 'crush': scene && scene.hurt(e.id); fx && fx.clang(e.x, e.y, e.z); sfx.play('crush'); hitStop(0.08); hud.feed(`Le pilon aplatit ${nameOf(e.id)} 🔨`); break;
    case 'spike': scene && scene.hurt(e.id); fx && fx.spike(e.x, e.y, e.z); sfx.play('spike'); hitStop(0.08); hud.feed(`Le rouleau pique ${nameOf(e.id)} 🦔`); break;
    case 'burn': fx && fx.burn(e.x, e.y, e.z); sfx.play('burn'); hud.feed(`${nameOf(e.id)} finit au four 🔥`); break;
    case 'alarm': sfx.play('alarm'); hud.banner('Les trappes s\'ouvrent !<small>Sors de là</small>', 1.5, 'warn'); break;
    case 'boom': fx && fx.boom(e.x, e.y, e.z); sfx.play('boom'); hitStop(0.1); break;
    case 'peel': scene && scene.hurt(e.id); fx && fx.peel(e.x, e.y, e.z); sfx.play('peel'); hud.feed(`${nameOf(e.id)} glisse sur une peau de banane 🍌`); break;
    case 'pick': if (e.id === S.myId) sfx.play('pick'); break;
    case 'toss': sfx.play('toss'); break;
    case 'sudden': hud.banner('Le vent se lève !<small>Cramponne-toi</small>', 2, 'warn'); sfx.play('gust'); break;
    case 'gust': sfx.play('gust'); break;
    case 'out':
      sfx.play('fall');
      if (e.id === S.myId) hud.banner('Dans le vide !', 2, 'warn');
      if (v.ph === 'play') hud.feed(e.by >= 0 ? `${nameOf(e.by)} envoie ${nameOf(e.id)} dans le vide 💨` : `${nameOf(e.id)} tombe tout seul 💨`);
      break;
    case 'roundEnd':
      if (e.id >= 0) {
        const w = e.win >= 0;
        hud.banner(e.id === S.myId ? (w ? 'Tu gagnes la partie !' : 'Tu gagnes la manche !') : `${esc(v.players.find((p) => p.id === e.id)?.name || '?')}<small>${w ? 'remporte la partie !' : 'gagne la manche'}</small>`, 3, 'win');
        sfx.play('win');
      } else { hud.banner('Plus personne !<small>Manche nulle</small>', 2.6); sfx.play('nobody'); }
      break;
  }
}

// ------------------------------------------------------------------ fin, menu
function showEnd(reason) {
  if (S.endShown) return;
  S.endShown = true;
  const v = S.view; if (!v && reason !== 'host') return;
  const ranking = v ? [...v.players].sort((a, b) => b.pts - a.pts || b.kos - a.kos || b.surv - a.surv) : [];
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
const EMPTY = { ar: 'toits', rd: 0, at: 0, hz: 1, ph: 'wait', players: [] };
function step(dt) {
  stopCd -= dt;
  const blocked = S.lobby || S.endShown || S.menu;
  const raw = input.sample();
  S.inp = blocked ? { ...raw, mx: 0, mz: 0, jump: false, punch: false, grab: false } : raw;

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
    view = guestFrame();
  }
  if (!view) {
    EMPTY.at += dt;
    if (scene) scene.frame(EMPTY, dt);
    sfx.update(dt, { music: S.lobby ? 'calm' : 'off' });
    return;
  }
  S.view = view;
  if (view.ph === 'count') {
    const n = Math.ceil(view.pt);
    if (n !== S.count && n > 0 && n <= 3) { S.count = n; hud.banner(String(n), 0.8, 'big'); sfx.play('tick'); }
  }
  if (view.ph === 'over' && !S.endShown) { if (S.prevPh !== 'over') S.overT = 1.8; S.overT -= dt; if (S.overT <= 0) showEnd(); }
  S.prevPh = view.ph;
  if (scene) {
    if (stopT > 0 && S.drawn) { stopT -= dt; scene.frame(S.drawn, dt * 0.08); }
    else { S.drawn = view; scene.frame(view, dt); }
  }
  hud.update(view, dt, { toScreen: scene ? scene.toScreen : () => ({ x: 0, y: 0 }), input, myId: S.myId, tips: S.rounds <= 2 && view.rt < 14 });
  const standing = view.players.filter((p) => p.st !== ST.OUT).length;
  sfx.update(dt, { wind: view.gu ? 1 : 0, music: view.ph === 'play' ? 'play' : view.ph === 'over' ? 'off' : 'calm', tense: clamp(1 - (standing - 2) / 4, 0, 1) });
}
