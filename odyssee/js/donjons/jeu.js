// odyssee/js/donjons/jeu.js — les donjons dans la partie : PNJ, portes, combats, dalles, panneau d'avancement,
// et l'état partagé entre les joueurs du salon (l'hôte du salon fait autorité, voir etat.js).
//
// Messages (tous préfixés « dj », ignorés par la liaison d'Odyssée) :
//   invité → hôte : { t: 'dj', id, m, rid }    demande (prendre, lacher, gagne, degats, ouvrir, recommencer)
//   hôte → invité : { t: 'djR', rid, ok, why }  réponse à une demande
//   hôte → tous   : { t: 'djE', id, e }         état complet d'un donjon après chaque changement
//   invité → hôte : { t: 'dj?' }                demande des états (à l'arrivée, et tant qu'on n'a rien reçu)
import { createMon, healFull } from '../core/mon.js';
import { itemName } from '../core/items.js';
import { megaFormOf } from '../core/mega.js';
import { el, esc } from '../ui/ui.js';
import { nouvelEtat, appliquer, battu, prisPar, requisSalle } from './etat.js';
import { MOVES } from '../data/moves.js';
import { construireCarte, construireSalles, relierExterieur, fermer, ouvrir, decorPorte, passageSuivant } from './plan.js';
import { Mecaniques } from './mecaniques.js';
import { Miroirs } from './miroirs-jeu.js';
import { Voies } from './voies-jeu.js';
import { Classement } from './classement.js';
import { Autres } from './autres.js';
import { DONJONS } from './index.js';
import { validParty } from '../core/pvp.js';
import { T } from '../world/tiles.js';

const newRid = () => Math.random().toString(36).slice(2, 10);

export class Donjons {
  constructor(game, defs = DONJONS, H = null) {
    this.game = game; this.H = H && H.embedded ? H : null;
    this.defs = new Map(defs.map((d) => [d.id, d]));
    this.etats = {}; this.vus = {};
    this.attentes = new Map();
    this.recu = new Set();
    this.taches = [];
    this.erreurs = {}; this.raids = {}; this.equipesRaid = {};
    this.wasHost = this.hote;
    for (const d of defs) {
      // les cartes du donjon sont posées avec le monde (poserDonjon de index.js, appelé par buildWorld)
      const cartes = (d.cartes || []).map((id) => game.world.maps[id]).filter(Boolean);
      if (!cartes.length) { this.defs.delete(d.id); continue; }
      for (const c of cartes) { this.poserPnj(d, c); this.poserObjets(d, c); this.poserObjetsMiroirs(d, c); this.poserObjetsVoies(d, c); this.poserObjetsPyramide(d, c); this.poserObjetsMine(d, c); this.poserObjetsTrain(d, c); this.poserObjetsTemple(d, c); this.poserObjetsTombeau(d, c); this.poserObjetsContes(d, c); this.poserObjetsChateau(d, c); this.poserClassements(d, c); this.poserObjetsFonderie(d, c); this.poserObjetsCristal(d, c); this.poserObjetsArenes(d, c); this.poserObjetsCourse(d, c); }
      this.etats[d.id] = nouvelEtat(d);
      this.vus[d.id] = { run: 0, faites: new Set(), fini: false };
    }
    // pas d'ambiance de grotte (chauves-souris, cristaux qui scintillent, gouttes) dans les donjons
    const v = game.vie; if (v?.grotteAmbiance) { const f = v.grotteAmbiance.bind(v); v.grotteAmbiance = (on) => f(on && !game.mapObj?.donjon); }
    this.panel = el('div', 'dj-panel box'); this.panel.style.display = 'none';
    game.ui.root.appendChild(this.panel);
    // bouton « Quitter le donjon » de l'encadré
    // le journal du donjon se cache et revient : bouton de l'encadré, ou touche N (le choix vaut pour tous les donjons)
    try { this.journalCache = localStorage.getItem('labo:journalCache') === '1'; } catch { this.journalCache = false; }
    const basculer = () => { this.journalCache = !this.journalCache; try { localStorage.setItem('labo:journalCache', this.journalCache ? '1' : '0'); } catch {} this.panelHtml = null; this.majPanneau(); };
    this.panel.addEventListener('click', (ev) => { if (ev.target.closest('.dj-cacher, .dj-montrer')) { ev.stopPropagation(); basculer(); } });
    window.addEventListener('keydown', (ev) => {
      if (ev.code !== 'KeyN' || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || ev.target?.closest?.('input, textarea, [contenteditable]')) return;
      if (this.panel.style.display === 'none') return;
      basculer();
    });
    this.panel.addEventListener('click', (ev) => {
      if (!ev.target.closest('.dj-quitter') || !game.state || game.busy || game.bv.alive) return;
      game.busy = true; this.quitter().catch((e) => console.error(e)).finally(() => { game.busy = false; });
    });
    // les messages du donjon ne passent pas par la liaison d'Odyssée (elle les mettrait de côté)
    const link = game.link;
    if (link) { const orig = link.receive.bind(link); link.receive = (from, m) => { if (typeof m?.t === 'string' && m.t.startsWith('dj')) return; orig(from, m); }; }
    if (this.H) {
      this.H.on('msg', (from, m) => this.recevoir(from, m));
      this.H.on('roster', () => this.roster());
    }
    for (const id of this.defs.keys()) this.appliquerEtat(id);
  }

