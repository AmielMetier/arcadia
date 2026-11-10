// The Backrooms (Level 5, le Terror Hotel) - Les portes et la vie du couloir :
//  - les portes 1930 : battant à quatre panneaux en noyer, bouton et entrée de serrure en laiton, judas, plaque de
//    propreté ; chambranle mouluré à plinthes et corniche ; le papier peint qui continue autour de l'embrasure ;
//  - la plinthe, la cimaise et la corniche en vrai volume, le long de tous les murs ;
//  - devant les portes, ce que les clients ont laissé : plateaux de room service, chaussures, journaux ;
//  - le papier peint qui se décolle par lés, le verre cassé sous les appliques mortes ;
//  - derrière la porte de secours, une vraie cage d'escalier qui descend, éclairée par une ampoule grillagée.
// Tout ce qui ne bouge pas est fusionné par matière (view/hotelRooms.js, makeBatch).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE, T } from '../engine/map.js';
import { makeBatch } from './hotelRooms.js';

const C = CELL_SIZE;
const TEX = new URL('../tex/', import.meta.url).href;

// un hasard fixe, tiré d'un numéro (chambre, case) : tout le monde voit le même couloir
const hash = (a, b = 0) => {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + 0x27d4eb2f) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// un pan de mur percé d'une porte (largeur dw, hauteur dh), de y0 à y1, coordonnées de texture comme celles des murs
// (une case de large, toute la hauteur : u = 0 à gauche, v = 0 au sol)
function wallWithDoor(dw, dh, y0, y1, CEIL, w = C) {
  const pts = (l) => l.map(([x, y]) => new THREE.Vector2(x, y));
  let s;
  if (y0 < 0) {
    s = new THREE.Shape(pts([[-w / 2, y0], [w / 2, y0], [w / 2, y1], [-w / 2, y1]]));
    s.holes.push(new THREE.Path(pts([[-dw / 2, 0], [-dw / 2, dh], [dw / 2, dh], [dw / 2, 0]])));
  } else s = new THREE.Shape(pts([[-w / 2, 0], [-dw / 2, 0], [-dw / 2, dh], [dw / 2, dh], [dw / 2, 0], [w / 2, 0], [w / 2, y1], [-w / 2, y1]]));
  const g = new THREE.ShapeGeometry(s);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + C / 2) / C, p.getY(i) / CEIL);
  return g;
}

