// Bastion Clash : démarrage de partie, synchronisation réseau et boucle d'affichage.
'use strict';

initMap('vallee', 'ffa');


function switchMap(newMapId) {
  if (!MAP_DEFS[newMapId]) return;
  const base = (typeof lastBootInfo !== 'undefined' && lastBootInfo) || {};
  const baseSettings = base.settings || { mode: 'ffa', pace: 'standard', bots: 1, level: 'normal' };
  const info = { ...base, settings: { ...baseSettings, map: newMapId } };
  startMatch(info);
}


/* ============================================================================
   DÉMARRAGE DE PARTIE & SYNCHRONISATION RÉSEAU (HUB BRIDGE)
   ============================================================================ */
let lastBootInfo = null;
let netSyncTick = 0;
let pendingNetFx = [];


function packState(s) {
  const r1 = (v) => Math.round((Number(v) || 0) * 10) / 10;
  const r2 = (v) => Math.round((Number(v) || 0) * 100) / 100;
  return {
    time: r2(s.time),
    blitz: s.blitz,
    map: s.map || activeMapId || 'vallee',
    mode: s.mode,
    is2v2: s.is2v2,
    level: s.level,
    phase: s.phase,
    stormRadius: Math.round(s.stormRadius),
    dmgMult: s.dmgMult,
    nextId: s.nextId,
    over: s.over,
    winnerTeam: s.winnerTeam,
    ranking: s.ranking,
    ack: { ...clientAckSeq },
    players: s.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      bot: p.bot,
      team: p.team,
      minerals: r1(p.minerals),
      gas: r1(p.gas),
      score: Math.round(p.score),
      dead: p.dead,
      spawnX: p.spawnX,
      spawnY: p.spawnY,
      nextUnitSeq: p.nextUnitSeq || 20,
      ping: p.bot ? 0 : getPlayerPing(p),
      upgrades: p.upgrades ? { ...p.upgrades } : {},
    })),
    buildings: s.buildings.map((b) => ({
      id: b.id,
      kind: b.kind,
      owner: b.owner,
      team: b.team,
      x: Math.round(b.x),
      y: Math.round(b.y),
      hp: Math.round(b.hp),
      maxHp: b.maxHp,
      radius: b.radius,
      cd: r2(b.cd),
      aimA: r2(b.aimA),
      constructing: b.constructing,
      buildStarted: b.buildStarted,
      buildProg: r2(b.buildProg),
      buildTime: b.buildTime,
      queue: b.queue,
      qTimer: r2(b.qTimer),
      qTotal: r2(b.qTotal),
      rallyX: Math.round(b.rallyX ?? b.x),
      rallyY: Math.round(b.rallyY ?? b.y),
      geyserId: b.geyserId,
    })),
    units: s.units.map((u) => ({
      id: u.id,
      kind: u.kind,
      owner: u.owner,
      team: u.team,
      x: r1(u.x),
      y: r1(u.y),
      vx: r1(u.vx),
      vy: r1(u.vy),
      a: r2(u.a),
      hp: Math.round(u.hp),
      maxHp: u.maxHp,
      radius: u.radius,
      cd: r2(u.cd),
      mode: u.mode,
      orderX: u.orderX != null ? Math.round(u.orderX) : null,
      orderY: u.orderY != null ? Math.round(u.orderY) : null,
      pathX: u.pathX != null ? Math.round(u.pathX) : null,
      pathY: u.pathY != null ? Math.round(u.pathY) : null,
      targetEntId: u.targetEntId,
      harvestId: u.harvestId,
      gatherT: r2(u.gatherT),
      carryType: u.carryType,
      carryAmt: u.carryAmt,
      buildTargetId: u.buildTargetId,
      onSite: !!u.onSite,
      weldTimer: r2(u.weldTimer),
      weldX: u.weldX != null ? r1(u.weldX) : null,
      weldY: u.weldY != null ? r1(u.weldY) : null,
      stimT: r2(u.stimT),
      sieged: !!u.sieged,
      flying: !!u.flying,
      cargo: Array.isArray(u.cargo) ? [...u.cargo] : [],
      boardedIn: u.boardedIn || null,
      healingTargetId: u.healingTargetId || null,
    })),
    scans: s.scans.map((sc) => ({
      x: Math.round(sc.x),
      y: Math.round(sc.y),
      team: sc.team,
      r: sc.r,
      timer: r2(sc.timer),
    })),
  };
}

