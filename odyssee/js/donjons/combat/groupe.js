// odyssee/js/donjons/combat/groupe.js — combat de groupe (sans DOM ni réseau, testé sous Node) : n joueurs, un Pokémon en
// jeu chacun, contre un dresseur (ou un couple) qui a n Pokémon en jeu à la fois et une réserve commune.
// Sert aux couples de la Pyramide (2 contre 2) et aux sentinelles des Trois Voies (3 contre 3).
//
// Comme le combat contre un boss (raid.js) : un combat d'Odyssée à deux camps par joueur. Le camp adverse de chaque
// joueur est l'emplacement qu'il vise, qu'on branche juste avant d'agir ; chaque emplacement adverse vise un
// joueur tiré au sort. Quand un Pokémon adverse est K.O., le suivant de la réserve prend sa place (un Pokémon marqué
// `attend` n'entre que quand tous les autres sont K.O. ; `blocs` : barre de vie à blocs, combat/regles.js).
import { Battle } from '../../core/battle.js';
import { MOVES } from '../../data/moves.js';
import { monName, isFainted } from '../../core/mon.js';
import { deNom, cote } from './raid.js';

class Manche extends Battle {
  constructor(g, j, rng) {
    super({ player: { name: j.nom, party: j.party, bag: {} }, foe: { name: g.dresseur.name, party: g.reserve, trainer: g.dresseur }, rng });
    this.g = g; this.pid = j.id; this.joueur = j;
  }
  // le moteur désigne un Pokémon par son camp ou par { side, slot } : un seul emplacement ici
  nm(ref) { const i = cote(ref), m = this.act(i); return i === 1 ? monName(m) : `${monName(m)} ${deNom(this.joueur.nom)}`; }
  /** un joueur qui tient plusieurs places : on ne rappelle pas un Pokémon déjà en jeu à une autre place */
  canSwitchTo(idx) { return super.canSwitchTo(idx) && !this.g.enJeuAilleurs(this.joueur, idx); }
  /** réserve adverse gérée par Groupe.places/envoyes ; côté joueur, ne rappelle jamais un Pokémon déjà en jeu ailleurs */
  roarBench(side, slot) {
    if (side === 1) return [];
    return super.roarBench(0, slot).filter((idx) => this.canSwitchTo(idx));
  }
  tie() { return this.rng() < 0.5 ? -1 : 1; }
  awardExp() {}
  /** l'IA d'Odyssée peut changer de Pokémon ou prendre un objet : ici, l'adversaire attaque toujours */
  choixAdverse() {
    const a = this.foeChoose();
    if (a && (a.type === 'move' && a.id != null || a.type === 'recharge')) return a;
    const u = this.usableMoves(1);
    return u.length ? { type: 'move', id: this.act(1).moves[u[0]].id, slot: u[0] } : { type: 'move', id: 165 };
  }
  checkFaints() {
    let ko = false;
    const f = this.act(1);
    if (f && isFainted(f) && !f._ko) { f._ko = true; this.ev.push({ t: 'faint', side: 1 }); this.say(`${monName(f)} est K.O. !`); ko = true; }
    const me = this.act(0);
    if (isFainted(me) && !me._ko) { me._ko = true; this.ev.push({ t: 'faint', side: 0 }); this.say(`${this.Nm(0)} est K.O. !`); ko = true; }
    return ko;
  }
  finDeTour(i) {
    const m = this.act(i), v = this.sides[i].v;
    v.protect = false;
    if (!m || isFainted(m)) return;
    const perte = (n) => this.hp(i, -Math.max(1, Math.floor(m.stats[0] / n)));
    if (m.status === 'brn') { this.ev.push({ t: 'anim', side: i, k: 'burn' }); this.say(`${this.Nm(i)} souffre de sa brûlure !`); perte(8); }
    if (m.status === 'psn') { this.ev.push({ t: 'anim', side: i, k: 'poison' }); this.say(`${this.Nm(i)} souffre du poison !`); perte(8); }
    if (m.status === 'tox') { m.tox = Math.min(15, (m.tox || 0) + 1); this.ev.push({ t: 'anim', side: i, k: 'poison' }); this.say(`${this.Nm(i)} souffre du poison !`); this.hp(i, -Math.max(1, Math.floor(m.stats[0] * m.tox / 16))); }
    const s = this.sides[i];
    for (const k of Object.keys(s.screens)) { s.screens[k]--; if (s.screens[k] <= 0) delete s.screens[k]; }
  }
}

