// odyssee/js/donjons/combat/vue.js — le combat à plusieurs vu par un joueur, dans l'écran de combat d'Odyssée.
//
// L'écran d'Odyssée sait jouer un combat dont les tours sont calculés ailleurs (combat entre joueurs : runPvp).
// On lui donne ici un « combat miroir » : chaque tour arrive de l'hôte (événements + photo de l'état), le miroir
// se met à jour, et les événements sont traduits du point de vue du joueur : son Pokémon est le camp 0, le boss
// le camp 1, et ce qui arrive à ses équipiers s'affiche dans un encadré à part.
import { createMon, monName } from '../../core/mon.js';
import { ASSETS } from '../../assets.js';
import { el, esc, wait } from '../../ui/ui.js';

/** un camp comme ceux du moteur d'Odyssée (un emplacement : active et v désignent le premier) */
function camp(party, extra = {}) {
  const s = { party, activeSlots: [0], vs: [{ st: [0, 0, 0, 0, 0, 0, 0, 0] }], screens: {}, ...extra };
  Object.defineProperty(s, 'active', { get: () => s.activeSlots[0], set: (v) => { s.activeSlots[0] = v; }, configurable: true, enumerable: true });
  Object.defineProperty(s, 'v', { get: () => s.vs[0], set: (v) => { s.vs[0] = v; }, configurable: true, enumerable: true });
  return s;
}
const hpCol = (r) => (r > 0.5 ? '#48c848' : r > 0.2 ? '#f0c020' : '#e83030');

export class CombatMiroir {
  /**
   * @param o.moi     identifiant du joueur
   * @param o.party   son équipe (les objets de sa partie : le combat les met à jour)
   * @param o.intro   premier message de l'hôte { evs, photo }
   * @param o.boss    { cls, nom, bs }
   */
  constructor(o) {
    this.moi = String(o.moi); this.pvp = true; this.wild = false; this.raid = true;
    this.turn = 0; this.state = 'choose'; this.result = null; this.need = [false, true];
    this.file = []; this.attente = null;
    const b = o.intro.photo.boss, boss = createMon(b.sp, b.lvl, { shiny: false });
    this.slots = 1; this.weather = 'none'; this.needSlots = { 0: [0], 1: [] }; this.needPlayerSlots = [];
    this.sides = [
      camp(o.party, { player: true }),
      camp([boss], { trainer: { cls: o.boss.cls || '', name: o.boss.nom, bs: o.boss.bs } }),
    ];
    this.intro = o.intro;
    this.photo(o.intro.photo);
  }
  get me() { return this.sides[0].party[this.sides[0].active]; }
  get foe() { return this.sides[1].party[0]; }
  // ce que l'écran de combat d'Odyssée demande au combat (un seul emplacement de chaque côté)
  norm(ref) { return typeof ref === 'number' ? { side: ref, slot: 0 } : ref; }
  monAt(side) { const s = this.sides[side]; return s ? s.party[s.active] || null : null; }
  act(ref) { return this.monAt(this.norm(ref).side); }
  vol(ref) { return this.sides[this.norm(ref).side].v; }
  aliveSlots(side) { const m = this.monAt(side); return m && m.hp > 0 ? [0] : []; }
  validFoeTargets() { return [{ side: 1, slot: 0 }]; }
  validAllyTargets() { return []; }
  canMega() { return false; }
  usableMoves(ref) { const m = this.act(ref); return m ? m.moves.map((x, k) => (x.pp > 0 ? k : -1)).filter((k) => k >= 0) : []; }
  forcedAction(ref) { return this.norm(ref).side === 0 && this.forced ? { type: 'move', idx: 0 } : null; }
  canSwitchTo(idx) { const m = this.sides[0].party[idx]; return m && m.hp > 0 && idx !== this.sides[0].active; }
  checksum() { return 0; }

