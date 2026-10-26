// Les bâtiments : tous posés sur la grille de construction (cases de 4 m, comme les murs des joueurs), alignés sur
// les axes. Un bâtiment = des étages ; chaque étage = des pans sur les bords des cases (mur, fenêtre, porte, portail,
// trou d'un mur cassé), un escalier (une rampe sur une case, empilée d'étage en étage) et des pièces.
// Coordonnées des pans (en cases) : 'h' en (x, z) va de (x, z) à (x + 1, z) ; 'v' en (x, z) va de (x, z) à (x, z + 1).
// Les mêmes pans serviront à la 3D, aux collisions et à la destruction (chaque pan aura ses points de vie).

export const CELL = 4;      // côté d'une case de construction (m)
export const STOREY = 3.2;  // hauteur d'un étage (m)

// rooms : surface (en cases) à partir de laquelle on recoupe en pièces (99 = une seule salle)
export const BTYPES = {
  maison:     { label: 'Maison', mat: 'pierre', roof: 'pente', floors: [1, 2], rooms: 5, win: 0.45, chests: [0, 1] },
  immeuble:   { label: 'Immeuble', mat: 'pierre', roof: 'plat', floors: [3, 4], rooms: 7, win: 0.55, chests: [1, 2], roofAccess: true },
  tour:       { label: 'Tour', mat: 'pierre', roof: 'plat', floors: [5, 5], rooms: 7, win: 0.6, chests: [2, 3], roofAccess: true },
  boutique:   { label: 'Boutique', mat: 'pierre', roof: 'plat', floors: [1, 1], rooms: 99, win: 0.35, vitrine: true, chests: [0, 1] },
  garage:     { label: 'Garage', mat: 'metal', roof: 'plat', floors: [1, 1], rooms: 99, win: 0.2, portail: true, chests: [0, 1] },
  mairie:     { label: 'Mairie', mat: 'pierre', roof: 'pente', floors: [2, 2], rooms: 6, win: 0.6, chests: [1, 2] },
  auberge:    { label: 'Auberge', mat: 'bois', roof: 'pente', floors: [2, 2], rooms: 5, win: 0.5, chests: [1, 2] },
  grange:     { label: 'Grange', mat: 'bois', roof: 'pente', floors: [2, 2], rooms: 99, win: 0.15, portail: true, chests: [1, 2] },
  hangar:     { label: 'Hangar', mat: 'metal', roof: 'plat', floors: [1, 1], rooms: 99, win: 0.2, portail: true, tall: true, chests: [1, 2] },
  bureaux:    { label: 'Bureaux', mat: 'pierre', roof: 'plat', floors: [2, 3], rooms: 6, win: 0.6, chests: [1, 2], roofAccess: true },
  cabane:     { label: 'Cabane', mat: 'bois', roof: 'pente', floors: [1, 1], rooms: 99, win: 0.35, chests: [0, 1] },
  chalet:     { label: 'Chalet', mat: 'bois', roof: 'pente', floors: [2, 2], rooms: 5, win: 0.5, chests: [1, 2] },
  phare:      { label: 'Phare', mat: 'pierre', roof: 'phare', floors: [5, 5], rooms: 99, win: 0.3, chests: [1, 1], topChest: true, roofAccess: true },
  station:    { label: 'Station-service', mat: 'pierre', roof: 'plat', floors: [1, 1], rooms: 8, win: 0.3, vitrine: true, chests: [1, 1] },
  guet:       { label: 'Tour de guet', mat: 'bois', roof: 'plat', floors: [3, 3], rooms: 99, win: 0.6, chests: [1, 1], topChest: true, roofAccess: true },
  abri:       { label: 'Abri', mat: 'metal', roof: 'plat', floors: [1, 1], rooms: 99, win: 0.1, chests: [0, 1] },
  manoir:     { label: 'Manoir', mat: 'pierre', roof: 'pente', floors: [3, 3], rooms: 6, win: 0.55, chests: [2, 3] },
  abandonnee: { label: 'Maison abandonnée', mat: 'bois', roof: 'pente', floors: [1, 2], rooms: 5, win: 0.4, chests: [1, 1], broken: 0.14 },
};

export const MATS = { bois: 'Bois', pierre: 'Pierre', metal: 'Métal' };
const DIRS = { N: [0, -1], S: [0, 1], W: [-1, 0], E: [1, 0] };

