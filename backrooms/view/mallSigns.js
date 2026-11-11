// The Backrooms (Level 17, le Mall) - La signalétique et les portes : les grandes enseignes (Hartwell's, Brandt & Co.,
// The Pavilion, Stardust 8 Cinemas, le parking, Funland), les vantaux des portes de service et de secours (ouverts,
// rabattus contre l'embrasure), les plaques « EXIT » vertes au-dessus de chaque porte, les portes capitonnées des
// salles de cinéma et leurs numéros (les salles 3 à 6 sont fermées ; les salles 7 et 8 n'existent pas). Les textes
// viennent de l'atlas des panneaux (view/mallGoods.js).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE as C } from '../engine/map.js';
import { signUV, anchorUV, ANCHOR, SIGN_EXIT, SIGN_SCREEN, SIGN_SCREENS78, SIGN_PARKING, SIGN_MARKET, SIGN_FLEA, SIGN_GARDEN, SIGN_ANNEX } from './mallGoods.js';

const PI = Math.PI;
const WALL = 2;
const hash = (a, b = 0) => {
  const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return v - Math.floor(v);
};

export function drawMallSigns({ map, fi, G, MATS, rooms, goods, hAt, model, arcade }) {
  const W = map.W;
  const cell = (x, z) => (x < 0 || z < 0 || x >= W || z >= map.H ? WALL : map.grid[z * W + x]);
  const byName = (n) => rooms.find((r) => r.name === n);
  // un panneau d'une matière à atlas quelconque (une case U), centré, tourné vers (nx, nz)
  const panel = (k, U, x, y, z, w, h, nx, nz) => {
    const geo = new THREE.PlaneGeometry(w, h);
    const a = geo.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, a.getX(i) > 0.5 ? U[2] : U[0], a.getY(i) > 0.5 ? U[3] : U[1]);
    G.add(k, geo.rotateY(Math.atan2(nx, nz)).translate(x, y, z));
  };
  // une boîte dans le plan d'un mur : centre (x, z), demi-largeur hw le long du mur, de y0 à y1, de d0 à d1 devant lui
  const slab = (k, x, z, nx, nz, hw, y0, y1, d0, d1) => {
    const ax = x + nx * d0;
    const bx = x + nx * d1;
    const az = z + nz * d0;
    const bz = z + nz * d1;
    if (nx) G.box(k, Math.min(ax, bx), Math.max(ax, bx), y0, y1, z - hw, z + hw);
    else G.box(k, x - hw, x + hw, y0, y1, Math.min(az, bz), Math.max(az, bz));
  };

  // --- 1. Les grandes enseignes, au-dessus des passages (ou suspendues dedans quand le plafond de la cour est bas) ---
  // r : le passage ; (nx, nz) : le côté d'où on la lit ; U : sa case ; w × h ; far : suspendue au fond du passage
  const anchor = (r, nx, nz, U, w, h, lit, far = false) => {
    if (!r) return;
    const mx = ((r.x0 + r.x1 + 1) * C) / 2;
    const mz = ((r.z0 + r.z1 + 1) * C) / 2;
    // le bord du passage, du côté de la cour
    const ex = nx > 0 ? (r.x1 + 1) * C : nx < 0 ? r.x0 * C : mx;
    const ez = nz > 0 ? (r.z1 + 1) * C : nz < 0 ? r.z0 * C : mz;
    const out = hAt(Math.floor((ex + nx * 0.5) / C), Math.floor((ez + nz * 0.5) / C));
    const k = lit ? 'deptLit' : 'deptSign';
    if (!far && out >= r.ceilH + h + 0.3) {
      // au mur, au-dessus de l'ouverture
      const y = r.ceilH + 0.18 + h / 2;
      slab('black', ex, ez, nx, nz, w / 2 + 0.12, y - h / 2 - 0.1, y + h / 2 + 0.1, 0, 0.07);
      panel(k, U, ex + nx * 0.075, y, ez + nz * 0.075, w, h, nx, nz);
    } else {
      // suspendue sous le plafond du passage (au fond : on la voit de loin, sous le plafond bas de la cour)
      const depth = nx ? (r.x1 - r.x0 + 1) * C : (r.z1 - r.z0 + 1) * C;
      const d = far ? depth - 0.5 : 0.5;
      const x = ex - nx * d;
      const z = ez - nz * d;
      const y = r.ceilH - 0.22 - h / 2;
      slab('black', x, z, nx, nz, w / 2 + 0.1, y - h / 2 - 0.08, y + h / 2 + 0.08, -0.05, 0.05);
      panel(k, U, x + nx * 0.056, y, z + nz * 0.056, w, h, nx, nz);
      for (const s of [-0.42, 0.42]) G.beam('steel', [x + (nx ? 0 : s * w), y + h / 2 + 0.08, z + (nz ? 0 : s * w)], [x + (nx ? 0 : s * w), r.ceilH, z + (nz ? 0 : s * w)], 0.03, 0.03);
    }
  };
  anchor(byName("Hartwell's entrance"), 1, 0, anchorUV(ANCHOR.hartwell), 8.8, 1.1, fi === 0);
  anchor(byName('Brandt & Co. entrance'), 0, -1, anchorUV(ANCHOR.brandt), 9.6, 1.2, false);
  anchor(byName('Pavilion entrance'), 0, 1, anchorUV(ANCHOR.pavilion), 8.8, 1.1, true);
  anchor(byName('Cinema entrance'), 0, 1, anchorUV(ANCHOR.stardust), 8.8, 1.1, true, true);
  anchor(byName('Parking entrance'), 0, 1, signUV(SIGN_PARKING), 6.4, 0.8, true);
  // l'annexe : l'enseigne de chaque grande surface à son portail, le fléchage à l'entrée des deux transepts
  anchor(byName('Greenfield Market entrance'), 0, -1, signUV(SIGN_MARKET), 6.4, 0.8, true);
  anchor(byName('Second Chance Antiques entrance'), 0, -1, signUV(SIGN_FLEA), 6.4, 0.8, false);
  anchor(byName('Evergreen Garden Centre entrance'), 0, -1, signUV(SIGN_GARDEN), 6.4, 0.8, true);
  for (const n of ['West transept', 'East transept']) anchor(rooms.find((r) => r.name === n && !r.part), 0, -1, signUV(SIGN_ANNEX), 4.8, 0.6, true);

  // Funland : une enseigne au néon suspendue à l'entrée de chacun de ses deux passages
  if (arcade) {
    const fun = rooms.find((r) => r.kind === 'fun');
    if (fun) {
      const zc = 11 * C;
      for (const [x, nx] of [[(fun.x0 - 2) * C + 0.4, -1], [(fun.x1 + 3) * C - 0.4, 1]]) {
        const top = Math.min(4.3, hAt(Math.floor(x / C), 10) || 3.6);
        const y = top - 0.95;
        G.box('black', x - 0.05, x + 0.05, y - 0.62, y + 0.62, zc - 1.25, zc + 1.25);
        panel('arcLit', arcade.sign('funland'), x + nx * 0.056, y, zc, 2.4, 1.16, nx, 0);
        for (const s of [-1, 1]) G.beam('steel', [x, y + 0.62, zc + s], [x, top, zc + s], 0.03, 0.03);
      }
    }
  }

  // --- 2. Les portes : deux vantaux par porte, leurs ferrures ; au-dessus, la plaque « EXIT » ---
  // dans le repère de la porte : x en travers (le milieu de l'ouverture à 0), z vers l'intérieur du passage
  const tmp = [];
  const part = (k, geo) => tmp.push([k, geo]);
  // un vantail : sa charnière en (hx, 0.04), fermé il va vers +x (side = 1) ou -x (-1) ; phi : son ouverture ;
  // fit : le côté des ferrures (-1 : la face tournée vers le passage quand il est ouvert ; 1 : l'autre)
  const leaf = (style, hx, side, L, phi, fit) => {
    const mat = style === 'screen' ? 'velvet' : style === 'fire' ? 'black' : 'paintGrey';
    const trim = style === 'screen' ? 'brass' : 'steel';
    const P = [];
    P.push([mat, new THREE.BoxGeometry(L, 2.26, 0.045).translate((side * L) / 2, 1.15, 0)]);
    P.push([trim, new THREE.BoxGeometry(L - 0.03, 0.24, 0.006).translate((side * L) / 2, 0.15, fit * 0.026)]);
    if (style === 'screen') {
      // la porte capitonnée d'une salle : un hublot cerclé de laiton, une plaque de propreté
      P.push(['glass', new THREE.CylinderGeometry(0.13, 0.13, 0.012, 18).rotateX(PI / 2).translate(side * L * 0.5, 1.55, fit * 0.024)]);
      P.push([trim, new THREE.TorusGeometry(0.135, 0.012, 5, 20).translate(side * L * 0.5, 1.55, fit * 0.028)]);
      P.push([trim, new THREE.BoxGeometry(0.1, 0.42, 0.006).translate(side * (L - 0.1), 1.12, fit * 0.026)]);
    } else {
      // une porte de service : la barre de poussée, un petit vitrage armé
      P.push([trim, new THREE.BoxGeometry(L * 0.72, 0.05, 0.05).translate((side * L) / 2, 1.02, fit * 0.05)]);
      if (style === 'service') P.push(['glass', new THREE.BoxGeometry(0.16, 0.52, 0.006).translate(side * L * 0.72, 1.55, fit * 0.026)]);
    }
    for (const [k, g] of P) part(k, g.rotateY(-side * phi).translate(hx, 0, 0.04));
  };
  // pose ce qui a été préparé : la porte en (cx, cz), son passage vers (dx, dz)
  const place = (cx, cz, dx, dz) => {
    const th = dz > 0 ? 0 : dz < 0 ? PI : dx > 0 ? PI / 2 : -PI / 2;
    for (const [k, g] of tmp) G.add(k, g.rotateY(th).translate(cx, 0, cz));
    tmp.length = 0;
  };
  const exitSign = (x, z, nx, nz, seed, variant = 0) => {
    const lit = hash(seed, 3) > 0.2;
    slab('black', x, z, nx, nz, 0.29, 2.5, 2.74, 0, 0.05);
    goods.sign(SIGN_EXIT, x + nx * 0.052, 2.62, z + nz * 0.052, 0.52, 0.196, nx, nz, lit, false, signUV(SIGN_EXIT, [0.004, 0.338, 0.668][variant], [0.33, 0.662, 0.996][variant]));
  };

  const doors = new Map((map.doors || []).filter((d) => d.kind === 'service' || d.kind === 'fire' || d.kind === 'screen').map((d) => [d.z * W + d.x, d]));
  for (const d of doors.values()) {
    const alongZ = cell(d.x, d.z - 1) !== WALL && cell(d.x, d.z + 1) !== WALL; // on passe selon z (le mur court le long de x)
    const [ax, az] = alongZ ? [0, 1] : [1, 0];
    if (doors.has((d.z - az) * W + d.x - ax)) continue; // (pas la première case de la porte)
    let n = 1;
    while (doors.has((d.z + az * n) * W + d.x + ax * n)) n++;
    const lx = alongZ ? (d.x + 0.5) * C : d.x * C;
    const lz = alongZ ? d.z * C : (d.z + 0.5) * C;
    const hx = lx + ax * n * C;
    const hz = lz + az * n * C;
    const seed = d.x * 31 + d.z * 17 + fi * 7;
    // les vantaux, ouverts, rabattus dans l'embrasure (celui de droite parfois un peu moins)
    const style = d.kind === 'service' ? 'service' : d.kind === 'screen' ? 'screen' : 'fire';
    const half = C / 2 - 0.115;
    leaf(style, -half, 1, 1.12, PI / 2, -1);
    leaf(style, half, -1, 1.12, hash(seed, 1) < 0.35 ? PI * 0.455 : PI / 2, -1);
    place(lx, lz, ax, az);
    if (d.kind === 'screen') continue; // (les salles : leur numéro, plus bas)
    // « EXIT » des deux côtés, là où le mur monte assez haut
    for (const [x, z, s] of [[lx, lz, -1], [hx, hz, 1]]) {
      const inH = hAt(d.x + (s > 0 ? ax * (n - 1) : 0), d.z + (s > 0 ? az * (n - 1) : 0));
      const outH = hAt(Math.floor((x + s * ax * 0.5) / C), Math.floor((z + s * az * 0.5) / C));
      if (inH >= 2.85 && outH >= 2.85) exitSign(x, z, s * ax, s * az, seed + s);
    }
  }

  // --- 3. Le couloir des salles : les portes fermées des salles 3 à 6, un numéro au-dessus de chaque porte ---
  if (fi === 0 && map.fakeScreens) {
    const plate = (num, x, z) => {
      const U = signUV(SIGN_SCREEN + Math.floor((num - 1) / 2), (num - 1) % 2 ? 0.502 : 0.002, (num - 1) % 2 ? 0.998 : 0.498);
      G.box('black', x - 0.05, x, 2.78, 3.2, z - 0.76, z + 0.76);
      goods.sign(0, x - 0.052, 2.99, z, 1.44, 0.36, -1, 0, num < 3 || num === 4, false, U);
    };
    for (const fs of map.fakeScreens) {
      const x = fs.x * C;
      const z = (fs.z + 0.5) * C;
      // le chambranle, puis les deux vantaux fermés
      G.box('black', x - 0.05, x, 0, 2.36, z - 1.06, z - 0.95, '-y');
      G.box('black', x - 0.05, x, 0, 2.36, z + 0.95, z + 1.06, '-y');
      G.box('black', x - 0.05, x, 2.28, 2.4, z - 1.06, z + 1.06);
      leaf('screen', -0.95, 1, 0.945, 0, 1);
      leaf('screen', 0.95, -1, 0.945, 0, 1);
      place(x, z, -1, 0);
      plate(fs.num, x, z);
    }
    for (const d of doors.values()) if (d.kind === 'screen' && d.num) plate(d.num, d.x * C, (d.z + 0.5) * C);
    // … et la flèche vers les salles 7 et 8, qui montre un mur
    const hall = rooms.find((r) => r.kind === 'cineHall');
    if (hall) {
      const x = hall.x0 * C;
      const z = (hall.z1 - 2) * C;
      G.box('black', x, x + 0.04, 2.16, 2.44, z - 0.98, z + 0.98);
      goods.sign(SIGN_SCREENS78, x + 0.042, 2.3, z, 1.9, 0.24, 1, 0, true);
    }
  }

  // --- 4. Dans le couloir de service du sud, à l'étage : des panneaux « sol glissant », en file, à intervalles égaux ---
  if (fi === 0) {
    const r = byName('Service corridor S');
    if (r) for (let i = 0; i < 11; i++) model('WetFloorSign_01', 110 + i * 2.2, 0, (r.z0 + 0.5) * C, PI / 2, 1.2);
  }
}
