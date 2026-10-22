// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Simulation du monde, pas par pas.
'use strict';

/* ============================================================================
   SIMULATION DU MONDE TEMPS RÉEL (20 HZ)
   ============================================================================ */
function finishBuildingConstruction(state, b, owner, fxEvents) {
  b.constructing = false;
  b.buildStarted = true;
  b.buildProg = 1;
  b.hp = b.maxHp;
  fxEvents.push({ k: 'COMPLETE', x: b.x, y: b.y, color: owner ? owner.color : '#ffc531', kind: b.kind, owner: b.owner });
  for (const u of state.units) {
    if (u.kind === 'scv' && u.buildTargetId === b.id) {
      // Le VCS sort proprement du périmètre du bâtiment achevé
      const ang = Math.atan2(u.y - b.y, u.x - b.x) || 0.6;
      const outDist = b.radius + u.radius + 6;
      u.x = clamp(b.x + Math.cos(ang) * outDist, 26, WORLD_SIZE - 26);
      u.y = clamp(b.y + Math.sin(ang) * outDist, 26, WORLD_SIZE - 26);
      u.onSite = false;
      u.buildTargetId = null;
      if (b.kind === 'extractor') {
        u.mode = 'harvest_gas';
        u.harvestId = b.id;
      } else {
        u.mode = 'harvest_min';
        u.harvestId = nearestMineral(u.x, u.y, 500)?.id ?? null;
      }
    }
  }
}

function applyUpgrade(state, owner, upgId, fxEvents) {
  const upgDef = UPGRADES[upgId];
  if (!upgDef) return;
  owner.upgrades = owner.upgrades || {};
  owner.upgrades[upgId] = true;
  fxEvents.push({ k: 'UPGRADE_DONE', ownerId: owner.id, upgId, name: upgDef.name });

  if (upgDef.hpMult) {
    const mult = upgDef.hpMult;
    for (const u of state.units) {
      if (u.owner === owner.id && upgDef.appliesTo.includes(u.kind)) {
        const baseDef = UNITS[u.kind];
        if (baseDef) {
          u.maxHp = Math.round(baseDef.hp * mult);
          u.hp = Math.min(u.maxHp, Math.round(u.hp * mult));
        }
      }
    }
  }
}

/* ---------- Limite de VCS par gisement (2 par cristal, 3 par Raffinerie) ---------- */
const MAX_SCV_PER_MINERAL = 2;
const MAX_SCV_PER_GAS = 3;

function nearestFreeMineral(owner, x, y, counts, maxDist = 560) {
  let best = null, bestD2 = maxDist * maxDist;
  for (const m of MINERAL_NODES) {
    if ((counts.get(owner + ':' + m.id) || 0) >= MAX_SCV_PER_MINERAL) continue;
    const d2 = dist2(x, y, m.x, m.y);
    if (d2 < bestD2) { bestD2 = d2; best = m; }
  }
  return best;
}

function enforceHarvestCaps(st, fxEvents) {
  const counts = new Map();
  const overflow = [];
  for (const u of st.units) {
    if (u.kind !== 'scv' || u.hp <= 0 || u.boardedIn) continue;
    let key = null, cap = 0;
    if (u.mode === 'harvest_min' && u.harvestId) { key = u.owner + ':' + u.harvestId; cap = MAX_SCV_PER_MINERAL; }
    else if (u.mode === 'harvest_gas' && u.harvestId) { key = u.owner + ':' + u.harvestId; cap = MAX_SCV_PER_GAS; }
    else if (u.mode === 'harvest_min') { overflow.push(u); continue; }
    if (!key) continue;
    const c = counts.get(key) || 0;
    if (c >= cap) overflow.push(u);
    else counts.set(key, c + 1);
  }
  for (const u of overflow) {
    const from = u.mode === 'harvest_gas'
      ? st.buildings.find((b) => b.id === u.harvestId) || u
      : MINERAL_NODES.find((m) => m.id === u.harvestId) || u;
    const m = nearestFreeMineral(u.owner, from.x, from.y, counts);
    if (m) {
      u.mode = 'harvest_min';
      u.harvestId = m.id;
      const key = u.owner + ':' + m.id;
      counts.set(key, (counts.get(key) || 0) + 1);
    } else {
      // Tous les gisements proches sont saturés : le VCS attend près de son QG
      u.mode = 'idle';
      u.harvestId = null;
      u.orderX = null;
      u.orderY = null;
      if (u.carryAmt > 0) {
        const owner = st.players.find((p) => p.id === u.owner);
        if (owner) {
          if (u.carryType === 'gas') owner.gas = Math.min(9999, owner.gas + u.carryAmt);
          else owner.minerals = Math.min(9999, owner.minerals + u.carryAmt);
        }
        u.carryAmt = 0; u.carryType = null;
      }
      fxEvents.push({ k: 'SATURATED', owner: u.owner, x: u.x, y: u.y });
    }
  }
  st.harvestCounts = counts;
}

