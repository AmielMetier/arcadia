// Biomes et level design des routes d'Odyssée (world/biomes.js, world/decors-routes.js) : node tools/test-odyssee-biomes.mjs
import assert from 'node:assert/strict';
import { buildWorld } from '../odyssee/js/world/region.js';
import { T, walkable } from '../odyssee/js/world/tiles.js';
import { BIOMES, B, BIOME_ROUTE, biomeEn, estLave, degrade } from '../odyssee/js/world/biomes.js';
import { BIOMES_SPRITES } from '../odyssee/js/data/biomes-sprites.js';
import { SPRITES } from '../odyssee/js/data/sprites.js';
import { DECOR_PLUS } from '../odyssee/js/data/decor-plus.js';
import { etiquettes } from '../odyssee/js/world/traces.js';
import { rangs } from '../odyssee/js/world/acces.js';
import { LUT, LUTB, K, zoneBloc, rendreBloc, biomesPixels, sorteCase } from '../odyssee/js/render/solgen.js';

/* 1. les fiches */
const connu = (k) => k === 'automne' || BIOMES_SPRITES[k] || SPRITES.nature?.[k] || SPRITES.deco?.[k] || SPRITES.mobilier?.[k] || DECOR_PLUS[k];
assert(BIOMES.length - 1 <= 31, 'un numéro de biome tient sur 5 bits');
for (const b of BIOMES.slice(1)) {
  for (const L of [b.arbres, b.pins].filter(Boolean)) for (const [k] of L) assert(connu(k), `${b.id} : essence inconnue ${k}`);
  for (const cle of ['herbe', 'haute', 'chemin', 'eau', 'berge', 'cendre', 'sable', 'rocher', 'mousse', 'feuilles', 'pave']) if (b[cle]) { assert.equal(b[cle].length, 3, `${b.id}.${cle}`); for (const h of b[cle]) assert.match(h, /^#[0-9a-f]{6}$/, `${b.id}.${cle}`); }
  assert(b.air && b.lum?.length === 3, b.id);
}
assert.deepEqual(degrade(['#000000', '#ffffff'], 3), ['#000000', '#808080', '#ffffff']);
assert(LUTB[0].every((v, i) => v === LUT[i]), 'le sol ordinaire garde ses teintes');
{ const vus = new Map(); for (const b of BIOMES.slice(1)) if (b.herbe) { const k = b.herbe.join(); assert(!vus.has(k), `${b.id} et ${vus.get(k)} ont la même herbe`); vus.set(k, b.id); } }

/* 2. la carte, avec et sans le level design */
const A = buildWorld({ decors: false }), Z = buildWorld(), W0 = A.maps.monde, W = Z.maps.monde;
for (const r of Z.routes) assert(r.id === 'torii' || B[BIOME_ROUTE[r.id]], `${r.id} a son biome`);
// rien de ce que les sauvegardes connaissent n'a bougé
const pos = (L) => JSON.stringify(L.map((o) => [o.id, o.x, o.y]));
// (le level design en ajoute, avec de nouveaux identifiants : il n'en déplace aucun)
for (const [L, L0, nom] of [[W.npcs, W0.npcs, 'habitants et dresseurs'], [W.items, W0.items, 'objets']]) { assert.equal(pos(L.slice(0, L0.length)), pos(L0), nom); const ids = L.map((o) => o.id).filter(Boolean); assert.equal(new Set(L.slice(L0.length).map((o) => o.id)).size, L.length - L0.length, nom); for (const o of L.slice(L0.length)) assert.equal(ids.indexOf(o.id), ids.lastIndexOf(o.id), o.id); }
assert.deepEqual([...W.warps.keys()], [...W0.warps.keys()]); assert.deepEqual([...W.signs.keys()], [...W0.signs.keys()]);
for (const k of W0.objects.keys()) assert(W.objects.has(k), 'objet du décor disparu ' + k);
// tout ce qu'on atteignait s'atteint encore, et rien de nouveau ne s'ouvre, à pied comme en surfant
const inonde = (M, nage) => {
  const vu = new Uint8Array(M.w * M.h), s = [Z.towns.A.x + 5, Z.towns.A.y + 7], q = [s]; vu[s[1] * M.w + s[0]] = 1;
  const ok = (t) => walkable(t) || t === T.CUT || t === T.SMASH || t === T.BOULDER || (nage && t === T.WATER);
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const u = x + dx, v = y + dy; if (!M.in(u, v) || vu[v * M.w + u]) continue;
      const t = M.get(u, v), dh = Math.abs(M.height(u, v) - M.height(x, y));
      if (!ok(t) || (dh && !(dh <= 1 && (t === T.STAIRS || M.get(x, y) === T.STAIRS)))) continue;
      vu[v * M.w + u] = 1; q.push([u, v]);
    }
  }
  return vu;
};
for (const nage of [false, true]) {
  const a = inonde(W0, nage), z = inonde(W, nage); let perdu = 0, gagne = 0, ex = null;
  for (let i = 0; i < a.length; i++) {
    if (a[i] && !z[i] && walkable(W.t[i])) { perdu++; ex ||= [i % W.w, Math.floor(i / W.w)]; }
    if (z[i] && !a[i] && walkable(W.t[i]) && walkable(W0.t[i])) { gagne++; ex ||= [i % W.w, Math.floor(i / W.w)]; }
  }
  assert.equal(perdu + gagne, 0, `${nage ? 'en surfant' : 'à pied'} : ${perdu} cases perdues, ${gagne} gagnées (${ex})`);
}
// un sentier neuf ne contourne aucun garde, aucun obstacle : les groupes de cases reliées à pied sont les mêmes, et chaque
// case garde le rang (badges et capacités) qu'il fallait pour l'atteindre
{ const a = etiquettes(W0), z = etiquettes(W), m = new Map(), r = new Map(); let coupe = 0, reuni = 0;
  for (let i = 0; i < a.length; i++) { if (!a[i] || !z[i]) continue; const p = m.get(a[i]); if (p === undefined) m.set(a[i], z[i]); else if (p !== z[i]) coupe++; const q = r.get(z[i]); if (q === undefined) r.set(z[i], a[i]); else if (q !== a[i]) reuni++; }
  assert.deepEqual([coupe, reuni], [0, 0], 'passages coupés, réunis');
  const dep = { map: 'monde', x: Z.towns.A.x + 5, y: Z.towns.A.y + 7 }, ra = rangs(A.maps, A.docks, dep).get('monde'), rz = rangs(Z.maps, Z.docks, dep).get('monde'); let pire = 0, ex = null; const la = new Set(W.npcs.map((n) => n.y * W.w + n.x));
  for (let i = 0; i < ra.length; i++) if (walkable(W0.t[i]) && walkable(W.t[i]) && !la.has(i) && ra[i] !== rz[i]) { pire++; ex ||= [i % W.w, Math.floor(i / W.w), ra[i], rz[i]]; }
  assert.equal(pire, 0, `${pire} cases n'ont plus le même rang (${ex})`);
  // ce qu'on a ajouté s'atteint (un dresseur, un habitant, un objet : depuis une case voisine)
  for (const o of [...W.npcs.slice(W0.npcs.length), ...W.items.slice(W0.items.length)]) assert([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => rz[(o.y + dy) * W.w + o.x + dx] < 255), `${o.id} hors d'atteinte`);
}
// autour des dresseurs, des habitants et des légendaires, les cases praticables le restent
const abords = (o, nom) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (walkable(W0.get(o.x + dx, o.y + dy))) assert(walkable(W.get(o.x + dx, o.y + dy)), `${nom} : un abord bloqué`); };
for (const n of W.npcs) abords(n, n.id);
for (const l of Z.legends) if ((l.map || 'monde') === 'monde') abords(l, l.id);
// même graine, même carte
{ const Y = buildWorld().maps.monde; assert(Y.t.every((t, i) => t === W.t[i]) && Y.deco.length === W.deco.length, 'la carte est toujours la même'); }

