// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Relief, pathfinding, disposition des cartes et ressources.
'use strict';

/* ============================================================================
   CARTES : TAILLE DU MONDE, RELIEF, RESSOURCES
   ----------------------------------------------------------------------------
   - FFA : carte 3600 × 3600, bases aux 4 coins.
   - 2v2 : la même carte agrandie (5040 × 5040, ~2× la surface), les deux alliés
     ont leurs bases côte à côte sur le même flanc (Équipe A à l'ouest, B à l'est).
   - Relief : bases principales sur un plateau surélevé avec 1 ou 2 rampes d'accès,
     plateau central à 4 rampes, montagnes et cours d'eau / lave / crevasses
     infranchissables (les unités volantes passent au-dessus).
   ============================================================================ */
const BASE_WORLD = 3600;
const SPAWN_CORNERS = [];          // emplacements de départ (rempli par initMap)
let TEAM_SPAWNS = null;            // 2v2 : [[A1, A2], [B1, B2]]
let activeMapId = 'vallee';
let activeLayout = 'ffa';
const MINERAL_NODES = [];
const GAS_GEYSERS = [];
const ROCKS = [];
const TREES_3D = [];
let MAP_FEATURES = null;           // géométrie du relief (plateaux, montagnes, eau, routes)

const HIGH_GROUND = 42;            // hauteur des plateaux
const CLIFF_W = 26;                // épaisseur de la falaise
const RAMP_LEN = 116;              // longueur d'une rampe
const RAMP_HALF = 64;              // demi-largeur d'une rampe
const MAIN_R = 336;                // rayon du plateau d'une base principale
const CENTER_R = 330;              // rayon du plateau central

const T_LOW = 0, T_HIGH = 1, T_RAMP = 2, T_CLIFF = 3, T_LIQUID = 4, T_MOUNT = 5;
const TER_CELL = 12;
let TER_N = 1;
let terType = new Uint8Array(1);
let terH = new Float32Array(1);
let terrainActive = true;

const LIQUID_LABEL = Object.fromEntries(Object.values(MAP_DEFS).map((d) => [d.id, d.look.liquidLabel]));

// ---- Pathfinding par champs de flux (Dijkstra) mis en cache par cellule-objectif ----
// La grille connaît le relief ET les bâtiments : sans eux, les unités fonçaient dans leurs propres
// bâtiments et restaient coincées dans leur base.
const PATH_CELL = 20;
let PATH_N = 1;
let pathTerrain = new Uint8Array(1);   // relief infranchissable
let pathBld = new Uint8Array(1);       // emprise des bâtiments
let pathBlocked = new Uint8Array(1);   // relief + bâtiments (ce que suit le Dijkstra)
let pathBldSig = 0;
const flowCache = new Map();
const FLOW_CACHE_MAX = 64;
const FLOW_BUILDS_PER_TICK = 4;        // champs neufs calculés au plus par pas de simulation
let flowBuildsLeft = FLOW_BUILDS_PER_TICK;
const WAYPOINT_TTL = 0.3;              // une unité garde son point de passage 0,3 s avant de le recalculer
const NB8 = [[1, 0, 10], [-1, 0, 10], [0, 1, 10], [0, -1, 10], [1, 1, 14], [1, -1, 14], [-1, 1, 14], [-1, -1, 14]];

function setWorldSize(size) {
  WORLD_SIZE = size;
  HALF_W = size / 2;
  TER_N = Math.ceil(size / TER_CELL);
  terType = new Uint8Array(TER_N * TER_N);
  terH = new Float32Array(TER_N * TER_N);
  PATH_N = Math.ceil(size / PATH_CELL);
  pathTerrain = new Uint8Array(PATH_N * PATH_N);
  pathBld = new Uint8Array(PATH_N * PATH_N);
  pathBlocked = new Uint8Array(PATH_N * PATH_N);
  pathBldSig = 0;
  flowCache.clear();
}

function terTypeAt(x, y) {
  const gx = Math.floor(x / TER_CELL), gy = Math.floor(y / TER_CELL);
  if (gx < 0 || gy < 0 || gx >= TER_N || gy >= TER_N) return T_LOW;
  return terType[gy * TER_N + gx];
}
function heightAt(x, y) {
  const fx = x / TER_CELL - 0.5, fy = y / TER_CELL - 0.5;
  let gx = Math.floor(fx), gy = Math.floor(fy);
  const tx = fx - gx, ty = fy - gy;
  const N = TER_N;
  const g = (ix, iy) => terH[clamp(iy, 0, N - 1) * N + clamp(ix, 0, N - 1)];
  const a = g(gx, gy), b = g(gx + 1, gy), c = g(gx, gy + 1), d = g(gx + 1, gy + 1);
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}
function isHighAt(x, y) { return terTypeAt(x, y) === T_HIGH; }
function isBlockedAt(x, y) { return terTypeAt(x, y) >= T_CLIFF; }
function isAreaBlocked(x, y, r) {
  if (isBlockedAt(x, y)) return true;
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    if (isBlockedAt(x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
    if (isBlockedAt(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55)) return true;
  }
  return false;
}
function areaTypes(x, y, r) {
  const set = new Set([terTypeAt(x, y)]);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    set.add(terTypeAt(x + Math.cos(a) * r, y + Math.sin(a) * r));
    set.add(terTypeAt(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55));
  }
  return set;
}
function segmentClear(x1, y1, x2, y2) {
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.ceil(d / 7);
  for (let i = 1; i <= n; i++) {
    const t = i / n;
    if (isBlockedAt(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
  }
  return true;
}
function nearestLand(x, y) {
  if (!isBlockedAt(x, y)) return { x, y };
  for (let r = 10; r <= 520; r += 10) {
    for (let k = 0; k < 28; k++) {
      const a = (k / 28) * TAU;
      const px = clamp(x + Math.cos(a) * r, 26, WORLD_SIZE - 26), py = clamp(y + Math.sin(a) * r, 26, WORLD_SIZE - 26);
      if (!isBlockedAt(px, py)) return { x: px, y: py };
    }
  }
  return { x, y };
}

function bezierPt(c, t) {
  const u = 1 - t;
  return [
    u * u * u * c[0] + 3 * u * u * t * c[2] + 3 * u * t * t * c[4] + t * t * t * c[6],
    u * u * u * c[1] + 3 * u * u * t * c[3] + 3 * u * t * t * c[5] + t * t * t * c[7],
  ];
}
function segDist(px, py, x1, y1, x2, y2) {
  const vx = x2 - x1, vy = y2 - y1;
  const l2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, ((px - x1) * vx + (py - y1) * vy) / l2));
  return Math.hypot(px - (x1 + vx * t), py - (y1 + vy * t));
}
function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function hash2(x, y) {
  const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}

