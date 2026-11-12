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
import { MALL_CEIL, MALL_RAIL, ledLoop } from '../engine/mall.js';
import { cinemaCarpet } from './mallTextures.js';
import { drawMallProps } from './mallProps.js';
import { drawMallWalls } from './mallWalls.js';
import { drawMallSigns } from './mallSigns.js';
import { drawMallCinema } from './mallCinema.js';
import { marigoldFilmArt } from './mallDoll.js';
import { createKitInstancer } from './kit.js';

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
// la normale de chaque arête d'un polygone convexe, tournée vers son centre
function edgeNormals(pts) {
  const [cx, cz] = centroid(pts);
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length];
    let nx = b[1] - a[1];
    let nz = a[0] - b[0];
    const l = Math.hypot(nx, nz) || 1;
    nx /= l;
    nz /= l;
    return nx * (cx - (a[0] + b[0]) / 2) + nz * (cz - (a[1] + b[1]) / 2) < 0 ? [-nx, -nz] : [nx, nz];
  });
}
// un polygone convexe dont chaque arête est décalée de d mètres vers le centre (d < 0 : vers le dehors) : les coins
// restent d'onglet (l'intersection des arêtes décalées), pas de bouts qui dépassent
function offsetPoly(pts, d) {
  const n = pts.length;
  const N = edgeNormals(pts);
  const L = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    return [a[0] + N[i][0] * d, a[1] + N[i][1] * d, b[0] - a[0], b[1] - a[1]];
  });
  return pts.map((_, i) => {
    const A = L[(i + n - 1) % n];
    const B = L[i];
    const den = A[2] * B[3] - A[3] * B[2];
    if (Math.abs(den) < 1e-9) return [B[0], B[1]];
    const t = ((B[0] - A[0]) * B[3] - (B[1] - A[1]) * B[2]) / den;
    return [A[0] + A[2] * t, A[1] + A[3] * t];
  });
}

// le constructeur : des listes de sommets par matière, chaque triangle tourné vers sa normale, ses coordonnées de
// texture prises sur le monde
// wells : les escaliers hors de la bande des cours ([x, z]) : par leur trémie aussi, on voit l'autre étage
function makeBuilder(MATS, wells = []) {
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
  // les triangles d'une géométrie (sans index), rangés par dalle d'après leur centre
  // (en z : trois bandes, au nord des cours, les cours et le mail, au sud : seule celle du milieu se voit d'un étage à l'autre)
  const byChunk = (geo, S = 55) => {
    const P = geo.attributes.position.array;
    const N = geo.attributes.normal.array;
    const U = geo.attributes.uv.array;
    const sets = new Map();
    for (let t = 0; t < P.length / 9; t++) {
      const o = t * 9;
      const z = (P[o + 2] + P[o + 5] + P[o + 8]) / 3;
      const key = Math.floor((P[o] + P[o + 3] + P[o + 6]) / (3 * S)) * 8 + (z < OPEN_Z0 ? 0 : z < OPEN_Z1 ? 1 : 2 + Math.min(2, Math.floor((z - OPEN_Z1) / 46)));
      (sets.get(key) || sets.set(key, []).get(key)).push(t);
    }
    return [...sets.entries()].map(([key, tris]) => {
      const p = new Float32Array(tris.length * 9);
      const n = new Float32Array(tris.length * 9);
      const u = new Float32Array(tris.length * 6);
      tris.forEach((t, i) => {
        p.set(P.subarray(t * 9, t * 9 + 9), i * 9);
        n.set(N.subarray(t * 9, t * 9 + 9), i * 9);
        u.set(U.subarray(t * 6, t * 6 + 6), i * 6);
      });
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(p, 3));
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(u, 2));
      g.computeBoundingBox();
      const bb = g.boundingBox;
      g.userData.inner = key % 8 !== 1 && !wells.some(([x, z]) => x > bb.min.x - WELL_R && x < bb.max.x + WELL_R && z > bb.min.z - WELL_R && z < bb.max.z + WELL_R);
      return g;
    });
  };
  // un tube rond de rayon r, de A à B (une main courante)
  const tube = (k, A, B, r, seg = 10) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    if (L < 1e-3) return;
    const g = new THREE.CylinderGeometry(r, r, L, seg).rotateX(Math.PI / 2);
    tmpO.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2);
    tmpO.up.set(0, 1, 0);
    tmpO.lookAt(B[0], B[1], B[2]);
    tmpO.updateMatrix();
    g.applyMatrix4(tmpO.matrix);
    add(k, g);
  };
  const inner = []; // les dalles qu'on ne voit pas d'un autre étage
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
      // une matière lourde est découpée en dalles de 60 m : ce qui est hors champ (ou trop loin) n'est pas dessiné
      for (const g of geo.attributes.position.count > 18000 && !geo.index ? byChunk(geo) : [geo]) {
        const mesh = new THREE.Mesh(g, MATS[k].m);
        if (MATS[k].order) mesh.renderOrder = MATS[k].order;
        if (g.userData.inner) inner.push(mesh);
        group.add(mesh);
      }
    }
  };
  return { tri, quad, hpoly, vface, box, beam, tube, add, build, inner };
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
    carpetFun: { m: baked(lam({ map: tx.carpetArcade })), S: 2.6 },
    carpetV: { m: baked(lam({ map: tx.carpetViolet })), S: 1.5 },
    // l'annexe : un grès brun des années 70 (une aile plus ancienne)
    annexTile: { m: baked(phong({ map: tx.annexTile, specular: '#1c1a16', shininess: 30 }), { spec: 0.3, gloss: 80, mask: 0 }), S: 2.1 },
    lino: { m: baked(phong({ map: tx.lino, specular: '#1c1a16', shininess: 30 }), { spec: 0.35, gloss: 90, mask: 0 }), S: 2.4 },
    quarry: { m: baked(phong({ map: tx.quarry, specular: '#1c1a16', shininess: 30 }), { spec: 0.25, gloss: 70, mask: 0 }), S: 3.0 },
    concrete: { m: baked(lam({ map: tx.concrete })), S: 2.5 },
    wood: { m: baked(phong({ map: tx.wood, specular: '#241b12', shininess: 40 }), { spec: 0.3, gloss: 70, mask: 0 }), S: 2.0 },
    woodFront: { m: baked(phong({ map: tx.wood, color: '#b06c40', specular: '#241b12', shininess: 40 }), { spec: 0.3, gloss: 70, mask: 0 }), S: 1.6 },
    faience: { m: baked(phong({ map: tx.faience, specular: '#3a3a3a', shininess: 80 }), { spec: 0.35, gloss: 140, mask: 0 }), S: 2.0 },
    plaster: { m: baked(lam({ map: tx.plaster })), S: 2.5 },
    paintGrey: { m: baked(lam({ map: tx.paintGrey })), S: 2.5 },
    paintDark: { m: baked(lam({ map: tx.paintDark })), S: 2.5 },
    paintChar: { m: baked(lam({ map: tx.paintChar })), S: 2.5 },
    block: { m: baked(lam({ map: tx.block })), S: 2.5 },
    ceilTiles: { m: baked(lam({ map: tx.ceilTiles })), S: 2.5 },
    slab: { m: baked(lam({ map: tx.slab })), S: 2.5 },
    paper: { m: baked(lam({ map: tx.paper })), S: 2.5 },
    // la verrière la nuit : le ciel noir ne prend pas la lumière des lampes
    sky: { m: new THREE.MeshBasicMaterial({ map: tx.skyGlass, color: '#8f98a3' }), S: 3.0 },
    trim: { m: baked(phong({ color: '#ebe7dc', specular: '#2e2b26', shininess: 40 }), { spec: 0.35, gloss: 60, mask: 0 }), S: 1 },
    // la main courante des garde-corps : un tube de laiton poli, qui accroche toutes les lampes
    rail: { m: baked(phong({ color: '#8f7a52', specular: '#fff0c8', shininess: 140 }), { spec: 1.3, gloss: 260, mask: 0 }), S: 1 },
    // le bronze sombre des suspensions
    bronze: { m: baked(phong({ color: '#2a2219', specular: '#8a6a3a', shininess: 60 }), { spec: 0.5, gloss: 90, mask: 0 }), S: 1 },
    brass: { m: baked(phong({ color: '#7d5f2c', specular: '#c9a060', shininess: 80 }), { spec: 0.7, gloss: 110, mask: 0 }), S: 1 },
    steel: { m: baked(phong({ color: '#7f8286', specular: '#c4c8cc', shininess: 70 }), { spec: 0.6, gloss: 110, mask: 0 }), S: 1 },
    black: { m: baked(phong({ color: '#151515', specular: '#3a3a3a', shininess: 50 })), S: 1 },
    marbleDark: { m: baked(phong({ color: '#2a2521', specular: '#4a4540', shininess: 70 }), { spec: 0.45, gloss: 120, mask: 0 }), S: 1 },
    grille: { m: baked(lam({ map: tx.grille, alphaTest: 0.45, side: THREE.DoubleSide, color: '#bdbbb4' })), S: 0.5 },
    glass: { m: new THREE.MeshPhongMaterial({ color: '#0b1214', transparent: true, opacity: 0.2, specular: '#8fa6ae', shininess: 120, depthWrite: false, side: THREE.DoubleSide }), S: 1, order: 2 },
    // les rubans de LED bleues du cinéma (plus forts que le blanc : ils bavent dans le caméscope)
    velvet: { m: baked(lam({ map: tx.velvet })), S: 0.9 },
    shutter: { m: baked(phong({ map: tx.shutter, specular: '#2c2c2c', shininess: 30 }), { spec: 0.3, gloss: 60, mask: 0 }), S: 2.0 },
    plate: { m: baked(phong({ map: tx.plate, specular: '#9a9ea4', shininess: 60 }), { spec: 0.55, gloss: 100, mask: 0 }), S: 1.2 },
    // les marches des escalators : de l'aluminium sombre, un liseré jaune
    escStep: { m: baked(phong({ color: '#303236', specular: '#8a8e94', shininess: 50 }), { spec: 0.4, gloss: 80, mask: 0 }), S: 1 },
    escYellow: { m: baked(lam({ color: '#c9a21e' })), S: 1 },
    banner: { m: baked(lam({ map: tx.banner, side: THREE.DoubleSide })), S: 1 },
    led: { m: new THREE.MeshBasicMaterial({ color: new THREE.Color('#86a8ff').multiplyScalar(3.0) }), S: 1 },
    // les petits spots des gradins de la lanterne (cour est)
    lampW: { m: new THREE.MeshBasicMaterial({ color: new THREE.Color('#fff0d4').multiplyScalar(3.2) }), S: 1 },
  };
}

