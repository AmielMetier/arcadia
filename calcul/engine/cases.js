// The Candidate : les épreuves qui tiennent sur plusieurs questions.
// - Cas pratique (un par partie au plus) : trois questions liées sur un même dossier (LBO, book d'options, VaR, obligation).
//   Chaque étape rappelle le résultat de la précédente : on peut rater une étape et continuer le dossier.
// - Relance de Pierre : une question, puis « et si… ? » sur la même situation. La relance rapporte un bonus
//   (plein si la première réponse était juste, moitié sinon) et ne coûte jamais de vie.
// - Market making : coter un prix acheteur et vendeur sur la somme de trois dés, trois fois, face à un client informé.
// Fonctions pures, sans DOM : la vue n'affiche que ce qui est décrit ici.

const pick = (r, list) => list[r.int(list.length)];
const fr = (n, d = 2) => (Number.isInteger(n) ? n.toLocaleString('fr-FR') : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR')).replace(/ /g, ' ');

/* ------------------------------------------------------------ cas pratiques */
// chaque cas : params(r) une fois pour tout le dossier, puis steps(p) → 3 étapes { ask, answer, tol, unit, traps, tip }
const CASES = {
  lbo: {
    title: 'Mini-LBO', rubric: 'Corporate',
    params: (r) => ({ E: pick(r, [40, 50, 60, 80]), m: pick(r, [8, 9, 10]), L: pick(r, [4, 5]), g: pick(r, [0.05, 0.08, 0.1]), repay: pick(r, [0.4, 0.5]) }),
    intro: (p) => `Un fonds rachète une société qui fait ${p.E} M€ d'EBITDA, à ${p.m} fois l'EBITDA, financée par ${p.L} fois l'EBITDA de dette.`,
    steps: (p) => {
      const ev = p.E * p.m, debt = p.E * p.L, eq = ev - debt;
      const ev5 = p.E * (1 + p.g) ** 5 * p.m, left = debt * (1 - p.repay), moic = (ev5 - left) / eq;
      return [
        { ask: 'Combien le fonds met-il en equity ?', answer: eq, tol: 0.01, unit: 'M€', traps: [ev],
          tip: `Valeur d'entreprise ${p.E} × ${p.m} = ${fr(ev)} M€, dette ${p.E} × ${p.L} = ${fr(debt)} M€ : equity = ${fr(ev)} − ${fr(debt)} = ${fr(eq)} M€.` },
        { ask: `Equity investie : ${fr(eq)} M€. L'EBITDA croît de ${fr(p.g * 100)} % par an pendant 5 ans, sortie au même multiple. Valeur d'entreprise à la sortie ?`,
          answer: ev5, tol: 0.02, unit: 'M€', traps: [Math.round(p.E * (1 + 5 * p.g) * p.m)],
          tip: `EBITDA à 5 ans : ${p.E} × ${fr(1 + p.g)}⁵ ≈ ${fr(p.E * (1 + p.g) ** 5, 1)} M€ (croissance composée, pas ${fr(p.E * (1 + 5 * p.g), 1)}). Fois ${p.m} : ≈ ${fr(ev5, 0)} M€.` },
        { ask: `Valeur de sortie ≈ ${fr(ev5, 0)} M€. ${fr(p.repay * 100)} % de la dette a été remboursée. Quel multiple de l'equity (MOIC) ?`,
          answer: moic, tol: 0.03, unit: '×', traps: [ev5 / eq],
          tip: `Dette restante : ${fr(debt)} × ${fr(1 - p.repay)} = ${fr(left)} M€. Equity de sortie : ${fr(ev5, 0)} − ${fr(left)} ≈ ${fr(ev5 - left, 0)} M€. MOIC = ${fr(ev5 - left, 0)} / ${fr(eq)} ≈ ${fr(moic)}×. L'effet de levier vient du remboursement de la dette.` },
      ];
    },
  },
  book: {
    title: 'Book d\'options', rubric: 'Dérivés',
    params: (r) => ({ N: pick(r, [10000, 20000, 50000]), d: pick(r, [0.4, 0.5, 0.6]), gm: pick(r, [0.02, 0.03, 0.05]), S: pick(r, [50, 80, 100]), dS: pick(r, [2, 3, 5]) }),
    intro: (p) => `Tu es long ${fr(p.N)} calls sur une action à ${p.S} € (une action par call). Delta d'un call : ${fr(p.d)}.`,
    steps: (p) => {
      const h = p.N * p.d, d2 = p.d + p.gm * p.dS, add = p.N * p.gm * p.dS;
      return [
        { ask: 'Combien d\'actions vendre pour être delta-neutre ?', answer: h, tol: 0.01, unit: 'actions', traps: [p.N],
          tip: `Delta du book : ${fr(p.N)} × ${fr(p.d)} = ${fr(h)} actions. On en vend autant.` },
        { ask: `Tu as vendu ${fr(h)} actions. L'action monte de ${p.dS} €, le gamma d'un call vaut ${fr(p.gm)}. Nouveau delta d'un call ?`,
          answer: d2, tol: 0.01, unit: '', traps: [p.d],
          tip: `Delta ≈ ${fr(p.d)} + gamma × ΔS = ${fr(p.d)} + ${fr(p.gm)} × ${p.dS} = ${fr(d2)}.` },
        { ask: `Delta d'un call : ${fr(d2)}. Combien d'actions de plus faut-il vendre pour redevenir neutre ?`, answer: add, tol: 0.02, unit: 'actions', traps: [p.N * d2],
          tip: `Nouveau delta du book : ${fr(p.N)} × ${fr(d2)} = ${fr(p.N * d2)}. Déjà vendu ${fr(h)} : il en manque ${fr(add)}. Long gamma, on vend quand ça monte : c'est le gamma scalping.` },
      ];
    },
  },
  var: {
    title: 'VaR d\'un portefeuille', rubric: 'Risques',
    params: (r) => ({ V: pick(r, [10, 20, 50]), s: pick(r, [0.01, 0.015, 0.02]), rho: pick(r, [0, 0.5]) }),
    intro: (p) => `Un portefeuille de ${p.V} M€ a une volatilité quotidienne de ${fr(p.s * 100, 1)} %. On suppose les rendements normaux.`,
    steps: (p) => {
      const v1 = p.V * p.s * 2.33, v10 = v1 * Math.sqrt(10), tot = v1 * Math.sqrt(2 + 2 * p.rho);
      return [
        { ask: 'VaR à 1 jour à 99 % (z = 2,33) ?', answer: v1, tol: 0.02, unit: 'M€', traps: [p.V * p.s * 1.65],
          tip: `${p.V} × ${fr(p.s * 100, 1)} % × 2,33 = ${fr(v1)} M€. Le 1,65 donne la VaR à 95 %.` },
        { ask: `VaR à 1 jour : ${fr(v1)} M€. VaR à 10 jours, par la règle de la racine du temps ?`, answer: v10, tol: 0.02, unit: 'M€', traps: [v1 * 10],
          tip: `On multiplie par √10 ≈ 3,16 : ${fr(v1)} × 3,16 ≈ ${fr(v10)} M€. Les variances s'additionnent, pas les écarts-types.` },
        { ask: `On ajoute un second portefeuille identique, corrélation ${fr(p.rho)} avec le premier. VaR à 1 jour à 99 % de l'ensemble ?`,
          answer: tot, tol: 0.02, unit: 'M€', traps: [2 * v1],
          tip: `VaR totale = ${fr(v1)} × √(1 + 1 + 2 × ${fr(p.rho)}) = ${fr(v1)} × ${fr(Math.sqrt(2 + 2 * p.rho))} ≈ ${fr(tot)} M€. Moins que ${fr(2 * v1)} : c'est la diversification.` },
      ];
    },
  },
  bond: {
    title: 'Couverture d\'une obligation', rubric: 'Taux',
    params: (r) => ({ N: pick(r, [10, 20, 50]), D: pick(r, [4, 6, 8]), bp: pick(r, [25, 50, 100]), dv: pick(r, [80, 100, 120]) }),
    intro: (p) => `Tu détiens ${p.N} M€ d'une obligation au pair, de duration modifiée ${p.D}.`,
    steps: (p) => {
      const pct = p.D * p.bp / 100, loss = p.N * 1e6 * pct / 100, dv01 = p.N * 1e6 * p.D / 10000, k = dv01 / p.dv;
      return [
        { ask: `Les taux montent de ${p.bp} points de base. De combien baisse le prix, en % ?`, answer: pct, tol: 0.01, unit: '%', traps: [p.bp / 100],
          tip: `Variation ≈ − duration × Δtaux = − ${p.D} × ${fr(p.bp / 100)} % = − ${fr(pct)} %.` },
        { ask: `Le prix baisse de ${fr(pct)} %. Perte sur ta position ?`, answer: loss, tol: 0.01, unit: '€', traps: [loss * 10],
          tip: `${p.N} M€ × ${fr(pct)} % = ${fr(loss)} €.` },
        { ask: `Ta sensibilité est de ${fr(dv01)} € par point de base. Un contrat future a un DV01 de ${p.dv} €. Combien de contrats vendre pour couvrir ?`,
          answer: k, tol: 0.03, unit: 'contrats', traps: [dv01 / p.dv / p.D],
          tip: `DV01 de la position : ${p.N} M€ × ${p.D} × 0,01 % = ${fr(dv01)} €. ${fr(dv01)} / ${p.dv} ≈ ${fr(k, 1)} contrats.` },
      ];
    },
  },
};
const CASE_BY_MODULE = { gen: ['lbo', 'book', 'var', 'bond'], trading: ['book', 'bond', 'var'], ma: ['lbo'], quant: ['book', 'var'], risk: ['var', 'bond'] };

// Étape step (0, 1, 2) du cas tiré avec r (même r pour les trois étapes : même dossier)
export function caseStep(r, step, module = 'gen') {
  const key = pick(r, CASE_BY_MODULE[module] || CASE_BY_MODULE.gen), C = CASES[key], p = C.params(r), S = C.steps(p)[step];
  return { caseKey: key, title: C.title, rubric: C.rubric,
    text: `${C.intro(p)} ${S.ask}`, answer: Number(S.answer.toPrecision(4)), tol: S.tol, unit: S.unit, traps: S.traps.filter((t) => Math.abs(t - S.answer) > S.tol * Math.abs(S.answer) * 2), tip: S.tip };
}
export const CASE_KEYS = Object.keys(CASES);

/* ------------------------------------------------------------ relances de Pierre */
// une question, puis la même situation modifiée : « et si… ? »
const RELANCES = [
  { cat: 'Dérivés', q: 'Un call à la monnaie vaut 4 € quand la volatilité est de 20 %. Prix approximatif si la volatilité passe à 30 % ?', a: 6, tol: 0.05, unit: '€',
    tip: 'À la monnaie, le prix est presque proportionnel à la vol : 4 × 30/20 = 6 €.',
    then: { q: 'Et si, au lieu de la vol, c\'est la maturité qui est multipliée par 4 ?', a: 8, tol: 0.05, unit: '€', tip: 'Le prix à la monnaie suit σ√T : maturité × 4 → prix × √4 = × 2, soit 8 €.' } },
  { cat: 'Probas', q: 'On lance deux dés. Probabilité que la somme fasse 7, en % ?', a: 100 / 6, tol: 0.02, unit: '%',
    tip: '6 combinaisons sur 36 : 1/6 ≈ 16,7 %.',
    then: { q: 'Et si on sait qu\'au moins un des deux dés montre 3 ?', a: 2 / 11 * 100, tol: 0.02, unit: '%', tip: '11 tirages contiennent au moins un 3 ; deux font 7 (3-4 et 4-3) : 2/11 ≈ 18,2 %.' } },
  { cat: 'Taux', q: 'Une obligation de duration modifiée 5 : les taux montent de 1 %. Variation de prix, en % ?', a: -5, tol: 0.02, unit: '%',
    tip: '− duration × Δtaux = − 5 × 1 % = − 5 %.',
    then: { q: 'Et si les taux montent de 3 % et que la convexité vaut 40 ?', a: -13.2, tol: 0.03, unit: '%', tip: '− 5 × 3 % + ½ × 40 × (3 %)² = − 15 % + 1,8 % = − 13,2 %. La convexité amortit la baisse.' } },
  { cat: 'Calcul', q: 'Un placement rapporte 7 % par an. En combien d\'années double-t-il (règle de 72) ?', a: 72 / 7, tol: 0.04, unit: 'ans',
    tip: '72 / 7 ≈ 10,3 ans.',
    then: { q: 'Et pour le multiplier par 8 ?', a: 3 * 72 / 7, tol: 0.04, unit: 'ans', tip: '× 8, c\'est trois doublements : 3 × 10,3 ≈ 30,9 ans.' } },
  { cat: 'Probas', q: 'Une pièce est lancée 3 fois. Probabilité d\'obtenir au moins un pile, en % ?', a: 87.5, tol: 0.01, unit: '%',
    tip: '1 − (1/2)³ = 7/8 = 87,5 %.',
    then: { q: 'Et combien de lancers faut-il au minimum pour dépasser 99 % ?', a: 7, tol: 0, unit: 'lancers', tip: '1 − (1/2)ⁿ > 0,99 ⇔ 2ⁿ > 100 ⇔ n = 7 (2⁷ = 128).' } },
  { cat: 'Corporate', q: 'Une société vaut 10 fois son EBITDA de 50 M€ et a 200 M€ de dette nette. Valeur des fonds propres ?', a: 300, tol: 0.01, unit: 'M€',
    tip: '10 × 50 = 500 M€ de valeur d\'entreprise, moins 200 M€ de dette : 300 M€.',
    then: { q: 'Et si le multiple baisse à 8 ?', a: 200, tol: 0.01, unit: 'M€', tip: '8 × 50 = 400 − 200 = 200 M€ : le multiple perd 20 %, les fonds propres un tiers. C\'est le levier.' } },
  { cat: 'Marchés', q: 'Tu achètes 1 000 actions à 50 € avec 50 % de marge. L\'action monte de 10 %. Rendement sur ta mise, en % ?', a: 20, tol: 0.01, unit: '%',
    tip: 'Mise de 25 000 €, gain de 5 000 € : 20 %.',
    then: { q: 'Et si l\'action baisse de 10 % ?', a: -20, tol: 0.01, unit: '%', tip: 'Même levier dans l\'autre sens : − 5 000 € sur 25 000 €, soit − 20 %.' } },
  { cat: 'Dérivés', q: 'Spot 100, taux 5 %, pas de dividende. Prix du forward à un an ?', a: 105, tol: 0.005, unit: '',
    tip: 'F = S × (1 + r) = 105 (en continu, 100 × e^0,05 ≈ 105,1).',
    then: { q: 'Et si l\'action verse un dividende de 3 dans l\'année ?', a: 102, tol: 0.005, unit: '', tip: 'On retire le dividende : 105 − 3 = 102.' } },
  { cat: 'Calcul', q: 'Une action fait − 50 % puis + 50 %. Variation totale, en % ?', a: -25, tol: 0, unit: '%',
    tip: '0,5 × 1,5 = 0,75 : − 25 %.',
    then: { q: 'Et si elle fait + 50 % d\'abord, puis − 50 % ?', a: -25, tol: 0, unit: '%', tip: '1,5 × 0,5 = 0,75 : toujours − 25 %. L\'ordre ne change rien à un produit.' } },
  { cat: 'Probas', q: 'Espérance du lancer d\'un dé à 6 faces ?', a: 3.5, tol: 0, unit: '',
    tip: '(1 + 2 + … + 6) / 6 = 21 / 6 = 3,5.',
    then: { q: 'Et si tu peux relancer une fois, en gardant le second lancer ?', a: 4.25, tol: 0.01, unit: '', tip: 'On relance sur 1, 2 ou 3 (moins que 3,5) : ½ × 5 + ½ × 3,5 = 4,25.' } },
  { cat: 'Macro', q: 'Inflation 2 %, taux nominal 5 %. Taux réel approximatif, en % ?', a: 3, tol: 0, unit: '%',
    tip: 'Fisher : réel ≈ nominal − inflation = 3 %.',
    then: { q: 'Et si l\'inflation grimpe à 8 % sans que la banque centrale bouge ?', a: -3, tol: 0, unit: '%', tip: '5 − 8 = − 3 % : le taux réel devient négatif, la politique monétaire est très accommodante.' } },
  { cat: 'Risques', q: 'Un portefeuille de 100 M€ a une VaR à 1 jour de 2 M€. VaR à 4 jours ?', a: 4, tol: 0.01, unit: 'M€',
    tip: 'Racine du temps : 2 × √4 = 4 M€.',
    then: { q: 'Et à 25 jours ?', a: 10, tol: 0.01, unit: 'M€', tip: '2 × √25 = 10 M€ (et non 50 : les risques ne s\'additionnent pas jour après jour).' } },
  { cat: 'Logique', q: 'Il faut 5 machines 5 minutes pour faire 5 pièces. Combien de minutes pour 100 machines et 100 pièces ?', a: 5, tol: 0, unit: 'min',
    tip: 'Une machine fait une pièce en 5 minutes : 100 machines font 100 pièces en 5 minutes.',
    then: { q: 'Et combien de machines pour faire 300 pièces en 15 minutes ?', a: 100, tol: 0, unit: 'machines', tip: 'Une machine fait 3 pièces en 15 minutes : 300 / 3 = 100 machines.' } },
  { cat: 'Dérivés', q: 'Un call coûte 10, le put de même strike et maturité 6. Spot 100, strike 100, taux nuls. L\'écart call − put vaut ?', a: 4, tol: 0, unit: '',
    tip: '10 − 6 = 4. Mais la parité call-put dit C − P = S − K = 0 : il y a un arbitrage.',
    then: { q: 'Quel profit sans risque fais-tu par lot en vendant le call, achetant le put et l\'action ?', a: 4, tol: 0, unit: '', tip: '+10 − 6 − 100 = − 96 à l\'entrée ; à l\'échéance, la position vaut toujours 100 : profit de 4.' } },
  { cat: 'Calcul', q: 'Combien font 15 % de 80 ?', a: 12, tol: 0, unit: '',
    tip: '10 % = 8, 5 % = 4 : 12.',
    then: { q: 'Et 80 % de 15 ?', a: 12, tol: 0, unit: '', tip: 'x % de y = y % de x : toujours 12.' } },
  { cat: 'Marchés', q: 'EUR/USD à 1,10. Combien de dollars pour 1 000 € ?', a: 1100, tol: 0, unit: '$',
    tip: '1 000 × 1,10 = 1 100 $.',
    then: { q: 'Et si l\'euro perd 10 % face au dollar ?', a: 990, tol: 0.001, unit: '$', tip: '1,10 × 0,9 = 0,99 : 1 000 € valent 990 $.' } },
];
export const RELANCE_COUNT = RELANCES.length;
// Étape 0 : la question ; étape 1 : la relance (même tirage r)
export function relanceStep(r, step) {
  const R = pick(r, RELANCES), S = step ? R.then : R;
  return { rubric: R.cat, text: step ? `« ${R.q} » Réponse : ${fr(Number(R.a.toPrecision(4)), 1)}${R.unit ? ' ' + R.unit : ''}. ${S.q}` : R.q, answer: Number(S.a.toPrecision(4)), tol: S.tol, unit: S.unit, tip: S.tip };
}
export const RELANCES_ALL = RELANCES;

/* ------------------------------------------------------------ market making */
// La valeur à coter : la somme de trois dés, dévoilés un par un. Trois cotations (avant le premier dé, après le premier,
// après le deuxième), puis on solde la position à la valeur finale. Le client a sa propre idée du prix : l'espérance
// sachant les dés déjà vus, à 3 près. S'il pense que ton prix vendeur est trop bas, il t'achète 2 lots ; si ton prix acheteur est trop haut, il te vend 2 lots.
// Une fourchette trop large (ou à l'envers) : pas de deal, et Pierre te retire 2 points.
export const MM_ROUNDS = 3, MM_LOT = 2, MM_WIDE_PENALTY = 2;
export const MM_MAX_SPREAD = [4, 3, 2];
export const MM_TIME = 75;
export function makeMarket(r) {
  const dice = [1, 2, 3].map(() => 1 + r.int(6));
  const noise = [0, 1, 2].map(() => r.int(7) - 3);
  return { dice, noise };
}
// « 9.5/12.5;10/12;… » → [[9.5, 12.5], …] (au plus 3 cotations)
export function parseQuotes(raw) {
  return String(raw || '').split(';').slice(0, MM_ROUNDS).map((x) => x.split('/').map((v) => Number(String(v).replace(',', '.')))).filter((x) => x.length === 2 && x.every(Number.isFinite));
}
// Déroulé complet : les transactions de chaque tour, la position, et le P&L une fois la valeur dévoilée
export function runMarket(m, quotes) {
  const V = m.dice.reduce((a, b) => a + b, 0);
  let pos = 0, cash = 0, pen = 0;
  const log = [];
  for (let k = 0; k < MM_ROUNDS; k++) {
    const q = quotes[k];
    if (!q) { pen += MM_WIDE_PENALTY; log.push({ k, kind: 'none' }); continue; }
    const [bid, ask] = q;
    if (!(ask > bid) || ask - bid > MM_MAX_SPREAD[k] + 1e-9) { pen += MM_WIDE_PENALTY; log.push({ k, bid, ask, kind: 'wide' }); continue; }
    const c = mmFair(m, k) + m.noise[k];
    if (c > ask) { pos -= MM_LOT; cash += MM_LOT * ask; log.push({ k, bid, ask, kind: 'buy' }); } // le client achète : tu vends
    else if (c < bid) { pos += MM_LOT; cash -= MM_LOT * bid; log.push({ k, bid, ask, kind: 'sell' }); } // le client vend : tu achètes
    else log.push({ k, bid, ask, kind: 'pass' });
  }
  const pnl = Math.round((cash + pos * V - pen) * 100) / 100;
  return { V, pos, pnl, pen, log };
}
// Juste milieu : espérance de la somme sachant les dés déjà vus
export const mmFair = (m, k) => m.dice.slice(0, k).reduce((a, b) => a + b, 0) + 3.5 * (MM_ROUNDS - k);
