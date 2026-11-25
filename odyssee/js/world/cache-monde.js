// odyssee/js/world/cache-monde.js — le résultat des étapes les plus lentes de la construction du monde, calculé d'avance.
//
// Certaines étapes de buildWorld ne font que changer des cases (écrans de verdure, ponts redressés, plages) et coûtent plusieurs secondes à chaque lancement, toujours pour le même résultat. memoCases(cle, W, fn) prend
// une empreinte de tout ce que l'étape peut lire (tableaux de cases et de hauteurs, zones, habitants, objets, portes,
// panneaux, décor) : si elle correspond à celle de data/monde-cache.js, on pose directement les cases changées ; sinon
// on calcule l'étape comme avant (le jeu reste juste, il est seulement plus lent) et on garde son résultat pour l'outil
// qui réécrit le fichier : node tools/odyssee-cache-monde.mjs (--check pour vérifier qu'il est à jour).
import { CACHE_MONDE } from '../data/monde-cache.js';

/** étapes recalculées faute de cache à jour (lues par l'outil et par les tests) */
export const MANQUES = [];
/** résultats tout frais des étapes recalculées : { cle: { h, d, r } } */
export const NOUVEAU = {};
/** désactive le cache (outil, comparaisons) */
export const OPTIONS = { actif: true };

/** les tableaux de cases d'une carte (t, hg, et tout autre tableau typé qu'on lui a ajouté) */
const tableaux = (W) => Object.keys(W).filter((k) => ArrayBuffer.isView(W[k]) && !(W[k] instanceof DataView)).sort();

/** FNV-1a sur 32 bits, poursuivi d'un appel à l'autre */
function fnvOctets(h, o) { for (let i = 0; i < o.length; i++) h = Math.imul(h ^ o[i], 16777619); return h >>> 0; }
function fnvTexte(h, s) { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function fnvTableau(h, a) {
  const o = new Uint8Array(a.buffer, a.byteOffset, a.byteLength), n4 = o.length >> 2;
  const m = new Uint32Array(a.buffer, a.byteOffset, ((a.byteOffset & 3) === 0) ? n4 : 0);
  if (m.length) { for (let i = 0; i < n4; i++) h = Math.imul(h ^ m[i], 16777619); return fnvOctets(h, o.subarray(n4 << 2)) >>> 0; }
  return fnvOctets(h, o);
}

/** l'empreinte de tout ce qu'une étape peut lire sur la carte (extra : ce qu'elle lit en dehors de la carte) */
export function empreinte(W, extra = null) {
  let h = 2166136261;
  for (const k of tableaux(W)) { h = fnvTexte(h, k); h = fnvTableau(h, W[k]); }
  const pos = (L) => L.map((o) => `${o.x},${o.y}`).join(';');
  h = fnvTexte(h, W.zones.map((z) => `${z.x0},${z.y0},${z.x1},${z.y1},${z.name || ''},${z.town || ''},${z.sea ? 1 : 0},${z.route ? 1 : 0},${z.trigger ? 1 : 0}`).join(';'));
  h = fnvTexte(h, W.npcs.map((n) => `${n.x},${n.y},${n.dir || ''},${n.trainer ? n.trainer.sight ?? 4 : '-'}`).join(';'));
  h = fnvTexte(h, pos(W.items));
  h = fnvTexte(h, pos(W.deco.filter((d) => d.x != null)) + '|' + W.deco.map((d) => d.k || '').join(','));
  for (const M of [W.warps, W.signs, W.objects]) h = fnvTexte(h, [...M.keys()].join(';'));
  h = fnvTexte(h, W.gates.map((g) => g.tiles.join(' ')).join(';'));
  if (extra) h = ArrayBuffer.isView(extra) ? fnvTableau(h, extra) : fnvTexte(h, JSON.stringify(extra));
  return h.toString(16).padStart(8, '0');
}

/** ce qui, en dehors des tableaux de cases, ne doit pas bouger pendant une étape mise en cache */
const tailles = (W) => [Object.keys(W).sort().join(','), W.deco.length, W.npcs.length, W.items.length, W.zones.length, W.gates.length,
  W.buildings.length, W.warps.size, W.signs.size, W.objects.size, W.under.size].join('|');

/** les cases changées, par séries de cases voisines de même valeur : écart depuis la fin de la série d'avant, longueur, valeur */
function difference(avant, apres) {
  const e = [], n = [], v = []; let p = 0;
  for (let i = 0; i < apres.length; i++) {
    if (avant[i] === apres[i]) continue;
    let j = i + 1; while (j < apres.length && avant[j] !== apres[j] && apres[j] === apres[i]) j++;
    e.push(i - p); n.push(j - i); v.push(apres[i]); p = j; i = j - 1;
  }
  return [e, n, v];
}

/** une étape qui ne change que des cases : depuis le cache si l'empreinte correspond, sinon calculée */
export function memoCases(cle, W, fn, extra = null) {
  const h = empreinte(W, extra), c = OPTIONS.actif && CACHE_MONDE[cle];
  if (c && c.h === h) {
    for (const [k, [e, n, v]] of Object.entries(c.d)) { const a = W[k]; let p = 0; for (let j = 0; j < e.length; j++) { p += e[j]; a.fill(v[j], p, p + n[j]); p += n[j]; } }
    return c.r === undefined ? undefined : JSON.parse(JSON.stringify(c.r));
  }
  const ks = tableaux(W), avant = Object.fromEntries(ks.map((k) => [k, W[k].slice()])), t0 = tailles(W);
  const r = fn();
  if (tailles(W) !== t0) throw new Error(`cache du monde : l'étape « ${cle} » change autre chose que des cases, elle ne peut pas être mise en cache`);
  const d = {};
  for (const k of ks) { const x = difference(avant[k], W[k]); if (x[0].length) d[k] = x; }
  MANQUES.push(cle);
  NOUVEAU[cle] = { h, d, r: r === undefined ? undefined : JSON.parse(JSON.stringify(r)) };
  if (OPTIONS.actif && typeof window !== 'undefined') console.warn(`[monde] étape « ${cle} » recalculée (cache périmé : node tools/odyssee-cache-monde.mjs)`);
  return r;
}
