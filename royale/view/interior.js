// L'intérieur en 3D : les meubles (une trentaine de modèles en volumes simples, une couleur de tissu ou de bois par
// instance) et les portes (battants qui pivotent, rideaux métalliques qui s'enroulent). Une instance par meuble et
// par porte, un maillage instancié par modèle pour toute l'île.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { furnRect } from '../engine/furniture.js';
import { floorY, levelH } from '../engine/world.js';
import { CELL, STOREY } from '../engine/buildings.js';
import { hash } from '../engine/rng.js';

// ------------------------------------------------------------------ fabrication : volumes colorés, aTint = 1 → couleur de l'instance
function kit() {
  const parts = [];
  const put = (geo, color, tint) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    geo !== g && geo.dispose();
    const n = g.attributes.position.count, c = new THREE.Color(color), col = new Float32Array(n * 3), t = new Float32Array(n);
    for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; t[i] = tint ? 1 : 0; }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aTint', new THREE.BufferAttribute(t, 1));
    parts.push(g);
  };
  return {
    B(w, h, d, x, y, z, color, tint = 0) { put(new THREE.BoxGeometry(w, h, d).translate(x, y + h / 2, z), color, tint); },
    C(r, h, x, y, z, color, tint = 0, seg = 14, r2 = r) { put(new THREE.CylinderGeometry(r2, r, h, seg).translate(x, y + h / 2, z), color, tint); },
    S(r, x, y, z, color, tint = 0) { put(new THREE.SphereGeometry(r, 12, 8).translate(x, y, z), color, tint); },
    // cylindre couché le long de x
    X(r, len, x, y, z, color, tint = 0) { put(new THREE.CylinderGeometry(r, r, len, 14).rotateZ(Math.PI / 2).translate(x, y, z), color, tint); },
    // cylindre couché le long de z
    Z(r, len, x, y, z, color, tint = 0) { put(new THREE.CylinderGeometry(r, r, len, 14).rotateX(Math.PI / 2).translate(x, y, z), color, tint); },
    geo() { const g = mergeGeometries(parts); for (const p of parts) p.dispose(); g.computeBoundingSphere(); return g; },
  };
}
const W = 0x9a6a42, DARK = 0x2b2a28, WHITE = 0xf2efe8, METAL = 0xb8bcc0, BLACK = 0x1d1e21, GLASS = 0xb9d9e6;
const legs = (K, w, d, h, r, color, inset = 0.06) => { for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.B(r, h, r, sx * (w / 2 - inset), 0, sz * (d / 2 - inset), color, 1); };

