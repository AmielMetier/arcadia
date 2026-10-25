// Convoy Storm — simulation (moteur pur, sans DOM ni réseau ; testée par tools/test-convoy.mjs).
// L'hôte la fait tourner à 60 Hz et diffuse snapshot() 20 fois par seconde. Les invités rejouent stepPlayer()
// pour prédire leur propre déplacement (mêmes règles, même géométrie).
//
// Deux modes : « expedition » (rallier la ville au bout de la ligne, avec trois gares en chemin) et « endless »
// (aller le plus loin possible, une gare tous les 550 m). En route : le froid, les loups, les congères sur la voie,
// les avalanches et les bourrasques, le jour et la nuit. Chaque tronçon entre deux gares a son ambiance (plaine, forêt,
// ville, lac, col), choisie à l'aiguillage de la gare précédente, et son moment fort (Brise-Glace, pont, convoi abandonné,
// rugissement du Front). En gare, la ferraille achète des cartes d'amélioration tirées au hasard.
import { hash, makeRng } from './rng.js';
import {
  DECK_Y, HALF_W, DECK_FRONT, REAR, BODY_FRONT, BOILER, LADDER, DECK_BOXES, CHUNK, BIOMES, BIOME_KEYS,
  chunkRuins, pushOutBox, piecePos, onDeckRect,
} from './world.js';

export const DT = 1 / 60;
export const FUEL_PER_CRATE = 25;
export const DIFFICULTY = {
  // storm : vitesse du front de tempête (m/s) ; press : montée de la pression (%/s) ; faultT : s entre deux pannes ;
  // raid0 / raidGap : distance du premier raid de pillards, puis écart entre deux raids
  facile: { burn: 0.6, ramp: 0.10, loot: 0.8, cold: 0.7, wolves: 0.08, wolfV: 4.6, goal: 1600, storm: 1.55, press: 1.0, faultT: 90, raid0: 750, raidGap: [520, 720], label: 'Facile' },
  normal: { burn: 0.8, ramp: 0.15, loot: 0.58, cold: 1.0, wolves: 0.16, wolfV: 5.0, goal: 2000, storm: 1.9, press: 1.5, faultT: 60, raid0: 420, raidGap: [380, 560], label: 'Normale' },
  blizzard: { burn: 1.0, ramp: 0.22, loot: 0.48, cold: 1.3, wolves: 0.25, wolfV: 5.4, goal: 2400, storm: 2.1, press: 2.0, faultT: 45, raid0: 320, raidGap: [300, 450], label: 'Blizzard' },
};
export const MODES = {
  expedition: { label: 'Expédition', desc: 'Rallier Fort-Givre, au bout de la ligne, en passant par trois gares.' },
  endless: { label: 'Sans fin', desc: 'Aller le plus loin possible. Une gare tous les 550 m.' },
};

// Types de caisses (code transmis dans l'état : 0 = rien, 1…4). Une caisse gelée dégèle près de la chaudière.
export const CRATES = {
  1: { k: 'fuel', icon: '🛢️', label: 'Fioul', fuel: 25 },
  2: { k: 'coal', icon: '⚫', label: 'Charbon', fuel: 45 },
  3: { k: 'ice', icon: '🧊', label: 'Fioul gelé', fuel: 8 },
  4: { k: 'parts', icon: '⚙️', label: 'Pièces détachées', fuel: 0, scrap: 3 },
};
export const CRATE_CODE = { fuel: 1, coal: 2, ice: 3, parts: 4 };
export const THAW_T = 6;                // secondes près de la chaudière pour dégeler une caisse

// Cartes d'amélioration : trois tirées au hasard à chaque gare, la première est offerte, les autres coûtent de la ferraille
export const CARDS = {
  boiler: { icon: '🔥', label: 'Chaudière calorifugée', desc: 'Brûle 12 % de fioul en moins.', max: 3, cost: 4 },
  tank: { icon: '🛢️', label: 'Réservoir agrandi', desc: '+25 % de capacité.', max: 2, cost: 5 },
  coats: { icon: '🧥', label: 'Parkas fourrées', desc: 'Le froid mord 25 % moins vite.', max: 2, cost: 4 },
  radar: { icon: '📡', label: 'Détecteur de fioul', desc: 'Les lanternes des ruines vides restent éteintes.', max: 1, cost: 5 },
  flares: { icon: '🎆', label: 'Fusées en plus', desc: '+1 fusée éclairante par personne à chaque gare.', max: 2, cost: 3 },
  net: { icon: '🥅', label: 'Filet de récupération', desc: 'Une caisse lancée qui rate le wagon de peu est rattrapée à bord.', max: 1, cost: 4 },
  ladder: { icon: '🪜', label: 'Échelle rallongée', desc: 'On attrape l\'échelle de queue de bien plus loin.', max: 1, cost: 4 },
  crampons: { icon: '🥾', label: 'Crampons', desc: '+10 % de vitesse dans la neige ; on ne glisse plus sur la glace.', max: 2, cost: 4 },
  valve: { icon: '♨️', label: 'Soupape automatique', desc: 'La pression monte 30 % moins vite.', max: 2, cost: 5 },
  armor: { icon: '🛡️', label: 'Blindage', desc: 'Le convoi encaisse 30 % de dégâts en moins.', max: 2, cost: 5 },
  warm: { icon: '🌡️', label: 'Chaudière rayonnante', desc: 'Le cercle de chaleur s\'agrandit et réchauffe plus vite.', max: 1, cost: 4 },
  pistons: { icon: '🚂', label: 'Pistons neufs', desc: 'Le convoi roule 8 % plus vite.', max: 2, cost: 6 },
  breaker: { icon: '🌀', label: 'Brise-tempête', desc: 'Le Front avance 8 % moins vite.', max: 2, cost: 6 },
  toolkit: { icon: '🔧', label: 'Caisse à outils', desc: 'Réparations, pelle et grappins 40 % plus rapides.', max: 1, cost: 4 },
  crowbar: { icon: '🪓', label: 'Pied-de-biche', desc: 'On fouille les ruines presque deux fois plus vite.', max: 1, cost: 3 },
  salvage: { icon: '⚙️', label: 'Récupérateur', desc: '+1 ferraille par pillard renversé et par caisse de pièces.', max: 1, cost: 3 },
  longflare: { icon: '🧨', label: 'Fusées longues', desc: 'Les fusées portent 40 % plus loin et durent plus longtemps.', max: 1, cost: 3 },
  harness: { icon: '🎒', label: 'Hotte de portage', desc: 'Porter une caisse ne ralentit presque plus.', max: 1, cost: 4 },
};
export const UPG_KEYS = Object.keys(CARDS);
export const cardCost = (key, lvl) => CARDS[key].cost + 2 * lvl;

// Rôles : un petit talent par joueur, choisi avant le départ
export const ROLES = [
  { k: 'meca', icon: '🔧', label: 'Mécano', desc: 'Répare, déblaie et coupe les grappins deux fois plus vite ; la soupape lui obéit mieux.' },
  { k: 'scout', icon: '🧭', label: 'Éclaireur', desc: 'Plus rapide dans la neige ; fouille les ruines deux fois plus vite.' },
  { k: 'stoker', icon: '🔥', label: 'Chauffeur', desc: 'Chaque caisse qu\'il jette au feu rend 6 % de plus ; il craint moins le froid.' },
  { k: 'guard', icon: '🎯', label: 'Vigie', desc: 'Deux fusées de plus, lance plus loin, renverse les pillards de plus loin, frappe fort le Brise-Glace.' },
];
const MECA = 0, SCOUT = 1, STOKER = 2, GUARD = 3;

// Moments forts : un par tronçon (à partir du deuxième), selon l'ambiance
export const MOMENTS = {
  boss: { icon: '🚛', label: 'Le Brise-Glace', desc: 'Un camion blindé de pillards harponne le convoi.' },
  bridge: { icon: '🌉', label: 'Pont de la Gorge', desc: 'Un vieux pont fragile : on le passe en Éco, et personne dehors.' },
  wreck: { icon: '🚃', label: 'Convoi abandonné', desc: 'Un train échoué plein de caisses… mais le Front ne s\'arrête pas.' },
  roar: { icon: '🌪️', label: 'Rugissement du Front', desc: 'La tempête se déchaîne et fonce sur vous.' },
};
export const BRIDGE_LEN = 46;          // longueur du pont (m)
export const LEG_SHIFT = 110;          // une ambiance commence 110 m après la gare (le décor devant la gare est déjà construit)
const ROAR_T = 40, CALM_T = 25, WRECK_T = 35, BOSS_T = 80, HOOK_T = 1.8, HOOK_K = 0.78, MAX_HOOKS = 3;
export const HOOK_SPOTS = [-7.5, -1.5, 3.5, 9.5, 13.5];

export const STATION_NAMES = ['Halte du Col', 'Dépôt Nord', 'Gare de Givre', 'Poste Boréal', 'Halte Blanche', 'Relais des Loups', 'Gare Perdue', 'Halte du Phare'];
export const STATION_T = 50;          // durée maximale d'un arrêt en gare (s)
export const STATION_EVERY = 550;     // mode sans fin
export const STORM_STATION_K = 0.3;   // en gare, le Front ralentit (les murs de la gare coupent le vent)
export const VMAX = 2.6, VMIN = 1.0;  // vitesse du convoi (m/s) réservoir plein / presque vide
export const trainSpeedFor = (fuel) => (fuel <= 0 ? 0 : VMIN + (VMAX - VMIN) * Math.min(1, fuel / 60));
export const PR = 0.42;               // rayon d'un joueur
const G = 22, JUMP_V = 7.0, BRAKE = 1.6;
const SPEED_DECK = 5.6, SPEED_SNOW = 4.3, CARRY_K = 0.85, COAL_K = 0.62, STUMBLE_K = 0.45, STUMBLE_T = 0.9, FROZEN_K = 0.55;
export const LOST_DIST = 55;          // au-delà, le joueur se perd dans la tempête
const LOST_T = 4, CLIMB_T = 0.7, SEARCH_T = 1.4;
const USE_R = 1.5, FEED_R = 2.4, SEARCH_R = 2.4, CRATE_H = 0.25, MAX_CRATES = 40;
export const WARM_R = 3.2;            // près de la chaudière, on se réchauffe
export const warmR = (up) => WARM_R + 1.4 * ((up && up.warm) | 0);
const FREEZE_T = 6;                   // secondes à 0 de chaleur avant de s'effondrer
export const DIG_T = 10;              // une congère : 10 s de pelle pour un joueur seul
export const FLARE_R = 9, FLARE_T = 9;
export const flareR = (up) => FLARE_R * (1 + 0.4 * ((up && up.longflare) | 0));
const ICE_T = 3.2;                    // immobile plus longtemps sur le lac : la glace cède
// Manette de vitesse (cabine) : vitesse, consommation et montée de pression selon le régime
export const THROTTLE = [
  { label: 'Éco', v: 0.72, burn: 0.6, press: 0.55 },
  { label: 'Normal', v: 1, burn: 1, press: 1 },
  { label: 'À fond', v: 1.35, burn: 1.85, press: 1.9 },
];
export const LEVER = { x: 0, z: -9.25, r: 1.3 };     // manette, à l'arrière de la cabine
export const VALVE = { x: 0, z: -1.75, r: 1.3 };     // soupape de la chaudière, côté avant
export const STORM_START = 90, STORM_MAX = 160;      // avance initiale et avance maximale sur le front de tempête
// Pannes à bord : tuyaux gelés (le convoi ralentit) et fuites de fioul ; emplacements sur le plancher
export const FAULTS = {
  pipe: { label: 'Tuyau gelé', fix: 4, spots: [[-1.35, -8], [1.35, 2.6], [-1.35, 7.4], [1.35, 14]] },
  leak: { label: 'Fuite de fioul', fix: 3, spots: [[1.35, -7.5], [-1.35, -3.6], [1.35, 8.2], [-1.35, 14.6]] },
};
const PIPE_K = 0.6, LEAK_RATE = 0.35, VENT_RATE = 50, FIX_R = 1.25;
// Pillards en motoneige
const RAID_V = 6.5, RAID_STEAL_T = 4.5, RAID_REACH = 1.9;
const WOLF_SIGHT = 13, WOLF_GIVEUP = 24, WOLF_BITE = 0.95, MAX_WOLVES = 8;
const SPAWNS = [[-0.9, -6], [0.9, -6], [-0.9, 6.5], [0.9, 6.5], [-0.9, 14], [0.9, 14]];

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };

