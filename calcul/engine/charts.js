// Questions de The Candidate à partir d'un graphique : courbe des taux, profil de gain d'une option, cours d'une action,
// carnet d'ordres, chiffre d'affaires. Tout est tiré de la graine et calculé ici : la bonne réponse, le piège
// (la confusion classique) et l'explication. Les dessins sont faits par view/figure.js (fig.t === 'chart').
const between = (r, a, b) => a + Math.floor(r.next() * (b - a + 1));
const pick = (r, l) => l[Math.floor(r.next() * l.length)];
const dec = (x, n = 1) => (Math.round(x * 10 ** n) / 10 ** n).toFixed(n).replace('.', ',');
const pct = (x, n = 1) => `${dec(x * 100, n)} %`;
const eur = (x) => `${dec(x, 2)} €`;

// 4 choix distincts, mélangés ; renvoie null si deux choix se confondent (le générateur retente)
function qcm(r, good, trap, others) {
  const all = [good, trap, ...others.filter((o) => o !== good && o !== trap)].slice(0, 4);
  if (new Set(all).size !== 4) return null;
  const choices = r.shuffle(all);
  return { choices, answer: choices.indexOf(good), trap: choices.indexOf(trap), show: good };
}

/* ------------------------------------------------------------------ courbe des taux */
const MAT = [1, 2, 5, 10, 30];
function yieldCurve(r, tier) {
  const shape = pick(r, ['pentue', 'inversée', 'plate', 'en bosse']);
  const b = 1.5 + between(r, 0, 25) / 10, s = 0.3 + between(r, 0, 12) / 10;
  const f = { pentue: (k) => b + s * Math.log2(1 + k), inversée: (k) => b + 2.2 * s - s * Math.log2(1 + k), plate: (k) => b + (k % 2 ? 0.03 : -0.02), 'en bosse': (k) => b + s * (k === 2 ? 2 : k === 1 || k === 3 ? 1.3 : k === 4 ? 0.4 : 0) };
  const y = MAT.map((_, k) => Math.round(f[shape](k) * 100) / 100);
  const fig = { t: 'chart', c: 'yc', x: MAT.map((m) => `${m} an${m > 1 ? 's' : ''}`), y };
  if (tier === 1) {
    const traps = { pentue: 'inversée', inversée: 'pentue', plate: 'en bosse', 'en bosse': 'plate' };
    const label = { pentue: 'Normale, pentue', inversée: 'Inversée', plate: 'Plate', 'en bosse': 'En bosse' };
    const res = qcm(r, label[shape], label[traps[shape]], Object.values(label));
    return res && { ...res, rubric: 'Taux', fig, text: 'Comment décrire cette courbe des taux ?',
      tip: { pentue: 'Les taux longs sont plus hauts que les courts : c\'est la forme normale, on exige plus pour prêter longtemps.', inversée: 'Les taux courts dépassent les longs : le marché anticipe des baisses de taux, souvent avant un ralentissement.', plate: 'Les taux sont à peu près les mêmes quelle que soit la maturité.', 'en bosse': 'Les taux montent jusqu\'au milieu de la courbe puis redescendent sur les maturités longues.' }[shape] };
  }
  const spread = Math.round((y[3] - y[1]) * 100);
  const fmtBp = (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)} pb`;
  const res = qcm(r, fmtBp(spread), fmtBp(-spread), [fmtBp(Math.round((y[4] - y[0]) * 100)), fmtBp(spread * 10), fmtBp(Math.round(spread / 2))]);
  return res && { ...res, rubric: 'Taux', fig: { ...fig, labels: true }, text: 'Écart entre le taux à 10 ans et le taux à 2 ans, en points de base ?',
    tip: `${dec(y[3], 2)} % − ${dec(y[1], 2)} % = ${dec(y[3] - y[1], 2)} point, soit ${fmtBp(spread)} (1 point de pourcentage = 100 pb). Un écart négatif signale une courbe inversée.` };
}

/* ------------------------------------------------------------------ profil de gain d'une option, à l'échéance, hors prime */
export const STRATS = {
  'Achat d\'un call': { legs: [['c', 100, 1]], tier: 1, trap: 'Vente d\'un put', why: 'la vente d\'un put monte aussi avec le cours, mais plafonne à zéro au-dessus du strike et perd en dessous' },
  'Achat d\'un put': { legs: [['p', 100, 1]], tier: 1, trap: 'Vente d\'un call', why: 'la vente d\'un call perd quand le cours monte, mais ne gagne jamais rien quand il baisse' },
  'Vente d\'un call': { legs: [['c', 100, -1]], tier: 1, trap: 'Achat d\'un put', why: 'l\'achat d\'un put gagne quand le cours baisse ; ici, on ne gagne jamais, on perd au-dessus du strike' },
  'Vente d\'un put': { legs: [['p', 100, -1]], tier: 1, trap: 'Achat d\'un call', why: 'l\'achat d\'un call gagne au-dessus du strike ; ici, on est à zéro au-dessus et on perd en dessous' },
  'Achat d\'un straddle': { legs: [['c', 100, 1], ['p', 100, 1]], tier: 2, trap: 'Achat d\'un strangle', why: 'le strangle a un fond plat entre deux strikes ; ici, une pointe sur un seul strike' },
  'Vente d\'un straddle': { legs: [['c', 100, -1], ['p', 100, -1]], tier: 2, trap: 'Achat d\'un butterfly', why: 'le butterfly a aussi un sommet au strike central, mais ses pertes sont plafonnées ; ici, elles sont illimitées des deux côtés' },
  'Achat d\'un strangle': { legs: [['p', 80, 1], ['c', 120, 1]], tier: 2, trap: 'Achat d\'un straddle', why: 'le straddle forme une pointe sur un seul strike ; ici, le fond est plat entre deux strikes' },
  'Achat d\'un call spread': { legs: [['c', 80, 1], ['c', 120, -1]], tier: 2, trap: 'Achat d\'un call', why: 'le call seul continue de monter ; ici, le gain est plafonné au second strike' },
  'Achat d\'un put spread': { legs: [['p', 120, 1], ['p', 80, -1]], tier: 2, trap: 'Achat d\'un put', why: 'le put seul continue de gagner à la baisse ; ici, le gain est plafonné sous le strike bas' },
  'Achat d\'un butterfly': { legs: [['c', 80, 1], ['c', 100, -2], ['c', 120, 1]], tier: 3, trap: 'Vente d\'un straddle', why: 'le straddle vendu perd sans limite aux extrémités ; ici, la perte est bornée' },
  'Risk reversal (call acheté, put vendu)': { legs: [['c', 120, 1], ['p', 80, -1]], tier: 3, trap: 'Achat d\'un call spread', why: 'le call spread est plafonné en haut et ne perd jamais ; ici, on gagne sans limite en haut et on perd en bas' },
  'Ratio call spread (1 acheté, 2 vendus)': { legs: [['c', 100, 1], ['c', 120, -2]], tier: 3, trap: 'Achat d\'un call spread', why: 'le call spread reste plat au-dessus du second strike ; ici, le second call vendu fait plonger le gain' },
};
// jambes : call ('c'), put ('p'), ou action ('s', achetée au prix K)
export const payoffAt = (legs, S) => legs.reduce((t, [k, K, q]) => t + q * (k === 'c' ? Math.max(S - K, 0) : k === 'p' ? Math.max(K - S, 0) : S - K), 0);
function payoff(r, tier) {
  // au premier tour, les quatre positions simples ; ensuite, les combinaisons du tour (et parfois celles d'avant)
  const pool = Object.keys(STRATS).filter((n) => STRATS[n].tier === tier || (tier > 1 && STRATS[n].tier === tier - 1 && r.next() < 0.3));
  const name = pick(r, pool.length ? pool : Object.keys(STRATS).filter((n) => STRATS[n].tier === tier));
  const st = STRATS[name];
  const others = r.shuffle(Object.keys(STRATS).filter((n) => n !== name && n !== st.trap));
  const res = qcm(r, name, st.trap, others);
  const K = [...new Set(st.legs.map((l) => l[1]))].sort((a, b) => a - b);
  return res && { ...res, rubric: 'Dérivés', fig: { t: 'chart', c: 'payoff', legs: st.legs, K },
    text: 'Quelle position donne ce profil de gain à l\'échéance (hors prime) ?',
    tip: `${name} : ${st.legs.map(([k, Kx, q]) => `${q > 1 ? q + ' ' + (k === 'c' ? 'calls achetés' : 'puts achetés') : q < -1 ? -q + ' ' + (k === 'c' ? 'calls vendus' : 'puts vendus') : (q > 0 ? 'achat' : 'vente') + ' d\'un ' + (k === 'c' ? 'call' : 'put')} de strike ${Kx}`).join(', ')}. À ne pas confondre avec « ${st.trap} » : ${st.why}.` };
}

/* ------------------------------------------------------------------ cours d'une action */
function prices(r, n) {
  const p = [between(r, 90, 110)];
  for (let k = 1; k < n; k++) p.push(Math.max(40, p[k - 1] + between(r, -18, 18)));
  return p;
}
function maxDrawdown(p) {
  let peak = p[0], dd = 0;
  for (const x of p) { peak = Math.max(peak, x); dd = Math.max(dd, (peak - x) / peak); }
  return dd;
}
function stock(r, tier) {
  for (let tries = 0; tries < 30; tries++) {
    const p = prices(r, 7), fig = { t: 'chart', c: 'line', y: p };
    if (tier === 1) {
      const a = p[0], b = p[6], perf = (b - a) / a;
      if (a === b) continue;
      const sign = (x) => (x > 0 ? '+' : x < 0 ? '−' : '') + pct(Math.abs(x));
      const res = qcm(r, sign(perf), sign((b - a) / b), [sign(-perf), sign((b - a) / 100 + perf / 2)]);
      if (res) return { ...res, rubric: 'Marchés', fig, text: 'Performance de l\'action entre le premier et le dernier point ?',
        tip: `(${b} − ${a}) / ${a} = ${sign(perf)}. On divise toujours par le prix de départ ; diviser par le prix d'arrivée est le piège.` };
      continue;
    }
    const dd = maxDrawdown(p), mx = Math.max(...p), mn = Math.min(...p);
    const naive = (mx - mn) / mx, first = (p[0] - mn) / p[0];
    const trap = Math.abs(naive - dd) > 0.005 ? naive : first;
    if (dd < 0.05 || Math.abs(trap - dd) < 0.005) continue;
    const res = qcm(r, `−${pct(dd)}`, `−${pct(trap)}`, [`−${pct(dd / 2)}`, `−${pct(Math.min(0.95, dd * 1.6))}`]);
    if (res) return { ...res, rubric: 'Marchés', fig, text: 'Baisse maximale depuis un plus haut (max drawdown) ?',
      tip: `On cherche la pire chute depuis le plus haut atteint jusque-là : −${pct(dd)}. Relier le plus haut et le plus bas de toute la période ne marche que si le plus bas vient après.` };
  }
  return null;
}

