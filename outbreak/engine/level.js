// Génération des salles : déterministe à partir de { mode, index, type, seed } (hôte et invités obtiennent la même salle).
import { makeRng } from './rng.js';
import { ROOM_TYPES } from './data.js';

export const WALL_TOP = 72;   // mur du haut épais (on voit sa face avant)
export const WALL_SIDE = 40;
export const WALL_BOTTOM = 44;
export const DOOR_W = 132;
export const CELL = 32;

const SIZES = {
  start: [1500, 1050], armory: [1900, 1250], medbay: [1800, 1250], lab: [2000, 1300], storage: [1950, 1300],
  core: [2100, 1550], arena: [2300, 1650], base: [2400, 1800], shop: [1500, 1050], vault: [1800, 1300], dark: [1900, 1300], gas: [1950, 1300],
};

export const SECTOR_IDS = ['lab', 'sewers', 'hospital', 'metro', 'nice'];

export function generateRoom({ mode = 'campaign', index = 1, type = 'start', seed = 1, exits = [], sector = 'lab' }) {
  if (!SECTOR_IDS.includes(sector)) sector = 'lab';
  for (let attempt = 0; attempt < 12; attempt++) {
    const lv = build({ mode, index, type, seed: seed + attempt * 7919, exits, sector }, attempt >= 10);
    if (lv) { lv.seed = seed; return lv; }
  }
  return build({ mode, index, type, seed, exits, sector }, true);
}

