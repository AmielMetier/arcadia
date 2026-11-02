// The Backrooms - Moteur de simulation (60 Hz)
import { CELL_SIZE } from './map.js';
import { findPath, hasLineOfSight } from './nav.js';

export const DT = 1 / 60;
export const PLAYER_RADIUS = 0.38;
export const WALK_SPEED = 3.6;
export const SPRINT_SPEED = 6.2;
export const MONSTER_PATROL_SPEED = 2.8;
export const MONSTER_CHASE_SPEED = 5.2;

export class BackroomsSim {
  constructor({ map, difficulty = 'normal', seed = 42 } = {}) {
    this.map = map;
    this.difficulty = difficulty;
    this.seed = seed;
    this.time = 0;
    this.state = 'playing'; // 'playing' | 'won' | 'dead'

    // Joueur
    this.player = {
      x: map.spawn.x,
      z: map.spawn.z,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vz: 0,
      stamina: 100, // 0 à 100
      running: false,
      flashlight: true,
      cassettesCollected: 0,
      collectedIds: new Set(),
    };

    // Entité / PNJ
    this.hasMonster = difficulty !== 'peaceful';
    this.monster = {
      x: map.monsterSpawn.x,
      z: map.monsterSpawn.z,
      yaw: 0,
      mode: 'patrol', // 'patrol' | 'search' | 'chase'
      speed: MONSTER_PATROL_SPEED,
      path: [],
      pathIndex: 0,
      repathT: 0,
      lastSeenX: map.monsterSpawn.x,
      lastSeenZ: map.monsterSpawn.z,
      targetWander: null,
      distToPlayer: 999,
      danger: 0, // 0.0 à 1.0 (intensité du bourdonnement)
      pan: 0, // -1.0 (gauche) à +1.0 (droite)
      hasLineOfSight: false,
    };

    // Ajuster vitesse selon la difficulté
    if (difficulty === 'hard') {
      this.monsterChaseSpeed = MONSTER_CHASE_SPEED * 1.15;
    } else {
      this.monsterChaseSpeed = MONSTER_CHASE_SPEED;
    }

    // Événements émis à chaque tick (son, ramassage, victoire, jumpscare)
    this.events = [];
  }

  emit(ev) {
    this.events.push(ev);
  }

  drainEvents() {
    const list = this.events;
    this.events = [];
    return list;
  }

  // Déplacement avec glissement contre les murs
  moveWithCollisions(px, pz, dx, dz, radius = PLAYER_RADIUS) {
    let nextX = px + dx;
    let nextZ = pz + dz;

    // Vérifier collision X
    if (this.isColliding(nextX, pz, radius)) {
      nextX = px;
    }
    // Vérifier collision Z
    if (this.isColliding(nextX, nextZ, radius)) {
      nextZ = pz;
    }

    return { x: nextX, z: nextZ };
  }

  isColliding(x, z, radius) {
    const minGx = Math.floor((x - radius) / CELL_SIZE);
    const maxGx = Math.floor((x + radius) / CELL_SIZE);
    const minGz = Math.floor((z - radius) / CELL_SIZE);
    const maxGz = Math.floor((z + radius) / CELL_SIZE);

    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (this.map.isWall(gx, gz)) {
          // Calculer le point le plus proche de la boîte de mur
          const wallMinX = gx * CELL_SIZE;
          const wallMaxX = (gx + 1) * CELL_SIZE;
          const wallMinZ = gz * CELL_SIZE;
          const wallMaxZ = (gz + 1) * CELL_SIZE;

          const closestX = Math.max(wallMinX, Math.min(x, wallMaxX));
          const closestZ = Math.max(wallMinZ, Math.min(z, wallMaxZ));

          const distSq = (x - closestX) ** 2 + (z - closestZ) ** 2;
          if (distSq < radius * radius) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Pas de simulation
  step(input = {}) {
    if (this.state !== 'playing') return;
    this.time += DT;

    // 1. Mise à jour de l'orientation du joueur
    if (input.yaw !== undefined) this.player.yaw = input.yaw;
    if (input.pitch !== undefined) this.player.pitch = input.pitch;
    if (input.toggleFlashlight) {
      this.player.flashlight = !this.player.flashlight;
      this.emit({ type: 'flashlight', on: this.player.flashlight });
    }

    // 2. Endurance et course
    const wantRun = !!input.run && (input.mx !== 0 || input.my !== 0);
    if (wantRun && this.player.stamina > 5) {
      this.player.running = true;
      this.player.stamina = Math.max(0, this.player.stamina - DT * 22);
    } else {
      this.player.running = false;
      this.player.stamina = Math.min(100, this.player.stamina + DT * 14);
    }

    // 3. Déplacement du joueur
    const speed = this.player.running ? SPRINT_SPEED : WALK_SPEED;
    const mx = input.mx || 0;
    const my = input.my || 0;

    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my) || 1;
      const nர்களின்X = mx / len;
      const normY = my / len;

      // Calculer le vecteur monde basé sur yaw
      const forwardX = -Math.sin(this.player.yaw);
      const forwardZ = -Math.cos(this.player.yaw);
      const rightX = Math.cos(this.player.yaw);
      const rightZ = -Math.sin(this.player.yaw);

      const moveX = (forwardX * normY + rightX * nர்களின்X) * speed * DT;
      const moveZ = (forwardZ * normY + rightZ * nர்களின்X) * speed * DT;

      const pos = this.moveWithCollisions(this.player.x, this.player.z, moveX, moveZ);
      this.player.x = pos.x;
      this.player.z = pos.z;
    }

    // 4. Ramassage des 5 cassettes VHS
    for (const cas of this.map.cassettes) {
      if (!cas.collected) {
        const d = Math.hypot(cas.x - this.player.x, cas.z - this.player.z);
        if (d < 1.4) {
          cas.collected = true;
          this.player.cassettesCollected++;
          this.player.collectedIds.add(cas.id);
          this.emit({
            type: 'cassette',
            id: cas.id,
            count: this.player.cassettesCollected,
            total: this.map.cassettes.length,
          });

          if (this.player.cassettesCollected === 5) {
            this.emit({ type: 'exitUnlocked' });
          }
        }
      }
    }

    // 5. Condition de Victoire : Atteindre la sortie après avoir les 5 cassettes
    if (this.player.cassettesCollected >= 5) {
      const distToExit = Math.hypot(this.map.exit.x - this.player.x, this.map.exit.z - this.player.z);
      if (distToExit < 1.8) {
        this.state = 'won';
        this.emit({ type: 'win', time: this.time });
        return;
      }
    }

    // 6. IA de l'Entité / Monstre
    if (this.hasMonster) {
      this.updateMonster();
    }
  }

