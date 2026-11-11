// The Backrooms (Level 17, le Mall) - Le mobilier du grand magasin, rayon par rayon : gondoles garnies d'emballages
// imprimés (view/mallGoods.js), palettes de cartons, îlots de parfumerie, cabines d'essayage et leurs rideaux, tables
// à chaussures, salons mis en scène, murs de téléviseurs, estrades à bagages, vêtements pendus aux portants. Les
// panneaux suspendus annoncent chaque rayon. Les meubles sont des modèles Poly Haven ; le reste est construit.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { SIGN, DEPT_SIGN } from './mallGoods.js';

const PI = Math.PI;
// la silhouette d'un vêtement pendu (vue de face, le crochet du cintre à l'origine) : une chemise, un manteau long
const outline = (pts) => new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
const SHIRT = [[-0.05, 0], [0.05, 0], [0.21, -0.07], [0.26, -0.3], [0.19, -0.32], [0.17, -0.16], [0.18, -0.74], [-0.18, -0.74], [-0.17, -0.16], [-0.19, -0.32], [-0.26, -0.3], [-0.21, -0.07]];
const COAT = [[-0.05, 0], [0.05, 0], [0.22, -0.07], [0.27, -0.62], [0.2, -0.63], [0.18, -0.18], [0.21, -1.08], [-0.21, -1.08], [-0.18, -0.18], [-0.2, -0.63], [-0.27, -0.62], [-0.22, -0.07]];
const garment = (pts) => {
  const g = new THREE.ExtrudeGeometry(outline(pts), { depth: 0.035, bevelEnabled: false, curveSegments: 1 }).translate(0, 0, -0.0175);
  const u = g.attributes.uv;
  for (let i = 0; i < u.count; i++) u.setXY(i, u.getX(i) * 2.2, u.getY(i) * 2.2);
  return g;
};
let GARMENTS = null;

