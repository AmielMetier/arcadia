// The Backrooms (Level 2) - L'équipement des chaufferies : chaudières complètes (porte de foyer et son judas, niveau
// d'eau à tube de verre, soupape à levier et contrepoids, plaque du constructeur, rayures jaunes et noires au sol autour
// du socle), la nourrice le long du grand mur (une conduite de distribution sur consoles, ses départs à volant vers le
// plafond et vers le sol, son thermomètre et son manomètre), l'armoire de commande et ses voyants (des feux du moteur
// de lumière), et la pompe sur son socle de béton (moteur à ailettes, accouplement sous carter, volute, refoulement).
// Tout est tiré de la carte (map.plant, map.boilers, map.rooms) : chacun voit les mêmes chaufferies.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE, T } from '../engine/map.js';

const C = CELL_SIZE;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// les rayures de danger peintes au sol, usées par les pas (l'usure laisse voir le béton : alpha)
function hazardTexture() {
  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 32;
  const c = cv.getContext('2d');
  c.fillStyle = '#d9a514';
  c.fillRect(0, 0, 256, 32);
  c.fillStyle = '#1b1a17';
  for (let x = -32; x < 288; x += 32) {
    c.beginPath();
    c.moveTo(x, 32);
    c.lineTo(x + 16, 32);
    c.lineTo(x + 32, 0);
    c.lineTo(x + 16, 0);
    c.fill();
  }
  // usure : la peinture part par écailles (trous), surtout au milieu de la bande
  const d = c.getImageData(0, 0, 256, 32);
  let s = 77;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 140; k++) {
    const cx = r() * 256;
    const cy = 4 + r() * 24;
    const rad = 1 + r() * 4.5;
    for (let y = Math.max(0, Math.floor(cy - rad)); y < Math.min(32, cy + rad); y++) {
      for (let x = Math.max(0, Math.floor(cx - rad * 1.6)); x < Math.min(256, cx + rad * 1.6); x++) {
        if (((x - cx) / 1.6) ** 2 + (y - cy) ** 2 < rad * rad) d.data[(y * 256 + x) * 4 + 3] = 0;
      }
    }
  }
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (r() - 0.5) * 26;
    d.data[i] = Math.max(0, d.data[i] + n);
    d.data[i + 1] = Math.max(0, d.data[i + 1] + n);
    d.data[i + 2] = Math.max(0, d.data[i + 2] + n);
  }
  c.putImageData(d, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

export function buildPlant({ map, group, bin, lambert, phong, M, tx, CEIL, at, rnd }) {
  const W = map.W;
  const H = map.H;
  const dummy = new THREE.Object3D();
  dummy.rotation.order = 'YXZ';
  // une instance : rotation d'abord autour de z, puis de x, puis de y (l'orientation du mur)
  const put = (b, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    dummy.position.set(x, y, z);
    dummy.rotation.set(rx, ry, rz, 'YXZ');
    dummy.scale.set(sx, sy, sz);
    dummy.updateMatrix();
    b.m.push(dummy.matrix.clone());
  };
  // un repère posé contre un mur : origine sur la face du mur, +z sort du mur, +x à droite quand on lui fait face
  const frame = (ox, oz, ry) => {
    const c = Math.cos(ry);
    const s = Math.sin(ry);
    const P = (lx, lz) => [ox + lx * c + lz * s, oz - lx * s + lz * c];
    return {
      P,
      box: (b, lx, y, lz, sx, sy, sz) => {
        const [x, z] = P(lx, lz);
        put(b, x, y, z, sx, sy, sz, 0, ry, 0);
      },
      // cylindre (rayon 1, hauteur 1) d'axe local x, y ou z
      cyl: (b, axis, lx, y, lz, r, len) => {
        const [x, z] = P(lx, lz);
        if (axis === 'x') put(b, x, y, z, r, len, r, 0, ry, Math.PI / 2);
        else if (axis === 'z') put(b, x, y, z, r, len, r, Math.PI / 2, ry, 0);
        else put(b, x, y, z, r, len, r, 0, ry, 0);
      },
      // anneau (tore de rayon 1) autour d'un axe local
      ring: (b, axis, lx, y, lz, r) => {
        const [x, z] = P(lx, lz);
        if (axis === 'z') put(b, x, y, z, r, r, r, 0, ry, 0);
        else if (axis === 'x') put(b, x, y, z, r, r, r, 0, ry + Math.PI / 2, 0);
        else put(b, x, y, z, r, r, r, Math.PI / 2, ry, 0);
      },
    };
  };
  const unitBox = new THREE.BoxGeometry(1, 1, 1);
  const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 20);
  const cylGeoS = new THREE.CylinderGeometry(1, 1, 1, 10);
  const torusGeo = new THREE.TorusGeometry(1, 0.1, 6, 24);
  const sphGeo = new THREE.SphereGeometry(1, 14, 10);
  const planeGeo = new THREE.PlaneGeometry(1, 1);
  const discGeo = new THREE.CircleGeometry(1, 24);

  const P_ = {
    panel: phong({ map: tx.pipe.steel, color: '#8aa092', shininess: 45, specular: '#333' }, 0.4, 35),
    motor: phong({ map: tx.pipe.steel, color: '#5e8fa0', shininess: 50, specular: '#3a3a3a' }, 0.45, 40),
    volute: phong({ map: tx.pipe.iron, color: '#c9563a', shininess: 30, specular: '#2a2a2a' }, 0.25, 25),
    guard: phong({ map: tx.pipe.steel, color: '#e0a21c', shininess: 40, specular: '#333' }, 0.35, 30),
    brass: phong({ color: '#8a6526', shininess: 60, specular: '#5a4a28' }, 0.5, 50),
    glass: phong({ color: '#22302a', shininess: 120, specular: '#aaaaaa' }, 0.9, 140),
    water: phong({ color: '#6f8f7c', shininess: 120, specular: '#999999' }, 0.8, 120),
    header: phong({ map: tx.pipe.galv, color: '#b4533a', shininess: 35, specular: '#2a2a2a' }, 0.3, 30),
    lag: lambert({ map: tx.pipe.lagging }),
    black: lambert({ color: '#151514' }),
    white: lambert({ color: '#d8d4c8' }),
    hazard: lambert({ map: hazardTexture(), alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    blueWheel: phong({ color: '#1f4fa0', shininess: 50, specular: '#334' }, 0.4, 40),
  };
  P_.hazard.map.repeat.x = 2; // une bande de 2,46 m : des chevrons à 45°
  const gaugeMat = lambert({ map: tx.gauge });
  const lit = []; // les petits feux de couleur : judas des foyers, voyants des armoires
  const flick = []; // ce qui vacille avec la flamme

  // --- 1. Les chaudières complètes ---
  for (const b of map.boilers || []) {
    // le côté du brûleur : le plus dégagé (comme dans pipes.js)
    const d = DIRS.map(([dx, dz]) => [dx, dz, at(b.gx + dx, b.gz + dz) === T.FLOOR ? 1 : 0]).sort((p, q) => q[2] - p[2])[0];
    const ry = Math.atan2(d[0], d[1]); // +z local : vers le brûleur
    const f = frame(b.x, b.z, ry);
    // la porte du foyer au-dessus du brûleur : cadre, battant épais, deux gonds, loquet, et le judas où danse la flamme
    f.box(bin('pf-frame', unitBox, M.iron), 0, 1.02, 0.86, 0.6, 0.52, 0.1);
    f.box(bin('pf-door', unitBox, M.lampMetal), 0.02, 1.02, 0.93, 0.48, 0.42, 0.06);
    for (const y of [0.88, 1.16]) f.cyl(bin('pf-hinge', cylGeoS, M.iron), 'y', -0.25, y, 0.95, 0.025, 0.09);
    f.box(bin('pf-latch', unitBox, M.handle), 0.2, 1.02, 0.975, 0.16, 0.035, 0.03);
    const [px, pz] = f.P(0.02, 0.965);
    const peep = new THREE.Mesh(new THREE.CircleGeometry(0.045, 16), new THREE.MeshBasicMaterial({ color: '#ff8a2a' }));
    peep.position.set(px, 1.08, pz);
    peep.rotation.y = ry;
    group.add(peep);
    flick.push({ mat: peep.material, ph: rnd() * 10, k: 1.25, v: b.valve });
    f.ring(bin('pf-peepring', torusGeo, M.handle), 'z', 0.02, 1.08, 0.963, 0.05);
    // le niveau d'eau : deux robinets et un tube de verre entre eux, l'eau au tiers ; tourné de 50° vers la gauche
    const fl = frame(b.x, b.z, ry - 0.85);
    fl.box(bin('lv-tap', unitBox, M.handle), 0, 1.25, 0.94, 0.07, 0.07, 0.1);
    fl.box(bin('lv-tap', unitBox, M.handle), 0, 1.82, 0.94, 0.07, 0.07, 0.1);
    fl.cyl(bin('lv-glass', cylGeoS, P_.glass), 'y', 0, 1.535, 0.99, 0.022, 0.52);
    fl.cyl(bin('lv-water', cylGeoS, P_.water), 'y', 0, 1.39, 0.99, 0.024, 0.22);
    for (const x of [-0.035, 0.035]) fl.box(bin('lv-guard', unitBox, M.iron), x, 1.535, 1.0, 0.008, 0.5, 0.012);
    // la plaque du constructeur (laiton), tournée de l'autre côté
    const fp = frame(b.x, b.z, ry + 0.75);
    fp.box(bin('plate', unitBox, P_.brass), 0, 1.6, 0.91, 0.3, 0.17, 0.015);
    // la soupape sur le dôme : corps, levier, contrepoids rouge
    const fs = frame(b.x, b.z, ry + Math.PI * 0.5);
    fs.cyl(bin('sv-body', cylGeoS, M.iron), 'y', 0, 2.5, -0.35, 0.06, 0.22);
    fs.box(bin('sv-lever', unitBox, M.iron), 0.2, 2.62, -0.35, 0.46, 0.025, 0.025);
    fs.cyl(bin('sv-ball', sphGeo, M.wheel), 'y', 0.42, 2.62, -0.35, 0.06, 0.06);
    // les rivets : une rangée sur chaque cerclage et une couture verticale, à l'arrière
    for (const y of [0.42, 1.27, 2.12]) {
      for (let i = 0; i < 30; i++) {
        const a = (i / 30) * Math.PI * 2;
        put(bin('rivet', sphGeo, M.boiler), b.x + Math.sin(a) * 0.905, y, b.z + Math.cos(a) * 0.905, 0.018, 0.018, 0.018);
      }
    }
    for (let y = 0.5; y < 2.1; y += 0.12) {
      const [x, z] = f.P(0, -0.905);
      put(bin('rivet', sphGeo, M.boiler), x, y, z, 0.018, 0.018, 0.018);
    }
    // les rayures au sol autour du socle, du côté des passages
    for (const [dx, dz] of DIRS) {
      if (at(b.gx + dx, b.gz + dz) === T.WALL) continue;
      const x = b.x + dx * 1.22;
      const z = b.z + dz * 1.22;
      // (la bande court le long du côté : tournée d'un quart de tour quand elle longe z)
      put(bin('hazard', planeGeo, P_.hazard), x, 0.008, z, 2.46, 0.16, 1, -Math.PI / 2, dz ? 0 : Math.PI / 2, 0);
    }
  }

  // --- 2. La nourrice de chaque chaufferie : le long du plus long pan de mur sans porte ---
  // (un pan s'arrête à une chaudière, à la pompe et à son refoulement, à la vanne de la pièce et à une lampe du
  // même mur : la nourrice passerait au travers)
  const plantAt = new Set((map.plant || []).map((p) => p.gz * W + p.gx));
  const stop = new Set([
    ...(map.plant || []).filter((p) => p.kind === 'pump').map((p) => p.gz * W + p.gx + ',' + p.dx + ',' + p.dz),
    ...(map.valves || []).map((v) => v.gz * W + v.gx + ',' + v.dx + ',' + v.dz),
    ...(map.lights || []).filter((l) => l.wall).map((l) => l.gz * W + l.gx + ',' + l.wall[0] + ',' + l.wall[1]),
  ]);
  for (const r of map.rooms || []) {
    if (r.type !== 'boiler') continue;
    let best = null;
    for (const [dx, dz] of DIRS) {
      // les cases le long du mur de ce côté
      const cells = [];
      if (dx) for (let z = r.z0; z <= r.z1; z++) cells.push([dx > 0 ? r.x1 : r.x0, z]);
      else for (let x = r.x0; x <= r.x1; x++) cells.push([x, dz > 0 ? r.z1 : r.z0]);
      let run = [];
      const flush = () => {
        if (run.length >= 3 && (!best || run.length > best.run.length)) best = { run, dx, dz };
        run = [];
      };
      for (const [x, z] of cells) {
        const free = at(x, z) !== T.WALL && at(x, z) !== T.MACHINE && at(x + dx, z + dz) === T.WALL && !stop.has(z * W + x + ',' + dx + ',' + dz);
        if (free) run.push([x, z]);
        else flush();
      }
      flush();
    }
    if (!best) continue;
    const { run, dx, dz } = best;
    const ry = Math.atan2(-dx, -dz);
    const a = run[0];
    const z0 = run[run.length - 1];
    // repère : origine au milieu du pan, sur la face du mur
    const mx = ((a[0] + z0[0]) / 2 + 0.5) * C + dx * (C / 2);
    const mz = ((a[1] + z0[1]) / 2 + 0.5) * C + dz * (C / 2);
    const f = frame(mx, mz, ry);
    const len = run.length * C - 0.9;
    // sens : +x local le long du pan (de run[0] vers la fin, ou l'inverse : peu importe, symétrique)
    const Y = 2.5;
    const R = 0.12;
    const OZ = 0.32;
    f.cyl(bin('hd-pipe', cylGeo, P_.header), 'x', 0, Y, OZ, R, len);
    for (const s of [-1, 1]) {
      f.cyl(bin('hd-cap', cylGeo, M.iron), 'x', (s * len) / 2, Y, OZ, R * 1.12, 0.06);
      f.cyl(bin('hd-cap', cylGeo, M.iron), 'x', (s * len) / 2 + s * 0.04, Y, OZ, R * 0.7, 0.05);
    }
    // les consoles au mur
    for (let x = -len / 2 + 0.4; x <= len / 2 - 0.3; x += 1.6) {
      f.box(bin('hd-bracket', unitBox, M.frame), x, Y - R - 0.03, OZ / 2 + 0.05, 0.06, 0.05, OZ + 0.1);
      f.box(bin('hd-bracket', unitBox, M.frame), x, Y - 0.06, 0.03, 0.08, 0.32, 0.04);
      f.ring(bin('hd-strap', torusGeo, M.iron), 'x', x, Y, OZ, R * 1.04);
    }
    // les départs : vers le plafond ou vers le sol, chacun avec sa vanne à volant ; tous les 1,25 m
    let k = 0;
    for (let x = -len / 2 + 0.75; x <= len / 2 - 0.5; x += 1.25, k++) {
      // la case au pied du départ : pas de descente devant l'armoire, la pompe ou la vanne
      const [wx, wz] = f.P(x, OZ);
      const blocked = plantAt.has(Math.floor(wz / C) * W + Math.floor(wx / C));
      const down = !blocked && k % 2 === 1;
      const r2 = 0.065;
      f.cyl(bin('hd-tee', cylGeo, M.iron), 'y', x, Y, OZ, R * 1.05, 0.2);
      if (down) {
        f.cyl(bin('hd-branch', cylGeo, M.galv), 'y', x, (Y - R) / 2, OZ, r2, Y - R);
        f.cyl(bin('hd-flange', cylGeo, M.iron), 'y', x, 0.08, OZ, r2 * 1.7, 0.05);
      } else {
        f.cyl(bin('hd-branch', cylGeo, M.galv), 'y', x, (Y + R + CEIL) / 2, OZ, r2, CEIL - Y - R);
      }
      // la vanne : corps, chapeau, tige, volant rouge (ou bleu pour l'eau froide) tourné vers la salle
      const vy = down ? 1.45 : Y + 0.38;
      f.cyl(bin('hd-vbody', sphGeo, M.iron), 'y', x, vy, OZ, 0.095, 0.11);
      f.cyl(bin('hd-vbonnet', cylGeoS, M.iron), 'z', x, vy, OZ + 0.12, 0.04, 0.16);
      f.cyl(bin('hd-vstem', cylGeoS, M.handle), 'z', x, vy, OZ + 0.24, 0.011, 0.12);
      const wb = k % 3 === 2 ? bin('hd-wheelB', torusGeo, P_.blueWheel) : bin('hd-wheel', torusGeo, M.wheel);
      f.ring(wb, 'z', x, vy, OZ + 0.3, 0.13);
      for (const a2 of [0, Math.PI / 2]) {
        const [sx, sz] = f.P(x, OZ + 0.3);
        put(k % 3 === 2 ? bin('hd-spokeB', unitBox, P_.blueWheel) : bin('hd-spoke', unitBox, M.wheel), sx, vy, sz, 0.24, 0.016, 0.016, 0, ry, a2);
      }
      // l'étiquette pendue à la tige : un rond de laiton
      const [tx2, tz2] = f.P(x + 0.08, OZ + 0.2);
      put(bin('hd-tag', cylGeoS, P_.brass), tx2, vy - 0.1, tz2, 0.035, 0.004, 0.035, Math.PI / 2, ry, 0);
    }
    // les conduites des chaudières de la pièce, calorifugées, qui rejoignent la nourrice par en haut : elles montent
    // du dôme, traversent la salle sous la dalle sur leurs suspentes, et plongent dans la nourrice
    const inv = (wx, wz) => {
      const c = Math.cos(ry);
      const s = Math.sin(ry);
      const ux = wx - mx;
      const uz = wz - mz;
      return [ux * c - uz * s, ux * s + uz * c];
    };
    const YO = 2.98;
    const RL = 0.11;
    for (const b of map.boilers || []) {
      if (b.gx < r.x0 || b.gx > r.x1 || b.gz < r.z0 || b.gz > r.z1) continue;
      const [bx, bz] = inv(b.x, b.z);
      const xe = Math.max(-len / 2 + 0.3, Math.min(len / 2 - 0.3, bx));
      f.cyl(bin('lg-pipe', cylGeo, P_.lag), 'y', bx, (2.5 + YO) / 2, bz, RL, YO - 2.5);
      f.cyl(bin('lg-pipe', cylGeo, P_.lag), 'z', bx, YO, (bz + OZ) / 2, RL, Math.abs(bz - OZ));
      if (Math.abs(xe - bx) > 0.05) f.cyl(bin('lg-pipe', cylGeo, P_.lag), 'x', (bx + xe) / 2, YO, OZ, RL, Math.abs(xe - bx));
      f.cyl(bin('lg-pipe', cylGeo, P_.lag), 'y', xe, (Y + R + YO) / 2, OZ, RL * 0.8, YO - Y - R);
      for (const [x, z] of [[bx, bz], [bx, OZ], [xe, OZ]]) f.cyl(bin('lg-elbow', sphGeo, P_.lag), 'y', x, YO, z, RL, RL);
      // les bandes d'aluminium du calorifuge, et les suspentes
      for (let z = Math.min(bz, OZ) + 0.5; z < Math.max(bz, OZ) - 0.3; z += 1.1) {
        f.ring(bin('lg-band', torusGeo, M.galv), 'z', bx, YO, z, RL * 1.02);
        f.cyl(bin('lg-rod', cylGeoS, M.iron), 'y', bx, (YO + RL + CEIL) / 2, z, 0.01, CEIL - YO - RL);
      }
    }
    // un thermomètre et un grand manomètre sur la nourrice
    for (const [x, big] of [[-len / 2 + 0.35, true], [len / 2 - 0.3, false]]) {
      const rr = big ? 0.13 : 0.08;
      f.cyl(bin('hd-gpipe', cylGeoS, M.copper), 'y', x, Y - R - 0.12, OZ, 0.012, 0.24);
      f.cyl(bin('hd-gbody', cylGeo, M.iron), 'z', x, Y - R - 0.24 - rr, OZ + 0.02, rr, 0.06);
      const [gx, gz] = f.P(x, OZ + 0.055);
      put(bin(big ? 'hd-gface' : 'hd-gfaceS', discGeo, gaugeMat), gx, Y - R - 0.24 - rr, gz, rr * 0.88, rr * 0.88, 1, 0, ry, 0);
    }
  }

  // --- 3. Les armoires de commande ---
  const panels = [];
  for (const p of map.plant || []) {
    const ox = (p.gx + 0.5) * C + p.dx * (C / 2);
    const oz = (p.gz + 0.5) * C + p.dz * (C / 2);
    const f = frame(ox, oz, p.ry);
    if (p.kind === 'panel') {
      f.box(bin('pn-plinth', unitBox, P_.black), 0, 0.05, 0.23, 1.0, 0.1, 0.4);
      f.box(bin('pn-body', unitBox, P_.panel), 0, 1.0, 0.23, 1.0, 1.8, 0.45);
      f.box(bin('pn-seam', unitBox, P_.black), 0, 1.0, 0.457, 0.012, 1.7, 0.01);
      for (const x of [-0.08, 0.08]) f.box(bin('pn-handle', unitBox, M.handle), x, 1.0, 0.475, 0.025, 0.16, 0.03);
      f.box(bin('pn-roof', unitBox, P_.panel), 0, 1.92, 0.23, 1.06, 0.04, 0.5);
      // la gaine des câbles jusqu'au plafond
      f.box(bin('pn-duct', unitBox, M.frame), 0.3, (1.94 + CEIL) / 2, 0.12, 0.16, CEIL - 1.94, 0.1);
      // deux cadrans et l'étiquette
      for (const x of [-0.27, 0.27]) {
        f.box(bin('pn-meter', unitBox, P_.black), x, 1.32, 0.465, 0.2, 0.2, 0.02);
        const [mx, mz] = f.P(x, 0.477);
        put(bin('pn-mface', discGeo, gaugeMat), mx, 1.32, mz, 0.085, 0.085, 1, 0, p.ry, 0);
      }
      f.box(bin('pn-label', unitBox, P_.white), 0, 1.74, 0.462, 0.42, 0.08, 0.008);
      // le bouton d'arrêt d'urgence : un champignon rouge sur un socle jaune
      f.box(bin('pn-estopbase', unitBox, P_.guard), 0.3, 1.0, 0.465, 0.12, 0.12, 0.02);
      f.cyl(bin('pn-estop', sphGeo, M.wheel), 'z', 0.3, 1.0, 0.48, 0.045, 0.025);
      // les voyants : une rangée de cinq
      const lamps = [];
      for (let i = 0; i < 5; i++) {
        const x = -0.3 + i * 0.15;
        f.cyl(bin('pn-bezel', cylGeoS, M.handle), 'z', x, 1.56, 0.465, 0.034, 0.02);
        const m = new THREE.Mesh(sphGeo, new THREE.MeshBasicMaterial({ color: '#000000' }));
        const [lx, lz] = f.P(x, 0.475);
        m.position.set(lx, 1.56, lz);
        m.scale.set(0.026, 0.026, 0.016);
        m.rotation.y = p.ry;
        group.add(m);
        lamps.push(m);
      }
      // la vanne de la pièce : son voyant suit son état
      const valve = (map.valves || []).find((v) => Math.abs(v.gx - p.gx) + Math.abs(v.gz - p.gz) <= 8);
      const [ax, az] = f.P(0, 0.62);
      panels.push({ lamps, valve, ph: rnd() * 10, at: { x: ax, y: 1.5, z: az }, nx: -p.dx, nz: -p.dz, col: new THREE.Color() });
    } else if (p.kind === 'pump') {
      // le socle de béton, long le long du mur
      f.box(bin('pp-plinth', unitBox, M.concrete), 0, 0.09, 0.36, 1.3, 0.18, 0.62);
      f.box(bin('pp-frame', unitBox, M.frame), 0, 0.2, 0.36, 1.18, 0.05, 0.42);
      // le moteur : carcasse à ailettes, capot du ventilateur, boîte à bornes
      f.cyl(bin('pp-motor', cylGeo, P_.motor), 'x', -0.25, 0.46, 0.36, 0.19, 0.5);
      for (let i = 0; i < 7; i++) f.ring(bin('pp-fin', torusGeo, P_.motor), 'x', -0.46 + i * 0.07, 0.46, 0.36, 0.19);
      f.cyl(bin('pp-fan', cylGeo, P_.motor), 'x', -0.55, 0.46, 0.36, 0.17, 0.12);
      f.box(bin('pp-term', unitBox, P_.motor), -0.2, 0.69, 0.36, 0.18, 0.08, 0.16);
      for (const s of [-1, 1]) f.box(bin('pp-foot', unitBox, P_.motor), -0.25, 0.27, 0.36 + s * 0.14, 0.4, 0.08, 0.05);
      // l'accouplement sous son carter jaune
      f.box(bin('pp-guard', unitBox, P_.guard), 0.09, 0.46, 0.36, 0.2, 0.22, 0.24);
      // la volute et ses pieds
      f.cyl(bin('pp-volute', cylGeo, P_.volute), 'x', 0.33, 0.47, 0.36, 0.25, 0.2);
      f.cyl(bin('pp-eye', cylGeo, P_.volute), 'x', 0.48, 0.47, 0.36, 0.1, 0.14);
      f.box(bin('pp-vfoot', unitBox, P_.volute), 0.33, 0.25, 0.36, 0.18, 0.1, 0.3);
      // l'aspiration (vers le mur, puis dans le sol) et le refoulement (vers le plafond), clapet et manomètre
      f.cyl(bin('pp-pipe', cylGeo, M.galv), 'x', 0.62, 0.47, 0.36, 0.08, 0.2);
      f.cyl(bin('pp-flange', cylGeo, M.iron), 'x', 0.56, 0.47, 0.36, 0.13, 0.04);
      f.cyl(bin('pp-elbow', sphGeo, M.galv), 'y', 0.74, 0.47, 0.36, 0.09, 0.09);
      f.cyl(bin('pp-pipe', cylGeo, M.galv), 'y', 0.74, 0.24, 0.36, 0.08, 0.46);
      f.cyl(bin('pp-pipe', cylGeo, M.galv), 'y', 0.33, (0.72 + CEIL) / 2, 0.36, 0.075, CEIL - 0.72);
      f.cyl(bin('pp-flange', cylGeo, M.iron), 'y', 0.33, 0.74, 0.36, 0.12, 0.04);
      f.cyl(bin('pp-check', cylGeo, M.iron), 'y', 0.33, 1.15, 0.36, 0.11, 0.22);
      f.cyl(bin('pp-flange', cylGeo, M.iron), 'y', 0.33, 1.02, 0.36, 0.13, 0.03);
      f.cyl(bin('pp-flange', cylGeo, M.iron), 'y', 0.33, 1.28, 0.36, 0.13, 0.03);
      f.cyl(bin('hd-gpipe', cylGeoS, M.copper), 'z', 0.33, 1.5, 0.48, 0.01, 0.14);
      f.cyl(bin('hd-gbody', cylGeo, M.iron), 'z', 0.33, 1.5, 0.57, 0.08, 0.05);
      const [gx, gz] = f.P(0.33, 0.597);
      put(bin('hd-gfaceS', discGeo, gaugeMat), gx, 1.5, gz, 0.07, 0.07, 1, 0, p.ry, 0);
      // le câble du moteur, dans sa gaine, jusqu'au plafond
      f.box(bin('pn-duct', unitBox, M.frame), -0.2, (0.73 + CEIL) / 2, 0.08, 0.06, CEIL - 0.73, 0.05);
    }
  }

  const tmp = new THREE.Color();
  return {
    // le moteur de lumière : un voyant d'armoire teinte le mur et le sol autour de lui ; le judas d'un foyer, peu
    lights(out) {
      for (const p of panels) {
        const c = p.col;
        out.push({ x: p.at.x, y: p.at.y, z: p.at.z, r: c.r, g: c.g, b: c.b, rad: 1.7, nx: p.nx, ny: -0.1, nz: p.nz, w: -0.5 });
      }
    },
    update(time, dt) {
      for (const fl of flick) {
        const v = (map.valves || [])[fl.v];
        fl.fire = Math.max(0.15, Math.min(1, (fl.fire ?? 1) + (v && v.closed ? -dt * 0.4 : dt * 0.8)));
        const k = (0.55 + Math.sin(time * 7 + fl.ph) * 0.15 + Math.sin(time * 23 + fl.ph * 3) * 0.1 + Math.random() * 0.1) * fl.k * fl.fire;
        fl.mat.color.setRGB(1.6 * k, 0.62 * k, 0.15 * k);
      }
      for (const p of panels) {
        p.col.setRGB(0, 0, 0);
        const v = p.valve;
        const on = !v || v.power !== 2; // le secteur a du courant
        p.lamps.forEach((m, i) => {
          let c;
          if (!on) c = i === 0 && Math.sin(time * 5) > 0 ? '#ff2a1a' : '#000000';
          else if (i === 0) c = v && v.closed ? '#2bff6a' : '#ff2a1a'; // la vanne de la pièce
          else if (i === 1) c = v && v.closed ? '#000000' : '#2bff6a'; // le brûleur
          else if (i === 2) c = Math.sin(time * 3.1 + p.ph) > 0.2 ? '#ffb020' : '#000000'; // l'alarme de pression
          else if (i === 3) c = '#2bff6a';
          else c = Math.random() < 0.97 ? '#e8f0ff' : '#000000';
          m.material.color.set(c);
          tmp.set(c);
          p.col.r += tmp.r * 0.16;
          p.col.g += tmp.g * 0.16;
          p.col.b += tmp.b * 0.16;
          m.material.color.multiplyScalar(2.2); // l'ampoule brille plus fort que sa couleur seule
        });
      }
    },
  };
}