function build({ mode, index, type, seed, exits, sector }, bare) {
  const rng = makeRng(seed);
  const def = ROOM_TYPES[type] || ROOM_TYPES.start;
  let [w, h] = SIZES[type] || SIZES.storage;
  // un peu de variété de taille d'une partie à l'autre
  if (type !== 'core' && type !== 'arena' && type !== 'base') { w += rng.int(-2, 2) * 50; h += rng.int(-1, 1) * 50; }
  const lv = {
    mode, index, type, theme: sector === 'lab' || type === 'shop' || type === 'vault' ? def.theme : sector, name: def.name, w, h, seed,
    sector, tint: type === 'gas' ? 'gas' : type === 'dark' ? 'dark' : null, zones: [],
    solids: [], doors: [], vents: [], barrels: [], crates: [], lamps: [], props: [],
    inner: { x0: WALL_SIDE, y0: WALL_TOP, x1: w - WALL_SIDE, y1: h - WALL_BOTTOM },
  };
  const I = lv.inner, cx = w / 2;
  let nid = 1;

  // ---- portes : sortie(s) en haut, entrée en bas
  const exitList = mode === 'campaign' ? exits : [];
  const exitXs = exitList.length === 2 ? [w * 0.3, w * 0.7] : exitList.length === 1 ? [cx] : [];
  exitList.forEach((to, k) => {
    const x = exitXs[k] - DOOR_W / 2;
    lv.doors.push({ id: 'd' + k, kind: 'exit', to, x, y: 0, w: DOOR_W, h: WALL_TOP, side: 'top', open: false });
  });
  lv.doors.push({ id: 'in', kind: 'entry', to: null, x: cx - DOOR_W / 2, y: h - WALL_BOTTOM, w: DOOR_W, h: WALL_BOTTOM, side: 'bottom', open: false });

  // ---- murs (avec ouvertures pour les portes ; une porte fermée est ajoutée comme solide par la simulation)
  const topGaps = lv.doors.filter((d) => d.side === 'top').map((d) => [d.x, d.x + d.w]).sort((a, b) => a[0] - b[0]);
  let x = 0;
  for (const [a, b] of topGaps) { lv.solids.push(wall(x, 0, a - x, WALL_TOP)); x = b; }
  lv.solids.push(wall(x, 0, w - x, WALL_TOP));
  const ent = lv.doors.find((d) => d.kind === 'entry');
  lv.solids.push(wall(0, h - WALL_BOTTOM, ent.x, WALL_BOTTOM), wall(ent.x + ent.w, h - WALL_BOTTOM, w - ent.x - ent.w, WALL_BOTTOM));
  lv.solids.push(wall(0, 0, WALL_SIDE, h), wall(w - WALL_SIDE, 0, WALL_SIDE, h));

  lv.spawn = { x: cx, y: I.y1 - 90 };

  // ---- zones à garder libres
  const keepOut = [
    { x: cx - 210, y: I.y1 - 230, w: 420, h: 230 },               // entrée
    ...lv.doors.filter((d) => d.side === 'top').map((d) => ({ x: d.x - 70, y: I.y0, w: d.w + 140, h: 170 })),
  ];

  // ---- bouches d'aération (apparition des zombies)
  const vents = [];
  const vy = [0.22, 0.5, 0.78];
  for (const f of vy) {
    vents.push({ x: I.x0, y: I.y0 + (I.y1 - I.y0) * f, nx: 1, ny: 0, side: 'left' });
    vents.push({ x: I.x1, y: I.y0 + (I.y1 - I.y0) * f, nx: -1, ny: 0, side: 'right' });
  }
  const topSlots = [0.12, 0.5, 0.88].map((f) => I.x0 + (I.x1 - I.x0) * f)
    .filter((vx) => !lv.doors.some((d) => d.side === 'top' && vx > d.x - 90 && vx < d.x + d.w + 90))
    .filter((vx) => !(type === 'vault' && Math.abs(vx - cx) < 260));
  for (const vx of topSlots) vents.push({ x: vx, y: I.y0, nx: 0, ny: 1, side: 'top' });
  if (type === 'arena' || type === 'core' || type === 'base') {
    vents.push({ x: I.x0 + 160, y: I.y1, nx: 0, ny: -1, side: 'bottom' }, { x: I.x1 - 160, y: I.y1, nx: 0, ny: -1, side: 'bottom' });
  }
  lv.vents = vents.map((v, k) => ({ ...v, id: k, sx: v.x + v.nx * 34, sy: v.y + v.ny * 34 }));
  for (const v of lv.vents) keepOut.push({ x: v.sx - 60, y: v.sy - 60, w: 120, h: 120 });

  // ---- mode Défense : un fort au centre, quatre brèches à barricader, un générateur, des emplacements de pièges
  if (type === 'base') {
    const fx = cx, fy = (I.y0 + I.y1) / 2 + 20, half = 270, th = 30, gap = 130;
    const seg = (x, y, w2, h2) => lv.solids.push({ x, y, w: w2, h: h2, kind: 'fortwall', id: 'f' + x + '_' + y });
    const L = fx - half, Rr = fx + half, T = fy - half, B = fy + half, g2 = gap / 2;
    seg(L, T, half - g2, th); seg(fx + g2, T, half - g2, th);            // haut
    seg(L, B - th, half - g2, th); seg(fx + g2, B - th, half - g2, th);  // bas
    seg(L, T + th, th, half - g2 - th); seg(L, fy + g2, th, half - g2 - th); // gauche
    seg(Rr - th, T + th, th, half - g2 - th); seg(Rr - th, fy + g2, th, half - g2 - th); // droite
    lv.solids.push({ x: fx - 40, y: fy - 40, w: 80, h: 80, kind: 'generator', id: 'gen' });
    lv.base = {
      gen: { x: fx, y: fy, r: 48 },
      fort: { x: L, y: T, w: half * 2, h: half * 2 },
      bars: [
        { id: 'bN', x: fx - g2, y: T, w: gap, h: th }, { id: 'bS', x: fx - g2, y: B - th, w: gap, h: th },
        { id: 'bW', x: L, y: fy - g2, w: th, h: gap }, { id: 'bE', x: Rr - th, y: fy - g2, w: th, h: gap },
      ],
      pads: [],
    };
    // emplacements de pièges : devant chaque brèche (dehors) et sur un anneau autour du fort
    const ring = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    let pid = 0;
    for (const [dx, dy] of ring) {
      for (const k of [-1, 1]) {
        const ox = dx ? dx * (half + 120) : k * 120, oy = dy ? dy * (half + 120) : k * 120;
        lv.base.pads.push({ id: 'p' + pid++, x: fx + ox, y: fy + oy });
      }
    }
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lv.base.pads.push({ id: 'p' + pid++, x: fx + dx * (half + 150), y: fy + dy * (half + 130) });
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) lv.base.pads.push({ id: 'p' + pid++, x: fx + dx * 140, y: fy + dy * 140 });
    lv.spawn = { x: fx, y: fy + 140 };
    keepOut.push({ x: L - 220, y: T - 220, w: half * 2 + 440, h: half * 2 + 440 });
  }

  // ---- zones au sol propres au secteur (eau des égouts, voies du métro)
  const special = type === 'shop' || type === 'vault' || type === 'core' || type === 'base';
  if (!special) {
    const Hh = I.y1 - I.y0;
    if (sector === 'metro') {
      const ty = Math.round(I.y0 + Hh * 0.42);
      lv.zones.push({ k: 'track', x: I.x0, y: ty, w: I.x1 - I.x0, h: 96 });
    } else if (sector === 'sewers') {
      for (const f of [0.3, 0.64]) {
        const y = Math.round(I.y0 + Hh * f), gap = 130, gx = I.x0 + (I.x1 - I.x0) * rng.range(0.25, 0.4);
        lv.zones.push({ k: 'water', x: I.x0, y, w: gx - I.x0, h: 74 }, { k: 'water', x: gx + gap, y, w: I.x1 - gx - gap, h: 74 });
        lv.props.push({ k: 'bridge', x: gx, y, w: gap, h: 74 });
      }
    }
  }
  for (const z of lv.zones) keepOut.push({ x: z.x, y: z.y - 20, w: z.w, h: z.h + 40 });

  // ---- obstacles selon le thème (symétriques gauche/droite)
  if (!bare) {
    const add = (o, mirror = true) => {
      const list = [o];
      if (mirror) { const m = { ...o, x: w - o.x - o.w }; if (Math.abs(m.x - o.x) > 4) list.push(m); }
      for (const p of list) {
        if (p.x < I.x0 + 8 || p.y < I.y0 + 8 || p.x + p.w > I.x1 - 8 || p.y + p.h > I.y1 - 8) return;
        if (keepOut.some((k) => overlap(p, k, 0))) return;
        if (lv.solids.some((s) => s.kind !== 'wall' && overlap(p, s, 56))) return;
      }
      for (const p of list) lv.solids.push({ ...p, id: 'o' + nid++ });
    };
    if (type === 'base') sectorLayout(sector === 'lab' ? 'lab-base' : sector, 'base', lv, rng, add);
    else if (sector !== 'lab' && !special) sectorLayout(sector, type, lv, rng, add);
    else layout(type, lv, rng, add);
  }

  // ---- barils et caisses de ravitaillement
  const freeSpot = (r) => {
    for (let k = 0; k < 40; k++) {
      const p = { x: rng.range(I.x0 + 80, I.x1 - 80), y: rng.range(I.y0 + 120, I.y1 - 160) };
      const box = { x: p.x - r, y: p.y - r, w: r * 2, h: r * 2 };
      if (keepOut.some((k2) => overlap(box, k2, 0))) continue;
      if (lv.solids.some((s) => overlap(box, s, 40))) continue;
      if (lv.barrels.some((b) => Math.hypot(b.x - p.x, b.y - p.y) < 90)) continue;
      if (lv.crates.some((c) => Math.hypot(c.x + c.w / 2 - p.x, c.y + c.h / 2 - p.y) < 110)) continue;
      return p;
    }
    return null;
  };
  if (!bare) {
    const nb = type === 'start' ? 2 : rng.int(3, 6) - (sector === 'nice' ? 2 : 0);
    for (let k = 0; k < nb; k++) {
      const p = freeSpot(20); if (!p) continue;
      lv.barrels.push({ id: 'b' + k, x: p.x, y: p.y, r: 17, kind: rng.chance(type === 'lab' ? 0.55 : 0.3) ? 'toxic' : 'red' });
    }
    const nc = type === 'storage' ? rng.int(4, 6) : type === 'start' ? 1 : rng.int(1, 3);
    for (let k = 0; k < nc; k++) {
      const p = freeSpot(24); if (!p) continue;
      lv.crates.push({ id: 'c' + k, x: p.x - 22, y: p.y - 22, w: 44, h: 44 });
    }
  }

  // ---- lampes (décor + éclairage)
  const nl = Math.max(3, Math.round(w / 420));
  for (let k = 0; k < nl; k++) {
    const lx = I.x0 + ((k + 0.5) / nl) * (I.x1 - I.x0);
    if (lv.doors.some((d) => d.side === 'top' && lx > d.x - 30 && lx < d.x + d.w + 30)) continue;
    lv.lamps.push({ x: lx, y: WALL_TOP - 14, wall: true });
  }

  // ---- grille de navigation + vérification que tout est accessible
  buildGrid(lv);
  if (!bare) {
    const reach = flood(lv, lv.spawn.x, lv.spawn.y);
    const ok = (px, py) => reach[cellIndex(lv, px, py)] === 1;
    for (const v of lv.vents) if (!ok(v.sx, v.sy)) return null;
    for (const d of lv.doors) if (d.kind === 'exit' && !ok(d.x + d.w / 2, WALL_TOP + 40)) return null;
    for (const c of lv.crates) if (!ok(c.x + c.w / 2, c.y - 30) && !ok(c.x + c.w / 2, c.y + c.h + 30)) return null;
    // aucune poche fermée : toute case libre doit être atteignable
    for (let i = 0; i < lv.grid.blocked.length; i++) if (!lv.grid.blocked[i] && !reach[i]) lv.grid.blocked[i] = 1;
  }
  return lv;
}

