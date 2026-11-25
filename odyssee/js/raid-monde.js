// odyssee/js/raid-monde.js — les boss de raid qui apparaissent dans la région.
//
// Toutes les 90 minutes (heure réelle), un boss de raid surgit sur une route tirée au sort et y reste 15 minutes.
// Tout se déduit de l'heure : chaque joueur du salon calcule le même créneau, la même route et le même boss sans rien
// s'échanger. On ne l'annonce (gros « boom » et bandeau) et on ne le montre que si au moins un autre joueur est connecté :
// le raid se joue en coop, de 2 à 4 joueurs (combat double, triple ou quadruple, multi-events.js : lancerRaidMonde).
// Pour le lancer, tous les joueurs connectés doivent être près du boss (quatre au plus). 5 essais par joueur et par
// apparition ; un boss vaincu disparaît pour ceux qui l'ont battu.
//
// Trois rangs de boss, chacun avec son aura : bleue (Pokémon moyen), rouge (puissant), or (légendaire). Les légendaires
// viennent des générations 7 et 8 (data/raid-legendes.js) : on ne les trouve nulle part ailleurs dans le jeu. Capturé,
// un légendaire de raid est « bridé » (mon.bride) : ses stats de base sont ramenées à celles d'un bon Pokémon classique.
import { SPECIES } from './data/species.js';
import { MOVES } from './data/moves.js';
import { TALENTS_ESPECES } from './data/talents.js';
import { RAID_LEGENDES } from './data/raid-legendes.js';
import { along, caseLibre } from './world/mapgen.js';
import { RANG_ROUTES } from './world/bareme.js';
import { walkable } from './world/tiles.js';
import { ASSETS, loadImg } from './assets.js';
import { auraFrames } from './render/aura.js';

// les légendaires de raid : des espèces que le moteur sait lire, mais invisibles des listes (Pokédex, rencontres,
// trophées), comme les formes Méga
for (const [id, e] of Object.entries(RAID_LEGENDES)) {
  if (!Object.prototype.hasOwnProperty.call(SPECIES, id)) {
    const { ab, moves, ...esp } = e;
    Object.defineProperty(SPECIES, id, { enumerable: false, configurable: true, value: esp });
  }
  TALENTS_ESPECES[id] ||= [e.ab, null, null];
}

export const RAID_PERIODE = 90 * 60e3;   // une apparition toutes les heures et demie
export const RAID_DUREE = 15 * 60e3;     // le boss reste un quart d'heure
export const RAID_ESSAIS = 5;            // essais par joueur et par apparition
export const RAID_PORTEE = 8;            // distance (cases) à laquelle un joueur compte comme « là »
export const RAID_MAX_JOUEURS = 4;       // combat quadruple au plus
/** PV du boss multipliés selon le nombre de joueurs */
export const RAID_PV = { 2: 2, 3: 2.8, 4: 3.4 };

/** les rangs : aura, niveaux en plus de la moyenne des niveaux max, poids du tirage, chance de capture, récompenses */
export const RANGS = {
  moyen: { nom: 'Pokémon moyen', aura: 'bleu', bonus: 8, poids: 3, capture: 0.3, pdj: 6, bonbons: 2 },
  puissant: { nom: 'Pokémon puissant', aura: 'rouge', bonus: 7, poids: 2.5, capture: 0.18, pdj: 9, bonbons: 3 },
  legende: { nom: 'Légendaire', aura: 'or', bonus: 6, poids: 1, capture: 0.1, pdj: 14, bonbons: 4 },
};

