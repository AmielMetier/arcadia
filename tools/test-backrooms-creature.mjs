// The Backrooms - le chargeur de créatures (backrooms/view/creature.js) : reconnaissance des os sous les noms
// courants, mise aux normes (debout, face à +z, pieds au sol) et retarget des animations de l'explorateur.
// node tools/test-backrooms-creature.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

// (en Node : fetch lit les fichiers du dépôt)
globalThis.fetch = async (u) => {
  const b = fs.readFileSync(fileURLToPath(u));
  return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
};
globalThis.self = globalThis;
const THREE = await import('../shared/vendor/three/three.module.min.js');
const { loadGltf, findRig, normalize, retarget } = await import('../backrooms/view/creature.js');
const { clone } = await import('../shared/vendor/three/SkeletonUtils.js');

let count = 0;
const test = async (name, fn) => {
  await fn();
  count++;
  console.log('✓ ' + name);
};

// un squelette d'humanoïde factice avec les noms d'une convention
function fakeRig(names) {
  const root = new THREE.Group();
  const mk = (n, parent, y = 0.1) => {
    const b = new THREE.Bone();
    b.name = n;
    b.position.y = y;
    (parent || root).add(b);
    return b;
  };
  const [hips, spine, chest, neck, head, shL, uaL, laL, hL, shR, uaR, laR, hR, ulL, llL, fL, ulR, llR, fR, extra] = names;
  const H = mk(hips);
  const S = mk(spine, H);
  const C = mk(chest, S);
  const N = mk(neck, C);
  mk(head, N);
  for (const [sh, ua, la, h] of [[shL, uaL, laL, hL], [shR, uaR, laR, hR]]) mk(h, mk(la, mk(ua, mk(sh, C))));
  for (const [ul, ll, f] of [[ulL, llL, fL], [ulR, llR, fR]]) mk(f, mk(ll, mk(ul, H)));
  for (const e of extra || []) mk(e, H);
  return root;
}
const KEYS = ['hips', 'spine', 'chest', 'neck', 'head', 'shoulderL', 'upperArmL', 'lowerArmL', 'handL', 'shoulderR', 'upperArmR', 'lowerArmR', 'handR', 'upperLegL', 'lowerLegL', 'footL', 'upperLegR', 'lowerLegR', 'footR'];

await test('les os se reconnaissent sous les noms de Mixamo, Unreal, Rigify, 3ds Max (Bip01) et Quaternius', () => {
  const conventions = {
    mixamo: ['mixamorig:Hips', 'mixamorig:Spine', 'mixamorig:Spine2', 'mixamorig:Neck', 'mixamorig:Head', 'mixamorig:LeftShoulder', 'mixamorig:LeftArm', 'mixamorig:LeftForeArm', 'mixamorig:LeftHand', 'mixamorig:RightShoulder', 'mixamorig:RightArm', 'mixamorig:RightForeArm', 'mixamorig:RightHand', 'mixamorig:LeftUpLeg', 'mixamorig:LeftLeg', 'mixamorig:LeftFoot', 'mixamorig:RightUpLeg', 'mixamorig:RightLeg', 'mixamorig:RightFoot', ['mixamorig:HeadTop_End', 'mixamorig:LeftToeBase']],
    unreal: ['pelvis', 'spine_01', 'spine_03', 'neck_01', 'head', 'clavicle_l', 'upperarm_l', 'lowerarm_l', 'hand_l', 'clavicle_r', 'upperarm_r', 'lowerarm_r', 'hand_r', 'thigh_l', 'calf_l', 'foot_l', 'thigh_r', 'calf_r', 'foot_r', ['ik_foot_l', 'thigh_twist_01_l']],
    rigify: ['DEF-hips', 'DEF-spine', 'DEF-chest', 'DEF-neck', 'DEF-head', 'DEF-shoulder.L', 'DEF-upper_arm.L', 'DEF-forearm.L', 'DEF-hand.L', 'DEF-shoulder.R', 'DEF-upper_arm.R', 'DEF-forearm.R', 'DEF-hand.R', 'DEF-thigh.L', 'DEF-shin.L', 'DEF-foot.L', 'DEF-thigh.R', 'DEF-shin.R', 'DEF-foot.R'],
    bip01: ['Bip01 Pelvis', 'Bip01 Spine', 'Bip01 Spine2', 'Bip01 Neck', 'Bip01 Head', 'Bip01 L Clavicle', 'Bip01 L UpperArm', 'Bip01 L Forearm', 'Bip01 L Hand', 'Bip01 R Clavicle', 'Bip01 R UpperArm', 'Bip01 R Forearm', 'Bip01 R Hand', 'Bip01 L Thigh', 'Bip01 L Calf', 'Bip01 L Foot', 'Bip01 R Thigh', 'Bip01 R Calf', 'Bip01 R Foot', ['Bip01 L Toe0', 'Bip01 HeadNub']],
    quaternius: ['Hips', 'Abdomen', 'Torso', 'Neck', 'Head', 'ShoulderL', 'UpperArmL', 'LowerArmL', 'HandL', 'ShoulderR', 'UpperArmR', 'LowerArmR', 'HandR', 'UpperLegL', 'LowerLegL', 'FootL', 'UpperLegR', 'LowerLegR', 'FootR', ['PoleTargetL']],
  };
  for (const [conv, names] of Object.entries(conventions)) {
    const rig = findRig(fakeRig(names));
    KEYS.forEach((k, i) => assert.equal(rig[k] && rig[k].name, names[i], `${conv} : ${k}`));
  }
});