function wall(x, y, w, h) { return { x, y, w, h, kind: 'wall', id: 'w' + x + '_' + y }; }
function overlap(a, b, pad) {
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
}

// Dispositions propres à chaque secteur (les salles spéciales gardent la leur)
function sectorLayout(sector, type, lv, rng, add) {
  const I = lv.inner, W = I.x1 - I.x0, H = I.y1 - I.y0;
  const X = (f) => I.x0 + W * f, Y = (f) => I.y0 + H * f;
  switch (sector) {
    case 'lab-base':
      add({ x: X(0.08), y: Y(0.12), w: 70, h: 70, kind: 'pillar' });
      add({ x: X(0.08), y: Y(0.78), w: 70, h: 70, kind: 'pillar' });
      add({ x: X(0.12), y: Y(0.45), w: 140, h: 40, kind: 'barrier', low: true });
      break;
    case 'nice': {
      // une rue : voitures garées, palmiers, terrasses, bancs de la Promenade
      const cars = rng.int(2, 3);
      for (let k = 0; k < cars; k++) {
        const vert = rng.chance(0.4);
        add({ x: X(rng.range(0.07, 0.38)), y: Y(rng.range(0.14, 0.62)), w: vert ? 58 : 116, h: vert ? 116 : 58, kind: 'car', hue: rng.int(0, 5), vert });
      }
      for (let k = 0; k < 3; k++) add({ x: X(rng.range(0.06, 0.42)), y: Y(rng.range(0.1, 0.7)), w: 34, h: 34, kind: 'palm' });
      add({ x: X(rng.range(0.15, 0.35)), y: Y(rng.range(0.3, 0.6)), w: 64, h: 64, kind: 'terrace', low: true });
      add({ x: X(0.12), y: Y(0.82), w: 110, h: 30, kind: 'pbench', low: true });
      if (rng.chance(0.5)) add({ x: X(0.5) - 45, y: Y(0.3), w: 90, h: 70, kind: 'kiosk' }, false);
      break;
    }
    case 'hospital': {
      const rows = rng.int(2, 3);
      for (let r = 0; r < rows; r++) {
        const y = Y(0.16 + r * (0.6 / rows));
        add({ x: X(0.08), y, w: 64, h: 110, kind: 'hbed', low: true });
        add({ x: X(0.2), y, w: 64, h: 110, kind: 'hbed', low: true });
        add({ x: X(0.32), y: y + 20, w: 12, h: 120, kind: 'curtain' });
      }
      add({ x: X(0.4), y: Y(0.7), w: 50, h: 90, kind: 'gurney', low: true });
      add({ x: X(0.5) - 80, y: Y(0.12), w: 160, h: 46, kind: 'desk', low: true }, false);
      break;
    }
    case 'metro': {
      // quais de part et d'autre des voies : piliers carrelés et bancs
      const tz = lv.zones.find((z) => z.k === 'track') || { y: Y(0.12) + 150, h: Y(0.55) - Y(0.12) };
      for (const f of [0.12, 0.3]) {
        add({ x: X(f), y: tz.y - 150, w: 54, h: 54, kind: 'mpillar' });
        add({ x: X(f), y: tz.y + tz.h + 96, w: 54, h: 54, kind: 'mpillar' });
      }
      add({ x: X(0.2), y: tz.y - 64, w: 120, h: 28, kind: 'pbench', low: true });
      add({ x: X(0.4), y: tz.y + tz.h + 200, w: 60, h: 40, kind: 'ticket' });
      break;
    }
    case 'sewers': {
      add({ x: X(0.1), y: Y(0.12), w: 200, h: 34, kind: 'pipe', low: true });
      add({ x: X(0.16), y: Y(0.47), w: 60, h: 60, kind: 'brick' });
      add({ x: X(0.36), y: Y(0.82), w: 54, h: 54, kind: 'brick' });
      add({ x: X(0.3), y: Y(0.47), w: 140, h: 34, kind: 'pipe', low: true });
      break;
    }
  }
}

