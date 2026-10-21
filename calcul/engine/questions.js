// Générateur de questions de Tête de Calcul. Pur et reproductible : la question n° i d'une partie ne dépend
// que de la graine de la partie, de i et du réglage. N'importe quel joueur peut donc la recalculer
// (reprise après migration d'hôte), et les tests tournent sous Node.
//
// Chaque question : { cat, kind, text, sub, eq, input: 'num'|'expr', time (s), answer, tol, show, tip, nums?, target?, sol? }
//   answer  valeur attendue (nombre, parfois décimal) ; pour 'expr', la cible
//   tol     tolérance relative acceptée (estimations), 0 sinon
//   eq      false quand le texte contient déjà son « ? » (suites, nombre manquant)
//   show    réponse telle qu'on l'affiche au moment de la révélation
//   tip     l'astuce qui permettait d'aller vite
import { rngOf } from './rng.js';
import { evalExpr } from './expr.js';

export const CATS = {
  base:     { label: 'Calcul',            pts: 1, color: '#2b8cff', icon: '±' },
  astuce:   { label: 'Astuce',            pts: 2, color: '#ff5fa2', icon: '★' },
  theorie:  { label: 'Nombres',           pts: 2, color: '#b45cff', icon: 'π' },
  fraction: { label: 'Fractions',         pts: 2, color: '#1fc7c1', icon: '½' },
  suite:    { label: 'Suite logique',     pts: 2, color: '#e3262f', icon: '…' },
  estim:    { label: 'Ordre de grandeur', pts: 2, color: '#2fbf71', icon: '≈' },
  vf:        { label: 'Vrai ou faux',      pts: 1, color: '#f0a800', icon: '✓' },
  compare:   { label: 'Le plus grand',     pts: 1, color: '#8a4b2a', icon: '>' },
  equation:  { label: 'Équation',          pts: 2, color: '#3b4cc0', icon: 'x' },
  geo:       { label: 'Géométrie',         pts: 2, color: '#0f8a6a', icon: '△' },
  devinette: { label: 'Devinette',         pts: 2, color: '#c2185b', icon: '?' },
  compte:   { label: 'Compte est bon',    pts: 3, color: '#ff8a1f', icon: '🎯' },
};
export const DIFFS = ['facile', 'normal', 'expert'];

// Thèmes proposés dans le salon : catégories tirées et leur poids
export const THEMES = {
  mix:     { base: 18, astuce: 12, theorie: 10, fraction: 8, suite: 9, estim: 8, vf: 9, compare: 7, equation: 7, geo: 6, devinette: 4, compte: 6 },
  base:    { base: 100 },
  malin:   { astuce: 55, theorie: 45 },
  frac:    { fraction: 70, base: 30 },
  logique: { suite: 60, theorie: 40 },
  vite:    { base: 40, estim: 60 },
  flash:   { vf: 55, compare: 45 },
  algebre: { equation: 60, devinette: 40 },
  geo:     { geo: 70, estim: 30 },
  compte:  { compte: 100 },
};

const round4 = (x) => Math.round(x * 1e4) / 1e4;
export const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('fr-FR').replace(/ /g, ' ') : String(round4(n)).replace('.', ','));

// Graine propre à la question i (salt : autre tirage pour la même question, voir rules.fullQuestion)
function qSeed(seed, i, salt = 0) {
  let h = (seed ^ Math.imul(i + 1, 0x9E3779B1) ^ Math.imul(salt, 0x27D4EB2F)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B) >>> 0;
  return (h ^ (h >>> 13)) >>> 0;
}

// Liste des catégories de la partie : tirée une fois, d'après les poids du thème, sans trois fois la même d'affilée
export function planCats(seed, len, theme) {
  const w = THEMES[theme] || THEMES.mix;
  const r = rngOf({ seed: qSeed(seed, 9999) });
  const keys = Object.keys(w), total = keys.reduce((s, k) => s + w[k], 0);
  const out = [];
  for (let i = 0; i < len; i++) {
    let c;
    for (let tries = 0; tries < 10; tries++) {
      let x = r.next() * total; c = keys[0];
      for (const k of keys) { x -= w[k]; if (x < 0) { c = k; break; } }
      if (keys.length === 1 || !(out[i - 1] === c && out[i - 2] === c)) break;
    }
    out.push(c);
  }
  // le « Compte est bon » est plus long : jamais en première question d'un mélange
  if (keys.length > 1 && out[0] === 'compte') { const j = out.findIndex((c) => c !== 'compte'); if (j > 0) [out[0], out[j]] = [out[j], out[0]]; }
  return out;
}

const D = (diff) => Math.max(0, DIFFS.indexOf(diff)); // 0, 1, 2
const between = (r, a, b) => a + r.int(b - a + 1);
const pick = (r, list) => list[r.int(list.length)];
const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
const TIME = { base: [15, 12, 10], astuce: [20, 18, 15], theorie: [20, 18, 15], fraction: [22, 18, 15], suite: [22, 20, 16], estim: [22, 20, 16], compte: [60, 50, 45], vf: [9, 8, 7], compare: [10, 9, 8], equation: [20, 18, 16], geo: [22, 20, 18], devinette: [30, 26, 22] };

