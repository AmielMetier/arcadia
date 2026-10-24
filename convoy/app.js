// Convoy Storm : démarrage, rôle (solo, hôte, invité), boucle de jeu, réseau via le Hub.
// Même schéma qu'Outbreak : l'hôte fait tourner la simulation à 60 Hz et diffuse l'état 20 fois par seconde ;
// les invités envoient leurs commandes (30 Hz), prédisent leur propre déplacement et voient les autres ~110 ms
// en retard, interpolés entre deux états. Le jeu ne parle jamais au réseau directement : tout passe par HubBridge.
import { Sim, DT, stepPlayer, playerFromRow, Ruins, DIFFICULTY, MODES, UPGRADES, UPG_KEYS, personalScore, BOILER, WARM_R, windOf, obstacleColliders, stationDist } from './engine/sim.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';
import { HUD, briefingHtml, menuHtml, endHtml, fmt } from './view/hud.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
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
};

// ------------------------------------------------------------------ montage (une fois par page)
const hud = new HUD();
const sfx = new Sfx();
let scene = null;
try { scene = createScene($('#stage'), { onLost: () => { hud.toast('Affichage 3D interrompu : recharge la page', 6); } }); }
catch (e) { console.error(e); }
const input = new Input(document.body, { menu: () => toggleMenu(), mute: () => toggleMute(), unlock: () => sfx.unlock(), key: (k) => onKey(k) });
hud.onBuy = (k) => doBuy(k); hud.onVote = () => doVote();
input.bindTouchButtons($('#tbtns'));
input.listen($('#btnMute'), 'click', () => toggleMute());
input.listen($('#btnMenu'), 'click', () => toggleMenu());
// en solo, la partie se met en pause quand l'onglet passe en arrière-plan
input.listen(document, 'visibilitychange', () => { if (document.hidden && S.role === 'solo' && S.sim && !S.menu && !S.endShown && !S.lobby) toggleMenu(); });
$('#btnMute').textContent = sfx.muted ? '🔇' : '🔊';

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
const squad = () => humanPlayers().map((p) => ({ ...p, me: p.id === S.myId, ready: isReady(p.id) }));

// ------------------------------------------------------------------ démarrage
function boot(info) {
  S.role = H.embedded ? info.role : 'solo';
  S.myId = H.embedded ? info.myId : 0;
  S.cfg = readCfg(info.settings || {});
  H.on('msg', onMsg);
  H.on('roster', onRoster);
  if (H.embedded) H.signalReady();       // après on('msg') : sinon les premiers messages de l'hôte se perdent
  if (!scene) { showNoGL(); return; }
  // décor d'attente derrière le briefing : le convoi à l'arrêt dans la tempête
  S.idleView = { seed: 20261023, diff: S.cfg.difficulty, dist: 0, speed: 0, fuel: 70, burn: 0, t: 0, fedTotal: 0, phase: 'play', players: [], crates: [], wolves: [], flares: [],
    looted: new Set(), me: null, focus: { x: 0, z: 2 }, ev: null, gust: 0, ns: 0, mode: 'endless', goal: 0, radar: false };
  showBriefing();
  if (S.role === 'guest') H.send('host', { t: 'hi' });
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
  screenEl.innerHTML = briefingHtml({ role: S.role, squad: squad(), cfg: S.cfg, embedded: H.embedded });
  hud.show(false);
  const go = $('#btnGo'); if (go) go.onclick = () => { sfx.unlock(); startRun(); };
  const ex = $('#btnExit'); if (ex) ex.onclick = exitToLobby;
  for (const b of screenEl.querySelectorAll('.seg button')) b.onclick = () => {
    S.cfg[b.dataset.k] = b.dataset.v;
    try { localStorage.setItem('convoy_cfg', JSON.stringify(S.cfg)); } catch (e) {}
    sfx.unlock(); sfx.play('click'); showBriefing();
  };
}
function hideScreen() { screenEl.hidden = true; screenEl.innerHTML = ''; S.menu = false; hud.show(true); }

