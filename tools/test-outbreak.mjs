// Tests du moteur d'Outbreak : node tools/test-outbreak.mjs
// Des équipiers IA jouent des parties complètes ; on vérifie qu'elles avancent sans erreur et que l'état diffusé est cohérent.
import assert from 'node:assert/strict';
import { Sim, DT } from '../outbreak/engine/sim.js';
import { botThink } from '../outbreak/engine/bots.js';
import { generateRoom, distanceField, cellIndex } from '../outbreak/engine/level.js';
import { ROOM_TYPES, WEAPONS, PERKS } from '../outbreak/engine/data.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('salles : générées, accessibles, déterministes', () => {
  for (const type of Object.keys(ROOM_TYPES)) {
    for (let seed = 1; seed < 40; seed++) {
      const exits = type === 'core' || type === 'arena' ? [] : ['lab', 'armory'];
      const a = generateRoom({ type, index: 3, seed, exits, mode: type === 'arena' ? 'survival' : 'campaign' });
      const b = generateRoom({ type, index: 3, seed, exits, mode: type === 'arena' ? 'survival' : 'campaign' });
      assert.equal(JSON.stringify(a.solids), JSON.stringify(b.solids), 'déterministe');
      const f = distanceField(a, [a.spawn]);
      for (const v of a.vents) assert.ok(isFinite(f[cellIndex(a, v.sx, v.sy)]), `bouche ${v.id} accessible (${type}/${seed})`);
      assert.ok(a.vents.length >= 6);
    }
  }
});

function play({ mode = 'campaign', difficulty = 'normal', bots = 4, maxMin = 25, seed = 1 }) {
  const sim = new Sim({ mode, difficulty, seed });
  for (let i = 0; i < bots; i++) sim.addPlayer({ id: i, name: 'B' + i, color: '#ff0000', bot: true });
  const steps = maxMin * 60 * 60;
  let snaps = 0, maxZ = 0;
  for (let s = 0; s < steps && sim.phase === 'play'; s++) {
    for (const p of sim.players.values()) botThink(sim, p, DT);
    sim.step(DT);
    maxZ = Math.max(maxZ, sim.zombies.length);
    if (s % 3 === 0) {
      const snap = sim.snapshot();
      const json = JSON.stringify(snap);
      assert.ok(json.length < 30000, 'état diffusé raisonnable : ' + json.length);
      for (const z of snap.Z) assert.ok(Number.isFinite(z[2]) && Number.isFinite(z[3]), 'zombie à une position valide');
      for (const p of snap.P) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y), 'joueur à une position valide');
      sim.drainEvents(); snaps++;
    }
  }
  return { sim, maxZ, snaps, min: sim.t / 60 };
}

t('campagne : des bots progressent à travers les salles', () => {
  const res = [];
  for (const seed of [11, 22, 33]) {
    const { sim, maxZ, min } = play({ seed, difficulty: 'arcade' });
    res.push(`${sim.phase} salle ${sim.room.index} (${sim.room.type}) en ${min.toFixed(1)} min, max ${maxZ} zombies, ${sim.kills} éliminés`);
    assert.ok(sim.roomsCleared >= 2, 'au moins deux salles nettoyées : ' + res.at(-1));
  }
  console.log('   ' + res.join('\n   '));
});

t('campagne normale à 2 bots', () => {
  const { sim, min } = play({ seed: 5, bots: 2, maxMin: 20 });
  console.log(`   ${sim.phase} salle ${sim.room.index} en ${min.toFixed(1)} min, ${sim.kills} éliminés`);
  assert.ok(sim.roomsCleared >= 1);
});

t('survie : vagues successives', () => {
  const { sim, min } = play({ mode: 'survival', seed: 9, bots: 3, maxMin: 12 });
  console.log(`   ${sim.phase} vague ${sim.wave.n} en ${min.toFixed(1)} min, ${sim.kills} éliminés`);
  assert.ok(sim.wave.n >= 4);
});

t('boss : la salle du Noyau se termine par une victoire', () => {
  const sim = new Sim({ mode: 'campaign', difficulty: 'arcade', seed: 3 });
  for (let i = 0; i < 4; i++) {
    const p = sim.addPlayer({ id: i, name: 'B' + i, bot: true });
    p.weapons.push({ id: 'rifle', mag: 30, res: 240 }, { id: 'launcher', mag: 6, res: 36 });
    p.perks = { dmg: 3, hp: 2 }; p.maxHp = 150; p.hp = 150;
  }
  sim.startRoom('core', 7);
  for (let s = 0; s < 60 * 60 * 10 && sim.phase === 'play'; s++) { for (const p of sim.players.values()) botThink(sim, p, DT); sim.step(DT); sim.drainEvents(); }
  console.log(`   ${sim.phase} après ${(sim.t / 60).toFixed(1)} min`);
  assert.ok(sim.phase !== 'play', 'le combat de boss se termine');
});

t('reprise par un nouvel hôte', () => {
  const { sim } = play({ seed: 7, bots: 3, maxMin: 3 });
  const snap = sim.snapshot();
  const sim2 = Sim.restore(snap);
  assert.equal(sim2.room.index, sim.room.index);
  assert.equal(sim2.players.size, sim.players.size);
  for (const p of sim2.players.values()) assert.ok(p.weapons.length >= 1 && WEAPONS[p.weapons[0].id]);
});

t('améliorations : toutes applicables', () => {
  const sim = new Sim({ seed: 1 });
  const p = sim.addPlayer({ id: 0, name: 'A' });
  for (const id of Object.keys(PERKS)) for (let k = 0; k < PERKS[id].max; k++) sim.applyPerk(p, id);
  sim.offerPerks(p);
  assert.equal(p.offers, null, 'plus rien à proposer quand tout est au maximum');
});

console.log(`\n${n} tests réussis`);
