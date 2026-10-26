// Convoy Storm : démarrage, rôle (solo, hôte, invité), boucle de jeu, réseau via le Hub.
// Même schéma qu'Outbreak : l'hôte fait tourner la simulation à 60 Hz et diffuse l'état 20 fois par seconde ;
// les invités envoient leurs commandes (30 Hz), prédisent leur propre déplacement et voient les autres ~110 ms
// en retard, interpolés entre deux états. Le jeu ne parle jamais au réseau directement : tout passe par HubBridge.
import { Sim, DT, stepPlayer, playerFromRow, Ruins, DIFFICULTY, MODES, CARDS, UPG_KEYS, personalScore, BOILER, stationDist, THROTTLE, LEVER, VALVE, FAULTS, HALF_W,
  ROLES, BIOMES, MOMENTS, CRATES, BRIDGE_LEN, REAR, moveCtx, lineColliders, momentOf, bioAt, snapUp, snapRoute, snapFork, warmR, flareR, dayInfo,
  TURRET, BENCH, CONTRACTS, ENCOUNTERS, forkOptions, HOSE_LEN } from './engine/sim.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';
import { HUD, briefingHtml, menuHtml, endHtml, fmt } from './view/hud.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const GOD = QS.has('debug') && QS.has('god');
const $ = (s) => document.querySelector(s);
const screenEl = $('#screen');
const INTERP = 0.11;             // retard d'affichage des autres joueurs chez les invités (s)
const HOST_SILENCE = 2.5;        // s sans nouvelles de l'hôte avant d'afficher l'alerte
const HOST_GIVEUP = 15;          // s avant d'abandonner la partie (la migration d'hôte a échoué)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const S = {
  role: 'solo', myId: 0, cfg: null, sim: null, runId: 0, lobby: true, menu: false, alive: true,
  snaps: [], evq: [], last: null, off: null, endShown: false, endAt: 0, reported: false, netEv: [], tick: 0, lastSend: 0,
  acc: 0, inp: null, sentSeq: 0, sendT: 0, hist: [], pred: null, gotHost: false, hiT: 0, snapAt: 0, ruins: null, ruinsKey: '', view: null,
  myRole: readRole(), roles: new Map(), // rôle choisi par chaque joueur (id → n°), connu de l'hôte et diffusé au salon
};
function readRole() { try { const v = localStorage.getItem('convoy_role'), r = v == null ? -1 : +v; return Number.isInteger(r) && r >= 0 && r < 4 ? r : -1; } catch (e) { return -1; } }

// ------------------------------------------------------------------ montage (une fois par page)
const hud = new HUD();
const sfx = new Sfx();
let scene = null;
try { scene = createScene($('#stage'), { onLost: () => { hud.toast('Affichage 3D interrompu : recharge la page', 6); } }); }
catch (e) { console.error(e); }
const input = new Input(document.body, { menu: () => toggleMenu(), mute: () => toggleMute(), unlock: () => sfx.unlock(), key: (k) => onKey(k) });
hud.onBuy = (k) => doBuy(k); hud.onVote = () => doVote(); hud.onChoose = (o) => doChoose(o);
input.bindTouchButtons($('#tbtns'));
input.listen($('#btnMute'), 'click', () => toggleMute());
input.listen($('#btnMap'), 'click', () => hud.toggleMap());
input.listen($('#btnMenu'), 'click', () => toggleMenu());
// en solo, la partie se met en pause quand l'onglet passe en arrière-plan
input.listen(document, 'visibilitychange', () => { if (document.hidden && S.role === 'solo' && S.sim && !S.menu && !S.endShown && !S.lobby) toggleMenu(); });
const muteIcon = () => { const i = $('#btnMute img'); if (i) i.src = `img/icons/${sfx.muted ? 'audioOff' : 'audioOn'}.png`; };
muteIcon();

// Démontage : boucle, écouteurs, WebGL, audio. Appelé avant de rendre la main au Hub et quand la page se ferme,
// pour que le contexte WebGL soit libéré tout de suite (les navigateurs en limitent le nombre).
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
function exitToLobby() {
  if (!H.embedded) { location.reload(); return; }
  teardown();
  H.exit();
}

// ------------------------------------------------------------------ réglages et identité
function readCfg(settings = {}) {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem('convoy_cfg') || '{}'); } catch (e) {}
  const src = H.embedded ? settings : { ...saved, ...Object.fromEntries(QS) };
  return { difficulty: DIFFICULTY[src.difficulty] ? src.difficulty : 'normal', mode: MODES[src.mode] ? src.mode : 'expedition' };
}
function localProfile() {
  const g = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  return { name: String(g('dd_name', '') || 'Chauffeur').slice(0, 12) || 'Chauffeur', color: g('dd_color', '#2b8cff') };
}
const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2'];
function humanPlayers() {
  if (!H.embedded) { const p = localProfile(); return [{ id: 0, name: p.name, color: p.color }]; }
  return H.players.map((p, i) => ({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[i % PALETTE.length] }));
}
const isReady = (id) => id === S.myId || !H.embedded || H.readyMap[id] === 'convoy';
const squad = () => humanPlayers().map((p) => ({ ...p, me: p.id === S.myId, ready: isReady(p.id), role: p.id === S.myId ? S.myRole : S.roles.get(p.id) ?? -1 }));

// ------------------------------------------------------------------ démarrage
function boot(info) {
  S.role = H.embedded ? info.role : 'solo';
  S.myId = H.embedded ? info.myId : 0;
  S.cfg = readCfg(info.settings || {});
  S.roles.set(S.myId, S.myRole);
  H.on('msg', onMsg);
  H.on('roster', onRoster);
  if (H.embedded) H.signalReady();       // après on('msg') : sinon les premiers messages de l'hôte se perdent
  if (!scene) { showNoGL(); return; }
  // décor d'attente derrière le briefing : le convoi à l'arrêt dans la tempête
  S.idleView = { seed: 20261023, diff: S.cfg.difficulty, dist: 0, speed: 0, thr: 1, fuel: 70, burn: 0, t: 0, fedTotal: 0, phase: 'play', players: [], crates: [], wolves: [], flares: [],
    looted: new Set(), me: null, focus: { x: 0, z: 2 }, ev: null, gust: 0, ns: 0, mode: 'endless', goal: 0, radar: false, legs: ['plaine'], up: {}, night: 0, hooks: [], boss: null, mm: null };
  showBriefing();
  if (S.role === 'guest') { H.send('host', { t: 'hi' }); H.send('host', { t: 'role', r: S.myRole }); }
  raf = requestAnimationFrame(loop);
  if (QS.has('debug')) window.__convoy = { S, scene, input, hud, sfx, teardown };
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
  screenEl.innerHTML = briefingHtml({ role: S.role, squad: squad(), cfg: S.cfg, embedded: H.embedded, myRole: S.myRole });
  hud.show(false);
  const go = $('#btnGo'); if (go) go.onclick = () => { sfx.unlock(); startRun(); };
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
  for (const b of screenEl.querySelectorAll('.seg button')) b.onclick = () => {
    if (b.dataset.k === 'role') { setMyRole(+b.dataset.v); return; }
    S.cfg[b.dataset.k] = b.dataset.v;
    try { localStorage.setItem('convoy_cfg', JSON.stringify(S.cfg)); } catch (e) {}
    sfx.unlock(); sfx.play('click'); showBriefing();
  };
}
// rôle choisi au briefing : gardé pour les prochaines parties, transmis à l'hôte
function setMyRole(r) {
  S.myRole = r; S.roles.set(S.myId, r);
  try { localStorage.setItem('convoy_role', String(r)); } catch (e) {}
  sfx.unlock(); sfx.play('click');
  if (S.role === 'guest') H.send('host', { t: 'role', r }); else broadcastLobby();
  showBriefing();
}
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ''; S.menu = false; hud.show(true); }

// ------------------------------------------------------------------ hôte
function startRun() {
  if (S.role === 'guest') return;
  const dbg = QS.has('debug'), seed = dbg && QS.get('seed') ? +QS.get('seed') : (Math.random() * 2 ** 31) | 0;
  const sim = new Sim({ seed, difficulty: S.cfg.difficulty, mode: S.cfg.mode });
  // outils de mise au point : ?debug&bio=foret pour partir dans un paysage, ?debug&god pour ne jamais tomber en panne
  if (dbg && BIOMES[QS.get('bio')]) { sim.legs[0] = QS.get('bio'); sim.ruins.setRoute(sim.legs, sim.mk); }
  for (const p of squad()) if (p.ready) sim.addPlayer({ id: p.id, name: p.name, color: p.color, role: p.role });
  S.sim = sim; S.runId = Date.now(); S.lobby = false; S.endShown = false; S.reported = false; S.netEv = []; S.acc = 0; S.tick = 0;
  hideScreen();
  startIntro();
  if (H.embedded) H.send('all', { t: 'go', run: S.runId });
}

