// Tests du moteur de Convoy Storm : node tools/test-convoy.mjs
// Géométrie déterministe, chute / remontée par l'échelle, lancer dans la chaudière, panne sèche,
// reprise d'un état diffusé (migration d'hôte), et parties jouées par un pilote automatique.
import assert from 'node:assert/strict';
import { Sim, DT, stepPlayer, playerFromRow, DIFFICULTY, Ruins, trainSpeedFor, VMAX, LOST_DIST, stationDist, CARDS, cardCost, obstacleColliders, windOf, DIG_T, FLARE_R,
  THROTTLE, LEVER, VALVE, FAULTS, STORM_START, STORM_STATION_K, ROLES, THAW_T, nightK, dayInfo, DAY_LEN, legAt, momentPos, momentOf, momentKinds, chunkEnv,
  BRIDGE_LEN, HOOK_SPOTS, moveCtx, momentColliders, LEG_SHIFT, forksOf, forkOptions, kappaAt, gradeAt, tunnelsOf, Line, TURRET, BENCH, CONTRACTS, ENCOUNTERS,
  lineColliders, snapRoute, CART_V, HOSE_LEN } from '../convoy/engine/sim.js';
import { chunkRuins, DECK_Y, REAR, BOILER, HALF_W, CHUNK, onDeckRect, BIOMES } from '../convoy/engine/world.js';

let n = 0;
// sans tempête, pression, pannes ni pillards : pour tester une mécanique à la fois
const calmSim = (o) => Object.assign(new Sim(o), { calm: true });
const t = (name, fn) => { fn(); n++; console.log('✓', name); };
const run = (sim, sec, each) => { for (let i = 0; i < sec * 60 && sim.phase === 'play'; i++) { each && each(i); sim.step(DT); } };

t('ruines déterministes et à l\'écart des rails', () => {
  for (let k = 0; k < 200; k++) {
    const a = chunkRuins(42, k, 0.65), b = chunkRuins(42, k, 0.65);
    assert.equal(JSON.stringify(a), JSON.stringify(b));
    for (const r of a.ruins) {
      assert.ok(Math.abs(r.x) > 6, 'ruine hors de la voie');
      assert.ok(r.zw <= -k * CHUNK && r.zw >= -(k + 1) * CHUNK, 'ruine dans son tronçon');
      for (const sp of r.spots) assert.ok(sp.loot >= 0 && sp.loot <= (r.kind === 'camp' ? 3 : 2));
    }
    if (a.loose) assert.ok(Math.abs(a.loose.x) > HALF_W + 1);
  }
  assert.notEqual(JSON.stringify(chunkRuins(1, 5, 0.6)), JSON.stringify(chunkRuins(2, 5, 0.6)), 'la graine change le décor');
});

