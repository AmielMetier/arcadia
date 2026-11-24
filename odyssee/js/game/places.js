// odyssee/js/game/places.js — cases libres et vraiment accessibles à pied autour du joueur (failles, météorites)
import { walkable, isGrassEnc, T } from '../world/tiles.js';

const BARREES = new Set([
  T.DOOR, T.MAT, T.CAVEDOOR, T.WATER, T.LEDGE, T.LEDGE_E, T.LEDGE_W, T.CUT, T.SMASH, T.BOULDER,
]);

/** Cases à une distance (à vol d'oiseau) de min à max du joueur, où il peut aller à pied depuis l'endroit où il est :
 *  ni de l'autre côté d'un mur, ni derrière un garde, un arbre à couper ou un bras de mer, ni sur quelqu'un ou dans les hautes herbes. */
export function casesAccessibles(game, min, max) {
  const m = game.mapObj, p = game.player;
  if (!m || m.id !== 'monde' || !p) return [];
  const k = (x, y) => x + ',' + y;
  const prises = new Set();
  for (const L of [game.npcs, game.items, game.legends, game.celestial?.meteors]) {
    for (const o of L || []) if (o && Math.abs(o.x - p.x) <= max + 1 && Math.abs(o.y - p.y) <= max + 1) prises.add(k(o.x, o.y));
  }
  if (game.fol) prises.add(k(game.fol.x, game.fol.y));
  if (game.rifts?.active) prises.add(k(game.rifts.active.x, game.rifts.active.y));
  const h = (x, y) => (m.height ? m.height(x, y) : 0);
  const vu = new Set([k(p.x, p.y)]), out = [];
  let front = [[p.x, p.y]];
  for (let pas = 0; pas < max * 2 && front.length; pas++) {
    const suite = [];
    for (const [cx, cy] of front) {
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const x = cx + dx, y = cy + dy, id = k(x, y), d = Math.abs(x - p.x) + Math.abs(y - p.y);
        if (d > max || vu.has(id)) continue;
        vu.add(id);
        if (!m.in(x, y)) continue;
        const t = m.get(x, y);
        if (!walkable(t) || BARREES.has(t) || game.gateBlock?.has?.(id) || Math.abs(h(x, y) - h(cx, cy)) > 1) continue;
        suite.push([x, y]);
        if (d >= min && !isGrassEnc(t) && !prises.has(id) && !game.raidMonde?.occupe?.(x, y)) out.push({ x, y });
      }
    }
    front = suite;
  }
  return out;
}

/** une de ces cases, au hasard (null s'il n'y en a pas) */
export function caseAccessible(game, min, max) {
  const c = casesAccessibles(game, min, max);
  return c.length ? c[Math.floor(Math.random() * c.length)] : null;
}
