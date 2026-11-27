// odyssee/js/core/battle-ai.js — intelligence artificielle de combat (1v1, Double et Triple) et estimation des dégâts.
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { getAbility } from '../data/abilities.js';
import { isFainted } from './mon.js';
import { SOUND_MOVES, POWDER_MOVES, VANISH_MOVES, BULLET_MOVES, typeEff, hiddenPower, freshVol } from './battle-helpers.js';

/** Estime la menace maximale adverse envers un emplacement de l'IA. */
export function foeThreatInfo(b, slot = 0) {
  const ref = { side: 1, slot }, m = b.act(ref);
  if (!m || isFainted(m)) return { incomingMaxDmg: 0, foeFaster: false, threatenedKO: false };
  const mySpe = b.stat(ref, 5), mTypes = SPECIES[m.sp]?.t || ['normal'];
  let incomingMaxDmg = 0, foeFaster = false, threatenedKO = false;
  for (const sl0 of b.aliveSlots(0)) {
    const fRef = { side: 0, slot: sl0 }, fm = b.act(fRef);
    if (!fm) continue;
    const faster = b.stat(fRef, 5) > mySpe;
    let maxFromThis = 0;
    for (const q of (fm.moves || [])) {
      if (!q || q.pp <= 0) continue;
      const mv = MOVES[q.id];
      if (!mv || mv.c === 'status') continue;
      const d = estimate(b, fRef, ref, mv);
      if (d > maxFromThis) maxFromThis = d;
      if ((faster || (mv.pr || 0) > 0) && d >= m.hp) threatenedKO = true;
    }
    if (!(fm.moves || []).some((q) => q && q.pp > 0 && MOVES[q.id]?.c !== 'status')) {
      const fTypes = SPECIES[fm.sp]?.t || ['normal'];
      for (const ft of fTypes) {
        const eff = typeEff(ft, mTypes, b.inverse);
        if (eff > 0) {
          const heur = Math.floor(((2 * fm.lvl / 5 + 2) * 80 * Math.max(b.stat(fRef, 1), b.stat(fRef, 3)) / Math.max(1, Math.min(b.stat(ref, 2), b.stat(ref, 4)))) / 50 * 1.5 * eff);
          if (heur > maxFromThis) maxFromThis = heur;
        }
      }
      if (faster && maxFromThis >= m.hp) threatenedKO = true;
    }
    if (maxFromThis > incomingMaxDmg) incomingMaxDmg = maxFromThis;
    if (faster && maxFromThis >= m.hp * 0.45) foeFaster = true;
  }
  return { incomingMaxDmg, foeFaster, threatenedKO };
}

