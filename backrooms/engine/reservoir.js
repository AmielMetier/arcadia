// The Backrooms (Level 26) - Le Bassin de rétention : un immense réservoir souterrain, après le toboggan bleu des
// Poolrooms. Une halle de béton de 80 m de côté, une forêt de piliers tous les 7,50 m, et de l'eau noire jusqu'à la
// taille. Autour, dans les murs : la salle d'arrivée (où l'on tombe du toboggan) et quatre salles des pompes, au sec
// derrière leur seuil. Remettre les quatre pompes en route (rester devant le volant, comme les vannes des Tuyauteries)
// fait baisser l'eau d'un quart à chaque fois ; l'ascenseur de maintenance, au fond du bassin, ne part qu'une fois les
// quatre pompes lancées.
// L'entité y chasse au bruit : marcher dans l'eau s'entend, y courir encore plus. Tant que l'eau est haute, on ne voit
// d'elle qu'un dos qui affleure (scene.js l'enfonce de wetAt) : plus le bassin se vide, plus on la voit.
// Même forme de carte que les Tuyauteries (grid, zone, valves…) : le moteur et la scène les lisent de la même façon.
import { CELL_SIZE, T, bfs, blocks, carveElevator, itemList, shuffle } from './map.js';
import { Z, VALVES } from './level2.js';

