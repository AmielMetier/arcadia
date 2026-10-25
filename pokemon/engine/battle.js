// pokemon/engine/battle.js
// Moteur de combat Pokémon 3v3 : calcul des dégâts, statuts, switchs et résolution de tour.

import { getEffectiveness } from './types.js';
import { MOVES } from './moves.js';

const STAGE_MULTS = {
  '-6': 2 / 8, '-5': 2 / 7, '-4': 2 / 6, '-3': 2 / 5, '-2': 2 / 4, '-1': 2 / 3,
  '0': 1,
  '1': 3 / 2, '2': 4 / 2, '3': 5 / 2, '4': 6 / 2, '5': 7 / 2, '6': 8 / 2
};

export function createBattle({ trainerA, trainerB, teamA, teamB }) {
  return {
    trainerA: { id: trainerA.id, name: trainerA.name, color: trainerA.color || '#ff4b2b', bot: !!trainerA.bot },
    trainerB: { id: trainerB.id, name: trainerB.name, color: trainerB.color || '#2b8cff', bot: !!trainerB.bot },
    teamA: teamA.map(p => ({ ...p, statStages: { ...p.statStages } })),
    teamB: teamB.map(p => ({ ...p, statStages: { ...p.statStages } })),
    activeA: 0,
    activeB: 0,
    turn: 1,
    phase: 'choose', // 'choose', 'switch_forced_A', 'switch_forced_B', 'over'
    winner: null,
    log: []
  };
}

export function getActivePokemon(battle, side) {
  const team = side === 'A' ? battle.teamA : battle.teamB;
  const idx = side === 'A' ? battle.activeA : battle.activeB;
  return team[idx];
}

export function getTrainer(battle, side) {
  return side === 'A' ? battle.trainerA : battle.trainerB;
}

export function getEffectiveSpeed(poke) {
  let spe = poke.stats.spe;
  const stage = poke.statStages.spe || 0;
  spe *= (STAGE_MULTS[stage] || 1);
  if (poke.status === 'paralysis') spe *= 0.5;
  return spe;
}

export function getEffectiveStat(poke, statName) {
  let val = poke.stats[statName] || 100;
  const stage = poke.statStages[statName] || 0;
  val *= (STAGE_MULTS[stage] || 1);
  return Math.max(1, val);
}

/**
 * Calcul des dégâts selon la formule standard Pokémon
 */
export function calculateDamage(attacker, defender, move) {
  if (move.cat === 'status' || move.power === 0) return { damage: 0, mult: 1, crit: false, text: '' };

  const isPhys = move.cat === 'physical';
  let atk = getEffectiveStat(attacker, isPhys ? 'atk' : 'spa');
  let def = getEffectiveStat(defender, isPhys ? 'def' : 'spd');

  // Si brûlé et attaque physique : 50% de dégâts
  if (isPhys && attacker.status === 'burn') {
    atk *= 0.5;
  }

  // Coup critique (6.25% de base, 12.5% si high-crit)
  const critRate = move.crit === 2 ? 0.125 : 0.0625;
  const isCrit = Math.random() < critRate;
  const critMult = isCrit ? 1.5 : 1.0;

  // STAB (Same-Type Attack Bonus)
  const isStab = attacker.types.includes(move.type);
  const stabMult = isStab ? 1.5 : 1.0;

  // Efficacité des types
  const typeMult = getEffectiveness(move.type, defender.types);

  if (typeMult === 0) {
    return { damage: 0, mult: 0, crit: false, text: "Ça n'affecte pas le Pokémon adverse..." };
  }

  // Variation aléatoire entre 0.85 et 1.00
  const randomFactor = 0.85 + Math.random() * 0.15;

  // Formule officielle de base niveau 50 : ((22 * Power * (A / D)) / 50 + 2)
  const baseDmg = ((22 * move.power * (atk / def)) / 50 + 2);
  const totalDmg = Math.max(1, Math.floor(baseDmg * stabMult * typeMult * critMult * randomFactor));

  let text = '';
  if (typeMult >= 2) text = "C'est super efficace !";
  else if (typeMult <= 0.5) text = "Ce n'est pas très efficace...";
  if (isCrit) text = (text ? text + ' ' : '') + 'Coup critique !';

  return { damage: totalDmg, mult: typeMult, crit: isCrit, text };
}