// Dispositions d'obstacles. kind sert au dessin ; low = on tire par-dessus.
function layout(type, lv, rng, add) {
  const I = lv.inner, W = I.x1 - I.x0, H = I.y1 - I.y0;
  const X = (f) => I.x0 + W * f, Y = (f) => I.y0 + H * f;
  switch (type) {
    case 'start':
      add({ x: X(0.18), y: Y(0.42), w: 140, h: 40, kind: 'barrier', low: true });
      add({ x: X(0.33), y: Y(0.2), w: 56, h: 56, kind: 'pillar' });
      add({ x: X(0.12), y: Y(0.72), w: 70, h: 70, kind: 'locker' });
      break;
    case 'lab': {
      const rows = rng.int(2, 3);
      for (let r = 0; r < rows; r++) {
        const y = Y(0.22 + r * (0.55 / rows));
        add({ x: X(rng.range(0.1, 0.17)), y, w: rng.int(4, 6) * 40, h: 56, kind: 'bench', low: true });
        if (rng.chance(0.6)) add({ x: X(0.4), y: y + rng.int(-1, 1) * 30, w: 60, h: 60, kind: 'tank' });
      }
      add({ x: I.x0 + 10, y: Y(0.55), w: 58, h: 130, kind: 'cabinet' });
      break;
    }
    case 'armory':
      for (let k = 0; k < 3; k++) add({ x: X(0.14 + k * 0.11), y: Y(0.22 + (k % 2) * 0.08), w: 44, h: 170, kind: 'rack' });
      add({ x: X(0.2), y: Y(0.7), w: 150, h: 40, kind: 'sandbags', low: true });
      add({ x: X(0.4), y: Y(0.48), w: 80, h: 80, kind: 'ammo' });
      break;
    case 'medbay':
      for (let k = 0; k < 3; k++) add({ x: X(0.08 + k * 0.12), y: Y(0.18), w: 70, h: 120, kind: 'bed', low: true });
      for (let k = 0; k < 2; k++) add({ x: X(0.14 + k * 0.14), y: Y(0.62), w: 70, h: 120, kind: 'bed', low: true });
      add({ x: X(0.42), y: Y(0.4), w: 60, h: 60, kind: 'pillar' });
      break;
    case 'storage': {
      const n = rng.int(4, 6);
      for (let k = 0; k < n; k++) {
        const big = rng.chance(0.5);
        add({ x: X(rng.range(0.08, 0.42)), y: Y(rng.range(0.12, 0.7)), w: big ? 110 : 80, h: big ? 80 : 80, kind: 'stack' });
      }
      add({ x: X(0.25), y: Y(0.5), w: 160, h: 50, kind: 'pallet', low: true });
      break;
    }
    case 'shop':
      add({ x: X(0.5) - 260, y: Y(0.2), w: 520, h: 50, kind: 'stall', low: true }, false);
      add({ x: X(0.14), y: Y(0.55), w: 90, h: 70, kind: 'stack' });
      break;
    case 'vault':
      add({ x: X(0.5) - 110, y: I.y0 + 8, w: 220, h: 120, kind: 'vault' }, false);
      add({ x: X(0.16), y: Y(0.3), w: 44, h: 170, kind: 'rack' });
      add({ x: X(0.22), y: Y(0.72), w: 150, h: 40, kind: 'sandbags', low: true });
      break;
    case 'dark':
      for (let k = 0; k < 2; k++) add({ x: X(0.15 + k * 0.17), y: Y(0.25 + k * 0.3), w: 60, h: 60, kind: 'pillar' });
      add({ x: X(0.3), y: Y(0.62), w: 80, h: 80, kind: 'stack' });
      break;
    case 'gas':
      add({ x: X(0.12), y: Y(0.35), w: 220, h: 34, kind: 'pipe', low: true });
      add({ x: X(0.32), y: Y(0.6), w: 60, h: 60, kind: 'tank' });
      add({ x: X(0.18), y: Y(0.72), w: 70, h: 70, kind: 'locker' });
      break;
    case 'core':
      add({ x: X(0.5) - 90, y: Y(0.42) - 90, w: 180, h: 180, kind: 'reactor', low: true }, false);
      add({ x: X(0.2), y: Y(0.22), w: 70, h: 70, kind: 'pillar' });
      add({ x: X(0.2), y: Y(0.68), w: 70, h: 70, kind: 'pillar' });
      break;
    case 'arena':
      add({ x: X(0.5) - 110, y: Y(0.45) - 40, w: 220, h: 80, kind: 'barrier', low: true }, false);
      add({ x: X(0.18), y: Y(0.25), w: 70, h: 70, kind: 'pillar' });
      add({ x: X(0.2), y: Y(0.68), w: 150, h: 44, kind: 'sandbags', low: true });
      add({ x: X(0.36), y: Y(0.2), w: 100, h: 80, kind: 'stack' });
      break;
  }
  if (lv.lamps) { /* lampes posées après */ }
}

