// Convoy Storm — géométrie du convoi et paysages procéduraux (moteur pur : ni DOM, ni réseau).
//
// Repères :
//  - « repère du train » : le convoi est immobile, l'avant pointe vers -Z, le centre de la chaudière est à l'origine.
//    Les joueurs, la caméra et la vue 3D vivent dans ce repère.
//  - « repère du sol » : le long de la voie. Un objet posé au sol a une coordonnée `zw` (= −distance le long de la voie) ;
//    dans le repère du train, il se trouve en z = zw + dist (dist = distance parcourue). La simulation ne voit qu'une voie
//    droite ; c'est l'affichage qui l'enroule sur les virages (engine/line.js), sans rien changer aux règles.
import { makeRng, hash } from './rng.js';
import { MODEL_SIZE } from './sizes.js';

export const DECK_Y = 1.6;          // hauteur du plancher des wagons
export const HALF_W = 1.75;         // demi-largeur du plancher
export const DECK_FRONT = -12.9;    // le plancher s'arrête devant la cabine de la locomotive
export const REAR = 16.5;           // arrière du dernier wagon (échelle)
export const BODY_FRONT = -19.4;    // chasse-neige (au sol)
export const BOILER = { x: 0, z: 0, r: 1.2, top: DECK_Y + 2.2, mouth: 0.95 };
export const LADDER = { x: 1.1, z0: REAR - 0.15, z1: REAR + 1.5 };
export const WAGONS = [[-19.4, -6.2], [-5.4, 5.4], [6.2, REAR]]; // locomotive, wagon chaudière, wagon de queue

// Obstacles posés sur le plancher (repère du train)
export const DECK_BOXES = [
  { x0: -1.2, x1: 1.2, z0: -13.2, z1: -9.8 },   // cabine (deux coursives de part et d'autre)
  { x0: -HALF_W, x1: -0.55, z0: 9.0, z1: 12.0 }, // bac à charbon du wagon de queue (la tourelle s'y installe)
  { x0: 0.75, x1: HALF_W, z0: -4.6, z1: -3.2 },  // caisse à outils (l'atelier s'y installe)
];

export const CHUNK = 36;            // longueur d'un tronçon de plaine (m)

// Paysages : chaque tronçon entre deux gares traverse un paysage qui change les règles du jeu.
// ruins / trees : nombre de ruines et de sapins isolés par tronçon ; wolves, raid (écart entre deux raids), cold : multiplicateurs ;
// ev : poids des événements de voie ; loot : poids des types de caisses ; moments : poids des moments forts ;
// kinds : poids des types de ruines ; kmax : courbure maximale des virages (1/m) ; grade : pente maximale ;
// ice : sol glissant qui craque ; tunnels : la voie passe sous la montagne ; snipers : tireurs sur les toits ;
// fast : la voie est dégagée, le convoi y file plus vite (multiplicateur de vitesse).
export const BIOMES = {
  plaine: { icon: '❄️', label: 'Plaine gelée', desc: 'Une voie droite et dégagée : le convoi file plus vite et reprend de l\'avance sur le Front. Des fermes isolées où recueillir des survivants.', ruins: [1, 3], trees: [2, 6], wolves: 1, raid: 1, cold: 1, kmax: 1 / 220, grade: 0, fast: 1.12,
    ev: { drift: 45, aval: 30, gust: 25 }, loot: { fuel: 62, coal: 18, ice: 14, parts: 6 }, moments: { wreck: 40, boss: 35, roar: 25 },
    kinds: [['farm', 24], ['house', 16], ['depot', 10], ['hulk', 14], ['temple', 9], ['pylon', 8], ['silo', 7], ['platform', 8], ['cabin', 6]] },
  foret: { icon: '🌲', label: 'Forêt noire', desc: 'Des sapins à perte de vue : on y abat du bois, à l\'abri du vent… mais les loups chassent en meute.', ruins: [0, 2], trees: [0, 0], wolves: 2.2, raid: 1.4, cold: 0.8, kmax: 1 / 150, grade: 0.015, dense: true,
    ev: { drift: 60, aval: 10, gust: 30 }, loot: { wood: 40, coal: 25, fuel: 27, parts: 8 }, moments: { roar: 50, wreck: 50 },
    kinds: [['sawmill', 35], ['cabin', 35], ['hulk', 15], ['house', 15]] },
  ville: { icon: '🏚️', label: 'Ville en ruine', desc: 'Des immeubles à fouiller de fond en comble, des pièces détachées… et des tireurs sur les toits.', ruins: [2, 4], trees: [0, 3], wolves: 0.6, raid: 0.55, cold: 1, kmax: 1 / 300, grade: 0, snipers: true,
    ev: { drift: 40, aval: 20, gust: 40 }, loot: { fuel: 52, parts: 22, coal: 12, ice: 14 }, moments: { boss: 70, wreck: 30 },
    kinds: [['block', 55], ['depot', 15], ['house', 15], ['platform', 8], ['hulk', 7]] },
  lac: { icon: '🧊', label: 'Lac gelé', desc: 'Ça glisse, et la glace craque si l\'on reste planté. Des bateaux pris dans la glace.', ruins: [1, 2], trees: [0, 2], wolves: 0.8, raid: 1, cold: 1.2, kmax: 1 / 200, grade: 0, ice: true,
    ev: { drift: 20, aval: 0, gust: 80 }, loot: { ice: 50, fuel: 36, coal: 8, parts: 6 }, moments: { bridge: 60, boss: 40 },
    kinds: [['boat', 55], ['hut', 30], ['pylon', 15]] },
  col: { icon: '⛰️', label: 'Col des Glaces', desc: 'Une falaise, un ravin, des tunnels et des pentes raides. Du charbon au fond des mines.', ruins: [1, 2], trees: [2, 5], wolves: 1, raid: 1.5, cold: 1.3, kmax: 1 / 105, grade: 0.045, tunnels: true,
    ev: { drift: 30, aval: 55, gust: 15 }, loot: { coal: 45, fuel: 35, ice: 14, parts: 6 }, moments: { bridge: 55, roar: 45 },
    kinds: [['mine', 45], ['temple', 20], ['pylon', 15], ['silo', 20]] },
  usine: { icon: '🏭', label: 'Raffinerie', desc: 'Des cuves pleines de fioul à pomper… et des étincelles qui mettent le feu.', ruins: [2, 3], trees: [0, 1], wolves: 0.5, raid: 0.8, cold: 1, kmax: 1 / 280, grade: 0,
    ev: { drift: 50, aval: 0, gust: 50 }, loot: { fuel: 55, parts: 30, coal: 10, ice: 5 }, moments: { boss: 55, wreck: 45 },
    kinds: [['tank', 50], ['factory', 35], ['depot', 15]] },
  toundra: { icon: '🦌', label: 'Toundra', desc: 'Le vent, le grand froid, des caches de trappeurs… et des troupeaux de rennes sur la voie.', ruins: [1, 3], trees: [1, 4], wolves: 1.4, raid: 1.2, cold: 1.4, kmax: 1 / 260, grade: 0.012,
    ev: { herd: 45, gust: 40, drift: 15 }, loot: { fuel: 45, ice: 30, coal: 15, parts: 10 }, moments: { roar: 50, wreck: 50 },
    kinds: [['cache', 55], ['cabin', 25], ['hulk', 20]] },
};
export const BIOME_KEYS = Object.keys(BIOMES);

