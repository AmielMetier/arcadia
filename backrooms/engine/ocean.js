// The Backrooms (Level 7) - « Thalassophobia » : une mer sans fin dans la brume, au bout du toboggan bleu des
// Poolrooms. On arrive sur un îlot de roches et de sable, une barque à moteur amarrée au ponton. D'autres îlots
// sortent de la brume au loin ; sur trois d'entre eux, un bidon d'essence ; sur un autre, l'épave d'un navire. Tout
// au bout, une porte ordinaire plantée sur un dernier îlot : la sortie.
// La barque (le « radeau » du code) : F tout près pour monter (le premier à bord tient la barre), ZQSD à la barre pour avancer et tourner, F à
// bord pour descendre sur la terre la plus proche (il faut être à quai). Le moteur boit l'essence : de quoi atteindre
// le premier îlot au départ, chaque bidon en rajoute.
// Sous la surface, quelque chose d'immense (le monstre du moteur, sim.monster, mais qui ne quitte jamais l'eau) : il
// entend le moteur de loin et fond sur le radeau. Couper le moteur (lâcher la barre) : il passe dessous, tourne, et
// s'en va. S'il atteint le radeau en marche, il emporte quelqu'un par le fond ; il guette aussi les bords des îlots.
// Le sonar (HUD) montre où il est. Même forme de carte que le Level 0 (grid, cassettes, props…) : la scène n'en garde
// que les objets (map.outdoor : ni sol, ni plafond, ni néons) ; la mer, le ciel, les îlots et la barque sont dans
// view/ocean.js.
import { CELL_SIZE, T, bfs, blocks, itemList, shuffle, WALL_HEIGHT } from './map.js';

// numéro interne de ce niveau (affiché « Level 7 ») : après les Poolrooms, par le toboggan bleu
export const OCEAN_LEVEL = 6;
export const OCEAN_SIZE = 64;
export const CANS = 3;
export const SEA_Y = -0.42; // la surface de l'eau, sous le niveau des îlots (le plancher des bureaux, à 0)
export const DECK = 0.12; // la profondeur des pieds de ceux qui sont à bord, sous le plancher (depthAt)
// le radeau : demi-largeur et demi-longueur (m), vitesses (m/s, rad/s), essence (part du réservoir par mètre)
export const RAFT = { hw: 0.85, hl: 2.1, speed: 3.4, back: 1.2, turn: 0.75, accel: 1.4, drag: 0.9 };
export const FUEL_START = 0.32;
export const FUEL_CAN = 0.38;
export const FUEL_PER_M = 1 / 210;
export const BOARD_R = 3.3; // m du centre de la barque : on peut monter (de son arrière, au bord de l'îlot)
export const LAND_R = 3.4; // m : à bord, la terre la plus proche où descendre
// les places à bord (repère du radeau : x à droite, z vers l'avant) ; la première tient la barre, à l'arrière
export const SEATS = [
  { x: 0, z: -1.45 },
  { x: -0.32, z: -0.55 },
  { x: 0.32, z: -0.55 },
  { x: -0.32, z: 0.35 },
  { x: 0.32, z: 0.35 },
  { x: 0, z: 1.15 },
];
// la chose sous l'eau
export const LEVI = { hear: 75, roam: 2.2, hunt: 5.6, strike: 4.6, shore: 2.6, lose: 3.5, rest: 22, away: 48 };

