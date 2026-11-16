// odyssee/js/world/cts.js — pose les CT dans le monde (data/cts.js : CTS_POSEES, chacune avec son rang minimal).
// Chaque CT prend la place d'une Poké Ball ordinaire déjà posée (objet du barème, donc atteignable et testé) : à un
// endroit de son rang ou juste au-dessus, jamais deux dans la même zone, en gardant l'identifiant de l'objet. Le tirage
// ne dépend que de la carte : il est le même à chaque chargement.
// Une ancienne partie qui avait déjà ramassé l'objet remplacé reçoit la CT au chargement (rattraperCT).
import { CTS, CTS_POSEES } from '../data/cts.js';
import { lignesObjets } from './bareme.js';

const hache = (t) => { let h = 2166136261; for (const c of String(t)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h; };

/** remplace des objets posés par les CT ; renvoie [[ct, carte, idObjet, avant, rang]] */
export function poserCT(maps, RG) {
  // ordre fixe (carte, identifiant) : le résultat ne dépend pas de l'ordre de construction
  const lignes = lignesObjets(maps, RG).filter((L) => L.it.id && !/rare-candy|-stone$/.test(L.it.item))
    .sort((a, b) => (a.id + '|' + a.it.id < b.id + '|' + b.it.id ? -1 : 1));
  const prises = new Set(), zones = new Set(), out = [];
  for (const ct of CTS_POSEES) {
    const r = CTS[ct].rang;
    // d'abord à son rang ou un cran au-dessus, puis de plus en plus loin dans l'aventure
    for (let ecart = 0; ecart <= 15; ecart++) {
      const cand = lignes.filter((L) => !prises.has(L) && !zones.has(L.zone) && L.rang >= r && L.rang <= r + ecart);
      if (!cand.length) continue;
      const L = cand[hache(ct) % cand.length];
      prises.add(L); zones.add(L.zone); out.push([ct, L.id, L.it.id, L.it.item, L.rang]);
      L.it.item = ct; L.it.qty = 1;
      break;
    }
  }
  return out;
}

/** une partie qui avait ramassé, avant cette version, l'objet devenu CT reçoit la CT (renvoie celles données) */
export function rattraperCT(state, poses) {
  const donnees = [];
  for (const [ct, , id] of poses || []) {
    if (state.flags?.['I:' + id] && !state.bag[ct]) { state.bag[ct] = 1; donnees.push(ct); }
  }
  return donnees;
}
