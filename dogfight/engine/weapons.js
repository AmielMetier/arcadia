// Gestionnaire de canon rotatif M61 Vulcan 20 mm pour Dogfight 3D.
// Physique des balles traçantes, surchauffe du canon et calcul du point d'anticipation (Lead).

export const BULLET_SPEED = 780;     // m/s
export const BULLET_LIFETIME = 1.6;  // Portée max ~1200 m
export const FIRE_RATE = 0.04;       // 25 tirs par seconde
export const DAMAGE_PER_BULLET = 7;  // Dégâts par balle
export const HIT_RADIUS = 3.5;       // Rayon d'impact de l'avion cible (m)

export const HEAT_PER_SHOT = 0.035;  // Montée de température par tir
export const COOL_RATE = 0.45;       // Refroidissement par seconde
export const OVERHEAT_LOCK = 2.0;    // Temps de blocage si surchauffe (s)

export class WeaponSystem {
  constructor() {
    this.bullets = [];
    this.heat = 0.0; // 0.0 (froid) à 1.0 (surchauffe)
    this.overheated = false;
    this.overheatTimer = 0;
    this.fireTimer = 0;
  }

  update(fireInput, plane, dt, targets = [], onHit = null) {
    const events = [];

    // 1. Refroidissement du canon
    if (this.overheated) {
      this.overheatTimer -= dt;
      this.heat = Math.max(0, this.overheatTimer / OVERHEAT_LOCK);
      if (this.overheatTimer <= 0) {
        this.overheated = false;
        this.heat = 0;
      }
    } else {
      this.heat = Math.max(0, this.heat - COOL_RATE * dt);
    }

    if (this.fireTimer > 0) {
      this.fireTimer -= dt;
    }

    // 2. Tir
    if (fireInput && !this.overheated && this.fireTimer <= 0 && !plane.crashed) {
      this.fireTimer = FIRE_RATE;
      this.heat += HEAT_PER_SHOT;

      if (this.heat >= 1.0) {
        this.heat = 1.0;
        this.overheated = true;
        this.overheatTimer = OVERHEAT_LOCK;
        events.push({ type: 'overheat', x: plane.x, y: plane.y, z: plane.z });
      }

      // Départ de balle depuis le nez de l'avion (décalage M61 Vulcan)
      const muzzleOffset = 3.2;
      const spread = (Math.random() - 0.5) * 0.008;

      const bullet = {
        x: plane.x + plane.forwardX * muzzleOffset,
        y: plane.y + plane.forwardY * muzzleOffset,
        z: plane.z + plane.forwardZ * muzzleOffset,
        vx: (plane.forwardX + plane.rightX * spread) * (BULLET_SPEED + plane.speed),
        vy: (plane.forwardY + plane.upY * spread) * (BULLET_SPEED + plane.speed),
        vz: (plane.forwardZ + plane.rightZ * spread) * (BULLET_SPEED + plane.speed),
        age: 0,
        ownerId: plane.id,
        expired: false,
      };

      this.bullets.push(bullet);
      events.push({
        type: 'fire',
        x: bullet.x,
        y: bullet.y,
        z: bullet.z,
        ownerId: plane.id,
      });
    }

    // 3. Déplacement des balles et détection d'impact 3D
    for (let i = this.bullets.length - 1; i >= 0; i--) {
      const b = this.bullets[i];
      b.age += dt;

      if (b.age >= BULLET_LIFETIME) {
        this.bullets.splice(i, 1);
        continue;
      }

      // Gravité légère sur les balles
      b.vy -= 9.81 * 0.5 * dt;

      const nextX = b.x + b.vx * dt;
      const nextY = b.y + b.vy * dt;
      const nextZ = b.z + b.vz * dt;

      // Test de collision contre les cibles vivantes
      let hitTarget = null;
      for (const target of targets) {
        if (!target.alive || target.id === b.ownerId) continue;

        // Distance du segment de trajectoire au centre de la cible
        const hit = segmentIntersectsSphere(
          b.x, b.y, b.z,
          nextX, nextY, nextZ,
          target.x, target.y, target.z,
          HIT_RADIUS
        );

        if (hit) {
          hitTarget = target;
          break;
        }
      }

      if (hitTarget) {
        this.bullets.splice(i, 1);
        events.push({
          type: 'hit',
          x: nextX,
          y: nextY,
          z: nextZ,
          targetId: hitTarget.id,
          damage: DAMAGE_PER_BULLET,
        });
        if (onHit) {
          onHit(hitTarget, b.ownerId, DAMAGE_PER_BULLET);
        }
      } else {
        b.x = nextX;
        b.y = nextY;
        b.z = nextZ;
      }
    }

    return events;
  }
}

// Calcule le point d'anticipation (Lead Indicator) pour toucher une cible en mouvement
export function computeLeadPosition(shooterPos, bulletSpeed, targetPos, targetVel) {
  const dx = targetPos.x - shooterPos.x;
  const dy = targetPos.y - shooterPos.y;
  const dz = targetPos.z - shooterPos.z;
  const dist = Math.hypot(dx, dy, dz);

  const timeToTarget = dist / bulletSpeed;

  return {
    x: targetPos.x + targetVel.x * timeToTarget,
    y: targetPos.y + targetVel.y * timeToTarget,
    z: targetPos.z + targetVel.z * timeToTarget,
    dist,
    time: timeToTarget,
  };
}

function segmentIntersectsSphere(x1, y1, z1, x2, y2, z2, cx, cy, cz, radius) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dz = z2 - z1;
  const lenSq = dx * dx + dy * dy + dz * dz;

  if (lenSq === 0) {
    return Math.hypot(cx - x1, cy - y1, cz - z1) <= radius;
  }

  let t = ((cx - x1) * dx + (cy - y1) * dy + (cz - z1) * dz) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const px = x1 + t * dx;
  const py = y1 + t * dy;
  const pz = z1 + t * dz;

  const distSq = (cx - px) ** 2 + (cy - py) ** 2 + (cz - pz) ** 2;
  return distSq <= radius * radius;
}
