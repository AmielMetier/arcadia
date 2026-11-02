// Vitrine de l'atelier graphique (odyssee/?vitrine) : une ville de test avec chaque kit de façade, chaque taille de
// bâtiment et chaque objet du décor, pour voir les dessins en place, à l'échelle et à la lumière du jeu.
import { GameMap } from '../world/mapgen.js';
import { T } from '../world/tiles.js';
import { SPRITES } from '../data/sprites.js';
import { REGLES } from '../data/regles.js';

export function buildVitrine() {
  const W = 60, H = 50;
  const m = new GameMap('vitrine', W, H, { name: 'Vitrine de l’atelier', fill: T.GRASS, music: 'town' });
  m.rect(0, 0, W - 1, 0, T.TREE); m.rect(0, H - 1, W - 1, H - 1, T.TREE); m.rect(0, 0, 0, H - 1, T.TREE); m.rect(W - 1, 0, W - 1, H - 1, T.TREE);
  m.zone(0, 0, W - 1, H - 1, { name: 'Vitrine de l’atelier', music: 'town' });
  const rangee = (y, list) => {
    let x = 3, d = 0;
    for (const [kind, o] of list) {
      const b = m.building(kind, x, y, o); x += b.w + 2; d = Math.max(d, b.d);
    }
    // trottoir devant la rangée
    m.rect(1, y + d, W - 2, y + d + 1, T.PAVE, [T.GRASS]);
    return y + d + 6;
  };
  let y = 2;
  // personnages principaux, dans les quatre directions (le joueur démarre en 9, 6)
  ['down', 'left', 'right', 'up'].forEach((dir, i) => m.npc({ id: 'vitrine:theo' + i, x: 12 + i, y: 6, sprite: 'theo', dir, text: ['Théo.'] }));
  y = rangee(y, [['house', { roof: 'red', label: 'Maison' }], ['house2', { roof: 'blue', label: 'Maison large' }], ['bighouse', { roof: 'green', label: 'Grande maison' }],
    ['tower', { roof: 'brown', label: 'Tour' }], ['house', { kit: 'chalet', label: 'Chalet' }], ['house', { kit: 'pecheur', label: 'Pêcheur' }], ['house2', { kit: 'port', label: 'Capitainerie' }]]);
  y = rangee(y, [['center', {}], ['mart', {}], ['gym', {}], ['lab', {}], ['league', {}]]);
  y = rangee(y, [['bighouse', { kit: 'musee', label: 'Musée' }], ['bighouse', { kit: 'base', label: 'Base' }], ['house2', { kit: 'mirage', label: 'Tour Mirage' }],
    ['tower', { kit: 'phare', label: 'Phare' }], ['tower', { kit: 'pagode', label: 'Pagode' }], ['house', { roof: 'purple' }], ['house', { roof: 'orange' }], ['house', { roof: 'teal' }]]);
  // objets du décor, chacun sur ses cases, rangés par largeur
  let x = 3;
  for (const k of Object.keys(SPRITES.deco || {})) {
    const c = REGLES.deco[k]?.cases || 1;
    if (x + c > W - 3) { x = 3; y += 4; }
    m.prop(k, x, y, true, c > 1 ? { w: c } : {});
    for (let i = 1; i < c; i++) { m.under.set(`${x + i},${y}`, T.GRASS); m.set(x + i, y, T.BLOCK); }
    x += c + 1;
  }
  y += 3;
  x = 3;
  for (const k of ['tree', 'pine', 'bush', 'rock', 'sign', 'lamp', 'mailbox', 'statue', 'flowers_r']) { if (SPRITES.nature?.[k]) m.prop(k, x, y); x += 2; }
  return m;
}