// ------------------------------------------------------------------ hôte
function startRun() {
  if (S.role === 'guest') return;
  const sim = new Sim({ seed: (Math.random() * 2 ** 31) | 0, difficulty: S.cfg.difficulty, mode: S.cfg.mode });
  for (const p of squad()) if (p.ready) sim.addPlayer({ id: p.id, name: p.name, color: p.color });
  S.sim = sim; S.runId = Date.now(); S.lobby = false; S.endShown = false; S.reported = false; S.netEv = []; S.acc = 0; S.tick = 0;
  hideScreen();
  hud.toast(S.cfg.mode === 'expedition' ? 'Cap sur Fort-Givre !' : 'En route !', 2);
  if (H.embedded) H.send('all', { t: 'go', run: S.runId });
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
  for (const p of squad()) if (p.ready && !sim.players.has(p.id)) { sim.addPlayer({ id: p.id, name: p.name, color: p.color }); H.send(p.id, { t: 'go', run: S.runId }); }
}
function broadcastLobby() { if (H.embedded && S.role === 'host') H.send('all', { t: 'lobby', cfg: S.cfg }); }

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
    if (m.t === 'hi') { H.send(from, { t: 'lobby', cfg: S.cfg }); if (!S.lobby && S.sim) H.send(from, { t: 'go', run: S.runId }); }
    else if (m.t === 'i' && S.sim) S.sim.setInput(from, cleanInput(m)); // `from` vient du Hub : seule identité fiable
    else if (m.t === 'buy' && S.sim && typeof m.k === 'string') { const err = S.sim.buy(from, m.k); if (err) H.send(from, { t: 'err', m: err }); }
    else if (m.t === 'vote' && S.sim) S.sim.vote(from);
    return;
  }
  if (from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  S.gotHost = true; S.snapAt = performance.now();
  if (m.t === 'lobby') { if (m.cfg) S.cfg = { ...S.cfg, ...m.cfg }; if (S.lobby) showBriefing(); }
  else if (m.t === 'go') { S.lobby = false; S.endShown = false; hideScreen(); }
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
  const key = s.sd + ':' + s.df;
  if (key !== S.ruinsKey) { S.ruinsKey = key; S.ruins = new Ruins(s.sd, DIFFICULTY[s.df].loot); }
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

const ctxFor = (s, ruins, d) => ({ v: s.sp, wind: windOf(s), colliders: ruins.colliders(d).concat(obstacleColliders(s.ev, d)) });

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
    return { id: q.id, name, color, x, y, z, yaw, vx, vz, st, on, air, carry: q.carry, sp: q.sp, me, fed: q.fed, heat: q.heat, frz: q.frz, flares: q.flares, dig: q.dig, tm: q.tm };
  });
  const ca = new Map(a.C.map((c) => [c[0], c]));
  const crates = b.C.map((c) => {
    const o = ca.get(c[0]);
    const same = o && o[1] === c[1];
    return { id: c[0], m: c[1], x: same ? lerp(o[2], c[2]) : c[2], y: same ? lerp(o[3], c[3]) : c[3], z: same ? lerp(o[4], c[4]) : c[4] };
  });
  const wa = new Map((a.W || []).map((w) => [w[0], w]));
  const wolves = (b.W || []).map((w) => {
    const o = wa.get(w[0]) || w;
    return { id: w[0], x: lerp(o[1], w[1]), zw: lerp(o[2], w[2]), yaw: lerpA(o[3], w[3]), st: w[4], tg: w[6] };
  });
  const flares = (b.F || []).map((x) => ({ id: x[0], m: x[1], x: x[2], z: x[3], t: x[4] }));
  const me = players.find((p) => p.me) || null;
  const focus = me ? { x: me.x * 0.85, z: me.z } : { x: 0, z: 2 };
  if (me) focus.z = me.on ? me.z * 0.6 : me.z; // à bord, la caméra garde tout le convoi dans le cadre
  const up = {}; UPG_KEYS.forEach((k, i) => { up[k] = (b.up && b.up[i]) | 0; });
  const view = {
    seed: b.sd, diff: b.df, dist: lerp(a.d, b.d), speed: b.sp, fuel: lerp(a.fu, b.fu), burn: b.br, t: b.t, fedTotal: b.ft, phase: b.ph,
    players, crates, wolves, flares, looted: new Set(b.L), me, focus, meId: S.myId,
    mode: b.mo || 'expedition', goal: b.gl || 0, fmax: b.fm || 100, scrap: b.sc | 0, up, radar: up.radar > 0, ns: b.ns | 0,
    stop: b.so || null, ev: b.ev || null, gust: b.gu || 0, win: b.wn | 0,
  };
  view.next = nextInfo(view);
  view.prompt = promptFor(view, b);
  return view;
}