/* ---------- Disposition des cartes ---------- */
function buildLayout(mapId, layout) {
  const W = WORLD_SIZE, C = HALF_W, k = W / BASE_WORLD;
  const F = {
    mapId, layout, plateaus: [], mountains: [], liquids: [], pools: [], crossings: [], roads: [],
    mains: [], expos: [], center: { x: C, y: C, r: CENTER_R, ramps: [] }, liquidHalf: 44,
  };
  const rampFoot = (p, a) => ({ x: p.x + Math.cos(a) * (p.r + RAMP_LEN + 34), y: p.y + Math.sin(a) * (p.r + RAMP_LEN + 34) });
  const addRidge = (pts, w) => F.mountains.push({ pts, w });
  const mirror4 = (pts, w) => {
    addRidge(pts, w);
    addRidge(pts.map(([x, y]) => [W - x, y]), w);
    addRidge(pts.map(([x, y]) => [x, W - y]), w);
    addRidge(pts.map(([x, y]) => [W - x, W - y]), w);
  };

  SPAWN_CORNERS.length = 0;
  TEAM_SPAWNS = null;

  if (layout === '1v1') {
    // ---- DUEL : carte plus compacte (3000), bases en diagonale, symétrie centrale ----
    const P = (x, y) => [W - x, W - y];
    const A = { x: 470, y: 470 }, B = { x: W - 470, y: W - 470 };
    SPAWN_CORNERS.push(A, B);
    const natA = { x: 1090, y: 380, a: -Math.PI / 2 }, thirdA = { x: 380, y: 1090, a: Math.PI };
    const natB = { x: W - natA.x, y: W - natA.y, a: Math.PI / 2 }, thirdB = { x: W - thirdA.x, y: W - thirdA.y, a: 0 };
    // Coins disputés : loin des deux joueurs, à mi-chemin
    const cornerTR = { x: W - 400, y: 400, a: -Math.PI / 4 }, cornerBL = { x: 400, y: W - 400, a: (3 * Math.PI) / 4 };
    const rampA = Math.atan2(natA.y + 260 - A.y, natA.x - A.x);
    F.mains.push({ ...A, r: MAIN_R - 26, away: Math.atan2(A.y - C, A.x - C), ramps: [rampA] });
    F.mains.push({ ...B, r: MAIN_R - 26, away: Math.atan2(B.y - C, B.x - C), ramps: [rampA + Math.PI] });
    F.expos.push(natA, thirdA, natB, thirdB, cornerTR, cornerBL);
    F.center.r = CENTER_R - 30;
    F.center.ramps = [Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, -Math.PI / 4];
    const crossA = { x: C + 560, y: C - 560, r: 210 }, crossB = { x: C - 560, y: C + 560, r: 210 };
    F.crossings.push(crossA, crossB);
    if (mapId === 'desert') {
      F.liquidHalf = 42;
      F.pools.push({ x: C + 520, y: C + 120, r: 110 }, { x: C - 520, y: C - 120, r: 110 });
    } else if (mapId === 'ruines') {
      F.liquidHalf = 38;
      F.liquids.push([W, 0, W * 0.66, W * 0.34, W * 0.34, W * 0.66, 0, W]);
    } else {
      F.liquidHalf = mapId === 'magma' ? 44 : 42;
      F.liquids.push([W, 0, C + 180, C - 620, C - 180, C + 620, 0, W]);
      if (mapId === 'magma') F.pools.push({ x: C + 640, y: C + 180, r: 105 }, { x: C - 640, y: C - 180, r: 105 });
    }
    // Montagnes : protègent les troisièmes bases et dessinent deux couloirs vers le centre
    for (const [pts, w] of [[[[760, 820], [900, 980], [980, 1150]], 74], [[[1240, 700], [1380, 760]], 64]]) {
      addRidge(pts, w);
      addRidge(pts.map(([x, y]) => P(x, y)), w);
    }
    for (const [m, nat, third] of [[F.mains[0], natA, thirdA], [F.mains[1], natB, thirdB]]) {
      const f = rampFoot(m, m.ramps[0]);
      F.roads.push([f.x, f.y, nat.x, nat.y + Math.sign(C - nat.y) * 120, 40]);
      F.roads.push([f.x, f.y, third.x + Math.sign(C - third.x) * 140, third.y, 36]);
      const ca = F.center.ramps.reduce((b, a) => (hypot(rampFoot(F.center, a).x, rampFoot(F.center, a).y, f.x, f.y) < hypot(rampFoot(F.center, b).x, rampFoot(F.center, b).y, f.x, f.y) ? a : b));
      const cf = rampFoot(F.center, ca);
      F.roads.push([f.x, f.y, cf.x, cf.y, 44]);
    }
  } else if (layout === '2v2') {
    // ---- 2 CONTRE 2 : alliés côte à côte sur le même flanc ----
    const ax = 560, dy = 720;
    const A1 = { x: ax, y: C - dy }, A2 = { x: ax, y: C + dy };
    const B1 = { x: W - ax, y: C - dy }, B2 = { x: W - ax, y: C + dy };
    TEAM_SPAWNS = [[A1, A2], [B1, B2]];
    SPAWN_CORNERS.push(A1, B1, A2, B2);
    // Chaque plateau a 2 rampes : vers sa base avancée (côté bord) et vers l'allié (base partagée)
    F.mains.push({ ...A1, r: MAIN_R, away: Math.PI, ramps: [-Math.PI / 2, Math.PI / 2] });
    F.mains.push({ ...A2, r: MAIN_R, away: Math.PI, ramps: [Math.PI / 2, -Math.PI / 2] });
    F.mains.push({ ...B1, r: MAIN_R, away: 0, ramps: [-Math.PI / 2, Math.PI / 2] });
    F.mains.push({ ...B2, r: MAIN_R, away: 0, ramps: [Math.PI / 2, -Math.PI / 2] });
    F.center.ramps = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

    const nats = [
      { x: 780, y: 830, a: -2.45 }, { x: 780, y: W - 830, a: 2.45 },
      { x: W - 780, y: 830, a: -0.69 }, { x: W - 780, y: W - 830, a: 0.69 },
    ];
    const shared = [{ x: 470, y: C, a: Math.PI }, { x: W - 470, y: C, a: 0 }];
    const mids = [
      { x: C - 900, y: 760, a: -Math.PI / 2 }, { x: C - 900, y: W - 760, a: Math.PI / 2 },
      { x: C + 900, y: 760, a: -Math.PI / 2 }, { x: C + 900, y: W - 760, a: Math.PI / 2 },
      { x: C, y: 470, a: -Math.PI / 2 }, { x: C, y: W - 470, a: Math.PI / 2 },
    ];
    F.expos.push(...nats, ...shared, ...mids);

    F.crossings.push({ x: C, y: 470, r: 240 }, { x: C, y: W - 470, r: 240 });
    F.liquidHalf = mapId === 'magma' ? 50 : mapId === 'glace' ? 46 : 48;
    if (mapId === 'desert') {
      // Canyon : pas de rivière, des oasis au milieu de chaque flanc
      F.pools.push({ x: C, y: C - 900, r: 150 }, { x: C, y: C + 900, r: 150 });
    } else if (mapId === 'ruines') {
      // Canal droit nord-sud, franchi par les ponts des avant-postes
      F.liquids.push([C, 0, C, W * 0.33, C, W * 0.66, C, W]);
    } else {
      F.liquids.push([C + 210, 0, C - 300, W * 0.33, C + 300, W * 0.66, C - 210, W]);
    }
    if (mapId !== 'vallee' && mapId !== 'ruines') {
      F.pools.push({ x: 1650, y: 1250, r: 130 }, { x: W - 1650, y: W - 1250, r: 130 },
        { x: 1650, y: W - 1250, r: 130 }, { x: W - 1650, y: 1250, r: 130 });
    }
    // Montagnes : couloir entre la base partagée et le centre + massifs latéraux
    const ridges = [
      [[[1330, C - 330], [1560, C - 360], [1780, C - 430]], 80],
      [[[1330, C + 330], [1560, C + 360], [1780, C + 430]], 80],
      [[[1240, 1360], [1380, 1520], [1500, 1700]], 82],
      [[[1240, W - 1360], [1380, W - 1520], [1500, W - 1700]], 82],
      [[[240, 1360], [330, 1180]], 70],
      [[[240, W - 1360], [330, W - 1180]], 70],
    ];
    for (const [pts, w] of ridges) {
      addRidge(pts, w);
      addRidge(pts.map(([x, y]) => [W - x, y]), w);
    }
    // Routes (purement décoratives + franchissement de l'eau)
    for (const m of F.mains) for (const a of m.ramps) {
      const f = rampFoot(m, a);
      const towardAlly = Math.sign(Math.sin(a)) === Math.sign(C - m.y);
      const tgt = towardAlly ? (m.x < C ? shared[0] : shared[1]) : nats.reduce((b, n) => (hypot(n.x, n.y, f.x, f.y) < hypot(b.x, b.y, f.x, f.y) ? n : b));
      F.roads.push([f.x, f.y, tgt.x + (m.x < C ? 160 : -160), tgt.y, 40]);
    }
    for (const s of shared) {
      const cf = rampFoot(F.center, s.x < C ? Math.PI : 0);
      F.roads.push([s.x + (s.x < C ? 160 : -160), s.y, cf.x, cf.y, 46]);
    }
    for (const n of nats) {
      const mid = mids.reduce((b, m) => (Math.abs(m.x - C) > 10 && hypot(m.x, m.y, n.x, n.y) < hypot(b.x, b.y, n.x, n.y) ? m : b), mids[0]);
      F.roads.push([n.x + (n.x < C ? 160 : -160), n.y, mid.x, mid.y + (mid.y < C ? 140 : -140), 38]);
      const ford = mid.y < C ? mids[4] : mids[5];
      F.roads.push([mid.x, mid.y + (mid.y < C ? 140 : -140), ford.x, ford.y + (ford.y < C ? 140 : -140), 38]);
    }
    for (const a of F.center.ramps) {
      if (Math.abs(Math.cos(a)) > 0.5) continue;
      const cf = rampFoot(F.center, a);
      const ford = a > 0 ? mids[5] : mids[4];
      F.roads.push([cf.x, cf.y, ford.x, ford.y + (ford.y < C ? 140 : -140), 40]);
    }
  } else {
    // ---- CHACUN POUR SOI : 4 coins ----
    const I = 500;
    const sp = [{ x: I, y: I }, { x: W - I, y: W - I }, { x: W - I, y: I }, { x: I, y: W - I }];
    SPAWN_CORNERS.push(...sp);
    const nats = sp.map((s) => ({ x: s.x < C ? 1120 : W - 1120, y: s.y < C ? 470 : W - 470, a: s.x < C ? 0 : Math.PI }));
    sp.forEach((s, i) => {
      const n = nats[i];
      const ra = Math.atan2(n.y + Math.sign(C - s.y) * 270 - s.y, n.x - s.x);
      F.mains.push({ ...s, r: MAIN_R, away: Math.atan2(s.y - C, s.x - C), ramps: [ra] });
    });
    const laterals = [
      { x: C, y: 380, a: -Math.PI / 2 }, { x: C, y: W - 380, a: Math.PI / 2 },
      { x: 380, y: C, a: Math.PI }, { x: W - 380, y: C, a: 0 },
    ];
    F.expos.push(...nats, ...laterals);
    F.center.ramps = [Math.PI / 4, (3 * Math.PI) / 4, (-3 * Math.PI) / 4, -Math.PI / 4];
    for (const l of laterals) F.crossings.push({ x: l.x, y: l.y, r: 225 });
    if (mapId === 'magma') {
      F.liquidHalf = 46;
      F.liquids.push([0, C - 240, W * 0.35, C + 220, W * 0.65, C - 260, W, C + 220]);
      F.liquids.push([C - 260, 0, C + 240, W * 0.35, C - 250, W * 0.65, C + 240, W]);
    } else if (mapId === 'desert') {
      // Quatre oasis entre les bases et le centre, et des mesas en plus des montagnes
      F.liquidHalf = 44;
      for (const [x, y] of [[C, C - 760], [C, C + 760], [C - 760, C], [C + 760, C]]) F.pools.push({ x, y, r: 120 });
      mirror4([[700, 1500], [860, 1640]], 92);
    } else if (mapId === 'ruines') {
      // Deux canaux droits en croix : la ville est coupée en quatre quartiers reliés par des ponts
      F.liquidHalf = 40;
      F.liquids.push([0, C, W * 0.33, C, W * 0.66, C, W, C]);
      F.liquids.push([C, 0, C, W * 0.33, C, W * 0.66, C, W]);
    } else if (mapId === 'glace') {
      F.liquidHalf = 42;
      F.liquids.push([0, C - 210, W * 0.33, C + 240, W * 0.66, C - 250, W, C + 210]);
      F.liquids.push([C + 210, 0, C - 240, W * 0.33, C + 220, W * 0.66, C - 210, W]);
    } else {
      F.liquidHalf = 44;
      F.liquids.push([0, C - 220, W * 0.33, C + 280, W * 0.66, C - 280, W, C + 220]);
    }
    mirror4([[1240, 690], [1400, 810], [1530, 965]], 78);
    mirror4([[690, 1240], [810, 1400], [965, 1530]], 78);
    // Routes
    F.mains.forEach((m, i) => {
      const f = rampFoot(m, m.ramps[0]);
      const n = nats[i];
      F.roads.push([f.x, f.y, n.x, n.y + Math.sign(C - n.y) * 120, 40]);
      const ca = F.center.ramps.reduce((b, a) => {
        const p = rampFoot(F.center, a), q = rampFoot(F.center, b);
        return hypot(p.x, p.y, f.x, f.y) < hypot(q.x, q.y, f.x, f.y) ? a : b;
      });
      const cf = rampFoot(F.center, ca);
      F.roads.push([f.x, f.y, cf.x, cf.y, 46]);
      const lat = laterals[n.y < C ? 0 : 1];
      F.roads.push([n.x, n.y + Math.sign(C - n.y) * 120, lat.x, lat.y + Math.sign(C - lat.y) * 150, 36]);
      const side = laterals[m.x < C ? 2 : 3];
      F.roads.push([f.x, f.y, side.x + Math.sign(C - side.x) * 150, side.y, 36]);
    });
  }
  for (const m of F.mains) F.plateaus.push({ x: m.x, y: m.y, r: m.r, ramps: m.ramps, main: true });
  F.plateaus.push({ x: C, y: C, r: F.center.r, ramps: F.center.ramps, main: false });
  return F;
}

