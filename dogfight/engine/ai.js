// Intelligence Artificielle de combat aérien (Dogfight AI) pour les F-16 bots.
// Poursuite en courbe de chasse, anticipation de tir (Lead), évitement de relief et tonneaux d'esquive.
import { computeLeadPosition, BULLET_SPEED } from './weapons.js';

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

  const toLeadX = leadPos.x - bot.x;
  const toLeadY = leadPos.y - bot.y;
  const toLeadZ = leadPos.z - bot.z;
  const leadDist = Math.hypot(toLeadX, toLeadY, toLeadZ);

  if (leadDist < 1) return input;

  const targetDirX = toLeadX / leadDist;
  const targetDirY = toLeadY / leadDist;
  const targetDirZ = toLeadZ / leadDist;

  // 4. Pilotage pour aligner le nez de l'avion sur le point d'anticipation
  // Projection sur les axes locaux de l'avion
  const dotPitch = targetDirX * bot.upX + targetDirY * bot.upY + targetDirZ * bot.upZ;
  const dotYaw = targetDirX * bot.rightX + targetDirY * bot.rightY + targetDirZ * bot.rightZ;
  const dotForward = targetDirX * bot.forwardX + targetDirY * bot.forwardY + targetDirZ * bot.forwardZ;

  // Tangage
  if (dotPitch > 0.08) input.pitchUp = true;
  else if (dotPitch < -0.08) input.pitchDown = true;

  // En dogfight, un avion tourne en inclinant ses ailes (Bank and Yank)
  if (Math.abs(dotYaw) > 0.15) {
    if (dotYaw > 0) {
      input.rollRight = true;
      if (dotPitch < 0.2) input.pitchUp = true; // Virage serré
    } else {
      input.rollLeft = true;
      if (dotPitch < 0.2) input.pitchUp = true;
    }
    // Petit lacet d'ajustement
    if (dotYaw > 0.05) input.yawRight = true;
    else if (dotYaw < -0.05) input.yawLeft = true;
  } else {
    // Aligner les ailes à l'horizontale si on est bien axé
    if (bot.roll > 0.15) input.rollLeft = true;
    else if (bot.roll < -0.15) input.rollRight = true;
  }

  // 5. Gestion des gaz (Vitesse & Distance de combat)
  if (leadDist > 450) {
    input.boost = true; // Rapprocher le contact
  } else if (leadDist < 120) {
    input.brake = true; // Éviter de dépasser la cible (Overshoot)
  }

  // 6. Ouverture du feu au canon Vulcan
  // Tirer si la cible est bien centrée et à portée efficace
  if (dotForward > 0.94 && leadDist < 480) {
    input.fire = true;
  }

  return input;
}
