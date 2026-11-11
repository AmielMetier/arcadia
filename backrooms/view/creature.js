// The Backrooms - Une créature venue d'un .glb quelconque (la nouvelle entité du Level 1, models/level1/)
//
// Le chargeur accepte à peu près tout ce qu'on trouve en open source : glb compressé (Draco, Meshopt), Z en haut,
// tourné dans n'importe quel sens, à n'importe quelle échelle, en matériaux métal/rugosité, avec ou sans squelette,
// avec ou sans animations. Il le remet aux normes du jeu :
// - debout sur le sol (y = 0), face à +z (le sens de marche de l'entité), à la hauteur voulue ;
// - ses os reconnus sous des noms communs (Mixamo, Quaternius, Blender/Rigify, Unreal, Bip01…) : findRig ;
// - les animations qui lui manquent reprises de l'explorateur (models/hazmat.glb, Quaternius, CC0) par retarget :
//   chaque os suit la direction de l'os correspondant, quelles que soient les poses de repos (T ou A) ;
// - des matériaux lisibles dans la pénombre du jeu (pas de métal noir sans reflet, la lueur des néons comme l'entité
//   actuelle), sans culling faussé par l'animation.
// createCreature rend le même objet que createBeast (view/beast.js) : { group, update(M, …) → pied, scareFace() },
// plus ready (promesse), info (ce qu'on a trouvé, et ce qui cloche) et show(état) pour la page d'aperçu.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';
import { DRACOLoader } from '../../shared/vendor/three/DRACOLoader.js';
import { MeshoptDecoder } from '../../shared/vendor/three/meshopt_decoder.module.js';
import { clone as cloneSkinned } from '../../shared/vendor/three/SkeletonUtils.js';

export const CREATURE_URL = new URL('../models/level1/entite.glb', import.meta.url).href;
const DONOR_URL = new URL('../models/hazmat.glb', import.meta.url).href;
const BANG_HIT = 0.56; // s : l'impact dans le clip « bang » d'entite.glb (models/level1/LISEZMOI.txt)
const UNMASK_T = 1; // s : la transformation (UNMASK_T du moteur, engine/sim.js)
export const STATES = ['idle', 'walk', 'run', 'rush', 'grab', 'stun', 'bang', 'unmask', 'drop', 'scare'];
const LIMITS = { tris: 150000, bytes: 15e6, tex: 2048, bones: 120 };

// ---------------------------------------------------------------- chargement
let loader = null;
function gltfLoader() {
  if (loader) return loader;
  loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath(new URL('../../shared/vendor/three/draco/', import.meta.url).href);
  loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}
const cache = new Map();
// url ou ArrayBuffer (un fichier glissé sur la page d'aperçu) ; rend { gltf, bytes }
export function loadGltf(src) {
  if (typeof src !== 'string') return gltfLoader().parseAsync(src, '').then((gltf) => ({ gltf, bytes: src.byteLength }));
  if (!cache.has(src)) {
    cache.set(src, fetch(src).then((r) => {
      if (!r.ok) throw new Error(`${r.status} : ${src.split('/').pop()} introuvable`);
      return r.arrayBuffer();
    }).then((buf) => gltfLoader().parseAsync(buf, src.slice(0, src.lastIndexOf('/') + 1)).then((gltf) => ({ gltf, bytes: buf.byteLength }))));
  }
  return cache.get(src);
}

