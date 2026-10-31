// pokemon/engine/battle.js
// Moteur de combat Pokémon 3v3 & Duel : calcul des dégâts, statuts (sommeil, dégel, toxik),
// peur (flinch), paliers de statistiques, PP réels, switchs et résolution séquentielle de tour.

import { getEffectiveness } from './types.js';
import { MOVES } from './moves.js';
import { turnMs } from './timing.js';
import { ITEMS, CHOICE } from './items.js';
import { megasOf } from './megas.js';
const MEGA_FORM = (dex, pid) => megasOf(dex).find((f) => f.pid === pid) || null;
import { ABILITIES, abilityOf, ab, weatherOf, moveTypeFor, attackerPower, attackStatMod, defenseStatMod, defenderDamageMod,
  weatherPower, speedMod, blocksStatus, absorbs, isContact, hasSecondary } from './abilities.js';
const MOVE_ID = new Map(Object.entries(MOVES).map(([k, v]) => [v, k]));
const AN = (k) => (ABILITIES[k] ? ABILITIES[k].name : k);
const WEATHER_TXT = { rain: ['Il commence à pleuvoir !', 'La pluie s\'arrête.'], sun: ['Le soleil brille fort !', 'Le soleil redevient normal.'],
  sand: ['Une tempête de sable se lève !', 'La tempête de sable se calme.'], wind: ['Des vents violents se lèvent !', 'Les vents se calment.'] };

/** Le Pokémon peut-il méga-évoluer maintenant ? (tient sa Méga-Gemme, pas encore Méga, son dresseur ne l'a pas déjà fait) */
export function canMega(state, side, poke) {
  const it = poke && ITEMS[poke.item];
  return !!(it && it.mega && it.mega.dex === poke.id && !poke.isMega && !(state.megaUsed && state.megaUsed[side]) && !poke.fainted);
}

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
      toxicTurns: p.toxicTurns || 0,
      ability: p.ability !== undefined ? p.ability : abilityOf(p.id)
    })),
    teamB: teamB.map(p => ({
      ...p,
      statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0, ...(p.statStages || {}) },
      ppMap: p.ppMap ? { ...p.ppMap } : initPpMap(p.moves),
      sleepTurns: p.sleepTurns || 0,
      toxicTurns: p.toxicTurns || 0,
      ability: p.ability !== undefined ? p.ability : abilityOf(p.id)
    })),
    weather: null,          // { type: 'rain' | 'sun' | 'sand' | 'wind', turns }
    entry: ['A', 'B'],      // talents d'arrivée (Intimidation, météo…) à jouer au début du prochain tour
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

