// odyssee/js/game/celestial.js — Phénomènes célestes rares (Aurore & Météores 3D), chutes de météorites et Astrolabe
import { SPECIES } from '../data/species.js';
import { abilitiesOf } from '../data/abilities.js';
import { formatFindItem } from '../core/items.js';
import { createMon, refreshStats, monName } from '../core/mon.js';
import { DIRS } from '../world/tiles.js';
import { caseAccessible } from './places.js';
import { addMemory } from './follower-life.js';
import { warnDev } from '../core/safe.js';

// Espèces cosmiques associées aux chutes de météorites (vérifiées dans SPECIES)
export const CELESTIAL_SPECIES = [35, 120, 173, 337, 338, 374, 436, 517, 605];
export const JIRACHI_SP = 385;

// l'Astrolabe se recharge après avoir invoqué le ciel (sans ça, on enchaînait les pluies d'étoiles sans fin) ;
// une faille, elle, se paie d'un Fragment Météorique
export const RECHARGE_CIEL = 15 * 60_000;
export const PRIX_FAILLE = 'fragment-meteore';
/** minutes avant que l'Astrolabe soit prêt (0 : prêt) ; une date dans le futur (horloge reculée) ne bloque jamais */
export function rechargeAstrolabe(st, cle, duree, now = Date.now()) {
  const t = st?.flags?.[cle] || 0;
  if (!t || t > now) return 0;
  return Math.max(0, Math.ceil((t + duree - now) / 60_000));
}

