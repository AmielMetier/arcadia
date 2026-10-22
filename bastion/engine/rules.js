// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Placement, état initial et commandes des joueurs.
'use strict';

/* ============================================================================
   RÈGLES DE PLACEMENT & RAVITAILLEMENT STARCRAFT
   ============================================================================ */
function computeSupply(state, ownerId) {
  let used = 0, max = 0;
  for (const b of state.buildings) {
    if (b.owner === ownerId && b.hp > 0 && !b.constructing) {
      max += BUILDINGS[b.kind]?.supply || 0;
    }
  }
  for (const u of state.units) {
    if (u.owner === ownerId && u.hp > 0) {
      used += UNITS[u.kind]?.supply || 1;
    }
  }
  for (const b of state.buildings) {
    if (b.owner === ownerId && b.hp > 0 && Array.isArray(b.queue)) {
      for (const qKind of b.queue) used += UNITS[qKind]?.supply || 1;
    }
  }
  return { used, max: Math.min(MAX_SUPPLY, max) };
}

function findGeyserAt(x, y, maxDist = 56) {
  let best = null, bestD2 = maxDist * maxDist;
  for (const g of GAS_GEYSERS) {
    const d2 = dist2(x, y, g.x, g.y);
    if (d2 <= bestD2) { bestD2 = d2; best = g; }
  }
  return best;
}

function hasCompletedBuilding(state, ownerId, kind) {
  return state.buildings.some((b) => b.owner === ownerId && b.kind === kind && b.hp > 0 && !b.constructing);
}

function canPlaceBuilding(state, ownerId, kind, x, y) {
  const def = BUILDINGS[kind];
  if (!def) return { ok: false, reason: 'Bâtiment inconnu.' };
  const player = state.players.find((p) => p.id === ownerId);
  if (!player || player.dead) return { ok: false, reason: 'Joueur éliminé.' };
  if (def.req && !hasCompletedBuilding(state, ownerId, def.req)) {
    return { ok: false, reason: `Requiert d’abord : ${BUILDINGS[def.req].name}.` };
  }
  if (player.minerals < def.min) return { ok: false, reason: `Pas assez de Minéraux (${def.min}💎 requis).` };
  if (player.gas < def.gas) return { ok: false, reason: `Pas assez de Gaz Plasma (${def.gas}🧪 requis).` };

  if (def.onGeyser) {
    const gey = findGeyserAt(x, y, 64);
    if (!gey) return { ok: false, reason: 'La Raffinerie doit être placée sur un Geyser de Gaz Plasma 🧪.' };
    const taken = state.buildings.some((b) => b.hp > 0 && dist2(b.x, b.y, gey.x, gey.y) < 35 * 35);
    if (taken) return { ok: false, reason: 'Ce Geyser de Gaz est déjà exploité.' };
    return { ok: true, snapX: gey.x, snapY: gey.y, geyserId: gey.id };
  }

  const margin = def.radius + 32;
  if (x < margin || y < margin || x > WORLD_SIZE - margin || y > WORLD_SIZE - margin) {
    return { ok: false, reason: 'Trop près du bord de la carte.' };
  }

  {
    const types = areaTypes(x, y, def.radius + (kind === 'wall' ? 2 : 8));
    if (types.has(T_LIQUID)) return { ok: false, reason: `Impossible de construire sur ${LIQUID_LABEL[activeMapId] || "l'eau"}.` };
    if (types.has(T_MOUNT)) return { ok: false, reason: 'Impossible de construire sur la montagne.' };
    if (types.has(T_CLIFF)) return { ok: false, reason: 'Trop près du bord de la falaise.' };
    if (types.has(T_RAMP) && kind !== 'wall') return { ok: false, reason: 'Les rampes doivent rester libres (seuls les Murs y sont permis).' };
  }

  const pad = kind === 'wall' ? 2 : 14;
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    const minDist = def.radius + b.radius + pad;
    if (dist2(x, y, b.x, b.y) < minDist * minDist) {
      return { ok: false, reason: 'Emplacement occupé par un bâtiment.' };
    }
  }
  for (const rk of ROCKS) {
    if (dist2(x, y, rk.x, rk.y) < (def.radius + rk.r + 6) ** 2) {
      return { ok: false, reason: 'Obstacle rocheux.' };
    }
  }
  for (const m of MINERAL_NODES) {
    const minD = kind === 'hq' ? def.radius + 45 : def.radius + 22;
    if (dist2(x, y, m.x, m.y) < minD * minD) {
      return { ok: false, reason: 'Trop près des gisements de minéraux.' };
    }
  }
  for (const gey of GAS_GEYSERS) {
    if (dist2(x, y, gey.x, gey.y) < (def.radius + 28) ** 2) {
      return { ok: false, reason: 'Réservé aux Raffineries de Gaz.' };
    }
  }
  return { ok: true, snapX: Math.round(x), snapY: Math.round(y) };
}

