// Island Rush — démarrage et boucle de jeu. L'île vient de sa graine (engine/map.js), le monde solide
// d'engine/world.js, la partie d'engine/sim.js (pas fixe de 1/60 s), les bots d'engine/ai.js ; la vue 3D de view/.
// En solo, la partie tourne ici. À plusieurs, l'hôte la fait tourner (bots compris) et envoie son état (engine/net.js) ;
// chaque invité tient une copie à jour, prédit son propre déplacement, dessine les autres un peu en retard et envoie
// ses commandes. Si l'hôte s'en va, le Hub en désigne un autre qui reprend la partie là où elle en était.
// Le jeu ne parle jamais au réseau directement : tout passe par HubBridge.
import { generateMap, ILE } from './engine/map.js';
import { buildWorld } from './engine/world.js';
import { MOVE } from './engine/player.js';
import { createSim, DT } from './engine/sim.js';
import { WEAPONS, ITEMS, itemLabel, MATERIALS } from './engine/items.js';
import { createBuild, slotFor, COST, PIECES } from './engine/build.js';
import { createAI } from './engine/ai.js';
import { snapshot, applySnapshot, mirrorEvent, fullState, applyFull, cleanInput, predictStep, MODES } from './engine/net.js';
import { createScene } from './view/scene.js';
import { createActors } from './view/actors.js';
import { createFx } from './view/fx.js';
import { createHud } from './view/hud.js';
import { createBuilds } from './view/builds.js';
import { createSound } from './view/sound.js';
import { Input } from './input.js';
import * as THREE from '../shared/vendor/three/three.module.min.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug');
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const breathe = () => new Promise((r) => setTimeout(r, 0));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
const BOT_NAMES = ['Hugo', 'Léa', 'Malo', 'Inès', 'Noah', 'Zoé', 'Sacha', 'Lina', 'Timéo', 'Jade', 'Nino', 'Rose', 'Eliott', 'Mila', 'Gabin',
  'Alma', 'Robin', 'Nora', 'Basile', 'Lou', 'Oscar', 'Iris', 'Marius', 'Ambre', 'Félix', 'Clara', 'Jules', 'Anna', 'Paul', 'Elsa'];
const LEVEL_LABEL = { facile: 'faciles', normal: 'normaux', difficile: 'coriaces' };
const INTERP = 0.1;          // invités : les autres sont dessinés un dixième de seconde en arrière
const HOST_SILENCE = 3, HOST_GIVEUP = 15;
const MATS = ['bois', 'pierre', 'metal'];

const S = {
  role: 'solo', me: 'moi', settings: {}, map: null, world: null, sim: null, scene: null, actors: null, fx: null, hud: null, input: null, sfx: null,
  yaw: 0, pitch: -0.1, camD: 3.8, sel: 0, cnt: { jump: 0, use: 0, reload: 0, drop: 0 }, prev: new Map(),
  acc: 0, last: 0, t: 0, ms: 16, slow: 0, running: false, spect: null, shake: 0, fov: 72, ended: false, reported: false, startedAt: 0,
  cam: { x: 0, y: 0, z: 0 }, loaded: false,
  build: null, mat: 'bois', // mode construction : pièce choisie (mur, sol, escalier) et matériau
  // réseau
  run: 0, seed: 0, roster: [], netEv: [], tick: 0, lastSend: -99, snapN: 0,
  gotHost: false, hiT: 0, snapAt: 0, off: null, buf: [], hist: [], seq: 0, sendN: 0, predJump: 0, po: { x: 0, y: 0, z: 0 }, warned: false, evq: [],
};

function progress(label, f) {
  const t = $('#loadTxt'), b = $('#loadBar');
  if (t) t.textContent = label;
  if (b) b.style.width = Math.round(f * 100) + '%';
}
const net = () => H.embedded && H.players.length > 1;

async function boot(info) {
  S.role = H.embedded ? (info.role === 'guest' ? 'guest' : 'host') : 'solo';
  S.me = H.embedded ? info.myId : 'moi';
  const prof = window.DDProfile ? window.DDProfile.load() : { name: 'Moi', color: '#ff4b2b' };
  const meP = H.embedded ? H.players.find((p) => p.id === info.myId) : null;
  const set = info.settings || {};
  S.settings = {
    time: QS.get('time') || set.time || 'jour',
    mode: QS.get('mode') || set.mode || 'partie',
    places: +(QS.get('places') || set.places || 24),
    level: QS.get('level') || set.level || 'normal',
  };
  S.meInfo = { id: S.me, name: meP ? meP.name : prof.name || 'Moi', color: meP ? meP.color : prof.color };
  H.on('msg', onMsg);
  H.on('roster', onRoster);

  progress('Génération de l\'île', 0.05); await breathe(); await breathe();
  S.map = generateMap(+QS.get('graine') || ILE);
  progress('Murs, meubles et escaliers', 0.2); await breathe();
  S.world = buildWorld(S.map);
  try {
    S.scene = await createScene($('#stage'), S.map, { time: S.settings.time, progress, onLost: () => toast('Affichage 3D interrompu : recharge la page', 8) });
  } catch (e) {
    console.error(e);
    progress('Impossible de lancer la 3D sur cet appareil', 1);
    return;
  }
  progress('Carte', 0.95); await breathe();
  S.hud = createHud(S.map, { onTeleport: S.settings.mode === 'exploration' && S.role !== 'guest' ? teleport : null, project });
  S.hud.showFps(DEBUG);
  S.sfx = createSound();
  S.sfx.island(S.map.center, S.map.islandR);
  S.input = new Input(S.scene.canvas, { key: onKey, lock: onLock, wheel: onWheel });
  loadOpts();
  $('#phaseTxt').textContent = S.settings.mode === 'exploration' ? 'Exploration, sans combat' : `${S.settings.places} joueurs · tempête`;
  S.loaded = true;
  if (H.embedded) H.signalReady();
  showScreen(S.role === 'guest' ? 'attente' : 'start');
  S.running = true;
  S.last = performance.now();
  requestAnimationFrame(loop);
  if (DEBUG) {
    window.__royale = S;
    // débogage : faire avancer le jeu de n images de 1/60 s (utile quand l'onglet est caché et ne dessine plus)
    S.advance = (n = 1) => { for (let i = 0; i < n; i++) { const t = S.last + 1000 / 60; loop(t); } };
    S.start = startMatch;
  }
}