// le revêtement du sol d'une salle
function floorKey(r, fi, shops, x, z) {
  if (!r) return 'concrete';
  // (un tapis de carrelage incrusté : une terre cuite, bordée d'un filet noir)
  if (r.rugs && r.rugs.some((q) => x >= q.x0 && x <= q.x1 && z >= q.z0 && z <= q.z1)) return 'quarry';
  switch (r.kind) {
    case 'mail':
    case 'court':
      // (en bas : le même carrelage crème à cabochons, bordé d'une bande de damier le long des boutiques et autour des cours)
      if (fi === 1 && (z === r.z0 || z === r.z1 || (r.kind === 'court' && (x === r.x0 || x === r.x1)))) return 'checker';
      return 'terrazzo';
    case 'portal':
      return 'terrazzo';
    case 'plaza':
    case 'lobby':
      return 'terrazzo';
    case 'shop': {
      const sh = shops[r.shop];
      if (sh && sh.state === 'gutted') return 'concrete';
      return ['wood', 'lino', 'carpetD', 'terrazzo', 'wood'][((r.shop || 0) * 7 + fi * 3) % 5];
    }
    case 'food':
    case 'garden':
      return 'quarry';
    case 'store':
    case 'closed':
    case 'market':
      return 'lino';
    case 'annex':
      return 'annexTile';
    case 'flea':
      return 'wood';
    case 'cine':
      return 'cine';
    case 'fun':
      return 'carpetFun';
    case 'cineHall':
    case 'screen':
    case 'office':
      return 'carpetD';
    case 'booth':
      return 'lino';
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
    case 'annex':
      return 'plaster';
    case 'service':
    case 'dock':
    case 'parking':
    case 'storage':
      return 'block';
    case 'cine':
    case 'cineHall':
    case 'screen':
    case 'fun':
      return 'paintDark';
    case 'wc':
      return 'faience';
    default:
      return 'paintGrey';
  }
}
const CEIL_KEY = { char: 'paintChar', greyc: 'paintGrey', coffer: 'plaster', soffit: 'plaster', vault: 'plaster', dome: 'plaster', grid: 'ceilTiles', slab: 'slab', black: 'paintDark', spots: 'paintGrey', sky: 'sky', lantern: 'sky' };

// Les couleurs des lampes du mall (plus fortes que le blanc : le caméscope sature)
export const MALL_ON = {
  warm: new THREE.Color('#ffe2b4').multiplyScalar(3.0),
  spot: new THREE.Color('#fff0d4').multiplyScalar(3.4),
  cool: new THREE.Color('#e6f0ff').multiplyScalar(3.0),
  glow: new THREE.Color('#f2f5ff').multiplyScalar(2.0),
};
export const MALL_OFF = new THREE.Color('#4a453c');
export const mallOnCol = (l) => (l.kind === 'cove' || l.kind === 'pendant' || l.kind === 'sconce' ? MALL_ON.warm : l.kind === 'panel' || l.kind === 'tube' ? MALL_ON.cool : l.kind === 'glow' ? MALL_ON.glow : MALL_ON.spot);