/* 3. le level design : chaque route a ses lieux, chaque décor existe */
let lieux = 0;
for (const d of Object.values(W.decorsRoutes)) lieux += d.lieux.length;
assert(lieux > 250, `${lieux} aménagements`);
for (const id of ['r1', 'r2', 'r3', 'r3e', 'r4', 'r5', 'r6', 'r7', 'r9b', 'r10', 'r12', 'r13', 'r14', 'r15', 'r16', 'r17', 'r18', 'r19', 'r20']) assert(W.decorsRoutes[id].lieux.length >= 2, id);
const ajoutes = W.deco.slice(W0.deco.length); assert(ajoutes.length > 2000, `${ajoutes.length} décors`);
for (const d of ajoutes) assert(connu(d.k), `décor sans dessin : ${d.k}`);
assert(W.decorsRoutes.r14.lieux.filter((l) => l[0] === 'riziere').length >= 8); assert(W.decorsRoutes.r15.lieux.some((l) => l[0] === 'passerelle'));

/* 3 bis. la trame : des routes qui ne sont plus un ruban (fourches, boucles, clairières), et habitées */
{ let boucles = 0, voies = 0; for (const [id, R] of Object.entries(W.traces)) { boucles += (R.faits.boucle || 0) + (R.faits.clairiere || 0); voies += R.autres.length; if (['r1', 'r2', 'r4', 'r5', 'r10', 'r14', 'r16', 'r17', 'r18', 'r19', 'r20'].includes(id)) assert(R.salles.length >= 4 && R.autres.length >= 4, `${id} : ${R.salles.length} clairières, ${R.autres.length} embranchements`); }
  assert(boucles >= 60 && voies >= 150, `${boucles} boucles et clairières, ${voies} embranchements`);
  assert(W.npcs.length - W0.npcs.length > 150 && W.items.length - W0.items.length > 80, `${W.npcs.length - W0.npcs.length} habitants, ${W.items.length - W0.items.length} objets de plus`);
  // personne pour rien : pas de Pokémon de décor sur les routes, et chaque habitant ajouté soigne, donne ou combat
  const ajout = W.npcs.slice(W0.npcs.length).filter((n) => /^[a-z0-9]+:[a-z]+\d+$/.test(n.id || ''));
  assert(!ajout.some((n) => /:b\d+$/.test(n.id)), 'plus de Pokémon de décor sur les routes');
  for (const n of ajout) assert(n.trainer || typeof n.talk === 'function', `habitant sans rôle : ${n.id} (${n.name})`);
  lieux += 0; console.log(`  trame : ${boucles} boucles et clairières, ${voies} embranchements, ${W.npcs.length - W0.npcs.length} habitants et Pokémon, ${W.items.length - W0.items.length} objets`); }

