// Le personnage : le soldat du « Toon Shooter Game Kit » (Quaternius, CC0), animé (repos, course, course arme en main,
// tir, accroupi, saut, chute, élimination) et recoloré pour chaque joueur (uniforme à sa couleur, pantalon et teint
// variés). L'arme tenue est accrochée à sa main droite, à la rareté de sa couleur ; les autres objets sont tenus
// au-dessus du poing, redressés. Par-dessus les animations du kit, des gestes du bras droit faits ici : coup de pelle,
// lancer de grenade, pose (tremplin, construction), soin (bandage ou trousse devant le buste, potion portée à la
// bouche) et rechargement (l'arme baisse et pivote). Même façon de faire que view/hero.js (repère local : il regarde
// +z, pieds à l'origine), qui reste là si le kit ne charge pas.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { cloneSkinned, tintMaterial, GUN_FIT } from './kit.js';
import { RARITY } from '../engine/items.js';
import { buildGlider } from './glider.js';

const HEIGHT = 1.8;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rarityMats = new Map();
export function rarityMaterial(r) {
  if (!rarityMats.has(r)) rarityMats.set(r, tintMaterial({ 4: { color: new THREE.Color(RARITY[r].color), mix: r === 0 ? 0.15 : 0.6 } }, { metalness: 0.2, roughness: 0.55 }));
  return rarityMats.get(r);
}

// mesure une fois la taille et l'orientation du modèle (pour le ramener à 1,8 m, pieds au sol, regard vers +z)
function calibrate(S) {
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
  m.rotation.y = calibrate(S).yaw;
  m.updateMatrixWorld(true);
  const q = new THREE.Quaternion();
  m.getObjectByName('Index1R').matrixWorld.decompose(new THREE.Vector3(), q, new THREE.Vector3());
  S.aim = new THREE.Matrix4().makeRotationFromQuaternion(q);
  return S.aim;
}

// arme tenue : l'arme détaillée de sa rareté si elle existe (géométrie dans le repère de la main, canon déjà dans l'axe
// du regard : pas de correction), sinon celle du kit. La main (l'index) se cale 3,5 cm derrière la détente et 2 cm
// dessous ; l'axe de l'arme reste celui de l'arme du kit
const hands = new Map();
export function weaponHand(kit, w, r = 0) {
  const tier = r >= 2 ? 1 : 0, key = w + tier;
  if (hands.has(key)) return hands.get(key);
  const old = kit.weapons[w] ? kit.weapons[w].hand : null, canon = kit.guns && kit.guns[w] && kit.guns[w][tier], F = GUN_FIT[w];
  let out = { geo: old, fix: old ? barrelFix(kit, w) : new THREE.Quaternion() };
  if (canon && old && F && kit.weapons.fusil) {
    const aim = aimFrame(kit), box = (ww) => {
      const o = kit.weapons[ww].hand.clone().applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(barrelFix(kit, ww))).applyMatrix4(aim);
      o.computeBoundingBox(); const b = o.boundingBox.clone(); o.dispose(); return b;
    };
    const ob = box(w), ref = box('fusil').getSize(new THREE.Vector3()).z;
    const k = ref * F.len, m = 0.95 * F.len, [tz, ty0] = F.trig[tier], ty = ty0 * 1.35;
    const g = canon.clone().scale(k, k, k);
    g.translate((ob.min.x + ob.max.x) / 2, -(ty - 0.02 / m) * k, -(tz - 0.035 / m) * k).applyMatrix4(aim.clone().invert());
    g.computeBoundingBox(); g.computeBoundingSphere();
    out = { geo: g, fix: new THREE.Quaternion() };
  }
  hands.set(key, out);
  return out;
}

// les armes du kit ne sont pas toutes posées pareil dans la main : rotation (repère de la main, autour de la poignée)
// qui couche le canon dans l'axe du regard quand il épaule. Axe du canon : direction principale des sommets (de la
// poignée vers la bouche)
const fixes = new Map();
export function barrelFix(kit, w) {
  if (fixes.has(w)) return fixes.get(w);
  const g = kit.weapons[w].hand, aim = aimFrame(kit), P = g.attributes.position, v = new THREE.Vector3();
  const pts = [];
  for (let i = 0; i < P.count; i += Math.max(1, Math.floor(P.count / 2000))) pts.push(v.fromBufferAttribute(P, i).applyMatrix4(aim).clone());
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector3()).multiplyScalar(1 / pts.length);
  // direction principale (méthode des puissances sur la covariance)
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of pts) { const d = [p.x - c.x, p.y - c.y, p.z - c.z]; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) C[i][j] += d[i] * d[j]; }
  let a = new THREE.Vector3(0, 0, 1);
  for (let k = 0; k < 30; k++) a = new THREE.Vector3(C[0][0] * a.x + C[0][1] * a.y + C[0][2] * a.z, C[1][0] * a.x + C[1][1] * a.y + C[1][2] * a.z, C[2][0] * a.x + C[2][1] * a.y + C[2][2] * a.z).normalize();
  if (a.z < 0) a.negate();
  const qc = new THREE.Quaternion().setFromUnitVectors(a, new THREE.Vector3(0, 0, 1));
  const qa = new THREE.Quaternion().setFromRotationMatrix(aim);
  const fix = qa.clone().invert().multiply(qc).multiply(qa);
  fixes.set(w, fix);
  return fix;
}