/* ------------------------------------------------------------ les 4 opérations */
function base(r, d) {
  const kind = pick(r, ['add', 'sub', 'mul', 'div', 'add', 'mul', 'chain', 'missing', 'half', 'prio']);
  let a, b, ans, text;
  if (kind === 'add') {
    const lo = [10, 100, 1000][d], hi = [99, 999, 9999][d];
    a = between(r, lo, hi); b = between(r, lo, hi); ans = a + b; text = `${fmt(a)} + ${fmt(b)}`;
  } else if (kind === 'sub') {
    const lo = [20, 100, 1000][d], hi = [99, 999, 9999][d];
    a = between(r, lo, hi); b = between(r, Math.floor(lo / 2), a - 1); ans = a - b; text = `${fmt(a)} − ${fmt(b)}`;
  } else if (kind === 'mul') {
    if (d === 0) { a = between(r, 2, 10); b = between(r, 2, 10); }
    else if (d === 1) { a = between(r, 12, 99); b = between(r, 3, 9); }
    else { a = between(r, 12, 49); b = between(r, 12, 39); }
    ans = a * b; text = `${fmt(a)} × ${fmt(b)}`;
  } else if (kind === 'div') {
    if (d === 0) { b = between(r, 2, 10); ans = between(r, 2, 10); }
    else if (d === 1) { b = between(r, 3, 9); ans = between(r, 12, 99); }
    else { b = between(r, 11, 25); ans = between(r, 12, 60); }
    a = b * ans; text = `${fmt(a)} ÷ ${fmt(b)}`;
  } else if (kind === 'chain') {
    const hi = [50, 400, 2500][d];
    a = between(r, 10, hi); b = between(r, 10, hi); const c = between(r, 5, a + b - 1);
    ans = a + b - c;
    return { kind, text: `${fmt(a)} + ${fmt(b)} − ${fmt(c)}`, answer: ans, tip: `De gauche à droite : ${fmt(a + b)} − ${fmt(c)} = ${fmt(ans)}` };
  } else if (kind === 'missing') {
    const op = pick(r, ['×', '+', '−']);
    if (op === '×') {
      b = between(r, [2, 3, 6][d], [9, 12, 19][d]); ans = between(r, [2, 6, 11][d], [10, 25, 40][d]);
      return { kind, text: `? × ${b} = ${fmt(ans * b)}`, eq: false, sub: 'Le nombre manquant', answer: ans, tip: `On divise : ${fmt(ans * b)} ÷ ${b} = ${ans}` };
    }
    const hi = [60, 600, 6000][d];
    a = between(r, 10, hi); b = between(r, 10, hi);
    if (op === '+') return { kind, text: `${fmt(a)} + ? = ${fmt(a + b)}`, eq: false, sub: 'Le nombre manquant', answer: b, tip: `On soustrait : ${fmt(a + b)} − ${fmt(a)} = ${fmt(b)}` };
    return { kind, text: `${fmt(a + b)} − ? = ${fmt(a)}`, eq: false, sub: 'Le nombre manquant', answer: b, tip: `${fmt(a + b)} − ${fmt(a)} = ${fmt(b)}` };
  } else if (kind === 'half') {
    const f = pick(r, d === 0 ? ['moitié', 'double'] : ['moitié', 'double', 'quart', 'triple']);
    const div = { moitié: 2, quart: 4 }[f], mul = { double: 2, triple: 3 }[f], art = f === 'moitié' ? 'La' : 'Le';
    if (div) {
      ans = between(r, [6, 120, 1200][d], [50, 999, 4999][d]); a = ans * div;
      return { kind, text: `${art} ${f} de ${fmt(a)}`, answer: ans, tip: div === 4 ? `La moitié de la moitié : ${fmt(a / 2)} puis ${fmt(ans)}` : `Moitié des milliers, des centaines… : ${fmt(ans)}` };
    }
    a = between(r, [12, 120, 1200][d], [49, 999, 4999][d]); ans = a * mul;
    return { kind, text: `${art} ${f} de ${fmt(a)}`, answer: ans, tip: `${fmt(a)} × ${mul} = ${fmt(ans)}` };
  } else {
    // priorités opératoires
    a = between(r, 2, [9, 20, 50][d]); b = between(r, 2, [9, 12, 15][d]); const c = between(r, 2, [9, 12, 15][d]);
    const form = pick(r, d === 0 ? ['a+bc', 'ab-c'] : ['a+bc', 'ab-c', '(a+b)c', 'ab+cd']);
    if (form === 'a+bc') { ans = a + b * c; text = `${a} + ${b} × ${c}`; }
    else if (form === 'ab-c') { ans = a * b - c; text = `${a} × ${b} − ${c}`; if (ans < 0) return base(r, d); }
    else if (form === '(a+b)c') { ans = (a + b) * c; text = `(${a} + ${b}) × ${c}`; }
    else { const e = between(r, 2, 9); ans = a * b + c * e; text = `${a} × ${b} + ${c} × ${e}`; }
    return { kind, text, sub: 'Attention aux priorités !', answer: ans, tip: form === '(a+b)c' ? `Les parenthèses d'abord : ${a + b} × ${c} = ${ans}` : `La multiplication passe avant : ${text.replace(/(\d+) × (\d+)/g, (m, x, y) => x * y)} = ${ans}` };
  }
  const tips = {
    add: 'Additionne d\'abord les centaines, puis les dizaines, puis les unités.',
    sub: 'Complète jusqu\'au nombre rond suivant, puis ajoute le reste.',
    mul: `Découpe : ${fmt(a)} × ${fmt(b)} = ${decomp(a, b)}.`,
    div: `Pense à l'envers : combien de fois ${fmt(b)} dans ${fmt(a)} ? ${fmt(b)} × ${fmt(ans)} = ${fmt(a)}.`,
  };
  return { kind, text, answer: ans, tip: tips[kind] };
}
function decomp(a, b) {
  if (a < 11) return `${fmt(a * b)}`;
  const t = Math.floor(a / 10) * 10, u = a - t;
  return u ? `${t} × ${b} + ${u} × ${b} = ${fmt(t * b)} + ${fmt(u * b)}` : `${fmt(a * b)}`;
}

/* ------------------------------------------------------------ astuces */
function astuce(r, d) {
  const kind = pick(r, ['equi', 'sq5', 'x11', 'pct', 'x5', 'x25', 'x9', 'x99', 'sqnear', 'compl', 'pct2', 'x15']);
  if (kind === 'equi') {
    const m = between(r, [2, 3, 4][d], [6, 9, 15][d]) * 10, e = between(r, 1, d === 0 ? 4 : 9);
    const a = m - e, b = m + e, ans = a * b;
    return { kind, text: `${a} × ${b}`, sub: 'Deux nombres à égale distance d\'un nombre rond…', answer: ans,
      tip: `(${m} − ${e})(${m} + ${e}) = ${m}² − ${e}² = ${fmt(m * m)} − ${e * e} = ${fmt(ans)}` };
  }
  if (kind === 'sq5') {
    const k = between(r, 1, [5, 9, 19][d]), n = 10 * k + 5, ans = n * n;
    return { kind, text: `${n}²`, sub: 'Un carré qui finit par 5', answer: ans, tip: `${k} × ${k + 1} = ${k * (k + 1)}, puis on colle 25 → ${fmt(ans)}` };
  }
  if (kind === 'x11') {
    const n = d === 2 && r.next() < 0.4 ? between(r, 101, 899) : between(r, d === 0 ? 11 : 19, 99);
    const ans = n * 11;
    let tip;
    if (n < 100) {
      const t = Math.floor(n / 10), u = n % 10, s = t + u;
      tip = s < 10 ? `${t} + ${u} = ${s}, on l'intercale : ${t}${s}${u}` : `${t} + ${u} = ${s} : on intercale ${s % 10} et on retient 1 → ${fmt(ans)}`;
    } else tip = `${n} × 10 + ${n} = ${fmt(n * 10)} + ${n} = ${fmt(ans)}`;
    return { kind, text: `${n} × 11`, sub: 'La multiplication éclair par 11', answer: ans, tip };
  }
  if (kind === 'pct') {
    // pourcentages inversés : a % de b = b % de a
    const b = pick(r, d === 0 ? [50, 10] : [50, 25, 20, 10, 200]);
    const step = { 50: 2, 25: 4, 20: 5, 10: 10, 200: 1 }[b];
    const a = step * between(r, Math.ceil(6 / step), Math.floor([40, 80, 96][d] / step));
    const ans = (a * b) / 100;
    return { kind, text: `${a} % de ${b}`, sub: 'Retourne le problème…', answer: ans, tip: `${a} % de ${b} = ${b} % de ${a} = ${fmt(ans)}` };
  }
  if (kind === 'x5') {
    const n = between(r, [12, 24, 120][d], [48, 198, 998][d]), ans = n * 5;
    return { kind, text: `${fmt(n)} × 5`, sub: '× 5, c\'est × 10 puis ÷ 2', answer: ans, tip: `${fmt(n)} × 10 = ${fmt(n * 10)}, la moitié : ${fmt(ans)}` };
  }
  if (kind === 'x25') {
    const n = d === 0 ? 4 * between(r, 2, 12) : between(r, [8, 12, 24][d], [48, 96, 396][d]), ans = n * 25;
    return { kind, text: `${fmt(n)} × 25`, sub: '× 25, c\'est × 100 puis ÷ 4', answer: ans, tip: `${fmt(n)} × 100 = ${fmt(n * 100)}, ÷ 4 = ${fmt(ans)}` };
  }
  if (kind === 'x9') {
    const n = between(r, [6, 12, 112][d], [19, 99, 999][d]), ans = n * 9;
    return { kind, text: `${fmt(n)} × 9`, sub: '× 9, c\'est × 10 moins une fois', answer: ans, tip: `${fmt(n * 10)} − ${fmt(n)} = ${fmt(ans)}` };
  }
  if (kind === 'x99') {
    const n = between(r, [3, 12, 24][d], [12, 49, 99][d]), m = d === 2 && r.next() < 0.5 ? 999 : 99, ans = n * m;
    return { kind, text: `${n} × ${m}`, sub: 'Presque une puissance de 10…', answer: ans, tip: `${n} × ${m + 1} − ${n} = ${fmt(n * (m + 1))} − ${n} = ${fmt(ans)}` };
  }
  if (kind === 'sqnear') {
    const k = between(r, 2, [6, 9, 15][d]), s = r.next() < 0.5 ? -1 : 1, m = 10 * k, n = m + s, ans = n * n;
    return { kind, text: `${n}²`, sub: 'Juste à côté d\'un nombre rond', answer: ans,
      tip: `(${m} ${s < 0 ? '−' : '+'} 1)² = ${fmt(m * m)} ${s < 0 ? '−' : '+'} ${2 * m} + 1 = ${fmt(ans)}` };
  }
  if (kind === 'compl') {
    const top = [100, 1000, 10000][d], n = between(r, Math.floor(top / 10) + 1, top - 1), ans = top - n;
    return { kind, text: `${fmt(top)} − ${fmt(n)}`, sub: 'Le complément', answer: ans, tip: `Chaque chiffre jusqu'à 9, le dernier jusqu'à 10 : ${fmt(ans)}` };
  }
  if (kind === 'x15') {
    // × 1,5 : le nombre plus sa moitié
    const n = 2 * between(r, [4, 12, 60][d], [20, 60, 500][d]), ans = n * 1.5;
    return { kind, text: `${fmt(n)} × 1,5`, sub: 'Le nombre plus sa moitié', answer: ans, tip: `${fmt(n)} + ${fmt(n / 2)} = ${fmt(ans)}` };
  }
  // 15 % de 80 : on passe par 10 %
  const p = pick(r, d === 0 ? [10, 20, 50] : [5, 15, 20, 30, 40, 60, 75]);
  const b = 20 * between(r, 1, [5, 15, 40][d]), ans = (p * b) / 100;
  return { kind: 'pct2', text: `${p} % de ${fmt(b)}`, sub: 'Passe par 10 %', answer: ans, tip: `10 % de ${fmt(b)} = ${fmt(b / 10)}, donc ${p} % = ${fmt(b / 10)} × ${p / 10} = ${fmt(ans)}` };
}

