// odyssee/js/game/celestial.js — Phénomènes célestes rares (Aurore & Météores 3D), chutes de météorites et Astrolabe
import { SPECIES } from '../data/species.js';
import { abilitiesOf } from '../data/abilities.js';
import { formatFindItem } from '../core/items.js';
import { createMon, refreshStats, monName } from '../core/mon.js';
import { walkable, isGrassEnc, DIRS, T } from '../world/tiles.js';
import { addMemory } from './follower-life.js';
import { warnDev } from '../core/safe.js';

// Espèces cosmiques associées aux chutes de météorites (vérifiées dans SPECIES)
export const CELESTIAL_SPECIES = [35, 120, 173, 337, 338, 374, 436, 517, 605];
export const JIRACHI_SP = 385;

const BLOCKED_METEOR_TILES = new Set([
  T.DOOR, T.MAT, T.CAVEDOOR, T.WATER, T.LEDGE, T.LEDGE_E, T.LEDGE_W, T.CUT, T.SMASH, T.BOULDER,
]);

function drawMeteorCanvas(canvas, frame) {
  const x = canvas.getContext('2d');
  x.clearRect(0, 0, 24, 24);
  const pulse = frame % 2 === 0;
  // Halo brillant
  x.fillStyle = pulse ? 'rgba(130, 235, 255, 0.34)' : 'rgba(255, 225, 120, 0.38)';
  x.fillRect(4, 5, 16, 14);
  x.fillRect(6, 3, 12, 18);
  // Base rocheuse étoilée
  x.fillStyle = '#241e38';
  x.fillRect(6, 10, 12, 9);
  x.fillRect(5, 12, 14, 6);
  x.fillStyle = '#483e6e';
  x.fillRect(7, 11, 10, 6);
  // Cristal lumineux
  x.fillStyle = pulse ? '#7af0ff' : '#ffd860';
  x.fillRect(9, 6, 6, 8);
  x.fillRect(10, 4, 4, 11);
  x.fillStyle = '#ffffff';
  x.fillRect(11, 6, 2, 5);
  // Étincelles
  x.fillStyle = '#fff8a0';
  x.fillRect(frame === 0 ? 4 : 18, frame < 2 ? 5 : 15, 2, 2);
  x.fillRect(frame === 1 ? 3 : 17, frame < 2 ? 16 : 6, 2, 2);
}

export class CelestialSystem {
  constructor(game) {
    this.game = game;
    this.activeKind = 'none'; // 'none' | 'aurora' | 'meteor'
    this.manualKind = null;
    this.manualUntil = 0;
    this._suppressedSlot = null;
    this.meteors = [];
    this._spawnCd = 0;
    this._animT = 0;
    this._nextId = 1;
    this._lastFrame = -1;
  }

  naturalSlot() {
    return Math.floor(Date.now() / (20 * 60_000));
  }

  computeKind() {
    const g = this.game;
    if (!g.mapObj?.outdoor || g.mapObj.id !== 'monde') return 'none';
    if (this.manualKind) {
      if (Date.now() < this.manualUntil) return this.manualKind;
      this.manualKind = null;
      this.manualUntil = 0;
    }
    const h = g.hour ? g.hour() : 12;
    const isNight = h >= 20 || h < 5;
    if (!isNight) return 'none';
    const rawSlot = this.naturalSlot();
    if (this._suppressedSlot === rawSlot) return 'none';
    // Cycle naturel de 20 minutes par fenêtre : Aurore puis Pause puis Pluie d'étoiles
    const slot = rawSlot % 4;
    if (slot === 0) return 'aurora';
    if (slot === 2) return 'meteor';
    return 'none';
  }

  syncView() {
    const next = this.computeKind();
    if (this.game.state?.flags) {
      if (next === 'aurora') this.game.state.flags.celestialAuroraSeen = true;
      else if (next === 'meteor') this.game.state.flags.celestialMeteorSeen = true;
    }
    if (next !== this.activeKind) {
      this.activeKind = next;
      this.game.view?.setCelestial?.(next);
      if (next !== 'meteor') this.clearActors();
      if (!this.game.musicLock && !this.game.enCombat && this.game.mapObj?.id === 'monde') {
        this.game.updateZone?.();
      }
      this.game.hud?.update?.(true);
    }
    return this.activeKind;
  }