function placeResources(mapId, F) {
  MINERAL_NODES.length = 0;
  GAS_GEYSERS.length = 0;
  ROCKS.length = 0;
  let mId = 1, gId = 1;
  const C = HALF_W;
  const mainCount = mapId === 'magma' ? 5 : 6;
  F.mains.forEach((m, idx) => {
    const half = (mainCount - 1) / 2;
    for (let i = -half; i <= half; i += 1) {
      const a = m.away + i * 0.25;
      MINERAL_NODES.push({ id: 'm' + (mId++), x: Math.round(m.x + Math.cos(a) * 142), y: Math.round(m.y + Math.sin(a) * 142), rich: mapId !== 'vallee' && Math.abs(i) === half });
    }
    // (en duel, symétrie centrale : même décalage pour les deux bases)
    const gasAngles = mapId === 'magma' ? [0.95, -0.95] : [F.layout === '1v1' || idx % 2 === 0 ? 0.95 : -0.95];
    for (const ga of gasAngles) {
      GAS_GEYSERS.push({ id: 'g' + (gId++), x: Math.round(m.x + Math.cos(m.away + ga) * 150), y: Math.round(m.y + Math.sin(m.away + ga) * 150) });
    }
  });
  for (const n of F.expos) {
    for (let i = -1.5; i <= 1.5; i += 1) {
      const a = n.a + i * 0.28;
      MINERAL_NODES.push({ id: 'm' + (mId++), x: Math.round(n.x + Math.cos(a) * 105), y: Math.round(n.y + Math.sin(a) * 105), rich: !!MAP_DEFS[mapId]?.richExpos });
    }
    GAS_GEYSERS.push({ id: 'g' + (gId++), x: Math.round(n.x + Math.cos(n.a + 0.85) * 118), y: Math.round(n.y + Math.sin(n.a + 0.85) * 118) });
  }
  // Filon d'or du plateau central
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + Math.PI / 8;
    MINERAL_NODES.push({ id: 'm' + (mId++), x: Math.round(C + Math.cos(a) * 168), y: Math.round(C + Math.sin(a) * 168), rich: true });
  }
  const geyA = F.layout === '1v1' ? [Math.PI / 4, (-3 * Math.PI) / 4] : F.layout === '2v2'
    ? [Math.PI / 4, (-3 * Math.PI) / 4]
    : mapId === 'magma' ? [0, Math.PI / 2, Math.PI, -Math.PI / 2] : [0, Math.PI];
  for (const a of geyA) GAS_GEYSERS.push({ id: 'g' + (gId++), x: Math.round(C + Math.cos(a) * 258), y: Math.round(C + Math.sin(a) * 258) });
}

