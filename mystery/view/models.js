// Mystère Mystère : modèles 3D. Personnages animés de Quaternius, mobilier Kenney et KayKit (CC0, voir models/LICENSE.txt),
// et quelques pièces du manoir dessinées dans le code (cheminée, billard, piano, horloge, armure…).
// Chaque meuble est ramené à sa hauteur réelle, posé au sol et centré ; le bois clair des kits devient acajou.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

const base = new URL('../models/', import.meta.url).href;
export const CHAR_MODELS = ['man-suit', 'woman-suit', 'man-casual', 'woman-casual', 'man-casual-2', 'woman-casual-2'];
export const SKINS = ['#f3c9a8', '#e0ac85', '#c68863', '#8d5a3b', '#f6d7c0', '#b37450'];
export const HAIRS = ['#2b1d14', '#5a3418', '#b07a3a', '#e3c27a', '#7a2f1c', '#1d1d24', '#9a9aa4'];

// couleurs du manoir pour les matières des kits (Kenney : wood, woodDark, carpet, metal…)
const RECOLOR = {
  wood: '#8a4a2b', woodDark: '#4e2616', carpet: '#9c2a3a', carpetDarker: '#7a1f2d', carpetWhite: '#efe4cc', carpetBlue: '#2f4f8a',
  metal: '#c9a24a', metalDark: '#3a3a42', metalLight: '#d8d4cc', metalMedium: '#9a9488', glass: '#bfe3f0', plant: '#4f9a5a', pot: '#b5603a',
  _defaultMat: '#efe8da', colormap: null, lamp: '#ffe7a8', paper: '#f0e6d0', leaf: '#4f9a5a', stone: '#9a958e',
};
const matCache = new Map();
export function mat(color, o = {}) {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshLambertMaterial({ color, ...o }));
  return matCache.get(k);
}

export class Models {
  constructor() {
    this.loader = new GLTFLoader();
    this.src = new Map();
    this.ready = this.loadAll();
  }
  async loadAll(names = []) {
    const list = [...CHAR_MODELS.map((n) => 'perso/' + n), 'meubles/dagger', ...names.map((n) => 'meubles/' + n)];
    await Promise.all(list.map((n) => this.load(n)));
  }
  load(n) {
    if (this.src.has(n)) return Promise.resolve(this.src.get(n));
    return this.loader.loadAsync(`${base}${n}.glb`).then((g) => { this.src.set(n, g); return g; }).catch((e) => { console.warn('modèle manquant', n, e); this.src.set(n, null); return null; });
  }
  // un meuble, cuit à la bonne taille, en morceaux { geo, mat, mtx } prêts à fusionner
  parts(name, h, s) {
    const g = this.src.get('meubles/' + name);
    if (!g) return null;
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(scene), size = new THREE.Vector3(), c = new THREE.Vector3();
    b.getSize(size); b.getCenter(c);
    const k = (h || size.y) / (size.y || 1);
    const sx = s ? s[0] / (size.x || 1) : k, sz = s ? s[1] / (size.z || 1) : k;
    const fix = new THREE.Matrix4().makeScale(sx, k, sz).multiply(new THREE.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
    const out = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const src = Array.isArray(o.material) ? o.material[0] : o.material;
      out.push({ geo: o.geometry, mat: furnitureMat(src), mtx: fix.clone().multiply(o.matrixWorld) });
    });
    return out;
  }
  // personnage animé : une copie avec son propre squelette
  character(model, look) {
    const g = this.src.get('perso/' + CHAR_MODELS[model % CHAR_MODELS.length]) || this.src.get('perso/' + CHAR_MODELS[0]);
    if (!g) return null;
    const root = cloneSkinned(g.scene);
    const suit = /suit/.test(CHAR_MODELS[model % CHAR_MODELS.length]);
    const grad = toonRamp();
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.frustumCulled = false;
      const n = (o.material.name || '').replace(/\.\d+$/, '');
      let color = '#888888';
      if (n === 'Skin') color = look.skin;
      else if (n === 'Hair') color = look.hair;
      else if (n === 'Face') color = '#1c1820';
      else if (n === 'Black') color = suit ? look.color : '#22222a';
      else if (n === 'Shirt') color = suit ? '#f4f1ea' : look.color;
      else if (n === 'Pants') color = look.pants;
      else if (n === 'Belt') color = '#2a1d16';
      else if (n === 'Details') color = suit ? look.tie : '#2a2a2a';
      o.material = new THREE.MeshToonMaterial({ color, gradientMap: grad });
    });
    // le modèle d'origine mesure 1,75 m
    return { root, clips: g.animations };
  }
  // couteau (dague de Quaternius), ramené à 32 cm, pointe vers -z
  knife() {
    const g = this.src.get('meubles/dagger');
    const o = new THREE.Group();
    if (!g) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.02, 0.3), mat('#d8dde4')); o.add(m); return o; }
    const s = g.scene.clone(true);
    s.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(s), size = new THREE.Vector3(), c = new THREE.Vector3(); b.getSize(size); b.getCenter(c);
    const k = 0.36 / Math.max(size.x, size.y, size.z);
    s.position.set(-c.x * k, -c.y * k, -c.z * k); s.scale.setScalar(k);
    // la lame est le long de y dans le modèle : on la couche vers -z
    const holder = new THREE.Group(); holder.add(s); holder.rotation.x = -Math.PI / 2;
    s.traverse((m) => { if (m.isMesh) { const steel = /Steel/.test(m.material.name); m.material = new THREE.MeshPhongMaterial({ color: steel ? '#dfe5ee' : /Gold/.test(m.material.name) ? '#e0b84a' : '#7a3f22', specular: steel ? '#ffffff' : '#333333', shininess: steel ? 90 : 20 }); } });
    o.add(holder);
    return o;
  }
}

