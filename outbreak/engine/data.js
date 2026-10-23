// Données d'Outbreak : armes, zombies, améliorations, salles, difficulté. Aucun DOM ici.

// ---------------------------------------------------------------- armes
// rate : tirs/s · spread : demi-angle de dispersion (rad) · pen : cibles traversées · knock : recul infligé
export const WEAPONS = {
  pistol: { id: 'pistol', name: 'Pistolet P9', short: 'P9', tier: 0, dmg: 24, rate: 4.6, mag: 12, res: Infinity, resMax: Infinity, reload: 1.0,
    speed: 1700, range: 950, pellets: 1, spread: 0.035, pen: 1, knock: 70, shake: 2, kick: 18, sound: 'pistol', color: '#ffe27a' },
  smg: { id: 'smg', name: 'Mitraillette Vipère', short: 'SMG', tier: 1, dmg: 15, rate: 12, mag: 32, res: 160, resMax: 288, reload: 1.5,
    speed: 1600, range: 760, pellets: 1, spread: 0.11, pen: 1, knock: 35, shake: 1.6, kick: 10, sound: 'smg', color: '#ffd65a' },
  shotgun: { id: 'shotgun', name: 'Fusil à pompe Molosse', short: 'POMPE', tier: 1, dmg: 13, rate: 1.45, mag: 6, res: 30, resMax: 54, reload: 1.9,
    speed: 1450, range: 540, pellets: 9, spread: 0.3, pen: 1, knock: 150, shake: 7, kick: 70, sound: 'shotgun', color: '#ffb44a' },
  rifle: { id: 'rifle', name: "Fusil d'assaut Faucon", short: 'FA', tier: 2, dmg: 30, rate: 8.5, mag: 30, res: 120, resMax: 240, reload: 1.8,
    speed: 2100, range: 1150, pellets: 1, spread: 0.05, pen: 2, knock: 60, shake: 2.4, kick: 16, sound: 'rifle', color: '#fff09a' },
  flamer: { id: 'flamer', name: 'Lance-flammes Brasier', short: 'FLAM', tier: 2, dmg: 6, rate: 26, mag: 120, res: 240, resMax: 480, reload: 2.2,
    speed: 560, range: 330, pellets: 1, spread: 0.22, pen: 99, knock: 6, shake: 0.6, kick: 2, sound: 'flamer', color: '#ff8a2a', flame: true, burn: 3 },
  launcher: { id: 'launcher', name: 'Lance-grenades Tonnerre', short: 'LG', tier: 3, dmg: 130, rate: 1.5, mag: 6, res: 18, resMax: 36, reload: 2.4,
    speed: 900, range: 760, pellets: 1, spread: 0.03, pen: 1, knock: 0, shake: 4, kick: 60, sound: 'launcher', color: '#9ad05a', explosive: 125 },
  rail: { id: 'rail', name: 'Fusil à rail Aiguille', short: 'RAIL', tier: 3, dmg: 210, rate: 1.1, mag: 5, res: 20, resMax: 45, reload: 2.3,
    speed: 4200, range: 1700, pellets: 1, spread: 0.004, pen: 12, knock: 240, shake: 6, kick: 90, sound: 'rail', color: '#7ff0ff', rail: true },
  minigun: { id: 'minigun', name: 'Minigun Broyeur', short: 'MINI', tier: 3, dmg: 15, rate: 21, mag: 150, res: 300, resMax: 600, reload: 3.0,
    speed: 1900, range: 900, pellets: 1, spread: 0.13, pen: 1, knock: 40, shake: 1.5, kick: 6, sound: 'minigun', color: '#ffe066', spinUp: 0.55, slow: 0.72 },
  // mêlée : pas de munitions, frappe en arc devant soi
  katana: { id: 'katana', name: 'Katana Ronin', short: 'KATANA', tier: 1, dmg: 62, rate: 2.6, mag: 1, res: Infinity, resMax: Infinity, reload: 0,
    speed: 0, range: 92, pellets: 1, spread: 0, pen: 99, knock: 160, shake: 3, kick: -90, sound: 'slash', color: '#e8f4ff', melee: true, arc: 1.15 },
  crossbow: { id: 'crossbow', name: 'Arbalète Chasseresse', short: 'ARBA', tier: 2, dmg: 140, rate: 1.25, mag: 1, res: 30, resMax: 50, reload: 0.75,
    speed: 1500, range: 1300, pellets: 1, spread: 0.008, pen: 5, knock: 200, shake: 2.5, kick: 30, sound: 'crossbow', color: '#d9c39a', bolt: true },
  tesla: { id: 'tesla', name: 'Canon Tesla', short: 'TESLA', tier: 3, dmg: 34, rate: 3.2, mag: 20, res: 60, resMax: 120, reload: 2.0,
    speed: 0, range: 520, pellets: 1, spread: 0, pen: 1, knock: 50, shake: 2.2, kick: 20, sound: 'tesla', color: '#9fd8ff', tesla: 5 },
};
export const WEAPON_IDS = Object.keys(WEAPONS);
export const GRENADE = { dmg: 170, radius: 145, fuse: 1.3, maxThrow: 440, max: 3 };

