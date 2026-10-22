// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Intelligence des bots.
'use strict';

/* ============================================================================
   INTELLIGENCE ARTIFICIELLE DES BOTS
   Trois niveaux qui jouent vraiment différemment :
   - Facile : une base, peu de production, pas d'amélioration, attaque en masse sans micro.
   - Moyen : s'étend, monte ses améliorations, Stimpack et Mode Siège, recule s'il perd, envoie un éclaireur.
   - Difficile : s'étend tôt, plus de production et de VCS, améliorations au maximum, largages en Navette.
   Les bots ne voient que ce que leur équipe voit (brouillard de guerre), sauf l'emplacement des bases de départ.
   En 2 contre 2 coop, un bot allié défend la base de son coéquipier humain et suit ses attaques.
   ============================================================================ */
const BOT_LEVELS = {
  facile: {
    scvPerBase: 12, maxScv: 16, refsPerBase: 1, maxRax: 1, maxFac: 1, maxPort: 0, maxBases: 1, expandAt: 0,
    upgradeLevel: 0, attackSupply: 16, defenses: 1, micro: false, retreat: false, scout: false, drops: false,
  },
  normal: {
    scvPerBase: 16, maxScv: 36, refsPerBase: 2, maxRax: 2, maxFac: 1, maxPort: 1, maxBases: 2, expandAt: 330,
    upgradeLevel: 2, attackSupply: 24, defenses: 2, micro: true, retreat: true, scout: true, drops: false,
  },
  expert: {
    scvPerBase: 18, maxScv: 44, refsPerBase: 2, maxRax: 3, maxFac: 2, maxPort: 1, maxBases: 3, expandAt: 220,
    upgradeLevel: 3, attackSupply: 30, defenses: 2, micro: true, retreat: true, scout: true, drops: true,
  },
};
const UNIT_DPS = (k) => (UNITS[k] && UNITS[k].rate ? UNITS[k].dmg / UNITS[k].rate : 0);
const COMBAT_KINDS = ['marine', 'rocket', 'sapper', 'tank', 'siege', 'titan'];

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

// Force d'un groupe : points de vie × dégâts par seconde
function groupStrength(units) {
  let s = 0;
  for (const u of units) s += Math.max(0, u.hp) * (UNIT_DPS(u.kind) + 2);
  return s;
}
function centroid(units) {
  let x = 0, y = 0;
  for (const u of units) { x += u.x; y += u.y; }
  return { x: x / units.length, y: y / units.length };
}

// Emplacement d'expansion libre le plus proche : base avancée dont il reste des cristaux et où personne n'est installé
function findExpansion(state, p, from) {
  const spots = (MAP_FEATURES?.expos || []).filter((e) =>
    !state.buildings.some((b) => b.kind === 'hq' && b.hp > 0 && hypot(b.x, b.y, e.x, e.y) < 420)
    && MINERAL_NODES.some((m) => hypot(m.x, m.y, e.x, e.y) < 200 && mineralAlive(state, m)));
  spots.sort((a, b) => hypot(a.x, a.y, from.x, from.y) - hypot(b.x, b.y, from.x, from.y));
  for (const e of spots.slice(0, 3)) {
    for (const [ox, oy] of [[0, 0], [24, 0], [-24, 0], [0, 24], [0, -24], [40, 40], [-40, -40]]) {
      if (canPlaceBuilding(state, p.id, 'hq', e.x + ox, e.y + oy, { ignoreCost: true }).ok) return { x: e.x + ox, y: e.y + oy };
    }
  }
  return null;
}

function runBots(state, fxEvents) {
  if (state.over) return;
  for (const p of state.players) {
    // Les bots, et les joueurs partis ou déconnectés dont un bot garde la base
    if ((!p.bot && !p.afk) || p.dead || p.spectator) continue;
    const L = BOT_LEVELS[p.botLevel || state.level] || BOT_LEVELS.normal;
    runOneBot(state, p, L, fxEvents);
  }
}

