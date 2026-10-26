// Questions de The Candidate tirées à la volée : calcul de desk, équations, formules de finance, probabilités,
// risques, macro et petits casse-tête chiffrés. Chaque modèle tire ses paramètres, calcule la bonne réponse,
// le piège (l'erreur classique, qui coûte deux vies) et l'explication.
// Un modèle rend une question au format de la banque (voir chartier-data.js) :
//   { type: 'choice', text, good, wrong: [3], trap, tip }  ou  { type: 'num', text, answer, tol, tolMode, unit, traps, tip }
// La plupart sortent tantôt en QCM, tantôt en réponse à taper. Pur et reproductible : tout vient du tirage r.

const between = (r, a, b) => a + r.int(b - a + 1);
const pick = (r, l) => l[r.int(l.length)];
const round = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const sig = (x, n = 4) => (x === 0 ? 0 : Number(x.toPrecision(n)));
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const NB = ' ';
// 12 345,6 · −3 (signe moins typographique) · pas de « −0 »
export function fr(x, d = 2) {
  const v = round(x, d);
  const s = Math.abs(v).toLocaleString('fr-FR', { maximumFractionDigits: d }).replace(/[  \s]/g, NB);
  return (v < 0 ? '−' : '') + s;
}
const sg = (x, d = 2) => (round(x, d) > 0 ? '+' : '') + fr(x, d);
// un facteur négatif entre parenthèses : 3 × (−2)
const pn = (x, d = 2) => (round(x, d) < 0 ? `(${fr(x, d)})` : fr(x, d));
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sup = (n) => String(n).split('').map((c) => SUP[c]).join('');
const unitOf = (s, unit) => (unit ? `${s}${NB}${unit}` : s);
const frac = (n, d) => { const g = gcd(n, d); return d / g === 1 ? String(n / g) : `${n / g}/${d / g}`; };
const C = (n, k) => { let x = 1; for (let j = 1; j <= k; j++) x = (x * (n - k + j)) / j; return Math.round(x); };

// Réponse chiffrée : en QCM (la bonne, le piège, deux erreurs plausibles) ou à taper avec sa tolérance
function ask(r, { text, ans, unit = '', dec = 2, tol = 0, tolMode = 'rel', trap, others = [], tip, qcm = 0.5, signed = false }) {
  if (!Number.isFinite(ans)) return null;
  const show = (x) => unitOf(signed ? sg(x, dec) : fr(x, dec), unit);
  if (r.next() < qcm && Number.isFinite(trap)) {
    const good = show(ans), seen = new Set([good]), wrong = [];
    for (const x of [trap, ...others]) {
      if (!Number.isFinite(x)) continue;
      // une erreur trop proche de la bonne réponse ne serait pas une vraie erreur
      if (x !== trap && ans !== 0 && Math.abs(x - ans) < 0.02 * Math.abs(ans)) continue;
      const s = show(x);
      if (!seen.has(s)) { seen.add(s); wrong.push(s); }
    }
    if (wrong.length >= 3 && wrong[0] === show(trap)) return { type: 'choice', text, good, wrong: wrong.slice(0, 3), trap: wrong[0], tip };
  }
  // à taper : un entier reste exact ; sinon assez de chiffres pour que l'arrondi affiché reste dans la tolérance
  const answer = !tol ? round(ans, dec) : Number.isInteger(ans) ? ans : sig(ans, tol >= 0.01 || tolMode === 'factor' ? 3 : tol >= 0.001 ? 4 : 5);
  const near = (t) => (tolMode === 'factor' && tol ? t > 0 && t >= answer / tol && t <= answer * tol : Math.abs(t - answer) <= Math.max(2 * tol * Math.abs(answer), 0.6 * 10 ** -dec));
  const traps = [trap].filter((t) => Number.isFinite(t) && !near(t)).map((t) => round(t, 6));
  return { type: 'num', text, answer, tol, tolMode, unit, traps, tip };
}
// QCM à réponses écrites (fractions, mots) : null si deux choix se confondent
function choice(text, good, trap, others, tip) {
  const wrong = [trap, ...others].filter((w, k, a) => w && w !== good && a.indexOf(w) === k).slice(0, 3);
  return wrong.length === 3 && wrong[0] === trap ? { type: 'choice', text, good, wrong, trap, tip } : null;
}

// Le registre : identifiant, rubrique (celles de la banque), tours où le modèle sort, et le générateur
export const GENS = [];
const G = (id, cat, tiers, f) => GENS.push({ id, cat, tiers, f });

/* ------------------------------------------------------------ calcul de desk */
G('pct-of', 'Calcul', [1, 2], (r, t) => {
  const p = t === 1 ? pick(r, [5, 10, 15, 20, 25, 30, 40, 60, 75]) : pick(r, [2.5, 7.5, 12.5, 35, 45, 65, 85, 120, 150]);
  const N = t === 1 ? 20 * between(r, 2, 60) : 40 * between(r, 3, 125), ans = (p * N) / 100;
  return ask(r, { text: `${fr(p, 1)} % de ${fr(N)} ?`, ans, dec: 1, trap: ans * 10, others: [ans / 10, N - ans, ans + p],
    tip: `10 % de ${fr(N)}, c'est ${fr(N / 10, 1)} ; ${fr(p, 1)} %, c'est ${fr(p / 10, 2)} fois plus : ${fr(ans, 1)}.` });
});
G('pct-move', 'Calcul', [1, 2], (r, t) => {
  const up = r.next() < 0.5, p = t === 1 ? pick(r, [5, 10, 20, 25, 50]) : pick(r, [3, 4, 6, 8, 12, 15, 18, 35]);
  const N = t === 1 ? 20 * between(r, 5, 100) : 50 * between(r, 4, 80), v = (N * p) / 100, ans = up ? N + v : N - v;
  return ask(r, { text: `${fr(N)} ${up ? 'augmenté' : 'diminué'} de ${p} % ?`, ans, dec: 1, trap: v, others: [up ? N - v : N + v, up ? N + p : N - p],
    tip: `${p} % de ${fr(N)} = ${fr(v, 1)}, puis ${fr(N)} ${up ? '+' : '−'} ${fr(v, 1)} = ${fr(ans, 1)}. Le ${fr(v, 1)} seul, c'est la variation, pas le résultat.` });
});
G('variation', 'Calcul', [1, 2], (r, t) => {
  for (let k = 0; k < 20; k++) {
    const a = pick(r, [20, 40, 50, 80, 120, 160, 200, 250, 400, 500, 800]);
    const g = pick(r, t === 1 ? [-50, -25, -20, -10, 10, 20, 25, 50, 100] : [-40, -37.5, -12.5, -60, 12.5, 37.5, 40, 75, 150]);
    const b = (a * (100 + g)) / 100;
    if (!Number.isInteger(b)) continue;
    const trap = ((b - a) / b) * 100;
    return ask(r, { text: `Un cours passe de ${fr(a)} € à ${fr(b)} €. Variation, en % ?`, ans: g, unit: '%', dec: 1, trap, others: [-g, b - a, g / 2], signed: true,
      tip: `(${fr(b)} − ${fr(a)}) / ${fr(a)} = ${sg(g, 1)} %. On divise toujours par le prix de départ ; diviser par ${fr(b)} donne ${sg(trap, 1)} %, c'est le piège.` });
  }
  return null;
});
G('recover', 'Calcul', [1, 2], (r, t) => {
  const p = pick(r, t === 1 ? [10, 20, 25, 50, 75, 80, 90] : [5, 15, 30, 35, 40, 45, 55, 60, 65, 70, 85, 95]), ans = (100 * p) / (100 - p);
  return ask(r, { text: `Une action perd ${p} %. Quelle hausse lui faut-il pour revenir à son prix de départ ?`, ans, unit: '%', dec: 1, tol: 0.01, trap: p, others: [p / 2, 100 - p, p * 1.5],
    tip: `Après −${p} %, il reste ${100 - p} % du prix : il faut le multiplier par 100/${100 - p}, soit +${fr(ans, 1)} %. Une perte se rattrape toujours plus lentement qu'elle ne se creuse.` });
});
G('chain', 'Calcul', [2, 3], (r, t) => {
  const moves = Array.from({ length: t === 3 ? 3 : 2 }, (_, k) => (k % 2 === 0 ? 1 : -1) * (r.next() < 0.5 ? 1 : -1) * pick(r, [10, 20, 25, 30, 40, 50]));
  const coefs = moves.map((m) => 1 + m / 100), prod = coefs.reduce((a, b) => a * b, 1), ans = round((prod - 1) * 100, 2), sum = moves.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - ans) < 0.05) return null;
  return ask(r, { text: `${moves.map((m) => `${m > 0 ? '+' : '−'}${Math.abs(m)} %`).join(', puis ')}. Variation totale, en % ?`, ans, unit: '%', dec: 2, trap: sum, others: [-ans, ans / 2, sum / 2], signed: true,
    tip: `On multiplie les coefficients : ${coefs.map((c) => fr(c, 2)).join(' × ')} = ${fr(prod, 4)}, soit ${sg(ans)} %. Les pourcentages successifs ne s'additionnent pas.` });
});
G('bp', 'Calcul', [2, 3], (r, t) => {
  const N = between(r, 2, 99) * 10 ** (t === 3 ? 5 : 4), k = between(r, 1, t === 3 ? 75 : 25), ans = (N / 1e4) * k;
  return ask(r, { text: `${k} point${k > 1 ? 's' : ''} de base de ${fr(N)} € ?`, ans, unit: '€', dec: 1, trap: ans * 10, others: [ans * 100, ans / 10],
    tip: `1 point de base = 0,01 % = 1/10 000. ${fr(N)} / 10 000 = ${fr(N / 1e4)}, fois ${k} : ${fr(ans)} €. Le ${fr(ans * 10)} viendrait de 0,1 % au lieu de 0,01 %.` });
});
G('rule72', 'Calcul', [2], (r) => {
  const p = pick(r, [1.5, 2, 2.4, 3, 3.6, 4, 4.5, 4.8, 6, 7.2, 8, 9, 12, 18, 24]), ans = 72 / p, trap = 100 / p;
  return ask(r, { text: `Placement à ${fr(p, 1)} % par an, intérêts composés. En combien d'années double-t-il, environ ?`, ans, unit: 'ans', dec: 1, tol: 0.05, trap, others: [ans * 2, ans / 2, p],
    tip: `Règle de 72 : 72 / ${fr(p, 1)} = ${fr(ans, 1)} ans. Le ${fr(trap, 1)} vient de 100 / ${fr(p, 1)}, en intérêts simples.` });
});
G('compound', 'Calcul', [3], (r) => {
  const N = pick(r, [100, 1000, 5000, 10000]), p = pick(r, [3, 4, 5, 6, 7, 8, 10]), n = pick(r, [3, 5, 10, 20]);
  const ans = N * (1 + p / 100) ** n, trap = N * (1 + (n * p) / 100);
  return ask(r, { text: `${fr(N)} € placés à ${p} % par an, intérêts composés, pendant ${n} ans. Valeur finale, environ ?`, ans, unit: '€', dec: 0, tol: 0.03, trap,
    others: [N * (1 + p / 100) ** (n + 2), N * (1 + p / 100) ** Math.max(1, n - 3), (N * n * p) / 100],
    tip: `${fr(N)} × ${fr(1 + p / 100, 2)}${sup(n)} ≈ ${fr(ans, 0)} €. De tête : le capital double tous les ${fr(72 / p, 1)} ans (règle de 72). Sans les intérêts composés, on trouverait ${fr(trap, 0)} € seulement.` });
});
G('ht', 'Calcul', [2], (r) => {
  const tva = pick(r, [20, 20, 10, 5.5]), ht = between(r, 4, 200) * (tva === 5.5 ? 2 : 5), ttc = round((ht * (100 + tva)) / 100, 2), trap = (ttc * (100 - tva)) / 100;
  return ask(r, { text: `Prix TTC de ${fr(ttc)} €, TVA à ${fr(tva, 1)} %. Prix hors taxes ?`, ans: ht, unit: '€', dec: 2, tol: 0.002, trap, others: [ttc - tva, (ttc * 100) / (100 - tva)],
    tip: `TTC = HT × ${fr(1 + tva / 100, 3)}, donc HT = ${fr(ttc)} / ${fr(1 + tva / 100, 3)} = ${fr(ht)} €. Retirer ${fr(tva, 1)} % du TTC (${fr(trap)} €) enlève trop.` });
});
G('pnl-list', 'Calcul', [1, 2], (r, t) => {
  const n = t === 1 ? 4 : 5, vals = Array.from({ length: n }, () => (r.next() < 0.6 ? 1 : -1) * between(r, 2, t === 1 ? 30 : 250) * (t === 1 ? 50 : 10));
  if (vals.every((v) => v > 0)) vals[1] = -vals[1];
  const ans = vals.reduce((a, b) => a + b, 0), abs = vals.reduce((a, b) => a + Math.abs(b), 0);
  return ask(r, { text: `P&L de la semaine : ${vals.map((v) => sg(v, 0)).join(' ; ')} €. Total ?`, ans, unit: '€', dec: 0, trap: abs, others: [ans + 100, ans - 100, -ans], signed: true,
    tip: `Gains ${fr(vals.filter((v) => v > 0).reduce((a, b) => a + b, 0))} €, pertes ${fr(vals.filter((v) => v < 0).reduce((a, b) => a + b, 0))} € : ${sg(ans, 0)} €. On regroupe les gains d'un côté, les pertes de l'autre.` });
});
G('avg-price', 'Calcul', [2], (r) => {
  for (let k = 0; k < 20; k++) {
    const q1 = pick(r, [100, 200, 300, 400, 500]), q2 = pick(r, [100, 200, 300, 600]), p1 = between(r, 20, 90), p2 = p1 + between(r, -12, 12);
    if (q1 === q2 || p1 === p2) continue;
    const ans = (q1 * p1 + q2 * p2) / (q1 + q2);
    if (round(ans, 2) !== ans) continue;
    return ask(r, { text: `Tu achètes ${q1} titres à ${p1} €, puis ${q2} titres à ${p2} €. Prix de revient moyen ?`, ans, unit: '€', dec: 2, tol: 0.002, trap: (p1 + p2) / 2, others: [p1, p2, (p1 + 2 * p2) / 3],
      tip: `(${q1} × ${p1} + ${q2} × ${p2}) / ${q1 + q2} = ${fr(q1 * p1 + q2 * p2)} / ${q1 + q2} = ${fr(ans)} €. La moyenne simple (${fr((p1 + p2) / 2)} €) oublie les quantités.` });
  }
  return null;
});
G('minutes', 'Calcul', [1], (r) => {
  const h = between(r, 7, 17), m1 = 5 * between(r, 7, 11), m2 = 5 * between(r, 1, Math.floor(m1 / 5) - 1), ans = 60 - m1 + m2, trap = (h + 1) * 100 + m2 - (h * 100 + m1);
  return ask(r, { text: `Combien de minutes entre ${h} h ${String(m1).padStart(2, '0')} et ${h + 1} h ${String(m2).padStart(2, '0')} ?`, ans, unit: 'min', dec: 0, trap, others: [ans + 10, ans - 5, 60 + m2 - m1 + 60],
    tip: `${60 - m1} minutes jusqu'à ${h + 1} h, puis ${m2} : ${ans} minutes. Soustraire ${h + 1}${String(m2).padStart(2, '0')} − ${h}${m1} comme des nombres donne ${trap}, faux : une heure fait 60 minutes, pas 100.` });
});
G('trade-pnl', 'Calcul', [1], (r) => {
  const n = pick(r, [100, 200, 250, 400, 500, 1000]), a = between(r, 20, 120) + pick(r, [0, 0.5]), b = a + pick(r, [-1, 1]) * between(r, 1, 12) / 2, ans = n * (b - a);
  return ask(r, { text: `Tu achètes ${n} titres à ${fr(a)} € et tu les revends à ${fr(b)} €. Résultat ?`, ans, unit: '€', dec: 2, trap: b - a, others: [-ans, ans * 2, ans / 2], signed: true,
    tip: `${fr(b - a)} € par titre, fois ${n} titres : ${sg(ans)} €.` });
});
// équations à paramètres finance
G('eq-rate', 'Calcul', [2, 3], (r) => {
  const [p, n] = pick(r, [[10, 2], [20, 2], [5, 2], [50, 2], [10, 3], [25, 2], [100, 2], [30, 2], [20, 3]]), K = pick(r, [100, 200, 1000, 10000]);
  const F = round(K * (1 + p / 100) ** n, 2), simple = ((F / K - 1) / n) * 100;
  return ask(r, { text: `Un capital passe de ${fr(K)} € à ${fr(F)} € en ${n} ans. Taux annuel (intérêts composés) ?`, ans: p, unit: '%', dec: 2, tol: 0.005, trap: simple, others: [(F / K - 1) * 100, p / 2, p * n],
    tip: `(1 + r)${sup(n)} = ${fr(F / K, 4)}, donc 1 + r = ${fr(1 + p / 100, 2)} et r = ${p} %. Diviser la hausse totale par ${n} (${fr(simple, 2)} %) oublie la composition.` });
});
G('eq-yield', 'Taux', [1, 2], (r) => {
  const P = pick(r, [40, 50, 60, 70, 75, 80, 85, 90, 92, 94, 95, 96, 97, 98, 99]), ans = (100 / P - 1) * 100;
  return ask(r, { text: `Un titre sans coupon se paie ${P} € et rembourse 100 € dans un an. Son rendement ?`, ans, unit: '%', dec: 2, tol: 0.01, trap: 100 - P, others: [(100 / P) * 100, (100 - P) / 2, ans * 2],
    tip: `Gain de ${100 - P} € pour ${P} € investis : ${100 - P}/${P} = ${fr(ans)} %. Le ${100 - P} % rapporte le gain au nominal, pas au prix payé.` });
});
G('eq-breakeven', 'Corporate', [2], (r) => {
  const m = pick(r, [5, 8, 10, 20, 25, 40, 50]), Q = between(r, 5, 200) * 10, v = between(r, 5, 60), p = v + m, F = m * Q;
  return ask(r, { text: `Coûts fixes de ${fr(F)} €, prix de vente ${p} €, coût variable ${v} € par unité. Combien d'unités vendre pour atteindre le point mort ?`, ans: Q, unit: 'unités', dec: 0, tol: 0.005, trap: F / p, others: [F / v, Q * 2, F / (p + v)],
    tip: `Chaque unité rapporte ${p} − ${v} = ${m} € de marge : ${fr(F)} / ${m} = ${fr(Q)} unités. Diviser par le prix (${fr(F / p, 0)}) oublie le coût variable.` });
});
G('eq-market', 'Macro', [2], (r) => {
  const ps = between(r, 2, 20), b = between(r, 1, 6), d = between(r, 1, 6), c = between(r, 1, 30), a = c + (b + d) * ps, trap = (a + c) / (b + d);
  if (trap === ps) return null;
  return ask(r, { text: `Demande : Q = ${a} − ${b}p. Offre : Q = ${c} + ${d}p. Prix d'équilibre ?`, ans: ps, unit: '€', dec: 2, trap, others: [a / (b + d), (a - c) / b, ps * 2],
    tip: `À l'équilibre, ${a} − ${b}p = ${c} + ${d}p, donc ${b + d}p = ${a - c} et p = ${ps} €.` });
});

