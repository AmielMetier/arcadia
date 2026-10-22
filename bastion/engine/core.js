// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Outils, données d'équilibrage, cartes.
'use strict';

/* ============================================================================
   BASTION CLASH — RTS 3D VUE DU DESSUS (ÉDITION STARCRAFT PURE)
   - Sélection stricte à la StarCraft :
     * Par défaut (rien sélectionné) : aucune construction ni production possible.
     * Pour construire un bâtiment : il faut cliquer sur un Ouvrier VCS.
     * Pour entraîner des Ouvriers VCS : il faut cliquer sur son QG.
     * Pour entraîner l'infanterie : il faut cliquer sur une Caserne.
     * Pour produire des blindés/mechas : il faut cliquer sur une Usine.
   - Moteur de projection 3D Vue du Dessus (Top-Down 3D Perspective) :
     * Extrusion volumétrique 3D réelle (prismes, cylindres, pyramides, octaèdres)
       avec calcul d'éclairage directionnel par face et point de fuite caméra.
   ============================================================================ */

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const dist2 = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;
const hypot = (x1, y1, x2, y2) => Math.hypot(x1 - x2, y1 - y2);
const TAU = Math.PI * 2;

let WORLD_SIZE = 3600;
let HALF_W = WORLD_SIZE / 2;
const TICK_RATE = 30;
const TICK_DT = 1 / TICK_RATE;
const MAX_SUPPLY = 100;

