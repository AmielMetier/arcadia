// odyssee/js/donjons/combat/raid.js — combat à plusieurs contre un boss (sans DOM ni réseau, testé sous Node).
//
// Chaque joueur a un Pokémon en jeu ; le boss est seul et agit une fois par tour, contre un joueur tiré au sort.
// On réutilise le moteur d'Odyssée : un combat à deux camps par joueur, dont le camp du boss est le même objet
// partout (PV, statuts, modifications de stats). L'hôte fait tourner ce combat et diffuse les événements.
//
// Barre de vie à blocs (façon PokéRogue) : un coup ne fait jamais tomber plus d'un bloc, et chaque bloc cassé
// augmente la Vitesse du boss d'un cran (ou la stat donnée par o.boost). Avec o.immunite = 'physique' ou 'speciale',
// le boss ne craint pas les attaques de cette catégorie tant que son premier bloc tient (« Ça n'affecte pas… »).
// o.effets : ce qui arrive quand un bloc se brise ({ [blocs restants]: ['boostTout', 'piegeRoc', 'baisseAttaques', 'ko'] }),
// une seule fois par combat même si le boss se soigne ; 'ko' met K.O. le Pokémon d'un joueur pas encore visé.
// o.soin : ce que rend une attaque de soin du boss, en blocs.
import { Battle, typeEff } from '../../core/battle.js';
import { SPECIES } from '../../data/species.js';
import { MOVES } from '../../data/moves.js';
import { monName, isFainted } from '../../core/mon.js';

/** le camp d'un Pokémon désigné par son numéro ou par { side, slot } (moteur d'Odyssée) */
export const cote = (ref) => (typeof ref === 'number' ? ref : ref?.side ?? 0);
const voyelle = /^[aeiouyhàâéèêëîïôöûü]/i;
export const deNom = (nom) => (voyelle.test(nom) ? `d'${nom}` : `de ${nom}`);

