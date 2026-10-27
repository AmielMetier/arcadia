// Le butin : armes (6 sortes × 4 raretés), munitions, soins, boucliers, grenades, objets de déplacement, matériaux.
// Tables de butin des coffres, du sol et des caisses de munitions. Moteur PUR.

// raretés : gris, vert, bleu, violet
export const RARITY = [
  { id: 0, label: 'Commun', color: '#a3a8ad' },
  { id: 1, label: 'Rare', color: '#3fbf4a' },
  { id: 2, label: 'Très rare', color: '#3d8fe8' },
  { id: 3, label: 'Épique', color: '#a557e0' },
];

export const AMMO = {
  legeres: { label: 'Munitions légères', short: 'Légères', color: '#c9d4e8', drop: 18, max: 999 },
  moyennes: { label: 'Munitions moyennes', short: 'Moyennes', color: '#7fd0a0', drop: 20, max: 999 },
  lourdes: { label: 'Munitions lourdes', short: 'Lourdes', color: '#4f8fd8', drop: 6, max: 999 },
  cartouches: { label: 'Cartouches', short: 'Cartouches', color: '#e8b84a', drop: 6, max: 999 },
  roquettes: { label: 'Roquettes', short: 'Roquettes', color: '#e05a4a', drop: 3, max: 99 },
};
export const MATERIALS = { bois: { label: 'Bois', color: '#c08a52' }, pierre: { label: 'Pierre', color: '#a9a49a' }, metal: { label: 'Métal', color: '#8fa3ad' } };
export const MAT_MAX = 999;

// armes : dégâts selon la rareté, cadence (tirs/s), chargeur, rechargement (s), dispersion (rad, hanche / visée),
// portée (m) et baisse des dégâts (début → fin, part restante), multiplicateur à la tête, auto : tir maintenu
export const WEAPONS = {
  fusil: {
    label: 'Fusil d\'assaut', ammo: 'moyennes', dmg: [30, 31, 33, 35], rate: 5.5, mag: 30, reload: [2.4, 2.3, 2.2, 2.1],
    spread: [0.045, 0.011], bloom: 0.012, range: 180, falloff: [50, 180, 0.65], head: 1.5, auto: true, struct: 1, zoom: 1.4,
  },
  pompe: {
    label: 'Fusil à pompe', ammo: 'cartouches', dmg: [10, 10.5, 11, 12], pellets: 10, rate: 1.05, mag: 5, reload: [4.6, 4.4, 4.2, 4.0],
    spread: [0.11, 0.085], bloom: 0, range: 40, falloff: [7, 40, 0.25], head: 1.7, auto: false, struct: 0.6, zoom: 1.15,
  },
  pistolet: {
    label: 'Pistolet', ammo: 'legeres', dmg: [24, 25, 26, 27], rate: 6.5, mag: 16, reload: [1.5, 1.45, 1.4, 1.3],
    spread: [0.035, 0.014], bloom: 0.01, range: 110, falloff: [30, 110, 0.6], head: 1.6, auto: false, struct: 0.8, zoom: 1.25,
  },
  smg: {
    label: 'Pistolet-mitrailleur', ammo: 'legeres', dmg: [17, 18, 19, 20], rate: 11, mag: 30, reload: [2.2, 2.1, 2.0, 1.9],
    spread: [0.055, 0.028], bloom: 0.009, range: 80, falloff: [20, 80, 0.55], head: 1.5, auto: true, struct: 0.7, zoom: 1.2,
  },
  sniper: {
    label: 'Fusil de précision', ammo: 'lourdes', dmg: [95, 100, 105, 110], rate: 0.35, mag: 1, reload: [3.0, 2.9, 2.8, 2.7],
    spread: [0.12, 0], bloom: 0, range: 450, falloff: [450, 450, 1], head: 2.5, auto: false, struct: 1.4, zoom: 4,
    // une vraie balle : elle vole (≈ 1 s pour 450 m), tombe, et dérive à droite (Coriolis, voir sim.js)
    bullet: { speed: 460, g: 9.81 },
  },
  roquette: {
    label: 'Lance-roquettes', ammo: 'roquettes', dmg: [100, 105, 110, 116], rate: 0.75, mag: 1, reload: [3.2, 3.0, 2.9, 2.8],
    spread: [0.02, 0.01], bloom: 0, range: 300, falloff: [300, 300, 1], head: 1, auto: false, struct: 4, zoom: 1.3, rocket: { speed: 55, radius: 4.5 },
  },
};

