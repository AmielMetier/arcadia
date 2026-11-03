// Les avions dessinés ici, aux proportions des vrais : Rafale, Su-35, F/A-18, A-10, et les deux gros porteurs
// d'Escorte (C-17 et A400M). Fuselage tourné autour de son axe, ailes, plans et dérives découpés dans leur vue en plan,
// tuyères, verrière. Nez sur +Z, gauche sur +X, comme les modèles du F-16 et du F-22.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

// Plaque horizontale : contour en vue de dessus [x, z], épaisseur e, posée à la hauteur y
function plate(pts, e, y = 0) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, z))), { depth: e, bevelEnabled: true, bevelThickness: e * 0.3, bevelSize: Math.min(0.1, e * 0.4), bevelSegments: 1 });
  g.rotateX(Math.PI / 2); g.translate(0, y + e / 2, 0);
  return g;
}
// Dérive : contour de profil [z, y], épaisseur e, à l'abscisse x, penchée vers l'extérieur de `cant` (rad)
function fin(pts, e, x = 0, cant = 0) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts.map(([z, y]) => new THREE.Vector2(z, y))), { depth: e, bevelEnabled: true, bevelThickness: e * 0.3, bevelSize: Math.min(0.08, e * 0.4), bevelSegments: 1 });
  g.rotateY(-Math.PI / 2); g.translate(e / 2, 0, 0);
  if (cant) { const y0 = Math.min(...pts.map((p) => p[1])); g.translate(0, -y0, 0); g.rotateZ(-Math.sign(x || 1) * cant); g.translate(0, y0, 0); }
  g.translate(x, 0, 0);
  return g;
}
// Corps tourné : profil [rayon, z] du nez vers l'arrière, aplati en largeur (sx) ou en hauteur (sy)
function body(profile, sx = 1, sy = 1, seg = 16) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(Math.max(r, 1e-3), z)).reverse(), seg);
  g.rotateX(Math.PI / 2); g.scale(sx, sy, 1);
  return g;
}
// Tube le long de z (nacelle, tuyère), de z0 à z1
function tube(r0, r1, z0, z1, x = 0, y = 0, seg = 14, open = false) {
  const g = new THREE.CylinderGeometry(z0 > z1 ? r0 : r1, z0 > z1 ? r1 : r0, Math.abs(z1 - z0), seg, 1, open); g.rotateX(Math.PI / 2); g.translate(x, y, (z0 + z1) / 2);
  return g;
}
const sym = (half) => [...half, ...half.slice().reverse().map(([x, z]) => [-x, z])];   // moitié gauche (x > 0) → contour entier
const box = (w, h, d, x, y, z) => new THREE.BoxGeometry(w, h, d).translate(x, y, z);
const bubble = (sx, sy, sz, x, y, z) => new THREE.SphereGeometry(1, 16, 10).scale(sx, sy, sz).translate(x, y, z);