/* ---------- Rasterisation du relief (types + hauteurs) ---------- */
function rasterizeTerrain(mapId, F) {
  const N = TER_N, cs = TER_CELL;
  const liq = new Float32Array(N * N).fill(1e9);   // distance à l'eau/lave
  const mtn = new Float32Array(N * N).fill(1e9);   // distance relative (d / largeur) aux montagnes
  const land = new Uint8Array(N * N);              // gués, ponts, routes
  const plat = new Int8Array(N * N).fill(-1);      // type imposé par un plateau
  const platH = new Float32Array(N * N);
  const stampSeg = (x1, y1, x2, y2, margin, fn) => {
    const gx0 = Math.max(0, Math.floor((Math.min(x1, x2) - margin) / cs)), gx1 = Math.min(N - 1, Math.floor((Math.max(x1, x2) + margin) / cs));
    const gy0 = Math.max(0, Math.floor((Math.min(y1, y2) - margin) / cs)), gy1 = Math.min(N - 1, Math.floor((Math.max(y1, y2) + margin) / cs));
    for (let gy = gy0; gy <= gy1; gy++) for (let gx = gx0; gx <= gx1; gx++) {
      const cx = (gx + 0.5) * cs, cy = (gy + 0.5) * cs;
      fn(gy * N + gx, segDist(cx, cy, x1, y1, x2, y2), cx, cy);
    }
  };
  const half = F.liquidHalf;
  F.liquidPolys = F.liquids.map((c) => { const pts = []; for (let i = 0; i <= 120; i++) pts.push(bezierPt(c, i / 120)); return pts; });
  for (const pts of F.liquidPolys) for (let i = 0; i < pts.length - 1; i++) {
    stampSeg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], half + 30, (idx, d) => { if (d < liq[idx]) liq[idx] = d; });
  }
  for (const p of F.pools) {
    stampSeg(p.x, p.y, p.x, p.y, p.r + 40, (idx, d, cx, cy) => {
      const wob = 1 + 0.12 * Math.sin(Math.atan2(cy - p.y, cx - p.x) * 5 + p.x);
      const e = d - (p.r * wob - half);
      if (e < liq[idx]) liq[idx] = e;
    });
  }
  for (const m of F.mountains) for (let i = 0; i < m.pts.length - 1; i++) {
    const [x1, y1] = m.pts[i], [x2, y2] = m.pts[i + 1];
    stampSeg(x1, y1, x2, y2, m.w * 1.7, (idx, d, cx, cy) => {
      const wob = 1 + 0.18 * (vnoise(cx * 0.012, cy * 0.012) - 0.5) * 2;
      const r = d / (m.w * wob);
      if (r < mtn[idx]) mtn[idx] = r;
    });
  }
  for (const c of F.crossings) stampSeg(c.x, c.y, c.x, c.y, c.r, (idx, d) => { if (d < c.r) land[idx] = 1; });
  for (const r of F.roads) stampSeg(r[0], r[1], r[2], r[3], r[4] + 6, (idx, d) => { if (d < r[4]) land[idx] = 2; });
  // Ressources et zones de base toujours praticables
  for (const m of MINERAL_NODES) stampSeg(m.x, m.y, m.x, m.y, 60, (idx, d) => { if (d < 60) land[idx] = Math.max(land[idx], 1); });
  for (const g of GAS_GEYSERS) stampSeg(g.x, g.y, g.x, g.y, 70, (idx, d) => { if (d < 70) land[idx] = Math.max(land[idx], 1); });
  for (const e of F.expos) stampSeg(e.x, e.y, e.x, e.y, 170, (idx, d) => { if (d < 170) land[idx] = Math.max(land[idx], 1); });

  // Plateaux + rampes + falaises
  for (const P of F.plateaus) {
    const ext = P.r + CLIFF_W + RAMP_LEN + 24;
    stampSeg(P.x, P.y, P.x, P.y, ext, (idx, dc, cx, cy) => {
      if (dc > ext) return;
      const dx = cx - P.x, dy = cy - P.y;
      let rampLat = 1e9, rampAlong = 0;
      for (const a of P.ramps) {
        const ca = Math.cos(a), sa = Math.sin(a);
        const along = dx * ca + dy * sa, lat = Math.abs(-dx * sa + dy * ca);
        if (along > P.r - 50 && along < P.r + RAMP_LEN && lat < rampLat) { rampLat = lat; rampAlong = along; }
      }
      const t = clamp((rampAlong - P.r) / RAMP_LEN, 0, 1);
      if (dc <= P.r) {
        plat[idx] = T_HIGH; platH[idx] = HIGH_GROUND;
      } else if (rampLat < RAMP_HALF) {
        plat[idx] = T_RAMP; platH[idx] = HIGH_GROUND * (1 - smooth01(t));
      } else if (rampLat < RAMP_HALF + 16 && t < 0.86) {
        plat[idx] = T_CLIFF; platH[idx] = HIGH_GROUND * (1 - smooth01(t)) + 6;
      } else if (dc < P.r + CLIFF_W) {
        plat[idx] = T_CLIFF; platH[idx] = HIGH_GROUND * (1 - smooth01((dc - P.r) / CLIFF_W));
      }
    });
  }

  const seed = { magma: 3.1, glace: 7.7, desert: 5.4, ruines: 9.2 }[mapId] || 1.3;
  for (let gy = 0; gy < N; gy++) for (let gx = 0; gx < N; gx++) {
    const i = gy * N + gx;
    const cx = (gx + 0.5) * cs, cy = (gy + 0.5) * cs;
    const und = 2.2 * vnoise(cx * 0.004 + seed, cy * 0.004) + 1.2 * vnoise(cx * 0.013, cy * 0.013 + seed);
    if (plat[i] >= 0) {
      terType[i] = plat[i];
      terH[i] = platH[i] + (plat[i] === T_HIGH ? und * 0.6 : 0);
      continue;
    }
    let type = T_LOW, h = und;
    if (land[i]) {
      if (liq[i] < half + 8) h = 1.5;              // gué / pont
    } else if (liq[i] < half) {
      type = T_LIQUID;
      h = -16 + 4 * smooth01(liq[i] / half - 0.6);
    } else if (mtn[i] < 1) {
      type = T_MOUNT;
      const core = 1 - mtn[i] * mtn[i];
      h = 34 + 92 * core + 34 * (vnoise(cx * 0.02 + seed, cy * 0.02) - 0.3) * core;
    }
    if (type === T_LOW) {
      if (mtn[i] < 1.55 && land[i] !== 2) h += 30 * smooth01((1.55 - mtn[i]) / 0.55);           // contreforts
      if (liq[i] < half + 26 && !land[i]) h = lerp(-7, h, smooth01((liq[i] - half) / 26));         // berges
    }
    terType[i] = type;
    terH[i] = h;
  }
  // Bords de carte : légère falaise décorative
  terrainActive = true;
}

