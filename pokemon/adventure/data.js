// pokemon/adventure/data.js
// Données complètes du Mode Aventure Kalos-Sud (Menton) :
// 30 espèces avec chaînes d'évolution, apprentissage d'attaques par niveau,
// dresseurs PNJ, Championne d'Arène, Boutique Pokémon et formules officielles.

import { MOVES } from '../engine/moves.js';

export { MOVES };

export function spriteUrls(pokemonId) {
  return {
    front: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokemonId}.gif`,
    back: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${pokemonId}.gif`,
    icon: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
    artwork: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
  };
}

export const STARTER_OPTIONS = [
  { id: 1, name: 'Bulbizarre', region: 'Kanto', type: 'grass', types: ['grass', 'poison'], desc: 'Pokémon Graine. Équilibré et robuste avec son bulbe.' },
  { id: 4, name: 'Salamèche', region: 'Kanto', type: 'fire', types: ['fire'], desc: 'Pokémon Lézard. Vif et offensif, la flamme au bout de sa queue ne s\'éteint jamais.' },
  { id: 7, name: 'Carapuce', region: 'Kanto', type: 'water', types: ['water'], desc: 'Pokémon Minitortue. Excellente défense et attaques aquatiques percutantes.' },
  { id: 650, name: 'Marisson', region: 'Kalos', type: 'grass', types: ['grass'], desc: 'Pokémon Bogue. Natif de Kalos, son armure de piquants est redoutable.' },
  { id: 653, name: 'Feunnec', region: 'Kalos', type: 'fire', types: ['fire'], desc: 'Pokémon Renard. Natif de Kalos, il projette de l\'air brûlant par ses oreilles.' },
  { id: 656, name: 'Grenousse', region: 'Kalos', type: 'water', types: ['water'], desc: 'Pokémon Crapaudmousse. Natif de Kalos, agile et bondissant sur l\'eau.' },
];

