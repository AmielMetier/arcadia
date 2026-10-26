// Birdie Party — vol et roulement de la balle. Moteur pur : simulate() rejoue un coup du début à la fin
// et renvoie la trajectoire échantillonnée à 60 Hz, que la vue anime ensuite. Pas de temps fixe (1/120 s)
// et aucune source d'aléa hors de la graine du coup : le même coup donne la même trajectoire partout.
//
// Vol : gravité, traînée sur la vitesse par rapport à l'air (le vent pousse plus une balle qui reste longtemps en l'air),
// portance due à l'effet rétro (qui s'use), effet latéral (hook / slice). Au sol : rebonds selon la surface,
// puis roulement freiné et entraîné par la pente. Les vitesses de départ sont étalonnées sur terrain plat
// pour que chaque club vole exactement à la distance affichée.
import { CLUBS, TRAJ, PUTTER, lieFactor, LIE } from './clubs.js';
import { makeRng } from './rng.js';

export const DT = 1 / 120;
export const GRAV = 9.81;
export const BALL_R = 0.021;
export const CUP_R = 0.1;     // trou un peu plus large que le vrai (0,054 m) : plus jouable, comme sur Wii
const DRAG = 0.0042;          // traînée (1/m)
const SIDE = 0.055;           // force de l'effet latéral
const SPIN_LIFE = 5.5;        // s : l'effet s'use pendant le vol
const MAX_T = 45;             // s : sécurité

// e : restitution (rebond), f : ce que garde la vitesse au sol à l'impact, roll : frottement de roulement
export const SURF = {
  tee: { e: 0.3, f: 0.55, roll: 0.12 },
  fairway: { e: 0.3, f: 0.55, roll: 0.12 },
  fringe: { e: 0.26, f: 0.55, roll: 0.09 },
  green: { e: 0.22, f: 0.6, roll: 0.065 },
  rough: { e: 0.15, f: 0.35, roll: 0.38 },
  bunker: { e: 0.03, f: 0.12, roll: 1.4 },
  beach: { e: 0.03, f: 0.12, roll: 1.4 },
  ob: { e: 0.15, f: 0.35, roll: 0.38 },
  water: { e: 0, f: 0, roll: 9 },
};

// ------------------------------------------------------------------ vol sur terrain plat (étalonnage)
function flatCarry(club, loftDeg, speed) {
  const a = loftDeg * Math.PI / 180;
  let vx = 0, vy = Math.sin(a) * speed, vz = Math.cos(a) * speed, y = 0, z = 0, t = 0, apex = 0;
  const kL = CLUBS[club].lift;
  while (t < MAX_T) {
    const sp = Math.exp(-t / SPIN_LIFE), v = Math.hypot(vy, vz);
    const ax = 0, ay = -GRAV - DRAG * v * vy + kL * sp * v * vz, az = -DRAG * v * vz - kL * sp * v * vy;
    vx += ax * DT; vy += ay * DT; vz += az * DT; y += vy * DT; z += vz * DT; t += DT;
    if (y > apex) apex = y;
    if (y <= 0 && vy < 0) break;
  }
  return { carry: z, apex, time: t };
}
const tables = new Map();
function table(club, traj) {
  const key = club + traj;
  if (tables.has(key)) return tables.get(key);
  const loft = CLUBS[club].loft + TRAJ[traj].dLoft, rows = [];
  for (let s = 3; s <= 110; s += 1.5) rows.push([s, flatCarry(club, loft, s).carry]);
  tables.set(key, rows);
  return rows;
}
// vitesse de départ qui fait voler la balle à `carry` mètres sur terrain plat
export function speedForCarry(club, traj, carry) {
  const rows = table(club, traj);
  if (carry <= rows[0][1]) return rows[0][0] * Math.sqrt(Math.max(0, carry) / rows[0][1]);
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1] >= carry) { const [s0, c0] = rows[i - 1], [s1, c1] = rows[i]; return s0 + (s1 - s0) * (carry - c0) / (c1 - c0); }
  }
  return rows[rows.length - 1][0];
}
export { flatCarry };

