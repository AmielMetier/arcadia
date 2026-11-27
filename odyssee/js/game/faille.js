// odyssee/js/game/faille.js — l'expédition dans une faille : trois îles où l'on marche, un Pokémon à vaincre sur chacune,
// des portails vers la suite, un gardien au bout, le butin remis à la sortie. Les cartes sont faites à la volée (faille-iles.js).
import { SPECIES } from '../data/species.js';
import { abilitiesOf } from '../data/abilities.js';
import { formatFindItem, itemName } from '../core/items.js';
import { createMon, refreshStats, monName } from '../core/mon.js';
import { T, DIRS } from '../world/tiles.js';
import { CELESTIAL_SPECIES } from './celestial.js';
import { RIFT_KINDS, ALPHA_POOL, createAlphaMon, formeAdaptee } from './rifts.js';
import { construireIle, tirerPlan, echangerPonts, finCourant, pasVers } from './faille-iles.js';
import { warnDev } from '../core/safe.js';

/** une expédition : trois îles, la dernière tenue par un gardien Alpha */
export const SALLES = 3;
export const REGLE = { inverse: 'Types inversés', chaos: 'Météo tournante', alpha: 'Pokémon Alpha' };
const ARGENT = [1500, 2500, 5000], MUSIQUES = { inverse: 'ileInverse', chaos: 'ileChaos', alpha: 'ileAlpha' };
const ARGENT_PALIER = (b) => (b >= 5 ? ARGENT : b >= 3 ? [800, 1400, 2600] : [400, 750, 1400]);
const NOMS = { inverse: 'Îles du Reflet', chaos: 'Îles des Quatre Vents', alpha: 'Îles du Colosse', gardien: 'Trône du Gardien' };
const SORTIE = { core: '#ffffff', rim: '#7fb0ff' }, OR = { core: '#fff0b0', rim: '#ff3a2a' };
/** ce que promet un passage : [objet, quantité] */
export const LOTS = [['rare-candy', 1], ['ultra-ball', 5], ['revive', 2], ['full-restore', 1], ['moon-stone', 1], ['sun-stone', 1], ['dusk-stone', 1], ['elixir', 1]];
export const LOTS_GARDIEN = [['rare-candy', 3], ['fragment-meteore', 2], ['max-revive', 2], ['full-restore', 3]];
const LOTS_DEBUT = [['super-potion', 2], ['great-ball', 3], ['sitrus-berry', 2], ['full-heal', 2], ['ether', 1], ['super-repel', 2]];
const LOTS_MILIEU = [['hyper-potion', 2], ['great-ball', 4], ['revive', 1], ['moon-stone', 1], ['sun-stone', 1], ['ether', 2], ['rare-candy', 1]];
const LOTS_GARDIEN_DEBUT = [['rare-candy', 1], ['fragment-meteore', 1], ['great-ball', 5], ['hyper-potion', 2]];
const LOTS_GARDIEN_MILIEU = [['rare-candy', 2], ['fragment-meteore', 1], ['revive', 2], ['ultra-ball', 3]];
const ECLATS = [['sitrus-berry', 1], ['full-heal', 1], ['hyper-potion', 1]];
const ECLATS_DEBUT = [['oran-berry', 1], ['potion', 1], ['super-potion', 1]];

export class Expedition {
  constructor(game, r) {
    this.game = game; this.r = r; this.salle = 0; this.kind = r.kind; this.lot = null;
    this.butin = { argent: 0, objets: {} }; this.scene = null; this.vivante = true; this.t = 0; this.gagnee = false;
    const p = game.player; this.retour = { x: p.x, y: p.y, dir: p.dir };
    this.id = 'faille:' + Math.floor(Math.random() * 1e6).toString(36);
  }
  get m() { return this.game.mapObj?.faille ? this.game.mapObj : null; }
  get gardien() { return this.salle === SALLES; }
  info() { return this.gardien ? { ...RIFT_KINDS[this.kind], ...OR } : RIFT_KINDS[this.kind]; }
  gagne(item, n) { this.butin.objets[item] = (this.butin.objets[item] || 0) + n; }