export const BASE_SPECIES = {
  // --- STARTERS KANTO & ÉVOLUTIONS ---
  1: {
    id: 1, name: 'Bulbizarre', types: ['grass', 'poison'],
    baseStats: { hp: 45, atk: 49, def: 49, spa: 65, spd: 65, spe: 45 },
    catchRate: 45, baseExp: 64,
    defaultMoves: ['tackle', 'growl', 'vine_whip'],
    learnset: { 7: 'razor_leaf', 10: 'sludge_bomb', 13: 'giga_drain' },
    evolvesTo: { level: 9, id: 2 }
  },
  2: {
    id: 2, name: 'Herbizarre', types: ['grass', 'poison'],
    baseStats: { hp: 60, atk: 62, def: 63, spa: 80, spd: 80, spe: 60 },
    catchRate: 45, baseExp: 142,
    defaultMoves: ['tackle', 'vine_whip', 'razor_leaf', 'sludge_bomb'],
    learnset: { 12: 'giga_drain', 15: 'energy_ball' },
    evolvesTo: { level: 15, id: 3 }
  },
  3: {
    id: 3, name: 'Florizarre', types: ['grass', 'poison'],
    baseStats: { hp: 80, atk: 82, def: 83, spa: 100, spd: 100, spe: 80 },
    catchRate: 45, baseExp: 236,
    defaultMoves: ['razor_leaf', 'sludge_bomb', 'giga_drain', 'energy_ball'],
    learnset: { 18: 'solar_beam', 20: 'earth_power' }
  },

  4: {
    id: 4, name: 'Salamèche', types: ['fire'],
    baseStats: { hp: 39, atk: 52, def: 43, spa: 60, spd: 50, spe: 65 },
    catchRate: 45, baseExp: 62,
    defaultMoves: ['scratch', 'growl', 'ember'],
    learnset: { 7: 'flame_wheel', 10: 'slash', 13: 'flamethrower' },
    evolvesTo: { level: 9, id: 5 }
  },
  5: {
    id: 5, name: 'Reptincel', types: ['fire'],
    baseStats: { hp: 58, atk: 64, def: 58, spa: 80, spd: 65, spe: 80 },
    catchRate: 45, baseExp: 142,
    defaultMoves: ['scratch', 'ember', 'flame_wheel', 'slash'],
    learnset: { 12: 'flamethrower', 15: 'dragon_claw' },
    evolvesTo: { level: 15, id: 6 }
  },
  6: {
    id: 6, name: 'Dracaufeu', types: ['fire', 'flying'],
    baseStats: { hp: 78, atk: 84, def: 78, spa: 109, spd: 85, spe: 100 },
    catchRate: 45, baseExp: 240,
    defaultMoves: ['flamethrower', 'air_slash', 'dragon_claw', 'slash'],
    learnset: { 18: 'fire_blast', 20: 'flare_blitz' }
  },

  7: {
    id: 7, name: 'Carapuce', types: ['water'],
    baseStats: { hp: 44, atk: 48, def: 65, spa: 50, spd: 64, spe: 43 },
    catchRate: 45, baseExp: 63,
    defaultMoves: ['tackle', 'tail_whip', 'water_gun'],
    learnset: { 7: 'bite', 10: 'water_pulse', 13: 'aqua_jet' },
    evolvesTo: { level: 9, id: 8 }
  },
  8: {
    id: 8, name: 'Carabaffe', types: ['water'],
    baseStats: { hp: 59, atk: 63, def: 80, spa: 65, spd: 80, spe: 58 },
    catchRate: 45, baseExp: 142,
    defaultMoves: ['water_gun', 'bite', 'water_pulse', 'aqua_jet'],
    learnset: { 12: 'surf', 15: 'ice_beam' },
    evolvesTo: { level: 15, id: 9 }
  },
  9: {
    id: 9, name: 'Tortank', types: ['water'],
    baseStats: { hp: 79, atk: 83, def: 100, spa: 85, spd: 105, spe: 78 },
    catchRate: 45, baseExp: 239,
    defaultMoves: ['surf', 'ice_beam', 'flash_cannon', 'bite'],
    learnset: { 18: 'hydro_pump' }
  },

  // --- STARTERS KALOS & ÉVOLUTIONS ---
  650: {
    id: 650, name: 'Marisson', types: ['grass'],
    baseStats: { hp: 56, atk: 61, def: 65, spa: 48, spd: 45, spe: 38 },
    catchRate: 45, baseExp: 63,
    defaultMoves: ['tackle', 'growl', 'vine_whip'],
    learnset: { 7: 'bite', 10: 'seed_bomb', 13: 'bulldoze' },
    evolvesTo: { level: 9, id: 651 }
  },
  651: {
    id: 651, name: 'Boguérisse', types: ['grass'],
    baseStats: { hp: 61, atk: 78, def: 95, spa: 56, spd: 58, spe: 57 },
    catchRate: 45, baseExp: 142,
    defaultMoves: ['vine_whip', 'bite', 'seed_bomb', 'bulldoze'],
    learnset: { 12: 'drain_punch', 15: 'leaf_blade' },
    evolvesTo: { level: 15, id: 652 }
  },
  652: {
    id: 652, name: 'Blindépique', types: ['grass', 'fighting'],
    baseStats: { hp: 88, atk: 107, def: 122, spa: 74, spd: 75, spe: 64 },
    catchRate: 45, baseExp: 239,
    defaultMoves: ['seed_bomb', 'drain_punch', 'earthquake', 'bite'],
    learnset: { 18: 'close_combat' }
  },

  653: {
    id: 653, name: 'Feunnec', types: ['fire'],
    baseStats: { hp: 40, atk: 45, def: 40, spa: 62, spd: 60, spe: 60 },
    catchRate: 45, baseExp: 61,
    defaultMoves: ['scratch', 'tail_whip', 'ember'],
    learnset: { 7: 'psybeam', 10: 'flame_wheel', 13: 'flamethrower' },
    evolvesTo: { level: 9, id: 654 }
  },
  654: {
    id: 654, name: 'Roussil', types: ['fire'],
    baseStats: { hp: 59, atk: 59, def: 58, spa: 90, spd: 70, spe: 73 },
    catchRate: 45, baseExp: 143,
    defaultMoves: ['ember', 'psybeam', 'flame_wheel', 'tail_whip'],
    learnset: { 12: 'flamethrower', 15: 'psychic' },
    evolvesTo: { level: 15, id: 655 }
  },
  655: {
    id: 655, name: 'Goupelin', types: ['fire', 'psychic'],
    baseStats: { hp: 75, atk: 69, def: 72, spa: 114, spd: 100, spe: 104 },
    catchRate: 45, baseExp: 240,
    defaultMoves: ['flamethrower', 'psychic', 'shadow_ball', 'dazzling_gleam'],
    learnset: { 18: 'fire_blast' }
  },

  656: {
    id: 656, name: 'Grenousse', types: ['water'],
    baseStats: { hp: 41, atk: 56, def: 40, spa: 62, spd: 44, spe: 71 },
    catchRate: 45, baseExp: 63,
    defaultMoves: ['scratch', 'growl', 'bubble'],
    learnset: { 6: 'quick_attack', 9: 'water_pulse', 13: 'aqua_jet' },
    evolvesTo: { level: 9, id: 657 }
  },
  657: {
    id: 657, name: 'Croâporal', types: ['water'],
    baseStats: { hp: 54, atk: 63, def: 52, spa: 83, spd: 56, spe: 97 },
    catchRate: 45, baseExp: 142,
    defaultMoves: ['bubble', 'quick_attack', 'water_pulse', 'aqua_jet'],
    learnset: { 12: 'surf', 15: 'dark_pulse' },
    evolvesTo: { level: 15, id: 658 }
  },
  658: {
    id: 658, name: 'Amphinobi', types: ['water', 'dark'],
    baseStats: { hp: 72, atk: 95, def: 67, spa: 103, spd: 71, spe: 122 },
    catchRate: 45, baseExp: 239,
    defaultMoves: ['surf', 'dark_pulse', 'ice_beam', 'aqua_jet'],
    learnset: { 18: 'hydro_pump' }
  },

  // --- FAUNE SAUVAGE ROUTE 1 & CÔTE D'AZUR ---
  661: {
    id: 661, name: 'Passerouge', types: ['flying', 'normal'],
    baseStats: { hp: 45, atk: 50, def: 43, spa: 40, spd: 38, spe: 62 },
    catchRate: 255, baseExp: 56,
    defaultMoves: ['peck', 'quick_attack', 'growl'],
    learnset: { 6: 'ember', 9: 'flame_wheel', 12: 'air_slash' },
    evolvesTo: { level: 8, id: 662 }
  },
  662: {
    id: 662, name: 'Braisillon', types: ['fire', 'flying'],
    baseStats: { hp: 62, atk: 73, def: 55, spa: 56, spd: 52, spe: 84 },
    catchRate: 120, baseExp: 134,
    defaultMoves: ['peck', 'quick_attack', 'flame_wheel', 'air_slash'],
    learnset: { 13: 'flamethrower', 15: 'brave_bird' },
    evolvesTo: { level: 14, id: 663 }
  },
  663: {
    id: 663, name: 'Flambusard', types: ['fire', 'flying'],
    baseStats: { hp: 78, atk: 81, def: 71, spa: 74, spd: 69, spe: 126 },
    catchRate: 45, baseExp: 175,
    defaultMoves: ['brave_bird', 'flare_blitz', 'roost', 'quick_attack']
  },

  16: {
    id: 16, name: 'Roucool', types: ['normal', 'flying'],
    baseStats: { hp: 40, atk: 45, def: 40, spa: 35, spd: 35, spe: 56 },
    catchRate: 255, baseExp: 55,
    defaultMoves: ['tackle', 'gust', 'quick_attack'],
    learnset: { 7: 'air_slash', 11: 'roost' },
    evolvesTo: { level: 8, id: 17 }
  },
  17: {
    id: 17, name: 'Roucoups', types: ['normal', 'flying'],
    baseStats: { hp: 63, atk: 60, def: 55, spa: 50, spd: 50, spe: 71 },
    catchRate: 120, baseExp: 122,
    defaultMoves: ['quick_attack', 'gust', 'air_slash', 'roost'],
    learnset: { 14: 'hurricane' }
  },

  10: {
    id: 10, name: 'Chenipan', types: ['bug'],
    baseStats: { hp: 45, atk: 30, def: 35, spa: 20, spd: 20, spe: 45 },
    catchRate: 255, baseExp: 50,
    defaultMoves: ['tackle', 'bug_bite'],
    learnset: { 6: 'gust' },
    evolvesTo: { level: 7, id: 12 }
  },
  12: {
    id: 12, name: 'Papilusion', types: ['bug', 'flying'],
    baseStats: { hp: 60, atk: 45, def: 50, spa: 90, spd: 80, spe: 70 },
    catchRate: 45, baseExp: 178,
    defaultMoves: ['gust', 'psybeam', 'bug_buzz', 'spore'],
    learnset: { 10: 'air_slash', 13: 'psychic' }
  },

  25: {
    id: 25, name: 'Pikachu', types: ['electric'],
    baseStats: { hp: 35, atk: 55, def: 40, spa: 50, spd: 50, spe: 90 },
    catchRate: 190, baseExp: 112,
    defaultMoves: ['thundershock', 'quick_attack', 'tail_whip'],
    learnset: { 7: 'thunder_wave', 10: 'thunderbolt', 13: 'wild_charge' },
    evolvesTo: { level: 12, id: 26 }
  },
  26: {
    id: 26, name: 'Raichu', types: ['electric'],
    baseStats: { hp: 60, atk: 90, def: 55, spa: 90, spd: 80, spe: 110 },
    catchRate: 75, baseExp: 218,
    defaultMoves: ['thunderbolt', 'quick_attack', 'thunder_wave', 'surf']
  },

  133: {
    id: 133, name: 'Évoli', types: ['normal'],
    baseStats: { hp: 55, atk: 55, def: 50, spa: 45, spd: 65, spe: 55 },
    catchRate: 45, baseExp: 65,
    defaultMoves: ['tackle', 'tail_whip', 'bite', 'quick_attack'],
    learnset: { 8: 'body_slam', 11: 'shadow_ball' },
    evolvesTo: { level: 10, id: 134 }
  },
  134: {
    id: 134, name: 'Aquali', types: ['water'],
    baseStats: { hp: 130, atk: 65, def: 60, spa: 110, spd: 95, spe: 65 },
    catchRate: 45, baseExp: 184,
    defaultMoves: ['water_pulse', 'surf', 'ice_beam', 'bite']
  },

  669: {
    id: 669, name: 'Flabébé', types: ['fairy'],
    baseStats: { hp: 44, atk: 38, def: 39, spa: 61, spd: 79, spe: 42 },
    catchRate: 225, baseExp: 61,
    defaultMoves: ['tackle', 'fairy_wind', 'vine_whip'],
    learnset: { 7: 'razor_leaf', 10: 'dazzling_gleam', 13: 'moonblast' }
  },

  672: {
    id: 672, name: 'Cabriolaine', types: ['grass'],
    baseStats: { hp: 66, atk: 65, def: 48, spa: 62, spd: 57, spe: 52 },
    catchRate: 200, baseExp: 70,
    defaultMoves: ['tackle', 'tail_whip', 'vine_whip'],
    learnset: { 7: 'razor_leaf', 10: 'seed_bomb', 12: 'bulldoze' }
  },

  52: {
    id: 52, name: 'Miaouss', types: ['normal'],
    baseStats: { hp: 40, atk: 45, def: 35, spa: 40, spd: 40, spe: 90 },
    catchRate: 255, baseExp: 58,
    defaultMoves: ['scratch', 'growl', 'bite'],
    learnset: { 8: 'slash', 11: 'play_rough' }
  },

  54: {
    id: 54, name: 'Psykokwak', types: ['water'],
    baseStats: { hp: 50, atk: 52, def: 48, spa: 65, spd: 50, spe: 55 },
    catchRate: 190, baseExp: 64,
    defaultMoves: ['scratch', 'water_gun', 'hypnosis'],
    learnset: { 7: 'water_pulse', 10: 'psybeam', 13: 'surf' }
  },

  129: {
    id: 129, name: 'Magicarpe', types: ['water'],
    baseStats: { hp: 20, atk: 10, def: 55, spa: 15, spd: 20, spe: 80 },
    catchRate: 255, baseExp: 40,
    defaultMoves: ['splash', 'tackle'],
    evolvesTo: { level: 10, id: 130 }
  },
  130: {
    id: 130, name: 'Léviator', types: ['water', 'flying'],
    baseStats: { hp: 95, atk: 125, def: 79, spa: 60, spd: 100, spe: 81 },
    catchRate: 45, baseExp: 189,
    defaultMoves: ['bite', 'waterfall', 'crunch', 'dragon_dance']
  },

  74: {
    id: 74, name: 'Racaillou', types: ['rock', 'ground'],
    baseStats: { hp: 40, atk: 80, def: 100, spa: 30, spd: 30, spe: 20 },
    catchRate: 255, baseExp: 60,
    defaultMoves: ['tackle', 'rock_throw', 'bulldoze'],
    learnset: { 9: 'rock_slide', 13: 'earthquake' }
  },

  280: {
    id: 280, name: 'Tarsal', types: ['psychic', 'fairy'],
    baseStats: { hp: 28, atk: 25, def: 25, spa: 45, spd: 35, spe: 40 },
    catchRate: 235, baseExp: 60,
    defaultMoves: ['growl', 'fairy_wind', 'psybeam'],
    learnset: { 9: 'dazzling_gleam', 12: 'psychic' },
    evolvesTo: { level: 11, id: 282 }
  },
  282: {
    id: 282, name: 'Gardevoir', types: ['psychic', 'fairy'],
    baseStats: { hp: 68, atk: 65, def: 65, spa: 125, spd: 115, spe: 80 },
    catchRate: 45, baseExp: 233,
    defaultMoves: ['psychic', 'moonblast', 'shadow_ball', 'calm_mind']
  },

  447: {
    id: 447, name: 'Riolu', types: ['fighting'],
    baseStats: { hp: 40, atk: 70, def: 40, spa: 35, spd: 40, spe: 60 },
    catchRate: 75, baseExp: 70,
    defaultMoves: ['quick_attack', 'mach_punch', 'bite'],
    learnset: { 8: 'drain_punch', 11: 'aura_sphere' },
    evolvesTo: { level: 12, id: 448 }
  },
  448: {
    id: 448, name: 'Lucario', types: ['fighting', 'steel'],
    baseStats: { hp: 70, atk: 110, def: 70, spa: 115, spd: 70, spe: 90 },
    catchRate: 45, baseExp: 184,
    defaultMoves: ['aura_sphere', 'close_combat', 'meteor_mash', 'mach_punch']
  }
};