function shade(hex, f) {
  let c = String(hex || '#888888').replace('#', '');
  if (c.length === 3) c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
  const n = parseInt(c, 16) || 0;
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  if (f < 0) { const k = 1 + f; r = Math.round(r * k); g = Math.round(g * k); b = Math.round(b * k); }
  else { r = Math.round(r + (255 - r) * f); g = Math.round(g + (255 - g) * f); b = Math.round(b + (255 - b) * f); }
  return '#' + [r, g, b].map((v) => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}

function mulberry(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================================
   DONNÉES D'ÉQUILIBRAGE RTS (BÂTIMENTS & UNITÉS STARCRAFT)
   ============================================================================ */
const BUILDINGS = {
  hq: {
    name: 'Centre de Commandement', short: 'QG', min: 350, gas: 0, buildTime: 36,
    hp: 3400, radius: 48, height: 54, supply: 15, sight: 440, range: 255, dmg: 24, rate: 0.85,
    trains: ['scv'], desc: 'Clique sur le QG pour entraîner des Ouvriers VCS [E] ou lancer un Scan Radar [C].',
  },
  pylon: {
    name: 'Dépôt Relais', short: 'Dépôt', min: 75, gas: 0, buildTime: 14,
    hp: 550, radius: 22, height: 48, supply: 10, sight: 280, range: 175, dmg: 0, rate: 0, heal: 8,
    trains: [], desc: 'Fournit +10 Ravitaillement 📦 et régénère les unités alliées proches.',
  },
  extractor: {
    name: 'Raffinerie de Gaz', short: 'Raffinerie', min: 75, gas: 0, buildTime: 16,
    hp: 700, radius: 28, height: 42, supply: 0, sight: 240, range: 0, dmg: 0, rate: 0,
    trains: [], onGeyser: true, desc: 'Se construit sur un Geyser de Gaz Plasma 🧪 pour que tes VCS récoltent du Gaz.',
  },
  barracks: {
    name: 'Caserne Militaire', short: 'Caserne', min: 125, gas: 0, buildTime: 22,
    hp: 1100, radius: 36, height: 40, supply: 0, sight: 300, range: 0, dmg: 0, rate: 0,
    trains: ['marine', 'rocket', 'sapper'], desc: 'Clique sur la Caserne pour entraîner Marines [E], Maraudeurs [R] et Faucheurs [T].',
  },
  factory: {
    name: 'Usine Blindée', short: 'Usine', min: 150, gas: 75, buildTime: 26,
    hp: 1450, radius: 41, height: 46, supply: 0, sight: 310, range: 0, dmg: 0, rate: 0,
    trains: ['tank', 'siege', 'titan'], req: 'barracks', desc: 'Clique sur l’Usine pour produire Chars Goliath [E], Chars de Siège [R] et Mechas Thor [T].',
  },
  starport: {
    name: 'Spatioport Spatial', short: 'Spatioport', min: 150, gas: 100, buildTime: 28,
    hp: 1250, radius: 42, height: 48, supply: 0, sight: 330, range: 0, dmg: 0, rate: 0,
    trains: ['dropship', 'medivac'], req: 'factory', desc: 'Structure aéronautique : produit des Navettes de Transport [E] et des Navettes Médicales [R].',
  },
  turret: {
    name: 'Bunker Mitrailleur', short: 'Bunker', min: 100, gas: 0, buildTime: 16,
    hp: 850, radius: 25, height: 36, supply: 0, sight: 320, range: 260, dmg: 22, rate: 0.35,
    trains: [], desc: 'Tourelle défensive 3D sol-air à double canon rotatif ultra rapide.',
  },
  tesla: {
    name: 'Bobine Tesla', short: 'Tesla', min: 125, gas: 50, buildTime: 20,
    hp: 1000, radius: 28, height: 58, supply: 0, sight: 350, range: 320, dmg: 64, rate: 1.25, splash: 58,
    trains: [], req: 'barracks', desc: 'Tour haute tension : projette des arcs de plasma sol-air dévastateurs.',
  },
  wall: {
    name: 'Mur Blindé', short: 'Mur', min: 25, gas: 0, buildTime: 8,
    hp: 1100, radius: 20, height: 28, supply: 0, sight: 160, range: 0, dmg: 0, rate: 0,
    trains: [], desc: 'Rempart blindé 3D pour bloquer les couloirs (se connecte aux murs voisins).',
  },
  armory: {
    name: 'Armurerie Tech', short: 'Armurerie', min: 125, gas: 50, buildTime: 24,
    hp: 1000, radius: 34, height: 42, supply: 0, sight: 280, range: 0, dmg: 0, rate: 0,
    trains: [], req: 'barracks', desc: 'Débloque et recherche les améliorations d’armement, blindage et propulsion de tes troupes.',
  },
  radar: {
    name: 'Tour de Détection', short: 'Détection', min: 100, gas: 25, buildTime: 18,
    hp: 650, radius: 20, height: 72, supply: 0, sight: 660, range: 0, dmg: 0, rate: 0,
    detector: true, trains: [], req: 'barracks',
    desc: 'Tourelle de détection : immense rayon de vision, voit aussi sur les plateaux et donne l’alerte (son + minimap) dès qu’un ennemi entre dans sa zone.',
  },
};

const UPGRADES = {
  infantry_weapons: {
    id: 'infantry_weapons',
    name: 'Balles Perforantes',
    short: 'Armes Infanterie',
    min: 100, gas: 50, time: 26,
    icon: '⚔️',
    desc: '+12% Dégâts par niveau (3 niveaux) pour Marines, Maraudeurs et Faucheurs.',
    appliesTo: ['marine', 'rocket', 'sapper'],
    maxLevel: 3, dmgPerLevel: 0.12,
  },
  infantry_armor: {
    id: 'infantry_armor',
    name: 'Blindage Renforcé',
    short: 'Armure Infanterie',
    min: 100, gas: 25, time: 26,
    icon: '🛡️',
    desc: '+10% PV Max par niveau (3 niveaux) pour Marines, Maraudeurs et Faucheurs.',
    appliesTo: ['marine', 'rocket', 'sapper'],
    maxLevel: 3, hpPerLevel: 0.10,
  },
  vehicle_weapons: {
    id: 'vehicle_weapons',
    name: 'Obus Haute Énergie',
    short: 'Canons Blindés',
    min: 125, gas: 75, time: 30,
    icon: '💥',
    desc: '+12% Dégâts par niveau (3 niveaux) pour Goliaths, Chars de Siège et Mechas Thor.',
    appliesTo: ['tank', 'siege', 'titan'],
    maxLevel: 3, dmgPerLevel: 0.12,
  },
  vehicle_armor: {
    id: 'vehicle_armor',
    name: 'Coques en Titane',
    short: 'Blindage Blindés',
    min: 125, gas: 50, time: 30,
    icon: '🦾',
    desc: '+10% PV Max par niveau (3 niveaux) pour Goliaths, Chars de Siège et Mechas Thor.',
    appliesTo: ['tank', 'siege', 'titan'],
    maxLevel: 3, hpPerLevel: 0.10,
  },
  advanced_thrusters: {
    id: 'advanced_thrusters',
    name: 'Propulseurs Surchargés',
    short: 'Vitesse Armée',
    min: 75, gas: 50, time: 22,
    icon: '⚡',
    desc: '+18% Vitesse de déplacement pour toutes les unités de combat (au sol et dans les airs).',
    appliesTo: ['marine', 'rocket', 'sapper', 'tank', 'siege', 'titan', 'dropship', 'medivac'],
    maxLevel: 1, speedPerLevel: 0.18,
  },
};

// Améliorations par paliers : chaque niveau coûte 50 % de plus et prend 25 % de temps en plus
function upgLevel(owner, id) {
  const v = owner && owner.upgrades ? owner.upgrades[id] : 0;
  return v === true ? 1 : Number(v) || 0;
}
function upgCost(owner, id) {
  const d = UPGRADES[id];
  const level = upgLevel(owner, id) + 1;
  const f = 1 + 0.5 * (level - 1);
  return { level, maxed: level > (d.maxLevel || 1), min: Math.round(d.min * f), gas: Math.round(d.gas * f), time: Math.round(d.time * (1 + 0.25 * (level - 1))) };
}
function upgMult(owner, kind, field) {
  let m = 1;
  for (const d of Object.values(UPGRADES)) {
    if (d[field] && d.appliesTo.includes(kind)) m *= 1 + d[field] * upgLevel(owner, d.id);
  }
  return m;
}
const unitDmgMult = (owner, kind) => upgMult(owner, kind, 'dmgPerLevel');
const unitHpMult = (owner, kind) => upgMult(owner, kind, 'hpPerLevel');
const unitSpeedMult = (owner, kind) => upgMult(owner, kind, 'speedPerLevel');

const UNITS = {
  scv: {
    name: 'Ouvrier VCS', short: 'VCS', min: 50, gas: 0, supply: 1, trainTime: 12,
    hp: 90, radius: 6.0, speed: 98, range: 48, dmg: 7, rate: 0.65, sight: 250, bldMult: 1.0, score: 8,
    desc: 'Construit les bâtiments (B puis 1-0 ou R), récolte minéraux et gaz, répare.',
  },
  marine: {
    name: 'Marine Commando', short: 'Marine', min: 50, gas: 0, supply: 1, trainTime: 11,
    hp: 135, radius: 10.5, speed: 96, range: 135, dmg: 14, rate: 0.48, sight: 270, bldMult: 1.0, score: 12,
    canStim: true, desc: 'Soldat d’assaut polyvalent sol-air équipé du Stimpack (T).',
  },
  rocket: {
    name: 'Maraudeur Lourd', short: 'Maraudeur', min: 75, gas: 25, supply: 2, trainTime: 16,
    hp: 195, radius: 12, speed: 84, range: 175, dmg: 28, rate: 0.95, sight: 280, bldMult: 1.5, score: 20,
    canStim: true, desc: 'Infanterie blindée anti-chars munie de grenades à concussion et Stimpack (T).',
  },
  sapper: {
    name: 'Faucheur Démolisseur', short: 'Faucheur', min: 75, gas: 50, supply: 2, trainTime: 17,
    hp: 175, radius: 11.5, speed: 114, range: 68, dmg: 48, rate: 0.78, sight: 290, bldMult: 2.6, score: 25,
    desc: 'Unité ultra-rapide à charges explosives D-8 dévastatrices contre les bâtiments.',
  },
  tank: {
    name: 'Char Goliath', short: 'Goliath', min: 125, gas: 50, supply: 3, trainTime: 21,
    hp: 520, radius: 18, speed: 72, range: 190, dmg: 44, rate: 1.02, sight: 300, bldMult: 1.3, score: 40,
    mech: true, desc: 'Char de combat principal robuste et polyvalent (tir sol-air).',
  },
  siege: {
    name: 'Char de Siège', short: 'Siège', min: 150, gas: 100, supply: 3, trainTime: 26,
    hp: 400, radius: 18, speed: 62, range: 210, siegeRange: 440, dmg: 46, siegeDmg: 95, rate: 1.35, siegeRate: 2.1,
    sight: 350, bldMult: 1.75, splash: 64, mech: true, canSiege: true,
    desc: 'Peut passer en Mode Siège (E) : artillerie lourde sol-sol à portée géante et dégâts de zone.',
  },
  titan: {
    name: 'Mecha Thor', short: 'Thor', min: 250, gas: 150, supply: 6, trainTime: 34,
    hp: 1650, radius: 25, speed: 56, range: 230, dmg: 115, rate: 0.92, sight: 360, bldMult: 1.65, splash: 66,
    mech: true, desc: 'Colosse mécanique bipède 3D armé de canons plasma jumelés et missiles sol-air.',
  },
  dropship: {
    name: 'Navette de Transport', short: 'Transport', min: 100, gas: 50, supply: 2, trainTime: 20,
    hp: 310, radius: 16, speed: 112, range: 0, dmg: 0, rate: 0, sight: 340, bldMult: 1.0, score: 25,
    flying: true, maxCargo: 4, desc: 'Vaisseau de transport aérien volant. Clic Droit sur troupes pour embarquer [max 4], Débarquer [V] pour larguer.',
  },
  medivac: {
    name: 'Navette Médicale', short: 'Médic', min: 75, gas: 75, supply: 2, trainTime: 18,
    hp: 250, radius: 14, speed: 104, range: 190, dmg: 0, rate: 0.5, sight: 340, bldMult: 1.0, score: 25,
    flying: true, healer: true, healRate: 24, desc: 'Vaisseau médical aérien volant. Projette en continu un rayon nanite soignant les unités alliées blessées.',
  },
};

const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2'];
const BOT_NAMES = ['Commandant Raynor', 'Général Mengsk', 'Amiral Horner', 'Maréchal Valerian'];

const MAP_DEFS = {
  vallee: {
    id: 'vallee',
    name: 'Vallée Tempérée',
    icon: '🌲',
    theme: 'temperee',
    desc: 'Bassin verdoyant géant équilibré avec expansions naturelles et abondance de minéraux dorés au centre.',
    badge: 'Carte Immense & Abondance Centrale',
    badgeDesc: 'Format StarCraft 2 étendu · Expansions naturelles de base · 8 filons d\'or riches au centre.',
    fogColor: 0x091410,
    fogNear: 1800,
    fogFar: 5400,
    sunColor: 0xfff4d8,
    hemiSky: 0xe4f5ff,
    hemiGround: 0x1d3822,
    rimColor: 0x6ecbff,
    moveSpeedMult: 1.0,
    mineHarvestTime: 1.55,
    gasHarvestMult: 1.0,
    splashMult: 1.0,
    scanRadiusMult: 1.0,
    look: {
      accent: '#ffc531', plat: ['#585c69', '#454954'], rock: '#6e685f', geyRim: '#435449', gas: '#2fbf71',
      mineral: ['#1fc7c1', '#ffc531'], mineralEm: [0x0ea5a0, 0xffa800],
      liquid: { color: '#2f86c0', emissive: '#0b3a58', glow: 0.3, opacity: 0.74, rough: 0.22, solid: false },
      decor: 'tree', decorCount: 230, liquidLabel: 'la rivière',
    },
  },
  magma: {
    id: 'magma',
    name: 'Fissures de Magma',
    icon: '🌋',
    theme: 'volcanique',
    desc: 'Croûte basaltique géante déchirée par des rivières de lave. Fortes tensions géothermiques.',
    badge: 'Surtension Géothermique & Chokepoints',
    badgeDesc: '+50% Gaz récolté · +20% Rayon de déflagration d\'artillerie · 2 Geysers de départ et super-geysers centraux.',
    fogColor: 0x180906,
    fogNear: 1600,
    fogFar: 5000,
    sunColor: 0xffa048,
    hemiSky: 0xffc89a,
    hemiGround: 0x361008,
    rimColor: 0xff5522,
    moveSpeedMult: 1.0,
    mineHarvestTime: 1.55,
    gasHarvestMult: 1.5,
    splashMult: 1.20,
    scanRadiusMult: 1.0,
    look: {
      accent: '#ff5500', plat: ['#261a22', '#3c242c'], rock: '#251c20', geyRim: '#332428', gas: '#ff5500',
      mineral: ['#ff4b2b', '#ffd700'], mineralEm: [0xd42b00, 0xffa000],
      liquid: { color: '#ff5a00', emissive: '#ff3000', glow: 1.0, opacity: 1, rough: 0.22, solid: true },
      decor: 'volcano', decorCount: 170, liquidLabel: 'la lave',
    },
  },
  glace: {
    id: 'glace',
    name: 'Glacier Boréal',
    icon: '❄️',
    theme: 'cryo',
    desc: 'Étendue polaire glaciaire aux crevasses luminescentes et plateaux surplombants.',
    badge: 'Supraconductivité Cryo & Hyper-Cristaux',
    badgeDesc: '+20% Vitesse de déplacement · Forage de minerai 35% plus rapide · Portée radar Comsat étendue.',
    fogColor: 0x06131c,
    fogNear: 1750,
    fogFar: 5200,
    sunColor: 0xd6f0ff,
    hemiSky: 0xbfeaff,
    hemiGround: 0x0e2a3c,
    rimColor: 0x38bdf8,
    moveSpeedMult: 1.20,
    mineHarvestTime: 1.00,
    gasHarvestMult: 1.0,
    splashMult: 1.0,
    scanRadiusMult: 1.32,
    look: {
      accent: '#00f0ff', plat: ['#27475d', '#1e384b'], rock: '#2b506b', geyRim: '#26485e', gas: '#00f0ff',
      mineral: ['#38bdf8', '#c084fc'], mineralEm: [0x0284c7, 0x9333ea],
      liquid: { color: '#8ee9ff', emissive: '#0a7fa0', glow: 0.3, opacity: 0.8, rough: 0.12, solid: false },
      decor: 'crystal', decorCount: 170, liquidLabel: 'la crevasse',
    },
  },
  desert: {
    id: 'desert',
    name: 'Canyon de Cuivre',
    icon: '🏜️',
    theme: 'aride',
    desc: 'Plateaux de grès rouge, mesas et oasis turquoise sous un soleil écrasant.',
    badge: 'Chaleur & Minerai Affleurant',
    badgeDesc: '-15% de vision pour tous · récolte des minéraux 20% plus rapide · oasis infranchissables au lieu d\'une rivière.',
    fogColor: 0x2a1a10,
    fogNear: 1700,
    fogFar: 5200,
    sunColor: 0xffe0b0,
    hemiSky: 0xffe7c2,
    hemiGround: 0x5a3a22,
    rimColor: 0xff9a5c,
    moveSpeedMult: 1.0,
    mineHarvestTime: 1.25,
    gasHarvestMult: 1.0,
    splashMult: 1.0,
    scanRadiusMult: 1.0,
    unitSightMult: 0.85,
    bldSightMult: 0.85,
    look: {
      accent: '#ff9f1c', plat: ['#6b4a33', '#5a3d29'], rock: '#9c5a3c', geyRim: '#5e4433', gas: '#b6ff3d',
      mineral: ['#2ec4b6', '#ffd166'], mineralEm: [0x0f9488, 0xffb000],
      liquid: { color: '#1fb3c4', emissive: '#0b4a50', glow: 0.35, opacity: 0.82, rough: 0.18, solid: false },
      decor: 'cactus', decorCount: 150, liquidLabel: 'l\'oasis',
    },
  },
  ruines: {
    id: 'ruines',
    name: 'Ruines Néon',
    icon: '🌃',
    theme: 'nocturne',
    desc: 'Cité abandonnée de nuit : canaux toxiques, piliers effondrés et enseignes qui grésillent.',
    badge: 'Nuit Urbaine & Avant-postes Riches',
    badgeDesc: '-20% de vision des unités (les bâtiments voient normalement) · cristaux dorés dans toutes les bases avancées.',
    fogColor: 0x07080f,
    fogNear: 1600,
    fogFar: 5000,
    sunColor: 0xb8c2ff,
    hemiSky: 0x6a74b8,
    hemiGround: 0x101220,
    rimColor: 0xff3df2,
    moveSpeedMult: 1.0,
    mineHarvestTime: 1.55,
    gasHarvestMult: 1.0,
    splashMult: 1.0,
    scanRadiusMult: 1.0,
    unitSightMult: 0.8,
    bldSightMult: 1.0,
    richExpos: true,
    look: {
      accent: '#ff3df2', plat: ['#2a2d3a', '#1f2230'], rock: '#3a3f52', geyRim: '#2f3346', gas: '#7cff4f',
      mineral: ['#3df2ff', '#ffd23d'], mineralEm: [0x00d0ff, 0xffa000],
      liquid: { color: '#2fff8a', emissive: '#0fbf5a', glow: 0.85, opacity: 0.85, rough: 0.2, solid: false },
      decor: 'pillar', decorCount: 190, liquidLabel: 'le canal toxique',
    },
  },
};
