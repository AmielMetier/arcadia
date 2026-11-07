// The Backrooms - Moteur de simulation (60 Hz), sans DOM
// Plusieurs joueurs possibles (l'hôte fait autorité). Deux niveaux :
//   Level 0 : deux étages superposés (on tombe par les trous du haut, on remonte par les escaliers). 5 cassettes
//             VHS réparties entre les étages ; un ascenseur à chaque étage, mais un seul est le vrai : quand les 5
//             cassettes sont trouvées, le faux se referme en mur et le vrai s'ouvre.
//   Level 1 : l'entrepôt ; 3 fusibles à rapporter au panneau du monte-charge, des coupures de courant, et l'entité
//             qui se cache au bout des rangées d'étagères pour tendre des embuscades.
//   Level 37 (numéro interne 2) : les Poolrooms (engine/poolrooms.js) ; 3 volants de vanne, puis trois toboggans.
//   Level 2 (numéro interne 3, derrière le toboggan jaune des Poolrooms) : les galeries de service ; 4 vannes à
//             tourner (rester devant) pour couper la vapeur qui bloque l'ascenseur de service, des jets de vapeur
//             brûlante en travers des couloirs (ils repoussent). Pas d'entité ici : un troupeau de chèvres noires qui
//             fonce sur les joueurs, mais craint la lumière (engine/goats.js).
// Le rythme est réglé par le directeur de tension (engine/director.js) : montée, pic, relâche, fausses alertes.
// L'entité voit dans un cône et entend le bruit qu'on fait (marcher, courir, tomber, ramasser) ; accroupi, on ne fait
// presque aucun bruit. Sa première prise n'est pas mortelle : on se débat, ou un coéquipier l'aveugle à la lampe.
// Qui entre dans l'ascenseur ouvert devient spectateur ; il part quand plus personne n'est dehors. Plus il y a de
// monde dans la cabine, plus l'entité s'énerve contre ceux qui restent.
// Chacun part avec sa lampe torche dans la case 1. Un joueur attrapé regarde les autres jusqu'à la fin de l'étage ;
// si l'équipe le termine, tout le monde repart à l'étage suivant, lampe en main.
import { CELL_SIZE, T, createLevel0, PIT_HALF, FLOOR_DY, bfs } from './map.js';
import { createWarehouseMap } from './level1.js';
import { createPoolMap, MOUTH } from './poolrooms.js';
import { createPipesMap, VALVES, PIPES_LEVEL, jetState, inJet, JET_HALF } from './level2.js';
import { findPath, hasLineOfSight } from './nav.js';
import { createGoats, updateGoats, senseGoats, alertGoats, goatSnapshot, applyGoatSnapshot, goatCount } from './goats.js';
import { createDirector, updateDirector, blackoutAllowed, entityRelaxed, updateLightsOut } from './director.js';
import { placeHides, HIDE_R, LOCKER_R, BREATH_HOLD, BREATH_BACK, hideInside, hideFront } from './hides.js';

export const DT = 1 / 60;
export const PLAYER_RADIUS = 0.38;
// On avance lentement dans les Backrooms : la carte est immense et chaque pas compte
export const WALK_SPEED = 2.1;
export const SPRINT_SPEED = 3.7;
export const MONSTER_PATROL_SPEED = 1.8;
export const MONSTER_CHASE_SPEED = 3.3; // plus vite qu'en marchant, un peu moins qu'en sprintant
export const CROUCH_SPEED = 0.5; // accroupi : moitié moins vite, presque sans bruit
export const STAMINA_DRAIN = 15; // par seconde de course
export const STAMINA_REGEN = 9;
export const WINDED_T = 1; // à bout de souffle : une seconde sans pouvoir courir
export const LOSE_TRACK_T = 4; // secondes sans voir le joueur avant que l'entité ne le perde
export const BATTERY_DRAIN = 0.42; // % par seconde de lampe allumée (environ 4 minutes pour une pile pleine)
export const BATTERY_PACK = 60; // % rendus par une pile utilisée
export const INV_SIZE = 2; // cases d'objets (piles, eau d'amande, échelle) : la case 1 de l'inventaire est réservée à la lampe
export const PICK_R = 1.4; // portée de F pour ramasser
export const ALMOND_STAMINA = 50; // l'eau d'amande rend la moitié du souffle (plus un bouton « fin de poursuite »)
export const BLACKOUT_DRAIN = 1.5; // dans le noir d'une coupure, la lampe tire plus fort sur la pile
export const SIGNAL_RANGE = 25; // m : au-delà, le caméscope ne capte plus rien
// La prise : la première fois par niveau, l'entité agrippe au lieu de tuer. On se débat (GRAB_STRUGGLES appuis) ou un
// coéquipier lui braque sa lampe dans les yeux ; sinon, au bout de GRAB_T, c'est fini. Lâchée, elle reste sonnée.
export const GRAB_T = 2.6;
export const GRAB_STRUGGLES = 8;
export const MONSTER_STUN_T = 3;
// le bruit qu'on fait (0 à 1+) : il porte jusqu'à NOISE_RANGE × bruit mètres (moins à travers les murs)
export const NOISE = { walk: 0.32, run: 1, crouch: 0, pick: 0.45, winded: 0.4, fall: 1.6, breath: 0.12, panic: 0.3, gasp: 1.2 };
export const NOISE_RANGE = 13;
export const VISION_CONE = 0.96; // demi-angle du regard de l'entité (55°) ; tout près, elle sent qu'on est là
export const DORMANT_T = 60; // au tout début, l'entité reste au loin une minute (on apprend à se déplacer)
export const PANEL_T = 4; // Level 1 : secondes devant le panneau du monte-charge pour le relancer (bruyant)
// Barre d'équilibre : sur une arête entre deux trous, on n'avance que tout droit et le corps tangue ; Q et D
// corrigent. tilt va de -1 (penché à gauche) à 1 (à droite) : au bout, on tombe dans le trou de ce côté.
export const BEAM_SPEED = 0.65; // vitesse de marche sur une arête (part de la marche normale)
export const BEAM_UNSTABLE = 4; // plus on penche, plus on penche
export const BEAM_NOISE = [10, 16]; // à-coups au hasard (immobile, en marchant)
export const BEAM_FIX = 4.5; // force de Q / D
export const BEAM_DAMP = 2.5;
export const FALL_LOCK = 2.2; // secondes à terre après une chute d'un étage (plus d'une seconde de chute, puis sonné)
export const WHISTLE_CD = 1.2;
export const WHISTLE_HEAT = 2.5; // chaque coup compte 1 et s'oublie en 20 s : au 3e coup rapproché, l'entité vient à coup sûr
export const CASSETTES = 5;
export const FUSES = 3;
export { VALVES, PIPES_LEVEL };
export const LAST_LEVEL = PIPES_LEVEL; // 0 : Level 0, 1 : Level 1 (entrepôt), 2 : Level 37 (Poolrooms), 3 : Level 2 (Tuyauteries, par le toboggan jaune)
export const VALVE_T = 6.5; // secondes devant une vanne pour la fermer (elle revient doucement si on la lâche) : on s'expose
export const VALVE_R = 1.5; // portée : il faut se tenir devant
export const BREAKER_T = 4.5; // secondes devant un disjoncteur pour le réarmer
export const BREAKER_R = 1.4;
export const BLOW_DELAY = 2.2; // la vanne fermée, les néons de son secteur grésillent puis sautent
export const BURN_LOCK = 0.9; // brûlé par un jet de vapeur : repoussé, sonné un instant
export const BURN_STAMINA = 45;
export const DEPART_T = 3; // secondes entre la fermeture des portes et l'arrivée
// coupures de courant du Level 1 : toutes les 45 à 80 s (et seulement après un moment de calme), pendant 15 à 20 s
export const BLACKOUT_EVERY = [45, 80];
export const BLACKOUT_LEN = [15, 20];
// Level 2 : de temps en temps, tout le courant saute ; plus rien ne protège, le troupeau passe à l'attaque
export const PIPES_BLACKOUT_EVERY = [85, 130];
export const PIPES_BLACKOUT_LEN = [11, 15];

const rand = (a, b) => a + Math.random() * (b - a);
const cellOf = (v) => Math.floor(v / CELL_SIZE);
// un tirage qui ne dépend que de la graine (hôte et invités tirent pareil)
const hashRnd = (...k) => {
  let h = 2166136261;
  for (const v of k) h = Math.imul(h ^ (v | 0), 16777619) ^ (h >>> 13);
  return ((h >>> 0) % 100000) / 100000;
};
// part des piles et de l'eau d'amande gardée selon le nombre de joueurs (le reste n'est jamais là)
const KEEP_ITEMS = [0.6, 0.6, 0.72, 0.82, 0.9];

// les étages d'un niveau : même graine de partie, des cartes différentes par niveau
export function makeLevelMap(level, seed) {
  if (level === 2) return [createPoolMap(seed * 11 + 37)];
  if (level === PIPES_LEVEL) return [createPipesMap(seed * 11 + 29)];
  return level === 1 ? [createWarehouseMap(seed * 7 + 13)] : createLevel0(seed).floors;
}

// Départ du Level 0 à plusieurs : chacun dans son coin du dédale, à 4 à 8 cases de marche du départ (pas en vue des
// autres, mais assez près pour s'entendre siffler), au moins 3 cases entre deux joueurs. Le tirage ne dépend que de la
// carte : l'hôte et les invités placent tout le monde au même endroit.
export function spreadSpawns(map, n) {
  const spots = [{ x: map.spawn.x, z: map.spawn.z }];
  if (!map.dist || !map.walkable || n < 2) return spots;
  const W = map.W;
  const near = (c, list, d) => list.some((o) => Math.abs((o.gx ?? o.x) - c.x) < d && Math.abs((o.gz ?? o.z) - c.z) < d);
  const pitAt = (c) => (map.pitAt ? map.pitAt(c.x, c.z) >= 0 : false);
  const free = (c) =>
    !pitAt(c) &&
    !near(c, map.stairs || [], 2) &&
    !(map.props || []).some((p) => Math.hypot(p.x - (c.x + 0.5) * CELL_SIZE, p.z - (c.z + 0.5) * CELL_SIZE) < p.r + 0.6);
  const hash = (c) => (((c.x * 73856093) ^ (c.z * 19349663) ^ (map.spawn.gx * 83492791)) >>> 0) % 1000;
  const cand = map.walkable.filter((c) => {
    const d = map.dist[c.z * W + c.x];
    return d >= 4 && d <= 8 && Math.hypot(c.x - map.spawn.gx, c.z - map.spawn.gz) * CELL_SIZE < 22 && free(c);
  }).sort((a, b) => hash(a) - hash(b));
  const taken = [{ x: map.spawn.gx, z: map.spawn.gz }];
  for (const c of cand) {
    if (spots.length >= n) break;
    if (taken.some((t) => Math.abs(t.x - c.x) + Math.abs(t.z - c.z) < 3)) continue;
    taken.push(c);
    spots.push({ x: (c.x + 0.5) * CELL_SIZE, z: (c.z + 0.5) * CELL_SIZE });
  }
  return spots;
}

// Où en est-on dans un escalier coudé ? u : le long des volées (0 à 3 cases), v : en travers (0 à 2 cases) ;
// lane : 'A' (première volée, v < 1 case), 'B' (seconde volée) ou 'L' (palier, u > 2 cases) ;
// h : la hauteur, de 0 (en bas) à 1 (en haut) ; t : comme h. null : pas dans un escalier
export function stairLocal(st, x, z) {
  const ex = x - st.ox;
  const ez = z - st.oz;
  return { u: ex * st.dx + ez * st.dz, v: ex * st.px + ez * st.pz };
}
export function stairHeight(u, v) {
  const C = CELL_SIZE;
  if (u >= 2 * C) return 0.5;
  const f = Math.max(0, u) / (2 * C);
  return v < C ? f * 0.5 : 1 - f * 0.5;
}
export function stairAt(stairs, x, z) {
  const C = CELL_SIZE;
  for (const st of stairs || []) {
    const { u, v } = stairLocal(st, x, z);
    if (u < 0 || u > 3 * C || v < 0 || v > 2 * C) continue;
    const h = stairHeight(u, v);
    return { st, u, v, h, t: h, lane: u >= 2 * C ? 'L' : v < C ? 'A' : 'B' };
  }
  return null;
}

// Hauteur des pieds (0 : sol de l'étage du haut, -FLOOR_DY : sol du bas) ; dans l'escalier, elle suit les marches
export function feetY(stairs, x, z, floor) {
  const s = stairAt(stairs, x, z);
  return s ? -FLOOR_DY + s.h * FLOOR_DY : -(floor || 0) * FLOOR_DY;
}

function newPlayer(id, name, map, i) {
  // les joueurs arrivent côte à côte autour du départ
  const off = [[0, 0], [0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7], [0.7, 0.7]][i % 6];
  return {
    id,
    name,
    floor: 0, // étage (0 : en haut, 1 : en bas)
    x: map.spawn.x + off[0],
    z: map.spawn.z + off[1],
    yaw: 0,
    pitch: 0,
    stamina: 100, // 0 à 100
    winded: 0, // secondes avant de pouvoir recourir, une fois à bout de souffle
    running: false,
    flashlight: false,
    hasLamp: true, // lampe torche, toujours dans la case 1
    bottles: 0,
    battery: 100, // pile de la lampe torche (0 à 100)
    inv: [null, null], // cases 2 et 3 de l'inventaire : 'battery', 'bottle', 'ladder' ou null
    sel: 1, // case choisie (1 ou 2 ; la case 0, c'est la lampe) : E l'utilise, F l'échange contre un objet au sol
    lockT: 0, // immobile un instant (après une chute, dans l'escalier)
    onBeam: false, // sur une arête entre deux trous
    tilt: 0, // équilibre (-1 à 1)
    tiltV: 0,
    onLadder: false, // en haut de l'échelle (la caméra monte)
    whistleCd: 0,
    burnT: 0, // brûlé il y a peu (Level 2) : le jet ne repousse pas deux fois de suite
    heat: 0, // coups de sifflet récents : trop, et l'entité vient
    signal: 0, // 0 à 1 : force du signal de l'objectif le plus proche (affiché par la caméra)
    sigTo: 'goal', // ce que suit le signal : 'goal', 'stairs' ou 'exit'
    moving: false,
    status: 'alive', // 'alive' | 'elevator' (à l'abri, spectateur) | 'dead' (spectateur)
    danger: 0, // 0 à 1 : proximité de l'entité, pour ce joueur (son, image)
    pan: 0,
    found: 0, // objets d'objectif trouvés (cassettes, fusibles)
    crouch: false, // accroupi (C / Ctrl) : lent et silencieux
    noise: 0, // bruit fait à l'instant (0 à 1+) : ce que l'entité peut entendre
    grabT: 0, // agrippé par l'entité : secondes avant la fin
    grabs: 0, // prises déjà subies à ce niveau (la deuxième est mortelle)
    struggle: 0, // appuis pour se débattre
    hurt: 0, // coups de chèvre encaissés à ce niveau (le deuxième est mortel)
    hidden: -1, // casier où l'on est caché (-1 : dehors)
    breath: 100, // souffle retenu dans un casier (0 à 100)
    holding: false, // souffle retenu en ce moment
    carry: [], // Level 1 : fusibles en poche (leurs numéros), à rapporter au panneau
  };
}

