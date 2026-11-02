// Site Noir : démarrage, rôles, boucle de jeu, réseau via le Hub.
// L'hôte fait tourner le moteur à 60 Hz et diffuse les joueurs 20 fois par seconde, le reste (portes, objets…) quand ça change. L'invité envoie ses commandes à 30 Hz,
// anticipe son propre pas avec le même movePlayer, se recale sur l'hôte en rejouant ce que l'hôte n'a pas encore vu, et affiche les autres ~100 ms en retard.
// ?debug expose __sitenoir.run(sec) ; ?autostart, ?role=m|s, ?seed, ?level, ?duree, ?lag=150 (aller-retour simulé).
import { Sim, DT, FUSES, emptyInput, movePlayer, interactTarget, applyRow, rowOf } from './engine/sim.js';
import { buildMap, Z, T, W, ZONE_NAMES, zoneAt, DEEP, Nav, hasLOS } from './engine/map.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';
import { HUD, briefingHtml, menuHtml, endHtml, goalOf } from './view/hud.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const LAG = Math.max(0, Math.min(1000, +QS.get('lag') || 0));
const $ = (s) => document.querySelector(s);
const screenEl = $('#screen');
const INTERP = 0.1, HOST_SILENCE = 2.5, HOST_GIVEUP = 15, MAX_REPLAY = 90;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const lerpA = (a, b, f) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return a + d * f; };

const M = buildMap();
const S = {
  role: 'solo', myId: 0, cfg: null, sim: null, runId: 0, lobby: true, menu: false, alive: true, endShown: false, reported: false, netEv: [], tick: 0, lastSend: 0, lastW: 0, sentOver: false,
  acc: 0, inp: null, seq: 0, sendT: 0, gotHost: false, hiT: 0, snapAt: 0, view: null, overT: 0, warned: false,
  // côté invité
  w: null, sheets: new Map(), snaps: [], off: null, pred: null, pending: [], errX: 0, errZ: 0, lastRows: null,
  // vue
  rp: new Map(), cctv: -1, mapOpen: false, specI: 0, prevFc: 0, prevUc: 0, roleShown: false, steps: new Map(), genWork: 0, emf: 0, cam: null, chase: 0, sightCd: 0, guideT: 0, guideWp: null, guideDist: 0,
};
const send = (to, m, o) => { if (LAG) setTimeout(() => H.send(to, m, o), LAG / 2); else H.send(to, m, o); };

