// Lecture des réponses : nombres (« 2 491 », « 25,5 ») et expressions du « Compte est bon » (« (8+4)×(5−1) »).
// Les expressions sont évaluées en fractions exactes, jamais avec eval : la réponse vient d'un autre joueur.

// Nombre saisi → valeur, ou null si la saisie n'est pas un nombre
export function parseNumber(raw) {
  const s = String(raw ?? '').replace(/[\s  ]/g, '').replace(',', '.').replace(/^[−–]/, '-');
  if (!/^-?\d+(\.\d+)?$/.test(s) || s.length > 14) return null;
  return Number(s);
}

const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };
const frac = (n, d = 1) => { if (d < 0) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
const OPS = {
  '+': (a, b) => frac(a.n * b.d + b.n * a.d, a.d * b.d),
  '-': (a, b) => frac(a.n * b.d - b.n * a.d, a.d * b.d),
  '*': (a, b) => frac(a.n * b.n, a.d * b.d),
  '/': (a, b) => (b.n === 0 ? null : frac(a.n * b.d, a.d * b.n)),
};

function tokenize(src) {
  const s = String(src ?? '').replace(/[x×·]/gi, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/\s+/g, '');
  if (s.length > 60) return null;
  const out = [];
  for (let k = 0; k < s.length;) {
    const c = s[k];
    if (/\d/.test(c)) { let j = k; while (j < s.length && /\d/.test(s[j])) j++; out.push({ num: Number(s.slice(k, j)) }); k = j; }
    else if ('+-*/()'.includes(c)) { out.push({ op: c }); k++; }
    else return null;
  }
  return out;
}

// Expression → { ok, value, nums } ; value est une fraction { n, d }, nums la liste des nombres employés
export function evalExpr(src) {
  const toks = tokenize(src);
  if (!toks || !toks.length) return { ok: false, error: 'Expression illisible' };
  let k = 0;
  const nums = [];
  const peek = () => toks[k] && toks[k].op;
  function atom() {
    const t = toks[k++];
    if (!t) throw new Error('Expression incomplète');
    if (t.num != null) { nums.push(t.num); return frac(t.num); }
    if (t.op === '(') { const v = sum(); if (peek() !== ')') throw new Error('Parenthèse non fermée'); k++; return v; }
    throw new Error('Expression mal formée');
  }
  function product() {
    let v = atom();
    while (peek() === '*' || peek() === '/') { const op = toks[k++].op; v = OPS[op](v, atom()); if (!v) throw new Error('Division par zéro'); }
    return v;
  }
  function sum() {
    let v = product();
    while (peek() === '+' || peek() === '-') { const op = toks[k++].op; v = OPS[op](v, product()); }
    return v;
  }
  try {
    const value = sum();
    if (k !== toks.length) throw new Error('Expression mal formée');
    return { ok: true, value, nums };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Chaque nombre de la liste ne peut servir qu'une fois
export function usesOnly(used, allowed) {
  const left = [...allowed];
  for (const n of used) { const i = left.indexOf(n); if (i < 0) return false; left.splice(i, 1); }
  return true;
}