  get hote() { return !this.H || this.H.info.role !== 'guest'; }
  get moi() { return String(this.H ? this.H.info.myId : 0); }
  nomDe(id) { if (String(id) === this.moi) return this.game.state?.name || 'Toi'; return this.game.link?.others.get(String(id))?.name || this.H?.players.find((p) => String(p.id) === String(id))?.name || 'un autre joueur'; }

  /* ---------------- carte ---------------- */
  poserPnj(d, m) {
    for (const [k, [[x, y]]] of Object.entries(m.donjon.plan.pnj)) {
      const p = d.pnj[k];
      m.npc({
        id: `${d.id}:${p.id}`, x, y, dir: p.dir || 'down', sprite: p.sprite, move: 'static',
        when: () => {
          const e = this.etats[d.id], sr = p.raid && d.salles.find((s) => s.type === 'raid' && s.pnj?.includes(k));
          if (p.gardien || p.quiz || p.toujours || p.reste) return true;
          if (!this.presentPyr(d, p)) return false;
          if (sr) return !e.salles[sr.id].faite;
          return p.boss || p.raid ? !e.fini : !battu(e, d, k);
        },
        talk: async () => (p.reste && this.vaincu(d, k) ? this.resteGardien(d, k) : p.talisman ? this.talismanTemple(d) : p.moine ? this.moineTemple(d) : p.champion ? this.champion(d, k) : p.organisatrice ? this.organisatrice(d) : p.dit ? this.game.ui.say(p.dit, { speaker: `${p.cls} ${p.nom}`.trim() }) : p.arbitre ? this.arbitre(d, k) : p.duo ? this.duo(d, k) : p.gardien ? this.gardien(d) : p.quiz ? this.questionneur(d, k) : p.raid || p.groupe ? this.bossRaid(d, k) : p.boss ? this.boss(d, k) : this.adversaire(d, k)),
      });
    }
  }

  /** un PNJ qui reste après sa défaite (p.reste) : est-il battu ? */
  vaincu(d, k) { const e = this.etats[d.id], s = d.salles.find((q) => q.pnj?.includes(k)); return battu(e, d, k) || !!(s && s.type !== 'libre' && e.salles[s.id].faite); }

