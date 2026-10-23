// Outbreak : démarrage, rôle (solo, hôte, invité), boucle de jeu, réseau via le Hub.
// L'hôte fait tourner la simulation et diffuse l'état 20 fois par seconde ; les invités envoient leurs commandes,
// prédisent leur propre déplacement et interpolent le reste.
import { Sim, DT, lvl } from './engine/sim.js';
import { botThink } from './engine/bots.js';
import { generateRoom } from './engine/level.js';
import { WEAPONS, WEAPON_IDS, ZOMBIE_IDS, ZOMBIES, BOT_NAMES, PLAYER_COLORS, DIFFICULTY, CAMPAIGN_ROOMS, CLASSES, CLASS_IDS } from './engine/data.js';
import { pushOutRect, clamp, angDiff } from './engine/geom.js';
import { Audio } from './audio.js';
import { FX } from './render/fx.js';
import { Renderer } from './render/renderer.js';
import { Input } from './input.js';
import { HUD, briefingHtml, menuHtml, endHtml } from './ui/hud.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const canvas = $('#game'), screenEl = $('#screen');
const INTERP = 0.11; // retard d'affichage des invités (s)

const audio = new Audio();
const fx = new FX(audio);
const renderer = new Renderer(canvas, fx);
const hud = new HUD({ onPick: (i) => input.pickPerk(i) });
const input = new Input(canvas, { menu: () => toggleMenu(), mute: () => toggleMute(), unlock: () => audio.unlock() });
addEventListener('keydown', () => audio.unlock(), { once: true });
addEventListener('pointerdown', () => audio.unlock());

const S = {
  role: 'solo', myId: 0, cfg: null, sim: null, runId: 0, lobby: true, menu: false,
  lvKey: '', lv: null, snaps: [], evq: [], last: null, off: null, endShown: false, reported: false,
  netEv: [], tick: 0, acc: 0, inp: null, sentSeq: 0, hist: [], shots: [], pred: null, gcd: 0, spin: 0, gotHost: false, hiT: 0,
  classes: {}, myClass: 'soldier', abReady: true,
};
try { const c = localStorage.getItem('outbreak_class'); if (CLASSES[c]) S.myClass = c; } catch (e) {}

// ------------------------------------------------------------------ réglages et identité
function readCfg(settings = {}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('outbreak_cfg') || '{}'); } catch (e) {}
  const src = H.embedded ? settings : { ...saved, ...Object.fromEntries(QS) };
  return {
    mode: src.mode === 'survival' ? 'survival' : 'campaign',
    difficulty: DIFFICULTY[src.difficulty] ? src.difficulty : 'normal',
    startWeapon: ['pistol', 'shotgun', 'smg'].includes(src.startWeapon) ? src.startWeapon : 'pistol',
    bots: clamp(Number(src.bots ?? (H.embedded ? 0 : 2)) | 0, 0, 3),
  };
}
function localProfile() {
  const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  return { name: String(g('dd_name', '') || 'Survivant').slice(0, 12) || 'Survivant', color: g('dd_color', '#2b8cff') };
}
function humanPlayers() {
  if (!H.embedded) { const p = localProfile(); return [{ id: 0, name: p.name, color: p.color }]; }
  return H.players.map((p, i) => ({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PLAYER_COLORS[i % PLAYER_COLORS.length] }));
}
const isReady = (id) => id === S.myId || !H.embedded || H.readyMap[id] === 'outbreak';

// ------------------------------------------------------------------ démarrage
function boot(info) {
  S.role = H.embedded ? info.role : 'solo';
  S.myId = H.embedded ? info.myId : 0;
  S.cfg = readCfg(info.settings || {});
  S.classes[S.myId] = S.myClass;
  H.on('msg', onMsg);
  H.on('roster', onRoster);
  if (H.embedded) H.signalReady();
  showBriefing();
  if (S.role === 'guest') H.send('host', { t: 'hi', c: S.myClass });
  requestAnimationFrame(loop);
  if (QS.has('debug')) window.__outbreak = { S, fx, renderer, input };
  if (QS.has('autostart') && S.role !== 'guest') setTimeout(startRun, 300);
}
if (H.embedded) H.on('init', boot); else boot({});

