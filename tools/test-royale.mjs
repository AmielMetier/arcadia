// Tests d'Island Rush (battle royale) : node tools/test-royale.mjs [nombre de graines]
// Île : sur plusieurs graines, même graine → même île, part de nature, ville, bourg et villages présents (18 bâtiments
// au plus dans la ville et le bourg), bâtiments sur la terre ferme et sans chevauchement, une porte au rez-de-chaussée,
// un escalier dès qu'il y a un étage, toutes les pièces accessibles, des routes qui relient tous les lieux, assez de
// coffres, la tempête et le temps de génération.
// Bots et réseau : une partie de bots suivie par deux copies d'invités (dès le départ, et en cours de route), qui
// restent identiques à l'hôte ; puis une copie reprend la partie (relais d'hôte) ; la prédiction de l'invité.
// Déplacement, sur l'île officielle : une porte fermée arrête, ouverte on entre dans chaque bâtiment, on monte chaque
// escalier jusqu'à l'étage (ou au toit) sans qu'un meuble gêne, un mur plein arrête, on nage dans le lac ; et le coût
// d'un pas pour 30 joueurs. Meubles : aucun ne déborde de sa pièce ni n'en chevauche un autre.
import { generateMap, planStorm, planFlight, CELL, MAX_TOWN_BUILDINGS, ILE } from '../royale/engine/map.js';
import { buildWorld, floorY } from '../royale/engine/world.js';
import { FURN, furnRect } from '../royale/engine/furniture.js';
import { createSim, DT } from '../royale/engine/sim.js';
import { createBuild, slotFor } from '../royale/engine/build.js';
import { weapon } from '../royale/engine/items.js';
import { newPlayer, stepPlayer } from '../royale/engine/player.js';
import { createAI } from '../royale/engine/ai.js';
import { makeTeams } from '../royale/engine/teams.js';
import { snapshot, applySnapshot, mirrorEvent, fullState, applyFull, cleanInput, predictStep, MODES } from '../royale/engine/net.js';

const SEEDS = +(process.argv[2] || 12);
let fails = 0;
const ok = (cond, msg) => { if (!cond) { fails++; console.log('  ✗ ' + msg); } };

