// Interface de Bastion Clash (navigateur uniquement).
// Envoi des commandes, sélection, clavier, souris, minimap, panneau son.
'use strict';

function screenToWorld(sx, sy) {
  if (threeReady && threeCam && threeRaycaster && threeGroundPlane) {
    threeNdc.set((sx / Math.max(1, W)) * 2 - 1, -(sy / Math.max(1, H)) * 2 + 1);
    threeRaycaster.setFromCamera(threeNdc, threeCam);
    const ray = threeRaycaster.ray;
    // Marche le long du rayon jusqu'à toucher le relief (plateaux, montagnes)
    if (ray.direction.y < -0.01) {
      const o = ray.origin, dvec = ray.direction;
      const tTop = (200 - o.y) / dvec.y;
      const tBot = (-20 - o.y) / dvec.y;
      let t0 = Math.max(0, tTop), prevT = t0;
      const step = 10;
      for (let t = t0; t <= tBot; t += step) {
        const px = o.x + dvec.x * t, py = o.y + dvec.y * t, pz = o.z + dvec.z * t;
        if (py <= heightAt(px, pz)) {
          let lo = prevT, hi = t;
          for (let k = 0; k < 8; k++) {
            const mid = (lo + hi) / 2;
            const mx = o.x + dvec.x * mid, my = o.y + dvec.y * mid, mz = o.z + dvec.z * mid;
            if (my <= heightAt(mx, mz)) hi = mid; else lo = mid;
          }
          return { x: o.x + dvec.x * hi, y: o.z + dvec.z * hi };
        }
        prevT = t;
      }
    }
    if (ray.intersectPlane(threeGroundPlane, threeHitPt)) {
      return { x: threeHitPt.x, y: threeHitPt.z };
    }
  }
  return {
    x: cam.x + (sx - W / 2) / cam.z,
    y: cam.y + (sy - H / 2) / (cam.z * 0.77),
  };
}

function worldToScreen3D(wx, wy, h = 0) {
  if (threeReady && threeCam && threeProjVec) {
    threeProjVec.set(wx, h + heightAt(wx, wy), wy).project(threeCam);
    return {
      x: (threeProjVec.x * 0.5 + 0.5) * W,
      y: (-threeProjVec.y * 0.5 + 0.5) * H,
    };
  }
  return {
    x: W / 2 + (wx - cam.x) * cam.z,
    y: H / 2 + (wy - cam.y - h * 0.77) * (cam.z * 0.77),
  };
}


let localCmdSeq = 0;
const pendingCmds = [];
const clientAckSeq = {};
const playerPings = {};

function getPlayerPing(p) {
  if (!p || p.bot) return 0;
  const fromLocal = playerPings[p.id];
  const fromHub = window.HubBridge && HubBridge.pings ? HubBridge.pings[p.id] : null;
  const val = fromLocal || fromHub || p.ping || (role === 'solo' ? 1 : 18);
  return Math.max(1, Math.round(val));
}

function sendCommand(cmd) {
  if (!state || state.over) return;
  const seq = ++localCmdSeq;
  if (cmd.op === 'BUILD' && !cmd.bldId) {
    cmd.bldId = (Number(myId) + 1) * 100000 + seq;
  }
  const fx = [];
  const res = executeCommand(state, myId, cmd, fx, { authority: role !== 'guest' });
  if (!res.ok && res.reason) {
    toast(res.reason, 2000);
    Sfx.error();
    return;
  }
  if (res.ok) {
    if (cmd.op === 'BUILD') Sfx.build();
    else if (cmd.op === 'TRAIN') Sfx.spawn();
    else if (cmd.op === 'STIM') Sfx.stim();
    else if (cmd.op === 'SIEGE') Sfx.siege();
    else if (cmd.op === 'UNIT_ORDER') {
      if (cmd.mode === 'amove' || cmd.mode === 'focus') Sfx.attack();
      else Sfx.order();
    }
    handleFxEvents(fx);
    renderConsoleUI(true);

    if (window.HubBridge && HubBridge.embedded) {
      if (role === 'guest') {
        pendingCmds.push({ seq, cmd, ts: performance.now() });
        HubBridge.send('host', { t: 'cmd', cmd, seq });
      } else if (role === 'host') {
        HubBridge.send('all', { t: 'rcmd', p: myId, cmd });
      }
    }
  }
}

