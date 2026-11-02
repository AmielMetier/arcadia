// odyssee/js/core/bourse.js — la Bourse de Métropole (moteur sans DOM).
// Un petit marché qui vit pendant qu'on joue : actions de sociétés connues des joueurs (Sylphe SARL, Devon SA…) et
// inventées, un indice synthétique « S&P Odyssée 500 », le change Pokédollar / Pokéeuro, des matières premières
// (Baies, Pierres, Huile de Magma) et des contrats à terme sur les Poké Balls et les objets.
// Les cours suivent un modèle à facteurs (marché, secteur, propre à la société) et des nouvelles qui touchent les
// secteurs : certaines vont dans le même sens (corrélées), d'autres en sens inverse (concurrents), d'autres rien.
// Pricers : forward et futures avec portage, change à terme (parité des taux), swap de change, swap de taux,
// CDS (taux de défaut), options européennes (Black-Scholes), américaines (arbre binomial), asiatiques (Monte-Carlo).
// Tout est déterministe à partir d'une graine : le marché se rejoue à l'identique pour une même partie.

export function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
export function gauss(r) { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

/** une séance = 30 secondes de jeu ; une année = 250 séances */
export const SEANCE_MS = 30000, AN = 250;
export const R_PD = 0.03, R_PE = 0.015;   // taux sans risque du Pokédollar et du Pokéeuro

export const SECTEURS = { tech: 'Technologie', balls: 'Poké Balls', energie: 'Énergie', agro: 'Agriculture', transport: 'Transports', finance: 'Finance', sante: 'Soins', conso: 'Consommation', industrie: 'Industrie' };

// actions : cours initial, secteur, bêta (sensibilité au marché), volatilité propre, dividende, taux de défaut, poids dans l'indice
export const ACTIONS = [
  { id: 'SYL', nom: 'Sylphe SARL', secteur: 'balls', s0: 142, beta: 1.1, vol: 0.22, q: 0.015, lambda: 0.012, poids: 9, connue: true, desc: 'Le géant des Poké Balls, basé à Safrania.' },
  { id: 'DEV', nom: 'Devon SA', secteur: 'tech', s0: 96, beta: 1.25, vol: 0.28, q: 0.01, lambda: 0.018, poids: 7, connue: true, desc: 'Électronique de dresseur : Pokématos, PokéNav, Poké Balls de luxe.' },
  { id: 'MCR', nom: 'Macro Cosmos', secteur: 'energie', s0: 210, beta: 0.9, vol: 0.2, q: 0.025, lambda: 0.01, poids: 10, connue: true, desc: 'Énergie et cristaux Dynamax.' },
  { id: 'CPK', nom: 'Centres Pokémon SA', secteur: 'sante', s0: 75, beta: 0.6, vol: 0.14, q: 0.035, lambda: 0.004, poids: 6, connue: true, desc: 'Soins gratuits, mais la boutique, elle, rapporte.' },
  { id: 'ODY', nom: 'Odyssor Énergie', secteur: 'energie', s0: 58, beta: 1.0, vol: 0.32, q: 0.0, lambda: 0.03, poids: 3, desc: 'Éoliennes et barrages de la région, du nom du légendaire.' },
  { id: 'BAI', nom: 'Baies & Cie', secteur: 'agro', s0: 34, beta: 0.7, vol: 0.25, q: 0.02, lambda: 0.02, poids: 2, desc: 'Vergers de Baies Oran et Sitrus de la Forêt des Torii.' },
  { id: 'NAV', nom: 'Chantiers d\'Écaille', secteur: 'industrie', s0: 66, beta: 1.15, vol: 0.27, q: 0.02, lambda: 0.022, poids: 3, desc: 'Ferries et bateaux de pêche.' },
  { id: 'FER', nom: 'Ferry de l\'Est', secteur: 'transport', s0: 41, beta: 1.05, vol: 0.3, q: 0.01, lambda: 0.035, poids: 2, desc: 'Les traversées vers les îles.' },
  { id: 'BQA', nom: 'Banque d\'Aube', secteur: 'finance', s0: 88, beta: 1.3, vol: 0.24, q: 0.04, lambda: 0.015, poids: 5, desc: 'La banque des dresseurs depuis trois générations.' },
  { id: 'LUS', nom: 'Lustrelle Cosmétiques', secteur: 'conso', s0: 120, beta: 0.85, vol: 0.21, q: 0.018, lambda: 0.009, poids: 4, desc: 'Shampoings pour Pokémon : « parce que votre Ponyta le vaut bien ».' },
];
// matières premières et objets (cours au comptant) : coût de stockage u, rendement d'opportunité y
export const MATIERES = [
  { id: 'BAL', nom: 'Poké Ball', unite: 'la balle', s0: 200, vol: 0.18, u: 0.02, y: 0.01, secteur: 'balls' },
  { id: 'POT', nom: 'Super Potion', unite: 'la potion', s0: 700, vol: 0.15, u: 0.03, y: 0.0, secteur: 'sante' },
  { id: 'ORN', nom: 'Baie Oran', unite: 'le panier', s0: 50, vol: 0.35, u: 0.08, y: 0.02, secteur: 'agro' },
  { id: 'PIE', nom: 'Pierre Évolution', unite: 'la pierre', s0: 2100, vol: 0.22, u: 0.005, y: 0.0, secteur: 'industrie' },
  { id: 'MAG', nom: 'Huile de Magma', unite: 'le baril', s0: 82, vol: 0.38, u: 0.04, y: 0.05, secteur: 'energie' },
];
export const FX = { id: 'PDE', nom: 'Pokéeuro (€) en Pokédollars', s0: 1.35, vol: 0.08 };
export const INDICE = { id: 'SPO', nom: 'S&P Odyssée 500' };

/** nouvelles : chocs par secteur (en %) ; une même nouvelle monte un secteur, en fait baisser un autre, laisse le reste */
export const NOUVELLES = [
  { t: 'Rupture de stock de Poké Balls dans toute la région !', chocs: { balls: 6, BAL: 9, tech: -2 } },
  { t: 'Devon présente une Poké Ball connectée : la Sylphe accuse le coup.', chocs: { DEV: 7, SYL: -5, BAL: -2 } },
  { t: 'Sécheresse sur les vergers : les Baies Oran se font rares.', chocs: { agro: -6, ORN: 12, POT: 3 } },
  { t: 'Éruption sur l\'Île du Magma : production d\'Huile de Magma à l\'arrêt.', chocs: { MAG: 15, energie: 4, transport: -4 } },
  { t: 'Tempête sur la mer de l\'Est : les ferries restent à quai.', chocs: { transport: -7, NAV: -3, FER: -9 } },
  { t: 'La Banque d\'Aube relève ses taux.', chocs: { finance: 3, tech: -2, industrie: -2, PDE: 1.5 } },
  { t: 'Le Pokéeuro s\'envole après de bons chiffres à Kalos.', chocs: { PDE: 3, conso: -1 } },
  { t: 'Kalos en panne de croissance : le Pokéeuro recule.', chocs: { PDE: -3, conso: 1 } },
  { t: 'Récolte record : les paniers de Baies Oran ne trouvent pas preneur.', chocs: { ORN: -10, agro: 2 } },
  { t: 'L\'Île du Magma rouvre ses puits : l\'Huile de Magma dégringole.', chocs: { MAG: -12, transport: 3 } },
  { t: 'Record d\'inscriptions à la Ligue : les Centres Pokémon débordent.', chocs: { sante: 4, POT: 5, balls: 2 } },
  { t: 'Un parc éolien d\'Odyssor Énergie mis en service à Cendrelune.', chocs: { ODY: 9, MAG: -4, energie: 1 } },
  { t: 'Scandale : des Poké Balls défectueuses rappelées par la Sylphe.', chocs: { SYL: -9, DEV: 3, BAL: 2 } },
  { t: 'Chantiers d\'Écaille : grosse commande de ferries pour les îles.', chocs: { NAV: 8, FER: 2 } },
  { t: 'Shampoing Lustrelle : les Ponyta adorent, les ventes explosent.', chocs: { LUS: 7, conso: 2 } },
  { t: 'Rumeur de fusion entre Macro Cosmos et Odyssor Énergie.', chocs: { ODY: 12, MCR: -2 } },
  { t: 'Pénurie de Pierres Évolution : les collectionneurs s\'arrachent les stocks.', chocs: { PIE: 10, industrie: 1 } },
  { t: 'Journée calme à Métropole : les marchés attendent.', chocs: {} },
  { t: 'Crainte de récession : tout le monde vend.', chocs: { marche: -4, PDE: -1 } },
  { t: 'Euphorie à Métropole : l\'indice bat son record.', chocs: { marche: 3 } },
];

export const ACTIFS = [...ACTIONS, ...MATIERES.map((m) => ({ ...m, matiere: true })), { ...FX, fx: true }];
export const ACTIF = Object.fromEntries(ACTIFS.map((a) => [a.id, a]));

/* ---------------- état et simulation ---------------- */
/** nouvel état de marché (rangé dans la sauvegarde : st.bourse) */
export function nouveauMarche(seed = 1) {
  const prix = {}, hist = {};
  for (const a of ACTIFS) { prix[a.id] = a.s0; hist[a.id] = [a.s0]; }
  const m = { seed: seed >>> 0, t: 0, prix, hist, nouvelles: [], positions: {}, cash: 0, embauche: false };
  hist[INDICE.id] = [indice(m)];
  return m;
}
/** niveau de l'indice : moyenne pondérée des actions, ramenée à 5000 points au départ */
export function indice(m) {
  let n = 0, d = 0;
  for (const a of ACTIONS) { n += a.poids * m.prix[a.id] / a.s0; d += a.poids; }
  return 5000 * n / d;
}
/** une séance : facteur de marché, facteur de secteur, bruit propre, et parfois une nouvelle */
export function seance(m) {
  const r = rng(m.seed * 7919 + m.t * 104729 + 17), dt = 1 / AN;
  const fm = gauss(r) * 0.16 * Math.sqrt(dt);
  const fs = {}; for (const k of Object.keys(SECTEURS)) fs[k] = gauss(r) * 0.1 * Math.sqrt(dt);
  let news = null;
  if (r() < 0.12) { news = NOUVELLES[Math.floor(r() * NOUVELLES.length)]; m.nouvelles.unshift({ t: m.t, texte: news.t }); m.nouvelles.length = Math.min(m.nouvelles.length, 12); }
  const choc = (a) => { if (!news) return 0; const c = news.chocs; return ((c[a.id] || 0) + (c[a.secteur] || 0) + (a.fx ? 0 : c.marche || 0) * (a.beta ?? 0.5)) / 100; };
  for (const a of ACTIFS) {
    const s = m.prix[a.id];
    let ret;
    // change et matières premières reviennent peu à peu vers leur niveau d'équilibre (les chocs s'estompent)
    const rappel = 1.5 * Math.log(a.s0 / s) * dt;
    if (a.fx) ret = rappel + a.vol * Math.sqrt(dt) * gauss(r);
    else if (a.matiere) ret = rappel + 0.4 * fs[a.secteur] + a.vol * Math.sqrt(dt) * gauss(r);
    // actions : tendance de long terme (+5 %/an), les excès des nouvelles se résorbent en quelques mois
    else ret = (0.05 - a.q) * dt + 0.8 * Math.log(a.s0 * Math.exp(0.05 * m.t / AN) / s) * dt + a.beta * fm + fs[a.secteur] + a.vol * Math.sqrt(dt) * gauss(r);
    m.prix[a.id] = Math.max(0.01, s * Math.exp(ret + choc(a)));
    const h = m.hist[a.id]; h.push(Math.round(m.prix[a.id] * 1e4) / 1e4); if (h.length > 80) h.shift();
  }
  const hi = m.hist[INDICE.id]; hi.push(Math.round(indice(m) * 10) / 10); if (hi.length > 80) hi.shift();
  m.t++;
  return news;
}
/** rattrape les séances écoulées depuis la dernière visite (au plus 200 d'un coup) */
export function rattraper(m, ms) { const n = Math.min(200, Math.floor(ms / SEANCE_MS)); for (let i = 0; i < n; i++) seance(m); return n; }

/* ---------------- pricers ---------------- */
const N = (x) => { const t = 1 / (1 + 0.2316419 * Math.abs(x)), d = 0.3989423 * Math.exp(-x * x / 2); const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274)))); return x > 0 ? 1 - p : p; };
export const normCdf = N;
/** forward d'une action (dividende continu q) ou d'une matière (stockage u, rendement d'opportunité y) */
export function forward(S, r, T, q = 0, u = 0, y = 0) { return S * Math.exp((r - q + u - y) * T); }
/** change à terme : parité des taux (S en Pokédollars pour 1 Pokéeuro) */
export function changeATerme(S, rDom, rFor, T) { return S * Math.exp((rDom - rFor) * T); }
/** points de swap de change (aller au comptant, retour à terme) */
export function pointsSwap(S, rDom, rFor, T) { return changeATerme(S, rDom, rFor, T) - S; }
/** taux fixe d'un swap de taux : (1 − DF(T)) / somme des DF aux dates de paiement (courbe plate, paiements annuels) */
export function tauxSwap(r, ans) { let a = 0; for (let i = 1; i <= ans; i++) a += Math.exp(-r * i); return (1 - Math.exp(-r * ans)) / a; }
/** prime de CDS (par an) : taux de défaut × perte en cas de défaut (règle du pouce) */
export function primeCDS(lambda, recup = 0.4) { return lambda * (1 - recup); }
/** probabilité de survie à T avec un taux de défaut constant */
export function survie(lambda, T) { return Math.exp(-lambda * T); }
/** option européenne (Black-Scholes avec dividende continu) */
export function blackScholes(type, S, K, T, r, sigma, q = 0) {
  if (T <= 0) return Math.max(0, type === 'call' ? S - K : K - S);
  const d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T)), d2 = d1 - sigma * Math.sqrt(T);
  return type === 'call' ? S * Math.exp(-q * T) * N(d1) - K * Math.exp(-r * T) * N(d2) : K * Math.exp(-r * T) * N(-d2) - S * Math.exp(-q * T) * N(-d1);
}
export function delta(type, S, K, T, r, sigma, q = 0) {
  const d1 = (Math.log(S / K) + (r - q + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  return type === 'call' ? Math.exp(-q * T) * N(d1) : Math.exp(-q * T) * (N(d1) - 1);
}
/** option américaine : arbre binomial de Cox-Ross-Rubinstein (exercice anticipé à chaque nœud) */
export function americaine(type, S, K, T, r, sigma, q = 0, pas = 200) {
  const dt = T / pas, u = Math.exp(sigma * Math.sqrt(dt)), d = 1 / u, p = (Math.exp((r - q) * dt) - d) / (u - d), disc = Math.exp(-r * dt);
  const pay = (s) => Math.max(0, type === 'call' ? s - K : K - s);
  let v = []; for (let i = 0; i <= pas; i++) v.push(pay(S * u ** (pas - i) * d ** i));
  for (let n = pas - 1; n >= 0; n--) for (let i = 0; i <= n; i++) v[i] = Math.max(disc * (p * v[i] + (1 - p) * v[i + 1]), pay(S * u ** (n - i) * d ** i));
  return v[0];
}
/** option asiatique (moyenne arithmétique de m observations) : Monte-Carlo avec une graine fixe (même prix à chaque appel) */
export function asiatique(type, S, K, T, r, sigma, q = 0, obs = 12, chemins = 4000, seed = 99) {
  const rr = rng(seed), dt = T / obs, drift = (r - q - sigma * sigma / 2) * dt, vs = sigma * Math.sqrt(dt);
  let sum = 0;
  for (let c = 0; c < chemins; c++) {
    // variable antithétique : deux chemins symétriques par tirage
    let s1 = S, s2 = S, a1 = 0, a2 = 0;
    for (let i = 0; i < obs; i++) { const z = gauss(rr); s1 *= Math.exp(drift + vs * z); s2 *= Math.exp(drift - vs * z); a1 += s1; a2 += s2; }
    a1 /= obs; a2 /= obs;
    sum += (Math.max(0, type === 'call' ? a1 - K : K - a1) + Math.max(0, type === 'call' ? a2 - K : K - a2)) / 2;
  }
  return Math.exp(-r * T) * sum / chemins;
}
/** volatilité utilisée pour les options d'un actif (celle du modèle) */
export function volDe(a) { return a.fx ? a.vol : a.matiere ? a.vol : Math.sqrt(a.vol ** 2 + (a.beta * 0.16) ** 2 + 0.01); }

/* ---------------- questions de Pierre ---------------- */
const arr = (x, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
const fmt = (x, d = 2) => arr(x, d).toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
/** mélange déterministe des réponses ; la bonne réponse est repérée par son index */
function choix(r, bonne, fausses) {
  const all = [bonne, ...fausses.filter((f, i, A) => f !== bonne && A.indexOf(f) === i)].slice(0, 4);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  return { choix: all, bonne: all.indexOf(bonne) };
}
/** une question d'entretien (énoncé, 4 réponses, index de la bonne, explication) ; k : numéro du modèle */
export function question(m, k, seed) {
  const r = rng(seed * 31 + k * 977 + 5);
  const pick = (L) => L[Math.floor(r() * L.length)];
  const a = pick(ACTIONS), S = arr(m.prix[a.id]), T = pick([0.5, 1, 2]), K = Math.round(S * pick([0.9, 1, 1.1]));
  switch (k % 10) {
    case 0: { // forward d'une action avec dividende
      const F = forward(S, R_PD, T, a.q);
      return { q: `${a.nom} cote ${fmt(S)} ₽, verse un dividende continu de ${fmt(a.q * 100, 1)} % et le taux est de ${fmt(R_PD * 100, 1)} %. Prix à terme dans ${T} an(s) ?`, ...choix(r, fmt(F) + ' ₽', [fmt(S * Math.exp(R_PD * T)) + ' ₽', fmt(S) + ' ₽', fmt(S * Math.exp(-(R_PD - a.q) * T)) + ' ₽']), exp: `F = S·e^((r−q)T) = ${fmt(F)} ₽ : on porte l'action au taux r, moins le dividende qu'on ne touche pas.` };
    }
    case 1: { // future sur Poké Balls avec stockage
      const b = MATIERES[0], Sb = arr(m.prix[b.id]), F = forward(Sb, R_PD, T, 0, b.u, b.y);
      return { q: `Une Poké Ball vaut ${fmt(Sb)} ₽ comptant. Taux ${fmt(R_PD * 100, 1)} %, stockage ${fmt(b.u * 100, 1)} %/an, rendement d'opportunité ${fmt(b.y * 100, 1)} %/an. Future à ${T} an(s) ?`, ...choix(r, fmt(F) + ' ₽', [fmt(Sb * Math.exp((R_PD - b.u + b.y) * T)) + ' ₽', fmt(Sb * Math.exp(R_PD * T)) + ' ₽', fmt(Sb) + ' ₽']), exp: `F = S·e^((r+u−y)T) = ${fmt(F)} ₽ : le stockage s'ajoute au portage, l'avantage d'avoir l'objet en main se retranche.` };
    }
    case 2: { // change à terme
      const Sx = arr(m.prix.PDE, 4), F = changeATerme(Sx, R_PD, R_PE, T);
      return { q: `1 € vaut ${fmt(Sx, 4)} ₽. Taux du Pokédollar ${fmt(R_PD * 100, 1)} %, du Pokéeuro ${fmt(R_PE * 100, 1)} %. Cours à terme à ${T} an(s) ?`, ...choix(r, fmt(F, 4) + ' ₽', [fmt(Sx * Math.exp((R_PE - R_PD) * T), 4) + ' ₽', fmt(Sx, 4) + ' ₽', fmt(Sx * Math.exp(R_PD * T), 4) + ' ₽']), exp: `Parité des taux : F = S·e^((r₽−r€)T). La monnaie au taux le plus bas (€) se traite plus cher à terme.` };
    }
    case 3: { // swap de change : points
      const Sx = arr(m.prix.PDE, 4), p = pointsSwap(Sx, R_PD, R_PE, 1);
      return { q: `Swap de change 1 an sur l'€ (comptant ${fmt(Sx, 4)} ₽, r₽ ${fmt(R_PD * 100, 1)} %, r€ ${fmt(R_PE * 100, 1)} %). Les points de swap sont…`, ...choix(r, `positifs (+${fmt(p, 4)} ₽)`, [`négatifs (−${fmt(p, 4)} ₽)`, 'nuls : un swap ne coûte rien', `positifs (+${fmt(Sx * 0.03, 4)} ₽)`]), exp: `Points = F − S = ${fmt(p, 4)} ₽ > 0 car r₽ > r€.` };
    }
    case 4: { // CDS
      const pr = primeCDS(a.lambda);
      return { q: `${a.nom} a un taux de défaut de ${fmt(a.lambda * 100, 1)} % par an et on récupère 40 % en cas de faillite. Prime de CDS annuelle (approx.) ?`, ...choix(r, fmt(pr * 1e4, 0) + ' points de base', [fmt(a.lambda * 1e4, 0) + ' points de base', fmt(a.lambda * 0.4 * 1e4, 0) + ' points de base', fmt((1 - Math.exp(-a.lambda)) * 1e4 * 2, 0) + ' points de base']), exp: `Prime ≈ λ × (1 − R) = ${fmt(a.lambda * 100, 1)} % × 60 % = ${fmt(pr * 1e4, 0)} pb.` };
    }
    case 5: { // swap de taux
      const n = pick([2, 3, 5]), s = tauxSwap(R_PD, n);
      return { q: `Courbe plate à ${fmt(R_PD * 100, 1)} % (taux continu). Taux fixe d'un swap ${n} ans à paiements annuels ?`, ...choix(r, fmt(s * 100, 3) + ' %', [fmt(R_PD * 100, 3) + ' %', fmt((Math.exp(R_PD) - 1) * 100 + 0.2, 3) + ' %', fmt(R_PD * 100 * 0.9, 3) + ' %']), exp: `Taux fixe = (1 − DF(${n})) / ΣDF = ${fmt(s * 100, 3)} % (c'est le taux annuel équivalent, un peu au-dessus du taux continu).` };
    }
    case 6: { // option européenne
      const sig = arr(volDe(a), 2), c = blackScholes('call', S, K, T, R_PD, sig, a.q);
      return { q: `Call européen sur ${a.nom} : S = ${fmt(S)} ₽, K = ${K} ₽, ${T} an(s), vol ${fmt(sig * 100, 0)} %, r ${fmt(R_PD * 100, 1)} %, dividende ${fmt(a.q * 100, 1)} %. Prix ?`, ...choix(r, fmt(c) + ' ₽', [fmt(Math.max(0, S - K)) + ' ₽', fmt(blackScholes('put', S, K, T, R_PD, sig, a.q)) + ' ₽', fmt(c * 1.6) + ' ₽']), exp: `Black-Scholes : ${fmt(c)} ₽ (la valeur intrinsèque ${fmt(Math.max(0, S - K))} ₽ plus la valeur temps).` };
    }
    case 7: { // américaine
      const sig = arr(volDe(a), 2), pa = americaine('put', S, K, T, R_PD, sig, a.q), pe = blackScholes('put', S, K, T, R_PD, sig, a.q);
      return { q: `Put AMÉRICAIN sur ${a.nom} (S = ${fmt(S)} ₽, K = ${K} ₽, ${T} an(s), vol ${fmt(sig * 100, 0)} %, r ${fmt(R_PD * 100, 1)} %). Le put européen vaut ${fmt(pe)} ₽. Et l'américain ?`, ...choix(r, fmt(pa) + ' ₽', [fmt(pe * 0.9) + ' ₽', fmt(Math.max(0, K - S)) + ' ₽', fmt(pe * 1.8 + 1) + ' ₽']), exp: `Arbre binomial : ${fmt(pa)} ₽ ≥ ${fmt(pe)} ₽ — le droit d'exercer plus tôt a toujours une valeur positive ou nulle.` };
    }
    case 8: { // asiatique : concept
      return { q: `Un call ASIATIQUE (sur la moyenne des cours) et un call européen ont les mêmes S, K, T, vol. Lequel est le moins cher ?`, ...choix(r, 'L\'asiatique : la moyenne bouge moins que le cours final', ['L\'européen : il n\'a qu\'une date d\'exercice', 'Ils valent pareil', 'Ça dépend du dividende uniquement']), exp: `La moyenne lisse les variations : moins de volatilité, donc une option moins chère.` };
    }
    default: { // corrélations et nouvelles
      const L = [
        ['La Sylphe annonce une pénurie de Poké Balls. Que fait probablement l\'action Devon, son concurrent qui vend aussi des Balls ?', 'Elle baisse un peu, ou monte si Devon récupère les clients : c\'est un concurrent (anticorrélé à court terme)', ['Exactement comme la Sylphe', 'Rien : aucun lien', 'Elle est suspendue de cotation'], 'Deux concurrents réagissent souvent en sens inverse à une nouvelle propre à l\'un d\'eux.'],
        ['Une tempête bloque les ferries. Quel actif réagit le MOINS ?', 'Lustrelle Cosmétiques', ['Ferry de l\'Est', 'Chantiers d\'Écaille', 'Huile de Magma'], 'Les cosmétiques n\'ont presque aucun lien avec la mer : actif décorrélé.'],
        ['Le Pokéeuro monte face au Pokédollar. Un dresseur de Kalos qui achète des actions de Métropole les trouve…', 'Moins chères dans sa monnaie', ['Plus chères dans sa monnaie', 'Au même prix', 'Interdites'], 'Avec un € plus fort, il faut moins d\'€ pour le même nombre de ₽.'],
        ['Tu détiens un call sur la Sylphe. Si le cours monte, la valeur du call…', 'Monte (delta positif)', ['Baisse (delta négatif)', 'Ne bouge pas', 'Monte seulement si c\'est un put'], 'Le delta d\'un call est entre 0 et 1 : il monte avec le sous-jacent.'],
      ];
      const [q, b, f, exp] = L[Math.floor(r() * L.length)];
      return { q, ...choix(r, b, f), exp };
    }
  }
}
/** entretien de Pierre : 8 questions de modèles différents ; 6 bonnes réponses pour être embauché */
export function entretien(m, seed) {
  const r = rng(seed + 3), ks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]; for (let i = ks.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ks[i], ks[j]] = [ks[j], ks[i]]; }
  return ks.slice(0, 8).map((k, i) => question(m, k, seed + i * 13));
}
export const SEUIL_EMBAUCHE = 6;

/* ---------------- portefeuille ---------------- */
/** prix d'un actif (l'indice compris) */
export function prixDe(m, id) { return id === INDICE.id ? indice(m) / 10 : m.prix[id]; }   // un « tracker » de l'indice vaut 1/10e de point
/** achat (qte > 0) ou vente (qte < 0) au cours du moment ; frais de 0,2 % ; renvoie le montant débité (négatif si crédité) */
export function ordre(m, id, qte, argent) {
  const p = prixDe(m, id), pos = m.positions[id] || { qte: 0, pru: 0 };
  if (qte < 0 && -qte > pos.qte) return { ok: false, err: 'Tu n\'as pas autant de titres à vendre.' };
  const brut = p * qte, frais = Math.abs(brut) * 0.002, total = Math.round(brut + frais);
  if (total > argent) return { ok: false, err: 'Pas assez de Pokédollars.' };
  if (qte > 0) pos.pru = (pos.pru * pos.qte + p * qte) / (pos.qte + qte);
  pos.qte += qte; if (pos.qte === 0) delete m.positions[id]; else m.positions[id] = pos;
  return { ok: true, total, prix: p };
}
/** valeur du portefeuille et plus-value latente */
export function valeur(m) {
  let v = 0, pv = 0;
  for (const [id, pos] of Object.entries(m.positions)) { const p = prixDe(m, id); v += p * pos.qte; pv += (p - pos.pru) * pos.qte; }
  return { valeur: v, plusValue: pv };
}
