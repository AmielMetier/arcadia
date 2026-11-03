// odyssee/js/world/rencontres.js — rencontres sauvages complètes : la table faite main de chaque zone (créatures
// originales et Pokémon choisis) est complétée par tous les Pokémon des lieux équivalents des jeux officiels, de Rouge
// à X / Y (data/rencontres.js, généré par tools/odyssee-rencontres.mjs). Les niveaux restent ceux de la zone.
import { RENCONTRES, AVANT } from '../data/rencontres.js';

/** part des rencontres laissée aux Pokémon des jeux officiels (le reste : la table faite main de la zone) */
const PART_OFFICIELS = 0.6;

/** forme jouable à ce niveau : un Pokémon trop évolué redescend vers sa forme d'avant */
export function formeAuNiveau(sp, lvl) {
  for (let k = 0; k < 3; k++) {
    const p = AVANT[sp]; if (!p) break;
    const [from, evoLvl] = p;
    if (evoLvl ? lvl + 2 < evoLvl : lvl < 30) sp = from; else break;
  }
  return sp;
}

/** table de rencontres d'une zone : [espèce, niveau min, niveau max, poids] */
export function enrichir(base, zone) {
  const gen = RENCONTRES[zone];
  if (!gen || !gen.length) return base;
  const lo = base?.length ? Math.min(...base.map((e) => e[1])) : 5, hi = base?.length ? Math.max(...base.map((e) => e[2])) : lo + 3;
  const totBase = (base || []).reduce((a, e) => a + e[3], 0) || 1, totGen = gen.reduce((a, e) => a + e[1], 0) || 1;
  const kBase = (1 - PART_OFFICIELS) * 100 / totBase, kGen = PART_OFFICIELS * 100 / totGen;
  const out = new Map();
  for (const [sp, a, b, w] of base || []) out.set(sp, [sp, a, b, w * kBase]);
  for (const [sp0, w] of gen) {
    const sp = formeAuNiveau(sp0, hi);
    const e = out.get(sp);
    if (e) e[3] += w * kGen;
    else out.set(sp, [sp, lo, hi, w * kGen]);
  }
  // une rencontre très rare garde une petite chance (au moins 0,1 %)
  return [...out.values()].map((e) => [e[0], e[1], e[2], Math.max(0.1, Math.round(e[3] * 100) / 100)]);
}

/** applique enrichir à toute une table de zones */
export function enrichirTout(ENC) {
  for (const k of Object.keys(ENC)) ENC[k] = enrichir(ENC[k], k);
  return ENC;
}

/* ---------------- équipes à thème (arènes) ---------------- */
import { SPECIES } from '../data/species.js';
import { LEGENDAIRES } from '../data/rencontres.js';
const LEG = new Set(LEGENDAIRES);
const POOLS = {};
/** Pokémon d'un type (Gen 1 à 6 et créatures originales), sans légendaires ni formes trop évoluées pour le niveau */
export function poolDeType(type, lvl) {
  const key = type + ':' + lvl;
  if (POOLS[key]) return POOLS[key];
  const s = new Set();
  for (const [id, S] of Object.entries(SPECIES)) {
    const n = +id; if (LEG.has(n) || (n > 721 && n < 1001) || n > 1051 || !S.t.includes(type)) continue;
    const f = formeAuNiveau(n, lvl);
    if (SPECIES[f]?.t.includes(type)) s.add(f);
  }
  return (POOLS[key] = [...s].sort((a, b) => a - b));
}
/** équipe tirée d'un type, toujours la même pour une graine donnée */
export function equipeDeType(type, lvl, n, seed) {
  const pool = poolDeType(type, lvl); let x = seed * 9301 + 49297;
  const r = () => { x = (x * 9301 + 49297) % 233280; return x / 233280; };
  const team = [];
  for (let i = 0; i < n && pool.length; i++) {
    let sp; for (let k = 0; k < 8; k++) { sp = pool[Math.floor(r() * pool.length)]; if (!team.some((t) => t[0] === sp)) break; }
    team.push([sp, lvl - (n - 1 - i)]);
  }
  return team;
}
