// Tests du moteur de Convoy Storm : node tools/test-convoy.mjs
// Géométrie déterministe, chute / remontée par l'échelle, lancer dans la chaudière, panne sèche,
// reprise d'un état diffusé (migration d'hôte), et parties jouées par un pilote automatique.
import assert from 'node:assert/strict';
import { Sim, DT, stepPlayer, playerFromRow, DIFFICULTY, Ruins, trainSpeedFor, VMAX, LOST_DIST } from '../convoy/engine/sim.js';
import { chunkRuins, DECK_Y, REAR, BOILER, HALF_W, CHUNK, onDeckRect } from '../convoy/engine/world.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };
const run = (sim, sec, each) => { for (let i = 0; i < sec * 60 && sim.phase === 'play'; i++) { each && each(i); sim.step(DT); } };

t('ruines déterministes et à l\'écart des rails', () => {
  for (let k = 0; k < 200; k++) {
    const a = chunkRuins(42, k, 0.65), b = chunkRuins(42, k, 0.65);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    for (const r of a.ruins) {
      assert.ok(Math.abs(r.x) > 6, 'ruine hors de la voie');
      assert.ok(r.zw <= -k * CHUNK && r.zw >= -(k + 1) * CHUNK, 'ruine dans son tronçon');
      assert.ok(r.loot >= 0 && r.loot <= 2);
    }
    if (a.loose) assert.ok(Math.abs(a.loose.x) > HALF_W + 1);
  }
  assert.notEqual(JSON.stringify(chunkRuins(1, 5, 0.6)), JSON.stringify(chunkRuins(2, 5, 0.6)), 'la graine change le décor');
});

t('sans personne pour la nourrir, la chaudière s\'éteint et le convoi s\'arrête', () => {
  const sim = new Sim({ seed: 3, difficulty: 'normal' });
  sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  let low = false, stall = false;
  run(sim, 400, () => { for (const e of sim.drainEvents()) { if (e.e === 'low') low = true; if (e.e === 'stall') stall = true; } });
  assert.equal(sim.phase, 'over');
  assert.ok(low && stall, 'alertes réservoir bas et arrêt');
  assert.ok(sim.t > 90 && sim.t < 200, 'durée d\'un réservoir : ' + sim.t.toFixed(0) + ' s');
  assert.ok(sim.dist > 150, 'distance parcourue : ' + sim.dist.toFixed(0));
});

t('vitesse du convoi : plus lente quand le réservoir baisse, nulle à sec', () => {
  assert.equal(trainSpeedFor(100), VMAX);
  assert.ok(trainSpeedFor(20) < trainSpeedFor(60));
  assert.equal(trainSpeedFor(0), 0);
  // dans la neige on rattrape toujours le convoi, même chargé
  assert.ok(4.3 * 0.85 > VMAX);
});

