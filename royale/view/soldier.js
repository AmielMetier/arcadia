// Le personnage : le soldat du « Toon Shooter Game Kit » (Quaternius, CC0), animé (repos, course, course arme en main,
// tir, accroupi, saut, chute, élimination, coup de pioche) et recoloré pour chaque joueur (uniforme à sa couleur,
// pantalon et teint variés). L'arme tenue est accrochée à sa main droite, à la rareté de sa couleur. Même façon de
// faire que view/hero.js (repère local : il regarde +z, pieds à l'origine), qui reste là si le kit ne charge pas.
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
  const baseTorso = torso ? torso.quaternion.clone() : null, baseNeck = neck ? neck.quaternion.clone() : null;
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
  let cur = null, curName = '', oneShot = null, oneT = 0;
  function play(name, fade = 0.18, scale = 1) {
    const a = act[name];
    if (!a) return;
    a.timeScale = scale;
    if (curName === name) return;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (cur) cur.fadeOut(fade);
    cur = a; curName = name;
  }
  // geste ponctuel (tir, coup de pioche) par-dessus l'animation en cours
  function gesture(name, dur) {
    const a = act[name];
    if (!a) return;
    a.reset().setEffectiveWeight(1).fadeIn(0.05).play();
    a.timeScale = a.getClip().duration / dur;
    oneShot = a; oneT = dur;
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

  let held = null, heldKind = null, fly = 0, swim = 0, deadT = 0, air = 0, kick = 0, aimLift = 0;
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
      held = model3d;
      held.scale.setScalar(0.85);
      held.position.set(0, 0, 0);
      holder.add(held);
    }
  }

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
    if (oneShot) { oneT -= dt; if (oneT <= 0) { oneShot.fadeOut(0.12); oneShot = null; } }
    // les os qu'on penche nous-mêmes reprennent la pose de l'animation avant chaque image (sinon ça s'accumule)
    if (torso) torso.quaternion.copy(baseTorso);
    if (neck) neck.quaternion.copy(baseNeck);
    mixer.update(dt);
    if (torso) baseTorso.copy(torso.quaternion);
    if (neck) baseNeck.copy(neck.quaternion);
    // le buste suit le regard (haut, bas) ; recul au tir
    kick = Math.max(0, kick - dt * 8);
    aimLift = damp(aimLift, st.alive === false || fly > 0.5 ? 0 : clamp(st.pitch || 0, -0.9, 0.9), 12, dt);
    if (torso) torso.quaternion.multiply(qx.setFromAxisAngle(X, -(aimLift * 0.55 + kick * 0.06)));
    if (neck) neck.quaternion.multiply(qx.setFromAxisAngle(X, -aimLift * 0.3));
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
      if (heldKind === 'outil' || heldKind === 'objet') gesture('Punch', 0.45);
      else if (act.Idle_Shoot && curName === 'Idle_Shoot') { act.Idle_Shoot.time = 0; act.Idle_Shoot.timeScale = 1; setTimeout(() => { if (curName === 'Idle_Shoot') act.Idle_Shoot.timeScale = 0; }, 120); }
    },
    get held() { return held; },
    dispose() { mixer.stopAllAction(); mat.dispose(); wingMat.dispose(); cableMat.dispose(); glider.traverse((o) => o.isMesh && o.geometry.dispose()); },
  };
}
