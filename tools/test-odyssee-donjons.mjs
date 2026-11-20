// tools/test-odyssee-donjons.mjs — les donjons à plusieurs d'Odyssée (odyssee/js/donjons/) : la Crypte des Murmures est
// posée dans le cimetière des ruines d'une impasse de la Route 2, sa porte s'atteint depuis la route, ses salles se suivent
// porte après porte, et une descente entière (gardien, esprits, dalles, Ossarion aux PV partagés) se joue d'un bout à
// l'autre, puis se recommence.
//   node tools/test-odyssee-donjons.mjs
import { buildWorld } from '../odyssee/js/world/region.js';
import { walkable } from '../odyssee/js/world/tiles.js';
import { nouvelEtat, appliquer, ouverte } from '../odyssee/js/donjons/etat.js';
import CRYPTE from '../odyssee/js/donjons/crypte.js';
import { ITEMS } from '../odyssee/js/core/items.js';
import { DONJONS } from '../odyssee/js/donjons/index.js';
import { construireSalles, passageSuivant, ouvrir, texteJoueurs, relierExterieur } from '../odyssee/js/donjons/plan.js';
import { requisSalle } from '../odyssee/js/donjons/etat.js';
import { cle, explorerGlace, faisceau, resoudreReflet, cheminGlace, reponseJuste } from '../odyssee/js/donjons/casse-tetes.js';
import { Raid } from '../odyssee/js/donjons/combat/raid.js';
import { Groupe } from '../odyssee/js/donjons/combat/groupe.js';
import { createMon, isFainted } from '../odyssee/js/core/mon.js';
import { MOVES } from '../odyssee/js/data/moves.js';
import { T } from '../odyssee/js/world/tiles.js';

let n = 0, echecs = 0;
const checks = { get n() { return n; } };
const ok = (c, msg) => { n++; if (!c) { echecs++; console.log('ÉCHEC : ' + msg); } };
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const world = buildWorld(), W = world.maps.monde, m = world.maps.crypte;
ok(W.crypte && m, 'la crypte est posée dans le monde');
const [px, py] = W.crypte.porte;
ok(W.zoneAt(px, py + 1)?.name === 'Cimetière des Murmures' && W.zoneAt(px, py + 1)?.route === 'r2', 'la crypte est dans le Cimetière des Murmures, sur la Route 2');
ok(W.warpAt(px, py)?.map === 'crypte' && m.warpAt(...m.donjon.plan.sortie)?.map === 'monde', 'la porte mène à la crypte, la sortie ramène dehors');
ok(ITEMS['cle-crypte']?.key, 'la Clé de la Crypte est un objet rare');

// la porte s'atteint depuis la Route 2 (une case de route praticable, hors du lieu)
{
  const z = W.zones.find((q) => q.name === 'Cimetière des Murmures');
  const vu = new Set([px + ',' + (py + 1)]), f = [[px, py + 1]];
  let route = false;
  while (f.length && !route) {
    const [x, y] = f.pop();
    for (const [dx, dy] of N4) {
      const a = x + dx, b = y + dy, k = a + ',' + b;
      if (vu.has(k) || !walkable(W.get(a, b)) || Math.abs(a - px) > 60 || Math.abs(b - py) > 60) continue;
      vu.add(k); f.push([a, b]);
      const zz = W.zoneAt(a, b); if (zz && zz !== z && zz.route === 'r2' && zz.name.startsWith('Route')) route = true;
    }
  }
  ok(route, 'on rejoint la Route 2 depuis la porte de la crypte');
}

// le plan : portes ouvertes, tout est atteignable depuis l'arrivée
{
  const P = m.donjon.plan, portes = new Set(Object.values(P.portes).flat().map((c) => c + ''));
  const marche = (x, y) => walkable(m.get(x, y)) || portes.has(x + ',' + y);
  const vu = new Set([P.depart + '']), f = [P.depart];
  while (f.length) { const [x, y] = f.pop(); for (const [dx, dy] of N4) { const a = x + dx, b = y + dy; if (!vu.has(a + ',' + b) && marche(a, b)) { vu.add(a + ',' + b); f.push([a, b]); } } }
  ok(Object.values(P.pnj).every(([[x, y]]) => N4.some(([dx, dy]) => vu.has((x + dx) + ',' + (y + dy)))) && P.dalles.every((c) => vu.has(c + '')), 'portes ouvertes, chaque adversaire et chaque dalle s\'atteint');
  // portes fermées : on ne dépasse pas l'entrée
  const vu2 = new Set([P.depart + '']), f2 = [P.depart];
  while (f2.length) { const [x, y] = f2.pop(); for (const [dx, dy] of N4) { const a = x + dx, b = y + dy; if (!vu2.has(a + ',' + b) && walkable(m.get(a, b))) { vu2.add(a + ',' + b); f2.push([a, b]); } } }
  ok(!Object.entries(P.pnj).some(([k, [[x, y]]]) => k !== 'g' && N4.some(([dx, dy]) => vu2.has((x + dx) + ',' + (y + dy)))), 'portes fermées, aucun esprit ne s\'atteint depuis l\'entrée');
}

