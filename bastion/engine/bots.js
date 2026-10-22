// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Intelligence des bots.
'use strict';

/* ============================================================================
   INTELLIGENCE ARTIFICIELLE DES BOTS (MACRO & MICRO STARCRAFT)
   ============================================================================ */
// Cible d'un bot : il garde le même QG ennemi tant qu'il tient debout. Sinon il choisit le plus proche,
// en évitant ceux que les autres bots attaquent déjà (avant, tous les bots visaient le premier QG de la liste :
// celui de l'hôte).
function pickBotTarget(state, p, hq) {
  const hqs = state.buildings.filter((b) => b.team !== p.team && b.kind === 'hq' && b.hp > 0);
  const kept = hqs.find((b) => b.id === p.botTargetId);
  if (kept) return kept;
  const takenBy = (owner) => state.players.filter((q) => q.bot && q.id !== p.id && !q.dead
    && state.buildings.some((b) => b.id === q.botTargetId && b.owner === owner && b.hp > 0)).length;
  let best = null, bestScore = Infinity;
  for (const b of hqs) {
    // Petit écart propre à chaque paire attaquant/cible pour départager les distances égales des cartes symétriques
    const tie = ((p.id * 7919 + b.owner * 104729) % 97) * 3;
    const score = hypot(hq.x, hq.y, b.x, b.y) + takenBy(b.owner) * 1600 + tie;
    if (score < bestScore) { bestScore = score; best = b; }
  }
  p.botTargetId = best ? best.id : null;
  return best || state.buildings.find((b) => b.team !== p.team && b.hp > 0) || null;
}

