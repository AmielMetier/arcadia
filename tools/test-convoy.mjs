// Tests du moteur de Convoy Storm : node tools/test-convoy.mjs
// Géométrie déterministe, chute / remontée par l'échelle, lancer dans la chaudière, panne sèche,
// reprise d'un état diffusé (migration d'hôte), et parties jouées par un pilote automatique.
import assert from 'node:assert/strict';
import { Sim, DT, stepPlayer, playerFromRow, DIFFICULTY, Ruins, trainSpeedFor, VMAX, LOST_DIST, stationDist, UPGRADES, obstacleColliders, windOf, DIG_T, FLARE_R } from '../convoy/engine/sim.js';
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
      assert.ok(r.loot >= 0 && r.loot <= (r.kind === 'camp' ? 3 : 2));
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

t('froid : on gèle dans la neige, on se réchauffe près de la chaudière', () => {
  const sim = new Sim({ seed: 21 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 8, z: 0 });
  sim.fuel = 100;
  run(sim, 10, () => { p.inp = { mx: 0, mz: -0.4 }; });
  assert.ok(p.heat < 88 && p.heat > 75, 'chaleur après 10 s dehors : ' + p.heat.toFixed(1));
  // jusqu'à l'effondrement
  const ev = [];
  let back = false;
  run(sim, 75, () => { const e = sim.drainEvents(); ev.push(...e); if (e.some((x) => x.e === 'respawn')) back = true; p.inp = back ? { mx: 0, mz: 0 } : { mx: 0, mz: -0.6 }; });
  assert.ok(ev.some((e) => e.e === 'cold' && e.p === 0), 'alerte froid');
  assert.ok(ev.some((e) => e.e === 'frozen'), 'effondré de froid');
  assert.equal(p.on, 1, 'ramené à bord'); assert.ok(p.heat >= 50, 'chaleur au retour : ' + p.heat.toFixed(1));
  // près de la chaudière, on remonte vite
  Object.assign(p, { x: 0.2, z: 2.2, heat: 20 });
  run(sim, 3, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(p.heat > 60, 'réchauffé : ' + p.heat.toFixed(1));
  // gelé : on avance au ralenti
  const a = { ...p, heat: 0, on: 1, st: 0, vx: 0, vz: 0 }, b = { ...p, heat: 50, on: 1, st: 0, vx: 0, vz: 0 };
  for (let i = 0; i < 30; i++) { stepPlayer(a, { mx: 0, mz: 1 }, DT, { v: 0, colliders: [] }); stepPlayer(b, { mx: 0, mz: 1 }, DT, { v: 0, colliders: [] }); }
  assert.ok(a.vz < b.vz * 0.7, 'gelé = plus lent');
});

t('loups : ils chassent dans la neige, mordent, et fuient les fusées', () => {
  const sim = new Sim({ seed: 31 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.v = 0; sim.D = { ...sim.D, burn: 0 };
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 10, z: -2, carry: 1 });
  sim.wolves.push({ id: 99, x: 18, zw: -2 - sim.dist, yaw: 0, st: 0, t: 0, tg: -1, hx: 18, hz: -2 - sim.dist, a: 0, fx: 0, fz: 0 });
  const ev = [];
  run(sim, 6, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; sim.v = 0; });
  assert.ok(ev.some((e) => e.e === 'growl'), 'le loup repère le joueur');
  assert.ok(ev.some((e) => e.e === 'bite' && e.p === 0), 'morsure');
  assert.equal(p.carry, 0, 'la caisse tombe'); assert.ok(p.heat < 100);
  // fusée : le loup suivant détale
  Object.assign(p, { st: 0, tm: 0 });
  sim.wolves = [{ id: 98, x: 16, zw: p.z - sim.dist, yaw: 0, st: 1, t: 0, tg: 0, hx: 16, hz: p.z - sim.dist, a: 0, fx: 0, fz: 0 }];
  p.inp = { mx: 0, mz: 0, fl: 1 }; p.pf = 0; sim.step(DT);
  assert.equal(sim.flares.length, 1); assert.equal(p.flares, 1);
  run(sim, 0.5, () => { p.inp = { mx: 0, mz: 0, fl: 1 }; sim.v = 0; });
  assert.equal(sim.wolves[0].st, 2, 'le loup fuit');
  run(sim, 2, () => { sim.v = 0; });
  assert.ok(Math.hypot(sim.wolves[0].x - p.x, sim.wolves[0].zw + sim.dist - p.z) > FLARE_R * 0.8, 'à bonne distance');
  // pas d'escalade : un joueur à bord n'est pas poursuivi
  const sim2 = new Sim({ seed: 32 });
  const q = sim2.addPlayer({ id: 0, name: 'B', color: '#00ff00' });
  sim2.wolves.push({ id: 5, x: HALF_W + 3, zw: q.z - sim2.dist, yaw: 0, st: 0, t: 0, tg: -1, hx: HALF_W + 3, hz: q.z - sim2.dist, a: 0, fx: 0, fz: 0 });
  run(sim2, 3, () => { q.inp = { mx: 0, mz: 0 }; });
  assert.equal(sim2.wolves[0]?.st ?? 0, 0, 'aucune chasse sur le wagon');
});

