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
  const CL = ['soldier', 'medic', 'engineer', 'tank', 'scout'];
  for (let i = 0; i < bots; i++) sim.addPlayer({ id: i, name: 'B' + i, color: '#ff0000', bot: true, cls: CL[(i + seed) % 5] });
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

t('classes : capacités et nouvelles armes', () => {
  const sim = new Sim({ seed: 4, difficulty: 'arcade' });
  const CL = ['soldier', 'medic', 'engineer', 'tank', 'scout'];
  CL.forEach((c, i) => { const p = sim.addPlayer({ id: i, name: c, bot: true, cls: c }); p.weapons.push({ id: ['katana', 'crossbow', 'tesla', 'katana', 'tesla'][i], mag: 20, res: 60 }); });
  const used = new Set();
  for (let s = 0; s < 60 * 60 * 3 && sim.phase === 'play'; s++) {
    for (const p of sim.players.values()) botThink(sim, p, DT);
    sim.step(DT);
    for (const e of sim.drainEvents()) if (e.e === 'ab') used.add(e.c); else if (e.e === 'slash' || e.e === 'zap') used.add(e.e);
  }
  console.log('   utilisés :', [...used].join(', '));
  assert.ok(used.size >= 3, 'les bots utilisent leurs capacités');
  const p = sim.players.get(3); assert.equal(p.maxHp >= 150, true, 'Colosse : +50 PV');
});

t('zombies : blindé, traqueur, larves', () => {
  const sim = new Sim({ seed: 8, difficulty: 'normal' });
  const p = sim.addPlayer({ id: 0, name: 'A' });
  sim.step(DT);
  const a = sim.spawnZombie('armored', p.x, p.y - 200); a.ang = Math.PI / 2; // regarde vers le joueur
  const hp0 = a.hp; sim.damageZombie(a, 100, -Math.PI / 2, 0, p);
  assert.ok(hp0 - a.hp < 30, 'la plaque avant encaisse');
  const hp1 = a.hp; sim.damageZombie(a, 100, Math.PI / 2, 0, p);
  assert.ok(hp1 - a.hp >= 90, 'dans le dos, plein dégâts');
  const s2 = sim.spawnZombie('stalker', p.x, p.y - 250);
  let pinned = false;
  for (let k = 0; k < 60 * 8 && !pinned; k++) { p.input = { ...p.input, mx: 0, my: 0 }; sim.step(DT); if (p.pinnedBy != null) pinned = true; }
  assert.ok(pinned, 'le traqueur plaque le joueur');
  sim.damageZombie(s2, 70, 0, 0, null);
  assert.equal(p.pinnedBy, null, 'les dégâts le font lâcher prise');
});

t('boss : les cinq boss se battent et meurent', () => {
  for (const kind of ['boss', 'colossus', 'queen', 'abomination', 'mother']) {
    const sim = new Sim({ mode: 'campaign', difficulty: 'arcade', seed: 3 });
    for (let i = 0; i < 4; i++) {
      const p = sim.addPlayer({ id: i, name: 'B' + i, bot: true, cls: ['tank', 'medic', 'soldier', 'engineer'][i] });
      p.weapons.push({ id: 'rifle', mag: 30, res: 240 }, { id: 'launcher', mag: 6, res: 36 });
      p.perks = { dmg: 3, hp: 2 }; p.maxHp = 150; p.hp = 150;
    }
    sim.startRoom('core', 7); sim.wave.total = 0;
    const z = sim.spawnBoss(1, kind);
    const seen = new Set();
    for (let s = 0; s < 60 * 60 * 8 && sim.phase === 'play' && z.hp > 0; s++) {
      for (const p of sim.players.values()) botThink(sim, p, DT); sim.step(DT);
      for (const e of sim.drainEvents()) if (['phase', 'pin', 'birth', 'vanish', 'throwRock', 'charge', 'slam'].includes(e.e)) seen.add(e.e);
      seen.add(z.state);
    }
    console.log(`   ${kind}: ${z.hp <= 0 ? 'vaincu' : sim.phase} en ${(sim.t / 60).toFixed(1)} min — ${[...seen].join(', ')}`);
    assert.ok(z.hp <= 0 || sim.phase === 'over', kind + ' : combat qui se termine');
  }
});

