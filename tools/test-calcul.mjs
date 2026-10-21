// Tests du moteur de Tête de Calcul : node tools/test-calcul.mjs
import assert from 'node:assert/strict';
import { makeQuestion, planCats, CATS, DIFFS, THEMES, KINDS } from '../calcul/engine/questions.js';
import { evalExpr, parseNumber, usesOnly } from '../calcul/engine/expr.js';
import { createGame, nextQuestion, answer, reveal, check, publicState, fullQuestion, standings, restartQuestion } from '../calcul/engine/rules.js';
import { botAnswer } from '../calcul/engine/bot.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };

t('lecture des nombres', () => {
  assert.equal(parseNumber('2 491'), 2491);
  assert.equal(parseNumber(' 25,5 '), 25.5);
  assert.equal(parseNumber('−3'), -3);
  assert.equal(parseNumber('12a'), null);
  assert.equal(parseNumber(''), null);
});

t('expressions exactes, sans eval', () => {
  const e = evalExpr('(8+4)×(5−1)');
  assert.ok(e.ok); assert.deepEqual(e.value, { n: 48, d: 1 }); assert.deepEqual(e.nums, [8, 4, 5, 1]);
  assert.deepEqual(evalExpr('7 ÷ 2 × 2').value, { n: 7, d: 1 });
  assert.equal(evalExpr('3/0').ok, false);
  assert.equal(evalExpr('alert(1)').ok, false);
  assert.equal(evalExpr('(1+2').ok, false);
  assert.ok(usesOnly([2, 2], [2, 2, 5]));
  assert.ok(!usesOnly([2, 2], [2, 5]));
});

t('les questions sont reproductibles et justes', () => {
  for (const diff of DIFFS) for (const cat of Object.keys(CATS)) for (let i = 0; i < 300; i++) {
    const seed = 1000 + i * 7919;
    const q = makeQuestion(seed, i, cat, diff);
    assert.deepEqual(q, makeQuestion(seed, i, cat, diff));
    assert.ok(Number.isFinite(q.answer), `${cat} ${q.text}`);
    assert.ok(q.time > 0 && q.text && q.tip);
    if (q.input === 'expr') {
      const c = check(q, q.sol);
      assert.ok(c.ok, `${q.sol} = ${q.target} (${q.nums})`);
    } else {
      assert.ok(check(q, String(q.answer)).ok, `${cat} ${q.text} → ${q.answer}`);
      if (cat !== 'fraction' && !['x15', 'units', 'avg'].includes(q.kind)) assert.ok(Number.isInteger(q.answer), `${cat} ${q.text} → ${q.answer} entier`);
      assert.ok(q.answer >= 0, `${cat} ${q.text} → ${q.answer} positif`);
      assert.ok(check(q, String(q.answer).replace('.', ',')).ok, `${q.text} : virgule acceptée`);
      assert.ok(!/NaN|undefined|Infinity/.test(q.text + q.tip + q.sub), `${cat} ${q.kind} : ${q.text} | ${q.tip}`);
    }
  }
});

t('banque de questions : tous les types sortent, et beaucoup de questions différentes', () => {
  for (const cat of Object.keys(CATS)) {
    const kinds = new Set(), texts = new Set();
    for (const diff of DIFFS) for (let i = 0; i < 600; i++) { const q = makeQuestion(i * 104729 + 17, i, cat, diff); kinds.add(q.kind); texts.add(q.text); }
    for (const k of KINDS[cat]) assert.ok(kinds.has(k), `${cat} : le type ${k} ne sort jamais`);
    console.log(`  ${cat.padEnd(9)} ${String(KINDS[cat].length).padStart(2)} types · ${texts.size} questions différentes sur 1 800 tirages`);
  }
});

t('pas deux fois la même question dans une partie', () => {
  let s = createGame({ players: [{ id: 0, name: 'A' }], cfg: { len: 20, theme: 'base', diff: 'facile' }, seed: 77, now: 0 });
  const seen = [];
  for (let i = 0; i < 20; i++) { s = nextQuestion(s, i * 1e5); seen.push(fullQuestion(s).text); s = reveal(s, i * 1e5 + 1); }
  assert.equal(new Set(seen).size, 20, seen.join(' | '));
});

t('quelques questions connues', () => {
  // vérification des formules d'astuces sur des cas à la main
  const found = new Set();
  for (let i = 0; i < 2000 && found.size < 4; i++) {
    const q = makeQuestion(i * 31, i, 'astuce', 'normal');
    if (q.kind === 'equi') { const [a, b] = q.text.split(' × ').map(Number); assert.equal(q.answer, a * b); found.add('equi'); }
    if (q.kind === 'sq5') { const m = Number(q.text.replace('²', '')); assert.equal(q.answer, m * m); found.add('sq5'); }
    if (q.kind === 'x11') { assert.equal(q.answer, Number(q.text.split(' × ')[0]) * 11); found.add('x11'); }
    if (q.kind === 'pct') { const [a, b] = q.text.split(' % de ').map(Number); assert.equal(q.answer, (a * b) / 100); found.add('pct'); }
  }
  assert.equal(found.size, 4);
});

t('plan des catégories', () => {
  for (const th of Object.keys(THEMES)) {
    const p = planCats(42, 20, th);
    assert.equal(p.length, 20);
    for (let i = 2; i < p.length; i++) if (Object.keys(THEMES[th]).length > 1) assert.ok(!(p[i] === p[i - 1] && p[i] === p[i - 2]));
  }
  assert.notEqual(planCats(42, 20, 'mix')[0], 'compte');
});

