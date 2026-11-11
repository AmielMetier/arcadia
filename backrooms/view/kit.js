// The Backrooms - Les modèles Poly Haven (CC0) posés en grand nombre : chaque nœud racine d'un .glb est un morceau
// (un tuyau droit, un coude, une vanne…) que l'on place autant de fois qu'on veut. Seuls les exemplaires proches de
// la caméra, et pas dans son dos, sont dessinés à chaque image : des milliers de pièces pour le prix de quelques
// centaines.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { GLTFLoader } from '../../shared/vendor/three/GLTFLoader.js';

const MODELS = new URL('../models/', import.meta.url).href;
const loader = new GLTFLoader();
const cache = new Map();

// name → Promise(Map(morceau → [{ geo, mat, m }])) ; m place le maillage dans le repère du morceau (son origine,
// sans le décalage qui range les morceaux côte à côte dans le fichier)
export function loadKit(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      new Promise((resolve) =>
        loader.load(
          MODELS + name + '.glb',
          (g) => {
            const pieces = new Map();
            g.scene.updateMatrixWorld(true);
            for (const root of g.scene.children) {
              const back = new THREE.Matrix4().makeTranslation(-root.position.x, -root.position.y, -root.position.z);
              const parts = [];
              root.traverse((o) => {
                if (!o.isMesh) return;
                const mat = Array.isArray(o.material) ? o.material[0] : o.material;
                if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;
                parts.push({ geo: o.geometry, mat, m: back.clone().multiply(o.matrixWorld) });
              });
              parts.at = root.position.clone(); // (sa place dans le modèle : pour poser le modèle entier, « * »)
              pieces.set(root.name, parts);
            }
            resolve(pieces);
          },
          undefined,
          () => resolve(new Map()),
        ),
      ),
    );
  }
  return cache.get(name);
}