/* ------------------------------------------------------------ taux */
G('coupon', 'Taux', [1], (r) => {
  const N = pick(r, [100, 1000, 5000, 10000, 50000, 100000]), c = pick(r, [1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7.5]), ans = (N * c) / 100;
  return ask(r, { text: `Obligation de nominal ${fr(N)} €, coupon annuel de ${fr(c, 1)} %. Montant du coupon ?`, ans, unit: '€', dec: 2, trap: ans * 10, others: [ans / 10, ans / 2, ans * 2],
    tip: `${fr(c, 1)} % × ${fr(N)} € = ${fr(ans)} € par an (${fr(ans / 2)} € tous les six mois s'il est semestriel).` });
});
G('bp-value', 'Taux', [1, 2], (r, t) => {
  const N = pick(r, [1, 2, 5, 10, 20, 25, 50, 100, 250]), k = t === 1 ? 1 : pick(r, [5, 10, 25, 50]), ans = N * 100 * k;
  return ask(r, { text: t === 1 ? `Combien vaut un point de base sur ${N} million${N > 1 ? 's' : ''} d'euros ?` : `Combien valent ${k} points de base sur ${N} M€ ?`, ans, unit: '€', dec: 0, trap: ans * 10, others: [ans / 10, ans * 100],
    tip: `1 pb = 0,01 % : ${N} 000 000 × 0,0001 = ${fr(N * 100)} €${k > 1 ? `, fois ${k} = ${fr(ans)} €` : ''}.` });
});
G('dur', 'Taux', [2], (r) => {
  const D = between(r, 2, 10), bp = pick(r, [25, 50, 75, 100, 150, 200]), up = r.next() < 0.5, ans = ((up ? -1 : 1) * D * bp) / 100;
  return ask(r, { text: `Duration modifiée de ${D}. Les taux ${up ? 'montent' : 'baissent'} de ${bp} points de base. Variation du prix, en % ?`, ans, unit: '%', dec: 2, trap: -ans, others: [((up ? -1 : 1) * bp) / 100, ans * 10, ans / 2], signed: true,
    tip: `ΔP/P ≈ − duration × Δtaux = − ${D} × (${sg((up ? 1 : -1) * bp / 100)} %) = ${sg(ans)} %. Quand les taux ${up ? 'montent, le prix baisse' : 'baissent, le prix monte'}.` });
});
G('dur-conv', 'Taux', [3], (r) => {
  const D = between(r, 4, 10), Cv = 10 * between(r, 2, 12), dy = pick(r, [1, 2, 3]), up = r.next() < 0.5, lin = (up ? -1 : 1) * D * dy, conv = (0.5 * Cv * dy * dy) / 100, ans = lin + conv;
  return ask(r, { text: `Duration modifiée ${D}, convexité ${Cv}. Les taux ${up ? 'montent' : 'baissent'} de ${dy} %. Variation du prix, en % ?`, ans, unit: '%', dec: 2, trap: lin, others: [lin - conv, lin + 2 * conv, -ans], signed: true,
    tip: `− ${D} × (${sg((up ? 1 : -1) * dy, 0)} %) + ½ × ${Cv} × (${dy} %)² = ${sg(lin, 0)} % + ${fr(conv)} % = ${sg(ans)} %. La convexité joue toujours en faveur du porteur.` });
});
G('zc', 'Taux', [2], (r) => {
  let n, p; do { n = pick(r, [2, 3, 5, 10]); p = pick(r, [1, 2, 3, 4, 5, 6, 8]); } while (n * p < 6);
  const ans = 100 / (1 + p / 100) ** n, trap = 100 - n * p;
  return ask(r, { text: `Zéro coupon ${n} ans, nominal 100 €, taux de ${p} % par an. Prix ?`, ans, unit: '€', dec: 2, tol: 0.004, trap, others: [100 * (1 + p / 100) ** n, 100 - p, ans / 2],
    tip: `100 / ${fr(1 + p / 100, 2)}${sup(n)} ≈ ${fr(ans)} €. Le ${fr(trap)} viendrait d'intérêts simples (100 − ${n} × ${p}).` });
});
G('perp', 'Taux', [2, 3], (r) => {
  const c = pick(r, [2, 3, 4, 5, 6, 8]), p = pick(r, [2, 2.5, 4, 5, 8, 10].filter((x) => x !== c)), ans = (100 * c) / p;
  return ask(r, { text: `Obligation perpétuelle de nominal 100 €, coupon de ${c} € par an. Le taux du marché est de ${fr(p, 1)} %. Prix ?`, ans, unit: '€', dec: 2, trap: 100, others: [(100 * p) / c, ans / 2, ans * 2],
    tip: `Une rente perpétuelle vaut flux / taux : ${c} / ${fr(p / 100, 3)} = ${fr(ans)} €. Elle ne cote 100 € que si son coupon égale le taux du marché.` });
});
G('fwd-rate', 'Taux', [2, 3], (r) => {
  const r1 = between(r, 1, 5), r2 = r1 + pick(r, [-1, 1, 2, 3]);
  if (r2 <= 0) return null;
  const f = ((1 + r2 / 100) ** 2 / (1 + r1 / 100) - 1) * 100;
  return ask(r, { text: `Taux zéro coupon : ${r1} % à 1 an, ${r2} % à 2 ans. Taux forward à 1 an dans 1 an ?`, ans: f, unit: '%', dec: 2, tol: 0.015, trap: (r1 + r2) / 2, others: [r2 - r1, r1 + r2, r2],
    tip: `(1 + ${r2} %)² / (1 + ${r1} %) − 1 ≈ ${fr(f)} %. De tête : 2 × ${r2} − ${r1} = ${2 * r2 - r1} %. La moyenne des deux taux est le piège.` });
});
G('current-yield', 'Taux', [2], (r) => {
  const c = between(r, 2, 8), P = pick(r, [80, 90, 95, 105, 110, 120, 125]), ans = (100 * c) / P;
  return ask(r, { text: `Coupon de ${c} € (nominal 100 €), l'obligation cote ${P} €. Rendement courant ?`, ans, unit: '%', dec: 2, tol: 0.01, trap: c, others: [(c * P) / 100, c + (100 - P) / 10, ans * 2],
    tip: `Coupon / cours = ${c} / ${P} = ${fr(ans)} %. Le ${c} % est le taux facial, rapporté au nominal et non au prix.` });
});
G('semi', 'Taux', [2], (r) => {
  const p = between(r, 2, 24) / 2, ans = ((1 + p / 200) ** 2 - 1) * 100;
  return ask(r, { text: `Un taux de ${fr(p, 1)} % payé deux fois par an (${fr(p / 2, 2)} % par semestre) équivaut à quel taux annuel ?`, ans, unit: '%', dec: 3, tol: 0.002, trap: p, others: [p / 2, 2 * p, p + 1],
    tip: `(1 + ${fr(p / 2, 2)} %)² − 1 = ${fr(ans, 3)} %. Les intérêts du premier semestre rapportent eux-mêmes au second.` });
});
G('float', 'Taux', [2], (r) => {
  const N = pick(r, [1, 2, 5, 10, 20]), e = pick(r, [1.5, 2, 2.5, 3, 3.5, 4]), days = pick(r, [90, 91, 92, 180, 181, 182]), ans = (N * 1e6 * e * days) / 100 / 360;
  return ask(r, { text: `Euribor constaté à ${fr(e, 1)} %, période de ${days} jours (base 360), nominal ${N} M€. Coupon de la période ?`, ans, unit: '€', dec: 2, tol: 0.001, trap: (N * 1e6 * e * days) / 100 / 365, others: [(N * 1e6 * e) / 100, ans * 2],
    tip: `${fr(N * 1e6)} × ${fr(e, 1)} % × ${days}/360 = ${fr(ans)} €. En base 365, on trouverait ${fr((N * 1e6 * e * days) / 100 / 365)} € : la convention compte.` });
});
G('dv01', 'Taux', [3], (r) => {
  const N = pick(r, [5, 10, 20, 50, 100]), D = between(r, 2, 10), ans = N * D * 100;
  return ask(r, { text: `Tu détiens ${N} M€ d'une obligation de duration modifiée ${D}. Sensibilité à un point de base (DV01) ?`, ans, unit: '€', dec: 0, trap: ans * 100, others: [ans / 10, ans * 10],
    tip: `${N} M€ × ${D} × 0,0001 = ${fr(ans)} € par point de base. Le ${fr(ans * 100)} correspond à 1 % de mouvement, pas 1 pb.` });
});
G('perp-gain', 'Taux', [3], (r) => {
  const c = pick(r, [20, 30, 40, 50, 60]), [r1, r2] = pick(r, [[5, 4], [4, 5], [5, 2.5], [4, 2], [8, 5], [10, 8], [2, 4]]), ans = (c * 100) / r2 - (c * 100) / r1;
  return ask(r, { text: `Rente perpétuelle de ${c} € par an. Les taux passent de ${fr(r1, 1)} % à ${fr(r2, 1)} %. Gain (ou perte) en capital ?`, ans, unit: '€', dec: 2, trap: (c * 100) / r2, others: [(c * (r1 - r2)) / 100, -ans, ans / 2], signed: true,
    tip: `Valeur = flux / taux : ${fr((c * 100) / r1)} € à ${fr(r1, 1)} %, ${fr((c * 100) / r2)} € à ${fr(r2, 1)} %. Écart : ${sg(ans)} €.` });
});
G('zc-dur', 'Taux', [1], (r) => {
  const n = between(r, 2, 30);
  return ask(r, { text: `Duration (de Macaulay) d'un zéro coupon de maturité ${n} ans ?`, ans: n, unit: 'ans', dec: 1, trap: n / 2, others: [1, n + 1, n * 2],
    tip: `Un seul flux, à l'échéance : la moyenne pondérée des dates de flux vaut ${n} ans.` });
});

/* ------------------------------------------------------------ finance d'entreprise */
G('mcap', 'Corporate', [1], (r) => {
  const n = between(r, 2, 80), p = between(r, 5, 150), ans = n * p;
  return ask(r, { text: `${n} millions d'actions à ${p} €. Capitalisation boursière ?`, ans, unit: 'M€', dec: 0, trap: ans * 10, others: [ans / 10, n + p, ans / 2],
    tip: `${n} M × ${p} € = ${fr(ans)} M€ (soit ${fr(ans / 1000, 2)} Md€).` });
});
G('div-yield', 'Corporate', [1], (r) => {
  const y = pick(r, [2, 2.5, 3, 4, 5, 6, 8]), P = between(r, 4, 40) * 5, D = (P * y) / 100;
  if (D === y) return null;
  return ask(r, { text: `Une action à ${fr(P)} € verse ${fr(D)} € de dividende par an. Rendement du dividende ?`, ans: y, unit: '%', dec: 2, trap: D, others: [P / D, y * 10, y / 2],
    tip: `${fr(D)} / ${fr(P)} = ${fr(y)} %. Le dividende en euros n'est pas un pourcentage.` });
});
G('net-margin', 'Corporate', [1], (r) => {
  const CA = 10 * between(r, 2, 90), m = pick(r, [4, 5, 8, 10, 12, 15, 20, 25]), ans = (CA * m) / 100;
  return ask(r, { text: `Chiffre d'affaires de ${fr(CA)} M€, marge nette de ${m} %. Résultat net ?`, ans, unit: 'M€', dec: 1, trap: CA - m, others: [CA / m, ans * 10, ans / 10],
    tip: `${m} % de ${fr(CA)} M€ = ${fr(ans, 1)} M€.` });
});
G('per', 'Corporate', [2], (r) => {
  const per = pick(r, [8, 10, 12, 15, 20, 25, 40, 50]), eps = between(r, 2, 20) / 2, P = per * eps;
  if (r.next() < 0.5) return ask(r, { text: `Cours de ${fr(P)} €, bénéfice par action de ${fr(eps)} €. PER ?`, ans: per, dec: 2, trap: (eps / P) * 100, others: [per / 2, per + eps, per * 2],
    tip: `PER = cours / BPA = ${fr(P)} / ${fr(eps)} = ${per}. Son inverse (${fr(100 / per)} %) est le rendement bénéficiaire.` });
  return ask(r, { text: `PER de ${per}. Rendement bénéficiaire (BPA / cours) ?`, ans: 100 / per, unit: '%', dec: 2, tol: 0.01, trap: per, others: [per / 10, 50 / per, 200 / per],
    tip: `C'est l'inverse du PER : 1 / ${per} = ${fr(100 / per)} %.` });
});
G('ev', 'Corporate', [2], (r) => {
  const cap = 10 * between(r, 10, 90), debt = 10 * between(r, 2, 40), cash = 5 * between(r, 2, 30), ans = cap + debt - cash;
  return ask(r, { text: `Capitalisation de ${cap} M€, dette financière de ${debt} M€, trésorerie de ${cash} M€. Valeur d'entreprise ?`, ans, unit: 'M€', dec: 0, trap: cap + debt + cash, others: [cap - debt + cash, cap + debt, cap - debt],
    tip: `VE = capitalisation + dette − trésorerie = ${cap} + ${debt} − ${cash} = ${ans} M€. La trésorerie se retranche : l'acheteur la récupère.` });
});
G('capm', 'Corporate', [2, 3], (r) => {
  const rf = pick(r, [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4]), b = pick(r, [0.5, 0.8, 0.9, 1.1, 1.2, 1.25, 1.5, 1.8, 2]), m = pick(r, [4, 5, 5.5, 6, 7]), ans = rf + b * m;
  return ask(r, { text: `MEDAF : taux sans risque ${fr(rf, 1)} %, bêta ${fr(b)}, prime de risque du marché ${fr(m, 1)} %. Coût des fonds propres ?`, ans, unit: '%', dec: 2, trap: b * m, others: [rf + m, b * (rf + m), rf * b + m],
    tip: `rf + β × prime = ${fr(rf, 1)} + ${fr(b)} × ${fr(m, 1)} = ${fr(ans)} %. Sans le taux sans risque, on trouve ${fr(b * m)} %.` });
});
G('kd', 'Corporate', [2], (r) => {
  const kd = between(r, 3, 10), t = pick(r, [20, 25, 30]), ans = (kd * (100 - t)) / 100;
  return ask(r, { text: `Dette à ${kd} % avant impôt, taux d'impôt sur les sociétés de ${t} %. Coût de la dette après impôt ?`, ans, unit: '%', dec: 2, trap: (kd * t) / 100, others: [kd, (kd * (100 + t)) / 100],
    tip: `Les intérêts sont déductibles : ${kd} × (1 − ${fr(t / 100, 2)}) = ${fr(ans)} %.` });
});
G('wacc', 'Corporate', [3], (r) => {
  const w = pick(r, [50, 60, 70, 75, 80]), ke = between(r, 7, 14), kd = between(r, 3, 7), t = pick(r, [20, 25, 30]);
  const ans = (w * ke + (100 - w) * kd * (1 - t / 100)) / 100, trap = (w * ke + (100 - w) * kd) / 100;
  return ask(r, { text: `Fonds propres ${w} % et dette ${100 - w} % du financement. Coût des fonds propres ${ke} %, coût de la dette ${kd} % avant impôt, impôt ${t} %. WACC ?`, ans, unit: '%', dec: 2, tol: 0.005, trap, others: [(ke + kd) / 2, ((100 - w) * ke + w * kd * (1 - t / 100)) / 100, ke],
    tip: `${fr(w / 100, 2)} × ${ke} + ${fr(1 - w / 100, 2)} × ${kd} × (1 − ${fr(t / 100, 2)}) = ${fr(ans)} %. Oublier l'économie d'impôt sur la dette donne ${fr(trap)} %.` });
});
G('npv', 'Corporate', [2], (r) => {
  const I = 50 * between(r, 2, 20), p = pick(r, [5, 8, 10, 12, 20, 25]), X = I + 5 * between(r, -10, 20), CF = round((X * (100 + p)) / 100, 2);
  return ask(r, { text: `Un projet coûte ${fr(I)} € aujourd'hui et rapporte ${fr(CF)} € dans un an. Taux d'actualisation ${p} %. VAN ?`, ans: X - I, unit: '€', dec: 2, trap: CF - I, others: [X, I - X + 10, (CF - I) / 2], signed: true,
    tip: `${fr(CF)} / ${fr(1 + p / 100, 2)} = ${fr(X)} € d'aujourd'hui, moins ${fr(I)} € : ${sg(X - I)} €. Sans actualiser, on trouverait ${sg(CF - I)} €.` });
});
G('roe', 'Corporate', [2], (r) => {
  const NI = between(r, 5, 60), E = 10 * between(r, 5, 50), A = E * between(r, 3, 12), ans = (100 * NI) / E;
  return ask(r, { text: `Résultat net de ${NI} M€, capitaux propres de ${E} M€, total du bilan de ${fr(A)} M€. ROE ?`, ans, unit: '%', dec: 2, tol: 0.01, trap: (100 * NI) / A, others: [(100 * NI) / (A - E), E / NI, ans * 2],
    tip: `ROE = résultat net / capitaux propres = ${NI} / ${E} = ${fr(ans)} %. Rapporté au total du bilan (${fr((100 * NI) / A)} %), c'est le ROA.` });
});
G('gordon', 'Corporate', [3], (r) => {
  const D = between(r, 1, 10), k = between(r, 6, 12), g = between(r, 1, Math.min(5, k - 2)), ans = (D * 100) / (k - g);
  return ask(r, { text: `Gordon-Shapiro : dividende de ${D} € attendu l'an prochain, croissance de ${g} % par an, coût des fonds propres ${k} %. Valeur de l'action ?`, ans, unit: '€', dec: 2, tol: 0.005, trap: (D * 100) / k, others: [(D * 100) / (k + g), (D * (100 + g)) / (k - g), ans * 2],
    tip: `V = D / (k − g) = ${D} / (${k} % − ${g} %) = ${fr(ans)} €. Oublier la croissance donne ${fr((D * 100) / k)} €.` });
});
G('ev-equity', 'Corporate', [3], (r) => {
  const m = between(r, 5, 14), E = 5 * between(r, 4, 40), ND = 5 * between(r, 0, Math.floor((E * 3) / 5)), ans = m * E - ND;
  if (ND === 0) return null;
  return ask(r, { text: `Multiple VE / EBITDA de ${m}x, EBITDA de ${E} M€, dette nette de ${ND} M€. Valeur des fonds propres ?`, ans, unit: 'M€', dec: 0, trap: m * E + ND, others: [m * E, m * (E - ND), ans / 2],
    tip: `VE = ${m} × ${E} = ${m * E} M€ ; fonds propres = VE − dette nette = ${m * E} − ${ND} = ${ans} M€.` });
});
G('eps-buyback', 'Corporate', [2, 3], (r) => {
  const NI = 10 * between(r, 1, 20), n = 10 * between(r, 1, 10), k = pick(r, [10, 20, 25, 50]), ans = NI / (n * (1 - k / 100));
  return ask(r, { text: `Bénéfice de ${NI} M€, ${n} millions d'actions. L'entreprise rachète et annule ${k} % de ses actions, bénéfice inchangé. Nouveau BPA ?`, ans, unit: '€', dec: 2, tol: 0.01, trap: NI / n, others: [NI / (n * (1 + k / 100)), (NI / n) * (1 - k / 100), (NI / n) * 2],
    tip: `Il reste ${fr(n * (1 - k / 100), 1)} millions d'actions : ${NI} / ${fr(n * (1 - k / 100), 1)} = ${fr(ans)} € par action, contre ${fr(NI / n)} € avant.` });
});
G('fcff', 'Corporate', [3], (r) => {
  const EBIT = 10 * between(r, 2, 20), t = pick(r, [20, 25, 30]), DA = 5 * between(r, 1, 12), capex = 5 * between(r, 1, 16), dB = 5 * between(r, -2, 6);
  const ans = (EBIT * (100 - t)) / 100 + DA - capex - dB, trap = EBIT + DA - capex - dB;
  return ask(r, { text: `EBIT de ${EBIT}, impôt de ${t} %, dotations aux amortissements de ${DA}, investissements de ${capex}, ${dB >= 0 ? `hausse du BFR de ${dB}` : `baisse du BFR de ${-dB}`} (en M€). Free cash flow pour l'entreprise (FCFF) ?`,
    ans, unit: 'M€', dec: 1, trap, others: [(EBIT * (100 - t)) / 100 - DA - capex - dB, (EBIT * (100 - t)) / 100 + DA - capex + dB, ans + capex], signed: true,
    tip: `EBIT × (1 − t) + D&A − capex − ΔBFR = ${fr((EBIT * (100 - t)) / 100, 1)} + ${DA} − ${capex} − ${fr(dB)} = ${fr(ans, 1)} M€. On paie l'impôt sur l'EBIT ; on rajoute les amortissements, qui ne sortent pas de la caisse.` });
});
G('unlever', 'Corporate', [3], (r) => {
  const bL = between(r, 8, 24) / 10, de = pick(r, [0.25, 0.5, 1, 1.5, 2]), t = pick(r, [20, 25, 30]), ans = bL / (1 + (1 - t / 100) * de);
  return ask(r, { text: `Bêta des fonds propres de ${fr(bL, 1)}, dette / fonds propres de ${fr(de)}, impôt de ${t} %. Bêta désendetté (formule de Hamada) ?`, ans, dec: 2, tol: 0.01, trap: bL / (1 + de), others: [bL * (1 + (1 - t / 100) * de), bL, bL / 2],
    tip: `βU = βL / (1 + (1 − t) × D/E) = ${fr(bL, 1)} / (1 + ${fr(1 - t / 100, 2)} × ${fr(de)}) = ${fr(ans)}. Sans l'impôt, on trouverait ${fr(bL / (1 + de))}.` });
});
G('accretion', 'Corporate', [3], (r) => {
  const REL = 'Relutive : le BPA de l\'acheteur monte', DIL = 'Dilutive : le BPA de l\'acheteur baisse', NEU = 'Neutre : le BPA ne bouge pas', SYN = 'Impossible à dire sans les synergies';
  if (r.next() < 0.5) {
    const A = between(r, 8, 30), T = between(r, 6, 35);
    if (Math.abs(A - T) < 3) return null;
    const rel = T < A;
    return choice(`Une société au PER de ${A} rachète, en payant en actions, une cible au PER de ${T}. Hors synergies, l'opération est…`, rel ? REL : DIL, rel ? DIL : REL, [NEU, SYN],
      `Payer en actions, c'est émettre des titres valorisés ${A} fois leur bénéfice pour acheter un bénéfice valorisé ${T} fois. ${rel ? 'La cible est moins chère : le BPA monte.' : 'La cible est plus chère : le BPA baisse.'}`);
  }
  const T = between(r, 6, 40), kd = between(r, 3, 9), t = pick(r, [20, 25, 30]), y = 100 / T, cost = (kd * (100 - t)) / 100;
  if (Math.abs(y - cost) < 0.5) return null;
  const rel = y > cost;
  return choice(`Rachat d'une cible au PER de ${T}, financé entièrement par dette à ${kd} % (impôt de ${t} %). Hors synergies, l'opération est…`, rel ? REL : DIL, rel ? DIL : REL, [NEU, SYN],
    `La cible rapporte 1/${T} = ${fr(y)} % de son prix ; la dette coûte ${kd} × (1 − ${fr(t / 100, 2)}) = ${fr(cost)} % après impôt. ${rel ? 'Le bénéfice acheté dépasse le coût de la dette : relutive.' : 'La dette coûte plus que le bénéfice acheté : dilutive.'}`);
});

