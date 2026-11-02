// Pilotes de Dogfight 3D : ils choisissent où viser, et le même instructeur que le joueur pilote l'avion.
// Trois niveaux, de vraies différences de visée, de discipline de tir et de réflexes.
import { computeLead, stepLock } from './weapons.js';
import { CENTER, ZONE_WARN, TYPES } from './flight.js';

export const LEVELS = {
  facile: { react: 0.9, err: 0.02, wobble: 0.5, range: 430, cone: 0.985, burst: 0.55, rest: 1.1, sight: 900, pull: 0.62, missiles: false, flares: 0, evade: 0, heat: 0.5, margin: 90 },
  normal: { react: 0.45, err: 0.03, wobble: 0.9, range: 480, cone: 0.9955, burst: 0.8, rest: 0.8, sight: 1300, pull: 0.82, missiles: true, flares: 0.45, evade: 0.25, heat: 0.7, margin: 70 },
  expert: { react: 0.2, err: 0.011, wobble: 1.3, range: 640, cone: 0.9975, burst: 1.3, rest: 0.35, sight: 1800, pull: 1, missiles: true, flares: 0.9, evade: 0.45, heat: 0.85, margin: 55 },
};

const norm = (x, y, z) => { const n = Math.hypot(x, y, z) || 1; return { x: x / n, y: y / n, z: z / n }; };