function nearestMineral(x, y, maxDist = 2000) {
  let best = null, bestD2 = maxDist * maxDist;
  for (const m of MINERAL_NODES) {
    const d2 = dist2(x, y, m.x, m.y);
    if (d2 < bestD2) { bestD2 = d2; best = m; }
  }
  return best;
}

function nearestMyHq(state, ownerId, x, y) {
  let best = null, bestD2 = Infinity;
  for (const b of state.buildings) {
    if (b.owner === ownerId && b.kind === 'hq' && b.hp > 0 && !b.constructing) {
      const d2 = dist2(x, y, b.x, b.y);
      if (d2 < bestD2) { bestD2 = d2; best = b; }
    }
  }
  return best;
}

/* ============================================================================
   CRÉATION DE L'ÉTAT INITIAL RTS (QG + 6 OUVRIERS VCS EN RÉCOLTE)
   ============================================================================ */
function createInitialState(roster, settings = {}) {
  const mapId = MAP_DEFS[settings.map] ? settings.map : (activeMapId || 'vallee');
  const modeStr = String(settings.mode || '');
  const is2v2 = modeStr.startsWith('2v2') && roster.length >= 2;
  const layout = is2v2 ? '2v2' : 'ffa';
  if (mapId !== activeMapId || layout !== activeLayout || MINERAL_NODES.length === 0) {
    initMap(mapId, layout);
  }
  const blitz = settings.pace === 'blitz';

  const humans = roster.filter((p) => !p.bot);
  const bots = roster.filter((p) => p.bot);

  const players = roster.map((p, idx) => {
    let team = p.id;
    if (is2v2) {
      if (modeStr === '2v2_duel') {
        // Duel : Humain 1 + Bot 1 (Équipe A) vs Humain 2 + Bot 2 (Équipe B)
        if (humans.length >= 2 && bots.length >= 2) {
          team = (p.id === humans[0].id || p.id === bots[0].id) ? 0 : 1;
        } else {
          team = idx % 2;
        }
      } else if (modeStr === '2v2_pvp') {
        // 2v2 Joueurs 1 & 2 vs Joueurs 3 & 4
        team = idx < 2 ? 0 : 1;
      } else {
        // Mode 2v2 Coopératif (par défaut : 2v2_coop ou 2v2) : HUMAINS ENSEMBLE VS BOTS !
        // Seul avec 3 bots : un bot vient compléter ton équipe pour faire un vrai 2 contre 2.
        if (humans.length > 0 && bots.length > 0) {
          // Bots alliés = places libres de l'équipe humaine, en gardant 2 bots adverses
          const allyBots = Math.min(Math.max(0, 2 - humans.length), Math.max(0, bots.length - 2));
          const botIdx = bots.findIndex((bt) => bt.id === p.id);
          team = !p.bot ? 0 : (botIdx < allyBots ? 0 : 1);
        } else {
          team = idx < 2 ? 0 : 1;
        }
      }
    }
    return {
      id: p.id,
      name: p.name,
      color: p.color || PALETTE[idx % PALETTE.length],
      bot: !!p.bot,
      team,
      upgrades: {},
      minerals: blitz ? 300 : 200,
      gas: blitz ? 100 : 50,
      dead: false,
      score: 0,
      nextUnitSeq: 20,
      ping: p.bot ? 0 : 16,
    };
  });

  let nextId = 1;
  const buildings = [];
  const units = [];

  // Emplacements de départ : en 2v2, les alliés sont côte à côte sur le même flanc
  const spawnOf = new Map();
  if (is2v2 && TEAM_SPAWNS) {
    const used = new Set();
    for (const t of [0, 1]) {
      const slots = TEAM_SPAWNS[t].slice();
      for (const p of players.filter((q) => q.team === t)) {
        const sp = slots.shift() || SPAWN_CORNERS.find((c) => !used.has(c));
        if (sp) { used.add(sp); spawnOf.set(p.id, sp); }
      }
    }
  }
  players.forEach((p, idx) => {
    const sp = spawnOf.get(p.id) || SPAWN_CORNERS[idx % SPAWN_CORNERS.length];
    p.spawnX = sp.x; p.spawnY = sp.y;
    const dirX = Math.sign(HALF_W - sp.x) || 1, dirY = Math.sign(HALF_W - sp.y) || 1;
    const mainDef = (MAP_FEATURES?.mains || []).find((m) => m.x === sp.x && m.y === sp.y);
    const rampA = mainDef ? mainDef.ramps[0] : Math.atan2(dirY, dirX);
    const hq = {
      id: nextId++, kind: 'hq', owner: p.id, team: p.team,
      x: sp.x, y: sp.y, hp: BUILDINGS.hq.hp, maxHp: BUILDINGS.hq.hp,
      radius: BUILDINGS.hq.radius, cd: 0, aimA: rampA,
      constructing: false, buildProg: 1, queue: [], qTimer: 0, qTotal: 0,
      rallyX: Math.round(sp.x + Math.cos(rampA) * 150), rallyY: Math.round(sp.y + Math.sin(rampA) * 150),
    };
    buildings.push(hq);

    const baseMinerals = MINERAL_NODES.filter((m) => hypot(m.x, m.y, sp.x, sp.y) < 220);
    for (let k = 0; k < 6; k++) {
      const mNode = baseMinerals[k % baseMinerals.length];
      const ang = Math.atan2((mNode ? mNode.y : sp.y) - sp.y, (mNode ? mNode.x : sp.x) - sp.x);
      units.push({
        id: nextId++, kind: 'scv', owner: p.id, team: p.team,
        x: Math.round(sp.x + Math.cos(ang) * 66 + (k - 2.5) * 14),
        y: Math.round(sp.y + Math.sin(ang) * 66 + (k - 2.5) * 14),
        vx: 0, vy: 0, a: ang,
        hp: UNITS.scv.hp, maxHp: UNITS.scv.hp, radius: UNITS.scv.radius,
        cd: 0, mode: 'harvest_min',
        harvestId: mNode ? mNode.id : null,
        gatherT: 0, carryType: null, carryAmt: 0,
        buildTargetId: null, orderX: null, orderY: null, targetEntId: null,
        stimT: 0, sieged: false,
        flying: false, cargo: [], boardedIn: null, healingTargetId: null,
      });
    }

    for (let k = 0; k < 2; k++) {
      units.push({
        id: nextId++, kind: 'marine', owner: p.id, team: p.team,
        x: sp.x + dirX * (95 + k * 22), y: sp.y + dirY * (75 - k * 20),
        vx: 0, vy: 0, a: Math.atan2(dirY, dirX),
        hp: UNITS.marine.hp, maxHp: UNITS.marine.hp, radius: UNITS.marine.radius,
        cd: 0, mode: 'idle', orderX: null, orderY: null, targetEntId: null,
        stimT: 0, sieged: false,
        flying: false, cargo: [], boardedIn: null, healingTargetId: null,
      });
    }
  });

  return {
    time: 0,
    blitz,
    map: mapId,
    mode: is2v2 ? '2v2' : 'ffa',
    is2v2,
    level: settings.level || 'normal',
    phase: 1,
    stormRadius: HALF_W * 1.45,
    dmgMult: 1.0,
    nextId,
    players,
    buildings,
    units,
    scans: [],
    over: false,
    winnerTeam: null,
    ranking: [],
  };
}

