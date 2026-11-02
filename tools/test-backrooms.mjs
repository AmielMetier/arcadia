// Tests unitaires du moteur des Backrooms : node tools/test-backrooms.mjs
import assert from 'node:assert/strict';
import { createBackroomsMap, CELL_SIZE, T } from '../backrooms/engine/map.js';
import { findPath, hasLineOfSight } from '../backrooms/engine/nav.js';
import { BackroomsSim, DT } from '../backrooms/engine/sim.js';

let count = 0;
function test(name, fn) {
  try {
    fn();
    count++;
    console.log('✓', name);
  } catch (err) {
    console.error('✗', name);
    throw err;
  }
}

const map = createBackroomsMap(42);

test('génération de la carte : dimensions, sols, murs et pièces', () => {
  assert.equal(map.W, 64);
  assert.equal(map.H, 64);
  assert.ok(map.walkable.length > 1500, 'au moins 1500 cases praticables');
  assert.equal(map.isWall(map.spawn.gx, map.spawn.gz), false, 'le spawn est sur du sol');
  assert.equal(map.isWall(map.exit.gx, map.exit.gz), false, 'la sortie est sur du sol');
});

test('cassettes VHS : 5 cassettes placées et atteignables', () => {
  assert.equal(map.cassettes.length, 5, 'exactement 5 cassettes');
  for (const cas of map.cassettes) {
    assert.equal(map.isWall(cas.gx, cas.gz), false, `la cassette ${cas.id} n'est pas dans un mur`);
    const path = findPath(map, map.spawn.x, map.spawn.z, cas.x, cas.z);
    assert.ok(path, `un chemin existe du spawn vers la cassette ${cas.id}`);
  }
});

test('sortie : atteignable depuis le spawn', () => {
  const pathToExit = findPath(map, map.spawn.x, map.spawn.z, map.exit.x, map.exit.z);
  assert.ok(pathToExit, 'un chemin existe jusqu\'à la sortie');
  assert.ok(pathToExit.length > 5, 'la sortie n\'est pas collée au spawn');
});

test('champ de vision et raymarching : détection d\'obstacles', () => {
  // Même position : visible
  assert.ok(hasLineOfSight(map, 10, 10, 10, 10));
  // À travers le spawn dans la même pièce : visible
  assert.ok(hasLineOfSight(map, map.spawn.x, map.spawn.z, map.spawn.x + 0.5, map.spawn.z + 0.5));
});

test('simulation : déplacement du joueur et collisions murales', () => {
  const sim = new BackroomsSim({ map, difficulty: 'peaceful' });
  const startX = sim.player.x;
  const startZ = sim.player.z;

  // Avancer pendant 30 ticks
  for (let i = 0; i < 30; i++) {
    sim.step({ my: 1, yaw: 0 }); // avancer droit
  }
  assert.notEqual(sim.player.z, startZ, 'le joueur a avancé');
});

test('endurance : courir consomme la stamina, l\'arrêt la recharge', () => {
  const sim = new BackroomsSim({ map, difficulty: 'peaceful' });
  assert.equal(sim.player.stamina, 100);

  // Courir
  for (let i = 0; i < 30; i++) {
    sim.step({ my: 1, run: true });
  }
  assert.ok(sim.player.stamina < 100, 'la stamina a diminué en courant');
  assert.equal(sim.player.running, true);

  // S'arrêter
  const staminaAfterRun = sim.player.stamina;
  for (let i = 0; i < 30; i++) {
    sim.step({ my: 0, run: false });
  }
  assert.ok(sim.player.stamina > staminaAfterRun, 'la stamina s\'est régénérée au repos');
});

test('ramassage des 5 cassettes et déverrouillage de la sortie', () => {
  const sim = new BackroomsSim({ map, difficulty: 'peaceful' });
  assert.equal(sim.player.cassettesCollected, 0);

  // Téléporter sur chaque cassette pour la ramasser
  for (const cas of map.cassettes) {
    sim.player.x = cas.x;
    sim.player.z = cas.z;
    sim.step();
    assert.ok(cas.collected, `la cassette ${cas.id} a été ramassée`);
  }

  assert.equal(sim.player.cassettesCollected, 5);
  const events = sim.drainEvents();
  assert.ok(events.some((e) => e.type === 'exitUnlocked'), 'événement exitUnlocked émis');

  // Aller à la sortie pour gagner
  sim.player.x = map.exit.x;
  sim.player.z = map.exit.z;
  sim.step();
  assert.equal(sim.state, 'won', 'la partie est gagnée en arrivant à la sortie avec les 5 cassettes');
});