function squad() {
  const hs = humanPlayers().map((p) => ({ ...p, me: p.id === S.myId, ready: isReady(p.id), cls: p.id === S.myId ? S.myClass : CLASSES[S.classes[p.id]] ? S.classes[p.id] : 'soldier' }));
  const nb = Math.min(S.cfg.bots, Math.max(0, 5 - hs.length));
  // les équipiers IA prennent les classes encore libres (soigneur et colosse d'abord)
  const order = ['medic', 'tank', 'engineer', 'scout', 'soldier'];
  const free = order.filter((c) => !hs.some((h) => h.cls === c)).concat(order);
  const bots = BOT_NAMES.slice(0, nb).map(([name, color], i) => ({ name, color, bot: true, cls: free[i] }));
  return hs.concat(bots);
}

function chooseClass(c) {
  if (!CLASSES[c]) return;
  S.myClass = c; S.classes[S.myId] = c;
  try { localStorage.setItem('outbreak_class', c); } catch (e) {}
  if (S.role === 'guest') H.send('host', { t: 'cls', c });
  else broadcastLobby();
  audio.unlock(); audio.play('click');
  showBriefing();
}

function showBriefing() {
  if (!S.lobby) return;
  const canStart = S.role !== 'guest';
  screenEl.className = 'screen'; screenEl.hidden = false;
  screenEl.innerHTML = briefingHtml({ role: S.role, squad: squad(), cfg: S.cfg, embedded: H.embedded, canStart, myClass: S.myClass });
  for (const b of screenEl.querySelectorAll('.cls')) b.onclick = () => chooseClass(b.dataset.c);
  hud.show(false);
  const go = $('#btnGo'); if (go) go.onclick = () => { audio.unlock(); startRun(); };
  const ex = $('#btnExit'); if (ex) ex.onclick = () => H.exit();
  for (const b of screenEl.querySelectorAll('.seg button')) b.onclick = () => {
    const v = isNaN(Number(b.dataset.v)) ? b.dataset.v : Number(b.dataset.v);
    S.cfg[b.dataset.k] = v;
    try { localStorage.setItem('outbreak_cfg', JSON.stringify(S.cfg)); } catch (e) {}
    audio.unlock(); audio.play('click');
    showBriefing();
  };
}

// ------------------------------------------------------------------ hôte
function startRun() {
  if (S.role === 'guest') return;
  const seed = (Math.random() * 2 ** 31) | 0;
  const sim = new Sim({ mode: S.cfg.mode, difficulty: S.cfg.difficulty, startWeapon: S.cfg.startWeapon, seed });
  const sq = squad();
  for (const p of sq) if (!p.bot && isReady(p.id)) sim.addPlayer({ id: p.id, name: p.name, color: p.color, cls: p.cls });
  sq.filter((p) => p.bot).forEach((b, i) => sim.addPlayer({ id: -1 - i, name: b.name, color: b.color, bot: true, cls: b.cls }));
  sim.startRoom(sim.room.type, sim.room.index); // replace tout le monde à l'entrée
  S.sim = sim; S.runId = Date.now(); S.lobby = false; S.endShown = false; S.reported = false; S.netEv = []; S.acc = 0;
  hideScreen();
  if (H.embedded) H.send('all', { t: 'go', run: S.runId });
}

function hostFrame(dt) {
  const sim = S.sim;
  S.acc += Math.min(0.1, dt);
  const frameEv = [];
  while (S.acc >= DT) {
    S.acc -= DT;
    const me = sim.players.get(S.myId);
    if (me && S.inp) sim.setInput(S.myId, S.inp);
    if (!(S.menu && S.role === 'solo')) {
      for (const p of sim.players.values()) if (p.bot) botThink(sim, p, DT);
      sim.step(DT);
    }
    const ev = sim.drainEvents();
    for (const e of ev) frameEv.push(e);
    if (H.embedded && H.players.length > 1) S.netEv.push(...ev);
    S.tick++;
  }
  const snap = sim.snapshot(); snap.run = S.runId;
  if (H.embedded && H.players.length > 1 && S.tick - (S.lastSend || 0) >= 3) {
    S.lastSend = S.tick;
    H.send('all', { t: 's', s: snap, e: S.netEv }); S.netEv = [];
  }
  S.last = snap;
  const view = buildView(snap, snap, 0, dt);
  for (const e of frameEv) fx.handle(e, view, S.myId);
  if (sim.phase !== 'play' && sim.endT > 2.4) { report(snap); showEnd(snap); }
  return view;
}

