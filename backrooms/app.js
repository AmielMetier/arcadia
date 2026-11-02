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

// Gestion des touches du clavier
const keys = {};
let mouseDx = 0;
let mouseDy = 0;
let isPointerLocked = false;
let toggleFlashlightRequested = false;

window.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'KeyF') {
    toggleFlashlightRequested = true;
  }
  if (sfx) sfx.unlock();
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
});

// Pointer Lock pour la visée à la souris
stageEl.addEventListener('click', () => {
  if (sfx) sfx.unlock();
  if (!isPointerLocked) {
    stageEl.requestPointerLock?.();
  }
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === stageEl;
  if (hud) hud.setPromptVisible(!isPointerLocked);
});

document.addEventListener('mousemove', (e) => {
  if (isPointerLocked) {
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
    hud = new BackroomsHUD(hudEl);
  }

  stepDist = 0;
  hud.setPromptVisible(!isPointerLocked);
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

  // Lecture des entrées utilisateur
  let mx = 0;
  let my = 0;
  if (keys['KeyW'] || keys['KeyZ'] || keys['ArrowUp']) my += 1;
  if (keys['KeyS'] || keys['ArrowDown']) my -= 1;
  if (keys['KeyA'] || keys['KeyQ'] || keys['ArrowLeft']) mx -= 1;
  if (keys['KeyD'] || keys['ArrowRight']) mx += 1;

  const run = !!keys['ShiftLeft'] || !!keys['ShiftRight'];

  // Sensibilité de rotation de la souris
  const sens = 0.0022;
  let newYaw = sim.player.yaw - mouseDx * sens;
  let newPitch = Math.max(-1.3, Math.min(1.3, sim.player.pitch - mouseDy * sens));
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
      } else if (ev.type === 'spotted') {
        if (sfx) sfx.spotted();
      } else if (ev.type === 'jumpscare') {
        if (sfx) sfx.jumpscare();
        if (hud) hud.showJumpscare();
      } else if (ev.type === 'dead') {
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

  // Mise à jour du son continu de l'entité
  if (sfx && sim.hasMonster && sim.state === 'playing') {
    sfx.updateMonsterSound(sim.monster.danger, sim.monster.pan);
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