export function buildHotelCorridor({ map, group, baked, wallMat, CEIL }) {
  const W = map.W;
  const H = map.H;
  const loader = new THREE.TextureLoader();
  const walnutTex = loader.load(TEX + 'l5_noyer.jpg');
  walnutTex.colorSpace = THREE.SRGBColorSpace;
  walnutTex.anisotropy = 4;
  const phong = (o, opts) => baked(new THREE.MeshPhongMaterial(o), opts);
  const lam = (o, opts) => baked(new THREE.MeshLambertMaterial(o), opts);
  const M = {
    wall: wallMat,
    trim: phong({ color: '#5c3119', specular: '#2a1e16', shininess: 60 }, { hotel: 1 }),
    trimDark: phong({ color: '#3a1d0d', specular: '#22180f', shininess: 50 }, { hotel: 1 }),
    plaster: lam({ color: '#a99876' }, { hotel: 1 }),
    plasterDark: lam({ color: '#857555' }, { hotel: 1 }),
    soffit: lam({ color: '#7a6b50' }),
    door: phong({ map: walnutTex, color: '#7a4a2c', specular: '#2b2018', shininess: 50 }),
    panel: phong({ map: walnutTex, color: '#4d2a16', specular: '#21180f', shininess: 40 }),
    brass: phong({ color: '#b08a42', specular: '#ffe2a0', shininess: 90, emissive: '#2a1c08', emissiveIntensity: 0.35 }),
    black: new THREE.MeshBasicMaterial({ color: '#060504' }),
    silver: phong({ color: '#a9a69e', specular: '#f0ece0', shininess: 110 }),
    china: lam({ color: '#e4ddcc' }),
    linen: lam({ color: '#d9d0bd' }),
    food: lam({ color: '#5e3a22' }),
    leather: phong({ color: '#2b1910', specular: '#4a3a2c', shininess: 70 }),
    sole: lam({ color: '#120c08' }),
    news: lam({ map: canvasTex(128, 160, drawNewspaper) }),
    stripBack: baked(new THREE.MeshLambertMaterial({ color: '#b8aa86', side: THREE.BackSide })),
    bare: lam({ map: canvasTex(128, 256, drawBarePlaster) }),
    shard: new THREE.MeshPhongMaterial({ color: '#cfd8d4', emissive: '#1c1d1c', specular: '#ffffff', shininess: 140, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    metal: phong({ color: '#4c4a46', specular: '#3a3834', shininess: 40 }),
  };
  const B = makeBatch();
  const { add, setFrame, bx, cyl, ball, cached } = B;

  const isWall = (x, z) => x < 0 || z < 0 || x >= W || z >= H || map.grid[z * W + x] === T.WALL;
  const doorCells = new Set(map.rooms.map((r) => r.door.z * W + r.door.x));
  const open = (x, z) => !isWall(x, z) && map.grid[z * W + x] !== T.EXIT;

  // --- La plinthe, la cimaise et la corniche, entre x0 et x1 dans le repère courant (le mur en z = 0, +z devant) ---
  const trims = (x0, x1, { base = true, rail = true, corn = true } = {}) => {
    const w = x1 - x0;
    const cx = (x0 + x1) / 2;
    if (base) {
      bx(w, 0.165, 0.022, M.trim, cx, 0.0825, 0.011);
      bx(w, 0.022, 0.032, M.trimDark, cx, 0.17, 0.016);
      bx(w, 0.03, 0.03, M.trimDark, cx, 0.015, 0.015);
    }
    if (rail) {
      bx(w, 0.048, 0.036, M.trim, cx, 0.956, 0.018);
      bx(w, 0.016, 0.024, M.trimDark, cx, 0.924, 0.012);
      bx(w, 0.014, 0.028, M.trimDark, cx, 0.987, 0.014);
    }
    if (corn) {
      bx(w, 0.055, 0.1, M.plaster, cx, CEIL - 0.0275, 0.05);
      bx(w, 0.06, 0.072, M.plaster, cx, CEIL - 0.085, 0.036);
      bx(w, 0.05, 0.04, M.plaster, cx, CEIL - 0.14, 0.02);
      bx(w, 0.02, 0.052, M.plasterDark, cx, CEIL - 0.175, 0.026);
    }
  };
  const frameOn = (x, z, nx, nz) => setFrame(x, z, Math.atan2(nx, nz)); // +z local : (nx, nz), x local : à droite

  // les longueurs de mur droites, d'une case à l'autre (une moulure par longueur, prolongée aux angles saillants)
  const runs = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const alongX = dz !== 0;
    const nA = alongX ? W : H;
    const nB = alongX ? H : W;
    for (let b = 0; b < nB; b++) {
      let start = -1;
      for (let a = 0; a <= nA; a++) {
        const x = alongX ? a : b;
        const z = alongX ? b : a;
        const ok = a < nA && open(x, z) && !doorCells.has(z * W + x) && isWall(x + dx, z + dz);
        if (ok && start < 0) start = a;
        if (!ok && start >= 0) {
          runs.push({ dx, dz, b, a0: start, a1: a });
          start = -1;
        }
      }
    }
  }
  for (const r of runs) {
    const len = (r.a1 - r.a0) * C;
    const mid = ((r.a0 + r.a1) / 2) * C;
    if (r.dz !== 0) frameOn(mid, (r.b + 0.5 + r.dz * 0.5) * C, 0, -r.dz);
    else frameOn((r.b + 0.5 + r.dx * 0.5) * C, mid, -r.dx, 0);
    trims(-len / 2 - 0.1, len / 2 + 0.1);
  }

  // --- Les portes des chambres ---
  const DW = map.doorW;
  const DH = 2.25;
  const jw = (C - DW) / 2;
  const doorWall = wallWithDoor(DW, DH, 0, CEIL, CEIL);
  const leafW = DW - 0.04;
  const leafH = DH - 0.03;
  const LT = 0.045;
  const leaf = () => {
    // le battant fermé : x de 0 (gonds) à leafW, y de 0 à leafH, épaisseur LT centrée sur z = 0
    const sw = 0.12;
    bx(sw, leafH, LT, M.door, sw / 2, leafH / 2, 0);
    bx(sw, leafH, LT, M.door, leafW - sw / 2, leafH / 2, 0);
    const iw = leafW - 2 * sw;
    const rails = [[0, 0.24], [0.93, 1.07], [leafH - 0.13, leafH]];
    for (const [y0, y1] of rails) bx(iw, y1 - y0, LT, M.door, leafW / 2, (y0 + y1) / 2, 0);
    for (const [y0, y1] of [[0.24, 0.93], [1.07, leafH - 0.13]]) {
      bx(0.1, y1 - y0, LT, M.door, leafW / 2, (y0 + y1) / 2, 0);
      for (const sx of [-1, 1]) {
        const pw = iw / 2 - 0.05;
        const cx = leafW / 2 + sx * (0.05 + pw / 2);
        bx(pw, y1 - y0, LT * 0.5, M.panel, cx, (y0 + y1) / 2, 0); // le panneau en retrait
        bx(pw - 0.11, y1 - y0 - 0.11, LT * 0.8, M.door, cx, (y0 + y1) / 2, 0); // et son champ en relief
      }
    }
    // laiton : bouton sur rosace, entrée de serrure, judas, plaque de propreté (des deux côtés)
    for (const s of [-1, 1]) {
      const z = s * (LT / 2);
      const kx = leafW - 0.075;
      cyl(0.032, 0.032, 0.008, M.brass, kx, 1.0, z + s * 0.004, 16, Math.PI / 2);
      cyl(0.01, 0.01, 0.05, M.brass, kx, 1.0, z + s * 0.03, 8, Math.PI / 2);
      ball(0.03, 0.028, 0.03, M.brass, kx, 1.0, z + s * 0.062);
      bx(0.04, 0.1, 0.005, M.brass, kx, 0.9, z + s * 0.0025);
      bx(0.008, 0.024, 0.002, M.black, kx, 0.89, z + s * 0.0055);
      cyl(0.013, 0.013, 0.012, M.brass, leafW / 2, 1.52, z + s * 0.006, 10, Math.PI / 2);
      bx(leafW - 0.08, 0.2, 0.004, M.brass, leafW / 2, 0.12, z + s * 0.002);
    }
  };
  for (const r of map.rooms) {
    const [dx, dz] = r.dir; // de la chambre vers le couloir
    const cx = (r.door.x + 0.5) * C;
    const cz = (r.door.z + 0.5) * C;
    const rot = Math.atan2(dx, dz);
    setFrame(cx, cz, rot); // +z local : vers le couloir
    // le mur autour de l'embrasure, côté couloir et côté chambre ; les côtés de l'embrasure, son plafond
    add(doorWall, M.wall, B.local(0, 0, C / 2 + 0.002));
    add(doorWall, M.wall, B.local(0, 0, -C / 2 - 0.002, 1, 1, 1, 0, Math.PI, 0));
    for (const sx of [-1, 1]) bx(jw, CEIL, C, M.wall, sx * (DW / 2 + jw / 2), CEIL / 2, 0);
    bx(DW, CEIL - DH, C, M.soffit, 0, DH + (CEIL - DH) / 2, 0);
    // le chambranle côté couloir : montants à baguette, plinthes, frise et corniche
    const zc = C / 2;
    for (const sx of [-1, 1]) {
      bx(0.11, DH + 0.06, 0.03, M.trim, sx * (DW / 2 + 0.055), (DH + 0.06) / 2, zc + 0.015);
      bx(0.024, DH, 0.046, M.trimDark, sx * (DW / 2 + 0.012), DH / 2, zc + 0.023);
      bx(0.13, 0.24, 0.048, M.trimDark, sx * (DW / 2 + 0.065), 0.12, zc + 0.024);
      // côté chambre, un chambranle plus simple
      bx(0.1, DH + 0.05, 0.026, M.trim, sx * (DW / 2 + 0.05), (DH + 0.05) / 2, -zc - 0.013);
      // la feuillure où bute le battant
      bx(0.016, DH, 0.04, M.trimDark, sx * (DW / 2 - 0.008), DH / 2, zc - 0.12);
    }
    bx(DW + 0.26, 0.12, 0.03, M.trim, 0, DH + 0.12, zc + 0.015);
    bx(DW + 0.3, 0.02, 0.05, M.trimDark, 0, DH + 0.19, zc + 0.025);
    bx(DW + 0.36, 0.045, 0.07, M.trim, 0, DH + 0.2225, zc + 0.035);
    bx(DW + 0.2, 0.1, 0.026, M.trim, 0, DH + 0.05, -zc - 0.013);
    bx(DW, 0.016, 0.04, M.trimDark, 0, DH - 0.008, zc - 0.12);
    // les moulures du mur, jusqu'au chambranle
    for (const sx of [-1, 1]) {
      const a = DW / 2 + 0.12;
      const b = C / 2 + 0.1;
      trims(sx < 0 ? -b : a, sx < 0 ? -a : b, { corn: false });
    }
    trims(-C / 2 - 0.1, C / 2 + 0.1, { base: false, rail: false });
    setFrame(cx, cz, rot + Math.PI); // côté chambre
    for (const sx of [-1, 1]) {
      const a = DW / 2 + 0.11;
      const b = C / 2 + 0.1;
      trims(sx < 0 ? -b : a, sx < 0 ? -a : b, { corn: false });
    }
    trims(-C / 2 - 0.1, C / 2 + 0.1, { base: false, rail: false });
    // le battant, ouvert vers l'intérieur contre le côté de l'embrasure
    const hx = -DW / 2 + 0.02;
    const hz = C / 2 - 0.12 - LT / 2 - 0.01;
    const th = 1.38 + hash(r.num, 1) * 0.16; // presque contre le mur, sans y entrer
    setFrame(cx + Math.cos(rot) * hx + Math.sin(rot) * hz, cz - Math.sin(rot) * hx + Math.cos(rot) * hz, rot + th);
    leaf();

    // --- devant la porte, ce que le client a laissé ---
    const h = hash(r.num, 7);
    const sx = hash(r.num, 8) < 0.5 ? -1 : 1;
    const px = sx * (DW / 2 + 0.55);
    const pz = C / 2 + 0.24;
    const wx = cx + Math.cos(rot) * px + Math.sin(rot) * pz;
    const wz = cz - Math.sin(rot) * px + Math.cos(rot) * pz;
    setFrame(wx, wz, rot + (hash(r.num, 9) - 0.5) * 0.6);
    if (h < 0.3) {
      // un plateau de room service : la cloche, une assiette entamée, un verre, la serviette froissée
      bx(0.48, 0.014, 0.33, M.silver, 0, 0.007, 0);
      for (const s of [-1, 1]) {
        bx(0.48, 0.022, 0.008, M.silver, 0, 0.018, s * 0.165);
        bx(0.008, 0.022, 0.33, M.silver, s * 0.24, 0.018, 0);
      }
      cyl(0.125, 0.11, 0.012, M.china, -0.1, 0.02, 0, 20);
      add(cached('dome', () => new THREE.SphereGeometry(0.115, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2)), M.silver, B.local(-0.1, 0.026, 0, 1, 0.85, 1));
      ball(0.014, 0.014, 0.014, M.silver, -0.1, 0.13, 0);
      cyl(0.09, 0.08, 0.01, M.china, 0.12, 0.02, 0.06, 16);
      ball(0.05, 0.015, 0.04, M.food, 0.13, 0.03, 0.05);
      cyl(0.03, 0.024, 0.1, M.shard, 0.15, 0.064, -0.09, 10);
      ball(0.06, 0.022, 0.045, M.linen, 0.07, 0.032, -0.07);
    } else if (h < 0.48) {
      // une paire de chaussures cirées, laissées pour le cireur
      for (const s of [-1, 1]) {
        ball(0.045, 0.042, 0.125, M.leather, s * 0.065, 0.038, 0.02);
        bx(0.085, 0.014, 0.27, M.sole, s * 0.065, 0.007, 0.02);
        bx(0.07, 0.03, 0.06, M.sole, s * 0.065, 0.02, -0.08);
      }
    } else if (h < 0.62) {
      // le journal du matin, jamais ramassé
      bx(0.3, 0.012, 0.4, M.news, 0, 0.006, 0);
    }
  }

  // --- La porte de secours, côté hall : le mur autour, un cadre de métal, les moulures ---
  const E = map.elevator;
  const FDW = 1.2;
  const FDH = 2.2;
  const er = Math.atan2(E.dx, E.dz);
  const ex = E.x - E.dx * (C / 2);
  const ez = E.z - E.dz * (C / 2);
  setFrame(ex, ez, er + Math.PI); // +z local : vers le hall
  add(wallWithDoor(FDW, FDH, 0, CEIL, CEIL), M.wall, B.local(0, 0, 0.002));
  for (const sx of [-1, 1]) {
    bx(0.07, FDH + 0.07, 0.03, M.metal, sx * (FDW / 2 + 0.035), (FDH + 0.07) / 2, 0.015);
    const a = FDW / 2 + 0.08;
    const b = C / 2 + 0.1;
    trims(sx < 0 ? -b : a, sx < 0 ? -a : b, { corn: false });
  }
  bx(FDW + 0.14, 0.07, 0.03, M.metal, 0, FDH + 0.035, 0.015);
  trims(-C / 2 - 0.1, C / 2 + 0.1, { base: false, rail: false });

  // --- Le papier peint qui se décolle : un lé dont le haut s'est détaché et retombe en s'enroulant, le plâtre nu
  // derrière (dans les couloirs seulement, entre les appliques) ---
  const corridor = new Set((map.corridorCells || []).map((c) => c.z * W + c.x));
  const ROLL = C / 6;
  let peels = 0;
  for (const r of runs) {
    for (let a = r.a0; a < r.a1; a++) {
      const x = r.dz !== 0 ? a : r.b;
      const z = r.dz !== 0 ? r.b : a;
      if (!corridor.has(z * W + x) || hash(z * W + x, 11) > 0.09 || peels >= 14) continue;
      peels++;
      const nx = r.dz !== 0 ? 0 : -r.dx;
      const nz = r.dz !== 0 ? -r.dz : 0;
      const wxp = (x + 0.5) * C + r.dx * (C / 2);
      const wzp = (z + 0.5) * C + r.dz * (C / 2);
      frameOn(wxp, wzp, nx, nz);
      // le lé : entre deux joints (un sixième de case), à gauche ou à droite de l'applique
      const slot = hash(z * W + x, 12) < 0.5 ? 0 : 4;
      const u0 = -C / 2 + slot * ROLL;
      const top = 2.88;
      const ya = 1.85 + hash(z * W + x, 13) * 0.5; // le lé tient encore au mur sous ce point
      const Lp = top - ya;
      add(cached('bare' + Math.round(ya * 100), () => {
        const g = new THREE.PlaneGeometry(ROLL - 0.01, Lp);
        g.translate(0, ya + Lp / 2, 0);
        return g;
      }), M.bare, B.local(u0 + ROLL / 2, 0, 0.0025));
      const g = new THREE.PlaneGeometry(ROLL - 0.004, Lp, 1, 18);
      const p = g.attributes.position;
      const uv = g.attributes.uv;
      const n = 19;
      const Ys = [0];
      const Zs = [0];
      const curl = 1.4 + hash(z * W + x, 14) * 0.9; // le bord du haut s'enroule ; le reste penche à peine
      for (let i = 1; i < n; i++) {
        const s0 = ((i - 0.5) / (n - 1)) * Lp;
        const phi = 0.14 + curl * Math.pow(s0 / Lp, 2.6);
        Ys.push(Ys[i - 1] + Math.cos(phi) * (Lp / (n - 1)));
        Zs.push(Zs[i - 1] + Math.sin(phi) * (Lp / (n - 1)));
      }
      for (let i = 0; i < p.count; i++) {
        const lx = p.getX(i);
        const j = Math.round(((p.getY(i) + Lp / 2) / Lp) * (n - 1));
        const s = (j / (n - 1)) * Lp;
        const twist = (lx / ROLL) * 0.06 * (s / Lp);
        p.setXYZ(i, u0 + ROLL / 2 + lx, ya + Ys[j] - twist, 0.004 + Zs[j] + twist * 0.5);
        uv.setXY(i, (u0 + ROLL / 2 + lx + C / 2) / C, (ya + s) / CEIL);
      }
      g.computeVertexNormals();
      add(g, M.wall, B.local(0, 0, 0));
      add(g, M.stripBack, B.local(0, 0, 0));
      g.dispose();
    }
  }

  // --- Le verre cassé sous les appliques mortes ---
  const shardGeo = new THREE.BufferGeometry();
  shardGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.05, 0, 0.012, 0.012, 0, 0.04], 3));
  shardGeo.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  shardGeo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  map.lights.forEach((l, i) => {
    if (!l.sconce || l.state !== 'off') return;
    const { dx, dz } = l.sconce;
    for (let j = 0; j < 9; j++) {
      const a = hash(i, 20 + j) * Math.PI * 2;
      const d = 0.08 + hash(i, 40 + j) * 0.4;
      const s = 0.5 + hash(i, 60 + j) * 1.1;
      setFrame(l.x - dx * 0.35 + Math.cos(a) * d, l.z - dz * 0.35 + Math.sin(a) * d, a * 3, 0.004 + j * 0.0004);
      add(shardGeo, M.shard, B.local(0, 0, 0, s, 1, s));
    }
  });

  B.flush(group, (mat) => (mat === M.shard ? 2 : 0));
  shardGeo.dispose();
  doorWall.dispose();

  buildStairwell({ group, E, CEIL, FDW, FDH });
}