/* ------------------------------------------------------------ puissances, restes, racines, diviseurs… */
const isPrime = (n) => { if (n < 2) return false; for (let k = 2; k * k <= n; k++) if (n % k === 0) return false; return true; };
function theorie(r, d) {
  const kind = pick(r, ['pow', 'mod', 'sqrt', 'cube', 'pgcd', 'ppcm', 'fact', 'binary', 'prime', 'divs']);
  if (kind === 'pow') {
    const base = pick(r, d === 0 ? [2, 2, 3, 10] : [2, 2, 3, 5]);
    const max = { 2: [8, 10, 13][d], 3: [4, 5, 7][d], 5: [3, 4, 5][d], 10: [4, 4, 6][d] }[base];
    const min = { 2: [4, 6, 8][d], 3: [2, 3, 4][d], 5: [2, 3, 3][d], 10: [2, 3, 4][d] }[base];
    const e = between(r, min, max), ans = base ** e;
    const tip = base === 2 ? `Les puissances de 2 : 16, 32, 64, 128, 256, 512, 1 024… → 2^${e} = ${fmt(ans)}`
      : `${base}^${e} = ${Array(e).fill(base).join(' × ')} = ${fmt(ans)}`;
    return { kind, text: `${base}^${e}`, sub: 'Puissance', answer: ans, tip };
  }
  if (kind === 'mod') {
    const m = between(r, 3, [6, 9, 13][d]), q = between(r, [5, 10, 20][d], [15, 40, 90][d]), rem = between(r, 1, m - 1);
    const n = m * q + rem;
    return { kind, text: `${fmt(n)} mod ${m}`, sub: `Le reste de la division de ${fmt(n)} par ${m}`, answer: rem, tip: `${fmt(n)} = ${m} × ${q} + ${rem}, donc le reste vaut ${rem}` };
  }
  if (kind === 'sqrt') {
    const k = between(r, [4, 8, 12][d], [12, 20, 40][d]);
    const n = between(r, k * k + 1, (k + 1) * (k + 1) - 1);
    return { kind, text: `√${fmt(n)}`, sub: 'Entre quels entiers ? Donne le plus petit.', answer: k,
      tip: `${k}² = ${fmt(k * k)} < ${fmt(n)} < ${fmt((k + 1) * (k + 1))} = ${k + 1}², donc √${fmt(n)} est entre ${k} et ${k + 1}` };
  }
  if (kind === 'cube') {
    const n = between(r, 2, [5, 10, 15][d]), ans = n ** 3;
    return { kind, text: `${n}^3`, sub: 'Un cube', answer: ans, tip: `${n} × ${n} = ${n * n}, puis × ${n} = ${fmt(ans)}` };
  }
  if (kind === 'pgcd') {
    const g = between(r, 2, [6, 12, 25][d]);
    let x, y; do { x = between(r, 2, [5, 9, 12][d]); y = between(r, 2, [5, 9, 12][d]); } while (x === y || gcd(x, y) !== 1);
    return { kind, text: `PGCD(${g * x} ; ${g * y})`, sub: 'Le plus grand diviseur commun', answer: g, tip: `${g * x} = ${g} × ${x} et ${g * y} = ${g} × ${y}, et ${x}, ${y} n'ont plus de diviseur commun` };
  }
  if (kind === 'ppcm') {
    let a, b; do { a = between(r, 2, [10, 15, 24][d]); b = between(r, 2, [10, 15, 24][d]); } while (a === b);
    const ans = (a * b) / gcd(a, b);
    return { kind, text: `PPCM(${a} ; ${b})`, sub: 'Le plus petit multiple commun', answer: ans, tip: `${a} × ${b} ÷ PGCD(${a} ; ${b}) = ${a * b} ÷ ${gcd(a, b)} = ${ans}` };
  }
  if (kind === 'fact') {
    const n = between(r, 3, [5, 6, 8][d]);
    let ans = 1; for (let k = 2; k <= n; k++) ans *= k;
    return { kind, text: `${n}!`, sub: 'Factorielle', answer: ans, tip: `${Array.from({ length: n }, (_, k) => k + 1).join(' × ')} = ${fmt(ans)}` };
  }
  if (kind === 'binary') {
    const n = between(r, [3, 9, 33][d], [15, 63, 255][d]), bits = n.toString(2);
    const parts = [...bits].map((b, k) => (b === '1' ? 2 ** (bits.length - 1 - k) : 0)).filter(Boolean);
    return { kind, text: `${bits} en binaire`, sub: 'Écris-le en décimal', answer: n, tip: parts.length > 1 ? `${parts.join(' + ')} = ${n}` : `Un seul 1, au rang 2^${bits.length - 1} : ${n}` };
  }
  if (kind === 'prime') {
    const n = between(r, [10, 30, 100][d], [40, 120, 400][d]);
    let p = n + 1; while (!isPrime(p)) p++;
    const odd = Array.from({ length: p - n - 1 }, (_, k) => n + 1 + k).filter((x) => x % 2).slice(0, 3);
    return { kind, text: `Premier après ${n}`, sub: `Le plus petit nombre premier plus grand que ${n}`, answer: p,
      tip: (odd.length ? odd.map((x) => `${x} = ${smallFactor(x)} × ${x / smallFactor(x)}`).join(', ') + ' ; ' : '') + `${p} n'a pas d'autre diviseur que 1 et lui-même` };
  }
  // nombre de diviseurs
  const n = pick(r, d === 0 ? [6, 8, 10, 12, 15, 16, 18, 20] : d === 1 ? [12, 18, 20, 24, 28, 30, 36, 40, 45, 48] : [36, 48, 60, 72, 84, 90, 96, 100, 120]);
  const divs = Array.from({ length: n }, (_, k) => k + 1).filter((k) => n % k === 0);
  return { kind: 'divs', text: `Diviseurs de ${n}`, sub: 'Combien en a-t-il (1 et lui-même compris) ?', answer: divs.length, tip: divs.join(', ') };
}
const smallFactor = (x) => { for (let k = 2; k * k <= x; k++) if (x % k === 0) return k; return x; };