// ------------------------------------------------------------------ grille et champs de distance
export function buildGrid(lv) {
  const cols = Math.ceil(lv.w / CELL), rows = Math.ceil(lv.h / CELL);
  const blocked = new Uint8Array(cols * rows);
  const pad = 15;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = (c + 0.5) * CELL, py = (r + 0.5) * CELL;
    if (px < lv.inner.x0 + 8 || px > lv.inner.x1 - 8 || py < lv.inner.y0 + 8 || py > lv.inner.y1 - 8) { blocked[r * cols + c] = 1; continue; }
    for (const s of lv.solids) {
      if (px > s.x - pad && px < s.x + s.w + pad && py > s.y - pad && py < s.y + s.h + pad) { blocked[r * cols + c] = 1; break; }
    }
  }
  lv.grid = { cols, rows, blocked, base: blocked.slice() };
}

export function cellIndex(lv, x, y) {
  const c = Math.max(0, Math.min(lv.grid.cols - 1, Math.floor(x / CELL)));
  const r = Math.max(0, Math.min(lv.grid.rows - 1, Math.floor(y / CELL)));
  return r * lv.grid.cols + c;
}

function flood(lv, x, y) {
  const { cols, rows, blocked } = lv.grid;
  const seen = new Uint8Array(cols * rows);
  const q = [cellIndex(lv, x, y)]; seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), c = i % cols, r = (i / cols) | 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc, nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (!seen[j] && !blocked[j]) { seen[j] = 1; q.push(j); }
    }
  }
  return seen;
}

