// odyssee/js/donjons/casse-tetes.js — les casse-têtes du donjon des miroirs, sans écran (testés et résolus sous Node).
//
// Glace : un pas sur la glace fait glisser jusqu'au prochain obstacle (ou jusqu'à une case qui n'est pas glacée).
// Lumière : un faisceau avance case par case ; un miroir « / » ou « \ » le renvoie, un obstacle l'arrête.
// Reflet : un personnage refait nos pas comme dans un miroir horizontal (gauche et droite pareil, haut et bas inversés).

export const cle = (x, y) => x + ',' + y;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/**
 * glissade depuis (x, y) vers (dx, dy) ; libre(x, y) dit si la case est praticable.
 * Renvoie les cases traversées (vide : on ne bouge pas, on se tourne seulement).
 */
export function glisser(glace, libre, x, y, dx, dy) {
  const chemin = [];
  let cx = x, cy = y;
  for (let k = 0; k < 200; k++) {
    const nx = cx + dx, ny = cy + dy;
    if (!libre(nx, ny)) break;
    cx = nx; cy = ny; chemin.push([cx, cy]);
    if (!glace.has(cle(cx, cy))) break;
  }
  return chemin;
}
/** cases atteignables en glissant depuis (x, y), avec le nombre de mouvements le plus court */
export function explorerGlace(glace, libre, x, y) {
  const dist = new Map([[cle(x, y), 0]]), file = [[x, y]];
  while (file.length) {
    const [cx, cy] = file.shift(), d = dist.get(cle(cx, cy));
    for (const [dx, dy] of Object.values(DIRS)) {
      const ch = glisser(glace, libre, cx, cy, dx, dy);
      if (!ch.length) continue;
      const [ex, ey] = ch[ch.length - 1], k = cle(ex, ey);
      if (!dist.has(k)) { dist.set(k, d + 1); file.push([ex, ey]); }
    }
  }
  return dist;
}

/**
 * plus court chemin en glissant depuis (x, y) jusqu'à une case de buts (Set de cles) : les cases où l'on s'arrête,
 * départ compris, ou null si aucun but n'est atteignable
 */
export function cheminGlace(glace, libre, x, y, buts) {
  const prec = new Map([[cle(x, y), null]]), file = [[x, y]];
  while (file.length) {
    const [cx, cy] = file.shift(), k = cle(cx, cy);
    if (buts.has(k)) { const ch = []; for (let c = k; c; c = prec.get(c)) ch.unshift(c.split(',').map(Number)); return ch; }
    for (const [dx, dy] of Object.values(DIRS)) {
      const g = glisser(glace, libre, cx, cy, dx, dy);
      if (!g.length) continue;
      const [ex, ey] = g[g.length - 1], kk = cle(ex, ey);
      if (!prec.has(kk)) { prec.set(kk, k); file.push([ex, ey]); }
    }
  }
  return null;
}

/** direction après un miroir : « / » (bas-gauche vers haut-droite) ou « \ » */
export function renvoyer(o, dx, dy) { return o === '/' ? [-dy, -dx] : [dy, dx]; }
/**
 * faisceau depuis (x, y) dans la direction (dx, dy), sans compter la case de départ.
 * miroirs : Map cle → '/' | '\' ; bloque(x, y) : obstacle qui arrête la lumière ; cibles : Set de cles.
 * Renvoie { cases: [[x, y]…] (y compris les miroirs et la cible), touche: cle | null }.
 */
export function faisceau(x, y, dx, dy, miroirs, bloque, cibles) {
  const cases = [], vus = new Set();
  for (let k = 0; k < 400; k++) {
    x += dx; y += dy;
    const c = cle(x, y), etat = c + ',' + dx + ',' + dy;
    if (vus.has(etat)) break; vus.add(etat);
    if (cibles.has(c)) { cases.push([x, y]); return { cases, touche: c }; }
    const o = miroirs.get(c);
    if (o) { cases.push([x, y]); [dx, dy] = renvoyer(o, dx, dy); continue; }
    if (bloque(x, y)) break;
    cases.push([x, y]);
  }
  return { cases, touche: null };
}

/** le reflet : même direction à gauche et à droite, direction inverse en haut et en bas */
export const refleter = (d) => (d === 'up' ? 'down' : d === 'down' ? 'up' : d);
/**
 * plus court chemin pour arriver à côté du reflet ; libreJ / libreR : cases praticables du joueur et du reflet.
 * Renvoie le nombre de pas (ou -1), et la suite des directions.
 */
export function resoudreReflet(j, r, libreJ, libreR, max = 200000) {
  const k = (a, b) => a[0] + ',' + a[1] + '|' + b[0] + ',' + b[1];
  const prec = new Map([[k(j, r), null]]), file = [[j, r]];
  while (file.length && prec.size < max) {
    const [a, b] = file.shift();
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1) {
      const pas = []; let cur = k(a, b);
      while (prec.get(cur)) { const [p, d] = prec.get(cur); pas.unshift(d); cur = p; }
      return { n: pas.length, pas };
    }
    for (const [d, [dx, dy]] of Object.entries(DIRS)) {
      const na = [a[0] + dx, a[1] + dy];
      if (!libreJ(...na) || (na[0] === b[0] && na[1] === b[1])) continue;
      const [rx, ry] = DIRS[refleter(d)], nb0 = [b[0] + rx, b[1] + ry];
      const nb = libreR(...nb0) && !(nb0[0] === na[0] && nb0[1] === na[1]) ? nb0 : b;
      const kk = k(na, nb);
      if (!prec.has(kk)) { prec.set(kk, [k(a, b), d]); file.push([na, nb]); }
    }
  }
  return { n: -1, pas: [] };
}

/* ---------------- réponse tapée au clavier (énigme du miroir) ---------------- */
const PETITS_MOTS = /^((c ?est|tu es|le|la|les|l|un|une|des|du|ton|ta|tes|mon|ma|mes|son|sa|ses)\s+)+/;
/** minuscules, sans accents ni ponctuation, sans article au début ni « s » final : « C'est un Secret ! » → « secret » */
export function nettoyerReponse(t) {
  return String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(PETITS_MOTS, '').replace(/s$/, '');
}
/** une lettre en trop, en moins ou différente (ou deux lettres voisines inversées) */
function aUneLettre(a, b) {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0; while (i < a.length && a[i] === b[i]) i++;
  if (i === a.length && i === b.length) return true;
  return a.slice(i + 1) === b.slice(i + 1) || a.slice(i) === b.slice(i + 1) || a.slice(i + 1) === b.slice(i)
    || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2));
}
/** la saisie est-elle une des réponses ? Une faute de frappe passe pour les mots de 6 lettres ou plus */
export function reponseJuste(saisie, reponses) {
  const s = nettoyerReponse(saisie);
  return !!s && reponses.some((r) => s === r || (r.length >= 6 && aUneLettre(s, r)));
}
