// The Backrooms (Level 7, Thalassophobia) - La mer dehors, dans la brume du soir : le ciel (Kloppenheim 01, Poly Haven),
// une mer qui le reflète, les îlots de sable et de roches, le ponton, l'épave, les bouées, la barque et l'échine de la
// chose sous l'eau. La scène des bureaux ne garde de cette carte que les objets posés (map.outdoor : ni sol, ni
// plafond, ni néons). Modèles et textures Poly Haven (CC0) : models/ocean/, tex/l7_*.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE } from '../engine/map.js';
import { SEA_Y, RAFT, DECK, WALL_T, HOUSE_H } from '../engine/ocean.js';
import { modelUrl } from './models.js';

const C = CELL_SIZE;
const TEX = (name) => new URL(`../tex/${name}`, import.meta.url).href;

// la houle : une carte de normales tirée de quelques ondes superposées (elle défile lentement)
function swellNormals() {
  const N = 256;
  const h = new Float32Array(N * N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * Math.PI * 2;
      const v = (y / N) * Math.PI * 2;
      h[y * N + x] = Math.sin(u * 3 + v) * 0.35 + Math.sin(v * 5 - u * 2) * 0.25 + Math.sin(u * 9 + v * 6) * 0.12 + Math.sin(u * 2 - v * 8) * 0.15 + Math.sin(u * 15 - v * 11) * 0.05;
    }
  }
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const dx = h[y * N + ((x + 1) % N)] - h[y * N + ((x + N - 1) % N)];
      const dy = h[((y + 1) % N) * N + x] - h[((y + N - 1) % N) * N + x];
      const nx = -dx * 2;
      const ny = -dy * 2;
      const l = Math.hypot(nx, ny, 1);
      const i = (y * N + x) * 4;
      data[i] = Math.round((nx / l * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round((ny / l * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round((1 / l * 0.5 + 0.5) * 255);
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.needsUpdate = true;
  return t;
}
// une texture qui se répète (couleur ou relief)
function tiled(file, rx, ry, srgb) {
  const t = new THREE.TextureLoader().load(TEX(file));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// un modèle mis à une taille donnée (sa plus grande dimension horizontale), posé sur son bas
function fit(obj, size) {
  const box = new THREE.Box3().setFromObject(obj);
  const s = box.getSize(new THREE.Vector3());
  const k = size / Math.max(s.x, s.z);
  obj.scale.multiplyScalar(k);
  const b2 = new THREE.Box3().setFromObject(obj);
  const c = b2.getCenter(new THREE.Vector3());
  obj.position.x -= c.x;
  obj.position.z -= c.z;
  obj.position.y -= b2.min.y;
  const g = new THREE.Group();
  g.add(obj);
  return g;
}

// La barque : une coque de bois en planches (bordé), pointue à l'avant, un tableau plat à l'arrière, trois bancs, un
// plat-bord, deux avirons couchés au fond et le moteur hors-bord au tableau. Tout est à l'échelle du moteur (RAFT)
function buildBoat() {
  const boat = new THREE.Group();
  const L = RAFT.hl * 2;
  const top = 0.28; // le plat-bord, au-dessus du plancher des îlots (la mer est à SEA_Y)
  const keel = SEA_Y - 0.28;
  const plank = tiled('l7_planches.webp', 1, 3, true);
  const plankN = tiled('l7_planches_relief.webp', 1, 3, false);
  const wood = new THREE.MeshStandardMaterial({ map: plank, normalMap: plankN, color: '#b49a7c', roughness: 0.85, side: THREE.DoubleSide });
  const paint = new THREE.MeshStandardMaterial({ map: plank, normalMap: plankN, color: '#5e7480', roughness: 0.8, side: THREE.DoubleSide });
  // la demi-largeur et la profondeur de la coque en un point (t : 0 à l'arrière, 1 à l'étrave)
  const half = (t) => RAFT.hw * (t < 0.55 ? 0.82 + 0.18 * Math.sin((t / 0.55) * Math.PI * 0.5) : Math.cos(((t - 0.55) / 0.45) * Math.PI * 0.5) ** 0.75);
  const depth = (t) => (top - keel) * (t < 0.8 ? 1 : 1 - ((t - 0.8) / 0.2) * 0.35);
  const NS = 28;
  const NA = 12;
  const pos = [];
  const uv = [];
  const idx = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    const z = -RAFT.hl + t * L;
    const b = half(t);
    const d = depth(t);
    for (let j = 0; j <= NA; j++) {
      const u = (j / NA) * 2 - 1; // de bâbord à tribord
      const x = b * Math.sin((u * Math.PI) / 2);
      const y = top - d * Math.cos((u * Math.PI) / 2) ** 0.7;
      pos.push(x, y, z);
      uv.push(j / NA, (t * L) / 1.2);
    }
  }
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j;
      const b2 = a + NA + 1;
      idx.push(a, b2, a + 1, a + 1, b2, b2 + 1);
    }
  }
  const hullG = new THREE.BufferGeometry();
  hullG.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  hullG.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  hullG.setIndex(idx);
  hullG.computeVertexNormals();
  boat.add(new THREE.Mesh(hullG, paint));
  // le tableau arrière : une planche pleine qui ferme la coque
  const sh = new THREE.Shape();
  const b0 = half(0);
  const d0 = depth(0);
  sh.moveTo(-b0, top);
  for (let j = 0; j <= NA; j++) {
    const u = (j / NA) * 2 - 1;
    sh.lineTo(b0 * Math.sin((u * Math.PI) / 2), top - d0 * Math.cos((u * Math.PI) / 2) ** 0.7);
  }
  const transom = new THREE.Mesh(new THREE.ShapeGeometry(sh), wood);
  transom.position.z = -RAFT.hl;
  boat.add(transom);
  // le plancher (les pieds de ceux qui sont à bord, à -DECK), les bancs, le plat-bord
  const floor = new THREE.Mesh(new THREE.BoxGeometry(RAFT.hw * 1.3, 0.04, L * 0.78), wood);
  floor.position.set(0, -DECK - 0.02, -0.15);
  boat.add(floor);
  for (const z of [-1.0, -0.1, 0.8]) {
    const t = (z + RAFT.hl) / L;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(half(t) * 2 - 0.08, 0.05, 0.26), wood);
    seat.position.set(0, top - 0.2, z);
    boat.add(seat);
  }
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS;
      pts.push(new THREE.Vector3(side * half(t), top + 0.02, -RAFT.hl + t * L));
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.035, 6), wood);
    boat.add(rail);
  }
  // deux avirons couchés au fond, la pelle vers l'avant
  for (const side of [-1, 1]) {
    const oar = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 2.2, 8), wood);
    shaft.rotation.x = Math.PI / 2;
    oar.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.55), wood);
    blade.position.z = 1.1;
    oar.add(blade);
    oar.position.set(side * 0.28, -DECK + 0.05, 0.1);
    oar.rotation.y = side * 0.05;
    boat.add(oar);
  }
  // le moteur hors-bord, fixé au tableau : capot, embase, hélice
  const motor = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#1f2226', roughness: 0.45, metalness: 0.3 });
  const orange = new THREE.MeshStandardMaterial({ color: '#8f4a22', roughness: 0.55, metalness: 0.2 });
  const cowl = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.16, 4, 10), orange);
  cowl.scale.set(1, 1, 1.35);
  cowl.position.set(0, top + 0.18, -0.1);
  motor.add(cowl);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 12), dark);
  cap.scale.set(1, 1, 1.35);
  cap.position.set(0, top + 0.4, -0.1);
  motor.add(cap);
  const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.14), dark);
  leg.position.set(0, top - 0.42, -0.2);
  motor.add(leg);
  const prop = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 10), dark);
  prop.rotation.x = Math.PI / 2;
  prop.position.set(0, SEA_Y - 0.25, -0.3);
  motor.add(prop);
  const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.6, 6), dark);
  tiller.rotation.x = Math.PI / 2 - 0.25;
  tiller.position.set(0, top + 0.25, 0.2);
  motor.add(tiller);
  motor.position.z = -RAFT.hl;
  boat.add(motor);
  return { boat, motor, prop };
}