function onRoster() {
  if (S.role === 'guest' && H.info.role === 'host') becomeHost();
  if (S.role !== 'host') { if (S.lobby) showBriefing(); return; }
  if (S.lobby) { showBriefing(); broadcastLobby(); return; }
  const sim = S.sim; if (!sim) return;
  const ids = new Set(H.players.map((p) => p.id));
  for (const p of [...sim.players.values()]) if (!p.bot && !ids.has(p.id)) sim.removePlayer(p.id);
  for (const p of squad()) if (!p.bot && isReady(p.id) && !sim.players.has(p.id)) sim.addPlayer({ id: p.id, name: p.name, color: p.color, cls: p.cls });
}

function broadcastLobby() { if (H.embedded && S.role === 'host') H.send('all', { t: 'lobby', cfg: S.cfg, classes: S.classes }); }

// Le Hub a désigné ce joueur comme nouvel hôte : la partie reprend depuis le dernier état reçu
function becomeHost() {
  S.role = 'host';
  const snap = S.last;
  if (snap && snap.ph === 'play' && !S.lobby) {
    try {
      const sim = Sim.restore(snap);
      const ids = new Set(H.players.map((p) => p.id));
      for (const p of [...sim.players.values()]) if (!p.bot && !ids.has(p.id)) sim.removePlayer(p.id);
      S.sim = sim; S.runId = snap.run || Date.now(); S.acc = 0;
      S.sim.setToast("Nouvel hôte : la salle reprend", 2.5);
      return;
    } catch (e) { console.error(e); }
  }
  S.sim = null; S.lobby = true; showBriefing(); broadcastLobby();
}

function report(snap) {
  if (S.reported || !H.embedded || S.role === 'guest') return;
  S.reported = true;
  const ranked = snap.P.slice().sort((a, b) => b.st[1] - a.st[1]);
  const camp = snap.rm.mode !== 'survival';
  const mode = camp ? (snap.ph === 'won' ? 'Campagne · victoire' : `Campagne · salle ${snap.rm.i}`) : `Survie · vague ${snap.wv.n}`;
  H.report({
    id: `outbreak-${S.runId}-${ranked.map((p) => p.i).join('.')}`, mode,
    players: ranked.map((p, k) => ({ id: p.b ? null : p.i, name: p.n, color: p.c, bot: !!p.b, rank: k + 1, score: p.st[1] })),
  });
}

// ------------------------------------------------------------------ messages
function onMsg(from, m) {
  if (!m || typeof m !== 'object') return;
  if (S.role === 'host' || S.role === 'solo') {
    if (m.t === 'hi' || m.t === 'cls') {
      if (CLASSES[m.c]) S.classes[from] = m.c;
      if (S.lobby) { showBriefing(); if (m.t === 'cls') broadcastLobby(); else H.send(from, { t: 'lobby', cfg: S.cfg, classes: S.classes }); }
    }
    else if (m.t === 'i' && S.sim) S.sim.setInput(from, cleanInput(m));
    return;
  }
  // invité : seul l'hôte fait foi
  if (from !== H.info.hostId) return;
  S.gotHost = true;
  if (m.t === 'lobby') {
    if (m.cfg) S.cfg = { ...S.cfg, ...m.cfg };
    if (m.classes && typeof m.classes === 'object') { S.classes = { ...m.classes }; S.classes[S.myId] = S.myClass; }
    if (S.lobby) showBriefing();
  }
  else if (m.t === 'go') { S.lobby = false; S.endShown = false; hideScreen(); }
  else if (m.t === 's' && m.s) receiveSnap(m.s, m.e || []);
}

function cleanInput(m) {
  const n = (v, a, b, d = 0) => (Number.isFinite(+v) ? clamp(+v, a, b) : d);
  return {
    mx: n(m.mx, -1, 1), my: n(m.my, -1, 1), a: n(m.a, -10, 10), fire: !!m.fire, use: !!m.use, td: n(m.td, 0, 2000, 300),
    ab: m.ab | 0, dash: m.dash | 0, reload: m.reload | 0, sw: m.sw | 0, sl: n(m.sl, -2, 2) | 0, nade: m.nade | 0, pk: m.pk | 0, pi: n(m.pi, -1, 2, -1) | 0, q: m.q | 0,
  };
}