/* ------------------------------------------------------------ fractions et décimaux */
function fraction(r, d) {
  const kind = pick(r, ['fracof', 'dec', 'fracdec', 'fracpct', 'fracadd', 'fracof', 'dec']);
  if (kind === 'fracof') {
    const den = pick(r, d === 0 ? [2, 3, 4, 5, 10] : [3, 4, 5, 6, 8, 10, 12]);
    let num; do { num = between(r, 1, den - 1); } while (gcd(num, den) !== 1);
    const n = den * between(r, [2, 3, 6][d], [12, 25, 60][d]), ans = (n / den) * num;
    return { kind, text: `${num}/${den} de ${fmt(n)}`, sub: 'Une fraction d\'un nombre', answer: ans, tip: num === 1 ? `${fmt(n)} ÷ ${den} = ${fmt(ans)}` : `${fmt(n)} ÷ ${den} = ${fmt(n / den)}, puis × ${num} = ${fmt(ans)}` };
  }
  if (kind === 'dec') {
    const f = pick(r, d === 0 ? [0.5, 0.1, 2.5] : [0.5, 0.25, 0.2, 0.75, 1.5, 2.5, 0.125]);
    const step = { 0.5: 2, 0.1: 10, 2.5: 2, 0.25: 4, 0.2: 5, 0.75: 4, 1.5: 2, 0.125: 8 }[f];
    const n = step * between(r, [2, 3, 5][d], [20, 40, 125][d]), ans = round4(f * n);
    const why = { 0.5: 'la moitié', 0.1: 'divisé par 10', 2.5: '× 10 puis ÷ 4', 0.25: 'le quart', 0.2: '÷ 5', 0.75: 'les trois quarts', 1.5: 'le nombre plus sa moitié', 0.125: 'le huitième' }[f];
    return { kind, text: `${fmt(f)} × ${fmt(n)}`, sub: 'Un décimal bien connu', answer: ans, tip: `× ${fmt(f)}, c'est ${why} : ${fmt(ans)}` };
  }
  if (kind === 'fracdec') {
    const den = pick(r, d === 0 ? [2, 4, 5, 10] : [4, 5, 8, 20, 25, 40]);
    let num; do { num = between(r, 1, den - 1); } while (gcd(num, den) !== 1);
    const ans = round4(num / den);
    return { kind, text: `${num}/${den} en décimal`, sub: 'Écris-le avec une virgule', answer: ans, tip: `${num} ÷ ${den} = ${fmt(ans)}${den === 4 || den === 8 ? ' (pense aux quarts : 0,25 ; aux huitièmes : 0,125)' : ''}` };
  }
  if (kind === 'fracpct') {
    const den = pick(r, [2, 4, 5, 10, 20, 25, 50].slice(0, [4, 6, 7][d]));
    let num; do { num = between(r, 1, den - 1); } while (gcd(num, den) !== 1);
    const ans = (num * 100) / den;
    return { kind, text: `${num}/${den} en %`, sub: 'Combien de pour cent ?', answer: ans, tip: `On ramène sur 100 : ${num}/${den} = ${ans}/100 = ${ans} %` };
  }
  // somme de fractions, résultat en décimal
  const dens = d === 0 ? [2, 4] : [2, 4, 5, 10];
  const b = pick(r, dens), e = pick(r, dens), a = between(r, 1, b - 1), c = between(r, 1, e - 1);
  if (a * e === c * b) return fraction(r, d); // 1/2 + 1/2 : trop facile
  const ans = round4(a / b + c / e);
  return { kind: 'fracadd', text: `${a}/${b} + ${c}/${e}`, sub: 'Résultat en décimal (virgule acceptée)', answer: ans, tip: `${fmt(round4(a / b))} + ${fmt(round4(c / e))} = ${fmt(ans)}` };
}

/* ------------------------------------------------------------ suites logiques */
function suite(r, d) {
  const kind = pick(r, ['arith', 'geom', 'squares', 'fibo', 'incr', 'alt', 'primes', 'arith', 'geom']);
  let terms, ans, tip;
  if (kind === 'arith') {
    const s = between(r, [2, 3, 6][d], [9, 15, 40][d]) * (d > 0 && r.next() < 0.35 ? -1 : 1);
    const a = s < 0 ? between(r, 6 * -s, 9 * -s) : between(r, 1, [20, 60, 200][d]);
    terms = Array.from({ length: 4 }, (_, k) => a + k * s); ans = a + 4 * s;
    tip = `On ${s > 0 ? 'ajoute' : 'enlève'} ${Math.abs(s)} à chaque fois`;
  } else if (kind === 'geom') {
    const q = between(r, 2, [3, 4, 5][d]), a = between(r, 1, [5, 6, 9][d]);
    terms = Array.from({ length: 4 }, (_, k) => a * q ** k); ans = a * q ** 4;
    tip = `On multiplie par ${q} à chaque fois`;
  } else if (kind === 'squares') {
    const p = d === 2 && r.next() < 0.4 ? 3 : 2, k = between(r, 1, [6, 9, 6][d]);
    terms = Array.from({ length: 4 }, (_, j) => (k + j) ** p); ans = (k + 4) ** p;
    tip = `Les ${p === 2 ? 'carrés' : 'cubes'} : ${k + 4}${p === 2 ? '²' : '³'} = ${fmt(ans)}`;
  } else if (kind === 'fibo') {
    let a = between(r, 1, [4, 9, 20][d]), b = between(r, a, a + [5, 9, 20][d]);
    terms = [a, b]; for (let k = 0; k < 3; k++) { [a, b] = [b, a + b]; terms.push(b); }
    ans = terms[3] + terms[4];
    tip = `Chaque nombre est la somme des deux précédents : ${terms[3]} + ${terms[4]} = ${ans}`;
  } else if (kind === 'incr') {
    const a = between(r, 1, 20), s = between(r, 1, [3, 5, 9][d]), g = d === 0 ? 1 : between(r, 1, 3);
    terms = [a]; for (let k = 0; k < 4; k++) terms.push(terms[k] + s + g * k);
    ans = terms[4] + s + g * 4;
    tip = `Les écarts augmentent de ${g} : +${s}, +${s + g}, +${s + 2 * g}… puis +${s + 4 * g}`;
  } else if (kind === 'alt') {
    // deux opérations en alternance : + a, × b
    const a = between(r, 1, [5, 9, 15][d]), b = between(r, 2, 3), x = between(r, 1, 9);
    terms = [x]; for (let k = 0; k < 4; k++) terms.push(k % 2 ? terms[k] * b : terms[k] + a);
    ans = terms[4] + a;
    tip = `En alternance : + ${a}, × ${b}, + ${a}, × ${b}… donc ${terms[4]} + ${a} = ${ans}`;
  } else {
    const P = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
    const s = between(r, 0, [2, 8, 18][d]);
    terms = P.slice(s, s + 4); ans = P[s + 4];
    tip = `Les nombres premiers : ${ans} vient ensuite`;
  }
  return { kind, text: `${terms.map(fmt).join(', ')}, ?`, eq: false, sub: 'Quel est le nombre suivant ?', answer: ans, tip };
}

