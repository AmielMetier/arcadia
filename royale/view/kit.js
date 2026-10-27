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
// personnages au choix (models/toon/) : la tenue prend la couleur du joueur (drapeau 1)
export const CHARACTERS = {
  soldat: { label: 'Soldat', file: 'soldat', tint: SOLDIER_TINT },
  hazmat: { label: 'Combinaison', file: 'hazmat', tint: { Hazmat_Main: 1, Skin: 3 } },
  ennemi: { label: 'Mercenaire', file: 'ennemi', tint: { Enemy_Red: 1, Skin: 3 } },
};
const WEAPON_TINT = { Grey: 4 };
// armes du jeu → nœud du kit dans la main du soldat
export const WEAPON_NODES = { fusil: 'AK', pompe: 'Shotgun', pistolet: 'Pistol', smg: 'SMG', sniper: 'Sniper_2', roquette: 'RocketLauncher' };
export const PROP_FILES = ['caisse', 'baril', 'bonbonne', 'benne', 'poubelle', 'cone', 'barriere', 'barriere-grande', 'sacs', 'sacs-petit', 'pneus', 'citerne-eau', 'reservoir',
  'lampadaire', 'conteneur', 'epave', 'grillage', 'grillage-long', 'palette', 'palette-cassee', 'cartons', 'cartons-pile', 'gravats', 'tuyaux', 'jerrican', 'planches', 'caisson', 'panneau'];
const ITEM_FILES = { grenade: 'grenade', souffle: 'grenade-feu', soin: 'soin' };
// armes détaillées (« Ultimate Gun Pack » de Quaternius, models/armes/) : un modèle pour les raretés commune et peu
// commune, un plus moderne pour rare et épique ; posées canon vers +z, haut +y, longueur 1 (le lance-roquettes reste
// celui du kit)
export const GUNS = ['fusil', 'pompe', 'pistolet', 'smg', 'sniper'];
// détente de chaque modèle [ordinaire, rare] dans ce repère (z, y) : la main se cale juste derrière ; longueur relative
// au fusil d'assaut du kit
export const GUN_FIT = {
  fusil: { trig: [[-0.305, 0.005], [-0.125, 0.02]], len: 1.05 }, pompe: { trig: [[-0.15, -0.01], [-0.22, -0.01]], len: 1.08 },
  pistolet: { trig: [[-0.0625, 0.05], [-0.075, 0.03]], len: 0.38 }, smg: { trig: [[0.042, 0.0225], [-0.0625, 0.005]], len: 0.72 },
  sniper: { trig: [[-0.2, -0.015], [-0.155, -0.015]], len: 1.25 },
};
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

