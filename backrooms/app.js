// The Backrooms - Logique applicative principale, entrées clavier/souris et boucle de jeu
import { createBackroomsMap } from './engine/map.js';
import { BackroomsSim, DT } from './engine/sim.js';
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

// Gestion des touches du clavier
// Mode sans souris (comme Mystère Mystère) : ZQSD pour marcher, les flèches tournent la vue, Échap ou P met en pause.
const TURN = 2.2; // vitesse de la vue aux flèches (rad/s)
const TILT = 1.4;
const keys = {};
let mouseDx = 0;
let mouseDy = 0;
let isPointerLocked = false;
let toggleFlashlightRequested = false;
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
  if (paused) {
    if (kbMode && (e.code === 'Enter' || e.code === 'Space')) play();
    return;
  }
  keys[e.code] = true;
  if (e.code === 'KeyF' && !e.repeat) toggleFlashlightRequested = true;
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

function initGame(settings = {}) {
  const seed = Math.floor(Math.random() * 100000);
  const difficulty = settings.difficulty || 'normal';

  const map = createBackroomsMap(seed);
  sim = new BackroomsSim({ map, difficulty, seed });

  if (!scene) {
    scene = createBackroomsScene(stageEl, map);
  } else {
    // Nettoyer ancienne scène si restart
    scene.dispose();
    stageEl.innerHTML = '';
    scene = createBackroomsScene(stageEl, map);
  }

  if (!sfx) {
    sfx = new BackroomsSfx();
  }
  if (!hud) {
    hud = new BackroomsHUD(hudEl, { play, setKbMode });
  }

  stepDist = 0;
  setPaused(kbMode ? paused : !isPointerLocked);
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
  // en pause, le monde est figé : on redessine seulement
  if (paused) accumulator = 0;

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

    sim.step({
      mx,
      my,
      yaw: newYaw,
      pitch: newPitch,
      run,
      toggleFlashlight: toggleFlashlightRequested,
    });
    toggleFlashlightRequested = false;

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

    // Gestion des événements de la simulation
    const events = sim.drainEvents();
    for (const ev of events) {
      if (ev.type === 'cassette') {
        if (sfx) sfx.cassette();
      } else if (ev.type === 'exitUnlocked') {
        if (sfx) sfx.exitUnlocked();
      } else if (ev.type === 'bottle') {
        if (sfx) sfx.bottle();
        if (hud) hud.toast("Eau d'amande : endurance au maximum");
      } else if (ev.type === 'battery') {
        if (sfx) sfx.battery();
        if (hud) hud.toast('Piles : lampe rechargée');
      } else if (ev.type === 'batteryEmpty') {
        if (sfx) sfx.battery(true);
        if (hud) hud.toast('Plus de pile… trouve-en dans le noir');
      } else if (ev.type === 'spotted') {
        if (sfx) sfx.spotted();
      } else if (ev.type === 'jumpscare') {
        if (sfx) sfx.jumpscare();
        if (hud) hud.showJumpscare();
      } else if (ev.type === 'dead' || ev.type === 'win') {
        // rendre le curseur pour le bouton Rejouer (Entrée marche aussi)
        if (document.pointerLockElement) document.exitPointerLock();
      }
      if (ev.type === 'dead') {
        if (hud) hud.showEnd(sim, () => initGame());
        if (H && H.embedded) {
          H.report({
            id: `backrooms-${Date.now()}`,
            mode: 'Survie',
            players: [{ id: 0, name: 'Joueur', score: sim.player.cassettesCollected, rank: 2 }],
          });
        }
      } else if (ev.type === 'win') {
        if (sfx) sfx.win();
        if (hud) hud.showEnd(sim, () => initGame());
        if (H && H.embedded) {
          H.report({
            id: `backrooms-${Date.now()}`,
            mode: 'Survie',
            players: [{ id: 0, name: 'Joueur', score: 5, rank: 1 }],
          });
        }
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
        ['Lampe torche', '<kbd>F</kbd>'],
        ['Pause', '<kbd>Échap</kbd>'],
      ] }] },
      { title: 'Sans souris', items: [{ keys: [
        ['Se déplacer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd>'],
        ['Tourner la vue', '<kbd>←</kbd><kbd>→</kbd>'],
        ['Lever, baisser les yeux', '<kbd>↑</kbd><kbd>↓</kbd>'],
        ['Courir · lampe', '<kbd>Maj</kbd> · <kbd>F</kbd>'],
        ['Jouer · pause', '<kbd>Entrée</kbd> · <kbd>Échap</kbd> ou <kbd>P</kbd>'],
      ] }] },
    ],
  });
}

// Initialisation HubBridge ou Solo
function boot(info) {
  initGame(info.settings || {});
  if (H && H.embedded) {
    H.signalReady();
  }
  requestAnimationFrame(loop);
}

if (H && H.embedded) {
  H.on('init', boot);
} else {
  boot({ role: 'solo', settings: {} });
}
