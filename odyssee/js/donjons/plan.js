// odyssee/js/donjons/plan.js — un donjon dessiné en texte devient une carte d'Odyssée (sans DOM). Repris du labo (TestOdyssée).
// Une lettre = une case. Légende commune ci-dessous ; chaque donjon ajoute ses PNJ et son décor (def.pnj, def.decor).
import { T, walkable } from '../world/tiles.js';
import { GameMap } from '../world/mapgen.js';

export const LEGENDE = {
  '#': 'mur',
  '.': 'sol',
  'S': 'arrivée des joueurs',
  'D': 'sortie vers l\'extérieur (sous l\'arrivée)',
  'o': 'dalle à tenir (sauf si le donjon donne un autre sens à la lettre)',
  'i': 'sol glacé : on y glisse jusqu\'au prochain obstacle',
  '0-9': 'porte scellée (s\'ouvre quand la salle qui la porte est terminée)',
};
// décor par défaut des objets du plan (def.objets)
const DECOR_OBJET = { ascenseur: 'console' };

const PORTE = 'caverock';

/** lit le plan : grille, portes, dalles, PNJ, salles (régions séparées par les portes) */
export function lirePlan(def) {
  const rows = def.plan.map((r) => r.replace(/\s+$/, ''));
  const w = Math.max(...rows.map((r) => r.length)) + 2, h = rows.length + 2;
  const at = (x, y) => (y >= 1 && y <= rows.length ? rows[y - 1][x - 1] ?? '#' : '#') || '#';
  const out = { w, h, depart: null, sortie: null, suivante: null, portes: {}, dalles: [], pnj: {}, decor: [], sol: [], objets: {}, glace: new Set() };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = x === 0 || x === w - 1 ? '#' : at(x, y);
    if (c === '#' || c === ' ') continue;
    // objet accroché au mur (`mur: true`) : la case reste un mur, l'objet se lit en lui faisant face
    if (def.objets?.[c]?.mur) { (out.objets[c] ||= []).push([x, y]); continue; }
    out.sol.push([x, y]);
    // le sol glacé, sauf si le donjon donne un autre sens à la lettre (l'interrupteur i du Temple)
    if (c === 'i' && !def.objets?.i) out.glace.add(x + ',' + y);
    else if (def.objets?.[c]) (out.objets[c] ||= []).push([x, y]);
    else if (c === 'S') out.depart = [x, y];
    else if (c === 'D') out.sortie = [x, y];
    else if (c === 'N') out.suivante = [x, y];
    else if (c === 'o' && !def.objets?.o) out.dalles.push([x, y]);
    else if (/[0-9]/.test(c)) (out.portes[c] ||= []).push([x, y]);
    else if (def.pnj?.[c]) (out.pnj[c] ||= []).push([x, y]);
    else if (def.decor?.[c]) out.decor.push([def.decor[c], x, y]);
    else if (c !== '.' && c !== 'i') throw new Error(`Plan de ${def.id} : lettre inconnue « ${c} » (ligne ${y}, colonne ${x})`);
  }
  if (!out.depart) throw new Error(`Plan de ${def.id} : il manque l'arrivée S`);
  for (const [k, l] of Object.entries(out.pnj)) if (l.length > 1) throw new Error(`Plan de ${def.id} : le PNJ « ${k} » apparaît ${l.length} fois`);
  return out;
}

