// The Candidate : raisonnement abstrait, mémoire, attention, et les calculs du sprint du face-à-face.
// Tout est tiré de r (reproductible) ; les dessins sont faits par view/figure.js (fig.t === 'matrix', cellSvg).
const between = (r, a, b) => a + r.int(b - a + 1);
const pick = (r, l) => l[r.int(l.length)];
const eur2 = (x) => x.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fr = (n, d = 2) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR').replace(/[  ]/g, ' ').replace(/^-/, '−');

/* ------------------------------------------------------------ raisonnement abstrait : matrices 3 × 3 */
// Une case : { s: forme, n: nombre (1 à 4), f: remplissage }. Chaque attribut suit une règle sur la grille :
// const (partout pareil), row (pareil sur une ligne), col (pareil dans une colonne), latin (chaque valeur une fois
// par ligne et par colonne, deux sens possibles). La case en bas à droite manque.
export const SHAPES = ['cercle', 'carré', 'triangle', 'losange', 'hexagone'];
export const FILLS = ['vide', 'gris', 'plein'];
const ATTR = { s: 'la forme', n: 'le nombre de figures', f: 'le remplissage' };
export const describeCell = (c) => `${c.n} ${SHAPES[c.s]}${c.n > 1 ? 's' : ''} ${c.f === 1 ? 'gris' : FILLS[c.f] + (c.n > 1 ? 's' : '')}`;
const RULE = {
  const: () => 0,
  row: (i, j) => i,
  col: (i, j) => j,
  latin1: (i, j) => (i + j) % 3,
  latin2: (i, j) => (j - i + 3) % 3,
};
function ruleText(a, rule, vals) {
  const v = (x) => (a === 's' ? SHAPES[x] + 's' : a === 'f' ? FILLS[x] : `${x}`);
  if (rule === 'const') return `${ATTR[a][0].toUpperCase() + ATTR[a].slice(1)} ne change jamais.`;
  if (a === 'n' && (rule === 'row' || rule === 'col') && vals[1] === vals[0] + 1 && vals[2] === vals[1] + 1) return `Le nombre de figures augmente de 1 d'une ${rule === 'col' ? 'colonne' : 'ligne'} à l'autre.`;
  if (rule === 'row') return `Sur chaque ligne, ${ATTR[a]} ne change pas (${vals.map(v).join(', puis ')}).`;
  if (rule === 'col') return `Dans chaque colonne, ${ATTR[a]} ne change pas (${vals.map(v).join(', puis ')}).`;
  return `Pour ${ATTR[a]}, chaque ligne et chaque colonne contient une fois chaque valeur (${vals.map(v).join(', ')}).`;
}
export function abstractMatrix(r, tier) {
  const vals = { s: r.shuffle([0, 1, 2, 3, 4]).slice(0, 3), n: (() => { const b = between(r, 1, 2); return [b, b + 1, b + 2]; })(), f: r.shuffle([0, 1, 2]) };
  if (r.next() < 0.3) vals.n.reverse();
  // règles par tour : deux attributs qui bougent au premier tour, trois ensuite, et des carrés latins au comité
  const attrs = r.shuffle(['s', 'n', 'f']), rules = {};
  if (tier === 1) { const [x, y] = r.shuffle(['row', 'col']); rules[attrs[0]] = x; rules[attrs[1]] = y; rules[attrs[2]] = 'const'; }
  else if (tier === 2) { rules[attrs[0]] = 'latin1'; [rules[attrs[1]], rules[attrs[2]]] = r.shuffle(['row', 'col']); }
  else { rules[attrs[0]] = 'latin1'; rules[attrs[1]] = 'latin2'; rules[attrs[2]] = pick(r, ['row', 'col', 'latin1']); }
  if (rules.n === 'latin1' || rules.n === 'latin2') vals.n = r.shuffle(vals.n);
  const cell = (i, j) => ({ s: vals.s[RULE[rules.s](i, j)], n: vals.n[RULE[rules.n](i, j)], f: vals.f[RULE[rules.f](i, j)] });
  const grid = [0, 1, 2].flatMap((i) => [0, 1, 2].map((j) => cell(i, j))), ans = grid[8];
  const same = (a, b) => a.s === b.s && a.n === b.n && a.f === b.f;
  // les erreurs : un seul attribut faux à chaque fois ; le piège, recopier la case du dessus (ou de gauche)
  const variants = [];
  for (const a of r.shuffle(['s', 'n', 'f'])) {
    const pool = rules[a] === 'const' ? (a === 's' ? [0, 1, 2, 3, 4] : a === 'n' ? [1, 2, 3, 4] : [0, 1, 2]) : vals[a];
    for (const v of r.shuffle(pool.filter((v) => v !== ans[a]))) { variants.push({ ...ans, [a]: v }); break; }
  }
  const trap = [grid[5], grid[7]].find((c) => !same(c, ans)) || variants[0];
  const wrong = [trap];
  for (const v of [...variants, grid[2], grid[6]]) if (!same(v, ans) && !wrong.some((w) => same(w, v)) && wrong.length < 3) wrong.push(v);
  if (wrong.length < 3) return null;
  return { grid: grid.map((c, k) => (k === 8 ? null : c)), good: ans, wrong, trap,
    tip: `${['s', 'n', 'f'].filter((a) => rules[a] !== 'const').map((a) => ruleText(a, rules[a], vals[a])).join(' ')} La case manquante : ${describeCell(ans)}.` };
}