function hostFrame(dt) {
  const sim = S.sim;
  const paused = (S.menu && S.role === 'solo') || !!S.intro; // pendant l'intro, le convoi attend
  if (!paused) S.acc += Math.min(0.1, dt);
  const frameEv = [];
  while (S.acc >= DT) {
    S.acc -= DT;
    if (S.inp) sim.setInput(S.myId, S.inp);
    sim.step(DT);
    if (GOD) { sim.fuel = Math.max(sim.fuel, 60); sim.hull = Math.max(sim.hull, 60); }
    const ev = sim.drainEvents();
    frameEv.push(...ev);
    if (H.embedded && H.players.length > 1) S.netEv.push(...ev);
    S.tick++;
  }
  if (S.intro) S.tick++; // l'intro fige le convoi, mais les invités reçoivent toujours l'état
  const snap = sim.snapshot(); snap.run = S.runId;
  // 20 Hz ; l'état final part tout de suite pour que tout le monde voie la fin en même temps
  if (H.embedded && H.players.length > 1 && (S.tick - S.lastSend >= 3 || (snap.ph !== 'play' && !S.sentOver))) {
    S.lastSend = S.tick; if (snap.ph !== 'play') S.sentOver = true;
    // volatil quand il ne transporte pas d'événements : sauté si la connexion sature, seul le plus récent est livré
    H.send('all', { t: 's', s: snap, e: S.netEv }, { volatile: !S.netEv.length }); S.netEv = [];
  }
  if (snap.ph === 'play') S.sentOver = false;
  S.last = snap;
  const view = buildView(snap, snap, 0, dt);
  for (const e of frameEv) fxEvent(e, view);
  if (snap.ph !== 'play') report(snap);
  return view;
}

function onRoster() {
  if (!S.alive) return;
  if (S.role === 'guest' && H.info.role === 'host') becomeHost();
  if (S.role !== 'host') { if (S.lobby) showBriefing(); return; }
  if (S.lobby) { showBriefing(); broadcastLobby(); return; }
  const sim = S.sim; if (!sim) return;
  // départ (onglet fermé, retour au salon) : le joueur quitte le convoi et lâche sa caisse
  const ids = new Set(H.players.map((p) => p.id));
  for (const p of [...sim.players.values()]) if (p.id !== S.myId && (!ids.has(p.id) || !isReady(p.id))) sim.removePlayer(p.id);
  // arrivée en cours de route (ou retour d'un joueur) : il monte à bord
  for (const p of squad()) if (p.ready && !sim.players.has(p.id)) { sim.addPlayer({ id: p.id, name: p.name, color: p.color, role: p.role }); H.send(p.id, { t: 'go', run: S.runId }); }
}
function broadcastLobby() { if (H.embedded && S.role === 'host') H.send('all', { t: 'lobby', cfg: S.cfg, roles: [...S.roles] }); }

// Le Hub a désigné ce joueur comme nouvel hôte : le convoi repart du dernier état reçu
function becomeHost() {
  S.role = 'host'; S.snaps = []; S.evq = []; S.pred = null; S.hist = [];
  const snap = S.last;
  if (snap && snap.ph === 'play' && !S.lobby) {
    try {
      const sim = Sim.restore(snap);
      const ids = new Set(H.players.map((p) => p.id));
      for (const p of [...sim.players.values()]) if (!ids.has(p.id)) sim.removePlayer(p.id);
      sim.drainEvents();
      S.sim = sim; S.runId = snap.run || Date.now(); S.acc = 0; S.tick = 0; S.lastSend = -99;
      hud.toast('Tu prends la tête du convoi', 3);
      return;
    } catch (e) { console.error(e); }
  }
  S.sim = null; S.lobby = true; S.endShown = false; showBriefing(); broadcastLobby();
}

function report(snap) {
  if (S.reported || !H.embedded || S.role === 'guest') return;
  S.reported = true;
  const names = new Map(snap.N.map(([id, n, c]) => [id, { n, c }]));
  const ranked = snap.P.map(playerFromRow).sort((a, b) => personalScore(b) - personalScore(a));
  H.report({
    id: `convoy-${S.runId}-${ranked.map((p) => p.id).join('.')}`,
    mode: `${MODES[snap.mo]?.label || 'Expédition'} · ${DIFFICULTY[snap.df].label} · ${snap.wn ? 'Arrivé' : fmt.fmtM(snap.d)}`,
    // coop : tout l'équipage partage la distance ; le classement suit le fioul apporté
    players: ranked.map((p, k) => ({ id: p.id, name: names.get(p.id)?.n || '?', color: names.get(p.id)?.c, bot: false, rank: k + 1, score: Math.round(snap.d) })),
  });
}