  /** portes et PNJ suivent l'état ; joue les petites scènes quand une salle se termine */
  appliquerEtat(id) {
    const d = this.defs.get(id), e = this.etats[id], g = this.game;
    const ici = this.estDans(d);
    // salles séparées : le passage vers la salle suivante s'ouvre quand la salle est terminée (ou s'il y a une porte)
    for (const s of d.salles) {
      if (!s.carte) continue;
      const m = g.world.maps[s.carte];
      if (passageSuivant(m, s.ouvertPar ? !!e.salles[s.id].donnees[s.ouvertPar] : e.salles[s.id].faite || s.type === 'libre' || !!s.porte, !!s.passageVu) && g.mapObj === m) { const [x, y] = m.donjon.plan.suivante; g.view.decoAt.delete(x + ',' + y); const dd = m.deco.find((q) => q.x === x && q.y === y); if (dd) g.view.decoAt.set(x + ',' + y, dd); g.view.rebuildAt(x, y); }
    }
    for (const s of d.salles) {
      if (!s.porte) continue;
      const m = g.world.maps[s.carte || d.carte], P = m.donjon.plan;
      const cases = P.portes[s.porte] || [];
      for (const [i, [x, y]] of cases.entries()) {
        const k = x + ',' + y;
        if (e.salles[s.id].faite) { if (ouvrir(m, x, y) && g.mapObj === m) { g.view.decoAt.delete(k); g.view.rebuildAt(x, y); } }
        else if (m.get(x, y) !== T.BLOCK) { fermer(m, x, y, decorPorte(d, s.porte, i, cases.length)); if (g.mapObj === m) { g.view.decoAt.set(k, m.deco.find((q) => q.x === x && q.y === y)); g.view.rebuildAt(x, y); } }
      }
    }
    this.appliquerMiroirs(d);
    this.appliquerVoies(d);
    this.appliquerPyramide(d);
    this.appliquerMine(d);
    this.appliquerTrain(d);
    this.appliquerTemple(d);
    this.appliquerTombeau(d);
    this.appliquerContes(d);
    this.appliquerChateau(d);
    this.verifierClassements(d);
    this.appliquerFonderie(d);
    if (ici) g.refreshNpcs();
    const vu = this.vus[id];
    // premier état connu : ce qui est déjà fait ne rejoue pas de scène ; nouvelle descente : tout se rejoue
    if (vu.run !== e.run) {
      const first = vu.run === 0;
      vu.run = e.run; vu.faites = first ? new Set(Object.entries(e.salles).filter(([, S]) => S.faite).map(([k]) => k)) : new Set(); vu.fini = first && e.fini;
    }
    for (const s of d.salles) {
      if (!e.salles[s.id].faite || vu.faites.has(s.id)) continue;
      vu.faites.add(s.id);
      // salles séparées : seulement pour qui est dans la salle
      if (ici && s.type !== 'boss' && (!s.carte || g.mapObj?.id === s.carte)) this.taches.push(() => this.porteOuverte(d, s));
    }
    if (e.fini && !vu.fini) { vu.fini = true; if (ici && !d.solo && !d.pyramide && !d.salles.some((s) => s.type === 'raid')) this.taches.push(() => this.victoire(d)); }
    this.majPanneau();
  }
  async porteOuverte(d, s) {
    const g = this.game;
    // ces salles racontent elles-mêmes leur fin
    if (s.type === 'enigme' || s.type === 'reflet' || this.porteOuvertePyr(d, s)) return;
    if (s.type === 'lumiere') { g.sound.sfx('badge'); g.view.shake = 0.3; await g.ui.say(d.textes.porteOuverte); return; }
    g.sound.sfx('bang'); g.view.shake = 0.2;
    if (s.parchemin) { g.ui.toast(`${s.nom} : terminée ! Un parchemin est apparu.`, 2600); return; }
    if (s.type === 'raid') return;
    g.ui.toast(s.type === 'accueil' ? 'La porte de la crypte s\'ouvre !' : `${s.nom} : terminée ! Une porte s'ouvre.`, 2200);
  }
  async victoire(d) {
    const g = this.game, st = g.state, e = this.etats[d.id], R = d.recompense || {};
    g.sound.play('victory');
    await this.trophee(d);
    await g.ui.say(d.textes.victoire);
    const noms = e.vainqueurs.map((q) => this.nomDe(q));
    const boss = Object.values(d.pnj).find((p) => p.boss);
    if (noms.length > 1 && boss) await g.ui.say(`${boss.nom} a été vaincu par ${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]} !`);
    // la récompense, une seule fois par partie (le donjon, lui, se refait)
    if (this.premiereFois(d)) {
      if (R.argent) { st.money += R.argent; await g.ui.say(`${st.name} reçoit ${R.argent.toLocaleString('fr-FR')} ₽ !`); }
      for (const [k, n] of Object.entries(R.objets || {})) if (n > 0) { g.give(k, n); g.sound.sfx('item'); await g.ui.say(`${st.name} reçoit ${n > 1 ? n + ' × ' : ''}${itemName(k)} !`); }
      g.save?.(true);
    }
    for (const mon of st.party) healFull(mon);
    await g.ui.say('Le fossoyeur t\'attend à l\'entrée. Il peut rouvrir la crypte pour une nouvelle descente.');
    const [x, y] = g.world.maps[d.carte].donjon.plan.depart;
    await g.warp({ map: d.carte, x, y, dir: 'up' }, 'exit');
    g.updateZone();
  }

  /** la récompense d'un donjon n'est donnée qu'une fois par partie : true la première fois (et le note) */
  premiereFois(d) { const st = this.game.state, k = 'D:' + d.id + ':recompense'; if (st.flags[k]) return false; st.flags[k] = true; return true; }
  /** une partie sauvegardée dans un donjon reprend à l'entrée de la salle où elle était (l'état du donjon n'est pas gardé) */
  reprise(state) {
    for (const d of this.defs.values()) {
      if (!d.cartes.includes(state.map)) continue;
      const m = this.game.world.maps[d.solo || !d.plan ? d.cartes[0] : d.carte], [x, y] = m.donjon.plan.depart;
      Object.assign(state, { map: m.id, x, y, dir: 'up' });
    }
  }
  /** un donjon fini : sa statue rejoint les trophées de l'île du joueur */
  async trophee(d) {
    const t = this.game.ile?.debloquer(d.id); if (!t) return;
    this.game.sound.sfx('badge');
    await this.game.ui.say(`Nouveau trophée pour ton île : ${t.nom} !\nTu peux le poser sur ton île ou l'exposer au musée.`);
  }

