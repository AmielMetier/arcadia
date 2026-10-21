// tools/build-chartier-dataset.mjs
import fs from 'fs';

const parsed = JSON.parse(fs.readFileSync('calcul/engine/chartier-parsed-temp.json', 'utf8'));

// Dictionnaire de distracteurs thématiques ciblés pour les questions conceptuelles
const CONCEPT_DISTRACTORS = {
  1: ["Compagnie d'Actions Cotées", "Capitalisation Actions Courantes", "Comité d'Arbitrage du Crédit"],
  3: ["Il monte", "Il reste stable", "Il double"],
  4: ["L'Ours (Bear)", "Le Loup", "L'Aigle"],
  5: ["Le Taureau (Bull)", "Le Renard", "Le Faucon"],
  6: ["Le Yuan (CNY)", "Le Won (KRW)", "Le Dollar de Singapour (SGD)"],
  7: ["L'Euro (EUR)", "La Couronne suisse (SEK)", "Le Florin"],
  8: ["La plus-value", "L'intérêt obligataire", "La soulte"],
  13: ["International Portfolio Order", "Internal Private Offering", "Indexed Pricing Operation"],
  14: ["L'Euro Stoxx 50", "Le TecDAX", "Le MDAX"],
  15: ["Le Dow Jones", "Le Nasdaq 100", "Le Russell 2000"],
  16: ["La Bank of America", "Le Trésor Américain (US Treasury)", "Le Conseil Monétaire National"],
  17: ["Bruxelles", "Strasbourg", "Luxembourg"],
  18: ["Un Put (Option de vente)", "Un Swap de taux", "Un contrat Future"],
  19: ["Un Call (Option d'achat)", "Un Forward de change", "Un Warrant d'achat"],
  20: ["Le Spot", "La Prime (Premium)", "Le Forward"],
  23: ["Le Passif", "Le Hors-Bilan", "Les Capitaux Propres"],
  24: ["L'Actif", "Le Compte de Résultat", "L'Annexe"],
  25: ["Money and Assets", "Market Allocation", "Management and Audit"],
  26: ["Le Rachat d'actions", "Le portage obligataire", "L'arbitrage de spread"],
  29: ["Le Pétrole brut", "L'Immobilier parisien", "Le Cuivre"],
  30: ["Le Dow Jones Industrial", "Le S&P 500", "Le Russell 2000"],
  31: ["Le DAX 40", "L'AEX", "Le SMI"],
  32: ["Le Hang Seng", "Le TOPIX", "Le KOSPI"],
  33: ["La Prime de liquidité", "Le Slippage", "Le Ratio Sharpe"],
  35: ["Price and Leverage", "Position and Liquidity", "Payment and Loans"],
  36: ["Goldman Sachs", "Bloomberg Ratings", "Morningstar"],
  37: ["Un Bon du Trésor (BTF)", "Une Obligation Verte", "Un T-Bond"],
  38: ["Investment Grade", "Sovereign Debt", "Covered Bond"],
  40: ["La désinflation", "La stagflation", "L'hyperinflation"],
  41: ["Patrimoine Interbancaire Brut", "Production Industrielle de Base", "Partage Interne des Bénéfices"],
  44: ["Equity Trading Floor", "Electronic Transfer Fund", "Eurobond Target File"],
  45: ["Le marché des actions (Equities)", "Le marché obligataire", "Le marché des matières premières"],
  46: ["L'or et l'argent", "Le gaz naturel", "Le blé et le maïs"],
  49: ["Un ordre à cours limité", "Un ordre stop (seuil)", "Un ordre iceberg"],
  50: ["Un Centaure", "Un Décacorne", "Un Minotaure"],
  70: ["L", "M", "V"],
  71: ["Premier", "Troisième", "Quatrième"],
  72: ["Loulou", "Clémence", "Chloé"],
  74: ["Rouge", "Bleu", "Vert"],
  75: ["2", "4", "8"],
  76: ["5", "3", "2"],
  79: ["Oui", "Impossible à dire", "Seulement le premier"],
  81: ["ROUE", "OREU", "EORU"],
  82: ["A", "E", "O"],
  87: ["Le plomb", "Les plumes", "Impossible sans balance"],
  88: ["Vers l'Est", "Vers l'Ouest", "Vers le Sud-Ouest"],
  89: ["Mercredi", "Vendredi", "Samedi"],
  92: ["Euro", "Dollar", "Livre Sterling"],
  93: ["Vert", "Noir", "Incolore"],
  99: ["Sens des aiguilles d'une montre", "Aucun sens", "Aléatoire"],
  104: ["Son dividende moyen", "Son niveau d'endettement", "Son rendement obligataire"],
  109: ["World Asset Cost Calculation", "Working Asset Capital Core", "Weighted Absolute Credit Charge"],
  110: ["Equity Before Interest, Tax and Debt", "Earnings Balanced In Total Deals", "Enterprise Benefit In Trade Accounts"],
  111: ["Les impôts sur les sociétés", "Les charges financières d'intérêts", "Le chiffre d'affaires"],
  115: ["Le Gamma", "Le Véga", "Le Thêta"],
  116: ["Le Véga", "Le Rhô", "Le Delta"],
  117: ["Le Gamma", "Le Delta", "Le Thêta"],
  119: ["L'européenne cote en euros, l'américaine en dollars", "L'américaine n'a pas de strike fixe", "Aucune différence"],
  120: ["Un Strangle", "Un Butterfly", "Un Iron Condor"],
  124: ["Limité au montant de la prime", "Limité au Strike", "Égal à 100 % du cours"],
  125: ["Trésorerie Active - Trésorerie Passive", "Capitaux Propres - Dettes Financières", "EBITDA - Impôts"],
  128: ["Le WACC", "Le Payback", "Le Multiple d'EBITDA"],
  129: ["EBIT / Actif Total", "Free Cash Flow / Dette", "Chiffre d'Affaires / Capitaux Propres"],
  131: ["Une OPA hostile", "Un Spin-off", "Un Carve-out"],
  132: ["Un boom économique imminent", "Une hyperinflation", "Une hausse généralisée du dollar"],
  133: ["Un Interest Rate Swap (IRS)", "Un Collateralized Debt Obligation (CDO)", "Un Forward de crédit"],
  134: ["Le Fear & Greed Index", "Le MOVE Index", "Le TED Spread"],
  135: ["La Variation Margin", "Le Collateral Haircut", "La Prime de risque"],
  138: ["A-", "BB+", "A+"],
  139: ["Le Spin-off", "La dilution de capital", "L'Augmentation de capital"],
  140: ["Il diminue le BPA (effet dilutif)", "Il n'a aucun impact", "Il divise le BPA par 2"],
  141: ["Il s'est apprécié", "Il est resté parfaitement stable", "Le dollar a chuté"],
  142: ["Un Cross-Currency Swap", "Un CDS", "Un Forward Rate Agreement (FRA)"],
  143: ["L'EURIBOR", "Le TONA", "Le SARON"],
  144: ["L'Euribor 3 mois", "Le LIBOR Euro", "Le T4M"],
  146: ["Ils évoluent de façon identique", "Ils sont décorrélés (indépendants)", "L'un double quand l'autre stagne"],
  147: ["Eugene Fama", "John Maynard Keynes", "Milton Friedman"],
  150: ["Le risque de liquidité", "Le risque opérationnel", "Le risque de change"],
  175: ["N", "D", "S"],
  176: ["FU", "EU", "FV"],
  190: ["Oui, obligatoirement", "Seulement si A = B", "Seulement si C est vide"],
  195: ["Paul ment", "Les trois médecins mentent", "C'est une énigme impossible"],
  208: ["Le Véga", "Le Delta", "Le Vanna"],
  209: ["Profondément dans la monnaie (Deep ITM)", "Loin hors de la monnaie (Deep OTM)", "À maturité 10 ans"],
  210: ["Un marché parfaitement stable (plat)", "Une baisse lente des taux", "Une hausse constante sans à-coups"],
  211: ["Le Delta de l'option", "Le cours moyen futur", "Le taux d'actualisation continu"],
  215: ["Relutive", "Neutre (impact nul)", "Impossible sans connaître la dette"],
  216: ["Dilutif", "Neutre", "Catastrophique pour l'acquéreur"],
  217: ["La courbe de Philips", "La parabole d'arbitrage", "Le cône de Markov"],
  218: ["L'équation de Schrödinger", "L'équation d'onde acoustique", "L'équation de Navier-Stokes"],
  219: ["Le lemme de Fatou", "Le lemme de Borel-Cantelli", "Le théorème de Girsanov"],
  222: ["La VaR historique", "Le Max Drawdown", "L'Ulcer Index"],
  223: ["Un Condor", "Un Strangle", "Un Box Spread"],
  225: ["Up-and-In", "Down-and-Out", "Up-and-Out"],
  226: ["Une option Européenne", "Une option Bermudienne", "Une option Barrière"],
  227: ["Le théorème de Black-Scholes", "Le modèle CAPM de Sharpe", "Le théorème de Coase"],
  228: ["Le coût de la dette", "Le BFR d'exploitation", "La rotation des stocks"],
  231: ["En Contango", "En courbe plate", "En inversion de convexité"],
  232: ["La Backwardation", "Le Roll Yield", "La Déportation"],
  234: ["La dette Senior sécurisée", "Les actions de préférence", "Le prêt revolving"],
  235: ["Le ratio de Quick Ratio", "Le ratio de Solvabilité", "Le Debt Service Coverage Ratio (DSCR)"],
  237: ["Sa variance augmente de façon exponentielle", "Elle converge vers zéro à l'infini", "Ses trajectoires sont toujours dérivables"],
  238: ["En dessous", "Exactement égal à 1,1000", "Impossible à calculer sans la Fed"],
  239: ["La Prime de contrôle", "L'actif incorporel net", "Le Capex non alloué"],
  241: ["Le Véga", "Le Charm", "Le Vomma"],
  242: ["La différence $S_T - K$", "Zéro dans tous les cas", "Le cours du sous-jacent multiplié par le Strike"],
  243: ["Positif (Gamma > 0)", "Négatif (Gamma < 0)", "Égal à 1"],
  245: ["La Hurdle Rate", "Le Clawback", "La Watermark Clause"],
  247: ["Credit Exposure Total", "Central Euro Tier 1", "Core Equity Total Reserve"],
  255: ["Refaire tourner le barillet", "Les deux options sont équivalentes", "Laisser l'adversaire rejouer"],
  270: ["Allumer la corde 1 au milieu et la 2 aux extrémités", "Allumer les deux cordes en même temps d'un seul bout", "Ce n'est pas possible"],
  276: ["T", "E", "S"],
  277: ["T", "C", "Q"],
  284: ["Mardi", "Jeudi", "Samedi"],
  297: ["Ils ont volé un poisson", "L'un des poissons a sauté", "Un père n'a pas pêché"],
  298: ["1 km", "2 km", "3 km"],
  300: ["Oui, tous rouges", "Oui, tous bleus", "Oui, tous verts"]
};

