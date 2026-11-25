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
  // l'allure de la maison (engine/ocean.js : style) : couleur du bardage, toit, cheminée, volets
  const st = hs.style || {};
  const sid = M.sidings[st.tint || 0];
  const sidF = M.sidingFlats[st.tint || 0];
  const roofM = M.roofs[(st.tint || 0) % M.roofs.length];

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
        // des volets ouverts de chaque côté, sur la façade (un peu de travers : l'un pend)
        if (st.shutters && sg.ext) {
          let nx2 = -uz;
          let nz2 = ux;
          if ((sg.ax - cx) * nx2 + (sg.az - cz) * nz2 < 0) {
            nx2 = -nx2;
            nz2 = -nz2;
          }
          for (const sd of [-1, 1]) {
            const sh = box(o.w * 0.5, 1.1, 0.04, M.shutters[(st.tint || 0) % M.shutters.length], 1);
            const at = o.at + sd * (o.w * 0.5 + o.w * 0.25 + 0.03);
            sh.position.set(sg.ax + ux * at + nx2 * (T / 2 + 0.03), 1.48, sg.az + uz * at + nz2 * (T / 2 + 0.03));
            sh.rotation.set(0, Math.atan2(ux, uz) + Math.PI / 2, sd > 0 && st.flip ? 0.25 : 0);
            g.add(sh);
          }
        }
      }
      a = s1;
    }
    if (a < len) pieces.push([a, len, 0, HH]);
    const rot = Math.atan2(ux, uz) + Math.PI / 2;
    for (const [s0, s1, y0, y1] of pieces) {
      const mx = sg.ax + ux * (s0 + s1) / 2;
      const mz = sg.az + uz * (s0 + s1) / 2;
      const skins = sg.ext ? [[sid, T / 4], [M.paint, -T / 4]] : [[M.paint, 0]];
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
  const low = box(X1 - X0 + T, 3.2, Z1 - Z0 + T, sid, 2);
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
  // le toit, le faîte le long du grand côté : à deux pentes (et ses deux pignons), ou un seul pan qui descend vers
  // l'arrière (et ses deux joues) ; parfois une cheminée de pierre qui en sort
  const alongX = X1 - X0 >= Z1 - Z0;
  const ov = 0.45;
  const span = (alongX ? Z1 - Z0 : X1 - X0) + ov * 2;
  const L = (alongX ? X1 - X0 : Z1 - Z0) + ov * 2;
  const gh = (alongX ? Z1 - Z0 : X1 - X0) / 2;
  const end = (s, sh) => {
    const tri = new THREE.Mesh(new THREE.ShapeGeometry(sh), sidF);
    if (alongX) {
      tri.position.set(s > 0 ? X1 : X0, HH, cz);
      tri.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      tri.position.set(cx, HH, s > 0 ? Z1 : Z0);
      tri.rotation.y = s > 0 ? 0 : Math.PI;
    }
    g.add(tri);
  };
  let ridgeY;
  if (st.roof === 'shed') {
    const R = 1.1;
    const slope = Math.hypot(span, R);
    const ang = Math.atan2(R, span) * (st.flip ? -1 : 1);
    const p = alongX ? box(L, 0.09, slope, roofM, 2) : box(slope, 0.09, L, roofM, 2);
    p.position.set(cx, HH + R / 2 + 0.05, cz);
    if (alongX) p.rotation.x = ang;
    else p.rotation.z = -ang;
    g.add(p);
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      const hi = st.flip ? gh : -gh;
      sh.moveTo(-gh, 0);
      sh.lineTo(gh, 0);
      sh.lineTo(hi, R);
      sh.closePath();
      end(s, sh);
    }
    ridgeY = HH + R;
  } else {
    const R = 1.5;
    const hd = span / 2;
    const slope = Math.hypot(hd, R);
    const ang = Math.atan2(R, hd);
    for (const s of [-1, 1]) {
      const p = alongX ? box(L, 0.09, slope, roofM, 2) : box(slope, 0.09, L, roofM, 2);
      if (alongX) {
        p.position.set(cx, HH + R / 2, cz + (s * hd) / 2);
        p.rotation.x = s * ang;
      } else {
        p.position.set(cx + (s * hd) / 2, HH + R / 2, cz);
        p.rotation.z = -s * ang;
      }
      g.add(p);
      const sh = new THREE.Shape();
      sh.moveTo(-gh, 0);
      sh.lineTo(gh, 0);
      sh.lineTo(0, R - 0.05);
      sh.closePath();
      end(s, sh);
    }
    ridgeY = HH + R;
  }
  if (st.chimney) {
    const ch = box(0.6, ridgeY - HH + 1.0, 0.6, M.chimney, 1);
    const k = st.flip ? 0.28 : -0.28;
    ch.position.set(alongX ? cx + (X1 - X0) * k : cx + 0.4, HH + (ridgeY - HH + 1.0) / 2, alongX ? cz + 0.4 : cz + (Z1 - Z0) * k);
    g.add(ch);
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
    seaMat.uniforms.uSky.value = t; // (les uniformes du matériau : merge en a fait des copies)
  });
  root.add(new THREE.HemisphereLight('#c6d0dc', '#26303a', 1.1));
  const sun = new THREE.DirectionalLight('#ffe2b8', 0.9);
  sun.position.set(0.8 * 100, 18, 0.6 * 100);
  sun.target.position.set(0, 0, 0);
  root.add(sun, sun.target);

  // 2. La mer : un shader à elle. La houle (plusieurs trains de vagues qui se croisent, des vaguelettes par-dessus),
  // le ciel qu'elle reflète (de plus en plus en rasant : Fresnel), l'éclat du jour bas sur l'horizon, un peu d'écume
  // aux crêtes ; elle se calme au loin (pas de scintillement) et se fond dans la brume
  const seaU = {
    uT: { value: 0 },
    uSky: { value: null },
    uSun: { value: new THREE.Vector3(0.81, 0.08, 0.59).normalize() },
    uDeep: { value: new THREE.Color('#071217') },
    uMid: { value: new THREE.Color('#1a3540') },
  };
  const seaMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, seaU]),
    vertexShader: `varying vec3 vW;
      #include <common>
      #include <fog_pars_vertex>
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vec4 mvPosition = viewMatrix * w;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vW;
      uniform float uT;
      uniform sampler2D uSky;
      uniform vec3 uSun;
      uniform vec3 uDeep;
      uniform vec3 uMid;
      #include <common>
      #include <fog_pars_fragment>
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      // une vague : direction, longueur d'onde (m), hauteur ; elle avance à la vitesse d'une houle (racine de g k)
      float wave(vec2 p, vec2 d, float L, float A) {
        float k = 6.2832 / L;
        return A * sin(dot(normalize(d), p) * k - sqrt(9.8 * k) * uT);
      }
      float height(vec2 p, float detail) {
        float h = wave(p, vec2(1.0, 0.35), 14.0, 0.22) + wave(p, vec2(-0.4, 1.0), 8.5, 0.14) + wave(p, vec2(0.7, -0.6), 5.2, 0.08);
        h += wave(p, vec2(-1.0, -0.2), 2.9, 0.04) * detail + wave(p, vec2(0.2, 1.0), 1.7, 0.025) * detail;
        h += (vnoise(p * 0.9 + vec2(uT * 0.35, uT * 0.2)) - 0.5) * 0.06 * detail + (vnoise(p * 2.7 - vec2(uT * 0.5, -uT * 0.3)) - 0.5) * 0.025 * detail;
        return h;
      }
      void main() {
        vec3 toCam = cameraPosition - vW;
        float dist = length(toCam);
        vec3 V = toCam / dist;
        // au loin, les petites vagues s'effacent (sinon elles scintillent) et la mer se lisse
        float detail = 1.0 - smoothstep(25.0, 90.0, dist);
        float e = 0.06 + dist * 0.004;
        vec2 p = vW.xz;
        float h0 = height(p, detail);
        float hx = height(p + vec2(e, 0.0), detail);
        float hz = height(p + vec2(0.0, e), detail);
        float flat1 = mix(0.3, 0.65, detail);
        vec3 N = normalize(vec3(-(hx - h0) / e * flat1, 1.0, -(hz - h0) / e * flat1));
        // le reflet du ciel (la photo panoramique), d'autant plus fort qu'on regarde l'eau en rasant
        vec3 R = reflect(-V, N);
        R.y = abs(R.y);
        vec2 suv = vec2(atan(R.z, R.x) / 6.2832 + 0.5, asin(clamp(R.y, -1.0, 1.0)) / 3.14159 + 0.5);
        vec3 sky = texture2D(uSky, suv).rgb;
        float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
        // la couleur de l'eau : plus claire sur le flanc des vagues (la lumière qui la traverse), sombre au creux
        float crest = smoothstep(-0.1, 0.35, h0);
        vec3 body = mix(uDeep, uMid, crest * 0.6 + 0.15);
        vec3 col = mix(body, sky * 0.82, clamp(fres, 0.0, 0.78));
        // l'éclat du jour qui baisse, là-bas sur l'horizon
        float sp = pow(max(dot(R, uSun), 0.0), 180.0);
        col += vec3(1.0, 0.86, 0.66) * sp * 1.6;
        // un peu d'écume sur les plus hautes crêtes, déchirée par le bruit
        float foam = smoothstep(0.44, 0.56, h0 + (vnoise(p * 1.6 + uT * 0.2) - 0.5) * 0.2) * smoothstep(0.55, 0.8, vnoise(p * 0.45 + uT * 0.05)) * detail;
        col = mix(col, vec3(0.8, 0.85, 0.85), foam * 0.3);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), seaMat);
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
  // cinq couleurs de bardage (gris délavé, bleu passé, rouge grange, vert sauge, blanc), trois de toit, des volets
  const TINTS = ['#d2d8d7', '#a9bccb', '#c27a6c', '#b4c3a4', '#efe9da'];
  M.sidings = TINTS.map((c) => std('l7_bardage', c));
  M.sidingFlats = TINTS.map((c) => {
    const m = std('l7_bardage', c);
    m.map.repeat.set(0.5, 0.5);
    m.normalMap.repeat.set(0.5, 0.5);
    m.side = THREE.DoubleSide;
    return m;
  });
  M.roofs = ['#8e877e', '#6d5a4c', '#5b6670'].map((c) => std('l7_toit', c));
  M.shutters = ['#3e5a4a', '#33465c', '#5c3a32'].map((c) => std('l7_planches', c));
  M.chimney = new THREE.MeshStandardMaterial({ map: sand.clone(), color: '#8b7f76', roughness: 0.95 });
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
      // une rambarde le long du bord du ponton, ouverte au milieu (là où l'on monte dans la barque)
      if (o.style && o.style.rail) {
        const outer = { n: [px0, pz0, px1, pz0], s: [px0, pz1, px1, pz1], w: [px0, pz0, px0, pz1], e: [px1, pz0, px1, pz1] }[P.side];
        const [ax, az, bx, bz] = outer;
        const len = Math.hypot(bx - ax, bz - az);
        const ux = (bx - ax) / len;
        const uz = (bz - az) / len;
        for (const [a0, a1] of [[0.1, len / 2 - 0.9], [len / 2 + 0.9, len - 0.1]]) {
          if (a1 <= a0) continue;
          for (let t = a0; t <= a1 + 1e-6; t += Math.max(0.6, (a1 - a0) / Math.round((a1 - a0) / 1.2))) {
            const post = box(0.07, 0.95, 0.07, M.deck, 1);
            post.position.set(ax + ux * t, 0.47, az + uz * t);
            root.add(post);
          }
          const rail = box(a1 - a0, 0.06, 0.08, M.deck, 1.5);
          rail.position.set(ax + ux * (a0 + a1) / 2, 0.92, az + uz * (a0 + a1) / 2);
          rail.rotation.y = Math.atan2(ux, uz) + Math.PI / 2;
          root.add(rail);
        }
      }
      continue;
    }
    if (o.kind === 'sunk') {
      // une maison qui sombre : la même, sans cloison, penchée et enfoncée dans l'eau ; on n'y entre pas
      const X0 = x0 + WALL_T / 2;
      const Z0 = z0 + WALL_T / 2;
      const X1 = x0 + w - WALL_T / 2;
      const Z1 = z0 + h - WALL_T / 2;
      const win = (len) => [{ at: len * 0.3, w: 1.0, kind: 'window' }, { at: len * 0.72, w: 1.0, kind: 'window' }];
      const hs = { X0, Z0, X1, Z1, style: o.style, segs: [
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

  // 5. La sortie : une trappe de bunker au milieu du dernier îlot. Un caisson de béton, le couvercle d'acier rabattu
  // (son volant), le puits noir, l'échelle qui y descend (ses montants dépassent, recourbés, pour qu'on s'y tienne),
  // et un gyrophare sur son poteau qu'on voit de loin dans la brume
  const E = map.exit;
  const hatchG = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: '#5e5c56', roughness: 0.95 });
  const steel = new THREE.MeshStandardMaterial({ color: '#4c5a4f', metalness: 0.6, roughness: 0.55 });
  const rust = new THREE.MeshStandardMaterial({ color: '#6b4a34', metalness: 0.4, roughness: 0.8 });
  const CH = 0.55; // la hauteur du caisson
  const IN = 0.9; // l'ouverture
  const WT = 0.22; // l'épaisseur du béton
  for (const [x, z, w, d] of [[0, -(IN + WT) / 2, IN + WT * 2, WT], [0, (IN + WT) / 2, IN + WT * 2, WT], [-(IN + WT) / 2, 0, WT, IN], [(IN + WT) / 2, 0, WT, IN]]) {
    const b = box(w, CH, d, concrete, 1);
    b.position.set(x, CH / 2, z);
    hatchG.add(b);
  }
  // le puits : noir, à peine éclairé sur ses parois
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(IN, CH, IN), new THREE.MeshStandardMaterial({ color: '#1a1c1b', roughness: 1, side: THREE.BackSide }));
  shaft.position.y = CH / 2;
  hatchG.add(shaft);
  const pit = new THREE.Mesh(new THREE.PlaneGeometry(IN, IN), new THREE.MeshBasicMaterial({ color: '#000000' }));
  pit.rotation.x = -Math.PI / 2;
  pit.position.y = 0.02;
  hatchG.add(pit);
  // le cadre d'acier sur le caisson
  for (const [x, z, w, d] of [[0, -IN / 2 - 0.04, IN + 0.16, 0.08], [0, IN / 2 + 0.04, IN + 0.16, 0.08], [-IN / 2 - 0.04, 0, 0.08, IN], [IN / 2 + 0.04, 0, 0.08, IN]]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), steel);
    b.position.set(x, CH + 0.025, z);
    hatchG.add(b);
  }
  // le couvercle, ouvert : pivote sur sa charnière au bord nord et retombe un peu en arrière
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, CH + 0.05, -IN / 2 - 0.06);
  lidPivot.rotation.x = -1.95;
  const lid = new THREE.Mesh(new THREE.BoxGeometry(IN + 0.14, 0.07, IN + 0.12), steel);
  lid.position.set(0, 0.035, (IN + 0.12) / 2);
  lidPivot.add(lid);
  const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 20), rust);
  wheel.rotation.x = Math.PI / 2;
  wheel.position.set(0, 0.13, (IN + 0.12) / 2);
  lidPivot.add(wheel);
  for (const a of [0, Math.PI / 2]) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.025, 0.025), rust);
    spoke.rotation.y = a;
    spoke.position.copy(wheel.position);
    lidPivot.add(spoke);
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 10), rust);
  hub.position.set(0, 0.09, (IN + 0.12) / 2);
  lidPivot.add(hub);
  hatchG.add(lidPivot);
  // l'échelle contre la paroi sud : ses barreaux s'enfoncent dans le noir, ses montants sortent et se recourbent
  const lz = IN / 2 - 0.1;
  for (const sx of [-0.22, 0.22]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, CH + 0.75, 8), rust);
    rail.position.set(sx, (CH + 0.75) / 2 - 0.02, lz);
    hatchG.add(rail);
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.022, 8, 12, Math.PI), rust);
    bend.rotation.y = Math.PI / 2;
    bend.position.set(sx, CH + 0.73, lz + 0.13);
    hatchG.add(bend);
  }
  for (let y = CH + 0.6; y > 0; y -= 0.28) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), rust);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, y, lz);
    hatchG.add(rung);
  }
  // le gyrophare sur son poteau, au coin du caisson
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 8), steel);
  post.position.set(IN / 2 + WT + 0.25, 1.1, -IN / 2 - WT);
  hatchG.add(post);
  const BULB = new THREE.Color('#ffb347');
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), new THREE.MeshBasicMaterial({ color: BULB.clone() }));
  bulb.position.set(post.position.x, 2.28, post.position.z);
  hatchG.add(bulb);
  const lamp = new THREE.PointLight('#ffb347', 2.5, 18, 1.6);
  lamp.position.copy(bulb.position);
  hatchG.add(lamp);
  hatchG.position.set(E.x, 0, E.z);
  root.add(hatchG);

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
      seaMat.uniforms.uT.value = time;
      // le gyrophare de la trappe : un éclat toutes les 1,4 s
      const flash = Math.max(0, Math.sin(time * 4.5)) ** 3;
      lamp.intensity = 0.6 + flash * 4;
      bulb.material.color.setScalar(0.35 + flash * 0.65).multiply(BULB);
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
