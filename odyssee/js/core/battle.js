// odyssee/js/core/battle.js — moteur de combat 1v1, Double (2v2) et Triple (3v3), sans DOM.
// Le moteur calcule un tour d'un coup et renvoie une liste d'événements que la vue rejoue (textes, PV, animations).
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { TYPE_CHART } from '../data/types.js';
import { monName, gainExp, gainEffort, isFainted, expProgress } from './mon.js';
import { RESIST, SOIN, STAT_BAIE } from '../data/baies-objets.js';
import { ITEMS, itemName, applyItem } from './items.js';
import { getAbility } from '../data/abilities.js';
import { megaFormOf, megaEvolve, revertMegas } from './mega.js';

export const STAGE_NAMES = { 1: 'l\'Attaque', 2: 'la Défense', 3: 'l\'Attaque Spéciale', 4: 'la Défense Spéciale', 5: 'la Vitesse', 6: 'la Précision', 7: 'l\'Esquive' };
const STATUS_TXT = { par: 'est paralysé ! Il aura du mal à attaquer !', slp: 's\'est endormi !', frz: 'est gelé !', brn: 'est brûlé !', psn: 'est empoisonné !', tox: 'est gravement empoisonné !' };
const HP_TYPES = ['fighting', 'flying', 'poison', 'ground', 'rock', 'bug', 'ghost', 'steel', 'fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark'];

export function typeEff(mt, defTypes) {
  let e = 1; for (const d of defTypes) { const r = TYPE_CHART[mt]?.[d]; if (r != null) e *= r; } return e;
}
export function hiddenPower(m) {
  const order = [0, 1, 2, 5, 3, 4]; let t = 0, p = 0;
  order.forEach((s, i) => { t += (m.iv[s] & 1) << i; p += ((m.iv[s] >> 1) & 1) << i; });
  return { type: HP_TYPES[Math.floor(t * 15 / 63)], power: Math.floor(p * 40 / 63) + 30 };
}
const stageMul = (s) => (s >= 0 ? (2 + s) / 2 : 2 / (2 - s));
const accMul = (s) => (s >= 0 ? (3 + s) / 3 : 3 / (3 - s));
const freshVol = () => ({ st: [0, 0, 0, 0, 0, 0, 0, 0], conf: 0, flinch: false, charge: null, recharge: false, protect: false, protChain: 0, seed: null, trap: 0, rampage: null, invuln: null, dmgTaken: null, turns: 0 });
const refKey = (r) => `${r.side}:${r.slot}`;

function initSide(name, party, slots, extra) {
  const activeSlots = Array(slots).fill(-1);
  let k = 0;
  for (let i = 0; i < party.length && k < slots; i++) if (party[i] && party[i].hp > 0) activeSlots[k++] = i;
  if (activeSlots[0] < 0) activeSlots[0] = Math.max(0, party.findIndex((m) => m && m.hp > 0));
  const vs = Array.from({ length: slots }, freshVol);
  const s = { name, party, activeSlots, vs, screens: {}, ...extra };
  // rétro-compatibilité 1v1 : sides[i].active et sides[i].v pointent vers le premier emplacement
  Object.defineProperty(s, 'active', { get: () => s.activeSlots[0], set: (v) => { s.activeSlots[0] = v; }, configurable: true, enumerable: true });
  Object.defineProperty(s, 'v', { get: () => s.vs[0], set: (v) => { s.vs[0] = v; }, configurable: true, enumerable: true });
  return s;
}

export class Battle {
  /**
   * @param o.player { name, party, bag }   bag = { item: qté } (modifié par le combat)
   * @param o.foe    { name, party, trainer?: { cls, name, prize, items: {item:qté}, ai } }
   * @param o.format 'single' | 'double' | 'triple' | 1 | 2 | 3 (ou o.slots)
   */
  constructor(o) {
    this.rng = o.rng || Math.random;
    this.wild = !o.foe.trainer;
    const rawSlots = o.slots ?? (o.format === 'triple' || o.format === '3v3' || o.format === 3 ? 3 : o.format === 'double' || o.format === '2v2' || o.format === 2 ? 2 : 1);
    this.slots = Math.max(1, Math.min(3, rawSlots | 0));
    this.format = this.slots === 3 ? 'triple' : this.slots === 2 ? 'double' : 'single';
    this.sides = [
      initSide(o.player.name, o.player.party, this.slots, { player: true, mega: !!o.player.mega }),
      initSide(o.foe.name, o.foe.party, this.slots, { trainer: o.foe.trainer || null, mega: !!o.foe.trainer?.mega }),
    ];
    this.bag = o.player.bag || {};
    this.participants = new Set();
    this.runTries = 0;
    this.state = 'choose';
    this.result = null;
    this.ev = [];
    this.turn = 0;
    this.cap = o.cap || 100;
    this.dex = o.dex || null;
    this.prizeMoney = 0;
    this.levelUps = new Set();
    this.weather = o.weather || 'none';
    this.weatherTurns = o.weatherTurns || 0;
    this.gymCrisisTriggered = false;
    this.baseWeather = this.weather; this.baseWeatherTurns = this.weatherTurns;
    this.needPlayerSlots = [];
    this.pendingFoeSlots = [];
    this.caughtMon = null;
    for (const s of this.sides) for (const m of s.party) delete m._ko;
  }

  norm(ref) { return typeof ref === 'number' ? { side: ref, slot: 0 } : ref; }
  get me() { return this.monAt(0, 0) || this.sides[0].party.find((_, i) => this.sides[0].activeSlots.includes(i)) || this.sides[0].party[0]; }
  get foe() { return this.monAt(1, 0) || this.sides[1].party.find((_, i) => this.sides[1].activeSlots.includes(i)) || this.sides[1].party[0]; }
  monAt(side, slot = 0) { const idx = this.sides[side]?.activeSlots?.[slot]; return idx != null && idx >= 0 ? this.sides[side].party[idx] || null : null; }
  act(ref, slotArg) { const r = typeof ref === 'number' ? { side: ref, slot: slotArg ?? 0 } : ref; return this.monAt(r.side, r.slot); }
  vol(ref) { const r = this.norm(ref); return this.sides[r.side].vs[r.slot]; }
  aliveSlots(side) {
    const out = [];
    for (let sl = 0; sl < this.slots; sl++) { const m = this.monAt(side, sl); if (m && !isFainted(m)) out.push(sl); }
    return out;
  }
  allAliveRefs() {
    const out = [];
    const order = this.eotOrder ? this.eotOrder() : [0, 1];
    for (const side of order) for (const slot of this.aliveSlots(side)) out.push({ side, slot });
    return out;
  }
  /** trie des références / actions par priorité (optionnelle), Vive Griffe, Vitesse et bris d'égalité déterministe sans appeler rng() dans TimSort */
  sortBySpeed(list, prioFn = null) {
    const order = this.eotOrder ? this.eotOrder() : [0, 1];
    const items = [...list].sort((a, b) => order.indexOf(a.side ?? a.i) - order.indexOf(b.side ?? b.i) || (a.slot ?? 0) - (b.slot ?? 0));
    if (this.slots > 1 || this.pvp) {
      for (const r of items) r._tie = this.rng();
    }
    return items.sort((p, q) => {
      const dp = prioFn ? prioFn(q) - prioFn(p) : 0;
      if (dp) return dp;
      const gq = q.griffe ? 1 : 0, gp = p.griffe ? 1 : 0;
      if (gq !== gp) return gq - gp;
      const ds = this.stat(q, 5) - this.stat(p, 5);
      if (ds) return ds;
      return (q._tie != null && p._tie != null) ? (q._tie - p._tie) : this.tie(p, q);
    });
  }
  isAdjacent(a, b) { return this.slots < 3 || Math.abs(a.slot - b.slot) <= 1; }
  isLongRange(mv) {
    if (this.slots < 3 || !mv) return true;
    return mv.c === 'special' || mv.t === 'flying' || /pulse|aura|beam|ray|laser|thunder|psychic|shadow-ball|focus-blast|aerial-ace|bounce|fly/.test(mv.key || '');
  }
  validFoeTargets(attRef, mv) {
    const opp = 1 - attRef.side, alive = this.aliveSlots(opp);
    if (!alive.length) return [];
    if (this.slots < 3 || this.isLongRange(mv) || mv?.tg === 11) return alive.map((slot) => ({ side: opp, slot }));
    const adj = alive.filter((slot) => Math.abs(attRef.slot - slot) <= 1);
    return (adj.length ? adj : alive).map((slot) => ({ side: opp, slot }));
  }
  validAllyTargets(attRef) {
    const alive = this.aliveSlots(attRef.side).filter((sl) => sl !== attRef.slot);
    if (this.slots < 3) return alive.map((slot) => ({ side: attRef.side, slot }));
    const adj = alive.filter((sl) => Math.abs(attRef.slot - sl) <= 1);
    return (adj.length ? adj : alive).map((slot) => ({ side: attRef.side, slot }));
  }

  /** crans de stats : en 1v1 renvoie [st0, st1] pour compatibilité ; `allStages()` renvoie tous les emplacements */
  stages() { return this.sides.map((x) => x.vs[0].st.slice()); }
  allStages() { return this.sides.map((x) => x.vs.map((v) => v.st.slice())); }
  ab(ref) { const m = this.act(ref); return m && !isFainted(m) ? getAbility(m)?.id : null; }
  effOn(a, d, type) {
    let t = SPECIES[this.act(d).sp].t;
    if (this.ab(a) === 'scrappy' && (type === 'normal' || type === 'fighting')) t = t.filter((x) => x !== 'ghost');
    return typeEff(type, t);
  }
  r(n) { return Math.floor(this.rng() * n); }
  tie() { return this.rng() < 0.5 ? -1 : 1; }
  say(text) { this.ev.push({ t: 'msg', text }); }
  nm(ref) {
    const r = this.norm(ref), m = this.act(r);
    if (!m) return 'Pokémon';
    return r.side === 1 ? (this.wild ? `${monName(m)} sauvage` : `${monName(m)} ennemi`) : monName(m);
  }
  Nm(ref) { const s = this.nm(ref); return s[0].toUpperCase() + s.slice(1); }

  setWeather(w, turns = 5) {
    if (this.weather === w && turns === this.weatherTurns) return;
    this.weather = w; this.weatherTurns = turns;
    const txt = {
      rain: 'Une pluie battante commence à tomber !',
      sun: 'Le soleil commence à briller intensément !',
      sandstorm: 'Une tempête de sable se lève !',
      hail: 'Une averse de grêle commence à tomber !',
      none: 'Le temps redevient normal.',
    }[w] || '';
    if (txt) this.say(txt);
    this.ev.push({ t: 'weather', weather: w, turns });
  }

  triggerEntry(ref) {
    const r = this.norm(ref), m = this.act(r);
    if (!m || isFainted(m)) return;
    const ab = getAbility(m);
    if (!ab) return;
    const opp = 1 - r.side;
    const foes = this.validFoeTargets(r, null);
    if (ab.id === 'intimidate') {
      if (foes.length) {
        this.say(`Le talent Intimidation de ${this.nm(r)} s'active !`);
        this.lastUser = r;
        for (const f of foes) this.boost(f, 2, -1, true);
      }
    } else if (ab.id === 'halo-sylvestre') {
      if (foes.length) {
        this.say(`Le Halo Sylvestre de ${this.nm(r)} rayonne doucement !`);
        this.lastUser = r;
        for (const f of foes) this.boost(f, 4, -1, true);
      }
    } else if (ab.id === 'coeur-vaillant') {
      if (r.side === 1 && this.sides[1].trainer?.friendly) return;
      this.say(`Le Cœur Vaillant de ${this.nm(r)} s'enflamme de bravoure !`);
      this.lastUser = r; this.boost(r, 2, 1, true);
    } else if (ab.id === 'drizzle') {
      this.say(`Le talent Crachin de ${this.nm(r)} fait tomber la pluie !`); this.setWeather('rain', 5);
    } else if (ab.id === 'drought') {
      this.say(`Le talent Sécheresse de ${this.nm(r)} intensifie les rayons du soleil !`); this.setWeather('sun', 5);
    } else if (ab.id === 'sand-stream') {
      this.say(`Le talent Sable Volant de ${this.nm(r)} déclenche une tempête de sable !`); this.setWeather('sandstorm', 5);
    } else if (ab.id === 'snow-warning') {
      this.say(`Le talent Alerte Neige de ${this.nm(r)} fait tomber la grêle !`); this.setWeather('hail', 5);
    } else if (ab.id === 'pressure') {
      this.say(`${this.Nm(r)} met la pression !`);
    } else if (ab.id === 'unnerve') {
      this.say(`${this.Nm(r)} rend nerveuse l'équipe adverse !`);
    } else if (ab.id === 'mold-breaker') {
      this.say(`${this.Nm(r)} brise le moule !`);
    } else if (ab.id === 'cloud-nine' || ab.id === 'air-lock') {
      if (this.weather && this.weather !== 'none') { this.say('Les effets de la météo disparaissent !'); this.setWeather('none', 0); }
    } else if (ab.id === 'frisk') {
      for (const f of foes) { const fm = this.act(f); if (fm?.item) { this.say(`${this.Nm(r)} fouille ${this.nm(f)} et trouve ${itemName(fm.item)} !`); break; } }
    } else if (ab.id === 'anticipation') {
      for (const f of foes) {
        const fm = this.act(f);
        if (fm?.moves?.some((q) => MOVES[q.id] && MOVES[q.id].c !== 'status' && typeEff(MOVES[q.id].t, SPECIES[m.sp].t) > 1)) { this.say(`${this.Nm(r)} frissonne !`); break; }
      }
    }
  }

