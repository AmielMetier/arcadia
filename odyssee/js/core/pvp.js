// odyssee/js/core/pvp.js — combat entre deux joueurs (1v1, 2v2, 3v3), et échanges.
//
// Combat : les deux joueurs font tourner exactement le même combat, chacun de son point de vue
// (lui en côté 0, l'adversaire en côté 1), avec le même générateur aléatoire à graine. Ils ne s'envoient
// que leurs choix (attaque, changement) : chaque écran calcule donc le même tour. Une empreinte de l'état,
// jointe à chaque choix, vérifie que les deux combats restent identiques.
// Combat amical : on se bat avec des copies soignées de ses Pokémon, sans expérience, ni argent, ni objets.

import { Battle } from './battle.js';
import { SPECIES } from '../data/species.js';
import { MOVES } from '../data/moves.js';
import { monName, isFainted, healFull } from './mon.js';
import { seededRng } from '../net/link.js';

/** copie d'une équipe pour un combat amical : PV, PP et statuts remis à neuf */
export function battleCopy(party) {
  return party.map((m) => {
    const c = JSON.parse(JSON.stringify(m));
    healFull(c);
    delete c._ko;
    return c;
  });
}

/** un Pokémon reçu d'un autre joueur est-il lisible ? (évite qu'un message abîmé fasse planter le jeu) */
export function validMon(m) {
  if (!m || typeof m !== 'object' || !SPECIES[m.sp]) return false;
  if (!Number.isInteger(m.lvl) || m.lvl < 1 || m.lvl > 100) return false;
  if (!Array.isArray(m.stats) || m.stats.length !== 6 || !m.stats.every((x) => Number.isFinite(x) && x > 0)) return false;
  if (!Array.isArray(m.iv) || m.iv.length !== 6) return false;
  if (!Array.isArray(m.moves) || !m.moves.length || m.moves.length > 4 || !m.moves.every((x) => x && MOVES[x.id] && Number.isFinite(x.pp))) return false;
  return Number.isFinite(m.hp);
}
export const validParty = (p) => Array.isArray(p) && p.length >= 1 && p.length <= 6 && p.every(validMon);

// Évolutions par échange (Kadabra, Machopeur, Gravalanch, Spectrum)
export const TRADE_EVO = { 64: 65, 67: 68, 75: 76, 93: 94 };

export class PvpBattle extends Battle {
  /**
   * @param o.me     { name, party }               son équipe (copie)
   * @param o.foe    { name, party, bs }           l'équipe de l'adversaire (copie reçue), bs = sprite de dresseur
   * @param o.seed   graine commune
   * @param o.canon  index local du côté de celui qui a lancé le défi (0 pour lui, 1 pour l'autre)
   * @param o.format 'single' | 'double' | 'triple'
   */
  constructor(o) {
    super({
      player: { name: o.me.name, party: o.me.party, bag: {} },
      foe: { name: o.foe.name, party: o.foe.party, trainer: { cls: 'Dresseur', name: o.foe.name, bs: o.foe.bs, prize: 0 } },
      rng: seededRng(o.seed),
      format: o.format,
      slots: o.slots,
    });
    this.pvp = true;
    this.sides[0].mega = this.sides[1].mega = true;
    this.canon = o.canon;
    this.remote = null;
    this.need = [false, false];
    this.needSlots = [[], []];
  }

  eotOrder() { return [this.canon, 1 - this.canon]; }
  tie(p, q) {
    const ps = p.i ?? p.side, qs = q?.i ?? q?.side;
    if (qs != null && ps === qs) return (p.slot ?? 0) - (q.slot ?? 0);
    const first = this.rng() < 0.5 ? this.canon : 1 - this.canon;
    return ps === first ? -1 : 1;
  }

  _remoteFor(slot = 0) {
    if (Array.isArray(this.remote)) return this.remote.find((x) => x && x.slot === slot) ?? this.remote[slot] ?? { type: 'move', idx: 0 };
    return this.remote || { type: 'move', idx: 0 };
  }
  foeWantsMega(b, slot = 0) {
    const r = this._remoteFor(slot);
    return b?.type === 'move' && !!r?.mega && this.canMega({ side: 1, slot });
  }
  foeChoose() { return this.foeChooseSlot(0); }
  foeChooseAll() {
    return this.aliveSlots(1).map((sl) => ({ i: 1, side: 1, slot: sl, a: this.foeChooseSlot(sl) }));
  }
  foeChooseSlot(slot = 0) {
    const ref = { side: 1, slot };
    const forced = this.forcedAction(ref); if (forced) return forced;
    const a = this._remoteFor(slot);
    const m = this.act(ref);
    if (a.type === 'switch' && this.sides[1].party[a.idx] && this.sides[1].party[a.idx].hp > 0 && !this.sides[1].activeSlots.includes(a.idx)) {
      return { type: 'switch', idx: a.idx };
    }
    if (!this.usableMoves(ref).length) return { type: 'move', id: 165 };
    const k = Number.isInteger(a.idx) && m.moves[a.idx]?.pp > 0 ? a.idx : this.usableMoves(ref)[0];
    // côté distant : side 1 pour lui correspond au côté joueur local (0) et vice versa
    const targetSide = a.targetSide != null ? (1 - a.targetSide) : 0;
    const targetSlot = Number.isInteger(a.targetSlot) ? a.targetSlot : 0;
    return { type: 'move', id: m.moves[k].id, slot: k, targetSide, targetSlot };
  }

