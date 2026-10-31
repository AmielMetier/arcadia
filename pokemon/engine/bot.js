// pokemon/engine/bot.js
// Intelligence Artificielle pour les Dresseurs Bots (Red, Blue, Cynthia...)
// Choisit l'attaque la plus efficace, switch intelligemment ou achève avec une attaque prioritaire.

import { MOVES } from './moves.js';
import { getEffectiveness } from './types.js';
import { calculateDamage, getActivePokemon, canMega } from './battle.js';
import { CHOICE } from './items.js';

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

  if (!myPoke || myPoke.fainted) {
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
      const { damage, mult } = calculateDamage(myPoke, oppPoke, move);
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