function reconcileGuestState(prev, incoming) {
  if (!incoming) return prev;
  const inLayout = incoming.mode === '2v2' ? '2v2' : 'ffa';
  if ((incoming.map && incoming.map !== activeMapId) || inLayout !== activeLayout) {
    initMap(incoming.map || activeMapId, inLayout);
    exploredGrid.fill(0);
  }
  if (!prev) return incoming;
  const oldPos = new Map();
  for (const u of prev.units) {
    oldPos.set(u.id, { x: u.x, y: u.y });
  }

  const acked = (incoming.ack && incoming.ack[myId]) || 0;
  const nowP = performance.now();
  while (pendingCmds.length && (pendingCmds[0].seq <= acked || nowP - pendingCmds[0].ts > 1500)) {
    pendingCmds.shift();
  }

  if (pendingCmds.length > 0) {
    const dummyFx = [];
    for (const pc of pendingCmds) {
      executeCommand(incoming, myId, pc.cmd, dummyFx);
    }
  }

  for (const u of incoming.units) {
    const o = oldPos.get(u.id);
    if (o) {
      const err = hypot(o.x, o.y, u.x, u.y);
      if (err > 0.3 && err < 95) {
        u.x = lerp(o.x, u.x, 0.45);
        u.y = lerp(o.y, u.y, 0.45);
      }
    }
  }
  return incoming;
}

// Minuterie de la simulation. Elle tourne dans un Worker : les navigateurs brident à ~1 appel par seconde
// (voire par minute) les minuteries d'un onglet caché, pas celles d'un Worker. Repli sur setInterval.
function startTicker(fn, ms) {
  try {
    const src = 'let id=null;onmessage=(e)=>{clearInterval(id);if(e.data>0)id=setInterval(()=>postMessage(0),e.data);};';
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
    const w = new Worker(url);
    URL.revokeObjectURL(url);
    w.onmessage = fn;
    w.postMessage(ms);
    return () => w.terminate();
  } catch (err) {
    const id = setInterval(fn, ms);
    return () => clearInterval(id);
  }
}
let stopTicker = null;
const MAX_STEPS_PER_CALL = 60;       // 2 s de jeu rattrapées au plus d'un coup
const STEP_BUDGET_MS = 250;          // au-delà, on abandonne le retard plutôt que de geler la page

function startTickLoop(botEvery = 0) {
  if (stopTicker) stopTicker();
  const H = window.HubBridge;
  const stepMs = 1000 / TICK_RATE;
  let last = performance.now(), acc = 0, botAcc = 0;
  stopTicker = startTicker(() => {
    const now = performance.now();
    acc = Math.min(acc + (now - last), MAX_STEPS_PER_CALL * stepMs);
    last = now;
    if (!state || state.over) { acc = 0; return; }
    // La partie avance au rythme de l'horloge, même si les appels arrivent en retard (onglet caché, machine lente)
    const fx = [];
    let steps = 0, sendNow = false;
    const t0 = now;
    while (acc >= stepMs && !state.over) {
      stepWorld(state, TICK_DT, fx);
      acc -= stepMs;
      steps++;
      if (botEvery > 0) {
        botAcc += TICK_DT;
        if (botAcc >= botEvery) { botAcc = 0; runBots(state, fx); }
      }
      netSyncTick++;
      if (netSyncTick % 5 === 0) sendNow = true;
      if (performance.now() - t0 > STEP_BUDGET_MS) { acc = 0; break; }
    }
    if (!steps) return;
    handleFxEvents(fx);
    if (role === 'host' && H && H.embedded) {
      for (const e of fx) {
        if (e.k === 'ELIM' || e.k === 'PHASE') pendingNetFx.push(e);
      }
      if (sendNow || state.over) {
        H.send('all', { t: 'st', s: packState(state), fx: pendingNetFx.splice(0) });
      }
    }
  }, stepMs);
}

function startMatch(info) {
  lastBootInfo = info;
  reportedResult = false;
  selectedUnits.clear();
  selectedBlds.clear();
  buildMode = null;
  orderCursor = null;
  exploredGrid.fill(0);
  if (exploredCtx) exploredCtx.clearRect(0, 0, FOG_RES, FOG_RES);
  lastFogUpdate = 0;
  pendingCmds.length = 0;
  netSyncTick = 0;
  pendingNetFx = [];
  craters = [];
  particles = [];
  shockwaves = [];
  projectiles = [];
  beams = [];
  orderMarkers = [];

  if (stopTicker) { stopTicker(); stopTicker = null; }
  Sfx.wake();

  const H = window.HubBridge;
  role = H && H.embedded ? info.role : 'solo';
  myId = H && H.embedded ? info.myId : 0;

  if (role === 'guest') {
    startTickLoop();
    H.send('host', { t: 'sync' });
    return;
  }

  const settings = (info && info.settings) || { mode: 'ffa', pace: 'standard', bots: 1, level: 'normal' };
  const humans = H && H.embedded && Array.isArray(H.players) && H.players.length
    ? H.players.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: false }))
    : [{ id: 0, name: 'Commandant', color: PALETTE[0], bot: false }];

  const roster = [...humans];
  const wantBots = role === 'solo'
    ? Math.max(1, Math.min(3, Number(settings.bots ?? 1)))
    : Math.max(0, Math.min(Number(settings.bots ?? 1), 4 - roster.length));
  const finalBots = roster.length + wantBots < 2 ? 2 - roster.length : wantBots;
  const usedColors = new Set(roster.map((p) => p.color));

  for (let k = 0; k < finalBots && roster.length < 4; k++) {
    const col = PALETTE.find((c) => !usedColors.has(c)) || PALETTE[roster.length % PALETTE.length];
    usedColors.add(col);
    roster.push({ id: 100 + k, name: BOT_NAMES[k], color: col, bot: true });
  }

  state = createInitialState(roster, settings);
  if (typeof setupThreeMapScenery === 'function' && threeScene) {
    setupThreeMapScenery(state.map || activeMapId);
  }
  updateFogCanvas(performance.now() + 100);
  centerOnMyHq();
  renderConsoleUI(true);
  updateHudUI();

  if (role === 'host' && H && H.embedded) {
    H.send('all', { t: 'st', s: packState(state), fx: [] });
  }

  // Les bots réfléchissent au rythme du temps de jeu, dans la même boucle que la simulation
  const botEvery = settings.level === 'expert' ? 0.85 : settings.level === 'facile' ? 2.0 : 1.25;
  startTickLoop(botEvery);
}