// ---------------------------------------------------------------- zombies
export const ZOMBIES = {
  walker: { id: 'walker', name: 'Rôdeur', hp: 70, speed: 78, dmg: 12, cd: 0.95, r: 16, score: 100, drop: 0.12 },
  runner: { id: 'runner', name: 'Coureur', hp: 46, speed: 200, dmg: 9, cd: 0.6, r: 14, score: 150, drop: 0.14 },
  crawler: { id: 'crawler', name: 'Rampant', hp: 34, speed: 118, dmg: 8, cd: 0.8, r: 13, score: 80, drop: 0.08 },
  spitter: { id: 'spitter', name: 'Cracheur', hp: 85, speed: 74, dmg: 14, cd: 2.6, r: 16, score: 250, drop: 0.3, range: 430 },
  bloater: { id: 'bloater', name: 'Gonflé', hp: 170, speed: 54, dmg: 34, cd: 1, r: 24, score: 300, drop: 0.35, blast: 115 },
  brute: { id: 'brute', name: 'Brute', hp: 680, speed: 70, dmg: 30, cd: 1.3, r: 29, score: 800, drop: 1, charge: 520 },
  screamer: { id: 'screamer', name: 'Hurleuse', hp: 120, speed: 96, dmg: 8, cd: 1, r: 15, score: 400, drop: 0.6 },
  armored: { id: 'armored', name: 'Blindé', hp: 260, speed: 66, dmg: 18, cd: 1.1, r: 21, score: 450, drop: 0.5 },
  stalker: { id: 'stalker', name: 'Traqueur', hp: 140, speed: 150, dmg: 10, cd: 0.5, r: 15, score: 500, drop: 0.5, pounce: 640 },
  larva: { id: 'larva', name: 'Larve', hp: 16, speed: 175, dmg: 4, cd: 0.45, r: 9, score: 25, drop: 0.02 },
  abomination: { id: 'abomination', name: "L'Abomination", hp: 2600, speed: 84, dmg: 28, cd: 1.2, r: 40, score: 2500, drop: 0 },
  mother: { id: 'mother', name: 'La Mère des Cracheurs', hp: 1800, speed: 50, dmg: 20, cd: 1.2, r: 36, score: 2500, drop: 0 },
  colossus: { id: 'colossus', name: 'Le Colosse', hp: 8600, speed: 80, dmg: 40, cd: 1.2, r: 54, score: 6000, drop: 0 },
  queen: { id: 'queen', name: 'La Reine', hp: 5200, speed: 150, dmg: 24, cd: 0.7, r: 34, score: 6000, drop: 0, pounce: 720 },
  boss: { id: 'boss', name: 'Spécimen Zéro', hp: 7200, speed: 92, dmg: 38, cd: 1.1, r: 50, score: 5000, drop: 0 },
};
export const ZOMBIE_IDS = Object.keys(ZOMBIES);
export const FINAL_BOSSES = ['boss', 'colossus', 'queen'];
export const MINI_BOSSES = ['abomination', 'mother'];
const BIG = new Set([...FINAL_BOSSES, ...MINI_BOSSES]);
export const isBig = (ty) => BIG.has(ty);