function furnitureMat(src) {
  const name = (src.name || '').replace(/\.\d+$/, '');
  if (src.map) {
    const k = 'map:' + src.map.uuid;
    if (!matCache.has(k)) { const m = new THREE.MeshLambertMaterial({ map: src.map }); m.map.colorSpace = THREE.SRGBColorSpace; matCache.set(k, m); }
    return matCache.get(k);
  }
  const col = RECOLOR[name] !== undefined && RECOLOR[name] !== null ? RECOLOR[name] : '#' + src.color.getHexString();
  const extra = name === 'glass' ? { transparent: true, opacity: 0.55 } : name === 'lamp' ? { emissive: '#ffcf70', emissiveIntensity: 0.8 } : {};
  return mat(col, extra);
}
let ramp = null;
export function toonRamp() {
  if (ramp) return ramp;
  const d = new Uint8Array([90, 160, 225, 255]);
  ramp = new THREE.DataTexture(d, 4, 1, THREE.RedFormat); ramp.minFilter = ramp.magFilter = THREE.NearestFilter; ramp.needsUpdate = true;
  return ramp;
}
// copie d'un objet animé avec son propre squelette (comme SkeletonUtils.clone)
export function cloneSkinned(src) {
  const clone = src.clone(true), map = new Map();
  const walk = (a, b) => { map.set(a, b); for (let i = 0; i < a.children.length; i++) walk(a.children[i], b.children[i]); };
  walk(src, clone);
  clone.traverse((o) => {
    if (!o.isSkinnedMesh) return;
    let s = null;
    for (const [a, b] of map) if (b === o) { s = a; break; }
    const sk = s.skeleton.clone();
    sk.bones = s.skeleton.bones.map((b) => map.get(b));
    o.bind(sk, s.bindMatrix);
  });
  return clone;
}