// numéro interne de ce niveau (affiché « Level 26 ») : après les Poolrooms, par le toboggan bleu
export const RESERVOIR_LEVEL = 6;
export const RES_SIZE = 46;
export const RES_CEIL = 5.6;
export const WATER_MAX = 1.05; // m d'eau dans le bassin à l'arrivée (jusqu'à la taille)
export const DRAIN_RATE = 0.06; // part du bassin vidée par seconde, quand une pompe vient de repartir
export const PUMPS = VALVES; // (le même code que les vannes des Tuyauteries : quatre volants)
const HALL = { x0: 7, z0: 7, x1: 38, z1: 38 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function createReservoirMap(seed = 26) {
  const W = RES_SIZE;
  const H = RES_SIZE;
  const C = CELL_SIZE;
  const grid = new Uint8Array(W * H).fill(T.WALL);
  const zone = new Uint8Array(W * H);
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const get = (x, z) => (x < 0 || x >= W || z < 0 || z >= H ? T.WALL : grid[z * W + x]);
  const carve = (x, z, zn) => {
    grid[z * W + x] = T.FLOOR;
    zone[z * W + x] = zn;
  };
  const cellPos = (c) => ({ x: (c.x + 0.5) * C, z: (c.z + 0.5) * C, gx: c.x, gz: c.z });
  const inHall = (gx, gz) => gx >= HALL.x0 && gx <= HALL.x1 && gz >= HALL.z0 && gz <= HALL.z1;

  // 1. Le bassin : la halle, ses piliers tous les 3 cases (2 cases de passage le long des murs), quelques-uns tombés
  const rooms = [];
  const halls = [];
  const pillars = {};
  for (let z = HALL.z0; z <= HALL.z1; z++) for (let x = HALL.x0; x <= HALL.x1; x++) carve(x, z, Z.HALL);
  const hall = { ...HALL, type: 'hall', doors: [], tanks: [], st: 3, px: HALL.x0 + 2, pz: HALL.z0 + 2, basin: true };
  for (let z = hall.pz; z <= HALL.z1 - 2; z += 3) {
    for (let x = hall.px; x <= HALL.x1 - 2; x += 3) {
      if (rnd() < 0.04) continue;
      grid[z * W + x] = T.PILLAR;
      pillars[z * W + x] = { x: (x + 0.5) * C, z: (z + 0.5) * C, h: 0.5, round: false, hall: true };
    }
  }
  halls.push(hall);
  rooms.push(hall);

  // 2. Les salles autour, chacune derrière une porte d'une case percée dans le mur du bassin : la salle d'arrivée au
  // sud, et les quatre salles des pompes (ouest, est, et deux au nord, de part et d'autre de l'ascenseur)
  const room = (x0, z0, x1, z1, door, type, zn) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) carve(x, z, zn);
    carve(door.gx, door.gz, zn);
    const r = { x0, z0, x1, z1, type, doors: [door] };
    rooms.push(r);
    hall.doors.push(door);
    return r;
  };
  const jit = (n) => Math.floor(rnd() * (2 * n + 1)) - n;
  const ax = 22 + jit(3);
  const arrival = room(ax - 2, 40, ax + 3, 43, { gx: ax, gz: 39 }, 'arrival', Z.TILE);
  const wz = 20 + jit(4);
  const ez = 24 + jit(4);
  const nwx = 12 + jit(2);
  const nex = 32 + jit(2);
  const pumpRooms = [
    room(1, wz - 2, 5, wz + 3, { gx: 6, gz: wz }, 'boiler', Z.BOILER),
    room(40, ez - 3, 44, ez + 2, { gx: 39, gz: ez }, 'boiler', Z.BOILER),
    room(nwx - 3, 1, nwx + 2, 5, { gx: nwx, gz: 6 }, 'boiler', Z.BOILER),
    room(nex - 2, 1, nex + 3, 5, { gx: nex, gz: 6 }, 'boiler', Z.BOILER),
  ];
  const sx = ax;
  const sz = 42;

  // 3. L'ascenseur de maintenance : creusé dans le mur nord du bassin, entre les deux salles du nord
  let elevator = null;
  let exitCell = null;
  const north = shuffle(Array.from({ length: 9 }, (_, i) => ({ x: 18 + i, z: HALL.z0 })), rnd);
  for (const c of north) {
    if (get(c.x, c.z) !== T.FLOOR) continue;
    elevator = carveElevator(grid, W, H, c, { x: sx, z: sz }, rnd);
    if (elevator) {
      exitCell = c;
      break;
    }
  }
  const dist = bfs(grid, W, H, sx, sz);
  const D = (c) => dist[c.z * W + c.x];
  const walkable = [];
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (grid[z * W + x] === T.FLOOR && dist[z * W + x] >= 0) walkable.push({ x, z });
  const maxD = Math.max(1, ...walkable.map(D));

  // 4. Les pompes : dans chaque salle, le volant au mur le plus loin de la porte ; une ou deux pompes (les « chaudières »
  // des Tuyauteries) dans les coins qui restent, sans boucher le passage
  const valves = [];
  const boilers = [];
  pumpRooms.forEach((r, i) => {
    const door = r.doors[0];
    const spots = [];
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        for (const [dx, dz] of DIRS) {
          if (get(x + dx, z + dz) !== T.WALL || (x + dx === door.gx && z + dz === door.gz)) continue;
          spots.push({ x, z, dx, dz, d: Math.abs(x - door.gx) + Math.abs(z - door.gz) });
        }
      }
    }
    spots.sort((a, b) => b.d - a.d);
    const v = spots[Math.floor(rnd() * Math.min(3, spots.length))];
    const corners = shuffle([[r.x0, r.z0], [r.x1, r.z0], [r.x0, r.z1], [r.x1, r.z1]], rnd);
    let n = 0;
    for (const [x, z] of corners) {
      if (n >= 2 || Math.abs(x - v.x) + Math.abs(z - v.z) < 2 || Math.abs(x - door.gx) + Math.abs(z - door.gz) <= 2) continue;
      grid[z * W + x] = T.MACHINE;
      boilers.push({ gx: x, gz: z, x: (x + 0.5) * C, z: (z + 0.5) * C, valve: i });
      n++;
    }
    const cx = (v.x + 0.5) * C;
    const cz = (v.z + 0.5) * C;
    valves.push({ id: i, gx: v.x, gz: v.z, dx: v.dx, dz: v.dz, x: cx + v.dx * (C / 2 - 0.2), z: cz + v.dz * (C / 2 - 0.2), sx: cx + v.dx * 0.35, sz: cz + v.dz * 0.35, closed: false, turn: 0, power: 0 });
  });

  // 5. La lumière : des suspensions au-dessus du bassin, une sur trois éteinte (le noir entre elles), quelques-unes qui
  // grésillent ; un tube dans chaque salle
  const lights = [];
  for (let z = HALL.z0 + 3; z <= HALL.z1 - 3; z += 6) {
    for (let x = HALL.x0 + 3; x <= HALL.x1 - 3; x += 6) {
      if (get(x, z) !== T.FLOOR) continue;
      const r = rnd();
      const state = r < 0.34 ? 'off' : r < 0.46 ? 'flicker' : 'on';
      lights.push({ kind: 'bulb', hang: true, x: (x + 0.5) * C, y: RES_CEIL - 1.3, z: (z + 0.5) * C, gx: x, gz: z, wall: null, state, flicker: state === 'flicker' });
    }
  }
  for (const r of rooms) {
    if (r === hall) continue;
    const mx = Math.round((r.x0 + r.x1) / 2);
    const mz = Math.round((r.z0 + r.z1) / 2);
    const gx = get(mx, mz) === T.FLOOR ? mx : r.doors[0].gx;
    const gz = get(mx, mz) === T.FLOOR ? mz : r.doors[0].gz;
    lights.push({ kind: 'tube', x: (gx + 0.5) * C, y: RES_CEIL - 0.42, z: (gz + 0.5) * C, gx, gz, wall: null, state: 'on', flicker: r.type === 'boiler' && rnd() < 0.4, alongX: r.x1 - r.x0 >= r.z1 - r.z0 });
  }

  // 6. Eau d'amande et piles : la plupart dans le bassin (il faut y aller), quelques-unes au sec dans les salles
  const busy = new Set(valves.map((v) => v.gz * W + v.gx));
  const scatter = (n, minD) => {
    const out = [];
    for (let i = 0; i < 500 && out.length < n; i++) {
      const c = pick(walkable);
      const k = c.z * W + c.x;
      if (busy.has(k) || D(c) < minD) continue;
      busy.add(k);
      out.push({ id: out.length, ...cellPos(c), taken: false });
    }
    return out;
  };
  const bottles = scatter(10, 6);
  const batteries = scatter(9, 5);

  // 7. L'entité part du fond du bassin, loin de l'arrivée
  const far = walkable.filter((c) => inHall(c.x, c.z) && D(c) > maxD * 0.6);
  const monsterCell = pick(far.length ? far : walkable);

  const open = (x, z) => x >= 0 && z >= 0 && x < W && z < H && !blocks(grid[z * W + x]);
  const map = {
    level: RESERVOIR_LEVEL,
    ceil: RES_CEIL,
    W,
    H,
    grid,
    zone,
    rooms,
    walkable,
    spawn: cellPos({ x: sx, z: sz }),
    exit: cellPos(exitCell),
    elevator,
    cassettes: [],
    fuses: [],
    valves,
    breakers: [],
    boilers,
    plant: [],
    gates: [],
    jets: [],
    halls,
    tanks: [],
    niches: [],
    straw: [],
    den: null,
    goatSpawn: [],
    lights,
    props: [],
    bottles,
    batteries,
    items: itemList(['bottle', bottles], ['battery', batteries]),
    pits: [],
    niche: null,
    pitAt: () => -1,
    dist,
    monsterSpawn: cellPos(monsterCell),
    arrivalRoom: arrival, // (pas « arrival » : c'est la cabine d'arrivée du Level 1 pour le moteur)
    basin: HALL,
    // l'eau du bassin : 1 plein, 0 vide (le moteur la fait baisser à chaque pompe remise en route : sim.drainStep)
    water: 1,
    // la hauteur d'eau en un point (m) : seulement dans le bassin ; les salles, derrière leur seuil, restent au sec
    wetAt(x, z) {
      return inHall(Math.floor(x / C), Math.floor(z / C)) ? this.water * WATER_MAX : 0;
    },
    isWall(gx, gz) {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
      return blocks(grid[gz * W + gx]);
    },
    isWalkableWorld(wx, wz) {
      return !this.isWall(Math.floor(wx / C), Math.floor(wz / C));
    },
    pillarAt(gx, gz) {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return null;
      const k = gz * W + gx;
      return grid[k] === T.PILLAR ? pillars[k] || null : null;
    },
    seeThrough: () => false,
    jetAt: () => null,
    // embuscade : au pied d'un pilier, dans le bassin
    isAmbush(gx, gz) {
      return open(gx, gz) && inHall(gx, gz) && DIRS.some(([dx, dz]) => get(gx + dx, gz + dz) === T.PILLAR);
    },
  };
  return map;
}
