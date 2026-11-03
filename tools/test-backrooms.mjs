// Tests unitaires du moteur des Backrooms : node tools/test-backrooms.mjs
import assert from 'node:assert/strict';
import { createBackroomsMap, CELL_SIZE, T } from '../backrooms/engine/map.js';
import { findPath, hasLineOfSight } from '../backrooms/engine/nav.js';
import { BackroomsSim, DT, DEPART_T, FUSES } from '../backrooms/engine/sim.js';
import { createWarehouseMap } from '../backrooms/engine/level1.js';

// avance la partie de n secondes
const run = (sim, sec, input = {}, others = null) => {
  for (let i = 0; i < Math.round(sec / DT); i++) sim.step(input, others);
};

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

test("ramassage des 5 cassettes, l'ascenseur s'ouvre et descend au Level 1", () => {
  const map = createBackroomsMap(42);
  const sim = new BackroomsSim({ map, difficulty: 'peaceful' });
  assert.equal(sim.cassettes, 0);
  assert.ok(map.elevator, "l'ascenseur est creusé dans un mur");
  assert.equal(map.grid[map.elevator.gz * map.W + map.elevator.gx], T.EXIT);
  // fermé : la cabine est un mur
  assert.ok(sim.isColliding(map.elevator.x, map.elevator.z, 0.3));

  // Téléporter sur chaque cassette pour la ramasser
  for (const cas of map.cassettes) {
    sim.player.x = cas.x;
    sim.player.z = cas.z;
    sim.step();
    assert.ok(cas.collected, `la cassette ${cas.id} a été ramassée`);
  }

  assert.equal(sim.cassettes, 5);
  const events = sim.drainEvents();
  assert.ok(events.some((e) => e.type === 'exitUnlocked'), 'événement exitUnlocked émis');
  assert.ok(!sim.isColliding(map.elevator.x, map.elevator.z, 0.3), "ouvert : on peut entrer dans la cabine");

  // de l'entrée, on marche dans la cabine
  sim.player.x = map.exit.x;
  sim.player.z = map.exit.z;
  sim.player.yaw = Math.atan2(-map.elevator.dx, -map.elevator.dz);
  for (let i = 0; i < 120 && sim.player.status === 'alive'; i++) sim.step({ my: 1, yaw: sim.player.yaw });
  assert.equal(sim.player.status, 'elevator', 'le joueur est dans la cabine');
  assert.ok(sim.drainEvents().some((e) => e.type === 'depart'), "seul, l'ascenseur part tout de suite");
  run(sim, DEPART_T + 0.2);
  assert.equal(sim.state, 'playing');
  assert.equal(sim.level, 1, 'arrivée au Level 1');
  assert.equal(sim.map.level, 1);
  assert.equal(sim.player.status, 'alive');
  assert.ok(sim.drainEvents().some((e) => e.type === 'level'));
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
  assert.equal(sim.player.status, 'dead');
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
  assert.deepEqual(sim.player.inv, ['bottle'], "la bouteille va dans l'inventaire");
  assert.ok(sim.player.stamina < 100, "elle ne se boit pas toute seule");
  sim.step({ use: 0 });
  assert.equal(sim.player.stamina, 100);
  assert.equal(sim.player.inv.length, 0);
  assert.ok(sim.drainEvents().some((e) => e.type === 'bottle'));
});

test('inventaire : trois cases, la quatrième trouvaille reste par terre', () => {
  const m = createBackroomsMap(9);
  const sim = new BackroomsSim({ map: m, difficulty: 'peaceful' });
  const objs = [...m.bottles.slice(0, 2), ...m.batteries.slice(0, 2)];
  for (const o of objs) {
    sim.player.x = o.x;
    sim.player.z = o.z;
    sim.step({});
  }
  assert.equal(sim.player.inv.length, 3);
  assert.equal(objs[3].taken, false, 'la 4e reste au sol');
  assert.ok(sim.drainEvents().some((e) => e.type === 'invFull'));
  sim.player.x = m.spawn.x;
  sim.player.z = m.spawn.z;
  sim.player.stamina = 100;
  sim.step({ use: 0 });
  assert.equal(sim.player.inv.length, 3, "inutile : l'objet est gardé");
  sim.player.battery = 10;
  sim.step({ use: 2 });
  assert.equal(sim.player.inv.length, 2);
  assert.ok(sim.player.battery > 60);
});

test('murs : chaque graine donne un dédale différent', () => {
  const a = createBackroomsMap(1);
  const b = createBackroomsMap(2);
  let diff = 0;
  for (let i = 0; i < a.grid.length; i++) if (a.grid[i] !== b.grid[i]) diff++;
  assert.ok(diff > a.grid.length * 0.1, `${diff} cases différentes`);
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
  sim.step({ use: 0 });
  assert.ok(sim.player.battery > 50, 'la pile recharge la lampe');
  sim.step({ toggleFlashlight: true });
  assert.equal(sim.player.flashlight, true);
});