// sphère englobante du personnage dans le repère de son maillage, élargie pour les bras tendus et l'arme
function boundSphere(mesh) {
  const g = mesh.geometry;
  if (!g.boundingSphere) g.computeBoundingSphere();
  const sp = g.boundingSphere.clone();
  sp.radius *= 1.6;
  return sp;
}

// portraits des personnages (écran d'accueil), à la couleur choisie ; un seul rendu réutilisé
let portraitR = null;
export function renderPortraits(kit, color) {
  const out = {};
  if (!kit || !kit.chars) return out;
  try { portraitR = portraitR || new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true }); } catch (e) { return out; }
  const r = portraitR;
  r.setPixelRatio(1); r.setSize(132, 150, false); r.setClearColor(0x000000, 0); r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x50586a, 2.3));
  const sun = new THREE.DirectionalLight(0xffffff, 2.2); sun.position.set(2, 3, 4); scene.add(sun);
  const cam = new THREE.PerspectiveCamera(28, 132 / 150, 0.1, 20); cam.position.set(1.0, 1.5, 3.4); cam.lookAt(0, 1.0, 0);
  for (const k of Object.keys(kit.chars)) {
    const h = buildSoldier(kit, { shirt: color, look: k });
    h.root.rotation.y = 0.35;
    h.update(0.016, { speed: 0, ground: true, mode: 'sol', alive: true, pitch: 0 });
    scene.add(h.root); r.render(scene, cam); out[k] = r.domElement.toDataURL();
    scene.remove(h.root); h.dispose();
  }
  return out;
}

