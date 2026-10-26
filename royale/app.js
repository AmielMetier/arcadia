// Island Rush — démarrage et boucle de jeu. L'île vient de sa graine (engine/map.js), le monde solide
// d'engine/world.js, la partie d'engine/sim.js (pas fixe de 1/60 s) ; la vue 3D de view/. En solo, la partie tourne
// ici ; à plusieurs, l'hôte la fait tourner et les invités reçoivent son état (net/). Le jeu ne parle jamais au
// réseau directement : tout passe par HubBridge.
import { generateMap, ILE } from './engine/map.js';
import { buildWorld } from './engine/world.js';
import { MOVE } from './engine/player.js';
import { createSim, DT, SLOTS } from './engine/sim.js';
import { WEAPONS, ITEMS, itemLabel } from './engine/items.js';
import { createScene } from './view/scene.js';
import { createActors } from './view/actors.js';
import { createFx } from './view/fx.js';
import { createHud } from './view/hud.js';
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

const S = {
  me: 'moi', settings: {}, map: null, world: null, sim: null, scene: null, actors: null, fx: null, hud: null, input: null,
  yaw: 0, pitch: -0.1, camD: 3.8, sel: 0, cnt: { jump: 0, use: 0, reload: 0, drop: 0 }, prev: new Map(),
  acc: 0, last: 0, t: 0, ms: 16, slow: 0, running: false, spect: null, shake: 0, fov: 72, ended: false, reported: false, startedAt: 0,
  cam: { x: 0, y: 0, z: 0 },
};

function progress(label, f) {
  const t = $('#loadTxt'), b = $('#loadBar');
  if (t) t.textContent = label;
  if (b) b.style.width = Math.round(f * 100) + '%';
}

async function boot(info) {
  const prof = window.DDProfile ? window.DDProfile.load() : { name: 'Moi', color: '#ff4b2b' };
  const meP = H.embedded ? H.players.find((p) => p.id === info.myId) : null;
  const set = info.settings || {};
  S.settings = {
    time: QS.get('time') || set.time || 'jour',
    mode: QS.get('mode') || set.mode || 'partie',
    places: +(QS.get('places') || set.places || 16),
    level: QS.get('level') || set.level || 'normal',
  };
  S.meInfo = { id: S.me, name: meP ? meP.name : prof.name || 'Moi', color: meP ? meP.color : prof.color };
  if (H.embedded) H.signalReady();

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
  newMatch();
  S.hud = createHud(S.map, { onTeleport: S.settings.mode === 'exploration' ? teleport : null, project });
  S.hud.showFps(DEBUG);
  S.input = new Input(S.scene.canvas, { key: onKey, lock: onLock, wheel: onWheel });
  $('#hud').hidden = false;
  $('#phaseTxt').textContent = S.settings.mode === 'exploration' ? 'Exploration, sans combat' : `${S.settings.places} joueurs · tempête`;
  showScreen('start');
  S.running = true;
  S.last = performance.now();
  requestAnimationFrame(loop);
  if (DEBUG) window.__royale = S;
}