// prochaine étape (gare ou terminus) pour la barre d'objectif
function nextInfo(v) {
  const sd = stationDist(v.mode, v.goal, v.ns);
  if (sd != null && (v.mode !== 'expedition' || sd < v.goal)) return { k: 'station', d: sd, i: v.ns };
  if (v.mode === 'expedition') return { k: 'goal', d: v.goal };
  return null;
}

const kbd = (k) => `<kbd>${input.mode === 'touch' ? { E: '✋', F: '➶', G: '🎆', Espace: '⤒' }[k] || k : k}</kbd>`;
function promptFor(v, snap) {
  const me = v.me; if (!me || v.phase !== 'play') return '';
  if (me.st === 3) {
    const t = Math.ceil(me.tm || 0);
    return me.heat <= 0.5 ? `🥶 Gelé… on te ramène près de la chaudière dans ${t} s` : `❄️ Perdu dans la tempête… retour à bord dans ${t} s`;
  }
  if (me.st === 2) return '';
  const E = v.ev;
  // dangers d'abord
  if (E && E.k === 'aval' && E.t > 0 && !E.hit && !me.on && me.x * E.side > 2.75) return `⚠️ AVALANCHE ! Remonte à bord ou file de l'autre côté de la voie !`;
  const hunter = v.wolves.find((w) => w.st === 1 && w.tg === me.id);
  if (hunter) return me.flares > 0 ? `🐺 Un loup te traque ! ${kbd('G')} fusée éclairante (${me.flares})` : `🐺 Un loup te traque ! Cours vers la chaudière ou un équipier`;
  const hd = Math.hypot(me.x - BOILER.x, me.z - BOILER.z);
  if (me.carry) {
    if (me.on && hd < 2.4) return `${kbd('E')} Jeter le fioul dans la chaudière (+25 %)`;
    if (me.on) return `Porte la caisse à la chaudière · ${kbd('F')} pour la lancer`;
    return `Rattrape le convoi · ${kbd('F')} lance la caisse sur le wagon ou dans le foyer`;
  }
  const near = v.crates.some((c) => c.m !== 2 && (c.m === 1) === !!me.on && Math.hypot(c.x - me.x, (c.m === 0 ? c.z + v.dist : c.z) - me.z) < 1.5);
  if (near && !me.air) return `${kbd('E')} Prendre la caisse`;
  // congère sur la voie
  if (E && E.k === 'drift' && !E.done) {
    const zd = E.zw + v.dist;
    const pg = `<span class="pg"><i style="width:${Math.round((E.prog || 0) * 100)}%"></i></span>`;
    if (!me.on && Math.abs(me.x) < 4.6 && Math.abs(me.z - zd) < 2.9) return me.dig ? `Pelletée après pelletée… ${pg}` : `Maintiens ${kbd('E')} pour déblayer la congère ${pg}`;
    if (v.stop && v.stop.k === 'drift') return `⛔ Congère sur la voie ! Descends devant la locomotive et déblaie-la ${pg}`;
  }
  if (v.stop && v.stop.k === 'station') return `🚉 En gare : fioul sur le quai, chaleur et améliorations · ${kbd('V')} prêt à partir`;
  if (!me.on) {
    const ruins = ruinsFor(snap);
    for (const [, c] of ruins.around(v.dist, 40, 70)) for (const r of c.ruins) {
      if (v.looted.has(r.id)) continue;
      if (Math.hypot(r.spot.x - me.x, r.spot.zw + v.dist - me.z) < 2.4) {
        return me.sp > 0 ? `Fouille… <span class="pg"><i style="width:${Math.round(me.sp * 100)}%"></i></span>` : `Maintiens ${kbd('E')} pour fouiller la ruine`;
      }
    }
    if (me.st === 1) return '❄️ Tu t\'enfonces dans la neige !';
  }
  if (me.heat < 30) return me.on && hd < WARM_R ? '🔥 Tu te réchauffes…' : '🥶 Tu gèles ! Va te réchauffer près de la chaudière';
  if (v.fuel <= 0) return '🔥 La chaudière est éteinte : une caisse, vite !';
  if (me.on && v.fuel < 25) return 'Réservoir bas ! Saute du train et fouille les ruines (lanternes jaunes)';
  return '';
}