export const ENCOUNTER_TABLES = {
  grass: [
    { id: 661, minLv: 2, maxLv: 4, weight: 25 }, // Passerouge
    { id: 16, minLv: 2, maxLv: 4, weight: 20 },  // Roucool
    { id: 10, minLv: 2, maxLv: 4, weight: 16 },  // Chenipan
    { id: 669, minLv: 3, maxLv: 5, weight: 12 }, // Flabébé
    { id: 672, minLv: 3, maxLv: 5, weight: 9 },  // Cabriolaine
    { id: 280, minLv: 3, maxLv: 5, weight: 6 },  // Tarsal
    { id: 447, minLv: 4, maxLv: 6, weight: 5 },  // Riolu
    { id: 25, minLv: 4, maxLv: 6, weight: 4 },   // Pikachu
    { id: 133, minLv: 4, maxLv: 6, weight: 3 },  // Évoli
  ],
  water: [
    { id: 129, minLv: 3, maxLv: 6, weight: 45 }, // Magicarpe
    { id: 54, minLv: 3, maxLv: 6, weight: 35 },  // Psykokwak
    { id: 52, minLv: 3, maxLv: 5, weight: 12 },  // Miaouss
    { id: 74, minLv: 4, maxLv: 6, weight: 8 },   // Racaillou
  ]
};

