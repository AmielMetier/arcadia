// odyssee/js/game/rifts.js — Failles spatio-temporelles 3D & Combats anormaux (Inversé, Chaotique, Alpha)
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { abilitiesOf } from '../data/abilities.js';
import { formatFindItem } from '../core/items.js';
import { createMon, refreshStats, monName } from '../core/mon.js';
import { DIRS } from '../world/tiles.js';
import { caseAccessible } from './places.js';
import { CELESTIAL_SPECIES } from './celestial.js';
import { warnDev } from '../core/safe.js';

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
  if (sigId && MOVES[sigId] && !mon.moves.some((mv) => mv.id === sigId)) {
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

function drawRiftCanvas(canvas, kind, frame) {
  const info = RIFT_KINDS[kind] || RIFT_KINDS.inverse;
  const x = canvas.getContext('2d');
  x.clearRect(0, 0, 32, 32);
  // ovale en pixels pleins (le rendu ne garde que les pixels opaques), au bord qui ondule
  const ovale = (rx, ry, c, biais = 0) => {
    x.fillStyle = c;
    for (let y = -ry; y <= ry; y++) {
      const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))));
      if (w > 0) x.fillRect(16 - w + Math.round(Math.sin((y + biais) * 0.7) * 0.8), 16 + y, w * 2, 1);
    }
  };
  ovale(9 + (frame % 2), 15, '#120a24', frame);
  ovale(8 + (frame % 2), 14, info.rim, frame);
  ovale(7, 12, info.core, frame + 2);
  ovale(6, 11, '#2a1648', frame + 2);
  ovale(5, 9, '#0a0614', frame + 3);
  // deux bras de lumière qui tournent dans le vide
  for (let i = 0; i < 14; i++) {
    for (const s of [0, Math.PI]) {
      const a = i * 0.42 + s - frame * (Math.PI / 4), r = 0.6 + i * 0.3;
      x.fillStyle = i < 4 ? '#ffffff' : i < 9 ? info.core : info.rim;
      x.fillRect(Math.round(16 + Math.cos(a) * r), Math.round(16 + Math.sin(a) * r * 1.7), 1, 1);
    }
  }
  // éclats d'espace arrachés autour
  x.fillStyle = info.core;
  for (const [px, py] of [[5, 8], [26, 11], [4, 21], [27, 24]]) x.fillRect(px + ((frame + py) % 2), py - (frame % 4 === px % 4 ? 2 : 0), 2, 2);
}

export class RiftSystem {
  constructor(game) {
    this.game = game;
    this.active = null; // { kind, kindLabel, x, y, slot, zoneName, manual, canvas, frame }
    this._animT = 0;
    this._cherche = 0;   // secondes avant de chercher à nouveau une place
  }

