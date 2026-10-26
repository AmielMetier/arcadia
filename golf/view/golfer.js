// Birdie Party — le golfeur : un personnage tout simple (création originale) — grosse tête ronde, deux yeux,
// un buste, deux jambes et des mains rondes qui tiennent le club, sans bras. Repère local : il regarde +z (la balle),
// la cible est à sa gauche (+x). Le swing est une rotation des mains dans un plan incliné vers la balle,
// avec le cassé des poignets et la rotation du buste.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export const SKINS = [0xf6cfa8, 0xe9b98e, 0xc98f64, 0x8d5b3c, 0xffdcc4];
export const HAIRS = [0x4a3020, 0x2a211c, 0x8a5a2b, 0xd9a54a, 0x1c1c1f];
const easeIn = (t) => t * t * t;
const easeOut = (t) => 1 - (1 - t) ** 3;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export const BALL_OFFSET = { full: 0.86, putt: 0.56 };   // distance pieds → balle (m)

// géométries partagées entre tous les golfeurs
const GEO = {
  head: new THREE.SphereGeometry(0.27, 32, 24),
  hair: new THREE.SphereGeometry(0.285, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42),
  eye: new THREE.SphereGeometry(0.032, 12, 10),
  torso: new THREE.CapsuleGeometry(0.2, 0.26, 8, 18),
  leg: new THREE.CapsuleGeometry(0.075, 0.42, 6, 12),
  shoe: new THREE.SphereGeometry(0.09, 16, 10),
  hand: new THREE.SphereGeometry(0.065, 16, 12),
  shaft: new THREE.CylinderGeometry(0.011, 0.008, 1, 8).translate(0, -0.5, 0),
  grip: new THREE.CylinderGeometry(0.018, 0.015, 0.2, 8).translate(0, -0.06, 0),
  wood: new THREE.SphereGeometry(0.06, 18, 12),
  iron: new THREE.BoxGeometry(0.1, 0.055, 0.025),
  putter: new THREE.BoxGeometry(0.11, 0.035, 0.035),
};