function drawMeteorCanvas(canvas, frame) {
  const x = canvas.getContext('2d');
  x.clearRect(0, 0, 24, 24);
  const clair = frame % 2 === 0;
  // des rangées de pixels : [y, x de début, largeur]
  const rangs = (L, c) => { x.fillStyle = c; for (const [y, a, w] of L) x.fillRect(a, y, w, 1); };
  // roche brûlée : contour, masse, reflets, ombre
  rangs([[12, 8, 8], [13, 6, 12], [14, 5, 14], [15, 4, 16], [16, 4, 16], [17, 4, 16], [18, 5, 14], [19, 6, 12], [20, 8, 8]], '#1a1426');
  rangs([[13, 8, 8], [14, 7, 10], [15, 6, 12], [16, 5, 14], [17, 6, 12], [18, 7, 10], [19, 9, 6]], '#4a3a58');
  rangs([[14, 7, 4], [15, 6, 4], [16, 6, 2]], '#7a6690');
  rangs([[17, 14, 3], [18, 12, 4]], '#2e2440');
  // braises dans les fissures
  rangs([[16, 10, 2], [17, 9, 1], [18, 11, 2]], clair ? '#ffb040' : '#ff7a28');
  // cristal : contour, corps, arête éclairée, côté sombre
  rangs([[3, 11, 2], [4, 10, 4], [5, 10, 4], [6, 9, 6], [7, 9, 6], [8, 8, 8], [9, 8, 8], [10, 8, 8], [11, 8, 8], [12, 9, 6], [13, 10, 4], [14, 11, 2]], '#16405e');
  rangs([[4, 11, 2], [5, 11, 2], [6, 10, 4], [7, 10, 4], [8, 9, 6], [9, 9, 6], [10, 9, 6], [11, 9, 6], [12, 10, 4], [13, 11, 2]], clair ? '#58d8f8' : '#38b0e8');
  rangs([[5, 11, 1], [6, 10, 2], [7, 10, 2], [8, 9, 2], [9, 9, 2], [10, 9, 2], [11, 10, 1]], clair ? '#d8fcff' : '#a8f0ff');
  rangs([[8, 14, 1], [9, 14, 1], [10, 14, 1], [11, 13, 2], [12, 13, 1]], '#2078b8');
  // une étincelle en croix qui tourne autour
  const [ex, ey] = [[4, 7], [18, 4], [19, 11], [5, 11]][frame % 4];
  x.fillStyle = '#fff4a8'; x.fillRect(ex, ey - 1, 1, 3); x.fillRect(ex - 1, ey, 3, 1);
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
    if (!isNight || g.eclipseOn?.()) return 'none';   // pas d'aurore pendant la nuit violette de l'Éclipse
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
      if (next !== 'none' && !this.manualKind && !this.game.busy && !this.game.bv?.alive && this.game.state?.flags?.dex) {
        this.game.ui?.toast?.(next === 'aurora' ? '✨ Une aurore boréale illumine le ciel !' : '☄️ Des étoiles filantes traversent le ciel !', 2800);
      }
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
      this._spawnCd = 6;
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
    const pick = caseAccessible(g, 4, 11);
    if (!pick) return null;
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
      this._spawnCd = 20;
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
      const a = v.imageActor(key, met.canvas, 1.0, { lumineux: true });
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
    if (!wild.shiny && Math.random() < 3 / 1024) wild.shiny = true;   // 1/1024 de base : quatre fois plus de chances en tout
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
        const item = r < 0.55 ? 'fragment-meteore' : r < 0.70 ? 'moon-stone' : r < 0.80 ? 'sun-stone' : r < 0.86 ? 'rare-candy' : 'ultra-ball';
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
        await ui.say(`Une lueur cosmique s'échappe du cratère : un ${monName(wild)} stellaire surgit !`);
        const res = await g.runBattle({ wild, music: 'wild' });
        if (res === 'caught') {
          if (sp === JIRACHI_SP) st.flags.meteorJirachi = true;   // mis K.O. ou en fuite, il pourra revenir
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

  const st = game.state, reste = (cle, d) => rechargeAstrolabe(st, cle, d);
  const ciel = reste('astroCiel', RECHARGE_CIEL), fragments = st?.bag?.[PRIX_FAILLE] || 0;
  const etat = (n, pret) => (n > 0 ? `${n} min` : pret);
  const actions = [
    { id: 'observe', label: 'Observer le ciel et les failles', right: cel?.activeKind !== 'none' || rifts?.active ? 'Actif' : 'Calme' },
    { id: 'aurora', label: 'Invoquer une Aurore Boréale', right: etat(ciel, 'Ciel') },
    { id: 'meteor', label: 'Invoquer une Pluie d\'Étoiles', right: etat(ciel, 'Météores') },
    { id: 'rift', label: 'Ouvrir une Faille Spatio-Temporelle', right: `Fragment × ${fragments}` },
  ];
  if (cel?.activeKind !== 'none' || rifts?.active) {
    actions.push({ id: 'clear', label: 'Dissiper les phénomènes', right: '' });
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
      msgs.push(cel.meteors.length > 1 ? `${cel.meteors.length} météorites brillent près d'ici !` : 'Une météorite brille près d\'ici !');
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
    const rendu = rifts?.dissiper?.();
    game.hud?.update?.(true);
    await ui.say(['L\'Astrolabe apaise le ciel et referme les distorsions.', ...(rendu ? ['La poussière d\'étoiles reforme ton Fragment Météorique !'] : [])]);
    return;
  }

  if (choice.id === 'rift' && rifts?.active?.manual) {
    await ui.say(`Ta faille est toujours ouverte ${rifts.compassFromPlayer()} !`);
    return;
  }
  if (choice.id === 'rift' && !fragments) {
    await ui.say(['Il faut un Fragment Météorique pour déchirer l\'espace.', 'Les météorites des pluies d\'étoiles en renferment, et les failles des routes en laissent parfois un.']);
    return;
  }
  const attente = choice.id === 'rift' ? 0 : ciel;
  if (attente > 0) {
    await ui.say(`Les lentilles de l'Astrolabe sont encore brûlantes. Il sera prêt dans ${attente} minute${attente > 1 ? 's' : ''}.`);
    return;
  }
  if (choice.id !== 'rift' && game.eclipseOn?.()) {
    await ui.say('La nuit violette brouille les lentilles : l\'Astrolabe ne trouve plus aucune étoile.');
    return;
  }
  st.flags ||= {};

  if (choice.id === 'aurora') {
    game.sound.sfx('aurora_cast');
    cel?.invoke('aurora', 8); st.flags.astroCiel = Date.now();
    await ui.say([
      'Les lentilles de l\'Astrolabe captent les vents solaires...',
      'Une Aurore Boréale illumine le ciel ! Les Pokémon chromatiques et les Talents Cachés sont attirés ici.',
    ]);
    return;
  }

  if (choice.id === 'meteor') {
    game.sound.sfx('meteor_cast');
    cel?.invoke('meteor', 8); st.flags.astroCiel = Date.now();
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
    if (!(await ui.yesNo('Utiliser un Fragment Météorique pour ouvrir cette faille ?'))) return;
    const spawned = rifts?.spawnNearPlayer(rChoice.id === 'random' ? null : rChoice.id);
    if (!spawned) {
      await ui.say('Le terrain autour de toi est trop encombré pour ouvrir une faille !');
      return;
    }
    game.take(PRIX_FAILLE, 1);
    st.flags.failleAstro = spawned.kind;   // payée : elle se rouvre si l'on quitte le jeu avant d'y entrer
    game.save?.(true);
    game.sound.sfx('rift_open');
    await ui.say([
      'L\'Astrolabe déchire un instant la trame de l\'espace...',
      'Le Fragment Météorique se change en poussière d\'étoiles.',
      `Une ${spawned.kindLabel} vient de s'ouvrir ${rifts.compassFromPlayer()} !`,
    ]);
  }
}
