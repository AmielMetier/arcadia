// The Backrooms (Level 17, le Mall) - Le gros œuvre d'un étage du centre commercial, à partir du plan (engine/mall.js) :
//  - les sols, découpés autour des vides d'atrium (des polygones : chaque case touchée est rognée exactement) et des
//    trémies d'escalier, revêtus selon la salle (sol poli à cabochons, damier, moquettes, lino, tomettes, béton) ;
//  - les plafonds, chacun à la hauteur de sa salle : caissons du mail et sa lanterne au-dessus du vide, coupole à deux
//    tambours de la cour centrale, caisson octogonal de la cour ouest, plafond noir de la place est percé d'une lanterne
//    ovale lumineuse, dalles de faux plafond des boutiques, béton des coulisses, noir du cinéma ; une retombée verticale
//    partout où deux plafonds voisins changent de hauteur ;
//  - les murs, une face par côté visible, à la hauteur du plafond de la salle qu'elle regarde ;
//  - autour des vides : le bandeau (l'épaisseur de la dalle, 2 m, vue d'en bas) et les garde-corps ;
//  - les piliers (crème à chapiteau et plinthe ; ronds du cinéma, bague d'acier et disque de plafond) ;
//  - les escaliers ouverts (deux volées et un palier) et les escalators à l'arrêt ;
//  - les devantures des boutiques (vitrines, rideaux à mailles, bandeau d'enseigne) et la grille du grand magasin fermé.
// Tout est cuit par la lumière de l'étage (baked) ; les lampes sont posées par fixtures(fixSet), comme les néons.
// Les textures (mallTextures.js) sont plaquées à l'échelle du monde : une face prend les deux axes du monde les plus
// proches de son plan, à S mètres par répétition (pas de couture d'une face à l'autre).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { CELL_SIZE as C, T, FLOOR_DY } from '../engine/map.js';
import { MALL_CEIL, MALL_RAIL } from '../engine/mall.js';
import { cinemaCarpet } from './mallTextures.js';

const SLAB = FLOOR_DY - MALL_CEIL; // l'épaisseur de la dalle sous le mail du haut (le bandeau des vides)
const LANTERN = 8.4; // la verrière du mail du haut, au-dessus du vide
const EXIT_H = MALL_CEIL; // la hauteur que dessine l'ascenseur (scene.js) : au-dessus, le mur reprend

// --- Géométrie : des triangles rangés par matière ---

// un polygone convexe (sens quelconque) coupé par le demi-plan a·p <= b
function clipHalf(poly, ax, az, b) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    const dp = ax * p[0] + az * p[1] - b;
    const dq = ax * q[0] + az * q[1] - b;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}
const areaOf = (poly) => {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    a += p[0] * q[1] - q[0] * p[1];
  }
  return a / 2;
};
const centroid = (pts) => {
  let x = 0;
  let z = 0;
  for (const p of pts) {
    x += p[0];
    z += p[1];
  }
  return [x / pts.length, z / pts.length];
};
// P (convexe) privé de Q (convexe) : des morceaux convexes. Pour chaque arête de Q, la part de ce qui reste qui est
// dehors ; ce qui reste à la fin est dedans
function convexMinus(P, Q) {
  const [cx, cz] = centroid(Q);
  const out = [];
  let rest = P;
  for (let i = 0; i < Q.length && rest.length >= 3; i++) {
    const a = Q[i];
    const b = Q[(i + 1) % Q.length];
    let nx = b[1] - a[1];
    let nz = a[0] - b[0];
    if (nx * (cx - a[0]) + nz * (cz - a[1]) > 0) {
      nx = -nx;
      nz = -nz;
    }
    // (nx, nz) pointe hors de Q
    const off = nx * a[0] + nz * a[1];
    const piece = clipHalf(rest, -nx, -nz, -off); // dehors : n·p >= off
    if (piece.length >= 3 && Math.abs(areaOf(piece)) > 1e-4) out.push(piece);
    rest = clipHalf(rest, nx, nz, off);
  }
  return out;
}
const bbox = (pts) => {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    x0 = Math.min(x0, x);
    z0 = Math.min(z0, z);
    x1 = Math.max(x1, x);
    z1 = Math.max(z1, z);
  }
  return { x0, z0, x1, z1 };
};
// un polygone agrandi depuis son centre de m mètres le long des deux axes
function grow(pts, m) {
  const [cx, cz] = centroid(pts);
  const b = bbox(pts);
  const kx = (b.x1 - cx + m) / (b.x1 - cx);
  const kz = (b.z1 - cz + m) / (b.z1 - cz);
  return pts.map(([x, z]) => [cx + (x - cx) * kx, cz + (z - cz) * kz]);
}
function shrinkTo(pts, r) {
  const [cx, cz] = centroid(pts);
  const R = Math.max(...pts.map(([x, z]) => Math.hypot(x - cx, z - cz)));
  return pts.map(([x, z]) => [cx + ((x - cx) * r) / R, cz + ((z - cz) * r) / R]);
}
const rectPts = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// le constructeur : des listes de sommets par matière, chaque triangle tourné vers sa normale, ses coordonnées de
// texture prises sur le monde
function makeBuilder(MATS) {
  const bins = new Map();
  const extra = new Map(); // des géométries toutes faites (cylindres, poutres en biais), par matière
  const get = (k) => {
    let b = bins.get(k);
    if (!b) bins.set(k, (b = { p: [], n: [], u: [] }));
    return b;
  };
  const uvOf = (M, p, n) => {
    if (M.uv) return M.uv(p, n);
    const S = M.S || 1;
    const ax = Math.abs(n[0]);
    const ay = Math.abs(n[1]);
    const az = Math.abs(n[2]);
    if (ay >= ax && ay >= az) return [p[0] / S, p[2] / S];
    if (ax >= az) return [p[2] / S, p[1] / S];
    return [p[0] / S, p[1] / S];
  };
  const tri = (k, a, b, c, n) => {
    const e1x = b[0] - a[0];
    const e1y = b[1] - a[1];
    const e1z = b[2] - a[2];
    const e2x = c[0] - a[0];
    const e2y = c[1] - a[1];
    const e2z = c[2] - a[2];
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    if (cx * n[0] + cy * n[1] + cz * n[2] < 0) [b, c] = [c, b];
    const bin = get(k);
    const M = MATS[k];
    for (const p of [a, b, c]) {
      bin.p.push(p[0], p[1], p[2]);
      bin.n.push(n[0], n[1], n[2]);
      const [u, v] = uvOf(M, p, n);
      bin.u.push(u, v);
    }
  };
  const quad = (k, a, b, c, d, n) => {
    tri(k, a, b, c, n);
    tri(k, a, c, d, n);
  };
  // un polygone convexe horizontal à la hauteur y, tourné vers le haut (ny = 1) ou le bas (-1)
  const hpoly = (k, pts, y, ny) => {
    const n = [0, ny, 0];
    for (let i = 1; i < pts.length - 1; i++) tri(k, [pts[0][0], y, pts[0][1]], [pts[i][0], y, pts[i][1]], [pts[i + 1][0], y, pts[i + 1][1]], n);
  };
  // une face verticale de a à b, de y0 à y1, tournée vers (nx, nz)
  const vface = (k, ax, az, bx, bz, y0, y1, nx, nz) => {
    if (y1 - y0 < 0.002) return;
    const l = Math.hypot(nx, nz) || 1;
    quad(k, [ax, y0, az], [bx, y0, bz], [bx, y1, bz], [ax, y1, az], [nx / l, 0, nz / l]);
  };
  // une boîte alignée sur les axes ; skip : les faces à ne pas dessiner ('-y', '+x'…)
  const box = (k, x0, x1, y0, y1, z0, z1, skip = '') => {
    if (!skip.includes('+y')) hpoly(k, rectPts(x0, z0, x1, z1), y1, 1);
    if (!skip.includes('-y')) hpoly(k, rectPts(x0, z0, x1, z1), y0, -1);
    if (!skip.includes('+x')) vface(k, x1, z0, x1, z1, y0, y1, 1, 0);
    if (!skip.includes('-x')) vface(k, x0, z0, x0, z1, y0, y1, -1, 0);
    if (!skip.includes('+z')) vface(k, x0, z1, x1, z1, y0, y1, 0, 1);
    if (!skip.includes('-z')) vface(k, x0, z0, x1, z0, y0, y1, 0, -1);
  };
  const add = (k, geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    (extra.get(k) || extra.set(k, []).get(k)).push(g);
  };
  // une poutre de section w × h, de A à B (points 3D), posée à plat (son épaisseur h à la verticale)
  const tmpO = new THREE.Object3D();
  const beam = (k, A, B, w, h) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    if (L < 1e-3) return;
    const g = new THREE.BoxGeometry(w, h, L);
    tmpO.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2);
    tmpO.up.set(0, 1, 0);
    tmpO.lookAt(B[0], B[1], B[2]);
    tmpO.updateMatrix();
    g.applyMatrix4(tmpO.matrix);
    add(k, g);
  };
  const build = (group) => {
    const keys = new Set([...bins.keys(), ...extra.keys()]);
    for (const k of keys) {
      const list = [];
      const b = bins.get(k);
      if (b && b.p.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(b.u, 2));
        list.push(g);
      }
      for (const g of extra.get(k) || []) {
        for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
        list.push(g);
      }
      if (!list.length) continue;
      const geo = list.length > 1 ? mergeGeometries(list) : list[0];
      const mesh = new THREE.Mesh(geo, MATS[k].m);
      if (MATS[k].order) mesh.renderOrder = MATS[k].order;
      group.add(mesh);
    }
  };
  return { tri, quad, hpoly, vface, box, beam, add, build };
}