t('sans personne pour la nourrir, la chaudière s\'éteint et le convoi s\'arrête', () => {
  const sim = calmSim({ seed: 3, difficulty: 'normal' });
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
  const sim = calmSim({ seed: 9 });
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
  const sim = calmSim({ seed: 2 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  p.inp = { mx: 0, mz: 0, jump: 0 }; sim.step(DT);
  p.inp = { mx: 0, mz: 0, jump: 1 }; sim.step(DT);
  assert.equal(p.air, 1);
  let maxY = 0; run(sim, 1.2, () => { maxY = Math.max(maxY, p.y); });
  assert.ok(maxY > DECK_Y + 0.9, 'hauteur du saut');
  assert.equal(p.air, 0); assert.equal(p.on, 1);
});

t('caisse : ramassée, posée dans la chaudière (+25 %) ou lancée dans le foyer', () => {
  const sim = calmSim({ seed: 5 });
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
  const sim = calmSim({ seed: 11, difficulty: 'facile' });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  // trouver une ruine avec du butin
  let ruin = null;
  for (let k = 0; k < 30 && !ruin; k++) ruin = sim.ruins.chunk(k).ruins.find((r) => r.loot > 0 && r.spots.length === 1 && !r.spot.amb);
  assert.ok(ruin);
  sim.dist = -ruin.zw - 5; // la ruine 5 m devant le centre du convoi
  Object.assign(p, { on: 0, ref: 0, y: 0, x: ruin.spot.x, z: ruin.spot.zw + sim.dist, air: 0 });
  sim.v = 0; sim.fuel = 0.0001; sim.D = { ...sim.D, burn: 0 }; // convoi à l'arrêt pour le test
  let found = 0;
  for (let i = 0; i < 120; i++) { p.inp = { mx: 0, mz: 0, use: true }; sim.v = 0; sim.step(DT); for (const e of sim.drainEvents()) if (e.e === 'found') found += e.n; }
  assert.equal(found, ruin.loot);
  assert.ok(sim.looted.has(ruin.id * 4));
  const before = sim.crates.length;
  for (let i = 0; i < 120; i++) { p.inp = { mx: 0, mz: 0, use: true }; sim.v = 0; sim.step(DT); }
  assert.ok(sim.crates.length <= before, 'pas de seconde fouille');
});

t('perdu dans la tempête : réapparition à bord, caisse perdue', () => {
  const sim = calmSim({ seed: 4 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 8, z: REAR + LOST_DIST - 1, carry: 1 });
  const ev = [];
  run(sim, 6, () => { ev.push(...sim.drainEvents()); p.inp = ev.some((e) => e.e === 'lost') ? { mx: 0, mz: 0 } : { mx: 0, mz: 1 }; });
  assert.ok(ev.some((e) => e.e === 'lost' && e.crate));
  assert.ok(ev.some((e) => e.e === 'respawn'));
  assert.equal(p.on, 1); assert.equal(p.carry, 0);
});

t('déconnexion : le joueur lâche sa caisse ; reprise identique depuis l\'état diffusé', () => {
  const sim = calmSim({ seed: 77 });
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
  const sim = calmSim({ seed: 8 });
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
  const sim = calmSim({ seed: 21 });
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
  const sim = calmSim({ seed: 31 });
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
  const sim2 = calmSim({ seed: 32 });
  const q = sim2.addPlayer({ id: 0, name: 'B', color: '#00ff00' });
  sim2.wolves.push({ id: 5, x: HALF_W + 3, zw: q.z - sim2.dist, yaw: 0, st: 0, t: 0, tg: -1, hx: HALF_W + 3, hz: q.z - sim2.dist, a: 0, fx: 0, fz: 0 });
  run(sim2, 3, () => { q.inp = { mx: 0, mz: 0 }; });
  assert.equal(sim2.wolves[0]?.st ?? 0, 0, 'aucune chasse sur le wagon');
});

t('congère : le convoi s\'arrête devant, on déblaie, il repart', () => {
  const sim = calmSim({ seed: 41 });
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

t('gare : arrêt, chaleur et fusées rendues, cartes, aiguillage, vote du départ', () => {
  const sim = calmSim({ seed: 51, mode: 'endless' });
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
  // trois cartes différentes ; la première est offerte, les suivantes coûtent de la ferraille
  const [c0, c1, c2] = sim.stop.c;
  assert.equal(new Set(sim.stop.c).size, 3);
  assert.equal(sim.buy(0, c0), null); assert.equal(sim.up[c0], 1); assert.equal(sim.scrap, 10, 'carte offerte');
  assert.equal(sim.buy(1, c0), 'Déjà prise.');
  const cost = cardCost(c1, sim.up[c1]);
  assert.equal(sim.buy(1, c1), null); assert.equal(sim.scrap, 10 - cost);
  sim.scrap = 0; assert.ok(sim.buy(0, c2), 'pas assez de ferraille');
  assert.ok(sim.buy(0, Object.keys(CARDS).find((k) => !sim.stop.c.includes(k))), 'carte non proposée');
  // aiguillage : deux voies ; on descend basculer le levier au bout du quai
  assert.equal(sim.stop.fk.length, 2); assert.notEqual(sim.stop.fk[0], sim.stop.fk[1]);
  const pick = sim.stop.fk[1];
  const f = sim.curFork(); assert.equal(f.k, 'st'); assert.equal(sim.lc, 0);
  const lv = sim.leverPos(f);
  Object.assign(b, { on: 0, ref: 0, y: 0, air: 0, x: lv.x + 0.6, z: lv.z, st: 0 });
  b.inp = { mx: 0, mz: 0, use: true }; sim.step(DT); b.inp = { mx: 0, mz: 0, use: false }; sim.step(DT);
  assert.equal(sim.lc, 1, 'levier basculé');
  sim.vote(0); run(sim, 1); assert.ok(sim.stop, 'il manque un vote');
  sim.vote(1); run(sim, 1);
  assert.equal(sim.stop, null, 'départ'); assert.equal(sim.ns, 1);
  assert.equal(sim.buy(0, c2), 'On n\'achète qu\'en gare.');
  run(sim, 14, () => { for (const p of sim.players.values()) p.inp = { mx: 0, mz: 0 }; });
  assert.equal(sim.legs[1], pick, 'le convoi a pris la voie du levier : ' + pick);
  // le paysage change un peu après la gare
  assert.equal(legAt('endless', 0, sd + LEG_SHIFT - 1), 0); assert.equal(legAt('endless', 0, sd + LEG_SHIFT + 1), 1);
  assert.equal(chunkEnv(51, 'endless', 0, { legs: sim.legs, mk: sim.mk }, Math.ceil((sd + LEG_SHIFT) / CHUNK) + 1).bio, pick);
  // sans vote, le convoi repart tout seul
  const s2 = calmSim({ seed: 52, mode: 'endless' }); s2.addPlayer({ id: 0, name: 'A', color: '#ff0000' }); s2.ed = 1e9;
  s2.dist = sd - 5; s2.v = 1;
  run(s2, 70);
  assert.equal(s2.ns, 1, 'départ au bout du compte à rebours');
  assert.ok(s2.legs[1], 'une voie choisie par défaut');
});

t('expédition : trois gares, puis l\'arrivée à Fort-Givre gagne la partie', () => {
  const sim = calmSim({ seed: 61, difficulty: 'normal' });
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
  const sim = calmSim({ seed: 71 });
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
  const sim = calmSim({ seed: 81, mode: 'endless', difficulty: 'blizzard' });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.scrap = 7; sim.up.coats = 1; sim.ed = 1e9;
  sim.dist = stationDist('endless', 0, 0) - 3; sim.v = 1;
  sim.wolves.push({ id: 90, x: 20, zw: -sim.dist - 8, yaw: 0, st: 0, t: 0, tg: -1, hx: 20, hz: -sim.dist - 8, a: 0, fx: 0, fz: 0 });
  sim.flares.push({ id: 91, m: 1, x: 0, z: 3, t: 5 });
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


t('front de tempête : il avance sans cesse et engloutit un convoi arrêté', () => {
  const sim = new Sim({ seed: 91 });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  assert.equal(Math.round(sim.gap), STORM_START);
  sim.press = -1e9; sim.nf = 1e9; sim.rd = 1e9; sim.ed = 1e9;
  run(sim, 30, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(sim.gap > STORM_START, 'à pleine vapeur, on prend de l\'avance : ' + sim.gap.toFixed(0));
  sim.stop = { k: 'drift' }; const ev = []; // convoi immobilisé (congère jamais déblayée)
  run(sim, 400, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; }); ev.push(...sim.drainEvents());
  assert.equal(sim.phase, 'over');
  assert.ok(ev.some((e) => e.e === 'storm_near') && ev.some((e) => e.e === 'over' && e.why === 'storm'), 'alerte puis fin');
  // le front ne reste jamais trop loin derrière
  const s2 = new Sim({ seed: 92, mode: 'endless' }); s2.ed = 1e9; s2.dist = 5010; s2.step(DT);
  assert.ok(s2.gap <= 161);
});

t('manette : à fond on va plus vite mais on brûle bien plus', () => {
  const mk = (thr) => { const s = calmSim({ seed: 93 }); const p = s.addPlayer({ id: 0, name: 'A', color: '#ff0000' }); s.thr = thr; s.ed = 1e9; run(s, 20, () => { p.inp = { mx: 0, mz: 0 }; }); return s; };
  const eco = mk(0), nor = mk(1), max = mk(2);
  assert.ok(eco.dist < nor.dist && nor.dist < max.dist, 'vitesses');
  assert.ok(100 - max.fuel > (100 - nor.fuel) * 1.6, 'consommation à fond');
  assert.ok(100 - eco.fuel < (100 - nor.fuel) * 0.7, 'consommation en éco');
  // on change de régime à la manette, depuis l'arrière de la cabine
  const s = new Sim({ seed: 94 }); const p = s.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  Object.assign(p, { x: LEVER.x, z: LEVER.z + 0.4 }); p.inp = { mx: 0, mz: 0, use: true }; s.step(DT);
  assert.equal(s.thr, 2);
  p.inp = { mx: 0, mz: 0, use: false }; s.step(DT); p.inp = { mx: 0, mz: 0, use: true }; s.step(DT);
  assert.equal(s.thr, 0, 'retour en éco après « à fond »');
});

t('pression : sans soupape la chaudière explose, la soupape la fait retomber', () => {
  const sim = new Sim({ seed: 95 }); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.storm = -1e9; sim.nf = 1e9; sim.rd = 1e9; sim.ed = 1e9; sim.press = 80;
  const ev = [];
  run(sim, 30, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; }); ev.push(...sim.drainEvents());
  assert.ok(ev.some((e) => e.e === 'press_warn') && ev.some((e) => e.e === 'boom'), 'explosion');
  assert.ok(sim.hull <= 75 && sim.fuel < 80);
  sim.press = 90; Object.assign(p, { x: VALVE.x, z: VALVE.z - 0.3, st: 0 });
  run(sim, 2, () => { p.inp = { mx: 0, mz: 0, use: true }; });
  assert.ok(sim.press < 30, 'soupape : ' + sim.press.toFixed(0));
});

t('pannes : un tuyau gelé ralentit, une fuite vide le réservoir, on répare', () => {
  const sim = new Sim({ seed: 96 }); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.storm = -1e9; sim.press = -1e9; sim.rd = 1e9; sim.ed = 1e9; sim.nf = 1e9;
  run(sim, 15, () => { p.inp = { mx: 0, mz: 0 }; });
  const v0 = sim.v;
  sim.faults.push({ id: 500, k: 'pipe', s: 0, x: FAULTS.pipe.spots[0][0], z: FAULTS.pipe.spots[0][1], prog: 0 });
  sim.faults.push({ id: 501, k: 'leak', s: 0, x: FAULTS.leak.spots[0][0], z: FAULTS.leak.spots[0][1], prog: 0 });
  run(sim, 6, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(sim.v < v0 * 0.7, 'le convoi ralentit');
  const ev = [];
  for (const f of [...sim.faults]) {
    Object.assign(p, { x: f.x * 0.75, z: f.z, st: 0, on: 1, ref: 1, y: DECK_Y, air: 0 });
    run(sim, FAULTS[f.k].fix + 0.5, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0, use: true }; });
  }
  assert.equal(sim.faults.length, 0); assert.equal(ev.filter((e) => e.e === 'fixed').length, 2);
  // elles apparaissent toutes seules, à bord
  const s2 = new Sim({ seed: 97 }); s2.addPlayer({ id: 0, name: 'A', color: '#ff0000' }); s2.storm = -1e9; s2.press = -1e9; s2.rd = 1e9;
  run(s2, 200, () => s2.drainEvents());
  assert.ok(s2.faults.length >= 1 && s2.faults.every((f) => onDeckRect(f.x, f.z)));
});

t('pillards : ils volent les caisses du pont, on les renverse, les fusées les chassent', () => {
  const sim = new Sim({ seed: 98 }); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.storm = -1e9; sim.press = -1e9; sim.nf = 1e9; sim.ed = 1e9; sim.rd = 0;
  sim.spawnCrate(-1, DECK_Y + 0.25, 6, 1); sim.spawnCrate(1, DECK_Y + 0.25, 7, 1);
  const ev = [];
  for (let i = 0; i < 20 * 60 && !ev.some((e) => e.e === 'steal'); i++) { p.inp = { mx: 0, mz: 0 }; sim.step(DT); ev.push(...sim.drainEvents()); }
  assert.ok(ev.some((e) => e.e === 'raid') && ev.some((e) => e.e === 'steal'), 'vol');
  const w = sim.raiders.find((r) => r.carry > 0 && r.st < 2);
  assert.ok(w, 'un pillard le long du convoi');
  const carried = w.carry, crates0 = sim.crates.filter((c) => c.m === 0).length, scrap0 = sim.scrap;
  Object.assign(p, { x: w.side * (HALF_W - 0.4), z: w.z, on: 1, ref: 1, y: DECK_Y, air: 0, st: 0 });
  p.inp = { mx: 0, mz: 0, use: true }; sim.step(DT);
  assert.equal(w.st, 3, 'renversé'); assert.equal(sim.scrap, scrap0 + 1);
  assert.equal(sim.crates.filter((c) => c.m === 0).length, crates0 + carried, 'il lâche son butin');
  // une fusée fait fuir les autres
  const s2 = new Sim({ seed: 99 }); s2.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  s2.storm = -1e9; s2.press = -1e9; s2.nf = 1e9; s2.ed = 1e9;
  s2.raiders.push({ id: 700, x: HALF_W + 1.3, z: 3, side: 1, st: 1, t: 3, carry: 0, tz: 3 });
  s2.flares.push({ id: 701, m: 1, x: 1, z: 3, t: 5 }); s2.step(DT);
  assert.equal(s2.raiders[0].st, 2);
  // sans caisse à voler, ils abîment le convoi
  const s3 = new Sim({ seed: 100 }); s3.addPlayer({ id: 0, name: 'A', color: '#ff0000' }); s3.storm = -1e9; s3.press = -1e9; s3.nf = 1e9; s3.ed = 1e9;
  s3.raiders.push({ id: 702, x: HALF_W + 1.3, z: 3, side: 1, st: 1, t: 0.1, carry: 0, tz: 3 });
  run(s3, 1); assert.ok(s3.hull < 100);
});

t('reprise identique avec tempête, pannes et pillards', () => {
  const sim = new Sim({ seed: 101, difficulty: 'blizzard' });
  const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.rd = 0; sim.nf = 0.5; sim.thr = 2; sim.ed = 1e9;
  run(sim, 12, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.ok(sim.raiders.length && sim.faults.length);
  const copy = Sim.restore(JSON.parse(JSON.stringify(sim.snapshot())));
  for (const s of [sim, copy]) for (const q of s.players.values()) q.inp = { mx: 0, mz: 0 };
  run(sim, 5); run(copy, 5);
  assert.equal(copy.thr, 2);
  assert.ok(Math.abs(copy.storm - sim.storm) < 0.05 && Math.abs(copy.press - sim.press) < 0.05 && Math.abs(copy.hull - sim.hull) < 0.05);
  assert.equal(copy.raiders.length, sim.raiders.length);
  assert.ok(Math.abs(copy.raiders[0].z - sim.raiders[0].z) < 0.05, 'pillard identique');
  assert.deepEqual(copy.faults.map((f) => f.k), sim.faults.map((f) => f.k));
});

t('front en gare : il ralentit nettement', () => {
  const sim = new Sim({ seed: 120, mode: 'endless' }); sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  const v0 = sim.stormSpeed();
  sim.stop = { k: 'station', i: 0, t: 50, v: [], c: [], b: [0, 0, 0], f: 1, fk: null, rv: [] };
  assert.ok(Math.abs(sim.stormSpeed() - v0 * STORM_STATION_K) < 1e-9);
  sim.press = -1e9; sim.nf = 1e9; sim.rd = 1e9; sim.ed = 1e9;
  const g0 = sim.gap; run(sim, 40, () => sim.drainEvents());
  assert.ok(g0 - sim.gap < v0 * 40 * 0.35, 'avance perdue en 40 s de gare : ' + (g0 - sim.gap).toFixed(0) + ' m');
});

t('caisses : fioul, charbon, fioul gelé (dégel près du feu), pièces détachées', () => {
  const sim = calmSim({ seed: 121 }); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000', role: 0 });
  sim.fuel = 20;
  sim.feed(0, 2); assert.ok(Math.abs(sim.fuel - 65) < 1e-6, 'charbon +45');
  sim.feed(0, 3); assert.ok(Math.abs(sim.fuel - 73) < 1e-6, 'gelé : presque rien');
  const sc = sim.scrap; sim.feed(0, 4); assert.equal(sim.scrap, sc + 3, 'pièces : ferraille'); assert.ok(Math.abs(sim.fuel - 73) < 1e-6);
  // une caisse gelée posée près de la chaudière devient du fioul
  const c = sim.spawnCrate(0.4, DECK_Y + 0.25, 2.2, 1, null, 3);
  run(sim, THAW_T + 0.5, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.equal(c.t, 1, 'dégelée');
  // portée près du feu, elle dégèle aussi
  Object.assign(p, { x: 0.2, z: 2.2, carry: 3, cth: 0 });
  run(sim, THAW_T + 0.5, () => { p.inp = { mx: 0, mz: 0 }; });
  assert.equal(p.carry, 1);
  // le charbon est lourd
  const a = { ...p, carry: 2, on: 0, ref: 0, y: 0, vx: 0, vz: 0, st: 0 }, b = { ...p, carry: 1, on: 0, ref: 0, y: 0, vx: 0, vz: 0, st: 0 };
  for (let i = 0; i < 40; i++) { stepPlayer(a, { mx: 1, mz: 0 }, DT, moveCtx({ v: 0, up: {} }, [])); stepPlayer(b, { mx: 1, mz: 0 }, DT, moveCtx({ v: 0, up: {} }, [])); }
  assert.ok(a.vx < b.vx * 0.9 && a.vx > 2.6, 'porter du charbon ralentit (mais on rattrape le convoi)');
  // l'état diffusé garde le type des caisses
  const copy = Sim.restore(JSON.parse(JSON.stringify(sim.snapshot())));
  assert.deepEqual(copy.crates.map((q) => q.t), sim.crates.map((q) => q.t));
});

t('ambiances : la ville regorge de ruines, la forêt d\'arbres, le pont reste dégagé', () => {
  const count = (bio, f) => { let n = 0; for (let k = 2; k < 120; k++) n += f(chunkRuins(7, k, 0.6, { bio })); return n; };
  assert.ok(count('ville', (c) => c.ruins.length) > count('foret', (c) => c.ruins.length) * 2, 'ville > forêt en ruines');
  assert.ok(count('foret', (c) => c.trees.length) > count('plaine', (c) => c.trees.length) * 2, 'forêt > plaine en sapins');
  for (let k = 0; k < 40; k++) {
    const c = chunkRuins(9, k, 0.9, { bio: 'ville', clear: [400, 450] });
    for (const r of c.ruins) assert.ok(-r.zw < 390 - 3 || -r.zw > 460 + 3, 'aucune ruine sur le pont');
    for (const tr of c.trees) assert.ok(-tr.zw < 390 || -tr.zw > 460, 'aucun sapin sur le pont');
  }
  for (const b of Object.values(BIOMES)) for (const m of Object.keys(b.moments)) assert.ok(['boss', 'bridge', 'wreck', 'roar'].includes(m));
  // lac gelé : on glisse, et la glace cède si l'on reste planté
  const sim = calmSim({ seed: 122, mode: 'endless' }); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.legs = ['lac']; sim.ruins.setLegs(sim.legs); sim.ed = 1e9;
  Object.assign(p, { on: 0, ref: 0, y: 0, x: 9, z: 0, carry: 1 });
  const ev = []; run(sim, 4, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; sim.v = 0; });
  assert.ok(ev.some((e) => e.e === 'ice_warn') && ev.some((e) => e.e === 'crack' && e.p === 0), 'la glace cède');
  assert.equal(p.carry, 0); assert.ok(p.heat < 70);
  const ice = { x: 0, z: 0, y: 0, vx: 0, vz: 0, on: 0, ref: 0, air: 0, st: 0 }, snow = { ...ice };
  for (let i = 0; i < 20; i++) { stepPlayer(ice, { mx: 1, mz: 0 }, DT, moveCtx({ v: 0, up: {}, ice: true }, [])); stepPlayer(snow, { mx: 1, mz: 0 }, DT, moveCtx({ v: 0, up: {} }, [])); }
  assert.ok(ice.vx < snow.vx * 0.6, 'ça glisse : on démarre lentement');
  // plaine gelée : la voie dégagée fait filer le convoi, et ses fermes cachent des survivants
  const pl = new Sim({ seed: 5, mode: 'endless' }), fo = new Sim({ seed: 5, mode: 'endless' });
  fo.legs = ['foret']; fo.ruins.setLegs(fo.legs);
  assert.ok(pl.speedK() > fo.speedK() * 1.08, 'le convoi file plus vite dans la plaine');
  let farms = 0, fs = 0, hs = 0, houses = 0;
  for (let k = 2; k < 200; k++) for (const r of chunkRuins(7, k, 0.6, { bio: 'plaine' }).ruins) {
    if (r.kind === 'farm') { farms++; fs += r.spots.reduce((a, s) => a + s.surv, 0); }
    if (r.kind === 'house') { houses++; hs += r.spots.reduce((a, s) => a + s.surv, 0); }
  }
  assert.ok(farms > 20 && fs / farms > 2 * hs / Math.max(1, houses), 'des fermes, plus souvent habitées que les maisons');
});

t('jour et nuit : la nuit tombe, les loups sont plus nombreux, pas de pillards', () => {
  assert.equal(nightK(0), 0);
  let tn = 0; while (!dayInfo(tn).night) tn += 1;
  assert.ok(tn > 120 && tn < DAY_LEN, 'première nuit après ' + tn + ' s');
  assert.ok(nightK(tn + 20) > 0.9);
  let td = tn; while (dayInfo(td).night) td += 1;
  assert.ok(td - tn > 60 && td - tn < DAY_LEN / 2, 'la nuit dure ' + (td - tn) + ' s');
  const sim = new Sim({ seed: 123 }); sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.t = tn + 20; sim.dist = 1000; sim.rd = 0; sim.storm = -1e9; sim.press = -1e9; sim.nf = 1e9; sim.ed = 1e9;
  const ev = []; run(sim, 2, () => ev.push(...sim.drainEvents()));
  assert.ok(ev.some((e) => e.e === 'night'), 'annonce de la nuit');
  assert.equal(sim.raiders.length, 0, 'pas de raid la nuit');
});

t('moments forts : placés au milieu des tronçons, selon l\'ambiance choisie', () => {
  for (const mode of ['expedition', 'endless']) for (const seed of [1, 2, 3]) {
    const goal = mode === 'expedition' ? 2000 : 0;
    for (let L = 1; L < 4; L++) {
      const d = momentPos(seed, mode, goal, L); assert.ok(d != null);
      assert.equal(legAt(mode, goal, d), L, 'dans son tronçon');
      assert.ok(d + BRIDGE_LEN < (stationDist(mode, goal, L) ?? goal) - 60, 'loin de la gare suivante');
    }
  }
  assert.equal(momentOf(5, 'expedition', 2000, { legs: ['plaine'], mk: [] }, 1), null, 'pas avant l\'aiguillage');
  assert.equal(momentOf(5, 'expedition', 2000, { legs: ['plaine', 'lac'], mk: [] }, 1), null, 'pas avant l\'aiguillage du milieu');
  const ks = momentKinds(5, 1, 'lac'); assert.deepEqual([...ks].sort(), ['boss', 'bridge']);
  const m = momentOf(5, 'expedition', 2000, { legs: ['plaine', 'lac'], mk: [, 1] }, 1);
  assert.equal(m.k, ks[1]);
  // aucun événement de voie sur un moment fort
  const sim = new Sim({ seed: 5 });
  for (let i = 1; i < 12; i++) { sim.ed = sim.eventDist(i); for (let L = 1; L < 4; L++) { const d = momentPos(5, 'expedition', sim.goal, L); assert.ok(sim.ed < d - 100 || sim.ed > d + BRIDGE_LEN + 100); } }
});

// un convoi bien réglé arrivant sur le moment fort du tronçon 1 de l'ambiance donnée
function momentSim(kind, seedFrom = 200) {
  for (let seed = seedFrom; seed < seedFrom + 400; seed++) for (const bio of BIOME_LIST) {
    const c = momentKinds(seed, 1, bio).indexOf(kind); if (c < 0) continue;
    const sim = new Sim({ seed, mode: 'endless' });
    sim.legs = ['plaine', bio]; sim.mk = [undefined, c]; sim.ruins.setRoute(sim.legs, sim.mk);
    sim.press = -1e9; sim.nf = 1e9; sim.rd = 1e9; sim.ed = 1e9; sim.storm = -1e9;
    const d = momentPos(seed, 'endless', 0, 1);
    sim.ns = 1; sim.cl = 1; sim.dist = d - 240; sim.v = 2; sim.ks = Math.floor((sim.dist + 85) / CHUNK);
    return { sim, d };
  }
  throw new Error('pas de graine pour ' + kind);
}
const BIOME_LIST = Object.keys(BIOMES);

t('pont de la gorge : trop vite il se fissure, en Éco ça passe ; dehors, la chute', () => {
  const { sim, d } = momentSim('bridge'); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  const ev = []; let minHull = 100;
  run(sim, 200, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; sim.fuel = 100; minHull = Math.min(minHull, sim.hull); });
  assert.ok(ev.some((e) => e.e === 'moment' && e.k === 'bridge'));
  assert.ok(ev.some((e) => e.e === 'bridge_crack'), 'à pleine vitesse le pont cède'); assert.ok(minHull < 80);
  const e2 = momentSim('bridge'); const q = e2.sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' }); e2.sim.thr = 0;
  const ev2 = []; run(e2.sim, 200, () => { ev2.push(...e2.sim.drainEvents()); q.inp = { mx: 0, mz: 0 }; e2.sim.fuel = 100; });
  assert.ok(ev2.some((e) => e.e === 'bridge_done') && !ev2.some((e) => e.e === 'bridge_crack'), 'en Éco, pas de casse');
  // un joueur resté dehors au-dessus de la gorge
  const e3 = momentSim('bridge'); const r = e3.sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  e3.sim.dist = e3.d - 150; e3.sim.step(DT); e3.sim.drainEvents();
  e3.sim.dist = e3.d + 30; e3.sim.v = 0;
  Object.assign(r, { on: 0, ref: 0, y: 0, x: 6, z: 2 });
  const ev3 = []; run(e3.sim, 0.5, () => { ev3.push(...e3.sim.drainEvents()); r.inp = { mx: 0, mz: 0 }; });
  assert.ok(ev3.some((e) => e.e === 'gorge'), 'tombé dans la gorge');
  assert.ok(momentColliders(null, 0).length === 0);
});

t('convoi abandonné : arrêt, caisses le long du vieux train, départ au vote', () => {
  const { sim, d } = momentSim('wreck'); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  const ev = []; run(sim, 200, () => { ev.push(...sim.drainEvents()); p.inp = { mx: 0, mz: 0 }; sim.fuel = 100; if (sim.stop && sim.stop.k === 'wreck') sim.v = 0; return; });
  // il s'arrête, puis repart tout seul au bout du compte à rebours
  assert.ok(ev.some((e) => e.e === 'wreck'), 'arrêt au convoi abandonné');
  assert.ok(sim.dist > d + 5, 'reparti');
  const w = momentSim('wreck'); const q = w.sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  for (let i = 0; i < 200 * 60 && !(w.sim.stop && w.sim.stop.k === 'wreck'); i++) { q.inp = { mx: 0, mz: 0 }; w.sim.fuel = 100; w.sim.step(DT); }
  assert.ok(w.sim.stop && Math.abs(w.sim.dist - w.d) < 0.3);
  assert.ok(w.sim.crates.filter((c) => c.m === 0).length >= 5, 'des caisses à ramasser');
  assert.equal(momentColliders(w.sim.mm, w.sim.dist).length, 3, 'les vieux wagons sont solides');
  const copy = Sim.restore(JSON.parse(JSON.stringify(w.sim.snapshot())));
  assert.equal(copy.stop.k, 'wreck'); assert.equal(copy.mm.k, 'wreck');
  w.sim.vote(0); run(w.sim, 0.5);
  assert.equal(w.sim.stop, null, 'départ au vote');
});

t('le Brise-Glace : grappins qui freinent, coupés au couteau, abattu à coups de caisses', () => {
  const { sim, d } = momentSim('boss'); const p = sim.addPlayer({ id: 0, name: 'A', color: '#ff0000', role: 3 });
  const m = sim.addPlayer({ id: 1, name: 'M', color: '#00ff00', role: 0 });
  const ev = [];
  for (let i = 0; i < 200 * 60 && !sim.hooks.length; i++) { p.inp = m.inp = { mx: 0, mz: 0 }; sim.fuel = 100; sim.step(DT); ev.push(...sim.drainEvents()); }
  assert.ok(sim.boss && ev.some((e) => e.e === 'moment' && e.k === 'boss') && ev.some((e) => e.e === 'hook'), 'grappin lancé');
  assert.ok(sim.speedK() < 0.8 * (sim.B().fast || 1), 'le grappin freine');
  const h = sim.hooks[0];
  Object.assign(m, { x: h.x * 0.85, z: h.z, on: 1, ref: 1, y: DECK_Y, air: 0, st: 0 });
  run(sim, 1.2, () => { m.inp = { mx: 0, mz: 0, use: true }; p.inp = { mx: 0, mz: 0 }; sim.fuel = 100; ev.push(...sim.drainEvents()); });
  assert.ok(ev.some((e) => e.e === 'cut'), 'le mécano coupe vite');
  // la vigie lance des caisses sur le camion (2 dégâts par coup)
  const b = sim.boss; const hp0 = b.hp, sc0 = sim.scrap;
  for (let k = 0; k < 3 && sim.boss && sim.boss.st < 3; k++) {
    const c = sim.spawnCrate(b.x, 2.5, b.z, 2, { vx: 0, vy: 0, vz: 0 }); c.by = 0; sim.step(DT); ev.push(...sim.drainEvents());
  }
  assert.ok(ev.some((e) => e.e === 'boss_hit' && e.hp === Math.max(0, hp0 - 2)), 'touché');
  assert.ok(ev.some((e) => e.e === 'boss_down'), 'abattu'); assert.equal(sim.hooks.length, 0);
  assert.ok(sim.scrap >= sc0 + 4, 'butin');
  const copy = Sim.restore(JSON.parse(JSON.stringify(sim.snapshot())));
  assert.equal(copy.boss.st, 3);
});

t('rugissement du Front : il fonce, puis s\'essouffle', () => {
  const { sim, d } = momentSim('roar'); sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  sim.storm = sim.dist - 150;
  const v0 = sim.stormSpeed();
  sim.dist = d; sim.step(DT); sim.drainEvents();
  assert.equal(sim.mm.k, 'roar'); assert.ok(sim.stormSpeed() > v0 * 1.6);
  sim.mm.t = 41; assert.ok(sim.stormSpeed() < v0 * 0.7);
});

t('rôles : chacun son talent', () => {
  const sim = calmSim({ seed: 124 });
  const ps = [0, 1, 2, 3].map((i) => sim.addPlayer({ id: i, name: 'P' + i, color: '#ff0000' }));
  assert.deepEqual(ps.map((p) => p.role).sort(), [0, 1, 2, 3], 'rôles répartis automatiquement');
  assert.equal(ROLES.length, 4);
  const guard = ps.find((p) => p.role === 3), other = ps.find((p) => p.role === 1);
  assert.equal(guard.flares, other.flares + 2, 'la vigie a deux fusées de plus');
  const stoker = ps.find((p) => p.role === 2);
  sim.fuel = 10; sim.feed(stoker.id, 1); assert.ok(Math.abs(sim.fuel - 41) < 1e-6, 'le chauffeur tire plus du fioul');
  const scout = { ...other, on: 0, ref: 0, y: 0, vx: 0, vz: 0, st: 0, carry: 0 }, meca = { ...scout, role: 0 };
  for (let i = 0; i < 60; i++) { stepPlayer(scout, { mx: 1, mz: 0 }, DT, moveCtx({ v: 0, up: {} }, [])); stepPlayer(meca, { mx: 1, mz: 0 }, DT, moveCtx({ v: 0, up: {} }, [])); }
  assert.ok(scout.vx > meca.vx * 1.1, 'l\'éclaireur court plus vite dans la neige');
  // le rôle voyage dans l'état diffusé
  assert.equal(playerFromRow(sim.snapshot().P.find((a) => a[0] === stoker.id)).role, 2);
});

t('cartes : leurs effets', () => {
  const sim = new Sim({ seed: 125 }); sim.addPlayer({ id: 0, name: 'A', color: '#ff0000' });
  const b0 = sim.burnRate(), k0 = sim.speedK(), s0 = sim.stormSpeed();
  Object.assign(sim.up, { boiler: 1, pistons: 1, breaker: 1 });
  assert.ok(sim.burnRate() < b0 && sim.speedK() > k0 && sim.stormSpeed() < s0);
  // filet : une caisse qui rate le wagon de peu est rattrapée
  sim.up.net = 1; sim.calm = true;
  const c = sim.spawnCrate(HALF_W + 1.5, 2, 3, 2, { vx: 0, vy: 0, vz: 0 }); run(sim, 1);
  assert.equal(c.m, 1, 'rattrapée à bord');
  // échelle rallongée
  const p = { x: 1.8, z: REAR + 2.6, y: 0, vx: 0, vz: 0, on: 0, ref: 1, air: 0, st: 0 };
  stepPlayer(p, { mx: 0, mz: 0 }, DT, moveCtx({ v: 0, up: { ladder: 1 } }, []));
  assert.equal(p.st, 2, 'on attrape l\'échelle de plus loin');
  // pas deux fois la même carte au maximum
  sim.up.radar = 1; for (let i = 0; i < 20; i++) assert.ok(!sim.cardsFor(i).includes('radar'));
});

// Pilote automatique très simple : fouille, rapporte, remonte, nourrit.
function autopilot(sim, p, time) {
  const t0 = (time * 60) | 0;
  const go = (tx, tz, extra = {}) => {
    // à bord : contourner la caisse à outils (côté droit) et le bac à charbon (côté gauche) par le milieu du pont
    const d0 = Math.hypot(tx - p.x, tz - p.z);
    if (p.on && Math.abs(tx) <= HALF_W && tz > -13 && tz < REAR && ((tx > 0.5 || p.x > 0.5) && (Math.min(p.z, tz) < -3.0 && Math.max(p.z, tz) > -4.8)
      || (tx < -0.4 || p.x < -0.4) && (Math.min(p.z, tz) < 12.2 && Math.max(p.z, tz) > 8.8))) {
      if (Math.abs(p.x - 0.1) > 0.25 && d0 > 1.2) { tx = 0.1; tz = p.z; }
    }
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz) || 1;
    p.inp = { mx: dx / d, mz: dz / d, use: false, thr: p.inp.thr | 0, jump: p.inp.jump | 0, fl: p.inp.fl | 0, ...extra };
    return d0 || 0.001; // la distance jusqu'à la vraie cible, même en passant par un détour
  };
  if (p.st >= 2) return;
  // en gare : on vote le départ (après avoir dépensé la ferraille)
  if (sim.stop && sim.stop.k === 'station') {
    for (const k of sim.stop.c) sim.buy(p.id, k);
    if (!sim.stop.v.includes(p.id)) sim.vote(p.id);
  }
  // convoi abandonné : on ramasse ce qu'on peut, puis on repart
  if (sim.stop && sim.stop.k === 'wreck' && sim.stop.t < 20 && !sim.stop.v.includes(p.id) && (p.on || sim.stop.t < 8)) sim.vote(p.id);
  // à bord : le premier équipier présent tient la soupape, la manette et les réparations
  const crew = [...sim.players.values()].filter((q) => q.on && q.st < 2 && !q.carry);
  const chief = crew.length && crew.reduce((a, b) => (a.id < b.id ? a : b)) === p;
  const edge = t0 % 2 === 0;
  if (p.on && !p.carry && p.st < 2) {
    if (sim.press > 62 && (chief || sim.press > 85)) p.vent = true;
    if (sim.press < 8) p.vent = false;
    if (p.vent) { if (go(VALVE.x, VALVE.z - 0.3) < 0.7) p.inp = { ...p.inp, mx: 0, mz: 0, use: true }; return; }
    const hook = sim.hooks[p.id % Math.max(1, sim.hooks.length)];
    if (hook) { if (go(hook.x * 0.85, hook.z) < 0.6) p.inp = { ...p.inp, mx: 0, mz: 0, use: true }; return; }
    const raider = sim.raiders.find((w) => w.st === 1);
    if (raider) { if (go(raider.side * (HALF_W - 0.4), raider.z) < 0.8) p.inp = { ...p.inp, mx: 0, mz: 0, use: edge }; return; }
    const f = sim.faults[0];
    if (f && (chief || sim.faults.length > 1)) { const tf = sim.faults.length > 1 && !chief ? sim.faults[1] : f; if (go(tf.x * 0.75, tf.z) < 0.6) p.inp = { ...p.inp, mx: 0, mz: 0, use: true }; return; }
    if (chief) {
      const M = sim.mm, bridge = M && M.k === 'bridge' && sim.dist > M.d - 90;
      const want = bridge ? 0 : sim.gap < 80 && sim.fuel > 45 ? 2 : sim.fuel < 30 && sim.gap > 110 ? 0 : 1;
      if (want !== sim.thr) { if (go(LEVER.x, LEVER.z + 0.5) < 0.6) p.inp = { ...p.inp, mx: 0, mz: 0, use: edge }; return; }
    }
  }
  // congère : tout le monde descend déblayer devant la locomotive
  if (sim.ev && sim.ev.k === 'drift' && !sim.ev.done && sim.dist > sim.ev.stopD - 30 && !p.carry) {
    const zd = sim.ev.zw + sim.dist;
    if (p.on) { go(Math.sign(p.x || 1) * 2.6, -11); if (Math.abs(p.x) > HALF_W - 0.3) p.inp.mx = Math.sign(p.x || 1); return; }
    if (go(Math.sign(p.x || 1) * 1.2, zd + 2.2) < 1.5) p.inp.use = true;
    return;
  }
  // le front approche, ou le pont : on reste à bord
  const onBridge = sim.mm && sim.mm.k === 'bridge' && sim.dist > sim.mm.d - 70;
  if (!p.on && (sim.gap < 45 || onBridge) && !p.carry) { go(0, REAR + 0.7); return; }
  if (p.on && onBridge && !p.carry) { go(0, 4); return; }
  // le Brise-Glace : on lui lance des caisses depuis le bord du wagon
  const B = sim.boss;
  if (B && B.st === 1 && p.carry && p.on && sim.fuel > 35) {
    if (go(B.side * (HALF_W - 0.4), B.z) < 0.6) { p.yaw = B.side > 0 ? Math.PI / 2 : -Math.PI / 2; p.inp = { ...p.inp, mx: 0, mz: 0, thr: (p.inp.thr | 0) + (t0 % 20 === 0 ? 1 : 0) }; }
    return;
  }
  // un loup aux trousses : fusée
  if (!p.on && sim.wolves.some((w) => w.tg === p.id) && p.flares > 0 && t0 % 30 === 0) p.inp.fl = (p.inp.fl | 0) + 1;
  // trop froid : retour au chaud près de la chaudière
  if ((p.heat ?? 100) < 30 && !p.carry) { if (p.on) go(0.2, 2.2); else go(0, REAR + 0.7); return; }
  const near = (c) => ({ x: c.x, z: c.m === 0 ? c.z + sim.dist : c.z });
  if (p.carry) {
    // une caisse gelée : on attend qu'elle dégèle près du feu
    if (p.on) { if (go(0.2, 1.9) < 0.5) p.inp = { mx: 0, mz: 0, use: p.carry !== 3 && t0 % 2 === 0 }; }
    else if (p.z < REAR + 0.3 && Math.abs(p.x) < HALF_W + 1) go(Math.sign(p.x || 1) * (HALF_W + 1.4), REAR + 1);
    else go(0, REAR + 0.7);
    return;
  }
  const deck = sim.crates.find((c) => c.m === 1);
  if (p.on && deck) { if (go(deck.x, deck.z) < 0.9) p.inp.use = t0 % 2 === 0; return; }
  const ground = sim.crates.filter((c) => c.m === 0).map(near).filter((c) => c.z < REAR + 20 && Math.hypot(c.x - p.x, c.z - p.z) < 30).sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
  if (ground) { if (go(ground.x, ground.z) < 1.0) p.inp.use = t0 % 2 === 0; return; }
  let best = null, bd = 1e9;
  for (const [, c] of sim.ruins.around(sim.dist, 60, 10)) for (const r of c.ruins) r.spots.forEach((sp, j) => {
    if (sim.looted.has(r.id * 4 + j)) return;
    const z = sp.zw + sim.dist; if (z > REAR + 12) return;
    const d = Math.hypot(sp.x - p.x, z - p.z); if (d < bd) { bd = d; best = { x: sp.x, z }; }
  });
  if (best) { if (go(best.x, best.z) < 1.4) p.inp = { mx: 0, mz: 0, use: true, thr: p.inp.thr | 0, jump: p.inp.jump | 0 }; return; }
  // sinon : un wagonnet de charbon à pousser, un arbre à abattre près de la voie
  for (const res of sim.resources('cart')) {
    const c = sim.carts.get(res.id); if (c && c.d) continue;
    const q = sim.cartPos(res, c); if (q.z > REAR + 6 || q.z < -40) continue;
    const s = Math.sign(res.x1) || 1;
    if (go(q.x + s * 1.1, q.z) < 0.9) p.inp = { ...p.inp, mx: -s * 0.6, mz: 0, use: true };
    return;
  }
  let tree = null, td = 1e9;
  for (const [, c] of sim.ruins.around(sim.dist, 30, 0)) for (const tr of c.trees) {
    if (sim.cut.has(tr.id)) continue;
    const z = tr.zw + sim.dist; if (z > REAR + 6 || Math.abs(tr.x) > 14) continue;
    const d = Math.hypot(tr.x - p.x, z - p.z); if (d < td) { td = d; tree = { x: tr.x - Math.sign(tr.x) * 0.9, z }; }
  }
  if (tree && td < 30) { if (go(tree.x, tree.z) < 0.8) p.inp = { ...p.inp, mx: 0, mz: 0, use: true }; return; }
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
    const whys = runs.map((r) => r.sim.win ? 'arrivé' : r.sim.why).join('/');
    rows.push(`${diff.padEnd(8)} ${np} joueur(s) [${whys}] : ${(avgT / 60).toFixed(1)} min, ${(runs.reduce((a, r) => a + r.sim.dist, 0) / runs.length).toFixed(0)} m, ${fed.toFixed(1)} caisses, état ≤ ${Math.max(...runs.map((r) => r.maxSnap))} o`);
    const wins = runs.filter((r) => r.sim.win).length;
    rows[rows.length - 1] += ` · ${wins}/3 expéditions réussies`;
    console.log('   ' + rows[rows.length - 1]);
    for (const r of runs) assert.ok(r.maxSnap < 6000, 'état diffusé raisonnable');
    assert.ok(fed >= 2, `le pilote trouve et livre du fioul (${diff}, ${np})`);
    const tank = 100 / (DIFFICULTY[diff].burn * (1 + 0.15 * (np - 1)));
    assert.ok(avgT > tank * 0.8, `la partie dure (${diff}, ${np})`);
  }
});

console.log(`\n${n} tests réussis`);