export class BackroomsSim {
  // players : [{ id, name }] (le premier est l'hôte) ; localId : le joueur de cet écran
  // map : une carte d'un seul étage (tests) ; sinon le niveau est généré à partir de la graine
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
    this.chases = 0; // poursuites de toute la partie : la toute première est plus clémente
    this.loadLevel(level, map ? [map] : null);
  }

  // Installe un niveau : nouveaux étages, joueurs au départ (les morts reviennent), entité au loin
  loadLevel(level, floors = null) {
    const prev = this.players || [];
    this.level = level;
    const generated = !floors;
    this.floors = floors || makeLevelMap(level, this.seed);
    this.map = this.floors[0];
    // moins de piles et d'eau d'amande quand on est peu nombreux (toujours les mêmes, chez tout le monde)
    if (generated) {
      const keep = KEEP_ITEMS[Math.min(KEEP_ITEMS.length - 1, this.roster.length)];
      this.floors.forEach((f, fi) => {
        for (const it of f.items || []) if ((it.kind === 'battery' || it.kind === 'bottle') && hashRnd(this.seed, level, fi, it.id, 3) > keep) it.taken = true;
      });
    }
    // des casiers où se cacher (entrepôt, galeries de service)
    if ((level === 1 || level === PIPES_LEVEL) && !this.map.hides) this.map.hides = placeHides(this.map, level === 1 ? 5 : 6, this.seed * 31 + level);
    this.stairs = this.map.stairs || [];
    // au début de la partie, chacun part de son côté ; aux étages suivants, tout le monde sort ensemble de l'ascenseur
    const spots = level === 0 && !prev.length ? spreadSpawns(this.map, this.roster.length) : [];
    this.players = this.roster.map((r, i) => {
      const P = newPlayer(r.id, r.name, this.map, i);
      if (spots[i]) {
        P.x = spots[i].x;
        P.z = spots[i].z;
      }
      const old = prev.find((p) => p.id === r.id);
      if (old) {
        // on garde son inventaire, sa pile et ses trouvailles d'un étage à l'autre
        P.inv = old.inv;
        P.sel = old.sel;
        P.battery = old.battery;
        P.bottles = old.bottles;
        P.found = old.found;
        P.yaw = old.yaw;
      }
      // tout le monde part avec sa lampe torche, allumée, dans la case 1 (ceux qui étaient tombés en reçoivent une)
      P.hasLamp = true;
      P.flashlight = !old || old.flashlight || old.status !== 'alive';
      // Level 1 : tout le monde sort ensemble de l'ascenseur d'arrivée, dos à ses portes
      const A = this.map.arrival;
      if (A) {
        const side = [0, 0.65, -0.65, 0.33, -0.33, 0][i % 6];
        const back = [0.5, 0.5, 0.5, -0.2, -0.2, -0.45][i % 6];
        P.x = this.map.spawn.x + A.dx * back - A.dz * side;
        P.z = this.map.spawn.z + A.dz * back + A.dx * side;
        P.yaw = Math.atan2(A.dx, A.dz);
        P.pitch = 0;
      }
      return P;
    });
    this.cassettes = 0; // cassettes trouvées par l'équipe (Level 0)
    this.fuses = 0; // fusibles ramassés (Level 1 ; aux Poolrooms, les volants)
    this.delivered = 0; // Level 1 : fusibles rapportés au panneau
    this.valves = 0; // vannes fermées (Level 2)
    this.items0 = this.floors.map((f) => (f.items || []).length); // objets d'origine (les suivants ont été posés par des joueurs)
    // un seul vrai ascenseur : on ne sait pas lequel tant que les cassettes ne sont pas toutes trouvées
    this.realFloor = this.floors.length > 1 ? (hashRnd(this.seed, level, 7) < 0.5 ? 0 : 1) : 0;
    this.unlocked = false;
    this.powered = false; // panneau du monte-charge réalimenté (aux Poolrooms : les 3 volants trouvés)
    this.slide = -1; // Poolrooms : le toboggan pris par le premier qui s'y est glissé (les autres le suivent)
    this.departT = 0; // compte à rebours du départ de l'ascenseur
    this.panel = 0; // Level 1 : avancée du redémarrage du monte-charge (0 à 1)
    this.panelNoiseT = 0;
    this.director = createDirector(level);
    this.lightsOut = null;
    this.blackout = 0; // secondes de noir restantes
    this.nextBlackout = level === 1 ? rand(...BLACKOUT_EVERY) * 0.6 : level === PIPES_LEVEL && this.hasMonster ? rand(...PIPES_BLACKOUT_EVERY) * 0.75 : Infinity;

    const ms = this.map.monsterSpawn;
    this.monster = {
      floor: 0,
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
      stairT: 0, // dans l'escalier
      stalkT: 4, // délai avant d'aller se cacher pour observer
      watch: null, // case sombre d'où elle observe
      // au tout début de la partie, elle reste au loin une minute : on apprend à se déplacer
      dormantT: level === 0 && !this.time ? DORMANT_T * (this.difficulty === 'hard' ? 0.75 : 1) : 0,
      flees: 0, // fuites devant la lampe : à la troisième, elle ne fuit plus
      escapes: [], // là où on l'a semée : elle s'en souvient pour ses embuscades
      stunT: 0, // sonnée (aveuglée, ou après avoir lâché sa prise)
      grabbing: null, // le joueur qu'elle agrippe
      faceT: 0, // depuis combien de temps un joueur la regarde en face, de près
      rushT: 0, // découverte nez à nez : elle hurle et fonce (secondes de charge)
      warpT: 25, // Level 0 : délai avant sa prochaine apparition « trichée » (quand personne ne la voit)
      unseenAllT: 0, // depuis combien de temps aucun joueur ne l'a dans son champ de vision
      edgeT: 0, // sa proie s'est réfugiée dans la lumière : elle hésite au bord
      lurk: false, // postée là où on va tomber sur elle (après une apparition)
      vanish: false, // elle a fini d'observer : dès que personne ne la regarde, elle disparaît
      sawHide: -1, // le casier où elle a vu quelqu'un entrer
    };
    // Level 2 : le troupeau remplace l'entité (elle reste là pour relayer le son et l'image de la chèvre la plus proche)
    this.goats = level === PIPES_LEVEL && this.hasMonster ? createGoats(this.map, goatCount(this.roster.length, this.difficulty)) : null;
    this.herd = null;
  }

  // dans l'eau (Poolrooms) on avance moins vite : 90 % dans 20 cm d'eau, 70 % dans 60 cm, 40 % au plus profond
  wade(P) {
    const m = this.fm(P.floor);
    const d = m.depthAt ? m.depthAt(P.x, P.z) : 0;
    return d > 0 ? Math.max(0.4, 1 - d * 0.55) : 1;
  }

  // la carte d'un étage
  fm(floor) {
    return this.floors[floor] || this.floors[0];
  }

  // toutes les cassettes, des deux étages, dans l'ordre de leur numéro
  get allCassettes() {
    return this.floors.flatMap((f) => f.cassettes || []).sort((a, b) => a.id - b.id);
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
    if (this.level === PIPES_LEVEL) return this.valves >= VALVES;
    return this.level === 0 ? this.cassettes >= CASSETTES : this.powered;
  }

  // Level 2 : un jet de vapeur au repos (0), qui siffle (1) ou qui crache (2) ; sa vanne fermée, il se tait
  jetOn(j) {
    const v = (this.map.valves || [])[j.sector];
    if (v && v.closed) return 0;
    return jetState(j, this.time);
  }

  // le jet qui crache au point (x, z), ou null
  steamAt(x, z) {
    const j = this.map.jetAt ? this.map.jetAt(cellOf(x), cellOf(z)) : null;
    return j && this.jetOn(j) === 2 && inJet(j, x, z) ? j : null;
  }

  // Brûlé : on est rejeté du côté d'où l'on venait, sonné et le souffle coupé
  burn(P, j) {
    const C = CELL_SIZE;
    const pos = j.axis === 'x' ? P.x : P.z;
    const mid = j.axis === 'x' ? j.x : j.z;
    let dir = Math.sign(pos - mid);
    if (!dir) dir = j.axis === 'x' ? -Math.sign(-Math.sin(P.yaw)) || 1 : -Math.sign(-Math.cos(P.yaw)) || 1;
    const to = Math.max((j.axis === 'x' ? j.gx : j.gz) * C - C * 0.4, Math.min((j.axis === 'x' ? j.gx + 1 : j.gz + 1) * C + C * 0.4, mid + dir * (JET_HALF + 0.5)));
    const p = this.moveWithCollisions(P.x, P.z, j.axis === 'x' ? to - P.x : 0, j.axis === 'x' ? 0 : to - P.z, PLAYER_RADIUS, P.floor);
    P.x = p.x;
    P.z = p.z;
    P.lockT = BURN_LOCK;
    P.burnT = 1.6;
    P.running = false;
    P.stamina = Math.max(0, P.stamina - BURN_STAMINA);
  }

  // un grand bruit (cri, vanne qui claque) : l'entité vient voir, si elle est assez près et pas déjà en chasse
  alertMonster(x, z, range, floor = 0) {
    if (this.goats) {
      alertGoats(this, x, z, range);
      return true;
    }
    const M = this.monster;
    if (!this.hasMonster || M.mode === 'chase' || M.floor !== floor) return false;
    if (Math.hypot(M.x - x, M.z - z) > range) return false;
    M.mode = 'search';
    M.silent = false;
    M.ambush = null;
    M.watch = null;
    M.lastSeenX = x;
    M.lastSeenZ = z;
    M.probe = null;
    M.repathT = 0;
    return true;
  }

  // Les vannes : on les ferme en restant devant (à plusieurs, plus vite) ; lâchées, elles se rouvrent doucement.
  // Une vanne qui claque résonne dans tous les tuyaux : l'entité vient voir.
  updateValves() {
    for (const v of this.map.valves || []) {
      if (v.closed) continue;
      const near = this.players.filter((P) => P.status === 'alive' && P.hidden < 0 && Math.hypot(v.sx - P.x, v.sz - P.z) < VALVE_R);
      if (near.length) {
        if (v.turn === 0) this.emit({ type: 'valveStart', id: v.id, by: near[0].id });
        for (const P of near) this.makeNoise(P, 0.55, 0.3);
        v.turn = Math.min(1, v.turn + (DT / VALVE_T) * (near.length > 1 ? 1.5 : 1));
      } else v.turn = Math.max(0, v.turn - DT * 0.18);
      if (v.turn < 1) continue;
      v.closed = true;
      this.valves++;
      v.blowT = BLOW_DELAY;
      this.setSector(v.id, 1);
      near[0].found++;
      this.emit({ type: 'valve', id: v.id, by: near[0].id, count: this.valves, total: VALVES, x: v.x, z: v.z });
      this.alertMonster(v.sx, v.sz, 60);
      if (this.valves >= VALVES) this.emit({ type: 'exitUnlocked' });
    }
  }

  // Le courant d'un secteur du Level 2 (power : 0 normal, 1 les néons grésillent, 2 ils ont sauté, 3 réarmé). Les
  // lampes gardent leur état d'origine (base) ; les chèvres et l'image relisent l'éclairage (map.lightGen)
  setSector(i, power) {
    const map = this.map;
    const v = (map.valves || [])[i];
    if (!v || v.power === power) return;
    v.power = power;
    for (const l of map.lights) {
      if (l.sector !== i || l.base === 'off') continue;
      l.state = power === 1 ? 'flicker' : power === 2 ? 'off' : l.base;
      l.flicker = l.state === 'flicker';
    }
    map.goatLit = null;
    map.darkCells = null;
    map.lightGen = (map.lightGen || 0) + 1;
  }

  // Les néons qui sautent après une vanne, et les disjoncteurs : on reste devant pour réarmer (à plusieurs, plus vite).
  // Le claquement s'entend loin : le troupeau vient voir.
  updateBreakers() {
    const map = this.map;
    for (const v of map.valves || []) {
      if (!(v.blowT > 0)) continue;
      v.blowT -= DT;
      if (v.blowT > 0) continue;
      this.setSector(v.id, 2);
      this.emit({ type: 'blowout', sector: v.id, x: v.x, z: v.z });
    }
    for (const b of map.breakers || []) {
      const v = map.valves[b.sector];
      if (b.done || !v || v.power !== 2) continue;
      const near = this.players.filter((P) => P.status === 'alive' && P.hidden < 0 && Math.hypot(b.sx - P.x, b.sz - P.z) < BREAKER_R);
      if (near.length) {
        if (b.turn === 0) this.emit({ type: 'breakerStart', id: b.id, by: near[0].id });
        b.turn = Math.min(1, b.turn + (DT / BREAKER_T) * (near.length > 1 ? 1.5 : 1));
      } else b.turn = Math.max(0, b.turn - DT * 0.25);
      if (b.turn < 1) continue;
      b.done = true;
      this.setSector(b.sector, 3);
      this.emit({ type: 'breaker', id: b.id, sector: b.sector, by: near[0].id, x: b.x, z: b.z });
      this.alertMonster(b.x, b.z, 24);
    }
  }

  // agressivité de l'entité (0 à 1) : elle monte à chaque cassette trouvée (Level 0), à chaque fusible (Level 1, où elle
  // part déjà plus haut)
  get aggro() {
    if (this.level === 0) return Math.min(1, this.cassettes / CASSETTES);
    if (this.level === PIPES_LEVEL) return Math.min(1, 0.3 + (0.7 * this.valves) / VALVES);
    return Math.min(1, 0.25 + (0.75 * (this.fuses + (this.powered ? FUSES : 0))) / FUSES);
  }

  // part de l'équipe déjà à l'abri dans l'ascenseur (0 à 1) : l'entité devient plus agressive
  get rage() {
    // tous les autres sont dans la cabine : 1
    const n = this.players.length;
    return n > 1 ? Math.min(1, this.players.filter((p) => p.status === 'elevator').length / (n - 1)) : 0;
  }

  emit(ev) {
    this.events.push(ev);
  }

  drainEvents() {
    const list = this.events;
    this.events = [];
    return list;
  }

  // Toutes les cassettes trouvées : le faux ascenseur se referme en mur (on ne le sait qu'en arrivant devant)
  unlockLevel0() {
    this.unlocked = true;
    for (let f = 0; f < this.floors.length; f++) {
      const E = this.floors[f].elevator;
      if (E) E.fake = f !== this.realFloor;
    }
  }

  // Déplacement avec glissement contre les murs
  moveWithCollisions(px, pz, dx, dz, radius = PLAYER_RADIUS, floor = 0) {
    let nextX = px + dx;
    let nextZ = pz + dz;
    if (this.isColliding(nextX, pz, radius, floor)) nextX = px;
    if (this.isColliding(nextX, nextZ, radius, floor)) nextZ = pz;
    return { x: nextX, z: nextZ };
  }

  // la cabine de l'ascenseur se traverse seulement quand il est ouvert (et que c'est le vrai)
  blocked(gx, gz, floor = 0) {
    const m = this.fm(floor);
    if (!m.isWall(gx, gz)) return false;
    return !(this.open && m.grid[gz * m.W + gx] === T.EXIT && !(m.elevator && m.elevator.fake));
  }

  isColliding(x, z, radius, floor = 0) {
    // Poolrooms : cloisons minces entre les salles et colonnes
    const cm = this.fm(floor);
    if (cm.collide && cm.collide(x, z, radius)) return true;
    const minGx = cellOf(x - radius);
    const maxGx = cellOf(x + radius);
    const minGz = cellOf(z - radius);
    const maxGz = cellOf(z + radius);
    for (let gz = minGz; gz <= maxGz; gz++) {
      for (let gx = minGx; gx <= maxGx; gx++) {
        if (!this.blocked(gx, gz, floor)) continue;
        // un pilier fin : sa vraie forme (carré ou rond), pas toute la case
        const fm = this.fm(floor);
        const pl = fm.pillarAt && fm.pillarAt(gx, gz);
        if (pl) {
          const ex = Math.max(0, Math.abs(x - pl.x) - pl.h);
          const ez = Math.max(0, Math.abs(z - pl.z) - pl.h);
          if (pl.round ? Math.hypot(x - pl.x, z - pl.z) < pl.h + radius : ex * ex + ez * ez < radius * radius) return true;
          continue;
        }
        const closestX = Math.max(gx * CELL_SIZE, Math.min(x, (gx + 1) * CELL_SIZE));
        const closestZ = Math.max(gz * CELL_SIZE, Math.min(z, (gz + 1) * CELL_SIZE));
        if ((x - closestX) ** 2 + (z - closestZ) ** 2 < radius * radius) return true;
      }
    }
    // caisses et meubles abandonnés (cercles)
    for (const pr of this.fm(floor).props || []) {
      if (pr.walk) continue; // papiers, canettes : on marche dessus
      const rr = radius + pr.r;
      if (Math.abs(pr.x - x) < rr && Math.abs(pr.z - z) < rr && (pr.x - x) ** 2 + (pr.z - z) ** 2 < rr * rr) return true;
    }
    // les casiers
    for (const h of this.fm(floor).hides || []) if (Math.hypot(h.x - x, h.z - z) < radius + LOCKER_R) return true;
    return false;
  }

  // un bruit bref (ramasser, tomber, siffler, suffoquer) : il s'ajoute au bruit de la marche pendant t secondes
  makeNoise(P, v, t = 1) {
    if (v >= (P.bumpV || 0) || !(P.bumpT > 0)) {
      P.bumpV = v;
      P.bumpT = t;
    }
  }

  // le joueur meurt : ce qu'il portait tombe là où il est (Level 1 : les fusibles), il sort de son casier
  killPlayer(P, extra = {}) {
    if (P.status !== 'alive') return;
    P.status = 'dead';
    P.moving = false;
    P.grabT = 0;
    if (P.hidden >= 0) {
      const h = (this.fm(P.floor).hides || [])[P.hidden];
      if (h) h.by = -1;
      P.hidden = -1;
    }
    this.dropCarry(P);
    this.emit({ type: 'jumpscare', x: extra.x ?? P.x, z: extra.z ?? P.z, id: P.id, goat: !!extra.goat });
    this.emit({ type: 'dead', id: P.id, name: P.name, time: this.time });
  }

  // Level 1 : les fusibles en poche tombent par terre (on peut aller les rechercher)
  dropCarry(P) {
    if (!P.carry || !P.carry.length) return;
    const map = this.fm(P.floor);
    P.carry.forEach((id, i) => {
      const f = map.fuses[id];
      if (!f) return;
      const a = (i / Math.max(1, P.carry.length)) * Math.PI * 2;
      let x = P.x + Math.cos(a) * 0.5;
      let z = P.z + Math.sin(a) * 0.5;
      if (this.isColliding(x, z, 0.2, P.floor)) {
        x = P.x;
        z = P.z;
      }
      f.x = x;
      f.z = z;
      f.gx = cellOf(x);
      f.gz = cellOf(z);
      f.taken = false;
    });
    this.fuses = Math.max(0, this.fuses - P.carry.length);
    this.emit({ type: 'fuseDrop', id: P.id, name: P.name, n: P.carry.length, x: P.x, z: P.z });
    P.carry = [];
  }

  // le casier le plus proche à portée de F (et libre), ou null
  nearHide(P) {
    let best = null;
    let bd = HIDE_R;
    for (const h of this.fm(P.floor).hides || []) {
      const f = hideFront(h);
      const d = Math.hypot(f.x - P.x, f.z - P.z);
      if (d < bd && (h.by < 0 || h.by === P.id)) {
        bd = d;
        best = h;
      }
    }
    return best;
  }

  // s'enfermer dans un casier : l'entité qui t'a vu entrer saura où chercher
  enterHide(P, h) {
    h.by = P.id;
    P.hidden = h.id;
    const p = hideInside(h);
    P.x = p.x;
    P.z = p.z;
    P.yaw = p.yaw;
    P.pitch = 0;
    P.flashlight = false;
    P.crouch = false;
    P.running = false;
    P.moving = false;
    P.breath = 100;
    P.holding = false;
    const M = this.monster;
    if (this.hasMonster && !this.goats && M.floor === (P.floor || 0) && Math.hypot(M.x - P.x, M.z - P.z) < 22 && this.inCone(M, P.x, P.z) && hasLineOfSight(this.fm(M.floor), M.x, M.z, h.x + h.dx, h.z + h.dz)) M.sawHide = h.id;
    this.emit({ type: 'hide', id: P.id, on: true, x: h.x, z: h.z });
  }

  leaveHide(P) {
    const h = (this.fm(P.floor).hides || [])[P.hidden];
    P.hidden = -1;
    P.holding = false;
    if (!h) return;
    h.by = -1;
    const f = hideFront(h);
    P.x = f.x;
    P.z = f.z;
    this.emit({ type: 'hide', id: P.id, on: false, x: h.x, z: h.z });
  }

  // le point (x, z) est-il dans le champ de vision de l'entité ?
  inCone(M, x, z) {
    return Math.abs(this.angleTo(M, x, z)) < VISION_CONE;
  }

  // Boire l'eau d'amande (souffle au maximum), changer la pile de la lampe, poser l'échelle
  useItem(P, i) {
    const kind = P.inv[i];
    if (!kind) return this.emit({ type: 'emptySlot', id: P.id });
    if (kind === 'ladder') {
      // l'échelle se pose sous le renfoncement de la cassette
      const N = this.fm(P.floor).niche;
      if (!N || N.ladder || Math.hypot(N.baseX - P.x, N.baseZ - P.z) > 2.2) return this.emit({ type: 'ladderFar', id: P.id });
      N.ladder = true;
      P.inv[i] = null;
      return this.emit({ type: 'ladderPlaced', id: P.id });
    }
    if (kind === 'bottle') {
      if (P.stamina >= 100) return this.emit({ type: 'useless', kind, id: P.id });
      P.stamina = Math.min(100, P.stamina + ALMOND_STAMINA);
      P.winded = 0;
      P.bottles++;
    } else {
      if (P.battery >= 100) return this.emit({ type: 'useless', kind, id: P.id });
      P.battery = Math.min(100, P.battery + BATTERY_PACK);
    }
    P.inv[i] = null;
    this.emit({ type: kind, used: true, id: P.id });
  }

  // F : ramasser l'objet le plus proche (dans une case vide, sinon échangé avec la case choisie)
  pickUp(P) {
    // dans un casier : F en ressort ; devant un casier (sans objet plus près) : on s'y enferme
    if (P.hidden >= 0) return this.leaveHide(P);
    const it = this.nearItem(P);
    const h = this.nearHide(P);
    if (h && (!it || Math.hypot(hideFront(h).x - P.x, hideFront(h).z - P.z) < Math.hypot(it.x - P.x, it.z - P.z))) return this.enterHide(P, h);
    if (!it) return this.emit({ type: 'nothing', id: P.id });
    this.makeNoise(P, NOISE.pick, 0.8);
    it.taken = true;
    let slot = P.inv.indexOf(null);
    let dropped = null;
    if (slot < 0) {
      // inventaire plein : l'objet de la case choisie reste par terre à sa place
      slot = P.sel - 1;
      dropped = P.inv[slot];
      const items = this.fm(P.floor).items;
      items.push({ id: items.length, kind: dropped, x: it.x, z: it.z, gx: it.gx, gz: it.gz, taken: false });
    }
    P.inv[slot] = it.kind;
    this.emit({ type: 'pickup', kind: it.kind, dropped, by: P.id });
  }

  // l'objet au sol le plus proche à portée de F (à son étage)
  nearItem(P) {
    let best = null;
    let bd = PICK_R;
    for (const it of this.fm(P.floor).items || []) {
      if (it.taken) continue;
      const d = Math.hypot(it.x - P.x, it.z - P.z);
      if (d < bd) {
        bd = d;
        best = it;
      }
    }
    return best;
  }

  // le trou sous un point de l'étage du haut (-1 : pas de trou)
  pitUnder(x, z, floor) {
    const m = this.fm(floor);
    if (!this.floors[floor + 1]) return -1; // pas d'étage en dessous : pas de trou
    return m.pitAt ? m.pitAt(cellOf(x), cellOf(z)) : -1;
  }

  // l'hôte (ou le joueur seul) tient son équilibre ; s'il le perd, il tombe
  balanceSide(P, mx, my) {
    P.moving = mx !== 0 || my !== 0;
    const side = this.balance(P, mx);
    if (side) this.beamFall(P, side);
    return side;
  }

  // Barre d'équilibre : renvoie le côté de la chute (-1 gauche, 1 droite) ou 0
  balance(P, mx) {
    P.onBeam = this.pitUnder(P.x, P.z, P.floor) >= 0;
    if (!P.onBeam) {
      P.tilt *= Math.max(0, 1 - DT * 5);
      P.tiltV = 0;
      return 0;
    }
    const noise = (Math.random() - 0.5) * BEAM_NOISE[P.moving ? 1 : 0];
    P.tiltV += (P.tilt * BEAM_UNSTABLE + noise + mx * BEAM_FIX) * DT;
    P.tiltV *= 1 - DT * BEAM_DAMP;
    P.tilt = Math.max(-1, Math.min(1, P.tilt + P.tiltV * DT));
    return Math.abs(P.tilt) >= 1 ? Math.sign(P.tilt) : 0;
  }

  // Sur l'arête : seulement tout droit (Q et D servent à l'équilibre), lentement, et le pas suit l'arête la plus proche
  beamStep(P, my) {
    const C = CELL_SIZE;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const v = my * WALK_SPEED * BEAM_SPEED * DT;
    let dx = fx * v;
    let dz = fz * v;
    // les arêtes sont sur les bords des cases : on y est ramené en douceur, dans le sens de la marche
    const pull = 1.6 * DT;
    if (Math.abs(fx) > Math.abs(fz)) {
      const t = Math.round(P.z / C) * C - P.z;
      if (Math.abs(t) < 0.4) dz += Math.sign(t) * Math.min(Math.abs(t), pull);
    } else {
      const t = Math.round(P.x / C) * C - P.x;
      if (Math.abs(t) < 0.4) dx += Math.sign(t) * Math.min(Math.abs(t), pull);
    }
    return this.moveWithCollisions(P.x, P.z, dx, dz, PLAYER_RADIUS, P.floor);
  }

  // Tomber par un trou : on atterrit à l'étage du dessous, juste en dessous, sonné un instant
  fallThrough(P, pitId, balance = false) {
    const pit = this.fm(P.floor).pits[pitId];
    P.floor += 1;
    P.x = pit.x;
    P.z = pit.z;
    P.lockT = FALL_LOCK;
    P.running = false;
    P.onBeam = false;
    P.tilt = 0;
    P.tiltV = 0;
    P.stamina = Math.max(0, P.stamina - 60);
    // la chute s'entend de loin
    this.makeNoise(P, NOISE.fall, 1.5);
    this.emit({ type: 'fall', id: P.id, name: P.name, balance, x: P.x, z: P.z, floor: P.floor });
    this.alertMonster(P.x, P.z, 30, P.floor);
  }

  // Perdre l'équilibre : on bascule dans le trou du côté où l'on penche
  beamFall(P, side) {
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    P.tilt = 0;
    P.tiltV = 0;
    for (const d of [0.9, 0.6, 1.3]) {
      const id = this.pitUnder(P.x + rx * side * d, P.z + rz * side * d, P.floor);
      if (id >= 0) return this.fallThrough(P, id, true);
    }
  }

  // L'escalier coudé se monte et se descend en marchant : on n'y entre que par le bas de la première volée (depuis
  // l'étage du bas) ou par le haut de la seconde (depuis l'étage du haut), on ne passe ni par-dessus les rampes ni
  // d'une volée à l'autre (il faut faire demi-tour sur le palier), et on change d'étage à mi-hauteur.
  // Renvoie la position permise pour un pas de (P.x, P.z) vers (nx, nz) ; met à jour P.floor.
  stairStep(P, nx, nz) {
    if (!this.stairs.length) return { x: nx, z: nz };
    const C = CELL_SIZE;
    const from = stairAt(this.stairs, P.x, P.z);
    const to = stairAt(this.stairs, nx, nz);
    if (!from && !to) return { x: nx, z: nz };
    const st = (from || to).st;
    const r = 0.3; // demi-largeur du joueur entre les rampes
    let lane;
    if (from) lane = from.lane;
    else {
      // on entre : par le bas de la première volée depuis l'étage du bas, par le haut de la seconde depuis celui du haut
      const p0 = stairLocal(st, P.x, P.z);
      const okA = p0.u < 0 && p0.v > 0 && p0.v < C && P.floor === 1;
      const okB = p0.u < 0 && p0.v > C && p0.v < 2 * C && P.floor === 0;
      if (!okA && !okB) return { x: P.x, z: P.z };
      lane = okA ? 'A' : 'B';
    }
    let { u, v } = stairLocal(st, nx, nz);
    v = Math.max(r, Math.min(2 * C - r, v));
    u = Math.min(3 * C - r, u);
    if (lane === 'L') {
      // du palier, on ne s'engage dans une volée qu'en face d'elle (pas à cheval sur la rampe du milieu)
      if (u < 2 * C && Math.abs(v - C) < r) u = 2 * C;
    } else if (u < 2 * C) {
      v = lane === 'A' ? Math.min(v, C - r) : Math.max(v, C + r);
    }
    if (u < 0) {
      const lv = u < 2 * C && lane !== 'L' ? lane : v < C ? 'A' : 'B';
      // on ne sort par le bas qu'en bas, par le haut qu'en haut (l'autre bout donne sur le vide ou sous la dalle)
      if ((lv === 'A' && P.floor !== 1) || (lv === 'B' && P.floor !== 0)) u = 0;
    }
    const x = st.ox + st.dx * u + st.px * v;
    const z = st.oz + st.dz * u + st.pz * v;
    const now = stairAt(this.stairs, x, z);
    if (now) {
      const floor = now.h > 0.5 ? 0 : 1;
      if (floor !== P.floor) {
        P.floor = floor;
        this.emit({ type: 'stairs', id: P.id, up: floor === 0 });
      }
    }
    return { x, z };
  }

  // T : siffler. Les autres l'entendent ; trop de coups de sifflet rapprochés attirent l'entité
  whistle(P) {
    if (P.whistleCd > 0) return;
    P.whistleCd = WHISTLE_CD;
    P.heat += 1;
    this.makeNoise(P, 0.9, 1);
    this.emit({ type: 'whistle', id: P.id, name: P.name, x: P.x, z: P.z, floor: P.floor });
    if (this.goats) {
      if (P.heat >= WHISTLE_HEAT) {
        alertGoats(this, P.x, P.z, 45);
        this.emit({ type: 'heard', id: P.id });
      }
      return;
    }
    const M = this.monster;
    if (!this.hasMonster || M.mode === 'chase' || M.floor !== P.floor) return;
    if (Math.hypot(M.x - P.x, M.z - P.z) > 45) return;
    // trop de coups rapprochés : elle vient à coup sûr (de près, elle l'entend de toute façon : c'est du bruit)
    if (P.heat >= WHISTLE_HEAT && this.alertMonster(P.x, P.z, 45, P.floor)) this.emit({ type: 'heard', id: P.id });
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

    // coupures de courant du Level 1 ; au Level 2, le noir total et le troupeau qui attaque
    if (this.level === 1 || this.level === PIPES_LEVEL) {
      const L2 = this.level === PIPES_LEVEL;
      if (this.blackout > 0) {
        this.blackout -= DT;
        if (this.blackout <= 0) {
          this.blackout = 0;
          this.nextBlackout = rand(...(L2 ? PIPES_BLACKOUT_EVERY : BLACKOUT_EVERY));
          this.map.dark = false;
          this.emit({ type: 'power' });
        }
      } else {
        this.nextBlackout -= DT;
        // la coupure attend un vrai moment de calme (jamais en pleine poursuite)
        if (this.nextBlackout <= 0 && !blackoutAllowed(this)) this.nextBlackout = 2;
        else if (this.nextBlackout <= 0) {
          this.blackout = rand(...(L2 ? PIPES_BLACKOUT_LEN : BLACKOUT_LEN));
          this.map.dark = L2;
          this.emit({ type: 'blackout', len: this.blackout, level: this.level });
        }
      }
    }

    for (const P of this.players) {
      const inp = P.id === this.localId ? input : (others && others[P.id]) || {};
      if (P.status === 'alive') this.stepPlayer(P, inp);
    }
    if (this.state !== 'playing') return;
    if (this.level === 1) this.updatePanel();
    updateDirector(this);
    updateLightsOut(this);
    if (this.level === PIPES_LEVEL) {
      this.updateValves();
      this.updateBreakers();
    }

    // aux Poolrooms, l'entité ne sort pas de l'eau : elle ne chasse personne (son ombre passe sous la surface)
    if (this.goats) {
      updateGoats(this);
      senseGoats(this);
    } else if (this.hasMonster && this.level !== 2) this.updateMonster();
    this.checkElevator();
  }

  stepPlayer(P, input) {
    // 1. Orientation, lampe et inventaire
    if (input.yaw !== undefined) P.yaw = input.yaw;
    if (input.pitch !== undefined) P.pitch = input.pitch;
    if (input.sel === 1 || input.sel === 2) P.sel = input.sel;
    // l'invité tient son endurance chez lui : l'hôte prend la sienne (pour savoir si l'eau d'amande sert à quelque chose)
    if (input.remote && Number.isFinite(input.stamina)) P.stamina = input.stamina;
    P.whistleCd = Math.max(0, P.whistleCd - DT);
    P.heat = Math.max(0, P.heat - DT / 20);
    P.bumpT = Math.max(0, (P.bumpT || 0) - DT);
    P.hurtT = Math.max(0, (P.hurtT || 0) - DT);
    // agrippé : on ne fait plus que se débattre (n'importe quelle touche)
    if (P.grabT > 0) {
      if (input.struggle) P.struggle += Math.min(4, +input.struggle || 1);
      P.moving = false;
      P.running = false;
      P.noise = NOISE.panic;
      return;
    }
    // caché dans un casier : immobile, lampe éteinte ; Maj retient le souffle (trop longtemps, on suffoque)
    if (P.hidden >= 0) return this.stepHidden(P, input);
    if (input.whistle) this.whistle(P);
    if (input.pick) this.pickUp(P);
    if (P.hidden >= 0) return;
    if (input.toggleFlashlight) {
      if (!P.hasLamp) this.emit({ type: 'noLamp', id: P.id });
      else if (!P.flashlight && P.battery <= 0) this.emit({ type: 'batteryEmpty', id: P.id });
      else {
        P.flashlight = !P.flashlight;
        this.emit({ type: 'flashlight', on: P.flashlight, id: P.id });
      }
    }
    if (input.use !== undefined && input.use !== null) this.useItem(P, input.use);
    if (input.useSel) this.useItem(P, P.sel - 1);

    // la lampe vide la pile ; à plat, elle s'éteint
    if (P.flashlight) {
      P.battery = Math.max(0, P.battery - BATTERY_DRAIN * (this.blackout > 0 ? BLACKOUT_DRAIN : 1) * DT);
      if (P.battery <= 0) {
        P.flashlight = false;
        this.emit({ type: 'batteryEmpty', id: P.id });
      }
    }

    // 2. Endurance et course
    const mx = input.mx || 0;
    const my = input.my || 0;
    P.crouch = !!input.crouch && !P.onBeam;
    const wantRun = !!input.run && (mx !== 0 || my !== 0) && !P.onBeam && !P.crouch;
    P.winded = Math.max(0, (P.winded || 0) - DT);
    if (wantRun && P.stamina > 0 && !(P.winded > 0)) {
      P.running = true;
      P.stamina = Math.max(0, P.stamina - DT * STAMINA_DRAIN);
      if (P.stamina <= 0) P.winded = WINDED_T; // à bout de souffle
    } else {
      P.running = false;
      P.stamina = Math.min(100, P.stamina + DT * STAMINA_REGEN);
    }

    // 3. Déplacement (un invité se déplace chez lui et annonce sa position : l'hôte la prend si elle est plausible)
    const speed = (P.running ? SPRINT_SPEED : P.crouch ? WALK_SPEED * CROUCH_SPEED : WALK_SPEED) * this.wade(P);
    P.moving = mx !== 0 || my !== 0;
    const pos = input.pos;
    // un invité a perdu l'équilibre chez lui : il bascule dans le trou de ce côté
    if (input.beamFall) this.beamFall(P, Math.sign(input.beamFall));
    if (P.lockT > 0) {
      P.lockT = Math.max(0, P.lockT - DT);
      P.moving = false;
    } else if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.z) && Math.hypot(pos.x - P.x, pos.z - P.z) < 4.5 && !this.isColliding(pos.x, pos.z, PLAYER_RADIUS * 0.8, P.floor)) {
      // un invité se déplace chez lui (et tient son équilibre chez lui) : l'hôte prend sa position et son inclinaison
      const ps = this.stairStep(P, pos.x, pos.z);
      P.x = ps.x;
      P.z = ps.z;
      if (Number.isFinite(input.tilt)) P.tilt = Math.max(-1, Math.min(1, input.tilt));
      P.onBeam = this.pitUnder(P.x, P.z, P.floor) >= 0;
    } else if (input.remote) {
      // invité sans position ce pas-ci : il reste où il est
    } else if (this.balanceSide(P, mx, my) !== 0) {
      // perdu l'équilibre : c'est fait dans balanceSide
    } else if (P.onBeam) {
      P.moving = my !== 0;
      if (my !== 0) {
        const b = this.beamStep(P, my);
        P.x = b.x;
        P.z = b.z;
      }
    } else if (P.moving) {
      const len = Math.hypot(mx, my) || 1;
      const normX = mx / len;
      const normY = my / len;
      const fx = -Math.sin(P.yaw);
      const fz = -Math.cos(P.yaw);
      const rx = Math.cos(P.yaw);
      const rz = -Math.sin(P.yaw);
      const p2 = this.moveWithCollisions(P.x, P.z, (fx * normY + rx * normX) * speed * DT, (fz * normY + rz * normX) * speed * DT, PLAYER_RADIUS, P.floor);
      const p3 = this.stairStep(P, p2.x, p2.z);
      P.x = p3.x;
      P.z = p3.z;
    }

    // le bruit qu'on fait : ce que l'entité peut entendre (la course s'entend loin, accroupi presque rien)
    let noise = !P.moving ? 0 : P.running ? NOISE.run : P.crouch ? NOISE.crouch : NOISE.walk;
    if (P.winded > 0) noise = Math.max(noise, NOISE.winded);
    if (P.bumpT > 0) noise = Math.max(noise, P.bumpV || 0);
    P.noise = noise;

    // 3b. Un pas de trop au-dessus d'un trou : on tombe à l'étage du dessous
    const pitId = this.pitUnder(P.x, P.z, P.floor);
    if (pitId >= 0) {
      const pit = this.fm(P.floor).pits[pitId];
      if (Math.abs(P.x - pit.x) < PIT_HALF && Math.abs(P.z - pit.z) < PIT_HALF) this.fallThrough(P, pitId);
    }
    // 3c. Level 2 : un jet de vapeur brûlant repousse (l'invité le vit chez lui et le dit à l'hôte) ; le cri attire
    // l'entité
    P.burnT = Math.max(0, (P.burnT || 0) - DT);
    if (this.level === PIPES_LEVEL) {
      const j = !input.remote && !(P.burnT > 0) && P.lockT <= 0 ? this.steamAt(P.x, P.z) : null;
      if (j) this.burn(P, j);
      if (j || input.burn) {
        this.emit({ type: 'burn', id: P.id, name: P.name, x: P.x, z: P.z });
        this.alertMonster(P.x, P.z, 40, P.floor);
      }
    }
    // 3d. Au pied de l'échelle posée : on grimpe jusqu'au renfoncement
    const map = this.fm(P.floor);
    const N = map.niche;
    P.onLadder = !!(N && N.ladder && Math.hypot(N.baseX - P.x, N.baseZ - P.z) < 0.9);

    // 4. Objectifs : cassettes (Level 0) ou fusibles (Level 1), pour toute l'équipe
    for (const cas of map.cassettes || []) {
      if (cas.collected || Math.hypot(cas.x - P.x, cas.z - P.z) >= 1.4) continue;
      if (cas.high && !P.onLadder) continue; // trop haut sans l'échelle
      cas.collected = true;
      this.cassettes++;
      P.found++;
      this.emit({ type: 'cassette', id: cas.id, by: P.id, count: this.cassettes, total: CASSETTES });
      if (this.cassettes === CASSETTES) {
        if (this.level === 0) this.unlockLevel0();
        this.emit({ type: 'exitUnlocked' });
      }
    }
    for (const f of map.fuses || []) {
      if (f.taken || Math.hypot(f.x - P.x, f.z - P.z) >= 1.3) continue;
      f.taken = true;
      this.fuses++;
      P.found++;
      // Level 1 : le fusible reste en poche jusqu'au panneau (s'il tombe, il le lâche)
      if (this.level === 1) P.carry.push(f.id);
      this.makeNoise(P, NOISE.pick, 0.8);
      this.emit({ type: 'fuse', id: f.id, by: P.id, count: this.fuses, total: FUSES, x: f.x, z: f.z });
    }
    // Level 1 : les fusibles rapportés au panneau du monte-charge (il faudra ensuite le relancer, voir updatePanel)
    if (this.level === 1 && P.carry.length && Math.hypot(map.exit.x - P.x, map.exit.z - P.z) < 2.6) {
      this.delivered = (this.delivered || 0) + P.carry.length;
      this.emit({ type: 'fuseIn', id: P.id, n: P.carry.length, count: this.delivered, total: FUSES });
      P.carry = [];
    }
    // aux Poolrooms, les 3 volants trouvés suffisent : les toboggans s'ouvrent
    if (this.level === 2 && !this.powered && this.fuses >= FUSES) {
      this.powered = true;
      this.emit({ type: 'powered', by: P.id });
      this.emit({ type: 'exitUnlocked' });
    }

    // 4c. Signal (à vol d'oiseau, 0 au-delà de 45 m) : l'objectif le plus proche à cet étage ; s'il n'en reste qu'à
    // l'autre étage, l'escalier ; une fois tout trouvé, l'ascenseur de cet étage (le vrai… ou le faux)
    this.updateSignal(P);

    // 5. Entrer dans le vrai ascenseur ouvert : à l'abri, spectateur jusqu'au départ. Aux Poolrooms : se glisser
    // dans un toboggan ; le premier choisit la couleur, les autres toboggans se referment
    if (this.open && map.slides) {
      for (const sl of map.slides) {
        if ((this.slide >= 0 && sl.id !== this.slide) || Math.hypot(sl.x - P.x, sl.z - P.z) > MOUTH.enter) continue;
        if (this.slide < 0) this.slide = sl.id;
        P.status = 'elevator';
        P.moving = false;
        P.running = false;
        this.emit({ type: 'board', id: P.id, name: P.name, slide: sl.id });
        break;
      }
    } else if (this.open && P.floor === this.realFloor) {
      const E = map.elevator;
      const inside = E ? cellOf(P.x) === E.gx && cellOf(P.z) === E.gz : Math.hypot(map.exit.x - P.x, map.exit.z - P.z) < 1.8;
      if (inside) {
        P.status = 'elevator';
        P.moving = false;
        P.running = false;
        this.emit({ type: 'board', id: P.id, name: P.name });
      }
    }
  }

  updateSignal(P) {
    const map = this.fm(P.floor);
    const near = (list) => list.reduce((b, g) => Math.min(b, Math.hypot(g.x - P.x, g.z - P.z)), Infinity);
    let best = Infinity;
    P.sigTo = 'goal';
    if (this.level === 0 && !this.open) {
      best = near((map.cassettes || []).filter((c) => !c.collected));
      if (best === Infinity && this.stairs.length) {
        best = near(this.stairs);
        P.sigTo = 'stairs';
      }
    } else if ((this.level === 1 || this.level === 2) && (map.fuses || []).some((f) => !f.taken)) {
      best = near((map.fuses || []).filter((f) => !f.taken));
    } else if (map.slides && map.slides.length) {
      best = near(this.slide >= 0 ? [map.slides[this.slide]] : map.slides);
      P.sigTo = 'exit';
    } else if (this.level === PIPES_LEVEL && !this.open) {
      best = (map.valves || []).filter((v) => !v.closed).reduce((b, v) => Math.min(b, Math.hypot(v.sx - P.x, v.sz - P.z)), Infinity);
    } else {
      best = Math.hypot(map.exit.x - P.x, map.exit.z - P.z);
      P.sigTo = 'exit';
    }
    P.signal = best === Infinity ? 0 : Math.max(0, 1 - best / SIGNAL_RANGE);
    // dans le noir d'une coupure, le caméscope ne capte plus rien
    if (this.blackout > 0) P.signal = 0;
  }

  // Caché dans un casier : on ne bouge pas, on retient son souffle (Maj) ; à bout de souffle, on suffoque bruyamment
  stepHidden(P, input) {
    if (input.pick) return this.leaveHide(P);
    P.moving = false;
    P.running = false;
    P.flashlight = false;
    P.stamina = Math.min(100, P.stamina + DT * STAMINA_REGEN);
    const want = !!input.run && P.breath > 0 && !(P.gaspT > 0);
    if (want !== P.holding) this.emit({ type: 'breath', id: P.id, on: want });
    P.holding = want;
    P.gaspT = Math.max(0, (P.gaspT || 0) - DT);
    if (P.holding) {
      P.breath = Math.max(0, P.breath - (100 / BREATH_HOLD) * DT);
      if (P.breath <= 0) {
        P.holding = false;
        P.gaspT = 2.5;
        this.makeNoise(P, NOISE.gasp, 1.2);
        this.emit({ type: 'gasp', id: P.id, x: P.x, z: P.z, floor: P.floor });
      }
    } else P.breath = Math.min(100, P.breath + BREATH_BACK * DT);
    P.bumpT = Math.max(0, (P.bumpT || 0) - DT);
    P.noise = P.holding ? 0 : Math.max(NOISE.breath, P.bumpT > 0 ? P.bumpV : 0);
    this.updateSignal(P);
  }

  // Level 1 : les 3 fusibles au panneau, il faut encore relancer le monte-charge en restant devant (bruyant : le moteur
  // tousse, l'entité l'entend de loin). À plusieurs, plus vite ; lâché, il redescend doucement.
  updatePanel() {
    if (this.powered || (this.delivered || 0) < FUSES) return;
    const E = this.map.exit;
    const near = this.players.filter((P) => P.status === 'alive' && P.hidden < 0 && Math.hypot(E.x - P.x, E.z - P.z) < 2.6);
    if (near.length) {
      if (this.panel === 0) this.emit({ type: 'panelStart', by: near[0].id, x: E.x, z: E.z });
      this.panel = Math.min(1, this.panel + (DT / PANEL_T) * (near.length > 1 ? 1.5 : 1));
      this.panelNoiseT -= DT;
      if (this.panelNoiseT <= 0) {
        this.panelNoiseT = 1.5;
        this.alertMonster(E.x, E.z, 30, 0);
        this.emit({ type: 'panelNoise', x: E.x, z: E.z, p: this.panel });
      }
      for (const P of near) this.makeNoise(P, 0.6, 0.3);
    } else this.panel = Math.max(0, this.panel - DT * 0.1);
    if (this.panel < 1) return;
    this.powered = true;
    this.emit({ type: 'powered', by: near[0].id });
    this.emit({ type: 'exitUnlocked' });
  }

  // Invité : il déplace seulement son joueur, sans rien ramasser ni décider (l'hôte le fera). Renvoie le côté d'une
  // chute de la barre d'équilibre (l'hôte fera tomber), sinon 0.
  predict(input = {}) {
    const P = this.player;
    // trace de ses positions de la dernière seconde et demie : l'instantané de l'hôte, en retard, est comparé à elle
    const tr = this.trail || (this.trail = []);
    tr.push(P.x, P.z, P.floor);
    // lissage des autres joueurs et de l'entité vers leur dernière position connue
    const k = 1 - Math.exp(-DT * 14);
    for (const Q of this.players) if (Q !== P && Q.tx !== undefined) { Q.x += (Q.tx - Q.x) * k; Q.z += (Q.tz - Q.z) * k; }
    const Mo = this.monster;
    if (Mo && Mo.tx !== undefined) { Mo.x += (Mo.tx - Mo.x) * k; Mo.z += (Mo.tz - Mo.z) * k; }
    if (tr.length > 270) tr.splice(0, tr.length - 270);
    if (this.state !== 'playing' || P.status !== 'alive' || this.departT > 0) return 0;
    // agrippé ou dans un casier : l'hôte décide de tout (on ne bouge pas, le regard suit l'instantané)
    if (P.grabT > 0 || P.hidden >= 0) {
      P.moving = false;
      P.running = false;
      if (P.hidden >= 0 && input.yaw !== undefined) P.yaw = input.yaw;
      return 0;
    }
    if (input.yaw !== undefined) P.yaw = input.yaw;
    if (input.pitch !== undefined) P.pitch = input.pitch;
    if (P.lockT > 0) {
      P.lockT = Math.max(0, P.lockT - DT);
      return 0;
    }
    const mx = input.mx || 0;
    const my = input.my || 0;
    P.moving = mx !== 0 || my !== 0;
    P.crouch = !!input.crouch;
    const side = this.balance(P, mx);
    if (side) {
      P.tilt = 0;
      P.tiltV = 0;
      return side;
    }
    if (P.onBeam) {
      P.running = false;
      P.stamina = Math.min(100, P.stamina + DT * STAMINA_REGEN);
      P.moving = my !== 0;
      if (my !== 0) {
        const b = this.beamStep(P, my);
        P.x = b.x;
        P.z = b.z;
      }
      return 0;
    }
    P.winded = Math.max(0, (P.winded || 0) - DT);
    P.running = !!input.run && P.moving && P.stamina > 0 && !(P.winded > 0) && !P.crouch;
    if (P.running) {
      P.stamina = Math.max(0, P.stamina - DT * STAMINA_DRAIN);
      if (P.stamina <= 0) P.winded = WINDED_T;
    } else P.stamina = Math.min(100, P.stamina + DT * STAMINA_REGEN);
    if (!P.moving) return 0;
    const speed = (P.running ? SPRINT_SPEED : P.crouch ? WALK_SPEED * CROUCH_SPEED : WALK_SPEED) * this.wade(P);
    const len = Math.hypot(mx, my) || 1;
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const rx = Math.cos(P.yaw);
    const rz = -Math.sin(P.yaw);
    const pos = this.moveWithCollisions(P.x, P.z, ((fx * my + rx * mx) / len) * speed * DT, ((fz * my + rz * mx) / len) * speed * DT, PLAYER_RADIUS, P.floor);
    const ps = this.stairStep(P, pos.x, pos.z);
    P.x = ps.x;
    P.z = ps.z;
    this.predictBurn(P);
    return 0;
  }

  // l'invité se brûle chez lui : repoussé tout de suite ; burned dit à l'application de prévenir l'hôte
  predictBurn(P) {
    P.burnT = Math.max(0, (P.burnT || 0) - DT);
    if (this.level !== PIPES_LEVEL || P.burnT > 0) return;
    const j = this.steamAt(P.x, P.z);
    if (!j) return;
    this.burn(P, j);
    this.burned = true;
  }

  // Un joueur arrive en cours de partie : spectateur jusqu'au prochain étage
  addPlayer(id, name) {
    if (this.players.some((p) => p.id === id)) return;
    this.roster.push({ id, name });
    const P = newPlayer(id, name, this.map, this.players.length);
    P.status = 'dead';
    this.players.push(P);
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
      sl: this.slide,
      // le vrai ascenseur ne se dévoile qu'une fois les cassettes trouvées
      rf: this.open ? this.realFloor : -1,
      p: this.players.map((P) => [P.id, r2(P.x), r2(P.z), r2(P.yaw), r2(P.pitch), P.status, P.flashlight ? 1 : 0, Math.round(P.battery), Math.round(P.stamina), P.inv.map((k) => k || '').join(','), r2(P.signal), P.running ? 1 : 0, P.moving ? 1 : 0, P.found, P.name, P.hasLamp ? 1 : 0, P.sel, P.floor, P.sigTo, P.onLadder ? 1 : 0, r2(P.lockT), r2(P.tilt), P.onBeam ? 1 : 0, P.bottles, r2(P.grabT), P.hidden, P.crouch ? 1 : 0, P.carry.length, P.hurt || 0, Math.round(P.breath), P.holding ? 1 : 0, P.grabs || 0, r2(P.struggle || 0)]),
      m: [r2(M.x), r2(M.z), r2(M.yaw), M.mode, M.silent ? 1 : 0, M.floor, M.grabbing ?? -1, r2(M.rushT || 0)],
      // Level 1 : fusibles (ils peuvent être tombés ailleurs), fusibles au panneau, redémarrage du monte-charge
      fp: this.level === 1 ? (this.map.fuses || []).map((f) => [r2(f.x), r2(f.z)]) : null,
      dl: this.delivered || 0,
      pn: r2(this.panel || 0),
      hd: (this.map.hides || []).map((h) => h.by),
      k: [bits(this.allCassettes, 'collected'), bits(this.map.fuses, 'taken'), this.floors.map((f) => bits(f.items, 'taken')).join('|'), ''],
      // objets posés par des joueurs (échanges) : [étage, objet, x, z] ; échelle posée
      ix: this.floors.flatMap((f, fi) => (f.items || []).slice(this.items0[fi]).map((o) => [fi, o.kind, r2(o.x), r2(o.z)])),
      nl: this.floors.some((f) => f.niche && f.niche.ladder) ? 1 : 0,
      // vannes du Level 2 : -1 fermée, sinon combien elle est tournée
      v: (this.map.valves || []).map((v) => (v.closed ? -1 : r2(v.turn))),
      // courant des secteurs (0 à 3) et disjoncteurs (-1 réarmé, sinon l'avancée)
      sp: (this.map.valves || []).map((v) => v.power || 0),
      br: (this.map.breakers || []).map((b) => (b.done ? -1 : r2(b.turn))),
      // le troupeau du Level 2 : [x, z, cap, état] par chèvre
      gt: this.goats ? goatSnapshot(this.goats) : null,
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
    this.map.dark = this.level === PIPES_LEVEL && this.blackout > 0;
    this.departT = snap.dp;
    this.slide = snap.sl ?? -1;
    if (snap.rf >= 0 && !this.unlocked) {
      this.realFloor = snap.rf;
      if (this.level === 0) this.unlockLevel0();
    }
    const seen = new Set();
    for (const row of snap.p) {
      const [id, x, z, yaw, pitch, status, fl, bat, stam, inv, signal, running, moving, found, name, lamp, sel, floor, sigTo, onLadder, lockT, tilt, onBeam, bottles, grabT, hidden, crouch, carryN, hurt, breath, holding, grabs, struggle] = row;
      seen.add(id);
      let P = this.players.find((q) => q.id === id);
      if (!P) {
        this.roster.push({ id, name });
        P = newPlayer(id, name, this.map, this.players.length);
        this.players.push(P);
      }
      const mine = id === this.localId;
      // l'hôte voit l'invité avec un temps de retard : on ne le ramène que si sa position ne figure nulle part
      // dans sa trace récente (sinon, à la course, chaque instantané le tirerait en arrière)
      let far = Math.hypot(P.x - x, P.z - z) > 2.5;
      if (far && mine && this.trail && status === 'alive' && P.status === 'alive') {
        const tr = this.trail;
        for (let i = 0; i < tr.length; i += 3) if (tr[i + 2] === floor && Math.hypot(tr[i] - x, tr[i + 1] - z) < 1.2) { far = false; break; }
      }
      if (far && mine) this.trail = [];
      // dans l'escalier, l'invité change d'étage chez lui (l'hôte suit sa position avec un temps de retard) : il ne
      // doit pas être ramené en arrière à chaque instantané qui a encore l'ancien étage
      const ownStairs = mine && !far && status === 'alive' && P.status === 'alive' && (stairAt(this.stairs, P.x, P.z) || stairAt(this.stairs, x, z));
      // l'hôte décide des chutes : la position suit
      if (!mine && status === 'alive' && P.status === 'alive' && P.floor === floor && Math.hypot(P.x - x, P.z - z) < 3) {
        // les autres glissent vers leur position reçue (lissé à chaque pas) au lieu de sauter 20 fois par seconde
        P.tx = x;
        P.tz = z;
      } else if (!ownStairs && (!mine || far || status !== 'alive' || P.status !== 'alive' || P.floor !== floor)) {
        P.x = x;
        P.z = z;
        P.tx = P.tz = undefined;
      }
      if (!mine) {
        P.yaw = yaw;
        P.pitch = pitch;
        P.running = !!running;
        P.moving = !!moving;
        P.stamina = stam;
      } else if (P.floor !== floor && !ownStairs) P.yaw = yaw;
      if (!ownStairs) P.floor = floor || 0;
      P.status = status;
      P.flashlight = !!fl;
      P.hasLamp = !!lamp;
      if (!mine && sel) P.sel = sel;
      P.sigTo = sigTo || 'goal';
      P.onLadder = !!onLadder;
      // un blocage (coup, chute) ne s'applique qu'à son début : un instantané en retard ne le relance pas une fois fini
      if (lockT > 0 && !(P.lockSeen > 0) && !(P.lockT > 0)) P.lockT = lockT;
      P.lockSeen = lockT;
      if (!mine) {
        P.tilt = tilt || 0;
        P.onBeam = !!onBeam;
      }
      // l'endurance de l'invité se calcule chez lui : une eau d'amande bue (chez l'hôte) la remplit ici aussi
      if (mine && (bottles || 0) > (P.bottles || 0)) {
        P.stamina = 100;
        P.winded = 0;
      }
      P.bottles = bottles || 0;
      P.battery = bat;
      P.grabT = grabT || 0;
      P.grabs = grabs || 0;
      // la poussée du joueur de cet écran se compte chez lui ; l'hôte confirme
      if (!mine || !(P.grabT > 0)) P.struggle = struggle || 0;
      const wasHidden = P.hidden;
      P.hidden = hidden ?? -1;
      // il vient de sortir du casier : sa position est celle de l'hôte (devant la porte)
      if (mine && wasHidden >= 0 && P.hidden < 0) {
        P.x = x;
        P.z = z;
      }
      if (!mine) P.crouch = !!crouch;
      P.carryN = carryN || 0;
      P.hurt = hurt || 0;
      P.breath = breath ?? 100;
      P.holding = !!holding;
      P.inv = (inv || ',').split(',').map((k) => k || null);
      P.signal = signal;
      P.found = found;
    }
    this.players = this.players.filter((q) => seen.has(q.id));
    const M = this.monster;
    const [mx, mz] = snap.m;
    if ((snap.m[5] || 0) === M.floor && Math.hypot(M.x - mx, M.z - mz) < 4) { M.tx = mx; M.tz = mz; }
    else { M.x = mx; M.z = mz; M.tx = M.tz = undefined; }
    [, , M.yaw, M.mode] = snap.m;
    M.silent = !!snap.m[4];
    M.floor = snap.m[5] || 0;
    M.grabbing = snap.m[6] >= 0 ? snap.m[6] : null;
    M.rushT = snap.m[7] || 0;
    if (snap.fp) (this.map.fuses || []).forEach((f, i) => {
      const q = snap.fp[i];
      if (!q) return;
      f.x = q[0];
      f.z = q[1];
      f.gx = cellOf(q[0]);
      f.gz = cellOf(q[1]);
    });
    this.delivered = snap.dl || 0;
    this.panel = snap.pn || 0;
    (snap.hd || []).forEach((by, i) => {
      const h = (this.map.hides || [])[i];
      if (h) h.by = by;
    });
    const set = (list, k, b) => (list || []).forEach((o, i) => {
      o[k] = (b || '')[i] === '1';
    });
    set(this.allCassettes, 'collected', snap.k[0]);
    set(this.map.fuses, 'taken', snap.k[1]);
    // objets posés par des joueurs : on ajoute ceux qu'on n'a pas encore, étage par étage
    this.floors.forEach((f, fi) => {
      const list = (snap.ix || []).filter((o) => o[0] === fi);
      for (const [, kind, x, z] of list.slice(f.items.length - this.items0[fi])) f.items.push({ id: f.items.length, kind, x, z, gx: cellOf(x), gz: cellOf(z), taken: false });
    });
    const takenBits = (snap.k[2] || '').split('|');
    this.floors.forEach((f, fi) => set(f.items, 'taken', takenBits[fi]));
    for (const f of this.floors) if (f.niche) f.niche.ladder = !!snap.nl;
    (this.map.valves || []).forEach((v, i) => {
      const t = (snap.v || [])[i];
      if (t === undefined) return;
      v.closed = t < 0;
      v.turn = t < 0 ? 1 : t;
    });
    this.valves = (this.map.valves || []).filter((v) => v.closed).length;
    (snap.sp || []).forEach((p, i) => this.setSector(i, p));
    (this.map.breakers || []).forEach((b, i) => {
      const t = (snap.br || [])[i];
      if (t === undefined) return;
      b.done = t < 0;
      b.turn = t < 0 ? 1 : t;
    });
    if (snap.gt) applyGoatSnapshot(this, snap.gt);
    if (this.goats) senseGoats(this);
    else if (this.hasMonster) this.senseMonster();
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
    // Poolrooms : le toboggan pris décide du niveau suivant (sans niveau d'arrivée : on sort des Backrooms)
    const sl = this.map.slides && this.slide >= 0 ? this.map.slides[this.slide] : null;
    if (sl && sl.to != null) {
      this.loadLevel(sl.to);
      this.emit({ type: 'level', level: this.level });
      return;
    }
    // les autres toboggans sortent des Backrooms ; les Tuyauteries sont le dernier niveau
    if (this.map.slides || this.level >= LAST_LEVEL) {
      this.state = 'won';
      this.emit({ type: 'win', time: this.time });
      return;
    }
    this.loadLevel(this.level + 1);
    this.emit({ type: 'level', level: this.level });
  }

  // Proximité de l'entité pour chaque joueur (son, image) et cible de la traque. À l'autre étage, on l'entend
  // étouffée à travers le plancher et elle ne voit personne.
  senseMonster() {
    const M = this.monster;
    let target = null;
    let bestScore = Infinity;
    for (const P of this.players) {
      const same = P.floor === M.floor;
      const dx = P.x - M.x;
      const dz = P.z - M.z;
      const dist = Math.hypot(dx, dz);
      P.mDist = same ? dist : dist + 40;
      // bourdonnement : de 0 à 35 m, il monte vite quand elle est à portée ; elle se tait en embuscade
      const ratio = 1 - Math.min(1, Math.max(0, (dist - 1.2) / 32));
      P.danger = dist > 35 ? 0 : Math.pow(ratio, 1.6) * (M.silent && dist > 4 ? 0.35 : 1) * (same ? 1 : 0.25); // tout près, même tapie, on l'entend
      let diff = Math.atan2(M.x - P.x, M.z - P.z) - (P.yaw - Math.PI);
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      P.pan = Math.max(-0.9, Math.min(0.9, Math.sin(diff)));
      if (P.status !== 'alive') continue;
      P.seen = same && hasLineOfSight(this.fm(M.floor), M.x, M.z, P.x, P.z);
      const concealed = P.hidden >= 0 && M.sawHide !== P.hidden;
      // elle préfère celui qui s'est éloigné des autres
      let mate = Infinity;
      for (const Q of this.players) if (Q !== P && Q.status === 'alive' && Q.floor === P.floor) mate = Math.min(mate, Math.hypot(Q.x - P.x, Q.z - P.z));
      const alone = mate !== Infinity && mate > 15 ? 8 : 0;
      const score = P.mDist - (P.seen && !concealed ? 12 : 0) - (P.id === M.target ? 6 : 0) - alone + (concealed ? 30 : 0);
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
    const P0 = this.senseMonster();
    // elle tient quelqu'un : elle ne fait rien d'autre
    if (M.mode === 'grab') return this.updateGrab(M);
    // sonnée (on s'est dégagé, ou un coéquipier l'a aveuglée) : elle recule, puis s'enfuit dans le noir
    if (M.stunT > 0) {
      M.stunT -= DT;
      M.speed = 0;
      M.path = [];
      if (M.stunT <= 0) {
        M.stunT = 0;
        const spot = P0 ? this.darkSpot(this.fm(M.floor), P0, M, 18, 32, false) : null;
        M.mode = spot ? 'flee' : 'patrol';
        M.watch = spot;
        M.repathT = 0;
      }
      return;
    }
    const P = P0;
    if (!P) return;
    M.target = P.id;
    M.dormantT = Math.max(0, (M.dormantT || 0) - DT);
    // au tout début de la partie, ou pendant le répit qui suit une poursuite, elle reste au loin et se tait
    const calm = M.dormantT > 0 || (entityRelaxed(this) && M.mode !== 'chase');
    const map = this.fm(M.floor);
    const rage = this.rage; // 0 seul ou personne à l'abri, jusqu'à 1 quand il ne reste qu'un joueur dehors
    const dark = this.blackout > 0;
    const same = P.floor === M.floor;
    const dx = P.x - M.x;
    const dz = P.z - M.z;
    const dist = same ? Math.hypot(dx, dz) : Infinity;
    M.distToPlayer = dist;
    M.hasLineOfSight = P.seen;

    // Détection : vue directe (moins loin lampe éteinte ; dans le noir, une lampe allumée se voit de loin),
    // bruit de course, présence rapprochée. La colère allonge tout.
    const A = this.aggro;
    // Vue : seulement devant elle (une lampe allumée se remarque bien plus sur le côté) ; accroupi lampe éteinte, on
    // passe mieux inaperçu. Au début elle voit et entend moins loin ; chaque objectif l'aiguise
    const sight = ((dark ? (P.flashlight ? 28 : 7) : P.flashlight ? 24 : 15) * (0.8 + A * 0.3) + rage * 10) * (P.crouch && !P.flashlight ? 0.7 : 1) * (calm ? 0.5 : 1);
    const ang = Math.abs(this.angleTo(M, P.x, P.z));
    const inView = ang < VISION_CONE || (P.flashlight && ang < VISION_CONE * 1.7) || dist < 2.5;
    // Ouïe : le bruit du joueur (course, chute, ramassage, panneau…) porte moins à travers les murs
    const heardR = NOISE_RANGE * (P.noise || 0) * (M.hasLineOfSight ? 1 : 0.65) * (dark ? 1.15 : 1) * (0.85 + A * 0.3) * (calm ? 0.5 : 1) + (P.noise > 0.2 ? rage * 6 : 0);
    let canSee = M.hasLineOfSight && dist < sight && inView;
    let canHear = (P.noise || 0) > 0 && dist < heardR;
    // tout près, elle sent sa présence… si elle le voit ou l'entend respirer ; accroupi derrière un mur, on passe
    let isNearby = dist < 1.6 || (dist < 4 + rage * 2 + A * 2 && (M.hasLineOfSight || (P.noise || 0) > 0.1) && !(calm && dist > 2.5));
    // caché dans un casier qu'elle ne l'a pas vu prendre : invisible ; seule sa respiration le trahit, de tout près
    if (P.hidden >= 0 && M.sawHide !== P.hidden) {
      canSee = false;
      isNearby = false;
      canHear = (P.noise || 0) > 0 && dist < 3.2 + P.noise * 8;
      if (canHear) M.sawHide = P.hidden;
    }
    if (M.dormantT > 0 && !isNearby && !(canHear && P.running && dist < 7)) {
      canSee = false;
      canHear = false;
    }
    // Nez à nez : le joueur la regarde en face, de près, et la voit vraiment (sous un néon, dans sa lampe, ou à deux
    // pas). Elle ne reste pas plantée là : au bout d'une demi-seconde, elle hurle et fonce sur lui, même au repos
    // Level 0 : dans la lumière franche d'une zone claire, on est presque à l'abri (sauf pendant une coupure)
    const safe = this.level === 0 && !dark && this.brightCell(this.fm(P.floor), P.x, P.z);
    const exposed = same && M.hasLineOfSight && !(P.hidden >= 0) && dist < 7 && (!safe || dist < 4) && this.facing(P, M.x, M.z) < 0.4 &&
      ((P.flashlight && dist < 7) || dist < 3.2 || (!dark && this.litCell(map, M.x, M.z)));
    if (exposed && M.mode !== 'chase' && M.mode !== 'flee' && M.mode !== 'ambush') M.faceT += DT;
    else M.faceT = Math.max(0, M.faceT - DT * 2);
    if (M.faceT > 0.5) {
      M.faceT = 0;
      M.dormantT = 0;
      M.mode = 'chase';
      M.watch = null;
      M.silent = false;
      M.rushT = 2.4;
      M.burstT = 2.4;
      M.unseenT = 0;
      M.repathT = 0;
      M.lastSeenX = P.x;
      M.lastSeenZ = P.z;
      M.yaw = Math.atan2(P.x - M.x, P.z - M.z);
      this.chases++;
      canSee = true;
      this.emit({ type: 'rush', id: P.id, x: M.x, z: M.z, floor: M.floor });
    }
    M.rushT = Math.max(0, M.rushT - DT);
    // tapie dans le noir, elle observe : elle ne charge que si on s'approche trop (ou, déjà énervée, si on la voit)
    const hiding = M.mode === 'stalk' || M.mode === 'watch' || M.mode === 'flee';
    if (hiding) {
      // la lampe braquée sur elle : au début elle s'enfuit dans le noir, plus tard elle charge
      const lit = P.flashlight && M.hasLineOfSight && dist < 22 && this.facing(P, M.x, M.z) < 0.3;
      isNearby = dist < 3.5 + A * 4;
      canSee = (A >= 0.5 && canSee && dist < sight * 0.6) || (lit && A >= 0.4);
      canHear = A >= 0.6 && canHear;
      if (lit && A < 0.4 && M.mode !== 'flee' && !isNearby && !exposed) {
        // elle apprend : après deux fuites devant la lampe, elle ne se laisse plus faire
        if (M.flees >= 2) canSee = true;
        else {
          const spot = this.darkSpot(map, P, M, 18, 30, false);
          if (spot) {
            M.flees++;
            M.mode = 'flee';
            M.watch = spot;
            M.repathT = 0;
            this.emit({ type: 'monsterFlee' });
          }
        }
      }
    } else if (M.mode === 'patrol' && A < 0.5 && canSee && !isNearby && !(canHear && dist < 8)) {
      // encore calme, elle aperçoit quelqu'un : au lieu de charger, elle va se tapir dans le noir pour l'observer
      const spot = this.darkSpot(map, P, M, 8, 20, true);
      if (spot) {
        M.mode = 'stalk';
        M.watch = spot;
        M.silent = true;
        M.repathT = 0;
        canSee = false;
      }
    }

    // à l'abri dans la lumière : elle ne s'y lance qu'à bout portant ; si elle le poursuivait, elle s'arrête au bord
    // de l'ombre et l'observe
    if (safe) {
      canSee = canSee && dist < 3.5;
      canHear = canHear && dist < 2.5;
      isNearby = dist < 1.8;
      if ((M.mode === 'chase' || M.mode === 'search') && dist > 2.2 && !(M.rushT > 0)) {
        M.edgeT += DT;
        if (M.edgeT > 1.0 + rage * 1.5) {
          M.edgeT = 0;
          M.mode = 'watch';
          M.waitT = rand(4, 8);
          M.watch = null;
          M.path = [];
          M.silent = true;
          M.lurk = false;
          this.emit({ type: 'lost', id: P.id });
        }
      } else M.edgeT = 0;
    } else M.edgeT = 0;

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
      if (M.mode !== 'chase') {
        this.chases++;
        this.emit({ type: 'spotted', heard: !canSee && canHear, id: P.id });
      }
      M.mode = 'chase';
      M.watch = null;
      M.silent = false;
      if (M.unseenT > 0) M.repathT = 0; // elle le revoit : droit sur lui
      M.unseenT = 0;
      M.lastSeenX = P.x;
      M.lastSeenZ = P.z;
      M.lastYaw = P.yaw;
    } else if (M.mode === 'chase') {
      // hors de vue : elle ne sait plus où il est. Elle court jusqu'à l'endroit où elle l'a vu pour la dernière fois,
      // puis fouille les environs ; au bout de quelques secondes sans le voir, le joueur l'a semée
      if (M.unseenT === 0) M.repathT = 0;
      M.unseenT += DT;
      const atLast = Math.hypot(M.x - M.lastSeenX, M.z - M.lastSeenZ) < 1.5;
      if (atLast || M.unseenT > LOSE_TRACK_T + rage * 4 + A * 3 || !same) {
        M.mode = 'search';
        M.repathT = 0;
        // elle retient l'endroit où on l'a semée : elle y reviendra se poster
        if (same) {
          M.escapes.push({ x: M.lastSeenX, z: M.lastSeenZ });
          if (M.escapes.length > 4) M.escapes.shift();
        }
        this.emit({ type: 'lost', id: P.id });
      }
    }

    // Level 0 : elle triche. Quand aucun joueur ne l'a dans son champ de vision, elle se téléporte : juste derrière
    // un angle devant sa proie (on tombe nez à nez avec elle), dans son dos (elle approche sans un bruit), ou très
    // loin (on se retourne, elle a disparu)
    if (this.level === 0) this.monsterWarp(M, P, calm, A, rage);

    // Vitesse selon le mode, la colère et le noir
    const k = (1 + rage * 0.35 + (dark ? 0.1 : 0)) * (0.9 + A * 0.22);
    M.burstT = Math.max(0, M.burstT - DT);
    if (M.mode === 'search' && M.probe) M.searchT = Math.max(0, (M.searchT || 0) - DT);
    if (M.mode === 'chase') M.speed = this.monsterChaseSpeed * k * (M.rushT > 0 ? 1.25 : M.burstT > 0 ? 1.15 : 1) * (this.chases <= 1 && !(M.rushT > 0) ? 0.86 : 1);
    else if (M.mode === 'search') M.speed = MONSTER_PATROL_SPEED * 1.3 * k;
    else if (M.mode === 'ambush') M.speed = MONSTER_PATROL_SPEED * 1.5;
    else if (M.mode === 'flee') M.speed = this.monsterChaseSpeed * 1.05;
    else if (M.mode === 'stalk') M.speed = MONSTER_PATROL_SPEED * 1.15;
    else if (M.mode === 'watch') M.speed = 0;
    else M.speed = MONSTER_PATROL_SPEED * (1 + rage * 0.5) * (calm ? 0.8 : 1);
    if (calm && M.mode === 'patrol') M.silent = true;
    else if (M.mode === 'patrol' && !calm) M.silent = false;

    // En ronde, elle va souvent se tapir dans un coin sombre pour observer les joueurs de loin (de moins en moins à
    // mesure qu'elle s'énerve)
    if (M.mode === 'patrol' && same) {
      M.stalkT -= DT;
      if (M.stalkT <= 0) {
        M.stalkT = rand(6, 12);
        if (!calm && dist < 40 && Math.random() < 0.6 - A * 0.45) {
          const spot = this.darkSpot(map, P, M, 8, 20, true);
          if (spot) {
            M.mode = 'stalk';
            M.watch = spot;
            M.silent = true;
            M.repathT = 0;
          }
        }
      }
    }
    if (M.mode === 'stalk' || M.mode === 'flee') {
      if (!same) M.mode = 'patrol';
      else if (Math.hypot(M.x - M.watch.x, M.z - M.watch.z) < 0.6) {
        // arrivée dans le noir : elle se fige et regarde (après une fuite, elle se calme un peu plus longtemps)
        M.waitT = M.mode === 'flee' ? rand(4, 8) : rand(6, 12) * (1 - A * 0.5);
        M.mode = 'watch';
        M.path = [];
      }
    } else if (M.mode === 'watch') {
      M.path = [];
      M.yaw = Math.atan2(P.x - M.x, P.z - M.z);
      M.waitT -= DT;
      if (M.waitT <= 0 || !same) {
        M.mode = 'patrol';
        M.silent = false;
        M.watch = null;
        M.stalkT = rand(3, 8);
        // Level 0 : on se retourne… elle n'est plus là
        if (this.level === 0) M.vanish = true;
        M.lurk = false;
      }
    }

    // Level 1 : en patrouille, elle contourne par les rangées d'étagères pour attendre le joueur plus loin ; Level 2 :
    // elle l'attend juste après un croisement
    if (M.mode === 'patrol' && (map.isAmbush || map.isShelfSide || M.escapes.length) && same && !calm) {
      M.ambushT -= DT;
      if (M.ambushT <= 0 && dist < 45) {
        const spot = (M.escapes.length && Math.random() < 0.5 ? this.escapeAmbush(P) : null) || (map.isAmbush || map.isShelfSide ? this.findAmbush(P) : null);
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

    // Recalcul de trajectoire. Sa proie est à l'autre étage : elle va à l'escalier le plus proche
    M.repathT -= DT;
    if (M.repathT <= 0) {
      M.repathT = M.mode === 'chase' ? 0.35 : 1.2;
      // en chasse, elle ne va droit sur le joueur que si elle le voit ou l'entend ; sinon, là où il était
      let tx = M.mode === 'chase' && M.unseenT > 0 ? M.lastSeenX : P.x;
      let tz = M.mode === 'chase' && M.unseenT > 0 ? M.lastSeenZ : P.z;
      if (!same && this.stairs.length && M.mode !== 'patrol') {
        // elle va au pied de l'escalier (étage du bas) ou à son arrivée (étage du haut)
        const foot = (s) => (M.floor > 0 ? s.down : s.up);
        const st = this.stairs.reduce((b, s) => (Math.hypot(foot(s).x - M.x, foot(s).z - M.z) < Math.hypot(foot(b).x - M.x, foot(b).z - M.z) ? s : b));
        tx = foot(st).x;
        tz = foot(st).z;
      } else if (M.mode === 'patrol') {
        if (!M.targetWander || Math.hypot(M.x - M.targetWander.x, M.z - M.targetWander.z) < 1.5) {
          // l'entité rôde : souvent non loin d'un joueur de son étage (de plus en plus quand elle s'énerve) ;
          // de temps en temps, elle change d'étage
          if (!same && this.stairs.length && Math.random() < 0.35 + rage * 0.4) {
            M.mode = 'search';
          } else {
            const near = calm
              ? map.walkable.filter((c) => Math.hypot((c.x + 0.5) * CELL_SIZE - P.x, (c.z + 0.5) * CELL_SIZE - P.z) > 30)
              : same && Math.random() < 0.5 + rage * 0.4 ? map.walkable.filter((c) => Math.hypot((c.x + 0.5) * CELL_SIZE - P.x, (c.z + 0.5) * CELL_SIZE - P.z) < 28 - rage * 12) : [];
            // Level 0 : elle rôde dans l'ombre, pas dans la lumière franche des zones claires
            const shade = this.level === 0 && !dark ? near.filter((c) => !this.brightCell(map, (c.x + 0.5) * CELL_SIZE, (c.z + 0.5) * CELL_SIZE)) : near;
            const pool = shade.length ? shade : near.length ? near : map.walkable;
            const c = pool[Math.floor(Math.random() * pool.length)];
            M.targetWander = { x: (c.x + 0.5) * CELL_SIZE, z: (c.z + 0.5) * CELL_SIZE };
          }
        }
        if (M.targetWander) {
          tx = M.targetWander.x;
          tz = M.targetWander.z;
        }
      } else if (M.mode === 'search') {
        // d'abord là où elle a vu (ou entendu) sa proie pour la dernière fois, puis elle fouille autour quelques secondes,
        // en commençant dans la direction où elle allait, avant de reprendre sa ronde
        if (M.probeFrom && (M.probeFrom.x !== M.lastSeenX || M.probeFrom.z !== M.lastSeenZ)) M.probe = null;
        const goal = M.probe || { x: M.lastSeenX, z: M.lastSeenZ };
        if (Math.hypot(M.x - goal.x, M.z - goal.z) < 2) {
          if (!M.probe) {
            M.searchT = 7 + rage * 5;
            M.probeFrom = { x: M.lastSeenX, z: M.lastSeenZ };
          }
          M.probe = this.searchProbe(map, M, !M.probe);
        }
        if (M.searchT <= 0 && M.probe) {
          M.mode = 'patrol';
          M.probe = null;
          M.probeFrom = null;
        }
        tx = M.probe ? M.probe.x : M.lastSeenX;
        tz = M.probe ? M.probe.z : M.lastSeenZ;
      } else if (M.mode === 'ambush') {
        tx = M.ambush.x;
        tz = M.ambush.z;
      } else if ((M.mode === 'stalk' || M.mode === 'flee') && M.watch) {
        tx = M.watch.x;
        tz = M.watch.z;
      } else if (M.mode === 'watch') {
        tx = M.x;
        tz = M.z;
      }
      M.goal = { x: tx, z: tz };
      const path = findPath(map, M.x, M.z, tx, tz);
      if (path && path.length > 0) {
        M.path = path;
        M.pathIndex = 0;
      }
    }

    // Avancement le long du chemin. Level 2 : elle n'entre pas dans un jet de vapeur qui crache, elle attend devant
    const go = (nx, nz) => {
      if (this.level === PIPES_LEVEL && this.steamAt(nx, nz) && !this.steamAt(M.x, M.z)) {
        M.steamWait = true;
        return;
      }
      M.steamWait = false;
      // elle contourne caisses, meubles et casiers au lieu de passer au travers
      for (const pr of map.props || []) {
        if (pr.walk) continue;
        const rr = pr.r + 0.32;
        const ex = nx - pr.x;
        const ez = nz - pr.z;
        const d = Math.hypot(ex, ez);
        if (d < rr && d > 1e-4) {
          nx = pr.x + (ex / d) * rr;
          nz = pr.z + (ez / d) * rr;
        }
      }
      for (const h of map.hides || []) {
        const rr = LOCKER_R + 0.3;
        const d = Math.hypot(nx - h.x, nz - h.z);
        if (d < rr && d > 1e-4) {
          nx = h.x + ((nx - h.x) / d) * rr;
          nz = h.z + ((nz - h.z) / d) * rr;
        }
      }
      if (this.blocked(cellOf(nx), cellOf(nz), M.floor)) return;
      M.x = nx;
      M.z = nz;
    };
    if (M.path && M.path.length > M.pathIndex) {
      const wp = M.path[M.pathIndex];
      const wdx = wp.x - M.x;
      const wdz = wp.z - M.z;
      const wdist = Math.hypot(wdx, wdz);
      if (wdist < 0.3) M.pathIndex++;
      else {
        const stepLen = Math.min(wdist, M.speed * DT);
        go(M.x + (wdx / wdist) * stepLen, M.z + (wdz / wdist) * stepLen);
        M.yaw = Math.atan2(wdx, wdz);
      }
    } else if (M.mode === 'chase' && same && dist > 0.1 && M.unseenT === 0) {
      const stepLen = Math.min(dist, M.speed * DT);
      go(M.x + (dx / dist) * stepLen, M.z + (dz / dist) * stepLen);
      M.yaw = Math.atan2(dx, dz);
    } else if (M.goal && cellOf(M.goal.x) === cellOf(M.x) && cellOf(M.goal.z) === cellOf(M.z) && Math.hypot(M.goal.x - M.x, M.goal.z - M.z) > 0.1) {
      // le but est dans sa case (pas de chemin à suivre) : tout droit
      const gx = M.goal.x - M.x;
      const gz = M.goal.z - M.z;
      const gd = Math.hypot(gx, gz);
      const stepLen = Math.min(gd, M.speed * DT);
      go(M.x + (gx / gd) * stepLen, M.z + (gz / gd) * stepLen);
      M.yaw = Math.atan2(gx, gz);
    }

    // l'entité prend l'escalier quand sa proie est à l'autre étage
    M.stairT = Math.max(0, M.stairT - DT);
    if (!same && M.stairT <= 0) {
      for (const st of this.stairs) {
        const up = M.floor > 0;
        const foot = up ? st.down : st.up;
        if (Math.hypot(foot.x - M.x, foot.z - M.z) > 0.6) continue;
        M.floor += up ? -1 : 1;
        const to = up ? st.up : st.down;
        M.x = to.x;
        M.z = to.z;
        M.path = [];
        M.repathT = 0;
        M.stairT = 3;
        M.mode = 'search';
        M.lastSeenX = P.x + rand(-5, 5);
        M.lastSeenZ = P.z + rand(-5, 5);
        this.emit({ type: 'monsterStairs', floor: M.floor });
        break;
      }
    }

    // L'entité attrape le joueur : la première fois, elle l'agrippe (on peut se dégager) ; la seconde est mortelle
    const reach = P.hidden >= 0 ? 1.4 : 1.15;
    if (same && dist < reach && (P.hidden < 0 || M.sawHide === P.hidden)) {
      if (P.hidden >= 0) this.leaveHide(P);
      if (P.grabs >= 1 || this.difficulty === 'hard' && this.rage >= 1) {
        this.killPlayer(P, { x: M.x, z: M.z });
        this.afterCatch(M);
        return;
      }
      P.grabs++;
      P.grabT = GRAB_T * (this.difficulty === 'hard' ? 0.8 : 1);
      P.struggle = 0;
      P.running = false;
      P.crouch = false;
      M.mode = 'grab';
      M.grabbing = P.id;
      M.path = [];
      M.yaw = Math.atan2(P.x - M.x, P.z - M.z);
      this.emit({ type: 'grab', id: P.id, name: P.name, x: M.x, z: M.z, floor: M.floor });
    }
  }

  // La prise : on se débat (n'importe quelle touche), ou un coéquipier l'aveugle avec sa lampe ; sinon c'est la fin
  updateGrab(M) {
    const G = this.players.find((Q) => Q.id === M.grabbing);
    if (!G || G.status !== 'alive') {
      this.afterCatch(M);
      return;
    }
    M.speed = 0;
    M.silent = false;
    // elle le tient face à elle
    const a = Math.atan2(G.x - M.x, G.z - M.z);
    M.yaw = a;
    G.yaw = a + Math.PI;
    G.pitch = 0.05;
    G.grabT -= DT;
    const need = GRAB_STRUGGLES + (this.difficulty === 'hard' ? 3 : 0);
    const blinded = this.players.some((Q) => Q !== G && Q.status === 'alive' && Q.flashlight && Q.floor === M.floor && Math.hypot(Q.x - M.x, Q.z - M.z) < 12 && this.facing(Q, M.x, M.z) < 0.35 && hasLineOfSight(this.fm(M.floor), Q.x, Q.z, M.x, M.z));
    if (G.struggle >= need || blinded) {
      G.grabT = 0;
      G.struggle = 0;
      G.lockT = 0.3;
      G.stamina = Math.min(100, G.stamina + 35);
      G.winded = 0;
      M.mode = 'stun';
      M.stunT = MONSTER_STUN_T;
      M.grabbing = null;
      M.unseenT = 0;
      // elle recule d'un pas
      const back = this.moveWithCollisions(M.x, M.z, -Math.sin(a) * 0.9, -Math.cos(a) * 0.9, 0.3, M.floor);
      M.x = back.x;
      M.z = back.z;
      this.emit({ type: 'release', id: G.id, escaped: true, blinded, x: M.x, z: M.z, floor: M.floor });
      return;
    }
    if (G.grabT <= 0) {
      G.grabT = 0;
      this.killPlayer(G, { x: M.x, z: M.z });
      this.afterCatch(M);
    }
  }

  // après une victime : elle repart en ronde, loin de la cabine
  afterCatch(M) {
    M.mode = 'patrol';
    M.grabbing = null;
    M.target = null;
    M.path = [];
    M.ambushT = 6;
    M.sawHide = -1;
  }

  // angle entre le regard de l'entité et un point (0 : droit devant elle)
  angleTo(M, x, z) {
    let d = Math.atan2(x - M.x, z - M.z) - M.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return d;
  }

  // une embuscade là où on l'a déjà semée, si le joueur s'en approche (hors de sa vue)
  escapeAmbush(P) {
    const map = this.fm(P.floor);
    let best = null;
    let bd = Infinity;
    for (const e of this.monster.escapes) {
      const d = Math.hypot(e.x - P.x, e.z - P.z);
      if (d < 8 || d > 30 || d >= bd) continue;
      if (hasLineOfSight(map, P.x, P.z, e.x, e.z)) continue;
      const gx = cellOf(e.x);
      const gz = cellOf(e.z);
      if (map.isWall(gx, gz)) continue;
      best = { x: (gx + 0.5) * CELL_SIZE, z: (gz + 0.5) * CELL_SIZE, gx, gz };
      bd = d;
    }
    return best;
  }

  // angle entre là où regarde le joueur et un point (0 : droit devant)
  facing(P, x, z) {
    let d = Math.atan2(-(x - P.x), -(z - P.z)) - P.yaw;
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    return Math.abs(d);
  }

  // la case la plus sombre possible (aucun néon allumé tout autour, sinon le moins possible), entre rMin et rMax du
  // joueur ; seen : d'où on le voit. map.darkCells : 0 pour le noir complet, plus pour chaque néon allumé à côté
  // Level 0 : une case dans la lumière franche d'une zone claire (sous ou à côté d'un néon d'une zone où tous marchent)
  brightCell(map, x, z) {
    if (!map.brightCells) {
      map.brightCells = new Uint8Array(map.W * map.H);
      for (const l of map.lights || []) {
        if (!l.bright || l.state !== 'on') continue;
        for (let dz = -1; dz <= 1; dz++) {
          for (let dx = -1; dx <= 1; dx++) {
            const gx = l.gx + dx;
            const gz = l.gz + dz;
            if (gx >= 0 && gz >= 0 && gx < map.W && gz < map.H) map.brightCells[gz * map.W + gx] = 1;
          }
        }
      }
    }
    const gx = cellOf(x);
    const gz = cellOf(z);
    return gx >= 0 && gz >= 0 && gx < map.W && gz < map.H && map.brightCells[gz * map.W + gx] === 1;
  }

  // ce point est-il dans le champ de vision d'un joueur ? (dans le cadre de sa caméra, rien entre eux ; tout près,
  // on la sentirait même dans son dos)
  inSomeView(floor, x, z, margin = 0) {
    const map = this.fm(floor);
    for (const Q of this.players) {
      if (Q.status !== 'alive' || (Q.floor || 0) !== floor) continue;
      const d = Math.hypot(Q.x - x, Q.z - z);
      if (d < 3.5) return true;
      if (d > 60 || this.facing(Q, x, z) > 1.05 + margin) continue;
      if (hasLineOfSight(map, Q.x, Q.z, x, z)) return true;
    }
    return false;
  }

  // Où réapparaître sans être vue. kind : 'corner' (devant sa proie, à quelques pas de marche, caché juste derrière un
  // angle qu'elle va passer), 'behind' (dans son dos, dans l'ombre), 'far' (loin de tout le monde)
  warpSpot(P, kind) {
    const floor = P.floor || 0;
    const map = this.fm(floor);
    const W = map.W;
    const pd = bfs(map.grid, W, map.H, cellOf(P.x), cellOf(P.z));
    const stairCell = new Set((this.stairs || []).flatMap((st) => st.cells.map((k) => k.gz * W + k.gx)));
    const dark = this.blackout > 0;
    let best = null;
    let bestS = Infinity;
    for (const c of map.walkable || []) {
      const i = c.z * W + c.x;
      const d = pd[i];
      if (d < 0 || stairCell.has(i)) continue;
      if (kind === 'corner' && (d < 3 || d > 8)) continue;
      if (kind === 'behind' && (d < 2 || d > 6)) continue;
      const x = (c.x + 0.5) * CELL_SIZE;
      const z = (c.z + 0.5) * CELL_SIZE;
      const e = Math.hypot(x - P.x, z - P.z);
      if (kind === 'far' ? this.players.some((Q) => Q.status === 'alive' && (Q.floor || 0) === floor && Math.hypot(Q.x - x, Q.z - z) < 30) : e < 5.5) continue;
      if (map.pitAt && map.pitAt(c.x, c.z) >= 0) continue;
      if (!dark && this.brightCell(map, x, z)) continue;
      if ((map.props || []).some((pr) => Math.hypot(pr.x - x, pr.z - z) < pr.r + 0.6)) continue;
      const ang = this.facing(P, x, z);
      if (kind === 'corner' && ang > 1.1) continue;
      if (kind === 'behind' && ang < 2.0) continue;
      if (this.inSomeView(floor, x, z, 0.2)) continue;
      let s = Math.random() * 2;
      if (kind === 'corner') {
        // juste derrière un angle : une case voisine est déjà en vue du joueur
        const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => {
          const nx = c.x + dx;
          const nz = c.z + dz;
          return pd[nz * W + nx] >= 0 && hasLineOfSight(map, P.x, P.z, (nx + 0.5) * CELL_SIZE, (nz + 0.5) * CELL_SIZE);
        });
        if (!edge) continue;
        s += ang * 3 + Math.abs(d - 5);
      } else if (kind === 'behind') s += Math.abs(d - 3) + (Math.PI - ang) * 2;
      else s += Math.random() * 4;
      if (s < bestS) {
        bestS = s;
        best = { x, z, floor };
      }
    }
    return best;
  }

  // la téléportation elle-même : elle n'arrive ni ne disparaît jamais sous les yeux d'un joueur
  monsterWarp(M, P, calm, A, rage) {
    const unseen = !this.inSomeView(M.floor || 0, M.x, M.z, 0.15);
    M.unseenAllT = unseen ? M.unseenAllT + DT : 0;
    M.warpT -= DT;
    if (!unseen || M.unseenAllT < 1.2 || P.status !== 'alive') return;
    const place = (spot) => {
      M.x = spot.x;
      M.z = spot.z;
      M.floor = spot.floor;
      M.path = [];
      M.pathIndex = 0;
      M.repathT = 0;
      M.targetWander = null;
      M.unseenAllT = 0;
    };
    // elle a fini d'observer : dès qu'on ne la regarde plus, elle n'est plus là
    if (M.vanish) {
      M.vanish = false;
      if (M.mode === 'patrol' || M.mode === 'stalk') {
        const spot = this.warpSpot(P, 'far');
        if (spot) {
          place(spot);
          M.mode = 'patrol';
          this.emit({ type: 'warp', kind: 'far' });
        }
      }
      return;
    }
    if (M.warpT > 0 || calm || (M.mode !== 'patrol' && M.mode !== 'search') || P.hidden >= 0) return;
    M.warpT = rand(20, 38) * (1 - A * 0.35) * (1 - rage * 0.3);
    const kind = Math.random() < 0.65 ? 'corner' : 'behind';
    const spot = this.warpSpot(P, kind) || (kind === 'behind' ? this.warpSpot(P, 'corner') : null);
    if (!spot) return;
    place(spot);
    M.yaw = Math.atan2(P.x - M.x, P.z - M.z);
    if (kind === 'corner') {
      // postée, immobile et muette, face à l'endroit d'où il va surgir
      M.mode = 'watch';
      M.lurk = true;
      M.waitT = rand(10, 16);
      M.watch = null;
      M.silent = true;
    } else {
      // elle s'approche par derrière, sans un bruit
      M.mode = 'search';
      M.silent = true;
      M.probe = null;
      M.probeFrom = null;
      M.lastSeenX = P.x;
      M.lastSeenZ = P.z;
    }
    this.emit({ type: 'warp', kind });
  }

  // une case éclairée par un néon allumé (le sien ou un voisin direct)
  litCell(map, x, z) {
    this.darkCellsOf(map);
    const gx = Math.floor(x / CELL_SIZE);
    const gz = Math.floor(z / CELL_SIZE);
    return gx >= 0 && gz >= 0 && gx < map.W && gz < map.H && map.darkCells[gz * map.W + gx] >= 3;
  }

  darkCellsOf(map) {
    if (!map.darkCells) {
      map.darkCells = new Uint8Array(map.W * map.H);
      for (const l of map.lights || []) {
        if (l.state !== 'on') continue;
        for (let dz = -2; dz <= 2; dz++) {
          for (let dx = -2; dx <= 2; dx++) {
            const x = l.gx + dx;
            const z = l.gz + dz;
            if (x < 0 || z < 0 || x >= map.W || z >= map.H) continue;
            const k = z * map.W + x;
            map.darkCells[k] = Math.min(255, map.darkCells[k] + (Math.max(Math.abs(dx), Math.abs(dz)) <= 1 ? 3 : 1));
          }
        }
      }
    }
    return map.darkCells;
  }

  darkSpot(map, P, M, rMin, rMax, seen) {
    this.darkCellsOf(map);
    const R = Math.ceil(rMax / CELL_SIZE);
    const cx = Math.floor(P.x / CELL_SIZE);
    const cz = Math.floor(P.z / CELL_SIZE);
    let best = null;
    let bestS = Infinity;
    for (let gz = cz - R; gz <= cz + R; gz++) {
      for (let gx = cx - R; gx <= cx + R; gx++) {
        if (map.isWall(gx, gz) || (map.pitAt && map.pitAt(gx, gz) >= 0)) continue;
        const x = (gx + 0.5) * CELL_SIZE;
        const z = (gz + 0.5) * CELL_SIZE;
        const d = Math.hypot(x - P.x, z - P.z);
        if (d < rMin || d > rMax) continue;
        const dark = map.darkCells[gz * map.W + gx];
        if (seen && !hasLineOfSight(map, x, z, P.x, P.z)) continue;
        // le plus sombre, puis le plus près d'elle, et pas en plein dans le regard du joueur
        const sc = dark * 40 + Math.hypot(x - M.x, z - M.z) + (this.facing(P, x, z) < 0.4 ? 15 : 0);
        if (sc < bestS) {
          bestS = sc;
          best = { x, z };
        }
      }
    }
    return best;
  }

  // Fouille : une case libre près du dernier endroit où elle a vu sa proie (la première dans la direction où elle filait)
  searchProbe(map, M, first) {
    const ox = M.lastSeenX + (first && M.lastYaw !== undefined ? -Math.sin(M.lastYaw) * 6 : 0);
    const oz = M.lastSeenZ + (first && M.lastYaw !== undefined ? -Math.cos(M.lastYaw) * 6 : 0);
    const R = first ? 4 : 9;
    const near = map.walkable.filter((c) => {
      const d = Math.hypot((c.x + 0.5) * CELL_SIZE - ox, (c.z + 0.5) * CELL_SIZE - oz);
      return d < R && Math.hypot((c.x + 0.5) * CELL_SIZE - M.x, (c.z + 0.5) * CELL_SIZE - M.z) > 2.5;
    });
    if (!near.length) return { x: M.lastSeenX, z: M.lastSeenZ };
    const c = near[Math.floor(Math.random() * near.length)];
    return { x: (c.x + 0.5) * CELL_SIZE, z: (c.z + 0.5) * CELL_SIZE };
  }

  // Une case au bout ou le long d'une rangée d'étagères, sur la route probable du joueur et hors de sa vue
  findAmbush(P) {
    const map = this.fm(P.floor);
    const fx = -Math.sin(P.yaw);
    const fz = -Math.cos(P.yaw);
    const px = P.x + fx * 10;
    const pz = P.z + fz * 10;
    let best = null;
    let bestD = Infinity;
    for (const c of map.walkable) {
      const x = (c.x + 0.5) * CELL_SIZE;
      const z = (c.z + 0.5) * CELL_SIZE;
      const dp = Math.hypot(x - px, z - pz);
      if (dp > 8 || dp >= bestD) continue;
      if (Math.hypot(x - P.x, z - P.z) < 7) continue;
      if (!(map.isAmbush ? map.isAmbush(c.x, c.z) : map.isShelfSide(c.x, c.z))) continue;
      if (hasLineOfSight(map, P.x, P.z, x, z)) continue;
      best = { x, z, gx: c.x, gz: c.z };
      bestD = dp;
    }
    return best;
  }
}
