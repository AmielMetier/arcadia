// Les modèles du « Toon Shooter Game Kit » (Quaternius, CC0, models/toon/) : le soldat animé et les armes qu'il porte
// dans sa main droite, les grenades et la trousse de soin, et le décor (caisses, barils, bennes, lampadaires…).
// Chaque modèle est réduit à un seul maillage dont les couleurs sont cuites dans les sommets (un seul appel de dessin),
// avec un drapeau par sommet pour les parties qu'on recolore : l'uniforme, le pantalon et la peau du joueur, le corps
// des armes à la couleur de leur rareté. Le soldat garde son squelette et ses 14 animations ; sa tête et ses
// épaulettes, d'abord posées sur les os, sont collées au maillage animé.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';

// parties recolorées (nom de matériau du kit → drapeau)
const SOLDIER_TINT = { Character_Main: 1, Pants: 2, Skin: 3 };
const WEAPON_TINT = { Grey: 4 };
// armes du jeu → nœud du kit dans la main du soldat
export const WEAPON_NODES = { fusil: 'AK', pompe: 'Shotgun', pistolet: 'Pistol', smg: 'SMG', sniper: 'Sniper_2', roquette: 'RocketLauncher' };
export const PROP_FILES = ['caisse', 'baril', 'bonbonne', 'benne', 'poubelle', 'cone', 'barriere', 'barriere-grande', 'sacs', 'sacs-petit', 'pneus', 'citerne-eau', 'reservoir',
  'lampadaire', 'conteneur', 'epave', 'grillage', 'grillage-long', 'palette', 'palette-cassee', 'cartons', 'cartons-pile', 'gravats', 'tuyaux', 'jerrican', 'planches', 'caisson', 'panneau'];
const ITEM_FILES = { grenade: 'grenade', souffle: 'grenade-feu', soin: 'soin' };
// « City Pack » (models/city/) : voitures (la carrosserie prend la couleur de chaque voiture) et mobilier urbain
export const CARS = ['voiture-a', 'voiture-b', 'voiture-sport', 'voiture-suv', 'voiture-police'];
export const CITY_FILES = ['banc', 'bouche', 'poubelle-rue', 'boite-lettres', 'abribus', 'pot-arbuste', 'pot-plante', 'jardiniere', 'armoire-elec', 'corde-linge', 'sac-poubelle', 'plaque'];
const BODY = { Blue: 1, LightBlue: 1, White: 1 };

const baseName = (n) => String(n || '').replace(/\.\d+$/, '');

// une partie de maillage → géométrie aux attributs communs (position, normale, couleur, drapeau ; os si animé)
function bakePart(mesh, matrix, flags, { skin = null, bone = -1 } = {}) {
  const src = mesh.geometry, g = new THREE.BufferGeometry();
  const n = src.attributes.position.count;
  g.setAttribute('position', src.attributes.position.clone());
  g.setAttribute('normal', src.attributes.normal ? src.attributes.normal.clone() : new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
  if (src.index) g.setIndex(src.index.clone());
  g.applyMatrix4(matrix);
  if (!src.attributes.normal) g.computeVertexNormals();
  const m = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  const c = m.color || new THREE.Color(1, 1, 1), col = new Float32Array(n * 3), tint = new Float32Array(n);
  const f = flags[baseName(m.name)] || 0;
  for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; tint[i] = f; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 1));
  if (skin) {
    // os : toujours en entiers 16 bits et poids en flottants (les fichiers mélangent les formats)
    const si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), A = src.attributes.skinIndex, B = src.attributes.skinWeight;
    for (let i = 0; i < n; i++) {
      if (A) { si[i * 4] = A.getX(i); si[i * 4 + 1] = A.getY(i); si[i * 4 + 2] = A.getZ(i); si[i * 4 + 3] = A.getW(i); sw[i * 4] = B.getX(i); sw[i * 4 + 1] = B.getY(i); sw[i * 4 + 2] = B.getZ(i); sw[i * 4 + 3] = B.getW(i); }
      else { si[i * 4] = bone; sw[i * 4] = 1; }
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4));
    g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
  }
  return g;
}
const merge = (parts) => { const g = mergeGeometries(parts.map((p) => (p.index ? p.toNonIndexed() : p))); for (const p of parts) p.dispose(); g.computeBoundingBox(); g.computeBoundingSphere(); return g; };

