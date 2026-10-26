// The Candidate : les épreuves qui tiennent sur plusieurs questions.
// - Cas pratique (un par partie au plus) : trois questions liées sur un même dossier (LBO, book d'options, VaR, obligation,
//   valorisation par les flux, swap, couverture de change, rachat en actions, prêt, straddle), aux chiffres tirés à chaque partie.
//   Chaque étape rappelle le résultat de la précédente : on peut rater une étape et continuer le dossier.
// - Relance de Pierre : une question, puis « et si… ? » sur la même situation. La relance rapporte un bonus
//   (plein si la première réponse était juste, moitié sinon) et ne coûte jamais de vie.
// - Market making : coter un prix acheteur et vendeur sur la somme de trois dés, trois fois, face à un client informé.
// Fonctions pures, sans DOM : la vue n'affiche que ce qui est décrit ici.

const pick = (r, list) => list[r.int(list.length)];
const fr = (n, d = 2) => (Number.isInteger(n) ? n.toLocaleString('fr-FR') : (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('fr-FR')).replace(/ /g, ' ').replace(/^-/, '−');

/* ------------------------------------------------------------ cas pratiques */
// chaque cas : params(r) une fois pour tout le dossier, puis steps(p) → 3 étapes { ask, answer, tol, unit, traps, tip }
const sg = (n, d = 2) => (n > 0 ? '+' : '') + fr(n, d);
const CASES = {
  lbo: {
    title: 'Mini-LBO', rubric: 'Corporate',
    params: (r) => { const m = pick(r, [6, 7, 8, 9, 10, 11, 12]); return { E: pick(r, [30, 40, 50, 60, 75, 80, 100, 120]), m, L: pick(r, [3, 4, 5, 6].filter((x) => x < m - 1)), g: pick(r, [0.03, 0.05, 0.08, 0.1, 0.12]), repay: pick(r, [0.3, 0.4, 0.5, 0.6]) }; },
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
    params: (r) => ({ N: pick(r, [5000, 10000, 20000, 25000, 50000]), d: pick(r, [0.3, 0.4, 0.45, 0.5, 0.55, 0.6, 0.7]), gm: pick(r, [0.01, 0.02, 0.025, 0.03, 0.04, 0.05]), S: pick(r, [40, 50, 80, 100, 120]), dS: pick(r, [1, 2, 3, 4, 5, 6]) }),
    intro: (p) => `Tu es long ${fr(p.N)} calls sur une action à ${p.S} € (une action par call). Delta d'un call : ${fr(p.d)}.`,
    steps: (p) => {
      const h = p.N * p.d, d2 = p.d + p.gm * p.dS, add = p.N * p.gm * p.dS;
      return [
        { ask: 'Combien d\'actions vendre pour être delta-neutre ?', answer: h, tol: 0.01, unit: 'actions', traps: [p.N],
          tip: `Delta du book : ${fr(p.N)} × ${fr(p.d)} = ${fr(h)} actions. On en vend autant.` },
        { ask: `Tu as vendu ${fr(h)} actions. L'action monte de ${p.dS} €, le gamma d'un call vaut ${fr(p.gm, 3)}. Nouveau delta d'un call ?`,
          answer: d2, tol: 0.01, unit: '', traps: [p.d],
          tip: `Delta ≈ ${fr(p.d)} + gamma × ΔS = ${fr(p.d)} + ${fr(p.gm, 3)} × ${p.dS} = ${fr(d2, 3)}.` },
        { ask: `Delta d'un call : ${fr(d2, 3)}. Combien d'actions de plus faut-il vendre pour redevenir neutre ?`, answer: add, tol: 0.02, unit: 'actions', traps: [p.N * d2],
          tip: `Nouveau delta du book : ${fr(p.N)} × ${fr(d2, 3)} = ${fr(p.N * d2)}. Déjà vendu ${fr(h)} : il en manque ${fr(add)}. Long gamma, on vend quand ça monte : c'est le gamma scalping.` },
      ];
    },
  },
  var: {
    title: 'VaR d\'un portefeuille', rubric: 'Risques',
    params: (r) => ({ V: pick(r, [5, 10, 20, 25, 50, 100]), s: pick(r, [0.005, 0.01, 0.015, 0.02, 0.025]), rho: pick(r, [-0.5, 0, 0.25, 0.5, 0.75]) }),
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
          tip: `VaR totale = ${fr(v1)} × √(1 + 1 + 2 × ${p.rho < 0 ? `(${fr(p.rho)})` : fr(p.rho)}) = ${fr(v1)} × ${fr(Math.sqrt(2 + 2 * p.rho))} ≈ ${fr(tot)} M€. Moins que ${fr(2 * v1)} : c'est la diversification.` },
      ];
    },
  },
  bond: {
    title: 'Couverture d\'une obligation', rubric: 'Taux',
    params: (r) => ({ N: pick(r, [5, 10, 20, 25, 50, 100]), D: pick(r, [2, 3, 4, 5, 6, 7, 8, 9, 10]), bp: pick(r, [10, 25, 50, 75, 100, 150]), dv: pick(r, [50, 60, 80, 100, 120, 150]) }),
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
  dcf: {
    title: 'Valorisation par les flux', rubric: 'Corporate',
    params: (r) => { const w = pick(r, [7, 8, 9, 10, 11]), g = pick(r, [1, 1.5, 2, 2.5, 3]), F = pick(r, [20, 30, 40, 50, 60, 80, 100]), ev = (F * 100) / (w - g);
      return { F, w, g, ND: 50 * Math.max(1, Math.floor((ev * pick(r, [0.2, 0.3, 0.4, 0.5])) / 50)), n: pick(r, [10, 20, 25, 40, 50]) }; },
    intro: (p) => `Une société dégagera ${p.F} M€ de free cash flow l'an prochain, en croissance de ${fr(p.g, 1)} % par an pour toujours. Son coût du capital (WACC) est de ${p.w} %.`,
    steps: (p) => {
      const ev = (p.F * 100) / (p.w - p.g), eq = ev - p.ND, ps = eq / p.n;
      return [
        { ask: 'Valeur d\'entreprise, par la formule de Gordon ?', answer: ev, tol: 0.01, unit: 'M€', traps: [(p.F * 100) / p.w],
          tip: `VE = flux / (WACC − g) = ${p.F} / (${p.w} % − ${fr(p.g, 1)} %) = ${fr(ev, 1)} M€. Oublier la croissance donne ${fr((p.F * 100) / p.w, 1)} M€.` },
        { ask: `Valeur d'entreprise ≈ ${fr(ev, 0)} M€. La dette nette est de ${fr(p.ND)} M€. Valeur des fonds propres ?`, answer: eq, tol: 0.01, unit: 'M€', traps: [ev + p.ND],
          tip: `Fonds propres = VE − dette nette = ${fr(ev, 0)} − ${fr(p.ND)} ≈ ${fr(eq, 0)} M€. La dette appartient aux prêteurs, pas aux actionnaires.` },
        { ask: `Fonds propres ≈ ${fr(eq, 0)} M€, ${p.n} millions d'actions. Valeur par action ?`, answer: ps, tol: 0.01, unit: '€', traps: [ev / p.n],
          tip: `${fr(eq, 0)} / ${p.n} ≈ ${fr(ps)} € par action. Diviser la valeur d'entreprise (${fr(ev / p.n)} €) compterait la dette comme aux actionnaires.` },
      ];
    },
  },
  swap: {
    title: 'Swap de taux', rubric: 'Taux',
    params: (r) => { const K = pick(r, [2, 2.5, 3, 3.5, 4]); return { N: pick(r, [10, 20, 50, 100]), K, e: K + pick(r, [-1, -0.5, 0.5, 1, 1.5]), K2: K + pick(r, [-1, -0.5, 0.5, 1]), n: pick(r, [3, 4, 5]) }; },
    intro: (p) => `Tu signes un swap de ${p.N} M€ sur ${p.n + 1} ans : tu paies un taux fixe de ${fr(p.K, 1)} % et tu reçois l'Euribor 12 mois, une fois par an.`,
    steps: (p) => {
      const flow = (p.N * 1e6 * (p.e - p.K)) / 100, gain = (p.N * 1e6 * (p.K2 - p.K)) / 100;
      const A = Array.from({ length: p.n }, (_, t) => 1 / (1 + p.K2 / 100) ** (t + 1)).reduce((a, b) => a + b, 0), val = gain * Math.round(A * 100) / 100;
      return [
        { ask: `L'Euribor est constaté à ${fr(p.e, 1)} %. Flux net de la première année, pour toi ?`, answer: flow, tol: 0.005, unit: '€', traps: [-flow],
          tip: `Tu reçois ${fr(p.e, 1)} %, tu paies ${fr(p.K, 1)} % : ${sg(p.e - p.K, 1)} % × ${p.N} M€ = ${sg(flow, 0)} €.` },
        { ask: `Flux net de la première année : ${sg(flow, 0)} €. Un an plus tard, un swap neuf de même échéance se traite à ${fr(p.K2, 1)} %. Chaque année restante, combien gagnes-tu (ou perds-tu) à avoir signé à ${fr(p.K, 1)} % ?`,
          answer: gain, tol: 0.005, unit: '€', traps: [-gain],
          tip: `Payer ${fr(p.K, 1)} % quand le marché demande ${fr(p.K2, 1)} % : ${sg(p.K2 - p.K, 1)} % × ${p.N} M€ = ${sg(gain, 0)} € par an. Payeur du fixe, on gagne quand les taux montent.` },
        { ask: `Avantage de ${sg(gain, 0)} € par an pendant ${p.n} ans. La somme des facteurs d'actualisation sur ces ${p.n} ans vaut ${fr(A)}. Valeur du swap pour toi ?`,
          answer: val, tol: 0.01, unit: '€', traps: [gain * p.n],
          tip: `${sg(gain, 0)} × ${fr(A)} ≈ ${sg(val, 0)} €. Sans actualiser, on trouverait ${sg(gain * p.n, 0)} € : un euro dans ${p.n} ans vaut moins qu'aujourd'hui.` },
      ];
    },
  },
  fxhedge: {
    title: 'Couverture de change', rubric: 'Marchés',
    params: (r) => { const rU = pick(r, [3, 4, 5]); return { U: pick(r, [1, 2, 5, 10, 20]) * 1e6, S: pick(r, [1.05, 1.08, 1.1, 1.12, 1.15, 1.2]), rU, rE: pick(r, [1, 2, 3].filter((x) => x < rU)), S2: pick(r, [1.0, 1.05, 1.1, 1.15, 1.2, 1.25]) }; },
    intro: (p) => `Une entreprise française recevra ${fr(p.U)} dollars dans un an. EUR/USD vaut ${fr(p.S, 4)} au comptant ; les taux à un an sont de ${p.rU} % sur le dollar et ${p.rE} % sur l'euro.`,
    steps: (p) => {
      const F = (p.S * (1 + p.rU / 100)) / (1 + p.rE / 100), Fr = Math.round(F * 1e4) / 1e4, eur = p.U / Fr, open = p.U / p.S2;
      return [
        { ask: 'Cours à terme EUR/USD à un an ?', answer: F, tol: 0.001, unit: '', traps: [(p.S * (1 + p.rE / 100)) / (1 + p.rU / 100)],
          tip: `F = S × (1 + r$) / (1 + r€) = ${fr(p.S, 4)} × ${fr(1 + p.rU / 100)} / ${fr(1 + p.rE / 100)} ≈ ${fr(F, 4)}. Le dollar rapporte plus : il cote moins cher à terme.` },
        { ask: `Cours à terme : ${fr(Fr, 4)}. Combien d'euros l'entreprise touchera-t-elle si elle vend ses dollars à terme ?`, answer: eur, tol: 0.005, unit: '€', traps: [p.U * Fr],
          tip: `${fr(p.U)} $ / ${fr(Fr, 4)} ≈ ${fr(eur, 0)} €. EUR/USD donne des dollars par euro : on divise.` },
        { ask: `Couverte, elle touche ${fr(eur, 0)} €. Dans un an, EUR/USD vaut finalement ${fr(p.S2, 2)}. Combien la couverture lui a-t-elle fait gagner (ou perdre) par rapport à une vente au comptant ce jour-là ?`,
          answer: eur - open, tol: 0.01, unit: '€', traps: [open - eur],
          tip: `Sans couverture : ${fr(p.U)} / ${fr(p.S2, 2)} ≈ ${fr(open, 0)} €. Écart : ${sg(eur - open, 0)} €. La couverture supprime l'incertitude, dans un sens comme dans l'autre.` },
      ];
    },
  },
  accretion: {
    title: 'Rachat payé en actions', rubric: 'Corporate',
    params: (r) => { const nA = pick(r, [50, 80, 100, 200]), epsA = pick(r, [2, 2.5, 3, 4, 5]), per = pick(r, [10, 12, 15, 20]), NIT = pick(r, [20, 30, 40, 50, 60]), perT = pick(r, [8, 10, 12, 18, 25, 30].filter((x) => x !== per));
      return { nA, NIA: nA * epsA, PA: epsA * per, NIT, VT: NIT * perT }; },
    intro: (p) => `Une société gagne ${fr(p.NIA)} M€ avec ${p.nA} millions d'actions cotées ${fr(p.PA)} €. Elle rachète une cible qui gagne ${p.NIT} M€, pour ${fr(p.VT)} M€ payés en actions nouvelles.`,
    steps: (p) => {
      const x = p.VT / p.PA, eps0 = p.NIA / p.nA, eps1 = (p.NIA + p.NIT) / (p.nA + x), d = (eps1 / eps0 - 1) * 100;
      return [
        { ask: 'Combien d\'actions nouvelles doit-elle émettre, en millions ?', answer: x, tol: 0.01, unit: 'millions', traps: [p.VT / eps0],
          tip: `Prix payé / cours de l'acheteur = ${fr(p.VT)} / ${fr(p.PA)} = ${fr(x, 1)} millions d'actions.` },
        { ask: `Elle émet ${fr(x, 1)} millions d'actions. Nouveau bénéfice par action du groupe ?`, answer: eps1, tol: 0.01, unit: '€', traps: [(p.NIA + p.NIT) / p.nA],
          tip: `(${fr(p.NIA)} + ${p.NIT}) / (${p.nA} + ${fr(x, 1)}) = ${fr(eps1)} € par action. Il faut diviser par toutes les actions, anciennes et nouvelles.` },
        { ask: `Le BPA passe de ${fr(eps0)} € à ${fr(eps1)} €. Relution (ou dilution), en % ?`, answer: d, tol: 0.03, unit: '%', traps: [eps1 - eps0],
          tip: `${fr(eps1)} / ${fr(eps0)} − 1 = ${sg(d, 1)} %. ${d > 0 ? 'Relutive' : 'Dilutive'} : la cible est payée ${fr(p.VT / p.NIT, 1)} fois ses bénéfices, l'acheteur vaut ${fr(p.PA / eps0, 1)} fois les siens.` },
      ];
    },
  },
  credit: {
    title: 'Un prêt à une entreprise', rubric: 'Risques',
    params: (r) => ({ N: pick(r, [5, 10, 20, 50, 100]), PD: pick(r, [0.5, 1, 1.5, 2, 3, 4]), R: pick(r, [20, 30, 40, 50, 60]), w: pick(r, [50, 75, 100, 150]) }),
    intro: (p) => `Une banque prête ${p.N} M€ à une entreprise : probabilité de défaut de ${fr(p.PD, 1)} % par an, taux de recouvrement de ${p.R} % en cas de défaut.`,
    steps: (p) => {
      const el = (p.N * 1000 * p.PD * (100 - p.R)) / 1e4, s = p.PD * (100 - p.R), k = (p.N * p.w * 8) / 1e4;
      return [
        { ask: 'Perte attendue sur un an, en milliers d\'euros ?', answer: el, tol: 0.01, unit: 'k€', traps: [(p.N * 1000 * p.PD * p.R) / 1e4],
          tip: `EAD × PD × LGD = ${p.N} M€ × ${fr(p.PD, 1)} % × ${100 - p.R} % = ${fr(el, 1)} k€. La LGD, c'est ce qu'on ne récupère pas.` },
        { ask: `Perte attendue : ${fr(el, 1)} k€ par an. Quelle marge minimale faut-il facturer, en points de base, pour la couvrir ?`, answer: s, tol: 0.01, unit: 'pb', traps: [p.PD * 100],
          tip: `${fr(el, 1)} k€ / ${p.N} M€ = ${fr(s / 100)} %, soit ${fr(s, 0)} pb. Facturer ${fr(p.PD * 100, 0)} pb, ce serait oublier le recouvrement.` },
        { ask: `La marge couvre la perte attendue, pas l'imprévu. Le prêt est pondéré à ${p.w} % dans les actifs pondérés. Fonds propres minimaux à 8 % de ces actifs ?`, answer: k, tol: 0.01, unit: 'M€', traps: [(p.N * 8) / 100],
          tip: `Actifs pondérés : ${p.N} × ${p.w} % = ${fr((p.N * p.w) / 100, 2)} M€ ; 8 % de ce montant : ${fr(k, 2)} M€. Le capital absorbe les pertes inattendues.` },
      ];
    },
  },
  straddle: {
    title: 'Un straddle avant résultats', rubric: 'Dérivés',
    params: (r) => ({ S: pick(r, [50, 80, 100, 120, 200]), sig: pick(r, [20, 30, 40, 50, 60, 80]), T: pick(r, [[1 / 12, 'un mois', '1/12'], [0.25, 'trois mois', '0,25'], [1 / 52, 'une semaine', '1/52']]), mv: pick(r, [-0.15, -0.1, -0.05, -0.02, 0.02, 0.05, 0.1, 0.15]) }),
    intro: (p) => `Avant des résultats, tu achètes un straddle à la monnaie ${p.T[1]} sur une action à ${p.S} €, volatilité implicite de ${p.sig} %.`,
    steps: (p) => {
      const c = 0.8 * p.S * (p.sig / 100) * Math.sqrt(p.T[0]), cr = Math.round(c * 100) / 100, S2 = Math.round(p.S * (1 + p.mv) * 100) / 100, pnl = Math.abs(S2 - p.S) - cr;
      return [
        { ask: 'Prix du straddle, environ ?', answer: c, tol: 0.1, unit: '€', traps: [c / 2],
          tip: `Straddle ATM ≈ 0,8 × S × σ × √T = 0,8 × ${p.S} × ${fr(p.sig / 100)} × √(${p.T[2]}) ≈ ${fr(c)} €. La moitié, c'est le call seul.` },
        { ask: `Le straddle coûte ${fr(cr)} €. Au-dessus de quel cours, à l'échéance, commences-tu à gagner de l'argent à la hausse ?`, answer: p.S + cr, tol: 0.005, unit: '€', traps: [p.S + cr / 2],
          tip: `Il faut que l'action s'écarte du strike d'au moins la prime : ${p.S} + ${fr(cr)} = ${fr(p.S + cr)} € (ou sous ${fr(p.S - cr)} € à la baisse).` },
        { ask: `Prime : ${fr(cr)} €. À l'échéance, l'action finit à ${fr(S2)} €. Ton résultat par straddle ?`, answer: pnl, tol: 0.01, unit: '€', traps: [Math.abs(S2 - p.S)],
          tip: `Le straddle paie |${fr(S2)} − ${p.S}| = ${fr(Math.abs(S2 - p.S))} €, moins la prime de ${fr(cr)} € : ${sg(pnl)} €. Long volatilité, il faut que ça bouge plus que prévu.` },
      ];
    },
  },
};
const CASE_BY_MODULE = { gen: Object.keys(CASES), trading: ['book', 'bond', 'var', 'swap', 'fxhedge', 'straddle'], ma: ['lbo', 'dcf', 'accretion'], quant: ['book', 'var', 'straddle'], risk: ['var', 'bond', 'credit', 'swap'] };

