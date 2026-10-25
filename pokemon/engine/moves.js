// pokemon/engine/moves.js
// Liste des attaques cultes avec types, catégories, puissances et effets

export const MOVES = {
  // --- NORMAL ---
  tackle: { name: 'Charge', type: 'normal', cat: 'physical', power: 40, acc: 100, pp: 35 },
  scratch: { name: 'Griffe', type: 'normal', cat: 'physical', power: 40, acc: 100, pp: 35 },
  splash: { name: 'Trempette', type: 'normal', cat: 'status', power: 0, acc: 100, pp: 40 },
  growl: { name: 'Rugissement', type: 'normal', cat: 'status', power: 0, acc: 100, effect: { type: 'stat', target: 'opponent', stat: 'atk', val: -1 }, pp: 40 },
  tail_whip: { name: 'Mimi-Queue', type: 'normal', cat: 'status', power: 0, acc: 100, effect: { type: 'stat', target: 'opponent', stat: 'def', val: -1 }, pp: 30 },
  body_slam: { name: 'Plaquage', type: 'normal', cat: 'physical', power: 85, acc: 100, pp: 15, effect: { type: 'status', status: 'paralysis', chance: 30 } },
  hyper_beam: { name: 'Ultralaser', type: 'normal', cat: 'special', power: 150, acc: 90, pp: 5 },
  quick_attack: { name: 'Vive-Attaque', type: 'normal', cat: 'physical', power: 40, acc: 100, priority: 1, pp: 30 },
  slash: { name: 'Tranche', type: 'normal', cat: 'physical', power: 70, acc: 100, crit: 2, pp: 20 },
  swords_dance: { name: 'Danse Lames', type: 'normal', cat: 'status', power: 0, acc: 100, effect: { type: 'stat', target: 'self', stat: 'atk', val: 2 }, pp: 20 },
  recover: { name: 'Soin', type: 'normal', cat: 'status', power: 0, acc: 100, effect: { type: 'heal', val: 0.5 }, pp: 10 },

  // --- FEU ---
  ember: { name: 'Flammèche', type: 'fire', cat: 'special', power: 40, acc: 100, pp: 25, effect: { type: 'status', status: 'burn', chance: 10 } },
  flamethrower: { name: 'Lance-Flammes', type: 'fire', cat: 'special', power: 90, acc: 100, pp: 15, effect: { type: 'status', status: 'burn', chance: 10 } },
  fire_blast: { name: 'Déflagration', type: 'fire', cat: 'special', power: 110, acc: 85, pp: 5, effect: { type: 'status', status: 'burn', chance: 20 } },
  flare_blitz: { name: 'Boutefeu', type: 'fire', cat: 'physical', power: 120, acc: 100, pp: 15, recoil: 0.33, effect: { type: 'status', status: 'burn', chance: 10 } },
  fire_punch: { name: 'Poing de Feu', type: 'fire', cat: 'physical', power: 75, acc: 100, pp: 15, effect: { type: 'status', status: 'burn', chance: 10 } },
  will_o_wisp: { name: 'Feu Follet', type: 'fire', cat: 'status', power: 0, acc: 85, effect: { type: 'status', status: 'burn', chance: 100 }, pp: 15 },

  // --- EAU ---
  water_gun: { name: 'Pistolet à O', type: 'water', cat: 'special', power: 40, acc: 100, pp: 25 },
  bubble: { name: 'Écume', type: 'water', cat: 'special', power: 40, acc: 100, pp: 30, effect: { type: 'stat', target: 'opponent', stat: 'spe', val: -1, chance: 10 } },
  surf: { name: 'Surf', type: 'water', cat: 'special', power: 90, acc: 100, pp: 15 },
  hydro_pump: { name: 'Hydrocanon', type: 'water', cat: 'special', power: 110, acc: 80, pp: 5 },
  waterfall: { name: 'Cascade', type: 'water', cat: 'physical', power: 80, acc: 100, pp: 15 },
  aqua_jet: { name: 'Aqua-Jet', type: 'water', cat: 'physical', power: 40, acc: 100, priority: 1, pp: 20 },
  scald: { name: 'Ébullition', type: 'water', cat: 'special', power: 80, acc: 100, pp: 15, effect: { type: 'status', status: 'burn', chance: 30 } },

  // --- PLANTE ---
  vine_whip: { name: 'Fouet Lianes', type: 'grass', cat: 'physical', power: 45, acc: 100, pp: 25 },
  energy_ball: { name: 'Éco-Sphère', type: 'grass', cat: 'special', power: 90, acc: 100, pp: 10 },
  solar_beam: { name: 'Lance-Soleil', type: 'grass', cat: 'special', power: 120, acc: 100, pp: 10 },
  giga_drain: { name: 'Giga-Sangsue', type: 'grass', cat: 'special', power: 75, acc: 100, pp: 10, drain: 0.5 },
  leaf_blade: { name: 'Lame Feuille', type: 'grass', cat: 'physical', power: 90, acc: 100, crit: 2, pp: 15 },
  seed_bomb: { name: 'Canon Graine', type: 'grass', cat: 'physical', power: 80, acc: 100, pp: 15 },
  spore: { name: 'Spore', type: 'grass', cat: 'status', power: 0, acc: 100, effect: { type: 'status', status: 'sleep', chance: 100 }, pp: 15 },

  // --- ÉLECTRIK ---
  thundershock: { name: 'Éclair', type: 'electric', cat: 'special', power: 40, acc: 100, pp: 30, effect: { type: 'status', status: 'paralysis', chance: 10 } },
  thunderbolt: { name: 'Tonnerre', type: 'electric', cat: 'special', power: 90, acc: 100, pp: 15, effect: { type: 'status', status: 'paralysis', chance: 10 } },
  thunder: { name: 'Fatal-Foudre', type: 'electric', cat: 'special', power: 110, acc: 70, pp: 10, effect: { type: 'status', status: 'paralysis', chance: 30 } },
  wild_charge: { name: 'Éclair Fou', type: 'electric', cat: 'physical', power: 90, acc: 100, recoil: 0.25, pp: 15 },
  thunder_wave: { name: 'Cage-Éclair', type: 'electric', cat: 'status', power: 0, acc: 90, effect: { type: 'status', status: 'paralysis', chance: 100 }, pp: 20 },
  volt_switch: { name: 'Change-Éclair', type: 'electric', cat: 'special', power: 70, acc: 100, pp: 20 },

  // --- GLACE ---
  ice_beam: { name: 'Laser Glace', type: 'ice', cat: 'special', power: 90, acc: 100, pp: 10, effect: { type: 'status', status: 'freeze', chance: 10 } },
  blizzard: { name: 'Blizzard', type: 'ice', cat: 'special', power: 110, acc: 70, pp: 5, effect: { type: 'status', status: 'freeze', chance: 10 } },
  ice_punch: { name: 'Poing Glace', type: 'ice', cat: 'physical', power: 75, acc: 100, pp: 15, effect: { type: 'status', status: 'freeze', chance: 10 } },
  ice_shard: { name: 'Éclats Glace', type: 'ice', cat: 'physical', power: 40, acc: 100, priority: 1, pp: 30 },

  // --- COMBAT ---
  close_combat: { name: 'Close Combat', type: 'fighting', cat: 'physical', power: 120, acc: 100, pp: 5, effect: { type: 'stat', target: 'self', stat: 'def', val: -1 } },
  superpower: { name: 'Surpuissance', type: 'fighting', cat: 'physical', power: 120, acc: 100, pp: 5, effect: { type: 'stat', target: 'self', stat: 'atk', val: -1 } },
  focus_blast: { name: 'Exploforce', type: 'fighting', cat: 'special', power: 120, acc: 70, pp: 5 },
  drain_punch: { name: 'Vampi-Poing', type: 'fighting', cat: 'physical', power: 75, acc: 100, drain: 0.5, pp: 10 },
  mach_punch: { name: 'Mach Punch', type: 'fighting', cat: 'physical', power: 40, acc: 100, priority: 1, pp: 30 },

  // --- SOL ---
  earthquake: { name: 'Séisme', type: 'ground', cat: 'physical', power: 100, acc: 100, pp: 10 },
  earth_power: { name: 'Telluriforce', type: 'ground', cat: 'special', power: 90, acc: 100, pp: 10 },
  bulldoze: { name: 'Piétinement', type: 'ground', cat: 'physical', power: 60, acc: 100, pp: 20 },

  // --- VOL ---
  peck: { name: 'Picpic', type: 'flying', cat: 'physical', power: 35, acc: 100, pp: 35 },
  gust: { name: 'Tornade', type: 'flying', cat: 'special', power: 40, acc: 100, pp: 35 },
  brave_bird: { name: 'Rapace', type: 'flying', cat: 'physical', power: 120, acc: 100, recoil: 0.33, pp: 15 },
  air_slash: { name: 'Lame d\'Air', type: 'flying', cat: 'special', power: 75, acc: 95, pp: 15, flinch: 30 },
  hurricane: { name: 'Vent Violent', type: 'flying', cat: 'special', power: 110, acc: 70, pp: 10 },
  roost: { name: 'Atterrissage', type: 'flying', cat: 'status', power: 0, acc: 100, effect: { type: 'heal', val: 0.5 }, pp: 10 },

  // --- PSY ---
  psychic: { name: 'Psyko', type: 'psychic', cat: 'special', power: 90, acc: 100, pp: 10 },
  psyshock: { name: 'Choc Psy', type: 'psychic', cat: 'special', power: 80, acc: 100, pp: 10 },
  zen_headbutt: { name: 'Psykoud\'Boul', type: 'psychic', cat: 'physical', power: 80, acc: 90, pp: 15, flinch: 20 },
  calm_mind: { name: 'Plénitude', type: 'psychic', cat: 'status', power: 0, acc: 100, effect: { type: 'stat', target: 'self', stat: 'spa', val: 1 }, pp: 20 },
  hypnosis: { name: 'Hypnose', type: 'psychic', cat: 'status', power: 0, acc: 60, effect: { type: 'status', status: 'sleep', chance: 100 }, pp: 20 },

  // --- ROCHE ---
  stone_edge: { name: 'Lame de Roc', type: 'rock', cat: 'physical', power: 100, acc: 80, crit: 2, pp: 5 },
  rock_slide: { name: 'Éboulement', type: 'rock', cat: 'physical', power: 75, acc: 90, flinch: 30, pp: 10 },
  power_gem: { name: 'Rayon Gemme', type: 'rock', cat: 'special', power: 80, acc: 100, pp: 20 },

  // --- SPECTRE ---
  shadow_ball: { name: 'Ball\'Ombre', type: 'ghost', cat: 'special', power: 80, acc: 100, pp: 15 },
  shadow_claw: { name: 'Griffe Ombre', type: 'ghost', cat: 'physical', power: 70, acc: 100, crit: 2, pp: 15 },
  shadow_sneak: { name: 'Ombre Portée', type: 'ghost', cat: 'physical', power: 40, acc: 100, priority: 1, pp: 30 },

  // --- DRAGON ---
  dragon_pulse: { name: 'Dracochoc', type: 'dragon', cat: 'special', power: 85, acc: 100, pp: 10 },
  draco_meteor: { name: 'Draco-Météore', type: 'dragon', cat: 'special', power: 130, acc: 90, pp: 5, effect: { type: 'stat', target: 'self', stat: 'spa', val: -2 } },
  dragon_claw: { name: 'Dracogriffe', type: 'dragon', cat: 'physical', power: 80, acc: 100, pp: 15 },
  outrage: { name: 'Colère', type: 'dragon', cat: 'physical', power: 120, acc: 100, pp: 10 },
  dragon_dance: { name: 'Danse Draco', type: 'dragon', cat: 'status', power: 0, acc: 100, effect: { type: 'stat', target: 'self', stat: 'atk', val: 1 }, pp: 20 },

  // --- TÉNÈBRES ---
  bite: { name: 'Morsure', type: 'dark', cat: 'physical', power: 60, acc: 100, pp: 25 },
  dark_pulse: { name: 'Vibrobscur', type: 'dark', cat: 'special', power: 80, acc: 100, flinch: 20, pp: 15 },
  crunch: { name: 'Mâchouille', type: 'dark', cat: 'physical', power: 80, acc: 100, pp: 15 },
  sucker_punch: { name: 'Coup Bas', type: 'dark', cat: 'physical', power: 70, acc: 100, priority: 1, pp: 5 },
  nasty_plot: { name: 'Machination', type: 'dark', cat: 'status', power: 0, acc: 100, effect: { type: 'stat', target: 'self', stat: 'spa', val: 2 }, pp: 20 },

  // --- ACIER ---
  iron_head: { name: 'Tête de Fer', type: 'steel', cat: 'physical', power: 80, acc: 100, flinch: 30, pp: 15 },
  flash_cannon: { name: 'Luminocanon', type: 'steel', cat: 'special', power: 80, acc: 100, pp: 10 },
  meteor_mash: { name: 'Poing Météore', type: 'steel', cat: 'physical', power: 90, acc: 90, pp: 10 },

  // --- INSECTE ---
  bug_bite: { name: 'Piqûre', type: 'bug', cat: 'physical', power: 60, acc: 100, pp: 20 },
  x_scissor: { name: 'Plaie-Croix', type: 'bug', cat: 'physical', power: 80, acc: 100, pp: 15 },
  bug_buzz: { name: 'Bourdon', type: 'bug', cat: 'special', power: 90, acc: 100, pp: 10 },
  u_turn: { name: 'Demi-Tour', type: 'bug', cat: 'physical', power: 70, acc: 100, pp: 20 },

  // --- POISON ---
  sludge_bomb: { name: 'Bomb-Beurk', type: 'poison', cat: 'special', power: 90, acc: 100, pp: 10, effect: { type: 'status', status: 'poison', chance: 30 } },
  poison_jab: { name: 'Direct Toxik', type: 'poison', cat: 'physical', power: 80, acc: 100, pp: 20, effect: { type: 'status', status: 'poison', chance: 30 } },
  toxic: { name: 'Toxik', type: 'poison', cat: 'status', power: 0, acc: 90, effect: { type: 'status', status: 'toxic', chance: 100 }, pp: 10 },

  // --- FÉE ---
  fairy_wind: { name: 'Vent Féérique', type: 'fairy', cat: 'special', power: 40, acc: 100, pp: 30 },
  moonblast: { name: 'Pouvoir Lunaire', type: 'fairy', cat: 'special', power: 95, acc: 100, pp: 15 },
  play_rough: { name: 'Câlinerie', type: 'fairy', cat: 'physical', power: 90, acc: 90, pp: 10 },
  dazzling_gleam: { name: 'Éclat Magique', type: 'fairy', cat: 'special', power: 80, acc: 100, pp: 20 },
};