// Fonction pour générer 3 distracteurs pour un nombre
function generateNumericDistractors(val, unit, id) {
  const d = [];
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(',', '.'));
  if (isNaN(num)) return ["Option A", "Option B", "Option C"];

  const formatWithUnit = (n) => {
    let s = Number.isInteger(n) ? String(n) : n.toFixed(num < 1 ? 2 : 1).replace('.', ',');
    if (unit) s += ' ' + unit;
    return s;
  };

  if (num === 0) return [formatWithUnit(10), formatWithUnit(-10), formatWithUnit(5)];
  if (num === 1) return [formatWithUnit(2), formatWithUnit(0), formatWithUnit(3)];

  // Générer des variantes crédibles
  const deltas = [
    Math.round(num * 0.8 * 100) / 100,
    Math.round(num * 1.25 * 100) / 100,
    Math.round(num * 0.5 * 100) / 100,
    Math.round((num + (num > 10 ? 10 : 2)) * 100) / 100,
    Math.round((num - (num > 10 ? 5 : 1)) * 100) / 100,
  ];

  for (const delta of deltas) {
    if (delta !== num && delta > 0 && d.length < 3) {
      d.push(formatWithUnit(delta));
    }
  }

  while (d.length < 3) {
    d.push(formatWithUnit(Math.round((num + d.length + 1) * 100) / 100));
  }

  return d.slice(0, 3);
}

