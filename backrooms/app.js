// The Backrooms - Logique applicative principale, entrées clavier/souris et boucle de jeu
import { createBackroomsMap } from './engine/map.js';
import { BackroomsSim, DT, DEPART_T, INV_SIZE } from './engine/sim.js';
import { createBackroomsScene } from './view/scene.js';
import { BackroomsSfx } from './view/sfx.js';
import { BackroomsHUD } from './view/hud.js';

const H = window.HubBridge;
const stageEl = document.getElementById('stage');
const hudEl = document.getElementById('hud');

let sim = null;
let scene = null;
let sfx = null;
let hud = null;
let stepDist = 0;
let monsterStepT = 0;

// Réseau : l'hôte fait tourner la partie et envoie un instantané ~20 fois par seconde ; un invité se déplace chez lui
// (pour que ça réponde tout de suite), envoie ses commandes et reçoit tout le reste de l'hôte.
const NET = {
  role: 'solo', // 'solo' | 'host' | 'guest'
  myId: 0,
  run: 0,
  tick: 0,
  inputs: {}, // hôte : dernières commandes de chaque invité
  actions: {}, // hôte : lampe et objets demandés par chaque invité, en attente du prochain pas
  events: [], // hôte : événements à envoyer aux invités
  lastHost: 0, // invité : dernier message de l'hôte
};
const multi = () => NET.role !== 'solo' && sim && sim.players.length > 1;
const send = (to, m, vol) => H && H.embedded && H.send(to, m, vol ? { volatile: true } : undefined);

// Gestion des touches du clavier
// Mode sans souris (comme Mystère Mystère) : ZQSD pour marcher, les flèches tournent la vue, Échap ou P met en pause.
const TURN = 2.2; // vitesse de la vue aux flèches (rad/s)
const TILT = 1.4;
const keys = {};
let mouseDx = 0;
let mouseDy = 0;
let isPointerLocked = false;
let toggleFlashlightRequested = false;
let useRequested = null; // objet à utiliser (touches 2 et 3 ; la touche 1, c'est la lampe)
let kbMode = false;
let paused = true; // la partie attend qu'on prenne le contrôle
try {
  kbMode = localStorage.getItem('backrooms_kb') === '1';
} catch (e) {}

function setPaused(on) {
  paused = on;
  if (on) for (const k in keys) keys[k] = false;
  if (hud) hud.showPause(on, kbMode);
}

function play() {
  if (sfx) sfx.unlock();
  const tactile = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
  if (tactile) document.body.classList.add('touch');
  if (kbMode || tactile) setPaused(false);
  else stageEl.requestPointerLock?.();
}

function setKbMode(on) {
  kbMode = on;
  for (const k in keys) keys[k] = false;
  try {
    localStorage.setItem('backrooms_kb', on ? '1' : '0');
  } catch (e) {}
  if (on && document.pointerLockElement) document.exitPointerLock();
  if (hud) hud.showPause(paused, kbMode);
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (sfx) sfx.unlock();
  // spectateur : Espace ou les flèches changent le joueur regardé
  if (!paused && sim && sim.player.status !== 'alive' && ['Space', 'ArrowLeft', 'ArrowRight'].includes(e.code) && !e.repeat) {
    sim.spectate = (sim.spectate || 0) + (e.code === 'ArrowLeft' ? -1 : 1);
  }
  if (paused) {
    if (kbMode && (e.code === 'Enter' || e.code === 'Space')) play();
    return;
  }
  keys[e.code] = true;
  if (e.code === 'KeyF' && !e.repeat) toggleFlashlightRequested = true;
  // case 1 : la lampe torche (comme F) ; cases 2 et 3 : les objets
  const slot = ['Digit1', 'Digit2', 'Digit3', 'Numpad1', 'Numpad2', 'Numpad3'].indexOf(e.code);
  if (slot >= 0 && !e.repeat) useSlot(slot % 3);
  if (kbMode && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(true);
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});
window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
});