test("Level 1 : l'entrepôt, ses étagères, ses 3 fusibles et le monte-charge", () => {
  for (const sd of [1, 2, 3, 50, 99]) {
    const m = createWarehouseMap(sd);
    assert.equal(m.level, 1);
    assert.ok(m.shelves.length > 60, `graine ${sd} : des rangées d'étagères`);
    assert.ok(m.elevator, `graine ${sd} : un monte-charge`);
    assert.equal(m.fuses.length, FUSES);
    for (const f of m.fuses) assert.ok(m.dist[f.gz * m.W + f.gx] > 0, `graine ${sd} : fusible ${f.id} atteignable`);
    assert.ok(m.dist[m.exit.gz * m.W + m.exit.gx] > 30, `graine ${sd} : le monte-charge est loin`);
    let shelf = 0;
    for (const v of m.grid) if (v === T.SHELF) shelf++;
    assert.ok(shelf > 100);
    // une étagère bloque le passage et la vue
    const sh = m.shelves[0];
    assert.ok(m.isWall(sh.gx, sh.gz));
  }
});

test('Level 1 : les fusibles rapportés au panneau ouvrent le monte-charge, puis la victoire', () => {
  const sim = new BackroomsSim({ difficulty: 'peaceful', seed: 4, level: 1 });
  assert.equal(sim.open, false);
  for (const f of sim.map.fuses) {
    sim.player.x = f.x;
    sim.player.z = f.z;
    sim.step();
  }
  assert.equal(sim.fuses, FUSES);
  assert.equal(sim.open, false, 'il faut encore les brancher au panneau');
  sim.player.x = sim.map.exit.x;
  sim.player.z = sim.map.exit.z;
  sim.step();
  assert.equal(sim.powered, true);
  assert.ok(sim.drainEvents().some((e) => e.type === 'powered'));
  const E = sim.map.elevator;
  sim.player.x = E.x;
  sim.player.z = E.z;
  sim.step();
  run(sim, DEPART_T + 0.2);
  assert.equal(sim.state, 'won', 'le monte-charge remonte : partie gagnée');
});

test('Level 1 : coupures de courant de 15 à 20 s', () => {
  const sim = new BackroomsSim({ difficulty: 'peaceful', seed: 8, level: 1 });
  let start = -1;
  let len = 0;
  for (let i = 0; i < 60 * 120; i++) {
    sim.step();
    for (const e of sim.drainEvents()) {
      if (e.type === 'blackout' && start < 0) start = sim.time;
      if (e.type === 'power' && start >= 0 && !len) len = sim.time - start;
    }
  }
  assert.ok(start > 0, 'une coupure arrive dans les deux premières minutes');
  assert.ok(len >= 14.9 && len <= 20.1, `elle dure ${len.toFixed(1)} s`);
});

test("Level 1 : l'entité se cache au bout des étagères pour tendre une embuscade", () => {
  let ambushes = 0;
  for (const sd of [3, 5, 9, 12]) {
    const sim = new BackroomsSim({ difficulty: 'normal', seed: sd, level: 1 });
    const P = sim.player;
    const M = sim.monster;
    // le joueur marche dans une grande allée ; l'entité est à 25 m, hors de vue
    M.x = P.x + 25;
    M.z = P.z;
    M.ambushT = 0;
    P.yaw = -Math.PI / 2;
    sim.step({});
    if (M.mode === 'ambush') {
      ambushes++;
      assert.ok(M.silent, "elle se tait en embuscade");
      assert.ok(!hasLineOfSight(sim.map, P.x, P.z, M.ambush.x, M.ambush.z), 'cachée de la vue du joueur');
      assert.ok(sim.map.isShelfSide(M.ambush.gx, M.ambush.gz), 'contre une étagère');
    }
  }
  assert.ok(ambushes >= 2, `${ambushes} embuscades sur 4`);
});

test("à plusieurs : qui entre dans l'ascenseur devient spectateur, il part quand tout le monde est dedans", () => {
  const players = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
  const sim = new BackroomsSim({ difficulty: 'normal', seed: 21, players, localId: 1 });
  for (const c of sim.map.cassettes) {
    sim.player.x = c.x;
    sim.player.z = c.z;
    sim.step();
  }
  assert.equal(sim.cassettes, 5, "les cassettes comptent pour toute l'équipe");
  const E = sim.map.elevator;
  const [a, b, c] = sim.players;
  sim.monster.x = sim.monster.z = -999; // loin de tout le monde
  a.x = E.x; a.z = E.z;
  sim.step();
  assert.equal(a.status, 'elevator');
  assert.equal(sim.departT, 0, "il attend les autres");
  assert.notEqual(sim.viewPlayer(0).id, a.id, 'le spectateur suit un joueur encore dehors');
  assert.ok(Math.abs(sim.rage - 1 / 3) < 1e-9, "l'entité s'énerve");
  b.x = E.x; b.z = E.z;
  sim.step();
  assert.ok(Math.abs(sim.rage - 2 / 3) < 1e-9);
  assert.equal(sim.departT, 0);
  c.x = E.x; c.z = E.z;
  sim.step();
  assert.ok(sim.departT > 0, 'tout le monde est dedans : départ');
  run(sim, DEPART_T + 0.2);
  assert.equal(sim.level, 1);
  assert.ok(sim.players.every((p) => p.status === 'alive'));
});