// ------------------------------------------------------------------ une partie
function newMatch() {
  const roster = [{ id: S.me, ...S.meInfo, bot: false }];
  if (S.settings.mode !== 'exploration') {
    const n = clamp(S.settings.places, 2, 30) - 1;
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
    for (let i = 0; i < n; i++) roster.push({ id: 'bot' + i, name: names[i % names.length], color: PALETTE[(i + 1) % PALETTE.length], bot: true, level: S.settings.level });
  }
  const city = S.map.pois.find((p) => p.kind === 'ville');
  const pl = city && S.map.plazas.find((q) => q.x0 >= city.rect.x0 && q.x1 <= city.rect.x1 && q.z0 >= city.rect.z0 && q.z1 <= city.rect.z1);
  const start = pl ? { x: (pl.x0 + pl.x1) / 2 + 6, z: (pl.z0 + pl.z1) / 2 + 6 } : null;
  S.sim = createSim({ map: S.map, world: S.world, seed: (Math.random() * 1e9) | 0, roster, mode: S.settings.mode, start });
  S.startedAt = Date.now();
  if (S.actors) S.actors.dispose();
  if (S.fx) S.fx.dispose();
  S.actors = createActors(S.scene.scene, S.sim);
  S.fx = createFx(S.scene.scene);
  for (const P of S.sim.S.players.values()) S.prev.set(P.id, { x: P.x, y: P.y, z: P.z, yaw: P.yaw });
  if (S.sim.S.flight) S.yaw = Math.atan2(S.sim.S.flight.ux, S.sim.S.flight.uz);
  S.sel = 0; S.ended = false; S.reported = false; S.spect = null;
}
function teleport(x, z) {
  const P = S.sim.player(S.me);
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
function me() { return S.sim.player(S.me); }
function onKey(code, key) {
  const P = me();
  if (key === 'm' || code === 'KeyM') { S.hud.toggleMap(); if (S.hud.mapOpen) S.input.unlock(); return; }
  if (code === 'Escape' && S.hud.mapOpen) { S.hud.toggleMap(false); return; }
  if (key === 'h') { $('#hints').classList.toggle('off'); return; }
  if (!S.input.playing) return;
  if (P && !P.alive && code === 'Space') { nextSpectate(); return; }
  if (key === 'e') S.cnt.use++;
  else if (key === 'r') S.cnt.reload++;
  else if (key === 'g') S.cnt.drop++;
  else if (/^Digit[1-5]$/.test(code)) S.sel = +code.slice(5);
  else if (code === 'Digit0' || code === 'Backquote' || key === 'x' || key === '²') S.sel = 0;
}
function onWheel(dir) {
  const P = me();
  if (!P) return;
  // on passe d'un objet tenu au suivant (l'outil et les cases occupées)
  const occupied = [0, ...P.inv.map((s, i) => (s ? i + 1 : -1)).filter((i) => i > 0)];
  const i = occupied.indexOf(S.sel);
  S.sel = occupied[(i + dir + occupied.length) % occupied.length];
}
function onLock(locked, free) {
  if (locked) { showScreen(null); S.hud.toggleMap(false); if (free) toast('Souris non capturée : maintiens le clic pour regarder', 4); return; }
  if (!S.hud.mapOpen && !S.ended) showScreen('pause');
}

// ------------------------------------------------------------------ boucle
function loop(now) {
  if (!S.running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - S.last) / 1000);
  S.last = now; S.t += dt;
  S.ms = S.ms * 0.95 + dt * 1000 * 0.05;
  const inp = S.input, P = me();
  const [mx, my] = inp.takeMouse();
  const scoped = isScoped(P);
  const sens = scoped ? 0.25 : inp.aim ? 0.6 : 1;
  S.yaw -= mx * sens; S.pitch = clamp(S.pitch - my * sens, -1.35, 1.25);
  const on = inp.playing && !S.hud.mapOpen && P && P.alive;
  if (on && inp.takeJump()) S.cnt.jump++;
  const ax = on ? inp.axes() : { mx: 0, mz: 0 };
  S.acc += dt;
  let steps = 0;
  while (S.acc >= DT && steps < 6) {
    for (const Q of S.sim.S.players.values()) { const pr = S.prev.get(Q.id); if (pr) { pr.x = Q.x; pr.y = Q.y; pr.z = Q.z; pr.yaw = Q.yaw; } else S.prev.set(Q.id, { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw }); }
    S.sim.input(S.me, { mx: ax.mx, mz: ax.mz, yaw: S.yaw, pitch: S.pitch, fire: on && inp.fire, aim: on && inp.aim, sprint: on && inp.sprint, crouch: on && inp.crouch,
      jump: S.cnt.jump, use: S.cnt.use, reload: S.cnt.reload, shoot: inp.shots, drop: S.cnt.drop, sel: S.sel });
    S.sim.step(DT);
    S.acc -= DT; steps++;
  }
  if (S.acc > DT) S.acc = 0;
  const a = S.acc / DT;
  const disp = (Q) => { const pr = S.prev.get(Q.id) || Q; return { x: pr.x + (Q.x - pr.x) * a, y: pr.y + (Q.y - pr.y) * a, z: pr.z + (Q.z - pr.z) * a, yaw: Q.id === S.me && Q.alive ? S.yaw : Q.yaw }; };
  handleEvents(S.sim.takeEvents());
  // caméra
  const view = cameraFor(P, disp, dt);
  S.actors.update(dt, S.t, view.pos, disp, scoped ? S.me : null);
  S.fx.update(dt, S.t, S.sim, S.sim.S.storm && S.sim.S.storm.cur, view.pos);
  const cam = S.scene.camera, fov = scoped ? 72 / 4 : inp.aim && P && P.alive && heldWeapon(P) ? 72 / (WEAPONS[heldWeapon(P).w].zoom || 1.2) : 72;
  S.fov += (fov - S.fov) * (1 - Math.exp(-14 * dt));
  if (Math.abs(cam.fov - S.fov) > 0.01) { cam.fov = S.fov; cam.updateProjectionMatrix(); }
  S.scene.frame(dt, view, view.focus);
  // interface
  const focusP = P && P.alive ? P : S.sim.player(S.spect) || P;
  const fp = disp(focusP);
  S.hud.maps(S.t, fp, focusP === P ? S.yaw : focusP.yaw, S.ms);
  S.hud.player(focusP, { alive: S.sim.alive().length });
  S.hud.storm(S.sim.S.storm, fp);
  S.hud.flight(S.sim.S.phase === 'vol' && S.sim.S.flight ? flightLine() : null);
  S.hud.frame(dt);
  S.hud.crosshair(P ? spreadOf(P) : 0, scoped);
  if ((S.tick = (S.tick || 0) + 1) % 6 === 0) showPrompt();
  // qualité automatique : si l'image prend plus de 24 ms pendant 3 s, on allège
  if (S.ms > 24 && S.t > 6) { S.slow += dt; if (S.slow > 3) { S.slow = 0; const w = S.scene.lowerQuality(); if (w && DEBUG) toast('Qualité baissée : ' + w, 2); } }
  else S.slow = Math.max(0, S.slow - dt);
}
function heldWeapon(P) { const it = P.sel > 0 ? P.inv[P.sel - 1] : null; return it && it.t === 'arme' ? it : null; }
function isScoped(P) { const w = P && P.alive && heldWeapon(P); return !!(w && w.w === 'sniper' && S.input && S.input.aim && P.mode === 'sol'); }
function spreadOf(P) {
  const it = heldWeapon(P);
  if (!it) return 0.01;
  const W = WEAPONS[it.w], moving = Math.hypot(P.vx, P.vz) > 1;
  return (S.input.aim ? W.spread[1] : W.spread[0]) * (moving ? 1.5 : 1) * (P.crouch ? 0.75 : 1) * (P.ground ? 1 : 2) + P.bloom;
}
function flightLine() {
  const f = S.sim.S.flight;
  return { x0: f.x0, z0: f.z0, x1: f.x0 + f.ux * f.len, z1: f.z0 + f.uz * f.len };
}

