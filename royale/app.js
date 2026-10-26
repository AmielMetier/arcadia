// Battle royale — démarrage et boucle de jeu. Phase 1 : l'exploration de l'île en 3D (pas encore de combat).
// L'île vient de sa graine (engine/map.js), le monde solide d'engine/world.js, le déplacement d'engine/player.js
// (pas fixe de 1/60 s, comme le fera la simulation de l'hôte) ; la vue 3D de view/. Le jeu ne parle jamais au réseau
// directement : tout passe par HubBridge (ici : nom, couleur, réglages, retour au salon).
import { generateMap, ILE, CELL } from './engine/map.js';
import { buildWorld } from './engine/world.js';
import { newPlayer, stepPlayer, MOVE } from './engine/player.js';
import { createScene } from './view/scene.js';
import { buildHero } from './view/hero.js';
import { createHud } from './view/hud.js';
import { Input } from './input.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug');
const $ = (s) => document.querySelector(s);
const DT = 1 / 60;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const breathe = () => new Promise((r) => setTimeout(r, 0));

const S = { me: null, settings: {}, map: null, world: null, scene: null, hero: null, hud: null, input: null, p: null, prev: null,
  yaw: 0, pitch: -0.12, camD: 3.8, acc: 0, last: 0, t: 0, ms: 16, slow: 0, running: false };

function progress(label, f) {
  $('#loadTxt').textContent = label;
  $('#loadBar').style.width = Math.round(f * 100) + '%';
}

async function boot(info) {
  const prof = window.DDProfile ? window.DDProfile.load() : { name: 'Moi', color: '#ff4b2b' };
  const meP = H.embedded ? H.players.find((p) => p.id === info.myId) : null;
  S.me = { name: meP ? meP.name : prof.name || 'Moi', color: meP ? meP.color : prof.color };
  S.settings = { time: QS.get('time') || (info.settings && info.settings.time) || 'jour' };
  if (H.embedded) H.signalReady();

  progress('Génération de l\'île', 0.05); await breathe(); await breathe();
  const seed = +QS.get('graine') || ILE;
  S.map = generateMap(seed);
  progress('Murs, dalles et escaliers', 0.2); await breathe();
  S.world = buildWorld(S.map);
  try {
    S.scene = await createScene($('#stage'), S.map, { time: S.settings.time, progress, onLost: () => toast('Affichage 3D interrompu : recharge la page', 8) });
  } catch (e) {
    console.error(e);
    progress('Impossible de lancer la 3D sur cet appareil', 1);
    return;
  }
  progress('Carte', 0.95); await breathe();
  S.hud = createHud(S.map, { onTeleport: (x, z) => { teleport(x, z); S.hud.toggleMap(false); } });
  S.hud.showFps(DEBUG);
  S.hero = buildHero({ shirt: parseInt(String(S.me.color).replace('#', ''), 16) || 0xff4b2b });
  S.scene.scene.add(S.hero.root);
  spawn();
  S.input = new Input(S.scene.canvas, { key: onKey, lock: onLock });
  $('#hud').hidden = false;
  showScreen('start');
  S.running = true;
  S.last = performance.now();
  requestAnimationFrame(loop);
  if (DEBUG) window.__royale = S;
}

// départ : au milieu de la place de la ville (sinon au bout d'une rue)
function spawn() {
  const m = S.map, city = m.pois.find((p) => p.kind === 'ville');
  const pl = m.plazas.find((q) => city && q.x0 >= city.rect.x0 && q.x1 <= city.rect.x1 && q.z0 >= city.rect.z0 && q.z1 <= city.rect.z1);
  const at = pl ? { x: (pl.x0 + pl.x1) / 2 + 6, z: (pl.z0 + pl.z1) / 2 + 6 } : city ? { x: city.gates[0].sx, z: city.gates[0].sz + 6 } : { x: m.center, z: m.center };
  teleport(at.x, at.z);
  S.yaw = Math.atan2(m.center - at.x, m.center - at.z) || 0;
}
function teleport(x, z) {
  const y = S.world.support(x, z, 400);
  S.p = newPlayer(x, y + 0.05, z, S.yaw);
  S.prev = { ...S.p };
}

