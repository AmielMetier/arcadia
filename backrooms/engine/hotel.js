// The Backrooms - Level 5, le Terror Hotel : un hôtel des années 1930 dont le couloir fait le tour d'un bloc de chambres,
// sans fin. 21 chambres numérotées (201 à 221) de part et d'autre du couloir, un grand hall d'entrée au sud.
//  - 6 lettres sur papier cachées dans 6 chambres : ensemble, elles forment un mot de 6 lettres (« SEARCH »…).
//  - Dans le hall, une boîte aux lettres par chambre : on y poste chaque lettre trouvée (celle de la chambre 207 va
//    dans la boîte 207). Les 6 postées, un code à 4 chiffres s'affiche au plafond du hall.
//  - Le code tapé sur le clavier à côté de la porte de l'escalier de secours l'ouvre : c'est la sortie.
//  - On ne se bat pas : on court, on s'accroupit, on se cache sous un lit ou dans une armoire.
// La grille garde ses cases de 2,5 m (murs pleins) ; les meubles ont leurs propres boîtes de collision (collide) et
// bloquent la case entière pour l'entité seulement (nav).
import { CELL_SIZE, T, itemList, bfs } from './map.js';

const C = CELL_SIZE;
export const HOTEL_CEIL = 3.1;
export const HOTEL_W = 36;
export const HOTEL_H = 31;
export const LETTERS = 6;
// les mots de la version standard (tirés au hasard) ; la version VIP lit les siens dans backrooms/password_level5/
export const WORDS = ['SEARCH', 'SHADOW', 'SILENT', 'HIDDEN', 'ESCAPE', 'MIRROR', 'CORNER', 'WINDOW', 'LETTER', 'STAIRS'];
// meubles : demi-tailles (le long du mur du fond, en profondeur) et hauteur
export const FURNITURE = {
  bed: { hw: 0.85, hd: 1.08, h: 0.62 },
  wardrobe: { hw: 0.68, hd: 0.34, h: 2.15 },
  desk: { hw: 0.6, hd: 0.3, h: 0.78 },
};
export const HIDE_R = 1.45; // portée de E pour se cacher
export const MAIL_R = 1.6; // portée de E devant les boîtes aux lettres
export const KEYPAD_R = 1.5;
export const LETTER_R = 1.6; // on ramasse une lettre en passant à côté