// Ce que chaque type de ruine cache : butin favori, chance d'y trouver un survivant, chance d'embuscade, nombre de points de fouille
const KIND_INFO = {
  camp: { surv: 0.3 }, cabin: { surv: 0.35 }, hut: { surv: 0.3 }, house: { surv: 0.12 }, farm: { surv: 0.55 }, cache: { surv: 0.2, lk: 1.5 },
  block: { surv: 0.12, amb: 0.14, spots: 3 }, factory: { amb: 0.25, spots: 2, lb: 'parts' }, depot: { amb: 0.1 },
  sawmill: { lb: 'wood', lk: 1.3 }, mine: { lb: 'coal' }, boat: { lb: 'ice', lk: 1.3 }, tank: { lb: 'fuel' },
};

const SZ = (m) => MODEL_SIZE[m] || [1, 1, 1];
// morceau d'un modèle, à l'échelle s (uniforme), posé en (dx, dz) dans le repère de la ruine
const piece = (m, s, dx = 0, dz = 0, r = 0) => { const [w, h, d] = SZ(m); return { dx, dz, w: w * s, d: d * s, h: h * s, r, m: 'model:' + m, u: 1 }; };
const normSpans = (c) => (!c ? [] : typeof c[0] === 'number' ? [c] : c);

// Ruines et décor d'un tronçon k (zw dans [-(k+1)·CHUNK, -k·CHUNK]). Déterministe : même graine → même paysage partout.
// Chaque ruine : morceaux solides (boîtes de collision), points de fouille (butin, ferraille, survivant, embuscade),
// et parfois un site de ressource (wagonnet de mine, cuve de fioul). Un morceau dont la matière commence par « model: »
// est dessiné avec un modèle 3D (Kenney, CC0) ajusté à sa boîte.
// env : { bio, clear: [[d0, d1], …], cs } — le paysage, les portions de voie à laisser vides (pont, aiguillage, tunnel…),
// et le côté de la falaise dans le col (+1 / −1).
export function chunkRuins(seed, k, lootRate, env = {}) {
  const bio = BIOMES[env.bio] ? env.bio : 'plaine', B = BIOMES[bio];
  const spans = normSpans(env.clear);
  const cleared = (zw, m = 10) => spans.some(([a, b]) => -zw > a - m && -zw < b + m);
  const cs = env.cs || 1;
  const rng = makeRng(hash(seed ^ Math.imul(k + 1, 0x9e3779b1)));
  const z0 = -k * CHUNK;
  const out = [];
  const n = k < 0 ? 0 : rng.int(B.ruins[0], B.ruins[1]);
  for (let j = 0; j < n; j++) {
    let side = rng.chance(0.5) ? -1 : 1;
    let x = side * rng.range(10.5, 24);
    const zw = z0 - rng.range(5, CHUNK - 5);
    // camp de ravitaillement abandonné : rare, mais plein (3 caisses et de la ferraille)
    const camp = k > 2 && j === 0 && rng.chance(0.07);
    const kind = camp ? 'camp' : rng.weighted(B.kinds);
    let rot = rng.range(-0.5, 0.5);
    if (kind === 'block' || kind === 'factory' || kind === 'tank') rot *= 0.2; // les bâtiments restent face à la voie
    const id = k * 8 + j;
    // dans le col : les mines s'ouvrent dans la falaise, le reste s'accroche côté ravin
    if (bio === 'col') { side = kind === 'mine' ? cs : -cs; x = side * (kind === 'mine' ? 12.5 : rng.range(10.5, 20)); }
    if (out.some((r) => Math.hypot(r.x - x, r.zw - zw) < 12)) continue;
    const built = buildRuin(kind, rng, side);
    const I = KIND_INFO[kind] || {};
    const spots = built.spots.map(([toward, oz], si) => {
      const lootChance = Math.min(0.95, (si === 0 ? lootRate : lootRate * 0.75) * (I.lk || 1));
      return {
        x: x - side * toward, zw: zw + oz,
        loot: camp && si === 0 ? 3 : rng.chance(lootChance) ? (rng.chance(0.25) ? 2 : 1) : 0,
        scrap: camp && si === 0 ? 3 : (kind === 'depot' || kind === 'hulk' || kind === 'factory' ? 1 : 0) + (rng.chance(0.45) ? 1 : 0),
        surv: rng.chance(I.surv || 0) ? 1 : 0, amb: rng.chance(I.amb || 0) ? 1 : 0,
      };
    });
    if (cleared(zw, 14)) continue;
    const r = { id, k, kind, x, zw, rot, pieces: built.pieces, side, spots, spot: spots[0], loot: spots.reduce((a, s) => a + s.loot, 0), scrap: spots.reduce((a, s) => a + s.scrap, 0),
      lb: I.lb || null, seed: hash(id + seed) };
    const R = built.res;
    if (R && R.k === 'cart') r.res = { k: 'cart', id, zw, x0: x - side * R.x0, x1: side * R.x1 };
    else if (R && R.k === 'tank') r.res = { k: 'tank', id, zw, x: x - side * R.toward, fuel: R.fuel };
    if (kind === 'block' && B.snipers && rng.chance(0.4)) r.sn = { h: built.pieces[0].h };
    out.push(r);
  }
  // caisse tombée d'un convoi précédent, parfois, au bord des rails
  let loose = rng.chance(lootRate * 0.6) ? { x: (rng.chance(0.5) ? -1 : 1) * rng.range(3.4, 12), zw: z0 - rng.range(3, CHUNK - 3) } : null;
  if (loose && cleared(loose.zw)) loose = null;
  const near = (x, zw, rr = 8, sr = 3.2) => out.some((q) => Math.hypot(q.x - x, q.zw - zw) < rr || q.spots.some((s) => Math.hypot(s.x - x, s.zw - zw) < sr)
    || (q.res && q.res.k === 'cart' && Math.abs(q.zw - zw) < 2.5 && (x - q.res.x1) * (x - q.res.x0) < 0)
    || (q.res && q.res.k === 'tank' && Math.abs(q.zw - zw) < 3 && Math.abs(x) < Math.abs(q.res.x) + 1));
  // arbres (solides, et on peut les abattre) : épars, ou une vraie forêt dense en dehors d'un couloir autour de la voie
  const trees = [];
  const addTree = (x, zw, h, m) => trees.push({ id: k * 1000 + trees.length, m, x, zw, h, s: h / SZ(m)[1], r: rng.range(0, 6.28) });
  if (B.dense && k >= -2) {
    const cell = 3.3, cx = rng.range(-1, 1) > 0 ? 1 : -1, ccz = z0 - rng.range(8, 28), cr = rng.range(5, 8); // une clairière
    for (const s of [-1, 1]) for (let gx = 0; gx < 13; gx++) for (let gz = 0; gz < 11; gz++) {
      const ax = 6.5 + gx * cell + rng.range(0, cell * 0.8), x = s * ax, zw = z0 - Math.min(CHUNK - 0.2, gz * cell + rng.range(0, cell * 0.9));
      const p = ax < 9 ? 0.45 : 0.85, h = rng.range(5, 7) + Math.min(4, (ax - 6.5) * 0.12), m = rng.weighted(FOREST_TREES);
      if (!rng.chance(p) || cleared(zw, 6) || near(x, zw, 8.5, 3.5) || (s === cx && Math.hypot(ax - 16, zw - ccz) < cr)) continue;
      addTree(x, zw, h, m);
    }
  } else if (k >= -2) {
    for (let i = rng.int(B.trees[0], B.trees[1]); i > 0; i--) {
      const tx = (rng.chance(0.5) ? -1 : 1) * rng.range(5.5, 34), tz = z0 - rng.range(0, CHUNK), h = rng.range(4.5, 8.5);
      const m = bio === 'ville' || bio === 'usine' ? 'nature/tree_thin_dark' : bio === 'toundra' ? rng.pick(['nature/tree_pineSmallA', 'nature/tree_pineSmallC', 'holiday/tree-snow-c']) : rng.weighted(FOREST_TREES);
      if (cleared(tz) || near(tx, tz)) continue;
      if (bio === 'col' && tx * cs > 11) continue; // pas d'arbre dans la falaise
      addTree(tx, tz, bio === 'toundra' ? h * 0.5 : h, m);
    }
  }
  const decor = k >= -2 ? buildDecor(bio, rng, z0, cs, cleared, near, spans) : [];
  return { ruins: out, loose, trees, decor, bio, clear: spans.length ? spans : null };
}