function cleanSelection() {
  if (!state) return;
  const validU = new Set(state.units.filter((u) => Number(u.owner) === Number(myId) && u.hp > 0 && !u.boardedIn).map((u) => u.id));
  const validB = new Set(state.buildings.filter((b) => Number(b.owner) === Number(myId) && b.hp > 0).map((b) => b.id));
  for (const id of [...selectedUnits]) if (!validU.has(id)) selectedUnits.delete(id);
  for (const id of [...selectedBlds]) if (!validB.has(id)) selectedBlds.delete(id);

  // Si on était en train de poser un bâtiment mais qu'aucun VCS n'est sélectionné, on annule buildMode
  const hasScv = state.units.some((u) => selectedUnits.has(u.id) && u.kind === 'scv');
  if (buildMode && !hasScv) {
    buildMode = null;
    updateCursorClass();
  }
}

function selectIdleWorker() {
  if (!state) return;
  const idle = state.units.find((u) => u.owner === myId && u.kind === 'scv' && u.mode === 'idle')
    || state.units.find((u) => u.owner === myId && u.kind === 'scv');
  if (idle) {
    selectedUnits.clear(); selectedBlds.clear();
    selectedUnits.add(idle.id);
    cam.x = idle.x; cam.y = idle.y;
    Sfx.order();
    renderConsoleUI(true);
  }
}

function selectAllArmy() {
  if (!state) return;
  selectedUnits.clear(); selectedBlds.clear();
  buildMode = null; updateCursorClass();
  for (const u of state.units) {
    if (u.owner === myId && u.kind !== 'scv' && u.hp > 0 && !u.boardedIn) selectedUnits.add(u.id);
  }
  if (selectedUnits.size > 0) { Sfx.order(); renderConsoleUI(true); }
  else toast('Aucune unité de combat déployée.');
}

$('#btnIdleScv').onclick = selectIdleWorker;
$('#btnAllArmy').onclick = selectAllArmy;

