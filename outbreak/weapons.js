// ============================================================================
// OUTBREAK : SECTEUR ZÉRO - WEAPONS & ARSENAL DEFINITIONS
// ============================================================================

export const WEAPON_TYPES = {
  pistol: {
    id: 'pistol',
    name: 'P250 Service',
    category: 'Arme de poing',
    damage: 28,
    fireRate: 4.2, // tirs par seconde
    magSize: 12,
    reserveMax: 120,
    reloadTime: 1.2, // secondes
    bulletSpeed: 1100,
    range: 750,
    pellets: 1,
    spread: 0.04, // radians
    recoilKick: 2.2,
    screenShake: 2.5,
    penetration: 1, // touche 1 cible
    sound: 'pistol',
    color: '#ffe57f',
    bulletLength: 12,
    bulletWidth: 3,
    description: 'Arme réglementaire fiable. Précise à moyenne portée avec munitions abondantes.',
    tier: 1
  },
  shotgun: {
    id: 'shotgun',
    name: 'SPAS-12 Tactique',
    category: 'Fusil à pompe',
    damage: 18, // par plomb (x8 = 144 max point-blank!)
    fireRate: 1.3,
    magSize: 8,
    reserveMax: 48,
    reloadTime: 2.2,
    bulletSpeed: 950,
    range: 520,
    pellets: 8,
    spread: 0.22,
    recoilKick: 7.5,
    screenShake: 7.0,
    penetration: 1,
    knockback: 180,
    sound: 'shotgun',
    color: '#ff9800',
    bulletLength: 9,
    bulletWidth: 3.5,
    description: 'Dévastateur à courte portée. Repousse violemment les grappes de zombies.',
    tier: 2
  },
  smg: {
    id: 'smg',
    name: 'MP5-SD Furtif',
    category: 'Pistolet mitrailleur',
    damage: 20,
    fireRate: 10.5, // cadence effrénée
    magSize: 30,
    reserveMax: 180,
    reloadTime: 1.4,
    bulletSpeed: 1050,
    range: 650,
    pellets: 1,
    spread: 0.09,
    recoilKick: 2.0,
    screenShake: 2.0,
    penetration: 1,
    sound: 'smg',
    color: '#ffd54f',
    bulletLength: 10,
    bulletWidth: 2.5,
    description: 'Excellente cadence de tir pour faucher les vagues rapides.',
    tier: 2
  },
  rifle: {
    id: 'rifle',
    name: 'M4A1 Carabine',
    category: 'Fusil d\'assaut',
    damage: 42,
    fireRate: 6.8,
    magSize: 25,
    reserveMax: 150,
    reloadTime: 1.7,
    bulletSpeed: 1250,
    range: 900,
    pellets: 1,
    spread: 0.035,
    recoilKick: 3.8,
    screenShake: 3.5,
    penetration: 2, // transperce jusqu'à 2 zombies
    sound: 'rifle',
    color: '#4fc3f7',
    bulletLength: 16,
    bulletWidth: 3.5,
    description: 'Fusil militaire puissant perforant plusieurs cibles alignées.',
    tier: 3
  },
  grenade_launcher: {
    id: 'grenade_launcher',
    name: 'M79 Démolisseur',
    category: 'Lance-grenades',
    damage: 180, // explosion de zone
    splashRadius: 130,
    fireRate: 0.8,
    magSize: 1,
    reserveMax: 12,
    reloadTime: 2.0,
    bulletSpeed: 620,
    range: 600,
    pellets: 1,
    spread: 0.02,
    recoilKick: 9.0,
    screenShake: 12.0,
    penetration: 1,
    isExplosive: true,
    sound: 'grenade',
    color: '#ff5252',
    bulletLength: 14,
    bulletWidth: 8,
    description: 'Projette une grenade explosive causant de massifs dégâts de zone.',
    tier: 3
  }
};

// Types de butin au sol (caisses, munitions, soins)
export const PICKUP_TYPES = {
  ammo_small: {
    id: 'ammo_small',
    label: 'Boîte de munitions',
    color: '#fbc02d',
    amount: { pistol: 24, shotgun: 8, smg: 45, rifle: 30, grenade_launcher: 2 },
    sound: 'reload'
  },
  ammo_large: {
    id: 'ammo_large',
    label: 'Caisse de ravitaillement militaire',
    color: '#ffb300',
    amount: { pistol: 48, shotgun: 16, smg: 90, rifle: 60, grenade_launcher: 4 },
    sound: 'reload'
  },
  medkit: {
    id: 'medkit',
    label: 'Trousse de premiers soins',
    color: '#00e676',
    healAmount: 40,
    sound: 'pickup'
  },
  armor: {
    id: 'armor',
    label: 'Gilet pare-balles en kevlar',
    color: '#29b6f6',
    armorAmount: 50,
    sound: 'pickup'
  },
  weapon_drop: {
    id: 'weapon_drop',
    label: 'Arme abandonnée',
    color: '#ab47bc',
    sound: 'reload'
  }
};
