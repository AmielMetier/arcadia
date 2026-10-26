// Convoy Storm — modèles 3D (Kenney, licence CC0 : kenney.nl) et matériau « givré ».
// Les modèles se chargent en arrière-plan : tant qu'ils ne sont pas là, la scène dessine des formes simples.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

export const MODEL_LIST = [
  'city/building-small-a', 'city/building-small-b', 'city/building-small-c', 'city/building-small-d', 'city/building-garage',
  'racing/vehicle-truck-red', 'racing/vehicle-truck-green', 'racing/vehicle-truck-yellow', 'racing/decoration-tents',
  'arena/tree', 'arena/column-damaged', 'arena/statue', 'arena/wall', 'arena/bricks', 'arena/banner', 'platformer/flag',
  // forêt, rochers, falaises (Nature Kit)
  'nature/tree_pineTallA', 'nature/tree_pineTallB', 'nature/tree_pineTallC', 'nature/tree_pineTallD', 'nature/tree_pineRoundA', 'nature/tree_pineRoundC',
  'nature/tree_pineDefaultA', 'nature/tree_pineSmallA', 'nature/tree_pineSmallC', 'nature/tree_cone_dark', 'nature/tree_thin_dark',
  'nature/log', 'nature/log_large', 'nature/log_stack', 'nature/log_stackLarge', 'nature/stump_old', 'nature/stump_round',
  'nature/rock_largeA', 'nature/rock_largeC', 'nature/rock_largeE', 'nature/rock_tallA', 'nature/rock_tallC', 'nature/rock_tallE', 'nature/rock_tallG',
  'nature/cliff_large_rock', 'nature/cliff_block_rock', 'nature/plant_bush', 'nature/plant_bushLarge', 'nature/tent_detailedClosed', 'nature/campfire_logs', 'nature/canoe', 'nature/sign',
  // hiver (Holiday Kit)
  'holiday/tree-snow-a', 'holiday/tree-snow-b', 'holiday/tree-snow-c', 'holiday/reindeer', 'holiday/sled', 'holiday/snowman', 'holiday/snow-pile', 'holiday/rocks-large', 'holiday/lantern',
  // survie, ville, usine, lac, trains
  'survival/tool-axe', 'survival/tool-pickaxe', 'survival/tent', 'survival/campfire-pit', 'survival/barrel', 'survival/box-large', 'survival/chest', 'survival/fence-fortified',
  'survival/resource-wood', 'survival/workbench', 'survival/workbench-anvil', 'survival/structure-metal', 'survival/signpost', 'survival/bedroll',
  'industrial/building-a', 'industrial/building-c', 'industrial/building-f', 'industrial/building-k', 'industrial/building-p', 'industrial/chimney-large',
  'industrial/detail-tank-large', 'industrial/detail-tank', 'industrial/shipping-container-a', 'industrial/shipping-container-b', 'industrial/water-tower',
  'commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d', 'commercial/building-e', 'commercial/building-skyscraper-a', 'commercial/building-skyscraper-b',
  'commercial/low-detail-building-a', 'commercial/low-detail-building-b', 'commercial/low-detail-building-c', 'commercial/low-detail-building-d',
  'pirate/boat-row-large', 'pirate/boat-row-small', 'pirate/ship-wreck', 'pirate/ship-small', 'pirate/structure-platform-dock-small', 'pirate/tower-watch', 'pirate/barrel', 'pirate/crate',
  'train/train-carriage-coal', 'train/train-carriage-box', 'train/train-carriage-tank', 'train/train-carriage-lumber', 'train/train-carriage-flatbed', 'train/train-locomotive-b',
  'fantasy/cart',
];
// Givre plus ou moins marqué selon le pack (les modèles d'hiver sont déjà enneigés)
const FROST = { holiday: 0.25, commercial: 0.7, industrial: 0.7, pirate: 0.85, survival: 0.8, train: 0.75, fantasy: 0.85 };

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