window.addEventListener('keydown', (e) => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  keys[k] = true;

  if (e.key === 'F1') { e.preventDefault(); selectIdleWorker(); return; }
  if (e.key === 'F2') { e.preventDefault(); selectAllArmy(); return; }

  if (k === 'escape') {
    buildMode = null; orderCursor = null; buildKeysArmed = false;
    updateCursorClass(); renderConsoleUI(true);
    return;
  }
  if (k === ' ') { e.preventDefault(); centerOnMyHq(); return; }
  if (k === 'tab' && isSpectatorView()) { e.preventDefault(); cycleSpectatorFocus(); return; }
  if (k === 'm' && !e.ctrlKey && !e.metaKey) {
    const m = Sfx.toggleAll();
    syncAudioUI();
    toast(m ? '🔇 Son coupé (M pour le remettre)' : '🔊 Son rétabli', 1400);
    return;
  }

  // PROTECTION ABSOLUE DE LA CAMÉRA : ZQSD, WASD et flèches ne doivent JAMAIS déclencher d'ordre !
  const CAMERA_KEYS = new Set(['z', 'q', 's', 'd', 'w', 'a', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
  if (CAMERA_KEYS.has(k)) return;

  cleanSelection();
  const selUList = state ? state.units.filter((u) => selectedUnits.has(u.id)) : [];
  const hasScvSelected = selUList.some((u) => u.kind === 'scv');

  // VCS sélectionné : B ouvre le menu de construction, puis 1..0 / R choisit le bâtiment.
  // Sans B, les chiffres restent les groupes de contrôle.
  if (!hasScvSelected) buildKeysArmed = false;
  if (hasScvSelected && k === 'b' && !e.ctrlKey && !e.metaKey && !e.repeat) {
    buildKeysArmed = !buildKeysArmed;
    renderConsoleUI(true);
    return;
  }
  if (buildKeysArmed && !e.ctrlKey && !e.metaKey && KEY_TO_BUILD[k] && !e.repeat) {
    buildKeysArmed = false;
    pickBuildMode(KEY_TO_BUILD[k]);
    return;
  }

  // Groupes de contrôle 1..9 (Ctrl+Num pour assigner, Num pour sélectionner / double-tap centrer)
  if (/^[1-9]$/.test(k)) {
    const g = Number(k);
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      controlGroups[g] = { units: [...selectedUnits], blds: [...selectedBlds] };
      toast(`Groupe de contrôle #${g} assigné`);
      renderConsoleUI(true);
      return;
    }
    const grp = controlGroups[g];
    if (grp && ((grp.units && grp.units.length) || (grp.blds && grp.blds.length))) {
      selectedUnits = new Set(grp.units || []);
      selectedBlds = new Set(grp.blds || []);
      cleanSelection();
      const now = performance.now();
      if (lastGroupTap.g === g && now - lastGroupTap.t < 350) {
        const firstU = state.units.find((u) => selectedUnits.has(u.id));
        const firstB = state.buildings.find((b) => selectedBlds.has(b.id));
        const ent = firstU || firstB;
        if (ent) { cam.x = ent.x; cam.y = ent.y; }
      }
      lastGroupTap = { g, t: now };
      renderConsoleUI(true);
    }
    return;
  }

  // Raccourcis avec touche maintenue : ne pas répéter les ordres si e.repeat
  if (e.repeat) return;

  // Raccourcis quand des UNITÉS sont sélectionnées : F = A-Move, X = Stop, H = Hold, C = Récolter (VCS), T = Stimpack, G = Siège, V = Débarquer
  if (selectedUnits.size > 0) {
    if (k === 'f') { buildMode = null; orderCursor = orderCursor === 'amove' ? null : 'amove'; updateCursorClass(); renderConsoleUI(true); return; }
    if (k === 'x') { sendCommand({ op: 'UNIT_ORDER', mode: 'stop', unitIds: [...selectedUnits] }); return; }
    if (k === 'h') { sendCommand({ op: 'UNIT_ORDER', mode: 'hold', unitIds: [...selectedUnits] }); return; }
    if (k === 'c' && hasScvSelected) {
      // Récolte au cristal le plus proche de la souris (du centre de l'écran si elle est hors de la carte)
      const hx = mouse.inside && !mouse.overUI ? mouse.wx : cam.x, hy = mouse.inside && !mouse.overUI ? mouse.wy : cam.y;
      sendCommand({ op: 'UNIT_ORDER', mode: 'harvest_min', x: hx, y: hy, unitIds: [...selectedUnits] });
      return;
    }
    if (k === 't') { sendCommand({ op: 'STIM', unitIds: [...selectedUnits] }); return; }
    if (k === 'g') { sendCommand({ op: 'SIEGE', unitIds: [...selectedUnits] }); return; }
    if (k === 'v') {
      for (const uId of selectedUnits) {
        const u = state.units.find((x) => x.id === uId);
        if (u && u.kind === 'dropship') sendCommand({ op: 'UNLOAD', dropshipId: u.id });
      }
      return;
    }
  }

  // Raccourcis quand un BÂTIMENT est sélectionné : E / R / T / Y entraînent les troupes, C = Scan Radar (si QG)
  if (selectedBlds.size > 0) {
    const firstB = state?.buildings.find((b) => selectedBlds.has(b.id));
    if (firstB && !firstB.constructing) {
      if (firstB.kind === 'hq' && k === 'c') {
        buildMode = null; orderCursor = orderCursor === 'scan' ? null : 'scan';
        updateCursorClass(); renderConsoleUI(true);
        return;
      }
      if (firstB.kind === 'armory') {
        const upgKeys = ['e', 'r', 't', 'y', 'u'];
        const upgIds = Object.keys(UPGRADES);
        const upgIdx = upgKeys.indexOf(k);
        if (upgIdx >= 0 && upgIds[upgIdx]) {
          sendCommand({ op: 'RESEARCH', upgId: upgIds[upgIdx], bldId: firstB.id });
          return;
        }
      }
      const trains = BUILDINGS[firstB.kind]?.trains || [];
      const keyIdx = { e: 0, r: 1, t: 2, y: 3 }[k];
      if (keyIdx !== undefined && trains[keyIdx]) {
        for (const bId of selectedBlds) {
          sendCommand({ op: 'TRAIN', unit: trains[keyIdx], bldId: bId });
        }
        return;
      }
    }
  }
});