/* ------------------------------------------------------------ mémoire */
const TICKERS = ['AIR', 'BNP', 'CAP', 'DSY', 'KER', 'MC', 'OR', 'SAN', 'TTE', 'GLE', 'ACA', 'RMS', 'SU', 'VIE', 'ENGI', 'ORA'];
const price = (r) => (between(r, 1500, 95000) / 100);
// Une question de mémoire : ce qu'on montre (memo, ms), puis la question une fois l'écran effacé
export function memoryQ(r, tier) {
  const kind = pick(r, tier === 1 ? ['span', 'prices', 'orders'] : ['span', 'prices', 'orders', 'book']);
  if (kind === 'span') {
    const n = [6, 8, 10][tier - 1], back = tier === 3 && r.next() < 0.5;
    const digits = [between(r, 1, 9), ...Array.from({ length: n - 1 }, () => r.int(10))], s = digits.join('');
    const want = back ? [...digits].reverse().join('') : s;
    if (want[0] === '0') return memoryQ(r, tier);
    return { type: 'num', memo: { text: digits.join(' '), ms: 2500 + 300 * n }, text: back ? `Retape ces ${n} chiffres à l'envers, du dernier au premier.` : `Retape les ${n} chiffres affichés, dans l'ordre.`,
      answer: Number(want), traps: back ? [Number(s)] : [], tip: `Il fallait ${want.replace(/(\d{2})(?=\d)/g, '$1 ')}. Astuce : grouper par deux ou trois (« ${s.slice(0, 2)} ${s.slice(2, 4)} ${s.slice(4, 6)}… ») retient bien plus que des chiffres isolés.`, time: 14 + n };
  }
  if (kind === 'prices') {
    const n = [4, 5, 6][tier - 1], ts = r.shuffle([...TICKERS]).slice(0, n), ps = ts.map(() => price(r)), k = r.int(n);
    const show = (x) => `${eur2(x)} €`, good = show(ps[k]), near = show(Math.round((ps[k] + pick(r, [-1, 1]) * between(r, 1, 9) / 10) * 100) / 100);
    const trap = show(ps[(k + 1) % n]), others = ps.filter((_, j) => j !== k && j !== (k + 1) % n).map(show);
    const wrong = [trap, near, ...others, show(price(r)), show(price(r))].filter((w, j, a) => w !== good && a.indexOf(w) === j).slice(0, 3);
    return { type: 'choice', memo: { text: ts.map((t, j) => `${t.padEnd(5, ' ')} ${show(ps[j])}`).join('\n'), ms: 1500 + 1100 * n }, text: `Quel était le cours de ${ts[k]} ?`,
      good, wrong, trap, tip: `${ts[k]} cotait ${good}. ${ts[(k + 1) % n]}, juste à côté, cotait ${trap} : c'est la confusion la plus fréquente.`, time: 16 };
  }
  if (kind === 'orders') {
    const n = [4, 5, 6][tier - 1], ts = r.shuffle([...TICKERS]).slice(0, 3), target = ts[0];
    const orders = Array.from({ length: n }, (_, j) => ({ side: r.next() < 0.6 ? 'ACHAT' : 'VENTE', q: 100 * between(r, 1, 9), t: j < 2 ? target : pick(r, ts) }));
    orders[0].side = 'ACHAT'; r.shuffle(orders);
    const buy = orders.filter((o) => o.t === target && o.side === 'ACHAT').reduce((a, o) => a + o.q, 0), all = orders.filter((o) => o.t === target).reduce((a, o) => a + o.q, 0);
    return { type: 'num', memo: { text: orders.map((o) => `${o.side} ${o.q} ${o.t}`).join('\n'), ms: 2000 + 1300 * n }, text: `Combien de titres ${target} ont été achetés au total ?`,
      answer: buy, unit: 'titres', traps: all !== buy ? [all] : [], tip: `${(() => { const l = orders.filter((o) => o.t === target && o.side === 'ACHAT').map((o) => o.q); return l.length > 1 ? `Les achats de ${target} : ${l.join(' + ')} = ${buy}` : `Un seul achat de ${target}, de ${buy} titres`; })()}.${all !== buy ? ` Compter aussi les ventes donne ${all}.` : ''}`, time: 18 };
  }
  const mid = between(r, 2000, 15000) / 100, tick = pick(r, [0.01, 0.02, 0.05]);
  const bids = [0, 1, 2].map((j) => Math.round((mid - tick * (j + 1)) * 100) / 100), asks = [0, 1, 2].map((j) => Math.round((mid + tick * (j + 1)) * 100) / 100);
  const qty = () => 100 * between(r, 1, 9), askBest = r.next() < 0.5, show = (x) => `${eur2(x)} €`;
  const lines = [2, 1, 0].map((j) => `      VENTE ${qty()} @ ${eur2(asks[j])}`).concat([0, 1, 2].map((j) => `ACHAT ${qty()} @ ${eur2(bids[j])}`));
  const good = show(askBest ? asks[0] : bids[0]), trap = show(askBest ? bids[0] : asks[0]);
  return { type: 'choice', memo: { text: lines.join('\n'), ms: 6000 }, text: askBest ? 'Tu veux acheter tout de suite. Quel était le meilleur prix disponible ?' : 'Tu veux vendre tout de suite. Quel était le meilleur prix disponible ?',
    good, wrong: [trap, show(askBest ? asks[2] : bids[2]), show(mid)], trap, tip: `On ${askBest ? 'achète au meilleur vendeur (le plus bas des prix de vente)' : 'vend au meilleur acheteur (le plus haut des prix d\'achat)'} : ${good}. Le ${trap}, c'est l'autre côté du carnet.`, time: 16 };
}

