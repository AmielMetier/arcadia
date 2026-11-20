// odyssee/js/donjons/mecaniques.js — mécaniques de donjon réutilisables, ajoutées à la classe Donjons (jeu.js) :
// PNJ à question (une bonne réponse ouvre un combat, la victoire donne une clé ; une mauvaise coûte des PV),
// ascenseur à serrures, journal du donjon, et combat à plusieurs contre un boss (raid).
//
// Raid, messages en plus de ceux de jeu.js :
//   hôte → participants : { t: 'djRaid', id, etape: 'debut' | 'tour', evs, photo, boss }
//   participant → hôte  : { t: 'djRA', id, action }   choix du tour (attaque, changement, abandon)
import { createMon, healFull } from '../core/mon.js';
import { itemName } from '../core/items.js';
import { validParty } from '../core/pvp.js';
import { clesDe, serrures } from './etat.js';
import { aCote } from './plan.js';
import { Raid } from './combat/raid.js';
import { MOVES } from '../data/moves.js';
import { CombatMiroir, GroupeMiroir, brancher, brancherGroupe } from './combat/vue.js';
import { Groupe } from './combat/groupe.js';
import { battu, prisPar } from './etat.js';
import { DIRS, walkable } from '../world/tiles.js';
import { wait } from '../ui/ui.js';

const melange = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const copie = (o) => JSON.parse(JSON.stringify(o));

