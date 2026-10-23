// Mini-schémas des explications de The Candidate : d'après le texte de la question (et de l'explication), on choisit
// un petit dessin qui aide à comprendre la réponse (profil d'une option, courbe des taux, cloche, frise d'un taux variable…).
// Les dessins sont faits par view/figure.js ; ici, seulement la description (pas de DOM).
const payoff = (legs, label) => ({ t: 'chart', c: 'payoff', legs, K: [...new Set(legs.filter((l) => l[0] !== 's').map((l) => l[1]))].sort((a, b) => a - b), label });

// premier motif reconnu → schéma (l'ordre compte : les plus précis d'abord)
const RULES = [
  [/butterfly/i, () => payoff([['c', 80, 1], ['c', 100, -2], ['c', 120, 1]], 'Butterfly acheté')],
  [/strangle/i, () => payoff([['p', 80, 1], ['c', 120, 1]], 'Strangle acheté')],
  [/straddle/i, (t) => payoff(/vend|short/i.test(t) ? [['c', 100, -1], ['p', 100, -1]] : [['c', 100, 1], ['p', 100, 1]], /vend|short/i.test(t) ? 'Straddle vendu' : 'Straddle acheté')],
  [/collar/i, () => payoff([['s', 100, 1], ['p', 80, 1], ['c', 120, -1]], 'Collar : action + put acheté + call vendu')],
  [/covered call|call couvert/i, () => payoff([['s', 100, 1], ['c', 110, -1]], 'Action + call vendu')],
  [/put spread/i, () => payoff([['p', 120, 1], ['p', 80, -1]], 'Put spread acheté')],
  [/call spread/i, () => payoff([['c', 80, 1], ['c', 120, -1]], 'Call spread acheté')],
  [/risk reversal/i, () => payoff([['c', 120, 1], ['p', 80, -1]], 'Risk reversal')],
  [/forward synthétique|parité call.?put/i, () => payoff([['c', 100, 1], ['p', 100, -1]], 'Call acheté + put vendu = forward')],
  [/smile|skew|25 delta/i, () => ({ t: 'smile' })],
  [/gamma/i, () => ({ t: 'greek', g: 'gamma' })],
  [/thêta|theta|valeur temps/i, () => ({ t: 'greek', g: 'theta' })],
  [/vega/i, () => ({ t: 'greek', g: 'vega' })],
  [/delta/i, () => ({ t: 'greek', g: 'delta' })],
  [/\bput\b/i, (t) => payoff([['p', 100, /vend|short/i.test(t) ? -1 : 1]], /vend|short/i.test(t) ? 'Put vendu' : 'Put acheté')],
  [/\bcall\b/i, (t) => payoff([['c', 100, /vend|short/i.test(t) ? -1 : 1]], /vend|short/i.test(t) ? 'Call vendu' : 'Call acheté')],
  [/constatation|fixing|in arrears|in advance|\bFRA\b|euribor constaté|taux variable.*(fixé|payé)/i, () => ({ t: 'timeline' })],
  [/courbe (des taux )?inversée|inversion/i, () => ({ t: 'chart', c: 'yc', x: ['1 an', '2 ans', '5 ans', '10 ans', '30 ans'], y: [4.2, 3.9, 3.5, 3.2, 3.0], label: 'Courbe inversée' })],
  [/pente|pentification|steepener|flattener|courbe des taux/i, () => ({ t: 'chart', c: 'yc', x: ['1 an', '2 ans', '5 ans', '10 ans', '30 ans'], y: [2.0, 2.4, 2.9, 3.3, 3.6], label: 'Courbe normale' })],
  [/convexité/i, () => ({ t: 'convex' })],
  [/duration|obligation.*taux|taux.*obligation|prix d'une obligation/i, () => ({ t: 'convex' })],
  [/loi normale|écart-type|68 ?%|gaussienne|volatilité du portefeuille/i, () => ({ t: 'bell' })],
  [/drawdown/i, () => ({ t: 'chart', c: 'line', y: [100, 120, 90, 130, 65, 80, 95], label: 'Du plus haut (130) au plus bas qui suit (65) : −50 %' })],
  [/valeur d'entreprise|enterprise value|\bEV\b/i, () => ({ t: 'evbridge' })],
  [/bilan|actif.*passif|passif.*actif/i, () => ({ t: 'balance' })],
];

// On lit la question seule : l'explication cite souvent d'autres positions (« … c'est un forward synthétique »).
// Les options digitales ont un profil en marche d'escalier, qu'aucun schéma ne montre : pas de dessin.
export function schemaFor(text) {
  if (/digital|binaire/i.test(text)) return null;
  for (const [re, make] of RULES) if (re.test(text)) return make(text);
  return null;
}
