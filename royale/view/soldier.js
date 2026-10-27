// Le personnage : le soldat du « Toon Shooter Game Kit » (Quaternius, CC0), animé (repos, course, course arme en main,
// tir, accroupi, saut, chute, élimination) et recoloré pour chaque joueur (uniforme à sa couleur, pantalon et teint
// variés). L'arme tenue est accrochée à sa main droite, à la rareté de sa couleur ; les autres objets sont tenus
// au-dessus du poing, redressés. Par-dessus les animations du kit, des gestes du bras droit faits ici : coup de pelle,
// lancer de grenade, pose (tremplin, construction), soin (bandage ou trousse devant le buste, potion portée à la
// bouche) et rechargement (l'arme baisse et pivote). Même façon de faire que view/hero.js (repère local : il regarde
// +z, pieds à l'origine), qui reste là si le kit ne charge pas.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { cloneSkinned, tintMaterial } from './kit.js';
import { RARITY } from '../engine/items.js';

const HEIGHT = 1.8;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rarityMats = new Map();
export function rarityMaterial(r) {
  if (!rarityMats.has(r)) rarityMats.set(r, tintMaterial({ 4: { color: new THREE.Color(RARITY[r].color), mix: r === 0 ? 0.15 : 0.6 } }, { metalness: 0.2, roughness: 0.55 }));
  return rarityMats.get(r);
}

// mesure une fois la taille et l'orientation du modèle (pour le ramener à 1,8 m, pieds au sol, regard vers +z)
function calibrate(kit) {
  const S = kit.soldier;
  if (S.cal) return S.cal;
  const m = cloneSkinned(S.tmpl);
  m.updateMatrixWorld(true);
  let mesh = null;
  m.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  mesh.computeBoundingBox();
  const box = mesh.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  const h = box.max.y - box.min.y, k = HEIGHT / h;
  // regard : le nez de la tête est du côté où le buste avance (on prend la direction du pied gauche vers le droit)
  const head = m.getObjectByName('Head'), hips = m.getObjectByName('Hips');
  const fl = m.getObjectByName('UpperLegL'), fr = m.getObjectByName('UpperLegR');
  const pl = new THREE.Vector3(), pr = new THREE.Vector3();
  fl.getWorldPosition(pl); fr.getWorldPosition(pr);
  // gauche → droite du personnage ; s'il regarde +z, sa gauche est en +x (repère de view/hero.js)
  const leftToRight = pr.sub(pl);
  const yaw = leftToRight.x < 0 ? 0 : Math.PI;
  void head; void hips;
  S.cal = { k, y: -box.min.y * k, yaw };
  return S.cal;
}

// orientation de la main quand le soldat épaule (regard +z, haut +y) : sert à poser les armes du kit à plat
export function aimFrame(kit) {
  const S = kit.soldier;
  if (S.aim) return S.aim;
  const m = cloneSkinned(S.tmpl), mixer = new THREE.AnimationMixer(m);
  const clip = S.clips.find((c) => c.name.endsWith('Idle_Shoot'));
  if (clip) { mixer.clipAction(clip).play(); mixer.update(0); }
  m.rotation.y = calibrate(kit).yaw;
  m.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  m.getObjectByName('Index1R').matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
  S.aim = new THREE.Matrix4().makeRotationFromQuaternion(q);
  return S.aim;
}