const C = CELL_SIZE;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function createOceanMap(seed = 7) {
  const W = OCEAN_SIZE;
  const H = OCEAN_SIZE;
  const grid = new Uint8Array(W * H).fill(T.FLOOR);
  const sea = new Uint8Array(W * H).fill(1);
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const cellPos = (c) => ({ x: (c.x + 0.5) * C, z: (c.z + 0.5) * C, gx: c.x, gz: c.z });

  // 1. Les îlots : le départ au sud, la porte au nord, trois îlots à bidon entre les deux, et quelques îlots vides
  // (des leurres) ; jamais collés les uns aux autres (au moins 7 cases d'eau)
  const islets = [];
  const fits = (x0, z0, w, h, gap) => x0 >= 3 && z0 >= 3 && x0 + w <= W - 3 && z0 + h <= H - 3 && islets.every((o) => x0 + w + gap <= o.x0 || o.x0 + o.w + gap <= x0 || z0 + h + gap <= o.z0 || o.z0 + o.h + gap <= z0);
  const islet = (x0, z0, w, h, kind) => {
    const o = { id: islets.length, x0, z0, w, h, kind, cx: (x0 + w / 2) * C, cz: (z0 + h / 2) * C };
    islets.push(o);
    for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) sea[z * W + x] = 0;
    return o;
  };
  const start = islet(29 + Math.floor(rnd() * 4), H - 9, 6, 4, 'start');
  const door = islet(28 + Math.floor(rnd() * 6), 4, 4, 4, 'door');
  // les bidons : un par tiers de la carte (ouest, centre, est), à mi-chemin du nord au sud
  const bands = shuffle([[4, 20], [22, 40], [42, 60]], rnd);
  const canIslets = [];
  for (const [a, b] of bands) {
    for (let k = 0; k < 200; k++) {
      const w = 5 + Math.floor(rnd() * 4);
      const h = 4 + Math.floor(rnd() * 3);
      const x0 = a + Math.floor(rnd() * Math.max(1, b - a - w));
      const z0 = 14 + Math.floor(rnd() * 30);
      if (!fits(x0, z0, w, h, 7)) continue;
      canIslets.push(islet(x0, z0, w, h, 'can'));
      break;
    }
  }
  for (let n = 0, k = 0; n < 4 && k < 400; k++) {
    const w = 3 + Math.floor(rnd() * 3);
    const h = 3 + Math.floor(rnd() * 3);
    const x0 = 3 + Math.floor(rnd() * (W - 6 - w));
    const z0 = 3 + Math.floor(rnd() * (H - 6 - h));
    if (!fits(x0, z0, w, h, 6)) continue;
    islet(x0, z0, w, h, 'empty');
    n++;
  }

  // 2. L'épave : sur le plus grand des îlots vides, un navire échoué (le décor ; on n'y monte pas)
  const empties = islets.filter((o) => o.kind === 'empty').sort((a, b) => b.w * b.h - a.w * a.h);
  if (empties.length) empties[0].kind = 'wreck';
  const isLand = (x, z) => x >= 0 && z >= 0 && x < W && z < H && !sea[z * W + x];
  const landOf = (o) => {
    const out = [];
    for (let z = o.z0; z < o.z0 + o.h; z++) for (let x = o.x0; x < o.x0 + o.w; x++) if (grid[z * W + x] === T.FLOOR) out.push({ x, z });
    return out;
  };
  const connected = (o) => {
    const cells = landOf(o);
    if (!cells.length) return false;
    const seen = new Set([cells[0].z * W + cells[0].x]);
    const q = [cells[0]];
    while (q.length) {
      const c = q.pop();
      for (const [dx, dz] of DIRS) {
        const x = c.x + dx;
        const z = c.z + dz;
        const k = z * W + x;
        if (!isLand(x, z) || grid[k] !== T.FLOOR || seen.has(k)) continue;
        seen.add(k);
        q.push({ x, z });
      }
    }
    return seen.size === cells.length;
  };
  // 3. Le départ, la porte, les bidons (sur chaque îlot à bidon, la case la plus loin de son bord), l'amarrage du radeau
  const spawn = cellPos({ x: start.x0 + Math.floor(start.w / 2), z: start.z0 + Math.floor(start.h / 2) });
  const exit = { x: door.cx, z: door.cz, gx: Math.floor(door.cx / C), gz: Math.floor(door.cz / C), door: true };
  const shoreDist = (x, z) => {
    let d = Infinity;
    for (let zz = z - 4; zz <= z + 4; zz++) for (let xx = x - 4; xx <= x + 4; xx++) if (!isLand(xx, zz)) d = Math.min(d, Math.hypot(xx - x, zz - z));
    return d;
  };
  const cassettes = canIslets.map((o, i) => {
    const cells = landOf(o).sort((a, b) => shoreDist(b.x, b.z) - shoreDist(a.x, a.z));
    const c = cells[Math.floor(rnd() * Math.min(3, cells.length))];
    return { id: i, ...cellPos(c), can: true, collected: false };
  });
  // le radeau attend au nord de l'îlot de départ, le nez vers le large
  const raft0 = { x: spawn.x, z: start.z0 * C - RAFT.hl - 0.3, yaw: Math.PI };

  // 4. Pas de néons : on est dehors (la lumière vient du ciel, view/ocean.js). Des bouées au large de chaque îlot à
  // bidon (des repères dans la brume), et une balise à mi-chemin de la porte
  const lights = [];
  const buoys = [];
  for (const o of canIslets) {
    const a = rnd() * Math.PI * 2;
    const r = Math.max(o.w, o.h) * C * 0.5 + 6;
    const x = o.cx + Math.cos(a) * r;
    const z = o.cz + Math.sin(a) * r;
    buoys.push({ x, z, kind: 'ocean_buoy' });
  }
  buoys.push({ x: (spawn.x + door.cx) / 2 + (rnd() - 0.5) * 20, z: (spawn.z + door.cz) / 2, kind: 'lateral_sea_marker' });

  // 5. Ce que la mer a laissé sur les îlots (caisses, tonneaux, une bouée, une lanterne), l'eau d'amande et les piles
  const props = [];
  const busy = new Set(cassettes.map((c) => c.gz * W + c.gx));
  busy.add(spawn.gz * W + spawn.gx);
  const kinds = [
    { m: 'wooden_crate_01', h: 0.62, r: 0.38 },
    { m: 'wooden_crate_02', h: 0.5, r: 0.45 },
    { m: 'Barrel_01', h: 0.9, r: 0.3 },
    { m: 'lifebuoy', h: 0.12, r: 0.36, walk: true },
    { m: 'wooden_lantern_01', h: 0.45, r: 0.15 },
  ];
  for (const o of islets) {
    if (o.kind === 'wreck') continue;
    for (const c of shuffle(landOf(o), rnd).slice(0, Math.max(1, Math.floor((o.w * o.h) / 7)))) {
      const k = c.z * W + c.x;
      if (busy.has(k) || !kinds.length) continue;
      busy.add(k);
      const kd = pick(kinds);
      props.push({ ...kd, x: (c.x + 0.5) * C + (rnd() - 0.5) * 0.8, z: (c.z + 0.5) * C + (rnd() - 0.5) * 0.8, rot: rnd() * Math.PI * 2 });
    }
  }
  const landCells = [];
  for (const o of islets) if (o.kind !== 'door' && o.kind !== 'wreck') for (const c of landOf(o)) if (!busy.has(c.z * W + c.x)) landCells.push(c);
  const scatter = (n) => shuffle(landCells.slice(), rnd).slice(0, n).map((c, i) => {
    busy.add(c.z * W + c.x);
    return { id: i, ...cellPos(c), taken: false };
  });
  const bottles = scatter(7);
  const batteries = scatter(6);

  // 6. La chose sous l'eau : au large, loin du départ
  const deep = [];
  for (let z = 4; z < H - 4; z++) for (let x = 4; x < W - 4; x++) if (sea[z * W + x] && Math.hypot((x + 0.5) * C - spawn.x, (z + 0.5) * C - spawn.z) > 70) deep.push({ x, z });
  const monsterSpawn = cellPos(pick(deep));

  // dehors : pas de moquette du tout (le masque du sol de scene.js ôte toute la carte ; les îlots ont leur sol, view/ocean.js)
  const seaHoles = [{ x: (W / 2) * C, z: (H / 2) * C, hx: (W / 2) * C, hz: (H / 2) * C }];

  const walkable = [];
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (grid[z * W + x] === T.FLOOR) walkable.push({ x, z });
  const dist = bfs(grid, W, H, spawn.gx, spawn.gz);
  const inSea = (x, z) => {
    const gx = Math.floor(x / C);
    const gz = Math.floor(z / C);
    return gx < 0 || gz < 0 || gx >= W || gz >= H || !!sea[gz * W + gx];
  };
  return {
    level: OCEAN_LEVEL,
    ceil: WALL_HEIGHT,
    stairs: [],
    W,
    H,
    grid,
    sea,
    islets,
    seaHoles,
    buoys,
    outdoor: true,
    walkable,
    spawn,
    exit,
    elevator: null,
    cassettes,
    lights,
    props,
    tapes: [],
    bottles,
    batteries,
    items: itemList(['bottle', bottles], ['battery', batteries]),
    pits: [],
    niche: null,
    dist,
    pitAt: () => -1,
    monsterSpawn,
    raft0,
    pillars: {},
    inSea,
    // à pied, on ne va pas dans l'eau (ni l'entité du Level 0, qui ne vit pas ici)
    // (ni sur l'îlot de l'épave : le navire couché le couvre en entier)
    collide(x, z, r) {
      for (const [dx, dz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (inSea(x + dx, z + dz)) return true;
      const wk = islets.find((o) => o.kind === 'wreck');
      return !!wk && x > wk.x0 * C - r && x < (wk.x0 + wk.w) * C + r && z > wk.z0 * C - r && z < (wk.z0 + wk.h) * C + r;
    },
    // à bord du radeau, les pieds un peu sous le plancher des îlots (scene.js en descend l'œil)
    depthAt(x, z) {
      return inSea(x, z) ? DECK : 0;
    },
    isWall(gx, gz) {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
      return blocks(grid[gz * W + gx]);
    },
    pillarAt: () => null,
    isWalkableWorld(wx, wz) {
      return !this.isWall(Math.floor(wx / C), Math.floor(wz / C)) && !inSea(wx, wz);
    },
  };
}

// --- le radeau ---
export function newRaft(map) {
  return { x: map.raft0.x, z: map.raft0.z, yaw: map.raft0.yaw, v: 0, w: 0, motor: 0, fuel: FUEL_START, seats: SEATS.map(() => -1), bump: 0 };
}
// une place à bord, dans le monde
export function seatPos(R, i) {
  const s = SEATS[i];
  const c = Math.cos(R.yaw);
  const n = Math.sin(R.yaw);
  // repère : l'avant du radeau est (sin yaw, cos yaw), sa droite (cos yaw, -sin yaw)
  return { x: R.x + n * s.z + c * s.x, z: R.z + c * s.z - n * s.x };
}
// le radeau tient-il là ? (toute sa coque sur l'eau)
function raftFits(map, x, z, yaw) {
  if (x < 2 * C || z < 2 * C || x > (map.W - 2) * C || z > (map.H - 2) * C) return false; // (le bord du monde)
  const c = Math.cos(yaw);
  const n = Math.sin(yaw);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const px = x + n * b * RAFT.hl + c * a * RAFT.hw;
    const pz = z + c * b * RAFT.hl - n * a * RAFT.hw;
    if (!map.inSea(px, pz)) return false;
  }
  return true;
}
export const packRaft = (R) => [Math.round(R.x * 100) / 100, Math.round(R.z * 100) / 100, Math.round(R.yaw * 1000) / 1000, Math.round(R.v * 100) / 100, Math.round(R.fuel * 1000) / 1000, R.motor ? 1 : 0, R.seats.join('.')];
export function unpackRaft(R, a) {
  [R.x, R.z, R.yaw, R.v, R.fuel] = a;
  R.motor = a[5] ? 1 : 0;
  R.seats = String(a[6]).split('.').map(Number);
}
const seatOf = (R, P) => R.seats.indexOf(P.id);