  checkBerries(ref) {
    const r = this.norm(ref), m = this.act(r), v = this.vol(r);
    if (!m || isFainted(m) || !m.item) return;
    if (m.item === 'sitrus-berry' && m.hp <= m.stats[0] / 2) {
      m.item = null;
      this.hp(r, Math.max(1, Math.floor(m.stats[0] / 4)));
      this.ev.push({ t: 'sfx', k: 'heal' });
      this.say(`${this.Nm(r)} consomme sa Baie Sitrus et récupère des PV !`);
    } else if (m.item === 'oran-berry' && m.hp <= m.stats[0] / 2) {
      m.item = null; this.hp(r, 10); this.ev.push({ t: 'sfx', k: 'heal' });
      this.say(`${this.Nm(r)} consomme sa Baie Oran et récupère des PV !`);
    } else if (SOIN[m.item] && (SOIN[m.item] === 'conf' ? v.conf > 0 : m.status === SOIN[m.item] || (SOIN[m.item] === 'psn' && m.status === 'tox'))) {
      const k = m.item; m.item = null;
      if (SOIN[k] === 'conf') { v.conf = 0; this.say(`La ${itemName(k)} guérit la confusion de ${this.nm(r)} !`); }
      else { m.status = null; m.slp = 0; m.tox = 0; this.ev.push({ t: 'status', side: r.side, slot: r.slot, status: null }); this.say(`La ${itemName(k)} guérit ${this.nm(r)} !`); }
    } else if (STAT_BAIE[m.item] && m.hp <= m.stats[0] / 4) {
      const k = m.item; m.item = null;
      this.say(`${this.Nm(r)} mange sa ${itemName(k)} !`); this.lastUser = r; this.boost(r, STAT_BAIE[k], 1, true);
    } else if (m.item === 'lum-berry' && m.status) {
      m.item = null; m.status = null; m.slp = 0; m.tox = 0;
      this.ev.push({ t: 'status', side: r.side, slot: r.slot, status: null });
      this.say(`La Baie Prun guérit les altérations d'état de ${this.nm(r)} !`);
    }
  }

  start() {
    this.ev = [];
    const t = this.sides[1].trainer;
    const foeSlots = this.aliveSlots(1), mySlots = this.aliveSlots(0);
    const joinNames = (arr) => arr.length <= 1 ? arr[0] : arr.slice(0, -1).join(', ') + ' et ' + arr[arr.length - 1];
    if (this.slots === 1) {
      const f = this.foe;
      if (this.wild) this.say(`Un ${monName(f)} sauvage apparaît !`);
      else { this.say(`${t.cls} ${t.name} veut se battre !`); this.ev.push({ t: 'send', side: 1, slot: 0, idx: this.sides[1].activeSlots[0] }); this.say(`${t.cls} ${t.name} envoie ${monName(f)} !`); }
      this.ev.push({ t: 'send', side: 0, slot: 0, idx: this.sides[0].activeSlots[0] });
      this.say(`En avant ! ${monName(this.me)} !`);
      this.participants.add(this.me.uid);
    } else {
      const foeNames = foeSlots.map((sl) => monName(this.monAt(1, sl)));
      if (this.wild) {
        this.say(`${joinNames(foeNames)} sauvages apparaissent !`);
      } else {
        this.say(`${t.cls} ${t.name} lance un combat ${this.slots === 3 ? 'Trio (3v3)' : 'Duo (2v2)'} !`);
        for (const sl of foeSlots) this.ev.push({ t: 'send', side: 1, slot: sl, idx: this.sides[1].activeSlots[sl] });
        this.say(`${t.cls} ${t.name} envoie ${joinNames(foeNames)} !`);
      }
      const myNames = mySlots.map((sl) => monName(this.monAt(0, sl)));
      for (const sl of mySlots) {
        this.ev.push({ t: 'send', side: 0, slot: sl, idx: this.sides[0].activeSlots[sl] });
        this.participants.add(this.monAt(0, sl).uid);
      }
      this.say(`En avant ! ${joinNames(myNames)} !`);
    }
    if (this.weather && this.weather !== 'none') this.ev.push({ t: 'weather', weather: this.weather, turns: this.weatherTurns });
    const startRefs = this.sortBySpeed([...mySlots.map((slot) => ({ side: 0, slot })), ...foeSlots.map((slot) => ({ side: 1, slot }))]);
    for (const r of startRefs) this.triggerEntry(r);
    return this.flush();
  }
  flush() { const e = this.ev; this.ev = []; return e; }

  /* ---------------- statistiques effectives ---------------- */
  stat(ref, k, crit = false, atkSide = true, ignore = false) {
    const r = this.norm(ref), m = this.act(r), v = this.vol(r);
    if (!m) return 1;
    let s = ignore ? 0 : v.st[k];
    if (crit) s = atkSide ? Math.max(0, s) : Math.min(0, s);
    let x = Math.floor(m.stats[k] * stageMul(s));
    const ab = getAbility(m), w = this.weather, id = ab?.id;
    if (k === 1) {
      if (m.item === 'choice-band') x = Math.floor(x * 1.5);
      if (id === 'guts' && m.status) x = Math.floor(x * 1.5);
      if (id === 'huge-power' || id === 'pure-power') x *= 2;
      if (id === 'hustle') x = Math.floor(x * 1.5);
      if (id === 'toxic-boost' && (m.status === 'psn' || m.status === 'tox')) x = Math.floor(x * 1.5);
    } else if (k === 2) {
      if (m.item === 'eviolite' && SPECIES[m.sp]?.ev?.length) x = Math.floor(x * 1.5);
      if (id === 'marvel-scale' && m.status) x = Math.floor(x * 1.5);
    } else if (k === 3) {
      if (m.item === 'choice-specs') x = Math.floor(x * 1.5);
      if (id === 'solar-power' && w === 'sun') x = Math.floor(x * 1.5);
      if (id === 'flare-boost' && m.status === 'brn') x = Math.floor(x * 1.5);
    } else if (k === 4) {
      if (m.item === 'eviolite' && SPECIES[m.sp]?.ev?.length) x = Math.floor(x * 1.5);
      if (m.item === 'assault-vest') x = Math.floor(x * 1.5);
      if (this.weather === 'sandstorm' && SPECIES[m.sp]?.t?.includes('rock')) x = Math.floor(x * 1.5);
    } else if (k === 5) {
      if (m.item === 'choice-scarf') x = Math.floor(x * 1.5);
      if ((id === 'swift-swim' && w === 'rain') || (id === 'chlorophyll' && w === 'sun') || (id === 'sand-rush' && w === 'sandstorm')) x *= 2;
      if (id === 'quick-feet' && m.status) x = Math.floor(x * 1.5);
      else if (m.status === 'par') x = Math.floor(x / 4);
    }
    return Math.max(1, x);
  }

  /* ---------------- choix du joueur ---------------- */
  usableMoves(ref) { const m = this.act(ref); return m ? m.moves.map((x, k) => (x.pp > 0 ? k : -1)).filter((k) => k >= 0) : []; }
  forcedAction(ref) {
    const v = this.vol(ref);
    if (!v) return null;
    if (v.recharge) return { type: 'recharge' };
    if (v.charge) return { type: 'move', id: v.charge };
    if (v.rampage) return { type: 'move', id: v.rampage.id };
    return null;
  }

  normalizeSlotAction(ref, rawAction) {
    const m = this.act(ref);
    const forced = this.forcedAction(ref);
    let a = forced ? { ...forced } : { ...(rawAction || { type: 'move', idx: 0 }) };
    if (a.type === 'move' && a.idx == null && a.id == null) {
      const u = this.usableMoves(ref); a = u.length ? { ...a, type: 'move', idx: u[0] } : { ...a, type: 'move', id: 165 };
    }
    if (a.type === 'move' && a.idx != null && m) {
      const mv = m.moves[a.idx];
      if (!this.usableMoves(ref).length) a = { ...a, type: 'move', id: 165 };
      else if (!mv || mv.pp <= 0) return { err: 'Plus de PP pour cette attaque !' };
      else a = { ...a, type: 'move', id: mv.id, slot: a.idx };
    }
    if (!this.pvp && !forced && m) {
      if (a.type === 'switch' && this.trapped(ref)) return { err: `${monName(m)} est pris au piège et ne peut pas être rappelé !` };
      const lock = this.choiceLock(ref);
      if (a.type === 'move' && lock != null && a.id !== 165 && a.id !== lock) return { err: `${itemName(m.item)} ne laisse utiliser que ${MOVES[lock].n} !` };
    }
    return { ok: a, wantMega: !!rawAction?.mega && a.type === 'move' };
  }

  /**
   * Exécute un tour :
   * - 1v1 : `action = { type, idx, ... }`
   * - 2v2 / 3v3 : tableau d'actions par emplacement joueur (ou une seule action { type: 'run' })
   */
  playerAction(input) {
    if (this.state !== 'choose') return [];
    const actions = Array.isArray(input) ? input : [input];
    this.ev = [];
    this.turn++;
    const alive0 = this.aliveSlots(0);
    if (actions.some((a) => a?.type === 'run') && !this.wild) {
      this.turn--; return [{ t: 'msg', text: 'Impossible de fuir un combat de Dresseur !' }];
    }
    if (this.slots > 1 && actions.some((a) => a?.type === 'item' && ITEMS[a.item]?.ball) && this.aliveSlots(1).length > 1) {
      this.turn--; return [{ t: 'msg', text: 'Il y a trop de cibles ! Mets-en d\'abord K.O. pour n\'en laisser qu\'une !' }];
    }

    const playerActs = [];
    let playerWantsMegaSlot = null;
    if (actions.some((a) => a?.type === 'run')) {
      const leadSl = alive0[0] ?? 0;
      playerActs.push({ i: 0, side: 0, slot: leadSl, a: { type: 'run' } });
    } else {
      for (let k = 0; k < alive0.length; k++) {
        const sl = alive0[k];
        const raw = actions.find((x) => x && x.slot === sl) ?? actions[k] ?? actions[0];
        const norm = this.normalizeSlotAction({ side: 0, slot: sl }, raw);
        if (norm.err) { this.turn--; return [{ t: 'msg', text: norm.err }]; }
        playerActs.push({ i: 0, side: 0, slot: sl, a: norm.ok });
        if (norm.wantMega && playerWantsMegaSlot == null && this.canMega({ side: 0, slot: sl })) playerWantsMegaSlot = sl;
      }
    }

    const foeActs = this.slots === 1
      ? [{ i: 1, side: 1, slot: 0, a: this.foeChoose() }]
      : this.foeChooseAll();

    // Méga-Évolutions du tour, une seule par camp et par combat
    let foeWantsMegaSlot = null;
    for (const fa of foeActs) {
      if (this.foeWantsMega(fa.a, fa.slot) && foeWantsMegaSlot == null) foeWantsMegaSlot = fa.slot;
    }
    for (const s of (this.eotOrder ? this.eotOrder() : [0, 1])) {
      const mSlot = s === 0 ? playerWantsMegaSlot : foeWantsMegaSlot;
      if (mSlot != null && this.canMega({ side: s, slot: mSlot })) this.doMega({ side: s, slot: mSlot });
    }

    this.resolveAll([...playerActs, ...foeActs]);
    return this.flush();
  }

  canMega(ref) {
    const r = this.norm(ref), s = this.sides[r.side], m = this.act(r);
    return !!m && !isFainted(m) && !!s.mega && !s.megaUsed && !!megaFormOf(m);
  }
  foeWantsMega(b, slot = 0) { return b?.type === 'move' && this.canMega({ side: 1, slot }); }
  doMega(ref) {
    const r = this.norm(ref), m = this.act(r), before = this.Nm(r);
    const trainer = r.side === 0 ? this.sides[0].name : (this.sides[1].trainer?.name || this.sides[1].name);
    const de = /^[AEIOUYÉÈÊÂÎÔH]/i.test(trainer) ? 'd\'' : 'de ';
    this.say(`${before} réagit au Méga-Anneau ${de}${trainer} !`);
    megaEvolve(m); this.sides[r.side].megaUsed = true;
    this.ev.push({ t: 'mega', side: r.side, slot: r.slot, sp: m.sp });
    this.say(`${before} méga-évolue en ${SPECIES[m.sp].n} !`);
    this.triggerEntry(r);
  }

  /** après un K.O. : en 1v1 reçoit un indice ; en 2v2/3v3 reçoit un indice, un tableau d'indices ou [{ slot, idx }] */
  playerSwitch(picks) {
    if (this.state !== 'switch') return [];
    this.ev = [];
    if (this.slots === 1) {
      const idx = Array.isArray(picks) ? (picks[0]?.idx ?? picks[0]) : picks;
      if (this.pendingFoe != null) { this.doSwitch(1, this.pendingFoe, true); this.pendingFoe = null; }
      this.doSwitch(0, idx, true);
      this.state = 'choose';
      return this.flush();
    }
    const list = Array.isArray(picks) ? picks : [picks];
    const switched = [];
    for (let k = 0; k < this.needPlayerSlots.length; k++) {
      const sl = this.needPlayerSlots[k];
      const item = list.find((x) => x && typeof x === 'object' && x.slot === sl) ?? list[k];
      let idx = typeof item === 'object' ? item?.idx : item;
      const party = this.sides[0].party;
      if (idx == null || !party[idx] || party[idx].hp <= 0 || this.sides[0].activeSlots.includes(idx)) {
        idx = party.findIndex((m, j) => m && m.hp > 0 && !this.sides[0].activeSlots.includes(j));
      }
      if (idx >= 0) {
        this.doSwitchSlot(0, sl, idx, true, false);
        switched.push({ side: 0, slot: sl });
      } else {
        this.sides[0].activeSlots[sl] = -1;
      }
    }
    this.needPlayerSlots = [];
    for (const p of this.pendingFoeSlots) switched.push(p);
    this.pendingFoeSlots = [];
    for (const r of this.sortBySpeed(switched)) this.triggerEntry(r);
    this.state = 'choose';
    return this.flush();
  }

  trapped(ref) { const m = this.act(ref); return !!m && this.vol(ref).trap > 0 && !SPECIES[m.sp].t.includes('ghost'); }
  choiceLock(ref) {
    const m = this.act(ref), v = this.vol(ref);
    if (!m || !v) return null;
    const id = v.choice;
    if (id == null || !/^choice-/.test(m.item || '')) return null;
    return m.moves.some((q) => q.id === id && q.pp > 0) ? id : null;
  }
  canSwitchTo(idx) {
    const m = this.sides[0].party[idx];
    return !!m && m.hp > 0 && !this.sides[0].activeSlots.includes(idx);
  }

