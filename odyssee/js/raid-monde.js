// odyssee/js/raid-monde.js — les boss de raid qui apparaissent dans la région.
//
// Toutes les 90 minutes (heure réelle), un boss de raid surgit sur une route tirée au sort et y reste 15 minutes.
// Tout se déduit de l'heure : chaque joueur du salon calcule le même créneau, la même route et le même boss sans rien
// s'échanger. On ne l'annonce (gros « boom » et bandeau) et on ne le montre que si au moins un autre joueur est connecté :
// le raid se joue à plusieurs (2 ou 3 joueurs, multi-events.js : lancerRaidMonde). Pour le lancer, tous les joueurs
// connectés doivent être près du boss (à deux, le duo ; à trois et plus, trois joueurs). 5 essais par joueur et par
// apparition ; un boss vaincu disparaît pour ceux qui l'ont battu.
import { SPECIES } from './data/species.js';
import { MOVES } from './data/moves.js';
import { along, caseLibre } from './world/mapgen.js';
import { RANG_ROUTES } from './world/bareme.js';
import { walkable } from './world/tiles.js';
import { ASSETS, loadImg } from './assets.js';

export const RAID_PERIODE = 90 * 60e3;   // une apparition toutes les heures et demie
export const RAID_DUREE = 15 * 60e3;     // le boss reste un quart d'heure
export const RAID_ESSAIS = 5;            // essais par joueur et par apparition
// niveau du boss : moyenne des niveaux max des joueurs, plus 10 niveaux (6 pour un légendaire, déjà bien plus fort)
export const RAID_BONUS_NIVEAU = 10, RAID_BONUS_LEGENDE = 6;
export const RAID_PV = { 2: 2, 3: 2.5 };   // PV du boss multipliés (duo, trio)
export const RAID_PORTEE = 8;            // distance (cases) à laquelle un joueur compte comme « là »

/** les boss de raid de la région (capacités par leur nom anglais, cherchées dans les données du jeu) */
export const BOSS_MONDE = [
  { id: 'ronflex', sp: 143, title: 'Ronflex Colosse', ability: 'thick-fat', moves: ['body-slam', 'crunch', 'earthquake', 'ice-punch'], bg: 'gym' },
  { id: 'leviator', sp: 130, title: 'Léviator Furie', ability: 'intimidate', moves: ['waterfall', 'crunch', 'earthquake', 'dragon-dance'], bg: 'water' },
  { id: 'ectoplasma', sp: 94, title: 'Ectoplasma Spectral', ability: null, moves: ['shadow-ball', 'sludge-bomb', 'thunderbolt', 'focus-blast'], bg: 'cave' },
  { id: 'scarhino', sp: 214, title: 'Scarhino Titan', ability: 'guts', moves: ['megahorn', 'close-combat', 'stone-edge', 'earthquake'], bg: 'gym' },
  { id: 'lucario', sp: 448, title: 'Lucario Aura', ability: null, moves: ['aura-sphere', 'flash-cannon', 'dragon-pulse', 'extreme-speed'], bg: 'gym' },
  { id: 'tyranocif', sp: 248, title: 'Tyranocif Alpha', ability: 'sand-stream', moves: ['stone-edge', 'crunch', 'earthquake', 'dragon-dance'], bg: 'cave' },
  { id: 'metalosse', sp: 376, title: 'Métalosse Titan', ability: 'clear-body', moves: ['meteor-mash', 'zen-headbutt', 'earthquake', 'ice-punch'], bg: 'gym' },
  { id: 'dracolosse', sp: 149, title: 'Dracolosse Ancien', ability: 'multiscale', moves: ['outrage', 'extreme-speed', 'fire-punch', 'dragon-dance'], bg: 'volcanic' },
  { id: 'carchacrok', sp: 445, title: 'Carchacrok Tempête', ability: 'rough-skin', moves: ['outrage', 'earthquake', 'stone-edge', 'swords-dance'], bg: 'cave' },
  { id: 'lugia', sp: 249, title: 'Lugia des Abysses', ability: 'pressure', moves: ['aeroblast', 'psychic', 'ice-beam', 'calm-mind'], bg: 'water', legend: true },
  { id: 'hooh', sp: 250, title: 'Ho-Oh Flamboyant', ability: 'pressure', moves: ['sacred-fire', 'brave-bird', 'earthquake', 'recover'], bg: 'volcanic', legend: true },
  { id: 'mewtwo', sp: 150, title: 'Mewtwo Originel', ability: 'pressure', moves: ['psychic', 'aura-sphere', 'ice-beam', 'calm-mind'], bg: 'league', legend: true },
  { id: 'groudon', sp: 383, title: 'Groudon Primordial', ability: 'drought', moves: ['earthquake', 'fire-punch', 'stone-edge', 'bulk-up'], bg: 'volcanic', legend: true },
  { id: 'kyogre', sp: 382, title: 'Kyogre Primordial', ability: 'drizzle', moves: ['hydro-pump', 'ice-beam', 'thunder', 'calm-mind'], bg: 'water', legend: true },
  { id: 'rayquaza', sp: 384, title: 'Rayquaza Céleste', ability: 'air-lock', moves: ['outrage', 'extreme-speed', 'earthquake', 'dragon-dance'], bg: 'league', legend: true },
  { id: 'giratina', sp: 487, title: 'Giratina Distorsion', ability: 'pressure', moves: ['shadow-force', 'dragon-claw', 'earth-power', 'aura-sphere'], bg: 'cave', legend: true },
].filter((b) => SPECIES[b.sp]);