// Vent dans les sapins : le haut des arbres ondule (plus fort dans les bourrasques). uT : temps, uWind : 0 → 1
export const SWAY = { uT: { value: 0 }, uWind: { value: 0.3 } };
function swayed(m) {
  const prev = m.onBeforeCompile, key = m.customProgramCacheKey();
  m.onBeforeCompile = (sh, r) => {
    prev.call(m, sh, r);
    Object.assign(sh.uniforms, SWAY);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uT; uniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
            vec2 ph = instanceMatrix[3].xz;
          #else
            vec2 ph = modelMatrix[3].xz;
          #endif
          float k = max(0.0, transformed.y - 0.25); k = k * k * (0.02 + uWind * 0.05);
          transformed.x += sin(uT * 1.6 + ph.x * 0.31 + ph.y * 0.17) * k;
          transformed.z += cos(uT * 1.3 + ph.x * 0.23 - ph.y * 0.29) * k * 0.7;
        }`);
  };
  m.customProgramCacheKey = () => key + '|sway';
  return m;
}

// Charge tous les modèles ; renvoie { make(), proto(), size(), has(), dispose() }
export async function loadKit(base) {
  const loader = new GLTFLoader();
  const kit = new Map();
  await Promise.all(MODEL_LIST.map(async (name) => {
    try {
      const g = await loader.loadAsync(`${base}${name}.glb`);
      const root = g.scene;
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      kit.set(name, { root, box, size: box.getSize(new THREE.Vector3()) });
    } catch (e) { console.warn('modèle manquant', name, e); }
  }));
  // matériaux : une version givrée (décor) et une version propre (ville d'arrivée), partagées entre clones
  const frosted = new Map(), clean = new Map(), windy = new Map();
  const matOf = (src, cleanLook, name, sway = false) => {
    const cache = cleanLook ? clean : sway ? windy : frosted;
    if (!cache.has(src)) {
      const m = cleanLook ? frost(src, 0.25, [0.95, 0.97, 1]) : frost(src, FROST[name.split('/')[0]] ?? 1);
      cache.set(src, sway ? swayed(m) : m);
    }
    return cache.get(src);
  };
  const protos = new Map();
  return {
    has: (name) => kit.has(name),
    size: (name) => kit.get(name)?.size,
    // copie du modèle, ajustée à une boîte w × h × d (ou à l'échelle uniforme s), base posée à y = 0, centrée en x et z
    make(name, w, h, d, { cleanLook = false, uniform = false, s = 0 } = {}) {
      const k = kit.get(name); if (!k) return null;
      const o = k.root.clone(true);
      o.traverse((c) => { if (c.isMesh) { c.material = matOf(Array.isArray(c.material) ? c.material[0] : c.material, cleanLook, name); c.castShadow = true; c.receiveShadow = true; } });
      const sx = s || w / k.size.x, sy = s || h / k.size.y, sz = s || d / k.size.z;
      const u = s || (uniform ? Math.min(sx, sz) : 0);
      const g = new THREE.Group();
      o.scale.set(u || sx, u || sy, u || sz);
      const c = k.box.getCenter(new THREE.Vector3());
      o.position.set(-c.x * o.scale.x, -k.box.min.y * o.scale.y, -c.z * o.scale.z);
      g.add(o);
      return g;
    },
    // pièces du modèle pour l'affichage instancié : géométrie, matériau givré, matrice (base à y = 0, centrée, taille d'origine)
    proto(name) {
      if (protos.has(name)) return protos.get(name);
      const k = kit.get(name); if (!k) return null;
      const c = k.box.getCenter(new THREE.Vector3());
      const T = new THREE.Matrix4().makeTranslation(-c.x, -k.box.min.y, -c.z);
      const parts = [];
      const sw = /tree/.test(name); // les sapins du décor ondulent au vent
      k.root.traverse((m) => { if (m.isMesh) parts.push({ geo: m.geometry, mat: matOf(Array.isArray(m.material) ? m.material[0] : m.material, false, name, sw), base: T.clone().multiply(m.matrixWorld) }); });
      const p = { parts, size: k.size };
      protos.set(name, p);
      return p;
    },
    dispose() {
      for (const m of [...frosted.values(), ...clean.values(), ...windy.values()]) m.dispose();
      for (const k of kit.values()) k.root.traverse((c) => { if (c.isMesh) { c.geometry.dispose(); const ms = Array.isArray(c.material) ? c.material : [c.material]; for (const m of ms) { m.map?.dispose(); m.dispose(); } } });
    },
  };
}
