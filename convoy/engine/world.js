// Convoy Storm — géométrie du convoi et plaine procédurale (moteur pur : ni DOM, ni réseau).
//
// Repères :
//  - « repère du train » : le convoi est immobile, l'avant pointe vers -Z, le centre de la chaudière est à l'origine.
//    Les joueurs, la caméra et la vue 3D vivent dans ce repère.
//  - « repère du sol » : la plaine. Un objet posé au sol a une coordonnée monde `zw` ; dans le repère du train,
//    il se trouve en z = zw + dist (dist = distance parcourue). Plus le convoi avance, plus le décor glisse vers +Z.
import { makeRng, hash } from './rng.js';

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
  { x0: -HALF_W, x1: -0.55, z0: 9.0, z1: 12.0 }, // bac à charbon vide du wagon de queue
  { x0: 0.75, x1: HALF_W, z0: -4.6, z1: -3.2 },  // caisse à outils
];

export const CHUNK = 36;            // longueur d'un tronçon de plaine (m)

// Ambiances : chaque tronçon entre deux gares traverse un paysage qui change les règles du jeu.
// ruins / trees : nombre de ruines et de sapins par tronçon ; wolves, raid (écart entre deux raids), cold : multiplicateurs ;
// ev : poids des événements de voie ; loot : poids des types de caisses ; moments : poids des moments forts ;
// kinds : poids des types de ruines (null = ceux de la plaine) ; ice : sol glissant qui craque.
export const BIOMES = {
  plaine: { icon: '❄️', label: 'Plaine gelée', desc: 'Ruines éparses, un peu de tout.', ruins: [1, 3], trees: [2, 6], wolves: 1, raid: 1, cold: 1,
    ev: { drift: 45, aval: 30, gust: 25 }, loot: { fuel: 62, coal: 18, ice: 14, parts: 6 }, moments: { wreck: 40, boss: 35, roar: 25 }, kinds: null },
  foret: { icon: '🌲', label: 'Forêt noire', desc: 'À l\'abri du vent, du charbon de bois… et des loups partout.', ruins: [0, 2], trees: [9, 15], wolves: 2.2, raid: 1.4, cold: 0.8,
    ev: { drift: 60, aval: 10, gust: 30 }, loot: { coal: 48, fuel: 38, ice: 6, parts: 8 }, moments: { roar: 50, wreck: 50 },
    kinds: [['house', 30], ['hulk', 35], ['depot', 15], ['pylon', 10], ['platform', 10]] },
  ville: { icon: '🏚️', label: 'Ville en ruine', desc: 'Des ruines à perte de vue, des pièces détachées… et les pillards.', ruins: [2, 4], trees: [0, 3], wolves: 0.6, raid: 0.55, cold: 1,
    ev: { drift: 40, aval: 20, gust: 40 }, loot: { fuel: 52, parts: 20, coal: 14, ice: 14 }, moments: { boss: 70, wreck: 30 },
    kinds: [['house', 40], ['depot', 25], ['platform', 15], ['hulk', 12], ['silo', 8]] },
  lac: { icon: '🧊', label: 'Lac gelé', desc: 'Ça glisse, et la glace craque si l\'on reste planté. Beaucoup de caisses gelées.', ruins: [0, 2], trees: [0, 2], wolves: 0.8, raid: 1, cold: 1.2, ice: true,
    ev: { drift: 20, aval: 0, gust: 80 }, loot: { ice: 50, fuel: 36, coal: 8, parts: 6 }, moments: { bridge: 60, boss: 40 },
    kinds: [['hulk', 55], ['platform', 20], ['pylon', 25]] },
  col: { icon: '⛰️', label: 'Col des Glaces', desc: 'Grand froid et avalanches, mais du charbon dans les vieilles mines.', ruins: [1, 3], trees: [1, 4], wolves: 1, raid: 1.5, cold: 1.3,
    ev: { drift: 30, aval: 55, gust: 15 }, loot: { coal: 45, fuel: 35, ice: 14, parts: 6 }, moments: { bridge: 55, roar: 45 },
    kinds: [['temple', 30], ['pylon', 25], ['silo', 25], ['hulk', 20]] },
};
export const BIOME_KEYS = Object.keys(BIOMES);