const FOREST_TREES = [['holiday/tree-snow-a', 22], ['holiday/tree-snow-b', 18], ['holiday/tree-snow-c', 12], ['nature/tree_pineTallB', 12],
  ['nature/tree_pineTallD', 12], ['nature/tree_pineTallA', 8], ['nature/tree_pineRoundA', 6], ['nature/tree_cone_dark', 10]];

// Décor d'un tronçon : { m (modèle), x, zw, s (échelle), r (rotation), col (solide) } ; quelques entrées spéciales
// (m commençant par « ~ ») sont dessinées à la main par la vue : falaise, ravin, pipeline, troupeau…
function buildDecor(bio, rng, z0, cs, cleared, near, spans) {
  const D = [];
  const add = (m, x, zw, s, r = rng.range(0, 6.28), col = 0) => { if (!cleared(zw, 4) && !near(x, zw, 6, 2.6)) D.push({ m, x, zw, s, r, col }); };
  const around = (n, x0, x1, fn) => { for (let i = 0; i < n; i++) { const s = rng.chance(0.5) ? -1 : 1; fn(s * rng.range(x0, x1), z0 - rng.range(0, CHUNK), s); } };
  if (bio === 'foret') {
    around(4, 6, 30, (x, zw) => add('nature/log_large', x, zw, rng.range(3.2, 4.4), rng.range(0, 6.28), 1));
    around(6, 6, 34, (x, zw) => add(rng.pick(['nature/stump_old', 'nature/stump_round']), x, zw, rng.range(2.4, 3.4)));
    around(9, 5, 30, (x, zw) => add('nature/plant_bushLarge', x, zw, rng.range(3, 5)));
    around(3, 7, 30, (x, zw) => add(rng.pick(['nature/rock_largeA', 'nature/rock_largeC']), x, zw, rng.range(2.5, 4), rng.range(0, 6.28), 1));
  } else if (bio === 'ville') {
    // façades continues des deux côtés (avec une rue qui croise tous les deux tronçons), gratte-ciel au loin
    for (const s of [-1, 1]) {
      for (let z = 0; z < CHUNK;) {
        const m = rng.pick(['commercial/building-a', 'commercial/building-b', 'commercial/building-d', 'commercial/building-e']), sc = rng.range(6.5, 8);
        const w = SZ(m)[0] * sc; if (z + w > CHUNK) break;
        if (!(Math.abs(z0 / CHUNK) % 2 === 0 && z < 9)) add(m, s * (28 + SZ(m)[2] * sc / 2 + rng.range(0, 2)), z0 - z - w / 2, sc, s > 0 ? -Math.PI / 2 : Math.PI / 2, 1);
        z += w + rng.range(0.5, 2);
      }
      for (let i = 0; i < 2; i++) add(rng.pick(['commercial/low-detail-building-a', 'commercial/low-detail-building-b', 'commercial/low-detail-building-c', 'commercial/building-skyscraper-a']), s * rng.range(48, 70), z0 - rng.range(0, CHUNK), rng.range(9, 13), 0);
    }
    around(3, 5, 14, (x, zw) => add(rng.pick(['racing/vehicle-truck-red', 'racing/vehicle-truck-green', 'racing/vehicle-truck-yellow']), x, zw, rng.range(2.2, 2.8), rng.range(0, 6.28), 1));
    around(2, 4.5, 6, (x, zw) => D.push({ m: '~lamp', x, zw, s: 1, r: 0, col: 0 }));
  } else if (bio === 'lac') {
    // la rive boisée au loin d'un côté, la glace de l'autre : pontons, barques prises dans la glace, campements de pêche
    for (let z = 0; z < CHUNK; z += rng.range(2.6, 4.2)) {
      add(rng.weighted(FOREST_TREES), cs * rng.range(37, 50), z0 - z, rng.range(2.6, 3.8), rng.range(0, 6.28));
      if (rng.chance(0.35)) add(rng.pick(['nature/rock_largeA', 'nature/rock_largeC', 'holiday/rocks-large']), cs * rng.range(33, 36), z0 - z, rng.range(1.2, 2.6));
    }
    around(2, 9, 30, (x, zw) => add('pirate/structure-platform-dock-small', x, zw, rng.range(2.4, 3.2)));
    around(3, 6, 28, (x, zw) => add(rng.pick(['nature/canoe', 'pirate/boat-row-small', 'pirate/boat-row-large']), x, zw, rng.range(2.5, 3.5) * (rng.chance(0.5) ? 1 : 0.5)));
    around(3, 8, 34, (x, zw) => add('holiday/snow-pile', x, zw, rng.range(3, 6)));
    around(1, 10, 30, (x, zw) => add('holiday/rocks-large', x, zw, rng.range(0.9, 1.4), rng.range(0, 6.28), 1));
    // campement de pêche : tente, brasero, tonneau, trou dans la glace marqué d'un fanion
    if (rng.chance(0.6)) {
      const s = rng.chance(0.5) ? -1 : 1, cx = s * rng.range(11, 26), cz = z0 - rng.range(6, CHUNK - 6);
      if (!cleared(cz, 4) && !near(cx, cz, 9, 4)) {
        D.push({ m: 'survival/tent', x: cx, zw: cz, s: rng.range(5, 6), r: rng.range(0, 6.28), col: 1 });
        D.push({ m: 'survival/campfire-pit', x: cx - s * 2.6, zw: cz + 1.4, s: 5, r: 0, col: 0 });
        D.push({ m: 'pirate/barrel', x: cx + 1.8, zw: cz - 2, s: 0.55, r: 0, col: 1 });
        D.push({ m: '~hole', x: cx - s * 4.5, zw: cz - 2.5, s: rng.range(0.9, 1.3), r: 0, col: 0 });
        D.push({ m: 'platformer/flag', x: cx - s * 3.6, zw: cz - 3.6, s: 1.6, r: rng.range(0, 6.28), col: 0 });
      }
    }
    around(2, 6, 30, (x, zw) => D.push({ m: '~hole', x, zw, s: rng.range(0.7, 1.2), r: 0, col: 0 }));
    if (rng.chance(0.16)) around(1, 18, 30, (x, zw) => add('pirate/ship-wreck', x, zw, rng.range(0.85, 1), rng.range(0, 6.28), 1));
    if (rng.chance(0.12)) add('pirate/tower-watch', cs * rng.range(30, 33), z0 - rng.range(4, CHUNK - 4), 1.8, rng.range(0, 6.28), 1);
  } else if (bio === 'col') {
    // la falaise d'un côté (blocs solides jointifs, que la vue recouvre d'une paroi d'un seul tenant), le ravin de l'autre ;
    // la falaise s'interrompt aux gares et aux aiguillages, mais pas aux tunnels qui la traversent
    const open = (zw) => spans.some(([a, b, t]) => !t && -zw > a - 10 && -zw < b + 10);
    for (let z = 0; z < CHUNK;) { const sc = rng.range(7, 10), zw = z0 - z - sc / 2; if (!open(zw)) D.push({ m: 'nature/cliff_block_rock', x: cs * (15 + sc / 2), zw, s: sc, r: 0, col: 1, wall: 1 }); z += sc * 0.9; }
    D.push({ m: '~cliff', x: cs * 15, zw: z0 - CHUNK / 2, s: 1, r: 0, col: 0 });
    around(2, 26, 44, (x, zw) => { if (x * cs > 0) add(rng.pick(['nature/rock_tallA', 'nature/rock_tallC', 'nature/rock_tallG']), x, zw, rng.range(8, 13), rng.range(0, 6.28), 1); });
    around(3, 6, 14, (x, zw) => add(rng.pick(['nature/rock_largeA', 'nature/rock_largeE']), x, zw, rng.range(2, 3.5), rng.range(0, 6.28), 1));
    D.push({ m: '~ravine', x: -cs * 30, zw: z0 - CHUNK / 2, s: 1, r: 0, col: 0 });
  } else if (bio === 'usine') {
    around(4, 7, 20, (x, zw) => add(rng.pick(['industrial/shipping-container-a', 'industrial/shipping-container-b']), x, zw, rng.range(6.5, 7.5), rng.pick([0, Math.PI / 2, 0.1]), 1));
    around(1, 26, 42, (x, zw) => add(rng.pick(['industrial/chimney-large', 'industrial/water-tower']), x, zw, rng.range(7, 9), 0, 1));
    around(2, 30, 50, (x, zw) => add(rng.pick(['industrial/building-a', 'industrial/building-f', 'industrial/building-k']), x, zw, rng.range(6, 8), rng.pick([0, Math.PI / 2]), 1));
    for (const s of [-1, 1]) D.push({ m: '~pipe', x: s * 7.6, zw: z0 - CHUNK / 2, s: 1, r: 0, col: 0 });
  } else if (bio === 'toundra') {
    around(3, 8, 40, (x, zw) => add(rng.pick(['nature/rock_largeA', 'nature/rock_largeC', 'holiday/rocks-large']), x, zw, rng.range(1.2, 3), rng.range(0, 6.28), 0));
    around(6, 6, 42, (x, zw) => add('holiday/snow-pile', x, zw, rng.range(3, 8)));
    // bosquets de sapins nains, aiguilles de roche, campements de nomades (tentes, feu, traîneau)
    around(2, 10, 40, (x, zw) => { for (let i = rng.int(3, 7); i > 0; i--) add(rng.pick(['nature/tree_pineSmallA', 'nature/tree_pineSmallC']), x + rng.range(-4, 4), zw + rng.range(-4, 4), rng.range(2.4, 3.8)); });
    if (rng.chance(0.5)) around(1, 16, 40, (x, zw) => add('nature/rock_tallE', x, zw, rng.range(9, 15), rng.range(0, 6.28), 1));
    if (rng.chance(0.4)) {
      const s = rng.chance(0.5) ? -1 : 1, cx = s * rng.range(14, 30), cz = z0 - rng.range(6, CHUNK - 6);
      if (!cleared(cz, 4) && !near(cx, cz, 10, 4)) {
        D.push({ m: 'nature/tent_detailedClosed', x: cx, zw: cz, s: rng.range(4, 4.8), r: rng.range(0, 6.28), col: 1 });
        D.push({ m: 'nature/tent_detailedClosed', x: cx + s * 4.5, zw: cz + rng.range(2, 4), s: rng.range(3.6, 4.4), r: rng.range(0, 6.28), col: 1 });
        D.push({ m: 'nature/campfire_logs', x: cx + s * 2, zw: cz - 3, s: 6, r: 0, col: 0 });
        D.push({ m: 'holiday/sled', x: cx - s * 3, zw: cz - 1, s: 2.6, r: rng.range(0, 6.28), col: 1 });
        D.push({ m: 'holiday/lantern', x: cx + s * 1.2, zw: cz - 4.4, s: 1, r: 0, col: 0 });
      }
    }
    if (rng.chance(0.55)) { const s = rng.chance(0.5) ? -1 : 1; D.push({ m: '~herd', x: s * rng.range(18, 34), zw: z0 - rng.range(6, 30), s: rng.int(4, 8), r: rng.range(0, 6.28), col: 0 }); }
  } else {
    around(2, 6, 30, (x, zw) => add(rng.pick(['nature/rock_largeA', 'nature/rock_largeE']), x, zw, rng.range(1.5, 3)));
    around(3, 6, 34, (x, zw) => add('nature/plant_bush', x, zw, rng.range(2.5, 4)));
    // la ligne télégraphique qui longe la voie, des champs clos, des bosquets, du bois empilé, des panneaux
    D.push({ m: '~tele', x: -cs * 5.6, zw: z0 - CHUNK / 2, s: 1, r: 0, col: 0 });
    if (rng.chance(0.7)) {
      const s = rng.chance(0.5) ? -1 : 1, x0 = s * rng.range(10, 22), zs = z0 - rng.range(2, 10), along = rng.chance(0.6);
      for (let i = rng.int(5, 10); i > 0; i--) {
        const x = along ? x0 : x0 + s * i * 2.25, zw = along ? zs - i * 2.25 : zs;
        if (!rng.chance(0.15)) add('survival/fence-fortified', x, zw, 4.5, along ? Math.PI / 2 : 0, 0);
      }
    }
    if (rng.chance(0.55)) around(1, 14, 36, (x, zw) => { for (let i = rng.int(3, 7); i > 0; i--) add(rng.pick(['holiday/tree-snow-a', 'holiday/tree-snow-b', 'holiday/tree-snow-c', 'nature/tree_pineRoundA']), x + rng.range(-5, 5), zw + rng.range(-5, 5), rng.range(2.4, 3.6)); });
    if (rng.chance(0.4)) around(1, 7, 24, (x, zw) => add(rng.pick(['nature/log_stack', 'nature/log_stackLarge']), x, zw, rng.range(3.4, 4.2), rng.range(0, 6.28), 1));
    if (rng.chance(0.25)) around(1, 4.5, 7, (x, zw) => add('survival/signpost', x, zw, 4.6, rng.range(0, 6.28)));
    if (rng.chance(0.2)) around(1, 9, 26, (x, zw) => add('fantasy/cart', x, zw, rng.range(1.6, 2), rng.range(0, 6.28), 1));
    if (rng.chance(0.05)) around(1, 8, 20, (x, zw) => add('holiday/snowman', x, zw, 1.6, rng.range(0, 6.28)));
  }
  return D;
}