export function createDept(K) {
  const { G, MATS, baked, model, placeAt, lbox, frame, front, yawZ, fab, rand, goods, rooms, C } = K;
  if (!GARMENTS) GARMENTS = [garment(SHIRT), garment(COAT)];
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  MATS.shelfBlack = MATS.shelfBlack || { m: baked(phong({ color: '#17171a', specular: '#2a2a2a', shininess: 30 })), S: 1 };
  MATS.priceRail = MATS.priceRail || { m: baked(new THREE.MeshLambertMaterial({ color: '#d8d4c6' })), S: 1 };
  MATS.mirror = MATS.mirror || { m: baked(phong({ color: '#1e272b', specular: '#b4c4cc', shininess: 150 }), { spec: 0.9, gloss: 160, mask: 0 }), S: 1 };
  MATS.cream = MATS.cream || { m: baked(new THREE.MeshLambertMaterial({ color: '#cfc8b6' })), S: 1 };

  // un rideau : une bande ondulée de u0 à u1 (repère P), à la profondeur d, de y0 à y1, visible des deux côtés
  const curtain = (k, P, u0, u1, d, y0, y1, seed) => {
    const N = Math.max(8, Math.round((u1 - u0) / 0.045));
    const pos = [];
    const uv = [];
    const idx = [];
    for (const side of [0, 1]) {
      const base = pos.length / 3;
      for (let i = 0; i <= N; i++) {
        const t = i / N;
        const [x, z] = P(u0 + (u1 - u0) * t, d + 0.03 * Math.sin(t * N * 1.05 + seed) + 0.012 * Math.sin(t * N * 2.3));
        pos.push(x, y0, z, x, y1, z);
        uv.push(t * (u1 - u0) * 3, 0, t * (u1 - u0) * 3, (y1 - y0) * 0.8);
      }
      for (let i = 0; i < N; i++) {
        const a = base + i * 2;
        if (side) idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        else idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    G.add(k, g);
  };

  // une gondole à deux faces : un fond, quatre niveaux de chaque côté, leurs réglettes de prix ; garnie par facings
  const GOODS = { archive: ['carton', 'carton', 'carton', 'carton'], toys: ['toys', 'toys', 'toys', 'toys'], electro: ['electro', 'electro', 'electro', 'electro'], kitchen: ['kitchen', 'kitchen', 'kitchen', 'stock'], sport: ['sport', 'sport', 'shoes', 'sport'], stock: ['carton', 'carton', 'stock', 'stock'] };
  const gondola = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    lbox('paintGrey', it, -hw, hw, 0, 1.62, -0.025, 0.025);
    lbox('paintGrey', it, -hw, hw, 0, 0.12, -hd, hd, '-y');
    for (const lx of [-hw, hw - 0.04]) lbox('steel', it, lx, lx + 0.04, 0, 1.66, -hd, hd, '-y');
    const rows = GOODS[it.goods] || GOODS[['kitchen', 'stock', 'toys', 'electro'][it.id % 4]];
    for (const s of [-1, 1]) {
      const Ps = (u, d) => P(u, s * d);
      for (let k = 0; k < 4; k++) {
        const y = k ? 0.15 + k * 0.42 : 0.12;
        if (k) lbox('steel', it, -hw + 0.04, hw - 0.04, y - 0.03, y, s > 0 ? 0.025 : -hd, s > 0 ? hd : -0.025, '-y');
        lbox('priceRail', it, -hw + 0.04, hw - 0.04, y - 0.035, y + 0.005, s > 0 ? hd : -hd - 0.006, s > 0 ? hd + 0.006 : -hd, '-y');
        goods.shelf(Ps, -hw + 0.07, hw - 0.07, y, 0.04, hd - 0.015, rows[k], it.id * 31 + k * 7 + (s > 0 ? 3 : 0), k < 3 ? 0.36 : 0.32, it.empty ? 0.62 : 0.14);
      }
    }
  };

  // une palette de bois (trois chevrons, cinq planches) et ses cartons, deux par deux
  const pallet = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    for (const lz of [-hd + 0.05, 0, hd - 0.05]) lbox('wood', it, -hw, hw, 0, 0.1, lz - 0.05, lz + 0.05, '-y');
    for (let i = 0; i < 5; i++) lbox('wood', it, -hw + (i * (it.w - 0.14)) / 4, -hw + (i * (it.w - 0.14)) / 4 + 0.14, 0.1, 0.125, -hd, hd, '-y');
    const st = it.stack || 1;
    for (let k = 0; k < st; k++)
      for (const [lx, lz, q] of [[-0.29, -0.23, 0], [0.29, -0.23, 1], [-0.29, 0.23, 2], [0.29, 0.23, 3]]) {
        if (k === st - 1 && k > 0 && (it.id + q) % 3 === 0) continue;
        const y0 = 0.125 + k * 0.385;
        const j = (rand(it.id, k * 4 + q) - 0.5) * 0.03;
        goods.pack(P, lx - 0.275 + j, lx + 0.275 + j, y0, y0 + 0.38, lz - 0.215, lz + 0.215, goods.cellOf('carton', it.id * 3 + k + q), 1, true);
      }
    if (it.id % 4 === 0) model('cardboard_box_01', it.x + 0.9, 0, it.z + 0.2, rand(it.id) * 6, 1.1, 0, 1.57);
  };

  // un portant rond : le pied, la couronne, des vêtements sur leurs cintres (chemises, manteaux)
  const rack = (it) => {
    G.add('steel', new THREE.CylinderGeometry(0.3, 0.32, 0.03, 14).translate(it.x, 0.015, it.z));
    G.add('steel', new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6).translate(it.x, 0.76, it.z));
    G.add('steel', new THREE.TorusGeometry(0.5, 0.014, 5, 24).rotateX(PI / 2).translate(it.x, 1.5, it.z));
    for (const a of [0, PI / 2]) G.beam('steel', [it.x - Math.cos(a) * 0.5, 1.5, it.z - Math.sin(a) * 0.5], [it.x + Math.cos(a) * 0.5, 1.5, it.z + Math.sin(a) * 0.5], 0.02, 0.02);
    const set = it.fabset ?? it.id % 4;
    const n = 3 + ((it.id * 5) % 8);
    for (let i = 0; i < n; i++) {
      const a = ((i + rand(it.id, i) * 0.6) / 11) * PI * 2 + it.id;
      const long = set % 2 === 0 && (it.id + i) % 3 === 0;
      const g = GARMENTS[long ? 1 : 0].clone().rotateY(-a + (rand(it.id, i + 20) - 0.5) * 0.25);
      G.add(fab(set * 2 + (i % 3)), g.translate(it.x + Math.cos(a) * 0.5, 1.47, it.z + Math.sin(a) * 0.5));
    }
  };

  // un îlot de parfumerie : quatre comptoirs vitrés en carré, une colonne de miroirs, l'enseigne de la marque
  const cosmetic = (it) => {
    const h = it.w / 2;
    const P = frame(it);
    for (const [x0, x1, z0, z1] of [[-h, h, -h, -h + 0.55], [-h, h, h - 0.55, h], [-h, -h + 0.55, -h + 0.55, h - 0.55], [h - 0.55, h, -h + 0.55, h - 0.55]]) {
      lbox('marbleDark', it, x0, x1, 0, 0.82, z0, z1, '-y');
      lbox('brass', it, x0 - 0.01, x1 + 0.01, 0.82, 0.84, z0 - 0.01, z1 + 0.01);
      lbox('cream', it, x0 + 0.04, x1 - 0.04, 0.84, 0.86, z0 + 0.04, z1 - 0.04, '-y');
      lbox('glass', it, x0 + 0.02, x1 - 0.02, 0.84, 1.06, z0 + 0.02, z1 - 0.02, '-y');
    }
    lbox('mirror', it, -0.28, 0.28, 0, 2.2, -0.28, 0.28, '-y');
    lbox('brass', it, -0.3, 0.3, 2.2, 2.26, -0.3, 0.3);
    lbox('shelfBlack', it, -0.5, 0.5, 2.26, 2.56, -0.5, 0.5);
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) goods.sign(SIGN[it.id % 2 ? 'LUMIÈRE' : 'ORCHID & ASH'], it.x + nx * 0.5, 2.41, it.z + nz * 0.5, 0.96, 0.24, nx, nz, it.id % 3 !== 0);
    // sous la vitre et dessus : des flacons, un miroir à poser
    const BOT = [['brass_vase_03', 0.8], ['ceramic_vase_03', 0.45], ['brass_vase_03', 0.6], ['ceramic_vase_04', 0.45]];
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * PI * 2 + it.id;
      const [x, z] = P(Math.cos(a) * (h - 0.28), Math.sin(a) * (h - 0.28));
      const [name, sc] = BOT[(it.id + i) % BOT.length];
      model(name, x, i % 2 ? 0.86 : 1.065, z, a, sc);
    }
    const [fx, fz] = P(h - 0.3, -h + 0.3);
    model('standing_picture_frame_01', fx, 1.065, fz, it.id, 1.6);
  };

  // les cabines d'essayage : trois cabines contre le mur, cloisons, tringles, rideaux, un miroir et un banc dans chacune
  const fitting = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const F = front(it);
    const n = 3;
    const cw = it.w / n;
    for (let i = 0; i <= n; i++) lbox('paintGrey', it, -hw + i * cw - 0.03, -hw + i * cw + 0.03, 0, 2.15, -hd, hd, '-y');
    lbox('paintGrey', it, -hw - 0.03, hw + 0.03, 2.15, 2.5, hd - 0.08, hd);
    lbox('paintGrey', it, -hw - 0.03, hw + 0.03, 2.15, 2.2, -hd, hd - 0.08, '+y');
    const [sx, sz] = P(0, hd + 0.004);
    goods.sign(SIGN['FITTING ROOMS'], sx, 2.33, sz, 2.4, 0.3, F[0], F[1]);
    for (let i = 0; i < n; i++) {
      const u0 = -hw + i * cw + 0.03;
      const u1 = u0 + cw - 0.06;
      const uc = (u0 + u1) / 2;
      lbox('mirror', it, uc - 0.3, uc + 0.3, 0.25, 1.95, -hd + 0.005, -hd + 0.02);
      lbox('wood', it, uc - 0.34, uc + 0.34, 0.2, 2.0, -hd, -hd + 0.006);
      const a = P(u0, hd - 0.12);
      const b = P(u1, hd - 0.12);
      G.beam('steel', [a[0], 2.05, a[1]], [b[0], 2.05, b[1]], 0.025, 0.025);
      // le rideau : tiré, à moitié ouvert, ou repoussé contre la cloison
      const open = [1, 0.5, 0.22][(it.id + i) % 3];
      curtain(fab(it.id + i * 2), P, u0 + 0.02, u0 + 0.02 + (u1 - u0 - 0.04) * open, hd - 0.12, 0.22, 2.03, it.id + i);
      const [bx, bz] = P(uc + 0.32, -hd + 0.75);
      model('painted_wooden_bench', bx, 0, bz, yawZ(F) + PI / 2, [0.7, 0.55, 0.8]);
    }
  };

  // une table à chaussures : un plateau bas et son gradin, des piles de boîtes, une botte en montre de temps en temps
  const shoetable = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    lbox('wood', it, -hw + 0.08, hw - 0.08, 0, 0.38, -hd + 0.08, hd - 0.08, '-y+y');
    lbox('wood', it, -hw, hw, 0.38, 0.42, -hd, hd);
    lbox('wood', it, -hw + 0.25, hw - 0.25, 0.42, 0.66, -0.15, 0.15, '-y');
    for (const s of [-1, 1]) {
      const Ps = (u, d) => P(u, s * d);
      for (let i = 0; i < 6; i++) {
        const q = it.id * 13 + i * 5 + (s > 0 ? 1 : 0);
        const k = Math.floor(rand(q) * 4); // 0 à 3 boîtes
        const u = -hw + 0.22 + i * 0.39 + (rand(q, 1) - 0.5) * 0.04;
        for (let j = 0; j < k; j++) goods.pack(Ps, u - 0.16 + rand(q, j + 2) * 0.02, u + 0.16 + rand(q, j + 2) * 0.02, 0.42 + j * 0.115, 0.42 + (j + 1) * 0.115, 0.17, 0.43, goods.cellOf('shoes', q + j));
      }
    }
    for (let i = 0; i < 4; i++) {
      const q = it.id * 7 + i;
      if (rand(q, 9) < 0.35) continue;
      const u = -hw + 0.55 + i * 0.43;
      goods.pack(P, u - 0.1, u + 0.1, 0.66, 0.775, -0.15, 0.15, goods.cellOf('shoes', q + 3), 1, true);
    }
    if (it.id % 3 === 0) {
      const [x, z] = P(hw - 0.42, 0);
      model('rubber_boots', x, 0.66, z, rand(it.id) * 6, 1, 0, 0, 'rubber_boots_l');
    }
  };

  // un salon (ou une chambre) mis en scène sur son estrade : un tapis, des meubles, comme dans un catalogue
  const roomset = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const y0 = yawZ(front(it));
    const put = (name, lx, lz, dyaw = 0, s = 1, y = 0.08, piece = '*') => {
      const [x, z] = P(lx, lz);
      model(name, x, y, z, y0 + dyaw, s, 0, 0, piece);
    };
    lbox('wood', it, -hw, hw, 0, 0.08, -hd, hd, '-y');
    lbox(fab(it.set + 2), it, -hw + 0.5, hw - 0.5, 0.08, 0.092, -hd + 0.45, hd - 0.45, '-y');
    switch (it.set % 4) {
      case 0: // le séjour : canapé, fauteuil, table basse, le téléviseur sur sa console
        put('sofa_03', -0.2, -1.05);
        put('ArmChair_01', 1.65, -0.2, -PI / 2 + 0.3);
        put('coffee_table_round_01', -0.2, 0.25, 0, 0.8);
        put('ClassicConsole_01', -0.2, 1.4, PI);
        put('Television_01', -0.2, 1.4, PI, 1, 0.08 + 0.95);
        break;
      case 1: // le coin lecture : petit canapé, fauteuil vert, guéridon, l'horloge de parquet
        put('Sofa_01', -0.9, -1.1);
        put('GreenChair_01', 1.0, -0.5, -0.7);
        put('side_table_01', 0.15, -1.15);
        put('vintage_grandfather_clock_01', 1.85, -1.45);
        put('coffee_table_round_01', -0.5, 0.35, 0, 0.75);
        put('Ottoman_01', 1.1, 0.75, 0.4);
        break;
      case 2: // la chambre : un lit de repos, une commode, un pouf
        put('vintage_day_bed', -0.7, -1.05);
        put('GothicCommode_01', 1.4, -1.4);
        put('side_table_01', -2.0 + 0.35, -1.2);
        put('Ottoman_01', 0.5, 0.5, 0.2);
        put('standing_picture_frame_01', 1.4, -1.4, 0.3, 1.6, 0.08 + 1.21);
        break;
      default: // le salon moderne : deux fauteuils, une table basse, un canapé
        put('sofa_02', 0, -1.15);
        put('mid_century_lounge_chair', -1.5, 0.3, PI / 2 + 0.4);
        put('mid_century_lounge_chair', 1.5, 0.3, -PI / 2 - 0.4);
        put('modern_coffee_table_01', 0, 0.2, PI / 2);
        break;
    }
  };

  // un mur de téléviseurs : un meuble noir, des cartons d'appareils en bas et en haut, quatre postes au milieu
  const tvwall = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const y0 = yawZ(front(it));
    lbox('shelfBlack', it, -hw, hw, 0, 1.95, -hd, -hd + 0.04);
    for (const lx of [-hw, hw - 0.04]) lbox('shelfBlack', it, lx, lx + 0.04, 0, 1.95, -hd + 0.04, hd, '-y');
    for (const y of [0.1, 0.62, 1.2, 1.95]) lbox('shelfBlack', it, -hw + 0.04, hw - 0.04, y - 0.04, y, -hd + 0.04, hd, y > 0.2 ? '' : '-y');
    goods.shelf(P, -hw + 0.08, hw - 0.08, 0.1, -hd + 0.06, hd - 0.03, 'electro', it.id * 17 + 1, 0.42, 0.2);
    goods.shelf(P, -hw + 0.08, hw - 0.08, 1.2, -hd + 0.06, hd - 0.03, 'electro', it.id * 17 + 5, 0.6, 0.3);
    for (let i = 0; i < 4; i++) {
      if ((it.id + i) % 5 === 0) continue; // un poste vendu
      const [x, z] = P(-hw + 0.7 + i * ((it.w - 1.4) / 3), 0.05);
      if ((it.id + i) % 2) model('Television_01', x, 0.62, z, y0 + (rand(it.id, i) - 0.5) * 0.2, 1.05);
      else model('television_02', x, 0.62, z, y0 + (rand(it.id, i) - 0.5) * 0.2, 1.25);
    }
  };

  // les bagages : une estrade à deux marches, des valises debout et couchées
  const luggage = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const y0 = yawZ(front(it));
    const CASE = ['01', '02'].map((k) => ['bottom', 'clasp', 'handle', 'top'].map((p) => `vintage_suitcase_${k}_${p}`).join('+'));
    lbox('wood', it, -hw, hw, 0, 0.18, -hd, hd, '-y');
    lbox('wood', it, -hw + 0.1, hw - 0.1, 0.18, 0.5, -hd + 0.1, -0.05, '-y');
    const at = (lx, lz, y, k, dyaw = 0, s = 1, rx = 0) => {
      const [x, z] = P(lx, lz);
      placeAt('vintage_suitcase', x, y, z, y0 + dyaw, k ? -0.46 : 0.46, 0, s, rx, 0, CASE[k]);
    };
    at(-0.55, -0.4, 0.5, it.id % 2, 0.1);
    at(0.5, -0.4, 0.5, (it.id + 1) % 2, -0.15, 0.8);
    at(-0.3, 0.35, 0.18, (it.id + 1) % 2, 0.25, 1.1);
    if (it.id % 2) at(0.65, 0.4, 0.18, it.id % 2, -0.3, 0.7);
  };

  // les panneaux suspendus des rayons (au-dessus de l'allée centrale), « PAY HERE » au-dessus des caisses
  const signs = (furn) => {
    for (const r of rooms) {
      if (!r.depts) continue;
      const x = ((r.x0 + r.x1 + 1) * C) / 2 + 1.3;
      for (const d of r.depts) {
        const z = d.z0 + 0.4;
        const y = r.ceilH - 0.75;
        G.box('shelfBlack', x - 1.36, x + 1.36, y - 0.2, y + 0.2, z - 0.012, z + 0.012);
        goods.sign(DEPT_SIGN[d.dept], x, y, z, 2.6, 0.325, 0, 1, false, true);
        for (const s of [-1, 1]) G.beam('steel', [x + s * 1.1, y + 0.2, z], [x + s * 1.1, r.ceilH, z], 0.012, 0.012);
      }
    }
    for (const it of furn) {
      if (it.kind !== 'counter' || !it.cash) continue;
      const r = rooms[it.room];
      const y = (r ? r.ceilH : 3.4) - 0.7;
      G.box('shelfBlack', it.x - 0.82, it.x + 0.82, y - 0.14, y + 0.14, it.z - 0.012, it.z + 0.012);
      goods.sign(SIGN['PAY HERE'], it.x, y, it.z, 1.6, 0.2, 0, 1, true, true);
      for (const s of [-1, 1]) G.beam('steel', [it.x + s * 0.7, y + 0.14, it.z], [it.x + s * 0.7, r ? r.ceilH : 3.4, it.z], 0.012, 0.012);
    }
  };

  // --- le food court, les bureaux, les locaux techniques ---
  // un box : deux banquettes de bois face à face, une table sur son pied
  const booth = (it) => {
    const P = frame(it);
    const y0 = yawZ(front(it));
    for (const s of [-1, 1]) {
      const [x, z] = P(0, s * 0.82);
      model('painted_wooden_bench', x, 0, z, y0 + (s > 0 ? PI : 0), [1.3, 1, 1]);
    }
    lbox('wood', it, -0.62, 0.62, 0.72, 0.76, -0.36, 0.36);
    lbox('black', it, -0.05, 0.05, 0.03, 0.72, -0.05, 0.05, '-y+y');
    lbox('black', it, -0.26, 0.26, 0, 0.03, -0.2, 0.2, '-y');
    if (it.mess === 1) model('CoffeeCart_01', it.x - 0.41, 0.76 - 1.06, it.z - 0.17, 0, 1, 0, 0, 'CoffeeCart_01_mugs');
    else if (it.mess === 2) goods.pack(P, -0.2, 0.16, 0.76, 0.86, -0.12, 0.14, goods.cellOf('stock', it.id), 1, true);
  };
  // une plante en pot, posée au sol
  const pot = (it) => {
    const a = rand(it.id) * 6.28;
    if (it.plant % 3 === 1) model('potted_plant_02', it.x + 0.05, 0, it.z + 0.1, a, 1.5, 0, 0, 'potted_plant_02_pot+potted_plant_02_leaves');
    else model('potted_plant_04', it.x, 0, it.z, a, it.plant % 3 ? 3.4 : 2.8);
  };
  // une cloison de bureau : des panneaux tendus de tissu bleu entre des montants ; basse entre deux rangées de postes
  const partition = (it) => {
    const long = it.d > it.w;
    const len = long ? it.d : it.w;
    const H = it.low ? 1.25 : 1.75;
    const n = Math.max(1, Math.round(len / 1.5));
    const B = (k, a0, a1, y0, y1, t) => (long ? G.box(k, it.x - t, it.x + t, y0, y1, it.z + a0, it.z + a1) : G.box(k, it.x + a0, it.x + a1, y0, y1, it.z - t, it.z + t));
    for (let i = 0; i < n; i++) {
      const a0 = -len / 2 + (i * len) / n;
      const a1 = a0 + len / n;
      B(fab(2 + ((it.id + i) % 5 === 0 ? 3 : 0)), a0 + 0.02, a1 - 0.02, 0.1, H - 0.03, 0.025);
      B('steel', a0, a0 + 0.03, 0, H, 0.03);
    }
    B('steel', len / 2 - 0.03, len / 2, 0, H, 0.03);
    B('steel', -len / 2, len / 2, H - 0.03, H, 0.03);
    for (let i = 0; i <= n; i += 2) {
      const a = -len / 2 + (i * len) / n;
      if (long) G.box('steel', it.x - 0.2, it.x + 0.2, 0, 0.02, it.z + a - 0.03, it.z + a + 0.03);
      else G.box('steel', it.x + a - 0.03, it.x + a + 0.03, 0, 0.02, it.z - 0.2, it.z + 0.2);
    }
  };
  // une table de réunion : un grand plateau, des fauteuils autour (un de travers, un qui manque), l'écran au bout
  const meeting = (it) => {
    const P = frame(it);
    const y0 = yawZ(front(it));
    const hw = it.w / 2 - 0.3;
    lbox('wood', it, -hw, hw, 0.72, 0.77, -0.62, 0.62);
    for (const lx of [-hw + 0.6, hw - 0.6]) lbox('black', it, lx - 0.04, lx + 0.04, 0, 0.72, -0.4, 0.4, '-y+y');
    const per = Math.ceil((it.seats || 8) / 2);
    for (let i = 0; i < per * 2; i++) {
      if ((it.id + i) % 7 === 0) continue;
      const s = i % 2 ? 1 : -1;
      const u = -hw + 0.5 + (Math.floor(i / 2) * (2 * hw - 1)) / Math.max(1, per - 1);
      const out = (it.id + i) % 5 === 0 ? 0.55 : 0;
      const [x, z] = P(u + (rand(it.id, i) - 0.5) * 0.15, s * (1.0 + out));
      model('GreenChair_01', x, 0, z, y0 + (s > 0 ? PI : 0) + (rand(it.id, i + 9) - 0.5) * (out ? 1.6 : 0.4));
    }
    const [sx, sz] = P(hw + 1.3, 0);
    model('projector_screen', sx, 0, sz, y0 - PI / 2);
    const [nx, nz] = P(-0.4, 0.1);
    model('office_notepads', nx, 0.775, nz, rand(it.id) * 6, 1, 0, 0, 'office_notepads_a4_stack');
    goods.pack(P, 0.3, 0.75, 0.77, 0.87, -0.2, 0.12, goods.cellOf('carton', it.id), 1, true);
  };
  // la kitchenette de la salle de pause : meubles bas, plan de travail, évier, placards, le réfrigérateur au bout
  const kitchenette = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const y0 = yawZ(front(it));
    lbox('wood', it, -hw + 0.75, hw, 0.1, 0.86, -hd, hd - 0.04, '-y');
    lbox('black', it, -hw + 0.75, hw, 0, 0.1, -hd, hd - 0.1, '-y');
    lbox('marbleDark', it, -hw + 0.75, hw + 0.02, 0.86, 0.9, -hd, hd);
    lbox('wood', it, -hw + 0.75, hw, 1.5, 2.2, -hd, -hd + 0.36);
    lbox('steel', it, 0.2, 0.9, 0.9, 0.906, -0.22, 0.22);
    lbox('black', it, 0.26, 0.84, 0.9, 0.907, -0.16, 0.16);
    for (let k = 0; k < 4; k++) lbox('steel', it, -hw + 1.2 + k * 0.85, -hw + 1.36 + k * 0.85, 0.74, 0.76, hd - 0.04, hd - 0.02);
    // le réfrigérateur : un caisson émaillé, deux portes, leurs poignées
    lbox('plastic', it, -hw, -hw + 0.7, 0, 1.78, -hd, hd, '-y');
    lbox('black', it, -hw, -hw + 0.7, 1.18, 1.19, hd, hd + 0.002);
    for (const [ya, yb] of [[0.5, 1.1], [1.26, 1.6]]) lbox('steel', it, -hw + 0.6, -hw + 0.63, ya, yb, hd, hd + 0.03);
    const [mx, mz] = P(-0.55, -0.02);
    model('vintage_microwave', mx, 0.9, mz, y0, 0.8);
    const [kx, kz] = P(1.45, 0);
    model('vintage_electric_kettle', kx, 0.9, kz, y0 + 0.6);
    if (!it.rot && (it.face || 1) > 0) model('CoffeeCart_01', it.x + 1.1 - 0.41, 0.9 - 1.06, it.z - 0.17, 0, 1, 0, 0, 'CoffeeCart_01_mugs');
  };
  // des fûts, des bouteilles de gaz, des bacs : en grappe
  const TK = [['Barrel_01', 1], ['Barrel_02', 1.1], ['barrel_03', 1], ['propane_tank', 1], ['industrial_pastic_container', 1.5], ['plastic_container', 1.4]];
  const tanks = (it) => {
    for (let i = 0; i < (it.n || 3); i++) {
      const a = (i / (it.n || 3)) * PI * 2 + it.id;
      const r = i ? 0.55 + rand(it.id, i) * 0.25 : 0;
      const [name, sc] = TK[(it.tk + (i % 2 ? 0 : i)) % TK.length];
      model(name, it.x + Math.cos(a) * r, 0, it.z + Math.sin(a) * r, rand(it.id, i + 3) * 6, sc);
    }
  };
  // deux armoires électriques côte à côte, leurs gaines jusqu'au plafond
  const panelbox = (it) => {
    const P = frame(it);
    const y0 = yawZ(front(it));
    const top = K.hAt(Math.floor(it.x / C), Math.floor(it.z / C)) || 3;
    for (const [lx, name] of [[-0.62, 'utility_box_02'], [0.45, 'utility_box_01'], [0.98, it.id % 2 ? 'utility_box_01' : null]]) {
      if (!name) continue;
      const [x, z] = P(lx, -0.1);
      model(name, x, 0, z, y0);
      G.beam('steel', [x, 1.12, z], [x, top - 0.02, z], 0.05, 0.05);
    }
  };
  // le groupe électrogène, ses bidons
  const genset = (it) => {
    model('portable_generator', it.x, 0, it.z, 0.3, 1.5);
    model('oil_tin', it.x + 0.85, 0, it.z + 0.2, 1, 1.6);
    model('can_rusted', it.x + 0.7, 0, it.z - 0.3, 2, 1.5);
    model('Barrel_02', it.x - 0.95, 0, it.z + 0.1, 0.5, 1);
  };
  // un établi d'acier : son plateau, une tablette basse, le panneau perforé ; une caisse à outils, des bidons
  const workbench = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const y0 = yawZ(front(it));
    lbox('steel', it, -hw, hw, 0.86, 0.9, -hd, hd);
    lbox('steel', it, -hw + 0.05, hw - 0.05, 0.22, 0.25, -hd + 0.05, hd - 0.05);
    for (const lx of [-hw, hw - 0.05]) for (const lz of [-hd, hd - 0.05]) lbox('steel', it, lx, lx + 0.05, 0, 0.86, lz, lz + 0.05, '-y+y');
    lbox('paintGrey', it, -hw, hw, 0.9, 1.9, -hd, -hd + 0.03);
    if (it.id % 2) {
      const [x, z] = P(-0.55, 0);
      model('metal_tool_chest', x, 0.9, z, y0 + 0.15);
    } else goods.pack(P, -0.9, -0.35, 0.9, 1.2, -0.25, 0.2, goods.cellOf('carton', it.id), 1, true);
    const [ox, oz] = P(0.5, -0.1);
    model('oil_tin', ox, 0.9, oz, rand(it.id) * 6, 1.4);
    const [cx, cz] = P(0.85, 0.12);
    model('can_rusted', cx, 0.9, cz, 0, 1.3);
    goods.shelf(P, -hw + 0.1, hw - 0.1, 0.25, -hd + 0.08, hd - 0.08, 'carton', it.id * 5, 0.5, 0.35);
  };

  return { gondola, pallet, rack, cosmetic, fitting, shoetable, roomset, tvwall, luggage, signs, curtain, booth, pot, partition, meeting, kitchenette, tanks, panelbox, genset, workbench };
}
