// Birdie Party — les clubs et les trajectoires. Distances en mètres : `dist` est la distance totale d'un coup
// plein sur un fairway plat, sans vent (vol + roulement) ; `carry` la part en vol. Les angles sont en degrés.
// lift : portance due à l'effet rétro (les wedges montent et retombent à pic), bite : freinage au premier rebond.
export const CLUBS = [
  { id: 'dr', name: 'Driver', short: '1W', dist: 230, carry: 0.89, loft: 11, lift: 0.0030, bite: 0, teeOnly: true },
  { id: 'w3', name: 'Bois 3', short: '3W', dist: 205, carry: 0.89, loft: 14, lift: 0.0031, bite: 0.05 },
  { id: 'i5', name: 'Fer 5', short: '5F', dist: 170, carry: 0.88, loft: 19, lift: 0.0032, bite: 0.15 },
  { id: 'i7', name: 'Fer 7', short: '7F', dist: 145, carry: 0.88, loft: 25, lift: 0.0033, bite: 0.25 },
  { id: 'i9', name: 'Fer 9', short: '9F', dist: 120, carry: 0.89, loft: 32, lift: 0.0034, bite: 0.4 },
  { id: 'pw', name: 'Pitching wedge', short: 'PW', dist: 100, carry: 0.89, loft: 39, lift: 0.0035, bite: 0.55 },
  { id: 'sw', name: 'Sand wedge', short: 'SW', dist: 75, carry: 0.89, loft: 47, lift: 0.0034, bite: 0.7, sand: true },
  { id: 'pt', name: 'Putter', short: 'PT', dist: 20, putter: true },
];
export const PUTTER = CLUBS.length - 1;

// Hauteur du coup : basse (vole sous le vent, roule plus), normale, haute (passe au-dessus des obstacles, s'arrête vite)
export const TRAJ = {
  low: { label: 'Basse', dLoft: -5, dist: 0.95 },
  mid: { label: 'Normale', dLoft: 0, dist: 1 },
  high: { label: 'Haute', dLoft: 6, dist: 0.93 },
};
export const TRAJ_KEYS = ['low', 'mid', 'high'];

// Effet de la position de la balle sur la distance et la précision (spread : dispersion latérale ajoutée)
export const LIE = {
  tee: { label: 'Départ', dist: 1, spread: 0 },
  fairway: { label: 'Fairway', dist: 1, spread: 0 },
  fringe: { label: 'Avant-green', dist: 0.97, spread: 0 },
  green: { label: 'Green', dist: 1, spread: 0 },
  rough: { label: 'Rough', dist: 0.8, spread: 0.18 },
  bunker: { label: 'Bunker', dist: 0.5, spread: 0.3, sandWedge: 0.85 },
  beach: { label: 'Plage', dist: 0.55, spread: 0.28, sandWedge: 0.85 },
  desert: { label: 'Sable dur', dist: 0.86, spread: 0.12 },
};

// Portée du putter : elle s'adapte à la distance du trou pour garder une jauge précise sur les petits putts
export function putterRange(distToPin) {
  return Math.max(4, Math.min(30, Math.round(distToPin * 1.3 + 2)));
}

// Coefficient de distance de la position (le sand wedge sort bien mieux du sable)
export function lieFactor(lie, club) {
  const L = LIE[lie] || LIE.rough;
  if ((lie === 'bunker' || lie === 'beach') && CLUBS[club].sand) return L.sandWedge;
  return L.dist;
}