function buildPathGrid() {
  flowCache.clear();
  for (let gy = 0; gy < PATH_N; gy++) {
    for (let gx = 0; gx < PATH_N; gx++) {
      const cx = (gx + 0.5) * PATH_CELL, cy = (gy + 0.5) * PATH_CELL;
      let n = 0;
      if (isBlockedAt(cx - 6, cy - 6)) n++;
      if (isBlockedAt(cx + 6, cy - 6)) n++;
      if (isBlockedAt(cx - 6, cy + 6)) n++;
      if (isBlockedAt(cx + 6, cy + 6)) n++;
      pathTerrain[gy * PATH_N + gx] = (isBlockedAt(cx, cy) || n >= 2) ? 1 : 0;
    }
  }
  pathBld.fill(0);
  pathBlocked.set(pathTerrain);
  pathBldSig = 0;
}
// Recopie l'emprise des bâtiments dans la grille quand ils changent (pose, destruction, déplacement)
function syncPathBuildings(st) {
  let sig = st.buildings.length;
  for (const b of st.buildings) {
    if (b.hp <= 0) continue;
    sig = (Math.imul(sig, 31) + b.id * 7 + (b.x | 0) * 13 + (b.y | 0)) | 0;
  }
  if (sig === pathBldSig) return;
  pathBldSig = sig;
  pathBld.fill(0);
  for (const b of st.buildings) {
    if (b.hp <= 0) continue;
    const r = b.radius + 4;
    const gx0 = Math.max(0, Math.floor((b.x - r) / PATH_CELL)), gx1 = Math.min(PATH_N - 1, Math.floor((b.x + r) / PATH_CELL));
    const gy0 = Math.max(0, Math.floor((b.y - r) / PATH_CELL)), gy1 = Math.min(PATH_N - 1, Math.floor((b.y + r) / PATH_CELL));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        if (hypot((gx + 0.5) * PATH_CELL, (gy + 0.5) * PATH_CELL, b.x, b.y) <= r) pathBld[gy * PATH_N + gx] = 1;
      }
    }
  }
  for (let i = 0; i < pathBlocked.length; i++) pathBlocked[i] = pathTerrain[i] | pathBld[i];
  flowCache.clear();
}
function pathCellOf(x, y) {
  const gx = clamp(Math.floor(x / PATH_CELL), 0, PATH_N - 1), gy = clamp(Math.floor(y / PATH_CELL), 0, PATH_N - 1);
  return gy * PATH_N + gx;
}
// Cellule libre la plus proche (anneaux successifs autour de la cellule de départ)
function nearestFreeCell(idx) {
  if (!pathBlocked[idx]) return idx;
  const cx = idx % PATH_N, cy = (idx / PATH_N) | 0;
  for (let r = 1; r <= 24; r++) {
    let best = -1, bestD = Infinity;
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r) continue;
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= PATH_N || ny >= PATH_N) continue;
        const ni = ny * PATH_N + nx;
        const d = ox * ox + oy * oy;
        if (!pathBlocked[ni] && d < bestD) { bestD = d; best = ni; }
      }
    }
    if (best >= 0) return best;
  }
  return idx;
}
// Ligne droite praticable : relief franchissable et aucun bâtiment en travers
// (on tolère les bâtiments au départ et à l'arrivée : unité collée à un mur, cible qui est un bâtiment)
function pathSegmentClear(x1, y1, x2, y2, endTol = 70) {
  if (!segmentClear(x1, y1, x2, y2)) return false;
  const d = Math.hypot(x2 - x1, y2 - y1);
  const n = Math.ceil(d / 10);
  for (let i = 1; i < n; i++) {
    const t = i / n;
    if (d * t < 24 || d * (1 - t) < endTol) continue;
    if (pathBld[pathCellOf(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)]) return false;
  }
  return true;
}
// Tas binaire réutilisé d'un calcul à l'autre (pas d'allocation par cellule)
let heapIdx = new Int32Array(1), heapCost = new Float32Array(1);
function getFlowField(goalIdx) {
  let f = flowCache.get(goalIdx);
  if (f) { flowCache.delete(goalIdx); flowCache.set(goalIdx, f); return f; }
  // Budget par pas : au-delà, l'unité garde son ancien point de passage et réessaie au pas suivant
  if (flowBuildsLeft <= 0) return null;
  flowBuildsLeft--;
  const N2 = PATH_N * PATH_N;
  if (heapIdx.length < N2 * 8 + 8) { heapIdx = new Int32Array(N2 * 8 + 8); heapCost = new Float32Array(N2 * 8 + 8); }
  f = new Float32Array(N2).fill(Infinity);
  let size = 0;
  const push = (i, c) => {
    let k = size++;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (heapCost[p] <= c) break;
      heapIdx[k] = heapIdx[p]; heapCost[k] = heapCost[p];
      k = p;
    }
    heapIdx[k] = i; heapCost[k] = c;
  };
  f[goalIdx] = 0;
  push(goalIdx, 0);
  while (size > 0) {
    const ci = heapIdx[0], cc = heapCost[0];
    // Retire la racine : le dernier élément redescend à sa place
    const li = heapIdx[--size], lc = heapCost[size];
    let k = 0;
    for (;;) {
      const l = 2 * k + 1;
      if (l >= size) break;
      const m = l + 1 < size && heapCost[l + 1] < heapCost[l] ? l + 1 : l;
      if (heapCost[m] >= lc) break;
      heapIdx[k] = heapIdx[m]; heapCost[k] = heapCost[m];
      k = m;
    }
    heapIdx[k] = li; heapCost[k] = lc;
    if (cc > f[ci]) continue;
    const cx = ci % PATH_N, cy = (ci / PATH_N) | 0;
    for (const [ox, oy, cost] of NB8) {
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= PATH_N || ny >= PATH_N) continue;
      const ni = ny * PATH_N + nx;
      if (pathBlocked[ni]) continue;
      if (ox && oy && (pathBlocked[cy * PATH_N + nx] || pathBlocked[ny * PATH_N + cx])) continue;
      const nc = cc + cost;
      if (nc < f[ni]) { f[ni] = nc; push(ni, nc); }
    }
  }
  flowCache.set(goalIdx, f);
  if (flowCache.size > FLOW_CACHE_MAX) flowCache.delete(flowCache.keys().next().value);
  return f;
}