/* ============================================================================
   EXÉCUTION DES COMMANDES RTS (SERVEUR AUTORITAIRE / HÔTE)
   ============================================================================ */
function spawnTrainedUnit(state, owner, bld, kind, fxEvents) {
  const def = UNITS[kind];
  if (!def) return;
  let rx = bld.rallyX ?? (bld.x + Math.sign(HALF_W - bld.x) * 110);
  let ry = bld.rallyY ?? (bld.y + Math.sign(HALF_W - bld.y) * 110);
  // Point de ralliement tombé sur un bâtiment : on le décale sur la case libre la plus proche
  const rCell = pathCellOf(rx, ry);
  if (pathBlocked[rCell]) {
    const free = nearestFreeCell(rCell);
    rx = ((free % PATH_N) + 0.5) * PATH_CELL;
    ry = (((free / PATH_N) | 0) + 0.5) * PATH_CELL;
  }
  const angle = Math.atan2(ry - bld.y, rx - bld.x);
  const seq = (owner.nextUnitSeq = (owner.nextUnitSeq || 20) + 1);
  const jitter = (((seq * 37) % 100) / 100 - 0.5) * 32;
  const ux = clamp(bld.x + Math.cos(angle) * (bld.radius + def.radius + 10) - Math.sin(angle) * jitter, 30, WORLD_SIZE - 30);
  const uy = clamp(bld.y + Math.sin(angle) * (bld.radius + def.radius + 10) + Math.cos(angle) * jitter, 30, WORLD_SIZE - 30);
  const detId = (Number(owner.id) + 1) * 10000 + seq;
  let hpMult = 1.0;
  if (owner.upgrades) {
    if (['marine', 'rocket', 'sapper'].includes(kind) && owner.upgrades.infantry_armor) hpMult *= 1.25;
    if (['tank', 'siege', 'titan'].includes(kind) && owner.upgrades.vehicle_armor) hpMult *= 1.25;
  }
  const finalHp = Math.round(def.hp * hpMult);

  const u = {
    id: detId,
    kind,
    owner: owner.id,
    team: owner.team,
    x: ux,
    y: uy,
    vx: 0,
    vy: 0,
    a: angle,
    hp: finalHp,
    maxHp: finalHp,
    radius: def.radius,
    cd: 0,
    mode: 'amove',
    orderX: rx + (((seq * 53) % 100) / 100 - 0.5) * 28,
    orderY: ry + (((seq * 71) % 100) / 100 - 0.5) * 28,
    pathX: Math.round(rx),
    pathY: Math.round(ry),
    targetEntId: null,
    harvestId: null,
    gatherT: 0,
    carryType: null,
    carryAmt: 0,
    buildTargetId: null,
    stimT: 0,
    sieged: false,
    flying: !!def.flying,
    cargo: [],
    boardedIn: null,
    healingTargetId: null,
  };

  if (kind === 'scv') {
    const m = nearestMineral(rx, ry, 260) || nearestMineral(bld.x, bld.y, 350);
    if (m) {
      u.mode = 'harvest_min';
      u.harvestId = m.id;
      u.orderX = null;
      u.orderY = null;
    }
  }
  state.units.push(u);
  fxEvents.push({ k: 'SPAWN', x: ux, y: uy, color: owner.color });
}