class Manche extends Battle {
  constructor(raid, j, rng) {
    super({ player: { name: j.nom, party: j.party, bag: {} }, foe: { name: raid.boss.nom, party: [raid.boss.mon], trainer: raid.boss.dresseur }, rng });
    this.raid = raid; this.pid = j.id; this.joueur = j;
  }
  // le moteur désigne un Pokémon par son camp ou par { side, slot } : un seul emplacement ici
  nm(ref) { const i = cote(ref), m = this.act(i); return i === 1 ? monName(m) : `${monName(m)} ${deNom(this.joueur.nom)}`; }
  tie() { return this.rng() < 0.5 ? -1 : 1; }
  awardExp() {}
  /** l'IA d'Odyssée peut changer de Pokémon ou prendre un objet : ici, l'adversaire attaque toujours */
  choixAdverse() {
    const a = this.foeChoose();
    if (a && (a.type === 'move' && a.id != null || a.type === 'recharge')) return a;
    const u = this.usableMoves(1);
    return u.length ? { type: 'move', id: this.act(1).moves[u[0]].id, slot: u[0] } : { type: 'move', id: 165 };
  }
  /** premier bloc intact : les attaques de la catégorie immunisée ne passent pas */
  useMove(ref, a, first) {
    const i = cote(ref), mv = MOVES[a.id];
    if (i === 0 && a.type === 'move' && mv && this.raid.immunise(mv.c)) {
      const m = this.act(0), slot = a.slot ?? m.moves.findIndex((q) => q.id === mv.id);
      if (slot >= 0 && m.moves[slot]) m.moves[slot].pp = Math.max(0, m.moves[slot].pp - 1);
      this.say(`${this.Nm(0)} utilise ${mv.n} !`);
      this.say(`Ça n'affecte pas ${this.nm(1)}...`);
      return;
    }
    return super.useMove(i, a, first);
  }
  /** pièges de roc : chaque Pokémon qui entre en jeu chez les joueurs est blessé */
  doSwitch(i, idx, afterFaint, trigger) {
    const r = super.doSwitch(i, idx, afterFaint, trigger);
    const m = this.act(0);
    if (i === 0 && this.raid.roc && m && !isFainted(m)) {
      const n = Math.max(1, Math.floor(m.stats[0] * typeEff('rock', SPECIES[m.sp].t) / 8));
      this.say(`Des pierres pointues blessent ${this.nm(0)} !`); this.ev.push({ t: 'hit', side: 0 }); this.hp(0, -n);
    }
    return r;
  }
  hp(ref, delta, cause) {
    const i = cote(ref);
    if (i === 1 && delta > 0 && this.raid.soin) delta = Math.round(this.raid.soin * this.raid.bossMon.stats[0] / this.raid.blocs);
    if (i === 1 && delta < 0) delta = this.raid.plafond(delta);
    const avant = this.act(1).hp, r = super.hp(ref, delta, cause);
    if (i === 1) this.raid.blocsCasses(this, avant);
    return r;
  }
  /** les K.O. sont gérés par le combat à plusieurs */
  checkFaints() {
    let ko = false;
    const boss = this.act(1);
    if (isFainted(boss) && !boss._ko) { boss._ko = true; this.ev.push({ t: 'faint', side: 1 }); this.say(`${monName(boss)} est K.O. !`); ko = true; }
    const me = this.act(0);
    if (isFainted(me) && !me._ko) { me._ko = true; this.ev.push({ t: 'faint', side: 0 }); this.say(`${this.Nm(0)} est K.O. !`); ko = true; }
    return ko;
  }
  /** fin de tour d'un seul camp (le boss ne doit pas subir sa brûlure une fois par joueur) */
  finDeTour(i) {
    const m = this.act(i), v = this.sides[i].v;
    v.protect = false;
    if (isFainted(m)) return;
    const perte = (n) => this.hp(i, -Math.max(1, Math.floor(m.stats[0] / n)));
    if (m.status === 'brn') { this.ev.push({ t: 'anim', side: i, k: 'burn' }); this.say(`${this.Nm(i)} souffre de sa brûlure !`); perte(8); }
    if (m.status === 'psn') { this.ev.push({ t: 'anim', side: i, k: 'poison' }); this.say(`${this.Nm(i)} souffre du poison !`); perte(8); }
    if (m.status === 'tox') { m.tox = Math.min(15, (m.tox || 0) + 1); this.ev.push({ t: 'anim', side: i, k: 'poison' }); this.say(`${this.Nm(i)} souffre du poison !`); this.hp(i, -Math.max(1, Math.floor(m.stats[0] * m.tox / 16))); }
    if (!isFainted(m) && v.trap > 0) { v.trap--; this.say(`${this.Nm(i)} est blessé par le piège !`); perte(16); if (!v.trap) this.say(`${this.Nm(i)} est libéré !`); }
    const s = this.sides[i];
    for (const k of Object.keys(s.screens)) { s.screens[k]--; if (s.screens[k] <= 0) delete s.screens[k]; }
  }
}