// Distance de la gare n° i
export function stationDist(mode, goal, i) {
  if (mode === 'expedition') return i < 3 ? Math.round(goal * (i + 1) / 4) : null;
  return STATION_EVERY * (i + 1);
}

/* ------------------------------------------------------------------ jour et nuit (purement fonction du temps) */
export const DAY_LEN = 360;
const dayPh = (t) => (((t / DAY_LEN + 0.05) % 1) + 1) % 1;
// 0 en plein jour, 1 en pleine nuit
export function nightK(t) { const ph = dayPh(t); return smooth(0.58, 0.68, ph) * (1 - smooth(0.9, 1, ph)); }
// { night, k, left } : nuit ou jour, intensité, secondes avant le prochain changement
export function dayInfo(t) {
  const ph = dayPh(t), night = ph >= 0.63 && ph < 0.95;
  const nx = night ? 0.95 : ph < 0.63 ? 0.63 : 1.63;
  return { night, k: nightK(t), left: (nx - ph) * DAY_LEN };
}

/* ------------------------------------------------------------------ tronçons, ambiances, moments forts */
// Tronçon (n°) d'une distance : le tronçon L va de la gare L-1 (+ LEG_SHIFT) à la gare L
export function legAt(mode, goal, d) {
  for (let n = 0; n < 500; n++) { const sd = stationDist(mode, goal, n); if (sd == null || sd + LEG_SHIFT > d) return n; }
  return 500;
}
export function legEnd(mode, goal, L) { const sd = stationDist(mode, goal, L); return sd != null ? sd : mode === 'expedition' ? goal : null; }
export const bioAt = (mode, goal, legs, d) => legs[legAt(mode, goal, d)] || 'plaine';
// Position du moment fort du tronçon L (indépendante de l'ambiance), ou null
export function momentPos(seed, mode, goal, L) {
  if (L < 1) return null;
  const a = stationDist(mode, goal, L - 1); if (a == null) return null;
  const e = legEnd(mode, goal, L); if (e == null) return null;
  const lo = a + LEG_SHIFT + 90, hi = e - 150; if (hi < lo) return null;
  return Math.round(lo + makeRng(hash(seed * 19 + L * 7121 + 11)).next() * (hi - lo));
}
export const momentKind = (seed, L, bio) => makeRng(hash(seed * 23 + L * 3301 + 5)).weighted(Object.entries((BIOMES[bio] || BIOMES.plaine).moments));
// Moment fort du tronçon L, une fois son ambiance choisie : { L, k, d }
export function momentOf(seed, mode, goal, legs, L) {
  if (!legs[L]) return null;
  const d = momentPos(seed, mode, goal, L); if (d == null) return null;
  return { L, k: momentKind(seed, L, legs[L]), d };
}
const clearOf = (m) => (m && m.k === 'bridge' ? [m.d - 6, m.d + BRIDGE_LEN + 6] : m && m.k === 'wreck' ? [m.d - 30, m.d + 30] : null);
// Ambiance et portion à laisser vide d'un tronçon de plaine k
export function chunkEnv(seed, mode, goal, legs, k) {
  const d = k * CHUNK, L = legAt(mode, goal, d);
  let clear = null;
  for (const l of [L - 1, L, L + 1]) {
    const c = clearOf(momentOf(seed, mode, goal, legs, l));
    if (c && c[1] + 14 > d && c[0] - 14 < d + CHUNK) clear = c;
  }
  return { bio: legs[L] || 'plaine', clear };
}
// Wagons du convoi abandonné (solides), en repère du train
export function momentColliders(mm, dist) {
  if (!mm || mm.k !== 'wreck') return [];
  return [-11, 0, 11].map((o, i) => ({ x: -(HALF_W + 7.2), z: o + dist - mm.d, w: 2.8, d: 9.5, rot: (i - 1) * 0.06, h: 2.6 }));
}

// Congère en travers de la voie : un obstacle solide devant le chasse-neige (repère du train)
export function obstacleColliders(ev, dist) {
  if (!ev || ev.k !== 'drift' || ev.done) return [];
  return [{ x: 0, z: ev.zw + dist, w: 7.5, d: 2.6, rot: 0, h: 2.2 }];
}

/* ------------------------------------------------------------------ plaine : ruines mises en cache par tronçon */
export class Ruins {
  constructor(seed, lootRate, mode = 'endless', goal = 0) {
    this.seed = seed; this.loot = lootRate; this.mode = mode; this.goal = goal; this.cache = new Map();
    this.legs = ['plaine']; this.ver = 'plaine';
  }
  // l'aiguillage a choisi une nouvelle ambiance : les tronçons concernés seront reconstruits
  setLegs(legs) { const v = legs.join(','); if (v !== this.ver) { this.legs = legs.slice(); this.ver = v; } }
  chunk(k) {
    let c = this.cache.get(k);
    if (c && c.ver === this.ver) return c;
    const e = chunkEnv(this.seed, this.mode, this.goal, this.legs, k);
    if (!c || c.bio !== e.bio || String(c.clear) !== String(e.clear)) c = chunkRuins(this.seed, k, this.loot, e);
    c.ver = this.ver; this.cache.set(k, c);
    return c;
  }
  // tronçons visibles autour du convoi (repère du train : de -ahead devant à +behind derrière)
  around(dist, ahead = 85, behind = 95) {
    const k0 = Math.floor((dist - behind) / CHUNK), k1 = Math.floor((dist + ahead) / CHUNK);
    for (const k of this.cache.keys()) if (k < k0 - 2 || k > k1 + 2) this.cache.delete(k);
    const out = [];
    for (let k = k0; k <= k1; k++) out.push([k, this.chunk(k)]);
    return out;
  }
  // morceaux solides en repère du train (ruines et sapins)
  colliders(dist) {
    const out = [];
    for (const [, c] of this.around(dist, 40, 70)) {
      for (const r of c.ruins) for (const pc of r.pieces) {
        const p = piecePos(r, pc);
        out.push({ x: p.x, z: p.zw + dist, w: pc.w, d: pc.d, rot: p.rot, h: pc.h });
      }
      for (const t of c.trees || []) out.push({ x: t.x, z: t.zw + dist, w: 0.7 * t.s, d: 0.7 * t.s, rot: 0, h: 5 });
    }
    return out;
  }
}

// Contexte de déplacement d'un joueur (le même chez l'hôte et chez l'invité qui prédit)
export function moveCtx(o, colliders) {
  const up = o.up || {};
  return { v: o.v, wind: windOf({ gu: o.gust, ev: o.ev }), colliders, ice: !!o.ice, cr: up.crampons | 0, hz: up.harness | 0, ld: up.ladder | 0 };
}

