// pokemon/engine/abilities.js
// Talents des Pokémon du tournoi (noms français et talents possibles : PokeAPI). Chaque Pokémon reçoit le meilleur
// talent qu'il peut avoir parmi ceux que le moteur sait jouer ; une forme Méga prend le talent de sa forme Méga.
// Les effets sont appliqués par battle.js grâce aux petites fonctions ci-dessous.

export const ABILITIES = {
 "huge-power": {
  "name": "Coloforce",
  "desc": "Double l'Attaque.",
  "score": 100
 },
 "speed-boost": {
  "name": "Turbo",
  "desc": "La Vitesse monte d'un cran à la fin de chaque tour.",
  "score": 95
 },
 "multiscale": {
  "name": "Multiécaille",
  "desc": "Divise par deux les dégâts reçus quand ses PV sont au maximum.",
  "score": 95
 },
 "adaptability": {
  "name": "Adaptabilité",
  "desc": "Bonus des attaques de son type ×2 au lieu de ×1,5.",
  "score": 90
 },
 "drizzle": {
  "name": "Crachin",
  "desc": "Fait tomber la pluie en arrivant (5 tours) : Eau ×1,5, Feu ×0,5.",
  "score": 90
 },
 "drought": {
  "name": "Sécheresse",
  "desc": "Fait briller le soleil en arrivant (5 tours) : Feu ×1,5, Eau ×0,5.",
  "score": 90
 },
 "sand-stream": {
  "name": "Sable Volant",
  "desc": "Déclenche une tempête de sable en arrivant (5 tours) : blesse tout le monde sauf Roche, Sol et Acier ; Déf. Spé. des Roche ×1,5.",
  "score": 90
 },
 "delta-stream": {
  "name": "Souffle Delta",
  "desc": "Vents violents en arrivant : annule la météo et les faiblesses du type Vol.",
  "score": 90
 },
 "intimidate": {
  "name": "Intimidation",
  "desc": "En arrivant, baisse l'Attaque de l'adversaire d'un cran.",
  "score": 88
 },
 "magic-guard": {
  "name": "Garde Magik",
  "desc": "Ne subit que les dégâts des attaques (ni poison, ni brûlure, ni contrecoup, ni sable).",
  "score": 85
 },
 "pixilate": {
  "name": "Peau Féérique",
  "desc": "Les attaques Normal deviennent Fée et gagnent ×1,2.",
  "score": 85
 },
 "aerilate": {
  "name": "Peau Céleste",
  "desc": "Les attaques Normal deviennent Vol et gagnent ×1,2.",
  "score": 85
 },
 "dragonize": {
  "name": "Peau Draconique",
  "desc": "Les attaques Normal deviennent Dragon et gagnent ×1,2.",
  "score": 85
 },
 "mega-launcher": {
  "name": "Méga Blaster",
  "desc": "Attaques « aura » et « vibro » ×1,5.",
  "score": 85
 },
 "moxie": {
  "name": "Impudence",
  "desc": "L'Attaque monte d'un cran à chaque Pokémon mis K.O.",
  "score": 82
 },
 "levitate": {
  "name": "Lévitation",
  "desc": "Immunisé contre les attaques de type Sol.",
  "score": 80
 },
 "technician": {
  "name": "Technicien",
  "desc": "Attaques de puissance 60 ou moins ×1,5.",
  "score": 80
 },
 "regenerator": {
  "name": "Régé-Force",
  "desc": "Récupère 1/3 de ses PV en quittant le combat.",
  "score": 80
 },
 "tough-claws": {
  "name": "Griffe Dure",
  "desc": "Attaques au contact ×1,3.",
  "score": 80
 },
 "strong-jaw": {
  "name": "Prognathe",
  "desc": "Attaques de morsure ×1,5.",
  "score": 80
 },
 "shadow-tag": {
  "name": "Marque Ombre",
  "desc": "L'adversaire ne peut pas changer de Pokémon (sauf les Spectre).",
  "score": 80
 },
 "mega-sol": {
  "name": "Méga-Soleil",
  "desc": "Ses attaques se comportent comme sous un soleil ardent.",
  "score": 80
 },
 "guts": {
  "name": "Cran",
  "desc": "Attaque ×1,5 quand il a un statut (et la brûlure ne la baisse plus).",
  "score": 78
 },
 "sheer-force": {
  "name": "Sans Limite",
  "desc": "Attaques à effet secondaire ×1,3, mais sans leur effet.",
  "score": 78
 },
 "magic-bounce": {
  "name": "Miroir Magik",
  "desc": "Renvoie les attaques de statut à l'envoyeur.",
  "score": 78
 },
 "poison-heal": {
  "name": "Soin Poison",
  "desc": "Le poison le soigne de 1/8 de ses PV au lieu de le blesser.",
  "score": 76
 },
 "filter": {
  "name": "Filtre",
  "desc": "Réduit d'un quart les dégâts super efficaces.",
  "score": 75
 },
 "no-guard": {
  "name": "Annule Garde",
  "desc": "Ses attaques et celles qui le visent touchent à coup sûr.",
  "score": 74
 },
 "swift-swim": {
  "name": "Glissade",
  "desc": "Vitesse ×2 sous la pluie.",
  "score": 74
 },
 "chlorophyll": {
  "name": "Chlorophylle",
  "desc": "Vitesse ×2 au soleil.",
  "score": 74
 },
 "flash-fire": {
  "name": "Torche",
  "desc": "Immunisé contre le Feu ; s'il en reçoit, ses attaques Feu passent ×1,5.",
  "score": 72
 },
 "water-absorb": {
  "name": "Absorbe-Eau",
  "desc": "Les attaques Eau le soignent d'un quart de ses PV au lieu de le blesser.",
  "score": 72
 },
 "volt-absorb": {
  "name": "Absorbe-Volt",
  "desc": "Les attaques Électrik le soignent d'un quart de ses PV au lieu de le blesser.",
  "score": 72
 },
 "thick-fat": {
  "name": "Isograisse",
  "desc": "Dégâts Feu et Glace divisés par deux.",
  "score": 72
 },
 "lightning-rod": {
  "name": "Paratonnerre",
  "desc": "Attire l'Électrik : immunisé, et son Att. Spé. monte d'un cran.",
  "score": 70
 },
 "sap-sipper": {
  "name": "Herbivore",
  "desc": "Immunisé contre la Plante, et son Attaque monte d'un cran.",
  "score": 70
 },
 "sturdy": {
  "name": "Fermeté",
  "desc": "À PV pleins, survit toujours à un coup avec 1 PV.",
  "score": 70
 },
 "mold-breaker": {
  "name": "Brise Moule",
  "desc": "Ses attaques ignorent le talent de la cible.",
  "score": 70
 },
 "air-lock": {
  "name": "Air Lock",
  "desc": "Annule les effets de la météo tant qu'il est au combat.",
  "score": 70
 },
 "solar-power": {
  "name": "Force Soleil",
  "desc": "Att. Spé. ×1,5 au soleil, mais perd 1/8 de ses PV par tour.",
  "score": 70
 },
 "competitive": {
  "name": "Battant",
  "desc": "Si l'adversaire baisse ses stats, son Att. Spé. monte de deux crans.",
  "score": 68
 },
 "reckless": {
  "name": "Téméraire",
  "desc": "Attaques à contrecoup ×1,2.",
  "score": 66
 },
 "clear-body": {
  "name": "Corps Sain",
  "desc": "L'adversaire ne peut pas baisser ses statistiques.",
  "score": 66
 },
 "unburden": {
  "name": "Délestage",
  "desc": "Vitesse ×2 une fois son objet consommé.",
  "score": 66
 },
 "marvel-scale": {
  "name": "Écaille Spéciale",
  "desc": "Défense ×1,5 quand il a un statut.",
  "score": 65
 },
 "quick-feet": {
  "name": "Pied Véloce",
  "desc": "Vitesse ×1,5 quand il a un statut (la paralysie ne le ralentit plus).",
  "score": 64
 },
 "rough-skin": {
  "name": "Peau Dure",
  "desc": "Qui le frappe au contact perd 1/8 de ses PV.",
  "score": 62
 },
 "justified": {
  "name": "Cœur Noble",
  "desc": "Touché par une attaque Ténèbres, son Attaque monte d'un cran.",
  "score": 60
 },
 "sand-force": {
  "name": "Force Sable",
  "desc": "Dans le sable, attaques Roche, Sol et Acier ×1,3 ; insensible au sable.",
  "score": 60
 },
 "rock-head": {
  "name": "Tête de Roc",
  "desc": "Ne subit pas de contrecoup.",
  "score": 60
 },
 "super-luck": {
  "name": "Chanceux",
  "desc": "Coups critiques plus fréquents.",
  "score": 58
 },
 "static": {
  "name": "Statik",
  "desc": "30 % de chances de paralyser qui le frappe au contact.",
  "score": 55
 },
 "flame-body": {
  "name": "Corps Ardent",
  "desc": "30 % de chances de brûler qui le frappe au contact.",
  "score": 55
 },
 "effect-spore": {
  "name": "Pose Spore",
  "desc": "30 % de chances d'endormir, paralyser ou empoisonner qui le frappe au contact.",
  "score": 54
 },
 "poison-point": {
  "name": "Point Poison",
  "desc": "30 % de chances d'empoisonner qui le frappe au contact.",
  "score": 52
 },
 "weak-armor": {
  "name": "Armurouillée",
  "desc": "Frappé par une attaque physique : Défense −1, Vitesse +2.",
  "score": 52
 },
 "cursed-body": {
  "name": "Corps Maudit",
  "desc": "30 % de chances de bloquer l'attaque qui le touche pendant 3 tours.",
  "score": 50
 },
 "overgrow": {
  "name": "Engrais",
  "desc": "Attaques Plante ×1,5 quand ses PV passent sous le tiers.",
  "score": 50
 },
 "blaze": {
  "name": "Brasier",
  "desc": "Attaques Feu ×1,5 quand ses PV passent sous le tiers.",
  "score": 50
 },
 "torrent": {
  "name": "Torrent",
  "desc": "Attaques Eau ×1,5 quand ses PV passent sous le tiers.",
  "score": 50
 },
 "swarm": {
  "name": "Essaim",
  "desc": "Attaques Insecte ×1,5 quand ses PV passent sous le tiers.",
  "score": 50
 },
 "inner-focus": {
  "name": "Attention",
  "desc": "N'a jamais peur, et Intimidation ne marche pas sur lui.",
  "score": 50
 },
 "steadfast": {
  "name": "Impassible",
  "desc": "Sa Vitesse monte d'un cran quand il a peur.",
  "score": 48
 },
 "shell-armor": {
  "name": "Coque Armure",
  "desc": "Ne subit jamais de coup critique.",
  "score": 45
 },
 "pressure": {
  "name": "Pression",
  "desc": "Les attaques qui le visent coûtent 2 PP.",
  "score": 45
 },
 "immunity": {
  "name": "Vaccin",
  "desc": "Ne peut pas être empoisonné.",
  "score": 44
 },
 "limber": {
  "name": "Échauffement",
  "desc": "Ne peut pas être paralysé.",
  "score": 44
 },
 "insomnia": {
  "name": "Insomnia",
  "desc": "Ne peut pas s'endormir.",
  "score": 44
 },
 "rain-dish": {
  "name": "Cuvette",
  "desc": "Récupère 1/16 de ses PV par tour sous la pluie.",
  "score": 40
 },
 "hydration": {
  "name": "Hydratation",
  "desc": "Soigne son statut à la fin du tour sous la pluie.",
  "score": 40
 },
 "unnerve": {
  "name": "Tension",
  "desc": "L'adversaire ne peut pas manger de baie.",
  "score": 40
 },
 "harvest": {
  "name": "Récolte",
  "desc": "Une baie mangée a une chance sur deux de repousser (toujours au soleil).",
  "score": 40
 },
 "trace": {
  "name": "Calque",
  "desc": "En arrivant, copie le talent de l'adversaire.",
  "score": 40
 },
 "synchronize": {
  "name": "Synchro",
  "desc": "Brûlé, paralysé ou empoisonné par l'adversaire : il lui transmet ce statut.",
  "score": 35
 },
 "early-bird": {
  "name": "Matinal",
  "desc": "Se réveille deux fois plus vite.",
  "score": 35
 },
 "leaf-guard": {
  "name": "Feuille Garde",
  "desc": "Ne peut pas recevoir de statut au soleil.",
  "score": 30
 },
 "overcoat": {
  "name": "Envelocape",
  "desc": "Insensible à la tempête de sable.",
  "score": 30
 },
 "sand-veil": {
  "name": "Voile Sable",
  "desc": "Insensible à la tempête de sable.",
  "score": 30
 }
};

