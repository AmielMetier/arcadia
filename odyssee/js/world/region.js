// odyssee/js/world/region.js — la région d'Odyssée : 10 villes, 10 routes, 2 grottes, 8 arènes et la Ligue.
// Les noms de lieux et de personnages sont originaux ; les Pokémon ne sont que des remplaçants du prototype.
import { T } from './tiles.js';
import { GameMap, carveRoute, carveTown, ledges, along, nearestWalkable, rng } from './mapgen.js';
import { centerInterior, martInterior, houseInterior, labInterior, gymInterior, leagueInterior, caveMap } from './interiors.js';

export const STARTERS = [152, 155, 158];
export const RIVAL_NAME = 'Théo';
export const BADGES = [
  { name: 'Badge Élytre', type: 'bug', color: '#8cc43c' }, { name: 'Badge Granit', type: 'rock', color: '#b89c6c' },
  { name: 'Badge Écume', type: 'water', color: '#4a9ae8' }, { name: 'Badge Volt', type: 'electric', color: '#f0d030' },
  { name: 'Badge Pétale', type: 'grass', color: '#58c060' }, { name: 'Badge Mirage', type: 'psychic', color: '#e070c0' },
  { name: 'Badge Braise', type: 'fire', color: '#f07030' }, { name: 'Badge Écaille', type: 'dragon', color: '#7a68e0' },
];
const STOCK = {
  1: ['poke-ball', 'potion', 'antidote', 'paralyze-heal', 'awakening', 'repel'],
  2: ['poke-ball', 'potion', 'super-potion', 'antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal', 'repel', 'escape-rope'],
  3: ['poke-ball', 'great-ball', 'potion', 'super-potion', 'antidote', 'paralyze-heal', 'awakening', 'burn-heal', 'ice-heal', 'repel', 'super-repel', 'escape-rope'],
  4: ['poke-ball', 'great-ball', 'super-potion', 'hyper-potion', 'full-heal', 'revive', 'super-repel', 'escape-rope', 'thunder-stone', 'moon-stone'],
  5: ['great-ball', 'super-potion', 'hyper-potion', 'full-heal', 'revive', 'super-repel', 'escape-rope', 'leaf-stone', 'fire-stone', 'water-stone', 'sun-stone', 'ether'],
  6: ['great-ball', 'ultra-ball', 'hyper-potion', 'max-potion', 'full-heal', 'revive', 'max-repel', 'escape-rope', 'ether', 'elixir'],
  7: ['ultra-ball', 'hyper-potion', 'max-potion', 'full-restore', 'full-heal', 'revive', 'max-repel', 'escape-rope', 'elixir'],
};

/* ---------------- rencontres sauvages ---------------- */
const ENC = {
  r1: [[16, 2, 4, 35], [19, 2, 4, 35], [161, 2, 4, 15], [163, 2, 4, 10], [10, 3, 4, 5]],
  r2: [[16, 4, 7, 25], [19, 4, 6, 20], [10, 4, 6, 15], [13, 4, 6, 15], [21, 5, 7, 15], [29, 5, 6, 5], [32, 5, 6, 5]],
  bois: [[10, 6, 8, 15], [11, 7, 9, 5], [13, 6, 8, 15], [14, 7, 9, 5], [165, 6, 9, 15], [167, 6, 9, 15], [46, 7, 9, 10], [25, 7, 9, 5], [43, 6, 9, 10], [191, 6, 8, 5]],
  r3: [[21, 8, 11, 20], [23, 8, 11, 15], [27, 8, 11, 15], [39, 9, 11, 10], [56, 8, 11, 15], [19, 9, 11, 10], [206, 9, 11, 5], [66, 9, 11, 10]],
  grotte: [[41, 9, 13, 40], [74, 9, 13, 25], [46, 10, 12, 10], [35, 10, 12, 8], [50, 9, 12, 10], [95, 12, 14, 2], [194, 10, 12, 5]],
  r4: [[54, 13, 17, 15], [60, 13, 16, 10], [98, 13, 17, 15], [72, 13, 16, 10], [84, 14, 17, 10], [52, 13, 16, 10], [133, 14, 15, 3], [179, 13, 16, 12], [183, 13, 16, 15]],
  r5: [[100, 16, 20, 10], [81, 16, 20, 10], [25, 17, 19, 5], [179, 16, 19, 10], [180, 19, 21, 5], [77, 17, 21, 12], [58, 17, 20, 10], [20, 18, 21, 13], [22, 18, 21, 10], [37, 17, 19, 5], [209, 16, 19, 10]],
  r6: [[43, 21, 23, 10], [44, 23, 25, 5], [69, 21, 23, 10], [70, 23, 25, 5], [187, 21, 23, 12], [188, 23, 25, 5], [114, 22, 25, 8], [102, 21, 24, 10], [48, 21, 24, 10], [204, 21, 24, 10], [191, 21, 23, 10], [123, 24, 26, 3], [127, 24, 26, 2]],
  r7: [[63, 26, 29, 10], [96, 26, 30, 15], [177, 26, 29, 12], [203, 27, 30, 10], [109, 26, 30, 10], [77, 27, 30, 10], [218, 27, 30, 10], [228, 26, 29, 10], [37, 27, 30, 8], [216, 26, 29, 5]],
  r8: [[99, 30, 34, 15], [120, 30, 33, 10], [116, 30, 33, 10], [90, 30, 33, 10], [72, 30, 34, 15], [73, 32, 35, 5], [55, 31, 34, 10], [184, 31, 34, 10], [226, 32, 35, 5], [211, 30, 34, 10]],
  r9: [[67, 34, 38, 20], [75, 34, 38, 20], [42, 34, 37, 20], [217, 34, 38, 15], [232, 35, 38, 10], [105, 34, 37, 15]],
  victoire: [[67, 36, 42, 15], [75, 36, 42, 15], [95, 37, 41, 10], [208, 39, 42, 3], [42, 36, 40, 15], [105, 36, 40, 10], [217, 37, 41, 10], [112, 38, 42, 5], [147, 36, 38, 8], [148, 39, 41, 3], [246, 36, 39, 4], [232, 37, 40, 2]],
  r10: [[22, 33, 37, 15], [85, 33, 37, 10], [128, 34, 37, 10], [241, 34, 37, 10], [203, 33, 37, 10], [210, 33, 36, 10], [20, 33, 36, 10], [53, 33, 37, 10], [234, 34, 37, 10], [113, 34, 36, 2], [143, 36, 38, 3]],
};