// ------------------------------------------------------------------ pièces dessinées dans le code
// chaque fonction rend un groupe posé au sol, centré, à sa taille réelle (avant la rotation du meuble)
const box = (w, h, d, color, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, o) : color); m.position.set(x, y + h / 2, z); return m; };
const cyl = (rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12, o) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color, o) : color); m.position.set(x, y + h / 2, z); return m; };
const sph = (r, color, x = 0, y = 0, z = 0, o) => { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), typeof color === 'string' ? mat(color, o) : color); m.position.set(x, y, z); return m; };
const G = (...ms) => { const g = new THREE.Group(); for (const m of ms) g.add(m); return g; };
const WOOD = '#6e3420', DARK = '#3d1d12', BRASS = '#d0a548', MARBLE = '#e8e2d6';
export const PROC = {
  fireplace: () => G(box(0.8, 1.6, 2.6, MARBLE, 0, 0, 0), box(0.5, 1.1, 1.6, '#1b1414', 0.18, 0.05, 0), box(0.95, 0.14, 2.9, MARBLE, 0, 1.6, 0), box(0.35, 0.8, 2.2, '#a9a196', -0.2, 1.74, 0),
    box(0.3, 0.12, 0.9, '#5a3a22', 0.25, 0.08, 0), cyl(0.04, 0.04, 0.5, '#5a3a22', 0.25, 0.2, 0.2), sph(0.17, mat('#ff7a2a', { emissive: '#ff5a10', emissiveIntensity: 1.2 }), 0.25, 0.32, 0), sph(0.12, mat('#ffd060', { emissive: '#ffb020', emissiveIntensity: 1.4 }), 0.28, 0.42, -0.15),
    box(0.1, 0.5, 0.36, '#e7c37a', -0.2, 2.6, 0)),
  grandfather: () => G(box(0.6, 2.2, 0.45, WOOD), box(0.66, 0.2, 0.5, DARK, 0, 2.2, 0), cyl(0.2, 0.2, 0.04, '#f4ecd8', 0, 1.75, 0.24, 24), box(0.02, 0.15, 0.01, '#222', 0, 1.82, 0.27), box(0.1, 0.02, 0.01, '#222', 0.04, 1.95, 0.27),
    box(0.3, 0.9, 0.03, '#2a160e', 0, 0.55, 0.22), cyl(0.07, 0.07, 0.02, BRASS, 0, 0.62, 0.25, 16)),
  statue: () => G(box(0.7, 0.9, 0.7, MARBLE), cyl(0.2, 0.28, 0.75, '#dcd6cb', 0, 0.9, 0), sph(0.18, '#dcd6cb', 0, 1.85, 0), cyl(0.09, 0.12, 0.18, '#dcd6cb', 0, 1.65, 0), box(0.6, 0.12, 0.16, '#dcd6cb', 0, 1.5, 0)),
  globe: () => G(cyl(0.25, 0.35, 0.08, WOOD), cyl(0.04, 0.04, 0.6, DARK, 0, 0.08, 0), sph(0.32, mat('#4f8cc9'), 0, 0.95, 0), box(0.2, 0.12, 0.08, '#6fae5a', 0.12, 1.0, 0.26), box(0.14, 0.16, 0.06, '#6fae5a', -0.18, 0.88, 0.22)),
  billard: () => G(box(3.6, 0.15, 1.9, '#2b6b3a', 0, 0.68, 0), box(3.9, 0.12, 2.2, WOOD, 0, 0.6, 0), box(3.9, 0.12, 0.16, WOOD, 0, 0.78, 1.02), box(3.9, 0.12, 0.16, WOOD, 0, 0.78, -1.02), box(0.16, 0.12, 2.2, WOOD, 1.87, 0.78, 0), box(0.16, 0.12, 2.2, WOOD, -1.87, 0.78, 0),
    ...[[-1.6, -0.85], [1.6, -0.85], [-1.6, 0.85], [1.6, 0.85]].map(([x, z]) => box(0.22, 0.6, 0.22, DARK, x, 0, z)),
    ...[['#f6f2e8', 0.8, 0], ['#d23a2a', -0.6, 0.2], ['#f2c335', -0.8, -0.3], ['#2a4fb0', -0.5, -0.1], ['#222', -0.9, 0.1]].map(([c, x, z]) => sph(0.05, c, x, 0.88, z))),
  piano: () => G(box(1.5, 0.95, 0.6, '#16141a', 0, 0.25, -0.45), box(1.5, 0.12, 0.4, '#16141a', 0, 0.72, 0.05), box(1.4, 0.04, 0.22, '#f4f1ea', 0, 0.84, 0.1), ...Array.from({ length: 10 }, (_, i) => box(0.05, 0.03, 0.12, '#111', -0.6 + i * 0.13, 0.87, 0.05)),
    ...[[-0.65, 0.15], [0.65, 0.15]].map(([x, z]) => box(0.1, 0.72, 0.1, '#16141a', x, 0, z)), box(0.4, 0.3, 0.02, '#f0e6d0', 0, 1.1, -0.18), cyl(0.04, 0.05, 0.15, BRASS, 0.55, 1.2, -0.45), sph(0.05, mat('#fff3c0', { emissive: '#ffcf70', emissiveIntensity: 1 }), 0.55, 1.4, -0.45)),
  harp: () => G(box(0.5, 0.15, 0.3, BRASS), cyl(0.05, 0.06, 1.7, BRASS, -0.18, 0.1, 0), box(0.6, 0.08, 0.08, BRASS, 0.05, 1.68, 0), ...Array.from({ length: 7 }, (_, i) => cyl(0.006, 0.006, 1.3 - i * 0.12, '#f4f1ea', -0.1 + i * 0.05, 0.25 + i * 0.05, 0, 4))),
  fountain: () => G(cyl(1.35, 1.45, 0.45, '#cfc8bb', 0, 0, 0, 24), cyl(1.2, 1.2, 0.05, mat('#5fb5d6', { transparent: true, opacity: 0.85 }), 0, 0.38, 0, 24), cyl(0.18, 0.3, 0.9, '#d8d2c6', 0, 0.4, 0), cyl(0.5, 0.35, 0.12, '#d8d2c6', 0, 1.3, 0, 16), sph(0.15, '#d8d2c6', 0, 1.5, 0)),
  rockinghorse: () => G(box(0.12, 0.08, 1.0, '#8a4a2b', -0.22, 0, 0), box(0.12, 0.08, 1.0, '#8a4a2b', 0.22, 0, 0), box(0.3, 0.32, 0.7, '#f0e2c8', 0, 0.45, 0), box(0.22, 0.4, 0.22, '#f0e2c8', 0, 0.72, -0.35), box(0.2, 0.14, 0.3, '#f0e2c8', 0, 0.98, -0.45), box(0.08, 0.3, 0.3, '#c0392b', 0, 0.78, -0.25), ...[[-0.12, -0.2], [0.12, -0.2], [-0.12, 0.2], [0.12, 0.2]].map(([x, z]) => box(0.07, 0.38, 0.07, '#f0e2c8', x, 0.08, z))),
  armor: () => G(box(0.6, 0.2, 0.6, '#5a5a62'), cyl(0.08, 0.07, 0.75, '#b8bcc4', -0.12, 0.2, 0), cyl(0.08, 0.07, 0.75, '#b8bcc4', 0.12, 0.2, 0), cyl(0.22, 0.18, 0.6, '#c9ccd2', 0, 0.95, 0), sph(0.16, '#c9ccd2', 0, 1.78, 0), box(0.2, 0.04, 0.05, '#222', 0, 1.78, 0.14),
    cyl(0.06, 0.06, 0.55, '#b8bcc4', -0.3, 1.0, 0), cyl(0.06, 0.06, 0.55, '#b8bcc4', 0.3, 1.0, 0), cyl(0.015, 0.015, 1.9, '#6a4a2a', 0.36, 0.2, 0.1, 6), box(0.04, 0.3, 0.14, '#c9ccd2', 0.36, 2.0, 0.1)),
  barrels: () => G(...[[-0.0, -0.5], [0, 0.5]].map(([x, z]) => G(cyl(0.42, 0.42, 1.0, '#7a4528', x, 0, z, 14), cyl(0.43, 0.43, 0.06, '#333', x, 0.15, z, 14), cyl(0.43, 0.43, 0.06, '#333', x, 0.8, z, 14))), cyl(0.38, 0.38, 0.85, '#7a4528', 0, 1.0, 0, 14)),
  winerack: () => { const g = G(box(1.9, 2.1, 0.5, '#4a2a18')); for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) { const b = cyl(0.045, 0.045, 0.3, ['#4a1020', '#2a3a18', '#5a1a14'][(r + c) % 3], -0.75 + c * 0.3, 0.2 + r * 0.32, 0.22, 8); b.rotation.x = Math.PI / 2; b.position.y = 0.25 + r * 0.32; g.add(b); } return g; },
  coffin: () => G(box(0.75, 0.55, 2.0, '#3a1e14'), box(0.8, 0.12, 2.05, '#2a140c', 0, 0.55, 0), box(0.05, 0.02, 0.5, BRASS, 0, 0.67, -0.3), box(0.25, 0.02, 0.05, BRASS, 0, 0.67, -0.4)),
  candles: () => G(cyl(0.12, 0.16, 0.9, BRASS), cyl(0.2, 0.2, 0.04, BRASS, 0, 0.9, 0, 12), ...[-0.12, 0, 0.12].map((x) => G(cyl(0.025, 0.025, 0.18, '#f4ecd8', x, 0.92, 0, 8), sph(0.03, mat('#ffd060', { emissive: '#ffb020', emissiveIntensity: 2 }), x, 1.14, 0)))),
  pillar: () => G(box(0.9, 0.2, 0.9, '#77726c'), cyl(0.32, 0.36, 3.6, '#8d8882', 0, 0.2, 0, 10), box(0.9, 0.2, 0.9, '#77726c', 0, 3.7, 0)),
  safe: () => G(box(0.8, 1.2, 0.7, '#3d4250'), cyl(0.12, 0.12, 0.05, BRASS, 0, 0.7, 0.36, 16), box(0.2, 0.04, 0.03, BRASS, 0.22, 0.45, 0.36)),
  cueRack: () => G(box(0.12, 1.5, 0.7, WOOD, 0, 0.2, 0), ...[-0.24, -0.08, 0.08, 0.24].map((z) => cyl(0.015, 0.012, 1.45, '#d8b98a', 0.08, 0.15, z, 6))),
  frontdoor: () => G(box(2.6, 3.0, 0.2, '#5a2c18', 0, 0, 0), box(1.2, 2.6, 0.06, '#7a3d22', -0.62, 0.1, 0.12), box(1.2, 2.6, 0.06, '#7a3d22', 0.62, 0.1, 0.12), sph(0.06, BRASS, -0.12, 1.3, 0.2), sph(0.06, BRASS, 0.12, 1.3, 0.2),
    box(2.2, 0.6, 0.05, mat('#ffe7a8', { emissive: '#ffcf70', emissiveIntensity: 0.25 }), 0, 2.4, 0.13)),
  tableCoffee: null, // modèle Kenney
};