t('congère : le convoi s\'arrête devant, on déblaie, il repart', () => {
  const sim = new Sim({ seed: 41 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.ev = { k: 'drift', stopD: sim.dist + 20, zw: -19.4 - 2.4 - (sim.dist + 20), prog: 0, done: 0, t: 0 };
  sim.ed = 1e9;
  const ev = [];
  run(sim, 30, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; });
  assert.ok(ev.some((e) => e.e === 'drift_stop'), 'arrêt devant la congère');
  assert.ok(Math.abs(sim.dist - sim.ev.stopD) < 0.3 && sim.v === 0, 'arrêté pile');
  assert.equal(obstacleColliders(sim.ev, sim.dist).length, 1, 'la congère bloque le passage');
  const f0 = sim.fuel; run(sim, 5, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(f0 - sim.fuel < sim.burnRate() * 5 * 0.6, 'la chaudière tourne au ralenti');
  // pelle
  const zd = sim.ev.zw + sim.dist;
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 1.2, z: zd + 2.2, st: 0 });
  run(sim, DIG_T + 1, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0, use: true }; });
  assert.ok(ev.some((e) => e.e === 'cleared'), 'congère dégagée');
  assert.equal(sim.stop, null);
  run(sim, 3, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(sim.v > 0.5, 'le convoi repart');
});

t('gare : arrêt, chaleur et fusées rendues, achats, vote du départ', () => {
  const sim = new Sim({ seed: 51, mode: 'endless' });
  const a = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' }), b = sim.addPlayer({ id: 1, name: 'B', color: '#00ff00' });
  sim.ed = 1e9;
  const sd = stationDist('endless', 0, 0);
  sim.dist = sd - 15; sim.v = 2;
  a.heat = 30; a.flares = 0; sim.scrap = 10;
  const ev = [];
  run(sim, 25, () => { ev.push(...sim.drainEvents()); for (const p of sim.players.values()) p.inp = { mx: 0, mz: 0 }; });
  assert.ok(sim.stop && sim.stop.k === 'station', 'en gare');
  assert.ok(Math.abs(sim.dist - sd) < 0.3, 'arrêt à la gare');
  assert.equal(a.heat, 100); assert.ok(a.flares >= 2);
  assert.ok(ev.some((e) => e.e === 'station'));
  const f0 = sim.fuel; run(sim, 5); assert.equal(sim.fuel, f0, 'rien ne brûle en gare');
  assert.equal(sim.buy(0, 'boiler'), null); assert.equal(sim.up.boiler, 1); assert.equal(sim.scrap, 6);
  assert.equal(sim.buy(1, 'coats'), null); assert.equal(sim.scrap, 3);
  assert.ok(sim.buy(0, 'tank'), 'pas assez de ferraille');
  sim.vote(0); run(sim, 1); assert.ok(sim.stop, 'il manque un vote');
  sim.vote(1); run(sim, 1);
  assert.equal(sim.stop, null, 'départ'); assert.equal(sim.ns, 1);
  assert.equal(sim.buy(0, 'radar'), 'On n\'achète qu\'en gare.');
  // sans vote, le convoi repart tout seul
  const s2 = new Sim({ seed: 52, mode: 'endless' }); s2.addPlayer({ id: 0, name: 'A', color: '#ff0000' }); s2.ed = 1e9;
  s2.dist = sd - 5; s2.v = 1;
  run(s2, 70);
  assert.equal(s2.ns, 1, 'départ au bout du compte à rebours');
});