window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
// Fenêtre quittée touche enfoncée : le relâchement n'arrive jamais, la caméra défilerait toute seule
const releaseAllKeys = () => { for (const k of Object.keys(keys)) keys[k] = false; };
window.addEventListener('blur', releaseAllKeys);
document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAllKeys(); });
cvs.addEventListener('contextmenu', (e) => e.preventDefault());

function updateCursorClass() {
  cvs.classList.toggle('cur-attack', orderCursor === 'amove' || orderCursor === 'scan');
  cvs.classList.toggle('cur-build', !!buildMode);
}

cvs.addEventListener('wheel', (e) => {
  e.preventDefault();
  if (e.shiftKey) {
    cam.pitch = clamp((cam.pitch || 70) + (e.deltaY < 0 ? 2.5 : -2.5), 25, 82);
  } else {
    cam.z = clamp(cam.z * (e.deltaY < 0 ? 1.1 : 0.9), 0.44, 1.35);
  }
}, { passive: false });

function findEntityAt(wx, wy, sx = mouse.x, sy = mouse.y) {
  if (!state) return null;
  // Unités (teste l'empreinte au sol et le volume 3D projeté)
  for (const u of state.units) {
    if (u.hp <= 0 || u.boardedIn) continue;
    if (dist2(wx, wy, u.x, u.y) <= (u.radius + 14) ** 2) return { type: 'unit', ent: u };
    if (threeReady) {
      const hElev = u.flying ? 42 : (u.kind === 'titan' ? 22 : 12);
      const pt = worldToScreen3D(u.x, u.y, hElev);
      if (hypot(pt.x - sx, pt.y - sy) <= Math.max(u.radius * cam.z + 14, 20)) return { type: 'unit', ent: u };
    }
  }
  // Bâtiments
  for (const b of state.buildings) {
    if (b.hp <= 0) continue;
    if (dist2(wx, wy, b.x, b.y) <= (b.radius + 10) ** 2) return { type: 'bld', ent: b };
    if (threeReady) {
      const def = BUILDINGS[b.kind] || BUILDINGS.hq;
      const pt = worldToScreen3D(b.x, b.y, (def.height || 36) * 0.45);
      if (hypot(pt.x - sx, pt.y - sy) <= Math.max(b.radius * cam.z + 12, 26)) return { type: 'bld', ent: b };
    }
  }
  // Gisements de cristaux
  for (const m of MINERAL_NODES) {
    if (dist2(wx, wy, m.x, m.y) <= 30 * 30) return { type: 'min', ent: m };
    if (threeReady) {
      const pt = worldToScreen3D(m.x, m.y, 10);
      if (hypot(pt.x - sx, pt.y - sy) <= Math.max(26 * cam.z, 22)) return { type: 'min', ent: m };
    }
  }
  // Geysers de gaz
  for (const g of GAS_GEYSERS) {
    if (dist2(wx, wy, g.x, g.y) <= 34 * 34) return { type: 'gas', ent: g };
    if (threeReady) {
      const pt = worldToScreen3D(g.x, g.y, 12);
      if (hypot(pt.x - sx, pt.y - sy) <= Math.max(30 * cam.z, 26)) return { type: 'gas', ent: g };
    }
  }
  return null;
}