/* 4. les teintes : ville, lave, pavés */
assert.equal(biomeEn(W, Z.towns.A.x + 5, Z.towns.A.y + 7), 0, 'Bourg-Aube garde son herbe');
{ let lave = 0; for (let i = 0; i < W.t.length; i++) if (W.t[i] === T.WATER && estLave(W, i % W.w, Math.floor(i / W.w))) lave++; assert(lave > 10 && lave < 400, `${lave} cases de lave (jamais la mer)`); }
{ const L = W.traces.r18.trace, p = L[L.length >> 1]; assert.equal(sorteCase(W, Math.round(p[0]), Math.round(p[1])), K.V, 'la Roseraie est pavée'); }

/* 5. un bloc du sol généré, avec ses biomes */
{ const r = Z.routes.find((q) => q.id === 'r1'), p = r.pts[2], z = zoneBloc(W, Math.floor(p[0] / 16), Math.floor(p[1] / 16)); assert(z.bio, 'biomes du bloc');
  const f = rendreBloc({ ...z, seed: 7 }), b = biomesPixels({ ...z, seed: 7 }); assert(f.length && (typeof b === 'number' || b.length === f[0].length)); }
console.log(`Odyssée : biomes des routes OK (${BIOMES.length - 1} biomes, ${lieux} aménagements, ${ajoutes.length} décors)`);