/** Talent retenu pour chaque Pokémon (numéro du Pokédex) et chaque forme Méga (numéro de forme PokeAPI) */
const PICK = {"3": "chlorophyll", "6": "solar-power", "9": "torrent", "25": "lightning-rod", "26": "lightning-rod", "34": "sheer-force", "59": "intimidate", "62": "swift-swim", "65": "magic-guard", "68": "guts", "91": "shell-armor", "94": "cursed-body", "103": "chlorophyll", "106": "reckless", "112": "lightning-rod", "130": "intimidate", "131": "water-absorb", "134": "water-absorb", "135": "volt-absorb", "136": "guts", "143": "thick-fat", "144": "pressure", "145": "static", "146": "flame-body", "149": "multiscale", "150": "pressure", "151": "synchronize", "154": "overgrow", "157": "flash-fire", "160": "sheer-force", "169": "inner-focus", "181": "static", "184": "huge-power", "196": "magic-bounce", "197": "inner-focus", "212": "technician", "214": "moxie", "227": "sturdy", "229": "flash-fire", "232": "sturdy", "248": "sand-stream", "249": "multiscale", "250": "regenerator", "254": "unburden", "257": "speed-boost", "260": "torrent", "282": "trace", "286": "technician", "306": "sturdy", "310": "lightning-rod", "319": "speed-boost", "330": "levitate", "350": "competitive", "359": "justified", "373": "intimidate", "376": "clear-body", "382": "drizzle", "383": "drought", "384": "air-lock", "448": "justified", "445": "rough-skin", "10033": "thick-fat", "10034": "tough-claws", "10035": "drought", "10036": "mega-launcher", "10037": "trace", "10038": "shadow-tag", "10041": "mold-breaker", "10281": "multiscale", "10043": "steadfast", "10044": "insomnia", "10282": "mega-sol", "10283": "dragonize", "10045": "mold-breaker", "10046": "technician", "10047": null, "10284": null, "10048": "solar-power", "10049": "sand-stream", "10065": "lightning-rod", "10050": "speed-boost", "10064": "swift-swim", "10051": "pixilate", "10053": "filter", "10055": "intimidate", "10070": "strong-jaw", "10057": "magic-bounce", "10089": "aerilate", "10076": "tough-claws", "10079": "delta-stream", "10058": "sand-force", "10059": "adaptability"};