  clearActors() {
    const v = this.game.view;
    if (v?.actors) {
      for (const m of this.meteors) {
        const key = `meteor:${m.id}`;
        if (v.actors.has(key)) v.removeActor(key);
      }
    }
    this.meteors = [];
  }

  invoke(kind, minutes = 8) {
    const g = this.game;
    if (!kind || kind === 'none') {
      this.manualKind = null;
      this.manualUntil = 0;
      this._suppressedSlot = this.naturalSlot();
      this.clearActors();
      this.syncView();
      return 'none';
    }
    this._suppressedSlot = null;
    this.manualKind = kind;
    this.manualUntil = Date.now() + minutes * 60_000;
    this.syncView();
    if (kind === 'meteor' && g.mapObj?.id === 'monde') {
      this._spawnCd = 1.5;
      if (this.meteors.length < 2) {
        this.spawnMeteorNearPlayer();
        this.spawnMeteorNearPlayer();
      }
    }
    if (g.state?.party?.[0] && this.activeKind !== 'none') {
      addMemory(g.state.party[0], 'celestial', g.locationName?.() || '');
    }
    return this.activeKind;
  }

  spawnMeteorNearPlayer() {
    const g = this.game, m = g.mapObj, p = g.player;
    if (!m || m.id !== 'monde' || !p) return null;
    if (this.meteors.length >= 3) return null;
    const ph = m.height ? m.height(p.x, p.y) : 0;
    const occupied = (x, y) => {
      if (x === p.x && y === p.y) return true;
      if (g.fol && g.fol.x === x && g.fol.y === y) return true;
      if (this.meteors.some((q) => q.x === x && q.y === y)) return true;
      if (g.rifts?.active && g.rifts.active.x === x && g.rifts.active.y === y) return true;
      if ((g.npcs || []).some((n) => n.x === x && n.y === y)) return true;
      if ((g.items || []).some((it) => it.x === x && it.y === y)) return true;
      return false;
    };
    const cands = [];
    for (let dx = -10; dx <= 10; dx++) {
      for (let dy = -10; dy <= 10; dy++) {
        const d = Math.abs(dx) + Math.abs(dy);
        if (d < 4 || d > 11) continue;
        const x = p.x + dx, y = p.y + dy;
        if (!m.in(x, y)) continue;
        const tile = m.get(x, y);
        if (!walkable(tile) || BLOCKED_METEOR_TILES.has(tile) || isGrassEnc(tile)) continue;
        if (m.height && Math.abs(m.height(x, y) - ph) > 1) continue;
        if (occupied(x, y)) continue;
        cands.push({ x, y });
      }
    }
    if (!cands.length) return null;
    const pick = cands[Math.floor(Math.random() * cands.length)];
    const met = { id: this._nextId++, x: pick.x, y: pick.y, canvas: null, frame: -1 };
    this.meteors.push(met);
    return met;
  }

  tick(dt) {
    this.syncView();
    const g = this.game, v = g.view, p = g.player;
    if (this.activeKind !== 'meteor' || g.mapObj?.id !== 'monde') {
      if (this.meteors.length) this.clearActors();
      return;
    }
    this._animT += dt;
    this._spawnCd -= dt;
    if (this._spawnCd <= 0 && this.meteors.length < 3) {
      this._spawnCd = 11;
      this.spawnMeteorNearPlayer();
    }
    // Retirer les météorites trop lointaines
    this.meteors = this.meteors.filter((met) => {
      const dist = p ? Math.abs(met.x - p.x) + Math.abs(met.y - p.y) : 0;
      if (dist <= 28) return true;
      const key = `meteor:${met.id}`;
      if (v?.actors?.has(key)) v.removeActor(key);
      return false;
    });
    if (!v?.actors || typeof document === 'undefined') return;
    const frame = Math.floor(this._animT * 5) % 4;
    for (const met of this.meteors) {
      if (!met.canvas) {
        met.canvas = document.createElement('canvas');
        met.canvas.width = 24;
        met.canvas.height = 24;
        drawMeteorCanvas(met.canvas, frame);
        met.frame = frame;
      }
      const key = `meteor:${met.id}`;
      const a = v.imageActor(key, met.canvas, 1.0);
      if (met.frame !== frame) {
        drawMeteorCanvas(met.canvas, frame);
        met.frame = frame;
        if (a.mesh?.material?.map) a.mesh.material.map.needsUpdate = true;
      }
      const bob = 0.08 + 0.06 * Math.sin(this._animT * 4 + met.id);
      v.place(a, met.x, met.y, bob, false);
    }
  }

