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
export const WALL_T = 0.2; // l'épaisseur des murs des maisons
export const HOUSE_H = 2.6; // la hauteur sous plafond de leur étage (le toit est au-dessus)
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

  // 1. Les îlots : la maison du départ au sud, la porte au nord sur son rocher, trois maisons à bidon entre les deux,
  // quelques maisons qui sombrent (des leurres, penchées, on n'y entre pas) et l'épave ; au moins 7 cases d'eau entre deux
  const islets = [];
  const fits = (x0, z0, w, h, gap) => x0 >= 3 && z0 >= 3 && x0 + w <= W - 3 && z0 + h <= H - 3 && islets.every((o) => x0 + w + gap <= o.x0 || o.x0 + o.w + gap <= x0 || z0 + h + gap <= o.z0 || o.z0 + o.h + gap <= z0);
  const islet = (x0, z0, w, h, kind) => {
    const o = { id: islets.length, x0, z0, w, h, kind, cx: (x0 + w / 2) * C, cz: (z0 + h / 2) * C };
    islets.push(o);
    for (let z = z0; z < z0 + h; z++) for (let x = x0; x < x0 + w; x++) sea[z * W + x] = 0;
    return o;
  };
  const start = islet(28 + Math.floor(rnd() * 4), H - 10, 5, 4, 'start');
  start.side = 'n';
  const door = islet(28 + Math.floor(rnd() * 6), 4, 4, 4, 'door');
  // les maisons à bidon : une par tiers de la carte (ouest, centre, est) ; la porte d'entrée regarde le milieu de la mer
  const bands = shuffle([[4, 20], [22, 40], [42, 60]], rnd);
  const canIslets = [];
  for (const [a, b] of bands) {
    for (let k = 0; k < 200; k++) {
      const w = 4 + Math.floor(rnd() * 3);
      const h = 4 + Math.floor(rnd() * 3);
      const x0 = a + Math.floor(rnd() * Math.max(1, b - a - w));
      const z0 = 14 + Math.floor(rnd() * 30);
      if (!fits(x0, z0, w, h, 7)) continue;
      const o = islet(x0, z0, w, h, 'can');
      const dx = o.cx - (W / 2) * C;
      const dz = o.cz - (H / 2) * C;
      o.side = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'w' : 'e') : dz > 0 ? 'n' : 's';
      canIslets.push(o);
      break;
    }
  }
  for (let n = 0, k = 0; n < 5 && k < 400; k++) {
    const w = 3 + Math.floor(rnd() * 2);
    const h = 3 + Math.floor(rnd() * 2);
    const x0 = 3 + Math.floor(rnd() * (W - 6 - w));
    const z0 = 3 + Math.floor(rnd() * (H - 6 - h));
    if (!fits(x0, z0, w, h, 6)) continue;
    const o = islet(x0, z0, w, h, 'sunk');
    // penchée, enfoncée : on n'en voit que l'étage et le toit, de travers
    o.tilt = { x: (rnd() - 0.5) * 0.5, z: (rnd() < 0.5 ? -1 : 1) * (0.15 + rnd() * 0.25), sink: 0.8 + rnd() * 1.4, yaw: rnd() * Math.PI * 2 };
    n++;
  }
  // l'allure de chaque maison (tirée de la graine : la même chez tous) : la couleur du bardage, le toit (deux pentes ou
  // un seul pan), une cheminée, des volets, une rambarde au ponton
  for (const o of islets) o.style = { tint: Math.floor(rnd() * 5), roof: rnd() < 0.7 ? 'gable' : 'shed', chimney: rnd() < 0.55, shutters: rnd() < 0.5, rail: rnd() < 0.6, flip: rnd() < 0.5 };
  // 2. L'épave : à la place de la plus grande des maisons qui sombrent, un navire échoué (le décor ; on n'y monte pas)
  const sunk = islets.filter((o) => o.kind === 'sunk').sort((a, b) => b.w * b.h - a.w * a.h);
  if (sunk.length) sunk[0].kind = 'wreck';

  // 3. Les maisons où l'on entre : l'étage, au ras de l'eau (le rez-de-chaussée est noyé dessous). Une rangée de cases
  // sert de ponton devant la porte d'entrée ; dedans, une cloison coupe la maison en deux pièces (la pièce du fond, loin
  // de l'entrée, garde le bidon), percée d'une porte. Des fenêtres sur les autres murs. walls : les murs pleins (les
  // fenêtres comprises), pour le moteur ; houses : le plan, pour la scène
  const houses = [];
  const walls = [];
  const solid = (ax, az, bx, bz, open) => {
    // un mur moins ses portes (les fenêtres arrêtent le pas)
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len;
    const uz = (bz - az) / len;
    let a = 0;
    for (const o of open.filter((q) => q.kind === 'door').sort((p, q) => p.at - q.at)) {
      if (o.at - o.w / 2 > a) walls.push({ ax: ax + ux * a, az: az + uz * a, bx: ax + ux * (o.at - o.w / 2), bz: az + uz * (o.at - o.w / 2) });
      a = o.at + o.w / 2;
    }
    if (a < len) walls.push({ ax: ax + ux * a, az: az + uz * a, bx, bz });
  };
  for (const o of islets) {
    if (o.kind !== 'start' && o.kind !== 'can') continue;
    let hx0 = o.x0;
    let hz0 = o.z0;
    let hx1 = o.x0 + o.w;
    let hz1 = o.z0 + o.h;
    if (o.side === 'n') hz0++;
    else if (o.side === 's') hz1--;
    else if (o.side === 'w') hx0++;
    else hx1--;
    const X0 = hx0 * C + WALL_T / 2;
    const Z0 = hz0 * C + WALL_T / 2;
    const X1 = hx1 * C - WALL_T / 2;
    const Z1 = hz1 * C - WALL_T / 2;
    const hs = { o, X0, Z0, X1, Z1, side: o.side, segs: [], style: o.style };
    const seg = (ax, az, bx, bz, ext, open) => {
      hs.segs.push({ ax, az, bx, bz, ext, open });
      solid(ax, az, bx, bz, open);
    };
    const wins = (len, skipMid) => {
      const out = [];
      const n = len > 8 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const at = (len * (i + 1)) / (n + 1) + (skipMid ? (i === 0 ? -1.6 : 1.6) : 0);
        if (at > 0.9 && at < len - 0.9) out.push({ at, w: 1.0, kind: 'window' });
      }
      return out;
    };
    const front = (len) => [{ at: len / 2, w: 1.1, kind: 'door' }, ...wins(len, true).filter((q) => Math.abs(q.at - len / 2) > 1.4)];
    const lx = X1 - X0;
    const lz = Z1 - Z0;
    seg(X0, Z0, X1, Z0, true, o.side === 'n' ? front(lx) : wins(lx));
    seg(X0, Z1, X1, Z1, true, o.side === 's' ? front(lx) : wins(lx));
    seg(X0, Z0, X0, Z1, true, o.side === 'w' ? front(lz) : wins(lz));
    seg(X1, Z0, X1, Z1, true, o.side === 'e' ? front(lz) : wins(lz));
    // la cloison, parallèle à la façade d'entrée, et sa porte (pas en face de l'entrée : on ne voit pas le fond d'un coup)
    const across = o.side === 'n' || o.side === 's';
    const mid = across ? (Z0 + Z1) / 2 : (X0 + X1) / 2;
    const plen = across ? lx : lz;
    const pat = plen * (rnd() < 0.5 ? 0.25 : 0.75);
    if (across) seg(X0, mid, X1, mid, false, [{ at: pat, w: 1.0, kind: 'door' }]);
    else seg(mid, Z0, mid, Z1, false, [{ at: pat, w: 1.0, kind: 'door' }]);
    // les pièces : celle de l'entrée, celle du fond (rectangles x0, z0, x1, z1) ; dans une grande maison, le fond est
    // coupé en deux par une seconde cloison (sa porte au milieu), et le bidon est dans l'une des deux
    hs.front = { n: [X0, Z0, X1, mid], s: [X0, mid, X1, Z1], w: [X0, Z0, mid, Z1], e: [mid, Z0, X1, Z1] }[o.side];
    const bk = { n: [X0, mid, X1, Z1], s: [X0, Z0, X1, mid], w: [mid, Z0, X1, Z1], e: [X0, Z0, mid, Z1] }[o.side];
    hs.rooms = [hs.front];
    hs.back = bk;
    if (plen >= 7 && rnd() < 0.85) {
      // loin de la porte de la première cloison (au quart ou aux trois quarts)
      const f = pat / plen < 0.5 ? 0.52 + rnd() * 0.1 : 0.38 + rnd() * 0.1;
      if (across) {
        const xm = X0 + plen * f;
        seg(xm, bk[1], xm, bk[3], false, [{ at: (bk[3] - bk[1]) / 2, w: 1.0, kind: 'door' }]);
        hs.rooms.push([bk[0], bk[1], xm, bk[3]], [xm, bk[1], bk[2], bk[3]]);
      } else {
        const zm = Z0 + plen * f;
        seg(bk[0], zm, bk[2], zm, false, [{ at: (bk[2] - bk[0]) / 2, w: 1.0, kind: 'door' }]);
        hs.rooms.push([bk[0], bk[1], bk[2], zm], [bk[0], zm, bk[2], bk[3]]);
      }
      hs.back = hs.rooms[1 + Math.floor(rnd() * 2)];
    } else hs.rooms.push(bk);
    // le ponton : la rangée de cases devant l'entrée
    hs.porch = { x0: o.x0 * C, z0: o.z0 * C, x1: (o.x0 + o.w) * C, z1: (o.z0 + o.h) * C, side: o.side };
    o.house = hs;
    houses.push(hs);
  }
  // un point libre d'une pièce (à distance des murs)
  const inRoom = (r, m = 0.6) => ({ x: r[0] + m + rnd() * (r[2] - r[0] - 2 * m), z: r[1] + m + rnd() * (r[3] - r[1] - 2 * m) });

  // 4. Le départ (dans la pièce d'entrée de la maison du départ), la porte, les bidons (dans un coin de la pièce du
  // fond), l'amarrage de la barque (le long du ponton de la maison du départ)
  const sp = inRoom(start.house.front, 1.0);
  const spawn = { x: sp.x, z: sp.z, gx: Math.floor(sp.x / C), gz: Math.floor(sp.z / C) };
  const exit = { x: door.cx, z: door.cz, gx: Math.floor(door.cx / C), gz: Math.floor(door.cz / C), door: true };
  const cassettes = canIslets.map((o, i) => {
    const r = o.house.back;
    const corner = [[r[0] + 0.55, r[1] + 0.55], [r[2] - 0.55, r[1] + 0.55], [r[0] + 0.55, r[3] - 0.55], [r[2] - 0.55, r[3] - 0.55]][Math.floor(rnd() * 4)];
    return { id: i, x: corner[0], z: corner[1], gx: Math.floor(corner[0] / C), gz: Math.floor(corner[1] / C), can: true, collected: false };
  });
  const raft0 = { x: start.cx, z: start.z0 * C - RAFT.hl - 0.3, yaw: Math.PI };

  // 5. Pas de néons : on est dehors (la lumière vient du ciel, view/ocean.js). Des bouées au large de chaque maison à
  // bidon (des repères dans la brume), et une balise à mi-chemin de la porte
  const lights = [];
  const buoys = [];
  for (const o of canIslets) {
    const a = rnd() * Math.PI * 2;
    const r = Math.max(o.w, o.h) * C * 0.5 + 6;
    buoys.push({ x: o.cx + Math.cos(a) * r, z: o.cz + Math.sin(a) * r, kind: 'ocean_buoy' });
  }
  buoys.push({ x: (spawn.x + door.cx) / 2 + (rnd() - 0.5) * 20, z: (spawn.z + door.cz) / 2, kind: 'lateral_sea_marker' });

  // 6. Les meubles qui restent à l'étage (contre les murs, tournés vers la pièce), ce que la mer a posé sur les pontons,
  // l'eau d'amande et les piles (dans les maisons)
  const props = [];
  const FURN = [
    { m: 'sofa_02', h: 0.95, r: 0.8 },
    { m: 'ArmChair_01', h: 1.0, r: 0.5 },
    { m: 'vintage_cabinet_01', h: 2.0, r: 0.55 },
    { m: 'Ottoman_01', h: 0.45, r: 0.4 },
    { m: 'wooden_crate_01', h: 0.62, r: 0.38 },
    { m: 'Barrel_01', h: 0.9, r: 0.3 },
  ];
  const PORCH = [
    { m: 'wooden_crate_02', h: 0.5, r: 0.45 },
    { m: 'lifebuoy', h: 0.12, r: 0.36, walk: true },
    { m: 'wooden_lantern_01', h: 0.45, r: 0.15 },
  ];
  const taken = [];
  const free = (x, z, r) => taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r + 0.3) && cassettes.every((c) => Math.hypot(c.x - x, c.z - z) > r + 0.8) && Math.hypot(spawn.x - x, spawn.z - z) > r + 0.8;
  // le milieu d'une ouverture de mur
  const openAt = (sg, q) => {
    const len = Math.hypot(sg.bx - sg.ax, sg.bz - sg.az);
    return { x: sg.ax + ((sg.bx - sg.ax) / len) * q.at, z: sg.az + ((sg.bz - sg.az) / len) * q.at };
  };
  for (const hs of houses) {
    for (const room of hs.rooms) {
      const want = 2 + Math.floor(rnd() * 2);
      for (let n = 0, k = 0; n < want && k < 30; k++) {
        const kd = pick(FURN);
        // contre l'un des quatre murs de la pièce, tourné vers l'intérieur
        const [x0, z0, x1, z1] = room;
        const m = kd.r + WALL_T / 2 + 0.05;
        const t = 0.15 + rnd() * 0.7;
        const p = [
          { x: x0 + (x1 - x0) * t, z: z0 + m, rot: 0 },
          { x: x0 + (x1 - x0) * t, z: z1 - m, rot: Math.PI },
          { x: x0 + m, z: z0 + (z1 - z0) * t, rot: Math.PI / 2 },
          { x: x1 - m, z: z0 + (z1 - z0) * t, rot: -Math.PI / 2 },
        ][Math.floor(rnd() * 4)];
        if (!free(p.x, p.z, kd.r)) continue;
        // pas devant une porte (de la façade ou de la cloison)
        if (hs.segs.some((sg) => sg.open.some((q) => q.kind === 'door' && Math.hypot(openAt(sg, q).x - p.x, openAt(sg, q).z - p.z) < 1.4 + kd.r))) continue;
        taken.push({ x: p.x, z: p.z, r: kd.r });
        props.push({ ...kd, x: p.x, z: p.z, rot: p.rot + (rnd() - 0.5) * 0.3 });
        n++;
      }
    }
    // sur le ponton : une caisse, une bouée ou une lanterne, sur le côté (pas devant la porte)
    const P = hs.porch;
    const kd = pick(PORCH);
    const along = P.side === 'n' || P.side === 's';
    const px = along ? P.x0 + 1 + rnd() * 1.5 : (P.x0 + P.x1) / 2;
    const pz = along ? (P.z0 + P.z1) / 2 : P.z0 + 1 + rnd() * 1.5;
    props.push({ ...kd, x: px, z: pz, rot: rnd() * Math.PI * 2 });
  }
  const scatterIn = (n) => {
    const out = [];
    for (let k = 0; k < 400 && out.length < n; k++) {
      const hs = pick(houses);
      const p = inRoom(pick(hs.rooms), 0.7);
      if (!free(p.x, p.z, 0.3)) continue;
      taken.push({ x: p.x, z: p.z, r: 0.2 });
      out.push({ id: out.length, x: p.x, z: p.z, gx: Math.floor(p.x / C), gz: Math.floor(p.z / C), taken: false });
    }
    return out;
  };
  const bottles = scatterIn(7);
  const batteries = scatterIn(6);

  // 7. La chose sous l'eau : au large, loin du départ
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
    houses,
    walls,
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
      // l'épave et les maisons qui sombrent : on n'y monte pas
      for (const o of islets) if ((o.kind === 'wreck' || o.kind === 'sunk') && x > o.x0 * C - r && x < (o.x0 + o.w) * C + r && z > o.z0 * C - r && z < (o.z0 + o.h) * C + r) return true;
      // les murs des maisons (le long de x ou de z, épaisseur WALL_T)
      const rr = r + WALL_T / 2;
      for (const w of walls) {
        const px = Math.max(Math.min(w.ax, w.bx), Math.min(Math.max(w.ax, w.bx), x));
        const pz = Math.max(Math.min(w.az, w.bz), Math.min(Math.max(w.az, w.bz), z));
        if ((x - px) ** 2 + (z - pz) ** 2 < rr * rr) return true;
      }
      return false;
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
