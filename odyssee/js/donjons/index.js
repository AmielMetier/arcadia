// odyssee/js/donjons/index.js — les donjons à plusieurs du jeu, et leur place dans le monde (appelé à la fin de buildWorld,
// une fois tout le reste posé) :
//   la Crypte des Murmures : le cimetière des Ruines Oubliées de la Route 2 (crypte.js) ;
//   le Sanctuaire des Trois Voies : la clairière aux ruines au nord de la Route 3, côté ouest ;
//   le Donjon des Miroirs : la clairière aux ruines au nord de la Route 3, côté est, dans les sapins enneigés.
// Rien de ce qui était là ne devient inatteignable : un bâtiment, un décor qui couperait un passage n'est pas posé.
import { T, walkable } from '../world/tiles.js';
import { construireCarte, construireSalles, relierExterieur } from './plan.js';
import CRYPTE, { poserCrypte } from './crypte.js';
import MIROIRS from './miroirs.js';
import VOIES from './voies.js';

export const DONJONS = [CRYPTE, MIROIRS, VOIES];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const k = (x, y) => x + ',' + y;

/** les cartes d'un donjon (une seule, ou une par salle), reliées à la porte posée dans le monde */
function lierAuMonde(W, maps, def, porte) {
  const cartes = def.plan ? [construireCarte(def)] : construireSalles(def);
  for (const c of cartes) maps[c.id] = c;
  def.cartes = cartes.map((c) => c.id);
  relierExterieur({ ...def, exterieur: () => ({ carte: W, porte }) }, cartes[0]);
  return cartes[0];
}

/**
 * pose l'entrée d'un donjon au fond (au nord) d'une clairière d'impasse d'une route (chemins.js : res.cotes) : le
 * bâtiment s'adosse aux arbres, sa porte dans l'axe de la stèle des ruines, ses marches dans la clairière ; puis le décor.
 * o : { route, kind, nom, music, theme, modele, w, d, door, decor: [[clé, dx, dy], …] (autour de la porte) }
 */