// ------------------------------------------------------------------ une partie
function humans() {
  if (!H.embedded) return [{ ...S.meInfo }];
  return H.players.map((p, i) => ({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[i % PALETTE.length] }));
}
// hôte (ou solo) : on remplit la montgolfière (les joueurs du salon, puis des bots jusqu'au nombre de places)
function startMatch() {
  if (S.role === 'guest' || S.sim) return;
  const roster = humans().map((h) => ({ ...h, bot: false }));
  if (S.settings.mode !== 'exploration') {
    const n = clamp(S.settings.places, 2, 30) - roster.length;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) roster.push({ id: 'bot' + i, name: names[i % names.length], color: PALETTE[(i + roster.length) % PALETTE.length], bot: true, level: S.settings.level });
  }
  newMatch({ run: Date.now(), seed: (Math.random() * 1e9) | 0, roster, mode: S.settings.mode });
  if (H.embedded) H.send('all', { t: 'go', ...matchInfo() });
  showScreen(null);
  S.input.lock();
}
const matchInfo = () => ({ run: S.run, seed: S.seed, roster: S.roster, mode: S.sim.S.mode });
function newMatch({ run, seed, roster, mode, mirror = false }) {
  S.run = run; S.seed = seed; S.roster = roster;
  const city = S.map.pois.find((p) => p.kind === 'ville');
  const pl = city && S.map.plazas.find((q) => q.x0 >= city.rect.x0 && q.x1 <= city.rect.x1 && q.z0 >= city.rect.z0 && q.z1 <= city.rect.z1);
  const start = pl ? { x: (pl.x0 + pl.x1) / 2 + 6, z: (pl.z0 + pl.z1) / 2 + 6 } : null;
  S.sim = createSim({ map: S.map, world: S.world, seed, roster, mode, start });
  S.startedAt = Date.now();
  S.actors = createActors(S.scene.scene, S.sim);
  S.fx = createFx(S.scene.scene);
  S.buildApi = createBuild(S.sim, S.map, S.world);
  S.builds = createBuilds(S.scene.scene);
  // les bots ne réfléchissent que là où la partie tourne
  S.ai = !mirror && mode !== 'exploration' ? createAI(S.sim, S.map, S.world) : null;
  for (const P of S.sim.S.players.values()) S.prev.set(P.id, { x: P.x, y: P.y, z: P.z, yaw: P.yaw });
  if (S.sim.S.flight) S.yaw = Math.atan2(S.sim.S.flight.ux, S.sim.S.flight.uz);
  S.sel = 0; S.ended = false; S.reported = false; S.spect = null; S.build = null;
  S.cnt = { jump: 0, use: 0, reload: 0, drop: 0 };
  S.netEv = []; S.tick = 0; S.lastSend = -99; S.buf = []; S.hist = []; S.seq = 0; S.predJump = 0; S.po = { x: 0, y: 0, z: 0 }; S.off = null; S.evq = [];
  const P = me();
  if (P) { P.netInit = true; P.last = { ...P.last, jump: 0, use: 0, reload: 0, drop: 0, shoot: S.input.shots }; }
  $('#hud').hidden = false;
  buildBar();
}
function teleport(x, z) {
  const P = me();
  if (!P) return;
  Object.assign(P, { x, z, y: S.world.support(x, z, 400) + 0.05, vx: 0, vy: 0, vz: 0, mode: 'sol' });
  S.prev.set(P.id, { x: P.x, y: P.y, z: P.z, yaw: P.yaw });
  S.hud.toggleMap(false);
}
function project(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(S.scene.camera);
  const c = S.scene.canvas;
  return { x: (v.x * 0.5 + 0.5) * c.clientWidth, y: (-v.y * 0.5 + 0.5) * c.clientHeight, on: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
}

// ------------------------------------------------------------------ commandes
function me() { return S.sim ? S.sim.player(S.me) : null; }
function onKey(code, key) {
  if (!S.sim) return;
  const P = me();
  if (key === 'm' || code === 'KeyM') { S.hud.toggleMap(); if (S.hud.mapOpen) S.input.unlock(); return; }
  if (code === 'Escape' && S.hud.mapOpen) { S.hud.toggleMap(false); return; }
  if (key === 'h') { $('#hints').classList.toggle('off'); return; }
  if (!S.input.playing) return;
  if ((!P || !P.alive) && code === 'Space') { nextSpectate(); return; }
  if (key === 'e') S.cnt.use++;
  else if (key === 'r') S.cnt.reload++;
  else if (key === 'g') S.cnt.drop++;
  // construction : F mur, V sol, C escalier (encore une fois pour sortir), T matériau
  else if (key === 'f' || key === 'v' || key === 'c') { const k = { f: 'mur', v: 'sol', c: 'escalier' }[key]; S.build = S.build === k ? null : k; buildBar(); S.sfx.play('clic'); }
  else if (key === 't') { S.mat = MATS[(MATS.indexOf(S.mat) + 1) % MATS.length]; buildBar(); S.sfx.play('clic'); }
  else if (/^Digit[1-5]$/.test(code)) { S.sel = +code.slice(5); S.build = null; buildBar(); }
  else if (code === 'Digit0' || code === 'Backquote' || key === 'x' || key === '²') { S.sel = 0; S.build = null; buildBar(); }
}
function buildBar() {
  const el = $('#buildbar');
  el.hidden = !S.build;
  if (!S.build) return;
  const P = me();
  el.innerHTML = Object.entries(PIECES).map(([k, l]) => `<span class="${k === S.build ? 'on' : ''}"><kbd>${{ mur: 'F', sol: 'V', escalier: 'C' }[k]}</kbd>${l}</span>`).join('')
    + `<span class="mat" style="--c:${MATERIALS[S.mat].color}"><kbd>T</kbd>${MATERIALS[S.mat].label} · ${P ? P.mats[S.mat] : 0}</span>`;
}
function onWheel(dir) {
  const P = me();
  if (!P) return;
  if (S.build) { const ks = Object.keys(PIECES); S.build = ks[(ks.indexOf(S.build) + dir + ks.length) % ks.length]; buildBar(); return; }
  // on passe d'un objet tenu au suivant (l'outil et les cases occupées)
  const occupied = [0, ...P.inv.map((s, i) => (s ? i + 1 : -1)).filter((i) => i > 0)];
  const i = occupied.indexOf(S.sel);
  S.sel = occupied[(i + dir + occupied.length) % occupied.length];
}
function onLock(locked, free) {
  if (locked) { showScreen(null); S.hud.toggleMap(false); S.sfx.unlock(); if (free) toast('Souris non capturée : maintiens le clic pour regarder', 4); return; }
  if (!S.hud.mapOpen && !S.ended && S.sim) showScreen('pause');
}
function myInput(on, ax) {
  const inp = S.input;
  return { mx: ax.mx, mz: ax.mz, yaw: S.yaw, pitch: S.pitch, fire: !!(on && inp.fire), aim: !!(on && inp.aim), sprint: !!(on && inp.sprint), crouch: !!(on && inp.crouch),
    jump: S.cnt.jump, use: S.cnt.use, reload: S.cnt.reload, shoot: inp.shots, drop: S.cnt.drop, sel: S.sel, build: on ? S.build : null, mat: S.mat };
}

// ------------------------------------------------------------------ boucle
function loop(now) {
  if (!S.running) return;
  requestAnimationFrame(loop);
  const dt = clamp((now - S.last) / 1000, 0, 0.1);
  S.last = Math.max(S.last, now); S.t += dt;
  S.ms = S.ms * 0.95 + dt * 1000 * 0.05;
  if (S.role === 'guest') guestNet(dt);
  if (!S.sim) { idleFrame(dt); return; }
  const inp = S.input, P = me();
  const [mx, my] = inp.takeMouse();
  const scoped = isScoped(P);
  const sens = scoped ? 0.25 : inp.aim ? 0.6 : 1;
  S.yaw -= mx * sens; S.pitch = clamp(S.pitch - my * sens, -1.35, 1.25);
  const on = !!(inp.playing && !S.hud.mapOpen && P && P.alive);
  if (on && inp.takeJump()) S.cnt.jump++;
  const ax = on ? inp.axes() : { mx: 0, mz: 0 };
  const events = S.role === 'guest' ? guestSteps(dt, on, ax) : hostSteps(dt, on, ax);
  const a = S.acc / DT;
  const rt = S.role === 'guest' && S.off != null ? performance.now() / 1000 - S.off - INTERP : 0;
  const disp = (Q) => {
    if (S.role === 'guest' && Q.id !== S.me) return remotePos(Q, rt);
    const pr = S.prev.get(Q.id) || Q, po = Q.id === S.me ? S.po : null;
    return { x: pr.x + (Q.x - pr.x) * a + (po ? po.x : 0), y: pr.y + (Q.y - pr.y) * a + (po ? po.y : 0), z: pr.z + (Q.z - pr.z) * a + (po ? po.z : 0), yaw: Q.id === S.me && Q.alive ? S.yaw : Q.yaw };
  };
  handleEvents(events);
  // caméra
  const view = cameraFor(P, disp, dt);
  S.actors.update(dt, S.t, view.pos, disp, scoped ? S.me : null);
  S.fx.update(dt, S.t, S.sim, S.sim.S.storm && S.sim.S.storm.cur, view.pos);
  // fantôme de la pièce à construire
  if (S.build && P && P.alive && P.mode === 'sol') {
    const slot = slotFor(P.x, P.y, P.z, S.yaw, S.pitch, S.build, S.buildApi.pieces);
    S.builds.ghost(slot, S.buildApi.canPlace(slot) && P.mats[S.mat] >= COST);
  } else S.builds.ghost(null);
  S.builds.update(dt, S.buildApi.pieces);
  const cam = S.scene.camera, fov = scoped ? 72 / 4 : inp.aim && P && P.alive && heldWeapon(P) ? 72 / (WEAPONS[heldWeapon(P).w].zoom || 1.2) : 72;
  S.fov += (fov - S.fov) * (1 - Math.exp(-14 * dt));
  if (Math.abs(cam.fov - S.fov) > 0.01) { cam.fov = S.fov; cam.updateProjectionMatrix(); }
  S.scene.frame(dt, view, view.focus);
  // interface
  const focusP = P && P.alive ? P : S.sim.player(S.spect) || P;
  if (focusP) {
    const fp = disp(focusP);
    S.hud.maps(S.t, fp, focusP === P ? S.yaw : focusP.yaw, S.ms);
    S.hud.player(focusP, { alive: S.sim.alive().length });
    S.hud.storm(S.sim.S.storm, fp);
  }
  S.hud.flight(S.sim.S.phase === 'vol' && S.sim.S.flight ? flightLine() : null);
  S.hud.frame(dt);
  S.hud.crosshair(P ? spreadOf(P) : 0, scoped);
  S.hud.spectate(P && P.alive ? null : S.sim.player(S.spect) && !S.ended ? S.sim.player(S.spect).name : null);
  if ((S.tick2 = (S.tick2 || 0) + 1) % 6 === 0) showPrompt();
  S.sfx.update(dt, { cam: view.pos, yaw: view.look ? Math.atan2(view.look.x - view.pos.x, view.look.z - view.pos.z) : S.yaw, sim: S.sim, me: P, disp, storm: stormGap(focusP) });
  // qualité automatique : si l'image prend plus de 24 ms pendant 3 s, on allège
  if (S.ms > 24 && S.t > 6) { S.slow += dt; if (S.slow > 3) { S.slow = 0; const w = S.scene.lowerQuality(); if (w && DEBUG) toast('Qualité baissée : ' + w, 2); } }
  else S.slow = Math.max(0, S.slow - dt);
}
function savePrev(Q) { const pr = S.prev.get(Q.id); if (pr) { pr.x = Q.x; pr.y = Q.y; pr.z = Q.z; pr.yaw = Q.yaw; } else S.prev.set(Q.id, { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw }); }
// hôte et solo : la partie avance ici ; vingt fois par seconde, son état part chez les invités
function hostSteps(dt, on, ax) {
  const out = [];
  S.acc += dt;
  let steps = 0;
  while (S.acc >= DT && steps < 6) {
    for (const Q of S.sim.S.players.values()) savePrev(Q);
    if (me()) S.sim.input(S.me, myInput(on, ax));
    S.sim.step(DT);
    const ev = S.sim.takeEvents();
    out.push(...ev);
    if (net()) S.netEv.push(...ev);
    S.acc -= DT; steps++; S.tick++;
  }
  if (S.acc > DT) S.acc = 0;
  if (net() && (S.tick - S.lastSend >= 3 || (S.sim.S.phase === 'fin' && S.netEv.length))) {
    S.lastSend = S.tick;
    // volatil quand il ne transporte pas d'événements : sauté si la connexion sature
    H.send('all', { t: 's', run: S.run, s: snapshot(S.sim, S.snapN++ % 20 === 0 ? 'tous' : 'humains'), e: S.netEv }, { volatile: !S.netEv.length });
    S.netEv = [];
  }
  return out;
}
// invité : son joueur avance tout de suite (prédiction), le reste vient de l'hôte
function guestSteps(dt, on, ax) {
  S.acc += dt;
  let steps = 0;
  const P = me();
  while (S.acc >= DT && steps < 6) {
    const h = myInput(on, ax);
    const jump = h.jump !== S.predJump; S.predJump = h.jump;
    S.seq++;
    if (P) { savePrev(P); predictStep(P, { ...h, jump }, S.world, DT); }
    S.hist.push({ q: S.seq, mx: h.mx, mz: h.mz, yaw: h.yaw, pitch: h.pitch, sprint: h.sprint, crouch: h.crouch, aim: h.aim, jump });
    if (S.hist.length > 180) S.hist.shift();
    if (++S.sendN >= 2 && P) {
      S.sendN = 0;
      const pings = H.pings || {}, lag = INTERP + ((pings[S.me] || 60) + (pings[H.info.hostId] || 60)) / 2000;
      H.send('host', { t: 'i', q: S.seq, lag: Math.min(0.3, lag), ...h });
    }
    S.acc -= DT; steps++;
  }
  if (S.acc > DT) S.acc = 0;
  // entre deux instantanés : la montgolfière avance, les constructions durcissent, l'écart de prédiction se résorbe
  const SS = S.sim.S;
  if (SS.flight && S.lastSnap) SS.flight.t = S.lastSnap.ft + Math.max(0, performance.now() / 1000 - S.snapAt);
  if (SS.hooks.step) SS.hooks.step(dt);
  const k = Math.exp(-dt * 10); S.po.x *= k; S.po.y *= k; S.po.z *= k;
  const out = S.evq; S.evq = [];
  return out;
}
// invités : position affichée d'un autre joueur, interpolée entre deux instantanés
function remotePos(Q, rt) {
  const b = S.buf;
  if (!b.length) return { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw };
  let A = b[b.length - 1], B = A;
  for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { A = b[i]; B = b[i + 1]; break; }
  const pa = A.P.get(Q.id), pb = B.P.get(Q.id);
  if (!pa || !pb) return { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw };
  const f = A === B ? 0 : clamp((rt - A.t) / (B.t - A.t), 0, 1);
  let dy = pb[3] - pa[3]; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  return { x: pa[0] + (pb[0] - pa[0]) * f, y: pa[1] + (pb[1] - pa[1]) * f, z: pa[2] + (pb[2] - pa[2]) * f, yaw: pa[3] + dy * f };
}
// salon (pas encore de partie) : la caméra tourne lentement au-dessus de l'île
function idleFrame(dt) {
  const C = S.map.center, a = S.t * 0.04, R = S.map.islandR * 0.9;
  const pos = { x: C + Math.cos(a) * R, y: 190, z: C + Math.sin(a) * R };
  const focus = { x: C, y: 20, z: C };
  S.scene.frame(dt, { pos, look: focus, focus }, focus);
}
function heldWeapon(P) { const it = P.sel > 0 ? P.inv[P.sel - 1] : null; return it && it.t === 'arme' ? it : null; }
function isScoped(P) { const w = P && P.alive && heldWeapon(P); return !!(w && w.w === 'sniper' && S.input && S.input.aim && P.mode === 'sol'); }
function spreadOf(P) {
  const it = heldWeapon(P);
  if (!it) return 0.01;
  const W = WEAPONS[it.w], moving = Math.hypot(P.vx, P.vz) > 1;
  return (S.input.aim ? W.spread[1] : W.spread[0]) * (moving ? 1.5 : 1) * (P.crouch ? 0.75 : 1) * (P.ground ? 1 : 2) + (P.bloom || 0);
}
function flightLine() {
  const f = S.sim.S.flight;
  return { x0: f.x0, z0: f.z0, x1: f.x0 + f.ux * f.len, z1: f.z0 + f.uz * f.len };
}
// distance au bord de la tempête (négative : dehors), pour le son
function stormGap(P) {
  const st = S.sim.S.storm;
  if (!st || !st.cur || !P) return 999;
  return st.cur.r - Math.hypot(P.x - st.cur.x, P.z - st.cur.z);
}

// caméra : par-dessus l'épaule droite (au sol), loin derrière (montgolfière, chute libre), à l'œil (lunette)
function cameraFor(P, disp, dt) {
  const W = S.world;
  let target = P;
  if (!P || !P.alive) {
    if (!S.sim.player(S.spect) || !S.sim.player(S.spect).alive) S.spect = pickSpectate();
    target = S.sim.player(S.spect) || P;
  }
  if (!target) { const C = S.map.center; return { pos: { x: C, y: 200, z: C + 300 }, look: { x: C, y: 0, z: C }, focus: { x: C, y: 0, z: C } }; }
  const d = disp(target);
  const yaw = target === P ? S.yaw : d.yaw, pitch = target === P ? S.pitch : clamp(target.pitch || 0, -0.6, 0.6);
  const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  let dist = S.camD, sh = 0.62, headY;
  if (target.mode === 'ballon') {
    // autour de la montgolfière, à la souris, en regardant l'île
    const b = S.sim.balloonPos(), pp = Math.min(S.pitch, -0.15), cy2 = Math.cos(pp), D = 42;
    const ox = Math.sin(S.yaw) * cy2, oy = Math.sin(pp), oz = Math.cos(S.yaw) * cy2;
    return look(b.x - ox * D, b.y + 14 - oy * D, b.z - oz * D, ox, oy, oz, b);
  }
  if (target.mode === 'chute' || target.mode === 'planeur') { dist = 7.5; sh = 0; headY = d.y + 1.6; }
  else headY = target.swim ? d.y + MOVE.swimDepth + 0.6 : d.y + (target.crouch ? MOVE.hc : MOVE.h) - 0.25;
  if (target === P && S.input.aim && heldWeapon(P)) dist = 2.1;
  if (isScoped(P) && target === P) { dist = 0; }
  // l'épaule ne doit pas entrer dans un mur
  const side = sh ? W.ray(d.x, headY, d.z, rx, 0, rz, sh, 0.12) : 0;
  const px = d.x + rx * side, pz = d.z + rz * side, py = headY;
  const free = dist ? W.ray(px, py, pz, -fx, -fy, -fz, dist, 0.15) : 0;
  const dd = dist ? Math.max(0.45, free - 0.1) : 0;
  let cx = px - fx * dd, cy = py - fy * dd, cz = pz - fz * dd;
  const wl = W.waterLevel(cx, cz);
  if (cy < wl + 0.35) cy = wl + 0.35;
  // secousse des explosions proches
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt * 2.5); cx += (Math.random() - 0.5) * S.shake * 0.4; cy += (Math.random() - 0.5) * S.shake * 0.4; cz += (Math.random() - 0.5) * S.shake * 0.4; }
  return look(cx, cy, cz, fx, fy, fz, d);
  function look(x, y, z, a, b, c, focus) {
    S.cam = { x, y, z };
    return { pos: { x, y, z }, look: { x: x + a * 30, y: y + b * 30, z: z + c * 30 }, focus: { x: focus.x, y: focus.y, z: focus.z } };
  }
}
function pickSpectate() {
  const P = me();
  const killer = P && P.hitBy != null && S.sim.player(P.hitBy);
  if (killer && killer.alive) return killer.id;
  const live = S.sim.alive();
  return live.length ? live[0].id : null;
}
function nextSpectate() {
  const live = S.sim.alive();
  if (!live.length) return;
  const i = live.findIndex((p) => p.id === S.spect);
  S.spect = live[(i + 1) % live.length].id;
}