// ---------------------------------------------------------------- les os, sous des noms communs
// un nom d'os découpé en mots : « mixamorig:LeftUpLeg » → ['left', 'up', 'leg'] ; « UpperArm.L » → ['upper', 'arm', 'l']
function words(name) {
  return name
    .replace(/^.*[:|]/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}
function sideOf(w) {
  if (w.some((x) => x === 'left' || x === 'l' || x === 'lft')) return 'L';
  if (w.some((x) => x === 'right' || x === 'r' || x === 'rgt')) return 'R';
  return '';
}
const NOISE = new Set(['left', 'right', 'l', 'r', 'lft', 'rgt', 'mixamorig', 'bip', 'bip01', 'bone', 'def', 'org', 'mch', 'jnt', 'joint', 'b', 'c', 'cc', 'base', 'armature', 'rig', 'character']);
// os canonique → motifs (sur les mots sans côté, réunis par une espace) ; le premier qui trouve gagne
const PATTERNS = [
  ['hips', [/^(hips?|pelvis|hip)$/, /^(hips?|pelvis)/, /^root hips?$/]],
  ['spine', [/^(spine|abdomen|spine ?0?1|spine1|lower spine|waist)$/]],
  ['chest', [/^(chest|torso|upper chest|spine ?0?2|spine2|upper spine|spine ?0?3|spine3|ribcage)$/]],
  ['neck', [/^neck( ?0?1)?$/, /^neck/]],
  ['head', [/^head$/, /^head(?! ?(top|end|nub|tip))/]],
  ['shoulder', [/^(shoulder|clavicle|collar ?bone|collar)$/]],
  ['upperArm', [/^(upper ?arm|up ?arm|arm|humerus|upperarm)$/, /^upper ?arm/]],
  ['lowerArm', [/^(fore ?arm|lower ?arm|lo ?arm|elbow|forearm)$/, /^(fore|lower) ?arm/]],
  ['hand', [/^(hand|wrist)$/]],
  ['upperLeg', [/^(up ?leg|upper ?leg|thigh|femur|upleg)$/, /^(upper ?leg|thigh)/]],
  ['lowerLeg', [/^(leg|lower ?leg|calf|shin|knee|lo ?leg)$/, /^(lower ?leg|calf|shin)/]],
  ['foot', [/^(foot|ankle)$/]],
];
const SIDED = new Set(['shoulder', 'upperArm', 'lowerArm', 'hand', 'upperLeg', 'lowerLeg', 'foot']);
export const RIG_NAMES = PATTERNS.flatMap(([k]) => (SIDED.has(k) ? [k + 'L', k + 'R'] : [k]));

// les os reconnus dans root : { hips, spine, …, upperArmL, … } (des Object3D) ; ce qui n'est pas trouvé est absent
export function findRig(root) {
  const bones = [];
  root.traverse((o) => {
    if (o.isBone) bones.push(o);
  });
  if (!bones.length) return {};
  const rig = {};
  for (const b of bones) {
    const w = words(b.name);
    if (w.some((x) => /^(end|nub|tip|top|pole|target|ik|twist|roll|helper|ctrl|socket|weapon|prop)$/.test(x))) continue;
    if (w.some((x) => /^(thumb|index|middle|ring|pinky|finger|toe|eye|jaw|tongue|teeth|brow|lip|ear|hair|tail|wing|breast|cloth|skirt)/.test(x))) continue;
    const side = sideOf(w);
    const base = w.filter((x) => !NOISE.has(x) && !/^\d+$/.test(x)).join(' ');
    for (const [k, pats] of PATTERNS) {
      const key = SIDED.has(k) ? (side ? k + side : null) : side ? null : k;
      if (!key || rig[key]) continue;
      if (pats.some((p) => p.test(base))) {
        rig[key] = b;
        break;
      }
    }
  }
  // repli : des hanches sans nom connu, ce sont le parent commun des deux cuisses
  if (!rig.hips && rig.upperLegL && rig.upperLegR && rig.upperLegL.parent === rig.upperLegR.parent) rig.hips = rig.upperLegL.parent;
  if (!rig.spine && rig.chest && rig.chest.parent && rig.chest.parent !== rig.hips && rig.chest.parent.isBone) rig.spine = rig.chest.parent;
  if (!rig.chest && rig.neck && rig.neck.parent && rig.neck.parent.isBone) rig.chest = rig.neck.parent;
  return rig;
}

// ---------------------------------------------------------------- mise aux normes
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const UP = new THREE.Vector3(0, 1, 0);
const wpos = (o, out = new THREE.Vector3()) => o.getWorldPosition(out);
const wquat = (o, out = new THREE.Quaternion()) => o.getWorldQuaternion(out);

// le sens où regarde un squelette : la gauche du personnage est à sa droite quand on le regarde de face
function facingOf(rig) {
  const a = rig.upperLegL || rig.upperArmL || rig.shoulderL;
  const b = rig.upperLegR || rig.upperArmR || rig.shoulderR;
  if (!a || !b) return null;
  const left = wpos(a).sub(wpos(b));
  left.y = 0;
  if (left.lengthSq() < 1e-8) return null;
  return left.normalize().cross(UP).normalize(); // gauche × haut = devant
}

// remet un objet debout (y en haut), face à +z, les pieds à y = 0, à la hauteur height ; rend le groupe qui l'enveloppe
export function normalize(root, rig, height) {
  // holder (le décalage sur le sol) > yaw (face à +z) > inner (debout, à l'échelle) > le modèle
  const holder = new THREE.Group();
  const yaw = new THREE.Group();
  const inner = new THREE.Group();
  holder.add(yaw);
  yaw.add(inner);
  inner.add(root);
  holder.updateMatrixWorld(true);
  // couché (Z en haut, exporté sans conversion), ou penché : on le redresse, des hanches vers la tête à la verticale
  if (rig.head && rig.hips) {
    const d = wpos(rig.head).sub(wpos(rig.hips));
    if (d.lengthSq() > 1e-12 && d.normalize().y < 0.9) {
      inner.quaternion.setFromUnitVectors(d, UP);
      holder.updateMatrixWorld(true);
    }
  }
  const f = facingOf(rig);
  if (f) {
    yaw.rotation.y = -Math.atan2(f.x, f.z);
    holder.updateMatrixWorld(true);
  }
  // la boîte, sur les sommets en pose de repos (squelette compris)
  const box = boundsOf(root);
  const h = box.max.y - box.min.y || 1;
  const k = height / h;
  inner.scale.setScalar(k);
  holder.updateMatrixWorld(true);
  const b2 = boundsOf(root);
  holder.position.set(-(b2.min.x + b2.max.x) / 2, -b2.min.y, -(b2.min.z + b2.max.z) / 2);
  holder.updateMatrixWorld(true);
  return { holder, inner, scale: k, rawHeight: h };
}
function boundsOf(root) {
  const box = new THREE.Box3();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 4000)); // assez de points pour une boîte juste, sans tout lire
    for (let i = 0; i < pos.count; i += step) {
      _v.fromBufferAttribute(pos, i);
      if (o.isSkinnedMesh) o.applyBoneTransform(i, _v);
      _v.applyMatrix4(o.matrixWorld);
      box.expandByPoint(_v);
    }
  });
  if (box.isEmpty()) box.setFromObject(root);
  return box;
}