  /** niveau des Pokémon d'une salle : un peu au-dessus de l'équipe, jamais au-dessus du niveau autorisé */
  niveau(salle = this.salle) {
    const g = this.game, lvls = (g.state.party || []).filter((q) => q.hp > 0).map((q) => q.lvl);
    const moyen = lvls.length ? Math.round(lvls.reduce((a, b) => a + b, 0) / lvls.length) : 12;
    return Math.max(10, Math.min(g.levelCap ? g.levelCap() : 100, moyen + 1 + salle));
  }
  /** le Pokémon de la salle et les règles du combat */
  rencontre() {
    const lvl = this.niveau(), lieu = `${this.r.zoneName} (Faille)`, kind = this.kind;
    let wild, opts;
    if (kind === 'alpha' || this.gardien) {
      wild = createAlphaMon(ALPHA_POOL[Math.floor(Math.random() * ALPHA_POOL.length)], lvl, lieu);
      opts = { wild, alpha: true, aura: this.gardien ? 'or' : 'rouge', music: this.gardien ? 'gardienFaille' : 'alphaBoss', rift: true, sansFuite: true, sansSoins: true };
    } else {
      const pool = [...ALPHA_POOL.map((e) => e.sp), ...CELESTIAL_SPECIES].filter((id) => SPECIES[id]);
      const sp = formeAdaptee(pool[Math.floor(Math.random() * pool.length)], lvl);
      wild = createMon(sp, lvl, { met: lieu });
      const iv = [0, 1, 2, 3, 4, 5];
      for (let n = 0; n < 2; n++) wild.iv[iv.splice(Math.floor(Math.random() * iv.length), 1)[0]] = 31;
      const [, , ha] = abilitiesOf(sp);
      if (ha && Math.random() < 0.35) wild.ability = ha;
      refreshStats(wild, false);
      wild.hp = wild.stats[0];
      opts = { wild, music: 'riftBattle', rift: true, sansFuite: true, sansSoins: true };
    }
    if (Math.random() < 1 / 512) wild.shiny = true;
    if (kind === 'inverse') opts.inverse = true;
    else if (kind === 'chaos') Object.assign(opts, { chaosWeather: true, weather: 'rain' });
    const texte = this.gardien ? `Le gardien de la faille se dresse devant toi : ${monName(wild)} Alpha !`
      : kind === 'alpha' ? `Un rugissement fend la faille ! Un ${monName(wild)} Alpha géant bondit sur toi !`
        : `L'espace se tord : un ${monName(wild)} émerge de la faille !`;
    return { wild, opts, texte };
  }
  /** deux passages différents vers la salle suivante, avec ce que chacun promet */
  tirerPassages() {
    const tire = (L) => L.splice(Math.floor(Math.random() * L.length), 1)[0];
    const b = this.game.badgeCount?.() || 0;
    const pool = this.salle + 1 === SALLES
      ? (b >= 5 ? LOTS_GARDIEN : b >= 3 ? LOTS_GARDIEN_MILIEU : LOTS_GARDIEN_DEBUT)
      : (b >= 5 ? LOTS : b >= 3 ? LOTS_MILIEU : LOTS_DEBUT);
    const genres = Object.keys(RIFT_KINDS), lots = [...pool];
    return [0, 1].map(() => { const kind = tire(genres), [item, n] = tire(lots); return { kind, lot: { item, n } }; });
  }