/* ------------------------------------------------------------------ déplacement d'un joueur (partagé hôte / prédiction) */
// p : état du joueur ; inp : { mx, mz, jump } ; ctx : moveCtx() ; ev : rappel d'événement (hôte seulement)
export function stepPlayer(p, inp, dt, ctx, ev) {
  if (p.st === 3) { // perdu dans la tempête (ou gelé) : réapparition à l'arrière du convoi
    p.tm -= dt;
    if (p.tm <= 0) {
      Object.assign(p, { st: 0, tm: 0, x: 0, z: REAR - 1.2, y: DECK_Y, vx: 0, vy: 0, vz: 0, on: 1, ref: 1, air: 0, heat: Math.max(p.heat ?? 100, 55), frz: 0, ic: 0 });
      ev && ev({ e: 'respawn', p: p.id });
    }
    return;
  }
  if (p.st === 2) { // grimpe à l'échelle
    p.tm -= dt; p.vx = p.vz = 0;
    p.x += (clamp(p.x, -0.6, 0.6) - p.x) * Math.min(1, dt * 10);
    p.y = DECK_Y * clamp(1 - p.tm / CLIMB_T, 0, 1);
    if (p.tm <= 0) { Object.assign(p, { st: 0, tm: 0, y: DECK_Y, z: REAR - 0.9, on: 1, ref: 1, air: 0, vy: 0 }); ev && ev({ e: 'board', p: p.id }); }
    return;
  }
  if (p.st === 1) { p.tm -= dt; if (p.tm <= 0) { p.st = 0; p.tm = 0; } }

  // commande
  let mx = Number(inp.mx) || 0, mz = Number(inp.mz) || 0;
  const m = Math.hypot(mx, mz); if (m > 1) { mx /= m; mz /= m; }
  let sp = p.on ? SPEED_DECK : SPEED_SNOW * (1 + 0.1 * (ctx.cr | 0)) * (p.role === SCOUT ? 1.15 : 1);
  if (p.carry) sp *= p.carry === 2 ? (ctx.hz ? 0.8 : COAL_K) : (ctx.hz ? 0.97 : CARRY_K);
  if (p.st === 1) sp *= STUMBLE_K;
  if ((p.heat ?? 100) <= 0) sp *= FROZEN_K; // gelé : on avance au ralenti
  // sur le lac gelé, on glisse (sauf avec des crampons)
  const slip = !p.on && ctx.ice && !ctx.cr;
  const k = p.air ? Math.min(1, dt * 3) : Math.min(1, dt * (p.on ? 14 : slip ? 1.7 : 8));
  p.vx += (mx * sp - p.vx) * k; p.vz += (mz * sp - p.vz) * k;
  if (m > 0.15) p.yaw = Math.atan2(mx, mz);

  // saut (compteur : une pression = un saut, même si un paquet se perd)
  if (p.pj == null) p.pj = inp.jump | 0;
  if ((inp.jump | 0) !== p.pj) { p.pj = inp.jump | 0; if (!p.air) { p.vy = JUMP_V; p.air = 1; } }

  // la neige file sous les pieds : hors du convoi, le sol recule à la vitesse du train ; la bourrasque pousse de côté
  const drift = p.ref ? 0 : ctx.v;
  const wind = p.ref ? 0 : (ctx.wind || 0);
  p.x += (p.vx + wind) * dt; p.z += (p.vz + drift) * dt;

  // vertical
  const wasAir = p.air;
  if (p.air) { p.vy -= G * dt; p.y += p.vy * dt; }
  const overDeck = onDeckRect(p.x, p.z);
  if (!p.air && p.on && !overDeck) { p.air = 1; p.vy = 0; } // on marche dans le vide : chute
  if (p.air) {
    const floor = overDeck && p.y >= DECK_Y - 0.35 ? DECK_Y : 0;
    if (p.y <= floor && p.vy <= 0) {
      p.y = floor; p.vy = 0; p.air = 0;
      if (floor === DECK_Y) { p.on = 1; p.ref = 1; }
      else {
        const fell = p.on || p.ref;
        p.on = 0; p.ref = 0;
        if (fell) { p.st = 1; p.tm = STUMBLE_T; p.falls = (p.falls | 0) + 1; ev && ev({ e: 'fall', p: p.id, x: p.x, z: p.z }); }
        else if (wasAir) ev && ev({ e: 'land', p: p.id, x: p.x, z: p.z });
      }
    }
  }

  // collisions
  const deckLevel = p.y > DECK_Y - 0.3;
  if (deckLevel && overDeck) {
    for (const b of DECK_BOXES) pushOutBox(p, (b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2, b.x1 - b.x0, b.z1 - b.z0, 0, PR);
    const dx = p.x - BOILER.x, dz = p.z - BOILER.z, d = Math.hypot(dx, dz), mr = BOILER.r + PR;
    if (d < mr && p.y < BOILER.top) { const s = d > 1e-4 ? mr / d : 1; p.x = BOILER.x + (d > 1e-4 ? dx * s : mr); p.z = BOILER.z + dz * (d > 1e-4 ? s : 0); }
    if (p.z < DECK_FRONT + PR) p.z = DECK_FRONT + PR;
  } else if (!deckLevel || !overDeck) {
    if (p.y < DECK_Y - 0.1) {
      // flancs du convoi et chasse-neige
      if (Math.abs(p.x) < HALF_W + 0.15 + PR && p.z > BODY_FRONT - PR && p.z < REAR) {
        if (p.z < -17.2) { p.x = Math.sign(p.x || 1) * (HALF_W + 0.2 + PR); p.vx = Math.sign(p.x) * 3; } // le chasse-neige écarte
        else pushOutBox(p, 0, (BODY_FRONT + REAR) / 2, 2 * HALF_W + 0.3, REAR - BODY_FRONT, 0, PR);
      }
      for (const c of ctx.colliders) if (p.y < c.h && Math.abs(c.z - p.z) < 6 && Math.abs(c.x - p.x) < 6) pushOutBox(p, c.x, c.z, c.w, c.d, c.rot, PR);
    }
    // échelle de queue : on remonte à bord (rallongée : on l'attrape de plus loin)
    const lx = LADDER.x + (ctx.ld ? 0.9 : 0), lz1 = LADDER.z1 + (ctx.ld ? 1.8 : 0);
    if (!p.on && p.y < 0.9 && Math.abs(p.x) <= lx && p.z >= LADDER.z0 && p.z <= lz1) {
      p.st = 2; p.tm = CLIMB_T; p.vx = p.vz = p.vy = 0; p.air = 0; p.z = REAR + 0.35;
      return;
    }
  }
  p.x = clamp(p.x, -45, 45);
  if (p.z < -70) p.z = -70;
  if (!p.on && p.z > REAR + LOST_DIST) {
    p.st = 3; p.tm = LOST_T; p.vx = p.vz = p.vy = 0; p.air = 0;
    const had = p.carry; p.carry = 0;
    ev && ev({ e: 'lost', p: p.id, crate: !!had });
  }
}

/* ------------------------------------------------------------------ simulation complète (hôte) */
export class Sim {
  constructor({ seed = 1, difficulty = 'normal', mode = 'expedition' } = {}) {
    this.seed = seed | 0; this.diff = DIFFICULTY[difficulty] ? difficulty : 'normal';
    this.mode = MODES[mode] ? mode : 'expedition';
    this.D = DIFFICULTY[this.diff];
    this.goal = this.mode === 'expedition' ? this.D.goal : 0;
    this.legs = ['plaine'];                  // ambiance de chaque tronçon (choisie à l'aiguillage)
    this.ruins = new Ruins(this.seed, this.D.loot, this.mode, this.goal);
    this.t = 0; this.phase = 'play'; this.win = 0; this.dist = 0; this.v = 0; this.fuel = 100; this.stallT = 0; this.lowWarned = false;
    this.players = new Map(); this.crates = []; this.looted = new Set(); this.nid = 1; this.ks = -1; this.events = []; this.fedTotal = 0;
    this.scrap = 0; this.up = Object.fromEntries(UPG_KEYS.map((k) => [k, 0]));
    this.ns = 0; this.stop = null;          // gare suivante, arrêt en cours ({ k: 'station' | 'drift' | 'wreck', … })
    this.ev = null; this.en = 0; this.ed = 0; this.ed = this.eventDist(0); // événement de voie en cours, n° et distance du suivant
    this.gust = 0;                          // bourrasque : temps restant
    this.wolves = []; this.flares = [];
    this.thr = 1; this.press = 20; this.pw = false; this.hull = 100; this.why = '';
    this.storm = -STORM_START; this.sw = 0;   // position du front de tempête (repère du sol), alertes
    this.faults = []; this.nf = this.D.faultT * 0.8; this.fn = 0;
    this.raiders = []; this.rd = this.D.raid0; this.rn = 0;
    this.mi = 1; this.mm = null;             // tronçon du prochain moment fort, moment en cours
    this.boss = null; this.hooks = [];       // Brise-Glace et ses grappins
    this.cl = 0; this.nt = 0;                // tronçon courant, nuit (pour les annonces)
    this.calm = false;                       // tests : pas de tempête, de pression, de pannes, de pillards ni de moments forts
  }
  get gap() { return this.dist - this.storm; }
  // plus l'équipage est nombreux, plus il y a de travail à bord (seul, la chaudière est plus clémente)
  crewK() { return Math.min(1.3, 0.7 + 0.15 * Math.max(1, this.players.size)); }
  stormSpeed() {
    let s = (this.D.storm + Math.min(0.4, this.t / 60 * 0.04)) * (1 - 0.08 * this.up.breaker);
    if (this.stop && this.stop.k === 'station') s *= STORM_STATION_K;
    const m = this.mm; if (m && m.k === 'roar') s *= m.t < ROAR_T ? 1.7 : 0.6;
    return s;
  }
  bio() { return bioAt(this.mode, this.goal, this.legs, this.dist); }
  B() { return BIOMES[this.bio()] || BIOMES.plaine; }
  night() { return nightK(this.t); }

  get fmax() { return 100 + 25 * this.up.tank; }
  flaresFor(p) { return 2 + this.up.flares + (p.role === GUARD ? 2 : 0); }
  damage(n) { if (!this.calm) this.hull -= n * (1 - 0.3 * this.up.armor); }

  addPlayer({ id, name, color, role }) {
    if (this.players.has(id)) return this.players.get(id);
    const used = new Set([...this.players.values()].map((p) => p.slot));
    let slot = 0; while (used.has(slot)) slot++;
    const [x, z] = SPAWNS[slot % SPAWNS.length];
    // rôle choisi, sinon celui que personne n'a encore
    if (!(role >= 0 && role < ROLES.length)) {
      const n = ROLES.map(() => 0); for (const q of this.players.values()) n[q.role]++;
      role = n.indexOf(Math.min(...n));
    }
    const p = {
      id, name: String(name || 'Joueur').slice(0, 12), color: /^#[0-9a-f]{6}$/i.test(color) ? color : '#2b8cff', slot, role: role | 0,
      x, y: DECK_Y, z, vx: 0, vy: 0, vz: 0, yaw: Math.PI, on: 1, ref: 1, air: 0, st: 0, tm: 0, carry: 0, cth: 0,
      sp: 0, sr: -1, q: 0, pj: null, pt: null, pf: null, pu: false, fed: 0, found: 0, falls: 0,
      heat: 100, frz: 0, cw: 0, flares: 0, bites: 0, dig: 0, ic: 0,
      inp: { mx: 0, mz: 0, jump: 0, use: false, thr: 0, fl: 0 },
    };
    p.flares = this.flaresFor(p);
    this.players.set(id, p);
    return p;
  }

  // Un joueur parti (déconnexion) lâche sa caisse là où il était
  removePlayer(id) {
    const p = this.players.get(id); if (!p) return;
    if (p.carry && p.st !== 3) this.dropCarry(p);
    this.players.delete(id);
    for (const w of this.wolves) if (w.tg === id) { w.st = 0; w.tg = -1; }
    if (this.stop && this.stop.v) this.stop.v = this.stop.v.filter((x) => x !== id);
    if (this.stop && this.stop.rv) this.stop.rv = this.stop.rv.filter((x) => x[0] !== id);
    this.events.push({ e: 'left', p: id, n: p.name });
  }

  setInput(id, inp) { const p = this.players.get(id); if (p) { p.inp = inp; if (Number.isFinite(inp.q)) p.q = Math.max(p.q, inp.q); } }

  spawnCrate(x, y, z, m, vel, t = 1, th = 0) {
    if (this.crates.length >= MAX_CRATES) this.crates.shift();
    const c = { id: this.nid++, m, x, y, z: m === 0 ? z - this.dist : z, vx: 0, vy: 0, vz: 0, by: -99, t: CRATES[t] ? t : 1, th };
    if (vel) Object.assign(c, vel);
    this.crates.push(c);
    return c;
  }
  // la caisse portée tombe aux pieds du joueur
  dropCarry(p) {
    if (!p.carry) return;
    this.spawnCrate(p.x, p.on ? DECK_Y + CRATE_H : CRATE_H, p.z, p.on ? 1 : 0, null, p.carry, p.cth || 0);
    p.carry = 0; p.cth = 0;
  }
  // type d'une caisse trouvée, selon l'ambiance du lieu
  lootType(n, bio) { return CRATE_CODE[makeRng(hash(this.seed * 37 + n)).weighted(Object.entries((BIOMES[bio] || BIOMES.plaine).loot))]; }
  humans() { return this.players.size; }
  burnRate() {
    const n = Math.max(1, this.players.size);
    return this.D.burn * Math.min(2.6, 1 + this.D.ramp * this.t / 60) * (1 + 0.15 * (n - 1)) * (1 - 0.12 * this.up.boiler) * THROTTLE[this.thr].burn;
  }
  speedK() { return THROTTLE[this.thr].v * PIPE_K ** this.pipes() * HOOK_K ** this.hooks.length * (1 + 0.08 * this.up.pistons); }
  // au-delà, le pont souffre : il faut le passer en Éco
  bridgeLimit() { return VMAX * THROTTLE[0].v * (1 + 0.08 * this.up.pistons) + 0.15; }

  /* -------------------------------------------------------------- événements de voie (déterministes) */
  eventDist(i) {
    const r = makeRng(hash(this.seed * 7 + i * 131 + 5));
    const gap = this.diff === 'blizzard' ? r.range(220, 360) : r.range(260, 420);
    let d = (i === 0 ? 120 : this.ed) + gap;
    // pas d'événement juste avant ou juste après une gare, ni près d'un moment fort ou de l'arrivée
    for (let pass = 0; pass < 3; pass++) {
      for (let s = 0; s < 40; s++) {
        const sd = stationDist(this.mode, this.goal, s); if (sd == null) break;
        if (Math.abs(sd - d) < 140) d = sd + 160;
      }
      for (let L = 1; L < 40; L++) {
        const md = momentPos(this.seed, this.mode, this.goal, L); if (md == null) { if (stationDist(this.mode, this.goal, L) == null) break; continue; }
        if (d > md - 120 && d < md + BRIDGE_LEN + 120) d = md + BRIDGE_LEN + 130;
      }
    }
    return d;
  }
  eventKind(i, d) {
    const B = BIOMES[bioAt(this.mode, this.goal, this.legs, d)] || BIOMES.plaine;
    return makeRng(hash(this.seed * 13 + i * 977 + 1)).weighted(Object.entries(B.ev));
  }

  // Distance où le convoi doit être arrêté (gare, congère, convoi abandonné, arrivée), ou null
  nextStopDist() {
    // une gare déjà dépassée (reprise d'un état, saut de distance) est ignorée
    for (let g = 0; g < 50; g++) { const sd = stationDist(this.mode, this.goal, this.ns); if (sd == null || sd >= this.dist - 1) break; this.ns++; }
    if (this.ev && this.ev.k === 'drift' && !this.ev.done && this.ev.stopD < this.dist - 1) this.ev.done = 1;
    let s = null;
    const sd = stationDist(this.mode, this.goal, this.ns);
    if (sd != null) s = sd;
    if (this.goal && (s == null || this.goal < s)) s = this.goal;
    if (this.ev && this.ev.k === 'drift' && !this.ev.done) { const d = this.ev.stopD; if (s == null || d < s) s = d; }
    const M = this.mm;
    if (M && M.k === 'wreck' && !M.done) { if (M.d < this.dist - 1) M.done = 1; else if (s == null || M.d < s) s = M.d; }
    return s;
  }

  step(dt = DT) {
    if (this.phase !== 'play') return;
    this.t += dt;
    const st = this.stop;
    // chaudière : rien ne brûle en gare ; au ralenti devant une congère ou un convoi abandonné
    const burnK = st ? (st.k === 'station' ? 0 : 0.5) : 1;
    if (this.fuel > 0) this.fuel = Math.max(0, this.fuel - (this.burnRate() * burnK + this.leaks() * LEAK_RATE) * dt);
    if (this.fuel < 25 && !this.lowWarned) { this.lowWarned = true; this.events.push({ e: 'low' }); }
    if (this.fuel > 35) this.lowWarned = false;

    // vitesse : on freine à temps pour s'arrêter pile à la gare, devant la congère ou au terminus
    let target = st ? 0 : trainSpeedFor(this.fuel) * this.speedK(), decel = st ? BRAKE : 0.45;
    const stopAt = st ? null : this.nextStopDist();
    if (stopAt != null) {
      const rem = stopAt - this.dist;
      const vmax = Math.sqrt(Math.max(0, 2 * BRAKE * Math.max(0, rem - 0.2)));
      if (vmax < target) { target = vmax; decel = BRAKE; }
    }
    this.v += clamp(target - this.v, -decel * dt, 0.8 * dt);
    if (this.v < 0) this.v = 0;
    const prevD = this.dist;
    this.dist += this.v * dt;
    if (stopAt != null) {
      if (prevD <= stopAt && this.dist > stopAt) this.dist = stopAt;
      if (stopAt - this.dist <= 0.25 && this.v < 0.2) this.arrive(stopAt);
    }
    if (this.phase !== 'play') return;
    if (this.fuel <= 0 && this.v < 0.05 && !(this.stop && this.stop.k === 'station')) {
      if (this.stallT === 0) this.events.push({ e: 'stall' });
      this.stallT += dt;
      if (this.stallT > 3) { this.lose('fuel'); return; }
    } else this.stallT = 0;

    // arrêt en gare (ou au convoi abandonné) : compte à rebours, puis départ
    if (this.stop && (this.stop.k === 'station' || this.stop.k === 'wreck')) {
      this.stop.t -= dt;
      if (this.stop.t <= 0 || (this.players.size && this.stop.v.length >= this.players.size)) this.depart();
    }

    // caisses tombées d'un convoi précédent, loups, quand un nouveau tronçon apparaît devant
    const kAhead = Math.floor((this.dist + 85) / CHUNK);
    while (this.ks < kAhead) {
      this.ks++;
      const ch = this.ruins.chunk(this.ks);
      const L = ch.loose;
      if (L && L.zw + this.dist < REAR) this.spawnCrate(L.x, CRATE_H, L.zw + this.dist, 0, null, this.lootType(this.ks * 11 + 3, ch.bio));
      this.maybeWolves(this.ks, ch);
    }
    this.stepTrackEvent(dt);
    this.stepAnnounces();
    if (!this.calm) {
      this.stepStorm(dt); if (this.phase !== 'play') return;
      this.stepPressure(dt); if (this.phase !== 'play') return;
      this.stepFaults(dt);
      this.maybeRaid();
      this.stepMoment(dt);
      this.stepBoss(dt);
    }

    // joueurs
    const cols = this.ruins.colliders(this.dist).concat(obstacleColliders(this.ev, this.dist), momentColliders(this.mm, this.dist));
    const ctx = moveCtx({ v: this.v, gust: this.gust, ev: this.ev, up: this.up, ice: this.B().ice }, cols);
    const ev = (e) => this.events.push(e);
    for (const p of this.players.values()) {
      stepPlayer(p, p.inp, dt, ctx, ev);
      this.interact(p, dt);
      this.coldStep(p, dt);
      this.groundStep(p, dt, ctx.ice);
    }
    this.stepCrates(dt);
    this.stepWolves(dt, ctx.colliders);
    this.stepFlares(dt);
    this.stepRaiders(dt);
    if (this.hooks.length) this.damage(0.3 * this.hooks.length * dt);
    if (this.hull <= 0) { this.lose('hull'); return; }
    // oubli des ruines fouillées loin derrière
    const kMin = Math.floor((this.dist - 120) / CHUNK) * 8;
    if (this.looted.size > 40) for (const id of this.looted) if (id < kMin) this.looted.delete(id);
  }

  // nouveau paysage, tombée de la nuit, lever du jour
  stepAnnounces() {
    const L = legAt(this.mode, this.goal, this.dist);
    if (L > this.cl) { this.cl = L; this.events.push({ e: 'leg', b: this.legs[L] || 'plaine', l: L }); }
    const n = dayInfo(this.t).night ? 1 : 0;
    if (n !== this.nt) { this.nt = n; this.events.push({ e: n ? 'night' : 'day' }); }
  }

  /* -------------------------------------------------------------- gares et terminus */
  arrive(at) {
    this.v = 0;
    if (this.ev && this.ev.k === 'drift' && !this.ev.done && Math.abs(at - this.ev.stopD) < 0.5) {
      if (!this.stop) { this.stop = { k: 'drift' }; this.events.push({ e: 'drift_stop' }); }
      return;
    }
    const M = this.mm;
    if (M && M.k === 'wreck' && !M.done && Math.abs(at - M.d) < 0.5) { if (!this.stop) this.wreckArrive(); return; }
    const sd = stationDist(this.mode, this.goal, this.ns);
    if (this.goal && at >= this.goal - 0.5 && (sd == null || sd >= this.goal)) {
      this.phase = 'over'; this.win = 1;
      this.events.push({ e: 'arrive', dist: Math.round(this.dist) });
      return;
    }
    if (sd == null || Math.abs(at - sd) > 0.5) return;
    const i = this.ns;
    this.stop = { k: 'station', i, t: STATION_T, v: [], c: this.cardsFor(i), b: [0, 0, 0], f: 1, fk: this.forkFor(i), rv: [] };
    for (const p of this.players.values()) { p.heat = 100; p.frz = 0; p.flares = Math.max(p.flares, this.flaresFor(p)); }
    this.hull = Math.min(100, this.hull + 50); this.faults = []; this.press = Math.min(this.press, 30);
    // deux caisses de fioul attendent sur le quai (côté gauche)
    this.spawnCrate(-(HALF_W + 2.6), CRATE_H, -2, 0);
    this.spawnCrate(-(HALF_W + 2.6), CRATE_H, 3, 0);
    this.events.push({ e: 'station', i, n: STATION_NAMES[i % STATION_NAMES.length] });
  }
  // trois cartes différentes, parmi celles qui ne sont pas au maximum
  cardsFor(i) {
    const pool = UPG_KEYS.filter((k) => this.up[k] < CARDS[k].max);
    makeRng(hash(this.seed * 41 + i * 977 + 13)).shuffle(pool);
    return pool.slice(0, 3);
  }
  // aiguillage : deux ambiances pour le tronçon suivant (null s'il n'y en a pas)
  forkFor(i) {
    if (legEnd(this.mode, this.goal, i + 1) == null || stationDist(this.mode, this.goal, i) == null) return null;
    const cur = this.legs[i] || 'plaine';
    const pool = BIOME_KEYS.filter((b) => b !== cur);
    makeRng(hash(this.seed * 43 + i * 1291 + 17)).shuffle(pool);
    return pool.slice(0, 2);
  }
  depart() {
    const s = this.stop;
    if (!s) return;
    if (s.k === 'wreck') { this.stop = null; if (this.mm) this.mm.done = 1; this.events.push({ e: 'depart' }); return; }
    if (s.k !== 'station') return;
    // l'aiguillage suit la majorité (à égalité : la première voie)
    if (s.fk) {
      const n = [0, 0]; for (const [, c] of s.rv) n[c]++;
      const b = s.fk[n[1] > n[0] ? 1 : 0];
      this.legs[s.i + 1] = b; this.ruins.setLegs(this.legs);
      this.events.push({ e: 'route', b, l: s.i + 1 });
    }
    this.stop = null; this.ns++;
    this.events.push({ e: 'depart' });
  }
  vote(id) {
    const s = this.stop; if (!s || (s.k !== 'station' && s.k !== 'wreck') || !this.players.has(id)) return false;
    const k = s.v.indexOf(id);
    if (k >= 0) s.v.splice(k, 1); else s.v.push(id);
    this.events.push({ e: 'vote', p: id, on: k < 0 });
    return true;
  }
  // vote pour l'une des deux voies de l'aiguillage
  route(id, c) {
    const s = this.stop; if (!s || s.k !== 'station' || !s.fk || !this.players.has(id) || (c !== 0 && c !== 1)) return false;
    s.rv = s.rv.filter((x) => x[0] !== id); s.rv.push([id, c]);
    this.events.push({ e: 'route_vote', p: id, c });
    return true;
  }
  buy(id, key) {
    const s = this.stop, U = CARDS[key];
    if (!s || s.k !== 'station' || !U || !this.players.has(id)) return 'On n\'achète qu\'en gare.';
    const j = s.c.indexOf(key);
    if (j < 0) return 'Cette carte n\'est pas proposée ici.';
    if (s.b[j]) return 'Déjà prise.';
    const lvl = this.up[key];
    if (lvl >= U.max) return 'Déjà au maximum.';
    const c = s.f ? 0 : cardCost(key, lvl);
    if (this.scrap < c) return `Il faut ${c} ferraille.`;
    this.scrap -= c; this.up[key]++; s.b[j] = 1; s.f = 0;
    if (key === 'flares') for (const p of this.players.values()) p.flares++;
    this.events.push({ e: 'buy', p: id, k: key, l: this.up[key], free: c === 0 });
    return null;
  }

  /* -------------------------------------------------------------- congères, avalanches, bourrasques */
  stepTrackEvent(dt) {
    if (this.gust > 0) { this.gust -= dt; if (this.gust <= 0) { this.gust = 0; this.events.push({ e: 'gust_end' }); if (this.ev && this.ev.k === 'gust') this.ev = null; } }
    const E = this.ev;
    if (!E && this.dist >= this.ed - 90 && !this.stop) {
      const k = this.eventKind(this.en, this.ed), d = this.ed, r = makeRng(hash(this.seed + this.en * 31));
      this.en++; this.ed = this.eventDist(this.en);
      if (k === 'drift') {
        // la congère se forme devant : le convoi s'arrêtera pile devant elle, à la distance d
        this.ev = { k, stopD: d, zw: r2(BODY_FRONT - 2.4 - d), prog: 0, done: 0, t: 0 };
        this.events.push({ e: 'drift_ahead' });
      } else this.ev = { k, at: d, side: r.chance(0.5) ? -1 : 1, t: 0, hit: 0 };
      return;
    }
    if (!E) return;
    if (E.k === 'drift') {
      if (E.done) { E.t += dt; if (E.t > 2) this.ev = null; return; }
      // on déblaie à la pelle : chaque joueur au pied de la congère qui maintient E fait avancer la barre
      const zd = E.zw + this.dist;
      let diggers = 0;
      for (const p of this.players.values()) {
        const ok = !p.on && !p.air && p.st < 2 && !p.carry && p.inp.use && Math.abs(p.x) < 4.6 && Math.abs(p.z - zd) < 2.9;
        p.dig = ok ? 1 : 0; if (ok) diggers += (p.role === MECA ? 1.5 : 1) * (1 + 0.3 * this.up.toolkit);
      }
      if (diggers) E.prog = Math.min(1, E.prog + dt * diggers / DIG_T);
      if (E.prog >= 1) {
        E.done = 1; E.t = 0;
        for (const p of this.players.values()) p.dig = 0;
        if (this.stop && this.stop.k === 'drift') this.stop = null;
        this.events.push({ e: 'cleared' });
      }
    } else if (E.k === 'aval') {
      if (this.dist < E.at && !E.t) return;
      if (!E.t) this.events.push({ e: 'aval_warn', side: E.side });
      E.t += dt;
      if (E.t >= 4 && !E.hit) {
        E.hit = 1;
        // tout joueur à terre dans la zone est enseveli
        for (const p of this.players.values()) if (!p.on && p.st < 2 && this.inAval(p.x, p.z, E)) {
          if (p.carry) this.dropCarry(p);
          p.st = 1; p.tm = 2.2; p.heat = Math.max(0, (p.heat ?? 100) - 30);
          this.events.push({ e: 'buried', p: p.id, x: p.x, z: p.z });
        }
        // la coulée découvre parfois une caisse
        if (makeRng(hash(this.seed + this.en * 53)).chance(0.6)) this.spawnCrate(E.side * 9, CRATE_H, -4, 0, null, this.lootType(this.en * 7 + 1, this.bio()));
        this.damage(10);
        this.events.push({ e: 'aval', side: E.side });
      }
      if (E.t > 9) this.ev = null;
    } else if (E.k === 'gust') {
      if (this.dist < E.at && !E.t) return;
      if (!E.t) { this.gust = 18; this.events.push({ e: 'gust', side: E.side }); }
      E.t += dt;
    }
  }
  // zone de l'avalanche, en repère du train (elle reste attachée au convoi le temps de tomber)
  inAval(x, z, E) { return x * E.side > HALF_W + 1 && x * E.side < 28 && z > BODY_FRONT - 8 && z < REAR + 12; }

  /* -------------------------------------------------------------- fin de partie */
  lose(why) {
    if (this.phase !== 'play') return;
    this.phase = 'over'; this.why = why;
    this.events.push({ e: 'over', why, dist: Math.round(this.dist) });
  }

  /* -------------------------------------------------------------- front de tempête */
  // Un mur de neige avance derrière le convoi (de plus en plus vite). S'il rattrape le convoi, c'est fini.
  // Il ne s'arrête jamais, mais en gare il ralentit nettement.
  stepStorm(dt) {
    this.storm = Math.max(this.storm + this.stormSpeed() * dt, this.dist - STORM_MAX);
    const g = this.gap;
    if (g < 60 && this.sw < 1) { this.sw = 1; this.events.push({ e: 'storm_near' }); }
    if (g < 25 && this.sw < 2) { this.sw = 2; this.events.push({ e: 'storm_close' }); }
    if (g > 90) this.sw = 0;
    // un joueur resté dehors, dans le front : le froid le saisit aussitôt
    for (const p of this.players.values()) if (!p.on && p.st < 2 && p.z > g - 2) p.heat = Math.max(0, (p.heat ?? 100) - 30 * dt);
    if (g <= 0) this.lose('storm');
  }

  /* -------------------------------------------------------------- pression de la chaudière */
  stepPressure(dt) {
    if (this.fuel > 0 && !(this.stop && this.stop.k === 'station')) this.press += this.D.press * THROTTLE[this.thr].press * this.crewK() * (1 - 0.3 * this.up.valve) * dt;
    if (this.press > 75 && !this.pw) { this.pw = true; this.events.push({ e: 'press_warn' }); }
    if (this.press < 60) this.pw = false;
    if (this.press >= 100) {
      // explosion : le foyer crache, le convoi encaisse, ceux qui sont tout près sont projetés
      this.press = 15; this.pw = false;
      this.fuel = Math.max(0, this.fuel - 20); this.damage(25);
      for (const p of this.players.values()) if (p.on && p.st < 2 && Math.hypot(p.x - BOILER.x, p.z - BOILER.z) < 3.2) {
        p.st = 1; p.tm = 1.2; p.heat = Math.max(0, (p.heat ?? 100) - 10);
        if (p.carry) this.dropCarry(p);
      }
      this.events.push({ e: 'boom' });
    }
  }

  /* -------------------------------------------------------------- pannes à bord */
  pipes() { let n = 0; for (const f of this.faults) if (f.k === 'pipe') n++; return n; }
  leaks() { let n = 0; for (const f of this.faults) if (f.k === 'leak') n++; return n; }
  stepFaults(dt) {
    if (this.stop && this.stop.k === 'station') return;
    this.nf -= dt;
    if (this.nf > 0) return;
    const r = makeRng(hash(this.seed * 17 + this.fn * 613 + 3)); this.fn++;
    this.nf = this.D.faultT * r.range(0.7, 1.3) / this.crewK();
    if (this.faults.length >= 2) return;
    const k = r.chance(0.5) ? 'pipe' : 'leak';
    const used = new Set(this.faults.map((f) => f.k + f.s));
    const free = FAULTS[k].spots.map((_, i) => i).filter((i) => !used.has(k + i)); if (!free.length) return;
    const i = r.pick(free), [x, z] = FAULTS[k].spots[i];
    this.faults.push({ id: this.nid++, k, s: i, x, z, prog: 0 });
    this.events.push({ e: 'fault', k, x, z });
  }

  /* -------------------------------------------------------------- pillards */
  maybeRaid() {
    if (this.dist < this.rd || (this.stop && this.stop.k === 'station')) return;
    // la nuit et pendant l'attaque du Brise-Glace, pas de raid ordinaire
    if (this.night() > 0.5 || this.boss) { this.rd = this.dist + 40; return; }
    const r = makeRng(hash(this.seed * 29 + this.rn * 389 + 7)); this.rn++;
    this.rd = this.dist + r.range(...this.D.raidGap) * this.B().raid;
    const n = Math.min(3, 1 + (this.dist > 900 ? 1 : 0) + (this.diff === 'blizzard' && this.dist > 1500 ? 1 : 0));
    const side = r.chance(0.5) ? -1 : 1;
    this.spawnRaiders(n, side, r);
    this.events.push({ e: 'raid', n, side });
  }
  spawnRaiders(n, side, r) {
    for (let i = 0; i < n; i++) {
      const sd = i % 2 ? -side : side;
      this.raiders.push({ id: this.nid++, x: sd * (HALF_W + 5), z: REAR + 22 + i * 7, side: sd, st: 0, t: 0, carry: 0, tz: r2(r.range(-7, 13)) });
    }
  }
  crashRaider(w, by) {
    w.st = 3; w.t = 0;
    for (let i = 0; i < w.carry; i++) this.spawnCrate(w.x + w.side * 0.8, CRATE_H, w.z + i * 0.7, 0);
    w.carry = 0; this.scrap += 1 + this.up.salvage;
    this.events.push({ e: 'repel', p: by, x: w.x, z: w.z, s: 1 + this.up.salvage });
  }
  stepRaiders(dt) {
    const FR = flareR(this.up);
    for (let i = this.raiders.length - 1; i >= 0; i--) {
      const w = this.raiders[i];
      if (w.st === 3) { w.z += this.v * dt; if (w.z > REAR + 70) this.raiders.splice(i, 1); continue; } // renversé : reste au sol
      // une fusée tout près : ils décrochent (avec leur butin)
      if (w.st < 2) for (const f of this.flares) {
        const fz = f.m === 0 ? f.z + this.dist : f.z;
        if (Math.hypot(f.x - w.x, fz - w.z) < FR) { w.st = 2; this.events.push({ e: 'flee', x: w.x, z: w.z }); break; }
      }
      // touchés par une caisse lancée : renversés
      for (const c of this.crates) if (c.m === 2 && c.y < 2.2 && Math.hypot(c.x - w.x, c.z - w.z) < 1.2 && w.st < 3) { this.crashRaider(w, c.by); break; }
      if (w.st === 3) continue;
      if (w.st === 2) { // fuite vers l'arrière
        w.x += w.side * 2 * dt; w.z += RAID_V * dt;
        if (w.z > REAR + 60) { this.raiders.splice(i, 1); if (w.carry) this.events.push({ e: 'stolen', n: w.carry }); }
        continue;
      }
      const tx = w.side * (HALF_W + 1.3), dx = tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
      if (d > 0.05) { const k = Math.min(1, RAID_V * dt / d); w.x += dx * k; w.z += dz * k; }
      if (w.st === 0 && d < 0.6) { w.st = 1; w.t = RAID_STEAL_T; this.events.push({ e: 'board_raid', x: w.x, z: w.z }); }
      if (w.st === 1) {
        w.t -= dt;
        if (w.t <= 0) {
          w.t = RAID_STEAL_T;
          let best = null, bd = 1e9;
          for (const c of this.crates) if (c.m === 1) { const dd = Math.hypot(c.x - w.x, c.z - w.z); if (dd < bd) { bd = dd; best = c; } }
          if (best) { this.crates.splice(this.crates.indexOf(best), 1); w.carry++; this.events.push({ e: 'steal', x: w.x, z: w.z }); }
          else { this.damage(6); this.events.push({ e: 'sabotage', x: w.x, z: w.z }); }
          w.tz = r2(clamp(w.tz + (w.carry ? 6 : -5), -8, 14));
          w.n = (w.n | 0) + 1;
          if (w.carry >= 2 || w.n >= 3) w.st = 2; // butin suffisant (ou trois coups) : ils décrochent
        }
      }
    }
  }

  /* -------------------------------------------------------------- moments forts */
  endMoment() { this.mm = null; this.mi++; }
  stepMoment(dt) {
    let M = this.mm;
    if (!M) {
      if (this.stop) return;
      const pos = momentPos(this.seed, this.mode, this.goal, this.mi);
      if (pos == null) { if (this.mi < this.cl) this.mi++; return; }
      const m = momentOf(this.seed, this.mode, this.goal, this.legs, this.mi);
      if (!m) return; // ambiance pas encore choisie
      if (this.dist > m.d + BRIDGE_LEN + 60) { this.mi++; return; } // déjà dépassé (reprise d'un état)
      const lead = m.k === 'bridge' ? 200 : m.k === 'wreck' ? 150 : 0;
      if (this.dist < m.d - lead) return;
      M = this.mm = { k: m.k, L: m.L, d: m.d, t: 0, s: 0, ck: 0, done: 0 };
      if (m.k === 'boss') this.spawnBoss();
      this.events.push({ e: 'moment', k: m.k });
    }
    M.t += dt;
    if (M.k === 'roar') {
      if (M.t >= ROAR_T && !M.ck) { M.ck = 1; this.events.push({ e: 'roar_end' }); }
      if (M.t >= ROAR_T + CALM_T) this.endMoment();
    } else if (M.k === 'bridge') {
      const b0 = M.d, b1 = M.d + BRIDGE_LEN;
      // le convoi est sur le pont : trop vite, il souffre
      if (this.dist - BODY_FRONT >= b0 && this.dist - REAR <= b1) {
        const over = this.v - this.bridgeLimit();
        if (over > 0) {
          M.s += over * dt * 0.9;
          if (Math.floor(M.t * 1.5) !== Math.floor((M.t - dt) * 1.5)) this.events.push({ e: 'creak' });
          if (M.s >= 1 && !M.ck) { M.ck = 1; this.damage(35); this.events.push({ e: 'bridge_crack' }); }
        }
      }
      // dehors, au-dessus de la gorge : la chute
      for (const p of this.players.values()) {
        const D = this.dist - p.z;
        if (!p.on && p.st < 2 && p.y < 0.4 && D > b0 && D < b1 && Math.abs(p.x) > 1.7) {
          p.carry = 0; p.cth = 0;
          Object.assign(p, { st: 3, tm: LOST_T, vx: 0, vy: 0, vz: 0, air: 0 });
          this.events.push({ e: 'gorge', p: p.id });
        }
      }
      for (let i = this.crates.length - 1; i >= 0; i--) { const c = this.crates[i]; if (c.m === 0 && -c.z > b0 && -c.z < b1 && Math.abs(c.x) > 1.7) this.crates.splice(i, 1); }
      for (let i = this.wolves.length - 1; i >= 0; i--) { const w = this.wolves[i]; if (-w.zw > b0 && -w.zw < b1 && Math.abs(w.x) > 1.7) this.wolves.splice(i, 1); }
      if (this.dist - REAR > b1 + 5) { if (!M.ck) this.events.push({ e: 'bridge_done' }); this.endMoment(); }
    } else if (M.k === 'wreck') {
      if (M.done && !this.stop) this.endMoment();
    } else if (M.k === 'boss') {
      if (!this.boss) this.endMoment();
    }
  }
  // Convoi abandonné : le convoi s'arrête, des caisses attendent le long du vieux train
  wreckArrive() {
    const n = Math.min(8, 4 + this.players.size);
    const r = makeRng(hash(this.seed * 47 + this.mm.L * 337));
    this.stop = { k: 'wreck', t: WRECK_T, v: [] };
    for (let i = 0; i < n; i++) {
      const z = -12 + (26 * (i + 0.5)) / n + r.range(-1, 1);
      this.spawnCrate(-(HALF_W + r.range(3.3, 4.4)), CRATE_H, z, 0, null, this.lootType(this.mm.L * 101 + i, this.bio()));
    }
    this.scrap += 2;
    this.events.push({ e: 'wreck', n });
  }

  /* -------------------------------------------------------------- le Brise-Glace */
  spawnBoss() {
    const r = makeRng(hash(this.seed * 53 + this.mi * 211));
    const side = r.chance(0.5) ? -1 : 1, hp = 3 + (this.players.size >= 3 ? 1 : 0) + (this.diff === 'blizzard' ? 1 : 0);
    this.boss = { x: side * (HALF_W + 5), z: REAR + 40, hp, hm: hp, side, st: 0, t: 0, ft: 5 };
    this.spawnRaiders(2, side, r);
  }
  stepBoss(dt) {
    const b = this.boss; if (!b) return;
    b.t += dt;
    if (b.st === 3) { b.z += this.v * dt; if (b.z > REAR + 80) this.boss = null; return; } // épave
    if (b.st === 2) { b.z += RAID_V * dt; b.x += b.side * 1.5 * dt; if (b.z > REAR + 70) this.boss = null; return; } // il repart
    // touché par une caisse lancée
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (c.m !== 2 || c.y > 3.2 || Math.abs(c.x - b.x) > 1.7 || Math.abs(c.z - b.z) > 2.7) continue;
      this.crates.splice(i, 1);
      const p = this.players.get(c.by);
      b.hp -= p && p.role === GUARD ? 2 : 1;
      this.events.push({ e: 'boss_hit', p: c.by, x: b.x, z: b.z, hp: Math.max(0, b.hp) });
      if (b.hp <= 0) {
        b.st = 3; this.hooks = [];
        const r = makeRng(hash(this.seed * 59 + this.mi));
        [1, 2, 4].forEach((t, k) => this.spawnCrate(b.x + r.range(-1, 1), CRATE_H, b.z - 1.5 + k * 1.4, 0, null, t));
        const s = 4 + 2 * this.up.salvage; this.scrap += s;
        this.events.push({ e: 'boss_down', p: c.by, x: b.x, z: b.z, s });
        return;
      }
    }
    if (b.t > BOSS_T) { b.st = 2; this.hooks = []; this.events.push({ e: 'boss_gone' }); return; }
    // il longe le convoi et lance ses grappins
    const tz = 2 + Math.sin(b.t * 0.3) * 7, tx = b.side * (HALF_W + 4.2);
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d > 0.05) { const k = Math.min(1, RAID_V * dt / d); b.x += dx * k; b.z += dz * k; }
    if (b.st === 0 && d < 1) b.st = 1;
    if (b.st === 1) {
      b.ft -= dt;
      if (b.ft <= 0) {
        b.ft = 6.5;
        if (this.hooks.length < MAX_HOOKS) {
          const used = new Set(this.hooks.map((h) => h.z));
          const free = HOOK_SPOTS.filter((z) => !used.has(z));
          const z = free[(this.nid + Math.floor(b.t)) % free.length];
          this.hooks.push({ id: this.nid++, x: b.side * (HALF_W - 0.15), z, prog: 0 });
          this.events.push({ e: 'hook', x: b.side * (HALF_W - 0.15), z });
        }
      }
    }
  }

  /* -------------------------------------------------------------- froid */
  coldStep(p, dt) {
    if (p.st === 3) return;
    const K = this.D.cold * this.B().cold * (1 - 0.25 * this.up.coats) * (this.gust > 0 ? 2 : 1) * (1 + 0.2 * this.night()) * (p.role === STOKER ? 0.7 : 1);
    let h = p.heat ?? 100;
    const near = p.on && this.fuel > 0 && Math.hypot(p.x - BOILER.x, p.z - BOILER.z) < warmR(this.up);
    if (this.stop && this.stop.k === 'station') h += 8 * dt;
    else if (near) h += 16 * (1 + 0.6 * this.up.warm) * (p.role === STOKER ? 1.5 : 1) * dt;
    else if (p.on) h -= 0.3 * K * dt;
    else h -= 1.7 * K * dt;
    // une caisse gelée portée près du feu dégèle
    if (p.carry === 3 && near) { p.cth = (p.cth || 0) + dt / THAW_T; if (p.cth >= 1) { p.carry = 1; p.cth = 0; this.events.push({ e: 'thawed', x: p.x, z: p.z }); } }
    p.heat = h = clamp(h, 0, 100);
    if (h < 25 && !p.cw) { p.cw = 1; this.events.push({ e: 'cold', p: p.id }); }
    if (h > 45) p.cw = 0;
    if (h <= 0) {
      p.frz = (p.frz || 0) + dt;
      if (p.frz > FREEZE_T) {
        if (p.carry) this.dropCarry(p);
        Object.assign(p, { st: 3, tm: LOST_T, vx: 0, vy: 0, vz: 0, air: 0, frz: 0 });
        this.events.push({ e: 'frozen', p: p.id });
      }
    } else p.frz = 0;
  }
  // lac gelé : immobile trop longtemps, la glace cède
  groundStep(p, dt, ice) {
    if (!ice || p.on || p.air || p.st >= 2) { p.ic = 0; return; }
    if (Math.hypot(p.vx, p.vz) < 1) {
      const was = p.ic || 0; p.ic = was + dt;
      if (was < ICE_T * 0.5 && p.ic >= ICE_T * 0.5) this.events.push({ e: 'ice_warn', p: p.id, x: p.x, z: p.z });
      if (p.ic >= ICE_T) {
        p.ic = 0; if (p.carry) this.dropCarry(p);
        p.st = 1; p.tm = 2; p.heat = Math.max(0, (p.heat ?? 100) - 35);
        this.events.push({ e: 'crack', p: p.id, x: p.x, z: p.z });
      }
    } else p.ic = Math.max(0, (p.ic || 0) - dt * 2);
  }

  /* -------------------------------------------------------------- loups */
  maybeWolves(k, ch) {
    if (k < 3 || this.wolves.length >= MAX_WOLVES) return;
    const r = makeRng(hash(this.seed * 3 + k * 7919));
    const B = BIOMES[ch.bio] || BIOMES.plaine;
    if (!r.chance(this.D.wolves * B.wolves * (1 + this.night()) * (1 + this.dist / 2500))) return;
    const den = ch.ruins.length ? r.pick(ch.ruins) : { x: (r.chance(0.5) ? -1 : 1) * r.range(10, 24), zw: -k * CHUNK - CHUNK / 2 };
    if (ch.clear && -den.zw > ch.clear[0] - 10 && -den.zw < ch.clear[1] + 10) return;
    const n = 1 + r.int(0, this.dist > 800 ? 2 : 1);
    for (let i = 0; i < n && this.wolves.length < MAX_WOLVES; i++) {
      const hx = den.x + r.range(-3, 3) + (Math.sign(den.x) || 1) * 4, hz = den.zw + r.range(-4, 4);
      this.wolves.push({ id: this.nid++, x: hx, zw: hz, yaw: r.range(0, 6.28), st: 0, t: 0, tg: -1, hx, hz, a: r.range(0, 6.28), fx: 0, fz: 0 });
    }
    this.events.push({ e: 'howl', x: den.x });
  }

  stepWolves(dt, colliders) {
    const V = this.D.wolfV, FR = flareR(this.up), sight = WOLF_SIGHT * (1 + 0.4 * this.night());
    for (let i = this.wolves.length - 1; i >= 0; i--) {
      const w = this.wolves[i];
      let z = w.zw + this.dist;
      if (z > REAR + 80 || z < -150) { this.wolves.splice(i, 1); continue; }
      // une fusée allumée tout près : fuite
      for (const f of this.flares) {
        const fz = f.m === 0 ? f.z + this.dist : f.z;
        if (w.st !== 2 && Math.hypot(f.x - w.x, fz - z) < FR) { w.st = 2; w.t = 3.5; w.fx = f.x; w.fz = fz; w.tg = -1; this.events.push({ e: 'yelp', x: w.x, z }); }
      }
      let mx = 0, mz = 0, sp = 0;
      if (w.st === 2) { // fuite
        w.t -= dt;
        const dx = w.x - w.fx, dz = z - w.fz, d = Math.hypot(dx, dz) || 1;
        mx = dx / d; mz = dz / d; sp = 6.2;
        if (w.t <= 0) { w.st = 0; w.hx = w.x; w.hz = w.zw; }
      } else if (w.st === 1) { // chasse
        const p = this.players.get(w.tg);
        if (!p || p.on || p.st >= 2 || p.y > 0.6 || Math.hypot(p.x - w.x, p.z - z) > WOLF_GIVEUP) { w.st = 0; w.tg = -1; }
        else {
          const dx = p.x - w.x, dz = p.z - z, d = Math.hypot(dx, dz) || 1;
          mx = dx / d; mz = dz / d; sp = V;
          if (d < WOLF_BITE) {
            // morsure : le joueur trébuche, perd de la chaleur et lâche sa caisse ; le loup recule
            if (p.carry) this.dropCarry(p);
            p.st = 1; p.tm = 1.3; p.heat = Math.max(0, (p.heat ?? 100) - 18); p.vx += mx * 4; p.vz += mz * 4; p.bites = (p.bites | 0) + 1;
            w.st = 2; w.t = 3.5; w.fx = p.x; w.fz = p.z; w.tg = -1;
            this.events.push({ e: 'bite', p: p.id, x: p.x, z: p.z });
          }
        }
      } else { // rôde autour de son repaire
        w.a += dt * 0.55;
        const tx = w.hx + Math.cos(w.a) * 4, tz = w.hz + this.dist + Math.sin(w.a) * 4;
        const dx = tx - w.x, dz = tz - z, d = Math.hypot(dx, dz);
        if (d > 0.3) { mx = dx / d; mz = dz / d; sp = Math.min(1.8, d * 2); }
        let best = null, bd = sight;
        for (const p of this.players.values()) {
          if (p.on || p.st >= 2 || p.y > 0.6) continue;
          const dd = Math.hypot(p.x - w.x, p.z - z); if (dd < bd) { bd = dd; best = p; }
        }
        if (best) { w.st = 1; w.tg = best.id; this.events.push({ e: 'growl', x: w.x, z }); }
      }
      // contournement : bloqué contre un obstacle, le loup part de côté un instant
      if (w.sk > 0) { w.sk -= dt; const sd = w.sd || 1; const ox = mx; mx = mx * 0.25 - mz * sd; mz = mz * 0.25 + ox * sd; const l = Math.hypot(mx, mz) || 1; mx /= l; mz /= l; }
      // déplacement en repère du train, puis retour au repère du sol
      const x0 = w.x, z0 = z;
      if (sp > 0) { w.yaw = Math.atan2(mx, mz); w.x += mx * sp * dt; z += mz * sp * dt; }
      const q = { x: w.x, z };
      if (Math.abs(q.x) < HALF_W + 0.8 && q.z > BODY_FRONT - 1 && q.z < REAR + 0.5) pushOutBox(q, 0, (BODY_FRONT + REAR) / 2, 2 * HALF_W + 0.6, REAR - BODY_FRONT + 1, 0, 0.4);
      for (const c of colliders) if (Math.abs(c.z - q.z) < 6 && Math.abs(c.x - q.x) < 6) pushOutBox(q, c.x, c.z, c.w, c.d, c.rot, 0.4);
      if (sp > 1 && !(w.sk > 0) && Math.hypot(q.x - x0, q.z - z0) < sp * dt * 0.3) { w.sk = 0.6; w.sd = -(w.sd || 1); }
      w.x = clamp(q.x, -44, 44); w.zw = q.z - this.dist;
    }
  }

  /* -------------------------------------------------------------- fusées éclairantes */
  stepFlares(dt) {
    for (let i = this.flares.length - 1; i >= 0; i--) {
      const f = this.flares[i]; f.t -= dt;
      if (f.t <= 0 || (f.m === 0 && f.z + this.dist > REAR + 70)) this.flares.splice(i, 1);
    }
  }

  interact(p, dt) {
    const inp = p.inp || {};
    const use = !!inp.use, useEdge = use && !p.pu; p.pu = use;
    if (p.pt == null) p.pt = inp.thr | 0;
    const thrEdge = (inp.thr | 0) !== p.pt; p.pt = inp.thr | 0;
    if (p.pf == null) p.pf = inp.fl | 0;
    const flEdge = (inp.fl | 0) !== p.pf; p.pf = inp.fl | 0;
    p.wk = 0;
    if (p.st >= 2) { p.sp = 0; return; }
    const onDeck = p.on && !p.air;
    const meca = (p.role === MECA ? 1.8 : 1) * (1 + 0.4 * this.up.toolkit);
    // fusée éclairante : posée là où l'on est, elle fait fuir les loups
    if (flEdge) {
      if (p.flares > 0) {
        p.flares--;
        this.flares.push({ id: this.nid++, m: p.on ? 1 : 0, x: p.x, z: p.on ? p.z : p.z - this.dist, t: FLARE_T * (1 + 0.5 * this.up.longflare) });
        this.events.push({ e: 'flare', p: p.id, x: p.x, z: p.z });
      } else this.events.push({ e: 'noflare', p: p.id });
    }
    // lancer (le charbon est lourd : on le lance moins loin ; la vigie lance plus loin)
    if (thrEdge && p.carry) {
      const t = p.carry, th = p.cth || 0; p.carry = 0; p.cth = 0;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), k = (t === 2 ? 0.65 : 1) * (p.role === GUARD ? 1.2 : 1);
      const c = this.spawnCrate(p.x + fx * 0.5, p.y + 1.3, p.z + fz * 0.5, 2, { vx: fx * 6.5 * k + p.vx * 0.5, vy: 6.4 * (t === 2 ? 0.8 : 1), vz: fz * 6.5 * k + p.vz * 0.5 + (p.ref ? 0 : this.v) }, t, th);
      c.by = p.id;
      this.events.push({ e: 'throw', p: p.id, x: p.x, z: p.z });
      return;
    }
    // nourrir la chaudière (ou y ranger les pièces)
    if (useEdge && p.carry && onDeck && Math.hypot(p.x - BOILER.x, p.z - BOILER.z) < FEED_R) { this.feed(p.id, p.carry); p.carry = 0; p.cth = 0; return; }
    // à bord : manette, soupape, grappins, réparations
    if (onDeck && !p.carry && !this.calm) {
      if (useEdge && Math.hypot(p.x - LEVER.x, p.z - LEVER.z) < LEVER.r) {
        this.thr = (this.thr + 1) % THROTTLE.length;
        this.events.push({ e: 'throttle', p: p.id, l: this.thr });
        return;
      }
      if (use && Math.hypot(p.x - VALVE.x, p.z - VALVE.z) < VALVE.r) {
        if (useEdge) this.events.push({ e: 'vent', p: p.id });
        this.press = Math.max(0, this.press - VENT_RATE * (p.role === MECA ? 1.5 : 1) * dt); p.wk = 1;
        return;
      }
      if (use) {
        let h = null, hd = FIX_R;
        for (const q of this.hooks) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < hd) { hd = d; h = q; } }
        if (h) {
          h.prog += dt / HOOK_T * meca; p.wk = 1;
          if (h.prog >= 1) { this.hooks.splice(this.hooks.indexOf(h), 1); this.events.push({ e: 'cut', p: p.id, x: h.x, z: h.z }); }
          return;
        }
        let f = null, fd = FIX_R;
        for (const q of this.faults) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d < fd) { fd = d; f = q; } }
        if (f) {
          f.prog += dt / FAULTS[f.k].fix * meca; p.wk = 1;
          if (f.prog >= 1) { this.faults.splice(this.faults.indexOf(f), 1); this.events.push({ e: 'fixed', p: p.id, k: f.k, x: f.x, z: f.z }); }
          return;
        }
      }
    }
    // repousser un pillard (depuis le bord du wagon ou dans la neige)
    if (useEdge && !p.carry && !p.air) {
      const R = p.role === GUARD ? 1.6 : 1;
      for (const w of this.raiders) {
        if (w.st > 1) continue;
        const reach = p.on ? Math.abs(p.x) > HALF_W - 0.7 && Math.sign(p.x) === w.side && Math.abs(p.z - w.z) < RAID_REACH * R : Math.hypot(p.x - w.x, p.z - w.z) < 1.4 * R;
        if (reach) { this.crashRaider(w, p.id); return; }
      }
    }
    // ramasser
    if (useEdge && !p.carry && !p.air) {
      let best = null, bd = USE_R;
      for (const c of this.crates) {
        if (c.m === 2 || (c.m === 1) !== !!p.on) continue;
        const cz = c.m === 0 ? c.z + this.dist : c.z;
        const d = Math.hypot(c.x - p.x, cz - p.z);
        if (d < bd) { bd = d; best = c; }
      }
      if (best) { this.crates.splice(this.crates.indexOf(best), 1); p.carry = best.t || 1; p.cth = best.th || 0; p.sp = 0; this.events.push({ e: 'pick', p: p.id, x: p.x, z: p.z, t: p.carry }); return; }
    }
    // fouiller une ruine (maintenir)
    if (use && !p.carry && !p.on && !p.air && !p.dig) {
      const hit = this.nearRuin(p.x, p.z);
      if (hit) {
        const [r, bio] = hit;
        if (p.sr !== r.id) { p.sr = r.id; p.sp = 0; }
        p.sp += dt / SEARCH_T * (p.role === SCOUT ? 2 : 1) * (1 + 0.8 * this.up.crowbar);
        if (p.sp >= 1) {
          p.sp = 0; this.looted.add(r.id);
          const sz = r.spot.zw + this.dist;
          for (let i = 0; i < r.loot; i++) this.spawnCrate(r.spot.x - r.side * 0.8, CRATE_H, sz + (i ? 0.8 * i : -0.4), 0, null, this.lootType(r.id * 5 + i, bio));
          p.found += r.loot; this.scrap += r.scrap || 0;
          this.events.push(r.loot || r.scrap ? { e: 'found', p: p.id, n: r.loot, s: r.scrap || 0, x: r.spot.x, z: sz } : { e: 'empty', p: p.id, x: r.spot.x, z: sz });
        }
        return;
      }
    }
    p.sp = Math.max(0, p.sp - dt * 2);
  }

  // ruine à fouiller la plus proche, avec l'ambiance de son tronçon : [ruine, ambiance]
  nearRuin(x, z) {
    let best = null, bd = SEARCH_R;
    for (const [, c] of this.ruins.around(this.dist, 40, 70)) for (const r of c.ruins) {
      if (this.looted.has(r.id)) continue;
      const d = Math.hypot(r.spot.x - x, r.spot.zw + this.dist - z);
      if (d < bd) { bd = d; best = [r, c.bio]; }
    }
    return best;
  }

  // t : type de caisse (fioul, charbon, gelée, pièces)
  feed(byId, t = 1) {
    const p = this.players.get(byId);
    const C = CRATES[t] || CRATES[1];
    if (C.scrap) {
      const s = C.scrap + this.up.salvage; this.scrap += s;
      this.events.push({ e: 'stash', p: byId, s });
      return;
    }
    const before = this.fuel;
    const a = C.fuel + (p && p.role === STOKER && t !== 3 ? 6 : 0);
    this.fuel = Math.min(this.fmax, this.fuel + a);
    this.fedTotal++;
    if (p) p.fed++;
    this.events.push({ e: 'feed', p: byId, fu: Math.round(this.fuel), rescue: before <= 0, a, t });
  }

  stepCrates(dt) {
    const TR = warmR(this.up) + 0.6;
    for (let i = this.crates.length - 1; i >= 0; i--) {
      const c = this.crates[i];
      if (c.m === 0) { if (c.z + this.dist > REAR + 90) this.crates.splice(i, 1); continue; }
      if (c.m === 1) {
        // une caisse gelée posée près de la chaudière dégèle
        if (c.t === 3 && this.fuel > 0 && Math.hypot(c.x - BOILER.x, c.z - BOILER.z) < TR) {
          c.th = (c.th || 0) + dt / THAW_T;
          if (c.th >= 1) { c.t = 1; c.th = 0; this.events.push({ e: 'thawed', x: c.x, z: c.z }); }
        }
        continue;
      }
      const py = c.y;
      c.vy -= G * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      const hd = Math.hypot(c.x - BOILER.x, c.z - BOILER.z);
      if (hd < BOILER.r + CRATE_H && c.y < BOILER.top && onDeckRect(c.x, c.z)) {
        if (py >= BOILER.top - 0.1 && hd < BOILER.mouth) { this.crates.splice(i, 1); this.feed(c.by, c.t); continue; } // en plein dans le foyer
        const s = (BOILER.r + CRATE_H) / Math.max(hd, 1e-3); c.x = BOILER.x + (c.x - BOILER.x) * s; c.z = BOILER.z + (c.z - BOILER.z) * s; c.vx = c.vz = 0;
      }
      if (onDeckRect(c.x, c.z) && c.y <= DECK_Y + CRATE_H && py > DECK_Y + CRATE_H - 0.3) {
        c.m = 1; c.y = DECK_Y + CRATE_H; c.vx = c.vy = c.vz = 0;
        c.x = clamp(c.x, -HALF_W + 0.3, HALF_W - 0.3);
        this.events.push({ e: 'thud', x: c.x, z: c.z, deck: 1 });
      } else if (c.y <= CRATE_H) {
        // filet de récupération : une caisse qui retombe tout près du wagon est rattrapée à bord
        if (this.up.net && Math.abs(c.x) < HALF_W + 2.8 && c.z > DECK_FRONT && c.z < REAR) {
          c.m = 1; c.y = DECK_Y + CRATE_H; c.vx = c.vy = c.vz = 0; c.x = Math.sign(c.x || 1) * (HALF_W - 0.35);
          this.events.push({ e: 'netted', x: c.x, z: c.z });
          continue;
        }
        // au sol : la caisse rejoint le repère de la plaine
        if (Math.abs(c.x) < HALF_W + 0.4 && c.z > BODY_FRONT && c.z < REAR) c.x = Math.sign(c.x || 1) * (HALF_W + 0.5);
        c.m = 0; c.y = CRATE_H; c.z -= this.dist; c.vx = c.vy = c.vz = 0;
        this.events.push({ e: 'thud', x: c.x, z: c.z + this.dist });
      }
    }
  }

  drainEvents() { const e = this.events; this.events = []; return e; }

  // État diffusé (compact) : c'est aussi tout ce qu'il faut pour reprendre la partie (migration d'hôte)
  snapshot() {
    const s = this.stop, E = this.ev, b = this.boss;
    return {
      v: 3, t: r2(this.t), ph: this.phase, wn: this.win, mo: this.mode, gl: this.goal, sd: this.seed, df: this.diff,
      d: r2(this.dist), sp: r2(this.v), fu: r2(this.fuel), fm: this.fmax,
      st: r2(this.stallT), ks: this.ks, lw: this.lowWarned ? 1 : 0, nid: this.nid, ft: this.fedTotal, br: r2(this.burnRate()),
      sc: this.scrap, up: UPG_KEYS.map((k) => this.up[k]), ns: this.ns, gu: r2(this.gust), en: this.en, ed: r2(this.ed),
      so: s ? (s.k === 'station' ? { k: s.k, i: s.i, t: r2(s.t), v: s.v, c: s.c, b: s.b, f: s.f, fk: s.fk, rv: s.rv } : s.k === 'wreck' ? { k: s.k, t: r2(s.t), v: s.v } : { k: s.k }) : null,
      ev: E ? { ...E, ...(E.prog != null ? { prog: r2(E.prog) } : {}), t: r2(E.t || 0) } : null,
      P: [...this.players.values()].map((p) => [p.id, r2(p.x), r2(p.y), r2(p.z), r2(p.vx), r2(p.vy), r2(p.vz), r2(p.yaw),
        p.on, p.air, p.ref, p.st, r2(p.tm), p.carry, r2(p.sp), p.q, p.pj ?? 0, p.fed, p.found, p.falls, p.slot,
        r2(p.heat ?? 100), r2(p.frz || 0), p.flares | 0, p.dig || p.wk ? 1 : 0, p.bites | 0, p.cw | 0, p.role | 0, r2(p.ic || 0), r2(p.cth || 0)]),
      N: [...this.players.values()].map((p) => [p.id, p.name, p.color]),
      C: this.crates.map((c) => [c.id, c.m, r2(c.x), r2(c.y), r2(c.z), r2(c.vx), r2(c.vy), r2(c.vz), c.by, c.t, r2(c.th || 0)]),
      W: this.wolves.map((w) => [w.id, r2(w.x), r2(w.zw), r2(w.yaw), w.st, r2(w.t), w.tg, r2(w.hx), r2(w.hz), r2(w.a), r2(w.fx), r2(w.fz), r2(w.sk || 0), w.sd || 1]),
      F: this.flares.map((f) => [f.id, f.m, r2(f.x), r2(f.z), r2(f.t)]),
      th: this.thr, pr: r2(this.press), pw: this.pw ? 1 : 0, hu: r2(this.hull), sto: r2(this.storm), sw: this.sw, wy: this.why, ca: this.calm ? 1 : 0,
      nf: r2(this.nf), fn: this.fn, rd: r2(this.rd), rn: this.rn,
      FA: this.faults.map((f) => [f.id, f.k, f.s, f.x, f.z, r2(f.prog)]),
      R: this.raiders.map((w) => [w.id, r2(w.x), r2(w.z), w.side, w.st, r2(w.t), w.carry, w.tz, w.n | 0]),
      L: [...this.looted],
      lg: this.legs, mi: this.mi, cl: this.cl, nt: this.nt,
      mm: this.mm ? { ...this.mm, t: r2(this.mm.t), s: r2(this.mm.s) } : null,
      bo: b ? [r2(b.x), r2(b.z), b.hp, b.hm, b.side, b.st, r2(b.t), r2(b.ft)] : null,
      HK: this.hooks.map((h) => [h.id, h.x, h.z, r2(h.prog)]),
    };
  }

  static restore(s) {
    const sim = new Sim({ seed: s.sd, difficulty: s.df, mode: s.mo || 'expedition' });
    Object.assign(sim, { t: s.t, phase: s.ph, win: s.wn | 0, dist: s.d, v: s.sp, fuel: s.fu, stallT: s.st, ks: s.ks ?? -1, lowWarned: !!s.lw, nid: s.nid, fedTotal: s.ft | 0 });
    if (s.gl != null) sim.goal = s.gl;
    if (Array.isArray(s.lg)) { sim.legs = [...s.lg]; sim.ruins = new Ruins(sim.seed, sim.D.loot, sim.mode, sim.goal); sim.ruins.setLegs(sim.legs); }
    sim.scrap = s.sc | 0; sim.ns = s.ns | 0; sim.gust = s.gu || 0;
    if (s.en != null) { sim.en = s.en; sim.ed = s.ed; }
    if (Array.isArray(s.up)) UPG_KEYS.forEach((k, i) => { sim.up[k] = s.up[i] | 0; });
    const so = s.so;
    sim.stop = !so ? null
      : so.k === 'station' ? { k: 'station', i: so.i, t: so.t, v: [...(so.v || [])], c: [...(so.c || [])], b: [...(so.b || [0, 0, 0])], f: so.f | 0, fk: so.fk ? [...so.fk] : null, rv: (so.rv || []).map((x) => [...x]) }
        : so.k === 'wreck' ? { k: 'wreck', t: so.t, v: [...(so.v || [])] } : { k: so.k };
    sim.ev = s.ev ? { ...s.ev } : null;
    const names = new Map(s.N.map(([id, n, c]) => [id, [n, c]]));
    for (const a of s.P) {
      const [n, c] = names.get(a[0]) || ['Joueur', '#2b8cff'];
      const p = sim.addPlayer({ id: a[0], name: n, color: c, role: a[27] | 0 });
      Object.assign(p, playerFromRow(a));
      p.pt = null; p.pf = null; p.pu = false;
    }
    sim.crates = s.C.map((c) => ({ id: c[0], m: c[1], x: c[2], y: c[3], z: c[4], vx: c[5], vy: c[6], vz: c[7], by: c[8], t: c[9] || 1, th: c[10] || 0 }));
    sim.wolves = (s.W || []).map((w) => ({ id: w[0], x: w[1], zw: w[2], yaw: w[3], st: w[4], t: w[5], tg: w[6], hx: w[7], hz: w[8], a: w[9], fx: w[10], fz: w[11], sk: w[12] || 0, sd: w[13] || 1 }));
    sim.flares = (s.F || []).map((f) => ({ id: f[0], m: f[1], x: f[2], z: f[3], t: f[4] }));
    if (s.th != null) Object.assign(sim, { thr: s.th, press: s.pr, pw: !!s.pw, hull: s.hu, storm: s.sto, sw: s.sw | 0, why: s.wy || '', calm: !!s.ca, nf: s.nf, fn: s.fn | 0, rd: s.rd, rn: s.rn | 0 });
    sim.faults = (s.FA || []).map((f) => ({ id: f[0], k: f[1], s: f[2], x: f[3], z: f[4], prog: f[5] }));
    sim.raiders = (s.R || []).map((w) => ({ id: w[0], x: w[1], z: w[2], side: w[3], st: w[4], t: w[5], carry: w[6], tz: w[7], n: w[8] | 0 }));
    sim.looted = new Set(s.L);
    if (s.mi != null) Object.assign(sim, { mi: s.mi, cl: s.cl | 0, nt: s.nt | 0 });
    sim.mm = s.mm ? { ...s.mm } : null;
    const b = s.bo; sim.boss = b ? { x: b[0], z: b[1], hp: b[2], hm: b[3], side: b[4], st: b[5], t: b[6], ft: b[7] } : null;
    sim.hooks = (s.HK || []).map((h) => ({ id: h[0], x: h[1], z: h[2], prog: h[3] }));
    return sim;
  }
}