// Étape step (0, 1, 2) du cas tiré avec r (même r pour les trois étapes : même dossier)
export function caseStep(r, step, module = 'gen') {
  const key = pick(r, CASE_BY_MODULE[module] || CASE_BY_MODULE.gen), C = CASES[key], p = C.params(r), S = C.steps(p)[step];
  return { caseKey: key, title: C.title, rubric: C.rubric,
    text: `${C.intro(p)} ${S.ask}`, answer: Number(S.answer.toPrecision(4)), tol: S.tol, unit: S.unit, traps: S.traps.filter((t) => Math.abs(t - S.answer) > S.tol * Math.abs(S.answer) * 2), tip: S.tip };
}
export const CASE_KEYS = Object.keys(CASES);

/* ------------------------------------------------------------ relances de Pierre */
// une question, puis la même situation modifiée : « et si… ? ». Chaque relance tire ses chiffres (le même tirage aux deux étapes).
const between = (r, a, b) => a + r.int(b - a + 1);
const RELANCES = [
  (r) => { const P = between(r, 2, 10), s1 = pick(r, [10, 20, 30, 40]), s2 = s1 * pick(r, [0.5, 1.5, 2]), [k, lab] = pick(r, [[4, 'multipliée par 4'], [9, 'multipliée par 9'], [0.25, 'divisée par 4']]);
    return { cat: 'Dérivés', q: `Un call à la monnaie vaut ${P} € quand la volatilité est de ${s1} %. Prix approximatif si la volatilité passe à ${fr(s2, 0)} % ?`, a: (P * s2) / s1, tol: 0.05, unit: '€',
      tip: `À la monnaie, le prix est presque proportionnel à la vol : ${P} × ${fr(s2, 0)}/${s1} = ${fr((P * s2) / s1)} €.`,
      then: { q: `Et si, au lieu de la vol, c'est la maturité qui est ${lab} ?`, a: P * Math.sqrt(k), tol: 0.05, unit: '€', tip: `Le prix à la monnaie suit σ√T : maturité ${lab} → prix × ${fr(Math.sqrt(k))}, soit ${fr(P * Math.sqrt(k))} €.` } }; },
  (r) => { const s = between(r, 4, 10), w = 6 - Math.abs(s - 7), ks = [1, 2, 3, 4, 5, 6].filter((k) => s - k >= 1 && s - k <= 6), k = pick(r, ks), c = s - k === k ? 1 : 2;
    return { cat: 'Probas', q: `On lance deux dés. Probabilité que la somme fasse ${s}, en % ?`, a: (w * 100) / 36, tol: 0.02, unit: '%',
      tip: `${w} combinaisons sur 36 : ${fr((w * 100) / 36, 1)} %.`,
      then: { q: `Et si on sait qu'au moins un des deux dés montre ${k} ?`, a: (c * 100) / 11, tol: 0.02, unit: '%', tip: `11 tirages contiennent au moins un ${k} ; ${c === 1 ? `un seul fait ${s} (${k}-${k})` : `deux font ${s} (${k}-${s - k} et ${s - k}-${k})`} : ${c}/11 ≈ ${fr((c * 100) / 11, 1)} %.` } }; },
  (r) => { const D = between(r, 3, 8), Cv = 10 * between(r, 2, 6), d2 = pick(r, [2, 3]);
    return { cat: 'Taux', q: `Une obligation de duration modifiée ${D} : les taux montent de 1 %. Variation de prix, en % ?`, a: -D, tol: 0.02, unit: '%',
      tip: `− duration × Δtaux = − ${D} × 1 % = − ${D} %.`,
      then: { q: `Et si les taux montent de ${d2} % et que la convexité vaut ${Cv} ?`, a: -D * d2 + 0.5 * Cv * d2 * d2 / 100, tol: 0.03, unit: '%', tip: `− ${D} × ${d2} % + ½ × ${Cv} × (${d2} %)² = − ${D * d2} % + ${fr(0.5 * Cv * d2 * d2 / 100)} % = ${fr(-D * d2 + 0.5 * Cv * d2 * d2 / 100)} %. La convexité amortit la baisse.` } }; },
  (r) => { const p = pick(r, [3, 4, 6, 8, 9, 12]), [m, n, lab] = pick(r, [[4, 2, 'quadrupler'], [8, 3, 'le multiplier par 8'], [16, 4, 'le multiplier par 16']]);
    return { cat: 'Calcul', q: `Un placement rapporte ${p} % par an. En combien d'années double-t-il (règle de 72) ?`, a: 72 / p, tol: 0.04, unit: 'ans',
      tip: `72 / ${p} = ${fr(72 / p, 1)} ans.`,
      then: { q: `Et pour ${lab} ?`, a: (n * 72) / p, tol: 0.04, unit: 'ans', tip: `× ${m}, c'est ${n} doublements : ${n} × ${fr(72 / p, 1)} = ${fr((n * 72) / p, 1)} ans.` } }; },
  (r) => { const n = between(r, 2, 5), [th, need] = pick(r, [[90, 4], [95, 5], [99, 7], [99.9, 10]]);
    return { cat: 'Probas', q: `Une pièce est lancée ${n} fois. Probabilité d'obtenir au moins un pile, en % ?`, a: (1 - 0.5 ** n) * 100, tol: 0.01, unit: '%',
      tip: `1 − (1/2)^${n} = ${fr((1 - 0.5 ** n) * 100, 2)} %.`,
      then: { q: `Et combien de lancers faut-il au minimum pour dépasser ${fr(th, 1)} % ?`, a: need, tol: 0, unit: 'lancers', tip: `1 − (1/2)ⁿ > ${fr(th / 100, 3)} ⇔ 2ⁿ > ${fr(100 / (100 - th), 0)} ⇔ n = ${need} (2^${need} = ${2 ** need}).` } }; },
  (r) => { const E = pick(r, [20, 40, 50, 60, 80, 100]), m = between(r, 8, 12), D = E * between(r, 2, 5), m2 = m - between(r, 1, 3);
    return { cat: 'Corporate', q: `Une société vaut ${m} fois son EBITDA de ${E} M€ et a ${D} M€ de dette nette. Valeur des fonds propres ?`, a: m * E - D, tol: 0.01, unit: 'M€',
      tip: `${m} × ${E} = ${m * E} M€ de valeur d'entreprise, moins ${D} M€ de dette : ${m * E - D} M€.`,
      then: { q: `Et si le multiple baisse à ${m2} ?`, a: m2 * E - D, tol: 0.01, unit: 'M€', tip: `${m2} × ${E} − ${D} = ${m2 * E - D} M€ : le multiple perd ${fr((1 - m2 / m) * 100, 0)} %, les fonds propres ${fr((1 - (m2 * E - D) / (m * E - D)) * 100, 0)} %. C'est le levier.` } }; },
  (r) => { const mg = pick(r, [50, 25, 20]), x = pick(r, [5, 10, 15]), n = pick(r, [500, 1000, 2000]), p = pick(r, [20, 40, 50]);
    return { cat: 'Marchés', q: `Tu achètes ${fr(n)} actions à ${p} € en n'apportant que ${mg} % du montant. L'action monte de ${x} %. Rendement sur ta mise, en % ?`, a: (x * 100) / mg, tol: 0.01, unit: '%',
      tip: `Mise de ${fr((n * p * mg) / 100)} €, gain de ${fr((n * p * x) / 100)} € : ${fr((x * 100) / mg)} %.`,
      then: { q: `Et si l'action baisse de ${x} % ?`, a: (-x * 100) / mg, tol: 0.01, unit: '%', tip: `Même levier dans l'autre sens : − ${fr((n * p * x) / 100)} € sur ${fr((n * p * mg) / 100)} €, soit − ${fr((x * 100) / mg)} %.` } }; },
  (r) => { const S = 10 * between(r, 5, 20), p = between(r, 2, 8), D = between(r, 1, 6);
    return { cat: 'Dérivés', q: `Spot ${S}, taux ${p} %, pas de dividende. Prix du forward à un an ?`, a: S * (1 + p / 100), tol: 0.005, unit: '',
      tip: `F = S × (1 + r) = ${fr(S * (1 + p / 100))} (en continu, ${S} × e^${fr(p / 100)} ≈ ${fr(S * Math.exp(p / 100))}).`,
      then: { q: `Et si l'action verse un dividende de ${D} dans l'année ?`, a: S * (1 + p / 100) - D, tol: 0.005, unit: '', tip: `On retire le dividende : ${fr(S * (1 + p / 100))} − ${D} = ${fr(S * (1 + p / 100) - D)}.` } }; },
  (r) => { const a = pick(r, [10, 20, 25, 40, 50]);
    return { cat: 'Calcul', q: `Une action fait − ${a} % puis + ${a} %. Variation totale, en % ?`, a: -(a * a) / 100, tol: 0, unit: '%',
      tip: `${fr(1 - a / 100)} × ${fr(1 + a / 100)} = ${fr(1 - (a * a) / 1e4, 4)} : ${fr(-(a * a) / 100)} %.`,
      then: { q: `Et si elle fait + ${a} % d'abord, puis − ${a} % ?`, a: -(a * a) / 100, tol: 0, unit: '%', tip: `${fr(1 + a / 100)} × ${fr(1 - a / 100)} : toujours ${fr(-(a * a) / 100)} %. L'ordre ne change rien à un produit.` } }; },
  (r) => { const n = pick(r, [4, 6, 8, 10, 12, 20]), keep = Array.from({ length: n }, (_, k) => k + 1).filter((v) => v > (n + 1) / 2), e = (keep.length / n) * (keep.reduce((a, b) => a + b, 0) / keep.length) + (1 - keep.length / n) * ((n + 1) / 2);
    return { cat: 'Probas', q: `Espérance du lancer d'un dé à ${n} faces ?`, a: (n + 1) / 2, tol: 0, unit: '',
      tip: `(1 + 2 + … + ${n}) / ${n} = ${fr((n + 1) / 2, 1)}.`,
      then: { q: `Et si tu peux relancer une fois, en gardant alors le second lancer ?`, a: e, tol: 0.01, unit: '', tip: `On relance sous ${fr((n + 1) / 2, 1)}, c'est-à-dire sur ${n - keep.length} faces sur ${n} : ${fr(keep.length / n)} × ${fr(keep.reduce((a, b) => a + b, 0) / keep.length)} + ${fr(1 - keep.length / n)} × ${fr((n + 1) / 2, 1)} = ${fr(e, 3)}.` } }; },
  (r) => { const n = between(r, 2, 7), i = between(r, 0, n - 1), i2 = n + between(r, 1, 5);
    return { cat: 'Macro', q: `Inflation à ${i} %, taux nominal à ${n} %. Taux réel approximatif, en % ?`, a: n - i, tol: 0, unit: '%',
      tip: `Fisher : réel ≈ nominal − inflation = ${n - i} %.`,
      then: { q: `Et si l'inflation grimpe à ${i2} % sans que la banque centrale bouge ?`, a: n - i2, tol: 0, unit: '%', tip: `${n} − ${i2} = ${n - i2} % : le taux réel devient négatif, la politique monétaire devient très accommodante.` } }; },
  (r) => { const v = pick(r, [1, 2, 3, 5]), [n1, n2] = pick(r, [[4, 25], [9, 16], [4, 100], [16, 64], [9, 36]]);
    return { cat: 'Risques', q: `Un portefeuille a une VaR à 1 jour de ${v} M€. VaR à ${n1} jours ?`, a: v * Math.sqrt(n1), tol: 0.01, unit: 'M€',
      tip: `Racine du temps : ${v} × √${n1} = ${v * Math.sqrt(n1)} M€.`,
      then: { q: `Et à ${n2} jours ?`, a: v * Math.sqrt(n2), tol: 0.01, unit: 'M€', tip: `${v} × √${n2} = ${v * Math.sqrt(n2)} M€ (et non ${v * n2} : les risques ne s'additionnent pas jour après jour).` } }; },
  (r) => { const a = between(r, 3, 9), b = between(r, 20, 150), k = between(r, 2, 6);
    return { cat: 'Logique', q: `Il faut ${a} machines ${a} minutes pour faire ${a} pièces. Combien de minutes pour ${b} machines et ${b} pièces ?`, a, tol: 0, unit: 'min',
      tip: `Une machine fait une pièce en ${a} minutes : ${b} machines font ${b} pièces en ${a} minutes.`,
      then: { q: `Et combien de machines pour faire ${fr(b * k)} pièces en ${a * k} minutes ?`, a: b, tol: 0, unit: 'machines', tip: `Une machine fait ${k} pièces en ${a * k} minutes : ${fr(b * k)} / ${k} = ${b} machines.` } }; },
  (r) => { const K = pick(r, [50, 80, 100]), S = K + pick(r, [0, 5, 10]), P = between(r, 3, 8), C = P + (S - K) + pick(r, [-2, 2, 3, 4]);
    return { cat: 'Dérivés', q: `Spot ${S}, strike ${K}, taux nuls, même échéance. Un call coûte ${C}, le put ${P}. D'après la parité call-put, que devrait valoir C − P ?`, a: S - K, tol: 0, unit: '',
      tip: `C − P = S − K = ${S - K}. Or ${C} − ${P} = ${C - P} : il y a un arbitrage.`,
      then: { q: `Quel profit sans risque fais-tu par lot en arbitrant cet écart ?`, a: Math.abs(C - P - (S - K)), tol: 0, unit: '', tip: `${C - P > S - K ? 'Le call est trop cher : on vend le call, on achète le put et l\'action' : 'Le put est trop cher : on vend le put, on achète le call et on vend l\'action'}. On encaisse l'écart : |${C - P} − ${S - K}| = ${Math.abs(C - P - (S - K))}.` } }; },
  (r) => { const x = pick(r, [5, 10, 15, 20, 25, 30, 40]), y = pick(r, [20, 40, 50, 60, 80, 120, 200]);
    return { cat: 'Calcul', q: `Combien font ${x} % de ${y} ?`, a: (x * y) / 100, tol: 0, unit: '',
      tip: `10 % de ${y} = ${fr(y / 10)}, donc ${x} % = ${fr((x * y) / 100)}.`,
      then: { q: `Et ${y} % de ${x} ?`, a: (x * y) / 100, tol: 0, unit: '', tip: `x % de y = y % de x : toujours ${fr((x * y) / 100)}.` } }; },
  (r) => { const x = pick(r, [1.05, 1.08, 1.1, 1.12, 1.15, 1.2]), A = pick(r, [1000, 2000, 5000, 10000]), k = pick(r, [5, 10, 20]);
    return { cat: 'Marchés', q: `EUR/USD à ${fr(x)}. Combien de dollars pour ${fr(A)} € ?`, a: A * x, tol: 0.001, unit: '$',
      tip: `${fr(A)} × ${fr(x)} = ${fr(A * x)} $.`,
      then: { q: `Et si l'euro perd ${k} % face au dollar ?`, a: A * x * (1 - k / 100), tol: 0.001, unit: '$', tip: `${fr(x)} × ${fr(1 - k / 100)} = ${fr(x * (1 - k / 100), 4)} : ${fr(A)} € valent ${fr(A * x * (1 - k / 100))} $.` } }; },
  (r) => { const C = pick(r, [3, 4, 5, 6]), rr = pick(r, [4, 5, 6, 8].filter((v) => v !== C)), r2 = rr - pick(r, [1, 2]);
    return { cat: 'Taux', q: `Obligation perpétuelle, coupon de ${C} € par an, taux du marché ${rr} %. Prix ?`, a: (C * 100) / rr, tol: 0.005, unit: '€',
      tip: `Flux / taux = ${C} / ${fr(rr / 100)} = ${fr((C * 100) / rr)} €.`,
      then: { q: `Et si les taux baissent à ${r2} % ?`, a: (C * 100) / r2, tol: 0.005, unit: '€', tip: `${C} / ${fr(r2 / 100)} = ${fr((C * 100) / r2)} € : +${fr(((rr / r2) - 1) * 100, 0)} %. Plus la durée est longue, plus le prix réagit aux taux.` } }; },
  (r) => { const NI = 10 * between(r, 2, 20), n = 10 * between(r, 1, 10), k = pick(r, [10, 20, 25]);
    return { cat: 'Corporate', q: `Bénéfice de ${NI} M€, ${n} millions d'actions. Bénéfice par action ?`, a: NI / n, tol: 0.01, unit: '€',
      tip: `${NI} / ${n} = ${fr(NI / n)} € par action.`,
      then: { q: `Et si l'entreprise rachète et annule ${k} % de ses actions, bénéfice inchangé ?`, a: NI / (n * (1 - k / 100)), tol: 0.01, unit: '€', tip: `Il reste ${fr(n * (1 - k / 100), 1)} millions d'actions : ${NI} / ${fr(n * (1 - k / 100), 1)} = ${fr(NI / (n * (1 - k / 100)))} €.` } }; },
  (r) => { const S = pick(r, [50, 100, 200]), s = pick(r, [10, 20, 30, 40]), [k, lab] = pick(r, [[0.25, 'un trimestre'], [1 / 12, 'un mois']]);
    return { cat: 'Dérivés', q: `Straddle à la monnaie un an, action à ${S} €, volatilité ${s} %. Prix, environ ?`, a: 0.8 * S * (s / 100), tol: 0.1, unit: '€',
      tip: `0,8 × ${S} × ${fr(s / 100)} = ${fr(0.8 * S * (s / 100))} €.`,
      then: { q: `Et sur ${lab} seulement ?`, a: 0.8 * S * (s / 100) * Math.sqrt(k), tol: 0.1, unit: '€', tip: `Le prix suit √T : × √(${k === 0.25 ? '1/4' : '1/12'}) ≈ ${fr(Math.sqrt(k))}, soit ${fr(0.8 * S * (s / 100) * Math.sqrt(k))} €.` } }; },
  (r) => { const pr = pick(r, [1, 2, 5]), s = pick(r, [90, 95, 99]), pr2 = pr * pick(r, [5, 10]);
    const f = (p) => (s * p) / (s * p + (100 - s) * (100 - p)) * 100;
    return { cat: 'Probas', q: `Une maladie touche ${pr} % des gens. Le test se trompe dans ${100 - s} % des cas, dans les deux sens. Test positif : probabilité d'être malade, en % ?`, a: f(pr), tol: 0.03, unit: '%',
      tip: `${s} % × ${pr} % de vrais positifs contre ${100 - s} % × ${100 - pr} % de faux : ${fr(f(pr), 1)} %.`,
      then: { q: `Et si on ne teste que des patients à risque, malades à ${pr2} % ?`, a: f(pr2), tol: 0.03, unit: '%', tip: `${s} × ${pr2} / (${s} × ${pr2} + ${100 - s} × ${100 - pr2}) ≈ ${fr(f(pr2), 1)} % : le même test devient bien plus parlant.` } }; },
];
export const RELANCE_COUNT = RELANCES.length;
// Étape 0 : la question ; étape 1 : la relance (même tirage r)
export function relanceStep(r, step) {
  const R = pick(r, RELANCES)(r), S = step ? R.then : R;
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