// ------------------------------------------------------------------ invité
function receiveSnap(s, events) {
  const now = performance.now() / 1000;
  if (S.lobby || (S.last && s.run !== S.last.run)) { S.lobby = false; S.endShown = false; S.snaps = []; S.evq = []; S.off = null; S.pred = null; hideScreen(); }
  const o = now - s.t;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snaps.push(s); if (S.snaps.length > 12) S.snaps.shift();
  for (const e of events) S.evq.push({ t: s.t, e });
  S.last = s;
  reconcile(s);
}

function guestFrame(dt) {
  if (!S.snaps.length) return null;
  const now = performance.now() / 1000;
  const rt = now - S.off - INTERP;
  let a = S.snaps[0], b = S.snaps[S.snaps.length - 1];
  for (let i = 0; i < S.snaps.length - 1; i++) if (S.snaps[i].t <= rt && S.snaps[i + 1].t >= rt) { a = S.snaps[i]; b = S.snaps[i + 1]; break; }
  if (rt >= b.t) a = b;
  const f = a === b ? 0 : clamp((rt - a.t) / (b.t - a.t), 0, 1);
  predictLocal(dt);
  const view = buildView(a, b, f, dt);
  // événements à l'heure de l'image affichée
  const due = []; S.evq = S.evq.filter((x) => (x.t <= rt + 0.001 ? (due.push(x.e), false) : true));
  for (const e of due) fx.handle(e, view, S.myId);
  const last = S.last;
  if (last.ph !== 'play' && !S.endShown) { S.endT = (S.endT || 0) + dt; if (S.endT > 2.4) showEnd(last); } else if (last.ph === 'play') S.endT = 0;
  // demander l'état tant que l'hôte n'a rien envoyé
  return view;
}

// Prédiction du déplacement local (rejoue les commandes que l'hôte n'a pas encore appliquées)
function solidsFor(snap) {
  const lv = S.lv; if (!lv) return [];
  const dead = new Set(snap.D || []);
  return lv.solids.concat(
    lv.doors.filter((d) => !(d.kind === 'exit' && snap.op)).map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h })),
    lv.crates.filter((c) => !dead.has(c.id)),
  );
}

function stepBody(P, h, dt, me, snap, solids) {
  let sp = 232 * (1 + 0.1 * (me.pk?.speed || 0));
  if (me.pk?.rage && me.h < me.H * 0.35) sp *= 1.4;
  const W = WEAPONS[WEAPON_IDS[(me.w[me.sl] || me.w[0])[0]]];
  if (W.slow && h.fire) sp *= W.slow;
  const cls = CLASS_IDS[me.cl];
  if (cls === 'tank') sp *= 0.92;
  if (cls === 'scout') sp *= me.ab && me.ab[1] > 0 ? 1.4 * 1.08 : 1.08;
  if (me.state === 1) sp = 52;
  if (me.state === 2 || me.pn) sp = 0;
  if (h.revive) sp = 0;
  if (h.dashDir != null) { P.dashT = 0.2; P.dashDir = h.dashDir; }
  if (P.dashT > 0) {
    P.dashT -= dt; P.vx = Math.cos(P.dashDir) * 680; P.vy = Math.sin(P.dashDir) * 680;
    if (P.dashT <= 0) { P.vx *= 0.35; P.vy *= 0.35; }
  } else {
    const k = Math.min(1, dt * 16);
    P.vx += (h.mx * sp - P.vx) * k; P.vy += (h.my * sp - P.vy) * k;
  }
  P.x += P.vx * dt; P.y += P.vy * dt;
  const lv = S.lv;
  for (let it = 0; it < 2; it++) for (const s of solids) { if (P.x + 17 < s.x || P.x - 17 > s.x + s.w || P.y + 17 < s.y || P.y - 17 > s.y + s.h) continue; pushOutRect(P, s); }
  const dead = new Set(snap.D || []);
  for (const b of lv.barrels) { if (dead.has(b.id)) continue; const dx = P.x - b.x, dy = P.y - b.y, d = Math.hypot(dx, dy), m = 17 + b.r; if (d < m && d > 0.01) { P.x = b.x + (dx / d) * m; P.y = b.y + (dy / d) * m; } }
  P.x = clamp(P.x, lv.inner.x0 + 17, lv.inner.x1 - 17);
  P.y = clamp(P.y, (snap.op ? 8 : lv.inner.y0) + 17, lv.inner.y1 - 17);
}