  currentSlot() {
    return Math.floor(Date.now() / (15 * 60_000));
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

  /** l'Astrolabe referme la faille : celle du créneau en cours ne se rouvre pas aussitôt */
  dissiper() {
    const st = this.game.state;
    if (this.active && st) (st.flags ||= {}).lastRiftSlot = this.currentSlot();
    // ouverte avec un fragment et pas encore franchie : il est rendu
    const rendu = !!st?.flags?.failleAstro;
    if (rendu) { delete st.flags.failleAstro; this.game.give('fragment-meteore', 1); this.game.save?.(true); }
    this.clear();
    return rendu;
  }

  findSpawnTile(minDist, maxDist) {
    return caseAccessible(this.game, minDist, maxDist);
  }

  spawnNearPlayer(forcedKind = null, manual = true) {
    const g = this.game;
    if (g.mapObj?.id !== 'monde') return null;
    const pos = this.findSpawnTile(3, 6) || this.findSpawnTile(2, 12);
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
      slot: this.currentSlot(),
      zoneName: z?.name || g.locationName?.() || 'Odyssée',
      manual,
      canvas: null,
      frame: -1,
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
    if (g.mapObj?.id !== 'monde' || !st) {
      this.clearActor();
      return;
    }
    const slot = this.currentSlot();
    if (this.active && !this.active.manual && this.active.slot !== slot) {
      this.clear();
    }
    this._cherche -= dt;
    if (!this.active && this._cherche <= 0 && st.flags?.failleAstro) { this._cherche = 2; this.spawnNearPlayer(st.flags.failleAstro, true); }   // faille payée, partie rechargée
    if (!this.active && this._cherche <= 0 && st.flags?.dex && st.flags.lastRiftSlot !== slot && (st.party?.length || 0) > 0) {
      this._cherche = 2;
      // Apparition périodique naturelle d'une faille (sans bloquer si terrain serré)
      if ((slot % 2) === 0 || !st.flags.riftsCleared) {
        const pos = this.findSpawnTile(6, 15);
        if (pos) {
          const keys = Object.keys(RIFT_KINDS);
          const kind = keys[slot % keys.length];
          const z = g.mapObj.zoneAt ? g.mapObj.zoneAt(pos.x, pos.y) : null;
          this.active = {
            kind,
            kindLabel: RIFT_KINDS[kind].label,
            x: pos.x,
            y: pos.y,
            slot,
            zoneName: z?.name || g.locationName?.() || 'Odyssée',
            manual: false,
            canvas: null,
            frame: -1,
          };
          g.hud?.update?.(true);
          if (!g.busy && !g.bv?.alive) { g.ui?.toast?.(`🌀 Une faille s'est ouverte ${this.compassFromPlayer()} !`, 3200); g.sound?.sfx?.('amb_rift_hum'); }
        }
      }
    }
    if (!this.active || !v?.actors || typeof document === 'undefined') return;
    this._animT += dt;
    const frame = Math.floor(this._animT * 7) % 4;
    if (!this.active.canvas) {
      this.active.canvas = document.createElement('canvas');
      this.active.canvas.width = 32;
      this.active.canvas.height = 32;
      drawRiftCanvas(this.active.canvas, this.active.kind, frame);
      this.active.frame = frame;
    }
    const a = v.imageActor('rift:portal', this.active.canvas, 1.35, { lumineux: true });
    if (this.active.frame !== frame) {
      drawRiftCanvas(this.active.canvas, this.active.kind, frame);
      this.active.frame = frame;
      if (a.mesh?.material?.map) a.mesh.material.map.needsUpdate = true;
    }
    const bob = 0.14 + 0.06 * Math.sin(this._animT * 4);
    v.place(a, this.active.x, this.active.y, bob, false);
  }

  async interagir() {
    const g = this.game, p = g.player, m = g.mapObj;
    if (!this.active || !p || m?.id !== 'monde') return false;
    const [dx, dy] = DIRS[p.dir] || [0, 1];
    const fx = p.x + dx, fy = p.y + dy;
    const r = this.active;
    const hit = (r.x === fx && r.y === fy) || (r.x === p.x && r.y === p.y);
    if (!hit) return false;

    const info = RIFT_KINDS[r.kind] || RIFT_KINDS.inverse;
    const ui = g.ui, st = g.state;
    g.busy = true;
    let scene = null;
    try {
      const lvls = (st.party || []).filter((q) => q.hp > 0).map((q) => q.lvl);
      const avg = lvls.length ? Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) : 12;
      const cap = g.levelCap ? g.levelCap() : 100;
      const lvl = Math.max(10, Math.min(cap, avg + 2));

      await ui.say([
        `${info.label} détectée !`,
        info.desc,
        `Une présence de niveau ${lvl} se devine de l'autre côté...`,
      ]);
      if (!(await ui.yesNo('Entrer dans cette faille spatio-temporelle ?'))) return true;

      let wild = null;
      let battleOpts = { music: 'wild', rift: true };

      if (r.kind === 'alpha') {
        const entry = ALPHA_POOL[Math.floor(Math.random() * ALPHA_POOL.length)];
        wild = createAlphaMon(entry, lvl, `${r.zoneName} (Faille)`);
        if (Math.random() < 1 / 512) wild.shiny = true;
        battleOpts = { wild, alpha: true, aura: 'rouge', music: 'alphaBoss', rift: true };
        scene = await this.entrer(r, info, wild);
        if (!scene) g.sound?.sfx('alpha_roar');
        await ui.say(`Un rugissement fend la faille ! Un ${monName(wild)} Alpha géant bondit sur toi !`);
      } else {
        const pool = [...ALPHA_POOL.map((e) => e.sp), ...CELESTIAL_SPECIES].filter((id) => SPECIES[id]);
        const sp = formeAdaptee(pool[Math.floor(Math.random() * pool.length)], lvl);
        wild = createMon(sp, lvl, { met: `${r.zoneName} (Faille)` });
        const poolIdx = [0, 1, 2, 3, 4, 5];
        for (let k = 0; k < 2; k++) {
          const pickIdx = poolIdx.splice(Math.floor(Math.random() * poolIdx.length), 1)[0];
          wild.iv[pickIdx] = 31;
        }
        const [, , ha] = abilitiesOf(sp);
        if (ha && Math.random() < 0.35) wild.ability = ha;
        if (Math.random() < 1 / 512) wild.shiny = true;
        refreshStats(wild, false);
        wild.hp = wild.stats[0];
        if (r.kind === 'inverse') {
          battleOpts = { wild, inverse: true, music: 'riftBattle', rift: true };
        } else {
          battleOpts = { wild, chaosWeather: true, weather: 'rain', music: 'riftBattle', rift: true };
        }
        scene = await this.entrer(r, info, wild);
        if (!scene) g.sound?.sfx('rift_open');
        await ui.say(`L'espace se tord : un ${monName(wild)} émerge de la faille !`);
      }

      battleOpts.apresRideau = () => scene?.fin();   // l'intérieur de la faille reste en fond jusqu'au rideau du combat
      const res = await g.runBattle(battleOpts);
      if (res === 'win' || res === 'caught') {
        st.flags ||= {};
        st.flags.lastRiftSlot = this.currentSlot();   // une autre ne s'ouvre pas à côté dans la foulée
        st.flags.riftsCleared = (st.flags.riftsCleared || 0) + 1;
        st.flags['riftKind:' + r.kind] = (st.flags['riftKind:' + r.kind] || 0) + 1;
        if (r.kind === 'alpha' && res === 'caught') st.flags.alphaCaught = (st.flags.alphaCaught || 0) + 1;
        // une faille ouverte avec un fragment ne le rembourse pas
        const [loot, combien] = r.kind === 'alpha' ? ['rare-candy', 1] : r.manual ? ['ultra-ball', 2] : ['fragment-meteore', 1];
        if (r.manual) delete st.flags.failleAstro;
        g.give(loot, combien);
        st.money = (st.money || 0) + 1500;
        this.clear();
        try { g.checkTrophies?.(true); } catch (e) { warnDev('rift-trophy', e); }
        g.save?.(true);
        g.sound?.sfx('rift_seal');
        await ui.say([
          'La faille spatio-temporelle se referme dans un éclat prismatique !',
          formatFindItem(st.name, loot, combien),
          'Tu récupères aussi 1 500 ₽ au cœur de la distorsion !',
        ]);
      }
    } finally {
      scene?.fin();
      g.busy = false;
    }
    return true;
  }

  /** l'animation d'entrée (ui/rift-entree.js) ; null si elle ne peut pas se jouer */
  async entrer(r, info, mon) {
    if (typeof document === 'undefined') return null;
    try {
      const { entrerFaille } = await import('../ui/rift-entree.js');
      return await entrerFaille(this.game, { kind: r.kind, info, x: r.x, y: r.y, mon });
    } catch (e) { warnDev('faille', e); return null; }
  }
}