// spec : { type, x0, z0, w, d, front: 'N'|'S'|'E'|'W', floors?, mat? }
export function makeBuilding(rng, id, spec) {
  const T = BTYPES[spec.type];
  const { x0, z0, w, d } = spec;
  let floors = spec.floors || rng.int(T.floors[0], T.floors[1]);
  const b = {
    id, type: spec.type, label: T.label, x0, z0, w, d, floors, mat: spec.mat || T.mat, roof: T.roof, tall: !!T.tall,
    abandoned: !!T.broken, front: spec.front || 'S', y: 0, levels: [], chests: [], loot: [], ammo: [], stairs: null,
  };
  // escalier : une rampe d'une case, avec une case libre avant (palier bas) et après (palier haut)
  const wantStairs = floors > 1 || T.roofAccess;
  if (wantStairs) {
    b.stairs = pickStairs(rng, b);
    if (!b.stairs) floors = b.floors = 1;
  }
  const st = b.stairs;
  for (let k = 0; k < floors; k++) {
    const walls = [], rooms = [];
    perimeter(rng, b, T, k, walls);
    if (w * d >= T.rooms) splitRooms(rng, { x: x0, z: z0, w, d }, T.rooms, st, walls, rooms, 0);
    else rooms.push({ x: x0, z: z0, w, d });
    const lv = { k, walls, rooms, stairs: null, hole: null };
    if (st && (k < floors - 1 || T.roofAccess)) lv.stairs = { ...st };
    if (st && k > 0) lv.hole = { x: st.x, z: st.z };
    b.levels.push(lv);
  }
  if (st && T.roofAccess) b.roofHatch = { x: st.x, z: st.z };
  furnish(rng, b, T);
  return b;
}

function pickStairs(rng, b) {
  const { x0, z0, w, d } = b, c = [];
  // le long d'un mur : rampe nord-sud contre les murs ouest/est, est-ouest contre les murs nord/sud
  if (d >= 3) for (const x of w > 1 ? [x0, x0 + w - 1] : [x0]) for (let z = z0 + 1; z <= z0 + d - 2; z++) c.push({ x, z, dx: 0, dz: rng.chance(0.5) ? 1 : -1 });
  if (w >= 3) for (const z of d > 1 ? [z0, z0 + d - 1] : [z0]) for (let x = x0 + 1; x <= x0 + w - 2; x++) c.push({ x, z, dx: rng.chance(0.5) ? 1 : -1, dz: 0 });
  return c.length ? rng.pick(c) : null;
}

// pans du pourtour d'un étage : porte(s) au rez-de-chaussée, fenêtres, portail des hangars, murs cassés
function perimeter(rng, b, T, k, walls) {
  const { x0, z0, w, d } = b;
  const sides = {
    N: { n: w, at: (t) => ({ x: x0 + t, z: z0, o: 'h' }) },
    S: { n: w, at: (t) => ({ x: x0 + t, z: z0 + d, o: 'h' }) },
    W: { n: d, at: (t) => ({ x: x0, z: z0 + t, o: 'v' }) },
    E: { n: d, at: (t) => ({ x: x0 + w, z: z0 + t, o: 'v' }) },
  };
  const opp = { N: 'S', S: 'N', E: 'W', W: 'E' };
  const doors = new Map();
  if (k === 0) {
    const f = sides[b.front], mid = (f.n - 1) / 2;
    if (T.portail && f.n >= 3) {
      // grand portail au milieu de la façade (deux pans pour les grands bâtiments)
      const a = Math.floor(mid);
      doors.set(b.front + a, 'portail');
      if (f.n >= 5) doors.set(b.front + (a + 1), 'portail');
    } else doors.set(b.front + Math.max(0, Math.min(f.n - 1, Math.round(mid + rng.range(-1, 1)))), 'porte');
    // porte de derrière ou de côté
    if (rng.chance(T.portail ? 0.7 : 0.45)) {
      const s = rng.chance(0.6) ? opp[b.front] : rng.pick(['N', 'S', 'E', 'W'].filter((q) => q !== b.front));
      doors.set(s + rng.int(0, sides[s].n - 1), 'porte');
    }
  }
  for (const s of ['N', 'S', 'W', 'E']) {
    const side = sides[s];
    for (let t = 0; t < side.n; t++) {
      const e = side.at(t);
      let kind = doors.get(s + t);
      if (!kind) {
        const pw = T.vitrine && k === 0 && s === b.front ? 0.9 : k === 0 ? T.win * 0.85 : T.win;
        kind = rng.chance(pw) ? 'fenetre' : 'mur';
        if (T.broken && rng.chance(T.broken)) kind = 'casse';
      }
      walls.push({ ...e, k: kind, ext: true });
    }
  }
}

// la rampe va de la case (x − dx, z − dz) à (x + dx, z + dz) : une coupe ne doit pas passer entre ces cases
function cutsStairs(axis, line, st, r) {
  if (!st) return false;
  if (axis === 'x') return st.dx !== 0 && st.z >= r.z && st.z < r.z + r.d && (line === st.x || line === st.x + 1);
  return st.dz !== 0 && st.x >= r.x && st.x < r.x + r.w && (line === st.z || line === st.z + 1);
}

