// pokemon/engine/data.js
// Base de données des Pokémon jouables (Gens 1 à 3 cultes + favoris universels)
// Chaque Pokémon dispose de ses stats niveau 50 équilibrées, de ses types et de 4 attaques signatures.

export const POKEMON_ROSTER = [
  // ===================== GEN 1 (KANTO) =====================
  {
    id: 3, name: 'Florizarre', en: 'venusaur', gen: 1,
    types: ['grass', 'poison'],
    stats: { hp: 155, atk: 102, def: 103, spa: 120, spd: 120, spe: 100 },
    moves: ['energy_ball', 'sludge_bomb', 'giga_drain', 'sleep_powder_dummy', 'earth_power'],
    cleanMoves: ['energy_ball', 'sludge_bomb', 'giga_drain', 'earth_power']
  },
  {
    id: 6, name: 'Dracaufeu', en: 'charizard', gen: 1,
    types: ['fire', 'flying'],
    stats: { hp: 153, atk: 104, def: 98, spa: 129, spd: 105, spe: 120 },
    cleanMoves: ['flamethrower', 'air_slash', 'dragon_pulse', 'roost']
  },
  {
    id: 9, name: 'Tortank', en: 'blastoise', gen: 1,
    types: ['water'],
    stats: { hp: 154, atk: 103, def: 120, spa: 105, spd: 125, spe: 98 },
    cleanMoves: ['hydro_pump', 'ice_beam', 'flash_cannon', 'scald']
  },
  {
    id: 25, name: 'Pikachu', en: 'pikachu', gen: 1,
    types: ['electric'],
    // Balle Lumière intégrée : stats gonflées pour être ultra compétitif !
    stats: { hp: 110, atk: 125, def: 60, spa: 130, spd: 70, spe: 130 },
    cleanMoves: ['thunderbolt', 'quick_attack', 'surf', 'thunder_wave']
  },
  {
    id: 26, name: 'Raichu', en: 'raichu', gen: 1,
    types: ['electric'],
    stats: { hp: 135, atk: 110, def: 75, spa: 110, spd: 100, spe: 130 },
    cleanMoves: ['thunderbolt', 'volt_switch', 'focus_blast', 'surf']
  },
  {
    id: 34, name: 'Nidoking', en: 'nidoking', gen: 1,
    types: ['poison', 'ground'],
    stats: { hp: 156, atk: 122, def: 97, spa: 105, spd: 95, spe: 105 },
    cleanMoves: ['earthquake', 'sludge_bomb', 'ice_beam', 'flamethrower']
  },
  {
    id: 59, name: 'Arcanin', en: 'arcanine', gen: 1,
    types: ['fire'],
    stats: { hp: 165, atk: 130, def: 100, spa: 120, spd: 100, spe: 115 },
    cleanMoves: ['flare_blitz', 'wild_charge', 'crunch', 'quick_attack']
  },
  {
    id: 62, name: 'Tartard', en: 'poliwrath', gen: 1,
    types: ['water', 'fighting'],
    stats: { hp: 165, atk: 115, def: 115, spa: 90, spd: 110, spe: 90 },
    cleanMoves: ['waterfall', 'drain_punch', 'ice_punch', 'earthquake']
  },
  {
    id: 65, name: 'Alakazam', en: 'alakazam', gen: 1,
    types: ['psychic'],
    stats: { hp: 130, atk: 70, def: 65, spa: 155, spd: 115, spe: 140 },
    cleanMoves: ['psychic', 'shadow_ball', 'focus_blast', 'dazzling_gleam']
  },
  {
    id: 68, name: 'Mackogneur', en: 'machamp', gen: 1,
    types: ['fighting'],
    stats: { hp: 165, atk: 150, def: 100, spa: 85, spd: 105, spe: 75 },
    cleanMoves: ['close_combat', 'stone_edge', 'ice_punch', 'bullet_punch_dummy', 'mach_punch'],
    cleanMoves: ['close_combat', 'stone_edge', 'ice_punch', 'mach_punch']
  },
  {
    id: 91, name: 'Crustabri', en: 'cloyster', gen: 1,
    types: ['water', 'ice'],
    stats: { hp: 125, atk: 115, def: 200, spa: 105, spd: 65, spe: 90 },
    cleanMoves: ['hydro_pump', 'ice_beam', 'ice_shard', 'scald']
  },
  {
    id: 94, name: 'Ectoplasma', en: 'gengar', gen: 1,
    types: ['ghost', 'poison'],
    stats: { hp: 135, atk: 85, def: 80, spa: 150, spd: 95, spe: 130 },
    cleanMoves: ['shadow_ball', 'sludge_bomb', 'focus_blast', 'thunderbolt']
  },
  {
    id: 103, name: 'Noadkoko', en: 'exeggutor', gen: 1,
    types: ['grass', 'psychic'],
    stats: { hp: 170, atk: 115, def: 105, spa: 145, spd: 85, spe: 75 },
    cleanMoves: ['energy_ball', 'psychic', 'sludge_bomb', 'giga_drain']
  },
  {
    id: 106, name: 'Kicklee', en: 'hitmonlee', gen: 1,
    types: ['fighting'],
    stats: { hp: 125, atk: 140, def: 73, spa: 55, spd: 130, spe: 107 },
    cleanMoves: ['close_combat', 'stone_edge', 'mach_punch', 'earthquake']
  },
  {
    id: 112, name: 'Rhinoféros', en: 'rhydon', gen: 1,
    types: ['ground', 'rock'],
    stats: { hp: 180, atk: 150, def: 140, spa: 65, spd: 65, spe: 60 },
    cleanMoves: ['earthquake', 'stone_edge', 'superpower', 'crunch']
  },
  {
    id: 130, name: 'Léviator', en: 'gyarados', gen: 1,
    types: ['water', 'flying'],
    stats: { hp: 170, atk: 145, def: 99, spa: 80, spd: 120, spe: 101 },
    cleanMoves: ['waterfall', 'earthquake', 'crunch', 'ice_fang_dummy', 'dragon_dance'],
    cleanMoves: ['waterfall', 'earthquake', 'crunch', 'dragon_dance']
  },
  {
    id: 131, name: 'Lokhlass', en: 'lapras', gen: 1,
    types: ['water', 'ice'],
    stats: { hp: 205, atk: 105, def: 100, spa: 105, spd: 115, spe: 80 },
    cleanMoves: ['surf', 'ice_beam', 'thunderbolt', 'ice_shard']
  },
  {
    id: 134, name: 'Aquali', en: 'vaporeon', gen: 1,
    types: ['water'],
    stats: { hp: 205, atk: 85, def: 80, spa: 130, spd: 115, spe: 85 },
    cleanMoves: ['scald', 'ice_beam', 'shadow_ball', 'recover']
  },
  {
    id: 135, name: 'Voltali', en: 'jolteon', gen: 1,
    types: ['electric'],
    stats: { hp: 140, atk: 85, def: 80, spa: 130, spd: 115, spe: 150 },
    cleanMoves: ['thunderbolt', 'volt_switch', 'shadow_ball', 'thunder_wave']
  },
  {
    id: 136, name: 'Pyroli', en: 'flareon', gen: 1,
    types: ['fire'],
    stats: { hp: 140, atk: 150, def: 80, spa: 115, spd: 130, spe: 85 },
    cleanMoves: ['flare_blitz', 'superpower', 'quick_attack', 'will_o_wisp']
  },
  {
    id: 143, name: 'Ronflex', en: 'snorlax', gen: 1,
    types: ['normal'],
    stats: { hp: 235, atk: 130, def: 85, spa: 85, spd: 130, spe: 50 },
    cleanMoves: ['body_slam', 'earthquake', 'crunch', 'recover']
  },
  {
    id: 144, name: 'Artikodin', en: 'articuno', gen: 1,
    types: ['ice', 'flying'],
    stats: { hp: 165, atk: 105, def: 120, spa: 115, spd: 145, spe: 105 },
    cleanMoves: ['blizzard', 'air_slash', 'ice_shard', 'roost']
  },
  {
    id: 145, name: 'Électhor', en: 'zapdos', gen: 1,
    types: ['electric', 'flying'],
    stats: { hp: 165, atk: 110, def: 105, spa: 145, spd: 110, spe: 120 },
    cleanMoves: ['thunderbolt', 'air_slash', 'heat_wave_dummy', 'volt_switch', 'roost'],
    cleanMoves: ['thunderbolt', 'air_slash', 'volt_switch', 'roost']
  },
  {
    id: 146, name: 'Sulfura', en: 'moltres', gen: 1,
    types: ['fire', 'flying'],
    stats: { hp: 165, atk: 120, def: 110, spa: 145, spd: 105, spe: 110 },
    cleanMoves: ['fire_blast', 'air_slash', 'scorching_sands_dummy', 'flamethrower', 'roost'],
    cleanMoves: ['fire_blast', 'air_slash', 'flamethrower', 'roost']
  },
  {
    id: 149, name: 'Dracolosse', en: 'dragonite', gen: 1,
    types: ['dragon', 'flying'],
    stats: { hp: 166, atk: 154, def: 115, spa: 120, spd: 120, spe: 100 },
    cleanMoves: ['outrage', 'earthquake', 'flare_blitz', 'dragon_dance']
  },
  {
    id: 150, name: 'Mewtwo', en: 'mewtwo', gen: 1,
    types: ['psychic'],
    stats: { hp: 181, atk: 130, def: 110, spa: 174, spd: 110, spe: 150 },
    cleanMoves: ['psyshock', 'shadow_ball', 'aura_sphere_dummy', 'ice_beam', 'calm_mind'],
    cleanMoves: ['psyshock', 'shadow_ball', 'ice_beam', 'calm_mind']
  },
  {
    id: 151, name: 'Mew', en: 'mew', gen: 1,
    types: ['psychic'],
    stats: { hp: 175, atk: 120, def: 120, spa: 120, spd: 120, spe: 120 },
    cleanMoves: ['psychic', 'flamethrower', 'surf', 'calm_mind']
  },

  // ===================== GEN 2 (JOHTO) =====================
  {
    id: 154, name: 'Méganium', en: 'meganium', gen: 2,
    types: ['grass'],
    stats: { hp: 155, atk: 102, def: 120, spa: 103, spd: 120, spe: 100 },
    cleanMoves: ['energy_ball', 'earthquake', 'body_slam', 'recover']
  },
  {
    id: 157, name: 'Typhlosion', en: 'typhlosion', gen: 2,
    types: ['fire'],
    stats: { hp: 153, atk: 104, def: 98, spa: 129, spd: 105, spe: 120 },
    cleanMoves: ['fire_blast', 'flamethrower', 'earth_power', 'focus_blast']
  },
  {
    id: 160, name: 'Aligatueur', en: 'feraligatr', gen: 2,
    types: ['water'],
    stats: { hp: 160, atk: 125, def: 120, spa: 99, spd: 103, spe: 98 },
    cleanMoves: ['waterfall', 'crunch', 'ice_punch', 'dragon_dance']
  },
  {
    id: 169, name: 'Nostenfer', en: 'crobat', gen: 2,
    types: ['poison', 'flying'],
    stats: { hp: 160, atk: 110, def: 100, spa: 90, spd: 100, spe: 150 },
    cleanMoves: ['brave_bird', 'poison_jab', 'u_turn', 'roost']
  },
  {
    id: 181, name: 'Pharamp', en: 'ampharos', gen: 2,
    types: ['electric'],
    stats: { hp: 165, atk: 95, def: 105, spa: 135, spd: 110, spe: 75 },
    cleanMoves: ['thunderbolt', 'focus_blast', 'dragon_pulse', 'thunder_wave']
  },
  {
    id: 184, name: 'Azumarill', en: 'azumarill', gen: 2,
    types: ['water', 'fairy'],
    // Coloforce (Huge Power) intégrée : Attaque doublée !
    stats: { hp: 175, atk: 140, def: 100, spa: 80, spd: 100, spe: 70 },
    cleanMoves: ['waterfall', 'play_rough', 'aqua_jet', 'superpower']
  },
  {
    id: 196, name: 'Mentali', en: 'espeon', gen: 2,
    types: ['psychic'],
    stats: { hp: 140, atk: 85, def: 80, spa: 150, spd: 115, spe: 130 },
    cleanMoves: ['psychic', 'shadow_ball', 'dazzling_gleam', 'calm_mind']
  },
  {
    id: 197, name: 'Noctali', en: 'umbreon', gen: 2,
    types: ['dark'],
    stats: { hp: 170, atk: 85, def: 130, spa: 80, spd: 150, spe: 85 },
    cleanMoves: ['dark_pulse', 'body_slam', 'toxic', 'recover']
  },
  {
    id: 212, name: 'Cizayox', en: 'scizor', gen: 2,
    types: ['bug', 'steel'],
    stats: { hp: 145, atk: 150, def: 120, spa: 75, spd: 100, spe: 85 },
    cleanMoves: ['iron_head', 'x_scissor', 'u_turn', 'swords_dance']
  },
  {
    id: 214, name: 'Scarhino', en: 'heracross', gen: 2,
    types: ['bug', 'fighting'],
    stats: { hp: 155, atk: 145, def: 95, spa: 60, spd: 115, spe: 105 },
    cleanMoves: ['close_combat', 'x_scissor', 'stone_edge', 'earthquake']
  },
  {
    id: 227, name: 'Airmure', en: 'skarmory', gen: 2,
    types: ['steel', 'flying'],
    stats: { hp: 140, atk: 100, def: 160, spa: 60, spd: 90, spe: 90 },
    cleanMoves: ['brave_bird', 'iron_head', 'toxic', 'roost']
  },
  {
    id: 229, name: 'Démolosse', en: 'houndoom', gen: 2,
    types: ['dark', 'fire'],
    stats: { hp: 150, atk: 110, def: 70, spa: 130, spd: 100, spe: 115 },
    cleanMoves: ['fire_blast', 'dark_pulse', 'sludge_bomb', 'nasty_plot']
  },
  {
    id: 232, name: 'Donphan', en: 'donphan', gen: 2,
    types: ['ground'],
    stats: { hp: 165, atk: 140, def: 140, spa: 80, spd: 80, spe: 70 },
    cleanMoves: ['earthquake', 'stone_edge', 'play_rough', 'ice_shard']
  },
  {
    id: 248, name: 'Tyranocif', en: 'tyranitar', gen: 2,
    types: ['rock', 'dark'],
    stats: { hp: 175, atk: 154, def: 130, spa: 115, spd: 120, spe: 81 },
    cleanMoves: ['stone_edge', 'crunch', 'earthquake', 'dragon_dance']
  },
  {
    id: 249, name: 'Lugia', en: 'lugia', gen: 2,
    types: ['psychic', 'flying'],
    stats: { hp: 181, atk: 110, def: 150, spa: 110, spd: 174, spe: 130 },
    cleanMoves: ['aeroblast_dummy', 'psychic', 'ice_beam', 'surf', 'roost'],
    cleanMoves: ['psychic', 'air_slash', 'surf', 'roost']
  },
  {
    id: 250, name: 'Ho-Oh', en: 'ho-oh', gen: 2,
    types: ['fire', 'flying'],
    stats: { hp: 181, atk: 150, def: 110, spa: 130, spd: 174, spe: 110 },
    cleanMoves: ['sacred_fire_dummy', 'brave_bird', 'flare_blitz', 'earthquake', 'roost'],
    cleanMoves: ['flare_blitz', 'brave_bird', 'earthquake', 'roost']
  },

  // ===================== GEN 3 (HOENN) =====================
  {
    id: 254, name: 'Jungko', en: 'sceptile', gen: 3,
    types: ['grass'],
    stats: { hp: 145, atk: 105, def: 85, spa: 125, spd: 105, spe: 140 },
    cleanMoves: ['leaf_blade', 'energy_ball', 'dragon_pulse', 'focus_blast']
  },
  {
    id: 257, name: 'Braségali', en: 'blaziken', gen: 3,
    types: ['fire', 'fighting'],
    stats: { hp: 155, atk: 140, def: 90, spa: 130, spd: 90, spe: 100 },
    cleanMoves: ['flare_blitz', 'close_combat', 'stone_edge', 'swords_dance']
  },
  {
    id: 260, name: 'Laggron', en: 'swampert', gen: 3,
    types: ['water', 'ground'],
    stats: { hp: 175, atk: 130, def: 110, spa: 105, spd: 110, spe: 80 },
    cleanMoves: ['waterfall', 'earthquake', 'ice_punch', 'scald']
  },
  {
    id: 282, name: 'Gardevoir', en: 'gardevoir', gen: 3,
    types: ['psychic', 'fairy'],
    stats: { hp: 143, atk: 85, def: 85, spa: 145, spd: 135, spe: 100 },
    cleanMoves: ['psychic', 'moonblast', 'shadow_ball', 'calm_mind']
  },
  {
    id: 286, name: 'Chapignon', en: 'breloom', gen: 3,
    types: ['grass', 'fighting'],
    stats: { hp: 135, atk: 150, def: 100, spa: 80, spd: 80, spe: 90 },
    cleanMoves: ['spore', 'leaf_blade', 'mach_punch', 'drain_punch']
  },
  {
    id: 306, name: 'Galeking', en: 'aggron', gen: 3,
    types: ['steel', 'rock'],
    stats: { hp: 145, atk: 130, def: 200, spa: 80, spd: 80, spe: 70 },
    cleanMoves: ['iron_head', 'stone_edge', 'earthquake', 'body_slam']
  },
  {
    id: 310, name: 'Élecsprint', en: 'manectric', gen: 3,
    types: ['electric'],
    stats: { hp: 145, atk: 95, def: 80, spa: 125, spd: 80, spe: 125 },
    cleanMoves: ['thunderbolt', 'volt_switch', 'flamethrower', 'thunder_wave']
  },
  {
    id: 319, name: 'Sharpedo', en: 'sharpedo', gen: 3,
    types: ['water', 'dark'],
    stats: { hp: 145, atk: 140, def: 60, spa: 115, spd: 60, spe: 115 },
    cleanMoves: ['waterfall', 'crunch', 'ice_fang_dummy', 'close_combat', 'aqua_jet'],
    cleanMoves: ['waterfall', 'crunch', 'close_combat', 'aqua_jet']
  },
  {
    id: 330, name: 'Libégon', en: 'flygon', gen: 3,
    types: ['ground', 'dragon'],
    stats: { hp: 155, atk: 120, def: 100, spa: 100, spd: 100, spe: 120 },
    cleanMoves: ['earthquake', 'dragon_claw', 'u_turn', 'stone_edge']
  },
  {
    id: 350, name: 'Milobellus', en: 'milotic', gen: 3,
    types: ['water'],
    stats: { hp: 170, atk: 80, def: 99, spa: 120, spd: 145, spe: 101 },
    cleanMoves: ['surf', 'ice_beam', 'recover', 'toxic']
  },
  {
    id: 359, name: 'Absol', en: 'absol', gen: 3,
    types: ['dark'],
    stats: { hp: 140, atk: 150, def: 80, spa: 95, spd: 80, spe: 95 },
    cleanMoves: ['crunch', 'sucker_punch', 'play_rough', 'swords_dance']
  },
  {
    id: 373, name: 'Drattak', en: 'salamence', gen: 3,
    types: ['dragon', 'flying'],
    stats: { hp: 170, atk: 155, def: 100, spa: 130, spd: 100, spe: 120 },
    cleanMoves: ['outrage', 'earthquake', 'fire_blast', 'dragon_dance']
  },
  {
    id: 376, name: 'Métalosse', en: 'metagross', gen: 3,
    types: ['steel', 'psychic'],
    stats: { hp: 155, atk: 155, def: 150, spa: 115, spd: 110, spe: 90 },
    cleanMoves: ['meteor_mash', 'zen_headbutt', 'earthquake', 'bullet_punch_dummy', 'ice_punch'],
    cleanMoves: ['meteor_mash', 'zen_headbutt', 'earthquake', 'ice_punch']
  },
  {
    id: 382, name: 'Kyogre', en: 'kyogre', gen: 3,
    types: ['water'],
    stats: { hp: 175, atk: 120, def: 110, spa: 170, spd: 160, spe: 110 },
    cleanMoves: ['hydro_pump', 'ice_beam', 'thunder', 'calm_mind']
  },
  {
    id: 383, name: 'Groudon', en: 'groudon', gen: 3,
    types: ['ground'],
    stats: { hp: 175, atk: 170, def: 160, spa: 120, spd: 110, spe: 110 },
    cleanMoves: ['earthquake', 'stone_edge', 'fire_punch', 'swords_dance']
  },
  {
    id: 384, name: 'Rayquaza', en: 'rayquaza', gen: 3,
    types: ['dragon', 'flying'],
    stats: { hp: 180, atk: 170, def: 110, spa: 170, spd: 110, spe: 115 },
    cleanMoves: ['outrage', 'air_slash', 'earthquake', 'dragon_dance']
  },
  {
    id: 448, name: 'Lucario', en: 'lucario', gen: 4,
    types: ['fighting', 'steel'],
    stats: { hp: 145, atk: 130, def: 90, spa: 135, spd: 90, spe: 110 },
    cleanMoves: ['close_combat', 'flash_cannon', 'shadow_ball', 'swords_dance']
  },
  {
    id: 445, name: 'Carchacrok', en: 'garchomp', gen: 4,
    types: ['dragon', 'ground'],
    stats: { hp: 183, atk: 150, def: 115, spa: 100, spd: 105, spe: 122 },
    cleanMoves: ['earthquake', 'outrage', 'stone_edge', 'swords_dance']
  }
];