/** construit la carte du donjon ; les portes sont posées fermées */
export function construireCarte(def) {
  const P = lirePlan(def);
  // une salle en plein air (def.dehors) : sol d'herbe (def.solDehors), murs d'arbres ou de haies (def.mur)
  const dehors = !!def.dehors, MUR = dehors ? T[def.mur || 'TREE'] : T.CAVEWALL, SOL = dehors ? T[def.solDehors || 'GRASS'] : T.CAVE;
  const m = new GameMap(def.carte, P.w, P.h, dehors ? { outdoor: true, fill: MUR, name: def.nom, music: def.musique || 'route' } : { outdoor: false, fill: T.CAVEWALL, floor: 'cave', music: def.musique || 'cave', name: def.nom, battleBg: 'cave' });
  m.edge = dehors ? T.TREE : T.CAVEWALL;
  for (const [x, y] of P.sol) m.set(x, y, SOL);
  if (P.sortie) m.set(...P.sortie, MUR);   // fermée tant qu'aucun extérieur ne la relie
  if (P.suivante) m.set(...P.suivante, MUR); // fermée tant que la salle n'est pas terminée
  for (const [k, x, y] of P.decor) m.prop(k, x, y);
  for (const [c, l] of Object.entries(P.objets)) {
    const o = def.objets[c];
    l.forEach(([x, y], i) => {
      if (o.type === 'panneau') m.sign(x, y, o.texte || '...');
      else if (o.type === 'ramasser') m.item(x, y, o.objet, o.n || 1, `${def.carte}:${c}:${i}`);
      else if (o.sol) { if (o.decor) m.deco.push({ k: o.decor, x, y }); }   // objet sur lequel on marche (départ d'un personnage…)
      else if (o.mur) (m.affiches ||= []).push({ x, y, texte: o.affiche, genre: o.tenture });  // dessinée sur la face sud du mur (rendu.js)
      else m.prop(o.decor || DECOR_OBJET[o.type] || 'statue', x, y);
    });
  }
  for (const [x, y] of P.dalles) m.deco.push({ k: 'carpet', x, y });
  for (const [k, l] of Object.entries(P.portes)) l.forEach(([x, y], i) => fermer(m, x, y, decorPorte(def, k, i, l.length)));
  m.donjon = { def, plan: P };
  m.glace = P.glace;
  if (def.style) m.style = def.style;
  // une zone par salle : le bandeau affiche son nom en y entrant
  for (const s of def.salles) {
    if (s.zone) { const [x0, y0, x1, y1] = s.zone; m.zone(x0 + 1, y0 + 1, x1 + 1, y1 + 1, { name: s.nom, music: s.musique || def.musique || 'cave', salle: s.id }); continue; }
    const r = regionDe(m, P, s);
    if (!r.length) continue;
    const xs = r.map((p) => p[0]), ys = r.map((p) => p[1]);
    m.zone(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys), { name: s.nom, music: s.musique || def.musique || 'cave' });
  }
  return m;
}

/** tapis (rectangles [x0, y0, x1, y1, couleur] du plan : rouge, 'rose' ou 'bleu') : une tuile par case, bordée du côté où le tapis s'arrête (rendu.js) */
function poserTapis(m, rects) {
  m.solArene ||= new Map();
  for (const [x0, y0, x1, y1, coul] of rects) {
    const t = new Set();
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) t.add((x + 1) + ',' + (y + 1));
    for (const k of t) {
      const [x, y] = k.split(',').map(Number), a = (dx, dy) => !t.has((x + dx) + ',' + (y + dy));
      m.solArene.set(k, `tapis${coul || ''}_${a(0, -1) ? 'N' : ''}${a(0, 1) ? 'S' : ''}${a(-1, 0) ? 'O' : ''}${a(1, 0) ? 'E' : ''}`);
    }
  }
}

/**
 * donjon en salles séparées (chaque salle a son `plan`) : une carte par salle, comme les étages d'un bâtiment.
 * La première garde l'identifiant du donjon (def.carte) ; N d'une salle mène à S de la suivante, D ramène devant
 * le N de la précédente (D de la première : vers l'extérieur, voir relierExterieur). Renvoie les cartes dans l'ordre.
 */
