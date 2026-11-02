// pokemon/engine/bot.js
// Intelligence Artificielle pour les Dresseurs Bots (Red, Blue, Cynthia...)
// Choisit l'attaque la plus efficace, switch intelligemment ou achève avec une attaque prioritaire.

import { MOVES } from './moves.js';
import { getEffectiveness } from './types.js';
import { calculateDamage, getActivePokemon, canMega, foeSides, allySide, teamOf, teamKey, activeIdxOf } from './battle.js';
import { CHOICE } from './items.js';
import { absorbs, moveTypeFor } from './abilities.js';

export function chooseBotAction(battle, side, difficulty = 'normal') {
  const act = chooseBotActionRaw(battle, side, difficulty);
  // Méga-Évolution dès que possible (le bot facile l'oublie une fois sur deux)
  if (act && act.type === 'move' && canMega(battle, side, getActivePokemon(battle, side)) && (difficulty !== 'facile' || Math.random() < 0.5)) act.mega = true;
  return act;
}

function chooseBotActionRaw(battle, side, difficulty = 'normal') {
  const myTeam = side === 'A' ? battle.teamA : battle.teamB;
  const oppTeam = side === 'A' ? battle.teamB : battle.teamA;
  const myActiveIdx = side === 'A' ? battle.activeA : battle.activeB;
  const myPoke = myTeam[myActiveIdx];
  const oppPoke = getActivePokemon(battle, side === 'A' ? 'B' : 'A');

  const forced = battle.phase === 'switch_forced_both' || battle.phase === `switch_forced_${side}`;   // K.O. ou Demi-Tour / Change Éclair
  if (!myPoke || myPoke.fainted || forced) {
    // Switch forcé
    return chooseBestSwitch(myTeam, myActiveIdx, oppPoke);
  }

  // --- Évaluation d'un switch tactique volontaire (si difficulté normal/expert) ---
  if (difficulty !== 'facile' && myPoke.hp < myPoke.maxHp * 0.35) {
    const aliveBench = myTeam.map((p, idx) => ({ p, idx })).filter(item => item.idx !== myActiveIdx && !item.p.fainted && item.p.hp > item.p.maxHp * 0.5);
    if (aliveBench.length > 0 && Math.random() < (difficulty === 'expert' ? 0.45 : 0.25)) {
      // Trouver un Pokémon du banc qui résiste aux types adverses
      const best = chooseBestSwitch(myTeam, myActiveIdx, oppPoke);
      if (best) return best;
    }
  }

  // --- Objet Choix : bloqué sur une attaque. Si elle ne sert plus à rien (sans effet, peu efficace), on change ---
  if (CHOICE.has(myPoke.item) && myPoke.choiceLock && myPoke.moves.includes(myPoke.choiceLock) && (myPoke.ppMap ? myPoke.ppMap[myPoke.choiceLock] : 1) > 0) {
    const lm = MOVES[myPoke.choiceLock];
    const mult = lm && lm.power ? getEffectiveness(lm.type, oppPoke.types) : 1;
    if (difficulty !== 'facile' && mult < 1) {
      const sw = chooseBestSwitch(myTeam, myActiveIdx, oppPoke);
      if (sw) return sw;
    }
    return { type: 'move', moveId: myPoke.choiceLock };
  }

  // --- Évaluation des 4 attaques ---
  const scoredMoves = [];

  for (const moveId of myPoke.moves) {
    const move = MOVES[moveId];
    if (!move) continue;
    if (myPoke.disabled && myPoke.disabled.move === moveId) continue;   // bloquée par Corps Maudit
    if (myPoke.ppMap && myPoke.ppMap[moveId] <= 0) continue;

    let score = 0;

    // 1. Soin si PV bas
    if (move.effect && move.effect.type === 'heal') {
      if (myPoke.hp < myPoke.maxHp * 0.5) score += 120;
      else score -= 50;
    }

    // 2. Stat boost si PV élevés
    if (move.cat === 'status' && move.effect && move.effect.type === 'stat') {
      if (myPoke.hp > myPoke.maxHp * 0.7) score += 60;
      else score -= 30;
    }

    // 3. Statut (paralysie, brûlure, sommeil)
    if (move.cat === 'status' && move.effect && move.effect.type === 'status') {
      if (!oppPoke.status) score += 70;
      else score -= 90;
    }

    // 4. Attaque offensive avec calcul de dégâts
    if (move.power > 0) {
      const { damage, mult } = calculateDamage(myPoke, oppPoke, move, battle);
      // le talent adverse absorbe ce type (Lévitation, Absorb Eau, Torche…) : à éviter
      if (absorbs(oppPoke, moveTypeFor(myPoke, move), myPoke)) score -= 400;
      score += damage;

      // Bonus si l'attaque permet d'achever le Pokémon adverse (K.O.)
      if (damage >= oppPoke.hp) {
        score += 200;
        // Si en plus c'est une attaque de priorité, assurance maximale
        if (move.priority && move.priority > 0) score += 100;
      }

      // Bonus pour super efficace
      if (mult >= 2) score += 40;
      else if (mult <= 0.5) score -= 40;
      else if (mult === 0) score -= 300;
    }

    // Variation selon difficulté
    if (difficulty === 'facile') {
      score += (Math.random() - 0.5) * 60;
    } else if (difficulty === 'normal') {
      score += (Math.random() - 0.5) * 20;
    }

    scoredMoves.push({ moveId, score });
  }

  // Tri par score décroissant
  scoredMoves.sort((a, b) => b.score - a.score);

  const chosenMoveId = scoredMoves[0] ? scoredMoves[0].moveId : myPoke.moves[0];
  return { type: 'move', moveId: chosenMoveId };
}