export function buildGolfer({ shirt = 0xff4b2b, pants = 0xece2cf, skin = 0, hair = 0 } = {}) {
  const mats = [];
  const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.55, metalness: 0, ...o }); mats.push(m); return m; };
  const mShirt = M(shirt), mPants = M(pants), mSkin = M(SKINS[skin % SKINS.length], { roughness: 0.5 }), mHair = M(HAIRS[hair % HAIRS.length], { roughness: 0.7 });
  const mEye = M(0x1d1f26, { roughness: 0.25 }), mShoe = M(0x2b2e36);
  const mShaft = M(0xc9ced6, { metalness: 0.8, roughness: 0.25 }), mGrip = M(0x2a2c31), mHead = M(0x9aa1ab, { metalness: 0.85, roughness: 0.25 }), mWood = M(0x23252b, { metalness: 0.4, roughness: 0.3 });
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; return o; };

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  for (const sx of [-1, 1]) {
    const leg = mesh(GEO.leg, mPants); leg.position.set(0.11 * sx, 0.33, 0.02); body.add(leg);
    const shoe = mesh(GEO.shoe, mShoe); shoe.scale.set(0.95, 0.6, 1.4); shoe.position.set(0.11 * sx, 0.05, 0.06); body.add(shoe);
  }
  // buste incliné vers la balle ; twist porte la rotation du swing
  const spine = new THREE.Group(); spine.position.y = 0.6; spine.rotation.x = 0.38; body.add(spine);
  const twist = new THREE.Group(); spine.add(twist);
  const torso = mesh(GEO.torso, mShirt); torso.position.y = 0.3; twist.add(torso);
  const head = new THREE.Group(); head.position.set(0, 0.86, 0.02); head.rotation.x = 0.3; twist.add(head);
  head.add(mesh(GEO.head, mSkin));
  const hairM = mesh(GEO.hair, mHair); hairM.rotation.x = -0.35; head.add(hairM);
  for (const sx of [-1, 1]) { const e = mesh(GEO.eye, mEye); e.scale.set(0.8, 1.45, 0.5); e.position.set(0.085 * sx, 0.0, 0.255); head.add(e); }

  // plan du swing : part des épaules, incliné vers la balle ; les mains flottent au bout
  const plane = new THREE.Group(); root.add(plane);
  const pivot = new THREE.Group(); plane.add(pivot);
  const hands = new THREE.Group(); pivot.add(hands);
  for (const sx of [-1, 1]) { const h = mesh(GEO.hand, mSkin); h.position.set(0.035 * sx, 0.02 * sx, 0); hands.add(h); }
  const wrist = new THREE.Group(); pivot.add(wrist);
  const club = new THREE.Group(); wrist.add(club);
  const shaft = mesh(GEO.shaft, mShaft); club.add(shaft);
  club.add(mesh(GEO.grip, mGrip));
  const heads = { wood: mesh(GEO.wood, mWood), iron: mesh(GEO.iron, mHead), putter: mesh(GEO.putter, mHead) };
  heads.wood.scale.set(1.25, 0.75, 1.0);
  for (const k in heads) club.add(heads[k]);

  const st = { kind: 'iron', La: 0.5, Lc: 0.8, phi: 0, omega: 0, tw: 0, swing: null, idleT: Math.random() * 5, back: 0, celebrate: 0, sad: 0 };

  // ajuste les longueurs pour que la tête du club touche la balle à l'adresse
  function fit(kind) {
    st.kind = kind;
    const putt = kind === 'putter';
    spine.rotation.x = putt ? 0.52 : 0.38;
    const sy = 0.6 + 0.56 * Math.cos(spine.rotation.x), sz = 0.56 * Math.sin(spine.rotation.x);
    plane.position.set(0, sy, sz);
    const bz = putt ? BALL_OFFSET.putt : BALL_OFFSET.full, by = 0.03;
    const dy = sy - by, dz = bz - sz, L = Math.hypot(dy, dz);
    plane.rotation.x = -Math.atan2(dz, dy);
    st.La = putt ? 0.46 : 0.5; st.Lc = L - st.La;
    hands.position.y = -st.La; wrist.position.y = -st.La;
    shaft.scale.y = st.Lc;
    for (const k in heads) heads[k].visible = k === kind;
    heads[kind].position.set(kind === 'wood' ? 0.04 : 0.035, -st.Lc + (kind === 'wood' ? 0.03 : 0.02), 0);
  }
  fit('iron');

  function apply() {
    pivot.rotation.z = st.phi; wrist.rotation.z = st.omega;
    twist.rotation.y = st.tw; plane.rotation.y = st.tw * 0.55;
    body.rotation.y = st.tw * 0.12;
  }

  return {
    root,
    // place le golfeur à côté de la balle, la cible à sa gauche
    place(ball, aim, groundY, kind) {
      if (kind !== st.kind) fit(kind);
      const off = kind === 'putter' ? BALL_OFFSET.putt : BALL_OFFSET.full;
      const rx = -Math.cos(aim), rz = Math.sin(aim);
      root.position.set(ball.x - rx * off, groundY, ball.z - rz * off);
      root.rotation.y = aim - Math.PI / 2;
    },
    // spectateur : debout, club à la main, tourné vers un point
    stand(x, y, z, lookX, lookZ) {
      fit('iron');
      st.swing = null; st.back = 0; st.phi = 0.35; st.omega = 0.2; st.tw = 0;
      spine.rotation.x = 0.05; apply();
      root.position.set(x, y, z);
      root.rotation.y = Math.atan2(lookX - x, lookZ - z);
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
    reset() { st.swing = null; st.back = 0; st.phi = 0; st.omega = 0; st.tw = 0; st.celebrate = 0; st.sad = 0; body.position.y = 0; head.rotation.x = 0.3; fit(st.kind); apply(); },
    update(dt) {
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
        apply();
      } else if (st.back === 0 && !st.celebrate && !st.sad) {
        // petite respiration et waggle à l'adresse
        body.position.y = Math.sin(st.idleT * 2.2) * 0.006;
        if (spine.rotation.x > 0.2) { st.phi = Math.sin(st.idleT * 1.7) * 0.025; apply(); }
      }
      if (st.celebrate > 0) {
        st.celebrate -= dt;
        const k = st.celebrate;
        body.position.y = Math.abs(Math.sin(k * 7)) * 0.24 * Math.min(1, k);
        if (k <= 0) { st.celebrate = 0; body.position.y = 0; }
      }
      if (st.sad > 0) {
        st.sad -= dt;
        head.rotation.x = 0.3 + Math.min(1, st.sad) * 0.35 + Math.sin(st.idleT * 9) * 0.04 * Math.min(1, st.sad);
        if (st.sad <= 0) { st.sad = 0; head.rotation.x = 0.3; }
      }
    },
    setColors({ shirt: s, skin: k, hair: h }) {
      if (s != null) mShirt.color.set(s);
      if (k != null) mSkin.color.setHex(SKINS[k % SKINS.length]);
      if (h != null) mHair.color.setHex(HAIRS[h % HAIRS.length]);
    },
    dispose() { for (const m of mats) m.dispose(); },
  };
}
