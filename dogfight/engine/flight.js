// Modèle de vol arcade pour les chasseurs F-16 dans Dogfight 3D.
// Accessible, nerveux et réactif : tangage, roulis, lacet, postcombustion et aérofrein.

export const MIN_SPEED = 65;      // Vitesse minimale (aérofrein)
export const CRUISE_SPEED = 125;  // Vitesse normale de croisière
export const BOOST_SPEED = 210;   // Vitesse avec postcombustion (Afterburner)
export const ACCEL = 90;          // Accélération (m/s²)
export const DECEL = 70;          // Décélération (m/s²)

export const PITCH_SPEED = 1.85;  // Vitesse de tangage (rad/s)
export const ROLL_SPEED = 3.4;    // Vitesse de roulis (rad/s)
export const YAW_SPEED = 0.95;    // Vitesse de lacet (rad/s)

export class FlightModel {
  constructor({
    x = 0,
    y = 150,
    z = 0,
    heading = 0, // orientation initiale sur le plan XZ (rad)
  } = {}) {
    this.x = x;
    this.y = y;
    this.z = z;

    this.vx = Math.sin(heading) * CRUISE_SPEED;
    this.vy = 0;
    this.vz = Math.cos(heading) * CRUISE_SPEED;

    this.speed = CRUISE_SPEED;
    this.targetSpeed = CRUISE_SPEED;

    // Angles d'Euler
    this.pitch = 0; // -PI/2 (plongée) à +PI/2 (montée)
    this.yaw = heading; // rotation autour de l'axe Y
    this.roll = 0; // inclinaison des ailes

    // Vecteur avant unitaire (Forward)
    this.forwardX = Math.sin(heading);
    this.forwardY = 0;
    this.forwardZ = Math.cos(heading);

    // Vecteur haut unitaire (Up)
    this.upX = 0;
    this.upY = 1;
    this.upZ = 0;

    // Vecteur droite unitaire (Right)
    this.rightX = Math.cos(heading);
    this.rightY = 0;
    this.rightZ = -Math.sin(heading);

    this.boosting = false;
    this.braking = false;
    this.gForce = 1.0;
    this.overG = false;
    this.crashed = false;
  }

  // Met à jour la position et l'orientation en fonction des commandes
  update(input, dt, map = null) {
    if (this.crashed) return;

    // 1. Accélération & vitesse cible
    if (input.boost) {
      this.targetSpeed = BOOST_SPEED;
      this.boosting = true;
      this.braking = false;
    } else if (input.brake) {
      this.targetSpeed = MIN_SPEED;
      this.braking = true;
      this.boosting = false;
    } else {
      this.targetSpeed = CRUISE_SPEED;
      this.boosting = false;
      this.braking = false;
    }

    if (this.speed < this.targetSpeed) {
      this.speed = Math.min(this.targetSpeed, this.speed + ACCEL * dt);
    } else if (this.speed > this.targetSpeed) {
      this.speed = Math.max(this.targetSpeed, this.speed - DECEL * dt);
    }

    // 2. Gestion de la visée souris (Mouse Aim) ou commandes directes
    if (input.mouseAim) {
      this.applyMouseAim(input.aimX, input.aimY, dt);
    } else {
      // Commandes manuelles (tangage, roulis, lacet)
      if (input.pitchUp) this.pitch += PITCH_SPEED * dt;
      if (input.pitchDown) this.pitch -= PITCH_SPEED * dt;

      if (input.rollLeft) this.roll -= ROLL_SPEED * dt;
      if (input.rollRight) this.roll += ROLL_SPEED * dt;

      if (input.yawLeft) this.yaw += YAW_SPEED * dt;
      if (input.yawRight) this.yaw -= YAW_SPEED * dt;

      // Auto-stabilisation douce du roulis quand aucune touche de roulis n'est pressée
      if (!input.rollLeft && !input.rollRight && Math.abs(this.roll) > 0.01) {
        this.roll -= Math.sign(this.roll) * Math.min(Math.abs(this.roll), 1.2 * dt);
      }
    }

    // Limiter le tangage pour éviter la singularité
    const maxPitch = Math.PI * 0.48;
    this.pitch = Math.max(-maxPitch, Math.min(maxPitch, this.pitch));

    // Normalisation des angles
    this.yaw = normalizeAngle(this.yaw);
    this.roll = normalizeAngle(this.roll);

    // 3. Calcul des vecteurs directionnels à partir des angles
    this.computeVectors();

    // 4. Déplacement le long du vecteur avant
    this.vx = this.forwardX * this.speed;
    this.vy = this.forwardY * this.speed;
    this.vz = this.forwardZ * this.speed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.z += this.vz * dt;

    // 5. Calcul des G subis (accélération angulaire)
    const angularSpeed = Math.hypot(
      (input.pitchUp || input.pitchDown ? PITCH_SPEED : 0),
      (input.rollLeft || input.rollRight ? ROLL_SPEED * 0.5 : 0)
    );
    this.gForce = 1.0 + (angularSpeed * this.speed) / 50;
    this.overG = this.gForce > 3.8;

    // 6. Détection de crash contre le sol ou la mer
    if (map) {
      const groundH = Math.max(0, map.heightAt(this.x, this.z));
      if (this.y <= groundH + 3.0) {
        this.crashed = true;
        this.y = groundH;
      }
    } else {
      if (this.y <= 0) {
        this.crashed = true;
        this.y = 0;
      }
    }

    // Plafond d'altitude max
    if (this.y > 650) {
      this.y = 650;
      this.vy = Math.min(0, this.vy);
    }
  }

  // Visée intuitive à la souris : aligne l'avion vers le curseur et incline les ailes dans le virage
  applyMouseAim(aimDeltaX, aimDeltaY, dt) {
    // aimDeltaX et aimDeltaY sont normalisés entre -1 et 1
    const targetPitch = -aimDeltaY * (Math.PI * 0.42);
    const targetYawRate = aimDeltaX * 1.5;

    // Tangage vers la cible
    const pitchDiff = targetPitch - this.pitch;
    this.pitch += Math.sign(pitchDiff) * Math.min(Math.abs(pitchDiff), PITCH_SPEED * dt);

    // Lacet
    this.yaw += targetYawRate * dt;

    // Inclinaison automatique des ailes (bank) dans le sens du virage
    const targetRoll = aimDeltaX * (Math.PI * 0.55);
    const rollDiff = targetRoll - this.roll;
    this.roll += Math.sign(rollDiff) * Math.min(Math.abs(rollDiff), ROLL_SPEED * dt);
  }

  computeVectors() {
    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const cy = Math.cos(this.yaw);
    const sy = Math.sin(this.yaw);
    const cr = Math.cos(this.roll);
    const sr = Math.sin(this.roll);

    // Forward vector
    this.forwardX = cp * sy;
    this.forwardY = sp;
    this.forwardZ = cp * cy;

    // Right vector (avec roulis)
    this.rightX = cy * cr + sy * sp * sr;
    this.rightY = -cp * sr;
    this.rightZ = -sy * cr + cy * sp * sr;

    // Up vector = Forward x Right
    this.upX = this.forwardY * this.rightZ - this.forwardZ * this.rightY;
    this.upY = this.forwardZ * this.rightX - this.forwardX * this.rightZ;
    this.upZ = this.forwardX * this.rightY - this.forwardY * this.rightX;
  }
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