/* ------------------------------------------------------------ attention */
const ALNUM = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function attentionQ(r, tier) {
  const kind = pick(r, ['diff', 'count', 'filter']);
  if (kind === 'diff') {
    const len = [12, 16, 20][tier - 1], a = Array.from({ length: len }, () => ALNUM[r.int(ALNUM.length)]), b = [...a], k = between(r, 0, 3);
    for (const pos of r.shuffle([...Array(len).keys()]).slice(0, k)) { let c; do { c = ALNUM[r.int(ALNUM.length)]; } while (c === a[pos]); b[pos] = c; }
    const g = (l) => l.join('').replace(/(.{4})(?=.)/g, '$1 ');
    return { type: 'num', copy: `${g(a)}\n${g(b)}`, text: 'Combien de caractères diffèrent entre ces deux lignes ?', answer: k, unit: '', traps: [], time: 12 + len / 2,
      tip: k ? `${k} différence${k > 1 ? 's' : ''} : ${[...Array(len).keys()].filter((p) => a[p] !== b[p]).map((p) => `position ${p + 1} (${a[p]} / ${b[p]})`).join(', ')}. On compare bloc par bloc.` : 'Aucune : les deux lignes sont identiques. Il fallait comparer bloc par bloc.' };
  }
  if (kind === 'count') {
    const len = [30, 40, 50][tier - 1], d = between(r, 1, 9), s = Array.from({ length: len }, () => r.int(10)).join(''), n = [...s].filter((c) => c === String(d)).length;
    return { type: 'num', copy: s.replace(/(.{5})(?=.)/g, '$1 '), text: `Combien de fois le chiffre ${d} apparaît-il ?`, answer: n, unit: 'fois', traps: [], time: 12 + len / 3,
      tip: `${n} fois. On balaie bloc par bloc, sans revenir en arrière, en comptant sur les doigts.` };
  }
  const n = [6, 8, 10][tier - 1], th = pick(r, [300, 400, 500]), orders = Array.from({ length: n }, () => ({ side: r.next() < 0.5 ? 'ACHAT' : 'VENTE', q: 50 * between(r, 2, 16), t: pick(r, TICKERS) }));
  const ok = orders.filter((o) => o.side === 'ACHAT' && o.q > th).length, buys = orders.filter((o) => o.side === 'ACHAT').length;
  return { type: 'num', copy: orders.map((o) => `${o.side} ${o.q} ${o.t}`).join('\n'), text: `Combien d'ordres d'ACHAT de plus de ${th} titres ?`, answer: ok, unit: 'ordres', traps: buys !== ok ? [buys] : [], time: 14 + n,
    tip: `${ok} : ${orders.filter((o) => o.side === 'ACHAT' && o.q > th).map((o) => `${o.q} ${o.t}`).join(', ') || 'aucun'}. Deux filtres à la fois : le sens, puis la taille.${buys !== ok ? ` Il y a ${buys} achats en tout.` : ''}` };
}