function meIn(s) { return s.P.find((p) => p.i === S.myId); }

function reconcile(s) {
  ensureLevel(s);
  const me = meIn(s); if (!me) return;
  const P = S.pred;
  const old = P ? { x: P.x + P.ox, y: P.y + P.oy } : null;
  const np = { x: me.x, y: me.y, vx: me.vx, vy: me.vy, r: 17, dashT: me.d ? 0.08 : 0, dashDir: Math.atan2(me.vy, me.vx), ox: 0, oy: 0, room: s.rm.i + s.rm.ty };
  S.hist = S.hist.filter((h) => h.q > me.q);
  const solids = solidsFor(s);
  for (const h of S.hist) stepBody(np, h, h.dt, me, s, solids);
  if (old && P.room === np.room) {
    const ox = old.x - np.x, oy = old.y - np.y;
    if (Math.hypot(ox, oy) < 160) { np.ox = ox; np.oy = oy; }
  }
  S.pred = np;
  S.shots = S.shots.filter((q) => q > me.q);
}

function predictLocal(dt) {
  const s = S.last; if (!s || !S.pred || !S.inp) return;
  const me = meIn(s); if (!me) return;
  const inp = S.inp;
  const h = { q: S.sentSeq + 1, mx: inp.mx, my: inp.my, dt, fire: inp.fire, revive: false, dashDir: null };
  // roulade locale immédiate
  if (S.lastDash == null) S.lastDash = inp.dash;
  if (inp.dash !== S.lastDash) {
    S.lastDash = inp.dash;
    if (me.state === 0 && !me.pn && me.dc > 0 && S.pred.dashT <= 0) h.dashDir = Math.hypot(inp.mx, inp.my) > 0.2 ? Math.atan2(inp.my, inp.mx) : inp.a;
  }
  // réanimation : le joueur s'arrête
  if (inp.use && me.state === 0) h.revive = s.P.some((o) => o.i !== me.i && o.s === 1 && Math.hypot(o.x - S.pred.x, o.y - S.pred.y) < 82);
  stepBody(S.pred, h, dt, me, s, solidsFor(s));
  S.hist.push(h); if (S.hist.length > 240) S.hist.shift();
  const k = Math.exp(-dt * 10); S.pred.ox *= k; S.pred.oy *= k;
  // tir prédit (traçantes et son immédiats ; l'hôte décide des dégâts)
  S.gcd -= dt;
  const slot = me.state === 1 ? 0 : me.sl;
  const w = me.w[slot] || me.w[0];
  const W = WEAPONS[WEAPON_IDS[w[0]]];
  S.spin = inp.fire ? S.spin + dt : 0;
  const barrage = CLASS_IDS[me.cl] === 'soldier' && me.ab && me.ab[1] > 0;
  const mag = barrage ? 99 : w[1] - S.shots.length;
  if (!W.melee && !W.tesla && inp.fire && me.state !== 2 && !me.pn && !h.revive && S.pred.dashT <= 0 && me.rl === 0 && S.gcd <= 0 && mag > 0 && (!W.spinUp || S.spin >= W.spinUp)) {
    S.gcd = 1 / (W.rate * (1 + 0.15 * (me.pk?.rate || 0)) * (barrage ? 1.5 : 1));
    const a = inp.a;
    const angs = [];
    for (let i = 0; i < W.pellets; i++) angs.push(a + (W.pellets > 1 ? ((i + Math.random()) / W.pellets * 2 - 1) : (Math.random() * 2 - 1)) * W.spread);
    const px = S.pred.x + S.pred.ox, py = S.pred.y + S.pred.oy;
    S.shots.push(S.sentSeq + 1);
    const view = S.view;
    if (view) fx.shot(S.myId, W, px + Math.cos(a) * 26, py + Math.sin(a) * 26, angs, { x: px, y: py, a }, view, true);
  }
}

// ------------------------------------------------------------------ vue commune (hôte et invités)
const anim = new Map();
function ensureLevel(s) {
  const key = `${s.run}:${s.rm.mode}:${s.rm.i}:${s.rm.ty}:${s.rm.sd}`;
  if (key === S.lvKey) return false;
  S.lvKey = key;
  S.lv = generateRoom({ mode: s.rm.mode, index: s.rm.i, type: s.rm.ty, seed: s.rm.sd, exits: s.rm.ex });
  renderer.setLevel(S.lv, key); renderer.camInit = false;
  return true;
}

