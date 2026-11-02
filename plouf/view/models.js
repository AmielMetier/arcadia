// Plouf ! — les modèles 3D (plouf/models/, voir LICENSE.txt) : chargés une fois, ramenés à une taille connue
// (pieds à l'origine), puis copiés pour chaque usage. Le baigneur animé (Quaternius) garde son squelette et ses clips.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

// fichier → taille cible : h (hauteur) ou w (largeur, pour ce qui est posé à plat)
const FILES = {
  baigneur: { h: 1.85 }, bouee: { w: 0.9 }, tonneau: { h: 0.95 }, caisse: { h: 0.55 },
  palmier: { h: 5.2 }, parasol: { h: 2.3 }, canot: { w: 2.4 }, matelas: { w: 1.1 }, barque: { w: 2.2 }, voilier: { h: 7.5 }, tour: { h: 4.2 },
};

const loader = new GLTFLoader();
const load = (url) => new Promise((res, rej) => loader.load(url, res, undefined, rej));

// boîte englobante d'un modèle (pour une peau : la pose de repos, à partir des géométries)
function bounds(root) {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3(), b = new THREE.Box3();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    b.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); // pour une peau : la pose de repos, dans le repère du modèle
    box.union(b);
  });
  return box;
}

// charge tout : { name: { scene, clips, box } } ; un modèle qui manque est simplement absent (le jeu dessine un remplaçant)
export async function loadModels(base = 'models/') {
  const out = {};
  await Promise.all(Object.entries(FILES).map(async ([name, fit]) => {
    try {
      const g = await load(base + name + '.glb');
      const scene = g.scene;
      scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = name !== 'baigneur'; o.frustumCulled = true; } });
      const box = bounds(scene), size = box.getSize(new THREE.Vector3());
      const k = fit.h ? fit.h / size.y : fit.w / Math.max(size.x, size.z);
      // enveloppe : mise à l'échelle et pieds posés à l'origine
      const wrap = new THREE.Group();
      wrap.add(scene);
      scene.scale.setScalar(k);
      scene.position.set(-(box.min.x + box.max.x) / 2 * k, -box.min.y * k, -(box.min.z + box.max.z) / 2 * k);
      out[name] = { scene: wrap, clips: g.animations || [], size: size.multiplyScalar(k) };
    } catch (e) { console.warn('modèle absent : ' + name, e); }
  }));
  return out;
}

// copie d'un modèle avec peau : les os clonés sont reliés à la copie (sinon elle suivrait l'original)
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

// copie simple (décor, objets) : géométries partagées, matériaux partagés
export function cloneStatic(src) { return src.clone(true); }

// un modèle dont on veut beaucoup d'exemplaires (tonneaux) : ses parties, pour des InstancedMesh
export function parts(src) {
  const list = [];
  src.updateMatrixWorld(true);
  src.traverse((o) => { if (o.isMesh) list.push({ geometry: o.geometry, material: o.material, matrix: o.matrixWorld.clone() }); });
  return list;
}