// une page de journal : titre, colonnes, une photo
function drawNewspaper(c, w, h) {
  c.fillStyle = '#d8d0bb';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#2a2622';
  c.font = 'bold 15px Georgia, serif';
  c.textAlign = 'center';
  c.fillText('THE EVENING STAR', w / 2, 18);
  c.fillRect(6, 23, w - 12, 2);
  c.font = 'bold 11px Georgia, serif';
  c.fillText('GUEST MISSING', w / 2, 38);
  c.fillStyle = 'rgba(40, 36, 32, 0.55)';
  c.fillRect(8, 46, 52, 40);
  for (let col = 0; col < 3; col++) {
    for (let y = 48; y < h - 6; y += 4) {
      if (col === 0 && y < 90) continue;
      c.fillRect(8 + col * 40, y, 34 - ((y * 7 + col) % 9), 1.4);
    }
  }
}

// le plâtre nu sous le papier : crème sali, traces de colle, auréoles
function drawBarePlaster(c, w, h) {
  c.fillStyle = '#a89a7a';
  c.fillRect(0, 0, w, h);
  for (let i = 0; i < 600; i++) {
    const x = (i * 97) % w;
    const y = (i * 61 + ((i * i) % 37)) % h;
    c.fillStyle = `rgba(${i % 2 ? 70 : 150}, ${i % 2 ? 58 : 136}, ${i % 2 ? 40 : 108}, 0.18)`;
    c.fillRect(x, y, 2 + (i % 5), 1 + (i % 3));
  }
  // la colle brunie, en traînées
  for (let i = 0; i < 9; i++) {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(90, 64, 30, 0.0)');
    g.addColorStop(0.5, 'rgba(90, 64, 30, 0.22)');
    g.addColorStop(1, 'rgba(90, 64, 30, 0.0)');
    c.fillStyle = g;
    c.fillRect((i * 29) % w, 0, 6 + (i % 4) * 3, h);
  }
  // des lambeaux de papier restés collés au bord
  c.fillStyle = '#4a171a';
  for (let y = 0; y < h; y += 8) {
    c.fillRect(0, y, 3 + ((y * 13) % 7), 8);
    c.fillRect(w - 3 - ((y * 7) % 6), y, 8, 8);
  }
}