  /* ---------------- aller et venir ---------------- */
  /** depuis la route : l'écran se brise, on tombe dans la première île */
  async commencer() {
    const g = this.game, r = this.r;
    if (typeof document !== 'undefined') {
      try {
        const { Faille } = await import('../ui/rift-entree.js');
        if (g.view?.renderer && g.ui?.root) { this.scene = new Faille(g); await this.scene.plonger({ kind: this.kind, info: RIFT_KINDS[this.kind], x: r.x, y: r.y, casse: true, titre: RIFT_KINDS[this.kind].label, sous: `Île 1 sur ${SALLES}` }); }
      } catch (e) { warnDev('faille', e); this.scene?.fin(); this.scene = null; }
    }
    if (!this.scene) { g.sound?.sfx?.('rift_open'); await g.ui.fade?.(true, 250); }
    await this.poser();
  }
  /** fabrique l'île de la salle suivante et y pose le joueur */
  async poser() {
    const g = this.game; this.salle++; this.gagnee = false; this.mon = null; this.ouverts = null;
    const gard = this.gardien, { plan, miroir } = tirerPlan(this.kind, gard);
    const m = construireIle(`${this.id}:${this.salle}`, this.kind, plan, { nom: gard ? NOMS.gardien : NOMS[this.kind], musique: gard ? 'ileTrone' : MUSIQUES[this.kind], miroir, gardien: gard });
    m.faille.info = this.info(); m.outside = { map: 'monde', x: this.retour.x, y: this.retour.y };
    m.faille.fond = this.scene ? this.scene.decor(m.faille.info, this.kind) : null;
    this.E = this.rencontre();
    this.mon = { x: m.faille.ennemi[0], y: m.faille.ennemi[1], move: null, cd: 1.2 };
    this.eclats = m.faille.eclats.map(([x, y], i) => ({ x, y, i }));
    this.passages = gard ? null : this.tirerPassages();
    for (const id of Object.keys(g.world.maps)) if (id.startsWith(this.id)) delete g.world.maps[id];
    g.world.maps[m.id] = m;
    const p = g.player; [p.x, p.y] = m.faille.depart; p.dir = 'up'; p.move = null; p.surf = false;
    g.setMap(m.id);
    g.view?.update?.(0, p.x, p.y); await g.view?.solPret?.();
    this.montrerBadge();
    if (this.scene?.vivant) { try { await this.scene.emerger(p.x, p.y); } catch (e) { warnDev('faille', e); } } else await g.ui.fade?.(false, 250);
  }
  /** par un portail, vers l'île suivante */
  async traverser(i) {
    const g = this.game, P = this.passages[i], [x, y] = this.m.faille.portes[i];
    this.kind = P.kind; this.lot = P.lot; this.salle++; const info = this.info(), gard = this.gardien; this.salle--;
    g.sound?.sfx?.('select');
    if (this.scene?.vivant) { try { await this.scene.plonger({ kind: P.kind, info, x, y, casse: false, titre: gard ? 'Gardien de la faille' : RIFT_KINDS[P.kind].label, sous: gard ? RIFT_KINDS[P.kind].label : `Île ${this.salle + 1} sur ${SALLES}` }); } catch (e) { warnDev('faille', e); } } else await g.ui.fade?.(true, 250);
    this.retirerActeurs();
    await this.poser();
  }
  /** retour sur la route ; `butin` : on l'emporte */
  async sortir(issue) {
    const g = this.game, st = g.state, rifts = g.rifts, R = this.retour, [x, y] = this.m?.faille.sortie || [g.player.x, g.player.y];
    this.vivante = false;
    if (this.scene?.vivant) { try { await this.scene.plonger({ kind: this.kind, info: { ...RIFT_KINDS[this.kind], ...SORTIE }, x, y, casse: false, titre: '', sous: '' }); } catch (e) { warnDev('faille', e); } } else await g.ui.fade?.(true, 250);
    this.ranger();
    if (issue !== 'renonce') rifts.clear();
    const p = g.player; p.x = R.x; p.y = R.y; p.dir = R.dir; p.move = null;
    g.setMap('monde');
    g.view?.update?.(0, p.x, p.y); await g.view?.solPret?.();
    if (this.scene?.vivant) { try { await this.scene.emerger(p.x, p.y, true); } catch (e) { warnDev('faille', e); } this.rebond(); } else await g.ui.fade?.(false, 250);
    this.scene?.fin(); this.scene = null;
    if (issue === 'renonce') { g.save?.(true); return; }
    if (issue === 'perdu') { g.save?.(true); await g.ui.say('La faille se referme derrière toi... Le butin y est resté.'); return; }
    st.money = (st.money || 0) + this.butin.argent;
    for (const [item, n] of Object.entries(this.butin.objets)) g.give(item, n);
    try { g.checkTrophies?.(true); } catch (e) { warnDev('rift-trophy', e); }
    g.save?.(true);
    g.sound?.sfx?.('rift_seal');
    await g.ui.say([
      issue === 'gardien' ? 'Le gardien est tombé : la faille implose et te rend à la route !' : 'La faille se referme dans un éclat prismatique !',
      ...Object.entries(this.butin.objets).map(([item, n]) => formatFindItem(st.name, item, n)),
      `Tu récupères aussi ${this.butin.argent.toLocaleString('fr-FR')} ₽ au cœur de la distorsion !`,
    ]);
  }
  /** recraché par la faille : un bond depuis son emplacement */
  rebond() {
    const p = this.game.player, r = this.r;
    if (!p || p.move || Math.abs(r.x - p.x) + Math.abs(r.y - p.y) !== 1) return;
    p.move = { fx: r.x, fy: r.y, tx: p.x, ty: p.y, t: 0, dur: 0.42, jump: true, scripted: true };
  }
  /** tout ce qui appartient à l'expédition s'en va (cartes, acteurs, encart) */
  ranger() {
    const g = this.game; this.vivante = false; this.retirerActeurs(); this.badge?.remove(); this.badge = null;
    for (const id of Object.keys(g.world?.maps || {})) if (id.startsWith(this.id)) delete g.world.maps[id];
    if (g.rifts?.exp === this) g.rifts.exp = null;
  }

