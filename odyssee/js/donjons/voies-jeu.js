// odyssee/js/donjons/voies-jeu.js — mécaniques du Sanctuaire des Trois Voies, ajoutées à la classe Donjons (jeu.js) :
// portes des voies (une seule personne par porte), statues des menteurs, parchemins à deux chiffres, coffre et grande
// porte à code, caisses à pousser, interrupteur qui ouvre une grille quelques secondes, statues de Pokémon.
// L'avancée passe par les actions d'etat.js (« voie », « maj ») : l'hôte du salon fait autorité.
import { T, walkable, DIRS } from '../world/tiles.js';
import { ASSETS, loadImg } from '../assets.js';
import { el, esc } from '../ui/ui.js';
import { createMon } from '../core/mon.js';
import * as THREE from 'three';
import { battu } from './etat.js';

const cle = (x, y) => x + ',' + y;
const estVoies = (d) => d.salles.some((s) => s.type === 'voies');
const TYPES = new Set(['voie', 'menteur', 'parchemin', 'coffre', 'porteCode', 'levier', 'statue']);
const NOMS_STATUES = { 480: 'Créhelf', 481: 'Créfollet', 482: 'Créfadet', 3: 'Florizarre', 6: 'Dracaufeu', 9: 'Tortank' };

/** saisie d'un code (chiffres) ; null si on annule */
function saisirCode(ui, titre, n) {
  return new Promise((resolve) => {
    const w = el('div', 'screen name-screen');
    w.innerHTML = `<div class="box name-box"><div class="list-title">${esc(titre)}</div><input class="name-in" maxlength="${n}" inputmode="numeric" spellcheck="false" autocomplete="off"><div class="hint">${n} chiffres, puis Entrée (Échap : annuler)</div></div>`;
    ui.root.appendChild(w);
    const inp = w.querySelector('input'); setTimeout(() => inp.focus(), 30);
    const pop = ui.input.push(() => {});
    const fin = (v) => { pop(); w.remove(); resolve(v); };
    inp.addEventListener('input', () => { inp.value = inp.value.replace(/\D/g, '').slice(0, n); });
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); ui.sound.sfx('select'); fin(inp.value); }
      else if (e.key === 'Escape') { e.preventDefault(); ui.sound.sfx('cancel'); fin(null); }
      e.stopPropagation();
    });
    inp.addEventListener('blur', () => setTimeout(() => inp.isConnected && inp.focus(), 10));
  });
}