const PAR_CLE = new Map(Object.values(MOVES).map((m) => [m.key, m.id]));
/** numéros des capacités d'un boss (celles que le jeu connaît) */
export function capacitesBoss(def) {
  const L = def.moves.map((k) => PAR_CLE.get(k)).filter((id) => id && MOVES[id]);
  return L.length ? L : [PAR_CLE.get('tackle') || 33];
}

const hash = (n) => { let h = (n ^ 0x9e3779b9) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0; h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** le créneau d'une heure donnée : son numéro, son début et sa fin, et s'il est en cours */
export function creneau(now = Date.now()) {
  const k = Math.floor(now / RAID_PERIODE);
  const debut = k * RAID_PERIODE + Math.floor(hash(k * 3 + 1) * (RAID_PERIODE - RAID_DUREE));
  return { k, debut, fin: debut + RAID_DUREE, actif: now >= debut && now < debut + RAID_DUREE };
}
/** le boss d'un créneau (le même chez tous les joueurs) */
export const bossDuCreneau = (k) => BOSS_MONDE[Math.floor(hash(k * 7 + 5) * BOSS_MONDE.length)];
export const bossParId = (id) => BOSS_MONDE.find((b) => b.id === id) || null;
/** niveau du boss : moyenne des niveaux max des participants, plus le bonus */
export const niveauBoss = (caps, def) => Math.max(10, Math.min(100, Math.round(caps.reduce((a, c) => a + c, 0) / Math.max(1, caps.length)) + (def?.legend ? RAID_BONUS_LEGENDE : RAID_BONUS_NIVEAU)));

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

export class RaidMonde {
  constructor(game) {
    this.game = game;
    this.places = null;     // emplacements (calculés une fois)
    this.courant = null;    // { k, boss, x, y, nom, fin } : le boss en ce moment
    this.annonce = -1;      // dernier créneau annoncé
    this.acteur = false;
    this.t = 0;
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
  montrer(R) {
    this.acteur = true; this.chargement = true;
    const g = this.game, carte = g.mapObj;
    loadImg(ASSETS.front(R.boss.sp)).then((img) => {
      this.chargement = false;
      if (!img || g.mapObj !== carte || this.courant?.k !== R.k || !this.acteur) { this.acteur = false; return; }
      const a = g.view.imageActor('raidmonde', img, 0.62); g.view.place(a, R.x, R.y - 0.1);
    }, () => { this.chargement = false; this.acteur = false; });
  }
  retirer() { if (this.acteur) this.game.view?.removeActor('raidmonde'); this.acteur = false; }
  /** la case est-elle prise par le boss ? */
  occupe(x, y) { const R = this.courant; return !!(R && this.acteur && this.game.mapObj?.id === 'monde' && R.x === x && R.y === y); }
  /** le gros « boom » et le bandeau en haut de l'écran */
  annoncer(R) {
    const g = this.game, reste = Math.max(1, Math.round((R.fin - Date.now()) / 60e3));
    g.sound?.sfx('boom'); setTimeout(() => g.sound?.cry(ASSETS.cry(R.boss.sp)), 700);
    const b = document.createElement('div');
    b.className = 'raid-monde-annonce';
    b.innerHTML = `<div class="rma-titre">💥 Un boss de raid est apparu !</div><div class="rma-texte">${R.boss.title} · ${R.nom}</div><div class="rma-pied">Il repart dans ${reste} min · à faire à plusieurs</div>`;
    Object.assign(b.style, { position: 'fixed', left: '50%', top: '9%', transform: 'translateX(-50%) scale(0.6)', opacity: '0', zIndex: 60, pointerEvents: 'none',
      padding: '14px 26px', borderRadius: '14px', textAlign: 'center', color: '#fff', font: '700 15px/1.35 system-ui, sans-serif',
      background: 'linear-gradient(180deg, rgba(150,20,30,0.95), rgba(70,8,20,0.95))', border: '3px solid #ffcf40', boxShadow: '0 0 28px rgba(255,90,40,0.75)',
      transition: 'transform 0.35s cubic-bezier(.2,1.6,.4,1), opacity 0.35s' });
    b.querySelector('.rma-titre').style.font = '900 22px/1.2 system-ui, sans-serif';
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