export function getEffectiveSpeed(poke, state) {
  let spe = poke.stats.spe;
  const stage = (poke.statStages && poke.statStages.spe) || 0;
  spe *= (STAGE_MULTS[stage] || 1);
  if (poke.status === 'paralysis' && poke.ability !== 'quick-feet') spe *= 0.5;
  spe *= speedMod(poke, state ? weatherOf(state) : null);
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
export function calculateDamage(attacker, defender, move, state) {
  if (!move || move.cat === 'status' || !move.power || move.power === 0) {
    return { damage: 0, mult: 1, crit: false, text: '' };
  }
  const moveId = MOVE_ID.get(move) || '';
  const weather = state ? weatherOf(state) : null;
  const wAtt = attacker.ability === 'mega-sol' ? 'sun' : weather;   // Méga-Soleil : ses attaques comme au soleil
  const mType = moveTypeFor(attacker, move);

  const isPhys = move.cat === 'physical';
  let atk = getEffectiveStat(attacker, isPhys ? 'atk' : 'spa') * attackStatMod(attacker, isPhys, wAtt);
  let def = getEffectiveStat(defender, isPhys ? 'def' : 'spd') * defenseStatMod(defender, isPhys, weather, attacker);

  // Si brûlé et attaque physique : 50% de dégâts (sauf Cran)
  if (isPhys && attacker.status === 'burn' && attacker.ability !== 'guts') {
    atk *= 0.5;
  }

  // Coup critique (6.25% de base, 12.5% si high-crit ; Chanceux monte d'un cran ; Coque Armure l'empêche)
  const critStage = (move.crit === 2 ? 1 : 0) + (attacker.ability === 'super-luck' ? 1 : 0);
  const critRate = [0.0625, 0.125, 0.5][Math.min(2, critStage)];
  const isCrit = ab(defender, attacker) !== 'shell-armor' && Math.random() < critRate;
  const critMult = isCrit ? 1.5 : 1.0;

  // En cas de coup critique, ignorer les baisses d'attaque du lanceur et les hausses de défense de la cible
  if (isCrit) {
    const atkStage = (attacker.statStages && attacker.statStages[isPhys ? 'atk' : 'spa']) || 0;
    const defStage = (defender.statStages && defender.statStages[isPhys ? 'def' : 'spd']) || 0;
    if (atkStage < 0) atk = attacker.stats[isPhys ? 'atk' : 'spa'] * (isPhys && attacker.status === 'burn' ? 0.5 : 1);
    if (defStage > 0) def = defender.stats[isPhys ? 'def' : 'spd'];
  }

  // STAB (Same-Type Attack Bonus ; ×2 avec Adaptabilité)
  const isStab = attacker.types.includes(mType);
  const stabMult = isStab ? (attacker.ability === 'adaptability' ? 2 : 1.5) : 1.0;

  // Efficacité des types (vents violents : le type Vol n'a plus de faiblesse)
  let typeMult = getEffectiveness(mType, defender.types);
  if (weather === 'wind' && defender.types.includes('flying') && getEffectiveness(mType, ['flying']) > 1) typeMult /= 2;

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
  // talents (puissance, défenseur) et météo
  const abilMult = attackerPower(attacker, moveId, move, weather) * defenderDamageMod(defender, mType, typeMult, attacker) * weatherPower(mType, wAtt);
  const totalDmg = Math.max(1, Math.floor(baseDmg * stabMult * typeMult * critMult * randomFactor * itemMult * abilMult));

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
  const byFoe = eff.target !== 'self' && targetPoke !== attPoke;
  // Corps Sain : l'adversaire ne peut pas baisser ses statistiques
  if (byFoe && ab(targetPoke, attPoke) === 'clear-body' && statChanges.some(([, d]) => d < 0)) {
    logEvent({ type: 'ability', side: targetSide, ability: 'clear-body', msg: `${AN('clear-body')} de ${targetPoke.name} empêche la baisse de ses statistiques !` });
    return;
  }
  let lowered = false;
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
      if (delta < 0) lowered = true;
    }
  }
  // Battant : une baisse infligée par l'adversaire fait monter l'Att. Spé. de deux crans
  if (byFoe && lowered && targetPoke.ability === 'competitive') {
    logEvent({ type: 'ability', side: targetSide, ability: 'competitive', msg: `${AN('competitive')} de ${targetPoke.name} s'active !` });
    applyStatEffect({ target: 'self', stat: 'spa', val: 2 }, targetPoke, null, targetSide, null, logEvent);
  }
}

/** Le talent fait monter (ou baisser) une stat de son porteur */
function selfStat(poke, side, stat, val, logEvent) {
  applyStatEffect({ target: 'self', stat, val }, poke, null, side, null, logEvent);
}

/** Dégâts indirects (statut, contrecoup, sable, Peau Dure…) : Garde Magik les annule. Renvoie true si le Pokémon est K.O. */
function indirect(poke, side, dmg, msg, logEvent, extra = {}) {
  if (!poke || poke.fainted || dmg <= 0 || poke.ability === 'magic-guard') return false;
  poke.hp = Math.max(0, poke.hp - dmg);
  logEvent({ type: 'recoil', side, damage: dmg, hp: poke.hp, maxHp: poke.maxHp, msg, ...extra });
  if (poke.hp === 0) { poke.fainted = true; logEvent({ type: 'faint', side, pokemonId: poke.id, name: poke.name, msg: `${poke.name} est K.O. !` }); return true; }
  return false;
}

/** Peut-on infliger ce statut ? (types immunisés, talents, statut déjà présent) */
function statusAllowed(state, poke, st, moveType) {
  if (!poke || poke.fainted || poke.status) return false;
  const t = poke.types;
  if (st === 'burn' && t.includes('fire')) return false;
  if (st === 'paralysis' && (t.includes('electric') || (moveType === 'electric' && t.includes('ground')))) return false;
  if ((st === 'poison' || st === 'toxic') && (t.includes('poison') || t.includes('steel'))) return false;
  if (st === 'freeze' && t.includes('ice')) return false;
  if (blocksStatus(poke, st, weatherOf(state))) return false;
  return true;
}
const STATUS_TXT = { paralysis: 'est paralysé', burn: 'est brûlé', poison: 'est empoisonné', toxic: 'est gravement empoisonné', sleep: "s'endort", freeze: 'est gelé' };