// ------------------------------------------------------------------ montage
const hud = new HUD();
const sfx = new Sfx();
sfx.occluded = (x, y, z) => { const L = sfx.L, w = S.w; return !w || Math.abs((y ?? L.y) - L.y) > 3.4 || !hasLOS(M, w.doors, L.x, L.z, x, z); };
let scene = null;
try { scene = createScene($('#stage'), { map: M, quality: QS.get('q') || 'normal', onLost: () => hud.toast('Affichage 3D interrompu : recharge la page', 6) }); }
catch (e) { console.error(e); }
const input = new Input($('#stage'), {
  menu: () => { if (S.cctv >= 0) closeCctv(); else toggleMenu(); },
  unlocked: () => { if (!S.lobby && !S.endShown && !S.menu && !QS.has('debug')) toggleMenu(); },
  mute: () => { sfx.unlock(); DDVolume.toggle(); },
  unlock: () => sfx.unlock(),
  enter: () => { const b = $('#btnGo') || $('#btnAgain'); if (b) b.click(); },
  map: (on) => { S.mapOpen = on; },
  screens: () => { if (S.cctv >= 0) closeCctv(); else if (S.view?.real?.st === 'ok' && S.view.real.role === 's' && S.view.real.hide < 0 && S.view.real.inv?.some((s) => s?.k === 'cams')) openCctv(); },
  cam: (d) => switchCam(d),
});
input.bindTouch($('#tbtns'));
const SETTINGS = {
  accent: '#e8a53a',
  hint: 'Touche <kbd>M</kbd> : couper ou remettre le son.',
  test: () => sfx.play('roar', { vol: 0.5 }),
  sections: [{ title: 'Commandes', items: [{ keys: [
    ['Avancer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou flèches', 'stick gauche'],
    ['Courir · s\'accroupir', '<kbd>Maj</kbd> · <kbd>C</kbd>', 'LB · Ⓑ'],
    ['Utiliser (maintenir : fouiller, réparer, relever)', '<kbd>E</kbd> ou clic droit', 'Ⓐ'],
    ['Objet tenu · griffes', 'clic gauche', 'gâchette droite'],
    ['Case · pouvoir du monstre', '<kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd>', 'flèches'],
    ['Lampe · changer la pile (monstre : hurlement) · lâcher', '<kbd>F</kbd> · <kbd>R</kbd> · <kbd>G</kbd>', 'Ⓨ · Ⓧ'],
    ['Écrans des caméras · plan', '<kbd>T</kbd> · <kbd>Tab</kbd>', ''],
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
const LEVELS = ['facile', 'normal', 'expert'], DUREES = [10, 15, 20], PLACES = [3, 4];
function readCfg(settings = {}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('sitenoir_cfg') || '{}'); } catch (e) {}
  const src = H.embedded ? settings : { ...saved, ...Object.fromEntries(QS) };
  const num = (v, d) => (v === undefined || v === '' || !Number.isFinite(+v) ? d : +v);
  let monster = src.monster ?? 'random';
  if (QS.get('role') === 'm') monster = 'host'; else if (QS.get('role') === 's') monster = 'bot';
  return { monster: /^\d+$/.test(String(monster)) ? +monster : monster, level: LEVELS.includes(src.level) ? src.level : 'normal', duree: DUREES.includes(num(src.duree, 15)) ? num(src.duree, 15) : 15, places: PLACES.includes(num(src.places, 4)) ? num(src.places, 4) : 4 };
}
function localProfile() {
  const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  return { name: String(g('dd_name', '') || 'Enquêteur').slice(0, 12) || 'Enquêteur', color: g('dd_color', '#e8a53a') };
}
const PALETTE = ['#e8a53a', '#4aa3df', '#62c370', '#d36bd8', '#f0e04a', '#ef6a6a'];
const BOT_NAMES = ['Mara', 'Ilyes', 'Jo', 'Sacha', 'Noor', 'Teo'];
function humanPlayers() {
  if (!H.embedded) { const p = localProfile(); return [{ id: 0, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[0] }]; }
  return H.players.map((p, i) => ({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[i % PALETTE.length] }));
}
const isReady = (id) => id === S.myId || !H.embedded || H.readyMap[id] === 'sitenoir';
const squad = () => humanPlayers().map((p) => ({ ...p, me: p.id === S.myId, ready: isReady(p.id) }));
// qui joue le monstre ? null : un bot
function pickMonster(humans) {
  const c = S.cfg.monster;
  if (c === 'bot') return null;
  if (c === 'host') return S.myId;
  if (typeof c === 'number' && humans.some((p) => p.id === c)) return c;
  if (!humans.length) return null;
  // au hasard : parmi les humains s'ils sont plusieurs, et une chance sur deux pour celui qui joue seul
  if (humans.length === 1) return Math.random() < 0.5 ? humans[0].id : null;
  return humans[Math.floor(Math.random() * humans.length)].id;
}

// ------------------------------------------------------------------ démarrage
function boot(info) {
  S.role = H.embedded ? info.role : 'solo';
  S.myId = H.embedded ? info.myId : 0;
  S.cfg = readCfg(info.settings || {});
  H.on('msg', (from, m) => { if (LAG) setTimeout(() => onMsg(from, m), LAG / 2); else onMsg(from, m); });
  H.on('roster', onRoster);
  if (H.embedded) H.signalReady(); // après on('msg') : sinon les premiers messages de l'hôte se perdent
  if (!scene) { showNoGL(); if (H.shown) H.shown(); return; }
  showBriefing();
  if (H.shown) scene.ready.then(() => H.shown());
  if (S.role === 'guest') send('host', { t: 'hi' });
  raf = requestAnimationFrame(loop);
  if (QS.has('debug')) window.__sitenoir = { S, scene, input, hud, sfx, M, teardown, run: (sec) => { for (let i = 0; i < Math.round(sec * 60); i++) step(1 / 60); }, to: (x, z) => { const p = S.sim.byId.get(S.myId); p.x = x; p.z = z; } };
  if (QS.has('autostart') && S.role !== 'guest') scene.ready.then(() => setTimeout(startRun, 100));
}
if (H.embedded) H.on('init', boot); else boot({});

function showNoGL() {
  screenEl.hidden = false; screenEl.className = 'screen dim';
  screenEl.innerHTML = `<div class="nogl"><p>Ton navigateur n'arrive pas à afficher la 3D (WebGL).</p>${H.embedded ? '<button class="btn" id="btnExit">Retour au salon</button>' : ''}</div>`;
  const b = $('#btnExit'); if (b) b.onclick = exitToLobby;
}

function plannedBots() {
  const humans = squad().filter((p) => p.ready), c = S.cfg.monster;
  const mh = c === 'host' || typeof c === 'number' || (c === 'random' && humans.length > 1) ? 1 : 0;
  return Math.max(0, S.cfg.places - (humans.length - mh));
}
function showBriefing() {
  if (!S.lobby) return;
  screenEl.className = 'screen'; screenEl.hidden = false;
  screenEl.innerHTML = briefingHtml({ role: S.role, squad: squad(), cfg: S.cfg, embedded: H.embedded, investigators: plannedBots() });
  hud.show(false);
  const go = $('#btnGo'); if (go) { go.onclick = () => { sfx.unlock(); startRun(); }; go.focus({ preventScroll: true }); }
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
  for (const b of screenEl.querySelectorAll('.seg button')) b.onclick = () => {
    const k = b.dataset.k, v = b.dataset.v;
    S.cfg[k] = k === 'level' ? v : k === 'monster' ? (/^\d+$/.test(v) ? +v : v) : +v;
    try { localStorage.setItem('sitenoir_cfg', JSON.stringify({ ...S.cfg, monster: typeof S.cfg.monster === 'number' ? (S.cfg.monster === S.myId ? 'host' : 'random') : S.cfg.monster })); } catch (e) {}
    sfx.unlock(); sfx.play('click'); showBriefing();
  };
}
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ''; S.menu = false; hud.show(true); if (!input.free && !QS.has('debug')) input.lock(); }

// ------------------------------------------------------------------ hôte
function startRun() {
  if (S.role === 'guest') return;
  const dbg = QS.has('debug'), seed = dbg && QS.get('seed') ? +QS.get('seed') : (Math.random() * 2 ** 31) | 0;
  const sim = new Sim({ seed, level: S.cfg.level, duration: S.cfg.duree * 60, map: M });
  const humans = squad().filter((p) => p.ready), mid = pickMonster(humans);
  for (const p of humans) if (p.id !== mid) sim.addPlayer({ id: p.id, name: p.name, color: p.color });
  let nid = 1000, bi = 0;
  const free = Math.floor(Math.random() * BOT_NAMES.length);
  while (sim.players.filter((p) => p.role === 's').length < S.cfg.places) { const name = BOT_NAMES[(free + bi) % BOT_NAMES.length]; sim.addPlayer({ id: nid++, name, color: PALETTE[(humans.length + bi) % PALETTE.length], bot: true }); bi++; }
  const mh = humans.find((p) => p.id === mid);
  sim.addPlayer(mh ? { id: mh.id, name: mh.name, color: '#c9271c', role: 'm' } : { id: nid++, name: 'Le monstre', color: '#c9271c', bot: true, role: 'm' });
  S.sim = sim; S.runId = Date.now(); S.lobby = false; S.endShown = false; S.reported = false; S.netEv = []; S.acc = 0; S.tick = 0; S.lastW = -999; S.sentOver = false; S.rp.clear(); S.steps.clear(); S.cctv = -1; S.roleShown = false; S.overT = 0; S.sightCd = 0; S.chase = 0;
  S.w = sim.w;
  hideScreen();
  if (H.embedded) send('all', { t: 'go', run: S.runId });
}
const hasGuests = () => H.embedded && H.players.length > 1;

function hostFrame(dt) {
  const sim = S.sim, paused = S.menu && S.role === 'solo';
  if (!paused) S.acc += Math.min(0.1, dt);
  const frameEv = [];
  while (S.acc >= DT) {
    S.acc -= DT;
    if (S.inp) sim.setInput(S.myId, S.inp);
    for (const p of sim.players) { p._px = p.x; p._pz = p.z; p._py = p.y; }
    sim.step(DT);
    const ev = sim.drainEvents();
    frameEv.push(...ev);
    if (hasGuests()) S.netEv.push(...ev);
    S.tick++;
  }
  if (hasGuests()) {
    // d'abord l'état lent, ensuite les événements : un événement ne doit jamais précéder ce qu'il annonce
    if (sim.dirty ? S.tick - S.lastW >= 12 : S.tick - S.lastW >= 90) { S.lastW = S.tick; sim.dirty = false; send('all', { t: 'w', run: S.runId, w: sim.world() }); }
    if (S.netEv.length) { send('all', { t: 'e', run: S.runId, e: S.netEv }); S.netEv = []; }
    if (S.tick - S.lastSend >= 3 || (sim.w.ph === 'over' && !S.sentOver)) {
      const final = sim.w.ph === 'over' && !S.sentOver;
      S.lastSend = S.tick;
      if (final) { S.sentOver = true; sim.dirty = false; send('all', { t: 'w', run: S.runId, w: sim.world() }); }
      send('all', { t: 's', run: S.runId, ts: sim.w.t, r: sim.rows(), tl: +sim.w.tl.toFixed(2), ly: +sim.w.lift.y.toFixed(3), gen: +sim.w.gen.toFixed(1) }, { volatile: !final });
    }
  } else sim.dirty = false;
  S.w = sim.w;
  const f = S.acc / DT, list = [];
  for (const p of sim.players) {
    const r = renderOf(p);
    Object.assign(r, { id: p.id, name: p.name, color: p.color, role: p.role, bot: p.bot, spectator: p.spectator, st: p.st, downs: p.downs || 0, hide: p.hide, torch: p.torch, crouch: p.crouch, run: p.run, moving: p.moving, atk: p.atkT > 0, atkT: p.atkT, stun: p.stun, hp: p.hp, stam: p.stam, batt: p.batt, energy: p.energy, inv: p.inv, sel: p.sel, proofs: p.proofs, cd: p.cd, sated: p.sated, wake: p.wake, holdFrac: p.holdFrac, scan: p.scan, downT: p.downT, audio: p.audio, kills: p.kills, score: p.score, escaped: p.escaped, pitch: p.pitch, yaw: p.yaw });
    const far = p._px === undefined || Math.abs(p._px - p.x) + Math.abs(p._pz - p.z) > 2;
    r.x = far ? p.x : p._px + (p.x - p._px) * f; r.z = far ? p.z : p._pz + (p.z - p._pz) * f; r.y = far ? p.y : p._py + (p.y - p._py) * f;
    list.push(r);
  }
  const view = buildView(list, sim.w);
  for (const e of frameEv) fxEvent(e, view);
  if (sim.w.ph === 'over') report(sim);
  return view;
}
const renderOf = (p) => { let r = S.rp.get(p.id); if (!r) S.rp.set(p.id, r = {}); return r; };

function onRoster() {
  if (!S.alive) return;
  if (S.role === 'guest' && H.info.role === 'host') becomeHost();
  if (S.role !== 'host') { if (S.lobby) showBriefing(); return; }
  if (S.lobby) { showBriefing(); return; }
  const sim = S.sim; if (!sim) return;
  const ids = new Set(H.players.map((p) => p.id));
  for (const p of [...sim.players]) if (!p.bot && p.id !== S.myId && (!ids.has(p.id) || !isReady(p.id))) sim.replaceByBot(p.id);
  for (const p of squad()) if (p.ready && !sim.byId.has(p.id)) { sim.addPlayer({ id: p.id, name: p.name, color: p.color, spectator: true }); send(p.id, { t: 'go', run: S.runId }); sim.touch(); }
}
// Le Hub a désigné ce joueur comme nouvel hôte : la partie repart du dernier état reçu
function becomeHost() {
  S.role = 'host'; const world = S.lastWorld, rows = S.lastRows;
  S.snaps = []; S.pending = []; S.pred = null;
  if (world && world.ph !== 'over' && !S.lobby) {
    try {
      const sim = Sim.restore({ ...world, tl: S.w ? S.w.tl : world.tl }, rows);
      const ids = new Set(H.players.map((p) => p.id));
      for (const p of [...sim.players]) if (!p.bot && !ids.has(p.id)) sim.replaceByBot(p.id);
      const me = sim.byId.get(S.myId); if (me) { input.yaw = me.yaw; input.pitch = me.pitch; }
      S.sim = sim; S.w = sim.w; S.acc = 0; S.tick = 0; S.lastW = -999; S.lastSend = -99; S.rp.clear();
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
    id: `sitenoir-${S.runId}-${ranked.filter((p) => !p.bot).map((p) => p.id).join('.')}`,
    mode: sim.w.win === 's' ? 'Extraction réussie' : 'Personne n\'est sorti',
    players: ranked.map((p, k) => ({ id: p.bot ? null : p.id, name: p.name, color: p.color, bot: p.bot, rank: k + 1, score: p.score })),
  });
}

// ------------------------------------------------------------------ messages
function onMsg(from, m) {
  if (!S.alive || !m || typeof m !== 'object') return;
  if (S.role === 'host' || S.role === 'solo') {
    if (m.t === 'hi') {
      if (!S.lobby && S.sim) {
        if (!S.sim.byId.has(from)) { const p = squad().find((q) => q.id === from); if (p) S.sim.addPlayer({ id: p.id, name: p.name, color: p.color, spectator: true }); }
        send(from, { t: 'go', run: S.runId }); S.sim.touch(); S.lastW = -999;
      }
    } else if (m.t === 'i' && S.sim) S.sim.setInput(from, cleanInput(m)); // `from` vient du Hub : seule identité fiable
    return;
  }
  if (from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  S.gotHost = true; S.snapAt = performance.now();
  if (m.t === 'go') newRun(m.run);
  else if (m.t === 'w' && m.w) { if (m.run !== S.runId) newRun(m.run); receiveWorld(m.w); }
  else if (m.t === 's' && Array.isArray(m.r)) { if (m.run === S.runId) receiveRows(m); }
  else if (m.t === 'e' && Array.isArray(m.e)) { if (m.run === S.runId && S.view) for (const e of m.e) fxEvent(e, S.view); }
}
function newRun(run) {
  if (S.runId === run && !S.lobby) return;
  S.runId = run; S.lobby = false; S.endShown = false; S.w = null; S.sheets.clear(); S.snaps = []; S.pending = []; S.pred = null; S.off = null; S.rp.clear(); S.steps.clear(); S.cctv = -1; S.roleShown = false; S.overT = 0; S.errX = S.errZ = 0;
  hideScreen();
}
function cleanInput(m) {
  const n = (v, a, b) => (Number.isFinite(+v) ? clamp(+v, a, b) : 0);
  return { mx: n(m.mx, -1, 1), my: n(m.my, -1, 1), yaw: n(m.yaw, -1e4, 1e4), pitch: n(m.pitch, -1.5, 1.5), run: !!m.run, crouch: !!m.crouch, use: !!m.use, fire: !!m.fire, sel: clamp(m.sel | 0, 0, 2), uc: m.uc | 0, fc: m.fc | 0, dc: m.dc | 0, tc: m.tc | 0, rc: m.rc | 0, a1: m.a1 | 0, a2: m.a2 | 0, a3: m.a3 | 0, q: m.q | 0 };
}

// ------------------------------------------------------------------ invité
function receiveWorld(world) {
  const { pl, seedRun, ...w } = world;
  // le chrono et la position de la cabine arrivent plus souvent par les instantanés
  S.w = w; S.lastWorld = world;
  for (const f of pl) { const q = S.sheets.get(f.id); S.sheets.set(f.id, q ? Object.assign(q, f) : f); }
}
function receiveRows(m) {
  const now = performance.now() / 1000;
  const o = now - m.ts;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snaps.push({ t: m.ts, rows: new Map(m.r.map((r) => [r[0], r])) });
  if (S.snaps.length > 10) S.snaps.shift();
  S.lastRows = m.r;
  if (S.w) { S.w.tl = m.tl; S.w.lift.y = m.ly; S.w.gen = m.gen; }
  reconcile(m.r);
}
// se recaler sur l'hôte : on repart de sa position, et on rejoue les pas qu'il n'a pas encore reçus. L'écart restant se résorbe en douceur à l'écran.
function reconcile(rows) {
  const r = rows.find((q) => q[0] === S.myId);
  if (!r || !S.w) return;
  if (!S.pred) { S.pred = { role: S.sheets.get(S.myId)?.role || 's', x: 0, z: 0, y: 0, yaw: 0, pitch: 0, st: 'ok', hide: -1, stam: 100, energy: 1, stepAcc: 0, mul: 1 }; applyRow(S.pred, r); S.pred.role = S.sheets.get(S.myId)?.role || 's'; input.yaw = S.pred.yaw; input.pitch = S.pred.pitch; return; }
  const P = S.pred, ox = P.x, oz = P.z, role = S.sheets.get(S.myId)?.role || P.role;
  const yaw = P.yaw, pitch = P.pitch;
  applyRow(P, r); P.role = role; P.yaw = yaw; P.pitch = pitch;
  const ack = r[10];
  S.pending = S.pending.filter((s) => s.q > ack);
  if (S.pending.length > MAX_REPLAY) S.pending.splice(0, S.pending.length - MAX_REPLAY);
  for (const s of S.pending) movePlayer(M, S.w, P, s.inp, DT);
  const dx = ox - P.x, dz = oz - P.z, d = Math.hypot(dx, dz);
  if (d > 3) { S.errX = S.errZ = 0; } else { S.errX += dx; S.errZ += dz; const e = Math.hypot(S.errX, S.errZ); if (e > 1.2) { S.errX *= 1.2 / e; S.errZ *= 1.2 / e; } }
}
function guestFrame(dt) {
  if (!S.w || !S.snaps.length) return null;
  const w = S.w, rt = performance.now() / 1000 - S.off - INTERP;
  let a = S.snaps[0], b = S.snaps[S.snaps.length - 1];
  for (let i = 0; i < S.snaps.length - 1; i++) if (S.snaps[i].t <= rt && S.snaps[i + 1].t >= rt) { a = S.snaps[i]; b = S.snaps[i + 1]; break; }
  if (rt >= b.t) a = b;
  const f = a === b ? 0 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
  // mon pas à moi, sans attendre l'hôte
  if (S.pred && S.inp) {
    S.acc += Math.min(0.1, dt);
    while (S.acc >= DT) { S.acc -= DT; const inp = { ...S.inp, q: S.seq + 1 }; movePlayer(M, w, S.pred, inp, DT); S.pending.push({ q: S.seq + 1, inp }); }
    const k = Math.exp(-dt * 10); S.errX *= k; S.errZ *= k;
  }
  // les chronos de la fiche avancent entre deux envois
  for (const f2 of S.sheets.values()) { if (f2.cd) for (const c in f2.cd) f2.cd[c] = Math.max(0, f2.cd[c] - dt); if (f2.sated > 0) f2.sated = Math.max(0, f2.sated - dt); if (f2.wake > 0) f2.wake = Math.max(0, f2.wake - dt); }
  const list = [];
  for (const [id, sh] of S.sheets) {
    const r = renderOf(sh); Object.assign(r, sh);
    const rb = b.rows.get(id), ra = a.rows.get(id) || rb;
    if (rb) {
      applyRow(r, rb);
      r.x = (ra[1] + (rb[1] - ra[1]) * f) / 100; r.y = (ra[2] + (rb[2] - ra[2]) * f) / 100; r.z = (ra[3] + (rb[3] - ra[3]) * f) / 100;
      r.yaw = lerpA(ra[4] / 1000, rb[4] / 1000, f); r.pitch = (ra[5] + (rb[5] - ra[5]) * f) / 1000;
    }
    if (id === S.myId && S.pred && S.pred.st !== 'dead' && S.pred.st !== 'out') {
      r.x = S.pred.x + S.errX; r.z = S.pred.z + S.errZ; r.y = S.pred.y; r.moving = S.pred.moving; r.crouch = S.pred.crouch; r.run = S.pred.run; r.stam = S.pred.stam; r.energy = S.pred.energy;
    }
    list.push(r);
  }
  return buildView(list, w);
}

// ------------------------------------------------------------------ ce qu'on voit
function buildView(list, w) {
  const real = list.find((p) => p.id === S.myId) || null;
  let me = real, mine = true;
  if (real && real.role === 's' || real === null || real.spectator) {
    if (!real || real.st === 'dead' || real.st === 'out' || real.spectator) {
      // on regarde un autre enquêteur (ou le monstre s'il n'en reste aucun)
      const alive = list.filter((p) => p !== real && !p.spectator && (p.st === 'ok' || p.st === 'down') && p.role === 's');
      const pool = alive.length ? alive : list.filter((p) => p.role === 'm');
      me = pool.length ? pool[S.specI % pool.length] : real; mine = false;
    }
  }
  if (real && mine) { real.yaw = input.yaw; real.pitch = input.pitch; }
  const vision = me && me.role === 'm' ? 'm' : 's';
  const target = real && mine && real.st === 'ok' ? interactTarget(M, w, list, real) : null;
  const held = real && mine && real.inv?.[real.sel];
  const emfOn = held && held.k === 'emf';
  let emfLevel = 0;
  if (emfOn) {
    let d = 1e9;
    for (const t of w.traces) if (!t.done && Math.abs(t.y - real.y) < 3) d = Math.min(d, Math.hypot(t.x - real.x, t.z - real.z));
    const m = list.find((p) => p.role === 'm');
    if (m && !m.wake && Math.abs(m.y - real.y) < 3) d = Math.min(d, Math.hypot(m.x - real.x, m.z - real.z));
    emfLevel = d < 2.6 ? 5 : d < 5 ? 4 : d < 8 ? 3 : d < 12 ? 2 : d < 18 ? 1 : 0;
  }
  let camMode = 'fps', cctv = null;
  if (S.cctv >= 0 && w.cams.length) {
    S.cctv %= w.cams.length;
    const c = w.cams[S.cctv], zone = zoneAt(M, c.x, c.z);
    camMode = 'cctv'; cctv = { ...c, label: `CAM ${S.cctv + 1}/${w.cams.length} · ${ZONE_NAMES[zone] || ''}` };
  } else if (S.cctv >= 0) closeCctv();
  document.body.classList.toggle('cctv-on', !!cctv);
  return { w, players: list, me, real, mine, vision, target, camMode, cctv, emf: !!emfOn, emfLevel, yawFor: real ? real.yaw : 0 };
}
function openCctv() {
  if (!S.w.cams.length) { hud.toast('Aucune caméra posée : clic gauche avec le kit pour en poser une', 3); return; }
  S.cctv = 0; sfx.play('click');
}
function closeCctv() { if (S.cctv < 0) return; S.cctv = -1; sfx.play('click'); document.body.classList.remove('cctv-on'); }
function switchCam(d) { if (S.cctv < 0 || !S.w) return; const n = S.w.cams.length; if (n) { S.cctv = (S.cctv + d + n) % n; sfx.play('click'); } }

// ------------------------------------------------------------------ effets, sons, annonces
const nameOf = (id) => { const p = S.view && S.view.players.find((q) => q.id === id); return p ? `<b style="--c:${esc(p.color)}">${esc(p.name)}</b>` : '?'; };
function fxEvent(e, v) {
  const fx = scene && scene.fx, me = v.real, isM = me && me.role === 'm', meId = S.myId;
  const pos = { x: e.x, y: e.y, z: e.z };
  switch (e.e) {
    case 'info': if (e.id === meId) hud.toast(e.msg, e.long ? 5 : 2.5); break;
    case 'n': if (isM) { const d = Math.hypot(e.x - me.x, e.z - me.z); if (d < e.r * 2.6) hud.ping(e.x, e.z, e.r); } break;
    case 'pick': sfx.play('pick', { x: e.x, z: e.z, y: me?.y, range: 10 }); break;
    case 'proofpick': if (e.id === meId) { sfx.play('pick'); hud.toast(e.n > 1 ? `${e.n} preuves récupérées` : 'Preuve récupérée'); } break;
    case 'drop': if (e.id === meId) sfx.play('search'); break;
    case 'door': sfx.play(e.lift ? 'liftdoor' : 'door', { ...pos, open: e.open, range: 26 }); break;
    case 'locker': sfx.play('locker', { ...pos, range: 14 }); break;
    case 'bang': sfx.play('bang', { ...pos, range: 30 }); fx && me && Math.hypot(e.x - me.x, e.z - me.z) < 3 && fx.shake(0.5); break;
    case 'found':
      if (e.by !== undefined) { if (e.id === meId) { sfx.play('scare'); hud.hurt(1); fx && fx.jump(); hud.banner('Il t\'a trouvé.', 2, 'warn'); } else hud.feed(`${nameOf(e.by)} sort ${nameOf(e.id)} d'un casier`); }
      else { if (e.empty) { if (e.id === meId) { sfx.play('empty', { ...pos }); hud.toast('Rien ici'); } } else { sfx.play('found', { ...pos, range: 12 }); if (e.id === meId) hud.toast(`Trouvé : ${e.what}${e.taken ? ', dans ton sac' : '. Sac plein : il reste sur le meuble'}`, 3.5); else hud.feed(`${nameOf(e.id)} trouve : ${esc(e.what)}`); } }
      break;
    case 'deny': sfx.play('deny', { ...pos, range: 10 }); break;
    case 'unlock': sfx.play('unlock', { ...pos, range: 20 }); hud.feed(`${nameOf(e.by)} ouvre : ${esc(M.doors[e.id].name)}`); break;
    case 'fuse': sfx.play('fuse', { x: e.x, z: e.z, y: DEEP, range: 30 }); hud.feed(`Fusible branché : ${e.n}/${FUSES}`); break;
    case 'lift':
      if (e.k === 'call') { sfx.play('ding', { x: M.liftCall.x, z: M.liftCall.z, y: DEEP, range: 60 }); sfx.play('lifthum', { d: 10, x: 60, z: 45, y: 0, range: 60 }); hud.banner('L\'ascenseur descend<small>Tenez jusqu\'à son arrivée</small>', 2.6); }
      else if (e.k === 'arrive') sfx.play('ding', { x: 60, z: 45, y: e.at === 'top' ? 0 : DEEP, range: 40 });
      else if (e.k === 'up' || e.k === 'down') sfx.play('lifthum', { d: 7, x: 60, z: 45, y: S.w.lift.y, range: 30 });
      break;
    case 'swing': sfx.play('swing', { ...pos, range: 12 }); if (e.id === meId) fx && fx.swing(); break;
    case 'flash': fx && fx.flash(e.x, e.y, e.z); sfx.play('flash', { ...pos, range: 26 }); if (e.id === meId) hud.flash(0.45); break;
    case 'stun': sfx.play('stun', { ...pos, range: 30 }); if (isM) { hud.flash(1); hud.toast('Aveuglé !', 2); } else hud.feed(`${nameOf(e.by)} aveugle le monstre`); break;
    case 'cam': sfx.play('cam', { ...pos, range: 10 }); if (e.id === meId) hud.toast('Caméra posée : T pour regarder les écrans', 3); break;
    case 'camdead': sfx.play('camdead', { ...pos, range: 20 }); if (!isM) hud.feed('Une caméra vient de lâcher'); if (S.cctv >= 0) closeCctv(); break;
    case 'reload': if (e.id === meId) sfx.play('reload'); break;
    case 'proof': if (e.id === meId) { sfx.play('proof'); hud.toast(e.kind === 'photo' ? 'Preuve : photo du monstre' : e.kind === 'trace' ? 'Preuve : trace relevée' : 'Preuve : son enregistré', 3.5); } else hud.feed(`${nameOf(e.id)} a une preuve`); break;
    case 'dark': { const here = me && zoneAt(M, me.x, me.z) === e.zone; if (here || isM) sfx.play('dark', { vol: here ? 1 : 0.4 }); if (here && !isM) hud.banner('Les lumières lâchent', 1.8, 'warn'); else if (isM) hud.toast(`Courant coupé : ${ZONE_NAMES[e.zone] || ''}`); break; }
    case 'lightsback': if (me && zoneAt(M, me.x, me.z) === e.zone) sfx.play('lightsback'); break;
    case 'jam': sfx.play('bang', { ...pos, vol: 0.6, range: 22 }); if (isM) hud.toast('Porte bloquée'); break;
    case 'down':
      sfx.play('down', { ...pos, range: 30 });
      if (e.id === meId) { hud.hurt(1); sfx.play('scare'); fx && fx.jump(); hud.banner('À terre', 2.4, 'warn'); } else if (isM && e.by === meId) { hud.toast('Il est à terre. Tu es repu pour un moment.', 3.5); hud.feed(`${nameOf(e.id)} est à terre`); } else hud.feed(`${nameOf(e.id)} est à terre`);
      break;
    case 'hit': sfx.play('hit', { ...pos, range: 20 }); if (e.id === meId) { hud.hurt(0.8); fx && fx.hurt(); hud.toast('Cours !', 1.2); } break;
    case 'dead':
      sfx.play('growl', { ...pos, range: 40 });
      if (e.id === meId) { hud.banner('Tu es mort<small>Tu peux regarder les autres finir</small>', 3.4, 'warn'); closeCctv(); } else hud.feed(`${nameOf(e.id)} est mort`);
      break;
    case 'wake': sfx.play('wake'); if (isM) hud.banner('Les portes s\'ouvrent', 2.2, 'warn'); else hud.banner('Quelque chose vient de sortir', 3, 'warn'); break;
    case 'torch': if (e.id === meId) sfx.play('torch', { on: e.on }); else sfx.play('torch', { ...pos, on: e.on, vol: 0.5, range: 10 }); break;
    case 'roar': {
      sfx.play('roar', { ...pos, range: 70 });
      if (e.id === meId) { fx && fx.shake(0.45); break; }
      const d = me ? Math.hypot(e.x - me.x, e.z - me.z) : 99;
      if (d < 22 && fx) { fx.shake(d < 13 ? 0.9 : 0.4); fx.dread(d < 13 ? 1 : 0.5); }
      if (d < 13 && !isM) hud.toast('Ce cri te coupe le souffle', 2.4);
      break;
    }
    case 'extract': sfx.play('extract'); if (e.id === meId) hud.banner('Tu es sorti<small>Tu peux regarder les autres finir</small>', 3, 'good'); else hud.feed(`${nameOf(e.id)} est sorti`); break;
    case 'genwork': sfx.play('genwork', { x: e.x, z: e.z, y: DEEP, range: 30 }); break;
    case 'gen': sfx.play('gen'); hud.banner(isM ? 'Ils ont relancé le courant<small>Empêche-les de remonter</small>' : 'Le courant revient<small>Appelez l\'ascenseur</small>', 3.4, isM ? 'warn' : 'good'); break;
    case 'smash': sfx.play('smash', { x: e.x, z: e.z, y: DEEP, range: 40 }); if (isM) hud.toast(`Générateur saboté : ${Math.floor(e.gen)} %`); else hud.feed('Le générateur vient d\'être saboté'); break;
    case 'revive': if (e.id === meId) { hud.toast(e.by === meId ? 'Tu te relèves' : 'On te relève', 2); } else if (e.by !== e.id) hud.feed(`${nameOf(e.by)} relève ${nameOf(e.id)}`); break;
    case 'purge': if (e.id === meId) hud.banner('Le site est scellé', 3, 'warn'); break;
    case 'over': sfx.play(e.win === 'm' ? 'over' : 'extract'); break;
  }
}

// ------------------------------------------------------------------ fin, menu
function showEnd(reason) {
  if (S.endShown) return;
  S.endShown = true;
  input.unlock();
  document.body.classList.remove('cctv-on');
  const v = S.view, w = v && v.w;
  let ranking = [];
  if (S.sim) ranking = S.sim.ranking();
  else if (v) ranking = v.players.filter((p) => !p.spectator).map((p) => { const won = p.role === w.win, score = p.role === 'm' ? (p.kills || 0) * 100 + (won ? 200 : 0) : (p.escaped ? 150 : 0) + (p.score || 0) * 50; return { id: p.id, name: p.name, color: p.color, bot: p.bot, role: p.role, won, score, kills: p.kills || 0, proofs: p.score || 0, st: p.st }; }).sort((a, b) => (b.won - a.won) || b.score - a.score);
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = endHtml({ win: w?.win, purge: w?.end === 'purge', ranking, myId: S.myId, canReplay: S.role !== 'guest' && reason !== 'host', embedded: H.embedded, reason });
  hud.show(false);
  const again = $('#btnAgain'); if (again) { again.onclick = () => startRun(); again.focus({ preventScroll: true }); }
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
}
function toggleMenu() {
  if (S.lobby || S.endShown) return;
  S.menu = !S.menu;
  if (!S.menu) { hideScreen(); return; }
  input.unlock();
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
// appuis qui ne regardent que ce joueur : ouvrir les écrans, changer de vue
function localPress(raw, v) {
  const fc = raw.fc !== S.prevFc, uc = raw.uc !== S.prevUc;
  S.prevFc = raw.fc; S.prevUc = raw.uc;
  if (!v) return;
  if (!v.mine && fc) { S.specI++; return; }
  if (S.cctv >= 0) { if (uc) closeCctv(); else if (fc) switchCam(1); return; }
  if (uc && v.target && v.target.kind === 'monitor') { openCctv(); return; }
  const r = v.real;
  if (fc && r && r.st === 'ok' && r.role === 's' && r.hide < 0 && r.inv[r.sel]?.k === 'cams' && r.inv[r.sel].n <= 0) openCctv();
}
function step(dt) {
  const blocked = S.lobby || S.endShown || (S.menu && S.role === 'solo');
  const raw = input.sample(dt);
  const quiet = blocked || S.menu || S.cctv >= 0 || S.mapOpen && false;
  S.inp = quiet ? { ...raw, mx: 0, my: 0, run: false, use: false, fire: false } : raw;
  localPress(raw, S.view);

  let view = null;
  if (S.role !== 'guest' && S.sim) view = hostFrame(dt);
  else if (S.role === 'guest') {
    S.hiT -= dt;
    if (!S.gotHost && S.hiT <= 0) { S.hiT = 1.5; send('host', { t: 'hi' }); }
    if (S.w && !S.lobby) {
      S.sendT += dt;
      if (S.sendT >= 1 / 30) { S.sendT = 0; S.seq++; send('host', { t: 'i', ...S.inp, q: S.seq }, { volatile: true }); }
      const silent = (performance.now() - S.snapAt) / 1000;
      if (S.w.ph !== 'over' && silent > HOST_SILENCE && !S.endShown) { if (!S.warned) { S.warned = true; hud.toast('Liaison avec l\'hôte interrompue…', 4); } if (silent > HOST_GIVEUP) showEnd('host'); }
      else S.warned = false;
    }
    view = guestFrame(dt);
  }
  if (!view) { idleFrame(dt); return; }
  S.view = view;
  const real = view.real;
  if (real && !S.roleShown && !real.spectator) { S.roleShown = true; hud.roleCard(real.role); hud.banner(real.role === 'm' ? 'Tu es le monstre' : 'Tu es enquêteur', 3, real.role === 'm' ? 'warn' : ''); input.yaw = real.role === 'm' ? Math.PI / 2 : 0; input.pitch = 0; }
  if (view.w.ph === 'over' && !S.endShown) { S.overT += dt; if (S.overT >= 2.4) showEnd(); }
  if (scene) scene.frame(view, dt);
  // sons continus
  const hear = view.camMode === 'cctv' ? view.real : view.me;
  if (hear) sfx.listener(hear.x, hear.y + 1.5, hear.z, hear.yaw);
  footsteps(view, dt);
  const monster = view.players.find((p) => p.role === 'm');
  let fear = 0;
  if (monster && real && real.role === 's' && !monster.wake && (real.st === 'ok' || real.st === 'down') && Math.abs(monster.y - real.y) < 3.5) { const d = Math.hypot(monster.x - real.x, monster.z - real.z); fear = clamp(1 - d / 18, 0, 1); }
  S.genWork = Math.max(0, S.genWork - dt);
  if (view.players.some((p) => p.work && p.role === 's' && Math.hypot(p.x - M.generator.x, p.z - M.generator.z) < 4) || view.w.gen !== S.lastGen) S.genWork = 0.6;
  S.lastGen = view.w.gen;
  const listener = hear || real, awake = monster && !monster.wake;
  // à vue, la musique de chasse monte ; et la première fois qu'on l'aperçoit, un coup de cordes
  let chaseWant = 0;
  if (real && real.role === 's' && monster && awake && (real.st === 'ok' || real.st === 'down') && Math.abs(monster.y - real.y) < 3.5) {
    const d = Math.hypot(monster.x - real.x, monster.z - real.z), los = d < 30 && hasLOS(M, view.w.doors, real.x, real.z, monster.x, monster.z);
    chaseWant = los && d < 16 ? 1 : d < 8 ? 0.6 : 0;
    S.sightCd = Math.max(0, S.sightCd - dt);
    if (los && d < 17 && S.sightCd <= 0 && view.camMode === 'fps') {
      const a = Math.atan2(-(monster.x - real.x), -(monster.z - real.z)), da = Math.abs(Math.atan2(Math.sin(a - real.yaw), Math.cos(a - real.yaw)));
      if (da < 0.65) { S.sightCd = 30; sfx.play('sting'); if (scene) { scene.fx.dread(0.8); scene.fx.shake(0.35); } }
    }
  } else if (real && real.role === 'm') {
    for (const p of view.players) if (p.role === 's' && p.st === 'ok' && p.hide < 0 && Math.abs(p.y - real.y) < 3.5 && Math.hypot(p.x - real.x, p.z - real.z) < 12 && hasLOS(M, view.w.doors, real.x, real.z, p.x, p.z)) { chaseWant = 0.8; break; }
  }
  S.chase += (chaseWant - S.chase) * Math.min(1, dt * (chaseWant > S.chase ? 1.4 : 0.35));
  const zone = listener ? zoneAt(M, listener.x, listener.z) : Z.A;
  sfx.update(dt, {
    drone: view.w.ph === 'over' ? 0.2 : 0.8, fear, emf: view.emfLevel, chase: S.chase,
    place: zone === Z.OUTPOST || zone === Z.PAD ? 'dehors' : zone === Z.SOUS || zone === Z.CABINE ? 'soussol' : 'batiment',
    pant: real && real.role === 's' && real.st === 'ok' ? clamp(1 - real.stam / 38, 0, 1) : 0,
    hum: nearLamp(view, listener),
    monster: monster && (real?.role === 'm' || awake) ? { x: monster.x, y: monster.y, z: monster.z, self: real?.role === 'm' } : null,
    gen: { x: M.generator.x, y: DEEP, z: M.generator.z, on: view.w.genOn, work: S.genWork > 0, k: view.w.gen / 100 },
  });
  const who = real && !real.spectator ? real : view.me, goal = goalOf(M, view.w, who, teamProofs(view), view.players);
  hud.update(view, dt, { goal, guide: who && who.st === 'ok' ? guideTo(view, who, goal, dt) : null, input, real: real && !real.spectator ? real : null, cctv: view.cctv, mapOpen: S.mapOpen, M });
}
// la lampe de secours la plus proche grésille
function nearLamp(v, L) {
  if (!L) return null;
  let best = null, bd = 7;
  for (const l of M.lights) { if (l.kind === 'projecteur' || (v.w.dark && v.w.dark[l.zone] > 0) || Math.abs(l.y - L.y) > 4) continue; const d = Math.hypot(l.x - L.x, l.z - L.z); if (d < bd) { bd = d; best = l; } }
  return best && { x: best.x, y: best.y, z: best.z, k: 1 + (best.flick || 0) * 2 };
}
// La flèche suit les couloirs : on cherche le chemin à pied jusqu'à l'objectif, et on vise le point le plus lointain de ce chemin qu'on peut voir.
const nav = new Nav(M);
function guideTo(v, me, goal, dt) {
  if (!goal.at) { S.guideWp = null; return null; }
  S.guideT -= dt;
  if (S.guideT <= 0 || !S.guideWp) {
    S.guideT = 0.35;
    const w = v.w, goalCell = Math.floor(goal.at.z) * W + Math.floor(goal.at.x);
    const pass = (i) => { if (i === goalCell) return true; if (M.t[i] !== T.FLOOR) return false; const d = M.doorAt[i]; return d < 0 || !M.doors[d].key || w.doors[d].unlocked; };
    const path = nav.find(me.x, me.z, goal.at.x, goal.at.z, pass);
    if (path) {
      let wp = path[path.length - 1];
      for (let k = Math.min(path.length - 1, 14); k >= 0; k--) { const x = path[k] % W + 0.5, z = Math.floor(path[k] / W) + 0.5; if (k === 0 || hasLOS(M, w.doors, me.x, me.z, x, z)) { wp = path[k]; break; } }
      S.guideWp = { x: wp % W + 0.5, z: Math.floor(wp / W) + 0.5 }; S.guideDist = path.length;
    } else { S.guideWp = { x: goal.at.x, z: goal.at.z }; S.guideDist = Math.hypot(goal.at.x - me.x, goal.at.z - me.z); }
  }
  return { ang: Math.atan2(S.guideWp.x - me.x, -(S.guideWp.z - me.z)) + me.yaw, dist: S.guideDist };
}
const teamProofs = (v) => v.w.banked + v.players.reduce((a, p) => a + (p.role === 's' && !p.spectator && p.st !== 'dead' && p.st !== 'out' ? p.proofs || 0 : 0), 0) + v.w.items.reduce((a, it) => a + (it.k === 'preuve' ? it.n : 0), 0);
function footsteps(v, dt) {
  for (const p of v.players) {
    if (p.spectator || p.st !== 'ok' || p.hide >= 0) continue;
    let s = S.steps.get(p.id);
    if (!s) S.steps.set(p.id, s = { x: p.x, z: p.z, a: 0 });
    s.a += Math.hypot(p.x - s.x, p.z - s.z); s.x = p.x; s.z = p.z;
    const stride = p.role === 'm' ? 2 : p.run ? 2.1 : 1.6;
    if (s.a >= stride) {
      s.a = 0;
      const self = v.real && p.id === v.real.id, y = self ? undefined : p.y;
      if (p.role === 'm') sfx.play('mstep', { x: p.x, y, z: p.z, range: self ? 8 : 26, vol: self ? 0.4 : 1 });
      else if (!p.crouch || self) sfx.play('step', { x: p.x, y, z: p.z, range: p.run ? 22 : 15, vol: self ? 0.7 : p.run ? 1 : 0.8, surf: surfaceAt(p), run: p.run, crouch: p.crouch });
    }
  }
}
// la matière sous les pieds
function surfaceAt(p) {
  if (M.ramps.some((r) => p.x >= r.x0 && p.x < r.x1 && p.z >= r.z0 && p.z < r.z1)) return 'escalier';
  const z = zoneAt(M, p.x, p.z);
  return z === Z.OUTPOST || z === Z.PAD ? 'gravier' : z === Z.A ? 'sourd' : z === Z.SOUS || z === Z.CABINE ? 'metal' : 'beton';
}
// avant le lancement : un plan fixe sur la grille, le temps que l'hôte décide
const LOBBY_V = () => ({ w: lobbyWorld, players: [], me: { id: -1, x: 26, y: 0, z: 58, yaw: 0, pitch: -0.02, role: 's', st: 'ok', hide: -1, crouch: false, moving: false, torch: false }, real: null, mine: false, vision: 's', camMode: 'fps', cctv: null });
const lobbyWorld = (() => { const s = new Sim({ seed: 1, map: M }); s.w.items = []; s.w.traces = []; return s.w; })();
function idleFrame(dt) {
  if (scene) scene.frame(LOBBY_V(), dt);
  sfx.listener(26, 1.5, 58, 0);
  sfx.update(dt, { drone: S.lobby ? 0.45 : 0, fear: 0, emf: 0, place: 'dehors' });
}