// cloisons : coupes successives, une porte par cloison (toutes les pièces restent accessibles)
function splitRooms(rng, r, minArea, st, walls, rooms, depth) {
  const { x, z, w, d } = r;
  const can = [];
  if (w >= 3) can.push('x');
  if (d >= 3) can.push('z');
  if (depth > 3 || w * d < minArea || !can.length) { rooms.push(r); return; }
  let axis = w > d ? 'x' : d > w ? 'z' : rng.pick(can);
  if (!can.includes(axis)) axis = can[0];
  const len = axis === 'x' ? w : d, m = len >= 4 ? 2 : 1, cands = [];
  for (let p = m; p <= len - m; p++) if (!cutsStairs(axis, (axis === 'x' ? x : z) + p, st, r)) cands.push(p);
  if (!cands.length) { rooms.push(r); return; }
  const p = rng.pick(cands);
  if (axis === 'x') {
    const cx = x + p, door = z + rng.int(0, d - 1);
    for (let t = z; t < z + d; t++) walls.push({ x: cx, z: t, o: 'v', k: t === door ? 'porte' : 'mur', ext: false });
    splitRooms(rng, { x, z, w: p, d }, minArea, st, walls, rooms, depth + 1);
    splitRooms(rng, { x: cx, z, w: w - p, d }, minArea, st, walls, rooms, depth + 1);
  } else {
    const cz = z + p, door = x + rng.int(0, w - 1);
    for (let t = x; t < x + w; t++) walls.push({ x: t, z: cz, o: 'h', k: t === door ? 'porte' : 'mur', ext: false });
    splitRooms(rng, { x, z, w, d: p }, minArea, st, walls, rooms, depth + 1);
    splitRooms(rng, { x, z: cz, w, d: d - p }, minArea, st, walls, rooms, depth + 1);
  }
}

// coffres (contre un mur), butin au sol et caisses de munitions
function furnish(rng, b, T) {
  const { x0, z0, w, d, stairs: st } = b;
  const busy = new Set();
  if (st) for (const t of [-1, 0, 1]) busy.add((st.x + st.dx * t) + ',' + (st.z + st.dz * t));
  const cells = [];
  for (let k = 0; k < b.floors; k++) {
    const edges = new Map();
    for (const e of b.levels[k].walls) edges.set(e.o + e.x + ',' + e.z, e.k);
    for (let z = z0; z < z0 + d; z++) for (let x = x0; x < x0 + w; x++) {
      if (busy.has(x + ',' + z)) continue;
      // murs pleins autour de la case : N, S, O, E
      const sides = [];
      if (edges.get('h' + x + ',' + z) === 'mur') sides.push([0, -1]);
      if (edges.get('h' + x + ',' + (z + 1)) === 'mur') sides.push([0, 1]);
      if (edges.get('v' + x + ',' + z) === 'mur') sides.push([-1, 0]);
      if (edges.get('v' + (x + 1) + ',' + z) === 'mur') sides.push([1, 0]);
      cells.push({ x, z, k, sides });
    }
  }
  rng.shuffle(cells);
  const used = new Set();
  const place = (c, list, kind) => {
    const s = c.sides.length ? rng.pick(c.sides) : [0, 0];
    list.push({ x: (c.x + 0.5 + s[0] * 0.3) * CELL, z: (c.z + 0.5 + s[1] * 0.3) * CELL, k: c.k, fx: -s[0], fz: -s[1], kind });
    used.add(c.x + ',' + c.z + ',' + c.k);
  };
  let nChest = rng.int(T.chests[0], T.chests[1]) + (b.floors >= 3 && w * d >= 12 ? 1 : 0);
  if (T.topChest) {
    const top = cells.find((c) => c.k === b.floors - 1 && c.sides.length);
    if (top) { place(top, b.chests, 'coffre'); nChest--; }
  }
  for (const c of cells) {
    if (nChest <= 0) break;
    if (!c.sides.length || used.has(c.x + ',' + c.z + ',' + c.k)) continue;
    place(c, b.chests, 'coffre'); nChest--;
  }
  if (rng.chance(0.35)) {
    const c = cells.find((q) => q.sides.length && !used.has(q.x + ',' + q.z + ',' + q.k));
    if (c) place(c, b.ammo, 'munitions');
  }
  // butin au sol : environ une case sur six
  const nLoot = Math.max(1, Math.round((w * d * b.floors) / 6));
  let n = 0;
  for (const c of cells) {
    if (n >= nLoot) break;
    if (used.has(c.x + ',' + c.z + ',' + c.k)) continue;
    b.loot.push({ x: (c.x + rng.range(0.25, 0.75)) * CELL, z: (c.z + rng.range(0.25, 0.75)) * CELL, k: c.k });
    used.add(c.x + ',' + c.z + ',' + c.k); n++;
  }
}

export function sideVec(s) { return DIRS[s]; }
