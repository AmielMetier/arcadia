// Site Noir : le complexe. Une seule carte, décrite ici sur une grille de cases de 1 m (x vers l'est, z vers le sud).
// Rien ne se superpose en plan : le sous-sol est à l'est des ailes, à y = -4, et deux rampes y descendent.
// La carte ne dépend pas de la graine : seule la place des clés, des piles et des traces change d'une partie à l'autre.
// Aucun DOM : ce fichier sert aussi bien au moteur, aux bots, à la vue 3D qu'au plan affiché dans le jeu.

export const W = 76, H = 64;
export const T = { FLOOR: 0, WALL: 1, FENCE: 2, PROP: 3 };
export const Z = { NONE: 0, OUTPOST: 1, A: 2, B: 3, SOUS: 4, CABINE: 5, PAD: 6 };
export const ZONE_NAMES = ['', 'Avant-poste', 'Aile A · Bureaux', 'Aile B · Laboratoires', 'Sous-sol', 'Ascenseur', 'Zone d\'extraction'];
export const CEIL = 3;       // hauteur sous plafond
export const DEEP = -4;      // sol du sous-sol
export const DOOR_H = 2.4;

const idx = (x, z) => z * W + x;

export function buildMap() {
  const t = new Uint8Array(W * H).fill(T.WALL), zone = new Uint8Array(W * H), floor = new Float32Array(W * H);
  const doorAt = new Int16Array(W * H).fill(-1), lockerAt = new Int16Array(W * H).fill(-1);
  const M = { W, H, t, zone, floor, doorAt, lockerAt, doors: [], rooms: [], lockers: [], props: [], lights: [], ramps: [] };

  const carve = (x0, z0, x1, z1, zn, y = 0) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { t[idx(x, z)] = T.FLOOR; zone[idx(x, z)] = zn; floor[idx(x, z)] = y; } };
  const room = (name, x0, z0, x1, z1, zn, y = 0, opts = {}) => { carve(x0, z0, x1, z1, zn, y); M.rooms.push({ id: M.rooms.length, name, zone: zn, x0, z0, x1, z1, cx: (x0 + x1 + 1) / 2, cz: (z0 + z1 + 1) / 2, ...opts }); };
  // porte de deux cases, percée dans un mur ; `axis` : sens du battant (x : le battant court le long de x)
  const door = (x0, z0, x1, z1, opts = {}) => {
    const id = M.doors.length, axis = z0 === z1 ? 'x' : 'z', zn = opts.zone || Z.A, y = opts.y || 0;
    const cells = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const i = idx(x, z); t[i] = T.FLOOR; zone[i] = zn; floor[i] = y; doorAt[i] = id; cells.push(i); }
    M.doors.push({ id, cells, axis, x: (x0 + x1 + 1) / 2, z: (z0 + z1 + 1) / 2, y, zone: zn, key: opts.key || null, name: opts.name || 'Porte', kind: opts.kind || 'porte', startOpen: !!opts.open });
    return id;
  };
  // meuble : `w` × `d` cases solides autour de sa position (0 : décor sans collision)
  const prop = (m, x, z, rot = 0, opts = {}) => {
    const w = opts.w ?? 1, d = opts.d ?? 1, solid = w && d;
    // l'emprise tombe sur des cases entières : le meuble se centre dessus
    const x0 = Math.round(x - w / 2), z0 = Math.round(z - d / 2);
    if (solid) { x = x0 + w / 2; z = z0 + d / 2; }
    const y = opts.y ?? floor[idx(Math.floor(x), Math.floor(z))];
    M.props.push({ m, x, z, y: y + (opts.up || 0), rot: rot * Math.PI / 2, size: opts.size || 0 });
    if (solid) for (let cz = z0; cz < z0 + d; cz++) for (let cx = x0; cx < x0 + w; cx++) if (t[idx(cx, cz)] === T.FLOOR && doorAt[idx(cx, cz)] < 0) t[idx(cx, cz)] = T.PROP;
  };
  // casier contre un mur : on s'y cache depuis la case devant (fx, fz)
  const locker = (x, z, dir) => {
    const id = M.lockers.length, i = idx(x, z), [dx, dz] = [[0, 1], [1, 0], [0, -1], [-1, 0]][dir];
    t[i] = T.PROP; lockerAt[i] = id;
    M.lockers.push({ id, x: x + 0.5, z: z + 0.5, y: floor[i], fx: x + 0.5 + dx * 0.9, fz: z + 0.5 + dz * 0.9, dir, zone: zone[i] });
  };
  const light = (x, z, kind = 'urgence', opts = {}) => {
    const i = idx(Math.floor(x), Math.floor(z)), y = floor[i] + (opts.h ?? CEIL - 0.1);
    M.lights.push({ id: M.lights.length, x, z, y, zone: zone[i], kind, flick: opts.flick ?? 0.25, phase: M.lights.length * 1.7 });
  };

  // ------------------------------------------------------------------ dehors
  carve(4, 48, 47, 61, Z.OUTPOST);
  carve(49, 48, 72, 61, Z.PAD);
  for (let z = 47; z <= 62; z++) { t[idx(3, z)] = T.FENCE; t[idx(48, z)] = T.FENCE; t[idx(73, z)] = T.FENCE; }
  for (let x = 3; x <= 73; x++) t[idx(x, 62)] = T.FENCE;
  for (let x = 4; x <= 72; x++) if (x !== 48) t[idx(x, 47)] = T.WALL;
  M.rooms.push({ id: M.rooms.length, name: 'Avant-poste', zone: Z.OUTPOST, x0: 4, z0: 48, x1: 47, z1: 61, cx: 26, cz: 54 });
  M.rooms.push({ id: M.rooms.length, name: 'Zone d\'extraction', zone: Z.PAD, x0: 49, z0: 48, x1: 72, z1: 61, cx: 60, cz: 55 });

  // ------------------------------------------------------------------ Aile A : bureaux et accueil
  carve(6, 24, 43, 26, Z.A); carve(6, 35, 43, 37, Z.A); carve(6, 27, 8, 34, Z.A); carve(41, 27, 43, 34, Z.A);
  room('Bureau 1', 10, 28, 18, 33, Z.A);
  room('Bureau 2', 20, 28, 28, 33, Z.A);
  room('Archives', 30, 28, 39, 33, Z.A);
  room('Accueil', 16, 39, 30, 46, Z.A);
  room('Salle de pause', 6, 39, 14, 46, Z.A);
  room('Sécurité', 32, 39, 43, 46, Z.A);
  carve(22, 38, 24, 38, Z.A);
  door(22, 47, 23, 47, { name: 'Sas d\'entrée', kind: 'sas', zone: Z.A });
  door(13, 34, 14, 34, { name: 'Bureau 1' }); door(13, 27, 14, 27, { name: 'Bureau 1' });
  door(24, 34, 25, 34, { name: 'Bureau 2' }); door(19, 30, 19, 31, { name: 'Bureau 2' });
  door(34, 34, 35, 34, { name: 'Archives' }); door(34, 27, 35, 27, { name: 'Archives' });
  door(9, 38, 10, 38, { name: 'Salle de pause' }); door(15, 42, 15, 43, { name: 'Salle de pause' });
  door(36, 38, 37, 38, { name: 'Sécurité' }); door(31, 42, 31, 43, { name: 'Sécurité' });

  // ------------------------------------------------------------------ Aile B : laboratoires et dortoirs
  carve(6, 20, 43, 22, Z.B); carve(6, 2, 43, 4, Z.B); carve(6, 5, 8, 19, Z.B); carve(41, 5, 43, 19, Z.B);
  room('Labo Alpha', 10, 6, 18, 18, Z.B);
  room('Dortoir nord', 20, 6, 29, 11, Z.B);
  room('Dortoir sud', 20, 13, 29, 18, Z.B);
  room('Labo Bêta', 31, 6, 39, 18, Z.B);
  door(7, 23, 8, 23, { name: 'Sas Aile B', key: 'bleu', kind: 'sas', zone: Z.B });
  door(41, 23, 42, 23, { name: 'Sas Aile B', key: 'bleu', kind: 'sas', zone: Z.B });
  door(14, 19, 15, 19, { name: 'Labo Alpha', zone: Z.B }); door(14, 5, 15, 5, { name: 'Labo Alpha', zone: Z.B }); door(9, 12, 9, 13, { name: 'Labo Alpha', zone: Z.B });
  door(24, 5, 25, 5, { name: 'Dortoir nord', zone: Z.B }); door(24, 19, 25, 19, { name: 'Dortoir sud', zone: Z.B }); door(24, 12, 25, 12, { name: 'Dortoirs', zone: Z.B });
  door(35, 19, 36, 19, { name: 'Labo Bêta', zone: Z.B }); door(35, 5, 36, 5, { name: 'Labo Bêta', zone: Z.B }); door(40, 12, 40, 13, { name: 'Labo Bêta', zone: Z.B });

  // ------------------------------------------------------------------ Sous-sol : salle des machines, tunnel, palier de l'ascenseur
  const ramp = (z0, z1) => {
    carve(45, z0, 51, z1, Z.SOUS, 0);
    M.ramps.push({ x0: 45, x1: 52, z0, z1: z1 + 1 });
  };
  door(44, 12, 44, 13, { name: 'Salle des machines', key: 'orange', kind: 'sas', zone: Z.B });
  ramp(12, 13);
  door(44, 35, 44, 36, { name: 'Escalier de service', key: 'orange', kind: 'sas', zone: Z.A });
  ramp(35, 36);
  room('Salle des machines', 52, 6, 72, 21, Z.SOUS, DEEP);
  carve(60, 22, 62, 34, Z.SOUS, DEEP);
  M.rooms.push({ id: M.rooms.length, name: 'Tunnel', zone: Z.SOUS, x0: 60, z0: 22, x1: 62, z1: 34, cx: 61.5, cz: 28 });
  room('Palier de l\'ascenseur', 52, 35, 68, 42, Z.SOUS, DEEP);
  // la cabine : son sol suit l'ascenseur, ses deux portes s'ouvrent selon l'étage
  carve(58, 44, 61, 46, Z.CABINE, DEEP);
  M.liftBottom = door(59, 43, 60, 43, { name: 'Ascenseur', kind: 'lift', zone: Z.SOUS, y: DEEP });
  M.liftTop = door(59, 47, 60, 47, { name: 'Ascenseur', kind: 'lift', zone: Z.PAD });
  M.cabin = { x0: 58, z0: 44, x1: 62, z1: 47, cx: 60, cz: 45.5 };

  // ------------------------------------------------------------------ points d'intérêt
  M.spawns = {
    surv: [[20, 52], [24, 52], [20, 55], [24, 55], [22, 58]],
    monster: { x: 14.5, z: 12.5 },
  };
  M.generator = { x: 62, z: 9, panel: { x: 62, z: 11.2 } };
  M.liftCall = { x: 57.5, z: 42.5, y: DEEP };
  M.liftGo = { x: 61.5, z: 44.6 };
  M.monitor = { x: 32, z: 49.5, y: 0 };
  M.crates = [
    { k: 'photo', n: 3, x: 9.5, z: 49.5 }, { k: 'emf', n: 3, x: 12, z: 49.5 }, { k: 'cams', n: 3, x: 14.5, z: 49.5 },
    { k: 'tablet', n: 2, x: 17, z: 49.5 }, { k: 'pile', n: 4, x: 7, z: 49.5 },
  ];
  M.padCenter = { x: 59.5, z: 54 };
  // places possibles : la graine choisit
  M.spots = {
    pile: [[17, 41], [29, 44], [11, 44], [8, 41], [38, 41], [15, 31], [25, 29], [36, 32], [12, 16], [38, 15], [28, 7], [21, 14], [56, 19], [70, 8], [66, 40], [54, 37], [61, 28]],
    trace: [[26, 30, Z.A], [37, 31, Z.A], [11, 32, Z.A], [33, 45, Z.A], [12, 10, Z.B], [36, 16, Z.B], [27, 9, Z.B], [22, 16, Z.B], [30, 3, Z.B], [55, 9, Z.SOUS], [70, 19, Z.SOUS], [61, 24, Z.SOUS], [65, 37, Z.SOUS]],
  };
  // meubles à fouiller : le badge, la clé et les fusibles sont cachés dedans
  M.caches = [
    ['Bureau', 12, 30], ['Bureau', 16, 30], ['Classeur', 10.5, 33.5], ['Classeur', 17.5, 28.5], ['Bureau', 22, 32], ['Bureau', 26, 28.7], ['Classeur', 28.5, 33.5], ['Étagère', 32, 30], ['Étagère', 37, 32], ['Caisse', 39, 33.5], ['Classeur', 30.5, 28.5], ['Comptoir', 23.5, 42.5], ['Classeur', 16.5, 39.5], ['Table', 10, 42.5], ['Bureau', 37, 45.5],
    ['Paillasse', 13, 9], ['Paillasse', 13, 13], ['Paillasse', 13, 16], ['Bouteille', 17.5, 7], ['Lit', 21, 8], ['Lit', 28.5, 10.5], ['Lit', 21, 15], ['Lit', 28.5, 17.5], ['Paillasse', 33, 9], ['Paillasse', 37, 9], ['Paillasse', 33, 14.5], ['Paillasse', 37, 14.5], ['Étagère', 20.5, 2.5], ['Caisse', 40.5, 3.5],
    ['Étagère', 62, 17], ['Étagère', 66, 14], ['Fût', 58, 15], ['Caisse', 53, 13.5], ['Bouteille', 72, 13], ['Caisse', 53, 41], ['Étagère', 64, 35.5], ['Fût', 67.5, 41.5],
  ].map(([label, x, z], id) => ({ id, label, x, z, y: floor[idx(Math.floor(x), Math.floor(z))], zone: zone[idx(Math.floor(x), Math.floor(z))] }));

  // ------------------------------------------------------------------ meubles (cases solides)
  // accueil
  prop('desk', 23.5, 42.5, 0, { w: 4, d: 1, size: 3.6 }); prop('computer', 22.6, 42.5, 2, { w: 0, up: 0.82, size: 0.8 }); prop('chair', 23.5, 41.2, 0, { w: 0 });
  prop('couch', 18, 45, 2, { w: 2, d: 1 }); prop('couch', 29, 45, 2, { w: 2, d: 1 }); prop('filecabinet', 16.5, 39.5, 0); prop('vending', 29.5, 39.5, 0);
  // bureaux
  prop('desk', 12, 30, 0, { w: 2, d: 1 }); prop('computer', 12, 30, 2, { w: 0, up: 0.82, size: 0.8 }); prop('chair', 12, 31.2, 2, { w: 0 });
  prop('desk', 16, 30, 0, { w: 2, d: 1 }); prop('chair', 16, 31.2, 2, { w: 0 }); prop('filecabinet', 10.5, 33.5, 0); prop('filecabinet', 17.5, 28.5, 0);
  prop('desk', 22, 32, 2, { w: 2, d: 1 }); prop('computer', 22, 32, 0, { w: 0, up: 0.82, size: 0.8 }); prop('chair', 22, 30.8, 0, { w: 0 });
  prop('desk', 26, 28.7, 0, { w: 2, d: 1 }); prop('computer', 26, 28.7, 2, { w: 0, up: 0.82, size: 0.8 }); prop('chair', 26, 30, 2, { w: 0 }); prop('filecabinet', 28.5, 33.5, 0);
  // archives : des rangées qui cachent
  for (const z of [30, 32]) for (const x of [32, 37]) prop('shelftall', x, z, 0, { w: 3, d: 1 });
  prop('filecabinet', 30.5, 28.5, 0); prop('crate', 39, 33.2, 0);
  // salle de pause
  prop('foldtable', 10, 42.5, 1, { w: 2, d: 1 }); prop('chair', 8.7, 42.5, 1, { w: 0 }); prop('chair', 11.3, 42.5, 3, { w: 0 }); prop('vending', 6.5, 39.5, 0); prop('vending', 8, 39.5, 0); prop('couch', 12, 45.8, 2, { w: 2, d: 1 });
  // sécurité : les écrans, des casiers
  prop('desk', 37, 45.5, 2, { w: 4, d: 1, size: 3.6 }); prop('computer', 35.8, 45.5, 0, { w: 0, up: 0.82, size: 0.8 }); prop('computer', 38.2, 45.5, 0, { w: 0, up: 0.82, size: 0.8 }); prop('chair', 37, 44.2, 0, { w: 0 });
  locker(32, 39, 0); locker(33, 39, 0); locker(42, 39, 0); locker(43, 39, 0);
  // couloirs de l'aile A : quelques caisses pour casser la ligne droite
  prop('oildrum', 20.5, 24.5, 0, { size: 1 }); prop('crate', 39.5, 26.5, 0); prop('filecabinet', 6.5, 37.5, 0);
  // labo Alpha : paillasses (la cage du monstre au fond)
  for (const z of [9, 13, 16]) { prop('labdesk', 13, z, 0, { w: 3, d: 1, size: 2.8 }); }
  prop('labequip', 13, 13, 1, { w: 0, up: 1.05, size: 0.5 }); prop('labequip', 13, 9, 1, { w: 0, up: 1.05, size: 0.5 });
  locker(10, 6, 0); locker(11, 6, 0); locker(18, 18, 2); locker(17, 18, 2);
  prop('gastank', 17.5, 7, 0, { size: 1.1 });
  // dortoirs : lits et casiers
  for (const [x, z] of [[21, 8], [21, 10.5], [28.5, 8], [28.5, 10.5], [21, 15], [21, 17.5], [28.5, 15], [28.5, 17.5]]) prop('bunk', x, z, 1, { w: 2, d: 1, size: 1.9 });
  for (const x of [23, 26]) { locker(x, 6, 0); locker(x, 18, 2); }
  // labo Bêta
  for (const x of [33, 37]) { prop('labdesk', x, 9, 1, { w: 1, d: 3, size: 2.8 }); prop('labdesk', x, 14.5, 1, { w: 1, d: 3, size: 2.8 }); }
  prop('labequip', 33, 9, 0, { w: 0, up: 1.05, size: 0.5 }); prop('labequip', 37, 14.5, 0, { w: 0, up: 1.05, size: 0.5 }); locker(31, 18, 2); locker(32, 18, 2); locker(39, 6, 0); prop('gastank', 31.5, 6.5, 0, { size: 1.1 });
  // couloirs de l'aile B
  prop('storageshelf', 20.5, 2.5, 0, { w: 2, d: 1 }); prop('crate', 40.5, 3.5, 0); locker(6, 16, 1); locker(6, 17, 1); locker(43, 8, 3); locker(43, 9, 3); prop('oildrum', 33.5, 22.5, 0, { size: 1 });
  // salle des machines : le générateur, des cuves, des tuyaux
  prop('generator', 62, 9, 0, { w: 5, d: 2, size: 2.2 });
  for (const [x, z] of [[55, 9], [55, 18], [69, 9], [69, 18]]) { prop('watertank', x, z, 0, { w: 2, d: 5, size: 2.6 }); }
  for (const [x, z] of [[62, 17], [66, 14]]) prop('shelftall', x, z, 0, { w: 3, d: 1 });
  prop('oildrum', 58, 15, 0, { size: 1 }); prop('oildrum', 58, 16, 0, { size: 1 }); prop('crate', 53, 13.5, 0); prop('gastank', 72, 13, 0, { size: 1.1 });
  locker(52, 21, 2); locker(53, 21, 2); locker(72, 6, 0); locker(71, 6, 0);
  prop('pipes', 61, 28, 0, { w: 0, up: 2.3, size: 3 }); prop('pipes', 61, 24, 0, { w: 0, up: 2.3, size: 3 });
  // palier de l'ascenseur
  prop('crate', 53, 41, 0); prop('crate', 54.2, 41.5, 0); prop('oildrum', 67.5, 41.5, 0, { size: 1 }); prop('storageshelf', 64, 35.5, 0, { w: 2, d: 1 });
  locker(52, 37, 1); locker(52, 38, 1); locker(68, 37, 3); locker(68, 38, 3);
  // avant-poste : caisses de matériel, table des écrans, projecteurs
  for (const c of M.crates) prop('scificrate', c.x, c.z - 0.9, 0, { size: 0.9, w: 1, d: 1 });
  prop('foldtable', 32, 48.6, 0, { w: 4, d: 1, size: 3.6 }); prop('computer', 31, 48.6, 0, { w: 0, up: 0.75, size: 0.8 }); prop('computer', 33, 48.6, 0, { w: 0, up: 0.75, size: 0.8 });
  prop('crate', 44, 50, 0); prop('crate', 45.2, 50.4, 0); prop('oildrum', 46, 52, 0, { size: 1 }); prop('gastank', 6, 60, 0, { size: 1.1 }); prop('crate', 40, 60, 0);
  prop('spotlight', 12, 58, 2, { w: 0, size: 1.3 }); prop('spotlight', 34, 58, 2, { w: 0, size: 1.3 }); prop('spotlight', 60, 60, 2, { w: 0, size: 1.3 });

  // ------------------------------------------------------------------ lumières de secours
  for (const x of [12, 22, 32, 40]) light(x, 25.5, 'urgence'), light(x, 36.5, 'urgence');
  light(7.5, 31); light(42.5, 31);
  light(14, 31, 'urgence', { flick: 0.5 }); light(24, 31, 'urgence'); light(34.5, 31, 'urgence', { flick: 0.6 }); light(23.5, 44, 'neon', { flick: 0.1 }); light(10, 44, 'urgence'); light(37.5, 42);
  for (const x of [12, 26, 38]) { light(x, 21.5, 'rouge', { flick: 0.7 }); light(x, 3.5, 'rouge', { flick: 0.7 }); }
  light(7.5, 12, 'rouge', { flick: 0.7 }); light(42.5, 12, 'rouge', { flick: 0.7 });
  light(14.5, 11, 'rouge', { flick: 0.85 }); light(24.5, 9, 'rouge', { flick: 0.85 }); light(24.5, 16, 'rouge', { flick: 0.85 }); light(35.5, 12, 'rouge', { flick: 0.85 });
  light(48, 13, 'ambre', { flick: 0.4, h: -0.9 }); light(48, 36, 'ambre', { flick: 0.4, h: -0.9 });
  light(57, 12, 'ambre', { flick: 0.4 }); light(66, 12, 'ambre', { flick: 0.4 }); light(62, 18, 'ambre', { flick: 0.5 });
  light(61.5, 27, 'ambre', { flick: 0.75 }); light(57, 39, 'ambre', { flick: 0.5 }); light(65, 39, 'ambre', { flick: 0.5 });
  light(60, 45.5, 'neon', { flick: 0.2, h: 2.7 });
  for (const [x, z] of [[12, 58], [34, 58], [60, 60], [24, 49], [60, 49]]) light(x, z, 'projecteur', { flick: 0, h: 4.5 });

  M.zoneRooms = {}; for (const r of M.rooms) (M.zoneRooms[r.zone] ||= []).push(r);
  return M;
}