/** Choisit le meilleur remplaçant du banc de l'IA face aux Pokémon actifs du joueur. */
export function foePickBestReplacement(b, slot = 0, candidateIndices = null) {
  const side = b.sides[1];
  const cands = candidateIndices
    ? candidateIndices.filter((j) => side.party[j] && side.party[j].hp > 0 && !side.activeSlots.includes(j))
    : side.party.map((m, j) => (m && m.hp > 0 && !side.activeSlots.includes(j) ? j : -1)).filter((j) => j >= 0);
  if (!cands.length) return -1;
  const t = side.trainer;
  const isStrong = !!t?.strategic || t?.ai === 'smart' || t?.ai === 'strategic' || t?.cls === 'Rival' || t?.rival || b.rival;
  if (cands.length === 1 || !isStrong) return cands[0];
  const foeRefs = b.aliveSlots(0).map((sl) => ({ side: 0, slot: sl }));
  if (!foeRefs.length) return cands[0];

  const prevIdx = side.activeSlots[slot], prevVol = side.vs[slot];
  let bestIdx = cands[0], bestScore = -Infinity;
  try {
    side.vs[slot] = freshVol();
    for (const idx of cands) {
      const cand = side.party[idx];
      const cTypes = SPECIES[cand.sp]?.t || ['normal'];
      const cAb = getAbility(cand)?.id || null;
      let score = (cand.hp / Math.max(1, cand.stats[0])) * 20;
      side.activeSlots[slot] = idx;
      const candRef = { side: 1, slot };
      const candSpe = cand.stats?.[5] || 50;

      for (const fRef of foeRefs) {
        const foeMon = b.act(fRef);
        if (!foeMon) continue;
        const fTypes = SPECIES[foeMon.sp]?.t || ['normal'];
        let worstEff = 0;
        for (const ft of fTypes) {
          const nul = { ground: ['levitate'], water: ['water-absorb', 'dry-skin', 'storm-drain'], electric: ['volt-absorb', 'lightning-rod', 'motor-drive'], fire: ['flash-fire'], grass: ['sap-sipper'] }[ft];
          if (nul && nul.includes(cAb) && b.ab(fRef) !== 'mold-breaker') continue;
          let eff = typeEff(ft, cTypes, b.inverse);
          if ((cAb === 'thick-fat' && (ft === 'fire' || ft === 'ice')) || (cAb === 'heatproof' && ft === 'fire')) eff *= 0.5;
          if ((cAb === 'filter' || cAb === 'solid-rock') && eff > 1) eff *= 0.75;
          if (cAb === 'wonder-guard' && eff <= 1) eff = 0;
          worstEff = Math.max(worstEff, eff);
        }
        if (worstEff === 0) score += 65;
        else if (worstEff <= 0.25) score += 55;
        else if (worstEff <= 0.5) score += 45;
        else if (worstEff >= 4) score -= 85;
        else if (worstEff >= 2) score -= 45;

        let bestOff = 0, canPrioKO = false;
        for (const q of (cand.moves || [])) {
          if (!q || q.pp <= 0) continue;
          const mv = MOVES[q.id];
          if (!mv || mv.c === 'status') continue;
          const mt = mv.m?.u === 'hidden-power' ? hiddenPower(cand).type : mv.t;
          const eff = typeEff(mt, fTypes, b.inverse);
          if (eff === 0) continue;
          const dmg = estimate(b, candRef, fRef, mv);
          let off = Math.min(1.5, dmg / Math.max(1, foeMon.hp)) * 80 + (eff >= 2 ? 25 : eff < 1 ? -10 : 0);
          if ((mv.pr || 0) > 0 && dmg >= foeMon.hp) { off += 45; canPrioKO = true; }
          if (off > bestOff) bestOff = off;
        }
        score += bestOff;
        if (candSpe > b.stat(fRef, 5) && !canPrioKO) score += 18;
        if (cAb === 'intimidate' && b.stat(fRef, 1) >= b.stat(fRef, 3)) score += 20;
      }
      if ((cAb === 'multiscale' || cAb === 'sturdy') && cand.hp === cand.stats[0]) score += 14;
      if ((cAb === 'drizzle' || cAb === 'drought' || cAb === 'sand-stream') && b.weather === 'none') score += 12;
      if (score > bestScore) { bestScore = score; bestIdx = idx; }
    }
  } finally {
    side.activeSlots[slot] = prevIdx;
    side.vs[slot] = prevVol;
  }
  return bestIdx;
}

/** Évalue s'il est tactiquement avantageux pour l'IA de rappeler le Pokémon actif. */
export function foeConsiderSwitch(b, slot, threat, bestMoveDamage, ctx = null) {
  if (b.wild || b.pvp || b.trapped({ side: 1, slot })) return null;
  const side = b.sides[1], ref = { side: 1, slot }, m = b.act(ref), v = b.vol(ref);
  if (!m || isFainted(m)) return null;
  if (b.turn - (side.switchTour ?? -10) < 3) return null;
  const avail = side.party.map((q, j) => (q && q.hp > 0 && !side.activeSlots.includes(j) && !ctx?.reservedSwitches?.has(j) ? j : -1)).filter((j) => j >= 0);
  if (!avail.length) return null;

  const lock = b.choiceLock(ref);
  const curAb = b.ab(ref);
  const lockedUseless = lock != null && bestMoveDamage <= 0;
  const walledAndThreatened = bestMoveDamage < m.stats[0] * 0.14 && threat.incomingMaxDmg >= m.hp * 0.55;
  const crippledStats = Math.min(v.st[1], v.st[3]) <= -3 && m.hp > m.stats[0] * 0.45 && threat.incomingMaxDmg >= m.hp * 0.45;
  const cureOrRegen = ((curAb === 'natural-cure' && (m.status === 'slp' || m.status === 'par' || m.status === 'brn')) || (curAb === 'regenerator' && m.hp < m.stats[0] * 0.35)) && threat.incomingMaxDmg < m.hp * 0.9;
  if (!lockedUseless && !walledAndThreatened && !crippledStats && !cureOrRegen) return null;

  const bestIdx = foePickBestReplacement(b, slot, avail);
  if (bestIdx < 0) return null;
  const cand = side.party[bestIdx];
  if (!cand || cand.hp < cand.stats[0] * 0.35) return null;

  const cTypes = SPECIES[cand.sp]?.t || ['normal'], cAb = getAbility(cand)?.id || null;
  const foeRefs = b.aliveSlots(0).map((sl) => ({ side: 0, slot: sl }));
  let candTakesHeavy = false, candHasHit = false;
  for (const fRef of foeRefs) {
    const fm = b.act(fRef); if (!fm) continue;
    const fTypes = SPECIES[fm.sp]?.t || ['normal'];
    for (const ft of fTypes) {
      const nul = { ground: ['levitate', 'eelevate'], water: ['water-absorb', 'dry-skin', 'storm-drain'], electric: ['volt-absorb', 'lightning-rod', 'motor-drive'], fire: ['flash-fire'], grass: ['sap-sipper'] }[ft];
      if (nul && nul.includes(cAb) && !b.ignoresDefAbility(fRef)) continue;
      if (typeEff(ft, cTypes, b.inverse) >= 2) candTakesHeavy = true;
    }
    for (const q of (cand.moves || [])) {
      const mv = q && q.pp > 0 ? MOVES[q.id] : null;
      if (!mv || mv.c === 'status') continue;
      if (typeEff(mv.t, fTypes, b.inverse) >= 1) candHasHit = true;
    }
  }
  if (candTakesHeavy || (!candHasHit && !lockedUseless)) return null;
  side.switchTour = b.turn;
  ctx?.reservedSwitches?.add(bestIdx);
  return { type: 'switch', idx: bestIdx };
}

