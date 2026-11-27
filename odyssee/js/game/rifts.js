// odyssee/js/game/rifts.js — Failles spatio-temporelles 3D & Combats anormaux (Inversé, Chaotique, Alpha)
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { createMon, refreshStats } from '../core/mon.js';
import { DIRS } from '../world/tiles.js';
import { caseAccessible } from './places.js';


export const RIFT_KINDS = {
  inverse: {
    id: 'inverse',
    label: 'Faille Inversée',
    badge: '⚡ TYPES INVERSÉS',
    desc: 'Les affinités de types s\'inversent complètement ! Les immunités et résistances deviennent super efficaces.',
    core: '#38e8ff',
    rim: '#a848ff',
  },
  chaos: {
    id: 'chaos',
    label: 'Faille Chaotique',
    badge: '🌀 MÉTÉO CHAOTIQUE',
    desc: 'Le climat bascule brutalement entre Pluie, Zénith, Tempête de Sable et Grêle à chaque fin de tour !',
    core: '#ffd248',
    rim: '#58b8ff',
  },
  alpha: {
    id: 'alpha',
    label: 'Faille Alpha',
    badge: '🔥 ALPHA GÉANT',
    desc: 'Un Pokémon Alpha géant enveloppé d\'une aura cramoisie en jaillit, doté de PV accrus et d\'une attaque signature !',
    core: '#ff4858',
    rim: '#ff9830',
  },
};

// Espèces et attaques signatures vérifiées (SPECIES & MOVES)
export const ALPHA_POOL = [
  { sp: 59, sigMoveId: 394 },   // Arcanin — Boutefeu
  { sp: 94, sigMoveId: 247 },   // Ectoplasma — Ball'Ombre
  { sp: 130, sigMoveId: 200 },  // Léviator — Colère
  { sp: 143, sigMoveId: 89 },   // Ronflex — Séisme
  { sp: 149, sigMoveId: 542 },  // Dracolosse — Vent Violent
  { sp: 212, sigMoveId: 442 },  // Cizayox — Tête de Fer
  { sp: 248, sigMoveId: 399 },  // Tyranocif — Vibrobscur
  { sp: 282, sigMoveId: 585 },  // Gardevoir — Pouvoir Lunaire
  { sp: 350, sigMoveId: 56 },   // Milobellus — Hydrocanon
  { sp: 376, sigMoveId: 309 },  // Métalosse — Poing Météor
  { sp: 445, sigMoveId: 406 },  // Carchacrok — Draco-Choc
  { sp: 448, sigMoveId: 396 },  // Lucario — Aurasphère
  { sp: 609, sigMoveId: 126 },  // Lugulabre — Déflagration
  { sp: 625, sigMoveId: 442 },  // Scalproie — Tête de Fer
  { sp: 635, sigMoveId: 399 },  // Trioxhydre — Vibrobscur
  { sp: 637, sigMoveId: 126 },  // Pyrax — Déflagration
];

// l'évolution d'avant, pour chaque espèce (une faille ouverte tôt ne doit pas donner un Dracolosse au niveau 10)
let AVANT = null;
/** la forme qu'aurait cette espèce à ce niveau : une évolution par niveau est ramenée à la forme précédente tant que le
 *  niveau n'y est pas ; par une pierre ou un échange, avant le niveau 30 */
export function formeAdaptee(sp, lvl) {
  if (!AVANT) {
    AVANT = new Map();
    for (const k of Object.keys(SPECIES)) for (const e of SPECIES[k].ev || []) if (!AVANT.has(e.to)) AVANT.set(e.to, { de: +k, lvl: e.lvl || 30 });
  }
  let s = sp;
  for (let i = 0; i < 3; i++) { const a = AVANT.get(s); if (!a || lvl >= a.lvl || !SPECIES[a.de]) break; s = a.de; }
  return s;
}