// matériau aux couleurs des sommets ; tints : { 1: couleur, 2: …, 4: … } et force du mélange
export function tintMaterial(tints = {}, opts = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72, metalness: 0.05, ...opts });
  const U = {};
  for (let k = 1; k <= 4; k++) { const t = tints[k]; U['uT' + k] = { value: new THREE.Vector4(...(t ? [t.color.r, t.color.g, t.color.b, t.mix ?? 1] : [1, 1, 1, 0])) }; }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aTint; varying float vTint;')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvTint = aTint;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTint; uniform vec4 uT1, uT2, uT3, uT4;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        if (vTint > 0.5) { vec4 t = vTint < 1.5 ? uT1 : vTint < 2.5 ? uT2 : vTint < 3.5 ? uT3 : uT4; diffuseColor.rgb = mix(diffuseColor.rgb, t.rgb, t.a); }`);
  };
  m.customProgramCacheKey = () => 'royale-kit-tint';
  m.userData.tints = U;
  return m;
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

export async function loadKit(base) {
  const loader = new GLTFLoader(), url = (f) => `${base}toon/${f}.glb`;
  const kit = { soldier: null, weapons: {}, items: {}, props: {}, city: {}, cars: {} };
  // ---------------------------------------------------------------- le soldat et ses armes
  try {
    const gl = await loader.loadAsync(url('soldat'));
    const scene = gl.scene;
    scene.updateMatrixWorld(true);
    let body = null;
    scene.traverse((o) => { if (o.isSkinnedMesh && !body) body = o; });
    const skel = body.skeleton, bindInv = body.bindMatrix.clone().invert();
    const boneIndex = (name) => skel.bones.findIndex((b) => b.name === name);
    const parts = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) parts.push(bakePart(o, new THREE.Matrix4(), SOLDIER_TINT, { skin: true })); });
    // tête et épaulettes : posées sur un os, on les colle au maillage animé
    // (le chargeur retire les points des noms : « Index1.R » devient « Index1R »)
    const hand = skel.bones.find((b) => b.name.replace(/\./g, '') === 'Index1R');
    const rigid = [];
    scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) rigid.push(o); });
    const weaponRoots = new Set(Object.values(WEAPON_NODES).concat(['Revolver', 'Sniper', 'Revolver_Small', 'GrenadeLauncher', 'ShortCannon', 'Shovel', 'Knife_1', 'Knife_2']));
    const rootOf = (o) => { for (let p = o; p; p = p.parent) if (weaponRoots.has(p.name)) return p; return null; };
    for (const o of rigid) {
      if (rootOf(o)) continue;
      let bone = o.parent;
      while (bone && !bone.isBone) bone = bone.parent;
      if (!bone) continue;
      const bi = boneIndex(bone.name);
      // sommet → espace du maillage animé : inv(bind) · inv(boneInverse) · (position sous l'os)
      const L = bone.matrixWorld.clone().invert().multiply(o.matrixWorld);
      const M = bindInv.clone().multiply(skel.boneInverses[bi].clone().invert()).multiply(L);
      parts.push(bakePart(o, M, SOLDIER_TINT, { skin: true, bone: bi }));
    }
    const geo = merge(parts);
    // armes : géométrie dans le repère de la main (pour la tenir) et dans le leur (pour le sol et les icônes)
    const handInv = hand.matrixWorld.clone().invert();
    for (const [w, node] of Object.entries({ ...WEAPON_NODES, pioche: 'Shovel' })) {
      const W = scene.getObjectByName(node);
      if (!W) continue;
      const inHand = [], own = [];
      const wInv = W.matrixWorld.clone().invert(), ws = new THREE.Vector3(); W.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), ws);
      const S = new THREE.Matrix4().makeScale(ws.x, ws.y, ws.z);
      W.traverse((o) => {
        if (!o.isMesh) return;
        inHand.push(bakePart(o, handInv.clone().multiply(o.matrixWorld), WEAPON_TINT));
        own.push(bakePart(o, S.clone().multiply(wInv).multiply(o.matrixWorld), WEAPON_TINT));
      });
      kit.weapons[w] = { hand: merge(inHand), solo: merge(own) };
    }
    // l'outil de récolte : la pelle du kit
    kit.tool = kit.weapons.pioche || null;
    delete kit.weapons.pioche;
    // le modèle animé garde la structure du fichier : son premier maillage reçoit la géométrie fusionnée, les
    // autres parties et les objets posés sur les os disparaissent (leur forme est dans la géométrie fusionnée)
    for (const o of rigid) if (o.parent) o.parent.remove(o);
    for (const o of [...body.parent.children]) if (o.isSkinnedMesh && o !== body) o.parent.remove(o);
    body.geometry = geo; body.material = tintMaterial(); body.name = 'Corps';
    // taille : on la ramènera à 1,8 m debout
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).applyMatrix4(body.bindMatrix);
    kit.soldier = { tmpl: scene, clips: gl.animations, height: box.max.y - box.min.y, minY: box.min.y, box };
  } catch (e) { console.warn('soldat du kit indisponible', e); }
  // ---------------------------------------------------------------- objets et décor : un maillage par modèle
  const solo = async (f) => {
    const gl = await loader.loadAsync(url(f));
    gl.scene.updateMatrixWorld(true);
    const parts = [], textured = [];
    gl.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      if (m.map) textured.push({ geo: o.geometry.clone().applyMatrix4(o.matrixWorld), mat: m });
      else parts.push(bakePart(o, o.matrixWorld, WEAPON_TINT));
    });
    const geo = parts.length ? merge(parts) : null;
    const box = new THREE.Box3();
    if (geo) box.copy(geo.boundingBox);
    for (const t of textured) { t.geo.computeBoundingBox(); box.union(t.geo.boundingBox); }
    return { geo, textured, box };
  };
  // voiture : carrosserie (sommets blancs, couleur de l'instance) et le reste (vitres, roues, phares) à part
  const car = async (f) => {
    const gl = await loader.loadAsync(`${base}city/${f}.glb`);
    gl.scene.updateMatrixWorld(true);
    const body = [], rest = [];
    gl.scene.traverse((o) => {
      if (!o.isMesh) return;
      const m = Array.isArray(o.material) ? o.material[0] : o.material, isBody = BODY[baseName(m.name)];
      const g = bakePart(o, o.matrixWorld, {});
      if (isBody) { const c = g.attributes.color; for (let i = 0; i < c.count; i++) c.setXYZ(i, 1, 1, 1); body.push(g); } else rest.push(g);
    });
    return { body: body.length ? merge(body) : null, rest: merge(rest) };
  };
  await Promise.all([
    ...Object.entries(ITEM_FILES).map(async ([k, f]) => { try { kit.items[k] = await solo(f); } catch (e) { console.warn('objet du kit indisponible', f, e); } }),
    ...PROP_FILES.map(async (f) => { try { kit.props[f] = await solo(f); } catch (e) { console.warn('décor du kit indisponible', f, e); } }),
    ...CITY_FILES.map(async (f) => { try { kit.city[f] = await solo('../city/' + f); } catch (e) { console.warn('mobilier urbain indisponible', f, e); } }),
    ...CARS.map(async (f) => { try { kit.cars[f] = await car(f); } catch (e) { console.warn('voiture indisponible', f, e); } }),
  ]);
  return kit;
}
