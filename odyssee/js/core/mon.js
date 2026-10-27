// odyssee/js/core/mon.js — créatures : création, statistiques, expérience, attaques, évolution (sans DOM)
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';

export const STAT_NAMES = ['PV', 'Attaque', 'Défense', 'Atq. Spé.', 'Déf. Spé.', 'Vitesse'];
let UID = 1;
export const setUidBase = (n) => { UID = Math.max(UID, n); };

/** points d'expérience totaux pour atteindre le niveau L (courbes de croissance officielles) */
export function expFor(g, L) {
  if (L <= 1) return 0;
  const n = L, n3 = n * n * n;
  switch (g) {
    case 1: return Math.floor(5 * n3 / 4);
    case 2: return n3;
    case 3: return Math.floor(4 * n3 / 5);
    case 4: return Math.max(0, Math.floor(6 * n3 / 5 - 15 * n * n + 100 * n - 140));
    case 5: // erratique
      if (n <= 50) return Math.floor(n3 * (100 - n) / 50);
      if (n <= 68) return Math.floor(n3 * (150 - n) / 100);
      if (n <= 98) return Math.floor(n3 * Math.floor((1911 - 10 * n) / 3) / 500);
      return Math.floor(n3 * (160 - n) / 100);
    case 6: // fluctuante
      if (n <= 15) return Math.floor(n3 * (Math.floor((n + 1) / 3) + 24) / 50);
      if (n <= 36) return Math.floor(n3 * (n + 14) / 50);
      return Math.floor(n3 * (Math.floor(n / 2) + 32) / 50);
    default: return n3;
  }
}

export function calcStats(m) {
  const b = SPECIES[m.sp].b, L = m.lvl, iv = m.iv, ev = m.ev || [0, 0, 0, 0, 0, 0];
  return b.map((B, i) => {
    const core = Math.floor((2 * B + iv[i] + Math.floor(ev[i] / 4)) * L / 100);
    return i === 0 ? (m.sp === 292 ? 1 : core + L + 10) : core + 5;
  });
}

export function refreshStats(m, keepRatio = false) {
  const old = m.stats ? m.stats[0] : 0;
  m.stats = calcStats(m);
  if (m.hp == null) m.hp = m.stats[0];
  else if (keepRatio && old) m.hp = Math.min(m.stats[0], m.hp + (m.stats[0] - old));
  m.hp = Math.min(m.hp, m.stats[0]);
  return m;
}

/** les 4 dernières attaques apprises jusqu'à ce niveau */
export function defaultMoves(sp, lvl) {
  const ls = SPECIES[sp].ls.filter(([l]) => l <= lvl).map(([, id]) => id);
  const uniq = []; for (const id of ls) { const k = uniq.indexOf(id); if (k >= 0) uniq.splice(k, 1); uniq.push(id); }
  return uniq.slice(-4).map((id) => ({ id, pp: MOVES[id].pp }));
}

export function createMon(sp, lvl, o = {}) {
  const r = o.rng || Math.random;
  const S = SPECIES[sp];
  const m = {
    uid: UID++, sp, lvl, exp: expFor(S.g, lvl),
    iv: o.iv || Array.from({ length: 6 }, () => Math.floor(r() * 32)),
    ev: [0, 0, 0, 0, 0, 0],
    moves: o.moves ? o.moves.map((id) => ({ id, pp: MOVES[id].pp })) : defaultMoves(sp, lvl),
    status: null, slp: 0, tox: 0,
    gender: S.gr < 0 ? null : (r() * 8 < S.gr ? 'f' : 'm'),
    shiny: o.shiny ?? r() < 1 / 1024,
    ball: o.ball || 'poke-ball',
    met: o.met || '', ot: o.ot || '',
  };
  refreshStats(m);
  return m;
}

export const monName = (m) => m.nick || SPECIES[m.sp].n;
export const species = (m) => SPECIES[m.sp];
export const isFainted = (m) => m.hp <= 0;

export function healFull(m) {
  m.stats || refreshStats(m);
  m.hp = m.stats[0]; m.status = null; m.slp = 0; m.tox = 0;
  for (const mv of m.moves) mv.pp = MOVES[mv.id].pp;
}

/** attaques apprises en passant au niveau L */
export const movesAtLevel = (sp, L) => SPECIES[sp].ls.filter(([l]) => l === L).map(([, id]) => id);

/**
 * Ajoute de l'expérience. Renvoie les étapes : [{ lvl, stats avant/après, learn: [ids] }]
 * Les attaques sont apprises seules s'il reste une place ; sinon elles sont renvoyées dans `ask`.
 */
export function gainExp(m, amount) {
  const S = SPECIES[m.sp], steps = [];
  if (m.lvl >= 100) return steps;
  m.exp += amount;
  while (m.lvl < 100 && m.exp >= expFor(S.g, m.lvl + 1)) {
    const before = m.stats.slice();
    m.lvl++;
    refreshStats(m, true);
    const st = { lvl: m.lvl, before, after: m.stats.slice(), learned: [], ask: [] };
    for (const id of movesAtLevel(m.sp, m.lvl)) {
      if (m.moves.some((x) => x.id === id)) continue;
      if (m.moves.length < 4) { m.moves.push({ id, pp: MOVES[id].pp }); st.learned.push(id); }
      else st.ask.push(id);
    }
    steps.push(st);
  }
  if (m.lvl >= 100) m.exp = expFor(S.g, 100);
  return steps;
}

export function expProgress(m) {
  const g = SPECIES[m.sp].g, a = expFor(g, m.lvl), b = expFor(g, m.lvl + 1);
  return m.lvl >= 100 ? 1 : Math.max(0, Math.min(1, (m.exp - a) / (b - a)));
}

/** évolution par niveau possible ? renvoie l'espèce cible */
export function levelEvolution(m) {
  const ev = SPECIES[m.sp].ev; if (!ev) return null;
  const e = ev.find((x) => x.lvl && m.lvl >= x.lvl);
  return e ? e.to : null;
}
export function itemEvolution(m, item) {
  const ev = SPECIES[m.sp].ev; if (!ev) return null;
  const e = ev.find((x) => x.item === item);
  return e ? e.to : null;
}
export function evolve(m, to) {
  const hadNick = !!m.nick;
  m.sp = to; if (!hadNick) delete m.nick;
  refreshStats(m, true);
  const learned = [], ask = [];
  for (const id of movesAtLevel(to, m.lvl)) {
    if (m.moves.some((x) => x.id === id)) continue;
    if (m.moves.length < 4) { m.moves.push({ id, pp: MOVES[id].pp }); learned.push(id); } else ask.push(id);
  }
  return { learned, ask };
}

/** gain d'effort simplifié : +1 dans la meilleure stat de base de l'adversaire (plafond 252 / 510) */
export function gainEffort(m, foeSp) {
  const b = SPECIES[foeSp].b; let k = 0; for (let i = 1; i < 6; i++) if (b[i] > b[k]) k = i;
  const tot = m.ev.reduce((a, x) => a + x, 0); if (tot >= 510 || m.ev[k] >= 252) return;
  m.ev[k] += Math.min(2, 252 - m.ev[k], 510 - tot);
}
