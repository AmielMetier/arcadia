// tools/odyssee-especes.mjs — Odyssée : quelles espèces peut-on obtenir ? (rencontres de chaque case, pêche, légendaires,
// partenaires de départ, dons, échanges, fossiles, puis toutes leurs évolutions). Affiche celles qu'on n'obtient nulle part.
//   node tools/odyssee-especes.mjs
const B = new URL('../odyssee/js/', import.meta.url).href;
const { SPECIES } = await import(B+'data/species.js');
const region = await import(B+'world/region.js'); const { encAt } = await import(B+'world/rencontres.js');
const { REMPLACANTS } = await import(B+'data/remplacants.js');
const fs = await import('node:fs');
const w = region.buildWorld();
const got = new Set(), src = new Map(); const add = (s, why) => { s = +s; if (!SPECIES[s]) return; if (!got.has(s)) src.set(s, why); got.add(s); };
for (const m of Object.values(w.maps)) {
  const seen = new Set();
  for (let y = 0; y < m.h; y += 2) for (let x = 0; x < m.w; x += 2) { const t = encAt(m, x, y); if (t && !seen.has(t)) { seen.add(t); for (const e of t) { add(e[0], 'sauvage'); if (REMPLACANTS[e[0]]) add(REMPLACANTS[e[0]], 'sauvage'); } } }
  for (const z of m.zones || []) for (const k of ['surfEnc', 'fishEnc', 'rockEnc', 'enc']) for (const e of z[k] || []) add(e[0], 'sauvage');
  for (const k of ['surfEnc', 'fishEnc', 'encounter']) for (const e of m[k] || []) add(e[0], 'sauvage');
}
for (const s of [129, 1029, 118, 1031, 60, 98, 211, 690, 692, 688, 501]) add(s, 'pêche');
for (const l of w.legends || []) add(l.sp ?? l[0], 'légendaire');
for (const c of region.STARTER_TABLE) for (const L of c.lines) add(L[0], 'starter');
// dons, échanges, fossiles : nombres cités dans giveMon / give / sp / E.give / FOSSILES
const code = ['world/story.js', 'world/quetes.js', 'world/mine.js', 'vie-monde.js', 'story.js', 'game.js', 'ui/domaine.js'].map((f) => { try { return fs.readFileSync(new URL(f, B), 'utf8'); } catch { return ''; } }).join('\n');
for (const m of code.matchAll(/giveMon\((\d+)|give: (\d+)|\bsp: (\d+)|give: \[(\d+)/g)) add(m[1] || m[2] || m[3] || m[4], 'don');
const { FOSSILES } = await import(B + 'world/faune.js').catch(() => ({})); for (const v of Object.values(FOSSILES || {})) add(v[0], 'fossile');
// évolutions
let ch = true; while (ch) { ch = false; for (const s of [...got]) for (const e of SPECIES[s]?.ev || []) if (!got.has(e.to)) { add(e.to, 'évolution'); ch = true; } }
const all = Object.keys(SPECIES).map(Number).filter((s) => s < 10000 && !(s > 721 && s < 1001));
const miss = all.filter((s) => !got.has(s));
console.log('espèces', all.length, 'obtenables', all.length - miss.length, 'manquantes', miss.length);
// les classer : bébés (une évolution part d'eux mais personne ne mène à eux), légendaires, autres
const { LEGENDAIRES } = await import(B + 'data/rencontres.js'); const LEG = new Set(LEGENDAIRES);
const pre = new Set(); for (const S of Object.values(SPECIES)) for (const e of S.ev || []) pre.add(e.to);
const cat = { légendaire: [], base: [], évolué: [] };
for (const s of miss) cat[LEG.has(s) ? 'légendaire' : pre.has(s) ? 'évolué' : 'base'].push(s);
for (const [k, L] of Object.entries(cat)) console.log(`\n${k} (${L.length}) :`, L.map((s) => s + ' ' + SPECIES[s].n).join(', '));