// F à pied, près du radeau : on monte (la barre au premier). Rend true si F a servi
export function boardRaft(sim, P) {
  const R = sim.raft;
  if (!R || seatOf(R, P) >= 0 || Math.hypot(R.x - P.x, R.z - P.z) > BOARD_R || Math.abs(R.v) > 0.6) return false;
  const i = R.seats.indexOf(-1);
  if (i < 0) {
    sim.emit({ type: 'raftFull', id: P.id });
    return true;
  }
  R.seats[i] = P.id;
  const p = seatPos(R, i);
  P.x = p.x;
  P.z = p.z;
  P.moving = false;
  P.running = false;
  sim.makeNoise(P, 0.4, 0.5);
  sim.emit({ type: 'raftBoard', id: P.id, name: P.name, helm: i === 0 });
  return true;
}

// À bord : la place suit le radeau ; à la barre, ZQSD le mènent ; F descend sur la terre la plus proche. Rend true si
// le joueur est à bord (son pas de jeu s'arrête là)
export function raftPlayerStep(sim, P, input) {
  const R = sim.raft;
  const i = R ? seatOf(R, P) : -1;
  if (i < 0) return false;
  P.moving = false;
  P.running = false;
  P.crouch = false;
  if (i === 0) R.input = { my: input.my || 0, mx: input.mx || 0 };
  if (input.pick) leaveRaft(sim, P, i);
  return true;
}
export function leaveRaft(sim, P, i = seatOf(sim.raft, P), force = false) {
  const R = sim.raft;
  if (i < 0) return;
  const map = sim.map;
  const from = seatPos(R, i);
  let best = null;
  for (let gz = Math.floor((from.z - LAND_R) / C); gz <= Math.floor((from.z + LAND_R) / C); gz++) {
    for (let gx = Math.floor((from.x - LAND_R) / C); gx <= Math.floor((from.x + LAND_R) / C); gx++) {
      if (gx < 0 || gz < 0 || gx >= map.W || gz >= map.H || map.sea[gz * map.W + gx] || map.isWall(gx, gz)) continue;
      // le point de la case le plus proche de soi, un peu à l'intérieur
      const x = Math.max(gx * C + 0.45, Math.min((gx + 1) * C - 0.45, from.x));
      const z = Math.max(gz * C + 0.45, Math.min((gz + 1) * C - 0.45, from.z));
      const d = Math.hypot(x - from.x, z - from.z);
      if (d < LAND_R && (!best || d < best.d) && !sim.isColliding(x, z, 0.35, 0)) best = { x, z, d };
    }
  }
  if (!best && !force) return sim.emit({ type: 'raftNoLand', id: P.id });
  R.seats[i] = -1;
  if (i === 0) R.input = null;
  if (best) {
    P.x = best.x;
    P.z = best.z;
  }
  sim.emit({ type: 'raftLeave', id: P.id });
  // la barre libre : le passager le plus en arrière la prend
  if (i === 0) {
    const j = R.seats.findIndex((id, k) => k > 0 && id >= 0);
    if (j > 0) {
      R.seats[0] = R.seats[j];
      R.seats[j] = -1;
    }
  }
}