export const Voies = {
  poserObjetsVoies(d, m) {
    if (!estVoies(d) && !d.caisses) return;
    for (const [c, l] of Object.entries(m.donjon.plan.objets)) {
      const o = d.objets[c];
      if (!TYPES.has(o.type)) continue;
      for (const [x, y] of l) m.object(x, y, { use: () => this.objetVoies(d, m, c, x, y) });
    }
    // caisses : leur place d'origine, pour le levier et pour une nouvelle descente
    if (m.donjon.plan.objets.L) m.caissesOrigine = m.donjon.plan.objets.L.map(([x, y]) => cle(x, y));
  },
  /** salle d'une carte (une carte par salle) */
  salleCarte(d, m) { return d.salles.find((s) => s.carte === m.id); },
  dv(d, sid) { return this.etats[d.id].salles[sid].donnees || {}; },
  /** le chemin de ce joueur (s, f ou c), d'après la porte qu'il a prise */
  maVoie(d) {
    const s2 = d.salles.find((s) => s.type === 'voies'); if (!s2) return null;
    // sur un chemin : c'est celui de la salle où l'on est (en mode test, on peut les avoir tous pris)
    const ici = this.salleCarte(d, this.game.mapObj || {}); if (ici?.voie) return ici.voie;
    const V = this.dv(d, s2.id).voies || {};
    const lettre = Object.keys(V).find((k) => V[k] === this.moi);
    return lettre ? d.objets[lettre].voie : null;
  },

  /** le décor suit l'état : portes prises, parchemins apparus, coffres ouverts, grandes portes, grilles */
  appliquerVoies(d) {
    if (!estVoies(d)) return;
    const e = this.etats[d.id];
    for (const s of d.salles) {
      const m = this.game.world.maps[s.carte]; if (!m) continue;
      const P = m.donjon.plan, D = this.dv(d, s.id), S = e.salles[s.id];
      for (const [c, l] of Object.entries(P.objets)) {
        const o = d.objets[c];
        l.forEach(([x, y], i) => {
          if (o.type === 'voie') {
            const pris = (this.dv(d, s.id).voies || {})[c];
            this.decor(m, x, y, pris ? o.decor + '_f' : o.decor);
          } else if (o.type === 'parchemin') {
            this.decorSol(m, x, y, S.faite && !D.parchemin ? 'itemball' : null);
          } else if (o.type === 'coffre') this.decor(m, x, y, D.coffre ? 'coffre_ouvert' : 'coffre');
          else if (o.type === 'porteCode') this.decor(m, x, y, D.porte ? null : i === (l.length >> 1) ? 'porte_code' : 'porte_vide');
          else if (o.type === 'grille') this.decor(m, x, y, this.grilleOuverte(m, c) ? null : 'porte_grille');
          else if (o.type === 'interrupteur') this.decoSol(m, x, y, o.ouvre.some((q) => this.grilleOuverte(m, q)) ? 'interrupteur_on' : 'interrupteur');
        });
      }
    }
    // nouvelle descente : les caisses reprennent leur place
    if (this.runVoies !== e.run) { this.runVoies = e.run; this.grilles = {}; for (const s of d.salles) { const m = this.game.world.maps[s.carte]; if (m?.caissesOrigine) this.remettreCaisses(m); } this.appliquerVoies(d); }
  },
  /** objet posé au sol qui bloque le passage (parchemin) : prop, ou rien */
  decorSol(m, x, y, k) { this.decor(m, x, y, k); },
  /** dessin au sol sur lequel on marche (interrupteur) */
  decoSol(m, x, y, k) {
    const g = this.game, dd = m.deco.find((q) => q.x === x && q.y === y);
    if (dd ? dd.k === k : !k) return;
    if (dd) dd.k = k; else m.deco.push({ k, x, y });
    if (g.mapObj === m) { g.view.decoAt.set(cle(x, y), m.deco.find((q) => q.x === x && q.y === y)); g.view.rebuildAt(x, y); }
  },

  async objetVoies(d, m, c, x, y) {
    const o = d.objets[c], s = this.salleCarte(d, m);
    switch (o.type) {
      case 'voie': return this.porteVoie(d, s, c);
      case 'menteur': return this.statueMenteur(d, s, o);
      case 'parchemin': return this.parchemin(d, s);
      case 'coffre': return this.coffre(d, s);
      case 'porteCode': return this.porteCode(d, s);
      case 'levier': return this.levier(d, m);
      case 'statue': return this.game.ui.say(`Une statue de ${NOMS_STATUES[o.sp] || 'Pokémon'}, taillée dans une pierre très ancienne.`);
    }
  },

  /* ---------------- salle des voies ---------------- */
  async porteVoie(d, s, lettre) {
    const g = this.game, ui = g.ui, o = d.objets[lettre], nom = d.voies[o.voie], V = this.dv(d, s.id).voies || {};
    // « Porte du Courage », « Porte de l'Eau », « Porte de la Sagesse »
    const de = d.voiesDe?.[o.voie] ?? (nom === 'Courage' ? 'du ' : 'de la ');
    if (V[lettre] && !g.modeTest) { await ui.say(`La Porte ${de}${nom} est scellée.\n${this.nomDe(V[lettre])} a pris ce chemin.`); return; }
    await ui.say(d.inscriptions[o.voie]);
    if (!(await ui.yesNo(`Franchir la Porte ${de}${nom} ? Elle se refermera derrière toi : tes coéquipiers ne pourront plus emprunter ce chemin, et tu ne pourras plus faire demi-tour.`))) return;
    const r = await this.demande(d.id, { a: 'voie', salle: s.id, voie: lettre, test: !!g.modeTest });
    if (!r.ok) { await ui.say(r.why === 'prise' ? 'Trop tard : quelqu\'un vient de franchir cette porte.' : r.why === 'deja' ? 'Tu as déjà choisi ton chemin.' : r.why === 'reseau' ? 'L\'hôte du salon ne répond pas...' : '...'); return; }
    g.sound.sfx('bang'); g.view.shake = 0.2;
    const cible = d.salles.find((q) => q.id === s.voies[lettre]), cm = this.game.world.maps[cible.carte], [x, y] = cm.donjon.plan.depart;
    await g.warp({ map: cm.id, x, y, dir: 'up' }, 'door');
  },

  /* ---------------- épreuve de la Sagesse ---------------- */
  async statueMenteur(d, s, o) {
    const g = this.game, ui = g.ui, M = d.menteurs, nom = M.noms[o.n], D = this.dv(d, s.id), S = this.etats[d.id].salles[s.id];
    await ui.say(`« ${M.paroles[o.n]} »`, { speaker: `Statue de ${nom}` });
    if (S.faite) return;
    // on désigne chaque statue (vrai ou menteur) sans savoir si c'est juste ; rien ne se passe tant que tout n'est pas bon
    const avis = { ...(D.avis || {}) }, ici = avis[o.n];
    const etat = ici === true ? ' (désignée : dit la vérité)' : ici === false ? ' (désignée : ment)' : '';
    const r = await ui.ask(`Que penses-tu de ${nom} ?${etat}`, ['Elle dit la vérité', 'Elle ment', 'Je ne sais pas encore']);
    if (r === 0) avis[o.n] = true; else if (r === 1) avis[o.n] = false; else delete avis[o.n];
    const juste = M.noms.every((_, k) => avis[k] === M.sinceres.includes(k));
    await this.maj(d, s.id, { avis }, juste ? { faite: true } : {});
    if (juste) { g.sound.sfx('learn'); await ui.say('Les statues sincères se mettent à briller, les menteuses se taisent... Tu as vu juste : la porte s\'ouvre !'); }
  },

  /* ---------------- parchemins, coffre et grande porte ---------------- */
  /** nombre d'un parchemin : le n-ième du chemin v */
  nombre(d, v, n) { return this.etats[d.id].secret?.codes?.[v]?.[n - 1]; },
  async parchemin(d, s) {
    const g = this.game, ui = g.ui, S = this.etats[d.id].salles[s.id], D = this.dv(d, s.id);
    if (!S.faite || D.parchemin) return;
    await this.maj(d, s.id, { parchemin: true });
    g.sound.sfx('item');
    await ui.say(`${g.state.name} ramasse un parchemin. Il porte un nombre : ${this.nombre(d, s.voie, s.parchemin)}.\nIl est rangé dans le journal du donjon.`);
  },
  /** à la fin des dresseurs de la salle des codes, le parchemin apparaît (la salle est « faite ») */
  async coffre(d, s) {
    const g = this.game, ui = g.ui, D = this.dv(d, s.id), sec = this.etats[d.id].secret;
    if (D.coffre) { await ui.say(['Le coffre est ouvert. Au fond, une inscription :', `« ${sec.motifs[s.voie].map((v) => d.voies[v]).join(', ')} »`]); return; }
    await ui.say('Un coffre fermé par une serrure à quatre chiffres.');
    const code = await saisirCode(ui, 'Code du coffre', 4); if (code == null) return;
    const [a, b] = sec.codes[s.voie];
    if (code !== `${a}${b}` && code !== `${b}${a}`) { g.sound.sfx('bump'); await ui.say('La serrure ne bouge pas.'); return; }
    g.sound.sfx('pc');
    await this.maj(d, s.id, { coffre: true });
    await ui.say(['Clac ! Le coffre s\'ouvre. Au fond, une inscription :', `« ${sec.motifs[s.voie].map((v) => d.voies[v]).join(', ')} »`]);
  },
  async porteCode(d, s) {
    const g = this.game, ui = g.ui, D = this.dv(d, s.id);
    if (D.porte) return;
    await ui.say('Une grande porte. Sa serrure attend un code à huit chiffres.');
    const code = await saisirCode(ui, 'Code de la grande porte', 8); if (code == null) return;
    if (code !== this.etats[d.id].secret.portes[s.voie]) { g.sound.sfx('bump'); await ui.say('Rien ne se passe. Ce n\'est pas le bon code.'); return; }
    await this.maj(d, s.id, { porte: true });
    g.sound.sfx('badge'); g.view.shake = 0.3;
    await ui.say(['La grande porte s\'ouvre dans un grondement !', 'Le passage vers la suite est juste derrière.']);
  },

  /* ---------------- épreuve du Courage : caisses et interrupteur ---------------- */
  caisseEn(m, x, y) { return m.deco.some((q) => q.x === x && q.y === y && q.k === 'caisse') && m.get(x, y) === T.BLOCK; },
  /** pousser une caisse ; renvoie true si le pas est traité */
  pousser(dir) {
    const g = this.game, m = g.mapObj; if (!m?.caissesOrigine || g.player.move) return false;
    const p = g.player, [dx, dy] = DIRS[dir], x = p.x + dx, y = p.y + dy;
    if (!this.caisseEn(m, x, y)) return false;
    p.dir = dir; p.walking = false;
    const bx = x + dx, by = y + dy, t = m.get(bx, by);
    const special = Object.entries(m.donjon.plan.objets).some(([c, l]) => c !== 'L' && l.some(([a, b]) => a === bx && b === by));
    if (special || !walkable(t) || t === T.CAVEDOOR || g.occupied(bx, by) || m.warpAt(bx, by) || m.deco.some((q) => q.x === bx && q.y === by && q.k !== 'exitlight')) {
      if (p.bumpT <= 0) { g.sound.sfx('bump'); p.bumpT = 0.3; }
      return true;
    }
    this.decor(m, x, y, null); this.decor(m, bx, by, 'caisse');
    g.sound.sfx('ledge'); g.view.shake = 0.06; p.bumpT = 0.25;
    return true;
  },
  remettreCaisses(m) {
    for (const q of m.deco.filter((q) => q.k === 'caisse')) this.decor(m, q.x, q.y, null);
    for (const k of m.caissesOrigine) { const [x, y] = k.split(',').map(Number); this.decor(m, x, y, 'caisse'); }
  },
  async levier(d, m) {
    if (!(await this.game.ui.yesNo('Un levier. Remettre les caisses à leur place ?'))) return;
    this.remettreCaisses(m); this.game.sound.sfx('pc');
  },
  /* grilles du Courage : ouvertes jusqu'à une heure donnée (this.grilles[carte][lettre]) */
  grilleOuverte(m, c) { const f = this.grilles?.[m.id]?.[c]; return !!f && performance.now() < f; },
  /** après un pas : interrupteur (ouvre des grilles quelques secondes), embuscade d'un dresseur */
  async apresPasVoies() {
    const g = this.game, m = g.mapObj, d = [...this.defs.values()].find((q) => estVoies(q) && this.estDans(q)); if (!d) return;
    const P = m.donjon?.plan; if (!P) return;
    const p = g.player, ici = (c) => (P.objets[c] || []).some(([x, y]) => x === p.x && y === p.y);
    for (const [c, o] of Object.entries(d.objets)) {
      if (o.type === 'interrupteur' && ici(c)) {
        const fin = performance.now() + o.duree * 1000;
        this.grilles ||= {}; const G = (this.grilles[m.id] ||= {});
        for (const q of o.ouvre) G[q] = fin;
        g.sound.sfx('pc'); this.appliquerVoies(d);
        g.ui.toast(`Clic ! ${o.ouvre.length > 1 ? 'Des grilles s\'ouvrent' : 'Une grille s\'ouvre'}... ${o.duree} secondes !`, 1600);
      }
      if (o.type === 'embuscade' && ici(c) && !battu(this.etats[d.id], d, o.pnj) && !g.busy) await this.embuscade(d, o.pnj);
    }
  },
  /** un dresseur qui attaque dès qu'on passe devant lui */
  async embuscade(d, k) {
    const g = this.game, p = d.pnj[k];
    g.busy = true;
    try {
      g.sound.sfx('bang');
      if (p.embuscade) await g.ui.say(p.embuscade, { speaker: `${p.cls} ${p.nom}` });
      const r = await this.demande(d.id, { a: 'prendre', pnj: k }); if (!r.ok) return;
      const party = p.equipe.map(([sp, lvl]) => createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 10 + lvl / 2 | 0)), shiny: false }));
      const res = await this.combat(p, party);
      if (res === 'win') await this.demande(d.id, { a: 'gagne', pnj: k });
      else { await this.demande(d.id, { a: 'lacher', pnj: k }); await this.defaite(d); }
    } finally { g.busy = false; }
  },
  tickVoies() {
    const g = this.game, d = [...this.defs.values()].find((q) => estVoies(q)); if (!d) return;
    // grilles qui se referment (jamais sur quelqu'un) ; coincé derrière une grille : retour à l'entrée de la salle
    for (const [id, G] of Object.entries(this.grilles || {})) {
      const m = g.world.maps[id], maintenant = performance.now();
      for (const [c, fin] of Object.entries(G)) {
        if (maintenant < fin) continue;
        const dessus = g.mapObj === m && (m.donjon.plan.objets[c] || []).some(([x, y]) => (g.player.x === x && g.player.y === y) || (g.player.move && g.player.move.tx === x && g.player.move.ty === y));
        if (dessus) continue;
        delete G[c];
        if (g.mapObj === m) g.sound.sfx('bang');
        this.appliquerVoies(d);
        if (g.mapObj === m && !g.busy && !g.bv.alive) this.coinceVoies(d, m);
      }
    }
    if (!g.state || !this.estDans(d)) { this.lueur?.remove(); this.lueur = null; return; }
    this.dessinerStatues(d);
    this.lueurCoffre(d);
  },
  /**
   * derrière une grille fermée, sans chemin vers l'entrée, ni vers un interrupteur, ni vers la sortie : on recommence
   * la salle (une fois la dernière grille passée, on est passé)
   */
  coinceVoies(d, m) {
    const g = this.game, P = m.donjon.plan, [sx, sy] = P.depart, vu = m.reach(g.player.x, g.player.y), at = ([x, y]) => vu[y * m.w + x];
    const inters = Object.entries(P.objets).filter(([c]) => d.objets[c].type === 'interrupteur').flatMap(([, l]) => l);
    if (at([sx, sy]) || (P.suivante && at(P.suivante)) || (P.objets.K || []).some(([x, y]) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => at([x + a, y + b]))) || inters.some(at)) return;
    this.taches.push(async () => {
      await g.ui.say('La grille s\'est refermée derrière toi... Tu es ramené à l\'entrée de la salle. Tout est à refaire !');
      if (m.caissesOrigine) this.remettreCaisses(m);
      delete this.grilles?.[m.id];
      this.appliquerVoies(d);
      await g.warp({ map: m.id, x: sx, y: sy, dir: 'up' }, 'exit');
    });
  },
  /** dans le noir, le coffre brille */
  lueurCoffre(d) {
    const g = this.game, m = g.mapObj, H = m.dark && m.donjon?.plan.objets.H?.[0];
    if (!H || g.bv.alive) { if (this.lueur) this.lueur.style.display = 'none'; return; }
    if (!this.lueur) { this.lueur = el('div', 'testody-lueur'); g.ui.root.appendChild(this.lueur); }
    const v = g.view, cv = v.renderer?.domElement || document.getElementById('gl'), rect = cv.getBoundingClientRect(), box = g.ui.root.getBoundingClientRect();
    const p = new THREE.Vector3(H[0] + 0.5, 0.3, H[1] + 0.5).project(v.camera);
    const x = rect.left - box.left + (p.x + 1) / 2 * rect.width, y = rect.top - box.top + (1 - p.y) / 2 * rect.height;
    const ok = p.z < 1 && x > -200 && y > -200 && x < box.width + 200 && y < box.height + 200;
    this.lueur.style.display = ok ? '' : 'none';
    this.lueur.style.left = `${x}px`; this.lueur.style.top = `${y}px`;
  },
  /** statues de Pokémon sur leur socle : l'image du Pokémon, en pierre */
  dessinerStatues(d) {
    const g = this.game, m = g.mapObj, P = m.donjon?.plan; if (!P) return;
    this.imgStatues ||= {};
    for (const [c, l] of Object.entries(P.objets)) {
      const o = d.objets[c]; if (o.sp) for (const [x, y] of l) this.statue(g, `statue:${x},${y}`, o.sp, x, y, o.grand ? 0.8 : 0.32);
    }
  },
  statue(g, id, sp, x, y, echelle) {
    const v = g.view;
    if (v.actors.has(id)) return;
    const im = this.imgStatues[sp];
    if (im === undefined) {
      this.imgStatues[sp] = null;
      loadImg(ASSETS.front(sp)).then((src) => {
        if (!src) return;
        const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
        const ctx = c.getContext('2d'); ctx.filter = 'grayscale(1) brightness(1.15) contrast(0.9)'; ctx.drawImage(src, 0, 0);
        this.imgStatues[sp] = c;
      });
      return;
    }
    if (!im) return;
    const a = v.imageActor(id, im, echelle);
    v.place(a, x, y, 0.32);
  },

  /** journal : où en est ce joueur sur son chemin */
  queteVoies(d, q) {
    if (d.id !== 'voies') return null;
    const v = this.maVoie(d), e = this.etats[d.id], fait = (id) => !!e.salles[id]?.faite;
    const mien = (f) => d.salles.find((s) => s.voie === v && f(s));
    let ok = false, txt = q.but;
    if (q.id === 'dalles') ok = fait('s1');
    else if (q.id === 'voie') { ok = !!v; if (v) txt = `Tu as pris la Porte ${v === 'c' ? 'du' : 'de la'} ${d.voies[v]}.`; }
    else if (q.id === 'epreuve') ok = !!v && fait(mien((s) => s.parchemin === 1).id);
    else if (q.id === 'codes') ok = !!v && !!this.dv(d, mien((s) => s.parchemin === 2).id).porte;
    else if (q.id === 'gardien') ok = fait('s6');
    else return null;
    return { faite: ok, txt: ok && q.id !== 'voie' ? 'Terminée.' : txt };
  },
  /** journal : chemin choisi, parchemins et inscription du coffre */
  objetsVoies(d) {
    if (d.id !== 'voies') return [];
    const v = this.maVoie(d), l = []; if (!v) return l;
    for (const s of d.salles) {
      if (s.voie !== v || !s.parchemin || !this.dv(d, s.id).parchemin) continue;
      const n = this.nombre(d, v, s.parchemin);
      l.push({ label: `Parchemin ${s.parchemin === 1 ? 'de l\'épreuve' : 'des gardiens'}`, right: String(n), txt: `Un parchemin trouvé sur ton chemin. Il porte le nombre ${n}.` });
    }
    // mode test : tous les nombres et le code, pour jouer les trois chemins seul
    if (this.game.modeTest && this.etats[d.id].secret) { const sec = this.etats[d.id].secret; l.push({ label: 'Codes (mode test)', right: '', txt: `${Object.entries(sec.codes).map(([q, c]) => `${d.voies[q]} : ${c.join(' et ')}`).join('\n')}\nGrande porte : ${sec.portes[v]}` }); }
    const s4 = d.salles.find((s) => s.voie === v && s.parchemin === 2);
    if (s4 && this.dv(d, s4.id).coffre) l.push({ label: 'Inscription du coffre', right: '', txt: `« ${this.etats[d.id].secret.motifs[v].map((q) => d.voies[q]).join(', ')} »` });
    return l;
  },
};