  /** l'état envoyé par l'hôte devient celui du miroir */
  photo(p) {
    this.dernier = p;
    const b = p.boss, f = this.foe;
    f.stats[0] = b.max; f.hp = b.hp; f.status = b.status; f.nick = b.nick || null;
    const j = p.joueurs.find((q) => q.id === this.moi);
    if (j) {
      j.party.forEach((q, i) => { const m = this.sides[0].party[i]; if (!m) return; m.hp = q.hp; m.status = q.status; q.moves.forEach((x, k) => { if (m.moves[k]) m.moves[k].pp = x.pp; }); });
      this.sides[0].active = j.active; this.forced = !!j.forced;
      this.dehors = j.etat === 'dehors';
      this.need[0] = j.etat === 'remplacer';
    }
    this.turn = p.turn;
    if (p.state === 'over') { this.state = 'over'; this.result = p.result; }
    else if (this.dehors) { this.state = 'over'; this.result = 'out'; }
    else this.state = p.state === 'switch' ? 'switch' : 'choose';
    this.equipiers?.maj(p);
  }
  /** les événements du point de vue de ce joueur */
  traduire(evs) {
    const out = [];
    for (let k = 0; k < evs.length; k++) {
      const e = evs[k];
      if (e.t === 'end') { out.push(e); continue; }
      if (e.t === 'bloc' || e.t === 'out' || e.t === 'switch-prompt') { out.push({ ...e, t: 'raid-' + e.t }); continue; }
      if (e.side === 0 && e.own !== this.moi) {
        // ce qui arrive à un équipier : son encadré clignote, rien ne bouge sur notre Pokémon
        if (e.t === 'move') out.push({ t: 'move', side: 0, move: e.move, type: e.type });
        else out.push({ t: 'raid-equipier', own: e.own, k: e.t });
        continue;
      }
      // une attaque du boss sur un équipier : pas d'animation vers notre Pokémon
      if (e.t === 'move' && e.side === 1) {
        let cible = null;
        for (const q of evs.slice(k + 1)) { if (q.t === 'move') break; if ((q.t === 'hit' || q.t === 'hp') && q.side === 0) { cible = q.own; break; } }
        if (cible && cible !== this.moi) continue;
      }
      out.push(e);
    }
    return out;
  }
  start() { return this.traduire(this.intro.evs); }

  /* ---------------- échanges avec l'hôte ---------------- */
  recevoir(m) { if (this.attente) { const f = this.attente; this.attente = null; f(m); } else this.file.push(m); }
  prochain(ms = 600000) {
    if (this.file.length) return Promise.resolve(this.file.shift());
    return new Promise((res) => { const t = setTimeout(() => { this.attente = null; res({ timeout: true }); }, ms); this.attente = (m) => { clearTimeout(t); res(m); }; });
  }
  consommer() {
    const m = this.enCours; this.enCours = null;
    if (!m) return [];
    this.photo(m.photo);
    return this.traduire(m.evs);
  }
  playerAction() { return this.consommer(); }
  switchBoth() { return this.consommer(); }
  stop(result, texte) { this.state = 'over'; this.result = result; return [{ t: 'msg', text: texte }, { t: 'end', result }]; }

  /** objet attendu par runPvp pour échanger les choix */
  duel(envoyer) {
    const lire = async () => {
      const m = await this.prochain();
      // l'hôte ne répond plus : le combat s'arrête sans vainqueur
      if (m.timeout || m.parti) return { desync: true };
      this.enCours = m; return m;
    };
    return {
      foeName: 'tes équipiers',
      sendAct: (n, action) => envoyer({ type: action.type, idx: action.idx }),
      waitAct: async () => { const m = await lire(); return m.evs ? { action: {}, sum: 0 } : m; },
      sendSwitch: (n, idx) => { if (this.need[0]) envoyer({ type: 'switch', idx }); },
      waitSwitch: async () => { const m = await lire(); return m.evs ? { idx: 0 } : m; },
      sendQuit: () => envoyer({ type: 'forfeit' }),
    };
  }
}