// def : longueur, haut des dérives et bout d'aile (couleur d'escadron), tuyères [x, y, z, demi-largeur, demi-hauteur], canon
export const DRAWN = {
  rafale: {
    len: 15.3, color: 0x7b848d, fins: [[0, 3.25, -6.9]], tip: [5.45, -0.25, -5.25], nozzles: [[0.5, -0.15, -7.75, 0.42, 0.42], [-0.5, -0.15, -7.75, 0.42, 0.42]], gun: [-0.95, -0.1, 2],
    parts: (P) => {
      P.skin(body([[0, 7.65], [0.24, 7.1], [0.52, 6], [0.78, 4.6], [0.95, 3.1], [1.05, 1], [1.05, -4], [0.98, -6.4], [0.86, -7.5]], 1.12, 0.95));
      P.skin(plate(sym([[0, 1.5], [5.45, -4.6], [5.45, -5.9], [0, -6.9]]), 0.2, -0.3));
      P.skin(plate(sym([[0.6, 3.7], [2.3, 1.9], [2.3, 1.45], [0.6, 1.6]]), 0.1, 0.32));
      P.skin(fin([[-3.2, 0.8], [-6.2, 3.3], [-7.25, 3.3], [-7.6, 0.8]], 0.16));
      P.skin(box(0.6, 0.85, 2.6, 1.05, -0.35, 1.3)); P.skin(box(0.6, 0.85, 2.6, -1.05, -0.35, 1.3));
      P.dark(box(0.5, 0.7, 0.1, 1.05, -0.35, 2.62)); P.dark(box(0.5, 0.7, 0.1, -1.05, -0.35, 2.62));
      P.glass(bubble(0.5, 0.42, 1.6, 0, 0.74, 3.7));
      for (const x of [0.5, -0.5]) P.metal(tube(0.45, 0.42, -7.1, -7.8, x, -0.15, 14, true));
    },
  },
  su35: {
    len: 21.9, color: 0x71879a, fins: [[1.7, 3.5, -8.9], [-1.7, 3.5, -8.9]], tip: [7.65, -0.1, -5.3], nozzles: [[1.55, -0.55, -10.6, 0.5, 0.5], [-1.55, -0.55, -10.6, 0.5, 0.5]], gun: [-1.2, 0.35, 3.5],
    parts: (P) => {
      P.skin(body([[0, 11], [0.3, 10.2], [0.6, 8.8], [0.86, 7], [1, 5], [1, 2], [0.9, -2], [0.7, -6], [0.5, -9.5]]));
      P.skin(plate(sym([[0, 6.6], [1.95, 1.4], [2.25, -9.7], [0, -9.7]]), 0.62, -0.5));
      P.skin(plate(sym([[1.9, 0.5], [7.65, -4.6], [7.65, -6], [1.9, -6.2]]), 0.24, -0.15));
      P.skin(plate(sym([[2.1, -7], [4.8, -9.4], [4.8, -10.2], [2.1, -10.4]]), 0.14, -0.35));
      for (const x of [1.7, -1.7]) P.skin(fin([[-4.6, 0.2], [-8.3, 3.6], [-9.4, 3.6], [-9.7, 0.2]], 0.16, x));
      for (const x of [1.55, -1.55]) { P.skin(tube(0.78, 0.72, 1.5, -9.9, x, -0.6)); P.skin(box(1.15, 1.05, 2.4, x, -0.75, 2.6)); P.dark(box(1, 0.9, 0.1, x, -0.75, 3.82)); P.metal(tube(0.6, 0.55, -9.9, -10.7, x, -0.6, 14, true)); }
      P.glass(bubble(0.55, 0.5, 1.8, 0, 0.85, 6));
    },
  },
  f18: {
    len: 17.1, color: 0x737c84, fins: [[2.05, 3.1, -6.9], [-2.05, 3.1, -6.9]], tip: [6.15, 0, -2.9], nozzles: [[0.6, -0.15, -8.75, 0.42, 0.42], [-0.6, -0.15, -8.75, 0.42, 0.42]], gun: [0, 0.55, 7.4],
    parts: (P) => {
      P.skin(body([[0, 8.6], [0.27, 7.8], [0.55, 6.4], [0.75, 4.8], [0.85, 3], [0.9, 0], [0.95, -4], [0.95, -7.2], [0.85, -8.2]], 1.25, 0.95));
      P.skin(plate(sym([[0, 6.2], [1.5, 1.5], [1.5, -1], [0, -1]]), 0.12, 0.05));
      P.skin(plate(sym([[1.05, 0.5], [6.15, -2.2], [6.15, -3.6], [1.05, -4.6]]), 0.22, 0));
      P.skin(plate(sym([[0.9, -5.6], [3.3, -7.3], [3.3, -8], [0.9, -8.4]]), 0.14, -0.15));
      for (const x of [1.15, -1.15]) P.skin(fin([[-3.4, 0.55], [-6.2, 3.3], [-7.3, 3.3], [-7.05, 0.55]], 0.14, x, 0.35));
      for (const x of [1.2, -1.2]) { P.skin(box(0.62, 0.9, 2.6, x, -0.45, 0.5)); P.dark(box(0.52, 0.78, 0.1, x, -0.45, 1.82)); }
      for (const x of [0.6, -0.6]) P.metal(tube(0.46, 0.42, -8.1, -8.8, x, -0.15, 14, true));
      P.glass(bubble(0.5, 0.48, 1.7, 0, 0.78, 4.8));
    },
  },
  a10: {
    len: 16.3, color: 0x58605b, fins: [[3.25, 2.8, -7.2], [-3.25, 2.8, -7.2]], tip: [8.75, -0.55, -0.55], nozzles: [[1.45, 1.25, -5.35, 0.45, 0.45], [-1.45, 1.25, -5.35, 0.45, 0.45]], gun: [0.1, -0.28, 8.6],
    parts: (P) => {
      P.skin(body([[0, 8.25], [0.45, 8.05], [0.7, 7.3], [0.86, 5.2], [0.95, 3], [0.95, 0], [0.75, -4], [0.45, -7.2], [0.3, -8.1]], 0.95, 1.05));
      P.skin(plate(sym([[0, 1.2], [8.75, 0.2], [8.75, -1.3], [0, -1.8]]), 0.3, -0.6));
      P.skin(plate(sym([[0, -6.3], [3.25, -6.3], [3.25, -7.9], [0, -7.9]]), 0.14, 0.45));
      for (const x of [3.25, -3.25]) P.skin(fin([[-6, -0.6], [-6.6, 2.9], [-7.9, 2.9], [-8.1, -0.6]], 0.16, x));
      for (const x of [1.45, -1.45]) { P.skin(tube(0.66, 0.6, -1.5, -5.1, x, 1.25)); P.skin(box(0.25, 0.7, 1.8, x * 0.68, 0.75, -3.2)); P.dark(tube(0.5, 0.5, -1.45, -1.5, x, 1.25)); P.metal(tube(0.5, 0.46, -5.1, -5.4, x, 1.25, 14, true)); }
      P.glass(bubble(0.55, 0.55, 1.2, 0, 1, 5.2));
      P.metal(tube(0.14, 0.14, 7.2, 8.55, 0.1, -0.28, 8));
    },
  },
};