// mains deux fois plus petites que celles du kit : la peau des mains (paume et doigts) se resserre vers le poignet, et
// les articulations des doigts avec elle (les animations ne font que les tourner)
const HAND_SCALE = 0.5;
function shrinkHands(geo, skel, bind, bindInv, k) {
  const P = geo.attributes.position, J = geo.attributes.skinIndex, Wt = geo.attributes.skinWeight, F = geo.attributes.aTint;
  const idx = (n) => skel.bones.findIndex((b) => b.name.replace(/\./g, '') === n);
  const bindPos = (i) => new THREE.Vector3().setFromMatrixPosition(skel.boneInverses[i].clone().invert());
  const v = new THREE.Vector3(), T = new THREE.Matrix4(), m3 = new THREE.Matrix3();
  for (const s of ['R', 'L']) {
    const la = idx('LowerArm' + s), ix = idx('Index1' + s), mid = idx('Middle1' + s);
    if (la < 0 || ix < 0 || mid < 0) continue;
    const fingers = new Set();
    skel.bones.forEach((b, i) => { const n = b.name.replace(/\./g, ''); if (/^(Pinky|Middle|Index|Thumb)\d/.test(n) && n.endsWith(s)) fingers.add(i); });
    const elbow = bindPos(la), len = bindPos(mid).distanceTo(elbow), ax = bindPos(mid).sub(elbow).normalize();
    // la main : sa peau ; sans peau (gants), ce qui suit les doigts et le bout de l'avant-bras après le poignet
    const collect = (bySkin) => {
      const out = [];
      for (let i = 0; i < P.count; i++) {
        if (bySkin && Math.round(F.getX(i)) !== SOLDIER_TINT.Skin) continue;
        let best = -1, bw = -1;
        for (let c = 0; c < 4; c++) { const w = Wt.getComponent(i, c); if (w > bw) { bw = w; best = J.getComponent(i, c); } }
        if (best !== la && !fingers.has(best)) continue;
        v.fromBufferAttribute(P, i).applyMatrix4(bind);
        const t = v.clone().sub(elbow).dot(ax);
        if (!bySkin && best === la && t < len * 0.8) continue;
        out.push([i, v.clone(), t]);
      }
      return out;
    };
    let list = collect(true);
    if (list.length < 40) list = collect(false);
    if (!list.length) continue;
    // poignet : le centre de l'anneau de peau le plus proche du coude
    let t0 = Infinity, t1 = -Infinity;
    for (const e of list) { t0 = Math.min(t0, e[2]); t1 = Math.max(t1, e[2]); }
    const ring = list.filter((e) => e[2] < t0 + (t1 - t0) * 0.15);
    const pivot = ring.reduce((a, e) => a.add(e[1]), new THREE.Vector3()).multiplyScalar(1 / ring.length);
    for (const [i, p] of list) { p.sub(pivot).multiplyScalar(k).add(pivot).applyMatrix4(bindInv); P.setXYZ(i, p.x, p.y, p.z); }
    // articulations : des premières phalanges aux bouts des doigts
    const depth = (i) => { let d = 0; for (let b = skel.bones[i].parent; b && fingers.has(skel.bones.indexOf(b)); b = b.parent) d++; return d; };
    // (déplacement dans le repère du parent, tiré des matrices de bind : la pose du fichier n'est pas forcément celle-là)
    const moved = new Map();
    for (const i of [...fingers].sort((a, b) => depth(a) - depth(b))) {
      const bone = skel.bones[i], pi = skel.bones.indexOf(bone.parent), p = bindPos(i);
      const d = p.clone().sub(pivot).multiplyScalar(k).add(pivot).sub(p);
      moved.set(i, d);
      bone.position.add(d.clone().sub(moved.get(pi) || v.set(0, 0, 0)).applyMatrix3(m3.setFromMatrix4(skel.boneInverses[pi])));
      skel.boneInverses[i].multiply(T.makeTranslation(-d.x, -d.y, -d.z));
    }
  }
  P.needsUpdate = true; geo.computeBoundingBox(); geo.computeBoundingSphere();
}

