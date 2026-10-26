// Épreuves SQL de The Candidate tirées à la volée : l'énoncé (colonne, seuil, sens, filtre) et les trois bases
// (une d'exemple, deux cachées) changent à chaque partie. Le résultat attendu est calculé ici, en JavaScript ;
// tools/test-calcul.mjs le revérifie en passant la requête de référence dans SQLite.
// Même format que SQL_QUESTIONS (code-data.js) : { id, level, lang, ordered, title, prompt, starter, tests, ref, tip }.

const between = (r, a, b) => a + r.int(b - a + 1);
const pick = (r, l) => l[r.int(l.length)];
const TRADERS = ['Alice', 'Bruno', 'Chloé', 'David', 'Emma', 'Farid', 'Gaëlle'];
const TICKERS = ['AIR', 'BNP', 'DSY', 'KER', 'MC', 'OR', 'SAN', 'TTE'];
const TRADE_COLS = ['id INTEGER', 'trader TEXT', 'ticker TEXT', 'qty INTEGER', 'price REAL', 'side TEXT'];
// tri comme SQLite (ordre binaire des caractères, pas l'ordre du dictionnaire)
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const sum = (l) => l.reduce((a, b) => a + b, 0);

function tradesTable(r) {
  const n = between(r, 9, 15), traders = r.shuffle([...TRADERS]).slice(0, between(r, 4, 6)), tickers = r.shuffle([...TICKERS]).slice(0, between(r, 4, 6));
  const rows = Array.from({ length: n }, (_, k) => [k + 1, pick(r, traders), pick(r, tickers), 10 * between(r, 1, 20), between(r, 200, 4000) / 10, r.next() < 0.5 ? 'BUY' : 'SELL']);
  return { name: 'trades', cols: TRADE_COLS, rows };
}
const COL = { trader: 1, ticker: 2, qty: 3, price: 4, side: 5 };
const groupBy = (rows, col) => rows.reduce((m, row) => ((m[row[COL[col]]] = m[row[COL[col]]] || []).push(row), m), {});
const LABEL = { trader: 'trader', ticker: 'ticker' };