/** Choisit les actions de tous les emplacements vivants du côté de l'IA. */
export function foeChooseAll(b) {
  const out = [];
  let itemUsed = false;
  const t = b.sides[1]?.trainer;
  const isStrat = !!t?.strategic || t?.ai === 'strategic';
  const isStrongMulti = b.slots > 1 && (isStrat || t?.ai === 'smart' || t?.cls === 'Rival' || t?.rival || b.rival);
  const ctx = isStrongMulti ? { plannedDmg: new Map(), protectedAlly: new Set(), usedUtility: new Set(), statusedTarget: new Set(), reservedSwitches: new Set() } : null;
  const slots = b.aliveSlots(1);
  const evalOrder = isStrongMulti ? [...slots].sort((a, bSlot) => b.stat({ side: 1, slot: bSlot }, 5) - b.stat({ side: 1, slot: a }, 5)) : slots;
  for (const sl of evalOrder) {
    const a = foeChooseSlot(b, sl, itemUsed, ctx);
    if (a.type === 'item') itemUsed = true;
    out.push({ i: 1, side: 1, slot: sl, a });
  }
  return isStrongMulti ? out.sort((a, bItem) => a.slot - bItem.slot) : out;
}

/** Choisit la meilleure action pour un emplacement de l'IA (objet, rappel ou attaque). */
export function foeChooseSlot(b, slot = 0, itemUsed = false, ctx = null) {
  const ref = { side: 1, slot };
  const forced = b.forcedAction(ref); if (forced) return forced;
  const side = b.sides[1], m = b.act(ref), t = side.trainer, v = b.vol(ref);
  const usable = b.usableMoves(ref);
  if (!usable.length) return { type: 'move', id: 165 };

  if (b.wild) {
    const lock = b.choiceLock(ref); if (lock != null) { const k = m.moves.findIndex((q) => q.id === lock); return { type: 'move', id: lock, slot: k }; }
    let k = usable[b.r(usable.length)];
    // un Alpha sait se battre : deux fois sur trois, il choisit son attaque la plus forte
    if (b.alpha && b.r(3) > 0) {
      const cible = b.aliveSlots(0).map((sl) => ({ side: 0, slot: sl }))[0];
      if (cible) { let mieux = 0; for (const j of usable) { const d = estimate(b, ref, cible, MOVES[m.moves[j].id]); if (d > mieux) { mieux = d; k = j; } } }
    }
    const mv = MOVES[m.moves[k].id];
    const cands = b.validFoeTargets(ref, mv);
    const tgt = cands.length ? cands[b.r(cands.length)] : { side: 0, slot: 0 };
    return { type: 'move', id: mv.id, slot: k, targetSide: tgt.side, targetSlot: tgt.slot };
  }

  const isStrategic = !!t.strategic || t.ai === 'strategic';
  const isRival = !t.friendly && (t.cls === 'Rival' || t.rival || b.rival);
  const isSmart = t.ai === 'smart' || isStrategic;
  const lock = b.choiceLock(ref);
  const threat = (isSmart || isRival) ? foeThreatInfo(b, slot) : { incomingMaxDmg: 0, foeFaster: false, threatenedKO: false };

  if (lock != null) {
    const k = m.moves.findIndex((q) => q.id === lock);
    const lockedHasPp = k >= 0 && m.moves[k].pp > 0;
    const lockedMv = lockedHasPp ? MOVES[lock] : null;
    const cands = lockedMv ? b.validFoeTargets(ref, lockedMv) : [];
    const bestLockedDmg = lockedMv ? cands.reduce((mx, fRef) => Math.max(mx, estimate(b, ref, fRef, lockedMv)), 0) : 0;
    if (isSmart || isRival) {
      const sw = foeConsiderSwitch(b, slot, threat, bestLockedDmg, ctx);
      if (sw) return sw;
    }
    if (!lockedHasPp) return { type: 'move', id: 165 };
    const bestFoe = cands.reduce((best, fRef) => (!best || estimate(b, ref, fRef, lockedMv) > estimate(b, ref, best, lockedMv) ? fRef : best), cands[0]);
    return { type: 'move', id: lock, slot: k, ...(bestFoe ? { targetSide: bestFoe.side, targetSlot: bestFoe.slot } : {}) };
  }

  if (!itemUsed && t.items && !(side.soinTour != null && b.turn - side.soinTour <= 1)) {
    const ratio = m.hp / m.stats[0];
    const hasStatus = !!m.status;
    const benchAlive = side.party.some((p, idx) => !side.activeSlots.includes(idx) && p.hp > 0);
    const healThreshold = (isSmart || isRival) ? (!benchAlive ? 0.52 : 0.44) : 0.28;
    if (hasStatus && t.items['full-restore'] > 0 && (ratio < 0.75 || b.rng() < 0.85)) {
      t.items['full-restore']--; side.soinTour = b.turn;
      return { type: 'item', item: 'full-restore', foe: true, slot };
    }
    if (ratio <= healThreshold && (!isSmart ? b.rng() < 0.85 : true)) {
      const needed = m.stats[0] - m.hp;
      let chosen = null;
      if (t.items['full-restore'] > 0 && (hasStatus || needed > 120)) chosen = 'full-restore';
      else if (t.items['hyper-potion'] > 0 && needed > 90) chosen = 'hyper-potion';
      else if (t.items['super-potion'] > 0 && needed > 35) chosen = 'super-potion';
      else if (t.items['potion'] > 0) chosen = 'potion';
      else if (t.items['hyper-potion'] > 0) chosen = 'hyper-potion';
      else if (t.items['full-restore'] > 0) chosen = 'full-restore';
      if (chosen) { t.items[chosen]--; side.soinTour = b.turn; return { type: 'item', item: chosen, foe: true, slot }; }
    }
  }

  const mySpeed = b.stat(ref, 5);
  const myTypes = b.typesOf(ref);
  const hasPhysMove = usable.some((idx) => MOVES[m.moves[idx].id]?.c === 'physical');
  const hasSpecMove = usable.some((idx) => MOVES[m.moves[idx].id]?.c === 'special');
  let bestOffDmg = 0;
  const options = [];
  for (const k of usable) {
    const mv = MOVES[m.moves[k].id];
    const cands = b.validFoeTargets(ref, mv);
    const tgtPool = cands.length ? cands : [{ side: 0, slot: 0 }];
    const isSpreadMove = mv.tg === 9 || mv.tg === 11;
    // En combat multi, on évalue chaque cible possible pour trouver la meilleure paire (attaque, cible)
    const evalTargets = (isSpreadMove || mv.tg === 7 || mv.tg === 4 || mv.tg === 13) ? [tgtPool[0]] : tgtPool;
    for (const tgtRef of evalTargets) {
      const pMon = b.act(tgtRef) || b.me;
      const pType = b.typesOf(tgtRef);
      const pVol = b.vol(tgtRef);
      const tgtSpe = b.stat(tgtRef, 5);
      const amFaster = mySpeed >= tgtSpe;
      let s = 10;
      let estDmg = 0;
      if (mv.c === 'status' && m.item === 'assault-vest') s = 0.0001;
      else if (mv.key === 'fake-out' && v.turns > 0) s = 0.0001;
      else if (mv.c !== 'status' && (mv.p > 0 || mv.m?.u)) {
        const mvType = b.moveType(ref, mv);
        const scoreVs = (tr) => {
          const pm = b.act(tr);
          if (!pm || isFainted(pm)) return 0;
          const dRaw = estimate(b, ref, tr, mv);
          if (dRaw <= 0) return 0;
          const pt = b.typesOf(tr);
          const eff = typeEff(mvType, pt, b.inverse);
          const d = dRaw * (isSpreadMove && tgtPool.length > 1 ? 0.75 : 1);
          if (tr.side === 0 && d > bestOffDmg) bestOffDmg = d;
          let sc = d * ((mv.a || 100) / 100);
          if ((isSmart || isRival) && ctx && tr.side === 0) {
            const queued = ctx.plannedDmg.get(tr.slot) || 0;
            const remHp = Math.max(1, pm.hp - queued);
            if (queued >= pm.hp) sc *= 0.12;
            else if (d >= remHp) { sc *= 3.2; if ((mv.pr || 0) > 0) sc *= 4.0; }
          }
          if (d >= pm.hp) { sc *= 3.8; if ((mv.pr || 0) > 0) sc *= 5.0; }
          if (eff >= 2) sc *= (eff >= 4 ? 1.75 : 1.35);
          if (mv.m?.recharge) sc *= 0.5;
          if ((mv.m?.charge || VANISH_MOVES.has(mv.key)) && v.charge !== mv.id) {
            if (mv.key === 'solar-beam' && (b.weather === 'sun' || b.ab(ref) === 'mega-sol')) sc *= 1.25;
            else if (threat.threatenedKO) sc *= 0.05;
            else sc *= ['fly', 'dig', 'dive', 'bounce', 'shadow-force', 'phantom-force'].includes(mv.key) ? 0.72 : 0.6;
          }
          if (mv.m?.drain > 0 && m.hp < m.stats[0] * 0.8) sc += Math.min(m.stats[0] - m.hp, d * mv.m.drain / 100) * 0.75;
          if (mv.m?.drain < 0 && b.ab(ref) !== 'rock-head' && b.ab(ref) !== 'magic-guard') {
            const rec = Math.floor(d * (-mv.m.drain) / 100);
            if (rec >= m.hp && d < pm.hp) sc *= 0.35;
          }
          if (mv.m?.boom) sc = (m.hp < m.stats[0] * 0.22 && d >= pm.hp) ? sc * 1.5 : sc * 0.04;
          if (myTypes.includes(mvType)) sc *= 1.3;
          if (mv.m?.flinch && amFaster) sc *= isStrategic && mv.key === 'fake-out' ? 2.1 : 1.25;
          if (mv.m?.crit) sc *= 1.15;
          if (threat.threatenedKO && ((mv.pr || 0) > 0 || (b.ab(ref) === 'gale-wings' && mvType === 'flying' && m.hp === m.stats[0]))) sc *= 2.8;
          if (!amFaster && mv.m?.st?.some(([sd, amt]) => sd === 6 && amt < 0)) {
            const tgtAb = b.defAb(ref, tr);
            if (tgtAb !== 'clear-body' && tgtAb !== 'white-smoke' && tgtAb !== 'contrary' && mySpeed >= Math.floor(b.stat(tr, 5) * 2 / 3)) sc *= 1.45;
          }
          return sc;
        };
        if (isSpreadMove && b.slots > 1) {
          s = 0;
          for (const f of tgtPool) s += scoreVs(f);
          let dangerousFriendly = false;
          // Pénalité si l'attaque touche aussi nos alliés (Séisme, Surf, Coup d'Jus…)
          if (mv.tg === 9) {
            for (const alSl of b.aliveSlots(1)) if (alSl !== slot && b.isAdjacent(ref, { side: 1, slot: alSl })) {
              if (ctx?.protectedAlly?.has(alSl)) continue;
              const alRef = { side: 1, slot: alSl }, alMon = b.act(alRef);
              const allyPenalty = scoreVs(alRef);
              if ((isSmart || isRival) && allyPenalty > 0 && alMon) {
                if (estimate(b, ref, alRef, mv) >= alMon.hp * 0.45) dangerousFriendly = true;
                s -= allyPenalty * 2.6;
              } else {
                s -= allyPenalty * 1.1;
              }
            }
          }
          if (ctx && !dangerousFriendly && tgtPool.length >= 2 && s > 0) s *= 1.15;
          s = dangerousFriendly ? 0.0001 : Math.max(0.0001, s);
          estDmg = tgtPool.reduce((mx, f) => Math.max(mx, estimate(b, ref, f, mv)), 0);
        } else {
          estDmg = estimate(b, ref, tgtRef, mv);
          s = Math.max(0.0001, scoreVs(tgtRef));
        }
      } else {
        const x = mv.m || {}, tgtAb = b.defAb(ref, tgtRef), tgtScr = b.sides[tgtRef.side].screens;
        if (x.heal || x.u === 'rest') {
          if (threat.threatenedKO) s = 0.001;
          else if (m.hp < m.stats[0] * (isStrategic ? 0.50 : 0.45)) s = pMon.stats[0] * (isStrategic ? 1.65 : 1.4);
          else if (m.hp < m.stats[0] * 0.65) s = pMon.stats[0] * 0.55;
          else s = 0.001;
        } else if (x.u === 'reflect' || x.u === 'light-screen' || x.u === 'mist' || x.u === 'safeguard') {
          const scrKey = x.u === 'light-screen' ? 'light' : x.u;
          if (side.screens[scrKey] || ctx?.usedUtility?.has(x.u)) s = 0.0001;
          else s = pMon.stats[0] * (isStrategic ? 1.45 : isSmart ? 1.05 : 0.6);
        } else if (x.u === 'haze') {
          const foeBoosted = b.aliveSlots(0).some((s0) => { const vs0 = b.vol({ side: 0, slot: s0 }).st; return vs0[1] >= 2 || vs0[3] >= 2 || vs0[5] >= 2 || vs0.reduce((a, bSt) => a + Math.max(0, bSt), 0) >= 2; });
          s = foeBoosted ? pMon.stats[0] * 1.65 : 0.001;
        } else if (x.u === 'pain-split') {
          const gain = Math.floor((m.hp + pMon.hp) / 2) - m.hp;
          s = gain > 0 ? gain * 2.2 : 0.001;
        } else if (x.u === 'belly-drum') {
          s = (hasPhysMove && m.hp > m.stats[0] * 0.65 && !threat.threatenedKO && (v.st[1] || 0) < 2) ? pMon.stats[0] * 1.7 : 0.001;
        } else if (x.ail && !['conf', 'seed', 'trap'].includes(x.ail)) {
          const ailType = mv.key === 'toxic' ? 'tox' : x.ail;
          const immuneAb = { psn: ['immunity'], tox: ['immunity'], par: ['limber'], slp: ['insomnia', 'vital-spirit'], brn: ['water-veil', 'fire-mane'], frz: ['magma-armor'] }[ailType];
          const blockedByGround = mv.key === 'thunder-wave' && !b.inverse && pType.includes('ground');
          const blockedByPowder = POWDER_MOVES.has(mv.key) && (pType.includes('grass') || tgtAb === 'overcoat');
          const blockedByTerrain = ailType === 'slp' && b.terrain === 'electric' && b.isGrounded(tgtRef);
          const blockedBySound = SOUND_MOVES.has(mv.key) && tgtAb === 'soundproof';
          const blockedByAb = (immuneAb && immuneAb.includes(tgtAb)) || tgtAb === 'magic-bounce' || (tgtAb === 'leaf-guard' && b.weather === 'sun');
          if (pMon.status || tgtScr.safeguard || blockedByGround || blockedByPowder || blockedByTerrain || blockedBySound || blockedByAb || (ctx?.statusedTarget?.has(tgtRef.slot))) s = 0.001;
          else {
            const cannot = ((ailType === 'psn' || ailType === 'tox') && (pType.includes('poison') || pType.includes('steel'))) ||
              (ailType === 'brn' && pType.includes('fire')) || (ailType === 'par' && pType.includes('electric')) || (ailType === 'frz' && pType.includes('ice'));
            const brnBoost = (isSmart || isRival) && ailType === 'brn' && b.stat(tgtRef, 1) >= b.stat(tgtRef, 3) ? 1.65 : 1.4;
            s = cannot ? 0.001 : pMon.stats[0] * (ailType === 'slp' ? 1.85 : brnBoost);
          }
        } else if (x.ail === 'conf') {
          s = (pVol.conf || tgtAb === 'own-tempo' || tgtAb === 'magic-bounce' || (SOUND_MOVES.has(mv.key) && tgtAb === 'soundproof')) ? 0.001 : pMon.stats[0] * 0.7;
        } else if (x.ail === 'seed') {
          s = (pVol.seed || pType.includes('grass') || tgtAb === 'magic-bounce') ? 0.001 : pMon.stats[0] * 0.95;
        } else if (x.st) {
          const isDebuff = x.st.some(([, amt]) => amt < 0);
          if (isDebuff) {
            const blockedByPowder = POWDER_MOVES.has(mv.key) && (pType.includes('grass') || tgtAb === 'overcoat');
            const blockedDebuff = blockedByPowder || (tgtScr.mist && b.ab(ref) !== 'infiltrator') || tgtAb === 'magic-bounce' || tgtAb === 'clear-body' || tgtAb === 'white-smoke' || tgtAb === 'contrary' || tgtAb === 'defiant' || tgtAb === 'competitive'
              || ((tgtAb === 'hyper-cutter' || tgtAb === 'coeur-vaillant') && x.st.some(([sd]) => sd === 2))
              || (tgtAb === 'keen-eye' && x.st.some(([sd]) => sd === 7))
              || (tgtAb === 'big-pecks' && x.st.some(([sd]) => sd === 3));
            const alreadyLowered = x.st.some(([sd]) => (pVol.st[sd - 1] || 0) <= -1);
            s = (blockedDebuff || alreadyLowered || v.turns > 1 || m.hp < m.stats[0] * 0.70) ? 0.001 : pMon.stats[0] * 0.35;
          } else {
            const boostsAtk = x.st.some(([sd, amt]) => sd === 2 && amt > 0);
            const boostsSpa = x.st.some(([sd, amt]) => sd === 4 && amt > 0);
            const boostsSpe = x.st.some(([sd, amt]) => sd === 6 && amt > 0);
            const usefulOff = (!boostsAtk && !boostsSpa) || (boostsAtk && hasPhysMove) || (boostsSpa && hasSpecMove);
            const curStage = Math.max(...x.st.map(([sd]) => v.st[sd - 1] || 0));
            if (threat.threatenedKO || !usefulOff || curStage >= 2 || m.hp < m.stats[0] * 0.45) {
              s = curStage >= 2 || !usefulOff || threat.threatenedKO ? 0.001 : pMon.stats[0] * 0.1;
            } else {
              s = (boostsAtk || boostsSpa) ? pMon.stats[0] * 1.35 : pMon.stats[0] * 0.85;
              if (boostsSpe && !amFaster && Math.floor(mySpeed * 1.5) >= tgtSpe) s += pMon.stats[0] * 0.25;
            }
          }
        } else if (mv.key === 'protect' || mv.key === 'detect') {
          if (v.protChain > 0) s = 0.001;
          else if (pVol.seed || pMon.status === 'tox') s = pMon.stats[0] * 1.15;
          else if ((isSmart || isRival) && m.item === 'leftovers' && m.hp < m.stats[0] * 0.45) s = pMon.stats[0] * 1.1;
          else if ((isSmart || isRival) && b.slots > 1 && b.aliveSlots(1).some((alSl) => alSl !== slot && b.isAdjacent(ref, { side: 1, slot: alSl }) && b.act({ side: 1, slot: alSl })?.moves?.some((amv) => { const mm = MOVES[amv.id]; return amv.pp > 0 && mm?.tg === 9 && estimate(b, { side: 1, slot: alSl }, ref, mm) >= m.hp * 0.35; }))) s = pMon.stats[0] * 1.35;
          else s = pMon.stats[0] * 0.35;
        } else s = pMon.stats[0] * 0.2;
      }
      options.push({ k, mv, tgtRef, s: Math.max(0.01, s), d: estDmg, pHp: pMon.hp });
    }
  }

  if ((isSmart || isRival) && !ctx?.disableSwitch) {
    const sw = foeConsiderSwitch(b, slot, threat, bestOffDmg, ctx);
    if (sw) return sw;
  }

  let pick;
  if (isSmart || isRival) {
    const tri = [...options].sort((a, bOpt) => bOpt.s - a.s);
    pick = tri[0];
    const ko = pick.mv.c !== 'status' && pick.d >= pick.pHp;
    if (!isStrategic && !ko && tri[1] && tri[1].s >= pick.s * 0.8 && b.rng() < 0.3) pick = tri[1];
  } else {
    const tot = options.reduce((acc, x) => acc + x.s * x.s, 0);
    let r = b.rng() * tot;
    pick = options[0];
    for (const x of options) { r -= x.s * x.s; if (r <= 0) { pick = x; break; } }
  }
  if (ctx) {
    if (pick.mv.key === 'protect' || pick.mv.key === 'detect') ctx.protectedAlly.add(slot);
    if (pick.mv.m?.u) ctx.usedUtility.add(pick.mv.m.u);
    if (pick.mv.m?.ail && !['conf', 'seed', 'trap'].includes(pick.mv.m.ail)) ctx.statusedTarget.add(pick.tgtRef.slot);
    if (pick.mv.c !== 'status') {
      const hitTgts = (pick.mv.tg === 9 || pick.mv.tg === 11) ? b.validFoeTargets(ref, pick.mv) : [pick.tgtRef];
      const mul = (pick.mv.tg === 9 || pick.mv.tg === 11) && hitTgts.length > 1 ? 0.75 : 1;
      for (const f of hitTgts) {
        if (f.side !== 0) continue;
        ctx.plannedDmg.set(f.slot, (ctx.plannedDmg.get(f.slot) || 0) + estimate(b, ref, f, pick.mv) * mul);
      }
    }
  }
  return { type: 'move', id: pick.mv.id, slot: pick.k, targetSide: pick.tgtRef.side, targetSlot: pick.tgtRef.slot };
}