// une descente entière, à deux joueurs, puis une seconde
{
  const d = CRYPTE, e = nouvelEtat(d), A = (qui, msg, o) => appliquer(d, e, qui, msg, o);
  ok(!A('1', { a: 'prendre', pnj: 'a' }).ok, 'rien ne se combat avant que le gardien ouvre');
  ok(A('1', { a: 'ouvrir' }, { joueurs: 2, bossPv: 100 }).ok && e.salles.entree.faite, 'le gardien ouvre la crypte');
  ok(A('1', { a: 'prendre', pnj: 'a' }).ok && !A('2', { a: 'prendre', pnj: 'a' }).ok, 'un esprit ne se combat que par un joueur à la fois');
  for (const k of ['a', 'b', 'c']) { A('1', { a: 'prendre', pnj: k }); A('1', { a: 'gagne', pnj: k }); }
  ok(e.salles.s1.faite && ouverte(d, e, 's2') && !ouverte(d, e, 's3'), 'la Salle des Murmures finie ouvre l\'Ossuaire, pas la suite');
  for (const k of ['d', 'e', 'f']) { A('2', { a: 'prendre', pnj: k }); A('2', { a: 'gagne', pnj: k }); }
  A('1', { a: 'dalles', salle: 's3', n: 1, requis: 2 });
  ok(!e.salles.s3.faite, 'à deux, une seule dalle tenue ne suffit pas');
  A('1', { a: 'dalles', salle: 's3', n: 2, requis: 2 });
  ok(e.salles.s3.faite && ouverte(d, e, 'boss'), 'les deux dalles tenues ouvrent le tombeau');
  const max = e.boss.max;
  A('1', { a: 'degats', n: Math.floor(max / 2) });
  ok(!e.fini && e.boss.pv === max - Math.floor(max / 2), 'Ossarion garde les PV qu\'on ne lui a pas pris');
  A('2', { a: 'degats', n: max });
  ok(e.fini && e.vainqueurs.length === 2, 'Ossarion vaincu par les deux joueurs');
  ok(A('1', { a: 'recommencer' }).ok && !e.salles.entree.faite && !e.fini, 'la crypte se recommence');
}

// le Parvis des Miroirs et la Clairière des Trois Voies, dans deux clairières de la Route 3
for (const [id, lieu] of [['miroirs', 'Parvis des Miroirs'], ['voies', 'Clairière des Trois Voies']]) {
  const D = W.donjons?.[id];
  ok(D, `${id} : posé dans le monde`); if (!D) continue;
  const [qx, qy] = D.porte, z = W.zoneAt(qx, qy + 1), d = DONJONS.find((q) => q.id === id);
  ok(z?.name === lieu && z.route?.startsWith('r3'), `${id} : dans ${lieu}, sur la Route 3 (${z?.name}, ${z?.route})`);
  ok(W.warpAt(qx, qy)?.map === d.cartes[0], `${id} : la porte mène à la première salle`);
  const vu = W.reach(qx, qy + 1); let route = false;
  for (let y = Math.max(0, qy - 60); y < qy + 60 && !route; y++) for (let x = Math.max(0, qx - 60); x < qx + 60; x++) {
    if (!vu[y * W.w + x]) continue; const zz = W.zoneAt(x, y); if (zz && zz.route?.startsWith('r3') && zz.name.startsWith('Route')) { route = true; break; }
  }
  ok(route, `${id} : on rejoint la Route 3 depuis la porte`);
  ok(d.cartes.every((c) => world.maps[c]?.donjon), `${id} : toutes ses salles sont construites`);
}