export function buildSoldier(kit, { shirt = 0xff4b2b, pants = 0x3a3f4a, skin = 0xc98f64, items } = {}) {
  const S = kit.soldier, cal = calibrate(kit);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const model = cloneSkinned(S.tmpl);
  model.scale.multiplyScalar(cal.k); model.position.y = cal.y; model.rotation.y = cal.yaw;
  body.add(model);
  let mesh = null;
  model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  const mat = tintMaterial({ 1: { color: new THREE.Color(shirt), mix: 0.82 }, 2: { color: new THREE.Color(pants), mix: 1 }, 3: { color: new THREE.Color(skin), mix: 1 } });
  mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  const hand = model.getObjectByName('Index1R'), torso = model.getObjectByName('Torso'), neck = model.getObjectByName('Neck');
  const upperArm = model.getObjectByName('UpperArmR'), lowerArm = model.getObjectByName('LowerArmR');
  const baseTorso = torso ? torso.quaternion.clone() : null, baseNeck = neck ? neck.quaternion.clone() : null;
  const baseUpper = upperArm ? upperArm.quaternion.clone() : null, baseLower = lowerArm ? lowerArm.quaternion.clone() : null, baseHand = hand.quaternion.clone();
  const qx = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
  // objets tenus qui ne viennent pas du kit : dans un support à l'échelle du monde, accroché à la main
  const holder = new THREE.Group(); hand.add(holder);
  model.updateMatrixWorld(true);
  const hs = new THREE.Vector3(); hand.getWorldScale(hs); holder.scale.set(1 / hs.x, 1 / hs.y, 1 / hs.z);

  // ---------------------------------------------------------------- animations
  const mixer = new THREE.AnimationMixer(model), act = {};
  for (const c of S.clips) {
    const name = c.name.replace(/^.*\|/, '');
    if (act[name]) continue;
    act[name] = mixer.clipAction(c);
  }
  for (const k of ['Death', 'Jump_Land', 'Punch', 'Jump']) if (act[k]) { act[k].setLoop(THREE.LoopOnce, 1); act[k].clampWhenFinished = true; }
  let cur = null, curName = '';
  function play(name, fade = 0.18, scale = 1) {
    const a = act[name];
    if (!a) return;
    a.timeScale = scale;
    if (curName === name) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (cur) cur.fadeOut(fade);
    cur = a; curName = name;
  }

  // ---------------------------------------------------------------- planeur : une aile au-dessus de la tête
  const glider = new THREE.Group(); glider.visible = false; root.add(glider);
  const wingMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.6, side: THREE.DoubleSide });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0x2b2e36 });
  {
    const wing = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 8, 0, Math.PI * 2, 0, Math.PI * 0.32).scale(1.9, 0.55, 1.1), wingMat);
    wing.position.y = 2.45; wing.castShadow = true; glider.add(wing);
    for (const sx of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.2, 4), cableMat); c.position.set(0.55 * sx, 1.85, 0); c.rotation.z = -sx * 0.45; glider.add(c); }
  }

  let held = null, heldKind = null, heldC = null, fly = 0, swim = 0, deadT = 0, air = 0, kick = 0, aimLift = 0;
  let arm = null, use = 0, reload = 0, crouchGun = 0, clock = 0;
  // ---------------------------------------------------------------- gestes : la main va à un point, épaule et coude suivent
  // (cinématique inverse à deux os : bras et avant-bras). Points et coude exprimés dans le repère du corps, depuis
  // l'épaule : x vers la gauche du personnage (le milieu du corps pour la main droite), y en haut, z devant.
  const V = () => new THREE.Vector3(), qb = new THREE.Quaternion(), qp = new THREE.Quaternion(), qd = new THREE.Quaternion();
  const S0 = V(), E0 = V(), H0 = V(), T = V(), dir = V(), P = V(), E1 = V(), v1 = V(), v2 = V();
  // fait tourner un os (sur son articulation `origin`) pour que le point `from` passe en `to`
  function aimBone(bone, origin, from, to) {
    v1.subVectors(from, origin).normalize(); v2.subVectors(to, origin).normalize();
    qd.setFromUnitVectors(v1, v2);
    bone.parent.getWorldQuaternion(qp);
    bone.quaternion.premultiply(qp.clone().invert().multiply(qd).multiply(qp));
  }
  function reach(target, w, pole, roll = 0) {
    if (w <= 0.002) return;
    body.getWorldQuaternion(qb);
    upperArm.getWorldPosition(S0); lowerArm.getWorldPosition(E0); hand.getWorldPosition(H0);
    const L1 = S0.distanceTo(E0), L2 = E0.distanceTo(H0);
    T.copy(target).applyQuaternion(qb).add(S0).sub(H0).multiplyScalar(w).add(H0);
    dir.subVectors(T, S0);
    const d = clamp(dir.length(), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.005);
    dir.normalize(); T.copy(S0).addScaledVector(dir, d);
    const a = (L1 * L1 - L2 * L2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, L1 * L1 - a * a));
    P.copy(pole).applyQuaternion(qb); P.addScaledVector(dir, -P.dot(dir)).normalize();
    E1.copy(S0).addScaledVector(dir, a).addScaledVector(P, h);
    aimBone(upperArm, S0, E0, E1);
    lowerArm.getWorldPosition(E0); hand.getWorldPosition(H0);
    aimBone(lowerArm, E0, H0, T);
    if (roll) {
      hand.getWorldPosition(H0); v1.subVectors(H0, E0).normalize();
      lowerArm.parent.getWorldQuaternion(qp);
      lowerArm.quaternion.premultiply(qp.clone().invert().multiply(qd.setFromAxisAngle(v1, roll)).multiply(qp));
    }
  }
  // l'arme tenue pointe droit devant (orientation de la main quand il épaule)
  const aimQ = new THREE.Quaternion().setFromRotationMatrix(aimFrame(kit)), qh = new THREE.Quaternion();
  function aimHand(w) {
    body.getWorldQuaternion(qb); hand.parent.getWorldQuaternion(qp);
    qh.copy(qp).invert().multiply(qb).multiply(aimQ);
    hand.quaternion.slerp(qh, w);
  }
  const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const P3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const POLE = { bas: P3(-0.6, -0.8, -0.2), haut: P3(-0.7, 0.35, 0.55), avant: P3(-0.7, -0.5, 0.45) };
  // étapes de chaque geste : instant (0 → 1), point de la main, coude ; poids 0 au début et à la fin
  const KEYS = {
    pelle: [[0.35, P3(0.05, 0.55, -0.1), POLE.haut], [0.62, P3(0.12, -0.3, 0.5), POLE.bas]],
    lancer: [[0.42, P3(0.0, 0.42, -0.3), POLE.haut], [0.62, P3(0.05, 0.35, 0.52), POLE.avant]],
    pose: [[0.5, P3(0.1, -0.45, 0.42), POLE.bas]],
  };
  const tgt = V(), pole = V();
  function playArm(k, a) {
    const keys = KEYS[k], first = keys[0][0], last = keys[keys.length - 1][0];
    const w = a < first ? ease(a / first) : a > last ? 1 - ease((a - last) / (1 - last)) : 1;
    let i = 0;
    while (i < keys.length - 1 && a > keys[i + 1][0]) i++;
    if (a <= first || i === keys.length - 1) { tgt.copy(keys[i][1]); pole.copy(keys[i][2]); }
    else { const t = ease((a - keys[i][0]) / (keys[i + 1][0] - keys[i][0])); tgt.lerpVectors(keys[i][1], keys[i + 1][1], t); pole.lerpVectors(keys[i][2], keys[i + 1][2], t).normalize(); }
    reach(tgt, w, pole);
    return w;
  }
  // ce qu'on tient : arme du kit (dans le repère de la main), sinon le modèle du jeu dans le support
  function setItem(it, model3d) {
    if (held) { held.parent && held.parent.remove(held); held = null; }
    heldKind = it ? (it.t === 'arme' ? 'arme' : 'objet') : 'outil';
    if (it && it.t === 'arme' && kit.weapons[it.w]) {
      held = new THREE.Mesh(kit.weapons[it.w].hand, rarityMaterial(it.r));
      held.castShadow = true;
      hand.add(held);
    } else if (!it && kit.tool) {
      held = new THREE.Mesh(kit.tool.hand, rarityMaterial(0));
      held.castShadow = true;
      hand.add(held);
    } else if (model3d) {
      // repère de la main quand il épaule : on y pose l'objet debout, posé sur le poing (pas caché dedans)
      held = model3d;
      const aim = aimFrame(kit), inv = new THREE.Matrix4().copy(aim).transpose();
      const bb = new THREE.Box3().setFromObject(model3d), h = bb.max.y - bb.min.y;
      held.quaternion.setFromRotationMatrix(inv);
      const lift = new THREE.Vector3(0, 0.045 + h / 2 - (bb.max.y + bb.min.y) / 2, 0.03).applyMatrix4(inv);
      held.position.copy(lift);
      holder.add(held);
    }
    heldC = it && it.t === 'objet' ? it.c : null;
  }
  // geste du bras droit : 'pelle' (récolte), 'lancer' (grenade), 'pose' (tremplin, construction)
  const GESTURES = { pelle: 0.42, lancer: 0.5, pose: 0.4 };
  function gestureArm(kind) { arm = { kind, t: 0, T: GESTURES[kind] }; }

  function update(dt, st) {
    const gun = heldKind === 'arme';
    fly = damp(fly, st.mode === 'chute' ? 1 : 0, 4, dt);
    swim = damp(swim, st.swim ? 1 : 0, 6, dt);
    air = !st.ground && !st.swim ? air + dt : 0;
    glider.visible = st.mode === 'planeur';
    // état → animation
    if (st.alive === false) {
      play('Death', 0.12);
      deadT += dt;
      root.visible = deadT < 3;
    } else {
      deadT = 0; root.visible = true;
      const sp = st.speed || 0;
      if (st.mode === 'chute' || st.mode === 'planeur') play('Jump_Idle', 0.3);
      else if (st.swim) play(sp > 0.4 ? 'Run' : 'Jump_Idle', 0.25, sp > 0.4 ? 0.55 : 0.5);
      else if (air > 0.18) play('Jump_Idle', 0.15);
      else if (st.crouch) play('Duck', 0.15, sp > 0.4 ? 1.2 : 0.4);
      else if (sp > 0.5) play(gun ? 'Run_Gun' : 'Run', 0.15, clamp(sp / 5.6, 0.55, 1.45));
      else if (gun) play('Idle_Shoot', 0.18, 0);   // arme épaulée, immobile
      else play('Idle', 0.25);
    }
    // les os qu'on penche nous-mêmes reprennent la pose de l'animation avant chaque image (sinon ça s'accumule)
    if (torso) torso.quaternion.copy(baseTorso);
    if (neck) neck.quaternion.copy(baseNeck);
    if (upperArm) { upperArm.quaternion.copy(baseUpper); lowerArm.quaternion.copy(baseLower); hand.quaternion.copy(baseHand); }
    mixer.update(dt);
    if (torso) baseTorso.copy(torso.quaternion);
    if (neck) baseNeck.copy(neck.quaternion);
    if (upperArm) { baseUpper.copy(upperArm.quaternion); baseLower.copy(lowerArm.quaternion); baseHand.copy(hand.quaternion); }
    // le buste suit le regard (haut, bas) ; recul au tir
    kick = Math.max(0, kick - dt * 8);
    aimLift = damp(aimLift, st.alive === false || fly > 0.5 ? 0 : clamp(st.pitch || 0, -0.9, 0.9), 12, dt);
    if (torso) torso.quaternion.multiply(qx.setFromAxisAngle(X, -(aimLift * 0.55 + kick * 0.06)));
    if (neck) neck.quaternion.multiply(qx.setFromAxisAngle(X, -aimLift * 0.3));
    // gestes du bras droit (pris sur la pose de l'animation de cette image)
    clock += dt;
    const alive = st.alive !== false && fly < 0.5 && swim < 0.5;
    use = damp(use, alive && st.use ? 1 : 0, 9, dt);
    reload = damp(reload, alive && st.reload && gun ? 1 : 0, 10, dt);
    if (upperArm && lowerArm) {
      if (arm) {
        arm.t += dt;
        const a = arm.t / arm.T;
        if (a >= 1 || !alive) arm = null;
        else {
          const w = playArm(arm.kind, a);
          // le buste accompagne : on se penche en frappant ou en posant, on s'arme en lançant
          const lean = arm.kind === 'pelle' ? (a > 0.4 ? 0.3 : -0.1) : arm.kind === 'lancer' ? (a > 0.45 ? 0.2 : -0.15) : 0.4;
          if (torso) torso.quaternion.multiply(qx.setFromAxisAngle(X, lean * w));
        }
      }
      if (use > 0.01 && !arm) {
        // potion portée à la bouche, tête en arrière ; bandage et trousse : on soigne devant le buste, en tournant
        if (heldC === 'potion' || heldC === 'potion_petite') {
          reach(tgt.set(0.12, 0.08 + Math.sin(clock * 6) * 0.015, 0.34), use, POLE.avant);
          if (neck) neck.quaternion.multiply(qx.setFromAxisAngle(X, -0.3 * use));
        } else reach(tgt.set(0.22 + Math.cos(clock * 7) * 0.05, -0.18 + Math.sin(clock * 7) * 0.05, 0.36), use, POLE.bas, 0.4 * use);
      }
      // accroupi l'arme à la main : l'animation du kit (sans arme) la pointerait vers le sol ; on la garde en joue
      crouchGun = damp(crouchGun, alive && st.crouch && gun && !arm ? 1 - reload : 0, 10, dt);
      if (crouchGun > 0.01) { reach(tgt.set(0.06, 0.0, 0.6), crouchGun, POLE.bas); aimHand(crouchGun); }
      // rechargement : l'arme descend et pivote, petit à-coup au milieu
      if (reload > 0.01 && !arm) reach(tgt.set(0.08, -0.25, 0.4), reload, POLE.bas, (0.9 + 0.2 * Math.sin(clock * 9)) * reload);
    }
    // chute libre : à plat ventre ; nage : penché, à la surface
    body.rotation.x = fly * 1.2 + swim * 0.9;
    body.position.y = fly * 0.9 + swim * 0.55;
    if (held) held.visible = fly < 0.5 && swim < 0.5 && st.alive !== false;
  }
  return {
    root, update, setItem,
    // compatibilité avec view/hero.js
    setHeld(obj) { setItem(null, obj); },
    shot() {
      kick = 1;
      if (heldKind === 'outil') gestureArm('pelle');
      else if (heldKind === 'objet') gestureArm('lancer');
      else if (act.Idle_Shoot && curName === 'Idle_Shoot') { act.Idle_Shoot.time = 0; act.Idle_Shoot.timeScale = 1; setTimeout(() => { if (curName === 'Idle_Shoot') act.Idle_Shoot.timeScale = 0; }, 120); }
    },
    // gestes ponctuels : 'pelle', 'lancer', 'pose'
    gesture(kind) { if (GESTURES[kind]) gestureArm(kind); },
    get held() { return held; },
    dispose() { mixer.stopAllAction(); mat.dispose(); wingMat.dispose(); cableMat.dispose(); glider.traverse((o) => o.isMesh && o.geometry.dispose()); },
  };
}