function buildView(a, b, f, dt) {
  ensureLevel(b);
  const lerp = (x, y) => x + (y - x) * f;
  const lerpA = (x, y) => x + angDiff(x, y) * f;
  const t = performance.now() / 1000;
  const pa = new Map(a.P.map((p) => [p.i, p]));
  const players = b.P.map((q) => {
    const o = pa.get(q.i) || q;
    let x = lerp(o.x, q.x), y = lerp(o.y, q.y), ang = lerpA(o.a, q.a), vx = q.vx, vy = q.vy;
    if (q.i === S.myId && S.inp) {
      ang = q.s === 2 ? q.a : S.inp.a;
      if (S.role === 'guest' && S.pred) { x = S.pred.x + S.pred.ox; y = S.pred.y + S.pred.oy; vx = S.pred.vx; vy = S.pred.vy; }
    }
    const an = anim.get('p' + q.i) || { walk: 0, move: 0 };
    const sp = Math.hypot(vx, vy);
    an.walk += sp * dt / 9; if (sp > 20) an.move = Math.atan2(vy, vx);
    anim.set('p' + q.i, an);
    const wi = (q.s === 1 ? q.w[0] : q.w[q.sl] || q.w[0])[0];
    return {
      id: q.i, name: q.n, color: q.c, bot: !!q.b, x, y, a: ang, vx, vy, state: q.s, weapon: WEAPON_IDS[wi], h: q.h, H: q.H, r: q.r, R: q.R,
      bl: q.bl, rv: q.rv, dash: q.d, rl: q.rl, walk: an.walk, move: an.move, speed: Math.min(1, sp / 230),
      hurt: fx.pflash.has(q.i), recoil: (fx.recoil.get(q.i) || 0) * 7,
      cls: CLASS_IDS[q.cl], clsColor: CLASSES[CLASS_IDS[q.cl]]?.color, pinned: !!q.pn,
      shield: CLASS_IDS[q.cl] === 'tank' && q.ab && q.ab[1] > 0, barrage: CLASS_IDS[q.cl] === 'soldier' && q.ab && q.ab[1] > 0, shadow: CLASS_IDS[q.cl] === 'scout' && q.ab && q.ab[1] > 0,
    };
  });
  const za = new Map(a.Z.map((z) => [z[0], z]));
  const zombies = b.Z.map((z) => {
    const o = za.get(z[0]) || z;
    const ty = ZOMBIE_IDS[z[1]];
    const an = anim.get(z[0]) || { walk: Math.random() * 6 };
    const sp = Math.hypot(z[9], z[10]);
    an.walk += sp * dt / (ty === 'boss' ? 16 : 9); anim.set(z[0], an);
    let flags = z[6] & ~128; if (fx.zflash.has(z[0])) flags |= 128;
    return { id: z[0], ty, x: lerp(o[2], z[2]), y: lerp(o[3], z[3]), a: lerpA(o[4], z[4]), hp: z[5] / 1000, flags, lockA: z[7], phase: z[8], vx: z[9], vy: z[10], walk: an.walk, r: ZOMBIES[ty].r * (flags & 8 ? 1.18 : 1) };
  });
  if (anim.size > 600) { const live = new Set(b.Z.map((z) => z[0])); for (const k of anim.keys()) if (typeof k === 'number' && !live.has(k)) anim.delete(k); }
  const oa = new Map(a.O.map((o) => [o[0], o]));
  const eprojs = b.O.map((o) => { const p = oa.get(o[0]); return p ? [o[0], o[1], lerp(p[2], o[2]), lerp(p[3], o[3]), lerp(p[4], o[4]), o[5], o[6], o[7], o[8]] : o; });
  const dead = new Set(b.D || []);
  const lv = S.lv;
  const me = players.find((p) => p.id === S.myId) || null;
  const meSnap = b.P.find((p) => p.i === S.myId) || null;
  // K.O. : la caméra suit un allié encore debout
  const alive = players.find((p) => p.state === 0 && p.id !== S.myId);
  const focus = me && (me.state !== 2 || !alive) ? { x: me.x, y: me.y } : alive || players[0] || { x: lv.w / 2, y: lv.h / 2 };
  const view = {
    lv, t, players, zombies, eprojs, mode: b.rm.mode,
    pickups: b.K.map((k) => ({ id: k[0], k: k[1], x: k[2], y: k[3], w: k[4] })),
    hazards: b.A, turrets: b.T || [], barrels: lv.barrels.filter((x) => !dead.has(x.id)), crates: lv.crates.filter((x) => !dead.has(x.id)),
    doorsOpen: !!b.op, cleared: !!b.cl, rally: b.rl, meId: S.myId, me: meSnap ? { ...meSnap, state: meSnap.s } : null,
    snap: b, waveLeft: b.wv.left, focus, bleedMax: DIFFICULTY[b.cfg.d]?.bleed || 28, predictFire: S.role === 'guest',
    clock: b.t,
  };
  view.solids = lv.solids.filter((s) => !s.low).concat(
    lv.doors.filter((d) => !(d.kind === 'exit' && view.doorsOpen)).map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h })), view.crates);
  if (view.me) view.me.name = meSnap.n;
  return view;
}