/** Prédit la fourchette de dégâts en pourcentage et PV bruts d'une attaque de `a` sur `d`. */
export function damagePreview(b, a, d, moveId) {
  const mv = MOVES[moveId], T = b.act(d); if (!mv || !T || !T.stats) return null;
  if (mv.c === 'status' && !mv.m?.u) return null;
  const u = mv.m?.u, max = T.stats[0];
  const pct = (lo, hi) => ({ lo: Math.max(0, Math.floor(lo * 1000 / max) / 10), hi: Math.min(999, Math.ceil(hi * 1000 / max) / 10), lo0: lo, hi0: hi, ko: hi >= T.hp, sure: lo >= T.hp });
  const aR = b.norm(a), dR = b.norm(d);
  const type = b.moveType(aR, mv), eff = b.effOn(aR, dR, type);
  if (eff === 0) return { lo: 0, hi: 0, eff: 0 };
  const m = b.act(aR);
  const fixed = u === 'dragon-rage' ? 40 : u === 'sonic-boom' ? 20 : u === 'seismic-toss' || u === 'night-shade' ? m.lvl : u === 'super-fang' ? Math.max(1, Math.floor(T.hp / 2)) : u === 'endeavor' ? Math.max(0, T.hp - m.hp) : null;
  if (u === 'psywave') return { ...pct(Math.floor(m.lvl * 0.5), Math.floor(m.lvl * 1.5)), eff: 1 };
  if (u === 'counter' || u === 'mirror-coat' || u === 'splash' || mv.m?.cat === 9 || mv.key === 'metal-burst') return null;
  if (mv.key === 'final-gambit') return { ...pct(m.hp, m.hp), eff: 1 };
  if (fixed != null) return { ...pct(fixed, fixed), eff: 1 };
  const p = u === 'magnitude' ? 70 : u === 'present' ? 40 : b.movePower(aR, dR, mv);
  if (!p) return null;
  const x = mv.m || {}, hits = x.h0 ? [x.h0, x.h1 || x.h0] : [1, 1];
  const isSpread = b.slots > 1 && (mv.tg === 9 || mv.tg === 11) && b.validFoeTargets(aR, mv).length > 1;
  const spread = isSpread ? 0.75 : 1;
  const pb = !x.h0 && !isSpread && b.ab(aR) === 'parental-bond' && !x.boom ? 1.25 : 1;
  const lo = Math.floor(Math.floor(b.damageCore(aR, dR, mv, p, type, false, 0.85) * spread) * hits[0] * pb);
  const hi = Math.floor(Math.floor(b.damageCore(aR, dR, mv, p, type, false, 1) * spread) * hits[1] * pb);
  return { ...pct(lo, hi), eff };
}