/* ---------- Changement d'équipe en 2v2 : déplacer une base vers un autre emplacement ----------
   Les emplacements sont symétriques (miroir horizontal et/ou vertical), on reflète donc
   toutes les positions du joueur pour qu'il retrouve la même base de l'autre côté. */
function mirrorFnBetween(from, to) {
  const mx = Math.abs(from.x - to.x) > 1, my = Math.abs(from.y - to.y) > 1;
  return {
    x: (x) => (x == null ? x : mx ? WORLD_SIZE - x : x),
    y: (y) => (y == null ? y : my ? WORLD_SIZE - y : y),
    a: (a) => { let r = a || 0; if (mx) r = Math.PI - r; if (my) r = -r; return r; },
  };
}
function moveEntitiesBetweenSpawns(st, pl, to, ents = null) {
  const from = { x: pl.spawnX, y: pl.spawnY };
  const M = mirrorFnBetween(from, to);
  const mine = ents || {
    blds: st.buildings.filter((b) => b.owner === pl.id),
    units: st.units.filter((u) => u.owner === pl.id),
  };
  for (const b of mine.blds) {
    b.x = M.x(b.x); b.y = M.y(b.y);
    b.rallyX = M.x(b.rallyX); b.rallyY = M.y(b.rallyY);
    if (b.aimA != null) b.aimA = M.a(b.aimA);
  }
  for (const u of mine.units) {
    u.x = M.x(u.x); u.y = M.y(u.y);
    u.orderX = M.x(u.orderX); u.orderY = M.y(u.orderY);
    u.a = M.a(u.a); u.vx = 0; u.vy = 0;
    if (u.mode === 'harvest_min' && u.harvestId) {
      const old = MINERAL_NODES.find((m) => m.id === u.harvestId);
      if (old) {
        const tx = M.x(old.x), ty = M.y(old.y);
        const twin = MINERAL_NODES.reduce((best, m) => (dist2(m.x, m.y, tx, ty) < dist2(best.x, best.y, tx, ty) ? m : best), MINERAL_NODES[0]);
        u.harvestId = twin ? twin.id : null;
      }
    }
  }
  pl.spawnX = to.x; pl.spawnY = to.y;
}
function swapPlayerBases(st, a, b) {
  const entsA = { blds: st.buildings.filter((x) => x.owner === a.id), units: st.units.filter((x) => x.owner === a.id) };
  const entsB = { blds: st.buildings.filter((x) => x.owner === b.id), units: st.units.filter((x) => x.owner === b.id) };
  const spA = { x: a.spawnX, y: a.spawnY }, spB = { x: b.spawnX, y: b.spawnY };
  moveEntitiesBetweenSpawns(st, a, spB, entsA);
  moveEntitiesBetweenSpawns(st, b, spA, entsB);
}

