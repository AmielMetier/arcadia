// odyssee/js/donjons/etat.js — état d'un donjon partagé par le groupe (sans DOM ni réseau). Repris du labo (TestOdyssée).
// L'hôte du salon le tient : chaque joueur lui envoie des demandes, il applique les règles et renvoie l'état à tous.
//
// Salles (def.salles), dans l'ordre :
//   accueil : terminée quand un joueur demande au gardien d'ouvrir le donjon (le groupe est alors compté)
//   combat  : terminée quand tous ses adversaires sont battus ; un adversaire ne se combat que par un joueur à la fois
//   dalles  : terminée quand assez de joueurs se tiennent sur les dalles en même temps (autant que de joueurs présents, au plus le nombre de dalles)
//   boss    : PV partagés par le groupe ; chaque combat retire ce qu'il a infligé
//   serrures : chaque PNJ (s.pnj) donne une clé à qui le bat ; la salle est terminée quand toutes les clés sont dans
//             les serrures. Une clé pas encore posée retourne à son PNJ si son porteur quitte le donjon
//   libre   : rien à faire (salle de passage, casse-tête sans porte)
//   autres  : leur avancée est notée par le jeu avec l'action « maj » (donjon des miroirs)
//   raid    : le combat contre le boss se lance quand tous les joueurs présents dans sa salle sont prêts (l'hôte en décide)
//   groupe  : ses dresseurs (s.pnj) se combattent l'un après l'autre, à tous les joueurs présents contre plusieurs Pokémon
//   voies   : chaque porte (s.voies) ne laisse passer qu'un seul joueur ; libre pour le reste
//   etage   : comme combat, mais certains dresseurs ne sont là qu'à 3 ou qu'à 4 joueurs (def.pnj[k].pour, compté aux
//             dalles : e.nb) ; les duos (def.pnj[k].duo) se combattent à deux joueurs (actions couple*) ; objets de
//             soin partagés (ramasse)
//   arene   : duel entre les deux joueurs arrivés par ses portes (s.portes, lettres des portes de la salle des voies) ;
//             seul, on affronte le reflet d'un autre joueur (actions duel*). sommet : duel entre les gagnants des arènes
//
// Chemins qui se séparent : s.apres (salles à terminer avant celle-ci) remplace l'ordre de la liste.

export function nouvelEtat(def, o = {}) {
  const joueurs = Math.max(1, o.joueurs || 1);
  const salles = {};
  for (const s of def.salles) salles[s.id] = { faite: s.type === 'libre' || s.type === 'voies', battus: [], pris: {}, dalles: 0, cles: {}, prets: [], combat: false, donnees: {} };
  const e = {
    id: def.id, run: o.run || 1, v: 0, joueurs, fini: false,
    salles,
    boss: o.bossPv ? { pv: o.bossPv * (joueurs + 1), max: o.bossPv * (joueurs + 1) } : null,
    vainqueurs: [],
    nb: null,      // joueurs comptés aux dalles (donjons à nombre variable)
    dehors: [],    // joueurs éliminés ou sortis (la pyramide ne les attend plus)
  };
  // ce que le donjon tire au sort à chaque descente (codes…) : l'hôte le tire, les autres reçoivent son état
  if (def.preparer) e.secret = def.preparer(o.rng || Math.random);
  return e;
}

/** les artefacts du tombeau : à leur place d'origine (p : porteur, sol : [carte, x, y] s'il est posé) */
export const artVide = () => ({ pend: { p: null, sol: null, vole: false, fin: false }, lun: { p: null, sol: null } });

const salleDe = (def, pnj) => def.salles.find((s) => s.pnj?.includes(pnj));
/** salle de combat à plusieurs : celle demandée, sinon la première */
export const salleRaid = (def, id) => def.salles.find((q) => (q.type === 'raid' || q.type === 'groupe') && (!id || q.id === id));

