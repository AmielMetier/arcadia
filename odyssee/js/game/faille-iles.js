// odyssee/js/game/faille-iles.js — les îles flottantes des failles : plans en texte, carte jouable, solveur (sans DOM)
//   .  roche        S  arrivée        X  passage de sortie (au sud de l'arrivée)      E  le Pokémon qui garde la salle
//   A B  portails vers la salle suivante (ouverts quand la salle est gagnée)          c  éclat à ramasser (butin)
//   a b  ponts de lumière : un seul jeu à la fois est solide ; i : cristal qui les échange (faille Inversée)
//   ^ v < >  courants qui emportent (faille Chaotique)                                r  rocher
import { T, walkable, DIRS } from '../world/tiles.js';
import { GameMap } from '../world/mapgen.js';

export const PLANS = {
  inverse: [
    [
      '    .A.       .B.    ',
      '    ...       ...    ',
      '     b         b     ',
      '     b         b     ',
      '   ...............   ',
      '   ..i....E....i..   ',
      '   ...............   ',
      '     a         b     ',
      '     a         b     ',
      '    ...       ...    ',
      '    .c.       .c.    ',
      '    ...       ...    ',
      '     a         a     ',
      '     a         a     ',
      '   ...............   ',
      '   .......S.......   ',
      '          X          ',
    ],
    [
      '   .A.     .B.   ',
      '   ...     ...   ',
      '    a       b    ',
      '   ...........   ',
      '   ...i...E...   ',
      '   ...........   ',
      '    b       a    ',
      '    b       a    ',
      '   ...     ...   ',
      '   .c.     ...   ',
      '   ...     .i.   ',
      '    a       a    ',
      '    a       a    ',
      '   ...........   ',
      '   .....S.....   ',
      '        X        ',
    ],
  ],
  chaos: [
    [
      '    .A.       .B.    ',
      '    ...       ...    ',
      '    ^ v       ^ v    ',
      '    ^ v       ^ v    ',
      '   ...............   ',
      '   .......E.......   ',
      '   ...............   ',
      '    ^ v   v   ^ v    ',
      '    ^ v   v   ^ v    ',
      '    ...   v   ...    ',
      '    .c.   v   .c.    ',
      '    ...   v   ...    ',
      '    ^ v   v   ^ v    ',
      '    ^ v   v   ^ v    ',
      '   ...............   ',
      '   .......S.......   ',
      '          X          ',
    ],
    [
      '      .A.   .B.      ',
      '      ...   ...      ',
      '      ^ v   ^ v      ',
      '      ^ v   ^ v      ',
      '   ...............   ',
      '   .c.....E.....c.   ',
      '   ...............   ',
      '       v ^ ^ v       ',
      '       v ^ ^ v       ',
      '      .........      ',
      '      ....S....      ',
      '          X          ',
    ],
  ],
  alpha: [
    [
      '    .A.       .B.    ',
      '    ...       ...    ',
      '     .         .     ',
      '   ...............   ',
      '   .r...........r.   ',
      '   .......E.......   ',
      '   ....r.....r....   ',
      '   ...............   ',
      '   .c...........c.   ',
      '   ...r.......r...   ',
      '   ...............   ',
      '         ...         ',
      '         ...         ',
      '         .S.         ',
      '          X          ',
    ],
    [
      '   .A.         .B.   ',
      '   ....       ....   ',
      '     ...........     ',
      '    .....r.r.....    ',
      '    ......E......    ',
      '    ..r.......r..    ',
      '  .................  ',
      '  ..  .........  ..  ',
      '  .c  ...r.r...  c.  ',
      '      .........      ',
      '        .....        ',
      '        ..S..        ',
      '          X          ',
    ],
  ],
  gardien: [
    [
      '        ..A..        ',
      '      .........      ',
      '     ...........     ',
      '    .r.........r.    ',
      '    ......E......    ',
      '    ..r.......r..    ',
      '     ...........     ',
      '      .........      ',
      '        .....        ',
      '          .          ',
      '          .          ',
      '          .          ',
      '        .....        ',
      '        ..S..        ',
      '          X          ',
    ],
  ],
};

export const COURANTS = { '^': 'up', v: 'down', '<': 'left', '>': 'right' };
const MARGE = 5;   // du vide tout autour, pour que l'île ne touche jamais le bord de l'écran
const k = (x, y) => x + ',' + y;