export class Groupe {
  /**
   * @param o.joueurs  [{ id, nom, party, places? }]  équipes déjà copiées (le combat les modifie) ; places : Pokémon
   *                                                 en jeu à la fois pour ce joueur (mode test, combat seul contre deux)
   * @param o.dresseur { cls, nom, bs }               le dresseur (ou le couple : « Duo Lise et Léo »)
   * @param o.reserve  [mon, …]                       ses Pokémon, dans l'ordre d'envoi
   * @param o.places   Pokémon adverses en jeu à la fois (par défaut : autant que de joueurs)
   */
  constructor(o) {
    this.rng = o.rng || Math.random;
    this.reserve = o.reserve;
    this.pluriel = !!o.dresseur.pluriel;
    this.dresseur = { cls: o.dresseur.cls || '', name: o.dresseur.nom, bs: o.dresseur.bs, prize: 0, ai: 'smart', items: {} };
    // une place par Pokémon en jeu : un joueur à plusieurs places a une place « id#k » par Pokémon, même équipe
    this.joueurs = [];
    for (const j of o.joueurs) {
      const n = Math.max(1, j.places || 1);
      for (let k = 0; k < n; k++) this.joueurs.push({ id: n > 1 ? `${j.id}#${k}` : String(j.id), pid: String(j.id), k, nom: j.nom, party: j.party, etat: 'choix' });
    }
    this.manches = this.joueurs.map((j) => new Manche(this, j, this.rng));
    // un camp par emplacement adverse : même réserve, Pokémon en jeu et effets à part
    const n = Math.min(o.places || this.joueurs.length, this.reserve.length);
    this.places = Array.from({ length: n }, (_, k) => {
      const s = new Battle({ player: { name: '', party: [this.reserve[0]] }, foe: { name: this.dresseur.name, party: this.reserve, trainer: this.dresseur } }).sides[1];
      s.active = k; return s;
    });
    this.envoyes = n;
    this.state = 'choose'; this.result = null; this.turn = 0;
    this.ev = []; this.choix = new Map();
    for (const j of this.joueurs) if (!j.party.some((m) => m.hp > 0)) j.etat = 'dehors';
    // plusieurs places : un Pokémon différent à chacune (pas assez de Pokémon en forme : places en moins)
    for (const j of this.joueurs) {
      if (j.etat === 'dehors' || !j.k) continue;
      const m = this.manche(j.id), i = this.remplacant(j);
      if (i < 0) j.etat = 'dehors'; else m.sides[0].active = i;
    }
  }
  manche(id) { return this.manches.find((m) => m.pid === String(id)); }
  /** places du même joueur */
  soeurs(j) { return this.joueurs.filter((q) => q.pid === j.pid && q !== j); }
  enJeuAilleurs(j, idx) { return this.soeurs(j).some((q) => q.etat !== 'dehors' && this.manche(q.id).sides[0].active === idx); }
  /** un Pokémon en forme que ce joueur peut encore envoyer à cette place */
  remplacant(j) { return j.party.findIndex((q, i) => q.hp > 0 && !this.enJeuAilleurs(j, i)); }
  joueur(id) { return this.joueurs.find((j) => j.id === String(id)); }
  /** Pokémon adverse de l'emplacement k (null s'il n'y a plus personne) */
  adverse(k) { const s = this.places[k]; const m = s && s.active != null ? this.reserve[s.active] : null; return m && !isFainted(m) ? m : null; }
  ciblesAdverses() { return this.places.map((_, k) => k).filter((k) => this.adverse(k)); }
  /** branche l'emplacement k en face de la manche m */
  viser(m, k) { m.sides[1] = this.places[k]; }

  dans(m, fn, k) {
    m.ev = [];
    const r = fn();
    for (const e of m.ev) { if (e.side === 0) e.own = m.pid; if (e.side === 1) e.place = k; this.ev.push(e); }
    m.ev = [];
    return r;
  }
  flush() { const e = this.ev; this.ev = []; return e; }
  say(text) { this.ev.push({ t: 'msg', text }); }