/** encadré des équipiers, en haut à gauche de l'écran de combat */
export class Equipiers {
  constructor(root, moi) {
    this.moi = String(moi);
    this.el = el('div', 'raid-equipe'); root.appendChild(this.el);
  }
  maj(p) {
    const autres = p.joueurs.filter((j) => j.id !== this.moi);
    this.el.innerHTML = autres.map((j) => {
      const m = j.party[j.active], r = m ? Math.max(0, m.hp / m.max) : 0;
      return `<div class="raid-eq${j.etat === 'dehors' ? ' out' : ''}" data-id="${esc(j.id)}">
        <img src="${m ? ASSETS.icon(m.sp) : ''}" alt=""><div><b>${esc(j.nom)}</b><span>${m ? 'N.' + m.lvl : ''}</span>
        <i><u style="width:${r * 100}%;background:${hpCol(r)}"></u></i></div></div>`;
    }).join('');
    this.el.style.display = autres.length ? '' : 'none';
  }
  flash(id) { const q = this.el.querySelector(`[data-id="${CSS.escape(String(id))}"]`); if (!q) return; q.classList.remove('hit'); void q.offsetWidth; q.classList.add('hit'); }
}

/** branche le miroir sur l'écran de combat d'Odyssée pour la durée du combat */
export function brancher(bv, miroir, moi) {
  const play = bv.play.bind(bv);
  bv.play = async (evs) => {
    if (!miroir.equipiers && bv.root) {
      bv.root.classList.add('raid');
      miroir.equipiers = new Equipiers(bv.root, moi); miroir.equipiers.maj(miroir.dernier, miroir.groupe ? miroir : undefined);
      if (!miroir.groupe) marquerBlocs(bv, miroir);
    }
    for (const e of evs) {
      if (e.t === 'raid-equipier') { if (e.k === 'hp' || e.k === 'faint' || e.k === 'hit') miroir.equipiers?.flash(e.own); continue; }
      if (e.t === 'raid-bloc') { await blocBrise(bv, miroir, e.reste); continue; }
      if (e.t === 'raid-out' || e.t === 'raid-switch-prompt') continue;
      await play([e]);
    }
    miroir.equipiers?.maj(miroir.dernier, miroir.groupe ? miroir : undefined);
  };
  return () => { bv.play = play; };
}
/** un bloc se brise : flash, secousse, éclats sur la barre et bandeau au centre de l'écran */
async function blocBrise(bv, miroir, reste) {
  bv.sound.sfx('hitstrong');
  const hud = bv.root?.querySelector('.bhud.foe');
  if (hud) { hud.classList.remove('raid-casse'); void hud.offsetWidth; hud.classList.add('raid-casse'); }
  if (bv.root) { const b = el('div', 'raid-bandeau', `Bouclier brisé !<small>${reste} restant${reste > 1 ? 's' : ''}</small>`); bv.root.appendChild(b); setTimeout(() => b.remove(), 1500); }
  for (let k = 0; k < 4; k++) { bv.st.screenFlash = k % 2 ? 0.35 : 0.9; bv.st.shakeX = k % 2 ? -7 : 7; bv.st.shakeY = k % 2 ? 3 : -3; await wait(70); }
  bv.st.screenFlash = 0; bv.st.shakeX = 0; bv.st.shakeY = 0;
  marquerBlocs(bv, miroir, reste);
  await wait(500);
}
/** la barre de vie du boss découpée en blocs */
function marquerBlocs(bv, miroir, reste) {
  const bar = bv.root?.querySelector('.bhud.foe .bh-hp i'); if (!bar) return;
  const n = miroir.dernier.blocs || 3;
  bar.querySelectorAll('.raid-sep').forEach((q) => q.remove());
  for (let k = 1; k < n; k++) { const s = el('span', 'raid-sep'); s.style.left = (k * 100 / n) + '%'; bar.appendChild(s); }
  const hud = bv.root.querySelector('.bhud.foe');
  let cpt = hud.querySelector('.raid-blocs'); if (!cpt) { cpt = el('div', 'raid-blocs'); hud.appendChild(cpt); }
  const r = reste ?? miroir.dernier.bloc;
  cpt.innerHTML = Array.from({ length: n }, (_, k) => `<b class="${k < r ? 'on' : ''}"></b>`).join('');
}
export const nomBoss = (m) => monName(m);