// ------------------------------------------------------------------ un coup
// shot = { club, traj, aim (cap en radians, 0 = +z), power (0 → ~1,1), curve (-1 hook → +1 slice), seed }
// ball = { x, y, z, lie }, wind = { x, z }, putt = portée du putter (m)
export function simulate(hole, ball, shot, wind, { putt = 20, noWind = false, stopAtLanding = false } = {}) {
  const club = CLUBS[shot.club], isPutt = shot.club === PUTTER;
  const rng = makeRng(shot.seed || 1);
  const lie = ball.lie || 'fairway';
  // précision dégradée hors du fairway (déterministe : tirée de la graine du coup)
  const spread = (LIE[lie]?.spread || 0) * (isPutt ? 0 : 1);
  const curve = Math.max(-1.6, Math.min(1.6, (shot.curve || 0) + (spread ? rng.range(-spread, spread) : 0)));
  const aim = shot.aim + (spread ? rng.range(-spread, spread) * 0.05 : 0);
  const dx = Math.sin(aim), dz = Math.cos(aim);
  const wx = noWind ? 0 : (wind?.x || 0), wz = noWind ? 0 : (wind?.z || 0);
  const pin = hole.pin;

  let x = ball.x, z = ball.z, y = ball.y ?? hole.heightAt(x, z) + BALL_R;
  let vx, vy, vz, mode;
  if (isPutt) {
    // putt : la balle part en roulant ; la portée correspond à un putt sur green plat
    const d = putt * Math.max(0, shot.power);
    const v0 = Math.sqrt(2 * SURF.green.roll * GRAV * d);
    vx = dx * v0; vz = dz * v0; vy = 0; mode = 'roll';
  } else {
    const traj = shot.traj || 'mid';
    const p = Math.max(0, shot.power);
    const carry = club.dist * club.carry * TRAJ[traj].dist * lieFactor(lie, shot.club) * p;
    const v0 = speedForCarry(shot.club, traj, carry);
    const a = (club.loft + TRAJ[traj].dLoft) * Math.PI / 180;
    vx = dx * Math.cos(a) * v0; vz = dz * Math.cos(a) * v0; vy = Math.sin(a) * v0; mode = 'fly';
  }

  const path = [x, y, z];
  const ev = [];
  let t = 0, step = 0, landed = false, bounces = 0, inTree = null, end = null;
  let carryPt = null, lastDry = { x, z }, maxH = y;
  const kL = club.lift || 0;

  const finish = (kind, extra = {}) => { end = { kind, x, y, z, ...extra }; };

  while (!end && t < MAX_T) {
    t += DT; step++;
    if (mode === 'fly') {
      const sp = Math.exp(-t / SPIN_LIFE);
      const ground = hole.heightAt(x, z);
      const hw = Math.min(1, 0.55 + Math.max(0, y - ground) / 30); // le vent forcit avec la hauteur
      const rx = vx - wx * hw, rz = vz - wz * hw, ry = vy;
      const v = Math.hypot(rx, ry, rz), vh = Math.hypot(rx, rz) || 1e-6;
      // portance : perpendiculaire à la vitesse, dans le plan vertical
      const L = kL * sp * v;
      const lx = (-ry * rx / vh), ly = vh, lz = (-ry * rz / vh);
      // effet latéral : vers la droite de la trajectoire (slice) ou la gauche (hook)
      const S = SIDE * curve * sp * v;
      const sx = -rz / vh, sz = rx / vh; // droite de la trajectoire
      vx += (-DRAG * v * rx + L * lx + S * sx) * DT;
      vy += (-GRAV - DRAG * v * ry + L * ly) * DT;
      vz += (-DRAG * v * rz + L * lz + S * sz) * DT;
      x += vx * DT; y += vy * DT; z += vz * DT;
      if (y > maxH) maxH = y;

      // arbres : le feuillage freine et fait tomber la balle, le tronc la renvoie
      for (const tr of hole.treesNear(x, z)) {
        const cy = tr.y + tr.h, ddx = x - tr.x, ddz = z - tr.z, dh = Math.hypot(ddx, ddz);
        const inLeaves = (ddx * ddx + ddz * ddz) / (tr.r * tr.r) + ((y - cy) / tr.ry) ** 2 < 1;
        if (inLeaves) {
          if (inTree !== tr) {
            inTree = tr;
            const turn = rng.range(-1.2, 1.2), c = Math.cos(turn), s = Math.sin(turn);
            const nvx = (vx * c - vz * s) * 0.22, nvz = (vx * s + vz * c) * 0.22;
            vx = nvx; vz = nvz; vy = Math.min(vy, 0) * 0.3;
            ev.push({ i: path.length / 3, type: 'tree' });
          }
        } else if (inTree === tr) inTree = null;
        const trunkR = 0.35 * tr.s;
        if (dh < trunkR + BALL_R && y < cy) {
          const nx = ddx / (dh || 1), nz = ddz / (dh || 1), vn = vx * nx + vz * nz;
          if (vn < 0) { vx -= 1.5 * vn * nx; vz -= 1.5 * vn * nz; vx *= 0.6; vz *= 0.6; ev.push({ i: path.length / 3, type: 'trunk' }); }
          x = tr.x + nx * (trunkR + BALL_R); z = tr.z + nz * (trunkR + BALL_R);
        }
      }

      const h = hole.heightAt(x, z);
      // la balle tombe directement dans le trou
      if (Math.hypot(x - pin.x, z - pin.z) < CUP_R && y - h < 0.12 && vy < 0 && Math.hypot(vx, vy, vz) < 7) {
        x = pin.x; z = pin.z; y = h - 0.05; finish('holed'); ev.push({ i: path.length / 3, type: 'cup' }); break;
      }
      if (y <= h + BALL_R) {
        const surf = hole.surfaceAt(x, z);
        if (!carryPt) carryPt = { x, z, surf };
        if (stopAtLanding) { y = h + BALL_R; finish('landing', { surf }); break; }
        if (surf === 'water') { y = h; finish('water', { drop: dropFrom(hole, lastDry, x, z) }); ev.push({ i: path.length / 3, type: 'splash' }); break; }
        const [gx, gz] = hole.slopeAt(x, z);
        const nl = Math.hypot(gx, 1, gz), nx = -gx / nl, ny = 1 / nl, nz = -gz / nl;
        const vn = vx * nx + vy * ny + vz * nz;
        if (vn < 0) {
          const S2 = SURF[surf] || SURF.rough;
          let f = S2.f;
          if (!landed && club.bite && (surf === 'green' || surf === 'fringe' || surf === 'fairway')) f *= 1 - club.bite * Math.exp(-t / SPIN_LIFE);
          landed = true; bounces++;
          const tx = vx - vn * nx, ty = vy - vn * ny, tz = vz - vn * nz;
          const out = -vn * S2.e;
          vx = tx * f + nx * out; vy = ty * f + ny * out; vz = tz * f + nz * out;
          ev.push({ i: path.length / 3, type: 'bounce', surf, v: -vn });
          if (out < 1.1 || surf === 'bunker' || surf === 'beach') { mode = 'roll'; ev.push({ i: path.length / 3, type: 'roll', surf }); }
        }
        y = h + BALL_R;
      }
    } else {
      // roulement : frottement de la surface + gravité le long de la pente
      const surf = hole.surfaceAt(x, z);
      if (surf === 'water') { finish('water', { drop: dropFrom(hole, lastDry, x, z) }); ev.push({ i: path.length / 3, type: 'splash' }); break; }
      if (surf !== 'ob') lastDry = { x, z };
      const S2 = SURF[surf] || SURF.rough;
      const [gx, gz] = hole.slopeAt(x, z);
      const k = 1 / (1 + gx * gx + gz * gz);
      const ax = -GRAV * gx * k, az = -GRAV * gz * k;
      const v = Math.hypot(vx, vz), fr = S2.roll * GRAV;
      if (v < fr * DT * 1.5) {
        // à l'arrêt : la balle repart seulement si la pente l'emporte sur le frottement
        if (Math.hypot(ax, az) <= fr * 1.25) { vx = vz = 0; finish(surf === 'ob' ? 'ob' : 'rest'); break; }
        vx += ax * DT; vz += az * DT;
      } else {
        vx += (ax - fr * vx / v) * DT; vz += (az - fr * vz / v) * DT;
      }
      x += vx * DT; z += vz * DT;
      const ny0 = y;
      y = hole.heightAt(x, z) + BALL_R; vy = (y - ny0) / DT;
      // le trou : capturée si elle passe assez lentement, sinon elle lèche le bord
      const dp = Math.hypot(x - pin.x, z - pin.z), vv = Math.hypot(vx, vz);
      if (dp < CUP_R) {
        if (vv < 1.6) { x = pin.x; z = pin.z; y -= 0.06; finish('holed'); ev.push({ i: path.length / 3, type: 'cup' }); }
        else if (vv < 2.4) {
          const side = ((x - pin.x) * vz - (z - pin.z) * vx) > 0 ? 1 : -1, a2 = side * 0.7, c = Math.cos(a2), s = Math.sin(a2);
          const nvx = (vx * c - vz * s) * 0.55, nvz = (vx * s + vz * c) * 0.55; vx = nvx; vz = nvz;
          x = pin.x + (x - pin.x) * (CUP_R + 0.01) / dp; z = pin.z + (z - pin.z) * (CUP_R + 0.01) / dp;
          ev.push({ i: path.length / 3, type: 'lip' });
        }
      }
      // troncs
      for (const tr of hole.treesNear(x, z)) {
        const ddx = x - tr.x, ddz = z - tr.z, dh = Math.hypot(ddx, ddz), trunkR = 0.35 * tr.s;
        if (dh < trunkR + BALL_R) {
          const nx = ddx / (dh || 1), nz = ddz / (dh || 1), vn = vx * nx + vz * nz;
          if (vn < 0) { vx -= 1.6 * vn * nx; vz -= 1.6 * vn * nz; }
          x = tr.x + nx * (trunkR + BALL_R); z = tr.z + nz * (trunkR + BALL_R);
        }
      }
    }
    // dernier point survolé ou parcouru au-dessus de la terre ferme : sert à replacer la balle après l'eau
    if (mode === 'fly') { const s = hole.surfaceAt(x, z); if (s !== 'water' && s !== 'ob') lastDry = { x, z }; }
    if (step % 2 === 0) path.push(x, y, z);
  }
  if (!end) finish('rest');
  if (path[path.length - 1] !== z || path[path.length - 3] !== x) path.push(x, y, z);

  let kind = end.kind;
  const surf = kind === 'holed' ? 'green' : kind === 'water' ? 'water' : hole.surfaceAt(x, z);
  if (kind === 'rest' && surf === 'ob') kind = 'ob';
  return {
    path: new Float32Array(path), n: path.length / 3, events: ev, kind, surf,
    end: { x, y, z }, drop: end.drop || null, carry: carryPt, maxH,
    dist: Math.hypot(x - ball.x, z - ball.z), curve,
  };
}