t('chute dans la neige, ralentissement, retour par l\'échelle de queue', () => {
  const sim = new Sim({ seed: 9 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  run(sim, 2);
  const evs = [];
  // vers la droite jusqu'à tomber
  run(sim, 1.5, () => { p.inp = { mx: 1, mz: 0, jump: 0 }; evs.push(...sim.drainEvents()); });
  assert.equal(p.on, 0, 'tombé du train');
  assert.ok(evs.some((e) => e.e === 'fall'));
  assert.equal(p.st, 1, 'trébuche');
  // le convoi s'éloigne pendant qu'on traîne
  const z0 = p.z;
  run(sim, 4, () => { p.inp = { mx: 0, mz: 0, jump: 0 }; });
  assert.ok(p.z > z0 + 5, 'la neige recule sous les pieds');
  // rattraper l'arrière : viser l'échelle
  let boarded = false;
  run(sim, 40, () => {
    for (const e of sim.drainEvents()) if (e.e === 'board') boarded = true;
    if (boarded) { p.inp = { mx: 0, mz: 0, jump: 0 }; return; }
    if (p.on) return;
    const tx = 0, tz = REAR + 0.7;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    // contourner le wagon : rester sur le côté tant qu'on est à hauteur du convoi
    p.inp = p.z < REAR + 0.3 && Math.abs(p.x) < HALF_W + 1 ? { mx: Math.sign(p.x || 1), mz: 1, jump: 0 } : { mx: dx / d, mz: dz / d, jump: 0 };
  });
  assert.ok(boarded && p.on === 1 && Math.abs(p.y - DECK_Y) < 1e-6, 'remonté à bord');
});

t('saut : on retombe sur le plancher', () => {
  const sim = new Sim({ seed: 2 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  p.inp = { mx: 0, mz: 0, jump: 0 }; sim.step(DT);
  p.inp = { mx: 0, mz: 0, jump: 1 }; sim.step(DT);
  assert.equal(p.air, 1);
  let maxY = 0; run(sim, 1.2, () => { maxY = Math.max(maxY, p.y); });
  assert.ok(maxY > DECK_Y + 0.9, 'hauteur du saut');
  assert.equal(p.air, 0); assert.equal(p.on, 1);
});

t('caisse : ramassée, posée dans la chaudière (+25 %) ou lancée dans le foyer', () => {
  const sim = new Sim({ seed: 5 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.fuel = 40;
  sim.spawnCrate(p.x, DECK_Y + 0.25, p.z, 1);
  p.inp = { mx: 0, mz: 0, use: true }; sim.step(DT);
  assert.equal(p.carry, 1);
  p.inp = { mx: 0, mz: 0, use: false }; sim.step(DT);
  // aller à la chaudière
  run(sim, 4, () => { const dz = BOILER.z + 1.9 - p.z; p.inp = { mx: (0.2 - p.x), mz: Math.sign(dz) * Math.min(1, Math.abs(dz)), use: false }; });
  const f0 = sim.fuel;
  p.inp = { mx: 0, mz: 0, use: true }; sim.step(DT);
  assert.equal(p.carry, 0);
  assert.ok(Math.abs(sim.fuel - (f0 + 25)) < 0.1, 'chaudière +25 %');
  assert.equal(p.fed, 1);
  // lancer en cloche dans le foyer
  sim.fuel = 30;
  const c = sim.spawnCrate(0, DECK_Y + 3.5, 0.6, 2, { vx: 0, vy: 0, vz: -1 }); c.by = 0;
  run(sim, 1);
  assert.ok(sim.fuel > 50, 'la caisse est tombée dans le foyer');
  assert.equal(p.fed, 2);
  // à côté : elle finit sur le plancher
  const c2 = sim.spawnCrate(1.2, DECK_Y + 3, 8, 2, { vx: 0, vy: 0, vz: 0 });
  run(sim, 1);
  assert.equal(c2.m, 1, 'posée sur le wagon');
  // trop loin : dans la neige, puis elle glisse derrière avec la plaine
  const c3 = sim.spawnCrate(6, 2, 0, 2, { vx: 0, vy: 0, vz: 0 });
  run(sim, 1);
  assert.equal(c3.m, 0, 'dans la neige');
});

t('fouille : une ruine ne se fouille qu\'une fois', () => {
  const sim = new Sim({ seed: 11, difficulty: 'facile' });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  // trouver une ruine avec du butin
  let ruin = null;
  for (let k = 0; k < 30 && !ruin; k++) ruin = chunkRuins(11, k, DIFFICULTY.facile.loot).ruins.find((r) => r.loot > 0);
  assert.ok(ruin);
  sim.dist = -ruin.zw - 5; // la ruine 5 m devant le centre du convoi
  Object.assign(p, { on: 0, ref: 0, y: 0, x: ruin.spot.x, z: ruin.spot.zw + sim.dist, air: 0 });
  sim.v = 0; sim.fuel = 0.0001; sim.D = { ...sim.D, burn: 0 }; // convoi à l'arrêt pour le test
  let found = 0;
  for (let i = 0; i < 120; i++) { p.inp = { mx: 0, mz: 0, use: true }; sim.v = 0; sim.step(DT); for (const e of sim.drainEvents()) if (e.e === 'found') found += e.n; }
  assert.equal(found, ruin.loot);
  assert.ok(sim.looted.has(ruin.id));
  const before = sim.crates.length;
  for (let i = 0; i < 120; i++) { p.inp = { mx: 0, mz: 0, use: true }; sim.v = 0; sim.step(DT); }
  assert.ok(sim.crates.length <= before, 'pas de seconde fouille');
});

t('perdu dans la tempête : réapparition à bord, caisse perdue', () => {
  const sim = new Sim({ seed: 4 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 8, z: REAR + LOST_DIST - 1, carry: 1 });
  const ev = [];
  run(sim, 6, () => { ev.push(...sim.drainEvents()); p.inp = ev.some((e) => e.e === 'lost') ? { mx: 0, mz: 0 } : { mx: 0, mz: 1 }; });
  assert.ok(ev.some((e) => e.e === 'lost' && e.crate));
  assert.ok(ev.some((e) => e.e === 'respawn'));
  assert.equal(p.on, 1); assert.equal(p.carry, 0);
});

t('déconnexion : le joueur lâche sa caisse ; reprise identique depuis l\'état diffusé', () => {
  const sim = new Sim({ seed: 77 });
  sim.addPlayer({ id: 0, name: 'Hôte', color: '#ff0000' });
  const g = sim.addPlayer({ id: 3, name: 'Invité', color: '#00ff00' });
  run(sim, 5, (i) => { g.inp = { mx: Math.sin(i / 50), mz: 0.3, jump: (i / 90) | 0 }; });
  g.carry = 1;
  const nc = sim.crates.length;
  sim.removePlayer(3);
  assert.equal(sim.crates.length, nc + 1, 'caisse lâchée');
  const snap = sim.snapshot();
  const json = JSON.stringify(snap);
  assert.ok(json.length < 4000, 'état diffusé compact : ' + json.length);
  const copy = Sim.restore(JSON.parse(json));
  run(sim, 10); run(copy, 10);
  assert.ok(Math.abs(copy.dist - sim.dist) < 0.05, 'même distance');
  assert.ok(Math.abs(copy.fuel - sim.fuel) < 0.05, 'même carburant');
  assert.equal(copy.players.size, 1);
});

t('prédiction : rejouer stepPlayer depuis l\'état diffusé retombe sur l\'hôte', () => {
  const sim = new Sim({ seed: 8 });
  const p = sim.addPlayer({ id: 1, name: 'A', color: '#ff0000' });
  run(sim, 1);
  const snap = sim.snapshot();
  const me = playerFromRow(snap.P[0]);
  const ruins = new Ruins(snap.sd, DIFFICULTY[snap.df].loot);
  const inputs = [];
  for (let i = 0; i < 90; i++) inputs.push({ mx: 0.7, mz: -0.4, jump: i > 30 ? 1 : 0 });
  let v = snap.sp, d = snap.d;
  for (const inp of inputs) { p.inp = inp; sim.step(DT); stepPlayer(me, inp, DT, { v, colliders: ruins.colliders(d) }); d += v * DT; v = sim.v; }
  assert.ok(Math.hypot(me.x - p.x, me.z - p.z) < 0.05, 'écart ' + Math.hypot(me.x - p.x, me.z - p.z).toFixed(3));
});

// Pilote automatique très simple : fouille, rapporte, remonte, nourrit.
function autopilot(sim, p, time) {
  const go = (tx, tz, extra = {}) => {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    p.inp = { mx: dx / d, mz: dz / d, use: false, thr: p.inp.thr | 0, jump: p.inp.jump | 0, ...extra };
    return d;
  };
  if (p.st >= 2) return;
  const near = (c) => ({ x: c.x, z: c.m === 0 ? c.z + sim.dist : c.z });
  const t0 = (time * 60) | 0;
  if (p.carry) {
    if (p.on) { if (go(0.2, 1.9) < 0.5) p.inp = { mx: 0, mz: 0, use: t0 % 2 === 0 }; }
    else if (p.z < REAR + 0.3 && Math.abs(p.x) < HALF_W + 1) go(Math.sign(p.x || 1) * (HALF_W + 1.4), REAR + 1);
    else go(0, REAR + 0.7);
    return;
  }
  const deck = sim.crates.find((c) => c.m === 1);
  if (p.on && deck) { if (go(deck.x, deck.z) < 0.9) p.inp.use = t0 % 2 === 0; return; }
  const ground = sim.crates.filter((c) => c.m === 0).map(near).filter((c) => c.z < REAR + 20 && Math.hypot(c.x - p.x, c.z - p.z) < 30).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (ground) { if (go(ground.x, ground.z) < 1.0) p.inp.use = t0 % 2 === 0; return; }
  let best = null, bd = 1e9;
  for (const [, c] of sim.ruins.around(sim.dist, 40, 10)) for (const r of c.ruins) {
    if (sim.looted.has(r.id)) continue;
    const z = r.spot.zw + sim.dist; if (z > REAR + 12) continue;
    const d = Math.hypot(r.spot.x - p.x, z - p.z); if (d < bd) { bd = d; best = { x: r.spot.x, z }; }
  }
  if (best) { if (go(best.x, best.z) < 1.4) p.inp = { mx: 0, mz: 0, use: true, thr: p.inp.thr | 0, jump: p.inp.jump | 0 }; return; }
  if (!p.on) go(0, REAR + 0.7); else go(0, 4);
}

function autoplay(diff, players, maxMin, seed) {
  const sim = new Sim({ seed, difficulty: diff });
  for (let i = 0; i < players; i++) sim.addPlayer({ id: i, name: 'P' + i, color: '#ff0000' });
  let maxSnap = 0;
  for (let s = 0; s < maxMin * 3600 && sim.phase === 'play'; s++) {
    for (const p of sim.players.values()) autopilot(sim, p, s / 60);
    sim.step(DT); sim.drainEvents();
    if (s % 3 === 0) maxSnap = Math.max(maxSnap, JSON.stringify(sim.snapshot()).length);
    for (const p of sim.players.values()) assert.ok(Number.isFinite(p.x + p.y + p.z), 'position valide');
  }
  return { sim, maxSnap };
}

t('pilote automatique : la partie avance et finit par une panne sèche', () => {
  const rows = [];
  for (const [diff, np] of [['facile', 1], ['normal', 1], ['normal', 3], ['blizzard', 6]]) {
    const runs = [11, 22, 33].map((seed) => autoplay(diff, np, 30, seed));
    const avgT = runs.reduce((a, r) => a + r.sim.t, 0) / runs.length;
    const fed = runs.reduce((a, r) => a + r.sim.fedTotal, 0) / runs.length;
    rows.push(`${diff.padEnd(8)} ${np} joueur(s) : ${(avgT / 60).toFixed(1)} min, ${(runs.reduce((a, r) => a + r.sim.dist, 0) / runs.length).toFixed(0)} m, ${fed.toFixed(1)} caisses, état ≤ ${Math.max(...runs.map((r) => r.maxSnap))} o`);
    console.log('   ' + rows[rows.length - 1]);
    for (const r of runs) assert.ok(r.maxSnap < 6000, 'état diffusé raisonnable');
    assert.ok(fed >= 2, `le pilote trouve et livre du fioul (${diff}, ${np})`);
    const tank = 100 / (DIFFICULTY[diff].burn * (1 + 0.15 * (np - 1)));
    assert.ok(avgT > tank * 1.5, `on tient plus d'un réservoir (${diff}, ${np})`);
  }
});

console.log(`\n${n} tests réussis`);