// Morceaux d'une ruine dans son repère local (dx, dz, largeur w, profondeur d, hauteur h, rotation r, matière m),
// points de fouille [vers la voie, décalage le long de la voie], site de ressource éventuel.
const HOUSES = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d'];
const HOUSE_H = { 'building-small-a': 0.95, 'building-small-b': 1.63, 'building-small-c': 1.75, 'building-small-d': 1.0 };
const TRUCKS = ['vehicle-truck-red', 'vehicle-truck-green', 'vehicle-truck-yellow'];
function buildRuin(kind, rng, side) {
  const P = [];
  const box = (dx, dz, w, d, h, r = 0, m = 'stone') => P.push({ dx, dz, w, d, h, r, m });
  let spots = [[5.2, 0]], res = null;
  if (kind === 'house') {
    const name = rng.pick(HOUSES), S = rng.range(4.6, 5.6);
    box(0, 0, S, S, HOUSE_H[name] * S, 0, 'model:city/' + name);
    if (rng.chance(0.7)) box(rng.chance(0.5) ? -S * 0.75 : S * 0.75, rng.range(-1, 1), 1.8, 1.4, 0.8, rng.range(-0.6, 0.6), 'model:arena/bricks');
  } else if (kind === 'farm') {
    // ferme isolée de la plaine : la maison, l'enclos derrière, la charrette et le bois du dernier hiver
    const name = rng.pick(['building-small-a', 'building-small-d']), S = rng.range(4.8, 5.4);
    box(0, 0, S, S, HOUSE_H[name] * S, 0, 'model:city/' + name);
    for (const dz of [-2.25, 0, 2.25]) if (dz === 0 || rng.chance(0.8)) P.push(piece('survival/fence-fortified', 4.5, side * (S / 2 + 3.4), dz, Math.PI / 2));
    P.push(piece('fantasy/cart', rng.range(1.8, 2.1), 0, S / 2 + 1.9, rng.range(-0.4, 0.4)));
    P.push(piece('nature/log_stack', 4, side * 0.8, -(S / 2 + 1.4), Math.PI / 2));
  } else if (kind === 'depot') {
    const S = rng.range(5.6, 6.6);
    box(0, 0, S, S, 0.55 * S, 0, 'model:city/building-garage');
    box(S * 0.2, S * 0.75, 2.4, 1.4, 0.9, 0.3, 'model:arena/bricks');
  } else if (kind === 'platform') {
    box(0, 0, 7, 2.2, 0.7, 0, 'concrete');                       // quai de gare abandonné
    box(-2.6, -0.4, 0.4, 0.4, 2.8, 0, 'metal'); box(2.6, -0.4, 0.4, 0.4, 2.8, 0, 'metal');
    box(0, -0.4, 6.4, 1.6, 0.2, 0.12, 'roof');                    // auvent effondré
  } else if (kind === 'pylon') {
    // tour de guet abandonnée, une caisse tombée au pied
    P.push(piece('pirate/tower-watch', rng.range(1.7, 2), 0, 0, rng.range(0, 6.28)));
    P.push(piece('pirate/crate', 1.6, 2.6, 1.8, rng.range(0, 6.28)));
  } else if (kind === 'hulk') {
    const S = rng.range(1.5, 1.8);
    box(0, 0, 1.5 * S, 2.9 * S, 1.4 * S, rng.range(-0.3, 0.3), 'model:racing/' + rng.pick(TRUCKS));
  } else if (kind === 'temple') {
    // vieux monument : colonnes brisées, statue gelée, pan de mur
    for (const [dx, dz] of [[-2.2, -1.6], [2.2, -1.6], [-2.2, 1.6]]) if (rng.chance(0.85)) box(dx, dz, 1.9, 1.9, 2.3, 0, 'model:arena/column-damaged');
    box(rng.range(-0.5, 0.5), 0, 1.7, 1.7, 3.3, 0, 'model:arena/statue');
    if (rng.chance(0.6)) box(2.2, 1.8, 2.6, 1.5, 2.6, 0, 'model:arena/wall');
  } else if (kind === 'camp') {
    box(0, 0, 6.5, 6.5, 2.2, 0, 'model:racing/decoration-tents');
    box(4.2, -1.5, 1.5, 2.9, 1.4, 0.5, 'model:racing/vehicle-truck-green');
  } else if (kind === 'block') {
    // immeuble de ville : trois portes à fouiller (devant et sur les côtés)
    const m = rng.pick(['commercial/building-a', 'commercial/building-b', 'commercial/building-c', 'commercial/building-d']);
    P.push(piece(m, rng.range(6.6, 7.4), 0, 0, side > 0 ? -Math.PI / 2 : Math.PI / 2));
    spots = [[5.4, 0], [0, 4.8], [0, -4.8]];
  } else if (kind === 'factory') {
    P.push(piece(rng.pick(['industrial/building-c', 'industrial/building-a']), rng.range(4.4, 5), 0, 0, 0));
    spots = [[6.4, 0], [0, 6.6]];
  } else if (kind === 'tank') {
    // cuve de fioul : on tire le tuyau jusqu'à la chaudière du convoi
    P.push(piece('industrial/detail-tank-large', rng.range(4.4, 5), 0, 0, 0));
    spots = [[0, 5.6]];
    res = { k: 'tank', toward: 4.6, fuel: 45 };
  } else if (kind === 'sawmill') {
    P.push(piece('nature/log_stackLarge', rng.range(4.6, 5.4), 0, -2.2, 0));
    P.push(piece('nature/log_stackLarge', rng.range(4.2, 5), 0.4, 2.4, Math.PI));
    P.push(piece('survival/structure-metal', rng.range(5.4, 6), 3.4, 0, 0));
    P.push(piece('nature/log_large', rng.range(3.2, 3.8), -3.2, 0, Math.PI / 2));
  } else if (kind === 'cabin') {
    P.push(piece('survival/structure-metal', rng.range(6.4, 7.2), 0, 0, rng.range(-0.3, 0.3)));
    P.push(piece('survival/campfire-pit', 5, -2.6 * side, 3, 0));
    P.push(piece('nature/log_stack', 4, 2.4, -3.2, Math.PI / 2));
  } else if (kind === 'hut') {
    P.push(piece('survival/tent', rng.range(5.4, 6.2), 0, 0, rng.range(0, 6.28)));
    P.push(piece('pirate/structure-platform-dock-small', 2.2, 0, 4, 0));
  } else if (kind === 'boat') {
    if (rng.chance(0.4)) P.push(piece('pirate/ship-wreck', rng.range(0.62, 0.72), 0, 0, rng.range(-0.5, 0.5)));
    else P.push(piece('pirate/boat-row-large', rng.range(1.8, 2.2), 0, 0, rng.range(0, 6.28)));
  } else if (kind === 'cache') {
    P.push(piece('holiday/sled', rng.range(3.4, 4), 0, 0, rng.range(0, 6.28)));
    P.push(piece('survival/box-large', 4, 1.6, 1.4, 0.4));
    P.push(piece('survival/chest', 4, -1.4, -1.2, -0.3));
  } else if (kind === 'mine') {
    // entrée de mine dans la falaise, wagonnet de charbon sur une petite voie qui descend jusqu'au convoi
    box(0, -2.4, 1.0, 0.6, 3.4, 0, 'wood'); box(0, 2.4, 1.0, 0.6, 3.4, 0, 'wood');
    P.push({ dx: 0, dz: 0, w: 1.0, d: 5.4, h: 0.6, r: 0, m: 'wood', y0: 2.8, nc: 1 }); // linteau : en hauteur, on passe dessous
    spots = [[3.2, 3.6]];
    res = { k: 'cart', x0: 2.6, x1: HALF_W + 1.4 };
  } else {
    // château d'eau (silo) et ses tonneaux
    P.push(piece('industrial/water-tower', rng.range(3.4, 3.9), 0, 0, rng.range(0, 6.28)));
    P.push(piece('survival/barrel', 3.2, 2.4, 1.6, 0)); if (rng.chance(0.6)) P.push(piece('survival/barrel', 3.2, 2.2, -1.5, 0));
  }
  return { pieces: P, spots, res };
}