/* ------------------------------------------------------------ sprint du face-à-face */
// Des calculs courts, de plus en plus durs ; leur texte s'évalue tel quel (expr.js), ce qui permet à la vue de
// dire tout de suite juste ou faux, sans connaître les réponses.
export const SPRINT_MS = 60000, SPRINT_ITEMS = 45;
export function sprintItems(r) {
  const items = [];
  for (let k = 0; k < SPRINT_ITEMS; k++) {
    const lvl = k < 8 ? 0 : k < 20 ? 1 : 2, op = pick(r, ['+', '−', '×', '÷', '×', '+']);
    let a, b, ans;
    if (op === '+') { a = between(r, [10, 40, 120][lvl], [60, 200, 900][lvl]); b = between(r, [5, 20, 60][lvl], [40, 150, 700][lvl]); ans = a + b; }
    else if (op === '−') { a = between(r, [20, 80, 300][lvl], [90, 400, 1500][lvl]); b = between(r, 5, a - 1); ans = a - b; }
    else if (op === '×') { a = between(r, [2, 6, 11][lvl], [9, 15, 39][lvl]); b = between(r, [2, 3, 6][lvl], [9, 9, 19][lvl]); ans = a * b; }
    else { b = between(r, [2, 3, 6][lvl], [9, 12, 19][lvl]); ans = between(r, [2, 4, 8][lvl], [10, 25, 45][lvl]); a = b * ans; }
    items.push({ text: `${a} ${op} ${b}`, ans });
  }
  return items;
}