function issueSmartRightClick(wx, wy) {
  if (!state) return;
  cleanSelection();
  const hit = findEntityAt(wx, wy);
  const me = state.players.find((p) => p.id === myId);

  // Si un bâtiment de production est sélectionné -> Clic droit définit son Point de Ralliement
  if (selectedUnits.size === 0 && selectedBlds.size > 0) {
    sendCommand({ op: 'UNIT_ORDER', mode: 'rally', x: wx, y: wy, bldIds: [...selectedBlds] });
    orderMarkers.push({ x: wx, y: wy, color: '#ffc531', life: 0.45, maxLife: 0.45 });
    return;
  }

  // Si aucune unité n'est sélectionnée, le clic droit ne fait rien (comme dans StarCraft !)
  const unitIds = [...selectedUnits];
  if (!unitIds.length) return;

  const hasScvs = unitIds.some((id) => state.units.find((u) => u.id === id)?.kind === 'scv');

  if (hit) {
    if ((hit.type === 'unit' || hit.type === 'bld') && me && hit.ent.team !== me.team) {
      sendCommand({ op: 'UNIT_ORDER', mode: 'focus', targetId: hit.ent.id, x: hit.ent.x, y: hit.ent.y, unitIds });
      orderMarkers.push({ x: hit.ent.x, y: hit.ent.y, color: '#ff4b2b', life: 0.45, maxLife: 0.45 });
      return;
    }
    // Embarquement dans une Navette de Transport alliée
    if (hit.type === 'unit' && hit.ent.owner === myId && hit.ent.kind === 'dropship') {
      const groundUnits = unitIds.filter((id) => {
        const u = state.units.find((x) => x.id === id);
        return u && !u.flying && !u.boardedIn;
      });
      if (groundUnits.length > 0) {
        sendCommand({ op: 'BOARD', targetId: hit.ent.id, unitIds: groundUnits });
        orderMarkers.push({ x: hit.ent.x, y: hit.ent.y, color: '#3ecbff', life: 0.45, maxLife: 0.45 });
        return;
      }
    }
    if (hit.type === 'min' && hasScvs) {
      sendCommand({ op: 'UNIT_ORDER', mode: 'harvest_min', resId: hit.ent.id, x: hit.ent.x, y: hit.ent.y, unitIds });
      orderMarkers.push({ x: hit.ent.x, y: hit.ent.y, color: '#1fc7c1', life: 0.45, maxLife: 0.45 });
      return;
    }
    if (hit.type === 'bld' && hit.ent.owner === myId && hit.ent.kind === 'extractor' && !hit.ent.constructing && hasScvs) {
      sendCommand({ op: 'UNIT_ORDER', mode: 'harvest_gas', resId: hit.ent.id, x: hit.ent.x, y: hit.ent.y, unitIds });
      orderMarkers.push({ x: hit.ent.x, y: hit.ent.y, color: '#2fbf71', life: 0.45, maxLife: 0.45 });
      return;
    }
    if (hit.type === 'bld' && hit.ent.owner === myId && (hit.ent.constructing || hit.ent.hp < hit.ent.maxHp) && hasScvs) {
      sendCommand({ op: 'UNIT_ORDER', mode: 'build', targetId: hit.ent.id, x: hit.ent.x, y: hit.ent.y, unitIds });
      orderMarkers.push({ x: hit.ent.x, y: hit.ent.y, color: '#ffc531', life: 0.45, maxLife: 0.45 });
      return;
    }
  }

  sendCommand({ op: 'UNIT_ORDER', mode: 'move', x: wx, y: wy, unitIds });
  orderMarkers.push({ x: wx, y: wy, color: '#2fbf71', life: 0.42, maxLife: 0.42 });
}

cvs.addEventListener('pointerdown', (e) => {
  const rect = cvs.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  const w = screenToWorld(mouse.x, mouse.y);
  mouse.wx = w.x; mouse.wy = w.y;

  if (e.button === 1 || (e.button === 0 && e.altKey)) {
    mouse.panning = true;
    mouse.panStart = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y };
    return;
  }

  if (e.button === 2) {
    if (buildMode || orderCursor) {
      buildMode = null; orderCursor = null; updateCursorClass(); renderConsoleUI(true);
      return;
    }
    issueSmartRightClick(w.x, w.y);
    return;
  }

  if (e.button === 0) {
    if (orderCursor === 'scan') {
      sendCommand({ op: 'SCAN', x: w.x, y: w.y });
      orderCursor = null; updateCursorClass(); renderConsoleUI(true);
      return;
    }
    if (orderCursor === 'amove') {
      const unitIds = [...selectedUnits];
      if (unitIds.length) {
        sendCommand({ op: 'UNIT_ORDER', mode: 'amove', x: w.x, y: w.y, unitIds });
        orderMarkers.push({ x: w.x, y: w.y, color: '#ff4b2b', life: 0.45, maxLife: 0.45 });
      }
      orderCursor = null; updateCursorClass(); renderConsoleUI(true);
      return;
    }
    if (buildMode) {
      sendCommand({ op: 'BUILD', kind: buildMode, x: w.x, y: w.y, unitIds: [...selectedUnits] });
      if (buildMode !== 'wall' && !e.shiftKey) {
        buildMode = null;
        updateCursorClass();
        renderConsoleUI(true);
      }
      return;
    }
    mouse.down = true;
    mouse.dragStart = { sx: mouse.x, sy: mouse.y, wx: w.x, wy: w.y, shift: e.shiftKey, ctrl: e.ctrlKey };
  }
});