/**
 * combat de groupe vu par un joueur (combat/groupe.js) : son Pokémon face à celui qu'il vise ; les autres Pokémon
 * adverses et ses équipiers dans l'encadré. Avant chaque attaque, s'il y a plusieurs adversaires, on choisit sa cible.
 */
export class GroupeMiroir extends CombatMiroir {
  constructor(o) {
    const p = o.intro.photo, places = p.adverses.filter((a) => !a.vide);
    // le constructeur du miroir attend un boss : on lui donne le premier adversaire, puis on met en place les emplacements
    super({ ...o, intro: { ...o.intro, photo: { ...p, boss: places[0] } } });
    this.groupe = true;
    // un joueur peut tenir plusieurs places (mode test, combat seul contre deux) : on en montre une à la fois
    this.mesPlaces = p.joueurs.filter((j) => (j.pid ?? j.id) === this.moi).map((j) => j.k || 0);
    this.multi = this.mesPlaces.length > 1; this.place = this.mesPlaces[0] || 0;
    const moi = p.joueurs.findIndex((j) => (j.pid ?? j.id) === this.moi);
    this.sides[1].party = p.adverses.map((a) => (a.vide ? createMon(places[0].sp, places[0].lvl, { shiny: false }) : createMon(a.sp, a.lvl, { shiny: false })));
    this.cible = places[Math.max(0, moi) % places.length].place;
    this.sides[1].active = this.cible;
    this.photo(p);
  }
  get foe() { return this.sides[1].party[this.sides[1].active]; }
  /** identifiant de la place montrée */
  get monId() { return this.multi ? `${this.moi}#${this.place}` : this.moi; }
  canSwitchTo(idx) { return super.canSwitchTo(idx) && !(this.dernier?.joueurs || []).some((q) => q.pid === this.moi && q.id !== this.monId && q.etat !== 'dehors' && q.active === idx); }
  /** montre une autre de ses places (choix de chacun de ses Pokémon) */
  async afficher(k, bv) {
    this.place = k;
    const j = this.dernier.joueurs.find((q) => q.id === this.monId); if (!j) return;
    this.sides[0].active = j.active; this.forced = !!j.forced;
    bv.setHud(0, this.me); await bv.loadSide(0); bv.st.me.visible = true;
    this.equipiers?.maj(this.dernier, this);
  }
  photo(p) {
    if (!this.groupe) return super.photo({ ...p, boss: p.boss || p.adverses?.find((a) => !a.vide) || { hp: 0, max: 1 } });
    this.dernier = p;
    for (const a of p.adverses) {
      let m = this.sides[1].party[a.place];
      if (a.vide) { if (m) m.hp = 0; continue; }
      if (!m || m.sp !== a.sp || m.lvl !== a.lvl) m = this.sides[1].party[a.place] = createMon(a.sp, a.lvl, { shiny: false });
      m.stats[0] = a.max; m.hp = a.hp; m.status = a.status; m.blocs = a.blocs || 0;
    }
    // la cible est tombée : on vise un autre adversaire encore debout
    if (p.adverses[this.cible]?.vide) { const autre = p.adverses.find((a) => !a.vide); if (autre) { this.cible = autre.place; this.changeCible = true; } }
    this.sides[1].active = this.cible;
    const mes = p.joueurs.filter((q) => (q.pid ?? q.id) === this.moi);
    // la place montrée est sortie : on montre une autre place encore en jeu
    if (this.multi && mes.find((q) => q.k === this.place)?.etat === 'dehors') { const autre = mes.find((q) => q.etat !== 'dehors'); if (autre) { this.place = autre.k; this.changePlace = true; } }
    const j = mes.find((q) => q.id === this.monId);
    if (j) {
      j.party.forEach((q, i) => { const m = this.sides[0].party[i]; if (!m) return; m.hp = q.hp; m.status = q.status; q.moves.forEach((x, k) => { if (m.moves[k]) m.moves[k].pp = x.pp; }); });
      this.sides[0].active = j.active; this.forced = !!j.forced;
      this.dehors = mes.every((q) => q.etat === 'dehors'); this.need[0] = mes.some((q) => q.etat === 'remplacer');
    }
    this.turn = p.turn;
    if (p.state === 'over') { this.state = 'over'; this.result = p.result; }
    else if (this.dehors) { this.state = 'over'; this.result = 'out'; }
    else this.state = p.state === 'switch' ? 'switch' : 'choose';
    this.equipiers?.maj(p, this);
  }
  traduire(evs) {
    const out = [];
    for (let k = 0; k < evs.length; k++) {
      const e = evs[k];
      if (e.t === 'end') { out.push(e); continue; }
      if (e.t === 'out' || e.t === 'switch-prompt') { out.push({ ...e, t: 'raid-' + e.t }); continue; }
      // ce qui arrive aux autres adversaires : leur ligne de l'encadré clignote
      if (e.side === 1 && e.place != null && e.place !== this.cible) { if (e.t !== 'move') out.push({ t: 'raid-adverse', place: e.place, k: e.t }); continue; }
      if (e.side === 0 && e.own !== this.monId) { if (e.t === 'move') out.push({ t: 'move', side: 0, move: e.move, type: e.type }); else out.push({ t: 'raid-equipier', own: e.own, k: e.t }); continue; }
      if (e.t === 'send' && e.side === 1) { out.push({ ...e, idx: e.place }); continue; }
      out.push(e);
    }
    return out;
  }
  duel(envoyer) {
    const d = super.duel(envoyer);
    d.sendAct = (n, action) => envoyer(action.type === 'multi' ? action : { type: action.type, idx: action.idx, cible: this.cible });
    return d;
  }
}