// ------------------------------------------------------------------ réseau : messages
function onMsg(from, m) {
  if (!S.loaded || !m || typeof m !== 'object') return;
  if (S.role !== 'guest') {
    if (m.t === 'hi') {
      // un invité arrive (ou revient) : la partie en cours et tout ce qui a changé depuis le début
      if (S.sim && !S.ended) H.send(from, { t: 'go', ...matchInfo(), full: fullState(S.sim, S.world, S.buildApi) });
      else H.send(from, { t: 'salon' });
    } else if (m.t === 'i' && S.sim) {
      const P = S.sim.player(from); // `from` vient du Hub : seule identité fiable
      if (!P || P.bot) return;
      const inp = cleanInput(m);
      // premier message : ses compteurs d'appuis deviennent la référence (pas de tir fantôme)
      if (!P.netInit) { P.netInit = true; for (const k of ['jump', 'use', 'reload', 'shoot', 'drop']) P.last[k] = inp[k]; }
      S.sim.input(from, inp);
      P.q = m.q | 0; P.lag = clamp(+m.lag || 0, 0, 0.3);
    }
    return;
  }
  if (from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  S.gotHost = true;
  if (m.t === 'salon') { if (!S.sim) showScreen('attente'); return; }
  if (m.t === 'go') {
    if (S.sim && m.run !== S.run) { location.reload(); return; } // nouvelle partie : on repart d'une île neuve
    if (S.sim) return;
    newMatch({ run: m.run, seed: m.seed, roster: m.roster, mode: m.mode, mirror: true });
    if (m.full) {
      applyFull(S.sim, S.world, S.buildApi, m.full);
      for (const k of m.full.broken) hideBroken(k);
      for (const p of S.buildApi.pieces.values()) S.builds.add(p);
      for (const d of S.world.doors.values()) if (d.open && !d.dead) S.scene.interior.setDoor(d.id, true);
    }
    S.snapAt = performance.now() / 1000;
    showScreen(me() ? 'rejoint' : 'spectateur');
    return;
  }
  if (m.t === 's' && S.sim && m.run === S.run && m.s) receiveSnap(m.s, m.e || []);
}
function receiveSnap(s, events) {
  const now = performance.now() / 1000;
  const o = now - s.t;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snapAt = now; S.lastSnap = s;
  // le monde de la copie d'abord (portes, butin, constructions), puis l'état des joueurs
  for (const e of events) mirrorEvent(S.sim, S.world, S.buildApi, e);
  const meP = me(), wasMode = meP && meP.mode;
  applySnapshot(S.sim, s, S.me);
  S.buf.push({ t: s.t, P: new Map(s.P.map((r) => [r[0], [r[1], r[2], r[3], r[4]]])) });
  if (S.buf.length > 12) S.buf.shift();
  reconcile(s, wasMode);
  S.evq.push(...events);
}
// prédiction : on repart de l'état de l'hôte et on rejoue les commandes qu'il n'a pas encore appliquées
function reconcile(s, wasMode) {
  const P = me(), row = P && s.P.find((r) => r[0] === S.me);
  if (!row) return;
  const old = { x: P.x + S.po.x, y: P.y + S.po.y, z: P.z + S.po.z };
  Object.assign(P, { x: row[1], y: row[2], z: row[3], vx: row[6], vy: row[7], vz: row[8], mode: MODES[row[10]] });
  S.hist = S.hist.filter((h) => h.q > row[18]);
  for (const h of S.hist) predictStep(P, h, S.world, DT);
  // petit écart : résorbé en douceur ; grand écart (téléportation, saut de la montgolfière) : on suit l'hôte
  const dx = old.x - P.x, dy = old.y - P.y, dz = old.z - P.z;
  if (wasMode === P.mode && Math.hypot(dx, dy, dz) < 3) S.po = { x: dx, y: dy, z: dz };
  else { S.po = { x: 0, y: 0, z: 0 }; savePrev(P); }
}
// invité : on redemande l'état tant que l'hôte n'a rien envoyé ; hôte muet trop longtemps : on prévient, puis on arrête
function guestNet(dt) {
  if (!S.loaded) return;
  S.hiT -= dt;
  if (!S.gotHost && S.hiT <= 0) { S.hiT = 1.5; H.send('host', { t: 'hi' }); }
  if (!S.sim || S.ended) return;
  const silent = performance.now() / 1000 - S.snapAt;
  if (silent > HOST_SILENCE) {
    if (!S.warned) { S.warned = true; toast('Liaison avec l\'hôte interrompue…', 4); }
    if (silent > HOST_GIVEUP) { S.ended = true; S.input.unlock(); showScreen('perdu'); }
  } else S.warned = false;
}
function onRoster() {
  if (!S.loaded) return;
  // le Hub m'a désigné comme nouvel hôte : la partie repart de ma copie
  if (S.role === 'guest' && H.info.role === 'host') { becomeHost(); return; }
  if (S.role !== 'host') { if (!S.sim && !$('#screen').hidden) showScreen('attente'); return; }
  if (!S.sim) { if (!$('#screen').hidden) showScreen('start'); return; }
  // départ (onglet fermé, retour au salon) : éliminé, son sac tombe
  const ids = new Set(H.players.map((p) => p.id));
  for (const P of S.sim.S.players.values()) if (!P.bot && P.id !== S.me && !ids.has(P.id) && P.alive) S.sim.leave(P.id);
}
function becomeHost() {
  S.role = 'host';
  if (!S.sim || S.ended) { if (S.sim) location.reload(); else showScreen('start'); return; }
  const SS = S.sim.S;
  SS.nextItem = Math.max(SS.nextItem, ...[...SS.items.keys()].map((k) => k + 1));
  SS.nextProj = Math.max(SS.nextProj, ...SS.pads.map((p) => p.id + 1)) + 1000;
  SS.projectiles = [];
  for (const P of SS.players.values()) {
    P.netInit = false; P.ai = null; P.use = null; P.trail = [];
    if (P.id === S.me) { P.netInit = true; P.last = { ...P.last, jump: S.cnt.jump, use: S.cnt.use, reload: S.cnt.reload, drop: S.cnt.drop, shoot: S.input.shots }; }
  }
  S.ai = SS.mode !== 'exploration' ? createAI(S.sim, S.map, S.world) : null;
  S.acc = 0; S.hist = []; S.po = { x: 0, y: 0, z: 0 }; S.lastSend = -99;
  toast('L\'hôte est parti : tu reprends la partie', 4);
  onRoster();
}

// ------------------------------------------------------------------ événements de la partie
function nameOf(id) { const p = S.sim.player(id); return p ? p.name : '?'; }
const CAUSES = { fusil: 'au fusil d\'assaut', pompe: 'au fusil à pompe', pistolet: 'au pistolet', smg: 'au pistolet-mitrailleur', sniper: 'au fusil de précision', roquette: 'au lance-roquettes',
  grenade: 'à la grenade', tempete: 'par la tempête', chute: 'par une chute', pioche: 'à la pioche', depart: '(parti)' };
function hideBroken(k) {
  const rest = k.slice(2);
  if (k[0] === 'p') { S.scene.props.hide(+rest); S.scene.forest.hide(+rest); }
  else if (k[0] === 'w') S.scene.structures.hideWall(rest);
  else if (k[0] === 'f') S.scene.interior.hideFurn(+rest);
  else if (k[0] === 'd') S.scene.interior.hideDoor(+rest);
  else if (k[0] === 'b') S.builds.remove(+rest);
}
function handleEvents(list) {
  const P = me();
  for (const e of list) {
    switch (e.e) {
      case 'feu': {
        const h = S.actors.heroOf(e.p), Q = S.sim.player(e.p);
        if (h && Q) { h.shot(); if (h.held) { const v = new THREE.Vector3(); h.held.getWorldPosition(v); v.x += Math.sin(Q.yaw) * 0.5; v.z += Math.cos(Q.yaw) * 0.5; S.fx.muzzleFlash(v); } }
        if (Q) S.sfx.shot(e.w, Q, e.p === S.me);
        break;
      }
      case 'tir': {
        const h = S.actors.heroOf(e.p);
        let muzzle = null;
        if (h && h.held && e.p !== S.me) { muzzle = new THREE.Vector3(); h.held.getWorldPosition(muzzle); }
        S.fx.shot(e.from, e.to, e.w, e.hit, muzzle);
        if (e.hit === 1 && e.k === 0) S.sfx.at('impact', e.to[0], e.to[1], e.to[2], 0.5);
        break;
      }
      case 'degat': {
        if (e.by === S.me && e.to !== S.me) {
          const Q = S.sim.player(e.to);
          S.hud.hitMarker(e.head, Q && !Q.alive);
          S.hud.damageNumber(e.x, e.y, e.z, e.n, e.head, e.sh);
          S.sfx.play(e.head ? 'tete' : e.sh ? 'bouclier' : 'touche');
        }
        if (e.to === S.me) {
          if (e.by != null) { const A = S.sim.player(e.by); if (A && P) { const ang = Math.atan2(A.x - P.x, A.z - P.z) - S.yaw; S.hud.hurtFrom(-ang); } }
          S.sfx.play(e.cause === 'tempete' ? 'tempete' : 'aie');
        }
        break;
      }
      case 'elim': {
        const killer = e.by != null ? `<b>${esc(nameOf(e.by))}</b>` : '';
        const icon = (id) => (S.sim.player(id) && S.sim.player(id).bot ? ' 🤖' : '');
        S.hud.feedLine(e.by != null ? `${killer}${icon(e.by)} a éliminé <b>${esc(nameOf(e.to))}</b>${icon(e.to)} ${CAUSES[e.cause] || ''}` : `<b>${esc(nameOf(e.to))}</b>${icon(e.to)} éliminé ${CAUSES[e.cause] || ''}`);
        if (e.to === S.me) {
          S.hud.say(`Éliminé${e.by != null ? ' par ' + esc(nameOf(e.by)) : ''}<small>${e.place}${e.place === 1 ? 'er' : 'e'} sur ${S.sim.S.players.size} · <kbd>Espace</kbd> : regarder un autre joueur</small>`, 5);
          S.spect = e.by != null && S.sim.player(e.by) && S.sim.player(e.by).alive ? e.by : pickSpectate();
          S.sfx.play('elimine');
        } else if (e.by === S.me) { S.hud.say(`Tu as éliminé <b>${esc(nameOf(e.to))}</b><small>${e.left} encore en vie</small>`, 2.5); S.sfx.play('elimination'); }
        break;
      }
      case 'boum': {
        S.fx.boom(e.x, e.y, e.z, e.r, e.kind);
        const d = Math.hypot(e.x - S.cam.x, e.y - S.cam.y, e.z - S.cam.z);
        if (d < 30) S.shake = Math.max(S.shake, (1 - d / 30) * 1.2);
        S.sfx.at(e.kind === 'souffle' ? 'souffle' : 'boum', e.x, e.y, e.z, 1);
        break;
      }
      case 'porte': {
        S.scene.interior.setDoor(e.id, e.open);
        const d = S.world.doors.get(e.id);
        if (d) S.sfx.at(e.open ? 'porte' : 'porteF', d.cx, d.y + 1, d.cz, 0.8);
        break;
      }
      case 'coffre': {
        const c = S.sim.S.chests.get(e.id);
        if (c) { S.fx.puff(c.x, c.y + 0.8, c.z, { color: 0xffd060, size: 0.6, grow: 2.5, life: 0.6, add: true, op: 0.9 }); S.sfx.at(c.kind === 'coffre' ? 'coffre' : 'caisse', c.x, c.y, c.z, 1); }
        break;
      }
      case 'ramasse': if (e.p === S.me) { toast(itemLabel(e.it), 1.6); S.sfx.play(e.it.t === 'arme' ? 'arme' : 'ramasse'); } break;
      case 'vide': if (e.p === S.me) { toast('Plus de munitions pour cette arme', 1.6); S.sfx.play('vide'); } break;
      case 'inutile': if (e.p === S.me) toast(ITEMS[e.c].heal ? 'Ta vie est déjà au maximum' : 'Ton bouclier est déjà au maximum', 1.6); break;
      case 'recharge': { const Q = S.sim.player(e.p); if (e.p === S.me) S.sfx.play('recharge'); else if (Q) S.sfx.at('recharge', Q.x, Q.y + 1, Q.z, 0.45); break; }
      case 'arme': if (e.p === S.me) S.sfx.play('change'); break;
      case 'soigne': if (e.p === S.me) S.sfx.play(ITEMS[e.c] && ITEMS[e.c].shield ? 'potion' : 'bandage'); break;
      case 'soin': if (e.p === S.me) S.sfx.play('soigne'); break;
      case 'lance': { const Q = S.sim.player(e.p); if (Q) S.sfx.at('lance', Q.x, Q.y + 1.4, Q.z, 0.7); break; }
      case 'tremplin': S.sfx.at('pose', e.x, e.y, e.z, 0.8); break;
      case 'propulse': S.sfx.at('tremplin', e.x, e.y, e.z, 1); break;
      case 'saut': if (e.p === S.me) { S.hud.say('Saut !<small>Espace pour ouvrir le planeur plus tôt</small>', 2.5); S.sfx.play('saut'); } break;
      case 'atterrit': if (e.p === S.me) S.sfx.play('atterrit'); break;
      case 'tempete': if (e.state === 'fermeture' || e.k > 0) { S.hud.say('La tempête se referme !<small>Rejoins le cercle blanc</small>', 3); S.sfx.play('alerte'); } break;
      case 'fin': endMatch(e.winner); break;
      case 'construit': S.builds.add(e.piece); if (e.piece.owner === S.me) buildBar(); S.sfx.at('construit', (e.piece.x + 0.5) * 4, e.piece.y0 + 1, (e.piece.z + 0.5) * 4, 0.9); break;
      case 'coup': {
        const col = { bois: 0xb08a5a, pierre: 0xa9a49a, metal: 0xc8ccd0 }[e.mat] || 0xcfc6b5;
        S.fx.puff(e.x, e.y, e.z, { color: col, size: 0.3, grow: 1.6, life: 0.4, op: 0.8 });
        if (e.by === S.me) { S.hud.structure(e.hp, e.max); S.sfx.play('coup-' + (e.mat || 'bois')); }
        break;
      }
      case 'casse': {
        hideBroken(e.key);
        const col = { bois: 0x9a6a3a, pierre: 0x8a857c, metal: 0xaab2b8 }[e.mat] || 0x9a8a78;
        for (let i = 0; i < 6; i++) S.fx.puff(e.x + (Math.random() - 0.5) * 2, e.y + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5) * 2, { color: col, size: 0.6, grow: 2.2, life: 0.9, op: 0.75, rise: 0.4 });
        S.sfx.at('casse', e.x, e.y, e.z, 0.9);
        break;
      }
      case 'recolte': if (e.p === S.me) { S.hud.gain(`+${e.n} ${MATERIALS[e.m].label.toLowerCase()}`, MATERIALS[e.m].color); buildBar(); } break;
      case 'pioche': { const h = S.actors.heroOf(e.p); if (h) h.shot(); if (e.p === S.me) S.sfx.play('pioche'); break; }
      case 'manque': if (e.p === S.me) toast(`Pas assez de ${MATERIALS[e.m].label.toLowerCase()} (${COST} par pièce)`, 1.6); break;
      default: break;
    }
  }
}