// revolver du shérif (dessiné), canon vers -z
export function revolver() {
  const steel = new THREE.MeshPhongMaterial({ color: '#8d93a3', specular: '#ffffff', shininess: 60 });
  const grip = new THREE.MeshPhongMaterial({ color: '#8a4a26', shininess: 20 });
  const gold = new THREE.MeshPhongMaterial({ color: '#e0b84a', specular: '#fff2c0', shininess: 80 });
  const g = new THREE.Group();
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.22, 10), steel); barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.05, -0.13); g.add(barrel);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.07, 8), steel); drum.rotation.x = Math.PI / 2; drum.position.set(0, 0.04, -0.005); g.add(drum);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.06, 0.1), steel); frame.position.set(0, 0.045, 0.02); g.add(frame);
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.045), grip); handle.position.set(0, -0.02, 0.07); handle.rotation.x = -0.35; g.add(handle);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.014, 0.012), gold); sight.position.set(0, 0.075, -0.23); g.add(sight);
  const guard = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 10, Math.PI), steel); guard.position.set(0, 0.0, 0.025); guard.rotation.y = Math.PI / 2; guard.rotation.z = Math.PI; g.add(guard);
  return g;
}
// pièce d'or
export function coinGeometry() { const g = new THREE.CylinderGeometry(0.17, 0.17, 0.04, 18); g.rotateX(Math.PI / 2); return g; }
