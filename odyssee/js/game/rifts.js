// odyssee/js/game/rifts.js — Failles spatio-temporelles 3D & Combats anormaux (Inversé, Chaotique, Alpha)
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { abilitiesOf } from '../data/abilities.js';
import { formatFindItem } from '../core/items.js';
import { createMon, refreshStats, monName } from '../core/mon.js';
import { walkable, isGrassEnc, DIRS, T } from '../world/tiles.js';
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

export function createAlphaMon(entry, lvl, met = 'Faille Alpha') {
  const sp = entry?.sp || 130;
  const sigId = entry?.sigMoveId;
  const mon = createMon(sp, lvl, { met });
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

const BLOCKED_RIFT_TILES = new Set([
  T.DOOR, T.MAT, T.CAVEDOOR, T.WATER, T.LEDGE, T.LEDGE_E, T.LEDGE_W, T.CUT, T.SMASH, T.BOULDER,
]);

function drawRiftCanvas(canvas, kind, frame) {
  const info = RIFT_KINDS[kind] || RIFT_KINDS.inverse;
  const x = canvas.getContext('2d');
  x.clearRect(0, 0, 32, 32);
  // Aura extérieure pulsante
  const rOut = frame % 2 === 0 ? 13 : 14;
  x.fillStyle = info.rim;
  x.globalAlpha = 0.35;
  x.fillRect(16 - rOut, 4, rOut * 2, 24);
  x.fillRect(16 - (rOut - 3), 2, (rOut - 3) * 2, 28);
  // Anneau principal
  x.globalAlpha = 0.85;
  x.fillStyle = info.rim;
  x.fillRect(8, 5, 16, 22);
  x.fillRect(6, 8, 20, 16);
  // Cœur sombre de faille
  x.globalAlpha = 1;
  x.fillStyle = '#090612';
  x.fillRect(10, 8, 12, 16);
  x.fillRect(9, 10, 14, 12);
  // Spirales tournantes en pixel-art
  x.fillStyle = info.core;
  const rot = frame % 4;
  const pts = [
    [14 + (rot % 2 ? 2 : -1), 10 + (rot >= 2 ? 2 : 0), 4, 2],
    [13 + (rot === 1 ? -2 : 2), 20 - (rot >= 2 ? 2 : 0), 5, 2],
    [10 + (rot % 2), 14 + (rot < 2 ? 1 : -2), 2, 4],
    [20 - (rot % 2), 13 + (rot >= 2 ? 1 : -1), 2, 4],
  ];
  for (const [px, py, pw, ph] of pts) x.fillRect(px, py, pw, ph);
  // Noyau brillant
  x.fillStyle = '#ffffff';
  x.fillRect(15, 15, 2, 2);
}

export class RiftSystem {
  constructor(game) {
    this.game = game;
    this.active = null; // { kind, kindLabel, x, y, slot, zoneName, manual, canvas, frame }
    this._animT = 0;
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

  findSpawnTile(minDist, maxDist) {
    const g = this.game, m = g.mapObj, p = g.player;
    if (!m || m.id !== 'monde' || !p) return null;
    const ph = m.height ? m.height(p.x, p.y) : 0;
    const cands = [];
    for (let dx = -maxDist; dx <= maxDist; dx++) {
      for (let dy = -maxDist; dy <= maxDist; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < minDist || d > maxDist) continue;
        const x = p.x + dx, y = p.y + dy;
        if (!m.in(x, y)) continue;
        const tile = m.get(x, y);
        if (!walkable(tile) || BLOCKED_RIFT_TILES.has(tile) || isGrassEnc(tile)) continue;
        if (m.height && Math.abs(m.height(x, y) - ph) > 1) continue;
        if (g.fol && g.fol.x === x && g.fol.y === y) continue;
        if ((g.npcs || []).some((n) => n.x === x && n.y === y)) continue;
        if ((g.items || []).some((it) => it.x === x && it.y === y)) continue;
        cands.push({ x, y });
      }
    }
    if (!cands.length) return null;
    return cands[Math.floor(Math.random() * cands.length)];
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
    if (!this.active && st.flags?.lastRiftSlot !== slot && (st.party?.length || 0) > 0) {
      // Apparition périodique naturelle d'une faille (sans bloquer si terrain serré)
      if ((slot % 2) === 0 || (st.flags?.starter && !st.flags?.riftsCleared)) {
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
    const a = v.imageActor('rift:portal', this.active.canvas, 1.35);
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
    try {
      await ui.say([
        `${info.label} détectée !`,
        info.desc,
      ]);
      if (!(await ui.yesNo('Entrer dans cette faille spatio-temporelle ?'))) return true;

      const lvls = (st.party || []).filter((q) => q.hp > 0).map((q) => q.lvl);
      const avg = lvls.length ? Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) : 12;
      const cap = g.levelCap ? g.levelCap() : 100;
      const lvl = Math.max(10, Math.min(cap, avg + 2));

      let wild = null;
      let battleOpts = { music: 'wild', rift: true };

      if (r.kind === 'alpha') {
        const entry = ALPHA_POOL[Math.floor(Math.random() * ALPHA_POOL.length)];
        wild = createAlphaMon(entry, lvl, `${r.zoneName} (Faille)`);
        if (Math.random() < 1 / 512) wild.shiny = true;
        battleOpts = { wild, alpha: true, aura: 'rouge', music: 'alphaBoss', rift: true };
        g.sound?.sfx('alpha_roar');
        await ui.say(`Un rugissement fend la faille ! Un ${monName(wild)} Alpha géant bondit sur toi !`);
      } else {
        const pool = [...ALPHA_POOL.map((e) => e.sp), ...CELESTIAL_SPECIES].filter((id) => SPECIES[id]);
        const sp = pool[Math.floor(Math.random() * pool.length)];
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
        g.sound?.sfx('rift_open');
        await ui.say(`L'espace se tord : un ${monName(wild)} émerge de la faille !`);
      }

      g.busy = false;
      const res = await g.runBattle(battleOpts);
      if (res === 'win' || res === 'caught') {
        st.flags ||= {};
        if (!r.manual) st.flags.lastRiftSlot = r.slot;
        st.flags.riftsCleared = (st.flags.riftsCleared || 0) + 1;
        st.flags['riftKind:' + r.kind] = (st.flags['riftKind:' + r.kind] || 0) + 1;
        if (r.kind === 'alpha' && res === 'caught') st.flags.alphaCaught = (st.flags.alphaCaught || 0) + 1;
        const loot = r.kind === 'alpha' ? 'rare-candy' : 'fragment-meteore';
        g.give(loot, 1);
        st.money = (st.money || 0) + 1500;
        this.clear();
        try { g.checkTrophies?.(true); } catch (e) { warnDev('rift-trophy', e); }
        g.save?.(true);
        g.sound?.sfx('rift_seal');
        await ui.say([
          'La faille spatio-temporelle se referme dans un éclat prismatique !',
          formatFindItem(st.name, loot, 1),
          'Tu récupères aussi 1 500 ₽ au cœur de la distorsion !',
        ]);
      }
    } finally {
      g.busy = false;
    }
    return true;
  }
}