// des matériaux qui tiennent dans le noir du jeu : sans carte d'environnement, un métal parfait est noir ; la lueur
// des néons (emissive, réglée par update) comme sur l'entité actuelle ; ni culling (l'animation sort de la boîte de
// repos), ni ombres portées (le jeu n'en calcule pas pour elle)
function fixMaterials(root, info) {
  const mats = new Set();
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.frustumCulled = false;
    o.castShadow = false;
    o.receiveShadow = false;
    const list = Array.isArray(o.material) ? o.material : [o.material];
    o.material = list.map((m) => {
      const n = m.clone();
      if ('metalness' in n) {
        n.metalness = Math.min(n.metalness ?? 0, 0.25);
        n.metalnessMap = null;
        n.roughness = Math.max(n.roughness ?? 1, 0.55);
      }
      if (n.map) {
        n.map.colorSpace = THREE.SRGBColorSpace;
        n.map.anisotropy = 4;
        const img = n.map.image;
        const wt = img && `texture de ${img.width}×${img.height} : lourde (tools/glb-webp.py la ramène à 1024)`;
        if (img && (img.width > LIMITS.tex || img.height > LIMITS.tex) && !info.warnings.includes(wt)) info.warnings.push(wt);
      }
      if ('emissive' in n && !n.emissiveMap) {
        n.emissive = new THREE.Color('#fff2ec');
        n.emissiveMap = n.map || null;
        n.emissiveIntensity = 0;
      }
      if (n.transparent && n.opacity >= 0.99 && !n.alphaMap && !(n.map && n.alphaTest)) n.transparent = false; // (l'export marque parfois tout « transparent »)
      mats.add(n);
      return n;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });
  return [...mats];
}

// ---------------------------------------------------------------- retarget : les mouvements de l'explorateur sur un autre squelette
// Pour chaque image : chaque os cible prend la direction de l'os source (os → son enfant), en monde, puis on en
// déduit sa rotation locale. Les poses de repos peuvent différer (T ou A, os orientés autrement) : seule la direction
// compte. Les hanches suivent aussi la hauteur (le rebond de la marche), à l'échelle des jambes ; pas l'avance.
const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'lowerArmL', 'handL', 'shoulderR', 'upperArmR', 'lowerArmR', 'handR', 'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'];
const NEXT = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', shoulderL: 'upperArmL', upperArmL: 'lowerArmL', lowerArmL: 'handL', shoulderR: 'upperArmR', upperArmR: 'lowerArmR', lowerArmR: 'handR', upperLegL: 'lowerLegL', lowerLegL: 'footL', upperLegR: 'lowerLegR', lowerLegR: 'footR' };
// la direction d'un os au repos ou animé : vers l'os suivant de la chaîne, sinon vers son premier enfant, sinon son axe y
function boneDir(rig, k, out) {
  const b = rig[k];
  const n = NEXT[k] && rig[NEXT[k]];
  const c = n || b.children.find((o) => o.isBone);
  if (c) {
    wpos(c, out).sub(wpos(b, _v2));
    if (out.lengthSq() > 1e-10) return out.normalize();
  }
  return out.set(0, 1, 0).applyQuaternion(wquat(b, _q2));
}
// un os « libre » : pas rattaché au précédent de sa chaîne (les pieds des rigs à IK, comme l'explorateur, pendent de
// la racine et l'animation les déplace) ; il faut alors reprendre sa position, pas seulement sa rotation
const PREV = Object.fromEntries(Object.entries(NEXT).map(([a, b]) => [b, a]));
function isFree(rig, k) {
  const up = PREV[k] && rig[PREV[k]];
  if (!up) return false;
  for (let o = rig[k].parent; o; o = o.parent) if (o === up) return false;
  return true;
}
// ni en T ni en A : les bras le long du corps, ou les coudes pliés (mains sur les hanches, bras croisés)
function armsDown(rig) {
  let n = 0;
  for (const sd of ['L', 'R']) {
    const a = rig['upperArm' + sd];
    const b = rig['lowerArm' + sd];
    const c = rig['hand' + sd];
    if (!a || !b) continue;
    const up = wpos(b).sub(wpos(a)).normalize();
    const low = c ? wpos(c).sub(wpos(b)).normalize() : null;
    if (up.y < -0.85 || (low && up.angleTo(low) > 0.7)) n++;
  }
  return n > 0;
}
function legLength(rig) {
  let l = 0;
  for (const [a, b] of [['upperLegL', 'lowerLegL'], ['lowerLegL', 'footL']]) if (rig[a] && rig[b]) l += wpos(rig[a]).distanceTo(wpos(rig[b], _v2));
  return l;
}

