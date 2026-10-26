// Les objets en 3D : armes (avec une bande à la couleur de leur rareté), outil de récolte, soins, potions,
// grenades, tremplin, munitions et matériaux. Volumes simples, origine à la poignée, canon vers +z.
// Les géométries et matériaux sont partagés : un modèle coûte peu, on peut en créer pour chaque objet au sol.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { RARITY, AMMO, MATERIALS } from '../engine/items.js';

const geoCache = new Map(), matCache = new Map();
const box = (w, h, d) => { const k = `b${w},${h},${d}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.BoxGeometry(w, h, d)); return geoCache.get(k); };
const cyl = (r, l, r2 = r, seg = 12) => { const k = `c${r},${l},${r2},${seg}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.CylinderGeometry(r2, r, l, seg)); return geoCache.get(k); };
const sph = (r) => { const k = `s${r}`; if (!geoCache.has(k)) geoCache.set(k, new THREE.SphereGeometry(r, 14, 10)); return geoCache.get(k); };
const mat = (color, o = {}) => {
  const k = color + JSON.stringify(o);
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.2, ...o }));
  return matCache.get(k);
};
const GUN = 0x2f3236, GRIP = 0x1f2024, WOODC = 0x8a5a32;

function part(g, geo, m, x, y, z, rx = 0) {
  const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.x = rx; o.castShadow = true; g.add(o); return o;
}
// cylindre couché le long de z (canon)
const barrel = (g, r, l, m, x, y, z0) => part(g, cyl(r, l), m, x, y, z0 + l / 2, Math.PI / 2);

