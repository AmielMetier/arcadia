// The Backrooms (Level 17, le Mall) - Ce qui reste dans les grandes surfaces vidées et les locaux techniques : des
// travées de rayonnage d'acier (dégarnies : la liquidation est passée), des palettes et leurs cartons, des plantes en
// pot, des fûts, des armoires électriques, un groupe électrogène. Tout est modèle Poly Haven (CC0), sauf le plateau
// d'une palette (cinq planches) ; les panneaux suspendus annoncent encore chaque rayon.
import { DEPT_SIGN } from './mallGoods.js';

const PI = Math.PI;

export function createDept(K) {
  const { G, model, lbox, frame, front, yawZ, rand, goods, rooms, C } = K;

  // une gondole : des travées de rayonnage d'acier (1,20 m), côte à côte ; une sur cinq manque, quelques cartons
  // restés sur les tablettes
  const BAY = 1.2;
  const gondola = (it) => {
    const P = frame(it);
    const y0 = yawZ(front(it));
    const n = Math.max(1, Math.floor(it.w / BAY));
    for (let i = 0; i < n; i++) {
      if (rand(it.id, i) < (it.empty ? 0.34 : 0.16)) continue;
      const lx = -((n - 1) * BAY) / 2 + i * BAY;
      const [x, z] = P(lx, 0);
      model('steel_frame_shelves_02', x, 0, z, y0, [2, 1, 1.5]);
      const q = rand(it.id, i + 20);
      if (q < 0.3) model('cardboard_box_01', x + (q - 0.15) * 1.2, [0.14, 0.73, 1.33][Math.floor(q * 10)], z, q * 40, 0.85);
    }
  };

  // une palette de bois (trois chevrons, cinq planches) et ses cartons
  const pallet = (it) => {
    const hw = it.w / 2;
    const hd = it.d / 2;
    for (const lz of [-hd + 0.05, 0, hd - 0.05]) lbox('wood', it, -hw, hw, 0, 0.1, lz - 0.05, lz + 0.05, '-y');
    for (let i = 0; i < 5; i++) lbox('wood', it, -hw + (i * (it.w - 0.14)) / 4, -hw + (i * (it.w - 0.14)) / 4 + 0.14, 0.1, 0.125, -hd, hd, '-y');
    const st = Math.min(2, it.stack || 1);
    for (let k = 0; k < st; k++) {
      const a = rand(it.id, k) * 0.5 - 0.25;
      model('cardboard_box_01', it.x + (k ? 0.12 : -0.2), 0.125 + k * 0.42, it.z + (k ? -0.05 : 0.1), a, 1.25);
      if (!k && it.id % 3) model('cardboard_box_01', it.x + 0.32, 0.125, it.z - 0.12, a + 1.4, 1.0);
    }
    if (it.id % 4 === 0) model('cardboard_box_01', it.x + 0.9, 0, it.z + 0.2, rand(it.id) * 6, 1.1, 0, 1.57);
  };

  // les panneaux suspendus des rayons du grand magasin
  const signs = () => {
    for (const r of rooms) {
      if (!r.depts) continue;
      const x = ((r.x0 + r.x1 + 1) * C) / 2 + 1.3;
      for (const d of r.depts) {
        const z = d.z0 + 0.4;
        const y = r.ceilH - 0.75;
        G.box('black', x - 1.36, x + 1.36, y - 0.2, y + 0.2, z - 0.012, z + 0.012);
        goods.sign(DEPT_SIGN[d.dept], x, y, z, 2.6, 0.325, 0, 1, false, true);
        for (const s of [-1, 1]) G.beam('steel', [x + s * 1.1, y + 0.2, z], [x + s * 1.1, r.ceilH, z], 0.012, 0.012);
      }
    }
  };

  // une plante en pot, posée au sol
  const pot = (it) => {
    const a = rand(it.id) * 6.28;
    if (it.plant % 3 === 1) model('potted_plant_02', it.x + 0.05, 0, it.z + 0.1, a, 1.5, 0, 0, 'potted_plant_02_pot+potted_plant_02_leaves');
    else model('potted_plant_04', it.x, 0, it.z, a, it.plant % 3 ? 3.4 : 2.8);
  };
  // des fûts, des bouteilles de gaz, des bacs : en grappe
  const TK = [['Barrel_01', 1], ['Barrel_02', 1.1], ['barrel_03', 1], ['propane_tank', 1], ['industrial_pastic_container', 1.5], ['plastic_container', 1.4]];
  const tanks = (it) => {
    for (let i = 0; i < (it.n || 3); i++) {
      const a = (i / (it.n || 3)) * PI * 2 + it.id;
      const r = i ? 0.55 + rand(it.id, i) * 0.25 : 0;
      const [name, sc] = TK[(it.tk + (i % 2 ? 0 : i)) % TK.length];
      model(name, it.x + Math.cos(a) * r, 0, it.z + Math.sin(a) * r, rand(it.id, i + 3) * 6, sc);
    }
  };
  // deux armoires électriques côte à côte, leurs gaines jusqu'au plafond
  const panelbox = (it) => {
    const P = frame(it);
    const y0 = yawZ(front(it));
    const top = K.hAt(Math.floor(it.x / C), Math.floor(it.z / C)) || 3;
    for (const [lx, name] of [[-0.62, 'utility_box_02'], [0.45, 'utility_box_01'], [0.98, it.id % 2 ? 'utility_box_01' : null]]) {
      if (!name) continue;
      const [x, z] = P(lx, -0.1);
      model(name, x, 0, z, y0);
      G.beam('steel', [x, 1.12, z], [x, top - 0.02, z], 0.05, 0.05);
    }
  };
  // le groupe électrogène, ses bidons
  const genset = (it) => {
    model('portable_generator', it.x, 0, it.z, 0.3, 1.5);
    model('oil_tin', it.x + 0.85, 0, it.z + 0.2, 1, 1.6);
    model('can_rusted', it.x + 0.7, 0, it.z - 0.3, 2, 1.5);
    model('Barrel_02', it.x - 0.95, 0, it.z + 0.1, 0.5, 1);
  };

  return { gondola, pallet, signs, pot, tanks, panelbox, genset };
}