  updateMonster() {
    const M = this.monster;
    const P = this.player;

    const dx = P.x - M.x;
    const dz = P.z - M.z;
    const dist = Math.hypot(dx, dz);
    M.distToPlayer = dist;

    // Calcul de la dangerosité et volume du bourdonnement :
    // De 0 à 35 mètres : intensité exponentielle inverse
    // Plus le monstre est proche, plus le son s'amplifie fortement
    if (dist > 35) {
      M.danger = 0;
    } else {
      const ratio = 1 - Math.min(1, Math.max(0, (dist - 1.2) / 32));
      // Courbe exponentielle : monte rapidement dès qu'il est à portée
      M.danger = Math.pow(ratio, 1.6);
    }

    // Calcul de la panoramique spatiale audio (-1 gauche à +1 droite par rapport au regard du joueur)
    const relX = M.x - P.x;
    const relZ = M.z - P.z;
    // Projection relative à l'angle du joueur
    const angleToMonster = Math.atan2(relX, relZ);
    let diffAngle = angleToMonster - (this.player.yaw - Math.PI);
    while (diffAngle > Math.PI) diffAngle -= 2 * Math.PI;
    while (diffAngle < -Math.PI) diffAngle += 2 * Math.PI;
    M.pan = Math.max(-0.9, Math.min(0.9, Math.sin(diffAngle)));

    // Vérifier si le monstre a la vue directe sur le joueur
    M.hasLineOfSight = hasLineOfSight(this.map, M.x, M.z, P.x, P.z);

    // Détection du joueur :
    // - Vue directe jusqu'à 20 mètres
    // - Bruit si le joueur court jusqu'à 14 mètres
    // - Présence rapprochée (< 6 mètres)
    const canSee = M.hasLineOfSight && dist < 22;
    const canHear = P.running && dist < 14;
    const isNearby = dist < 6.5;

    if (canSee || canHear || isNearby) {
      M.mode = 'chase';
      M.lastSeenX = P.x;
      M.lastSeenZ = P.z;
      M.speed = this.monsterChaseSpeed;
    } else if (M.mode === 'chase' && dist > 26) {
      // Le joueur a réussi à semer le monstre
      M.mode = 'search';
      M.speed = MONSTER_PATROL_SPEED * 1.2;
    }

    // Recalcul de trajectoire
    M.repathT -= DT;
    if (M.repathT <= 0) {
      M.repathT = M.mode === 'chase' ? 0.35 : 1.2;

      let targetX = P.x;
      let targetZ = P.z;

      if (M.mode === 'patrol') {
        if (!M.targetWander || Math.hypot(M.x - M.targetWander.x, M.z - M.targetWander.z) < 1.5) {
          const randCell = this.map.walkable[Math.floor(Math.random() * this.map.walkable.length)];
          M.targetWander = {
            x: (randCell.x + 0.5) * CELL_SIZE,
            z: (randCell.z + 0.5) * CELL_SIZE,
          };
        }
        targetX = M.targetWander.x;
        targetZ = M.targetWander.z;
      } else if (M.mode === 'search') {
        targetX = M.lastSeenX;
        targetZ = M.lastSeenZ;
        if (Math.hypot(M.x - targetX, M.z - targetZ) < 2) {
          M.mode = 'patrol';
        }
      }

      const path = findPath(this.map, M.x, M.z, targetX, targetZ);
      if (path && path.length > 0) {
        M.path = path;
        M.pathIndex = 0;
      }
    }

    // Avancement le long du chemin
    if (M.path && M.path.length > M.pathIndex) {
      const nextWaypoint = M.path[M.pathIndex];
      const wdx = nextWaypoint.x - M.x;
      const wdz = nextWaypoint.z - M.z;
      const wdist = Math.hypot(wdx, wdz);

      if (wdist < 0.3) {
        M.pathIndex++;
      } else {
        const moveStep = Math.min(wdist, M.speed * DT);
        M.x += (wdx / wdist) * moveStep;
        M.z += (wdz / wdist) * moveStep;
        M.yaw = Math.atan2(wdx, wdz);
      }
    } else {
      // Déplacement direct si proche
      if (dist > 0.1) {
        const step = Math.min(dist, M.speed * DT);
        M.x += (dx / dist) * step;
        M.z += (dz / dist) * step;
        M.yaw = Math.atan2(dx, dz);
      }
    }

    // Condition de Mort : le monstre attrape le joueur
    if (dist < 1.15) {
      this.state = 'dead';
      this.emit({ type: 'jumpscare', x: M.x, z: M.z });
      this.emit({ type: 'dead', time: this.time });
    }
  }
}
