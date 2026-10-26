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

// direction proposée : le drapeau s'il est à portée, sinon un point de la ligne de jeu à la bonne distance
export function suggestAim(hole, ball, club) {
  const b = ball, reach = clubReach(hole, ball, club), dp = distToPin(hole, b);
  const toPin = Math.atan2(hole.pin.x - b.x, hole.pin.z - b.z);
  if (club === PUTTER || dp <= reach * 1.05) return toPin;
  const target = layupPoint(hole, b, reach * 0.96);
  return target ? Math.atan2(target.x - b.x, target.z - b.z) : toPin;
}

// point de la ligne de jeu à `reach` mètres de la balle, plus près du green qu'elle
export function layupPoint(hole, b, reach) {
  const pts = hole.center, dp = distToPin(hole, b);
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= L; d += 2) {
      const x = ax + (bx - ax) * d / L, z = az + (bz - az) * d / L;
      if (Math.hypot(x - b.x, z - b.z) >= reach && Math.hypot(hole.pin.x - x, hole.pin.z - z) < dp) return { x, z };
    }
  }
  return null;
}