export function chooseBestSwitch(team, currentIdx, oppPoke) {
  const candidates = team
    .map((p, idx) => ({ p, idx }))
    .filter(item => item.idx !== currentIdx && !item.p.fainted);

  if (candidates.length === 0) return null;

  // Calcul du meilleur match-up
  candidates.sort((a, b) => {
    // Calcul de la résistance face au type principal adverse
    const oppType = oppPoke ? oppPoke.types[0] : 'normal';
    const effA = getEffectiveness(oppType, a.p.types);
    const effB = getEffectiveness(oppType, b.p.types);

    // Moins l'adversaire est efficace contre nous, mieux c'est
    if (effA !== effB) return effA - effB;

    // Sinon privilégier les PV restants
    return b.p.hp - a.p.hp;
  });

  return { type: 'switch', targetIndex: candidates[0].idx };
}

// ---------------------------------------------------------------------------
// Combat en double (VGC) : une action par Pokémon sur le terrain, avec sa cible
// ---------------------------------------------------------------------------
/** Action d'un bot pour l'emplacement `side` (A, C, B ou D) d'un combat en double. */
export function chooseDoublesAction(battle, side, difficulty = 'normal') {
  const me = getActivePokemon(battle, side);
  if (!me || me.fainted) return null;
  const foes = foeSides(battle, side).map((s) => [s, getActivePokemon(battle, s)]).filter(([, p]) => p && !p.fainted);
  const ally = getActivePokemon(battle, allySide(side));
  const noise = difficulty === 'facile' ? 0.6 : difficulty === 'normal' ? 0.2 : 0.05;
  let best = null;
  const consider = (act, score) => { score *= 1 + (Math.random() - 0.5) * noise; if (!best || score > best.score) best = { act, score }; };
  for (const moveId of me.moves) {
    const move = MOVES[moveId];
    if (!move || (me.ppMap && me.ppMap[moveId] <= 0)) continue;
    if (me.disabled && me.disabled.move === moveId) continue;
    if (CHOICE.has(me.item) && me.choiceLock && me.choiceLock !== moveId) continue;
    if (move.effect && move.effect.type === 'protect') {
      // Abri : quand on est menacé, jamais deux fois de suite
      if (!me.protectChain) consider({ type: 'move', moveId }, me.hp < me.maxHp * 0.5 ? 70 : 25);
      continue;
    }
    if (!move.power) {
      if (move.effect && move.effect.type === 'heal') consider({ type: 'move', moveId }, me.hp < me.maxHp * 0.45 ? 90 : 0);
      else if (move.effect && move.effect.target === 'self') consider({ type: 'move', moveId }, me.hp > me.maxHp * 0.75 ? 45 : 5);
      else for (const [fs, f] of foes) consider({ type: 'move', moveId, target: fs }, move.effect && move.effect.type === 'status' && !f.status ? 50 : 0);
      continue;
    }
    // valeur d'un coup : part des PV retirés, bonus K.O.
    const hit = (target, mult) => {
      if (absorbs(target, moveTypeFor(me, move), me)) return -1;
      const { damage } = calculateDamage(me, target, move, battle);
      const d = damage * mult * ((move.acc || 100) / 100);
      return Math.min(1, d / Math.max(1, target.hp)) * 100 + (d >= target.hp ? 80 : 0);
    };
    if (move.spread) {
      const tg = move.spread === 'all' && ally && !ally.fainted ? [...foes.map(([, f]) => f), ally] : foes.map(([, f]) => f);
      const mult = tg.length > 1 ? 0.75 : 1;
      let sc = 0;
      for (const t of tg) sc += t === ally ? -1.5 * Math.max(0, hit(t, mult)) : hit(t, mult);
      consider({ type: 'move', moveId }, sc);
    } else {
      for (const [fs, f] of foes) consider({ type: 'move', moveId, target: fs }, hit(f, 1) + (move.priority > 0 && calculateDamage(me, f, move, battle).damage >= f.hp ? 40 : 0));
    }
  }
  const act = best ? best.act : { type: 'move', moveId: me.moves[0], target: foes[0] && foes[0][0] };
  if (canMega(battle, side, me) && (difficulty !== 'facile' || Math.random() < 0.5)) act.mega = true;
  return act;
}

/** Remplaçant pour un emplacement vide (double) : le Pokémon du banc qui craint le moins les adversaires. */
export function chooseDoublesSwitch(battle, side) {
  const team = teamOf(battle, side), on = activeIdxOf(battle, teamKey(side));
  const foes = foeSides(battle, side).map((s) => getActivePokemon(battle, s)).filter((p) => p && !p.fainted);
  const cands = team.map((p, i) => ({ p, i })).filter(({ p, i }) => !p.fainted && !on.includes(i));
  if (!cands.length) return null;
  const risk = (p) => foes.reduce((n, f) => n + Math.max(...f.types.map((t) => getEffectiveness(t, p.types))), 0);
  cands.sort((a, b) => risk(a.p) - risk(b.p) || b.p.hp / b.p.maxHp - a.p.hp / a.p.maxHp);
  return { type: 'switch', targetIndex: cands[0].i };
}