function onKey(code, key) {
  if (key === 'e' && S.input.playing) interact();
  else if (key === 'm' || code === 'KeyM') { S.hud.toggleMap(); if (S.hud.mapOpen) S.input.unlock(); }
  else if (code === 'Escape' && S.hud.mapOpen) S.hud.toggleMap(false);
  else if (code === 'KeyH') $('#hints').classList.toggle('off');
  else if (code === 'KeyF' && DEBUG) S.hud.showFps(true);
}
function onLock(locked, free) {
  if (locked) { showScreen(null); S.hud.toggleMap(false); if (free) toast('Souris non capturée : maintiens le clic pour regarder', 4); return; }
  if (!S.hud.mapOpen) showScreen('pause');
}

// ------------------------------------------------------------------ interactions : portes (bientôt coffres et butin)
function lookDir() { return [Math.sin(S.yaw), Math.cos(S.yaw)]; }
function interact() {
  const [fx, fz] = lookDir();
  const d = S.world.doorNear(S.p.x, S.p.y, S.p.z, fx, fz);
  if (d) toggleDoor(d.id, !d.open, S.p.x, S.p.z);
}
// la porte s'ouvre en s'éloignant de celui qui la pousse
function toggleDoor(id, open, fromX, fromZ) {
  const d = S.world.doors.get(id);
  if (!d) return;
  if (open) d.swing = d.o === 'h' ? (fromZ > d.cz ? -1 : 1) : (fromX > d.cx ? -1 : 1);
  S.world.setDoor(id, open);
  S.scene.interior.setDoor(id, open);
}
// ce qu'on peut faire avec E, affiché sous le viseur
function showPrompt() {
  const [fx, fz] = lookDir();
  const d = S.world.doorNear(S.p.x, S.p.y, S.p.z, fx, fz);
  S.hud.prompt(d ? (d.open ? 'Fermer' : 'Ouvrir') + (d.kind === 'portail' ? ' le portail' : ' la porte') : '');
}