// Ligne P d'un snapshot → champs de joueur (utilisé par restore et par la prédiction des invités)
export function playerFromRow(a) {
  return { id: a[0], x: a[1], y: a[2], z: a[3], vx: a[4], vy: a[5], vz: a[6], yaw: a[7], on: a[8], air: a[9], ref: a[10], st: a[11], tm: a[12], carry: a[13], sp: a[14], q: a[15], pj: a[16], fed: a[17], found: a[18], falls: a[19], slot: a[20],
    heat: a[21] ?? 100, frz: a[22] || 0, flares: a[23] | 0, dig: a[24] | 0, bites: a[25] | 0, cw: a[26] | 0, role: a[27] | 0, ic: a[28] || 0, cth: a[29] || 0 };
}
// Améliorations d'un snapshot, par nom
export const snapUp = (s) => Object.fromEntries(UPG_KEYS.map((k, i) => [k, (s.up && s.up[i]) | 0]));

// Vent d'une bourrasque, tel que le voit stepPlayer (utilisé aussi par la prédiction des invités)
export function windOf(snap) { return snap.gu > 0 ? ((snap.ev && snap.ev.side) || 1) * 1.4 : 0; }

export const personalScore = (p) => p.fed * 100 + p.found * 25;
export { DECK_Y, REAR, BOILER, HALF_W, DECK_FRONT, LADDER, BIOMES, BIOME_KEYS };