// ------------------------------------------------------------------ fin de partie
function endMatch(winner) {
  if (S.ended) return;
  S.ended = true;
  const res = S.sim.results(), mine = res.find((r) => r.id === S.me);
  if (winner === S.me) { S.hud.say('Dernier debout !<small>Tu as gagné la partie</small>', 0, 'win'); S.sfx.play('victoire'); }
  report(res);
  setTimeout(() => { S.input.unlock(); showScreen('fin', { res, mine, winner }); }, 3500);
}
function report(res) {
  if (S.reported || S.role === 'guest') return;
  S.reported = true;
  if (!H.embedded) return;
  try {
    H.report({
      id: `royale-${S.run}-${res.length}`, mode: 'Battle royale',
      players: res.map((r) => ({ id: r.bot ? null : r.id, name: r.name, color: r.color, bot: r.bot, rank: r.place, score: r.kills })),
    });
  } catch (e) { console.warn(e); }
}

// ------------------------------------------------------------------ interactions affichées sous le viseur
function showPrompt() {
  const P = me();
  if (!P || !P.alive || P.mode !== 'sol') { S.hud.prompt(''); return; }
  const tg = S.sim.target(P);
  if (!tg) { S.hud.prompt(''); return; }
  if (tg.kind === 'porte') S.hud.prompt((tg.o.open ? 'Fermer' : 'Ouvrir') + (tg.o.kind === 'portail' ? ' le portail' : ' la porte'));
  else if (tg.kind === 'coffre') S.hud.prompt(tg.o.kind === 'coffre' ? 'Ouvrir le coffre' : 'Ouvrir la caisse de munitions');
  else S.hud.prompt('Ramasser : ' + itemLabel(tg.o.it));
}