// ------------------------------------------------------------------ boucle
function loop(now) {
  if (!S.running) return;
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, (now - S.last) / 1000);
  S.last = now; S.t += dt;
  S.ms = S.ms * 0.95 + dt * 1000 * 0.05;
  const inp = S.input;
  // regard
  const [mx, my] = inp.takeMouse();
  S.yaw -= mx; S.pitch = clamp(S.pitch - my, -1.25, 1.1);
  // simulation à pas fixe
  const on = inp.playing && !S.hud.mapOpen;
  const ax = on ? inp.axes() : { mx: 0, mz: 0 };
  let jump = on && inp.takeJump();
  S.acc += dt;
  while (S.acc >= DT) {
    S.prev = { x: S.p.x, y: S.p.y, z: S.p.z };
    stepPlayer(S.p, { mx: ax.mx, mz: ax.mz, yaw: S.yaw, jump, sprint: on && inp.sprint, crouch: on && inp.crouch }, S.world, DT);
    jump = false;
    S.acc -= DT;
  }
  // position affichée : entre les deux derniers pas
  const a = S.acc / DT, p = S.p;
  const x = S.prev.x + (p.x - S.prev.x) * a, y = S.prev.y + (p.y - S.prev.y) * a, z = S.prev.z + (p.z - S.prev.z) * a;
  const hero = S.hero;
  hero.root.position.set(x, y, z);
  hero.root.rotation.y = p.yaw;
  hero.update(dt, { speed: Math.hypot(p.vx, p.vz), ground: p.ground, swim: p.swim, crouch: p.crouch, sprint: p.sprint, pitch: S.pitch });
  // caméra par-dessus l'épaule droite, rapprochée si un mur ou le sol est derrière
  const cp = Math.cos(S.pitch), fx = Math.sin(S.yaw) * cp, fy = Math.sin(S.pitch), fz = Math.cos(S.yaw) * cp;
  const rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw);
  const headY = p.swim ? y + MOVE.swimDepth + 0.6 : y + (p.crouch ? MOVE.hc : MOVE.h) - 0.25;
  const sh = 0.62;
  let px = x + rx * sh, pz = z + rz * sh, py = headY;
  // l'épaule ne doit pas entrer dans un mur
  const side = S.world.ray(x, headY, z, rx, 0, rz, sh, 0.12);
  px = x + rx * side; pz = z + rz * side;
  const want = S.camD, free = S.world.ray(px, py, pz, -fx, -fy, -fz, want, 0.15);
  const d = Math.max(0.45, free - 0.1);
  let cx = px - fx * d, cy = py - fy * d, cz = pz - fz * d;
  const wl = S.world.waterLevel(cx, cz);
  if (cy < wl + 0.35) cy = wl + 0.35;
  S.scene.frame(dt, { pos: { x: cx, y: cy, z: cz }, look: { x: px + fx * 20, y: py + fy * 20, z: pz + fz * 20 } }, { x, y, z });
  S.hud.update(S.t, { x, z }, S.yaw, S.ms);
  if ((S.tick = (S.tick || 0) + 1) % 6 === 0) showPrompt();
  // qualité automatique : si l'image prend plus de 24 ms pendant 3 s, on allège
  if (S.ms > 24 && S.t > 6) { S.slow += dt; if (S.slow > 3) { S.slow = 0; const w = S.scene.lowerQuality(); if (w && DEBUG) toast('Qualité baissée : ' + w, 2); } }
  else S.slow = Math.max(0, S.slow - dt);
}

// ------------------------------------------------------------------ écrans
function showScreen(kind) {
  const el = $('#screen');
  el.hidden = !kind;
  if (!kind) return;
  const play = `<button class="btn" id="go">${kind === 'start' ? 'Explorer l\'île' : 'Reprendre'}</button>`;
  const back = `<button class="btn ghost" id="quit">${H.embedded ? 'Retour au salon' : 'Quitter'}</button>`;
  el.querySelector('.panel').innerHTML = kind === 'start'
    ? `<p class="eyebrow">Battle royale · phase 1</p><h1>L'île</h1>
       <p class="lede">Promène-toi : villes, villages, lieux-dits, maisons abandonnées. Entre dans les bâtiments, monte les escaliers, grimpe sur les toits plats, traverse le lac à la nage. Pas encore de combat.</p>
       ${matchMedia('(pointer: coarse)').matches ? '<p class="lede"><b>Pour l\'instant, Island Rush se joue au clavier et à la souris.</b></p>' : ''}
       <ul class="keys"><li><kbd>Z Q S D</kbd> ou <kbd>W A S D</kbd> se déplacer</li><li><kbd>Souris</kbd> regarder</li><li><kbd>Espace</kbd> sauter</li><li><kbd>Maj</kbd> sprinter</li><li><kbd>Ctrl</kbd> s'accroupir</li><li><kbd>E</kbd> ouvrir, fermer une porte</li><li><kbd>M</kbd> carte (clic pour s'y rendre)</li><li><kbd>Échap</kbd> pause</li></ul>
       <div class="row">${play}${back}</div>`
    : `<h1>Pause</h1><div class="row">${play}${back}</div>`;
  $('#go').onclick = () => S.input.lock();
  $('#quit').onclick = quit;
}
function quit() {
  S.running = false;
  try { S.input && S.input.dispose(); S.hero && S.hero.dispose(); S.scene && S.scene.dispose(); } catch (e) { console.error(e); }
  if (H.embedded) H.exit(); else location.reload();
}
let toastT = 0;
function toast(msg, sec = 3) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, sec * 1000);
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