// --- La cage d'escalier derrière la porte de secours : un palier, une volée qui descend vers une ampoule
// grillagée, un demi-palier, une seconde volée qui s'enfonce dans le noir ; murs de béton peints en deux tons, une
// rampe, un « 5 » au pochoir. Pas de lampe three.js : chaque sommet reçoit d'avance la lumière de l'ampoule. ---
function buildStairwell({ group, E, CEIL, FDW, FDH }) {
  const B = makeBatch();
  const { add, setFrame, bx, cyl, ball, cached } = B;
  const rot = Math.atan2(E.dx, E.dz);
  const fx = E.x - E.dx * (C / 2);
  const fz = E.z - E.dz * (C / 2);
  setFrame(fx, fz, rot); // +z local : vers le fond de la cage ; le mur de la porte en z = 0
  const X = C / 2 - 0.05; // demi-largeur
  const ZB = C - 0.05; // le mur du fond
  const Y0 = -3.0; // le fond du puits
  const RISE = 0.17;
  const TREAD = 0.25;
  const HL = -4 * RISE; // le demi-palier
  const litMat = (o) => {
    const m = new THREE.MeshLambertMaterial(o);
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'attribute float lit;\nvarying float vLit;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vLit = lit;');
      sh.fragmentShader = 'varying float vLit;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += diffuseColor.rgb * vec3(1.0, 0.84, 0.58) * vLit;');
    };
    m.customProgramCacheKey = () => 'hotel-stair-lit';
    return m;
  };
  const paint = (stencil) =>
    canvasTex(256, 640, (c, w, h) => {
      const yPx = (y) => ((CEIL - y) / (CEIL - Y0)) * h;
      c.fillStyle = '#b3aa90';
      c.fillRect(0, 0, w, h);
      c.fillStyle = '#34483b';
      c.fillRect(0, yPx(1.05), w, h);
      c.fillStyle = '#6b2c22';
      c.fillRect(0, yPx(1.1), w, yPx(1.05) - yPx(1.1));
      // salissures, coulures, éclats de peinture
      for (let i = 0; i < 900; i++) {
        const x = (i * 131) % w;
        const y = (i * 71 + ((i * i) % 53)) % h;
        c.fillStyle = `rgba(${i % 3 ? 30 : 200}, ${i % 3 ? 28 : 190}, ${i % 3 ? 22 : 160}, ${i % 3 ? 0.12 : 0.08})`;
        c.fillRect(x, y, 1 + (i % 4), 1 + (i % 6));
      }
      for (let i = 0; i < 7; i++) {
        const x = (i * 37 + 11) % w;
        const g = c.createLinearGradient(0, yPx(CEIL), 0, yPx(-1));
        g.addColorStop(0, 'rgba(70, 56, 34, 0.35)');
        g.addColorStop(1, 'rgba(70, 56, 34, 0)');
        c.fillStyle = g;
        c.fillRect(x, 0, 3 + (i % 3) * 2, yPx(-1));
      }
      if (stencil) {
        c.fillStyle = 'rgba(150, 30, 24, 0.85)';
        c.font = 'bold 120px Arial Black, Impact, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('5', w * 0.32, yPx(1.75));
        // une flèche vers le bas, peinte au pochoir, et le mot EXIT dessous
        const ax = w * 0.7;
        const ay = yPx(2.0);
        c.fillRect(ax - 9, ay, 18, 46);
        c.beginPath();
        c.moveTo(ax - 26, ay + 44);
        c.lineTo(ax + 26, ay + 44);
        c.lineTo(ax, ay + 76);
        c.closePath();
        c.fill();
        c.font = 'bold 26px Arial, sans-serif';
        c.fillText('EXIT', ax, yPx(1.32));
      }
    });
  const M = {
    wall: litMat({ map: paint(false) }),
    back: litMat({ map: paint(true) }),
    conc: litMat({ color: '#7a766d' }),
    concDark: litMat({ color: '#4a4741' }),
    nosing: litMat({ color: '#25231f' }),
    steel: litMat({ color: '#1e201d' }),
    hand: litMat({ color: '#4c2b17' }),
    pipe: litMat({ color: '#5d5c56' }),
    red: litMat({ color: '#8a1e18' }),
    bulb: new THREE.MeshBasicMaterial({ color: '#ffe6b0' }),
  };
  // les murs : découpés finement, pour que la lumière de l'ampoule s'y étale
  const wallPlane = (w, h, nw, nh) => new THREE.PlaneGeometry(w, h, nw, nh);
  add(wallPlane(ZB - 0.12, CEIL - Y0, 12, 30), M.wall, B.local(-X, (CEIL + Y0) / 2, (ZB + 0.12) / 2, 1, 1, 1, 0, Math.PI / 2, 0));
  add(wallPlane(ZB - 0.12, CEIL - Y0, 12, 30), M.wall, B.local(X, (CEIL + Y0) / 2, (ZB + 0.12) / 2, 1, 1, 1, 0, -Math.PI / 2, 0));
  add(wallPlane(2 * X, CEIL - Y0, 12, 30), M.back, B.local(0, (CEIL + Y0) / 2, ZB, 1, 1, 1, 0, Math.PI, 0));
  const front = wallWithDoor(FDW, FDH, Y0, CEIL, CEIL, 2 * X);
  const fp = front.attributes.position;
  const fuv = front.attributes.uv;
  for (let i = 0; i < fp.count; i++) fuv.setXY(i, (fp.getX(i) + X) / (2 * X), (fp.getY(i) - Y0) / (CEIL - Y0));
  add(front, M.wall, B.local(0, 0, 0.125));
  add(wallPlane(2 * X, ZB - 0.12, 8, 8), M.concDark, B.local(0, CEIL - 0.01, (ZB + 0.12) / 2, 1, 1, 1, Math.PI / 2, 0, 0));
  add(wallPlane(2 * X, ZB - 0.12, 8, 8), M.concDark, B.local(0, Y0 + 0.95, (ZB + 0.12) / 2, 1, 1, 1, -Math.PI / 2, 0, 0));
  // le palier, au niveau du hall ; le demi-palier au fond
  bx(2 * X, 0.2, 1.0, M.conc, 0, -0.1, 0.5);
  bx(2 * X, 0.2, ZB - (1.0 + 4 * TREAD), M.conc, 0, HL - 0.1, (1.0 + 4 * TREAD + ZB) / 2);
  // la volée qui descend, à droite ; la seconde, à gauche, qui revient sous le palier
  const step = (x0, x1, yTop, z0, z1, noseZ) => {
    bx(x1 - x0, 0.36, z1 - z0, M.conc, (x0 + x1) / 2, yTop - 0.18, (z0 + z1) / 2);
    bx(x1 - x0, 0.014, 0.045, M.nosing, (x0 + x1) / 2, yTop + 0.002, noseZ);
  };
  for (let i = 0; i < 4; i++) step(0.08, X, -(i + 1) * RISE, 1.0 + i * TREAD, 1.0 + (i + 1) * TREAD, 1.0 + i * TREAD + 0.022);
  for (let j = 0; j < 8; j++) step(-X, -0.08, HL - (j + 1) * RISE, 2.0 - (j + 1) * TREAD, 2.0 - j * TREAD, 2.0 - j * TREAD - 0.022);
  // les rampes : barreaux d'acier, main courante en bois, poteaux à boule
  const rail = (x, z0, y0, z1, y1, every = 0.12) => {
    const len = Math.hypot(z1 - z0, y1 - y0);
    const ang = Math.atan2(y1 - y0, z1 - z0);
    bx(0.05, 0.04, len, M.hand, x, (y0 + y1) / 2 + 0.92, (z0 + z1) / 2, -ang);
    bx(0.022, 0.022, len, M.steel, x, (y0 + y1) / 2 + 0.08, (z0 + z1) / 2, -ang);
    const n = Math.max(1, Math.round(Math.abs(z1 - z0) / every));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const y = y0 + (y1 - y0) * t;
      bx(0.016, 0.84, 0.016, M.steel, x, y + 0.5, z0 + (z1 - z0) * t);
    }
  };
  // au bord du palier, au-dessus du vide de la seconde volée
  {
    const len = X - 0.06;
    bx(len, 0.04, 0.05, M.hand, -0.06 - len / 2 + 0.03, 0.92, 1.0);
    bx(len, 0.022, 0.022, M.steel, -0.06 - len / 2 + 0.03, 0.08, 1.0);
    for (let x = -X + 0.06; x < 0; x += 0.12) bx(0.016, 0.84, 0.016, M.steel, x, 0.5, 1.0);
  }
  rail(0.0, 1.0, 0, 2.0, HL);
  rail(-0.04, 2.0, HL, 0.6, HL - 5.6 * RISE);
  for (const [z, y] of [[1.0, 0], [2.0, HL]]) {
    bx(0.07, 1.0, 0.07, M.hand, 0.0, y + 0.5, z);
    ball(0.045, 0.045, 0.045, M.hand, 0.0, y + 1.04, z);
  }
  // un tuyau dans l'angle, un extincteur sur le palier
  cyl(0.045, 0.045, CEIL - Y0, M.pipe, X - 0.09, (CEIL + Y0) / 2, ZB - 0.09, 12);
  for (const y of [1.2, -0.9, -2.2]) cyl(0.06, 0.06, 0.04, M.pipe, X - 0.09, y, ZB - 0.09, 12);
  cyl(0.075, 0.075, 0.42, M.red, -X + 0.1, 0.62, 0.55, 14);
  ball(0.075, 0.05, 0.075, M.red, -X + 0.1, 0.83, 0.55);
  cyl(0.025, 0.03, 0.06, M.steel, -X + 0.1, 0.89, 0.55, 8);
  bx(0.03, 0.06, 0.12, M.steel, -X + 0.03, 0.75, 0.55);
  // l'ampoule grillagée, au-dessus du demi-palier
  const BX = 0.0;
  const BY = 2.45;
  const BZ = ZB - 0.1;
  cyl(0.05, 0.05, 0.03, M.steel, BX, BY, ZB - 0.015, 12, Math.PI / 2);
  ball(0.035, 0.05, 0.035, M.bulb, BX, BY, BZ);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2;
    bx(0.006, 0.13, 0.006, M.steel, BX + Math.cos(a) * 0.06, BY, BZ + Math.sin(a) * 0.06 * 0.8);
  }
  for (const dy of [-0.06, 0.06]) add(cached('ring', () => new THREE.TorusGeometry(0.06, 0.004, 4, 16).rotateX(Math.PI / 2)), M.steel, B.local(BX, BY + dy, BZ));
  const bulbW = new THREE.Vector3(BX, BY, BZ).applyMatrix4(B.local(0, 0, 0));
  const meshes = B.flush(group);
  // la lumière de l'ampoule, posée sur chaque sommet : douce, chaude, qui s'éteint en descendant
  const v = new THREE.Vector3();
  for (const mesh of meshes) {
    const g = mesh.geometry;
    const p = g.attributes.position;
    const n = g.attributes.normal;
    const lit = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) {
      v.set(bulbW.x - p.getX(i), bulbW.y - p.getY(i), bulbW.z - p.getZ(i));
      const d2 = v.lengthSq();
      v.normalize();
      const ndl = Math.max(0, n.getX(i) * v.x + n.getY(i) * v.y + n.getZ(i) * v.z);
      const y = p.getY(i);
      const down = Math.min(1, Math.max(0, (y + 2.4) / 2.4));
      lit[i] = 0.02 + (1.1 * (0.15 + 0.85 * ndl)) / (1 + d2 * 1.8) * (0.25 + 0.75 * down);
    }
    g.setAttribute('lit', new THREE.BufferAttribute(lit, 1));
  }
  // le halo de l'ampoule
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(64, 64, (c, w) => {
    const g = c.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 220, 160, 0.9)');
    g.addColorStop(0.3, 'rgba(255, 190, 110, 0.25)');
    g.addColorStop(1, 'rgba(255, 170, 90, 0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, w);
  }), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.position.copy(bulbW);
  glow.scale.set(0.7, 0.7, 1);
  group.add(glow);
}