export function buildMall({ map, fi, floors, group, baked, tx }) {
  const W = map.W;
  const H = map.H;
  const up = floors[0];
  const MATS = makeMaterials(tx, baked);
  MATS.__tx = tx; // (les tissus des vêtements, view/mallProps.js)
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
      .map((p) => [p.x - X0, p.z - Z0, 4.4]);
    const m = baked(new THREE.MeshLambertMaterial({ map: cinemaCarpet(w, h, discs, null) }));
    MATS.cine = { m, uv: (p) => [(p[0] - X0) / w, 1 - (p[2] - Z0) / h] };
    tx.ready.then(() => {
      const old = m.map;
      m.map = cinemaCarpet(w, h, discs, tx.carpetImg);
      m.needsUpdate = true;
      old.dispose();
    });
  }
  const wells = (map.stairs || []).filter((st) => st.cz < OPEN_Z0 || st.cz > OPEN_Z1).map((st) => [st.cx, st.cz]);
  const G = makeBuilder(MATS, wells);

  // --- Les plafonds : hauteur et genre case par case ---
  const VZ0 = Math.round((map.mailZ - 2 * C) / C); // les quatre cases du milieu du mail (la lanterne, au-dessus du vide)
  const VZ1 = VZ0 + 3;
  const ceilAt = (x, z) => {
    const r = roomOf(x, z);
    if (!r) return { h: 3.0, kind: 'slab', r: null };
    if (fi === 0 && r.kind === 'mail' && z >= VZ0 && z <= VZ1) return { h: LANTERN, kind: 'lantern', r };
    if (r.vault) return { h: r.vault.base, kind: r.kind === 'plaza' ? 'spots' : 'vault', r };
    // (le hall du cinéma : un plateau surélevé au milieu de son plafond bas)
    if (r.tray && x >= r.tray.x0 && x <= r.tray.x1 && z >= r.tray.z0 && z <= r.tray.z1) return { h: r.tray.h, kind: r.ceil, r };
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
        // (la moquette à motif du hall du cinéma est peinte pour sa salle : dans le passage qui y mène, la même laine, unie)
        const fk0 = floorKey(r, fi, map.shops, x, z);
        const fk = fk0 === 'cine' && (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) ? 'carpetV' : fk0;
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
        // (les retombées d'un plateau, au milieu d'une salle : peintes comme son plafond)
        const k = ce.kind === 'lantern' || ceilAt(nx, nz).kind === 'lantern' ? 'plaster' : r && r.tray && roomOf(nx, nz) === r ? CEIL_KEY[r.ceil] : wallKey(hi);
        // la face, sur le bord commun ; tournée vers la case la plus haute
        const s = h1 > h2 ? -1 : 1; // +1 : vers la voisine
        if (dx) G.vface(k, (x + 1) * C, z * C, (x + 1) * C, (z + 1) * C, Math.min(h1, h2), Math.max(h1, h2), s, 0);
        else G.vface(k, x * C, (z + 1) * C, (x + 1) * C, (z + 1) * C, Math.min(h1, h2), Math.max(h1, h2), 0, s);
      }
    }
  }

  // 1b. Le filet noir autour des tapis de carrelage
  for (const r of rooms)
    for (const q of r.rugs || []) {
      const x0 = q.x0 * C;
      const x1 = (q.x1 + 1) * C;
      const z0 = q.z0 * C;
      const z1 = (q.z1 + 1) * C;
      for (const z of [z0, z1]) G.box('black', x0 - 0.04, x1 + 0.04, 0, 0.004, z - 0.04, z + 0.04, '-y');
      for (const x of [x0, x1]) G.box('black', x - 0.04, x + 0.04, 0, 0.004, z0 + 0.04, z1 - 0.04, '-y');
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
        // la plinthe : marbre noir dans les galeries, plinthe noire ailleurs (pas dans les coulisses)
        if (y0 === 0 && k !== 'block' && k !== 'faience') {
          // (au cinéma : une plinthe d'inox brossé)
          const rk = (roomOf(nx, nz) || {}).kind;
          const pk = k === 'plaster' ? 'marbleDark' : rk === 'cine' || rk === 'cineHall' ? 'steel' : 'black';
          const ph = k === 'plaster' ? 0.16 : pk === 'steel' ? 0.13 : 0.1;
          if (ex !== null) G.box(pk, Math.min(ex, ex + dx * 0.018), Math.max(ex, ex + dx * 0.018), 0, ph, z * C, (z + 1) * C, '-y');
          else G.box(pk, x * C, (x + 1) * C, 0, ph, Math.min(ez, ez + dz * 0.018), Math.max(ez, ez + dz * 0.018), '-y');
        }
      }
    }
  }

  // 2b. Les portes de service, des coulisses, de secours et des salles : un linteau à 2,40 m (le mur reprend
  // au-dessus) et un chambranle d'acier de chaque côté de l'épaisseur du mur
  for (const d of map.doors || []) {
    if (d.kind === 'passage') continue;
    const h = hAt(d.x, d.z);
    const wallX = map.grid[d.z * W + d.x - 1] === T.WALL || map.grid[d.z * W + d.x + 1] === T.WALL; // le mur court le long de x
    const DOOR_H = 2.4;
    const x0 = d.x * C;
    const z0 = d.z * C;
    if (h > DOOR_H) G.box(wallKey(roomOf(d.x, d.z)), x0, x0 + C, DOOR_H, h, z0, z0 + C, '+y');
    const fk = d.kind === 'fire' ? 'black' : 'steel';
    for (const e of [0, C]) {
      if (wallX) {
        for (const x of [x0 + 0.04, x0 + C - 0.04]) G.box(fk, x - 0.04, x + 0.04, 0, DOOR_H, z0 + e - 0.03, z0 + e + 0.03, '-y');
        G.box(fk, x0, x0 + C, DOOR_H - 0.06, DOOR_H, z0 + e - 0.03, z0 + e + 0.03);
      } else {
        for (const z of [z0 + 0.04, z0 + C - 0.04]) G.box(fk, x0 + e - 0.03, x0 + e + 0.03, 0, DOOR_H, z - 0.04, z + 0.04, '-y');
        G.box(fk, x0 + e - 0.03, x0 + e + 0.03, DOOR_H - 0.06, DOOR_H, z0, z0 + C);
      }
    }
  }

  // 3. Les plafonds des cours (étage du haut) : une corniche moulurée autour de l'ouverture (elle cache la gorge
  // lumineuse), un tambour droit lavé par sa lumière, un plafond à caissons sous de hautes poutres blanches ; à la
  // cour centrale, la lanterne vitrée au sommet
  const glowGeos = []; // le plafond lumineux de la place est : une lampe (fixtures)
  // une moulure : un profil ([d0, y0, d1, y1, hd, hy] : d vers le centre, y depuis la hauteur donnée, (hd, hy) : vers
  // où regarde la face) balayé le long du contour, d'onglet aux angles
  const molding = (pts, y, prof, k) => {
    const N = edgeNormals(pts);
    const rings = new Map();
    const ringAt = (d) => rings.get(d) || rings.set(d, offsetPoly(pts, d)).get(d);
    for (const [d0, y0, d1, y1, hd, hy] of prof) {
      const A = ringAt(d0);
      const B = ringAt(d1);
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        G.quad(k, [A[i][0], y + y0, A[i][1]], [A[j][0], y + y0, A[j][1]], [B[j][0], y + y1, B[j][1]], [B[i][0], y + y1, B[i][1]], [hd * N[i][0], hy, hd * N[i][1]]);
      }
    }
  };
  // la corniche d'une ouverture : deux ressauts sous le plafond de la galerie, une lèvre qui cache la gorge lumineuse
  const CORNICE = [[-0.24, 0, -0.24, -0.1, -1, 0], [-0.24, -0.1, -0.1, -0.1, 0, -1], [-0.1, -0.1, -0.1, -0.27, -1, 0], [-0.1, -0.27, 0.1, -0.27, 0, -1], [0.1, -0.27, 0.1, 0.05, 1, 0], [0.1, 0.05, 0, 0.05, 0, 1]];
  for (const vo of vaults) {
    const { r, O1 } = vo;
    const V = r.vault;
    const [cx, cz] = vo.c;
    const ring = (pts, y0, y1, k) => {
      const N = edgeNormals(pts);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        G.vface(k, a[0], a[1], b[0], b[1], y0, y1, N[i][0], N[i][1]);
      }
    };
    molding(O1, V.base, CORNICE, 'trim');
    // la charpente du plafond, comme au centre de référence : de hautes poutres blanches, un anneau et des rayons, des
    // caissons entre elles ; les poutres finissent dans les murs du tambour (rien ne dépasse)
    const frame = (outer, innerPts, y, deep) => {
      for (let i = 0; i < outer.length; i++) {
        const o = outer[i];
        const n = innerPts ? innerPts[i] : [cx, cz];
        const l = Math.hypot(o[0] - n[0], o[1] - n[1]) || 1;
        // (le bout du rayon entre de 15 cm dans le mur)
        G.beam('trim', [n[0], y - deep / 2, n[1]], [o[0] + ((o[0] - n[0]) / l) * 0.15, y - deep / 2, o[1] + ((o[1] - n[1]) / l) * 0.15], 0.42, deep);
      }
    };
    const hoop = (pts, y, deep, w = 0.36) => {
      for (let i = 0; i < pts.length; i++) {
        const a2 = pts[i];
        const b2 = pts[(i + 1) % pts.length];
        G.beam('trim', [a2[0], y - deep / 2, a2[1]], [b2[0], y - deep / 2, b2[1]], w, deep);
      }
    };
    const scale = (pts, k) => pts.map(([x, z]) => [cx + (x - cx) * k, cz + (z - cz) * k]);
    if (V.ring) {
      // la cour centrale : le tambour, un plafond à caissons en couronne, et au milieu la lanterne vitrée
      const O2 = shrinkTo(vo.v.pts, V.inner);
      ring(O1, V.base, V.ring, 'plaster');
      for (const p of convexMinus(O1, O2)) G.hpoly('plaster', p, V.ring, -1);
      frame(O1, O2, V.ring, 0.75);
      hoop(O2, V.ring, 0.75, 0.42);
      hoop(scale(O1, 0.5 + (0.5 * V.inner) / Math.hypot(O1[0][0] - cx, O1[0][1] - cz)), V.ring, 0.45);
      ring(O2, V.ring, V.top, 'plaster');
      G.hpoly('sky', O2, V.top, -1);
      // les fers blancs de la verrière : huit rayons et deux anneaux
      frame(O2, null, V.top, 0.22);
      for (const k of [0.4, 0.75]) hoop(scale(O2, k), V.top, 0.18, 0.1);
    } else if (V.glow) {
      // la lanterne à gradins de la cour est (comme au centre de référence) : des ressauts qui montent en se
      // resserrant, piqués de petits spots, jusqu'au plafond lumineux (une lampe)
      const n = V.steps || 3;
      const tr = V.tread || 0.8;
      const rise = (V.top - V.base) / n;
      const prof = [];
      for (let i = 0; i < n; i++) {
        prof.push([i * tr, i * rise, i * tr, (i + 1) * rise, 1, 0]);
        if (i < n - 1) prof.push([i * tr, (i + 1) * rise, (i + 1) * tr, (i + 1) * rise, 0, -1]);
      }
      molding(O1, V.base, prof, 'plaster');
      for (let i = 1; i < n; i++) {
        const A = offsetPoly(O1, (i - 0.5) * tr);
        for (let e = 0; e < A.length; e++) {
          const a2 = A[e];
          const b2 = A[(e + 1) % A.length];
          const m = Math.max(1, Math.round(Math.hypot(b2[0] - a2[0], b2[1] - a2[1]) / 1.7));
          for (let j = 0; j < m; j++) G.add('lampW', new THREE.CylinderGeometry(0.05, 0.05, 0.012, 12).translate(a2[0] + ((b2[0] - a2[0]) * (j + 0.5)) / m, V.base + i * rise - 0.006, a2[1] + ((b2[1] - a2[1]) * (j + 0.5)) / m));
        }
      }
      const In = offsetPoly(O1, (n - 1) * tr);
      const g = new THREE.BufferGeometry();
      const pos = [];
      for (let i = 1; i < In.length - 1; i++) pos.push(In[0][0], V.top, In[0][1], In[i][0], V.top, In[i][1], In[i + 1][0], V.top, In[i + 1][1]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.computeVertexNormals();
      glowGeos.push(g); // (dessiné des deux côtés)
      // le cadre du diffuseur, ses traverses
      hoop(In, V.top, 0.05, 0.1);
      const b = bbox(In);
      for (let x = b.x0 + (b.x1 - b.x0) / 4; x < b.x1 - 0.5; x += (b.x1 - b.x0) / 4) G.beam('trim', [x, V.top - 0.02, b.z0], [x, V.top - 0.02, b.z1], 0.05, 0.04);
    } else {
      // la cour ouest : le tambour, un plafond plat, sa charpente (huit rayons, un anneau à mi-portée), le lustre au moyeu
      ring(O1, V.base, V.top, 'plaster');
      G.hpoly('plaster', O1, V.top, -1);
      frame(O1, null, V.top, 0.8);
      hoop(scale(O1, 0.52), V.top, 0.55);
      G.add('trim', new THREE.CylinderGeometry(0.75, 0.75, 0.84, 8).rotateY(Math.PI / 8).translate(cx, V.top - 0.42, cz));
      // deux bannières de toile pendues dans le vide, à leurs câbles (une barre en haut, une en bas)
      for (const [dz, half] of [[-3.4, 0], [3.4, 1]]) {
        const bx = cx - 5.2;
        const y1 = V.top - 0.85;
        const y0 = y1 - 6.4;
        const g = new THREE.PlaneGeometry(1.25, 6.4).rotateY(Math.PI / 2);
        const u = g.attributes.uv;
        for (let i = 0; i < u.count; i++) u.setX(i, half * 0.5 + u.getX(i) * 0.5);
        G.add('banner', g.translate(bx, (y0 + y1) / 2, cz + dz));
        for (const y of [y0, y1]) G.add('steel', new THREE.CylinderGeometry(0.02, 0.02, 1.35, 8).rotateX(Math.PI / 2).translate(bx, y, cz + dz));
        for (const e of [-0.6, 0.6]) G.add('black', new THREE.CylinderGeometry(0.006, 0.006, 0.85, 4).translate(bx, y1 + 0.425, cz + dz + e));
      }
    }
  }

  // 4. Le mail du haut : les caissons (des poutres tous les 5 m, sous le plafond à 5,60 m)
  if (fi === 0) {
    for (const r of rooms) {
      if (r.kind !== 'mail') continue;
      for (let x = r.x0 * C + 5; x < (r.x1 + 1) * C - 0.1; x += 5) {
        for (const [z0, z1] of [[r.z0 * C, VZ0 * C], [(VZ1 + 1) * C, (r.z1 + 1) * C]]) G.box('plaster', x - 0.22, x + 0.22, r.ceilH - 0.55, r.ceilH, z0, z1, '+y');
      }
      // les lanternes : des fers tous les 2,5 m
      for (let x = r.x0 * C + C; x < (r.x1 + 1) * C; x += C) G.beam('trim', [x, LANTERN - 0.08, VZ0 * C], [x, LANTERN - 0.08, (VZ1 + 1) * C], 0.09, 0.16);
      G.beam('trim', [r.x0 * C, LANTERN - 0.08, (VZ0 + 2) * C], [(r.x1 + 1) * C, LANTERN - 0.08, (VZ0 + 2) * C], 0.09, 0.16);
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
        G.tube('rail', [p0[0], y0 + MALL_RAIL + 0.02, p0[1]], [p1[0], y0 + MALL_RAIL + 0.02, p1[1]], 0.042); // la main courante
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
  const blues = []; // les rubans de LED bleues du cinéma (des feux de couleur)
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
      if (p.kind === 'cineHall') {
        // le couloir des salles : un grand disque blanc sous le plafond gris, ourlé d'une gorge lumineuse (cuite) ; un
        // pied d'inox brossé
        G.add('trim', new THREE.CylinderGeometry(1.75, 1.75, 0.14, 48).translate(p.x, top - 0.07, p.z));
        G.add('steel', new THREE.CylinderGeometry(h + 0.012, h + 0.012, 0.22, 28, 1, true).translate(p.x, 0.25, p.z));
      }
      if (p.kind === 'cine') {
        // (comme au multiplexe de référence) un grand disque blanc suspendu sous le plafond, un plus petit dessous
        // contre le fût ; quatre spots sous le grand (des lampes), trois suspentes
        const yd = Math.min(3.3, top - 0.6);
        G.add('trim', new THREE.CylinderGeometry(2.7, 2.7, 0.3, 56).translate(p.x, yd + 0.15, p.z));
        G.add('trim', new THREE.CylinderGeometry(1.2, 1.2, 0.2, 40).translate(p.x, yd - 0.1, p.z));
        for (let i = 0; i < 3; i++) {
          const a = i * 2.094 + 0.5;
          G.add('black', new THREE.CylinderGeometry(0.012, 0.012, top - yd - 0.3, 6).translate(p.x + Math.cos(a) * 2.2, (top + yd + 0.3) / 2, p.z + Math.sin(a) * 2.2));
        }
      }
      continue;
    }
    const fancy = p.kind === 'mail' || p.kind === 'court';
    const sk = fancy ? 'plaster' : p.kind === 'dock' ? 'block' : 'paintGrey';
    G.box(sk, p.x - h, p.x + h, 0, fancy ? top - 0.1 : top, p.z - h, p.z + h, fancy ? '-y' : '+y-y');
    G.box('marbleDark', p.x - h - 0.025, p.x + h + 0.025, 0, fancy ? 0.22 : 0.12, p.z - h - 0.025, p.z + h + 0.025, '-y');
    if (fancy) {
      // (des piliers nus, comme au centre de référence : un joint creux sous le plafond, rien d'autre)
      G.box('marbleDark', p.x - h + 0.02, p.x + h - 0.02, top - 0.1, top, p.z - h + 0.02, p.z + h - 0.02, '+y-y');
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

  // 6b. Le hall du cinéma : le ruban de LED qui fait le tour du plateau de son plafond (un profilé d'aluminium, la
  // bande lumineuse dessous). Sa lumière bleue : cuite sur le plafond (le troisième canal, view/scene.js), et des feux
  // de couleur qui tombent sur les retombées, les murs et la moquette
  let cineBox = null;
  if (cine && cine.tray) {
    cineBox = [cine.x0 * C - 0.25, cine.z0 * C - 0.25, (cine.x1 + 1) * C + 0.25, (cine.z1 + 1) * C + 0.25];
    const y = cine.tray.h;
    const L = ledLoop(cine.tray, C);
    for (let i = 0; i < L.length; i++) {
      const a = L[i];
      const b = L[(i + 1) % L.length];
      G.beam('steel', [a[0], y - 0.015, a[1]], [b[0], y - 0.015, b[1]], 0.1, 0.03);
      G.beam('led', [a[0], y - 0.04, a[1]], [b[0], y - 0.04, b[1]], 0.06, 0.022);
      const m = Math.max(1, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1]) / 11));
      for (let j = 0; j < m; j++) blues.push({ x: a[0] + ((b[0] - a[0]) * (j + 0.5)) / m, y: y - 0.45, z: a[1] + ((b[1] - a[1]) * (j + 0.5)) / m, rad: 13, k: 1.5 });
    }
  }

  // 7. Les escaliers ouverts (dessinés depuis l'étage du bas : ils montent jusqu'au sol du haut) : des marches de
  // terrazzo à nez de laiton entre deux limons pleins (crème, coiffés d'une lisse), sur lesquels posent les barreaux
  if (fi === 1) {
    for (const st of map.stairs || []) {
      const P = (u, v) => [st.ox + st.dx * u + st.px * v, st.oz + st.dz * u + st.pz * v];
      const lbox = (k, u0, u1, y0, y1, v0, v1, skip = '') => {
        const a = P(u0, v0);
        const b = P(u1, v1);
        G.box(k, Math.min(a[0], b[0]), Math.max(a[0], b[0]), y0, y1, Math.min(a[1], b[1]), Math.max(a[1], b[1]), skip);
      };
      // un quadrilatère dont la normale (calculée) regarde du côté donné
      const Q = (k, a, b, c, d, hint) => {
        const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
        const e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
        let n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
        const l = Math.hypot(n[0], n[1], n[2]) || 1;
        n = n.map((x) => x / l);
        if (n[0] * hint[0] + n[1] * hint[1] + n[2] * hint[2] < 0) n = n.map((x) => -x);
        G.quad(k, a, b, c, d, n);
      };
      // un limon : une planche de v0 à v1, de u0 à u1, entre deux lignes (son dessous de yb0 à yb1, son dessus de yt0
      // à yt1), coiffée d'une lisse
      const board = (u0, u1, v0, v1, yb0, yt0, yb1, yt1) => {
        const pt = (u, v, y) => {
          const p = P(u, v);
          return [p[0], y, p[1]];
        };
        const side = [st.px, 0, st.pz];
        Q('plaster', pt(u0, v0, yb0), pt(u1, v0, yb1), pt(u1, v0, yt1), pt(u0, v0, yt0), side.map((x) => -x));
        Q('plaster', pt(u0, v1, yb0), pt(u1, v1, yb1), pt(u1, v1, yt1), pt(u0, v1, yt0), side);
        Q('plaster', pt(u0, v0, yb0), pt(u1, v0, yb1), pt(u1, v1, yb1), pt(u0, v1, yb0), [0, -1, 0]);
        Q('plaster', pt(u0, v0, yb0), pt(u0, v1, yb0), pt(u0, v1, yt0), pt(u0, v0, yt0), [-st.dx, 0, -st.dz]);
        Q('plaster', pt(u1, v0, yb1), pt(u1, v1, yb1), pt(u1, v1, yt1), pt(u1, v0, yt1), [st.dx, 0, st.dz]);
        // la lisse : un peu plus large que la planche, 3 cm d'épaisseur
        const w0 = v0 - 0.015;
        const w1 = v1 + 0.015;
        Q('trim', pt(u0, w0, yt0 + 0.03), pt(u1, w0, yt1 + 0.03), pt(u1, w1, yt1 + 0.03), pt(u0, w1, yt0 + 0.03), [0, 1, 0]);
        Q('trim', pt(u0, w0, yt0), pt(u1, w0, yt1), pt(u1, w0, yt1 + 0.03), pt(u0, w0, yt0 + 0.03), side.map((x) => -x));
        Q('trim', pt(u0, w1, yt0), pt(u1, w1, yt1), pt(u1, w1, yt1 + 0.03), pt(u0, w1, yt0 + 0.03), side);
        Q('trim', pt(u0, w0, yt0), pt(u1, w0, yt1), pt(u1, w1, yt1), pt(u0, w1, yt0), [0, -1, 0]);
      };
      const N = 16;
      const t = (2 * C) / N;
      const RISE = FLOOR_DY / 2 / N; // 20 cm
      const MID = FLOOR_DY / 2;
      const PAR = 1.0; // la hauteur des parapets pleins, au-dessus de la ligne des nez de marche
      const TH = 0.14; // leur épaisseur
      const TOP = 15 * t; // (la dernière marche de chaque volée est de plain-pied avec le palier ou l'étage)
      // la première volée : des marches pleines, du sol au palier ; un nez de laiton à chaque marche
      for (let k = 0; k < N; k++) {
        lbox('terrazzo', k * t, (k + 1) * t, 0, (k + 1) * RISE, 0.01, C - 0.01, '-y');
        lbox('brass', k * t - 0.012, k * t + 0.04, (k + 1) * RISE - 0.028, (k + 1) * RISE + 0.004, 0.07, C - 0.07, '-y');
      }
      // le palier, sur un massif crème
      lbox('terrazzo', 2 * C, 3 * C, MID - 0.1, MID, 0, 2 * C, '-y');
      lbox('plaster', 2 * C, 3 * C, 0, MID - 0.1, 0, 2 * C, '+y-y');
      // la seconde volée : des marches posées sur une dalle en pente
      for (let k = 0; k < N; k++) {
        lbox('terrazzo', k * t, (k + 1) * t, FLOOR_DY - (k + 1) * RISE, FLOOR_DY - k * RISE, C + 0.01, 2 * C - 0.01, '-y');
        lbox('brass', (k + 1) * t - 0.04, (k + 1) * t + 0.012, FLOOR_DY - k * RISE - 0.028, FLOOR_DY - k * RISE + 0.004, C + 0.07, 2 * C - 0.07, '-y');
      }
      const slope = (u) => FLOOR_DY - (u / (2 * C)) * MID;
      const soff = (u) => slope(u) - RISE - 0.28;
      {
        const a = P(0, C);
        const b = P(2 * C, C);
        const c = P(2 * C, 2 * C);
        const d = P(0, 2 * C);
        G.quad('plaster', [a[0], soff(0), a[1]], [b[0], soff(2 * C), b[1]], [c[0], soff(2 * C), c[1]], [d[0], soff(0), d[1]], [-st.dx * 0.54, -0.84, -st.dz * 0.54]);
      }
      // les lignes des nez de marche : la première volée monte de (0 ; 0,20) à (TOP ; palier), la seconde descend de
      // (t ; étage) à (2C ; palier + 0,20)
      const n1 = (u) => RISE + (Math.min(u, TOP) / t) * RISE;
      const n2 = (u) => FLOOR_DY - ((Math.max(u, t) - t) / t) * RISE;
      // les parapets pleins, blancs (comme l'escalier monumental du centre de référence) : la première volée jusqu'au
      // sol, la seconde du dessous de sa dalle jusqu'à hauteur d'appui ; une lisse de pierre les coiffe
      for (const [v0, v1] of [[-0.02, TH - 0.02], [C - TH, C]]) {
        board(0, TOP, v0, v1, 0, n1(0) + PAR, 0, n1(TOP) + PAR);
        board(TOP, 2 * C, v0, v1, 0, n1(TOP) + PAR, 0, n1(TOP) + PAR);
      }
      for (const [v0, v1] of [[C, C + TH], [2 * C - TH + 0.02, 2 * C + 0.02]]) {
        board(0, t, v0, v1, soff(0), n2(0) + PAR, soff(t), n2(t) + PAR);
        board(t, 2 * C, v0, v1, soff(t), n2(t) + PAR, soff(2 * C), n2(2 * C) + PAR);
      }
      // le palier : un parapet sur ses trois côtés libres
      board(2 * C, 3 * C, -0.02, TH - 0.02, MID - 0.1, MID + PAR, MID - 0.1, MID + PAR);
      board(2 * C, 3 * C, 2 * C - TH + 0.02, 2 * C + 0.02, MID - 0.1, MID + PAR, MID - 0.1, MID + PAR);
      lbox('plaster', 3 * C - TH, 3 * C, MID, MID + PAR, TH - 0.02, 2 * C - TH + 0.02, '-y');
      lbox('trim', 3 * C - TH - 0.015, 3 * C + 0.015, MID + PAR, MID + PAR + 0.03, -0.02, 2 * C + 0.02);
      // une main courante ronde, sur de courts potelets, du côté du mur de chaque volée
      const hand = (u0, v, y0, u1, y1) => {
        const a = P(u0, v);
        const b = P(u1, v);
        G.tube('rail', [a[0], y0, a[1]], [b[0], y1, b[1]], 0.024, 8);
        const n = Math.max(1, Math.round(Math.abs(u1 - u0) / 1.1));
        for (let i = 0; i <= n; i++) {
          const f = i / n;
          G.box('steel', a[0] + (b[0] - a[0]) * f - 0.012, a[0] + (b[0] - a[0]) * f + 0.012, y0 + (y1 - y0) * f - 0.13, y0 + (y1 - y0) * f, a[1] + (b[1] - a[1]) * f - 0.012, a[1] + (b[1] - a[1]) * f + 0.012);
        }
      };
      hand(0.1, TH / 2 - 0.02, n1(0) + PAR + 0.16, TOP, n1(TOP) + PAR + 0.16);
      hand(2 * C, 2 * C - TH / 2 + 0.02, n2(2 * C) + PAR + 0.16, t, n2(t) + PAR + 0.16);
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
    G.box('plate', x0(0, e.land), x1(0, e.land), -0.02, 0.01, e.z - zIn, e.z + zIn, '-y');
    G.box('plate', x0(e.land + e.run, e.len), x1(e.land + e.run, e.len), e.rise - 0.02, e.rise + 0.01, e.z - zIn, e.z + zIn, '-y');
    // les marches
    const n = Math.round(e.rise / 0.2);
    const tr = e.run / n;
    for (let i = 0; i < n; i++) {
      const s0 = e.land + i * tr;
      const yt = (i + 1) * 0.2;
      G.box('escStep', x0(s0, s0 + tr), x1(s0, s0 + tr), yt - 0.2, yt, e.z - zIn, e.z + zIn, '-y');
      // le liseré jaune : au nez de la marche et le long des deux jupes
      G.box('escYellow', x0(s0, s0 + 0.03), x1(s0, s0 + 0.03), yt, yt + 0.002, e.z - zIn, e.z + zIn, '-y');
      for (const sd of [-1, 1]) G.box('escYellow', x0(s0 + 0.03, s0 + tr), x1(s0 + 0.03, s0 + tr), yt, yt + 0.002, e.z + sd * zIn - (sd > 0 ? 0.03 : 0), e.z + sd * zIn + (sd > 0 ? 0 : 0.03), '-y');
    }
    // les peignes, au raccord des paliers
    G.box('escYellow', x0(e.land - 0.05, e.land), x1(e.land - 0.05, e.land), 0.01, 0.014, e.z - zIn, e.z + zIn, '-y');
    G.box('escYellow', x0(e.land + e.run, e.land + e.run + 0.05), x1(e.land + e.run, e.land + e.run + 0.05), e.rise + 0.01, e.rise + 0.014, e.z - zIn, e.z + zIn, '-y');
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
    // (un demi-tour de la main courante autour d'un bout de verre arrondi, sur un prolongement du caisson)
    for (const sd of [-1, 1]) {
      const zg = e.z + sd * (hw - 0.03);
      const zs = e.z + sd * zIn;
      const zo = e.z + sd * (hw + 0.09);
      for (const [s, y, out] of [[0, 0, -e.dir], [e.len, e.rise, e.dir]]) {
        const x = xOf(s);
        G.add('black', new THREE.TorusGeometry(0.4, 0.045, 6, 14, Math.PI).rotateZ(out < 0 ? Math.PI / 2 : -Math.PI / 2).translate(x, y + 0.6, zg));
        G.add('glass', new THREE.CircleGeometry(0.37, 12, out < 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI).translate(x, y + 0.6, zg));
        G.box('steel', Math.min(x, x + out * 0.5), Math.max(x, x + out * 0.5), y, y + 0.2, Math.min(zs, zo), Math.max(zs, zo), '-y');
      }
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
    // quatre factures de devanture, comme au centre de référence : un encadrement de noyer (deux pilastres, un
    // linteau), un bandeau noir, un enduit crème à menuiseries blanches, un bandeau de marbre sombre
    const style = sh.id % 4;
    const bandK = style === 0 ? 'woodFront' : style === 1 ? 'black' : style === 2 ? 'plaster' : 'marbleDark';
    const lineK = style === 2 ? 'trim' : 'brass';
    G.box(bandK, xa, xb, HEAD, top, z - 0.14, z + 0.14, '+y');
    G.box(lineK, xa, xb, HEAD - 0.03, HEAD, z - 0.15, z + 0.15, '+y');
    if (sh.state === 'gutted') continue;
    const PIL = style === 0 ? 0.55 : 0;
    if (PIL)
      for (const [p0, p1] of [[xa, xa + PIL], [xb - PIL, xb]]) {
        G.box('woodFront', p0, p1, 0.16, HEAD - 0.03, z - 0.16, z + 0.16, '-y');
        G.box('marbleDark', p0, p1, 0, 0.16, z - 0.175, z + 0.175, '-y');
        G.box('brass', p0, p1, HEAD - 0.14, HEAD - 0.11, z - 0.165, z + 0.165);
      }
    const fa = xa + PIL;
    const fb = xb - PIL;
    if (sh.state === 'grille' && sh.id % 2 === 1) continue; // (un rideau métallique, view/mallProps.js)
    if (sh.state === 'grille') {
      // le rideau à mailles, baissé ; ses coulisses de part et d'autre
      G.vface('grille', fa + 0.06, z, fb - 0.06, z, 0, HEAD - 0.03, 0, out);
      for (const x of [fa + 0.04, fb - 0.04]) G.box('steel', x - 0.04, x + 0.04, 0, HEAD, z - 0.06, z + 0.06, '+y-y');
      continue;
    }
    // la vitrine : une allège (marbre noir, ou blanche), des glaces entre des montants (laiton, ou blancs), la porte
    // au milieu (open)
    const gap = sh.state === 'open' && sh.gap ? sh.gap : null;
    const spans = gap ? [[fa, gap[0]], [gap[1], fb]] : [[fa, fb]];
    const sillK = style === 2 ? 'trim' : 'marbleDark';
    for (const [s0, s1] of spans) {
      if (s1 - s0 < 0.2) continue;
      G.box(sillK, s0, s1, 0, 0.32, z - 0.06, z + 0.06, '-y');
      G.vface('glass', s0, z, s1, z, 0.32, HEAD - 0.03, 0, out);
      const m = Math.max(1, Math.round((s1 - s0) / 1.6));
      for (let j = 0; j <= m; j++) {
        const x = s0 + ((s1 - s0) * j) / m;
        G.box(lineK, x - 0.03, x + 0.03, 0.32, HEAD - 0.03, z - 0.04, z + 0.04, '+y-y');
      }
      // (menuiseries blanches : une traverse à hauteur d'imposte)
      if (style === 2) G.box('trim', s0, s1, HEAD - 0.62, HEAD - 0.57, z - 0.035, z + 0.035);
      // une vitrine sur deux, quand la boutique est fermée : du papier kraft collé derrière
      if (sh.state === 'glass' && sh.dark) G.vface('paper', s0 + 0.05, z - out * 0.06, s1 - 0.05, z - out * 0.06, 0.34, HEAD - 0.05, 0, out);
    }
    if (gap) for (const x of gap) G.box(lineK, x - 0.05, x + 0.05, 0, HEAD - 0.03, z - 0.06, z + 0.06, '+y-y');
  }
  // la grille du grand magasin fermé, sur toute la hauteur du passage
  for (const o of map.solids || []) {
    if (!o.gate) continue;
    const h = hAt(Math.floor(o.ax / C), Math.floor(o.az / C) - 1) || 4;
    G.vface('grille', o.ax, o.az, o.bx, o.bz, 0, h, 0, -1);
    G.box('steel', Math.min(o.ax, o.bx), Math.max(o.ax, o.bx), h - 0.35, h, o.az - 0.12, o.az + 0.12, '+y');
  }

  // 10. Le mobilier, les enseignes, les affiches (view/mallProps.js)
  // les modèles Poly Haven (CC0, backrooms/models) : une matière cuite par matière du modèle ; « @rust », « @dark »…
  // teintent la même photo
  const TINT = { dark: [0.45, 0.43, 0.42], rust: [0.7, 0.5, 0.36], red: [0.9, 0.3, 0.26], pale: [1.15, 1.12, 1.05] };
  const kitMats = new Map();
  const kit = createKitInstancer({
    group,
    // (les modèles très lourds pour leur taille ne se voient que de près)
    reach: {
      base: 16,
      k: 40,
      cap: {
        korean_public_payphone_01: 16, wheelchair_01: 18, old_gas_mask: 12, garden_hose_wall_mounted_01: 16, gamepad: 12, rubber_duck_toy: 18,
        desk_lamp_arm_01: 8, metal_office_desk: 25, cardboard_box_01: 11, SchoolChair_01: 21, modern_arm_chair_01: 18, GreenChair_01: 24, stationery_supplies: 8,
        Television_01: 26, wooden_broom: 12, plastic_broom: 12, modular_street_seating: 36, dead_quiver_trunk: 36, korean_fire_extinguisher_01: 14,
        modular_airduct_rectangular_01: 32, modular_electric_cables: 20,
        vintage_stapler: 7, clipboard: 8, office_notepads: 10, rubber_boots: 9, vintage_electric_kettle: 9, portable_generator: 22, power_box_01: 14,
        ceramic_vase_03: 10, ceramic_vase_04: 10, vintage_suitcase: 22, potted_plant_02: 22, metal_stool_02: 20, bar_chair_round_01: 14, tool_cart: 18,
        binder_notebook: 9, carrot_cake: 12, food_apple_01: 10, book_encyclopedia_set_01: 14, anthurium_botany_01: 22, vintage_crutches_01: 16,
        alarm_clock_01: 10, vintage_pocket_watch: 8, digital_wrist_watch: 8, pot_enamel_01: 11, brass_pan_01: 12, padlock: 12,
        round_spectacles: 10, jug_01: 11, brass_vase_03: 14, croissant: 10, medical_box: 14, american_football: 16, concrete_cat_statue: 18,
      },
    },
    convert: (src, kitName, piece, variant) => {
      const key = src.uuid + '@' + variant;
      if (!kitMats.has(key)) {
        const color = src.color ? src.color.clone().multiplyScalar(0.85) : new THREE.Color('#888888');
        if (TINT[variant]) color.multiply(new THREE.Color(...TINT[variant]));
        const m = new THREE.MeshLambertMaterial({ map: src.map || null, color, alphaTest: src.alphaTest || (src.transparent ? 0.5 : 0), side: src.side });
        kitMats.set(key, { mat: baked(m) });
      }
      return kitMats.get(key);
    },
  });
  // model(nom, x, y, z, lacet, échelle, roulis x, roulis z, morceaux) : « * » le modèle entier, « a+b » ces morceaux,
  // « a » un seul morceau recentré
  // (chaque modèle posé laisse sa place aux murs habillés : un rayon, plus grand pour les rideaux et les meubles hauts)
  const placed = [];
  let wasHere = true;
  const WIDE = { rollershutter_door: 1.7, rollershutter_window_01: 2.7, korean_public_payphone_01: 0.6, drawer_cabinet: 0.7, wooden_bookshelf_worn: 0.8, exterior_aircon_unit: 1.0, utility_box_01: 0.4 };
  const model = (name, x, y, z, ry = 0, s = 1, rx = 0, rz = 0, piece = '*') => {
    placed.push([x, z, WIDE[name] || 0.4]);
    const inner = (z < OPEN_Z0 || z > OPEN_Z1) && !wells.some(([wx, wz]) => Math.abs(x - wx) < WELL_R && Math.abs(z - wz) < WELL_R);
    kit.put(name, piece, x, y, z, ry, s, inner ? INNER : undefined, rx, rz);
  };
  // (les portes fermées des salles 3 à 6 : rien d'autre sur ce bout de mur)
  for (const d of map.fakeScreens || []) placed.push([d.x * C - 0.1, (d.z + 0.5) * C, 2.9]);
  // (ni autour des portes des deux salles ouvertes : leur portique blanc, leur grand chiffre)
  for (const d of map.doors || []) if (d.kind === 'screen') placed.push([d.x * C - 0.1, (d.z + 0.5) * C, 2.9]);
  const props = drawMallProps({ map, fi, G, MATS, hAt, baked, rooms, model, placed });
  drawMallWalls({ map, fi, G, MATS, hAt, baked, rooms, model, placed, show: props.show, arcade: props.arcade, goods: props.goods });
  drawMallSigns({ map, fi, G, MATS, rooms, goods: props.goods, hAt, model, arcade: props.arcade });
  // la cabine de projection, l'écran de la salle 1 et son film (view/mallCinema.js) : à l'étage du haut
  const cinema = drawMallCinema({ map, fi, floors, G, MATS, baked, model, group, placed, art: marigoldFilmArt });
  props.goods.flush();
  kit.build();
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
    // (les corniches : des tubes cachés dans une gorge ; on n'en voit que la lueur, cuite, sur le plafond et les retombées)
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
    fixSet(new THREE.CylinderGeometry(1, 1, 0.5, 40, 1), white(), pend.filter((l) => !l.big), (l) => {
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.set(0.38, 0.4, 0.38);
    });
    // la grande suspension des cours : une vasque de verre dépoli, large et plate, qui éclaire vers le haut
    const dish = new THREE.LatheGeometry([[0, -0.3], [0.5, -0.27], [0.95, -0.17], [1.22, -0.02], [1.28, 0.06], [1.2, 0.07], [0.9, -0.06], [0, -0.14]].map(([r, y]) => new THREE.Vector2(r, y)), 40);
    fixSet(dish, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), pend.filter((l) => l.big), (l) => {
      dummy.position.set(l.x, l.y, l.z);
      dummy.scale.set(1, 1, 1);
    });
    // les appliques des piliers : sur deux faces opposées, une platine de laiton et deux bras qui portent chacun une
    // coupe de verre dépoli tournée vers le plafond (les piliers du mail et des cours font tous 90 cm)
    const BOWL = [[0.03, 0], [0.11, 0.02], [0.17, 0.065], [0.19, 0.12], [0.175, 0.12], [0.15, 0.07], [0, 0.03]].map(([r, y]) => new THREE.Vector2(r, y));
    const SC = { out: 0.3, side: 0.21, up: 0.2 }; // la coupe : devant la face, de part et d'autre de la platine, au-dessus du pied
    const sconceGeo = mergeGeometries([-1, 1].flatMap((s) => [-1, 1].map((t) => new THREE.LatheGeometry(BOWL, 14).translate(t * SC.side, SC.up, s * (0.45 + SC.out)))));
    const sconces = of('sconce');
    fixSet(sconceGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', side: THREE.DoubleSide }), sconces, (l) => {
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
      const room = rooms.find((r) => r.id === l.room);
      const ceil = (room && room.vault && room.vault.top) || hAt(l.gx, l.gz) || l.y + 1;
      if (!l.big) {
        deco.push(['brass', new THREE.CylinderGeometry(0.44, 0.46, 0.36, 40, 1, true).translate(l.x, l.y + 0.1, l.z)]);
        deco.push(['black', new THREE.CylinderGeometry(0.012, 0.012, ceil - l.y, 6).translate(l.x, (ceil + l.y) / 2, l.z)]);
        continue;
      }
      // la couronne de bronze autour de la vasque, ses trois tiges jusqu'au pavillon, la tige et la rosace au plafond
      const at = (g) => deco.push(['bronze', g.translate(l.x, l.y, l.z)]);
      at(new THREE.TorusGeometry(1.42, 0.06, 8, 48).rotateX(Math.PI / 2).translate(0, 0.04, 0));
      at(new THREE.TorusGeometry(1.3, 0.025, 6, 48).rotateX(Math.PI / 2).translate(0, 0.09, 0));
      at(new THREE.CylinderGeometry(0.1, 0.16, 0.12, 14).translate(0, -0.34, 0));
      const hubY = 1.5;
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * 6.2832 + 0.5;
        const L = Math.hypot(1.42 - 0.08, hubY - 0.06);
        const g = new THREE.CylinderGeometry(0.016, 0.016, L, 6).translate(0, L / 2, 0).rotateZ(Math.atan2(1.42 - 0.08, hubY - 0.06)).rotateY(-a);
        at(g.translate(Math.cos(a) * 1.42, 0.06, Math.sin(a) * 1.42));
        at(new THREE.CylinderGeometry(0.02, 0.02, 0.28, 6).rotateZ(Math.PI / 2).translate(1.3, 0.05, 0).rotateY(-a));
      }
      at(new THREE.CylinderGeometry(0.13, 0.09, 0.18, 12).translate(0, hubY, 0));
      at(new THREE.CylinderGeometry(0.028, 0.028, Math.max(0.1, ceil - l.y - hubY - 0.75), 8).translate(0, hubY + Math.max(0.1, ceil - l.y - hubY - 0.75) / 2, 0));
      at(new THREE.CylinderGeometry(0.3, 0.42, 0.1, 20).translate(0, ceil - l.y - 0.8, 0));
    }
    for (const l of sconces) {
      const axis = sconcePose.get(l.pillar) || 'z';
      const p = map.pillars[l.pillar];
      const d = p ? p.h : 0.45;
      const put = (g) => {
        if (axis === 'x') g.rotateY(Math.PI / 2);
        deco.push(['brass', g.translate(l.x, l.y, l.z)]);
      };
      for (const sd of [-1, 1]) {
        // la platine (une barre verticale), son médaillon, deux bras coudés, les coupelles sous les verres
        put(new THREE.BoxGeometry(0.075, 0.86, 0.022).translate(0, -0.12, sd * (d + 0.011)));
        put(new THREE.CylinderGeometry(0.07, 0.07, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0.08, sd * (d + 0.03)));
        for (const t of [-1, 1]) {
          const A = [0, 0.08, sd * (d + 0.04)];
          const B = [t * SC.side, 0.03, sd * (d + SC.out)];
          const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
          const g = new THREE.CylinderGeometry(0.014, 0.014, L, 6).rotateX(Math.PI / 2);
          const o = new THREE.Object3D();
          o.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2);
          o.lookAt(B[0], B[1], B[2]);
          o.updateMatrix();
          put(g.applyMatrix4(o.matrix));
          put(new THREE.CylinderGeometry(0.016, 0.016, 0.17, 6).translate(B[0], 0.115, B[2]));
          put(new THREE.CylinderGeometry(0.05, 0.025, 0.035, 10).translate(B[0], SC.up - 0.012, B[2]));
        }
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
    // les feux de couleur (le moteur de lumière) : les rubans de LED bleues du cinéma, qui éclairent vers le bas et
    // restent dans le hall ; un ruban fatigué bat de temps en temps
    lights(out, time) {
      for (let i = 0; i < blues.length; i++) {
        const L = blues[i];
        const sag = i % 5 === 3 ? 0.55 + 0.45 * Math.max(0, Math.sin(time * 0.7 + i) * Math.sin(time * 5.3 + i * 2)) : 1;
        const k = L.k * sag;
        out.push({ x: L.x, y: L.y, z: L.z, r: 0.1 * k, g: 0.3 * k, b: 1.15 * k, rad: L.rad, nx: 0, ny: -1, nz: 0, w: -0.45, box: cineBox });
      }
      // les bornes d'arcade encore allumées : leur écran colore le sol devant elles (et clignote un peu)
      for (let i = 0; i < props.lights.length; i++) {
        const L = props.lights[i];
        const k = 0.75 + 0.25 * Math.sin(time * (2.1 + i) + i * 1.7);
        out.push({ x: L.x, y: L.y, z: L.z, r: L.c[0] * k, g: L.c[1] * k, b: L.c[2] * k, rad: L.rad, nx: L.nx, ny: 0, nz: L.nz, w: -0.2, box: L.box });
      }
      if (cinema) cinema.lights(out, time);
    },
    // à chaque image : les modèles proches de la caméra (et pas loin derrière elle)
    update(camera, sim, time, dt) {
      if (cinema && sim) cinema.update(sim, time, dt, camera);
      camera.getWorldDirection(camDir);
      const f = Math.hypot(camDir.x, camDir.z) || 1;
      // hors du champ (son demi-angle horizontal, plus une marge pour les grands objets), on ne dessine pas ; quand
      // la caméra plonge ou se cabre, le champ au sol s'élargit : on garde tout sauf ce qui est derrière
      const half = Math.atan(Math.tan((camera.fov * Math.PI) / 360) * camera.aspect);
      const cosMin = f > 0.8 ? Math.cos(Math.min(1.95, half + 0.42)) : -0.4;
      // d'un autre étage, on ne voit de celui-ci que les cours et le mail (par les vides) : le reste n'est pas dessiné
      const here = Math.abs(camera.position.y - group.matrixWorld.elements[13] - 1.6) < 3.3;
      if (here !== wasHere) for (const m of G.inner) m.visible = here;
      wasHere = here;
      kit.update(camera.position.x, camera.position.z, camDir.x / f, camDir.z / f, 58, cosMin, here);
    },
  };
}
const camDir = new THREE.Vector3();
// la bande (en mètres, du nord au sud) où un étage se voit de l'autre : les cours et le mail, leurs vides, les escaliers
const OPEN_Z0 = 46;
const OPEN_Z1 = 114;
const INNER = { inner: 1 };
const WELL_R = 24; // autour d'un escalier du sud : ce qu'on dessine encore depuis l'autre étage
