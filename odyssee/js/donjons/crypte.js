// odyssee/js/donjons/crypte.js — la Crypte des Murmures, sous le cimetière des ruines (au bout d'un sentier de
// la Route 2) : petit donjon à faire à plusieurs, sur le modèle des donjons de début de partie des MMO (une salle, un
// groupe d'adversaires, une porte qui s'ouvre, un boss au bout). Repris du labo (TestOdyssée).
//
// Entrée : la grille, dehors, s'ouvre avec la clé qu'Hector donne avec le premier badge ; le fossoyeur ouvre la crypte
// quand le groupe est prêt.
// Salles des Murmures et Ossuaire : trois esprits par salle, chacun se combat par un seul joueur à la fois.
// Salle des Dalles : tout le groupe doit se tenir sur les dalles en même temps (seul : une dalle suffit).
// Tombeau : Ossarion a des PV partagés ; chaque combat lui retire ce qu'on lui a infligé.
// La crypte se refait autant qu'on veut ; sa récompense n'est donnée qu'une fois par partie (drapeau crypte:recompense).
import { T, walkable } from '../world/tiles.js';
import { ITEMS } from '../core/items.js';
import { construireCarte, textePanneau } from './plan.js';

ITEMS['cle-crypte'] = { pocket: 'cles', price: 0, key: true, icon: 'secret-key', name: 'Clé de la Crypte', desc: 'Une vieille clé de fer, donnée par Hector. Elle ouvre la crypte du Cimetière des Murmures, au bout d\'un sentier de la Route 2.' };

const CRYPTE = {
  id: 'crypte',
  carte: 'crypte',
  // la porte, dehors, est fermée : la clé vient d'Hector, le Champion de Sylvebourg (badgeScene de game.js)
  cle: 'cle-crypte',
  nom: 'Crypte des Murmures',
  niveau: 'niv. 20 à 30',
  // panneau d'entrée : nom, phrase, nombre de joueurs (plan.js, texteJoueurs)
  entree: 'On y descend à plusieurs. On en remonte... parfois.',
  joueurs: { mode: 'groupe', n: 3 },
  musique: 'tower',
  plan: [
    '##########################',
    '#######............#######',
    '#####..X.....B....X..#####',
    '####..T............T..####',
    '####..................####',
    '#####..C..........C..#####',
    '#######............#######',
    '###########....###########',
    '############33############',
    '############..############',
    '#######............#######',
    '#####..T....o.....T..#####',
    '####..................####',
    '####..o............o..####',
    '#####.......X........#####',
    '#######............#######',
    '###########....###########',
    '############22############',
    '############..############',
    '#######.d..........#######',
    '#####..R..........R..#####',
    '####..e..........f....####',
    '####..................####',
    '#####..G..........G..#####',
    '#######............#######',
    '###########....###########',
    '############11############',
    '############..############',
    '#######..a.........#######',
    '#####..X..........X..#####',
    '####..b..........c....####',
    '####..................####',
    '#####..T..........T..#####',
    '#######............#######',
    '###########....###########',
    '############00############',
    '############..############',
    '#########..........#######',
    '########..C......C..######',
    '########...g........######',
    '########.....S......######',
    '#########..........#######',
    '#############D############',
  ],
  decor: { T: 'brasero', C: 'colonne', X: 'squelette', G: 'gargouille', R: 'caverock' },
  pnj: {
    g: { id: 'gardien', nom: 'Fossoyeur Anselme', sprite: 'vieil_homme', dir: 'right', gardien: true },
    a: { id: 'ame1', cls: 'Âme', nom: 'errante', sprite: 'medium', dir: 'down', equipe: [[92, 18], [353, 19]] },
    b: { id: 'ame2', cls: 'Âme', nom: 'errante', sprite: 'medium', dir: 'right', equipe: [[355, 20]] },
    c: { id: 'ame3', cls: 'Âme', nom: 'errante', sprite: 'medium', dir: 'left', equipe: [[104, 19], [92, 19]] },
    d: { id: 'os1', cls: 'Veilleur', nom: 'd\'os', sprite: 'pretre', dir: 'down', equipe: [[93, 23], [105, 22]] },
    e: { id: 'os2', cls: 'Veilleur', nom: 'd\'os', sprite: 'pretre', dir: 'right', equipe: [[354, 23], [355, 22]] },
    f: { id: 'os3', cls: 'Veilleur', nom: 'd\'os', sprite: 'pretre', dir: 'left', equipe: [[607, 22], [425, 23]] },
    B: { id: 'ossarion', cls: 'Gardien', nom: 'Ossarion', sprite: 'spectrel', dir: 'down', boss: true, equipe: [[105, 27]], bs: 'nox' },
  },
  salles: [
    { id: 'entree', nom: 'Entrée de la crypte', type: 'accueil', repere: 'S', porte: '0' },
    { id: 's1', nom: 'Salle des Murmures', type: 'combat', pnj: ['a', 'b', 'c'], porte: '1' },
    { id: 's2', nom: 'Ossuaire', type: 'combat', pnj: ['d', 'e', 'f'], porte: '2' },
    { id: 's3', nom: 'Salle des Dalles', type: 'dalles', repere: 'o', porte: '3' },
    { id: 'boss', nom: 'Tombeau d\'Ossarion', type: 'boss', pnj: ['B'], musique: 'sanctuary' },
  ],
  textes: {
    porteFermee: ['Une lourde grille de fer ferme l\'entrée de la crypte.', 'Il faudrait une clé.'],
    porteCle: 'La grille de la crypte est fermée. Essayer la vieille clé d\'Hector ?',
    gardien: ['Halte. Derrière cette porte dort la Crypte des Murmures.', 'Trois salles et un tombeau. Les esprits ne se laissent affronter que par un dresseur à la fois : partagez-vous le travail.', 'Dans la Salle des Dalles, il faudra que tout le groupe tienne les dalles en même temps.', 'Et au fond, Ossarion. Chaque coup que vous lui portez compte pour tout le groupe.'],
    ouverture: ['Le fossoyeur tourne une vieille clé dans la pierre...', 'La porte de la crypte s\'ouvre !'],
    dalles: 'Une dalle de pierre usée. Elle bouge légèrement sous le pied.',
    victoire: ['Ossarion s\'effondre dans un nuage de poussière...', 'La crypte retombe dans le silence.'],
    perdu: ['Tes Pokémon n\'en peuvent plus...', 'Tu ressors de la crypte en titubant. Le fossoyeur soigne ton équipe.'],
  },
  recompense: { argent: 3000, objets: { 'rare-candy': 2, 'revive': 2 } },
};

