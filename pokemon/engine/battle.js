// pokemon/engine/battle.js
// Moteur de combat Pokémon 3v3 & Duel : calcul des dégâts, statuts (sommeil, dégel, toxik),
// peur (flinch), paliers de statistiques, PP réels, switchs et résolution séquentielle de tour.

import { getEffectiveness } from './types.js';
import { MOVES } from './moves.js';
import { turnMs } from './timing.js';
import { ITEMS, CHOICE } from './items.js';

export const STAGE_MULTS = {
  '-6': 2 / 8, '-5': 2 / 7, '-4': 2 / 6, '-3': 2 / 5, '-2': 2 / 4, '-1': 2 / 3,
  '0': 1,
  '1': 3 / 2, '2': 4 / 2, '3': 5 / 2, '4': 6 / 2, '5': 7 / 2, '6': 8 / 2
};

const STAT_LABELS = {
  atk: 'Attaque',
  def: 'Défense',
  spa: 'Att. Spé.',
  spd: 'Déf. Spé.',
  spe: 'Vitesse'
};

function initPpMap(moves) {
  const map = {};
  for (const mId of (moves || [])) {
    const m = MOVES[mId];
    map[mId] = m && m.pp ? m.pp : 15;
  }
  return map;
}

export function createBattle({ trainerA, trainerB, teamA, teamB }) {
  return {
    trainerA: { id: trainerA.id, name: trainerA.name, color: trainerA.color || '#ff4b2b', bot: !!trainerA.bot },
    trainerB: { id: trainerB.id, name: trainerB.name, color: trainerB.color || '#2b8cff', bot: !!trainerB.bot },
    teamA: teamA.map(p => ({
      ...p,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(p.statStages || {}) },
      ppMap: p.ppMap ? { ...p.ppMap } : initPpMap(p.moves),
      sleepTurns: p.sleepTurns || 0,
      toxicTurns: p.toxicTurns || 0
    })),
    teamB: teamB.map(p => ({
      ...p,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(p.statStages || {}) },
      ppMap: p.ppMap ? { ...p.ppMap } : initPpMap(p.moves),
      sleepTurns: p.sleepTurns || 0,
      toxicTurns: p.toxicTurns || 0
    })),
    activeA: 0,
    activeB: 0,
    turn: 1,
    phase: 'choose', // 'choose', 'switch_forced_A', 'switch_forced_B', 'switch_forced_both', 'over'
    winner: null,
    log: [],
    history: []
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
  const stage = (poke.statStages && poke.statStages.spe) || 0;
  spe *= (STAGE_MULTS[stage] || 1);
  if (poke.status === 'paralysis') spe *= 0.5;
  if (poke.item === 'choicescarf') spe *= 1.5;
  return spe;
}

export function getEffectiveStat(poke, statName) {
  let val = poke.stats[statName] || 100;
  const stage = (poke.statStages && poke.statStages[statName]) || 0;
  val *= (STAGE_MULTS[stage] || 1);
  return Math.max(1, val);
}

/**
 * Calcul des dégâts selon la formule standard Pokémon
 */
export function calculateDamage(attacker, defender, move) {
  if (!move || move.cat === 'status' || !move.power || move.power === 0) {
    return { damage: 0, mult: 1, crit: false, text: '' };
  }

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

  // En cas de coup critique, ignorer les baisses d'attaque du lanceur et les hausses de défense de la cible
  if (isCrit) {
    const atkStage = (attacker.statStages && attacker.statStages[isPhys ? 'atk' : 'spa']) || 0;
    const defStage = (defender.statStages && defender.statStages[isPhys ? 'def' : 'spd']) || 0;
    if (atkStage < 0) atk = attacker.stats[isPhys ? 'atk' : 'spa'] * (isPhys && attacker.status === 'burn' ? 0.5 : 1);
    if (defStage > 0) def = defender.stats[isPhys ? 'def' : 'spd'];
  }

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

  // Formule officielle selon le niveau (défaut 50 en Tournoi)
  const lvl = attacker.level || 50;
  const levelFactor = Math.floor((2 * lvl) / 5) + 2;
  const baseDmg = ((levelFactor * move.power * (atk / def)) / 50 + 2);
  // objets tenus de l'attaquant
  let itemMult = 1;
  if (attacker.item === 'choiceband' && isPhys) itemMult *= 1.5;
  if (attacker.item === 'choicespecs' && !isPhys) itemMult *= 1.5;
  if (attacker.item === 'lifeorb') itemMult *= 1.3;
  if (attacker.item === 'expertbelt' && typeMult >= 2) itemMult *= 1.2;
  const totalDmg = Math.max(1, Math.floor(baseDmg * stabMult * typeMult * critMult * randomFactor * itemMult));

  let text = '';
  if (typeMult >= 2) text = "C'est super efficace !";
  else if (typeMult <= 0.5) text = "Ce n'est pas très efficace...";
  if (isCrit) text = (text ? text + ' ' : '') + 'Coup critique !';

  return { damage: totalDmg, mult: typeMult, crit: isCrit, text };
}