// ---------------------------------------------------------------- améliorations (cartes entre les salles)
// rar : 0 commun, 1 rare, 2 épique · max : niveaux cumulables
export const PERKS = {
  dmg: { name: 'Calibre lourd', desc: '+20 % de dégâts', icon: '💥', rar: 0, max: 5 },
  rate: { name: 'Gâchette facile', desc: '+15 % de cadence de tir', icon: '⚡', rar: 0, max: 4 },
  mag: { name: 'Chargeurs étendus', desc: '+35 % de balles par chargeur', icon: '📦', rar: 0, max: 3 },
  reload: { name: 'Mains rapides', desc: 'Rechargement 25 % plus rapide', icon: '🔄', rar: 0, max: 3 },
  speed: { name: 'Semelles de course', desc: '+10 % de vitesse de déplacement', icon: '👟', rar: 0, max: 3 },
  hp: { name: 'Peau épaisse', desc: '+25 PV max (et soigne 25)', icon: '❤️', rar: 0, max: 4 },
  armor: { name: 'Plaques céramique', desc: '+25 armure max, armure remplie', icon: '🛡️', rar: 0, max: 3 },
  ammo: { name: 'Poches profondes', desc: '+50 % de munitions en réserve, réserves remplies', icon: '🎒', rar: 0, max: 2 },
  medic: { name: 'Infirmier de terrain', desc: 'Relève 2× plus vite ; les alliés relevés ont +30 PV', icon: '🩹', rar: 0, max: 2 },
  dash: { name: 'Réflexes', desc: 'Roulade rechargée 35 % plus vite, +1 roulade', icon: '🌀', rar: 1, max: 2 },
  pierce: { name: 'Balles perforantes', desc: 'Chaque balle traverse un zombie de plus', icon: '🎯', rar: 1, max: 3 },
  crit: { name: 'Œil de lynx', desc: '+12 % de chances de coup critique (×2,5)', icon: '👁️', rar: 1, max: 3 },
  vamp: { name: 'Sang froid', desc: 'Chaque zombie éliminé rend 2 PV', icon: '🩸', rar: 1, max: 3 },
  fire: { name: 'Balles incendiaires', desc: '20 % de chances d’enflammer la cible', icon: '🔥', rar: 1, max: 2 },
  nade: { name: 'Grenadier', desc: '+1 grenade max, explosions +30 % plus larges', icon: '💣', rar: 1, max: 2 },
  magnet: { name: 'Aimant', desc: 'Ramasse les objets de loin', icon: '🧲', rar: 0, max: 1 },
  team: { name: "Esprit d'équipe", desc: 'Les alliés proches font +15 % de dégâts', icon: '🤝', rar: 1, max: 2 },
  rage: { name: 'Dernier rempart', desc: 'Sous 35 % de PV : +40 % de dégâts et de vitesse', icon: '😤', rar: 1, max: 1 },
  second: { name: 'Second souffle', desc: 'Se relève seul une fois par salle', icon: '💉', rar: 2, max: 1 },
  ricochet: { name: 'Ricochets', desc: 'Les balles rebondissent sur les murs', icon: '↩️', rar: 2, max: 1 },
  chain: { name: 'Réaction en chaîne', desc: 'Les zombies éliminés ont 15 % de chances d’exploser', icon: '☢️', rar: 2, max: 1 },
  regen: { name: 'Nanites', desc: 'Régénère 1,5 PV par seconde', icon: '🧬', rar: 2, max: 2 },
};
export const PERK_IDS = Object.keys(PERKS);