export const Mecaniques = {
  /* ---------------- objets du plan ---------------- */
  poserObjets(d, m) {
    for (const [c, l] of Object.entries(m.donjon.plan.objets)) {
      const o = d.objets[c];
      if (o.type !== 'ascenseur') continue;
      for (const [x, y] of l) m.object(x, y, { use: () => this.ascenseur(d, c) });
    }
  },
  async ascenseur(d, c) {
    const g = this.game, ui = g.ui, o = d.objets[c], e = this.etats[d.id], m = g.world.maps[d.carte], P = m.donjon.plan;
    const aller = async (vers) => { const [x, y] = aCote(m, P, vers); g.sound.sfx('pc'); await g.warp({ map: d.carte, x, y, dir: 'down' }, 'exit'); };
    if (!o.salle) { if (await ui.yesNo('Redescendre ?')) await aller(o.vers); return; }
    const S = e.salles[o.salle], n = o.serrures || 3;
    if (S.faite) {
      const opts = e.fini ? ['Monter', 'Remettre le donjon à zéro', 'Rien'] : ['Monter', 'Rien'];
      const r = opts[await ui.ask('L\'ascenseur est déverrouillé.', opts)];
      if (r === 'Monter') await aller(o.vers);
      else if (r === 'Remettre le donjon à zéro' && await ui.yesNo('Tout remettre à zéro, pour tout le groupe ?')) await this.demande(d.id, { a: 'recommencer' });
      return;
    }
    await ui.say(`${d.textes.ascenseur}\nSerrures remplies : ${serrures(d, e)}/${n}.`);
    const miennes = clesDe(d, e, this.moi);
    if (!miennes.length) return;
    const noms = miennes.map((k) => d.pnj[k].cle).join(', ');
    if (!(await ui.yesNo(`Mettre ${miennes.length > 1 ? 'tes clés' : 'ta clé'} dans les serrures ? (${noms})`))) return;
    const r = await this.demande(d.id, { a: 'inserer', salle: o.salle });
    if (!r.ok) { await ui.say(r.why === 'reseau' ? 'L\'hôte du salon ne répond pas...' : 'Les serrures ne bougent pas.'); return; }
    g.sound.sfx('item');
    const e2 = this.etats[d.id];
    await ui.say(e2.salles[o.salle].faite ? 'Clac ! La dernière serrure tourne : l\'ascenseur est déverrouillé !' : `Clac ! Serrures remplies : ${serrures(d, e2)}/${n}.`);
  },

  /* ---------------- PNJ à question ---------------- */
  async questionneur(d, k) {
    const g = this.game, ui = g.ui, p = d.pnj[k], who = `${p.cls} ${p.nom}`, e = this.etats[d.id];
    const salle = d.salles.find((s) => s.pnj?.includes(k)), S = e.salles[salle.id];
    const c = S.cles[k];
    if (c) { await ui.say(c.a === this.moi ? (c.mise ? 'Ma clé est dans sa serrure. Va.' : 'Tu as ma clé. L\'ascenseur t\'attend, au centre de la salle.') : `J'ai confié ma clé à ${this.nomDe(c.a)}.`, { speaker: who }); return; }
    const pris = S.pris[k];
    if (pris && pris !== this.moi) { await ui.say(`${this.nomDe(pris)} est déjà en train de me répondre.`, { speaker: who }); return; }
    const r0 = await this.demande(d.id, { a: 'prendre', pnj: k });
    if (!r0.ok) { await ui.say(r0.why === 'occupe' ? `${this.nomDe(S.pris[k])} vient de me parler.` : r0.why === 'reseau' ? 'L\'hôte du salon ne répond pas...' : '...', { speaker: who }); return; }
    const Q = d.questions[p.quiz], ordre = melange(Q.r.map((t, i) => ({ t, juste: i === 0 })));
    await ui.say(d.textes.adepte, { speaker: who });
    const i = await ui.ask(Q.q, ordre.map((x) => x.t).concat(['Je reviendrai plus tard']), { speaker: who, cancel: ordre.length });
    if (i < 0 || i >= ordre.length) { await this.demande(d.id, { a: 'lacher', pnj: k }); return; }
    if (!ordre[i].juste) {
      await this.demande(d.id, { a: 'lacher', pnj: k });
      g.sound.sfx('hitstrong'); g.view.shake = 0.25; await ui.flash(1, '#c040ff', 90);
      await ui.say(d.textes.faux, { speaker: who });
      await this.penalite(d);
      return;
    }
    g.sound.sfx('learn');
    await ui.say(d.textes.juste, { speaker: who });
    if (Q.bonus) await ui.say(Q.bonus, { speaker: who });
    const party = p.equipe.map(([sp, lvl]) => createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false }));
    const res = await this.combat(p, party);
    if (res !== 'win') { await this.demande(d.id, { a: 'lacher', pnj: k }); await this.defaite(d); return; }
    const r = await this.demande(d.id, { a: 'cle', pnj: k });
    if (!r.ok) { await ui.say('Bien joué... mais ma clé est déjà partie.', { speaker: who }); return; }
    for (const m of g.state.party) healFull(m);
    g.sound.sfx('item');
    await ui.say([d.textes.cleDonnee, `${g.state.name} reçoit la ${p.cle} !\nElle est rangée dans le journal du donjon.`], { speaker: who });
  },
  /** mauvaise réponse : toute l'équipe tombe à la moitié de ses PV, puis à 1 PV, puis plus rien */
  async penalite(d, muet = false) {
    const g = this.game, run = this.etats[d.id].run;
    const E = (this.erreurs[d.id] && this.erreurs[d.id].run === run) ? this.erreurs[d.id] : (this.erreurs[d.id] = { run, n: 0 });
    E.n++;
    if (E.n > 2) { if (!muet) await g.ui.say('Tes Pokémon ont déjà tout perdu... il ne leur reste qu\'un souffle.'); return; }
    for (const m of g.state.party) { if (m.hp <= 0) continue; m.hp = E.n === 1 ? Math.min(m.hp, Math.ceil(m.stats[0] / 2)) : 1; }
    g.hud?.update(true);
    if (!muet) await g.ui.say(E.n === 1 ? 'Une onde glacée traverse ton équipe : tes Pokémon perdent la moitié de leurs PV !' : 'Une seconde onde, plus forte : il ne reste qu\'1 PV à chacun de tes Pokémon !');
  },

  /* ---------------- journal ---------------- */
  async journal() {
    const g = this.game, d = [...this.defs.values()].find((q) => this.estDans(q));
    if (!d) { await g.ui.say('Le journal du donjon ne sert qu\'à l\'intérieur d\'un donjon.'); return; }
    const e = this.etats[d.id];
    const quetes = (d.journal || []).map((q) => {
      const S = e.salles[q.salle], s = d.salles.find((x) => x.id === q.salle);
      const avance = s.type === 'serrures' ? ` (${serrures(d, e)}/${s.pnj.length} serrures)` : s.type === 'lumiere' ? ` (${Math.min(5, S.donnees.feux || 0)}/5 dans le brasier)` : '';
      const propre = this.queteJournal?.(d, q) || this.queteVoies?.(d, q) || this.queteTemple?.(d, q);
      if (propre) return { label: q.nom, right: propre.faite ? '✔' : '…', q, txt: propre.txt };
      return { label: q.nom, right: S.faite ? '✔' : '…', q, txt: S.faite ? 'Terminée.' : q.but + avance };
    });
    const objets = [...clesDe(d, e, this.moi).map((k) => ({ label: d.pnj[k].cle, right: '×1', txt: 'Une clé de l\'ascenseur. Elle disparaît si tu quittes le donjon.' })), ...(this.objetsJournal?.(d) || []), ...(this.objetsVoies?.(d) || []), ...(this.objetsTemple?.(d) || [])];
    const items = [{ label: '— Quêtes —', disabled: true }, ...(quetes.length ? quetes : [{ label: 'Aucune', disabled: true }]), { label: '— Objets de quête —', disabled: true }, ...(objets.length ? objets : [{ label: 'Aucun', disabled: true }])];
    for (;;) {
      const r = await g.ui.list({ title: `Journal · ${d.nom}`, items, cls: 'shop', cancel: -1, start: 1 });
      if (r < 0) return;
      if (items[r].txt) await g.ui.say(items[r].txt);
    }
  },

  /* ---------------- dresseurs qui repèrent le joueur ---------------- */
  /** après un pas : un dresseur (def.pnj[k].vue cases) voit le joueur droit devant lui, vient à lui et le défie */
  async regards() {
    const g = this.game, d = [...this.defs.values()].find((q) => this.estDans(q)); if (!d || g.busy || !g.state) return false;
    const p = g.player, m = g.mapObj, e = this.etats[d.id];
    for (const n of g.npcs) {
      const k = Object.keys(d.pnj || {}).find((c) => `${d.id}:${d.pnj[c].id}` === n.id), def = k && d.pnj[k];
      if (!def?.vue || battu(e, d, k) || prisPar(e, d, k)) continue;
      const [dx, dy] = DIRS[n.dir];
      for (let s = 1; s <= def.vue; s++) {
        const x = n.x + dx * s, y = n.y + dy * s;
        if (x === p.x && y === p.y) { await this.repere(d, k, n); return true; }
        if (!walkable(m.get(x, y)) || g.npcs.some((q) => q !== n && q.x === x && q.y === y)) break;
      }
    }
    return false;
  },
  async repere(d, k, n) {
    const g = this.game, ui = g.ui, def = d.pnj[k], p = g.player;
    const k2 = def.duoAvec, n2 = k2 && g.npcs.find((q) => q.id === `${d.id}:${d.pnj[k2].id}`);
    g.busy = true;
    try {
      g.sound.sfx('bang'); n.bang = true; if (n2) n2.bang = true; await wait(650); n.bang = false; if (n2) n2.bang = false;
      // chacun vient se placer à côté du joueur
      const venir = (q) => { const pas = Math.abs(p.x - q.x) + Math.abs(p.y - q.y) - 1; return pas > 0 ? g.npcWalk(q, q.dir, pas) : Promise.resolve(); };
      await Promise.all([venir(n), n2 ? venir(n2) : null]);
      p.dir = { up: 'down', down: 'up', left: 'right', right: 'left' }[n.dir];
      if (def.defi) await ui.say(def.defi, { speaker: n2 ? `${def.cls}s ${def.nom} et ${d.pnj[k2].nom}` : `${def.cls} ${def.nom}` });
      if (n2) { await this.combatDuoLocal(d, [k, k2]); return; }
      const r = await this.demande(d.id, { a: 'prendre', pnj: k }); if (!r.ok) return;
      const party = def.equipe.map(([sp, lvl]) => createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false }));
      const res = await this.combat(def, party);
      if (res === 'win') await this.demande(d.id, { a: 'gagne', pnj: k });
      else { await this.demande(d.id, { a: 'lacher', pnj: k }); await this.defaite(d); }
    } finally { g.busy = false; }
  },
  /** deux dresseurs contre le joueur seul : deux Pokémon de chaque côté (le combat tourne chez le joueur) */
  async combatDuoLocal(d, ks) {
    const g = this.game, [a, b] = ks.map((k) => d.pnj[k]);
    for (const k of ks) await this.demande(d.id, { a: 'prendre', pnj: k });
    const mons = (q) => q.equipe.map(([sp, lvl]) => createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false }));
    const ma = mons(a), mb = mons(b), reserve = [];
    for (let i = 0; i < Math.max(ma.length, mb.length); i++) { if (ma[i]) reserve.push(ma[i]); if (mb[i]) reserve.push(mb[i]); }
    const dresseur = { cls: `${a.cls}s`, nom: `${a.nom} et ${b.nom}`, bs: a.bs || a.sprite, pluriel: true };
    let res = 'win';
    if (!(g.modeTest && await g.ui.yesNo('Mode test : passer ce combat (compté comme gagné) ?'))) res = await this.combatGroupeLocal(dresseur, reserve, 2);
    if (res === 'win') { for (const k of ks) await this.demande(d.id, { a: 'gagne', pnj: k }); if (a.perd) await g.ui.say(a.perd, { speaker: dresseur.cls + ' ' + dresseur.nom }); }
    else { for (const k of ks) await this.demande(d.id, { a: 'lacher', pnj: k }); await this.defaite(d); }
  },
  /** combat de groupe joué sur place, sans l'hôte (un seul joueur, plusieurs Pokémon en jeu) */
  async combatGroupeLocal(dresseur, reserve, places) {
    const g = this.game, combat = new Groupe({ joueurs: [{ id: this.moi, nom: g.state.name, party: copie(g.state.party), places }], dresseur, reserve, places });
    const intro = { etape: 'debut', groupe: true, evs: combat.start(), photo: combat.photo(), boss: dresseur };
    const miroir = new GroupeMiroir({ moi: this.moi, party: g.state.party, intro, boss: dresseur });
    const envoyer = (action) => { const evs = combat.action(this.moi, action); if (evs) setTimeout(() => miroir.recevoir({ etape: 'tour', evs, photo: combat.photo() }), 0); };
    g.musicLock = true; g.sound.play('trainer');
    const curtain = await g.encounterIntro('trainer'); curtain.remove();
    const defaire = brancherGroupe(g.bv, miroir, this.moi);
    let res;
    try { res = await g.bv.runPvp(miroir, miroir.duel(envoyer), { bg: 'cave' }); }
    finally { defaire(); g.bv.close(); g.musicLock = false; }
    g.sound.stopMusic(0.1); g.sound.current = null; g.updateZone();
    return res === 'out' ? 'lose' : res;
  },

  /* ---------------- boss à affronter à plusieurs ---------------- */
  async bossRaid(d, k) {
    const g = this.game, ui = g.ui, p = d.pnj[k], e = this.etats[d.id];
    const salle = d.salles.find((s) => (s.type === 'raid' || s.type === 'groupe') && s.pnj?.includes(k)) || d.salles.find((s) => s.type === 'raid');
    if (e.fini || e.salles[salle.id].faite) return;
    // combats de groupe : un dresseur après l'autre
    if (salle.type === 'groupe') {
      const suivant = salle.pnj.find((q) => !battu(e, d, q));
      if (suivant !== k) { await ui.say('« Battez d\'abord celui qui vous barre la route. »', { speaker: `${p.cls} ${p.nom}`.trim() }); return; }
    }
    // mode test : on peut passer le combat (compté comme gagné)
    if (g.modeTest && await ui.yesNo('Mode test : passer ce combat (compté comme gagné) ?')) {
      await this.demande(d.id, { a: 'raid', salle: salle.id, pnj: k, etape: 'fin', result: 'win', vainqueurs: [this.moi] });
      if (salle === d.salles[d.salles.length - 1]) await this.trophee(d);
      if (salle === d.salles[d.salles.length - 1] && this.premiereFois(d)) for (const [k, n] of Object.entries(d.recompense?.objets || {})) { g.give(k, n); g.sound.sfx('item'); await ui.say(`${g.state.name} reçoit ${n > 1 ? n + ' × ' : ''}${itemName(k)} !`); }
      return;
    }
    if (e.salles[salle.id].combat) { await ui.say('Le combat a déjà commencé sans toi...'); return; }
    await ui.say(p.avant || d.textes.masque, { speaker: p.avant ? p.nom : undefined });
    const r = await this.demande(d.id, { a: 'pret', salle: salle.id, party: copie(g.state.party), test: !!g.modeTest });
    if (!r.ok) { await ui.say(r.why === 'reseau' ? 'L\'hôte du salon ne répond pas...' : '...'); return; }
    // attente des autres : Échap pour partir
    const debut = this.debutRaid ? Promise.resolve(this.debutRaid) : new Promise((res) => { this.attenteRaid = res; });
    this.debutRaid = null;
    let parti = false;
    const box = ui.dialogBox();
    const maj = () => { const S = this.etats[d.id].salles[salle.id]; ui.typePage(box, `Prêts : ${S.prets.length}/${Math.max(S.prets.length, this.presentsIds(d, salle).length)}. En attente des autres joueurs… (Échap : partir)`, { last: true }); };
    maj(); const iv = setInterval(maj, 1000);
    const pop = g.input.push((key) => { if (key === 'b') { parti = true; this.attenteRaid?.(null); } });
    const msg = await debut;
    pop(); clearInterval(iv); ui.closeDialog(); this.attenteRaid = null;
    if (parti || !msg) { await this.demande(d.id, { a: 'pasPret', salle: salle.id }); return; }
    await this.combatRaid(d, p, msg, salle);
  },
  async combatRaid(d, p, intro, salle) {
    const g = this.game, ui = g.ui, cle = intro.id || `${d.id}|${salle.id}`, duo = salle.type === 'etage';
    const musique = p.musique || 'legend';
    if (!duo) { g.sound.play(musique); g.view.shake = 0.4; await ui.flash(2, '#ffffff', 70); }
    if (p.cri || d.textes.cri) await ui.say(p.cri || d.textes.cri, { speaker: p.nom });
    this.miroirHote = this.H?.info.hostId;
    const Miroir = intro.groupe ? GroupeMiroir : CombatMiroir;
    const miroir = this.miroir = new Miroir({ moi: this.moi, party: g.state.party, intro, boss: intro.boss });
    const envoyer = (action) => { if (this.hote) this.actionRaid(this.moi, cle, action); else this.H.send('host', { t: 'djRA', id: cle, action }); };
    const curtain = await g.encounterIntro(duo ? 'trainer' : musique); curtain.remove();
    g.musicLock = true;
    const defaire = (intro.groupe ? brancherGroupe : brancher)(g.bv, miroir, this.moi);
    let res;
    try { res = await g.bv.runPvp(miroir, miroir.duel(envoyer), { bg: 'cave' }); }
    finally { defaire(); g.bv.close(); g.musicLock = false; }
    // éliminé avant la fin : on attend l'issue du combat des autres
    if (res === 'out') {
      const box = ui.dialogBox(); ui.typePage(box, 'Tes Pokémon sont K.O. : tes équipiers continuent sans toi…', { last: true });
      for (;;) { const m = await miroir.prochain(); if (m.timeout || m.parti || m.photo?.state === 'over') { if (m.photo) res = m.photo.result; break; } }
      ui.closeDialog();
    }
    this.miroir = null;
    g.sound.stopMusic(0.1); g.sound.current = null; g.updateZone();
    const dernier = salle === d.salles[d.salles.length - 1];
    if (res === 'win' && (salle.type === 'groupe' || duo)) {
      g.sound.play('victory');
      if (p.apres) await ui.say(p.apres, { speaker: `${p.cls} ${p.nom}`.trim() });
      g.updateZone();
    } else if (res === 'win' && !dernier) {
      // boss en chemin : la suite s'ouvre (le donjon s'en charge)
      g.sound.play('victory');
      if (p.apres) await ui.say(p.apres, { speaker: p.nom });
      for (const m of g.state.party) healFull(m);
      g.updateZone();
    } else if (res === 'win') {
      g.sound.play('victory');
      await ui.say(p.apres || d.textes.apres, { speaker: p.nom });
      await this.trophee(d);
      if (this.premiereFois(d)) for (const [k, n] of Object.entries(d.recompense?.objets || {})) { g.give(k, n); g.sound.sfx('item'); await ui.say(`${g.state.name} reçoit ${n > 1 ? n + ' × ' : ''}${itemName(k)} !\nIl est rangé dans le Sac.`); }
      for (const m of g.state.party) healFull(m);
      g.updateZone();
    } else await this.defaite(d);
  },

  /* ---------------- côté hôte ---------------- */
  /** toutes les demi-secondes : lancer le combat quand tous les joueurs présents sont prêts */
  verifierRaid(d) {
    for (const salle of d.salles) if (salle.type === 'raid' || salle.type === 'groupe') this.verifierRaidSalle(d, salle);
  },
  verifierRaidSalle(d, salle) {
    const e = this.etats[d.id], S = e.salles[salle.id];
    if (S.faite || S.combat || !S.prets.length) return;
    const presents = this.presentsIds(d, salle);
    const prets = S.prets.filter((q) => presents.includes(q));
    if (prets.length < S.prets.length) { for (const q of S.prets.filter((x) => !presents.includes(x))) this.traiter(d.id, q, { a: 'pasPret', salle: salle.id }); return; }
    if (!presents.every((q) => S.prets.includes(q))) return;
    const k = salle.type === 'groupe' ? salle.pnj.find((q) => !battu(e, d, q)) : salle.pnj?.find((q) => d.pnj[q]?.raid), p = k ? d.pnj[k] : Object.values(d.pnj).find((q) => q.raid), equipes = this.equipesRaid[d.id] || {};
    const joueurs = prets.filter((q) => validParty(equipes[q])).map((q) => ({ id: q, nom: this.nomDe(q), party: copie(equipes[q]) }));
    if (!joueurs.length) return;
    // mode test, seul contre un combat de groupe : on envoie ses premiers Pokémon, un par place
    const seulTest = salle.type === 'groupe' && joueurs.length === 1 && this.testRaid?.[joueurs[0].id];
    if (seulTest) joueurs[0].places = p.places || 3;
    const cle = `${d.id}|${salle.id}`, infos = { cls: p.cls, nom: p.nom, bs: p.bs || p.sprite };
    if (salle.type === 'groupe') {
      // combat de groupe : tous les joueurs présents contre autant de Pokémon du dresseur en jeu à la fois
      const reserve = p.equipe.map(([sp, lvl, extra]) => Object.assign(createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false }), extra || {}));
      const combat = new Groupe({ joueurs, dresseur: infos, reserve, places: p.places || (seulTest ? joueurs[0].places : joueurs.length) });
      this.raids[cle] = { raid: combat, ids: joueurs.map((j) => j.id), boss: infos, d: d.id, salle: salle.id, pnj: k };
      this.traiter(d.id, this.moi, { a: 'raid', salle: salle.id, etape: 'debut' });
      const evs = combat.start();
      this.diffuserRaid(cle, { etape: 'debut', groupe: true, evs, photo: combat.photo(), boss: infos });
      return;
    }
    const boss = createMon(p.espece, p.niveau, { iv: Array(6).fill(31), shiny: false });
    boss.stats[0] *= joueurs.length; boss.hp = boss.stats[0];
    if (p.moves) boss.moves = p.moves.map((id) => ({ id, pp: MOVES[id].pp }));
    const raid = new Raid({ joueurs, boss: { mon: boss, cls: p.cls, nom: p.nom, bs: p.bs }, blocs: p.blocs || 3, immunite: p.immunite, boost: p.boost, effets: p.effets, soin: p.soinBlocs });
    this.raids[cle] = { raid, ids: joueurs.map((j) => j.id), boss: { cls: p.cls, nom: p.nom, bs: p.bs }, d: d.id, salle: salle.id };
    this.traiter(d.id, this.moi, { a: 'raid', salle: salle.id, etape: 'debut' });
    const evs = raid.start();
    this.diffuserRaid(cle, { etape: 'debut', evs, photo: raid.photo(), boss: this.raids[cle].boss });
  },
  diffuserRaid(id, m) {
    const R = this.raids[id]; if (!R) return;
    for (const q of R.ids) {
      if (q === this.moi) setTimeout(() => this.recevoirRaid({ t: 'djRaid', id, ...m }), 0);
      else this.H?.send(q, { t: 'djRaid', id, ...m });
    }
  },
  actionRaid(qui, id, action) {
    const R = this.raids[id]; if (!R || !action) return;
    const evs = R.raid.action(qui, action);
    if (evs) this.tourRaid(id, evs);
  },
  tourRaid(id, evs) {
    const R = this.raids[id], raid = R.raid;
    this.diffuserRaid(id, { etape: 'tour', evs, photo: raid.photo() });
    if (raid.state === 'over') {
      delete this.raids[id];
      if (R.fin) R.fin(raid.result);
      else this.traiter(R.d, this.moi, { a: 'raid', salle: R.salle, pnj: R.pnj, etape: 'fin', result: raid.result, vainqueurs: R.ids });
    }
  },
  retirerRaid(qui) {
    for (const [id, R] of Object.entries(this.raids)) {
      if (!R.ids.includes(qui)) continue;
      R.raid.retirer(qui, `${this.nomDe(qui)} a quitté le combat.`);
      R.ids = R.ids.filter((q) => q !== qui);
      const evs = R.raid.avancer();
      if (evs) this.tourRaid(id, evs);
    }
  },
  /** côté joueur : un message du combat */
  recevoirRaid(m) {
    if (m.etape === 'debut') { if (this.attenteRaid) this.attenteRaid(m); else this.debutRaid = m; return; }
    this.miroir?.recevoir(m);
  },
  /** joueurs présents dans la salle du combat (salles séparées : sur sa carte) */
  presentsIds(d, salle) {
    const g = this.game, out = [], carte = salle?.carte || d.carte;
    if (g.state && g.mapObj?.id === carte) out.push(this.moi);
    for (const o of g.link?.others.values() || []) if (o.map === carte) out.push(String(o.id));
    return out;
  },
};

