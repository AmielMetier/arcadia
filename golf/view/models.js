// Birdie Party — petits modèles du décor (Kenney Nature Kit, licence CC0 : kenney.nl).
// Les modèles d'origine sont « unlit » avec une herbe turquoise : on remplace leurs matériaux par les nôtres
// (couleurs du parcours, éclairage normal) et on les dessine en instances pour en semer des centaines.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

export const NATURE = [
  'plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall',
  'rock_largeA', 'rock_largeC', 'rock_smallA', 'rock_smallC', 'stump_round', 'log', 'mushroom_red', 'mushroom_tanGroup',
  'lily_large', 'lily_small',
];

// nom du matériau Kenney → couleur du jeu
const RECOLOR = {
  grass: 0x58b23a, leafsGreen: 0x3f9e3a, woodBark: 0x8a5a36, woodBarkDark: 0x6b4428, dirt: 0x9c968c, stone: 0xb3b0aa,
  colorRed: 0xff4d5e, colorPurple: 0xb07bff, colorYellow: 0xffd23f, colorWhite: 0xfff8ee, colorBlue: 0x58a8ff,
};

export async function loadNature(base) {
  const loader = new GLTFLoader();
  const mats = new Map();
  const matFor = (src) => {
    const key = src.name || src.uuid;
    if (!mats.has(key)) {
      const c = RECOLOR[src.name] != null ? new THREE.Color(RECOLOR[src.name]) : src.color.clone();
      mats.set(key, new THREE.MeshStandardMaterial({ color: c, map: src.map || null, roughness: 0.88, metalness: 0, vertexColors: !!src.vertexColors }));
    }
    return mats.get(key);
  };
  const kit = new Map();
  await Promise.all(NATURE.map(async (name) => {
    try {
      const g = await loader.loadAsync(`${base}${name}.glb`);
      g.scene.updateMatrixWorld(true);
      // on aplatit le modèle en morceaux (géométrie dans le repère du modèle, matériau)
      const parts = [];
      g.scene.traverse((o) => {
        if (!o.isMesh) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        const geo = o.geometry.clone().applyMatrix4(o.matrixWorld);
        if (ms.length === 1) parts.push({ geo, mat: matFor(ms[0]) });
        else for (const gr of o.geometry.groups) {
          const sub = geo.clone(); sub.clearGroups();
          const ix = geo.index.array.slice(gr.start, gr.start + gr.count);
          sub.setIndex(new THREE.BufferAttribute(ix, 1));
          parts.push({ geo: sub, mat: matFor(ms[gr.materialIndex]) });
        }
      });
      const box = new THREE.Box3(); for (const p of parts) { p.geo.computeBoundingBox(); box.union(p.geo.boundingBox); }
      kit.set(name, { parts, size: box.getSize(new THREE.Vector3()) });
    } catch (e) { console.warn('modèle manquant', name, e); }
  }));
  return {
    has: (n) => kit.has(n),
    size: (n) => kit.get(n)?.size,
    // instances d'un modèle : items = [{ x, y, z, s, rot }], s = échelle
    instanced(name, items) {
      const k = kit.get(name); if (!k || !items.length) return null;
      const g = new THREE.Group();
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
      for (const part of k.parts) {
        const im = new THREE.InstancedMesh(part.geo, part.mat, items.length);
        items.forEach((it, i) => { q.setFromAxisAngle(up, it.rot || 0); p.set(it.x, it.y, it.z); sc.setScalar(it.s || 1); m.compose(p, q, sc); im.setMatrixAt(i, m); });
        im.castShadow = items.length < 400; im.receiveShadow = true;
        im.computeBoundingSphere();
        im.userData.shared = true; // géométrie et matériau appartiennent au kit
        g.add(im);
      }
      return g;
    },
    dispose() { for (const k of kit.values()) for (const p of k.parts) p.geo.dispose(); for (const m of mats.values()) m.dispose(); },
  };
}