// Tactile : glisser à gauche pour marcher (joystick), à droite pour regarder ; boutons Courir et Lampe
const touch = { move: null, look: null, run: false };
const touchBtns = document.createElement('div');
touchBtns.className = 'touch-btns';
touchBtns.innerHTML = '<button data-t="run">🏃<small>Courir</small></button><button data-t="lamp">🔦<small>Lampe</small></button>';
document.body.appendChild(touchBtns);
const stick = document.createElement('div');
stick.className = 'touch-stick';
stick.hidden = true;
stick.innerHTML = '<i></i>';
document.body.appendChild(stick);
for (const b of touchBtns.querySelectorAll('button')) {
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (b.dataset.t === 'run') touch.run = true;
    else toggleFlashlightRequested = true;
    b.classList.add('on');
  });
  const up = () => {
    if (b.dataset.t === 'run') touch.run = false;
    b.classList.remove('on');
  };
  b.addEventListener('pointerup', up);
  b.addEventListener('pointerleave', up);
  b.addEventListener('pointercancel', up);
}
stageEl.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  document.body.classList.add('touch');
  if (sfx) sfx.unlock();
  if (paused) setPaused(false);
  if (e.clientX < innerWidth * 0.45 && !touch.move) {
    touch.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
    stick.hidden = false;
    stick.style.left = e.clientX + 'px';
    stick.style.top = e.clientY + 'px';
  } else if (!touch.look) touch.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
  try { stageEl.setPointerCapture(e.pointerId); } catch (err) {}
});
stageEl.addEventListener('pointermove', (e) => {
  const m = touch.move;
  const l = touch.look;
  if (m && m.id === e.pointerId) {
    m.x = e.clientX;
    m.y = e.clientY;
    const dx = m.x - m.ox;
    const dy = m.y - m.oy;
    const d = Math.min(1, Math.hypot(dx, dy) / 60) * 60;
    const a = Math.atan2(dy, dx);
    stick.firstChild.style.transform = `translate(${Math.cos(a) * d}px, ${Math.sin(a) * d}px)`;
  }
  if (l && l.id === e.pointerId) {
    mouseDx += (e.clientX - l.x) * 2.2;
    mouseDy += (e.clientY - l.y) * 2.2;
    l.x = e.clientX;
    l.y = e.clientY;
  }
});
const touchEnd = (e) => {
  if (touch.move && touch.move.id === e.pointerId) {
    touch.move = null;
    stick.hidden = true;
    stick.firstChild.style.transform = '';
  }
  if (touch.look && touch.look.id === e.pointerId) touch.look = null;
};
window.addEventListener('pointerup', touchEnd);
window.addEventListener('pointercancel', touchEnd);

// Pointer Lock pour la visée à la souris
stageEl.addEventListener('click', () => {
  if (sim && !paused && sim.player.status !== 'alive') sim.spectate = (sim.spectate || 0) + 1;
  if (!document.body.classList.contains('touch')) play();
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === stageEl;
  if (!kbMode) setPaused(!isPointerLocked);
});

document.addEventListener('mousemove', (e) => {
  if (isPointerLocked && !kbMode && !touch.look) {
    mouseDx += e.movementX || 0;
    mouseDy += e.movementY || 0;
  }
});

// Une case de l'inventaire : la 1re allume ou éteint la lampe, les deux autres utilisent un objet
function useSlot(i) {
  if (i === 0) toggleFlashlightRequested = true;
  else useRequested = i - 1;
}

let lastSettings = {};
// Nouvelle partie (solo ou hôte) : l'hôte l'annonce aux invités, qui construisent la même carte avec la même graine
function initGame(settings = lastSettings) {
  lastSettings = settings;
  if (NET.role === 'guest') return; // l'invité attend le « go » de l'hôte
  const seed = Math.floor(Math.random() * 100000);
  const difficulty = settings.difficulty || 'normal';
  const players = NET.role === 'host' ? H.players.map((p) => ({ id: p.id, name: p.name || 'Joueur' })) : [{ id: 0, name: 'Joueur' }];
  NET.run = Date.now();
  startRun({ seed, difficulty, players, run: NET.run, level: 0 });
  if (NET.role === 'host') send('all', goMessage());
}

const goMessage = () => ({ t: 'go', run: NET.run, seed: sim.seed, diff: sim.difficulty, players: sim.roster, lv: sim.level });

function startRun({ seed, difficulty, players, run, level }) {
  NET.run = run;
  NET.inputs = {};
  NET.actions = {};
  NET.events = [];
  const map = createBackroomsMap(seed);
  if (!players.some((p) => p.id === NET.myId)) players = [...players, { id: NET.myId, name: 'Joueur' }];
  sim = new BackroomsSim({ map, difficulty, seed, players, localId: NET.myId });
  if (level) sim.loadLevel(level);
  // un invité qui arrive en cours de partie regarde les autres jusqu'au prochain étage (l'hôte le dira)
  if (scene) {
    scene.dispose();
    stageEl.innerHTML = '';
  }
  scene = createBackroomsScene(stageEl, sim.map);
  if (hud) {
    hud.$('#endScreen').hidden = true;
    hud.lastCount = -1;
  }

  if (!sfx) {
    sfx = new BackroomsSfx();
  }
  if (!hud) {
    hud = new BackroomsHUD(hudEl, { play, setKbMode, use: useSlot });
  }

  stepDist = 0;
  setPaused(kbMode ? paused : !isPointerLocked);
}