  /* ---------------- demandes ---------------- */
  /** le joueur (ou la carte mapId) est-il dans ce donjon ? */
  estDans(d, mapId) { const id = mapId ?? (this.game.state ? this.game.mapObj?.id : null); return !!id && (d.cartes || [d.carte]).includes(id); }
  presents(d) {
    const g = this.game; let n = this.estDans(d) ? 1 : 0;
    for (const o of g.link?.others.values() || []) if (this.estDans(d, o.map)) n++;
    return n;
  }
  options(d, m) {
    if (m.a !== 'ouvrir') return {};
    const b = Object.values(d.pnj).find((p) => p.boss);
    return { joueurs: this.presents(d), bossPv: b ? createMon(b.equipe[0][0], b.equipe[0][1]).stats[0] : 0 };
  }
  /** demande à l'hôte (ou s'applique tout de suite chez l'hôte) ; renvoie { ok, why } */
  demande(id, m) {
    // un donjon solo n'est pas partagé : chacun tient le sien
    if (this.hote || this.defs.get(id)?.solo) return Promise.resolve(this.traiter(id, this.moi, m));
    const rid = newRid();
    this.H.send('host', { t: 'dj', id, m, rid });
    return new Promise((res) => {
      const t = setTimeout(() => { this.attentes.delete(rid); res({ ok: false, why: 'reseau' }); }, 5000);
      this.attentes.set(rid, (r) => { clearTimeout(t); res(r); });
    });
  }
  traiter(id, qui, m) {
    const d = this.defs.get(id); if (!d || !m || typeof m.a !== 'string') return { ok: false, why: 'inconnu' };
    if (validParty(m.party)) (this.equipesRaid[id] ||= {})[String(qui)] = m.party;
    if (m.a === 'pret') (this.testRaid ||= {})[String(qui)] = !!m.test;
    const r = appliquer(d, this.etats[id], qui, m, this.options(d, m));
    if (r.change) this.diffuser(id);
    return { ok: r.ok, why: r.why };
  }
  diffuser(id) {
    if (this.H && !this.defs.get(id).solo) this.H.send('all', { t: 'djE', id, e: this.etats[id] });
    this.appliquerEtat(id);
  }
  recevoir(from, m) {
    if (!m || typeof m.t !== 'string' || !m.t.startsWith('dj') || String(from) === this.moi) return;
    if (m.t.startsWith('djHor')) { this.game.horloge?.recevoir(String(from), m, this); return; }
    if (m.t === 'dj' && this.hote) { const r = this.traiter(m.id, String(from), m.m); this.H.send(from, { t: 'djR', rid: m.rid, ...r }); return; }
    if (m.t === 'dj?' && this.hote) { for (const [id, d] of this.defs) if (!d.solo) this.H.send(from, { t: 'djE', id, e: this.etats[id] }); return; }
    if (m.t === 'djRA' && this.hote) { this.actionRaid(String(from), m.id, m.action); return; }
    if (m.t === 'djRaid' && String(from) === String(this.H.info.hostId)) { this.recevoirRaid(m); return; }
    if (m.t === 'djPyr' && String(from) === String(this.H.info.hostId)) { this.recevoirPyr(m); return; }
    if (m.t === 'djTemple' && String(from) === String(this.H.info.hostId)) { this.recevoirTemple(m); return; }
    if (m.t === 'djDefA' && this.hote) { this.actionDef(String(from), m); return; }
    if (m.t === 'djDef' && String(from) === String(this.H.info.hostId)) { this.recevoirDef(m); return; }
    if (m.t === 'djR') { const f = this.attentes.get(m.rid); if (f) { this.attentes.delete(m.rid); f({ ok: !!m.ok, why: m.why }); } return; }
    if (m.t === 'djE' && !this.hote && String(from) === String(this.H.info.hostId) && this.defs.has(m.id) && !this.defs.get(m.id).solo && m.e) {
      const cur = this.etats[m.id];
      if (m.e.run !== cur.run || m.e.v >= cur.v) { this.etats[m.id] = m.e; this.recu.add(m.id); this.appliquerEtat(m.id); }
    }
  }
  /** un joueur part : ses adversaires se libèrent ; un nouvel hôte reprend l'état qu'il connaît */
  roster() {
    if (!this.H) return;
    const ids = new Set(this.H.players.map((p) => String(p.id)));
    if (this.hote) {
      for (const id of this.defs.keys()) {
        const e = this.etats[id], partis = new Set();
        for (const S of Object.values(e.salles)) for (const q of Object.values(S.pris)) if (!ids.has(q)) partis.add(q);
        for (const q of partis) this.traiter(id, q, { a: 'parti' });
        for (const S of Object.values(e.salles)) for (const q of [...Object.values(S.cles).map((c) => c.a), ...S.prets]) if (!ids.has(q)) this.traiter(id, q, { a: 'parti' });
        if (!this.wasHost) this.diffuser(id);
      }
    }
    if (this.hote) for (const R of Object.values(this.raids)) for (const q of R.ids) if (!ids.has(q)) this.retirerRaid(q);
    // l'hôte est parti pendant un combat : il s'arrête pour ceux qui le jouaient
    if (this.miroir && !this.hote && !ids.has(String(this.miroirHote))) this.miroir.recevoir({ parti: true });
    this.wasHost = this.hote;
  }
  /** quitter le donjon (menu, ou bouton de l'encadré) : retour dehors, devant la porte */
  async quitter() {
    const g = this.game, d = [...this.defs.values()].find((q) => this.estDans(q));
    if (!d) return false;
    const q = d.solo ? 'Quitter le donjon ? Il sera remis à zéro.' : this.presents(d) > 1 ? 'Quitter le donjon ? Les autres pourront continuer sans toi.' : 'Quitter le donjon ?';
    if (!(await g.ui.yesNo(q))) return false;
    const dehors = g.world.maps[d.carte].outside;
    if (!dehors) { this.onQuitter?.(); return true; }
    await g.warp({ map: dehors.map, x: dehors.x, y: dehors.y, dir: 'down' }, 'exit');
    return true;
  }
  /** salles séparées du donjon où l'on est (mode test : y aller directement) */
  sallesDuDonjon() { const d = [...this.defs.values()].find((q) => this.estDans(q)); return d?.cartes?.length > 1 ? d.salles.filter((s) => s.carte) : []; }
  async allerSalle() {
    const g = this.game, l = this.sallesDuDonjon(); if (!l.length) return false;
    const r = await g.ui.list({ title: 'Aller à une salle', items: [...l.map((s) => ({ label: s.nom })), { label: 'Retour' }], cls: 'shop', cancel: l.length });
    if (r < 0 || r >= l.length) return false;
    const m = g.world.maps[l[r].carte], [x, y] = m.donjon.plan.depart;
    await g.warp({ map: m.id, x, y, dir: 'up' }, 'exit');
    return true;
  }
  /** porte de l'extérieur d'un donjon fermé à clé (cle du donjon) : true si le pas vers elle est refusé */
  porteACle(tx, ty) {
    const g = this.game;
    for (const d of this.defs.values()) {
      const E = d.cle && g.world.maps[d.carte]?.donjon?.exterieur;
      const st = g.state, ouverte = 'D:' + d.id + ':ouverte';
      if (!E || !st || g.mapObj?.id !== E.carte.id || E.porte[0] !== tx || E.porte[1] !== ty || st.flags[ouverte]) continue;
      if (g.busy) return true;
      g.busy = true;
      (async () => {
        if (!st.bag[d.cle]) { await g.ui.say(d.textes?.porteFermee || 'La porte est fermée à clé.'); return false; }
        if (!(await g.ui.yesNo(d.textes?.porteCle || 'La porte est fermée. L\'ouvrir avec la clé ?'))) return false;
        st.flags[ouverte] = true;
        return true;
      })().then((ok) => { g.busy = false; const w = ok && E.carte.warpAt(tx, ty); if (w) g.warp(w, 'door'); }, () => { g.busy = false; });
      return true;
    }
    return false;
  }
  dansUnDonjon() { return [...this.defs.values()].some((q) => this.estDans(q)); }
  /** on quitte un donjon (autre lieu, changement de lieu) : les objets de quête disparaissent */
  sortir(d) {
    const st = this.game.state;
    for (const q of d ? [d] : this.defs.values()) {
      if (!q.solo) { this.sortiePyramide(q); this.demande(q.id, { a: 'sortie' }); continue; }
      // donjon solo : il se remet à zéro, et ses objets propres quittent le Sac
      this.demande(q.id, { a: 'recommencer' });
      if (st) for (const k of q.objetsDuDonjon || []) delete st.bag[k];
    }
  }