window.addEventListener('pointerenter', () => { mouse.inside = true; });
window.addEventListener('pointerleave', () => { mouse.inside = false; mouse.clientX = -999; mouse.clientY = -999; });

window.addEventListener('pointermove', (e) => {
  mouse.clientX = e.clientX;
  mouse.clientY = e.clientY;
  mouse.inside = true;
  mouse.overUI = e.target !== cvs;
  const rect = cvs.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  const w = screenToWorld(mouse.x, mouse.y);
  mouse.wx = w.x; mouse.wy = w.y;

  if (mouse.panning && mouse.panStart) {
    const isoSin = Math.sin(((cam.pitch || 70) * Math.PI) / 180);
    cam.x = clamp(mouse.panStart.cx - (e.clientX - mouse.panStart.x) / cam.z, 0, WORLD_SIZE);
    cam.y = clamp(mouse.panStart.cy - (e.clientY - mouse.panStart.y) / (cam.z * isoSin), 0, WORLD_SIZE);
  }
});

window.addEventListener('pointerup', () => {
  if (mouse.panning) { mouse.panning = false; mouse.panStart = null; return; }
  if (!mouse.down) return;
  mouse.down = false;
  if (!state || !mouse.dragStart) return;

  const dx = Math.abs(mouse.x - mouse.dragStart.sx);
  const dy = Math.abs(mouse.y - mouse.dragStart.sy);
  if (!mouse.dragStart.shift) {
    selectedUnits.clear();
    selectedBlds.clear();
  }

  if (dx > 12 || dy > 12) {
    // Cadre tracé à l'écran : on teste la position affichée de chaque unité (la vue inclinée déforme
    // le cadre en trapèze au sol, un rectangle en coordonnées du monde ne correspondait pas à ce qu'on voit)
    const sx1 = Math.min(mouse.dragStart.sx, mouse.x), sx2 = Math.max(mouse.dragStart.sx, mouse.x);
    const sy1 = Math.min(mouse.dragStart.sy, mouse.y), sy2 = Math.max(mouse.dragStart.sy, mouse.y);
    const inBox = (wx, wy, h) => { const pt = worldToScreen3D(wx, wy, h); return pt.x >= sx1 && pt.x <= sx2 && pt.y >= sy1 && pt.y <= sy2; };
    const boxed = state.units.filter((u) => u.owner === myId && u.hp > 0 && !u.boardedIn && inBox(u.x, u.y, u.flying ? 42 : 8));
    const combat = boxed.filter((u) => u.kind !== 'scv');
    const finalUnits = combat.length > 0 ? combat : boxed;
    for (const u of finalUnits) selectedUnits.add(u.id);
    if (selectedUnits.size === 0) {
      for (const b of state.buildings) {
        if (b.owner === myId && b.hp > 0 && inBox(b.x, b.y, (BUILDINGS[b.kind]?.height || 36) * 0.4)) {
          selectedBlds.add(b.id);
        }
      }
    }
  } else {
    const hitU = state.units.find((u) => {
      if (u.owner !== myId || u.hp <= 0 || u.boardedIn) return false;
      if (dist2(u.x, u.y, mouse.wx, mouse.wy) <= (u.radius + 14) ** 2) return true;
      if (threeReady) {
        const hElev = u.flying ? 42 : (u.kind === 'titan' ? 22 : 12);
        const pt = worldToScreen3D(u.x, u.y, hElev);
        return hypot(pt.x - mouse.x, pt.y - mouse.y) <= Math.max(u.radius * cam.z + 14, 20);
      }
      return false;
    });
    if (hitU) {
      const now = performance.now();
      if (mouse.dragStart.ctrl || (lastClickUnit.id === hitU.id && now - lastClickUnit.t < 360)) {
        for (const u of state.units) {
          if (u.owner === myId && u.kind === hitU.kind && u.hp > 0 && !u.boardedIn && hypot(u.x, u.y, cam.x, cam.y) < 900) {
            selectedUnits.add(u.id);
          }
        }
      } else {
        selectedUnits.add(hitU.id);
      }
      lastClickUnit = { id: hitU.id, kind: hitU.kind, t: now };
    } else {
      const hitB = state.buildings.find((b) => {
        if (b.owner !== myId || b.hp <= 0) return false;
        if (dist2(b.x, b.y, mouse.wx, mouse.wy) <= (b.radius + 12) ** 2) return true;
        if (threeReady) {
          const def = BUILDINGS[b.kind] || BUILDINGS.hq;
          const pt = worldToScreen3D(b.x, b.y, (def.height || 36) * 0.45);
          return hypot(pt.x - mouse.x, pt.y - mouse.y) <= Math.max(b.radius * cam.z + 14, 26);
        }
        return false;
      });
      if (hitB) {
        selectedBlds.add(hitB.id);
      }
    }
  }
  mouse.dragStart = null;
  cleanSelection();
  renderConsoleUI(true);
});