/** encadré du combat de groupe : équipiers, puis les autres adversaires */
Equipiers.prototype.majGroupe = function (p, miroir) {
  const ici = miroir.monId || this.moi, autres = p.joueurs.filter((j) => j.id !== ici);
  const ligne = (nom, m, cls, attr) => { const r = m ? Math.max(0, m.hp / m.max) : 0; return `<div class="raid-eq${cls}" ${attr}><img src="${m ? ASSETS.icon(m.sp) : ''}" alt=""><div><b>${esc(nom)}</b><span>${m ? 'N.' + m.lvl : ''}</span><i><u style="width:${r * 100}%;background:${hpCol(r)}"></u></i></div></div>`; };
  this.el.innerHTML = autres.map((j) => ligne(j.pid === this.moi ? monName(createMon(j.party[j.active].sp, j.party[j.active].lvl, { shiny: false })) : j.nom, j.party[j.active], j.etat === 'dehors' ? ' out' : '', `data-id="${esc(j.id)}"`)).join('');
  this.el.style.display = autres.length ? '' : 'none';
  // les autres Pokémon du dresseur, en haut à droite
  if (!this.adv) { this.adv = el('div', 'raid-equipe raid-adverses'); this.el.parentNode.appendChild(this.adv); }
  const enJeu = p.adverses.filter((a) => !a.vide), adv = enJeu.filter((a) => a.place !== miroir.cible), reserve = p.reste - enJeu.length;
  this.adv.innerHTML = adv.map((a) => ligne(monName(createMon(a.sp, a.lvl, { shiny: false })), a, ' adv', `data-place="${a.place}"`)).join('')
    + (reserve > 0 ? `<div class="raid-eq adv reste">Encore ${reserve} en réserve</div>` : '');
  this.adv.style.display = this.adv.innerHTML ? '' : 'none';
};
const majBase = Equipiers.prototype.maj;
Equipiers.prototype.maj = function (p, miroir) { return p?.adverses && miroir ? this.majGroupe(p, miroir) : majBase.call(this, p); };
Equipiers.prototype.flashAdverse = function (place) { const q = this.adv?.querySelector(`[data-place="${place}"]`); if (!q) return; q.classList.remove('hit'); void q.offsetWidth; q.classList.add('hit'); };

