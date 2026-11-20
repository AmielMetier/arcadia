// odyssee/js/donjons/donjons.js — les donjons à plusieurs dans la partie : PNJ, portes scellées, combats, dalles,
// boss aux PV partagés, encadré d'avancement, et l'état partagé entre les joueurs du salon (l'hôte du salon fait
// autorité, voir etat.js). Repris du labo (TestOdyssée), réduit à ce dont les donjons du jeu ont besoin.
//
// Messages (tous préfixés « dj », mis de côté avant la liaison d'Odyssée) :
//   invité → hôte : { t: 'dj', id, m, rid }    demande (ouvrir, prendre, lacher, gagne, degats, dalles, recommencer)
//   hôte → invité : { t: 'djR', rid, ok, why }  réponse à une demande
//   hôte → tous   : { t: 'djE', id, e }         état complet d'un donjon après chaque changement
//   invité → hôte : { t: 'dj?' }                demande des états (à l'arrivée, et tant qu'on n'a rien reçu)
// Un donjon se refait autant qu'on veut ; sa récompense n'est donnée qu'une fois par partie (drapeau `<id>:recompense`).
import { createMon, healFull } from '../core/mon.js';
import { itemName } from '../core/items.js';
import { el, esc } from '../ui/ui.js';
import { T } from '../world/tiles.js';
import { nouvelEtat, appliquer, battu, prisPar, requisSalle } from './etat.js';
import { fermer, ouvrir, decorPorte } from './plan.js';
import CRYPTE from './crypte.js';

/** les donjons du jeu */
export const DONJONS = [CRYPTE];
const newRid = () => Math.random().toString(36).slice(2, 10);