// ---------------------------------------------------------------- salles
// reward : ce que l'équipe gagne en nettoyant la salle (annoncé sur la porte)
export const ROOM_TYPES = {
  start: { name: 'Sas de décontamination', theme: 'sas', reward: null },
  armory: { name: 'Armurerie', theme: 'armory', reward: 'Armes lourdes', icon: '🔫' },
  medbay: { name: 'Infirmerie', theme: 'medbay', reward: 'Soins et armure', icon: '➕' },
  lab: { name: 'Laboratoire', theme: 'lab', reward: 'Double amélioration', icon: '🧪' },
  storage: { name: 'Entrepôt', theme: 'storage', reward: 'Munitions et grenades', icon: '📦' },
  core: { name: 'Noyau — Spécimen Zéro', theme: 'core', reward: 'Victoire', icon: '☣️' },
  arena: { name: 'Hangar de quarantaine', theme: 'arena', reward: null },
  shop: { name: 'Chez Dédé, ferrailleur', theme: 'shop', reward: 'Marchand · pas de combat', icon: '🛒' },
  vault: { name: 'Coffre-fort', theme: 'vault', reward: 'Trésor piégé', icon: '💰' },
  dark: { name: 'Salle obscure', theme: 'dark', reward: 'Ferraille ×2', icon: '🌑' },
  gas: { name: 'Salle contaminée', theme: 'gas', reward: 'Améliorations rares', icon: '☣️' },
};
export const SPECIAL_TYPES = ['vault', 'dark', 'gas'];
// Marchand : prix en ferraille (les consommables renchérissent à chaque achat)
export const SHOP_ITEMS = {
  med: { name: 'Trousse de soin', icon: '➕', price: 10 },
  armor: { name: 'Plaque d\'armure', icon: '🛡️', price: 10 },
  nade: { name: 'Grenade', icon: '💣', price: 9 },
  ammo: { name: 'Munitions', icon: '📦', price: 8 },
  perk: { name: 'Amélioration au choix', icon: '⭐', price: 28 },
  weapon: { name: 'Arme', icon: '🔫', price: 24 },
};
export const BRANCH_TYPES = ['armory', 'medbay', 'lab', 'storage'];
export const CAMPAIGN_ROOMS = 7; // 6 salles puis le Noyau

export const DIFFICULTY = {
  arcade: { name: 'Arcade', zHp: 0.75, zDmg: 0.65, budget: 0.9, drops: 1.4, bleed: 35, adrenaline: 2 },
  normal: { name: 'Normale', zHp: 1, zDmg: 1, budget: 1, drops: 1, bleed: 28, adrenaline: 1 },
  hardcore: { name: 'Cauchemar', zHp: 1.2, zDmg: 1.3, budget: 1.15, drops: 0.75, bleed: 16, adrenaline: 0 },
};

// ---------------------------------------------------------------- classes de survivants
// cd : recharge de la capacité (s) · dur : durée de l'effet
export const CLASSES = {
  soldier: { id: 'soldier', name: 'Soldat', icon: '🎖️', color: '#ffc531', cd: 28, dur: 7,
    passive: '+10 % de dégâts, une grenade de plus', active: 'Barrage', activeDesc: 'Munitions infinies et cadence +50 % pendant 7 s' },
  medic: { id: 'medic', name: 'Médecin', icon: '⚕️', color: '#2fbf71', cd: 26, dur: 5,
    passive: 'Relève 2× plus vite, les soins ramassés soignent aussi les alliés proches', active: 'Station de soin', activeDesc: 'Zone qui soigne et relève tout le monde pendant 5 s' },
  engineer: { id: 'engineer', name: 'Ingénieur', icon: '🔧', color: '#ff8a1f', cd: 30, dur: 22,
    passive: 'Les caisses donnent plus, munitions +25 %', active: 'Tourelle', activeDesc: 'Pose une tourelle automatique pendant 22 s' },
  tank: { id: 'tank', name: 'Colosse', icon: '🛡️', color: '#2b8cff', cd: 24, dur: 5,
    passive: '+50 PV max, +25 armure max, un peu plus lent', active: 'Provocation', activeDesc: 'Attire les zombies proches et réduit les dégâts reçus de 75 % pendant 5 s' },
  scout: { id: 'scout', name: 'Éclaireur', icon: '🦅', color: '#b45cff', cd: 20, dur: 5,
    passive: 'Deux roulades, +8 % de vitesse, critiques plus fréquents', active: 'Ombre', activeDesc: 'Les zombies le perdent de vue, +40 % de vitesse et de dégâts pendant 5 s' },
};
export const CLASS_IDS = Object.keys(CLASSES);

// Couleurs des équipiers IA
export const BOT_NAMES = [['Vega', '#ff9f1c'], ['Rook', '#2fbf71'], ['Moss', '#b45cff'], ['Kilo', '#ff5fa2']];
export const PLAYER_COLORS = ['#2b8cff', '#ff4b2b', '#ffc531', '#1fc7c1', '#b45cff', '#2fbf71'];

// Codes compacts pour le réseau
export const ZTYPE_CODE = ZOMBIE_IDS;
export const WEAPON_CODE = WEAPON_IDS;
