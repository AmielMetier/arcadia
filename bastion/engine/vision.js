// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Vision par équipe utilisée par la simulation.
'use strict';

/* ============================================================================
   VISION & BROUILLARD DE GUERRE (avec relief)
   - Une unité au sol en contrebas ne voit pas ce qui se passe sur un plateau.
   - Les unités volantes, les Scans et la Tour de Détection voient partout.
   ============================================================================ */
var FOG_RES = 220;

var fogHigh = new Uint8Array(FOG_RES * FOG_RES);


function buildFogHigh() {
  if (!fogHigh) return;
  const cs = WORLD_SIZE / FOG_RES;
  for (let gy = 0; gy < FOG_RES; gy++) {
    for (let gx = 0; gx < FOG_RES; gx++) {
      const t = terTypeAt((gx + 0.5) * cs, (gy + 0.5) * cs);
      fogHigh[gy * FOG_RES + gx] = (t === T_HIGH || t === T_CLIFF) ? 1 : 0;
    }
  }
}

function fogCellOf(wx, wy) {
  const gx = clamp(Math.floor((wx / WORLD_SIZE) * FOG_RES), 0, FOG_RES - 1);
  const gy = clamp(Math.floor((wy / WORLD_SIZE) * FOG_RES), 0, FOG_RES - 1);
  return gy * FOG_RES + gx;
}

function stampVision(grid, wx, wy, r, ignoreHeight, explored) {
  const sc = FOG_RES / WORLD_SIZE;
  const cx = wx * sc, cy = wy * sc, cr = r * sc, cr2 = cr * cr;
  const seeHigh = ignoreHeight || terTypeAt(wx, wy) === T_HIGH;
  const y0 = Math.max(0, Math.floor(cy - cr)), y1 = Math.min(FOG_RES - 1, Math.ceil(cy + cr));
  const x0 = Math.max(0, Math.floor(cx - cr)), x1 = Math.min(FOG_RES - 1, Math.ceil(cx + cr));
  for (let y = y0; y <= y1; y++) {
    const dy = y + 0.5 - cy;
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx;
      if (dx * dx + dy * dy > cr2) continue;
      const i = y * FOG_RES + x;
      if (!seeHigh && fogHigh[i]) continue;
      grid[i] = 1;
      if (explored) explored[i] = 1;
    }
  }
}

function computeTeamVision(st, team, grid, explored = null) {
  grid.fill(0);
  // Certaines cartes réduisent la vision (chaleur du Canyon, nuit des Ruines)
  const mapDef = MAP_DEFS[st.map] || MAP_DEFS.vallee;
  const uMult = mapDef.unitSightMult || 1, bMult = mapDef.bldSightMult || 1;
  for (const b of st.buildings) {
    if (b.team !== team || b.hp <= 0) continue;
    const def = BUILDINGS[b.kind] || {};
    stampVision(grid, b.x, b.y, (def.sight || 300) * (def.detector ? 1 : bMult), !!def.detector && !b.constructing, explored);
  }
  for (const u of st.units) {
    if (u.team !== team || u.hp <= 0 || u.boardedIn) continue;
    stampVision(grid, u.x, u.y, (UNITS[u.kind]?.sight || 260) * uMult, !!u.flying, explored);
  }
  for (const sc of st.scans || []) {
    if (sc.team === team) stampVision(grid, sc.x, sc.y, sc.r, true, explored);
  }
}

// Vision par équipe utilisée par la simulation : on ne tire pas sur un plateau qu'on ne voit pas
const simVision = { t: -1, st: null, grids: new Map(), det: new Map() };
// Détection : Tours de Détection, Oculus et Scans révèlent les unités camouflées
function computeTeamDetection(st, team, grid) {
  grid.fill(0);
  for (const b of st.buildings) {
    if (b.team !== team || b.hp <= 0 || b.constructing || !BUILDINGS[b.kind]?.detector) continue;
    stampVision(grid, b.x, b.y, BUILDINGS[b.kind].sight, true, null);
  }
  for (const sc of st.scans || []) if (sc.team === team) stampVision(grid, sc.x, sc.y, sc.r, true, null);
}
function teamDetects(team, wx, wy) {
  const g = simVision.det.get(team);
  return !!g && g[fogCellOf(wx, wy)] === 1;
}
function refreshSimVision(st) {
  if (simVision.st === st && st.time - simVision.t < 0.25 && st.time >= simVision.t) return;
  simVision.st = st;
  simVision.t = st.time;
  const teams = new Set(st.players.filter((p) => !p.dead).map((p) => p.team));
  for (const t of teams) {
    let g = simVision.grids.get(t);
    if (!g || g.length !== FOG_RES * FOG_RES) { g = new Uint8Array(FOG_RES * FOG_RES); simVision.grids.set(t, g); }
    computeTeamVision(st, t, g);
    let dg = simVision.det.get(t);
    if (!dg || dg.length !== FOG_RES * FOG_RES) { dg = new Uint8Array(FOG_RES * FOG_RES); simVision.det.set(t, dg); }
    computeTeamDetection(st, t, dg);
  }
}
function teamSees(team, wx, wy) {
  const g = simVision.grids.get(team);
  return !g || g[fogCellOf(wx, wy)] === 1;
}
// Un attaquant au sol en contrebas ne peut viser une cible sur un plateau que si son équipe la voit
function canStrike(attacker, target) {
  if (attacker.flying) return true;
  if (!isHighAt(target.x, target.y)) return true;
  if (isHighAt(attacker.x, attacker.y)) return true;
  return teamSees(attacker.team, target.x, target.y);
}
