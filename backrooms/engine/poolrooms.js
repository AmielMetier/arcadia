// The Backrooms (Level 37) - Les Poolrooms : un complexe de bassins carrelés blancs et cyan, infini, propre et vide.
// Des salles de tailles variées reliées par des couloirs inondés : pataugeoires à piliers ronds (20 cm d'eau), grands
// bassins (plage sèche autour, 60 cm puis 1,10 m au centre), halles sèches à colonnes, et quelques locaux techniques où
// attendent les 3 volants de vanne qui rouvrent l'ascenseur de sortie. Même grille de cases que les autres niveaux ;
// depth donne la hauteur d'eau de chaque case (0 : sec), qui ralentit la marche.
// Bible de conception : « Bible de conception — Les Poolrooms (Level 37) ».
import { CELL_SIZE, T, bfs, carveElevator, itemList } from './map.js';

export const POOL_SIZE = 56;
export const POOL_CEIL = 4.0;
// profondeurs (m) : pataugeoire, couloir inondé, bassin, centre du grand bassin
export const DEPTH = { WADE: 0.2, HALL: 0.4, POOL: 0.6, DEEP: 1.1 };
// voûtes : couloirs en berceau (demi-cercle de 2,5 m de rayon sur 2 cases, naissance à 1,5 m) et grandes salles
// en voûtes d'arêtes entre de grosses colonnes (naissance à 1,8 m, flèche de 2,2 m) : le sommet touche le plafond.
// ceilKind (par case) : 0 plafond plat, 1 et 2 berceau dans l'axe x (moitié côté z-, moitié côté z+), 3 et 4 dans l'axe z
export const BARREL = { spring: 1.5, r: 2.5 };
export const GROIN = { spring: 1.8, rise: 2.2 };

// objets abandonnés au bord des bassins (Poly Haven, CC0) ; float : posé sur l'eau
export const L37_PROPS = [
  { m: 'plastic_monobloc_chair_01', h: 0.8, r: 0.3, chair: true },
  { m: 'WetFloorSign_01', h: 0.62, r: 0.22 },
  { m: 'painted_wooden_bench', h: 0.45, r: 0.5, face: true },
  { m: 'lifebuoy', h: 0.12, r: 0.36 },
];