/* ---------------- donjon des miroirs : salles séparées et casse-têtes ---------------- */
{
  const d = DONJONS.find((q) => q.id === 'miroirs'), cartes = construireSalles(d), dehors = world.maps.monde;
  for (const m of cartes) ok(world.maps[m.id], `miroirs : la salle ${m.id} est dans le monde`);
  const carte = (id) => cartes[d.salles.findIndex((s) => s.id === id)];
  const V = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const objet = (m, x, y) => Object.entries(m.donjon.plan.objets).find(([, l]) => l.some(([a, b]) => a === x && b === y))?.[0];
  // chaînage : N mène à S de la salle suivante, D ramène sous N de la précédente, la première sort dehors
  cartes.forEach((m, i) => {
    const P = m.donjon.plan, s = d.salles[i];
    ok(m.id === s.carte && m.salle === s.id, `miroirs : carte de ${s.id}`);
    if (i < cartes.length - 1) {
      passageSuivant(m, true);
      const w = m.warpAt(...P.suivante), Q = cartes[i + 1].donjon.plan;
      ok(w && w.map === cartes[i + 1].id && w.x === Q.depart[0] && w.y === Q.depart[1], `miroirs : ${s.id} mène à la salle suivante`);
      const r = cartes[i + 1].warpAt(...Q.sortie);
      ok(r && r.map === m.id && r.x === P.suivante[0] && r.y === P.suivante[1] + 1 && (walkable(m.get(r.x, r.y)) || Object.values(P.portes).flat().some(([a, b]) => a === r.x && b === r.y) || objet(m, r.x, r.y) === s.porteObjet), `miroirs : on revient de ${d.salles[i + 1].id} devant la sortie de ${s.id}`);
    }
  });
  { const q = world.maps[cartes[0].id]; ok(q.warpAt(...q.donjon.plan.sortie)?.map === 'monde', 'miroirs : dans le monde, la première salle sort sur la Route 3'); }
  // salle 1 : le passage est muré tant que l'énigme n'est pas résolue, et le bon miroir est à gauche
  {
    const m = construireSalles(d)[d.salles.findIndex((s) => s.id === 's1')], P = m.donjon.plan;
    const vu = m.reach(...P.depart);
    ok(!vu[P.suivante[1] * m.w + P.suivante[0]] && m.get(...P.suivante) === T.CAVEWALL, 'miroirs : salle 1, le passage reste muré');
    const xs = ['A', 'B', 'C'].map((c) => P.objets[c][0][0]);
    ok(d.objets.A.juste && xs[0] < xs[1] && xs[1] < xs[2] && !d.objets.B.juste && !d.objets.C.juste, 'miroirs : le bon miroir est celui de gauche');
    ok(P.objets.A[0][0] === P.suivante[0] && P.objets.A[0][1] === P.suivante[1] + 1, 'miroirs : le passage est derrière le bon miroir');
    const [px, py] = P.objets.P[0], xs2 = P.sol.map(([x]) => x), ys2 = P.sol.map(([, y]) => y);
    ok(Math.abs(px - (Math.min(...xs2) + Math.max(...xs2)) / 2) <= 1 && py > P.objets.A[0][1] + 1 && py < P.depart[1] - 1, 'miroirs : le panneau est au centre de la salle');
    ouvrir(m, ...P.objets.A[0]); passageSuivant(m, true);
    ok(m.reach(...P.depart)[P.suivante[1] * m.w + P.suivante[0]], 'miroirs : salle 1, le bon miroir ouvre le passage');
  }
  // salle 0 : le miroir qui parle, même taille que la salle 1 ; la réponse tapée au clavier
  {
    const C = construireSalles(d), i0 = d.salles.findIndex((s) => s.id === 's0'), m = C[i0], P = m.donjon.plan;
    const m1 = C[d.salles.findIndex((s) => s.id === 's1')];
    ok(i0 === 0 && m.w === m1.w && m.h === m1.h, `miroirs : la Salle du Secret ouvre le donjon, à la taille de la salle 1 (${m.w} × ${m.h})`);
    ok(!m.reach(...P.depart)[P.suivante[1] * m.w + P.suivante[0]], 'miroirs : salle 0, le passage reste muré');
    ok(P.objets.M[0][0] === P.suivante[0] && P.objets.M[0][1] === P.suivante[1] + 1, 'miroirs : salle 0, le passage est derrière le miroir');
    ouvrir(m, ...P.objets.M[0]); passageSuivant(m, true);
    ok(m.reach(...P.depart)[P.suivante[1] * m.w + P.suivante[0]], 'miroirs : salle 0, le miroir effacé ouvre le passage');
    const R = d.objets.M.reponses;
    for (const t of ['secret', 'Silence', 'le SILENCE !', 'C\'est un secret', 'Tes secrets', 'un sécret', 'secre', 'silense']) ok(reponseJuste(t, R), `miroirs : « ${t} » est accepté`);
    for (const t of ['miroir', 'reflet', '', 'sel', 'ombre']) ok(!reponseJuste(t, R), `miroirs : « ${t} » est refusé`);
  }
  // salle 1 bis : cinq miroirs, deux fois la taille de la salle 1 ; les indices ne désignent que le cadre noir
  {
    const C = construireSalles(d), m = C[d.salles.findIndex((s) => s.id === 's1b')], P = m.donjon.plan, m1 = C[d.salles.findIndex((s) => s.id === 's1')];
    ok(m.w >= 2 * m1.w - 3 && P.sol.length >= 2 * m1.donjon.plan.sol.length, `miroirs : la Salle des Cinq Miroirs est au moins deux fois plus grande (${m.w} × ${m.h} contre ${m1.w} × ${m1.h})`);
    const ordre = ['H', 'I', 'J', 'O', 'U'].sort((a, b) => P.objets[a][0][0] - P.objets[b][0][0]);
    const coul = ordre.map((c) => d.objets[c].decor.replace('miroir_mur_', ''));
    ok(coul.join() === 'jaune,rouge,bleu,noir,vert', `miroirs : cadres de gauche à droite (${coul.join(', ')})`);
    const bons = coul.map((c, i) => i > 0 && i < 4 && coul[i - 1] !== 'rouge' && coul[i + 1] !== 'rouge' && !['rouge', 'jaune'].includes(c));
    ok(bons.filter(Boolean).length === 1 && d.objets[ordre[bons.indexOf(true)]].juste, 'miroirs : les trois indices ne laissent qu\'un miroir, le bon');
    ok(['H', 'I', 'J', 'O', 'U'].filter((c) => d.objets[c].juste).length === 1, 'miroirs : un seul bon miroir');
    const [ox, oy] = P.objets.O[0];
    ok(ox === P.suivante[0] && oy === P.suivante[1] + 1, 'miroirs : salle 1 bis, le passage est derrière le cadre noir');
    ok(!m.reach(...P.depart)[P.suivante[1] * m.w + P.suivante[0]], 'miroirs : salle 1 bis, le passage reste muré');
    ouvrir(m, ox, oy); passageSuivant(m, true);
    ok(m.reach(...P.depart)[P.suivante[1] * m.w + P.suivante[0]], 'miroirs : salle 1 bis, le bon miroir ouvre le passage');
  }
  // salles de glace : grandes, la sortie et chaque objet accessibles quels que soient ceux déjà pris, jamais coincé
  for (const [id, lettres, mini] of [['s2', ['p', 'q'], 8]]) {
    const m = carte(id), P = m.donjon.plan, N = P.suivante, S = P.depart;
    ok(P.sol.length >= 4 * 250, `miroirs : ${id} est une grande salle (${P.sol.length} cases)`);
    const cases = lettres.flatMap((c) => P.objets[c]), fixes = (P.objets.R || []);
    let bon = true, coince = 0, sortieMin = Infinity, objMin = Infinity;
    for (let mask = 0; mask < 1 << cases.length; mask++) {
      const pris = new Set(cases.filter((_, i) => mask >> i & 1).map(([x, y]) => cle(x, y)));
      const objets = new Set([...cases, ...fixes].map(([x, y]) => cle(x, y)));
      const libre = (x, y) => m.in(x, y) && (pris.has(cle(x, y)) || (walkable(m.get(x, y)) && !objets.has(cle(x, y))) || (x === N[0] && y === N[1]));
      const vu = explorerGlace(m.glace, libre, ...S);
      if (!vu.has(cle(...N))) bon = false; else if (mask === 0) sortieMin = vu.get(cle(...N));
      for (const [x, y] of [...cases, ...fixes]) {
        if (pris.has(cle(x, y))) continue;
        const ds = V.map(([dx, dy]) => vu.get(cle(x + dx, y + dy))).filter((v) => v != null);
        if (!ds.length) bon = false; else if (mask === 0) objMin = Math.min(objMin, ...ds);
      }
      for (const k of [...vu.keys(), cle(N[0], N[1] + 1)]) { if (k === cle(...N)) continue; const [x, y] = k.split(',').map(Number); if (!explorerGlace(m.glace, libre, x, y).has(cle(...S))) coince++; }
      if (!bon) break;
    }
    ok(bon, `miroirs : ${id}, la sortie et chaque objet sont accessibles en glissant`);
    ok(coince === 0, `miroirs : ${id}, on ne reste jamais coincé sur la glace (${coince})`);
    ok(sortieMin >= 15 && objMin >= mini, `miroirs : ${id}, assez difficile (sortie en ${sortieMin} glissades, objet le plus proche en ${objMin})`);
  }
  // PC d'aide de la Galerie : à l'entrée, la salle simplifiée reste sans piège et devient plus courte
  {
    const m = carte('s2'), P = m.donjon.plan, S2 = d.salles.find((s) => s.id === 's2'), [pcx, pcy] = P.objets.c[0];
    ok(Math.abs(pcx - P.depart[0]) <= 2 && Math.abs(pcy - P.depart[1]) <= 1 && walkable(m.get(pcx, pcy - 1)), 'miroirs : le PC est à l\'entrée de la Galerie');
    const cases = ['p', 'q'].flatMap((c) => P.objets[c]), reels = P.objets.p;
    const mesure = (glace, bloc) => {
      let pire = 0, coince = 0, sortie = 0;
      for (let mask = 0; mask < 1 << cases.length; mask++) {
        const pris = new Set(cases.filter((_, i) => mask >> i & 1).map(([x, y]) => cle(x, y)));
        const objets = new Set(cases.map(([x, y]) => cle(x, y)));
        const libre = (x, y) => m.in(x, y) && !bloc.has(cle(x, y)) && (pris.has(cle(x, y)) || (walkable(m.get(x, y)) && !objets.has(cle(x, y))));
        const vu = explorerGlace(glace, libre, ...P.depart);
        if (!vu.has(cle(...P.suivante))) return null;
        if (mask === 0) { sortie = vu.get(cle(...P.suivante)); for (const [x, y] of reels) pire = Math.max(pire, Math.min(...[[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => vu.get(cle(x + dx, y + dy)) ?? Infinity))); }
        for (const k of vu.keys()) { if (k === cle(...P.suivante)) continue; const [x, y] = k.split(',').map(Number); if (!explorerGlace(glace, libre, x, y).has(cle(...P.depart))) coince++; }
      }
      return { pire, coince, sortie };
    };
    const avant = mesure(m.glace, new Set()), glace = new Set(m.glace), bloc = new Set();
    for (const [x, y, c] of S2.aide.simplifier) { glace.delete(cle(x + 1, y + 1)); if (c === 'X') bloc.add(cle(x + 1, y + 1)); }
    const apres = mesure(glace, bloc);
    ok(apres && apres.coince === 0, 'miroirs : Galerie simplifiée, on ne reste jamais coincé');
    ok(apres && apres.sortie < avant.sortie && apres.pire < avant.pire, `miroirs : Galerie simplifiée plus courte (sortie ${avant.sortie} → ${apres?.sortie}, miroir le plus loin ${avant.pire} → ${apres?.pire})`);
    const buts = new Set(reels.flatMap(([x, y]) => [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => cle(x + dx, y + dy))));
    const ch = cheminGlace(m.glace, (x, y) => m.in(x, y) && walkable(m.get(x, y)), pcx, pcy - 1, buts);
    ok(ch && ch.length > 1, `miroirs : l'indice du PC trouve un chemin vers un miroir de poche (${ch ? ch.length - 1 : 0} glissades)`);
  }
  // salle du brasier : rien d'éclairé au départ ; une seule solution, avec les 3 miroirs de poche et au moins 4 miroirs tournés
  {
    const m = carte('s4'), P = m.donjon.plan;
    const [bx, by] = P.objets.F[0], cibles = new Set(P.objets.L.map(([x, y]) => cle(x, y))), socles = P.objets.o;
    const bloque = (x, y) => m.get(x, y) === T.CAVEWALL || (m.get(x, y) === T.BLOCK && objet(m, x, y) !== 'o');
    const fixes = [...(P.objets.f || []).map((c) => [c, '/']), ...(P.objets.g || []).map((c) => [c, '\\'])];
    const essai = (mm) => [[-1, 0], [1, 0]].map(([dx, dy]) => faisceau(bx, by, dx, dy, mm, bloque, cibles).touche);
    const t0 = essai(new Map(fixes.map(([[x, y], o]) => [cle(x, y), o])));
    ok(!t0[0] && !t0[1], 'miroirs : au départ, la lumière n\'éclaire aucun soleil');
    const poche = P.objets.p ? P.objets.p.length : 3;
    let n = 0, moins = 0, tours = 0;
    const pose = [];
    const parSocle = (i) => {
      if (i === socles.length) {
        for (let f = 0; f < 1 << fixes.length; f++) {
          const mm = new Map(fixes.map(([[x, y]], j) => [cle(x, y), (f >> j) & 1 ? '\\' : '/']));
          for (const [[x, y], o] of pose) mm.set(cle(x, y), o);
          const t = essai(mm);
          if (t[0] && t[1] && t[0] !== t[1]) { n++; if (pose.length < 3) moins++; tours = fixes.filter(([[x, y], o], j) => ((f >> j) & 1 ? '\\' : '/') !== o).length; }
        }
        return;
      }
      parSocle(i + 1);
      if (pose.length < 3) for (const o of ['/', '\\']) { pose.push([socles[i], o]); parSocle(i + 1); pose.pop(); }
    };
    parSocle(0);
    ok(n >= 1 && moins === 0, `miroirs : la lumière a une solution, avec les 3 miroirs de poche (${n} réglages, ${moins} avec moins)`);
    ok(tours >= 4 || n > 1, `miroirs : il faut tourner plusieurs miroirs (${tours})`);
    // tout ce qu'on manipule est à portée
    const vu = m.reach(...P.depart);
    for (const [x, y] of [...socles, ...fixes.map(([c]) => c), P.objets.F[0]]) ok(V.some(([dx, dy]) => vu[(y + dy) * m.w + x + dx]), `miroirs : on atteint l'objet en ${x},${y}`);
  }
  // salle du reflet : Copycat est rejoignable, mais pas en quelques pas
  {
    const m = carte('s5'), P = m.donjon.plan, S5 = d.salles.find((s) => s.type === 'reflet'), L = S5.ligne + 1;
    const libre5 = (x, y) => m.in(x, y) && walkable(m.get(x, y)) && m.get(x, y) !== T.CAVEDOOR;
    const r = resoudreReflet(P.depart, P.objets.K[0], (x, y) => libre5(x, y) && y >= L, (x, y) => libre5(x, y) && y <= L, 2e6);
    ok(r.n >= 40, `miroirs : on rejoint Copycat, en ${r.n} pas au mieux`);
  }
}

/* ---------------- Sanctuaire des Trois Voies ---------------- */
{
  const d = DONJONS.find((q) => q.id === 'voies'), cartes = construireSalles(d), M = Object.fromEntries(cartes.map((m) => [m.salle, m]));
  const V4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  // chaînage des salles : N mène à S de la salle suivante, les trois chemins se rejoignent dans le couloir
  const vers = (a) => M[a].donjon.versSuivante?.map;
  ok(vers('s1') === M.s2.id && !M.s2.donjon.versSuivante, 'voies : salle 1 → salle 2, pas de passage direct après la salle 2');
  ok(vers('s3s') === M.s4s.id && vers('s3f1') === M.s3f2.id && vers('s3f2') === M.s4f.id && vers('s3c') === M.s4c.id, 'voies : chaque épreuve mène à sa salle des codes');
  ok(['s4s', 's4f', 's4c'].every((k) => vers(k) === M.s5.id) && vers('s5') === M.s6.id, 'voies : les trois salles des codes mènent au couloir, puis au gardien');
  ok(!M.s3s.donjon.plan.sortie && !M.s3f1.donjon.plan.sortie && !M.s3c.donjon.plan.sortie && !M.s5.donjon.plan.sortie, 'voies : pas de demi-tour après une porte, ni depuis le couloir commun');
  ok(Object.values(d.salles.find((x) => x.id === 's2').voies).every((id) => M[id]), 'voies : chaque porte mène à une épreuve');
  // dans chaque salle, portes et passage ouverts, objets retirés : on va de S à N
  for (const m of cartes) {
    const P = m.donjon.plan;
    for (const l of Object.values(P.portes)) for (const [x, y] of l) ouvrir(m, x, y);
    for (const c of ['K', 'V', 'J', 'O', 'T', 'L']) for (const [x, y] of P.objets[c] || []) ouvrir(m, x, y);
    if (P.suivante) passageSuivant(m, true);
    const vu = m.reach(...P.depart);
    if (P.suivante) ok(vu[P.suivante[1] * m.w + P.suivante[0]], `voies : ${m.salle}, on va de l'entrée à la sortie`);
    for (const [k, [[x, y]]] of Object.entries(P.pnj)) ok(V4.some(([dx, dy]) => vu[(y + dy) * m.w + x + dx]), `voies : ${m.salle}, on peut parler à ${k}`);
  }
  // salle 1 : trois dalles, un donjon à trois
  const s1 = construireSalles(d)[0];
  ok(s1.donjon.plan.dalles.length === 3 && requisSalle(d, d.salles[0], 3, 1) === 3 && texteJoueurs(d) === 'Donjon à 3 joueurs', 'voies : trois dalles, trois joueurs');
  // les portes des voies : une par joueur
  {
    const e = nouvelEtat(d), r1 = appliquer(d, e, 'a', { a: 'voie', salle: 's2', voie: 'Z' }), r2 = appliquer(d, e, 'b', { a: 'voie', salle: 's2', voie: 'Z' }), r3 = appliquer(d, e, 'a', { a: 'voie', salle: 's2', voie: 'Y' });
    ok(r1.ok && !r2.ok && r2.why === 'prise' && !r3.ok && r3.why === 'deja', 'voies : une porte prise se ferme aux autres, et on ne prend qu\'une porte');
    ok(ouverte(d, e, 's3s') && !ouverte(d, e, 's4s') && !ouverte(d, e, 's3f2') && !ouverte(d, e, 's5'), 'voies : chaque chemin s\'ouvre de son côté');
  }
  // l'énigme des menteurs : une seule solution, et aucune phrase n'est de trop
  {
    const R = d.menteurs.regles, sols = (sauf) => { const out = []; for (let k = 0; k < 32; k++) { const v = [0, 1, 2, 3, 4].map((i) => !!(k >> i & 1)); if (R.every((f, i) => i === sauf || f(v) === v[i])) out.push(v); } return out; };
    const s = sols(-1);
    ok(s.length === 1 && s[0].every((x, i) => x === d.menteurs.sinceres.includes(i)), 'voies : l\'énigme des menteurs a une seule solution, celle du jeu');
    ok([0, 1, 2, 3, 4].every((k) => sols(k).length > 1), 'voies : sans n\'importe laquelle des phrases, l\'énigme n\'a plus une seule solution');
  }
  // Courage : la croix, ses grilles, ses interrupteurs et ses caisses
  {
    const m = construireSalles(d).find((q) => q.salle === 's3c'), P = m.donjon.plan, N = P.suivante, O = P.objets;
    const sw = (c) => d.objets[c], grilles = new Set(['J', 'O', 'T'].flatMap((c) => O[c].map(([x, y]) => cle(x, y))));
    // chaque interrupteur rouvre la grille de son bras (pour en sortir) et ouvre la suivante
    ok(sw('I').ouvre.join() === 'J' && sw('C').ouvre.join() === 'J,O' && sw('U').ouvre.join() === 'O,T', 'voies : Courage, les interrupteurs s\'enchaînent (bas → gauche → droite → haut)');
    // les caisses barrent la grille de droite ; on y arrive en les poussant
    const caisses0 = new Set(O.L.map(([x, y]) => cle(x, y)));
    const mur = (x, y) => !m.in(x, y) || m.get(x, y) === T.CAVEWALL || grilles.has(cle(x, y)) || (m.get(x, y) === T.BLOCK && !caisses0.has(cle(x, y)));
    const devantO = new Set(O.O.map(([x, y]) => cle(x - 1, y)));
    const resoudre = (pousser) => {
      const k0 = cle(...P.depart) + '|' + [...caisses0].sort().join(';'), vu = new Set([k0]), file = [[P.depart, caisses0]];
      while (file.length) {
        const [[x, y], cs] = file.shift();
        if (devantO.has(cle(x, y))) return true;
        for (const [dx, dy] of V4) {
          const nx = x + dx, ny = y + dy; if (mur(nx, ny)) continue;
          let ncs = cs;
          if (cs.has(cle(nx, ny))) { if (!pousser) continue; const bx = nx + dx, by = ny + dy; if (mur(bx, by) || cs.has(cle(bx, by))) continue; ncs = new Set(cs); ncs.delete(cle(nx, ny)); ncs.add(cle(bx, by)); }
          const kk = cle(nx, ny) + '|' + [...ncs].sort().join(';'); if (!vu.has(kk)) { vu.add(kk); file.push([[nx, ny], ncs]); }
        }
      }
      return false;
    };
    ok(!resoudre(false) && resoudre(true), 'voies : Courage, les caisses barrent la grille de droite, on passe en les poussant');
    // temps : la course passe, la marche non (grilles ouvertes, caisses ôtées)
    for (const [x, y] of O.L) ouvrir(m, x, y);
    const dist = (a, buts) => { const D = new Map([[cle(...a), 0]]), f = [a]; while (f.length) { const [x, y] = f.shift(); for (const [dx, dy] of V4) { const k = cle(x + dx, y + dy); if (D.has(k) || (!walkable(m.get(x + dx, y + dy)) && !grilles.has(k))) continue; D.set(k, D.get(cle(x, y)) + 1); f.push([x + dx, y + dy]); } } return Math.min(...buts.map(([x, y]) => D.get(cle(x, y)) ?? Infinity)); };
    for (const [c, cible] of [['C', 'O'], ['U', 'T']]) {
      const n = dist(O[c][0], O[cible]), t = sw(c).duree;
      ok(n * 0.2 > t && n * 0.1 < t, `voies : Courage, de l'interrupteur ${c} à la grille ${cible} il faut courir (${n} cases, ${t} s)`);
    }
    ok(dist(O.I[0], O.J) * 0.2 < sw('I').duree, 'voies : Courage, la première grille se rejoint en marchant');
    ok(P.pnj.r && O['!'].length === 5 && O['!'].every(([x]) => x > O.J[0][0] && x < P.pnj.r[0][0]), 'voies : Courage, le dresseur attaque quand on passe devant lui, du bon côté de la grille');
    ok(['J', 'O', 'T'].every((c) => O[c].length === 5), 'voies : Courage, chaque grille ferme tout le couloir');
    // les caisses : un peu plus de poussées qu'avant (au moins 8)
    {
      const minPoussees = () => { const k0 = [cle(...P.depart), [...caisses0].sort().join(';')].join('|'), D = new Map([[k0, 0]]), dq = [[P.depart, caisses0, 0]];
        while (dq.length) { const [[x, y], cs, n] = dq.shift(); if (devantO.has(cle(x, y))) return n;
          for (const [dx, dy] of V4) { const nx = x + dx, ny = y + dy; if (mur(nx, ny)) continue; let ncs = cs, c = 0;
            if (cs.has(cle(nx, ny))) { const bx = nx + dx, by = ny + dy; if (mur(bx, by) || cs.has(cle(bx, by))) continue; ncs = new Set(cs); ncs.delete(cle(nx, ny)); ncs.add(cle(bx, by)); c = 1; }
            const kk = cle(nx, ny) + '|' + [...ncs].sort().join(';'); if (D.has(kk) && D.get(kk) <= n + c) continue; D.set(kk, n + c); if (c) dq.push([[nx, ny], ncs, n + c]); else dq.unshift([[nx, ny], ncs, n]); } }
        return -1; };
      const n = minPoussees(); ok(n >= 8, `voies : Courage, il faut au moins 8 poussées pour passer (${n})`);
    }
  }
  // salles des codes : grandes, dans le noir, le coffre au centre
  for (const k of ['s4s', 's4f', 's4c']) {
    const m = M[k], P = m.donjon.plan, [hx, hy] = P.objets.H[0];
    ok(m.dark === 'arene' && P.sol.length > 700 && hx === P.suivante[0] && Math.abs(hy - m.h / 2) <= 1, `voies : ${k}, grande salle dans le noir, coffre au centre`);
  }
  // codes : chaque grande porte n'a qu'une bonne combinaison parmi les quatre de son coffre
  for (let k = 0; k < 50; k++) {
    let r = k + 1; const rnd = () => { r = (r * 1664525 + 1013904223) >>> 0; return r / 4294967296; };
    const sec = d.preparer(rnd), tous = Object.values(sec.codes).flat();
    let bon = new Set(tous).size === 6 && tous.every((n) => n >= 10 && n <= 99);
    for (const v of ['s', 'f', 'c']) {
      const mot = sec.motifs[v], autres = ['s', 'f', 'c'].filter((q) => q !== v);
      bon &&= mot.length === 4 && autres.every((q) => mot.filter((x) => x === q).length === 2);
      const combos = new Set();
      for (const oa of [[0, 1], [1, 0]]) for (const ob of [[0, 1], [1, 0]]) { const vu = { [autres[0]]: 0, [autres[1]]: 0 }, o = { [autres[0]]: oa, [autres[1]]: ob }; combos.add(mot.map((q) => String(sec.codes[q][o[q][vu[q]++]])).join('')); }
      bon &&= combos.size === 4 && combos.has(sec.portes[v]);
    }
    if (!bon) { ok(false, `voies : codes de la descente ${k}`); break; }
  }
  ok(true, 'voies : codes tirés au sort, une seule bonne combinaison par porte');
  let r0 = 7; const e0 = nouvelEtat(d, { rng: () => { r0 = (r0 * 1664525 + 1013904223) >>> 0; return r0 / 4294967296; } });
  ok(e0.secret?.portes?.s?.length === 8, 'voies : l\'état d\'une descente porte ses codes');
}


/* ---------------- gardien des Trois Voies : cinq blocs, effets une seule fois, soin de deux blocs ---------------- */
{
  const d = DONJONS.find((q) => q.id === 'voies'), P = d.pnj.M, mv = (k) => Object.values(MOVES).find((m) => m.key === k).id;
  const boss = createMon(P.espece, P.niveau, { shiny: false }); boss.stats[0] *= 3; boss.hp = boss.stats[0];
  boss.moves = P.moves.map((id) => ({ id, pp: MOVES[id].pp }));
  const joueurs = ['1', '2', '3'].map((id) => ({ id, nom: 'J' + id, party: [createMon(143, 60, { shiny: false }), createMon(76, 60, { shiny: false })] }));
  const r = new Raid({ joueurs, boss: { mon: boss, nom: 'Gardien' }, blocs: P.blocs, boost: P.boost, effets: P.effets, soin: P.soinBlocs, rng: () => 0.3 });
  r.start();
  const t = r.seuils(), m0 = r.manches[0];
  const casser = (k) => { r.dans(m0, () => { m0.hp(1, -(boss.hp - t[k] + 1)); }); r.bilan(); };
  casser(4);
  ok(r.roc && [2, 3, 4, 5, 6].every((s) => m0.sides[1].v.st[s - 1] === 1), 'gardien : premier bloc brisé, toutes ses stats montent et les pièges de roc sont posés');
  casser(3);
  const ko1 = [...r.koJoueurs];
  ok(ko1.length === 1 && r.manches.filter((q) => !isFainted(q.act(0))).every((q) => q.sides[0].v.st[1] === -2 && q.sides[0].v.st[3] === -2), 'gardien : deuxième bloc, Attaques baissées de deux crans et un Pokémon mis K.O.');
  // soin : deux blocs reviennent, mais les effets ne se rejouent pas
  const avantSoin = boss.hp; r.dans(m0, () => m0.hp(1, 10));
  ok(Math.abs(boss.hp - avantSoin - 2 * boss.stats[0] / P.blocs) <= 1, 'gardien : son soin rend deux blocs');
  casser(4); casser(3);
  ok(r.koJoueurs.size === 1 && m0.sides[1].v.st[1] === 1, 'gardien : les effets des blocs ne se rejouent pas après un soin');
  casser(2); casser(1);
  ok(r.koJoueurs.size === 3, 'gardien : chaque joueur perd un Pokémon, jamais deux fois le même joueur');
  // pièges de roc : le Pokémon qui entre est blessé
  const q = r.manches.find((x) => isFainted(x.act(0))), j = r.joueur(q.pid), entre = j.party.findIndex((x) => x.hp > 0), pv = j.party[entre].hp;
  r.dans(q, () => q.doSwitch(0, entre, true));
  ok(j.party[entre].hp < pv, 'gardien : les pièges de roc blessent le Pokémon qui entre');
  // gardien de la Force : le message classique
  const b = createMon(68, 25, { shiny: false }); b.moves = [{ id: mv('splash'), pp: 40 }];
  const jj = createMon(65, 60, { shiny: false }); jj.moves = [{ id: mv('psychic'), pp: 30 }];
  const rf = new Raid({ joueurs: [{ id: '1', nom: 'Lucas', party: [jj] }], boss: { mon: b, nom: 'Gardien' }, blocs: 3, immunite: 'speciale', boost: 2, rng: () => 0.5 });
  rf.start(); const evs = rf.action('1', { type: 'move', idx: 0 });
  ok(evs.some((e) => e.t === 'msg' && /^Ça n'affecte pas/.test(e.text)) && !evs.some((e) => e.t === 'msg' && /bouclier|immunis/i.test(e.text)), 'gardien de la Force : « Ça n\'affecte pas… », sans parler d\'immunité');
}

/* ---------------- un joueur à plusieurs places (mode test, duo de Karatékas) ---------------- */
{
  let bloque = 0, fins = {}, doublon = false;
  for (let t = 0; t < 60; t++) {
    const party = [[156, 30], [159, 30], [25, 30], [17, 29], [42, 29], [75, 30]].map(([sp, l]) => createMon(sp, l, { shiny: false }));
    const reserve = [[60, 22], [72, 22], [118, 22], [129, 21], [116, 21], [54, 22]].map(([sp, l]) => createMon(sp, l, { shiny: false }));
    const G = new Groupe({ joueurs: [{ id: '1', nom: 'Lucas', party, places: 3 }], dresseur: { nom: 'Sentinelle' }, reserve, places: 3, rng: Math.random });
    G.start();
    let n = 0;
    while (G.state !== 'over' && n++ < 300) {
      const actives = G.joueurs.filter((j) => j.etat !== 'dehors').map((j) => G.manche(j.id).sides[0].active);
      if (new Set(actives).size !== actives.length) doublon = true;
      const att = G.attendus(); if (!att.length) break;
      G.action('1', { type: 'multi', actions: G.joueurs.map((j) => (G.state === 'switch' ? { type: 'switch', idx: 0 } : { type: 'move', idx: Math.floor(Math.random() * 4), cible: Math.floor(Math.random() * 3) })) });
    }
    if (G.state !== 'over') bloque++;
    fins[G.result] = (fins[G.result] || 0) + 1;
  }
  ok(!bloque && !doublon, `seul à trois places : les combats finissent, jamais deux fois le même Pokémon en jeu (${bloque} bloqués)`);
  ok(fins.win > 0, `seul à trois places : on peut gagner (${JSON.stringify(fins)})`);
}

/* ---------------- combat de groupe (couples de la Pyramide, sentinelles des Trois Voies) ---------------- */
{
  let fins = {}, bloque = 0, envoisOk = true;
  for (let t = 0; t < 120; t++) {
    const n = t % 2 ? 2 : 3;
    const joueurs = Array.from({ length: n }, (_, i) => ({ id: String(i + 1), nom: 'J' + i, party: [createMon(6, 30), createMon(9, 30), createMon(3, 30)] }));
    const reserve = Array.from({ length: n === 2 ? 4 : 9 }, (_, i) => createMon([16, 19, 41, 66, 74, 92, 95, 129, 52][i % 9], 30));
    const G = new Groupe({ joueurs, dresseur: { cls: 'Duo', nom: 'Lise et Léo' }, reserve, rng: Math.random });
    const evs = G.start();
    envoisOk &&= evs.filter((e) => e.t === 'send' && e.side === 1).length === n && G.ciblesAdverses().length === n;
    for (let k = 0; k < 400 && G.state !== 'over'; k++) for (const id of G.attendus()) G.action(id, G.state === 'switch' ? { type: 'switch', idx: -1 } : { type: 'move', idx: k % 4, cible: k % 3 });
    if (G.state !== 'over') bloque++;
    fins[G.result] = (fins[G.result] || 0) + 1;
  }
  ok(envoisOk, 'combat de groupe : autant de Pokémon adverses en jeu que de joueurs');
  ok(!bloque && fins.win > 0, `combat de groupe : les combats se terminent (${JSON.stringify(fins)})`);
  // un joueur part : les autres continuent
  const G = new Groupe({ joueurs: [{ id: '1', nom: 'A', party: [createMon(6, 40)] }, { id: '2', nom: 'B', party: [createMon(9, 40)] }], dresseur: { nom: 'Duo' }, reserve: [createMon(16, 20), createMon(19, 20)] });
  G.start(); G.action('1', { type: 'move', idx: 0, cible: 1 }); G.retirer('2', 'B part.');
  ok(G.avancer() && G.turn === 1, 'combat de groupe : le départ d\'un joueur débloque le tour');
}


console.log(echecs ? `${echecs} échec(s) sur ${n} vérifications` : `Donjons d'Odyssée : ${n} vérifications, tout est bon.`);
process.exit(echecs ? 1 : 0);
