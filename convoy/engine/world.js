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

// Ruines d'un tronçon k (zw dans [-(k+1)·CHUNK, -k·CHUNK]). Déterministe : même graine → mêmes ruines partout.
const KINDS = ['house', 'station', 'pylon', 'hulk', 'silo'];
export function chunkRuins(seed, k, lootRate) {
  const rng = makeRng(hash(seed ^ Math.imul(k + 1, 0x9e3779b1)));
  const out = [];
  const n = k < 0 ? 0 : rng.int(1, 3);
  for (let j = 0; j < n; j++) {
    const side = rng.chance(0.5) ? -1 : 1;
    const x = side * rng.range(9.5, 24);
    const zw = -k * CHUNK - rng.range(4, CHUNK - 4);
    const kind = rng.pick(KINDS);
    const rot = rng.range(-0.5, 0.5);
    const id = k * 8 + j;
    // une ruine trop proche d'une autre dans le même tronçon est sautée
    if (out.some((r) => Math.hypot(r.x - x, r.zw - zw) < 10)) continue;
    const pieces = buildPieces(kind, rng);
    const loot = rng.chance(lootRate) ? (rng.chance(0.25) ? 2 : 1) : 0;
    // point de fouille : côté voie, hors des murs (les caisses trouvées y tombent, accessibles)
    out.push({ id, k, kind, x, zw, rot, pieces, loot, side, spot: { x: x - side * 4.6, zw }, seed: hash(id + seed) });
  }
  // caisse tombée d'un convoi précédent, parfois, au bord des rails
  const loose = rng.chance(lootRate * 0.45) ? { x: (rng.chance(0.5) ? -1 : 1) * rng.range(3.4, 12), zw: -k * CHUNK - rng.range(3, CHUNK - 3) } : null;
  return { ruins: out, loose };
}

// Morceaux d'une ruine dans son repère local (dx, dz, largeur w, profondeur d, hauteur h, rotation r).
function buildPieces(kind, rng) {
  const P = [];
  const box = (dx, dz, w, d, h, r = 0, m = 'stone') => P.push({ dx, dz, w, d, h, r, m });
  if (kind === 'house') {
    const W = rng.range(4.5, 6.5), D = rng.range(4, 5.5);
    box(0, -D / 2, W, 0.35, rng.range(1.6, 2.8));
    box(-W / 2, 0, 0.35, D, rng.range(1.0, 2.6));
    if (rng.chance(0.7)) box(W / 2, 0, 0.35, D * rng.range(0.4, 1), rng.range(0.8, 2.2));
    box(rng.range(-1, 1), rng.range(0, 1), rng.range(1.6, 2.6), rng.range(1.4, 2.2), 0.45, rng.range(-0.6, 0.6), 'roof');
  } else if (kind === 'station') {
    box(0, 0, 7, 2.2, 0.7, 0, 'concrete');                       // quai
    box(-2.6, -0.4, 0.4, 0.4, 2.8, 0, 'metal'); box(2.6, -0.4, 0.4, 0.4, 2.8, 0, 'metal');
    box(0, -0.4, 6.4, 1.6, 0.2, 0.12, 'roof');                    // auvent effondré
  } else if (kind === 'pylon') {
    box(0, 0, 1.2, 1.2, 4.8, 0, 'metal');
    box(1.6, 1.0, 2.4, 0.5, 0.6, 0.7, 'metal');
  } else if (kind === 'hulk') {
    box(0, 0, 2.0, 4.2, 1.4, 0, 'rust');                         // carcasse de camion
    box(0, -2.6, 1.8, 1.2, 1.9, 0, 'rust');
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
