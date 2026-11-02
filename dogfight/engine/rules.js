// Moteur de règles et gestion de session pour Dogfight 3D.
// Gestion des points de vie, éliminations, réapparitions (respawn) et victoire.
import { FlightModel } from './flight.js';
import { WeaponSystem } from './weapons.js';

export const COLORS = [
  '#2563eb', // Bleu USAF
  '#dc2626', // Rouge escadron
  '#16a34a', // Vert camouflage
  '#d97706', // Orange fauve
  '#9333ea', // Violet furtif
  '#0891b2', // Cyan arctique
];

export const MAX_HEALTH = 100;
export const RESPAWN_DELAY = 3.0;
export const INVULNERABLE_TIME = 2.5;

export function createDogfightGame({
  settings = {},
  players = [],
  map = null,
} = {}) {
  const targetKills = Number(settings.kills || 8);
  const timeLimit = Number(settings.time || 300); // 5 minutes

  const state = {
    settings: {
      targetKills,
      timeLimit,
      botLevel: settings.level || 'normal',
    },
    phase: 'countdown', // 'countdown' | 'playing' | 'game_over'
    phaseTimer: 2.5,
    matchTimer: timeLimit,
    winner: null,
    planes: [],
    events: [],
  };

  // Création des avions
  const total = players.length;
  state.planes = players.map((p, idx) => {
    // Répartition en cercle autour de l'île, face au centre
    const angle = (idx / Math.max(1, total)) * Math.PI * 2;
    const radius = 550;
    const spawnX = 800 + Math.cos(angle) * radius;
    const spawnZ = 800 + Math.sin(angle) * radius;
    const heading = angle + Math.PI; // Regarde vers le centre (800, 800)

    const flight = new FlightModel({
      x: spawnX,
      y: 220 + (idx % 3) * 30,
      z: spawnZ,
      heading,
    });

    const weapons = new WeaponSystem();

    return {
      id: p.id,
      name: p.name || `Pilote ${idx + 1}`,
      color: p.color || COLORS[idx % COLORS.length],
      bot: Boolean(p.bot),
      botLevel: p.botLevel || settings.level || 'normal',
      flight,
      weapons,
      x: flight.x,
      y: flight.y,
      z: flight.z,
      vx: flight.vx,
      vy: flight.vy,
      vz: flight.vz,
      forwardX: flight.forwardX,
      forwardY: flight.forwardY,
      forwardZ: flight.forwardZ,
      upX: flight.upX,
      upY: flight.upY,
      upZ: flight.upZ,
      rightX: flight.rightX,
      rightY: flight.rightY,
      rightZ: flight.rightZ,
      speed: flight.speed,
      roll: flight.roll,
      pitch: flight.pitch,
      yaw: flight.yaw,
      crashed: false,
      boosting: false,
      health: MAX_HEALTH,
      kills: 0,
      deaths: 0,
      alive: true,
      respawnTimer: 0,
      invulnerableTimer: INVULNERABLE_TIME,
      input: {
        pitchUp: false, pitchDown: false,
        rollLeft: false, rollRight: false,
        yawLeft: false, yawRight: false,
        boost: false, brake: false, fire: false,
      },
    };
  });

  return state;
}

