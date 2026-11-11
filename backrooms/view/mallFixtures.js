// The Backrooms (Level 17, le Mall) - Les gros meubles fixes, modelés : les fontaines à sec (bassin à margelle arrondie,
// carrelé, une vasque tournée sur son fût, des buses de laiton, des pièces au fond), les kiosques fermés (soubassement
// lambrissé, plan de marbre, rideaux baissés et cadenassés, bandeau à enseigne), le comptoir des confiseries du cinéma
// (vitrine à friandises, machine à pop-corn, fontaine à sodas, tableaux des tarifs), les stands du food court (comptoir
// carrelé, rampe à plateaux, pare-haleine, cuisine au fond), les caisses à tapis des grandes surfaces, les comptoirs
// des boutiques, les tables à pied central du food court. Les formes de révolution sont tournées (LatheGeometry).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { SIGN_KIOSK, SIGN_BACK5, SIGN_POPCORN, SIGN_SNACKS } from './mallGoods.js';

const PI = Math.PI;

export function createFixtures(K) {
  const { G, MATS, baked, model, lbox, frame, front, yawZ, rand, goods, rooms, map, C, panel, menus } = K;
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const phong = (o) => new THREE.MeshPhongMaterial(o);
  MATS.shelfBlack = MATS.shelfBlack || { m: baked(phong({ color: '#17171a', specular: '#2a2a2a', shininess: 30 })), S: 1 };
  MATS.popcorn = MATS.popcorn || { m: baked(lam({ color: '#e2c877' })), S: 1 };
  MATS.rubber = MATS.rubber || { m: baked(lam({ color: '#1c1c1e' })), S: 1 };
  MATS.scale = MATS.scale || { m: baked(lam({ color: '#8f8a78' })), S: 1 };
  // la couleur d'un stand (celle de son tableau de menu)
  const stallMat = (i) => {
    const k = 'stallC' + (((i % 10) + 10) % 10);
    if (!MATS[k]) MATS[k] = { m: baked(lam({ color: new THREE.Color().setHSL((((i % 10) * 47) % 360) / 360, 0.55, 0.34) })), S: 1 };
    return k;
  };

  // une forme tournée autour de l'axe vertical : le profil ([rayon, hauteur], du bas vers le haut par le dehors), posée
  // en (x, y, z) ; la texture suit le tour et le profil à l'échelle de la matière
  const turn = (k, pts, x, y, z, seg = 24) => {
    const g = new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
    const S = (MATS[k] && MATS[k].S) || 1;
    let len = 0;
    let rad = 0;
    for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    for (const p of pts) rad = Math.max(rad, p[0]);
    const u = g.attributes.uv;
    for (let i = 0; i < u.count; i++) u.setXY(i, (u.getX(i) * 2 * PI * rad) / S, (u.getY(i) * len) / S);
    G.add(k, g.translate(x, y, z));
  };
  const cyl = (k, r0, r1, h, x, y, z, seg = 10) => G.add(k, new THREE.CylinderGeometry(r0, r1, h, seg).translate(x, y + h / 2, z));

  // --- une fontaine à sec ---
  const fountain = (it) => {
    const R = it.w / 2;
    const { x, z } = it;
    // le muret (marbre noir sur une plinthe), la margelle arrondie, le bassin carrelé et son fond en pente douce
    turn('marbleDark', [[R + 0.05, 0], [R + 0.05, 0.1], [R, 0.13], [R, 0.45]], x, 0, z, 48);
    turn('trim', [[R, 0.45], [R + 0.07, 0.47], [R + 0.09, 0.51], [R + 0.08, 0.56], [R + 0.04, 0.585], [R - 0.3, 0.585], [R - 0.35, 0.565], [R - 0.37, 0.52], [R - 0.35, 0.47]], x, 0, z, 48);
    turn('faience', [[R - 0.35, 0.47], [R - 0.35, 0.12], [0.6, 0.1]], x, 0, z, 48);
    // (la ligne de tartre, là où l'eau s'arrêtait)
    turn('scale', [[R - 0.353, 0.372], [R - 0.353, 0.33]], x, 0, z, 48);
    // le fût et la vasque, d'une seule pièce de pierre ; le jet de laiton
    turn('trim', [[0.66, 0.1], [0.66, 0.2], [0.56, 0.25], [0.4, 0.31], [0.32, 0.42], [0.28, 0.75], [0.27, 1.02], [0.33, 1.12], [0.5, 1.2], [0.92, 1.3], [1.3, 1.42], [1.42, 1.5], [1.43, 1.55], [1.38, 1.575], [1.31, 1.555], [0.5, 1.37], [0, 1.36]], x, 0, z, 32);
    turn('brass', [[0.15, 1.36], [0.12, 1.56], [0.2, 1.64], [0.2, 1.7], [0, 1.7]], x, 0, z, 14);
    // une sculpture de bronze au sommet (une baleine à l'ouest, une raie à l'est)
    if (x < (map.W * C) / 2) model('bronze_whale_statue', x, 1.7, z, 0.6, 1.25);
    else model('bronze_ray_statue', x, 1.7, z, 2.2, 1.8);
    // une couronne de buses, et les pièces qu'on a jetées
    const floorY = (r) => 0.1 + (0.02 * (r - 0.6)) / (R - 0.95);
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * PI * 2;
      const r = R * 0.62;
      cyl('brass', 0.03, 0.045, 0.12, x + Math.cos(a) * r, floorY(r), z + Math.sin(a) * r, 8);
      cyl('brass', 0.012, 0.012, 0.06, x + Math.cos(a) * r, floorY(r) + 0.12, z + Math.sin(a) * r, 6);
    }
    for (let i = 0; i < 22; i++) {
      const a = rand(it.id, i) * PI * 2;
      const r = 0.9 + rand(it.id, i + 40) * (R - 1.5);
      cyl(i % 3 ? 'brass' : 'steel', 0.012, 0.012, 0.003, x + Math.cos(a) * r, floorY(r) + 0.001, z + Math.sin(a) * r, 6);
    }
    // ce qu'on a jeté dans le bassin
    model('trashbag', x + 1.9, floorY(2.2), z - 1.3, rand(it.id) * 6, 0.9);
    model('plastic_crate_01', x - 2.0, floorY(2.2), z + 0.9, 0.7, 1, 0, 0.3);
  };

  // --- un kiosque fermé ---
  const kiosk = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const F = front(it);
    const o = P(0, 0);
    const X = [P(1, 0)[0] - o[0], P(1, 0)[1] - o[1]]; // le sens de la largeur
    // le soubassement : une plinthe en retrait, des panneaux lambrissés, des cornières d'inox, le plan de marbre
    lbox('rubber', it, -hw + 0.04, hw - 0.04, 0, 0.1, -hd + 0.04, hd - 0.04, '-y+y');
    lbox('wood', it, -hw, hw, 0.1, 0.98, -hd, hd, '-y+y');
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) lbox('steel', it, sx * hw - 0.02, sx * hw + 0.02, 0.1, 0.98, sz * hd - 0.02, sz * hd + 0.02, '-y+y');
    for (let lx = -hw + 0.85; lx < hw - 0.4; lx += 0.85) for (const sz of [-1, 1]) lbox('rubber', it, lx - 0.006, lx + 0.006, 0.14, 0.94, sz > 0 ? hd : -hd - 0.003, sz > 0 ? hd + 0.003 : -hd, '-y+y');
    lbox('marbleDark', it, -hw - 0.07, hw + 0.07, 0.98, 1.03, -hd - 0.07, hd + 0.07);
    // quatre montants, les rideaux baissés sur les quatre faces, leur lame finale
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) lbox('steel', it, sx * (hw - 0.05) - 0.035, sx * (hw - 0.05) + 0.035, 1.03, 2.3, sz * (hd - 0.05) - 0.035, sz * (hd - 0.05) + 0.035, '-y+y');
    for (const sz of [-1, 1]) {
      lbox('shutter', it, -hw + 0.085, hw - 0.085, 1.09, 2.3, sz * (hd - 0.06) - 0.012, sz * (hd - 0.06) + 0.012, '-y+y');
      lbox('steel', it, -hw + 0.085, hw - 0.085, 1.03, 1.09, sz * (hd - 0.06) - 0.02, sz * (hd - 0.06) + 0.02, '-y');
    }
    for (const sx of [-1, 1]) {
      lbox('shutter', it, sx * (hw - 0.06) - 0.012, sx * (hw - 0.06) + 0.012, 1.09, 2.3, -hd + 0.085, hd - 0.085, '-y+y');
      lbox('steel', it, sx * (hw - 0.06) - 0.02, sx * (hw - 0.06) + 0.02, 1.03, 1.09, -hd + 0.085, hd - 0.085, '-y');
    }
    const [px, pz] = P(0.3, hd - 0.03);
    model('padlock', px, 1.1, pz, yawZ(F), 0.085);
    // le bandeau : l'enseigne sur les quatre faces, un jonc de laiton, la couvertine
    lbox('shelfBlack', it, -hw - 0.15, hw + 0.15, 2.3, 2.72, -hd - 0.15, hd + 0.15);
    lbox('brass', it, -hw - 0.16, hw + 0.16, 2.295, 2.335, -hd - 0.16, hd + 0.16, '+y');
    lbox('trim', it, -hw - 0.19, hw + 0.19, 2.72, 2.77, -hd - 0.19, hd + 0.19);
    const sg = SIGN_KIOSK + ((it.sign || 0) % 4);
    for (const s of [-1, 1]) {
      const [ax, az] = P(0, s * (hd + 0.152));
      goods.sign(sg, ax, 2.52, az, it.w, 0.34, s * F[0], s * F[1]);
      const [bx, bz] = P(s * (hw + 0.152), 0);
      goods.sign(sg, bx, 2.52, bz, it.d, 0.3, s * X[0], s * X[1]);
    }
    // un carton scotché sur le rideau : « BACK IN 5 MINUTES »
    if ((it.sign || 0) % 2) {
      const [cx, cz] = P(-0.5, hd - 0.046);
      goods.sign(SIGN_BACK5, cx, 1.78, cz, 0.56, 0.07, F[0], F[1]);
    }
    model('WetFloorSign_01', it.x + hw + 0.5, 0, it.z + 0.3, 0.6);
  };

  // --- le comptoir des confiseries du cinéma : le comptoir de service devant, le passage du personnel, le plan de
  // travail contre le mur (le mur est à 1 m derrière le centre) ---
  const concession = (it) => {
    const hw = it.w / 2;
    const P = frame(it);
    const F = front(it);
    const y0 = yawZ(F);
    const split = hw - 3.2; // à gauche : la vitrine à friandises ; à droite : les caisses et le pop-corn
    // la vitrine : un socle de marbre, deux tablettes de friandises derrière la vitre
    lbox('marbleDark', it, -hw, split, 0, 0.45, 0.05, 0.55, '-y');
    lbox('shelfBlack', it, -hw, split, 0.45, 1.05, 0.05, 0.08);
    for (const y of [0.45, 0.75]) {
      lbox('shelfBlack', it, -hw + 0.02, split - 0.02, y, y + 0.02, 0.08, 0.5);
      goods.shelf(P, -hw + 0.08, split - 0.08, y + 0.02, 0.1, 0.46, 'candy', it.id * 13 + Math.round(y * 10), 0.24, 0.18);
    }
    lbox('glass', it, -hw, split, 0.45, 1.05, 0.535, 0.545);
    for (let lx = -hw; lx <= split + 0.01; lx += (split + hw) / 3) lbox('brass', it, lx - 0.015, lx + 0.015, 0.45, 1.05, 0.52, 0.555, '-y+y');
    // le comptoir plein, le plateau d'inox sur toute la longueur, un jonc de laiton, le repose-pied
    lbox('marbleDark', it, split, hw, 0, 1.05, 0.05, 0.55, '-y');
    lbox('steel', it, -hw - 0.03, hw + 0.03, 1.05, 1.09, 0.02, 0.6);
    lbox('brass', it, -hw - 0.035, hw + 0.035, 1.0, 1.03, 0.55, 0.605, '-y+y');
    {
      const a = P(-hw + 0.2, 0.68);
      const b = P(hw - 0.2, 0.68);
      G.beam('brass', [a[0], 0.2, a[1]], [b[0], 0.2, b[1]], 0.04, 0.04);
      for (let lx = -hw + 0.3; lx < hw; lx += 1.4) {
        const c = P(lx, 0.55);
        const d = P(lx, 0.68);
        G.beam('brass', [c[0], 0.2, c[1]], [d[0], 0.2, d[1]], 0.025, 0.025);
      }
    }
    for (const lx of [split + 0.6, split + 1.5]) {
      const [x, z] = P(lx, 0.25);
      model('CashRegister_01', x, 1.09, z, y0 + PI);
    }
    // la machine à pop-corn, au bout du comptoir : un socle rouge, une cage de verre, le tas de maïs, la marmite
    {
      const lx = hw - 0.65;
      const [x, z] = P(lx, 0.3);
      lbox('red', it, lx - 0.42, lx + 0.42, 1.09, 1.22, 0.02, 0.58, '-y');
      lbox('steel', it, lx - 0.4, lx + 0.4, 1.22, 1.235, 0.04, 0.56);
      for (const sx of [-1, 1]) for (const sz of [0.05, 0.55]) lbox('steel', it, lx + sx * 0.4 - 0.012, lx + sx * 0.4 + 0.012, 1.22, 1.9, sz - 0.012, sz + 0.012, '-y+y');
      lbox('glass', it, lx - 0.4, lx + 0.4, 1.235, 1.9, 0.545, 0.552);
      lbox('glass', it, lx - 0.4, lx + 0.4, 1.235, 1.9, 0.048, 0.055);
      for (const sx of [-1, 1]) lbox('glass', it, lx + sx * 0.4 - 0.004, lx + sx * 0.4 + 0.004, 1.235, 1.9, 0.055, 0.545);
      turn('popcorn', [[0.36, 0], [0.33, 0.07], [0.24, 0.14], [0.12, 0.19], [0, 0.2]], x, 1.235, z, 14);
      cyl('steel', 0.13, 0.11, 0.14, x, 1.66, z, 12);
      cyl('rubber', 0.012, 0.012, 0.1, x, 1.8, z, 6);
      lbox('red', it, lx - 0.44, lx + 0.44, 1.9, 2.12, 0, 0.6);
      const [sx, sz] = P(lx, 0.602);
      goods.sign(SIGN_POPCORN, sx, 2.01, sz, 0.84, 0.105 * 1.6, F[0], F[1], true);
    }
    // contre le mur : le plan de travail d'inox, la fontaine à sodas, des piles de gobelets, le chauffe-nachos
    lbox('shelfBlack', it, -hw, hw, 0, 0.88, -0.98, -0.56, '-y');
    lbox('steel', it, -hw - 0.02, hw + 0.02, 0.88, 0.91, -0.99, -0.54);
    {
      const lx = -1.2;
      lbox('steel', it, lx - 0.55, lx + 0.55, 0.91, 1.5, -0.97, -0.66, '-y');
      lbox('rubber', it, lx - 0.5, lx + 0.5, 0.91, 0.94, -0.66, -0.56);
      for (let i = 0; i < 6; i++) {
        lbox('rubber', it, lx - 0.44 + i * 0.165, lx - 0.36 + i * 0.165, 1.22, 1.34, -0.66, -0.63);
        lbox(i % 3 === 0 ? 'red' : 'steel', it, lx - 0.43 + i * 0.165, lx - 0.37 + i * 0.165, 1.36, 1.44, -0.66, -0.655);
      }
      for (let i = 0; i < 4; i++) {
        const [x, z] = P(lx + 0.85 + i * 0.16, -0.78);
        turn('plastic', [[0.035, 0], [0.047, 0.28 + (i % 2) * 0.08], [0.04, 0.28 + (i % 2) * 0.08], [0, 0.27 + (i % 2) * 0.08]], x, 0.91, z, 10);
      }
    }
    {
      const lx = 1.3;
      lbox('steel', it, lx - 0.35, lx + 0.35, 0.91, 0.99, -0.95, -0.6, '-y');
      lbox('glass', it, lx - 0.34, lx + 0.34, 0.99, 1.36, -0.61, -0.604);
      for (const sx of [-1, 1]) lbox('glass', it, lx + sx * 0.34 - 0.003, lx + sx * 0.34 + 0.003, 0.99, 1.36, -0.94, -0.61);
      lbox('steel', it, lx - 0.36, lx + 0.36, 1.36, 1.41, -0.96, -0.59);
      const [x, z] = P(lx, -0.78);
      turn('popcorn', [[0.26, 0], [0.22, 0.05], [0.1, 0.1], [0, 0.11]], x, 0.99, z, 10);
    }
    {
      const [x, z] = P(-hw + 0.9, -0.76);
      model('vintage_microwave', x, 0.91, z, y0, 0.8);
    }
    // au mur : une tablette de friandises, les trois tableaux des tarifs sous le plafond
    lbox('shelfBlack', it, 2.0, hw - 0.2, 1.5, 1.53, -0.98, -0.68);
    goods.shelf(P, 2.05, hw - 0.25, 1.53, -0.96, -0.7, 'candy', it.id * 7 + 3, 0.26, 0.25);
    for (let i = 0; i < 3; i++) {
      const lx = -hw + 1.5 + i * 3;
      lbox('shelfBlack', it, lx - 1.36, lx + 1.36, 2.62, 3.02, -0.99, -0.94);
      const [x, z] = P(lx, -0.938);
      goods.sign(SIGN_SNACKS + i, x, 2.82, z, 2.64, 0.33, F[0], F[1], i !== 1);
    }
  };

  // --- un stand du food court (le mur est à 1,10 m derrière le centre du comptoir) ---
  const stall = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const F = front(it);
    const y0 = yawZ(F);
    const band = stallMat(it.sign || 0);
    // le comptoir : une plinthe, une façade carrelée ceinte d'une bande à la couleur du stand, le plateau d'inox
    lbox('rubber', it, -hw + 0.03, hw - 0.03, 0, 0.1, -hd + 0.03, hd - 0.03, '-y+y');
    lbox('faience', it, -hw, hw, 0.1, 1.05, -hd, hd, '-y+y');
    lbox(band, it, -hw - 0.004, hw + 0.004, 0.7, 0.86, -hd - 0.004, hd + 0.004, '-y+y');
    lbox('steel', it, -hw - 0.03, hw + 0.03, 1.05, 1.09, -hd - 0.05, hd + 0.05);
    // la rampe à plateaux : deux tubes sur des consoles
    for (const dz of [0.14, 0.26]) {
      const a = P(-hw + 0.1, hd + dz);
      const b = P(hw - 0.1, hd + dz);
      G.beam('steel', [a[0], 0.9, a[1]], [b[0], 0.9, b[1]], 0.028, 0.028);
    }
    for (let lx = -hw + 0.3; lx < hw; lx += 1.35) {
      const a = P(lx, hd);
      const b = P(lx, hd + 0.28);
      G.beam('steel', [a[0], 0.87, a[1]], [b[0], 0.87, b[1]], 0.03, 0.03);
    }
    // le pare-haleine : des potelets, une vitre, une tablette d'inox (le bout de la caisse reste ouvert)
    const g0 = -hw + 1.5;
    for (let lx = g0; lx <= hw - 0.15; lx += (hw - 0.2 - g0) / 3) lbox('steel', it, lx - 0.015, lx + 0.015, 1.09, 1.52, hd - 0.16, hd - 0.13, '-y');
    lbox('glass', it, g0, hw - 0.2, 1.14, 1.5, hd - 0.15, hd - 0.143);
    lbox('steel', it, g0 - 0.03, hw - 0.17, 1.5, 1.52, hd - 0.36, hd - 0.08);
    // le portique : deux poteaux, le bandeau à la couleur du stand, le tableau du menu dessous
    for (const lx of [-hw + 0.04, hw - 0.04]) lbox('steel', it, lx - 0.04, lx + 0.04, 1.09, 3.25, -hd - 0.1, -hd - 0.02, '-y');
    lbox(band, it, -hw - 0.05, hw + 0.05, 3.25, 3.8, -hd - 0.14, -hd + 0.5);
    lbox('steel', it, -hw - 0.06, hw + 0.06, 3.245, 3.29, -hd - 0.15, -hd + 0.51, '+y');
    lbox('shelfBlack', it, -hw + 0.25, hw - 0.25, 2.24, 3.25, -hd - 0.13, -hd - 0.085);
    {
      const [x, z] = P(0, -hd - 0.08);
      panel(it.sign % 3 === 2 ? 'menusOff' : 'menus', menus.uv(it.sign), x, 2.75, z, it.w - 0.6, 0.95, F[0], F[1]);
    }
    // la cuisine, contre le mur : une armoire froide, un plan d'inox, la plaque et sa hotte, une tablette de réserves
    lbox('steel', it, -hw + 0.15, -hw + 0.95, 0, 1.95, -1.08, -0.6, '-y');
    lbox('rubber', it, -hw + 0.545, -hw + 0.555, 0.08, 1.9, -0.6, -0.597);
    for (const lx of [-hw + 0.48, -hw + 0.62]) lbox('rubber', it, lx - 0.012, lx + 0.012, 0.9, 1.3, -0.6, -0.575);
    lbox('steel', it, -hw + 0.95, hw - 0.15, 0, 0.9, -1.08, -0.62, '-y');
    lbox('rubber', it, 0.3, 1.9, 0.9, 0.96, -1.05, -0.66);
    lbox('steel', it, 0.2, 2.0, 1.9, 2.2, -1.08, -0.5);
    lbox('rubber', it, 0.24, 1.96, 1.893, 1.9, -1.04, -0.54, '+y');
    lbox('steel', it, -1.9, 0.0, 1.45, 1.47, -1.08, -0.78);
    goods.shelf(P, -1.85, -0.05, 1.47, -1.06, -0.8, it.sign % 2 ? 'candy' : 'stock', it.id * 11 + 2, 0.3, 0.3);
    if (it.sign % 2 === 0) {
      const [x, z] = P(-0.9, -0.84);
      model('vintage_microwave', x, 0.9, z, y0, 0.8);
    }
    // la caisse sur le comptoir ; ce qui est resté derrière la vitre : des petits pains, des croissants, des pommes, un gâteau
    {
      const [x, z] = P(-hw + 0.8, -0.05);
      model('CashRegister_01', x, 1.09, z, y0 + PI);
    }
    const FOOD = [['hamburger_buns', 1.2], ['croissant', 1.2], ['food_apple_01', 1.3], ['carrot_cake', 1]];
    for (let i = 0; i < 4; i++) {
      if (rand(it.id, i + 7) < 0.35) continue;
      const [name, sc] = FOOD[(it.sign + i) % FOOD.length];
      const [x, z] = P(-hw + 2.0 + i * 0.9, 0.05);
      model(name, x, 1.09, z, rand(it.id, i) * 6, sc);
    }
    if (it.sign % 3 === 1) {
      const [x, z] = P(2.6, hd + 1.5);
      model('standing_chalkboard_01', x, 0, z, y0 + 0.25);
    }
    // des tabourets de bar devant (un renversé)
    for (let i = 0; i < 3; i++) {
      const tip = (it.sign + i) % 5 === 0;
      const [x, z] = P(-1.6 + i * 1.6, hd + 0.75 + (tip ? 0.3 : 0));
      model('bar_chair_round_01', x, tip ? 0.24 : 0, z, rand(it.id, i) * 6, 1, tip ? PI / 2 : 0);
    }
  };

  // --- une caisse à tapis (grand magasin, supermarché) : le tapis, le poste de la caissière, le bac de sortie ---
  const checkout = (it) => {
    const along = it.w >= it.d; // le sens de la caisse : le long de w, ou de d
    const hv = (along ? it.d : it.w) / 2;
    const P = frame(it);
    const B = (k, u0, u1, y0, y1, v0, v1, skip = '') => (along ? lbox(k, it, u0, u1, y0, y1, v0, v1, skip) : lbox(k, it, v0, v1, y0, y1, u0, u1, skip));
    const at = (u, v) => (along ? P(u, v) : P(v, u));
    const hu = (along ? it.w : it.d) / 2;
    B('rubber', -hu + 0.04, hu - 0.04, 0, 0.1, -hv + 0.04, hv - 0.04, '-y+y');
    // le tapis roulant, entre deux rives d'inox
    B('paintGrey', -hu, 0.25, 0.1, 0.82, -hv, hv, '-y');
    B('rubber', -hu + 0.05, 0.25, 0.82, 0.845, -hv + 0.09, hv - 0.09);
    for (const s of [-1, 1]) B('steel', -hu, 0.25, 0.82, 0.88, s > 0 ? hv - 0.09 : -hv, s > 0 ? hv : -hv + 0.09);
    B('steel', -hu, -hu + 0.05, 0.82, 0.88, -hv + 0.09, hv - 0.09);
    for (const u of [-hu + 0.5, -0.35]) if ((it.id + Math.round(u * 3)) % 3) B('red', u - 0.012, u + 0.012, 0.845, 0.875, -hv + 0.1, hv - 0.1);
    // ce qu'on a laissé sur le tapis
    if (it.id % 3 !== 1) {
      const [u0, u1] = [-0.9, -0.62];
      goods.pack((u, d) => at(u, d), u0, u1, 0.845, 1.0, -0.12, 0.1, goods.cellOf(it.id % 2 ? 'candy' : 'stock', it.id * 3), 1, true);
    }
    // le poste : la plaque du scanner, la caisse sur son pupitre, le bac de sortie en contrebas
    B('paintGrey', 0.25, 0.85, 0.1, 0.86, -hv, hv, '-y');
    B('steel', 0.25, 0.85, 0.86, 0.875, -hv, hv);
    B('rubber', 0.36, 0.7, 0.875, 0.879, -0.13, 0.13);
    B('paintGrey', 0.3, 0.8, 0.875, 1.0, -hv, -hv + 0.3, '-y');
    {
      const [x, z] = at(0.55, -hv + 0.15);
      model('CashRegister_01', x, 1.0, z, (along ? 0 : -PI / 2) + (it.face < 0 ? PI : 0), 0.85);
    }
    B('paintGrey', 0.85, hu, 0.1, 0.6, -hv, hv, '-y');
    B('steel', 0.85, hu, 0.6, 0.615, -hv, hv);
    for (const s of [-1, 1]) B('steel', 0.85, hu, 0.615, 0.72, s > 0 ? hv - 0.02 : -hv, s > 0 ? hv : -hv + 0.02);
    B('steel', hu - 0.02, hu, 0.615, 0.72, -hv + 0.02, hv - 0.02);
    // le mât du voyant de caisse (éteint), sa plaque rouge
    {
      const [x, z] = at(0.3, -hv + 0.04);
      cyl('steel', 0.014, 0.014, 1.15, x, 0.86, z, 6);
      B('red', 0.19, 0.41, 1.98, 2.13, -hv + 0.02, -hv + 0.06);
    }
  };

  // --- un comptoir de boutique : une plinthe en retrait, un corps lambrissé à cadres, un plateau de marbre, une vitrine
  // posée dessus, la caisse ---
  const counter = (it) => {
    const r = rooms[it.room];
    if (it.cash && r && (r.kind === 'market' || r.kind === 'store')) return checkout(it);
    const hw = it.w / 2;
    const hd = it.d / 2;
    const P = frame(it);
    const long = it.w >= it.d;
    lbox('rubber', it, -hw + 0.04, hw - 0.04, 0, 0.1, -hd + 0.04, hd - 0.04, '-y+y');
    lbox('wood', it, -hw, hw, 0.1, 0.98, -hd, hd, '-y+y');
    // des cadres en relief sur les deux grandes faces, un jonc de laiton au pied
    const L = long ? hw : hd;
    const T = long ? hd : hw;
    const n = Math.max(1, Math.round((2 * L) / 0.9));
    const Bx = (k, u0, u1, y0, y1, v0, v1, skip = '') => (long ? lbox(k, it, u0, u1, y0, y1, v0, v1, skip) : lbox(k, it, v0, v1, y0, y1, u0, u1, skip));
    for (let i = 0; i < n; i++) {
      const u0 = -L + 0.08 + (i * (2 * L - 0.16)) / n + 0.04;
      const u1 = -L + 0.08 + ((i + 1) * (2 * L - 0.16)) / n - 0.04;
      for (const s of [-1, 1]) Bx('wood', u0, u1, 0.24, 0.84, s > 0 ? T : -T - 0.014, s > 0 ? T + 0.014 : -T, '-y+y');
    }
    Bx('brass', -L - 0.004, L + 0.004, 0.1, 0.13, -T - 0.004, T + 0.004, '-y+y');
    lbox('marbleDark', it, -hw - 0.04, hw + 0.04, 0.98, 1.02, -hd - 0.04, hd + 0.04);
    // une vitrine posée sur le bout du comptoir (les grands comptoirs)
    if (2 * L >= 2.2) {
      const u0 = L - Math.min(1.1, L * 0.8);
      const u1 = L - 0.08;
      Bx('glass', u0, u1, 1.02, 1.24, -T + 0.06, T - 0.06, '-y');
      for (const u of [u0, u1]) for (const v of [-T + 0.06, T - 0.06]) Bx('brass', u - 0.008, u + 0.008, 1.02, 1.245, v - 0.008, v + 0.008, '-y');
      Bx('brass', u0 - 0.01, u1 + 0.01, 1.24, 1.25, -T + 0.05, T - 0.05);
      Bx('cream', u0 + 0.02, u1 - 0.02, 1.02, 1.03, -T + 0.08, T - 0.08, '-y');
    }
    const at = (u, v) => (long ? P(u, v) : P(v, u));
    const sh = K.shopOf(it);
    {
      const [x, z] = at(-L + 0.55, 0);
      model('CashRegister_01', x, 1.02, z, (long ? 0 : PI / 2) + (sh && sh.dir > 0 ? PI : 0));
    }
    {
      const [x, z] = at(-L + 1.25 > L - 0.2 ? 0 : -L + 1.25, -0.05);
      model('stationery_supplies', x, 1.02, z, rand(it.id) * 6);
    }
    if (it.id % 2) {
      const [x, z] = at(Math.min(L - 1.4, 0.1), 0.1);
      model('clipboard', x, 1.025, z, rand(it.id, 1) * 6, 1, -PI / 2);
    }
  };

  // --- une table de food court : un plateau stratifié cerclé d'inox, un fût chromé, un pied de fonte ---
  const TABLE = {
    top: [[0, 0.72], [0.6, 0.72], [0.622, 0.732], [0.622, 0.756], [0.6, 0.765], [0, 0.765]],
    rim: [[0.624, 0.734], [0.624, 0.754]],
    foot: [[0.31, 0], [0.31, 0.018], [0.15, 0.05], [0.07, 0.085], [0.05, 0.13], [0, 0.13]],
  };
  const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, h]) => new THREE.Vector2(r, h)), seg);
  const TGEO = { top: lathe(TABLE.top, 28), rim: lathe(TABLE.rim, 28), foot: lathe(TABLE.foot, 18), stem: new THREE.CylinderGeometry(0.036, 0.036, 0.62, 10).translate(0, 0.42, 0) };
  const diner = (it) => {
    // (renversée : elle repose sur le bord du plateau et celui du pied)
    const place = (g) => (it.tipped ? g.clone().rotateX(1.157).rotateY(it.id * 1.3).translate(it.x + 0.35, 0.275, it.z) : g.clone().translate(it.x, 0, it.z));
    G.add('plastic', place(TGEO.top));
    G.add('steel', place(TGEO.rim));
    G.add('steel', place(TGEO.stem));
    G.add('rubber', place(TGEO.foot));
    for (let i = 0; i < 4; i++) {
      if (!((it.chairs >> i) & 1)) continue;
      const a = (i / 4) * PI * 2 + it.id * 0.3;
      const cx = it.x + Math.cos(a) * 0.95;
      const cz = it.z + Math.sin(a) * 0.95;
      const yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) + (rand(it.id, i) - 0.5) * 0.5;
      if (it.tipped && i === 0) model('plastic_monobloc_chair_01', cx, 0.34, cz, yaw, 1, -PI / 2);
      else model('plastic_monobloc_chair_01', cx, 0, cz, yaw);
    }
  };

  return { fountain, kiosk, concession, stall, counter, diner };
}