  /** Bonus appliqué aux rencontres sauvages pendant un phénomène céleste actif */
  applyWildBonus(wild) {
    if (!wild || this.activeKind === 'none') return;
    if (!wild.shiny && Math.random() < 1 / 512) wild.shiny = true;
    const [, , ha] = abilitiesOf(wild.sp);
    if (ha && !wild.ability && Math.random() < 0.25) wild.ability = ha;
  }

  async interagir() {
    const g = this.game, p = g.player, m = g.mapObj;
    if (!p || m?.id !== 'monde' || !this.meteors.length) return false;
    const [dx, dy] = DIRS[p.dir] || [0, 1];
    const fx = p.x + dx, fy = p.y + dy;
    const idx = this.meteors.findIndex((q) => (q.x === fx && q.y === fy) || (q.x === p.x && q.y === p.y));
    if (idx < 0) return false;

    const met = this.meteors.splice(idx, 1)[0];
    const actorKey = `meteor:${met.id}`;
    if (g.view?.actors?.has(actorKey)) g.view.removeActor(actorKey);

    const st = g.state, ui = g.ui;
    st.flags ||= {};
    st.flags.celestialMeteors = (st.flags.celestialMeteors || 0) + 1;
    const loc = g.locationName ? g.locationName() : 'Route d\'Odyssée';
    if (st.party?.[0]) addMemory(st.party[0], 'celestial', loc);
    try { g.checkTrophies?.(true); } catch (e) { warnDev('celestial-trophy', e); }

    g.busy = true;
    try {
      g.sound?.sfx('meteor_pick');
      await ui.say('Une pierre météorique encore tiède brille d\'une poussière d\'étoiles...');
      if (Math.random() < 0.65) {
        const r = Math.random();
        const item = r < 0.45 ? 'fragment-meteore' : r < 0.65 ? 'moon-stone' : r < 0.75 ? 'sun-stone' : r < 0.90 ? 'rare-candy' : 'ultra-ball';
        const qty = item === 'ultra-ball' ? 2 : 1;
        g.give(item, qty);
        await ui.say(formatFindItem(st.name, item, qty));
      } else {
        const validPool = CELESTIAL_SPECIES.filter((id) => SPECIES[id]);
        const jirachiReady = (g.badgeCount?.() || 0) >= 8 && !st.flags.meteorJirachi && SPECIES[JIRACHI_SP] && Math.random() < 0.04;
        const sp = jirachiReady ? JIRACHI_SP : validPool[Math.floor(Math.random() * validPool.length)];
        const lvls = (st.party || []).filter((q) => q.hp > 0).map((q) => q.lvl);
        const leadLvl = lvls.length ? lvls[0] : 12;
        const cap = g.levelCap ? g.levelCap() : 100;
        const lvl = Math.max(8, Math.min(cap, leadLvl));
        const wild = createMon(sp, lvl, { met: `${loc} (Météore)` });
        if (Math.random() < 1 / 128) wild.shiny = true;
        const [, , ha] = abilitiesOf(sp);
        if (ha && Math.random() < 0.5) wild.ability = ha;
        // Au moins 2 IV à 31 pour ce visiteur stellaire
        const idxPool = [0, 1, 2, 3, 4, 5];
        for (let k = 0; k < 2; k++) {
          const pickIdx = idxPool.splice(Math.floor(Math.random() * idxPool.length), 1)[0];
          wild.iv[pickIdx] = 31;
        }
        refreshStats(wild, false);
        wild.hp = wild.stats[0];
        if (sp === JIRACHI_SP) st.flags.meteorJirachi = true;
        await ui.say(`Une lueur cosmique s'échappe du cratère : un ${monName(wild)} stellaire surgit !`);
        g.busy = false;
        const res = await g.runBattle({ wild, music: 'wild' });
        if (res === 'caught') {
          st.flags.celestialCosmicCaught = (st.flags.celestialCosmicCaught || 0) + 1;
          try { g.checkTrophies?.(true); } catch (e) { warnDev('celestial-trophy', e); }
        }
      }
      g.save?.(true);
    } finally {
      g.busy = false;
    }
    return true;
  }
}