const T = (id, sp, title, ability, moves, bg) => ({ id, sp, title, ability, moves, bg });
/** les boss de raid de la région (capacités par leur nom anglais, cherchées dans les données du jeu) */
export const BOSS_MONDE = [
  // aura bleue : des Pokémon moyens, mais gonflés
  { ...T('ronflex', 143, 'Ronflex Colosse', 'thick-fat', ['body-slam', 'crunch', 'earthquake', 'ice-punch'], 'gym'), rang: 'moyen' },
  { ...T('leviator', 130, 'Léviator Furie', 'intimidate', ['waterfall', 'crunch', 'earthquake', 'dragon-dance'], 'water'), rang: 'moyen' },
  { ...T('ectoplasma', 94, 'Ectoplasma Spectral', null, ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'focus-blast'], 'cave'), rang: 'moyen' },
  { ...T('scarhino', 214, 'Scarhino Titan', 'guts', ['megahorn', 'close-combat', 'stone-edge', 'earthquake'], 'gym'), rang: 'moyen' },
  { ...T('lucario', 448, 'Lucario Aura', null, ['aura-sphere', 'flash-cannon', 'dragon-pulse', 'extreme-speed'], 'gym'), rang: 'moyen' },
  // aura rouge : les pseudo-légendaires
  { ...T('tyranocif', 248, 'Tyranocif Alpha', 'sand-stream', ['stone-edge', 'crunch', 'earthquake', 'dragon-dance'], 'cave'), rang: 'puissant' },
  { ...T('metalosse', 376, 'Métalosse Titan', 'clear-body', ['meteor-mash', 'zen-headbutt', 'earthquake', 'ice-punch'], 'gym'), rang: 'puissant' },
  { ...T('dracolosse', 149, 'Dracolosse Ancien', 'multiscale', ['outrage', 'extreme-speed', 'fire-punch', 'dragon-dance'], 'volcanic'), rang: 'puissant' },
  { ...T('carchacrok', 445, 'Carchacrok Tempête', 'rough-skin', ['outrage', 'earthquake', 'stone-edge', 'swords-dance'], 'cave'), rang: 'puissant' },
  // aura or : les légendaires venus d'ailleurs
  ...Object.entries(RAID_LEGENDES).map(([sp, e]) => ({ ...T(e.k, +sp, e.n, e.ab, e.moves, 'league'), rang: 'legende', legend: true })),
].filter((b) => SPECIES[b.sp]);
export const rangDe = (def) => RANGS[def?.rang] || RANGS.moyen;

const PAR_CLE = new Map(Object.values(MOVES).map((m) => [m.key, m.id]));
/** numéros des capacités d'un boss (celles que le jeu connaît) */
export function capacitesBoss(def) {
  const L = def.moves.map((k) => PAR_CLE.get(k)).filter((id) => id && MOVES[id]);
  return L.length ? L : [PAR_CLE.get('tackle') || 33];
}

/** stats de base d'un légendaire capturé en raid : ramenées à un total de 540, comme un bon Pokémon classique */
export const BRIDE_TOTAL = 540;