// --- Les matières ---
function makeMaterials(tx, baked) {
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  // le sol poli : il reflète les lampes (spec), net comme une vitre sombre
  const polish = (map) => baked(phong({ map, specular: '#3a352c', shininess: 90 }), { spec: 0.85, gloss: 320, mask: 0 });
  return {
    terrazzo: { m: polish(tx.terrazzo), S: 2.4 },
    checker: { m: polish(tx.checker), S: 2.4 },
    carpetD: { m: baked(lam({ map: tx.carpetDark })), S: 1.5 },
    lino: { m: baked(phong({ map: tx.lino, specular: '#1c1a16', shininess: 30 }), { spec: 0.35, gloss: 90, mask: 0 }), S: 2.4 },
    quarry: { m: baked(lam({ map: tx.quarry })), S: 2.4 },
    concrete: { m: baked(lam({ map: tx.concrete })), S: 2.5 },
    wood: { m: baked(phong({ map: tx.wood, specular: '#241b12', shininess: 40 }), { spec: 0.3, gloss: 70, mask: 0 }), S: 2.0 },
    faience: { m: baked(phong({ map: tx.faience, specular: '#3a3a3a', shininess: 80 }), { spec: 0.35, gloss: 140, mask: 0 }), S: 2.0 },
    plaster: { m: baked(lam({ map: tx.plaster })), S: 2.5 },
    paintGrey: { m: baked(lam({ map: tx.paintGrey })), S: 2.5 },
    paintDark: { m: baked(lam({ map: tx.paintDark })), S: 2.5 },
    block: { m: baked(lam({ map: tx.block })), S: 2.5 },
    ceilTiles: { m: baked(lam({ map: tx.ceilTiles })), S: 2.5 },
    slab: { m: baked(lam({ map: tx.slab })), S: 2.5 },
    paper: { m: baked(lam({ map: tx.paper })), S: 2.5 },
    // la verrière la nuit : le ciel noir ne prend pas la lumière des lampes
    sky: { m: new THREE.MeshBasicMaterial({ map: tx.skyGlass, color: '#8f98a3' }), S: 3.0 },
    trim: { m: baked(phong({ color: '#e6decb', specular: '#2e2b26', shininess: 40 }), { spec: 0.35, gloss: 60, mask: 0 }), S: 1 },
    brass: { m: baked(phong({ color: '#7d5f2c', specular: '#c9a060', shininess: 80 }), { spec: 0.7, gloss: 110, mask: 0 }), S: 1 },
    steel: { m: baked(phong({ color: '#7f8286', specular: '#c4c8cc', shininess: 70 }), { spec: 0.6, gloss: 110, mask: 0 }), S: 1 },
    black: { m: baked(phong({ color: '#151515', specular: '#3a3a3a', shininess: 50 })), S: 1 },
    marbleDark: { m: baked(phong({ color: '#2a2521', specular: '#4a4540', shininess: 70 }), { spec: 0.45, gloss: 120, mask: 0 }), S: 1 },
    grille: { m: baked(lam({ map: tx.grille, alphaTest: 0.45, side: THREE.DoubleSide, color: '#bdbbb4' })), S: 0.5 },
    glass: { m: new THREE.MeshPhongMaterial({ color: '#0b1214', transparent: true, opacity: 0.2, specular: '#8fa6ae', shininess: 120, depthWrite: false, side: THREE.DoubleSide }), S: 1, order: 2 },
  };
}