// Champ de distance multi-sources (Dijkstra simplifié 8 directions). Renvoie Float32Array (Infinity = inaccessible).
const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
export function distanceField(lv, sources) {
  const { cols, rows, blocked } = lv.grid;
  const n = cols * rows;
  const dist = new Float32Array(n).fill(Infinity);
  // file à seaux (coûts proches de l'entier) : précision suffisante pour se guider
  let frontier = [];
  for (const s of sources) {
    const i = cellIndex(lv, s.x, s.y);
    if (dist[i] > 0) { dist[i] = 0; frontier.push(i); }
  }
  // relaxation par vagues successives
  let iter = 0;
  while (frontier.length && iter++ < 400) {
    const next = [];
    for (const i of frontier) {
      const c = i % cols, r = (i / cols) | 0, d0 = dist[i];
      for (const [dc, dr, cost] of DIRS) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
        const j = nr * cols + nc;
        if (blocked[j]) continue;
        if (dc && dr && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue; // pas de coupe de coin
        const nd = d0 + cost;
        if (nd < dist[j] - 0.01) { dist[j] = nd; next.push(j); }
      }
    }
    frontier = next;
  }
  return dist;
}

// Direction à suivre depuis (x,y) dans un champ de distance : {x,y} unitaire ou null
export function flowDir(lv, field, x, y) {
  const { cols, rows, blocked } = lv.grid;
  const i = cellIndex(lv, x, y), c = i % cols, r = (i / cols) | 0;
  let best = field[i], bx = 0, by = 0;
  for (const [dc, dr] of DIRS) {
    const nc = c + dc, nr = r + dr;
    if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
    const j = nr * cols + nc;
    if (blocked[j]) continue;
    if (dc && dr && (blocked[r * cols + nc] || blocked[nr * cols + c])) continue;
    if (field[j] < best) { best = field[j]; bx = dc; by = dr; }
  }
  if (!bx && !by) {
    if (!isFinite(field[i])) return null;
    return null;
  }
  // viser le centre de la case suivante (évite de raser les coins)
  const tx = (c + bx + 0.5) * CELL, ty = (r + by + 0.5) * CELL;
  const dx = tx - x, dy = ty - y, d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}