/** une salle est accessible quand toutes celles d'avant sont terminées */
export function ouverte(def, e, salleId) {
  const cible = def.salles.find((s) => s.id === salleId);
  if (cible?.apres) return cible.apres.every((id) => e.salles[id]?.faite);
  for (const s of def.salles) { if (s.id === salleId) return true; if (!e.salles[s.id].faite) return false; }
  return false;
}
export const battu = (e, def, pnj) => { const s = salleDe(def, pnj); return !!s && e.salles[s.id].battus.includes(pnj); };
/** dresseurs d'une salle pour le nombre de joueurs compté aux dalles (3 tant qu'on ne sait pas) */
export const pourNb = (e) => (e.nb >= 4 ? 4 : 3);
export const actifs = (def, e, s) => (s.pnj || []).filter((k) => !def.pnj[k]?.pour || def.pnj[k].pour === pourNb(e));
/** joueurs attendus dans une arène : ceux qui ont pris ses portes, sauf les éliminés */
export function attendusArene(def, e, s) {
  const sv = def.salles.find((q) => q.type === 'voies'); if (!sv) return [];
  const V = e.salles[sv.id].donnees.voies || {};
  return [...new Set(s.portes.map((l) => V[l]).filter(Boolean))].filter((q) => !e.dehors.includes(q));
}
/** joueurs attendus au sommet : les gagnants des arènes encore là */
export function attendusSommet(def, e) {
  return def.salles.filter((q) => q.type === 'arene').map((q) => e.salles[q.id].donnees.gagnant).filter((q) => q && !e.dehors.includes(q));
}
/** une arène dont l'issue n'est pas encore connue (quelqu'un y est encore attendu) */
export const areneEnCours = (def, e) => def.salles.some((q) => q.type === 'arene' && !e.salles[q.id].faite && attendusArene(def, e, q).length);
export const prisPar = (e, def, pnj) => { const s = salleDe(def, pnj); return s ? e.salles[s.id].pris[pnj] ?? null : null; };

/**
 * applique la demande `m` du joueur `qui` ; renvoie { ok, change, why? }.
 * Toute modification incrémente e.v (l'hôte renvoie alors l'état à tous).
 */