export default CRYPTE;

/**
 * la clairière des ruines, au bout d'un sentier de la Route 2, devient le cimetière des Murmures : l'entrée
 * de la crypte au fond (au nord), une allée jusqu'à la stèle des ruines, des rangées de stèles, des lanternes, des
 * arbres morts, et la carte de la crypte reliée à la porte. Posé une fois tout le reste fait (region.js) ; rien de
 * ce qui était là ne devient inatteignable (sinon le décor n'est pas posé).
 */
export function poserCrypte(W, maps, routes = []) {
  // les ruines d'une impasse de la Route 2 (chemins.js), qu'elles portent un nom de lieu ou non
  const C = routes.find((r) => r.id === 'r2')?.pts?.res?.cotes?.find((c) => c.kind === 'ruines');
  const zr = C && W.zoneAt(C.x, C.y);
  const z = W.zones.find((q) => q.name === 'Ruines Oubliées' && q.route === 'r2')
    || (C && { x0: C.x - 9, y0: C.y - 12, x1: C.x + 9, y1: C.y + 6, route: 'r2', enc: zr?.enc, theme: zr?.theme });
  const st = z && W.deco.find((d) => d.k === 'stele' && d.x >= z.x0 && d.x <= z.x1 && d.y >= z.y0 && d.y <= z.y1);
  if (!st) throw new Error('Crypte des Murmures : pas de ruines sur la Route 2');
  const herbe = (x, y) => [T.GRASS, T.TALL, T.FLOWER, T.PATH].includes(W.get(x, y)) && W.height(x, y) === 0;
  // ce qu'il faut toujours pouvoir rejoindre depuis la clairière : les sentiers qui en partent (cases atteintes loin de
  // la stèle), les dresseurs et objets d'alentour, et devant la porte. Une case bâtie se simule avant d'être posée.
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]], R = 26;
  const dedans = (x, y) => Math.abs(x - st.x) <= R && Math.abs(y - st.y) <= R;
  const depart = [st.x, st.y + 1];
  const parcours = (bloque) => {
    const vu = new Set([depart + '']), f = [depart];
    while (f.length) { const [x, y] = f.pop(); for (const [dx, dy] of N4) { const a = x + dx, c = y + dy, k = a + ',' + c; if (!vu.has(k) && dedans(a, c) && !bloque.has(k) && walkable(W.get(a, c))) { vu.add(k); f.push([a, c]); } } }
    return vu;
  };
  const touche = (vu, x, y) => vu.has(x + ',' + y) || N4.some(([dx, dy]) => vu.has((x + dx) + ',' + (y + dy)));
  const avant = parcours(new Set());
  const cibles = [...avant].map((k) => k.split(',').map(Number)).filter(([x, y]) => Math.max(Math.abs(x - st.x), Math.abs(y - st.y)) >= R - 2);
  for (const q of [...W.npcs, ...W.items]) if (dedans(q.x, q.y) && touche(avant, q.x, q.y)) cibles.push([q.x, q.y]);
  const tient = (bloque, plus = []) => { const vu = parcours(bloque); return [...cibles, ...plus].every(([x, y]) => touche(vu, x, y)); };
  // la porte : au nord de la clairière, la crypte adossée aux arbres ; dans l'axe de la stèle si ça ne coupe aucun sentier,
  // sinon un peu à côté
  const occupe = (x, y) => W.deco.some((d) => d.x === x && d.y === y) || W.warpAt(x, y) || W.npcs.some((n) => n.x === x && n.y === y) || W.items.some((q) => q.x === x && q.y === y);
  let pos = null;
  for (const dx of [0, -3, 3, -5, 5, -7, 7, -9, 9]) {
    const X = st.x + dx; let Y = st.y - 1;
    if (!herbe(X, Y)) continue;
    while (herbe(X, Y - 1) && st.y - Y < 10) Y--;
    const bloque = new Set();
    for (let y = Y - 3; y < Y; y++) for (let x = X - 2; x <= X + 2; x++) bloque.add(x + ',' + y);
    if ([...bloque].some((k) => occupe(...k.split(',').map(Number)))) continue;
    if (tient(bloque, [[X, Y]])) { pos = [X, Y]; break; }
  }
  if (!pos) throw new Error('Crypte des Murmures : pas de place pour la porte sans couper la clairière');
  const [X, Y] = pos;
  const b = W.building('cave', X - 2, Y - 3, { name: 'Crypte des Murmures' });
  cibles.push([b.doorX, b.doorY + 1]);
  const atteint = () => tient(new Set());
  if (!atteint()) throw new Error('Crypte des Murmures : la porte n\'est pas atteignable');
  // un élément du décor, seulement s'il ne coupe rien
  const poser = (k, x, y) => {
    if (!herbe(x, y) || W.deco.some((d) => d.x === x && d.y === y) || W.warpAt(x, y) || cibles.some(([a, c]) => a === x && c === y)) return false;
    const avant = W.get(x, y);
    W.prop(k, x, y);
    if (atteint()) return true;
    W.deco = W.deco.filter((d) => !(d.x === x && d.y === y)); W.under.delete(x + ',' + y); W.set(x, y, avant); return false;
  };
  // l'allée, de la porte à la stèle
  for (let y = b.doorY + 1; y < st.y; y++) if (herbe(X, y)) W.set(X, y, T.PATH);
  poser('gargouille', b.x - 1, b.doorY); poser('gargouille', b.x + b.w, b.doorY);
  for (const dx of [-1, 1]) { poser('lanterne', X + dx, b.doorY + 1); poser('lanterne', X + dx, st.y - 1); }
  // des rangées de stèles de part et d'autre de l'allée, et des arbres morts au bord
  let n = 0;
  for (let y = b.doorY + 2; y <= z.y1 - 2; y += 3) for (const dx of [-6, -4, 4, 6]) if (Math.abs(y - st.y) > 2 || Math.abs(dx) > 4) n += poser('stele', X + dx, y) ? 1 : 0;
  for (const [dx, dy] of [[-8, 1], [8, 1], [-8, 8], [8, 8], [-5, 12], [5, 12]]) poser('deadtree', X + dx, st.y + dy);
  // la crypte, reliée à la porte ; le panneau d'entrée à côté
  const m = construireCarte(CRYPTE), P = m.donjon.plan;
  maps[m.id] = m;
  W.warp(b.doorX, b.doorY, { map: m.id, x: P.depart[0], y: P.depart[1], dir: 'up' });
  const [sx, sy] = P.sortie;
  m.set(sx, sy, T.CAVEDOOR);
  m.warp(sx, sy, { map: W.id, x: b.doorX, y: b.doorY + 1, dir: 'down' });
  m.deco.push({ k: 'exitlight', x: sx, y: sy });
  m.outside = { map: W.id, x: b.doorX, y: b.doorY + 1 };
  for (const [dx, dy] of [[2, 1], [-2, 1], [2, 2], [-2, 2]]) {
    const x = X + dx, y = b.doorY + dy;
    if (!herbe(x, y) || W.deco.some((d) => d.x === x && d.y === y)) continue;
    W.sign(x, y, textePanneau(CRYPTE));
    if (atteint()) break;
    W.deco = W.deco.filter((d) => !(d.x === x && d.y === y)); W.signs.delete(x + ',' + y); W.set(x, y, W.under.get(x + ',' + y) ?? T.GRASS); W.under.delete(x + ',' + y);
  }
  m.donjon.exterieur = { carte: W, porte: [b.doorX, b.doorY] };
  W.zone(z.x0, z.y0, z.x1, z.y1, { name: 'Cimetière des Murmures', music: 'mystic', route: z.route, enc: z.enc, theme: z.theme, prio: 1 });
  return { porte: [b.doorX, b.doorY], steles: n };
}