// ---- MINIMAP : clic gauche (ou glisser) = déplacer la caméra · clic droit = envoyer la sélection ----
let lastMiniOrder = null;
function miniToWorld(e) {
  const r = miniCvs.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - r.left) / r.width) * WORLD_SIZE, 0, WORLD_SIZE),
    y: clamp(((e.clientY - r.top) / r.height) * WORLD_SIZE, 0, WORLD_SIZE),
  };
}
function issueMinimapOrder(wx, wy, forceAttack = false) {
  if (!state) return false;
  cleanSelection();
  const units = state.units.filter((u) => selectedUnits.has(u.id));
  if (!units.length && selectedBlds.size > 0) {
    // Bâtiment sélectionné : clic droit sur la minimap = point de ralliement
    sendCommand({ op: 'UNIT_ORDER', mode: 'rally', x: wx, y: wy, bldIds: [...selectedBlds] });
    addMiniPing(wx, wy, '#ffc531', 1.3, true);
    orderMarkers.push({ x: wx, y: wy, color: '#ffc531', life: 0.9, maxLife: 0.9 });
    return true;
  }
  if (!units.length) return false;
  const fighters = units.filter((u) => u.kind !== 'scv').map((u) => u.id);
  const workers = units.filter((u) => u.kind === 'scv').map((u) => u.id);
  // Les troupes avancent en attaquant tout ce qu'elles croisent ; les VCS se déplacent simplement
  void forceAttack;
  if (fighters.length) sendCommand({ op: 'UNIT_ORDER', mode: 'amove', x: wx, y: wy, unitIds: fighters });
  if (workers.length) sendCommand({ op: 'UNIT_ORDER', mode: 'move', x: wx, y: wy, unitIds: workers });
  const cx = units.reduce((a, u) => a + u.x, 0) / units.length;
  const cy = units.reduce((a, u) => a + u.y, 0) / units.length;
  const col = fighters.length ? '#ff5a45' : '#3ddc84';
  lastMiniOrder = { fx: cx, fy: cy, x: wx, y: wy, color: col, life: 2.2, maxLife: 2.2 };
  addMiniPing(wx, wy, col, 1.4, true);
  orderMarkers.push({ x: wx, y: wy, color: col, life: 1.2, maxLife: 1.2 });
  return true;
}
let miniDragging = false;
miniCvs.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  e.stopPropagation();
  const w = miniToWorld(e);
  if (e.button === 2 || (e.button === 0 && orderCursor === 'amove')) {
    if (!issueMinimapOrder(w.x, w.y, orderCursor === 'amove')) {
      toast('Sélectionne des unités, puis clic droit sur la minimap pour les y envoyer.', 2200);
    }
    orderCursor = null; updateCursorClass(); renderConsoleUI(true);
    return;
  }
  if (e.button === 0) {
    miniDragging = true;
    try { miniCvs.setPointerCapture(e.pointerId); } catch (err) { /* ignoré */ }
    cam.x = w.x; cam.y = w.y;
  }
});
miniCvs.addEventListener('pointermove', (e) => {
  if (!miniDragging) return;
  const w = miniToWorld(e);
  cam.x = w.x; cam.y = w.y;
});
miniCvs.addEventListener('pointerup', () => { miniDragging = false; });
miniCvs.addEventListener('pointercancel', () => { miniDragging = false; });
miniCvs.addEventListener('contextmenu', (e) => e.preventDefault());