  /* ---------------- à chaque image ---------------- */
  tick(dt) {
    const g = this.game;
    // demande les états à l'hôte tant qu'on n'a rien reçu
    if (!this.hote && this.recu.size < [...this.defs.values()].filter((q) => !q.solo).length) {
      this.askT = (this.askT || 0) - dt;
      if (this.askT <= 0) { this.askT = 2.5; this.H.send('host', { t: 'dj?' }); }
    }
    if (this.hote) {
      this.dallesT = (this.dallesT || 0) - dt;
      if (this.dallesT <= 0) { this.dallesT = 0.25; for (const d of this.defs.values()) { this.verifierDalles(d); this.verifierRaid(d); this.verifierPlaques(d); } }
    }
    this.tickMiroirs(dt);
    this.tickVoies(dt);
    this.tickPyramide(dt);
    this.tickMine(dt);
    this.tickTrain(dt);
    this.tickTemple(dt);
    this.tickTombeau(dt);
    this.tickContes(dt);
    for (const d of this.defs.values()) if (d.classements && this.estDans(d)) this.chronoDonjon(d);
    this.tickFonderie(dt);
    this.tickCourse(dt);
    this.tickCristal(dt);
    this.tickArenes(dt);
    // salles sombres des Trois Voies : on y voit sur la moitié de l'écran, en cercle
    g.ui.root.classList.toggle('demi-nuit', !!(g.state && g.mapObj?.vueLarge));
    this.panT = (this.panT || 0) - dt;
    if (g.state && g.mapObj !== this.carteVue) {
      const avant = this.carteVue && [...this.defs.values()].find((q) => this.estDans(q, this.carteVue.id));
      if (avant && !this.estDans(avant, g.mapObj.id)) this.sortir(avant);
      const apres = [...this.defs.values()].find((q) => this.estDans(q, g.mapObj.id));
      if (apres && apres !== avant) { this.entreePyramide(apres).catch((e) => console.error(e)); this.entreeTrain(apres).catch((e) => console.error(e)); this.entreeArene(apres); }
    }
    if (g.state && (g.mapObj !== this.carteVue || this.panT <= 0)) { this.carteVue = g.mapObj; this.panT = 0.5; this.majPanneau(); }
    if (this.taches.length && g.state && !g.busy && !g.player.move && g.input.free && !g.bv.alive) {
      const f = this.taches.shift(); g.busy = true;
      f().catch((e) => console.error(e)).finally(() => { g.busy = false; });
    }
  }
  verifierDalles(d) {
    const e = this.etats[d.id], g = this.game;
    for (const s of d.salles) {
      if (s.type !== 'dalles' || e.salles[s.id].faite) continue;
      // salles séparées : les dalles sont sur la carte de leur salle
      const carte = s.carte || d.carte, P = g.world.maps[carte].donjon.plan, sur = new Set(P.dalles.map(([x, y]) => x + ',' + y));
      let n = 0;
      if (g.state && g.mapObj.id === carte && !g.player.move && sur.has(g.player.x + ',' + g.player.y)) n++;
      for (const o of g.link?.others.values() || []) if (o.map === carte && sur.has(o.x + ',' + o.y)) n++;
      if (!n && !e.salles[s.id].dalles) continue;
      this.traiter(d.id, this.moi, { a: 'dalles', salle: s.id, n, requis: this.game.modeTest ? 1 : requisSalle(d, s, P.dalles.length, this.presents(d)) });
    }
  }