// Les gros porteurs : C-17 (quatre réacteurs) et A400M (quatre turbopropulseurs à huit pales)
export const CARGO = {
  c17: {
    color: 0x5f666b, fin: [0, 12.6, -24.5],
    parts: (P) => {
      P.skin(body([[0, 26.5], [1.6, 25.6], [2.8, 23.8], [3.4, 21], [3.5, 15], [3.5, -10]], 1, 1.02, 20));
      P.skin(body([[3.5, 0], [2.7, -6], [1.7, -11], [0.9, -15]], 1, 1, 18), { y: 0.4, z: -10, rx: 0.13 });
      P.skin(plate(sym([[0, 4], [25.9, -8], [25.9, -10.4], [0, -6.5]]), 0.75, 3));
      for (const x of [25.9, -25.9]) P.skin(fin([[-8.1, 3.6], [-9.4, 6.3], [-10.6, 6.3], [-10.4, 3.6]], 0.2, x));
      P.skin(fin([[-16.5, 2.8], [-22.5, 12.5], [-25.9, 12.5], [-26.6, 2.8]], 0.55));
      P.skin(plate(sym([[0, -20.6], [9.2, -24.6], [9.2, -26.3], [0, -26.8]]), 0.35, 12.4));
      for (const x of [3.2, -3.2]) P.skin(box(1.6, 1.8, 9, x, -2.5, 0.5));
      for (const x of [9.5, -9.5, 16.5, -16.5]) {
        const z = 5.6 - Math.abs(x) * 0.47;
        P.skin(tube(1.25, 1.1, z, z - 5.6, x, 1.1)); P.skin(box(0.35, 1.4, 4, x, 2.2, z - 3)); P.dark(tube(1.05, 1.05, z + 0.02, z - 0.02, x, 1.1)); P.metal(tube(0.9, 0.75, z - 5.6, z - 6.4, x, 1.1, 14, true));
      }
      P.glass(box(3.4, 0.9, 1.6, 0, 2.15, 23.3));
    },
  },
  a400m: {
    color: 0x687076, fin: [0, 11.5, -20.6],
    parts: (P) => {
      P.skin(body([[0, 22.5], [1.4, 21.7], [2.4, 20.2], [2.9, 18], [3, 12], [3, -7]], 1, 1.02, 20));
      P.skin(body([[3, 0], [2.4, -5], [1.5, -10], [0.8, -14.5]], 1, 1, 18), { y: 0.35, z: -7, rx: 0.12 });
      P.skin(plate(sym([[0, 3], [21.2, -2.6], [21.2, -5.2], [0, -4.4]]), 0.7, 2.8));
      P.skin(fin([[-12.5, 2.6], [-18.4, 11.5], [-21.4, 11.5], [-22.3, 2.6]], 0.5));
      P.skin(plate(sym([[0, -17.4], [9.8, -20.4], [9.8, -22.1], [0, -22.5]]), 0.32, 11.4));
      for (const x of [2.9, -2.9]) P.skin(box(1.4, 1.6, 7, x, -2.3, 0));
      for (const x of [6.8, -6.8, 13.6, -13.6]) {
        const z = 5.2 - Math.abs(x) * 0.26;
        P.skin(tube(0.55, 0.95, z, z - 2.5, x, 2.3)); P.skin(tube(0.95, 0.6, z - 2.5, z - 7.5, x, 2.3));
        P.prop(x, 2.3, z + 0.3, 2.65, x > 0 === Math.abs(x) > 10 ? 1 : -1);
      }
      P.glass(box(3, 0.85, 1.5, 0, 1.85, 19.6));
    },
  },
};

