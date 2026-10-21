// Générateur de questions de Tête de Calcul. Pur et reproductible : la question n° i d'une partie ne dépend
// que de la graine de la partie, de i et du réglage. N'importe quel joueur peut donc la recalculer
// (reprise après migration d'hôte), et les tests tournent sous Node.
//
// Chaque question : { cat, kind, text, sub, input: 'num'|'expr', time (s), answer, tol, show, tip, nums?, target?, sol? }
//   answer  valeur attendue (nombre) ; pour 'expr', la cible
//   tol     tolérance relative acceptée (estimations), 0 sinon
//   show    réponse telle qu'on l'affiche au moment de la révélation
//   tip     l'astuce qui permettait d'aller vite
import { rngOf } from './rng.js';
import { evalExpr } from './expr.js';

export const CATS = {
  base:    { label: 'Calcul',          pts: 1, color: '#2b8cff', icon: '±' },
  astuce:  { label: 'Astuce',          pts: 2, color: '#ff5fa2', icon: '★' },
  theorie: { label: 'Nombres',         pts: 2, color: '#b45cff', icon: 'π' },
  estim:   { label: 'Ordre de grandeur', pts: 2, color: '#2fbf71', icon: '≈' },
  compte:  { label: 'Compte est bon',  pts: 3, color: '#ff8a1f', icon: '🎯' },
};
export const DIFFS = ['facile', 'normal', 'expert'];

// Thèmes proposés dans le salon : catégories tirées et leur poids
export const THEMES = {
  mix:    { base: 35, astuce: 20, theorie: 20, estim: 15, compte: 10 },
  base:   { base: 100 },
  malin:  { astuce: 55, theorie: 45 },
  vite:   { base: 40, estim: 60 },
  compte: { compte: 100 },
};

export const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString('fr-FR').replace(/ /g, ' ') : String(n).replace('.', ','));