// Chaque modèle : level, et make(r) → { id, title, prompt, ref, tip, ordered, expect(tables) → lignes ou null (base à retirer) }
const TEMPLATES = [
  { level: 1, make: (r) => {
    const [cond, txt, f] = pick(r, [
      ...['BUY', 'SELL'].map((s) => [`side = '${s}'`, `${s === 'BUY' ? 'd\'achat' : 'de vente'} (side = '${s}')`, (row) => row[5] === s]),
      ...[50, 80, 100, 150].map((q) => [`qty >= ${q}`, `d'au moins ${q} titres (qty >= ${q})`, (row) => row[3] >= q]),
      ...[100, 200, 250].map((p) => [`price > ${p}`, `à plus de ${p} € (price > ${p})`, (row) => row[4] > p]),
    ]);
    return { id: 'count', title: 'Combien de trades ?', ordered: false, prompt: `Combien de trades ${txt} ? Une seule valeur.`, ref: `SELECT COUNT(*) FROM trades WHERE ${cond}`,
      tip: 'WHERE filtre les lignes avant le comptage : COUNT(*) ne compte que celles qui restent.', expect: ([t]) => { const c = t.rows.filter(f).length; return c >= 2 ? [[c]] : null; } };
  } },
  { level: 1, make: (r) => {
    const col = pick(r, ['trader', 'ticker']), desc = r.next() < 0.4;
    return { id: 'distinct', title: `Les ${col === 'trader' ? 'traders' : 'titres'} du jour`, ordered: true,
      prompt: `Liste les ${col}s distincts de la table trades, par ordre alphabétique${desc ? ' inverse (de Z à A)' : ''}.`, ref: `SELECT DISTINCT ${col} FROM trades ORDER BY ${col}${desc ? ' DESC' : ''}`,
      tip: `DISTINCT retire les doublons, ORDER BY ${col}${desc ? ' DESC' : ''} trie. Sans DISTINCT, chaque ${col} sortirait autant de fois qu'il apparaît.`,
      expect: ([t]) => { const v = [...new Set(t.rows.map((row) => row[COL[col]]))].sort(cmp); if (desc) v.reverse(); return v.map((x) => [x]); } };
  } },
  { level: 1, make: (r) => {
    const s = pick(r, ['BUY', 'SELL']), q = pick(r, [50, 80, 100, 120]);
    return { id: 'ids', title: 'Les gros ordres', ordered: true, prompt: `Les id des ${s === 'BUY' ? 'achats' : 'ventes'} (side = '${s}') de plus de ${q} titres (qty > ${q}), par id croissant.`,
      ref: `SELECT id FROM trades WHERE side = '${s}' AND qty > ${q} ORDER BY id`, tip: 'Deux conditions dans le WHERE, reliées par AND : il faut que les deux soient vraies.',
      expect: ([t]) => { const v = t.rows.filter((row) => row[5] === s && row[3] > q).map((row) => [row[0]]); return v.length >= 2 ? v : null; } };
  } },
  { level: 2, make: (r) => {
    const col = pick(r, ['trader', 'ticker']), what = pick(r, ['qty', 'volume']), side = pick(r, [null, 'BUY', 'SELL']);
    const expr = what === 'qty' ? 'qty' : 'qty * price', name = what === 'qty' ? 'titres' : 'volume';
    return { id: 'sum', title: `${what === 'qty' ? 'Titres' : 'Volume'} par ${LABEL[col]}`, ordered: true,
      prompt: `${what === 'qty' ? 'Nombre total de titres (qty)' : 'Volume total (qty × price)'} par ${col}${side ? `, pour les ${side === 'BUY' ? 'achats' : 'ventes'} seulement` : ''}, du plus grand au plus petit. Colonnes : ${col}, ${name}.`,
      ref: `SELECT ${col}, SUM(${expr}) AS ${name} FROM trades${side ? ` WHERE side = '${side}'` : ''} GROUP BY ${col} ORDER BY ${name} DESC`,
      tip: `${side ? 'WHERE garde les bonnes lignes, puis ' : ''}GROUP BY ${col} fait une ligne par ${col} ; SUM additionne ${expr} dans chaque groupe ; ORDER BY ${name} DESC trie.`,
      expect: ([t]) => {
        const g = groupBy(t.rows.filter((row) => !side || row[5] === side), col);
        const v = Object.entries(g).map(([k, l]) => [k, sum(l.map((row) => (what === 'qty' ? row[3] : row[3] * row[4])))]).sort((a, b) => b[1] - a[1]);
        return v.length >= 2 && new Set(v.map((x) => Math.round(x[1] * 100))).size === v.length ? v : null; // pas d'égalité : l'ordre est sans ambiguïté
      } };
  } },
  { level: 2, make: (r) => {
    const col = pick(r, ['trader', 'ticker']), k = pick(r, [2, 3, 4]);
    return { id: 'having', title: `Les ${col === 'trader' ? 'traders' : 'titres'} les plus actifs`, ordered: true,
      prompt: `Les ${col}s qui ont au moins ${k} trades, par ordre alphabétique.`, ref: `SELECT ${col} FROM trades GROUP BY ${col} HAVING COUNT(*) >= ${k} ORDER BY ${col}`,
      tip: 'HAVING filtre après le regroupement (sur COUNT), là où WHERE filtre les lignes avant.',
      expect: ([t]) => { const v = Object.entries(groupBy(t.rows, col)).filter(([, l]) => l.length >= k).map(([x]) => [x]).sort((a, b) => cmp(a[0], b[0])); return v.length ? v : null; } };
  } },
  { level: 2, make: (r) => {
    const col = pick(r, ['trader', 'ticker']), agg = pick(r, ['MAX', 'MIN']), side = pick(r, ['BUY', 'SELL']);
    const name = agg === 'MAX' ? 'prix_max' : 'prix_min';
    return { id: 'maxmin', title: `Prix ${agg === 'MAX' ? 'le plus haut' : 'le plus bas'}`, ordered: true,
      prompt: `Pour chaque ${col}, le prix ${agg === 'MAX' ? 'le plus haut' : 'le plus bas'} de ses ${side === 'BUY' ? 'achats' : 'ventes'} (side = '${side}'), par ordre alphabétique. Colonnes : ${col}, ${name}.`,
      ref: `SELECT ${col}, ${agg}(price) AS ${name} FROM trades WHERE side = '${side}' GROUP BY ${col} ORDER BY ${col}`,
      tip: `On filtre (WHERE side = '${side}'), on regroupe par ${col}, puis ${agg}(price) dans chaque groupe.`,
      expect: ([t]) => { const v = Object.entries(groupBy(t.rows.filter((row) => row[5] === side), col)).map(([k, l]) => [k, (agg === 'MAX' ? Math.max : Math.min)(...l.map((row) => row[4]))]).sort((a, b) => cmp(a[0], b[0])); return v.length >= 2 ? v : null; } };
  } },
  { level: 2, make: (r) => {
    const col = pick(r, ['trader', 'ticker']);
    return { id: 'avgqty', title: 'Taille moyenne des ordres', ordered: true,
      prompt: `Nombre moyen de titres par trade (qty), pour chaque ${col}, par ordre alphabétique. Pas besoin d'arrondir. Colonnes : ${col}, qty_moyenne.`,
      ref: `SELECT ${col}, AVG(qty) AS qty_moyenne FROM trades GROUP BY ${col} ORDER BY ${col}`, tip: `AVG fait la moyenne dans chaque groupe formé par GROUP BY ${col}.`,
      expect: ([t]) => Object.entries(groupBy(t.rows, col)).map(([k, l]) => [k, sum(l.map((row) => row[3])) / l.length]).sort((a, b) => cmp(a[0], b[0])) };
  } },
  { level: 3, make: (r) => {
    const col = pick(r, ['trader', 'ticker']), what = pick(r, ['qty', 'volume']), expr = what === 'qty' ? 'qty' : 'qty * price', least = r.next() < 0.3;
    return { id: 'top', title: `Le ${col === 'trader' ? 'trader' : 'titre'} ${least ? 'le moins' : 'le plus'} actif`, ordered: true,
      prompt: `Le ${col} au ${least ? 'plus petit' : 'plus gros'} ${what === 'qty' ? 'nombre total de titres (qty)' : 'volume total (qty × price)'}. Une seule ligne, une colonne : ${col}.`,
      ref: `SELECT ${col} FROM trades GROUP BY ${col} ORDER BY SUM(${expr})${least ? '' : ' DESC'} LIMIT 1`,
      tip: `On trie les groupes par SUM(${expr}) ${least ? 'croissante' : 'décroissante'} et on garde la première ligne avec LIMIT 1.`,
      expect: ([t]) => {
        const v = Object.entries(groupBy(t.rows, col)).map(([k, l]) => [k, sum(l.map((row) => (what === 'qty' ? row[3] : row[3] * row[4])))]).sort((a, b) => (least ? a[1] - b[1] : b[1] - a[1]));
        return v.length >= 2 && Math.abs(v[0][1] - v[1][1]) > 0.01 ? [[v[0][0]]] : null;
      } };
  } },
  { level: 3, make: (r) => {
    const col = pick(r, ['trader', 'ticker']);
    return { id: 'net', title: 'Position nette', ordered: true,
      prompt: `Position nette par ${col} : titres achetés moins titres vendus, par ordre alphabétique. Colonnes : ${col}, net.`,
      ref: `SELECT ${col}, SUM(CASE WHEN side = 'BUY' THEN qty ELSE -qty END) AS net FROM trades GROUP BY ${col} ORDER BY ${col}`,
      tip: 'CASE WHEN transforme chaque vente en quantité négative ; SUM fait le solde de chaque groupe.',
      expect: ([t]) => Object.entries(groupBy(t.rows, col)).map(([k, l]) => [k, sum(l.map((row) => (row[5] === 'BUY' ? row[3] : -row[3])))]).sort((a, b) => cmp(a[0], b[0])) };
  } },
  { level: 3, tables: 'clients', make: (r) => {
    const kind = pick(r, ['country', 'count', 'none']), k = pick(r, [2, 3]);
    const base = 'Les tables : clients(id, nom, pays) et ordres(id, client_id, montant).';
    if (kind === 'country') return { id: 'join_pays', title: 'Montant par pays', ordered: true, prompt: `Montant total des ordres par pays du client, par ordre alphabétique des pays. Colonnes : pays, total. ${base}`,
      ref: 'SELECT c.pays, SUM(o.montant) AS total FROM ordres o JOIN clients c ON c.id = o.client_id GROUP BY c.pays ORDER BY c.pays',
      tip: 'La jointure relie chaque ordre à son client (ordres.client_id = clients.id), puis on regroupe par pays.',
      expect: ([c, o]) => { const m = {}; for (const [, cid, mt] of o.rows) { const p = c.rows.find((x) => x[0] === cid)[2]; m[p] = (m[p] || 0) + mt; } return Object.entries(m).sort((a, b) => cmp(a[0], b[0])); } };
    if (kind === 'count') return { id: 'join_count', title: 'Les bons clients', ordered: true, prompt: `Les noms des clients qui ont passé au moins ${k} ordres, par ordre alphabétique. ${base}`,
      ref: `SELECT c.nom FROM clients c JOIN ordres o ON o.client_id = c.id GROUP BY c.id, c.nom HAVING COUNT(*) >= ${k} ORDER BY c.nom`,
      tip: 'Jointure, regroupement par client, puis HAVING sur le nombre d\'ordres.',
      expect: ([c, o]) => { const v = c.rows.filter((x) => o.rows.filter((y) => y[1] === x[0]).length >= k).map((x) => [x[1]]).sort((a, b) => cmp(a[0], b[0])); return v.length ? v : null; } };
    return { id: 'join_none', title: 'Clients sans ordre', ordered: true, prompt: `Les noms des clients qui n'ont passé aucun ordre, par ordre alphabétique. ${base}`,
      ref: 'SELECT c.nom FROM clients c LEFT JOIN ordres o ON o.client_id = c.id WHERE o.id IS NULL ORDER BY c.nom',
      tip: 'LEFT JOIN garde tous les clients, même sans ordre (les colonnes d\'ordres valent alors NULL) : on garde ceux-là.',
      expect: ([c, o]) => { const v = c.rows.filter((x) => !o.rows.some((y) => y[1] === x[0])).map((x) => [x[1]]).sort((a, b) => cmp(a[0], b[0])); return v.length ? v : null; } };
  } },
];
const NAMES = ['Arnaud', 'Béatrice', 'Camille', 'Dorian', 'Élise', 'Farid', 'Gaëlle', 'Hugo'], PAYS = ['Belgique', 'Canada', 'France', 'Suisse'];
function clientTables(r) {
  const names = r.shuffle([...NAMES]).slice(0, between(r, 5, 7)), clients = names.map((n, k) => [k + 1, n, pick(r, PAYS)]);
  const ordres = Array.from({ length: between(r, 7, 11) }, (_, k) => [k + 1, between(r, 1, clients.length), 100 * between(r, 1, 50)]);
  return [{ name: 'clients', cols: ['id INTEGER', 'nom TEXT', 'pays TEXT'], rows: clients }, { name: 'ordres', cols: ['id INTEGER', 'client_id INTEGER', 'montant INTEGER'], rows: ordres }];
}

// Une épreuve SQL du niveau demandé (null si le tirage n'a rien donné : la liste fixe prend le relais)
export function sqlQuestion(r, level) {
  const pool = TEMPLATES.filter((t) => t.level === level);
  for (let tries = 0; tries < 5 && pool.length; tries++) {
    const T = pick(r, pool), q = T.make(r), tests = [];
    for (let k = 0; k < 30 && tests.length < 3; k++) {
      const tables = T.tables === 'clients' ? clientTables(r) : [tradesTable(r)], exp = q.expect(tables);
      if (exp && exp.length && !(exp.length === 1 && exp[0].length === 1 && exp[0][0] === 1)) tests.push([[tables], exp]);
    }
    if (tests.length < 3) continue;
    return { id: `sqlgen_${q.id}`, level, lang: 'sql', ordered: q.ordered, title: q.title, prompt: q.prompt,
      starter: `-- ${q.prompt.split('. Colonnes')[0].split(' Les tables')[0]}\nSELECT `, tests, ref: q.ref, tip: q.tip };
  }
  return null;
}
export const SQL_TEMPLATE_COUNT = TEMPLATES.length;