// opts.authority : la commande vient de l'hôte (ou du jeu solo), ou a déjà été validée par lui.
// Une commande reçue d'un invité est exécutée sans autorité.
function executeCommand(state, playerId, cmd, fxEvents, opts = {}) {
  if (state.over || !cmd || typeof cmd !== 'object') return { ok: false };
  const p = state.players.find((q) => Number(q.id) === Number(playerId));
  if (!p || p.dead) return { ok: false };

  // 1. POSER UN CHANTIER DE CONSTRUCTION (exige un Ouvrier VCS qui se déplace sur place !)
  if (cmd.op === 'BUILD') {
    if (cmd.bldId && state.buildings.some((b) => b.id === cmd.bldId)) {
      return { ok: true, bldId: cmd.bldId };
    }
    const kind = String(cmd.kind || '');
    const check = canPlaceBuilding(state, p.id, kind, Number(cmd.x) || 0, Number(cmd.y) || 0);
    if (!check.ok) return check;

    const bx = check.snapX, by = check.snapY;
    let builder = null;
    if (Array.isArray(cmd.unitIds) && cmd.unitIds.length) {
      const candidates = state.units.filter((u) => Number(u.owner) === Number(p.id) && u.kind === 'scv' && u.hp > 0 && cmd.unitIds.includes(u.id));
      if (candidates.length) {
        candidates.sort((a, b) => {
          const pa = a.mode === 'build' ? 1e7 : 0;
          const pb = b.mode === 'build' ? 1e7 : 0;
          return (dist2(a.x, a.y, bx, by) + pa) - (dist2(b.x, b.y, bx, by) + pb);
        });
        builder = candidates[0];
      }
    }
    if (!builder) {
      // Fallback sur le VCS libre le plus proche du joueur si l'ID de sélection a glissé
      let bestD2 = Infinity;
      for (const u of state.units) {
        if (Number(u.owner) === Number(p.id) && u.kind === 'scv' && u.hp > 0 && u.mode !== 'build') {
          const d2 = dist2(u.x, u.y, bx, by);
          if (d2 < bestD2) { bestD2 = d2; builder = u; }
        }
      }
    }
    if (!builder) {
      return { ok: false, reason: 'Sélectionne d’abord un Ouvrier VCS pour construire !' };
    }

    const def = BUILDINGS[kind];
    p.minerals -= def.min;
    p.gas -= def.gas;
    const bld = {
      id: Number(cmd.bldId) || state.nextId++,
      kind,
      owner: p.id,
      team: p.team,
      x: bx,
      y: by,
      hp: Math.round(def.hp * 0.15),
      maxHp: def.hp,
      radius: def.radius,
      cd: 0,
      aimA: Math.atan2(HALF_W - by, HALF_W - bx),
      constructing: true,
      buildStarted: false,
      buildProg: 0,
      buildTime: state.blitz ? def.buildTime * 0.65 : def.buildTime,
      queue: [],
      qTimer: 0,
      qTotal: 0,
      rallyX: bx + Math.sign(HALF_W - bx) * 115,
      rallyY: by + Math.sign(HALF_W - by) * 115,
      geyserId: check.geyserId || null,
    };
    state.buildings.push(bld);
    p.score += Math.round((def.min + def.gas) * 0.35);

    builder.mode = 'build';
    builder.buildTargetId = bld.id;
    builder.onSite = false;
    builder.weldTimer = 0;
    builder.weldX = bx;
    builder.weldY = by;
    builder.orderX = bx;
    builder.orderY = by;
    fxEvents.push({ k: 'BUILD', x: bx, y: by, color: p.color, radius: def.radius });
    return { ok: true, bldId: bld.id };
  }

  // 2. ENTRAÎNER UNE UNITÉ DANS UN BÂTIMENT SÉLECTIONNÉ
  if (cmd.op === 'TRAIN') {
    const uKind = String(cmd.unit || '');
    const uDef = UNITS[uKind];
    if (!uDef) return { ok: false, reason: 'Unité inconnue.' };
    const sup = computeSupply(state, p.id);
    if (sup.used + uDef.supply > sup.max) {
      return { ok: false, reason: 'Ravitaillement insuffisant 📦 ! Clique sur un VCS et construis un Dépôt Relais.' };
    }
    if (p.minerals < uDef.min) return { ok: false, reason: `Minéraux insuffisants (${uDef.min}💎).` };
    if (p.gas < uDef.gas) return { ok: false, reason: `Gaz Plasma insuffisant (${uDef.gas}🧪).` };

    let producer = null;
    if (cmd.bldId) {
      const b = state.buildings.find((x) => x.id === cmd.bldId && Number(x.owner) === Number(p.id) && x.hp > 0 && !x.constructing);
      if (b && (BUILDINGS[b.kind]?.trains || []).includes(uKind) && b.queue.length < 5) {
        producer = b;
      }
    }
    if (!producer) {
      const candidates = state.buildings.filter((b) =>
        Number(b.owner) === Number(p.id) && b.hp > 0 && !b.constructing && (BUILDINGS[b.kind]?.trains || []).includes(uKind) && b.queue.length < 5
      );
      candidates.sort((a, b) => a.queue.length - b.queue.length);
      producer = candidates[0] || null;
    }

    if (!producer) {
      return { ok: false, reason: 'Clique sur le bâtiment de production correspondant (ou file pleine 5/5).' };
    }
    p.minerals -= uDef.min;
    p.gas -= uDef.gas;
    producer.queue.push(uKind);
    if (producer.queue.length === 1) {
      producer.qTotal = state.blitz ? uDef.trainTime * 0.65 : uDef.trainTime;
      producer.qTimer = producer.qTotal;
    }
    p.score += Math.round((uDef.min + uDef.gas) * 0.25);
    return { ok: true };
  }

  // 3. RECHERCHER UNE AMÉLIORATION DANS L'ARMURERIE TECH
  if (cmd.op === 'RESEARCH') {
    const upgId = String(cmd.upgId || '');
    const upgDef = UPGRADES[upgId];
    if (!upgDef) return { ok: false, reason: 'Amélioration inconnue.' };
    p.upgrades = p.upgrades || {};
    if (p.upgrades[upgId]) return { ok: false, reason: 'Amélioration déjà acquise !' };
    if (p.minerals < upgDef.min) return { ok: false, reason: `Minéraux insuffisants (${upgDef.min}💎 requis).` };
    if (p.gas < upgDef.gas) return { ok: false, reason: `Gaz Plasma insuffisant (${upgDef.gas}🧪 requis).` };

    let lab = null;
    if (cmd.bldId) {
      const b = state.buildings.find((x) => x.id === cmd.bldId && Number(x.owner) === Number(p.id) && x.hp > 0 && !x.constructing && x.kind === 'armory');
      if (b && Array.isArray(b.queue) && b.queue.length < 5 && !b.queue.includes(upgId)) lab = b;
    }
    if (!lab) {
      const labs = state.buildings.filter((b) => Number(b.owner) === Number(p.id) && b.hp > 0 && !b.constructing && b.kind === 'armory' && Array.isArray(b.queue) && b.queue.length < 5 && !b.queue.includes(upgId));
      lab = labs[0] || null;
    }
    if (!lab) return { ok: false, reason: 'Construis d’abord une Armurerie Tech pour lancer cette amélioration.' };

    p.minerals -= upgDef.min;
    p.gas -= upgDef.gas;
    lab.queue = lab.queue || [];
    lab.queue.push(upgId);
    if (lab.queue.length === 1) {
      lab.qTotal = state.blitz ? upgDef.time * 0.65 : upgDef.time;
      lab.qTimer = lab.qTotal;
    }
    p.score += Math.round((upgDef.min + upgDef.gas) * 0.35);
    fxEvents.push({ k: 'RESEARCH_START', bldId: lab.id, x: lab.x, y: lab.y, color: p.color });
    return { ok: true };
  }

  // 4. CHANGER D'ÉQUIPE (2v2)
  if (cmd.op === 'TOGGLE_TEAM') {
    if (!state.is2v2) return { ok: false, reason: 'Les équipes ne se changent qu’en 2 contre 2.' };
    if (state.time > 45) return { ok: false, reason: 'Changement d’équipe verrouillé après le début de la partie.' };
    const target = state.players.find((q) => Number(q.id) === Number(cmd.targetId));
    if (!target) return { ok: false };
    if (!opts.authority && Number(p.id) !== Number(target.id)) return { ok: false, reason: 'Seul l’hôte peut changer l’équipe d’un autre joueur.' };
    const fromTeam = target.team, toTeam = fromTeam === 0 ? 1 : 0;
    const setTeam = (pl, t) => {
      pl.team = t;
      for (const b of state.buildings) { if (b.owner === pl.id) b.team = t; }
      for (const u of state.units) { if (u.owner === pl.id) u.team = t; }
    };
    // En 2v2, les alliés gardent leurs bases côte à côte : on échange la base avec un joueur
    // de l'autre équipe (un bot de préférence), ou on s'installe sur une place libre de ce flanc.
    const others = state.players.filter((q) => q.team === toTeam && !q.dead && q.id !== target.id);
    let partner = null;
    if (state.is2v2 && others.length >= 2) {
      partner = others.find((q) => q.bot) || others[0];
    }
    if (state.is2v2 && TEAM_SPAWNS) {
      if (partner) {
        swapPlayerBases(state, target, partner);
        setTeam(partner, fromTeam);
      } else {
        const taken = state.players.filter((q) => q.id !== target.id).map((q) => `${q.spawnX},${q.spawnY}`);
        const free = TEAM_SPAWNS[toTeam].find((sp) => !taken.includes(`${sp.x},${sp.y}`));
        if (free) moveEntitiesBetweenSpawns(state, target, free);
      }
    }
    setTeam(target, toTeam);
    fxEvents.push({ k: 'TEAM_CHANGE', playerId: target.id, team: target.team, name: target.name, partnerId: partner ? partner.id : null });
    if (partner) fxEvents.push({ k: 'TEAM_CHANGE', playerId: partner.id, team: partner.team, name: partner.name, silent: true });
    return { ok: true };
  }

  // 5. ANNULER UNE UNITÉ OU AMÉLIORATION DE LA FILE DE PRODUCTION
  if (cmd.op === 'CANCEL_QUEUE') {
    const bld = state.buildings.find((b) => b.owner === p.id && b.id === cmd.bldId);
    if (!bld || !Array.isArray(bld.queue) || !bld.queue.length) return { ok: false };
    const idx = clamp(Number(cmd.slot) || 0, 0, bld.queue.length - 1);
    const itemKey = bld.queue.splice(idx, 1)[0];
    const itemDef = UNITS[itemKey] || UPGRADES[itemKey];
    if (itemDef) {
      p.minerals += itemDef.min;
      p.gas += itemDef.gas;
    }
    if (idx === 0) {
      if (bld.queue.length > 0) {
        const nextDef = UNITS[bld.queue[0]] || UPGRADES[bld.queue[0]];
        const nextTime = nextDef.trainTime ?? nextDef.time ?? 8;
        bld.qTotal = state.blitz ? nextTime * 0.65 : nextTime;
        bld.qTimer = bld.qTotal;
      } else {
        bld.qTimer = 0;
        bld.qTotal = 0;
      }
    }
    return { ok: true };
  }

  // 4. ORDRES D'UNITÉS : MOVE, AMOVE, STOP, HOLD, HARVEST, REPAIR, RALLY
  if (cmd.op === 'UNIT_ORDER') {
    const mode = String(cmd.mode || 'amove');
    const x = clamp(Math.round(Number(cmd.x) || HALF_W), 35, WORLD_SIZE - 35);
    const y = clamp(Math.round(Number(cmd.y) || HALF_W), 35, WORLD_SIZE - 35);
    const ids = Array.isArray(cmd.unitIds) ? new Set(cmd.unitIds) : new Set();

    if (Array.isArray(cmd.bldIds) && cmd.bldIds.length) {
      for (const b of state.buildings) {
        if (b.owner === p.id && cmd.bldIds.includes(b.id)) {
          b.rallyX = x;
          b.rallyY = y;
        }
      }
    }

    const mySelected = state.units.filter((u) => u.owner === p.id && ids.has(u.id) && !u.boardedIn);
    const count = mySelected.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));

    mySelected.forEach((u, idx) => {
      if (mode === 'stop') {
        u.mode = 'idle'; u.orderX = null; u.orderY = null; u.targetEntId = null; u.buildTargetId = null; u.onSite = false;
        return;
      }
      if (mode === 'hold') {
        u.mode = 'hold'; u.orderX = null; u.orderY = null; u.targetEntId = null; u.buildTargetId = null; u.onSite = false;
        return;
      }
      if (mode === 'harvest_min' && u.kind === 'scv') {
        u.mode = 'harvest_min';
        u.harvestId = cmd.resId || (nearestMineral(x, y)?.id ?? null);
        u.buildTargetId = null;
        u.onSite = false;
        return;
      }
      if (mode === 'harvest_gas' && u.kind === 'scv') {
        u.mode = 'harvest_gas';
        u.harvestId = cmd.resId || null;
        u.buildTargetId = null;
        u.onSite = false;
        return;
      }
      if (mode === 'build' && u.kind === 'scv' && cmd.targetId) {
        u.mode = 'build';
        u.buildTargetId = cmd.targetId;
        u.onSite = false;
        u.weldTimer = 0;
        const tb = state.buildings.find((b) => b.id === cmd.targetId);
        if (tb) { u.orderX = tb.x; u.orderY = tb.y; u.weldX = tb.x; u.weldY = tb.y; }
        return;
      }

      const row = Math.floor(idx / cols), col = idx % cols;
      const spacing = u.radius * 2.5 + 6;
      const fx = clamp(x + (col - (cols - 1) / 2) * spacing, 30, WORLD_SIZE - 30);
      const fy = clamp(y + (row - (Math.ceil(count / cols) - 1) / 2) * spacing, 30, WORLD_SIZE - 30);

      u.buildTargetId = null;
      u.onSite = false;
      if (mode === 'focus' && cmd.targetId) {
        u.mode = 'focus'; u.targetEntId = cmd.targetId; u.orderX = x; u.orderY = y;
      } else if (mode === 'move') {
        u.mode = 'move'; u.targetEntId = null; u.orderX = fx; u.orderY = fy; u.pathX = x; u.pathY = y;
      } else {
        u.mode = 'amove'; u.targetEntId = null; u.orderX = fx; u.orderY = fy; u.pathX = x; u.pathY = y;
      }
    });
    return { ok: true };
  }

  // 5. CAPACITÉ MICRO : STIMPACK (T)
  if (cmd.op === 'STIM') {
    const ids = new Set(Array.isArray(cmd.unitIds) ? cmd.unitIds : []);
    let count = 0;
    for (const u of state.units) {
      if (u.owner === p.id && ids.has(u.id) && UNITS[u.kind]?.canStim && u.hp > 20) {
        u.hp = Math.max(10, u.hp - 18);
        u.stimT = 8.0;
        count++;
        fxEvents.push({ k: 'STIM', x: u.x, y: u.y, color: '#ff4b2b' });
      }
    }
    return count > 0 ? { ok: true } : { ok: false, reason: 'Aucun Marine ou Maraudeur en état d’utiliser Stimpack.' };
  }

  // 6. CAPACITÉ MICRO : MODE SIÈGE (E)
  if (cmd.op === 'SIEGE') {
    const ids = new Set(Array.isArray(cmd.unitIds) ? cmd.unitIds : []);
    let count = 0;
    for (const u of state.units) {
      if (u.owner === p.id && ids.has(u.id) && UNITS[u.kind]?.canSiege) {
        u.sieged = !u.sieged;
        u.cd = Math.max(u.cd, 1.0);
        count++;
        fxEvents.push({ k: 'SIEGE', x: u.x, y: u.y, sieged: u.sieged });
      }
    }
    return count > 0 ? { ok: true } : { ok: false, reason: 'Sélectionne un Char de Siège.' };
  }

  // 7. CAPACITÉ COMSAT DU QG : SCAN RADAR (C - 50 Minéraux)
  if (cmd.op === 'SCAN') {
    if (p.minerals < 50) return { ok: false, reason: '50💎 requis pour lancer un Scan Radar.' };
    p.minerals -= 50;
    const x = clamp(Math.round(Number(cmd.x) || HALF_W), 60, WORLD_SIZE - 60);
    const y = clamp(Math.round(Number(cmd.y) || HALF_W), 60, WORLD_SIZE - 60);
    const mapDef = MAP_DEFS[state.map] || MAP_DEFS.vallee;
    const scanR = Math.round(380 * (mapDef.scanRadiusMult || 1.0));
    state.scans.push({ x, y, team: p.team, r: scanR, timer: 10.0 });
    fxEvents.push({ k: 'SCAN', x, y, color: '#1fc7c1', r: scanR });
    return { ok: true };
  }

  // 8. CAPACITÉ TACTIQUE : EMBARQUER DANS UNE NAVETTE DE TRANSPORT
  if (cmd.op === 'BOARD') {
    const dropship = state.units.find((x) => x.id === cmd.targetId && x.kind === 'dropship' && Number(x.owner) === Number(p.id) && x.hp > 0);
    if (!dropship) return { ok: false, reason: 'Navette de transport introuvable.' };
    const ids = new Set(Array.isArray(cmd.unitIds) ? cmd.unitIds : []);
    let count = 0;
    for (const u of state.units) {
      if (u.owner === p.id && ids.has(u.id) && !u.flying && !u.boardedIn && u.hp > 0) {
        u.mode = 'board';
        u.targetEntId = dropship.id;
        u.orderX = dropship.x;
        u.orderY = dropship.y;
        count++;
      }
    }
    return count > 0 ? { ok: true } : { ok: false, reason: 'Aucune troupe terrestre valide à embarquer.' };
  }

  // 9. CAPACITÉ TACTIQUE : DÉBARQUER TOUTES LES TROUPES (V)
  if (cmd.op === 'UNLOAD') {
    const dropship = state.units.find((x) => x.id === cmd.dropshipId && x.kind === 'dropship' && Number(x.owner) === Number(p.id) && x.hp > 0);
    if (!dropship) return { ok: false };
    if (!Array.isArray(dropship.cargo) || dropship.cargo.length === 0) {
      return { ok: false, reason: 'La navette est vide.' };
    }
    const passengers = dropship.cargo.slice();
    dropship.cargo = [];
    const n = passengers.length;
    for (let i = 0; i < n; i++) {
      const pId = passengers[i];
      const pass = state.units.find((x) => x.id === pId);
      if (pass) {
        pass.boardedIn = null;
        pass.mode = 'idle';
        const ang = (i / n) * TAU;
        const dist = dropship.radius + pass.radius + 14;
        let dropX = clamp(dropship.x + Math.cos(ang) * dist, 30, WORLD_SIZE - 30);
        let dropY = clamp(dropship.y + Math.sin(ang) * dist, 30, WORLD_SIZE - 30);
        if (isBlockedAt(dropX, dropY)) {
          const l = nearestLand(dropX, dropY);
          dropX = l.x; dropY = l.y;
        }
        pass.x = dropX;
        pass.y = dropY;
        pass.vx = 0; pass.vy = 0;
        pass.orderX = null; pass.orderY = null;
        fxEvents.push({ k: 'UNLOAD', x: dropX, y: dropY, kind: pass.kind });
      }
    }
    return { ok: true };
  }

  return { ok: false };
}