export function appliquer(def, e, qui, m, o = {}) {
  const res = (ok, change, why) => { if (change) e.v++; return { ok, change, why }; };
  qui = String(qui);
  switch (m.a) {
    case 'ouvrir': {
      const s = def.salles.find((q) => q.type === 'accueil');
      if (!s || e.salles[s.id].faite) return res(false, false, 'deja');
      const fresh = nouvelEtat(def, { joueurs: o.joueurs, bossPv: o.bossPv, run: e.run + 1 });
      Object.assign(e, fresh, { v: e.v });
      e.salles[s.id].faite = true;
      return res(true, true);
    }
    case 'prendre': {
      const s = salleDe(def, m.pnj); if (!s) return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      if (!ouverte(def, e, s.id)) return res(false, false, 'ferme');
      if (S.battus.includes(m.pnj)) return res(false, false, 'battu');
      if (S.cles[m.pnj]) return res(false, false, 'donnee');
      if (S.pris[m.pnj] && S.pris[m.pnj] !== qui) return res(false, false, 'occupe');
      if (S.pris[m.pnj] === qui) return res(true, false);
      S.pris[m.pnj] = qui;
      return res(true, true);
    }
    case 'lacher': {
      const s = salleDe(def, m.pnj); if (!s) return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      if (S.pris[m.pnj] !== qui) return res(false, false);
      delete S.pris[m.pnj];
      return res(true, true);
    }
    case 'gagne': {
      const s = salleDe(def, m.pnj); if (!s || (s.type !== 'combat' && s.type !== 'etage' && s.type !== 'libre')) return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      if (S.battus.includes(m.pnj)) return res(false, false, 'battu');
      if (S.pris[m.pnj] && S.pris[m.pnj] !== qui) return res(false, false, 'occupe');
      delete S.pris[m.pnj];
      S.battus.push(m.pnj);
      if ((s.type === 'etage' ? actifs(def, e, s) : s.pnj).every((p) => S.battus.includes(p))) S.faite = true;
      return res(true, true);
    }
    case 'degats': {
      const s = def.salles.find((q) => q.type === 'boss');
      if (!s || !e.boss || e.fini || !ouverte(def, e, s.id)) return res(false, false, 'ferme');
      const n = Math.max(0, Math.min(e.boss.pv, Math.floor(+m.n || 0)));
      if (!n) return res(true, false);
      e.boss.pv -= n;
      if (!e.vainqueurs.includes(qui)) e.vainqueurs.push(qui);
      if (e.boss.pv <= 0) { e.boss.pv = 0; e.salles[s.id].faite = true; e.fini = true; }
      return res(true, true);
    }
    case 'dalles': {
      // décidé par l'hôte à partir des positions : m.n joueurs sur les dalles, m.requis joueurs nécessaires
      const s = def.salles.find((q) => q.type === 'dalles' && q.id === (m.salle || q.id));
      if (!s || e.salles[s.id].faite || !ouverte(def, e, s.id)) return res(false, false);
      const S = e.salles[s.id], n = Math.max(0, m.n | 0);
      let change = S.dalles !== n; S.dalles = n;
      if (m.requis > 0 && n >= m.requis) { S.faite = true; change = true; if (def.joueurs?.mode === 'entre') e.nb = n; }
      return res(true, change);
    }
    case 'cle': {
      const s = salleDe(def, m.pnj); if (!s || s.type !== 'serrures') return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      if (S.cles[m.pnj]) return res(false, false, 'donnee');
      if (S.pris[m.pnj] && S.pris[m.pnj] !== qui) return res(false, false, 'occupe');
      delete S.pris[m.pnj];
      S.cles[m.pnj] = { a: qui, mise: false };
      return res(true, true);
    }
    case 'inserer': {
      const s = def.salles.find((q) => q.type === 'serrures' && (!m.salle || q.id === m.salle)); if (!s) return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      const miennes = Object.values(S.cles).filter((c) => c.a === qui && !c.mise);
      if (!miennes.length) return res(false, false, 'aucune');
      for (const c of miennes) c.mise = true;
      if (s.pnj.every((p) => S.cles[p]?.mise)) S.faite = true;
      return res(true, true);
    }
    case 'voie': {
      // un joueur franchit une porte de la salle des voies : elle se referme pour les autres
      const s = def.salles.find((q) => q.type === 'voies' && q.id === m.salle); if (!s || !s.voies?.[m.voie]) return res(false, false, 'inconnu');
      const V = (e.salles[s.id].donnees.voies ||= {});
      // mode test (un seul joueur) : toutes les portes lui sont ouvertes
      if (!m.test && V[m.voie] && V[m.voie] !== qui) return res(false, false, 'prise');
      if (!m.test && Object.entries(V).some(([k, q]) => q === qui && k !== m.voie)) return res(false, false, 'deja');
      if (V[m.voie] === qui) return res(true, false);
      V[m.voie] = qui;
      return res(true, true);
    }
    case 'pret': case 'pasPret': {
      const s = salleRaid(def, m.salle);
      if (!s || e.salles[s.id].faite || !ouverte(def, e, s.id)) return res(false, false, 'ferme');
      const S = e.salles[s.id], dedans = S.prets.includes(qui);
      if (m.a === 'pret' && !dedans) { S.prets.push(qui); return res(true, true); }
      if (m.a === 'pasPret' && dedans && !S.combat) { S.prets = S.prets.filter((q) => q !== qui); return res(true, true); }
      return res(true, false);
    }
    case 'raid': {
      // décidé par l'hôte : début (m.etape 'debut') ou fin du combat (m.etape 'fin', m.result)
      const s = salleRaid(def, m.salle); if (!s) return res(false, false);
      const S = e.salles[s.id];
      if (m.etape === 'debut') { S.combat = true; return res(true, true); }
      S.combat = false; S.prets = [];
      // salle de combats de groupe : un dresseur de moins ; terminée quand tous sont battus
      if (s.type === 'groupe') { if (m.result === 'win' && m.pnj && !S.battus.includes(m.pnj)) S.battus.push(m.pnj); if (s.pnj.every((p) => S.battus.includes(p))) S.faite = true; return res(true, true); }
      // le donjon ne finit qu'avec le combat de sa dernière salle (un boss en chemin ne fait qu'ouvrir la suite)
      if (m.result === 'win') { S.faite = true; if (s === def.salles[def.salles.length - 1]) e.fini = true; for (const q of m.vainqueurs || []) if (!e.vainqueurs.includes(String(q))) e.vainqueurs.push(String(q)); }
      return res(true, true);
    }
    case 'maj': {
      // avancée propre à un donjon : m.donnees est fusionné dans la salle, m.faite la termine, m.fini termine le donjon
      const S = e.salles[m.salle]; if (!S) return res(false, false, 'inconnu');
      if (m.donnees && typeof m.donnees === 'object') S.donnees = { ...S.donnees, ...m.donnees };
      if (m.faite) S.faite = true;
      if (m.fini) e.fini = true;
      return res(true, true);
    }
    case 'choixStarter': {
      // la table du Temple : un joueur choisit une Poké Ball (m.n, ou null pour reposer la sienne)
      const S = e.salles[m.salle]; if (!S) return res(false, false, 'inconnu');
      const D = S.donnees, A = (D.attrib ||= {}), C = (D.choix ||= {}), X = (D.exclus ||= {});
      if (A[qui] != null) return res(false, false, 'deja');
      if (D.duel?.ids.includes(qui)) return res(false, false, 'duel');
      if (m.n != null && Object.values(A).includes(m.n)) return res(false, false, 'pris');
      if (m.n != null && (X[qui] || []).includes(m.n)) return res(false, false, 'exclu');
      if (m.n == null) delete C[qui]; else C[qui] = m.n;
      return res(true, true);
    }
    case 'starterDuelFin': {
      // fin d'un duel pour une Poké Ball : le perdant repose la sienne et ne peut plus la reprendre
      const S = e.salles[m.salle]; if (!S?.donnees.duel) return res(true, false);
      const D = S.donnees, { ids, n } = D.duel, gagnant = ids.includes(String(m.gagnant)) ? String(m.gagnant) : ids[0];
      for (const q of ids) if (q !== gagnant) { delete D.choix[q]; ((D.exclus ||= {})[q] ||= []).push(n); }
      D.duel = null;
      return res(true, true);
    }
    case 'ramasse': {
      // objet de soin partagé : le premier qui le prend l'a, il disparaît pour les autres
      const S = e.salles[m.salle]; if (!S || typeof m.objet !== 'string') return res(false, false, 'inconnu');
      const R = (S.donnees.ramasses ||= []);
      if (R.includes(m.objet)) return res(false, false, 'deja');
      R.push(m.objet);
      return res(true, true);
    }
    case 'couple': case 'coupleAnnule': {
      // duo de dresseurs : on attend un partenaire (m.test : on y va seul)
      const s = salleDe(def, m.pnj); if (!s || s.type !== 'etage' || !def.pnj[m.pnj]?.duo) return res(false, false, 'inconnu');
      const S = e.salles[s.id], A = (S.donnees.attente ||= {}), l = A[m.pnj] || [];
      if (m.a === 'coupleAnnule') { if (!l.includes(qui) || S.pris[m.pnj]) return res(true, false); A[m.pnj] = l.filter((q) => q !== qui); return res(true, true); }
      if (!ouverte(def, e, s.id)) return res(false, false, 'ferme');
      if (S.battus.includes(m.pnj)) return res(false, false, 'battu');
      if (S.pris[m.pnj]) return res(false, false, 'occupe');
      if (l.includes(qui)) return res(true, false);
      if (l.length >= 2) return res(false, false, 'complet');
      // on n'attend qu'un duo à la fois
      for (const [k, q] of Object.entries(A)) if (k !== m.pnj && q.includes(qui)) A[k] = q.filter((x) => x !== qui);
      A[m.pnj] = [...l, qui];
      if (m.test) (S.donnees.seul ||= {})[m.pnj] = true;
      return res(true, true);
    }
    case 'coupleDebut': case 'coupleFin': {
      // décidé par l'hôte : le combat du duo commence (m.ids), ou finit (m.result)
      const s = salleDe(def, m.pnj); if (!s || s.type !== 'etage') return res(false, false, 'inconnu');
      const S = e.salles[s.id], A = (S.donnees.attente ||= {});
      if (m.a === 'coupleDebut') { S.pris[m.pnj] = 'duo'; delete A[m.pnj]; return res(true, true); }
      delete S.pris[m.pnj];
      if (m.result === 'win' && !S.battus.includes(m.pnj)) S.battus.push(m.pnj);
      if (actifs(def, e, s).every((p) => S.battus.includes(p))) S.faite = true;
      return res(true, true);
    }
    case 'duelPret': case 'duelAnnule': {
      const s = def.salles.find((q) => q.id === m.salle && (q.type === 'arene' || q.type === 'sommet')); if (!s) return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      if (S.faite) return res(false, false, 'fini');
      const dedans = S.prets.includes(qui);
      if (m.a === 'duelPret' && !dedans) { S.prets.push(qui); return res(true, true); }
      if (m.a === 'duelAnnule' && dedans && !S.combat) { S.prets = S.prets.filter((q) => q !== qui); return res(true, true); }
      return res(true, false);
    }
    case 'duelDebut': case 'duelFin': {
      // décidé par l'hôte (début), puis annoncé par les combattants (fin : m.gagnant, null si personne)
      const s = def.salles.find((q) => q.id === m.salle && (q.type === 'arene' || q.type === 'sommet')); if (!s) return res(false, false, 'inconnu');
      const S = e.salles[s.id];
      if (m.a === 'duelDebut') { S.combat = true; S.donnees.ids = m.ids || []; return res(true, true); }
      if (S.faite) return res(true, false);
      S.combat = false; S.prets = []; S.faite = true;
      const ids = S.donnees.ids || [qui];
      S.donnees.gagnant = m.gagnant ? String(m.gagnant) : null;
      for (const q of ids) if (q !== S.donnees.gagnant && !e.dehors.includes(q)) e.dehors.push(q);
      if (s.type === 'sommet') { e.fini = true; if (S.donnees.gagnant) e.vainqueurs = [S.donnees.gagnant]; }
      return res(true, true);
    }
    case 'artefact': {
      // le Pendentif Maudit (pend) et les Lunettes de Vérité (lun) du tombeau : un porteur à la fois, jamais les deux
      const S0 = e.salles[def.salles[0].id], A = (S0.donnees.art ||= artVide()), o = A[m.k];
      if (!o) return res(false, false, 'inconnu');
      const autre = A[m.k === 'pend' ? 'lun' : 'pend'];
      switch (m.op) {
        case 'prendre':
          if (o.p) return res(false, false, 'pris');
          if (o.vole || o.fin) return res(false, false, 'vole');
          if (autre.p === qui && !m.test) return res(false, false, 'deux');
          o.p = qui; o.sol = null; return res(true, true);
        case 'poser':
          if (o.p !== qui) return res(false, false, 'pas');
          o.p = null; o.sol = Array.isArray(m.ou) ? m.ou : null; return res(true, true);
        case 'donner': {
          const a = String(m.a2);
          if (o.p !== qui) return res(false, false, 'pas');
          if (autre.p === a && !m.test) return res(false, false, 'deux');
          o.p = a; return res(true, true);
        }
        case 'origine': if (o.p !== qui && !m.test) return res(false, false, 'pas'); o.p = null; o.sol = null; return res(true, true);
        case 'voler': if (o.vole) return res(true, false); o.p = null; o.sol = null; o.vole = true; return res(true, true);
        case 'rendre': if (!o.vole) return res(true, false); o.vole = false; o.sol = Array.isArray(m.ou) ? m.ou : null; return res(true, true);
        case 'fin': if (o.p !== qui && !m.test) return res(false, false, 'pas'); o.p = null; o.sol = null; o.fin = true; return res(true, true);
      }
      return res(false, false, 'inconnu');
    }
    case 'equipe': return res(true, false);
    case 'poste': {
      // poste de contrôle de la mine : un seul joueur à la fois
      const S = e.salles[m.salle]; if (!S) return res(false, false, 'inconnu');
      if (m.lacher) { if (S.donnees.poste !== qui) return res(true, false); delete S.donnees.poste; return res(true, true); }
      if (S.donnees.poste && S.donnees.poste !== qui && !m.test) return res(false, false, 'pris');
      if (S.donnees.poste === qui) return res(true, false);
      S.donnees.poste = qui;
      return res(true, true);
    }   // l'équipe du joueur, gardée par l'hôte (reflets des arènes)
    case 'elimine': {
      if (e.dehors.includes(qui)) return res(true, false);
      e.dehors.push(qui);
      return res(true, true);
    }
    case 'parti': case 'sortie': {
      let change = false;
      if (def.joueurs?.mode === 'entre' && !e.dehors.includes(qui) ) { e.dehors.push(qui); change = true; }
      for (const S of Object.values(e.salles)) {
        for (const [p, q] of Object.entries(S.pris)) if (q === qui) { delete S.pris[p]; change = true; }
        for (const [p, c] of Object.entries(S.cles)) if (c.a === qui && !c.mise) { delete S.cles[p]; change = true; }
        if (!S.combat && S.prets.includes(qui)) { S.prets = S.prets.filter((q) => q !== qui); change = true; }
        for (const [k, l] of Object.entries(S.donnees.attente || {})) if (l.includes(qui)) { S.donnees.attente[k] = l.filter((q) => q !== qui); change = true; }
        if (S.donnees.poste === qui) { delete S.donnees.poste; change = true; }
        // un porteur d'artefact s'en va : l'artefact retourne à sa place d'origine
        for (const o of Object.values(S.donnees.art || {})) if (o.p === qui) { o.p = null; o.sol = null; change = true; }
      }
      return res(true, change);
    }
    case 'recommencer': {
      Object.assign(e, nouvelEtat(def, { run: e.run + 1 }), { v: e.v });
      return res(true, true);
    }
  }
  return res(false, false, 'inconnu');
}

