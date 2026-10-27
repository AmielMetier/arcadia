// Birdie Party — le golfeur (création originale) : un personnage de dessin animé complet, à la tête un peu grosse.
// Visage (yeux qui clignent, sourcils, nez, oreilles, sourire), coiffure ou casquette, polo à col, ceinture,
// pantalon, chaussures de golf et gant blanc à la main gauche. Repère local : il regarde +z (la balle), la cible
// est à sa gauche (+x). Le swing est une rotation des mains dans un plan incliné vers la balle, avec le cassé des
// poignets et la rotation du buste ; bras et jambes suivent à chaque image (deux segments, coude et genou placés
// entre l'épaule et la main, la hanche et la cheville).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export const SKINS = [0xf3c9a0, 0xe2ad7f, 0xc38a5c, 0x8a5636, 0xfbd9c0];
export const HAIRS = [0x4a3020, 0x2a211c, 0x8a5a2b, 0xd9a54a, 0x1c1c1f];
const PANTS = [0xe9dfc8, 0x2f3b55, 0x8d929b, 0xf4f1ea, 0xc9b48a];
const STYLES = ['cap', 'short', 'pony', 'visor', 'bob'];
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const BALL_OFFSET = { full: 0.86, putt: 0.56 };   // distance pieds → balle (m)
// proportions (m) : hanches, buste (hanches → épaules), demi-carrure, bras, jambes
const HIP = 0.92, SPINE = 0.5, SHO = 0.172, UPPER = 0.31, FORE = 0.3, THIGH = 0.41, SHIN = 0.4, ANKLE = 0.085;