function promptFor(view) {
  const me = view.players.find((p) => p.id === S.myId); const ms = view.me;
  if (!me || !ms || view.snap.ph !== 'play') return '';
  const camp = view.mode !== 'survival';
  if (me.state === 2) return camp ? '☠ K.O. — tu reviens à la prochaine salle' : '☠ K.O. — tu reviens à la fin de la vague';
  if (me.pinned) return '⚠ Plaqué au sol ! Tes alliés doivent tirer sur le traqueur';
  if (me.state === 1) return `✚ À terre ! Tu peux ramper et tirer au pistolet · ${Math.ceil(me.bl)} s`;
  const downed = view.players.find((o) => o.id !== me.id && o.state === 1 && Math.hypot(o.x - me.x, o.y - me.y) < 82);
  if (downed) return downed.rv > 0 ? `Réanimation de ${esc(downed.name)}… ${Math.round(downed.rv * 100)} %` : `Maintiens <kbd>E</kbd> pour relever ${esc(downed.name)}`;
  const wp = view.pickups.find((k) => k.k === 'weapon' && Math.hypot(k.x - me.x, k.y - me.y) < 60);
  if (wp) {
    const W = WEAPONS[wp.w];
    const own = ms.w.some((w) => WEAPON_IDS[w[0]] === wp.w);
    const repl = !own && ms.w.length >= 3 ? ` (remplace ${WEAPONS[WEAPON_IDS[ms.w[ms.sl === 0 ? 1 : ms.sl][0]]].short})` : '';
    return `<kbd>E</kbd> ${own ? 'Munitions pour' : 'Prendre'} ${esc(W.name)}${repl}`;
  }
  if (view.rally) { const d = view.lv.doors.find((x) => x.id === view.rally.d); return `Départ vers ${d ? esc(d.to === 'core' ? 'le Noyau' : ROOMS_FR[d.to]) : '…'} — rejoignez la porte`; }
  if (view.doorsOpen && !(ms.of)) return 'Rejoignez une porte pour continuer';
  const cur = ms.w[ms.sl];
  if (cur && cur[1] === 0 && cur[2] === 0 && ms.sl !== 0) return 'Plus de munitions — <kbd>1</kbd> pistolet';
  return '';
}
const ROOMS_FR = { armory: "l'Armurerie", medbay: "l'Infirmerie", lab: 'le Laboratoire', storage: "l'Entrepôt" };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// ------------------------------------------------------------------ écrans
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ''; S.menu = false; hud.show(true); }

function showEnd(snap) {
  if (S.endShown) return;
  S.endShown = true;
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = endHtml({ won: snap.ph === 'won', snap, clock: snap.t, canReplay: S.role !== 'guest', embedded: H.embedded });
  const again = $('#btnAgain'); if (again) again.onclick = () => startRun();
  const ex = $('#btnExit'); if (ex) ex.onclick = () => H.exit();
}

