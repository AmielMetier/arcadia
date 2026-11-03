// odyssee/js/data/abilities.js — Talents passifs des Pokémon d'Odyssée
// Système fidèle aux talents emblématiques de chaque espèce

export const ABILITIES = {
  // --- Talents des Starters & Types ---
  overgrow: {
    id: 'overgrow',
    name: 'Engrais',
    desc: 'Booste les attaques Plante de 50% quand les PV sont inférieurs à 1/3.',
  },
  blaze: {
    id: 'blaze',
    name: 'Brasier',
    desc: 'Booste les attaques Feu de 50% quand les PV sont inférieurs à 1/3.',
  },
  torrent: {
    id: 'torrent',
    name: 'Torrent',
    desc: 'Booste les attaques Eau de 50% quand les PV sont inférieurs à 1/3.',
  },
  swarm: {
    id: 'swarm',
    name: 'Essaim',
    desc: 'Booste les attaques Insecte de 50% quand les PV sont inférieurs à 1/3.',
  },

  // --- Talents d'entrée en combat ---
  intimidate: {
    id: 'intimidate',
    name: 'Intimidation',
    desc: 'Baisse l\'Attaque du Pokémon adverse d\'un cran à son entrée en combat.',
  },
  drizzle: {
    id: 'drizzle',
    name: 'Crachin',
    desc: 'Invoque une pluie battante dès l\'entrée sur le terrain.',
  },
  drought: {
    id: 'drought',
    name: 'Sécheresse',
    desc: 'Invoque un soleil éclatant et brûlant dès l\'entrée sur le terrain.',
  },
  'sand-stream': {
    id: 'sand-stream',
    name: 'Sable Volant',
    desc: 'Invoque une redoutable tempête de sable dès l\'entrée en jeu.',
  },
  'snow-warning': {
    id: 'snow-warning',
    name: 'Alerte Neige',
    desc: 'Déclenche une averse de grêle dès l\'entrée en jeu.',
  },
  pressure: {
    id: 'pressure',
    name: 'Pression',
    desc: 'Force l\'adversaire à dépenser le double de PP pour chaque attaque.',
  },

  // --- Immunités & Absorptions élémentaires ---
  levitate: {
    id: 'levitate',
    name: 'Lévitation',
    desc: 'Flotte dans les airs : immunité absolue aux capacités de type Sol.',
  },
  'water-absorb': {
    id: 'water-absorb',
    name: 'Absorb-Eau',
    desc: 'Immunité aux attaques Eau et régénère 25% de ses PV max.',
  },
  'volt-absorb': {
    id: 'volt-absorb',
    name: 'Absorb-Volt',
    desc: 'Immunité aux attaques Électrik et régénère 25% de ses PV max.',
  },
  'flash-fire': {
    id: 'flash-fire',
    name: 'Torche',
    desc: 'Immunité aux attaques Feu et renforce ses propres attaques de type Feu.',
  },
  'dry-skin': {
    id: 'dry-skin',
    name: 'Peau Sèche',
    desc: 'Régénère sous la pluie et par l\'eau, mais craint la chaleur et le soleil.',
  },

  // --- Défense & Résistance ---
  sturdy: {
    id: 'sturdy',
    name: 'Fermeté',
    desc: 'Ne peut pas être mis K.O. en un seul coup s\'il possède tous ses PV.',
  },
  'magic-guard': {
    id: 'magic-guard',
    name: 'Garde Magik',
    desc: 'Protège contre tous les dégâts indirects (poison, brûlure, tempête...).',
  },
  'thick-fat': {
    id: 'thick-fat',
    name: 'Isograisse',
    desc: 'Divise par deux les dégâts infligés par les attaques de type Feu et Glace.',
  },
  synchronize: {
    id: 'synchronize',
    name: 'Synchro',
    desc: 'Transmet immédiatement brûlure, paralysie ou poison à l\'attaquant.',
  },
  guts: {
    id: 'guts',
    name: 'Cran',
    desc: 'Augmente l\'Attaque de 50% si le Pokémon souffre d\'une altération d\'état.',
  },

  // --- Attaque & Spécial ---
  technician: {
    id: 'technician',
    name: 'Technicien',
    desc: 'Augmente de 50% la puissance des capacités ayant une puissance de 60 ou moins.',
  },
  'skill-link': {
    id: 'skill-link',
    name: 'Multi-Coups',
    desc: 'Les capacités frappant de 2 à 5 fois touchent toujours le maximum de 5 fois.',
  },
  'super-luck': {
    id: 'super-luck',
    name: 'Chanceux',
    desc: 'Augmente significativement le taux de coups critiques.',
  },
  adaptability: {
    id: 'adaptability',
    name: 'Adaptabilité',
    desc: 'Augmente le bonus de même type (STAB) à x2.0 au lieu de x1.5.',
  },

  // --- Effets au contact ---
  static: {
    id: 'static',
    name: 'Statik',
    desc: '30% de chances de paralyser tout assaillant entrant en contact direct.',
  },
  'flame-body': {
    id: 'flame-body',
    name: 'Corps Ardent',
    desc: '30% de chances de brûler tout assaillant entrant en contact direct.',
  },
  'poison-point': {
    id: 'poison-point',
    name: 'Point Poison',
    desc: '30% de chances d\'empoisonner tout assaillant entrant en contact direct.',
  },
  'rough-skin': {
    id: 'rough-skin',
    name: 'Peau Dure',
    desc: 'Blesse l\'attaquant d\'un huitième de ses PV lors d\'un contact physique.',
  },
  speedboost: {
    id: 'speedboost',
    name: 'Turbo',
    desc: 'Augmente la Vitesse du porteur d\'un cran à la fin de chaque tour.',
  },
  shadowtag: {
    id: 'shadowtag',
    name: 'Marque Ombre',
    desc: 'Empêche l\'adversaire de fuir ou de changer de Pokémon.',
  },
};