// Un pas du radeau (hôte et invités pareil : seuls les ordres de la barre viennent de l'hôte)
export function raftStep(sim, DT) {
  const R = sim.raft;
  const map = sim.map;
  // les places vides (un joueur mort, parti) se libèrent
  R.seats = R.seats.map((id) => (sim.players.some((Q) => Q.id === id && Q.status === 'alive') ? id : -1));
  const inp = R.seats[0] >= 0 ? R.input || { my: 0, mx: 0 } : { my: 0, mx: 0 };
  const throttle = R.fuel > 0 ? Math.max(-1, Math.min(1, inp.my)) : 0;
  R.motor = throttle !== 0 ? 1 : 0;
  const want = throttle > 0 ? RAFT.speed * throttle : throttle < 0 ? -RAFT.back : 0;
  const k = throttle !== 0 ? RAFT.accel : RAFT.drag;
  R.v += Math.max(-k * DT, Math.min(k * DT, want - R.v));
  // on ne tourne qu'en avançant (un gouvernail), un peu sur place au moteur
  const steer = -(inp.mx || 0) * RAFT.turn * Math.min(1, Math.abs(R.v) / 1.2 + (R.motor ? 0.35 : 0));
  const yaw = R.yaw + steer * DT * (R.v < 0 ? -1 : 1);
  const nx = R.x + Math.sin(yaw) * R.v * DT;
  const nz = R.z + Math.cos(yaw) * R.v * DT;
  R.bump = Math.max(0, R.bump - DT);
  if (raftFits(map, nx, nz, yaw)) {
    R.fuel = Math.max(0, R.fuel - Math.hypot(nx - R.x, nz - R.z) * FUEL_PER_M * (R.motor ? 1 : 0));
    R.x = nx;
    R.z = nz;
    R.yaw = yaw;
  } else {
    // contre un îlot (ou le bord du monde) : le choc, on s'arrête net
    if (Math.abs(R.v) > 1 && R.bump <= 0) {
      sim.emit({ type: 'raftBump', x: R.x, z: R.z, v: Math.abs(R.v) });
      R.bump = 0.8;
    }
    R.v = 0;
    if (raftFits(map, R.x, R.z, yaw)) R.yaw = yaw;
  }
  if (R.fuel <= 0 && R.motor === 0 && inp.my > 0 && !R.dry) {
    R.dry = true;
    sim.emit({ type: 'raftDry' });
  } else if (R.fuel > 0) R.dry = false;
  // le bruit du moteur : la chose l'entend (sim.monster, levStep)
  R.noise = R.motor ? 0.6 + 0.4 * Math.abs(R.v) / RAFT.speed : 0;
  // ceux qui sont à bord suivent
  R.seats.forEach((id, i) => {
    if (id < 0) return;
    const P = sim.players.find((Q) => Q.id === id);
    if (!P) return;
    const p = seatPos(R, i);
    P.x = p.x;
    P.z = p.z;
  });
}