  majPanneau() {
    const g = this.game, d = [...this.defs.values()].find((q) => this.estDans(q));
    if (!d) { this.panel.style.display = 'none'; return; }
    const e = this.etats[d.id], lignes = [];
    // chemins séparés : seulement les salles communes et celles de son propre chemin
    const voie = this.maVoie?.(d);
    for (const s of d.salles) {
      if (s.voie && s.voie !== voie) continue;
      if (s.pourVoies && voie && !s.pourVoies.includes(voie)) continue;
      if (!this.salleVisibleTemple(d, s)) continue;
      // le tombeau a dix salles : seulement celle où l'on est
      if ((d.tombeau || d.contes || d.liens) && s.carte !== g.mapObj?.id) continue;
      const S = e.salles[s.id];
      let txt = '';
      if (s.type === 'accueil') txt = S.faite ? 'ouverte' : 'parle au gardien';
      else if (s.type === 'combat') txt = `${S.battus.length}/${s.pnj.length} vaincus`;
      const P = g.world.maps[s.carte || d.carte].donjon.plan;
      if (s.type === 'dalles') txt = S.faite ? 'faite' : `dalles ${S.dalles}/${g.modeTest ? 1 : requisSalle(d, s, P.dalles.length, Math.max(1, this.presents(d)))}`;
      else if (s.type === 'boss') txt = e.boss ? `${e.boss.pv}/${e.boss.max} PV` : '—';
      else if (s.type === 'serrures') txt = `serrures ${Object.values(S.cles).filter((c) => c.mise).length}/${s.pnj.length}`;
      else if (s.type === 'raid') txt = S.combat ? 'combat en cours' : `prêts ${S.prets.length}`;
      else if (s.type === 'groupe') txt = S.combat ? 'combat en cours' : `${S.battus.length}/${s.pnj.length} vaincus`;
      else if (s.type === 'enigme') txt = s.suivi || 'lis le panneau';
      else if (s.type === 'libre') txt = 'à explorer';
      else if (s.type === 'lumiere') txt = (S.donnees.feux || 0) < 5 ? `brasier ${S.donnees.feux || 0}/5` : `soleils ${(S.donnees.soleils || []).length}/2`;
      else if (s.type === 'reflet') txt = 'rejoins ton reflet';
      else if (s.type === 'voies') txt = voie ? d.voies[voie] : 'choisis ta porte';
      else if (s.type === 'menteurs') txt = 'trouve les sincères';
      else if (this.textePyramide(d, s)) txt = this.textePyramide(d, s);
      if (this.texteMine(d, s)) txt = this.texteMine(d, s);
      if (this.texteTrain(d, s)) txt = this.texteTrain(d, s);
      if (this.texteTemple(d, s)) txt = this.texteTemple(d, s);
      if (this.texteTombeau(d, s)) txt = this.texteTombeau(d, s);
      if (this.texteContes(d, s)) txt = this.texteContes(d, s);
      if (this.texteChateau(d, s)) txt = this.texteChateau(d, s);
      if (this.texteFonderie(d, s)) txt = this.texteFonderie(d, s);
      if (this.texteCristal(d, s)) txt = this.texteCristal(d, s);
      if (this.texteCourse(d, s)) txt = this.texteCourse(d, s);
      if (s.type === 'voies' && !voie) { lignes.push(`<div class="dj-l"><span>${esc(s.nom)}</span><b>${esc(txt)}</b></div>`); continue; }
      if (s.type === 'libre') { lignes.push(`<div class="dj-l"><span>${esc(s.nom)}</span><b>${esc(txt)}</b></div>`); continue; }
      lignes.push(`<div class="dj-l${S.faite ? ' ok' : ''}"><span>${esc(s.nom)}</span><b>${S.faite ? '✔' : esc(txt)}</b></div>`);
    }
    const html = this.journalCache ? `<button type="button" class="dj-montrer" tabindex="-1">Journal (N)</button>`
      : `<button type="button" class="dj-cacher" tabindex="-1" title="Cacher le journal (N)">–</button><div class="dj-t">${esc(d.nom)}</div>${this.panneauTombeau(d)}${this.panneauContes(d)}${lignes.join('')}<button type="button" class="dj-quitter" tabindex="-1">Quitter le donjon</button>`;
    this.panel.classList.toggle('cache', !!this.journalCache);
    if (html !== this.panelHtml) { this.panelHtml = html; this.panel.innerHTML = html; }
    this.panel.style.display = '';
  }