export function retarget(src, tgt, clip, fps = 30, ref = null) {
  // src, tgt : { holder, rig } normalisés (même sens, mêmes pieds au sol) ; rend un AnimationClip pour tgt.
  // ref (un clip de la source, son attente) : la pose de la cible n'est pas en T ou en A (mains sur les hanches, bras
  // croisés…) ; elle devient sa pose d'attente, et seul l'écart de la source à sa propre attente est repris
  const keys = ORDER.filter((k) => src.rig[k] && tgt.rig[k]);
  if (!keys.includes('hips')) return null;
  src.holder.updateMatrixWorld(true);
  tgt.holder.updateMatrixWorld(true);
  const mixer = new THREE.AnimationMixer(src.root);
  const act = mixer.clipAction(clip);
  act.play();
  // repos : directions et rotations monde des deux côtés
  const restOf = (side) => {
    const r = {};
    for (const k of keys) r[k] = { q: wquat(side.rig[k]), d: boneDir(side.rig, k, new THREE.Vector3()), lq: side.rig[k].quaternion.clone(), p: wpos(side.rig[k]) };
    return r;
  };
  let refMixer = null;
  if (ref) {
    refMixer = new THREE.AnimationMixer(src.root);
    refMixer.clipAction(ref).play();
    refMixer.setTime(0);
    src.holder.updateMatrixWorld(true);
  }
  const srcRest0 = restOf(src); // (la pose de repos de la source, ou son attente : son clip à t = 0 ne l'est pas toujours)
  if (refMixer) {
    refMixer.stopAllAction();
    refMixer.uncacheRoot(src.root);
  }
  const tgtRest = restOf(tgt);
  // l'alignement de chaque os : la rotation qui amène la direction cible (au repos) sur la direction source (au repos)
  const align = {};
  // (avec ref, la cible garde sa propre pose : pas d'alignement, seul le mouvement passe)
  for (const k of keys) align[k] = ref ? new THREE.Quaternion() : new THREE.Quaternion().setFromUnitVectors(tgtRest[k].d, srcRest0[k].d);
  const ratio = legLength(tgt.rig) / (legLength(src.rig) || 1) || 1;
  const n = Math.max(2, Math.round(clip.duration * fps) + 1);
  const times = new Float32Array(n);
  const qv = Object.fromEntries(keys.map((k) => [k, new Float32Array(n * 4)]));
  const pv = new Float32Array(n * 3);
  const free = keys.filter((k) => isFree(src.rig, k) && isFree(tgt.rig, k));
  const fv = Object.fromEntries(free.map((k) => [k, new Float32Array(n * 3)]));
  const restPos = Object.fromEntries(free.map((k) => [k, tgt.rig[k].position.clone()]));
  const hipsParentInv = new THREE.Matrix4().copy(tgt.rig.hips.parent.matrixWorld).invert();
  const D = new THREE.Quaternion();
  const W = new THREE.Quaternion();
  const P = new THREE.Quaternion();
  // un bras (ou une jambe) que le clip source n'anime pas, quand l'autre l'est (l'explorateur tient sa lampe de la
  // main droite) : il reprend le mouvement de l'autre, en miroir et décalé d'un demi-cycle
  const animated = (k) => clip.tracks.some((tr) => tr.name.startsWith(src.rig[k].name + '.') && tr.name.endsWith('quaternion'));
  const other = (k) => (k.endsWith('L') ? k.slice(0, -1) + 'R' : k.endsWith('R') ? k.slice(0, -1) + 'L' : null);
  const mirrored = keys.filter((k) => /Arm|hand/.test(k) && other(k) && !animated(k) && keys.includes(other(k)) && animated(other(k)));
  const Dm = Object.fromEntries(mirrored.map((k) => [k, new THREE.Quaternion()]));
  for (let i = 0; i < n; i++) {
    const t = Math.min(clip.duration, (i / (n - 1)) * clip.duration);
    times[i] = t;
    if (mirrored.length) {
      mixer.setTime((t + clip.duration / 2) % clip.duration);
      src.holder.updateMatrixWorld(true);
      for (const k of mirrored) {
        const o = other(k);
        const q = wquat(src.rig[o], _q).multiply(_q2.copy(srcRest0[o].q).invert());
        Dm[k].set(q.x, -q.y, -q.z, q.w); // (le miroir gauche-droite : x → -x)
      }
    }
    mixer.setTime(t);
    src.holder.updateMatrixWorld(true);
    // de la racine vers les bouts : chaque os cible se place, puis ses enfants le voient bouger
    for (const k of keys) {
      const b = tgt.rig[k];
      if (Dm[k]) D.copy(Dm[k]);
      else D.copy(wquat(src.rig[k], _q)).multiply(_q2.copy(srcRest0[k].q).invert()); // la rotation monde de l'os source depuis son repos
      W.copy(D).multiply(align[k]).multiply(tgtRest[k].q); // la rotation monde voulue pour l'os cible
      b.parent.updateWorldMatrix(true, false);
      wquat(b.parent, P);
      b.quaternion.copy(P.invert().multiply(W));
      b.updateMatrixWorld(true);
      b.quaternion.toArray(qv[k], i * 4);
    }
    // les hanches : le rebond et le balancement, pas l'avance (on reste sur place ; c'est le jeu qui déplace)
    const dp = wpos(src.rig.hips, _v).sub(srcRest0.hips.p).multiplyScalar(ratio);
    dp.z = 0;
    const hw = tgtRest.hips.p.clone().add(dp).applyMatrix4(hipsParentInv);
    hw.toArray(pv, i * 3);
    tgt.rig.hips.position.copy(hw);
    // les os libres : leur déplacement depuis le repos, à l'échelle, sans l'avance des hanches
    const hz = wpos(src.rig.hips, _v2).z - srcRest0.hips.p.z;
    for (const k of free) {
      const d = wpos(src.rig[k], _v).sub(srcRest0[k].p);
      d.z -= hz;
      const w = tgtRest[k].p.clone().add(d.multiplyScalar(ratio));
      const b = tgt.rig[k];
      b.parent.updateWorldMatrix(true, false);
      b.parent.worldToLocal(w);
      w.toArray(fv[k], i * 3);
    }
  }
  // remet la cible au repos
  for (const k of keys) tgt.rig[k].quaternion.copy(tgtRest[k].lq);
  tgt.rig.hips.position.copy(tgtRest.hips.p.clone().applyMatrix4(hipsParentInv));
  tgt.holder.updateMatrixWorld(true);
  mixer.stopAllAction();
  mixer.uncacheRoot(src.root);
  const tracks = keys.map((k) => new THREE.QuaternionKeyframeTrack(`${tgt.rig[k].uuid}.quaternion`, times, qv[k]));
  tracks.push(new THREE.VectorKeyframeTrack(`${tgt.rig.hips.uuid}.position`, times, pv));
  for (const k of free) {
    tracks.push(new THREE.VectorKeyframeTrack(`${tgt.rig[k].uuid}.position`, times, fv[k]));
    tgt.rig[k].position.copy(restPos[k]);
  }
  return new THREE.AnimationClip(clip.name.replace(/^.*\|/, ''), clip.duration, tracks);
}

