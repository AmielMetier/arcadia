// The Backrooms - Moteur de simulation (60 Hz), sans DOM
// Plusieurs joueurs possibles (l'hôte fait autorité). Deux niveaux :
//   Level 0 : 5 cassettes VHS ouvrent l'ascenseur.
//   Level 1 : l'entrepôt ; 3 fusibles à rapporter au panneau du monte-charge, des coupures de courant, et l'entité
//             qui se cache au bout des rangées d'étagères pour tendre des embuscades.
// Qui entre dans l'ascenseur ouvert devient spectateur ; il part quand plus personne n'est dehors. Plus il y a de
// monde dans la cabine, plus l'entité s'énerve contre ceux qui restent.
// Au tout début, personne n'a de lampe : une table au départ en porte une par joueur. Un joueur attrapé regarde les
// autres jusqu'à la fin de l'étage ; si l'équipe le termine, tout le monde repart à l'étage suivant, lampe en main.
import { CELL_SIZE, T, createBackroomsMap } from './map.js';
import { createWarehouseMap } from './level1.js';
import { findPath, hasLineOfSight } from './nav.js';

export const DT = 1 / 60;
export const PLAYER_RADIUS = 0.38;
// On avance lentement dans les Backrooms : la carte est immense et chaque pas compte
export const WALK_SPEED = 2.1;
export const SPRINT_SPEED = 3.7;
export const MONSTER_PATROL_SPEED = 1.5;
export const MONSTER_CHASE_SPEED = 2.75;
export const STAMINA_DRAIN = 15; // par seconde de course
export const STAMINA_REGEN = 9;
export const LOSE_TRACK_T = 4; // secondes sans voir le joueur avant que l'entité ne le perde
export const BATTERY_DRAIN = 0.42; // % par seconde de lampe allumée (environ 4 minutes pour une pile pleine)
export const BATTERY_PACK = 60; // % rendus par une pile utilisée
export const INV_SIZE = 2; // cases d'objets (piles et eau d'amande) : la case 1 de l'inventaire est réservée à la lampe
export const CASSETTES = 5;
export const FUSES = 3;
export const LAST_LEVEL = 1;
export const DEPART_T = 3; // secondes entre la fermeture des portes et l'arrivée
// coupures de courant du Level 1 : toutes les 35 à 60 s, pendant 15 à 20 s
export const BLACKOUT_EVERY = [35, 60];
export const BLACKOUT_LEN = [15, 20];

const rand = (a, b) => a + Math.random() * (b - a);

// la carte d'un niveau : même graine de partie, une carte par niveau
export function makeLevelMap(level, seed) {
  return level === 1 ? createWarehouseMap(seed * 7 + 13) : createBackroomsMap(seed);
}

function newPlayer(id, name, map, i) {
  // les joueurs arrivent côte à côte autour du départ
  const off = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0.7, 0.7]][i % 6];
  return {
    id,
    name,
    x: map.spawn.x + off[0],
    z: map.spawn.z + off[1],
    yaw: 0,
    pitch: 0,
    stamina: 100, // 0 à 100
    running: false,
    flashlight: false,
    hasLamp: false, // lampe torche prise sur la table du départ
    bottles: 0,
    battery: 100, // pile de la lampe torche (0 à 100)
    inv: [], // inventaire : 'battery' ou 'bottle', INV_SIZE cases au plus
    signal: 0, // 0 à 1 : force du signal de l'objectif le plus proche (affiché par la caméra)
    moving: false,
    status: 'alive', // 'alive' | 'elevator' (à l'abri, spectateur) | 'dead' (spectateur)
    danger: 0, // 0 à 1 : proximité de l'entité, pour ce joueur (son, image)
    pan: 0,
    found: 0, // objets d'objectif trouvés (cassettes, fusibles)
  };
}

export class BackroomsSim {
  // players : [{ id, name }] (le premier est l'hôte) ; localId : le joueur de cet écran
  constructor({ map = null, difficulty = 'normal', seed = 42, players = null, localId = 0, level = 0 } = {}) {
    this.difficulty = difficulty;
    this.seed = seed;
    this.time = 0;
    this.state = 'playing'; // 'playing' | 'won' | 'dead'
    this.localId = localId;
    this.roster = players && players.length ? players : [{ id: localId, name: 'Joueur' }];
    this.hasMonster = difficulty !== 'peaceful';
    this.monsterChaseSpeed = MONSTER_CHASE_SPEED * (difficulty === 'hard' ? 1.2 : 1);
    this.events = [];
    this.loadLevel(level, map);
  }