/* ------------------------------------------------------------ vitesses, unités, proportions, estimations */
const FAMOUS = [
  { text: '365 × 24', sub: 'Les heures d\'une année', ans: 8760, tip: '365 × 24 = 400 × 24 − 35 × 24 = 9 600 − 840 = 8 760' },
  { text: '60 × 60 × 24', sub: 'Les secondes d\'une journée', ans: 86400, tip: '3 600 × 24 = 86 400' },
  { text: '52 × 7', sub: 'Les jours de 52 semaines', ans: 364, tip: '50 × 7 + 2 × 7 = 350 + 14 = 364' },
  { text: '24 × 7', sub: 'Les heures d\'une semaine', ans: 168, tip: '25 × 7 − 7 = 175 − 7 = 168' },
  { text: '1 440 × 7', sub: 'Les minutes d\'une semaine', ans: 10080, tip: '1 440 × 7 = 10 080' },
  { text: '365 × 1 440', sub: 'Les minutes d\'une année', ans: 525600, tip: '365 × 1 440 ≈ 365 × 1 500 − 365 × 60 = 547 500 − 21 900 = 525 600' },
  { text: '12 × 31', sub: '12 mois de 31 jours', ans: 372, tip: '12 × 30 + 12 = 372' },
  { text: '3 600 × 8', sub: 'Les secondes d\'une journée de travail', ans: 28800, tip: '36 × 8 = 288, puis 00 → 28 800' },
];
const UNITS = [
  { from: 'km', to: 'm', f: 1000 }, { from: 'm', to: 'cm', f: 100 }, { from: 'L', to: 'cL', f: 100 }, { from: 'kg', to: 'g', f: 1000 },
  { from: 'h', to: 'min', f: 60 }, { from: 'min', to: 's', f: 60 }, { from: 'L', to: 'mL', f: 1000 }, { from: 'm²', to: 'dm²', f: 100 },
];
const GOODS = [['kg de pommes', 'kg'], ['croissants', 'croissants'], ['tickets de tram', 'tickets'], ['litres de jus', 'litres'], ['places de cinéma', 'places'], ['pan bagnats', 'pan bagnats']];
function estim(r, d) {
  const kind = pick(r, ['kmh', 'ms', 'train', 'approx', 'time', 'units', 'promo', 'rule3', 'avg', 'evol', 'approx']);
  if (kind === 'kmh') {
    const k = between(r, 1, [5, 8, 12][d]), v = 18 * k, ans = 5 * k;
    return { kind, text: `${v} km/h en m/s`, sub: 'Conversion express', answer: ans, tip: `On divise par 3,6 : ${v} ÷ 3,6 = ${ans} m/s` };
  }
  if (kind === 'ms') {
    const k = between(r, 1, [5, 8, 12][d]), v = 5 * k, ans = 18 * k;
    return { kind, text: `${v} m/s en km/h`, sub: 'Conversion express', answer: ans, tip: `On multiplie par 3,6 : ${v} × 3,6 = ${ans} km/h` };
  }
  if (kind === 'train') {
    const v = pick(r, [60, 90, 120, 150, 180, 240, 300]);
    const m = pick(r, d === 0 ? [10, 15, 20, 30] : [10, 12, 15, 20, 24, 30, 40, 45]);
    const dist = (v * m) / 60;
    if (!Number.isInteger(dist)) return estim(r, d);
    return { kind, text: `${dist} km à ${v} km/h`, sub: 'Combien de minutes de trajet ?', answer: m, tip: `${v} km/h = ${v / 60} km par minute, donc ${dist} ÷ ${v / 60} = ${m} min` };
  }
  if (kind === 'time') {
    const h = between(r, 1, [3, 5, 9][d]), m = pick(r, [10, 15, 20, 30, 40, 45, 50]);
    if (d > 0 && r.next() < 0.4) {
      const s = (h * 60 + m) * 60;
      return { kind, text: `${fmt(s)} s en minutes`, sub: 'Convertis', answer: h * 60 + m, tip: `${fmt(s)} ÷ 60 = ${h * 60 + m} min` };
    }
    return { kind, text: `${h} h ${m} en minutes`, sub: 'Convertis', answer: h * 60 + m, tip: `${h} × 60 + ${m} = ${h * 60 + m} min` };
  }
  if (kind === 'units') {
    const u = pick(r, d === 0 ? UNITS.slice(0, 4) : UNITS);
    const tenths = u.f === 60 ? pick(r, [0.5, 0.25, 0.75, 1.5, 2.5]) : round4(between(r, 2, [40, 90, 250][d]) / pick(r, d === 0 ? [10] : [10, 100]));
    const ans = round4(tenths * u.f);
    if (!Number.isInteger(ans)) return estim(r, d);
    return { kind, text: `${fmt(tenths)} ${u.from} en ${u.to}`, sub: 'Convertis', answer: ans, tip: `1 ${u.from} = ${fmt(u.f)} ${u.to}, donc ${fmt(tenths)} × ${fmt(u.f)} = ${fmt(ans)} ${u.to}` };
  }
  if (kind === 'promo') {
    const p = 20 * between(r, 1, [5, 15, 40][d]), x = pick(r, d === 0 ? [10, 50] : [10, 20, 25, 30, 40, 50]);
    const ans = p - (p * x) / 100;
    return { kind, text: `${fmt(p)} € −${x} %`, sub: 'Le prix soldé', answer: ans, tip: `${x} % de ${fmt(p)} = ${fmt((p * x) / 100)} €, donc ${fmt(p)} − ${fmt((p * x) / 100)} = ${fmt(ans)} €` };
  }
  if (kind === 'rule3') {
    const [what, short] = pick(r, GOODS), u = between(r, 2, [5, 9, 15][d]), n1 = between(r, 2, 6);
    let n2; do { n2 = between(r, 3, [10, 12, 25][d]); } while (n2 === n1);
    const ans = u * n2;
    return { kind, text: `${n1} ${what} = ${u * n1} €`, eq: false, sub: `Combien pour ${n2} ${short} ?`, answer: ans, tip: `${u * n1} ÷ ${n1} = ${u} € l'unité, × ${n2} = ${ans} €` };
  }
  if (kind === 'avg') {
    const n = d === 0 ? 3 : 4, hi = [20, 60, 200][d];
    const xs = Array.from({ length: n - 1 }, () => between(r, 2, hi));
    let last = between(r, 2, hi); while ((xs.reduce((s, x) => s + x, 0) + last) % n) last++;
    xs.push(last);
    const sum = xs.reduce((s, x) => s + x, 0);
    return { kind, text: `Moyenne de ${xs.join(' ; ')}`, sub: 'La moyenne', answer: sum / n, tip: `Somme ${sum}, ÷ ${n} = ${sum / n}` };
  }
  if (kind === 'evol') {
    const x = pick(r, [10, 20, 25, 50]), base = 100 * between(r, 1, [2, 5, 20][d]), up = base * (1 + x / 100), ans = up * (1 - x / 100);
    if (!Number.isInteger(ans)) return estim(r, d);
    return { kind, text: `${fmt(base)} +${x} % puis −${x} %`, sub: 'Piège classique : ça ne revient pas au départ', answer: ans,
      tip: `${fmt(base)} → ${fmt(up)} → ${fmt(up)} − ${x} % = ${fmt(ans)} (×${fmt(1 + x / 100)} × ${fmt(1 - x / 100)} = ${fmt(round4((1 + x / 100) * (1 - x / 100)))})` };
  }
  if (r.next() < 0.3) {
    const f = pick(r, FAMOUS);
    return { kind: 'famous', text: f.text, sub: f.sub + ' · à 5 % près', answer: f.ans, tol: 0.05, tip: f.tip };
  }
  const a = between(r, [21, 101, 201][d], [99, 499, 999][d]), b = between(r, [11, 11, 21][d], [29, 49, 99][d]), ans = a * b;
  const ra = Math.round(a / 10) * 10, rb = Math.round(b / 5) * 5;
  return { kind: 'approx', text: `${fmt(a)} × ${b}`, sub: 'Environ… à 10 % près', answer: ans, tol: 0.1, tip: `${fmt(a)} × ${b} ≈ ${fmt(ra)} × ${rb} = ${fmt(ra * rb)} (exactement ${fmt(ans)})` };
}