// Rectangle orienté → collision avec un disque (x, z, r) ; renvoie true s'il a fallu pousser.
export function pushOutBox(p, cx, cz, w, d, rot, r) {
  const c = Math.cos(rot), s = Math.sin(rot);
  const lx = (p.x - cx) * c + (p.z - cz) * s, lz = -(p.x - cx) * s + (p.z - cz) * c;
  const hx = w / 2 + r, hz = d / 2 + r;
  if (Math.abs(lx) >= hx || Math.abs(lz) >= hz) return false;
  let nx = lx, nz = lz;
  if (hx - Math.abs(lx) < hz - Math.abs(lz)) nx = Math.sign(lx || 1) * hx; else nz = Math.sign(lz || 1) * hz;
  p.x = cx + nx * c - nz * s; p.z = cz + nx * s + nz * c;
  return true;
}

// Position (repère du sol) d'un morceau de ruine
export function piecePos(ruin, pc) {
  const c = Math.cos(ruin.rot), s = Math.sin(ruin.rot);
  return { x: ruin.x + pc.dx * c - pc.dz * s, zw: ruin.zw + pc.dx * s + pc.dz * c, rot: ruin.rot + pc.r };
}

export function onDeckRect(x, z) { return Math.abs(x) <= HALF_W && z >= DECK_FRONT && z <= REAR; }