$('#btnCenter').onclick = centerOnMyHq;
$('#uiMapBadge').onclick = () => {
  const def = MAP_DEFS[activeMapId] || MAP_DEFS.vallee;
  toast(`🗺️ ${def.icon} ${def.name}\n⭐ Spécificité : ${def.badgeDesc}`, 4000);
};
// ---- Panneau Son : musique et effets séparés, coupure générale (touche M) ----
function syncAudioUI() {
  const st = Sfx.settings;
  const btn = $('#btnAudio');
  btn.textContent = st.allMuted ? '🔇' : (!st.musicOn && !st.sfxOn) ? '🔈' : '🔊';
  btn.classList.toggle('off', st.allMuted);
  btn.title = st.allMuted ? 'Son coupé — clique pour le remettre (M)' : 'Couper tout le son (M)';
  $('#volMusic').value = Math.round(st.musicVol * 100);
  $('#volSfx').value = Math.round(st.sfxVol * 100);
  $('#tgMusic').textContent = st.musicOn ? 'ON' : 'OFF';
  $('#tgMusic').classList.toggle('on', st.musicOn);
  $('#tgSfx').textContent = st.sfxOn ? 'ON' : 'OFF';
  $('#tgSfx').classList.toggle('on', st.sfxOn);
  $('#tgAll').textContent = st.allMuted ? 'ON' : 'OFF';
  $('#tgAll').classList.toggle('on', st.allMuted);
}
// Un clic sur le haut-parleur coupe / remet TOUT le son ; la flèche ouvre les réglages détaillés
$('#btnAudio').onclick = (e) => {
  e.stopPropagation();
  const m = Sfx.toggleAll();
  syncAudioUI();
  toast(m ? '🔇 Son coupé (M ou clic pour le remettre)' : '🔊 Son rétabli', 1400);
};
$('#btnAudioMore').onclick = (e) => {
  e.stopPropagation();
  const pop = $('#audioPop');
  pop.hidden = !pop.hidden;
  syncAudioUI();
};
$('#audioPop').addEventListener('pointerdown', (e) => e.stopPropagation());
$('#btnAudio').addEventListener('pointerdown', (e) => { e.stopPropagation(); Sfx.wake(); });
$('#btnAudioMore').addEventListener('pointerdown', (e) => { e.stopPropagation(); Sfx.wake(); });
window.addEventListener('pointerdown', () => { $('#audioPop').hidden = true; });
$('#tgAll').onclick = () => { Sfx.toggleAll(); syncAudioUI(); };
$('#tgMusic').onclick = () => { Sfx.setMusicOn(!Sfx.settings.musicOn); syncAudioUI(); };
$('#tgSfx').onclick = () => { Sfx.setSfxOn(!Sfx.settings.sfxOn); syncAudioUI(); Sfx.click(); };
$('#volMusic').oninput = (e) => { Sfx.setMusicVol(Number(e.target.value) / 100); if (!Sfx.settings.musicOn) Sfx.setMusicOn(true); syncAudioUI(); };
$('#volSfx').oninput = (e) => { Sfx.setSfxVol(Number(e.target.value) / 100); if (!Sfx.settings.sfxOn) Sfx.setSfxOn(true); syncAudioUI(); };
$('#volSfx').onchange = () => Sfx.ack('marine');
syncAudioUI();
window.addEventListener('pointerdown', () => Sfx.wake(), { passive: true });
window.addEventListener('keydown', () => Sfx.wake(), { passive: true });

const exitGame = () => {
  Sfx.stopMusic();
  if (window.HubBridge && HubBridge.embedded) HubBridge.exit();
  else location.href = '../';
};
$('#btnExit').onclick = exitGame;
$('#btnEndExit').onclick = exitGame;
$('#btnReplay').onclick = () => {
  if (role === 'guest') { toast('Seul l’hôte peut relancer une partie.'); return; }
  startMatch(lastBootInfo);
};