  /* ---------------- sur l'île ---------------- */
  async affronter() {
    const g = this.game, st = g.state, E = this.E; if (!this.mon || this.combat) return;
    this.combat = true; g.busy = true;
    try {
      g.sound?.sfx?.('bang'); if (g.player) g.player.bang = true; await new Promise((r) => setTimeout(r, typeof document === 'undefined' ? 0 : 450)); if (g.player) g.player.bang = false;
      const titre = this.gardien ? 'Gardien de la faille' : monName(E.wild), sous = this.gardien ? RIFT_KINDS[this.kind].label : REGLE[this.kind];
      if (this.scene?.vivant) { try { await this.scene.plonger({ kind: this.kind, info: this.info(), x: this.mon.x, y: this.mon.y, casse: false, mon: E.wild, titre, sous }); } catch (e) { warnDev('faille', e); } } else g.sound?.sfx?.(E.wild.alpha ? 'alpha_roar' : 'rift_open');
      await g.ui.say(E.texte);
      const res = await g.runBattle({ ...E.opts, fond: this.m?.faille.fond || null, apresRideau: () => this.scene?.cacher(), surDefaite: () => { this.scene?.fin(); this.scene = null; this.ranger(); } });
      this.scene?.cacher();
      if (res === 'lose') {
        if (this.salle > 1) { g.rifts.clear(); g.save?.(true); await g.ui.say('La faille s\'est refermée... Le butin y est resté.'); }
        this.ranger(); this.scene?.fin(); this.scene = null;
        return res;
      }
      if (res !== 'win' && res !== 'caught') {
        if (this.salle === 1) { this.mon.cd = 4; this.trouve = 3; return res; }   // première île : il te laisse souffler, la sortie reste ouverte
        await g.ui.say('En fuyant, tu perds l\'équilibre : la faille te rejette !');
        await this.sortir('perdu');
        return res;
      }
      const f = (st.flags ||= {});
      if (this.salle === 1) {
        g.rifts.programmer();   // la suivante, plus tard
        f.riftsCleared = (f.riftsCleared || 0) + 1;
      }
      f['riftKind:' + this.kind] = (f['riftKind:' + this.kind] || 0) + 1;
      if (E.wild.alpha && res === 'caught') f.alphaCaught = (f.alphaCaught || 0) + 1;
      const b = g.badgeCount?.() || 0;
      this.butin.argent += ARGENT_PALIER(b)[this.salle - 1];
      if (this.salle === 1) {
        const lot1 = b >= 4
          ? (this.kind === 'alpha' ? ['rare-candy', 1] : ['fragment-meteore', 1])
          : (this.kind === 'alpha' ? ['hyper-potion', 1] : ['great-ball', 2]);
        this.gagne(...lot1);
      } else this.gagne(this.lot.item, this.lot.n);
      if (this.gardien) f.gardiensFaille = (f.gardiensFaille || 0) + 1;
      try { g.checkTrophies?.(true); } catch (e) { warnDev('rift-trophy', e); }
      g.save?.(true);
      this.mon = null; this.gagnee = true; this.retirerActeur('faille:mon'); this.ouverts = 0; this.montrerBadge();
      g.sound?.sfx?.('rift_open');
      await g.ui.say(this.gardien ? 'Un portail d\'or s\'ouvre au nord : c\'est la sortie !' : ['Deux portails s\'ouvrent au nord !', 'Le passage du sud te ramène sur la route avec ton butin.']);
      return res;
    } finally { this.combat = false; g.busy = false; if (!this.vivante) g.updateZone?.(); }
  }
  /** portail, sortie : le joueur est sur la case */
  async surCase() {
    const g = this.game, m = this.m, p = g.player; if (!m || g.busy || !this.vivante) return;
    const F = m.faille, ici = ([x, y]) => x === p.x && y === p.y;
    // éclats
    const e = this.eclats.findIndex((o) => ici([o.x, o.y])); if (e >= 0) this.ramasser(e);
    // cristal : les ponts s'échangent
    if (F.cristaux.some(ici)) { echangerPonts(m); g.sound?.sfx?.('select'); g.sound?.sfx?.('astrolabe'); if (g.view) g.view.shake = 0.08; }
    // courant
    if (F.courants.has(p.x + ',' + p.y)) {
      g.busy = true;
      try { for (let n = 0; n < 6 && F.courants.has(p.x + ',' + p.y); n++) { const d = F.courants.get(p.x + ',' + p.y), [, , pas] = finCourant(m, p.x, p.y); if (!pas) break; g.sound?.sfx?.('vent'); await glisser(g, d, m); } } finally { g.busy = false; }
      return this.surCase();
    }
    if (ici(F.sortie)) return this.passageSortie();
    if (this.gagnee) { const i = F.portes.findIndex(ici); if (i >= 0) return this.portail(i); }
    return this.croise();
  }
  /** à côté du Pokémon de la salle : il attaque */
  async croise() {
    const p = this.game.player, M = this.mon; if (!M || this.combat || this.game.busy) return;
    if (this.trouve > 0) return;
    if (Math.abs(M.x - p.x) + Math.abs(M.y - p.y) === 1) await this.affronter();
  }
  ramasser(i) {
    const g = this.game, b = g.badgeCount?.() || 0, [o] = this.eclats.splice(i, 1); this.retirerActeur('faille:eclat' + o.i);
    g.sound?.sfx?.('meteor_pick');
    if (Math.random() < 0.6) {
      const n = b >= 5 ? 300 + 100 * Math.floor(Math.random() * 6) : b >= 3 ? 150 + 50 * Math.floor(Math.random() * 5) : 80 + 30 * Math.floor(Math.random() * 4);
      this.butin.argent += n; g.ui.toast?.(`✦ +${n} ₽ au butin`, 2000);
    } else {
      const pool = b >= 3 ? ECLATS : ECLATS_DEBUT;
      const [item, n] = pool[Math.floor(Math.random() * pool.length)];
      this.gagne(item, n); g.ui.toast?.(`✦ ${itemName(item)} au butin`, 2000);
    }
    this.montrerBadge();
  }
  async passageSortie() {
    const g = this.game; g.busy = true;
    try {
      if (!this.gagnee && this.salle > 1) { await g.ui.say('Le passage est scellé tant que cette île est gardée.'); return; }
      const rien = !this.gagnee && this.salle === 1;
      if (!(await g.ui.yesNo(rien ? 'Quitter la faille ? Elle restera ouverte.' : 'Retourner sur la route avec ton butin ?'))) return;
      await this.sortir(rien ? 'renonce' : 'sortie');
    } finally { g.busy = false; if (!this.vivante) g.updateZone?.(); }
  }
  async portail(i) {
    const g = this.game; g.busy = true;
    try {
      if (this.gardien) { await this.sortir('gardien'); return; }
      const P = this.passages[i], dern = this.salle + 1 === SALLES;
      if (!(await g.ui.yesNo(`${RIFT_KINDS[P.kind].label} — ${dern ? 'gardien Alpha' + (P.kind === 'alpha' ? '' : ', ' + REGLE[P.kind].toLowerCase()) : REGLE[P.kind].toLowerCase()}.\nÀ la clé : ${itemName(P.lot.item)} ×${P.lot.n}. Entrer ?`))) return;
      await this.traverser(i);
    } finally { g.busy = false; if (!this.vivante) g.updateZone?.(); }
  }
  /** touche A face au Pokémon, à un portail ou à la sortie */
  async interagir() {
    const g = this.game, m = this.m, p = g.player; if (!m || g.busy) return false;
    const [dx, dy] = DIRS[p.dir] || [0, 1], fx = p.x + dx, fy = p.y + dy, F = m.faille, la = ([x, y]) => (x === fx && y === fy) || (x === p.x && y === p.y);
    if (this.mon && this.mon.x === fx && this.mon.y === fy) { this.trouve = 0; await this.affronter(); return true; }
    if (la(F.sortie)) { await this.passageSortie(); return true; }
    if (this.gagnee) { const i = F.portes.findIndex(la); if (i >= 0) { await this.portail(i); return true; } }
    return false;
  }
  /** la case est-elle prise (Pokémon de la salle) ? */
  occupe(x, y) { const M = this.mon; return !!(M && M.x === x && M.y === y); }