// Renvoie un point de passage intermédiaire si la ligne droite vers l'objectif est bloquée (relief ou bâtiments).
// (fx, fy) : objectif commun de l'ordre (le point cliqué), qui sert de cible au champ de flux ; ainsi toutes
// les unités d'un même ordre partagent un seul calcul au lieu d'un par place de formation.
function routeWaypoint(u, gx, gy, fx = gx, fy = gy, now = 0) {
  if (!terrainActive || pathSegmentClear(u.x, u.y, gx, gy)) { u.wp = null; return null; }
  const goalIdx = nearestFreeCell(pathCellOf(fx, fy));
  // Point de passage encore frais et toujours visible : inutile de recalculer
  if (u.wp && u.wpGoal === goalIdx && now - u.wpT < WAYPOINT_TTL && now >= u.wpT) return u.wp;
  const f = getFlowField(goalIdx);
  if (!f) return u.wp && u.wpGoal === goalIdx ? u.wp : null;
  let cur = pathCellOf(u.x, u.y);
  // Unité sur une cellule bloquée (collée à un bâtiment, au bord d'une falaise) : on part de la cellule libre la plus proche
  if (!Number.isFinite(f[cur])) cur = nearestFreeCell(cur);
  let best = null, last = null;
  for (let step = 0; step < 14; step++) {
    const cx = cur % PATH_N, cy = (cur / PATH_N) | 0;
    let nb = -1, nv = f[cur];
    for (const [ox, oy] of NB8) {
      const nx = cx + ox, ny = cy + oy;
      if (nx < 0 || ny < 0 || nx >= PATH_N || ny >= PATH_N) continue;
      const ni = ny * PATH_N + nx;
      if (f[ni] < nv) { nv = f[ni]; nb = ni; }
    }
    if (nb < 0) break;
    cur = nb;
    const px = ((cur % PATH_N) + 0.5) * PATH_CELL, py = (((cur / PATH_N) | 0) + 0.5) * PATH_CELL;
    last = { x: px, y: py };
    if (pathSegmentClear(u.x, u.y, px, py, 0)) best = last;
    else if (best) break;
  }
  u.wp = best || last;
  u.wpGoal = goalIdx;
  u.wpT = now;
  return u.wp;
}