  awardExp() { /* combat amical : pas d'expérience */ }

  checkFaints(midTurn = false) {
    let stop = false;
    for (const i of [1, 0]) {
      for (let slot = 0; slot < this.slots; slot++) {
        const m = this.monAt(i, slot);
        if (m && isFainted(m) && !m._ko) {
          m._ko = true;
          this.ev.push({ t: 'faint', side: i, slot });
          this.say(`${i === 1 ? this.Nm({ side: 1, slot }) : monName(m)} est K.O. !`);
          stop = true;
        }
      }
    }
    const left = (i) => this.sides[i].party.some((m) => m.hp > 0);
    if (!left(0) && !left(1)) { this.say('Les deux dresseurs n\'ont plus de Pokémon en forme !'); this.end('draw'); return true; }
    if (!left(0)) { this.loseBattle(); return true; }
    if (!left(1)) { this.winBattle(); return true; }

    if (this.slots === 1) {
      if (midTurn) return stop;
      const n0 = isFainted(this.act(0)), n1 = isFainted(this.act(1));
      if (!n0 && !n1) return false;
      this.need = [n0, n1];
      this.needSlots = [n0 ? [0] : [], n1 ? [0] : []];
      this.state = 'switch';
      this.ev.push({ t: 'switch-prompt' });
      return true;
    }

    if (midTurn) return false;
    const ns = [[], []];
    for (const i of [0, 1]) {
      const benchCount = this.sides[i].party.filter((m, idx) => m && m.hp > 0 && !this.sides[i].activeSlots.includes(idx)).length;
      for (let sl = 0; sl < this.slots; sl++) {
        const m = this.monAt(i, sl);
        if (m && isFainted(m)) {
          if (ns[i].length < benchCount) ns[i].push(sl);
          else this.sides[i].activeSlots[sl] = -1;
        }
      }
    }
    if (!ns[0].length && !ns[1].length) return false;
    this.needSlots = ns;
    this.need = [ns[0].length > 0, ns[1].length > 0];
    this.state = 'switch';
    this.ev.push({ t: 'switch-prompt', slots: ns[0] });
    return true;
  }

  switchBoth(mine, theirs) {
    if (this.state !== 'switch') return [];
    this.ev = [];
    const pick = { 0: Array.isArray(mine) ? mine : [mine], 1: Array.isArray(theirs) ? theirs : [theirs] };
    const switched = [];
    for (const i of [this.canon, 1 - this.canon]) {
      const slotsNeed = this.needSlots[i].length ? this.needSlots[i] : (this.need[i] ? [0] : []);
      if (!slotsNeed.length) continue;
      const party = this.sides[i].party;
      for (let k = 0; k < slotsNeed.length; k++) {
        const sl = slotsNeed[k];
        let idx = pick[i][k];
        if (idx == null || !party[idx] || party[idx].hp <= 0 || this.sides[i].activeSlots.includes(idx)) {
          idx = party.findIndex((m, j) => m && m.hp > 0 && !this.sides[i].activeSlots.includes(j));
        }
        if (idx >= 0) {
          this.doSwitchSlot(i, sl, idx, true, false);
          switched.push({ side: i, slot: sl });
        } else {
          this.sides[i].activeSlots[sl] = -1;
        }
      }
    }
    this.need = [false, false];
    this.needSlots = [[], []];
    if (switched.length) {
      for (const s of this.sortBySpeed(switched)) this.triggerEntry(s);
    }
    if (!this.checkFaints()) this.state = 'choose';
    return this.flush();
  }

  winBattle() {
    this.ev.push({ t: 'trainer-back' });
    this.say(`Tu as battu ${this.sides[1].name} !`);
    this.end('win');
  }
  loseBattle() {
    this.say('Tu n\'as plus de Pokémon en forme !');
    this.say(`${this.sides[1].name} remporte le combat !`);
    this.end('lose');
  }
  stop(result, text) {
    this.ev = [];
    if (text) this.say(text);
    this.end(result);
    return this.flush();
  }

  checksum() {
    const parts = [];
    for (const i of [this.canon, 1 - this.canon]) {
      const s = this.sides[i];
      parts.push(...s.activeSlots, ...s.party.map((m) => `${m.hp}${(m.status === 'tox' ? 'psn' : m.status) || ''}`), ...s.vs.map((v) => v.st.join('')));
    }
    parts.push(this.turn);
    let h = 0x811c9dc5;
    const str = parts.join('|');
    for (let k = 0; k < str.length; k++) { h ^= str.charCodeAt(k); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16);
  }
}