// ---------------------------------------------------------------- les clips de la créature, par état
// ses propres animations d'abord (d'après leur nom), sinon celles de l'explorateur
const OWN = {
  idle: /idle|stand|breath|wait|loop(?!.*(walk|run))/,
  walk: /walk|stroll|crawl|creep|sneak/,
  run: /run|sprint|charge|chase|gallop/,
  rush: /roar|scream|shout|howl|rage|taunt|yell/,
  grab: /grab|grapple|hold|bite|eat|catch|seize/,
  bang: /attack|punch|hit(?!.*react)|slash|smash|strike|swipe|claw/,
  stun: /hit.?react|hurt|damage|stagger|flinch|pain|stun|knock/,
  drop: /land|fall|jump.?land|drop/,
};
const DONOR = { idle: 'Idle', walk: 'Walk', run: 'Run', stun: 'HitReact', bang: 'Punch', drop: 'Jump_Land' };
// la prise est toujours faite dans le code (l'étreinte qui étouffe), même quand le modèle a son clip
const PROC = new Set(['grab']);
const LOOP = new Set(['idle', 'walk', 'run', 'rush', 'stun', 'bang']);

// ---------------------------------------------------------------- la créature
// opts : { url (ou buffer, un ArrayBuffer), height (m, 2,7 par défaut) }
export function createCreature(opts = {}) {
  const group = new THREE.Group();
  const info = { ok: false, error: null, warnings: [], tris: 0, meshes: 0, skinned: false, bones: 0, rig: {}, clips: [], uses: {}, bytes: 0, height: 0, textures: [] };
  const height = opts.height || 2.7;
  const st = { root: null, rig: {}, mixer: null, acts: {}, w: {}, mats: [], last: { x: 0, z: 0, ok: false }, speed: 0, force: null, forceT: 0, t: 0, head: null, prevMimic: null, unmaskT: 0, unmaskLen: UNMASK_T, low: null, gripT: 0, rest: [] };

  const ready = (async () => {
    try {
      const [{ gltf, bytes }, donor] = await Promise.all([loadGltf(opts.buffer || opts.url || CREATURE_URL), loadGltf(DONOR_URL).catch(() => null)]);
      info.bytes = bytes;
      if (bytes > LIMITS.bytes) info.warnings.push(`fichier de ${(bytes / 1e6).toFixed(1)} Mo : long à charger en ligne (tools/glb-webp.py)`);
      const root = gltf.animations.length || hasSkin(gltf.scene) ? cloneSkinned(gltf.scene) : gltf.scene.clone(true);
      stats(root, gltf, info);
      const rig = findRig(root);
      info.rig = Object.fromEntries(RIG_NAMES.map((k) => [k, rig[k] ? rig[k].name : null]));
      const missing = ['hips', 'spine', 'head', 'upperArmL', 'upperArmR', 'upperLegL', 'upperLegR', 'lowerLegL', 'lowerLegR'].filter((k) => !rig[k]);
      if (info.skinned && missing.length) info.warnings.push(`os non reconnus : ${missing.join(', ')} (animations reprises incomplètes)`);
      if (!info.skinned) info.warnings.push('pas de squelette : le corps bouge d\'un bloc (pour de vraies animations, le rigger, par exemple avec Mixamo)');
      const N = normalize(root, rig, height);
      // (fx : les secousses et le rebond par-dessus, sans toucher à la mise aux normes)
      const fx = new THREE.Group();
      fx.add(N.holder);
      group.add(fx);
      info.height = height;
      info.rawHeight = +N.rawHeight.toFixed(3);
      st.mats = fixMaterials(root, info);
      st.root = root;
      st.rig = rig;
      st.arms = new Set(['upperArmL', 'upperArmR', 'lowerArmL', 'lowerArmR'].map((k) => rig[k]).filter(Boolean));
      st.holder = fx;
      // la tête (le jumpscare la plaque devant l'objectif) : l'os de la tête, sinon un repère en haut du corps
      if (rig.head) {
        // devant le visage (pas la base du crâne, où passerait la caméra au jumpscare) : à hauteur des yeux, à une
        // longueur de tête vers l'avant (le modèle regarde +z)
        N.holder.updateMatrixWorld(true);
        const top = rig.head.children.find((o) => o.isBone);
        const h0 = wpos(rig.head);
        const len = top ? wpos(top).distanceTo(h0) : height * 0.1;
        const face = new THREE.Object3D();
        rig.head.add(face);
        face.position.copy(rig.head.worldToLocal(h0.clone().add(new THREE.Vector3(0, len * 0.5, len * 0.55))));
        st.head = face;
      } else {
        st.head = new THREE.Object3D();
        st.head.position.set(0, height * 0.9, 0.12);
        fx.add(st.head);
      }
      // les clips : les siens, puis ceux de l'explorateur pour ce qui manque
      const own = gltf.animations;
      const clips = {};
      for (const s of STATES) {
        if (PROC.has(s)) continue;
        const name = (a) => a.name.toLowerCase().replace(/^.*\|/, '');
        const c = own.find((a) => name(a) === s) || (OWN[s] && own.find((a) => OWN[s].test(name(a))));
        if (c) {
          clips[s] = c;
          info.uses[s] = `son clip « ${c.name} »`;
        }
      }
      if (info.skinned && rig.hips && donor && Object.keys(DONOR).some((k) => !clips[k])) {
        const dRoot = cloneSkinned(donor.gltf.scene);
        const dRig = findRig(dRoot);
        const DN = normalize(dRoot, dRig, height);
        // ni en T ni en A (les bras le long du corps ou repliés) : sa pose sert d'attente (voir retarget)
        const donorIdle = donor.gltf.animations.find((a) => a.name.endsWith('|Idle'));
        const posed = armsDown(rig);
        st.posed = posed;
        if (posed) info.warnings.push("pose d'origine ni en T ni en A : elle sert de pose d'attente, les mouvements partent d'elle");
        for (const [s, name] of Object.entries(DONOR)) {
          if (clips[s]) continue;
          const src = donor.gltf.animations.find((a) => a.name.endsWith('|' + name));
          const c = src && retarget({ holder: DN.holder, rig: dRig, root: dRoot }, { holder: N.holder, rig, root }, src, 30, posed ? donorIdle : null);
          if (c) {
            clips[s] = c;
            info.uses[s] = `l'explorateur (${name}), repris sur son squelette`;
          }
        }
      }
      st.unmaskLen = UNMASK_T; // (la transformation du moteur : son clip est joué à cette durée)
      st.mixer = new THREE.AnimationMixer(root);
      for (const [s, c] of Object.entries(clips)) {
        const a = st.mixer.clipAction(c);
        a.setLoop(LOOP.has(s) ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
        a.clampWhenFinished = !LOOP.has(s);
        a.play();
        if (s === 'unmask') a.timeScale = c.duration / UNMASK_T;
        a.weight = s === 'idle' ? 1 : 0;
        st.acts[s] = a;
        st.w[s] = s === 'idle' ? 1 : 0;
      }
      for (const s of ['rush', 'unmask', 'scare']) if (!info.uses[s]) info.uses[s] = 'procédural (par-dessus la course ou l\'attente)';
      for (const s of STATES) if (!info.uses[s]) info.uses[s] = info.skinned ? 'procédural' : 'procédural (d\'un bloc)';
      root.traverse((o) => {
        if (o.isBone) st.rest.push({ o, q: o.quaternion.clone(), p: o.position.clone() });
      });
      // la hauteur de chaque pied au repos (les pas se comptent par rapport à elle)
      group.updateMatrixWorld(true);
      const fl = rig.footL || rig.lowerLegL;
      const fr = rig.footR || rig.lowerLegR;
      st.footRest = { L: fl ? wpos(fl).y - group.getWorldPosition(_v2).y : 0, R: fr ? wpos(fr).y - group.getWorldPosition(_v2).y : 0 };
      info.ok = true;
    } catch (e) {
      info.error = String((e && e.message) || e);
    }
    return info;
  })();

  // l'état que montre la créature, d'après l'entité du moteur (ou forcé par la page d'aperçu)
  const stateOf = (M) => {
    if (st.force) return st.force;
    if (st.unmaskT > 0) return 'unmask';
    if ((M.landT || 0) > 0) return 'drop';
    if (M.mode === 'grab') return 'grab';
    if (M.mode === 'stun') return 'stun';
    if (M.mode === 'bang') return 'bang';
    if ((M.rushT || 0) > 0 || (M.windT || 0) > 0) return 'rush';
    return st.speed > 2.4 ? 'run' : st.speed > 0.25 ? 'walk' : 'idle';
  };
  const ease = (a, b, k, dt) => a + (b - a) * Math.min(1, dt * k);
  const add = (b, x, y, z, k) => {
    if (!b || !k) return;
    // (pose d'origine mains sur les hanches, bras croisés… : les gestes des bras, pensés pour un T, restent mesurés)
    if (st.posed && st.arms.has(b)) k *= 0.4;
    _q.setFromEuler(new THREE.Euler(x * k, y * k, z * k));
    b.quaternion.multiply(_q);
  };
  const W = {};

  return {
    group,
    ready,
    info,
    // (aperçu) montrer un état : null rend la main au moteur ; restart rejoue un clip qui ne boucle pas
    show(s) {
      st.force = s;
      st.cur = null; // (rejoue l'état depuis le début, même s'il était déjà montré)
      if (s === 'unmask') st.unmaskT = st.unmaskLen;
    },
    // la hauteur (aperçu) : même mise aux normes, autre échelle
    get state() {
      return st.cur || 'idle';
    },
    scareFace() {
      st.force = 'scare';
      group.position.set(0, 0, 0);
      group.rotation.set(0, 0, 0);
      return st.head || st.holder || null;
    },
    // un coup contre une porte blindée vient de sonner (le moteur décide de l'instant) : le clip de frappe se recale
    // sur son impact, et prend le rythme des coups (l'écart depuis le précédent), au lieu de tourner à sa propre cadence
    // shortcut: l'instant de l'impact (BANG_HIT) est celui d'entite.glb ; à lire dans le modèle s'il change
    hit(now) {
      const a = st.acts.bang;
      if (!a) return;
      const gap = now - (st.hitAt || 0);
      st.hitAt = now;
      a.time = BANG_HIT;
      const len = a.getClip().duration;
      if (gap > 0.2 && gap < 1.5) a.timeScale = THREE.MathUtils.clamp(len / gap, 0.6, 2.5);
    },
    // sous une porte plus basse qu'elle (2,10 m pour ses 2,70 m) : la scène dit quand, elle se courbe pour passer
    duck(on) {
      st.duckTo = on ? 1 : 0;
    },
    // M : l'entité ; chase : elle poursuit ; light : lumière des néons là où elle est ; dt, time ; eye : la caméra.
    // Rend le pied qui vient de toucher le sol ('L' ou 'R'), sinon null
    update(M, chase, light, dt, time, eye = null) {
      if (!info.ok || !st.mixer) return null;
      // sa vitesse, d'après son déplacement (pareil chez l'hôte et chez les invités)
      const L0 = st.last;
      if (L0.ok && dt > 0) {
        const jump = Math.hypot(M.x - L0.x, M.z - L0.z);
        st.speed = ease(st.speed, jump > 3 ? st.speed : Math.min(9, jump / dt), 6, dt);
      }
      L0.x = M.x;
      L0.z = M.z;
      L0.ok = true;
      // le démasquage : quand l'imposteur reprend sa forme
      if (st.prevMimic != null && M.mimic == null) st.unmaskT = st.unmaskLen;
      st.prevMimic = M.mimic ?? null;
      st.unmaskT = Math.max(0, st.unmaskT - dt);
      if (st.force === 'unmask' && st.unmaskT <= 0) st.force = 'idle'; // (aperçu : le démasquage fini, il attend)
      st.t += dt;
      const s = stateOf(M);
      if (s !== st.cur) {
        // un nouvel état : ses gestes repartent du début (et un clip joué une fois aussi)
        st.t = 0;
        if (st.acts[s] && !LOOP.has(s)) st.acts[s].reset().play();
      }
      st.cur = s;
      for (const m of st.mats) if ('emissiveIntensity' in m) m.emissiveIntensity = Math.min(0.6, (light || 0) * 0.25);
      // les poids des clips : l'état voulu, ou ce qui le porte (la ruée court, le démasquage attend, le jumpscare saisit)
      const base = clipsOwn(info, s) ? s : { rush: 'run', unmask: 'idle', scare: st.acts.grab ? 'grab' : 'idle' }[s] || s;
      const has = (n) => (st.acts[n] ? n : null);
      const want = has(base) || (base === 'run' ? has('walk') : null) || has('idle');
      for (const n in st.acts) {
        st.w[n] = ease(st.w[n], n === want ? 1 : 0, s === 'drop' || s === 'unmask' ? 14 : 7, dt);
        st.acts[n].weight = st.w[n];
      }
      if (st.acts.walk) st.acts.walk.timeScale = THREE.MathUtils.clamp(st.speed / 1.6, 0.6, 1.6);
      if (st.acts.run) st.acts.run.timeScale = s === 'rush' ? 1.7 : THREE.MathUtils.clamp(1.25 * Math.sqrt(Math.max(0.3, st.speed) / 3.3), 0.9, 2.1);
      for (const r of st.rest) {
        r.o.quaternion.copy(r.q);
        r.o.position.copy(r.p);
      }
      st.mixer.update(dt);

      // --- par-dessus les clips : ce qui manque (sur les os reconnus ; sans squelette, tout le corps) ---
      const R = st.rig;
      for (const k of ['rush', 'grab', 'stun', 'bang', 'unmask', 'scare', 'drop']) W[k] = ease(W[k] || 0, s === k && !clipsOwn(info, k) ? 1 : 0, 10, dt);
      const t = st.t;
      // la ruée : la tête rejetée en arrière dans le cri, les bras ouverts, puis tout le corps penché en avant
      add(R.chest, -0.35 + 0.65 * Math.min(1, t / 0.5), 0, 0, W.rush);
      add(R.head, -0.6 + 0.8 * Math.min(1, t / 0.5) + Math.sin(t * 50) * 0.04, 0, Math.sin(t * 37) * 0.05, W.rush);
      add(R.upperArmL, 0, 0, 0.5, W.rush);
      add(R.upperArmR, 0, 0, -0.5, W.rush);
      // la prise : elle ouvre grand les bras (0,4 s), les referme d'un coup sur le joueur (0,2 s), puis serre et l'étouffe,
      // par à-coups, penchée sur lui, la tête qui vient tout contre la sienne
      const sm = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
      const gO = sm(t / 0.4);
      const gC = sm((t - 0.4) / 0.2);
      const sq = gC * (0.5 + 0.5 * Math.sin(t * 13)) * Math.min(1, (t - 0.6) / 0.6 + 0.3);
      const gz = 1.4 * gO * (1 - gC) - 0.9 * gC - 0.12 * sq;
      const gx = -0.5 * gO * (1 - gC) - 1.25 * gC;
      add(R.upperArmL, gx, 0, gz, W.grab);
      add(R.upperArmR, gx, 0, -gz, W.grab);
      // (les mains se rejoignent devant, à hauteur de gorge ; les poignets se tordent à chaque serrement)
      add(R.lowerArmL, 0, 0.6 * gC + 0.3 * sq, 0, W.grab);
      add(R.lowerArmR, 0, -0.6 * gC - 0.3 * sq, 0, W.grab);
      add(R.chest, -0.3 * gO * (1 - gC) + 0.4 * gC + 0.06 * sq, 0, 0, W.grab);
      add(R.head, -0.4 * gO * (1 - gC) + 0.35 * gC, 0, 0.3 * gC + Math.sin(t * 23) * 0.04 * gC, W.grab);
      // sonnée : le buste rejeté, la tête qui roule
      add(R.chest, -0.3 + Math.sin(t * 4) * 0.08, Math.sin(t * 3) * 0.15, 0, W.stun);
      add(R.head, Math.sin(t * 5) * 0.25, 0, Math.sin(t * 3.4) * 0.35, W.stun);
      // les coups contre une porte : penchée, les bras qui s'abattent l'un après l'autre
      const hitL = Math.max(0, Math.sin(t * 9));
      const hitR = Math.max(0, Math.sin(t * 9 + Math.PI));
      add(R.chest, 0.3, 0, 0, W.bang);
      add(R.upperArmL, -2.3 + hitL * 1.4, 0, 0.2, W.bang * (clipsOwn(info, 'bang') ? 0 : 1));
      add(R.upperArmR, -2.3 + hitR * 1.4, 0, -0.2, W.bang * (clipsOwn(info, 'bang') ? 0 : 1));
      // le démasquage : le corps se tord et se déplie dans tous les sens, de plus en plus fort, puis se redresse
      const u = 1 - st.unmaskT / st.unmaskLen;
      const tw = Math.sin(u * Math.PI) * W.unmask;
      add(R.spine, Math.sin(t * 31) * 0.4, Math.sin(t * 23) * 0.5, Math.sin(t * 29) * 0.3, tw);
      add(R.neck, Math.sin(t * 41) * 0.6, Math.sin(t * 17) * 0.8, 0, tw);
      add(R.upperArmL, Math.sin(t * 27) * 1.2, 0, 0.8, tw);
      add(R.upperArmR, Math.sin(t * 33) * 1.2, 0, -0.8, tw);
      // le jumpscare : la tête qui se jette en avant, les bras qui encadrent l'image
      add(R.chest, 0.5, 0, 0, W.scare);
      add(R.head, 0.35 + Math.sin(t * 60) * 0.06, Math.sin(t * 47) * 0.06, 0, W.scare);
      add(R.upperArmL, -1.6, 0, 0.6, W.scare);
      add(R.upperArmR, -1.6, 0, -0.6, W.scare);
      // la chute d'une gaine : genoux pliés à l'arrivée, puis elle se redresse
      const land = Math.max(0, 1 - Math.abs(t - 0.35) / 0.35);
      add(R.upperLegL, -1.0 * land, 0, 0, W.drop);
      add(R.upperLegR, -1.0 * land, 0, 0, W.drop);
      add(R.lowerLegL, 1.6 * land, 0, 0, W.drop);
      add(R.lowerLegR, 1.6 * land, 0, 0, W.drop);
      add(R.chest, 0.5 * land, 0, 0, W.drop);

      // sous une porte : genoux fléchis, le dos rond, la tête rentrée (sa tête passait à travers l'imposte)
      const dk = (st.duck = ease(st.duck || 0, st.duckTo || 0, 7, dt));
      add(R.upperLegL, -0.75, 0, 0, dk);
      add(R.upperLegR, -0.75, 0, 0, dk);
      add(R.lowerLegL, 1.3, 0, 0, dk);
      add(R.lowerLegR, 1.3, 0, 0, dk);
      add(R.spine, 0.45, 0, 0, dk);
      add(R.chest, 0.55, 0, 0, dk);
      add(R.head, 0.3, 0, 0, dk);

      // sans squelette : le corps entier se penche, rebondit et tremble selon l'état
      const H = st.holder;
      if (!info.skinned && H) {
        const bob = st.speed > 0.25 ? Math.abs(Math.sin(t * (st.speed > 2.4 ? 9 : 5))) * 0.06 : Math.sin(t * 1.6) * 0.01;
        H.position.y = bob - 0.4 * (W.drop * (1 - Math.min(1, t / 0.6))) - 0.7 * dk; // (sans os : elle s'enfonce d'autant)
        H.rotation.x = 0.25 * W.rush + 0.15 * W.grab - 0.2 * W.stun + 0.25 * W.bang * (0.5 + 0.5 * Math.sin(t * 9)) + (st.speed > 2.4 ? 0.12 : 0);
        H.rotation.z = Math.sin(t * 30) * 0.08 * (W.unmask + W.rush * 0.4 + W.scare);
        const sc = 1 + Math.sin(t * 40) * 0.05 * W.unmask;
        H.scale.set(sc, 1 / sc, sc);
      } else if (H) {
        // tremblement du cri et du démasquage
        const j = (W.rush * 0.03 + W.unmask * 0.06 + W.scare * 0.02 + W.grab * 0.025) * (Math.random() - 0.5);
        H.position.set(j, H.position.y, j);
        H.position.y = -0.35 * W.drop * Math.max(0, 1 - Math.abs(t - 0.35) / 0.35) - 0.3 * dk * (height / 2.7);
      }

      // les pas : quand l'autre pied devient le plus bas (il vient de se poser), quelle que soit la forme du pied
      let foot = null;
      const fL = R.footL || R.lowerLegL;
      const fR = R.footR || R.lowerLegR;
      if (st.speed > 0.3 && fL && fR) {
        group.updateMatrixWorld(true);
        // (chacun par rapport à sa hauteur au repos : dans une pose asymétrique, un pied est toujours plus haut)
        const g0 = group.getWorldPosition(_v2).y;
        const yL = wpos(fL, _v).y - g0 - st.footRest.L;
        const yR = wpos(fR, _v).y - g0 - st.footRest.R;
        const gap = 0.012 * (height / 1.8);
        const low = yL < yR - gap ? 'L' : yR < yL - gap ? 'R' : st.low;
        if (st.low && low !== st.low) foot = low;
        st.low = low;
      } else if (st.speed > 0.3) {
        // sans pieds reconnus : un pas au rythme de la vitesse
        st.gripT -= dt * (st.speed > 2.4 ? 3.7 : 2);
        if (st.gripT <= 0) {
          st.gripT = 1;
          foot = st.lastFoot === 'L' ? 'R' : 'L';
          st.lastFoot = foot;
        }
      }
      return foot;
    },
  };
}
const clipsOwn = (info, s) => /son clip/.test(info.uses[s] || '');
function hasSkin(root) {
  let s = false;
  root.traverse((o) => {
    if (o.isSkinnedMesh) s = true;
  });
  return s;
}
function stats(root, gltf, info) {
  const tex = new Set();
  root.traverse((o) => {
    if (o.isSkinnedMesh) info.skinned = true;
    if (o.isBone) info.bones++;
    if (!o.isMesh) return;
    info.meshes++;
    const g = o.geometry;
    info.tris += g.index ? g.index.count / 3 : g.attributes.position.count / 3;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap']) if (m[k] && m[k].image) tex.add(m[k]);
  });
  info.tris = Math.round(info.tris);
  info.textures = [...tex].map((t) => `${t.name || 'texture'} ${t.image.width}×${t.image.height}`);
  info.clips = gltf.animations.map((a) => `${a.name} (${a.duration.toFixed(2)} s)`);
  if (info.tris > LIMITS.tris) info.warnings.push(`${info.tris} triangles : lourd pour une entité qui court (visez moins de ${LIMITS.tris / 1000} k)`);
  if (info.bones > LIMITS.bones) info.warnings.push(`${info.bones} os : beaucoup`);
}
