// pokemon/engine/bot.js
// Intelligence Artificielle pour les Dresseurs Bots (Red, Blue, Cynthia...)
// Choisit l'attaque la plus efficace, switch intelligemment ou achève avec une attaque prioritaire.

import { MOVES } from './moves.js';
import { getEffectiveness } from './types.js';
import { calculateDamage, getActivePokemon, getEffectiveSpeed, canMega, foeSides, allySide, teamOf, benchOf } from './battle.js';
import { CHOICE } from './items.js';
import { absorbs, moveTypeFor, blocksStatus, weatherOf } from './abilities.js';

function canInflictStatus(target, move, state) {
  const st = move?.effect?.status;
  if (!st || !target || target.fainted || target.status) return false;
  if (target.ability === 'magic-bounce') return false;
  const t = target.types || [];
  if (st === 'burn' && t.includes('fire')) return false;
  if (st === 'paralysis' && (t.includes('electric') || (move.type === 'electric' && t.includes('ground')))) return false;
  if ((st === 'poison' || st === 'toxic') && (t.includes('poison') || t.includes('steel'))) return false;
  if (st === 'freeze' && t.includes('ice')) return false;
  return !blocksStatus(target, st, state ? weatherOf(state) : 'none');
}

function threatFromFoes(battle, myPoke, foePokes) {
  if (!myPoke || myPoke.fainted) return { incomingMaxDmg: 0, foeFaster: false, threatenedKO: false };
  const mySpe = getEffectiveSpeed(myPoke, battle);
  let incomingMaxDmg = 0, foeFaster = false, threatenedKO = false;
  for (const f of foePokes) {
    if (!f || f.fainted) continue;
    const faster = getEffectiveSpeed(f, battle) > mySpe;
    let maxF = 0;
    for (const mId of (f.moves || [])) {
      const mv = MOVES[mId];
      if (!mv || !mv.power) continue;
      const { damage } = calculateDamage(f, myPoke, mv, battle);
      if (damage > maxF) maxF = damage;
      if ((faster || (mv.priority || 0) > 0) && damage >= myPoke.hp) threatenedKO = true;
    }
    if (maxF > incomingMaxDmg) incomingMaxDmg = maxF;
    if (faster && maxF >= myPoke.hp * 0.45) foeFaster = true;
  }
  return { incomingMaxDmg, foeFaster, threatenedKO };
}

function scoreSwitchCandidate(cand, oppPokes, battle = null) {
  if (!cand || cand.fainted) return -Infinity;
  let score = (cand.hp / Math.max(1, cand.maxHp)) * 20;
  const candSpe = battle ? getEffectiveSpeed(cand, battle) : (cand.stats?.spe || 50);
  for (const opp of oppPokes) {
    if (!opp || opp.fainted) continue;
    let worstEff = 0;
    for (const ft of (opp.types || ['normal'])) {
      if (absorbs(cand, ft, opp)) continue;
      const eff = getEffectiveness(ft, cand.types || ['normal']);
      if (eff > worstEff) worstEff = eff;
    }
    if (worstEff === 0) score += 60;
    else if (worstEff <= 0.5) score += 45;
    else if (worstEff >= 4) score -= 80;
    else if (worstEff >= 2) score -= 40;

    let bestOff = 0;
    for (const mId of (cand.moves || [])) {
      const mv = MOVES[mId];
      if (!mv || !mv.power) continue;
      const eff = getEffectiveness(moveTypeFor(cand, mv), opp.types || ['normal']);
      const stab = (cand.types || []).includes(moveTypeFor(cand, mv)) ? 1.3 : 1;
      const dmg = battle ? calculateDamage(cand, opp, mv, battle).damage : (mv.power * eff * stab);
      const val = battle ? Math.min(1.5, dmg / Math.max(1, opp.hp)) * 75 : eff * stab * 30;
      if (val > bestOff) bestOff = val;
    }
    score += bestOff;
    const oppSpe = battle ? getEffectiveSpeed(opp, battle) : (opp.stats?.spe || 50);
    if (candSpe > oppSpe) score += 15;
  }
  return score;
}

export function chooseBotAction(battle, side, difficulty = 'normal') {
  const act = chooseBotActionRaw(battle, side, difficulty);
  // Méga-Évolution dès que possible (le bot facile l'oublie une fois sur deux)
  if (act && act.type === 'move' && canMega(battle, side, getActivePokemon(battle, side)) && (difficulty !== 'facile' || Math.random() < 0.5)) act.mega = true;
  return act;
}