  /* ---------------- PNJ ---------------- */
  async gardien(d) {
    const g = this.game, ui = g.ui, e = this.etats[d.id], who = d.pnj.g?.nom || 'Gardien';
    const accueil = d.salles.find((s) => s.type === 'accueil'), ouverteDeja = e.salles[accueil.id].faite;
    const opts = ouverteDeja ? ['Explications', 'Soigner mon équipe', 'Recommencer la crypte', 'Rien'] : ['Ouvrir la crypte', 'Explications', 'Soigner mon équipe', 'Rien'];
    const c = opts[await ui.ask(ouverteDeja ? (e.fini ? 'La crypte est calme. Tu veux y redescendre ?' : 'La crypte est ouverte. Bonne chance là-dessous.') : 'Tu veux entrer dans la crypte ?', opts, { speaker: who })];
    if (c === 'Explications') await ui.say(d.textes.gardien, { speaker: who });
    else if (c === 'Soigner mon équipe') { g.sound.sfx('heal'); for (const m of g.state.party) healFull(m); await ui.say('Voilà, ton équipe est en pleine forme.', { speaker: who }); }
    else if (c === 'Ouvrir la crypte') {
      const n = this.presents(d);
      if (!(await ui.yesNo(`${n > 1 ? `Vous êtes ${n} dans la crypte.` : 'Tu es seul dans la crypte.'} Les PV d'Ossarion dépendent du nombre de joueurs présents. On ouvre ?`, { speaker: who }))) return;
      const r = await this.demande(d.id, { a: 'ouvrir' });
      if (r.ok) await ui.say(d.textes.ouverture, { speaker: who });
      else if (r.why === 'reseau') await ui.say('L\'hôte du salon ne répond pas...');
    } else if (c === 'Recommencer la crypte') {
      if (!(await ui.yesNo('Tout refermer et repartir de zéro, pour tout le groupe ?', { speaker: who }))) return;
      await this.demande(d.id, { a: 'recommencer' });
      await ui.say('Les portes se referment, les esprits reprennent leur place.', { speaker: who });
    }
  }

