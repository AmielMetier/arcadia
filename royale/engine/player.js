// Déplacement d'un joueur : courir, sprinter, s'accroupir, sauter, nager, monter les escaliers et se cogner aux murs.
// Fonction pure, appelée par la simulation de l'hôte et (plus tard) par la prédiction des invités : même résultat partout.
// Repère du regard : yaw = 0 regarde vers +z ; devant = (sin yaw, cos yaw), droite = (−cos yaw, sin yaw).

export const MOVE = {
  run: 5.6, sprint: 7.8, crouch: 2.7, swim: 3.4, back: 0.8, // vitesses (m/s) ; à reculons on va un peu moins vite
  jump: 7.4, g: 21, step: 0.5,                               // saut ≈ 1,3 m, marche franchie sans sauter
  r: 0.38, h: 1.8, hc: 1.2,                                  // rayon, taille debout, accroupi
  swimDepth: 1.25,                                            // on nage quand les pieds sont à plus de 1,25 m sous la surface
};

export function newPlayer(x, y, z, yaw = 0) {
  return { x, y, z, vx: 0, vy: 0, vz: 0, yaw, ground: false, swim: false, crouch: false, sprint: false, air: 0, fall: 0 };
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

// inp : { mx, mz (−1 → 1, droite / devant), yaw, jump, sprint, crouch } ; dt en secondes (pas fixe conseillé : 1/60)
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
  if (!wantCrouch && p.crouch && world.ceiling(p.x, p.z, p.y + MOVE.hc - 0.05) < p.y + MOVE.h) p.crouch = true;
  else p.crouch = wantCrouch;
  p.sprint = !!inp.sprint && mz > 0.3 && !p.crouch && !p.swim;
  let speed = p.swim ? MOVE.swim : p.crouch ? MOVE.crouch : p.sprint ? MOVE.sprint : MOVE.run;
  if (mz < -0.1) speed *= MOVE.back;
  // ralenti en visant ou en se soignant (k : 0 → 1)
  if (inp.k != null) speed *= inp.k;
  const wx = (rx * mx + fx * mz) * speed, wz = (rz * mx + fz * mz) * speed;
  // au sol (et dans l'eau) on obéit vite ; en l'air on garde son élan
  const k = 1 - Math.exp(-(p.ground || p.swim ? 14 : 2.2) * dt);
  p.vx += (wx - p.vx) * k; p.vz += (wz - p.vz) * k;

  if (p.swim) {
    // on flotte : la tête hors de l'eau ; saut = remonter vite (pour sortir sur un quai)
    const target = wl - MOVE.swimDepth - 0.05;
    p.vy += ((target - p.y) * 4 - p.vy) * Math.min(1, dt * 6);
    if (inp.jump) p.vy = Math.max(p.vy, 4.5);
  } else {
    p.vy -= MOVE.g * dt;
    if (inp.jump && p.ground) { p.vy = MOVE.jump; p.ground = false; }
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
  } else if (wasGround && p.vy <= 0 && ny - sup < MOVE.step && !p.swim) {
    // on reste collé au sol en descendant une pente ou un escalier
    ny = sup; p.vy = 0; p.ground = true;
  } else p.ground = false;
  if (p.swim) p.ground = false;
  p.y = ny;
  p.air = p.ground || p.swim ? 0 : p.air + dt;
  return p;
}