/* ------------------------------------------------------------ marchés */
G('fx', 'Marchés', [1, 2], (r, t) => {
  if (t === 2 && r.next() < 0.5) {
    const x = pick(r, [125, 140, 150, 160]), A = pick(r, [10000, 50000, 100000, 1000000, 300000]), ans = A / x;
    return ask(r, { text: `USD/JPY = ${x}. Combien de dollars pour ${fr(A)} yens ?`, ans, unit: '$', dec: 2, tol: 0.002, trap: A * x, others: [A / 100, (A / x) * 10],
      tip: `${x} yens valent un dollar : ${fr(A)} / ${x} = ${fr(ans)} $.` });
  }
  const x = pick(r, [1.05, 1.08, 1.1, 1.12, 1.15, 1.2, 1.25]), A = pick(r, [100, 500, 1000, 2000, 5000, 10000]), toUsd = r.next() < 0.5, ans = toUsd ? A * x : A / x;
  return ask(r, { text: `EUR/USD = ${fr(x)}. Combien valent ${fr(A)} ${toUsd ? '€ en dollars' : '$ en euros'} ?`, ans, unit: toUsd ? '$' : '€', dec: 2, tol: 0.002, trap: toUsd ? A / x : A * x, others: [A, toUsd ? A * (x - 1) : A * (2 - x)],
    tip: `EUR/USD = ${fr(x)} : un euro vaut ${fr(x)} dollars. ${toUsd ? `${fr(A)} × ${fr(x)}` : `${fr(A)} / ${fr(x)}`} = ${fr(ans)} ${toUsd ? '$' : '€'}.` });
});
G('spread-bp', 'Marchés', [2], (r) => {
  const m = between(r, 10, 200), s = pick(r, [0.01, 0.02, 0.05, 0.1, 0.2]), bid = m - s / 2, ask2 = m + s / 2, ans = (s / m) * 1e4;
  return ask(r, { text: `Bid à ${fr(bid, 3)} €, ask à ${fr(ask2, 3)} €. Spread, en points de base du prix milieu ?`, ans, unit: 'pb', dec: 1, tol: 0.01, trap: ans / 2, others: [s * 100, ans * 10, ans * 2],
    tip: `(${fr(ask2, 3)} − ${fr(bid, 3)}) / ${fr(m)} = ${fr(s / m, 6)}, soit ${fr(ans, 1)} pb. Le demi-spread (${fr(ans / 2, 1)} pb), c'est le coût d'un seul sens.` });
});
G('beta', 'Marchés', [2], (r) => {
  const b = pick(r, [0.5, 0.8, 1.2, 1.5, 2]), m = pick(r, [-5, -4, -3, -2, 2, 3, 4, 5, 6, 8]), ans = b * m;
  return ask(r, { text: `Une action a un bêta de ${fr(b, 1)}. Le marché ${m > 0 ? 'monte' : 'baisse'} de ${Math.abs(m)} %. En théorie, l'action…`, ans, unit: '%', dec: 2, trap: m / b, others: [m, b + m, -ans], signed: true,
    tip: `Variation attendue = bêta × marché = ${fr(b, 1)} × (${sg(m, 0)} %) = ${sg(ans)} %.` });
});
G('sharpe', 'Marchés', [2], (r) => {
  const R = between(r, 4, 20), rf = between(r, 0, 4), s = between(r, 5, 30), ans = (R - rf) / s;
  if (rf === 0) return null;
  return ask(r, { text: `Rendement de ${R} %, volatilité de ${s} %, taux sans risque de ${rf} %. Ratio de Sharpe ?`, ans, dec: 2, tol: 0.01, trap: R / s, others: [s / (R - rf), ((R - rf) * s) / 100, ans * 2],
    tip: `(rendement − taux sans risque) / volatilité = (${R} − ${rf}) / ${s} = ${fr(ans)}. On ne rémunère que ce qui dépasse le placement sans risque.` });
});
G('vol-annual', 'Marchés', [2], (r) => {
  const sd = between(r, 2, 16) / 4, ans = sd * Math.sqrt(252);
  return ask(r, { text: `Un actif bouge d'environ ${fr(sd)} % par jour (un écart-type). Volatilité annualisée ?`, ans, unit: '%', dec: 1, tol: 0.03, trap: sd * 252, others: [sd * 12, sd * Math.sqrt(12), sd * 52],
    tip: `La volatilité croît comme la racine du temps : × √252 ≈ 16. ${fr(sd)} × 16 ≈ ${fr(sd * 16, 1)} %. Multiplier par 252 suppose que les jours s'additionnent, c'est faux.` });
});
G('vol-daily', 'Marchés', [3], (r) => {
  const s = 4 * between(r, 2, 15), ans = s / Math.sqrt(252);
  return ask(r, { text: `Volatilité annuelle de ${s} %. Mouvement quotidien typique (un écart-type), en % ?`, ans, unit: '%', dec: 2, tol: 0.03, trap: s / 252, others: [s / 12, s / 52, s / 365],
    tip: `On divise par √252 ≈ 16 : ${s} / 16 ≈ ${fr(s / 16)} %.` });
});
G('pf-vol', 'Marchés', [3], (r) => {
  const s = pick(r, [10, 20, 30, 40]), rho = pick(r, [0, 0.5, -1, -0.5]), ans = s * Math.sqrt((1 + rho) / 2);
  return ask(r, { text: `Deux actifs de volatilité ${s} % chacun, corrélation ${fr(rho, 1)}, portefeuille 50/50. Volatilité du portefeuille ?`, ans, unit: '%', dec: 2, tol: 0.01, trap: s, others: [s / 2, s * 2, s * Math.sqrt(2)],
    tip: `σ² = 0,25 σ² + 0,25 σ² + 2 × 0,25 × ${pn(rho, 1)} × σ² = ${fr((1 + rho) / 2, 2)} σ², donc σ = ${s} × ${fr(Math.sqrt((1 + rho) / 2), 3)} = ${fr(ans)} %. La moyenne des volatilités ignore la diversification.` });
});
G('div-detach', 'Marchés', [2], (r) => {
  const P = between(r, 20, 150), D = between(r, 1, 12) / 2, ans = P - D;
  return ask(r, { text: `Une action à ${P} € détache un dividende de ${fr(D)} €. À combien ouvre-t-elle, en théorie ?`, ans, unit: '€', dec: 2, trap: P, others: [P + D, P - D / 2, P - 2 * D],
    tip: `Le dividende sort de la société : le cours baisse d'autant, ${P} − ${fr(D)} = ${fr(ans)} €.` });
});
G('fx-fwd', 'Marchés', [3], (r) => {
  const S = between(r, 105, 120) / 100, rU = between(r, 1, 6), rE = between(r, 0, 5);
  if (rU === rE) return null;
  const ans = (S * (1 + rU / 100)) / (1 + rE / 100), trap = (S * (1 + rE / 100)) / (1 + rU / 100);
  return ask(r, { text: `EUR/USD au comptant à ${fr(S, 4)}. Taux à 1 an : ${rU} % sur le dollar, ${rE} % sur l'euro. Cours à terme EUR/USD à 1 an ?`, ans, dec: 4, tol: 0.0005, trap, others: [S, S * (1 + rU / 100), S * (1 - (rU - rE) / 100)],
    tip: `F = S × (1 + r$) / (1 + r€) = ${fr(S, 4)} × ${fr(1 + rU / 100, 2)} / ${fr(1 + rE / 100, 2)} ≈ ${fr(ans, 4)}. La devise au taux le plus bas (${rE < rU ? 'l\'euro' : 'le dollar'}) s'apprécie à terme : c'est le report.` });
});
G('kelly', 'Marchés', [3], (r) => {
  const p = between(r, 51, 80), b = pick(r, [1, 1, 2, 3]), ans = p - (100 - p) / b;
  if (ans <= 0) return null;
  return ask(r, { text: `Un pari gagne avec une probabilité de ${p} % et rapporte alors ${b === 1 ? 'la mise' : `${b} fois la mise`} (sinon, tu la perds). Selon Kelly, quelle part du capital miser ?`, ans, unit: '%', dec: 1, tol: 0.01, trap: p, others: [100 - p, p / 2, ans / 2],
    tip: `f = p − (1 − p) / b = ${fr(p / 100, 2)} − ${fr((100 - p) / 100, 2)} / ${b} = ${fr(ans, 1)} %. Miser ${p} % du capital, c'est confondre la probabilité et la mise optimale.` });
});
G('margin-ret', 'Marchés', [2], (r) => {
  const m = pick(r, [50, 25, 20, 10]), x = pick(r, [-10, -8, -5, -4, -2, 2, 4, 5, 8, 10]), ans = (x * 100) / m;
  return ask(r, { text: `Tu achètes des actions en n'apportant que ${m} % du montant (le reste est emprunté, sans intérêts). L'action ${x > 0 ? 'monte' : 'baisse'} de ${Math.abs(x)} %. Rendement sur ta mise ?`, ans, unit: '%', dec: 1, trap: x, others: [(x * m) / 100, -ans, ans / 2], signed: true,
    tip: `Effet de levier de 100 / ${m} = ${100 / m} : ${sg(x, 0)} % × ${100 / m} = ${sg(ans, 1)} %. Il joue dans les deux sens.` });
});
G('beta-cov', 'Marchés', [3], (r) => {
  const v = pick(r, [0.01, 0.02, 0.04, 0.05]), b = pick(r, [0.5, 0.75, 1.25, 1.5, 2]), cov = round(v * b, 4);
  return ask(r, { text: `Covariance entre l'action et le marché : ${fr(cov, 4)}. Variance du marché : ${fr(v, 2)}. Bêta ?`, ans: b, dec: 2, trap: v / cov, others: [cov / Math.sqrt(v), b * 2, cov * 100],
    tip: `β = cov / var(marché) = ${fr(cov, 4)} / ${fr(v, 2)} = ${fr(b)}.` });
});
G('short', 'Marchés', [2], (r) => {
  const n = 100 * between(r, 1, 20), a = between(r, 20, 120), b = a + between(r, -15, 15);
  if (a === b) return null;
  const ans = n * (a - b);
  return ask(r, { text: `Tu vends à découvert ${fr(n)} actions à ${a} € et tu les rachètes à ${b} €. Résultat ?`, ans, unit: '€', dec: 0, trap: -ans, others: [a - b, n * (a + b) / 10, ans * 2], signed: true,
    tip: `Vendu ${a} €, racheté ${b} € : ${sg(a - b, 0)} € par action, fois ${fr(n)} = ${sg(ans, 0)} €. À découvert, on gagne quand le cours baisse.` });
});