export function createAlphaMon(entry, lvl, met = 'Faille Alpha') {
  const sp = entry?.sp || 130;
  const sigId = entry?.sigMoveId;
  const mon = createMon(formeAdaptee(sp, lvl), lvl, { met });
  // 3 IV garantis à 31
  const pool = [0, 1, 2, 3, 4, 5];
  for (let i = 0; i < 3; i++) {
    const idx = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    mon.iv[idx] = 31;
  }
  if (lvl >= 25 && sigId && MOVES[sigId] && !mon.moves.some((mv) => mv.id === sigId)) {
    const moveObj = { id: sigId, pp: MOVES[sigId].pp };
    if (mon.moves.length < 4) mon.moves.push(moveObj);
    else mon.moves[0] = moveObj;
  }
  refreshStats(mon, false);
  mon.alpha = true;
  mon._alphaBoosted = true;
  mon.stats[0] = Math.round(mon.stats[0] * 1.25);
  mon.hp = mon.stats[0];
  return mon;
}

/** Normalise les PV boss d'un Alpha une fois capturé, tout en gardant son statut Alpha. */
export function normalizeCapturedAlpha(mon) {
  if (!mon) return mon;
  if (mon._alphaBoosted) {
    delete mon._alphaBoosted;
    refreshStats(mon, false);
    mon.hp = Math.min(mon.hp, mon.stats[0]);
  }
  return mon;
}

const entre = (a, b) => a + Math.random() * (b - a);
/** secondes passées dehors : avant la toute première faille, entre deux, et le temps qu'elle reste ouverte */
export const FAILLES = { premiere: [150, 360], attente: [600, 1800], ouverte: [600, 900] };

export class RiftSystem {
  constructor(game) {
    this.game = game;
    this.active = null; // { kind, kindLabel, x, y, zoneName, manual, ouv }
    this.exp = null;     // l'expédition en cours (game/faille.js)
    this._cherche = 0;   // secondes avant de chercher à nouveau une place
  }

  /** la prochaine faille, au hasard : le compte à rebours (secondes passées dehors) est dans la sauvegarde */
  programmer() { const f = this.game.state?.flags; if (f) f.faille = { dans: entre(...FAILLES.attente) }; }
  /** un genre au hasard, plus souvent un de ceux que le joueur n'a pas encore vaincus */
  tirerGenre() {
    const f = this.game.state?.flags || {}, L = Object.keys(RIFT_KINDS).flatMap((k) => (f['riftKind:' + k] ? [k] : [k, k, k]));
    return L[Math.floor(Math.random() * L.length)];
  }

  clearActor() {
    const v = this.game.view;
    if (v?.actors?.has('rift:portal')) v.removeActor('rift:portal');
  }

  clear() {
    this.clearActor();
    this.active = null;
    this.game.hud?.update?.(true);
  }

  findSpawnTile(minDist, maxDist) {
    return caseAccessible(this.game, minDist, maxDist);
  }

  spawnNearPlayer(forcedKind = null, manual = true) {
    const g = this.game;
    if (g.mapObj?.id !== 'monde') return null;
    const pos = (manual ? this.findSpawnTile(3, 6) : this.findSpawnTile(6, 15)) || this.findSpawnTile(2, 12);
    if (!pos) return null;
    const keys = Object.keys(RIFT_KINDS);
    const kind = forcedKind && RIFT_KINDS[forcedKind] ? forcedKind : keys[Math.floor(Math.random() * keys.length)];
    const z = g.mapObj.zoneAt ? g.mapObj.zoneAt(pos.x, pos.y) : null;
    this.clearActor();
    this.active = {
      kind,
      kindLabel: RIFT_KINDS[kind].label,
      x: pos.x,
      y: pos.y,
      zoneName: z?.name || g.locationName?.() || 'Odyssée',
      manual,
    };
    g.hud?.update?.(true);
    return this.active;
  }

  distToPlayer() {
    const p = this.game.player;
    if (!this.active || !p || this.game.mapObj?.id !== 'monde') return Infinity;
    return Math.abs(this.active.x - p.x) + Math.abs(this.active.y - p.y);
  }