// Graine propre à la question i
function qSeed(seed, i) {
  let h = (seed ^ Math.imul(i + 1, 0x9E3779B1)) >>> 0;
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
const TIME = { base: [15, 12, 10], astuce: [20, 18, 15], theorie: [20, 18, 15], estim: [22, 20, 16], compte: [60, 50, 45] };

/* ------------------------------------------------------------ les 4 opérations */
function base(r, d) {
  const kind = pick(r, ['add', 'sub', 'mul', 'div']);
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
  } else {
    if (d === 0) { b = between(r, 2, 10); ans = between(r, 2, 10); }
    else if (d === 1) { b = between(r, 3, 9); ans = between(r, 12, 99); }
    else { b = between(r, 11, 25); ans = between(r, 12, 60); }
    a = b * ans; text = `${fmt(a)} ÷ ${fmt(b)}`;
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

/* ------------------------------------------------------------ astuces algébriques */
function astuce(r, d) {
  const kind = pick(r, ['equi', 'sq5', 'x11', 'pct']);
  if (kind === 'equi') {
    const m = between(r, [2, 3, 4][d], [6, 9, 15][d]) * 10, e = between(r, 1, d === 0 ? 4 : 9);
    const a = m - e, b = m + e, ans = a * b;
    return { kind, text: `${a} × ${b}`, sub: 'Deux nombres à égale distance d\'un nombre rond…', answer: ans,
      tip: `(${m} − ${e})(${m} + ${e}) = ${m}² − ${e}² = ${fmt(m * m)} − ${e * e} = ${fmt(ans)}` };
  }
  if (kind === 'sq5') {
    const k = between(r, 1, [5, 9, 19][d]), n = 10 * k + 5, ans = n * n;
    return { kind, text: `${n}²`, sub: 'Un carré qui finit par 5', answer: ans,
      tip: `${k} × ${k + 1} = ${k * (k + 1)}, puis on colle 25 → ${fmt(ans)}` };
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
  // pourcentages inversés : a % de b = b % de a
  const b = pick(r, d === 0 ? [50, 10] : [50, 25, 20, 10, 200]);
  const step = { 50: 2, 25: 4, 20: 5, 10: 10, 200: 1 }[b];
  const a = step * between(r, Math.ceil(6 / step), Math.floor([40, 80, 96][d] / step));
  const ans = (a * b) / 100;
  return { kind, text: `${a} % de ${b}`, sub: 'Retourne le problème…', answer: ans,
    tip: `${a} % de ${b} = ${b} % de ${a} = ${fmt(ans)}` };
}

/* ------------------------------------------------------------ puissances, restes, racines */
function theorie(r, d) {
  const kind = pick(r, ['pow', 'mod', 'sqrt']);
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
    return { kind, text: `${fmt(n)} mod ${m}`, sub: `Le reste de la division de ${fmt(n)} par ${m}`, answer: rem,
      tip: `${fmt(n)} = ${m} × ${q} + ${rem}, donc le reste vaut ${rem}` };
  }
  const k = between(r, [4, 8, 12][d], [12, 20, 40][d]);
  const n = between(r, k * k + 1, (k + 1) * (k + 1) - 1);
  return { kind, text: `√${fmt(n)}`, sub: 'Entre quels entiers ? Donne le plus petit.', answer: k,
    tip: `${k}² = ${fmt(k * k)} < ${fmt(n)} < ${fmt((k + 1) * (k + 1))} = ${k + 1}², donc √${fmt(n)} est entre ${k} et ${k + 1}` };
}

/* ------------------------------------------------------------ vitesses, proportions, estimations */
const FAMOUS = [
  { text: '365 × 24', sub: 'Les heures d\'une année', ans: 8760, tip: '365 × 24 = 400 × 24 − 35 × 24 = 9 600 − 840 = 8 760' },
  { text: '60 × 60 × 24', sub: 'Les secondes d\'une journée', ans: 86400, tip: '3 600 × 24 = 86 400' },
  { text: '52 × 7', sub: 'Les jours de 52 semaines', ans: 364, tip: '50 × 7 + 2 × 7 = 350 + 14 = 364' },
  { text: '24 × 7', sub: 'Les heures d\'une semaine', ans: 168, tip: '25 × 7 − 7 = 175 − 7 = 168' },
  { text: '1 440 × 7', sub: 'Les minutes d\'une semaine', ans: 10080, tip: '1 440 × 7 = 10 080' },
];
function estim(r, d) {
  const kind = pick(r, ['kmh', 'ms', 'train', 'approx']);
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
    return { kind, text: `${dist} km à ${v} km/h`, sub: 'Combien de minutes de trajet ?', answer: m,
      tip: `${v} km/h = ${v / 60} km par minute, donc ${dist} ÷ ${v / 60} = ${m} min` };
  }
  if (r.next() < 0.3) {
    const f = pick(r, FAMOUS);
    return { kind: 'famous', text: f.text, sub: f.sub + ' · à 5 % près', answer: f.ans, tol: 0.05, tip: f.tip };
  }
  const a = between(r, [21, 101, 201][d], [99, 499, 999][d]), b = between(r, [11, 11, 21][d], [29, 49, 99][d]), ans = a * b;
  const ra = Math.round(a / 10) * 10, rb = Math.round(b / 5) * 5;
  return { kind: 'approx', text: `${fmt(a)} × ${b}`, sub: 'Environ… à 10 % près', answer: ans, tol: 0.1,
    tip: `${fmt(a)} × ${b} ≈ ${fmt(ra)} × ${rb} = ${fmt(ra * rb)} (exactement ${fmt(ans)})` };
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
      input: 'expr', answer: t.v, sol: t.s, show: t.s.replace(/\*/g, '×') + ' = ' + t.v, tip: 'Une solution parmi d\'autres : ' + t.s + ' = ' + t.v };
  }
  return { kind: 'compte', text: '24', target: 24, nums: [2, 3, 4, 6], sub: 'Atteins la cible', input: 'expr', answer: 24, sol: '(6 − 2) × (3 + 3)', show: '6 × 4 = 24', tip: '6 × 4 = 24' };
}

const GEN = { base, astuce, theorie, estim, compte };

export function makeQuestion(seed, i, cat, diff) {
  const r = rngOf({ seed: qSeed(seed, i) });
  const d = D(diff);
  const q = GEN[cat](r, d);
  return {
    cat, kind: q.kind, text: q.text, sub: q.sub || '', input: q.input || 'num', time: TIME[cat][d],
    answer: q.answer, tol: q.tol || 0, show: q.show || fmt(q.answer), tip: q.tip || '',
    nums: q.nums || null, target: q.target ?? null, sol: q.sol || null,
  };
}

// Ce que voient les joueurs pendant la question (sans la réponse)
export const publicQuestion = (q) => ({ cat: q.cat, kind: q.kind, text: q.text, sub: q.sub, input: q.input, time: q.time, nums: q.nums, target: q.target, tol: q.tol });