// une boîte dont la texture se répète à la taille réelle (tile : mètres par répétition), au lieu d'être étirée
function box(w, h, d, mat, tile = 2) {
  const g = new THREE.BoxGeometry(w, h, d);
  const uv = g.attributes.uv;
  // l'ordre des faces de BoxGeometry : +x, -x, +y, -y, +z, -z (4 sommets chacune)
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) uv.setXY(f * 4 + i, uv.getX(f * 4 + i) * (dims[f][0] / tile), uv.getY(f * 4 + i) * (dims[f][1] / tile));
  return new THREE.Mesh(g, mat);
}

// Une maison à moitié engloutie : l'étage (sol à 0, plafond à HOUSE_H), son toit à deux pentes, et dessous le
// rez-de-chaussée noyé (son bardage descend dans l'eau). hs : le plan du moteur (murs, ouvertures, pièces, ponton).
// Les murs de façade ont deux peaux : le bardage dehors, la peinture qui s'écaille dedans
function buildHouse(hs, M) {
  const g = new THREE.Group();
  const { X0, Z0, X1, Z1 } = hs;
  const cx = (X0 + X1) / 2;
  const cz = (Z0 + Z1) / 2;
  const T = WALL_T;
  const HH = HOUSE_H;
  for (const sg of hs.segs) {
    const len = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az);
    const ux = (sg.bx - sg.ax) / len;
    const uz = (sg.bz - sg.az) / len;
    // le côté dehors (loin du milieu de la maison)
    let nx = -uz;
    let nz = ux;
    if ((sg.ax - cx) * nx + (sg.az - cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const pieces = [];
    let a = 0;
    for (const o of [...sg.open].sort((p, q) => p.at - q.at)) {
      const s0 = o.at - o.w / 2;
      const s1 = o.at + o.w / 2;
      if (s0 > a) pieces.push([a, s0, 0, HH]);
      if (o.kind === 'door') pieces.push([s0, s1, 2.1, HH]);
      else {
        pieces.push([s0, s1, 0, 0.95], [s0, s1, 2.0, HH]);
        // le cadre de la fenêtre (sans vitre : elles ont toutes sauté)
        for (const [y, hgt] of [[0.95, 0.06], [2.0, 0.06]]) {
          const f = box(o.w, hgt, T + 0.04, M.frame, 1);
          f.position.set(sg.ax + ux * o.at, y, sg.az + uz * o.at);
          f.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;
          g.add(f);
        }
      }
      a = s1;
    }
    if (a < len) pieces.push([a, len, 0, HH]);
    const rot = Math.atan2(ux, uz) + Math.PI / 2;
    for (const [s0, s1, y0, y1] of pieces) {
      const mx = sg.ax + ux * (s0 + s1) / 2;
      const mz = sg.az + uz * (s0 + s1) / 2;
      const skins = sg.ext ? [[M.siding, T / 4], [M.paint, -T / 4]] : [[M.paint, 0]];
      for (const [mat, off] of skins) {
        const b = box(s1 - s0, y1 - y0, sg.ext ? T / 2 : T, mat, 2);
        b.position.set(mx + nx * off, (y0 + y1) / 2, mz + nz * off);
        b.rotation.y = rot;
        g.add(b);
      }
    }
  }
  // le sol de l'étage, le plafond
  const floor = box(X1 - X0 + T, 0.2, Z1 - Z0 + T, M.floor, 2);
  floor.position.set(cx, -0.1, cz);
  g.add(floor);
  const ceil = box(X1 - X0, 0.08, Z1 - Z0, M.paint, 2);
  ceil.position.set(cx, HH + 0.04, cz);
  g.add(ceil);
  // le rez-de-chaussée noyé : son bardage plonge dans l'eau ; le haut de ses fenêtres affleure encore
  const low = box(X1 - X0 + T, 3.2, Z1 - Z0 + T, M.siding, 2);
  low.position.set(cx, -1.8, cz);
  g.add(low);
  for (const sg of hs.segs) {
    if (!sg.ext) continue;
    const len = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az);
    const ux = (sg.bx - sg.ax) / len;
    const uz = (sg.bz - sg.az) / len;
    let nx = -uz;
    let nz = ux;
    if ((sg.ax - cx) * nx + (sg.az - cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    for (const o of sg.open) {
      if (o.kind !== 'window') continue;
      const w = box(o.w, 0.7, 0.04, M.drowned, 1);
      w.position.set(sg.ax + ux * o.at + nx * (T / 2 + 0.03), SEA_Y - 0.12, sg.az + uz * o.at + nz * (T / 2 + 0.03));
      w.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;
      g.add(w);
    }
  }
  // le toit à deux pentes, le faîte le long du grand côté, et ses deux pignons
  const alongX = X1 - X0 >= Z1 - Z0;
  const ov = 0.45;
  const R = 1.5;
  const hd = (alongX ? Z1 - Z0 : X1 - X0) / 2 + ov;
  const slope = Math.hypot(hd, R);
  const ang = Math.atan2(R, hd);
  const L = (alongX ? X1 - X0 : Z1 - Z0) + ov * 2;
  for (const s of [-1, 1]) {
    const p = alongX ? box(L, 0.09, slope, M.roof, 2) : box(slope, 0.09, L, M.roof, 2);
    if (alongX) {
      p.position.set(cx, HH + R / 2, cz + (s * hd) / 2);
      p.rotation.x = s * ang;
    } else {
      p.position.set(cx + (s * hd) / 2, HH + R / 2, cz);
      p.rotation.z = -s * ang;
    }
    g.add(p);
  }
  const gh = (alongX ? Z1 - Z0 : X1 - X0) / 2;
  for (const s of [-1, 1]) {
    const sh = new THREE.Shape();
    sh.moveTo(-gh, 0);
    sh.lineTo(gh, 0);
    sh.lineTo(0, R - 0.05);
    sh.closePath();
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.sidingFlat);
    if (alongX) {
      tri.position.set(s > 0 ? X1 : X0, HH, cz);
      tri.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      tri.position.set(cx, HH, s > 0 ? Z1 : Z0);
      tri.rotation.y = s > 0 ? 0 : Math.PI;
    }
    g.add(tri);
  }
  return g;
}

export function buildOcean({ map, scene, loader }) {
  const root = new THREE.Group();
  scene.add(root);
  const W = map.W * C;
  const H = map.H * C;

  // 1. Le ciel (photo panoramique) et sa lumière : le jour qui baisse derrière la brume, le soleil bas à l'horizon
  new THREE.TextureLoader().load(TEX('l7_ciel.jpg'), (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping;
    t.colorSpace = THREE.SRGBColorSpace;
    scene.background = t;
    sea.material.envMap = t;
    sea.material.needsUpdate = true;
  });
  root.add(new THREE.HemisphereLight('#c6d0dc', '#26303a', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b8', 0.9);
  sun.position.set(0.8 * 100, 18, 0.6 * 100);
  sun.target.position.set(0, 0, 0);
  root.add(sun, sun.target);

  // 2. La mer : elle reflète le ciel (envMap), sa houle défile
  const normals = swellNormals();
  normals.repeat.set(220, 220);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(2000, 2000),
    new THREE.MeshStandardMaterial({ color: '#1b2a33', roughness: 0.12, metalness: 0.05, normalMap: normals, normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.9 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(W / 2, SEA_Y, H / 2);
  root.add(sea);

  // 3. Les îlots : les maisons à moitié englouties (on entre dans celles du départ et des bidons ; les autres
  // sombrent, de travers), le rocher de la porte, l'îlot de l'épave
  const sand = tiled('l7_sable.webp', 1, 1, true);
  const sandN = tiled('l7_sable_relief.webp', 1, 1, false);
  const sandMat = (w, h) => {
    const m = new THREE.MeshStandardMaterial({ map: sand.clone(), normalMap: sandN.clone(), color: '#c9c2b4', roughness: 0.95 });
    m.map.repeat.set(w / 4, h / 4);
    m.normalMap.repeat.set(w / 4, h / 4);
    m.map.needsUpdate = m.normalMap.needsUpdate = true;
    return m;
  };
  const std = (file, color, rough = 0.9) => new THREE.MeshStandardMaterial({ map: tiled(file + '.webp', 1, 1, true), normalMap: tiled(file + '_relief.webp', 1, 1, false), color, roughness: rough });
  const M = {
    siding: std('l7_bardage', '#d2d8d7'),
    paint: std('l7_cloison', '#f2ece0', 0.95),
    floor: std('l7_plancher', '#d2c4ac'),
    roof: std('l7_toit', '#8e877e'),
    deck: std('l7_planches', '#a08a70'),
    frame: new THREE.MeshStandardMaterial({ color: '#3b3630', roughness: 0.8 }),
    drowned: new THREE.MeshStandardMaterial({ color: '#0a1013', roughness: 0.2, metalness: 0.3 }), // une vitre du bas, noire d'eau
  };
  M.sidingFlat = std('l7_bardage', '#d2d8d7');
  M.sidingFlat.map.repeat.set(0.5, 0.5);
  M.sidingFlat.normalMap.repeat.set(0.5, 0.5);
  M.sidingFlat.side = THREE.DoubleSide;
  const rockKinds = ['coast_rocks_01', 'coast_rocks_03'];
  const rocks = {};
  const place = (name, size, set) => {
    const go = (src) => {
      const o = fit(src.clone(), size);
      set(o);
      root.add(o);
    };
    if (rocks[name]) go(rocks[name]);
    else
      loader.load(modelUrl(name), (g) => {
        rocks[name] = g.scene;
        go(g.scene);
      });
  };
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pile = (x, z) => {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 3.2, 8), M.frame);
    p.position.set(x, -1.5, z);
    root.add(p);
  };
  for (const o of map.islets) {
    const w = o.w * C;
    const h = o.h * C;
    const x0 = o.x0 * C;
    const z0 = o.z0 * C;
    if (o.house) {
      // la maison, et son ponton de planches sur pilotis devant l'entrée
      root.add(buildHouse(o.house, M));
      const P = o.house.porch;
      const along = P.side === 'n' || P.side === 's';
      const px0 = along ? P.x0 : P.side === 'w' ? P.x0 : P.x1 - C;
      const px1 = along ? P.x1 : P.side === 'w' ? P.x0 + C : P.x1;
      const pz0 = along ? (P.side === 'n' ? P.z0 : P.z1 - C) : P.z0;
      const pz1 = along ? (P.side === 'n' ? P.z0 + C : P.z1) : P.z1;
      const deck = box(px1 - px0, 0.14, pz1 - pz0, M.deck, 1.5);
      deck.position.set((px0 + px1) / 2, -0.07, (pz0 + pz1) / 2);
      root.add(deck);
      for (const [x, z] of [[px0 + 0.15, pz0 + 0.15], [px1 - 0.15, pz0 + 0.15], [px0 + 0.15, pz1 - 0.15], [px1 - 0.15, pz1 - 0.15]]) pile(x, z);
      continue;
    }
    if (o.kind === 'sunk') {
      // une maison qui sombre : la même, sans cloison, penchée et enfoncée dans l'eau ; on n'y entre pas
      const X0 = x0 + WALL_T / 2;
      const Z0 = z0 + WALL_T / 2;
      const X1 = x0 + w - WALL_T / 2;
      const Z1 = z0 + h - WALL_T / 2;
      const win = (len) => [{ at: len * 0.3, w: 1.0, kind: 'window' }, { at: len * 0.72, w: 1.0, kind: 'window' }];
      const hs = { X0, Z0, X1, Z1, segs: [
        { ax: X0, az: Z0, bx: X1, bz: Z0, ext: true, open: [{ at: (X1 - X0) / 2, w: 1.1, kind: 'door' }] },
        { ax: X0, az: Z1, bx: X1, bz: Z1, ext: true, open: win(X1 - X0) },
        { ax: X0, az: Z0, bx: X0, bz: Z1, ext: true, open: win(Z1 - Z0) },
        { ax: X1, az: Z0, bx: X1, bz: Z1, ext: true, open: win(Z1 - Z0) },
      ] };
      const inner = buildHouse(hs, M);
      inner.position.set(-o.cx, 0, -o.cz);
      const pivot = new THREE.Group();
      pivot.add(inner);
      pivot.position.set(o.cx, -o.tilt.sink, o.cz);
      pivot.rotation.set(o.tilt.x, o.tilt.yaw, o.tilt.z, 'YXZ');
      root.add(pivot);
      continue;
    }
    // le rocher de la porte, l'îlot de l'épave : du sable, des rochers aux coins
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, h), sandMat(w, h));
    slab.position.set(x0 + w / 2, -1.2, z0 + h / 2);
    root.add(slab);
    if (o.kind === 'wreck') continue;
    for (const [cx, cz] of [[x0, z0], [x0 + w, z0], [x0, z0 + h], [x0 + w, z0 + h]]) {
      if (rnd() < 0.3) continue;
      const sz = 2.2 + rnd() * 2.2;
      const name = rockKinds[Math.floor(rnd() * rockKinds.length)];
      const ry = rnd() * Math.PI * 2;
      const dx = Math.sign(cx - (x0 + w / 2)) * 0.6;
      const dz = Math.sign(cz - (z0 + h / 2)) * 0.6;
      place(name, sz, (g) => {
        g.position.set(cx + dx, SEA_Y - 0.6, cz + dz);
        g.rotation.y = ry;
      });
    }
  }

  // 4. La jetée de la porte
  const door = map.islets.find((o) => o.kind === 'door');
  if (door) {
    place('modular_wooden_pier', 6, (g) => {
      g.position.set(door.cx, SEA_Y - 1.4, (door.z0 + door.h) * C + 2.6);
    });
  }

  // 5. La porte : un bâti et une porte de bureau blanche, plantés seuls au milieu du dernier îlot (le seul reste des
  // Backrooms, ici)
  const E = map.exit;
  const doorG = new THREE.Group();
  const frameMat = new THREE.MeshStandardMaterial({ color: '#8b8576', roughness: 0.7 });
  const leafMat = new THREE.MeshStandardMaterial({ color: '#d9d4c3', roughness: 0.6 });
  for (const x of [-0.5, 0.5]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.15, 0.16), frameMat);
    m.position.set(x, 1.075, 0);
    doorG.add(m);
  }
  const head = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 0.16), frameMat);
  head.position.set(0, 2.2, 0);
  doorG.add(head);
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.05, 0.05), leafMat);
  leaf.position.set(0, 1.03, 0);
  doorG.add(leaf);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: '#c9a64a', metalness: 0.8, roughness: 0.3 }));
  knob.position.set(0.33, 1.0, 0.05);
  doorG.add(knob);
  // une petite lampe au-dessus : on la voit de loin dans la brume
  const lamp = new THREE.PointLight('#ffd9a0', 2.5, 18, 1.6);
  lamp.position.set(0, 2.5, 0.5);
  doorG.add(lamp);
  doorG.position.set(E.x, 0, E.z);
  root.add(doorG);

  // 6. L'épave : le navire couché sur son îlot, la quille en l'air à moitié, dans la brume
  const wreck = map.islets.find((o) => o.kind === 'wreck');
  if (wreck) {
    place('ship_pinnace', Math.max(wreck.w, wreck.h) * C * 1.5, (g) => {
      g.position.set(wreck.cx, SEA_Y - 2.2, wreck.cz);
      g.rotation.set(0.05, wreck.w > wreck.h ? Math.PI / 2 : 0, 0.32);
    });
  }

  // 7. Les bouées : elles dansent sur la houle
  const buoys = [];
  for (const b of map.buoys || []) {
    place(b.kind, b.kind === 'ocean_buoy' ? 1.6 : 1.2, (g) => {
      g.position.set(b.x, SEA_Y - 0.5, b.z);
      buoys.push({ g, ph: b.x * 0.13 + b.z * 0.07 });
    });
  }

  // 8. La barque
  const { boat, motor, prop } = buildBoat();
  root.add(boat);

  // 9. La chose : son échine noire et luisante qui crève la surface quand elle fonce (elle ondule), et l'écume
  const blobRoot = new THREE.Group();
  const hideMat = new THREE.MeshStandardMaterial({ color: '#1a2421', roughness: 0.25, metalness: 0.1 });
  const spine = [];
  for (let i = 0; i < 6; i++) {
    const k = 1 - Math.abs(i - 1.5) / 5;
    const seg = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), hideMat);
    seg.scale.set(1.5 * k + 0.3, 0.55 * k + 0.15, 1.6);
    seg.position.z = 4.5 - i * 2.1;
    blobRoot.add(seg);
    spine.push(seg);
  }
  const foamCv = document.createElement('canvas');
  foamCv.width = foamCv.height = 128;
  {
    const g = foamCv.getContext('2d');
    for (let i = 0; i < 900; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 40 + Math.random() * 22 * (Math.random() < 0.7 ? 1 : 0.5);
      g.fillStyle = `rgba(235,240,238,${0.2 + Math.random() * 0.4})`;
      g.beginPath();
      g.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 1 + Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }
  const foamMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(foamCv), transparent: true, opacity: 0, depthWrite: false, fog: true });
  const foam = new THREE.Mesh(new THREE.PlaneGeometry(7, 15), foamMat);
  foam.rotation.x = -Math.PI / 2;
  foam.position.y = SEA_Y + 0.02;
  blobRoot.add(foam);
  root.add(blobRoot);

  let back = -2;
  return {
    update(sim, time, dt) {
      normals.offset.set(Math.sin(time * 0.05) * 0.02, time * 0.004);
      for (const b of buoys) {
        b.g.position.y = SEA_Y - 0.5 + Math.sin(time * 1.1 + b.ph) * 0.12;
        b.g.rotation.z = Math.sin(time * 0.8 + b.ph) * 0.08;
      }
      const R = sim.raft;
      if (R) {
        // la houle berce la barque ; le moteur tremble et l'hélice tourne quand il tourne
        boat.position.set(R.x, Math.sin(time * 1.3) * 0.04, R.z);
        boat.rotation.set(Math.sin(time * 0.9) * 0.025 - R.v * 0.012, R.yaw, Math.sin(time * 1.1 + 1) * 0.035);
        motor.position.x = R.motor ? (Math.random() - 0.5) * 0.012 : 0;
        if (R.motor) prop.rotation.y += dt * 40;
      }
      const M = sim.hasMonster ? sim.monster : null;
      // l'échine affleure en chasse (jusqu'à 35 cm au-dessus de l'eau), plonge sinon
      const rise = !M ? -2 : M.mode === 'chase' ? 0.35 : M.mode === 'search' ? -0.4 : -1.2;
      back += (rise - back) * Math.min(1, dt * 0.9);
      if (M) {
        blobRoot.position.set(M.x, 0, M.z);
        blobRoot.rotation.y = M.yaw || 0;
        foamMat.opacity = Math.max(0, Math.min(0.85, (back + 0.4) * 1.2));
        foam.rotation.z = time * 0.3;
        spine.forEach((seg, i) => {
          seg.position.y = SEA_Y + back - seg.scale.y * 0.9 + Math.sin(time * 2.2 - i * 0.9) * 0.18;
          seg.visible = seg.position.y + seg.scale.y > SEA_Y;
        });
      }
    },
  };
}