export const abilityOf = (id) => PICK[id] || null;
export const abilityName = (k) => (ABILITIES[k] ? ABILITIES[k].name : '');

// ------------------------------------------------------------------ données utiles aux effets
export const NON_CONTACT = new Set(['earthquake', 'bulldoze', 'rock_throw', 'stone_edge', 'rock_slide', 'ice_shard', 'seed_bomb']);
export const BITE = new Set(['bite', 'crunch']);
export const PULSE = new Set(['water_pulse', 'dark_pulse', 'aura_sphere', 'dragon_pulse']);
export const isContact = (moveId, move) => !!move && move.cat === 'physical' && !NON_CONTACT.has(moveId);
export const hasSecondary = (move) => !!move && (!!move.flinch || (move.effect && move.effect.chance && move.effect.target !== 'self') || (move.effect && move.effect.type === 'status' && move.cat !== 'status'));
const PINCH = { overgrow: 'grass', blaze: 'fire', torrent: 'water', swarm: 'bug' };
const SKIN = { pixilate: 'fairy', aerilate: 'flying', dragonize: 'dragon' };

/** Talent qui compte vraiment (l'attaquant Brise Moule ignore celui de sa cible) */
export const ab = (poke, attacker) => (!poke ? null : attacker && attacker !== poke && attacker.ability === 'mold-breaker' ? null : poke.ability || null);