function chooseBotActionRaw(battle, side, difficulty = 'normal') {
  const myTeam = side === 'A' ? battle.teamA : battle.teamB;
  const myActiveIdx = side === 'A' ? battle.activeA : battle.activeB;
  const myPoke = myTeam[myActiveIdx];
  const oppPoke = getActivePokemon(battle, side === 'A' ? 'B' : 'A');

  const forced = battle.phase === 'switch_forced_both' || battle.phase === `switch_forced_${side}`;   // K.O. ou Demi-Tour / Change Éclair
  if (!myPoke || myPoke.fainted || forced) {
    return chooseBestSwitch(myTeam, myActiveIdx, oppPoke, battle);
  }

  const threat = difficulty !== 'facile' ? threatFromFoes(battle, myPoke, [oppPoke]) : { incomingMaxDmg: 0, foeFaster: false, threatenedKO: false };

  // --- Évaluation d'un switch tactique volontaire (si difficulté normal/expert) ---
  if (difficulty !== 'facile' && myPoke.hp < myPoke.maxHp * 0.35) {
    const aliveBench = myTeam.map((p, idx) => ({ p, idx })).filter(item => item.idx !== myActiveIdx && !item.p.fainted && item.p.hp > item.p.maxHp * 0.5);
    if (aliveBench.length > 0 && Math.random() < (difficulty === 'expert' ? 0.5 : 0.25)) {
      const best = chooseBestSwitch(myTeam, myActiveIdx, oppPoke, battle);
      if (best) return best;
    }
  }

  // --- Objet Choix : bloqué sur une attaque. Si elle ne sert plus à rien (sans effet, peu efficace ou absorbée), on change ---
  if (CHOICE.has(myPoke.item) && myPoke.choiceLock && myPoke.moves.includes(myPoke.choiceLock) && (myPoke.ppMap ? myPoke.ppMap[myPoke.choiceLock] : 1) > 0) {
    const lm = MOVES[myPoke.choiceLock];
    const mType = lm ? moveTypeFor(myPoke, lm) : 'normal';
    const mult = lm && lm.power ? getEffectiveness(mType, oppPoke.types) : 1;
    const isAbsorbed = lm && lm.power && absorbs(oppPoke, mType, myPoke);
    if (difficulty !== 'facile' && (mult < 1 || isAbsorbed)) {
      const sw = chooseBestSwitch(myTeam, myActiveIdx, oppPoke, battle);
      if (sw) return sw;
    }
    return { type: 'move', moveId: myPoke.choiceLock };
  }

  // --- Évaluation des 4 attaques ---
  const scoredMoves = [];
  const mySpe = getEffectiveSpeed(myPoke, battle), oppSpe = getEffectiveSpeed(oppPoke, battle);

  for (const moveId of myPoke.moves) {
    const move = MOVES[moveId];
    if (!move) continue;
    if (myPoke.disabled && myPoke.disabled.move === moveId) continue;   // bloquée par Corps Maudit
    if (myPoke.ppMap && myPoke.ppMap[moveId] <= 0) continue;

    let score = 0;

    // 1. Soin si PV bas (utile seulement si on peut agir avant d'être mis K.O.)
    if (move.effect && move.effect.type === 'heal') {
      if (myPoke.hp < myPoke.maxHp * 0.5 && !(difficulty !== 'facile' && threat.threatenedKO)) score += 130;
      else score -= 60;
    }

    // 2. Boost ou malus de stat
    if (move.cat === 'status' && move.effect && move.effect.type === 'stat') {
      const eff = move.effect;
      if (eff.target === 'self' || (eff.val || 0) > 0) {
        const curStage = (myPoke.statStages && eff.stat && myPoke.statStages[eff.stat]) || 0;
        if (curStage >= 2 || (difficulty !== 'facile' && threat.threatenedKO)) score -= 80;
        else if (myPoke.hp > myPoke.maxHp * 0.55) score += 75;
        else score -= 35;
      } else {
        const oppAb = oppPoke.ability;
        const curOppStage = (oppPoke.statStages && eff.stat && oppPoke.statStages[eff.stat]) || 0;
        if (oppAb === 'magic-bounce' || oppAb === 'clear-body' || oppAb === 'contrary' || curOppStage <= -2) score -= 100;
        else score += 35;
      }
    }

    // 3. Statut (paralysie, brûlure, sommeil, poison)
    if (move.cat === 'status' && move.effect && move.effect.type === 'status') {
      if (canInflictStatus(oppPoke, move, battle)) {
        const st = move.effect.status;
        score += st === 'sleep' ? 95 : (st === 'burn' && (oppPoke.stats?.atk || 0) >= (oppPoke.stats?.spa || 0)) ? 85 : 70;
      } else {
        score -= 120;
      }
    }

    // 4. Attaque offensive avec calcul de dégâts
    if (move.power > 0) {
      const mType = moveTypeFor(myPoke, move);
      const { damage, mult } = calculateDamage(myPoke, oppPoke, move, battle);
      if (absorbs(oppPoke, mType, myPoke) || mult === 0) {
        score -= 400;
      } else {
        score += damage;
        if (damage >= oppPoke.hp) {
          score += 200;
          if (move.priority && move.priority > 0) score += 120;
        }
        if (threat.threatenedKO && move.priority && move.priority > 0) score += 140;
        if (mySpe <= oppSpe && move.effect?.type === 'stat' && move.effect.stat === 'spe' && move.effect.val < 0 && Math.floor(oppSpe * 2 / 3) < mySpe) score += 55;
        if (mult >= 2) score += 40;
        else if (mult <= 0.5) score -= 40;
      }
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

export function chooseBestSwitch(team, currentIdx, oppPoke, battle = null) {
  const candidates = team
    .map((p, idx) => ({ p, idx }))
    .filter(item => item.idx !== currentIdx && !item.p.fainted);

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => scoreSwitchCandidate(b.p, oppPoke ? [oppPoke] : [], battle) - scoreSwitchCandidate(a.p, oppPoke ? [oppPoke] : [], battle));

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
  const threat = difficulty !== 'facile' ? threatFromFoes(battle, me, foes.map(([, f]) => f)) : { incomingMaxDmg: 0, foeFaster: false, threatenedKO: false };
  const mySpe = getEffectiveSpeed(me, battle);
  const noise = difficulty === 'facile' ? 0.6 : difficulty === 'normal' ? 0.2 : 0.05;
  let best = null;
  const consider = (act, score) => { score *= 1 + (Math.random() - 0.5) * noise; if (!best || score > best.score) best = { act, score }; };
  for (const moveId of me.moves) {
    const move = MOVES[moveId];
    if (!move || (me.ppMap && me.ppMap[moveId] <= 0)) continue;
    if (me.disabled && me.disabled.move === moveId) continue;
    if (CHOICE.has(me.item) && me.choiceLock && me.choiceLock !== moveId) continue;
    if (move.effect && move.effect.type === 'protect') {
      // Abri : quand on est menacé (notamment K.O. rapide), jamais deux fois de suite
      if (!me.protectChain) consider({ type: 'move', moveId }, threat.threatenedKO ? 95 : me.hp < me.maxHp * 0.5 ? 70 : 25);
      continue;
    }
    if (!move.power) {
      if (move.effect && move.effect.type === 'heal') consider({ type: 'move', moveId }, (me.hp < me.maxHp * 0.45 && !threat.threatenedKO) ? 95 : 0);
      else if (move.effect && move.effect.target === 'self') {
        const curSt = (me.statStages && move.effect.stat && me.statStages[move.effect.stat]) || 0;
        consider({ type: 'move', moveId }, (curSt < 2 && me.hp > me.maxHp * 0.65 && !threat.threatenedKO) ? 55 : -20);
      } else {
        for (const [fs, f] of foes) {
          const stOk = move.effect && move.effect.type === 'status' ? canInflictStatus(f, move, battle) : false;
          consider({ type: 'move', moveId, target: fs }, stOk ? 60 : -40);
        }
      }
      continue;
    }
    // valeur d'un coup : part des PV retirés, bonus K.O. et contrôle de vitesse
    const hit = (target, mult) => {
      const mType = moveTypeFor(me, move);
      if (absorbs(target, mType, me)) return -2;
      const { damage, mult: eff } = calculateDamage(me, target, move, battle);
      if (eff === 0) return 0;
      const d = damage * mult * ((move.acc || 100) / 100);
      let sc = Math.min(1, d / Math.max(1, target.hp)) * 100 + (d >= target.hp ? 80 : 0);
      if (move.effect?.type === 'stat' && move.effect.stat === 'spe' && move.effect.val < 0 && mySpe <= getEffectiveSpeed(target, battle)) sc += 30;
      return sc;
    };
    if (move.spread) {
      const tg = move.spread === 'all' && ally && !ally.fainted ? [...foes.map(([, f]) => f), ally] : foes.map(([, f]) => f);
      const mult = tg.length > 1 ? 0.75 : 1;
      let sc = 0, lethalFriendly = false;
      for (const t of tg) {
        if (t === ally) {
          const hAlly = Math.max(0, hit(t, mult));
          if (difficulty !== 'facile' && hAlly >= 45) lethalFriendly = true;
          sc -= (difficulty !== 'facile' ? 2.4 : 1.5) * hAlly;
        } else {
          sc += hit(t, mult);
        }
      }
      consider({ type: 'move', moveId }, lethalFriendly ? -200 : sc);
    } else {
      for (const [fs, f] of foes) {
        let sc = hit(f, 1);
        if (move.priority > 0 && calculateDamage(me, f, move, battle).damage >= f.hp) sc += 45;
        if (threat.threatenedKO && move.priority > 0) sc += 55;
        consider({ type: 'move', moveId, target: fs }, sc);
      }
    }
  }
  const act = best ? best.act : { type: 'move', moveId: me.moves[0], target: foes[0] && foes[0][0] };
  if (canMega(battle, side, me) && (difficulty !== 'facile' || Math.random() < 0.5)) act.mega = true;
  return act;
}

/** Remplaçant pour un emplacement vide (double) : le Pokémon du banc le mieux armé et protégé face aux adversaires. */
export function chooseDoublesSwitch(battle, side) {
  const team = teamOf(battle, side);
  const foes = foeSides(battle, side).map((s) => getActivePokemon(battle, s)).filter((p) => p && !p.fainted);
  const cands = benchOf(battle, side).map((i) => ({ p: team[i], i }));
  if (!cands.length) return null;
  cands.sort((a, b) => scoreSwitchCandidate(b.p, foes, battle) - scoreSwitchCandidate(a.p, foes, battle));
  return { type: 'switch', targetIndex: cands[0].i };
}