export const ITEMS = {
  poke_ball: {
    id: 'poke_ball',
    name: 'Poké Ball',
    desc: 'Capsule standard pour capturer un Pokémon sauvage.',
    icon: 'assets/items/poke-ball.png',
    rate: 1.0,
    price: 200,
    category: 'ball'
  },
  super_ball: {
    id: 'super_ball',
    name: 'Super Ball',
    desc: 'Capsule haute performance. Taux de capture amélioré (×1.5).',
    icon: 'assets/items/great-ball.png',
    rate: 1.5,
    price: 500,
    category: 'ball'
  },
  hyper_ball: {
    id: 'hyper_ball',
    name: 'Hyper Ball',
    desc: 'Capsule d\'élite ultra-efficace. Taux de capture doublé (×2.0).',
    icon: 'assets/items/ultra-ball.png',
    rate: 2.0,
    price: 900,
    category: 'ball'
  },
  potion: {
    id: 'potion',
    name: 'Potion',
    desc: 'Restaure jusqu\'à 20 PV à un Pokémon blessé.',
    icon: 'assets/items/potion.png',
    heal: 20,
    price: 200,
    category: 'heal'
  },
  super_potion: {
    id: 'super_potion',
    name: 'Super Potion',
    desc: 'Restaure jusqu\'à 50 PV à un Pokémon blessé.',
    icon: 'assets/items/super-potion.png',
    heal: 50,
    price: 500,
    category: 'heal'
  },
  citron_menton: {
    id: 'citron_menton',
    name: 'Citron de Menton',
    desc: 'Agrume d\'or de la Fête du Citron. Restaure 35 PV et guérit tous les statuts.',
    icon: 'assets/items/sitrus-berry.png',
    heal: 35,
    cureStatus: true,
    price: 150,
    category: 'heal'
  },
  rappel: {
    id: 'rappel',
    name: 'Rappel',
    desc: 'Ranime un Pokémon tombé K.O. et restaure la moitié de ses PV max.',
    icon: 'assets/items/revive.png',
    revive: true,
    price: 700,
    category: 'heal'
  }
};

