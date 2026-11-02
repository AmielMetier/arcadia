// Site Noir : modèles 3D (Poly Pizza, voir models/LICENSE.txt). Chargés en arrière-plan ; chaque modèle est ramené à une taille réelle, posé au sol et centré.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';
import { grimeTexture } from './textures.js';

// hauteur réelle (m) de chaque meuble
const HEIGHT = {
  desk: 0.8, labdesk: 1, computer: 0.48, chair: 1.05, filecabinet: 1.45, shelftall: 2.25, storageshelf: 1.9, scificrate: 0.72, crate: 0.95, oildrum: 1.05, gastank: 1.25,
  watertank: 2.4, pipes: 0.6, generator: 1.5, vending: 2, couch: 0.85, bunk: 1.9, foldtable: 0.76, spotlight: 4.6, labequip: 0.32, locker: 2.05, fence: 2.6,
  flashlight: 0.1, battery: 0.16, key: 0.05, keycard: 0.09, seccam: 0.32, lightceiling: 0.28,
};
const baseUrl = new URL('../models/', import.meta.url).href;

// les modèles sont en aplats de couleur : une saleté prise dans les coordonnées du monde casse l'aplat, ternit les couleurs et varie la brillance
const uGrime = { value: null };
export function grime(mat, amount = 1) {
  uGrime.value ||= grimeTexture();
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uGrime = uGrime; sh.uniforms.uGrimeK = { value: amount };
    sh.vertexShader = 'varying vec3 vGw;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 gw0 = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        gw0 = instanceMatrix * gw0;
      #endif
      vGw = (modelMatrix * gw0).xyz;`);
    sh.fragmentShader = 'uniform sampler2D uGrime; uniform float uGrimeK; varying vec3 vGw; float gN;\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        gN = texture2D(uGrime, (vGw.xz + vGw.y * 0.71) * 0.31).r * 0.55 + texture2D(uGrime, (vGw.zx - vGw.y * 0.53) * 1.9).r * 0.45;
        float gL = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(gL), 0.28 * uGrimeK);
        diffuseColor.rgb *= mix(1.0, mix(0.34, 1.22, smoothstep(0.28, 0.72, gN)), uGrimeK);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + (gN - 0.5) * 0.7 * uGrimeK, 0.08, 1.0);`);
  };
  return mat;
}

export class Models {
  constructor() { this.src = new Map(); this.loader = new GLTFLoader(); this.ready = this.loadAll(); }
  async loadAll() {
    const names = [...Object.keys(HEIGHT), 'hazmat', 'animhuman'];
    await Promise.all(names.map((n) => this.loader.loadAsync(`${baseUrl}${n}.glb`).then((g) => this.src.set(n, g)).catch((e) => console.warn('modèle manquant', n, e))));
  }
  // un objet normal : les maillages cuits dans le repère du modèle, à la bonne taille, posé au sol, centré
  static prepare(scene, h) {
    scene.updateMatrixWorld(true);
    const b = new THREE.Box3().setFromObject(scene), s = new THREE.Vector3(), c = new THREE.Vector3();
    b.getSize(s); b.getCenter(c);
    const k = h / (s.y || 1);
    const fix = new THREE.Matrix4().makeScale(k, k, k).multiply(new THREE.Matrix4().makeTranslation(-c.x, -b.min.y, -c.z));
    const parts = [];
    scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = (Array.isArray(o.material) ? o.material[0] : o.material).clone();
      if (m.metalness !== undefined) { m.metalness = Math.min(m.metalness, 0.35); m.roughness = Math.max(m.roughness, 0.55); m.envMapIntensity = 0; }
      grime(m);
      parts.push({ geo: o.geometry, mat: m, mtx: fix.clone().multiply(o.matrixWorld) });
    });
    return { parts, size: s.clone().multiplyScalar(k) };
  }
  parts(name) {
    this.cache ||= new Map();
    if (this.cache.has(name)) return this.cache.get(name);
    const g = this.src.get(name); if (!g) return null;
    const r = Models.prepare(g.scene, HEIGHT[name] || 1);
    this.cache.set(name, r);
    return r;
  }
  // une copie indépendante (objets ramassables, caméras)
  mesh(name, scale = 1) {
    const r = this.parts(name), o = new THREE.Group();
    if (!r) return o;
    for (const p of r.parts) { const m = new THREE.Mesh(p.geo, p.mat); m.applyMatrix4(p.mtx); o.add(m); }
    o.scale.setScalar(scale);
    return o;
  }
  anim(name) { return this.src.get(name)?.animations || []; }
  skinned(name) { const g = this.src.get(name); return g ? cloneSkinned(g.scene) : null; }
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
    o.frustumCulled = false;
  });
  return clone;
}