export async function loadKit(base) {
  const loader = new GLTFLoader(), url = (f) => `${base}toon/${f}.glb`;
  const kit = { soldier: null, weapons: {}, guns: {}, items: {}, props: {}, city: {}, cars: {} };
  // ---------------------------------------------------------------- les personnages (même squelette, mêmes
  // animations) ; les armes viennent de la main du soldat
  const character = async (file, tint, withWeapons) => {
    const gl = await loader.loadAsync(url(file));
    const scene = gl.scene;
    scene.updateMatrixWorld(true);
    let body = null;
    scene.traverse((o) => { if (o.isSkinnedMesh && !body) body = o; });
    const skel = body.skeleton, bindInv = body.bindMatrix.clone().invert();
    const boneIndex = (name) => skel.bones.findIndex((b) => b.name === name);
    const parts = [];
    scene.traverse((o) => { if (o.isSkinnedMesh) parts.push(bakePart(o, new THREE.Matrix4(), tint, { skin: true })); });
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
      parts.push(bakePart(o, M, tint, { skin: true, bone: bi }));
    }
    const geo = merge(parts);
    // armes : géométrie dans le repère de la main (pour la tenir) et dans le leur (pour le sol et les icônes)
    const handInv = hand.matrixWorld.clone().invert();
    if (withWeapons) for (const [w, node] of Object.entries({ ...WEAPON_NODES, pioche: 'Shovel' })) {
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
    // mains réduites (après les armes : celles-ci, accrochées à l'index, suivent la main)
    shrinkHands(geo, skel, body.bindMatrix, bindInv, HAND_SCALE);
    // le modèle animé garde la structure du fichier : son premier maillage reçoit la géométrie fusionnée, les
    // autres parties et les objets posés sur les os disparaissent (leur forme est dans la géométrie fusionnée)
    for (const o of rigid) if (o.parent) o.parent.remove(o);
    const extra = []; scene.traverse((o) => { if (o.isSkinnedMesh && o !== body) extra.push(o); });
    for (const o of extra) o.parent.remove(o);
    body.geometry = geo; body.material = tintMaterial(); body.name = 'Corps';
    // taille : on la ramènera à 1,8 m debout
    const box = new THREE.Box3().setFromBufferAttribute(geo.attributes.position).applyMatrix4(body.bindMatrix);
    return { tmpl: scene, clips: gl.animations, height: box.max.y - box.min.y, minY: box.min.y, box };
  };
  try {
    kit.soldier = await character('soldat', SOLDIER_TINT, true);
    // l'outil de récolte : la pelle du kit
    kit.tool = kit.weapons.pioche || null;
    delete kit.weapons.pioche;
    kit.chars = { soldat: kit.soldier };
    await Promise.all(Object.entries(CHARACTERS).filter(([k]) => k !== 'soldat').map(async ([k, C]) => {
      try { kit.chars[k] = await character(C.file, C.tint, false); } catch (e) { console.warn('personnage indisponible', k, e); }
    }));
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
  // arme détaillée : la partie la plus grande qui n'est ni du bois, ni du noir, ni du verre prend la couleur de rareté
  const gun = async (f) => {
    const gl = await loader.loadAsync(`${base}armes/${f}.glb`);
    gl.scene.updateMatrixWorld(true);
    const meshes = [], area = new Map();
    gl.scene.traverse((o) => { if (o.isMesh) meshes.push(o); });
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    for (const o of meshes) {
      const P = o.geometry.attributes.position, name = baseName((Array.isArray(o.material) ? o.material[0] : o.material).name);
      let s = 0;
      for (let i = 0; i + 2 < P.count; i += 3) { a.fromBufferAttribute(P, i); b.fromBufferAttribute(P, i + 1).sub(a); c.fromBufferAttribute(P, i + 2).sub(a); s += b.cross(c).length() / 2; }
      area.set(name, (area.get(name) || 0) + s);
    }
    const body = [...area].filter(([n]) => !/wood|black|glass/i.test(n)).sort((x, y) => y[1] - x[1])[0];
    const flags = body ? { [body[0]]: 4 } : {};
    // un peu plus épaisses que nature, comme les gros gants des personnages
    return merge(meshes.map((o) => bakePart(o, o.matrixWorld, flags))).scale(1.35, 1.35, 1);
  };
  await Promise.all([
    ...GUNS.map(async (w) => { try { kit.guns[w] = await Promise.all([gun(w + '-1'), gun(w + '-2')]); } catch (e) { console.warn('arme détaillée indisponible', w, e); } }),
    ...Object.entries(ITEM_FILES).map(async ([k, f]) => { try { kit.items[k] = await solo(f); } catch (e) { console.warn('objet du kit indisponible', f, e); } }),
    ...PROP_FILES.map(async (f) => { try { kit.props[f] = await solo(f); } catch (e) { console.warn('décor du kit indisponible', f, e); } }),
    ...CITY_FILES.map(async (f) => { try { kit.city[f] = await solo('../city/' + f); } catch (e) { console.warn('mobilier urbain indisponible', f, e); } }),
    ...CARS.map(async (f) => { try { kit.cars[f] = await car(f); } catch (e) { console.warn('voiture indisponible', f, e); } }),
  ]);
  return kit;
}
