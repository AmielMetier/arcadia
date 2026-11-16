// odyssee/js/data/cts.js — les CT d'Odyssée. Une CT ne s'use pas : on l'apprend à autant de Pokémon qu'on veut
// (game.utiliserCT). Qui peut l'apprendre : core/mon.js apteCT (les Pokémon de son type, ceux qui apprennent déjà une
// attaque de ce type en montant de niveau, ou tout le monde pour les CT marquées `tous`).
//   - CT01 à CT15 : données par les quinze Champions, une par badge, du type de leur arène ;
//   - CT16 et suivantes : posées dans le monde (world/cts.js remplace une Poké Ball ordinaire par CT, au rang voulu :
//     `rang` = nombre de badges qu'il faut pour atteindre l'endroit).
// Ne jamais renuméroter : les sauvegardes gardent les CT par identifiant (« ct-07 »).

/** [n°, attaque (clé de data/moves.js), badge du Champion qui la donne | null, rang minimal si elle est posée, options] */
const LISTE = [
  [1, 'struggle-bug', 0, null],   // (CT01 Pollen Collant reste l'attaque propre à Odyssée : voir core/items.js)
  [2, 'water-pulse', 1], [3, 'shock-wave', 2], [4, 'giga-drain', 3], [5, 'psychic', 4], [6, 'rock-slide', 5],
  [7, 'flamethrower', 6], [8, 'dragon-claw', 7], [9, 'facade', 8, null, { tous: true }], [10, 'air-slash', 9],
  [11, 'sludge-bomb', 10], [12, 'earthquake', 11], [13, 'flash-cannon', 12], [14, 'moonblast', 13], [15, 'dark-pulse', 14],
  [16, 'false-swipe', null, 0, { tous: true }], [17, 'struggle-bug', null, 0], [18, 'aerial-ace', null, 1], [19, 'rock-tomb', null, 1],
  [20, 'flame-charge', null, 1], [21, 'bullet-seed', null, 1], [22, 'return', null, 1, { tous: true }], [23, 'protect', null, 2, { tous: true }],
  [24, 'brick-break', null, 2], [25, 'icy-wind', null, 2], [26, 'charge-beam', null, 2], [27, 'bulldoze', null, 2],
  [28, 'reflect', null, 2], [29, 'light-screen', null, 2], [30, 'thunder-wave', null, 2], [31, 'rest', null, 3, { tous: true }],
  [32, 'will-o-wisp', null, 3], [33, 'x-scissor', null, 3], [34, 'poison-jab', null, 3], [35, 'dig', null, 3],
  [36, 'hidden-power', null, 3, { tous: true }], [37, 'toxic', null, 4], [38, 'shadow-ball', null, 4], [39, 'energy-ball', null, 4],
  [40, 'swords-dance', null, 4], [41, 'bulk-up', null, 4], [42, 'calm-mind', null, 4], [43, 'thunderbolt', null, 5],
  [44, 'ice-beam', null, 5], [45, 'iron-head', null, 5], [46, 'scald', null, 5], [47, 'drain-punch', null, 5],
  [48, 'crunch', null, 6], [49, 'dragon-pulse', null, 6], [50, 'nasty-plot', null, 7], [51, 'dragon-dance', null, 8],
  [52, 'stone-edge', null, 8], [53, 'earth-power', null, 8], [54, 'focus-blast', null, 9], [55, 'hyper-beam', null, 9, { tous: true }],
  [56, 'giga-impact', null, 9, { tous: true }], [57, 'fire-blast', null, 10], [58, 'blizzard', null, 10], [59, 'thunder', null, 10],
  [60, 'solar-beam', null, 5], [61, 'roar', null, 2, { tous: true }], [62, 'safeguard', null, 3, { tous: true }],
];

const nn = (n) => String(n).padStart(2, '0');
/** les CT : { 'ct-02': { n: 2, move: 'water-pulse', badge: 1, rang: null, tous: false }, … } (CT01 à part) */
export const CTS = Object.fromEntries(LISTE.filter(([n]) => n > 1).map(([n, move, badge, rang, o = {}]) =>
  ['ct-' + nn(n), { n, move, badge: badge ?? null, rang: rang ?? null, tous: !!o.tous }]));
/** la CT que donne le Champion du badge g (0 : CT01 Pollen Collant) */
export const CT_DU_BADGE = Object.fromEntries([[0, 'ct-01'], ...Object.entries(CTS).filter(([, c]) => c.badge != null).map(([k, c]) => [c.badge, k])]);
/** les CT posées dans le monde, du plus tôt au plus tard */
export const CTS_POSEES = Object.entries(CTS).filter(([, c]) => c.rang != null).sort((a, b) => a[1].rang - b[1].rang || a[1].n - b[1].n).map(([k]) => k);