  /* ---------------- IA (1v1 & Multi) ---------------- */
  foeChooseAll() {
    const out = [];
    let itemUsed = false;
    const isStrat = !!this.sides[1]?.trainer?.strategic || this.sides[1]?.trainer?.ai === 'strategic';
    const ctx = isStrat ? { plannedDmg: new Map(), protectedAlly: new Set(), usedUtility: new Set(), statusedTarget: new Set() } : null;
    const slots = this.aliveSlots(1);
    const evalOrder = isStrat ? [...slots].sort((a, b) => this.stat({ side: 1, slot: b }, 5) - this.stat({ side: 1, slot: a }, 5)) : slots;
    for (const sl of evalOrder) {
      const a = this.foeChooseSlot(sl, itemUsed, ctx);
      if (a.type === 'item') itemUsed = true;
      out.push({ i: 1, side: 1, slot: sl, a });
    }
    return isStrat ? out.sort((a, b) => a.slot - b.slot) : out;
  }
  foeChoose() { return this.foeChooseSlot(0, false, null); }
  foeChooseSlot(slot = 0, itemUsed = false, ctx = null) {
    const ref = { side: 1, slot };
    const forced = this.forcedAction(ref); if (forced) return forced;
    const side = this.sides[1], m = this.act(ref), t = side.trainer, v = this.vol(ref);
    const usable = this.usableMoves(ref);
    if (!usable.length) return { type: 'move', id: 165 };
    { const lock = this.choiceLock(ref); if (lock != null) { const k = m.moves.findIndex((q) => q.id === lock); return { type: 'move', id: lock, slot: k }; } }

    const aliveFoeTargets = this.aliveSlots(0).map((s0) => ({ side: 0, slot: s0 }));
    if (this.wild) {
      const k = usable[this.r(usable.length)];
      const mv = MOVES[m.moves[k].id];
      const cands = this.validFoeTargets(ref, mv);
      const tgt = cands.length ? cands[this.r(cands.length)] : { side: 0, slot: 0 };
      return { type: 'move', id: mv.id, slot: k, targetSide: tgt.side, targetSlot: tgt.slot };
    }

    const isStrategic = !!t.strategic || t.ai === 'strategic';
    const isSmart = t.ai === 'smart' || isStrategic;
    const isRival = t.cls === 'Rival' || t.rival || this.rival;
    if (!itemUsed && t.items && !(side.soinTour != null && this.turn - side.soinTour <= 1)) {
      const ratio = m.hp / m.stats[0];
      const hasStatus = !!m.status;
      const benchAlive = side.party.some((p, idx) => !side.activeSlots.includes(idx) && p.hp > 0);
      const healThreshold = (isSmart || isRival) ? (!benchAlive ? 0.52 : 0.44) : 0.28;
      if (hasStatus && t.items['full-restore'] > 0 && (ratio < 0.75 || this.rng() < 0.85)) {
        t.items['full-restore']--; side.soinTour = this.turn;
        return { type: 'item', item: 'full-restore', foe: true, slot };
      }
      if (ratio <= healThreshold && (!isSmart ? this.rng() < 0.85 : true)) {
        const needed = m.stats[0] - m.hp;
        let chosen = null;
        if (t.items['full-restore'] > 0 && (hasStatus || needed > 120)) chosen = 'full-restore';
        else if (t.items['hyper-potion'] > 0 && needed > 90) chosen = 'hyper-potion';
        else if (t.items['super-potion'] > 0 && needed > 35) chosen = 'super-potion';
        else if (t.items['potion'] > 0) chosen = 'potion';
        else if (t.items['hyper-potion'] > 0) chosen = 'hyper-potion';
        else if (t.items['full-restore'] > 0) chosen = 'full-restore';
        if (chosen) { t.items[chosen]--; side.soinTour = this.turn; return { type: 'item', item: chosen, foe: true, slot }; }
      }
    }

    const mySpeed = this.stat(ref, 5);
    const myTypes = SPECIES[m.sp]?.t || [];
    const options = [];
    for (const k of usable) {
      const mv = MOVES[m.moves[k].id];
      const cands = this.validFoeTargets(ref, mv);
      const tgtPool = cands.length ? cands : [{ side: 0, slot: 0 }];
      const isSpreadMove = mv.tg === 9 || mv.tg === 11;
      // En combat multi, on évalue chaque cible possible pour trouver la meilleure paire (attaque, cible)
      const evalTargets = (isSpreadMove || mv.tg === 7 || mv.tg === 4 || mv.tg === 13) ? [tgtPool[0]] : tgtPool;
      for (const tgtRef of evalTargets) {
        const pMon = this.act(tgtRef) || this.me;
        const pType = SPECIES[pMon.sp]?.t || ['normal'];
        const pVol = this.vol(tgtRef);
        const amFaster = mySpeed >= this.stat(tgtRef, 5);
        let s = 10;
        if (mv.c === 'status' && m.item === 'assault-vest') s = 0.0001;
        else if (mv.key === 'fake-out' && v.turns > 0) s = 0.0001;
        else if (mv.c !== 'status' && (mv.p > 0 || mv.m?.u)) {
          const mvType = this.moveType(ref, mv);
          const scoreVs = (tr) => {
            const pm = this.act(tr);
            if (!pm || isFainted(pm)) return 0;
            const pt = SPECIES[pm.sp]?.t || ['normal'];
            const eff = typeEff(mvType, pt);
            if (eff === 0) return 0;
            const pa = this.ab(ref) === 'mold-breaker' ? null : this.ab(tr);
            const nul = { ground: ['levitate'], water: ['water-absorb', 'dry-skin', 'storm-drain'], electric: ['volt-absorb', 'lightning-rod', 'motor-drive'], fire: ['flash-fire'], grass: ['sap-sipper'] }[mvType];
            if (pa && ((nul && nul.includes(pa)) || (pa === 'wonder-guard' && eff <= 1))) return 0;
            const d = this.estimate(ref, tr, mv) * (isSpreadMove && tgtPool.length > 1 ? 0.75 : 1);
            let sc = d * ((mv.a || 100) / 100);
            if (isStrategic && ctx && tr.side === 0) {
              const queued = ctx.plannedDmg.get(tr.slot) || 0;
              const remHp = Math.max(1, pm.hp - queued);
              if (queued >= pm.hp) sc *= 0.12;
              else if (d >= remHp) { sc *= 3.2; if (mv.pr && mv.pr > 0) sc *= 4.0; }
            }
            if (d >= pm.hp) { sc *= 3.8; if (mv.pr && mv.pr > 0) sc *= 5.0; }
            if (eff >= 2) sc *= (eff >= 4 ? 1.75 : 1.35);
            if (mv.m?.recharge) sc *= 0.5;
            if (mv.m?.boom) sc = (m.hp < m.stats[0] * 0.22 && d >= pm.hp) ? sc * 1.5 : sc * 0.04;
            if (myTypes.includes(mvType)) sc *= 1.3;
            if (mv.m?.flinch && amFaster) sc *= isStrategic && mv.key === 'fake-out' ? 2.1 : 1.25;
            if (mv.m?.crit) sc *= 1.15;
            return sc;
          };
          if (isSpreadMove && this.slots > 1) {
            s = 0;
            for (const f of tgtPool) s += scoreVs(f);
            let dangerousFriendly = false;
            // Pénalité si l'attaque touche aussi nos alliés (Séisme, Surf, Coup d'Jus…)
            if (mv.tg === 9) {
              for (const alSl of this.aliveSlots(1)) if (alSl !== slot && this.isAdjacent(ref, { side: 1, slot: alSl })) {
                if (isStrategic && ctx?.protectedAlly?.has(alSl)) continue;
                const alRef = { side: 1, slot: alSl }, alMon = this.act(alRef);
                const allyPenalty = scoreVs(alRef);
                if (isStrategic && allyPenalty > 0 && alMon) {
                  if (this.estimate(ref, alRef, mv) >= alMon.hp * 0.45) dangerousFriendly = true;
                  s -= allyPenalty * 2.6;
                } else {
                  s -= allyPenalty * 1.1;
                }
              }
            }
            if (isStrategic && !dangerousFriendly && tgtPool.length >= 2 && s > 0) s *= 1.15;
            s = dangerousFriendly ? 0.0001 : Math.max(0.0001, s);
          } else {
            s = Math.max(0.0001, scoreVs(tgtRef));
          }
        } else {
          const x = mv.m || {};
          if (x.heal || x.u === 'rest') {
            if (m.hp < m.stats[0] * (isStrategic ? 0.50 : 0.45)) s = pMon.stats[0] * (isStrategic ? 1.65 : 1.4);
            else if (m.hp < m.stats[0] * 0.65) s = pMon.stats[0] * 0.55;
            else s = 0.001;
          } else if (x.u === 'reflect' || x.u === 'light-screen' || x.u === 'mist' || x.u === 'safeguard') {
            const scrKey = x.u === 'light-screen' ? 'light' : x.u;
            if (side.screens[scrKey] || ctx?.usedUtility?.has(x.u)) s = 0.0001;
            else s = pMon.stats[0] * (isStrategic ? 1.45 : 0.6);
          } else if (x.ail && !['conf', 'seed', 'trap'].includes(x.ail)) {
            if (pMon.status || (isStrategic && ctx?.statusedTarget?.has(tgtRef.slot))) s = 0.001;
            else {
              const cannot = (x.ail === 'psn' && (pType.includes('poison') || pType.includes('steel'))) ||
                (x.ail === 'brn' && pType.includes('fire')) || (x.ail === 'par' && pType.includes('electric'));
              const brnBoost = isStrategic && x.ail === 'brn' && this.stat(tgtRef, 1) >= this.stat(tgtRef, 3) ? 1.65 : 1.4;
              s = cannot ? 0.001 : pMon.stats[0] * (x.ail === 'slp' ? 1.85 : brnBoost);
            }
          } else if (x.ail === 'conf') s = pVol.conf ? 0.001 : pMon.stats[0] * 0.7;
          else if (x.ail === 'seed') s = (pVol.seed || pType.includes('grass')) ? 0.001 : pMon.stats[0] * 0.95;
          else if (x.st) {
            const isDebuff = x.st.some(([, amt]) => amt < 0);
            if (isDebuff) {
              const alreadyLowered = x.st.some(([stat]) => (pVol.st[stat] || 0) <= -1);
              s = (alreadyLowered || v.turns > 1 || m.hp < m.stats[0] * 0.70) ? 0.001 : pMon.stats[0] * 0.35;
            } else {
              const isAtkBoost = x.st.some(([stat, amt]) => (stat === 1 || stat === 3) && amt > 0);
              const curStage = Math.max(v.st[1] || 0, v.st[3] || 0);
              s = (curStage < 2 && m.hp >= m.stats[0] * 0.50) ? (isAtkBoost ? pMon.stats[0] * 1.3 : pMon.stats[0] * 0.85) : pMon.stats[0] * 0.1;
            }
          } else if (mv.key === 'protect' || mv.key === 'detect') {
            if (v.protChain > 0) s = 0.001;
            else if (pVol.seed || pMon.status === 'tox') s = pMon.stats[0] * 1.15;
            else if (isStrategic && m.item === 'leftovers' && m.hp < m.stats[0] * 0.45) s = pMon.stats[0] * 1.1;
            else if (isStrategic && this.aliveSlots(1).some((alSl) => alSl !== slot && this.isAdjacent(ref, { side: 1, slot: alSl }) && this.act({ side: 1, slot: alSl })?.moves?.some((amv) => { const mm = MOVES[amv.id]; return amv.pp > 0 && mm?.tg === 9 && this.estimate({ side: 1, slot: alSl }, ref, mm) >= m.hp * 0.35; }))) s = pMon.stats[0] * 1.35;
            else s = pMon.stats[0] * 0.35;
          } else s = pMon.stats[0] * 0.2;
        }
        options.push({ k, mv, tgtRef, s: Math.max(0.01, s), d: mv.c !== 'status' ? this.estimate(ref, tgtRef, mv) : 0, pHp: pMon.hp });
      }
    }

    let pick;
    if (isSmart || isRival) {
      const tri = [...options].sort((a, b) => b.s - a.s);
      pick = tri[0];
      const ko = pick.mv.c !== 'status' && pick.d >= pick.pHp;
      if (!isStrategic && !ko && tri[1] && tri[1].s >= pick.s * 0.8 && this.rng() < 0.3) pick = tri[1];
    } else {
      const tot = options.reduce((acc, x) => acc + x.s * x.s, 0);
      let r = this.rng() * tot;
      pick = options[0];
      for (const x of options) { r -= x.s * x.s; if (r <= 0) { pick = x; break; } }
    }
    if (isStrategic && ctx) {
      if (pick.mv.key === 'protect' || pick.mv.key === 'detect') ctx.protectedAlly.add(slot);
      if (pick.mv.m?.u) ctx.usedUtility.add(pick.mv.m.u);
      if (pick.mv.m?.ail && !['conf', 'seed', 'trap'].includes(pick.mv.m.ail)) ctx.statusedTarget.add(pick.tgtRef.slot);
      if (pick.mv.c !== 'status') {
        const hitTgts = (pick.mv.tg === 9 || pick.mv.tg === 11) ? this.validFoeTargets(ref, pick.mv) : [pick.tgtRef];
        const mul = (pick.mv.tg === 9 || pick.mv.tg === 11) && hitTgts.length > 1 ? 0.75 : 1;
        for (const f of hitTgts) {
          if (f.side !== 0) continue;
          ctx.plannedDmg.set(f.slot, (ctx.plannedDmg.get(f.slot) || 0) + this.estimate(ref, f, pick.mv) * mul);
        }
      }
    }
    return { type: 'move', id: pick.mv.id, slot: pick.k, targetSide: pick.tgtRef.side, targetSlot: pick.tgtRef.slot };
  }