// consommables : soins (pv jusqu'à max), bouclier, durée d'utilisation (s), pile max, rareté fixe ; grenades et objets lancés
export const ITEMS = {
  bandage: { label: 'Bandages', rarity: 0, heal: 15, max: 75, time: 3.2, stack: 15, drop: 5 },
  soin: { label: 'Trousse de soin', rarity: 1, heal: 100, max: 100, time: 9, stack: 3, drop: 1 },
  potion_petite: { label: 'Petite potion de bouclier', rarity: 1, shield: 25, maxShield: 50, time: 2, stack: 6, drop: 3 },
  potion: { label: 'Potion de bouclier', rarity: 2, shield: 50, maxShield: 100, time: 5, stack: 3, drop: 1 },
  grenade: { label: 'Grenade', rarity: 1, throw: 'grenade', dmg: 100, radius: 5, fuse: 2.6, struct: 3, stack: 6, drop: 3 },
  souffle: { label: 'Grenade de souffle', rarity: 3, throw: 'souffle', radius: 6, fuse: 1.2, push: 26, stack: 3, drop: 2 },
  tremplin: { label: 'Tremplin', rarity: 2, place: 'tremplin', stack: 1, drop: 1, lift: 70 },
};

// ------------------------------------------------------------------ objets d'inventaire
export const weapon = (w, r) => ({ t: 'arme', w, r, mag: WEAPONS[w].mag });
export const item = (c, n = ITEMS[c].drop) => ({ t: 'objet', c, n, r: ITEMS[c].rarity });
export const ammo = (a, n = AMMO[a].drop) => ({ t: 'munitions', a, n, r: 0 });
export const mats = (m, n) => ({ t: 'materiaux', m, n, r: 0 });

export function itemLabel(it) {
  if (it.t === 'arme') return `${WEAPONS[it.w].label} ${RARITY[it.r].label.toLowerCase()}`;
  if (it.t === 'objet') return ITEMS[it.c].label + (it.n > 1 ? ` × ${it.n}` : '');
  if (it.t === 'munitions') return `${AMMO[it.a].label} × ${it.n}`;
  return `${MATERIALS[it.m].label} × ${it.n}`;
}
export function weaponDamage(it, dist, head) {
  const W = WEAPONS[it.w], [f0, f1, keep] = W.falloff;
  const k = dist <= f0 ? 1 : dist >= f1 ? keep : 1 - (1 - keep) * (dist - f0) / (f1 - f0);
  return W.dmg[it.r] * k * (head ? W.head : 1);
}

// ------------------------------------------------------------------ tables de butin
const RAR_FLOOR = [[0, 52], [1, 31], [2, 13], [3, 4]];
const RAR_CHEST = [[0, 22], [1, 40], [2, 27], [3, 11]];
const W_FLOOR = [['fusil', 26], ['pompe', 20], ['pistolet', 22], ['smg', 20], ['sniper', 7], ['roquette', 5]];
const W_CHEST = [['fusil', 26], ['pompe', 22], ['pistolet', 12], ['smg', 20], ['sniper', 11], ['roquette', 9]];
const C_FLOOR = [['bandage', 30], ['potion_petite', 26], ['potion', 10], ['soin', 9], ['grenade', 14], ['souffle', 5], ['tremplin', 6]];
const C_CHEST = [['bandage', 18], ['potion_petite', 24], ['potion', 18], ['soin', 14], ['grenade', 14], ['souffle', 6], ['tremplin', 6]];

// une arme et ses munitions
function armed(rng, rar, wt) {
  const w = rng.weighted(wt), r = rng.weighted(rar);
  return [weapon(w, r), ammo(WEAPONS[w].ammo, AMMO[WEAPONS[w].ammo].drop * (w === 'roquette' ? 1 : 2))];
}
// butin au sol : rien (un quart des fois), une arme et ses munitions, un consommable ou des munitions
export function rollFloor(rng) {
  const r = rng.next();
  if (r < 0.18) return [];
  if (r < 0.66) return armed(rng, RAR_FLOOR, W_FLOOR);
  if (r < 0.88) return [item(rng.weighted(C_FLOOR))];
  return [ammo(rng.pick(Object.keys(AMMO).filter((a) => a !== 'roquettes')))];
}
// coffre : une arme et ses munitions, un consommable, des matériaux, parfois un second objet
export function rollChest(rng) {
  const out = [...armed(rng, RAR_CHEST, W_CHEST), item(rng.weighted(C_CHEST)), mats(rng.pick(['bois', 'bois', 'pierre', 'metal']), 30)];
  if (rng.chance(0.35)) out.push(item(rng.weighted(C_CHEST)));
  return out;
}
// caisse de munitions : deux sortes
export function rollAmmoBox(rng) {
  const keys = rng.shuffle(Object.keys(AMMO).filter((a) => a !== 'roquettes'));
  const out = [ammo(keys[0]), ammo(keys[1])];
  if (rng.chance(0.15)) out.push(ammo('roquettes', 2));
  return out;
}