// caméra : par-dessus l'épaule droite (au sol), loin derrière (montgolfière, chute libre), à l'œil (lunette)
function cameraFor(P, disp, dt) {
  const W = S.world;
  let target = P;
  if (!P || !P.alive) {
    if (!S.sim.player(S.spect) || !S.sim.player(S.spect).alive) S.spect = pickSpectate();
    target = S.sim.player(S.spect) || P;
  }
  const d = disp(target);
  const yaw = target === P ? S.yaw : target.inp.yaw, pitch = target === P ? S.pitch : clamp(target.inp.pitch, -0.6, 0.6);
  const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  let dist = S.camD, sh = 0.62, headY;
  if (target.mode === 'ballon') {
    // autour de la montgolfière, à la souris, en regardant l'île
    const b = S.sim.balloonPos(), cy2 = Math.cos(Math.min(pitch, -0.15)), D = 42;
    const ox = Math.sin(yaw) * cy2, oy = Math.sin(Math.min(pitch, -0.15)), oz = Math.cos(yaw) * cy2;
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
  const killer = P && P.hitBy && S.sim.player(P.hitBy);
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

// ------------------------------------------------------------------ événements de la partie
function nameOf(id) { const p = S.sim.player(id); return p ? p.name : '?'; }
const CAUSES = { fusil: 'au fusil d\'assaut', pompe: 'au fusil à pompe', pistolet: 'au pistolet', smg: 'au pistolet-mitrailleur', sniper: 'au fusil de précision', roquette: 'au lance-roquettes', grenade: 'à la grenade', tempete: 'par la tempête', chute: 'par une chute' };
function handleEvents(list) {
  for (const e of list) {
    switch (e.e) {
      case 'feu': {
        const h = S.actors.heroOf(e.p);
        if (h) { h.shot(); if (h.held) { const v = new THREE.Vector3(); h.held.getWorldPosition(v); const Q = S.sim.player(e.p); v.x += Math.sin(Q.yaw) * 0.5; v.z += Math.cos(Q.yaw) * 0.5; S.fx.muzzleFlash(v); } }
        break;
      }
      case 'tir': {
        const h = S.actors.heroOf(e.p);
        let muzzle = null;
        if (h && h.held && e.p !== S.me) { muzzle = new THREE.Vector3(); h.held.getWorldPosition(muzzle); }
        S.fx.shot(e.from, e.to, e.w, e.hit, muzzle);
        break;
      }
      case 'degat': {
        if (e.by === S.me && e.to !== S.me) {
          const Q = S.sim.player(e.to);
          S.hud.hitMarker(e.head, Q && !Q.alive);
          S.hud.damageNumber(e.x, e.y, e.z, e.n, e.head, e.sh);
        }
        if (e.to === S.me && e.by) {
          const A = S.sim.player(e.by), P = me();
          if (A && P) { const ang = Math.atan2(A.x - P.x, A.z - P.z) - S.yaw; S.hud.hurtFrom(-ang); }
        }
        break;
      }
      case 'elim': {
        const killer = e.by ? `<b>${esc(nameOf(e.by))}</b>` : '';
        const icon = (id) => (S.sim.player(id) && S.sim.player(id).bot ? ' 🤖' : '');
        S.hud.feedLine(e.by ? `${killer}${icon(e.by)} a éliminé <b>${esc(nameOf(e.to))}</b>${icon(e.to)} ${CAUSES[e.cause] || ''}` : `<b>${esc(nameOf(e.to))}</b>${icon(e.to)} éliminé ${CAUSES[e.cause] || ''}`);
        if (e.to === S.me) {
          S.hud.say(`Éliminé${e.by ? ' par ' + esc(nameOf(e.by)) : ''}<small>${e.place}${e.place === 1 ? 'er' : 'e'} sur ${S.sim.S.players.size}</small>`, 5);
          S.spect = e.by && S.sim.player(e.by) && S.sim.player(e.by).alive ? e.by : pickSpectate();
        } else if (e.by === S.me) S.hud.say(`Tu as éliminé <b>${esc(nameOf(e.to))}</b><small>${e.left} encore en vie</small>`, 2.5);
        break;
      }
      case 'boum': {
        S.fx.boom(e.x, e.y, e.z, e.r, e.kind);
        const d = Math.hypot(e.x - S.cam.x, e.y - S.cam.y, e.z - S.cam.z);
        if (d < 30) S.shake = Math.max(S.shake, (1 - d / 30) * 1.2);
        break;
      }
      case 'porte': S.scene.interior.setDoor(e.id, e.open); break;
      case 'coffre': {
        const c = S.sim.S.chests.get(e.id);
        if (c) S.fx.puff(c.x, c.y + 0.8, c.z, { color: 0xffd060, size: 0.6, grow: 2.5, life: 0.6, add: true, op: 0.9 });
        break;
      }
      case 'ramasse': if (e.p === S.me) toast(itemLabel(e.it), 1.6); break;
      case 'vide': if (e.p === S.me) toast('Plus de munitions pour cette arme', 1.6); break;
      case 'inutile': if (e.p === S.me) toast(ITEMS[e.c].heal ? 'Ta vie est déjà au maximum' : 'Ton bouclier est déjà au maximum', 1.6); break;
      case 'saut': if (e.p === S.me) S.hud.say('Saut !<small>Espace pour ouvrir le planeur plus tôt</small>', 2.5); break;
      case 'tempete': if (e.state === 'fermeture' || e.k > 0) S.hud.say('La tempête se referme !<small>Rejoins le cercle blanc</small>', 3); break;
      case 'fin': endMatch(e.winner); break;
      default: break;
    }
  }
}

// ------------------------------------------------------------------ fin de partie
function endMatch(winner) {
  if (S.ended) return;
  S.ended = true;
  const res = S.sim.results(), mine = res.find((r) => r.id === S.me);
  if (winner === S.me) S.hud.say('Dernier debout !<small>Tu as gagné la partie</small>', 0, 'win');
  report(res);
  setTimeout(() => { S.input.unlock(); showScreen('fin', { res, mine, winner }); }, 3500);
}
function report(res) {
  if (S.reported || (H.embedded && H.info && H.info.role === 'guest')) return;
  S.reported = true;
  if (!H.embedded) return;
  try {
    H.report({
      id: `royale-${S.startedAt}-${res.length}`, mode: 'Battle royale',
      players: res.map((r) => ({ id: r.bot ? null : (r.id === S.me ? H.info.myId : r.id), name: r.name, color: r.color, bot: r.bot, rank: r.place, score: r.kills })),
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
function showScreen(kind, data) {
  const el = $('#screen');
  el.hidden = !kind;
  if (!kind) return;
  const play = `<button class="btn" id="go">${kind === 'start' ? (S.settings.mode === 'exploration' ? 'Explorer l\'île' : 'Monter dans la montgolfière') : 'Reprendre'}</button>`;
  const back = `<button class="btn ghost" id="quit">${H.embedded ? 'Retour au salon' : 'Quitter'}</button>`;
  const keys = `<ul class="keys"><li><kbd>Z Q S D</kbd> ou <kbd>W A S D</kbd> se déplacer</li><li><kbd>Souris</kbd> regarder, <kbd>clic</kbd> tirer</li>
    <li><kbd>Clic droit</kbd> viser</li><li><kbd>1</kbd> à <kbd>5</kbd>, molette : objets ; <kbd>X</kbd> outil</li>
    <li><kbd>Espace</kbd> sauter, planer</li><li><kbd>Maj</kbd> sprinter, <kbd>Ctrl</kbd> s'accroupir</li>
    <li><kbd>E</kbd> ouvrir, ramasser</li><li><kbd>R</kbd> recharger, <kbd>G</kbd> lâcher</li><li><kbd>M</kbd> carte</li><li><kbd>Échap</kbd> pause</li></ul>`;
  const touch = matchMedia('(pointer: coarse)').matches ? '<p class="lede"><b>Pour l\'instant, Island Rush se joue au clavier et à la souris.</b></p>' : '';
  let html;
  if (kind === 'start') {
    html = S.settings.mode === 'exploration'
      ? `<p class="eyebrow">Island Rush · exploration</p><h1>L'île</h1><p class="lede">Promène-toi sans combat : entre dans les bâtiments, ouvre les portes, monte sur les toits. Clic sur la carte (M) pour t'y rendre.</p>${touch}${keys}<div class="row">${play}${back}</div>`
      : `<p class="eyebrow">Island Rush · battle royale</p><h1>Dernier debout</h1><p class="lede">${S.sim.S.players.size} joueurs montent dans la montgolfière. Saute quand tu veux (Espace), plane jusqu'au sol, fouille les coffres et les maisons, et reste dans le cercle : la tempête se referme. Le dernier en vie gagne.</p>${touch}${keys}<div class="row">${play}${back}</div>`;
  } else if (kind === 'pause') html = `<h1>Pause</h1><p class="lede">La partie continue pendant la pause.</p><div class="row">${play}${back}</div>`;
  else {
    const { res, mine, winner } = data;
    const rows = res.slice(0, 10).map((r) => `<li class="${r.id === S.me ? 'me' : ''}"><span>${r.place}</span><b>${esc(r.name)}${r.bot ? ' 🤖' : ''}</b><em>${r.kills} élim.</em></li>`).join('');
    html = `<p class="eyebrow">Island Rush · fin de partie</p><h1>${winner === S.me ? 'Dernier debout !' : `${mine.place}${mine.place === 1 ? 'er' : 'e'} sur ${res.length}`}</h1>
      <p class="lede">${mine.kills} élimination${mine.kills > 1 ? 's' : ''} · ${mine.dealt} dégâts infligés</p><ol class="ranking">${rows}</ol>
      <div class="row"><button class="btn" id="again">Rejouer</button>${back}</div>`;
  }
  el.querySelector('.panel').innerHTML = html;
  const go = $('#go'); if (go) go.onclick = () => S.input.lock();
  const again = $('#again'); if (again) again.onclick = () => { if (H.embedded) quit(); else location.reload(); };
  $('#quit').onclick = quit;
}
function quit() {
  S.running = false;
  try { S.input && S.input.dispose(); S.actors && S.actors.dispose(); S.fx && S.fx.dispose(); S.scene && S.scene.dispose(); } catch (e) { console.error(e); }
  if (H.embedded) H.exit(); else location.reload();
}
let toastT = 0;
function toast(msg, sec = 3) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, sec * 1000);
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