export class Raid {
  /**
   * @param o.joueurs [{ id, nom, party }]   les équipes (déjà copiées : le combat les modifie)
   * @param o.boss    { mon, cls, nom, bs }  mon.stats[0] = PV totaux (déjà multipliés si besoin)
   * @param o.blocs   nombre de blocs de la barre de vie (3)
   * @param o.rng
   */
  constructor(o) {
    this.rng = o.rng || Math.random;
    this.blocs = o.blocs || 3;
    this.immunite = o.immunite || null;
    this.statBloc = o.boost ?? 6;   // stat qui monte à chaque bloc cassé (2 : Attaque, 6 : Vitesse ; 0 : aucune)
    this.effets = o.effets || {}; this.soin = o.soin || 0;
    this.effetsFaits = new Set(); this.koJoueurs = new Set(); this.roc = false;
    this.boss = { mon: o.boss.mon, nom: monName(o.boss.mon), dresseur: { cls: o.boss.cls || '', name: o.boss.nom || monName(o.boss.mon), bs: o.boss.bs, prize: 0, ai: 'smart', items: {} } };
    this.joueurs = o.joueurs.map((j) => ({ id: String(j.id), nom: j.nom, party: j.party, etat: 'choix' }));
    this.manches = this.joueurs.map((j) => new Manche(this, j, this.rng));
    const bossSide = this.manches[0].sides[1];
    for (const m of this.manches) m.sides[1] = bossSide;
    this.state = 'choose'; this.result = null; this.turn = 0;
    this.ev = []; this.choix = new Map();
    for (const j of this.joueurs) if (!j.party.some((m) => m.hp > 0)) j.etat = 'dehors';
  }
  manche(id) { return this.manches.find((m) => m.pid === String(id)); }
  joueur(id) { return this.joueurs.find((j) => j.id === String(id)); }
  get bossMon() { return this.boss.mon; }
  seuils() { const M = this.bossMon.stats[0]; return Array.from({ length: this.blocs + 1 }, (_, k) => Math.round((k * M) / this.blocs)); }
  /** bloc courant (1 = le dernier) */
  bloc(hp = this.bossMon.hp) { const t = this.seuils(); for (let k = 1; k <= this.blocs; k++) if (hp <= t[k]) return k; return this.blocs; }
  immunise(c) { const cat = { physique: 'physical', speciale: 'special' }[this.immunite]; return !!cat && (c == null || c === cat) && this.bloc() === this.blocs; }
  /** un coup ne descend pas sous le bas du bloc courant */
  plafond(delta) { const hp = this.bossMon.hp, bas = this.seuils()[this.bloc(hp) - 1]; return Math.max(delta, bas - hp); }
  blocsCasses(manche, avant) {
    const apres = this.bossMon.hp;
    if (apres <= 0 || apres >= avant) return;
    const t = this.seuils();
    for (let k = this.blocs - 1; k >= 1; k--) {
      if (avant > t[k] && apres <= t[k]) {
        manche.ev.push({ t: 'bloc', reste: k });
        manche.say(`Un bouclier de ${this.boss.nom} se brise !`);
        if (this.statBloc) manche.boost(1, this.statBloc, 1, false);
        if (!this.effetsFaits.has(k)) { this.effetsFaits.add(k); for (const f of this.effets[k] || []) this.effet(manche, f); }
      }
    }
  }
  /** fait agir une autre manche pendant l'action en cours : ses événements suivent ceux de l'action */
  chez(manche, q, fn) {
    if (q === manche) return fn();
    const avant = q.ev; q.ev = [];
    try { fn(); } finally { for (const e of q.ev) { if (e.side === 0) e.own = q.pid; manche.ev.push(e); } q.ev = avant; }
  }
  effet(manche, f) {
    const nom = this.boss.nom, debout = this.manches.filter((q) => this.joueur(q.pid).etat === 'choix' && !isFainted(q.act(0)));
    if (f === 'boostTout') { manche.say(`${nom} rassemble toute sa puissance !`); for (const sid of [2, 3, 4, 5, 6]) manche.boost(1, sid, 1, false); }
    else if (f === 'piegeRoc') { this.roc = true; manche.say('Des pierres pointues flottent autour de vos Pokémon !'); }
    else if (f === 'baisseAttaques') {
      manche.say(`${nom} libère une onde d'intimidation !`);
      for (const q of debout) this.chez(manche, q, () => { q.boost(0, 2, -2, false); q.boost(0, 4, -2, false); });
    } else if (f === 'ko') {
      const l = debout.filter((q) => !this.koJoueurs.has(this.joueur(q.pid).id)); if (!l.length) return;
      const q = l[Math.floor(this.rng() * l.length)]; this.koJoueurs.add(this.joueur(q.pid).id);
      manche.say(`${nom} concentre sa puissance sur ${q.nm(0)} !`);
      this.chez(manche, q, () => { q.ev.push({ t: 'hit', side: 0 }); q.hp(0, -q.act(0).hp); q.checkFaints(); });
    }
  }