// Ruines d'un tronçon k (zw dans [-(k+1)·CHUNK, -k·CHUNK]). Déterministe : même graine → mêmes ruines partout.
// Chaque ruine : morceaux solides (boîtes de collision), butin (caisses), ferraille, point de fouille côté voie.
// Un morceau dont la matière commence par « model: » est dessiné avec un modèle 3D (Kenney, CC0) ajusté à sa boîte.
// env : { bio, clear: [d0, d1] } — l'ambiance du tronçon, et une portion de voie à laisser vide (pont, convoi abandonné).
const KINDS = [['house', 30], ['depot', 12], ['hulk', 18], ['temple', 11], ['pylon', 9], ['silo', 8], ['platform', 10]];
export function chunkRuins(seed, k, lootRate, env = {}) {
  const B = BIOMES[env.bio] || BIOMES.plaine;
  const clear = env.clear || null;
  const cleared = (zw, m = 10) => clear && -zw > clear[0] - m && -zw < clear[1] + m;
  const rng = makeRng(hash(seed ^ Math.imul(k + 1, 0x9e3779b1)));
  const out = [];
  const n = k < 0 ? 0 : rng.int(B.ruins[0], B.ruins[1]);
  for (let j = 0; j < n; j++) {
    const side = rng.chance(0.5) ? -1 : 1;
    const x = side * rng.range(10.5, 24);
    const zw = -k * CHUNK - rng.range(5, CHUNK - 5);
    // camp de ravitaillement abandonné : rare, mais plein (3 caisses et de la ferraille)
    const camp = k > 2 && j === 0 && rng.chance(0.07);
    const kind = camp ? 'camp' : rng.weighted(B.kinds || KINDS);
    const rot = rng.range(-0.5, 0.5);
    const id = k * 8 + j;
    // une ruine trop proche d'une autre dans le même tronçon est sautée
    if (out.some((r) => Math.hypot(r.x - x, r.zw - zw) < 12)) continue;
    const pieces = buildPieces(kind, rng);
    const loot = camp ? 3 : rng.chance(lootRate) ? (rng.chance(0.25) ? 2 : 1) : 0;
    const scrap = camp ? 3 : (kind === 'depot' || kind === 'hulk' ? 1 : 0) + (rng.chance(0.45) ? 1 : 0);
    if (cleared(zw, 14)) continue;
    // point de fouille : côté voie, hors des murs (les caisses trouvées y tombent, accessibles)
    out.push({ id, k, kind, x, zw, rot, pieces, loot, scrap, side, spot: { x: x - side * 5.2, zw }, seed: hash(id + seed) });
  }
  // caisse tombée d'un convoi précédent, parfois, au bord des rails
  let loose = rng.chance(lootRate * 0.45) ? { x: (rng.chance(0.5) ? -1 : 1) * rng.range(3.4, 12), zw: -k * CHUNK - rng.range(3, CHUNK - 3) } : null;
  if (loose && cleared(loose.zw)) loose = null;
  // sapins enneigés (solides : on les contourne), jamais sur la voie ni sur une ruine
  const trees = [];
  if (k >= -2) for (let i = rng.int(B.trees[0], B.trees[1]); i > 0; i--) {
    const tx = (rng.chance(0.5) ? -1 : 1) * rng.range(5.5, 34), tz = -k * CHUNK - rng.range(0, CHUNK);
    const s = rng.range(0.8, 1.5), r = rng.range(0, 6.28);
    if (cleared(tz) || out.some((q) => Math.hypot(q.x - tx, q.zw - tz) < 8 || Math.hypot(q.spot.x - tx, q.spot.zw - tz) < 3)) continue;
    trees.push({ x: tx, zw: tz, s, r });
  }
  return { ruins: out, loose, trees, bio: env.bio || 'plaine', clear };
}

// Morceaux d'une ruine dans son repère local (dx, dz, largeur w, profondeur d, hauteur h, rotation r, matière m).
const HOUSES = ['building-small-a', 'building-small-b', 'building-small-c', 'building-small-d'];
const HOUSE_H = { 'building-small-a': 0.95, 'building-small-b': 1.63, 'building-small-c': 1.75, 'building-small-d': 1.0 };
const TRUCKS = ['vehicle-truck-red', 'vehicle-truck-green', 'vehicle-truck-yellow'];
function buildPieces(kind, rng) {
  const P = [];
  const box = (dx, dz, w, d, h, r = 0, m = 'stone') => P.push({ dx, dz, w, d, h, r, m });
  if (kind === 'house') {
    const name = rng.pick(HOUSES), S = rng.range(4.6, 5.6);
    box(0, 0, S, S, HOUSE_H[name] * S, 0, 'model:city/' + name);
    if (rng.chance(0.7)) box(rng.chance(0.5) ? -S * 0.75 : S * 0.75, rng.range(-1, 1), 1.8, 1.4, 0.8, rng.range(-0.6, 0.6), 'model:arena/bricks');
  } else if (kind === 'depot') {
    const S = rng.range(5.6, 6.6);
    box(0, 0, S, S, 0.55 * S, 0, 'model:city/building-garage');
    box(S * 0.2, S * 0.75, 2.4, 1.4, 0.9, 0.3, 'model:arena/bricks');
  } else if (kind === 'platform') {
    box(0, 0, 7, 2.2, 0.7, 0, 'concrete');                       // quai de gare abandonné
    box(-2.6, -0.4, 0.4, 0.4, 2.8, 0, 'metal'); box(2.6, -0.4, 0.4, 0.4, 2.8, 0, 'metal');
    box(0, -0.4, 6.4, 1.6, 0.2, 0.12, 'roof');                    // auvent effondré
  } else if (kind === 'pylon') {
    box(0, 0, 1.2, 1.2, 4.8, 0, 'metal');
    box(1.6, 1.0, 2.4, 0.5, 0.6, 0.7, 'metal');
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
  } else {
    box(0, 0, 2.6, 2.6, 4.2, 0.785, 'concrete');                  // silo (base octogonale approximée)
    box(2.2, 1.4, 1.4, 1.0, 0.9, 0.3, 'stone');
  }
  return P;
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

// Position monde d'un morceau de ruine
export function piecePos(ruin, pc) {
  const c = Math.cos(ruin.rot), s = Math.sin(ruin.rot);
  return { x: ruin.x + pc.dx * c - pc.dz * s, zw: ruin.zw + pc.dx * s + pc.dz * c, rot: ruin.rot + pc.r };
}

export function onDeckRect(x, z) { return Math.abs(x) <= HALF_W && z >= DECK_FRONT && z <= REAR; }
