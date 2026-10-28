// Déplacement d'un joueur : courir, sprinter, s'accroupir, sauter, nager, monter les escaliers et se cogner aux murs.
// Fonction pure, appelée par la simulation de l'hôte et (plus tard) par la prédiction des invités : même résultat partout.
// Repère du regard : yaw = 0 regarde vers +z ; devant = (sin yaw, cos yaw), droite = (−cos yaw, sin yaw).
import { SLIDE } from './map.js';

export const MOVE = {
  run: 5.6, sprint: 7.8, crouch: 2.7, swim: 3.4, back: 0.8, // vitesses (m/s) ; à reculons on va un peu moins vite
  jump: 7.4, g: 21, step: 0.5,                               // saut ≈ 1,3 m, marche franchie sans sauter
  r: 0.38, h: 1.8, hc: 1.2,                                  // rayon, taille debout, accroupi
  swimDepth: 1.25,                                            // on nage quand les pieds sont à plus de 1,25 m sous la surface
};

// pentes du relief (tangentes) : on ralentit en montant au-delà de `slow`, et au-delà de SLIDE on glisse vers le bas sans
// pouvoir sauter ; les routes et les chemins restent sous `slow` (voir map.js)
export const SLOPE = { slow: 0.45, slide: SLIDE, uphill: 0.35, slip: 5, maxSlip: 11 };

// glissade : en courant vite (au-delà de `min` m/s), s'accroupir lance une glissade. Élan relancé (`boost`, au moins la
// vitesse du sprint), qui se perd peu à peu (`drag`) ; on tourne un peu (`steer`), plus vite en descente ; elle s'arrête
// en se relevant, sous `end` m/s ou au bout de `time` s (pas tant qu'on descend), puis `cd` s avant la suivante
export const GLIDE = { min: 6.5, boost: 1.15, drag: 1.05, steer: 2.2, end: 3.2, time: 1.2, cd: 0.45, downhill: 10 };

export function newPlayer(x, y, z, yaw = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, ground: false, swim: false, crouch: false, sprint: false, air: 0, fall: 0, slideT: 0, slideCd: 0, crouchIn: false };
}

// ------------------------------------------------------------------ en l'air : chute libre puis planeur
export const AIR = { fall: 34, fallH: 15, glideFall: 7.5, glide: 16, deploy: 55 };
// mode 'chute' : on tombe vite et on se dirige ; 'planeur' : on plane (ouvert à `deploy` m du sol, ou plus tôt avec saut)
export function stepAir(p, inp, world, dt) {
  p.yaw = inp.yaw;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -fz, rz = fx;
  const mx = inp.mx || 0, mz = inp.mz || 0;
  const glide = p.mode === 'planeur';
  // en planeur on avance toujours un peu ; en chute libre, on se laisse porter
  const sp = glide ? AIR.glide : AIR.fallH;
  const wx = (rx * mx + fx * Math.max(mz, glide ? 0.35 : mz)) * sp, wz = (rz * mx + fz * Math.max(mz, glide ? 0.35 : mz)) * sp;
  const k = 1 - Math.exp(-2.5 * dt);
  p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
  const target = glide ? -AIR.glideFall : -AIR.fall;
  p.vy += (target - p.vy) * (1 - Math.exp(-(glide ? 3 : 1.2) * dt));
  const [nx, nz] = world.push(p.x + p.vx * dt, p.z + p.vz * dt, MOVE.r, p.y + 0.3, p.y + MOVE.h);
  p.x = nx; p.z = nz;
  const ground = world.support(p.x, p.z, p.y + 0.3);
  // le planeur s'ouvre en redescendant (après un tremplin, on monte d'abord)
  if (!glide && p.vy <= 0 && (p.y - ground < AIR.deploy || inp.jump)) { p.mode = 'planeur'; p.vy = Math.max(p.vy, -12); }
  p.y += p.vy * dt;
  const wl = world.waterLevel(p.x, p.z);
  if (p.y <= ground || p.y <= wl - MOVE.swimDepth) {
    // atterrissage (sans dégâts de chute)
    p.y = Math.max(ground, Math.min(p.y, wl - MOVE.swimDepth)); p.vy = 0; p.mode = 'sol'; p.ground = p.y <= ground + 0.01; p.fall = 0;
    return true;
  }
  return false;
}