/** branche le combat de groupe : choix de la cible avant d'attaquer, adversaires dans l'encadré */
export function brancherGroupe(bv, miroir, moi) {
  const defaire = brancher(bv, miroir, moi), choisir = bv.chooseAction.bind(bv), play = bv.play;
  const montrerCible = async () => { bv.setHud(1, miroir.foe); await bv.loadSide(1); bv.st.foe.visible = true; miroir.equipiers?.maj(miroir.dernier, miroir); };
  const choisirUn = async () => {
    for (;;) {
      const a = await choisir();
      if (!a || a.type !== 'move') return a;
      const vivants = miroir.dernier.adverses.filter((x) => !x.vide);
      if (vivants.length < 2) return a;
      const noms = vivants.map((x) => `${monName(miroir.sides[1].party[x.place])} (${x.hp}/${x.max} PV)`);
      const r = await bv.ui.list({ title: 'Viser quel Pokémon ?', items: [...noms.map((l) => ({ label: l })), { label: 'Retour' }], cls: 'psub', cancel: vivants.length, start: Math.max(0, vivants.findIndex((x) => x.place === miroir.cible)) });
      if (r < 0 || r >= vivants.length) continue;
      if (vivants[r].place !== miroir.cible) { miroir.cible = vivants[r].place; miroir.sides[1].active = miroir.cible; await montrerCible(); }
      return a;
    }
  };
  bv.chooseAction = async () => {
    if (miroir.changeCible) { miroir.changeCible = false; await montrerCible(); }
    if (miroir.changePlace) { miroir.changePlace = false; await miroir.afficher(miroir.place, bv); }
    if (!miroir.multi) return choisirUn();
    // plusieurs Pokémon en jeu : un choix pour chacun, puis on revient au premier
    const places = miroir.dernier.joueurs.filter((q) => q.pid === miroir.moi && q.etat === 'choix').map((q) => q.k), actions = [];
    for (const k of places) {
      if (k !== miroir.place) await miroir.afficher(k, bv);
      const a = await choisirUn();
      if (!a || a.type === 'forfeit') { if (miroir.place !== places[0]) await miroir.afficher(places[0], bv); return a; }
      actions[k] = { type: a.type, idx: a.idx, cible: miroir.cible };
    }
    if (places.length && miroir.place !== places[0]) await miroir.afficher(places[0], bv);
    return { type: 'multi', actions };
  };
  bv.play = async (evs) => {
    const reste = [];
    for (const e of evs) { if (e.t === 'raid-adverse') { if (e.k === 'hp' || e.k === 'faint' || e.k === 'hit') miroir.equipiers?.flashAdverse(e.place); continue; } reste.push(e); }
    await play(reste);
    if (miroir.changeCible && miroir.state !== 'over') { miroir.changeCible = false; await montrerCible(); }
    if (miroir.changePlace && miroir.state !== 'over') { miroir.changePlace = false; await miroir.afficher(miroir.place, bv); }
    miroir.equipiers?.maj(miroir.dernier, miroir);
  };
  return () => { bv.play = play; bv.chooseAction = choisir; defaire(); };
}