/** la carte d'une île ; `m.faille` garde tout ce que le plan dit */
export function construireIle(id, kind, plan, { nom = 'Faille', musique = 'ileInverse', miroir = false, gardien = false } = {}) {
  // une case d'allée entre l'arrivée et le passage de sortie (le portail, haut, ne cache pas le joueur)
  const iX = plan.findIndex((r) => r.includes('X')); plan = [...plan.slice(0, iX), plan[iX].replace('X', '.'), ...plan.slice(iX)];
  const w0 = Math.max(...plan.map((r) => r.length)), w = w0 + MARGE * 2, h = plan.length + MARGE * 2;
  const m = new GameMap(id, w, h, { outdoor: false, fill: T.CAVEWALL, floor: 'faille', name: nom, music: musique, battleBg: 'cave' });
  m.edge = T.CAVEWALL;
  const F = m.faille = { kind, gardien, depart: null, sortie: null, ennemi: null, portes: [], eclats: [], ponts: { a: [], b: [] }, cristaux: [], courants: new Map(), rochers: [], sol: [], solide: 'a' };
  plan.forEach((ligne, j) => {
    const r = ligne.padEnd(w0, ' ');
    for (let i = 0; i < w0; i++) {
      let c = r[miroir ? w0 - 1 - i : i]; if (c === ' ') continue;
      if (miroir && (c === '<' || c === '>')) c = c === '<' ? '>' : '<';
      const x = i + MARGE, y = j + MARGE;
      if (c === 'a' || c === 'b') { F.ponts[c].push([x, y]); m.set(x, y, c === 'a' ? T.CAVE : T.CAVEWALL); continue; }
      if (COURANTS[c]) { F.courants.set(k(x, y), COURANTS[c]); m.set(x, y, T.CAVE); continue; }
      F.sol.push([x, y]);
      m.set(x, y, c === 'r' ? T.BLOCK : T.CAVE);
      if (c === 'S') F.depart = [x, y];
      else if (c === 'X') F.sortie = [x, y];
      else if (c === 'E') F.ennemi = [x, y];
      else if (c === 'A' || c === 'B') F.portes.push([x, y]);
      else if (c === 'c') F.eclats.push([x, y]);
      else if (c === 'i') F.cristaux.push([x, y]);
      else if (c === 'r') F.rochers.push([x, y]);
      else if (c !== '.') throw new Error(`Île de faille : lettre inconnue « ${c} »`);
    }
  });
  F.portes.sort((p, q) => p[0] - q[0]);
  if (!F.depart || !F.sortie || !F.ennemi || !F.portes.length) throw new Error('Île de faille : il manque S, X, E ou un portail');
  return m;
}

/** un plan au hasard pour ce genre de salle */
export function tirerPlan(kind, gardien, alea = Math.random) {
  const L = gardien ? PLANS.gardien : PLANS[kind] || PLANS.alpha;
  return { plan: L[Math.floor(alea() * L.length)], miroir: alea() < 0.5 };
}

/** les ponts s'échangent */
export function echangerPonts(m) {
  const F = m.faille; F.solide = F.solide === 'a' ? 'b' : 'a';
  for (const c of ['a', 'b']) for (const [x, y] of F.ponts[c]) m.set(x, y, c === F.solide ? T.CAVE : T.CAVEWALL);
  return F.solide;
}

/** où un courant dépose celui qui y entre */
export function finCourant(m, x, y) {
  const F = m.faille; let n = 0;
  for (; n < 40; n++) {
    const d = F.courants.get(k(x, y)); if (!d) break;
    const [dx, dy] = DIRS[d]; if (!walkable(m.get(x + dx, y + dy))) break;
    x += dx; y += dy;
  }
  return [x, y, n];
}

/** pas suivant de A vers B en évitant `bloque` (le chemin le plus court), ou null */
export function pasVers(m, de, vers, bloque = () => false) {
  const vu = new Map([[k(...de), null]]); let f = [de];
  while (f.length) {
    const g = [];
    for (const [x, y] of f) for (const [dx, dy] of Object.values(DIRS)) {
      const a = x + dx, b = y + dy, id = k(a, b);
      if (vu.has(id)) continue;
      const but = a === vers[0] && b === vers[1];
      if (!but && (!walkable(m.get(a, b)) || bloque(a, b) || m.faille.courants.has(id))) continue;
      vu.set(id, [x, y]);
      if (but) { let p = [a, b]; for (;;) { const q = vu.get(k(...p)); if (!q || (q[0] === de[0] && q[1] === de[1])) return p; p = q; } }
      g.push([a, b]);
    }
    f = g;
  }
  return null;
}

/** vérifie une île : tout est atteignable, et de partout on peut encore tout rejoindre (aucun cul-de-sac). Renvoie la liste des défauts */
export function verifierIle(m) {
  const F = m.faille, defauts = [], solide0 = F.solide;
  const marche = (x, y, s) => { for (const c of ['a', 'b']) if (F.ponts[c].some(([a, b]) => a === x && b === y)) return c === s; return walkable(m.get(x, y)); };
  const cle = (e) => e.join('|');
  const suivants = ([x, y, s]) => {
    const out = [];
    for (const [dx, dy] of Object.values(DIRS)) {
      let a = x + dx, b = y + dy, t = s; if (!marche(a, b, s)) continue;
      for (let n = 0; n < 40; n++) { const d = F.courants.get(k(a, b)); if (!d) break; const [ex, ey] = DIRS[d]; if (!marche(a + ex, b + ey, s)) break; a += ex; b += ey; }
      if (F.courants.has(k(a, b))) defauts.push(`courant sans fin en ${a},${b}`);
      if (F.cristaux.some(([i, j]) => i === a && j === b)) t = s === 'a' ? 'b' : 'a';
      out.push([a, b, t]);
    }
    return out;
  };
  const atteint = (depart) => { const vu = new Map([[cle(depart), depart]]), f = [depart]; while (f.length) for (const n of suivants(f.pop())) if (!vu.has(cle(n))) { vu.set(cle(n), n); f.push(n); } return vu; };
  const buts = [F.sortie, ...F.portes, ...F.eclats];
  const V = atteint([...F.depart, solide0]);
  const touche = (S, [x, y]) => [...S.values()].some((e) => e[0] === x && e[1] === y);
  for (const b of buts) if (!touche(V, b)) defauts.push(`inatteignable : ${b}`);
  if (![[0, 1], [1, 0], [-1, 0], [0, -1]].some(([dx, dy]) => touche(V, [F.ennemi[0] + dx, F.ennemi[1] + dy]))) defauts.push('ennemi inatteignable');
  for (const e of V.values()) { const S = atteint(e); if (!touche(S, F.sortie) || !F.portes.some((p) => touche(S, p))) { defauts.push(`sans retour : ${e}`); break; } }
  return defauts;
}