/* ------------------------------------------------------------ dérivés */
const OPT = (r) => (r.next() < 0.5 ? 'call' : 'put');
const cap = (s) => s[0].toUpperCase() + s.slice(1);
G('intrinsic', 'Dérivés', [1], (r) => {
  const ty = OPT(r), K = 5 * between(r, 10, 30), S = K + pick(r, [-1, 1]) * between(r, 2, 20), ans = Math.max(ty === 'call' ? S - K : K - S, 0), trap = ty === 'call' ? K - S : S - K;
  return ask(r, { text: `${cap(ty)} de strike ${K} €, action à ${S} €. Valeur intrinsèque ?`, ans, unit: '€', dec: 0, trap: trap === ans ? -trap : trap, others: [0, Math.abs(S - K) * 2, S, K],
    tip: `${ty === 'call' ? 'Un call vaut max(S − K, 0)' : 'Un put vaut max(K − S, 0)'} à l'exercice : ${ans ? `${fr(ans)} €` : `0 €, il est en dehors de la monnaie`}.` });
});
G('opt-profit', 'Dérivés', [2], (r) => {
  const ty = OPT(r), K = 10 * between(r, 4, 15), p = between(r, 1, 10), S = K + 5 * between(r, -4, 4), pay = Math.max(ty === 'call' ? S - K : K - S, 0), ans = pay - p;
  return ask(r, { text: `${cap(ty)} de strike ${K} € payé ${p} €. À l'échéance, l'action vaut ${S} €. Résultat net ?`, ans, unit: '€', dec: 0, trap: pay === ans ? -ans : pay, others: [-p, pay + p, Math.abs(S - K) - p + 1], signed: true,
    tip: `Gain à l'exercice : ${pay} € ; moins la prime de ${p} € : ${sg(ans, 0)} €.` });
});
G('breakeven', 'Dérivés', [2], (r) => {
  const ty = OPT(r), K = 10 * between(r, 4, 15), p = between(r, 1, 12), ans = ty === 'call' ? K + p : K - p;
  return ask(r, { text: `${cap(ty)} de strike ${K} € payé ${p} €. À quel cours de l'action, à l'échéance, est-on au point mort ?`, ans, unit: '€', dec: 0, trap: ty === 'call' ? K - p : K + p, others: [K, ty === 'call' ? K + 2 * p : K - 2 * p],
    tip: `Il faut récupérer la prime : ${ty === 'call' ? `${K} + ${p}` : `${K} − ${p}`} = ${ans} €.` });
});
G('parity', 'Dérivés', [3], (r) => {
  const PVK = between(r, 90, 100), P = between(r, 2, 12), Cc = between(r, 2, 15);
  if (Cc === P) return null;
  const ans = Cc - P + PVK;
  return ask(r, { text: `Parité call-put : call à ${Cc} €, put à ${P} €, strike actualisé de ${PVK} €. Cours de l'action ?`, ans, unit: '€', dec: 0, trap: P - Cc + PVK, others: [PVK, Cc + P + PVK, PVK - Cc],
    tip: `C − P = S − K actualisé, donc S = ${Cc} − ${P} + ${PVK} = ${ans} €.` });
});
G('forward', 'Dérivés', [2, 3], (r) => {
  const S = 10 * between(r, 5, 20), p = between(r, 1, 8), D = r.next() < 0.5 ? 0 : between(r, 1, 5), ans = S * (1 + p / 100) - D;
  return ask(r, { text: `Action à ${S} €, taux de ${p} % sur un an${D ? `, dividende de ${D} € versé dans l'année` : ', pas de dividende'}. Prix à terme à un an ?`, ans, unit: '€', dec: 2, trap: D ? S * (1 + p / 100) + D : S, others: [S * (1 - p / 100), S, S + p, S * (1 + p / 100) + 2 * D],
    tip: `F = S × (1 + r)${D ? ' − dividende' : ''} = ${S} × ${fr(1 + p / 100, 2)}${D ? ` − ${D}` : ''} = ${fr(ans)} €. Acheter à terme évite de financer l'achat${D ? ', mais fait perdre le dividende' : ''}.` });
});
G('delta-hedge', 'Dérivés', [2], (r) => {
  const n = between(r, 5, 50), d = between(r, 2, 8) / 10, sell = r.next() < 0.5, ans = n * 100 * d;
  return ask(r, { text: `Tu ${sell ? 'vends' : 'achètes'} ${n} calls (100 actions chacun) de delta ${fr(d, 1)}. Combien d'actions ${sell ? 'acheter' : 'vendre'} pour être delta neutre ?`, ans, unit: 'actions', dec: 0, trap: n * d, others: [n * 100, n * 100 * (1 - d), ans * 2],
    tip: `${n} × 100 × ${fr(d, 1)} = ${fr(ans)} actions. Le delta s'applique à chaque action sous-jacente, donc à la taille du contrat.` });
});
G('delta-net', 'Dérivés', [3], (r) => {
  const n = 10 * between(r, 5, 30), d = between(r, 2, 8) / 10, m = 500 * between(r, 1, 10), ans = n * 100 * d - m;
  return ask(r, { text: `Long ${n} calls (100 actions chacun, delta ${fr(d, 1)}) et short ${fr(m)} actions. Delta net, en actions ?`, ans, unit: 'actions', dec: 0, trap: n * 100 * d + m, others: [n * d - m, -ans, n * 100 - m], signed: true,
    tip: `${n} × 100 × ${fr(d, 1)} = ${fr(n * 100 * d)} actions de delta, moins ${fr(m)} vendues : ${sg(ans, 0)}.` });
});
G('gamma-pnl', 'Dérivés', [3], (r) => {
  const g = between(r, 1, 5) / 100, N = pick(r, [100, 500, 1000, 2000]), dS = between(r, 2, 10), ans = 0.5 * g * dS * dS * N;
  return ask(r, { text: `Delta neutre, gamma de ${fr(g)} par action, ${fr(N)} actions d'exposition. Le spot bouge de ${dS} €. Gain de gamma ?`, ans, unit: '€', dec: 2, trap: g * dS * dS * N, others: [0.5 * g * dS * N, g * dS * N, 0],
    tip: `½ × Γ × dS² × N = ½ × ${fr(g)} × ${dS * dS} × ${fr(N)} = ${fr(ans)} €. Long gamma, on gagne quel que soit le sens du mouvement.` });
});
const MAT = [[1 / 52, '1 semaine', '(1/52)'], [1 / 12, '1 mois', '(1/12)'], [0.25, '3 mois', '0,25'], [1, '1 an', '1'], [4, '4 ans', '4']];
G('atm-call', 'Dérivés', [2, 3], (r) => {
  const S = pick(r, [50, 80, 100, 200]), s = 5 * between(r, 2, 12), [T, lab, tl] = pick(r, MAT), ans = 0.4 * S * (s / 100) * Math.sqrt(T);
  return ask(r, { text: `Call à la monnaie ${lab}, action à ${S} €, volatilité ${s} %, taux nuls. Prix, environ ?`, ans, unit: '€', dec: 2, tol: 0.1, trap: T === 1 ? 0.8 * S * (s / 100) : 0.4 * S * (s / 100) * T, others: [0.8 * S * (s / 100) * Math.sqrt(T), S * (s / 100) * Math.sqrt(T) * 2.5, ans * 4],
    tip: `Call ATM ≈ 0,4 × S × σ × √T = 0,4 × ${S} × ${fr(s / 100, 2)} × √${tl} ≈ ${fr(ans)} €. ${T === 1 ? 'Le double, c\'est le straddle.' : 'Le prix suit la racine du temps, pas le temps.'}` });
});
G('straddle', 'Dérivés', [2, 3], (r, t) => {
  const S = pick(r, [50, 100, 200]), s = 5 * between(r, 2, 12), [T, lab, tl] = t === 3 && r.next() < 0.4 ? [1 / 252, '1 jour', '(1/252)'] : pick(r, MAT), ans = 0.8 * S * (s / 100) * Math.sqrt(T);
  return ask(r, { text: `Straddle à la monnaie ${lab}, action à ${S} €, volatilité ${s} %. Prix, environ ?`, ans, unit: '€', dec: 2, tol: 0.1, trap: ans / 2, others: [ans * 2, 0.8 * S * (s / 100) * T * (T === 1 ? 2 : 1), ans * 5],
    tip: `Straddle ATM ≈ 0,8 × S × σ × √T = 0,8 × ${S} × ${fr(s / 100, 2)} × √${tl} ≈ ${fr(ans)} €${T < 0.01 ? ' (√252 ≈ 16)' : ''}. La moitié, c'est le prix du call seul.` });
});
G('atm-ratio', 'Dérivés', [3], (r) => {
  const [a, b, k, why] = pick(r, [['1 an', '3 mois', 2, '√(12/3) = 2'], ['9 mois', '1 mois', 3, '√9 = 3'], ['4 ans', '3 mois', 4, '√16 = 4'], ['2 ans', '6 mois', 2, '√4 = 2'], ['16 mois', '1 mois', 4, '√16 = 4'], ['1 an', '1 mois', Math.sqrt(12), '√12 ≈ 3,46'],
    ['2 ans', '1 an', Math.sqrt(2), '√2 ≈ 1,41'], ['6 mois', '1 mois', Math.sqrt(6), '√6 ≈ 2,45'], ['3 ans', '4 mois', 3, '√9 = 3'], ['1 an', '1 semaine', Math.sqrt(52), '√52 ≈ 7,2'], ['3 mois', '1 an', 0.5, '√(3/12) = 0,5'], ['1 mois', '4 mois', 0.5, '√(1/4) = 0,5']]);
  return ask(r, { text: `Même action, même volatilité, taux nuls : prix d'un call à la monnaie ${a} divisé par celui d'un call à la monnaie ${b} ?`, ans: k, dec: 2, tol: 0.02, trap: k * k, others: [k / 2, k * 1.5 + 1, 1],
    tip: `Le prix à la monnaie suit σ√T : le rapport vaut ${why}, pas le rapport des durées.` });
});
G('vega-atm', 'Dérivés', [3], (r) => {
  const S = pick(r, [50, 100, 200, 400]), [T, lab, tl] = pick(r, MAT.slice(1)), ans = (0.4 * S * Math.sqrt(T)) / 100;
  return ask(r, { text: `Call à la monnaie ${lab}, action à ${S} €. Vega, en euros par point de volatilité, environ ?`, ans, unit: '€', dec: 3, tol: 0.1, trap: 0.4 * S * Math.sqrt(T), others: [(0.4 * S * T) / 100 + ans * 3, ans * 10, ans / 4],
    tip: `Vega ATM ≈ 0,4 × S × √T / 100 = 0,4 × ${S} × √${tl} / 100 ≈ ${fr(ans, 3)} € par point de vol.` });
});
G('call-spread', 'Dérivés', [3], (r) => {
  const K1 = 10 * between(r, 8, 12), w = pick(r, [5, 10, 20]), K2 = K1 + w, p1 = between(r, 3, 9), p2 = between(r, 1, p1 - 1), net = p1 - p2;
  if (net >= w) return null;
  const maxGain = r.next() < 0.6;
  return ask(r, { text: `Achat du call ${K1} à ${p1} €, vente du call ${K2} à ${p2} €. ${maxGain ? 'Gain maximal' : 'Perte maximale'} à l'échéance ?`, ans: maxGain ? w - net : net, unit: '€', dec: 0, trap: maxGain ? w : p1, others: maxGain ? [w + net, net, w - p1] : [w - net, p2, w],
    tip: `Prime nette payée : ${p1} − ${p2} = ${net} €. ${maxGain ? `Au-dessus de ${K2}, le spread paie ${w} € : gain maximal ${w} − ${net} = ${w - net} €.` : `Sous ${K1}, les deux calls ne valent rien : on perd la prime nette, ${net} €.`}` });
});
G('theta-gamma', 'Dérivés', [3], (r) => {
  const g = between(r, 1, 5) / 100, S = pick(r, [50, 100, 200]), s = 5 * between(r, 2, 8), ans = -0.5 * (s / 100) ** 2 * S * S * g;
  return ask(r, { text: `Delta neutre, taux nuls : gamma de ${fr(g)}, spot à ${S} €, volatilité ${s} %. Thêta, en euros par an (Θ ≈ −½ σ² S² Γ) ?`, ans, unit: '€', dec: 2, trap: -ans, others: [-(s / 100) * S * g, ans * 2, ans / 252], signed: true,
    tip: `−½ × ${fr((s / 100) ** 2, 4)} × ${fr(S * S)} × ${fr(g)} = ${fr(ans)} € par an. Ce que le gamma rapporte quand ça bouge, le thêta le coûte chaque jour.` });
});
G('varswap', 'Dérivés', [3], (r) => {
  const N = 5000 * between(r, 1, 20), K = between(r, 15, 30), sR = K + pick(r, [-1, 1]) * between(r, 2, 10), ans = (N * (sR * sR - K * K)) / (2 * K);
  return ask(r, { text: `Variance swap : notionnel vega de ${fr(N)} €, strike de ${K}, volatilité réalisée de ${sR}. P&L de l'acheteur, environ ?`, ans, unit: '€', dec: 0, tol: 0.02, trap: N * (sR - K), others: [-ans, (N * (sR * sR - K * K)) / K, ans / 2], signed: true,
    tip: `P&L ≈ notionnel vega × (σ² − K²) / (2K) = ${fr(N)} × (${sR * sR} − ${K * K}) / ${2 * K} = ${sg(ans, 0)} €. La variance est convexe : un écart de vol à la hausse rapporte plus qu'il ne coûte à la baisse.` });
});
G('vol-fwd', 'Dérivés', [3], (r) => {
  const T2 = pick(r, [2, 3, 4]), s1 = 5 * between(r, 3, 6), s2 = s1 + pick(r, [-2, 2, 5, 10]), v = (s2 * s2 * T2 - s1 * s1) / (T2 - 1);
  if (v <= 0) return null;
  const ans = Math.sqrt(v), trap = (s2 * T2 - s1) / (T2 - 1);
  return ask(r, { text: `Volatilité implicite de ${s1} % à 1 an et de ${s2} % à ${T2} ans. Volatilité forward entre 1 an et ${T2} ans ?`, ans, unit: '%', dec: 2, tol: 0.01, trap, others: [(s1 + s2) / 2, s2, 2 * s2 - s1 + 3],
    tip: `Ce sont les variances qui s'additionnent : σ² = (${s2}² × ${T2} − ${s1}² × 1) / ${T2 - 1} = ${fr(v, 1)}, donc σ ≈ ${fr(ans)} %.` });
});

/* ------------------------------------------------------------ probabilités */
const WAYS = (s) => 6 - Math.abs(s - 7);
G('dice-sum', 'Probas', [1, 2], (r, t) => {
  const s = t === 1 ? pick(r, [2, 3, 11, 12, 7]) : between(r, 4, 10), w = WAYS(s);
  if (r.next() < 0.4) return ask(r, { text: `On lance deux dés. Probabilité que la somme fasse ${s}, en % ?`, ans: (w * 100) / 36, unit: '%', dec: 2, tol: 0.02, trap: 100 / 11, others: [],
    tip: `${w} combinaisons sur 36 : ${frac(w, 36)} ≈ ${fr((w * 100) / 36, 1)} %. Les 11 sommes possibles ne sont pas équiprobables.` });
  return choice(`On lance deux dés. Probabilité que la somme fasse ${s} ?`, frac(w, 36), '1/11', [frac(w + 1, 36), frac(1, 6) === frac(w, 36) ? frac(1, 12) : frac(1, 6), frac(w, 18), frac(w, 12)],
    `${w} combinaison${w > 1 ? 's' : ''} sur 36 (${Array.from({ length: 6 }, (_, a) => a + 1).filter((a) => s - a >= 1 && s - a <= 6).map((a) => `${a}-${s - a}`).join(', ')}) : ${frac(w, 36)}. Les 11 sommes ne sont pas équiprobables.`);
});
G('dice-atleast', 'Probas', [2], (r) => {
  const s = between(r, 8, 12), w = [15, 10, 6, 3, 1][s - 8];
  return choice(`On lance deux dés. Probabilité que la somme fasse au moins ${s} ?`, frac(w, 36), frac(13 - s, 11), [frac(WAYS(s), 36), frac(w - 1, 36), frac(w + 1, 36), '1/2'],
    `Les combinaisons pour ${Array.from({ length: 13 - s }, (_, k) => s + k).map((x) => `${x} (${WAYS(x)})`).join(', ')} : ${w} sur 36, soit ${frac(w, 36)}. Les sommes ne sont pas équiprobables.`);
});
G('at-least', 'Probas', [2, 3], (r) => {
  if (r.next() < 0.5) {
    const n = between(r, 2, 6), ans = (1 - (5 / 6) ** n) * 100;
    return ask(r, { text: `Probabilité d'obtenir au moins un 6 en ${n} lancers de dé, en % ?`, ans, unit: '%', dec: 1, tol: 0.02, trap: (n * 100) / 6, others: [(5 / 6) ** n * 100, 100 / 6, ans / 2],
      tip: `On passe par le contraire : aucun 6 avec (5/6)${sup(n)} ≈ ${fr((5 / 6) ** n * 100, 1)} %, donc au moins un 6 : ${fr(ans, 1)} %. Additionner ${n} × 1/6 compte plusieurs fois les cas à deux 6.` });
  }
  const n = between(r, 2, 7), ans = (1 - 0.5 ** n) * 100;
  return ask(r, { text: `On lance ${n} fois une pièce. Probabilité d'avoir au moins un pile, en % ?`, ans, unit: '%', dec: 2, trap: 0.5 ** n * 100, others: [50, 100 - 50 / n, (100 * (n - 1)) / n],
    tip: `1 − (1/2)${sup(n)} = 1 − ${frac(1, 2 ** n)} = ${fr(ans)} %. ${fr(0.5 ** n * 100)} %, c'est la probabilité de n'avoir que des faces.` });
});
G('binom', 'Probas', [2], (r) => {
  const n = between(r, 3, 6), k = between(r, 1, n - 1), c = C(n, k);
  return choice(`On lance ${n} pièces. Probabilité d'obtenir exactement ${k} pile${k > 1 ? 's' : ''} ?`, frac(c, 2 ** n), frac(k, n), [frac(1, 2 ** n), frac(c, 2 ** (n + 1)), frac(c + 1, 2 ** n), '1/2'],
    `C(${n}, ${k}) = ${c} façons de placer les piles, sur 2${sup(n)} = ${2 ** n} tirages : ${frac(c, 2 ** n)}.`);
});
G('cards', 'Probas', [1], (r) => {
  const [what, n, trap] = pick(r, [['un as', 4, '1/4'], ['un cœur', 13, '1/13'], ['une figure (valet, dame ou roi)', 12, '1/4'], ['une carte rouge', 26, '1/4'], ['un as rouge', 2, '1/13'], ['le roi de pique', 1, '1/13'], ['un trèfle ou un as', 16, '17/52'], ['un roi ou une dame', 8, '1/13'],
    ['un pique', 13, '1/13'], ['un 7', 4, '1/4'], ['une carte noire', 26, '1/4'], ['une figure rouge', 6, '3/13'], ['une carte de 2 à 10', 36, '9/52'], ['un valet noir', 2, '1/13'], ['un cœur ou un pique', 26, '1/4'], ['une dame ou un cœur', 16, '17/52']]);
  return choice(`Probabilité de tirer ${what} dans un jeu de 52 cartes ?`, frac(n, 52), trap, ['1/2', '1/26', '1/52', '3/13', '1/4', '1/13', '2/13'].filter((x) => x !== frac(n, 52)),
    `${n} carte${n > 1 ? 's' : ''} favorable${n > 1 ? 's' : ''} sur 52 : ${frac(n, 52)}.${n === 16 ? ' La carte qui coche les deux cases ne se compte qu\'une fois.' : ''}`);
});
G('two-cards', 'Probas', [3], (r) => {
  const [what, a] = pick(r, [['deux as', 4], ['deux cœurs', 13], ['deux rois', 4], ['deux cartes rouges', 26], ['deux figures', 12], ['deux piques', 13], ['deux cartes noires', 26], ['deux dames', 4], ['deux as rouges', 2], ['deux figures rouges', 6]]);
  const without = frac(a * (a - 1), 52 * 51), withR = frac(a * a, 52 * 52), remise = r.next() < 0.3;
  return choice(`On tire deux cartes d'un jeu de 52, ${remise ? 'en remettant la première avant de tirer la seconde' : 'sans remise'}. Probabilité d'avoir ${what} ?`, remise ? withR : without, remise ? without : withR, [frac(a, 52), frac(2 * a, 52), frac(a, 52 * 52)],
    remise ? `${a}/52 à chaque tirage, indépendants : (${frac(a, 52)})² = ${withR}. Sans remise, ce serait ${a}/52 × ${a - 1}/51 = ${without}.` : `${a}/52 pour la première, puis ${a - 1}/51 : ${without}. Avec remise, on aurait ${withR}.`);
});
G('urn', 'Probas', [1, 3], (r, t) => {
  const red = between(r, 2, 7), blue = between(r, 2, 7), n = red + blue;
  if (t === 1) return choice(`Une urne contient ${red} boules rouges et ${blue} bleues. Probabilité de tirer une bleue ?`, frac(blue, n), frac(blue, red) === frac(blue, n) ? '1/2' : frac(blue, red), [frac(red, n), '1/2', frac(1, n)],
    `${blue} bleues sur ${n} boules : ${frac(blue, n)}. On divise par le total, pas par le nombre de rouges.`);
  const good = frac(red * (red - 1) + blue * (blue - 1), n * (n - 1)), trap = frac(red * red + blue * blue, n * n);
  return choice(`Une urne contient ${red} boules rouges et ${blue} bleues. On en tire deux, sans remise. Probabilité qu'elles soient de la même couleur ?`, good, trap, ['1/2', frac(red * (red - 1), n * (n - 1)), frac(2 * red * blue, n * (n - 1))],
    `Deux rouges : ${red}/${n} × ${red - 1}/${n - 1} ; deux bleues : ${blue}/${n} × ${blue - 1}/${n - 1}. Total : ${good}. Avec remise, on trouverait ${trap}.`);
});
G('die-ev', 'Probas', [1, 2], (r, t) => {
  if (t === 2 && r.next() < 0.5) {
    const k = between(r, 2, 6);
    return ask(r, { text: `Espérance de la somme de ${k} dés à 6 faces ?`, ans: 3.5 * k, dec: 1, trap: 3 * k, others: [6 * k, 3.5, 3.5 * k + 1],
      tip: `L'espérance s'additionne : ${k} × 3,5 = ${fr(3.5 * k, 1)}.` });
  }
  const n = pick(r, [4, 6, 8, 10, 12, 20]);
  return ask(r, { text: `Espérance du lancer d'un dé équilibré à ${n} faces (numérotées de 1 à ${n}) ?`, ans: (n + 1) / 2, dec: 1, trap: n / 2, others: [(n - 1) / 2, n, n / 2 + 1],
    tip: `(1 + 2 + … + ${n}) / ${n} = (${n} + 1) / 2 = ${fr((n + 1) / 2, 1)}.` });
});
G('geom', 'Probas', [2], (r) => {
  const [what, k] = pick(r, [['un 6 avec un dé', 6], ['pile avec une pièce', 2], ['un double avec deux dés', 6], ['un double six avec deux dés', 36], ['une somme de 7 avec deux dés', 6], ['un as (en remettant la carte à chaque fois)', 13], ['un 1 ou un 2 avec un dé', 3],
    ['une somme de 12 avec deux dés', 36], ['une somme de 11 avec deux dés', 18], ['un cœur (en remettant la carte à chaque fois)', 4], ['deux piles en lançant deux pièces ensemble', 4], ['un nombre pair avec un dé', 2], ['le roi de cœur (en remettant la carte à chaque fois)', 52], ['trois piles en lançant trois pièces ensemble', 8]]);
  return ask(r, { text: `En moyenne, combien d'essais faut-il pour obtenir ${what} ?`, ans: k, dec: 1, trap: k / 2, others: [k + 1, k * 2, k - 1],
    tip: `Loi géométrique : chaque essai réussit avec une probabilité 1/${k}, il en faut ${k} en moyenne (1/p).` });
});
G('var-scale', 'Probas', [2], (r) => {
  const v = between(r, 1, 9), a = pick(r, [2, 3, -2, -3, 4]), b = between(r, 0, 10), ans = a * a * v;
  return ask(r, { text: `Var(X) = ${v}. Combien vaut Var(${fr(a, 0)}X${b ? ` + ${b}` : ''}) ?`, ans, dec: 0, trap: Math.abs(a) * v, others: [ans + b, a * v + b, ans * 2],
    tip: `Var(aX + b) = a² Var(X) : ${a * a} × ${v} = ${ans}. Une constante ajoutée ne change pas la dispersion.` });
});
G('choose', 'Probas', [1, 2], (r, t) => {
  if (t === 1 && r.next() < 0.4) {
    const n = between(r, 4, 15);
    return ask(r, { text: `Parmi ${n} candidats, de combien de façons peut-on choisir un président et un trésorier (deux personnes différentes) ?`, ans: n * (n - 1), dec: 0, trap: (n * (n - 1)) / 2, others: [n * n, 2 * n, n],
      tip: `${n} choix pour le président, puis ${n - 1} pour le trésorier : ${n * (n - 1)}. Les rôles sont différents, donc on ne divise pas par 2.` });
  }
  if (t === 1) {
    const n = between(r, 3, 7), f = [1, 1, 2, 6, 24, 120, 720, 5040][n];
    return ask(r, { text: `De combien de façons peut-on ranger ${n} livres différents sur une étagère ?`, ans: f, dec: 0, trap: n * n, others: [n, 2 ** n, f / 2],
      tip: `${n} choix pour la première place, ${n - 1} pour la deuxième… : ${n}! = ${f}.` });
  }
  const n = between(r, 6, 12), k = between(r, 2, 4), c = C(n, k), arr = c * [1, 1, 2, 6, 24][k];
  return ask(r, { text: `Combien de comités différents de ${k} personnes peut-on former parmi ${n} ?`, ans: c, dec: 0, trap: arr, others: [n * k, n ** k, c * 2],
    tip: `C(${n}, ${k}) = ${n}!/(${k}! × ${n - k}!) = ${c}. Si l'ordre comptait (président, trésorier…), ce serait ${arr}.` });
});
G('bayes', 'Probas', [3], (r) => {
  const p = pick(r, [0.5, 1, 2, 5, 10]), s = pick(r, [90, 95, 99]), ans = (s * p) / (s * p + (100 - s) * (100 - p));
  return ask(r, { text: `Une maladie touche ${fr(p, 1)} % de la population. Un test la détecte dans ${s} % des cas et se trompe chez ${100 - s} % des personnes saines. Test positif : probabilité d'être malade, en % ?`, ans: ans * 100, unit: '%', dec: 1, tol: 0.03, trap: s, others: [p, 100 - s, (s * p) / 100],
    tip: `Sur 10 000 personnes : ${fr(p * 100, 0)} malades dont ${fr((p * s), 1)} positifs, et ${fr((100 - p) * (100 - s), 0)} faux positifs parmi les sains. ${fr(p * s, 1)} / ${fr(p * s + (100 - p) * (100 - s), 1)} ≈ ${fr(ans * 100, 1)} %. La maladie rare noie les vrais positifs.` });
});
G('indep', 'Probas', [1, 2], (r, t) => {
  const a = between(r, 1, 9) / 10, b = between(r, 1, 9) / 10;
  if (t === 1) return ask(r, { text: `Deux événements indépendants ont des probabilités ${fr(a, 1)} et ${fr(b, 1)}. Probabilité qu'ils arrivent tous les deux ?`, ans: a * b, dec: 2, trap: (a + b) / 2, others: [a + b, Math.min(a, b), 1 - a * b],
    tip: `Indépendants : on multiplie, ${fr(a, 1)} × ${fr(b, 1)} = ${fr(a * b)}.` });
  return ask(r, { text: `Deux événements indépendants ont des probabilités ${fr(a, 1)} et ${fr(b, 1)}. Probabilité qu'au moins l'un des deux arrive ?`, ans: a + b - a * b, dec: 2, trap: a + b, others: [a * b, Math.max(a, b), 1 - a * b],
    tip: `P(A ou B) = P(A) + P(B) − P(A et B) = ${fr(a, 1)} + ${fr(b, 1)} − ${fr(a * b)} = ${fr(a + b - a * b)}. Sans retirer l'intersection, on la compte deux fois.` });
});
G('game-ev', 'Probas', [2], (r) => {
  const p = pick(r, [10, 20, 25, 30, 40, 50, 60]), Gn = 10 * between(r, 1, 20), L = 5 * between(r, 1, 20), ans = (p * Gn - (100 - p) * L) / 100;
  return ask(r, { text: `Tu gagnes ${Gn} € avec une probabilité de ${p} %, sinon tu perds ${L} €. Espérance de gain ?`, ans, unit: '€', dec: 2, trap: Gn - L, others: [(p * Gn) / 100, (Gn - L) / 2, -ans], signed: true,
    tip: `${fr(p / 100, 2)} × ${Gn} − ${fr(1 - p / 100, 2)} × ${L} = ${sg(ans)} €. On pondère chaque issue par sa probabilité.` });
});