const finalQuestions = parsed.map(q => {
  let choices = [];
  const clean = q.cleanAns;

  if (CONCEPT_DISTRACTORS[q.id]) {
    choices = [clean, ...CONCEPT_DISTRACTORS[q.id]];
  } else {
    // Détecter si c'est numérique
    const numMatch = clean.match(/^([-+]?\d+([,\.]\d+)?)\s*(.*)$/);
    if (numMatch) {
      const numVal = parseFloat(numMatch[1].replace(',', '.'));
      const unit = numMatch[3].trim();
      const dists = generateNumericDistractors(numVal, unit, q.id);
      choices = [clean, ...dists];
    } else {
      // Choix génériques si non listé
      choices = [clean, "Non concerné", "Aucune des réponses", "Donnée insuffisante"];
    }
  }

  // Mélanger les 4 choix de façon déterministe avec q.id
  const correctChoice = choices[0];
  const uniqueChoices = Array.from(new Set(choices));
  while (uniqueChoices.length < 4) {
    uniqueChoices.push("Option alternative " + (uniqueChoices.length + 1));
  }
  const fourChoices = uniqueChoices.slice(0, 4);

  // Simple shuffle
  const seed = q.id * 31;
  const shuffled = [...fourChoices].sort((a, b) => {
    const ha = (a.length * 17 + a.charCodeAt(0) * 13 + seed) % 100;
    const hb = (b.length * 17 + b.charCodeAt(0) * 13 + seed) % 100;
    return ha - hb;
  });

  // Conseils et remarques Pierre Chartier style
  const tips = [
    "Précision chirurgicale exigée : en salle de marché, une demi-seconde d'hésitation vous coûte votre trimestre.",
    "Règle d'or : si vous ne maîtrisez pas ce fondamental, vous êtes liquidé avant 9h02.",
    "Dans The Candidate, on attend de vous un raisonnement réflexe, pas une hésitation d'étudiant.",
    "Exécution nette. Le desk des dérivés ne tolère aucune approximation sur ce concept.",
    "Analysez les ordres de grandeur avant de vous noyer dans le calcul mental.",
    "Ce type de question filtre 80 % des candidats dès le premier tour d'entretien."
  ];
  const tip = tips[q.id % tips.length];

  return {
    id: q.id,
    cat: q.cat,
    level: q.level,
    time: q.time,
    text: q.text,
    rawAns: q.rawAns,
    cleanAns: clean,
    show: q.rawAns,
    tip,
    aliases: q.aliases,
    choices: shuffled,
    correctChoice
  };
});

// Écrire le module ES6 officiel calcul/engine/chartier-data.js
const outCode = `// calcul/engine/chartier-data.js
// Base de données des 300 questions The Candidate (Pierre Chartier)
// 3 Niveaux (Facile: 1-100, Normal: 101-200, Expert: 201-300)

export const CHARTIER_QUESTIONS = ${JSON.stringify(finalQuestions, null, 2)};

export function getChartierQuestion(id) {
  return CHARTIER_QUESTIONS.find(q => q.id === id);
}

export function getQuestionsByLevel(level) {
  return CHARTIER_QUESTIONS.filter(q => q.level === level);
}
`;

fs.writeFileSync('calcul/engine/chartier-data.js', outCode, 'utf8');
console.log('Successfully generated calcul/engine/chartier-data.js with', finalQuestions.length, 'questions!');