export function createPoolMap(seed = 37) {
  const W = POOL_SIZE;
  const H = POOL_SIZE;
  const grid = new Uint8Array(W * H).fill(T.WALL);
  const depth = new Float32Array(W * H);

  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const inside = (x, z) => x > 0 && x < W - 1 && z > 0 && z < H - 1;
  const get = (x, z) => (x < 0 || x >= W || z < 0 || z >= H ? T.WALL : grid[z * W + x]);
  const set = (x, z, v, d = 0) => {
    if (!inside(x, z)) return;
    grid[z * W + x] = v;
    depth[z * W + x] = d;
  };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  // 1. Les salles : rectangles qui ne se touchent pas (au moins un mur entre deux)
  const rooms = [];
  for (let i = 0; i < 400 && rooms.length < 24; i++) {
    const w = 4 + Math.floor(rnd() * 10);
    const h = 4 + Math.floor(rnd() * 10);
    const x = 2 + Math.floor(rnd() * (W - w - 4));
    const z = 2 + Math.floor(rnd() * (H - h - 4));
    if (rooms.some((r) => x < r.x + r.w + 2 && x + w + 2 > r.x && z < r.z + r.h + 2 && z + h + 2 > r.z)) continue;
    rooms.push({ x, z, w, h, cx: x + (w >> 1), cz: z + (h >> 1) });
  }

  // 2. Rôle de chaque salle. Le départ : la salle la plus centrale. Les locaux techniques : 3 petites salles loin du
  // départ. Les autres : pataugeoire, grand bassin ou halle sèche à colonnes.
  const start = rooms.reduce((b, r) => (Math.hypot(r.cx - W / 2, r.cz - H / 2) < Math.hypot(b.cx - W / 2, b.cz - H / 2) ? r : b));
  start.kind = 'wade';
  const small = rooms.filter((r) => r !== start && r.w * r.h <= 42).sort((a, b) => Math.hypot(b.cx - start.cx, b.cz - start.cz) - Math.hypot(a.cx - start.cx, a.cz - start.cz));
  const techs = [];
  for (const r of small) {
    if (techs.length === 3) break;
    if (techs.every((t) => Math.hypot(t.cx - r.cx, t.cz - r.cz) > 12)) {
      r.kind = 'tech';
      techs.push(r);
    }
  }
  for (const r of rooms) {
    if (r.kind) continue;
    const big = r.w >= 7 && r.h >= 7;
    const v = rnd();
    // les plus grandes salles : des voûtes d'arêtes sur colonnes, inondées
    if (r.w >= 9 && r.h >= 9 && v < 0.55) {
      r.kind = 'vault';
      r.deep = rnd() < 0.5;
    } else r.kind = big && v < 0.6 ? 'pool' : v < 0.8 ? 'wade' : 'hall';
  }
  // ambiances : des halles sous verrière, éblouissantes, et des salles sombres, bleutées, presque sans lumière
  for (const r of rooms) {
    if (r === start || r.kind === 'tech') continue;
    const v = rnd();
    if ((r.kind === 'pool' || r.kind === 'wade') && v < 0.3) r.sky = true;
    else if (v > 0.78) r.dark = true;
  }

  // 3. On creuse les salles
  for (const r of rooms) {
    for (let z = r.z; z < r.z + r.h; z++) {
      for (let x = r.x; x < r.x + r.w; x++) {
        let d = 0;
        if (r.kind === 'wade') d = DEPTH.WADE;
        else if (r.kind === 'vault') {
          const edge = Math.min(x - r.x, r.x + r.w - 1 - x, z - r.z, r.z + r.h - 1 - z);
          d = r.deep ? (edge === 0 ? 0 : DEPTH.POOL) : DEPTH.WADE;
        } else if (r.kind === 'pool') {
          // une plage sèche d'une case tout autour, le bassin, et le centre plus profond
          const edge = Math.min(x - r.x, r.x + r.w - 1 - x, z - r.z, r.z + r.h - 1 - z);
          d = edge === 0 ? 0 : edge >= 2 && r.w >= 8 && r.h >= 8 ? DEPTH.DEEP : DEPTH.POOL;
        }
        set(x, z, T.FLOOR, d);
      }
    }
  }

  // 3b. Une passerelle sèche traverse certains grands bassins
  for (const r of rooms) {
    if (r.kind !== 'pool' || (r.w < 8 && r.h < 8) || rnd() < 0.4) continue;
    const alongX = r.w >= r.h;
    const mid = alongX ? r.z + (r.h >> 1) : r.x + (r.w >> 1);
    for (let k = alongX ? r.x : r.z; k < (alongX ? r.x + r.w : r.z + r.h); k++) depth[(alongX ? mid : k) * W + (alongX ? k : mid)] = 0;
  }

  // 4. Couloirs inondés (2 cases de large) entre les salles : un arbre couvrant, plus quelques boucles
  const ceilKind = new Uint8Array(W * H);
  const corridor = (a, b) => {
    const horizFirst = rnd() < 0.5;
    // axis : 'x' ou 'z', le sens du couloir (pour sa voûte en berceau) ; null au coude
    const carve = (x, z, axis) => {
      for (const [ox, oz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const k = (z + oz) * W + x + ox;
        if (!inside(x + ox, z + oz)) continue;
        if (grid[k] === T.FLOOR) continue; // on garde la profondeur des salles traversées
        set(x + ox, z + oz, T.FLOOR, DEPTH.HALL);
        ceilKind[k] = axis === 'x' ? 1 + oz : axis === 'z' ? 3 + ox : 0;
      }
    };
    let x = a.cx;
    let z = a.cz;
    const stepX = () => {
      while (x !== b.cx) {
        carve(x, z, 'x');
        x += Math.sign(b.cx - x);
      }
    };
    const stepZ = () => {
      while (z !== b.cz) {
        carve(x, z, 'z');
        z += Math.sign(b.cz - z);
      }
    };
    if (horizFirst) {
      stepX();
      stepZ();
    } else {
      stepZ();
      stepX();
    }
    carve(x, z, null);
  };
  const linked = [start];
  const left = rooms.filter((r) => r !== start);
  while (left.length) {
    let best = null;
    for (const a of linked) {
      for (const b of left) {
        const d = Math.abs(a.cx - b.cx) + Math.abs(a.cz - b.cz);
        if (!best || d < best.d) best = { a, b, d };
      }
    }
    corridor(best.a, best.b);
    linked.push(best.b);
    left.splice(left.indexOf(best.b), 1);
  }
  for (let i = 0; i < 4; i++) corridor(pick(rooms), pick(rooms));
  // un local technique reste au sec, et le grand bassin garde sa plage : un couloir qui les traverse s'assèche
  for (const r of rooms) {
    if (r.kind !== 'tech') continue;
    for (let z = r.z; z < r.z + r.h; z++) for (let x = r.x; x < r.x + r.w; x++) depth[z * W + x] = 0;
  }

  // 5. Piliers ronds : en quinconce dans les pataugeoires et les halles, jamais contre un mur ni devant un passage
  const pillars = {};
  const bays = [];
  for (const r of rooms) {
    if (r.kind !== 'vault') continue;
    // grosses colonnes toutes les 3 cases ; entre elles (et les murs), une voûte d'arêtes par travée
    const px = [];
    const pz = [];
    for (let x = r.x + 2; x <= r.x + r.w - 3; x += 3) px.push(x);
    for (let z = r.z + 2; z <= r.z + r.h - 3; z += 3) pz.push(z);
    for (const x of px) {
      for (const z of pz) {
        const k = z * W + x;
        grid[k] = T.PILLAR;
        pillars[k] = { x: (x + 0.5) * CELL_SIZE, z: (z + 0.5) * CELL_SIZE, h: 0.5, round: true };
      }
    }
    const xs = [r.x * CELL_SIZE, ...px.map((x) => (x + 0.5) * CELL_SIZE), (r.x + r.w) * CELL_SIZE];
    const zs = [r.z * CELL_SIZE, ...pz.map((z) => (z + 0.5) * CELL_SIZE), (r.z + r.h) * CELL_SIZE];
    for (let i = 0; i + 1 < xs.length; i++) for (let j = 0; j + 1 < zs.length; j++) bays.push({ x0: xs[i], x1: xs[i + 1], z0: zs[j], z1: zs[j + 1] });
  }
  for (const r of rooms) {
    if (r.kind !== 'wade' && r.kind !== 'hall') continue;
    if (r.w < 5 || r.h < 5) continue;
    for (let z = r.z + 2; z < r.z + r.h - 2; z += 3) {
      for (let x = r.x + 2; x < r.x + r.w - 2; x += 3) {
        if (r === start && Math.abs(x - r.cx) <= 1 && Math.abs(z - r.cz) <= 1) continue;
        const k = z * W + x;
        if (DIRS.some(([dx, dz]) => get(x + dx, z + dz) !== T.FLOOR)) continue;
        grid[k] = T.PILLAR;
        pillars[k] = { x: (x + 0.5) * CELL_SIZE, z: (z + 0.5) * CELL_SIZE, h: r.kind === 'hall' ? 0.6 : [0.32, 0.45][Math.floor(rnd() * 2)], round: true };
      }
    }
  }

  // 6. Tout ce qui n'est pas relié au départ redevient mur
  const sx = start.cx;
  const sz = start.cz;
  set(sx, sz, T.FLOOR, depth[sz * W + sx]);
  let dist = bfs(grid, W, H, sx, sz);
  for (let i = 0; i < W * H; i++) {
    if (grid[i] === T.FLOOR && dist[i] < 0) {
      grid[i] = T.WALL;
      depth[i] = 0;
    }
    if (grid[i] !== T.FLOOR) ceilKind[i] = 0;
  }
  const walkable = [];
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (grid[z * W + x] === T.FLOOR) walkable.push({ x, z });
  const D = (c) => dist[c.z * W + c.x];
  const cellPos = (c) => ({ x: (c.x + 0.5) * CELL_SIZE, z: (c.z + 0.5) * CELL_SIZE, gx: c.x, gz: c.z });
  const spawn = cellPos({ x: sx, z: sz });
  const dry = (c) => depth[c.z * W + c.x] === 0;

  // 7. L'ascenseur de sortie : creusé dans un mur, au bord sec d'une salle loin du départ
  const far = walkable.filter((c) => D(c) > 0 && dry(c)).sort((a, b) => D(b) - D(a));
  let exitCell = null;
  let elevator = null;
  for (let i = 0; i < 80 && !elevator; i++) {
    exitCell = far[Math.floor(rnd() * Math.min(15 + i * 5, far.length))];
    elevator = carveElevator(grid, W, H, exitCell, { x: sx, z: sz }, rnd);
  }
  for (let i = walkable.length - 1; i >= 0; i--) if (grid[walkable[i].z * W + walkable[i].x] !== T.FLOOR) walkable.splice(i, 1);
  dist = bfs(grid, W, H, sx, sz);
  const exit = cellPos(exitCell);
  const maxD = Math.max(...walkable.map((c) => D(c)));

  // 8. Les 3 volants de vanne : au milieu des locaux techniques (sinon dans un coin sec et lointain)
  const fuses = [];
  const taken = [exitCell];
  for (const r of techs) {
    const c = walkable.find((q) => q.x === r.cx && q.z === r.cz) || walkable.find((q) => q.x >= r.x && q.x < r.x + r.w && q.z >= r.z && q.z < r.z + r.h);
    if (c && D(c) > 0) {
      taken.push(c);
      fuses.push({ id: fuses.length, ...cellPos(c), taken: false });
    }
  }
  while (fuses.length < 3) {
    const cand = walkable.filter((c) => dry(c) && D(c) > maxD * 0.4 && taken.every((t) => Math.hypot(t.x - c.x, t.z - c.z) > 8));
    const c = cand.length ? pick(cand) : pick(walkable.filter((q) => D(q) > 4));
    taken.push(c);
    fuses.push({ id: fuses.length, ...cellPos(c), taken: false });
  }

  // 9. Éclairage : des dalles lumineuses au plafond, une case sur deux, toutes allumées (le niveau est clair) ;
  // les locaux techniques n'ont qu'une ampoule qui grésille
  const lights = [];
  const inTech = (x, z) => techs.some((r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h);
  const roomAt = (x, z) => rooms.find((r) => x >= r.x && x < r.x + r.w && z >= r.z && z < r.z + r.h);
  const bayCells = new Set(bays.map((b) => Math.floor((b.z0 + b.z1) / 2 / CELL_SIZE) * W + Math.floor((b.x0 + b.x1) / 2 / CELL_SIZE)));
  for (let z = 1; z < H - 1; z++) {
    for (let x = 1; x < W - 1; x++) {
      if (grid[z * W + x] !== T.FLOOR) continue;
      const tech = inTech(x, z);
      const r = roomAt(x, z);
      const k = z * W + x;
      let ok;
      if (tech) ok = techs.some((t) => t.cx === x && t.cz === z);
      else if (r && r.kind === 'vault') ok = bayCells.has(k); // une lampe au sommet de chaque voûte
      else if (r && r.sky) ok = true; // la verrière : tout le plafond est lumineux
      else ok = !(x % 2) && !(z % 2);
      if (!ok) continue;
      let state = tech ? 'flicker' : 'on';
      if (r && r.dark) state = rnd() < 0.2 ? 'flicker' : 'off';
      // dans un couloir voûté, la lampe est cachée dans la voûte : on ne voit que sa lumière
      lights.push({ x: (x + 0.5) * CELL_SIZE, y: POOL_CEIL - 0.02, z: (z + 0.5) * CELL_SIZE, gx: x, gz: z, state, flicker: state === 'flicker', bright: !tech && !(r && r.dark), tech, sky: !!(r && r.sky), hidden: ceilKind[k] > 0 });
    }
  }

  // échelles chromées : une ou deux par bassin, du bord sec vers l'eau
  const ladders = [];
  for (const r of rooms) {
    if (r.kind !== 'pool' && !(r.kind === 'vault' && r.deep)) continue;
    let n = 0;
    for (let i = 0; i < 60 && n < 2; i++) {
      const x = r.x + Math.floor(rnd() * r.w);
      const z = r.z + Math.floor(rnd() * r.h);
      if (grid[z * W + x] !== T.FLOOR || depth[z * W + x] !== 0) continue;
      const d = DIRS.find(([dx, dz]) => grid[(z + dz) * W + x + dx] === T.FLOOR && depth[(z + dz) * W + x + dx] >= DEPTH.POOL);
      if (!d || ladders.some((l) => Math.hypot(l.gx - x, l.gz - z) < 3)) continue;
      ladders.push({ gx: x, gz: z, dx: d[0], dz: d[1], x: (x + 0.5) * CELL_SIZE + d[0] * (CELL_SIZE / 2), z: (z + 0.5) * CELL_SIZE + d[1] * (CELL_SIZE / 2) });
      n++;
    }
  }

  // 10. Objets abandonnés au bord des bassins (au sec, contre un mur), un canard qui flotte, eau d'amande et piles
  const busy = new Set([sz * W + sx, exitCell.z * W + exitCell.x, ...fuses.map((f) => f.gz * W + f.gx)]);
  const props = [];
  const nearWall = (c) => DIRS.find(([dx, dz]) => get(c.x + dx, c.z + dz) === T.WALL);
  for (let i = 0; i < 90; i++) {
    const c = pick(walkable);
    const k = c.z * W + c.x;
    const wall = nearWall(c);
    if (busy.has(k) || !wall || !dry(c) || Math.hypot(c.x - sx, c.z - sz) < 3) continue;
    busy.add(k);
    const kind = pick(L37_PROPS);
    const off = CELL_SIZE / 2 - kind.r - 0.12;
    props.push({
      m: kind.m, h: kind.h, r: kind.r,
      x: (c.x + 0.5) * CELL_SIZE + wall[0] * off,
      z: (c.z + 0.5) * CELL_SIZE + wall[1] * off,
      rot: kind.face ? Math.atan2(-wall[0], -wall[1]) : (rnd() - 0.5) * 2,
      tipped: !!kind.chair && rnd() < 0.2,
    });
  }
  for (let i = 0; i < 40 && props.filter((p) => p.m === 'rubber_duck_toy').length < 3; i++) {
    const c = pick(walkable);
    if (depth[c.z * W + c.x] < DEPTH.POOL || busy.has(c.z * W + c.x)) continue;
    busy.add(c.z * W + c.x);
    props.push({ m: 'rubber_duck_toy', h: 0.12, r: 0.01, x: (c.x + 0.3 + rnd() * 0.4) * CELL_SIZE, z: (c.z + 0.3 + rnd() * 0.4) * CELL_SIZE, rot: rnd() * 6, tipped: false, float: true });
  }
  const scatter = (n, minD) => {
    const out = [];
    for (let i = 0; i < 400 && out.length < n; i++) {
      const c = pick(walkable);
      const k = c.z * W + c.x;
      if (busy.has(k) || !dry(c) || D(c) < minD) continue;
      busy.add(k);
      out.push({ id: out.length, ...cellPos(c), taken: false });
    }
    return out;
  };
  const bottles = scatter(6, 6);
  const batteries = scatter(6, 5);

  // 11. L'entité ne sort pas de l'eau ici : elle reste à l'écart (voir la scène pour son ombre sous la surface)
  const monsterSpawn = { x: -1000, z: -1000, gx: -1, gz: -1 };

  return {
    level: 2,
    name: 37,
    ceil: POOL_CEIL,
    W,
    H,
    grid,
    depth,
    walkable,
    spawn,
    exit,
    elevator,
    cassettes: [],
    fuses,
    lights,
    props,
    bottles,
    batteries,
    items: itemList(['bottle', bottles], ['battery', batteries]),
    pits: [],
    niche: null,
    pitAt: () => -1,
    rooms,
    pillars,
    ceilKind,
    bays,
    ladders,
    dist,
    monsterSpawn,
    isWall(gx, gz) {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
      const v = grid[gz * W + gx];
      return v === T.WALL || v === T.EXIT || v === T.PILLAR;
    },
    pillarAt(gx, gz) {
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return null;
      const k = gz * W + gx;
      return grid[k] === T.PILLAR ? pillars[k] || null : null;
    },
    // hauteur d'eau (m) sous un point
    depthAt(wx, wz) {
      const gx = Math.floor(wx / CELL_SIZE);
      const gz = Math.floor(wz / CELL_SIZE);
      if (gx < 0 || gx >= W || gz < 0 || gz >= H) return 0;
      return depth[gz * W + gx];
    },
    isWalkableWorld(wx, wz) {
      const gx = Math.floor(wx / CELL_SIZE);
      const gz = Math.floor(wz / CELL_SIZE);
      const p = this.pillarAt(gx, gz);
      if (p) return Math.hypot(wx - p.x, wz - p.z) > p.h;
      return !this.isWall(gx, gz);
    },
  };
}