/* ------------------------------------------------------------ risques */
G('var-param', 'Risques', [2], (r) => {
  const V = pick(r, [5, 10, 20, 50, 100]), s = pick(r, [0.5, 1, 1.5, 2]), [c, z, oz] = pick(r, [[95, 1.65, 2.33], [99, 2.33, 1.65]]), ans = (V * s * z) / 100;
  return ask(r, { text: `Portefeuille de ${V} M€, volatilité quotidienne de ${fr(s, 1)} %, rendements normaux. VaR à 1 jour à ${c} % (z = ${fr(z)}) ?`, ans, unit: 'M€', dec: 3, tol: 0.01, trap: (V * s * oz) / 100, others: [(V * s) / 100, ans * Math.sqrt(10), ans * 10],
    tip: `${V} × ${fr(s, 1)} % × ${fr(z)} = ${fr(ans, 3)} M€. Avec z = ${fr(oz)}, on aurait la VaR à ${c === 95 ? 99 : 95} %.` });
});
G('var-sqrt', 'Risques', [2], (r) => {
  const v = pick(r, [0.5, 1, 2, 3, 5]), n = pick(r, [4, 9, 16, 25, 10]), ans = v * Math.sqrt(n);
  return ask(r, { text: `VaR à 1 jour de ${fr(v, 1)} M€. VaR à ${n} jours, par la règle de la racine du temps ?`, ans, unit: 'M€', dec: 2, tol: 0.01, trap: v * n, others: [(v * n) / 2, v, ans * 2],
    tip: `× √${n} ${n === 10 ? '≈ 3,16' : `= ${Math.sqrt(n)}`} : ${fr(ans)} M€. Ce sont les variances qui s'additionnent jour après jour, pas les écarts-types.` });
});
G('var-two', 'Risques', [3], (r) => {
  const [x, y] = pick(r, [[3, 4], [5, 12], [6, 8], [8, 15]]), k = pick(r, [1, 2]), a = x * k, b = y * k, rho = pick(r, [0, 0, 1, -1]);
  const ans = rho === 0 ? Math.sqrt(a * a + b * b) : rho === 1 ? a + b : Math.abs(a - b);
  return ask(r, { text: `Deux positions de VaR ${a} M€ et ${b} M€, corrélation ${fr(rho, 1)}. VaR de l'ensemble (approche variance-covariance) ?`, ans, unit: 'M€', dec: 1, trap: rho === 1 ? Math.sqrt(a * a + b * b) : a + b, others: [(a + b) / 2, Math.abs(a - b), Math.max(a, b), a + b],
    tip: `VaR² = ${a}² + ${b}² + 2 × ${pn(rho, 1)} × ${a} × ${b} = ${fr(a * a + b * b + 2 * rho * a * b)}, donc ${fr(ans, 1)} M€. ${rho === 1 ? 'Corrélation parfaite : les VaR s\'additionnent.' : 'Additionner les VaR ignore la diversification.'}` });
});
G('el', 'Risques', [2], (r) => {
  const EAD = between(r, 1, 50) * 2, PD = pick(r, [0.5, 1, 2, 3, 5]), R = pick(r, [20, 40, 60]), ans = (EAD * 1000 * PD * (100 - R)) / 1e4;
  return ask(r, { text: `Exposition de ${EAD} M€, probabilité de défaut de ${fr(PD, 1)} %, taux de recouvrement de ${R} %. Perte attendue ?`, ans, unit: 'k€', dec: 1, trap: (EAD * 1000 * PD * R) / 1e4, others: [(EAD * 1000 * PD) / 100, ans * 10],
    tip: `EL = EAD × PD × LGD = ${EAD} M€ × ${fr(PD, 1)} % × ${100 - R} % = ${fr(ans, 1)} k€. La perte en cas de défaut est ce qu'on ne récupère pas : 1 − ${R} %.` });
});
G('cds-pd', 'Risques', [3], (r) => {
  const s = pick(r, [50, 100, 150, 200, 300, 500]), R = pick(r, [20, 40, 60]), ans = s / (100 - R);
  return ask(r, { text: `Spread de CDS de ${s} pb, taux de recouvrement de ${R} %. Probabilité annuelle de défaut implicite, en % ?`, ans, unit: '%', dec: 2, tol: 0.01, trap: s / 100, others: [s / R, (s * (100 - R)) / 1e4, ans * 2],
    tip: `PD ≈ spread / (1 − R) = ${fr(s / 100)} % / ${fr(1 - R / 100, 1)} = ${fr(ans)} %. Le spread ne paie que la perte, pas tout le nominal.` });
});
G('backtest', 'Risques', [2], (r) => {
  const N = pick(r, [100, 250, 500, 750, 1000, 2000]), c = pick(r, [90, 95, 97.5, 99, 99.5]), ans = (N * (100 - c)) / 100;
  return ask(r, { text: `Backtest d'une VaR à ${fr(c, 1)} % sur ${fr(N)} jours : combien de dépassements attend-on ?`, ans, unit: 'jours', dec: 1, trap: 100 - c, others: [N / 10, ans * 2, ans / 2],
    tip: `${fr(100 - c, 1)} % des ${fr(N)} jours : ${fr(ans, 1)} dépassements. Beaucoup plus, et le modèle sous-estime le risque.` });
});
G('dmod-dv01', 'Risques', [3], (r) => {
  const N = pick(r, [5, 10, 20, 50]), D = between(r, 2, 9) + pick(r, [0, 0.5]), dv = N * D * 100;
  return ask(r, { text: `DV01 de ${fr(dv)} € pour ${N} M€ de nominal. Duration modifiée ?`, ans: D, dec: 1, trap: dv / N, others: [D * 10, D / 10, D * 2],
    tip: `DV01 = nominal × duration × 0,0001, donc D = ${fr(dv)} / (${N} 000 000 × 0,0001) = ${fr(D, 1)}.` });
});
G('vol-daily-r', 'Risques', [1], (r) => {
  const s = pick(r, [6, 8, 10, 12, 15, 16, 18, 20, 24, 25, 30, 32, 40]), ans = s / Math.sqrt(252);
  return ask(r, { text: `Volatilité annuelle de ${s} %. Volatilité quotidienne approximative (252 jours de bourse) ?`, ans, unit: '%', dec: 2, tol: 0.03, trap: s / 252, others: [s / 12, s / 52, s / 2],
    tip: `On divise par √252 ≈ 16 : ${s} / 16 ≈ ${fr(s / 16)} %.` });
});
G('lev-wipe', 'Risques', [3], (r) => {
  const L = pick(r, [8, 10, 12.5, 15, 16, 20, 25, 30, 40, 50, 60]), ans = 100 / L;
  return ask(r, { text: `Une banque a un levier de ${fr(L, 1)} (actifs / fonds propres). Quelle baisse de la valeur des actifs efface ses fonds propres ?`, ans, unit: '%', dec: 2, trap: L, others: [100 - ans, ans / 2, ans * 2],
    tip: `Fonds propres = actifs / ${fr(L, 1)} = ${fr(ans)} % des actifs : une baisse de ${fr(ans)} % suffit.` });
});
G('cet1', 'Risques', [2], (r) => {
  const ratio = between(r, 8, 16), CET1 = between(r, 2, 15) * ratio / 2, RWA = (CET1 * 100) / ratio, A = RWA * between(r, 2, 4);
  return ask(r, { text: `Fonds propres CET1 de ${fr(CET1, 1)} Md€, actifs pondérés par les risques de ${fr(RWA, 1)} Md€, total du bilan de ${fr(A, 1)} Md€. Ratio CET1 ?`, ans: ratio, unit: '%', dec: 2, tol: 0.005, trap: (CET1 * 100) / A, others: [RWA / CET1, ratio * 2, 4.5],
    tip: `CET1 / actifs pondérés = ${fr(CET1, 1)} / ${fr(RWA, 1)} = ${ratio} %. Rapporté au total du bilan (${fr((CET1 * 100) / A, 2)} %), c'est le ratio de levier.` });
});

/* ------------------------------------------------------------ macro */
G('real-rate', 'Macro', [1, 2], (r) => {
  const n = between(r, 1, 8), i = between(r, 0, 10);
  if (i === n) return null;
  return ask(r, { text: `Taux d'intérêt nominal de ${n} %, inflation de ${i} %. Taux réel, environ ?`, ans: n - i, unit: '%', dec: 1, trap: n + i, others: [i - n, n, n / 2], signed: true,
    tip: `Fisher : réel ≈ nominal − inflation = ${n} − ${i} = ${sg(n - i, 0)} %.${n < i ? ' Un taux réel négatif fait fondre l\'épargne.' : ''}` });
});
G('real-growth', 'Macro', [2], (r) => {
  const g = between(r, 1, 9), i = between(r, 1, 12) / 2;
  if (g === i) return null;
  return ask(r, { text: `PIB nominal en hausse de ${g} %, inflation de ${fr(i, 1)} %. Croissance réelle, environ ?`, ans: g - i, unit: '%', dec: 1, trap: g + i, others: [g, i - g, g * i], signed: true,
    tip: `Réel ≈ nominal − inflation = ${g} − ${fr(i, 1)} = ${sg(g - i, 1)} %.` });
});
G('multiplier', 'Macro', [3], (r) => {
  const rr = pick(r, [1, 2, 2.5, 4, 5, 8, 10, 12.5, 20, 25]), ans = 100 / rr;
  return ask(r, { text: `Taux de réserves obligatoires de ${fr(rr, 1)} %. Multiplicateur monétaire théorique ?`, ans, dec: 2, trap: rr, others: [100 - rr, ans / 2, ans * 2],
    tip: `Multiplicateur = 1 / taux de réserves = 1 / ${fr(rr / 100, 3)} = ${fr(ans)}.` });
});
G('power', 'Macro', [1], (r) => {
  const a = between(r, 0, 8), b = between(r, 1, 8);
  if (a === b) return null;
  return ask(r, { text: `Ton salaire augmente de ${a} %, l'inflation est de ${b} %. Ton pouvoir d'achat évolue d'environ…`, ans: a - b, unit: '%', dec: 1, trap: a, others: [a + b, b - a, b], signed: true,
    tip: `Pouvoir d'achat ≈ hausse du salaire − inflation = ${a} − ${b} = ${sg(a - b, 0)} %.` });
});
G('debt-gdp', 'Macro', [1], (r) => {
  const Y = 100 * between(r, 10, 40), d = pick(r, [40, 60, 80, 90, 100, 110, 120, 150]), D = (Y * d) / 100;
  return ask(r, { text: `Dette publique de ${fr(D)} Md€, PIB de ${fr(Y)} Md€. Ratio dette / PIB ?`, ans: d, unit: '%', dec: 1, trap: (100 * Y) / D, others: [d / 10, 100 - d, d * 2],
    tip: `${fr(D)} / ${fr(Y)} = ${d} % du PIB.` });
});
G('fisher-exact', 'Macro', [3], (r) => {
  const n = pick(r, [10, 20, 30, 50, 100]), i = pick(r, [5, 10, 15, 20, 40, 80].filter((x) => x !== n)), ans = ((1 + n / 100) / (1 + i / 100) - 1) * 100;
  return ask(r, { text: `Forte inflation : taux nominal de ${n} %, inflation de ${i} %. Taux réel exact (formule de Fisher) ?`, ans, unit: '%', dec: 2, tol: 0.01, trap: n - i, others: [n + i, n / i, (n - i) / 2], signed: true,
    tip: `(1 + ${n} %) / (1 + ${i} %) − 1 = ${fr(1 + n / 100, 2)} / ${fr(1 + i / 100, 2)} − 1 = ${sg(ans)} %. L'approximation « nominal − inflation » (${sg(n - i, 0)} %) dérape quand les taux sont élevés.` });
});