t('expédition : trois gares, puis l\'arrivée à Fort-Givre gagne la partie', () => {
  const sim = new Sim({ seed: 61, difficulty: 'normal' });
  sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  assert.equal(sim.goal, DIFFICULTY.normal.goal);
  assert.deepEqual([0, 1, 2, 3].map((i) => stationDist('expedition', sim.goal, i)), [500, 1000, 1500, null]);
  sim.ns = 3; sim.ed = 1e9; sim.dist = sim.goal - 12; sim.v = 2; sim.fuel = 100;
  const ev = [];
  run(sim, 30, () => ev.push(...sim.drainEvents())); ev.push(...sim.drainEvents());
  assert.equal(sim.phase, 'over'); assert.equal(sim.win, 1);
  assert.ok(ev.some((e) => e.e === 'arrive'));
  assert.ok(Math.abs(sim.dist - sim.goal) < 0.3);
});

t('avalanche et bourrasque', () => {
  const sim = new Sim({ seed: 71 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.ed = 1e9;
  sim.ev = { k: 'aval', at: sim.dist, side: 1, t: 0, hit: 0 };
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 8, z: 0, carry: 1 });
  const ev = [];
  run(sim, 5, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: -0.5 }; });
  assert.ok(ev.some((e) => e.e === 'aval_warn') && ev.some((e) => e.e === 'buried' && e.p === 0), 'enseveli');
  assert.equal(p.carry, 0);
  sim.ev = { k: 'gust', at: sim.dist, side: -1, t: 0 };
  Object.assign(p, { st: 0, tm: 0, x: 8, z: 0, heat: 100 });
  run(sim, 0.2); assert.ok(sim.gust > 0);
  assert.equal(windOf(sim.snapshot()), -1.4);
  const x0 = p.x; run(sim, 2, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(p.x < x0 - 1.5, 'le vent pousse');
});

t('reprise identique avec loups, fusées, gare et améliorations', () => {
  const sim = new Sim({ seed: 81, mode: 'endless', difficulty: 'blizzard' });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.scrap = 7; sim.up.coats = 1; sim.ed = 1e9;
  sim.wolves.push({ id: 90, x: 20, zw: -40, yaw: 0, st: 0, t: 0, tg: -1, hx: 20, hz: -40, a: 0, fx: 0, fz: 0 });
  sim.flares.push({ id: 91, m: 1, x: 0, z: 3, t: 5 });
  sim.dist = stationDist('endless', 0, 0) - 3; sim.v = 1;
  run(sim, 6, () => { p.inp = { mx: 0.2, mz: 0 }; });
  assert.ok(sim.stop);
  const copy = Sim.restore(JSON.parse(JSON.stringify(sim.snapshot())));
  for (const s of [sim, copy]) for (const q of s.players.values()) q.inp = { mx: 0, mz: 0 };
  run(sim, 4); run(copy, 4);
  assert.equal(copy.scrap, 7); assert.equal(copy.up.coats, 1); assert.equal(copy.mode, 'endless');
  assert.equal(copy.wolves.length, sim.wolves.length);
  assert.ok(Math.abs(copy.wolves[0].x - sim.wolves[0].x) < 0.05, 'loup identique');
  assert.equal(!!copy.stop, !!sim.stop); assert.ok(Math.abs(copy.stop.t - sim.stop.t) < 0.05);
  assert.ok(Math.abs(copy.players.get(0).heat - p.heat) < 0.1);
});