/* ------------------------------------------------------------ le Compte est bon */
// On part de nombres tirés et d'un calcul fait au hasard avec eux : la cible est donc toujours atteignable.
function compte(r, d) {
  for (let tries = 0; tries < 200; tries++) {
    const pool = d === 2 ? [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 25, 50, 75, 100] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const nums = Array.from({ length: 4 }, () => pick(r, pool)).sort((x, y) => x - y);
    const items = r.shuffle(nums.map((n) => ({ v: n, s: String(n), op: null })));
    while (items.length > 1) {
      const a = items.shift(), b = items.shift();
      const ops = ['+', '×', '−', '÷'].filter((o) => (o !== '−' || a.v > b.v) && (o !== '÷' || (b.v > 1 && a.v % b.v === 0)) && (o !== '×' || (a.v > 1 && b.v > 1)));
      const o = pick(r, ops);
      const wrap = (x, low) => (x.op && low.includes(x.op) ? `(${x.s})` : x.s);
      const v = o === '+' ? a.v + b.v : o === '−' ? a.v - b.v : o === '×' ? a.v * b.v : a.v / b.v;
      const s = o === '+' ? `${a.s} + ${b.s}` : o === '−' ? `${a.s} − ${wrap(b, '+−')}` : o === '×' ? `${wrap(a, '+−')} × ${wrap(b, '+−')}` : `${wrap(a, '+−')} ÷ ${wrap(b, '+−×÷')}`;
      items.splice(r.int(items.length + 1), 0, { v, s, op: o });
    }
    const t = items[0];
    if (!/[×÷]/.test(t.s)) continue; // une addition en chaîne n'a rien d'un défi
    const lo = [10, 20, 50][d], hi = [60, 150, 600][d];
    if (t.v < lo || t.v > hi || nums.includes(t.v)) continue;
    const check = evalExpr(t.s);
    if (!check.ok || check.value.d !== 1 || check.value.n !== t.v) continue;
    return { kind: 'compte', text: `${t.v}`, target: t.v, nums, sub: 'Atteins la cible avec ces nombres (chacun une fois au plus)',
      input: 'expr', answer: t.v, sol: t.s, show: t.s + ' = ' + t.v, tip: 'Une solution parmi d\'autres : ' + t.s + ' = ' + t.v };
  }
  return { kind: 'compte', text: '24', target: 24, nums: [2, 3, 4, 6], sub: 'Atteins la cible', input: 'expr', answer: 24, sol: '6 × 4', show: '6 × 4 = 24', tip: '6 × 4 = 24' };
}


/* ------------------------------------------------------------ vrai ou faux */
// Une affirmation juste une fois sur deux ; la fausse est une erreur crédible (retenue, chiffre voisin…)
const VF = ['Vrai', 'Faux'];
function wrongish(r, n) {
  const mag = n >= 1000 ? pick(r, [10, 100]) : n >= 100 ? pick(r, [1, 10]) : 1;
  return Math.max(0, n + pick(r, [-2, -1, 1, 2]) * mag) || n + 1;
}
function vf(r, d) {
  const kind = pick(r, ['vf-mul', 'vf-add', 'vf-div', 'vf-prime', 'vf-pct', 'vf-pow', 'vf-frac', 'vf-mul']);
  const truth = r.next() < 0.5;
  const out = (text, tip, t = truth) => ({ kind, text, sub: 'Vrai ou faux ?', choices: VF, answer: t ? 0 : 1, tip });
  if (kind === 'vf-mul') {
    const a = between(r, [3, 6, 12][d], [12, 25, 49][d]), b = between(r, [3, 4, 6][d], [9, 12, 25][d]), c = a * b;
    const shown = truth ? c : wrongish(r, c);
    return out(`${a} × ${b} = ${fmt(shown)}`, `${a} × ${b} = ${fmt(c)}`);
  }
  if (kind === 'vf-add') {
    const hi = [99, 999, 9999][d], a = between(r, 11, hi), b = between(r, 11, hi), c = a + b;
    const shown = truth ? c : wrongish(r, c);
    return out(`${fmt(a)} + ${fmt(b)} = ${fmt(shown)}`, `${fmt(a)} + ${fmt(b)} = ${fmt(c)}`);
  }
  if (kind === 'vf-div') {
    const k = pick(r, d === 0 ? [2, 3, 5] : [3, 4, 6, 9]);
    let n = k * between(r, [5, 12, 40][d], [30, 120, 1100][d]);
    if (!truth) n += between(r, 1, k - 1);
    const rule = { 2: 'il finit par un chiffre pair', 3: 'la somme de ses chiffres est un multiple de 3', 4: 'ses deux derniers chiffres forment un multiple de 4',
      5: 'il finit par 0 ou 5', 6: 'il est pair et divisible par 3', 9: 'la somme de ses chiffres est un multiple de 9' }[k];
    return out(`${fmt(n)} est divisible par ${k}`, `Divisible par ${k} quand ${rule} : ${fmt(n)} ${n % k ? 'ne l\'est pas' : 'l\'est'}`, n % k === 0);
  }
  if (kind === 'vf-prime') {
    const hi = [50, 120, 400][d];
    let n = between(r, 11, hi); if (n % 2 === 0) n++;
    for (let k = 0; k < 40 && isPrime(n) !== truth; k++) n += 2;
    const p = isPrime(n);
    return out(`${n} est premier`, p ? `${n} n'a pas d'autre diviseur que 1 et lui-même` : `${n} = ${smallFactor(n)} × ${n / smallFactor(n)}`, p);
  }
  if (kind === 'vf-pct') {
    const pc = pick(r, [10, 20, 25, 50, 75, 5, 15]), b = 20 * between(r, 1, [5, 10, 30][d]), c = (pc * b) / 100;
    const shown = truth ? c : pick(r, [c * 2, c / 2, c + 10, Math.max(1, c - 5)]);
    return out(`${pc} % de ${fmt(b)} = ${fmt(shown)}`, `${pc} % de ${fmt(b)} = ${fmt(c)}`, shown === c);
  }
  if (kind === 'vf-pow') {
    const b = pick(r, [2, 3, 5]), e = between(r, 3, { 2: [8, 10, 12][d], 3: [4, 5, 6][d], 5: [3, 4, 5][d] }[b]), v = b ** e;
    const shown = truth ? v : pick(r, [b * e, v + b, v - b, b ** (e - 1) * (b + 1)]);
    return out(`${b}^${e} = ${fmt(shown)}`, `${b}^${e} = ${fmt(v)}${shown === b * e ? ` (et pas ${b} × ${e})` : ''}`, shown === v);
  }
  const den = pick(r, [2, 4, 5, 8, 10, 20]);
  let num; do { num = between(r, 1, den - 1); } while (gcd(num, den) !== 1);
  const v = round4(num / den), shown = truth ? v : pick(r, [round4(num / 10), round4(den / 100), round4(v + 0.1), round4(num / (den + 1))].filter((x) => x !== v && x > 0));
  return out(`${num}/${den} = ${fmt(shown)}`, `${num} ÷ ${den} = ${fmt(v)}`, shown === v);
}