/* ------------------------------------------------------------ casse-tête chiffrés */
G('tournament', 'Logique', [1], (r) => {
  const n = between(r, 12, 300);
  return ask(r, { text: `Tournoi de tennis à ${n} joueurs, élimination directe (avec des exemptions si besoin). Combien de matchs pour désigner le vainqueur ?`, ans: n - 1, unit: 'matchs', dec: 0, trap: Math.ceil(n / 2), others: [n, Math.ceil(Math.log2(n)), n * 2],
    tip: `Chaque match élimine exactement un joueur, et il faut en éliminer ${n - 1}.` });
});
G('handshake', 'Logique', [1], (r) => {
  const n = between(r, 5, 30);
  return ask(r, { text: `${n} personnes se serrent toutes la main, une fois par paire. Combien de poignées de main ?`, ans: (n * (n - 1)) / 2, dec: 0, trap: n * (n - 1), others: [n * n, n - 1, n],
    tip: `Chacun serre ${n - 1} mains, et chaque poignée est comptée deux fois : ${n} × ${n - 1} / 2 = ${(n * (n - 1)) / 2}.` });
});
G('lily', 'Logique', [2], (r) => {
  const f = pick(r, [2, 2, 3]), n = between(r, 10, 60), part = f === 2 ? 'la moitié' : 'le tiers';
  return ask(r, { text: `Un nénuphar ${f === 2 ? 'double' : 'triple'} de surface chaque jour et couvre tout le lac en ${n} jours. En combien de jours en couvre-t-il ${part} ?`, ans: n - 1, unit: 'jours', dec: 0, trap: n / f, others: [n - f, n / 2 + 1, n - 2],
    tip: `La veille du dernier jour, il couvrait ${part} du lac : ${n} − 1 = ${n - 1} jours.` });
});
G('machines', 'Logique', [2], (r) => {
  const a = between(r, 3, 9), b = between(r, 10, 200);
  if (r.next() < 0.5) return ask(r, { text: `Il faut ${a} machines et ${a} minutes pour faire ${a} pièces. Combien de minutes pour ${b} machines et ${b} pièces ?`, ans: a, unit: 'min', dec: 0, trap: b, others: [b / a, a * b, 1],
    tip: `Une machine fait une pièce en ${a} minutes : ${b} machines font ${b} pièces en ${a} minutes.` });
  const k = between(r, 2, 5);
  return ask(r, { text: `Il faut ${a} machines et ${a} minutes pour faire ${a} pièces. Combien de machines pour faire ${fr(b * k)} pièces en ${a * k} minutes ?`, ans: b, unit: 'machines', dec: 0, trap: b * k, others: [a * k, (b * k) / a, a],
    tip: `Une machine fait une pièce en ${a} minutes, donc ${k} pièces en ${a * k} minutes : ${fr(b * k)} / ${k} = ${b} machines.` });
});
G('age', 'Logique', [2], (r) => {
  const s = between(r, 4, 15), x = between(r, 3, 25), f = 2 * s + x;
  return ask(r, { text: `Un père a ${f} ans, son fils ${s}. Dans combien d'années le père aura-t-il exactement le double de l'âge de son fils ?`, ans: x, unit: 'ans', dec: 0, trap: f - s, others: [x * 2, s, Math.abs(f / 2 - s) + 1],
    tip: `${f} + x = 2 × (${s} + x), donc x = ${f} − ${2 * s} = ${x} ans (il aura ${f + x} ans, son fils ${s + x}).` });
});
G('snail', 'Logique', [2], (r) => {
  const u = between(r, 3, 6), d = between(r, 1, u - 1), h = between(r, u + 4, 30), ans = Math.ceil((h - u) / (u - d)) + 1, trap = h / (u - d);
  if (Math.abs(trap - ans) < 0.5) return null;
  return ask(r, { text: `Un escargot au fond d'un puits de ${h} m monte de ${u} m le jour et glisse de ${d} m la nuit. Combien de jours pour sortir ?`, ans, unit: 'jours', dec: 0, trap: Math.ceil(trap), others: [ans + 1, Math.ceil(h / u), ans - 1],
    tip: `Il gagne ${u - d} m par jour complet, mais le dernier jour il sort sans glisser : il lui suffit d'atteindre ${h - u} m le matin. ${Math.ceil((h - u) / (u - d))} jours pour ça, plus le dernier : ${ans}.` });
});
G('clock', 'Logique', [3], (r) => {
  const h = between(r, 1, 11), m = 5 * between(r, 1, 11), raw = Math.abs(30 * h - 5.5 * m), ans = Math.min(raw, 360 - raw), rt = Math.abs(30 * h - 6 * m), trap = Math.min(rt, 360 - rt);
  if (trap === ans) return null;
  return ask(r, { text: `Quel angle font les aiguilles d'une horloge à ${h} h ${String(m).padStart(2, '0')} ?`, ans, unit: '°', dec: 1, trap, others: [360 - ans, ans + 30, Math.abs(ans - 30)],
    tip: `L'aiguille des heures avance aussi : ${30 * h} + 0,5 × ${m} = ${fr(30 * h + 0.5 * m, 1)}°, celle des minutes est à ${6 * m}°. Écart : ${fr(ans, 1)}°.` });
});
G('socks', 'Logique', [1], (r) => {
  const k = between(r, 2, 8);
  return ask(r, { text: `Un tiroir contient des chaussettes de ${k} couleurs, mélangées dans le noir. Combien en prendre au minimum pour être sûr d'avoir une paire de la même couleur ?`, ans: k + 1, unit: 'chaussettes', dec: 0, trap: 2 * k, others: [k, 2, 2 * k + 1],
    tip: `Avec ${k} chaussettes, on peut tomber sur ${k} couleurs différentes ; la ${k + 1}e forme forcément une paire (principe des tiroirs).` });
});
G('meet', 'Logique', [2], (r) => {
  const v1 = 10 * between(r, 4, 12), v2 = 10 * between(r, 4, 12), t = pick(r, [0.5, 1, 1.5, 2, 2.5, 3]), D = (v1 + v2) * t;
  return ask(r, { text: `Deux trains partent en même temps de deux villes distantes de ${D} km et roulent l'un vers l'autre, à ${v1} et ${v2} km/h. Au bout de combien de minutes se croisent-ils ?`, ans: t * 60, unit: 'min', dec: 0, trap: v1 === v2 ? (D / v1) * 60 : (D / Math.abs(v1 - v2)) * 60, others: [(D / v1) * 60, t * 30, t * 120],
    tip: `Ils se rapprochent à ${v1} + ${v2} = ${v1 + v2} km/h : ${D} / ${v1 + v2} = ${fr(t, 1)} h, soit ${t * 60} minutes.` });
});
G('harmonic', 'Logique', [3], (r) => {
  const [a, b] = pick(r, [[60, 40], [30, 60], [40, 120], [20, 30], [90, 45], [100, 150], [80, 120], [60, 90], [15, 30], [50, 75], [12, 6]]), ans = (2 * a * b) / (a + b);
  return ask(r, { text: `Aller à ${a} km/h, retour à ${b} km/h, même distance. Vitesse moyenne sur l'aller-retour ?`, ans, unit: 'km/h', dec: 1, trap: (a + b) / 2, others: [Math.max(a, b), Math.min(a, b), a + b],
    tip: `Moyenne harmonique : 2 × ${a} × ${b} / (${a} + ${b}) = ${fr(ans, 1)} km/h. On passe plus de temps à la vitesse lente, d'où moins que ${fr((a + b) / 2, 1)}.` });
});
G('pipes', 'Logique', [2], (r) => {
  const [a, b] = pick(r, [[3, 6], [4, 12], [6, 12], [2, 6], [10, 15], [12, 24], [20, 30], [5, 20], [6, 30], [3, 12]]), ans = (a * b) / (a + b);
  return ask(r, { text: `Un robinet remplit une cuve en ${a} h, un autre en ${b} h. Ensemble, en combien d'heures ?`, ans, unit: 'h', dec: 2, trap: (a + b) / 2, others: [Math.abs(a - b), a + b, Math.min(a, b)],
    tip: `Par heure : 1/${a} + 1/${b} = ${frac(a + b, a * b)} de la cuve, donc ${fr(ans)} h.` });
});

/* ------------------------------------------------------------ estimations calculables */
G('units-time', 'Estimation', [1, 2], (r, t) => {
  const n = t === 1 ? between(r, 2, 7) : between(r, 8, 40);
  const [text, ans, trap, why] = pick(r, [
    [`Combien de secondes dans ${n} jours ?`, 86400 * n, 3600 * n, `${n} × 24 × 3 600 = ${fr(86400 * n)}.`],
    [`Combien de minutes dans ${n} semaines ?`, 10080 * n, 1440 * n, `${n} × 7 × 1 440 = ${fr(10080 * n)}.`],
    [`Combien d'heures dans ${n} années de 365 jours ?`, 8760 * n, 365 * n, `${n} × 365 × 24 = ${fr(8760 * n)}.`],
    [`Combien de secondes dans ${n} heures ?`, 3600 * n, 60 * n, `${n} × 3 600 = ${fr(3600 * n)}.`],
  ]);
  return ask(r, { text, ans, dec: 0, tol: 0.02, trap, others: [ans * 10, ans / 10, ans * 2], tip: why });
});
G('pool', 'Estimation', [2], (r) => {
  const L = 5 * between(r, 2, 10), W = 5 * between(r, 1, 5), Dp = pick(r, [1, 1.5, 2, 3]), ans = L * W * Dp * 1000;
  return ask(r, { text: `Combien de litres d'eau dans un bassin de ${L} m × ${W} m, ${fr(Dp, 1)} m de fond ?`, ans, unit: 'L', dec: 0, tol: 0.05, trap: L * W * Dp, others: [ans * 1000, ans / 10, ans * 10],
    tip: `${L} × ${W} × ${fr(Dp, 1)} = ${fr(L * W * Dp)} m³, et 1 m³ = 1 000 litres : ${fr(ans)} L.` });
});
G('pow2-digits', 'Estimation', [3], (r) => {
  const n = between(r, 20, 200), ans = Math.floor(n * Math.log10(2)) + 1;
  return ask(r, { text: `Combien de chiffres a 2 puissance ${n} (log₁₀ 2 ≈ 0,301) ?`, ans, unit: 'chiffres', dec: 0, trap: ans - 1, others: [n, Math.round(n / 2), ans + 2],
    tip: `${n} × 0,301 ≈ ${fr(n * Math.log10(2), 2)} : 2^${n} ≈ 10^${fr(n * Math.log10(2), 2)}, un nombre de ${ans} chiffres (10^k en a k + 1).` });
});
G('seconds', 'Estimation', [3], (r) => {
  const [lab, s] = pick(r, [['un million', 1e6], ['deux millions', 2e6], ['cinq millions', 5e6], ['dix millions', 1e7], ['cinquante millions', 5e7], ['cent millions', 1e8], ['cinq cents millions', 5e8], ['un milliard', 1e9], ['deux milliards', 2e9], ['dix milliards', 1e10]]);
  const days = s / 86400, years = days / 365.25, inYears = years >= 1;
  return ask(r, { text: `${cap(lab)} de secondes, ça fait combien ${inYears ? 'd\'années' : 'de jours'}, environ ?`, ans: inYears ? years : days, unit: inYears ? 'ans' : 'jours', dec: 1, tol: 1.3, tolMode: 'factor', trap: inYears ? years * 10 : days * 10, others: [inYears ? years / 10 : days / 10, inYears ? years * 100 : days * 100],
    tip: `Un jour fait 86 400 s et une année environ 3,15 × 10⁷ s : ${inYears ? `${fr(years, 1)} ans` : `${fr(days, 1)} jours`}.` });
});

/* ------------------------------------------------------------ statistiques */
const mean = (l) => l.reduce((a, b) => a + b, 0) / l.length;
const median = (l) => { const s = [...l].sort((a, b) => a - b), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const listStr = (l) => l.map((x) => fr(x)).join(' ; ');
G('st-mean', 'Stats', [1], (r) => {
  const n = between(r, 5, 7), l = Array.from({ length: n - 1 }, () => between(r, 1, 25)), sum = l.reduce((a, b) => a + b, 0);
  // la dernière valeur (entre 1 et 30) rend la moyenne entière
  const lo = Math.ceil((sum + 1) / n), hi = Math.floor((sum + 30) / n);
  if (lo > hi) return null;
  const m = between(r, lo, hi), last = m * n - sum;
  l.push(last); r.shuffle(l);
  const med = median(l);
  return ask(r, { text: `Moyenne de la série : ${listStr(l)} ?`, ans: m, dec: 2, trap: med === m ? m + 1 : med, others: [(m * n) / (n - 1), m - 1, m + 2],
    tip: `Somme ${fr(m * n)}, ${n} valeurs : ${fr(m * n)} / ${n} = ${m}.${med !== m ? ` La médiane, elle, vaut ${fr(med)}.` : ''}` });
});
G('st-median', 'Stats', [1, 2], (r, t) => {
  const n = t === 1 ? pick(r, [5, 7]) : pick(r, [6, 8]), l = Array.from({ length: n }, () => between(r, 1, 40));
  const s = [...l].sort((a, b) => a - b), med = median(l), mid = n % 2 ? l[n >> 1] : (l[n / 2 - 1] + l[n / 2]) / 2, avg = mean(l);
  if (mid === med || Math.abs(avg - med) < 0.5) return null;
  return ask(r, { text: `Médiane de la série : ${listStr(l)} ?`, ans: med, dec: 2, trap: mid, others: [avg, s[0] + (s[n - 1] - s[0]) / 2, med + 1],
    tip: `On trie d'abord : ${listStr(s)}. ${n % 2 ? `La valeur du milieu est ${fr(med)}.` : `Les deux du milieu sont ${fr(s[n / 2 - 1])} et ${fr(s[n / 2])} : médiane ${fr(med)}.`} Prendre le milieu de la liste sans la trier donne ${fr(mid)}.` });
});
G('st-spread', 'Stats', [1], (r) => {
  const l = Array.from({ length: between(r, 6, 8) }, () => between(r, 2, 60));
  if (r.next() < 0.5) {
    const mx = Math.max(...l), mn = Math.min(...l);
    return ask(r, { text: `Étendue de la série : ${listStr(l)} ?`, ans: mx - mn, dec: 0, trap: mx, others: [mx + mn, Math.round(mean(l)), mx - l[0]],
      tip: `Étendue = plus grande valeur − plus petite : ${mx} − ${mn} = ${mx - mn}.` });
  }
  const mode = pick(r, l); l.push(mode, mode); r.shuffle(l);
  const counts = l.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {}), top = Math.max(...Object.values(counts));
  if (Object.values(counts).filter((c) => c === top).length > 1) return null;
  return ask(r, { text: `Mode (valeur la plus fréquente) de la série : ${listStr(l)} ?`, ans: mode, dec: 0, trap: median(l) === mode ? Math.max(...l) : median(l), others: [Math.max(...l), Math.round(mean(l)), l[0]],
    tip: `${mode} apparaît ${top} fois, plus que toute autre valeur. Le mode n'est ni la médiane ni la moyenne.` });
});
G('st-std', 'Stats', [2, 3], (r, t) => {
  const d = between(r, 2, 6), m = between(r, 10, 50), n = pick(r, [4, 6, 8]), l = r.shuffle([...Array(n / 2).fill(m - d), ...Array(n / 2).fill(m + d)]);
  const askVar = t === 2 && r.next() < 0.4;
  return ask(r, { text: `${askVar ? 'Variance' : 'Écart-type'} (de population) de la série : ${listStr(l)} ?`, ans: askVar ? d * d : d, dec: 2, trap: askVar ? d : d * d === d ? 2 * d : d * d, others: [2 * d, d / 2, d * Math.sqrt(2)],
    tip: `Moyenne ${m} ; chaque valeur s'en écarte de ${d}, donc la variance vaut ${d}² = ${d * d} et l'écart-type ${d}. ${askVar ? 'L\'écart-type est la racine de la variance.' : 'La variance est le carré de l\'écart-type.'}` });
});
G('st-weighted', 'Stats', [1], (r) => {
  const notes = [between(r, 4, 20), between(r, 4, 20), between(r, 4, 20)], c = [between(r, 1, 4), between(r, 1, 4), between(r, 1, 4)];
  if (c[0] === c[1] && c[1] === c[2]) return null;
  const ans = notes.reduce((s, x, k) => s + x * c[k], 0) / (c[0] + c[1] + c[2]);
  return ask(r, { text: `Notes de ${notes.join(', ')} avec des coefficients ${c.join(', ')}. Moyenne pondérée ?`, ans, dec: 2, tol: 0.005, trap: mean(notes), others: [ans + 1, notes.reduce((s, x, k) => s + x * c[k], 0) / 3],
    tip: `(${notes.map((x, k) => `${x} × ${c[k]}`).join(' + ')}) / ${c[0] + c[1] + c[2]} = ${fr(ans)}. La moyenne simple (${fr(mean(notes))}) ignore les coefficients.` });
});
G('st-se', 'Stats', [2], (r) => {
  const s = 5 * between(r, 1, 8), n = pick(r, [4, 9, 16, 25, 36, 64, 100, 400]), ans = s / Math.sqrt(n);
  return ask(r, { text: `Écart-type d'une mesure : ${s}. Écart-type de la moyenne de ${n} mesures indépendantes ?`, ans, dec: 2, trap: s / n, others: [s * Math.sqrt(n), s, ans / 2],
    tip: `σ / √n = ${s} / ${Math.sqrt(n)} = ${fr(ans)}. Moyenner réduit le bruit comme la racine du nombre de mesures, pas comme le nombre lui-même.` });
});
G('st-ci', 'Stats', [2, 3], (r, t) => {
  const s = 5 * between(r, 2, 8), n = pick(r, [25, 36, 64, 100, 400]), mu = 10 * between(r, 5, 50), half = (1.96 * s) / Math.sqrt(n);
  if (t === 3) return ask(r, { text: `Moyenne d'un échantillon de ${n} : ${mu}, écart-type ${s}. Borne haute de l'intervalle de confiance à 95 % ?`, ans: mu + half, dec: 2, tol: 0.003, trap: mu + 1.96 * s, others: [mu + s / Math.sqrt(n), mu + (1.65 * s) / Math.sqrt(n), mu + half * 2],
    tip: `${mu} + 1,96 × ${s} / √${n} = ${mu} + ${fr(half)} = ${fr(mu + half)}. Sans diviser par √n, on décrit la dispersion d'une mesure, pas la précision de la moyenne.` });
  return ask(r, { text: `Échantillon de ${n} mesures, écart-type ${s}. Demi-largeur de l'intervalle de confiance à 95 % de la moyenne ?`, ans: half, dec: 2, tol: 0.03, trap: 1.96 * s, others: [s / Math.sqrt(n), (1.65 * s) / Math.sqrt(n), half * 2],
    tip: `1,96 × σ / √n = 1,96 × ${s} / ${Math.sqrt(n)} ≈ ${fr(half)} (de tête, 2 × ${s} / ${Math.sqrt(n)} = ${fr((2 * s) / Math.sqrt(n))}).` });
});
G('st-z', 'Stats', [2], (r) => {
  const mu = 5 * between(r, 4, 30), s = between(r, 2, 10), k = pick(r, [-2.5, -2, -1.5, -1, 0.5, 1, 1.5, 2, 3]), x = mu + k * s;
  return ask(r, { text: `Moyenne ${mu}, écart-type ${s}. Score z de la valeur ${fr(x)} ?`, ans: k, dec: 2, trap: x - mu, others: [-k, k * s, k / 2], signed: true,
    tip: `z = (x − μ) / σ = (${fr(x)} − ${mu}) / ${s} = ${sg(k)}. Il dit à combien d'écarts-types de la moyenne on se trouve.` });
});
G('st-normal', 'Stats', [1, 2], (r, t) => {
  const [ctx, mu, s, unit] = pick(r, [['La taille des hommes adultes suit une loi normale de moyenne 176 cm et d\'écart-type 7 cm', 176, 7, 'cm'], ['Les rendements quotidiens d\'un indice suivent une loi normale de moyenne 0 % et d\'écart-type 1 %', 0, 1, '%'], ['Les notes d\'un concours suivent une loi normale de moyenne 12 et d\'écart-type 3', 12, 3, ''], ['Le QI suit une loi normale de moyenne 100 et d\'écart-type 15', 100, 15, '']]);
  const [k, two] = pick(r, t === 1 ? [[1, true], [2, true], [3, true]] : [[1, false], [2, false], [-1, false], [-2, false]]);
  const v = (x) => `${fr(x)}${unit ? (unit === '%' ? ' %' : ' ' + unit) : ''}`;
  if (two) { const ans = [0, 68, 95, 99.7][k], trap = [0, 50, 68, 95][k];
    return ask(r, { text: `${ctx}. Quelle part de la population se trouve entre ${v(mu - k * s)} et ${v(mu + k * s)} ?`, ans, unit: '%', dec: 1, trap, others: [[0, 34, 47.5, 49.85][k], 100 - ans, 99.9].filter((x) => x !== ans),
      tip: `À ±${k} écart${k > 1 ? 's' : ''}-type${k > 1 ? 's' : ''} de la moyenne : environ ${fr(ans, 1)} % (règle 68-95-99,7).` }); }
  const ans = Math.abs(k) === 1 ? 16 : 2.5, trap = Math.abs(k) === 1 ? 32 : 5;
  return ask(r, { text: `${ctx}. Quelle part se trouve ${k > 0 ? 'au-dessus' : 'en dessous'} de ${v(mu + k * s)} ?`, ans, unit: '%', dec: 1, trap, others: [Math.abs(k) === 1 ? 34 : 13.5, 50, Math.abs(k) === 1 ? 68 : 95],
    tip: `${fr(100 - trap, 1)} % sont à moins de ${Math.abs(k)} écart${Math.abs(k) > 1 ? 's' : ''}-type${Math.abs(k) > 1 ? 's' : ''} ; le reste (${trap} %) se partage entre les deux queues, donc ${fr(ans, 1)} % d'un seul côté.` });
});
G('st-sum-sd', 'Stats', [2], (r) => {
  const [a, b] = pick(r, [[3, 4], [6, 8], [5, 12], [8, 15], [9, 12], [12, 16]]), minus = r.next() < 0.4;
  return ask(r, { text: `X et Y indépendantes, d'écarts-types ${a} et ${b}. Écart-type de X ${minus ? '−' : '+'} Y ?`, ans: Math.hypot(a, b), dec: 2, trap: minus ? b - a : a + b, others: [a + b, (a + b) / 2, a * b],
    tip: `Les variances s'additionnent, ${minus ? 'même pour une différence' : 'pas les écarts-types'} : √(${a}² + ${b}²) = √${a * a + b * b} = ${fr(Math.hypot(a, b))}.` });
});
G('st-n-error', 'Stats', [2], (r) => {
  const k = pick(r, [2, 3, 4, 5, 10]);
  return ask(r, { text: `Pour diviser par ${k} l'erreur d'estimation d'une moyenne, par combien faut-il multiplier la taille de l'échantillon ?`, ans: k * k, dec: 0, trap: k, others: [2 * k, k * k * k, k + 1],
    tip: `L'erreur suit 1/√n : la diviser par ${k} demande ${k}² = ${k * k} fois plus de mesures.` });
});
G('st-reg', 'Stats', [1, 3], (r, t) => {
  if (t === 1) {
    const a = between(r, -20, 50), b = pick(r, [-3, -2, -1.5, 0.5, 1.5, 2, 3, 4]), x = between(r, 2, 20);
    return ask(r, { text: `La droite de régression est y = ${a} ${b < 0 ? '−' : '+'} ${fr(Math.abs(b))}x. Valeur prédite pour x = ${x} ?`, ans: a + b * x, dec: 2, trap: a * x + b, others: [b * x, a + b + x, a - b * x],
      tip: `y = ${a} ${b < 0 ? '−' : '+'} ${fr(Math.abs(b))} × ${x} = ${fr(a + b * x)}.` });
  }
  const vx = pick(r, [2, 4, 5, 8, 10, 16, 25]), b = pick(r, [-1.5, -0.5, 0.5, 0.75, 1.2, 1.5, 2]), cov = round(b * vx, 4), vy = vx * b * b * pick(r, [1.25, 2, 4]);
  return ask(r, { text: `Cov(X, Y) = ${fr(cov)}, Var(X) = ${vx}, Var(Y) = ${fr(vy)}. Pente de la régression de Y sur X ?`, ans: b, dec: 2, trap: cov / vy, others: [vx / cov, cov / Math.sqrt(vx * vy), b * 2], signed: true,
    tip: `Pente = Cov(X, Y) / Var(X) = ${fr(cov)} / ${vx} = ${sg(b)}. On divise par la variance de la variable explicative.` });
});
G('st-corr', 'Stats', [3], (r) => {
  if (r.next() < 0.5) {
    const sx = between(r, 2, 10), sy = between(r, 2, 10), rho = pick(r, [-0.8, -0.5, -0.3, 0.2, 0.4, 0.6, 0.9]), cov = round(rho * sx * sy, 4);
    return ask(r, { text: `Cov(X, Y) = ${fr(cov)}, écarts-types ${sx} et ${sy}. Coefficient de corrélation ?`, ans: rho, dec: 2, trap: cov, others: [cov / (sx + sy), -rho, rho * rho], signed: true,
      tip: `ρ = cov / (σx σy) = ${fr(cov)} / ${sx * sy} = ${sg(rho)}. La covariance dépend des unités ; la corrélation, non.` });
  }
  const R2 = pick(r, [0.04, 0.09, 0.16, 0.25, 0.36, 0.49, 0.64, 0.81]), neg = r.next() < 0.5;
  return ask(r, { text: `Régression simple, pente ${neg ? 'négative' : 'positive'}, R² = ${fr(R2)}. Coefficient de corrélation ?`, ans: (neg ? -1 : 1) * Math.sqrt(R2), dec: 2, trap: (neg ? -1 : 1) * R2, others: [(neg ? 1 : -1) * Math.sqrt(R2), 1 - R2], signed: true,
    tip: `En régression simple, R² = ρ². Donc |ρ| = √${fr(R2)} = ${fr(Math.sqrt(R2))}, avec le signe de la pente.` });
});
G('st-mean-add', 'Stats', [2], (r) => {
  const n = between(r, 4, 19), m = between(r, 8, 40), v = m + pick(r, [-1, 1]) * between(r, 5, 40), ans = (n * m + v) / (n + 1);
  return ask(r, { text: `La moyenne de ${n} valeurs vaut ${m}. On ajoute la valeur ${v}. Nouvelle moyenne ?`, ans, dec: 2, tol: 0.005, trap: (m + v) / 2, others: [m, (n * m + v) / n, m + (v - m) / 2 + 1],
    tip: `Somme ${n} × ${m} = ${n * m}, plus ${v} : ${n * m + v}, divisé par ${n + 1} = ${fr(ans)}. La moyenne des deux moyennes oublie le nombre de valeurs.` });
});
G('st-skew', 'Stats', [2], (r) => {
  const n = between(r, 6, 11), S = 100 * between(r, 20, 40), P = 1000 * between(r, 15, 60), avg = (n * S + P) / (n + 1), med = S;
  const askMean = r.next() < 0.5;
  return ask(r, { text: `Une PME : ${n} salariés gagnent ${fr(S)} € par mois, le patron ${fr(P)} €. ${askMean ? 'Salaire moyen' : 'Salaire médian'} de l'entreprise ?`, ans: askMean ? avg : med, unit: '€', dec: 0, tol: askMean ? 0.005 : 0, trap: askMean ? med : avg, others: [(S + P) / 2, P / (n + 1)],
    tip: `Moyenne : (${n} × ${fr(S)} + ${fr(P)}) / ${n + 1} ≈ ${fr(avg, 0)} € ; médiane : ${fr(med)} €. Une valeur extrême tire la moyenne, pas la médiane.` });
});