function applyStatEffect(eff, attPoke, defPoke, attSide, defSide, logEvent) {
  const targetPoke = eff.target === 'self' ? attPoke : defPoke;
  const targetSide = eff.target === 'self' ? attSide : defSide;
  if (!targetPoke || targetPoke.fainted) return;
  if (!targetPoke.statStages) targetPoke.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  const statChanges = eff.stats ? Object.entries(eff.stats) : [[eff.stat, eff.val]];
  for (const [stName, delta] of statChanges) {
    const oldVal = targetPoke.statStages[stName] || 0;
    const newVal = Math.max(-6, Math.min(6, oldVal + delta));
    targetPoke.statStages[stName] = newVal;
    const label = STAT_LABELS[stName] || stName;
    if (newVal === oldVal) {
      logEvent({
        type: 'msg',
        text: `${label} de ${targetPoke.name} ne peut pas aller plus ${delta > 0 ? 'haut' : 'bas'} !`
      });
    } else {
      const upDown = delta > 0 ? (delta >= 2 ? 'augmente beaucoup !' : 'augmente !') : (delta <= -2 ? 'diminue beaucoup !' : 'diminue !');
      logEvent({
        type: 'stat_change',
        side: targetSide,
        stat: stName,
        val: delta,
        msg: `${label} de ${targetPoke.name} ${upDown}`
      });
    }
  }
}

/** Baies (une seule fois) : Sitrus sous la moitié des PV, Prine dès qu'un statut tombe. */
function checkBerries(poke, side, logEvent) {
  if (!poke || poke.fainted || poke.hp <= 0 || poke.itemUsed) return;
  if (poke.item === 'sitrus' && poke.hp <= poke.maxHp / 2) {
    poke.itemUsed = true;
    const amount = Math.min(poke.maxHp - poke.hp, Math.floor(poke.maxHp / 4));
    poke.hp += amount;
    logEvent({ type: 'item', side, item: 'sitrus', msg: `${poke.name} mange sa ${ITEMS.sitrus.name} !` });
    logEvent({ type: 'heal', side, pokemonId: poke.id, hp: poke.hp, maxHp: poke.maxHp, amount, msg: `${poke.name} récupère ${amount} PV !` });
  } else if (poke.item === 'lum' && poke.status) {
    poke.itemUsed = true;
    poke.status = null; poke.sleepTurns = 0; poke.toxicTurns = 0;
    logEvent({ type: 'item', side, item: 'lum', msg: `${poke.name} mange sa ${ITEMS.lum.name} !` });
    logEvent({ type: 'status_cured', side, msg: `${poke.name} est guéri !` });
  }
}

/** Remise à zéro en entrant au combat (le blocage des objets Choix tombe en changeant de Pokémon). */
function onSwitchIn(poke) { poke.choiceLock = null; }

/**
 * Résolution complète d'un tour de combat (actions des deux côtés)
 */
