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
// le hall monte plus haut que les couloirs (un vrai hall d'hôtel) : ses lustres pendent de 4,40 m
export const LOBBY_CEIL = 4.4;
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

  // 1. Les couloirs, en deux boucles qui se partagent une galerie :
  //  - l'allée principale, au nord, d'un bout à l'autre de l'étage ;
  //  - la galerie, large de deux cases, qui monte du hall jusqu'au palier des ascenseurs ;
  //  - à l'est, une boucle autour d'un bloc de chambres (le couloir de service longe le mur extérieur) ;
  //  - à l'ouest, une boucle plus courte qui passe par le salon d'étage ;
  //  - le palier des ascenseurs, en cul-de-sac au bout de la galerie.
  // (RING : l'allée principale et le couloir du sud, que les tests prennent pour repères)
  const RING = { x0: 4, z0: 9, x1: 32, z1: 19 };
  const corridorCells = [];
  const corridorSet = new Set();
  const inRect = (R, c) => c.x >= R.x0 && c.x <= R.x1 && c.z >= R.z0 && c.z <= R.z1;
  const hall = (x0, z0, x1, z1) => {
    carve(x0, z0, x1, z1);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (!corridorSet.has(z * W + x)) corridorSet.add(z * W + x), corridorCells.push({ x, z });
  };
  hall(4, 9, 32, 9); // l'allée principale
  hall(17, 10, 18, 18); // la galerie
  hall(7, 19, 32, 19); // le couloir du sud, devant le hall
  hall(32, 10, 32, 18); // le couloir de service, à l'est
  hall(5, 10, 5, 16); // le couloir de l'ouest
  const LOUNGE = { x0: 3, z0: 17, x1: 6, z1: 19 }; // le salon d'étage
  hall(LOUNGE.x0, LOUNGE.z0, LOUNGE.x1, LOUNGE.z1);
  const ALCOVE = { x0: 16, z0: 6, x1: 19, z1: 8 }; // le palier des ascenseurs
  hall(ALCOVE.x0, ALCOVE.z0, ALCOVE.x1, ALCOVE.z1);

  // 2. Les chambres : (x0, z0, x1, z1) inclus, la porte (case dans le mur) et le sens de la porte vers le couloir
  const rooms = [];
  const room = (x0, z0, x1, z1, door, dir) => {
    carve(x0, z0, x1, z1);
    carve(door.x, door.z, door.x, door.z);
    rooms.push({ id: rooms.length, x0, z0, x1, z1, door, dir, num: 0 });
  };
  for (const a of [3, 7, 11, 21, 25, 29]) room(a, 4, a + 2, 7, { x: a + 1, z: 8 }, [0, 1]); // au nord de l'allée
  for (const a of [20, 24, 28]) room(a, 11, a + 2, 13, { x: a + 1, z: 10 }, [0, -1]); // le bloc de l'est, côté allée
  for (const a of [28, 24, 20]) room(a, 15, a + 2, 17, { x: a + 1, z: 18 }, [0, 1]); // le bloc de l'est, côté sud
  for (const a of [31, 27, 23]) room(a, 21, a + 2, 24, { x: a + 1, z: 20 }, [0, -1]); // au sud-est, à côté du hall
  for (const b of [14, 10]) room(12, b, 15, b + 2, { x: 16, z: b + 1 }, [1, 0]); // sur la galerie, côté ouest
  for (const b of [10, 14]) room(7, b, 10, b + 2, { x: 6, z: b + 1 }, [-1, 0]); // sur le couloir de l'ouest
  for (const a of [5, 9]) room(a, 21, a + 2, 24, { x: a + 1, z: 20 }, [0, -1]); // au sud-ouest (l'une s'ouvre sur le salon)
  rooms.forEach((r, i) => {
    r.num = 201 + i;
  });

  // 3. Le hall d'entrée au sud, ouvert sur le couloir ; la porte de l'escalier de secours dans son mur du fond
  const LOBBY = { x0: 14, z0: 21, x1: 21, z1: 25 }; // 20 × 12,5 m : assez petit pour être meublé de partout
  carve(LOBBY.x0, LOBBY.z0, LOBBY.x1, LOBBY.z1);
  carve(16, 20, 19, 20);
  const EX = { x: 18, z: LOBBY.z1 + 1 };
  grid[EX.z * W + EX.x] = T.EXIT;
  const elevator = { gx: EX.x, gz: EX.z, x: (EX.x + 0.5) * C, z: (EX.z + 0.5) * C, dx: 0, dz: 1, fire: true };
  const exit = cellPos(EX.x, EX.z - 1);
  // le clavier à code, à droite de la porte vu du hall, côté serrure (sur le mur du fond) ; les boîtes aux lettres sur le mur ouest du hall
  const keypad = { x: (EX.x + 1.15) * C, z: LOBBY.z1 * C + C, y: 1.4, rot: Math.PI }; // face au nord
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
  const spawnCell = { x: 17, z: 24 };

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
    // (les cachettes servent aussi de « casiers » au moteur : dx, dz vers la sortie, by : qui s'y cache)
    spots.push({ id: spots.length, kind: 'bed', room: r.id, x: bed.x, z: bed.z, dx, dz, gx: mid.x, gz: mid.z, ry: rot, by: -1, yaw, out: { x: bed.x + dx * (FURNITURE.bed.hd + 0.7), z: bed.z + dz * (FURNITURE.bed.hd + 0.7) } });
    if (rnd() < 0.7) {
      const w = put('wardrobe', corners[0]);
      spots.push({ id: spots.length, kind: 'wardrobe', room: r.id, x: w.x, z: w.z, dx, dz, gx: corners[0].x, gz: corners[0].z, ry: rot, by: -1, yaw, out: { x: w.x + dx * 0.95, z: w.z + dz * 0.95 } });
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
  // le hall : X0..X1, Z0..Z1 (mètres) ; l'entrée (vers le couloir) au nord, la porte de secours au sud
  const X0 = LOBBY.x0 * C;
  const X1 = (LOBBY.x1 + 1) * C;
  const Z0 = LOBBY.z0 * C;
  const Z1 = (LOBBY.z1 + 1) * C;
  // le comptoir de la réception, à l'est, à 1,60 m du mur (le personnel passe derrière)
  const desk = { x: X1 - 1.6, z: ((LOBBY.z0 + LOBBY.z1 + 1) / 2) * C, hx: 0.45, hz: 2.4, reception: true };
  solids.push(desk);
  // le mobilier du hall (modèles Poly Haven, CC0) : m, hauteur h, rayon de collision r (0 : posé sur un meuble), y au-dessus
  // du sol, rot (l'avant du modèle, +z, tourné vers…) : N = vers le nord (-z), S, E, W
  const N = Math.PI;
  const S = 0;
  const E = Math.PI / 2;
  const Wd = -Math.PI / 2;
  const lobbyProps = [
    // la réception : derrière, la vitrine des clés ; dessus, la caisse, la pendule, la lampe à pétrole
    { m: 'vintage_cabinet_01', h: 2.0, r: 0.6, x: X1 - 0.32, z: desk.z, rot: Wd },
    { m: 'CashRegister_01', h: 0.42, r: 0, x: desk.x, z: desk.z - 1.3, y: 1.13, rot: Wd },
    { m: 'mantel_clock_01', h: 0.32, r: 0, x: desk.x + 0.05, z: desk.z + 0.4, y: 1.13, rot: Wd },
    { m: 'vintage_oil_lamp', h: 0.55, r: 0, x: desk.x, z: desk.z + 1.7, y: 1.13, rot: 0 },
    // le salon au sud-ouest : un canapé contre le mur, deux fauteuils, la table basse, un pouf
    { m: 'sofa_03', h: 1.0, r: 0.9, x: X0 + 5, z: Z1 - 0.65, rot: N },
    { m: 'fancy_picture_frame_01', h: 0.9, r: 0, x: X0 + 5, z: Z1 - 0.04, y: 1.45, rot: N },
    { m: 'gothic_coffee_table', h: 0.5, r: 0.55, x: X0 + 5, z: Z1 - 2.4, rot: 0 },
    { m: 'ArmChair_01', h: 1.0, r: 0.5, x: X0 + 2.9, z: Z1 - 2.5, rot: E },
    { m: 'ArmChair_01', h: 1.0, r: 0.5, x: X0 + 7.1, z: Z1 - 2.5, rot: Wd },
    { m: 'Ottoman_01', h: 0.45, r: 0.4, x: X0 + 5, z: Z1 - 4.0, rot: 0.3 },
    { m: 'potted_plant_02', h: 0.95, r: 0.4, x: X0 + 0.7, z: Z1 - 0.7, rot: 0 },
    // près de l'entrée : un canapé contre le mur ouest, un fauteuil vert, la commode et son miroir, une plante
    { m: 'sofa_02', h: 0.95, r: 0.8, x: X0 + 0.6, z: Z0 + 2.6, rot: E },
    { m: 'GreenChair_01', h: 1.05, r: 0.5, x: X0 + 2.3, z: Z0 + 2.4, rot: E - 0.5 },
    { m: 'GothicCommode_01', h: 0.95, r: 0.45, x: X0 + 2.8, z: Z0 + 0.35, rot: S },
    { m: 'antique_ceramic_vase_01', h: 0.4, r: 0, x: X0 + 2.8, z: Z0 + 0.35, y: 0.95, rot: 0 },
    { m: 'ornate_mirror_01', h: 1.1, r: 0, x: X0 + 2.8, z: Z0 + 0.04, y: 1.3, rot: S },
    { m: 'potted_plant_02', h: 0.95, r: 0.4, x: X0 + 0.7, z: Z0 + 0.7, rot: 1 },
    // au nord-est, l'horloge comtoise et une plante ; au sud-est, la console et son buste
    { m: 'vintage_grandfather_clock_01', h: 2.1, r: 0.35, x: X1 - 2.2, z: Z0 + 0.3, rot: S },
    { m: 'potted_plant_02', h: 0.95, r: 0.4, x: X1 - 0.7, z: Z0 + 0.7, rot: 2 },
    { m: 'ClassicConsole_01', h: 0.85, r: 0.45, x: X1 - 3.2, z: Z1 - 0.35, rot: N },
    { m: 'marble_bust_01', h: 0.55, r: 0, x: X1 - 3.2, z: Z1 - 0.35, y: 0.85, rot: N },
    { m: 'potted_plant_02', h: 0.95, r: 0.4, x: X1 - 0.7, z: Z1 - 0.7, rot: 0.5 },
    // les valises : sur le chariot à bagages devant la réception, et une qui traîne par terre
    { m: 'vintage_suitcase', h: 0.55, r: 0, x: desk.x - 3.0, z: desk.z - 3.6, y: 0.32, rot: 0.2 },
    { m: 'vintage_suitcase', h: 0.55, r: 0.4, x: desk.x - 1.6, z: desk.z + 3.4, rot: 1.9 },
    // la plante au sommet de la banquette ronde du milieu
    { m: 'potted_plant_02', h: 0.95, r: 0, x: lobbyCenter.x, z: lobbyCenter.z, y: 0.92, rot: 0 },
    // les lustres : les trois du milieu, un au-dessus du salon, un devant la réception
    ...[[-1, -0.8], [1, -0.8], [0, 1.2]].map(([ox, oz]) => ({ m: 'Chandelier_01', h: 1.0, r: 0, x: lobbyCenter.x + ox * C * 1.5, z: lobbyCenter.z + oz * C, y: LOBBY_CEIL - 1.0, rot: 0 })),
    { m: 'Chandelier_01', h: 1.0, r: 0, x: X0 + 5, z: Z1 - 2.6, y: LOBBY_CEIL - 1.0, rot: 0.4 },
    { m: 'Chandelier_01', h: 1.0, r: 0, x: desk.x - 2.2, z: desk.z, y: LOBBY_CEIL - 1.0, rot: 0.4 },
  ];
  // la banquette ronde de velours au milieu du hall, et deux colonnes de marbre de part et d'autre de l'entrée
  solids.push({ x: lobbyCenter.x, z: lobbyCenter.z, hx: 1.15, hz: 1.15, banquette: true });
  for (const x of [16 * C + 0.6, 20 * C - 0.6]) solids.push({ x, z: Z0 + 1.0, hx: 0.34, hz: 0.34, column: true });
  // le chariot à bagages (dessiné à la main, view/hotel.js) : une collision
  const cart = { x: desk.x - 3.0, z: desk.z - 3.6, hx: 0.45, hz: 0.75, cart: true };
  solids.push(cart);
  for (const p of lobbyProps) if (p.r > 0.5) blockCells.add(Math.floor(p.z / C) * W + Math.floor(p.x / C));
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

  // 6b. L'habillage des chambres, tiré d'un second hasard (les lettres, le code et les lumières ne changent pas) :
  // une fenêtre aux rideaux tirés sur un mur de côté, son radiateur et un fauteuil ; une table de nuit de chaque côté
  // du lit ; parfois une commode et son miroir sur l'autre mur, une valise ; un tableau au-dessus du lit, un miroir
  // au-dessus du bureau. Les meubles qu'on heurte restent contre les murs (à moins d'un mètre), loin des lettres.
  let s2 = ((seed * 7919) >>> 0) || 7;
  const drnd = () => {
    s2 = (s2 + 0x6d2b79f5) >>> 0;
    let t = s2;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const roomProps = [];
  for (const r of rooms) {
    const [dx, dz] = r.dir;
    const nU = dx !== 0 ? r.z1 - r.z0 + 1 : r.x1 - r.x0 + 1; // cases le long du mur du fond
    const nV = dx !== 0 ? r.x1 - r.x0 + 1 : r.z1 - r.z0 + 1; // cases du fond vers la porte
    const ux = dz; // l'axe u, le long du mur du fond
    const uz = -dx;
    const fx = ((r.x0 + r.x1 + 1) / 2) * C - dx * (nV * C) / 2; // le milieu du mur du fond
    const fz = ((r.z0 + r.z1 + 1) / 2) * C - dz * (nV * C) / 2;
    const at = (u, v) => ({ x: fx + ux * u + dx * v, z: fz + uz * u + dz * v });
    const yawTo = (vx, vz) => Math.atan2(vx, vz); // un modèle dont l'avant (+z) regarde vers (vx, vz)
    const half = (nU * C) / 2;
    const free = (p, d) => !letters.some((L) => L.room === r.id && Math.hypot(L.x - p.x, L.z - p.z) < d);
    const box = (p, hu, hv) => (ux !== 0 ? { hx: hu, hz: hv } : { hx: hv, hz: hu }); // demi-tailles selon u (le long du mur du fond) et v (vers la porte)
    const side = drnd() < 0.5 ? -1 : 1; // le mur de la fenêtre
    const vW = Math.min(nV * C - 2.4, 2.1 * C);
    const wp = at(side * half, vW);
    r.win = { x: wp.x, z: wp.z, nx: -side * ux, nz: -side * uz, w: 1.5 };
    // le radiateur sous la fenêtre (en fonte, 15 cm d'épaisseur)
    const rp = at(side * (half - 0.11), vW);
    solids.push({ ...rp, ...box(rp, 0.08, 0.46), radiator: true, nx: -side * ux, nz: -side * uz });
    // les tables de nuit, de part et d'autre du lit
    const bedU = 0; // le lit est au milieu du mur du fond
    for (const sgn of [-1, 1]) {
      const np = at(bedU + sgn * (FURNITURE.bed.hw + 0.27), 0.22);
      solids.push({ ...np, ...(ux !== 0 ? { hx: 0.22, hz: 0.2 } : { hx: 0.2, hz: 0.22 }), nightstand: true, rot: yawTo(dx, dz), phone: sgn === (r.id % 2 ? 1 : -1) });
    }
    // le fauteuil, près de la fenêtre, tourné vers le lit
    const ap = at(side * (half - 0.5), vW + 1.3);
    if (free(ap, 1.1)) roomProps.push({ m: drnd() < 0.6 ? 'ArmChair_01' : 'GreenChair_01', h: 1.0, r: 0.38, ...ap, rot: yawTo(-side * ux - dx * 0.6, -side * uz - dz * 0.6) });
    // la commode et son miroir, en face de la fenêtre ; dessus, une pendule ou un vase
    if (drnd() < 0.65) {
      const cp = at(-side * (half - 0.3), vW);
      if (free(cp, 1.0)) {
        const face = yawTo(side * ux, side * uz);
        roomProps.push({ m: 'GothicCommode_01', h: 0.95, r: 0.36, ...cp, rot: face });
        roomProps.push({ m: drnd() < 0.5 ? 'mantel_clock_01' : 'antique_ceramic_vase_01', h: drnd() < 0.5 ? 0.32 : 0.38, r: 0, ...at(-side * (half - 0.3), vW + 0.25), y: 0.95, rot: face });
        const mp = at(-side * (half - 0.03), vW);
        roomProps.push({ m: 'ornate_mirror_01', h: 0.95, r: 0, ...mp, y: 1.3, rot: face });
      }
    }
    // un tableau au-dessus de la tête de lit, un miroir au-dessus du bureau
    roomProps.push({ m: 'fancy_picture_frame_01', h: 0.62, r: 0, ...at(bedU, 0.03), y: 1.45, rot: yawTo(dx, dz) });
    const dU = (r.desk.x - fx) * ux + (r.desk.z - fz) * uz;
    roomProps.push({ m: 'ornate_mirror_01', h: 0.8, r: 0, ...at(dU, 0.03), y: 1.2, rot: yawTo(dx, dz) });
    // une valise laissée contre le mur de la fenêtre, près du fond
    if (drnd() < 0.5) {
      const vp = at(side * (half - 0.32), 1.9);
      if (free(vp, 0.9)) roomProps.push({ m: 'vintage_suitcase', h: 0.55, r: 0.3, ...vp, rot: yawTo(-side * ux, -side * uz) + (drnd() - 0.5) * 0.5 });
    }
    // un pouf au pied du lit, une plante dans un coin du fond (loin de l'armoire et des lettres)
    const clear = (p, d) => free(p, d) && !spots.some((h) => h.room === r.id && Math.hypot(h.x - p.x, h.z - p.z) < d + 0.5) && !roomProps.some((q) => q.r > 0 && Math.hypot(q.x - p.x, q.z - p.z) < d);
    const op = at(bedU, 2 * FURNITURE.bed.hd + 0.42);
    if (drnd() < 0.55 && clear(op, 0.9)) roomProps.push({ m: 'Ottoman_01', h: 0.42, r: 0.3, ...op, rot: yawTo(dx, dz) + (drnd() - 0.5) * 0.3 });
    const pp = at(-side * (half - 0.42), 0.42);
    if (drnd() < 0.6 && clear(pp, 1.0)) roomProps.push({ m: 'potted_plant_02', h: 0.95, r: 0.3, ...pp, rot: drnd() * 6.28 });
    // une chambre sur trois a été fouillée : tiroirs ouverts, draps défaits (voir view/hotelRooms.js)
    r.mess = drnd() < 0.33;
  }

  // 6c. L'habillage des couloirs (même second hasard) : contre les murs sans applique, des tableaux, des consoles avec
  // un vase ou une lampe à pétrole sous un miroir, une banquette, un extincteur et son déclencheur ; une plante dans les
  // angles ; une pendule arrêtée ; un panneau « sol glissant » oublié. Rien devant les portes des chambres (plateaux,
  // chaussures, journaux), rien de plus profond que 50 cm : le couloir reste libre
  const hallProps = [];
  {
    const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    const wallAt = (x, z) => grid[z * W + x] === T.WALL;
    const doorCells = new Set(rooms.map((r) => r.door.z * W + r.door.x));
    const nearDoor = (c) => DIRS.some(([dx, dz]) => doorCells.has((c.z + dz) * W + c.x + dx));
    const yawTo = (vx, vz) => Math.atan2(vx, vz);
    let clock = false;
    for (const c of corridorCells) {
      if (nearDoor(c) || inRect(ALCOVE, c)) continue;
      const walls = DIRS.filter(([dx, dz]) => wallAt(c.x + dx, c.z + dz));
      const sconce = (c.x + c.z) % 2 === 0 ? walls[0] : null; // (voir 8 : l'applique prend le premier mur trouvé)
      const cx = (c.x + 0.5) * C;
      const cz = (c.z + 0.5) * C;
      // un angle : une plante
      const corner = walls.find(([ax, az]) => walls.some(([bx, bz]) => ax * bx + az * bz === 0 && (ax !== bx || az !== bz)));
      if (corner) {
        const other = walls.find(([bx, bz]) => corner[0] * bx + corner[1] * bz === 0);
        hallProps.push({ m: 'potted_plant_02', h: 1.0, r: 0.3, x: cx + (corner[0] + other[0]) * (C / 2 - 0.42), z: cz + (corner[1] + other[1]) * (C / 2 - 0.42), rot: drnd() * 6.28 });
        continue;
      }
      if (inRect(LOUNGE, c)) continue; // (le salon est meublé plus bas)
      for (const [dx, dz] of walls) {
        if (sconce && sconce[0] === dx && sconce[1] === dz) continue;
        const face = yawTo(-dx, -dz); // l'avant du modèle tourné vers le couloir
        const on = (d, y = 0) => ({ x: cx + dx * (C / 2 - d), z: cz + dz * (C / 2 - d), ...(y ? { y } : {}) });
        const u = drnd();
        if (u < 0.3) {
          if (!clock && drnd() < 0.12) {
            clock = true;
            hallProps.push({ m: 'wall_clock', h: 0.36, r: 0, ...on(0.04, 1.95), rot: face });
          } else hallProps.push({ m: 'fancy_picture_frame_01', h: 0.72, r: 0, ...on(0.03, 1.45), rot: face });
        } else if (u < 0.4) {
          hallProps.push({ m: 'ClassicConsole_01', h: 0.85, r: 0.3, ...on(0.24), rot: face });
          hallProps.push({ m: drnd() < 0.6 ? 'antique_ceramic_vase_01' : 'vintage_oil_lamp', h: 0.42, r: 0, ...on(0.24, 0.85), rot: face + drnd() });
          hallProps.push({ m: 'ornate_mirror_01', h: 0.85, r: 0, ...on(0.03, 1.4), rot: face });
        } else if (u < 0.44) {
          hallProps.push({ m: 'painted_wooden_bench', h: 0.48, r: 0.3, ...on(0.26), rot: face });
        } else if (u < 0.47) {
          hallProps.push({ m: 'korean_fire_extinguisher_01', h: 0.62, r: 0.14, ...on(0.14), rot: face });
          hallProps.push({ m: 'fire_alarm', h: 0.16, r: 0, ...on(0.02, 1.4), rot: face });
        }
      }
    }
    // le salon d'étage : un canapé contre le mur ouest sous un tableau, une table basse, deux fauteuils tournés vers lui,
    // une lampe à pétrole sur la table
    const lx = LOUNGE.x0 * C;
    const lz = ((LOUNGE.z0 + LOUNGE.z1 + 1) / 2) * C;
    hallProps.push({ m: 'sofa_02', h: 0.95, r: 0.8, x: lx + 0.55, z: lz, rot: Math.PI / 2 });
    hallProps.push({ m: 'fancy_picture_frame_01', h: 0.8, r: 0, x: lx + 0.03, z: lz, y: 1.55, rot: Math.PI / 2 });
    hallProps.push({ m: 'gothic_coffee_table', h: 0.5, r: 0.5, x: lx + 2.3, z: lz, rot: Math.PI / 2 });
    hallProps.push({ m: 'vintage_oil_lamp', h: 0.5, r: 0, x: lx + 2.3, z: lz + 0.25, y: 0.5, rot: 0.6 });
    for (const sz of [-1, 1]) hallProps.push({ m: drnd() < 0.5 ? 'ArmChair_01' : 'GreenChair_01', h: 1.0, r: 0.45, x: lx + 3.9, z: lz + sz * 1.3, rot: -Math.PI / 2 + sz * 0.35 });
    // le palier des ascenseurs : une plante de chaque côté des portes
    for (const ax of [ALCOVE.x0 * C + 0.45, (ALCOVE.x1 + 1) * C - 0.45]) hallProps.push({ m: 'potted_plant_02', h: 1.05, r: 0.3, x: ax, z: ALCOVE.z0 * C + 0.45, rot: drnd() * 6.28 });
    // le panneau « sol glissant », planté au milieu d'un couloir droit
    const straight = corridorCells.filter((c) => !nearDoor(c) && DIRS.filter(([dx, dz]) => wallAt(c.x + dx, c.z + dz)).length === 2);
    if (straight.length) {
      const c = straight[Math.floor(drnd() * straight.length)];
      hallProps.push({ m: 'WetFloorSign_01', h: 0.62, r: 0.22, x: (c.x + 0.3 + drnd() * 0.4) * C, z: (c.z + 0.3 + drnd() * 0.4) * C, rot: drnd() * 6.28 });
    }
  }

  // 7. Le code à 4 chiffres (même graine, même code chez tout le monde)
  const code = String(1000 + Math.floor(rnd() * 9000));

  // 8. Les lumières : appliques Art déco dans le couloir (une case sur deux, contre un mur), une lampe de chevet par
  // chambre (souvent éteinte), le lustre du hall. Beaucoup grésillent ou sont mortes.
  const lights = [];
  const addLight = (x, z, o = {}) => lights.push({ x, y: 2.0, z, gx: Math.floor(x / C), gz: Math.floor(z / C), state: 'on', flicker: false, bright: false, fy: 2.0, fs: 0.5, hidden: true, ...o });
  corridorCells.forEach((c, i) => {
    if ((c.x + c.z) % 2) return;
    const v = rnd();
    const st = v < 0.04 ? 'off' : v < 0.14 ? 'flicker' : 'on';
    // contre le mur le plus proche (le mur extérieur du couloir)
    const wall = [[0, -1], [0, 1], [-1, 0], [1, 0]].find(([dx, dz]) => grid[(c.z + dz) * W + c.x + dx] === T.WALL);
    if (!wall || inRect(ALCOVE, c)) return; // (au milieu du salon, rien à quoi l'accrocher ; le palier a les siennes)
    addLight((c.x + 0.5 + wall[0] * 0.42) * C, (c.z + 0.5 + wall[1] * 0.42) * C, { state: st, flicker: st === 'flicker', bright: st === 'on', sconce: { dx: wall[0], dz: wall[1] } });
  });
  // le palier des ascenseurs : une applique sur chaque mur de côté
  const az = (ALCOVE.z0 + 1.5) * C;
  addLight((ALCOVE.x0 + 0.08) * C, az, { state: 'on', bright: true, sconce: { dx: -1, dz: 0 } });
  addLight((ALCOVE.x1 + 0.92) * C, az, { state: 'on', bright: true, sconce: { dx: 1, dz: 0 } });
  for (const r of rooms) {
    const st = rnd() < 0.85 ? 'on' : 'flicker';
    addLight(r.desk.x, r.desk.z, { state: st, flicker: st === 'flicker', bright: st === 'on', y: 1.2, fy: 1.2, lamp: true });
    // un plafonnier caché au milieu de la chambre, plus doux
    addLight(((r.x0 + r.x1 + 1) / 2) * C, ((r.z0 + r.z1 + 1) / 2) * C, { state: 'on', bright: true, y: HOTEL_CEIL - 0.1, fy: HOTEL_CEIL - 0.1 });
  }
  // une applique au-dessus des boîtes aux lettres
  addLight(mailbox.x + 0.2, mbMid, { state: 'on', y: 2.5, fy: 2.5, bright: true, sconce: { dx: -1, dz: 0 } });
  addLight(X0 + 5, Z1 - 2.6, { state: 'on', bright: true, y: LOBBY_CEIL - 0.5, fy: LOBBY_CEIL - 0.5, chandelier: true });
  addLight(desk.x - 2.2, desk.z, { state: 'on', bright: true, y: LOBBY_CEIL - 0.5, fy: LOBBY_CEIL - 0.5, chandelier: true });
  for (const [ox, oz] of [[-1, -0.8], [1, -0.8], [0, 1.2]]) addLight(lobbyCenter.x + ox * C * 1.5, lobbyCenter.z + oz * C, { state: 'on', bright: true, y: LOBBY_CEIL - 0.5, fy: LOBBY_CEIL - 0.5, chandelier: true });

  // 9. Quelques piles et eaux d'amande, dans les chambres sans lettre et le couloir
  const busy = [cellPos(spawnCell.x, spawnCell.z), ...letters, ...furniture, ...lobbyProps, ...roomProps, ...hallProps, ...solids];
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
    level: 4, // HOTEL_LEVEL (le 3 est le Level 2, les Tuyauteries)
    name: 5,
    ceil: HOTEL_CEIL,
    lobbyCeil: LOBBY_CEIL,
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
    props: [...lobbyProps, ...roomProps, ...hallProps],
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
    lounge: LOUNGE,
    alcove: ALCOVE,
    // les deux ascenseurs du palier (hors service) : le milieu de leur porte, sur le mur du fond, face au sud
    lifts: [ALCOVE.x0 + 1, ALCOVE.x0 + 3].map((gx) => ({ x: gx * C, z: ALCOVE.z0 * C, rot: 0 })),
    corridorCells,
    furniture,
    solids,
    doorW: DOOR_W,
    spots,
    hides: spots, // les lits et armoires : les cachettes du moteur (comme les casiers des autres niveaux)
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