// le revêtement du sol d'une salle
function floorKey(r, fi, shops) {
  if (!r) return 'concrete';
  switch (r.kind) {
    case 'mail':
    case 'court':
    case 'portal':
      return fi === 1 ? 'checker' : 'terrazzo';
    case 'plaza':
    case 'lobby':
      return 'terrazzo';
    case 'shop': {
      const sh = shops[r.shop];
      if (sh && sh.state === 'gutted') return 'concrete';
      return ['wood', 'lino', 'carpetD', 'terrazzo', 'wood'][((r.shop || 0) * 7 + fi * 3) % 5];
    }
    case 'food':
      return 'quarry';
    case 'store':
    case 'closed':
      return 'lino';
    case 'cine':
      return 'cine';
    case 'cineHall':
    case 'screen':
    case 'office':
      return 'carpetD';
    case 'wc':
      return 'faience';
    default:
      return 'concrete';
  }
}
// la matière des murs (et des retombées) d'une salle
function wallKey(r) {
  if (!r) return 'block';
  switch (r.kind) {
    case 'mail':
    case 'court':
    case 'plaza':
    case 'portal':
    case 'lobby':
    case 'food':
      return 'plaster';
    case 'service':
    case 'dock':
      return 'block';
    case 'cine':
    case 'cineHall':
    case 'screen':
      return 'paintDark';
    case 'wc':
      return 'faience';
    default:
      return 'paintGrey';
  }
}
const CEIL_KEY = { coffer: 'plaster', soffit: 'plaster', vault: 'plaster', dome: 'plaster', grid: 'ceilTiles', slab: 'slab', black: 'paintDark', spots: 'paintDark', sky: 'sky', lantern: 'sky' };

// Les couleurs des lampes du mall (plus fortes que le blanc : le caméscope sature)
export const MALL_ON = {
  warm: new THREE.Color('#ffd7a0').multiplyScalar(3.0),
  spot: new THREE.Color('#fff0d4').multiplyScalar(3.4),
  cool: new THREE.Color('#e6f0ff').multiplyScalar(3.0),
  glow: new THREE.Color('#ffe8c8').multiplyScalar(1.9),
};
export const MALL_OFF = new THREE.Color('#4a453c');
export const mallOnCol = (l) => (l.kind === 'cove' || l.kind === 'pendant' || l.kind === 'sconce' ? MALL_ON.warm : l.kind === 'panel' || l.kind === 'tube' ? MALL_ON.cool : l.kind === 'glow' ? MALL_ON.glow : MALL_ON.spot);