  damagePreview(a, d, moveId) {
    const mv = MOVES[moveId], T = this.act(d); if (!mv || !T || !T.stats) return null;
    if (mv.c === 'status' && !mv.m?.u) return null;
    const u = mv.m?.u, max = T.stats[0];
    const pct = (lo, hi) => ({ lo: Math.max(0, Math.floor(lo * 1000 / max) / 10), hi: Math.min(999, Math.ceil(hi * 1000 / max) / 10), lo0: lo, hi0: hi, ko: hi >= T.hp, sure: lo >= T.hp });
    const type = this.moveType(a, mv), eff = typeEff(type, SPECIES[T.sp].t);
    if (eff === 0) return { lo: 0, hi: 0, eff: 0 };
    const m = this.act(a);
    const fixed = u === 'dragon-rage' ? 40 : u === 'sonic-boom' ? 20 : u === 'seismic-toss' || u === 'night-shade' ? m.lvl : u === 'super-fang' ? Math.max(1, Math.floor(T.hp / 2)) : u === 'endeavor' ? Math.max(0, T.hp - m.hp) : null;
    if (u === 'psywave') return { ...pct(Math.floor(m.lvl * 0.5), Math.floor(m.lvl * 1.5)), eff: 1 };
    if (u === 'counter' || u === 'mirror-coat' || u === 'splash' || mv.m?.cat === 9 || mv.key === 'metal-burst') return null;
    if (mv.key === 'final-gambit') return { ...pct(m.hp, m.hp), eff: 1 };
    if (fixed != null) return { ...pct(fixed, fixed), eff: 1 };
    const p = u === 'magnitude' ? 70 : u === 'present' ? 40 : this.movePower(a, d, mv);
    if (!p) return null;
    const x = mv.m || {}, hits = x.h0 ? [x.h0, x.h1 || x.h0] : [1, 1];
    const spread = this.slots > 1 && (mv.tg === 9 || mv.tg === 11) && this.validFoeTargets(this.norm(a), mv).length > 1 ? 0.75 : 1;
    const lo = Math.floor(this.damageCore(a, d, mv, p, type, false, 0.85) * spread) * hits[0];
    const hi = Math.floor(this.damageCore(a, d, mv, p, type, false, 1) * spread) * hits[1];
    return { ...pct(lo, hi), eff };
  }
  estimate(a, d, mv) {
    const p = this.movePower(a, d, mv); if (!p) return mv.m?.u ? this.act(d).stats[0] * 0.2 : 0;
    const t = this.moveType(a, mv);
    return this.damageCore(a, d, mv, p, t, false, 0.92);
  }

  /* ---------------- résolution d'un tour ---------------- */
  resolve(a, b) { this.resolveAll([{ i: 0, side: 0, slot: 0, a }, { i: 1, side: 1, slot: 0, a: b }]); }

  resolveAll(acts) {
    const order = this.eotOrder ? this.eotOrder() : [0, 1];
    acts = [...acts].sort((a, b) => order.indexOf(a.side ?? a.i) - order.indexOf(b.side ?? b.i) || (a.slot ?? 0) - (b.slot ?? 0));
    for (const s of this.sides) for (const v of s.vs) { v.flinch = false; v.dmgTaken = null; }
    for (const x of acts) {
      const ref = { side: x.side, slot: x.slot };
      if (x.a.type === 'switch' && this.trapped(ref)) { this.say(`${this.Nm(ref)} est pris au piège et ne peut pas être rappelé !`); x.a = { type: 'none' }; x.done = true; }
      const lock = this.choiceLock(ref);
      if (x.a.type === 'move' && lock != null && x.a.id !== 165 && x.a.id !== lock) {
        x.a = { ...x.a, type: 'move', id: lock, slot: this.act(ref).moves.findIndex((q) => q.id === lock) };
      }
    }
    const reservedSwitch = new Set();
    for (const x of acts) {
      if (this.state === 'over') return;
      const ref = { side: x.side, slot: x.slot };
      if (x.a.type === 'run') { if (this.tryRun()) return; x.done = true; }
      else if (x.a.type === 'switch') {
        const sk = x.side + ':' + x.a.idx;
        if (!reservedSwitch.has(sk) && this.sides[x.side].party[x.a.idx]?.hp > 0 && !this.sides[x.side].activeSlots.includes(x.a.idx)) {
          reservedSwitch.add(sk);
          this.doSwitchSlot(x.side, x.slot, x.a.idx, false, false);
        }
        x.done = true;
      } else if (x.a.type === 'item') {
        if (this.useItem(x.side, x.a, x.slot)) return;
        x.done = true;
      }
    }
    const switched = acts.filter((x) => x.a.type === 'switch');
    if (switched.length) {
      for (const x of this.sortBySpeed(switched)) this.triggerEntry({ side: x.side, slot: x.slot });
    }
    const movers = acts.filter((x) => !x.done);
    const prio = (x) => {
      if (x.a.type !== 'move') return 0;
      const mv = MOVES[x.a.id], id = this.ab(x);
      return mv.pr + ((id === 'prankster' && mv.c === 'status') || (id === 'gale-wings' && mv.t === 'flying') ? 1 : 0);
    };
    for (const x of movers) {
      const m = this.act(x);
      x.griffe = m && m.item === 'quick-claw' && x.a.type === 'move' && this.r(5) === 0;
    }
    const sortedMovers = this.sortBySpeed(movers, prio);
    for (const x of sortedMovers) if (x.griffe && sortedMovers[0] === x && sortedMovers.length > 1) this.say(`La Vive Griffe de ${this.nm(x)} lui permet d'agir en premier !`);
    const acted = new Set();
    for (const x of sortedMovers) {
      if (this.state === 'over') return;
      const ref = { side: x.side, slot: x.slot };
      if (isFainted(this.act(ref))) continue;
      if (x.a.type === 'recharge') { this.say(`${this.Nm(ref)} doit se recharger !`); this.vol(ref).recharge = false; acted.add(refKey(ref)); continue; }
      this.useMoveRef(ref, x.a, acted);
      acted.add(refKey(ref));
      if (this.checkFaints(true)) break;
    }
    if (this.state !== 'over') this.endOfTurn();
  }

  tryRun() {
    if (!this.wild) { this.say('Impossible de fuir un combat de Dresseur !'); return false; }
    this.runTries++;
    const lead = { side: 0, slot: this.aliveSlots(0)[0] ?? 0 }, fLead = { side: 1, slot: this.aliveSlots(1)[0] ?? 0 };
    if (this.trapped(lead)) { this.say(`${monName(this.act(lead))} est pris au piège : impossible de fuir !`); return false; }
    if (this.ab(lead) === 'run-away') { this.ev.push({ t: 'sfx', k: 'run' }); this.say('Vous prenez la fuite !'); this.end('run'); return true; }
    if ((this.ab(fLead) === 'shadow-tag' && this.ab(lead) !== 'shadow-tag') || (this.ab(fLead) === 'arena-trap' && !SPECIES[this.act(lead).sp].t.includes('flying') && this.ab(lead) !== 'levitate')) {
      this.say(`${this.Nm(fLead)} empêche la fuite !`); return false;
    }
    const a = this.stat(lead, 5), b = this.stat(fLead, 5);
    const f = Math.floor(a * 128 / b) + 30 * this.runTries;
    if (a >= b || f > 255 || this.r(256) < f) { this.ev.push({ t: 'sfx', k: 'run' }); this.say('Vous prenez la fuite !'); this.end('run'); return true; }
    this.say('Impossible de fuir !'); return false;
  }

  doSwitch(side, idx, afterFaint, trigger = true) { return this.doSwitchSlot(side, 0, idx, afterFaint, trigger); }
  doSwitchSlot(i, slot, idx, afterFaint, trigger = true) {
    const side = this.sides[i], ref = { side: i, slot }, cur = this.act(ref);
    if (!afterFaint && cur) {
      this.say(i === 0 ? `${monName(cur)}, reviens !` : `${side.trainer.cls} ${side.trainer.name} rappelle ${monName(cur)} !`);
      this.ev.push({ t: 'recall', side: i, slot });
    }
    if (cur && !isFainted(cur)) {
      const id = this.ab(ref);
      if (id === 'natural-cure' && cur.status) { cur.status = null; cur.slp = 0; cur.tox = 0; }
      if (id === 'regenerator') cur.hp = Math.min(cur.stats[0], cur.hp + Math.floor(cur.stats[0] / 3));
    }
    side.activeSlots[slot] = idx;
    side.vs[slot] = freshVol();
    const sent = this.act(ref);
    this.ev.push({ t: 'send', side: i, slot, idx });
    if (i === 0 && sent) {
      this.say(`En avant ! ${monName(sent)} !`);
      this.participants.add(sent.uid);
    } else if (sent) {
      this.say(`${side.trainer.cls} ${side.trainer.name} envoie ${monName(sent)} !`);
      if (this.slots === 1) this.participants = new Set(this.aliveSlots(0).map((s0) => this.monAt(0, s0).uid));
    }
    for (const vOpp of this.sides[1 - i].vs) if (vOpp.trap && vOpp.trap.by === refKey(ref)) vOpp.trap = 0;
    if (this.slots === 1) this.sides[1 - i].vs[0].trap = 0;
    if (trigger) this.triggerEntry(ref);
  }

  useItem(i, a, slot = 0) {
    if (i === 1) {
      const ref = { side: 1, slot: a.slot ?? slot }, m = this.act(ref), t = this.sides[1].trainer;
      if (!m) return false;
      const before = m.hp, st0 = m.status;
      applyItem(a.item, m);
      this.say(`${t.cls} ${t.name} utilise ${itemName(a.item)} !`);
      this.ev.push({ t: 'hp', side: 1, slot: ref.slot, hp: m.hp, from: before });
      if (st0 && !m.status) this.ev.push({ t: 'status', side: 1, slot: ref.slot, status: null });
      return false;
    }
    const it = ITEMS[a.item];
    if (!(it.ball && !this.wild)) { this.bag[a.item] = (this.bag[a.item] || 0) - 1; if (this.bag[a.item] <= 0) delete this.bag[a.item]; }
    if (it.ball) return this.throwBall(a.item);
    const m = this.sides[0].party[a.target], before = m.hp;
    this.say(`Vous utilisez ${itemName(a.item)} !`);
    const msg = applyItem(a.item, m, a.moveIdx ?? -1);
    if (m.hp > 0) delete m._ko;
    const onSlot = this.sides[0].activeSlots.indexOf(a.target);
    if (onSlot >= 0) this.ev.push({ t: 'hp', side: 0, slot: onSlot, hp: m.hp, from: before, status: m.status });
    this.ev.push({ t: 'sfx', k: 'heal' });
    this.say(msg || 'Mais cela n\'a aucun effet...');
    return false;
  }

  throwBall(item) {
    const fSlots = this.aliveSlots(1), tgtSlot = fSlots[0] ?? 0;
    this.say(`Vous lancez une ${itemName(item)} !`);
    if (!this.wild) { this.ev.push({ t: 'ball', item, slot: tgtSlot, blocked: true }); this.say('Le Dresseur dévie la Ball !'); this.say('Voler, c\'est mal !'); return false; }
    const m = this.monAt(1, tgtSlot), S = SPECIES[m.sp], max = m.stats[0];
    const st = m.status === 'slp' || m.status === 'frz' ? 2 : m.status ? 1.5 : 1;
    const a = Math.floor(((3 * max - 2 * m.hp) * S.cr * ITEMS[item].ball) / (3 * max) * st);
    let shakes = 0, caught = false;
    if (a >= 255 || ITEMS[item].ball >= 255) { shakes = 4; caught = true; }
    else {
      const b = Math.floor(1048560 / Math.sqrt(Math.sqrt(16711680 / Math.max(1, a))));
      while (shakes < 4 && this.r(65536) < b) shakes++;
      caught = shakes === 4;
    }
    this.ev.push({ t: 'ball', item, slot: tgtSlot, shakes: Math.min(3, shakes), caught });
    if (caught) {
      m.ball = item; m.status = m.status === 'frz' ? null : m.status;
      this.caughtMon = m;
      this.say(`Et hop ! ${monName(m)} est attrapé !`);
      this.end('caught');
      return true;
    }
    this.say(['Oh non ! La créature s\'est libérée !', 'Raaah ! Ça y était presque !', 'Aaaah ! Presque !', 'Mince ! Ça y était presque !'][shakes] || 'Raté !');
    return false;
  }

  moveType(i, mv) { return mv.m?.u === 'hidden-power' ? hiddenPower(this.act(i)).type : mv.t; }
  movePower(i, d, mv) {
    const u = mv.m?.u, m = this.act(i), t = this.act(d);
    if (u === 'hidden-power') return hiddenPower(m).power;
    if (mv.key === 'electro-ball') { const q = this.stat(i, 5) / this.stat(d, 5); return q >= 4 ? 150 : q >= 3 ? 120 : q >= 2 ? 80 : q >= 1 ? 60 : 40; }
    if (mv.key === 'heat-crash') { const q = (SPECIES[m.sp].w || 100) / (SPECIES[t.sp].w || 100); return q >= 5 ? 120 : q >= 4 ? 100 : q >= 3 ? 80 : q >= 2 ? 60 : 40; }
    if (u === 'flail' || u === 'reversal') { const p = Math.floor(48 * m.hp / m.stats[0]); return p <= 1 ? 200 : p <= 4 ? 150 : p <= 9 ? 100 : p <= 16 ? 80 : p <= 32 ? 40 : 20; }
    if (u === 'low-kick') { const w = SPECIES[t.sp].w || 100; return w < 100 ? 20 : w < 250 ? 40 : w < 500 ? 60 : w < 1000 ? 80 : w < 2000 ? 100 : 120; }
    if (u === 'return') return 102;
    if (u === 'frustration') return 40;
    if (u === 'facade') return m.status ? 140 : 70;
    if (u === 'magnitude') return [10, 30, 50, 70, 90, 110, 150][[0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 6, 6, 6, 6, 6][this.r(100)]];
    return mv.p || 0;
  }

