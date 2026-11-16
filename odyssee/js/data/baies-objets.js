// odyssee/js/data/baies-objets.js — les baies et objets tenus ajoutés en 5.95 (effets : core/battle.js).
// Icônes : img/pokeapi/items/<clé>.png (copiées du dépôt PokeAPI/sprites).

/** baies qui soignent une altération : [clé, nom, altération] */
export const BAIES_SOIN = [
  ['cheri-berry', 'Baie Ceriz', 'par'], ['chesto-berry', 'Baie Maron', 'slp'], ['pecha-berry', 'Baie Pêcha', 'psn'],
  ['rawst-berry', 'Baie Fraive', 'brn'], ['aspear-berry', 'Baie Willia', 'frz'], ['persim-berry', 'Baie Kika', 'conf'],
];
/** baies de résistance : divisent par deux une attaque super efficace de ce type (Baie Zalis : toute attaque Normal) */
export const BAIES_RESIST = [
  ['occa-berry', 'Baie Chocco', 'fire'], ['passho-berry', 'Baie Pocpoc', 'water'], ['wacan-berry', 'Baie Parma', 'electric'],
  ['rindo-berry', 'Baie Ratam', 'grass'], ['yache-berry', 'Baie Nanone', 'ice'], ['chople-berry', 'Baie Pomroz', 'fighting'],
  ['kebia-berry', 'Baie Kebia', 'poison'], ['shuca-berry', 'Baie Jouca', 'ground'], ['coba-berry', 'Baie Cobaba', 'flying'],
  ['payapa-berry', 'Baie Yapap', 'psychic'], ['tanga-berry', 'Baie Panga', 'bug'], ['charti-berry', 'Baie Charti', 'rock'],
  ['kasib-berry', 'Baie Sedra', 'ghost'], ['haban-berry', 'Baie Fraigo', 'dragon'], ['colbur-berry', 'Baie Lampou', 'dark'],
  ['babiri-berry', 'Baie Babiri', 'steel'], ['chilan-berry', 'Baie Zalis', 'normal'], ['roseli-berry', 'Baie Selro', 'fairy'],
];
/** baies de dernier recours : un cran de stat sous le quart des PV (indice de stat du moteur : 2 Atq, 3 Déf, 4 Atq. Spé., 5 Déf. Spé., 6 Vit.) */
export const BAIES_STAT = [
  ['liechi-berry', 'Baie Lichii', 2], ['ganlon-berry', 'Baie Lingan', 3], ['petaya-berry', 'Baie Pitaye', 4],
  ['apicot-berry', 'Baie Abriko', 5], ['salac-berry', 'Baie Sailak', 6],
];
const TY = { normal: 'Normal', fighting: 'Combat', flying: 'Vol', poison: 'Poison', ground: 'Sol', rock: 'Roche', bug: 'Insecte', ghost: 'Spectre', steel: 'Acier', fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Électrik', psychic: 'Psy', ice: 'Glace', dragon: 'Dragon', dark: 'Ténèbres', fairy: 'Fée' };
const ALT = { par: 'la paralysie', slp: 'le sommeil', psn: 'l\'empoisonnement', brn: 'la brûlure', frz: 'le gel', conf: 'la confusion' };
const STAT = { 2: 'l\'Attaque', 3: 'la Défense', 4: 'l\'Attaque Spéciale', 5: 'la Défense Spéciale', 6: 'la Vitesse' };

/** les objets à ajouter à core/items.js */
export const NOUVEAUX_OBJETS = {
  ...Object.fromEntries(BAIES_SOIN.map(([k, n, a]) => [k, { pocket: 'baies', price: 200, hold: k, cure: a === 'conf' ? undefined : a === 'psn' ? ['psn', 'tox'] : [a], name: n, desc: `Objet à tenir. Guérit ${ALT[a]} dès qu'elle survient.` }])),
  ...Object.fromEntries(BAIES_RESIST.map(([k, n, t]) => [k, { pocket: 'baies', price: 1000, hold: k, name: n, desc: t === 'normal'
    ? 'Objet à tenir. Divise par deux les dégâts d\'une attaque Normal, une fois.'
    : `Objet à tenir. Divise par deux les dégâts d'une attaque ${TY[t]} super efficace, une fois.` }])),
  ...Object.fromEntries(BAIES_STAT.map(([k, n, s]) => [k, { pocket: 'baies', price: 1500, hold: k, name: n, desc: `Objet à tenir. Monte ${STAT[s]} d'un cran quand les PV passent sous le quart.` }])),
  'assault-vest': { pocket: 'objets', price: 6000, hold: 'assault-vest', name: 'Veste de Combat', desc: 'Objet à tenir. Augmente la Déf. Spé. de 50 %, mais empêche d\'utiliser des attaques de statut.' },
  'expert-belt': { pocket: 'objets', price: 4000, hold: 'expert-belt', name: 'Ceinture Pro', desc: 'Objet à tenir. Augmente de 20 % les dégâts des attaques super efficaces.' },
  'muscle-band': { pocket: 'objets', price: 3000, hold: 'muscle-band', name: 'Bandeau Muscle', desc: 'Objet à tenir. Augmente de 10 % la puissance des attaques physiques.' },
  'wise-glasses': { pocket: 'objets', price: 3000, hold: 'wise-glasses', name: 'Lunettes Sages', desc: 'Objet à tenir. Augmente de 10 % la puissance des attaques spéciales.' },
  'quick-claw': { pocket: 'objets', price: 3000, hold: 'quick-claw', name: 'Vive Griffe', desc: 'Objet à tenir. Permet parfois (une fois sur cinq) d\'attaquer en premier.' },
  'scope-lens': { pocket: 'objets', price: 3000, hold: 'scope-lens', name: 'Lentilscope', desc: 'Objet à tenir. Augmente le taux de coups critiques.' },
  'big-root': { pocket: 'objets', price: 2500, hold: 'big-root', name: 'Grosse Racine', desc: 'Objet à tenir. Les attaques qui drainent rendent 30 % de PV en plus.' },
  'kings-rock': { pocket: 'objets', price: 3000, hold: 'kings-rock', name: 'Roche Royale', desc: 'Objet à tenir. Une attaque qui touche peut parfois apeurer la cible.' },
  'white-herb': { pocket: 'objets', price: 2000, hold: 'white-herb', name: 'Herbe Blanche', desc: 'Objet à tenir. Annule une fois les baisses de stats du porteur.' },
  'black-sludge': { pocket: 'objets', price: 4000, hold: 'black-sludge', name: 'Boue Noire', desc: 'Objet à tenir. Soigne un Pokémon Poison de 1/16 de ses PV à chaque tour ; blesse les autres.' },
  'shell-bell': { pocket: 'objets', price: 4000, hold: 'shell-bell', name: 'Grelot Coque', desc: 'Objet à tenir. Rend au porteur 1/8 des dégâts qu\'il inflige.' },
  'spell-tag': { pocket: 'objets', price: 2000, hold: 'spell-tag', name: 'Rune Sort', desc: 'Objet à tenir. Augmente de 20 % la puissance des attaques de type Spectre.' },
  'fairy-feather': { pocket: 'objets', price: 2000, hold: 'fairy-feather', name: 'Plume Fée', desc: 'Objet à tenir. Augmente de 20 % la puissance des attaques de type Fée.' },
};
export const RESIST = Object.fromEntries(BAIES_RESIST.map(([k, , t]) => [k, t]));
export const SOIN = Object.fromEntries(BAIES_SOIN.map(([k, , a]) => [k, a]));
export const STAT_BAIE = Object.fromEntries(BAIES_STAT.map(([k, , s]) => [k, s]));