/** Pose un statut et déclenche ce qui en dépend (Baie Prine, Synchro) */
function inflict(state, poke, side, st, logEvent, from) {
  poke.status = st;
  if (st === 'sleep') poke.sleepTurns = poke.ability === 'early-bird' ? 1 : 1 + Math.floor(Math.random() * 2);
  if (st === 'toxic') poke.toxicTurns = 1;
  logEvent({ type: 'status_applied', side, status: st, msg: `${poke.name} ${STATUS_TXT[st] || "souffre d'un statut"} !` });
  // Synchro : brûlure, paralysie ou poison renvoyés à l'adversaire qui les a infligés
  if (from && poke.ability === 'synchronize' && ['burn', 'paralysis', 'poison', 'toxic'].includes(st) && statusAllowed(state, from.poke, st)) {
    logEvent({ type: 'ability', side, ability: 'synchronize', msg: `${AN('synchronize')} de ${poke.name} s'active !` });
    inflict(state, from.poke, from.side, st, logEvent, null);
  }
  checkBerries(poke, side, logEvent, state);
}

/** Talents qui jouent à l'arrivée au combat (Intimidation, météo, Calque, Ciel Gris) */
function onEntry(state, side, logEvent) {
  const poke = getActivePokemon(state, side), foeSide = side === 'A' ? 'B' : 'A', foe = getActivePokemon(state, foeSide);
  if (!poke || poke.fainted) return;
  let a = poke.ability;
  if (a === 'trace' && foe && foe.ability && !['trace', 'drizzle', 'drought', 'sand-stream', 'delta-stream'].includes(foe.ability)) {
    poke.ability = foe.ability; a = poke.ability;
    logEvent({ type: 'ability', side, ability: 'trace', msg: `${poke.name} copie le talent ${AN(a)} de ${foe.name} !` });
  }
  const weatherOn = { drizzle: 'rain', drought: 'sun', 'sand-stream': 'sand', 'delta-stream': 'wind' }[a];
  if (weatherOn) {
    state.weather = { type: weatherOn, turns: weatherOn === 'wind' ? 99 : 5, by: side };
    logEvent({ type: 'ability', side, ability: a, weather: weatherOn, msg: `${AN(a)} de ${poke.name} : ${WEATHER_TXT[weatherOn][0]}` });
  }
  if (a === 'air-lock') logEvent({ type: 'ability', side, ability: a, msg: `${AN(a)} de ${poke.name} : la météo n'a plus d'effet !` });
  if (a === 'unnerve' || a === 'pressure' || a === 'mold-breaker') logEvent({ type: 'ability', side, ability: a, msg: `${poke.name} a le talent ${AN(a)} !` });
  if (a === 'intimidate' && foe && !foe.fainted) {
    logEvent({ type: 'ability', side, ability: a, msg: `${AN(a)} de ${poke.name} effraie ${foe.name} !` });
    if (['inner-focus', 'clear-body'].includes(foe.ability)) logEvent({ type: 'msg', text: `${foe.name} n'est pas impressionné (${AN(foe.ability)}) !` });
    else applyStatEffect({ target: 'opponent', stat: 'atk', val: -1 }, poke, foe, side, foeSide, logEvent);
  }
}

