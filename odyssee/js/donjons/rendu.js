// odyssee/js/donjons/rendu.js — ce que les donjons à plusieurs ajoutent au rendu d'Odyssée : salles « claires » (sol et
// murs blancs du Donjon des Miroirs), sol glacé, sols posés case par case (solArene), plaques au mur, et faisceaux de
// lumière. Branché une fois au démarrage (navigateur seulement, main.js). Repris du labo (TestOdyssée).
import * as THREE from 'three';
import { WorldView, HPX, EL } from '../render/world3d.js';
import { Sol } from '../render/sol.js';
import { T } from '../world/tiles.js';

// textures d'Odyssée reprises pour le style clair des donjons (miroirs)
const CLAIR = { sol: 'floor_musee', mur: 'wall_mart', haut: ['snow', 'floor_lab', 'floor_mart'], glace: 'floor_gymWater', fond: '#e8eef8' };
const STYLES = { clair: CLAIR };
const cellule = (A, k) => (Array.isArray(k) ? k.map((q) => A[q]).find(Boolean) : A[k]);
const SOLS = new Set([T.CAVE, T.BLOCK, T.CAVEWALL, T.CAVEDOOR, T.FLOOR]);

let branche = false;
export function brancherRendu() {
  if (branche) return; branche = true;
  const P = WorldView.prototype;
  // donjons à style : leurs propres sols, pas le sol de grotte généré d'Odyssée
  const couvre = Sol.prototype.couvre;
  Sol.prototype.couvre = function (map = this.map) { return !STYLES[map?.style] && couvre.call(this, map); };
  // les dalles des donjons restent visibles : le sol généré les laisse à nu
  const SOUS = new Set(['carpet', 'glace']);
  const pompe = Sol.prototype.pump;
  Sol.prototype.pump = function () {
    const m = this.map, nus = m?.donjon && m.deco ? new Set(m.deco.filter((d) => SOUS.has(d.k)).map((d) => d.x + ',' + d.y)) : null;
    if (!nus?.size) return pompe.call(this);
    m.get = function (x, y) { return nus.has(x + ',' + y) ? T.FLOOR : Object.getPrototypeOf(this).get.call(this, x, y); };
    try { return pompe.call(this); } finally { delete m.get; }
  };
  const sol = P.groundCell;
  P.groundCell = function (x, y) {
    const m = this.map, A = this.A.cells;
    if (m.glace?.has(x + ',' + y)) return { c: A[CLAIR.glace] };
    { const k = m.solArene?.get(x + ',' + y); if (k && A[k]) return { c: A[k] }; }
    const st = STYLES[m.style];
    if (st && SOLS.has(m.get(x, y)) && !['exitlight', 'carpet'].includes(this.decoAt.get(x + ',' + y)?.k)) { const c = cellule(A, m.solSalle || st.sol); if (c) return { c }; }
    return sol.call(this, x, y);
  };
  // murs de grotte dessinés avec les textures claires, le temps de construire le morceau de carte
  const morceau = P.buildChunk;
  P.buildChunk = function (i, j) {
    const st = STYLES[this.map?.style];
    if (!st) return morceau.call(this, i, j);
    const A = this.A.cells, avant = { cavewall: A.cavewall, cavetop: A.cavetop };
    A.cavewall = cellule(A, st.mur) || avant.cavewall; A.cavetop = cellule(A, st.haut) || avant.cavetop;
    try { return morceau.call(this, i, j); } finally { Object.assign(A, avant); }
  };
  const carte = P.setMap;
  P.setMap = function (map) {
    carte.call(this, map);
    // style clair : murs droits et blancs, sans les gradins de roche des grottes d'Odyssée
    const st = STYLES[map.style];
    if (st) { this.tiers = null; this.scene.background = new THREE.Color(st.fond); }
    if (map.affiches) for (const a of map.affiches) poserAffiche(this, a);
  };
}