export const ADVENTURE_TRAINERS = [
  {
    id: 'theo',
    mapId: 'outdoor',
    name: 'Scout Théo',
    role: 'Dresseur en herbe',
    sprite: 'youngster',
    portrait: 'assets/trainers/youngster.png',
    x: 24,
    y: 11,
    dir: 'left',
    color: '#22c55e',
    rewardMoney: 250,
    intro: 'Hé ! Mes Pokémon insectes et oiseaux adorent l\'air marin de Menton ! En garde !',
    outro: 'Waouh ! Ton Pokémon est super bien entraîné !',
    team: [
      { id: 10, level: 3 },
      { id: 16, level: 4 }
    ]
  },
  {
    id: 'chloe',
    mapId: 'outdoor',
    name: 'Fleuriste Chloé',
    role: 'Jardinière de Garavan',
    sprite: 'lass',
    portrait: 'assets/trainers/lass.png',
    x: 28,
    y: 8,
    dir: 'down',
    color: '#ec4899',
    rewardMoney: 350,
    intro: 'Les jardins de Menton regorgent de Flabébé et de Pikachu ! Voyons si tu peux leur résister !',
    outro: 'Oh ! Mes jolies fleurs ont perdu leurs pétales...',
    team: [
      { id: 669, level: 4 },
      { id: 25, level: 5 }
    ]
  },
  {
    id: 'marius',
    mapId: 'outdoor',
    name: 'Marin Marius',
    role: 'Pêcheur des Sablettes',
    sprite: 'sailor',
    portrait: 'assets/trainers/sailor.png',
    x: 18,
    y: 25,
    dir: 'up',
    color: '#0ea5e9',
    rewardMoney: 300,
    intro: 'Mille sabords ! J\'ai pêché du lourd dans la baie de Menton ! Montre-moi ce que tu vaux !',
    outro: 'Tonnerre de Brest ! Tu m\'as coulé à pic !',
    team: [
      { id: 129, level: 4 },
      { id: 54, level: 5 }
    ]
  },
  {
    id: 'lucas',
    mapId: 'outdoor',
    name: 'Montagnard Lucas',
    role: 'Randonneur de la Corniche',
    sprite: 'hiker',
    portrait: 'assets/trainers/hiker.png',
    x: 37,
    y: 13,
    dir: 'left',
    color: '#d97706',
    rewardMoney: 500,
    intro: 'Avant d\'affronter la Championne Solène à l\'Arène de Menton, tu dois me passer sur le corps !',
    outro: 'Quelle puissance ! Tu es prêt pour l\'Arène de Menton au Nord-Est !',
    team: [
      { id: 74, level: 6 },
      { id: 672, level: 7 },
      { id: 447, level: 7 }
    ]
  },
  {
    id: 'solene',
    mapId: 'gym',
    name: 'Championne Solène',
    role: 'Maîtresse de l\'Arène de Menton',
    sprite: 'cooltrainer_f',
    portrait: 'assets/trainers/korrina.png',
    isGymLeader: true,
    badge: 'citron_dor',
    badgeName: 'Badge Citron d\'Or',
    x: 7,
    y: 3,
    dir: 'down',
    color: '#eab308',
    rewardMoney: 1500,
    intro: 'Bienvenue à l\'Arène de Menton ! Je suis Solène, gardienne du Badge Citron d\'Or. Montre-moi l\'éclat de ton lien avec tes Pokémon !',
    outro: 'Éblouissant ! Ta maîtrise stratégique brille comme le soleil de la Côte d\'Azur ! Tu mérites amplement le Badge Citron d\'Or !',
    team: [
      { id: 662, level: 8 },
      { id: 26, level: 9 },
      { id: 658, level: 10 }
    ]
  }
];

