// Les avions de Dogfight 3D : F-16 et F-22 chargés une fois, clonés par joueur, avec un modèle très simple au loin,
// reflets du ciel, flamme de postcombustion, éclair du canon et couleur d'escadron.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

// fins et tips : sommet des dérives et bouts d'ailes, relevés sur les modèles
const FILES = {
  f16: { url: 'f-16.glb', len: 15.09, fins: [[0, 2.47, -6.9]], tip: [4.66, -0.66, -2.4], nozzles: [[0, 0.1, -7.2]] },
  f22: { url: 'f-22.glb', len: 18.99, fins: [[2.93, 1.93, -5.55], [-2.93, 1.93, -5.55]], tip: [6.7, -1.18, -3.7], nozzles: [[0.8, -0.1, -8.6], [-0.8, -0.1, -8.6]] },
};
const FAR_LOD = 480;   // au-delà : modèle simple
const templates = {};

// Les deux modèles viennent de Sketchfab : axe du nez sur +X, envergure sur Z. Une rotation de -90° autour de Y met le nez sur +Z.
function prepare(gltf, def, env) {
  const r = gltf.scene, box = new THREE.Box3().setFromObject(r), c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
  r.traverse((o) => {
    if (o.name && o.name.includes('landingOn')) o.visible = false;
    if (o.isMesh && o.material) {
      o.material.envMap = env; o.material.envMapIntensity = 1.15;
      if (o.material.name === 'Glass') { o.material.transparent = true; o.material.opacity = 0.55; o.material.roughness = 0.05; o.material.metalness = 0.9; }
      else { o.material.roughness = Math.max(0.42, o.material.roughness ?? 0.5); o.material.metalness = Math.min(0.45, o.material.metalness ?? 0.3); }
    }
  });
  const pivot = new THREE.Group(), s = def.len / sz.x;
  r.rotation.y = -Math.PI / 2; r.scale.setScalar(s); r.position.set(c.z * s, -c.y * s, -c.x * s);
  pivot.add(r);
  return pivot;
}

export function loadPlanes(env, onProgress) {
  const loader = new GLTFLoader();
  return Promise.all(Object.entries(FILES).map(([type, def]) => new Promise((resolve) => {
    loader.load(def.url, (gltf) => { templates[type] = prepare(gltf, def, env); if (onProgress) onProgress(type); resolve(); }, undefined, (err) => { console.warn(`Modèle ${def.url} indisponible, modèle simple utilisé :`, err); resolve(); });
  })));
}

// Le modèle simple : quelques triangles, partagés entre tous les avions lointains
let farGeo = null, farMat = null;
function farModel() {
  if (!farGeo) {
    const body = new THREE.ConeGeometry(0.8, 15, 5); body.rotateX(Math.PI / 2);
    const wings = new THREE.BufferGeometry();
    wings.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 2, 5, 0, -3, -5, 0, -3, 0, 0, 2, -5, 0, -3, 5, 0, -3, 0, 0, -3, 0, 3, -7, 0, 0, -7, 0, 0, -3, 0, 0, -7, 0, 3, -7], 3));
    wings.setAttribute('normal', new THREE.Float32BufferAttribute(Array(36).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    const merged = new THREE.BufferGeometry(), a = body.toNonIndexed(), n = a.attributes.position.count + 12, pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    pos.set(a.attributes.position.array); nor.set(a.attributes.normal.array); pos.set(wings.attributes.position.array, a.attributes.position.count * 3); nor.set(wings.attributes.normal.array, a.attributes.position.count * 3);
    merged.setAttribute('position', new THREE.BufferAttribute(pos, 3)); merged.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    farGeo = merged; farMat = new THREE.MeshLambertMaterial({ color: 0x6f7a84, side: THREE.DoubleSide });
  }
  return new THREE.Mesh(farGeo, farMat);
}

const flameGeoA = (() => { const g = new THREE.ConeGeometry(0.34, 2.1, 14); g.rotateX(-Math.PI / 2); g.translate(0, 0, -1.05); return g; })();
const flameGeoB = (() => { const g = new THREE.ConeGeometry(0.46, 3.3, 14); g.rotateX(-Math.PI / 2); g.translate(0, 0, -1.65); return g; })();
const flameA = new THREE.MeshBasicMaterial({ color: 0xfff0ea, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const flameB = new THREE.MeshBasicMaterial({ color: 0xff8f86, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const flashGeo = new THREE.SphereGeometry(0.28, 6, 6);
const flashMat = new THREE.MeshBasicMaterial({ color: 0xffea70, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
const finGeo = new THREE.BoxGeometry(0.1, 0.2, 1);
const tipGeo = new THREE.BoxGeometry(0.13, 0.08, 1.15);

export function buildPlane(type, color) {
  const def = FILES[type] || FILES.f16, tpl = templates[type] || templates.f16;
  const root = new THREE.Group(), lod = new THREE.LOD();
  root.add(lod);
  const near = new THREE.Group();
  if (tpl) near.add(tpl.clone(true));
  else near.add(farModel());
  lod.addLevel(near, 0);
  lod.addLevel(farModel(), FAR_LOD);

  // couleur d'escadron : haut de dérive et bouts d'ailes
  const accent = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.4, metalness: 0.2, emissive: new THREE.Color(color), emissiveIntensity: 0.25 });
  for (const f of def.fins) { const fin = new THREE.Mesh(finGeo, accent); fin.position.set(f[0], f[1], f[2]); near.add(fin); }
  for (const s of [-1, 1]) { const tip = new THREE.Mesh(tipGeo, accent); tip.position.set(s * def.tip[0], def.tip[1], def.tip[2]); near.add(tip); }

  const flames = def.nozzles.map((n) => {
    const flame = new THREE.Group(); flame.position.set(n[0], n[1], n[2]); flame.visible = false;
    flame.add(new THREE.Mesh(flameGeoA, flameA), new THREE.Mesh(flameGeoB, flameB));
    root.add(flame);
    return flame;
  });
  const flash = new THREE.Mesh(flashGeo, flashMat); flash.position.set(-0.46, 0.1, 3.6); flash.visible = false; root.add(flash);

  let flashT = 0;
  return {
    root, type,
    setBoost(on) { for (const f of flames) { f.visible = on; if (on) f.scale.z = 0.85 + Math.random() * 0.3; } },
    setFiring(on, dt) { if (on) flashT = 0.03; else if (flashT > 0) flashT -= dt; flash.visible = flashT > 0; },
    dispose() { accent.dispose(); },
  };
}

// Environnement pour les reflets : le ciel, une fois pour toutes
export function makeEnvironment(renderer, skyMesh) {
  const pm = new THREE.PMREMGenerator(renderer), s = new THREE.Scene(), copy = new THREE.Mesh(skyMesh.geometry, skyMesh.material);
  s.add(copy);
  const rt = pm.fromScene(s, 0, 1, 7000);
  pm.dispose();
  return rt.texture;
}
