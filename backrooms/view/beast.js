// The Backrooms - L'entité en 3D (mode normal) : une grande silhouette décharnée, voûtée, aux bras qui pendent
// jusqu'aux genoux, aux doigts interminables et au cou trop long, la tête penchée à un angle impossible. Elle porte le
// visage de l'entité classique (view/entity.js) : tête noire allongée, yeux blancs inégaux, bouche béante et dents.
// Le squelette et ses animations (attente, marche, course) viennent de models/hazmat.glb (Quaternius, CC0) ; le corps
// est fait de pièces dessinées dans le code, fixées aux os et rallongées.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

const MODEL = new URL('../models/hazmat.glb', import.meta.url).href;
const SCALE = 1.22; // l'explorateur fait 1,78 m : elle, 2,6 m une fois le cou et les jambes allongés
const LEG = 1.25; // jambes trop longues : tout le corps est soulevé d'autant

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function noise2(x, y, s) {
  const h = (i, j) => {
    const v = Math.sin(i * 127.1 + j * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = h(xi, yi);
  const b = h(xi + 1, yi);
  const c = h(xi, yi + 1);
  const d = h(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// peau : noir qui n'est pas noir, marbré de veines grises (comme l'entité classique)
function skinTexture() {
  const [c, g] = canvas(128, 256);
  const img = g.createImageData(128, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 128; x++) {
      const n = noise2(x / 14, y / 14, 3) * 0.6 + noise2(x / 5, y / 5, 4) * 0.4;
      const vein = Math.pow(1 - Math.abs(noise2(x / 9, y / 22, 7) - 0.5) * 2, 10);
      const v = 12 + n * 20 + vein * 34 + (Math.random() - 0.5) * 8;
      const i = (y * 128 + x) * 4;
      img.data[i] = v * 1.06;
      img.data[i + 1] = v * 0.96;
      img.data[i + 2] = v * 0.9;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// le visage de l'entité classique : yeux blancs vides de tailles différentes, bouche trop grande avec ses dents
function faceTexture(open) {
  const W = 256;
  const H = 320;
  const [c, g] = canvas(W, H);
  g.clearRect(0, 0, W, H);
  // la face, ovale, marbrée
  g.save();
  g.beginPath();
  g.ellipse(W / 2, H / 2, W * 0.47, H * 0.47, 0, 0, Math.PI * 2);
  g.clip();
  const img = g.getImageData(0, 0, W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const n = noise2(x / 18, y / 18, 9) * 0.6 + noise2(x / 6, y / 6, 2) * 0.4;
      const vein = Math.pow(1 - Math.abs(noise2(x / 12, y / 30, 5) - 0.5) * 2, 10);
      const edge = Math.hypot((x - W / 2) / (W * 0.47), (y - H / 2) / (H * 0.47));
      const v = (10 + n * 18 + vein * 30) * (1 - edge * 0.6);
      const i = (y * W + x) * 4;
      img.data[i] = v * 1.06;
      img.data[i + 1] = v * 0.96;
      img.data[i + 2] = v * 0.9;
      img.data[i + 3] = edge < 1 ? 255 : 0;
    }
  }
  g.putImageData(img, 0, 0);
  g.restore();
  // bouche béante
  const mx = W * 0.5;
  const my = H * 0.7;
  const rx = W * 0.24;
  const ry = H * (0.05 + 0.1 * open);
  g.fillStyle = '#2a0000';
  g.beginPath();
  g.ellipse(mx, my, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#0a0000';
  g.beginPath();
  g.ellipse(mx, my + ry * 0.15, rx * 0.8, ry * 0.65, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(230,225,210,0.9)';
  g.lineWidth = 3;
  for (let i = -5; i <= 5; i++) {
    const tx = mx + i * rx * 0.17;
    const lift = Math.sqrt(Math.max(0, 1 - (i / 6) ** 2));
    g.beginPath();
    g.moveTo(tx, my - ry * lift);
    g.lineTo(tx + 2, my - ry * lift + ry * 0.45);
    g.stroke();
    g.beginPath();
    g.moveTo(tx, my + ry * lift);
    g.lineTo(tx - 2, my + ry * lift - ry * 0.45);
    g.stroke();
  }
  // yeux blancs, vides, l'un plus grand que l'autre, qui luisent
  g.shadowColor = 'rgba(255,255,255,1)';
  g.shadowBlur = 18;
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.ellipse(W * 0.32, H * 0.4, W * 0.11, H * 0.065, -0.2, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(W * 0.7, H * 0.37, W * 0.075, H * 0.042, 0.3, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// copie d'un objet animé avec son propre squelette (comme SkeletonUtils.clone)
function cloneSkinned(src) {
  const clone = src.clone(true);
  const map = new Map();
  const walk = (a, b) => {
    map.set(a, b);
    for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]);
  };
  walk(src, clone);
  clone.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    let s = null;
    for (const [a, b] of map) if (b === o) s = a;
    const sk = s.skeleton.clone();
    sk.bones = s.skeleton.bones.map((b) => map.get(b));
    o.bind(sk, s.bindMatrix);
  });
  return clone;
}

// os, os enfant, rayon (m), allongement de l'os enfant
const L = ['L', 'R'];
const SEGMENTS = [
  ['Hips', 'Abdomen', 0.12, 1],
  ['Abdomen', 'Torso', 0.1, 1],
  ['Torso', 'Neck', 0.15, 1],
  ['Neck', 'Head', 0.035, 2.4], // cou interminable
  ...L.flatMap((s) => [
    ['Hips', `UpperLeg${s}`, 0.07, 1], // bassin
    [`Shoulder${s}`, `UpperArm${s}`, 0.06, 1],
    [`UpperArm${s}`, `LowerArm${s}`, 0.042, 1.45], // bras qui pendent jusqu'aux genoux
    [`LowerArm${s}`, `Middle1${s}`, 0.034, 1.5],
    ...['Index', 'Middle', 'Pinky'].flatMap((f) => [
      [`${f}1${s}`, `${f}2${s}`, 0.011, 2.4], // doigts trop longs
      [`${f}2${s}`, `${f}3${s}`, 0.009, 2.4],
      [`${f}3${s}`, `${f}3${s}_end`, 0.007, 2.6],
    ]),
    [`Thumb1${s}`, `Thumb2${s}`, 0.011, 1.8],
    [`UpperLeg${s}`, `LowerLeg${s}`, 0.06, LEG],
    [`LowerLeg${s}`, `LowerLeg${s}_end`, 0.045, LEG],
  ]),
];

let source = null;
const loading = new GLTFLoader().loadAsync(MODEL).then((g) => {
  source = g;
}, () => {});

export function createBeast() {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshLambertMaterial({ map: skinTexture(), emissive: '#1a1716', emissiveIntensity: 0 });
  const faces = [faceTexture(0.25), faceTexture(1)];
  const faceMat = new THREE.MeshBasicMaterial({ map: faces[0], transparent: true, alphaTest: 0.3, color: '#cfcac4' });
  const st = { ready: false, w: { Idle: 1, Walk: 0, Run: 0 }, last: null, speed: 0, twitch: 0, twitchT: 1 };

  const build = () => {
    const root = cloneSkinned(source.scene);
    root.scale.multiplyScalar(SCALE);
    // le corps d'origine (la combinaison) disparaît : seul le squelette sert
    root.traverse((o) => {
      if (o.isMesh) o.visible = false;
    });
    root.updateMatrixWorld(true);
    const bones = {};
    root.traverse((o) => {
      if (o.isBone || o.type === 'Bone' || o.type === 'Object3D') bones[o.name] = o;
    });
    const Y = new THREE.Vector3(0, 1, 0);
    const ws = new THREE.Vector3();
    st.stretch = [];
    for (const [a, b, r, k] of SEGMENTS) {
      const A = bones[a];
      const B = bones[b];
      if (!A || !B) continue;
      A.getWorldScale(ws);
      const s = 1 / ws.x; // les os sont à l'échelle 100 : on dessine en mètres
      const rest = B.position.clone();
      if (k !== 1) st.stretch.push({ B, rest, k });
      const len = rest.length() * k * ws.x;
      const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 3, 8);
      const m = new THREE.Mesh(geo, skinMat);
      m.frustumCulled = false;
      m.scale.setScalar(s);
      m.position.copy(rest).multiplyScalar(k / 2);
      m.quaternion.setFromUnitVectors(Y, rest.clone().normalize());
      A.add(m);
    }
    // côtes saillantes sur le torse
    const torso = bones.Torso;
    if (torso) {
      torso.getWorldScale(ws);
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(new THREE.TorusGeometry(0.12 - i * 0.008, 0.012, 5, 14, Math.PI * 1.2), skinMat);
        rib.scale.setScalar(1 / ws.x);
        rib.rotation.set(Math.PI / 2, 0, -Math.PI * 0.1);
        rib.position.set(0, (0.04 + i * 0.05) / ws.x, 0.02 / ws.x);
        torso.add(rib);
      }
    }
    // la tête : un crâne allongé, et le visage tourné vers l'avant (là où regarde le modèle au repos)
    const head = bones.Head;
    if (head) {
      head.getWorldScale(ws);
      const s = 1 / ws.x;
      const q = new THREE.Quaternion();
      head.getWorldQuaternion(q);
      const rootQ = new THREE.Quaternion();
      root.getWorldQuaternion(rootQ);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(rootQ).applyQuaternion(q.clone().invert()).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 14, 12), skinMat);
      skull.scale.set(s, s * 1.45, s * 1.1);
      skull.position.copy(up).multiplyScalar(0.17 * s);
      head.add(skull);
      const face = new THREE.Mesh(new THREE.PlaneGeometry(0.27, 0.36), faceMat);
      face.scale.setScalar(s);
      face.position.copy(up).multiplyScalar(0.16 * s).addScaledVector(fwd, 0.162 * s);
      face.lookAt(face.position.clone().add(fwd)); // dans le repère de l'os : le plan regarde vers l'avant
      head.add(face);
      st.head = head;
    }
    st.torso = torso;
    st.neck = bones.Neck;
    st.mixer = new THREE.AnimationMixer(root);
    st.acts = {};
    for (const n of ['Idle', 'Walk', 'Run']) {
      const c = source.animations.find((a) => a.name.endsWith('|' + n));
      if (!c) continue;
      st.acts[n] = st.mixer.clipAction(c);
      st.acts[n].play();
      st.acts[n].weight = n === 'Idle' ? 1 : 0;
    }
    // les jambes rallongées : on soulève le corps pour que les pieds touchent le sol
    const legLen = ['UpperLegL', 'LowerLegL'].reduce((a, n) => {
      const b = bones[n];
      const c = b && b.children.find((o) => /LowerLeg|_end/.test(o.name));
      return a + (c ? c.position.length() * 100 : 0);
    }, 0);
    root.position.y = legLen * (LEG - 1) * SCALE;
    // un pied osseux au bout de chaque jambe
    for (const s of L) {
      const end = bones[`LowerLeg${s}_end`];
      if (!end) continue;
      end.getWorldScale(ws);
      const foot = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.18, 3, 8), skinMat);
      foot.scale.setScalar(1 / ws.x);
      foot.rotation.x = Math.PI / 2;
      end.add(foot);
    }
    group.add(root);
    st.ready = true;
  };
  if (source) build();
  else loading.then(() => source && build());

  return {
    group,
    // M : l'entité ; chase : elle poursuit ; light : lumière des néons là où elle est ; dt : durée de l'image
    update(M, chase, light, dt, time) {
      // sa vitesse, d'après son déplacement (pareil chez l'hôte et chez les invités)
      if (st.last && dt > 0) {
        const v = Math.hypot(M.x - st.last.x, M.z - st.last.z) / dt;
        st.speed += (Math.min(6, v) - st.speed) * Math.min(1, dt * 6);
      }
      st.last = { x: M.x, z: M.z };
      skinMat.emissiveIntensity = Math.min(0.6, light * 0.25);
      faceMat.map = chase ? faces[1] : faces[0];
      if (!st.ready) return;
      const want = st.speed < 0.25 ? 'Idle' : st.speed > 2.6 ? 'Run' : 'Walk';
      for (const n in st.acts) {
        st.w[n] += ((n === want ? 1 : 0) - st.w[n]) * Math.min(1, dt * 6);
        st.acts[n].weight = st.w[n];
      }
      // ses grandes jambes : l'animation se joue au rythme de sa vitesse
      if (st.acts.Walk) st.acts.Walk.timeScale = THREE.MathUtils.clamp(st.speed / 1.6, 0.6, 1.6);
      if (st.acts.Run) st.acts.Run.timeScale = THREE.MathUtils.clamp(st.speed / 4, 0.7, 1.4);
      st.mixer.update(dt);
      // ce que l'animation ne fait pas : membres rallongés, dos voûté, tête penchée qui tressaute
      for (const s of st.stretch) s.B.position.copy(s.rest).multiplyScalar(s.k);
      if (st.torso) st.torso.rotation.x += 0.38;
      if (st.neck) st.neck.rotation.x -= 0.15;
      st.twitchT -= dt;
      if (st.twitchT <= 0) {
        st.twitch = (Math.random() - 0.5) * (chase ? 1.4 : 0.8);
        st.twitchT = 0.15 + Math.random() * (chase ? 0.6 : 2.2);
      }
      if (st.head) {
        st.head.rotation.z += 0.45 + st.twitch * 0.5;
        st.head.rotation.x += -0.25 + Math.sin(time * 1.3) * 0.05;
      }
    },
  };
}