  /* ---------------- à chaque image ---------------- */
  tick(dt) {
    const g = this.game, m = this.m; if (!m || !this.vivante) return;
    this.t += dt; if (this.trouve > 0) this.trouve -= dt;
    const M = this.mon;
    if (M) {
      if (M.move) { M.move.t += dt / M.move.dur; if (M.move.t >= 1) { M.move = null; if (!g.busy) this.croise(); } }
      M.cd -= dt;
      // un Alpha te prend en chasse dès qu'il te voit
      if (!M.move && M.cd <= 0 && !g.busy && !(this.trouve > 0) && (this.kind === 'alpha' || this.gardien) && g.input?.free !== false) {
        const p = g.player, d = Math.abs(M.x - p.x) + Math.abs(M.y - p.y);
        M.cd = 0.55;
        if (d > 1 && d <= 7) {
          const q = pasVers(m, [M.x, M.y], [p.x, p.y], (x, y) => m.get(x, y) !== T.CAVE);
          if (q && !(q[0] === p.x && q[1] === p.y)) { if (!M.vu) { M.vu = true; g.sound?.sfx?.('bang'); M.cd = 0.8; } else { M.move = { fx: M.x, fy: M.y, t: 0, dur: 0.42 }; [M.x, M.y] = q; } }
        } else if (d > 7) M.vu = false;
      }
    }
    if (this.ouverts != null) this.ouverts = Math.min(1, this.ouverts + dt * 2.5);
    const v = g.view; if (!v?.actors || typeof document === 'undefined') return;
    this.dessiner(v, m, dt);
  }
  dessiner(v, m, dt) {
    const F = m.faille, f = Math.floor(this.t * 7) % 4;
    const anime = (id, w, peint, echelle, x, y, haut) => {
      let A = (this.acteurs ||= new Map()).get(id);
      if (!A) { A = { c: document.createElement('canvas'), f: -1 }; A.c.width = A.c.height = w; this.acteurs.set(id, A); }
      if (A.f !== f) { peint(A.c, f); A.f = f; A.neuf = true; }
      const a = v.imageActor(id, A.c, echelle, { lumineux: true });
      if (A.neuf && a.mesh?.material?.map) { a.mesh.material.map.needsUpdate = true; A.neuf = false; }
      v.place(a, x, y, haut, false); return a;
    };
    const portail = (id, kind, info, x, y, taille, ouv = 1) => v.portailActor(id, { kind, core: info.core, rim: info.rim, taille }).maj(dt, x, y, ouv);
    if (this.gagnee || this.salle === 1) portail('faille:sortie', 'sortie', SORTIE, F.sortie[0], F.sortie[1], 0.62);
    if (this.gagnee && this.ouverts != null) {
      F.portes.forEach(([x, y], i) => {
        const P = this.passages?.[i]; portail('faille:porte' + i, P ? P.kind : 'or', P ? RIFT_KINDS[P.kind] : OR, x, y, P ? 1 : 1.15, this.ouverts);
        // la récompense flotte au-dessus
        if (P) { const L = (this.lots ||= {}); const item = P.lot.item; if (L[i] === undefined) { L[i] = null; Promise.all([import('../assets.js')]).then(([{ loadImg, ASSETS }]) => loadImg(ASSETS.item(item))).then((img) => { L[i] = img || null; }, () => {}); } if (L[i]) { const q = v.imageActor('faille:lot' + i, L[i], 20 / Math.max(L[i].width, L[i].height), { lumineux: true }); v.place(q, x, y + 0.3, 4.9 + 0.15 * Math.sin(this.t * 2.4 + i), true); } }
      });
    }
    for (const o of this.eclats) anime('faille:eclat' + o.i, 16, (c, n) => peindreEclat(c, n, F.info.core), 1, o.x, o.y, 0.18 + 0.08 * Math.sin(this.t * 3 + o.i));
    this.dessinerMon(v, dt);
  }
  dessinerMon(v) {
    const M = this.mon; if (!M) return;
    const E = this.E;
    if (!this.images || this.images.mon !== E.wild) {
      if (this.charge === E.wild) return;
      this.charge = E.wild;
      Promise.all([import('../assets.js'), import('../render/aura.js')]).then(async ([{ loadImg, ASSETS }, { auraFrames }]) => {
        const img = await loadImg(ASSETS.front(E.wild.sp, E.wild.shiny)); if (!img || this.E !== E) return;
        let L = [img];
        if (E.opts.aura) { const { frames, pad } = auraFrames(img, E.opts.aura, 2); L = frames.map((fr) => { const c = document.createElement('canvas'); c.width = fr.width; c.height = img.height + pad; const x = c.getContext('2d'); x.drawImage(fr, 0, 0); x.drawImage(img, pad, pad); return c; }); }
        this.images = { mon: E.wild, L, f: -1, vide: videDessous(img) };
      }).catch((e) => warnDev('faille', e));
      return;
    }
    const I = this.images, f = Math.floor(this.t / 0.14) % I.L.length;
    const grand = E.wild.alpha ? (this.gardien ? 0.8 : 0.7) : 0.55, a = v.imageActor('faille:mon', I.L[0], grand, { lumineux: true });
    if (f !== I.f && a.mesh?.material?.map) { I.f = f; a.mesh.material.map.image = I.L[f]; a.mesh.material.map.needsUpdate = true; }
    const u = M.move ? Math.min(1, M.move.t) : 1, x = M.move ? M.move.fx + (M.x - M.move.fx) * u : M.x, y = M.move ? M.move.fy + (M.y - M.move.fy) * u : M.y;
    v.place(a, x, y - 0.05, (M.move ? Math.abs(Math.sin(u * Math.PI)) * 0.25 : 0.03 + 0.03 * Math.sin(this.t * 2.2)) - I.vide * grand * 0.0893, false);   // ses pattes touchent la roche
  }
  retirerActeur(id) { const v = this.game.view; if (v?.actors?.has(id)) v.removeActor(id); this.acteurs?.delete(id); }
  retirerActeurs() { const v = this.game.view; if (v?.actors) for (const id of [...v.actors.keys()]) if (String(id).startsWith('faille:')) v.removeActor(id); this.acteurs = new Map(); this.lots = {}; this.images = null; this.charge = null; }
  /** l'encart en haut à gauche : île, règle, butin */
  montrerBadge() {
    const g = this.game; if (typeof document === 'undefined' || !g.ui?.root) return;
    if (!this.badge) { this.badge = document.createElement('div'); this.badge.className = 'faille-encart'; g.ui.root.appendChild(this.badge); }
    const objets = Object.entries(this.butin.objets).map(([k, n]) => `${itemName(k)} ×${n}`).join(' · ');
    this.badge.className = 'faille-encart ' + this.kind;
    this.badge.innerHTML = '<b></b><span></span><em></em>';
    this.badge.children[0].textContent = `${RIFT_KINDS[this.kind].label} — île ${this.salle} sur ${SALLES}`;
    this.badge.children[1].textContent = this.gardien ? (this.gagnee ? 'Gardien vaincu' : this.kind === 'alpha' ? 'Gardien Alpha' : `Gardien Alpha · ${REGLE[this.kind]}`) : REGLE[this.kind];
    this.badge.children[2].textContent = this.butin.argent || objets ? `Butin : ${this.butin.argent.toLocaleString('fr-FR')} ₽${objets ? ' · ' + objets : ''}` : 'Butin : rien encore';
  }
}
/** rangées vides sous le dessin d'un Pokémon (différentes pour chaque espèce) */
function videDessous(img) {
  try {
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data;
    for (let v = 0; v < c.height; v++) for (let i = 0; i < c.width; i++) if (d[((c.height - 1 - v) * c.width + i) * 4 + 3] > 32) return v;
  } catch (e) { warnDev('faille', e); }
  return 0;
}
/** petit éclat de butin */
function peindreEclat(c, f, core) {
  const x = c.getContext('2d'); x.clearRect(0, 0, 16, 16);
  for (let j = 0; j < 12; j++) { const w = j < 4 ? j : j < 8 ? 4 : 12 - j; if (w <= 0) continue; x.fillStyle = '#0c0818'; x.fillRect(8 - w - 1, 2 + j, w * 2 + 2, 1); x.fillStyle = core; x.fillRect(8 - w, 2 + j, w * 2, 1); x.fillStyle = '#fff'; x.fillRect(8 - w, 2 + j, Math.max(1, w - 1), 1); }
  const [a, b] = [[2, 3], [13, 5], [12, 12], [3, 11]][f % 4]; x.fillStyle = '#fff4a8'; x.fillRect(a, b - 1, 1, 3); x.fillRect(a - 1, b, 3, 1);
}
/** un courant : une seule glissade jusqu'au bout, plus rapide que la marche */
async function glisser(g, d, m) {
  const p = g.player, [dx, dy] = DIRS[d];
  p.dir = d;
  while (m.faille.courants.get(p.x + ',' + p.y) === d) {
    if (![T.CAVE].includes(m.get(p.x + dx, p.y + dy))) break;
    if (typeof document === 'undefined') { p.x += dx; p.y += dy; continue; }
    p.move = { fx: p.x, fy: p.y, tx: p.x + dx, ty: p.y + dy, t: 0, dur: 0.11, scripted: true };
    while (p.move) await new Promise((r) => setTimeout(r, 12));
  }
}