const MODELS = {
  lit(K, s = 1.6) {
    const d = 2.1;
    K.B(s, 0.3, d, 0, 0.1, 0, W); K.B(s, 1.1, 0.08, 0, 0, -d / 2 + 0.04, W);
    K.B(s - 0.08, 0.2, d - 0.15, 0, 0.4, 0.04, WHITE);
    K.B(s - 0.02, 0.07, d * 0.62, 0, 0.56, d / 2 - d * 0.31 - 0.02, 0xffffff, 1);
    for (const x of s > 1.2 ? [-s / 4, s / 4] : [0]) K.B(s > 1.2 ? 0.6 : 0.7, 0.13, 0.35, x, 0.6, -d / 2 + 0.32, WHITE);
  },
  lit_simple(K) { MODELS.lit(K, 1.0); },
  armoire(K) {
    const w = 1.3, d = 0.62, h = 2.0;
    K.B(w, h, d, 0, 0, 0, 0xffffff, 1); K.B(w + 0.06, 0.06, d + 0.04, 0, h, 0, 0xffffff, 1);
    K.B(0.02, h - 0.12, 0.02, 0, 0.06, d / 2 + 0.005, DARK);
    for (const x of [-0.08, 0.08]) K.B(0.03, 0.2, 0.03, x, 0.95, d / 2 + 0.02, METAL);
  },
  commode(K) {
    const w = 1.0, d = 0.5, h = 0.85;
    K.B(w, h, d, 0, 0, 0, 0xffffff, 1); K.B(w + 0.04, 0.04, d + 0.03, 0, h, 0, 0xffffff, 1);
    for (const y of [0.3, 0.55, 0.78]) { K.B(w - 0.06, 0.015, 0.01, 0, y, d / 2 + 0.005, DARK); K.S(0.025, 0, y - 0.12, d / 2 + 0.02, METAL); }
  },
  chevet(K) {
    K.B(0.5, 0.55, 0.45, 0, 0, 0, 0xffffff, 1); K.B(0.46, 0.015, 0.01, 0, 0.36, 0.23, DARK);
    K.C(0.06, 0.04, 0, 0.55, 0, DARK); K.C(0.015, 0.25, 0, 0.59, 0, METAL); K.C(0.14, 0.18, 0, 0.8, 0, 0xf2e6c4, 0, 16, 0.09);
  },
  canape(K, w = 2.1) {
    const d = 0.92;
    K.B(w, 0.4, d, 0, 0.08, 0, 0xffffff, 1);
    K.B(w, 0.48, 0.22, 0, 0.38, -d / 2 + 0.11, 0xffffff, 1);
    for (const sx of [-1, 1]) K.B(0.18, 0.3, d, sx * (w / 2 - 0.09), 0.38, 0, 0xffffff, 1);
    const n = w > 1.5 ? 2 : 1, cw = (w - 0.4) / n;
    for (let i = 0; i < n; i++) K.B(cw - 0.03, 0.12, d - 0.28, -w / 2 + 0.2 + cw * (i + 0.5), 0.48, 0.1, 0xe8e8e8, 1);
    legs(K, w, d, 0.08, 0.05, DARK);
  },
  fauteuil(K) { MODELS.canape(K, 0.95); },
  table_basse(K) { K.B(1.1, 0.05, 0.6, 0, 0.37, 0, 0xffffff, 1); legs(K, 1.1, 0.6, 0.37, 0.05, 0xffffff); },
  meuble_tv(K) {
    K.B(1.6, 0.5, 0.45, 0, 0, 0, 0xffffff, 1);
    K.B(0.3, 0.04, 0.2, 0, 0.5, -0.05, BLACK); K.B(0.05, 0.08, 0.05, 0, 0.54, -0.05, BLACK);
    K.B(1.15, 0.55, 0.05, 0, 0.6, -0.06, BLACK); K.B(1.08, 0.48, 0.01, 0, 0.635, -0.032, 0x1f3550);
  },
  bibliotheque(K) {
    const w = 1.4, d = 0.4, h = 2.0;
    K.B(0.04, h, d, -w / 2 + 0.02, 0, 0, 0xffffff, 1); K.B(0.04, h, d, w / 2 - 0.02, 0, 0, 0xffffff, 1); K.B(w, h, 0.03, 0, 0, -d / 2 + 0.015, 0xffffff, 1);
    const BOOKS = [0xb5402f, 0x2f5f8f, 0x3f8a4a, 0xd8b04a, 0x6a4a8a, 0xe0d6c0, 0x8a3a3a];
    for (let s = 0; s < 5; s++) {
      const y = 0.05 + s * 0.39;
      K.B(w - 0.06, 0.03, d - 0.03, 0, y, 0.01, 0xffffff, 1);
      let x = -w / 2 + 0.06;
      for (let i = 0; x < w / 2 - 0.12; i++) { const bw = 0.05 + ((i * 7 + s * 3) % 5) * 0.012, bh = 0.24 + ((i * 5 + s) % 4) * 0.025; K.B(bw, bh, d - 0.1, x + bw / 2, y + 0.03, 0.02, BOOKS[(i * 3 + s * 2) % BOOKS.length]); x += bw + 0.008; }
    }
    K.B(w, 0.03, d, 0, h - 0.03, 0, 0xffffff, 1);
  },
  cuisine(K) {
    const w = 3.2, d = 0.65;
    K.B(w, 0.86, d - 0.02, 0, 0.02, 0, 0xffffff, 1);
    K.B(w + 0.02, 0.05, d + 0.02, 0, 0.88, 0.01, 0x3a3a3c);
    for (let i = 0; i < 5; i++) K.B(0.01, 0.8, 0.01, -w / 2 + (w / 5) * i + 0.02, 0.05, d / 2, DARK);
    K.B(0.62, 0.02, 0.42, -0.85, 0.93, 0.03, METAL); K.B(0.04, 0.25, 0.04, -0.85, 0.93, -0.22, METAL);
    K.B(0.64, 0.02, 0.52, 0.75, 0.93, 0.02, BLACK);
    for (const [ox, oz] of [[-0.15, -0.12], [0.15, -0.12], [-0.15, 0.13], [0.15, 0.13]]) K.C(0.08, 0.012, 0.75 + ox, 0.95, 0.02 + oz, 0x555555);
    K.B(w, 0.55, 0.02, 0, 0.93, -d / 2 + 0.01, 0xd9dfe2);
    K.B(w, 0.72, 0.36, 0, 1.48, -d / 2 + 0.18, 0xffffff, 1);
    K.B(0.7, 0.22, 0.46, 0.75, 1.26, -d / 2 + 0.23, METAL);
  },
  frigo(K) {
    const w = 0.75, d = 0.7, h = 1.9;
    K.B(w, h, d, 0, 0, 0, 0xffffff, 1); K.B(w - 0.02, 0.015, 0.01, 0, 1.25, d / 2 + 0.005, DARK);
    K.B(0.03, 0.4, 0.04, -w / 2 + 0.08, 1.35, d / 2 + 0.02, METAL); K.B(0.03, 0.5, 0.04, -w / 2 + 0.08, 0.6, d / 2 + 0.02, METAL);
  },
  table(K) { K.B(1.6, 0.05, 0.9, 0, 0.71, 0, 0xffffff, 1); legs(K, 1.6, 0.9, 0.71, 0.06, 0xffffff); },
  chaise(K) {
    K.B(0.46, 0.05, 0.46, 0, 0.43, 0, 0xffffff, 1); legs(K, 0.46, 0.46, 0.43, 0.04, 0xffffff, 0.04);
    for (const sx of [-1, 1]) K.B(0.04, 0.46, 0.04, sx * 0.19, 0.46, -0.19, 0xffffff, 1);
    K.B(0.42, 0.2, 0.03, 0, 0.7, -0.19, 0xffffff, 1);
  },
  baignoire(K) {
    K.B(1.7, 0.56, 0.78, 0, 0, 0, WHITE); K.B(1.56, 0.02, 0.64, 0, 0.47, 0, 0x8ec9e0);
    K.C(0.02, 0.18, -0.72, 0.56, -0.3, METAL);
  },
  douche(K) {
    K.B(0.95, 0.1, 0.95, 0, 0, 0, WHITE);
    K.B(0.92, 1.9, 0.02, 0, 0.1, 0.46, GLASS); K.B(0.02, 1.9, 0.92, 0.46, 0.1, 0, GLASS);
    K.C(0.012, 0.6, -0.38, 1.4, -0.42, METAL); K.C(0.08, 0.03, -0.38, 2.0, -0.38, METAL);
  },
  toilettes(K) {
    K.C(0.15, 0.36, 0, 0, 0.08, WHITE, 0, 16, 0.18); K.C(0.2, 0.05, 0, 0.36, 0.08, WHITE);
    K.B(0.42, 0.42, 0.18, 0, 0.38, -0.25, WHITE);
  },
  lavabo(K) {
    K.C(0.08, 0.72, 0, 0, -0.02, WHITE); K.B(0.62, 0.16, 0.46, 0, 0.74, 0, WHITE); K.B(0.5, 0.02, 0.34, 0, 0.89, 0.02, 0xd4e6ee);
    K.C(0.015, 0.14, 0, 0.9, -0.17, METAL); K.B(0.5, 0.62, 0.02, 0, 1.12, -0.23, 0xcfdde4);
  },
  bureau(K) {
    K.B(1.4, 0.04, 0.72, 0, 0.72, 0, 0xffffff, 1);
    K.B(0.04, 0.72, 0.68, -0.68, 0, 0, 0xffffff, 1); K.B(0.42, 0.72, 0.68, 0.48, 0, 0, 0xffffff, 1);
    for (const y of [0.18, 0.42, 0.62]) K.B(0.38, 0.012, 0.01, 0.48, y, 0.345, DARK);
    K.B(0.22, 0.02, 0.16, -0.1, 0.76, -0.18, BLACK); K.B(0.04, 0.16, 0.04, -0.1, 0.76, -0.2, BLACK);
    K.B(0.6, 0.36, 0.03, -0.1, 0.9, -0.2, BLACK); K.B(0.56, 0.32, 0.01, -0.1, 0.92, -0.18, 0x23415f);
    K.B(0.45, 0.02, 0.15, -0.1, 0.76, 0.1, 0x333333);
  },
  classeur(K) {
    K.B(0.5, 1.3, 0.62, 0, 0, 0, 0xffffff, 1);
    for (const y of [0.3, 0.62, 0.94]) { K.B(0.46, 0.012, 0.01, 0, y, 0.315, DARK); K.B(0.14, 0.03, 0.03, 0, y + 0.14, 0.32, METAL); }
  },
  etagere(K) {
    const w = 2.0, d = 0.5;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) K.B(0.04, 1.85, 0.04, sx * (w / 2 - 0.02), 0, sz * (d / 2 - 0.02), METAL);
    const GOODS = [0xd8432f, 0x2f7fb5, 0xf2c14e, 0x3c9d5d, 0xe9e2d0, 0x8a5a3a, 0x7c5cc4];
    for (let s = 0; s < 4; s++) {
      const y = 0.12 + s * 0.48;
      K.B(w, 0.03, d, 0, y, 0, 0xffffff, 1);
      let x = -w / 2 + 0.08;
      for (let i = 0; x < w / 2 - 0.2; i++) { const bw = 0.16 + ((i * 3 + s) % 3) * 0.06, bh = 0.16 + ((i + s * 2) % 3) * 0.07; K.B(bw, bh, d - 0.14, x + bw / 2, y + 0.03, 0, GOODS[(i * 2 + s) % GOODS.length]); x += bw + 0.05; }
    }
  },
  comptoir(K, w = 2.0, h = 1.02) {
    K.B(w, h - 0.05, 0.72, 0, 0, 0, 0xffffff, 1); K.B(w + 0.06, 0.05, 0.8, 0, h - 0.05, 0.02, 0x3a3a3c);
    if (w < 2.5) { K.B(0.36, 0.2, 0.3, w / 2 - 0.35, h, -0.1, BLACK); K.B(0.3, 0.12, 0.02, w / 2 - 0.35, h + 0.12, 0.06, 0x2f8f5f); }
    else for (let i = 0; i < 6; i++) K.C(0.035, 0.28, -w / 2 + 0.3 + i * 0.22, h, -0.15, [0x2f6b3a, 0x8a3a2a, 0xd8c070][i % 3]);
  },
  bar(K) { MODELS.comptoir(K, 3.0, 1.1); },
  etabli(K) {
    K.B(2.0, 0.06, 0.72, 0, 0.86, 0, 0xffffff, 1); legs(K, 2.0, 0.72, 0.86, 0.07, 0xffffff);
    K.B(1.9, 0.03, 0.62, 0, 0.25, 0, 0xffffff, 1);
    K.B(2.0, 0.8, 0.03, 0, 1.0, -0.345, 0xc9a87a);
    K.B(0.2, 0.14, 0.18, 0.7, 0.92, 0.15, 0x3f5f8f);
    for (let i = 0; i < 5; i++) K.B(0.04, 0.3, 0.03, -0.6 + i * 0.25, 1.25, -0.32, DARK);
  },
  pneus(K) { for (let i = 0; i < 4; i++) { K.C(0.36, 0.21, 0, i * 0.22, 0, 0x2a2a2c, 0, 18); K.C(0.2, 0.215, 0, i * 0.22, 0, 0x7a7d80, 0, 12); } },
  voiture(K) {
    K.B(1.9, 0.75, 4.3, 0, 0.35, 0, 0xffffff, 1); K.B(1.7, 0.62, 2.3, 0, 1.1, -0.25, 0xffffff, 1);
    K.B(1.74, 0.42, 2.34, 0, 1.15, -0.25, 0x2c3e50); K.B(1.5, 0.3, 0.08, 0, 0.45, 2.16, BLACK);
    for (const sx of [-0.85, 0.85]) for (const sz of [-1.35, 1.35]) K.X(0.38, 0.3, sx, 0.38, sz, BLACK);
  },
  caisses(K) {
    K.B(1.2, 0.62, 1.2, 0, 0, 0, 0xffffff, 1); K.B(0.62, 0.62, 0.62, -0.25, 0.62, -0.2, 0xffffff, 1);
    for (const y of [0.3, 0.92]) K.B(1.22, 0.04, 0.04, 0, y, 0.6, DARK);
  },
  palette(K) {
    K.B(1.2, 0.14, 1.0, 0, 0, 0, 0xb08a5a); K.B(1.0, 0.78, 0.84, 0, 0.14, 0, 0xffffff, 1); K.B(1.02, 0.03, 0.2, 0, 0.6, 0, 0x9a7a52);
  },
  tonneau(K) { K.C(0.29, 0.92, 0, 0, 0, 0xffffff, 1, 16, 0.26); for (const y of [0.15, 0.72]) K.C(0.3, 0.05, 0, y, 0, 0x4a4a4a, 0, 16); },
  foin(K) { K.B(1.3, 0.85, 0.9, 0, 0, 0, 0xffffff, 1); for (const x of [-0.35, 0.35]) K.B(0.04, 0.87, 0.92, x, 0, 0, 0x6a4a2a); },
  poele(K) {
    K.B(0.62, 0.8, 0.62, 0, 0.1, 0, 0x2f3033); legs(K, 0.62, 0.62, 0.1, 0.06, 0x2f3033);
    K.B(0.36, 0.26, 0.02, 0, 0.3, 0.31, 0x8a3a1a); K.C(0.07, 1.8, 0, 0.9, -0.15, 0x3a3b3e);
  },
  tapis(K) { K.B(2.2, 0.012, 1.5, 0, 0, 0, 0x6a3a2a); K.B(2.0, 0.016, 1.3, 0, 0, 0, 0xffffff, 1); },
  plante(K) { K.C(0.17, 0.36, 0, 0, 0, 0xb5583a, 0, 14, 0.2); K.S(0.3, 0, 0.72, 0, 0x3f8a3a); K.S(0.22, 0.1, 0.95, 0.05, 0x4d9a42); K.S(0.18, -0.1, 0.88, -0.08, 0x3a7a34); },
  lampe(K) { K.C(0.15, 0.04, 0, 0, 0, DARK); K.C(0.015, 1.4, 0, 0.04, 0, METAL); K.C(0.19, 0.3, 0, 1.4, 0, 0xf2e6c4, 0, 16, 0.12); },
  // tableau : cadre sombre, toile peinte (couleur de l'instance) avec un paysage simplifié
  cadre(K) {
    K.B(0.9, 0.7, 0.04, 0, 0, 0, 0x4a3420);
    K.B(0.78, 0.58, 0.01, 0, 0.06, 0.022, 0xffffff, 1);
    K.B(0.78, 0.2, 0.012, 0, 0.06, 0.024, 0x5f8a4a); K.B(0.3, 0.16, 0.013, 0.15, 0.26, 0.025, 0x7a8a9a); K.S(0.06, -0.22, 0.5, 0.03, 0xf2d060);
  },
  horloge(K) { K.Z(0.2, 0.05, 0, 0.2, 0, 0x2b2a28); K.Z(0.17, 0.06, 0, 0.2, 0.005, WHITE); K.B(0.015, 0.13, 0.01, 0, 0.2, 0.04, BLACK); K.B(0.1, 0.015, 0.01, 0.045, 0.2, 0.04, BLACK); },
};