const hash = (n) => { let h = (n ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** le créneau d'une heure donnée : son numéro, son début et sa fin, et s'il est en cours */
export function creneau(now = Date.now()) {
  const k = Math.floor(now / RAID_PERIODE);
  const debut = k * RAID_PERIODE + Math.floor(hash(k * 3 + 1) * (RAID_PERIODE - RAID_DUREE));
  return { k, debut, fin: debut + RAID_DUREE, actif: now >= debut && now < debut + RAID_DUREE };
}
/** le boss d'un créneau (le même chez tous les joueurs) : les légendaires sont plus rares */
export function bossDuCreneau(k) {
  const total = BOSS_MONDE.reduce((a, b) => a + rangDe(b).poids, 0);
  let r = hash(k * 7 + 5) * total;
  for (const b of BOSS_MONDE) { r -= rangDe(b).poids; if (r < 0) return b; }
  return BOSS_MONDE[BOSS_MONDE.length - 1];
}
export const bossParId = (id) => BOSS_MONDE.find((b) => b.id === id) || null;
/** niveau du boss : moyenne des niveaux max des participants, plus le bonus de son rang */
export const niveauBoss = (caps, def) => Math.max(10, Math.min(100, Math.round(caps.reduce((a, c) => a + c, 0) / Math.max(1, caps.length)) + rangDe(def).bonus));
/** format du combat selon le nombre de joueurs */
export const formatRaid = (n) => (n >= 4 ? 'quadruple' : n === 3 ? 'triple' : 'double');
export const joueursDuFormat = (f) => (f === 'quadruple' ? 4 : f === 'triple' ? 3 : 2);

/** routes où le boss peut apparaître : celles qu'on atteint avec 3 badges au plus (tout le salon peut y aller) */
export const ROUTES_RAID = Object.keys(RANG_ROUTES).filter((id) => RANG_ROUTES[id] <= 3);

/** les emplacements possibles : une case libre au bord du sentier, vers le milieu de chaque route */
export function emplacementsRaid(world) {
  const M = world.maps?.monde; if (!M) return [];
  const legs = new Set((world.legends || []).filter((l) => l.map === 'monde').map((l) => l.x + ',' + l.y));
  const out = [];
  for (const R of world.routes || []) {
    if (!ROUTES_RAID.includes(R.id) || !Array.isArray(R.pts) || R.pts.length < 2) continue;
    for (const t of [0.5, 0.4, 0.6]) {
      const p = along(R.pts, t);
      const [x, y] = caseLibre(M, p.x + 0.5 + p.nx * 3, p.y + 0.5 + p.ny * 3);
      if (!walkable(M.get(x, y)) || legs.has(x + ',' + y) || M.objectAt?.(x, y)) continue;
      out.push({ route: R.id, nom: R.name, x, y });
      break;
    }
  }
  return out;
}

const AURA_TEINTE = { bleu: ['#7fd0ff', '#2a6fe0'], rouge: ['#ff7a6a', '#c0101e'], or: ['#ffe680', '#e09a00'] };

export class RaidMonde {
  constructor(game) {
    this.game = game;
    this.places = null;     // emplacements (calculés une fois)
    this.courant = null;    // { k, boss, x, y, nom, fin } : le boss en ce moment
    this.annonce = -1;      // dernier créneau annoncé
    this.acteur = false;
    this.t = 0;
    this.anim = null;       // images de l'aura sur la carte
  }
  connectes() { const L = this.game.link; return L?.enabled ? L.others.size : 0; }
  /** le boss en ce moment, ou null */
  actuel(now = Date.now()) {
    const c = creneau(now);
    if (!c.actif || this.connectes() < 1) return null;
    if (!this.places) this.places = emplacementsRaid(this.game.world);
    if (!this.places.length) return null;
    const place = this.places[Math.floor(hash(c.k * 11 + 3) * this.places.length)];
    return { k: c.k, boss: bossDuCreneau(c.k), x: place.x, y: place.y, nom: place.nom, fin: c.fin };
  }
  /** essais et victoire du joueur pour ce créneau */
  suivi(k) { const f = this.game.state?.flags; if (!f) return { k, essais: 0, vaincu: false }; if (!f.raidMonde || f.raidMonde.k !== k) f.raidMonde = { k, essais: 0, vaincu: false }; return f.raidMonde; }
  essaisRestants(k) { return Math.max(0, RAID_ESSAIS - this.suivi(k).essais); }
  compterEssai(k) { this.suivi(k).essais++; }
  marquerVaincu(k) { this.suivi(k).vaincu = true; this.retirer(); }
  /** à chaque image */
  tick(dt) {
    this.animer(dt);
    this.t += dt; if (this.t < 1) return; this.t = 0;
    const g = this.game; if (!g.state || !g.mapObj) return;
    const R = this.actuel();
    const visible = R && !this.suivi(R.k).vaincu;
    if (!visible) { if (this.courant) this.retirer(); this.courant = null; return; }
    this.courant = R;
    if (this.annonce !== R.k) { this.annonce = R.k; this.annoncer(R); }
    // la vue se refait à chaque changement de carte : on regarde si le boss y est encore
    if (this.acteur && !this.chargement && !g.view?.actors?.has('raidmonde')) this.acteur = false;
    if (g.mapObj.id === 'monde' && !this.acteur) this.montrer(R);
    if (g.mapObj.id !== 'monde' && this.acteur) this.retirer();
  }
  /** l'aura qui ondule autour du boss sur la carte */
  animer(dt) {
    const A = this.anim; if (!A || !this.acteur) return;
    A.t += dt; const f = Math.floor(A.t / 0.14) % A.images.length;
    if (f === A.f) return;
    A.f = f;
    const map = this.game.view?.actors?.get('raidmonde')?.mesh?.material?.map;
    if (map) { map.image = A.images[f]; map.needsUpdate = true; }
  }
  montrer(R) {
    this.acteur = true; this.chargement = true;
    const g = this.game, carte = g.mapObj;
    loadImg(ASSETS.front(R.boss.sp)).then((img) => {
      this.chargement = false;
      if (!img || g.mapObj !== carte || this.courant?.k !== R.k || !this.acteur) { this.acteur = false; return; }
      // chaque image : l'aura, puis le boss par-dessus (le bas de l'aura passe sous ses pieds, coupé)
      const { frames, pad } = auraFrames(img, rangDe(R.boss).aura, 2);
      const images = frames.map((fr) => {
        const c = document.createElement('canvas'); c.width = fr.width; c.height = img.height + pad;
        const x = c.getContext('2d'); x.drawImage(fr, 0, 0); x.drawImage(img, pad, pad);
        return c;
      });
      this.anim = { images, t: 0, f: 0 };
      const a = g.view.imageActor('raidmonde', images[0], 0.62); g.view.place(a, R.x, R.y - 0.1);
    }, () => { this.chargement = false; this.acteur = false; });
  }
  retirer() { if (this.acteur) this.game.view?.removeActor('raidmonde'); this.acteur = false; this.anim = null; }
  /** la case est-elle prise par le boss ? */
  occupe(x, y) { const R = this.courant; return !!(R && this.acteur && this.game.mapObj?.id === 'monde' && R.x === x && R.y === y); }
  /** le gros « boom » et le bandeau en haut de l'écran, aux couleurs de l'aura */
  annoncer(R) {
    const g = this.game, reste = Math.max(1, Math.round((R.fin - Date.now()) / 60e3));
    const rang = rangDe(R.boss), [clair, fonce] = AURA_TEINTE[rang.aura];
    g.sound?.sfx('boom'); setTimeout(() => g.sound?.cry(ASSETS.cry(R.boss.sp)), 700);
    const b = document.createElement('div');
    b.className = 'raid-monde-annonce';
    b.innerHTML = `<div class="rma-titre">💥 Un boss de raid est apparu !</div><div class="rma-texte">${R.boss.title} · ${R.nom}</div><div class="rma-pied">${rang.nom} · encore ${reste} min · coop de 2 à 4 joueurs</div>`;
    Object.assign(b.style, { position: 'fixed', left: '50%', top: '9%', transform: 'translateX(-50%) scale(0.6)', opacity: '0', zIndex: 60, pointerEvents: 'none',
      padding: '14px 26px', borderRadius: '14px', textAlign: 'center', color: '#fff', font: '700 15px/1.35 system-ui, sans-serif',
      background: 'linear-gradient(180deg, rgba(150,20,30,0.95), rgba(70,8,20,0.95))', border: `3px solid ${clair}`, boxShadow: `0 0 28px ${fonce}, 0 0 8px ${clair}`,
      transition: 'transform 0.35s cubic-bezier(.2,1.6,.4,1), opacity 0.35s' });
    b.querySelector('.rma-titre').style.font = '900 22px/1.2 system-ui, sans-serif';
    b.querySelector('.rma-pied').style.color = clair;
    document.body.appendChild(b);
    requestAnimationFrame(() => { b.style.opacity = '1'; b.style.transform = 'translateX(-50%) scale(1)'; });
    if (g.view) g.view.shake = 0.5;
    setTimeout(() => { b.style.opacity = '0'; setTimeout(() => b.remove(), 600); }, 7000);
  }
  /** le joueur parle au boss (la case devant lui) : lance le raid si tout le monde est là */
  async interagir() {
    const g = this.game, p = g.player, R = this.courant;
    if (!R || !this.acteur || g.mapObj?.id !== 'monde' || !p) return false;
    const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[p.dir] || [0, 0];
    if (p.x + D[0] !== R.x || p.y + D[1] !== R.y) return false;
    const m = await import('./multi-events.js');
    g.busy = true;
    try { await m.lancerRaidMonde(g, R); } finally { g.busy = false; }
    return true;
  }
}