export async function openAstrolabe(game) {
  const ui = game.ui;
  const cel = game.celestial;
  const rifts = game.rifts;
  if (!ui) return;
  game.sound?.sfx('astrolabe');

  const skyName = (k) => k === 'aurora' ? 'Aurore boréale (chromatiques ×4 & Talents Cachés)'
    : k === 'meteor' ? 'Pluie d\'étoiles filantes (météorites sur la route)'
      : 'Ciel calme';

  const actions = [
    { id: 'observe', label: 'Observer le ciel et les failles', right: cel?.activeKind !== 'none' || rifts?.active ? 'Actif' : 'Calme' },
    { id: 'aurora', label: 'Invoquer une Aurore Boréale', right: 'Ciel' },
    { id: 'meteor', label: 'Invoquer une Pluie d\'Étoiles', right: 'Météores' },
    { id: 'rift', label: 'Ouvrir une Faille Spatio-Temporelle', right: 'Anomalie' },
  ];
  if (cel?.activeKind !== 'none' || rifts?.active) {
    actions.push({ id: 'clear', label: 'Dissiper les phénomènes', right: 'Reset' });
  }
  actions.push({ id: 'close', label: 'Ranger l\'Astrolabe', right: '' });

  const pick = await ui.list({ title: 'Astrolabe Céleste', items: actions, cancel: actions.length - 1 });
  const choice = actions[pick];
  if (!choice || choice.id === 'close') return;

  if (choice.id === 'observe') {
    const msgs = [
      `État du ciel : ${skyName(cel?.activeKind || 'none')}.`,
      rifts?.active
        ? `Anomalie détectée : ${rifts.compassFromPlayer()}`
        : 'Aucune faille spatio-temporelle détectée pour le moment.',
    ];
    if (cel?.activeKind === 'meteor' && cel.meteors.length) {
      msgs.push(`${cel.meteors.length} météorite(s) tombée(s) brille(nt) près d'ici !`);
    }
    await ui.say(msgs);
    return;
  }

  if (game.mapObj?.id !== 'monde' || !game.mapObj?.outdoor) {
    await ui.say('L\'Astrolabe doit être braqué vers le ciel découvert de la région d\'Odyssée !');
    return;
  }

  if (choice.id === 'clear') {
    cel?.invoke(null);
    rifts?.clear?.();
    game.hud?.update?.(true);
    await ui.say('L\'Astrolabe apaise le ciel et referme les distorsions.');
    return;
  }

  if (choice.id === 'aurora') {
    game.sound.sfx('aurora_cast');
    cel?.invoke('aurora', 8);
    await ui.say([
      'Les lentilles de l\'Astrolabe captent les vents solaires...',
      'Une Aurore Boréale illumine le ciel ! Les Pokémon chromatiques et les Talents Cachés sont attirés ici.',
    ]);
    return;
  }

  if (choice.id === 'meteor') {
    game.sound.sfx('meteor_cast');
    cel?.invoke('meteor', 8);
    await ui.say([
      'L\'Astrolabe s\'aligne avec la constellation du Dragon...',
      'Une pluie d\'étoiles filantes embrase le ciel ! Cherche les météorites brillantes tombées tout autour de toi.',
    ]);
    return;
  }

  if (choice.id === 'rift') {
    const sub = [
      { id: 'random', label: 'Faille Aléatoire', right: '?' },
      { id: 'inverse', label: 'Faille Inversée (Types inversés)', right: '⚡' },
      { id: 'chaos', label: 'Faille Chaotique (Météo tournante)', right: '🌀' },
      { id: 'alpha', label: 'Faille Alpha (Colosse géant)', right: '🔥' },
      { id: 'back', label: 'Annuler', right: '' },
    ];
    const rPick = await ui.list({ title: 'Type de Faille à ouvrir', items: sub, cancel: sub.length - 1 });
    const rChoice = sub[rPick];
    if (!rChoice || rChoice.id === 'back') return;
    const spawned = rifts?.spawnNearPlayer(rChoice.id === 'random' ? null : rChoice.id);
    if (!spawned) {
      await ui.say('Le terrain autour de toi est trop encombré pour ouvrir une faille !');
      return;
    }
    game.sound.sfx('rift_open');
    await ui.say([
      'L\'Astrolabe déchire un instant la trame de l\'espace...',
      `Une ${spawned.kindLabel} vient de s'ouvrir ${rifts.compassFromPlayer()} !`,
    ]);
  }
}
