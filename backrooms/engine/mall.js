// The Backrooms - Level 17, le Mall : un centre commercial des années 80 abandonné, la nuit (d'après le décor de The
// Oldest View et des photos prises dans un multiplexe). Deux étages de 270 m × 160 m, empilés à FLOOR_DY l'un de l'autre :
//  - le mail, une galerie de 30 m de large d'un bout à l'autre, percée au milieu de l'étage du haut par des vides
//    bordés de garde-corps (on voit l'étage du bas) et franchie par des passerelles ;
//  - trois cours : à l'ouest, un vide octogonal sous des caissons et l'escalier monumental ; au centre, un vide plus
//    grand sous une coupole, deux escalators croisés (à l'arrêt) et un second escalier ; à l'est, une place au plafond
//    bas et noir, piqué de spots, autour d'un vide ovale sous une lanterne ;
//  - des boutiques de part et d'autre (ouvertes, rideau à mailles baissé, vitrine noire, vidées), des couloirs de
//    service derrière elles, un grand magasin ouvert à l'ouest sur deux niveaux, un autre fermé par sa grille au sud ;
//  - en haut : le food court au nord, le cinéma au nord-est (hall en moquette violette, couloir des salles, deux salles
//    où l'on entre), les bureaux du centre au sud-est ; en bas : le hall des parkings et les quais de livraison.
// Le plan est dessiné à la main ; la graine ne change que ce qui varie d'un centre abandonné à l'autre : le découpage
// et l'état des boutiques, les lumières en panne, les objets.
// La grille garde ses cases de 2,5 m ; ce qui n'est pas aligné sur elle (les vides, les vitrines, les grilles, le pied
// des escalators) a sa propre forme de collision (collide), et bloque les cases qu'il touche pour l'entité seulement
// (nav). Les escaliers sont ceux du Level 0 (deux volées et un palier, voir createLevel0), sans cage autour.
import { CELL_SIZE, T, itemList } from './map.js';

const C = CELL_SIZE;
export const MALL_LEVEL = 5;
export const MALL_W = 108;
export const MALL_H = 64;
export const MALL_CEIL = 4.4; // hauteur sous plafond ordinaire (le mail de l'étage du bas)
export const MALL_RAIL = 1.05; // hauteur des garde-corps
export const MALL_NAME = 'HALCYON PARK MALL';

// les genres de salles (ce qui décide du sol, des murs, du plafond et des lumières)
export const RK = {
  MAIL: 'mail',
  COURT: 'court',
  PLAZA: 'plaza', // la place au plafond bas de la cour est (étage du haut)
  SHOP: 'shop',
  SERVICE: 'service',
  FOOD: 'food',
  STORE: 'store', // le grand magasin ouvert
  CLOSED: 'closed', // le grand magasin fermé, derrière sa grille
  PORTAL: 'portal', // un passage entre deux espaces (entrée d'un grand magasin, du food court, du cinéma)
  CINE: 'cine', // le hall du cinéma
  CINE_HALL: 'cineHall', // le couloir des salles
  SCREEN: 'screen', // une salle de projection
  WC: 'wc',
  OFFICE: 'office',
  DOCK: 'dock',
  LOBBY: 'lobby', // le hall des parkings
};

// hauteur et genre de plafond par genre de salle, étage du haut (0) et du bas (1). L'étage du bas reste sous la dalle
// (FLOOR_DY 6,40 m) ; le haut monte où il veut
const CEILS = [
  {
    mail: [5.6, 'coffer'],
    court: [10, 'coffer'],
    plaza: [2.9, 'spots'],
    shop: [3.6, 'grid'],
    service: [3.0, 'slab'],
    food: [7.6, 'sky'],
    store: [3.8, 'grid'],
    closed: [3.8, 'grid'],
    portal: [4.6, 'soffit'],
    cine: [6.2, 'black'],
    cineHall: [3.6, 'black'],
    screen: [8.2, 'black'],
    wc: [2.8, 'grid'],
    office: [2.8, 'grid'],
  },
  {
    mail: [4.4, 'soffit'],
    court: [4.4, 'soffit'],
    shop: [3.6, 'grid'],
    service: [3.0, 'slab'],
    store: [3.8, 'grid'],
    closed: [3.8, 'grid'],
    portal: [4.0, 'soffit'],
    lobby: [3.2, 'grid'],
    dock: [5.4, 'slab'],
    wc: [2.8, 'grid'],
    office: [2.8, 'grid'],
  },
];

// des enseignes inventées (aucune marque réelle)
const SHOP_NAMES = [
  ['Velvet Lane', 'clothes'],
  ['Starlite Shoes', 'shoes'],
  ['Orbit Toys', 'toys'],
  ['Paper Moon Books', 'books'],
  ['Marquee Records', 'music'],
  ['Silverline Jewelers', 'jewelry'],
  ['Sundial Optical', 'optician'],
  ['Lucky Thread', 'clothes'],
  ['Bluebird Photo', 'photo'],
  ['Cobalt Sports', 'sports'],
  ['Petal & Stem', 'florist'],
  ['Moonlight Video', 'video'],
  ['Sweet Tooth', 'candy'],
  ['Cedar Pharmacy', 'pharmacy'],
  ['Nova Fragrance', 'perfume'],
  ['Wayfarer Luggage', 'luggage'],
  ['Pixel Palace', 'electronics'],
  ['Golden Hanger', 'clothes'],
  ['Little Acorn', 'kids'],
  ['Copper Kettle', 'kitchen'],
  ['Northwind Outfitters', 'outdoor'],
  ['Halo Hair Studio', 'salon'],
  ['Tock & Tick', 'watches'],
  ['Prism Gifts', 'gifts'],
  ['Brightside Cards', 'cards'],
  ['Mellow Yellow', 'clothes'],
  ['Satellite Phones', 'electronics'],
  ['Sable & Rose', 'lingerie'],
];
// les états d'une boutique : ouverte (on entre), rideau à mailles baissé, vitrine noire (papier collé derrière la
// vitre), vidée (plus de devanture, des cloisons de chantier)
const SHOP_STATES = ['open', 'grille', 'glass', 'gutted'];

// la distance du point (x, z) à un polygone (0 dedans), quel que soit le sens de ses sommets
export function polyDist(poly, x, z) {
  let inside = false;
  let best = Infinity;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, az] = poly[j];
    const [bx, bz] = poly[i];
    if (bz > z !== az > z && x < ((ax - bx) * (z - bz)) / (az - bz) + bx) inside = !inside;
    const ex = bx - ax;
    const ez = bz - az;
    const l2 = ex * ex + ez * ez;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (z - az) * ez) / l2)) : 0;
    best = Math.min(best, Math.hypot(x - ax - ex * t, z - az - ez * t));
  }
  return inside ? 0 : best;
}
const segDist = (s, x, z) => {
  const ex = s.bx - s.ax;
  const ez = s.bz - s.az;
  const l2 = ex * ex + ez * ez;
  const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2)) : 0;
  return Math.hypot(x - s.ax - ex * t, z - s.az - ez * t) - (s.t || 0);
};
// un octogone régulier (côtés plats face aux axes), centre (cx, cz), demi-largeur r
export const octagon = (cx, cz, r) => {
  const k = r * Math.tan(Math.PI / 8);
  return [[cx + r, cz - k], [cx + r, cz + k], [cx + k, cz + r], [cx - k, cz + r], [cx - r, cz + k], [cx - r, cz - k], [cx - k, cz - r], [cx + k, cz - r]];
};
// une ellipse en n segments
const oval = (cx, cz, rx, rz, n = 28) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * Math.PI * 2), cz + rz * Math.sin((i / n) * Math.PI * 2)]);
const rect = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// Les formes de collision d'un étage (vides, vitrines, grilles, escalators, meubles), rangées par case pour qu'une
// question ne regarde que ce qui est à côté
function solidSet(W, H) {
  const byCell = new Map();
  const list = [];
  const add = (o) => {
    let x0;
    let z0;
    let x1;
    let z1;
    if (o.pts) {
      x0 = Math.min(...o.pts.map((p) => p[0]));
      x1 = Math.max(...o.pts.map((p) => p[0]));
      z0 = Math.min(...o.pts.map((p) => p[1]));
      z1 = Math.max(...o.pts.map((p) => p[1]));
    } else if (o.ax !== undefined) {
      x0 = Math.min(o.ax, o.bx);
      x1 = Math.max(o.ax, o.bx);
      z0 = Math.min(o.az, o.bz);
      z1 = Math.max(o.az, o.bz);
    } else {
      x0 = o.x - o.r;
      x1 = o.x + o.r;
      z0 = o.z - o.r;
      z1 = o.z + o.r;
    }
    const M = 1.2; // marge : le rayon d'un corps
    for (let gz = Math.max(0, Math.floor((z0 - M) / C)); gz <= Math.min(H - 1, Math.floor((z1 + M) / C)); gz++)
      for (let gx = Math.max(0, Math.floor((x0 - M) / C)); gx <= Math.min(W - 1, Math.floor((x1 + M) / C)); gx++) {
        const k = gz * W + gx;
        if (!byCell.has(k)) byCell.set(k, []);
        byCell.get(k).push(o);
      }
    list.push(o);
    return o;
  };
  const dist = (o, x, z) => (o.pts ? polyDist(o.pts, x, z) : o.ax !== undefined ? segDist(o, x, z) : Math.hypot(x - o.x, z - o.z) - o.r);
  const hit = (x, z, r) => {
    const gx = Math.floor(x / C);
    const gz = Math.floor(z / C);
    const arr = byCell.get(gz * W + gx);
    if (!arr) return false;
    for (const o of arr) if (dist(o, x, z) < r) return true;
    return false;
  };
  return { add, hit, list, dist };
}