  start() {
    const t = this.dresseur;
    this.say(`${t.cls ? t.cls + ' ' : ''}${t.name} ${this.pluriel ? 'veulent' : 'veut'} se battre !`);
    this.places.forEach((s, k) => { this.ev.push({ t: 'send', side: 1, idx: s.active, place: k }); this.say(`${t.name} ${this.pluriel ? 'envoient' : 'envoie'} ${monName(this.reserve[s.active])} !`); });
    for (const m of this.manches) {
      const j = this.joueur(m.pid); if (j.etat === 'dehors') continue;
      if (!j.k) m.sides[0].active = Math.max(0, j.party.findIndex((q) => q.hp > 0));
      this.ev.push({ t: 'send', side: 0, idx: m.sides[0].active, own: m.pid });
      this.say(`${j.nom} envoie ${monName(m.act(0))} !`);
    }
    return this.flush();
  }
  /** places dont on attend le choix (identifiants de place) */
  attendus() {
    if (this.state === 'over') return [];
    const want = this.state === 'switch' ? 'remplacer' : 'choix';
    return this.joueurs.filter((j) => j.etat === want).map((j) => j.id);
  }
  /** joueurs dont on attend un choix */
  attendusJoueurs() { return [...new Set(this.attendus().map((id) => this.joueur(id).pid))]; }
  /**
   * choix d'un joueur : { type: 'move', idx, cible } | { type: 'switch', idx } | { type: 'forfeit' }, ou pour un
   * joueur à plusieurs places { type: 'multi', actions: [choix de la place 0, de la place 1…] }
   */
  action(id, a) {
    id = String(id);
    const att = this.attendus(), places = this.joueurs.filter((j) => j.pid === id && att.includes(j.id));
    if (!places.length || !a || typeof a.type !== 'string') return null;
    if (a.type === 'forfeit') { this.retirer(id, `${places[0].nom} abandonne le combat.`); return this.avancer(); }
    for (const j of places) this.choix.set(j.id, a.type === 'multi' ? a.actions?.[j.k] || { type: 'move', idx: 0 } : a);
    return this.avancer();
  }
  /** un joueur quitte le combat (toutes ses places) */
  retirer(id, texte) {
    const l = this.joueurs.filter((q) => (q.pid === String(id) || q.id === String(id)) && q.etat !== 'dehors'); if (!l.length) return;
    for (const j of l) { j.etat = 'dehors'; this.choix.delete(j.id); this.ev.push({ t: 'out', own: j.id }); }
    if (texte) this.say(texte);
    if (!this.joueurs.some((q) => q.etat !== 'dehors') && this.state !== 'over') this.fin('lose');
  }
  avancer() {
    if (this.state === 'over') return this.flush();
    if (!this.attendus().every((id) => this.choix.has(id))) return this.ev.length ? this.flush() : null;
    if (this.state === 'switch') this.remplacements(); else this.tour();
    this.choix.clear();
    return this.flush();
  }
  remplacements() {
    for (const j of this.joueurs) {
      if (j.etat !== 'remplacer') continue;
      const m = this.manche(j.id), a = this.choix.get(j.id) || {};
      let idx = a.idx;
      if (!Number.isInteger(idx) || !j.party[idx] || j.party[idx].hp <= 0 || this.enJeuAilleurs(j, idx)) idx = this.remplacant(j);
      if (idx < 0) { j.etat = 'dehors'; this.ev.push({ t: 'out', own: j.id }); continue; }
      this.dans(m, () => m.doSwitch(0, idx, true));
      j.etat = 'choix';
    }
    this.state = 'choose';
  }
  tour() {
    this.turn++;
    const actifs = this.joueurs.filter((j) => j.etat === 'choix'), acts = [];
    for (const j of actifs) {
      const m = this.manche(j.id); let a = m.forcedAction(0) || this.choix.get(j.id) || { type: 'move', idx: 0 };
      if (a.type === 'switch') {
        if (!m.canSwitchTo(a.idx)) a = { type: 'move', idx: 0 };
        else { this.dans(m, () => m.doSwitch(0, a.idx, false)); continue; }
      }
      const cibles = this.ciblesAdverses(), k = cibles.includes(a.cible) ? a.cible : cibles[0];
      if (a.type === 'move' && a.id == null) {
        const u = m.usableMoves(0);
        if (!u.length) a = { type: 'move', id: 165 };
        else { const s = u.includes(a.idx) ? a.idx : u[0]; a = { type: 'move', id: m.act(0).moves[s].id, slot: s }; }
      }
      acts.push({ m, i: 0, a, k, vit: m.act(0).stats[5], mon: m.act(0) });
    }
    // chaque Pokémon adverse vise un joueur encore debout
    for (const k of this.ciblesAdverses()) {
      const debout = actifs.map((j) => this.manche(j.id)).filter((m) => !isFainted(m.act(0)));
      if (!debout.length) break;
      const m = debout[Math.floor(this.rng() * debout.length)];
      this.viser(m, k);
      acts.push({ m, i: 1, a: m.choixAdverse(), k, vit: this.adverse(k).stats[5], mon: this.adverse(k) });
    }
    for (const x of acts) { x.m.sides[0].v.flinch = false; x.m.sides[0].v.dmgTaken = null; }
    for (const s of this.places) { s.v.flinch = false; s.v.dmgTaken = null; }
    const prio = (x) => (x.a.type === 'move' ? MOVES[x.a.id].pr : 0);
    acts.sort((p, q) => prio(q) - prio(p) || q.vit - p.vit || (this.rng() < 0.5 ? -1 : 1));
    acts.forEach((x, n) => { x.first = n === 0; });
    for (const x of acts) {
      if (this.state === 'over') break;
      if (x.i === 0 && !this.adverse(x.k)) { const c = this.ciblesAdverses(); if (!c.length) break; x.k = c[0]; }
      if (x.i === 1 && !this.adverse(x.k)) continue;
      this.viser(x.m, x.k);
      if (isFainted(x.m.act(x.i)) || isFainted(x.m.act(1 - x.i)) || (x.mon && x.m.act(x.i) !== x.mon)) continue;
      if (x.a.type === 'recharge') { this.dans(x.m, () => { x.m.say(`${x.m.Nm(x.i)} doit se recharger !`); x.m.sides[x.i].v.recharge = false; }, x.k); continue; }
      this.dans(x.m, () => { x.m.useMove(x.i, x.a, x.first); x.m.checkFaints(); }, x.k);
      this.bilan();
    }
    if (this.state === 'over') return;
    for (const j of this.joueurs.filter((q) => q.etat === 'choix')) { const m = this.manche(j.id); this.dans(m, () => { m.finDeTour(0); m.checkFaints(); }); }
    const m0 = this.manches.find((m) => this.joueur(m.pid).etat !== 'dehors') || this.manches[0];
    for (const k of this.ciblesAdverses()) { this.viser(m0, k); this.dans(m0, () => { m0.finDeTour(1); m0.checkFaints(); }, k); }
    this.bilan();
    if (this.state !== 'over' && this.joueurs.some((j) => j.etat === 'remplacer')) this.state = 'switch';
  }
  /** après chaque action : relève des Pokémon adverses, victoire, défaite, remplacements */
  bilan() {
    if (this.state === 'over') return;
    this.places.forEach((s, k) => {
      const m = this.reserve[s.active];
      if (!m || !isFainted(m) || s.vide) return;
      // le suivant de la réserve qui n'est pas déjà en jeu
      if (this.envoyes < this.reserve.length) {
        // un Pokémon gardé pour la fin (attend) n'entre que quand tous les autres sont K.O.
        const suiv = this.reserve[this.envoyes];
        if (suiv.attend && this.reserve.some((q) => q !== suiv && !isFainted(q))) return;
        s.active = this.envoyes++; s.v = new Battle({ player: { name: '', party: [m] }, foe: { name: '', party: [m], trainer: this.dresseur } }).sides[1].v;
        this.ev.push({ t: 'send', side: 1, idx: s.active, place: k });
        this.say(`${this.dresseur.name} ${this.pluriel ? 'envoient' : 'envoie'} ${monName(this.reserve[s.active])} !`);
      } else s.vide = true;
    });
    if (this.reserve.every((m) => isFainted(m))) { this.fin('win'); return; }
    for (const j of this.joueurs) {
      if (j.etat !== 'choix') continue;
      const m = this.manche(j.id);
      if (!isFainted(m.act(0))) continue;
      if (this.remplacant(j) >= 0) { j.etat = 'remplacer'; this.ev.push({ t: 'switch-prompt', own: j.id }); }
      else { j.etat = 'dehors'; this.say(`${j.nom} n'a plus de Pokémon en forme !`); this.ev.push({ t: 'out', own: j.id }); }
    }
    if (!this.joueurs.some((j) => j.etat !== 'dehors')) this.fin('lose');
  }
  fin(result) {
    this.state = 'over'; this.result = result;
    for (const q of this.reserve) delete q._ko;
    for (const j of this.joueurs) for (const q of j.party) { delete q._ko; if (q.status === 'tox') q.status = 'psn'; }
    this.ev.push({ t: 'end', result });
  }
  /** ce que chaque écran a besoin de connaître après un tour */
  photo() {
    return {
      turn: this.turn, state: this.state, result: this.result,
      adverses: this.places.map((s, k) => { const m = this.adverse(k); return m ? { place: k, idx: s.active, sp: m.sp, lvl: m.lvl, hp: m.hp, max: m.stats[0], status: m.status || null, blocs: m.blocs || 0 } : { place: k, vide: true }; }),
      reste: this.reserve.filter((m) => !isFainted(m)).length,
      joueurs: this.joueurs.map((j) => ({ id: j.id, pid: j.pid, k: j.k, nom: j.nom, etat: j.etat, active: this.manche(j.id).sides[0].active, forced: this.manche(j.id).forcedAction(0) ? 1 : 0,
        party: j.party.map((q) => ({ sp: q.sp, lvl: q.lvl, hp: q.hp, max: q.stats[0], status: q.status || null, moves: q.moves.map((x) => ({ id: x.id, pp: x.pp })) })) })),
    };
  }
}