/** Estime les dégâts attendus d'une attaque `mv` de `a` sur `d` (sans modifier le RNG). */
export function estimate(b, a, d, mv) {
  const aR = b.norm(a), dR = b.norm(d);
  const A = b.act(aR), D = b.act(dR);
  if (!A || !D || !mv) return 0;
  const t = b.moveType(aR, mv), eff = b.effOn(aR, dR, t);
  if (eff === 0) return 0;
  const dAb = b.defAb(aR, dR), aAb = b.ab(aR);
  if (dAb === 'soundproof' && SOUND_MOVES.has(mv.key)) return 0;
  if (dAb === 'bulletproof' && BULLET_MOVES.has(mv.key)) return 0;
  const nul = { ground: ['levitate', 'eelevate'], water: ['water-absorb', 'dry-skin', 'storm-drain'], electric: ['volt-absorb', 'lightning-rod', 'motor-drive'], fire: ['flash-fire'], grass: ['sap-sipper'] }[t];
  if ((nul && nul.includes(dAb)) || (dAb === 'wonder-guard' && eff <= 1)) return 0;
  const u = mv.m?.u, x = mv.m || {};
  if (u === 'counter' || u === 'mirror-coat' || mv.key === 'metal-burst') return 0;
  let dmg, avgHits = 1;
  const fixed = u === 'psywave' ? Math.max(1, A.lvl) : b.fixedDamage(aR, dR, mv);
  if (fixed != null) {
    dmg = fixed;
  } else {
    const p = u === 'magnitude' ? 71 : b.movePower(aR, dR, mv);
    if (!p) return 0;
    dmg = b.damageCore(aR, dR, mv, p, t, false, 0.92);
    if (x.h0) {
      avgHits = x.h0 === x.h1 ? x.h0 : aAb === 'skill-link' ? x.h1 : (x.h0 === 2 && x.h1 === 5) ? 3.1 : (x.h0 + (x.h1 || x.h0)) / 2;
      dmg = Math.floor(dmg * avgHits);
    } else if (aAb === 'parental-bond' && !x.boom && mv.key !== 'final-gambit' && !(b.slots > 1 && (mv.tg === 9 || mv.tg === 11))) {
      avgHits = 2;
      dmg = dmg + Math.max(1, Math.floor(dmg * 0.25));
    }
  }
  if (avgHits <= 1 && D.hp === D.stats[0] && dmg >= D.hp && (D.item === 'focus-sash' || dAb === 'sturdy')) {
    dmg = Math.max(1, D.hp - 1);
  }
  return dmg;
}