export function resolveTurn(state, actionA, actionB) {
  const events = [];
  const logEvent = (e) => {
    events.push(e);
    if (state.history) {
      const txt = e.msg || e.text;
      if (txt) state.history.push({ turn: state.turn, text: txt, type: e.type });
    }
  };

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
      pA.toxicTurns = 0;
      onSwitchIn(pA);
      logEvent({
        type: 'switch',
        side: 'A',
        pokemonId: pA.id,
        name: pA.name,
        hp: pA.hp,
        maxHp: pA.maxHp,
        types: pA.types,
        status: pA.status || null,
        trainer: tA.name,
        msg: `${tA.name} rappelle son Pokémon et envoie ${pA.name} !`
      });
    }
  }

  if (actionB && actionB.type === 'switch') {
    const targetIdx = actionB.targetIndex;
    if (targetIdx !== state.activeB && state.teamB[targetIdx] && !state.teamB[targetIdx].fainted) {
      state.activeB = targetIdx;
      pB = state.teamB[targetIdx];
      pB.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      pB.toxicTurns = 0;
      onSwitchIn(pB);
      logEvent({
        type: 'switch',
        side: 'B',
        pokemonId: pB.id,
        name: pB.name,
        hp: pB.hp,
        maxHp: pB.maxHp,
        types: pB.types,
        status: pB.status || null,
        trainer: tB.name,
        msg: `${tB.name} rappelle son Pokémon et envoie ${pB.name} !`
      });
    }
  }

  // --- 2. Détermination de l'ordre d'attaque ---
  // objets Choix : le Pokémon ne peut lancer que l'attaque sur laquelle il est bloqué (tant qu'elle a des PP)
  const lockTo = (act, poke) => {
    if (!act || act.type !== 'move' || !poke || !CHOICE.has(poke.item) || !poke.choiceLock) return act;
    const pp = poke.ppMap ? poke.ppMap[poke.choiceLock] : 1;
    return poke.moves.includes(poke.choiceLock) && pp > 0 ? { ...act, moveId: poke.choiceLock } : act;
  };
  actionA = lockTo(actionA, pA); actionB = lockTo(actionB, pB);

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
  const flinched = { A: false, B: false };

  // --- 3. Exécution d'une attaque ---
  function executeMove(attSide, defSide, isFirstMover) {
    const attPoke = getActivePokemon(state, attSide);
    const defPoke = getActivePokemon(state, defSide);
    const attAction = attSide === 'A' ? actionA : actionB;
    const moveId = attAction && attAction.type === 'move' ? attAction.moveId : null;
    const attMove = moveId ? MOVES[moveId] : null;

    if (!attMove || attPoke.fainted || defPoke.fainted) return;

    // Vérifier si apeuré (flinch) par la première attaque
    if (flinched[attSide]) {
      logEvent({ type: 'msg', text: `${attPoke.name} a peur et ne peut pas attaquer !` });
      return;
    }

    // Gestion du Sommeil (1 à 3 tours)
    if (attPoke.status === 'sleep') {
      if ((attPoke.sleepTurns || 0) <= 0) {
        attPoke.status = null;
        attPoke.sleepTurns = 0;
        logEvent({ type: 'status_cured', side: attSide, msg: `${attPoke.name} se réveille !` });
      } else {
        attPoke.sleepTurns--;
        logEvent({ type: 'msg', text: `${attPoke.name} dort profondément...` });
        return;
      }
    }

    // Gestion du Gel (20% de chance de dégeler par tour, ou attaque Feu du lanceur)
    if (attPoke.status === 'freeze') {
      if (Math.random() < 0.20 || attMove.type === 'fire') {
        attPoke.status = null;
        logEvent({ type: 'status_cured', side: attSide, msg: `${attPoke.name} dégèle !` });
      } else {
        logEvent({ type: 'msg', text: `${attPoke.name} est gelé et ne peut pas bouger !` });
        return;
      }
    }

    // Gestion de la Paralysie (25% d'immobilisation)
    if (attPoke.status === 'paralysis' && Math.random() < 0.25) {
      logEvent({ type: 'msg', text: `${attPoke.name} est paralysé ! Il ne peut pas attaquer !` });
      return;
    }

    // Décrémenter les PP
    if (attPoke.ppMap && attPoke.ppMap[moveId] !== undefined) {
      attPoke.ppMap[moveId] = Math.max(0, attPoke.ppMap[moveId] - 1);
    }
    if (CHOICE.has(attPoke.item) && !attPoke.choiceLock) attPoke.choiceLock = moveId;

    logEvent({
      type: 'attack_start',
      side: attSide,
      pokemonId: attPoke.id,
      attName: attPoke.name,
      moveName: attMove.name,
      moveType: attMove.type,
      moveCat: attMove.cat,
      msg: `${attPoke.name} utilise ${attMove.name} !`
    });

    // Trempette
    if (moveId === 'splash') {
      logEvent({ type: 'msg', text: `Mais rien ne se passe !` });
      return;
    }

    // Test de précision
    const acc = attMove.acc || 100;
    if (acc < 100 && Math.random() * 100 > acc) {
      logEvent({ type: 'msg', text: `Mais l'attaque de ${attPoke.name} a échoué !` });
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
        msg: `${attPoke.name} récupère ${healAmount} PV !`
      });
      return;
    }

    // Gestion des boosts/baisses de stats purs (Danse Lames, Danse Draco, Rugissement...)
    if (attMove.cat === 'status' && attMove.effect && attMove.effect.type === 'stat') {
      applyStatEffect(attMove.effect, attPoke, defPoke, attSide, defSide, logEvent);
      return;
    }

    // Gestion des statuts purs (Cage-Éclair, Feu Follet, Toxik, Spore, Hypnose)
    if (attMove.cat === 'status' && attMove.effect && attMove.effect.type === 'status') {
      const st = attMove.effect.status;
      // Immunités naturelles de type aux statuts
      const immune =
        (st === 'burn' && defPoke.types.includes('fire')) ||
        (st === 'paralysis' && (defPoke.types.includes('electric') || (attMove.type === 'electric' && defPoke.types.includes('ground')))) ||
        ((st === 'poison' || st === 'toxic') && (defPoke.types.includes('poison') || defPoke.types.includes('steel'))) ||
        (st === 'sleep' && attMove.type === 'grass' && defPoke.types.includes('grass'));

      if (immune) {
        logEvent({ type: 'msg', text: `Ça n'affecte pas ${defPoke.name}...` });
      } else if (!defPoke.status) {
        defPoke.status = st;
        if (st === 'sleep') defPoke.sleepTurns = 1 + Math.floor(Math.random() * 2); // 1 à 2 tours
        if (st === 'toxic') defPoke.toxicTurns = 1;
        const stLabel = { paralysis: 'est paralysé', burn: 'est brûlé', poison: 'est empoisonné', toxic: 'est gravement empoisonné', sleep: "s'endort" }[st] || "souffre d'un statut";
        logEvent({
          type: 'status_applied',
          side: defSide,
          status: st,
          msg: `${defPoke.name} ${stLabel} !`
        });
        checkBerries(defPoke, defSide, logEvent);
      } else {
        logEvent({ type: 'msg', text: `Mais ${defPoke.name} a déjà un statut !` });
      }
      return;
    }

    // Calcul des dégâts
    const res = calculateDamage(attPoke, defPoke, attMove);

    if (res.mult === 0) {
      logEvent({ type: 'msg', text: res.text });
      return;
    }

    // Ceinture Force : à PV pleins, un coup fatal laisse 1 PV (une fois)
    let sashed = false;
    if (defPoke.item === 'focussash' && !defPoke.itemUsed && defPoke.hp === defPoke.maxHp && res.damage >= defPoke.hp) {
      res.damage = defPoke.hp - 1; defPoke.itemUsed = true; sashed = true;
    }
    defPoke.hp = Math.max(0, defPoke.hp - res.damage);

    // Une attaque de type Feu dégèle la cible si elle était gelée
    if (defPoke.status === 'freeze' && attMove.type === 'fire' && defPoke.hp > 0) {
      defPoke.status = null;
      logEvent({ type: 'status_cured', side: defSide, msg: `La chaleur dégèle ${defPoke.name} !` });
    }

    logEvent({
      type: 'damage',
      attSide,
      defSide,
      attName: attPoke.name,
      defName: defPoke.name,
      moveName: attMove.name,
      moveType: attMove.type,
      damage: res.damage,
      defHp: defPoke.hp,
      defMaxHp: defPoke.maxHp,
      crit: res.crit,
      mult: res.mult,
      msg: res.text || null
    });
    if (sashed) logEvent({ type: 'item', side: defSide, item: 'focussash', msg: `${defPoke.name} tient bon grâce à sa ${ITEMS.focussash.name} !` });
    checkBerries(defPoke, defSide, logEvent);

    // Effet drain (Giga-Sangsue, Vampi-Poing)
    if (attMove.drain && res.damage > 0) {
      const drainAmount = Math.max(1, Math.floor(res.damage * attMove.drain));
      attPoke.hp = Math.min(attPoke.maxHp, attPoke.hp + drainAmount);
      logEvent({
        type: 'heal',
        side: attSide,
        pokemonId: attPoke.id,
        hp: attPoke.hp,
        maxHp: attPoke.maxHp,
        amount: drainAmount,
        msg: `${attPoke.name} draine ${drainAmount} PV à ${defPoke.name} !`
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
        msg: `${attPoke.name} subit ${recoilDmg} PV de contrecoup !`
      });
      if (attPoke.hp === 0) {
        attPoke.fainted = true;
        logEvent({ type: 'faint', side: attSide, pokemonId: attPoke.id, name: attPoke.name, msg: `${attPoke.name} est K.O. !` });
      }
    }

    // Orbe Vie : 1/10 des PV du lanceur à chaque coup porté
    if (attPoke.item === 'lifeorb' && res.damage > 0 && !attPoke.fainted) {
      const cost = Math.max(1, Math.floor(attPoke.maxHp / 10));
      attPoke.hp = Math.max(0, attPoke.hp - cost);
      logEvent({ type: 'recoil', side: attSide, damage: cost, hp: attPoke.hp, maxHp: attPoke.maxHp, item: 'lifeorb', msg: `${attPoke.name} perd un peu de PV à cause de l'${ITEMS.lifeorb.name} !` });
      if (attPoke.hp === 0) {
        attPoke.fainted = true;
        logEvent({ type: 'faint', side: attSide, pokemonId: attPoke.id, name: attPoke.name, msg: `${attPoke.name} est K.O. !` });
      }
    }
    checkBerries(attPoke, attSide, logEvent);

    // Effet de stat sur le lanceur même si le défenseur tombe K.O. (Close Combat, Draco-Météore, Surpuissance)
    if (attMove.effect && attMove.effect.type === 'stat' && attMove.effect.target === 'self' && !attPoke.fainted) {
      applyStatEffect(attMove.effect, attPoke, defPoke, attSide, defSide, logEvent);
    }

    // K.O. du défenseur
    if (defPoke.hp === 0) {
      defPoke.fainted = true;
      logEvent({ type: 'faint', side: defSide, pokemonId: defPoke.id, name: defPoke.name, msg: `${defPoke.name} est K.O. !` });
      return;
    }

    // Effet secondaire de baisse de stat sur la cible (Psyko, Ball'Ombre, Mâchouille, Piétinement, Écume)
    if (attMove.effect && attMove.effect.type === 'stat' && attMove.effect.target === 'opponent') {
      const chance = attMove.effect.chance || 100;
      if (Math.random() * 100 < chance) {
        applyStatEffect(attMove.effect, attPoke, defPoke, attSide, defSide, logEvent);
      }
    }

    // Effet secondaire de statut (ex: Brûlure sur Lance-Flammes 10%, Paralysie sur Tonnerre 10%)
    if (attMove.effect && attMove.effect.type === 'status' && !defPoke.status) {
      const st = attMove.effect.status;
      const immune =
        (st === 'burn' && defPoke.types.includes('fire')) ||
        (st === 'paralysis' && defPoke.types.includes('electric')) ||
        (st === 'freeze' && defPoke.types.includes('ice')) ||
        (st === 'poison' && (defPoke.types.includes('poison') || defPoke.types.includes('steel')));

      if (!immune && Math.random() * 100 < (attMove.effect.chance || 10)) {
        defPoke.status = st;
        const stLabel = { paralysis: 'est paralysé', burn: 'est brûlé', poison: 'est empoisonné', freeze: 'est gelé' }[defPoke.status];
        if (stLabel) {
          logEvent({ type: 'status_applied', side: defSide, status: defPoke.status, msg: `${defPoke.name} ${stLabel} !` });
        }
        checkBerries(defPoke, defSide, logEvent);
      }
    }

    // Effet secondaire de Peur (Flinch) si l'attaquant agit en premier
    if (isFirstMover && attMove.flinch && Math.random() * 100 < attMove.flinch) {
      flinched[defSide] = true;
    }
  }

  // Exécution premier attaquant
  executeMove(firstSide, secondSide, true);

  // Exécution second attaquant si encore en vie
  executeMove(secondSide, firstSide, false);

  // --- 4. Dégâts de statut de fin de tour (Brûlure, Poison, Toxik progressif) ---
  for (const side of ['A', 'B']) {
    const poke = getActivePokemon(state, side);
    if (!poke || poke.fainted) continue;

    if (poke.status === 'burn') {
      const burnDmg = Math.max(1, Math.floor(poke.maxHp / 16));
      poke.hp = Math.max(0, poke.hp - burnDmg);
      logEvent({ type: 'status_damage', side, damage: burnDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `${poke.name} souffre de sa brûlure (-${burnDmg} PV) !` });
    } else if (poke.status === 'poison') {
      const poisonDmg = Math.max(1, Math.floor(poke.maxHp / 8));
      poke.hp = Math.max(0, poke.hp - poisonDmg);
      logEvent({ type: 'status_damage', side, damage: poisonDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `${poke.name} souffre du poison (-${poisonDmg} PV) !` });
    } else if (poke.status === 'toxic') {
      poke.toxicTurns = (poke.toxicTurns || 1);
      const toxicDmg = Math.max(1, Math.floor((poke.maxHp * poke.toxicTurns) / 16));
      poke.toxicTurns = Math.min(15, poke.toxicTurns + 1);
      poke.hp = Math.max(0, poke.hp - toxicDmg);
      logEvent({ type: 'status_damage', side, damage: toxicDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `Le venin ronge gravement ${poke.name} (-${toxicDmg} PV) !` });
    }

    if (poke.hp === 0 && !poke.fainted) {
      poke.fainted = true;
      logEvent({ type: 'faint', side, pokemonId: poke.id, name: poke.name, msg: `${poke.name} est K.O. !` });
      continue;
    }
    checkBerries(poke, side, logEvent);
    // Restes : 1/16 des PV en fin de tour
    if (poke.item === 'leftovers' && poke.hp < poke.maxHp) {
      const amount = Math.min(poke.maxHp - poke.hp, Math.max(1, Math.floor(poke.maxHp / 16)));
      poke.hp += amount;
      logEvent({ type: 'heal', side, pokemonId: poke.id, hp: poke.hp, maxHp: poke.maxHp, amount, item: 'leftovers', msg: `${poke.name} récupère un peu de PV grâce aux ${ITEMS.leftovers.name} !` });
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
      msg: state.winner === 'tie' ? 'Match nul épique !' : `Victoire éclatante de ${winTrainer.name} !`
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
  nextPoke.toxicTurns = 0;
  onSwitchIn(nextPoke);

  const trainer = getTrainer(state, side);
  const event = {
    type: 'switch',
    side,
    pokemonId: nextPoke.id,
    name: nextPoke.name,
    hp: nextPoke.hp,
    maxHp: nextPoke.maxHp,
    types: nextPoke.types,
    status: nextPoke.status || null,
    trainer: trainer.name,
    msg: `${trainer.name} envoie ${nextPoke.name} au combat !`
  };

  if (state.history) {
    state.history.push({ turn: state.turn, text: event.msg, type: 'switch' });
  }

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

/**
 * Calcule la durée totale en millisecondes pour jouer l'animation séquentielle du tour
 */
export function estimateTurnDuration(events) {
  return turnMs(events);
}