export function createTrainerParty(trainer) {
  if (!trainer || !Array.isArray(trainer.team)) return [];
  return trainer.team.map(entry => createAdventurePokemon(entry.id, entry.level));
}

export function rollWildEncounter(zone = 'grass') {
  const table = ENCOUNTER_TABLES[zone] || ENCOUNTER_TABLES.grass;
  const totalWeight = table.reduce((sum, e) => sum + e.weight, 0);
  let roll = Math.random() * totalWeight;
  let chosen = table[0];
  for (const entry of table) {
    if (roll < entry.weight) {
      chosen = entry;
      break;
    }
    roll -= entry.weight;
  }
  const level = Math.floor(Math.random() * (chosen.maxLv - chosen.minLv + 1)) + chosen.minLv;
  return createAdventurePokemon(chosen.id, level);
}

export function createAdventurePokemon(speciesId, level = 5) {
  const base = BASE_SPECIES[speciesId];
  if (!base) throw new Error(`Unknown adventure species: ${speciesId}`);

  // Formule authentique des stats Gen 3/4/6
  const iv = 15; // IVs moyens équilibrés
  const maxHp = Math.max(10, Math.floor(((2 * base.baseStats.hp + iv) * level) / 100) + level + 10);
  const atk = Math.max(5, Math.floor(((2 * base.baseStats.atk + iv) * level) / 100) + 5);
  const def = Math.max(5, Math.floor(((2 * base.baseStats.def + iv) * level) / 100) + 5);
  const spa = Math.max(5, Math.floor(((2 * base.baseStats.spa + iv) * level) / 100) + 5);
  const spd = Math.max(5, Math.floor(((2 * base.baseStats.spd + iv) * level) / 100) + 5);
  const spe = Math.max(5, Math.floor(((2 * base.baseStats.spe + iv) * level) / 100) + 5);

  const moves = [...(base.defaultMoves || ['tackle'])];
  if (base.learnset) {
    for (const [lvStr, mId] of Object.entries(base.learnset)) {
      if (Number(lvStr) <= level && MOVES[mId] && !moves.includes(mId)) {
        if (moves.length < 4) moves.push(mId);
        else moves[moves.length - 1] = mId;
      }
    }
  }

  // Exp requis pour le niveau suivant (courbe moyenne)
  const expCur = Math.floor(Math.pow(level, 3));
  const expNext = Math.floor(Math.pow(level + 1, 3));

  return {
    uid: 'pk_' + Math.random().toString(36).slice(2, 9),
    id: base.id,
    name: base.name,
    types: [...base.types],
    level,
    exp: expCur,
    expNext,
    currentHp: maxHp,
    maxHp,
    stats: { hp: maxHp, atk, def, spa, spd, spe },
    moves: moves.slice(0, 4),
    fainted: false,
    status: null,
    baseExp: base.baseExp,
    catchRate: base.catchRate
  };
}