/** Table de correspondance espèce ID (ou clé espèce) -> Talent passif */
const SPECIES_ABILITIES = {
  // Gen 1
  1: 'overgrow', 2: 'overgrow', 3: 'overgrow', // Bulbizarre
  4: 'blaze', 5: 'blaze', 6: 'blaze',          // Salamèche
  7: 'torrent', 8: 'torrent', 9: 'torrent',    // Carapuce
  10: 'shield-dust', 11: 'shed-skin', 12: 'compound-eyes', // Chenipan
  13: 'shield-dust', 14: 'shed-skin', 15: 'swarm',         // Aspicot
  16: 'keen-eye', 17: 'keen-eye', 18: 'keen-eye',          // Roucool
  19: 'guts', 20: 'guts',                                  // Rattata
  21: 'keen-eye', 22: 'keen-eye',                          // Piafabec
  23: 'intimidate', 24: 'intimidate',                      // Abo / Arbok
  25: 'static', 26: 'static',                              // Pikachu / Raichu
  27: 'sand-veil', 28: 'sand-veil',                        // Sabelette
  29: 'poison-point', 30: 'poison-point', 31: 'poison-point', // NidoranF
  32: 'poison-point', 33: 'poison-point', 34: 'poison-point', // NidoranM
  35: 'magic-guard', 36: 'magic-guard',                    // Mélofée / Mélodelfe
  37: 'flash-fire', 38: 'flash-fire',                      // Goupix / Feunard
  39: 'cute-charm', 40: 'cute-charm',                      // Rondoudou
  41: 'inner-focus', 42: 'inner-focus',                    // Nosferapti / Nosferalto
  43: 'chlorophyll', 44: 'chlorophyll', 45: 'chlorophyll', // Mystherbe
  46: 'effect-spore', 47: 'dry-skin',                      // Paras / Parasect
  48: 'compound-eyes', 49: 'shield-dust',                  // Mimitoss / Aéromite
  50: 'sand-veil', 51: 'sand-veil',                        // Taupiqueur
  52: 'technician', 53: 'technician',                      // Miaouss / Persian
  54: 'damp', 55: 'cloud-nine',                            // Psykokwak
  56: 'vital-spirit', 57: 'vital-spirit',                  // Férosinge
  58: 'intimidate', 59: 'intimidate',                      // Caninos / Arcanin
  60: 'water-absorb', 61: 'water-absorb', 62: 'water-absorb', // Ptitard
  63: 'synchronize', 64: 'synchronize', 65: 'synchronize', // Abra / Kadabra / Alakazam
  66: 'guts', 67: 'guts', 68: 'guts',                      // Machoc / Machopeur / Mackogneur
  69: 'chlorophyll', 70: 'chlorophyll', 71: 'chlorophyll', // Chétiflor
  72: 'clear-body', 73: 'clear-body',                      // Tentacool
  74: 'rock-head', 75: 'sturdy', 76: 'sturdy',             // Racaillou / Gravalanch / Grolem
  77: 'flash-fire', 78: 'flash-fire',                      // Ponyta / Galopa
  79: 'oblivious', 80: 'own-tempo',                        // Ramoloss
  81: 'magnet-pull', 82: 'sturdy',                         // Magnéti
  83: 'keen-eye',                                          // Canarticho
  84: 'early-bird', 85: 'early-bird',                      // Doduo
  86: 'thick-fat', 87: 'thick-fat',                        // Otaria
  88: 'sticky-hold', 89: 'stench',                         // Tadmorv
  90: 'skill-link', 91: 'skill-link',                      // Kokiyas / Crustabri
  92: 'levitate', 93: 'levitate', 94: 'levitate',          // Fantominus / Spectrum / Ectoplasma
  95: 'rock-head', 96: 'forewarn', 97: 'forewarn',         // Onix / Soporifik
  98: 'hyper-cutter', 99: 'hyper-cutter',                  // Krabby
  100: 'soundproof', 101: 'static',                        // Voltorbe
  102: 'chlorophyll', 103: 'chlorophyll',                  // Noeunoeuf
  104: 'rock-head', 105: 'lightning-rod',                  // Osselait
  106: 'limber', 107: 'iron-fist',                         // Kicklee / Tygnon
  108: 'own-tempo',                                        // Excelangue
  109: 'levitate', 110: 'levitate',                        // Smogo / Smogogo
  111: 'lightning-rod', 112: 'solid-rock',                 // Rhinocorne / Rhinoféros
  113: 'natural-cure',                                     // Leveinard
  114: 'chlorophyll',                                      // Saquedeneu
  115: 'early-bird',                                       // Kangourex
  116: 'swift-swim', 117: 'sniper',                        // Hypotrempe
  118: 'swift-swim', 119: 'water-veil',                    // Poissirène
  120: 'natural-cure', 121: 'natural-cure',                // Stari / Staross
  122: 'soundproof',                                       // M. Mime
  123: 'technician',                                       // Insécateur
  124: 'oblivious',                                        // Lippoutou
  125: 'static',                                           // Élektek
  126: 'flame-body',                                       // Magmar
  127: 'hyper-cutter',                                     // Scarabrute
  128: 'intimidate',                                       // Tauros
  129: 'swift-swim', 130: 'intimidate',                    // Magicarpe / Léviator
  131: 'water-absorb',                                     // Lokhlass
  132: 'limber',                                           // Métamorph
  133: 'adaptability',                                     // Évoli
  134: 'water-absorb',                                     // Aquali
  135: 'volt-absorb',                                      // Voltali
  136: 'flash-fire',                                       // Pyroli
  137: 'trace',                                            // Porygon
  138: 'swift-swim', 139: 'swift-swim',                    // Amonita / Amonistar
  140: 'battle-armor', 141: 'swift-swim',                  // Kabuto / Kabutops
  142: 'rock-head',                                        // Ptéra
  143: 'thick-fat',                                        // Ronflex
  144: 'pressure',                                         // Artikodin
  145: 'pressure',                                         // Électhor
  146: 'flame-body',                                       // Sulfura
  147: 'shed-skin', 148: 'shed-skin', 149: 'multiscale',   // Minidraco / Draco / Dracolosse
  150: 'pressure', 151: 'synchronize',                     // Mewtwo / Mew

  // Gen 2
  152: 'overgrow', 153: 'overgrow', 154: 'overgrow',       // Germignon
  155: 'blaze', 156: 'blaze', 157: 'blaze',                // Héricendre
  158: 'torrent', 159: 'torrent', 160: 'torrent',          // Kaiminus
  169: 'inner-focus',                                      // Nostenfer
  196: 'synchronize', 197: 'synchronize',                  // Mentali / Noctali
  212: 'technician',                                       // Cizayox
  214: 'guts',                                             // Scarhino
  227: 'sturdy',                                           // Airmure
  248: 'sand-stream',                                      // Tyranocif
  249: 'pressure', 250: 'pressure',                        // Lugia / Ho-Oh

  // Gen 3
  252: 'overgrow', 254: 'overgrow',                        // Arcko
  255: 'blaze', 257: 'speedboost',                         // Poussifeu / Braségali
  258: 'torrent', 260: 'torrent',                          // Gobou / Laggron
  282: 'synchronize',                                      // Gardevoir
  304: 'sturdy', 306: 'sturdy',                            // Galekid / Galeking
  330: 'levitate',                                         // Libégon
  359: 'super-luck',                                       // Absol
  373: 'intimidate', 376: 'clear-body',                    // Drattak / Métalosse
  382: 'drizzle', 383: 'drought', 384: 'air-lock',         // Kyogre / Groudon / Rayquaza
  385: 'serene-grace',                                     // Jirachi

  // Gen 4 & 5
  448: 'steadfast',                                        // Lucario
  470: 'leaf-guard', 471: 'snow-cloak',                    // Phyllali / Givrali
  487: 'pressure', 491: 'bad-dreams',                      // Giratina / Darkrai
};

/**
 * Renvoie le talent actif d'un Pokémon
 */
export function getAbility(m) {
  if (!m) return null;
  if (m.ability && ABILITIES[m.ability]) return ABILITIES[m.ability];
  const key = SPECIES_ABILITIES[m.sp] || defaultAbilityFor(m.sp);
  return ABILITIES[key] || { id: 'inner-focus', name: 'Attention', desc: 'Immunité contre la peur.' };
}

/** Fallback logique selon le premier type de la créature */
function defaultAbilityFor(sp) {
  // Détermination par défaut selon les caractéristiques
  return 'inner-focus';
}

export function abilityName(key) {
  if (key && typeof key === 'object') return key.name || 'Aucun';
  return ABILITIES[key]?.name || key || 'Aucun';
}