// couleurs des instances (tissus, bois, peintures) selon le meuble
const FABRIC = [0x3f6ea8, 0xb84a3a, 0x5f8a4a, 0xd8c8a8, 0x7a7d82, 0x8a5aa0, 0xe0a040];
const WOOD = [0xa0703f, 0x8a5a32, 0xc49a68, 0x6e4a2e, 0xf0ebe0, 0xd9c3a0];
const PAINT = [0xf2efe8, 0xd8dde0, 0x9fc4c8, 0x6f8f6a, 0xe8d8b8, 0x5a6a8a];
const TINTS = {
  lit: FABRIC, lit_simple: FABRIC, canape: FABRIC, fauteuil: FABRIC, tapis: FABRIC, chaise: WOOD, table: WOOD, table_basse: WOOD, armoire: WOOD, commode: WOOD,
  chevet: WOOD, meuble_tv: WOOD, bibliotheque: WOOD, cuisine: PAINT, frigo: [0xf2f2f0, 0xc8ccd0, 0xe8e0d0], bureau: WOOD, classeur: [0x8a9096, 0x5f7a6a, 0x5a6a8a, 0xb0b4b8],
  etagere: [0xc8ccd0, 0x8a9096, 0x5a6a8a], comptoir: WOOD, bar: WOOD, etabli: WOOD, voiture: [0xe8473a, 0xf2c14e, 0x3d7fd9, 0xf4f2ea, 0x3fae6a, 0x7c5cc4], caisses: [0xb08a5a, 0x9a7442, 0xc49a68],
  palette: [0xc9a87a, 0xb89060, 0xd8c098], tonneau: [0x8a5a32, 0x7a4a28, 0x9a6a3a], foin: [0xd9b95a, 0xc9a94a, 0xe0c46a],
  cadre: [0x9fc4e0, 0xf2d6a0, 0xe0a0a0, 0xc8e0b0, 0xd0c0e8, 0xf0e0c0],
};
const DOOR_TINTS = [0x8a5a32, 0xf2efe8, 0x3f6a4a, 0x2f4f7a, 0x9b3f30, 0x6e4a2e];

