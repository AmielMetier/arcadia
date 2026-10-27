// Birdie Party — les bots. Ils choisissent leur club et leur cible comme le caddie, cherchent la force et la direction
// en simulant quelques coups (en tenant compte du vent et de la pente selon leur niveau), puis tremblent un peu.
// Moteur pur : l'hôte calcule le coup d'un bot, puis le joue comme celui d'un joueur.
import { CLUBS, PUTTER, putterRange } from './clubs.js';
import { simulate } from './physics.js';
import { suggestClub, clubReach, distToPin, layupPoint, pinReachable } from './advice.js';
import { makeRng } from './rng.js';

// pow / curve / aim : dispersion de la force, de l'effet, de la direction ; read : part du vent et de la pente prise en compte
export const SKILL = {
  facile: { pow: 0.13, curve: 0.5, aim: 0.05, read: 0.2, putt: 0.2 },
  normal: { pow: 0.065, curve: 0.25, aim: 0.022, read: 0.6, putt: 0.09 },
  expert: { pow: 0.022, curve: 0.07, aim: 0.008, read: 0.95, putt: 0.03 },
};
export const BOT_NAMES = ['Paulo', 'Mimi', 'Gus', 'Lou', 'Nina', 'Tom'];

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// coup d'un bot : { club, traj, aim, power, curve, putt }
export function botShot(hole, ball, wind, level = 'normal', seed = 1) {
  const S = SKILL[level] || SKILL.normal, r = makeRng(seed);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += r.next(); return (u - 2) / 0.58; };
  const club = suggestClub(hole, ball);
  const readWind = wind ? { x: wind.x * S.read, z: wind.z * S.read } : null;
  const d = distToPin(hole, ball);

  if (club === PUTTER) {
    // putt : on essaie quelques directions et forces sur le green (lu plus ou moins bien), on garde le meilleur
    const putt = putterRange(d), base = Math.atan2(hole.pin.x - ball.x, hole.pin.z - ball.z);
    let best = { e: Infinity, aim: base, power: Math.min(1, (d + 0.5) / putt) };
    for (let da = -0.16; da <= 0.161; da += 0.04) {
      for (let k = 0; k < 6; k++) {
        const power = clamp((d * (0.85 + k * 0.08) + 0.3) / putt, 0.05, 1.1);
        const res = simulate(hole, ball, { club, aim: base + da * S.read, power, seed: 1 }, null, { putt });
        const e = res.kind === 'holed' ? -1 : Math.hypot(res.end.x - hole.pin.x, res.end.z - hole.pin.z);
        if (e < best.e) best = { e, aim: base + da * S.read, power };
      }
    }
    return { club, traj: 'mid', aim: best.aim + gauss() * S.aim * 0.8, power: clamp(best.power * (1 + gauss() * S.putt), 0.03, 1.15), curve: 0, putt };
  }

  // coup plein : cible = drapeau à portée, sinon un point de la ligne de jeu
  const reach = clubReach(hole, ball, club), direct = pinReachable(hole, ball, reach);
  const target = direct ? { x: hole.pin.x, z: hole.pin.z } : (layupPoint(hole, ball, reach * 0.95) || { x: hole.pin.x, z: hole.pin.z });
  let aim = Math.atan2(target.x - ball.x, target.z - ball.z);
  let power = clamp(Math.hypot(target.x - ball.x, target.z - ball.z) / reach, 0.15, 1);
  // deux corrections : la portée (force) puis la dérive (direction), au point de chute ; vers le drapeau on vise un
  // peu court pour laisser rouler la balle (quelques mètres sur le green)
  const short = !direct ? 1 : d < 35 ? 0.88 : d < 70 ? 0.92 : 0.95;
  for (let it = 0; it < 3; it++) {
    const res = simulate(hole, ball, { club, traj: 'mid', aim, power, curve: 0, seed: 1 }, readWind, { stopAtLanding: true });
    const lx = res.end.x - ball.x, lz = res.end.z - ball.z, tx = target.x - ball.x, tz = target.z - ball.z;
    const carry = Math.hypot(lx, lz), want = Math.hypot(tx, tz) * short;
    if (carry > 1) power = clamp(power * Math.pow(want / carry, 0.8), 0.12, 1);
    aim += (Math.atan2(tx, tz) - Math.atan2(lx, lz));
  }
  return { club, traj: 'mid', aim: aim + gauss() * S.aim, power: clamp(power * (1 + gauss() * S.pow), 0.1, 1.05), curve: clamp(gauss() * S.curve, -1, 1), putt: 20 };
}
