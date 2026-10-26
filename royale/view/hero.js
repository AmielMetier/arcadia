// Le personnage : même famille que les golfeurs de Birdie Party (grosse tête ronde, deux yeux, buste, deux jambes,
// mains rondes qui flottent sans bras), avec un sac à dos. Animé à partir de son état : course, sprint, accroupi,
// saut, nage. Repère local : il regarde +z ; les pieds sont à l'origine.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export const SKINS = [0xf6cfa8, 0xe9b98e, 0xc98f64, 0x8d5b3c, 0xffdcc4];
export const HAIRS = [0x4a3020, 0x2a211c, 0x8a5a2b, 0xd9a54a, 0x1c1c1f];
const GEO = {
  head: new THREE.SphereGeometry(0.27, 28, 20),
  hair: new THREE.SphereGeometry(0.285, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.42),
  eye: new THREE.SphereGeometry(0.032, 10, 8),
  torso: new THREE.CapsuleGeometry(0.2, 0.26, 8, 16),
  leg: new THREE.CapsuleGeometry(0.075, 0.38, 6, 10).translate(0, -0.25, 0),
  shoe: new THREE.SphereGeometry(0.09, 14, 10),
  hand: new THREE.SphereGeometry(0.068, 14, 10),
  pack: new THREE.BoxGeometry(0.34, 0.4, 0.18),
  flap: new THREE.BoxGeometry(0.36, 0.12, 0.2),
};
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

export function buildHero({ shirt = 0xff4b2b, pants = 0x2f3646, skin = 0, hair = 0, pack = 0x6b4a32 } = {}) {
  const mats = [];
  const M = (c, o = {}) => { const m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, metalness: 0, ...o }); mats.push(m); return m; };
  const mShirt = M(shirt), mPants = M(pants), mSkin = M(SKINS[skin % SKINS.length], { roughness: 0.5 }), mHair = M(HAIRS[hair % HAIRS.length], { roughness: 0.7 });
  const mEye = M(0x1d1f26, { roughness: 0.25 }), mShoe = M(0x2b2e36), mPack = M(pack, { roughness: 0.8 });
  const mesh = (g, m) => { const o = new THREE.Mesh(g, m); o.castShadow = true; return o; };

  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const hips = new THREE.Group(); hips.position.y = 0.62; body.add(hips);
  const legs = [-1, 1].map((sx) => {
    const pivot = new THREE.Group(); pivot.position.set(0.11 * sx, 0, 0.0); hips.add(pivot);
    pivot.add(mesh(GEO.leg, mPants));
    const shoe = mesh(GEO.shoe, mShoe); shoe.scale.set(0.95, 0.6, 1.4); shoe.position.set(0, -0.56, 0.05); pivot.add(shoe);
    return pivot;
  });
  const chest = new THREE.Group(); chest.position.y = 0.62; body.add(chest);
  const torso = mesh(GEO.torso, mShirt); torso.position.y = 0.32; chest.add(torso);
  const bag = mesh(GEO.pack, mPack); bag.position.set(0, 0.36, -0.2); chest.add(bag);
  const flap = mesh(GEO.flap, mPack); flap.position.set(0, 0.55, -0.2); chest.add(flap);
  const head = new THREE.Group(); head.position.set(0, 0.88, 0.0); chest.add(head);
  head.add(mesh(GEO.head, mSkin));
  const hairM = mesh(GEO.hair, mHair); hairM.rotation.x = -0.35; head.add(hairM);
  for (const sx of [-1, 1]) { const e = mesh(GEO.eye, mEye); e.scale.set(0.8, 1.45, 0.5); e.position.set(0.085 * sx, 0.0, 0.255); head.add(e); }
  const hands = [-1, 1].map((sx) => { const h = mesh(GEO.hand, mSkin); h.position.set(0.34 * sx, 0.3, 0.06); chest.add(h); return h; });

  let phase = 0, crouch = 0, air = 0, swim = 0, lean = 0, speedS = 0;
  // st : { speed, ground, swim, crouch, sprint, vy, turn }
  function update(dt, st) {
    speedS = damp(speedS, st.speed, 10, dt);
    const run = clamp(speedS / 5.6, 0, 1.4);
    phase += dt * (3 + speedS * 1.55);
    crouch = damp(crouch, st.crouch ? 1 : 0, 12, dt);
    air = damp(air, !st.ground && !st.swim ? 1 : 0, 10, dt);
    swim = damp(swim, st.swim ? 1 : 0, 6, dt);
    lean = damp(lean, (st.sprint ? 0.22 : 0.08 * run) * (1 - swim), 6, dt);
    const sw = Math.sin(phase), walk = run * (1 - air) * (1 - swim);
    // jambes : balancier ; en l'air, une jambe repliée ; accroupi, genoux fléchis (jambes inclinées)
    legs[0].rotation.x = sw * 0.75 * walk - air * 0.55 - crouch * 0.6 + swim * Math.sin(phase * 2.2) * 0.35;
    legs[1].rotation.x = -sw * 0.75 * walk + air * 0.25 - crouch * 0.6 - swim * Math.sin(phase * 2.2) * 0.35;
    // corps : rebond de la course, accroupi plus bas, buste penché ; à la nage, à plat
    hips.position.y = 0.62 - crouch * 0.24;
    chest.position.y = 0.62 - crouch * 0.3 + Math.abs(sw) * 0.045 * walk;
    chest.rotation.x = lean + crouch * 0.25 + swim * 1.15;
    body.position.y = swim * 0.5;
    body.rotation.x = swim * 0.25;
    // mains : en opposition aux jambes ; en l'air, levées ; à la nage, brasse
    for (const [i, h] of hands.entries()) {
      const sx = i ? 1 : -1, s = i ? -sw : sw;
      h.position.set(0.34 * sx + swim * 0.1 * sx * Math.cos(phase * 1.4), 0.3 + air * 0.35 + swim * (0.35 + 0.15 * Math.sin(phase * 1.4)), 0.06 + s * 0.22 * walk + swim * 0.25);
    }
    head.rotation.x = -lean * 0.6 - swim * 0.9 + clamp(st.pitch || 0, -0.5, 0.4) * (1 - swim);
  }
  return {
    root, update,
    dispose() { for (const m of mats) m.dispose(); },
  };
}