/** Météo active (annulée tant qu'un Pokémon au Ciel Gris est au combat) */
export function weatherOf(state) {
  const w = state && state.weather;
  if (!w || !w.type) return null;
  const act = [state.teamA && state.teamA[state.activeA], state.teamB && state.teamB[state.activeB]];
  if (act.some((p) => p && !p.fainted && p.ability === 'air-lock')) return null;
  return w.type;
}

/** Type réel d'une attaque (Peau Féérique, Peau Céleste, Peau Draconique) */
export function moveTypeFor(attacker, move) {
  const s = SKIN[attacker && attacker.ability];
  return s && move.type === 'normal' ? s : move.type;
}

/** Multiplicateur de puissance venant du talent de l'attaquant */
export function attackerPower(attacker, moveId, move, weather) {
  let k = 1;
  const a = attacker.ability;
  if (a === 'technician' && move.power <= 60) k *= 1.5;
  if (PINCH[a] === move.type && attacker.hp <= attacker.maxHp / 3) k *= 1.5;
  if (a === 'sheer-force' && hasSecondary(move)) k *= 1.3;
  if (a === 'reckless' && move.recoil) k *= 1.2;
  if (a === 'tough-claws' && isContact(moveId, move)) k *= 1.3;
  if (a === 'strong-jaw' && BITE.has(moveId)) k *= 1.5;
  if (a === 'mega-launcher' && PULSE.has(moveId)) k *= 1.5;
  if (SKIN[a] && move.type === 'normal') k *= 1.2;
  if (a === 'sand-force' && weather === 'sand' && ['rock', 'ground', 'steel'].includes(move.type)) k *= 1.3;
  if (attacker.flashFire && moveTypeFor(attacker, move) === 'fire') k *= 1.5;
  return k;
}

