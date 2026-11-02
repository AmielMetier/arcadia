// Mystère Mystère : le manoir. Trois niveaux sur la même grille de cases de 1 m (x vers l'est, z vers le sud) :
// la cave (y = -4), le rez-de-chaussée (y = 0) et l'étage (y = 4). Un escalier appartient à deux niveaux à la fois :
// ses cases sont des rampes, et on n'y entre que par le bas ou par le haut (par le côté, la marche est trop haute).
// Les passages secrets (bibliothèque pivotante, armoire) sont des murs qu'on ouvre avec E ; ils se referment seuls.
// Aucun DOM : ce fichier sert au moteur, aux bots, à la vue 3D et au plan.

export const W = 46, H = 36;
export const LEVELS = [-1, 0, 1];
export const LV_Y = [-4, 0, 4];        // altitude du sol de chaque niveau (indice = niveau + 1)
export const STORY = 4;                // hauteur d'un étage
export const CEIL = 3.9;               // sous le plafond
export const DOOR_H = 2.7;             // haut des portes
export const T = { VOID: 0, FLOOR: 1, WALL: 2, PROP: 3, STAIR: 4, PASS: 5 };
export const STEP = 0.75;              // marche la plus haute qu'on peut monter d'une case à l'autre

export const li = (lv) => lv + 1;
export const idx = (x, z) => z * W + x;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

// style de chaque pièce : sol, papier peint, boiserie (la vue 3D en tire ses matières)
export const STYLES = {
  hall: { floor: 'damier', wall: 'damas-rouge', panel: 'acajou' },
  salle: { floor: 'parquet', wall: 'damas-vert', panel: 'chene' },
  cuisine: { floor: 'carreaux', wall: 'faience', panel: 'blanc' },
  service: { floor: 'carreaux', wall: 'creme', panel: 'chene' },
  biblio: { floor: 'parquet-sombre', wall: 'damas-bleu', panel: 'acajou' },
  salon: { floor: 'tapis-rouge', wall: 'rayures-or', panel: 'acajou' },
  billard: { floor: 'parquet-sombre', wall: 'damas-vert', panel: 'acajou' },
  vestibule: { floor: 'damier', wall: 'creme', panel: 'chene' },
  musique: { floor: 'parquet', wall: 'rayures-rose', panel: 'blanc' },
  serre: { floor: 'tomettes', wall: 'serre', panel: 'blanc' },
  chambre: { floor: 'tapis-bleu', wall: 'fleurs', panel: 'chene' },
  maitre: { floor: 'tapis-rouge', wall: 'damas-violet', panel: 'acajou' },
  bain: { floor: 'carreaux', wall: 'faience', panel: 'blanc' },
  bureau: { floor: 'parquet-sombre', wall: 'damas-bleu', panel: 'acajou' },
  enfant: { floor: 'tapis-vert', wall: 'rayures-bleu', panel: 'blanc' },
  galerie: { floor: 'parquet', wall: 'damas-rouge', panel: 'acajou' },
  trophees: { floor: 'parquet-sombre', wall: 'damas-vert', panel: 'acajou' },
  cave: { floor: 'pierre', wall: 'pierre', panel: 'pierre' },
  passage: { floor: 'pierre', wall: 'brique', panel: 'brique' },
};