/** une affiche encadrée sur la face sud d'un mur (case a.x, a.y) : papier clair, cadre de bois sombre, quelques lignes d'écriture */
function poserAffiche(view, a) {
  const c = document.createElement('canvas'); c.width = 32; c.height = 26;
  const x = c.getContext('2d');
  x.fillStyle = '#4a2c14'; x.fillRect(0, 0, 32, 26);                 // cadre de bois sombre
  x.fillStyle = '#7a4a24'; x.fillRect(1, 1, 30, 24);
  x.fillStyle = '#4a2c14'; x.fillRect(2, 2, 28, 22);
  x.fillStyle = '#fbf6e6'; x.fillRect(3, 3, 26, 20);                 // papier
  x.fillStyle = '#e6dcc0'; x.fillRect(3, 21, 26, 2); x.fillRect(27, 3, 2, 20);
  x.fillStyle = '#5a5248';
  for (const [y0, l] of [[9, 20], [12, 18], [15, 20], [18, 12]]) x.fillRect(6, y0, l, 1);
  x.fillStyle = '#9cc0ea'; x.fillRect(13, 4, 6, 3); x.fillStyle = '#ffffff'; x.fillRect(14, 4, 2, 1);   // petit miroir dessiné en tête
  const t = new THREE.CanvasTexture(c); t.magFilter = t.minFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace;
  const W = 0.86, H = W * 26 / 32 * Math.tan(EL), haut = 1.25 * Math.tan(EL);
  const geo = new THREE.PlaneGeometry(W, H); geo.translate(a.x + 0.5, haut * 0.52, a.y + 1.01);
  const mat = new THREE.MeshBasicMaterial({ map: t }); mat.userData.own = true;
  view.root.add(new THREE.Mesh(geo, mat));
}

/** grand miroir debout le long d'une ligne (salle du Reflet) : une vitre blanche deux fois plus haute que les murs, posée sur le bord
 *  nord de la rangée y, de x0 à x1, sans cadre ; null : efface */
export function dessinerMiroir(view, M) {
  if (!M) { if (view.__miroir) { view.__miroirRoot?.remove(view.__miroir); view.__miroir.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); }); view.__miroir = null; view.__miroirRoot = null; } return; }
  if (!view.root) return;
  dessinerMiroir(view, null);
  const g = new THREE.Group(), H = 2.5 * Math.tan(EL), z = M.y, w = M.x1 - M.x0;   // deux fois la hauteur des murs
  const vitre = (cx, y0, larg, haut, color, opacity, rot = 0, dz = 0) => {
    const geo = new THREE.PlaneGeometry(larg, haut); if (rot) geo.rotateZ(rot); geo.translate(cx, y0 + haut / 2, z + dz);
    const me = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
    me.renderOrder = 2; me.frustumCulled = false; g.add(me);
  };
  vitre(M.x0 + w / 2, 0, w, H, 0xeef6ff, 0.72);
  for (let x = M.x0 + 1.3; x < M.x1 - 0.5; x += 2.6) { vitre(x, H * 0.15, 0.16, H * 0.7, 0xffffff, 0.9, -0.35, 0.002); vitre(x + 0.35, H * 0.3, 0.07, H * 0.4, 0xffffff, 0.9, -0.35, 0.002); }
  view.root.add(g); view.__miroir = g; view.__miroirRoot = view.root;
}

/**
 * faisceaux de lumière : une suite de lignes brisées, chaque point est une case [x, y] (centre de la case).
 * Remplace ceux déjà dessinés ; tableau vide : efface.
 */
export function dessinerFaisceaux(view, traits) {
  if (view.__faisceaux) { view.root?.remove(view.__faisceaux); view.__faisceaux.traverse((o) => o.geometry?.dispose()); view.__faisceaux = null; }
  view.__faisceauxRoot = view.root;
  if (!traits.length || !view.root) return;
  const g = new THREE.Group();
  const coeur = new THREE.MeshBasicMaterial({ color: 0xfff0a0, transparent: true, opacity: 0.95, depthWrite: false });
  const halo = new THREE.MeshBasicMaterial({ color: 0xffc030, transparent: true, opacity: 0.45, depthWrite: false });
  const H = 0.55;
  for (const pts of traits) {
    for (let k = 1; k < pts.length; k++) {
      const [ax, ay] = pts[k - 1], [bx, by] = pts[k];
      const len = Math.hypot(bx - ax, by - ay); if (!len) continue;
      for (const [mat, w, h] of [[halo, 0.42, H - 0.01], [coeur, 0.14, H]]) {
        const geo = new THREE.PlaneGeometry(len + w, w); geo.rotateX(-Math.PI / 2);
        const me = new THREE.Mesh(geo, mat);
        me.position.set((ax + bx) / 2 + 0.5, h, (ay + by) / 2 + 0.5);
        me.rotation.y = -Math.atan2(by - ay, bx - ax);
        me.renderOrder = 5; me.frustumCulled = false;
        g.add(me);
      }
    }
  }
  view.root.add(g); view.__faisceaux = g; view.__faisceauxRoot = view.root;
}