// un mot de 6 lettres valide (lettres A à Z), en majuscules, ou null
export const cleanWord = (w) => {
  const s = String(w || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
  return /^[A-Z]{6}$/.test(s) ? s : null;
};
// le contenu d'un fichier de mots (un par ligne, ou séparés par des virgules) : les mots valides
export const parseWords = (txt) => [...new Set(String(txt || '').split(/[\s,;]+/).map(cleanWord).filter(Boolean))];

export function createHotelMap(seed = 5) {
  const W = HOTEL_W;
  const H = HOTEL_H;
  let s = (seed >>> 0) || 1;
  const rnd = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
  const shuffle = (arr) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const grid = new Uint8Array(W * H).fill(T.WALL);
  const carve = (x0, z0, x1, z1) => {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) grid[z * W + x] = T.FLOOR;
  };
  const cellPos = (x, z) => ({ x: (x + 0.5) * C, z: (z + 0.5) * C, gx: x, gz: z });

  // 1. Le couloir en boucle autour du bloc central
  const RING = { x0: 8, z0: 8, x1: 27, z1: 19 };
  carve(RING.x0, RING.z0, RING.x1, RING.z0);
  carve(RING.x0, RING.z1, RING.x1, RING.z1);
  carve(RING.x0, RING.z0, RING.x0, RING.z1);
  carve(RING.x1, RING.z0, RING.x1, RING.z1);
  const corridorCells = [];
  for (let z = RING.z0; z <= RING.z1; z++) for (let x = RING.x0; x <= RING.x1; x++) if (grid[z * W + x] === T.FLOOR) corridorCells.push({ x, z });

  // 2. Les chambres : (x0, z0, x1, z1) inclus, la porte (case dans le mur) et le sens de la porte vers le couloir
  const rooms = [];
  const room = (x0, z0, x1, z1, door, dir) => {
    carve(x0, z0, x1, z1);
    carve(door.x, door.z, door.x, door.z);
    rooms.push({ id: rooms.length, x0, z0, x1, z1, door, dir, num: 0 });
  };
  for (const a of [8, 12, 16, 20, 24]) room(a, 3, a + 2, 6, { x: a + 1, z: 7 }, [0, 1]); // côté nord
  for (const b of [8, 12, 16]) room(29, b, 32, b + 2, { x: 28, z: b + 1 }, [-1, 0]); // côté est
  for (const a of [24, 8]) room(a, 21, a + 2, 24, { x: a + 1, z: 20 }, [0, -1]); // côté sud, de part et d'autre du hall
  for (const b of [16, 12, 8]) room(3, b, 6, b + 2, { x: 7, z: b + 1 }, [1, 0]); // côté ouest
  for (const a of [10, 14, 18, 22]) room(a, 10, a + 2, 12, { x: a + 1, z: 9 }, [0, -1]); // bloc central, nord
  for (const a of [22, 18, 14, 10]) room(a, 15, a + 2, 17, { x: a + 1, z: 18 }, [0, 1]); // bloc central, sud
  rooms.forEach((r, i) => {
    r.num = 201 + i;
  });

  // 3. Le hall d'entrée au sud, ouvert sur le couloir ; la porte de l'escalier de secours dans son mur du fond
  const LOBBY = { x0: 13, z0: 21, x1: 22, z1: 27 };
  carve(LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z1);
  carve(16, 20, 19, 20);
  const EX = { x: 18, z: 28 };
  grid[EX.z * W + EX.x] = T.EXIT;
  const elevator = { gx: EX.x, gz: EX.z, x: (EX.x + 0.5) * C, z: (EX.z + 0.5) * C, dx: 0, dz: 1, fire: true };
  const exit = cellPos(EX.x, EX.z - 1);
  // le clavier à code, à gauche de la porte (sur le mur du fond) ; les boîtes aux lettres sur le mur ouest du hall
  const keypad = { x: (EX.x - 0.15) * C, z: LOBBY.z1 * C + C, y: 1.4, rot: Math.PI }; // face au nord
  const mbMid = ((LOBBY.z0 + LOBBY.z1 + 1) / 2) * C;
  const mailbox = { x: LOBBY.x0 * C, z0: mbMid - 1.45, z1: mbMid + 1.45, y0: 0.85, y1: 2.15, rot: Math.PI / 2 }; // face à l'est, 7 × 3 casiers
  mailbox.boxes = rooms.map((r, i) => {
    const cols = 7;
    const col = i % cols;
    const row = Math.floor(i / cols);
    const u = (col + 0.5) / cols;
    // vues depuis le hall (face à l'ouest), les boîtes se lisent de gauche à droite : 201, 202… (du sud au nord)
    return { num: r.num, room: r.id, z: mailbox.z1 - u * (mailbox.z1 - mailbox.z0), y: mailbox.y1 - 0.25 - row * 0.4, letter: -1 };
  });
  const lobbyCenter = { x: ((LOBBY.x0 + LOBBY.x1 + 1) / 2) * C, z: ((LOBBY.z0 + LOBBY.z1 + 1) / 2) * C };
  const spawnCell = { x: 17, z: 25 };

  // 4. Les meubles de chaque chambre : le lit contre le mur du fond (en face de la porte), l'armoire dans un coin du
  // fond, un bureau dans l'autre (parfois pas d'armoire : alors on n'a que le lit pour se cacher)
  const furniture = [];
  const spots = []; // cachettes
  const blockCells = new Set(); // cases que l'entité contourne (les meubles)
  for (const r of rooms) {
    const [dx, dz] = r.dir;
    // le mur du fond est du côté opposé à la porte ; u : le long du mur du fond, v : vers la porte
    const along = dx !== 0 ? 'z' : 'x';
    const farCells = [];
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const far = dx > 0 ? x === r.x0 : dx < 0 ? x === r.x1 : dz > 0 ? z === r.z0 : z === r.z1;
        if (far) farCells.push({ x, z });
      }
    }
    farCells.sort((a, b) => (along === 'x' ? a.x - b.x : a.z - b.z));
    const mid = farCells[1];
    const corners = rnd() < 0.5 ? [farCells[0], farCells[2]] : [farCells[2], farCells[0]];
    // le point contre le mur du fond, au milieu de la case c, avancé de d vers la porte
    const atWall = (c, d) => ({ x: (c.x + 0.5) * C - dx * (C / 2 - d), z: (c.z + 0.5) * C - dz * (C / 2 - d) });
    const rot = Math.atan2(dx, dz); // l'avant du meuble regarde la porte
    const put = (kind, c) => {
      const f = FURNITURE[kind];
      const p = atWall(c, f.hd + 0.02);
      const hx = dx !== 0 ? f.hd : f.hw;
      const hz = dx !== 0 ? f.hw : f.hd;
      const item = { kind, room: r.id, x: p.x, z: p.z, rot, hx, hz, h: f.h, gx: c.x, gz: c.z };
      furniture.push(item);
      blockCells.add(c.z * W + c.x);
      return item;
    };
    const bed = put('bed', mid);
    // caché, on regarde vers la porte ; on se glisse sous le lit par son pied, on entre dans l'armoire par devant
    const yaw = Math.atan2(-dx, -dz);
    spots.push({ id: spots.length, kind: 'bed', room: r.id, x: bed.x, z: bed.z, yaw, out: { x: bed.x + dx * (FURNITURE.bed.hd + 0.7), z: bed.z + dz * (FURNITURE.bed.hd + 0.7) } });
    if (rnd() < 0.7) {
      const w = put('wardrobe', corners[0]);
      spots.push({ id: spots.length, kind: 'wardrobe', room: r.id, x: w.x, z: w.z, yaw, out: { x: w.x + dx * 0.95, z: w.z + dz * 0.95 } });
    }
    r.desk = put('desk', corners[1]);
  }

  // 5. Accessibilité depuis le hall
  const dist = bfs(grid, W, H, spawnCell.x, spawnCell.z);
  const walkable = [];
  for (let z = 1; z < H - 1; z++) for (let x = 1; x < W - 1; x++) if (grid[z * W + x] === T.FLOOR && dist[z * W + x] >= 0) walkable.push({ x, z });

  // les montants des portes de chambre (la baie de la case de porte est ramenée à 1,2 m) et le comptoir de la réception
  const DOOR_W = 1.2;
  const solids = [];
  for (const r of rooms) {
    const { x, z } = r.door;
    const jamb = (C - DOOR_W) / 4; // demi-largeur d'un montant
    if (r.dir[0] === 0) for (const sx of [-1, 1]) solids.push({ x: (x + 0.5) * C + sx * (DOOR_W / 2 + jamb), z: (z + 0.5) * C, hx: jamb, hz: C / 2 });
    else for (const sz of [-1, 1]) solids.push({ x: (x + 0.5) * C, z: (z + 0.5) * C + sz * (DOOR_W / 2 + jamb), hx: C / 2, hz: jamb });
  }
  const desk = { x: (LOBBY.x1 + 0.55) * C, z: (LOBBY.z0 + 3.5) * C, hx: 0.45, hz: 2.4, reception: true };
  solids.push(desk);
  const collide = (x, z, rad) => {
    for (const f of furniture) if (Math.abs(f.x - x) < f.hx + rad && Math.abs(f.z - z) < f.hz + rad) return true;
    for (const f of solids) if (Math.abs(f.x - x) < f.hx + rad && Math.abs(f.z - z) < f.hz + rad) return true;
    return false;
  };

  // 6. Les 6 lettres : dans 6 chambres tirées au hasard, plutôt éloignées les unes des autres ; posées sur le lit, sur
  // le bureau ou par terre (là où l'on peut se tenir à côté)
  const order = shuffle(rooms.map((r) => r.id));
  const chosen = [];
  for (const id of order) {
    const r = rooms[id];
    const c = { x: (r.x0 + r.x1 + 1) / 2, z: (r.z0 + r.z1 + 1) / 2 };
    if (chosen.every((o) => Math.hypot(o.c.x - c.x, o.c.z - c.z) > 6)) chosen.push({ r, c });
    if (chosen.length === LETTERS) break;
  }
  for (const id of order) {
    if (chosen.length >= LETTERS) break;
    if (!chosen.some((o) => o.r.id === id)) chosen.push({ r: rooms[id], c: null });
  }
  // dans l'ordre des numéros de chambre, les boîtes aux lettres épellent le mot : la lettre i va dans la i-ème chambre
  chosen.sort((a, b) => a.r.num - b.r.num);
  const letters = chosen.map(({ r }, i) => {
    const where = rnd();
    let p;
    let y;
    if (where < 0.4) {
      const b = furniture.find((f) => f.room === r.id && f.kind === 'bed');
      p = { x: b.x + (rnd() - 0.5) * 0.6, z: b.z + (rnd() - 0.5) * 0.6 };
      y = b.h + 0.02;
    } else if (where < 0.7) {
      p = { x: r.desk.x, z: r.desk.z };
      y = FURNITURE.desk.h + 0.01;
    } else {
      // par terre, dans une case libre de la chambre
      const free = [];
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (!blockCells.has(z * W + x)) free.push({ x, z });
      const c = pick(free);
      p = { x: (c.x + 0.25 + rnd() * 0.5) * C, z: (c.z + 0.25 + rnd() * 0.5) * C };
      y = 0.01;
    }
    return { id: i, idx: i, room: r.id, num: r.num, x: p.x, z: p.z, y, rot: rnd() * Math.PI * 2, gx: Math.floor(p.x / C), gz: Math.floor(p.z / C), taken: false, posted: false };
  });
  for (const L of letters) mailbox.boxes.find((b) => b.num === L.num).letter = L.id;

  // 7. Le code à 4 chiffres (même graine, même code chez tout le monde)
  const code = String(1000 + Math.floor(rnd() * 9000));

  // 8. Les lumières : appliques Art déco dans le couloir (une case sur deux, contre un mur), une lampe de chevet par
  // chambre (souvent éteinte), le lustre du hall. Beaucoup grésillent ou sont mortes.
  const lights = [];
  const addLight = (x, z, o = {}) => lights.push({ x, y: 2.0, z, gx: Math.floor(x / C), gz: Math.floor(z / C), state: 'on', flicker: false, bright: false, fy: 2.0, fs: 0.5, hidden: true, ...o });
  corridorCells.forEach((c, i) => {
    if ((c.x + c.z) % 2) return;
    const v = rnd();
    const st = v < 0.08 ? 'off' : v < 0.22 ? 'flicker' : 'on';
    // contre le mur le plus proche (le mur extérieur du couloir)
    const wall = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dx, dz]) => grid[(c.z + dz) * W + c.x + dx] === T.WALL) || [0, -1];
    addLight((c.x + 0.5 + wall[0] * 0.42) * C, (c.z + 0.5 + wall[1] * 0.42) * C, { state: st, flicker: st === 'flicker', bright: st === 'on', sconce: { dx: wall[0], dz: wall[1] } });
  });
  for (const r of rooms) {
    const st = rnd() < 0.75 ? 'on' : rnd() < 0.6 ? 'flicker' : 'off';
    addLight(r.desk.x, r.desk.z, { state: st, flicker: st === 'flicker', bright: st === 'on', y: 1.2, fy: 1.2, lamp: true });
    // un plafonnier caché au milieu de la chambre, plus doux
    addLight(((r.x0 + r.x1 + 1) / 2) * C, ((r.z0 + r.z1 + 1) / 2) * C, { state: rnd() < 0.7 ? 'on' : 'off', y: HOTEL_CEIL - 0.1, fy: HOTEL_CEIL - 0.1 });
  }
  // une applique au-dessus des boîtes aux lettres
  addLight(mailbox.x + 0.2, mbMid, { state: 'on', y: 2.5, fy: 2.5, bright: true, sconce: { dx: -1, dz: 0 } });
  for (const [ox, oz] of [[-1, -0.8], [1, -0.8], [0, 1.2]]) addLight(lobbyCenter.x + ox * C * 1.5, lobbyCenter.z + oz * C, { state: 'on', bright: true, y: HOTEL_CEIL - 0.5, fy: HOTEL_CEIL - 0.5, chandelier: true });

  // 9. Quelques piles et eaux d'amande, dans les chambres sans lettre et le couloir
  const busy = [cellPos(spawnCell.x, spawnCell.z), ...letters, ...furniture];
  const scatter = (n) => {
    const out = [];
    for (let i = 0; i < 2000 && out.length < n; i++) {
      const c = pick(walkable);
      if (blockCells.has(c.z * W + c.x) || dist[c.z * W + c.x] < 5) continue;
      const x = (c.x + 0.3 + rnd() * 0.4) * C;
      const z = (c.z + 0.3 + rnd() * 0.4) * C;
      if (collide(x, z, 0.5) || busy.some((b) => Math.hypot(b.x - x, b.z - z) < 2.5)) continue;
      busy.push({ x, z });
      out.push({ id: out.length, x, z, gx: c.x, gz: c.z, taken: false });
    }
    return out;
  };
  const bottles = scatter(5);
  const batteries = scatter(5);

  // l'entité part du couloir nord, loin du hall
  const monsterCell = { x: 17, z: RING.z0 };

  const isWall = (gx, gz) => {
    if (gx < 0 || gx >= W || gz < 0 || gz >= H) return true;
    const v = grid[gz * W + gx];
    return v === T.WALL || v === T.EXIT;
  };
  const map = {
    level: 3,
    name: 5,
    ceil: HOTEL_CEIL,
    W,
    H,
    grid,
    walkable,
    dist,
    spawn: cellPos(spawnCell.x, spawnCell.z),
    exit,
    elevator,
    cassettes: [],
    fuses: [],
    lights,
    props: [],
    bottles,
    batteries,
    items: itemList(['bottle', bottles], ['battery', batteries]),
    pits: [],
    niche: null,
    pitAt: () => -1,
    rooms,
    lobby: LOBBY,
    lobbyCenter,
    ring: RING,
    corridorCells,
    furniture,
    solids,
    doorW: DOOR_W,
    spots,
    letters,
    mailbox,
    keypad,
    code,
    monsterSpawn: cellPos(monsterCell.x, monsterCell.z),
    isWall,
    pillarAt: () => null,
    collide,
    // la chambre (ou null) d'un point
    roomAt(x, z) {
      const gx = Math.floor(x / C);
      const gz = Math.floor(z / C);
      return rooms.find((r) => gx >= r.x0 && gx <= r.x1 && gz >= r.z0 && gz <= r.z1) || null;
    },
    isWalkableWorld(wx, wz) {
      return !isWall(Math.floor(wx / C), Math.floor(wz / C)) && !collide(wx, wz, 0.05);
    },
  };
  // pour les chemins de l'entité : les cases des meubles sont des murs (elle les contourne au lieu de les traverser)
  map.nav = Object.create(map);
  map.nav.isWall = (gx, gz) => isWall(gx, gz) || blockCells.has(gz * W + gx);
  return map;
}