// Assemble un modèle : une géométrie par matière, fusionnée, pour peu d'appels de dessin
export function drawModel(def, env, color = def.color) {
  const lists = { skin: [], dark: [], glass: [], metal: [] }, props = [];
  const place = (g, o) => { if (o) { if (o.rx) g.rotateX(o.rx); g.translate(0, o.y || 0, o.z || 0); } return g; };
  const P = {
    skin: (g, o) => lists.skin.push(place(g, o)), dark: (g) => lists.dark.push(g), glass: (g) => lists.glass.push(g), metal: (g) => lists.metal.push(g),
    prop: (x, y, z, r, dir) => props.push({ x, y, z, r, dir }),
  };
  def.parts(P);
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.3, envMap: env, envMapIntensity: 0.75 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x15181c, roughness: 0.9, metalness: 0 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x1d2f3f, roughness: 0.06, metalness: 0.9, envMap: env, envMapIntensity: 1.4, transparent: true, opacity: 0.82 }),
    metal: new THREE.MeshStandardMaterial({ color: 0x3a3c40, roughness: 0.45, metalness: 0.8, envMap: env, side: THREE.DoubleSide }),
  };
  const root = new THREE.Group();
  for (const [k, list] of Object.entries(lists)) {
    if (!list.length) continue;
    const merged = merge(list); root.add(new THREE.Mesh(merged, mats[k]));
  }
  // hélices : un disque flou par moteur, qui tourne
  const blur = new THREE.MeshBasicMaterial({ color: 0x1b1f24, transparent: true, opacity: 0.3, side: THREE.DoubleSide, depthWrite: false });
  const spin = [];
  for (const p of props) {
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z); g.userData.dir = p.dir;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(p.r, 28), blur); g.add(disc);
    for (let k = 0; k < 8; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.16, p.r * 0.95, 0.05).translate(0, p.r * 0.48, 0), mats.dark); b.rotation.z = k * Math.PI / 4; g.add(b); }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8).scale(1, 1, 1.6), mats.metal));
    root.add(g); spin.push(g);
  }
  root.userData.spin = spin;
  return root;
}

// Fusionne des géométries de même nature (positions, normales), indexées ou non
function merge(list) {
  let n = 0;
  const flat = list.map((g) => { const f = g.index ? g.toNonIndexed() : g; n += f.attributes.position.count; return f; });
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
  let o = 0;
  for (const f of flat) {
    if (!f.attributes.normal) f.computeVertexNormals();
    pos.set(f.attributes.position.array, o * 3); nor.set(f.attributes.normal.array, o * 3); o += f.attributes.position.count;
    f.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.computeBoundingSphere();
  return g;
}