export class Donjons {
  constructor(game, defs = DONJONS, H = null) {
    this.game = game; this.H = H && H.embedded ? H : null;
    this.defs = new Map(defs.filter((d) => game.world.maps[d.carte]).map((d) => [d.id, d]));
    this.etats = {}; this.vus = {};
    this.attentes = new Map(); this.recu = new Set(); this.taches = [];
    this.wasHost = this.hote;
    for (const d of this.defs.values()) {
      const m = game.world.maps[d.carte];
      d.cartes = [m.id];
      this.poserPnj(d, m);
      this.etats[d.id] = nouvelEtat(d);
      this.vus[d.id] = { run: 0, faites: new Set(), fini: false };
    }
    this.panel = el('div', 'dj-panel box'); this.panel.style.display = 'none';
    game.ui.root.appendChild(this.panel);
    // le journal du donjon se cache et revient : bouton de l'encadré, ou touche N
    try { this.journalCache = localStorage.getItem('odyssee:journalDonjon') === '1'; } catch { this.journalCache = false; }
    const basculer = () => { this.journalCache = !this.journalCache; try { localStorage.setItem('odyssee:journalDonjon', this.journalCache ? '1' : '0'); } catch {} this.panelHtml = null; this.majPanneau(); };
    this.panel.addEventListener('click', (ev) => {
      if (ev.target.closest('.dj-cacher, .dj-montrer')) { ev.stopPropagation(); basculer(); return; }
      if (!ev.target.closest('.dj-quitter') || !game.state || game.busy || game.bv.alive) return;
      game.busy = true; this.quitter().catch((e) => console.error(e)).finally(() => { game.busy = false; });
    });
    window.addEventListener('keydown', (ev) => {
      if (ev.code !== 'KeyN' || ev.repeat || ev.ctrlKey || ev.metaKey || ev.altKey || ev.target?.closest?.('input, textarea, [contenteditable]')) return;
      if (this.panel.style.display !== 'none') basculer();
    });
    // les messages des donjons ne passent pas par la liaison d'Odyssée
    const link = game.link;
    if (link) { const orig = link.receive.bind(link); link.receive = (from, m) => { if (typeof m?.t === 'string' && m.t.startsWith('dj')) return; orig(from, m); }; }
    if (this.H) { this.H.on('msg', (from, m) => this.recevoir(from, m)); this.H.on('roster', () => this.roster()); }
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
        when: () => (p.gardien ? true : p.boss ? !this.etats[d.id].fini : !battu(this.etats[d.id], d, k)),
        talk: async () => (p.gardien ? this.gardien(d) : p.boss ? this.boss(d, k) : this.adversaire(d, k)),
      });
    }
  }
  /** les portes et les PNJ suivent l'état ; les petites scènes se jouent quand une salle se termine */
  appliquerEtat(id) {
    const d = this.defs.get(id), e = this.etats[id], g = this.game, ici = this.estDans(d), m = g.world.maps[d.carte], P = m.donjon.plan;
    for (const s of d.salles) {
      if (!s.porte) continue;
      const cases = P.portes[s.porte] || [];
      for (const [i, [x, y]] of cases.entries()) {
        const k = x + ',' + y;
        if (e.salles[s.id].faite) { if (ouvrir(m, x, y) && g.mapObj === m) { g.view.decoAt.delete(k); g.view.rebuildAt(x, y); } }
        else if (m.get(x, y) !== T.BLOCK) { fermer(m, x, y, decorPorte(d, s.porte, i, cases.length)); if (g.mapObj === m) { g.view.decoAt.set(k, m.deco.find((q) => q.x === x && q.y === y)); g.view.rebuildAt(x, y); } }
      }
    }
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
      if (ici && s.type !== 'boss') this.taches.push(() => this.porteOuverte(d, s));
    }
    if (e.fini && !vu.fini) { vu.fini = true; if (ici) this.taches.push(() => this.victoire(d)); }
    this.majPanneau();
  }
  async porteOuverte(d, s) {
    const g = this.game;
    g.sound.sfx('bang'); g.view.shake = 0.2;
    g.ui.toast(s.type === 'accueil' ? 'La porte de la crypte s\'ouvre !' : `${s.nom} : terminée ! Une porte s'ouvre.`, 2200);
  }
  async victoire(d) {
    const g = this.game, st = g.state, e = this.etats[d.id], R = d.recompense || {};
    g.sound.play('victory');
    await g.ui.say(d.textes.victoire);
    const noms = e.vainqueurs.map((q) => this.nomDe(q)), boss = Object.values(d.pnj).find((p) => p.boss);
    if (noms.length > 1 && boss) await g.ui.say(`${boss.nom} a été vaincu par ${noms.slice(0, -1).join(', ')} et ${noms[noms.length - 1]} !`);
    // la récompense, une seule fois par partie
    const deja = 'D:' + d.id + ':recompense';
    if (!st.flags[deja]) {
      st.flags[deja] = true;
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

  /* ---------------- demandes ---------------- */
  /** le joueur (ou la carte mapId) est-il dans ce donjon ? */
  estDans(d, mapId) { const id = mapId ?? (this.game.state ? this.game.mapObj?.id : null); return !!id && d.cartes.includes(id); }
  dansUnDonjon() { return [...this.defs.values()].some((q) => this.estDans(q)); }
  presents(d) {
    let n = this.estDans(d) ? 1 : 0;
    for (const o of this.game.link?.others.values() || []) if (this.estDans(d, o.map)) n++;
    return n;
  }
  options(d, m) {
    if (m.a !== 'ouvrir') return {};
    const b = Object.values(d.pnj).find((p) => p.boss);
    return { joueurs: this.presents(d), bossPv: b ? createMon(b.equipe[0][0], b.equipe[0][1]).stats[0] : 0 };
  }
  /** demande à l'hôte (ou s'applique tout de suite chez l'hôte) ; renvoie { ok, why } */
  demande(id, m) {
    if (this.hote) return Promise.resolve(this.traiter(id, this.moi, m));
    const rid = newRid();
    this.H.send('host', { t: 'dj', id, m, rid });
    return new Promise((res) => {
      const t = setTimeout(() => { this.attentes.delete(rid); res({ ok: false, why: 'reseau' }); }, 5000);
      this.attentes.set(rid, (r) => { clearTimeout(t); res(r); });
    });
  }
  traiter(id, qui, m) {
    const d = this.defs.get(id); if (!d || !m || typeof m.a !== 'string') return { ok: false, why: 'inconnu' };
    const r = appliquer(d, this.etats[id], qui, m, this.options(d, m));
    if (r.change) this.diffuser(id);
    return { ok: r.ok, why: r.why };
  }
  diffuser(id) {
    if (this.H) this.H.send('all', { t: 'djE', id, e: this.etats[id] });
    this.appliquerEtat(id);
  }
  recevoir(from, m) {
    if (!m || typeof m.t !== 'string' || !m.t.startsWith('dj') || String(from) === this.moi) return;
    if (m.t === 'dj' && this.hote) { const r = this.traiter(m.id, String(from), m.m); this.H.send(from, { t: 'djR', rid: m.rid, ...r }); return; }
    if (m.t === 'dj?' && this.hote) { for (const id of this.defs.keys()) this.H.send(from, { t: 'djE', id, e: this.etats[id] }); return; }
    if (m.t === 'djR') { const f = this.attentes.get(m.rid); if (f) { this.attentes.delete(m.rid); f({ ok: !!m.ok, why: m.why }); } return; }
    if (m.t === 'djE' && !this.hote && String(from) === String(this.H.info.hostId) && this.defs.has(m.id) && m.e) {
      const cur = this.etats[m.id];
      if (m.e.run !== cur.run || m.e.v >= cur.v) { this.etats[m.id] = m.e; this.recu.add(m.id); this.appliquerEtat(m.id); }
    }
  }
  /** un joueur part : ses adversaires se libèrent ; un nouvel hôte reprend l'état qu'il connaît */
  roster() {
    if (!this.H) return;
    const ids = new Set(this.H.players.map((p) => String(p.id)));
    if (this.hote) for (const id of this.defs.keys()) {
      const e = this.etats[id], partis = new Set();
      for (const S of Object.values(e.salles)) for (const q of Object.values(S.pris)) if (!ids.has(q)) partis.add(q);
      for (const q of partis) this.traiter(id, q, { a: 'parti' });
      if (!this.wasHost) this.diffuser(id);
    }
    this.wasHost = this.hote;
  }
  /** quitter le donjon (menu, ou bouton de l'encadré) : retour dehors, devant la porte */
  async quitter() {
    const g = this.game, d = [...this.defs.values()].find((q) => this.estDans(q));
    if (!d) return false;
    if (!(await g.ui.yesNo(this.presents(d) > 1 ? 'Quitter le donjon ? Les autres pourront continuer sans toi.' : 'Quitter le donjon ?'))) return false;
    const dehors = g.world.maps[d.carte].outside;
    await g.warp({ map: dehors.map, x: dehors.x, y: dehors.y, dir: 'down' }, 'exit');
    return true;
  }
  /** porte de l'extérieur d'un donjon fermé à clé : true si le pas vers elle est refusé (elle s'ouvre une fois pour toutes) */
  porteACle(tx, ty) {
    const g = this.game, st = g.state;
    for (const d of this.defs.values()) {
      const E = d.cle && g.world.maps[d.carte]?.donjon?.exterieur, ouverte = 'D:' + d.id + ':ouverte';
      if (!E || !st || g.mapObj?.id !== E.carte.id || E.porte[0] !== tx || E.porte[1] !== ty || st.flags[ouverte]) continue;
      if (g.busy) return true;
      g.busy = true;
      (async () => {
        if (!st.bag[d.cle]) { await g.ui.say(d.textes?.porteFermee || 'La porte est fermée à clé.'); return false; }
        if (!(await g.ui.yesNo(d.textes?.porteCle || 'La porte est fermée. L\'ouvrir avec la clé ?'))) return false;
        g.sound.sfx('door'); st.flags[ouverte] = true;
        return true;
      })().then((ok) => { g.busy = false; const w = ok && E.carte.warpAt(tx, ty); if (w) g.warp(w, 'door'); }, () => { g.busy = false; });
      return true;
    }
    return false;
  }
  /** une partie sauvegardée dans un donjon reprend à son entrée (l'état du donjon, lui, n'est pas gardé) */
  reprise(state) {
    for (const d of this.defs.values()) if (d.cartes.includes(state.map)) { const [x, y] = this.game.world.maps[d.carte].donjon.plan.depart; Object.assign(state, { x, y, dir: 'up' }); }
  }

  /* ---------------- à chaque image ---------------- */
  tick(dt) {
    const g = this.game;
    // demande les états à l'hôte tant qu'on n'a rien reçu
    if (!this.hote && this.recu.size < this.defs.size) {
      this.askT = (this.askT || 0) - dt;
      if (this.askT <= 0) { this.askT = 2.5; this.H.send('host', { t: 'dj?' }); }
    }
    if (this.hote) {
      this.dallesT = (this.dallesT || 0) - dt;
      if (this.dallesT <= 0) { this.dallesT = 0.25; for (const d of this.defs.values()) this.verifierDalles(d); }
    }
    this.panT = (this.panT || 0) - dt;
    if (g.state && g.mapObj !== this.carteVue) {
      const avant = this.carteVue && [...this.defs.values()].find((q) => this.estDans(q, this.carteVue.id));
      if (avant && !this.estDans(avant, g.mapObj.id)) this.demande(avant.id, { a: 'sortie' });
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
      const P = g.world.maps[d.carte].donjon.plan, sur = new Set(P.dalles.map(([x, y]) => x + ',' + y));
      let n = 0;
      if (g.state && g.mapObj.id === d.carte && !g.player.move && sur.has(g.player.x + ',' + g.player.y)) n++;
      for (const o of g.link?.others.values() || []) if (o.map === d.carte && sur.has(o.x + ',' + o.y)) n++;
      if (!n && !e.salles[s.id].dalles) continue;
      this.traiter(d.id, this.moi, { a: 'dalles', salle: s.id, n, requis: requisSalle(d, s, P.dalles.length, this.presents(d)) });
    }
  }
  majPanneau() {
    const g = this.game, d = [...this.defs.values()].find((q) => this.estDans(q));
    if (!d) { this.panel.style.display = 'none'; return; }
    const e = this.etats[d.id], lignes = [], P = g.world.maps[d.carte].donjon.plan;
    for (const s of d.salles) {
      const S = e.salles[s.id];
      let txt = '';
      if (s.type === 'accueil') txt = S.faite ? 'ouverte' : 'parle au gardien';
      else if (s.type === 'combat') txt = `${S.battus.length}/${s.pnj.length} vaincus`;
      else if (s.type === 'dalles') txt = `dalles ${S.dalles}/${requisSalle(d, s, P.dalles.length, Math.max(1, this.presents(d)))}`;
      else if (s.type === 'boss') txt = e.boss ? `${e.boss.pv}/${e.boss.max} PV` : '—';
      lignes.push(`<div class="dj-l${S.faite ? ' ok' : ''}"><span>${esc(s.nom)}</span><b>${S.faite ? '✔' : esc(txt)}</b></div>`);
    }
    const html = this.journalCache ? `<button type="button" class="dj-montrer" tabindex="-1">Journal (N)</button>`
      : `<button type="button" class="dj-cacher" tabindex="-1" title="Cacher le journal (N)">–</button><div class="dj-t">${esc(d.nom)}</div>${lignes.join('')}<button type="button" class="dj-quitter" tabindex="-1">Quitter le donjon</button>`;
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
    const pris = prisPar(this.etats[d.id], d, k);
    if (pris && pris !== this.moi) { await ui.say(`${this.nomDe(pris)} l'affronte déjà !`); return; }
    if (!(await ui.yesNo(`${titre} flotte devant toi.\nL'affronter ?`))) return;
    const r = await this.demande(d.id, { a: 'prendre', pnj: k });
    if (!r.ok) {
      await ui.say(r.why === 'occupe' ? `${this.nomDe(prisPar(this.etats[d.id], d, k))} vient de l'engager !` : r.why === 'reseau' ? 'L\'hôte du salon ne répond pas...' : 'Il n\'y a plus personne à combattre ici.');
      return;
    }
    const party = p.equipe.map(([sp, lvl]) => createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false }));
    const res = await this.combat(p, party);
    if (res === 'win') await this.demande(d.id, { a: 'gagne', pnj: k });
    else { await this.demande(d.id, { a: 'lacher', pnj: k }); if (res === 'lose') await this.defaite(d); }
  }
  /** le boss : PV partagés par le groupe ; chacun l'affronte avec ce qu'il en reste, et lui retire ce qu'il a infligé */
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
    const res = await g.runBattle({ trainer: tr, party, music: p.musique || (p.boss ? 'legend' : 'trainer'), noWhiteout: true });
    g.musicLock = false; g.updateZone();
    return res;
  }
  /** une défaite : l'équipe est soignée et l'on revient à l'entrée de la crypte */
  async defaite(d) {
    const g = this.game, [x, y] = g.world.maps[d.carte].donjon.plan.depart;
    for (const m of g.state.party) healFull(m);
    await g.ui.say(d.textes.perdu);
    await g.warp({ map: d.carte, x, y, dir: 'up' }, 'exit');
  }
}