export function buildMall({ map, fi, floors, group, baked, tx }) {
  const W = map.W;
  const H = map.H;
  const up = floors[0];
  const MATS = makeMaterials(tx, baked);
  const rooms = map.rooms;
  const roomOf = (x, z) => {
    if (x < 0 || z < 0 || x >= W || z >= H) return null;
    const k = map.zone[z * W + x];
    return k >= 0 ? rooms[k] : null;
  };
  const freeAt = (x, z) => {
    if (x < 0 || z < 0 || x >= W || z >= H) return false;
    const v = map.grid[z * W + x];
    return v === T.FLOOR || v === T.PILLAR;
  };

  // la moquette du hall du cinéma : son motif à la taille de la salle, un disque autour de chaque pilier rond
  const cine = rooms.find((r) => r.kind === 'cine');
  if (cine) {
    const X0 = cine.x0 * C;
    const Z0 = cine.z0 * C;
    const w = (cine.x1 - cine.x0 + 1) * C;
    const h = (cine.z1 - cine.z0 + 1) * C;
    const discs = Object.values(map.pillars)
      .filter((p) => p.kind === 'cine')
      .map((p) => [p.x - X0, p.z - Z0, 1.55]);
    const m = baked(new THREE.MeshLambertMaterial({ map: cinemaCarpet(w, h, discs, null) }));
    MATS.cine = { m, uv: (p) => [(p[0] - X0) / w, 1 - (p[2] - Z0) / h] };
    tx.ready.then(() => {
      const old = m.map;
      m.map = cinemaCarpet(w, h, discs, tx.carpetImg);
      m.needsUpdate = true;
      old.dispose();
    });
  }
  const G = makeBuilder(MATS);

  // --- Les plafonds : hauteur et genre case par case ---
  const VZ0 = Math.round((map.mailZ - 2 * C) / C); // les quatre cases du milieu du mail (la lanterne, au-dessus du vide)
  const VZ1 = VZ0 + 3;
  const ceilAt = (x, z) => {
    const r = roomOf(x, z);
    if (!r) return { h: 3.0, kind: 'slab', r: null };
    if (fi === 0 && r.kind === 'mail' && z >= VZ0 && z <= VZ1) return { h: LANTERN, kind: 'lantern', r };
    if (r.vault) return { h: r.vault.base, kind: r.kind === 'plaza' ? 'spots' : 'vault', r };
    return { h: r.ceilH, kind: r.ceil, r };
  };
  const ceilH = new Float32Array(W * H);
  for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) ceilH[z * W + x] = freeAt(x, z) ? ceilAt(x, z).h : 0;
  const hAt = (x, z) => (x < 0 || z < 0 || x >= W || z >= H ? 0 : ceilH[z * W + x]);

  // les vides vus d'ici : à l'étage du haut, des trous dans le sol ; en bas, des trous dans le plafond
  const voids = up.voids || [];
  const stairRects = (map.stairs || []).map((st) => {
    const a = [st.ox, st.oz];
    const b = [st.ox + st.dx * 3 * C + st.px * 2 * C, st.oz + st.dz * 3 * C + st.pz * 2 * C];
    return { st, pts: rectPts(Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[0], b[0]), Math.max(a[1], b[1])) };
  });
  const stairCell = new Set((map.stairs || []).flatMap((st) => st.cells.map((c) => c.gz * W + c.gx)));
  const voidBoxes = voids.map((v) => ({ pts: v.pts, b: bbox(v.pts) }));
  // une case, moins les polygones donnés : des morceaux convexes
  const cellPieces = (x, z, polys) => {
    let pieces = [rectPts(x * C, z * C, (x + 1) * C, (z + 1) * C)];
    for (const { pts, b } of polys) {
      if (b.x1 <= x * C || b.x0 >= (x + 1) * C || b.z1 <= z * C || b.z0 >= (z + 1) * C) continue;
      pieces = pieces.flatMap((p) => convexMinus(p, pts));
      if (!pieces.length) break;
    }
    return pieces;
  };

  // les voûtes des cours du haut : le contour de leur ouverture (le vide agrandi)
  const vaults = [];
  if (fi === 0) {
    for (const r of rooms) {
      if (!r.vault) continue;
      const v = voids.find((o) => o.court === r.court);
      if (!v) continue;
      const O1 = grow(v.pts, r.vault.open);
      vaults.push({ r, v, O1, b: bbox(O1), c: centroid(v.pts) });
    }
  }
  const vaultOf = new Map(vaults.map((o) => [o.r.id, o]));

  // 1. Sols et plafonds, case par case
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      if (!freeAt(x, z)) continue;
      const i = z * W + x;
      const r = roomOf(x, z);
      const ce = ceilAt(x, z);
      // le sol (en haut : pas dans la trémie d'un escalier, rogné par les vides)
      if (!(fi === 0 && stairCell.has(i))) {
        const fk = floorKey(r, fi, map.shops);
        const pieces = fi === 0 ? cellPieces(x, z, voidBoxes) : [rectPts(x * C, z * C, (x + 1) * C, (z + 1) * C)];
        for (const p of pieces) G.hpoly(fk, p, 0, 1);
      }
      // le plafond (en bas : percé sous les vides et les escaliers ; en haut : sous l'ouverture des voûtes)
      if (fi === 1 && stairCell.has(i)) continue; // la trémie de l'escalier
      const holes = fi === 1 ? [...voidBoxes] : [];
      const vo = r && vaultOf.get(r.id);
      if (vo) holes.push({ pts: vo.O1, b: vo.b });
      const ck = CEIL_KEY[ce.kind] || 'plaster';
      for (const p of cellPieces(x, z, holes)) G.hpoly(ck, p, ce.h, -1);
      // une retombée entre deux plafonds de hauteurs différentes : on la voit du côté du plus haut (au-dessus d'une
      // vitrine, depuis le mail), revêtue comme lui
      for (const [dx, dz] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (!freeAt(nx, nz)) continue;
        const h2 = ceilH[nz * W + nx];
        const h1 = ce.h;
        if (Math.abs(h2 - h1) < 0.01) continue;
        const hi = h1 > h2 ? r : roomOf(nx, nz);
        const k = ce.kind === 'lantern' || ceilAt(nx, nz).kind === 'lantern' ? 'plaster' : wallKey(hi);
        // la face, sur le bord commun ; tournée vers la case la plus haute
        const s = h1 > h2 ? -1 : 1; // +1 : vers la voisine
        if (dx) G.vface(k, (x + 1) * C, z * C, (x + 1) * C, (z + 1) * C, Math.min(h1, h2), Math.max(h1, h2), s, 0);
        else G.vface(k, x * C, (z + 1) * C, (x + 1) * C, (z + 1) * C, Math.min(h1, h2), Math.max(h1, h2), 0, s);
      }
    }
  }

  // 2. Les murs : une face par côté visible, à la hauteur du plafond de la case qu'elle regarde
  for (let z = 0; z < H; z++) {
    for (let x = 0; x < W; x++) {
      const v = map.grid[z * W + x];
      if (v !== T.WALL && v !== T.EXIT) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (!freeAt(nx, nz)) continue;
        const h = hAt(nx, nz);
        const y0 = v === T.EXIT ? EXIT_H : 0;
        if (h <= y0) continue;
        const k = wallKey(roomOf(nx, nz));
        // la face est sur le bord de la case du mur, du côté de la voisine
        const ex = dx > 0 ? (x + 1) * C : dx < 0 ? x * C : null;
        const ez = dz > 0 ? (z + 1) * C : dz < 0 ? z * C : null;
        if (ex !== null) G.vface(k, ex, z * C, ex, (z + 1) * C, y0, h, dx, 0);
        else G.vface(k, x * C, ez, (x + 1) * C, ez, y0, h, 0, dz);
      }
    }
  }

  // 3. Les voûtes des cours (étage du haut)
  const glowGeos = []; // le plafond lumineux de la place est : une lampe (fixtures)
  for (const vo of vaults) {
    const { r, O1 } = vo;
    const V = r.vault;
    const [cx, cz] = vo.c;
    const ring = (pts, y0, y1, k) => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        // tournée vers le centre
        const mx = (a[0] + b[0]) / 2;
        const mz = (a[1] + b[1]) / 2;
        let nx = b[1] - a[1];
        let nz = a[0] - b[0];
        if (nx * (cx - mx) + nz * (cz - mz) < 0) {
          nx = -nx;
          nz = -nz;
        }
        G.vface(k, a[0], a[1], b[0], b[1], y0, y1, nx, nz);
      }
    };
    // la lèvre moulurée au bas du tambour, et la corniche (une saillie de 18 cm, 30 cm de haut)
    const lip = (pts, y, k) => {
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        const ins = (p, m) => {
          const l = Math.hypot(p[0] - cx, p[1] - cz);
          return [p[0] - ((p[0] - cx) / l) * m, p[1] - ((p[1] - cz) / l) * m];
        };
        const a2 = ins(a, 0.09);
        const b2 = ins(b, 0.09);
        G.beam(k, [a2[0], y - 0.15, a2[1]], [b2[0], y - 0.15, b2[1]], 0.2, 0.3);
      }
    };
    const top = V.ring || V.top;
    ring(O1, V.base, top, 'plaster');
    lip(O1, V.base, 'trim');
    if (V.ring) {
      const O2 = shrinkTo(vo.v.pts, V.inner);
      for (const p of convexMinus(O1, O2)) G.hpoly('plaster', p, V.ring, -1);
      ring(O2, V.ring, V.top, 'plaster');
      lip(O2, V.ring, 'trim');
      G.hpoly('sky', O2, V.top, -1);
      // les fers de la verrière : huit rayons et deux anneaux
      for (let i = 0; i < O2.length; i++) G.beam('black', [cx, V.top - 0.08, cz], [O2[i][0], V.top - 0.08, O2[i][1]], 0.08, 0.14);
      for (const k of [0.4, 0.75]) {
        const P = shrinkTo(vo.v.pts, V.inner * k);
        for (let i = 0; i < P.length; i++) G.beam('black', [P[i][0], V.top - 0.08, P[i][1]], [P[(i + 1) % P.length][0], V.top - 0.08, P[(i + 1) % P.length][1]], 0.08, 0.14);
      }
    } else if (V.glow) {
      // la lanterne lumineuse : un plafond diffusant (une lampe) dans un cadre noir
      const g = new THREE.BufferGeometry();
      const pos = [];
      for (let i = 1; i < O1.length - 1; i++) pos.push(O1[0][0], V.top, O1[0][1], O1[i][0], V.top, O1[i][1], O1[i + 1][0], V.top, O1[i + 1][1]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      glowGeos.push(g); // (dessiné des deux côtés)
      // le quadrillage du diffuseur
      const b = bbox(O1);
      for (let x = Math.ceil(b.x0 / 1.2) * 1.2; x < b.x1; x += 1.2) G.beam('black', [x, V.top - 0.03, b.z0], [x, V.top - 0.03, b.z1], 0.04, 0.05);
    } else G.hpoly('plaster', O1, V.top, -1);
  }

  // 4. Le mail du haut : les caissons (des poutres tous les 5 m, sous le plafond à 5,60 m)
  if (fi === 0) {
    for (const r of rooms) {
      if (r.kind !== 'mail') continue;
      for (let x = r.x0 * C + 5; x < (r.x1 + 1) * C - 0.1; x += 5) {
        for (const [z0, z1] of [[r.z0 * C, VZ0 * C], [(VZ1 + 1) * C, (r.z1 + 1) * C]]) G.box('plaster', x - 0.22, x + 0.22, r.ceilH - 0.55, r.ceilH, z0, z1, '+y');
      }
      // les lanternes : des fers tous les 2,5 m
      for (let x = r.x0 * C + C; x < (r.x1 + 1) * C; x += C) G.beam('black', [x, LANTERN - 0.06, VZ0 * C], [x, LANTERN - 0.06, (VZ1 + 1) * C], 0.07, 0.12);
    }
  }

  // 5. Les vides : le bandeau (l'épaisseur de la dalle, vue d'en bas) et les garde-corps ; la trémie des escaliers
  const postsAt = []; // les barreaux des garde-corps : [x, y0, z, hauteur, épaisseur]
  const escTops = (up.allEscalators || []).filter((e) => e.fi === 1).map((e) => ({ x: e.x + e.dir * (e.land + e.run), z: e.z, w: e.w }));
  const railGap = (x, z) => escTops.some((e) => Math.abs(x - e.x) < 1.2 && Math.abs(z - e.z) < e.w / 2 + 0.22);
  // un garde-corps de a à b (au sol de l'étage, y = 0) ; out : vers où est le sol (le garde-corps est posé à 8 cm du bord)
  const railing = (a, b, nx, nz, y0 = 0) => {
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.max(1, Math.round(L / 0.05));
    let s0 = null;
    const flush = (s1) => {
      if (s0 === null) return;
      const t0 = s0 / n;
      const t1 = s1 / n;
      const P = (t) => [a[0] + (b[0] - a[0]) * t + nx * 0.08, a[1] + (b[1] - a[1]) * t + nz * 0.08];
      const p0 = P(t0);
      const p1 = P(t1);
      if (Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.1) {
        G.beam('trim', [p0[0], y0 + 0.06, p0[1]], [p1[0], y0 + 0.06, p1[1]], 0.18, 0.12); // le socle
        G.beam('trim', [p0[0], y0 + 0.17, p0[1]], [p1[0], y0 + 0.17, p1[1]], 0.05, 0.04);
        G.beam('trim', [p0[0], y0 + MALL_RAIL - 0.05, p0[1]], [p1[0], y0 + MALL_RAIL - 0.05, p1[1]], 0.07, 0.06);
        G.beam('brass', [p0[0], y0 + MALL_RAIL - 0.005, p0[1]], [p1[0], y0 + MALL_RAIL - 0.005, p1[1]], 0.09, 0.035); // la main courante
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
        const m = Math.max(1, Math.round(len / 0.13));
        for (let j = 0; j <= m; j++) {
          const t = j / m;
          const x = p0[0] + (p1[0] - p0[0]) * t;
          const z = p0[1] + (p1[1] - p0[1]) * t;
          const post = j === 0 || j === m || j % 16 === 0;
          postsAt.push([x, y0 + 0.19, z, MALL_RAIL - 0.27, post ? 0.075 : 0.03]);
        }
      }
      s0 = null;
    };
    for (let s = 0; s <= n; s++) {
      const t = s / n;
      const x = a[0] + (b[0] - a[0]) * t;
      const z = a[1] + (b[1] - a[1]) * t;
      const gap = railGap(x, z);
      if (!gap && s0 === null) s0 = s;
      if (gap && s0 !== null) flush(s - 1);
    }
    flush(n);
  };
  const outline = (pts, inward, fn) => {
    const [cx, cz] = centroid(pts);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      let nx = b[1] - a[1];
      let nz = a[0] - b[0];
      const l = Math.hypot(nx, nz);
      nx /= l;
      nz /= l;
      const toC = nx * (cx - (a[0] + b[0]) / 2) + nz * (cz - (a[1] + b[1]) / 2) > 0;
      if (toC !== inward) {
        nx = -nx;
        nz = -nz;
      }
      fn(a, b, nx, nz);
    }
  };
  if (fi === 0) {
    for (const v of voids) {
      // le bandeau, tourné vers le vide ; un filet de laiton à 35 cm de son bas
      outline(v.pts, true, (a, b, nx, nz) => {
        G.vface('plaster', a[0], a[1], b[0], b[1], -SLAB, 0, nx, nz);
        G.beam('brass', [a[0] + nx * 0.015, -SLAB + 0.35, a[1] + nz * 0.015], [b[0] + nx * 0.015, -SLAB + 0.35, b[1] + nz * 0.015], 0.03, 0.05);
      });
      outline(v.pts, false, (a, b, nx, nz) => railing(a, b, nx, nz));
    }
    // la trémie des escaliers : le bandeau, et un garde-corps partout sauf à l'entrée (le haut de la seconde volée)
    for (const { st, pts } of stairRects) {
      outline(pts, true, (a, b, nx, nz) => G.vface('plaster', a[0], a[1], b[0], b[1], -SLAB, 0, nx, nz));
      const P = (u, v) => [st.ox + st.dx * u + st.px * v, st.oz + st.dz * u + st.pz * v];
      const edge = (u0, v0, u1, v1) => {
        const n = u0 === u1 ? [st.dx * Math.sign(u0 - 1.5 * C), st.dz * Math.sign(u0 - 1.5 * C)] : [st.px * Math.sign(v0 - C), st.pz * Math.sign(v0 - C)];
        railing(P(u0, v0), P(u1, v1), n[0], n[1]);
      };
      edge(0, 0, 0, C);
      edge(0, 0, 3 * C, 0);
      edge(3 * C, 0, 3 * C, 2 * C);
      edge(0, 2 * C, 3 * C, 2 * C);
    }
  }

  // 6. Les piliers
  const sconcePose = new Map(); // pilier -> axe de ses appliques ('x' ou 'z')
  const voidCs = voids.map((v) => centroid(v.pts));
  for (const k in map.pillars) {
    const p = map.pillars[k];
    const gx = Math.floor(p.x / C);
    const gz = Math.floor(p.z / C);
    const top = hAt(gx, gz) || MALL_CEIL;
    const h = p.h;
    if (p.round) {
      const rk = 'paintDark';
      G.add(rk, new THREE.CylinderGeometry(h, h, top, 28, 1, true).translate(p.x, top / 2, p.z));
      G.add('steel', new THREE.CylinderGeometry(h + 0.025, h + 0.03, 0.14, 28).translate(p.x, 0.07, p.z));
      if (p.kind === 'cine') {
        // le disque blanc au plafond (son anneau de LED bleues viendra avec l'éclairage du cinéma)
        G.add('trim', new THREE.CylinderGeometry(1.55, 1.55, 0.32, 48).translate(p.x, top - 0.16, p.z));
      }
      continue;
    }
    const fancy = p.kind === 'mail' || p.kind === 'court';
    const sk = fancy ? 'plaster' : p.kind === 'dock' ? 'block' : 'paintGrey';
    G.box(sk, p.x - h, p.x + h, 0, top, p.z - h, p.z + h, '+y-y');
    G.box('marbleDark', p.x - h - 0.025, p.x + h + 0.025, 0, fancy ? 0.22 : 0.12, p.z - h - 0.025, p.z + h + 0.025, '-y');
    if (fancy) {
      // le chapiteau : deux bandeaux qui s'élargissent sous le plafond, un filet de laiton
      G.box('trim', p.x - h - 0.06, p.x + h + 0.06, top - 0.42, top - 0.22, p.z - h - 0.06, p.z + h + 0.06, '+y');
      G.box('trim', p.x - h - 0.13, p.x + h + 0.13, top - 0.22, top, p.z - h - 0.13, p.z + h + 0.13, '+y');
      G.box('brass', p.x - h - 0.008, p.x + h + 0.008, 1.05, 1.09, p.z - h - 0.008, p.z + h + 0.008, '+y-y');
      // les appliques regardent les allées : de part et d'autre du vide le plus proche
      let best = null;
      let bd = Infinity;
      for (const c of voidCs) {
        const d = Math.hypot(p.x - c[0], p.z - c[1]);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      sconcePose.set(+k, best && Math.abs(p.x - best[0]) > Math.abs(p.z - best[1]) * 1.4 ? 'x' : 'z');
    }
  }

  // 7. Les escaliers ouverts (dessinés depuis l'étage du bas : ils montent jusqu'au sol du haut)
  if (fi === 1) {
    for (const st of map.stairs || []) {
      const P = (u, v) => [st.ox + st.dx * u + st.px * v, st.oz + st.dz * u + st.pz * v];
      const lbox = (k, u0, u1, y0, y1, v0, v1, skip = '') => {
        const a = P(u0, v0);
        const b = P(u1, v1);
        G.box(k, Math.min(a[0], b[0]), Math.max(a[0], b[0]), y0, y1, Math.min(a[1], b[1]), Math.max(a[1], b[1]), skip);
      };
      const N = 16;
      const t = (2 * C) / N;
      const RISE = FLOOR_DY / 2 / N; // 20 cm
      // la première volée : des marches pleines, du sol au palier
      for (let k = 0; k < N; k++) lbox('terrazzo', k * t, (k + 1) * t, 0, (k + 1) * RISE, 0, C, '-y');
      // le palier, sur un massif crème
      lbox('terrazzo', 2 * C, 3 * C, FLOOR_DY / 2 - 0.1, FLOOR_DY / 2, 0, 2 * C, '-y');
      lbox('plaster', 2 * C, 3 * C, 0, FLOOR_DY / 2 - 0.1, 0, 2 * C, '+y-y');
      // la seconde volée : des marches posées sur une dalle en pente
      for (let k = 0; k < N; k++) lbox('terrazzo', k * t, (k + 1) * t, FLOOR_DY - (k + 1) * RISE, FLOOR_DY - k * RISE, C, 2 * C, '-y');
      const slope = (u) => FLOOR_DY - (u / (2 * C)) * (FLOOR_DY / 2);
      const soff = (u) => slope(u) - RISE - 0.28;
      {
        const a = P(0, C);
        const b = P(2 * C, C);
        const c = P(2 * C, 2 * C);
        const d = P(0, 2 * C);
        G.quad('plaster', [a[0], soff(0), a[1]], [b[0], soff(2 * C), b[1]], [c[0], soff(2 * C), c[1]], [d[0], soff(0), d[1]], [-st.dx * 0.54, -0.84, -st.dz * 0.54]);
        // les limons, des deux côtés de la seconde volée
        for (const [v, s] of [[C, -1], [2 * C, 1]]) {
          const p0 = P(0, v);
          const p1 = P(2 * C, v);
          const n = [st.px * s, 0, st.pz * s];
          G.quad('plaster', [p0[0], soff(0), p0[1]], [p1[0], soff(2 * C), p1[1]], [p1[0], slope(2 * C) + 0.06, p1[1]], [p0[0], slope(0) + 0.06, p0[1]], n);
        }
      }
      // les garde-corps qui suivent les volées : barreaux et main courante en pente
      const slopeRail = (u0, v0, y0, u1, v1, y1) => {
        const a = P(u0, v0);
        const b = P(u1, v1);
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
        G.beam('trim', [a[0], y0 + MALL_RAIL - 0.05, a[1]], [b[0], y1 + MALL_RAIL - 0.05, b[1]], 0.07, 0.06);
        G.beam('brass', [a[0], y0 + MALL_RAIL, a[1]], [b[0], y1 + MALL_RAIL, b[1]], 0.09, 0.035);
        const m = Math.max(1, Math.round(L / 0.13));
        for (let j = 0; j <= m; j++) {
          const f = j / m;
          const y = y0 + (y1 - y0) * f;
          postsAt.push([a[0] + (b[0] - a[0]) * f, y, a[1] + (b[1] - a[1]) * f, MALL_RAIL - 0.08, j === 0 || j === m ? 0.075 : 0.03]);
        }
      };
      const inset = 0.07;
      slopeRail(0.2, inset, 0.2, 2 * C, inset, FLOOR_DY / 2); // dehors de la première volée
      slopeRail(2 * C, inset, FLOOR_DY / 2, 3 * C - inset, inset, FLOOR_DY / 2); // le palier
      slopeRail(3 * C - inset, inset, FLOOR_DY / 2, 3 * C - inset, 2 * C - inset, FLOOR_DY / 2);
      slopeRail(3 * C - inset, 2 * C - inset, FLOOR_DY / 2, 2 * C, 2 * C - inset, FLOOR_DY / 2);
      slopeRail(2 * C, 2 * C - inset, FLOOR_DY / 2, 0, 2 * C - inset, FLOOR_DY); // dehors de la seconde
      slopeRail(2 * C, C + inset, FLOOR_DY / 2, 0, C + inset, FLOOR_DY); // la rampe du milieu, côté seconde volée
    }
  }

  // 8. Les escalators (à l'arrêt) : paliers, marches, jupes d'inox, balustrades de verre, mains courantes noires,
  // habillage crème du caisson
  for (const e of map.escalators || []) {
    const yOf = (s) => (s < e.land ? 0 : s < e.land + e.run ? ((s - e.land) / e.run) * e.rise : e.rise);
    const xOf = (s) => e.x + e.dir * s;
    const prof = [0, e.land, e.land + e.run, e.len];
    const hw = e.w / 2;
    const zIn = hw - 0.12;
    const x0 = (s0, s1) => Math.min(xOf(s0), xOf(s1));
    const x1 = (s0, s1) => Math.max(xOf(s0), xOf(s1));
    // les paliers (plaques d'acier)
    G.box('steel', x0(0, e.land), x1(0, e.land), -0.02, 0.01, e.z - zIn, e.z + zIn, '-y');
    G.box('steel', x0(e.land + e.run, e.len), x1(e.land + e.run, e.len), e.rise - 0.02, e.rise + 0.01, e.z - zIn, e.z + zIn, '-y');
    // les marches
    const n = Math.round(e.rise / 0.2);
    const tr = e.run / n;
    for (let i = 0; i < n; i++) {
      const s0 = e.land + i * tr;
      G.box('steel', x0(s0, s0 + tr), x1(s0, s0 + tr), (i + 1) * 0.2 - 0.2, (i + 1) * 0.2, e.z - zIn, e.z + zIn, '-y');
    }
    // le long du profil : jupes, verre, main courante, habillage
    for (let j = 0; j < 3; j++) {
      const sa = prof[j];
      const sb = prof[j + 1];
      const ya = yOf(sa);
      const yb = yOf(sb);
      const xa = xOf(sa);
      const xb = xOf(sb);
      for (const sd of [-1, 1]) {
        const zs = e.z + sd * zIn;
        const zg = e.z + sd * (hw - 0.03);
        const zo = e.z + sd * (hw + 0.09);
        // la jupe d'inox, côté marches
        G.quad('steel', [xa, ya, zs], [xb, yb, zs], [xb, yb + 0.16, zs], [xa, ya + 0.16, zs], [0, 0, -sd]);
        // le verre
        G.quad('glass', [xa, ya + 0.2, zg], [xb, yb + 0.2, zg], [xb, yb + 0.95, zg], [xa, ya + 0.95, zg], [0, 0, sd]);
        // le dessus du caisson (entre le verre et l'habillage)
        G.quad('steel', [xa, ya + 0.16, zs], [xb, yb + 0.16, zs], [xb, yb + 0.2, zo], [xa, ya + 0.2, zo], [0, 1, 0]);
        // l'habillage crème, côté dehors, jusqu'au sol ou à 1 m sous les marches
        const ba = Math.max(0, ya - 1.05);
        const bb = Math.max(0, yb - 1.05);
        G.quad('trim', [xa, ba, zo], [xb, bb, zo], [xb, yb + 0.2, zo], [xa, ya + 0.2, zo], [0, 0, sd]);
        // la main courante
        G.beam('black', [xa, ya + 1.0, zg], [xb, yb + 1.0, zg], 0.09, 0.08);
      }
      // le dessous du caisson
      const ba = Math.max(0, ya - 1.05);
      const bb = Math.max(0, yb - 1.05);
      if (ba > 0.01 || bb > 0.01) G.quad('trim', [xa, ba, e.z - hw - 0.09], [xb, bb, e.z - hw - 0.09], [xb, bb, e.z + hw + 0.09], [xa, ba, e.z + hw + 0.09], [0, -1, 0]);
    }
    // les bouts : la main courante redescend (le tambour), le caisson se ferme
    for (const sd of [-1, 1]) {
      const zg = e.z + sd * (hw - 0.03);
      G.beam('black', [xOf(-0.35), 0.7, zg], [xOf(0), 1.0, zg], 0.09, 0.08);
      G.beam('black', [xOf(e.len), e.rise + 1.0, zg], [xOf(e.len + 0.35), e.rise + 0.7, zg], 0.09, 0.08);
    }
    G.vface('trim', xOf(0), e.z - hw - 0.09, xOf(0), e.z + hw + 0.09, 0, 0.2, -e.dir, 0);
  }

  // 9. Les devantures des boutiques
  for (const sh of map.shops || []) {
    const r = rooms[sh.room];
    const z = sh.frontZ;
    const xa = sh.x0 * C;
    const xb = (sh.x1 + 1) * C;
    const top = r.ceilH; // le plafond de la boutique
    const HEAD = top - 0.62; // le bas du bandeau d'enseigne
    const out = sh.dir; // vers le mail
    // le bandeau d'enseigne (noir ou laiton), sur toute la largeur
    G.box(sh.sign % 2 ? 'black' : 'marbleDark', xa, xb, HEAD, top, z - 0.14, z + 0.14, '+y');
    G.box('brass', xa, xb, HEAD - 0.03, HEAD, z - 0.15, z + 0.15, '+y');
    if (sh.state === 'gutted') continue;
    if (sh.state === 'grille') {
      // le rideau à mailles, baissé ; ses coulisses de part et d'autre
      G.vface('grille', xa + 0.06, z, xb - 0.06, z, 0, HEAD - 0.03, 0, out);
      for (const x of [xa + 0.04, xb - 0.04]) G.box('steel', x - 0.04, x + 0.04, 0, HEAD, z - 0.06, z + 0.06, '+y-y');
      continue;
    }
    // la vitrine : une allège de marbre noir, des glaces entre des montants de laiton, la porte au milieu (open)
    const gap = sh.state === 'open' && sh.gap ? sh.gap : null;
    const spans = gap ? [[xa, gap[0]], [gap[1], xb]] : [[xa, xb]];
    for (const [s0, s1] of spans) {
      G.box('marbleDark', s0, s1, 0, 0.32, z - 0.06, z + 0.06, '-y');
      G.vface('glass', s0, z, s1, z, 0.32, HEAD - 0.03, 0, out);
      const m = Math.max(1, Math.round((s1 - s0) / 1.6));
      for (let j = 0; j <= m; j++) {
        const x = s0 + ((s1 - s0) * j) / m;
        G.box('brass', x - 0.03, x + 0.03, 0.32, HEAD - 0.03, z - 0.04, z + 0.04, '+y-y');
      }
      // une vitrine sur deux, quand la boutique est fermée : du papier kraft collé derrière
      if (sh.state === 'glass' && sh.dark) G.vface('paper', s0 + 0.05, z - out * 0.06, s1 - 0.05, z - out * 0.06, 0.34, HEAD - 0.05, 0, out);
    }
    if (gap) for (const x of gap) G.box('brass', x - 0.05, x + 0.05, 0, HEAD - 0.03, z - 0.06, z + 0.06, '+y-y');
  }
  // la grille du grand magasin fermé, sur toute la hauteur du passage
  for (const o of map.solids || []) {
    if (!o.gate) continue;
    const h = hAt(Math.floor(o.ax / C), Math.floor(o.az / C) - 1) || 4;
    G.vface('grille', o.ax, o.az, o.bx, o.bz, 0, h, 0, -1);
    G.box('steel', Math.min(o.ax, o.bx), Math.max(o.ax, o.bx), h - 0.35, h, o.az - 0.12, o.az + 0.12, '+y');
  }

  G.build(group);
  // les barreaux : un seul maillage
  if (postsAt.length) {
    const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), MATS.trim.m, postsAt.length);
    const o = new THREE.Object3D();
    postsAt.forEach(([x, y, z, h, w], i) => {
      o.position.set(x, y, z);
      o.scale.set(w, h, w);
      o.updateMatrix();
      posts.setMatrixAt(i, o.matrix);
    });
    posts.instanceMatrix.needsUpdate = true;
    group.add(posts);
  }

  // Les lampes : une forme par genre, colorées par la scène (allumées, grillées, qui grésillent)
  const fixtures = (fixSet, dummy) => {
    const white = () => new THREE.MeshBasicMaterial({ color: '#ffffff' });
    const of = (kind) => map.lights.filter((l) => l.kind === kind);
    // la corniche : un tube lumineux caché dans la lèvre (mail : le long des caissons ; cours : autour du tambour)
    fixSet(new THREE.BoxGeometry(1, 0.04, 0.09), white(), of('cove'), (l) => {
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(0, l.rot || 0, 0);
      dummy.scale.set(l.ring ? 5.2 : 4.1, 1, 1);
    });
    // les spots encastrés et les balises des allées
    fixSet(new THREE.CylinderGeometry(0.085, 0.085, 0.02, 20), white(), of('spot'), (l) => {
      dummy.position.set(l.x, l.y - 0.012, l.z);
    });
    fixSet(new THREE.BoxGeometry(0.22, 0.03, 0.05), white(), of('aisle'), (l) => {
      dummy.position.set(l.x, 0.02, l.z);
    });
    // les dalles lumineuses (60 × 60) et les réglettes des coulisses
    fixSet(new THREE.BoxGeometry(0.58, 0.03, 0.58), white(), of('panel'), (l) => {
      dummy.position.set(l.x, l.y - 0.016, l.z);
    });
    fixSet(new THREE.CylinderGeometry(0.016, 0.016, 1.5, 10).rotateZ(Math.PI / 2), white(), of('tube'), (l) => {
      dummy.position.set(l.x, l.y - 0.09, l.z);
    });
    // les suspensions : la grande (cours) et celles du food court
    const pend = of('pendant');
    fixSet(new THREE.CylinderGeometry(1, 1, 0.5, 40, 1), white(), pend, (l) => {
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.set(l.big ? 1.15 : 0.38, l.big ? 1 : 0.4, l.big ? 1.15 : 0.38);
    });
    // les appliques des piliers, par paire
    // (les piliers du mail et des cours font tous 90 cm)
    const sconceGeo = mergeGeometries([-1, 1].map((s) => new THREE.CylinderGeometry(0.075, 0.05, 0.2, 14).translate(0, 0, s * 0.58)));
    const sconces = of('sconce');
    fixSet(sconceGeo, white(), sconces, (l) => {
      const axis = sconcePose.get(l.pillar) || 'z';
      dummy.position.set(l.x, l.y, l.z);
      dummy.rotation.set(0, axis === 'x' ? Math.PI / 2 : 0, 0);
    });
    // la lanterne de la place est (un plafond diffusant)
    const glows = of('glow');
    if (glows.length && glowGeos.length) {
      fixSet(glowGeos[0], new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), glows.slice(0, 1), () => {
        dummy.position.set(0, 0, 0);
      });
    }
    // ce qui ne s'allume pas : les fûts des suspensions, leurs câbles, les platines des appliques, les boîtiers des
    // réglettes
    const deco = [];
    for (const l of pend) {
      const ceil = hAt(l.gx, l.gz) || l.y + 1;
      const R = l.big ? 1.32 : 0.44;
      deco.push(['brass', new THREE.CylinderGeometry(R, R * 1.05, l.big ? 0.95 : 0.36, 40, 1, true).translate(l.x, l.y + (l.big ? 0.2 : 0.1), l.z)]);
      deco.push(['black', new THREE.CylinderGeometry(0.012, 0.012, ceil - l.y, 6).translate(l.x, (ceil + l.y) / 2, l.z)]);
    }
    for (const l of sconces) {
      const axis = sconcePose.get(l.pillar) || 'z';
      const p = map.pillars[l.pillar];
      const d = (p ? p.h : 0.45) + 0.012;
      for (const s of [-1, 1]) {
        const g = new THREE.BoxGeometry(0.14, 0.34, 0.024).translate(0, 0, s * d);
        if (axis === 'x') g.rotateY(Math.PI / 2);
        deco.push(['brass', g.translate(l.x, l.y, l.z)]);
      }
    }
    for (const l of of('tube')) deco.push(['steel', new THREE.BoxGeometry(1.56, 0.05, 0.08).translate(l.x, l.y - 0.035, l.z)]);
    const byKey = new Map();
    for (const [k, g] of deco) (byKey.get(k) || byKey.set(k, []).get(k)).push(g.index ? g.toNonIndexed() : g);
    for (const [k, list] of byKey) {
      for (const g of list) for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
      group.add(new THREE.Mesh(mergeGeometries(list), MATS[k].m));
    }
  };

  return {
    fixtures,
    wallMat: MATS.plaster.m,
    // les feux de couleur (le moteur de lumière) : rien encore
    lights() {},
    update() {},
  };
}
