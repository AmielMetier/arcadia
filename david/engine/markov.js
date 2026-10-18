// Modèle de Markov du plateau : probabilité de s'arrêter sur chaque case à long terme.
// Hypothèses (modèle simplifié, classique en théorie des jeux de plateau) :
//  - deux dés, cases « Allez en prison » et trois doubles (1/216) envoient en prison ;
//  - la prison est traitée comme une simple visite (on en sort au tour suivant) ;
//  - les cartes Chance et Caisse de communauté déplacent le pion selon le paquet réel du plateau.
// La distribution stationnaire est obtenue par itération de puissance.
import { level, groupSpaces } from './valuation.js';

const N = 40;

function nearest(board, from, kind) {
  let j = from;
  do j = (j + 1) % N; while (board.spaces[j].type !== kind);
  return j;
}

// Où finit-on réellement quand le dé nous pose sur la case `dest` ? (distribution de probabilités)
function resolve(board, dest, depth = 0) {
  const sp = board.spaces[dest], out = new Map();
  const add = (k, p) => out.set(k, (out.get(k) || 0) + p);
  if (sp.type === 'gotojail') { add(board.rules.jailPosition, 1); return out; }
  if ((sp.type === 'chance' || sp.type === 'chest') && depth < 2) {
    const deck = board.cards[sp.type], q = 1 / deck.length;
    for (const c of deck) {
      const a = c.action;
      let to = null;
      if (a.type === 'advance') to = a.to;
      else if (a.type === 'advanceNearest') to = nearest(board, dest, a.kind);
      else if (a.type === 'goToJail') to = board.rules.jailPosition;
      else if (a.type === 'back') {
        for (const [k, p] of resolve(board, (dest - a.steps + N) % N, depth + 1)) add(k, p * q);
        continue;
      }
      add(to == null ? dest : to, q);
    }
    return out;
  }
  add(dest, 1);
  return out;
}

let cache = null;
export function landingProbabilities(board) {
  if (cache && cache.board === board) return cache.pi;
  // matrice de transition (ligne = départ)
  const T = Array.from({ length: N }, () => new Float64Array(N));
  const jail = board.rules.jailPosition, pTriple = 1 / 216;
  for (let i = 0; i < N; i++) {
    for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) {
      for (const [k, p] of resolve(board, (i + a + b) % N)) T[i][k] += (p / 36) * (1 - pTriple);
    }
    T[i][jail] += pTriple;
  }
  let pi = new Float64Array(N).fill(1 / N);
  for (let it = 0; it < 300; it++) {
    const next = new Float64Array(N);
    for (let i = 0; i < N; i++) { const pi_i = pi[i]; if (!pi_i) continue; const row = T[i]; for (let k = 0; k < N; k++) next[k] += pi_i * row[k]; }
    pi = next;
  }
  cache = { board, pi: Array.from(pi) };
  return cache.pi;
}

// Analyse financière des propriétés d'un joueur, avec les loyers actuels.
// Revenu espéré par tour de table = P(arrivée par lancer) × loyer × nombre d'adversaires en lice.
export function propertyAnalysis(state, board, pid) {
  const pi = landingProbabilities(board);
  const opponents = state.players.filter((p) => !p.bankrupt && p.id !== pid).length;
  const hph = state.cfg.housesPerHotel;
  const rows = [];
  for (const sp of board.spaces) {
    const pr = state.props[sp.i];
    if (!pr || pr.owner !== pid) continue;
    const rent = currentRent(state, board, sp.i);
    const invested = sp.price + (sp.type === 'street' ? (pr.hotel ? (hph + 1) * sp.houseCost : pr.houses * sp.houseCost) : 0);
    const ev = pr.mortgaged ? 0 : pi[sp.i] * rent * opponents;
    // gain marginal d'un bâtiment de plus (si on peut construire ici)
    let nextGain = null;
    if (sp.type === 'street' && !pr.mortgaged && !pr.hotel && groupSpaces(board, sp.group).every((j) => state.props[j].owner === pid)) {
      const nextRent = pr.houses >= hph ? sp.rent[5] : sp.rent[pr.houses + 1];
      nextGain = (pi[sp.i] * (nextRent - rent) * opponents) / sp.houseCost;
    }
    rows.push({
      i: sp.i, name: sp.name, color: sp.color, group: sp.group, p: pi[sp.i], rent, invested, ev,
      roi: invested ? ev / invested : 0, payback: ev > 0 ? invested / ev : Infinity, nextGain, mortgaged: pr.mortgaged, level: level(state, sp.i),
    });
  }
  return { rows, opponents };
}

export function currentRent(state, board, i) {
  const sp = board.spaces[i], pr = state.props[i];
  if (!pr || pr.owner == null || pr.mortgaged) return 0;
  const owned = groupSpaces(board, sp.group).filter((j) => state.props[j].owner === pr.owner).length;
  if (sp.type === 'street') {
    if (pr.hotel) return sp.rent[5];
    if (pr.houses) return sp.rent[pr.houses];
    return sp.rent[0] * (owned === groupSpaces(board, sp.group).length ? 2 : 1);
  }
  if (sp.type === 'station') return sp.rent[owned - 1];
  return 7 * sp.diceMultiplier[Math.min(owned, 2) - 1]; // espérance de la somme de deux dés = 7
}