// --- la chose sous l'eau (sim.monster : x, z, yaw, mode ; les modes du moteur, pour l'instantané) ---
// patrol : elle dérive au large ; chase : elle a entendu le moteur et fond dessus ; search : elle replonge et s'éloigne
export function levStep(sim, DT) {
  const M = sim.monster;
  const R = sim.raft;
  const map = sim.map;
  M.restT = Math.max(0, (M.restT || 0) - DT);
  M.lostT = M.lostT || 0;
  const dR = Math.hypot(R.x - M.x, R.z - M.z);
  let tx = M.tx;
  let tz = M.tz;
  let speed = LEVI.roam;
  if (M.mode === 'search') {
    speed = LEVI.hunt * 0.8;
    if (Math.hypot(M.tx - M.x, M.tz - M.z) < 4 || M.restT <= 0) M.mode = 'patrol';
  } else if (R.noise > 0 && dR < LEVI.hear && M.restT <= 0) {
    if (M.mode !== 'chase') sim.emit({ type: 'leviHunt', x: M.x, z: M.z });
    M.mode = 'chase';
    M.lostT = 0;
    tx = M.tx = R.x;
    tz = M.tz = R.z;
  } else if (M.mode === 'chase') {
    // le moteur s'est tu : elle va jusqu'au dernier bruit, tourne un peu, puis s'en va
    M.lostT += DT;
    if (M.lostT > LEVI.lose) {
      M.mode = 'patrol';
      M.tx = null;
      sim.emit({ type: 'leviLost', x: M.x, z: M.z });
    }
  }
  if (M.mode === 'chase') speed = LEVI.hunt;
  if (M.mode === 'patrol' && (M.tx == null || Math.hypot(M.tx - M.x, M.tz - M.z) < 3)) {
    // un point du large au hasard (déterministe : hôte seul, l'instantané le donne aux autres)
    for (let k = 0; k < 20; k++) {
      const x = 4 * C + Math.random() * (map.W - 8) * C;
      const z = 4 * C + Math.random() * (map.H - 8) * C;
      if (map.inSea(x, z)) {
        M.tx = x;
        M.tz = z;
        break;
      }
    }
  }
  tx = M.tx ?? M.x;
  tz = M.tz ?? M.z;
  // elle nage droit vers sa cible, en contournant les îlots (elle ne quitte jamais l'eau)
  let a = Math.atan2(tx - M.x, tz - M.z);
  for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4, Math.PI]) {
    const nx = M.x + Math.sin(a + off) * speed * DT;
    const nz = M.z + Math.cos(a + off) * speed * DT;
    if (map.inSea(nx, nz) && map.inSea(nx + Math.sin(a + off) * 1.5, nz + Math.cos(a + off) * 1.5)) {
      a += off;
      M.x = nx;
      M.z = nz;
      break;
    }
  }
  M.yaw = a;
  M.v = speed;
  // à portée du radeau en marche : elle emporte quelqu'un par le fond (de préférence un passager)
  if (M.mode === 'chase' && dR < LEVI.strike && Math.abs(R.v) > 0.5) {
    const on = R.seats.filter((id) => id >= 0);
    const id = on.length > 1 ? on.slice(1)[Math.floor(Math.random() * (on.length - 1))] : on[0];
    const P = sim.players.find((Q) => Q.id === id);
    if (P) take(sim, P, 'raft');
    M.mode = 'search';
    M.restT = LEVI.rest;
    const away = Math.atan2(M.x - R.x, M.z - R.z);
    M.tx = Math.max(4 * C, Math.min((map.W - 4) * C, M.x + Math.sin(away) * LEVI.away));
    M.tz = Math.max(4 * C, Math.min((map.H - 4) * C, M.z + Math.cos(away) * LEVI.away));
    R.v *= 0.2;
    return;
  }
  // au bord d'un îlot, à pied : trop près de l'eau quand elle passe
  if (M.restT <= 0) {
    for (const P of sim.players) {
      if (P.status !== 'alive' || (R && R.seats.includes(P.id))) continue;
      if (Math.hypot(P.x - M.x, P.z - M.z) < LEVI.shore) {
        take(sim, P, 'shore');
        M.mode = 'search';
        M.restT = LEVI.rest;
        break;
      }
    }
  }
}
// emporté par le fond : la chute du puits sans fond, vue de l'intérieur (scene.abyss), sans entité qui surgit
function take(sim, P, how) {
  const R = sim.raft;
  const i = R ? R.seats.indexOf(P.id) : -1;
  if (i >= 0) R.seats[i] = -1;
  sim.emit({ type: 'leviTake', id: P.id, name: P.name, how, x: P.x, z: P.z });
  sim.emit({ type: 'abyss', id: P.id, x: P.x, z: P.z, floor: 0, sea: true });
  sim.killPlayer(P, { abyss: true, x: P.x, z: P.z });
}