export function buildMap() {
  const n = W * H;
  const M = {
    W, H,
    t: LEVELS.map(() => new Uint8Array(n).fill(T.WALL)),
    room: LEVELS.map(() => new Int16Array(n).fill(-1)),
    stairAt: LEVELS.map(() => new Int16Array(n).fill(-1)),
    passAt: LEVELS.map(() => new Int16Array(n).fill(-1)),
    tall: LEVELS.map(() => new Uint8Array(n)),      // meuble haut : cache la vue
    rooms: [], stairs: [], passages: [], doors: [], props: [], lights: [], spawns: [], windows: [], holes: [],
  };
  const set = (lv, x, z, t, r = -1) => { const L = li(lv), i = idx(x, z); M.t[L][i] = t; if (r >= 0) M.room[L][i] = r; };
  const room = (lv, name, style, x0, z0, x1, z1, opts = {}) => {
    const id = M.rooms.length;
    M.rooms.push({ id, lv, name, style, x0, z0, x1, z1, cx: (x0 + x1 + 1) / 2, cz: (z0 + z1 + 1) / 2, ...opts });
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(lv, x, z, T.FLOOR, id);
    return id;
  };
  // ouverture dans un mur : les cases prennent la pièce voisine (la première trouvée)
  const door = (lv, x0, z0, x1, z1, opts = {}) => {
    const L = li(lv);
    let r = -1;
    for (let z = z0; z <= z1 && r < 0; z++) for (let x = x0; x <= x1 && r < 0; x++)
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const q = M.room[L][idx(x + dx, z + dz)]; if (q >= 0 && M.t[L][idx(x + dx, z + dz)] === T.FLOOR) { r = q; break; } }
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(lv, x, z, T.FLOOR, r);
    M.doors.push({ lv, x0, z0, x1, z1, arch: !!opts.arch });
  };
  const fill = (lv, x0, z0, x1, z1, t) => { for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(lv, x, z, t); };
  // escalier : `axis` sens de la montée, `top` côté du palier haut ('min' ou 'max' de l'axe)
  const stair = (x0, z0, x1, z1, axis, top, lo, hi, name) => {
    const id = M.stairs.length;
    const st = { id, x0, z0, x1, z1, axis, top, lo, hi, name, yLo: LV_Y[li(lo)], yHi: LV_Y[li(hi)] };
    M.stairs.push(st);
    for (const lv of [lo, hi]) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const L = li(lv), i = idx(x, z); M.t[L][i] = T.STAIR; M.stairAt[L][i] = id; }
    return st;
  };
  // passage secret : des cases de mur qui s'ouvrent
  const passage = (lv, x0, z0, x1, z1, name, kind) => {
    const id = M.passages.length, L = li(lv), cells = [];
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const i = idx(x, z); M.t[L][i] = T.PASS; M.passAt[L][i] = id; cells.push(i); }
    const axis = x0 === x1 ? 'z' : 'x'; // le panneau court le long de cet axe
    M.passages.push({ id, lv, cells, x0, z0, x1, z1, x: (x0 + x1 + 1) / 2, z: (z0 + z1 + 1) / 2, y: LV_Y[L], axis, name, kind });
  };
  // meuble : `w` × `d` cases solides centrées sur (x, z) ; w = 0 : pas de collision
  const prop = (lv, m, x, z, rot = 0, opts = {}) => {
    const L = li(lv), w = opts.w ?? 0, d = opts.d ?? 0;
    if (w && d) {
      const x0 = Math.round(x - w / 2), z0 = Math.round(z - d / 2);
      for (let cz = z0; cz < z0 + d; cz++) for (let cx = x0; cx < x0 + w; cx++) { const i = idx(cx, cz); if (M.t[L][i] === T.FLOOR) { M.t[L][i] = T.PROP; if (opts.tall) M.tall[L][i] = 1; } }
    }
    M.props.push({ m, lv, x, z, y: LV_Y[L] + (opts.up || 0), rot: rot * Math.PI / 2, h: opts.h, s: opts.s, tint: opts.tint, wall: !!opts.wall });
  };
  const light = (lv, x, z, kind = 'lustre', opts = {}) => M.lights.push({ id: M.lights.length, lv, x, z, y: LV_Y[li(lv)] + (opts.h ?? CEIL - 0.05), kind, power: opts.power ?? 1, color: opts.color ?? 0xffd9a0, room: -1 });

  // ================================================================== rez-de-chaussée (y = 0)
  const R = {};
  R.cuisine = room(0, 'Cuisine', 'cuisine', 1, 1, 11, 9);
  R.salle = room(0, 'Salle à manger', 'salle', 13, 1, 28, 9);
  R.biblio = room(0, 'Bibliothèque', 'biblio', 30, 1, 44, 7);
  for (let z = 8; z <= 12; z++) for (let x = 30; x <= 39; x++) set(0, x, z, T.FLOOR, R.biblio);
  M.rooms[R.biblio].z1 = 12;
  R.service = room(0, 'Couloir de service', 'service', 1, 11, 11, 13);
  R.hall = room(0, 'Grand Hall', 'hall', 13, 11, 28, 24, { tall: true });
  R.salon = room(0, 'Salon', 'salon', 1, 15, 11, 26);
  R.billard = room(0, 'Salle de billard', 'billard', 30, 14, 40, 24);
  R.vestibule = room(0, 'Vestibule', 'vestibule', 16, 26, 25, 33);
  R.musique = room(0, 'Salon de musique', 'musique', 1, 28, 14, 34);
  R.serre = room(0, 'Jardin d\'hiver', 'serre', 27, 26, 44, 34, { glass: true });
  // recoin caché derrière la bibliothèque pivotante
  R.recoin = room(0, 'Recoin secret', 'passage', 41, 9, 41, 11, { secret: true });

  door(0, 12, 4, 12, 5);            // cuisine ↔ salle à manger
  door(0, 29, 4, 29, 5);            // salle à manger ↔ bibliothèque
  door(0, 5, 10, 6, 10);            // cuisine ↔ couloir de service
  door(0, 19, 10, 22, 10, { arch: true }); // salle à manger ↔ hall
  door(0, 12, 11, 12, 12);          // couloir ↔ hall
  door(0, 10, 14, 11, 14);          // couloir ↔ salon
  door(0, 12, 23, 12, 24);          // salon ↔ hall
  door(0, 34, 13, 35, 13);          // bibliothèque ↔ billard
  door(0, 29, 23, 29, 24);          // billard ↔ hall
  door(0, 19, 25, 22, 25, { arch: true }); // hall ↔ vestibule
  door(0, 5, 27, 6, 27);            // salon ↔ musique
  door(0, 15, 30, 15, 31);          // musique ↔ vestibule
  door(0, 26, 30, 26, 31);          // vestibule ↔ jardin d'hiver
  door(0, 34, 25, 35, 25);          // billard ↔ jardin d'hiver
  passage(0, 40, 10, 40, 11, 'la bibliothèque pivotante', 'bookcase');

  // ================================================================== étage (y = 4)
  R.amis = room(1, 'Chambre d\'amis', 'chambre', 1, 1, 11, 9);
  R.maitre = room(1, 'Chambre du maître', 'maitre', 13, 1, 28, 9);
  R.bain = room(1, 'Salle de bain', 'bain', 30, 1, 36, 9);
  R.bureau = room(1, 'Bureau', 'bureau', 38, 1, 44, 9);
  R.ouest = room(1, 'Couloir ouest', 'service', 1, 11, 11, 13);
  R.galerie = room(1, 'Galerie', 'galerie', 13, 11, 28, 24);
  R.est = room(1, 'Couloir est', 'galerie', 30, 11, 44, 13);
  R.enfant = room(1, 'Chambre d\'enfant', 'enfant', 1, 15, 11, 24);
  R.trophees = room(1, 'Salle des trophées', 'trophees', 30, 15, 44, 24);
  // la galerie entoure le vide au-dessus du hall
  fill(1, 15, 15, 26, 24, T.VOID);
  fill(1, 13, 23, 14, 24, T.VOID); fill(1, 27, 23, 28, 24, T.VOID);
  M.holes.push({ lv: 1, x0: 15, z0: 15, x1: 26, z1: 24 });
  door(1, 5, 10, 6, 10);            // chambre d'amis ↔ couloir
  door(1, 20, 10, 21, 10);          // chambre du maître ↔ galerie
  door(1, 33, 10, 34, 10);          // salle de bain ↔ couloir est
  door(1, 41, 10, 42, 10);          // bureau ↔ couloir est
  door(1, 12, 11, 12, 12);          // couloir ouest ↔ galerie
  door(1, 29, 12, 29, 13);          // galerie ↔ couloir est
  door(1, 10, 14, 11, 14);          // couloir ouest ↔ chambre d'enfant
  door(1, 36, 14, 37, 14);          // couloir est ↔ trophées
  passage(1, 29, 4, 29, 5, 'l\'armoire de la chambre', 'wardrobe');
  passage(1, 37, 6, 37, 7, 'le miroir', 'mirror');

  // ================================================================== cave (y = -4)
  R.vin = room(-1, 'Cave à vin', 'cave', 1, 10, 11, 20);
  R.crypte = room(-1, 'Crypte', 'cave', 15, 11, 26, 17);
  R.tunnel = room(-1, 'Souterrain', 'passage', 12, 18, 35, 20);
  R.coffres = room(-1, 'Salle des coffres', 'cave', 36, 17, 44, 24);
  // la cave de la cuisine continue sous l'escalier
  for (let z = 9; z <= 16; z++) set(-1, 42, z, T.FLOOR, R.coffres), set(-1, 43, z, T.FLOOR, R.coffres);

  // ================================================================== escaliers
  stair(13, 15, 14, 22, 'z', 'min', 0, 1, 'Grand escalier ouest');
  stair(27, 15, 28, 22, 'z', 'min', 0, 1, 'Grand escalier est');
  stair(2, 12, 9, 13, 'x', 'min', 0, 1, 'Escalier de service');
  stair(1, 2, 2, 9, 'z', 'min', -1, 0, 'Escalier de la cave');
  stair(42, 9, 43, 16, 'z', 'min', -1, 0, 'Escalier dérobé');
  // sous les escaliers qui descendent, le rez-de-chaussée est plein
  fill(0, 1, 12, 1, 13, T.WALL); // sous le haut de l'escalier de service
  for (let z = 13; z <= 16; z++) for (let x = 41; x <= 44; x++) if (M.t[1][idx(x, z)] !== T.STAIR) set(0, x, z, T.WALL);
  for (let z = 17; z <= 24; z++) for (let x = 41; x <= 44; x++) set(0, x, z, T.WALL);

  // ================================================================== mobilier
  // cuisine
  prop(0, 'kitchenStove', 6, 1.5, 0, { w: 2, d: 1, h: 0.95 });
  prop(0, 'kitchenCabinet', 4, 1.5, 0, { w: 1, d: 1, h: 0.95 }); prop(0, 'kitchenCabinet', 8, 1.5, 0, { w: 1, d: 1, h: 0.95 });
  prop(0, 'kitchenSink', 10, 1.5, 0, { w: 2, d: 1, h: 0.95 });
  prop(0, 'kitchenCabinetUpper', 4, 1.25, 0, { h: 0.7, up: 1.7 }); prop(0, 'kitchenCabinetUpper', 8, 1.25, 0, { h: 0.7, up: 1.7 });
  prop(0, 'k-table-medium-long', 7, 6, 0, { w: 4, d: 2, h: 0.8 });
  prop(0, 'k-chair-a-wood', 5.5, 7.7, 2, { h: 0.95 }); prop(0, 'k-chair-a-wood', 8.5, 7.7, 2, { h: 0.95 });
  prop(0, 'k-chair-a-wood', 5.5, 4.3, 0, { h: 0.95 }); prop(0, 'k-chair-a-wood', 8.5, 4.3, 0, { h: 0.95 });
  prop(0, 'k-shelf-b-large-decorated', 11.3, 8, 1, { w: 1, d: 2, h: 2, tall: true });
  prop(0, 'trashcan', 3.5, 9.4, 0, { h: 0.6 });
  // salle à manger
  prop(0, 'tableCrossCloth', 20.5, 5, 1, { w: 8, d: 2, h: 0.82, s: [8, 2] });
  for (const x of [17.5, 19.5, 21.5, 23.5]) { prop(0, 'chairCushion', x, 3.4, 0, { h: 1 }); prop(0, 'chairCushion', x, 6.6, 2, { h: 1 }); }
  prop(0, 'chairCushion', 15.6, 5, 1, { h: 1 }); prop(0, 'chairCushion', 25.4, 5, 3, { h: 1 });
  prop(0, 'k-cabinet-medium-decorated', 14, 1.4, 0, { w: 2, d: 1, h: 1.4 });
  prop(0, 'k-cabinet-medium-decorated', 27.5, 1.4, 0, { w: 2, d: 1, h: 1.4 });
  prop(0, 'pottedPlant', 13.6, 8.5, 0, { h: 1.3 }); prop(0, 'pottedPlant', 28.4, 8.5, 0, { h: 1.3 });
  // bibliothèque : rayonnages le long des murs et en épis
  for (const x of [31, 33, 35, 37]) prop(0, 'bookcaseClosedWide', x + 0.5, 1.45, 0, { w: 2, d: 1, h: 2.6, tall: true });
  for (const x of [32.5, 36.5]) { prop(0, 'bookcaseOpen', x, 5.5, 0, { w: 2, d: 1, h: 2.2, tall: true }); }
  prop(0, 'k-armchair', 31.6, 10.5, 1, { h: 1.1 }); prop(0, 'lampRoundFloor', 31.2, 12.2, 0, { h: 1.7 });
  prop(0, 'desk', 41.5, 3, 3, { w: 2, d: 3, h: 0.8 }); prop(0, 'chairDesk', 40, 3, 1, { h: 1.1 });
  prop(0, 'k-book-set', 41.5, 3.6, 0, { h: 0.25, up: 0.8 });
  prop(0, 'globe', 38, 9, 0, { w: 1, d: 1, h: 1.2 });
  // couloir de service
  prop(0, 'coatRackStanding', 1.5, 13.4, 0, { h: 1.9 });
  // grand hall
  prop(0, 'rugRectangle', 20.5, 18, 1, { h: 0.02, s: [7, 5] });
  prop(0, 'grandfather', 16, 11.5, 0, { w: 1, d: 1, h: 2.4, tall: true });
  prop(0, 'statue', 25, 11.6, 0, { w: 1, d: 1, h: 2.1 });
  prop(0, 'pottedPlant', 15.4, 24.3, 0, { h: 1.4 }); prop(0, 'pottedPlant', 26.6, 24.3, 0, { h: 1.4 });
  prop(0, 'benchCushion', 20.5, 12, 0, { w: 3, d: 1, h: 0.6, s: [3, 1] });
  // salon : cheminée, canapés
  prop(0, 'fireplace', 1.5, 20.5, 1, { w: 1, d: 3, h: 2.2 });
  prop(0, 'loungeSofaLong', 6, 18, 0, { w: 3, d: 1, h: 0.9, s: [3, 1.1] });
  prop(0, 'loungeSofaLong', 6, 23, 2, { w: 3, d: 1, h: 0.9, s: [3, 1.1] });
  prop(0, 'tableCoffee', 6, 20.5, 0, { w: 2, d: 1, h: 0.45 });
  prop(0, 'k-armchair-pillows', 9.6, 20.5, 3, { h: 1.1 });
  prop(0, 'rugRound', 6, 20.5, 0, { h: 0.02, s: [5, 5] });
  prop(0, 'k-lamp-standing', 10.6, 16, 0, { h: 1.8 }); prop(0, 'k-lamp-standing', 10.6, 25.5, 0, { h: 1.8 });
  prop(0, 'bookcaseClosedDoors', 4, 26.4, 2, { w: 2, d: 1, h: 2.2, tall: true });
  // billard
  prop(0, 'billard', 35, 19, 1, { w: 4, d: 2, h: 0.85 });
  prop(0, 'stoolBar', 31, 15.5, 0, { h: 0.8 }); prop(0, 'stoolBar', 32, 15.5, 0, { h: 0.8 });
  prop(0, 'k-cabinet-small-decorated', 39.6, 17, 3, { w: 1, d: 1, h: 1 });
  prop(0, 'loungeChair', 31, 23, 0, { h: 1 }); prop(0, 'loungeChair', 39, 23, 0, { h: 1 });
  prop(0, 'cueRack', 30.4, 19, 1, { h: 1.7 });
  // vestibule
  prop(0, 'rugRectangle', 20.5, 30, 0, { h: 0.02, s: [4, 6] });
  prop(0, 'coatRackStanding', 16.6, 32.6, 0, { h: 1.9 }); prop(0, 'coatRackStanding', 24.4, 32.6, 0, { h: 1.9 });
  prop(0, 'sideTableDrawers', 16.5, 27, 1, { w: 1, d: 1, h: 0.85 }); prop(0, 'sideTableDrawers', 24.5, 27, 3, { w: 1, d: 1, h: 0.85 });
  prop(0, 'frontdoor', 20.5, 33.9, 0, { h: 3 });
  // salon de musique
  prop(0, 'piano', 4, 31, 0, { w: 3, d: 2, h: 1.1 });
  prop(0, 'stoolBar', 4, 32.8, 0, { h: 0.55 });
  prop(0, 'k-chair-b-wood', 9, 31, 0, { h: 1 }); prop(0, 'k-chair-b-wood', 11, 31, 0, { h: 1 }); prop(0, 'k-chair-b-wood', 9, 33, 0, { h: 1 }); prop(0, 'k-chair-b-wood', 11, 33, 0, { h: 1 });
  prop(0, 'harp', 13.6, 28.6, 0, { w: 1, d: 1, h: 1.8 });
  prop(0, 'radio', 1.5, 34.4, 0, { h: 0.6 });
  // jardin d'hiver
  for (const [x, z] of [[28, 27], [33, 27], [38, 27], [43, 27], [28, 33.5], [43, 33.5], [36, 33.5]]) prop(0, 'pottedPlant', x, z, 0, { w: 1, d: 1, h: 1.6 });
  prop(0, 'fountain', 35.5, 30.5, 0, { w: 3, d: 3, h: 1.3 });
  prop(0, 'bench', 30, 30.5, 1, { w: 1, d: 2, h: 0.55 }); prop(0, 'bench', 41, 30.5, 3, { w: 1, d: 2, h: 0.55 });
  prop(0, 'plantSmall1', 31, 33.5, 0, { h: 0.6 }); prop(0, 'plantSmall2', 40, 27.3, 0, { h: 0.6 });

  prop(0, 'k-rug-oval-a', 10, 32, 0, { h: 0.02, s: [3.4, 3] });
  prop(0, 'lampRoundTable', 16.5, 27, 0, { h: 0.5, up: 0.85 }); prop(0, 'lampRoundTable', 24.5, 27, 0, { h: 0.5, up: 0.85 });
  prop(0, 'k-rug-rectangle-stripes-a', 35, 19, 1, { h: 0.02, s: [6, 3.6] });
  prop(0, 'sideTable', 11.4, 18.5, 1, { w: 1, d: 1, h: 0.6 });
  // étage
  prop(1, 'bedDouble', 4, 4, 0, { w: 3, d: 3, h: 1.1, s: [2.6, 3] }); prop(1, 'cabinetBedDrawerTable', 1.6, 2, 0, { h: 0.6 }); prop(1, 'cabinetBedDrawerTable', 6.4, 2, 0, { h: 0.6 });
  prop(1, 'k-shelf-b-large-decorated', 10.5, 1.4, 0, { w: 2, d: 1, h: 2.1, tall: true });
  prop(1, 'rugRounded', 5, 7, 0, { h: 0.02, s: [3, 2] }); prop(1, 'k-armchair', 9.5, 7.5, 3, { h: 1.1 }); prop(1, 'sideTable', 9.6, 6.1, 0, { h: 0.6 });
  prop(1, 'bedDouble', 20.5, 3, 0, { w: 4, d: 3, h: 1.3, s: [3.4, 3.4] });
  prop(1, 'cabinetBedDrawerTable', 17.6, 1.6, 0, { h: 0.65 }); prop(1, 'cabinetBedDrawerTable', 23.4, 1.6, 0, { h: 0.65 });
  prop(1, 'k-couch-pillows', 15, 7.5, 1, { w: 1, d: 3, h: 1 }); prop(1, 'rugRectangle', 20.5, 7.5, 0, { h: 0.02, s: [5, 2.5] });
  prop(1, 'k-lamp-table', 17.6, 1.6, 0, { h: 0.4, up: 0.65 });
  prop(1, 'bathtub', 32, 2.5, 0, { w: 3, d: 2, h: 0.8 }); prop(1, 'toilet', 35.5, 1.6, 0, { h: 0.85 }); prop(1, 'bathroomSink', 31, 8.4, 2, { h: 1 });
  prop(1, 'bathroomMirror', 36.9, 6.5, 3, { h: 1.1, up: 1.1, wall: true });
  prop(1, 'desk', 41.5, 3, 0, { w: 3, d: 1, h: 0.8 }); prop(1, 'chairDesk', 41.5, 4.3, 2, { h: 1.1 }); prop(1, 'bookcaseClosedWide', 43.5, 7.5, 3, { w: 1, d: 2, h: 2.4, tall: true });
  prop(1, 'k-book-set', 40.8, 2.8, 0, { h: 0.22, up: 0.8 }); prop(1, 'k-shelf-a-big', 38.6, 8.4, 1, { w: 1, d: 1, h: 1.9, tall: true });
  prop(1, 'bedSingle', 3, 17.5, 0, { w: 2, d: 3, h: 0.9 }); prop(1, 'bedSingle', 3, 22, 0, { w: 2, d: 3, h: 0.9 });
  prop(1, 'bear', 8, 18, 0, { h: 0.7 }); prop(1, 'rugRound', 7, 20, 0, { h: 0.02, s: [3.5, 3.5] }); prop(1, 'cardboardBoxOpen', 10.4, 23.5, 0, { h: 0.6 });
  prop(1, 'rockinghorse', 9, 22, 1, { h: 1 }); prop(1, 'k-table-small', 6.5, 23.6, 0, { h: 0.5 }); prop(1, 'k-rug-oval-b', 20.5, 7.6, 0, { h: 0.02, s: [3, 2] });
  prop(1, 'k-pictureframe-standing-a', 33, 15.6, 0, { h: 1.6 });
  prop(1, 'armor', 31, 24, 0, { w: 1, d: 1, h: 2.1 }); prop(1, 'armor', 43, 24, 0, { w: 1, d: 1, h: 2.1 });
  prop(1, 'k-cabinet-medium-decorated', 41, 15.5, 0, { w: 2, d: 1, h: 1.4 });
  prop(1, 'tableRound', 37, 20, 0, { w: 2, d: 2, h: 0.8 }); prop(1, 'chairCushion', 35.3, 20, 1, { h: 1 }); prop(1, 'chairCushion', 38.7, 20, 3, { h: 1 });
  prop(1, 'loungeSofa', 43.2, 19.5, 3, { w: 1, d: 2, h: 0.9 });
  prop(1, 'benchCushion', 20.5, 11.5, 0, { w: 3, d: 1, h: 0.6, s: [3, 1] });
  prop(1, 'pottedPlant', 30.5, 11.5, 0, { h: 1.3 }); prop(1, 'pottedPlant', 44, 11.5, 0, { h: 1.3 });
  prop(1, 'k-lamp-standing', 1.5, 11.5, 0, { h: 1.8 });

  // cave
  for (const z of [11, 14, 17]) prop(-1, 'barrels', 10.5, z + 0.5, 1, { w: 1, d: 2, h: 1.2 });
  for (const x of [4, 7]) prop(-1, 'winerack', x + 0.5, 19.6, 0, { w: 2, d: 1, h: 2.2, tall: true });
  prop(-1, 'barrels', 4.5, 13, 0, { w: 2, d: 1, h: 1.2 });
  prop(-1, 'coffin', 20.5, 14, 1, { w: 2, d: 1, h: 0.8 });
  prop(-1, 'candles', 18, 12, 0, { h: 1.1 }); prop(-1, 'candles', 23, 12, 0, { h: 1.1 });
  for (const [x, z] of [[17, 15], [24, 15]]) prop(-1, 'pillar', x, z, 0, { w: 1, d: 1, h: 4 });
  prop(-1, 'chest', 39, 23.3, 0, { w: 2, d: 1, h: 0.9 }); prop(-1, 'chest', 44, 20, 3, { w: 1, d: 1, h: 0.9 });
  prop(-1, 'cardboardBoxClosed', 37, 17.6, 0, { h: 0.6 }); prop(-1, 'cardboardBoxClosed', 37.2, 18.4, 1, { h: 0.5 });
  prop(-1, 'safe', 44, 23, 3, { w: 1, d: 1, h: 1.3 });

  // ================================================================== lumières (lustres, appliques, bougies)
  light(0, 6.5, 5, 'lustre'); light(0, 20.5, 5, 'lustre'); light(0, 35, 4.5, 'lustre'); light(0, 35, 10.5, 'applique', { h: 2.3, power: 0.7 });
  light(0, 6, 12, 'applique', { h: 2.3, power: 0.6 }); light(0, 20.5, 17, 'grand', { h: 7.4, power: 2.2 }); light(0, 6, 20.5, 'lustre');
  light(0, 2.4, 20.5, 'feu', { h: 0.6, power: 1.1, color: 0xff7a2a }); light(0, 35, 19, 'billard', { h: 2.7, power: 1.1 });
  light(0, 20.5, 29.5, 'lustre'); light(0, 7.5, 31, 'lustre'); light(0, 35.5, 30.5, 'lustre', { power: 1.2, color: 0xfff2d8 });
  light(1, 6, 5, 'lustre'); light(1, 20.5, 5, 'lustre'); light(1, 33, 5, 'lustre', { color: 0xfff2d8 }); light(1, 41, 5, 'lustre');
  light(1, 6, 12, 'applique', { h: 2.3, power: 0.6 }); light(1, 20.5, 12.5, 'applique', { h: 2.4, power: 0.7 }); light(1, 37, 12, 'applique', { h: 2.3, power: 0.6 });
  light(1, 6, 19.5, 'lustre'); light(1, 37, 19.5, 'lustre');
  light(-1, 6, 15, 'bougie', { h: 2.2, power: 0.8, color: 0xffa050 }); light(-1, 20.5, 13, 'bougie', { h: 1.4, power: 0.8, color: 0xffa050 });
  light(-1, 24, 19, 'torche', { h: 2.2, power: 0.6, color: 0xff8a3a }); light(-1, 40, 21, 'bougie', { h: 2.2, power: 0.8, color: 0xffa050 });
  light(-1, 1.5, 6, 'torche', { h: 2.2, power: 0.5, color: 0xff8a3a }); light(-1, 42.5, 12, 'torche', { h: 2.2, power: 0.5, color: 0xff8a3a });
  for (const l of M.lights) l.room = roomAt(M, l.lv, l.x, l.z);

  // fenêtres (décor) : sur les murs extérieurs du rez-de-chaussée et de l'étage
  for (const lv of [0, 1]) {
    for (let x = 3; x < W - 2; x += 3) M.windows.push({ lv, x: x + 0.5, z: 0.5, side: 'n' });
    for (let z = 3; z < (lv === 1 ? 25 : H - 2); z += 3) { M.windows.push({ lv, x: 0.5, z: z + 0.5, side: 'w' }); M.windows.push({ lv, x: W - 0.5, z: z + 0.5, side: 'e' }); }
    if (lv === 0) for (let x = 3; x < W - 2; x += 3) M.windows.push({ lv, x: x + 0.5, z: H - 0.5, side: 's' });
    else for (let x = 2; x < W - 2; x += 3) if (x < 13 || x > 28) M.windows.push({ lv, x: x + 0.5, z: 25.5, side: 's' });
  }
  M.windows = M.windows.filter((w) => M.t[li(w.lv)][idx(Math.floor(w.x), Math.floor(w.z))] === T.WALL && neighborsFloor(M, w.lv, Math.floor(w.x), Math.floor(w.z)));

  // départ : en cercle dans le hall
  for (let k = 0; k < 12; k++) {
    const a = (k / 12) * Math.PI * 2;
    M.spawns.push({ lv: 0, x: 20.5 + Math.cos(a) * 3.2, z: 18.5 + Math.sin(a) * 3.2, yaw: Math.atan2(Math.cos(a), Math.sin(a)) });
  }
  M.R = R;
  M.walk = walkCells(M);
  return M;
}