function runBots(state, fxEvents) {
  if (state.over) return;
  for (const p of state.players) {
    if (!p.bot || p.dead) continue;
    const myBlds = state.buildings.filter((b) => b.owner === p.id && b.hp > 0);
    const hq = myBlds.find((b) => b.kind === 'hq');
    if (!hq) continue;

    const myUnits = state.units.filter((u) => u.owner === p.id && u.hp > 0);
    const scvs = myUnits.filter((u) => u.kind === 'scv');
    const army = myUnits.filter((u) => u.kind !== 'scv');
    const sup = computeSupply(state, p.id);

    const refs = myBlds.filter((b) => b.kind === 'extractor').length;
    const rax = myBlds.filter((b) => b.kind === 'barracks').length;
    const fac = myBlds.filter((b) => b.kind === 'factory').length;
    const tur = myBlds.filter((b) => b.kind === 'turret' || b.kind === 'tesla').length;

    const dirX = Math.sign(HALF_W - hq.x) || 1;
    const dirY = Math.sign(HALF_W - hq.y) || 1;

    // Couloirs à garder libres : du QG vers chaque rampe de son plateau (sinon le bot s'emmure et son armée ne sort plus)
    const main = (MAP_FEATURES?.mains || []).find((m) => hypot(m.x, m.y, hq.x, hq.y) < 60);
    const lanes = main ? main.ramps.map((a) => [hq.x, hq.y, main.x + Math.cos(a) * (main.r + RAMP_LEN * 0.6), main.y + Math.sin(a) * (main.r + RAMP_LEN * 0.6)]) : [];
    const leavesRoom = (kind, x, y) => {
      const r = BUILDINGS[kind].radius;
      if (kind !== 'extractor' && lanes.some((l) => segDist(x, y, l[0], l[1], l[2], l[3]) < r + 70)) return false;
      // Un vrai passage entre deux bâtiments, assez large pour un Thor
      return !myBlds.some((b) => b.kind !== 'extractor' && hypot(x, y, b.x, b.y) < r + b.radius + 56);
    };
    const tryBuildNear = (kind, ax, ay, minR = 75, maxR = 230) => {
      for (let k = 0; k < 30; k++) {
        const ang = Math.random() * TAU;
        const r = minR + Math.random() * (maxR - minR);
        const x = ax + Math.cos(ang) * r, y = ay + Math.sin(ang) * r;
        if (leavesRoom(kind, x, y) && canPlaceBuilding(state, p.id, kind, x, y).ok) {
          return executeCommand(state, p.id, { op: 'BUILD', kind, x, y }, fxEvents).ok;
        }
      }
      return false;
    };

    // Si un chantier du bot n'a plus de VCS attitré, y envoyer un VCS libre
    for (const cb of myBlds) {
      if (cb.constructing && !scvs.some((u) => u.mode === 'build' && u.buildTargetId === cb.id)) {
        const freeBuilder = scvs.find((u) => u.mode !== 'build');
        if (freeBuilder) {
          freeBuilder.mode = 'build';
          freeBuilder.buildTargetId = cb.id;
          freeBuilder.onSite = false;
          freeBuilder.orderX = cb.x;
          freeBuilder.orderY = cb.y;
        }
      }
    }

    if (sup.max - sup.used <= 3 && sup.max < MAX_SUPPLY && p.minerals >= 75) {
      if (tryBuildNear('pylon', hq.x + dirX * 90, hq.y + dirY * 90, 65, 195)) continue;
    }
    if (scvs.length < 11 && hq.queue.length < 2 && p.minerals >= 50) {
      executeCommand(state, p.id, { op: 'TRAIN', unit: 'scv', bldId: hq.id }, fxEvents);
    }
    const maxRefs = (state.map === 'magma') ? 2 : 1;
    if (refs < maxRefs && scvs.length >= (refs === 0 ? 7 : 10) && p.minerals >= 75) {
      const nearbyGeysers = GAS_GEYSERS.filter((g) => hypot(g.x, g.y, hq.x, hq.y) < 260);
      for (const gey of nearbyGeysers) {
        const taken = state.buildings.some((b) => b.hp > 0 && dist2(b.x, b.y, gey.x, gey.y) < 35 * 35);
        if (!taken) {
          executeCommand(state, p.id, { op: 'BUILD', kind: 'extractor', x: gey.x, y: gey.y }, fxEvents);
          break;
        }
      }
    }
    const readyRefs = myBlds.filter((b) => b.kind === 'extractor' && !b.constructing);
    for (const readyRef of readyRefs) {
      const gasScvs = scvs.filter((u) => u.mode === 'harvest_gas' && u.harvestId === readyRef.id);
      if (gasScvs.length < 2) {
        const freeScv = scvs.find((u) => u.mode === 'harvest_min');
        if (freeScv) { freeScv.mode = 'harvest_gas'; freeScv.harvestId = readyRef.id; }
      }
    }

    if (rax < 1 && p.minerals >= 125) {
      if (tryBuildNear('barracks', hq.x + dirX * 135, hq.y + dirY * 45, 50, 140)) continue;
    }
    if (rax >= 1 && fac < 1 && p.minerals >= 150 && p.gas >= 75) {
      if (tryBuildNear('factory', hq.x + dirX * 60, hq.y + dirY * 140, 55, 150)) continue;
    }
    if (tur < 2 && rax >= 1 && p.minerals >= 125) {
      const tKind = (state.map === 'magma' || (p.gas >= 50 && Math.random() < 0.5)) ? 'tesla' : 'turret';
      if (tryBuildNear(tKind, hq.x + dirX * 165, hq.y + dirY * 165, 35, 110)) continue;
    }
    const arm = myBlds.filter((b) => b.kind === 'armory').length;
    if (rax >= 1 && arm < 1 && p.minerals >= 125 && p.gas >= 50) {
      if (tryBuildNear('armory', hq.x - dirX * 50, hq.y + dirY * 130, 45, 140)) continue;
    }
    const rad = myBlds.filter((b) => b.kind === 'radar').length;
    if (rax >= 1 && rad < 1 && state.time > 150 && p.minerals >= 140 && p.gas >= 25) {
      if (tryBuildNear('radar', hq.x + dirX * 170, hq.y + dirY * 170, 20, 120)) continue;
    }
    const spPort = myBlds.filter((b) => b.kind === 'starport').length;
    if (fac >= 1 && spPort < 1 && p.minerals >= 150 && p.gas >= 100) {
      if (tryBuildNear('starport', hq.x - dirX * 110, hq.y - dirY * 90, 50, 160)) continue;
    }
    const readyArm = myBlds.find((b) => b.kind === 'armory' && !b.constructing && (!b.queue || b.queue.length === 0));
    if (readyArm) {
      p.upgrades = p.upgrades || {};
      const upgOrder = ['infantry_weapons', 'infantry_armor', 'vehicle_weapons', 'vehicle_armor', 'advanced_thrusters'];
      for (const uid of upgOrder) {
        if (!p.upgrades[uid]) {
          const uDef = UPGRADES[uid];
          if (p.minerals >= uDef.min && p.gas >= uDef.gas) {
            executeCommand(state, p.id, { op: 'RESEARCH', upgId: uid, bldId: readyArm.id }, fxEvents);
            break;
          }
        }
      }
    }
    if (spPort >= 1) {
      const spBld = myBlds.find((b) => b.kind === 'starport' && !b.constructing && (!b.queue || b.queue.length < 2));
      if (spBld) {
        const medCount = myUnits.filter((u) => u.kind === 'medivac').length;
        if (medCount < 2 && p.minerals >= 75 && p.gas >= 75) {
          executeCommand(state, p.id, { op: 'TRAIN', unit: 'medivac', bldId: spBld.id }, fxEvents);
        } else if (p.minerals >= 100 && p.gas >= 50 && Math.random() < 0.35) {
          executeCommand(state, p.id, { op: 'TRAIN', unit: 'dropship', bldId: spBld.id }, fxEvents);
        }
      }
    }
    if (rax < 2 && fac >= 1 && p.minerals >= 180) {
      if (tryBuildNear('barracks', hq.x + dirX * 140, hq.y - dirY * 50, 55, 160)) continue;
    }

    if (state.map === 'magma') {
      // Magma : surabondance de gaz -> priorité absolue aux Titans, Chars de Siège et Faucheurs
      if (fac >= 1 && p.minerals >= 250 && p.gas >= 150) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'titan' }, fxEvents);
      } else if (fac >= 1 && p.minerals >= 150 && p.gas >= 100) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'siege' }, fxEvents);
      } else if (fac >= 1 && p.minerals >= 125 && p.gas >= 50 && Math.random() < 0.6) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'tank' }, fxEvents);
      } else if (rax >= 1 && p.minerals >= 75 && p.gas >= 50 && Math.random() < 0.7) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'sapper' }, fxEvents);
      } else if (rax >= 1 && p.minerals >= 75 && p.gas >= 25) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'rocket' }, fxEvents);
      } else if (rax >= 1 && p.minerals >= 50) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'marine' }, fxEvents);
      }
    } else {
      if (fac >= 1 && p.minerals >= 250 && p.gas >= 150) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'titan' }, fxEvents);
      } else if (fac >= 1 && p.minerals >= 150 && p.gas >= 100 && Math.random() < 0.55) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'siege' }, fxEvents);
      } else if (fac >= 1 && p.minerals >= 125 && p.gas >= 50) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'tank' }, fxEvents);
      }
      if (rax >= 1 && p.minerals >= 75 && p.gas >= 25 && Math.random() < 0.6) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: Math.random() < 0.65 ? 'rocket' : 'sapper' }, fxEvents);
      } else if (rax >= 1 && p.minerals >= 50) {
        executeCommand(state, p.id, { op: 'TRAIN', unit: 'marine' }, fxEvents);
      }
    }

    const waveSize = state.level === 'expert' ? 6 : state.level === 'facile' ? 10 : 8;
    // Armée disponible : au repos, ou encore sur le plateau de sa base (ralliement compris)
    const idleArmy = army.filter((u) => !u.boardedIn && (u.mode === 'idle' || hypot(u.x, u.y, hq.x, hq.y) < MAIN_R + 140));
    if (idleArmy.length >= waveSize) {
      const enemyBld = pickBotTarget(state, p, hq);
      if (enemyBld) {
        executeCommand(state, p.id, {
          op: 'UNIT_ORDER',
          mode: 'amove',
          x: enemyBld.x,
          y: enemyBld.y,
          unitIds: idleArmy.map((u) => u.id),
        }, fxEvents);
      }
    }
  }
}
