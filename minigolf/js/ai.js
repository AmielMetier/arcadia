/* Golf Party — bots : ils essaient des coups avec le vrai moteur physique et gardent le meilleur.
   planShot est un générateur : l'appelant le fait avancer par petits bouts pour ne pas figer l'image. */
import { makeBall, strike, simulate } from './physics.js';
import { routeRemaining } from './build.js';

export const BOT_LEVELS = {
  facile: { yaw: 0.075, pow: 0.13, tries: 0.5, think: [1.6, 2.6] },
  normal: { yaw: 0.03, pow: 0.055, tries: 0.8, think: [1.4, 2.4] },
  expert: { yaw: 0.009, pow: 0.018, tries: 1.15, think: [1.2, 2.0] },
};

function cloneBalls(balls) { return balls.map((b) => ({ ...b, p: b.p.slice(), v: b.v.slice(), start: b.start.slice(), gn: b.gn.slice() })); }

/** Évalue un coup : plus c'est petit, mieux c'est */
export function evalShot(hole, balls, meIdx, yaw, power, t0, collide = true) {
  const bs = cloneBalls(balls), me = bs[meIdx];
  strike(hole.world, me, yaw, power);
  simulate(hole.world, bs, t0, { maxT: 16, collide });
  if (me.holed) return { score: -100 + power, holed: true, p: me.p };
  if (me.oob) return { score: 60 + routeRemaining(hole.route, me.start).rem, oob: true, p: me.p };
  const r = routeRemaining(hole.route, me.p);
  const dc = Math.hypot(me.p[0] - hole.cup[0], (me.p[1] - hole.cup[1]) * 2, me.p[2] - hole.cup[2]);
  return { score: dc < 2.5 ? Math.min(dc, r.rem + r.off * 0.6) : r.rem + r.off * 0.6, p: me.p };
}

/** Générateur : yield régulièrement ; renvoie { yaw, power } */
export function* planShot(hole, balls, meIdx, t0, levelName = 'normal', rng = Math.random, collide = true) {
  const L = BOT_LEVELS[levelName] || BOT_LEVELS.normal;
  const me = balls[meIdx], p = me.p, cup = hole.cup;
  // directions candidates : droit vers le trou + points du parcours plus loin
  const yaws = new Set();
  const yawTo = (q) => Math.atan2(q[0] - p[0], q[2] - p[2]);
  yaws.add(yawTo(cup));
  const route = hole.route;
  let best = Infinity, bi = 0;
  for (let i = 0; i < route.length; i++) { const d = Math.hypot(route[i][0] - p[0], route[i][2] - p[2]) + Math.abs(route[i][1] - p[1]) * 2; if (d < best) { best = d; bi = i; } }
  let acc = 0;
  const marks = [1.2, 2.5, 4, 6, 8.5, 12, 16, 22];
  let mi = 0;
  for (let i = bi + 1; i < route.length && mi < marks.length; i++) {
    acc += Math.hypot(route[i][0] - route[i - 1][0], route[i][2] - route[i - 1][2]);
    if (acc >= marks[mi]) { yaws.add(yawTo(route[i])); mi++; }
  }
  const base = [...yaws];
  const cands = [];
  const powers = [0.06, 0.1, 0.15, 0.2, 0.26, 0.33, 0.41, 0.5, 0.6, 0.72, 0.86, 1.0];
  const offs = [-0.16, -0.08, 0, 0.08, 0.16];
  for (const y0 of base) for (const o of offs) for (const pw of powers) cands.push([y0 + o, pw]);
  // on garde une part des essais selon le niveau
  const keep = Math.min(cands.length, Math.round(cands.length * Math.min(1, L.tries)));
  for (let i = cands.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [cands[i], cands[j]] = [cands[j], cands[i]]; }
  // les coups directs vers le trou sont toujours essayés
  const direct = powers.map((pw) => [yawTo(cup), pw]);
  const list = direct.concat(cands.slice(0, keep));
  let top = [];
  let n = 0;
  for (const [y, pw] of list) {
    const r = evalShot(hole, balls, meIdx, y, pw, t0, collide);
    top.push({ y, pw, s: r.score });
    if (++n % 3 === 0) yield n / (list.length * 1.6);
  }
  top.sort((a, b) => a.s - b.s); const coarse = top; top = top.slice(0, 5);
  // affinage autour des meilleurs
  const refined = top.slice();
  for (const c of top) {
    for (const dy of [-0.04, -0.015, 0.015, 0.04]) for (const dp of [-0.05, 0, 0.05]) {
      const y = c.y + dy, pw = Math.max(0.03, Math.min(1, c.pw + dp));
      const r = evalShot(hole, balls, meIdx, y, pw, t0, collide);
      refined.push({ y, pw, s: r.score });
      if (++n % 3 === 0) yield Math.min(0.99, n / (list.length * 1.6));
    }
  }
  // robustesse : on rejoue les meilleurs coups avec la maladresse du bot et on garde la meilleure moyenne
  refined.sort((a, b) => a.s - b.s);
  let bestC = refined[0], bestMean = Infinity;
  // candidats : les meilleurs bruts + les meilleurs coups « prudents » (sans sortie, plus doux)
  const safe = coarse.filter((c) => c.s < 50).sort((a, b) => a.pw - b.pw).slice(0, 3);
  const pool = [...refined.slice(0, 8), ...safe];
  for (const c of pool) {
    let sum = c.s;
    for (const [ky, kp] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const r = evalShot(hole, balls, meIdx, c.y + ky * L.yaw, Math.max(0.03, Math.min(1, c.pw * (1 + kp * L.pow))), t0, collide);
      sum += Math.min(r.score, 80);
      if (++n % 3 === 0) yield Math.min(0.99, n / (list.length * 1.6));
    }
    const mean = Math.max(-100, sum / 5);
    if (mean < bestMean) { bestMean = mean; bestC = c; }
  }
  // maladresse selon le niveau (gaussienne approchée)
  const g = () => (rng() + rng() + rng() - 1.5) / 1.5;
  return { yaw: bestC.y + g() * L.yaw, power: Math.max(0.03, Math.min(1, bestC.pw * (1 + g() * L.pow))), score: bestC.s };
}

/** Version synchrone (tests) */
export function planShotSync(...a) { const it = planShot(...a); let r; do { r = it.next(); } while (!r.done); return r.value; }
export { makeBall };