t('une partie complète', () => {
  const players = [{ id: 0, name: 'Amiel', color: '#ff4b2b' }, { id: 1, name: 'Nico', color: '#2b8cff' }, { id: 100, name: 'Bot', color: '#ffc531', bot: true }];
  let s = createGame({ players, cfg: { mode: 'classic', len: 10 }, seed: 7, now: 0 });
  let now = 4000;
  for (let i = 0; i < 10; i++) {
    s = nextQuestion(s, now);
    assert.equal(s.phase, 'question');
    const q = fullQuestion(s);
    const pub = publicState(s);
    assert.equal(pub.q.answer, undefined, 'la réponse ne part pas sur le réseau');
    const good = q.input === 'expr' ? q.sol : String(q.answer);
    let r = answer(s, { by: 0, raw: good, idx: s.idx, now: now + 1000 }); assert.ok(r.ok && r.right); s = r.state;
    assert.equal(publicState(s).answers[0].ok, undefined, 'la justesse reste cachée');
    assert.equal(answer(s, { by: 0, raw: good, now: now + 1100 }).ok, false, 'une seule réponse');
    r = answer(s, { by: 1, raw: q.input === 'expr' ? `${q.nums[0]}+${q.nums[1]}` : String(q.answer * 3 + 7), now: now + 2000 }); assert.ok(r.ok); s = r.state;
    assert.equal(r.done, false);
    r = answer(s, { by: 100, raw: good, now: now + 3000 }); s = r.state; assert.equal(r.done, true);
    s = reveal(s, now + 3100);
    assert.equal(s.phase, 'reveal');
    now += 10000;
  }
  s = nextQuestion(s, now);
  assert.equal(s.phase, 'over');
  assert.deepEqual(s.ranking, [0, 100, 1]);
  const a = s.players.find((p) => p.id === 0);
  assert.equal(a.right, 10); assert.ok(a.bestStreak === 10 && a.score > 0);
  assert.equal(s.players.find((p) => p.id === 1).score, 0);
  assert.deepEqual(standings(s), s.ranking);
});

t('mode Péril et Éclair', () => {
  const players = [{ id: 0, name: 'A' }, { id: 1, name: 'B' }];
  let s = nextQuestion(createGame({ players, cfg: { mode: 'peril', len: 10, theme: 'base' }, seed: 3, now: 0 }), 0);
  const q = fullQuestion(s);
  s = answer(s, { by: 0, raw: String(q.answer + 1), now: 500 }).state;
  s = reveal(s, 1000);
  assert.ok(s.players[0].score < 0);
  assert.equal(s.players[1].score, 0);

  let e = nextQuestion(createGame({ players, cfg: { mode: 'eclair', len: 10, theme: 'base' }, seed: 5, now: 0 }), 0);
  const q2 = fullQuestion(e);
  let r = answer(e, { by: 0, raw: 'abc', now: 300 }); // en Éclair une saisie illisible compte comme une erreur
  assert.ok(r.ok && !r.right); e = r.state;
  assert.equal(publicState(e).answers[0].locked, true);
  r = answer(e, { by: 1, raw: String(q2.answer), now: 900 }); assert.ok(r.done); e = reveal(r.state, 1000);
  assert.equal(e.players[1].score, 100);
  assert.equal(e.players[0].score, 0);
});

t('saisie illisible en Classique : pas comptée', () => {
  let s = nextQuestion(createGame({ players: [{ id: 0, name: 'A' }], cfg: {}, seed: 9, now: 0 }), 0);
  const r = answer(s, { by: 0, raw: 'douze', now: 100 });
  assert.equal(r.ok, false); assert.ok(r.soft);
  assert.equal(answer(s, { by: 0, raw: '1', now: 999999 }).ok, false, 'temps écoulé');
  s = restartQuestion(s, 5000); assert.equal(s.qAt, 5000);
});

t('finale quitte ou double', () => {
  let s = createGame({ players: [{ id: 0, name: 'A' }], cfg: { len: 10, theme: 'base' }, seed: 11, now: 0 });
  for (let i = 0; i < 10; i++) { s = nextQuestion(s, i * 1e5); if (i < 9) s = reveal(s, i * 1e5 + 1); }
  assert.ok(s.q.final); assert.equal(s.q.pts, 2);
  s = answer(s, { by: 0, raw: String(fullQuestion(s).answer), now: 9e5 }).state;
  s = reveal(s, 9e5 + 1);
  assert.equal(s.last.results[0].pts, 200);
});

t('bots plausibles', () => {
  let right = 0, total = 0;
  for (let i = 0; i < 400; i++) {
    const q = makeQuestion(i, i, 'base', 'normal');
    const a = botAnswer(q, 'expert');
    if (!a) continue;
    total++; if (check(q, a.raw).ok) right++;
    assert.ok(a.delay >= 1200 && a.delay < q.time * 1000);
  }
  assert.ok(right / total > 0.8, `expert juste à ${Math.round((100 * right) / total)} %`);
  for (let i = 0; i < 100; i++) { const q = makeQuestion(i, i, 'compte', 'expert'); const a = botAnswer(q, 'expert'); if (a) assert.ok(!check(q, a.raw).error, a.raw); }
});

console.log(`\n${n} tests réussis`);