/* ------------------------------------------------------------------ carnet d'ordres */
function book(r, tier) {
  const tick = pick(r, [0.05, 0.1, 0.5]), mid = between(r, 20, 120);
  const bid = [0, 1, 2, 3].map((k) => Math.round((mid - tick / 2 - k * tick) * 100) / 100);
  const ask = [0, 1, 2, 3].map((k) => Math.round((mid + tick / 2 + k * tick) * 100) / 100);
  const bq = bid.map(() => between(r, 1, 8) * 100), aq = ask.map(() => between(r, 1, 8) * 100);
  const fig = { t: 'chart', c: 'book', bid, ask, bq, aq };
  if (tier === 1) {
    const res = qcm(r, eur(ask[0]), eur(bid[0]), [eur((ask[0] + bid[0]) / 2), eur(ask[1])]);
    return res && { ...res, rubric: 'Marchés', fig, text: 'Tu veux acheter tout de suite. Meilleur prix disponible ?',
      tip: `On achète au meilleur vendeur (ask) : ${eur(ask[0])}. Le meilleur acheteur (bid, ${eur(bid[0])}) est le prix auquel on pourrait vendre.` };
  }
  if (tier === 2) {
    const n = aq[0] + Math.ceil(aq[1] / 200) * 100;
    let left = n, cost = 0;
    for (let k = 0; k < 4 && left > 0; k++) { const take = Math.min(left, aq[k]); cost += take * ask[k]; left -= take; }
    const vwap = cost / n, lastLevel = ask[n > aq[0] + aq[1] ? 2 : 1];
    const res = qcm(r, eur(vwap), eur(ask[0]), [eur(lastLevel), eur((ask[0] + lastLevel) / 2 + tick)]);
    return res && { ...res, rubric: 'Marchés', fig: { ...fig, buy: n }, text: `Prix moyen pour acheter ${n} titres au marché ?`,
      tip: `On vide les meilleurs vendeurs dans l'ordre : ${aq[0]} à ${eur(ask[0])}, puis le reste plus cher. Coût total ${dec(cost, 2)} € / ${n} = ${eur(vwap)}. Le meilleur prix seul ne suffit pas pour un gros ordre.` };
  }
  const m = (ask[0] + bid[0]) / 2, bp = ((ask[0] - bid[0]) / m) * 1e4;
  const res = qcm(r, `${dec(bp, 1)} pb`, `${dec(bp / 2, 1)} pb`, [`${dec(bp * 10, 1)} pb`, `${dec(((ask[3] - bid[0]) / m) * 1e4, 1)} pb`]);
  return res && { ...res, rubric: 'Marchés', fig, text: 'Spread acheteur-vendeur, en points de base du prix milieu ?',
    tip: `(${eur(ask[0])} − ${eur(bid[0])}) / ${eur(m)} = ${dec(bp, 1)} pb. Le demi-spread (${dec(bp / 2, 1)} pb), c'est le coût d'un seul sens de l'aller-retour.` };
}