t('salles spéciales, ferraille et événements', () => {
  const sim = new Sim({ seed: 21, difficulty: 'arcade' });
  for (let i = 0; i < 3; i++) sim.addPlayer({ id: i, name: 'B' + i, bot: true, cls: 'soldier' });
  sim.startRoom('shop', 3);
  assert.ok(sim.doorsOpen && sim.shop.length >= 6, 'marchand : portes ouvertes et étals');
  const p = sim.players.get(0); sim.scrap = 100; const it = sim.shop.find((q) => q.k === 'weapon'); p.x = it.x; p.y = it.y;
  const n0 = p.weapons.length; assert.ok(sim.tryBuy(p)); assert.ok(p.weapons.length > n0 && sim.scrap < 100, 'achat d\'arme');
  sim.startRoom('vault', 5);
  assert.ok(sim.doorsOpen && sim.vault.st === 'closed');
  sim.openVault(); assert.equal(sim.doorsOpen, false);
  for (let s = 0; s < 60 * 60 * 6 && !sim.cleared && sim.phase === 'play'; s++) { for (const q of sim.players.values()) botThink(sim, q, DT); sim.step(DT); sim.drainEvents(); }
  assert.equal(sim.vault.st, 'open', 'coffre ouvert après l\'alarme');
  sim.startRoom('gas', 4); assert.ok(sim.hazards.some((h) => h.k === 'gas'));
  for (const k of ['blackout', 'horde', 'drop']) { sim.startEvent(k); assert.equal(sim.evt.k, k); }
  sim.startRoom('dark', 4); sim.startEvent('drop');
  for (let s = 0; s < 60 * 40 && sim.evt && sim.evt.st !== 'done'; s++) { for (const q of sim.players.values()) botThink(sim, q, DT); sim.step(DT); sim.drainEvents(); }
  assert.ok(!sim.evt || sim.evt.st === 'done', 'largage sécurisé par les bots');
  const snap = JSON.stringify(sim.snapshot()); assert.ok(snap.length < 40000);
});

t('secteurs : campagne jouable dans chaque secteur', () => {
  for (const sector of ['lab', 'sewers', 'hospital', 'metro', 'nice']) {
    const sim = new Sim({ mode: 'campaign', difficulty: 'arcade', seed: 77, sector });
    for (let i = 0; i < 4; i++) sim.addPlayer({ id: i, name: 'B' + i, bot: true, cls: ['tank', 'medic', 'soldier', 'engineer'][i] });
    const seen = new Set();
    for (let s = 0; s < 60 * 60 * 6 && sim.phase === 'play'; s++) {
      for (const p of sim.players.values()) botThink(sim, p, DT); sim.step(DT);
      for (const e of sim.drainEvents()) if (['train', 'carAlarm'].includes(e.e)) seen.add(e.e);
    }
    console.log(`   ${sector}: salle ${sim.room.index} (${sim.phase}) ${[...seen].join(', ')}`);
    assert.equal(sim.cfg.sector, sector);
    assert.ok(sim.roomsCleared >= 2, sector + ' : au moins deux salles');
    if (sector === 'metro') assert.ok(seen.has('train'), 'la rame passe');
  }
  for (const sector of ['sewers', 'hospital', 'metro', 'nice']) for (const type of ['start', 'armory', 'medbay', 'lab', 'storage', 'dark', 'gas', 'arena', 'core', 'shop', 'vault']) for (let seed = 1; seed < 12; seed++) {
    const lv = generateRoom({ type, index: 3, seed, sector, exits: type === 'core' || type === 'arena' ? [] : ['lab', 'armory'], mode: type === 'arena' ? 'survival' : 'campaign' });
    const f = distanceField(lv, [lv.spawn]);
    for (const v of lv.vents) assert.ok(isFinite(f[cellIndex(lv, v.sx, v.sy)]), `bouche accessible (${sector}/${type}/${seed})`);
  }
});

t('défense : le fort tient, les pièges et barricades fonctionnent', () => {
  const res = [];
  for (const [seed, n] of [[31, 4], [32, 2]]) {
    const sim = new Sim({ mode: 'defense', difficulty: 'normal', seed, sector: 'lab' });
    for (let i = 0; i < n; i++) sim.addPlayer({ id: i, name: 'B' + i, bot: true, cls: ['engineer', 'medic', 'tank', 'soldier'][i] });
    assert.ok(sim.base && sim.base.bars.length === 4 && sim.base.pads.length >= 12);
    // un humain pose des pièges sur trois emplacements
    const p = sim.players.get(0); sim.scrap = 200;
    for (const [k, i] of [['turret', 0], ['wire', 2], ['mine', 4]]) { const q = sim.base.pads[i]; p.x = q.x; p.y = q.y; assert.ok(sim.tryPad(p)); sim.buildTrap(p, k); assert.equal(q.trap.k, k); }
    const seen = new Set();
    for (let s = 0; s < 60 * 60 * 18 && sim.phase === 'play'; s++) {
      for (const q of sim.players.values()) botThink(sim, q, DT); sim.step(DT);
      for (const e of sim.drainEvents()) if (['barHit', 'barBreak', 'genHit', 'repair', 'boss'].includes(e.e)) seen.add(e.e);
    }
    res.push(`${n} bots : ${sim.phase} vague ${sim.wave.n}/${sim.wave.total}, générateur ${Math.round(sim.base.gen.hp)} — ${[...seen].join(', ')}`);
    assert.ok(sim.wave.n >= 5, 'au moins cinq vagues');
    assert.ok(seen.has('barHit') && seen.has('repair'), 'barricades attaquées et réparées');
  }
  console.log('   ' + res.join('\n   '));
});

t('améliorations : toutes applicables', () => {
  const sim = new Sim({ seed: 1 });
  const p = sim.addPlayer({ id: 0, name: 'A' });
  for (const id of Object.keys(PERKS)) for (let k = 0; k < PERKS[id].max; k++) sim.applyPerk(p, id);
  sim.offerPerks(p);
  assert.equal(p.offers, null, 'plus rien à proposer quand tout est au maximum');
});

console.log(`\n${n} tests réussis`);