/* ------------------------------------------------------------ le plus grand / le plus petit */
function compare(r, d) {
  const kind = pick(r, ['cmp-frac', 'cmp-pow', 'cmp-pct', 'cmp-mul', 'cmp-sqrt', 'cmp-sqcube']);
  let A, B;
  if (kind === 'cmp-frac') {
    const den = pick(r, [3, 6, 7, 8, 9, 11, 12]), num = between(r, 1, den - 1), v = num / den;
    const near = round4(Math.round((v + pick(r, [-1, 1]) * (0.01 + r.next() * 0.05)) * 100) / 100);
    A = { l: `${num}/${den}`, v }; B = { l: fmt(near), v: near };
  } else if (kind === 'cmp-pow') {
    const pairs = [[2, 10, 10, 3], [2, 5, 5, 2], [3, 4, 4, 3], [2, 6, 6, 2], [2, 7, 5, 3], [3, 5, 5, 3], [2, 9, 3, 6], [2, 8, 4, 4]];
    let [a, x, b, y] = pick(r, pairs);
    if (a ** x === b ** y) [a, x, b, y] = [2, 10, 10, 3];
    A = { l: `${a}^${x}`, v: a ** x }; B = { l: `${b}^${y}`, v: b ** y };
  } else if (kind === 'cmp-pct') {
    const a = pick(r, [10, 20, 25, 30, 40, 50, 60, 75]), x = 20 * between(r, 1, 10), b = pick(r, [10, 20, 25, 30, 40, 50, 60, 75]), y = 20 * between(r, 1, 10);
    A = { l: `${a} % de ${x}`, v: (a * x) / 100 }; B = { l: `${b} % de ${y}`, v: (b * y) / 100 };
  } else if (kind === 'cmp-mul') {
    // deux produits proches : (m − e)(m + e) contre m², ou deux découpages
    const m = between(r, [6, 10, 20][d], [15, 40, 90][d]), e = between(r, 1, 5);
    A = { l: `${m - e} × ${m + e}`, v: (m - e) * (m + e) }; B = { l: `${m}²`, v: m * m };
  } else if (kind === 'cmp-sqrt') {
    const k = between(r, [4, 6, 10][d], [9, 15, 30][d]), n = between(r, (k - 1) * (k - 1) + 1, (k + 1) * (k + 1) - 1);
    if (n === k * k) return compare(r, d);
    A = { l: `√${n}`, v: Math.sqrt(n) }; B = { l: `${k}`, v: k };
  } else {
    const a = between(r, 3, [8, 12, 20][d]), b = between(r, 2, [5, 6, 9][d]);
    if (a * a === b ** 3) return compare(r, d);
    A = { l: `${a}²`, v: a * a }; B = { l: `${b}^3`, v: b ** 3 };
  }
  if (A.v === B.v) return compare(r, d);
  if (r.next() < 0.5) [A, B] = [B, A];
  const small = r.next() < 0.3;
  const win = (small ? A.v < B.v : A.v > B.v) ? 0 : 1;
  const val = (x) => (x.l === fmt(x.v) ? '' : Number.isInteger(x.v) ? ` = ${fmt(x.v)}` : ` ≈ ${fmt(Math.round(x.v * 100) / 100)}`);
  return { kind, text: `${A.l}  ou  ${B.l}`, sub: small ? 'Lequel est le plus PETIT ?' : 'Lequel est le plus GRAND ?', choices: [A.l, B.l], answer: win,
    tip: `${A.l}${val(A)} et ${B.l}${val(B)}` };
}

/* ------------------------------------------------------------ équations */
function equation(r, d) {
  const x = between(r, [1, 2, 3][d], [10, 15, 25][d]);
  const forms = d === 0 ? ['x+a', 'ax', 'x-a', 'ax+b'] : d === 1 ? ['ax+b', 'a(x+b)', 'x/a+b', 'ax-b'] : ['ax+b=cx+d', 'a(x-b)+c', 'x/a+b', 'ax+b'];
  const f = pick(r, forms);
  const a = between(r, 2, [5, 9, 12][d]), b = between(r, 1, [12, 20, 40][d]);
  let text, tip, kind = d === 0 ? 'eq1' : d === 1 ? 'eq2' : 'eq3';
  if (f === 'x+a') { text = `x + ${b} = ${x + b}`; tip = `x = ${x + b} − ${b} = ${x}`; kind = 'eq1'; }
  else if (f === 'x-a') { text = `x − ${b} = ${x - b}`; tip = `x = ${x - b} + ${b} = ${x}`; kind = 'eq1'; if (x - b < 0) return equation(r, d); }
  else if (f === 'ax') { text = `${a}x = ${a * x}`; tip = `x = ${a * x} ÷ ${a} = ${x}`; kind = 'eq1'; }
  else if (f === 'ax+b') { text = `${a}x + ${b} = ${a * x + b}`; tip = `${a}x = ${a * x + b} − ${b} = ${a * x}, donc x = ${x}`; kind = d === 0 ? 'eq1' : 'eq2'; }
  else if (f === 'ax-b') { if (a * x - b < 0) return equation(r, d); text = `${a}x − ${b} = ${a * x - b}`; tip = `${a}x = ${a * x - b} + ${b} = ${a * x}, donc x = ${x}`; kind = 'eq2'; }
  else if (f === 'a(x+b)') { text = `${a}(x + ${b}) = ${a * (x + b)}`; tip = `x + ${b} = ${a * (x + b)} ÷ ${a} = ${x + b}, donc x = ${x}`; kind = 'eq2'; }
  else if (f === 'x/a+b') { const X = a * x; text = `x ÷ ${a} + ${b} = ${x + b}`; tip = `x ÷ ${a} = ${x}, donc x = ${X}`; return { kind: 'eq2', text, sub: 'Trouve x', eq: false, answer: X, tip }; }
  else if (f === 'a(x-b)+c') { const bb = between(r, 1, x - 1 || 1); if (x - bb <= 0) return equation(r, d); const c = between(r, 1, 20); text = `${a}(x − ${bb}) + ${c} = ${a * (x - bb) + c}`; tip = `${a}(x − ${bb}) = ${a * (x - bb)}, x − ${bb} = ${x - bb}, donc x = ${x}`; kind = 'eq3'; }
  else { let c; do { c = between(r, 1, 9); } while (c === a); const bigA = Math.max(a, c), smallC = Math.min(a, c); const dd = (bigA - smallC) * x + b; text = `${bigA}x + ${b} = ${smallC}x + ${dd}`; tip = `${bigA - smallC}x = ${dd} − ${b} = ${dd - b}, donc x = ${x}`; kind = 'eq3'; }
  return { kind, text, sub: 'Trouve x', eq: false, answer: x, tip };
}