/* ------------------------------------------------------------------ chiffre d'affaires */
function revenue(r, tier) {
  for (let tries = 0; tries < 40; tries++) {
    const v = [between(r, 20, 60)];
    for (let k = 1; k < 5; k++) v.push(Math.round(v[k - 1] * (1 + between(r, -5, 40) / 100)));
    const fig = { t: 'chart', c: 'bars', y: v, x: ['An 1', 'An 2', 'An 3', 'An 4', 'An 5'] };
    if (tier <= 2) {
      const g = v.slice(1).map((x, k) => (x - v[k]) / v[k]), d = v.slice(1).map((x, k) => x - v[k]);
      const kp = g.indexOf(Math.max(...g)), ka = d.indexOf(Math.max(...d));
      // la plus forte hausse en % doit se voir nettement (3 points d'écart avec les autres années)
      if (kp === ka || g.some((x, k) => k !== kp && g[kp] - x < 0.03)) continue;
      const year = (k) => `An ${k + 2}`;
      const res = qcm(r, year(kp), year(ka), [0, 1, 2, 3].filter((k) => k !== kp && k !== ka).map(year));
      if (res) return { ...res, rubric: 'Corporate', fig, text: 'Quelle année le chiffre d\'affaires progresse-t-il le plus, en pourcentage ?',
        tip: `${year(kp)} : +${pct(g[kp])} (${v[kp]} → ${v[kp + 1]}). ${year(ka)} a la plus forte hausse en euros (+${d[ka]}), mais sur une base plus grande : +${pct(g[ka])}.` };
      continue;
    }
    const cagr = (v[4] / v[0]) ** 0.25 - 1, simple = (v[4] - v[0]) / v[0] / 4, total = (v[4] - v[0]) / v[0];
    if (cagr <= 0.02 || Math.abs(cagr - simple) < 0.006) continue;
    const res = qcm(r, `${pct(cagr)} par an`, `${pct(simple)} par an`, [`${pct(total)} par an`, `${pct(cagr / 2)} par an`]);
    if (res) return { ...res, rubric: 'Corporate', fig, text: 'Croissance annuelle moyenne (TCAM) de l\'an 1 à l\'an 5 ?',
      tip: `(${v[4]} / ${v[0]})^(1/4) − 1 = ${pct(cagr)} : quatre années de croissance composée. Diviser la hausse totale par 4 (${pct(simple)}) oublie la composition.` };
  }
  return null;
}

// Une question de graphique adaptée au tour et au module (null si le tirage n'a rien donné : la banque prend le relais)
const BY_MODULE = { trading: [payoff, payoff, book, stock], ma: [revenue, revenue, stock, yieldCurve], risk: [yieldCurve, stock, stock, payoff], quant: [payoff, stock, book, revenue] };
export function chartQuestion(r, tier, module = 'gen') {
  const list = BY_MODULE[module] || [yieldCurve, payoff, stock, book, revenue];
  for (let tries = 0; tries < 4; tries++) { const q = pick(r, list)(r, tier); if (q) return { ...q, kind: 'chart' }; }
  return null;
}
// probabilité de tirer un graphique, par module
export const CHART_P = { gen: 0.1, trading: 0.18, ma: 0.15, risk: 0.15, quant: 0.1 };
