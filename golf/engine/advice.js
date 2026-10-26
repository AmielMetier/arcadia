// Birdie Party — le caddie : club et direction proposés pour un coup. Partagé par le jeu (proposition au joueur)
// et par les bots (point de départ de leur coup). Moteur pur.
import { CLUBS, PUTTER, lieFactor, putterRange } from './clubs.js';

export const distToPin = (hole, b) => Math.hypot(hole.pin.x - b.x, hole.pin.z - b.z);
const SAND = (lie) => lie === 'bunker' || lie === 'beach';

// clubs permis : le driver seulement depuis le départ ; le putter partout
export function allowedClub(i, lie) { return !(CLUBS[i].teeOnly && lie !== 'tee'); }

// portée d'un coup plein (m) depuis cette position ; au putter, la portée de la jauge
export function clubReach(hole, ball, club) {
  if (club === PUTTER) return putterRange(distToPin(hole, ball));
  return CLUBS[club].dist * lieFactor(ball.lie, club);
}

// le putter sur le green (ou tout près sur l'avant-green), le sand wedge dans le sable près du green,
// sinon le club le plus court qui atteint le drapeau
export function suggestClub(hole, ball) {
  const d = distToPin(hole, ball), lie = ball.lie;
  if (lie === 'green' || (lie === 'fringe' && d < 18)) return PUTTER;
  if (SAND(lie) && d < 85) return 6;
  let best = -1;
  for (let i = PUTTER - 1; i >= 0; i--) {
    if (!allowedClub(i, lie)) continue;
    best = i;
    if (CLUBS[i].dist * lieFactor(lie, i) >= d * 0.97) return i;
  }
  return best;
}

// le drapeau est-il jouable tout droit ? à portée, et pas d'eau ni de hors-limites là où retombe un coup un peu court
// (passer au-dessus de l'eau, lui, est permis : c'est tout l'intérêt d'un green en île)
export function pinReachable(hole, b, reach) {
  const dp = distToPin(hole, b);
  if (dp > reach * 1.05) return false;
  for (const short of [Math.max(8, dp * 0.07), Math.max(15, dp * 0.13)]) {
    const k = Math.max(0, (dp - short) / dp), s = hole.surfaceAt(b.x + (hole.pin.x - b.x) * k, b.z + (hole.pin.z - b.z) * k);
    if (s === 'water' || s === 'ob') return false;
  }
  return true;
}

// direction proposée : le drapeau s'il est à portée sans risque, sinon un point de la ligne de jeu à la bonne distance
export function suggestAim(hole, ball, club) {
  const b = ball, reach = clubReach(hole, ball, club);
  const toPin = Math.atan2(hole.pin.x - b.x, hole.pin.z - b.z);
  if (club === PUTTER || pinReachable(hole, b, reach)) return toPin;
  const target = layupPoint(hole, b, reach * 0.96);
  return target ? Math.atan2(target.x - b.x, target.z - b.z) : toPin;
}

// point de chute quand le green est hors de portée : sur la ligne de jeu, plus près du green que la balle, au plus à
// `reach` mètres, sur un sol jouable (le fairway de préférence ; jamais l'eau ni le hors-limites, le sable si possible
// pas), et pas au bord de l'eau. On préfère le plus loin ; s'il n'y a rien de sûr à portée (îles), on reste court.
const BONUS = { fairway: 35, fringe: 35, green: 35, tee: 20, rough: 0, desert: -6, bunker: -60, beach: -60 };
export function layupPoint(hole, b, reach) {
  const pts = hole.center, dp = distToPin(hole, b);
  let best = null, bestScore = -Infinity, first = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= L; d += 3) {
      const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L;
      const r = Math.hypot(x - b.x, z - b.z);
      if (r > reach || r < 12 || Math.hypot(hole.pin.x - x, hole.pin.z - z) >= dp) continue;
      if (!first && r >= reach * 0.98) first = { x, z };
      const s = hole.surfaceAt(x, z);
      if (s === 'water' || s === 'ob' || !(s in BONUS)) continue;
      let wet = 0;
      for (const [ox, oz] of [[9, 0], [-9, 0], [0, 9], [0, -9]]) { const t = hole.surfaceAt(x + ox, z + oz); if (t === 'water' || t === 'ob') wet++; }
      // un coup un peu court ne doit pas finir à l'eau
      for (const k of [0.84, 0.92]) { const t = hole.surfaceAt(b.x + (x - b.x) * k, b.z + (z - b.z) * k); if (t === 'water' || t === 'ob') wet += 3; }
      // survoler le hors-limites, c'est survoler la forêt : les arbres arrêtent la balle
      for (const k of [0.4, 0.55, 0.7]) if (hole.surfaceAt(b.x + (x - b.x) * k, b.z + (z - b.z) * k) === 'ob') wet += 1.5;
      const score = r + BONUS[s] - wet * 45;
      if (score > bestScore) { bestScore = score; best = { x, z }; }
    }
  }
  return best || first;
}