/* ---------- Décor : arbres / cheminées / cristaux ---------- */
function scatterDecor(mapId, F) {
  TREES_3D.length = 0;
  const rnd = mulberry({ vallee: 20261019, magma: 20261021, glace: 20261022, desert: 20261023, ruines: 20261024 }[mapId] || 20261019);
  const W = WORLD_SIZE;
  const look = (MAP_DEFS[mapId] || MAP_DEFS.vallee).look;
  const count = Math.round(look.decorCount * (W / BASE_WORLD) ** 2);
  const roadNear = (x, y) => F.roads.some((r) => segDist(x, y, r[0], r[1], r[2], r[3]) < r[4] + 34);
  const resNear = (x, y) => MINERAL_NODES.some((m) => hypot(x, y, m.x, m.y) < 95) || GAS_GEYSERS.some((g) => hypot(x, y, g.x, g.y) < 110);
  const expoNear = (x, y) => F.expos.some((e) => hypot(x, y, e.x, e.y) < 190);
  let tries = 0;
  while (TREES_3D.length < count && tries < count * 12) {
    tries++;
    const tx = 50 + rnd() * (W - 100), ty = 50 + rnd() * (W - 100);
    const t = terTypeAt(tx, ty);
    if (t !== T_LOW) continue;
    if (isAreaBlocked(tx, ty, 30)) continue;
    if (F.plateaus.some((p) => hypot(tx, ty, p.x, p.y) < p.r + CLIFF_W + RAMP_LEN + 40)) continue;
    if (roadNear(tx, ty) || resNear(tx, ty) || expoNear(tx, ty)) continue;
    // Les arbres poussent surtout au pied des montagnes et le long de l'eau
    const hNear = heightAt(tx, ty);
    if (hNear < 6 && rnd() < 0.55) continue;
    const type = look.decor;
    const pal = type === 'volcano' ? ['#2a1e20', '#362426', '#1e1618', '#422b28']
      : type === 'crystal' ? ['#1fc7c1', '#5cd5eb', '#89e5f5', '#38bdf8', '#a5f3fc']
        : type === 'cactus' ? ['#3f7d3a', '#4f8f45', '#5d9b4f', '#356b31']
          : type === 'pillar' ? ['#ff3df2', '#3df2ff', '#ffd23d', '#7cff4f']
        : ['#2d6632', '#39783c', '#245429', '#468a44', '#2f5f2a'];
    TREES_3D.push({ x: tx, y: ty, r: 15 + rnd() * 12, col: pal[(rnd() * pal.length) | 0], h: 32 + rnd() * 26, type });
  }
}


function initMap(mapId = 'vallee', layout = 'ffa') {
  if (!MAP_DEFS[mapId]) mapId = 'vallee';
  layout = layout === '2v2' || layout === '1v1' ? layout : 'ffa';
  activeMapId = mapId;
  activeLayout = layout;
  setWorldSize(layout === '2v2' ? Math.round(BASE_WORLD * 1.4) : layout === '1v1' ? 3000 : BASE_WORLD);
  const F = buildLayout(mapId, layout);
  MAP_FEATURES = F;
  placeResources(mapId, F);
  rasterizeTerrain(mapId, F);
  buildPathGrid();
  scatterDecor(mapId, F);
  if (typeof buildFogHigh === 'function') buildFogHigh();
  // L'interface (texture du sol, décor 3D, badge) se met à jour si elle est chargée
  if (typeof onMapInitView === 'function') onMapInitView(mapId);
}
