// Pions en volume (Three.js) : figurines en métal modélisées en primitives (tour, extrusion, sphères),
// posées sur un socle à la couleur du joueur. Hauteur ≈ 5 unités (1 unité = 10 px du plateau).
import * as THREE from '../../shared/vendor/three/three.module.min.js';

let metal = null, dark = null;
function mats() {
  if (!metal) {
    metal = new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.26 });
    dark = new THREE.MeshStandardMaterial({ color: 0x5c646d, metalness: 1, roughness: 0.42 });
  }
  return { metal, dark };
}

const V = (x, y) => new THREE.Vector2(x, y);
function lathe(points, segs = 40) { return new THREE.LatheGeometry(points.map(([x, y]) => V(x, y)), segs); }
// profil 2D (x, y) → volume extrudé d'épaisseur `depth`, centré sur z
function extrude(points, depth, bevel = 0.12) {
  const s = new THREE.Shape(points.map(([x, y]) => V(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
  g.translate(0, 0, -depth / 2);
  return g;
}
const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };

const BUILDERS = {
  voiture() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    const body = mesh(extrude([[-2.4, 0.5], [-2.3, 1.3], [-1.6, 1.5], [-0.8, 1.6], [-0.2, 2.4], [1.0, 2.4], [1.5, 1.6], [2.3, 1.4], [2.5, 0.9], [2.4, 0.5]], 1.9), M);
    g.add(body);
    const glass = mesh(extrude([[-0.05, 1.65], [0.25, 2.2], [0.95, 2.2], [1.25, 1.65]], 1.95, 0.02), D); g.add(glass);
    for (const [x, z] of [[-1.4, 1], [1.5, 1], [-1.4, -1], [1.5, -1]]) {
      const w = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.45, 20), D); w.rotation.x = Math.PI / 2; w.position.set(x, 0.62, z); g.add(w);
      const hub = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 14), M); hub.rotation.x = Math.PI / 2; hub.position.set(x, 0.62, z); g.add(hub);
    }
    return g;
  },
  chapeau() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [2.3, 0], [2.4, 0.12], [2.25, 0.32], [1.4, 0.38], [1.32, 0.4], [1.38, 3.4], [1.45, 3.55], [0, 3.6]]), M));
    const band = mesh(new THREE.CylinderGeometry(1.36, 1.33, 0.55, 40, 1, true), D); band.position.y = 0.75; g.add(band);
    return g;
  },
  de() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    g.add(mesh(lathe([[0, 0], [1.55, 0], [1.6, 0.5], [1.45, 0.62], [1.4, 2.7], [1.2, 3.25], [0.7, 3.55], [0, 3.62]]), M));
    for (let r = 0; r < 4; r++) for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + r * 0.22, y = 1.0 + r * 0.55, rad = 1.43 - r * 0.03;
      const d = mesh(new THREE.SphereGeometry(0.1, 6, 6), D); d.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); g.add(d);
    }
    return g;
  },
  botte() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    g.add(mesh(extrude([[-1.3, 0.4], [-1.3, 4.2], [0.4, 4.2], [0.4, 1.9], [0.7, 1.6], [1.9, 1.4], [2.5, 1.0], [2.5, 0.4]], 1.4), M));
    const sole = mesh(extrude([[-1.35, 0], [2.55, 0], [2.55, 0.42], [-1.35, 0.42]], 1.5, 0.05), D); g.add(sole);
    const cuff = mesh(extrude([[-1.4, 3.75], [0.5, 3.75], [0.5, 4.3], [-1.4, 4.3]], 1.55, 0.06), D); g.add(cuff);
    return g;
  },
  chien() {
    const { metal: M } = mats(), g = new THREE.Group();
    g.add(mesh(extrude([[-2.6, 2.6], [-2.2, 3.6], [-1.85, 2.8], [-1.4, 2.9], [-1.15, 3.9], [-0.85, 2.85], [-0.2, 2.6], [0.35, 2.2], [1.8, 2.2], [2.3, 2.6], [2.55, 3.1], [2.65, 2.4],
      [2.25, 1.9], [2.2, 0], [1.75, 0], [1.7, 1.2], [0.3, 1.2], [0.2, 0], [-0.25, 0], [-0.3, 1.25], [-0.9, 1.5], [-1.0, 0], [-1.45, 0], [-1.5, 1.85], [-2.3, 2.0], [-2.8, 2.3]], 1.3), M));
    return g;
  },
  chat() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(1.35, 24, 18), M); body.scale.set(1, 1.25, 0.9); body.position.y = 1.5; g.add(body);
    const head = mesh(new THREE.SphereGeometry(0.95, 24, 18), M); head.position.set(0, 3.3, 0.15); g.add(head);
    for (const x of [-0.5, 0.5]) { const e = mesh(new THREE.ConeGeometry(0.32, 0.7, 12), M); e.position.set(x, 4.2, 0.1); e.rotation.z = -x * 0.5; g.add(e); }
    for (const x of [-0.32, 0.32]) { const e = mesh(new THREE.SphereGeometry(0.11, 8, 8), D); e.position.set(x, 3.45, 0.98); g.add(e); }
    const tail = mesh(new THREE.TorusGeometry(1.1, 0.22, 10, 24, Math.PI * 1.1), M); tail.position.set(1.2, 0.9, -0.2); tail.rotation.set(Math.PI / 2, 0, -0.3); g.add(tail);
    return g;
  },
  canard() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    const body = mesh(new THREE.SphereGeometry(1.6, 24, 18), M); body.scale.set(1.35, 0.85, 1); body.position.set(-0.2, 1.35, 0); g.add(body);
    const tail = mesh(new THREE.ConeGeometry(0.7, 1.4, 16), M); tail.rotation.z = 2.2; tail.position.set(-2.1, 1.9, 0); g.add(tail);
    const head = mesh(new THREE.SphereGeometry(0.95, 24, 18), M); head.position.set(1.2, 3.0, 0); g.add(head);
    const beak = mesh(new THREE.ConeGeometry(0.4, 1.0, 14), D); beak.rotation.z = -Math.PI / 2; beak.scale.set(1, 1, 0.55); beak.position.set(2.3, 2.85, 0); g.add(beak);
    for (const z of [-0.45, 0.45]) { const e = mesh(new THREE.SphereGeometry(0.12, 8, 8), D); e.position.set(1.8, 3.25, z); g.add(e); }
    return g;
  },
  pointu() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    g.add(mesh(extrude([[-2.8, 1.4], [-2.4, 0.4], [-1.2, 0], [1.6, 0], [2.6, 0.6], [3.0, 1.6], [2.4, 1.3], [-2.0, 1.3]], 1.6), M));
    const mast = mesh(new THREE.CylinderGeometry(0.1, 0.12, 4.0, 10), D); mast.position.set(0, 3.2, 0); g.add(mast);
    const sail = mesh(extrude([[0.15, 1.6], [0.15, 4.8], [2.2, 1.8]], 0.08, 0.04), M); g.add(sail);
    const yard = mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.6, 8), D); yard.rotation.z = 1.0; yard.position.set(0.9, 3.4, 0); g.add(yard);
    return g;
  },
  chaise() {
    const { metal: M } = mats(), g = new THREE.Group();
    const seat = mesh(new THREE.BoxGeometry(2.6, 0.3, 2.2), M); seat.position.y = 1.8; g.add(seat);
    for (const [x, z] of [[-1.1, -0.9], [1.1, -0.9], [-1.1, 0.9], [1.1, 0.9]]) {
      const l = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.8, 10), M); l.position.set(x, 0.9, z); g.add(l);
    }
    for (const x of [-1.15, 1.15]) { const p = mesh(new THREE.CylinderGeometry(0.12, 0.12, 2.4, 10), M); p.position.set(x, 3.0, -1.0); p.rotation.x = -0.18; g.add(p); }
    for (const y of [2.6, 3.2, 3.8]) { const s = mesh(new THREE.BoxGeometry(2.5, 0.32, 0.14), M); s.position.set(0, y, -1.02 - (y - 2.6) * 0.18); s.rotation.x = -0.18; g.add(s); }
    for (const x of [-1.3, 1.3]) { const a = mesh(new THREE.BoxGeometry(0.16, 0.16, 1.9), M); a.position.set(x, 2.55, -0.1); g.add(a); }
    return g;
  },
  palmier() {
    const { metal: M, dark: D } = mats(), g = new THREE.Group();
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.25, 1.5, 0), new THREE.Vector3(0.1, 3.0, 0), new THREE.Vector3(-0.35, 4.3, 0)]);
    g.add(mesh(new THREE.TubeGeometry(curve, 20, 0.28, 10), M));
    for (let k = 0; k < 6; k++) {
      const leaf = mesh(extrude([[0, 0], [0.9, 0.35], [1.9, 0.25], [2.6, -0.5], [1.8, -0.05], [0.9, 0.05]], 0.06, 0.04), M);
      const piv = new THREE.Group(); piv.position.set(-0.35, 4.3, 0); piv.rotation.y = (k / 6) * Math.PI * 2; piv.add(leaf); leaf.rotation.z = -0.15; g.add(piv);
    }
    for (const [x, z] of [[-0.15, 0.25], [-0.55, -0.15], [-0.05, -0.25]]) { const c = mesh(new THREE.SphereGeometry(0.26, 10, 10), D); c.position.set(x, 4.05, z); g.add(c); }
    return g;
  },
};

// Pion complet : socle coloré + figurine ; renvoie un Group dont l'origine est au sol
export function makeToken3d(id, color) {
  const g = new THREE.Group();
  const baseMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(color), metalness: 0.15, roughness: 0.35 });
  const base = mesh(new THREE.CylinderGeometry(2.0, 2.25, 0.55, 32), baseMat); base.position.y = 0.28; g.add(base);
  const rim = mesh(new THREE.TorusGeometry(2.05, 0.08, 8, 32), mats().dark); rim.rotation.x = Math.PI / 2; rim.position.y = 0.56; g.add(rim);
  const fig = (BUILDERS[id] || BUILDERS.voiture)();
  // mise à l'échelle : la figurine tient dans un cylindre de rayon ≈ 1,9 et haut de 4,6
  const box = new THREE.Box3().setFromObject(fig), size = box.getSize(new THREE.Vector3());
  const k = Math.min(4.6 / size.y, 3.8 / Math.max(size.x, size.z));
  fig.scale.setScalar(k);
  const b2 = new THREE.Box3().setFromObject(fig), c = b2.getCenter(new THREE.Vector3());
  fig.position.set(-c.x, 0.55 - b2.min.y, -c.z);
  g.add(fig);
  g.userData.base = base;
  return g;
}