export function botInput(b, g, world, dt) {
  const L = LEVELS[b.lvl] || LEVELS.normal;
  const inp = { p: 0, r: 0, y: 0, boost: false, brake: false, fire: false, msl: false, flare: false, lim: L.pull };
  const a = b.ai || (b.ai = { t: Math.random() * L.react, target: null, seed: Math.random() * 100, burst: 0, rest: 0, way: null, wayT: 0, evade: 0, ex: 0, ey: 0, ez: 0 });
  a.t -= dt;

  // 1. Le sol d'abord : on regarde devant soi, d'autant plus loin qu'on va vite
  const here = world.obstacleAt(b.x, b.z), alt = b.y - here;
  let danger = 0;
  for (const s of [0.8, 1.6, 2.6, 3.6]) {
    const d = b.speed * s, h = world.obstacleAt(b.x + b.fx * d, b.z + b.fz * d), yy = b.y + b.fy * d;
    if (yy < h + L.margin) danger = Math.max(danger, 1 - s / 5);
  }
  if (alt < L.margin * 0.8) danger = 1;
  if (danger > 0) {
    const up = 0.45 + danger * 0.75;
    const dir = norm(b.fx, up, b.fz);
    inp.ax = dir.x; inp.ay = dir.y; inp.az = dir.z; inp.lim = 1;
    inp.boost = b.speed < 150;
    return inp;
  }

  // 2. Pas de collision : un avion qui fonce sur nous, on s'écarte
  for (const q of g.planes) {
    if (!q.alive || q.id === b.id) continue;
    const dx = q.x - b.x, dy = q.y - b.y, dz = q.z - b.z, d = Math.hypot(dx, dy, dz);
    if (d > 170 || d < 1) continue;
    const rvx = q.fx * q.speed - b.fx * b.speed, rvy = q.fy * q.speed - b.fy * b.speed, rvz = q.fz * q.speed - b.fz * b.speed;
    const closing = -(dx * rvx + dy * rvy + dz * rvz) / d;
    if (closing > 20 && d / closing < 1.5) {
      const away = b.id < q.id ? 1 : -1, e = norm(b.fx - dx / d * 0.7 + b.lx * away * 0.5, b.fy - dy / d * 0.7 + (b.y < 200 ? 0.5 : 0), b.fz - dz / d * 0.7 + b.lz * away * 0.5);
      inp.ax = e.x; inp.ay = e.y; inp.az = e.z; inp.lim = 1;
      return inp;
    }
  }

  // 3. Trop loin ou trop haut : retour vers l'île
  const dcx = CENTER - b.x, dcz = CENTER - b.z, dist = Math.hypot(dcx, dcz);
  if (dist > ZONE_WARN - 200 || b.y > 800) {
    const dir = norm(dcx / (dist || 1), b.y > 650 ? -0.4 : 0.05, dcz / (dist || 1));
    inp.ax = dir.x; inp.ay = dir.y; inp.az = dir.z; inp.boost = dist > ZONE_WARN;
    return inp;
  }

  // 4. Choix de la cible : devant et proche, jamais à travers un nuage
  if (a.t <= 0) {
    a.t = L.react;
    let best = null, bestScore = -Infinity;
    for (const q of g.planes) {
      if (!q.alive || q.id === b.id || (b.team && b.team === q.team)) continue;
      const dx = q.x - b.x, dy = q.y - b.y, dz = q.z - b.z, d = Math.hypot(dx, dy, dz) || 1;
      const sight = L.sight * (TYPES[q.type] || TYPES.f16).sig ** 0.5;
      if (d > sight || (d > 260 && world.inCloud(q.x, q.y, q.z))) continue;
      const dot = (dx * b.fx + dy * b.fy + dz * b.fz) / d;
      const score = dot * 1.6 - d / 700 + (q.id === a.target ? 0.5 : 0) + (q.health < 40 ? 0.3 : 0);
      if (score > bestScore) { bestScore = score; best = q; }
    }
    a.target = best ? best.id : null;
    // on nous tire dessus ? rupture
    if (a.evade <= 0 && Math.random() < L.evade) {
      for (const q of g.planes) {
        if (!q.alive || q.id === b.id || (b.team && b.team === q.team)) continue;
        const dx = b.x - q.x, dy = b.y - q.y, dz = b.z - q.z, d = Math.hypot(dx, dy, dz) || 1;
        if (d < 380 && (dx * q.fx + dy * q.fy + dz * q.fz) / d > 0.97 && (dx * b.fx + dy * b.fy + dz * b.fz) / d > 0.3) {
          const s = Math.random() < 0.5 ? 1 : -1, e = norm(b.lx * s + b.fx * 0.25, Math.random() * 0.5 - 0.15, b.lz * s + b.fz * 0.25);
          a.ex = e.x; a.ey = e.y; a.ez = e.z; a.evade = 0.9 + Math.random() * 0.8;
          break;
        }
      }
    }
  }
  // un missile nous suit : leurre et rupture
  if (b.warn) {
    if (b.fl > 0 && b.flCd <= 0 && Math.random() < L.flares * dt * 3) inp.flare = true;
    if (a.evade <= 0 && Math.random() < L.evade * dt * 4) { const s = Math.random() < 0.5 ? 1 : -1, e = norm(b.lx * s, 0.2, b.lz * s); a.ex = e.x; a.ey = e.y; a.ez = e.z; a.evade = 1.4; }
  }
  if (a.evade > 0) {
    a.evade -= dt;
    let dir = { x: a.ex, y: a.ey, z: a.ez };
    if (alt < 180 && dir.y < 0.1) dir = norm(dir.x, 0.25, dir.z);
    inp.ax = dir.x; inp.ay = dir.y; inp.az = dir.z; inp.lim = 1; inp.boost = b.speed < 170;
    return inp;
  }

  const t = a.target !== null ? g.planes.find((q) => q.id === a.target && q.alive) : null;

  // 5. Personne en vue : patrouille autour de l'île
  if (!t) {
    a.wayT -= dt;
    if (!a.way || a.wayT <= 0) { const an = Math.random() * 6.283, r = 200 + Math.random() * 500; a.way = { x: CENTER + Math.cos(an) * r, y: 200 + Math.random() * 180, z: CENTER + Math.sin(an) * r }; a.wayT = 8; }
    const dir = norm(a.way.x - b.x, (a.way.y - b.y) * 0.8, a.way.z - b.z);
    inp.ax = dir.x; inp.ay = dir.y; inp.az = dir.z;
    return inp;
  }

  // 6. Poursuite : viser le point d'anticipation, avec une erreur qui dépend du niveau
  const l = computeLead(b.x, b.y, b.z, b.fx * b.speed, b.fy * b.speed, b.fz * b.speed, t.x, t.y, t.z, t.fx * t.speed, t.fy * t.speed, t.fz * t.speed);
  const time = g.clock + a.seed, e = L.err;
  let dir = norm(l.x - b.x, l.y - b.y, l.z - b.z);
  dir = norm(dir.x + Math.sin(time * L.wobble * 1.3) * e, dir.y + Math.sin(time * L.wobble * 1.9 + 1) * e, dir.z + Math.cos(time * L.wobble * 1.7 + 2) * e);
  // à basse altitude, on ne plonge pas sur une cible
  if (alt < 130 && dir.y < 0) dir = norm(dir.x, 0.02, dir.z);
  // le combat reste au-dessus de l'île : on ne suit pas une cible jusqu'au plafond
  if (b.y > 380 && (l.dist > 450 || dir.x * b.fx + dir.y * b.fy + dir.z * b.fz < 0.97)) dir = norm(dir.x, dir.y - Math.min(0.8, (b.y - 380) / 320), dir.z);
  inp.ax = dir.x; inp.ay = dir.y; inp.az = dir.z;

  const align = dir.x * b.fx + dir.y * b.fy + dir.z * b.fz;
  // 7. Gaz
  inp.boost = l.dist > 520 && b.ab > 0.25;
  inp.brake = l.dist < 130 && align > 0.5;

  // 8. Tir : rafales courtes, canon surveillé
  if (a.rest > 0) a.rest -= dt;
  const inFire = align > L.cone && l.dist < L.range && !b.over && b.heat < L.heat;
  if (inFire && a.rest <= 0) {
    inp.fire = true;
    a.burst += dt;
    if (a.burst > L.burst) { a.burst = 0; a.rest = L.rest * (0.7 + Math.random() * 0.6); }
  } else if (!inFire) a.burst = Math.max(0, a.burst - dt);

  // 9. Missile quand l'accrochage est complet
  if (L.missiles && b.lockT >= 1 && b.msCd <= 0 && l.dist > 280) inp.msl = true;
  return inp;
}
export { stepLock };
