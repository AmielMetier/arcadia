// Birdie Party — décor du trou : fleurs, buissons, rochers et nénuphars (Kenney, CC0), drapeau qui flotte au vent,
// trou, marques de départ et grille de pente du green. Les arbres et les herbes hautes sont dans trees.js.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { makeRng } from '../engine/rng.js';

// Fleurs, buissons, rochers et nénuphars, semés à partir de la graine du trou
export function scatterNature(hole, kit) {
  const group = new THREE.Group();
  if (!kit) return group;
  const r = makeRng(hole.def.seed * 29 + 99);
  const B = hole.bounds;
  const lists = {};
  const put = (name, x, z, s, yOff = 0) => { (lists[name] = lists[name] || []).push({ x, y: hole.heightAt(x, z) + yOff, z, s, rot: r.range(0, 6.283) }); };
  const randPt = () => [r.range(B.x0 - 40, B.x1 + 40), r.range(B.z0 - 40, B.z1 + 40)];
  const clearOf = (f) => f.bd > 1.5 && f.wd > 1.45 && f.gd > 1.35 && f.td > 2;
  const nearTree = (x, z, d) => hole.treesNear(x, z).some((t) => (t.x - x) ** 2 + (t.z - z) ** 2 < d * d);
  // buissons au pied des arbres de lisière
  for (const t of hole.trees) {
    if (!r.chance(0.35)) continue;
    const a = r.range(0, 6.283), d = t.r * r.range(0.9, 1.4), x = t.x + Math.sin(a) * d, z = t.z + Math.cos(a) * d;
    if (!clearOf(hole.fields(x, z))) continue;
    put(r.pick(['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall']), x, z, r.range(1.6, 2.6), -0.1);
    if (r.chance(0.15)) put(r.pick(['mushroom_red', 'mushroom_tanGroup', 'stump_round']), x + 1.2, z - 0.8, r.range(1.4, 2));
  }
  // rochers dans le rough
  for (let k = 0; k < 40; k++) {
    const [x, z] = randPt(), f = hole.fields(x, z);
    if (f.fm < -16 && clearOf(f) && !nearTree(x, z, 3)) put(r.pick(['rock_largeA', 'rock_largeC', 'rock_smallA', 'rock_smallC']), x, z, r.range(1.4, 3.2), -0.15);
  }
  for (let k = 0; k < 6; k++) {
    const [x, z] = randPt(), f = hole.fields(x, z);
    if (f.fm < -12 && clearOf(f) && !nearTree(x, z, 4)) put('log', x, z, r.range(1.6, 2.2), -0.05);
  }
  // nénuphars près des rives
  hole.waters.forEach((w, i) => {
    for (let k = 0; k < 14; k++) {
      const a = r.range(0, 6.283), d = r.range(0.45, 0.85);
      const x = w.x + Math.sin(a) * w.rx * d, z = w.z + Math.cos(a) * w.rz * d;
      if (hole.surfaceAt(x, z) !== 'water') continue;
      (lists[k % 3 ? 'lily_small' : 'lily_large'] = lists[k % 3 ? 'lily_small' : 'lily_large'] || []).push({ x, y: hole.waterLv[i] + 0.02, z, s: r.range(1.6, 2.4), rot: r.range(0, 6.283) });
    }
  });
  for (const name in lists) { const g = kit.instanced(name, lists[name]); if (g) group.add(g); }
  return group;
}

// Le drapeau (la toile ondule dans le sens du vent), le trou et son liseré
export function buildPin(hole) {
  const g = new THREE.Group();
  const y = hole.heightAt(hole.pin.x, hole.pin.z);
  g.position.set(hole.pin.x, y, hole.pin.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 2.5, 8).translate(0, 1.25, 0), new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.4 }));
  pole.castShadow = true; g.add(pole);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.3 }));
  knob.position.y = 2.52; g.add(knob);
  const clothGeo = new THREE.PlaneGeometry(0.85, 0.55, 12, 6).translate(0.425, 0, 0);
  const base = clothGeo.attributes.position.array.slice();
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshStandardMaterial({ color: 0xff3b3b, roughness: 0.7, side: THREE.DoubleSide }));
  cloth.position.y = 2.18; cloth.castShadow = true;
  const flagArm = new THREE.Group(); flagArm.add(cloth); g.add(flagArm);
  // trou : disque sombre affleurant et liseré blanc (agrandis pour rester lisibles de loin)
  const cup = new THREE.Mesh(new THREE.CircleGeometry(0.105, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x14210f, polygonOffset: true, polygonOffsetFactor: -4 }));
  cup.position.y = 0.015; g.add(cup);
  const rim = new THREE.Mesh(new THREE.RingGeometry(0.105, 0.13, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xf3f7ee, polygonOffset: true, polygonOffsetFactor: -4 }));
  rim.position.y = 0.016; g.add(rim);
  return {
    group: g, pole: [pole, knob, flagArm],
    update(t, wind) {
      // la toile pointe sous le vent ; elle claque plus fort quand il souffle
      const w = Math.min(1, (wind?.speed || 0) / 7);
      flagArm.rotation.y = (wind ? wind.dir : 0) - Math.PI / 2;
      const p = clothGeo.attributes.position.array;
      for (let i = 0; i < p.length; i += 3) {
        const x = base[i], k = x / 0.85;
        p[i + 2] = Math.sin(x * 7 - t * (5 + 7 * w)) * 0.07 * k * (0.4 + w);
        p[i + 1] = base[i + 1] - k * k * 0.18 * (1 - w);
      }
      clothGeo.attributes.position.needsUpdate = true;
      clothGeo.computeVertexNormals();
    },
    // on retire le mât quand on putte près du trou (comme un caddie qui l'enlève)
    showPole(on) { for (const o of [pole, knob, flagArm]) o.visible = on; },
  };
}