const { gltf } = await loadGltf(new URL('../backrooms/models/hazmat.glb', import.meta.url).href);
const walk = gltf.animations.find((c) => c.name.endsWith('|Walk'));

await test('un modèle couché (Z en haut), tourné et cent fois trop petit est remis debout, face à +z, pieds au sol, à la bonne taille', () => {
  const b = clone(gltf.scene);
  const wrap = new THREE.Group();
  wrap.add(b);
  b.rotation.set(Math.PI / 2, 0, 0);
  b.scale.setScalar(0.01);
  wrap.rotation.y = 2;
  const rig = findRig(b);
  const N = normalize(wrap, rig, 2.7);
  N.holder.updateMatrixWorld(true);
  const hips = rig.hips.getWorldPosition(new THREE.Vector3());
  const head = rig.head.getWorldPosition(new THREE.Vector3());
  assert.ok(head.y - hips.y > 0.5, 'la tête au-dessus des hanches');
  const left = rig.upperLegL.getWorldPosition(new THREE.Vector3()).sub(rig.upperLegR.getWorldPosition(new THREE.Vector3()));
  assert.ok(left.x > 0.05 && Math.abs(left.z) < 0.02, 'la gauche du personnage vers +x : il regarde +z');
  const box = new THREE.Box3().setFromObject(N.holder, true);
  assert.ok(Math.abs(box.min.y) < 0.12 && Math.abs(box.max.y - 2.7) < 0.15, `debout sur le sol, 2,70 m (${box.min.y.toFixed(2)} → ${box.max.y.toFixed(2)})`);
});

await test('la marche de l\'explorateur, reprise sur ce modèle, reproduit chaque os à moins d\'un degré et les hauteurs au centimètre', () => {
  const a = clone(gltf.scene);
  const ra = findRig(a);
  const A = normalize(a, ra, 2.7);
  const b = clone(gltf.scene);
  const wrap = new THREE.Group();
  wrap.add(b);
  b.rotation.set(Math.PI / 2, 0, 0);
  b.scale.setScalar(0.01);
  wrap.rotation.y = 2;
  const rb = findRig(b);
  const B = normalize(wrap, rb, 2.7);
  const clip = retarget({ holder: A.holder, rig: ra, root: a }, { holder: B.holder, rig: rb, root: b }, walk);
  assert.ok(clip && clip.tracks.length >= 17, 'un clip, une piste par os reconnu');
  const ma = new THREE.AnimationMixer(a);
  ma.clipAction(walk).play();
  const mb = new THREE.AnimationMixer(b);
  mb.clipAction(clip).play();
  const P = new THREE.Vector3();
  const Q = new THREE.Vector3();
  const dir = (r, k, n) => r[n].getWorldPosition(new THREE.Vector3()).sub(r[k].getWorldPosition(new THREE.Vector3())).normalize();
  let ang = 0;
  let dy = 0;
  const swing = { min: 1, max: -1 };
  for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    ma.setTime(t);
    mb.setTime(t);
    A.holder.updateMatrixWorld(true);
    B.holder.updateMatrixWorld(true);
    for (const [k, n] of [['upperLegL', 'lowerLegL'], ['upperLegR', 'lowerLegR'], ['upperArmL', 'lowerArmL'], ['spine', 'chest'], ['neck', 'head']]) ang = Math.max(ang, dir(ra, k, n).angleTo(dir(rb, k, n)));
    // (le bras droit de l'explorateur tient la lampe : immobile dans le clip, il prend le balancement du gauche en miroir)
    const r = dir(rb, 'upperArmR', 'lowerArmR');
    swing.min = Math.min(swing.min, r.z);
    swing.max = Math.max(swing.max, r.z);
    for (const k of ['footL', 'footR', 'hips', 'head']) {
      ra[k].getWorldPosition(P);
      rb[k].getWorldPosition(Q);
      dy = Math.max(dy, Math.abs(P.y - Q.y));
    }
  }
  assert.ok(ang < Math.PI / 180, `directions (${((ang * 180) / Math.PI).toFixed(2)}°)`);
  assert.ok(dy < 0.03, `hauteurs (${(dy * 100).toFixed(1)} cm)`);
  assert.ok(swing.max - swing.min > 0.3, `le bras droit se balance d'avant en arrière (${(swing.max - swing.min).toFixed(2)})`);
});

console.log(`\n${count} tests réussis pour le chargeur de créatures des Backrooms !`);
