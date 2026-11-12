// La descente de l'escalier de secours (Level 5, le Terror Hotel → Level 17, le Mall). La porte coupe-feu passée, on
// dévale une cage de béton, volée après volée, de plus en plus vite : les paliers défilent, leurs numéros peints au
// pochoir décroissent, les hublots grésillent. En deux temps, de part et d'autre de l'écran de chargement, comme la
// glissade des Poolrooms (slide.js) : start() dévale jusqu'au noir (le niveau suivant se charge, hold()), finish()
// reprend plus bas ; les derniers étages, puis un palier qui ne devrait pas exister, numéroté 17 : sa porte s'ouvre
// sur la lumière du centre commercial (onEnd).
// Rendu avec le moteur partagé de la scène et le même filtre de caméscope (vhs.js), sans scène du niveau.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { createVhsFilter } from './vhs.js';

const H = 3.2; // d'un palier d'étage au suivant
const STEPS = 10; // marches par volée (deux volées par étage)
const TREAD = 0.28;
const RUN = STEPS * TREAD;
const RISE = H / 2 / STEPS;
const W = 1.2; // largeur d'une volée
const GAP = 0.2; // le jour entre les deux volées
const LAND = 1.4; // profondeur d'un palier
const D = 2 * W + GAP; // profondeur de la cage
const ZA = W / 2; // l'axe de la volée qui part du palier d'étage
const ZB = W + GAP + W / 2; // l'axe de celle qui y arrive
const EYE = 1.6;
const TURN_R = 0.7;
const TURN_X = 0.45; // le demi-tour se fait à 45 cm du nez des marches
const FLOORS = 5;
const V0 = 3.3;
const ACC = 0.5;
const VMAX = 6.6;
export const STAIR_LABELS = { one: ['13', '12', '11', '10', '9'], two: ['2', '1', '17', '', ''] };

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const smooth = (v) => {
  const t = clamp01(v);
  return t * t * (3 - 2 * t);
};
const canvasOf = (w, h) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
};
const texOf = (c, rep = false) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
};