// Grille du green : un quadrillage qui épouse le relief et des points qui glissent dans le sens de la pente
// (bleu : presque plat, jaune puis rouge : ça penche fort). Affichée seulement quand on putte.
export function buildGreenGrid(hole) {
  const G = hole.green, R = Math.max(G.rx, G.rz) * 1.2, STEP = 1;
  const inside = (x, z) => hole.fields(x, z).gd < 1.12;
  const lines = [];
  const seg = (x0, z0, x1, z1) => {
    if (!inside(x0, z0) || !inside(x1, z1)) return;
    lines.push(x0, hole.heightAt(x0, z0) + 0.025, z0, x1, hole.heightAt(x1, z1) + 0.025, z1);
  };
  for (let gx = -R; gx <= R; gx += STEP) for (let gz = -R; gz <= R; gz += STEP / 2) {
    seg(G.x + gx, G.z + gz, G.x + gx, G.z + gz + STEP / 2);
    seg(G.x + gz, G.z + gx, G.x + gz + STEP / 2, G.z + gx);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const grid = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
  grid.renderOrder = 3;
  // points de pente
  const nodes = [];
  for (let gx = -R; gx <= R; gx += 1.5) for (let gz = -R; gz <= R; gz += 1.5) {
    const x = G.x + gx, z = G.z + gz;
    if (!inside(x, z)) continue;
    const [sx, sz] = hole.slopeAt(x, z, 0.3), m = Math.hypot(sx, sz);
    nodes.push({ x, z, dx: m ? -sx / m : 0, dz: m ? -sz / m : 0, m, ph: ((gx * 7.3 + gz * 3.1) % 1 + 1) % 1 });
  }
  const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.1, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthWrite: false }), Math.max(1, nodes.length));
  dots.renderOrder = 4; dots.frustumCulled = false;
  const col = new THREE.Color(), cFlat = new THREE.Color(0x6ec8ff), cMid = new THREE.Color(0xfff06a), cHot = new THREE.Color(0xff5a3c);
  nodes.forEach((n, i) => {
    const k = Math.min(1, n.m / 0.035);
    col.copy(cFlat).lerp(cMid, Math.min(1, k * 2)).lerp(cHot, Math.max(0, k * 2 - 1));
    dots.setColorAt(i, col);
  });
  const group = new THREE.Group(); group.add(grid, dots); group.visible = false;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
  return {
    group,
    update(t) {
      if (!group.visible) return;
      nodes.forEach((n, i) => {
        // le point avance d'autant plus vite que la pente est forte, puis repart de son nœud
        const f = (t * (0.25 + n.m * 18) + n.ph) % 1, d = f * 1.2;
        const x = n.x + n.dx * d, z = n.z + n.dz * d;
        p.set(x, hole.heightAt(x, z) + 0.035, z);
        sc.setScalar(Math.sin(f * Math.PI) * (0.6 + Math.min(1, n.m / 0.03) * 0.6));
        m4.compose(p, q, sc); dots.setMatrixAt(i, m4);
      });
      dots.instanceMatrix.needsUpdate = true;
    },
  };
}

export function buildTeeMarkers(hole, color = 0x3d8bff) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.13, 16, 12), mat = new THREE.MeshStandardMaterial({ color, roughness: 0.35 });
  const d = hole.teeDir, c = Math.cos(d), s = Math.sin(d);
  for (const side of [-1, 1]) {
    const m = new THREE.Mesh(geo, mat);
    const x = hole.tee.x + c * 3.2 * side + s * 1.5, z = hole.tee.z - s * 3.2 * side + c * 1.5;
    m.position.set(x, hole.heightAt(x, z) + 0.1, z); m.castShadow = true;
    g.add(m);
  }
  return g;
}