if (window.HubBridge && HubBridge.embedded) {
  let centeredOnce = false;
  let lastStateAt = performance.now();

  HubBridge.on('init', (info) => {
    centeredOnce = false;
    lastStateAt = performance.now();
    if (info && info.pings) Object.assign(playerPings, info.pings);
    startMatch(info);
    HubBridge.signalReady();
  });

  HubBridge.on('pings', (pMap) => {
    if (pMap) Object.assign(playerPings, pMap);
  });

  setInterval(() => {
    if (!window.HubBridge || !HubBridge.embedded) return;
    if (HubBridge.pings) Object.assign(playerPings, HubBridge.pings);
    if (role === 'guest') {
      const now = performance.now();
      HubBridge.send('host', { t: 'gping', ts: now, myPing: playerPings[myId] });
      if (now - lastStateAt > 2500) {
        HubBridge.send('host', { t: 'sync' });
      }
    }
  }, 1800);

  HubBridge.on('msg', (from, m) => {
    if (!m || typeof m !== 'object') return;
    if (role === 'host') {
      if (m.t === 'sync' && state) {
        HubBridge.send(from, { t: 'st', s: packState(state), fx: [] });
      } else if (m.t === 'gping') {
        if (Number.isFinite(m.myPing)) playerPings[from] = Math.max(1, Math.round(m.myPing));
        HubBridge.send(from, { t: 'gpong', ts: m.ts, pings: playerPings });
      } else if (m.t === 'cmd' && m.cmd && state) {
        if (m.seq) clientAckSeq[from] = Math.max(clientAckSeq[from] || 0, m.seq);
        const fx = [];
        const res = executeCommand(state, from, m.cmd, fx);
        if (res.ok) {
          handleFxEvents(fx);
          HubBridge.send('all', { t: 'rcmd', p: from, cmd: m.cmd, seq: m.seq });
        } else if (m.seq) {
          HubBridge.send(from, { t: 'rcmd', p: from, cmd: null, seq: m.seq });
        }
      }
    } else if (role === 'guest') {
      if (m.t === 'gpong') {
        if (m.pings) Object.assign(playerPings, m.pings);
        if (m.ts) playerPings[myId] = Math.max(1, Math.round(performance.now() - m.ts));
      } else if (m.t === 'st' && m.s) {
        lastStateAt = performance.now();
        for (const p of m.s.players || []) {
          if (!p.bot && p.ping && Number(p.id) !== Number(myId)) playerPings[p.id] = p.ping;
        }
        state = reconcileGuestState(state, m.s);
        if (!centeredOnce) {
          centeredOnce = true;
          centerOnMyHq();
          renderConsoleUI(true);
        }
        if (m.fx && m.fx.length) handleFxEvents(m.fx);
      } else if (m.t === 'rcmd' && state) {
        lastStateAt = performance.now();
        if (Number(m.p) === Number(myId) && m.seq) {
          clientAckSeq[myId] = Math.max(clientAckSeq[myId] || 0, m.seq);
          while (pendingCmds.length && pendingCmds[0].seq <= m.seq) pendingCmds.shift();
        } else if (Number(m.p) !== Number(myId) && m.cmd) {
          const fx = [];
          executeCommand(state, m.p, m.cmd, fx, { authority: true });
          handleFxEvents(fx);
        }
      }
    }
  });
} else {
  startMatch({ role: 'solo', myId: 0, settings: { mode: 'ffa', pace: 'standard', bots: 1, level: 'normal' } });
}

let lastFrame = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrame) / 1000));
  lastFrame = now;
  try {
    renderWorld(dt, now);
    updateHudUI();
  } catch (err) {
    console.error('Frame error:', err);
  }
}
requestAnimationFrame(loop);