// Hôte : les commandes des invités pour ce pas (la lampe et les objets ne servent qu'une fois)
function guestInputs() {
  const out = {};
  for (const id in NET.inputs) {
    const i = NET.inputs[id];
    const a = NET.actions[id] || (NET.actions[id] = { f: 0, u: [] });
    out[id] = { mx: i.mx, my: i.my, run: i.run, yaw: i.yaw, pitch: i.pitch, pos: i.pos, toggleFlashlight: a.f > 0, use: a.u.length ? a.u.shift() : null };
    if (a.f > 0) a.f--;
    i.pos = null; // une position annoncée ne sert qu'une fois
  }
  return out;
}

const num = (v, a, b) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, +v)) : 0);

// Messages du réseau (from : l'identifiant donné par le salon, la seule identité fiable)
function onMsg(from, m) {
  if (!m || typeof m !== 'object') return;
  if (NET.role === 'host') {
    if (m.t === 'hi' && sim) {
      // arrivée en cours de partie : spectateur jusqu'au prochain étage
      const p = H.players.find((q) => q.id === from);
      sim.addPlayer(from, (p && p.name) || 'Joueur');
      send(from, goMessage());
    } else if (m.t === 'i' && m.run === NET.run) {
      NET.inputs[from] = { mx: num(m.mx, -1, 1), my: num(m.my, -1, 1), run: !!m.r, yaw: num(m.yaw, -1e4, 1e4), pitch: num(m.pitch, -1.4, 1.4), pos: { x: num(m.x, 0, 1e3), z: num(m.z, 0, 1e3) } };
    } else if (m.t === 'a' && m.run === NET.run) {
      const a = NET.actions[from] || (NET.actions[from] = { f: 0, u: [] });
      if (m.k === 'f') a.f = Math.min(2, a.f + 1);
      else if (m.k === 'u' && a.u.length < 3) a.u.push(Math.max(0, Math.min(INV_SIZE - 1, m.i | 0)));
    }
    return;
  }
  if (NET.role !== 'guest' || from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  NET.lastHost = performance.now();
  if (m.t === 'go') {
    if (m.run !== NET.run || !sim) startRun({ seed: m.seed, difficulty: m.diff, players: m.players || [], run: m.run, level: m.lv || 0 });
  } else if (m.t === 's' && sim && m.run === NET.run) {
    const lv = sim.level;
    sim.applySnapshot(m.s);
    if (sim.level !== lv) handleEvent({ type: 'level', level: sim.level, rebuild: true }, NET.myId);
  } else if (m.t === 'e' && sim && m.run === NET.run) {
    for (const ev of m.e) {
      // l'étage a déjà été chargé par l'instantané : on refait seulement la scène si besoin
      if (ev.type === 'level' && sim.level === ev.level && scene && scene.level === ev.level) continue;
      if (ev.type === 'level' && sim.level !== ev.level) sim.loadLevel(ev.level);
      handleEvent(ev, NET.myId);
    }
  }
}

// Le salon a changé : un joueur part (il quitte la partie), ou l'hôte est parti et c'est moi qui prends le relais
function onRoster() {
  if (!sim) return;
  if (NET.role === 'guest' && H.info.role === 'host') {
    NET.role = 'host';
    NET.inputs = {};
    NET.actions = {};
    if (hud) hud.toast("Tu deviens l'hôte : la partie continue");
  }
  if (NET.role !== 'host') return;
  const ids = new Set(H.players.map((p) => p.id));
  for (const P of [...sim.players]) if (!ids.has(P.id)) sim.removePlayer(P.id);
}

// Événements de la partie : sons, messages, changement d'étage, fin
function handleEvent(ev, me) {
  const mine = ev.by !== undefined ? ev.by === me : ev.id === undefined || ev.id === me;
  const who = (id) => (sim.players.find((p) => p.id === id) || {}).name || 'Quelqu\'un';
  switch (ev.type) {
    case 'cassette':
      if (sfx) sfx.cassette();
      if (hud && ev.by !== me) hud.toast(`${who(ev.by)} a trouvé une cassette (${ev.count}/${ev.total})`);
      break;
    case 'fuse':
      if (sfx) sfx.cassette();
      if (hud) hud.toast(ev.by === me ? `Fusible ${ev.count}/${ev.total}` : `${who(ev.by)} a trouvé un fusible (${ev.count}/${ev.total})`);
      break;
    case 'powered':
      if (hud) hud.toast('Fusibles en place : le monte-charge redémarre');
      break;
    case 'exitUnlocked':
      if (sfx) { sfx.exitUnlocked(); setTimeout(() => sfx && sfx.ding(), 900); }
      break;
    case 'pickup':
      if (!mine) break;
      if (sfx) sfx.battery();
      if (hud) hud.toast(ev.kind === 'bottle' ? "Eau d'amande dans l'inventaire" : "Piles dans l'inventaire");
      break;
    case 'invFull':
      if (mine && hud) hud.toast('Inventaire plein : utilise un objet (2 ou 3)');
      break;
    case 'useless':
      if (mine && hud) hud.toast(ev.kind === 'bottle' ? 'Tu as déjà tout ton souffle' : 'La lampe est déjà chargée');
      break;
    case 'bottle':
      if (!mine) break;
      if (sfx) sfx.bottle();
      if (hud) hud.toast("Eau d'amande : endurance au maximum");
      break;
    case 'battery':
      if (!mine) break;
      if (sfx) sfx.battery();
      if (hud) hud.toast('Pile changée : lampe rechargée');
      break;
    case 'lamp':
      if (ev.id !== me) break;
      if (sfx) sfx.battery();
      if (hud) hud.toast('Lampe torche en main · [F] pour l\'allumer ou l\'éteindre');
      break;
    case 'noLamp':
      if (ev.id === me && hud) hud.toast('Pas de lampe : prends-en une sur la table du départ');
      break;
    case 'batteryEmpty':
      if (!mine) break;
      if (sfx) sfx.battery(true);
      if (hud) hud.toast('Plus de pile… trouve-en dans le noir');
      break;
    case 'blackout':
      if (sfx) sfx.blackout();
      if (hud) hud.toast('Coupure de courant…');
      break;
    case 'power':
      if (sfx) sfx.power();
      break;
    case 'spotted':
      if (sfx) sfx.spotted();
      break;
    case 'board':
      if (sfx) sfx.ding();
      if (hud && ev.id !== me) hud.toast(`${ev.name} est dans l'ascenseur`);
      break;
    case 'depart':
      if (sfx) { sfx.ding(); setTimeout(() => sfx && sfx.elevator(DEPART_T + 1.5), 400); }
      if (hud) setTimeout(() => hud && sim.departT > 0 && hud.fade(ev.level === 0 ? "L'ASCENSEUR DESCEND…" : 'LE MONTE-CHARGE REMONTE…', '', 0, true), 700);
      break;
    case 'level':
      // nouvel étage : nouvelle scène
      if (scene && scene.level === ev.level && scene.map === sim.map) break;
      if (scene) scene.dispose();
      stageEl.innerHTML = '';
      scene = createBackroomsScene(stageEl, sim.map);
      sim.spectate = 0;
      stepDist = 0;
      if (hud) hud.fade(`LEVEL ${ev.level}`, ev.level === 1 ? 'Le sous-sol industriel' : '', 2.2);
      break;
    case 'jumpscare':
      if (ev.id !== me) break;
      if (sfx) sfx.jumpscare();
      if (hud) hud.showJumpscare();
      break;
    case 'dead':
      if (ev.id !== me && hud) hud.toast(`${ev.name} s'est fait attraper…`);
      break;
    case 'gameover':
    case 'win':
      // rendre le curseur pour le bouton Rejouer (Entrée marche aussi)
      if (document.pointerLockElement) document.exitPointerLock();
      if (ev.type === 'win' && sfx) sfx.win();
      if (hud) hud.showEnd(sim, NET.role === 'guest' ? null : () => initGame());
      if (H && H.embedded && NET.role !== 'guest') {
        const won = ev.type === 'win';
        H.report({
          id: `backrooms-${Date.now()}`,
          mode: 'Survie',
          players: sim.players.map((p) => ({ id: p.id, name: p.name, score: p.found + (won ? 10 : sim.level * 5), rank: won ? 1 : 2 })),
        });
      }
      break;
  }
}

// Boucle principale d'animation et de simulation
let lastTime = performance.now();
let accumulator = 0;

function loop(currentTime) {
  requestAnimationFrame(loop);

  const delta = Math.min(0.1, (currentTime - lastTime) / 1000);
  lastTime = currentTime;
  accumulator += delta;

  if (!sim) return;
  // en pause, le monde est figé (seul) ; à plusieurs, il continue sans toi. Le trajet en ascenseur, lui, va
  // toujours jusqu'au bout : sinon une pause pendant la descente laissait l'écran noir pour toujours
  if (paused && !multi() && !(sim.departT > 0)) accumulator = 0;

  // Lecture des entrées utilisateur (en mode sans souris, les flèches tournent la vue)
  const arrows = !kbMode;
  let mx = 0;
  let my = 0;
  if (keys['KeyW'] || keys['KeyZ'] || (arrows && keys['ArrowUp'])) my += 1;
  if (keys['KeyS'] || (arrows && keys['ArrowDown'])) my -= 1;
  if (keys['KeyA'] || keys['KeyQ'] || (arrows && keys['ArrowLeft'])) mx -= 1;
  if (keys['KeyD'] || (arrows && keys['ArrowRight'])) mx += 1;

  if (touch.move && !paused) {
    const dx = touch.move.x - touch.move.ox;
    const dy = touch.move.y - touch.move.oy;
    const d = Math.hypot(dx, dy);
    if (d > 10) {
      const k = Math.min(1, d / 60);
      mx = (dx / d) * k;
      my = (-dy / d) * k;
    }
  }
  const run = !!keys['ShiftLeft'] || !!keys['ShiftRight'] || touch.run;

  // Sensibilité de rotation de la souris
  const sens = 0.0022;
  let newYaw = sim.player.yaw - mouseDx * sens;
  let newPitch = Math.max(-1.3, Math.min(1.3, sim.player.pitch - mouseDy * sens));
  if (kbMode && !paused) {
    newYaw -= ((keys['ArrowRight'] ? 1 : 0) - (keys['ArrowLeft'] ? 1 : 0)) * TURN * delta;
    newPitch = Math.max(-1.3, Math.min(1.3, newPitch + ((keys['ArrowUp'] ? 1 : 0) - (keys['ArrowDown'] ? 1 : 0)) * TILT * delta));
  }
  mouseDx = 0;
  mouseDy = 0;

  // Simulation à pas fixe 60 Hz
  while (accumulator >= DT) {
    const oldX = sim.player.x;
    const oldZ = sim.player.z;

    const live = !paused;
    const input = {
      mx: live ? mx : 0,
      my: live ? my : 0,
      yaw: newYaw,
      pitch: newPitch,
      run: live && run,
      toggleFlashlight: toggleFlashlightRequested,
      use: useRequested,
    };
    if (NET.role === 'guest') {
      // l'invité se déplace chez lui ; lampe et objets partent tout de suite à l'hôte
      sim.predict(input);
      if (toggleFlashlightRequested) send('host', { t: 'a', k: 'f', run: NET.run });
      if (useRequested !== null) send('host', { t: 'a', k: 'u', i: useRequested, run: NET.run });
      if (NET.tick % 3 === 0) {
        const P = sim.player;
        send('host', { t: 'i', run: NET.run, mx: input.mx, my: input.my, r: input.run ? 1 : 0, yaw: +P.yaw.toFixed(3), pitch: +P.pitch.toFixed(3), x: +P.x.toFixed(2), z: +P.z.toFixed(2) }, true);
      }
    } else {
      sim.step(input, NET.role === 'host' ? guestInputs() : null);
    }
    NET.tick++;
    toggleFlashlightRequested = false;
    useRequested = null;

    // Détection de pas pour le son de marche sur moquette
    if (sim.state === 'playing') {
      const moved = Math.hypot(sim.player.x - oldX, sim.player.z - oldZ);
      stepDist += moved;
      const stepInterval = sim.player.running ? 1.25 : 0.85;
      if (stepDist >= stepInterval) {
        stepDist = 0;
        if (sfx) sfx.step();
      }
    }

    // Gestion des événements de la simulation (l'hôte les fait suivre aux invités)
    const me = sim.localId;
    for (const ev of sim.drainEvents()) {
      if (NET.role === 'host') NET.events.push(ev);
      handleEvent(ev, me);
    }
    if (NET.role === 'host' && NET.tick % 3 === 0 && H.players.length > 1) {
      // d'abord l'état, ensuite les événements : un événement ne précède jamais ce qu'il annonce
      send('all', { t: 's', run: NET.run, s: sim.snapshot() }, true);
      if (NET.events.length) {
        send('all', { t: 'e', run: NET.run, e: NET.events });
        NET.events = [];
      }
    }

    accumulator -= DT;
  }

  // Mise à jour du son continu de l'entité, et ses pas lourds quand elle te traque
  if (sfx && sim.hasMonster && sim.state === 'playing') {
    sfx.updateMonsterSound(sim.monster.danger, sim.monster.pan);
    if (!paused && sim.monster.mode === 'chase' && sim.monster.danger > 0.05) {
      monsterStepT -= delta;
      if (monsterStepT <= 0) {
        monsterStepT = 0.42;
        sfx.monsterStep(sim.monster.danger, sim.monster.pan);
      }
    }
  }

  // Rendu graphique et HUD
  if (scene) {
    scene.render(sim, currentTime / 1000);
  }
  if (hud) {
    hud.update(sim, sim.time, delta);
  }
}

// ?debug : accès à la partie depuis la console (tests)
if (/[?&]debug(&|=|$)/.test(location.search)) {
  window.__br = { get sim() { return sim; }, get scene() { return scene; }, keys, frame: (t) => loop(t) };
}

// Réglages (bouton ⚙ commun aux jeux) : son, et choix Souris / Sans souris
const btnSet = document.getElementById('btnSet');
if (window.DDVolume && btnSet) {
  btnSet.innerHTML = window.DDVolume.ICON || '⚙️';
  btnSet.addEventListener('click', () => {
    // ouvrir les réglages met la partie en pause et rend la souris
    if (document.pointerLockElement) document.exitPointerLock();
    if (!paused) setPaused(true);
  });
  window.DDVolume.panel(btnSet, {
    accent: '#ffcf3a',
    kinds: ['fx'],
    test: () => sfx && sfx.bottle(),
    sections: [
      { title: 'Jeu', items: [
        { label: 'Commandes', get: () => (kbMode ? 'kb' : 'mouse'), set: (v) => setKbMode(v === 'kb'), options: [['mouse', 'Souris'], ['kb', 'Sans souris']] },
      ] },
      { title: 'Commandes', items: [{ keys: [
        ['Se déplacer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou flèches'],
        ['Regarder', 'souris'],
        ['Courir', '<kbd>Maj</kbd>'],
        ['Lampe torche (case 1)', '<kbd>F</kbd> ou <kbd>1</kbd>'],
        ['Utiliser un objet', '<kbd>2</kbd> <kbd>3</kbd>'],
        ['Pause', '<kbd>Échap</kbd>'],
      ] }] },
      { title: 'Sans souris', items: [{ keys: [
        ['Se déplacer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd>'],
        ['Tourner la vue', '<kbd>←</kbd><kbd>→</kbd>'],
        ['Lever, baisser les yeux', '<kbd>↑</kbd><kbd>↓</kbd>'],
        ['Courir · lampe', '<kbd>Maj</kbd> · <kbd>F</kbd> ou <kbd>1</kbd>'],
        ['Utiliser un objet', '<kbd>2</kbd> <kbd>3</kbd>'],
        ['Jouer · pause', '<kbd>Entrée</kbd> · <kbd>Échap</kbd> ou <kbd>P</kbd>'],
      ] }] },
    ],
  });
}

// Initialisation HubBridge ou Solo
function boot(info) {
  if (!sfx) sfx = new BackroomsSfx();
  if (!hud) hud = new BackroomsHUD(hudEl, { play, setKbMode, use: useSlot });
  if (H && H.embedded) {
    NET.role = info.role === 'host' ? 'host' : info.role === 'guest' ? 'guest' : 'solo';
    NET.myId = info.myId;
    H.on('msg', onMsg);
    H.on('roster', onRoster);
    H.signalReady(); // après on('msg') : sinon les premiers messages de l'hôte se perdent
  }
  initGame(info.settings || {});
  if (NET.role === 'guest') {
    // demander la partie en cours à l'hôte (et la redemander tant qu'elle n'arrive pas)
    const ask = () => {
      if (!sim) {
        send('host', { t: 'hi' });
        setTimeout(ask, 1500);
      }
    };
    ask();
  }
  requestAnimationFrame(loop);
}

if (H && H.embedded) {
  H.on('init', boot);
} else {
  boot({ role: 'solo', settings: {} });
}
