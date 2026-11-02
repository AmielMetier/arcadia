/* Chasse aux bugs de physique du Mini-Golf : coups au hasard sur chaque trou, puis on cherche
   - les balles qui s'endorment sans sol sous elles (suspendues contre un bord ou dans le vide),
   - les balles qui traversent un mur ou un sol (passage d'un côté à l'autre d'un triangle entre deux pas).
   node tools/fuzz-minigolf.mjs [coups par trou] [parcours] */
import { COURSES, buildCourseHole } from '../minigolf/js/courses.js';
import { makeBall, strike, tick, groundNormal, gravSign, TICK, BALL_R, MATS, MAT_NAMES } from '../minigolf/js/physics.js';

const N = Number(process.argv[2] || 40), onlyC = process.argv[3];
let seed = 777; const rng = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

function crossing(mesh, a, b) {
  // vrai si le segment a→b traverse un triangle (le centre passe de l'autre côté d'une surface)
  const list = mesh.query((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2); if (!list) return null;
  const V = mesh.V;
  for (const t of list) {
    const o = t * 9;
    const ux = V[o + 3] - V[o], uy = V[o + 4] - V[o + 1], uz = V[o + 5] - V[o + 2], vx = V[o + 6] - V[o], vy = V[o + 7] - V[o + 1], vz = V[o + 8] - V[o + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const da = (a[0] - V[o]) * nx + (a[1] - V[o + 1]) * ny + (a[2] - V[o + 2]) * nz, db = (b[0] - V[o]) * nx + (b[1] - V[o + 1]) * ny + (b[2] - V[o + 2]) * nz;
    if (da * db >= 0) continue;
    const s = da / (da - db), px = a[0] + (b[0] - a[0]) * s, py = a[1] + (b[1] - a[1]) * s, pz = a[2] + (b[2] - a[2]) * s;
    // dans le triangle ? (coordonnées barycentriques)
    const wx = px - V[o], wy = py - V[o + 1], wz = pz - V[o + 2];
    const uu = ux * ux + uy * uy + uz * uz, vv = vx * vx + vy * vy + vz * vz, uv = ux * vx + uy * vy + uz * vz, wu = wx * ux + wy * uy + wz * uz, wv = wx * vx + wy * vy + wz * vz;
    const den = uv * uv - uu * vv, s1 = (uv * wv - vv * wu) / den, t1 = (uv * wu - uu * wv) / den;
    if (s1 >= 0.02 && t1 >= 0.02 && s1 + t1 <= 0.98) return { tri: t, mat: MAT_NAMES[mesh.M[t]], p: [px, py, pz] };
  }
  return null;
}

let shots = 0, floating = 0, through = 0;
const report = [];
for (const course of COURSES) {
  if (onlyC && course.id !== onlyC) continue;
  for (let i = 0; i < course.holes.length; i++) {
    const h = buildCourseHole(course, i), w = h.world;
    let hf = 0, ht = 0;
    for (let k = 0; k < N; k++) {
      // départ : le tee ou un point de l'allée
      const r = k < N / 3 ? h.tee : h.route[(rng() * h.route.length) | 0];
      const b = makeBall(0, [r[0], r[1] + 0.3, r[2]]); b.awake = true;
      for (let s = 0; s < 400 && b.awake; s++) tick(w, [b], 0, null);
      if (b.oob || !groundNormal(w, b.p)) continue;
      const yaw = rng() * Math.PI * 2, pw = 0.15 + rng() * 0.85;
      strike(w, b, yaw, pw); shots++;
      let t = 5 + rng() * 10, prev = b.p.slice();
      for (let s = 0; s < 30 / TICK; s++) {
        const mv = tick(w, [b], t, null); t += TICK;
        if (!b.oob && !b.holed) {
          const c = crossing(w.mesh, prev, b.p);
          if (c && !(MATS[c.mat].kind === 'floor' && Math.hypot(b.p[0] - w.cup[0], b.p[2] - w.cup[2]) < 0.4)) { through++; ht++; if (report.length < 60) report.push(`TRAVERSE ${course.id} ${i + 1} ${h.name}: ${c.mat} à ${c.p.map((v) => v.toFixed(2))} v=${Math.hypot(...b.v).toFixed(1)}`); break; }
        }
        prev = b.p.slice();
        if (!mv) break;
      }
      if (!b.oob && !b.holed && !b.awake && !b.touch) {
        const n = groundNormal(w, b.p);
        if (!n) { floating++; hf++; if (report.length < 60) report.push(`SUSPENDUE ${course.id} ${i + 1} ${h.name}: ${b.p.map((v) => v.toFixed(2))} g=${gravSign(w, b.p)}`); }
      }
    }
    if (hf || ht) console.log(`${course.id} ${i + 1} ${h.name}: ${hf} suspendue(s), ${ht} traversée(s)`);
  }
}
console.log(report.join('\n'));
console.log(`\n${shots} coups · ${floating} balles suspendues · ${through} traversées`);