  // Installe un niveau : nouvelle carte, joueurs au départ (les morts reviennent), entité au loin
  loadLevel(level, map = null) {
    const prev = this.players || [];
    this.level = level;
    this.map = map || makeLevelMap(level, this.seed);
    this.players = this.roster.map((r, i) => {
      const P = newPlayer(r.id, r.name, this.map, i);
      const old = prev.find((p) => p.id === r.id);
      if (old) {
        // on garde son inventaire, sa pile et ses trouvailles d'un étage à l'autre
        P.inv = old.inv;
        P.battery = old.battery;
        P.bottles = old.bottles;
        P.found = old.found;
        P.yaw = old.yaw;
      }
      // à partir du Level 1, tout le monde a sa lampe (ceux qui étaient tombés en reçoivent une)
      if (level > 0) {
        P.hasLamp = true;
        P.flashlight = !old || old.flashlight || old.status !== 'alive';
      }
      return P;
    });
    // Level 0 : la table des lampes torches, posée dans une case libre à côté du départ
    this.table = null;
    this.lamps = [];
    if (level === 0) {
      const { gx, gz } = this.map.spawn;
      const free = (x, z) => !this.map.isWall(x, z) && !(this.map.props || []).some((p) => Math.hypot(p.x - (x + 0.5) * CELL_SIZE, p.z - (z + 0.5) * CELL_SIZE) < 1.4);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
      const d = dirs.find(([dx, dz]) => free(gx + dx, gz + dz) && free(gx + 2 * dx, gz + 2 * dz)) || dirs.find(([dx, dz]) => free(gx + dx, gz + dz));
      if (d) {
        const tx = (gx + d[0] + 0.5) * CELL_SIZE;
        const tz = (gz + d[1] + 0.5) * CELL_SIZE;
        // la table regarde le départ ; les lampes sont alignées sur sa longueur
        const rot = Math.atan2(d[0], d[1]) + Math.PI / 2;
        this.table = { x: tx, z: tz, r: 0.62, rot };
        const n = this.roster.length;
        for (let i = 0; i < n; i++) {
          const o = n > 1 ? (i / (n - 1) - 0.5) * 1.1 : 0;
          this.lamps.push({ id: i, x: tx + Math.cos(rot) * o, z: tz - Math.sin(rot) * o, taken: false });
        }
      } else {
        // pas de place (très rare) : chacun part avec sa lampe
        for (const P of this.players) {
          P.hasLamp = true;
          P.flashlight = true;
        }
      }
    }
    this.cassettes = 0; // cassettes trouvées par l'équipe (Level 0)
    this.fuses = 0; // fusibles en poche (Level 1)
    this.powered = false; // panneau du monte-charge réalimenté
    this.departT = 0; // compte à rebours du départ de l'ascenseur
    this.blackout = 0; // secondes de noir restantes
    this.nextBlackout = level === 1 ? rand(...BLACKOUT_EVERY) * 0.6 : Infinity;
    this.fullNear = {};

    const ms = this.map.monsterSpawn;
    this.monster = {
      x: ms.x,
      z: ms.z,
      yaw: 0,
      mode: 'patrol', // 'patrol' | 'search' | 'chase' | 'ambush'
      speed: MONSTER_PATROL_SPEED,
      path: [],
      pathIndex: 0,
      repathT: 0,
      lastSeenX: ms.x,
      lastSeenZ: ms.z,
      targetWander: null,
      target: null, // id du joueur traqué
      distToPlayer: 999,
      danger: 0, // proximité vue par le joueur de cet écran (son, image)
      pan: 0,
      hasLineOfSight: false,
      unseenT: 0,
      ambush: null, // case d'embuscade
      ambushT: 8, // délai avant la prochaine embuscade
      waitT: 0,
      burstT: 0, // élan de la charge après une embuscade
      silent: false, // l'entité se tait quand elle attend en embuscade
    };
  }

  // le joueur de cet écran
  get player() {
    return this.players.find((p) => p.id === this.localId) || this.players[0];
  }