/** Baies (une seule fois) : Sitrus sous la moitié des PV, Prine dès qu'un statut tombe. */
function checkBerries(poke, side, logEvent, state) {
  if (!poke || poke.fainted || poke.hp <= 0 || poke.itemUsed) return;
  // Tension : l'adversaire empêche de manger les baies
  if (state) { const foe = getActivePokemon(state, side === 'A' ? 'B' : 'A'); if (foe && !foe.fainted && foe.ability === 'unnerve' && (poke.item === 'sitrus' || poke.item === 'lum')) return; }
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

  // --- 0. Talents d'arrivée en attente (début de combat, remplaçant après un K.O.), le plus rapide d'abord ---
  if (state.entry && state.entry.length) {
    const q = [...new Set(state.entry)]; state.entry = [];
    q.sort((x, y) => getEffectiveSpeed(getActivePokemon(state, y), state) - getEffectiveSpeed(getActivePokemon(state, x), state));
    for (const side of q) onEntry(state, side, logEvent);
  }

  // Marque Ombre : l'adversaire ne peut pas changer de Pokémon (sauf les Spectre)
  for (const [side, act] of [['A', actionA], ['B', actionB]]) {
    if (!act || act.type !== 'switch') continue;
    const me = getActivePokemon(state, side), foe = getActivePokemon(state, side === 'A' ? 'B' : 'A');
    if (foe && !foe.fainted && foe.ability === 'shadow-tag' && me && !me.fainted && !me.types.includes('ghost')) {
      logEvent({ type: 'ability', side: side === 'A' ? 'B' : 'A', ability: 'shadow-tag', msg: `${me.name} ne peut pas quitter le combat (${AN('shadow-tag')} de ${foe.name}) !` });
      if (side === 'A') actionA = null; else actionB = null;
    }
  }
  // Régé-Force : en quittant le combat, le Pokémon récupère un tiers de ses PV
  const regen = (poke) => { if (poke && !poke.fainted && poke.ability === 'regenerator' && poke.hp < poke.maxHp) poke.hp = Math.min(poke.maxHp, poke.hp + Math.floor(poke.maxHp / 3)); };

  // --- 1. Gestion des Switchs volontaires (priorité absolue) ---
  if (actionA && actionA.type === 'switch') {
    const targetIdx = actionA.targetIndex;
    if (targetIdx !== state.activeA && state.teamA[targetIdx] && !state.teamA[targetIdx].fainted) {
      regen(pA);
      state.activeA = targetIdx;
      pA = state.teamA[targetIdx];
      pA.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      pA.toxicTurns = 0;
      onSwitchIn(pA);
      logEvent({
        type: 'switch',
        side: 'A',
        pokemonId: pA.id,
        spriteId: pA.spriteId || pA.id,
        name: pA.name,
        hp: pA.hp,
        maxHp: pA.maxHp,
        types: pA.types,
        status: pA.status || null,
        trainer: tA.name,
        msg: `${tA.name} rappelle son Pokémon et envoie ${pA.name} !`
      });
      onEntry(state, 'A', logEvent);
    }
  }

  if (actionB && actionB.type === 'switch') {
    const targetIdx = actionB.targetIndex;
    if (targetIdx !== state.activeB && state.teamB[targetIdx] && !state.teamB[targetIdx].fainted) {
      regen(pB);
      state.activeB = targetIdx;
      pB = state.teamB[targetIdx];
      pB.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
      pB.toxicTurns = 0;
      onSwitchIn(pB);
      logEvent({
        type: 'switch',
        side: 'B',
        pokemonId: pB.id,
        spriteId: pB.spriteId || pB.id,
        name: pB.name,
        hp: pB.hp,
        maxHp: pB.maxHp,
        types: pB.types,
        status: pB.status || null,
        trainer: tB.name,
        msg: `${tB.name} rappelle son Pokémon et envoie ${pB.name} !`
      });
      onEntry(state, 'B', logEvent);
    }
  }

  // --- 1 bis. Méga-Évolution (avant les attaques : la nouvelle Vitesse compte dès ce tour) ---
  for (const [side, act] of [['A', actionA], ['B', actionB]]) {
    const poke = side === 'A' ? pA : pB;
    if (!act || act.type !== 'move' || !act.mega || !canMega(state, side, poke)) continue;
    const m = ITEMS[poke.item].mega, form = MEGA_FORM(poke.id, m.pid);
    if (!form) continue;
    state.megaUsed = { ...(state.megaUsed || {}), [side]: true };
    const before = poke.name;
    poke.isMega = true; poke.spriteId = form.pid; poke.baseName = before; poke.name = form.name;
    poke.types = [...form.types];
    poke.stats = { ...form.stats, hp: poke.stats.hp };   // les PV ne changent pas
    const tr = getTrainer(state, side);
    logEvent({ type: 'mega', side, pokemonId: poke.id, spriteId: form.pid, name: form.name, types: poke.types, trainer: tr.name,
      msg: `${before} réagit à la ${ITEMS[poke.item].name} de ${tr.name} ! ${before} méga-évolue en ${form.name} !` });
    const megaAb = abilityOf(form.pid);
    if (megaAb) poke.ability = megaAb;   // la forme Méga a son propre talent
    onEntry(state, side, logEvent);
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
      const spdA = getEffectiveSpeed(pA, state);
      const spdB = getEffectiveSpeed(pB, state);
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
      if (attPoke.ability === 'steadfast') selfStat(attPoke, attSide, 'spe', 1, logEvent);
      return;
    }
    // Attaque bloquée par Corps Maudit
    if (attPoke.disabled && attPoke.disabled.move === moveId && attPoke.disabled.turns > 0) {
      logEvent({ type: 'msg', text: `${attPoke.name} ne peut pas utiliser ${attMove.name}, elle est bloquée !` });
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
      // Pression : une attaque qui vise ce Pokémon coûte 2 PP
      const cost = defPoke.ability === 'pressure' && !(attMove.effect && attMove.effect.target === 'self' && attMove.cat === 'status') ? 2 : 1;
      attPoke.ppMap[moveId] = Math.max(0, attPoke.ppMap[moveId] - cost);
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

    // Test de précision (Annule Garde : touche à coup sûr, dans les deux sens)
    const acc = attMove.acc || 100;
    const sure = attPoke.ability === 'no-guard' || defPoke.ability === 'no-guard';
    if (!sure && acc < 100 && Math.random() * 100 > acc) {
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

    // Talents qui absorbent ou annulent une attaque de leur type (Lévitation, Torche, Absorb Eau, Paratonnerre…)
    const mType = moveTypeFor(attPoke, attMove);
    const targetsFoe = !(attMove.cat === 'status' && attMove.effect && attMove.effect.target === 'self');
    if (targetsFoe) {
      const abs = absorbs(defPoke, mType, attPoke);
      if (abs) {
        const nm = AN(defPoke.ability);
        if (abs.heal) {
          const amount = Math.min(defPoke.maxHp - defPoke.hp, Math.floor(defPoke.maxHp / 4));
          defPoke.hp += amount;
          logEvent({ type: 'ability', side: defSide, ability: defPoke.ability, msg: `${nm} de ${defPoke.name} absorbe l'attaque !` });
          if (amount > 0) logEvent({ type: 'heal', side: defSide, pokemonId: defPoke.id, hp: defPoke.hp, maxHp: defPoke.maxHp, amount, msg: `${defPoke.name} récupère ${amount} PV !` });
        } else if (abs.boost) {
          logEvent({ type: 'ability', side: defSide, ability: defPoke.ability, msg: `${nm} de ${defPoke.name} attire l'attaque !` });
          selfStat(defPoke, defSide, abs.boost[0], abs.boost[1], logEvent);
        } else if (abs.flashFire) {
          defPoke.flashFire = true;
          logEvent({ type: 'ability', side: defSide, ability: 'flash-fire', msg: `${nm} de ${defPoke.name} s'active : ses attaques Feu sont plus puissantes !` });
        } else {
          logEvent({ type: 'ability', side: defSide, ability: defPoke.ability, msg: `${defPoke.name} ne craint rien grâce à ${nm} !` });
        }
        return;
      }
    }

    // Miroir Magik : les attaques de statut sont renvoyées à l'envoyeur
    let tgtPoke = defPoke, tgtSide = defSide, srcPoke = attPoke, srcSide = attSide;
    if (attMove.cat === 'status' && targetsFoe && ab(defPoke, attPoke) === 'magic-bounce') {
      logEvent({ type: 'ability', side: defSide, ability: 'magic-bounce', msg: `${defPoke.name} renvoie ${attMove.name} grâce à ${AN('magic-bounce')} !` });
      tgtPoke = attPoke; tgtSide = attSide; srcPoke = defPoke; srcSide = defSide;
    }

    // Gestion des boosts/baisses de stats purs (Danse Lames, Danse Draco, Rugissement...)
    if (attMove.cat === 'status' && attMove.effect && attMove.effect.type === 'stat') {
      applyStatEffect(attMove.effect, srcPoke, tgtPoke, srcSide, tgtSide, logEvent);
      return;
    }

    // Gestion des statuts purs (Cage-Éclair, Feu Follet, Toxik, Spore, Hypnose)
    if (attMove.cat === 'status' && attMove.effect && attMove.effect.type === 'status') {
      const st = attMove.effect.status;
      const grassSleep = st === 'sleep' && attMove.type === 'grass' && tgtPoke.types.includes('grass');
      if (tgtPoke.status) {
        logEvent({ type: 'msg', text: `Mais ${tgtPoke.name} a déjà un statut !` });
      } else if (grassSleep || !statusAllowed(state, tgtPoke, st, attMove.type)) {
        logEvent({ type: 'msg', text: `Ça n'affecte pas ${tgtPoke.name}...` });
      } else {
        inflict(state, tgtPoke, tgtSide, st, logEvent, { poke: srcPoke, side: srcSide });
      }
      return;
    }

    // Calcul des dégâts
    const res = calculateDamage(attPoke, defPoke, attMove, state);
    const sheer = attPoke.ability === 'sheer-force' && hasSecondary(attMove);   // Sans Limite : pas d'effet secondaire

    if (res.mult === 0) {
      logEvent({ type: 'msg', text: res.text });
      return;
    }

    // Ceinture Force : à PV pleins, un coup fatal laisse 1 PV (une fois)
    let sashed = false, sturdied = false;
    if (ab(defPoke, attPoke) === 'sturdy' && defPoke.hp === defPoke.maxHp && res.damage >= defPoke.hp) {
      res.damage = defPoke.hp - 1; sturdied = true;   // Fermeté : survit à un coup fatal à PV pleins
    } else if (defPoke.item === 'focussash' && !defPoke.itemUsed && defPoke.hp === defPoke.maxHp && res.damage >= defPoke.hp) {
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
    if (sturdied) logEvent({ type: 'ability', side: defSide, ability: 'sturdy', msg: `${defPoke.name} tient bon grâce à ${AN('sturdy')} !` });
    checkBerries(defPoke, defSide, logEvent, state);

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

    // Effet contrecoup (Boutefeu, Rapace, Éclair Fou) — Tête de Roc : aucun contrecoup ; Garde Magik non plus
    if (attMove.recoil && res.damage > 0 && attPoke.ability !== 'rock-head') {
      const recoilDmg = Math.max(1, Math.floor(res.damage * attMove.recoil));
      indirect(attPoke, attSide, recoilDmg, `${attPoke.name} subit ${recoilDmg} PV de contrecoup !`, logEvent);
    }

    // Orbe Vie : 1/10 des PV du lanceur à chaque coup porté (pas avec Sans Limite ni Garde Magik)
    if (attPoke.item === 'lifeorb' && res.damage > 0 && !attPoke.fainted && !sheer) {
      const cost = Math.max(1, Math.floor(attPoke.maxHp / 10));
      indirect(attPoke, attSide, cost, `${attPoke.name} perd un peu de PV à cause de l'${ITEMS.lifeorb.name} !`, logEvent, { item: 'lifeorb' });
    }
    checkBerries(attPoke, attSide, logEvent, state);

    // Talents de la cible au contact (Peau Dure, Statik, Point Poison, Corps Ardent, Pose Spore)
    const contact = isContact(moveId, attMove);
    const dA = ab(defPoke, attPoke);
    if (contact && res.damage > 0 && !attPoke.fainted) {
      if (dA === 'rough-skin') indirect(attPoke, attSide, Math.max(1, Math.floor(attPoke.maxHp / 8)), `${attPoke.name} se blesse sur ${AN('rough-skin')} de ${defPoke.name} !`, logEvent);
      const cst = { static: 'paralysis', 'poison-point': 'poison', 'flame-body': 'burn' }[dA]
        || (dA === 'effect-spore' ? ['sleep', 'paralysis', 'poison'][Math.floor(Math.random() * 3)] : null);
      if (cst && !attPoke.fainted && Math.random() < 0.3 && statusAllowed(state, attPoke, cst)) {
        logEvent({ type: 'ability', side: defSide, ability: dA, msg: `${AN(dA)} de ${defPoke.name} s'active !` });
        inflict(state, attPoke, attSide, cst, logEvent, null);
      }
    }
    // Corps Maudit : 30 % de chances de bloquer l'attaque reçue pendant 3 tours
    if (dA === 'cursed-body' && res.damage > 0 && !attPoke.fainted && !attPoke.disabled && Math.random() < 0.3) {
      attPoke.disabled = { move: moveId, turns: 3 };
      logEvent({ type: 'ability', side: defSide, ability: dA, msg: `${AN(dA)} de ${defPoke.name} bloque ${attMove.name} de ${attPoke.name} !` });
    }

    // Effet de stat sur le lanceur même si le défenseur tombe K.O. (Close Combat, Draco-Météore, Surpuissance)
    if (attMove.effect && attMove.effect.type === 'stat' && attMove.effect.target === 'self' && !attPoke.fainted) {
      applyStatEffect(attMove.effect, attPoke, defPoke, attSide, defSide, logEvent);
    }

    // K.O. du défenseur
    if (defPoke.hp === 0) {
      defPoke.fainted = true;
      logEvent({ type: 'faint', side: defSide, pokemonId: defPoke.id, name: defPoke.name, msg: `${defPoke.name} est K.O. !` });
      // Impudence : l'Attaque monte après chaque K.O.
      if (attPoke.ability === 'moxie' && !attPoke.fainted) { logEvent({ type: 'ability', side: attSide, ability: 'moxie', msg: `${AN('moxie')} de ${attPoke.name} s'active !` }); selfStat(attPoke, attSide, 'atk', 1, logEvent); }
      return;
    }

    // Talents de la cible touchée : Cœur Noble (Ténèbres → Attaque +1), Armurouillée (physique → Déf −1, Vit +2)
    if (res.damage > 0) {
      if (defPoke.ability === 'justified' && mType === 'dark') { logEvent({ type: 'ability', side: defSide, ability: 'justified', msg: `${AN('justified')} de ${defPoke.name} s'active !` }); selfStat(defPoke, defSide, 'atk', 1, logEvent); }
      if (defPoke.ability === 'weak-armor' && attMove.cat === 'physical') { logEvent({ type: 'ability', side: defSide, ability: 'weak-armor', msg: `${AN('weak-armor')} de ${defPoke.name} s'active !` }); selfStat(defPoke, defSide, 'def', -1, logEvent); selfStat(defPoke, defSide, 'spe', 2, logEvent); }
    }

    // Effet secondaire de baisse de stat sur la cible (Psyko, Ball'Ombre, Mâchouille, Piétinement, Écume)
    if (!sheer && attMove.effect && attMove.effect.type === 'stat' && attMove.effect.target === 'opponent') {
      const chance = attMove.effect.chance || 100;
      if (Math.random() * 100 < chance) {
        applyStatEffect(attMove.effect, attPoke, defPoke, attSide, defSide, logEvent);
      }
    }

    // Effet secondaire de statut (ex: Brûlure sur Lance-Flammes 10%, Paralysie sur Tonnerre 10%)
    if (!sheer && attMove.effect && attMove.effect.type === 'status' && !defPoke.status) {
      const st = attMove.effect.status;
      if (statusAllowed(state, defPoke, st, attMove.type) && Math.random() * 100 < (attMove.effect.chance || 10)) {
        inflict(state, defPoke, defSide, st, logEvent, { poke: attPoke, side: attSide });
      }
    }

    // Effet secondaire de Peur (Flinch) si l'attaquant agit en premier (Attention : jamais peur)
    if (!sheer && isFirstMover && attMove.flinch && defPoke.ability !== 'inner-focus' && Math.random() * 100 < attMove.flinch) {
      flinched[defSide] = true;
    }
  }

  // Exécution premier attaquant
  executeMove(firstSide, secondSide, true);

  // Exécution second attaquant si encore en vie
  executeMove(secondSide, firstSide, false);

  // --- 4. Fin de tour : météo, statuts, objets, talents ---
  const weather = weatherOf(state);
  const heal = (poke, side, amount, msg, extra = {}) => {
    amount = Math.min(poke.maxHp - poke.hp, amount);
    if (amount <= 0) return;
    poke.hp += amount;
    logEvent({ type: 'heal', side, pokemonId: poke.id, hp: poke.hp, maxHp: poke.maxHp, amount, msg, ...extra });
  };
  for (const side of ['A', 'B']) {
    const poke = getActivePokemon(state, side);
    if (!poke || poke.fainted) continue;
    const a = poke.ability, guard = a === 'magic-guard';

    // météo
    if (weather === 'sand' && !poke.types.some((t) => ['rock', 'ground', 'steel'].includes(t)) && !['sand-force', 'sand-veil', 'overcoat'].includes(a)) {
      if (indirect(poke, side, Math.max(1, Math.floor(poke.maxHp / 16)), `La tempête de sable frappe ${poke.name} !`, logEvent)) continue;
    }
    if (weather === 'rain' && a === 'rain-dish') heal(poke, side, Math.max(1, Math.floor(poke.maxHp / 16)), `${AN(a)} : ${poke.name} récupère des PV sous la pluie !`);
    if (weather === 'rain' && a === 'hydration' && poke.status) { poke.status = null; poke.sleepTurns = 0; logEvent({ type: 'status_cured', side, msg: `${AN(a)} : la pluie soigne ${poke.name} !` }); }
    if (weather === 'sun' && a === 'solar-power') { if (indirect(poke, side, Math.max(1, Math.floor(poke.maxHp / 8)), `${AN(a)} : ${poke.name} souffre du soleil !`, logEvent)) continue; }

    // statuts (Garde Magik : rien ; Soin Poison : le poison soigne)
    if (poke.status === 'burn' && !guard) {
      const burnDmg = Math.max(1, Math.floor(poke.maxHp / 16));
      poke.hp = Math.max(0, poke.hp - burnDmg);
      logEvent({ type: 'status_damage', side, damage: burnDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `${poke.name} souffre de sa brûlure (-${burnDmg} PV) !` });
    } else if ((poke.status === 'poison' || poke.status === 'toxic') && a === 'poison-heal') {
      heal(poke, side, Math.max(1, Math.floor(poke.maxHp / 8)), `${AN(a)} : le poison soigne ${poke.name} !`);
    } else if (poke.status === 'poison' && !guard) {
      const poisonDmg = Math.max(1, Math.floor(poke.maxHp / 8));
      poke.hp = Math.max(0, poke.hp - poisonDmg);
      logEvent({ type: 'status_damage', side, damage: poisonDmg, hp: poke.hp, maxHp: poke.maxHp, msg: `${poke.name} souffre du poison (-${poisonDmg} PV) !` });
    } else if (poke.status === 'toxic' && !guard) {
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
    checkBerries(poke, side, logEvent, state);
    // Restes : 1/16 des PV en fin de tour
    if (poke.item === 'leftovers' && poke.hp < poke.maxHp) {
      heal(poke, side, Math.max(1, Math.floor(poke.maxHp / 16)), `${poke.name} récupère un peu de PV grâce aux ${ITEMS.leftovers.name} !`, { item: 'leftovers' });
    }
    // Récolte : une baie mangée repousse une fois sur deux (toujours au soleil)
    if (a === 'harvest' && poke.itemUsed && (poke.item === 'sitrus' || poke.item === 'lum') && (weather === 'sun' || Math.random() < 0.5)) {
      poke.itemUsed = false;
      logEvent({ type: 'ability', side, ability: a, msg: `${AN(a)} : la ${ITEMS[poke.item].name} de ${poke.name} repousse !` });
      checkBerries(poke, side, logEvent, state);
    }
    // Turbo : la Vitesse monte à chaque tour
    if (a === 'speed-boost' && (poke.statStages.spe || 0) < 6) { logEvent({ type: 'ability', side, ability: a, msg: `${AN(a)} de ${poke.name} s'active !` }); selfStat(poke, side, 'spe', 1, logEvent); }
    // attaque bloquée par Corps Maudit : un tour de moins
    if (poke.disabled) { poke.disabled.turns--; if (poke.disabled.turns <= 0) { poke.disabled = null; logEvent({ type: 'msg', text: `L'attaque de ${poke.name} n'est plus bloquée.` }); } }
  }
  // la météo s'arrête au bout de 5 tours (les vents violents durent tant que leur Pokémon est au combat)
  if (state.weather) {
    const w = state.weather;
    const holder = getActivePokemon(state, w.by);
    if (w.type === 'wind' ? !(holder && !holder.fainted && holder.ability === 'delta-stream') : --w.turns <= 0) {
      logEvent({ type: 'weather_end', weather: w.type, msg: WEATHER_TXT[w.type][1] });
      state.weather = null;
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
  state.entry = [...(state.entry || []), side];   // son talent d'arrivée joue au début du prochain tour

  const trainer = getTrainer(state, side);
  const event = {
    type: 'switch',
    side,
    pokemonId: nextPoke.id,
    spriteId: nextPoke.spriteId || nextPoke.id,
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
