// tools/test-odyssee-donjons.mjs — les donjons à plusieurs d'Odyssée (odyssee/js/donjons/) : la Crypte des Murmures est
// posée dans le cimetière des Ruines Oubliées de la Route 2, sa porte s'atteint depuis la route, ses salles se suivent
// porte après porte, et une descente entière (gardien, esprits, dalles, Ossarion aux PV partagés) se joue d'un bout à
// l'autre, puis se recommence.
//   node tools/test-odyssee-donjons.mjs
import { buildWorld } from '../odyssee/js/world/region.js';
import { walkable } from '../odyssee/js/world/tiles.js';
import { nouvelEtat, appliquer, ouverte } from '../odyssee/js/donjons/etat.js';
import CRYPTE from '../odyssee/js/donjons/crypte.js';
import { ITEMS } from '../odyssee/js/core/items.js';

let n = 0, echecs = 0;
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

console.log(echecs ? `${echecs} échec(s) sur ${n} vérifications` : `Donjons d'Odyssée : ${n} vérifications, tout est bon.`);
process.exit(echecs ? 1 : 0);