  damageCore(a, d, mv, power, type, crit, rand) {
    const aR = this.norm(a), dR = this.norm(d);
    const A = this.act(aR), D = this.act(dR);
    const phys = mv.c === 'physical';
    const aId = this.ab(aR), dId = this.ab(dR), x = mv.m || {};
    const atk = this.stat(aR, phys ? 1 : 3, crit, true, dId === 'unaware'), def = this.stat(dR, phys ? 2 : 4, crit, false, aId === 'unaware');
    let dmg = Math.floor(Math.floor(Math.floor(2 * A.lvl / 5 + 2) * power * atk / def) / 50);
    if (phys && A.status === 'brn' && aId !== 'guts') dmg = Math.floor(dmg / 2);
    const scr = this.sides[dR.side].screens;
    if (!crit && ((phys && scr.reflect) || (!phys && scr.light))) dmg = Math.floor(dmg / 2);
    dmg += 2;
    if (crit) dmg = Math.floor(dmg * 1.5);
    dmg = Math.floor(dmg * rand);
    const aAb = getAbility(A), dAb = getAbility(D);
    if (SPECIES[A.sp].t.includes(type)) dmg = Math.floor(dmg * (aAb?.id === 'adaptability' ? 2.0 : 1.5));
    if (A.hp <= A.stats[0] / 3) {
      if (type === 'fire' && aAb?.id === 'blaze') dmg = Math.floor(dmg * 1.5);
      if (type === 'water' && aAb?.id === 'torrent') dmg = Math.floor(dmg * 1.5);
      if (type === 'grass' && aAb?.id === 'overgrow') dmg = Math.floor(dmg * 1.5);
      if (type === 'bug' && aAb?.id === 'swarm') dmg = Math.floor(dmg * 1.5);
    }
    if (aAb?.id === 'technician' && power <= 60) dmg = Math.floor(dmg * 1.5);
    if (aId === 'iron-fist' && /punch|poing/.test(mv.key || '')) dmg = Math.floor(dmg * 1.2);
    if (aId === 'reckless' && x.drain < 0) dmg = Math.floor(dmg * 1.2);
    if (aId === 'sheer-force' && (x.ailc || x.stc || x.flinch)) dmg = Math.floor(dmg * 1.3);
    if (aId === 'sand-force' && this.weather === 'sandstorm' && ['rock', 'ground', 'steel'].includes(type)) dmg = Math.floor(dmg * 1.3);
    if (aId === 'sniper' && crit) dmg = Math.floor(dmg * 1.5);
    if (type === 'fire' && this.vol(aR).flashFire) dmg = Math.floor(dmg * 1.5);
    const typeBoosters = {
      fire: 'charcoal', water: 'mystic-water', grass: 'miracle-seed', electric: 'magnet', dark: 'black-glasses',
      rock: 'hard-stone', ground: 'soft-sand', flying: 'sharp-beak', fighting: 'black-belt', poison: 'poison-barb',
      psychic: 'twisted-spoon', bug: 'silver-powder', dragon: 'dragon-fang', ice: 'never-melt-ice', steel: 'metal-coat',
      normal: 'silk-scarf', ghost: 'spell-tag', fairy: 'fairy-feather',
    };
    if (typeBoosters[type] && A.item === typeBoosters[type]) dmg = Math.floor(dmg * 1.2);
    if (A.item === 'life-orb') dmg = Math.floor(dmg * 1.3);
    if ((A.item === 'muscle-band' && phys) || (A.item === 'wise-glasses' && !phys)) dmg = Math.floor(dmg * 1.1);
    if (this.weather === 'rain') { if (type === 'water') dmg = Math.floor(dmg * 1.5); else if (type === 'fire') dmg = Math.floor(dmg * 0.5); }
    else if (this.weather === 'sun') { if (type === 'fire') dmg = Math.floor(dmg * 1.5); else if (type === 'water') dmg = Math.floor(dmg * 0.5); }
    const eff = this.effOn(aR, dR, type);
    dmg = Math.floor(dmg * eff);
    if (aId === 'tinted-lens' && eff > 0 && eff < 1) dmg *= 2;
    if (A.item === 'expert-belt' && eff > 1) dmg = Math.floor(dmg * 1.2);
    if (dAb?.id === 'thick-fat' && (type === 'fire' || type === 'ice')) dmg = Math.floor(dmg / 2);
    if (dId === 'heatproof' && type === 'fire') dmg = Math.floor(dmg / 2);
    if (dId === 'dry-skin' && type === 'fire') dmg = Math.floor(dmg * 1.25);
    if ((dId === 'filter' || dId === 'solid-rock') && eff > 1) dmg = Math.floor(dmg * 0.75);
    if (dId === 'multiscale' && D.hp === D.stats[0]) dmg = Math.floor(dmg / 2);
    return Math.max(1, dmg);
  }

  hp(ref, delta, cause) {
    const r = this.norm(ref), m = this.act(r);
    if (!m) return 0;
    const before = m.hp;
    m.hp = Math.max(0, Math.min(m.stats[0], m.hp + delta));
    if (m.hp !== before) this.ev.push({ t: 'hp', side: r.side, slot: r.slot, hp: m.hp, from: before, cause });
    const half = m.stats[0] / 2;
    if (m.hp > 0 && m.hp <= half && before > half && this.ab(r) === 'sacoches-pollen' && !(this.sacoches ||= new Set()).has(m.uid)) {
      this.sacoches.add(m.uid);
      this.say(`${this.Nm(r)} puise dans ses Sacoches de Pollen !`);
      this.hp(r, Math.max(1, Math.floor(m.stats[0] / 4)));
      this.boost(r, 6, 1);
    }
    return before - m.hp;
  }

  resolveTargets(attRef, a, mv) {
    const opp = 1 - attRef.side;
    if (mv.tg === 7 || mv.tg === 4 || mv.tg === 5 || mv.tg === 6) return { targets: [attRef], isSpread: false, selfTarget: true };
    if (mv.tg === 12 || mv.tg === 14) return { targets: this.allAliveRefs(), isSpread: false, selfTarget: true };
    if (mv.tg === 13) return { targets: this.aliveSlots(attRef.side).map((slot) => ({ side: attRef.side, slot })), isSpread: false, selfTarget: true };
    if (mv.tg === 3) {
      const allies = this.validAllyTargets(attRef);
      const picked = a.targetSide === attRef.side && allies.find((t) => t.slot === a.targetSlot);
      return { targets: [picked || allies[0] || attRef], isSpread: false, selfTarget: true };
    }
    if (mv.tg === 11) {
      const targets = this.validFoeTargets(attRef, mv);
      return { targets, isSpread: targets.length > 1, selfTarget: false };
    }
    if (mv.tg === 9) {
      const others = this.allAliveRefs().filter((t) => !(t.side === attRef.side && t.slot === attRef.slot) && this.isAdjacent(attRef, t));
      const targets = others.length ? others : this.validFoeTargets(attRef, mv);
      return { targets, isSpread: targets.length > 1, selfTarget: false };
    }
    const cands = this.validFoeTargets(attRef, mv);
    if (!cands.length) return { targets: [], isSpread: false, selfTarget: false };
    if (mv.tg === 8) return { targets: [cands[this.r(cands.length)]], isSpread: false, selfTarget: false };
    const picked = a.targetSide === opp && cands.find((t) => t.slot === a.targetSlot);
    return { targets: [picked || cands[0]], isSpread: false, selfTarget: false };
  }

  useMove(i, a, first) { return this.useMoveRef({ side: i, slot: 0 }, a, first ? null : new Set(['acted'])); }

