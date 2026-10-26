// Tests d'Island Rush (battle royale) : node tools/test-royale.mjs [nombre de graines]
// Île : sur plusieurs graines, même graine → même île, part de nature, ville, bourg et villages présents (18 bâtiments
// au plus dans la ville et le bourg), bâtiments sur la terre ferme et sans chevauchement, une porte au rez-de-chaussée,
// un escalier dès qu'il y a un étage, toutes les pièces accessibles, des routes qui relient tous les lieux, assez de
// coffres, la tempête et le temps de génération.
// Déplacement, sur l'île officielle : une porte fermée arrête, ouverte on entre dans chaque bâtiment, on monte chaque
// escalier jusqu'à l'étage (ou au toit) sans qu'un meuble gêne, un mur plein arrête, on nage dans le lac ; et le coût
// d'un pas pour 30 joueurs. Meubles : aucun ne déborde de sa pièce ni n'en chevauche un autre.
import { generateMap, planStorm, planFlight, CELL, MAX_TOWN_BUILDINGS, ILE } from '../royale/engine/map.js';
import { buildWorld, floorY } from '../royale/engine/world.js';
import { FURN, furnRect } from '../royale/engine/furniture.js';
import { newPlayer, stepPlayer } from '../royale/engine/player.js';

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
  // 30 joueurs qui courent et sautent : coût d'un pas
  const pl = Array.from({ length: 30 }, (_, i) => newPlayer(m.center - 300 + i * 20, 40, m.center));
  t = performance.now();
  for (let f = 0; f < 600; f++) for (const p of pl) stepPlayer(p, { mz: 1, mx: 0.3, yaw: f * 0.01, jump: f % 90 === 0 }, W, 1 / 60);
  const step = (performance.now() - t) / 600;
  console.log(`  ${doors}/${m.buildings.length} entrées, ${stairs} escaliers montés · 30 joueurs : ${step.toFixed(3)} ms par pas`);
  ok(step < 2, `pas de simulation trop cher (${step.toFixed(2)} ms)`);
}
console.log(fails ? `\n${fails} échec(s)` : '\nTout est bon.');
process.exit(fails ? 1 : 0);