/* ------------------------------------------------------------ probabilités avancées */
G('pa-ruin', 'Probas', [3], (r) => {
  const N = pick(r, [5, 6, 8, 10, 12, 20]), k = between(r, 1, N - 1);
  if (k * 2 === N && r.next() < 0.5) return null;
  if (r.next() < 0.6) return choice(`Pile ou face équitable, 1 € par coup. Tu pars de ${k} € et tu t'arrêtes à 0 € ou à ${N} €. Probabilité d'atteindre ${N} € ?`, frac(k, N), k * 2 === N ? frac(1, 3) : '1/2', [frac(N - k, N), frac(1, N), frac(k, N + k)],
    `Le jeu est équitable : l'espérance de ta fortune reste ${k} €. Donc ${N} × p = ${k}, et p = ${frac(k, N)}.`);
  return ask(r, { text: `Pile ou face équitable, 1 € par coup. Tu pars de ${k} € et tu t'arrêtes à 0 € ou à ${N} €. Nombre moyen de coups joués ?`, ans: k * (N - k), dec: 0, trap: N, others: [k * N, N - k, k + N],
    tip: `Ruine du joueur : la durée moyenne vaut k × (N − k) = ${k} × ${N - k} = ${k * (N - k)} coups.` });
});
G('pa-markov', 'Probas', [3], (r) => {
  const p = pick(r, [0.1, 0.2, 0.25, 0.3, 0.4, 0.5]), q = pick(r, [0.1, 0.2, 0.3, 0.4, 0.5, 0.6].filter((x) => x !== p)), ans = (100 * q) / (p + q);
  return ask(r, { text: `Un jour de beau temps est suivi de pluie avec une probabilité de ${fr(p)} ; un jour de pluie est suivi de beau temps avec une probabilité de ${fr(q)}. À long terme, quelle part des jours fait beau, en % ?`, ans, unit: '%', dec: 1, tol: 0.01, trap: (1 - p) * 100, others: [50, (100 * p) / (p + q), q * 100],
    tip: `À l'équilibre, les passages beau → pluie et pluie → beau se compensent : π × ${fr(p)} = (1 − π) × ${fr(q)}, donc π = ${fr(q)} / (${fr(p)} + ${fr(q)}) ≈ ${fr(ans, 1)} %.` });
});
G('pa-walk', 'Probas', [3], (r) => {
  const n = between(r, 2, 30);
  if (r.next() < 0.5) return ask(r, { text: `Marche aléatoire : ${n} pas de +1 ou −1, équiprobables et indépendants, depuis 0. Variance de la position finale ?`, ans: n, dec: 1, trap: Math.sqrt(n), others: [0, n * n, n / 2],
    tip: `Chaque pas a une variance de 1 et ils sont indépendants : ${n} × 1 = ${n}. L'écart-type, lui, vaut √${n} : on s'éloigne comme la racine du temps.` });
  const m = between(r, 1, 4), num = C(2 * m, m), den = 4 ** m;
  return choice(`Marche aléatoire de pas +1 ou −1 équiprobables, depuis 0. Probabilité d'être revenu exactement en 0 après ${2 * m} pas ?`, frac(num, den), frac(1, 2 * m + 1), [m === 1 ? '1/4' : '1/2', frac(1, 2 * m), frac(num, 2 ** (2 * m + 1))],
    `Il faut autant de +1 que de −1 : C(${2 * m}, ${m}) = ${num} chemins sur 2${sup(2 * m)} = ${den}, soit ${frac(num, den)}.`);
});
G('pa-pattern', 'Probas', [3], (r) => {
  const [what, ans, trap] = pick(r, [['deux piles d\'affilée', 6, 4], ['pile puis face (à la suite)', 4, 6], ['trois piles d\'affilée', 14, 8], ['quatre piles d\'affilée', 30, 16], ['cinq piles d\'affilée', 62, 32]]);
  return ask(r, { text: `Pièce équilibrée : nombre moyen de lancers pour obtenir ${what} ?`, ans, unit: 'lancers', dec: 0, trap, others: [ans * 2, ans - 2, ans / 2],
    tip: ans === 4 ? 'Dès qu\'on a un pile, le premier face termine : 2 lancers en moyenne pour le pile, 2 pour le face, 4 en tout.'
      : `Pour k piles d'affilée, l'espérance vaut 2^(k+1) − 2 = ${ans}. Un face remet tout à zéro, d'où plus que 2^k = ${trap}.` });
});
G('pa-coupon', 'Probas', [3], (r) => {
  const n = between(r, 2, 6), H = Array.from({ length: n }, (_, k) => 1 / (k + 1)).reduce((a, b) => a + b, 0), ans = n * H;
  return ask(r, { text: `Combien de lancers en moyenne pour voir au moins une fois chacune des faces d'un dé à ${n} faces ?`, ans, unit: 'lancers', dec: 2, tol: 0.02, trap: n, others: [n * n, 2 * n, ans * 2],
    tip: `Problème du collectionneur : n × (1 + 1/2 + … + 1/n) = ${n} × ${fr(H, 3)} ≈ ${fr(ans)}. Les dernières faces manquantes sont de plus en plus longues à tomber.` });
});
G('pa-uniform', 'Probas', [3], (r) => {
  if (r.next() < 0.6) {
    const n = between(r, 2, 6), max = r.next() < 0.6;
    return choice(`${n} nombres tirés uniformément et indépendamment entre 0 et 1. Espérance du plus ${max ? 'grand' : 'petit'} ?`, max ? frac(n, n + 1) : frac(1, n + 1), '1/2', [max ? frac(n - 1, n) : frac(1, n), max ? frac(n + 1, n + 2) : frac(1, n + 2), frac(1, 2 * n)],
      `Les ${n} points découpent [0, 1] en ${n + 1} morceaux de même longueur moyenne, 1/${n + 1} : le plus ${max ? `grand est en moyenne à ${frac(n, n + 1)}` : `petit à ${frac(1, n + 1)}`}.`);
  }
  const a = pick(r, [0.5, 1, 1.5]), ans = a <= 1 ? (a * a) / 2 : 1 - ((2 - a) ** 2) / 2;
  return ask(r, { text: `X et Y uniformes et indépendants sur [0, 1]. Probabilité que X + Y ≤ ${fr(a, 1)} ?`, ans, dec: 3, trap: a / 2, others: [a * a, 1 - ans, a / 4],
    tip: `C'est l'aire sous la droite x + y = ${fr(a, 1)} dans le carré unité : ${a <= 1 ? `un triangle de côté ${fr(a, 1)}, d'aire ${fr(a, 1)}²/2` : `1 moins le triangle du coin, (${fr(2 - a, 1)})²/2`} = ${fr(ans, 3)}.` });
});
G('pa-cond', 'Probas', [2], (r) => {
  if (r.next() < 0.5) {
    const n = pick(r, [6, 8, 10, 12, 20]), k = between(r, 1, n - 2), ans = (k + 1 + n) / 2;
    return ask(r, { text: `Dé à ${n} faces. Sachant que le résultat dépasse ${k}, son espérance ?`, ans, dec: 1, trap: (n + 1) / 2, others: [(k + n) / 2 + 1, n, k + 1],
      tip: `Sachant X > ${k}, les valeurs ${k + 1} à ${n} sont équiprobables : moyenne (${k + 1} + ${n}) / 2 = ${fr(ans, 1)}.` });
  }
  const v = between(r, 1, 6);
  return ask(r, { text: `On lance deux dés. Le premier montre ${v}. Espérance de la somme ?`, ans: v + 3.5, dec: 1, trap: 7, others: [2 * v, v + 3, v + 6],
    tip: `${v} est acquis, le second dé vaut 3,5 en moyenne : ${fr(v + 3.5, 1)}.` });
});
G('pa-stopping', 'Probas', [3], (r) => {
  const n = pick(r, [6, 6, 10, 20]), m = between(r, 2, 4);
  let V = (n + 1) / 2;
  for (let k = 1; k < m; k++) { const t = V; let s = 0; for (let x = 1; x <= n; x++) s += Math.max(x, t); V = s / n; }
  return ask(r, { text: `Dé à ${n} faces : tu peux lancer jusqu'à ${m} fois et tu gardes le dernier lancer. Avec la meilleure stratégie, espérance du gain ?`, ans: V, dec: 2, tol: 0.01, trap: (n + 1) / 2, others: [n, ((n + 1) / 2 + n) / 2, V + 1],
    tip: `On remonte depuis la fin : avec un lancer, ${fr((n + 1) / 2, 1)} ; on ne relance que si le résultat est sous ce que vaut la suite. Résultat : ${fr(V)}.` });
});
G('pa-fixed', 'Probas', [3], (r) => {
  const n = between(r, 3, 50);
  if (r.next() < 0.5) return ask(r, { text: `${n} lettres glissées au hasard dans leurs ${n} enveloppes. Nombre moyen de lettres dans la bonne enveloppe ?`, ans: 1, dec: 2, trap: 1 / n, others: [n / 2, 0, 2],
    tip: `Linéarité de l'espérance : chaque lettre est bien placée avec une probabilité 1/${n}, et il y en a ${n} : ${n} × 1/${n} = 1, quel que soit n.` });
  const k = between(r, 10, 60), ans = (k * (k - 1)) / 2 / 365;
  return ask(r, { text: `${k} personnes dans une salle. Nombre moyen de paires qui partagent leur anniversaire (365 jours) ?`, ans, dec: 2, tol: 0.02, trap: k / 365, others: [ans * 2, k / 23, (k * k) / 365],
    tip: `${k} × ${k - 1} / 2 = ${(k * (k - 1)) / 2} paires, chacune avec une probabilité 1/365 : ${fr(ans)}.` });
});
G('pa-poisson', 'Probas', [3], (r) => {
  const l = pick(r, [0.5, 1, 2, 3]), ans = Math.exp(-l) * 100;
  return ask(r, { text: `Un desk reçoit en moyenne ${fr(l, 1)} appel${l > 1 ? 's' : ''} urgent${l > 1 ? 's' : ''} par heure (loi de Poisson). Probabilité de n'en recevoir aucun dans l'heure, en % ?`, ans, unit: '%', dec: 1, tol: 0.02, trap: l < 1 ? (1 - l) * 100 : 0, others: [100 / Math.E, 50, ans / 2],
    tip: `P(0) = e^(−λ) = e^(−${fr(l, 1)}) ≈ ${fr(ans, 1)} %. Une moyenne de ${fr(l, 1)} par heure ne garantit pas qu'il en arrive au moins un.` });
});
G('pa-binom-var', 'Probas', [2], (r) => {
  const n = 10 * between(r, 1, 20), p = pick(r, [0.1, 0.2, 0.25, 0.5, 0.6, 0.8]), varA = r.next() < 0.5;
  return ask(r, { text: `${n} essais indépendants, chacun réussi avec une probabilité de ${fr(p)}. ${varA ? 'Variance' : 'Espérance'} du nombre de succès ?`, ans: varA ? n * p * (1 - p) : n * p, dec: 2, trap: varA ? n * p : n * p * (1 - p), others: [n * (1 - p), Math.sqrt(n * p * (1 - p)), n * p * p],
    tip: `Loi binomiale : espérance np = ${fr(n * p)}, variance np(1 − p) = ${fr(n * p * (1 - p))}.` });
});

/* ------------------------------------------------------------ analyse et algèbre */
const poly = (cs) => cs.filter(([c]) => c).map(([c, p], k) => { const a = Math.abs(c), t = p === 0 ? String(a) : `${a === 1 ? '' : a}x${p > 1 ? sup(p) : ''}`; return (k ? (c < 0 ? ' − ' : ' + ') : c < 0 ? '−' : '') + t; }).join('') || '0';
G('m-deriv', 'Maths', [1, 2], (r, t) => {
  const a = between(r, 1, 5) * pick(r, [1, -1]), b = between(r, -9, 9), c = between(r, -9, 9), d = between(r, 0, 9), x = between(r, -3, 4);
  const cs = t === 1 ? [[a, 2], [b, 1], [c, 0]] : [[a, 3], [b, 2], [c, 1], [d, 0]];
  const f = (v) => cs.reduce((s, [k, p]) => s + k * v ** p, 0), df = (v) => cs.reduce((s, [k, p]) => s + (p ? k * p * v ** (p - 1) : 0), 0);
  return ask(r, { text: `f(x) = ${poly(cs)}. Combien vaut f′(${x}) ?`, ans: df(x), dec: 0, trap: f(x), others: [df(x) + cs[0][0], df(-x), df(x) * 2], signed: false,
    tip: `f′(x) = ${poly(cs.filter(([, p]) => p).map(([k, p]) => [k * p, p - 1]))}, donc f′(${x}) = ${df(x)}. Le ${f(x)} serait f(${x}).` });
});
G('m-deriv-fn', 'Maths', [2, 3], (r) => {
  const k = between(r, 2, 9), x0 = pick(r, [1, 2, 4, 5, 10]);
  const [text, ans, trap, why] = pick(r, [
    [`f(x) = ${k} ln(x). f′(${x0}) ?`, k / x0, 1 / x0, `(ln x)′ = 1/x : ${k} / ${x0} = ${fr(k / x0)}.`],
    [`f(x) = 1/x. f′(${x0}) ?`, -1 / (x0 * x0), -1 / x0, `(1/x)′ = −1/x² : −1/${x0 * x0} = ${fr(-1 / (x0 * x0), 4)}.`],
    [`f(x) = √x. f′(${x0 * x0}) ?`, 1 / (2 * x0), 1 / x0, `(√x)′ = 1/(2√x) : 1/(2 × ${x0}) = ${fr(1 / (2 * x0), 4)}.`],
    [`f(x) = e^(${k}x). f′(0) ?`, k, 1, `(e^(kx))′ = k e^(kx), qui vaut ${k} en 0.`],
    [`f(x) = x e^x. f′(0) ?`, 1, 0, '(x eˣ)′ = eˣ + x eˣ, qui vaut 1 en 0 (dérivée d\'un produit).'],
    [`f(x) = ln(x² + 1). f′(${x0}) ?`, (2 * x0) / (x0 * x0 + 1), 1 / (x0 * x0 + 1), `(ln u)′ = u′/u : 2x/(x² + 1) = ${2 * x0}/${x0 * x0 + 1} ≈ ${fr((2 * x0) / (x0 * x0 + 1), 3)}.`],
  ]);
  return ask(r, { text, ans, dec: 4, tol: 0.005, trap, others: [ans * 2, -ans, ans + 1], tip: why });
});
G('m-integral', 'Maths', [2, 3], (r) => {
  if (r.next() < 0.3) {
    const k = between(r, 1, 10);
    return ask(r, { text: `Intégrale de e^(−${k}x) entre 0 et l'infini ?`, ans: 1 / k, dec: 4, tol: 0.005, trap: k, others: [1, Math.exp(-k), 2 / k],
      tip: `Une primitive est −e^(−${k}x)/${k} : de 0 à l'infini, 0 − (−1/${k}) = 1/${k}.` });
  }
  const a = between(r, 1, 6), c = between(r, 0, 9), b = pick(r, [1, 2, 3, 4, 5, 6]), ans = (a * b ** 3) / 3 + c * b;
  return ask(r, { text: `Intégrale de ${poly([[a, 2], [c, 0]])} entre 0 et ${b} ?`, ans, dec: 2, tol: 0.002, trap: a * b ** 3 + c * b, others: [a * b * b + c * b, (a * b ** 3) / 2 + c * b, 2 * a * b],
    tip: `Primitive : ${a === 1 ? '' : a}x³/3${c ? ` + ${c}x` : ''}. En ${b} : ${fr((a * b ** 3) / 3)}${c ? ` + ${c * b}` : ''} = ${fr(ans)}. Oublier le « / 3 » donne ${fr(a * b ** 3 + c * b)}.` });
});
G('m-quadratic', 'Maths', [1, 2], (r, t) => {
  const r1 = between(r, -9, 9), r2 = between(r, -9, 9);
  if (r1 === r2) return null;
  const s = r1 + r2, p = r1 * r2, cs = [[1, 2], [-s, 1], [p, 0]], big = Math.max(r1, r2);
  if (t === 1) return ask(r, { text: `${poly(cs)} = 0. Somme des deux solutions ?`, ans: s, dec: 0, trap: -s, others: [p, s + 1, -p],
    tip: `Pour x² − Sx + P = 0, la somme des racines vaut S et leur produit P : ici ${s} (solutions ${r1} et ${r2}).` });
  return ask(r, { text: `${poly(cs)} = 0. Plus grande solution ?`, ans: big, dec: 0, trap: -Math.min(r1, r2), others: [Math.min(r1, r2), -big, s],
    tip: `Somme ${s}, produit ${p} : les solutions sont ${Math.min(r1, r2)} et ${big}. Vérification : (x ${r1 < 0 ? '+' : '−'} ${Math.abs(r1)})(x ${r2 < 0 ? '+' : '−'} ${Math.abs(r2)}).` });
});
G('m-system', 'Maths', [2], (r) => {
  const x = between(r, -6, 9), y = between(r, -6, 9), a = between(r, 1, 5), b = between(r, 1, 5) * pick(r, [1, -1]), c = between(r, 1, 5), d = between(r, 1, 5) * pick(r, [1, -1]);
  if (a * d - b * c === 0 || x === y) return null;
  const e = a * x + b * y, f = c * x + d * y, lhs = (u, v) => `${u === 1 ? '' : u}x ${v < 0 ? '−' : '+'} ${Math.abs(v) === 1 ? '' : Math.abs(v)}y`;
  return ask(r, { text: `${lhs(a, b)} = ${e} et ${lhs(c, d)} = ${f}. Combien vaut x ?`, ans: x, dec: 0, trap: y, others: [-x, x + 1, e - f],
    tip: `Par élimination (ou Cramer) : x = ${x}, y = ${y}. Vérification : ${a} × ${x} + ${b} × ${pn(y, 0)} = ${e}.` });
});
const mat = (rows) => `[ ${rows.map((row) => row.map((v) => fr(v, 0)).join('  ')).join(' ; ')} ]`;
G('m-det', 'Maths', [1, 2, 3], (r, t) => {
  if (t < 3) {
    const [a, b, c, d] = Array.from({ length: 4 }, () => between(r, -6, 9)), ans = a * d - b * c;
    if (b * c === 0) return null;
    return ask(r, { text: `Déterminant de la matrice ${mat([[a, b], [c, d]])} ?`, ans, dec: 0, trap: a * d + b * c, others: [a * c - b * d, a + d, -ans],
      tip: `ad − bc = ${a} × ${pn(d, 0)} − ${b} × ${pn(c, 0)} = ${ans}.` });
  }
  const tri = r.next() < 0.5, v = () => between(r, -3, 4);
  const m = tri ? [[between(r, 1, 5), v(), v()], [0, between(r, 1, 5), v()], [0, 0, between(r, 1, 5)]] : [[v(), v(), v()], [v(), v(), v()], [v(), v(), v()]];
  const pos = [m[0][0] * m[1][1] * m[2][2], m[0][1] * m[1][2] * m[2][0], m[0][2] * m[1][0] * m[2][1]], neg = [m[0][2] * m[1][1] * m[2][0], m[0][0] * m[1][2] * m[2][1], m[0][1] * m[1][0] * m[2][2]];
  const det = pos.reduce((x, y) => x + y, 0) - neg.reduce((x, y) => x + y, 0);
  if (!det) return null;
  return ask(r, { text: `Déterminant de la matrice ${mat(m)} ?`, ans: det, dec: 0, trap: tri ? m[0][0] + m[1][1] + m[2][2] : pos.reduce((x, y) => x + y, 0), others: [-det, det * 2, det + 1],
    tip: tri ? `Matrice triangulaire : le déterminant est le produit de la diagonale, ${m[0][0]} × ${m[1][1]} × ${m[2][2]} = ${det}. La somme de la diagonale, c'est la trace.`
      : `Règle de Sarrus : (${pos.join(' + ')}) − (${neg.join(' + ')}) = ${det}.`.replace(/\+ -/g, '− ') });
});
G('m-eigen', 'Maths', [3], (r) => {
  const a = between(r, 1, 9), b = between(r, 1, 6);
  if (r.next() < 0.5) return ask(r, { text: `Plus grande valeur propre de la matrice ${mat([[a, b], [b, a]])} ?`, ans: a + b, dec: 0, trap: a * a - b * b, others: [a, a - b, 2 * a],
    tip: `Les vecteurs (1, 1) et (1, −1) sont propres : valeurs propres ${a} + ${b} = ${a + b} et ${a} − ${b} = ${a - b}. Leur produit, ${a * a - b * b}, est le déterminant.` });
  const d = between(r, 1, 9), c = between(r, -5, 5);
  if (d === a) return null;
  return ask(r, { text: `Somme des valeurs propres de la matrice ${mat([[a, c], [b, d]])} ?`, ans: a + d, dec: 0, trap: a * d - b * c, others: [a + b + c + d, a * d, d - a],
    tip: `La somme des valeurs propres est la trace (la diagonale) : ${a} + ${d} = ${a + d} ; leur produit est le déterminant, ${a * d - b * c}.` });
});
G('m-matprod', 'Maths', [2], (r) => {
  const A = [[between(r, -3, 5), between(r, -3, 5)], [between(r, -3, 5), between(r, -3, 5)]], B = [[between(r, -3, 5), between(r, -3, 5)], [between(r, -3, 5), between(r, -3, 5)]];
  const i = between(r, 0, 1), j = between(r, 0, 1), ans = A[i][0] * B[0][j] + A[i][1] * B[1][j], trap = A[i][j] * B[i][j];
  if (ans === trap) return null;
  return ask(r, { text: `A = ${mat(A)}, B = ${mat(B)}. Coefficient ligne ${i + 1}, colonne ${j + 1} du produit AB ?`, ans, dec: 0, trap, others: [A[0][i] * B[j][0] + A[1][i] * B[j][1], -ans, ans + 1],
    tip: `Ligne ${i + 1} de A fois colonne ${j + 1} de B : ${A[i][0]} × ${pn(B[0][j], 0)} + ${A[i][1]} × ${pn(B[1][j], 0)} = ${ans}. On ne multiplie pas terme à terme.` });
});
G('m-taylor', 'Maths', [3], (r) => {
  const x = pick(r, [0.01, 0.02, 0.05, 0.1, 0.2]);
  const [text, ans, trap, why] = pick(r, [
    [`exp(${fr(x)}), à 4 décimales près ?`, Math.exp(x), 1 + x, `eˣ ≈ 1 + x + x²/2 = 1 + ${fr(x)} + ${fr((x * x) / 2, 5)} ≈ ${fr(Math.exp(x), 4)}.`],
    [`ln(1 + ${fr(x)}), à 4 décimales près ?`, Math.log(1 + x), x, `ln(1 + x) ≈ x − x²/2 = ${fr(x)} − ${fr((x * x) / 2, 5)} ≈ ${fr(Math.log(1 + x), 4)}.`],
    [`√(1 + ${fr(x)}), à 4 décimales près ?`, Math.sqrt(1 + x), 1 + x, `√(1 + x) ≈ 1 + x/2 − x²/8 ≈ ${fr(Math.sqrt(1 + x), 4)}. Oublier la racine donne ${fr(1 + x)}.`],
    [`1 / (1 − ${fr(x)}), à 4 décimales près ?`, 1 / (1 - x), 1 - x, `1/(1 − x) ≈ 1 + x + x² ≈ ${fr(1 / (1 - x), 4)}.`],
  ]);
  return ask(r, { text, ans, dec: 4, tol: 0.0002, trap, others: [ans + 0.01, ans - 0.01, 1], tip: why });
});
G('m-optim', 'Maths', [2, 3], (r, t) => {
  const a = between(r, 1, 5), q = between(r, 2, 30), b = 2 * a * q, c = 10 * between(r, 0, 20), best = a * q * q - c;
  if (t === 3) return ask(r, { text: `Profit P(q) = −${a === 1 ? '' : a}q² + ${b}q − ${c}. Profit maximal ?`, ans: best, dec: 0, trap: a * q * q * 2 - c, others: [b * q - c, best + c, q],
    tip: `P′(q) = −${2 * a}q + ${b} = 0 en q = ${q}. P(${q}) = −${a * q * q} + ${b * q} − ${c} = ${best}.` });
  return ask(r, { text: `Profit P(q) = −${a === 1 ? '' : a}q² + ${b}q − ${c}. Quelle quantité q le maximise ?`, ans: q, dec: 1, trap: b / a, others: [q * 2, b, q / 2],
    tip: `On annule la dérivée : −${2 * a}q + ${b} = 0, donc q = ${b} / ${2 * a} = ${q}. Le ${fr(b / a)} oublie le 2 de la dérivée.` });
});
G('m-series', 'Maths', [2, 3], (r, t) => {
  if (t === 2) {
    const n = between(r, 4, 12);
    return ask(r, { text: `1 + 2 + 4 + … + 2${sup(n)} ?`, ans: 2 ** (n + 1) - 1, dec: 0, trap: 2 ** n, others: [2 ** (n + 1), 2 ** n - 1, n * 2 ** n],
      tip: `Somme géométrique : 2^(${n}+1) − 1 = ${fr(2 ** (n + 1) - 1)}. Chaque puissance de 2 dépasse d'un la somme de toutes les précédentes.` });
  }
  const a = between(r, 1, 30), [rn, rd] = pick(r, [[1, 2], [1, 3], [1, 4], [2, 3], [3, 4], [9, 10], [1, 5]]), ans = (a * rd) / (rd - rn);
  return ask(r, { text: `${a} + ${a} × ${frac(rn, rd)} + ${a} × (${frac(rn, rd)})² + … jusqu'à l'infini ?`, ans, dec: 2, tol: 0.002, trap: (a * rd) / rn, others: [a * (1 + rn / rd), a / (1 + rn / rd), ans * 2],
    tip: `Série géométrique : a / (1 − r) = ${a} / (1 − ${frac(rn, rd)}) = ${fr(ans)}.` });
});
G('m-log', 'Maths', [1, 2], (r, t) => {
  if (t === 1) {
    const [text, ans, trap, why] = pick(r, [
      ...[3, 4, 5, 6, 7, 8, 9, 10].map((k) => [`log₂(${fr(2 ** k)}) ?`, k, 2 ** k / 2, `2${sup(k)} = ${fr(2 ** k)}, donc log₂ = ${k}.`]),
      ...[2, 3, 4, 5, 6].map((k) => [`log₁₀(${fr(10 ** k)}) ?`, k, 10 ** k / 10, `${fr(10 ** k)} = 10${sup(k)}.`]),
      ...[2, 3, 4, 5].map((k) => [`ln(e${sup(k)}) ?`, k, Math.round(Math.E ** k), `ln et exp sont réciproques : ln(e${sup(k)}) = ${k}.`]),
    ]);
    return ask(r, { text, ans, dec: 0, trap, others: [ans + 1, ans * 2, ans - 1], tip: why });
  }
  const a = between(r, 2, 6), b = between(r, 2, 6);
  return r.next() < 0.5
    ? ask(r, { text: `log₂(${2 ** a}) + log₂(${2 ** b}) ?`, ans: a + b, dec: 0, trap: a * b, others: [2 ** (a + b), a + b + 1, Math.abs(a - b)], tip: `log(xy) = log x + log y : ${a} + ${b} = ${a + b}, soit log₂(${fr(2 ** (a + b))}).` })
    : ask(r, { text: `Si 3^(x + ${a}) = ${fr(3 ** (a + b))}, combien vaut x ?`, ans: b, dec: 0, trap: a + b, others: [b - 1, a * b, a], tip: `${fr(3 ** (a + b))} = 3${sup(a + b)}, donc x + ${a} = ${a + b} et x = ${b}.` });
});
G('m-vector', 'Maths', [1, 2], (r, t) => {
  if (t === 1) {
    const [x, y] = pick(r, [[3, 4], [6, 8], [5, 12], [8, 15], [9, 12], [7, 24], [12, 16]]);
    return ask(r, { text: `Norme du vecteur (${x}, ${y}) ?`, ans: Math.hypot(x, y), dec: 2, trap: x + y, others: [x * y, (x + y) / 2, x * x + y * y],
      tip: `√(${x}² + ${y}²) = √${x * x + y * y} = ${Math.hypot(x, y)} (Pythagore).` });
  }
  const u = [between(r, -4, 6), between(r, -4, 6), between(r, -4, 6)], v = [between(r, -4, 6), between(r, -4, 6), between(r, -4, 6)], ans = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
  return ask(r, { text: `Produit scalaire de (${u.join(', ')}) et (${v.join(', ')}) ?`, ans, dec: 0, trap: u[0] * v[0] + u[1] * v[1], others: [-ans, ans + 1, u.reduce((a, b) => a + b, 0) * v.reduce((a, b) => a + b, 0)],
    tip: `${u.map((x, k) => `${pn(x, 0)} × ${pn(v[k], 0)}`).join(' + ')} = ${ans}. Deux vecteurs sont orthogonaux quand ce produit est nul.` });
});
G('m-arith', 'Maths', [1], (r) => {
  const n = between(r, 10, 200);
  return ask(r, { text: `1 + 2 + 3 + … + ${n} ?`, ans: (n * (n + 1)) / 2, dec: 0, trap: (n * (n - 1)) / 2, others: [(n * n) / 2, n * (n + 1), (n * n) / 2 + 1],
    tip: `n(n + 1)/2 = ${n} × ${n + 1} / 2 = ${fr((n * (n + 1)) / 2)} (on additionne le premier et le dernier, le deuxième et l'avant-dernier…).` });
});
G('m-limit', 'Maths', [3], (r) => {
  const k = pick(r, [1, 2, 3, -1, -2, 0.5]);
  return ask(r, { text: `Limite de (1 ${k < 0 ? '−' : '+'} ${fr(Math.abs(k), 1)}/n)ⁿ quand n tend vers l'infini, à 3 décimales près ?`, ans: Math.exp(k), dec: 3, tol: 0.002, trap: 1, others: [1 + k, Math.E * k, Math.exp(-k)],
    tip: `(1 + k/n)ⁿ tend vers e^k = e^(${fr(k, 1)}) ≈ ${fr(Math.exp(k), 3)}. C'est la capitalisation continue : un taux de ${fr(k * 100, 0)} % composé sans arrêt.` });
});

/* ------------------------------------------------------------ tirage */
export const GEN_CATS = [...new Set(GENS.map((g) => g.cat))];
export const gensFor = (cat, tier) => GENS.filter((g) => g.cat === cat && g.tiers.includes(tier));
// Une question tirée d'un des modèles donnés (quelques essais si un tirage tombe mal) ; dedup : le modèle,
// pour ne pas poser deux fois la même formule dans une partie
export function genQuestion(r, list, tier) {
  for (let k = 0; k < 6 && list.length; k++) {
    const g = pick(r, list), q = g.f(r, tier);
    if (q) return { ...q, cat: g.cat, tier, genId: g.id, dedup: 'gen:' + g.id };
  }
  return null;
}