function tintMaterial() {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aTint;')
      .replace('#include <color_vertex>', `vColor = vec3(1.0);
        #ifdef USE_COLOR
          vColor *= color;
        #endif
        #ifdef USE_INSTANCING_COLOR
          vColor *= mix(vec3(1.0), instanceColor.rgb, aTint);
        #endif`);
    // les pièces restent lisibles loin des fenêtres
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * 0.22;');
  };
  m.customProgramCacheKey = () => 'royale-meubles';
  return m;
}

export function buildInterior(map) {
  const mat = tintMaterial(), group = new THREE.Group(), geos = {};
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  const geoOf = (kind) => { if (!geos[kind]) { const K = kit(); MODELS[kind](K); geos[kind] = K.geo(); } return geos[kind]; };
  // ------------------------------------------------------------------ meubles
  const byKind = new Map();
  for (const b of map.buildings) for (const f of b.furniture) {
    if (!MODELS[f.kind]) continue;
    if (!byKind.has(f.kind)) byKind.set(f.kind, []);
    byKind.get(f.kind).push({ f, y: floorY(b, f.k), ab: b.abandoned });
  }
  const furnIndex = new Map();
  // par tuiles de 160 m : on ne dessine que les meubles des tuiles proches de la caméra (cull)
  const TILE = 160, tiles = [];
  const groups = [];
  for (const [kind, list] of byKind) {
    const byTile = new Map();
    for (const it of list) { const k = Math.floor(it.f.x / TILE) + ',' + Math.floor(it.f.z / TILE); if (!byTile.has(k)) byTile.set(k, []); byTile.get(k).push(it); }
    for (const [k, sub] of byTile) groups.push({ kind, k, list: sub });
  }
  for (const { kind, k, list } of groups) {
    const im = new THREE.InstancedMesh(geoOf(kind), mat, list.length);
    const [tx, tz] = k.split(',').map(Number);
    im.userData.tile = { x0: tx * TILE, z0: tz * TILE, x1: (tx + 1) * TILE, z1: (tz + 1) * TILE };
    tiles.push(im);
    const pal = TINTS[kind] || [0xffffff];
    list.forEach(({ f, y, ab }, i) => {
      // un meuble renversé dans les maisons abandonnées, de temps en temps
      const h = hash(f.id * 7 + 3);
      q.setFromAxisAngle(up, (f.rot * Math.PI) / 2);
      if (ab && h % 5 === 0 && (kind === 'chaise' || kind === 'fauteuil' || kind === 'commode')) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2 * 0.95));
      p3.set(f.x, y + (f.y || 0) + (ab && h % 5 === 0 && kind === 'chaise' ? 0.23 : 0), f.z);
      m4.compose(p3, q, s3); im.setMatrixAt(i, m4);
      col.setHex(pal[h % pal.length]); if (ab) col.multiplyScalar(0.7);
      im.setColorAt(i, col);
      furnIndex.set(f.id, { mesh: im, i });
    });
    im.castShadow = kind === 'voiture' || kind === 'armoire' || kind === 'etagere'; im.receiveShadow = true;
    im.computeBoundingSphere();
    group.add(im);
  }

  // ------------------------------------------------------------------ portes
  const leafGeo = (() => {
    const K = kit();
    K.B(1.4, 2.33, 0.06, 0.7, 0, 0, 0xffffff, 1);
    for (const y of [0.25, 1.25]) K.B(1.1, 0.8, 0.075, 0.7, y, 0, 0xe6e0d6, 1);
    for (const z of [-0.05, 0.05]) K.S(0.045, 1.22, 1.0, z, 0xd8b04a);
    return K.geo();
  })();
  const rollGeo = (() => {
    const K = kit();
    K.B(3.6, 2.9, 0.08, 1.8, 0, 0, 0xffffff, 1);
    for (let y = 0.15; y < 2.9; y += 0.18) K.B(3.6, 0.025, 0.095, 1.8, y, 0, 0x6f777d);
    K.B(0.4, 0.06, 0.1, 1.8, 0.9, 0, DARK);
    return K.geo();
  })();
  const leaves = [], rolls = [];
  for (const b of map.buildings) for (const d of b.doors) (d.kind === 'portail' ? rolls : leaves).push({ d, b });
  const mLeaf = new THREE.InstancedMesh(leafGeo, mat, Math.max(1, leaves.length));
  const mRoll = new THREE.InstancedMesh(rollGeo, mat, Math.max(1, rolls.length));
  const anim = new Map(); // porte → { mesh, i, t (0 fermée → 1 ouverte), want }
  const place = (st) => {
    const { d, b, mesh, i } = st, F = floorY(b, d.k), sy = levelH(b) / STOREY, t = st.t * st.t * (3 - 2 * st.t);
    if (d.kind === 'portail') {
      // le rideau s'enroule vers le haut
      const x = d.o === 'h' ? d.x * CELL + 0.2 : d.x * CELL, z = d.o === 'h' ? d.z * CELL : d.z * CELL + 0.2;
      q.setFromAxisAngle(up, d.o === 'h' ? 0 : -Math.PI / 2);
      p3.set(x, F + t * (2.9 * sy - 0.3), z); s3.set(1, sy * (1 - t * 0.93), 1);
    } else {
      // le battant pivote du côté opposé à celui qui l'a ouvert (sinon vers l'intérieur)
      const inX = d.swing || (d.nx ? -d.nx : 1), inZ = d.swing || (d.nz ? -d.nz : 1);
      const closed = d.o === 'h' ? 0 : -Math.PI / 2, open = d.o === 'h' ? -inZ * Math.PI / 2 : (inX > 0 ? 0 : -Math.PI);
      q.setFromAxisAngle(up, closed + (open - closed) * t);
      p3.set(d.o === 'h' ? d.x * CELL + 1.3 : d.x * CELL, F, d.o === 'h' ? d.z * CELL : d.z * CELL + 1.3); s3.set(1, sy, 1);
    }
    m4.compose(p3, q, s3); mesh.setMatrixAt(i, m4); mesh.instanceMatrix.needsUpdate = true;
    s3.set(1, 1, 1);
  };
  for (const [list, mesh] of [[leaves, mLeaf], [rolls, mRoll]]) {
    list.forEach(({ d, b }, i) => {
      const st = { d, b, mesh, i, t: d.open ? 1 : 0, want: d.open ? 1 : 0 };
      anim.set(d.id, st); place(st);
      mesh.setColorAt(i, col.setHex(d.kind === 'portail' ? [0xc8ccd0, 0x9aa9b2, 0xb84a3a, 0x3f6a4a][hash(d.id) % 4] : DOOR_TINTS[hash(d.id) % DOOR_TINTS.length]));
    });
    mesh.count = list.length; mesh.castShadow = true; mesh.receiveShadow = true; mesh.computeBoundingSphere();
    group.add(mesh);
  }
  const moving = new Set(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  return {
    group, furnIndex,
    // meubles : seulement les tuiles à moins de far mètres de (x, z)
    cull(x, z, far = 90) {
      for (const im of tiles) {
        const t = im.userData.tile, dx = Math.max(t.x0 - x, 0, x - t.x1), dz = Math.max(t.z0 - z, 0, z - t.z1);
        im.visible = dx * dx + dz * dz < far * far;
      }
    },
    hideFurn(id) { const w = furnIndex.get(id); if (w) { w.mesh.setMatrixAt(w.i, zero); w.mesh.instanceMatrix.needsUpdate = true; } },
    hideDoor(id) { const st = anim.get(id); if (st) { moving.delete(st); st.mesh.setMatrixAt(st.i, zero); st.mesh.instanceMatrix.needsUpdate = true; anim.delete(id); } },
    setDoor(id, open) { const st = anim.get(id); if (!st) return; st.want = open ? 1 : 0; moving.add(st); },
    update(dt) {
      for (const st of moving) {
        st.t += Math.sign(st.want - st.t) * Math.min(Math.abs(st.want - st.t), dt / 0.28);
        place(st);
        if (st.t === st.want) moving.delete(st);
      }
    },
    dispose() { for (const g of Object.values(geos)) g.dispose(); leafGeo.dispose(); rollGeo.dispose(); mat.dispose(); },
  };
}
export { furnRect };