// ------------------------------------------------------------------ gare : achats et départ
function atStation() { const v = S.view; return !!(v && v.stop && v.stop.k === 'station' && v.phase === 'play' && !S.menu && !S.endShown); }
function doBuy(k) {
  if (!atStation() || !UPGRADES[k]) return;
  sfx.unlock();
  if (S.role === 'guest') { H.send('host', { t: 'buy', k }); return; }
  const err = S.sim && S.sim.buy(S.myId, k);
  if (err) { hud.toast(err, 2); sfx.play('nope'); }
}
function doVote() {
  if (!atStation()) return;
  if (S.role === 'guest') H.send('host', { t: 'vote' }); else S.sim && S.sim.vote(S.myId);
}
function onKey(k) {
  const m = /^(?:Digit|Numpad)([1-5])$/.exec(k);
  if (m) doBuy(UPG_KEYS[+m[1] - 1]);
  else if (k === 'KeyV') doVote();
}

// ------------------------------------------------------------------ effets (sons, textes flottants)
function fxEvent(e, view) {
  const who = (id) => view.players.find((p) => p.id === id);
  const at = (x, y, z, txt, cls) => { if (!scene) return; const s = scene.toScreen(x, y, z); if (s.front) hud.pop(txt, s.x, s.y, cls); };
  const mine = e.p === S.myId;
  const nm = (id) => who(id)?.name || 'Quelqu\'un';
  switch (e.e) {
    case 'feed': sfx.play('feed'); at(BOILER.x, BOILER.top + 1, BOILER.z, '+25 %', 'fire'); if (e.rescue) hud.toast('La chaudière repart !', 2.5); break;
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
    case 'buy': sfx.play('buy'); hud.toast(`${nm(e.p)} : ${UPGRADES[e.k]?.label || ''} (niv. ${e.l})`, 2.5); break;
    case 'arrive': sfx.play('arrive'); hud.toast('FORT-GIVRE ! Le convoi est arrivé', 4); break;
  }
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
  if (S.lobby || S.endShown) return;
  S.menu = !S.menu;
  if (!S.menu) { hideScreen(); return; }
  screenEl.className = 'screen dim'; screenEl.hidden = false;
  screenEl.innerHTML = menuHtml({ muted: sfx.muted, solo: S.role === 'solo' });
  $('#btnResume').onclick = () => toggleMenu();
  $('#btnSound').onclick = () => { toggleMute(); toggleMenu(); toggleMenu(); };
  $('#btnQuit').onclick = exitToLobby;
}
function toggleMute() { sfx.unlock(); sfx.setMuted(!sfx.muted); $('#btnMute').textContent = sfx.muted ? '🔇' : '🔊'; }

// ambiance musicale : calme en gare, tendue quand le fioul baisse ou que les loups chassent
function musicState(v) {
  if (v.phase !== 'play') return { mode: v.win ? 'win' : 'off' };
  if (v.stop && v.stop.k === 'station') return { mode: 'station' };
  const chase = v.wolves.some((w) => w.st === 1);
  const danger = Math.max(v.fuel < 25 ? 1 - v.fuel / 25 : 0, chase ? 0.8 : 0, v.me && v.me.heat < 30 ? 0.6 : 0, v.ev && v.ev.k === 'aval' && !v.ev.hit && v.ev.t > 0 ? 1 : 0);
  return { mode: 'run', danger };
}

// ------------------------------------------------------------------ boucle
let lastT = performance.now(), prevJump = 0;
function loop(now) {
  if (!S.alive) return;
  raf = requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
  const blocked = S.lobby || S.endShown || S.menu;
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
  if (!view) { if (scene && S.idleView) { S.idleView.t += dt; scene.frame(S.idleView, dt); } sfx.update(dt, 0, 1, { mode: S.lobby ? 'station' : 'off' }); return; }
  S.view = view;
  // coups de pelle tant qu'on déblaie
  if (view.me && view.me.dig) { S.digT = (S.digT || 0) - dt; if (S.digT <= 0) { S.digT = 0.55; sfx.play('shovel'); scene && scene.burst(view.me.x, 0.4, view.me.z - 1.2, 4, 1, 2.5); } } else S.digT = 0;
  scene.frame(view, dt);
  hud.update(view, scene, dt);
  sfx.update(dt, view.speed, (view.diff === 'blizzard' ? 1.3 : 1) * (view.gust > 0 ? 1.8 : 1), musicState(view));
  // fin : quelques secondes de convoi immobile, puis le bilan
  if (view.phase !== 'play' && !S.lobby) {
    if (!S.endAt) S.endAt = now;
    if (now - S.endAt > 2500) showEnd(S.last);
  } else S.endAt = 0;
}