function runOneBot(state, p, L, fxEvents) {
  const ai = p.ai || (p.ai = { attacking: false, regroupUntil: 0, scouted: false, dropState: null });
  const order = (cmd) => executeCommand(state, p.id, cmd, fxEvents, { authority: true });
  const myBlds = state.buildings.filter((b) => b.owner === p.id && b.hp > 0);
  const hqs = myBlds.filter((b) => b.kind === 'hq');
  if (!hqs.length) return;
  // Base principale : celle du point de départ (sinon la première encore debout)
  const hq = hqs.find((b) => hypot(b.x, b.y, p.spawnX, p.spawnY) < 80) || hqs[0];
  const readyHqs = hqs.filter((b) => !b.constructing);

  const myUnits = state.units.filter((u) => u.owner === p.id && u.hp > 0);
  const scvs = myUnits.filter((u) => u.kind === 'scv');
  const army = myUnits.filter((u) => COMBAT_KINDS.includes(u.kind) && !u.boardedIn);
  const sup = computeSupply(state, p.id);
  const count = (kind) => myBlds.filter((b) => b.kind === kind).length;
  const refs = count('extractor'), rax = count('barracks'), fac = count('factory'), port = count('starport');
  const tur = count('turret') + count('tesla');

  const dirX = Math.sign(HALF_W - hq.x) || 1;
  const dirY = Math.sign(HALF_W - hq.y) || 1;

  // Couloirs à garder libres : du QG vers chaque rampe de son plateau (sinon le bot s'emmure et son armée ne sort plus)
  const main = (MAP_FEATURES?.mains || []).find((m) => hypot(m.x, m.y, hq.x, hq.y) < 60);
  const lanes = main ? main.ramps.map((a) => [hq.x, hq.y, main.x + Math.cos(a) * (main.r + RAMP_LEN * 0.6), main.y + Math.sin(a) * (main.r + RAMP_LEN * 0.6)]) : [];
  const leavesRoom = (kind, x, y, gap = 56) => {
    const r = BUILDINGS[kind].radius;
    if (kind !== 'extractor' && lanes.some((l) => segDist(x, y, l[0], l[1], l[2], l[3]) < r + 70)) return false;
    // Un vrai passage entre deux bâtiments, assez large pour un Thor
    return !myBlds.some((b) => b.kind !== 'extractor' && hypot(x, y, b.x, b.y) < r + b.radius + gap);
  };
  // Cherche autour du point visé, puis autour des autres bases, en resserrant l'espacement si la base est pleine
  const tryBuildNear = (kind, ax, ay, minR = 75, maxR = 230) => {
    const anchors = [[ax, ay, minR, maxR], ...hqs.filter((b) => b !== hq).map((b) => [b.x, b.y, 90, 260]), [hq.x, hq.y, 90, MAIN_R - 30]];
    for (const gap of [56, 34]) {
      for (const [cx, cy, r0, r1] of anchors) {
        for (let k = 0; k < 24; k++) {
          const ang = Math.random() * TAU;
          const r = r0 + Math.random() * (r1 - r0);
          const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
          if (leavesRoom(kind, x, y, gap) && canPlaceBuilding(state, p.id, kind, x, y).ok) {
            return order({ op: 'BUILD', kind, x, y }).ok;
          }
        }
      }
    }
    return false;
  };

  // ---------- Économie ----------
  // Un chantier sans VCS attitré reçoit un VCS libre
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
  // VCS au repos (gisement épuisé ou saturé) : vers une base qui a encore de la place
  const idleScvs = scvs.filter((u) => u.mode === 'idle');
  if (idleScvs.length) {
    const base = readyHqs.find((b) => {
      const mins = MINERAL_NODES.filter((m) => hypot(m.x, m.y, b.x, b.y) < 260 && mineralAlive(state, m));
      const busy = scvs.filter((u) => u.mode === 'harvest_min' && mins.some((m) => m.id === u.harvestId)).length;
      return mins.length && busy < mins.length * 2;
    });
    if (base) order({ op: 'UNIT_ORDER', mode: 'harvest_min', x: base.x, y: base.y, unitIds: idleScvs.map((u) => u.id) });
  }

  const production = rax + fac + port;
  if (sup.max - sup.used <= 3 + production * 2 && sup.max < MAX_SUPPLY && p.minerals >= 75 && !myBlds.some((b) => b.kind === 'pylon' && b.constructing)) {
    if (tryBuildNear('pylon', hq.x + dirX * 90, hq.y + dirY * 90, 65, 210)) return;
  }
  const wantScv = Math.min(L.maxScv, L.scvPerBase * readyHqs.length + refs * 3);
  if (scvs.length < wantScv && p.minerals >= 50) {
    for (const b of readyHqs) {
      if (b.queue.length < 2 && scvs.length < wantScv) order({ op: 'TRAIN', unit: 'scv', bldId: b.id });
    }
  }
  // Expansion : à l'heure prévue par le niveau, ou plus tôt si la base principale s'épuise
  const mainMins = MINERAL_NODES.filter((m) => hypot(m.x, m.y, hq.x, hq.y) < 260);
  const mainLeft = mainMins.reduce((a, m) => a + Math.max(0, state.mineralLeft?.[m.id] ?? 1000), 0);
  const runningDry = mainMins.length && mainLeft < mainMins.length * 450;
  const expandDue = hqs.length < L.maxBases && !hqs.some((b) => b.constructing)
    && ((L.expandAt && state.time > L.expandAt * hqs.length) || runningDry);
  if (expandDue) {
    const spot = findExpansion(state, p, hq);
    if (spot && p.minerals >= 350 && order({ op: 'BUILD', kind: 'hq', x: spot.x, y: spot.y }).ok) return;
    // On met de côté pour le nouveau QG : pas d'autre dépense en minéraux tant qu'il n'est pas lancé
    if (spot && !(sup.max - sup.used <= 2)) return;
  }
  // Raffineries près des bases, et 3 VCS par raffinerie
  if (refs < L.refsPerBase * readyHqs.length && scvs.length >= (refs === 0 ? 9 : 14) && p.minerals >= 75) {
    for (const b of readyHqs) {
      const gey = GAS_GEYSERS.find((g) => hypot(g.x, g.y, b.x, b.y) < 260
        && !state.buildings.some((x) => x.hp > 0 && dist2(x.x, x.y, g.x, g.y) < 35 * 35));
      if (gey) { order({ op: 'BUILD', kind: 'extractor', x: gey.x, y: gey.y }); break; }
    }
  }
  for (const r of myBlds.filter((b) => b.kind === 'extractor' && !b.constructing && (b.remaining ?? 1) > 0)) {
    const onGas = scvs.filter((u) => u.mode === 'harvest_gas' && u.harvestId === r.id).length;
    if (onGas < 3) {
      const free = scvs.find((u) => u.mode === 'harvest_min' && hypot(u.x, u.y, r.x, r.y) < 500);
      if (free) { free.mode = 'harvest_gas'; free.harvestId = r.id; }
    }
  }

  // ---------- Bâtiments ----------
  if (rax < 1 && p.minerals >= 125) {
    if (tryBuildNear('barracks', hq.x + dirX * 135, hq.y + dirY * 45, 50, 160)) return;
  }
  if (rax >= 1 && fac < Math.min(1, L.maxFac) && p.minerals >= 150 && p.gas >= 75) {
    if (tryBuildNear('factory', hq.x + dirX * 60, hq.y + dirY * 140, 55, 170)) return;
  }
  if (tur < L.defenses && rax >= 1 && p.minerals >= 125) {
    const tKind = (state.map === 'magma' || (p.gas >= 50 && Math.random() < 0.5)) ? 'tesla' : 'turret';
    if (tryBuildNear(tKind, hq.x + dirX * 165, hq.y + dirY * 165, 35, 120)) return;
  }
  if (L.upgradeLevel > 0 && rax >= 1 && count('armory') < 1 && p.minerals >= 125 && p.gas >= 50) {
    if (tryBuildNear('armory', hq.x - dirX * 50, hq.y + dirY * 130, 45, 160)) return;
  }
  if (L.scout && rax >= 1 && count('radar') < 1 && state.time > 150 && p.minerals >= 140 && p.gas >= 25) {
    if (tryBuildNear('radar', hq.x + dirX * 170, hq.y + dirY * 170, 20, 130)) return;
  }
  if (fac >= 1 && port < L.maxPort && p.minerals >= 150 && p.gas >= 100) {
    if (tryBuildNear('starport', hq.x - dirX * 110, hq.y - dirY * 90, 50, 170)) return;
  }
  // Trop de minéraux en réserve : une Caserne de plus (au-delà du plan si le gaz manque)
  if ((rax < L.maxRax && fac >= 1 && p.minerals >= 180) || (rax < L.maxRax + 2 && p.minerals >= 700)) {
    if (tryBuildNear('barracks', hq.x + dirX * 140, hq.y - dirY * 50, 55, 180)) return;
  }
  if (fac < L.maxFac && rax >= 2 && p.minerals >= 200 && p.gas >= 100) {
    if (tryBuildNear('factory', hq.x - dirX * 100, hq.y + dirY * 60, 55, 180)) return;
  }

  // ---------- Améliorations (par paliers, jusqu'au niveau permis) ----------
  const lab = myBlds.find((b) => b.kind === 'armory' && !b.constructing && (!b.queue || b.queue.length === 0));
  if (lab && L.upgradeLevel > 0) {
    const order0 = ['infantry_weapons', 'infantry_armor', 'vehicle_weapons', 'advanced_thrusters', 'vehicle_armor'];
    for (const uid of order0) {
      const c = upgCost(p, uid);
      if (c.maxed || c.level > L.upgradeLevel) continue;
      if (p.minerals >= c.min + 50 && p.gas >= c.gas) { order({ op: 'RESEARCH', upgId: uid, bldId: lab.id }); break; }
    }
  }

  // ---------- Production ----------
  const enemyMech = state.units.filter((u) => u.team !== p.team && UNITS[u.kind]?.mech && teamSees(p.team, u.x, u.y)).length;
  // Le gaz est mis de côté tant que la technologie prévue n'est pas lancée (sinon chaque Maraudeur le dépense)
  const techPending = fac < L.maxFac || port < L.maxPort || (L.upgradeLevel > 0 && count('armory') < 1);
  const gasReserve = techPending ? 100 : 0;
  for (const b of myBlds) {
    if (b.constructing || !Array.isArray(b.queue) || b.queue.length >= 2) continue;
    if (b.kind === 'barracks') {
      let kind = 'marine';
      if (p.gas >= 25 + gasReserve && (enemyMech > 3 || Math.random() < (L === BOT_LEVELS.facile ? 0.25 : 0.45))) kind = 'rocket';
      if (L !== BOT_LEVELS.facile && p.gas >= 50 + gasReserve && Math.random() < (state.map === 'magma' ? 0.4 : 0.18)) kind = 'sapper';
      order({ op: 'TRAIN', unit: kind, bldId: b.id });
    } else if (b.kind === 'factory') {
      let kind = null;
      if (p.minerals >= 250 && p.gas >= 150 && L !== BOT_LEVELS.facile) kind = 'titan';
      else if (p.minerals >= 150 && p.gas >= 100 && Math.random() < 0.55) kind = 'siege';
      else if (p.minerals >= 125 && p.gas >= 50) kind = 'tank';
      if (kind) order({ op: 'TRAIN', unit: kind, bldId: b.id });
    } else if (b.kind === 'starport') {
      const meds = myUnits.filter((u) => u.kind === 'medivac').length;
      const ships = myUnits.filter((u) => u.kind === 'dropship').length;
      if (meds < (L === BOT_LEVELS.expert ? 3 : 2)) order({ op: 'TRAIN', unit: 'medivac', bldId: b.id });
      else if (L.drops && ships < 1) order({ op: 'TRAIN', unit: 'dropship', bldId: b.id });
    }
  }

  // ---------- Armée ----------
  const visibleFoes = state.units.filter((u) => u.team !== p.team && u.hp > 0 && !u.boardedIn && teamSees(p.team, u.x, u.y));
  const allies = state.players.filter((q) => q.team === p.team && q.id !== p.id && !q.dead && !q.bot && !q.afk);
  // Défense : une base à nous ou à un coéquipier humain menacée
  const guarded = state.buildings.filter((b) => b.hp > 0 && (b.owner === p.id || allies.some((q) => q.id === b.owner)));
  const threats = visibleFoes.filter((e) => !e.flying && guarded.some((b) => hypot(b.x, b.y, e.x, e.y) < 520));
  const armySupply = army.reduce((a, u) => a + (UNITS[u.kind]?.supply || 1), 0);

  if (threats.length >= 2 && army.length) {
    const c = centroid(threats);
    const near = army.filter((u) => hypot(u.x, u.y, c.x, c.y) < 1600);
    const ids = (near.length ? near : army).map((u) => u.id);
    order({ op: 'UNIT_ORDER', mode: 'amove', x: c.x, y: c.y, unitIds: ids });
    ai.attacking = false;
  } else if (army.length) {
    const c = centroid(army);
    // Recul : l'armée est nettement plus faible que ce qu'elle voit autour d'elle
    if (L.retreat && ai.attacking) {
      const foesNear = visibleFoes.filter((e) => hypot(e.x, e.y, c.x, c.y) < 480);
      const towersNear = state.buildings.filter((b) => b.team !== p.team && b.hp > 0 && BUILDINGS[b.kind].dmg > 0 && hypot(b.x, b.y, c.x, c.y) < 480);
      const theirs = groupStrength(foesNear) + towersNear.reduce((a, b) => a + b.hp * (BUILDINGS[b.kind].dmg / BUILDINGS[b.kind].rate), 0);
      if (theirs > 0 && groupStrength(army) < theirs * 0.55) {
        order({ op: 'UNIT_ORDER', mode: 'move', x: hq.x + dirX * 200, y: hq.y + dirY * 200, unitIds: army.map((u) => u.id) });
        for (const u of army) if (u.sieged) u.sieged = false;
        ai.attacking = false;
        ai.regroupUntil = state.time + 30;
        fxEvents.push({ k: 'BOT_RETREAT', owner: p.id });
      }
    }
    // Coop : suivre l'armée du coéquipier humain quand elle part à l'attaque
    const allyArmy = state.units.filter((u) => allies.some((q) => q.id === u.owner) && COMBAT_KINDS.includes(u.kind));
    const allyPush = allyArmy.filter((u) => { const q = allies.find((a) => a.id === u.owner); return hypot(u.x, u.y, q.spawnX, q.spawnY) > 1400; });
    if (allyPush.length >= 6 && state.time > ai.regroupUntil) {
      const ac = centroid(allyPush);
      order({ op: 'UNIT_ORDER', mode: 'amove', x: ac.x, y: ac.y, unitIds: army.map((u) => u.id) });
      ai.attacking = true;
    } else if (!ai.attacking && state.time > ai.regroupUntil
      && (armySupply >= L.attackSupply || (sup.max >= 60 && sup.used >= sup.max - 2 && armySupply >= L.attackSupply * 0.6))) {
      const target = pickBotTarget(state, p, hq);
      if (target) {
        order({ op: 'UNIT_ORDER', mode: 'amove', x: target.x, y: target.y, unitIds: army.map((u) => u.id) });
        ai.attacking = true;
      }
    } else if (ai.attacking) {
      // Les renforts rejoignent l'attaque, et on relance si l'armée s'est arrêtée
      const target = pickBotTarget(state, p, hq);
      const lagging = army.filter((u) => u.mode === 'idle' || hypot(u.x, u.y, hq.x, hq.y) < MAIN_R + 140);
      if (target && lagging.length) order({ op: 'UNIT_ORDER', mode: 'amove', x: target.x, y: target.y, unitIds: lagging.map((u) => u.id) });
      if (armySupply < L.attackSupply * 0.3) ai.attacking = false;
    }
    // Les Navettes Médicales accompagnent l'armée
    const meds = myUnits.filter((u) => u.kind === 'medivac');
    if (meds.length) order({ op: 'UNIT_ORDER', mode: 'move', x: c.x - dirX * 40, y: c.y - dirY * 40, unitIds: meds.map((u) => u.id) });
  }

  // Micro : Stimpack à l'engagement, Mode Siège face à des ennemis au sol, puis on replie
  if (L.micro) {
    const stim = army.filter((u) => UNITS[u.kind].canStim && !(u.stimT > 0) && u.hp > u.maxHp * 0.7
      && visibleFoes.some((e) => hypot(e.x, e.y, u.x, u.y) < UNITS[u.kind].range + 60));
    if (stim.length >= 3) order({ op: 'STIM', unitIds: stim.map((u) => u.id) });
    for (const u of army.filter((x) => x.kind === 'siege')) {
      const close = visibleFoes.some((e) => !e.flying && hypot(e.x, e.y, u.x, u.y) < UNITS.siege.siegeRange * 0.9);
      if (close) u.foeSeenAt = state.time;
      if (close && !u.sieged) order({ op: 'SIEGE', unitIds: [u.id] });
      else if (!close && u.sieged && state.time - (u.foeSeenAt || 0) > 5) order({ op: 'SIEGE', unitIds: [u.id] });
    }
  }

  // Éclaireur : un Marine part voir la base adverse la plus lointaine
  if (L.scout && !ai.scouted && state.time > 100) {
    const scout = army.find((u) => u.kind === 'marine' && u.mode === 'idle');
    const far = state.players.filter((q) => q.team !== p.team && !q.dead)
      .sort((a, b) => hypot(b.spawnX, b.spawnY, hq.x, hq.y) - hypot(a.spawnX, a.spawnY, hq.x, hq.y))[0];
    if (scout && far) {
      order({ op: 'UNIT_ORDER', mode: 'move', x: far.spawnX + Math.sign(HALF_W - far.spawnX) * 380, y: far.spawnY + Math.sign(HALF_W - far.spawnY) * 380, unitIds: [scout.id] });
      ai.scouted = true;
    }
  }

  // Largage (Difficile) : 4 Marines dans une Navette, posés sur la ligne de minerai adverse
  if (L.drops) runDrop(state, p, ai, hq, myUnits, order);
}