function poserDansClairiere(W, maps, routes, def, o) {
  const C = routes.find((r) => r.id === o.route)?.pts?.res?.cotes?.find((c) => c.kind === o.kind);
  if (!C) throw new Error(`${def.nom} : pas de clairière « ${o.kind} » sur la route ${o.route}`);
  const st = W.deco.find((d) => d.k === 'stele' && Math.abs(d.x - C.x) <= 1 && Math.abs(d.y - C.y) <= 3) || { x: C.x, y: C.y - 2 };
  const X = st.x, dedans = (x, y) => Math.abs(x - X) <= 16 && Math.abs(y - st.y) <= 16;
  const marche = (x, y, bloque, ouvre) => !bloque.has(k(x, y)) && (ouvre.has(k(x, y)) || walkable(W.get(x, y)));
  const atteint = (bloque, ouvre) => {
    const depart = [st.x, st.y + 1], vu = new Set([k(...depart)]), f = [depart];
    while (f.length) { const [x, y] = f.pop(); for (const [dx, dy] of N4) { const a = x + dx, b = y + dy; if (!vu.has(k(a, b)) && dedans(a, b) && marche(a, b, bloque, ouvre)) { vu.add(k(a, b)); f.push([a, b]); } } }
    return vu;
  };
  // ce qu'on doit toujours rejoindre : le bord de la zone (le sentier vers la route), les PNJ et objets de la clairière
  const avant = atteint(new Set(), new Set());
  const bords = [...avant].filter((q) => { const [x, y] = q.split(',').map(Number); return Math.abs(x - X) >= 15 || Math.abs(y - st.y) >= 15; });
  const pres = (L) => L.filter((p) => dedans(p.x, p.y) && (avant.has(k(p.x, p.y)) || N4.some(([dx, dy]) => avant.has(k(p.x + dx, p.y + dy))))).map((p) => [p.x, p.y]);
  const cibles = [...bords.map((q) => q.split(',').map(Number)), ...pres(W.npcs), ...pres(W.items)];
  const tient = (bloque, ouvre, plus = []) => { const vu = atteint(bloque, ouvre); return [...cibles, ...plus].every(([x, y]) => vu.has(k(x, y)) || N4.some(([dx, dy]) => vu.has(k(x + dx, y + dy)))); };
  // la plus haute case de la clairière dans l'axe de la stèle
  let top = st.y - 1; while (walkable(W.get(X, top - 1)) && st.y - top < 9) top--;
  const porteY = 4, d = o.d, w = o.w, x0 = X - o.door;
  let choix = null;
  for (let dy = 0; dy <= 4 && !choix; dy++) {
    const yd = top - 1 - dy, y0 = yd - porteY, bloque = new Set(), ouvre = new Set();
    // les marches (deux rangées sous la porte, trois cases de large) et l'allée jusqu'à la clairière restent praticables
    for (const [a, b] of [[-1, 1], [0, 1], [1, 1], [-1, 2], [0, 2], [1, 2]]) ouvre.add(k(X + a, yd + b));
    for (let y = yd + 1; y < top; y++) ouvre.add(k(X, y));
    for (let y = y0; y < y0 + d; y++) for (let x = x0; x < x0 + w; x++) if (!ouvre.has(k(x, y))) bloque.add(k(x, y));
    if (tient(bloque, ouvre, [[X, yd + 1]])) choix = { yd, y0, ouvre };
  }
  if (!choix) throw new Error(`${def.nom} : pas de place pour l'entrée sans couper la clairière`);
  for (const q of choix.ouvre) { const [x, y] = q.split(',').map(Number); if (!walkable(W.get(x, y)) || W.get(x, y) === T.TALL || W.get(x, y) === T.GRASS) W.set(x, y, T.PATH); }
  const b = W.building('gym', x0, choix.y0, { modele: o.modele, w, d, door: o.door, name: def.nom });
  for (let y = b.doorY + 1; y < st.y - 1; y++) if (W.get(X, y) === T.GRASS || W.get(X, y) === T.TALL) W.set(X, y, T.PATH);
  // le décor, seulement s'il ne coupe rien
  const plus = [[b.doorX, b.doorY + 1]];
  for (const [cle, dx, dy] of o.decor || []) {
    const x = X + dx, y = b.doorY + dy;
    if (!walkable(W.get(x, y)) || W.warpAt(x, y) || W.deco.some((q) => q.x === x && q.y === y) || cibles.some(([a, c]) => a === x && c === y)) continue;
    if (cle === 'FLOWER') { if (W.get(x, y) === T.GRASS) W.set(x, y, T.FLOWER); continue; }
    const bloque = new Set([k(x, y)]); for (const q of W.deco) if (dedans(q.x, q.y) && !walkable(W.get(q.x, q.y))) bloque.add(k(q.x, q.y));
    if (tient(bloque, new Set(), plus)) W.prop(cle, x, y);
  }
  const m = lierAuMonde(W, maps, def, [b.doorX, b.doorY]);
  if (!tient(new Set(), new Set(), plus)) throw new Error(`${def.nom} : la porte n'est pas atteignable`);
  const zr = W.zoneAt(X, st.y + 1);
  W.zone(X - 9, st.y - 14, X + 9, st.y + 6, { name: o.nom, music: o.music, theme: o.theme, route: zr?.route, enc: zr?.enc, prio: 1 });
  return { porte: [b.doorX, b.doorY], carte: m.id };
}

/** tous les donjons dans le monde (fin de buildWorld) */
export function poserDonjons(W, maps, routes) {
  const crypte = poserCrypte(W, maps);
  CRYPTE.cartes = [CRYPTE.carte];
  const voies = poserDansClairiere(W, maps, routes, VOIES, {
    route: 'r3', kind: 'ruines', nom: 'Clairière des Trois Voies', music: 'route', modele: 'voiesSanctuaire', w: 9, d: 7, door: 4,
    decor: [['lanterne', -4, 3], ['lanterne', 4, 3], ['lanterne', -4, 7], ['lanterne', 4, 7], ...[-6, -5, 5, 6].flatMap((dx) => [5, 6].map((dy) => ['FLOWER', dx, dy]))],
  });
  const miroirs = poserDansClairiere(W, maps, routes, MIROIRS, {
    route: 'r3e', kind: 'ruines', nom: 'Parvis des Miroirs', music: 'snow', theme: 'snow', modele: 'templeMiroirs', w: 11, d: 7, door: 5,
    decor: [['lanterne', -2, 3], ['lanterne', 2, 3], ['cristal', -5, 4], ['cristal', 5, 4], ['cristal', -5, 8], ['cristal', 5, 8], ['snowpine', -7, 1], ['snowpine', 7, 1], ['snowpine', -8, 6], ['snowpine', 8, 6]],
  });
  return { crypte, voies, miroirs };
}