const pct = (v) => Math.round(v * 100) + ' %';
for (let seed = 1; seed <= SEEDS; seed++) {
  const m = generateMap(seed);
  const s = m.stats;
  console.log(`graine ${seed} · ${m.ms} ms · île ${s.islandKm2.toFixed(2)} km² (${s.spanM} m) · nature ${pct(s.nature)} (forêt ${pct(s.forest)}, montagne ${pct(s.mountain)}) · villes ${pct(s.urban)} · lieux ${pct(s.lieux)} · routes ${pct(s.roads)}`);
  console.log(`  ${m.pois.map((p) => p.name + ' (' + p.label + ', ' + p.buildings.length + ' bât., ' + p.chests + ' coffres)').join(' · ')}`);
  console.log(`  ${s.buildings} bâtiments, ${s.byType.abandonnee || 0} abandonnés · ${s.chests} coffres · ${s.loot} butins · ${s.ammo} munitions · ${s.props.arbre || 0}+${s.props.sapin || 0} arbres · ${s.props.rocher || 0} rochers · ${s.props.voiture || 0} voitures · ${s.roadKm.toFixed(1)} km de routes · ${s.bridges} ponts`);

  ok(generateMap(seed).hash === m.hash, `graine ${seed} : deux générations différentes`);
  ok(s.nature >= 0.65, `graine ${seed} : nature ${pct(s.nature)} < 65 %`);
  ok(m.pois.some((p) => p.kind === 'ville'), `graine ${seed} : pas de ville`);
  ok(m.pois.filter((p) => p.kind === 'village').length >= 3, `graine ${seed} : moins de trois villages`);
  ok(m.pois.some((p) => p.kind === 'bourg'), `graine ${seed} : pas de bourg`);
  for (const p of m.pois) if (p.town) ok(p.buildings.length <= MAX_TOWN_BUILDINGS, `graine ${seed} : ${p.name} a ${p.buildings.length} bâtiments (${MAX_TOWN_BUILDINGS} au plus)`);
  ok(m.pois.filter((p) => !p.town).length >= 5, `graine ${seed} : moins de 5 lieux-dits`);
  ok((s.byType.abandonnee || 0) >= 8, `graine ${seed} : moins de 8 maisons abandonnées`);
  ok(s.chests >= 50, `graine ${seed} : seulement ${s.chests} coffres`);
  ok(m.ms < 4000, `graine ${seed} : génération trop lente (${m.ms} ms)`);

  const occ = new Map();
  for (const b of m.buildings) {
    for (let z = b.z0; z < b.z0 + b.d; z++) for (let x = b.x0; x < b.x0 + b.w; x++) {
      const key = x + ',' + z;
      ok(!occ.has(key), `graine ${seed} : ${b.label} n°${b.id} chevauche n°${occ.get(key)}`);
      occ.set(key, b.id);
      ok(m.waterAt((x + 0.5) * CELL, (z + 0.5) * CELL) === 0, `graine ${seed} : ${b.label} n°${b.id} les pieds dans l'eau`);
    }
    const g = b.levels[0].walls.filter((e) => e.ext && (e.k === 'porte' || e.k === 'portail'));
    ok(g.length >= 1, `graine ${seed} : ${b.label} n°${b.id} sans porte`);
    ok(b.floors === 1 || b.stairs, `graine ${seed} : ${b.label} n°${b.id} à étages sans escalier`);
    // le sol reste plat sous le bâtiment
    let lo = Infinity, hi = -Infinity;
    for (let z = b.z0; z <= b.z0 + b.d; z++) for (let x = b.x0; x <= b.x0 + b.w; x++) { const h = m.heightAt(x * CELL, z * CELL); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    ok(hi - lo < 1.6, `graine ${seed} : ${b.label} n°${b.id} sur un sol en pente (${(hi - lo).toFixed(1)} m)`);
  }
  // toutes les pièces d'un étage communiquent (portes intérieures), et l'escalier n'est pas coupé en deux
  for (const b of m.buildings) for (const lv of b.levels) {
    const edge = new Map(lv.walls.map((e) => [e.o + e.x + ',' + e.z, e.k]));
    const seen = new Set([b.x0 + ',' + b.z0]), todo = [[b.x0, b.z0]];
    while (todo.length) {
      const [x, z] = todo.pop();
      for (const [dx, dz, key] of [[1, 0, 'v' + (x + 1) + ',' + z], [-1, 0, 'v' + x + ',' + z], [0, 1, 'h' + x + ',' + (z + 1)], [0, -1, 'h' + x + ',' + z]]) {
        const nx = x + dx, nz = z + dz;
        if (nx < b.x0 || nz < b.z0 || nx >= b.x0 + b.w || nz >= b.z0 + b.d || seen.has(nx + ',' + nz)) continue;
        const k = edge.get(key);
        if (k === 'mur' || k === 'fenetre') continue;
        seen.add(nx + ',' + nz); todo.push([nx, nz]);
      }
    }
    ok(seen.size === b.w * b.d, `graine ${seed} : ${b.label} n°${b.id}, étage ${lv.k} : pièce fermée (${seen.size}/${b.w * b.d})`);
  }
  // routes : tous les lieux reliés
  const adj = new Map(m.pois.map((p) => [p.id, new Set()]));
  for (const r of m.roads) { adj.get(r.from).add(r.to); adj.get(r.to).add(r.from); }
  const start = m.pois[0].id, seen = new Set([start]), todo = [start];
  while (todo.length) for (const n of adj.get(todo.pop())) if (!seen.has(n)) { seen.add(n); todo.push(n); }
  const cut = m.pois.filter((p) => !seen.has(p.id));
  ok(!cut.length, `graine ${seed} : lieux sans route : ${cut.map((p) => p.name).join(', ')}`);
  // tempête : chaque cercle tient dans le précédent et finit sur la terre
  const st = planStorm(m, seed * 7);
  for (let i = 1; i < st.length; i++) ok(Math.hypot(st[i].x - st[i - 1].x, st[i].z - st[i - 1].z) + st[i].r <= st[i - 1].r + 0.01, `graine ${seed} : cercle ${i} hors du précédent`);
  ok(m.waterAt(st[st.length - 1].x, st[st.length - 1].z) === 0, `graine ${seed} : la tempête finit dans l'eau`);
  const fl = planFlight(m, seed);
  ok(Number.isFinite(fl.x0 + fl.z1), `graine ${seed} : trajet de la montgolfière invalide`);
}

// ------------------------------------------------------------------ déplacement sur l'île officielle
{
  const m = generateMap(ILE);
  let t = performance.now();
  const W = buildWorld(m);
  const wms = performance.now() - t;
  console.log(`\nîle officielle (graine ${ILE}) : monde solide en ${Math.round(wms)} ms, ${W.solids.length} formes, ${W.ramps.length} rampes`);
  ok(wms < 400, `monde solide trop lent (${Math.round(wms)} ms)`);
  const yawTo = (dx, dz) => Math.atan2(dx, dz);
  const run = (p, inp, sec) => { for (let i = 0; i < sec * 60; i++) stepPlayer(p, inp, W, 1 / 60); return p; };
  const inside = (p, b) => p.x > b.x0 * CELL && p.x < (b.x0 + b.w) * CELL && p.z > b.z0 * CELL && p.z < (b.z0 + b.d) * CELL;
  let doors = 0, stairs = 0;
  for (const b of m.buildings) {
    // par la porte d'entrée (ou le portail)
    const door = b.levels[0].walls.find((e) => e.ext && (e.k === 'porte' || e.k === 'portail'));
    const mx = door.o === 'h' ? (door.x + 0.5) * CELL : door.x * CELL, mz = door.o === 'h' ? door.z * CELL : (door.z + 0.5) * CELL;
    const nx = door.o === 'h' ? 0 : door.x === b.x0 ? 1 : -1, nz = door.o === 'h' ? (door.z === b.z0 ? 1 : -1) : 0;
    const start = () => newPlayer(mx - nx * 3, m.heightAt(mx - nx * 3, mz - nz * 3) + 0.5, mz - nz * 3, yawTo(nx, nz));
    // porte fermée : elle arrête ; ouverte : on entre
    const leaf = b.doors.find((d) => d.k === 0 && d.o === door.o && d.x === door.x && d.z === door.z);
    if (leaf) {
      W.setDoor(leaf.id, false);
      const c = run(start(), { yaw: yawTo(nx, nz) }, 0.4); run(c, { mz: 1, yaw: c.yaw }, 1.3);
      ok(!inside(c, b), `${b.label} n°${b.id} : une porte fermée ne retient pas`);
      W.setDoor(leaf.id, true);
      const nearDoor = W.doorNear(mx - nx * 1.2, b.y + 0.15, mz - nz * 1.2, nx, nz);
      ok(nearDoor === leaf, `${b.label} n°${b.id} : la porte devant soi n'est pas trouvée`);
    }
    const p = start();
    run(p, { yaw: p.yaw }, 0.4); run(p, { mz: 1, yaw: p.yaw }, 1.3);
    ok(inside(p, b), `${b.label} n°${b.id} : on n'entre pas par la porte`);
    if (inside(p, b)) doors++;
    // chaque escalier, du palier bas au palier haut
    for (const lv of b.levels) {
      if (!lv.stairs) continue;
      const st = lv.stairs, k = lv.k;
      const q = newPlayer((st.x - st.dx + 0.5) * CELL, floorY(b, k), (st.z - st.dz + 0.5) * CELL, yawTo(st.dx, st.dz));
      run(q, { yaw: q.yaw }, 0.2); run(q, { mz: 1, yaw: q.yaw }, 1.6);
      const up = Math.abs(q.y - floorY(b, k + 1)) < 0.3;
      ok(up, `${b.label} n°${b.id} : escalier de l'étage ${k} pas monté (${q.y.toFixed(2)} au lieu de ${floorY(b, k + 1).toFixed(2)})`);
      if (up) stairs++;
    }
  }
  // meubles : dans les murs du bâtiment, sans se chevaucher (les tapis passent sous les tables)
  let furn = 0;
  for (const b of m.buildings) {
    furn += b.furniture.length;
    const solid = b.furniture.filter((f) => FURN[f.kind].solid);
    for (const f of b.furniture) {
      const r = furnRect(f);
      ok(r.x0 >= b.x0 * CELL && r.x1 <= (b.x0 + b.w) * CELL && r.z0 >= b.z0 * CELL && r.z1 <= (b.z0 + b.d) * CELL, `${b.label} n°${b.id} : ${f.kind} dépasse du bâtiment`);
    }
    for (let i = 0; i < solid.length; i++) for (let j = i + 1; j < solid.length; j++) {
      if (solid[i].k !== solid[j].k) continue;
      const a = furnRect(solid[i]), c = furnRect(solid[j]);
      ok(!(a.x0 < c.x1 - 0.01 && a.x1 > c.x0 + 0.01 && a.z0 < c.z1 - 0.01 && a.z1 > c.z0 + 0.01), `${b.label} n°${b.id} : ${solid[i].kind} et ${solid[j].kind} se chevauchent`);
    }
  }
  console.log(`  ${furn} meubles, ${m.stats.doors} portes`);
  // un mur plein arrête
  const b = m.buildings.find((q) => q.levels[0].walls.some((e) => e.ext && e.k === 'mur' && e.o === 'h' && e.z === q.z0));
  const e = b.levels[0].walls.find((q) => q.ext && q.k === 'mur' && q.o === 'h' && q.z === b.z0);
  const wp = newPlayer((e.x + 0.5) * CELL, m.heightAt((e.x + 0.5) * CELL, e.z * CELL - 3) + 0.3, e.z * CELL - 3, yawTo(0, 1));
  run(wp, { mz: 1, yaw: wp.yaw }, 2);
  ok(wp.z < e.z * CELL, 'on traverse un mur plein');
  // on nage dans le lac (la tête hors de l'eau)
  const sw = newPlayer(m.lake.x, m.lake.level, m.lake.z, 0);
  run(sw, { mz: 1, yaw: 0 }, 1);
  ok(sw.swim && sw.y > m.lake.level - 1.6 && sw.y < m.lake.level - 1, `on ne nage pas dans le lac (${sw.y.toFixed(2)} pour un niveau de ${m.lake.level.toFixed(2)})`);
  // suivre une route à pied, point par point ; low : plus bas atteint sous la route (on tombe d'un pont, dans l'eau)
  const follow = (p, pts) => {
    let low = 0, swim = false;
    for (const q of pts) {
      for (let f = 0; f < 360 && Math.hypot(q.x - p.x, q.z - p.z) > 1.2; f++) {
        stepPlayer(p, { mz: 1, yaw: yawTo(q.x - p.x, q.z - p.z) }, W, 1 / 60);
        low = Math.max(low, q.y - p.y); swim ||= p.swim;
      }
      if (Math.hypot(q.x - p.x, q.z - p.z) > 1.2) return { done: false, low, swim };
    }
    return { done: true, low, swim };
  };
  // ponts : on les traverse sans tomber ni buter, dans les deux sens
  let bridgesOk = 0;
  for (const r of m.roads) {
    const i0 = r.pts.findIndex((q) => q.bridge);
    if (i0 < 0) continue;
    let i1 = i0; while (i1 + 1 < r.pts.length && r.pts[i1 + 1].bridge) i1++;
    const pts = r.pts.slice(Math.max(0, i0 - 3), i1 + 4);
    for (const way of [pts, [...pts].reverse()]) {
      const p = newPlayer(way[0].x, way[0].y + 0.3, way[0].z, 0);
      run(p, { yaw: 0 }, 0.3);
      const res = follow(p, way.slice(1));
      ok(res.done && !res.swim && res.low < 0.7, `pont : traversée ratée (arrivé ${res.done}, à l'eau ${res.swim}, ${res.low.toFixed(2)} m sous la route)`);
      if (res.done && !res.swim && res.low < 0.7) bridgesOk++;
    }
  }
  // pentes : un flanc de montagne à plus de 45° ne s'escalade pas (même en sautant) ; on glisse vers le bas
  let steep = null;
  for (let z = 8; z < m.size - 8 && !steep; z += 3) for (let x = 8; x < m.size - 8; x += 3) {
    if (m.waterAt(x, z) || m.heightAt(x, z) < 30) continue;
    const s = W.slope(x, z, m.heightAt(x, z));
    if (s && Math.hypot(s[0], s[1]) > 1.1) { steep = { x, z, s }; break; }
  }
  ok(steep, 'aucun flanc raide sur l\'île');
  if (steep) {
    const cp = newPlayer(steep.x, m.heightAt(steep.x, steep.z), steep.z, 0), y0 = cp.y;
    run(cp, { mz: 1, sprint: true, jump: true, yaw: yawTo(steep.s[0], steep.s[1]) }, 3);
    ok(cp.y < y0 - 1, `on escalade un flanc de ${Math.round(Math.atan(Math.hypot(...steep.s)) * 180 / Math.PI)}° (${y0.toFixed(1)} → ${cp.y.toFixed(1)} m)`);
  }
  // par le chemin, on monte à pied jusqu'au refuge du sommet
  const chalet = m.pois.find((q) => q.kind === 'chalet');
  if (chalet) {
    const dc = (q) => Math.hypot(q.x - chalet.x, q.z - chalet.z);
    const road = m.roads.find((r) => Math.min(...r.pts.map(dc)) < 40);
    ok(road, 'pas de chemin jusqu\'au refuge');
    if (road) {
      const pts = dc(road.pts[0]) < dc(road.pts[road.pts.length - 1]) ? [...road.pts].reverse() : road.pts;
      const p = newPlayer(pts[0].x, pts[0].y + 0.3, pts[0].z, 0);
      const res = follow(p, pts.slice(1));
      ok(res.done && dc(p) < 40, `le chemin du refuge ne se monte pas à pied (arrêté à ${Math.round(dc(p))} m, ${p.y.toFixed(1)} m d'altitude)`);
    }
  }
  console.log(`  ${bridgesOk} traversées de pont · flanc raide ${steep ? 'glissant' : '—'} · refuge du sommet ${chalet ? 'atteint par le chemin' : '—'}`);
  // 30 joueurs qui courent et sautent : coût d'un pas
  const pl = Array.from({ length: 30 }, (_, i) => newPlayer(m.center - 300 + i * 20, 40, m.center));
  t = performance.now();
  for (let f = 0; f < 600; f++) for (const p of pl) stepPlayer(p, { mz: 1, mx: 0.3, yaw: f * 0.01, jump: f % 90 === 0 }, W, 1 / 60);
  const step = (performance.now() - t) / 600;
  console.log(`  ${doors}/${m.buildings.length} entrées, ${stairs} escaliers montés · 30 joueurs : ${step.toFixed(3)} ms par pas`);
  ok(step < 2, `pas de simulation trop cher (${step.toFixed(2)} ms)`);
}
// ------------------------------------------------------------------ une partie : saut, combat, récolte, construction
{
  const m = generateMap(ILE), W = buildWorld(m);
  const sim = createSim({ map: m, world: W, seed: 5, roster: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }], mode: 'partie' });
  const B = createBuild(sim, m, W);
  const A = sim.player('a'), Bp = sim.player('b');
  ok(sim.S.items.size > 600 && sim.S.chests.size > 150, `butin au départ : ${sim.S.items.size} objets, ${sim.S.chests.size} coffres`);
  // saut de la montgolfière, atterrissage
  for (let i = 0; i < 300; i++) sim.step(DT);
  sim.input('a', { jump: 1 });
  let landed = false;
  for (let i = 0; i < 60 * 40 && !landed; i++) { sim.step(DT); for (const e of sim.takeEvents()) if (e.e === 'atterrit' && e.p === 'a') landed = true; }
  ok(landed && A.mode === 'sol', 'A ne se pose pas après son saut');
  // un coffre ouvert donne une arme, des munitions, un objet et des matériaux
  const c = [...sim.S.chests.values()].find((q) => q.kind === 'coffre');
  Object.assign(A, { x: c.x + (c.fx || 0) * 1.6, z: c.z + (c.fz || 1) * 1.6, y: c.y + 0.2, vx: 0, vz: 0 });
  sim.input('a', { yaw: Math.atan2(-(c.fx || 0), -(c.fz || 1)), use: 1 });
  sim.step(DT);
  const spawned = [...sim.S.items.values()].filter((g) => Math.hypot(g.x - c.x, g.z - c.z) < 3.5).map((g) => g.it.t);
  // (les munitions se ramassent toutes seules en passant dessus)
  ok(c.open && spawned.includes('arme') && (spawned.includes('munitions') || Object.values(A.ammo).some((n) => n > 0)), `coffre : ${c.open ? 'ouvert' : 'fermé'}, ${spawned.join(', ')}`);
  // un pré dégagé pour la suite
  let spot = null;
  for (let i = 0; i < 5000 && !spot; i++) {
    const x = 300 + ((i * 7919) % 1000), z = 300 + ((i * 104729) % 1000);
    if (m.groundAt(x, z) === 2 && m.groundAt(x, z + 14) === 2 && !m.poiAt(x, z) && !m.props.some((p) => Math.hypot(p.x - x, p.z - z) < 20) && W.support(x, z, 400) - m.heightAt(x, z) < 0.1) spot = { x, z };
  }
  // combat : A, fusil épique, élimine B planté devant lui ; B lâche son butin
  Object.assign(A, { x: spot.x, z: spot.z, y: W.support(spot.x, spot.z, 400), vx: 0, vz: 0 });
  Bp.mode = 'sol'; Bp.inv[0] = weapon('pompe', 1);
  Object.assign(Bp, { x: A.x, z: A.z + 14, y: W.support(A.x, A.z + 14, A.y + 3), vx: 0, vy: 0, vz: 0 });
  A.inv[0] = weapon('fusil', 3); A.ammo.moyennes = 90;
  sim.input('a', { sel: 1, yaw: 0 }); for (let i = 0; i < 30; i++) sim.step(DT);
  const ey = sim.eye(A), dx = Bp.x - ey[0], dy = Bp.y + 1.1 - ey[1], dz = Bp.z - ey[2];
  sim.input('a', { yaw: Math.atan2(dx, dz), pitch: Math.atan2(dy, Math.hypot(dx, dz)), fire: true, aim: true });
  let elim = null;
  for (let i = 0; i < 300 && !elim; i++) { sim.step(DT); for (const e of sim.takeEvents()) if (e.e === 'elim' && e.to === 'b') elim = e; }
  sim.input('a', { fire: false });
  ok(elim && elim.by === 'a' && A.kills === 1, 'A n\'élimine pas B');
  ok([...sim.S.items.values()].some((g) => g.it.t === 'arme' && g.it.w === 'pompe' && Math.hypot(g.x - Bp.x, g.z - Bp.z) < 3), 'B ne lâche pas son arme');
  // récolte : un arbre tombe à la pioche et donne du bois
  const ti = m.props.findIndex((p) => p.kind === 'arbre'), t = m.props[ti];
  Object.assign(A, { x: t.x - 1.6, z: t.z, y: W.support(t.x - 1.6, t.z, 400), vx: 0, vz: 0 });
  let yaw = 0, pitch = 0;
  for (let k = 0; k < 5; k++) { A.yaw = yaw = Math.atan2(t.x - sim.eye(A)[0], t.z - sim.eye(A)[2]); pitch = Math.atan2(A.y + 1 - sim.eye(A)[1], Math.hypot(t.x - sim.eye(A)[0], t.z - sim.eye(A)[2])); }
  sim.input('a', { sel: 0, yaw, pitch, fire: true });
  let felled = false;
  for (let i = 0; i < 60 * 8 && !felled; i++) { sim.step(DT); for (const e of sim.takeEvents()) if (e.e === 'casse' && e.key === 'p:' + ti) felled = true; }
  sim.input('a', { fire: false });
  ok(felled && A.mats.bois >= 30, `arbre : ${felled ? 'abattu' : 'debout'}, ${A.mats.bois} de bois`);
  // construction : escalier, mur et sol au niveau des pieds ; on monte l'escalier ; il s'effondre s'il ne tient plus
  Object.assign(A, { x: spot.x + 8, z: spot.z - 8, y: W.support(spot.x + 8, spot.z - 8, 400), vx: 0, vz: 0 });
  A.mats = { bois: 300, pierre: 100, metal: 100 };
  let shots = 10;
  const build = (k, yw, pt) => { sim.input('a', { build: k, mat: 'bois', yaw: yw, pitch: pt, shoot: ++shots }); for (let i = 0; i < 30; i++) sim.step(DT); sim.input('a', { build: null }); };
  build('escalier', 0, -0.2); build('mur', Math.PI / 2, -0.1);
  const kinds = [...B.pieces.values()].map((p) => p.kind).sort().join(',');
  ok(kinds === 'escalier,mur' && A.mats.bois === 280, `construction : ${kinds}, ${A.mats.bois} de bois`);
  const st = [...B.pieces.values()].find((p) => p.kind === 'escalier');
  Object.assign(A, { x: (st.x + 0.5) * CELL - st.dx * 3, z: (st.z + 0.5) * CELL - st.dz * 3, vx: 0, vz: 0 }); A.y = W.support(A.x, A.z, A.y + 2);
  sim.input('a', { mz: 1, yaw: Math.atan2(st.dx, st.dz) });
  let top = 0; for (let i = 0; i < 100; i++) { sim.step(DT); top = Math.max(top, A.y); }
  sim.input('a', { mz: 0 });
  ok(Math.abs(top - (st.y0 + 3.2)) < 0.3, `escalier : sommet à ${top.toFixed(2)} au lieu de ${(st.y0 + 3.2).toFixed(2)}`);
  // en haut de l'escalier, un sol qui ne tient que par lui : il tombe avec l'escalier (le mur, posé au sol, reste)
  Object.assign(A, { x: (st.x + 0.5 + st.dx * 0.45) * CELL, z: (st.z + 0.5 + st.dz * 0.45) * CELL, y: st.y0 + 3.2, vx: 0, vz: 0 });
  build('sol', Math.atan2(st.dx, st.dz), -0.2);
  const before = B.pieces.size;
  B.hit('b:' + st.id, 9999, null, [0, 0, 0], false);
  ok(before === 3 && B.pieces.size === 1, `effondrement : ${before} pièces avant, ${B.pieces.size} après`);
  // un mur de maison se casse à la pioche et donne son matériau
  const bld = m.buildings.find((b) => b.type === 'maison'), wall = bld.levels[0].walls.find((e) => e.ext && e.k === 'mur');
  const key = `w:${bld.id}:0:${wall.o}${wall.x},${wall.z}`, had = A.mats[bld.mat];
  for (let i = 0; i < 20 && !B.broken.has(key); i++) B.hit(key, 50, A, [0, 0, 0], true);
  ok(B.broken.has(key) && !(W.byKey.get(key) || []).length && A.mats[bld.mat] > had, 'un mur de maison ne se casse pas');
  // coût d'un pas avec 3 joueurs et le butin de l'île
  const t0 = performance.now(); for (let i = 0; i < 300; i++) sim.step(DT);
  console.log(`  partie : saut, coffre, élimination, récolte, construction et effondrement vérifiés · ${((performance.now() - t0) / 300).toFixed(3)} ms par pas`);
}
// ------------------------------------------------------------------ bots et réseau
// Une partie de bots (et d'un joueur invité) suivie par deux copies d'invités : l'une là dès le départ, l'autre
// arrivée en cours de route (état complet) ; les copies doivent rester identiques à la partie de l'hôte. Puis la
// première copie reprend la partie comme si l'hôte était parti.
{
  const m = generateMap(ILE), Wh = buildWorld(m);
  const roster = [{ id: 1, name: 'Hôte' }, { id: 2, name: 'Invité' }, ...Array.from({ length: 14 }, (_, i) => ({ id: 'bot' + i, name: 'Bot' + i, bot: true, level: 'difficile' }))];
  const host = createSim({ map: m, world: Wh, seed: 77, roster, mode: 'partie' });
  const hb = createBuild(host, m, Wh);
  createAI(host, m, Wh);
  const copy = () => { const W = buildWorld(m), sim = createSim({ map: m, world: W, seed: 77, roster, mode: 'partie' }); return { W, sim, b: createBuild(sim, m, W) }; };
  const wire = (x) => JSON.parse(JSON.stringify(x));
  const g1 = copy();
  let g2 = null, pend = [], kills = 0, built = false;
  const t0 = performance.now();
  for (let step = 0; step < 60 * 200 && host.S.phase !== 'fin'; step++) {
    host.input(2, { mz: 1, yaw: step * 0.003, jump: step > 700 ? 1 : 0, sprint: true });
    // un bot pose un mur une fois au sol
    const B0 = [...host.S.players.values()].find((p) => p.bot && p.alive && p.mode === 'sol' && p.ground);
    if (!built && B0 && step % 30 === 0) { B0.mats.bois = 60; built = !!hb.place(B0, 'mur', 'bois'); }
    // une voiture cassée avant l'arrivée du second invité, une dalle d'étage après : les copies doivent suivre
    if (step === 60 * 50) { const pi = m.props.findIndex((p) => p.kind === 'voiture'); if (pi >= 0) hb.hit('p:' + pi, 1e5, null, [m.props[pi].x, 1, m.props[pi].z], false); }
    if (step === 60 * 100) { const bb = m.buildings.find((b) => b.floors > 1 && !(b.levels[1].hole && b.levels[1].hole.x === b.x0 && b.levels[1].hole.z === b.z0)); hb.hit(`s:${bb.id}:1:${bb.x0},${bb.z0}`, 1e5, null, [bb.x0 * 4 + 2, floorY(bb, 1), bb.z0 * 4 + 2], false); }
    host.step(DT);
    for (const e of host.takeEvents()) { pend.push(e); if (e.e === 'elim') kills++; }
    if (step === 60 * 70) { g2 = copy(); applyFull(g2.sim, g2.W, g2.b, wire(fullState(host, Wh, hb))); }
    if (step % 3 === 0) {
      const msg = wire({ s: snapshot(host, step % 60 === 0 ? 'tous' : 'humains'), e: pend });
      pend = [];
      for (const g of [g1, g2]) if (g) { for (const e of msg.e) mirrorEvent(g.sim, g.W, g.b, e); applySnapshot(g.sim, msg.s, null); }
    }
  }
  const ms = (performance.now() - t0) / (host.S.t * 60);
  const same = (g, name) => {
    const a = [...host.S.items.keys()].sort().join(), b = [...g.sim.S.items.keys()].sort().join();
    ok(a === b, `${name} : même butin au sol (${host.S.items.size} / ${g.sim.S.items.size})`);
    const oc = (sim) => [...sim.S.chests.values()].filter((c) => c.open).map((c) => c.id).sort().join();
    ok(oc(host) === oc(g.sim), `${name} : mêmes coffres ouverts`);
    const od = (W) => [...W.doors.values()].filter((d) => d.open && !d.dead).map((d) => d.id).sort().join();
    ok(od(Wh) === od(g.W), `${name} : mêmes portes ouvertes`);
    ok([...hb.broken].sort().join() === [...g.b.broken].sort().join(), `${name} : mêmes objets détruits (${hb.broken.size})`);
    ok([...hb.pieces.keys()].join() === [...g.b.pieces.keys()].join(), `${name} : mêmes constructions`);
    for (const k of hb.broken) if ((g.W.byKey.get(k) || []).some((s2) => !s2.dead)) { ok(false, `${name} : ${k} encore solide`); break; }
    for (const P of host.S.players.values()) {
      const Q = g.sim.player(P.id);
      if (P.alive !== Q.alive || Math.abs(P.hp - Q.hp) > 1 || (P.alive && Math.hypot(P.x - Q.x, P.z - Q.z) > 0.3)) { ok(false, `${name} : joueur ${P.id} différent`); break; }
    }
  };
  same(g1, 'invité du départ'); same(g2, 'invité arrivé en route');
  ok(built && hb.pieces.size >= 1, 'une construction pendant la partie');
  ok(kills >= 2 && hb.broken.size >= 2, `des bots qui se battent (${kills} éliminations), du décor cassé (${hb.broken.size})`);
  // l'hôte s'en va : la copie reprend la partie et la mène à son terme
  const G = g1.sim;
  G.S.nextItem = Math.max(G.S.nextItem, ...[...G.S.items.keys()].map((k) => k + 1));
  G.S.projectiles = [];
  for (const P of G.S.players.values()) { P.ai = null; P.use = null; }
  createAI(G, m, g1.W);
  const before = G.alive().length;
  let crash = null;
  try { for (let i = 0; i < 60 * 240 && G.S.phase !== 'fin'; i++) { G.step(DT); G.takeEvents(); } } catch (e) { crash = e; }
  ok(!crash, 'la partie continue chez le nouvel hôte' + (crash ? ' : ' + crash.message : ''));
  ok(G.alive().length < before || G.S.phase === 'fin', 'les éliminations continuent après le relais');
  console.log(`  réseau : 2 copies identiques à l'hôte (${hb.broken.size} destructions, ${host.S.items.size} objets), relais d'hôte · ${kills} éliminations · ${ms.toFixed(3)} ms par pas avec 14 bots`);
}
// Prédiction : l'invité avance tout de suite, l'hôte confirme 100 ms plus tard ; les corrections restent petites
{
  const m = generateMap(ILE), Wh = buildWorld(m), Wg = buildWorld(m);
  const roster = [{ id: 1, name: 'Hôte' }, { id: 2, name: 'Invité' }];
  const host = createSim({ map: m, world: Wh, seed: 3, roster, mode: 'exploration' });
  const guest = createSim({ map: m, world: Wg, seed: 3, roster, mode: 'exploration' });
  const P = guest.player(2), wire = (x) => JSON.parse(JSON.stringify(x));
  const up = [], down = [];
  let seq = 0, hist = [], jumps = 0, predJump = 0, fix = 0, fixes = 0;
  for (let step = 0; step < 60 * 30; step++) {
    if (step % 240 === 120) jumps++;
    const h = { mx: step % 500 < 250 ? 0 : 0.6, mz: 1, yaw: Math.sin(step * 0.01) * 2, pitch: 0, sprint: step % 400 < 200, crouch: false, aim: false, fire: false, jump: jumps, use: 0, reload: 0, shoot: 0, drop: 0, sel: 0 };
    const edge = h.jump !== predJump; predJump = h.jump;
    seq++;
    predictStep(P, { ...h, jump: edge }, Wg, DT);
    hist.push({ q: seq, ...h, jump: edge });
    if (seq % 2 === 0) up.push({ at: step + 6, m: wire({ q: seq, ...h }) });
    while (up.length && up[0].at <= step) { const msg = up.shift().m; host.input(2, cleanInput(msg)); host.player(2).q = msg.q; }
    host.step(DT); host.takeEvents();
    if (step % 3 === 0) down.push({ at: step + 6, s: wire(snapshot(host)) });
    while (down.length && down[0].at <= step) {
      const s = down.shift().s, row = s.P.find((r) => r[0] === 2), was = { x: P.x, z: P.z };
      applySnapshot(guest, s, 2);
      Object.assign(P, { x: row[1], y: row[2], z: row[3], vx: row[6], vy: row[7], vz: row[8], mode: MODES[row[10]] });
      hist = hist.filter((q) => q.q > row[18]);
      for (const q of hist) predictStep(P, q, Wg, DT);
      const d = Math.hypot(was.x - P.x, was.z - P.z);
      fix = Math.max(fix, d); fixes += d;
    }
  }
  ok(fix < 1, `prédiction de l'invité : correction maximale ${fix.toFixed(2)} m`);
  console.log(`  prédiction : correction moyenne ${(fixes / 600 * 100).toFixed(1)} cm, au pire ${(fix * 100).toFixed(0)} cm (100 ms aller, 100 ms retour)`);
}
// ------------------------------------------------------------------ bots contre l'hôte, balle du sniper, chutes, dalles
{
  const m = generateMap(ILE), W = buildWorld(m);
  // l'hôte du salon a l'identifiant 0 : les bots doivent l'attaquer comme les autres
  const roster = [{ id: 0, name: 'Hôte', color: '#f00' }, ...Array.from({ length: 11 }, (_, i) => ({ id: 'bot' + i, name: 'Bot' + i, color: '#888', bot: true, level: 'normal' }))];
  const sim = createSim({ map: m, world: W, seed: 7, roster, mode: 'partie' });
  const B = createBuild(sim, m, W);
  createAI(sim, m, W);
  const host = sim.player(0);
  while (sim.S.t < 140) { sim.step(DT); sim.takeEvents(); }
  const armed = [...sim.S.players.values()].filter((P) => P.bot && P.alive && P.mode === 'sol' && P.inv.some((it) => it && it.t === 'arme' && it.mag > 0));
  let attacked = 0, tries = 0;
  for (const P of armed.slice(0, 4)) {
    const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
    const x = P.x + fx * 12, z = P.z + fz * 12, y = W.support(x, z, P.y + 1.5);
    if (Math.abs(y - P.y) > 1.5) continue;
    Object.assign(host, { x, y, z, vx: 0, vy: 0, vz: 0, mode: 'sol', hp: 100, sh: 0, alive: true });
    tries++;
    const t0 = sim.S.t;
    let hurt = false;
    while (sim.S.t < t0 + 8 && host.alive && !hurt) { sim.step(DT); for (const e of sim.takeEvents()) if (e.e === 'degat' && e.to === 0 && e.by != null) hurt = true; }
    if (hurt) attacked++;
  }
  ok(tries > 0 && attacked >= Math.ceil(tries / 2), `les bots n'attaquent pas l'hôte (identifiant 0) : ${attacked}/${tries}`);
  // balle du fusil de précision : elle vole, tombe et dérive à droite (Coriolis) ; tirée à 150 m d'altitude vers le nord
  const shooter = armed[0] || [...sim.S.players.values()].find((P) => P.bot && P.alive);
  sim.S.hooks.think = null;
  sim.S.projectiles.length = 0;
  const o = [400, 150, 400];
  const pr = { id: 9999, kind: 'balle', x: o[0], y: o[1], z: o[2], vx: 0, vy: 0, vz: 460, owner: shooter.id, it: { t: 'arme', w: 'sniper', r: 3, mag: 0 }, life: 2, from: [...o], dist: 0 };
  sim.S.projectiles.push(pr);
  if (pr) {
    let t = 0;
    while (sim.S.projectiles.includes(pr) && pr.z < o[2] + 300) { sim.step(DT); t += DT; }
    const drop = o[1] - pr.y, drift = o[0] - pr.x; // regard vers +z : la droite est vers −x
    ok(t > 0.5 && t < 0.9, `vol de 300 m en ${t.toFixed(2)} s`);
    ok(drop > 1.2 && drop < 3.5, `chute de la balle à 300 m : ${drop.toFixed(2)} m`);
    ok(drift > 0.1 && drift < 1.5, `dérive de Coriolis à 300 m : ${drift.toFixed(2)} m vers la droite`);
    console.log(`\nbots contre l'hôte : ${attacked}/${tries} · balle à 300 m : ${t.toFixed(2)} s, chute ${drop.toFixed(2)} m, dérive ${drift.toFixed(2)} m à droite`);
  }
  // une chute enlève de la vie, pas du bouclier
  Object.assign(host, { alive: true, hp: 100, sh: 50 });
  sim.damage(host, 20, null, { cause: 'chute' });
  ok(host.sh === 50 && host.hp === 80, `chute : bouclier ${host.sh}, vie ${host.hp}`);
  // une dalle d'étage se casse, et l'on passe au travers
  const bb = m.buildings.find((b) => b.floors > 1 && b.levels[1]);
  const cx = bb.x0 + (bb.levels[1].hole && bb.levels[1].hole.x === bb.x0 ? 1 : 0), cz = bb.z0;
  const key = `s:${bb.id}:1:${cx},${cz}`;
  ok(W.byKey.has(key), `dalle ${key} introuvable`);
  const px = (cx + 0.5) * 4, pz = (cz + 0.5) * 4, F1 = floorY(bb, 1);
  ok(Math.abs(W.support(px, pz, F1 + 0.3) - F1) < 0.05, 'on ne tient pas sur la dalle de l\'étage');
  for (let i = 0; i < 20 && !B.broken.has(key); i++) B.hit(key, 100, null, [px, F1, pz], false);
  ok(B.broken.has(key) && W.support(px, pz, F1 + 0.3) < F1 - 1, 'la dalle cassée tient encore');
}
// ------------------------------------------------------------------ un bot touché de loin pose un mur et se couvre
{
  const m = generateMap(ILE), W = buildWorld(m);
  const roster = [{ id: 0, name: 'Hôte', color: '#f00' }, { id: 'b', name: 'Bot', color: '#888', bot: true, level: 'difficile' }];
  const sim = createSim({ map: m, world: W, seed: 3, roster, mode: 'partie' });
  const B = createBuild(sim, m, W); createAI(sim, m, W);
  while (sim.S.phase === 'vol') { sim.step(DT); sim.takeEvents(); }
  const host = sim.player(0), bot = sim.player('b');
  // sur un terrain dégagé : le bot armé, avec du bois ; l'hôte à 15 m devant lui
  let spot = null;
  for (let i = 0; i < 400 && !spot; i++) {
    const x = 300 + (i % 20) * 30, z = 300 + Math.floor(i / 20) * 30, y = W.support(x, z, 200);
    if (y > 2 && Math.abs(W.support(x, z + 15, 200) - y) < 0.5 && !m.waterAt(x, z) && !m.waterAt(x, z + 15)) spot = { x, y, z };
  }
  Object.assign(bot, { x: spot.x, y: spot.y, z: spot.z, vx: 0, vy: 0, vz: 0, mode: 'sol', hp: 100, sh: 100, alive: true, ground: true });
  bot.inv[0] = weapon('fusil', 2); bot.ammo.moyennes = 200; bot.mats.bois = 60;
  Object.assign(host, { x: spot.x, y: W.support(spot.x, spot.z + 15, 200), z: spot.z + 15, vx: 0, vy: 0, vz: 0, mode: 'sol', hp: 100, sh: 100, alive: true });
  // l'hôte le touche toutes les demi-secondes (et reste en vie) : en 4 s, le bot doit s'être couvert
  let walls = 0;
  for (let k = 0; k < 4 / DT && !walls; k++) {
    if (k % Math.round(0.5 / DT) === 0) sim.damage(bot, 5, host, { cause: 'fusil' });
    Object.assign(host, { hp: 100, sh: 100 });
    sim.step(DT);
    for (const e of sim.takeEvents()) if (e.e === 'construit' && e.piece.owner === 'b' && e.piece.kind === 'mur') walls++;
  }
  ok(walls >= 1 && bot.mats.bois === 50 && B.pieces.size >= 1, `un bot touché de loin ne pose pas de mur (${walls} mur, bois ${bot.mats.bois})`);
  console.log(`bot touché de loin : ${walls} mur posé, bois ${bot.mats.bois}`);
}
// ------------------------------------------------------------------ équipes : qui joue avec qui
{
  const H = ['a', 'b', 'c', 'd'].map((id) => ({ id }));
  // a et c choisissent l'équipe 3, b l'équipe 0 ; d n'a rien choisi : il rejoint l'équipe la moins remplie
  const t = makeTeams(H, new Map([['a', 3], ['c', 3], ['b', 0]]), 12, 3);
  ok(t.humans.get('a') === t.humans.get('c') && t.humans.get('b') !== t.humans.get('a'), 'équipes choisies respectées');
  ok(t.humans.get('d') === t.humans.get('b'), `d rejoint l'équipe la moins remplie (${t.humans.get('d')})`);
  ok(t.bots.length === 8 && t.bots.filter((k) => k === t.humans.get('a')).length === 1 && t.bots.filter((k) => k === t.humans.get('b')).length === 1, 'les bots complètent d\'abord les équipes des joueurs');
  const sizes = new Map(); for (const k of [...t.humans.values(), ...t.bots]) sizes.set(k, (sizes.get(k) || 0) + 1);
  ok([...sizes.values()].every((n) => n === 3), `trios complets : ${[...sizes.values()].join(',')}`);
  const solo = makeTeams(H, new Map(), 6, 1);
  ok(new Set([...solo.humans.values(), ...solo.bots]).size === 6, 'en solo, chacun son équipe');
}
// ------------------------------------------------------------------ équipes : tir ami, à terre, relevé, élimination d'équipe
{
  const m = generateMap(ILE), W = buildWorld(m);
  const roster = [['a', 0], ['b', 0], ['c', 1], ['d', 1]].map(([id, team]) => ({ id, name: id.toUpperCase(), team }));
  const sim = createSim({ map: m, world: W, seed: 4, roster, mode: 'partie', teams: 2 });
  while (sim.S.phase === 'vol') { for (const id of ['a', 'b', 'c', 'd']) sim.input(id, { jump: (sim.S.t * 60) | 0 }); sim.step(DT); }
  const P = (id) => sim.player(id), C = { x: m.center, z: m.center };
  const put = (id, dx, dz) => { const x = C.x + dx, z = C.z + dz; Object.assign(P(id), { x, z, y: W.support(x, z, 400), vx: 0, vy: 0, vz: 0, mode: 'sol', hp: 100, sh: 0, ground: true }); };
  put('a', 0, 0); put('b', 1.5, 0); put('c', 40, 0); put('d', 45, 0);
  const evs = () => sim.takeEvents();
  sim.damage(P('b'), 50, P('a'), { cause: 'fusil' });
  ok(P('b').hp === 100, 'pas de tir ami');
  sim.damage(P('a'), 250, P('c'), { cause: 'fusil' });
  ok(P('a').alive && P('a').down && evs().some((e) => e.e === 'abattu' && e.to === 'a' && e.by === 'c'), 'A tombe à terre au lieu d\'être éliminé');
  // B relève A : E à côté, immobile, 5 s
  sim.input('b', { yaw: Math.atan2(P('a').x - P('b').x, P('a').z - P('b').z), use: 1, mx: 0, mz: 0 });
  sim.step(DT);
  ok(P('b').revive && P('b').revive.id === 'a', 'B commence à relever A');
  // pendant ce temps, l'état passe par le réseau
  const copy = createSim({ map: m, world: W, seed: 4, roster, mode: 'partie', teams: 2 });
  applySnapshot(copy, snapshot(sim), 'c');
  ok(copy.player('a').down && copy.player('b').revive && copy.player('b').revive.id === 'a', 'à terre et relevé passent par le réseau');
  for (let i = 0; i < 5.1 / DT; i++) sim.step(DT);
  ok(!P('a').down && P('a').hp === 30 && evs().some((e) => e.e === 'releve' && e.to === 'a' && e.by === 'b'), `A relevé avec 30 PV (${P('a').hp})`);
  // à terre trop longtemps : éliminé, mis au crédit de celui qui l'a mis à terre ; l'équipe tient encore
  sim.damage(P('a'), 250, P('c'), { cause: 'fusil' });
  for (let i = 0; i < 31 / DT && P('a').alive; i++) sim.step(DT);
  ok(!P('a').alive && P('c').kills === 1 && P('a').place === 0, `A éliminé au bout de 30 s, élimination pour C (${P('c').kills}), place en attente`);
  // dernier debout éliminé : toute l'équipe sort, l'autre gagne
  sim.damage(P('b'), 250, P('d'), { cause: 'fusil' });
  ok(!P('b').alive && P('a').place === 2 && P('b').place === 2, `équipe de A et B éliminée, 2e (${P('a').place}, ${P('b').place})`);
  ok(sim.S.phase === 'fin' && sim.S.winTeam === 1 && P('c').place === 1 && P('d').place === 1, 'l\'équipe de C et D gagne');
  // trio : deux à terre, le troisième éliminé : les deux à terre sortent aussi
  const r3 = [['x', 0], ['y', 0], ['z', 0], ['e', 1]].map(([id, team]) => ({ id, name: id, team }));
  const s3 = createSim({ map: m, world: W, seed: 6, roster: r3, mode: 'partie', teams: 3 });
  for (const id of ['x', 'y', 'z', 'e']) Object.assign(s3.player(id), { mode: 'sol', x: C.x, z: C.z, y: W.support(C.x, C.z, 400) });
  s3.damage(s3.player('x'), 250, s3.player('e')); s3.damage(s3.player('y'), 250, s3.player('e'));
  ok(s3.player('x').down && s3.player('y').down, 'deux membres du trio à terre');
  s3.damage(s3.player('z'), 250, s3.player('e'));
  ok(!s3.player('x').alive && !s3.player('y').alive && !s3.player('z').alive && s3.player('e').kills === 3 && s3.S.phase === 'fin', 'tous à terre ou éliminés : l\'équipe sort');
}
// ------------------------------------------------------------------ équipes : une partie en trios entre bots
{
  const m = generateMap(ILE), W = buildWorld(m);
  const T = makeTeams([], new Map(), 30, 3);
  const roster = T.bots.map((team, i) => ({ id: 'bot' + i, name: 'Bot' + i, color: '#888', bot: true, level: 'normal', team }));
  const sim = createSim({ map: m, world: W, seed: 8, roster, mode: 'partie', teams: 3 });
  createBuild(sim, m, W); createAI(sim, m, W);
  let revives = 0, downs = 0, friendly = 0, apart = 0, checks = 0;
  while (sim.S.phase !== 'fin' && sim.S.t < 700) {
    sim.step(DT);
    for (const e of sim.takeEvents()) {
      if (e.e === 'releve') revives++;
      else if (e.e === 'abattu') downs++;
      else if (e.e === 'degat' && e.by != null && sim.mates(sim.player(e.by), sim.player(e.to))) friendly++;
    }
    // une minute après le départ : les membres d'une équipe restent proches
    if (Math.abs(sim.S.t - 90) < DT / 2) for (let k = 0; k < 10; k++) {
      const live = [...sim.S.players.values()].filter((p) => p.alive && p.team === k && p.mode === 'sol');
      if (live.length < 2) continue;
      checks++;
      if (Math.max(...live.map((p) => Math.hypot(p.x - live[0].x, p.z - live[0].z))) > 80) apart++;
    }
  }
  ok(sim.S.phase === 'fin' && sim.S.winTeam != null, 'la partie en trios va jusqu\'au bout');
  ok(friendly === 0, `${friendly} tirs amis`);
  ok(downs > 0 && revives > 0, `bots à terre ${downs}, relevés ${revives}`);
  ok(apart <= Math.ceil(checks / 3), `équipes dispersées à 1:30 : ${apart}/${checks}`);
  console.log(`trios entre bots : fin à ${Math.floor(sim.S.t / 60)}:${String(Math.floor(sim.S.t % 60)).padStart(2, '0')}, équipe ${sim.S.winTeam} · ${downs} à terre, ${revives} relevés · équipes groupées ${checks - apart}/${checks}`);
}
// ------------------------------------------------------------------ rythme : l'île ne se vide pas en deux minutes
// 60 places dont un joueur qui saute tôt (5 bots au plus le suivent) : la partie doit tenir jusqu'aux derniers cercles
{
  const m = generateMap(ILE), W = buildWorld(m);
  const roster = [{ id: 0, name: 'Hôte', color: '#f00' }, ...Array.from({ length: 59 }, (_, i) => ({ id: 'bot' + i, name: 'Bot' + i, color: '#888', bot: true, level: 'normal' }))];
  const sim = createSim({ map: m, world: W, seed: 2, roster, mode: 'partie' });
  createBuild(sim, m, W); createAI(sim, m, W);
  const at = {}, follow = [...sim.S.players.values()].filter((P) => P.bot);
  let jumped = false;
  while (sim.S.t < 180) {
    if (!jumped && sim.S.flight.t > 15) { sim.input(0, { jump: 1 }); jumped = true; }
    sim.step(DT); sim.takeEvents();
    for (const s of [60, 120, 180]) if (at[s] == null && sim.S.t >= s) at[s] = sim.alive().length;
  }
  const followers = follow.filter((P) => P.ai && P.ai.follow != null).length;
  ok(followers <= 5, `${followers} bots suivent le joueur (5 au plus)`);
  ok(at[60] >= 48 && at[120] >= 32 && at[180] >= 20, `rythme : ${at[60]} en vie à 1 min, ${at[120]} à 2 min, ${at[180]} à 3 min (au moins 48, 32, 20)`);
  console.log(`rythme (60 places) : ${at[60]} en vie à 1 min, ${at[120]} à 2 min, ${at[180]} à 3 min · ${followers} bots suivent le joueur`);
}
console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