  // le joueur que la caméra suit : soi-même, ou un joueur encore dehors quand on est spectateur
  viewPlayer(pick = 0) {
    const me = this.player;
    if (me.status === 'alive') return me;
    const out = this.players.filter((p) => p.status === 'alive');
    if (!out.length) return me;
    return out[((pick % out.length) + out.length) % out.length];
  }

  get open() {
    return this.level === 0 ? this.cassettes >= CASSETTES : this.powered;
  }

  // part de l'équipe déjà à l'abri dans l'ascenseur (0 à 1) : l'entité devient plus agressive
  get rage() {
    const n = this.players.length;
    return n > 1 ? this.players.filter((p) => p.status === 'elevator').length / n : 0;
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
    if (this.isColliding(nextX, pz, radius)) nextX = px;
    if (this.isColliding(nextX, nextZ, radius)) nextZ = pz;
    return { x: nextX, z: nextZ };
  }

  // la cabine de l'ascenseur se traverse seulement quand il est ouvert
  blocked(gx, gz) {
    if (!this.map.isWall(gx, gz)) return false;
    return !(this.open && this.map.grid[gz * this.map.W + gx] === T.EXIT);
  }

  isColliding(x, z, radius) {
    const minGx = Math.floor((x - radius) / CELL_SIZE);
    const maxGx = Math.floor((x + radius) / CELL_SIZE);
    const minGz = Math.floor((z - radius) / CELL_SIZE);
    const maxGz = Math.floor((z + radius) / CELL_SIZE);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (!this.blocked(gx, gz)) continue;
        const closestX = Math.max(gx * CELL_SIZE, Math.min(x, (gx + 1) * CELL_SIZE));
        const closestZ = Math.max(gz * CELL_SIZE, Math.min(z, (gz + 1) * CELL_SIZE));
        if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius * radius) return true;
      }
    }
    // table des lampes, caisses et meubles abandonnés (cercles)
    const T0 = this.table;
    if (T0 && (T0.x - x) ** 2 + (T0.z - z) ** 2 < (radius + T0.r) ** 2) return true;
    for (const pr of this.map.props || []) {
      const rr = radius + pr.r;
      if (Math.abs(pr.x - x) < rr && Math.abs(pr.z - z) < rr && (pr.x - x) ** 2 + (pr.z - z) ** 2 < rr * rr) return true;
    }
    return false;
  }

  // Boire l'eau d'amande (souffle au maximum) ou changer la pile de la lampe
  useItem(P, i) {
    const kind = P.inv[i];
    if (!kind) return;
    if (kind === 'bottle') {
      if (P.stamina >= 100) return this.emit({ type: 'useless', kind, id: P.id });
      P.stamina = 100;
      P.bottles++;
    } else {
      if (P.battery >= 100) return this.emit({ type: 'useless', kind, id: P.id });
      P.battery = Math.min(100, P.battery + BATTERY_PACK);
    }
    P.inv.splice(i, 1);
    this.emit({ type: kind, used: true, id: P.id });
  }

  // Un pas de simulation. input : les commandes du joueur de cet écran ; others : { id: commandes } des autres
  step(input = {}, others = null) {
    if (this.state !== 'playing') return;
    this.time += DT;

    // l'ascenseur part : les portes sont fermées, on attend l'arrivée
    if (this.departT > 0) {
      this.departT -= DT;
      if (this.departT <= 0) this.arrive();
      return;
    }

    // coupures de courant du Level 1
    if (this.level === 1) {
      if (this.blackout > 0) {
        this.blackout -= DT;
        if (this.blackout <= 0) {
          this.blackout = 0;
          this.nextBlackout = rand(...BLACKOUT_EVERY);
          this.emit({ type: 'power' });
        }
      } else {
        this.nextBlackout -= DT;
        if (this.nextBlackout <= 0) {
          this.blackout = rand(...BLACKOUT_LEN);
          this.emit({ type: 'blackout', len: this.blackout });
        }
      }
    }

    for (const P of this.players) {
      const inp = P.id === this.localId ? input : (others && others[P.id]) || {};
      if (P.status === 'alive') this.stepPlayer(P, inp);
    }
    if (this.state !== 'playing') return;

    if (this.hasMonster) this.updateMonster();
    this.checkElevator();
  }

  stepPlayer(P, input) {
    // 1. Orientation, lampe et inventaire
    if (input.yaw !== undefined) P.yaw = input.yaw;
    if (input.pitch !== undefined) P.pitch = input.pitch;
    if (input.toggleFlashlight) {
      if (!P.hasLamp) this.emit({ type: 'noLamp', id: P.id });
      else if (!P.flashlight && P.battery <= 0) this.emit({ type: 'batteryEmpty', id: P.id });
      else {
        P.flashlight = !P.flashlight;
        this.emit({ type: 'flashlight', on: P.flashlight, id: P.id });
      }
    }
    if (input.use !== undefined && input.use !== null) this.useItem(P, input.use);

    // la lampe vide la pile ; à plat, elle s'éteint
    if (P.flashlight) {
      P.battery = Math.max(0, P.battery - BATTERY_DRAIN * DT);
      if (P.battery <= 0) {
        P.flashlight = false;
        this.emit({ type: 'batteryEmpty', id: P.id });
      }
    }

    // 2. Endurance et course
    const mx = input.mx || 0;
    const my = input.my || 0;
    const wantRun = !!input.run && (mx !== 0 || my !== 0);
    if (wantRun && P.stamina > 5) {
      P.running = true;
      P.stamina = Math.max(0, P.stamina - DT * STAMINA_DRAIN);
    } else {
      P.running = false;
      P.stamina = Math.min(100, P.stamina + DT * STAMINA_REGEN);
    }

    // 3. Déplacement (un invité se déplace chez lui et annonce sa position : l'hôte la prend si elle est plausible)
    const speed = P.running ? SPRINT_SPEED : WALK_SPEED;
    P.moving = mx !== 0 || my !== 0;
    const pos = input.pos;
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z) && Math.hypot(pos.x - P.x, pos.z - P.z) < 3 && !this.isColliding(pos.x, pos.z, PLAYER_RADIUS * 0.8)) {
      P.x = pos.x;
      P.z = pos.z;
    } else if (P.moving) {
      const len = Math.hypot(mx, my) || 1;
      const normX = mx / len;
      const normY = my / len;
      const fx = -Math.sin(P.yaw);
      const fz = -Math.cos(P.yaw);
      const rx = Math.cos(P.yaw);
      const rz = -Math.sin(P.yaw);
      const pos = this.moveWithCollisions(P.x, P.z, (fx * normY + rx * normX) * speed * DT, (fz * normY + rz * normX) * speed * DT);
      P.x = pos.x;
      P.z = pos.z;
    }

    // 3b. Prendre une lampe sur la table du départ (une par joueur)
    if (!P.hasLamp && this.table && Math.hypot(this.table.x - P.x, this.table.z - P.z) < 1.7) {
      const lamp = this.lamps.find((l) => !l.taken);
      if (lamp) {
        lamp.taken = true;
        P.hasLamp = true;
        P.flashlight = true;
        this.emit({ type: 'lamp', id: P.id, lamp: lamp.id });
      }
    }

    // 4. Objectifs : cassettes (Level 0) ou fusibles (Level 1), pour toute l'équipe
    for (const cas of this.map.cassettes || []) {
      if (cas.collected || Math.hypot(cas.x - P.x, cas.z - P.z) >= 1.4) continue;
      cas.collected = true;
      this.cassettes++;
      P.found++;
      this.emit({ type: 'cassette', id: cas.id, by: P.id, count: this.cassettes, total: CASSETTES });
      if (this.cassettes === CASSETTES) this.emit({ type: 'exitUnlocked' });
    }
    for (const f of this.map.fuses || []) {
      if (f.taken || Math.hypot(f.x - P.x, f.z - P.z) >= 1.3) continue;
      f.taken = true;
      this.fuses++;
      P.found++;
      this.emit({ type: 'fuse', id: f.id, by: P.id, count: this.fuses, total: FUSES });
    }
    // les 3 fusibles rapportés au panneau du monte-charge : le courant revient, les portes s'ouvrent
    if (this.level === 1 && !this.powered && this.fuses >= FUSES && Math.hypot(this.map.exit.x - P.x, this.map.exit.z - P.z) < 2.6) {
      this.powered = true;
      this.emit({ type: 'powered', by: P.id });
      this.emit({ type: 'exitUnlocked' });
    }

    // 4b. Eau d'amande et piles : ramassées dans l'inventaire s'il reste une case
    let near = null;
    for (const [kind, list] of [['bottle', this.map.bottles], ['battery', this.map.batteries]]) {
      for (const b of list || []) {
        if (b.taken || Math.hypot(b.x - P.x, b.z - P.z) >= 1.1) continue;
        if (P.inv.length < INV_SIZE) {
          b.taken = true;
          P.inv.push(kind);
          this.emit({ type: 'pickup', kind, id: b.id, by: P.id });
        } else near = kind + b.id;
      }
    }
    // inventaire plein : on le dit une fois par objet approché
    if (near && near !== this.fullNear[P.id]) this.emit({ type: 'invFull', id: P.id });
    this.fullNear[P.id] = near;

    // 4c. Signal de l'objectif le plus proche (à vol d'oiseau, 0 au-delà de 45 m), puis de l'ascenseur
    let best = Infinity;
    const goals = this.level === 0 ? this.map.cassettes.filter((c) => !c.collected) : this.fuses < FUSES ? this.map.fuses.filter((f) => !f.taken) : [];
    for (const g of goals) best = Math.min(best, Math.hypot(g.x - P.x, g.z - P.z));
    if (!goals.length) best = Math.hypot(this.map.exit.x - P.x, this.map.exit.z - P.z);
    P.signal = best === Infinity ? 0 : Math.max(0, 1 - best / 45);

    // 5. Entrer dans l'ascenseur ouvert : à l'abri, spectateur jusqu'au départ
    if (this.open) {
      const E = this.map.elevator;
      const inside = E
        ? Math.floor(P.x / CELL_SIZE) === E.gx && Math.floor(P.z / CELL_SIZE) === E.gz
        : Math.hypot(this.map.exit.x - P.x, this.map.exit.z - P.z) < 1.8;
      if (inside) {
        P.status = 'elevator';
        P.moving = false;
        P.running = false;
        this.emit({ type: 'board', id: P.id, name: P.name });
      }
    }
  }

  // Invité : il déplace seulement son joueur, sans rien ramasser ni décider (l'hôte le fera)
  predict(input = {}) {
    const P = this.player;
    if (this.state !== 'playing' || P.status !== 'alive' || this.departT > 0) return;
    if (input.yaw !== undefined) P.yaw = input.yaw;
    if (input.pitch !== undefined) P.pitch = input.pitch;
    const mx = input.mx || 0;
    const my = input.my || 0;
    P.moving = mx !== 0 || my !== 0;
    P.running = !!input.run && P.moving && P.stamina > 5;
    if (P.running) P.stamina = Math.max(0, P.stamina - DT * STAMINA_DRAIN);
    else P.stamina = Math.min(100, P.stamina + DT * STAMINA_REGEN);
    if (!P.moving) return;
    const speed = P.running ? SPRINT_SPEED : WALK_SPEED;
    const len = Math.hypot(mx, my) || 1;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    const pos = this.moveWithCollisions(P.x, P.z, ((fx * my + rx * mx) / len) * speed * DT, ((fz * my + rz * mx) / len) * speed * DT);
    P.x = pos.x;
    P.z = pos.z;
  }

  // Un joueur arrive en cours de partie : spectateur jusqu'au prochain étage
  addPlayer(id, name) {
    if (this.players.some((p) => p.id === id)) return;
    this.roster.push({ id, name });
    const P = newPlayer(id, name, this.map, this.players.length);
    P.status = 'dead';
    this.players.push(P);
  }

  // l'objectif à suivre pour un joueur sans lampe : la table du départ
  get needLamp() {
    return !!this.table && !this.player.hasLamp && this.player.status === 'alive';
  }

  // Un joueur s'en va : il disparaît de la partie ; s'il était le dernier dehors, l'ascenseur part
  removePlayer(id) {
    this.roster = this.roster.filter((r) => r.id !== id);
    this.players = this.players.filter((p) => p.id !== id);
    if (this.players.length && this.state === 'playing') this.checkElevator();
  }

  // Instantané envoyé par l'hôte aux invités (~20 fois par seconde)
  snapshot() {
    const M = this.monster;
    const bits = (list, k) => (list || []).map((o) => (o[k] ? 1 : 0)).join('');
    const r2 = (v) => Math.round(v * 100) / 100;
    return {
      lv: this.level,
      st: this.state,
      tm: r2(this.time),
      c: this.cassettes,
      f: this.fuses,
      pw: this.powered ? 1 : 0,
      bo: r2(this.blackout),
      dp: r2(this.departT),
      p: this.players.map((P) => [P.id, r2(P.x), r2(P.z), r2(P.yaw), r2(P.pitch), P.status, P.flashlight ? 1 : 0, Math.round(P.battery), Math.round(P.stamina), P.inv.join(','), r2(P.signal), P.running ? 1 : 0, P.moving ? 1 : 0, P.found, P.name, P.hasLamp ? 1 : 0]),
      m: [r2(M.x), r2(M.z), r2(M.yaw), M.mode, M.silent ? 1 : 0],
      k: [bits(this.map.cassettes, 'collected'), bits(this.map.fuses, 'taken'), bits(this.map.bottles, 'taken'), bits(this.map.batteries, 'taken'), bits(this.lamps, 'taken')],
    };
  }

  // Invité : applique l'instantané de l'hôte. Son propre joueur garde sa position prédite, sauf grand écart
  applySnapshot(snap) {
    if (snap.lv !== this.level) this.loadLevel(snap.lv);
    this.state = snap.st;
    this.time = snap.tm;
    this.cassettes = snap.c;
    this.fuses = snap.f;
    this.powered = !!snap.pw;
    this.blackout = snap.bo;
    this.departT = snap.dp;
    const seen = new Set();
    for (const row of snap.p) {
      const [id, x, z, yaw, pitch, status, fl, bat, stam, inv, signal, running, moving, found, name, lamp] = row;
      seen.add(id);
      let P = this.players.find((q) => q.id === id);
      if (!P) {
        this.roster.push({ id, name });
        P = newPlayer(id, name, this.map, this.players.length);
        this.players.push(P);
      }
      const mine = id === this.localId;
      const far = Math.hypot(P.x - x, P.z - z) > 2.5;
      if (!mine || far || status !== 'alive' || P.status !== 'alive') {
        P.x = x;
        P.z = z;
      }
      if (!mine) {
        P.yaw = yaw;
        P.pitch = pitch;
        P.running = !!running;
        P.moving = !!moving;
        P.stamina = stam;
      }
      P.status = status;
      P.flashlight = !!fl;
      P.hasLamp = !!lamp;
      P.battery = bat;
      P.inv = inv ? inv.split(',') : [];
      P.signal = signal;
      P.found = found;
    }
    this.players = this.players.filter((q) => seen.has(q.id));
    const M = this.monster;
    [M.x, M.z, M.yaw, M.mode] = snap.m;
    M.silent = !!snap.m[4];
    const set = (list, k, b) => (list || []).forEach((o, i) => {
      o[k] = b[i] === '1';
    });
    set(this.map.cassettes, 'collected', snap.k[0]);
    set(this.map.fuses, 'taken', snap.k[1]);
    set(this.map.bottles, 'taken', snap.k[2]);
    set(this.map.batteries, 'taken', snap.k[3]);
    // la table compte autant de lampes que de joueurs chez l'hôte
    if (snap.k[4] !== undefined && this.table) {
      while (this.lamps.length < snap.k[4].length) this.lamps.push({ ...this.lamps[0], id: this.lamps.length, taken: false });
      set(this.lamps, 'taken', snap.k[4]);
    }
    if (this.hasMonster) this.senseMonster();
  }

  // L'ascenseur part quand plus personne n'est dehors (et qu'au moins un joueur est dedans)
  checkElevator() {
    if (this.departT > 0 || this.state !== 'playing') return;
    const alive = this.players.filter((p) => p.status === 'alive').length;
    const inside = this.players.filter((p) => p.status === 'elevator').length;
    if (alive > 0) return;
    if (inside > 0) {
      this.departT = DEPART_T;
      this.emit({ type: 'depart', level: this.level });
    } else {
      this.state = 'dead';
      this.emit({ type: 'gameover', time: this.time });
    }
  }

  arrive() {
    if (this.level >= LAST_LEVEL) {
      this.state = 'won';
      this.emit({ type: 'win', time: this.time });
      return;
    }
    this.loadLevel(this.level + 1);
    this.emit({ type: 'level', level: this.level });
  }

  // Proximité de l'entité pour chaque joueur (son, image) et cible de la traque
  senseMonster() {
    const M = this.monster;
    let target = null;
    let bestScore = Infinity;
    for (const P of this.players) {
      const dx = P.x - M.x;
      const dz = P.z - M.z;
      const dist = Math.hypot(dx, dz);
      P.mDist = dist;
      // bourdonnement : de 0 à 35 m, il monte vite quand elle est à portée ; elle se tait en embuscade
      const ratio = 1 - Math.min(1, Math.max(0, (dist - 1.2) / 32));
      P.danger = dist > 35 ? 0 : Math.pow(ratio, 1.6) * (M.silent ? 0.35 : 1);
      let diff = Math.atan2(M.x - P.x, M.z - P.z) - (P.yaw - Math.PI);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      P.pan = Math.max(-0.9, Math.min(0.9, Math.sin(diff)));
      if (P.status !== 'alive') continue;
      P.seen = hasLineOfSight(this.map, M.x, M.z, P.x, P.z);
      const score = dist - (P.seen ? 12 : 0) - (P.id === M.target ? 6 : 0);
      if (score < bestScore) {
        bestScore = score;
        target = P;
      }
    }
    const view = this.viewPlayer(this.spectate || 0);
    M.danger = view.danger;
    M.pan = view.pan;
    return target;
  }

  updateMonster() {
    const M = this.monster;
    const P = this.senseMonster();
    if (!P) return;
    M.target = P.id;
    const rage = this.rage; // 0 seul ou personne à l'abri, jusqu'à 1 quand il ne reste qu'un joueur dehors
    const dark = this.blackout > 0;
    const dx = P.x - M.x;
    const dz = P.z - M.z;
    const dist = P.mDist;
    M.distToPlayer = dist;
    M.hasLineOfSight = P.seen;

    // Détection : vue directe (moins loin lampe éteinte ; dans le noir, une lampe allumée se voit de loin),
    // bruit de course, présence rapprochée. La colère allonge tout.
    const sight = (dark ? (P.flashlight ? 28 : 7) : P.flashlight ? 24 : 15) + rage * 10;
    const hear = (dark ? 15 : 12) + rage * 8;
    const canSee = M.hasLineOfSight && dist < sight;
    const canHear = P.running && dist < hear;
    const isNearby = dist < 4 + rage * 2;

    if (M.mode === 'ambush') {
      // en embuscade, elle attend que sa proie passe tout près
      M.waitT -= DT;
      const atSpot = M.ambush && Math.hypot(M.x - M.ambush.x, M.z - M.ambush.z) < 0.6;
      if (dist < 6.5 || (M.hasLineOfSight && dist < 9)) {
        this.emit({ type: 'spotted', ambush: true });
        M.mode = 'chase';
        M.silent = false;
        M.burstT = 2;
        M.unseenT = 0;
        M.lastSeenX = P.x;
        M.lastSeenZ = P.z;
      } else if (M.waitT <= 0) {
        // personne n'est passé : elle part voir là où se trouvait sa proie
        M.mode = 'search';
        M.silent = false;
        M.ambush = null;
        M.lastSeenX = P.x;
        M.lastSeenZ = P.z;
        M.repathT = 0;
        M.ambushT = rand(14, 22) * (1 - rage * 0.5);
      } else if (atSpot) {
        M.path = [];
      }
    } else if (canSee || canHear || isNearby) {
      if (M.mode !== 'chase') this.emit({ type: 'spotted' });
      M.mode = 'chase';
      M.silent = false;
      M.unseenT = 0;
      M.lastSeenX = P.x;
      M.lastSeenZ = P.z;
    } else if (M.mode === 'chase') {
      // hors de vue : au bout de quelques secondes, le joueur l'a semée
      M.unseenT += DT;
      if (M.unseenT > LOSE_TRACK_T + rage * 4) M.mode = 'search';
    }

    // Vitesse selon le mode, la colère et le noir
    const k = 1 + rage * 0.35 + (dark ? 0.1 : 0);
    M.burstT = Math.max(0, M.burstT - DT);
    if (M.mode === 'chase') M.speed = this.monsterChaseSpeed * k * (M.burstT > 0 ? 1.15 : 1);
    else if (M.mode === 'search') M.speed = MONSTER_PATROL_SPEED * 1.3 * k;
    else if (M.mode === 'ambush') M.speed = MONSTER_PATROL_SPEED * 1.5;
    else M.speed = MONSTER_PATROL_SPEED * (1 + rage * 0.5);

    // Level 1 : en patrouille, elle contourne par les rangées d'étagères pour attendre le joueur plus loin
    if (M.mode === 'patrol' && this.map.isShelfSide) {
      M.ambushT -= DT;
      if (M.ambushT <= 0 && dist < 45) {
        const spot = this.findAmbush(P);
        M.ambushT = 4;
        if (spot) {
          M.mode = 'ambush';
          M.silent = true;
          M.ambush = spot;
          M.waitT = 14;
          M.repathT = 0;
        }
      }
    }

    // Recalcul de trajectoire
    M.repathT -= DT;
    if (M.repathT <= 0) {
      M.repathT = M.mode === 'chase' ? 0.35 : 1.2;
      let tx = P.x;
      let tz = P.z;
      if (M.mode === 'patrol') {
        if (!M.targetWander || Math.hypot(M.x - M.targetWander.x, M.z - M.targetWander.z) < 1.5) {
          // l'entité rôde : souvent non loin d'un joueur (de plus en plus quand elle s'énerve)
          const near = Math.random() < 0.5 + rage * 0.4 ? this.map.walkable.filter((c) => Math.hypot((c.x + 0.5) * CELL_SIZE - P.x, (c.z + 0.5) * CELL_SIZE - P.z) < 28 - rage * 12) : [];
          const pool = near.length ? near : this.map.walkable;
          const c = pool[Math.floor(Math.random() * pool.length)];
          M.targetWander = { x: (c.x + 0.5) * CELL_SIZE, z: (c.z + 0.5) * CELL_SIZE };
        }
        tx = M.targetWander.x;
        tz = M.targetWander.z;
      } else if (M.mode === 'search') {
        tx = M.lastSeenX;
        tz = M.lastSeenZ;
        if (Math.hypot(M.x - tx, M.z - tz) < 2) M.mode = 'patrol';
      } else if (M.mode === 'ambush') {
        tx = M.ambush.x;
        tz = M.ambush.z;
      }
      const path = findPath(this.map, M.x, M.z, tx, tz);
      if (path && path.length > 0) {
        M.path = path;
        M.pathIndex = 0;
      }
    }

    // Avancement le long du chemin
    if (M.path && M.path.length > M.pathIndex) {
      const wp = M.path[M.pathIndex];
      const wdx = wp.x - M.x;
      const wdz = wp.z - M.z;
      const wdist = Math.hypot(wdx, wdz);
      if (wdist < 0.3) M.pathIndex++;
      else {
        const stepLen = Math.min(wdist, M.speed * DT);
        M.x += (wdx / wdist) * stepLen;
        M.z += (wdz / wdist) * stepLen;
        M.yaw = Math.atan2(wdx, wdz);
      }
    } else if (M.mode === 'chase' && dist > 0.1) {
      const stepLen = Math.min(dist, M.speed * DT);
      M.x += (dx / dist) * stepLen;
      M.z += (dz / dist) * stepLen;
      M.yaw = Math.atan2(dx, dz);
    }

    // L'entité attrape le joueur
    if (dist < 1.15) {
      P.status = 'dead';
      P.moving = false;
      this.emit({ type: 'jumpscare', x: M.x, z: M.z, id: P.id });
      this.emit({ type: 'dead', id: P.id, name: P.name, time: this.time });
      M.mode = 'patrol';
      M.target = null;
      M.path = [];
      M.ambushT = 6;
    }
  }

  // Une case au bout ou le long d'une rangée d'étagères, sur la route probable du joueur et hors de sa vue
  findAmbush(P) {
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const px = P.x + fx * 10;
    const pz = P.z + fz * 10;
    let best = null;
    let bestD = Infinity;
    for (const c of this.map.walkable) {
      const x = (c.x + 0.5) * CELL_SIZE;
      const z = (c.z + 0.5) * CELL_SIZE;
      const dp = Math.hypot(x - px, z - pz);
      if (dp > 8 || dp >= bestD) continue;
      if (Math.hypot(x - P.x, z - P.z) < 7) continue;
      if (!this.map.isShelfSide(c.x, c.z)) continue;
      if (hasLineOfSight(this.map, P.x, P.z, x, z)) continue;
      best = { x, z, gx: c.x, gz: c.z };
      bestD = dp;
    }
    return best;
  }
}