// point de reprise après l'eau : dernier endroit sec survolé, reculé vers le départ et hors de l'eau
function dropFrom(hole, lastDry, x, z) {
  let px = lastDry?.x ?? x, pz = lastDry?.z ?? z;
  const bx = px - x, bz = pz - z, L = Math.hypot(bx, bz) || 1;
  for (let k = 0; k < 40; k++) {
    const s = hole.surfaceAt(px, pz);
    if (s !== 'water' && s !== 'ob' && s !== 'bunker' && s !== 'beach') break;
    px += (bx / L) * 1.5; pz += (bz / L) * 1.5;
  }
  // un peu en retrait de la rive
  px += (bx / L) * 2; pz += (bz / L) * 2;
  return { x: px, z: pz };
}

// Point d'arrivée d'un coup plein, sans vent ni effet : la cible affichée pendant la visée
export function previewLanding(hole, ball, club, traj, aim, putt, power = 1) {
  // au putter : la portée en ligne droite (la pente, c'est au joueur de la lire)
  if (club === PUTTER) { const x = ball.x + Math.sin(aim) * putt * power, z = ball.z + Math.cos(aim) * putt * power; return { x, z, y: hole.heightAt(x, z) }; }
  const r = simulate(hole, ball, { club, traj, aim, power, curve: 0, seed: 1 }, null, { putt, noWind: true, stopAtLanding: true });
  return { x: r.end.x, z: r.end.z, y: r.end.y };
}