// ------------------------------------------------------------------ messages
function onMsg(from, m) {
  if (!S.alive || !m || typeof m !== 'object') return;
  if (S.role === 'host' || S.role === 'solo') {
    if (m.t === 'hi') { H.send(from, { t: 'lobby', cfg: S.cfg, roles: [...S.roles] }); if (!S.lobby && S.sim) H.send(from, { t: 'go', run: S.runId }); }
    else if (m.t === 'role' && Number.isInteger(m.r) && m.r >= -1 && m.r < ROLES.length) { S.roles.set(from, m.r); if (S.lobby) { showBriefing(); broadcastLobby(); } }
    else if (m.t === 'choose' && S.sim && (m.o === 0 || m.o === 1)) { const err = S.sim.choose(from, m.o); if (err) H.send(from, { t: 'err', m: err }); }
    else if (m.t === 'i' && S.sim) S.sim.setInput(from, cleanInput(m)); // `from` vient du Hub : seule identité fiable
    else if (m.t === 'buy' && S.sim && typeof m.k === 'string') { const err = S.sim.buy(from, m.k); if (err) H.send(from, { t: 'err', m: err }); }
    else if (m.t === 'vote' && S.sim) S.sim.vote(from);
    return;
  }
  if (from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  S.gotHost = true; S.snapAt = performance.now();
  if (m.t === 'lobby') {
    if (m.cfg) S.cfg = { ...S.cfg, ...m.cfg };
    if (Array.isArray(m.roles)) for (const [id, r] of m.roles) if (id !== S.myId && Number.isInteger(r)) S.roles.set(id, r);
    if (S.lobby) showBriefing();
  }
  else if (m.t === 'go') { const fresh = S.lobby || S.endShown; S.goRun = m.run; S.lobby = false; S.endShown = false; hideScreen(); if (fresh) startIntro(); }
  else if (m.t === 's' && m.s) receiveSnap(m.s, m.e || []);
  else if (m.t === 'err' && typeof m.m === 'string') { hud.toast(m.m.slice(0, 60), 2); sfx.play('nope'); }
}

function cleanInput(m) {
  const n = (v, a, b) => (Number.isFinite(+v) ? clamp(+v, a, b) : 0);
  return { mx: n(m.mx, -1, 1), mz: n(m.mz, -1, 1), use: !!m.use, jump: m.jump | 0, thr: m.thr | 0, fl: m.fl | 0, q: m.q | 0 };
}

// ------------------------------------------------------------------ invité
function receiveSnap(s, events) {
  const now = performance.now() / 1000;
  if (S.lobby || (S.last && s.run !== S.last.run)) {
    S.lobby = false; S.endShown = false; S.snaps = []; S.evq = []; S.off = null; S.pred = null; S.hist = []; hideScreen();
  }
  const o = now - s.t;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snaps.push(s); if (S.snaps.length > 12) S.snaps.shift();
  for (const e of events) S.evq.push({ t: s.t, e });
  S.last = s;
  reconcile(s);
}

function ruinsFor(s) {
  const key = s.sd + ':' + s.df + ':' + s.mo + ':' + s.gl;
  if (key !== S.ruinsKey) { S.ruinsKey = key; S.ruins = new Ruins(s.sd, DIFFICULTY[s.df].loot, s.mo || 'expedition', s.gl || 0); }
  S.ruins.setRoute(s.lg || ['plaine'], s.mk || []);
  if (s.CU && S.ruins.cutN !== s.CU.length) { S.ruins.cut = new Set(s.CU); S.ruins.cutN = s.CU.length; }
  return S.ruins;
}

// Prédiction locale : on repart de l'état de l'hôte et on rejoue les commandes qu'il n'a pas encore appliquées
function reconcile(s) {
  const row = s.P.find((a) => a[0] === S.myId); if (!row) { S.pred = null; return; }
  const P = S.pred;
  const old = P ? { x: P.x + P.ox, y: P.y, z: P.z + P.oz } : null;
  const np = { ...playerFromRow(row), ox: 0, oz: 0 };
  S.hist = S.hist.filter((h) => h.q > np.q);
  const ruins = ruinsFor(s);
  let d = s.d;
  for (const h of S.hist) { stepPlayer(np, h, h.dt, ctxFor(s, ruins, d)); d += s.sp * h.dt; }
  // petit écart : on le résorbe en douceur au lieu de téléporter
  if (old && np.st < 2 && Math.hypot(old.x - np.x, old.z - np.z) < 3) { np.ox = old.x - np.x; np.oz = old.z - np.z; }
  S.pred = np;
}

const ctxFor = (s, ruins, d) => moveCtx({ v: s.sp, gust: s.gu, ev: s.ev, up: snapUp(s), ice: BIOMES[bioAt(s.mo, s.gl, s.lg || ['plaine'], d)]?.ice },
  ruins.colliders(d).concat(lineColliders(s.sd, s.mo, s.gl, snapRoute(s), s.ev, s.mm, d)));

function predictLocal(dt) {
  const s = S.last; if (!s || !S.pred || !S.inp || s.ph !== 'play') return;
  const h = { ...S.inp, q: S.sentSeq + 1, dt };
  const ruins = ruinsFor(s);
  const d = s.d + s.sp * Math.max(0, performance.now() / 1000 - S.off - s.t);
  stepPlayer(S.pred, h, dt, ctxFor(s, ruins, d));
  S.hist.push(h); if (S.hist.length > 240) S.hist.shift();
  const k = Math.exp(-dt * 10); S.pred.ox *= k; S.pred.oz *= k;
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
  const due = []; S.evq = S.evq.filter((x) => (x.t <= rt + 0.001 ? (due.push(x.e), false) : true));
  for (const e of due) fxEvent(e, view);
  return view;
}

// ------------------------------------------------------------------ vue commune (hôte et invités)
function buildView(a, b, f, dt) {
  const lerp = (x, y) => x + (y - x) * f;
  const lerpA = (x, y) => { let d = y - x; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return x + d * f; };
  const names = new Map(b.N.map(([id, n, c]) => [id, [n, c]]));
  const pa = new Map(a.P.map((r) => [r[0], r]));
  const players = b.P.map((rb) => {
    const ra = pa.get(rb[0]) || rb;
    const q = playerFromRow(rb);
    const [name, color] = names.get(q.id) || ['?', '#888888'];
    let x = lerp(ra[1], rb[1]), y = lerp(ra[2], rb[2]), z = lerp(ra[3], rb[3]), yaw = lerpA(ra[7], rb[7]), vx = q.vx, vz = q.vz;
    let st = q.st, on = q.on, air = q.air;
    const me = q.id === S.myId;
    if (me && S.role === 'guest' && S.pred) { const P = S.pred; x = P.x + P.ox; y = P.y; z = P.z + P.oz; yaw = P.yaw; vx = P.vx; vz = P.vz; st = P.st; on = P.on; air = P.air; }
    return { id: q.id, name, color, x, y, z, yaw, vx, vz, st, on, air, ref: q.ref, carry: q.carry, sp: q.sp, me, fed: q.fed, heat: q.heat, frz: q.frz, flares: q.flares, dig: q.dig, tm: q.tm,
      role: q.role, ic: q.ic, cth: q.cth, tu: q.tu, hose: q.hose, act: q.act, cr: q.cr };
  });
  const ca = new Map(a.C.map((c) => [c[0], c]));
  const crates = b.C.map((c) => {
    const o = ca.get(c[0]);
    const same = o && o[1] === c[1];
    return { id: c[0], m: c[1], x: same ? lerp(o[2], c[2]) : c[2], y: same ? lerp(o[3], c[3]) : c[3], z: same ? lerp(o[4], c[4]) : c[4], t: c[9] || 1, th: c[10] || 0 };
  });
  const wa = new Map((a.W || []).map((w) => [w[0], w]));
  const wolves = (b.W || []).map((w) => {
    const o = wa.get(w[0]) || w;
    return { id: w[0], x: lerp(o[1], w[1]), zw: lerp(o[2], w[2]), yaw: lerpA(o[3], w[3]), st: w[4], tg: w[6], al: w[14] | 0 };
  });
  const flares = (b.F || []).map((x) => ({ id: x[0], m: x[1], x: x[2], z: x[3], t: x[4] }));
  const me = players.find((p) => p.me) || null;
  const focus = me ? { x: me.x * 0.85, z: me.z } : { x: 0, z: 2 };
  if (me) focus.z = me.on ? me.z * 0.6 : me.z; // à bord, la caméra garde tout le convoi dans le cadre
  const up = snapUp(b), legs = b.lg || ['plaine'], dist = lerp(a.d, b.d), bo = b.bo, ao = a.bo || bo;
  const view = {
    seed: b.sd, diff: b.df, dist, speed: b.sp, fuel: lerp(a.fu, b.fu), burn: b.br, t: b.t, fedTotal: b.ft, phase: b.ph,
    players, crates, wolves, flares, looted: new Set(b.L), me, focus, meId: S.myId,
    mode: b.mo || 'expedition', goal: b.gl || 0, fmax: b.fm || 100, scrap: b.sc | 0, up, radar: up.radar > 0, ns: b.ns | 0,
    stop: b.so || null, ev: b.ev || null, gust: b.gu || 0, win: b.wn | 0,
    thr: b.th ?? 1, press: lerp(a.pr ?? 0, b.pr ?? 0), hull: b.hu ?? 100, gap: b.sto != null ? lerp(a.d - (a.sto ?? b.sto), b.d - b.sto) : 999, calm: !!b.ca, why: b.wy || '',
    faults: (b.FA || []).map((f) => ({ id: f[0], k: f[1], x: f[3], z: f[4], prog: f[5] })),
    raiders: raidersView(a, b, lerp),
    legs, bio: bioAt(b.mo || 'expedition', b.gl || 0, legs, dist), mi: b.mi ?? 1, mm: b.mm || null, night: dayInfo(b.t).k, day: dayInfo(b.t),
    boss: bo ? { x: lerp(ao[0], bo[0]), z: lerp(ao[1], bo[1]), hp: bo[2], hm: bo[3], side: bo[4], st: bo[5], t: bo[6] } : null,
    hooks: (b.HK || []).map((h) => ({ id: h[0], x: h[1], z: h[2], prog: h[3] })), warmR: warmR(up), flareR: flareR(up),
    route: snapRoute(b), fork: snapFork(b), lc: b.lc | 0, mk: b.mk || [], cut: new Set(b.CU || []), tn: b.tn | 0, gr: b.gr || 0,
    carts: new Map((b.CA || []).map(([id, p, d]) => [id, { p, d }])), tanks: (b.TK || []).map(([id, left, h, lk]) => ({ id, left, h, lk })),
    snipers: (b.SN || []).map((q) => ({ id: q[0], x: q[1], zw: q[2], h: q[3], st: q[4], t: q[5], tg: q[6], dl: q[8] })),
    surv: survView(a, b, lerp), ty: b.ty ?? Math.PI, tcd: b.tcd || 0, ct: b.ct || null, saved: b.sv | 0, wc: b.wc | 0,
  };
  view.moment = nextMoment(view);
  view.next = nextInfo(view);
  view.prompt = promptFor(view, b);
  return view;
}

function raidersView(a, b, lerp) {
  const ra = new Map((a.R || []).map((w) => [w[0], w]));
  return (b.R || []).map((w) => { const o = ra.get(w[0]) || w; return { id: w[0], x: lerp(o[1], w[1]), z: lerp(o[2], w[2]), side: w[3], st: w[4], carry: w[6], b: w[9] | 0, rx: lerp(o[10] || 0, w[10] || 0), rz: lerp(o[11] || 0, w[11] || 0) }; });
}
function survView(a, b, lerp) {
  const sa = new Map((a.SV || []).map((q) => [q[0], q]));
  return (b.SV || []).map((q) => { const o = sa.get(q[0]) || q; return { id: q[0], ss: q[1], x: lerp(o[2], q[2]), y: lerp(o[3], q[3]), z: lerp(o[4], q[4]), vx: q[5], vz: q[6], on: q[7], ref: q[8], air: q[9], st: q[10], lead: q[12], heat: q[13], seat: q[14], yaw: q[15] }; });
}

// moment fort en cours ou à venir sur le tronçon : { k, d, on }
function nextMoment(v) {
  if (v.mm) return { k: v.mm.k, d: v.mm.d, on: true, t: v.mm.t };
  const m = momentOf(v.seed, v.mode, v.goal, v.route, v.mi);
  return m && m.d > v.dist - 5 ? { k: m.k, d: m.d, on: false } : null;
}

// prochaine étape (gare ou terminus) pour la barre d'objectif
function nextInfo(v) {
  const sd = stationDist(v.mode, v.goal, v.ns);
  if (sd != null && (v.mode !== 'expedition' || sd < v.goal)) return { k: 'station', d: sd, i: v.ns };
  if (v.mode === 'expedition') return { k: 'goal', d: v.goal };
  return null;
}

// touche à l'écran : l'image du clavier (Kenney, CC0), un pictogramme sur écran tactile
const KEY_IMG = { E: 'e', F: 'f', G: 'g', V: 'v', M: 'm', O: 'o', N: 'n', Espace: 'space', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
const kbd = (k) => (input.mode === 'touch' ? `<kbd>${{ E: '✋', F: '➶', G: '🎆', Espace: '⤒' }[k] || k}</kbd>`
  : KEY_IMG[k] ? `<img class="key" src="img/icons/keys/${KEY_IMG[k]}.png" alt="${k}">` : `<kbd>${k}</kbd>`);
const pgb = (k, hot) => `<span class="pg ${hot ? 'hot' : ''}"><i style="width:${Math.round(Math.max(0, Math.min(1, k)) * 100)}%"></i></span>`;
const CRATE_NAME = { 1: 'le fioul', 2: 'le charbon (+45 %, lourd)', 3: 'le fioul gelé (à dégeler près du feu)', 4: 'les pièces (ferraille)', 5: 'les bûches' };
function promptFor(v, snap) {
  const me = v.me; if (!me || v.phase !== 'play') return '';
  if (me.st === 3) {
    const t = Math.ceil(me.tm || 0);
    return me.heat <= 0.5 ? `🥶 Gelé… on te ramène près de la chaudière dans ${t} s` : `❄️ Perdu dans la tempête… retour à bord dans ${t} s`;
  }
  if (me.st === 2) return '';
  const E = v.ev;
  // à la tourelle
  if (me.tu) return `🎯 Tourelle-harpon : vise avec les flèches, ${kbd('F')} tire${v.tcd > 0 ? ' (recharge…)' : ''} · ${kbd('E')} pour la quitter`;
  // dangers d'abord
  if (E && E.k === 'aval' && E.t > 0 && !E.hit && !me.on && me.x * E.side > 2.75) return `⚠️ AVALANCHE ! Remonte à bord ou file de l'autre côté de la voie !`;
  const M = v.moment, bridge = M && M.k === 'bridge' && M.on && v.dist > M.d - 120 && v.dist - REAR < M.d + BRIDGE_LEN;
  if (bridge && !me.on && v.dist > M.d - 60) return '🌉 Le pont ! Remonte vite à bord : dehors, c\'est la chute !';
  if ((me.ic || 0) > 1.4 && !me.on) return '🧊 La glace craque sous tes pieds : bouge !';
  const aimed = (v.snipers || []).find((q) => q.st === 1 && q.tg === me.id);
  if (aimed) return '🎯 Un tireur te vise depuis un toit ! Cours, ou plante une fusée au pied de l\'immeuble';
  const hunter = v.wolves.find((w) => w.st === 1 && w.tg === me.id);
  if (hunter) return me.flares > 0 ? `🐺 ${hunter.al ? 'L\'alpha' : 'Un loup'} te traque ! ${kbd('G')} fusée éclairante (${me.flares})` : `🐺 Un loup te traque ! Cours vers la chaudière ou un équipier`;
  if (v.bio === 'col' && !me.on && Math.abs(me.x) > 22) return '⛰️ Attention au ravin : ne t\'éloigne pas de la voie !';
  const hd = Math.hypot(me.x - BOILER.x, me.z - BOILER.z);
  // le tuyau d'une cuve en main
  if (me.hose) {
    const nearB = me.on ? hd < 3 : Math.abs(me.x) < HALF_W + 1.4 && Math.abs(me.z) < 5;
    return nearB ? `${kbd('E')} Brancher le tuyau sur le wagon-chaudière` : `🛢️ Tire le tuyau jusqu'au flanc du wagon-chaudière (${HOSE_LEN} m max) · ${kbd('E')} pour le lâcher`;
  }
  if (me.on && !me.air && !me.carry) {
    if (v.up.turret && Math.hypot(me.x - TURRET.op.x, me.z - TURRET.op.z) < 1.2) return `${kbd('E')} Prendre la tourelle-harpon`;
    if (v.up.workshop && Math.hypot(me.x - BENCH.op.x, me.z - BENCH.op.z) < 1.3) return v.scrap >= 2 ? `Maintiens ${kbd('E')} : atelier, 2 ferraille → ${v.hull < 88 ? 'kit de réparation (+15 %)' : 'une fusée'} ${pgb(me.cr || 0)}` : '🛠️ Atelier : il faut 2 ferraille';
  }
  if (!v.calm && me.on && !me.air && !me.carry) {
    if (Math.hypot(me.x - LEVER.x, me.z - LEVER.z) < LEVER.r) return `${kbd('E')} Manette : ${THROTTLE.map((t, i) => (i === v.thr ? `<b>${t.label}</b>` : t.label)).join(' · ')}`;
    if (Math.hypot(me.x - VALVE.x, me.z - VALVE.z) < VALVE.r) return `Maintiens ${kbd('E')} pour lâcher la vapeur · pression ${Math.round(v.press)} % ${pgb(v.press / 100, v.press > 75)}`;
    const h = v.hooks.find((q) => Math.hypot(q.x - me.x, q.z - me.z) < 1.25);
    if (h) return `Maintiens ${kbd('E')} : couper le grappin ${pgb(h.prog, true)}`;
    const f = v.faults.find((q) => Math.hypot(q.x - me.x, q.z - me.z) < 1.25);
    if (f) return `Maintiens ${kbd('E')} : ${f.k === 'pipe' ? 'dégeler le tuyau' : f.k === 'fire' ? 'éteindre le feu' : 'colmater la fuite'} ${pgb(f.prog)}`;
  }
  const boarder = me.on && v.raiders.find((w) => w.st === 5 && Math.hypot(w.rx - me.x, w.rz - me.z) < 1.6);
  if (boarder) return `${kbd('E')} Jeter le pillard par-dessus bord !`;
  const raider = !me.carry && v.raiders.find((w) => w.st < 2 && (me.on ? Math.abs(me.x) > HALF_W - 0.7 && Math.sign(me.x) === w.side && Math.abs(me.z - w.z) < 1.9 : Math.hypot(me.x - w.x, me.z - w.z) < 1.4));
  if (raider) return `${kbd('E')} Renverser le pillard !`;
  if (me.carry) {
    const C = CRATES[me.carry] || CRATES[1], boss = v.boss && v.boss.st < 2;
    if (boss && me.on) return `🚛 Lance-lui la caisse ! Au bord du wagon, face au camion, ${kbd('F')}`;
    if (me.on && me.carry === 3 && hd < v.warmR) return `🧊 Ça dégèle près du feu… ${pgb(me.cth || 0)} · ${kbd('E')} tout de suite : +${C.fuel} % seulement`;
    if (me.on && hd < 2.4) return C.scrap ? `${kbd('E')} Ranger les pièces (+${C.scrap + (v.up.salvage | 0)} ferraille)` : `${kbd('E')} ${C.label} dans la chaudière (+${C.fuel + (me.role === 2 && me.carry !== 3 ? 6 : 0)} %)`;
    if (me.on) return me.carry === 3 ? `🧊 Fioul gelé : garde-le près de la chaudière pour le dégeler` : `Porte ${me.carry === 2 ? 'le charbon (lourd !)' : me.carry === 4 ? 'les pièces' : me.carry === 5 ? 'les bûches' : 'la caisse'} à la chaudière · ${kbd('F')} pour la lancer`;
    return `Rattrape le convoi · ${kbd('F')} lance ${me.carry === 2 ? 'le charbon (lourd, ça porte moins loin)' : 'la caisse'} sur le wagon ou dans le foyer`;
  }
  const nearC = v.crates.find((c) => c.m !== 2 && (c.m === 1) === !!me.on && Math.hypot(c.x - me.x, (c.m === 0 ? c.z + v.dist : c.z) - me.z) < 1.5);
  if (nearC && !me.air) return `${kbd('E')} Prendre ${CRATE_NAME[nearC.t] || 'la caisse'}`;
  // congère ou troupeau sur la voie
  if (E && (E.k === 'drift' || E.k === 'herd') && !E.done) {
    const zd = E.zw + v.dist, herd = E.k === 'herd', pg = pgb(E.prog || 0);
    if (!me.on && Math.abs(me.x) < (herd ? 6 : 4.6) && Math.abs(me.z - zd) < (herd ? 4.5 : 2.9)) return herd ? `Maintiens ${kbd('E')} pour chasser les rennes (ou une fusée ${kbd('G')}) ${pg}` : me.dig ? `Pelletée après pelletée… ${pg}` : `Maintiens ${kbd('E')} pour déblayer la congère ${pg}`;
    if (v.stop && v.stop.k === E.k) return herd ? `🦌 Un troupeau bloque la voie ! Descends devant la locomotive et chasse-le ${pg}` : `⛔ Congère sur la voie ! Descends devant la locomotive et déblaie-la ${pg}`;
  }
  // l'aiguillage qui vient : le levier au bord de la voie
  const fk = v.fork;
  if (fk && !me.on) {
    const lz = v.dist - fk.lD;
    if (Math.hypot(me.x - fk.lx, me.z - lz) < 1.6) {
      const o = forkOptions(v.seed, v.route, fk) || [];
      const lab = (k) => (fk.k === 'st' ? BIOMES[k]?.label : MOMENTS[k]?.label) || '';
      return `${kbd('E')} Basculer l'aiguillage : ${o.map((k, i) => (i === v.lc ? `<b>${i ? '' : '◄ '}${lab(k)}${i ? ' ►' : ''}</b>` : lab(k))).join(' · ')}`;
    }
  }
  if (v.stop && v.stop.k === 'station') return `🚉 En gare : cartes ${kbd('1')}–${kbd('3')}${v.stop.fk ? ', levier de l\'aiguillage au bout du quai' : ''}${v.stop.en && !v.stop.ed ? `, une rencontre (${kbd('O')} / ${kbd('N')})` : ''} · ${kbd('V')} prêt à partir`;
  if (v.stop && v.stop.k === 'wreck') return `🚃 Convoi abandonné : ramassez les caisses le long du vieux train, le Front avance ! · ${kbd('V')} repartir`;
  if (fk && me.on && fk.at - v.dist < 160 && fk.at - v.dist > 0) {
    const o = forkOptions(v.seed, v.route, fk) || [], lab = (k) => (fk.k === 'st' ? BIOMES[k]?.label : MOMENTS[k]?.label) || '';
    return `🔀 Aiguillage dans ${Math.round(fk.at - v.dist - 19)} m : levier au bord de la voie, côté ${fk.lx < 0 ? 'gauche' : 'droit'} → <b>${lab(o[v.lc])}</b>`;
  }
  if (bridge && me.on && v.thr !== 0) return `🌉 Pont fragile : passe la manette en <b>Éco</b> (${kbd('E')} à l'arrière de la cabine) !`;
  if (bridge && me.on) return v.dist + 19.4 < M.d ? '🌉 Pont droit devant, en Éco : parfait. Personne ne descend !' : '🌉 Sur le pont… doucement, et personne ne descend.';
  if (v.boss && v.boss.st < 2 && me.on) return `🚛 Le Brise-Glace ! Coupez les grappins (${kbd('E')}) et lancez-lui des caisses (${kbd('F')})${v.up.turret ? ', ou harponnez-le' : ''}`;
  if (M && M.k === 'roar' && M.on && (M.t || 0) < 40) return '🌪️ Le Front rugit : plein gaz, nourrissez la chaudière !';
  if (v.tn && !me.on) return '⛰️ Tunnel : longe le convoi de près, les parois sont proches';
  if (!me.on) {
    const ruins = ruinsFor(snap);
    for (const [, c] of ruins.around(v.dist, 40, 70)) for (const r of c.ruins) {
      // wagonnet de mine
      if (r.res && r.res.k === 'cart') {
        const st = v.carts.get(r.res.id), q = r.res.x0 + (r.res.x1 - r.res.x0) * (st ? st.p : 0), zc = r.res.zw + v.dist;
        if (!(st && st.d) && Math.abs(zc - me.z) < 1.8 && Math.abs(q - me.x) < 2) return `Maintiens ${kbd('E')} en avançant : pousser le wagonnet de charbon jusqu'à la voie ${pgb(st ? st.p : 0)}`;
      }
      // cuve de fioul
      if (r.res && r.res.k === 'tank') {
        const T = v.tanks.find((q) => q.id === r.res.id);
        if (Math.hypot(r.res.x - me.x, r.res.zw + v.dist - me.z) < 1.8) return T && T.lk ? '🛢️ Le tuyau est branché : le fioul coule… attention aux étincelles' : T && T.left <= 0 ? 'Cuve vide' : `${kbd('E')} Prendre le tuyau de la cuve (${Math.round(T ? T.left : r.res.fuel)} % de fioul)`;
      }
      for (let j = 0; j < r.spots.length; j++) {
        const sp = r.spots[j];
        if (v.looted.has(r.id * 4 + j)) continue;
        if (Math.hypot(sp.x - me.x, sp.zw + v.dist - me.z) < 2.4) return me.sp > 0 ? `Fouille… ${pgb(me.sp)}` : `Maintiens ${kbd('E')} pour fouiller ${r.kind === 'block' ? 'l\'immeuble' : r.kind === 'boat' ? 'l\'épave (la glace craque !)' : 'la ruine'}`;
      }
      if (r.sn) { const sq = (v.snipers || []).find((q) => q.id === r.id); if (sq && sq.st < 4 && Math.hypot(r.x - me.x, r.zw + v.dist - me.z) < 6.5) return `Maintiens ${kbd('E')} : monter déloger le tireur ${pgb(sq.dl || 0)}`; }
      // un arbre à abattre
      for (const t of c.trees) {
        if (v.cut.has(t.id)) continue;
        if (Math.hypot(t.x - me.x, t.zw + v.dist - me.z) < 2.1) return me.act === 1 ? `Hache… ${pgb(0.5 + 0.5 * Math.sin(v.t * 3))}` : `Maintiens ${kbd('E')} pour abattre l'arbre (des bûches pour la chaudière)`;
      }
    }
    if (me.st === 1) return '❄️ Tu t\'enfonces dans la neige !';
    if (v.bio === 'lac' && !(v.up.crampons | 0)) return '🧊 Lac gelé : ça glisse, et ne reste pas planté sur la glace';
  }
  const follower = (v.surv || []).find((q) => q.ss === 0 && q.lead === me.id);
  if (follower && !me.on) return '🧍 Un survivant te suit : ramène-le jusqu\'à l\'échelle de queue';
  if (!v.calm && v.press > 80) return `♨️ La chaudière va exploser ! Soupape : maintiens ${kbd('E')} devant la chaudière`;
  if (!v.calm && v.gap < 30 && !me.on) return '🌪️ Le front de tempête arrive : remonte à bord !';
  if (v.raiders.some((w) => w.st === 5) && me.on) return '🏴 Un pillard a sauté sur le pont ! Va le jeter par-dessus bord (E)';
  if (v.raiders.some((w) => w.st === 1) && me.on && !me.carry) return '🏴 Pillards le long du convoi ! Va au bord du wagon et renverse-les (E), ou lance-leur une caisse';
  if (me.heat < 30) return me.on && hd < v.warmR ? '🔥 Tu te réchauffes…' : '🥶 Tu gèles ! Va te réchauffer près de la chaudière';
  if (v.fuel <= 0) return '🔥 La chaudière est éteinte : une caisse, vite !';
  if (me.on && v.fuel < 25) return v.bio === 'foret' ? 'Réservoir bas ! Saute du train et abats des arbres (E maintenu)' : 'Réservoir bas ! Saute du train et fouille les ruines (lanternes jaunes)';
  return '';
}

// ------------------------------------------------------------------ gare : achats et départ
function atStation() { const v = S.view; return !!(v && v.stop && v.stop.k === 'station' && v.phase === 'play' && !S.menu && !S.endShown); }
function doBuy(k) {
  if (!atStation() || !CARDS[k]) return;
  sfx.unlock();
  if (S.role === 'guest') { H.send('host', { t: 'buy', k }); return; }
  const err = S.sim && S.sim.buy(S.myId, k);
  if (err) { hud.toast(err, 2); sfx.play('nope'); }
}
function doVote() {
  const v = S.view;
  if (!atStation() && !(v && v.stop && v.stop.k === 'wreck' && v.phase === 'play' && !S.menu && !S.endShown)) return;
  if (S.role === 'guest') H.send('host', { t: 'vote' }); else S.sim && S.sim.vote(S.myId);
}
// rencontre en gare : accepter (0) ou refuser (1)
function doChoose(o) {
  if (!atStation() || !S.view.stop.en || S.view.stop.ed) return;
  sfx.unlock();
  if (S.role === 'guest') { H.send('host', { t: 'choose', o }); return; }
  const err = S.sim && S.sim.choose(S.myId, o);
  if (err) { hud.toast(err, 2); sfx.play('nope'); }
}
function onKey(k) {
  if (S.intro && (k === 'Enter' || k === 'KeyE' || k === 'NumpadEnter')) { endIntro(); return; }
  const m = /^(?:Digit|Numpad)([1-4])$/.exec(k);
  if (m) { const c = S.view?.stop?.c; if (c && c[+m[1] - 1]) doBuy(c[+m[1] - 1]); }
  else if (k === 'KeyO') doChoose(0);
  else if (k === 'KeyN') doChoose(1);
  else if (k === 'KeyV') doVote();
  else if (k === 'Tab') hud.toggleMap();
}

// ------------------------------------------------------------------ effets (sons, textes flottants)
function fxEvent(e, view) {
  const who = (id) => view.players.find((p) => p.id === id);
  const at = (x, y, z, txt, cls) => { if (!scene) return; const s = scene.toScreen(x, y, z); if (s.front) hud.pop(txt, s.x, s.y, cls); };
  const mine = e.p === S.myId;
  const nm = (id) => who(id)?.name || 'Quelqu\'un';
  hud.tutoEvent(e, mine);
  switch (e.e) {
    case 'feed': sfx.play(e.t === 3 ? 'sizzle' : 'feed'); at(BOILER.x, BOILER.top + 1, BOILER.z, `+${e.a ?? 25} %${e.t === 3 ? ' (gelé…)' : ''}`, e.t === 3 ? 'cold' : 'fire'); if (e.rescue) hud.toast('La chaudière repart !', 2.5); break;
    case 'stash': sfx.play('buy'); at(BOILER.x, BOILER.top + 1, BOILER.z, `+${e.s} ferraille`, 'gold'); break;
    case 'thawed': sfx.play('sizzle'); at(e.x, 2.4, e.z, 'Dégelée !', 'fire'); break;
    case 'netted': sfx.play('thud'); at(e.x, 2.4, e.z, 'Rattrapée !', 'gold'); break;
    case 'found': at(e.x, 1.5, e.z, [e.n ? `+${e.n} caisse${e.n > 1 ? 's' : ''}` : '', e.s ? `+${e.s} ferraille` : ''].filter(Boolean).join(' · '), 'gold'); if (mine) sfx.play('found'); break;
    case 'empty': at(e.x, 1.5, e.z, 'Rien…', 'cold'); if (mine) sfx.play('empty'); break;
    case 'fall': if (mine) { sfx.play('fall'); scene && scene.kick(0.4); } at(e.x, 1.2, e.z, 'Plouf !', 'cold'); scene && scene.burst(e.x, 0.3, e.z, 10, 1.5, 2); break;
    case 'land': if (mine) sfx.play('land'); break;
    case 'pick': if (mine) sfx.play('pick'); break;
    case 'throw': if (mine) sfx.play('throw'); break;
    case 'thud': sfx.play('thud'); break;
    case 'board': if (mine) { sfx.play('board'); hud.toast('De retour à bord', 1.5); } break;
    case 'lost': { const p = who(e.p); if (mine) { sfx.play('lost'); hud.toast('Perdu dans la tempête !', 3); } else if (p) hud.toast(`${p.name} s'est perdu dans la tempête`, 2.5); break; }
    case 'respawn': if (mine) hud.toast('Les autres t\'ont hissé à bord', 2); break;
    case 'low': sfx.play('low'); hud.toast('Réservoir bas !', 2.5); break;
    case 'stall': sfx.play('stall'); hud.toast('Panne sèche…', 3); break;
    case 'left': hud.toast(`${e.n} a quitté le convoi`, 2.5); break;
    // froid
    case 'cold': if (mine) { sfx.play('shiver'); hud.toast('Tu as froid : retourne près de la chaudière !', 2.5); } break;
    case 'frozen': if (mine) { sfx.play('lost'); hud.toast('Gelé ! Tu t\'effondres dans la neige…', 3); } else hud.toast(`${nm(e.p)} est gelé`, 2.5); break;
    // loups
    case 'howl': sfx.play('howl'); hud.toast('Des loups rôdent dans la tempête…', 2.5); break;
    case 'growl': sfx.play('growl'); break;
    case 'bite': sfx.play('bite'); at(e.x, 1.6, e.z, 'Morsure !', 'fire'); if (mine) { scene && scene.kick(0.5); hud.flash('bite'); } break;
    case 'yelp': sfx.play('yelp'); break;
    case 'flare': sfx.play('flare'); break;
    case 'noflare': if (mine) { sfx.play('nope'); hud.toast('Plus de fusées : la prochaine gare en redonne', 2); } break;
    // événements de voie
    case 'drift_ahead': sfx.play('warn'); hud.toast('Congère sur la voie, droit devant !', 2.5); break;
    case 'drift_stop': sfx.play('brake'); hud.toast('Convoi bloqué : sortez les pelles !', 3); scene && scene.kick(0.3); break;
    case 'cleared': sfx.play('cleared'); hud.toast('Voie dégagée !', 2); break;
    case 'aval_warn': sfx.play('rumble'); hud.toast(`Avalanche ${e.side < 0 ? 'à gauche' : 'à droite'} !`, 3); scene && scene.kick(0.25); break;
    case 'aval':
      sfx.play('aval'); scene && scene.kick(0.9);
      if (scene) for (let k = 0; k < 6; k++) scene.burst(e.side * (6 + Math.random() * 18), 0.5, -18 + k * 7, 25, 6, 5);
      break;
    case 'buried': at(e.x, 1.5, e.z, 'Enseveli !', 'cold'); if (mine) hud.toast('Enseveli par l\'avalanche !', 2.5); break;
    case 'gust': sfx.play('gust'); hud.toast('Bourrasque ! Ça pousse de côté', 2.5); break;
    // gares et arrivée
    case 'station': sfx.play('bell'); hud.toast(`🚉 ${e.n}`, 3); break;
    case 'depart': sfx.play('whistle'); hud.toast('En voiture ! Le convoi repart', 2.5); break;
    case 'vote': sfx.play('click'); break;
    case 'buy': sfx.play('buy'); hud.toast(`${nm(e.p)} : ${CARDS[e.k]?.icon || ''} ${CARDS[e.k]?.label || ''}${e.free ? ' (offerte)' : ''}`, 2.5); break;
    case 'arrive': sfx.play('arrive'); hud.toast(`FORT-GIVRE ! Le convoi est arrivé${e.s ? ` avec ${e.s} survivant${e.s > 1 ? 's' : ''}` : ''}`, 4); break;
    // front de tempête, chaudière, pannes, pillards
    case 'storm_near': sfx.play('rumble'); hud.toast('Le front de tempête se rapproche…', 3); break;
    case 'storm_close': sfx.play('warn'); hud.toast('🌪️ LE FRONT EST SUR NOUS ! Plein gaz !', 3); scene && scene.kick(0.3); break;
    case 'throttle': sfx.play('lever'); hud.toast(`Manette : ${THROTTLE[e.l].label}`, 1.5); break;
    case 'press_warn': sfx.play('whistle'); hud.toast('♨️ Pression critique : la soupape, vite !', 2.5); break;
    case 'vent': sfx.play('steam'); scene && scene.steam(); break;
    case 'boom':
      sfx.play('boom'); scene && scene.kick(1); hud.flash();
      hud.toast('💥 LA CHAUDIÈRE A EXPLOSÉ ! −20 % de fioul, convoi abîmé', 3);
      if (scene) scene.burst(0, BOILER.top + 1, 0, 40, 3, 7);
      break;
    case 'fault': sfx.play(e.k === 'fire' ? 'fire' : 'clank'); hud.toast(e.k === 'pipe' ? '🧊 Un tuyau a gelé : le convoi ralentit !' : e.k === 'fire' ? '🔥 Une étincelle : le feu prend à bord !' : '🛢️ Fuite de fioul à bord !', 2.5); at(e.x, 2.4, e.z, e.k === 'pipe' ? 'Tuyau gelé !' : e.k === 'fire' ? 'Au feu !' : 'Fuite !', e.k === 'fire' ? 'fire' : 'cold'); break;
    case 'fixed': sfx.play('cleared'); at(e.x, 2.4, e.z, 'Réparé', 'gold'); break;
    case 'raid': sfx.play('engine'); hud.toast(`🏴 ${e.n > 1 ? e.n + ' pillards' : 'Un pillard'} en motoneige !`, 3); break;
    case 'board_raid': sfx.play('clank'); break;
    case 'steal': sfx.play('nope'); at(e.x, 2, e.z, 'Caisse volée !', 'fire'); break;
    case 'sabotage': sfx.play('thud'); at(e.x, 2, e.z, 'Sabotage !', 'fire'); scene && scene.kick(0.2); break;
    case 'repel': sfx.play('crash'); at(e.x, 1.8, e.z, `Renversé ! +${e.s || 1} ferraille`, 'gold'); scene && scene.burst(e.x, 0.5, e.z, 18, 2, 3); break;
    // ambiances, jour et nuit, aiguillage
    case 'leg': { const B = BIOMES[e.b] || BIOMES.plaine; sfx.play('leg'); hud.banner(B.label, B.desc, 3.6, e.b); break; }
    case 'night': sfx.play('howl'); hud.toast('🌙 La nuit tombe : les loups sortent, les pillards se terrent', 3.5); break;
    case 'day': sfx.play('bell'); hud.toast('☀️ Le jour se lève', 2.5); break;
    case 'switched': {
      const lab = e.k === 'st' ? BIOMES[e.o]?.label : MOMENTS[e.o]?.label;
      sfx.play('lever'); sfx.play('creak'); hud.toast(`🔀 Le convoi prend la voie ${e.c ? 'de droite' : 'de gauche'} : ${lab || ''}`, 2.8); scene && scene.kick(0.15); break;
    }
    case 'lever': sfx.play('lever'); if (mine) hud.toast('Aiguillage basculé', 1.2); break;
    case 'tunnel': if (e.on) { sfx.play('rumble'); hud.toast('⛰️ Tunnel', 1.5); } break;
    case 'screech': sfx.play('creak'); hud.toast('Virage trop serré à cette vitesse : les roues crissent !', 1.8); scene && scene.kick(0.2); break;
    case 'ravine': if (mine) { sfx.play('lost'); hud.toast('Tu as glissé dans le ravin…', 3); } else hud.toast(`${nm(e.p)} a glissé dans le ravin`, 2.5); break;
    // bois, charbon, fioul : les gestes de chaque paysage
    case 'timber': sfx.play('timber'); at(e.x, 3, e.z, 'Timber !', 'gold'); break;
    case 'cart_dump': sfx.play('crash'); at(e.x, 1.6, e.z, 'Charbon !', 'gold'); scene && scene.burst(e.x, 0.5, e.z, 16, 2, 2); break;
    case 'hose_grab': sfx.play('clank'); if (mine) hud.toast('Tire le tuyau jusqu\'au wagon-chaudière', 2); break;
    case 'hose_link': sfx.play('pump'); hud.toast('🛢️ Tuyau branché : le fioul coule !', 2.2); break;
    case 'hose_drop': sfx.play('thud'); break;
    case 'hose_snap': sfx.play('crash'); hud.toast('Le tuyau a cédé : la cuve est trop loin', 2.2); break;
    case 'tank_empty': hud.toast('La cuve est vide', 1.8); break;
    case 'craft': sfx.play('buy'); at(BENCH.x, 2.4, BENCH.z, e.k === 'kit' ? '+15 % de solidité' : '+1 fusée', 'gold'); break;
    // survivants
    case 'surv_found': sfx.play('found'); at(e.x, 2, e.z, 'Un survivant !', 'gold'); if (mine) hud.toast('🧍 Un survivant ! Ramène-le à bord par l\'échelle de queue', 3); break;
    case 'surv_aboard': sfx.play('board'); hud.toast('🧍 Un survivant est à bord (il aide à la soupape)', 2.5); break;
    case 'surv_lost': hud.toast('Un survivant s\'est perdu dans la tempête…', 2.5); break;
    case 'surv_dead': hud.toast('Un survivant est mort de froid…', 2.5); break;
    // dangers de la ville et de la forêt
    case 'ambush': sfx.play('engine'); hud.toast('🏴 Embuscade ! Des pillards sortent de la ruine', 2.5); break;
    case 'aim': sfx.play('beep'); if (e.p === S.myId) hud.flash('bite'); break;
    case 'shot': sfx.play('shot'); at(e.x, 1.6, e.z, 'Touché !', 'fire'); if (e.p === S.myId) { scene && scene.kick(0.4); hud.flash('bite'); } break;
    case 'snipe_hide': at(e.x, 4, e.z, 'Il se cache', 'cold'); break;
    case 'snipe_down': sfx.play('crash'); at(e.x, 4, e.z, 'Tireur délogé !', 'gold'); break;
    case 'boarder': sfx.play('thud'); at(e.x, 2.6, e.z, 'À l\'abordage !', 'fire'); hud.toast('🏴 Un pillard saute sur le pont !', 2); break;
    case 'boarder_off': at(e.x, 2.6, e.z, 'Il saute', 'cold'); break;
    case 'alpha': sfx.play('howl'); sfx.play('growl'); hud.toast('🐺 Un alpha mène la meute : il ne craint presque pas les fusées', 3); break;
    case 'wolf_down': sfx.play('yelp'); at(e.x, 1.6, e.z, e.al ? 'L\'alpha est à terre ! +3 ferraille' : 'Loup abattu', 'gold'); break;
    case 'herd_ahead': sfx.play('warn'); hud.toast('🦌 Des rennes sur la voie !', 2.5); break;
    case 'herd_stop': sfx.play('brake'); hud.toast('🦌 Le troupeau bloque la voie : chassez-le (E maintenu, ou une fusée)', 3); break;
    case 'herd_gone': sfx.play('hooves'); hud.toast('Voie libre !', 1.8); break;
    // tourelle-harpon
    case 'harpoon': sfx.play('harpoon'); scene && scene.harpoon(e.x0, e.z0, e.x1, e.z1); break;
    case 'reel': sfx.play('pick'); at(e.x, 2.6, e.z, 'Ramenée à bord !', 'gold'); break;
    case 'turret': if (e.on && e.p === S.myId) hud.toast('Tourelle : vise avec les flèches, F pour tirer', 2.2); break;
    // contrats et rencontres
    case 'contract': hud.toast(e.ok ? `📜 Contrat rempli : ${CONTRACTS[e.k].label} (+${e.r} ferraille)` : `📜 Contrat manqué : ${CONTRACTS[e.k].label}`, 3.2); sfx.play(e.ok ? 'buy' : 'nope'); break;
    case 'encounter': sfx.play(e.o ? 'click' : 'buy'); hud.toast(e.o ? 'Vous passez votre chemin' : `${ENCOUNTERS[e.k].label} : marché conclu`, 2.4); break;
    // moments forts
    case 'moment': {
      const T = { boss: ['LE BRISE-GLACE !', 'Coupez ses grappins et lancez-lui des caisses'], bridge: ['PONT DE LA GORGE', 'Passez en Éco et que personne ne descende'],
        wreck: ['CONVOI ABANDONNÉ', 'Le convoi va s\'arrêter : ramassez tout ce que vous pouvez'], roar: ['LE FRONT RUGIT !', 'Plein gaz pendant 40 secondes'] }[e.k];
      if (T) hud.banner(T[0], T[1], 3.2, e.k);
      sfx.play(e.k === 'boss' ? 'horn' : e.k === 'roar' ? 'roar' : 'warn'); if (e.k === 'roar') scene && scene.kick(0.5);
      break;
    }
    case 'wreck': sfx.play('brake'); hud.toast(`${e.n} caisses le long du vieux train !`, 3); break;
    case 'roar_end': sfx.play('gust'); hud.toast('Le Front s\'essouffle… profitez-en', 3); break;
    case 'creak': sfx.play('creak'); scene && scene.kick(0.12); break;
    case 'bridge_crack': sfx.play('boom'); scene && scene.kick(0.9); hud.flash(); hud.toast('💥 Le pont se fissure sous le convoi !', 3); break;
    case 'bridge_done': sfx.play('cleared'); hud.toast('Pont franchi !', 2); break;
    case 'gorge': if (mine) { sfx.play('lost'); hud.toast('Tu tombes dans la gorge…', 3); } else hud.toast(`${nm(e.p)} est tombé dans la gorge`, 2.5); break;
    case 'hook': sfx.play('grapple'); at(e.x, 2.4, e.z, 'Grappin !', 'fire'); scene && scene.kick(0.2); break;
    case 'cut': sfx.play('cut'); at(e.x, 2.4, e.z, 'Coupé !', 'gold'); break;
    case 'boss_hit': sfx.play('crash'); at(e.x, 3, e.z, e.hp > 0 ? `Touché ! (${e.hp})` : 'À terre !', 'gold'); scene && scene.burst(e.x, 1.5, e.z, 14, 2, 3); break;
    case 'boss_down':
      sfx.play('boom'); scene && scene.kick(0.6); if (scene) scene.burst(e.x, 1, e.z, 40, 4, 6);
      hud.toast(`🚛 LE BRISE-GLACE EST À TERRE ! +${e.s} ferraille`, 3.5); break;
    case 'boss_gone': hud.toast('Le Brise-Glace décroche…', 2.5); break;
    case 'ice_warn': if (mine) { sfx.play('creak'); at(e.x, 1.4, e.z, 'Craaac…', 'cold'); } break;
    case 'crack': sfx.play('splash'); at(e.x, 1.4, e.z, 'Plouf !', 'cold'); if (scene) scene.burst(e.x, 0.3, e.z, 16, 1.5, 3); if (mine) { hud.toast('La glace cède !', 2.5); scene && scene.kick(0.4); } break;
    case 'flee': at(e.x, 1.8, e.z, 'Ils décrochent', 'cold'); break;
    case 'stolen': hud.toast(`Les pillards ont filé avec ${e.n} caisse${e.n > 1 ? 's' : ''}`, 2.5); break;
  }
}

// ------------------------------------------------------------------ intro : un petit récit pendant que la caméra longe le convoi
const INTRO_DUR = 15;
function introLines() {
  const goal = DIFFICULTY[S.cfg.difficulty].goal;
  return [
    ['Hiver sans fin.', 'Le monde s\'est figé sous la glace.'],
    ['Derrière nous, le Front.', 'Un mur de tempête qui avale tout ce qu\'il touche. Il ne s\'arrête jamais.'],
    S.cfg.mode === 'expedition'
      ? ['Devant, Fort-Givre.', `La dernière ville chauffée, à ${fmt.fmtM(goal)} au bout de la ligne.`]
      : ['Devant, rien que la voie.', 'Et l\'espoir de la gare suivante.'],
    ['Un convoi. Une chaudière. Un équipage.', 'Pillards, loups, pannes : rien ne vous sera épargné.'],
    ['Gardez le feu.', 'Gardez de l\'avance.'],
  ];
}
function startIntro() {
  if (!scene) return;
  const el = $('#intro'); if (!el) return;
  S.intro = { t: 0, k: -1, lines: introLines() };
  el.hidden = false; el.className = 'intro';
  el.innerHTML = `<div class="bars"></div><div class="txt" id="introTxt"></div><button class="skip" id="introSkip">Passer ▸</button>`;
  $('#introSkip').onclick = () => endIntro();
  hud.show(false);
  sfx.unlock(); sfx.play('rumble');
}
function stepIntro(dt) {
  const I = S.intro; if (!I) return;
  I.t += dt;
  // invité : l'hôte a lancé le convoi (il a passé l'intro) → on suit
  if (S.role === 'guest' && S.last && S.last.run === S.goRun && S.last.t > 0.6) { endIntro(); return; }
  const per = (INTRO_DUR - 2) / I.lines.length, k = Math.min(I.lines.length - 1, Math.floor(I.t / per));
  if (k !== I.k) {
    I.k = k; const [a, b] = I.lines[k];
    const t = $('#introTxt'); if (t) { t.classList.remove('in'); void t.offsetWidth; t.innerHTML = `<b>${a}</b><span>${b}</span>${k === I.lines.length - 1 ? '<h1>CONVOY <em>STORM</em></h1>' : ''}`; t.classList.add('in'); }
    if (k === 1) sfx.play('howl');
  }
  if (I.t >= INTRO_DUR) endIntro();
}
function endIntro() {
  if (!S.intro) return;
  S.intro = null;
  const el = $('#intro'); if (el) { el.hidden = true; el.innerHTML = ''; }
  if (!S.lobby && !S.endShown) hud.show(true);
  sfx.play('whistle');
  hud.toast(S.cfg.mode === 'expedition' ? 'Cap sur Fort-Givre !' : 'En route !', 2);
}

// ------------------------------------------------------------------ écrans de fin, menu
function showEnd(snap, reason) {
  if (S.endShown) return;
  S.endShown = true;
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = endHtml({ snap, canReplay: S.role !== 'guest' && reason !== 'host', embedded: H.embedded, reason });
  hud.show(false);
  const again = $('#btnAgain'); if (again) again.onclick = () => startRun();
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
}

function toggleMenu() {
  if (S.intro) { endIntro(); return; }
  if (S.lobby || S.endShown) return;
  S.menu = !S.menu;
  if (!S.menu) { hideScreen(); return; }
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = menuHtml({ muted: sfx.muted, solo: S.role === 'solo' });
  $('#btnResume').onclick = () => toggleMenu();
  $('#btnSound').onclick = () => { toggleMute(); toggleMenu(); toggleMenu(); };
  $('#btnQuit').onclick = exitToLobby;
  $('#btnTuto').onclick = () => { hud.resetTuto(); toggleMenu(); };
}
function toggleMute() { sfx.unlock(); sfx.setMuted(!sfx.muted); muteIcon(); }

// ambiance musicale : calme en gare, tendue quand le fioul baisse ou que les loups chassent
function musicState(v) {
  if (v.phase !== 'play') return { mode: v.win ? 'win' : 'off' };
  if (v.stop && v.stop.k === 'station') return { mode: 'station' };
  const chase = v.wolves.some((w) => w.st === 1), M = v.moment;
  const danger = Math.max(v.boss && v.boss.st < 2 ? 0.9 : 0, M && M.on && M.k === 'roar' && (M.t || 0) < 40 ? 1 : 0, M && M.on && M.k === 'bridge' && v.dist > M.d - 60 ? 0.6 : 0, v.night * 0.25,v.fuel < 25 ? 1 - v.fuel / 25 : 0, v.gap < 60 ? 1 - v.gap / 60 : 0, v.press > 75 ? 0.7 : 0, v.raiders.some((w) => w.st === 1) ? 0.6 : 0, chase ? 0.8 : 0, v.me && v.me.heat < 30 ? 0.6 : 0, v.ev && v.ev.k === 'aval' && !v.ev.hit && v.ev.t > 0 ? 1 : 0);
  return { mode: 'run', danger, bio: v.bio, tunnel: !!v.tn };
}

// ------------------------------------------------------------------ boucle
let lastT = performance.now(), prevJump = 0;
function loop(now) {
  if (!S.alive) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const blocked = S.lobby || S.endShown || S.menu || !!S.intro;
  const raw = input.sample();
  S.inp = blocked ? { ...raw, mx: 0, mz: 0, use: false } : raw;
  if (raw.jump !== prevJump) { prevJump = raw.jump; if (!blocked && S.view?.me && !S.view.me.air) sfx.play('jump'); }

  let view = null;
  if (S.role !== 'guest' && S.sim) view = hostFrame(dt);
  else if (S.role === 'guest') {
    // tant que l'hôte n'a rien envoyé, on redemande l'état
    S.hiT -= dt;
    if (!S.gotHost && S.hiT <= 0) { S.hiT = 1.5; H.send('host', { t: 'hi' }); }
    if (S.last && !S.lobby) {
      S.sendT += dt;
      if (S.sendT >= 1 / 30) { S.sendT = 0; S.sentSeq++; H.send('host', { t: 'i', ...S.inp, q: S.sentSeq }); }
      // hôte silencieux : la migration est peut-être en cours ; au-delà, on rend la main proprement
      const silent = (performance.now() - S.snapAt) / 1000;
      if (S.last.ph === 'play' && silent > HOST_SILENCE && !S.endShown) { if (!S.warned) { S.warned = true; hud.toast('Liaison avec l\'hôte interrompue…', 4); } if (silent > HOST_GIVEUP) showEnd(S.last, 'host'); }
      else S.warned = false;
    }
    view = guestFrame(dt);
  }
  stepIntro(dt);
  if (!view) { if (scene && S.idleView) { S.idleView.t += dt; scene.frame(S.idleView, dt); } sfx.update(dt, 0, 1, { mode: S.lobby ? 'station' : 'off' }); return; }
  S.view = view;
  if (S.intro) view.cine = S.intro.t / INTRO_DUR;
  // coups de pelle tant qu'on déblaie
  if (view.me && view.me.dig) { S.digT = (S.digT || 0) - dt; if (S.digT <= 0) { S.digT = 0.55; sfx.play('shovel'); scene && scene.burst(view.me.x, 0.4, view.me.z - 1.2, 4, 1, 2.5); } } else S.digT = 0;
  // coups de hache tant qu'on abat un arbre
  if (view.me && view.me.act === 1) { S.chopT = (S.chopT || 0) - dt; if (S.chopT <= 0) { S.chopT = 0.9; sfx.play('chop'); scene && scene.burst(view.me.x + Math.sin(view.me.yaw) * 0.9, 1.2, view.me.z + Math.cos(view.me.yaw) * 0.9, 3, 0.4, 2); } } else S.chopT = 0;
  scene.frame(view, dt);
  if (!S.intro) hud.update(view, scene, dt);
  sfx.update(dt, view.speed, (view.diff === 'blizzard' ? 1.3 : 1) * (view.gust > 0 ? 1.8 : 1), musicState(view));
  // fin : quelques secondes de convoi immobile, puis le bilan
  if (view.phase !== 'play' && !S.lobby) {
    if (!S.endAt) S.endAt = now;
    if (now - S.endAt > 2500) showEnd(S.last);
  } else S.endAt = 0;
}