/** nombre de joueurs requis sur les dalles */
export const requisDalles = (nbDalles, presents) => Math.max(1, Math.min(nbDalles, presents));
/**
 * joueurs à tenir sur les dalles d'une salle : salle.requis s'il est donné, le nombre du donjon pour un donjon
 * « à n joueurs » (la porte ne s'ouvre qu'à n), sinon autant que de joueurs présents
 */
export function requisSalle(def, salle, nbDalles, presents) {
  if (salle.requis) return salle.requis;
  if (salle.requisMax) return Math.max(1, Math.min(salle.requisMax, presents));
  if (def.joueurs?.mode === 'exact') return def.joueurs.n;
  if (def.joueurs?.mode === 'entre') return Math.max(def.joueurs.min, Math.min(def.joueurs.max, nbDalles, presents));
  return requisDalles(nbDalles, presents);
}

/** clés qu'un joueur a sur lui (pas encore posées) */
export const clesDe = (def, e, qui) => {
  const out = [];
  for (const s of def.salles) if (s.type === 'serrures') for (const [p, c] of Object.entries(e.salles[s.id].cles)) if (c.a === String(qui) && !c.mise) out.push(p);
  return out;
};
/** nombre de serrures remplies */
export const serrures = (def, e) => { const s = def.salles.find((q) => q.type === 'serrures'); return s ? Object.values(e.salles[s.id].cles).filter((c) => c.mise).length : 0; };

/**
 * la table du Temple (côté hôte) : quand chaque joueur présent sans compagnon a choisi, les choix uniques sont
 * attribués et deux joueurs qui veulent la même Poké Ball se départagent en duel. Renvoie les données à mettre à jour
 * ({ attrib, choix, duel }), ou null s'il n'y a rien à faire.
 */
export function resoudreStarters(D, presents, graine = () => 1) {
  if (D.duel) return null;
  const A = { ...(D.attrib || {}) }, C = { ...(D.choix || {}) };
  const attendus = presents.map(String).filter((q) => A[q] == null);
  if (!attendus.length || attendus.some((q) => C[q] == null)) return null;
  let duel = null, change = false;
  for (const n of [...new Set(attendus.map((q) => C[q]))]) {
    const l = attendus.filter((q) => C[q] === n);
    if (l.length === 1) { A[l[0]] = n; delete C[l[0]]; change = true; }
    else if (!duel) { duel = { ids: l.slice(0, 2), n, seed: graine() }; change = true; }
  }
  return change ? { attrib: A, choix: C, duel } : null;
}