  async adversaire(d, k) {
    const g = this.game, ui = g.ui, p = d.pnj[k], titre = `${p.cls} ${p.nom}`;
    const e = this.etats[d.id], pris = prisPar(e, d, k);
    if (pris && pris !== this.moi) { await ui.say(`${this.nomDe(pris)} l'affronte déjà !`); return; }
    if (p.defi) await ui.say(p.defi, { speaker: titre });
    if (!(await ui.yesNo(p.defi ? 'L\'affronter ?' : d.pyramide ? `${titre} te barre la route.\nL'affronter ?` : `${titre} flotte devant toi.\nL'affronter ?`))) return;
    const r = await this.demande(d.id, { a: 'prendre', pnj: k });
    if (!r.ok) {
      await ui.say(r.why === 'occupe' ? `${this.nomDe(prisPar(this.etats[d.id], d, k))} vient de l'engager !` : r.why === 'reseau' ? 'L\'hôte du salon ne répond pas...' : 'Il n\'y a plus personne à combattre ici.');
      return;
    }
    const idm = (q) => (typeof q === 'string' ? Object.values(MOVES).find((x) => x.key === q)?.id : q);
    const party = p.equipe.map(([sp, lvl, item, moves, ability, extra]) => Object.assign(createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false, item: item || null, moves: moves?.map(idm), ability }), extra || {}));
    const res = await this.combat(p, party);
    if (res === 'win') await this.demande(d.id, { a: 'gagne', pnj: k });
    else { await this.demande(d.id, { a: 'lacher', pnj: k }); await this.defaite(d); }
  }

  async boss(d, k) {
    const g = this.game, ui = g.ui, p = d.pnj[k], e = this.etats[d.id];
    if (e.fini || !e.boss) return;
    if (!(await ui.yesNo(`${p.cls} ${p.nom} se dresse devant toi. (${e.boss.pv}/${e.boss.max} PV pour tout le groupe)\nL'affronter ?`))) return;
    const now = this.etats[d.id].boss;
    if (!now || now.pv <= 0) return;
    const mon = createMon(p.equipe[0][0], p.equipe[0][1], { iv: Array(6).fill(31), shiny: false });
    mon.stats[0] = now.max; mon.hp = now.pv;
    const debut = mon.hp;
    const res = await this.combat(p, [mon]);
    const n = debut - Math.max(0, mon.hp);
    if (n > 0) await this.demande(d.id, { a: 'degats', n });
    if (res !== 'win') {
      if (n > 0 && !this.etats[d.id].fini) await ui.say(`Tu as infligé ${n} PV à ${p.nom}. Il lui en reste ${this.etats[d.id].boss.pv}.`);
      if (res === 'lose') await this.defaite(d);
    }
  }

  async combat(p, party) {
    const g = this.game;
    g.musicLock = true;
    const tr = { cls: p.cls, name: p.nom, prize: p.prix ?? 0, bs: p.bs || p.sprite, ai: 'smart', items: {}, lose: p.perd || '...' };
    // une copie (miroirs) garde l'objet de l'original : pas de gemme donnée par Odyssée, Méga seulement si l'original tient la sienne
    if (p.copie) Object.assign(tr, { megaSp: 'copie', mega: party.some((m) => megaFormOf(m)) });
    const res = await g.runBattle({ trainer: tr, party, music: p.musique || (p.boss ? 'legend' : 'trainer'), noWhiteout: true });
    g.musicLock = false; g.updateZone();
    return res;
  }
  async defaite(d) {
    // pyramide : on est ramené dehors
    if (d.pyramide) return this.elimine(d);
    if (d.tombeau) return this.defaiteTombeau(d);
    // salles séparées : on revient à l'entrée de la salle où l'on est
    const g = this.game, carte = d.cartes?.includes(g.mapObj?.id) ? g.mapObj : g.world.maps[d.carte], [x, y] = carte.donjon.plan.depart;
    for (const m of g.state.party) healFull(m);
    await g.ui.say(d.textes.perdu);
    await g.warp({ map: carte.id, x, y, dir: 'up' }, 'exit');
  }
}

Object.assign(Donjons.prototype, Autres, Mecaniques, Miroirs, Voies, Classement);
