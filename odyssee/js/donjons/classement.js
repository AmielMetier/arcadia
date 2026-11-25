// odyssee/js/donjons/classement.js — les pancartes de classement des donjons : qui a fini le donjon, quand, en combien
// de temps. Un donjon déclare ses classements (`classements` : id, nom, et `pnj` si sa fin est la défaite de ce PNJ ;
// sinon la fin du donjon) et ses pancartes (`pancartesClassement` : classement, salle, côté du mur).
// Les résultats sont gardés dans ce navigateur pour l'instant ; le jour où le serveur relais les gardera pour tous,
// seul `STOCKAGE` change (ses fonctions sont déjà asynchrones).
import { T, walkable } from '../world/tiles.js';
import { regionDe } from './plan.js';
import { battu } from './etat.js';

const CLE = 'testodyssee:classements:v1', GARDE = 100;
const lireTout = () => { try { return JSON.parse(localStorage.getItem(CLE) || '{}') || {}; } catch { return {}; } };

/** le stockage des résultats : ici le navigateur */
export const STOCKAGE = {
  async lire(id) { return lireTout()[id] || []; },
  async ajouter(id, r) {
    const tout = lireTout(), l = (tout[id] ||= []);
    l.push(r); l.sort((a, b) => a.duree - b.duree); l.length = Math.min(l.length, GARDE);
    try { localStorage.setItem(CLE, JSON.stringify(tout)); } catch { /* stockage plein ou interdit : tant pis */ }
    return l.indexOf(r) + 1;
  },
};

/** 1 h 02 min 05 s, 12 min 30 s, 45 s */
export function duree(ms) {
  const s = Math.round(ms / 1000), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return h ? `${h} h ${String(m).padStart(2, '0')} min` : m ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`;
}
export const date = (t) => new Date(t).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });

/** la case d'une pancarte : contre le mur du côté demandé, au plus près du milieu de la salle, sans boucher de passage */
export function placePancarte(m, P, salle, cote) {
  // une salle qui a sa propre carte : toute la carte
  const region = salle.carte ? P.sol : regionDe(m, P, salle); if (!region.length) return null;
  const pris = new Set([...P.decor.map(([, x, y]) => x + ',' + y), ...Object.values(P.pnj).flat().map(([x, y]) => x + ',' + y),
    ...Object.values(P.objets).flat().map(([x, y]) => x + ',' + y), P.depart.join(), ...(P.sortie ? [P.sortie.join()] : []), ...(P.suivante ? [P.suivante.join()] : [])]);
  const libre = (x, y) => walkable(m.get(x, y)) && !pris.has(x + ',' + y);
  const ys = region.map(([, y]) => y), my = (Math.min(...ys) + Math.max(...ys)) / 2;
  const dx = cote === 'droite' ? 1 : -1;
  const ok = region.filter(([x, y]) => libre(x, y) && !walkable(m.get(x + dx, y)) && libre(x - dx, y) && libre(x, y - 1) && libre(x, y + 1));
  if (!ok.length) return null;
  const xs = ok.map(([x]) => x), bord = cote === 'droite' ? Math.max(...xs) : Math.min(...xs);
  return ok.filter(([x]) => x === bord).sort((a, b) => Math.abs(a[1] - my) - Math.abs(b[1] - my))[0];
}

export const Classement = {
  /** les pancartes d'un donjon, posées sur sa carte */
  poserClassements(d, m) {
    for (const p of d.pancartesClassement || []) {
      const s = d.salles.find((q) => q.id === p.salle); if (!s) continue;
      if ((s.carte || d.carte) !== m.id) continue;
      const c = placePancarte(m, m.donjon.plan, s, p.cote); if (!c) continue;
      const [x, y] = c, C = d.classements.find((q) => q.id === p.classement);
      m.prop('sign', x, y);
      m.object(x, y, { use: () => this.montrerClassement(d, C) });
    }
  },
  /** le chrono : il part quand on entre dans le donjon (une fois par descente) ; ce qui est déjà fini ne compte pas */
  chronoDonjon(d) {
    const e = this.etats[d.id]; if (!e || !d.classements) return;
    const c = (this.chronos ||= {})[d.id];
    if (c && c.run === e.run) return;
    this.chronos[d.id] = { run: e.run, t0: Date.now(), fait: Object.fromEntries(d.classements.map((C) => [C.id, this.classementFini(d, C)])) };
  },
  classementFini(d, C) {
    const e = this.etats[d.id]; if (!e) return false;
    if (C.pnj) return battu(e, d, C.pnj);
    return !!e.fini;
  },
  /** à chaque état : un classement vient de se finir pour ce joueur → on l'inscrit */
  async verifierClassements(d) {
    if (!d.classements || !this.estDans(d)) return;
    this.chronoDonjon(d);
    const c = this.chronos[d.id], e = this.etats[d.id];
    for (const C of d.classements) {
      if (c.fait[C.id] || !this.classementFini(d, C)) continue;
      c.fait[C.id] = true;
      // le groupe : ceux qui sont dans le donjon en ce moment
      const autres = d.solo ? [] : [...(this.game.link?.others || new Map()).entries()].filter(([, o]) => this.estDans(d, o.map)).map(([id]) => String(id));
      const ids = [this.moi, ...autres.filter((q) => q !== this.moi)];
      const r = { joueurs: ids.map((q) => this.nomDe(q)), date: Date.now(), duree: Date.now() - c.t0 };
      const rang = await STOCKAGE.ajouter(`${d.id}:${C.id}`, r);
      this.taches.push(() => this.game.ui.say(`${C.nom} : terminé en ${duree(r.duree)} !${rang ? `\nTu es ${rang === 1 ? '1er' : rang + 'e'} au classement.` : ''}`));
    }
  },
  /** la pancarte : les dix meilleurs temps */
  async montrerClassement(d, C) {
    const g = this.game, ui = g.ui, l = (await STOCKAGE.lire(`${d.id}:${C.id}`)).slice(0, 10);
    const box = document.createElement('div');
    box.className = 'box classement';
    box.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:40;padding:12px 16px;min-width:320px;max-width:90vw';
    const lignes = l.map((r, i) => `<tr><td style="padding:2px 8px 2px 0;text-align:right">${i + 1}.</td><td style="padding:2px 10px 2px 0">${r.joueurs.map((n) => String(n).replace(/[<>&]/g, '')).join(', ')}</td><td style="padding:2px 10px 2px 0;opacity:.75">${date(r.date)}</td><td style="text-align:right">${duree(r.duree)}</td></tr>`).join('');
    box.innerHTML = `<div style="font-weight:600;text-align:center;margin-bottom:6px">${C.nom}</div>`
      + (l.length ? `<table style="border-collapse:collapse;font-size:14px">${lignes}</table>` : '<div style="text-align:center;opacity:.8">Personne n\'a encore fini ce donjon.</div>')
      + '<div style="text-align:center;font-size:12px;opacity:.6;margin-top:8px">Classement de cet ordinateur — A ou B pour fermer</div>';
    ui.root.appendChild(box);
    await new Promise((res) => { const pop = ui.input.push((k) => { if (k === 'a' || k === 'b') { pop(); box.remove(); res(); } }); });
  },
};