export function buildSoldier(kit, { shirt = 0xff4b2b, pants = 0x3a3f4a, skin = 0xc98f64, items, look = 'soldat' } = {}) {
  const S = (kit.chars && kit.chars[look]) || kit.soldier, cal = calibrate(S);
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const model = cloneSkinned(S.tmpl);
  model.scale.multiplyScalar(cal.k); model.position.y = cal.y; model.rotation.y = cal.yaw;
  body.add(model);
  let mesh = null;
  model.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  const mat = tintMaterial({ 1: { color: new THREE.Color(shirt), mix: 0.82 }, 2: { color: new THREE.Color(pants), mix: 1 }, 3: { color: new THREE.Color(skin), mix: 1 } });
  // hors du champ, on ne le dessine pas : une sphère englobante fixe, assez large pour toutes les poses (le calcul
  // exact, os par os, coûterait plus cher que le dessin)
  mesh.material = mat; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.boundingSphere = (S.sphere || (S.sphere = boundSphere(mesh))).clone();
  const hand = model.getObjectByName('Index1R'), torso = model.getObjectByName('Torso'), neck = model.getObjectByName('Neck');
  const upperArm = model.getObjectByName('UpperArmR'), lowerArm = model.getObjectByName('LowerArmR');
  // les deux bras (main droite : l'index qui porte l'arme ; main gauche : celle qui tient le garde-main)
  const ARMS = {
    R: { up: upperArm, low: lowerArm, end: hand },
    L: { up: model.getObjectByName('UpperArmL'), low: model.getObjectByName('LowerArmL'), end: model.getObjectByName('Index1L') },
  };
  const armsOk = !!(ARMS.R.up && ARMS.R.low && ARMS.L.up && ARMS.L.low && ARMS.L.end);
  // os qu'on tourne nous-mêmes : ils reprennent la pose de l'animation avant chaque image (sinon ça s'accumule)
  const posed = [torso, neck, upperArm, lowerArm, hand, ARMS.L.up, ARMS.L.low, ARMS.L.end].filter(Boolean);
  const base = posed.map((b) => b.quaternion.clone());
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

  // ---------------------------------------------------------------- deltaplane de la descente (view/glider.js)
  const glider = buildGlider(shirt); root.add(glider.root);
  let trailsIn = false, glide = 0;
  const POLE_UP = { R: new THREE.Vector3(-0.9, -0.3, -0.1), L: new THREE.Vector3(0.9, -0.3, -0.1) };

  let held = null, heldKind = null, heldC = null, fly = 0, swim = 0, deadT = 0, air = 0, kick = 0, aimLift = 0;
  let arm = null, use = 0, reload = 0, hold = 0, clock = 0, heldW = null;
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
  // target : point du repère du corps depuis l'épaule (ou point du monde si world) ; side : 'R' ou 'L'
  function reach(target, w, pole, roll = 0, side = 'R', world = false) {
    if (w <= 0.002) return;
    const A = ARMS[side], upperArm = A.up, lowerArm = A.low, hand = A.end;
    body.getWorldQuaternion(qb);
    upperArm.getWorldPosition(S0); lowerArm.getWorldPosition(E0); hand.getWorldPosition(H0);
    const L1 = S0.distanceTo(E0), L2 = E0.distanceTo(H0);
    if (world) T.copy(target); else T.copy(target).applyQuaternion(qb).add(S0);
    T.sub(H0).multiplyScalar(w).add(H0);
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
  // l'arme tenue pointe dans l'axe du regard (orientation de la main quand il épaule, inclinée de pitch)
  const aimQ = new THREE.Quaternion().setFromRotationMatrix(aimFrame(kit)), qh = new THREE.Quaternion(), qpi = new THREE.Quaternion();
  function aimHand(w, pitch = 0) {
    body.getWorldQuaternion(qb); hand.parent.getWorldQuaternion(qp);
    qh.copy(qp).invert().multiply(qb).multiply(qpi.setFromAxisAngle(X, -pitch)).multiply(aimQ);
    hand.quaternion.slerp(qh, w);
  }
  // tenue de chaque arme : main droite (depuis l'épaule droite, repère du corps), main gauche à `l` m devant elle
  // le long de l'arme et `ld` m plus bas (garde-main) ; le pistolet se tient à deux mains, le lance-roquettes à l'épaule
  const HOLD = {
    fusil: { r: [-0.03, -0.24, 0.34], l: 0.34, ld: 0.04 }, pompe: { r: [-0.03, -0.24, 0.34], l: 0.36, ld: 0.04 },
    smg: { r: [-0.02, -0.22, 0.32], l: 0.2, ld: 0.05 }, sniper: { r: [-0.03, -0.22, 0.34], l: 0.42, ld: 0.04 },
    pistolet: { r: [0.06, -0.14, 0.44], l: 0.0, ld: 0.06 }, roquette: { r: [-0.03, -0.14, 0.2], l: 0.32, ld: 0.06 },
  };
  const POLE_L = new THREE.Vector3(0.6, -0.8, -0.2), gf = V(), gd = V();
  function holdGun(w, pitch, k) {
    const H = HOLD[heldW] || HOLD.fusil;
    // main droite devant l'épaule, l'arme dans l'axe du regard ; recul au tir
    tgt.set(H.r[0], H.r[1], H.r[2] - 0.05 * k).applyAxisAngle(X, -pitch);
    reach(tgt, w, POLE.bas);
    aimHand(w, pitch + 0.1 * k);
    // main gauche sur le garde-main
    body.getWorldQuaternion(qb);
    gf.set(0, 0, 1).applyAxisAngle(X, -pitch).applyQuaternion(qb);
    gd.set(0, -1, 0).applyQuaternion(qb);
    hand.getWorldPosition(T2).addScaledVector(gf, H.l).addScaledVector(gd, H.ld);
    reach(T2, w, POLE_L, 0, 'L', true);
  }
  const T2 = V();
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
    heldW = it && it.t === 'arme' ? it.w : null;
    if (it && it.t === 'arme' && kit.weapons[it.w]) {
      const W = weaponHand(kit, it.w, it.r);
      held = new THREE.Mesh(W.geo, rarityMaterial(it.r));
      held.quaternion.copy(W.fix);
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
    glider.update(dt, st.mode === 'planeur' && st.alive !== false, root.rotation.y, st.far || 0);
    if (!trailsIn && root.parent) { for (const l of glider.trails) root.parent.add(l); trailsIn = true; }
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
    posed.forEach((b, i) => b.quaternion.copy(base[i]));
    mixer.update(dt);
    posed.forEach((b, i) => base[i].copy(b.quaternion));
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
    if (armsOk) {
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
      // arme à la main : tenue à deux mains, épaulée dans l'axe du regard (debout, en courant, accroupi, en l'air) ;
      // les animations du kit la tiennent d'une main, à bout de bras ou vers le sol
      hold = damp(hold, alive && gun && !arm ? 1 - reload : 0, 12, dt);
      if (hold > 0.01) holdGun(hold, aimLift, kick);
      // rechargement : l'arme descend et pivote, petit à-coup au milieu
      if (reload > 0.01 && !arm) reach(tgt.set(0.08, -0.25, 0.4), reload, POLE.bas, (0.9 + 0.2 * Math.sin(clock * 9)) * reload);
      // deltaplane : les deux mains sur la barre de contrôle, au-dessus de la tête
      glide = damp(glide, st.mode === 'planeur' && st.alive !== false ? 1 : 0, 8, dt);
      if (glide > 0.01) {
        root.updateMatrixWorld(true);
        reach(glider.bar(-1, T2), glide, POLE_UP.R, 0, 'R', true);
        reach(glider.bar(1, T2), glide, POLE_UP.L, 0, 'L', true);
      }
    }
    // chute libre : à plat ventre ; nage : penché, à la surface
    body.rotation.x = fly * 1.2 + swim * 0.9;
    body.position.y = fly * 0.9 + swim * 0.55;
    if (held) held.visible = fly < 0.5 && swim < 0.5 && glide < 0.5 && st.alive !== false;
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
    dispose() { mixer.stopAllAction(); mat.dispose(); glider.dispose(); },
  };
}