export function getPokemonById(id) {
  return POKEMON_ROSTER.find(p => p.id === id);
}

export function getRandomTeam(count = 3, genFilter = 'all', excludeIds = []) {
  let pool = POKEMON_ROSTER.filter(p => !excludeIds.includes(p.id));
  if (genFilter === 'kanto') {
    pool = pool.filter(p => p.gen === 1);
  } else if (genFilter === 'hoenn') {
    pool = pool.filter(p => p.gen === 2 || p.gen === 3);
  }
  if (pool.length < count) pool = [...POKEMON_ROSTER];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  const team = [];
  const chosenTypes = new Set();

  for (const p of shuffled) {
    if (team.length >= count) break;
    // Tenter d'éviter 3 Pokémon du même type principal
    const mainType = p.types[0];
    if (team.length < count - 1 && chosenTypes.has(mainType)) {
      continue;
    }
    chosenTypes.add(mainType);
    team.push(createActivePokemon(p));
  }

  // Fallback si la sélection stricte n'a pas atteint count
  while (team.length < count) {
    const candidate = shuffled.find(p => !team.some(t => t.id === p.id));
    if (candidate) team.push(createActivePokemon(candidate));
    else break;
  }

  return team;
}

export function createActivePokemon(base) {
  return {
    id: base.id,
    name: base.name,
    en: base.en,
    types: [...base.types],
    maxHp: base.stats.hp,
    hp: base.stats.hp,
    stats: { ...base.stats },
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 },
    status: null, // 'burn', 'paralysis', 'poison', 'toxic', 'freeze', 'sleep'
    toxicTurns: 0,
    moves: [...base.cleanMoves],
    fainted: false
  };
}

export function spriteUrls(pokemonId) {
  return {
    front: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${pokemonId}.gif`,
    back: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/back/${pokemonId}.gif`,
    icon: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemonId}.png`,
    artwork: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemonId}.png`,
    cry: `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`
  };
}

export const POKEBALL_SPRITE = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png';
