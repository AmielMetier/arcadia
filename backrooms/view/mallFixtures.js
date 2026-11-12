// The Backrooms (Level 17, le Mall) - Le gros mobilier fixe. Plus rien n'y est modelé à la main : ce qui n'a pas de
// modèle scanné (fontaines, kiosques, comptoirs, cuisines des stands) n'est plus posé (voir FURN_GONE dans
// engine/mall.js). Il reste de l'architecture simple habillée de matières scannées (des bacs d'enduit, un rideau
// métallique baissé) et des modèles Poly Haven (les plantes, les tables et les chaises du food court).
const PI = Math.PI;

export function createFixtures(K) {
  const { G, MATS, model, lbox, frame, front, rand, panel, menus } = K;

  // --- un gros pot de terre cuite et sa plante (la cour est) : le modèle entier, pot compris ---
  const claypot = (it) => {
    const a = rand(it.id) * 6.28;
    if (it.plant % 3 === 1) model('potted_plant_02', it.x, 0, it.z, a, 2.3, 0, 0, 'potted_plant_02_pot+potted_plant_02_leaves');
    else model('potted_plant_04', it.x, 0, it.z, a, it.plant % 3 ? 4.6 : 4.0);
  };

  // --- des jardinières blanches en gradins (sous la cour centrale, comme au centre de référence) : des bacs d'enduit
  // blanc de hauteurs croissantes qui se chevauchent, leur margelle, leur terre, quelques plantes ---
  const TERRACE = [[-4.7, -2.7, -0.2, 1.8, 0.5], [-2.9, -0.9, -1.0, 1.0, 0.9], [-1.1, 1.1, -1.9, 0.3, 1.3], [0.9, 2.9, -2.6, -0.6, 1.7], [2.7, 4.7, -1.6, 0.4, 1.1], [-1.6, 0.2, 0.8, 2.6, 0.45], [1.0, 3.0, 0.2, 2.2, 0.7]];
  const terrace = (it) => {
    const P = frame(it);
    TERRACE.forEach(([x0, x1, z0, z1, h], i) => {
      const cw = 0.14;
      lbox('plaster', it, x0, x1, 0.05, h - 0.06, z0, z1, '-y+y');
      lbox('marbleDark', it, x0 + 0.03, x1 - 0.03, 0, 0.05, z0 + 0.03, z1 - 0.03, '-y+y');
      // la margelle (un cadre) et la terre, un peu en retrait
      lbox('trim', it, x0 - 0.02, x1 + 0.02, h - 0.06, h, z0 - 0.02, z0 + cw, '-y');
      lbox('trim', it, x0 - 0.02, x1 + 0.02, h - 0.06, h, z1 - cw, z1 + 0.02, '-y');
      lbox('trim', it, x0 - 0.02, x0 + cw, h - 0.06, h, z0 + cw, z1 - cw, '-y');
      lbox('trim', it, x1 - cw, x1 + 0.02, h - 0.06, h, z0 + cw, z1 - cw, '-y');
      lbox('soil', it, x0 + cw, x1 - cw, h - 0.2, h - 0.045, z0 + cw, z1 - cw, '-y');
      const [px, pz] = P((x0 + x1) / 2, (z0 + z1) / 2);
      const a = rand(it.id, i) * 6.28;
      const k = (i + (it.plant || 0) * 3) % 7;
      if (k === 0) model('dead_quiver_trunk', px, h - 0.1, pz, a, 0.9);
      else if (k === 2) {
        model('fern_02', px - 0.2, h - 0.06, pz, a, 2.2, 0, 0, 'fern_02_b');
        model('fern_02', px + 0.35, h - 0.06, pz + 0.3, a + 1, 1.7, 0, 0, 'fern_02_c');
      } else if (k === 3) model('potted_plant_04', px, h - 0.05 - 0.15 * 2.6, pz, a, 2.6, 0, 0, 'potted_plant_04_plant+potted_plant_04_dirt');
      else if (k === 5) model('fern_02', px, h - 0.06, pz, a, 1.9, 0, 0, 'fern_02_c');
    });
  };

  // --- un stand du food court, fermé : son rideau métallique baissé dans la baie (le mur est à 1,10 m derrière le
  // centre de l'ancien comptoir), ses coulisses d'acier, sa lame finale ; au-dessus, son enseigne, éteinte ---
  const stallShut = (it) => {
    const hw = it.w / 2 - 0.2;
    const F = front(it);
    const P = frame(it);
    const zw = -1.1; // le nu du mur
    const top = 2.42;
    lbox(it.sign % 2 ? 'shutterBeige' : 'shutter', it, -hw, hw, 0.07, top, zw, zw + 0.035, '-y+y');
    lbox('steel', it, -hw, hw, 0, 0.07, zw, zw + 0.05, '-y');
    for (const s of [-1, 1]) lbox('steel', it, s * hw - 0.035, s * hw + 0.035, 0, top, zw, zw + 0.07, '-y');
    // le coffre du rideau, puis le bandeau de l'enseigne
    lbox('steel', it, -hw - 0.035, hw + 0.035, top, top + 0.24, zw, zw + 0.16);
    const [x, z] = P(0, zw + 0.02);
    panel('menusOff', menus.uv(it.sign), x, 3.1, z, it.w - 0.6, 0.72, F[0], F[1]);
  };

  // --- une table du food court : une table ronde à pied central, ses chaises (certaines parties, d'autres de
  // travers, une couchée) ---
  const diner = (it) => {
    model('round_wooden_table_01', it.x, 0, it.z, rand(it.id) * 6.28, [0.9, 0.76, 0.9]);
    for (let i = 0; i < 4; i++) {
      if (!((it.chairs >> i) & 1)) continue;
      const a = (i / 4) * PI * 2 + it.id * 0.3;
      const cx = it.x + Math.cos(a) * 0.98;
      const cz = it.z + Math.sin(a) * 0.98;
      const yaw = Math.atan2(-Math.cos(a), -Math.sin(a)) + (rand(it.id, i) - 0.5) * 0.5;
      if (it.tipped && i === 0) model('plastic_monobloc_chair_01', cx, 0.34, cz, yaw, 1, -PI / 2);
      else model('plastic_monobloc_chair_01', cx, 0, cz, yaw);
    }
  };

  return { claypot, terrace, stallShut, diner };
}