  /** exécute fn dans une manche et récupère ses événements, marqués du joueur concerné */
  dans(m, fn) {
    m.ev = [];
    const r = fn();
    for (const e of m.ev) { if (e.side === 0 && e.own == null) e.own = m.pid; this.ev.push(e); }
    m.ev = [];
    return r;
  }
  flush() { const e = this.ev; this.ev = []; return e; }
  say(text) { this.ev.push({ t: 'msg', text }); }

  start() {
    const t = this.boss.dresseur;
    this.say(`${t.cls ? t.cls + ' ' : ''}${t.name} veut se battre !`);
    this.ev.push({ t: 'send', side: 1, idx: 0 });
    for (const m of this.manches) {
      const j = this.joueur(m.pid);
      if (j.etat === 'dehors') continue;
      m.sides[0].active = Math.max(0, j.party.findIndex((q) => q.hp > 0));
      this.ev.push({ t: 'send', side: 0, idx: m.sides[0].active, own: m.pid });
      this.say(`${j.nom} envoie ${monName(m.act(0))} !`);
    }
    return this.flush();
  }

  /** joueurs dont on attend un choix */
  attendus() {
    if (this.state === 'over') return [];
    const want = this.state === 'switch' ? 'remplacer' : 'choix';
    return this.joueurs.filter((j) => j.etat === want).map((j) => j.id);
  }
  /**
   * choix d'un joueur : { type: 'move', idx } | { type: 'switch', idx } | { type: 'forfeit' }.
   * Renvoie les événements du tour quand tout le monde a choisi, sinon null.
   */
  action(id, a) {
    id = String(id);
    const j = this.joueur(id);
    if (!j || !this.attendus().includes(id) || !a || typeof a.type !== 'string') return null;
    if (a.type === 'forfeit') { this.retirer(id, `${j.nom} abandonne le combat.`); return this.avancer(); }
    this.choix.set(id, a);
    return this.avancer();
  }
  /** un joueur part ou abandonne : il ne compte plus */
  retirer(id, texte) {
    const j = this.joueur(id); if (!j || j.etat === 'dehors') return;
    j.etat = 'dehors'; this.choix.delete(String(id));
    if (texte) this.say(texte);
    this.ev.push({ t: 'out', own: j.id });
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
      if (!Number.isInteger(idx) || !j.party[idx] || j.party[idx].hp <= 0) idx = j.party.findIndex((q) => q.hp > 0);
      this.dans(m, () => m.doSwitch(0, idx, true));
      j.etat = 'choix';
    }
    this.state = 'choose';
  }

  tour() {
    this.turn++;
    const actifs = this.joueurs.filter((j) => j.etat === 'choix');
    const acts = [];
    for (const j of actifs) {
      const m = this.manche(j.id); let a = m.forcedAction(0) || this.choix.get(j.id) || { type: 'move', idx: 0 };
      if (a.type === 'switch') {
        if (!m.canSwitchTo(a.idx)) a = { type: 'move', idx: 0 };
        else { this.dans(m, () => m.doSwitch(0, a.idx, false)); continue; }
      }
      if (a.type === 'move' && a.id == null) {
        const u = m.usableMoves(0);
        if (!u.length) a = { type: 'move', id: 165 };
        else { const k = u.includes(a.idx) ? a.idx : u[0]; a = { type: 'move', id: m.act(0).moves[k].id, slot: k }; }
      }
      acts.push({ m, i: 0, a });
    }
    // le boss vise un joueur encore debout
    const cibles = actifs.map((j) => this.manche(j.id)).filter((m) => !isFainted(m.act(0)));
    if (cibles.length && !isFainted(this.bossMon)) {
      const m = cibles[Math.floor(this.rng() * cibles.length)];
      acts.push({ m, i: 1, a: m.choixAdverse() });
    }
    for (const x of acts) { x.m.sides[0].v.flinch = false; x.m.sides[0].v.dmgTaken = null; }
    const bossV = this.manches[0].sides[1].v; bossV.flinch = false; bossV.dmgTaken = null;
    const prio = (x) => (x.a.type === 'move' ? MOVES[x.a.id].pr : 0);
    acts.sort((p, q) => prio(q) - prio(p) || q.m.stat(q.i, 5) - p.m.stat(p.i, 5) || (this.rng() < 0.5 ? -1 : 1));
    acts.forEach((x, n) => { x.first = n === 0; });
    for (const x of acts) {
      if (this.state === 'over') break;
      const moi = x.m.act(x.i);
      if (isFainted(moi) || isFainted(x.m.act(1 - x.i))) continue;
      if (x.a.type === 'recharge') { this.dans(x.m, () => { x.m.say(`${x.m.Nm(x.i)} doit se recharger !`); x.m.sides[x.i].v.recharge = false; }); continue; }
      this.dans(x.m, () => { x.m.useMove(x.i, x.a, x.first); x.m.checkFaints(); });
      this.bilan();
    }
    if (this.state === 'over') return;
    for (const j of this.joueurs.filter((q) => q.etat === 'choix')) { const m = this.manche(j.id); this.dans(m, () => { m.finDeTour(0); m.checkFaints(); }); }
    const m0 = this.manches.find((m) => this.joueur(m.pid).etat !== 'dehors') || this.manches[0];
    this.dans(m0, () => { m0.finDeTour(1); m0.checkFaints(); });
    this.bilan();
    if (this.state !== 'over' && this.joueurs.some((j) => j.etat === 'remplacer')) this.state = 'switch';
  }
  /** après chaque action : victoire, défaite, joueurs qui doivent remplacer leur Pokémon */
  bilan() {
    if (this.state === 'over') return;
    if (isFainted(this.bossMon)) { this.fin('win'); return; }
    for (const j of this.joueurs) {
      if (j.etat !== 'choix') continue;
      const m = this.manche(j.id);
      if (!isFainted(m.act(0))) continue;
      if (j.party.some((q) => q.hp > 0)) { j.etat = 'remplacer'; this.ev.push({ t: 'switch-prompt', own: j.id }); }
      else { j.etat = 'dehors'; this.say(`${j.nom} n'a plus de Pokémon en forme !`); this.ev.push({ t: 'out', own: j.id }); }
    }
    if (!this.joueurs.some((j) => j.etat !== 'dehors')) this.fin('lose');
  }
  fin(result) {
    this.state = 'over'; this.result = result;
    for (const m of this.manches) for (const s of m.sides) for (const q of s.party) delete q._ko;
    for (const j of this.joueurs) for (const q of j.party) if (q.status === 'tox') q.status = 'psn';
    this.ev.push({ t: 'end', result });
  }

  /** ce que chaque écran a besoin de connaître après un tour */
  photo() {
    const b = this.bossMon, bv = this.manches[0].sides[1].v;
    return {
      turn: this.turn, state: this.state, result: this.result, blocs: this.blocs, bloc: this.bloc(),
      boss: { sp: b.sp, lvl: b.lvl, hp: b.hp, max: b.stats[0], status: b.status || null, nick: b.nick || null, vit: bv.st[5] },
      joueurs: this.joueurs.map((j) => ({ id: j.id, nom: j.nom, etat: j.etat, active: this.manche(j.id).sides[0].active, forced: this.manche(j.id).forcedAction(0) ? 1 : 0,
        party: j.party.map((q) => ({ sp: q.sp, lvl: q.lvl, hp: q.hp, max: q.stats[0], status: q.status || null, moves: q.moves.map((x) => ({ id: x.id, pp: x.pp })) })) })),
    };
  }
}