/**
 * Résolution complète d'un tour de combat (actions des deux côtés)
 */
export function resolveTurn(state, actionA, actionB) {
  const events = [];
  const logEvent = (e) => events.push(e);

  let pA = getActivePokemon(state, 'A');
  let pB = getActivePokemon(state, 'B');
  const tA = getTrainer(state, 'A');
  const tB = getTrainer(state, 'B');

  // --- 1. Gestion des Switchs volontaires (priorité absolue) ---
  if (actionA && actionA.type === 'switch') {
    const targetIdx = actionA.targetIndex;
    if (targetIdx !== state.activeA && state.teamA[targetIdx] && !state.teamA[targetIdx].fainted) {
      state.activeA = targetIdx;
      pA = state.teamA[targetIdx];
      pA.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      logEvent({ type: 'switch', side: 'A', pokemonId: pA.id, name: pA.name, trainer: tA.name, msg: `${tA.name} rappelle son Pokémon et envoie ${pA.name} !` });
    }
  }

  if (actionB && actionB.type === 'switch') {
    const targetIdx = actionB.targetIndex;
    if (targetIdx !== state.activeB && state.teamB[targetIdx] && !state.teamB[targetIdx].fainted) {
      state.activeB = targetIdx;
      pB = state.teamB[targetIdx];
      pB.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      logEvent({ type: 'switch', side: 'B', pokemonId: pB.id, name: pB.name, trainer: tB.name, msg: `${tB.name} rappelle son Pokémon et envoie ${pB.name} !` });
    }
  }

  // --- 2. Détermination de l'ordre d'attaque ---
  let firstSide = 'A';
  const moveA = actionA && actionA.type === 'move' ? MOVES[actionA.moveId] : null;
  const moveB = actionB && actionB.type === 'move' ? MOVES[actionB.moveId] : null;

  if (moveA && moveB) {
    const prioA = moveA.priority || 0;
    const prioB = moveB.priority || 0;
    if (prioA !== prioB) {
      firstSide = prioA > prioB ? 'A' : 'B';
    } else {
      const spdA = getEffectiveSpeed(pA);
      const spdB = getEffectiveSpeed(pB);
      if (spdA !== spdB) {
        firstSide = spdA > spdB ? 'A' : 'B';
      } else {
        firstSide = Math.random() < 0.5 ? 'A' : 'B';
      }
    }
  } else if (!moveA && moveB) {
    firstSide = 'B';
  } else {
    firstSide = 'A';
  }

  const secondSide = firstSide === 'A' ? 'B' : 'A';

  // --- 3. Exécution d'une attaque ---
  function executeMove(attSide, defSide) {
    const attPoke = getActivePokemon(state, attSide);
    const defPoke = getActivePokemon(state, defSide);
    const attAction = attSide === 'A' ? actionA : actionB;
    const attMove = attAction && attAction.type === 'move' ? MOVES[attAction.moveId] : null;

    if (!attMove || attPoke.fainted || defPoke.fainted) return;

    // Vérification du statut de l'attaquant (paralysie, sommeil, gel)
    if (attPoke.status === 'paralysis' && Math.random() < 0.25) {
      logEvent({ type: 'msg', text: `${attPoke.name} est paralysé ! Il ne peut pas attaquer !` });
      return;
    }
    if (attPoke.status === 'sleep') {
      logEvent({ type: 'msg', text: `${attPoke.name} dort profondément...` });
      return;
    }
    if (attPoke.status === 'freeze') {
      logEvent({ type: 'msg', text: `${attPoke.name} est gelé et ne peut pas bouger !` });
      return;
    }

    logEvent({
      type: 'attack_start',
      side: attSide,
      pokemonId: attPoke.id,
      moveName: attMove.name,
      moveType: attMove.type,
      msg: `${attPoke.name} utilise ${attMove.name} !`
    });

    // Test de précision
    const acc = attMove.acc || 100;
    if (acc < 100 && Math.random() * 100 > acc) {
      logEvent({ type: 'msg', text: `Mais l'attaque a échoué !` });
      return;
    }

    // Gestion du soin (Recover, Roost, etc.)
    if (attMove.effect && attMove.effect.type === 'heal') {
      const healAmount = Math.floor(attPoke.maxHp * attMove.effect.val);
      attPoke.hp = Math.min(attPoke.maxHp, attPoke.hp + healAmount);
      logEvent({
        type: 'heal',
        side: attSide,
        pokemonId: attPoke.id,
        hp: attPoke.hp,
        maxHp: attPoke.maxHp,
        amount: healAmount,
        msg: `${attPoke.name} récupère des PV !`
      });
      return;
    }

    // Gestion des boosts de stats purs (Danse Lames, Machination, etc.)
    if (attMove.cat === 'status' && attMove.effect && attMove.effect.type === 'stat') {
      const eff = attMove.effect;
      const targetPoke = eff.target === 'self' ? attPoke : defPoke;
      const targetSide = eff.target === 'self' ? attSide : defSide;
      targetPoke.statStages[eff.stat] = Math.max(-6, Math.min(6, (targetPoke.statStages[eff.stat] || 0) + eff.val));
      const statLabel = { atk: 'Attaque', def: 'Défense', spa: 'Att. Spé.', spd: 'Déf. Spé.', spe: 'Vitesse' }[eff.stat] || eff.stat;
      const upDown = eff.val > 0 ? (eff.val >= 2 ? 'augmente beaucoup !' : 'augmente !') : 'diminue !';
      logEvent({
        type: 'stat_change',
        side: targetSide,
        msg: `${statLabel} de ${targetPoke.name} ${upDown}`
      });
      return;
    }

    // Gestion des statuts purs (Cage-Éclair, Feu Follet, Toxik, Spore)
    if (attMove.cat === 'status' && attMove.effect && attMove.effect.type === 'status') {
      const st = attMove.effect.status;
      if (!defPoke.status) {
        defPoke.status = st;
        const stLabel = { paralysis: 'est paralysé', burn: 'est brûlé', poison: 'est empoisonné', toxic: 'est gravement empoisonné', sleep: 's\'endort' }[st] || 'souffre d\'un statut';
        logEvent({
          type: 'status_applied',
          side: defSide,
          status: st,
          msg: `${defPoke.name} ${stLabel} !`
        });
      } else {
        logEvent({ type: 'msg', text: `Mais cela n'a aucun effet !` });
      }
      return;
    }

    // Calcul des dégâts
    const res = calculateDamage(attPoke, defPoke, attMove);

    if (res.mult === 0) {
      logEvent({ type: 'msg', text: res.text });
      return;
    }

    defPoke.hp = Math.max(0, defPoke.hp - res.damage);

    logEvent({
      type: 'damage',
      attSide,
      defSide,
      moveName: attMove.name,
      moveType: attMove.type,
      damage: res.damage,
      defHp: defPoke.hp,
      defMaxHp: defPoke.maxHp,
      crit: res.crit,
      mult: res.mult,
      msg: res.text || null
    });

    // Effet drain (Giga-Sangsue, Vampi-Poing)
    if (attMove.drain && res.damage > 0) {
      const drainAmount = Math.floor(res.damage * attMove.drain);
      attPoke.hp = Math.min(attPoke.maxHp, attPoke.hp + drainAmount);
      logEvent({
        type: 'heal',
        side: attSide,
        pokemonId: attPoke.id,
        hp: attPoke.hp,
        maxHp: attPoke.maxHp,
        amount: drainAmount,
        msg: `${attPoke.name} draine l'énergie adverse !`
      });
    }

    // Effet contrecoup (Boutefeu, Rapace, Éclair Fou)
    if (attMove.recoil && res.damage > 0) {
      const recoilDmg = Math.max(1, Math.floor(res.damage * attMove.recoil));
      attPoke.hp = Math.max(0, attPoke.hp - recoilDmg);
      logEvent({
        type: 'recoil',
        side: attSide,
        damage: recoilDmg,
        hp: attPoke.hp,
        maxHp: attPoke.maxHp,
        msg: `${attPoke.name} subit le contrecoup !`
      });
      if (attPoke.hp === 0) {
        attPoke.fainted = true;
        logEvent({ type: 'faint', side: attSide, pokemonId: attPoke.id, name: attPoke.name, msg: `${attPoke.name} est K.O. !` });
      }
    }

    // K.O. du défenseur
    if (defPoke.hp === 0) {
      defPoke.fainted = true;
      logEvent({ type: 'faint', side: defSide, pokemonId: defPoke.id, name: defPoke.name, msg: `${defPoke.name} ennemi est K.O. !` });
      return;
    }

    // Effet secondaire de statut (ex: Brûlure sur Lance-Flammes 10%)
    if (attMove.effect && attMove.effect.type === 'status' && !defPoke.status) {
      if (Math.random() * 100 < (attMove.effect.chance || 10)) {
        defPoke.status = attMove.effect.status;
        const stLabel = { paralysis: 'est paralysé', burn: 'est brûlé', poison: 'est empoisonné', freeze: 'est gelé' }[defPoke.status];
        if (stLabel) {
          logEvent({ type: 'status_applied', side: defSide, status: defPoke.status, msg: `${defPoke.name} ${stLabel} !` });
        }
      }
    }
  }

  // Exécution premier attaquant
  executeMove(firstSide, secondSide);

  // Exécution second attaquant si encore en vie
  executeMove(secondSide, firstSide);

  // --- 4. Dégâts de statut de fin de tour (Brûlure, Poison) ---
  for (const side of ['A', 'B']) {
    const poke = getActivePokemon(state, side);
    if (!poke || poke.fainted) continue;

    if (poke.status === 'burn') {
      const burnDmg = Math.max(1, Math.floor(poke.maxHp / 16));
      poke.hp = Math.max(0, poke.hp - burnDmg);
      logEvent({ type: 'status_damage', side, damage: burnDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `${poke.name} souffre de sa brûlure !` });
    } else if (poke.status === 'poison' || poke.status === 'toxic') {
      const poisonDmg = Math.max(1, Math.floor(poke.maxHp / 8));
      poke.hp = Math.max(0, poke.hp - poisonDmg);
      logEvent({ type: 'status_damage', side, damage: poisonDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `${poke.name} souffre du poison !` });
    }

    if (poke.hp === 0 && !poke.fainted) {
      poke.fainted = true;
      logEvent({ type: 'faint', side, pokemonId: poke.id, name: poke.name, msg: `${poke.name} est K.O. !` });
    }
  }

  // --- 5. Vérification de fin de match ou de switch forcé ---
  const allFaintedA = state.teamA.every(p => p.fainted);
  const allFaintedB = state.teamB.every(p => p.fainted);

  if (allFaintedA || allFaintedB) {
    state.phase = 'over';
    state.winner = allFaintedA && allFaintedB ? 'tie' : allFaintedA ? 'B' : 'A';
    const winTrainer = state.winner === 'A' ? tA : tB;
    logEvent({
      type: 'victory',
      winner: state.winner,
      trainerName: winTrainer.name,
      msg: state.winner === 'tie' ? "Match nul épique !" : `Victoire éclatante de ${winTrainer.name} !`
    });
  } else {
    const curA = getActivePokemon(state, 'A');
    const curB = getActivePokemon(state, 'B');
    if (curA.fainted && curB.fainted) {
      state.phase = 'switch_forced_both';
    } else if (curA.fainted) {
      state.phase = 'switch_forced_A';
    } else if (curB.fainted) {
      state.phase = 'switch_forced_B';
    } else {
      state.phase = 'choose';
      state.turn++;
    }
  }

  state.log = events;
  return { state, events };
}

/**
 * Switch forcé après qu'un Pokémon soit tombé K.O.
 */
export function forceSwitch(state, side, targetIdx) {
  const team = side === 'A' ? state.teamA : state.teamB;
  if (!team[targetIdx] || team[targetIdx].fainted) return false;

  if (side === 'A') state.activeA = targetIdx;
  else state.activeB = targetIdx;

  const nextPoke = team[targetIdx];
  nextPoke.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  const trainer = getTrainer(state, side);
  const event = {
    type: 'switch',
    side,
    pokemonId: nextPoke.id,
    name: nextPoke.name,
    trainer: trainer.name,
    msg: `${trainer.name} envoie ${nextPoke.name} au combat !`
  };

  // Mise à jour de la phase
  if (state.phase === 'switch_forced_both') {
    state.phase = side === 'A' ? 'switch_forced_B' : 'switch_forced_A';
  } else {
    state.phase = 'choose';
    state.turn++;
  }

  state.log = [event];
  return event;
}