function neighborsFloor(M, lv, x, z) {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const t = cellT(M, lv, x + dx, z + dz); if (t === T.FLOOR || t === T.PROP) return true; }
  return false;
}
// cases libres (pour les pièces d'or, les bots qui errent) : sol nu, hors escaliers et recoins secrets
function walkCells(M) {
  const out = [];
  for (const lv of LEVELS) {
    const L = li(lv);
    for (let i = 0; i < W * H; i++) if (M.t[L][i] === T.FLOOR) { const r = M.rooms[M.room[L][i]]; if (r && !r.secret) out.push({ lv, i, x: (i % W) + 0.5, z: Math.floor(i / W) + 0.5, room: r.id }); }
  }
  return out;
}

// ------------------------------------------------------------------ requêtes
export function cellT(M, lv, cx, cz) {
  if (cx < 0 || cz < 0 || cx >= W || cz >= H || lv < -1 || lv > 1) return T.WALL;
  return M.t[li(lv)][cz * W + cx];
}
export function roomAt(M, lv, x, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= W || cz >= H) return -1;
  return M.room[li(lv)][cz * W + cx];
}
export function roomName(M, lv, x, z) { const r = roomAt(M, lv, x, z); return r >= 0 ? M.rooms[r].name : ''; }
// hauteur d'une rampe d'escalier au point (x, z)
export function stairY(st, x, z) {
  const along = st.axis === 'z' ? z : x, a0 = st.axis === 'z' ? st.z0 : st.x0, a1 = (st.axis === 'z' ? st.z1 : st.x1) + 1;
  let k = clamp((along - a0) / (a1 - a0), 0, 1);
  if (st.top === 'min') k = 1 - k;
  return st.yLo + (st.yHi - st.yLo) * k;
}
// hauteur du sol sous (x, z) pour quelqu'un du niveau lv
export function groundAt(M, lv, x, z) {
  const cx = Math.floor(x), cz = Math.floor(z), L = li(lv);
  if (cx >= 0 && cz >= 0 && cx < W && cz < H) { const s = M.stairAt[L][cz * W + cx]; if (s >= 0) return stairY(M.stairs[s], x, z); }
  return LV_Y[L];
}
// sur une rampe, on appartient au niveau dont on est le plus près
export function levelFor(M, lv, x, z, y) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= W || cz >= H) return lv;
  const s = M.stairAt[li(lv)][cz * W + cx];
  if (s < 0) return lv;
  const st = M.stairs[s];
  return y > (st.yLo + st.yHi) / 2 ? st.hi : st.lo;
}
// la case bloque-t-elle quelqu'un qui marche au niveau lv, les pieds à y ?
export function blocks(M, w, lv, cx, cz, y) {
  const t = cellT(M, lv, cx, cz);
  if (t === T.FLOOR) return false;
  if (t === T.STAIR) { const st = M.stairs[M.stairAt[li(lv)][cz * W + cx]]; return Math.abs(stairY(st, cx + 0.5, cz + 0.5) - y) > STEP + 0.3; }
  if (t === T.PASS) return !(w && w.pass && w.pass[M.passAt[li(lv)][cz * W + cx]] > 0);
  return true;
}
// rampe : on vérifie la hauteur au point exact (les bords de l'escalier forment une rampe continue)
export function blocksAt(M, w, lv, x, z, y) {
  const cx = Math.floor(x), cz = Math.floor(z), t = cellT(M, lv, cx, cz);
  if (t === T.STAIR) { const st = M.stairs[M.stairAt[li(lv)][cz * W + cx]]; return Math.abs(stairY(st, x, z) - y) > STEP; }
  return blocks(M, w, lv, cx, cz, y);
}
// la case cache-t-elle la vue ?
export function blocksSight(M, w, lv, cx, cz) {
  const t = cellT(M, lv, cx, cz);
  if (t === T.WALL) return true;
  if (t === T.PASS) return !(w && w.pass && w.pass[M.passAt[li(lv)][cz * W + cx]] > 0);
  if (t === T.PROP) return M.tall[li(lv)][cz * W + cx] === 1;
  return false;
}
// ligne de vue au sol d'un même niveau (DDA sur la grille)
export function hasLOS(M, w, lv, x0, z0, x1, z1) {
  let cx = Math.floor(x0), cz = Math.floor(z0);
  const ex = Math.floor(x1), ez = Math.floor(z1), dx = x1 - x0, dz = z1 - z0;
  const sx = dx > 0 ? 1 : -1, sz = dz > 0 ? 1 : -1;
  const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tx = dx !== 0 ? (sx > 0 ? cx + 1 - x0 : x0 - cx) * tdx : Infinity, tz = dz !== 0 ? (sz > 0 ? cz + 1 - z0 : z0 - cz) * tdz : Infinity;
  for (let k = 0; k < 120; k++) {
    if (cx === ex && cz === ez) return true;
    if (tx < tz) { tx += tdx; cx += sx; } else { tz += tdz; cz += sz; }
    if (cx === ex && cz === ez) return true;
    if (blocksSight(M, w, lv, cx, cz)) return false;
  }
  return false;
}
// le volume (x, y, z) est-il plein ? Sert aux balles et aux couteaux lancés, d'un niveau à l'autre.
export function solidAt(M, w, x, y, z) {
  const cx = Math.floor(x), cz = Math.floor(z);
  if (cx < 0 || cz < 0 || cx >= W || cz >= H) return true;
  if (y < LV_Y[0] || y > LV_Y[2] + CEIL) return true;
  const lv = y >= LV_Y[2] - 0.12 ? 1 : y >= LV_Y[1] - 0.12 ? 0 : -1, L = li(lv), base = LV_Y[L], i = cz * W + cx;
  const t = M.t[L][i];
  // dalle entre deux niveaux : pleine sauf au-dessus d'un vide ou d'un escalier
  if (y < base && lv > -1) return !(t === T.VOID || t === T.STAIR);
  if (y > base + CEIL && lv < 1) { const tu = M.t[L + 1][i]; return !(tu === T.VOID || tu === T.STAIR); }
  switch (t) {
    case T.VOID: return false;
    case T.FLOOR: return false;
    case T.WALL: return true;
    case T.PASS: return !(w && w.pass && w.pass[M.passAt[L][i]] > 0);
    case T.PROP: return M.tall[L][i] === 1 ? y < base + 2.2 : y < base + 0.9;
    case T.STAIR: { const st = M.stairs[M.stairAt[L][i]]; return y < stairY(st, x, z) - 0.05; }
  }
  return true;
}
// premier obstacle sur un segment : distance (ou maxD si rien)
export function rayWorld(M, w, x, y, z, dx, dy, dz, maxD, step = 0.08) {
  for (let d = step; d < maxD; d += step) if (solidAt(M, w, x + dx * d, y + dy * d, z + dz * d)) return d;
  return maxD;
}