  useMoveRef(attRef, a, actedSet) {
    const v = this.vol(attRef), m = this.act(attRef), mv = MOVES[a.id], x = mv.m || {};
    v.turns++; this.lastUser = attRef;
    const stop = () => { v.charge = null; v.rampage = null; if (v.invuln) { v.invuln = null; this.ev.push({ t: 'hide', side: attRef.side, slot: attRef.slot, on: false }); } };
    const boomOut = () => { if (x.boom && !isFainted(m)) this.hp(attRef, -m.hp); };

    if (m.status === 'frz') {
      if (this.r(5) === 0) { m.status = null; this.ev.push({ t: 'status', side: attRef.side, slot: attRef.slot, status: null }); this.say(`${this.Nm(attRef)} n'est plus gelé !`); }
      else { this.say(`${this.Nm(attRef)} est gelé !`); stop(); return; }
    }
    if (m.status === 'slp') {
      m.slp -= this.ab(attRef) === 'early-bird' ? 2 : 1;
      if (m.slp <= 0) { m.status = null; this.ev.push({ t: 'status', side: attRef.side, slot: attRef.slot, status: null }); this.say(`${this.Nm(attRef)} se réveille !`); }
      else { this.ev.push({ t: 'anim', side: attRef.side, slot: attRef.slot, k: 'sleep' }); this.say(`${this.Nm(attRef)} dort profondément.`); stop(); return; }
    }
    if (v.flinch && this.ab(attRef) !== 'inner-focus' && this.ab(attRef) !== 'coeur-vaillant') { this.say(`${this.Nm(attRef)} a peur ! Il ne peut pas attaquer !`); stop(); return; }
    if (v.conf > 0) {
      v.conf--;
      if (v.conf === 0) this.say(`${this.Nm(attRef)} n'est plus confus !`);
      else {
        this.ev.push({ t: 'anim', side: attRef.side, slot: attRef.slot, k: 'confused' });
        this.say(`${this.Nm(attRef)} est confus !`);
        if (this.r(2) === 0) {
          const atk = this.stat(attRef, 1), def = this.stat(attRef, 2);
          const dmg = Math.max(1, Math.floor(Math.floor(Math.floor(2 * m.lvl / 5 + 2) * 40 * atk / def) / 50) + 2);
          this.say('Il se blesse dans sa confusion !');
          this.ev.push({ t: 'hit', side: attRef.side, slot: attRef.slot, eff: 1 });
          this.hp(attRef, -dmg); stop(); return;
        }
      }
    }
    if (m.status === 'par' && this.r(4) === 0) { this.ev.push({ t: 'anim', side: attRef.side, slot: attRef.slot, k: 'para' }); this.say(`${this.Nm(attRef)} est paralysé ! Il n'a pas pu attaquer !`); stop(); return; }

    if (x.charge && v.charge !== mv.id && !(mv.key === 'solar-beam' && this.weather === 'sun')) {
      v.charge = mv.id;
      const slot = m.moves.findIndex((q) => q.id === mv.id); if (slot >= 0 && m.moves[slot].pp > 0) m.moves[slot].pp--;
      const txt = { 'solar-beam': 'absorbe la lumière !', 'razor-wind': 'se prépare !', 'sky-attack': 'est entouré d\'une lumière intense !', 'skull-bash': 'baisse la tête !', fly: 's\'envole !', dig: 's\'enfonce dans le sol !', dive: 'plonge !', bounce: 'saute très haut !' }[mv.key] || 'se concentre !';
      if (['fly', 'dig', 'dive', 'bounce'].includes(mv.key)) { v.invuln = mv.key; this.ev.push({ t: 'hide', side: attRef.side, slot: attRef.slot, on: true }); }
      if (mv.key === 'skull-bash') this.boost(attRef, 3, 1, true);
      this.say(`${this.Nm(attRef)} ${txt}`);
      return;
    }
    const charged = v.charge === mv.id; v.charge = null;
    if (v.invuln) { v.invuln = null; this.ev.push({ t: 'hide', side: attRef.side, slot: attRef.slot, on: false }); }

    if (this.ab(attRef) === 'truant') { v.loaf = !v.loaf; if (!v.loaf) { this.say(`${this.Nm(attRef)} paresse !`); return; } }
    const foePressure = this.aliveSlots(1 - attRef.side).some((sl) => this.ab({ side: 1 - attRef.side, slot: sl }) === 'pressure');
    if (!charged && !v.rampage && mv.id !== 165) {
      const mSlot = a.slot ?? m.moves.findIndex((q) => q.id === mv.id);
      if (mSlot >= 0 && m.moves[mSlot]) m.moves[mSlot].pp = Math.max(0, m.moves[mSlot].pp - (foePressure ? 2 : 1));
    }
    this.say(`${this.Nm(attRef)} utilise ${mv.n} !`);
    if (mv.id !== 165 && /^choice-/.test(m.item || '') && v.choice == null) v.choice = mv.id;
    if (mv.key === 'fake-out' && v.turns > 1) { this.say('Mais cela échoue !'); return; }
    if (mv.c === 'status' && m.item === 'assault-vest') { this.say(`La Veste de Combat empêche ${this.nm(attRef)} d'utiliser ${mv.n} !`); return; }
    if (x.rampage && !v.rampage) v.rampage = { id: mv.id, turns: 2 + this.r(2) };

    if (x.u === 'protect' || x.u === 'detect') {
      const ok = this.r(Math.pow(2, Math.min(4, v.protChain))) === 0;
      if (ok) { v.protect = true; v.protChain++; this.ev.push({ t: 'anim', side: attRef.side, slot: attRef.slot, k: 'protect' }); this.say(`${this.Nm(attRef)} se protège !`); }
      else { v.protChain = 0; this.say('Mais cela échoue !'); }
      return;
    }
    v.protChain = 0;

    const { targets, isSpread, selfTarget } = this.resolveTargets(attRef, a, mv);
    if (!selfTarget && !targets.length) { this.say('Mais il n\'y a pas de cible...'); return; }

    // Filtrage protection / esquive pour savoir qui est effectivement touché
    const hitTargets = [];
    for (const dRef of targets) {
      const T = this.act(dRef), tv = this.vol(dRef);
      if (!T || isFainted(T)) { if (!isSpread) this.say('Mais il n\'y a pas de cible...'); continue; }
      if (!selfTarget && tv.protect) { this.say(`${this.Nm(dRef)} se protège !`); if (!isSpread) v.rampage = null; continue; }
      if (!selfTarget && !this.hits(attRef, dRef, mv)) {
        this.say(`${this.Nm(attRef)} rate ${this.slots > 1 ? this.nm(dRef) : 'son attaque'} !`);
        if (!isSpread) v.rampage = null;
        if (['jump-kick', 'high-jump-kick'].includes(mv.key)) { this.say(`${this.Nm(attRef)} s'écrase au sol !`); this.hp(attRef, -Math.floor(m.stats[0] / 8)); }
        continue;
      }
      hitTargets.push(dRef);
    }
    if (!hitTargets.length) { boomOut(); return; }

    const type = this.moveType(attRef, mv);
    const primaryTgt = hitTargets[0];
    this.ev.push({
      t: 'move',
      side: attRef.side,
      slot: attRef.slot,
      targetSide: primaryTgt.side,
      targetSlot: primaryTgt.slot,
      targets: hitTargets.map((t) => ({ side: t.side, slot: t.slot })),
      move: mv.id,
      type,
    });

    if (!selfTarget && this.special(attRef, primaryTgt, mv)) { this.afterRampage(attRef); return; }
    if (mv.c === 'status' && x.u !== 'rest' && x.u !== 'belly-drum' && x.u !== 'reflect' && x.u !== 'light-screen' && x.u !== 'mist' && x.u !== 'safeguard' && x.u !== 'haze') {
      if (mv.tg === 4 || mv.tg === 7 || mv.tg === 12 || mv.tg === 13 || mv.tg === 14) {
        this.statusMove(attRef, primaryTgt, mv, hitTargets);
      } else {
        for (const dRef of hitTargets) {
          if (this.ab(dRef) === 'soundproof' && ['growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'uproar', 'hyper-voice', 'bug-buzz', 'perish-song', 'metal-sound', 'grass-whistle', 'echoed-voice', 'round', 'chatter', 'boomburst', 'disarming-voice', 'snarl', 'noble-roar', 'parting-shot'].includes(mv.key)) {
            this.say(`Anti-Bruit protège ${this.nm(dRef)} !`); continue;
          }
          this.statusMove(attRef, dRef, mv, [dRef]);
        }
      }
      return;
    }
    if (mv.c === 'status') { this.statusMove(attRef, primaryTgt, mv, hitTargets); return; }

    const spreadMul = isSpread && hitTargets.length > 1 ? 0.75 : 1;
    const SOUND_KEYS = ['growl', 'roar', 'sing', 'supersonic', 'screech', 'snore', 'uproar', 'hyper-voice', 'bug-buzz', 'perish-song', 'metal-sound', 'grass-whistle', 'echoed-voice', 'round', 'chatter', 'boomburst', 'disarming-voice', 'snarl', 'noble-roar', 'parting-shot'];

    for (const dRef of hitTargets) {
      if (isFainted(m)) break;
      const T = this.act(dRef), tv = this.vol(dRef);
      if (!T || isFainted(T)) continue;
      if (this.ab(dRef) === 'soundproof' && SOUND_KEYS.includes(mv.key)) { this.say(`Anti-Bruit protège ${this.nm(dRef)} !`); v.rampage = null; continue; }
      const tAb = getAbility(T);
      if (type === 'ground' && tAb?.id === 'levitate') { this.say(`Lévitation immunise ${this.nm(dRef)} contre les attaques Sol !`); v.rampage = null; continue; }
      if (type === 'water' && tAb?.id === 'water-absorb') { this.say(`Absorb-Eau absorbe l'attaque et soigne ${this.nm(dRef)} !`); this.hp(dRef, Math.floor(T.stats[0] / 4)); v.rampage = null; continue; }
      if (type === 'electric' && tAb?.id === 'volt-absorb') { this.say(`Absorb-Volt absorbe l'électricité et soigne ${this.nm(dRef)} !`); this.hp(dRef, Math.floor(T.stats[0] / 4)); v.rampage = null; continue; }
      if (type === 'fire' && tAb?.id === 'flash-fire') { this.say(`Torche absorbe les flammes et renforce ${this.nm(dRef)} !`); tv.flashFire = true; v.rampage = null; continue; }
      if (type === 'water' && tAb?.id === 'dry-skin') { this.say(`Peau Sèche absorbe l'eau et soigne ${this.nm(dRef)} !`); this.hp(dRef, Math.floor(T.stats[0] / 4)); v.rampage = null; continue; }
      const absorb = { 'storm-drain': ['water', 4], 'lightning-rod': ['electric', 4], 'motor-drive': ['electric', 6], 'sap-sipper': ['grass', 2] }[tAb?.id];
      if (absorb && absorb[0] === type) { this.say(`${tAb.name} attire l'attaque vers ${this.nm(dRef)} !`); this.lastUser = dRef; this.boost(dRef, absorb[1], 1, true); v.rampage = null; continue; }
      const eff = this.effOn(attRef, dRef, type);
      if (tAb?.id === 'wonder-guard' && eff <= 1 && this.fixedDamage(attRef, dRef, mv) == null) { this.say(`Garde Mystik protège ${this.nm(dRef)} !`); v.rampage = null; continue; }
      if (eff === 0) { this.say(`Ça n'affecte pas ${this.nm(dRef)}...`); v.rampage = null; continue; }
      if (this.fixedDamage(attRef, dRef, mv) === 0) { this.say('Mais cela échoue !'); continue; }
      if (x.cat === 9) {
        if (T.lvl > m.lvl || tAb?.id === 'sturdy') { this.say('Mais cela échoue !'); continue; }
        this.ev.push({ t: 'hit', side: dRef.side, slot: dRef.slot, eff: 2 });
        this.hp(dRef, -T.hp); this.say('K.O. en un coup !'); continue;
      }

      let hits = 1;
      if (x.h0) hits = x.h0 === x.h1 ? x.h0 : this.ab(attRef) === 'skill-link' ? x.h1 : x.h0 === 2 && x.h1 === 5 ? [2, 2, 2, 3, 3, 3, 4, 5][this.r(8)] : x.h0 + this.r(x.h1 - x.h0 + 1);
      let total = 0, n = 0;
      for (; n < hits; n++) {
        if (isFainted(T)) break;
        const noCrit = tAb?.id === 'battle-armor' || tAb?.id === 'shell-armor';
        const crit = !noCrit && this.r(24) < [1, 3, 6, 8, 12][Math.min(4, (x.crit || 0) + (this.ab(attRef) === 'super-luck' ? 1 : 0) + (m.item === 'scope-lens' ? 1 : 0))];
        let p = this.movePower(attRef, dRef, mv);
        if (tv.invuln === 'dig' && ['earthquake', 'magnitude'].includes(mv.key)) p *= 2;
        let dmg = this.fixedDamage(attRef, dRef, mv);
        if (dmg == null) {
          dmg = this.damageCore(attRef, dRef, mv, p, type, crit, (85 + this.r(16)) / 100);
          if (spreadMul < 1) dmg = Math.max(1, Math.floor(dmg * spreadMul));
        } else if (eff === 0) dmg = 0;
        if (x.u === 'false-swipe' && dmg >= T.hp) dmg = T.hp - 1;
        if (dmg > 0 && RESIST[T.item] === type && (eff > 1 || type === 'normal') && this.fixedDamage(attRef, dRef, mv) == null && this.ab(attRef) !== 'unnerve') {
          const k = T.item; T.item = null; dmg = Math.max(1, Math.floor(dmg / 2));
          this.say(`${this.Nm(dRef)} mange sa ${itemName(k)} : elle affaiblit l'attaque !`);
        }
        if (dmg >= T.hp && T.hp === T.stats[0]) {
          if (T.item === 'focus-sash') { dmg = T.hp - 1; T.item = null; this.say(`${this.Nm(dRef)} tient bon grâce à sa Ceinture Force !`); }
          else if (tAb?.id === 'sturdy') { dmg = T.hp - 1; this.say(`${this.Nm(dRef)} tient bon grâce à son talent Fermeté !`); }
        }
        dmg = Math.min(dmg, T.hp);
        this.ev.push({ t: 'hit', side: dRef.side, slot: dRef.slot, eff: this.fixedDamage(attRef, dRef, mv) != null ? 1 : eff, crit });
        this.hp(dRef, -dmg);
        tv.dmgTaken = { amount: dmg, c: mv.c };
        total += dmg;
        if (crit) {
          this.say('Coup critique !');
          if (tAb?.id === 'anger-point' && !isFainted(T)) {
            this.say(`Colérique de ${this.nm(dRef)} monte son Attaque au maximum !`);
            tv.st[1] = 6; this.ev.push({ t: 'stat', side: dRef.side, slot: dRef.slot, up: true, all: this.stages(), slots: this.allStages() });
          }
        }
      }
      if (this.fixedDamage(attRef, dRef, mv) == null) {
        if (eff > 1) this.say('C\'est super efficace !');
        else if (eff < 1) this.say('Ce n\'est pas très efficace...');
      }
      if (hits > 1) this.say(`Touché ${n} fois !`);
      const targetCanFlinch = actedSet ? !actedSet.has(refKey(dRef)) : true;
      if (m.item === 'shell-bell' && total > 0 && !isFainted(m) && m.hp < m.stats[0]) { this.hp(attRef, Math.max(1, Math.floor(total / 8))); this.say(`${this.Nm(attRef)} récupère des PV grâce au Grelot Coque !`); }
      if (m.item === 'kings-rock' && total > 0 && targetCanFlinch && !x.flinch && !isFainted(T) && this.r(10) === 0 && tAb?.id !== 'inner-focus' && tAb?.id !== 'coeur-vaillant') tv.flinch = true;
      if (x.drain > 0 && total > 0 && !isFainted(m)) { const h = Math.max(1, Math.floor(total * x.drain / 100 * (m.item === 'big-root' ? 1.3 : 1))); if (this.hp(attRef, h)) this.say(`${this.Nm(dRef)} a perdu de l'énergie !`); }
      if (x.drain < 0 && total > 0 && this.ab(attRef) !== 'rock-head' && this.ab(attRef) !== 'magic-guard') { this.hp(attRef, -Math.max(1, Math.floor(total * -x.drain / 100))); this.say(`${this.Nm(attRef)} est blessé par le contrecoup !`); }
      if (m.item === 'life-orb' && total > 0 && !isFainted(m) && this.ab(attRef) !== 'magic-guard') { this.hp(attRef, -Math.max(1, Math.floor(m.stats[0] / 10))); this.say(`L'Orbe Vie draine un peu d'énergie de ${this.nm(attRef)} !`); }
      if (mv.c === 'physical' && total > 0 && !isFainted(T)) {
        if (T.item === 'rocky-helmet') { this.hp(attRef, -Math.max(1, Math.floor(m.stats[0] / 6))); this.say(`Le Casque Brut de ${this.nm(dRef)} blesse ${this.nm(attRef)} !`); }
        if (tAb?.id === 'rough-skin') { this.hp(attRef, -Math.max(1, Math.floor(m.stats[0] / 8))); this.say(`La Peau Dure de ${this.nm(dRef)} blesse ${this.nm(attRef)} !`); }
        if (tAb?.id === 'static' && this.r(100) < 30) this.inflict(attRef, 'par', mv, true);
        if (tAb?.id === 'flame-body' && this.r(100) < 30) this.inflict(attRef, 'brn', mv, true);
        if (tAb?.id === 'cire-brulante') { this.say(`La Cire Brûlante de ${this.nm(dRef)} jaillit !`); if (this.r(100) < 30) this.inflict(attRef, 'brn', mv, true); this.lastUser = dRef; this.boost(attRef, 6, -1, true); }
        if (tAb?.id === 'poison-point' && this.r(100) < 30) this.inflict(attRef, 'psn', mv, true);
        if (tAb?.id === 'iron-barbs') { this.hp(attRef, -Math.max(1, Math.floor(m.stats[0] / 8))); this.say(`Épine de Fer de ${this.nm(dRef)} blesse ${this.nm(attRef)} !`); }
        if (tAb?.id === 'effect-spore' && this.r(100) < 30 && !SPECIES[m.sp].t.includes('grass')) this.inflict(attRef, ['psn', 'par', 'slp'][this.r(3)], mv, true);
        if (tAb?.id === 'gooey') { this.lastUser = dRef; this.boost(attRef, 6, -1, true); }
        if (tAb?.id === 'cute-charm' && this.r(100) < 30 && m.gender && T.gender && m.gender !== T.gender && !v.conf) { v.conf = 2 + this.r(4); this.say(`Joli Sourire de ${this.nm(dRef)} rend ${this.nm(attRef)} confus !`); }
        if (this.ab(attRef) === 'poison-touch' && this.r(100) < 30) this.inflict(dRef, 'psn', mv, true);
      }
      if (mv.c === 'physical' && total > 0 && isFainted(T) && tAb?.id === 'aftermath' && !isFainted(m)) { this.hp(attRef, -Math.max(1, Math.floor(m.stats[0] / 4))); this.say(`Boom Final de ${this.nm(dRef)} blesse ${this.nm(attRef)} !`); }
      if (total > 0 && isFainted(T) && this.ab(attRef) === 'moxie') this.boost(attRef, 2, 1, true);
      this.checkBerries(dRef);
      this.checkBerries(attRef);

      const ch = (c) => (this.ab(attRef) === 'serene-grace' ? c * 2 : c), noSec = this.ab(attRef) === 'sheer-force' || tAb?.id === 'shield-dust';
      if (!isFainted(T) && !noSec) {
        if (x.flinch && targetCanFlinch && this.r(100) < ch(x.flinch)) {
          if (tAb?.id !== 'inner-focus' && tAb?.id !== 'coeur-vaillant') { tv.flinch = true; if (tAb?.id === 'steadfast') { this.lastUser = dRef; this.boost(dRef, 6, 1, true); } }
        }
        if (x.ail && x.ailc && this.r(100) < ch(x.ailc)) this.inflict(dRef, x.ail, mv, true, attRef);
        if (x.st && x.stc && this.r(100) < ch(x.stc)) for (const [s, c] of x.st) this.boost(x.cat === 7 ? attRef : dRef, s, c, true);
      } else if (x.st && x.cat === 7 && x.stc && this.ab(attRef) !== 'sheer-force' && this.r(100) < ch(x.stc)) for (const [s, c] of x.st) this.boost(attRef, s, c, true);
      if (T.status === 'frz' && type === 'fire' && !isFainted(T)) { T.status = null; this.ev.push({ t: 'status', side: dRef.side, slot: dRef.slot, status: null }); this.say(`${this.Nm(dRef)} n'est plus gelé !`); }
    }

    if (mv.id === 165 && !isFainted(m)) { this.hp(attRef, -Math.max(1, Math.floor(m.stats[0] / 4))); this.say(`${this.Nm(attRef)} est blessé par le contrecoup !`); }
    if (x.boom || mv.key === 'final-gambit') this.hp(attRef, -m.hp);
    if (x.recharge) v.recharge = true;
    this.afterRampage(attRef);
  }

  afterRampage(ref) {
    const v = this.vol(ref); if (!v.rampage) return;
    v.rampage.turns--; if (v.rampage.turns <= 0) { v.rampage = null; if (!v.conf) { v.conf = 2 + this.r(4); this.say(`${this.Nm(ref)} est épuisé et devient confus !`); } }
  }

  hits(i, d, mv) {
    const tv = this.vol(d), iv = this.vol(i), x = mv.m || {};
    if (tv.invuln) {
      const ok = (tv.invuln === 'fly' || tv.invuln === 'bounce') ? ['thunder', 'gust', 'twister', 'sky-uppercut'].includes(mv.key) : tv.invuln === 'dig' ? ['earthquake', 'magnitude', 'fissure'].includes(mv.key) : ['surf', 'whirlpool'].includes(mv.key);
      if (!ok) return false;
    }
    if (x.cat === 9) return this.r(100) < 30 + (this.act(i).lvl - this.act(d).lvl);
    if (mv.a == null || x.sure) return true;
    const ai = this.ab(i), di = this.ab(d);
    if (ai === 'no-guard' || di === 'no-guard') return true;
    const s = Math.max(-6, Math.min(6, iv.st[6] - (ai === 'unaware' ? 0 : tv.st[7])));
    let acc = mv.a * accMul(s);
    if (ai === 'compound-eyes') acc *= 1.3;
    if (ai === 'hustle' && mv.c === 'physical') acc *= 0.8;
    if ((di === 'sand-veil' && this.weather === 'sandstorm') || (di === 'snow-cloak' && this.weather === 'hail')) acc *= 0.8;
    if (di === 'tangled-feet' && tv.conf) acc *= 0.5;
    if (di === 'wonder-skin' && mv.c === 'status') acc = Math.min(acc, 50);
    return this.r(100) < acc;
  }

  fixedDamage(i, d, mv) {
    const u = mv.m?.u, m = this.act(i), T = this.act(d);
    if (u === 'dragon-rage') return 40;
    if (u === 'sonic-boom') return 20;
    if (u === 'seismic-toss' || u === 'night-shade') return m.lvl;
    if (u === 'super-fang') return Math.max(1, Math.floor(T.hp / 2));
    if (u === 'psywave') return Math.max(1, Math.floor(m.lvl * (5 + this.r(11)) / 10));
    if (u === 'endeavor') return Math.max(0, T.hp - m.hp);
    if (u === 'counter' || u === 'mirror-coat') { const t = this.vol(i).dmgTaken; return t && t.c === (u === 'counter' ? 'physical' : 'special') ? t.amount * 2 : 0; }
    if (mv.key === 'metal-burst') { const t = this.vol(i).dmgTaken; return t ? Math.floor(t.amount * 1.5) : 0; }
    if (mv.key === 'final-gambit') return m.hp;
    return null;
  }

  special(attRef, dRef, mv) {
    const aR = this.norm(attRef), dR = this.norm(dRef);
    const u = mv.m?.u, m = this.act(aR), v = this.vol(aR), T = this.act(dR);
    if (!u) return false;
    switch (u) {
      case 'splash': this.say('Mais rien ne se passe !'); return true;
      case 'teleport': if (this.wild && aR.side === 0) { this.say(`${this.Nm(aR)} se téléporte !`); this.end('run'); } else if (this.wild) { this.say(`${this.Nm(aR)} se téléporte !`); this.end('fled'); } else this.say('Mais cela échoue !'); return true;
      case 'rest':
        if (m.hp >= m.stats[0]) { this.say('Mais cela échoue !'); return true; }
        m.status = 'slp'; m.slp = 3; this.ev.push({ t: 'status', side: aR.side, slot: aR.slot, status: 'slp' });
        this.hp(aR, m.stats[0]); this.say(`${this.Nm(aR)} s'endort et récupère ses PV !`); return true;
      case 'belly-drum':
        if (m.hp <= m.stats[0] / 2) { this.say('Mais cela échoue !'); return true; }
        this.hp(aR, -Math.floor(m.stats[0] / 2)); v.st[1] = 6; this.ev.push({ t: 'stat', side: aR.side, slot: aR.slot, up: true, all: this.stages(), slots: this.allStages() });
        this.say(`${this.Nm(aR)} sacrifie des PV et monte son Attaque au maximum !`); return true;
      case 'pain-split': { const avg = Math.floor((m.hp + T.hp) / 2); this.hp(aR, avg - m.hp); this.hp(dR, avg - T.hp); this.say('Les deux créatures partagent leur douleur !'); return true; }
      case 'haze': for (const s of this.sides) for (const vs of s.vs) vs.st = [0, 0, 0, 0, 0, 0, 0, 0]; this.ev.push({ t: 'stat', side: -1, all: this.stages(), slots: this.allStages() }); this.say('Les changements de stats sont annulés !'); return true;
      case 'reflect': case 'light-screen': {
        const k = u === 'reflect' ? 'reflect' : 'light', scr = this.sides[aR.side].screens;
        if (scr[k]) { this.say('Mais cela échoue !'); return true; }
        scr[k] = 5; this.say(u === 'reflect' ? 'Protection augmente la résistance aux attaques physiques !' : 'Mur Lumière augmente la résistance aux attaques spéciales !'); return true;
      }
      case 'mist': case 'safeguard': { const scr = this.sides[aR.side].screens; scr[u] = 5; this.say(u === 'mist' ? `${this.Nm(aR)} s'entoure de brume !` : `${this.Nm(aR)} est protégé par un voile mystique !`); return true; }
      case 'roar': case 'whirlwind':
        if (this.wild && this.slots === 1) { this.say(aR.side === 0 ? `${this.Nm(dR)} prend la fuite !` : 'Vous êtes renvoyé !'); this.end(aR.side === 0 ? 'win-flee' : 'fled'); }
        else this.say('Mais cela échoue !');
        return true;
      case 'present':
        if (this.r(5) === 0) { this.hp(dR, Math.floor(T.stats[0] / 4)); this.say(`${this.Nm(dR)} récupère des PV !`); return true; }
        return false;
      default: return false;
    }
  }

  statusMove(attRef, dRef, mv, multiTargets) {
    const aR = this.norm(attRef), dR = this.norm(dRef);
    const x = mv.m || {}, m = this.act(aR), T = this.act(dR);
    let did = false;
    if (x.cat === 3 || x.heal) {
      const target = mv.tg === 3 ? dR : aR, tm = this.act(target);
      if (tm.hp >= tm.stats[0]) { this.say('Mais ses PV sont déjà au maximum !'); return; }
      this.hp(target, Math.max(1, Math.floor(tm.stats[0] * (x.heal || 50) / 100))); this.say(`${this.Nm(target)} récupère des PV !`); return;
    }
    if (x.ail) {
      if (mv.key === 'thunder-wave' && SPECIES[T.sp].t.includes('ground')) { this.say(`Ça n'affecte pas ${this.nm(dR)}...`); return; }
      did = this.inflict(dR, x.ail, mv, false, aR) || did;
    }
    if (x.st) {
      const isSelf = mv.tg === 7 || (x.st.every(([, c]) => c > 0) && mv.tg !== 10 && mv.tg !== 11 && mv.tg !== 13 && mv.tg !== 14);
      const tgtList = isSelf ? [aR] : (multiTargets || [dR]);
      for (const t of tgtList) for (const [s, c] of x.st) did = this.boost(t, s, c, false) || did;
    }
    if (!x.ail && !x.st) this.say('Mais cela échoue !');
  }

  inflict(dRef, ail, mv, secondary, srcRef) {
    const dR = this.norm(dRef), T = this.act(dR), tv = this.vol(dR);
    const fail = () => { if (!secondary) this.say('Mais cela échoue !'); return false; };
    if (!T || isFainted(T)) return false;
    const types = SPECIES[T.sp].t, scr = this.sides[dR.side].screens, tid = this.ab(dR);
    if (ail === 'conf' && tid === 'own-tempo') return fail();
    if (ail === 'conf') {
      if (tv.conf) { if (!secondary) this.say(`${this.Nm(dR)} est déjà confus !`); return false; }
      tv.conf = 2 + this.r(4); this.ev.push({ t: 'anim', side: dR.side, slot: dR.slot, k: 'confused' }); this.say(`${this.Nm(dR)} devient confus !`); return true;
    }
    if (ail === 'seed') {
      if (types.includes('grass') || tv.seed) return fail();
      const healer = srcRef ? this.norm(srcRef) : { side: 1 - dR.side, slot: 0 };
      tv.seed = healer; this.say(`${this.Nm(dR)} est infecté !`); return true;
    }
    if (ail === 'trap') {
      if (!tv.trap) { tv.trap = { t: 4 + this.r(2), by: srcRef ? refKey(this.norm(srcRef)) : null }; this.say(`${this.Nm(dR)} est pris au piège !`); }
      return true;
    }
    let st = ail;
    if (ail === 'psn' && mv.key === 'toxic') st = 'tox';
    if (T.status) { if (!secondary) this.say(T.status === st ? `${this.Nm(dR)} ${STATUS_TXT[st].replace(/^est /, 'est déjà ').replace(/^s'est endormi/, 'dort déjà')}` : 'Mais cela échoue !'); return false; }
    if (scr.safeguard) return fail();
    if ((st === 'psn' || st === 'tox') && (types.includes('poison') || types.includes('steel'))) return fail();
    if (st === 'brn' && types.includes('fire')) return fail();
    if (st === 'par' && types.includes('electric')) return fail();
    if (st === 'frz' && types.includes('ice')) return fail();
    const immune = { limber: ['par'], insomnia: ['slp'], 'vital-spirit': ['slp'], immunity: ['psn', 'tox'], 'water-veil': ['brn'], 'magma-armor': ['frz'] }[tid];
    if ((immune && immune.includes(st)) || (tid === 'leaf-guard' && this.weather === 'sun')) { if (!secondary) this.say(`${getAbility(T).name} protège ${this.nm(dR)} !`); return false; }
    T.status = st;
    if (st === 'slp') T.slp = 2 + this.r(4);
    if (st === 'tox') T.tox = 0;
    this.ev.push({ t: 'status', side: dR.side, slot: dR.slot, status: st });
    this.say(`${this.Nm(dR)} ${STATUS_TXT[st]}`);
    if (st === 'slp') tv.rampage = null;
    if (tid === 'synchronize' && ['psn', 'tox', 'par', 'brn'].includes(st) && !this._sync) {
      const src = srcRef ? this.norm(srcRef) : { side: 1 - dR.side, slot: 0 };
      const sm = this.act(src);
      if (sm && !isFainted(sm) && !sm.status) { this._sync = true; this.say(`Synchro de ${this.nm(dR)} s'active !`); this.inflict(src, st === 'tox' ? 'psn' : st, mv, true); this._sync = false; }
    }
    return true;
  }

  boost(ref, sid, c, secondary) {
    const r = this.norm(ref), v = this.vol(r), m = this.act(r), s = sid - 1, id = this.ab(r);
    if (!m || isFainted(m)) return false;
    const lu = this.lastUser ? this.norm(this.lastUser) : null;
    const byFoe = c < 0 && (!lu || lu.side !== r.side || lu.slot !== r.slot);
    if (c < 0 && this.sides[r.side].screens.mist && byFoe) { if (!secondary) this.say(`${this.Nm(r)} est protégé par la brume !`); return false; }
    if (byFoe && (id === 'clear-body' || id === 'white-smoke' || (id === 'hyper-cutter' && s === 1) || (id === 'coeur-vaillant' && s === 1) || (id === 'keen-eye' && s === 6) || (id === 'big-pecks' && s === 2))) {
      if (!secondary || sid === 2) this.say(`${getAbility(m).name} de ${this.nm(r)} empêche la baisse !`); return false;
    }
    if (id === 'simple') c *= 2;
    if (id === 'contrary') c = -c;
    const before = v.st[s];
    v.st[s] = Math.max(-6, Math.min(6, v.st[s] + c));
    const name = STAGE_NAMES[s];
    if (v.st[s] === before) { if (!secondary) this.say(`${name[0].toUpperCase() + name.slice(1)} de ${this.nm(r)} ne peut plus ${c > 0 ? 'augmenter' : 'baisser'} !`); return false; }
    this.ev.push({ t: 'stat', side: r.side, slot: r.slot, up: c > 0, all: this.stages(), slots: this.allStages() });
    const amt = Math.abs(c) >= 2 ? 'beaucoup ' : '';
    this.say(`${name[0].toUpperCase() + name.slice(1)} de ${this.nm(r)} ${c > 0 ? 'augmente' : 'baisse'}${amt ? ' ' + amt.trim() : ''} !`);
    if (c < 0 && m.item === 'white-herb') {
      for (let k = 0; k < v.st.length; k++) if (v.st[k] < 0) v.st[k] = 0;
      m.item = null; this.ev.push({ t: 'stat', side: r.side, slot: r.slot, up: true, all: this.stages(), slots: this.allStages() });
      this.say(`${this.Nm(r)} utilise son Herbe Blanche : ses stats reviennent à la normale !`);
    }
    if (byFoe && c < 0 && (id === 'defiant' || id === 'competitive') && !this._defiant) {
      this._defiant = true; this.say(`${getAbility(m).name} de ${this.nm(r)} s'active !`);
      this.boost(r, id === 'defiant' ? 2 : 4, 2, true); this._defiant = false;
    }
    return true;
  }

  eotOrder() { return [0, 1]; }
  endOfTurn() {
    for (const i of this.eotOrder()) {
      for (let slot = 0; slot < this.slots; slot++) {
        const ref = { side: i, slot }, m = this.act(ref), v = this.vol(ref);
        v.protect = false;
        if (!m || isFainted(m)) continue;
        const ab = getAbility(m), mg = ab?.id === 'magic-guard';
        if (ab?.id === 'poison-heal' && (m.status === 'psn' || m.status === 'tox')) {
          if (m.hp < m.stats[0]) { this.hp(ref, Math.max(1, Math.floor(m.stats[0] / 8))); this.say(`Soin Poison soigne ${this.nm(ref)} !`); }
        } else if (mg) { /* Garde Magik */ }
        else if (m.status === 'brn') { this.ev.push({ t: 'anim', side: i, slot, k: 'burn' }); this.say(`${this.Nm(ref)} souffre de sa brûlure !`); this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 8))); }
        else if (m.status === 'psn') { this.ev.push({ t: 'anim', side: i, slot, k: 'poison' }); this.say(`${this.Nm(ref)} souffre du poison !`); this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 8))); }
        else if (m.status === 'tox') { m.tox = Math.min(15, (m.tox || 0) + 1); this.ev.push({ t: 'anim', side: i, slot, k: 'poison' }); this.say(`${this.Nm(ref)} souffre du poison !`); this.hp(ref, -Math.max(1, Math.floor(m.stats[0] * m.tox / 16))); }
        if (isFainted(m)) continue;
        if (v.seed && !mg) {
          const healer = typeof v.seed === 'object' ? v.seed : { side: 1 - i, slot: 0 };
          if (!isFainted(this.act(healer))) {
            const dmg = this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 8)));
            this.ev.push({ t: 'anim', side: i, slot, k: 'seed' }); this.say(`Vampigraine draine l'énergie de ${this.nm(ref)} !`);
            this.hp(healer, dmg);
          }
        }
        if (isFainted(m)) continue;
        const trapN = typeof v.trap === 'object' ? v.trap.t : v.trap;
        if (trapN > 0) {
          const nt = trapN - 1;
          v.trap = typeof v.trap === 'object' ? (nt ? { ...v.trap, t: nt } : 0) : nt;
          this.say(`${this.Nm(ref)} est blessé par le piège !`); this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 16)));
          if (!v.trap) this.say(`${this.Nm(ref)} est libéré !`);
        }
        if (isFainted(m)) continue;
        if (m.item === 'black-sludge') {
          if (SPECIES[m.sp].t.includes('poison')) { if (m.hp < m.stats[0]) { this.hp(ref, Math.max(1, Math.floor(m.stats[0] / 16))); this.say(`${this.Nm(ref)} récupère un peu de PV grâce à sa Boue Noire !`); } }
          else if (this.ab(ref) !== 'magic-guard') { this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 8))); this.say(`${this.Nm(ref)} est blessé par la Boue Noire !`); if (isFainted(m)) continue; }
        }
        if (m.item === 'leftovers' && m.hp < m.stats[0]) { this.hp(ref, Math.max(1, Math.floor(m.stats[0] / 16))); this.say(`${this.Nm(ref)} récupère un peu de PV grâce à ses Restes !`); }
        const wImm = ['magic-guard', 'overcoat'].includes(ab?.id);
        if (this.weather === 'sandstorm' && !wImm && !['sand-veil', 'sand-rush', 'sand-force'].includes(ab?.id)) {
          const types = SPECIES[m.sp]?.t || [];
          if (!types.includes('rock') && !types.includes('ground') && !types.includes('steel')) { this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 16))); this.say(`${this.Nm(ref)} est blessé par la tempête de sable !`); }
        } else if (this.weather === 'hail' && !wImm && !['ice-body', 'snow-cloak'].includes(ab?.id)) {
          const types = SPECIES[m.sp]?.t || [];
          if (!types.includes('ice')) { this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 16))); this.say(`${this.Nm(ref)} est blessé par la grêle !`); }
        }
        if (ab?.id === 'speed-boost' && !isFainted(m)) this.boost(ref, 6, 1, true);
        if (!isFainted(m)) {
          const heal = (f, txt) => { if (m.hp < m.stats[0]) { this.hp(ref, Math.max(1, Math.floor(m.stats[0] * f))); this.say(txt); } };
          const w = this.weather;
          if (ab?.id === 'rain-dish' && w === 'rain') heal(1 / 16, `Cuvette soigne ${this.nm(ref)} !`);
          if (ab?.id === 'ice-body' && w === 'hail') heal(1 / 16, `Corps Gel soigne ${this.nm(ref)} !`);
          if (ab?.id === 'dry-skin' && w === 'rain') heal(1 / 8, `Peau Sèche soigne ${this.nm(ref)} !`);
          if ((ab?.id === 'dry-skin' || ab?.id === 'solar-power') && w === 'sun') { this.hp(ref, -Math.max(1, Math.floor(m.stats[0] / 8))); this.say(`${this.Nm(ref)} souffre du soleil !`); }
          const cure = (ab?.id === 'shed-skin' && this.r(100) < 30) || (ab?.id === 'hydration' && w === 'rain');
          if (cure && m.status && !isFainted(m)) { m.status = null; m.slp = 0; m.tox = 0; this.ev.push({ t: 'status', side: i, slot, status: null }); this.say(`${getAbility(m).name} guérit ${this.nm(ref)} !`); }
        }
        this.checkBerries(ref);
      }
    }
    if (this.weatherTurns > 0) {
      this.weatherTurns--;
      if (this.weatherTurns === 0 && this.weather !== 'none') {
        const back = this.baseWeather !== this.weather && !this.baseWeatherTurns ? this.baseWeather : 'none';
        this.setWeather(back, 0);
      }
    }
    for (const s of this.sides) for (const k of Object.keys(s.screens)) { s.screens[k]--; if (s.screens[k] <= 0) { delete s.screens[k]; this.say(k === 'reflect' ? 'L\'effet de Protection prend fin.' : k === 'light' ? 'L\'effet de Mur Lumière prend fin.' : k === 'mist' ? 'La brume se dissipe.' : 'Le voile mystique disparaît.'); } }
    this.checkFaints(false);
  }

  /** gère les K.O. (en 1v1 stoppe le tour dès le K.O., en 2v2/3v3 laisse finir le tour sauf si un camp entier est K.O.) */
  checkFaints(midTurn = false) {
    let stop = false;
    for (let slot = 0; slot < this.slots; slot++) {
      const foe = this.monAt(1, slot);
      if (foe && isFainted(foe) && !foe._ko) {
        foe._ko = true;
        this.ev.push({ t: 'faint', side: 1, slot });
        this.say(`${this.Nm({ side: 1, slot })} est K.O. !`);
        this.awardExp(foe);
        stop = true;
      }
    }
    for (let slot = 0; slot < this.slots; slot++) {
      const me = this.monAt(0, slot);
      if (me && isFainted(me) && !me._ko) {
        me._ko = true;
        this.ev.push({ t: 'faint', side: 0, slot });
        this.say(`${monName(me)} est K.O. !`);
        stop = true;
      }
    }
    const foeLeft = this.sides[1].party.some((m) => m.hp > 0), meLeft = this.sides[0].party.some((m) => m.hp > 0);
    if (!meLeft) { this.loseBattle(); return true; }
    if (!foeLeft) { this.winBattle(); return true; }

    if (this.slots === 1) {
      if (!stop) return false;
      if (isFainted(this.foe)) {
        const tr = this.sides[1].trainer;
        const aliveFoes = this.sides[1].party.filter((m) => m.hp > 0).length;
        if (tr && (tr.leader != null || tr.champion || tr.cls === 'Champion') && aliveFoes === 1 && !this.gymCrisisTriggered) {
          this.gymCrisisTriggered = true;
          this.ev.push({ t: 'gym-tension', foe: this.sides[1].party.find((m) => m.hp > 0), trainer: tr });
          this.say(`${tr.name} : « C'est mon dernier partenaire... Mais notre volonté est inébranlable ! »`);
        }
        const side = this.sides[1], idx = side.party.findIndex((m) => m.hp > 0);
        if (isFainted(this.me)) { this.state = 'switch'; this.pendingFoe = idx; this.ev.push({ t: 'switch-prompt' }); return true; }
        this.doSwitch(1, idx, true);
      }
      if (isFainted(this.me)) { this.state = 'switch'; this.ev.push({ t: 'switch-prompt' }); }
      return true;
    }

    // 2v2 / 3v3 : on ne remplit les emplacements K.O. qu'en fin de tour
    if (midTurn) return false;

    const emptyFoeSlots = [], emptyMeSlots = [];
    for (let sl = 0; sl < this.slots; sl++) {
      const f = this.monAt(1, sl), m = this.monAt(0, sl);
      if (f && isFainted(f)) emptyFoeSlots.push(sl);
      if (m && isFainted(m)) emptyMeSlots.push(sl);
    }
    const foeBench = this.sides[1].party.map((q, j) => (q && q.hp > 0 && !this.sides[1].activeSlots.includes(j) ? j : -1)).filter((j) => j >= 0);
    const meBench = this.sides[0].party.map((q, j) => (q && q.hp > 0 && !this.sides[0].activeSlots.includes(j) ? j : -1)).filter((j) => j >= 0);

    const pendingFoe = [];
    for (const sl of emptyFoeSlots) {
      if (foeBench.length) {
        const idx = foeBench.shift();
        this.doSwitchSlot(1, sl, idx, true, false);
        pendingFoe.push({ side: 1, slot: sl });
      } else {
        this.sides[1].activeSlots[sl] = -1;
      }
    }
    const tr = this.sides[1].trainer;
    const aliveFoes = this.sides[1].party.filter((m) => m.hp > 0).length;
    if (emptyFoeSlots.length && tr && (tr.leader != null || tr.champion || tr.cls === 'Champion') && aliveFoes === 1 && !this.gymCrisisTriggered) {
      this.gymCrisisTriggered = true;
      this.ev.push({ t: 'gym-tension', foe: this.sides[1].party.find((m) => m.hp > 0), trainer: tr });
      this.say(`${tr.name} : « C'est mon dernier partenaire... Mais notre volonté est inébranlable ! »`);
    }

    const needMe = [];
    for (const sl of emptyMeSlots) {
      if (needMe.length < meBench.length) needMe.push(sl);
      else this.sides[0].activeSlots[sl] = -1;
    }
    if (needMe.length) {
      this.needPlayerSlots = needMe;
      this.pendingFoeSlots = pendingFoe;
      this.state = 'switch';
      this.ev.push({ t: 'switch-prompt', slots: [...needMe] });
      return true;
    }
    if (pendingFoe.length) {
      for (const r of this.sortBySpeed(pendingFoe)) this.triggerEntry(r);
    }
    return false;
  }

  awardExp(foe) {
    const S = SPECIES[foe.sp], party = this.sides[0].party;
    const ps = party.filter((m) => this.participants.has(m.uid) && m.hp > 0);
    if (!ps.length) return;
    const base = Math.floor(((this.wild ? 1 : 1.5) * S.xp * foe.lvl) / (7 * ps.length));
    for (const m of ps) {
      const idx = party.indexOf(m), slot = this.sides[0].activeSlots.indexOf(idx);
      gainEffort(m, foe.sp);
      if (m.lvl >= 100) continue;
      if (m.lvl >= this.cap) {
        if (!this.capDit) { this.capDit = true; this.say(`${monName(m)} a atteint la limite de niveau actuelle (N.${this.cap}) !`); }
        continue;
      }
      const amount = Math.max(1, base), lv0 = m.lvl, p0 = this.expFrac(m);
      const steps = gainExp(m, amount, this.cap);
      this.say(`${monName(m)} gagne ${amount} points d'Exp. !`);
      this.ev.push({ t: 'exp', idx, slot, from: p0, lv0, to: this.expFrac(m), lv: m.lvl, active: slot >= 0 });
      for (const st of steps) {
        this.levelUps.add(m.uid);
        this.ev.push({ t: 'level', idx, slot, lvl: st.lvl, before: st.before, after: st.after, hp: m.hp, active: slot >= 0 });
        this.say(`${monName(m)} monte au niveau ${st.lvl} !`);
        for (const id of st.learned) { this.ev.push({ t: 'sfx', k: 'learn' }); this.say(`${monName(m)} apprend ${MOVES[id].n} !`); }
        for (const id of st.ask) this.ev.push({ t: 'ask-learn', idx, move: id });
      }
      if (m.lvl >= this.cap && steps.length) this.say(`${monName(m)} atteint la limite de niveau actuelle (N.${this.cap}) !`);
    }
  }
  expFrac(m) { return expProgress(m, this.cap); }

  winBattle() {
    const t = this.sides[1].trainer;
    if (t) {
      this.ev.push({ t: 'trainer-back' });
      this.say(`Vous avez battu ${t.cls} ${t.name} !`);
      if (t.lose) for (const l of [].concat(t.lose)) this.ev.push({ t: 'msg', text: l, speaker: t.name });
      const last = this.sides[1].party[this.sides[1].party.length - 1];
      this.prizeMoney = (t.prize || 20) * last.lvl * (this.slots > 1 ? this.slots : 1);
      this.say(`Vous remportez ${this.prizeMoney} ₽ !`);
    }
    this.end('win');
  }
  loseBattle() {
    this.say('Vous n\'avez plus de créature en forme !');
    if (!this.sides[1].trainer?.friendly) this.say('Vous êtes pris de panique et perdez connaissance...');
    this.end('lose');
  }
  end(result) {
    this.state = 'over'; this.result = result;
    for (const s of this.sides) revertMegas(s.party);
    for (const s of this.sides) for (const m of s.party) delete m._ko;
    for (const m of this.sides[0].party) if (m.status === 'tox') m.status = 'psn';
    this.ev.push({ t: 'end', result });
  }
}