// Pilote automatique très simple : fouille, rapporte, remonte, nourrit.
function autopilot(sim, p, time) {
  const t0 = (time * 60) | 0;
  const go = (tx, tz, extra = {}) => {
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    p.inp = { mx: dx / d, mz: dz / d, use: false, thr: p.inp.thr | 0, jump: p.inp.jump | 0, fl: p.inp.fl | 0, ...extra };
    return d;
  };
  if (p.st >= 2) return;
  // en gare : on vote le départ (après avoir dépensé la ferraille)
  if (sim.stop && sim.stop.k === 'station') {
    for (const k of Object.keys(UPGRADES)) sim.buy(p.id, k);
    if (!sim.stop.v.includes(p.id)) sim.vote(p.id);
  }
  // congère : tout le monde descend déblayer devant la locomotive
  if (sim.ev && sim.ev.k === 'drift' && !sim.ev.done && sim.dist > sim.ev.stopD - 30 && !p.carry) {
    const zd = sim.ev.zw + sim.dist;
    if (p.on) { go(Math.sign(p.x || 1) * 2.6, -11); if (Math.abs(p.x) > HALF_W - 0.3) p.inp.mx = Math.sign(p.x || 1); return; }
    if (go(Math.sign(p.x || 1) * 1.2, zd + 2.2) < 1.5) p.inp.use = true;
    return;
  }
  // un loup aux trousses : fusée
  if (!p.on && sim.wolves.some((w) => w.tg === p.id) && p.flares > 0 && t0 % 30 === 0) p.inp.fl = (p.inp.fl | 0) + 1;
  // trop froid : retour au chaud près de la chaudière
  if ((p.heat ?? 100) < 30 && !p.carry) { if (p.on) go(0.2, 2.2); else go(0, REAR + 0.7); return; }
  const near = (c) => ({ x: c.x, z: c.m === 0 ? c.z + sim.dist : c.z });
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

function autoplay(diff, players, maxMin, seed, mode = 'expedition') {
  const sim = new Sim({ seed, difficulty: diff, mode });
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

t('pilote automatique : la partie avance (panne sèche ou arrivée)', () => {
  const rows = [];
  for (const [diff, np] of [['facile', 1], ['normal', 1], ['normal', 3], ['blizzard', 6]]) {
    const runs = [11, 22, 33].map((seed) => autoplay(diff, np, 30, seed));
    const avgT = runs.reduce((a, r) => a + r.sim.t, 0) / runs.length;
    const fed = runs.reduce((a, r) => a + r.sim.fedTotal, 0) / runs.length;
    rows.push(`${diff.padEnd(8)} ${np} joueur(s) : ${(avgT / 60).toFixed(1)} min, ${(runs.reduce((a, r) => a + r.sim.dist, 0) / runs.length).toFixed(0)} m, ${fed.toFixed(1)} caisses, état ≤ ${Math.max(...runs.map((r) => r.maxSnap))} o`);
    const wins = runs.filter((r) => r.sim.win).length;
    rows[rows.length - 1] += ` · ${wins}/3 expéditions réussies`;
    console.log('   ' + rows[rows.length - 1]);
    for (const r of runs) assert.ok(r.maxSnap < 6000, 'état diffusé raisonnable');
    assert.ok(fed >= 2, `le pilote trouve et livre du fioul (${diff}, ${np})`);
    const tank = 100 / (DIFFICULTY[diff].burn * (1 + 0.15 * (np - 1)));
    assert.ok(avgT > tank * 1.5, `on tient plus d'un réservoir (${diff}, ${np})`);
  }
});

console.log(`\n${n} tests réussis`);