  compassFromPlayer() {
    if (!this.active || !this.game.player) return '';
    const dx = this.active.x - this.game.player.x;
    const dy = this.active.y - this.game.player.y;
    const dist = Math.abs(dx) + Math.abs(dy);
    const ns = Math.abs(dy) >= 2 ? (dy < 0 ? 'nord' : 'sud') : '';
    const eo = Math.abs(dx) >= 2 ? (dx > 0 ? 'est' : 'ouest') : '';
    const dir = ns && eo ? `au ${ns}-${eo}` : ns ? `au ${ns}` : eo === 'ouest' ? "à l'ouest" : eo === 'est' ? "à l'est" : 'tout près';
    return `${dir} (${dist} pas, ${this.active.zoneName})`;
  }

  tick(dt) {
    const g = this.game, v = g.view, st = g.state;
    if (this.exp) this.exp.tick(dt);
    if (g.mapObj?.id !== 'monde' || !st) {
      this.clearActor();
      return;
    }
    if (st.flags?.dex && (st.party?.length || 0) > 0 && (g.badgeCount?.() || 0) >= 2) {
      const F = (st.flags.faille ||= { dans: entre(...FAILLES.premiere) });
      this._cherche -= dt;
      if (this.active) {
        // elle se referme d'elle-même, jamais sous le nez du joueur
        if (!this.active.manual) { F.reste = (F.reste || 0) - dt; if (F.reste <= 0 && this.distToPlayer() > 6) { this.clear(); this.programmer(); } }
      } else {
        if (!F.kind) F.dans -= dt;
        if ((F.kind || F.dans <= 0) && this._cherche <= 0 && !g.busy && !g.bv?.alive && !g.player?.surf) {
          this._cherche = 2;   // sans place libre autour, on réessaie un peu plus loin
          const kind = F.kind || this.tirerGenre(), a = this.spawnNearPlayer(kind, false);
          if (a) {
            if (!F.kind) st.flags.faille = { kind, reste: entre(...FAILLES.ouverte) };   // gardée si l'on quitte le jeu
            g.ui?.toast?.(`🌀 Une faille s'est ouverte ${this.compassFromPlayer()} !`, 3200); g.sound?.sfx?.('rift_open');
          }
        }
      }
    }
    if (!this.active || !v?.actors || typeof document === 'undefined') return;
    const r = this.active;
    r.ouv = Math.min(1, (r.ouv || 0) + dt * 1.8);   // elle s'ouvre d'un coup de lame
    v.portailActor('rift:portal', { kind: r.kind, core: RIFT_KINDS[r.kind].core, rim: RIFT_KINDS[r.kind].rim }).maj(dt, r.x, r.y, r.ouv);
  }

  async interagir() {
    const g = this.game, p = g.player, m = g.mapObj;
    if (this.exp?.m) return this.exp.interagir();
    if (!this.active || !p || m?.id !== 'monde') return false;
    const [dx, dy] = DIRS[p.dir] || [0, 1];
    const fx = p.x + dx, fy = p.y + dy;
    const r = this.active;
    const hit = (r.x === fx && r.y === fy) || (r.x === p.x && r.y === p.y);
    if (!hit) return false;

    const info = RIFT_KINDS[r.kind] || RIFT_KINDS.inverse;
    const ui = g.ui;
    g.busy = true;
    try {
      const { Expedition } = await import('./faille.js');
      const exp = new Expedition(g, r);
      await ui.say([
        `${info.label} détectée !`,
        info.desc,
        `Une présence de niveau ${exp.niveau(1)} se devine de l'autre côté... Trois îles s'y suivent, et un gardien veille sur la dernière.`,
        'Là-bas, ni fuite ni objets de soin. Une île gagnée, tu pourras rentrer avec ton butin ou t\'enfoncer plus loin.',
      ]);
      if (!(await ui.yesNo('Entrer dans cette faille spatio-temporelle ?'))) return true;
      this.exp = exp;
      await exp.commencer();
    } finally {
      g.busy = false;
    }
    return true;
  }
}