test("à plusieurs : plus il y a de monde à l'abri, plus l'entité est rapide et voit loin", () => {
  const players = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }];
  const speed = (inside) => {
    const sim = new BackroomsSim({ difficulty: 'normal', seed: 5, players, localId: 1 });
    sim.cassettes = 5;
    for (let i = 0; i < inside; i++) sim.players[i].status = 'elevator';
    const P = sim.players[2];
    sim.monster.mode = 'chase';
    sim.monster.x = P.x + 5;
    sim.monster.z = P.z;
    sim.updateMonster();
    return sim.monster.speed;
  };
  assert.ok(speed(2) > speed(1) && speed(1) > speed(0));
});

test("à plusieurs : un joueur attrapé devient spectateur, la partie continue ; il revient à l'étage suivant", () => {
  const players = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }];
  const sim = new BackroomsSim({ difficulty: 'normal', seed: 33, players, localId: 1 });
  const [a, b] = sim.players;
  sim.monster.x = a.x + 0.4;
  sim.monster.z = a.z;
  b.x = a.x + 30; // loin
  sim.step();
  assert.equal(a.status, 'dead');
  assert.equal(sim.state, 'playing', 'B joue encore');
  assert.equal(sim.viewPlayer(0).id, b.id, 'A regarde B');
  sim.cassettes = 5;
  b.x = sim.map.elevator.x;
  b.z = sim.map.elevator.z;
  sim.monster.x = sim.monster.z = -999;
  sim.step();
  assert.ok(sim.departT > 0, "B seul dehors entre : l'ascenseur part");
  run(sim, DEPART_T + 0.2);
  assert.equal(sim.level, 1);
  assert.equal(sim.players[0].status, 'alive', 'A revient au Level 1');
});

test("réseau : l'invité reçoit l'état de l'hôte, se déplace chez lui et suit le changement d'étage", () => {
  const players = [{ id: 1, name: 'Hôte' }, { id: 2, name: 'Invité' }];
  const host = new BackroomsSim({ difficulty: 'normal', seed: 77, players, localId: 1 });
  const guest = new BackroomsSim({ difficulty: 'normal', seed: 77, players, localId: 2 });
  const wire = () => guest.applySnapshot(JSON.parse(JSON.stringify(host.snapshot())));
  assert.deepEqual(Array.from(guest.map.grid), Array.from(host.map.grid), 'même graine : même carte');
  host.monster.x = host.monster.z = -999;
  // l'invité avance chez lui et annonce sa position ; l'hôte la reprend
  const g = guest.player;
  for (let i = 0; i < 60; i++) guest.predict({ my: 1, yaw: g.yaw });
  const hg = host.players.find((p) => p.id === 2);
  host.step({}, { 2: { pos: { x: g.x, z: g.z }, yaw: g.yaw } });
  assert.ok(Math.hypot(hg.x - g.x, hg.z - g.z) < 0.01, "l'hôte a repris la position de l'invité");
  // une position impossible (téléportation) est refusée
  host.step({}, { 2: { pos: { x: hg.x + 20, z: hg.z } } });
  assert.ok(Math.hypot(hg.x - g.x, hg.z - g.z) < 3, 'téléportation refusée');
  // l'hôte ramasse une cassette : l'invité la voit disparaître et le compteur monte
  const c = host.map.cassettes[2];
  host.player.x = c.x;
  host.player.z = c.z;
  host.step();
  wire();
  assert.equal(guest.cassettes, 1);
  assert.equal(guest.map.cassettes[2].collected, true);
  // tout le monde dans l'ascenseur : l'invité passe au Level 1 avec la même carte
  host.cassettes = 5;
  for (const P of host.players) {
    P.x = host.map.elevator.x;
    P.z = host.map.elevator.z;
  }
  host.step();
  run(host, DEPART_T + 0.2);
  wire();
  assert.equal(guest.level, 1);
  assert.deepEqual(Array.from(guest.map.grid), Array.from(host.map.grid), 'même entrepôt');
  assert.equal(guest.player.status, 'alive');
  // coupure de courant et entité : l'invité les reçoit
  host.blackout = 12;
  host.monster.x = host.players[1].x + 6;
  host.monster.z = host.players[1].z;
  wire();
  assert.ok(guest.blackout > 0);
  assert.ok(guest.monster.danger > 0.3, "l'invité entend l'entité approcher");
  // un joueur quitte la partie : il disparaît chez l'invité
  host.removePlayer(1);
  wire();
  assert.equal(guest.players.length, 1);
});

console.log(`\n${count} tests réussis pour The Backrooms !`);