export function checkLevelUp(poke) {
  let didLevelUp = false;
  const newMoves = [];
  let evolvedFrom = null;
  let evolvedTo = null;

  while (poke.exp >= poke.expNext) {
    didLevelUp = true;
    const oldMaxHp = poke.maxHp;
    poke.level += 1;
    poke.expNext = Math.floor(Math.pow(poke.level + 1, 3));

    let base = BASE_SPECIES[poke.id];
    if (!base) break;

    // Vérifier l'évolution au niveau atteint
    if (base.evolvesTo && poke.level >= base.evolvesTo.level && BASE_SPECIES[base.evolvesTo.id]) {
      const nextSpecies = BASE_SPECIES[base.evolvesTo.id];
      evolvedFrom = poke.name;
      evolvedTo = nextSpecies.name;
      poke.id = nextSpecies.id;
      poke.name = nextSpecies.name;
      poke.types = [...nextSpecies.types];
      poke.baseExp = nextSpecies.baseExp;
      poke.catchRate = nextSpecies.catchRate;
      base = nextSpecies;
      // Ajouter les capacités signature de l'évolution
      for (const mId of (nextSpecies.defaultMoves || [])) {
        if (MOVES[mId] && !poke.moves.includes(mId)) {
          if (poke.moves.length < 4) poke.moves.push(mId);
          else poke.moves[0] = mId;
          newMoves.push(MOVES[mId].name);
        }
      }
    }

    // Vérifier l'apprentissage de nouvelles capacités
    if (base.learnset && base.learnset[poke.level]) {
      const moveId = base.learnset[poke.level];
      if (MOVES[moveId] && !poke.moves.includes(moveId)) {
        if (poke.moves.length < 4) {
          poke.moves.push(moveId);
        } else {
          poke.moves[0] = moveId;
        }
        newMoves.push(MOVES[moveId].name);
      }
    }

    // Recalculer les stats avec le nouveau niveau (et la nouvelle espèce si évolué)
    const iv = 15;
    poke.maxHp = Math.floor(((2 * base.baseStats.hp + iv) * poke.level) / 100) + poke.level + 10;
    poke.stats.hp = poke.maxHp;
    poke.stats.atk = Math.floor(((2 * base.baseStats.atk + iv) * poke.level) / 100) + 5;
    poke.stats.def = Math.floor(((2 * base.baseStats.def + iv) * poke.level) / 100) + 5;
    poke.stats.spa = Math.floor(((2 * base.baseStats.spa + iv) * poke.level) / 100) + 5;
    poke.stats.spd = Math.floor(((2 * base.baseStats.spd + iv) * poke.level) / 100) + 5;
    poke.stats.spe = Math.floor(((2 * base.baseStats.spe + iv) * poke.level) / 100) + 5;

    // Gain de PV proportionnel au gain de PV max
    poke.currentHp = Math.min(poke.maxHp, poke.currentHp + Math.max(1, poke.maxHp - oldMaxHp));
  }

  if (didLevelUp) {
    poke.lastLevelUp = { newMoves, evolvedFrom, evolvedTo };
  }
  return didLevelUp;
}

export function calculateCatchSuccess(wildPoke, ballRate = 1.0) {
  let statusMul = 1.0;
  if (wildPoke.status === 'sleep' || wildPoke.status === 'freeze') statusMul = 2.0;
  else if (wildPoke.status === 'paralysis' || wildPoke.status === 'burn' || wildPoke.status === 'poison') statusMul = 1.5;

  const a = Math.max(1, Math.floor(
    (((3 * wildPoke.maxHp - 2 * wildPoke.currentHp) * wildPoke.catchRate * ballRate) / (3 * wildPoke.maxHp)) * statusMul
  ));

  if (a >= 255) return { success: true, shakes: 3 };

  const b = Math.floor(65536 / Math.pow(255 / a, 0.25));

  let shakes = 0;
  for (let i = 0; i < 4; i++) {
    const rand = Math.floor(Math.random() * 65536);
    if (rand < b) {
      shakes++;
    } else {
      break;
    }
  }

  return {
    success: shakes >= 4,
    shakes: Math.min(3, shakes)
  };
}