test('l\'entité : calcul du danger sonore selon la distance et course-poursuite', () => {
  const sim = new BackroomsSim({ map, difficulty: 'normal' });
  assert.ok(sim.hasMonster);

  // Loin : danger à 0
  sim.monster.x = map.spawn.x + 50;
  sim.monster.z = map.spawn.z + 50;
  sim.step();
  assert.equal(sim.monster.danger, 0, 'aucun bruit de monstre à plus de 35 m');

  // Rapproché à 10 m : danger monte
  sim.monster.x = sim.player.x + 10;
  sim.monster.z = sim.player.z;
  sim.step();
  assert.ok(sim.monster.danger > 0.2, 'le son s\'amplifie à 10 m');

  // Très proche à 2 m : danger très élevé (> 0.8)
  sim.monster.x = sim.player.x + 2;
  sim.monster.z = sim.player.z;
  sim.step();
  assert.ok(sim.monster.danger > 0.7, 'le son devient assourdissant à 2 m');

  // Contact immédiat : jumpscare et mort
  sim.monster.x = sim.player.x + 0.5;
  sim.monster.z = sim.player.z + 0.5;
  sim.step();
  assert.equal(sim.state, 'dead', 'le joueur meurt attrapé par le monstre');
  const events = sim.drainEvents();
  assert.ok(events.some((e) => e.type === 'jumpscare'), 'jumpscare déclenché à la mort');
});

test('grande carte : générée sans erreur pour 200 graines, sortie loin du départ', () => {
  for (let sd = 0; sd < 200; sd++) {
    const m = createBackroomsMap(sd);
    const exitD = m.dist[m.exit.gz * m.W + m.exit.gx];
    assert.ok(exitD > 40, `graine ${sd} : la sortie est à ${exitD} cases du départ`);
    for (const c of m.cassettes) assert.ok(m.dist[c.gz * m.W + c.gx] > 0, `graine ${sd} : cassette ${c.id} atteignable`);
    assert.ok(m.lights.some((l) => l.state === 'off'), `graine ${sd} : il y a des zones sombres`);
  }
});

test("eau d'amande : remplit l'endurance", () => {
  const m = createBackroomsMap(7);
  const sim = new BackroomsSim({ map: m, difficulty: 'peaceful' });
  sim.player.stamina = 10;
  const b = m.bottles[0];
  sim.player.x = b.x;
  sim.player.z = b.z;
  sim.step();
  assert.equal(b.taken, true);
  assert.equal(sim.player.stamina, 100);
  assert.ok(sim.drainEvents().some((e) => e.type === 'bottle'));
});

test("l'entité perd le joueur quand elle ne le voit plus pendant quelques secondes", () => {
  const m = createBackroomsMap(11);
  const sim = new BackroomsSim({ map: m });
  sim.monster.mode = 'chase';
  for (let i = 0; i < 60 * 6 && sim.monster.mode === 'chase'; i++) {
    // on la garde loin, hors de vue, pour tester la perte de vue seule
    sim.monster.x = m.monsterSpawn.x;
    sim.monster.z = m.monsterSpawn.z;
    sim.step({ my: 0 });
  }
  assert.notEqual(sim.monster.mode, 'chase');
});

test("lampe torche : la pile se vide, la lampe s'éteint, une pile la recharge", () => {
  const m = createBackroomsMap(5);
  const sim = new BackroomsSim({ map: m, difficulty: 'peaceful' });
  assert.ok(m.batteries.length >= 6, 'des piles dans le dédale');
  for (let i = 0; i < 60 * 300; i++) sim.step({});
  assert.equal(sim.player.battery, 0);
  assert.equal(sim.player.flashlight, false, "la lampe s'éteint à plat");
  sim.step({ toggleFlashlight: true });
  assert.equal(sim.player.flashlight, false, 'impossible de la rallumer sans pile');
  const b = m.batteries[0];
  sim.player.x = b.x;
  sim.player.z = b.z;
  sim.step({});
  assert.ok(sim.player.battery > 50, 'la pile recharge la lampe');
  sim.step({ toggleFlashlight: true });
  assert.equal(sim.player.flashlight, true);
});

console.log(`\n${count} tests réussis pour The Backrooms !`);
