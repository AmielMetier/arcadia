// Intelligence Artificielle de combat aérien (Dogfight AI) pour les F-16 bots.
// Poursuite en courbe de chasse, anticipation de tir (Lead), évitement de relief et tonneaux d'esquive.
import { computeLeadPosition, BULLET_SPEED } from './weapons.js';

// Niveaux des bots : précision de visée, portée de tir, temps de réaction, esquives
export const BOT_LEVELS = {
  facile: { aimDot: 0.975, fireRange: 320, aimNoise: 0.2, react: 0.6, evade: 0, boostDist: 650, burst: 0.3 },
  normal: { aimDot: 0.96, fireRange: 420, aimNoise: 0.09, react: 0.3, evade: 0.35, boostDist: 480, burst: 0.55 },
  expert: { aimDot: 0.945, fireRange: 520, aimNoise: 0.02, react: 0.1, evade: 0.85, boostDist: 380, burst: 0.9 },
};

export function computeBotFlightInput(bot, allPlanes, map, dt) {
  const input = {
    pitchUp: false,
    pitchDown: false,
    rollLeft: false,
    rollRight: false,
    yawLeft: false,
    yawRight: false,
    boost: false,
    brake: false,
    fire: false,
    mouseAim: false,
  };

  if (!bot.alive || bot.crashed) return input;
  const L = BOT_LEVELS[bot.botLevel] || BOT_LEVELS.normal;
  const mem = bot.ai || (bot.ai = { aimT: 0, ox: 0, oy: 0, oz: 0, evadeT: 0, evadeDir: 1, lastHealth: bot.health, burstT: 0 });

  // 1. SÉCURITÉ ABSOLUE : Évitement du relief et de la mer
  const groundH = map ? Math.max(0, map.heightAt(bot.x, bot.z)) : 0;
  const altitude = bot.y - groundH;

  // Regarder devant pour anticiper une colline ou montagne
  const lookAheadX = bot.x + bot.forwardX * 120;
  const lookAheadZ = bot.z + bot.forwardZ * 120;
  const lookAheadH = map ? Math.max(0, map.heightAt(lookAheadX, lookAheadZ)) : 0;

  if (altitude < 50 || bot.y < lookAheadH + 50 || (altitude < 90 && bot.forwardY < -0.15)) {
    // Urgence : Cabrer à fond et enclencher la postcombustion pour remonter
    input.pitchUp = true;
    input.boost = true;
    // Remettre les ailes à plat
    if (bot.roll > 0.15) input.rollLeft = true;
    else if (bot.roll < -0.15) input.rollRight = true;
    return input;
  }

  // 1b. Esquive : touché, le bot part en tonneau serré quelques instants (selon son niveau)
  if (bot.health < mem.lastHealth && Math.random() < L.evade) {
    mem.evadeT = 0.9 + Math.random() * 0.8;
    mem.evadeDir = Math.random() < 0.5 ? -1 : 1;
  }
  mem.lastHealth = bot.health;
  if (mem.evadeT > 0) {
    mem.evadeT -= dt;
    input.pitchUp = true;
    input.boost = true;
    if (mem.evadeDir > 0) input.rollRight = true;
    else input.rollLeft = true;
    return input;
  }

  // 2. Recherche de la cible ennemie la plus intéressante
  let target = null;
  let bestScore = -Infinity;

  for (const plane of allPlanes) {
    if (!plane.alive || plane.id === bot.id) continue;

    const dx = plane.x - bot.x;
    const dy = plane.y - bot.y;
    const dz = plane.z - bot.z;
    const dist = Math.hypot(dx, dy, dz);

    if (dist > 1600) continue; // Hors de portée visuelle

    // Produit scalaire pour savoir si la cible est devant
    const dirX = dx / dist;
    const dirY = dy / dist;
    const dirZ = dz / dist;
    const dot = bot.forwardX * dirX + bot.forwardY * dirY + bot.forwardZ * dirZ;

    // Préférer les cibles devant soi et proches
    const score = dot * 2.0 - (dist / 1000);
    if (score > bestScore) {
      bestScore = score;
      target = plane;
    }
  }

  // Si aucune cible proche, patrouille active dans les airs
  if (!target) {
    if (bot.y < 180) input.pitchUp = true;
    if (Math.sin(Date.now() * 0.001 + bot.id) > 0.4) input.rollLeft = true;
    return input;
  }

  // 3. Calcul de la position d'anticipation (Lead Pursuit)
  const targetVel = { x: target.vx, y: target.vy, z: target.vz };
  const leadPos = computeLeadPosition(
    { x: bot.x, y: bot.y, z: bot.z },
    BULLET_SPEED,
    { x: target.x, y: target.y, z: target.z },
    targetVel
  );

  // Erreur de visée qui se renouvelle au rythme de réaction du bot (plus il est bon, plus elle est petite)
  mem.aimT -= dt;
  if (mem.aimT <= 0) {
    mem.aimT = L.react;
    const d = leadPos.dist * L.aimNoise;
    mem.ox = (Math.random() - 0.5) * d;
    mem.oy = (Math.random() - 0.5) * d;
    mem.oz = (Math.random() - 0.5) * d;
  }
  const toLeadX = leadPos.x + mem.ox - bot.x;
  const toLeadY = leadPos.y + mem.oy - bot.y;
  const toLeadZ = leadPos.z + mem.oz - bot.z;
  const leadDist = Math.hypot(toLeadX, toLeadY, toLeadZ);

  if (leadDist < 1) return input;

  const targetDirX = toLeadX / leadDist;
  const targetDirY = toLeadY / leadDist;
  const targetDirZ = toLeadZ / leadDist;

  // 4. Pilotage : dans ce modèle de vol, le cap (lacet) et l'assiette (tangage) se règlent séparément,
  // l'inclinaison des ailes n'est que visuelle. On vise donc directement le cap et l'assiette du point d'anticipation.
  const desiredYaw = Math.atan2(targetDirX, targetDirZ);
  let yawErr = desiredYaw - bot.yaw;
  while (yawErr > Math.PI) yawErr -= Math.PI * 2;
  while (yawErr < -Math.PI) yawErr += Math.PI * 2;
  const desiredPitch = Math.max(-0.75, Math.min(0.75, Math.asin(Math.max(-1, Math.min(1, targetDirY)))));
  const pitchErr = desiredPitch - bot.pitch;
  const dotForward = targetDirX * bot.forwardX + targetDirY * bot.forwardY + targetDirZ * bot.forwardZ;

  if (yawErr > 0.03) input.rollRight = true;
  else if (yawErr < -0.03) input.rollLeft = true;
  if (Math.abs(yawErr) > 0.25) {
    if (yawErr > 0) input.yawRight = true;
    else input.yawLeft = true;
  }
  if (pitchErr > 0.04) input.pitchUp = true;
  else if (pitchErr < -0.04) input.pitchDown = true;

  // ni trop haut (plafond) ni trop bas
  if (bot.y > 560 && desiredPitch > -0.1) {
    input.pitchUp = false;
    input.pitchDown = bot.pitch > -0.1;
  }

  // 5. Gestion des gaz : foncer de loin, freiner pour resserrer le virage quand la cible est sur le côté
  if (leadDist > L.boostDist && Math.abs(yawErr) < 0.8) {
    input.boost = true;
  } else if (leadDist < 120 || (Math.abs(yawErr) > 0.9 && leadDist < 600)) {
    input.brake = true;
  }

  // 6. Ouverture du feu au canon Vulcan
  // Tirer si la cible est bien centrée et à portée efficace
  // (les bots faibles tirent par rafales hachées, sans surchauffer exprès)
  mem.burstT = (mem.burstT + dt) % 1;
  const heat = bot.weapons ? bot.weapons.heat : 0;
  if (dotForward > L.aimDot && leadDist < L.fireRange && mem.burstT < L.burst && heat < 0.85) {
    input.fire = true;
  }

  return input;
}