// inp : { mx, mz (−1 → 1, droite / devant), yaw, jump, sprint, crouch, glisse (la glissade est permise ; pas aux bots) } ;
// dt en secondes (pas fixe conseillé : 1/60)
export function stepPlayer(p, inp, world, dt) {
  const wl = world.waterLevel(p.x, p.z);
  p.swim = wl - p.y > MOVE.swimDepth;
  p.yaw = inp.yaw;
  const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -fz, rz = fx;
  let mx = inp.mx || 0, mz = inp.mz || 0;
  const ml = Math.hypot(mx, mz);
  if (ml > 1) { mx /= ml; mz /= ml; }
  // s'accroupir : pas dans l'eau ; on ne se relève que s'il y a la place
  const wantCrouch = !!inp.crouch && !p.swim;
  const press = wantCrouch && !p.crouchIn;
  p.crouchIn = wantCrouch;
  const room = !(world.ceiling(p.x, p.z, p.y + MOVE.hc - 0.05) < p.y + MOVE.h);
  if (!wantCrouch && p.crouch && !room) p.crouch = true;
  else p.crouch = wantCrouch;
  // glissade : lancée en s'accroupissant à pleine course, au sol
  p.slideCd = Math.max(0, (p.slideCd || 0) - dt);
  const hs = Math.hypot(p.vx, p.vz);
  if (press && inp.glisse && p.ground && !p.swim && !p.slideT && p.slideCd <= 0 && hs >= GLIDE.min) {
    const k = Math.max(hs, MOVE.sprint) * GLIDE.boost / hs;
    p.vx *= k; p.vz *= k; p.slideT = GLIDE.time;
  }
  if (p.slideT > 0 && (p.swim || (!wantCrouch && room))) { p.slideT = 0; p.slideCd = GLIDE.cd; }
  if (p.slideT > 0) p.crouch = true;
  p.sprint = !!inp.sprint && mz > 0.3 && !p.crouch && !p.swim;
  let speed = p.swim ? MOVE.swim : p.crouch ? MOVE.crouch : p.sprint ? MOVE.sprint : MOVE.run;
  if (mz < -0.1) speed *= MOVE.back;
  // ralenti en visant ou en se soignant (k : 0 → 1)
  if (inp.k != null) speed *= inp.k;
  let wx = (rx * mx + fx * mz) * speed, wz = (rz * mx + fz * mz) * speed;
  // pente du terrain sous les pieds : on monte de moins en moins vite, puis on glisse
  const sl = p.ground && !p.swim && world.slope ? world.slope(p.x, p.z, p.y) : null;
  const g = sl ? Math.hypot(sl[0], sl[1]) : 0, steep = g > SLOPE.slide;
  p.slide = steep;
  if (g > SLOPE.slow) {
    const ux = sl[0] / g, uz = sl[1] / g, up = wx * ux + wz * uz;
    if (up > 0) {
      const f = steep ? 1 : (g - SLOPE.slow) / (SLOPE.slide - SLOPE.slow) * (1 - SLOPE.uphill);
      wx -= ux * up * f; wz -= uz * up * f;
    }
    if (steep) { const v = Math.min(SLOPE.maxSlip, SLOPE.slip + (g - SLOPE.slide) * 12); wx -= ux * v; wz -= uz * v; }
  }
  if (p.slideT > 0 && p.ground) {
    // en glissade : l'élan se perd peu à peu, la pente l'entretient en descente, on tourne un peu vers où l'on pousse
    p.slideT -= dt;
    const d = Math.exp(-GLIDE.drag * dt);
    p.vx *= d; p.vz *= d;
    if (sl) { p.vx -= sl[0] * GLIDE.downhill * dt; p.vz -= sl[1] * GLIDE.downhill * dt; if (p.vx * sl[0] + p.vz * sl[1] < -0.5) p.slideT = Math.max(p.slideT, 0.15); }
    const sp = Math.hypot(p.vx, p.vz), wl2 = Math.hypot(wx, wz);
    if (wl2 > 0.1 && sp > 0.1) {
      const t = 1 - Math.exp(-GLIDE.steer * dt);
      const nx = p.vx / sp + (wx / wl2 - p.vx / sp) * t, nz = p.vz / sp + (wz / wl2 - p.vz / sp) * t, nl = Math.hypot(nx, nz) || 1;
      p.vx = nx / nl * sp; p.vz = nz / nl * sp;
    }
    if (sp < GLIDE.end || p.slideT <= 0) { p.slideT = 0; p.slideCd = GLIDE.cd; }
  } else {
    // en l'air, une glissade s'arrête (on garde son élan, comme en sautant)
    if (p.slideT > 0) { p.slideT = 0; p.slideCd = GLIDE.cd; }
    // au sol (et dans l'eau) on obéit vite ; en l'air on garde son élan ; en glissade on a peu de prise
    const k = 1 - Math.exp(-(steep ? 4 : p.ground || p.swim ? 14 : 2.2) * dt);
    p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;
  }

  if (p.swim) {
    // on flotte : la tête hors de l'eau ; saut = remonter vite (pour sortir sur un quai)
    const target = wl - MOVE.swimDepth - 0.05;
    p.vy += ((target - p.y) * 4 - p.vy) * Math.min(1, dt * 6);
    if (inp.jump) p.vy = Math.max(p.vy, 4.5);
  } else {
    p.vy -= MOVE.g * dt;
    if (inp.jump && p.ground && !steep) { p.vy = MOVE.jump; p.ground = false; }
  }

  // horizontal : on avance puis on sort des murs (au-dessus de la marche franchissable)
  const height = p.crouch ? MOVE.hc : MOVE.h;
  const [nx, nz] = world.push(p.x + p.vx * dt, p.z + p.vz * dt, MOVE.r, p.y + MOVE.step, p.y + height);
  // vitesse réelle (on glisse le long des murs au lieu de rester collé) ; être repoussé hors d'un obstacle
  // ne donne jamais plus de vitesse qu'on n'en avait
  if (dt > 0) {
    const sp = Math.hypot(p.vx, p.vz);
    let ux = (nx - p.x) / dt, uz = (nz - p.z) / dt;
    const us = Math.hypot(ux, uz);
    if (us > sp) { const k = us > 1e-6 ? sp / us : 0; ux *= k; uz *= k; }
    p.vx = ux; p.vz = uz;
  }
  p.x = nx; p.z = nz;

  // vertical : plafond, puis sol (marches, escaliers, toits)
  let ny = p.y + p.vy * dt;
  if (p.vy > 0) {
    const c = world.ceiling(p.x, p.z, p.y + height - 0.05);
    if (ny + height > c) { ny = c - height; p.vy = 0; }
  }
  const sup = world.support(p.x, p.z, Math.max(p.y, ny) + (p.ground ? MOVE.step : 0.08));
  const wasGround = p.ground;
  if (ny <= sup) {
    if (!wasGround && !p.swim) p.fall = Math.max(p.fall, -p.vy);
    ny = sup; p.vy = 0; p.ground = true;
  } else if (wasGround && p.vy <= 0 && ny - sup < MOVE.step + (steep ? Math.hypot(p.vx, p.vz) * dt * 3 : 0) && !p.swim) {
    // on reste collé au sol en descendant une pente ou un escalier (et en glissade, jusqu'au bord d'une vraie falaise)
    ny = sup; p.vy = 0; p.ground = true;
  } else p.ground = false;
  if (p.swim) p.ground = false;
  p.y = ny;
  p.air = p.ground || p.swim ? 0 : p.air + dt;
  return p;
}