export function construireSalles(def) {
  const cartes = def.salles.map((s, i) => {
    const id = i ? `${def.carte}:${s.id}` : def.carte;
    s.carte = id;
    const m = construireCarte({ ...def, carte: id, plan: s.plan, salles: [], style: 'style' in s ? s.style : def.style, dehors: s.dehors, mur: s.mur, solDehors: s.solDehors });
    m.zone(0, 0, m.w - 1, m.h - 1, { name: s.nom, music: s.musique || def.musique || 'cave', salle: s.id, ...(s.zoneOpts || {}) });
    m.salle = s.id;
    if (s.sol) m.solSalle = s.sol;   // sol d'une autre couleur que celui du style
    if (s.tapis) poserTapis(m, s.tapis);
    if (s.sombre) m.dark = 'arene';   // dans le noir, même avec Flash
    if (s.sombre && def.vueLarge) m.vueLarge = true;   // ... mais on y voit sur la moitié de l'écran, en cercle (comme le labyrinthe des contes)
    return m;
  });
  // salle suivante : s.suivante, sinon celle d'après dans la liste (une salle des voies n'a pas de suite directe) ;
  // salle d'avant : celle dont c'est la suite, si elle est unique (plusieurs chemins qui se rejoignent : pas de retour)
  const idx = (id) => def.salles.findIndex((s) => s.id === id);
  const suite = (s, i) => (s.suivante !== undefined ? idx(s.suivante) : s.type === 'voies' ? -1 : i + 1);
  cartes.forEach((m, i) => {
    const P = m.donjon.plan, s = def.salles[i], j = suite(s, i), suiv = cartes[j];
    const avant = def.salles.map((q, k) => (k !== i && suite(q, k) === i ? k : -1)).filter((k) => k >= 0);
    const prec = avant.length === 1 ? cartes[avant[0]] : null;
    if (suiv && P.suivante) m.donjon.versSuivante = { map: suiv.id, x: suiv.donjon.plan.depart[0], y: suiv.donjon.plan.depart[1], dir: 'up' };
    if (prec && P.sortie && prec.donjon.plan.suivante) {
      const [nx, ny] = prec.donjon.plan.suivante, [sx, sy] = P.sortie;
      m.set(sx, sy, T.CAVEDOOR); m.warp(sx, sy, { map: prec.id, x: nx, y: ny + 1, dir: 'down' }); m.deco.push({ k: 'exitlight', x: sx, y: sy });
    }
  });
  return cartes;
}
/** passage vers la salle suivante : ouvert (case de sortie éclairée) ou muré */
export function passageSuivant(m, ouvert, vu = false) {
  const P = m.donjon.plan, w = m.donjon.versSuivante; if (!P.suivante || !w) return false;
  const [x, y] = P.suivante;
  // passage « vu » (salle.passageVu) : fermé, on voit quand même l'ouverture dans la roche, sans pouvoir y entrer
  if (vu) {
    const deja = m.warps.has(x + ',' + y), creuse = m.get(x, y) !== T.CAVEDOOR;
    if (ouvert === deja && !creuse) return false;
    m.set(x, y, T.CAVEDOOR);
    if (ouvert) { if (!deja) m.warp(x, y, w); } else m.warps.delete(x + ',' + y);
    return true;
  }
  const deja = m.get(x, y) === T.CAVEDOOR;
  if (ouvert === deja) return false;
  if (ouvert) { m.set(x, y, T.CAVEDOOR); m.warp(x, y, w); m.deco.push({ k: 'exitlight', x, y }); }
  else { m.set(x, y, T.CAVEWALL); m.warps.delete(x + ',' + y); m.deco = m.deco.filter((d) => !(d.x === x && d.y === y)); }
  return true;
}

/** cases d'une salle : tout ce qu'on atteint depuis son repère sans passer une porte */
export function regionDe(m, P, salle) {
  if (salle.zone) { const [x0, y0, x1, y1] = salle.zone; return P.sol.filter(([x, y]) => x > x0 && x <= x1 + 1 && y > y0 && y <= y1 + 1); }
  const rep = repere(P, salle);
  if (!rep) return [];
  const portes = new Set(Object.values(P.portes).flat().map(([x, y]) => x + ',' + y));
  const sol = new Set(P.sol.map(([x, y]) => x + ',' + y));
  const seen = new Set([rep.join(',')]), q = [rep], out = [];
  while (q.length) {
    const [x, y] = q.pop(); out.push([x, y]);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = (x + dx) + ',' + (y + dy);
      if (seen.has(k) || portes.has(k) || !sol.has(k)) continue;
      seen.add(k); q.push([x + dx, y + dy]);
    }
  }
  return out;
}
function repere(P, salle) {
  if (salle.repere === 'S') return P.depart;
  const k = salle.repere || salle.pnj?.[0];
  if (k === 'o') return P.dalles[0];
  return k ? P.pnj[k]?.[0] : null;
}

export function fermer(m, x, y, k = PORTE) {
  if (m.get(x, y) !== T.BLOCK) { m.set(x, y, T.CAVE); m.prop(k, x, y); }
}
/** décor d'une case de porte : def.portesDecor[chiffre] (dessin sur la case du milieu, rien sur les autres) */
export function decorPorte(def, k, i, n) {
  const d = def.portesDecor?.[k]; if (!d) return PORTE;
  return i === (n >> 1) ? d : 'porte_vide';
}
export function ouvrir(m, x, y) {
  if (m.get(x, y) !== T.BLOCK) return false;
  m.set(x, y, T.CAVE);
  m.under.delete(x + ',' + y);
  m.deco = m.deco.filter((d) => !(d.x === x && d.y === y));
  return true;
}