// convert(mat, kitName, pieceName, variant) → { mat, glass } : la matière de la scène pour une matière du modèle ;
// glass : une vitre qui s'allume (sa couleur vient de l'exemplaire : glow(item) → THREE.Color ou null). Un morceau
// nommé "piece@variante" est le même maillage avec une autre matière (un tuyau peint en rouge, une tige rouillée…).
// reach (facultatif) : chaque exemplaire n'est dessiné qu'à moins de reach.base + reach.k × (sa demi-diagonale) mètres :
// une montre sur une table disparaît à 20 m, un banc reste visible au bout du mail ; reach.cap[modèle] borne la portée
// d'un modèle très lourd (en mètres)
export function createKitInstancer({ group, convert, reach }) {
  const lists = new Map(); // "kit|morceau" → exemplaires
  const sets = [];
  const add = (kit, piece, matrix, extra = {}) => {
    const key = kit + '|' + piece;
    if (!lists.has(key)) lists.set(key, []);
    const e = matrix.elements;
    lists.get(key).push({ m: matrix.clone(), x: e[12], z: e[14], ...extra });
  };
  // un morceau posé : position, rotation autour de y, échelle (nombre ou [x, y, z]), et rotations en plus
  const tmp = new THREE.Object3D();
  const put = (kit, piece, x, y, z, ry = 0, s = 1, extra, rx = 0, rz = 0) => {
    tmp.position.set(x, y, z);
    tmp.rotation.set(rx, ry, rz, 'YXZ');
    if (Array.isArray(s)) tmp.scale.set(s[0], s[1], s[2]);
    else tmp.scale.setScalar(s);
    tmp.updateMatrix();
    add(kit, piece, tmp.matrix, extra);
  };
  const build = (glow) => {
    const kits = new Set([...lists.keys()].map((k) => k.split('|')[0]));
    for (const kit of kits) {
      loadKit(kit).then((pieces) => {
        for (const [key, items] of lists) {
          const [k, pv] = key.split('|');
          const [piece, variant = ''] = pv.split('@');
          if (k !== kit) continue;
          // « * » : le modèle entier, chaque morceau à sa place ; « a+b » : ces morceaux-là, à leur place
          const whole = piece === '*' || piece.includes('+');
          const names = piece === '*' ? [...pieces.keys()] : piece.split('+').filter((n) => pieces.has(n));
          // la portée de chaque exemplaire, d'après la taille du modèle posé (tous ses morceaux) et son échelle
          let far = null;
          if (reach) {
            const box = new THREE.Box3();
            const pb = new THREE.Box3();
            for (const pn of names)
              for (const part of pieces.get(pn)) {
                if (!part.geo.boundingBox) part.geo.computeBoundingBox();
                pb.copy(part.geo.boundingBox).applyMatrix4(part.m);
                if (whole) pb.translate(pieces.get(pn).at);
                box.union(pb);
              }
            const rad = box.isEmpty() ? 1 : box.getSize(new THREE.Vector3()).length() / 2;
            const sc = new THREE.Vector3();
            far = new Float32Array(items.length);
            items.forEach((it, i) => {
              sc.setFromMatrixScale(it.m);
              const r = Math.min(reach.cap?.[kit] ?? Infinity, reach.base + reach.k * rad * Math.max(sc.x, sc.y, sc.z));
              far[i] = r * r;
            });
          }
          for (const pn of names) {
            const at = whole ? new THREE.Matrix4().makeTranslation(pieces.get(pn).at) : null;
            for (const part of pieces.get(pn)) {
              const { mat, glass } = convert(part.mat, kit, pn, variant);
              const mesh = new THREE.InstancedMesh(part.geo, mat, items.length);
              mesh.name = kit;
              mesh.frustumCulled = false;
              mesh.count = 0;
              if (glass) mesh.setColorAt(0, new THREE.Color());
              const mats = new Float32Array(items.length * 16);
              const tmpM = new THREE.Matrix4();
              items.forEach((it, i) => {
                tmpM.copy(it.m);
                if (at) tmpM.multiply(at);
                tmpM.multiply(part.m).toArray(mats, i * 16);
              });
              group.add(mesh);
              sets.push({ mesh, items, mats, glass, glow, far });
            }
          }
        }
      });
    }
  };
  // à chaque image : seuls les exemplaires à moins de R mètres, et pas loin derrière la caméra (cosMin : le cosinus de
  // l'angle au-delà duquel on ne dessine plus, par rapport à l'axe du regard ; par défaut, un peu derrière les épaules)
  // inner : faux quand la caméra est à un autre étage : les exemplaires marqués « inner » (loin de tout vide, donc
  // invisibles de là) ne sont pas dessinés
  const update = (cx, cz, fx, fz, R = 38, cosMin = -0.4, inner = true) => {
    const R2 = R * R;
    const near2 = cosMin > -0.4 ? 81 : 30;
    for (const s of sets) {
      const arr = s.mesh.instanceMatrix.array;
      const mats = s.mats;
      let n = 0;
      for (let i = 0; i < s.items.length; i++) {
        const it = s.items[i];
        if (!inner && it.inner) continue;
        const dx = it.x - cx;
        const dz = it.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 > R2 || (s.far && d2 > s.far[i])) continue;
        if (d2 > near2 && dx * fx + dz * fz < cosMin * Math.sqrt(d2)) continue;
        // sa matrice (16 nombres), recopiée à la main : subarray créerait une vue par exemplaire visible, à chaque
        // image (des milliers dans les Tuyauteries, autant de déchets pour le ramasse-miettes)
        const o = n * 16;
        const m = i * 16;
        for (let k = 0; k < 16; k++) arr[o + k] = mats[m + k];
        if (s.glass) {
          const c = s.glow(it);
          s.mesh.instanceColor.setXYZ(n, c.r, c.g, c.b);
        }
        n++;
      }
      s.mesh.count = n;
      s.mesh.instanceMatrix.needsUpdate = true;
      if (s.glass) s.mesh.instanceColor.needsUpdate = true;
    }
  };
  return { add, put, build, update };
}