/* ---------------- dresseurs ---------------- */
// classe → apparence sur la carte et en combat
const CLS = {
  Gamin: ['youngster', 'youngster', 16], Fillette: ['lass', 'lass', 16], Montagnard: ['hiker', 'hiker', 24], Marin: ['sailor', 'sailor', 24],
  'Topdresseur': ['red', 'calem', 40], 'Topdresseuse': ['cooltrainer_f', 'serena', 40], Scientifique: ['clerk', 'sycamore', 30], Pêcheur: ['sailor', 'sailor', 20],
  Insectomane: ['youngster', 'youngster', 16], Randonneuse: ['lass', 'lass', 20], Médium: ['nurse', 'agatha-gen3', 30], Karatéka: ['hiker', 'hiker', 28],
};
const LEADERS = [
  { name: 'Hector', type: 'bug', ow: 'youngster', bs: 'calem', team: [[14, 11], [167, 12], [166, 14]], intro: 'Les insectes ne crient pas : ils observent. Et toi, que vois-tu dans ce combat ?', lose: 'Tu as l\'œil vif ! Le Badge Élytre est à toi.' },
  { name: 'Basalte', type: 'rock', ow: 'hiker', bs: 'brock', team: [[74, 17], [111, 18], [95, 20]], intro: 'La pierre ne plie pas. Voyons si ta volonté est aussi solide !', lose: 'Tu as fendu le roc... Prends le Badge Granit, tu l\'as mérité.' },
  { name: 'Marine', type: 'water', ow: 'lass', bs: 'misty', team: [[120, 23], [183, 24], [55, 25], [121, 27]], intro: 'La marée monte ! Tu vas te faire emporter par mes Pokémon Eau !', lose: 'Ouah, tu as tenu face à la vague. Voici le Badge Écume !' },
  { name: 'Volta', type: 'electric', ow: 'cooltrainer_f', bs: 'korrina', team: [[82, 29], [101, 30], [180, 30], [181, 32]], intro: 'Ça grésille ! Prépare-toi à recevoir le choc de ta vie !', lose: 'Court-circuit total ! Tu remportes le Badge Volt.' },
  { name: 'Flora', type: 'grass', ow: 'lass', bs: 'serena', team: [[70, 33], [114, 34], [189, 34], [45, 36]], intro: 'Mes fleurs sont belles, mais elles savent piquer. Prêt ?', lose: 'Tu as fait éclore quelque chose de beau. Le Badge Pétale te revient.' },
  { name: 'Sibylle', type: 'psychic', ow: 'cooltrainer_f', bs: 'agatha-gen3', team: [[122, 38], [178, 38], [203, 39], [65, 41]], intro: 'J\'ai déjà vu l\'issue de ce combat... mais montre-moi quand même.', lose: 'L\'avenir m\'a trompée. Le Badge Mirage est à toi.' },
  { name: 'Pyros', type: 'fire', ow: 'prof', bs: 'red', team: [[78, 42], [126, 43], [229, 43], [59, 45]], intro: 'Le volcan gronde et mon cœur aussi ! Brûle avec moi !', lose: 'Quelle flamme ! Le Badge Braise te va bien.' },
  { name: 'Drakon', type: 'dragon', ow: 'clerk', bs: 'lance', team: [[148, 46], [148, 47], [230, 48], [149, 50]], intro: 'Les dragons ne s\'inclinent que devant la vraie force. En as-tu ?', lose: 'Les dragons te reconnaissent. Prends le Badge Écaille, le dernier.' },
];
export { LEADERS };
const CHAMPION = { name: 'Célestine', ow: 'cooltrainer_f', bs: 'cynthia', team: [[94, 52], [131, 52], [242, 51], [130, 54], [248, 55]], intro: 'Huit badges... Tu as parcouru toute la région pour arriver jusqu\'ici. Alors montre-moi tout ce que tu as appris !', lose: 'Magnifique. Tu es le nouveau Maître de la Ligue Céleste !' };

let tCount = 0;
function trainerNpc(map, x, y, dir, cls, name, team, o = {}) {
  const [ow, bs, prize] = CLS[cls] || ['youngster', 'youngster', 20];
  return map.npc({
    id: o.id || `${map.id}:t${tCount++}`, x, y, dir, sprite: o.ow || ow, move: 'static',
    trainer: { cls, name, team, prize: o.prize || prize, sight: o.sight ?? 4, bs: o.bs || bs, ai: o.ai || 'normal', items: o.items, intro: o.intro || 'Nos regards se sont croisés : c\'est l\'heure du combat !', lose: o.lose || 'J\'ai perdu...', after: o.after || 'Tu es vraiment fort !' },
  });
}
/** dresseur posé le long d'une route : t sur la ligne, côté ±1, distance au sentier */
function routeTrainer(map, pts, t, side, off, cls, name, team, o = {}) {
  const p = along(pts, t);
  const [x, y] = nearestWalkable(map, p.x + 0.5 + p.nx * side * off, p.y + 0.5 + p.ny * side * off);
  // regarde vers le sentier
  const vx = -p.nx * side, vy = -p.ny * side;
  const dir = o.dir || (Math.abs(vx) > Math.abs(vy) ? (vx > 0 ? 'right' : 'left') : (vy > 0 ? 'down' : 'up'));
  return trainerNpc(map, x, y, dir, cls, name, team, o);
}
function routeItem(map, pts, t, side, off, item, qty = 1) {
  const p = along(pts, t);
  const [x, y] = nearestWalkable(map, p.x + 0.5 + p.nx * side * off, p.y + 0.5 + p.ny * side * off);
  map.item(x, y, item, qty);
}

/* ---------------- villes ---------------- */
function buildTown(W, maps, def) {
  const ox = def.x, oy = def.y, P = (x, y) => [ox + x, oy + y];
  carveTown(W, { x: ox, y: oy, w: def.w, h: def.h, exits: def.exits, ground: def.ground });
  for (const [x0, y0, x1, y1, t] of def.roads || []) W.rect(ox + x0, oy + y0, ox + x1, oy + y1, t ?? T.PAVE);
  for (const d of def.deco || []) {
    const [k, ...a] = d;
    if (k === 'flowers') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], T.FLOWER, [T.GRASS, T.ASH, T.PAVE]);
    else if (k === 'fence') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], T.FENCE);
    else if (k === 'water') W.blob(ox + a[0], oy + a[1], a[2], a[3], T.WATER, rng(ox * 31 + oy), [T.GRASS, T.FLOWER, T.ASH, T.SAND]);
    else if (k === 'waterRect') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], T.WATER);
    else if (k === 'sand') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], T.SAND);
    else if (k === 'bridge') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], T.BRIDGE);
    else if (k === 'trees') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], a[4] ?? T.TREE);
    else if (k === 'tall') W.rect(ox + a[0], oy + a[1], ox + a[2], oy + a[3], T.TALL, [T.GRASS]);
    else if (k === 'rock') W.set(ox + a[0], oy + a[1], T.ROCK);
    else if (k === 'sign') W.sign(ox + a[0], oy + a[1], a[2]);
    else W.prop(k, ox + a[0], oy + a[1]);
  }
  for (const b of def.buildings) {
    const B = W.building(b.kind, ox + b.x, oy + b.y, { roof: b.roof, style: b.style, label: b.label });
    const id = `${def.id}:${b.id || b.kind + b.x}`;
    let inside;
    if (b.kind === 'center') inside = centerInterior(id, 'Centre Pokémon');
    else if (b.kind === 'mart') inside = martInterior(id, 'Boutique', STOCK[def.stock || 1]);
    else if (b.kind === 'gym') inside = gymInterior(id, LEADERS[def.gym].type, 'Arène de ' + def.name);
    else if (b.kind === 'lab') inside = labInterior(id);
    else if (b.kind === 'league') inside = leagueInterior(id);
    else inside = houseInterior(id, b.name || 'Maison', { w: b.kind === 'bighouse' || b.kind === 'tower' ? 11 : 9, h: b.kind === 'bighouse' || b.kind === 'tower' ? 9 : 8, bed: b.bed, extraBooks: b.kind === 'tower' });
    inside.townId = def.id; inside.outside = { map: 'monde', x: B.doorX, y: B.doorY + 1, dir: 'down' };
    inside.warp(inside.exitX, inside.exitY, inside.outside);
    if (inside.get(inside.exitX - 1, inside.exitY) === T.MAT) inside.warp(inside.exitX - 1, inside.exitY, inside.outside);
    W.warp(B.doorX, B.doorY, { map: id, x: inside.exitX, y: inside.exitY, dir: 'up' });
    for (const n of b.npcs || []) inside.npc({ id: `${id}:${n.id || n.x + '-' + n.y}`, ...n });
    if (b.setup) b.setup(inside);
    // chemin depuis la porte jusqu'à la route la plus proche
    for (let y = B.doorY + 1; y < B.doorY + 8; y++) { const t = W.get(B.doorX, y); if (t === T.PAVE || t === T.PATH) break; if (t === T.TREE || t === T.BUILD || t === T.WATER) break; W.set(B.doorX, y, T.PATH); }
    maps[id] = inside;
    if (b.kind === 'center') def.centerId = id, def.centerDoor = [B.doorX, B.doorY + 1];
    if (b.kind === 'gym') def.gymMap = inside;
  }
  for (const n of def.npcs || []) {
    const gate = n.gate ? { ...n.gate, tiles: n.gate.tiles.map(([x, y]) => [ox + x, oy + y]) } : undefined;
    const npc = W.npc({ ...n, gate, id: `${def.id}:${n.id || n.x + '-' + n.y}`, x: ox + n.x, y: oy + n.y });
    if (gate) W.gates.push({ npc: npc.id, ...gate });
  }
  W.zone(ox, oy, ox + def.w - 1, oy + def.h - 1, { name: def.name, music: def.music || 'town', town: def.id, theme: def.theme });
}