export function createMallMap(seed = 17) {
  const W = MALL_W;
  const H = MALL_H;
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  const cellPos = (x, z) => ({ x: (x + 0.5) * C, z: (z + 0.5) * C, gx: x, gz: z });

  // les deux étages : 0 en haut (celui où l'on arrive), 1 en bas
  const F = [0, 1].map((fi) => ({
    fi,
    grid: new Uint8Array(W * H).fill(T.WALL),
    zone: new Int16Array(W * H).fill(-1), // la salle de chaque case (son numéro dans rooms), -1 : aucune
    rooms: [],
    shops: [],
    pillars: {},
    solids: solidSet(W, H),
    navBlock: new Set(), // des cases libres que l'entité ne traverse pas (au bord d'un vide, devant une grille…)
    voids: [], // les vides (étage du haut) : un polygone chacun, en mètres
    lights: [],
    doors: [], // les portes dessinées (portes de service, issues de secours, portes de salle)
  }));
  const get = (f, x, z) => (x < 0 || z < 0 || x >= W || z >= H ? T.WALL : f.grid[z * W + x]);

  // une salle : un rectangle de cases (bornes comprises), son genre, son plafond
  const room = (fi, kind, x0, z0, x1, z1, o = {}) => {
    const f = F[fi];
    const [ceilH, ceil] = o.ceil || CEILS[fi][kind] || [MALL_CEIL, 'grid'];
    const r = { id: f.rooms.length, fi, kind, x0, z0, x1, z1, ceilH, ceil, ...o };
    delete r.ceil;
    r.ceil = ceil;
    f.rooms.push(r);
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        f.grid[z * W + x] = T.FLOOR;
        f.zone[z * W + x] = r.id;
      }
    return r;
  };
  const both = (kind, x0, z0, x1, z1, o = {}) => [room(0, kind, x0, z0, x1, z1, o.up || o), room(1, kind, x0, z0, x1, z1, o.down || o)];
  // une porte dans un mur d'une case d'épaisseur : la case devient libre et prend la salle de l'un des deux côtés
  const door = (fi, x, z, kind = 'service', o = {}) => {
    const f = F[fi];
    f.grid[z * W + x] = T.FLOOR;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => f.zone[(z + dz) * W + x + dx]).find((v) => v >= 0);
    f.zone[z * W + x] = nb ?? -1;
    const d = { x, z, kind, ...o };
    f.doors.push(d);
    return d;
  };

  // --- 1. Le mail et ses trois cours (les deux étages) ---
  // les repères en x (cases) : le grand magasin, la cour ouest, le grand tronçon de mail, la cour centrale, le petit
  // tronçon, la cour est, le couloir des salles du cinéma et ses salles
  const X = { storeA: [1, 14], portalA: [15, 16], west: [17, 30], seg1: [31, 50], center: [51, 64], seg2: [65, 80], east: [81, 92], corr: [94, 97], screens: [99, 106] };
  const MAIL = { z0: 26, z1: 37 }; // 30 m de large
  const VOIDZ = { z0: 30, z1: 33 }; // le vide de l'étage du haut, au milieu du mail (10 m)
  const SEGS = [
    { x0: X.seg1[0], x1: X.seg1[1] },
    { x0: X.seg2[0], x1: X.seg2[1] },
  ];
  const COURTS = {
    west: { x0: X.west[0], z0: 22, x1: X.west[1], z1: 41, name: 'West Court' },
    center: { x0: X.center[0], z0: 22, x1: X.center[1], z1: 41, name: 'Center Court' },
    east: { x0: X.east[0], z0: 22, x1: X.east[1], z1: 41, name: 'East Court' },
  };
  const CMID = Math.floor((X.center[0] + X.center[1]) / 2); // 57
  const EMID = Math.floor((X.east[0] + X.east[1]) / 2); // 86
  for (const sg of SEGS) both(RK.MAIL, sg.x0, MAIL.z0, sg.x1, MAIL.z1);
  // Le plafond des cours du haut (vault) : plat à base mètres autour, percé au-dessus du vide (son contour agrandi de
  // open mètres) d'un tambour qui monte à top ; la cour centrale a deux tambours, un anneau à ring et une verrière
  // (inner : le rayon du second) ; la place est, basse et noire, s'ouvre sur une lanterne ovale lumineuse (glow)
  both(RK.COURT, COURTS.west.x0, COURTS.west.z0, COURTS.west.x1, COURTS.west.z1, { up: { name: 'West Court', court: 'west', ceil: [10, 'vault'], vault: { base: 6.4, open: 1.2, top: 10 } }, down: { name: 'West Court', court: 'west' } });
  both(RK.COURT, COURTS.center.x0, COURTS.center.z0, COURTS.center.x1, COURTS.center.z1, { up: { name: 'Center Court', court: 'center', ceil: [11.5, 'dome'], vault: { base: 7.0, open: 1.6, ring: 10.0, inner: 8.0, top: 11.5 } }, down: { name: 'Center Court', court: 'center' } });
  room(0, RK.PLAZA, COURTS.east.x0, COURTS.east.z0, COURTS.east.x1, COURTS.east.z1, { name: 'East Court', court: 'east', vault: { base: 2.9, open: 2.6, top: 5.8, glow: true } });
  room(1, RK.COURT, COURTS.east.x0, COURTS.east.z0, COURTS.east.x1, COURTS.east.z1, { name: 'East Court', court: 'east' });

  // --- 2. Les couloirs de service, derrière les boutiques (les deux étages) ---
  const SERV_N = 20;
  const SERV_S = 43;
  both(RK.SERVICE, X.west[0], SERV_N, X.east[1], SERV_N, { name: 'Service corridor N' });
  both(RK.SERVICE, X.west[0], SERV_S, X.east[1], SERV_S, { name: 'Service corridor S' });

  // --- 3. Les boutiques : deux rangées par tronçon de mail, découpées au hasard (3 à 5 cases de façade, un mur d'une
  // case entre deux), différemment à chaque étage ---
  const names = [shuffle([...SHOP_NAMES]), shuffle([...SHOP_NAMES])];
  const split = (L) => {
    for (let tries = 0; tries < 200; tries++) {
      const out = [];
      let sum = -1;
      while (sum < L) {
        const w = 3 + Math.floor(rnd() * 3);
        out.push(w);
        sum += w + 1;
      }
      if (sum === L) return out;
    }
    return [L];
  };
  const shopRow = (fi, x0, x1, z0, z1, side) => {
    // side : 'N' (devanture au sud, sur le mail) ou 'S' (devanture au nord)
    let x = x0;
    for (const w of split(x1 - x0 + 1)) {
      const nm = names[fi].pop() || ['Vacant', 'vacant'];
      const st = rnd();
      const state = st < 0.36 ? 'open' : st < 0.66 ? 'grille' : st < 0.84 ? 'glass' : 'gutted';
      const r = room(fi, RK.SHOP, x, z0, x + w - 1, z1, { name: nm[0], trade: nm[1], side, state });
      const front = side === 'N' ? (z1 + 1) * C : z0 * C;
      const shop = { id: F[fi].shops.length, room: r.id, x0: x, x1: x + w - 1, z0, z1, side, state, name: nm[0], trade: nm[1], frontZ: front, dir: side === 'N' ? 1 : -1, sign: Math.floor(rnd() * 6), dark: rnd() < 0.55 };
      r.shop = shop.id;
      F[fi].shops.push(shop);
      // une porte de service au fond (une boutique sur deux)
      if (rnd() < 0.5) {
        const bx = x + Math.floor(w / 2);
        shop.back = door(fi, bx, side === 'N' ? z0 - 1 : z1 + 1, 'back', { shop: shop.id });
      }
      x += w + 1;
    }
  };
  for (const fi of [0, 1])
    for (const sg of SEGS) {
      // (un mur d'une case de chaque côté de la rangée : les cours ne s'ouvrent pas dans les boutiques)
      shopRow(fi, sg.x0 + 1, sg.x1 - 1, 22, 25, 'N');
      shopRow(fi, sg.x0 + 1, sg.x1 - 1, 38, 41, 'S');
    }

  // --- 4. Les grands espaces autour ---
  // le grand magasin de l'ouest (ouvert, sur deux niveaux) et son portail sur la cour ouest
  both(RK.STORE, X.storeA[0], 4, X.storeA[1], 59, { name: "Hartwell's" });
  both(RK.PORTAL, X.portalA[0], 29, X.portalA[1], 34, { name: "Hartwell's entrance", store: true });
  // en haut : le food court, ouvert sur la cour centrale
  room(0, RK.FOOD, 30, 3, X.center[1], 17, { name: 'The Pavilion' });
  room(0, RK.PORTAL, CMID - 2, 18, CMID + 3, 21, { name: 'Pavilion entrance' });
  // en bas : le hall des parkings
  room(1, RK.LOBBY, 44, 8, X.center[1], 17, { name: 'Parking lobby' });
  room(1, RK.PORTAL, CMID - 2, 18, CMID + 3, 21, { name: 'Parking entrance' });
  // en haut : le cinéma (hall, couloir des salles, deux salles ouvertes)
  room(0, RK.CINE, 66, 3, X.east[1], 17, { name: 'Stardust 8 Cinemas' });
  room(0, RK.PORTAL, EMID - 2, 18, EMID + 2, 21, { name: 'Cinema entrance', cine: true });
  room(0, RK.CINE_HALL, X.corr[0], 3, X.corr[1], 44, { name: 'Screens 1-8' });
  room(0, RK.PORTAL, 93, 6, 93, 9, { name: 'Ticket check', cine: true });
  const screens = [room(0, RK.SCREEN, X.screens[0], 3, X.screens[1], 12, { name: 'Screen 1', num: 1 }), room(0, RK.SCREEN, X.screens[0], 14, X.screens[1], 23, { name: 'Screen 2', num: 2 })];
  door(0, 98, 10, 'screen', { num: 1, open: true });
  door(0, 98, 21, 'screen', { num: 2, open: true });
  // les autres salles : des portes closes le long du couloir (décor)
  const fakeScreens = [3, 4, 5, 6].map((num, i) => ({ x: 98, z: 27 + i * 5, num }));
  // en bas, sous le cinéma : les quais de livraison et un couloir de service
  room(1, RK.DOCK, 68, 3, X.east[1], 16, { name: 'Loading docks' });
  for (const z of [17, 18, 19]) door(1, 78, z, 'service');
  room(1, RK.SERVICE, X.corr[0], 3, X.corr[1], 44, { name: 'Service corridor E' });
  door(1, 93, 10, 'service');
  // au sud : les toilettes et le poste de sécurité (les deux étages), passage depuis la cour ouest
  both(RK.WC, 18, 45, 30, 52, { up: { name: 'Restrooms' }, down: { name: 'Restrooms' } });
  both(RK.OFFICE, 18, 54, 30, 59, { up: { name: 'Security' }, down: { name: 'Lost & found' } });
  for (const fi of [0, 1]) {
    for (const z of [42, 43, 44]) for (const x of [22, 23]) door(fi, x, z, 'passage');
    door(fi, 24, 53, 'service');
  }
  // le grand magasin fermé du sud : un vestibule depuis la cour centrale, la grille, et derrière, le magasin vide
  const GATE = { x0: CMID - 3, x1: CMID + 4 }; // 54 à 61
  both(RK.PORTAL, GATE.x0, 42, GATE.x1, 44, { name: 'Brandt & Co. entrance', store: true, gate: true });
  both(RK.CLOSED, 40, 45, 68, 60, { name: 'Brandt & Co.' });
  // au sud-est : les bureaux du centre (en haut, avec le monte-charge), les locaux techniques (en bas)
  room(0, RK.OFFICE, 70, 46, X.screens[1], 61, { name: 'Mall management' });
  room(1, RK.SERVICE, 70, 46, X.screens[1], 61, { name: 'Plant rooms' });
  for (const fi of [0, 1]) {
    door(fi, 72, 44, 'service');
    door(fi, 72, 45, 'service');
    for (let x = X.corr[0]; x <= X.corr[1]; x++) door(fi, x, 45, 'passage');
  }
  // les couloirs de service : des portes sur les cours (issues de secours, accès du personnel)
  for (const fi of [0, 1]) {
    door(fi, 18, 21, 'fire'); // (en haut : l'issue de secours par où l'on arrive)
    door(fi, 29, 21, 'service');
    door(fi, 52, 21, 'service');
    door(fi, 63, 42, 'service');
    door(fi, 82, 42, 'service');
    door(fi, 91, 21, 'service');
    door(fi, 29, 42, 'service');
  }
  // en bas, le portail du cinéma n'existe pas : une simple porte entre la cour est et le couloir de service
  door(1, EMID, 21, 'service');

  // --- 5. Les vides de l'étage du haut (le mail et les cours), et les passerelles qui les franchissent ---
  const up = F[0];
  const dn = F[1];
  const voidAdd = (pts, o = {}) => {
    const v = { id: up.voids.length, pts, ...o };
    up.voids.push(v);
    up.solids.add({ pts, void: v.id });
    return v;
  };
  const VZ0 = VOIDZ.z0 * C;
  const VZ1 = (VOIDZ.z1 + 1) * C;
  // le mail : deux vides par tronçon, une passerelle de deux cases entre eux
  const bridges = [];
  for (const sg of SEGS) {
    const mid = Math.floor((sg.x0 + sg.x1) / 2);
    voidAdd(rect((sg.x0 + 1) * C, VZ0, mid * C, VZ1), { kind: 'mail' });
    voidAdd(rect((mid + 2) * C, VZ0, sg.x1 * C, VZ1), { kind: 'mail' });
    bridges.push({ x0: mid * C, x1: (mid + 2) * C, z0: VZ0, z1: VZ1 });
  }
  const WCX = 26.4 * C; // la cour ouest : le vide est décalé vers l'est (l'escalier monumental à l'ouest)
  const CCX = (X.center[0] + X.center[1] + 1) * C * 0.5;
  const ECX = (X.east[0] + X.east[1] + 1) * C * 0.5;
  const MZ = 32 * C; // l'axe du mail
  const rW = 9.4;
  const rC = 12.2;
  const voidW = voidAdd(octagon(WCX, MZ, rW), { kind: 'court', court: 'west' });
  const voidC = voidAdd(octagon(CCX, MZ, rC), { kind: 'court', court: 'center' });
  const voidE = voidAdd(oval(ECX, MZ, 9.2, 6.2), { kind: 'oval', court: 'east' });

  // --- 6. Les escaliers (deux volées et un palier, comme au Level 0), ouverts sur les cours ---
  const stairs = [];
  const stair = (cx, cz, dx, dz, side) => {
    const px = -dz * side;
    const pz = dx * side;
    const cells = [];
    for (let k = 1; k <= 3; k++) for (const l of [0, 1]) cells.push([cx + dx * k + px * l, cz + dz * k + pz * l]);
    const at = (x, z) => ({ x: (x + 0.5) * C, z: (z + 0.5) * C });
    const ox = (cx + 0.5 + dx * 0.5 - px * 0.5) * C;
    const oz = (cz + 0.5 + dz * 0.5 - pz * 0.5) * C;
    const st = {
      id: stairs.length,
      gx: cx + dx,
      gz: cz + dz,
      cells: cells.map(([x, z]) => ({ gx: x, gz: z })),
      ox,
      oz,
      dx,
      dz,
      px,
      pz,
      x: ox + dx * 2.5 * C + px * C,
      z: oz + dz * 2.5 * C + pz * C,
      cx: ox + dx * 1.5 * C + px * C,
      cz: oz + dz * 1.5 * C + pz * C,
      up: at(cx + px, cz + pz),
      down: at(cx, cz),
      open: true, // sans cage : des garde-corps, le dessous habillé
    };
    stairs.push(st);
    return st;
  };
  stair(18, 30, 1, 0, 1); // cour ouest, l'escalier monumental : on monte vers l'est, demi-tour sur le palier
  stair(CMID - 4, 40, 1, 0, -1); // cour centrale, au sud du vide
  stair(X.east[0] + 1, 24, 1, 0, 1); // cour est, au nord du vide

  // --- 7. Les escalators de la cour centrale, croisés, à l'arrêt : leur pied en bas, leur palier d'arrivée au bord du
  // vide (une chaîne et un panneau « OUT OF ORDER » en travers). Et celui de la place est, qui monte dans le plafond ---
  const ESC_RUN = 11.1; // 6,40 m de haut à 30°
  const ESC_LAND = 2.2; // les paliers plats, en bas et en haut
  const ESC_W = 1.35;
  const escalators = [];
  const escal = (fi, x, z, dir, o = {}) => {
    // (x, z) : le bout du palier du bas ; dir : +1 monte vers +x, -1 vers -x
    const len = ESC_LAND + ESC_RUN + ESC_LAND;
    const e = { id: escalators.length, fi, x, z, dir, w: ESC_W, run: ESC_RUN, land: ESC_LAND, len, rise: 6.4, ...o };
    e.top = x + dir * len;
    escalators.push(e);
    // tout le pied, jusqu'à mi-hauteur de la rampe (on ne passe pas dessous)
    const xb = x + dir * (ESC_LAND + ESC_RUN * 0.5);
    F[fi].solids.add({ pts: rect(Math.min(x, xb), z - ESC_W / 2 - 0.12, Math.max(x, xb), z + ESC_W / 2 + 0.12), esc: e.id });
    return e;
  };
  // (le haut de la rampe arrive au bord est, puis ouest, de l'octogone)
  escal(1, CCX + rC - ESC_LAND - ESC_RUN, MZ - 2.2, 1);
  escal(1, CCX - rC + ESC_LAND + ESC_RUN, MZ + 2.2, -1);
  // l'escalator de la place est : il part de l'étage du haut et monte droit dans le plafond noir
  const escNowhere = escal(0, (X.east[1] + 0.6) * C, 39.6 * C, -1, { nowhere: true });

  // --- 8. Les piliers (carrés au mail, aux cours et dans les grands magasins ; ronds au cinéma), au même endroit aux
  // deux étages quand c'est la structure ---
  const pillar = (fi, gx, gz, o = {}) => {
    const f = F[fi];
    const k = gz * W + gx;
    if (f.grid[k] !== T.FLOOR) return null;
    const x = o.x ?? (gx + 0.5) * C;
    const z = o.z ?? (gz + 0.5) * C;
    if (fi === 0 && up.voids.some((v) => polyDist(v.pts, x, z) < 1.0)) return null; // (les files du mail longent le vide, 80 cm devant le garde-corps)
    if (stairs.some((st) => st.cells.some((c) => Math.abs(c.gx - gx) <= 1 && Math.abs(c.gz - gz) <= 1))) return null;
    if (f.doors.some((d) => Math.abs(d.x - gx) + Math.abs(d.z - gz) <= 1)) return null;
    if (escalators.some((e) => e.fi === fi && Math.abs(z - e.z) < 2.4 && (x - e.x) * e.dir > -1.5 && (x - e.x) * e.dir < e.len + 1.5)) return null;
    f.grid[k] = T.PILLAR;
    const p = { x, z, h: o.h ?? 0.45, round: !!o.round, kind: o.kind || 'square', fi };
    f.pillars[k] = p;
    return p;
  };
  for (const fi of [0, 1]) {
    // le mail : une file de piliers de chaque côté du vide, tous les 4 cases (10 m)
    for (const sg of SEGS) for (let x = sg.x0; x <= sg.x1; x += 4) for (const z of [VOIDZ.z0 - 1, VOIDZ.z1 + 1]) pillar(fi, x, z, { kind: 'mail' });
    // les cours : huit piliers autour du vide
    for (const [cx, r] of [[WCX, rW + 2.2], [CCX, rC + 2.2]])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        const x = cx + Math.cos(a) * r * 1.04;
        const z = MZ + Math.sin(a) * r * 1.04;
        pillar(fi, Math.floor(x / C), Math.floor(z / C), { x, z, kind: 'court' });
      }
    // le grand magasin : une trame de 5 cases
    for (let z = 7; z <= 57; z += 5) for (let x = 3; x <= 13; x += 5) pillar(fi, x, z, { kind: 'store' });
    // le grand magasin fermé
    for (let z = 48; z <= 58; z += 5) for (let x = 43; x <= 66; x += 5) pillar(fi, x, z, { kind: 'store' });
    // la cour est : une couronne de piliers autour du vide ovale (en haut, sous le plafond bas)
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const x = ECX + Math.cos(a) * 12.2;
      const z = MZ + Math.sin(a) * 9.0;
      pillar(fi, Math.floor(x / C), Math.floor(z / C), { x, z, kind: 'court' });
    }
  }
  // le food court et le hall des parkings : une trame
  for (let z = 6; z <= 16; z += 5) for (let x = 33; x <= 63; x += 5) pillar(0, x, z, { kind: 'food' });
  for (let z = 10; z <= 16; z += 5) for (let x = 46; x <= 63; x += 5) pillar(1, x, z, { kind: 'store' });
  for (let z = 6; z <= 14; z += 4) for (let x = 71; x <= 91; x += 5) pillar(1, x, z, { kind: 'dock', h: 0.3 });
  // le cinéma : des piliers ronds sous leurs disques de plafond ; le couloir des salles en a une file au milieu
  for (const [x, z] of [[71, 7], [76, 12], [81, 7], [86, 12], [71, 14], [81, 14], [90, 7]]) pillar(0, x, z, { kind: 'cine', round: true, h: 0.5 });
  for (let z = 5; z <= 42; z += 5) pillar(0, 96, z, { kind: 'cineHall', round: true, h: 0.32 });

  // --- 9. Ce que l'entité ne traverse pas : le bord des vides, les escalators, devant les grilles et les vitrines ---
  // (et les formes de collision des devantures fermées)
  for (const f of F) {
    for (const sh of f.shops) {
      const z = sh.frontZ;
      const x0 = sh.x0 * C;
      const x1 = (sh.x1 + 1) * C;
      const row = sh.side === 'N' ? sh.z1 : sh.z0;
      if (sh.state === 'grille' || sh.state === 'glass') {
        f.solids.add({ ax: x0, az: z, bx: x1, bz: z, t: 0.06, front: sh.id });
        for (let x = sh.x0; x <= sh.x1; x++) f.navBlock.add(row * W + x);
      } else if (sh.state === 'open') {
        // une vitrine de chaque côté, l'entrée au milieu (2,4 m)
        const mid = (x0 + x1) / 2;
        sh.gap = [mid - 1.2, mid + 1.2];
        f.solids.add({ ax: x0, az: z, bx: mid - 1.2, bz: z, t: 0.06, front: sh.id });
        f.solids.add({ ax: mid + 1.2, az: z, bx: x1, bz: z, t: 0.06, front: sh.id });
        for (let x = sh.x0; x <= sh.x1; x++) if ((x + 1) * C <= mid - 1.2 + 0.4 || x * C >= mid + 1.2 - 0.4) f.navBlock.add(row * W + x);
      }
    }
    // la grille du grand magasin fermé
    f.solids.add({ ax: GATE.x0 * C, az: 45 * C, bx: (GATE.x1 + 1) * C, bz: 45 * C, t: 0.08, gate: true });
    for (let x = GATE.x0; x <= GATE.x1; x++) f.navBlock.add(45 * W + x);
  }
  for (const v of up.voids)
    for (let gz = 0; gz < H; gz++)
      for (let gx = 0; gx < W; gx++) if (up.grid[gz * W + gx] === T.FLOOR && polyDist(v.pts, (gx + 0.5) * C, (gz + 0.5) * C) < 0.9) up.navBlock.add(gz * W + gx);
  for (const e of escalators) {
    const f = F[e.fi];
    const xa = Math.min(e.x, e.x + e.dir * e.len);
    const xb = Math.max(e.x, e.x + e.dir * e.len);
    for (let gx = Math.floor(xa / C); gx <= Math.floor(xb / C); gx++) for (const gz of [Math.floor((e.z - 0.7) / C), Math.floor((e.z + 0.7) / C)]) if (f.grid[gz * W + gx] === T.FLOOR) f.navBlock.add(gz * W + gx);
  }
  // en haut, autour des trémies d'escalier : on n'y entre que par le haut de la seconde volée (moteur : stairStep)

  // --- 10. Les monte-charges (la sortie : un par étage, le moteur choisit le vrai) ---
  const lift = (fi, gx, gz, dx, dz) => {
    F[fi].grid[gz * W + gx] = T.EXIT;
    return { elevator: { gx, gz, x: (gx + 0.5) * C, z: (gz + 0.5) * C, dx, dz, freight: true }, exit: cellPos(gx - dx, gz - dz) };
  };
  const L0 = lift(0, 102, 62, 0, 1); // au fond des bureaux
  const L1 = lift(1, 70, 2, 0, -1); // sur le quai

  // --- 11. Les lumières (la plupart en panne : un centre abandonné ne laisse allumé que l'éclairage de veille) ---
  const light = (fi, x, z, kind, o = {}) => {
    const f = F[fi];
    const gx = Math.floor(x / C);
    const gz = Math.floor(z / C);
    const r = rnd();
    const pOff = o.pOff ?? 0.25;
    const state = o.state || (r < pOff ? 'off' : r < pOff + 0.07 ? 'flicker' : 'on');
    const l = { id: f.lights.length, x, z, gx, gz, kind, state, ...o };
    delete l.pOff;
    f.lights.push(l);
    return l;
  };
  const inVoid = (x, z, m = 0.6) => up.voids.some((v) => polyDist(v.pts, x, z) < m);
  for (const f of F) {
    const fi = f.fi;
    for (const r of f.rooms) {
      const X0 = r.x0 * C;
      const Z0 = r.z0 * C;
      const X1 = (r.x1 + 1) * C;
      const Z1 = (r.z1 + 1) * C;
      // (m : la marge laissée autour des vides, plus large sous l'ouverture d'une voûte)
      const grid = (step, kind, o = {}, m = 0.8) => {
        for (let z = Z0 + step / 2; z < Z1; z += step)
          for (let x = X0 + step / 2; x < X1; x += step) {
            if (fi === 0 && inVoid(x, z, m)) continue;
            light(fi, x, z, kind, { room: r.id, ...o });
          }
      };
      if (r.kind === RK.MAIL) {
        if (fi === 0) {
          // les caissons du plafond : une corniche lumineuse par caisson (5 m), au-dessus des deux allées
          for (let x = X0 + 2.5; x < X1; x += 5) for (const z of [27 * C + 1.25, 36 * C + 1.25]) light(0, x, z, 'cove', { room: r.id, y: 5.4 });
        } else for (let x = X0 + 2.5; x < X1; x += 5) for (const z of [27 * C, 29.5 * C, 34.5 * C, 37 * C]) light(1, x, z, 'spot', { room: r.id, y: 4.4 });
      } else if (r.kind === RK.COURT) {
        if (fi === 0) {
          // la coupole ou les caissons au-dessus du vide : une grande suspension, et la corniche tout autour
          // la corniche lumineuse court tout autour du tambour, cachée dans sa lèvre (douze tronçons)
          const cx = r.court === 'west' ? WCX : CCX;
          const v = r.vault;
          light(0, cx, MZ, 'pendant', { room: r.id, y: r.ceilH - 2.2, big: true, state: 'on' });
          for (let i = 0; i < 12; i++) {
            const a = ((i + 0.5) / 12) * Math.PI * 2;
            const rr = (r.court === 'west' ? rW : rC) + v.open + 0.5;
            light(0, cx + Math.cos(a) * rr, MZ + Math.sin(a) * rr, 'cove', { room: r.id, y: v.base - 0.12, rot: Math.PI / 2 - a, ring: true });
          }
        } else grid(5, 'spot', { y: r.ceilH });
      } else if (r.kind === RK.PLAZA) {
        // la lanterne ovale : un plafond lumineux au-dessus du vide, le seul endroit vraiment clair de l'étage
        light(0, ECX, MZ, 'glow', { room: r.id, y: r.vault.top, state: 'on', big: true });
        grid(5, 'spot', { y: r.ceilH, pOff: 0.35 }, r.vault.open + 0.5);
      }
      else if (r.kind === RK.SHOP) grid(5, 'panel', { y: r.ceilH, pOff: r.state === 'open' ? 0.55 : 0.85 });
      else if (r.kind === RK.SERVICE) grid(C * 3, 'tube', { y: r.ceilH, pOff: 0.4 });
      else if (r.kind === RK.FOOD) grid(7.5, 'pendant', { y: 4.6, pOff: 0.3 });
      else if (r.kind === RK.STORE || r.kind === RK.CLOSED) grid(r.kind === RK.CLOSED ? 10 : 7.5, 'panel', { y: r.ceilH, pOff: r.kind === RK.CLOSED ? 0.9 : 0.6 });
      else if (r.kind === RK.CINE) grid(5, 'spot', { y: r.ceilH, pOff: 0.2 });
      else if (r.kind === RK.CINE_HALL) grid(3.75, 'spot', { y: r.ceilH, pOff: 0.3 });
      else if (r.kind === RK.SCREEN) grid(5, 'aisle', { y: 0.4, pOff: 0.2 });
      else if (r.kind === RK.WC || r.kind === RK.LOBBY) grid(5, 'panel', { y: r.ceilH, pOff: 0.45 });
      else if (r.kind === RK.OFFICE) grid(7.5, 'panel', { y: r.ceilH, pOff: 0.45 });
      else if (r.kind === RK.DOCK) grid(5, 'tube', { y: r.ceilH, pOff: 0.4 });
      else if (r.kind === RK.PORTAL) grid(5, 'spot', { y: r.ceilH, pOff: 0.3 });
    }
    // en bas, sous les vides : la lumière des grandes suspensions et de la lanterne du haut tombe jusqu'au sol (une
    // lampe sans luminaire ; rad : jusqu'où elle porte, un peu au-delà du bord du vide)
    if (fi === 1) {
      for (const l of F[0].lights) {
        if (!(l.kind === 'pendant' && l.big) && l.kind !== 'glow') continue;
        const v = up.voids.find((o) => polyDist(o.pts, l.x, l.z) === 0);
        if (!v) continue;
        const xs = v.pts.map((p) => p[0]);
        const zs = v.pts.map((p) => p[1]);
        const rad = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs)) / 2 + 3;
        light(1, l.x, l.z, 'well', { y: MALL_CEIL, state: 'on', rad, gain: l.kind === 'glow' ? 0.95 : 1.2, fall: 1.25, src: l.id });
      }
    }
    // les appliques des piliers du mail et des cours (une paire par pilier, tournées vers les allées)
    for (const k in f.pillars) {
      const p = f.pillars[k];
      if (p.kind !== 'mail' && p.kind !== 'court') continue;
      light(fi, p.x, p.z, 'sconce', { y: 2.7, pillar: +k, pOff: 0.3 });
    }
    // une lumière n'est jamais dans un mur
    f.lights = f.lights.filter((l) => {
      const v = get(f, l.gx, l.gz);
      return v === T.FLOOR || v === T.PILLAR;
    });
    f.lights.forEach((l, i) => (l.id = i));
  }

  // --- 11b. Le mobilier : ce qui gêne le passage est une forme de collision (la même chez tout le monde), le reste
  // n'est que du décor. Chaque meuble : { kind, x, z, w, d (emprise en mètres, w le long de x), rot (1 : tourné d'un
  // quart de tour), ...}. Jamais devant une porte, un escalier, un escalator, au bord d'un vide, contre un pilier ---
  for (const f of F) f.furn = [];
  const overlap = (ax0, az0, ax1, az1, bx0, bz0, bx1, bz1, m) => ax0 < bx1 + m && ax1 > bx0 - m && az0 < bz1 + m && az1 > bz0 - m;
  const doorNear = (f, x0, z0, x1, z1, m) => f.doors.some((d) => overlap(x0, z0, x1, z1, d.x * C, d.z * C, (d.x + 1) * C, (d.z + 1) * C, m));
  const stairNear = (x0, z0, x1, z1, m) =>
    stairs.some((st) => {
      const xs = [st.ox, st.ox + st.dx * 3 * C + st.px * 2 * C];
      const zs = [st.oz, st.oz + st.dz * 3 * C + st.pz * 2 * C];
      return overlap(x0, z0, x1, z1, Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), m);
    });
  const escNear = (fi, x0, z0, x1, z1, m) => escalators.some((e) => overlap(x0, z0, x1, z1, Math.min(e.x, e.top) - 1.5, e.z - e.w / 2, Math.max(e.x, e.top) + 1.5, e.z + e.w / 2, m));
  const pillarNear = (f, x0, z0, x1, z1, m) => {
    for (let gz = Math.floor((z0 - m) / C) - 1; gz <= Math.floor((z1 + m) / C) + 1; gz++)
      for (let gx = Math.floor((x0 - m) / C) - 1; gx <= Math.floor((x1 + m) / C) + 1; gx++) {
        const p = gx >= 0 && gz >= 0 && gx < W && gz < H && f.grid[gz * W + gx] === T.PILLAR ? f.pillars[gz * W + gx] : null;
        if (!p) continue;
        const dx = Math.max(x0 - (p.x + p.h), 0, p.x - p.h - x1);
        const dz = Math.max(z0 - (p.z + p.h), 0, p.z - p.h - z1);
        if (Math.hypot(dx, dz) < m) return true;
      }
    return false;
  };
  // o.solid : false pour du décor qu'on enjambe ; o.m : la marge laissée autour ; o.room : la salle où il doit rester
  const furn = (fi, kind, x, z, w, d, o = {}) => {
    const f = F[fi];
    const [ww, dd] = o.rot ? [d, w] : [w, d];
    const x0 = x - ww / 2;
    const z0 = z - dd / 2;
    const x1 = x + ww / 2;
    const z1 = z + dd / 2;
    const m = o.m ?? 0.4;
    for (const [px, pz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1], [x, z]]) {
      const gx = Math.floor(px / C);
      const gz = Math.floor(pz / C);
      if (get(f, gx, gz) !== T.FLOOR) return null;
      if (o.room !== undefined && f.zone[gz * W + gx] !== o.room) return null;
    }
    if (doorNear(f, x0, z0, x1, z1, 0.6) || stairNear(x0, z0, x1, z1, C + 0.5) || escNear(fi, x0, z0, x1, z1, 0.8)) return null;
    if (pillarNear(f, x0, z0, x1, z1, o.pm ?? 0.35)) return null;
    // (des points sur toute l'emprise : un vide, une vitrine, un autre meuble à moins de m)
    const nx = Math.max(1, Math.ceil(ww / 0.6));
    const nz = Math.max(1, Math.ceil(dd / 0.6));
    for (let j = 0; j <= nz; j++)
      for (let i = 0; i <= nx; i++) {
        const px = x0 + (ww * i) / nx;
        const pz = z0 + (dd * j) / nz;
        if (f.solids.hit(px, pz, m)) return null;
        if (fi === 0 && up.voids.some((v) => polyDist(v.pts, px, pz) < 0.6)) return null;
      }
    if (Math.hypot(x - (spawnAt.gx + 0.5) * C, z - (spawnAt.gz + 0.5) * C) < 3.5 && fi === 0) return null;
    const it = { id: f.furn.length, kind, x, z, w, d, rot: o.rot ? 1 : 0, ...o };
    delete it.m;
    delete it.pm;
    f.furn.push(it);
    if (o.solid !== false) f.solids.add(o.round ? { x, z, r: Math.max(w, d) / 2, furn: it.id } : { pts: rect(x0, z0, x1, z1), furn: it.id });
    if (o.nav) for (let gz = Math.floor(z0 / C); gz <= Math.floor(z1 / C); gz++) for (let gx = Math.floor(x0 / C); gx <= Math.floor(x1 / C); gx++) f.navBlock.add(gz * W + gx);
    return it;
  };
  const spawnAt = { gx: 19, gz: 23 };
  const roomsOf = (fi, kind) => F[fi].rooms.filter((r) => r.kind === kind);
  for (const fi of [0, 1]) {
    // le mail : des bancs entre les piliers, dos aux allées du milieu ; une poubelle sur deux
    for (const r of roomsOf(fi, RK.MAIL)) {
      for (let x = r.x0 * C + 5; x < (r.x1 + 1) * C - 2; x += 10) {
        // (en haut, les files de piliers longent le garde-corps : les bancs sont devant, côté allée)
        for (const z of fi === 0 ? [29.5 * C - 1.1, 34.5 * C + 1.1] : [29.5 * C, 34.5 * C]) {
          const b = furn(fi, 'bench', x, z, 2.45, 0.7, { m: 0.15, face: z < MZ ? -1 : 1 });
          if (b && rnd() < 0.5) furn(fi, 'bin', x + 1.75, z, 0.6, 0.6, { round: true, m: 0.1, rust: rnd() < 0.4 });
        }
      }
      // en bas, sous le vide : des jardinières, des kiosques fermés, des bancs autour
      if (fi === 1) {
        let k = 0;
        for (let x = r.x0 * C + 7.5; x < (r.x1 + 1) * C - 5; x += 12.5, k++) {
          if (k % 2 === 0) {
            const p = furn(1, 'planter', x, MZ, 2.2, 2.2, { m: 0.3, plant: Math.floor(rnd() * 3) });
            if (p) for (const s of [-1, 1]) furn(1, 'bench', x, MZ + s * 1.85, 2.45, 0.7, { m: 0.05, face: s });
          } else {
            // un kiosque fermé (rideaux baissés) ou un chariot à café abandonné
            const sign = Math.floor(rnd() * 4);
            if (sign < 2) furn(1, 'cart', x, MZ, 2.3, 1.2, { m: 0.4, nav: true, sign, yaw: rnd() * 0.6 - 0.3 });
            else furn(1, 'kiosk', x, MZ, 3.4, 2.2, { m: 0.4, nav: true, sign });
          }
        }
      }
    }
    // les cours : des jardinières aux quatre coins, un plan du centre près de chaque mail
    for (const key of ['west', 'center', 'east']) {
      const cr = COURTS[key];
      const cx = (cr.x0 + cr.x1 + 1) * C * 0.5;
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + sx * ((cr.x1 - cr.x0 + 1) * C * 0.5 - 3.2);
        const z = MZ + sz * ((cr.z1 - cr.z0 + 1) * C * 0.5 - 3.2);
        furn(fi, 'planter', x, z, 2.0, 2.0, { m: 0.3, plant: Math.floor(rnd() * 3) });
      }
      furn(fi, 'directory', cx - 9 + rnd() * 2, 27 * C + 0.4, 1.3, 0.35, { m: 0.2 }) || furn(fi, 'directory', cx + 8, 36 * C - 0.4, 1.3, 0.35, { m: 0.2 });
    }
  }
  // en bas, sous les vides des cours ouest et est : une fontaine à sec, octogonale ; une chaise seule, tournée vers elle
  for (const key of ['west', 'east']) {
    const v = up.voids.find((o) => o.court === key);
    const [cx, cz] = v.pts.reduce((a, p) => [a[0] + p[0] / v.pts.length, a[1] + p[1] / v.pts.length], [0, 0]);
    if (furn(1, 'fountain', cx, cz, 7.2, 7.2, { round: true, m: 0.2, nav: true }) && key === 'west') furn(1, 'chair', cx - 6.2, cz + 2.4, 0.5, 0.5, { solid: false, yaw: 1.9 });
  }
  // les boutiques : des rayonnages le long des murs, un comptoir au fond, des portants (les vêtements), des gravats
  // dans les boutiques vidées
  for (const fi of [0, 1]) {
    for (const sh of F[fi].shops) {
      const r = F[fi].rooms[sh.room];
      const X0 = sh.x0 * C;
      const X1 = (sh.x1 + 1) * C;
      const Z0 = sh.z0 * C;
      const Z1 = (sh.z1 + 1) * C;
      const back = sh.side === 'N' ? Z0 : Z1; // le mur du fond
      const inw = sh.side === 'N' ? 1 : -1; // du fond vers la devanture
      const o = { room: r.id, m: 0.05, pm: 0.1, shop: sh.id };
      if (sh.state === 'gutted') {
        for (let i = 0; i < 3; i++) furn(fi, 'debris', X0 + 1.5 + rnd() * (X1 - X0 - 3), back + inw * (2 + rnd() * 6), 1.6, 1.2, { ...o, solid: false });
        furn(fi, 'ladder', X0 + 1.2, back + inw * 4, 0.6, 1.6, { ...o, solid: false });
        continue;
      }
      // rayonnages contre les murs latéraux
      for (const [x, sx] of [[X0 + 0.3, 1], [X1 - 0.3, -1]]) furn(fi, 'shelf', x, (Z0 + Z1) / 2 + inw * 0.6, 3.6, 0.5, { ...o, rot: 1, face: sx });
      // le comptoir, dans un coin du fond (la porte de service est au milieu)
      furn(fi, 'counter', X0 + 2.2, back + inw * 1.6, 2.2, 0.7, { ...o, m: 0.1 });
      const clothes = ['clothes', 'lingerie', 'kids', 'shoes', 'sports', 'outdoor'].includes(sh.trade);
      const n = Math.floor((X1 - X0) / 3);
      for (let i = 0; i < n; i++) {
        const x = X0 + 2.4 + i * 3;
        const z = back + inw * (5.2 + (i % 2) * 1.4);
        if (clothes) furn(fi, 'rack', x, z, 1.2, 1.2, { ...o, round: true, m: 0.3 });
        else furn(fi, 'table', x, z, 1.6, 0.9, { ...o, m: 0.4, display: true });
      }
    }
  }
  // le food court : des comptoirs le long du mur nord, des tables rondes et leurs chaises
  for (const r of roomsOf(0, RK.FOOD)) {
    const X0 = r.x0 * C;
    const X1 = (r.x1 + 1) * C;
    let k = 0;
    for (let x = X0 + 4; x + 3 < X1 - 1; x += 8.5, k++) furn(0, 'stall', x + 2.5, r.z0 * C + 1.1, 6.0, 1.0, { m: 0.1, pm: 0.2, sign: k, room: r.id });
    for (let z = r.z0 * C + 6; z < (r.z1 + 1) * C - 2.5; z += 4.2)
      for (let x = X0 + 3; x < X1 - 2; x += 4.4) {
        if (rnd() < 0.15) continue;
        const t = furn(0, 'diner', x + (rnd() - 0.5) * 0.6, z + (rnd() - 0.5) * 0.6, 1.3, 1.3, { round: true, m: 0.9, pm: 0.6, room: r.id, chairs: Math.floor(rnd() * 16) });
        if (t && rnd() < 0.12) t.tipped = 1;
      }
  }
  // un fauteuil roulant, seul, tourné vers une vitrine du mail du bas ; le hall du parking : un coin d'attente (deux
  // canapés face à face, une table basse, deux fauteuils)
  {
    const r = roomsOf(1, RK.MAIL)[0];
    furn(1, 'wheelchair', r.x0 * C + 14 + rnd() * 6, (MAIL.z1 + 1) * C - 1.3, 0.85, 1.15, { m: 0.2, yaw: 0.15 });
    const lb = roomsOf(1, RK.LOBBY)[0];
    if (lb) {
      const x = lb.x0 * C + 5;
      const z = (lb.z0 + lb.z1 + 1) * C * 0.5;
      furn(1, 'sofa', x, z - 1.6, 1.85, 0.85, { m: 0.1, room: lb.id, face: 1 });
      furn(1, 'sofa', x, z + 1.6, 1.85, 0.85, { m: 0.1, room: lb.id, face: -1 });
      furn(1, 'ctable', x, z, 1.2, 0.6, { m: 0.05, room: lb.id, solid: false });
      for (const s of [-1, 1]) furn(1, 'lounge', x + s * 2.0, z, 1.0, 1.2, { m: 0.05, room: lb.id, yaw: s > 0 ? -Math.PI / 2 : Math.PI / 2 });
    }
  }
  // le grand magasin : des gondoles en files, des portants, les caisses près du portail
  for (const fi of [0, 1]) {
    for (const r of [...roomsOf(fi, RK.STORE), ...roomsOf(fi, RK.CLOSED)]) {
      const closed = r.kind === RK.CLOSED;
      const X0 = r.x0 * C;
      const X1 = (r.x1 + 1) * C;
      const Z0 = r.z0 * C;
      const Z1 = (r.z1 + 1) * C;
      if (!closed) {
        for (let z = Z0 + 4; z < Z1 - 4; z += 4.5)
          for (let x = X0 + 3.5; x < X1 - 3; x += 9) {
            if (rnd() < 0.3) furn(fi, 'rack', x, z, 1.2, 1.2, { round: true, m: 0.5, room: r.id });
            else furn(fi, 'gondola', x, z, 5.5, 1.0, { m: 0.9, pm: 0.4, room: r.id, empty: rnd() < 0.5 });
          }
      } else {
        // fermé : presque vide ; quelques portants, des mannequins debout dans le noir
        for (let i = 0; i < 14; i++) {
          const x = X0 + 3 + rnd() * (X1 - X0 - 6);
          const z = Z0 + 3 + rnd() * (Z1 - Z0 - 6);
          if (i % 3 === 0) furn(fi, 'rack', x, z, 1.2, 1.2, { round: true, m: 0.6, room: r.id });
          else furn(fi, 'mannequin', x, z, 0.5, 0.5, { round: true, m: 0.4, room: r.id, yaw: rnd() * 6.28 });
        }
      }
    }
  }
  // le cinéma : le comptoir des confiseries, une rangée de bornes d'arcade, les cordons devant le contrôle des billets
  {
    const r = roomsOf(0, RK.CINE)[0];
    const X0 = r.x0 * C;
    furn(0, 'concession', X0 + 9, r.z0 * C + 1.0, 9.0, 1.1, { m: 0.1, pm: 0.2, room: r.id });
    for (let i = 0; i < 6; i++) furn(0, 'arcade', X0 + 0.55, r.z0 * C + 12 + i * 1.0, 0.8, 0.9, { m: 0.02, pm: 0.2, room: r.id, rot: 1, lit: i % 3 !== 1, face: 1 });
    for (let i = 0; i < 4; i++) furn(0, 'stanchion', (r.x1 + 1) * C - 2.5, 6.5 * C + i * 1.6, 0.3, 0.3, { round: true, m: 0.05, room: r.id, solid: false });
  }
  // les salles : des rangées de fauteuils rouges face à l'écran (mur est), des allées aux deux bouts
  for (const r of roomsOf(0, RK.SCREEN)) {
    const X0 = r.x0 * C;
    const X1 = (r.x1 + 1) * C;
    const Z0 = r.z0 * C;
    const Z1 = (r.z1 + 1) * C;
    for (let x = X0 + 2.6; x < X1 - 4.5; x += 1.15) {
      const it = furn(0, 'seats', x, (Z0 + Z1) / 2, Z1 - Z0 - 3.0, 0.62, { rot: 1, m: 0.02, pm: 0, room: r.id });
      if (!it) continue;
    }
  }
  // les toilettes : des cabines contre le mur du fond, les lavabos en face ; le poste de sécurité et les bureaux : des
  // bureaux en rangs ; les quais : des palettes et des caisses ; les locaux techniques : de grosses machines
  for (const fi of [0, 1]) {
    for (const r of roomsOf(fi, RK.WC)) {
      for (let x = r.x0 * C + 1.2; x < (r.x1 + 1) * C - 1; x += 1.6) furn(fi, 'stall', x, (r.z1 + 1) * C - 0.9, 1.5, 1.6, { m: 0.02, pm: 0.1, room: r.id, toilet: true });
      furn(fi, 'sinks', (r.x0 + 3) * C, r.z0 * C + 0.45, 5.0, 0.6, { m: 0.05, room: r.id });
    }
    for (const r of roomsOf(fi, RK.OFFICE)) {
      for (let z = r.z0 * C + 2.5; z < (r.z1 + 1) * C - 2; z += 3.4)
        for (let x = r.x0 * C + 2.5; x < (r.x1 + 1) * C - 2; x += 3.8) furn(fi, 'desk', x, z, 2.0, 0.95, { m: 0.6, pm: 0.4, room: r.id, yaw: rnd() < 0.2 ? 0.4 : 0, security: r.name === 'Security' });
    }
    for (const r of roomsOf(fi, RK.DOCK)) {
      for (let i = 0; i < 22; i++) furn(fi, rnd() < 0.6 ? 'pallet' : 'crate', r.x0 * C + 2 + rnd() * ((r.x1 - r.x0 + 1) * C - 4), r.z0 * C + 2 + rnd() * ((r.z1 - r.z0 + 1) * C - 4), 1.2, 1.0, { m: 0.8, room: r.id, stack: 1 + Math.floor(rnd() * 3) });
    }
    if (fi === 1) {
      const r = F[1].rooms.find((o) => o.name === 'Plant rooms');
      if (r) for (let x = r.x0 * C + 4; x < (r.x1 + 1) * C - 4; x += 7) for (const z of [r.z0 * C + 2.5, (r.z1 + 1) * C - 2.5]) furn(1, 'machine', x, z, 4.0, 2.2, { m: 0.5, room: r.id });
    }
  }

  // --- 12. Ce qui se parcourt : les cases libres atteintes depuis l'arrivée (en haut) et depuis le pied des
  // escaliers (en bas), sans passer par ce que l'entité évite ---
  const isWallOf = (f) => (gx, gz) => {
    if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
    const v = f.grid[gz * W + gx];
    return v === T.WALL || v === T.EXIT || v === T.SHELF || v === T.GATE || v === T.MACHINE;
  };
  const stairSet = new Set(stairs.flatMap((st) => st.cells.map((c) => c.gz * W + c.gx)));
  const reach = (f, starts) => {
    const dist = new Int32Array(W * H).fill(-1);
    const q = [];
    for (const c of starts) {
      dist[c.gz * W + c.gx] = 0;
      q.push(c.gz * W + c.gx);
    }
    const wall = isWallOf(f);
    for (let h = 0; h < q.length; h++) {
      const k = q[h];
      const x = k % W;
      const z = (k - x) / W;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        const nk = nz * W + nx;
        if (wall(nx, nz) || dist[nk] >= 0 || f.navBlock.has(nk) || stairSet.has(nk)) continue;
        dist[nk] = dist[k] + 1;
        q.push(nk);
      }
    }
    return dist;
  };
  const spawnCell = { gx: 19, gz: 23 };
  const distUp = reach(up, [spawnCell]);
  const distDn = reach(
    dn,
    stairs.map((st) => ({ gx: Math.floor(st.down.x / C), gz: Math.floor(st.down.z / C) })),
  );
  const walk = (f, dist) => {
    const out = [];
    for (let z = 0; z < H; z++) for (let x = 0; x < W; x++) if (dist[z * W + x] >= 0 && f.grid[z * W + x] === T.FLOOR) out.push({ x, z });
    return out;
  };
  const walkUp = walk(up, distUp);
  const walkDn = walk(dn, distDn);

  // --- 13. Les objets : de l'eau d'amande et des piles, loin de l'arrivée, jamais au bord d'un vide ---
  const scatter = (f, wk, dist, n, used) => {
    const out = [];
    for (let i = 0; i < 3000 && out.length < n; i++) {
      const c = pick(wk);
      if (dist[c.z * W + c.x] < 6) continue;
      const x = (c.x + 0.3 + rnd() * 0.4) * C;
      const z = (c.z + 0.3 + rnd() * 0.4) * C;
      if (f.solids.hit(x, z, 0.7) || used.some((b) => Math.hypot(b.x - x, b.z - z) < 9)) continue;
      used.push({ x, z });
      out.push({ id: out.length, x, z, gx: c.x, gz: c.z, taken: false });
    }
    return out;
  };

  // l'entité part du fond du couloir des salles du cinéma
  const monsterCell = { x: 95, z: 38 };

  const finish = (f, dist, wk, el, spawn, o = {}) => {
    const used = [];
    const bottles = scatter(f, wk, dist, 6, used);
    const batteries = scatter(f, wk, dist, 6, used);
    const isWall = (gx, gz) => {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
      const v = f.grid[gz * W + gx];
      return v === T.WALL || v === T.EXIT || v === T.PILLAR || v === T.GATE || v === T.MACHINE || v === T.SHELF;
    };
    const map = {
      level: MALL_LEVEL,
      name: 17,
      floor: f.fi,
      ceil: MALL_CEIL,
      W,
      H,
      grid: f.grid,
      zone: f.zone,
      rooms: f.rooms,
      shops: f.shops,
      doors: f.doors,
      voids: f.voids,
      escalators: escalators.filter((e) => e.fi === f.fi),
      allEscalators: escalators,
      screens: f.fi === 0 ? screens : [],
      fakeScreens: f.fi === 0 ? fakeScreens : [],
      courts: COURTS,
      mailZ: MZ,
      walkable: wk,
      dist,
      spawn,
      exit: el.exit,
      elevator: el.elevator,
      cassettes: [],
      fuses: [],
      lights: f.lights,
      props: [],
      furn: f.furn,
      bottles,
      batteries,
      items: itemList(['bottle', bottles], ['battery', batteries]),
      pits: [],
      niche: null,
      stairs,
      pillars: f.pillars,
      solids: f.solids.list,
      navBlock: f.navBlock,
      pitAt: () => -1,
      isWall,
      pillarAt(gx, gz) {
        if (gx < 0 || gx >= W || gz < 0 || gz >= H) return null;
        const k = gz * W + gx;
        return f.grid[k] === T.PILLAR ? f.pillars[k] || null : null;
      },
      collide: (x, z, r) => f.solids.hit(x, z, r),
      solidDist: (o, x, z) => f.solids.dist(o, x, z),
      roomAt(x, z) {
        const gx = Math.floor(x / C);
        const gz = Math.floor(z / C);
        if (gx < 0 || gz < 0 || gx >= W || gz >= H) return null;
        const id = f.zone[gz * W + gx];
        return id >= 0 ? f.rooms[id] : null;
      },
      inVoid: (x, z, m = 0) => f.voids.some((v) => polyDist(v.pts, x, z) <= m),
      isWalkableWorld(wx, wz) {
        return !isWall(Math.floor(wx / C), Math.floor(wz / C)) && !f.solids.hit(wx, wz, 0.05);
      },
      ...o,
    };
    // pour les chemins de l'entité : le bord des vides, le pied des escalators, devant les grilles sont des murs
    map.nav = Object.create(map);
    map.nav.isWall = (gx, gz) => isWall(gx, gz) || f.navBlock.has(gz * W + gx);
    return map;
  };
  const upper = finish(up, distUp, walkUp, L0, cellPos(spawnCell.gx, spawnCell.gz), { monsterSpawn: cellPos(monsterCell.x, monsterCell.z), escNowhere });
  const lower = finish(dn, distDn, walkDn, L1, { ...stairs[0].down, gx: Math.floor(stairs[0].down.x / C), gz: Math.floor(stairs[0].down.z / C) }, { monsterSpawn: cellPos(80, 10) });
  return { level: MALL_LEVEL, floors: [upper, lower], stairs, bridges, voids: { west: voidW, center: voidC, east: voidE } };
}