/** case libre à côté d'un objet (sous lui de préférence) : là où l'on arrive en prenant l'ascenseur */
export function aCote(m, P, c) {
  const [x, y] = P.objets[c][0];
  const sol = new Set(P.sol.map(([a, b]) => a + ',' + b));
  for (const [dx, dy] of [[0, 1], [-1, 0], [1, 0], [0, -1]]) if (sol.has((x + dx) + ',' + (y + dy)) && !P.decor.some(([, a, b]) => a === x + dx && b === y + dy)) return [x + dx, y + dy];
  return P.depart;
}

/**
 * nombre de joueurs d'un donjon, tel qu'il s'affiche (panneau d'entrée, liste des lieux) :
 * solo (fait pour être seul, chacun a le sien), groupe (n conseillés, rien ne bloque), exact (n obligatoires)
 */
export function texteJoueurs(def) {
  const j = def.joueurs || { mode: 'groupe', n: 1 };
  if (j.mode === 'solo') return 'Donjon solo';
  if (j.mode === 'exact') return `Donjon à ${j.n} joueurs`;
  if (j.mode === 'entre') return j.max === j.min + 1 ? `Donjon à ${j.min} ou ${j.max} joueurs` : `Donjon de ${j.min} à ${j.max} joueurs`;
  return `Donjon solo ou en groupe (${j.n} joueurs recommandés)`;
}
/** le panneau d'entrée, dehors à côté de la porte : nom, phrase, nombre de joueurs (une page chacun) */
export const textePanneau = (def) => [def.nom, def.entree, texteJoueurs(def)].filter(Boolean).join('\n');

/**
 * relie le donjon à son extérieur (def.exterieur() construit une carte d'Odyssée en plein air et renvoie
 * { carte, porte: [x, y] }) : la porte de l'extérieur mène à l'arrivée S, la sortie D ramène devant la porte.
 */
/** le panneau d'entrée : juste à côté de l'allée, une ou deux cases devant la porte */
function poserPanneau(def, carte, [px, py]) {
  for (const [dx, dy] of [[1, 2], [-1, 2], [2, 1], [-2, 1], [1, 3], [-1, 3], [2, 2], [-2, 2]]) {
    const x = px + dx, y = py + dy;
    if (!carte.in(x, y) || !walkable(carte.get(x, y)) || carte.warpAt(x, y) || carte.deco.some((q) => q.x === x && q.y === y)) continue;
    // pas sur les marches d'un bâtiment (cases libres de son emprise)
    if (carte.buildings.some((b) => x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + (b.d ?? b.h))) continue;
    carte.sign(x, y, textePanneau(def));
    return;
  }
  throw new Error(`Panneau d'entrée de ${def.id} : pas de place près de la porte`);
}

export function relierExterieur(def, m) {
  if (!def.exterieur) return null;
  const E = def.exterieur(), { carte, porte } = E;
  // le panneau d'entrée : à la case demandée (E.panneau), sinon à côté de la porte
  if (def.entree) { if (E.panneau) carte.sign(...E.panneau, textePanneau(def)); else poserPanneau(def, carte, porte); }
  const P = m.donjon.plan, [px, py] = porte;
  carte.warp(px, py, { map: m.id, x: P.depart[0], y: P.depart[1], dir: 'up' });
  for (const [x, y] of E.portes2 || []) carte.warp(x, y, { map: m.id, x: P.depart[0], y: P.depart[1], dir: 'up' });   // porte de deux cases
  if (P.sortie) {
    const [sx, sy] = P.sortie;
    m.set(sx, sy, T.CAVEDOOR);
    m.warp(sx, sy, { map: carte.id, x: px, y: py + 1, dir: 'down' });
    m.deco.push({ k: 'exitlight', x: sx, y: sy });
  }
  m.outside = { map: carte.id, x: px, y: py + 1 };
  m.donjon.exterieur = { ...E, carte, porte };
  return carte;
}