function stepWorld(state, dt, fxEvents) {
  if (state.over) return;
  state.time += dt;
  flowBuildsLeft = FLOW_BUILDS_PER_TICK;
  syncPathBuildings(state);
  refreshSimVision(state);
  enforceHarvestCaps(state, fxEvents);

  const t = state.time;
  const p2At = state.blitz ? 120 : 210;
  const p3At = state.blitz ? 360 : 720;
  const sdAt = state.blitz ? 600 : 1350;
  const newPhase = t >= sdAt ? 4 : t >= p3At ? 3 : t >= p2At ? 2 : 1;
  if (newPhase !== state.phase) {
    state.phase = newPhase;
    fxEvents.push({ k: 'PHASE', phase: newPhase });
  }
  state.dmgMult = state.phase === 4 ? 1.85 : state.phase === 3 ? 1.2 : 1.0;

  if (state.phase === 4) {
    state.stormRadius = Math.max(380, state.stormRadius - (state.blitz ? 16 : 9) * dt);
  }

  for (let i = state.scans.length - 1; i >= 0; i--) {
    state.scans[i].timer -= dt;
    if (state.scans[i].timer <= 0) state.scans.splice(i, 1);
  }

  for (const p of state.players) {
    if (p.dead) continue;
    p.minerals = Math.min(9999, p.minerals + 1.25 * dt); // Réduit de 50% (auparavant 2.5)
    const myRefs = state.buildings.filter((b) => b.owner === p.id && b.kind === 'extractor' && b.hp > 0 && !b.constructing).length;
    if (myRefs > 0) p.gas = Math.min(9999, p.gas + myRefs * 1.1 * dt); // Réduit de 50% (auparavant 2.2)
  }

  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const owner = state.players.find((p) => p.id === b.owner);
    if (!owner || owner.dead) { b.hp = 0; continue; }
    const def = BUILDINGS[b.kind];

    if (state.phase === 4 && hypot(b.x, b.y, HALF_W, HALF_W) > state.stormRadius) {
      b.hp -= 35 * dt;
    }

    // Important : Un chantier en construction NE PROGRESSE PAS tout seul !
    // Il exige qu'un Ouvrier VCS soit physiquement SUR l'emplacement de construction.
    if (b.constructing) {
      if (b.buildProg >= 1) {
        finishBuildingConstruction(state, b, owner, fxEvents);
      }
      continue;
    }

    if (def.heal) {
      const r2 = def.range * def.range;
      for (const u of state.units) {
        if (u.team === b.team && u.hp < u.maxHp && dist2(b.x, b.y, u.x, u.y) <= r2) {
          u.hp = Math.min(u.maxHp, u.hp + def.heal * dt);
        }
      }
    }

    if (Array.isArray(b.queue) && b.queue.length > 0) {
      b.qTimer -= dt;
      if (b.qTimer <= 0) {
        const item = b.queue.shift();
        if (UPGRADES[item]) {
          applyUpgrade(state, owner, item, fxEvents);
        } else {
          spawnTrainedUnit(state, owner, b, item, fxEvents);
        }
        if (b.queue.length > 0) {
          const nextDef = UNITS[b.queue[0]] || UPGRADES[b.queue[0]];
          const nextTime = nextDef.trainTime ?? nextDef.time ?? 8;
          b.qTotal = state.blitz ? nextTime * 0.65 : nextTime;
          b.qTimer = b.qTotal;
        } else {
          b.qTimer = 0;
          b.qTotal = 0;
        }
      }
    }

    if (def.range > 0 && def.dmg > 0) {
      b.cd = Math.max(0, (b.cd || 0) - dt);
      if (b.cd <= 0) {
        let target = null, bestD2 = def.range * def.range;
        for (const u of state.units) {
          if (u.team !== b.team && u.hp > 0 && !u.boardedIn && canStrike(b, u)) {
            const d2 = dist2(b.x, b.y, u.x, u.y);
            if (d2 <= bestD2) { bestD2 = d2; target = u; }
          }
        }
        if (target) {
          b.cd = def.rate;
          b.aimA = Math.atan2(target.y - b.y, target.x - b.x);
          const dmg = def.dmg * state.dmgMult;
          target.hp -= dmg;
          if (def.splash) {
            const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
            const splashR = def.splash * (mapDef.splashMult || 1.0);
            const s2 = splashR * splashR;
            for (const u2 of state.units) {
              // Les passagers d'une navette sont à l'abri des éclaboussures
              if (u2 !== target && u2.team !== b.team && !u2.boardedIn && u2.hp > 0 && dist2(target.x, target.y, u2.x, u2.y) <= s2) {
                u2.hp -= dmg * 0.6;
              }
            }
          }
          fxEvents.push({
            k: b.kind === 'tesla' ? 'TESLA' : 'SHOT',
            x1: b.x, y1: b.y - 16, x2: target.x, y2: target.y, color: owner.color,
          });
        }
      }
    }
  }

  for (const u of state.units) {
    if (u.hp <= 0) continue;
    const def = UNITS[u.kind];
    const owner = state.players.find((p) => p.id === u.owner);
    if (!owner || owner.dead) { u.hp = 0; continue; }

    // Unités embarquées dans une navette de transport : suivent la navette et sont inactives
    if (u.boardedIn) {
      const dShip = state.units.find((d) => d.id === u.boardedIn && d.hp > 0);
      if (dShip) {
        u.x = dShip.x;
        u.y = dShip.y;
        u.vx = 0;
        u.vy = 0;
        continue;
      } else {
        u.boardedIn = null;
        u.mode = 'idle';
      }
    }

    // Troupes en train de rejoindre une navette pour embarquer
    if (u.mode === 'board' && u.targetEntId) {
      const dropship = state.units.find((x) => x.id === u.targetEntId && x.kind === 'dropship' && x.hp > 0);
      if (!dropship) {
        u.mode = 'idle';
        u.targetEntId = null;
      } else {
        dropship.cargo = dropship.cargo || [];
        const d = hypot(u.x, u.y, dropship.x, dropship.y);
        if (d <= dropship.radius + u.radius + 24) {
          if (dropship.cargo.length < (dropship.maxCargo || 4)) {
            dropship.cargo.push(u.id);
            u.boardedIn = dropship.id;
            u.mode = 'boarded';
            u.targetEntId = null;
            u.orderX = null;
            u.orderY = null;
            fxEvents.push({ k: 'BOARD', x: dropship.x, y: dropship.y, kind: u.kind });
            continue;
          } else {
            u.mode = 'idle';
            u.targetEntId = null;
          }
        } else {
          u.orderX = dropship.x;
          u.orderY = dropship.y;
        }
      }
    }

    // Navette Médicale : soin nanite automatique en continu des unités alliées au sol
    if (u.kind === 'medivac' && u.hp > 0) {
      let bestWounded = null, bestWoundDist = 190 * 190;
      for (const ally of state.units) {
        if (ally.team === u.team && ally.hp > 0 && ally.hp < ally.maxHp && !ally.flying && !ally.boardedIn) {
          const d2 = dist2(u.x, u.y, ally.x, ally.y);
          if (d2 <= bestWoundDist) {
            bestWoundDist = d2;
            bestWounded = ally;
          }
        }
      }
      if (bestWounded) {
        u.healingTargetId = bestWounded.id;
        bestWounded.hp = Math.min(bestWounded.maxHp, bestWounded.hp + (def.healRate || 24) * dt);
        u.a = Math.atan2(bestWounded.y - u.y, bestWounded.x - u.x);
        if (Math.random() < 0.28) {
          fxEvents.push({ k: 'HEAL_RAY', x1: u.x, y1: u.y, x2: bestWounded.x, y2: bestWounded.y });
        }
      } else {
        u.healingTargetId = null;
      }
    }

    if (u.stimT > 0) u.stimT = Math.max(0, u.stimT - dt);
    const stimMult = u.stimT > 0 ? 1.48 : 1.0;
    u.cd = Math.max(0, u.cd - dt * stimMult);

    if (u.kind === 'scv') {
      if (u.mode === 'build' && u.buildTargetId) {
        const bld = state.buildings.find((b) => b.id === u.buildTargetId && b.hp > 0);
        if (!bld) {
          u.mode = 'harvest_min';
          u.buildTargetId = null;
          u.onSite = false;
          const m = nearestMineral(u.x, u.y, 400);
          u.harvestId = m ? m.id : null;
        } else if (bld.constructing) {
          // CONSTRUCTION FAÇON STARCRAFT : Le VCS doit être PHYSIQUEMENT SUR l'endroit de construction !
          const distCenter = hypot(u.x, u.y, bld.x, bld.y);
          const siteRadius = Math.max(16, bld.radius * 0.72);
          if (distCenter <= siteRadius || u.onSite) {
            u.onSite = true;
            bld.buildStarted = true;

            // Le VCS se déplace d'un point de soudure à l'autre SUR la dalle du chantier
            u.weldTimer = (u.weldTimer || 0) - dt;
            if (u.weldTimer <= 0 || u.weldX == null || u.weldY == null) {
              u.weldTimer = 1.0 + Math.random() * 0.75;
              const wAng = Math.random() * TAU;
              const wR = bld.radius * (0.16 + Math.random() * 0.36);
              u.weldX = bld.x + Math.cos(wAng) * wR;
              u.weldY = bld.y + Math.sin(wAng) * wR;
            }
            const wx = u.weldX - u.x, wy = u.weldY - u.y;
            const wd = Math.hypot(wx, wy);
            if (wd > 3) {
              const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
              const moveMult = mapDef.moveSpeedMult || 1.0;
              const stepSpd = Math.min(wd, def.speed * moveMult * 0.55 * dt);
              u.vx = (wx / wd) * (def.speed * moveMult * 0.55);
              u.vy = (wy / wd) * (def.speed * moveMult * 0.55);
              u.x += (wx / wd) * stepSpd;
              u.y += (wy / wd) * stepSpd;
            } else {
              u.vx = 0; u.vy = 0;
            }
            // Oriente le chalumeau du VCS vers le cœur de la structure sur le chantier
            u.a = Math.atan2(bld.y - u.y, bld.x - u.x);

            const step = (1.0 / (bld.buildTime || 8)) * dt;
            bld.buildProg += step;
            bld.hp = Math.min(bld.maxHp, bld.hp + bld.maxHp * 0.85 * step);
            if (Math.random() < 0.48) {
              fxEvents.push({ k: 'SPARK', x: u.x + Math.cos(u.a) * 14, y: u.y + Math.sin(u.a) * 14, color: '#ffc531' });
            }
            if (bld.buildProg >= 1) {
              finishBuildingConstruction(state, bld, owner, fxEvents);
            }
            continue;
          } else {
            // En route vers le centre du chantier de construction
            u.orderX = bld.x;
            u.orderY = bld.y;
          }
        } else {
          // Réparation d'un bâtiment déjà construit
          u.onSite = false;
          const d = hypot(u.x, u.y, bld.x, bld.y) - bld.radius - u.radius;
          if (d <= 18) {
            u.a = Math.atan2(bld.y - u.y, bld.x - u.x);
            u.vx = 0; u.vy = 0;
            if (bld.hp < bld.maxHp && owner.minerals >= 1) {
              bld.hp = Math.min(bld.maxHp, bld.hp + 45 * dt);
              owner.minerals = Math.max(0, owner.minerals - 3 * dt);
              if (Math.random() < 0.35) fxEvents.push({ k: 'SPARK', x: u.x + Math.cos(u.a) * 14, y: u.y + Math.sin(u.a) * 14, color: '#ffc531' });
            } else {
              u.mode = bld.kind === 'extractor' ? 'harvest_gas' : 'harvest_min';
              u.harvestId = bld.kind === 'extractor' ? bld.id : (nearestMineral(u.x, u.y, 500)?.id ?? null);
              u.buildTargetId = null;
            }
            continue;
          } else {
            u.orderX = bld.x;
            u.orderY = bld.y;
          }
        }
      }

      if (u.mode === 'harvest_min' || u.mode === 'harvest_gas') {
        u.onSite = false;
        const hq = nearestMyHq(state, u.owner, u.x, u.y);
        if (u.carryAmt > 0 && hq) {
          const dHq = hypot(u.x, u.y, hq.x, hq.y) - hq.radius - u.radius;
          if (dHq <= 18) {
            if (u.carryType === 'gas') owner.gas = Math.min(9999, owner.gas + u.carryAmt);
            else owner.minerals = Math.min(9999, owner.minerals + u.carryAmt);
            owner.score += 2;
            u.carryAmt = 0;
            u.carryType = null;
            continue;
          } else {
            u.orderX = hq.x;
            u.orderY = hq.y;
          }
        } else if (u.mode === 'harvest_min') {
          let mNode = MINERAL_NODES.find((m) => m.id === u.harvestId) || nearestMineral(u.x, u.y);
          if (mNode) {
            u.harvestId = mNode.id;
            const dM = hypot(u.x, u.y, mNode.x, mNode.y) - 22 - u.radius;
            if (dM <= 16) {
              u.a = Math.atan2(mNode.y - u.y, mNode.x - u.x);
              u.vx = 0; u.vy = 0;
              u.gatherT = (u.gatherT || 0) + dt;
              if (Math.random() < 0.25) fxEvents.push({ k: 'MINE', x: mNode.x, y: mNode.y, color: mNode.rich ? '#ffc531' : '#1fc7c1' });
              const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
              if (u.gatherT >= (mapDef.mineHarvestTime || 1.55)) {
                u.gatherT = 0;
                u.carryType = mNode.rich ? 'gold' : 'min';
                u.carryAmt = mNode.rich ? 6 : 4; // Réduit de 50% (auparavant 12 / 8)
              }
              continue;
            } else {
              u.orderX = mNode.x;
              u.orderY = mNode.y;
            }
          }
        } else if (u.mode === 'harvest_gas') {
          const ref = state.buildings.find((b) => b.id === u.harvestId && b.owner === u.owner && b.kind === 'extractor' && b.hp > 0 && !b.constructing)
            || state.buildings.find((b) => b.owner === u.owner && b.kind === 'extractor' && b.hp > 0 && !b.constructing);
          if (ref) {
            u.harvestId = ref.id;
            const dR = hypot(u.x, u.y, ref.x, ref.y) - ref.radius - u.radius;
            if (dR <= 16) {
              u.a = Math.atan2(ref.y - u.y, ref.x - u.x);
              u.vx = 0; u.vy = 0;
              u.gatherT = (u.gatherT || 0) + dt;
              const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
              if (u.gatherT >= 1.7) {
                u.gatherT = 0;
                u.carryType = 'gas';
                u.carryAmt = Math.max(1, Math.round(3 * (mapDef.gasHarvestMult || 1.0))); // Réduit de 50% (auparavant 6)
              }
              continue;
            } else {
              u.orderX = ref.x;
              u.orderY = ref.y;
            }
          } else {
            u.mode = 'harvest_min';
          }
        }
      }
    }

    const effRange = u.sieged && def.siegeRange ? def.siegeRange : def.range;
    const effDmg = u.sieged && def.siegeDmg ? def.siegeDmg : def.dmg;
    const effRate = u.sieged && def.siegeRate ? def.siegeRate : def.rate;

    let bestTarget = null, bestScore = Infinity;
    if (u.mode !== 'move' && u.mode !== 'harvest_min' && u.mode !== 'harvest_gas' && u.mode !== 'build') {
      const aggroR = u.sieged || u.mode === 'hold' ? effRange : Math.max(255, effRange + 65);

      if (u.mode === 'focus' && u.targetEntId) {
        const fUnit = state.units.find((e) => e.id === u.targetEntId && e.hp > 0);
        const fBld = fUnit ? null : state.buildings.find((b) => b.id === u.targetEntId && b.hp > 0);
        const ent = fUnit || fBld;
        if (ent && ent.team !== u.team) {
          const d = hypot(u.x, u.y, ent.x, ent.y) - ent.radius;
          bestTarget = { ent, isBld: !!fBld, dist: d, blind: !canStrike(u, ent) };
        } else {
          u.mode = 'amove';
          u.targetEntId = null;
        }
      }

      if (!bestTarget && def.dmg > 0) {
        for (const e of state.units) {
          if (e.team === u.team || e.hp <= 0 || e.boardedIn) continue;
          if (e.flying && (u.kind === 'scv' || u.kind === 'siege' || u.kind === 'sapper')) continue;
          const d = hypot(u.x, u.y, e.x, e.y) - e.radius;
          if (d <= aggroR && canStrike(u, e)) {
            const prio = e.kind === 'scv' ? 35 : 0;
            if (d + prio < bestScore) { bestScore = d + prio; bestTarget = { ent: e, isBld: false, dist: d }; }
          }
        }
        for (const b of state.buildings) {
          if (b.team === u.team || b.hp <= 0) continue;
          const d = hypot(u.x, u.y, b.x, b.y) - b.radius;
          if (d <= aggroR + 30 && canStrike(u, b)) {
            const prio = b.kind === 'wall' ? (u.kind === 'sapper' ? -20 : 60) : (u.kind === 'sapper' ? -45 : 20);
            if (d + prio < bestScore) { bestScore = d + prio; bestTarget = { ent: b, isBld: true, dist: d }; }
          }
        }
      }
    }

    if (bestTarget && bestTarget.dist <= effRange && !bestTarget.blind) {
      const tgt = bestTarget.ent;
      u.a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      u.vx *= 0.4;
      u.vy *= 0.4;
      if (u.cd <= 0) {
        u.cd = effRate;
        let dmg = effDmg * state.dmgMult;
        if (owner?.upgrades) {
          if (['marine', 'rocket', 'sapper'].includes(u.kind) && owner.upgrades.infantry_weapons) dmg *= 1.25;
          if (['tank', 'siege', 'titan'].includes(u.kind) && owner.upgrades.vehicle_weapons) dmg *= 1.25;
        }
        if (bestTarget.isBld) dmg *= def.bldMult || 1;
        else if (u.kind === 'rocket' && UNITS[tgt.kind]?.mech) dmg *= 1.5;
        tgt.hp -= dmg;
        if (def.splash || u.sieged) {
          const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
          const splashR = (def.splash || 58) * (mapDef.splashMult || 1.0);
          const s2 = splashR * splashR;
          for (const e2 of state.units) {
            if (e2 === tgt || e2.team === u.team || e2.boardedIn || e2.hp <= 0) continue;
            // Une arme sol-sol n'éclabousse pas les appareils en vol
            if (e2.flying && (u.kind === 'siege' || u.kind === 'sapper')) continue;
            if (dist2(tgt.x, tgt.y, e2.x, e2.y) <= s2) e2.hp -= dmg * 0.55;
          }
        }
        owner.score += Math.round(dmg * 0.12);
        fxEvents.push({
          k: u.sieged || u.kind === 'siege' || u.kind === 'titan' ? 'PLASMA' : u.kind === 'rocket' ? 'ROCKET' : 'SHOT',
          x1: u.x, y1: u.y, x2: tgt.x, y2: tgt.y, color: owner.color,
        });
      }
      continue;
    }

    if (u.sieged || u.mode === 'hold') {
      u.vx = 0; u.vy = 0;
      continue;
    }

    let goalX = u.orderX, goalY = u.orderY;
    if (bestTarget && u.mode !== 'move') {
      goalX = bestTarget.ent.x;
      goalY = bestTarget.ent.y;
    }
    if (goalX == null || goalY == null) continue;
    // Point d'arrivée sur un bâtiment (ralliement mal placé) : arrivé dès qu'on le touche, sinon l'unité pousse indéfiniment
    const arriveR = pathBlocked[pathCellOf(goalX, goalY)] ? 18 + u.radius + 40 : 18;
    if (u.mode !== 'build' && dist2(u.x, u.y, goalX, goalY) <= arriveR * arriveR) {
      if (u.mode === 'move' || u.mode === 'amove') {
        u.orderX = null;
        u.orderY = null;
        u.mode = 'idle';
      }
      u.vx = 0; u.vy = 0;
      continue;
    }

    // Déplacement des unités aériennes (Navette de Transport, Navette Médicale) : vol direct sans collisions terrestres
    if (u.flying) {
      const dx = goalX - u.x, dy = goalY - u.y;
      const distGoal = Math.hypot(dx, dy) || 1;
      let steerX = dx / distGoal, steerY = dy / distGoal;
      for (const o of state.units) {
        if (o === u || o.hp <= 0 || !o.flying || o.boardedIn) continue;
        const sx = u.x - o.x, sy = u.y - o.y;
        const minSep = u.radius + o.radius + 6;
        const d2 = sx * sx + sy * sy;
        if (d2 > 0 && d2 < minSep * minSep) {
          const d = Math.sqrt(d2);
          const f = (minSep - d) / minSep;
          steerX += (sx / d) * f * 1.35;
          steerY += (sy / d) * f * 1.35;
        }
      }
      const sLen = Math.hypot(steerX, steerY) || 1;
      const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
      let upgSpdMult = 1.0;
      if (owner?.upgrades?.advanced_thrusters) upgSpdMult = 1.18;
      const spd = def.speed * (mapDef.moveSpeedMult || 1.0) * upgSpdMult;
      u.vx = (steerX / sLen) * spd;
      u.vy = (steerY / sLen) * spd;
      u.x = clamp(u.x + u.vx * dt, 24, WORLD_SIZE - 24);
      u.y = clamp(u.y + u.vy * dt, 24, WORLD_SIZE - 24);
      u.a = Math.atan2(u.vy || dy, u.vx || dx);
      continue;
    }

    // Le champ de flux vise le point cliqué commun à tout l'ordre, pas la place de chaque unité dans la formation
    const shared = !bestTarget && (u.mode === 'move' || u.mode === 'amove') && u.pathX != null;
    const wp = routeWaypoint(u, goalX, goalY, shared ? u.pathX : goalX, shared ? u.pathY : goalY, state.time);
    const steerTargetX = wp ? wp.x : goalX;
    const steerTargetY = wp ? wp.y : goalY;

    const dx = steerTargetX - u.x, dy = steerTargetY - u.y;
    const distGoal = Math.hypot(dx, dy) || 1;
    let steerX = dx / distGoal, steerY = dy / distGoal;

    const isScv = u.kind === 'scv';
    const lookAhead = isScv ? 14 : (u.radius + 32);
    const sideSign = (u.id % 2 === 0) ? 1 : -1;
    for (const b of state.buildings) {
      if (b.hp <= 0 || b.id === u.buildTargetId || b.id === u.harvestId) continue;
      if (b.constructing && !b.buildStarted) continue;
      if (isScv && u.carryAmt > 0 && b.owner === u.owner && b.kind === 'hq') continue;
      const ox = b.x - u.x, oy = b.y - u.y;
      const d = Math.hypot(ox, oy) || 1;
      const minClear = u.radius + b.radius + (isScv ? 2 : 10);
      if (d < minClear + lookAhead) {
        const dot = (ox / d) * steerX + (oy / d) * steerY;
        if (dot > -0.2) {
          // Contourne par le côté qui mène à l'objectif (un côté fixe faisait tourner l'unité en rond)
          const side = Math.sign(ox * steerY - oy * steerX) || sideSign;
          const tx = -oy / d * side, ty = ox / d * side;
          const push = ((minClear + lookAhead - d) / lookAhead) * (isScv ? 1.2 : 1.8);
          steerX += (tx - ox / d * (isScv ? 0.2 : 0.5)) * push;
          steerY += (ty - oy / d * (isScv ? 0.2 : 0.5)) * push;
        }
      }
    }
    for (const rk of ROCKS) {
      const ox = rk.x - u.x, oy = rk.y - u.y;
      const d = Math.hypot(ox, oy) || 1;
      const minClear = u.radius + rk.r + (isScv ? 2 : 10);
      if (d < minClear + lookAhead) {
        const side = Math.sign(ox * steerY - oy * steerX) || sideSign;
        const tx = -oy / d * side, ty = ox / d * side;
        const push = ((minClear + lookAhead - d) / lookAhead) * 1.9;
        steerX += (tx - ox / d * 0.5) * push;
        steerY += (ty - oy / d * 0.5) * push;
      }
    }
    for (const o of state.units) {
      if (o === u || o.hp <= 0) continue;
      if (u.kind === 'scv' && o.kind === 'scv') continue;
      const sx = u.x - o.x, sy = u.y - o.y;
      const minSep = u.radius + o.radius + 4;
      const d2 = sx * sx + sy * sy;
      if (d2 > 0 && d2 < minSep * minSep) {
        const d = Math.sqrt(d2);
        const f = (minSep - d) / minSep;
        steerX += (sx / d) * f * 1.35;
        steerY += (sy / d) * f * 1.35;
      }
    }

    const sLen = Math.hypot(steerX, steerY) || 1;
    const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
    let upgSpdMult = 1.0;
    if (owner?.upgrades?.advanced_thrusters && u.kind !== 'scv') upgSpdMult = 1.18;
    const spd = def.speed * stimMult * (mapDef.moveSpeedMult || 1.0) * upgSpdMult;
    u.vx = (steerX / sLen) * spd;
    u.vy = (steerY / sLen) * spd;

    const nextX = clamp(u.x + u.vx * dt, 24, WORLD_SIZE - 24);
    const nextY = clamp(u.y + u.vy * dt, 24, WORLD_SIZE - 24);

    if (terrainActive) {
      if (isBlockedAt(nextX, nextY)) {
        if (!isBlockedAt(nextX, u.y)) {
          u.x = nextX;
          u.vy = 0;
        } else if (!isBlockedAt(u.x, nextY)) {
          u.y = nextY;
          u.vx = 0;
        } else {
          u.vx = 0;
          u.vy = 0;
        }
      } else {
        u.x = nextX;
        u.y = nextY;
      }
      if (isBlockedAt(u.x, u.y)) {
        const l = nearestLand(u.x, u.y);
        const ldx = l.x - u.x, ldy = l.y - u.y;
        const ld = Math.hypot(ldx, ldy) || 1;
        u.x += (ldx / ld) * Math.min(ld, 160 * dt);
        u.y += (ldy / ld) * Math.min(ld, 160 * dt);
      }
    } else {
      u.x = nextX;
      u.y = nextY;
    }
    u.a = Math.atan2(u.vy || (steerTargetY - u.y), u.vx || (steerTargetX - u.x));

    for (const b of state.buildings) {
      if (b.hp <= 0) continue;
      // Le VCS qui construit ce chantier a le droit d'entrer SUR l'emplacement de construction !
      if (b.constructing && u.kind === 'scv' && u.buildTargetId === b.id) continue;
      if (b.constructing && !b.buildStarted) continue;
      const cx = u.x - b.x, cy = u.y - b.y;
      const minD = u.radius + (isScv ? b.radius * 0.94 : b.radius) + (isScv ? 0.5 : 2);
      const d2 = cx * cx + cy * cy;
      if (d2 < minD * minD) {
        const d = Math.sqrt(d2) || 1;
        const nx = cx / d, ny = cy / d;
        u.x = b.x + nx * minD;
        u.y = b.y + ny * minD;
        // Glissement tangentiel le long de la façade
        const vDot = u.vx * nx + u.vy * ny;
        if (vDot < 0) {
          u.vx -= vDot * nx;
          u.vy -= vDot * ny;
        }
      }
    }

    // Système d'expulsion anti-coincement si un VCS est pris en étau entre 2+ bâtiments
    if (isScv) {
      let stuckCount = 0, escX = 0, escY = 0;
      for (const b of state.buildings) {
        if (b.hp <= 0 || (b.constructing && u.buildTargetId === b.id)) continue;
        const cx = u.x - b.x, cy = u.y - b.y;
        const minD = u.radius + b.radius * 0.95;
        if (cx * cx + cy * cy < minD * minD) {
          stuckCount++;
          const d = Math.hypot(cx, cy) || 1;
          escX += cx / d;
          escY += cy / d;
        }
      }
      if (stuckCount >= 2) {
        const escLen = Math.hypot(escX, escY) || 1;
        u.x += (escX / escLen) * 3.5;
        u.y += (escY / escLen) * 3.5;
      }
    }
  }

  for (let i = state.units.length - 1; i >= 0; i--) {
    const u = state.units[i];
    if (u.hp <= 0) {
      // Un passager mort (joueur éliminé) libère sa place dans la navette
      if (u.boardedIn) {
        const ship = state.units.find((d) => d.id === u.boardedIn);
        if (ship && Array.isArray(ship.cargo)) ship.cargo = ship.cargo.filter((id) => id !== u.id);
      }
      if (u.kind === 'dropship' && Array.isArray(u.cargo) && u.cargo.length > 0) {
        for (const cId of u.cargo) {
          const pass = state.units.find((x) => x.id === cId);
          if (pass) {
            pass.boardedIn = null;
            pass.mode = 'idle';
            pass.x = clamp(u.x + (Math.random() - 0.5) * 44, 30, WORLD_SIZE - 30);
            pass.y = clamp(u.y + (Math.random() - 0.5) * 44, 30, WORLD_SIZE - 30);
            pass.hp = Math.max(1, Math.round(pass.hp * 0.5));
            fxEvents.push({ k: 'SPARK', x: pass.x, y: pass.y, color: '#ff4b2b' });
          }
        }
        u.cargo = [];
      }
      fxEvents.push({ k: 'BOOM', x: u.x, y: u.y, r: u.radius * 1.5 });
      state.units.splice(i, 1);
    }
  }
  for (let i = state.buildings.length - 1; i >= 0; i--) {
    const b = state.buildings[i];
    if (b.hp <= 0) {
      fxEvents.push({ k: 'BOOM_BIG', x: b.x, y: b.y, r: b.radius * 1.8 });
      const ownerId = b.owner;
      state.buildings.splice(i, 1);
      // Un invité ne voit qu'une partie des bâtiments : l'élimination est décidée par l'hôte seul
      const hasAnyHq = state.partial || state.buildings.some((ob) => ob.owner === ownerId && ob.kind === 'hq' && ob.hp > 0);
      if (!hasAnyHq) {
        const p = state.players.find((q) => q.id === ownerId);
        if (p && !p.dead) {
          p.dead = true;
          state.ranking.unshift(p.id);
          for (const ob of state.buildings) if (ob.owner === ownerId) ob.hp = 0;
          for (const ou of state.units) if (ou.owner === ownerId) ou.hp = 0;
          fxEvents.push({ k: 'ELIM', name: p.name, color: p.color });
        }
      }
    }
  }

  const aliveTeams = new Set(state.players.filter((p) => !p.dead && !p.spectator).map((p) => p.team));
  if (aliveTeams.size <= 1 && !state.partial) {
    state.over = true;
    // Plus personne debout (dernières bases tombées au même instant) : égalité, pas de vainqueur
    state.winnerTeam = aliveTeams.size ? [...aliveTeams][0] : null;
    const winners = state.players.filter((p) => !p.dead).sort((a, b) => b.score - a.score);
    for (const w of winners) w.score += 500;
    // Vainqueurs d'abord, du meilleur score au plus faible, puis les éliminés du dernier au premier tombé
    const fallen = state.ranking.filter((id) => !winners.some((w) => w.id === id));
    state.ranking = [...winners.map((w) => w.id), ...fallen];
    for (const p of state.players) {
      if (!state.ranking.includes(p.id)) state.ranking.push(p.id);
    }
  }
}