const WEAPON_MODELS = {
  fusil(g, R) {
    part(g, box(0.08, 0.12, 0.5), mat(GUN), 0, 0.05, 0.12);
    barrel(g, 0.022, 0.32, mat(GRIP), 0, 0.07, 0.37);
    part(g, box(0.05, 0.17, 0.07), mat(GRIP), 0, -0.07, 0.18);
    part(g, box(0.06, 0.12, 0.08), mat(GRIP), 0, -0.04, -0.02);
    part(g, box(0.07, 0.11, 0.22), mat(GUN), 0, 0.03, -0.22);
    part(g, box(0.085, 0.03, 0.3), R, 0, 0.1, 0.12);
  },
  pompe(g, R) {
    part(g, box(0.09, 0.11, 0.38), mat(GUN), 0, 0.05, 0.06);
    barrel(g, 0.034, 0.48, mat(GRIP), 0, 0.08, 0.2);
    part(g, box(0.07, 0.07, 0.16), mat(WOODC), 0, 0.02, 0.44);
    part(g, box(0.07, 0.12, 0.26), mat(WOODC), 0, 0.0, -0.22);
    part(g, box(0.095, 0.03, 0.25), R, 0, 0.11, 0.05);
  },
  pistolet(g, R) {
    part(g, box(0.045, 0.07, 0.22), mat(GUN), 0, 0.07, 0.08);
    part(g, box(0.04, 0.13, 0.06), mat(GRIP), 0, -0.01, 0.0);
    part(g, box(0.048, 0.025, 0.14), R, 0, 0.11, 0.08);
  },
  smg(g, R) {
    part(g, box(0.07, 0.1, 0.32), mat(GUN), 0, 0.05, 0.08);
    barrel(g, 0.018, 0.12, mat(GRIP), 0, 0.06, 0.24);
    part(g, box(0.04, 0.22, 0.05), mat(GRIP), 0, -0.1, 0.12);
    part(g, box(0.05, 0.1, 0.06), mat(GRIP), 0, -0.03, -0.03);
    part(g, box(0.075, 0.03, 0.2), R, 0, 0.11, 0.08);
  },
  sniper(g, R) {
    part(g, box(0.07, 0.1, 0.62), mat(GUN), 0, 0.04, 0.08);
    barrel(g, 0.018, 0.5, mat(GRIP), 0, 0.06, 0.39);
    barrel(g, 0.032, 0.3, mat(GRIP), 0, 0.15, -0.02);
    part(g, box(0.06, 0.13, 0.26), mat(WOODC), 0, 0.0, -0.32);
    part(g, box(0.045, 0.1, 0.05), mat(GRIP), 0, -0.05, 0.12);
    part(g, box(0.075, 0.03, 0.4), R, 0, 0.095, 0.08);
  },
  roquette(g, R) {
    barrel(g, 0.085, 1.05, mat(0x4f6a3a), 0.02, 0.1, -0.45);
    part(g, box(0.05, 0.14, 0.06), mat(GRIP), 0.02, -0.05, 0.05);
    part(g, box(0.05, 0.08, 0.12), mat(GRIP), 0.02, 0.22, 0.05);
    part(g, cyl(0.09, 0.08), R, 0.02, 0.1, 0.62, Math.PI / 2);
  },
};
const ITEM_MODELS = {
  pioche(g) {
    part(g, cyl(0.025, 0.85), mat(WOODC), 0, 0.3, 0.05);
    const head = part(g, box(0.06, 0.08, 0.62), mat(0x9aa3ab, { metalness: 0.6, roughness: 0.35 }), 0, 0.72, 0.08);
    head.rotation.x = 0.1;
    part(g, box(0.07, 0.1, 0.12), mat(0xd8432f), 0, 0.72, 0.05);
  },
  bandage(g) { part(g, cyl(0.07, 0.1, 0.07, 16), mat(0xf2efe8, { roughness: 0.9 }), 0, 0, 0.1, Math.PI / 2); part(g, cyl(0.072, 0.03, 0.072, 16), mat(0xd8432f), 0, 0, 0.1, Math.PI / 2); },
  soin(g) { part(g, box(0.28, 0.2, 0.16), mat(0xf2efe8), 0, 0, 0.1); part(g, box(0.06, 0.14, 0.17), mat(0xd8432f), 0, 0, 0.1); part(g, box(0.16, 0.05, 0.17), mat(0xd8432f), 0, 0, 0.1); },
  potion_petite(g) { part(g, sph(0.08), mat(0x5aa8ff, { emissive: 0x1a4a9a, roughness: 0.2 }), 0, 0, 0.1); part(g, cyl(0.025, 0.08), mat(0xd8d8d8), 0, 0.1, 0.1); },
  potion(g) { part(g, cyl(0.1, 0.24, 0.12, 14), mat(0x5aa8ff, { emissive: 0x1a4a9a, roughness: 0.2 }), 0, 0, 0.1); part(g, cyl(0.04, 0.08), mat(0xd8d8d8), 0, 0.16, 0.1); },
  grenade(g) { part(g, sph(0.08), mat(0x4f6a3a), 0, 0, 0.1); part(g, box(0.03, 0.06, 0.03), mat(0xb8bcc0), 0, 0.08, 0.1); },
  souffle(g) { part(g, sph(0.085), mat(0x9b59d0, { emissive: 0x3a1a6a }), 0, 0, 0.1); part(g, cyl(0.03, 0.05), mat(0xf2d060), 0, 0.09, 0.1); },
  tremplin(g) { part(g, cyl(0.28, 0.06, 0.28, 18), mat(0xf2c14e), 0, 0, 0.1); part(g, cyl(0.12, 0.07, 0.12, 3), mat(0xd8432f), 0, 0.01, 0.1); },
};

// modèle d'un objet d'inventaire (ou de l'outil de récolte si it est null)
export function itemModel(it) {
  const g = new THREE.Group();
  if (!it) { ITEM_MODELS.pioche(g); return g; }
  if (it.t === 'arme') { WEAPON_MODELS[it.w](g, mat(new THREE.Color(RARITY[it.r].color).getHex(), { emissive: new THREE.Color(RARITY[it.r].color).multiplyScalar(0.35).getHex() })); return g; }
  if (it.t === 'objet') { ITEM_MODELS[it.c](g); return g; }
  if (it.t === 'munitions') {
    const c = new THREE.Color(AMMO[it.a].color).getHex();
    part(g, box(0.34, 0.2, 0.22), mat(0x4a5040), 0, 0.1, 0); part(g, box(0.35, 0.05, 0.23), mat(c), 0, 0.2, 0);
    return g;
  }
  const c = new THREE.Color(MATERIALS[it.m].color).getHex();
  for (let i = 0; i < 3; i++) part(g, box(0.36, 0.1, 0.18), mat(c), 0, 0.05 + i * 0.1, (i % 2) * 0.05);
  return g;
}
export function disposeModels() { for (const g of geoCache.values()) g.dispose(); for (const m of matCache.values()) m.dispose(); geoCache.clear(); matCache.clear(); }
