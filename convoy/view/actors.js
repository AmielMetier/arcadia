// Convoy Storm — personnages en low-poly faits main : survivants en parka (couleur du joueur) et loups.
// Les géométries sont partagées ; seuls les matériaux de couleur sont propres à chaque survivant (libérés par drop()).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export function makeActors() {
  const geos = [], mats = [];
  const G = (g) => (geos.push(g), g);
  const M = (color, o = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...o }); mats.push(m); return m; };
  const mesh = (g, m, cast = true) => { const x = new THREE.Mesh(g, m); x.castShadow = cast; x.receiveShadow = false; return x; };

  const GEO = {
    torso: G(new THREE.CapsuleGeometry(0.3, 0.42, 3, 8)),
    limb: G(new THREE.CapsuleGeometry(0.1, 0.36, 2, 6)),
    leg: G(new THREE.CapsuleGeometry(0.12, 0.34, 2, 6)),
    boot: G(new THREE.BoxGeometry(0.2, 0.16, 0.3)),
    mitt: G(new THREE.IcosahedronGeometry(0.1, 0)),
    head: G(new THREE.IcosahedronGeometry(0.2, 1)),
    hood: G(new THREE.SphereGeometry(0.27, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62)),
    fur: G(new THREE.TorusGeometry(0.2, 0.075, 6, 12)),
    goggle: G(new THREE.BoxGeometry(0.3, 0.09, 0.08)),
    lens: G(new THREE.BoxGeometry(0.1, 0.06, 0.02)),
    pack: G(new THREE.BoxGeometry(0.42, 0.46, 0.22)),
    roll: G(new THREE.CylinderGeometry(0.09, 0.09, 0.46, 8).rotateZ(Math.PI / 2)),
    scarf: G(new THREE.TorusGeometry(0.22, 0.07, 6, 12)),
    tail: G(new THREE.BoxGeometry(0.14, 0.36, 0.06)),
    shaft: G(new THREE.CylinderGeometry(0.025, 0.025, 0.9, 5)),
    blade: G(new THREE.BoxGeometry(0.22, 0.04, 0.26)),
    lamp: G(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 6)),
    // loup
    wBody: G(new THREE.CapsuleGeometry(0.24, 0.62, 3, 8).rotateX(Math.PI / 2)),
    wChest: G(new THREE.IcosahedronGeometry(0.3, 0)),
    wHead: G(new THREE.BoxGeometry(0.26, 0.24, 0.28)),
    wSnout: G(new THREE.BoxGeometry(0.15, 0.12, 0.24)),
    wEar: G(new THREE.ConeGeometry(0.06, 0.15, 4)),
    wLeg: G(new THREE.BoxGeometry(0.08, 0.42, 0.09)),
    wTail: G(new THREE.ConeGeometry(0.08, 0.5, 5).rotateX(-Math.PI / 2.4)),
    wEye: G(new THREE.BoxGeometry(0.05, 0.035, 0.02)),
  };
  const SH = {
    skin: M(0xe6b796), dark: M(0x2b2f36), boot: M(0x4a3426), fur: M(0xf1e6d4, { roughness: 1 }), lens: M(0xffa23a, { emissive: 0xff7a10, emissiveIntensity: 0.6 }),
    canvas: M(0x6e6b52), bed: M(0x9c3b2e), steel: M(0x8a9099, { metalness: 0.5, roughness: 0.4 }), wood: M(0x7b5a3a),
    wolf: M(0x6f727a), wolfD: M(0x45484f), wolfL: M(0xc9ccd2), eye: M(0xffe08a, { emissive: 0xffd040, emissiveIntensity: 2.2 }),
    eyeRed: M(0xff4030, { emissive: 0xff2010, emissiveIntensity: 3 }), lampGlow: M(0xfff1c4, { emissive: 0xffd27a, emissiveIntensity: 2.2 }),
  };

  // ------------------------------------------------------------------ survivant
  function survivor(color) {
    const own = [];
    const body = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.8, flatShading: true }); own.push(body);
    const trim = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).multiplyScalar(0.55), roughness: 0.9, flatShading: true }); own.push(trim);
    const g = new THREE.Group();
    const root = new THREE.Group(); g.add(root); // penché, secoué : sans toucher à la position du groupe
    const torso = mesh(GEO.torso, body); torso.position.y = 0.98; torso.scale.set(1, 1, 0.82); root.add(torso);
    const belt = mesh(GEO.scarf, SH.dark, false); belt.rotation.x = Math.PI / 2; belt.scale.set(1.25, 1.1, 0.5); belt.position.y = 0.78; root.add(belt);
    // jambes et bottes (pivot à la hanche)
    const legs = [-0.13, 0.13].map((x) => {
      const piv = new THREE.Group(); piv.position.set(x, 0.66, 0); root.add(piv);
      const l = mesh(GEO.leg, SH.dark); l.position.y = -0.26; piv.add(l);
      const b = mesh(GEO.boot, SH.boot); b.position.set(0, -0.56, 0.05); piv.add(b);
      return piv;
    });
    // bras et moufles (pivot à l'épaule)
    const arms = [-0.36, 0.36].map((x) => {
      const piv = new THREE.Group(); piv.position.set(x, 1.22, 0); root.add(piv);
      const a = mesh(GEO.limb, body); a.position.y = -0.24; piv.add(a);
      const h = mesh(GEO.mitt, trim); h.position.y = -0.5; piv.add(h);
      return piv;
    });
    // tête, capuche bordée de fourrure, lunettes de neige
    const head = new THREE.Group(); head.position.y = 1.5; root.add(head);
    head.add(mesh(GEO.head, SH.skin));
    const hood = mesh(GEO.hood, body); hood.position.set(0, 0.02, -0.03); head.add(hood);
    const fur = mesh(GEO.fur, SH.fur, false); fur.position.set(0, 0.0, 0.1); fur.scale.set(1.05, 1.15, 0.8); head.add(fur);
    const gog = mesh(GEO.goggle, SH.dark, false); gog.position.set(0, 0.04, 0.17); head.add(gog);
    for (const s of [-0.07, 0.07]) { const l = mesh(GEO.lens, SH.lens, false); l.position.set(s, 0.04, 0.215); head.add(l); }
    const scarf = mesh(GEO.scarf, trim, false); scarf.rotation.x = Math.PI / 2; scarf.position.y = 1.3; root.add(scarf);
    const tail = mesh(GEO.tail, trim, false); tail.position.set(0.12, 1.12, -0.22); tail.rotation.x = 0.3; root.add(tail);
    // sac à dos et couverture roulée, lanterne accrochée
    const pack = mesh(GEO.pack, SH.canvas); pack.position.set(0, 1.0, -0.3); root.add(pack);
    const roll = mesh(GEO.roll, SH.bed); roll.position.set(0, 1.3, -0.3); root.add(roll);
    const lamp = mesh(GEO.lamp, SH.lampGlow, false); lamp.position.set(-0.2, 0.86, -0.4); root.add(lamp);
    // pelle (visible en déblayant)
    const shovel = new THREE.Group(); const sh1 = mesh(GEO.shaft, SH.wood); sh1.position.y = -0.2; shovel.add(sh1);
    const sb = mesh(GEO.blade, SH.steel); sb.position.y = -0.66; shovel.add(sb);
    shovel.position.set(0, 1.0, 0.35); shovel.visible = false; root.add(shovel);
    // hache (abattre les arbres), tenue à deux mains
    const axe = new THREE.Group(); const ah = mesh(GEO.shaft, SH.wood); ah.position.y = -0.2; axe.add(ah);
    const ab = mesh(GEO.blade, SH.steel); ab.scale.set(1.1, 1.4, 0.6); ab.position.set(0.1, -0.62, 0); axe.add(ab);
    axe.position.set(0, 1.25, 0.32); axe.visible = false; root.add(axe);
    return { g, root, legs, arms, head, tail, shovel, axe, body, trim, own, base: new THREE.Color(color) };
  }

  const ICE = new THREE.Color(0xbfe4ff);
  // pose du survivant : marche, port de caisse, échelle, fouille, pelle, froid
  function poseSurvivor(o, p, t, dt) {
    const sp = Math.hypot(p.vx, p.vz);
    o.walk = (o.walk || 0) + sp * dt * 2.6;
    const sw = p.air ? 0.5 : Math.sin(o.walk) * Math.min(1, sp / 3) * 0.75;
    o.legs[0].rotation.x = sw; o.legs[1].rotation.x = -sw;
    let up0, up1;
    const act = p.act | 0;
    if (p.seat) { // assis (survivant à bord)
      o.legs[0].rotation.x = o.legs[1].rotation.x = -1.35; o.root.position.y = -0.42;
      o.arms[0].rotation.x = o.arms[1].rotation.x = -0.5; o.root.rotation.z = Math.sin(t * 1.1 + (p.id | 0)) * 0.03;
      o.shovel.visible = o.axe.visible = false; return;
    }
    if (p.carry) up0 = up1 = -2.9;
    else if (act === 1) { up0 = up1 = -2.4 + Math.max(0, Math.sin(t * 7)) * 1.9; }
    else if (act === 2) { up0 = up1 = -1.45 + Math.sin(t * 5) * 0.08; }
    else if (p.st === 2) { up0 = -2.6 + Math.sin(t * 14) * 0.4; up1 = -2.6 - Math.sin(t * 14) * 0.4; }
    else if (p.dig) { up0 = up1 = -1.1 + Math.sin(t * 9) * 0.6; }
    else if (p.sp > 0) { up0 = -1.2 + Math.sin(t * 16) * 0.5; up1 = -1.2 - Math.sin(t * 16) * 0.5; }
    else { up0 = -sw * 0.8; up1 = sw * 0.8; }
    o.arms[0].rotation.x = up0; o.arms[1].rotation.x = up1;
    o.arms[0].rotation.z = p.carry ? 0.15 : 0; o.arms[1].rotation.z = p.carry ? -0.15 : 0;
    o.shovel.visible = !!p.dig;
    if (p.dig) { o.shovel.rotation.x = -0.9 + Math.sin(t * 9) * 0.6; }
    o.axe.visible = act === 1;
    if (act === 1) o.axe.rotation.x = -2.2 + Math.max(0, Math.sin(t * 7)) * 1.9;
    o.root.position.y = p.air ? 0 : Math.abs(Math.sin(o.walk)) * 0.05 * Math.min(1, sp / 3);
    o.tail.rotation.x = 0.3 + Math.sin(t * 6 + o.walk) * 0.25 * Math.min(1, sp / 2 + 0.3);
    // froid : la parka se couvre de givre, on grelotte sous 15 %
    const heat = p.heat ?? 100, ice = Math.max(0, 1 - heat / 45);
    o.body.color.copy(o.base).lerp(ICE, ice * 0.65);
    const shiver = heat < 15 ? Math.sin(t * 60) * 0.03 : 0;
    o.root.rotation.z = shiver;
    o.root.rotation.x = p.st === 1 ? 0.35 : p.dig ? 0.25 : act === 2 ? 0.4 : 0;
  }

  // ------------------------------------------------------------------ loup
  const SHA = { wolf: M(0x2d2f35), wolfD: M(0x17181c) };
  // alpha : plus grand, plus sombre, yeux toujours rouges
  function wolf(alpha = false) {
    const g = new THREE.Group();
    const W = alpha ? SHA : SH;
    const body = mesh(GEO.wBody, W.wolf); body.position.y = 0.62; g.add(body);
    const chest = mesh(GEO.wChest, SH.wolfL); chest.position.set(0, 0.66, 0.34); chest.scale.set(0.9, 0.95, 0.9); g.add(chest);
    const neck = new THREE.Group(); neck.position.set(0, 0.82, 0.5); g.add(neck);
    const head = mesh(GEO.wHead, W.wolf); neck.add(head);
    const snout = mesh(GEO.wSnout, SH.wolfL); snout.position.set(0, -0.04, 0.22); neck.add(snout);
    const nose = mesh(GEO.wEye, SH.wolfD, false); nose.position.set(0, 0.0, 0.34); nose.scale.set(1.2, 1.5, 1); neck.add(nose);
    for (const s of [-0.08, 0.08]) { const e = mesh(GEO.wEar, SH.wolfD); e.position.set(s, 0.17, -0.03); neck.add(e); }
    const eyes = [-0.075, 0.075].map((s) => { const e = mesh(GEO.wEye, SH.eye, false); e.position.set(s, 0.05, 0.145); neck.add(e); return e; });
    const legs = [[-0.13, 0.36], [0.13, 0.36], [-0.13, -0.32], [0.13, -0.32]].map(([x, z]) => {
      const piv = new THREE.Group(); piv.position.set(x, 0.55, z); g.add(piv);
      const l = mesh(GEO.wLeg, W.wolfD); l.position.y = -0.24; piv.add(l); return piv;
    });
    const tail = mesh(GEO.wTail, W.wolf); tail.position.set(0, 0.7, -0.62); g.add(tail);
    g.scale.setScalar(alpha ? 2.0 : 1.3);
    return { g, neck, legs, tail, eyes, run: 0, alpha };
  }
  function poseWolf(o, w, t, dt, sp) {
    o.run += dt * (2 + sp * 2.2);
    const a = Math.min(1, sp / 3);
    const s = Math.sin(o.run) * 0.8 * a, c = Math.cos(o.run) * 0.8 * a;
    o.legs[0].rotation.x = s; o.legs[1].rotation.x = c; o.legs[2].rotation.x = -c; o.legs[3].rotation.x = -s;
    o.g.children[0].position.y = 0.62 + Math.abs(Math.sin(o.run)) * 0.06 * a;
    o.neck.rotation.x = w.st === 1 ? 0.25 : -0.1 + Math.sin(t * 1.3 + w.id) * 0.1;
    o.tail.rotation.x = w.st === 2 ? 0.6 : Math.sin(t * 3 + w.id) * 0.2;
    const red = w.st === 1 || o.alpha;
    for (const e of o.eyes) e.material = red ? SH.eyeRed : SH.eye;
  }

  return {
    survivor, poseSurvivor, wolf, poseWolf,
    drop(o) { for (const m of o.own || []) m.dispose(); },
    dispose() { for (const g of geos) g.dispose(); for (const m of mats) m.dispose(); },
  };
}