// ------------------------------------------------------------------ requêtes (pures)
export const cellOf = (x, z) => idx(Math.floor(x), Math.floor(z));
export const zoneAt = (M, x, z) => { const cx = Math.floor(x), cz = Math.floor(z); return cx < 0 || cz < 0 || cx >= W || cz >= H ? Z.NONE : M.zone[idx(cx, cz)]; };

// Hauteur du sol à une position : les rampes sont exactes, la cabine suit l'ascenseur (liftY)
export function floorAt(M, x, z, liftY = DEEP) {
  for (const r of M.ramps) if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return DEEP * (x - r.x0) / (r.x1 - r.x0);
  const c = M.cabin;
  if (x >= c.x0 && x < c.x1 && z >= c.z0 && z < c.z1) return liftY;
  const cx = Math.floor(x), cz = Math.floor(z);
  return cx < 0 || cz < 0 || cx >= W || cz >= H ? 0 : M.floor[idx(cx, cz)];
}

// La case arrête-t-elle la vue ? (murs et portes fermées, pas les grillages ni les meubles)
export function blocksSight(M, doors, i) {
  if (M.t[i] === T.WALL) return true;
  const d = M.doorAt[i];
  return d >= 0 && doors && !doors[d].open;
}

// Ligne de vue sur la grille (DDA), sans tenir compte de la hauteur
export function hasLOS(M, doors, x0, z0, x1, z1) {
  let cx = Math.floor(x0), cz = Math.floor(z0);
  const ex = Math.floor(x1), ez = Math.floor(z1);
  const dx = x1 - x0, dz = z1 - z0, sx = Math.sign(dx), sz = Math.sign(dz);
  const tdx = dx ? Math.abs(1 / dx) : Infinity, tdz = dz ? Math.abs(1 / dz) : Infinity;
  let tx = dx ? ((sx > 0 ? cx + 1 - x0 : x0 - cx) * tdx) : Infinity, tz = dz ? ((sz > 0 ? cz + 1 - z0 : z0 - cz) * tdz) : Infinity;
  for (let n = 0; n < 200; n++) {
    if (cx === ex && cz === ez) return true;
    if (tx < tz) { tx += tdx; cx += sx; } else { tz += tdz; cz += sz; }
    if (cx < 0 || cz < 0 || cx >= W || cz >= H) return false;
    if (cx === ex && cz === ez) return true;
    if (blocksSight(M, doors, idx(cx, cz))) return false;
  }
  return false;
}