function runDrop(state, p, ai, hq, myUnits, order) {
  const ship = myUnits.find((u) => u.kind === 'dropship');
  if (!ship) { ai.dropState = null; return; }
  const cargo = Array.isArray(ship.cargo) ? ship.cargo.length : 0;
  if (!ai.dropState) ai.dropState = 'load';
  if (ai.dropState === 'load') {
    if (cargo >= 4) {
      const target = pickBotTarget(state, p, hq);
      if (!target) return;
      // Ligne de minerai : derrière le QG visé, du côté opposé au centre de la carte
      const tx = target.x - Math.sign(HALF_W - target.x) * 120, ty = target.y - Math.sign(HALF_W - target.y) * 120;
      ai.drop = { x: tx, y: ty };
      order({ op: 'UNIT_ORDER', mode: 'move', x: tx, y: ty, unitIds: [ship.id] });
      ai.dropState = 'fly';
    } else {
      const riders = myUnits.filter((u) => u.kind === 'marine' && !u.boardedIn && u.mode !== 'board' && hypot(u.x, u.y, hq.x, hq.y) < MAIN_R + 160).slice(0, 4 - cargo);
      if (riders.length && cargo + riders.length >= 4) order({ op: 'BOARD', targetId: ship.id, unitIds: riders.map((u) => u.id) });
    }
  } else if (ai.dropState === 'fly') {
    if (ai.drop && hypot(ship.x, ship.y, ai.drop.x, ai.drop.y) < 90) {
      order({ op: 'UNLOAD', dropshipId: ship.id });
      order({ op: 'UNIT_ORDER', mode: 'move', x: hq.x, y: hq.y, unitIds: [ship.id] });
      ai.dropState = 'home';
    } else if (ship.mode === 'idle') {
      order({ op: 'UNIT_ORDER', mode: 'move', x: ai.drop.x, y: ai.drop.y, unitIds: [ship.id] });
    }
  } else if (ai.dropState === 'home' && hypot(ship.x, ship.y, hq.x, hq.y) < 300) {
    ai.dropState = 'load';
  }
}