// un même personnage d'une partie à l'autre : son allure vient de son nom
export function lookOf(name) {
  let h = 2166136261;
  for (const c of String(name || '')) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// segment de membre : cylindre de hauteur 1, posé de y = 0 (début) à y = 1 (bout) ; r0 au début, r1 au bout
const limb = (r0, r1, n = 12) => new THREE.CylinderGeometry(r1, r0, 1, n, 1, true).translate(0, 0.5, 0);
const ball = (r, w = 16, h = 12) => new THREE.SphereGeometry(r, w, h);
// buste : un tour (taille, poitrine, épaules arrondies jusqu'au cou), aplati d'avant en arrière
const torsoGeo = new THREE.LatheGeometry([[0.001, 0], [0.135, 0], [0.15, 0.08], [0.166, 0.2], [0.178, 0.32], [0.174, 0.4], [0.148, 0.465], [0.095, 0.51], [0.05, 0.525]].map(([r, y]) => new THREE.Vector2(r, y)), 22).scale(1, 1, 0.74);

// géométries partagées entre tous les golfeurs
const GEO = {
  skull: ball(0.135, 32, 24),
  ear: ball(0.03, 12, 10),
  nose: ball(0.022, 12, 10),
  eye: ball(0.026, 14, 10),
  pupil: ball(0.0145, 10, 8),
  brow: new THREE.BoxGeometry(0.042, 0.01, 0.012),
  mouth: new THREE.TorusGeometry(0.024, 0.006, 6, 14, Math.PI * 0.8).rotateZ(Math.PI * 0.1),
  neck: new THREE.CylinderGeometry(0.05, 0.056, 0.13, 14),
  torso: torsoGeo,
  collar: new THREE.TorusGeometry(0.062, 0.02, 8, 22),
  placket: new THREE.BoxGeometry(0.024, 0.075, 0.006),
  belt: new THREE.CylinderGeometry(0.142, 0.142, 0.036, 22).scale(1, 1, 0.76),
  buckle: new THREE.BoxGeometry(0.045, 0.03, 0.01),
  pelvis: ball(0.155, 20, 14),
  shoulder: ball(0.056, 16, 12),
  sleeve: limb(0.057, 0.052),
  upper: limb(0.047, 0.04),
  elbow: ball(0.04, 12, 10),
  fore: limb(0.04, 0.033),
  hand: ball(0.046, 16, 12),
  thigh: limb(0.08, 0.062, 14),
  knee: ball(0.062, 14, 10),
  shin: limb(0.06, 0.048, 14),
  shoe: ball(0.06, 16, 10),
  sole: new THREE.BoxGeometry(0.1, 0.016, 0.205),
  // coiffures : calotte (dessus et arrière du crâne), retombée sur la nuque et les côtés (le visage reste dégagé)
  hairTop: new THREE.SphereGeometry(0.143, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.44),
  hairBack: new THREE.SphereGeometry(0.146, 28, 12, Math.PI * 0.5 + 0.95, Math.PI * 2 - 1.9, Math.PI * 0.3, Math.PI * 0.33),
  bob: new THREE.SphereGeometry(0.152, 28, 14, Math.PI * 0.5 + 0.75, Math.PI * 2 - 1.5, Math.PI * 0.25, Math.PI * 0.45),
  pony: ball(0.05, 14, 12),
  band: new THREE.TorusGeometry(0.026, 0.009, 6, 12),
  crown: new THREE.SphereGeometry(0.148, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.38),
  button: ball(0.016, 8, 6),
  brim: new THREE.CylinderGeometry(0.105, 0.105, 0.012, 24, 1, false, -Math.PI / 2, Math.PI).scale(1, 1, 0.9),
  headband: new THREE.CylinderGeometry(0.146, 0.146, 0.034, 28, 1, true),
  // club
  shaft: new THREE.CylinderGeometry(0.011, 0.008, 1, 8).translate(0, -0.5, 0),
  grip: new THREE.CylinderGeometry(0.018, 0.015, 0.2, 8).translate(0, -0.06, 0),
  wood: new THREE.SphereGeometry(0.06, 18, 12),
  iron: new THREE.BoxGeometry(0.1, 0.055, 0.025),
  putter: new THREE.BoxGeometry(0.11, 0.035, 0.035),
};

const Y = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4();
// pose un segment (géométrie `limb`) de a à b
function seg(m, a, b) {
  _d.subVectors(b, a);
  const L = _d.length() || 1e-6;
  m.position.copy(a); m.quaternion.setFromUnitVectors(Y, _d.divideScalar(L)); m.scale.set(1, L, 1);
}
// deux segments de longueurs L1, L2 entre a et c, pliés vers pole : renvoie le point du milieu (coude, genou) dans out.
// Hors de portée, les deux segments s'allongent un peu plutôt que de laisser un trou.
function bend(a, c, L1, L2, pole, out) {
  _d.subVectors(c, a);
  const d = _d.length() || 1e-6, k = Math.max(1, d / (L1 + L2 - 1e-3)), l1 = L1 * k, l2 = L2 * k;
  const dc = clamp(d, Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
  _d.divideScalar(d);
  const x = (l1 * l1 - l2 * l2 + dc * dc) / (2 * dc), h = Math.sqrt(Math.max(0, l1 * l1 - x * x));
  _p.subVectors(pole, a); _p.addScaledVector(_d, -_p.dot(_d));
  if (_p.lengthSq() < 1e-8) _p.set(0, -1, 0);
  _p.normalize();
  return out.copy(a).addScaledVector(_d, x).addScaledVector(_p, h);
}

// shirt : couleur du polo ; look : allure (peau, cheveux, coiffure, pantalon), lookOf(nom) pour la garder d'une partie à l'autre
export function buildGolfer({ shirt = 0xff4b2b, look = 0 } = {}) {
  const skin = look % SKINS.length, hair = (look >>> 3) % HAIRS.length, style = STYLES[(look >>> 6) % STYLES.length], pants = PANTS[(look >>> 9) % PANTS.length];
  const mats = [];
  const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o }); mats.push(m); return m; };
  const mShirt = M(shirt), mPants = M(pants, { roughness: 0.75 }), mSkin = M(SKINS[skin], { roughness: 0.5 }), mHair = M(HAIRS[hair], { roughness: 0.8 });
  const mTrim = M(new THREE.Color(shirt).lerp(new THREE.Color(0xffffff), 0.3)), mCap = M(new THREE.Color(shirt).multiplyScalar(0.82), { roughness: 0.7 });
  const mWhite = M(0xf4f3ee, { roughness: 0.45 }), mPupil = M(0x1d1f26, { roughness: 0.2 }), mMouth = M(0x8a3a34, { roughness: 0.5 });
  const mBelt = M(0x2a2622, { roughness: 0.5 }), mBuckle = M(0xd8c27a, { metalness: 0.7, roughness: 0.3 }), mSole = M(0x5a4a3e, { roughness: 0.7 });
  const mShaft = M(0xc9ced6, { metalness: 0.8, roughness: 0.25 }), mGrip = M(0x2a2c31), mHead = M(0x9aa1ab, { metalness: 0.85, roughness: 0.25 }), mWood = M(0x23252b, { metalness: 0.4, roughness: 0.3 });
  const mesh = (g, m, parent, shadow = true) => { const o = new THREE.Mesh(g, m); o.castShadow = shadow; if (parent) parent.add(o); return o; };
  const at = (o, x, y, z) => { o.position.set(x, y, z); return o; };

  const root = new THREE.Group();
  const lift = new THREE.Group(); root.add(lift);           // saut de joie
  const body = new THREE.Group(); lift.add(body);           // rotation des hanches pendant le swing
  // buste incliné vers la balle ; twist porte la rotation du swing
  const spine = new THREE.Group(); body.add(spine);
  at(mesh(GEO.pelvis, mPants, spine), 0, -0.03, -0.01).scale.set(1, 0.72, 0.8);
  at(mesh(GEO.belt, mBelt, spine), 0, 0.035, 0);
  at(mesh(GEO.buckle, mBuckle, spine, false), 0, 0.035, 0.108);
  const twist = new THREE.Group(); spine.add(twist);
  at(mesh(GEO.torso, mShirt, twist), 0, 0.03, 0);
  at(mesh(GEO.placket, mTrim, twist, false), 0, 0.475, 0.112).rotation.x = -0.34;
  const collar = at(mesh(GEO.collar, mShirt, twist), 0, SPINE + 0.045, 0.006); collar.rotation.x = Math.PI / 2 + 0.25; collar.scale.set(1, 0.85, 1);
  at(mesh(GEO.neck, mSkin, twist), 0, SPINE + 0.07, 0.012);
  const shoulders = [-1, 1].map((sx) => { const o = at(new THREE.Object3D(), sx * SHO, SPINE - 0.05 - (sx < 0 ? 0.04 : 0), 0); twist.add(o); at(mesh(GEO.shoulder, mShirt, twist), sx * SHO * 0.86, SPINE - 0.06 - (sx < 0 ? 0.03 : 0), 0); return o; });
  // les coudes se plient vers les hanches, un peu en arrière
  const elbowPoles = [-1, 1].map((sx) => { const o = at(new THREE.Object3D(), sx * 0.36, -0.05, -0.12); twist.add(o); return o; });

  // tête
  const head = new THREE.Group(); at(head, 0, SPINE + 0.215, 0.03); twist.add(head);
  mesh(GEO.skull, mSkin, head).scale.set(1, 1.07, 1.02);
  // cheveux et casquette suivent la forme du crâne
  const scalp = new THREE.Group(); scalp.scale.set(1, 1.07, 1.02); head.add(scalp);
  for (const sx of [-1, 1]) at(mesh(GEO.ear, mSkin, head, false), sx * 0.132, -0.012, -0.005).scale.set(0.55, 1, 0.8);
  at(mesh(GEO.nose, mSkin, head, false), 0, -0.022, 0.135).scale.set(0.9, 1, 1.15);
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = new THREE.Group(); at(e, sx * 0.047, 0.018, 0.118); head.add(e);
    mesh(GEO.eye, mWhite, e, false).scale.set(1, 1.25, 0.6);
    at(mesh(GEO.pupil, mPupil, e, false), sx * -0.003, -0.002, 0.014).scale.set(1, 1.15, 0.6);
    eyes.push(e);
    const b = at(mesh(GEO.brow, mHair, head, false), sx * 0.049, 0.062, 0.116); b.rotation.set(-0.3, 0, sx * -0.14);
  }
  const mouth = at(mesh(GEO.mouth, mMouth, head, false), 0, -0.058, 0.121); mouth.rotation.set(-0.4, 0, Math.PI);
  // coiffure
  const hairTop = (lower = 0) => { const o = mesh(GEO.hairTop, mHair, scalp); o.rotation.x = -0.32 - lower; return o; };
  if (style === 'cap') {
    hairTop(0.12);
    at(mesh(GEO.hairBack, mHair, scalp), 0, 0, 0);
    const crown = mesh(GEO.crown, mCap, scalp); crown.rotation.x = -0.12;
    at(mesh(GEO.button, mCap, scalp, false), 0, 0.148, -0.02);
    const brim = at(mesh(GEO.brim, mCap, scalp), 0, 0.055, 0.105); brim.rotation.x = 0.12;
  } else if (style === 'visor') {
    hairTop(); at(mesh(GEO.hairBack, mHair, scalp), 0, 0, 0);
    const band = at(mesh(GEO.headband, mCap, scalp), 0, 0.052, 0); band.rotation.x = -0.16; band.scale.set(1, 1, 1.03);
    const brim = at(mesh(GEO.brim, mCap, scalp), 0, 0.045, 0.112); brim.rotation.x = 0.1;
  } else if (style === 'pony') {
    hairTop(); at(mesh(GEO.hairBack, mHair, scalp), 0, 0, 0);
    at(mesh(GEO.pony, mHair, scalp), 0, -0.02, -0.17).scale.set(0.85, 1.7, 0.85);
    const b = at(mesh(GEO.band, mCap, scalp, false), 0, 0.045, -0.15); b.rotation.x = 1.2;
  } else if (style === 'bob') {
    hairTop(); mesh(GEO.bob, mHair, scalp);
  } else {
    hairTop(); at(mesh(GEO.hairBack, mHair, scalp), 0, 0.01, 0).scale.set(1, 0.9, 1);
  }

  // bras : épaule → coude → main, les manches courtes du polo par-dessus
  const arms = shoulders.map(() => ({ sleeve: mesh(GEO.sleeve, mShirt, lift), upper: mesh(GEO.upper, mSkin, lift), elbow: mesh(GEO.elbow, mSkin, lift, false), fore: mesh(GEO.fore, mSkin, lift) }));
  // jambes : hanche → genou → cheville ; les pieds restent posés
  const hips = [-1, 1].map((sx) => { const o = at(new THREE.Object3D(), sx * 0.095, -0.04, 0); spine.add(o); return o; });
  const legs = [-1, 1].map((sx) => {
    const foot = new THREE.Group(); lift.add(foot);
    at(mesh(GEO.shoe, mWhite, foot), 0, 0.005, 0.045).scale.set(0.98, 0.62, 1.75);
    at(mesh(GEO.sole, mSole, foot), 0, -0.035, 0.04);
    foot.rotation.y = sx * 0.22;
    return { sx, foot, ankle: new THREE.Vector3(), thigh: mesh(GEO.thigh, mPants, lift), knee: mesh(GEO.knee, mPants, lift, false), shin: mesh(GEO.shin, mPants, lift) };
  });

  // plan du swing : part des épaules, incliné vers la balle ; les mains tiennent le club au bout
  const plane = new THREE.Group(); lift.add(plane);
  const pivot = new THREE.Group(); plane.add(pivot);
  const wrist = new THREE.Group(); pivot.add(wrist);
  const club = new THREE.Group(); wrist.add(club);
  const shaft = mesh(GEO.shaft, mShaft, club);
  mesh(GEO.grip, mGrip, club);
  // main gauche gantée en haut du grip, main droite juste dessous
  const hands = [at(mesh(GEO.hand, mSkin, club), 0, -0.078, 0.004), at(mesh(GEO.hand, mWhite, club), 0, 0.0, 0.004)];
  for (const h of hands) h.scale.set(0.95, 1.3, 1.05);
  const heads = { wood: mesh(GEO.wood, mWood), iron: mesh(GEO.iron, mHead), putter: mesh(GEO.putter, mHead) };
  heads.wood.scale.set(1.25, 0.75, 1.0);
  for (const k in heads) club.add(heads[k]);

  const st = { kind: 'iron', mode: 'address', La: 0.55, Lc: 0.88, tilt: 0.42, hip: 0.85, phi: 0, omega: 0, tw: 0, swing: null, idleT: Math.random() * 5, blinkT: 2 + Math.random() * 3, back: 0, celebrate: 0, sad: 0 };

  // posture : à l'adresse (genoux fléchis, buste penché, longueurs ajustées pour que la tête du club touche la balle),
  // ou debout en spectateur, appuyé sur son club
  function fit(kind, mode = 'address') {
    st.kind = kind; st.mode = mode;
    const putt = kind === 'putter', stand = mode === 'stand';
    st.tilt = stand ? 0.06 : putt ? 0.55 : 0.42; st.hip = stand ? HIP - 0.01 : putt ? 0.84 : 0.85;
    spine.position.y = st.hip; spine.rotation.x = st.tilt;
    const sy = st.hip + SPINE * Math.cos(st.tilt), sz = SPINE * Math.sin(st.tilt);
    for (const L of legs) L.ankle.set(L.sx * (stand ? 0.12 : putt ? 0.15 : 0.2), ANKLE, stand ? 0 : 0.02);
    if (stand) {
      // mains devant les hanches, club vertical posé au sol devant les pieds
      plane.position.set(0, sy - 0.04, sz + 0.03); plane.rotation.x = -0.1;
      st.La = 0.5; st.Lc = 0.88;
    } else {
      plane.position.set(0, sy - 0.03, sz);
      const bz = putt ? BALL_OFFSET.putt : BALL_OFFSET.full, by = 0.03;
      const dy = plane.position.y - by, dz = bz - sz, L = Math.hypot(dy, dz);
      plane.rotation.x = -Math.atan2(dz, dy);
      st.La = putt ? 0.5 : 0.55; st.Lc = L - st.La;
    }
    wrist.position.y = -st.La;
    shaft.scale.y = st.Lc;
    for (const k in heads) heads[k].visible = k === kind;
    heads[kind].position.set(kind === 'wood' ? 0.04 : 0.035, -st.Lc + (kind === 'wood' ? 0.03 : 0.02), 0);
    head.rotation.set(stand ? 0.18 : 0.3, 0, 0);
  }
  fit('iron');

  const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3(), P = new THREE.Vector3();
  const inLift = (o, v) => v.setFromMatrixPosition(o.matrixWorld).applyMatrix4(_m);
  // bras et jambes : recalculés après chaque changement de pose
  function limbs() {
    root.updateMatrixWorld(true);
    _m.copy(lift.matrixWorld).invert();
    for (let i = 0; i < 2; i++) {
      inLift(shoulders[i], A); inLift(hands[i], C); inLift(elbowPoles[i], P);
      bend(A, C, UPPER, FORE, P, B);
      const a = arms[i];
      seg(a.upper, A, B); seg(a.fore, B, C); a.elbow.position.copy(B);
      seg(a.sleeve, A, P.lerpVectors(A, B, 0.42));
    }
    for (const L of legs) {
      inLift(hips[(L.sx + 1) / 2], A);
      L.foot.position.copy(L.ankle);
      // les genoux avancent au-dessus des pointes de pied
      P.set(L.sx * 0.16, (A.y + L.ankle.y) / 2, 0.6);
      bend(A, L.ankle, THIGH, SHIN, P, B);
      seg(L.thigh, A, B); seg(L.shin, B, L.ankle); L.knee.position.copy(B);
    }
  }
  function apply() {
    pivot.rotation.z = st.phi; wrist.rotation.z = st.omega;
    twist.rotation.y = st.tw; plane.rotation.y = st.tw * 0.55;
    body.rotation.y = st.tw * 0.14;
    limbs();
  }
  apply();

  return {
    root,
    // place le golfeur à côté de la balle, la cible à sa gauche
    place(ball, aim, groundY, kind) {
      if (kind !== st.kind || st.mode !== 'address') fit(kind);
      const off = kind === 'putter' ? BALL_OFFSET.putt : BALL_OFFSET.full;
      const rx = -Math.cos(aim), rz = Math.sin(aim);
      root.position.set(ball.x - rx * off, groundY, ball.z - rz * off);
      root.rotation.y = aim - Math.PI / 2;
      apply();
    },
    // spectateur : debout, appuyé sur son club, tourné vers un point
    stand(x, y, z, lookX, lookZ) {
      fit('iron', 'stand');
      st.swing = null; st.back = 0; st.phi = 0; st.omega = 0.2; st.tw = 0;
      root.position.set(x, y, z);
      root.rotation.y = Math.atan2(lookX - x, lookZ - z);
      apply();
    },
    // armé du swing : b de 0 à ~1,15 (au-delà de 1 : trop armé)
    setBack(b) {
      st.back = b; st.swing = null;
      const putt = st.kind === 'putter';
      st.phi = -b * (putt ? 0.5 : 2.05); st.omega = putt ? 0 : -clamp(b * 1.6, 0, 1.25); st.tw = -b * (putt ? 0.08 : 0.85);
      apply();
    },
    // lance l'animation de descente ; renvoie la durée jusqu'à l'impact (s)
    release() {
      st.swing = { t: 0, phi0: st.phi, om0: st.omega, tw0: st.tw };
      return st.kind === 'putter' ? 0.22 : 0.17;
    },
    cheer() { st.celebrate = 1.8; st.sad = 0; },
    sulk() { st.sad = 1.6; },
    reset() {
      st.swing = null; st.back = 0; st.phi = 0; st.omega = 0; st.tw = 0; st.celebrate = 0; st.sad = 0;
      lift.position.y = 0; body.position.y = 0; fit(st.kind); apply();
    },
    update(dt) {
      if (!root.visible) return;
      st.idleT += dt;
      if (st.swing) {
        const s = st.swing, putt = st.kind === 'putter';
        s.t += dt;
        const T1 = putt ? 0.22 : 0.17, T2 = putt ? 0.45 : 0.55;
        if (s.t < T1) {
          const u = easeIn(s.t / T1);
          st.phi = s.phi0 * (1 - u); st.omega = s.om0 * (1 - u); st.tw = s.tw0 * (1 - u);
        } else {
          const u = easeOut(clamp((s.t - T1) / T2, 0, 1));
          st.phi = (putt ? 0.45 : 2.35) * u; st.omega = (putt ? 0 : 1.1) * u; st.tw = (putt ? 0.08 : 1.05) * u;
        }
      } else if (st.back === 0 && !st.celebrate && !st.sad) {
        // petite respiration ; à l'adresse, le club bouge un peu (waggle)
        body.position.y = Math.sin(st.idleT * 2.2) * 0.005;
        if (st.mode === 'address') st.phi = Math.sin(st.idleT * 1.7) * 0.025;
        else head.rotation.y = Math.sin(st.idleT * 0.6) * 0.25;
      }
      if (st.celebrate > 0) {
        st.celebrate -= dt;
        const k = st.celebrate;
        lift.position.y = Math.abs(Math.sin(k * 7)) * 0.22 * Math.min(1, k);
        if (k <= 0) { st.celebrate = 0; lift.position.y = 0; }
      }
      if (st.sad > 0) {
        st.sad -= dt;
        const k = Math.min(1, st.sad);
        head.rotation.x = 0.3 + k * 0.38 + Math.sin(st.idleT * 9) * 0.04 * k;
        spine.rotation.x = st.tilt + k * 0.12;
        if (st.sad <= 0) { st.sad = 0; head.rotation.x = 0.3; spine.rotation.x = st.tilt; }
      }
      // clignement des yeux de temps en temps
      st.blinkT -= dt;
      const shut = st.blinkT < 0.12;
      for (const e of eyes) e.scale.y = shut ? 0.12 : 1;
      if (st.blinkT <= 0) st.blinkT = 2.2 + Math.random() * 3.5;
      apply();
    },
    dispose() { for (const m of mats) m.dispose(); },
  };
}