/* ======================================================================
   Construction de la région
   ====================================================================== */
export function buildWorld() {
  tCount = 0;
  const W = new GameMap('monde', 340, 280, { outdoor: true, fill: T.TREE, name: 'Odyssée' });
  const maps = { monde: W };
  const towns = {};

  // mers : nord, côte du Port-Azur, est, sud-est
  W.rect(150, 0, 339, 19, T.WATER);
  W.rect(222, 20, 272, 35, T.WATER);
  W.rect(322, 0, 339, 279, T.WATER);
  W.rect(185, 196, 339, 279, T.WATER);
  W.rect(282, 188, 302, 222, T.TREE);   // isthme de la route 7
  W.rect(266, 219, 309, 252, T.TREE);   // île de Cendrelune
  W.rect(226, 230, 238, 246, T.TREE);   // îlot du Pont des Marées

  /* ---------- A · Bourg-Aube ---------- */
  const A = towns.A = {
    id: 'aube', name: 'Bourg-Aube', x: 20, y: 238, w: 30, h: 22, exits: [['n', 14], ['e', 10]],
    roads: [[14, 2, 15, 18, T.PATH], [4, 10, 29, 11, T.PATH], [14, 18, 20, 19, T.PATH]],
    deco: [['flowers', 9, 3, 11, 5], ['flowers', 25, 13, 26, 17], ['water', 6, 15, 3.2, 2.2], ['fence', 2, 8, 4, 8], ['fence', 24, 8, 27, 8],
      ['sign', 12, 8, 'BOURG-AUBE\nLà où chaque aventure commence.'], ['sign', 16, 17, 'LABORATOIRE POKéMON\nProf. Saule'], ['lamp', 13, 9], ['lamp', 16, 9], ['mailbox', 8, 6], ['mailbox', 19, 6]],
    buildings: [
      { kind: 'house', x: 4, y: 4, roof: 'red', id: 'maison', name: 'Maison', bed: true, npcs: [{ id: 'maman', x: 5, y: 4, sprite: 'lass', dir: 'down', script: 'mom' }] },
      { kind: 'house', x: 20, y: 4, roof: 'blue', id: 'rival', name: 'Maison de Théo', npcs: [{ x: 3, y: 4, sprite: 'cooltrainer_f', dir: 'right', text: ['Théo est parti au labo dès l\'aube.', 'Il ne tient pas en place, celui-là !'] }] },
      { kind: 'lab', x: 17, y: 13, id: 'labo' },
    ],
    npcs: [
      { id: 'fille', x: 11, y: 13, sprite: 'lass', move: 'wander', text: ['Les Pokémon sauvages vivent dans les hautes herbes.', 'Sans Pokémon, il ne faut surtout pas y aller !'] },
      { id: 'vieux', x: 24, y: 7, sprite: 'hiker', move: 'turn', text: ['Tu sais courir ? Garde la touche Maj enfoncée en marchant.', 'Ça fait gagner un temps fou sur les longues routes !'] },
      { id: 'garde10', x: 28, y: 10, sprite: 'sailor', dir: 'left', gate: { badges: 7, tiles: [[28, 10], [28, 11]] }, text: ['La route 10 longe des falaises instables.', 'Reviens quand tu auras 7 badges.'] },
    ],
  };
  buildTown(W, maps, A);
  W.zone(34 - 1, 238, 36, 240, { name: 'Bourg-Aube', music: 'town', trigger: 'needStarter' });

  /* ---------- B · Sylvebourg (Insecte) ---------- */
  const B = towns.B = {
    id: 'sylve', name: 'Sylvebourg', x: 18, y: 138, w: 34, h: 24, exits: [['s', 16], ['n', 16]], gym: 0, stock: 1,
    roads: [[16, 0, 17, 23, T.PATH], [4, 11, 29, 12], [4, 19, 25, 20]],
    deco: [['flowers', 11, 4, 14, 7], ['flowers', 19, 4, 21, 7], ['lamp', 14, 10], ['lamp', 19, 10], ['lamp', 14, 13], ['lamp', 19, 13],
      ['sign', 14, 9, 'SYLVEBOURG\nLa ville où murmurent les feuilles.'], ['sign', 20, 18, 'ARÈNE DE SYLVEBOURG\nChampion : Hector\nL\'observateur des insectes.'],
      ['trees', 28, 15, 30, 18], ['trees', 2, 14, 3, 16], ['tall', 28, 2, 31, 5]],
    buildings: [
      { kind: 'center', x: 5, y: 7 }, { kind: 'mart', x: 23, y: 7 }, { kind: 'gym', x: 21, y: 14, roof: 'green' },
      { kind: 'house', x: 5, y: 15, roof: 'green', npcs: [{ x: 4, y: 4, sprite: 'youngster', text: ['Hector, le Champion, adore les Pokémon Insecte.', 'Le Feu et le Vol les mettent en difficulté !'] }] },
      { kind: 'house', x: 10, y: 15, roof: 'brown', npcs: [{ x: 2, y: 4, sprite: 'lass', text: ['Un Pokémon endormi ou paralysé est bien plus facile à capturer.', 'Et plus ses PV sont bas, mieux c\'est !'] }] },
    ],
    npcs: [
      { id: 'gamin', x: 9, y: 13, sprite: 'youngster', move: 'wander', text: ['Le Centre Pokémon soigne tes Pokémon gratuitement.', 'C\'est le bâtiment au toit rouge !'] },
      { id: 'garde', x: 16, y: 3, sprite: 'sailor', dir: 'down', gate: { badges: 1, tiles: [[16, 2], [17, 2]] }, text: ['Le Bois Murmure est plein de dresseurs coriaces.', 'Reviens quand tu auras le badge de l\'Arène !'] },
    ],
  };
  buildTown(W, maps, B);

  /* ---------- C · Pierrefort (Roche) ---------- */
  const C = towns.C = {
    id: 'pierre', name: 'Pierrefort', x: 90, y: 30, w: 32, h: 24, exits: [['s', 15], ['e', 10]], gym: 1, stock: 2,
    roads: [[15, 10, 16, 23], [4, 10, 31, 11], [4, 18, 27, 19]],
    deco: [['rock', 27, 14], ['rock', 28, 16], ['rock', 26, 21], ['rock', 3, 21], ['lamp', 14, 12], ['lamp', 17, 12], ['trees', 26, 3, 29, 6, T.PINE],
      ['sign', 13, 12, 'PIERREFORT\nUne ville taillée dans la montagne.'], ['sign', 26, 8, 'ARÈNE DE PIERREFORT\nChampion : Basalte\nLe roc inébranlable.'], ['flowers', 18, 21, 24, 21]],
    buildings: [
      { kind: 'center', x: 4, y: 4 }, { kind: 'mart', x: 10, y: 5 }, { kind: 'gym', x: 19, y: 3, roof: 'brown' },
      { kind: 'house', x: 4, y: 14, roof: 'gray', npcs: [{ x: 4, y: 4, sprite: 'hiker', text: ['Les Pokémon Roche résistent aux attaques Normal et Feu.', 'Mais l\'Eau et la Plante les font fondre !'] }] },
      { kind: 'house', x: 9, y: 14, roof: 'brown', npcs: [{ x: 3, y: 4, sprite: 'lass', text: ['À l\'est, la route 3 mène à la Grotte Lunaire.', 'Il y fait sombre... et les Nosferapti adorent s\'y cacher.'] }] },
      { kind: 'house2', x: 20, y: 14, roof: 'red', npcs: [{ x: 2, y: 4, sprite: 'prof', text: ['Ton Pokémon peut évoluer en gagnant des niveaux.', 'Certains ont besoin d\'une pierre spéciale, vendue en boutique.'] }] },
    ],
    npcs: [
      { id: 'montagnard', x: 20, y: 12, sprite: 'hiker', move: 'wander', text: ['Il paraît qu\'un Onix vit au fond de la Grotte Lunaire.', 'Il est rare, mais quelle carrure !'] },
      { id: 'garde', x: 28, y: 9, sprite: 'sailor', dir: 'down', gate: { badges: 2, tiles: [[29, 10], [29, 11]] }, text: ['La Grotte Lunaire est dangereuse.', 'Seuls les dresseurs avec deux badges peuvent passer.'] },
    ],
  };
  buildTown(W, maps, C);

  /* ---------- D · Port-Azur (Eau) ---------- */
  const D = towns.D = {
    id: 'azur', name: 'Port-Azur', x: 185, y: 22, w: 34, h: 26, exits: [['w', 11], ['e', 19]], gym: 2, stock: 3, music: 'port',
    roads: [[2, 11, 31, 12], [2, 19, 33, 20], [15, 7, 16, 20], [30, 11, 31, 20]],
    deco: [['waterRect', 2, 0, 31, 3], ['sand', 2, 4, 31, 6], ['bridge', 15, 0, 16, 6], ['lamp', 14, 13], ['lamp', 17, 13], ['lamp', 14, 21], ['lamp', 17, 21],
      ['sign', 13, 8, 'PORT-AZUR\nLe parfum des embruns et des voyages.'], ['sign', 12, 18, 'ARÈNE DE PORT-AZUR\nChampionne : Marine\nLa vague déferlante.'], ['flowers', 3, 21, 12, 23], ['flowers', 19, 21, 28, 23]],
    buildings: [
      { kind: 'center', x: 3, y: 7 }, { kind: 'mart', x: 9, y: 7 },
      { kind: 'house', x: 19, y: 8, roof: 'blue', npcs: [{ x: 4, y: 4, sprite: 'sailor', text: ['Plus loin à l\'est, Voltacité ne dort jamais.', 'Ses néons éclairent la côte toute la nuit !'] }] },
      { kind: 'house', x: 24, y: 8, roof: 'teal', npcs: [{ x: 2, y: 4, sprite: 'lass', text: ['Un Pokémon peut retenir quatre attaques au maximum.', 'Quand il en apprend une cinquième, il faut en oublier une.'] }] },
      { kind: 'gym', x: 5, y: 14, roof: 'blue' },
      { kind: 'house', x: 19, y: 16, roof: 'red', npcs: [{ x: 4, y: 4, sprite: 'hiker', text: ['Les attaques Électrik et Plante sont redoutables contre l\'Eau.', 'Marine le sait bien, et ses Pokémon aussi.'] }] },
      { kind: 'house2', x: 24, y: 16, roof: 'orange', npcs: [{ x: 2, y: 4, sprite: 'cooltrainer_f', text: ['Le jour, la nuit, le matin, le soir...', 'La couleur du ciel change avec l\'heure de ta console. Euh, de ton ordinateur !'] }] },
    ],
    npcs: [
      { id: 'marin', x: 17, y: 5, sprite: 'sailor', move: 'turn', text: ['Ahoy ! Ce ponton était le départ des ferries.', 'Depuis la tempête, plus aucun bateau ne part...'] },
      { id: 'pecheur', x: 25, y: 5, sprite: 'sailor', move: 'wander', text: ['Les Krabby pincent fort, méfie-toi en marchant sur la plage.'] },
      { id: 'garde', x: 32, y: 18, sprite: 'sailor', dir: 'left', gate: { badges: 3, tiles: [[33, 19], [33, 20]] }, text: ['La route 4 longe une côte escarpée.', 'Il faut trois badges pour l\'emprunter.'] },
    ],
  };
  buildTown(W, maps, D);

  /* ---------- E · Voltacité (Électrik) ---------- */
  const E = towns.E = {
    id: 'volta', name: 'Voltacité', x: 275, y: 48, w: 32, h: 24, exits: [['w', 10], ['s', 8]], gym: 3, stock: 4, ground: T.PAVE, music: 'city',
    roads: [[0, 10, 29, 11], [2, 18, 29, 19], [8, 10, 9, 23]],
    deco: [['lamp', 7, 12], ['lamp', 10, 12], ['lamp', 16, 12], ['lamp', 22, 12], ['lamp', 16, 20], ['lamp', 27, 20], ['pot', 2, 12], ['pot', 28, 12],
      ['sign', 11, 12, 'VOLTACITÉ\nLa ville qui ne s\'éteint jamais.'], ['sign', 17, 17, 'ARÈNE DE VOLTACITÉ\nChampionne : Volta\nL\'étincelle foudroyante.'], ['flowers', 2, 21, 7, 22], ['flowers', 11, 21, 28, 22]],
    buildings: [
      { kind: 'center', x: 3, y: 6 }, { kind: 'mart', x: 11, y: 6 },
      { kind: 'tower', x: 17, y: 6, roof: 'gold', name: 'Centrale de Voltacité', npcs: [{ x: 5, y: 4, sprite: 'clerk', text: ['Cette centrale alimente toute la région.', 'Les Voltorbe adorent se blottir contre les générateurs !'] }, { x: 8, y: 6, sprite: 'prof', text: ['Les Pokémon Sol ne craignent pas du tout l\'électricité.', 'Un bon atout contre l\'Arène !'] }] },
      { kind: 'house2', x: 23, y: 7, roof: 'gray', npcs: [{ x: 2, y: 4, sprite: 'youngster', text: ['La paralysie divise la vitesse par quatre.', 'Et parfois, le Pokémon ne peut même pas attaquer !'] }] },
      { kind: 'gym', x: 18, y: 13, roof: 'gold' },
      { kind: 'house', x: 11, y: 15, roof: 'blue', npcs: [{ x: 4, y: 4, sprite: 'lass', text: ['Une Super Ball capture mieux qu\'une Poké Ball.', 'Une Hyper Ball, c\'est encore mieux !'] }] },
      { kind: 'house', x: 3, y: 15, roof: 'purple', npcs: [{ x: 2, y: 4, sprite: 'hiker', text: ['Au sud, la route 5 descend jusqu\'à Floralia.', 'Une ville couverte de fleurs, tu verras.'] }] },
    ],
    npcs: [
      { id: 'scientifique', x: 14, y: 14, sprite: 'clerk', move: 'wander', text: ['La nuit, les Pokémon qu\'on croise ne sont pas tout à fait les mêmes.', 'Les Hoothoot, par exemple, sortent surtout le soir.'] },
      { id: 'garde', x: 10, y: 21, sprite: 'sailor', dir: 'left', gate: { badges: 4, tiles: [[8, 21], [9, 21]] }, text: ['La route 5 est fermée aux dresseurs débutants.', 'Il faut quatre badges pour passer.'] },
    ],
  };
  buildTown(W, maps, E);

  /* ---------- F · Floralia (Plante) ---------- */
  const F = towns.F = {
    id: 'flora', name: 'Floralia', x: 165, y: 112, w: 36, h: 28, exits: [['n', 17], ['e', 19]], gym: 4, stock: 5, music: 'city',
    roads: [[17, 0, 18, 20], [2, 9, 33, 10], [2, 19, 35, 20], [2, 9, 3, 20], [32, 9, 33, 20]],
    deco: [['flowers', 5, 11, 15, 12], ['flowers', 20, 11, 30, 12], ['flowers', 4, 22, 14, 24], ['water', 24, 23, 3.4, 1.6], ['flowers', 19, 21, 21, 24], ['flowers', 29, 22, 31, 24],
      ['lamp', 16, 7], ['lamp', 19, 7], ['lamp', 16, 21], ['lamp', 19, 21], ['pot', 8, 13], ['pot', 28, 13],
      ['sign', 15, 3, 'FLORALIA\nLa cité aux mille couleurs.'], ['sign', 20, 17, 'ARÈNE DE FLORALIA\nChampionne : Flora\nLa beauté épineuse.']],
    buildings: [
      { kind: 'center', x: 3, y: 5 }, { kind: 'mart', x: 9, y: 5 },
      { kind: 'bighouse', x: 21, y: 5, roof: 'purple', name: 'Résidence Floralia', npcs: [{ x: 3, y: 4, sprite: 'lass', text: ['Les attaques de statut ne font pas de dégâts, mais elles changent tout.', 'Un adversaire endormi, c\'est un adversaire inoffensif !'] }, { x: 7, y: 5, sprite: 'prof', text: ['J\'ai vu un dresseur aux cheveux en bataille foncer vers l\'Arène.', 'Il avait l\'air pressé de te battre...'] }] },
      { kind: 'house2', x: 27, y: 6, roof: 'green', npcs: [{ x: 2, y: 4, sprite: 'youngster', text: ['Les Pokémon Plante détestent le Feu, la Glace, le Poison, le Vol et l\'Insecte.', 'Ça en fait, des faiblesses !'] }] },
      { kind: 'gym', x: 21, y: 14, roof: 'green' },
      { kind: 'house', x: 4, y: 16, roof: 'red', npcs: [{ x: 4, y: 4, sprite: 'cooltrainer_f', text: ['Ton Pokémon le plus en forme combat en premier.', 'Change l\'ordre de ton équipe dans le menu Pokémon !'] }] },
      { kind: 'house', x: 9, y: 16, roof: 'orange', npcs: [{ x: 2, y: 4, sprite: 'hiker', text: ['Mirage, à l\'est, est une ville étrange.', 'On dit que ses habitants lisent dans les pensées.'] }] },
      { kind: 'house', x: 28, y: 16, roof: 'blue', npcs: [{ x: 3, y: 4, sprite: 'sailor', text: ['Le PC du Centre garde les Pokémon en trop.', 'Ton équipe ne peut compter que six Pokémon.'] }] },
    ],
    npcs: [
      { id: 'jardiniere', x: 12, y: 13, sprite: 'lass', move: 'wander', text: ['Bienvenue à Floralia ! Respire ce parfum...'] },
      { id: 'garde', x: 34, y: 18, sprite: 'sailor', dir: 'left', gate: { badges: 5, tiles: [[35, 19], [35, 20]] }, text: ['La route 6 traverse des terres sauvages.', 'Il faut cinq badges pour continuer.'] },
    ],
  };
  buildTown(W, maps, F);
  W.zone(165 + 15, 112, 165 + 20, 112 + 4, { name: 'Floralia', music: 'city', trigger: 'rival3' });

  /* ---------- G · Mirage (Psy) ---------- */
  const G = towns.G = {
    id: 'mirage', name: 'Mirage', x: 276, y: 136, w: 30, h: 24, exits: [['w', 10], ['s', 15]], gym: 5, stock: 6, music: 'mystic',
    roads: [[0, 10, 27, 11], [2, 18, 27, 19], [15, 10, 16, 23]],
    deco: [['flowers', 2, 2, 27, 3], ['lamp', 14, 12], ['lamp', 17, 12], ['pot', 2, 13], ['pot', 13, 16], ['water', 23, 22, 3, 1.4],
      ['sign', 18, 12, 'MIRAGE\nLa ville où l\'esprit voit plus loin.'], ['sign', 11, 17, 'ARÈNE DE MIRAGE\nChampionne : Sibylle\nLe regard qui perce le voile.']],
    buildings: [
      { kind: 'center', x: 3, y: 6 }, { kind: 'mart', x: 9, y: 6 },
      { kind: 'tower', x: 20, y: 6, roof: 'purple', name: 'Tour Mirage', npcs: [{ x: 5, y: 4, sprite: 'nurse', text: ['Les attaques Psy sont puissantes... mais le type Ténèbres ne les craint pas.', 'Et les Insectes ne sont pas si fragiles face à elles.'] }] },
      { kind: 'gym', x: 3, y: 13, roof: 'purple' },
      { kind: 'house', x: 19, y: 15, roof: 'purple', npcs: [{ x: 4, y: 4, sprite: 'cooltrainer_f', text: ['Je savais que tu viendrais. Ne me demande pas comment.'] }] },
      { kind: 'house', x: 24, y: 15, roof: 'teal', npcs: [{ x: 2, y: 4, sprite: 'prof', text: ['Au sud, la route 7 descend vers l\'île volcanique de Cendrelune.', 'Prévois des Anti-Brûle !'] }] },
    ],
    npcs: [
      { id: 'voyante', x: 20, y: 13, sprite: 'nurse', move: 'turn', text: ['Je vois... un grand combat dans ton avenir.', 'Et un Centre Pokémon juste après, je pense.'] },
      { id: 'garde', x: 17, y: 21, sprite: 'sailor', dir: 'left', gate: { badges: 6, tiles: [[15, 21], [16, 21]] }, text: ['L\'île de Cendrelune n\'accepte que les dresseurs aguerris.', 'Il te faut six badges.'] },
    ],
  };
  buildTown(W, maps, G);

  /* ---------- H · Cendrelune (Feu) ---------- */
  const H = towns.H = {
    id: 'cendre', name: 'Cendrelune', x: 272, y: 224, w: 32, h: 24, exits: [['n', 19], ['w', 12]], gym: 6, stock: 7, ground: T.ASH, music: 'volcano', theme: 'volcanic',
    roads: [[19, 0, 20, 13, T.PATH], [0, 12, 29, 13, T.PATH], [2, 20, 29, 21, T.PATH], [9, 12, 10, 21, T.PATH]],
    deco: [['rock', 26, 4], ['rock', 28, 7], ['rock', 3, 3], ['lamp', 18, 14], ['lamp', 21, 14],
      ['sign', 22, 10, 'CENDRELUNE\nL\'île où dort le volcan.'], ['sign', 11, 19, 'ARÈNE DE CENDRELUNE\nChampion : Pyros\nLe cœur ardent.']],
    buildings: [
      { kind: 'center', x: 3, y: 7 }, { kind: 'mart', x: 11, y: 7 },
      { kind: 'house', x: 23, y: 8, roof: 'orange', npcs: [{ x: 4, y: 4, sprite: 'hiker', text: ['L\'Eau, la Roche et le Sol éteignent le Feu.', 'Pyros a beau être ardent, il a ses faiblesses.'] }] },
      { kind: 'gym', x: 12, y: 15, roof: 'red' },
      { kind: 'house', x: 3, y: 17, roof: 'brown', npcs: [{ x: 2, y: 4, sprite: 'lass', text: ['Le Pont des Marées relie notre île à Cimelune, à l\'ouest.', 'C\'est le plus long pont de la région !'] }] },
      { kind: 'house', x: 22, y: 17, roof: 'gray', npcs: [{ x: 4, y: 4, sprite: 'sailor', text: ['Les sources chaudes de l\'île guérissent tout... enfin, presque.'] }] },
    ],
    npcs: [
      { id: 'garde', x: 2, y: 11, sprite: 'sailor', dir: 'right', gate: { badges: 7, tiles: [[0, 12], [0, 13]] }, text: ['Le Pont des Marées est réservé aux dresseurs à sept badges.'] },
    ],
  };
  buildTown(W, maps, H);

  /* ---------- I · Cimelune (Dragon) ---------- */
  const I = towns.I = {
    id: 'cime', name: 'Cimelune', x: 150, y: 222, w: 32, h: 26, exits: [['e', 16], ['n', 10], ['w', 16]], gym: 7, stock: 7, music: 'mystic',
    roads: [[2, 9, 29, 10], [0, 16, 31, 17], [10, 0, 11, 17]],
    deco: [['water', 26, 5, 3.2, 2.6], ['trees', 2, 19, 5, 21, T.PINE], ['trees', 26, 19, 29, 21, T.PINE], ['flowers', 12, 19, 19, 21], ['statue', 15, 21], ['lamp', 9, 11], ['lamp', 12, 11],
      ['sign', 8, 8, 'CIMELUNE\nLa cité des dragons anciens.'], ['sign', 12, 14, 'ARÈNE DE CIMELUNE\nChampion : Drakon\nLe gardien des dragons.']],
    buildings: [
      { kind: 'center', x: 3, y: 5 }, { kind: 'mart', x: 14, y: 5 },
      { kind: 'house', x: 19, y: 6, roof: 'purple', npcs: [{ x: 4, y: 4, sprite: 'prof', text: ['Les dragons ne craignent presque rien...', 'sauf la Glace et les autres dragons.'] }] },
      { kind: 'gym', x: 13, y: 11, roof: 'purple' },
      { kind: 'house', x: 3, y: 13, roof: 'teal', npcs: [{ x: 2, y: 4, sprite: 'lass', text: ['Au nord, la Route Victoire mène au Plateau Céleste.', 'Seuls les dresseurs aux huit badges peuvent la franchir.'] }] },
      { kind: 'house', x: 22, y: 13, roof: 'red', npcs: [{ x: 4, y: 4, sprite: 'hiker', text: ['La route 10 relie Cimelune à Bourg-Aube, par le sud.', 'Ça rappelle des souvenirs, hein ?'] }] },
    ],
    npcs: [
      { id: 'garde', x: 12, y: 2, sprite: 'sailor', dir: 'down', gate: { badges: 8, tiles: [[10, 1], [11, 1]] }, text: ['Halte ! La Route Victoire est réservée aux dresseurs aux huit badges.'] },
    ],
  };
  buildTown(W, maps, I);

  /* ---------- J · Plateau Céleste (Ligue) ---------- */
  const J = towns.J = {
    id: 'plateau', name: 'Plateau Céleste', x: 70, y: 150, w: 30, h: 24, exits: [['e', 18]], stock: 7, music: 'league',
    roads: [[3, 10, 26, 19]],
    deco: [['flowers', 3, 3, 8, 8], ['flowers', 20, 3, 26, 8], ['statue', 12, 11], ['statue', 16, 11], ['lamp', 8, 11], ['lamp', 20, 11],
      ['sign', 22, 17, 'PLATEAU CÉLESTE\nLe sommet des dresseurs.']],
    buildings: [
      { kind: 'league', x: 10, y: 4, id: 'ligue' },
      { kind: 'center', x: 3, y: 12 }, { kind: 'mart', x: 21, y: 12 },
    ],
    npcs: [],
  };
  buildTown(W, maps, J);

  /* ======================== ROUTES ======================== */
  const routes = [];
  const R = (id, name, pts, o, enc, music = 'route') => {
    const res = carveRoute(W, pts, { seed: routes.length * 97 + 13, ...o });
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), m = (o.w || 9) / 2 + 2;
    routes.push({ id, name, pts });
    W.zone(Math.floor(Math.min(...xs) - m), Math.floor(Math.min(...ys) - m), Math.ceil(Math.max(...xs) + m), Math.ceil(Math.max(...ys) + m), { name, music, enc: ENC[enc], theme: o.theme, route: id, prio: 0 });
    return pts;
  };
  // les zones de route sont ajoutées après les villes : on réordonne pour que les villes l'emportent
  const r1 = R('r1', 'Route 1', [[34.5, 240], [34.5, 224], [30.5, 210], [38.5, 190], [34.5, 174], [34.5, 160]], { w: 13, grass: 0.8, trees: 0.04 }, 'r1');
  ledges(W, r1, [0.18, 0.32, 0.55, 0.7], { reach: 7 });
  routeTrainer(W, r1, 0.35, 1, 4, 'Gamin', 'Léo', [[19, 4], [16, 4]], { intro: 'Hé ! Toi aussi tu viens d\'avoir ton premier Pokémon ?' });
  routeTrainer(W, r1, 0.62, -1, 4, 'Fillette', 'Inès', [[161, 5]], { intro: 'Mon Fouinette est le plus mignon de la route !' });
  routeTrainer(W, r1, 0.82, 1, 3, 'Gamin', 'Malo', [[16, 5], [19, 5], [10, 4]]);
  routeItem(W, r1, 0.5, -1, 5, 'potion'); routeItem(W, r1, 0.9, 1, 5, 'poke-ball', 2);

  const r2 = R('r2', 'Route 2', [[34.5, 138], [34.5, 120], [37.5, 104], [52.5, 96.5], [75.5, 94.5], [99.5, 92.5]], { w: 11, grass: 0.7, trees: 0.05, flowers: 0.03, taperEnd: false }, 'r2');
  routeTrainer(W, r2, 0.2, -1, 3, 'Insectomane', 'Noé', [[10, 6], [13, 6], [11, 7]]);
  routeTrainer(W, r2, 0.45, 1, 3, 'Fillette', 'Jade', [[16, 7], [29, 7]]);
  routeTrainer(W, r2, 0.7, -1, 4, 'Gamin', 'Sacha', [[21, 8], [19, 7]]);
  routeTrainer(W, r2, 0.9, 1, 3, 'Topdresseuse', 'Alba', [[32, 8], [43, 9], [16, 9]]);
  routeItem(W, r2, 0.33, 1, 4, 'antidote'); routeItem(W, r2, 0.6, -1, 4, 'potion', 2); routeItem(W, r2, 0.8, 1, 5, 'repel');
  // rival n°2 au début de la route 2
  W.zone(33, 133, 36, 136, { name: 'Route 2', music: 'route', trigger: 'rival2' });

  const bois = R('bois', 'Bois Murmure', [[99.5, 92.5], [104.5, 82.5], [99.5, 70.5], [104.5, 60.5], [105.5, 52]], { w: 15, grass: 1.2, tall: T.DARKTALL, trees: 0.16, flowers: 0.01, taperStart: false, theme: 'forest' }, 'bois', 'forest');
  routeTrainer(W, bois, 0.2, 1, 4, 'Insectomane', 'Adam', [[11, 9], [14, 9], [165, 9]]);
  routeTrainer(W, bois, 0.42, -1, 4, 'Randonneuse', 'Clara', [[43, 10], [69, 10]]);
  routeTrainer(W, bois, 0.65, 1, 3, 'Insectomane', 'Timothée', [[167, 11], [46, 11]]);
  routeTrainer(W, bois, 0.85, -1, 4, 'Topdresseur', 'Yanis', [[25, 12], [21, 12], [43, 11]]);
  routeItem(W, bois, 0.3, -1, 6, 'super-potion'); routeItem(W, bois, 0.55, 1, 6, 'paralyze-heal'); routeItem(W, bois, 0.75, -1, 6, 'moon-stone');

  const r3a = R('r3', 'Route 3', [[121, 40.5], [135, 41.5], [148.5, 41.5]], { w: 10, grass: 0.8, trees: 0.04, rocks: 0.02, taperEnd: false }, 'r3');
  routeTrainer(W, r3a, 0.35, 1, 3, 'Montagnard', 'Gaston', [[74, 11], [74, 12], [66, 12]]);
  routeTrainer(W, r3a, 0.7, -1, 3, 'Fillette', 'Lise', [[39, 12], [35, 11]]);
  routeItem(W, r3a, 0.55, 1, 4, 'burn-heal');
  const r3b = R('r3e', 'Route 3', [[173.5, 41.5], [178, 41.5], [182, 34.5], [187, 33.5]], { w: 8, grass: 0.6, trees: 0.03, taperStart: false }, 'r3');
  routeTrainer(W, r3b, 0.6, -1, 3, 'Randonneuse', 'Maëlle', [[56, 13], [27, 13]]);

  const r4 = R('r4', 'Route 4', [[218, 41.5], [235, 42.5], [250, 50.5], [262, 58.5], [277, 58.5]], { w: 12, grass: 0.6, trees: 0.03, flowers: 0.03 }, 'r4', 'route2');
  routeTrainer(W, r4, 0.18, -1, 4, 'Pêcheur', 'Yves', [[129, 13], [98, 15], [60, 15]]);
  routeTrainer(W, r4, 0.4, 1, 4, 'Marin', 'Loïc', [[66, 16], [72, 16]]);
  routeTrainer(W, r4, 0.62, -1, 4, 'Fillette', 'Romane', [[183, 16], [179, 17]]);
  routeTrainer(W, r4, 0.85, 1, 3, 'Topdresseur', 'Kylian', [[17, 18], [84, 17], [54, 18]]);
  routeItem(W, r4, 0.3, 1, 5, 'great-ball', 2); routeItem(W, r4, 0.72, -1, 5, 'water-stone');

  const r5 = R('r5', 'Route 5', [[283.5, 71], [283.5, 86], [262, 96.5], [230, 98.5], [200, 99.5], [182.5, 101], [182.5, 113]], { w: 12, grass: 0.75, trees: 0.05, rocks: 0.01 }, 'r5');
  ledges(W, r5, [0.08], { reach: 6 });
  routeTrainer(W, r5, 0.12, 1, 4, 'Scientifique', 'Pierre', [[81, 19], [100, 19], [81, 20]]);
  routeTrainer(W, r5, 0.3, -1, 4, 'Randonneuse', 'Élise', [[77, 20], [58, 20]]);
  routeTrainer(W, r5, 0.46, 1, 4, 'Karatéka', 'Kenji', [[66, 21], [67, 22]]);
  routeTrainer(W, r5, 0.6, -1, 4, 'Gamin', 'Nathan', [[20, 20], [22, 20], [209, 21]]);
  routeTrainer(W, r5, 0.78, 1, 4, 'Topdresseuse', 'Zoé', [[25, 22], [37, 21], [179, 21]]);
  routeItem(W, r5, 0.22, -1, 5, 'super-potion', 2); routeItem(W, r5, 0.5, 1, 5, 'thunder-stone'); routeItem(W, r5, 0.7, -1, 5, 'full-heal'); routeItem(W, r5, 0.9, 1, 5, 'rare-candy');

  const r6 = R('r6', 'Route 6', [[200, 131.5], [225, 131.5], [245, 140.5], [265, 146.5], [278, 146.5]], { w: 12, grass: 0.8, trees: 0.06, flowers: 0.04 }, 'r6', 'route2');
  routeTrainer(W, r6, 0.15, 1, 4, 'Randonneuse', 'Nina', [[44, 24], [70, 24]]);
  routeTrainer(W, r6, 0.35, -1, 4, 'Insectomane', 'Hugo', [[123, 25], [127, 25]]);
  routeTrainer(W, r6, 0.55, 1, 3, 'Médium', 'Morgane', [[93, 25], [92, 24], [93, 26]]);
  routeTrainer(W, r6, 0.75, -1, 4, 'Topdresseur', 'Axel', [[47, 26], [103, 26], [75, 26]]);
  routeItem(W, r6, 0.25, -1, 5, 'leaf-stone'); routeItem(W, r6, 0.65, 1, 5, 'hyper-potion'); routeItem(W, r6, 0.9, -1, 5, 'revive');

  const r7 = R('r7', 'Route 7', [[291.5, 159], [289.5, 175], [294.5, 195], [291.5, 226]], { w: 12, grass: 0.7, trees: 0.04, rocks: 0.03 }, 'r7');
  ledges(W, r7, [0.25, 0.5], { reach: 6 });
  routeTrainer(W, r7, 0.2, 1, 4, 'Médium', 'Ophélie', [[64, 28], [97, 29]]);
  routeTrainer(W, r7, 0.4, -1, 4, 'Karatéka', 'Bruno', [[57, 29], [107, 29], [106, 30]]);
  routeTrainer(W, r7, 0.6, 1, 4, 'Montagnard', 'Rémi', [[75, 30], [218, 30]]);
  routeTrainer(W, r7, 0.8, -1, 4, 'Topdresseuse', 'Lou', [[78, 31], [229, 31], [178, 30]]);
  routeItem(W, r7, 0.3, -1, 5, 'fire-stone'); routeItem(W, r7, 0.7, 1, 5, 'ultra-ball', 2);

  const r8 = R('r8', 'Pont des Marées', [[274, 236.5], [255, 236.5], [230, 238.5], [205, 238.5], [181, 238.5]], { w: 7, grass: 0.5, trees: 0.02, bridge: true }, 'r8', 'route2');
  routeTrainer(W, r8, 0.12, 1, 0.4, 'Marin', 'Gwen', [[99, 33], [73, 33]], { sight: 5 });
  routeTrainer(W, r8, 0.38, -1, 0.4, 'Pêcheur', 'Hervé', [[130, 33], [119, 34]], { sight: 5 });
  routeTrainer(W, r8, 0.5, 1, 2, 'Topdresseuse', 'Maya', [[121, 35], [55, 34], [184, 35]]);
  routeTrainer(W, r8, 0.72, 1, 0.4, 'Marin', 'Erwan', [[91, 34], [226, 35]], { sight: 5 });
  routeItem(W, r8, 0.48, -1, 2, 'max-potion');

  const r9 = R('r9', 'Route 9', [[160.5, 224], [160.5, 214], [160.5, 208]], { w: 7, grass: 0.5, trees: 0.03, taperEnd: false }, 'r9');
  const r9b = R('r9b', 'Route 9', [[115.5, 166], [108, 168.5], [99, 168.5]], { w: 7, grass: 0.4, trees: 0.02, taperStart: false }, 'r9');
  W.zone(99, 165, 112, 172, { name: 'Route 9', music: 'route', enc: ENC.r9, trigger: 'rival4' });

  const r10 = R('r10', 'Route 10', [[49, 248.5], [75, 250.5], [100, 247.5], [125, 242.5], [150, 238.5]], { w: 12, grass: 0.8, trees: 0.05, rocks: 0.02 }, 'r10');
  routeTrainer(W, r10, 0.2, 1, 4, 'Topdresseur', 'Victor', [[85, 36], [128, 36], [22, 36]]);
  routeTrainer(W, r10, 0.45, -1, 4, 'Karatéka', 'Ryu', [[68, 37], [107, 37]]);
  routeTrainer(W, r10, 0.7, 1, 4, 'Topdresseuse', 'Léa', [[241, 37], [210, 37], [203, 37]]);
  routeItem(W, r10, 0.35, -1, 5, 'ultra-ball', 3); routeItem(W, r10, 0.85, 1, 5, 'sun-stone');

  // pas d'herbes hautes débordant des routes dans les villes (sauf celles prévues par la ville)
  for (const t of Object.values(towns)) {
    const keep = (t.deco || []).filter((d) => d[0] === 'tall').map(([, x0, y0, x1, y1]) => [t.x + x0, t.y + y0, t.x + x1, t.y + y1]);
    for (let y = t.y; y < t.y + t.h; y++) for (let x = t.x; x < t.x + t.w; x++) {
      const v = W.get(x, y); if (v !== T.TALL && v !== T.DARKTALL) continue;
      if (keep.some(([a, b, c, d]) => x >= a && x <= c && y >= b && y <= d)) continue;
      W.set(x, y, t.ground ?? T.GRASS);
    }
  }
  // les villes passent devant les routes dans la recherche de zone
  const townZones = W.zones.filter((z) => z.town || z.trigger), routeZones = W.zones.filter((z) => !z.town && !z.trigger);
  W.zones = [...routeZones, ...townZones];

  /* ======================== GROTTES ======================== */
  // Grotte Lunaire : entre la route 3 ouest et est
  const g1in = W.building('cave', 146, 38), g1out = W.building('cave', 171, 38);
  const grotte = caveMap('grotte', 46, 32, 4242, [{ x: 4, y: 26 }, { x: 41, y: 26 }], { name: 'Grotte Lunaire', via: [{ x: 14, y: 8 }, { x: 30, y: 20 }, { x: 36, y: 6 }] });
  grotte.encounter = ENC.grotte; maps.grotte = grotte;
  for (const [cx, cy, out] of [[4, 26, g1in], [41, 26, g1out]]) {
    grotte.set(cx, cy + 1, T.CAVEDOOR); grotte.set(cx, cy, T.CAVE); grotte.set(cx, cy + 2, T.CAVEWALL);
    grotte.warp(cx, cy + 1, { map: 'monde', x: out.doorX, y: out.doorY + 1, dir: 'down' });
    W.warp(out.doorX, out.doorY, { map: 'grotte', x: cx, y: cy, dir: 'up' });
    grotte.deco.push({ k: 'exitlight', x: cx, y: cy + 1 });
  }
  caveTrainers(grotte, [['Montagnard', 'Roger', [[74, 12], [95, 13]]], ['Gamin', 'Enzo', [[41, 11], [41, 12], [46, 12]]], ['Montagnard', 'Bernard', [[50, 13], [74, 13], [75, 14]]]], 11);
  caveItems(grotte, ['escape-rope', 'moon-stone', 'super-potion', 'great-ball'], 12);

  // Route Victoire
  const v1in = W.building('cave', 158, 205), v1out = W.building('cave', 113, 163);
  const victoire = caveMap('victoire', 60, 40, 777, [{ x: 50, y: 34 }, { x: 6, y: 34 }], { name: 'Route Victoire', via: [{ x: 48, y: 8 }, { x: 28, y: 18 }, { x: 10, y: 6 }] });
  victoire.encounter = ENC.victoire; maps.victoire = victoire;
  for (const [cx, cy, out] of [[50, 34, v1in], [6, 34, v1out]]) {
    victoire.set(cx, cy + 1, T.CAVEDOOR); victoire.set(cx, cy, T.CAVE); victoire.set(cx, cy + 2, T.CAVEWALL);
    victoire.warp(cx, cy + 1, { map: 'monde', x: out.doorX, y: out.doorY + 1, dir: 'down' });
    W.warp(out.doorX, out.doorY, { map: 'victoire', x: cx, y: cy, dir: 'up' });
    victoire.deco.push({ k: 'exitlight', x: cx, y: cy + 1 });
  }
  caveTrainers(victoire, [['Topdresseur', 'Dimitri', [[67, 40], [75, 40], [130, 41]]], ['Topdresseuse', 'Sofia', [[148, 41], [124, 40], [82, 40]]], ['Karatéka', 'Takeshi', [[68, 42], [107, 41], [106, 41]]], ['Médium', 'Iris', [[94, 41], [65, 41]]], ['Montagnard', 'Hubert', [[76, 42], [95, 42], [112, 42]]]], 41);
  caveItems(victoire, ['full-restore', 'max-repel', 'rare-candy', 'ultra-ball', 'revive', 'max-potion'], 43);

  /* ======================== ARÈNES ======================== */
  const gymTrainers = [
    [['Insectomane', 'Lucas', [[13, 9], [10, 10]]], ['Insectomane', 'Basile', [[11, 10], [14, 10]]]],
    [['Montagnard', 'Marcel', [[74, 14], [27, 15]]], ['Montagnard', 'Henri', [[95, 15]]]],
    [['Marin', 'Yann', [[90, 20], [116, 20]]], ['Fillette', 'Océane', [[118, 21], [183, 21]]], ['Pêcheur', 'Paul', [[60, 22], [54, 22]]]],
    [['Scientifique', 'Alan', [[100, 26], [81, 26]]], ['Topdresseuse', 'Électra', [[179, 26], [25, 27]]], ['Scientifique', 'Ohm', [[82, 27]]]],
    [['Randonneuse', 'Rose', [[69, 30], [102, 30]]], ['Topdresseuse', 'Lila', [[44, 31], [114, 31]]], ['Randonneuse', 'Iris', [[189, 31]]]],
    [['Médium', 'Esther', [[64, 34], [178, 34]]], ['Médium', 'Félix', [[97, 35], [122, 35]]], ['Topdresseuse', 'Luna', [[196, 36]]]],
    [['Karatéka', 'Akira', [[126, 38], [58, 38]]], ['Topdresseur', 'Blaise', [[78, 39], [219, 39]]], ['Montagnard', 'Basile', [[228, 40], [5, 40]]]],
    [['Topdresseur', 'Kael', [[148, 42], [130, 42]]], ['Topdresseuse', 'Wyrna', [[149, 43]]], ['Topdresseur', 'Ivar', [[147, 42], [148, 43], [230, 43]]]],
  ];
  for (const t of Object.values(towns)) {
    if (t.gym == null) continue;
    const g = t.gymMap, L = LEADERS[t.gym];
    g.npc({ id: g.id + ':guide', x: 9, y: 17, sprite: 'clerk', dir: 'down', script: 'gymguide', gym: t.gym });
    // les dresseurs se tiennent sur le côté de l'allée centrale (colonne 7) : ils ne bloquent jamais le passage
    const spots = [[5, 15, 'right'], [10, 10, 'left'], [4, 7, 'right'], [10, 11, 'left']];
    gymTrainers[t.gym].forEach(([cls, name, team], i) => {
      const [x, y, dir] = spots[i]; trainerNpc(g, x, y, dir, cls, name, team, { sight: 3, intro: 'Tu veux défier notre Champion ? Passe d\'abord par moi !', after: 'Notre Champion est bien plus fort que moi.' });
    });
    g.npc({ id: g.id + ':leader', x: 7, y: 3, dir: 'down', sprite: L.ow, leader: t.gym, trainer: { cls: t.gym === 0 || t.gym === 1 || t.gym === 6 || t.gym === 7 ? 'Champion' : 'Championne', name: L.name, team: L.team, prize: 100, bs: L.bs, ai: 'smart', items: { 'super-potion': t.gym < 4 ? 1 : 0, 'hyper-potion': t.gym >= 4 ? 2 : 0 }, intro: L.intro, lose: L.lose, sight: 0 } });
  }
  // Ligue : la Championne
  const league = maps['plateau:ligue'];
  league.npc({ id: 'champion', x: 7, y: 3, dir: 'down', sprite: CHAMPION.ow, champion: true, trainer: { cls: 'Maître', name: CHAMPION.name, team: CHAMPION.team, prize: 200, bs: CHAMPION.bs, ai: 'smart', items: { 'full-restore': 2 }, intro: CHAMPION.intro, lose: CHAMPION.lose, sight: 0 } });
  league.npc({ id: 'ligue-garde', x: 5, y: 15, sprite: 'clerk', dir: 'right', text: ['Bienvenue à la Ligue Céleste.', 'La Maître t\'attend au bout du tapis. Bonne chance !'] });

  // Labo : professeur, assistant
  const lab = maps['aube:labo'];
  lab.npc({ id: 'prof', x: 6, y: 3, sprite: 'prof', dir: 'down', script: 'prof' });
  lab.npc({ id: 'assistant', x: 10, y: 7, sprite: 'clerk', move: 'wander', text: ['Le professeur étudie le lien entre les dresseurs et leurs Pokémon.', 'Il dit que c\'est en voyageant qu\'on le comprend le mieux.'] });
  STARTERS.forEach((sp, i) => lab.object(5 + i, 5, { type: 'starter', sp }));

  return { maps, towns, routes, start: { map: 'aube:maison', x: 4, y: 6, dir: 'up' } };
}

function caveTrainers(m, list, seed) {
  const r = rng(seed); const floors = [];
  for (let y = 3; y < m.h - 3; y++) for (let x = 3; x < m.w - 3; x++) if (m.get(x, y) === T.CAVE && m.get(x + 1, y) === T.CAVE && m.get(x - 1, y) === T.CAVE) floors.push([x, y]);
  list.forEach(([cls, name, team], i) => {
    const [x, y] = floors[Math.floor(((i + 0.5) / list.length) * floors.length * 0.9 + r() * floors.length * 0.08)];
    trainerNpc(m, x, y, ['left', 'right', 'down', 'up'][Math.floor(r() * 4)], cls, name, team, { sight: 3 });
  });
}
function caveItems(m, items, seed) {
  const r = rng(seed); const floors = [];
  for (let y = 3; y < m.h - 3; y++) for (let x = 3; x < m.w - 3; x++) if (m.get(x, y) === T.CAVE) floors.push([x, y]);
  for (const it of items) { const [x, y] = floors[Math.floor(r() * floors.length)]; m.item(x, y, it); }
}