/** Statistique d'attaque modifiée par le talent */
export function attackStatMod(attacker, isPhys, weather) {
  const a = attacker.ability;
  let k = 1;
  if (isPhys && a === 'huge-power') k *= 2;
  if (isPhys && a === 'guts' && attacker.status) k *= 1.5;
  if (!isPhys && a === 'solar-power' && weather === 'sun') k *= 1.5;
  return k;
}

/** Statistique de défense modifiée par le talent ou la météo */
export function defenseStatMod(defender, isPhys, weather, attacker) {
  let k = 1;
  if (isPhys && ab(defender, attacker) === 'marvel-scale' && defender.status) k *= 1.5;
  if (!isPhys && weather === 'sand' && defender.types.includes('rock')) k *= 1.5;
  return k;
}

/** Dégâts finaux réduits par le talent du défenseur */
export function defenderDamageMod(defender, moveType, typeMult, attacker) {
  const a = ab(defender, attacker);
  let k = 1;
  if (a === 'thick-fat' && (moveType === 'fire' || moveType === 'ice')) k *= 0.5;
  if (a === 'multiscale' && defender.hp === defender.maxHp) k *= 0.5;
  if (a === 'filter' && typeMult >= 2) k *= 0.75;
  return k;
}

/** Bonus de la météo sur les attaques */
export function weatherPower(moveType, weather) {
  if (weather === 'rain') return moveType === 'water' ? 1.5 : moveType === 'fire' ? 0.5 : 1;
  if (weather === 'sun') return moveType === 'fire' ? 1.5 : moveType === 'water' ? 0.5 : 1;
  return 1;
}

/** Vitesse modifiée par le talent */
export function speedMod(poke, weather) {
  const a = poke.ability;
  let k = 1;
  if (a === 'swift-swim' && weather === 'rain') k *= 2;
  if (a === 'chlorophyll' && weather === 'sun') k *= 2;
  if (a === 'quick-feet' && poke.status) k *= 1.5;
  if (a === 'unburden' && poke.itemUsed) k *= 2;
  return k;
}

/** Le talent empêche-t-il ce statut ? */
export function blocksStatus(poke, status, weather) {
  const a = poke.ability;
  if (a === 'immunity' && (status === 'poison' || status === 'toxic')) return true;
  if (a === 'limber' && status === 'paralysis') return true;
  if (a === 'insomnia' && status === 'sleep') return true;
  if (a === 'leaf-guard' && weather === 'sun') return true;
  return false;
}

/** Immunité par absorption : renvoie { heal } (Absorb Eau / Volt Absorb), { boost: [stat, n] } (Paratonnerre, Herbivore),
    { flashFire: true } (Torche), { immune: true } (Lévitation) ou null */
export function absorbs(defender, moveType, attacker) {
  const a = ab(defender, attacker);
  if (a === 'levitate' && moveType === 'ground') return { immune: true };
  if (a === 'flash-fire' && moveType === 'fire') return { flashFire: true };
  if (a === 'water-absorb' && moveType === 'water') return { heal: true };
  if (a === 'volt-absorb' && moveType === 'electric') return { heal: true };
  if (a === 'lightning-rod' && moveType === 'electric') return { boost: ['spa', 1] };
  if (a === 'sap-sipper' && moveType === 'grass') return { boost: ['atk', 1] };
  return null;
}