/* ------------------------------------------------------------ géométrie de tête (avec une figure) */
const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15]];
function geo(r, d) {
  const kind = pick(r, ['rect-area', 'rect-perim', 'square-side', 'tri-angle', 'pythag', 'cube-vol', 'tri-area', d > 0 ? 'polygon' : 'rect-area', 'rect-side']);
  const w = between(r, [3, 6, 12][d], [12, 25, 60][d]), h = between(r, [2, 4, 8][d], [9, 18, 40][d]);
  if (kind === 'rect-area') return { kind, text: `Aire du rectangle`, sub: 'En cm²', answer: w * h, fig: { t: 'rect', a: `${w} cm`, b: `${h} cm` }, tip: `Longueur × largeur = ${w} × ${h} = ${fmt(w * h)} cm²` };
  if (kind === 'rect-perim') return { kind, text: `Périmètre du rectangle`, sub: 'En cm', answer: 2 * (w + h), fig: { t: 'rect', a: `${w} cm`, b: `${h} cm` }, tip: `2 × (${w} + ${h}) = ${2 * (w + h)} cm` };
  if (kind === 'rect-side') { const P = 2 * (w + h); return { kind, text: `Côté manquant ?`, sub: `Périmètre ${P} cm`, answer: h, fig: { t: 'rect', a: `${w} cm`, b: '?' }, tip: `${P} ÷ 2 = ${w + h}, puis ${w + h} − ${w} = ${h} cm` }; }
  if (kind === 'square-side') { const c = between(r, [3, 6, 11][d], [10, 15, 30][d]); return { kind, text: `Côté du carré ?`, sub: `Aire ${fmt(c * c)} cm²`, answer: c, fig: { t: 'square', a: '?' }, tip: `√${fmt(c * c)} = ${c} cm, car ${c}² = ${fmt(c * c)}` }; }
  if (kind === 'tri-angle') {
    const A = 5 * between(r, 4, 18), B = 5 * between(r, 4, Math.max(4, Math.min(20, (175 - A) / 5))); const C = 180 - A - B;
    if (C <= 0) return geo(r, d);
    return { kind, text: `Angle manquant`, sub: 'En degrés', answer: C, fig: { t: 'tri', a: `${A}°`, b: `${B}°`, c: '?' }, tip: `Les angles d'un triangle font 180° : 180 − ${A} − ${B} = ${C}°` };
  }
  if (kind === 'pythag') {
    const [a, b, c] = pick(r, d === 0 ? TRIPLES.slice(0, 1).concat([[6, 8, 10]]) : TRIPLES), k = d === 2 ? between(r, 1, 4) : between(r, 1, 2);
    return { kind, text: `Hypoténuse ?`, sub: 'Triangle rectangle, en cm', answer: c * k, fig: { t: 'right', a: `${a * k} cm`, b: `${b * k} cm`, c: '?' },
      tip: `Pythagore : ${a * k}² + ${b * k}² = ${a * a * k * k} + ${b * b * k * k} = ${c * c * k * k} = ${c * k}²` };
  }
  if (kind === 'cube-vol') { const c = between(r, 2, [5, 9, 12][d]); return { kind, text: `Volume du cube`, sub: 'En cm³', answer: c ** 3, fig: { t: 'cube', a: `${c} cm` }, tip: `${c} × ${c} × ${c} = ${fmt(c ** 3)} cm³` }; }
  if (kind === 'tri-area') { const B = 2 * between(r, 2, [6, 12, 30][d]), H = between(r, 2, [9, 15, 40][d]); return { kind, text: `Aire du triangle`, sub: 'En cm²', answer: (B * H) / 2, fig: { t: 'trih', a: `${B} cm`, b: `${H} cm` }, tip: `Base × hauteur ÷ 2 = ${B} × ${H} ÷ 2 = ${fmt((B * H) / 2)} cm²` }; }
  const n = pick(r, [4, 5, 6, 8, 9, 10, 12]), ang = ((n - 2) * 180) / n;
  const names = { 4: 'carré', 5: 'pentagone', 6: 'hexagone', 8: 'octogone', 9: 'ennéagone', 10: 'décagone', 12: 'dodécagone' };
  return { kind: 'polygon', text: `Angle d'un ${names[n]} régulier`, sub: 'Un angle intérieur, en degrés', answer: ang, fig: { t: 'poly', n }, tip: `(${n} − 2) × 180 ÷ ${n} = ${(n - 2) * 180} ÷ ${n} = ${ang}°` };
}

/* ------------------------------------------------------------ devinettes de nombre */
// On choisit le nombre, puis on ajoute des indices vrais jusqu'à ce qu'il soit le seul possible.
const digitSum = (n) => String(n).split('').reduce((s, c) => s + Number(c), 0);
function devinette(r, d) {
  const max = [50, 100, 200][d];
  for (let tries = 0; tries < 80; tries++) {
    const n = between(r, 10, max);
    const lo = Math.max(1, n - between(r, 5, 25)), hi = Math.min(max + 20, n + between(r, 5, 25));
    const clues = [{ t: `Je suis entre ${lo} et ${hi}.`, f: (x) => x > lo && x < hi }];
    const pool = [
      { t: n % 2 ? 'Je suis impair.' : 'Je suis pair.', f: (x) => x % 2 === n % 2 },
      ...[3, 4, 5, 6, 7, 8, 9, 11].filter((k) => n % k === 0).map((k) => ({ t: `Je suis un multiple de ${k}.`, f: (x) => x % k === 0 })),
      ...[3, 4, 5, 7].filter((k) => n % k !== 0).map((k) => ({ t: `Je ne suis pas un multiple de ${k}.`, f: (x) => x % k !== 0 })),
      { t: `La somme de mes chiffres fait ${digitSum(n)}.`, f: (x) => digitSum(x) === digitSum(n) },
      { t: `Mon chiffre des unités est ${n % 10}.`, f: (x) => x % 10 === n % 10 },
      ...(isPrime(n) ? [{ t: 'Je suis un nombre premier.', f: isPrime }] : []),
      ...(Number.isInteger(Math.sqrt(n)) ? [{ t: 'Je suis un carré parfait.', f: (x) => Number.isInteger(Math.sqrt(x)) }] : []),
    ];
    r.shuffle(pool);
    let cand = Array.from({ length: hi - lo - 1 }, (_, k) => lo + 1 + k);
    for (const c of pool) {
      if (cand.length === 1 || clues.length >= 4) break;
      const next = cand.filter(c.f);
      if (next.length < cand.length) { clues.push(c); cand = next; }
    }
    if (cand.length !== 1 || clues.length < 3) continue;
    return { kind: 'riddle', text: clues.map((c) => c.t).join(' '), sub: 'Qui suis-je ?', eq: false, answer: n, tip: `${n} : ${clues.slice(1).map((c) => c.t.replace(/\.$/, '')).join(' · ')}` };
  }
  return { kind: 'riddle', text: 'Je suis entre 10 et 20. Je suis un multiple de 7.', sub: 'Qui suis-je ?', eq: false, answer: 14, tip: '14 = 2 × 7' };
}

const GEN = { base, astuce, theorie, fraction, suite, estim, compte, vf, compare, equation, geo, devinette };
export const KINDS = {
  base: ['add', 'sub', 'mul', 'div', 'chain', 'missing', 'half', 'prio'],
  astuce: ['equi', 'sq5', 'x11', 'pct', 'x5', 'x25', 'x9', 'x99', 'sqnear', 'compl', 'pct2', 'x15'],
  theorie: ['pow', 'mod', 'sqrt', 'cube', 'pgcd', 'ppcm', 'fact', 'binary', 'prime', 'divs'],
  fraction: ['fracof', 'dec', 'fracdec', 'fracpct', 'fracadd'],
  suite: ['arith', 'geom', 'squares', 'fibo', 'incr', 'alt', 'primes'],
  estim: ['kmh', 'ms', 'train', 'time', 'units', 'promo', 'rule3', 'avg', 'evol', 'famous', 'approx'],
  compte: ['compte'],
  vf: ['vf-mul', 'vf-add', 'vf-div', 'vf-prime', 'vf-pct', 'vf-pow', 'vf-frac'],
  compare: ['cmp-frac', 'cmp-pow', 'cmp-pct', 'cmp-mul', 'cmp-sqrt', 'cmp-sqcube'],
  equation: ['eq1', 'eq2', 'eq3'],
  geo: ['rect-area', 'rect-perim', 'square-side', 'tri-angle', 'pythag', 'cube-vol', 'tri-area', 'polygon', 'rect-side'],
  devinette: ['riddle'],
};

export function makeQuestion(seed, i, cat, diff, salt = 0) {
  const r = rngOf({ seed: qSeed(seed, i, salt) });
  const d = D(diff);
  const q = GEN[cat](r, d);
  return {
    cat, kind: q.kind, text: q.text, sub: q.sub || '', eq: q.eq !== false && !q.choices && !q.fig, input: q.choices ? 'choice' : q.input || 'num', time: TIME[cat][d],
    answer: q.answer, tol: q.tol || 0, show: q.show || (q.choices ? q.choices[q.answer] : fmt(q.answer)), tip: q.tip || '',
    nums: q.nums || null, target: q.target ?? null, sol: q.sol || null, choices: q.choices || null, fig: q.fig || null,
    key: q.text + '|' + (q.sub || '') + '|' + (q.fig ? JSON.stringify(q.fig) : '') + '|' + (q.nums ? q.nums.join(',') : ''),
  };
}

// Ce que voient les joueurs pendant la question (sans la réponse)
export const publicQuestion = (q) => ({ cat: q.cat, kind: q.kind, text: q.text, sub: q.sub, eq: q.eq, input: q.input, time: q.time, nums: q.nums, target: q.target, tol: q.tol, choices: q.choices, fig: q.fig });