// le béton banché de la cage : des lits de coffrage, des coulures, la crasse à hauteur de main
function concreteTex() {
  const [c, g] = canvasOf(512, 512);
  g.fillStyle = '#77756e';
  g.fillRect(0, 0, 512, 512);
  let s = 4242;
  const R = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < 2600; i++) {
    const v = 90 + R() * 60;
    g.fillStyle = `rgba(${v},${v - 2},${v - 8},0.18)`;
    g.fillRect(R() * 512, R() * 512, 1 + R() * 3, 1 + R() * 3);
  }
  for (let y = 0; y < 512; y += 128) {
    g.fillStyle = 'rgba(30,28,24,0.4)';
    g.fillRect(0, y, 512, 2);
    for (let x = 40; x < 512; x += 120) {
      g.beginPath();
      g.arc(x + (y % 256 ? 60 : 0), y + 64, 4, 0, 7);
      g.fill();
    }
  }
  for (let i = 0; i < 16; i++) {
    const x = R() * 512;
    const gr = g.createLinearGradient(0, 0, 0, 512);
    gr.addColorStop(0, 'rgba(20,16,10,0)');
    gr.addColorStop(R() * 0.5, 'rgba(20,16,10,0.34)');
    gr.addColorStop(1, 'rgba(20,16,10,0)');
    g.fillStyle = gr;
    g.fillRect(x, 0, 3 + R() * 12, 512);
  }
  const band = g.createLinearGradient(0, 300, 0, 400);
  band.addColorStop(0, 'rgba(20,16,10,0)');
  band.addColorStop(0.5, 'rgba(20,16,10,0.2)');
  band.addColorStop(1, 'rgba(20,16,10,0)');
  g.fillStyle = band;
  g.fillRect(0, 300, 512, 100);
  return texOf(c, true);
}
// le numéro du palier, au pochoir (fond transparent)
function labelTex() {
  const [c, g] = canvasOf(256, 256);
  const t = texOf(c);
  const draw = (txt, sub = '') => {
    g.clearRect(0, 0, 256, 256);
    if (!txt) {
      t.needsUpdate = true;
      return;
    }
    g.fillStyle = txt === '17' ? '#b3261c' : '#1d1b18';
    g.textAlign = 'center';
    g.font = `bold ${txt.length > 1 ? 168 : 190}px "Arial Narrow", Impact, Arial, sans-serif`;
    g.fillText(txt, 128, 176);
    if (sub) {
      g.font = 'bold 22px "Arial Narrow", Arial, sans-serif';
      g.fillText(sub, 128, 222);
    }
    // le pochoir : des ponts dans la peinture, des manques
    g.globalCompositeOperation = 'destination-out';
    g.fillRect(0, 112, 256, 5);
    for (let i = 0; i < 90; i++) g.fillRect((i * 97) % 256, 30 + ((i * 61) % 170), 2 + (i % 4), 2 + (i % 3));
    g.globalCompositeOperation = 'source-over';
    t.needsUpdate = true;
  };
  return { tex: t, draw };
}
// la porte coupe-feu : tôle grise, un petit vitrage armé, des griffures ; l'enseigne EXIT (éteinte ou allumée)
function doorTex() {
  const [c, g] = canvasOf(128, 256);
  g.fillStyle = '#5b6062';
  g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = 3;
  g.strokeRect(5, 5, 118, 246);
  g.fillStyle = '#12181a';
  g.fillRect(78, 34, 28, 62);
  g.strokeStyle = 'rgba(160,170,170,0.35)';
  g.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(78, 34 + i * 12);
    g.lineTo(106, 46 + i * 12);
    g.moveTo(106, 34 + i * 12);
    g.lineTo(78, 46 + i * 12);
    g.stroke();
  }
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${i % 2 ? 20 : 190},${i % 2 ? 18 : 190},${i % 2 ? 14 : 185},0.12)`;
    g.fillRect((i * 53) % 128, 150 + ((i * 29) % 100), 10 + (i % 5) * 6, 1);
  }
  return texOf(c);
}
function exitTex(on) {
  const [c, g] = canvasOf(128, 48);
  g.fillStyle = on ? '#0d3a1c' : '#101311';
  g.fillRect(0, 0, 128, 48);
  g.fillStyle = on ? '#7dffa0' : '#27332b';
  g.font = 'bold 34px Arial, sans-serif';
  g.textAlign = 'center';
  g.fillText('EXIT', 64, 36);
  return texOf(c);
}

// gl : { renderer, opts } (voir sceneGl dans scene.js) ; sfx : le son (facultatif)
export function createStairRide({ gl, sfx = null }) {
  const renderer = gl.renderer;
  const opts = gl.opts || {};
  const vhs = createVhsFilter(renderer);
  vhs.setQuality(opts.quality === 'auto' || !opts.quality ? 'high' : opts.quality);
  vhs.setFx({ brightness: opts.brightness ?? 1, reduceFlashes: !!opts.reduceFlashes });

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020202);
  scene.fog = new THREE.FogExp2(0x040404, 0.06);
  const cam = new THREE.PerspectiveCamera(opts.fov || 72, 16 / 9, 0.05, 60);
  scene.add(cam);
  const lamp = new THREE.SpotLight(0xfff0d8, 7, 18, 0.6, 0.75, 1.8);
  lamp.position.set(0.12, -0.2, 0.1);
  lamp.target.position.set(0, -0.35, -1);
  cam.add(lamp, lamp.target);
  scene.add(new THREE.HemisphereLight(0x8a8f96, 0x151310, 0.09));
  const bulbs = [new THREE.PointLight(0xffe2b0, 0, 7.5, 1.7), new THREE.PointLight(0xffe2b0, 0, 7.5, 1.7)];
  scene.add(...bulbs);
  const exitLight = new THREE.PointLight(0x9dffb8, 0, 6, 1.6);
  const outLight = new THREE.PointLight(0xfff0d4, 0, 14, 1.4);
  scene.add(exitLight, outLight);

  const tex = { wall: concreteTex(), door: doorTex(), exitOff: exitTex(false), exitOn: exitTex(true) };
  const M = {
    wall: new THREE.MeshLambertMaterial({ map: tex.wall }),
    step: new THREE.MeshLambertMaterial({ map: tex.wall, color: 0xa9a59b }),
    nose: new THREE.MeshLambertMaterial({ color: 0xa88a1e }),
    rail: new THREE.MeshPhongMaterial({ color: 0x7c1f1a, specular: 0x554433, shininess: 40 }),
    steel: new THREE.MeshPhongMaterial({ color: 0x555a5c, specular: 0x8a8f92, shininess: 50 }),
    door: new THREE.MeshPhongMaterial({ map: tex.door, specular: 0x3a3d3e, shininess: 30 }),
    pipe: new THREE.MeshPhongMaterial({ color: 0x8a1c16, specular: 0x553322, shininess: 50 }),
    lampOn: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffe2b0).multiplyScalar(2.2) }),
    lampOff: new THREE.MeshBasicMaterial({ color: 0x2a2620 }),
    exitOff: new THREE.MeshBasicMaterial({ map: tex.exitOff }),
    exitOn: new THREE.MeshBasicMaterial({ map: tex.exitOn, color: new THREE.Color(1.6, 1.6, 1.6) }),
    out: new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0d4).multiplyScalar(2.6) }),
  };

  // --- un étage de la cage (son palier d'étage en haut, à y = 0) : deux volées, deux paliers, les murs ---
  const bins = {};
  const add = (k, geo) => {
    const g = geo.index ? geo.toNonIndexed() : geo;
    (bins[k] = bins[k] || []).push(g);
  };
  const box = (k, x0, x1, y0, y1, z0, z1) => add(k, new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0).translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2));
  // un pan de mur : de (ax, az) à (bx, bz), de y0 à y1, tourné vers (nx, nz) ; le béton à 3,2 m par répétition
  const wall = (ax, az, bx, bz, y0, y1) => {
    const L = Math.hypot(bx - ax, bz - az);
    const g = new THREE.BufferGeometry();
    const p = [ax, y0, az, bx, y0, bz, bx, y1, bz, ax, y0, az, bx, y1, bz, ax, y1, az];
    const u = [0, y0 / H, L / H, y0 / H, L / H, y1 / H, 0, y0 / H, L / H, y1 / H, 0, y1 / H];
    g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
    g.computeVertexNormals();
    add('wall', g);
  };
  wall(-LAND, D, -LAND, 0, -H, 0); // ouest (vers +x)
  wall(RUN + LAND, 0, RUN + LAND, D, -H, 0); // est (vers -x)
  wall(-LAND, 0, RUN + LAND, 0, -H, 0); // nord (vers +z)
  wall(RUN + LAND, D, -LAND, D, -H, 0); // sud (vers -z)
  // les paliers (une dalle de 18 cm), les marches, la paillasse sous chaque volée
  box('step', -LAND, 0, -0.18, 0, 0, D);
  box('step', RUN, RUN + LAND, -H / 2 - 0.18, -H / 2, 0, D);
  const tube = (k, A, B, r, seg = 8) => {
    const L = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]);
    const g = new THREE.CylinderGeometry(r, r, L, seg);
    const o = new THREE.Object3D();
    o.position.set((A[0] + B[0]) / 2, (A[1] + B[1]) / 2, (A[2] + B[2]) / 2);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(B[0] - A[0], B[1] - A[1], B[2] - A[2]).normalize());
    o.updateMatrix();
    add(k, g.applyMatrix4(o.matrix));
  };
  for (const [dir, x0, y0, z0, zin, zout] of [[1, 0, 0, 0, W - 0.05, 0.06], [-1, RUN, -H / 2, W + GAP, W + GAP + 0.05, D - 0.06]]) {
    for (let i = 0; i < STEPS; i++) {
      const xa = x0 + dir * i * TREAD;
      const xb = x0 + dir * (i + 1) * TREAD;
      const y = y0 - (i + 1) * RISE;
      box('step', Math.min(xa, xb), Math.max(xa, xb), y - RISE - 0.02, y, z0, z0 + W);
      // le nez de marche peint en jaune, usé
      box('nose', dir > 0 ? xb - 0.045 : xb, dir > 0 ? xb : xb + 0.045, y - 0.012, y + 0.004, z0 + 0.02, z0 + W - 0.02);
    }
    // la paillasse (le dessous de la volée, qu'on voit de la volée d'en dessous)
    {
      const g = new THREE.BufferGeometry();
      const xa = x0;
      const xb = x0 + dir * RUN;
      const ya = y0 - RISE - 0.2;
      const yb = y0 - H / 2 - RISE - 0.2;
      const p = dir > 0 ? [xa, ya, z0, xb, yb, z0, xb, yb, z0 + W, xa, ya, z0, xb, yb, z0 + W, xa, ya, z0 + W] : [xa, ya, z0, xb, yb, z0 + W, xb, yb, z0, xa, ya, z0, xa, ya, z0 + W, xb, yb, z0 + W];
      g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(12).map((_, i) => p[Math.floor(i / 2) * 3 + (i % 2 ? 2 : 0)] / H), 2));
      g.computeVertexNormals();
      add('step', g);
    }
    // le limon, côté jour : une joue de béton qui ferme le flanc de la volée
    {
      const zs = dir > 0 ? z0 + W : z0;
      const xa = x0;
      const xb = x0 + dir * RUN;
      const g = new THREE.BufferGeometry();
      const q = [xa, y0 + 0.02, zs, xb, y0 - H / 2 + 0.02, zs, xb, y0 - H / 2 - RISE - 0.2, zs, xa, y0 - RISE - 0.2, zs];
      const tri = [0, 1, 2, 0, 2, 3, 0, 2, 1, 0, 3, 2].flatMap((i) => q.slice(i * 3, i * 3 + 3));
      g.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(24).map((_, i) => tri[Math.floor(i / 2) * 3 + (i % 2 ? 1 : 0)] / H), 2));
      g.computeVertexNormals();
      add('step', g);
    }
    // les mains courantes : celle du jour (avec ses barreaux), celle du mur
    const ya = y0 + 0.92;
    const yb = y0 - H / 2 + 0.92;
    tube('rail', [x0, ya, zin], [x0 + dir * RUN, yb, zin], 0.022);
    tube('rail', [x0, ya, zout], [x0 + dir * RUN, yb, zout], 0.02);
    for (let i = 0; i <= STEPS; i += 2) {
      const x = x0 + dir * Math.max(0.03, i * TREAD - 0.03);
      const y = y0 - i * RISE;
      tube('rail', [x, y, zin], [x, y + 0.92, zin], 0.012, 6);
    }
  }
  // le retour des mains courantes autour du jour, à chaque palier
  tube('rail', [0, 0.92, W - 0.05], [0, 0.92, W + GAP + 0.05], 0.022);
  tube('rail', [RUN, -H / 2 + 0.92, W - 0.05], [RUN, -H / 2 + 0.92, W + GAP + 0.05], 0.022);
  // la colonne sèche rouge dans l'angle, son robinet ; une gaine au plafond du palier
  add('pipe', new THREE.CylinderGeometry(0.05, 0.05, H, 12).translate(RUN + LAND - 0.14, -H / 2, 0.14));
  add('pipe', new THREE.CylinderGeometry(0.07, 0.07, 0.05, 12).translate(RUN + LAND - 0.14, -H / 2 + 0.95, 0.14));
  add('steel', new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10).rotateZ(Math.PI / 2).translate(RUN + LAND - 0.24, -H / 2 + 0.95, 0.14));
  // la porte du palier d'étage : son bâti, le vantail (tous fermés, sauf le dernier), la barre antipanique ; au-dessus,
  // le boîtier EXIT ; un hublot grillagé à chaque palier
  const DZ0 = ZB - 0.5;
  const DZ1 = ZB + 0.5;
  box('steel', -LAND, -LAND + 0.05, 0, 2.12, DZ0 - 0.07, DZ0);
  box('steel', -LAND, -LAND + 0.05, 0, 2.12, DZ1, DZ1 + 0.07);
  box('steel', -LAND, -LAND + 0.05, 2.05, 2.12, DZ0, DZ1);
  const cage = (x, y, z, nx) => {
    add('steel', new THREE.TorusGeometry(0.12, 0.012, 6, 16).rotateY(Math.PI / 2).translate(x + nx * 0.06, y, z));
    for (const a of [0, Math.PI / 2]) add('steel', new THREE.TorusGeometry(0.12, 0.007, 4, 12, Math.PI).rotateZ(a).rotateY(nx > 0 ? Math.PI / 2 : -Math.PI / 2).translate(x + nx * 0.02, y, z));
  };
  cage(RUN + LAND, -H / 2 + 2.25, D / 2, -1);
  cage(-LAND, 2.42, ZA, 1);
  const merged = {};
  for (const k in bins) merged[k] = mergeGeometries(bins[k].map((g) => {
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    return g;
  }));
  const lensGeo = new THREE.SphereGeometry(0.1, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const doorGeo = new THREE.BoxGeometry(0.045, 2.05, 1.0).translate(0, 1.025, 0.5);
  const barGeo = new THREE.BoxGeometry(0.05, 0.06, 0.78).translate(0.05, 1.02, 0.5);
  const plateGeo = new THREE.PlaneGeometry(1.0, 1.0).rotateY(Math.PI / 2);
  const exitGeo = new THREE.PlaneGeometry(0.46, 0.17).rotateY(Math.PI / 2);
  const floors = [];
  for (let k = 0; k < FLOORS; k++) {
    const g = new THREE.Group();
    g.position.y = -k * H;
    for (const key in merged) g.add(new THREE.Mesh(merged[key], M[key]));
    // les deux hublots : celui du palier bas (mur est), celui du palier d'étage (mur ouest, côté numéro)
    const le = new THREE.Mesh(lensGeo, M.lampOn);
    le.rotation.z = Math.PI / 2;
    le.position.set(RUN + LAND - 0.01, -H / 2 + 2.25, D / 2);
    const lw = new THREE.Mesh(lensGeo, M.lampOn);
    lw.rotation.z = -Math.PI / 2;
    lw.position.set(-LAND + 0.01, 2.42, ZA);
    const leaf = new THREE.Group();
    leaf.position.set(-LAND + 0.03, 0, DZ0);
    leaf.add(new THREE.Mesh(doorGeo, M.door), new THREE.Mesh(barGeo, M.steel));
    const lab = labelTex();
    const plate = new THREE.Mesh(plateGeo, new THREE.MeshBasicMaterial({ map: lab.tex, transparent: true, depthWrite: false, color: 0x8a8880 }));
    plate.position.set(-LAND + 0.012, 1.55, ZA);
    const exit = new THREE.Mesh(exitGeo, M.exitOff);
    exit.position.set(-LAND + 0.06, 2.3, ZB);
    const exitBox = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.2, 0.5), M.steel);
    exitBox.position.set(-LAND + 0.03, 2.3, ZB);
    g.add(le, lw, leaf, plate, exit, exitBox);
    scene.add(g);
    floors.push({ g, le, lw, leaf, lab, exit, on: [true, true] });
  }
  // derrière la dernière porte : la lumière du centre commercial
  const out = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.05).rotateY(Math.PI / 2), M.out);
  out.visible = false;
  scene.add(out);
  // le haut de la cage
  const lid = new THREE.Mesh(new THREE.PlaneGeometry(RUN + 2 * LAND, D).rotateX(Math.PI / 2), M.wall);
  lid.position.set(RUN / 2, 2.9, D / 2);
  scene.add(lid);
  const top = new THREE.Group();
  top.position.y = H;
  top.add(new THREE.Mesh(merged.wall, M.wall));
  scene.add(top);

  const setLabels = (list, lastOpen = -1) => {
    floors.forEach((f, k) => {
      f.lab.draw(list[k] || '', list[k] === '17' ? 'HALCYON PARK MALL' : '');
      f.exit.material = k === lastOpen ? M.exitOn : M.exitOff;
      f.leaf.rotation.y = 0;
      // un hublot sur trois est mort (pas les mêmes d'un passage à l'autre)
      f.on = [((k * 7 + list.length + (list[0] === '2' ? 1 : 0)) % 3) !== 1, ((k * 5 + 1) % 4) !== 2 || k === lastOpen];
      f.le.material = f.on[0] ? M.lampOn : M.lampOff;
      f.lw.material = f.on[1] ? M.lampOn : M.lampOff;
    });
  };
  setLabels(STAIR_LABELS.one);

  // --- le chemin : par étage, le demi-tour sur le palier d'étage, la première volée, le demi-tour sur le palier bas,
  // la seconde volée. Chaque tronçon : sa longueur, et le point (x, y du sol, z) à la distance d le long de lui ---
  const segs = [];
  for (let k = 0; k < FLOORS; k++) {
    const y0 = -k * H;
    const y1 = y0 - H / 2;
    segs.push({ L: Math.PI * TURN_R, at: (d) => [-TURN_X - TURN_R * Math.sin(d / TURN_R), y0, D / 2 + TURN_R * Math.cos(d / TURN_R)], flat: true });
    segs.push({ L: TURN_X, at: (d) => [-TURN_X + d, y0, ZA], flat: true });
    segs.push({ L: RUN, at: (d) => [d, y0 - (d / RUN) * (H / 2), ZA], steps: true });
    segs.push({ L: TURN_X, at: (d) => [RUN + d, y1, ZA], flat: true });
    segs.push({ L: Math.PI * TURN_R, at: (d) => [RUN + TURN_X + TURN_R * Math.sin(d / TURN_R), y1, D / 2 - TURN_R * Math.cos(d / TURN_R)], flat: true });
    segs.push({ L: TURN_X, at: (d) => [RUN + TURN_X - d, y1, ZB], flat: true });
    segs.push({ L: RUN, at: (d) => [RUN - d, y1 - (d / RUN) * (H / 2), ZB], steps: true });
    segs.push({ L: TURN_X, at: (d) => [-d, y0 - H, ZB], flat: true });
  }
  let acc = 0;
  for (const sg of segs) {
    sg.s0 = acc;
    acc += sg.L;
  }
  const PER = acc / FLOORS; // la longueur d'un étage
  const total = acc;
  const at = (s, out3) => {
    s = Math.max(0, Math.min(total - 1e-3, s));
    let i = Math.min(segs.length - 1, Math.floor((s / total) * segs.length));
    while (i > 0 && segs[i].s0 > s) i--;
    while (i < segs.length - 1 && segs[i].s0 + segs[i].L <= s) i++;
    const p = segs[i].at(s - segs[i].s0);
    out3.set(p[0], p[1], p[2]);
    return segs[i];
  };

  const FLAT = { flat: true };
  // l'état : 'wait', 'one' (avant le chargement), 'hold' (le chargement), 'two' (après), 'done'
  let state = 'wait';
  let s = Math.PI * TURN_R * 0.5; // on part du palier, déjà tourné vers la première volée
  let sEnd = Infinity;
  let v = V0;
  let t1 = 0;
  let t2 = 0;
  let darkK = 1;
  let onEnd = null;
  let run = null;
  let stride = 0;
  let doorK = 0;
  let cw = 0;
  let ch = 0;
  let roll = 0;
  const flash = document.createElement('div');
  flash.style.cssText = 'position:absolute;inset:0;background:#fff3d6;opacity:0;pointer-events:none;z-index:9';
  document.body.appendChild(flash);
  const P = new THREE.Vector3();
  const A = new THREE.Vector3();
  const look = new THREE.Vector3();
  const prevDir = new THREE.Vector2(1, 0);

  function place(dt) {
    if (state === 'one' || state === 'two') {
      // de plus en plus vite ; au bout (la dernière porte), on freine et on la pousse
      const left = sEnd - s;
      v = state === 'two' && left < 3.2 ? Math.max(1.0, v - 9 * dt) : Math.min(VMAX, v + ACC * dt);
      const ds = v * dt;
      s += ds;
      stride += ds;
      if (state === 'two' && s > sEnd) s = sEnd;
      if (state === 'one' && s > total - PER * 0.6) s = total - PER * 0.6;
    }
    let sg = at(s, P);
    // le regard, un mètre et demi plus loin sur le chemin (dans la volée : vers le bas des marches)
    at(Math.min(s + 1.7, total), A);
    // le dernier palier : droit sur la porte, les yeux dessus
    if (state === 'two' && s + 1.7 > 2 * PER) A.set(-LAND, -2 * H, ZB);
    if (state === 'two' && s > 2 * PER) {
      P.set(-TURN_X - (s - 2 * PER), -2 * H, ZB);
      sg = FLAT;
    }
    // les pas : deux marches par foulée dans les volées, une foulée de 75 cm sur les paliers
    const span = sg.steps ? TREAD * 2 : 0.75;
    if (stride >= span) {
      stride -= span;
      if (sfx && sfx.stairStep && (state === 'one' || state === 'two')) sfx.stairStep(Math.min(1, v / VMAX), darkK);
    }
    const ph = stride / span;
    const bob = -Math.abs(Math.sin(ph * Math.PI)) * (sg.steps ? 0.075 : 0.045) * Math.min(1.3, v / 4);
    cam.position.set(P.x + Math.sin(ph * Math.PI * 2) * 0.012, P.y + EYE + bob, P.z);
    look.set(A.x, A.y + EYE - (sg.steps ? 0.5 : 0.28), A.z);
    cam.up.set(0, 1, 0);
    cam.lookAt(look);
    // on se penche dans les demi-tours ; la caméra tressaute avec la course
    const dx = A.x - P.x;
    const dz = A.z - P.z;
    const dl = Math.hypot(dx, dz) || 1;
    const turn = prevDir.x * (dz / dl) - prevDir.y * (dx / dl);
    prevDir.set(dx / dl, dz / dl);
    roll += (Math.max(-1, Math.min(1, turn / Math.max(1e-3, dt) / 3.2)) * 0.11 - roll) * Math.min(1, dt * 6);
    cam.rotateZ(-roll + (Math.random() - 0.5) * 0.008 * Math.min(1, v / 5));
    cam.rotateX((Math.random() - 0.5) * 0.006 * Math.min(1, v / 5));
    const fov = (opts.fov || 72) + 10 * clamp01((v - V0) / (VMAX - V0));
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov = fov;
      cam.updateProjectionMatrix();
    }
  }

  // les deux ampoules les plus proches portent la lumière (les autres ne sont que des hublots allumés)
  const lampPos = [];
  function lights(time) {
    lampPos.length = 0;
    floors.forEach((f, k) => {
      if (f.on[0]) lampPos.push([RUN + LAND - 0.3, -k * H - H / 2 + 2.2, D / 2, k * 2]);
      if (f.on[1]) lampPos.push([-LAND + 0.3, -k * H + 2.38, ZA, k * 2 + 1]);
    });
    lampPos.sort((a, b) => Math.abs(a[1] - cam.position.y - 0.6) - Math.abs(b[1] - cam.position.y - 0.6));
    bulbs.forEach((b, i) => {
      const L = lampPos[i];
      if (!L) {
        b.intensity = 0;
        return;
      }
      b.position.set(L[0], L[1], L[2]);
      // un hublot sur deux grésille
      const fl = L[3] % 2 ? 0.75 + 0.25 * Math.sin(time * 31 + L[3]) * Math.sin(time * 7.3 + L[3]) : 1;
      b.intensity = 5.5 * fl;
    });
  }

  const api = {
    kind: 'stairs',
    get active() {
      return state === 'one' || state === 'two';
    },
    get held() {
      return state === 'hold';
    },
    // on dévale : la première partie (jusqu'au noir)
    start() {
      if (state !== 'wait') return;
      state = 'one';
      if (sfx && sfx.stairRun) run = sfx.stairRun();
    },
    hold() {
      if (state === 'done') return;
      state = 'hold';
      if (run) run.set(0, 0);
    },
    // la suite : plus bas dans la cage, deux étages encore, puis le palier 17 et sa porte
    finish(where, cb) {
      if (state === 'done') return;
      onEnd = cb;
      setLabels(STAIR_LABELS.two, 2);
      s = Math.PI * TURN_R * 0.5;
      // (la porte du troisième palier : au bout de la seconde volée du deuxième étage, droit devant)
      sEnd = 2 * PER + 0.45;
      v = Math.max(v, 4.6);
      stride = 0;
      t2 = 0;
      doorK = 0;
      const y = -2 * H;
      out.position.set(-LAND + 0.014, y + 1.025, ZB);
      out.visible = true;
      exitLight.position.set(-LAND + 0.5, y + 2.2, ZB);
      outLight.position.set(-LAND + 0.2, y + 1.3, ZB);
      state = 'two';
      if (sfx && sfx.stairRun && !run) run = sfx.stairRun();
    },
    // une image. remaining : le temps qui reste avant le chargement (sim.departT), pour plonger dans le noir à temps
    render(dt, time, remaining = null) {
      if (!api.active) return;
      dt = Math.min(0.05, Math.max(0, dt));
      const cv = renderer.domElement;
      const w = cv.clientWidth || window.innerWidth;
      const h = cv.clientHeight || window.innerHeight;
      if (w !== cw || h !== ch) {
        cw = w;
        ch = h;
        vhs.setSize(w, h);
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
      }
      place(dt);
      lights(time);
      let ex = 1.15;
      let wet = 1;
      if (state === 'one') {
        t1 += dt;
        ex *= 0.3 + 0.7 * smooth(t1 / 0.4);
        if (remaining != null && remaining > 0) darkK = Math.min(darkK, clamp01((remaining - 0.1) / 0.85));
        else if (remaining != null || t1 > 30) darkK = 0;
        ex *= darkK;
        wet = darkK;
      } else {
        t2 += dt;
        ex *= smooth(t2 / 0.8);
        // la dernière porte : l'enseigne verte, puis le vantail qu'on pousse et la lumière du mall qui aveugle
        const left = sEnd - s;
        exitLight.intensity = 3.2 * clamp01(1 - left / 14);
        if (left < 1.25) {
          if (doorK === 0 && sfx && sfx.stairDoor) sfx.stairDoor();
          doorK = Math.min(1, doorK + dt / 0.55);
        }
        const o = smooth(doorK);
        floors[2].leaf.rotation.y = -o * 1.75;
        outLight.intensity = o * 26;
        ex *= 1 + o * 1.2;
        flash.style.opacity = String(smooth((doorK - 0.35) / 0.65));
        if (doorK >= 1 && state === 'two') {
          state = 'done';
          const cb = onEnd;
          onEnd = null;
          if (cb) cb();
          return;
        }
      }
      if (run) run.set(v, wet);
      vhs.render(scene, cam, time, 0, ex);
    },
    dispose() {
      state = 'done';
      if (run) run.stop();
      run = null;
      // l'éblouissement de la porte s'efface sur le nouveau niveau
      flash.style.transition = 'opacity 1.1s ease-out';
      requestAnimationFrame(() => {
        flash.style.opacity = '0';
      });
      setTimeout(() => flash.remove(), 1400);
      for (const k in merged) merged[k].dispose();
      for (const f of floors) f.lab.tex.dispose();
      for (const k in M) M[k].dispose();
      for (const k in tex) tex[k].dispose();
      vhs.dispose?.();
    },
  };
  return api;
}