// ------------------------------------------------------------------ recherche de chemin (A* sur les cases)
export class Nav {
  constructor(M) { this.M = M; const n = W * H; this.g = new Float32Array(n); this.from = new Int32Array(n); this.stamp = new Uint32Array(n); this.run = 0; this.heap = []; }
  // pass(i) : la case est-elle franchissable ? cost(i) : surcoût éventuel
  find(x0, z0, x1, z1, pass, cost) {
    const start = cellOf(x0, z0), goal = cellOf(x1, z1), { g, from, stamp, heap } = this;
    if (!pass(goal)) return null;
    this.run++; heap.length = 0;
    const run = this.run, ex = goal % W, ez = (goal / W) | 0;
    g[start] = 0; from[start] = -1; stamp[start] = run;
    const push = (i, f) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    push(start, 0);
    const dirs = [1, -1, W, -W];
    while (heap.length) {
      const [, i] = pop();
      if (i === goal) break;
      const gi = g[i], x = i % W;
      for (const d of dirs) {
        const j = i + d;
        if (j < 0 || j >= W * H || (d === 1 && x === W - 1) || (d === -1 && x === 0) || !pass(j)) continue;
        const ng = gi + 1 + (cost ? cost(j) : 0);
        if (stamp[j] === run && g[j] <= ng) continue;
        stamp[j] = run; g[j] = ng; from[j] = i;
        push(j, ng + Math.abs((j % W) - ex) + Math.abs(((j / W) | 0) - ez));
      }
    }
    if (stamp[goal] !== run) return null;
    const path = [];
    for (let i = goal; i !== -1; i = from[i]) path.push(i);
    path.reverse();
    return path;
  }
}