function toggleMenu() {
  if (S.lobby || S.endShown) return;
  S.menu = !S.menu;
  if (!S.menu) { hideScreen(); return; }
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = menuHtml({ muted: audio.muted, canQuit: true, solo: S.role === 'solo' });
  $('#btnResume').onclick = () => toggleMenu();
  $('#btnSound').onclick = () => { toggleMute(); toggleMenu(); toggleMenu(); };
  const q = $('#btnQuit'); if (q) q.onclick = () => { if (H.embedded) H.exit(); else location.reload(); };
}
function toggleMute() { audio.unlock(); const m = audio.toggleMute(); $('#btnMute').textContent = m ? '🔇' : '🔊'; }
$('#btnMute').onclick = () => toggleMute();
for (const b of document.querySelectorAll('#tbtns button')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault(); audio.unlock();
    const a = b.dataset.a;
    if (a === 'use') input.touchUse = true;
    else if (a === 'sw') { input.c.sw++; input.c.sl = -1; }
    else input.c[a]++;
  });
  const up = () => { if (b.dataset.a === 'use') input.touchUse = false; };
  b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
}
// en solo, la partie se met en pause quand l'onglet passe en arrière-plan
document.addEventListener('visibilitychange', () => { if (document.hidden && S.role === 'solo' && S.sim && !S.menu && !S.endShown && !S.lobby) toggleMenu(); });
$('#btnMenu').onclick = () => toggleMenu();
$('#btnMute').textContent = audio.muted ? '🔇' : '🔊';

// ------------------------------------------------------------------ boucle
let lastT = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const origin = S.view && S.view.me ? renderer.toScreen(S.view.players.find((p) => p.id === S.myId)?.x ?? 0, S.view.players.find((p) => p.id === S.myId)?.y ?? 0) : null;
  input.offerOpen = !!(S.view && S.view.me && S.view.me.of);
  const blocked = S.lobby || S.endShown || S.menu;
  const raw = input.sample(origin, renderer.cam.zoom);
  S.inp = blocked ? { ...raw, mx: 0, my: 0, fire: false, use: false } : raw;

  let view = null;
  if (S.role !== 'guest' && S.sim) view = hostFrame(dt);
  else if (S.role === 'guest') {
    S.hiT -= dt;
    if (!S.gotHost && S.hiT <= 0) { S.hiT = 1.5; H.send('host', { t: 'hi' }); }
    if (S.inp && S.last && !S.lobby) {
      S.sendT = (S.sendT || 0) + dt;
      if (S.sendT >= 1 / 30) { S.sendT = 0; S.sentSeq++; H.send('host', { t: 'i', ...S.inp, q: S.sentSeq }); }
    }
    view = guestFrame(dt);
  }
  if (!view) { drawIdle(dt); return; }
  S.view = view;
  view.cross = blocked ? null : input.crosshair(origin);
  view.touch = input.mode === 'touch' && !blocked ? input.touch : null;
  const meP = view.players.find((p) => p.id === S.myId);
  if (meP && input.mode === 'mouse' && !blocked) {
    const w = renderer.toWorld(input.mouse.x, input.mouse.y);
    view.look = { x: clamp((w.x - meP.x) * 0.22, -170, 170), y: clamp((w.y - meP.y) * 0.22, -120, 120) };
  } else if (meP) view.look = { x: Math.cos(meP.a) * 80, y: Math.sin(meP.a) * 60 };
  if (meP) {
    const W = WEAPONS[meP.weapon];
    view.spread = W ? W.spread * (renderer.cam.zoom || 1) * 1.4 : 0;
    audio.listener(meP.x, meP.y);
  }
  // intensité musicale : zombies proches
  const near = meP ? view.zombies.filter((z) => Math.hypot(z.x - meP.x, z.y - meP.y) < 700).length : 0;
  audio.intensity += ((view.snap.ph === 'play' && !view.cleared ? Math.min(1, near / 14 + (view.zombies.length ? 0.2 : 0)) : 0) - audio.intensity) * Math.min(1, dt * 1.5);
  if (Math.random() < dt * Math.min(3, view.zombies.length * 0.12)) { const z = view.zombies[(Math.random() * view.zombies.length) | 0]; if (z && z.ty !== 'boss') audio.play('groan', z.x, z.y, 0.6); }
  fx.update(dt, view);
  view.prompt = promptFor(view);
  if (view.me && view.me.ab) { const ready = view.me.ab[0] <= 0; if (ready && !S.abReady && view.snap.ph === 'play') audio.play('ready'); S.abReady = ready; }
  view.sfx = (n) => audio.play(n);
  renderer.frame(view, dt);
  if (!S.lobby) hud.update(view, now);
}

// écran d'attente : petit fond animé derrière le briefing
function drawIdle(dt) {
  const c = canvas.getContext('2d');
  renderer.resize();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = '#07080b'; c.fillRect(0, 0, canvas.width, canvas.height);
}