export function tickDogfight(state, dt, map = null) {
  state.events = [];

  if (state.phase === 'countdown') {
    state.phaseTimer -= dt;
    if (state.phaseTimer <= 0) {
      state.phase = 'playing';
      state.events.push({ type: 'start' });
    }
    return;
  }

  if (state.phase === 'game_over') {
    return;
  }

  state.matchTimer -= dt;
  if (state.matchTimer <= 0) {
    endGame(state);
    return;
  }

  // 1. Mise à jour de chaque avion
  for (const plane of state.planes) {
    if (!plane.alive) {
      // Gestion du compte à rebours de réapparition
      plane.respawnTimer -= dt;
      if (plane.respawnTimer <= 0) {
        respawnPlane(plane, map);
        state.events.push({ type: 'respawn', planeId: plane.id });
      }
      continue;
    }

    if (plane.invulnerableTimer > 0) {
      plane.invulnerableTimer -= dt;
    }

    // Vol
    plane.flight.update(plane.input, dt, map);

    // Détection de crash au sol ou en mer
    if (plane.flight.crashed) {
      killPlane(state, plane, null, 'crash');
      continue;
    }

    // Coordonnées synchronisées pour les calculs de tir
    plane.x = plane.flight.x;
    plane.y = plane.flight.y;
    plane.z = plane.flight.z;
    plane.vx = plane.flight.vx;
    plane.vy = plane.flight.vy;
    plane.vz = plane.flight.vz;
    plane.forwardX = plane.flight.forwardX;
    plane.forwardY = plane.flight.forwardY;
    plane.forwardZ = plane.flight.forwardZ;
    plane.upX = plane.flight.upX;
    plane.upY = plane.flight.upY;
    plane.upZ = plane.flight.upZ;
    plane.rightX = plane.flight.rightX;
    plane.rightY = plane.flight.rightY;
    plane.rightZ = plane.flight.rightZ;
    plane.speed = plane.flight.speed;
    plane.roll = plane.flight.roll;
    plane.pitch = plane.flight.pitch;
    plane.yaw = plane.flight.yaw;
    plane.crashed = plane.flight.crashed;
    plane.boosting = plane.flight.boosting;
  }

  // 2. Gestion des tirs d'armes
  for (const plane of state.planes) {
    if (!plane.alive) continue;

    // Cibles possibles (avions vivants et non invulnérables)
    const targets = state.planes.filter((p) => p.alive && p.invulnerableTimer <= 0);

    const weaponEvents = plane.weapons.update(
      plane.input.fire,
      plane,
      dt,
      targets,
      (victim, shooterId, dmg) => {
        applyDamage(state, victim, shooterId, dmg);
      }
    );

    for (const ev of weaponEvents) {
      state.events.push(ev);
    }
  }
}

function applyDamage(state, victim, shooterId, dmg) {
  if (!victim.alive || victim.invulnerableTimer > 0) return;

  victim.health -= dmg;

  if (victim.health <= 0) {
    victim.health = 0;
    const killer = state.planes.find((p) => p.id === shooterId);
    killPlane(state, victim, killer, 'kill');
  }
}

function killPlane(state, victim, killer, reason = 'kill') {
  if (!victim.alive) return;

  victim.alive = false;
  victim.deaths++;
  victim.respawnTimer = RESPAWN_DELAY;

  if (killer && killer.id !== victim.id) {
    killer.kills++;
    state.events.push({
      type: 'kill',
      killerId: killer.id,
      killerName: killer.name,
      victimId: victim.id,
      victimName: victim.name,
      x: victim.flight.x,
      y: victim.flight.y,
      z: victim.flight.z,
    });

    // Victoire si le palier de kills est atteint
    if (killer.kills >= state.settings.targetKills) {
      state.winner = killer;
      endGame(state);
    }
  } else {
    // Crash ou suicide
    state.events.push({
      type: 'crash',
      victimId: victim.id,
      victimName: victim.name,
      x: victim.flight.x,
      y: victim.flight.y,
      z: victim.flight.z,
    });
  }
}

function respawnPlane(plane, map) {
  // Réapparition à haute altitude au-dessus d'une zone aléatoire de l'île
  const angle = Math.random() * Math.PI * 2;
  const dist = 300 + Math.random() * 400;
  const spawnX = 800 + Math.cos(angle) * dist;
  const spawnZ = 800 + Math.sin(angle) * dist;
  const groundH = map ? Math.max(0, map.heightAt(spawnX, spawnZ)) : 0;
  const spawnY = Math.max(groundH + 120, 240 + Math.random() * 60);

  plane.flight = new FlightModel({
    x: spawnX,
    y: spawnY,
    z: spawnZ,
    heading: angle + Math.PI,
  });

  plane.health = MAX_HEALTH;
  plane.alive = true;
  plane.invulnerableTimer = INVULNERABLE_TIME;
  plane.weapons.heat = 0;
  plane.weapons.overheated = false;
}

function endGame(state) {
  state.phase = 'game_over';
  if (!state.winner) {
    // Le vainqueur est celui avec le plus de kills
    const sorted = [...state.planes].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    state.winner = sorted[0];
  }
  state.events.push({ type: 'game_over', winnerId: state.winner?.id });
}