// ------------------------------------------------------------------ écrans
function lobbyList() {
  if (!H.embedded) return '';
  const hs = humans(), bots = Math.max(0, clamp(S.settings.places, 2, 30) - hs.length);
  const rows = hs.map((p) => `<li><i style="background:${esc(p.color)}"></i>${esc(p.name)}${p.id === S.me ? ' (toi)' : ''}<em>${H.readyMap[p.id] === 'royale' ? 'prêt' : 'charge…'}</em></li>`).join('');
  return `<ul class="lobby">${rows}${S.settings.mode !== 'exploration' && bots ? `<li class="bots"><i></i>${bots} bots ${LEVEL_LABEL[S.settings.level] || ''}</li>` : ''}</ul>`;
}
function showScreen(kind, data) {
  const el = $('#screen');
  el.hidden = !kind;
  if (!kind) return;
  const expl = S.settings.mode === 'exploration';
  const play = (label) => `<button class="btn" id="go">${label}</button>`;
  const back = `<button class="btn ghost" id="quit">${H.embedded ? 'Retour au salon' : 'Quitter'}</button>`;
  const keys = `<ul class="keys"><li><kbd>Z Q S D</kbd> ou <kbd>W A S D</kbd> se déplacer</li><li><kbd>Souris</kbd> regarder, <kbd>clic</kbd> tirer</li>
    <li><kbd>Clic droit</kbd> viser</li><li><kbd>1</kbd> à <kbd>5</kbd>, molette : objets ; <kbd>X</kbd> outil</li>
    <li><kbd>Espace</kbd> sauter, planer</li><li><kbd>Maj</kbd> sprinter, <kbd>Ctrl</kbd> s'accroupir</li>
    <li><kbd>E</kbd> ouvrir, ramasser</li><li><kbd>R</kbd> recharger, <kbd>G</kbd> lâcher</li>
    <li><kbd>X</kbd> pioche : casse et récolte</li><li><kbd>F</kbd> mur, <kbd>V</kbd> sol, <kbd>C</kbd> escalier, <kbd>T</kbd> matériau</li><li><kbd>M</kbd> carte</li><li><kbd>Échap</kbd> pause</li></ul>`;
  const touch = matchMedia('(pointer: coarse)').matches ? '<p class="lede"><b>Pour l\'instant, Island Rush se joue au clavier et à la souris.</b></p>' : '';
  const opts = `<div class="opts"><label>Sensibilité <input type="range" id="sens" min="0.4" max="2.2" step="0.1" value="${(S.input.sens / 0.0024).toFixed(1)}"></label>
    <label>Volume <input type="range" id="vol" min="0" max="1" step="0.05" value="${S.sfx.volume}"></label></div>`;
  let html;
  const n = clamp(S.settings.places, 2, 30);
  if (kind === 'start') {
    const lead = expl ? 'Promène-toi sans combat : entre dans les bâtiments, ouvre les portes, monte sur les toits. Clic sur la carte (M) pour t\'y rendre.'
      : `${n} joueurs montent dans la montgolfière. Saute quand tu veux (Espace), plane jusqu'au sol, fouille les coffres et les maisons, et reste dans le cercle : la tempête se referme. Le dernier en vie gagne.`;
    html = `<p class="eyebrow">Island Rush · ${expl ? 'exploration' : 'battle royale'}</p><h1>${expl ? 'L\'île' : 'Dernier debout'}</h1><p class="lede">${lead}</p>${lobbyList()}${touch}${keys}${opts}
      <div class="row">${play(expl ? 'Explorer l\'île' : net() ? 'Lancer la partie' : 'Monter dans la montgolfière')}${back}</div>`;
  } else if (kind === 'attente') {
    html = `<p class="eyebrow">Island Rush</p><h1>En attente</h1><p class="lede">L'hôte va lancer la partie.</p>${lobbyList()}${touch}${keys}${opts}<div class="row">${back}</div>`;
  } else if (kind === 'rejoint') {
    html = `<p class="eyebrow">Island Rush</p><h1>C'est parti</h1><p class="lede">${S.sim.S.phase === 'vol' ? 'Tu es dans la montgolfière : saute quand tu veux (Espace).' : 'La partie a commencé.'}</p>${keys}${opts}<div class="row">${play('Jouer')}${back}</div>`;
  } else if (kind === 'spectateur') {
    html = `<p class="eyebrow">Island Rush</p><h1>Partie en cours</h1><p class="lede">Tu es arrivé après le départ de la montgolfière : tu regardes les autres jouer (<kbd>Espace</kbd> pour changer de joueur). Tu joueras à la prochaine partie.</p>${opts}<div class="row">${play('Regarder')}${back}</div>`;
  } else if (kind === 'perdu') {
    html = `<p class="eyebrow">Island Rush</p><h1>Liaison perdue</h1><p class="lede">L'hôte ne répond plus.</p><div class="row">${back}</div>`;
  } else if (kind === 'pause') html = `<h1>Pause</h1><p class="lede">La partie continue pendant la pause.</p>${opts}<div class="row">${play('Reprendre')}${back}</div>`;
  else {
    const { res, mine, winner } = data;
    const rows = res.slice(0, 10).map((r) => `<li class="${r.id === S.me ? 'me' : ''}"><span>${r.place}</span><b>${esc(r.name)}${r.bot ? ' 🤖' : ''}</b><em>${r.kills} élim. · ${r.dealt} dégâts</em></li>`).join('');
    const title = !mine ? (winner != null ? `${esc(nameOf(winner))} gagne` : 'Fin de partie') : winner === S.me ? 'Dernier debout !' : `${mine.place}${mine.place === 1 ? 'er' : 'e'} sur ${res.length}`;
    const wait = S.role === 'guest' ? '<p class="lede">L\'hôte peut relancer une partie.</p>' : '';
    html = `<p class="eyebrow">Island Rush · fin de partie</p><h1>${title}</h1>
      ${mine ? `<p class="lede">${mine.kills} élimination${mine.kills > 1 ? 's' : ''} · ${mine.dealt} dégâts infligés · ${fmtTime((Date.now() - S.startedAt) / 1000)} de partie</p>` : ''}<ol class="ranking">${rows}</ol>${wait}
      <div class="row">${S.role !== 'guest' ? '<button class="btn" id="again">Rejouer</button>' : ''}${back}</div>`;
  }
  el.querySelector('.panel').innerHTML = html;
  const go = $('#go'); if (go) go.onclick = () => { S.sfx.unlock(); if (kind === 'start') startMatch(); else S.input.lock(); };
  // rejouer : on repart d'une île neuve (la page se recharge ; les invités suivent quand la partie part)
  const again = $('#again'); if (again) again.onclick = () => location.reload();
  $('#quit').onclick = quit;
  const sens = $('#sens'); if (sens) sens.oninput = () => { S.input.sens = 0.0024 * +sens.value; saveOpts(); };
  const vol = $('#vol'); if (vol) vol.oninput = () => { S.sfx.setVolume(+vol.value); saveOpts(); };
}
const fmtTime = (s) => `${Math.floor(s / 60)} min ${String(Math.floor(s % 60)).padStart(2, '0')}`;
function saveOpts() { try { localStorage.setItem('royale_opts', JSON.stringify({ sens: S.input.sens, vol: S.sfx.volume })); } catch (e) { /* pas de stockage */ } }
function loadOpts() {
  try { const o = JSON.parse(localStorage.getItem('royale_opts') || '{}'); if (o.sens) S.input.sens = clamp(+o.sens, 0.0005, 0.008); if (o.vol != null) S.sfx.setVolume(clamp(+o.vol, 0, 1)); } catch (e) { /* pas de stockage */ }
}
function quit() {
  S.running = false;
  try { S.input && S.input.dispose(); S.actors && S.actors.dispose(); S.fx && S.fx.dispose(); S.scene && S.scene.dispose(); S.sfx && S.sfx.dispose(); } catch (e) { console.error(e); }
  if (H.embedded) H.exit(); else location.reload();
}
let toastT = 0;
function toast(msg, sec = 3) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, sec * 1000);
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
