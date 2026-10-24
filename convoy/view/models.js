// Convoy Storm — modèles 3D (Kenney, licence CC0 : kenney.nl) et matériau « givré ».
// Les modèles se chargent en arrière-plan : tant qu'ils ne sont pas là, la scène dessine des boîtes simples.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

export const MODEL_LIST = [
  'city/building-small-a', 'city/building-small-b', 'city/building-small-c', 'city/building-small-d', 'city/building-garage',
  'racing/vehicle-truck-red', 'racing/vehicle-truck-green', 'racing/vehicle-truck-yellow', 'racing/decoration-tents',
  'arena/tree', 'arena/column-damaged', 'arena/statue', 'arena/wall', 'arena/bricks', 'arena/banner', 'platformer/flag',
];

// Neige sur les faces tournées vers le ciel, teinte froide partout ailleurs. amount : 0 (aucun givre) → 1.
export function frost(mat, amount = 1, tint = [0.8, 0.86, 0.94]) {
  const m = mat.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFrost = { value: amount };
    sh.uniforms.uTint = { value: new THREE.Vector3(...tint) };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFrostN;')
      .replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\nvFrostN = normalize( mat3( modelMatrix ) * objectNormal );');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vFrostN;\nuniform float uFrost;\nuniform vec3 uTint;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float snowUp = smoothstep(0.45, 0.8, vFrostN.y) * uFrost;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uTint, uFrost * 0.85);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.94, 0.96, 1.0), snowUp * 0.95);`);
  };
  m.customProgramCacheKey = () => 'frost' + amount.toFixed(2) + tint.join(',');
  return m;
}

// Charge tous les modèles ; renvoie { get(name) → gabarit (Object3D), ext(name) → taille de la boîte englobante }
export async function loadKit(base) {
  const loader = new GLTFLoader();
  const kit = new Map();
  await Promise.all(MODEL_LIST.map(async (name) => {
    try {
      const g = await loader.loadAsync(`${base}${name}.glb`);
      const root = g.scene;
      const box = new THREE.Box3().setFromObject(root);
      kit.set(name, { root, box, size: box.getSize(new THREE.Vector3()) });
    } catch (e) { console.warn('modèle manquant', name, e); }
  }));
  // matériaux : une version givrée (ruines) et une version propre (ville d'arrivée), partagées entre clones
  const frosted = new Map(), clean = new Map();
  const matOf = (src, cleanLook) => {
    const cache = cleanLook ? clean : frosted;
    if (!cache.has(src)) cache.set(src, cleanLook ? frost(src, 0.25, [0.95, 0.97, 1]) : frost(src, 1));
    return cache.get(src);
  };
  return {
    has: (name) => kit.has(name),
    size: (name) => kit.get(name)?.size,
    // copie du modèle, ajustée à une boîte w × h × d, base posée à y = 0, centrée en x et z
    make(name, w, h, d, { cleanLook = false, uniform = false } = {}) {
      const k = kit.get(name); if (!k) return null;
      const o = k.root.clone(true);
      o.traverse((c) => { if (c.isMesh) { c.material = matOf(c.material, cleanLook); c.castShadow = true; c.receiveShadow = true; } });
      const sx = w / k.size.x, sy = h / k.size.y, sz = d / k.size.z;
      const s = uniform ? Math.min(sx, sz) : 1;
      const g = new THREE.Group();
      o.scale.set(uniform ? s : sx, uniform ? s : sy, uniform ? s : sz);
      const c = k.box.getCenter(new THREE.Vector3());
      o.position.set(-c.x * o.scale.x, -k.box.min.y * o.scale.y, -c.z * o.scale.z);
      g.add(o);
      return g;
    },
    dispose() {
      for (const m of [...frosted.values(), ...clean.values()]) m.dispose();
      for (const k of kit.values()) k.root.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); const ms = Array.isArray(c.material) ? c.material : [c.material]; for (const m of ms) { m.map?.dispose(); m.dispose(); } } });
    },
  };
}
