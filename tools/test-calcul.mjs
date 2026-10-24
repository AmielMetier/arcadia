// Tests du moteur de Tête de Calcul : node tools/test-calcul.mjs
import assert from 'node:assert/strict';
import { makeQuestion, planCats, CATS, DIFFS, THEMES, KINDS, chartierTier } from '../calcul/engine/questions.js';
import { CHARTIER_QUESTIONS } from '../calcul/engine/chartier-data.js';
import { evalExpr, parseNumber, usesOnly } from '../calcul/engine/expr.js';
import { createGame, nextQuestion, answer, reveal, check, publicState, fullQuestion, standings, restartQuestion, sabotage, deadlineOf, STEAL_MS, describeAnswer, gradeCode, useJoker, isTrap, LIVES } from '../calcul/engine/rules.js';
import { CODE_QUESTIONS, FIX_QUESTIONS, SQL_QUESTIONS, READ_QUESTIONS, JAVA_READ, buildProgram, scoreRun } from '../calcul/engine/code-data.js';
import { STRATS, payoffAt } from '../calcul/engine/charts.js';
import { PHONES, FAT_FINGER } from '../calcul/engine/drills.js';
import { spawnSync } from 'node:child_process';
import { botAnswer, botSabotage } from '../calcul/engine/bot.js';

let n = 0;
// bonne et mauvaise réponse pour n'importe quel type de question
// (market making : coter juste à côté du client, du bon côté de la valeur finale ; ou trois fourchettes trop larges)
const mmGood = (q) => {
  const V = q.mm.dice.reduce((x, y) => x + y, 0);
  return [0, 1, 2].map((k) => { const c = q.mm.dice.slice(0, k).reduce((x, y) => x + y, 0) + 3.5 * (3 - k) + q.mm.noise[k]; const m = (c + V) / 2; return c > V ? `${m - 1}/${m}` : `${m}/${m + 1}`; }).join(';');
};
const good = (q) => (q.input === 'expr' ? q.sol : q.input === 'mm' ? mmGood(q) : String(q.answer));
const bad = (q) => (q.input === 'expr' ? `${q.nums[0]}+${q.nums[1]}` : q.input === 'mm' ? '0/30;0/30;0/30' : q.input === 'choice' ? String((q.answer + 1) % q.choices.length) : String(q.answer * 3 + 7));
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

t('cas pratique, relance et market making : placés dans la partie et notés comme prévu', async () => {
  const { runMarket, mmFair, parseQuotes, CASE_KEYS } = await import('../calcul/engine/cases.js');
  // au plus un cas pratique (trois questions d'affilée), une relance, un market making ; jamais sur le code ni la dernière
  for (const len of [10, 15, 20, 30]) for (const diff of DIFFS) for (let seed = 1; seed < 40; seed++) {
    const cats = planCats(seed, len, 'chartier', { d: DIFFS.indexOf(diff) });
    const n = (c) => cats.filter((x) => x === c).length;
    assert.ok(n('case') === 3 && n('relance') === 2 && n('mm') === 1, `${len} ${diff} ${cats}`);
    const k = cats.indexOf('case');
    assert.ok(cats[k + 1] === 'case' && cats[k + 2] === 'case' && k + 2 < len - 1, cats.join(','));
    assert.ok(new Set([k, k + 1, k + 2].map((i) => chartierTier(DIFFS.indexOf(diff), i, len))).size === 1, 'le cas tient dans un tour');
    assert.ok(cats[len - 1] === 'chartier', 'la dernière reste une question normale');
  }
  // les trois étapes d'un cas parlent du même dossier
  const s = createGame({ players: [{ id: 0, name: 'A' }, { id: 1, name: 'B' }], cfg: { mode: 'chartier', len: 15, module: 'ma' }, seed: 3, now: 0 });
  const k = s.cats.indexOf('case'), steps = [0, 1, 2].map((j) => fullQuestion(s, k + j));
  assert.ok(steps.every((q, j) => q.caseStep === j && q.sub.includes(steps[0].sub.split(' · ')[1])), steps.map((q) => q.sub).join(' / '));
  assert.ok(steps[0].text.split('.')[0] === steps[2].text.split('.')[0], 'même énoncé');
  assert.ok(CASE_KEYS.length >= 4);
  // market making : coter serré autour du juste milieu gagne le plus souvent ; trop large est pénalisé
  let win = 0;
  for (let i = 0; i < 400; i++) {
    const m = { dice: [1 + (i % 6), 1 + ((i * 7) % 6), 1 + ((i * 13) % 6)], noise: [(i % 7) - 3, ((i * 3) % 7) - 3, ((i * 5) % 7) - 3] };
    if (runMarket(m, [0, 1, 2].map((j) => [mmFair(m, j) - [2, 1.5, 1][j], mmFair(m, j) + [2, 1.5, 1][j]])).pnl > 0) win++;
    assert.equal(runMarket(m, [[0, 30], [0, 30], [0, 30]]).pnl, -6, 'trois fourchettes trop larges : − 6');
  }
  assert.ok(win > 200, `coter serré gagne souvent (${win}/400)`);
  assert.deepEqual(parseQuotes('9,5/11.5;10/12;x'), [[9.5, 11.5], [10, 12]]);
});

t('les questions sont reproductibles et justes', () => {
  for (const diff of DIFFS) for (const cat of Object.keys(CATS)) for (let i = 0; i < 300; i++) {
    const seed = 1000 + i * 7919;
    const q = makeQuestion(seed, i, cat, diff);
    assert.deepEqual(q, makeQuestion(seed, i, cat, diff));
    if (q.kind === 'code') {
      if (q.lang === 'sql') assert.ok(q.input === 'code' && !q.fn && q.starter && q.tests.length === 3 && q.examples.length === 1 && q.time === 120, q.text);
      else assert.ok(q.input === 'code' && q.fn && q.starter && q.tests.length >= 4 && q.examples.length === 2 && q.time === 120, q.text);
      assert.ok(!check(q, '').ok && check(q, 'def f(): pass').pending);
      continue;
    }
    if (q.kind === 'fatfinger') {
      assert.ok(q.input === 'text' && q.copy && q.answer === q.copy && check(q, q.copy).ok, q.copy);
      assert.ok(check(q, '  ' + q.copy + ' ').ok, 'espaces au bord ignorés');
      if (/\s/.test(q.copy)) assert.ok(!check(q, q.copy.replace(/\s/g, '')).ok, 'les espaces comptent');
      if (/[A-Z]/.test(q.copy)) assert.ok(!check(q, q.copy.toLowerCase()).ok, 'les majuscules comptent');
      assert.ok(!check(q, q.copy.slice(0, -1)).ok, 'il manque un caractère');
      continue;
    }
    if (q.kind === 'chartier-multi') {
      assert.ok(q.input === 'multi' && q.answer.length >= 1 && q.answer.length < q.choices.length, q.text);
      assert.ok(check(q, q.answer.join(',')).ok && check(q, [...q.answer].reverse().join(',')).ok, 'ordre indifférent');
      assert.ok(!check(q, q.answer.slice(1).join(',') || '99').ok, 'il en manque une');
      continue;
    }
    if (q.kind === 'case' || q.kind === 'relance') {
      assert.ok(Number.isFinite(q.answer) && q.tip && q.input === 'num' && [1, 2, 3].includes(q.tier), q.text);
      assert.ok(check(q, String(q.answer)).ok && check(q, String(q.answer).replace('.', ',')).ok, `${q.text} → ${q.answer}`);
      assert.ok(!check(q, String(q.answer * 3 + 7)).ok, `${q.text} : réponse fausse refusée`);
      assert.ok(!/NaN|undefined|Infinity/.test(q.text + q.tip + q.sub + q.show), `${q.text} | ${q.tip}`);
      for (const t of q.traps) assert.ok(!check(q, String(t)).ok, `${q.text} : le piège ${t} est refusé`);
      continue;
    }
    if (q.kind === 'mm') {
      assert.ok(q.input === 'mm' && q.mm.dice.length === 3 && q.mm.dice.every((x) => x >= 1 && x <= 6) && q.time > 30, q.text);
      assert.ok(check(q, '').error && !check(q, '1/50').ok, 'sans cotation, ou trop large');
      continue;
    }
    if (q.kind === 'chartier-num') {
      assert.ok(Number.isFinite(q.answer) && q.tip && [1, 2, 3].includes(q.tier), q.text);
      assert.ok(check(q, String(q.answer)).ok, `${q.text} → ${q.answer}`);
      assert.ok(!check(q, String(q.answer * 100 + 7)).ok, `${q.text} : réponse fausse refusée`);
      continue;
    }
    if (q.kind === 'chartier') {
      assert.ok(q.text && q.tip && q.choices && q.choices.length === 4 && new Set(q.choices).size === 4, q.text);
      assert.equal(q.input, 'choice');
      assert.equal(q.choices[q.answer], q.show, q.text);
      assert.ok(check(q, String(q.answer)).ok, `${cat} ${q.text} → ${q.show}`);
      assert.ok(!check(q, String((q.answer + 1) % 4)).ok);
      assert.ok(q.time >= 12 && q.time <= 40 && [1, 2, 3].includes(q.tier) && q.pts === q.tier, q.text);
      continue;
    }
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
    for (const diff of DIFFS) for (let i = 0; i < 600; i++) { const q = makeQuestion(i * 104729 + 17, i, cat, diff); kinds.add(q.kind); texts.add(q.key); }
    for (const k of KINDS[cat]) assert.ok(kinds.has(k), `${cat} : le type ${k} ne sort jamais`);
    console.log(`  ${cat.padEnd(9)} ${String(KINDS[cat].length).padStart(2)} types · ${texts.size} questions différentes sur 1 800 tirages`);
  }
});

t('pas deux fois la même question dans une partie', () => {
  let s = createGame({ players: [{ id: 0, name: 'A' }], cfg: { len: 20, theme: 'base', diff: 'facile' }, seed: 77, now: 0 });
  const seen = [];
  for (let i = 0; i < 20; i++) { s = nextQuestion(s, i * 1e5); seen.push(fullQuestion(s).key); s = reveal(s, i * 1e5 + 1); }
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
    let r = answer(s, { by: 0, raw: good(q), idx: s.idx, now: now + 1000 }); assert.ok(r.ok && r.right); s = r.state;
    assert.equal(publicState(s).answers[0].ok, undefined, 'la justesse reste cachée');
    assert.equal(answer(s, { by: 0, raw: good(q), now: now + 1100 }).ok, false, 'une seule réponse');
    r = answer(s, { by: 1, raw: bad(q), now: now + 2000 }); assert.ok(r.ok, q.text + ' ' + r.error); s = r.state;
    assert.equal(r.done, false);
    r = answer(s, { by: 100, raw: good(q), now: now + 3000 }); s = r.state; assert.equal(r.done, true);
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

t('réponses à choix (vrai ou faux, le plus grand)', () => {
  for (let i = 0; i < 300; i++) for (const cat of ['vf', 'compare']) {
    const q = makeQuestion(i * 13 + 1, i, cat, 'normal');
    assert.equal(q.input, 'choice'); assert.equal(q.choices.length, 2);
    assert.ok(check(q, String(q.answer)).ok);
    assert.ok(!check(q, String(1 - q.answer)).ok);
    assert.ok(check(q, '7').error, 'choix hors liste');
    assert.equal(describeAnswer(q, String(q.answer)), q.choices[q.answer]);
  }
  // les affirmations « vrai » le sont vraiment (multiplications et additions)
  for (let i = 0; i < 500; i++) {
    const q = makeQuestion(i * 17 + 3, i, 'vf', 'expert');
    const m = q.text.replace(/\u00a0/g, '').match(/^(\d+) ([×+]) (\d+) = (\d+)$/);
    if (m) { const v = m[2] === '×' ? m[1] * m[3] : +m[1] + +m[3]; assert.equal(q.answer === 0, v === +m[4], q.text); }
  }
});

t('devinettes : toujours au moins 2 indices en plus de l\'intervalle', () => {
  for (let i = 0; i < 300; i++) for (const diff of DIFFS) {
    const q = makeQuestion(i * 31 + 7, i, 'devinette', diff);
    assert.ok(q.text.split('. ').length >= 3, q.text);
  }
});

t('sabotage : gagner, lancer, bloquer, subir', () => {
  const players = [{ id: 0, name: 'A' }, { id: 1, name: 'B' }, { id: 2, name: 'C' }];
  let s = createGame({ players, cfg: { len: 15, theme: 'base' }, seed: 21, now: 0 });
  let t0 = 0;
  const round = (who) => { s = nextQuestion(s, t0); const q = fullQuestion(s); for (const id of who) s = answer(s, { by: id, raw: good(q), now: t0 + 500 }).state; s = reveal(s, t0 + 1000); t0 += 1e5; };
  assert.equal(sabotage(s, { by: 0, power: 'fog', target: 1 }).ok, false, 'pas pendant l\'intro');
  round([0]); round([0]); round([0]);
  const A = s.players[0];
  assert.equal(A.powers.length, 1, '3 bonnes réponses d\'affilée = 1 pouvoir');
  // on force les pouvoirs pour tester chaque cas
  s.players[0].powers = ['time', 'fog']; s.players[2].powers = ['shield'];
  assert.equal(sabotage(s, { by: 0, power: 'time', target: 0 }).ok, false, 'pas sur soi');
  assert.equal(sabotage(s, { by: 0, power: 'flip', target: 1 }).ok, false, 'pouvoir non possédé');
  let r = sabotage(s, { by: 0, power: 'time', target: 1 }); assert.ok(r.ok && !r.blocked); s = r.state;
  r = sabotage(s, { by: 0, power: 'fog', target: 2 }); assert.ok(r.ok && r.blocked, 'le bouclier bloque'); s = r.state;
  assert.deepEqual(s.players[2].powers, []); assert.deepEqual(s.players[0].powers, []);
  assert.equal(s.sabs.length, 2);
  s = nextQuestion(s, t0);
  assert.equal(s.active[1][0].power, 'time');
  assert.equal(deadlineOf(s, 1), s.endsAt - STEAL_MS);
  assert.equal(deadlineOf(s, 0), s.endsAt);
  const q = fullQuestion(s);
  assert.equal(answer(s, { by: 1, raw: good(q), now: s.endsAt - 1000 }).ok, false, 'chrono volé : trop tard pour B');
  assert.ok(answer(s, { by: 0, raw: good(q), now: s.endsAt - 1000 }).ok);
  s = reveal(s, t0 + 1);
  s = nextQuestion(s, t0 + 1e5);
  assert.deepEqual(s.active, {}, 'un sabotage ne dure qu\'une question');
  const off = createGame({ players, cfg: { sabotage: 0 }, seed: 1, now: 0 });
  assert.equal(off.cfg.sabotage, false);
});

t('bots saboteurs : visent le meneur', () => {
  const s = createGame({ players: [{ id: 0, name: 'A' }, { id: 1, name: 'B' }, { id: 100, name: 'Bot', bot: true }], cfg: {}, seed: 2, now: 0 });
  s.players[0].score = 500; s.players[1].score = 100; s.players[2].powers = ['fog'];
  let hit = 0;
  for (let i = 0; i < 50; i++) { const a = botSabotage(s, 100); if (a) { hit++; assert.equal(a.target, 0); assert.equal(a.power, 'fog'); } }
  assert.ok(hit > 10);
  s.players[2].powers = ['shield'];
  assert.equal(botSabotage(s, 100), null, 'le bouclier ne se lance pas');
});

t('The Candidate : choix mélangés, difficulté qui monte, finale au plus dur', () => {
  const pos = [0, 0, 0, 0];
  for (let i = 0; i < 4000; i++) { const q = makeQuestion(i * 7919 + 3, i % 15, 'chartier', 'normal', 0, 15); if (q.kind === 'chartier') pos[q.answer]++; }
  for (const n of pos) assert.ok(n > 0.2 * pos.reduce((x, y) => x + y, 0), `bonne réponse trop souvent au même endroit : ${pos}`);
  assert.deepEqual([0, 5, 9, 13, 14].map((i) => chartierTier(1, i, 15)), [1, 2, 2, 3, 3]);
  assert.equal(chartierTier(0, 9, 10), 2); assert.equal(chartierTier(0, 0, 10), 1);
  assert.equal(chartierTier(2, 0, 10), 2); assert.equal(chartierTier(2, 9, 10), 3);
  // banque : 4 choix distincts, explication, pas de choix vide
  for (const q of CHARTIER_QUESTIONS.filter((x) => x.type === 'choice')) {
    assert.ok(q.wrong.includes(q.trap), `piège parmi les mauvaises réponses : ${q.text}`);
    const all = [q.good, ...q.wrong];
    assert.equal(new Set(all).size, 4, q.text); assert.ok(all.every(Boolean) && q.tip && q.tier, q.text);
  }
  let s = createGame({ players: [{ id: 0, name: 'A' }], cfg: { mode: 'chartier', len: 10, diff: 'normal' }, seed: 99, now: 0 });
  assert.equal(s.cfg.theme, 'chartier');
  const seen = new Set();
  for (let i = 0; i < 10; i++) {
    s = nextQuestion(s, i * 1e5);
    const q = fullQuestion(s); seen.add(q.key);
    assert.equal(s.q.pts, (q.tier + (q.input === 'code' || q.input === 'mm' ? 1 : 0)) * (i === 9 ? 2 : 1));
    assert.ok(!('answer' in publicState(s).q) || publicState(s).q.answer === undefined);
    if (q.input === 'code') {
      const r = answer(s, { by: 0, raw: q.show, idx: i, now: i * 1e5 + 1000 });
      assert.ok(r.ok && r.pending); s = r.state;
      s = gradeCode(s, { by: 0, idx: i, passed: q.tests.length, total: q.tests.length }).state;
    } else s = answer(s, { by: 0, raw: q.input === 'mm' ? '9/12;9/12;9/12' : String(q.answer), idx: i, now: i * 1e5 + 1000 }).state;
    s = reveal(s, i * 1e5 + 2000);
    if (s.last.input === 'choice') assert.equal(s.last.choices[s.last.answer], s.last.show);
  }
  assert.equal(seen.size, 10);
  assert.ok(s.players[0].score > 0 && s.players[0].right === 10 && s.players[0].lives === LIVES);
});

// joue une question : chaque joueur répond selon how[id] = 'good' | 'slow' (juste, mais à la fin) | 'bad' | 'trap' | 'none'
function play(s, how, now) {
  const q = fullQuestion(s);
  for (const [id, h] of Object.entries(how)) {
    if (h === 'none' || s.players.find((p) => p.id === +id).out) continue;
    let raw = h === 'good' || h === 'slow' ? good(q) : bad(q);
    const at = now + (h === 'slow' ? q.time * 950 : 500);
    if (h === 'trap') raw = q.input === 'choice' ? String(q.trap) : String(q.traps && q.traps[0] != null ? q.traps[0] : q.answer * 3 + 7);
    if (q.input === 'code') {
      s = answer(s, { by: +id, raw: 'def f(): pass', idx: s.idx, now: at }).state;
      s = gradeCode(s, { by: +id, idx: s.idx, passed: h === 'good' || h === 'slow' ? q.tests.length : 0, total: q.tests.length }).state;
    } else { const r = answer(s, { by: +id, raw, idx: s.idx, now: at }); if (r.ok) s = r.state; } // refusé : spectateur du face-à-face
  }
  return reveal(s, now + q.time * 1000);
}

t('The Candidate : vies, piège, éliminations aux paliers, dernier debout', () => {
  const players = [0, 1, 2, 3].map((id) => ({ id, name: 'P' + id }));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed: 5, now: 0 });
  assert.ok(s.players.every((p) => p.lives === LIVES && p.jokers.length === 2));
  // trouver une question à choix pour tester le piège
  let now = 0;
  s = nextQuestion(s, now);
  while (fullQuestion(s).input !== 'choice') { s = play(s, { 0: 'good', 1: 'good', 2: 'good', 3: 'good' }, now); now += 1e5; s = nextQuestion(s, now); }
  const q = fullQuestion(s);
  assert.ok(isTrap(q, String(q.trap)) && !isTrap(q, String(q.answer)));
  const before = s.players.map((p) => p.lives);
  s = play(s, { 0: 'good', 1: 'trap', 2: 'none', 3: 'good' }, now);
  assert.equal(s.players[1].lives, before[1] - [0, 1, 2, 2][q.tier], 'le piège coûte selon le tour');
  assert.equal(s.players[2].lives, before[2] - 1, 'le silence coûte une vie');
  assert.equal(s.players[0].lives, before[0]);
  assert.ok(s.last.results[1].tags.includes('trap'));
  // jouer jusqu'au bout : le joueur 0 répond juste, les autres se trompent
  let cuts = 0;
  while (s.phase !== 'over') {
    now += 1e5; s = nextQuestion(s, now);
    if (s.phase === 'over') break;
    s = play(s, { 0: 'good', 1: 'bad', 2: 'bad', 3: 'good' }, now);
    cuts += s.last.eliminated.filter((e) => e.why === 'palier').length;
    for (const p of s.players) assert.ok(p.lives >= 0);
    assert.ok(s.last.results.filter((r) => r.out).every((r) => r.pts === 0));
  }
  assert.ok(s.players[1].out && s.players[2].out, 'à court de vies');
  assert.ok(!s.players[0].out);
  assert.equal(standings(s)[0], 0);
  const order = standings(s), outs = order.filter((id) => s.players.find((p) => p.id === id).out);
  assert.deepEqual(order.slice(-outs.length), outs, 'les éliminés en fin de classement');
  assert.ok(s.history.length < 15 || cuts >= 0);
  // un éliminé ne peut plus répondre
  const ended = s;
  assert.equal(ended.phase, 'over');
});

t('The Candidate : palier qui élimine le dernier, arrêt quand il reste un candidat', () => {
  const players = [0, 1, 2].map((id) => ({ id, name: 'P' + id }));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 10, diff: 'normal' }, seed: 8, now: 0 });
  let now = 0, cut = null;
  while (s.phase !== 'over') {
    s = nextQuestion(s, now); if (s.phase === 'over') break;
    // tout le monde répond juste, mais 2 toujours au dernier moment : il garde ses vies et traîne au score
    s = play(s, { 0: 'good', 1: 'good', 2: 'slow' }, now);
    if (s.last.eliminated.some((e) => e.why === 'palier')) cut = s.last.eliminated.find((e) => e.why === 'palier');
    now += 1e5;
    const out = s.players.find((p) => p.out);
    if (out) assert.equal(answer(nextQuestion(s, now), { by: out.id, raw: '1', idx: s.idx + 1, now: now + 1 }).ok, false, 'un éliminé ne répond plus');
  }
  assert.ok(s.players[2].out && s.players[2].outWhy === 'palier' && s.players[2].lives === LIVES, 'le dernier saute');
  assert.equal(cut.id, 2);
  assert.ok(!s.players[0].out && !s.players[1].out, 'à deux, plus d\'élimination au palier');
  assert.equal(s.history.filter((h) => !h.duel).length, 10);
});

t('The Candidate : la fin d\'un tour laisse le temps de la mise en scène, même sans coupe', () => {
  const players = [0, 1].map((id) => ({ id, name: 'P' + id }));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 15, cut: 0, code: 0, duel: 0 }, seed: 9, now: 0 });
  let now = 0, ends = 0, plain = 0;
  while (s.phase !== 'over') {
    s = nextQuestion(s, now); if (s.phase === 'over') break;
    s = play(s, { 0: 'good', 1: 'good' }, now); now += 1e5;
    if (s.last.tierEnd) { ends++; assert.ok(s.revealMs >= 5200 + 9200, `pause allongée : ${s.revealMs}`); } else plain = Math.max(plain, s.revealMs);
  }
  assert.equal(ends, 2, 'deux passages : premier tour → desk → comité');
  assert.ok(plain < 5200 + 9200 && plain >= 5200 + 2400, `bandeau de transition compris : ${plain}`);
});

t('The Candidate : en solo, la partie s\'arrête quand on n\'a plus de vies', () => {
  let s = createGame({ players: [{ id: 0, name: 'Solo' }], cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed: 3, now: 0 });
  let now = 0;
  while (s.phase !== 'over') { s = nextQuestion(s, now); if (s.phase === 'over') break; s = play(s, { 0: 'none' }, now); now += 1e5; }
  assert.equal(s.history.length, LIVES, 'trois silences, trois vies');
  assert.ok(s.players[0].out && s.players[0].outWhy === 'vies');
});

t('The Candidate : seul contre des bots, on va au bout ; plus d\'humain en lice, c\'est fini', () => {
  let s = createGame({ players: [{ id: 0, name: 'Moi' }, { id: 100, name: 'Bot', bot: true }, { id: 101, name: 'Bot2', bot: true }], cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed: 4, now: 0 });
  let now = 0;
  while (s.phase !== 'over') { s = nextQuestion(s, now); if (s.phase === 'over') break; s = play(s, { 0: 'good', 100: 'none', 101: 'none' }, now); now += 1e5; }
  assert.ok(s.players[1].out && s.players[2].out);
  assert.equal(s.history.length, 15, 'le dernier humain finit l\'entretien');
  s = createGame({ players: [{ id: 0, name: 'Moi' }, { id: 100, name: 'Bot', bot: true }], cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed: 4, now: 0 });
  now = 0;
  while (s.phase !== 'over') { s = nextQuestion(s, now); if (s.phase === 'over') break; s = play(s, { 0: 'none', 100: 'good' }, now); now += 1e5; }
  assert.equal(s.history.length, LIVES, 'l\'humain éliminé : fin, sans regarder les bots jouer seuls');
});

t('The Candidate : code corrigé en différé, points partiels sans perte de vie', () => {
  const players = [0, 1, 2, 3, 4].map((id) => ({ id, name: 'P' + id }));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed: 11, now: 0 });
  let now = 0;
  const all = (h) => Object.fromEntries(s.players.map((p, k) => [p.id, k ? 'good' : h]));
  s = nextQuestion(s, now);
  // le joueur 0 répond vite : il n'est jamais coupé au palier
  while (fullQuestion(s).input !== 'code') { s = play(s, all('good'), now); now += 1e5; s = nextQuestion(s, now); }
  const [A, B, C] = s.players.filter((p) => !p.out).map((p) => p.id);
  const q = fullQuestion(s), T = q.tests.length;
  assert.ok(!('tests' in publicState(s).q), 'les tests cachés ne partent pas');
  assert.equal(publicState(s).q.ntests, T);
  let r = answer(s, { by: A, raw: 'def x(): pass', idx: s.idx, now: now + 1000 });
  assert.ok(r.pending && !r.done); s = r.state;
  assert.ok(publicState(s).answers[A].grading);
  assert.equal(gradeCode(s, { by: C, idx: s.idx, passed: 1, total: T }).ok, false, 'pas de code envoyé');
  s = gradeCode(s, { by: A, idx: s.idx, passed: T, total: T }).state;
  s = answer(s, { by: B, raw: 'def x(): pass', idx: s.idx, now: now + 2000 }).state;
  s = gradeCode(s, { by: B, idx: s.idx, passed: 2, total: T }).state;
  const lives = Object.fromEntries(s.players.map((p) => [p.id, p.lives]));
  s = reveal(s, now + 3000);
  const res = (id) => s.last.results.find((x) => x.id === id);
  const a = res(A), b = res(B), c = res(C);
  assert.ok(a.ok && a.pts > 0 && a.passed === T);
  assert.ok(!b.ok && b.pts > 0 && b.pts < a.pts && b.passed === 2, 'points partiels');
  assert.equal(s.players.find((p) => p.id === B).lives, lives[B], 'quelques tests réussis : pas de vie perdue');
  assert.equal(s.players.find((p) => p.id === C).lives, lives[C] - 1);
  assert.ok(!c.ok && c.pts === 0);
  assert.equal(s.history.at(-1).results.find((x) => x.id === A).raw, `${T}/${T}`, 'le code lui-même ne reste pas dans l\'historique');
});

t('The Candidate : jokers 50/50 et appel à un ami', () => {
  const players = [0, 1].map((id) => ({ id, name: 'P' + id }));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed: 21, now: 0 });
  let now = 0;
  s = nextQuestion(s, now);
  while (fullQuestion(s).input !== 'choice') { s = play(s, { 0: 'good', 1: 'good' }, now); now += 1e5; s = nextQuestion(s, now); }
  const q = fullQuestion(s);
  let r = useJoker(s, { by: 0, kind: 'half' });
  assert.ok(r.ok && r.info.removed.length === 2);
  assert.ok(!r.info.removed.includes(q.answer) && !r.info.removed.includes(q.trap), 'le 50/50 garde la bonne réponse et le piège');
  s = r.state;
  assert.equal(useJoker(s, { by: 0, kind: 'half' }).ok, false, 'une seule fois par partie');
  r = useJoker(s, { by: 0, kind: 'friend' }); assert.ok(r.ok && [q.answer, q.trap].includes(r.info.suggest)); s = r.state;
  assert.deepEqual(s.players[0].jokers, []);
  // l'ami a raison la plupart du temps
  let right = 0;
  for (let seed = 0; seed < 300; seed++) {
    let g = createGame({ players, cfg: { mode: 'chartier', len: 15, diff: 'normal' }, seed, now: 0 });
    g = nextQuestion(g, 0); const gq = fullQuestion(g);
    if (gq.input !== 'choice') continue;
    const k = useJoker(g, { by: 1, kind: 'friend' });
    if (k.info.suggest === gq.answer) right++; else assert.equal(k.info.suggest, gq.trap);
  }
  assert.ok(right > 150, `ami fiable : ${right}`);
  // pas de joker hors The Candidate
  const c = nextQuestion(createGame({ players, cfg: {}, seed: 1, now: 0 }), 0);
  assert.equal(useJoker(c, { by: 0, kind: 'half' }).ok, false);
});

t('The Candidate : trois bonnes réponses d\'affilée rendent un cœur, sans dépasser le départ', () => {
  const players = [0, 1, 2].map((id) => ({ id, name: 'P' + id }));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 15, code: 0, cut: 0 }, seed: 6, now: 0 });
  let now = 0;
  const step = (how) => { s = nextQuestion(s, now); s = play(s, how, now); now += 1e5; };
  step({ 0: 'bad', 1: 'good', 2: 'good' });
  assert.equal(s.players[0].lives, 2);
  step({ 0: 'good', 1: 'good', 2: 'good' }); step({ 0: 'good', 1: 'good', 2: 'good' });
  assert.equal(s.players[0].lives, 2, 'deux bonnes : pas encore');
  assert.equal(s.players[1].lives, 3, 'P1 au maximum : rien de plus');
  assert.ok(!s.last.results[1].tags.includes('life'));
  step({ 0: 'good', 1: 'good', 2: 'good' });
  assert.equal(s.players[0].lives, 3, 'trois d\'affilée : +1');
  assert.ok(s.last.results[0].tags.includes('life') && s.last.results[0].gained === 1);
  step({ 0: 'good', 1: 'good', 2: 'good' }); step({ 0: 'good', 1: 'good', 2: 'good' }); step({ 0: 'good', 1: 'good', 2: 'good' });
  assert.equal(s.players[0].lives, 3, 'jamais plus que le nombre de départ');
});

t('The Candidate : piège plus cher à chaque tour, estimation presque juste sans perte de vie', () => {
  const players = [0, 1].map((id) => ({ id, name: 'P' + id }));
  // une question à choix de chaque tour, avec piège
  for (const tier of [1, 2, 3]) for (let seed = 40 + tier, done = false; !done && seed < 140; seed += 7) {
    let s = createGame({ players, cfg: { mode: 'chartier', len: 15, cut: 0, code: 0, duel: 0 }, seed, now: 0 });
    let now = 0;
    while (!done && s.phase !== 'over') {
      s = nextQuestion(s, now); if (s.phase === 'over') break;
      const q = fullQuestion(s);
      if (q.input === 'choice' && q.tier === tier && q.trap >= 0 && s.players[0].lives === 3) {
        s = play(s, { 0: 'trap', 1: 'good' }, now);
        const r = s.last.results[0];
        assert.equal(r.lost, [0, 1, 2, 2][tier], `tour ${tier} : vies perdues`);
        assert.equal(r.pts < 0, tier === 3, `tour ${tier} : points retirés seulement au comité`);
        done = true;
      } else s = play(s, { 0: 'good', 1: 'good' }, now);
      now += 1e5;
    }
    if (seed + 7 >= 140) assert.ok(done, `piège trouvé au tour ${tier}`);
  }
  // presque juste : marge ±10 %, réponse à +15 %
  const q = { input: 'num', isChartier: true, answer: 100, tol: 0.1, tolMode: 'rel' };
  assert.ok(!check(q, '115').ok && check(q, '115').near && !check(q, '125').near);
  const f = { input: 'num', isChartier: true, answer: 1000, tol: 2, tolMode: 'factor' };
  assert.ok(check(f, '3000').near && !check(f, '5000').near && check(f, '1500').ok);
});

t('The Candidate : face-à-face final en mort subite entre les deux premiers', () => {
  const players = [0, 1, 2].map((id) => ({ id, name: 'P' + id }));
  const run = (duelHow) => {
    let s = createGame({ players, cfg: { mode: 'chartier', len: 10, cut: 0, code: 0 }, seed: 12, now: 0 });
    let now = 0;
    // 0 répond vite, 1 lentement, 2 se trompe : 0 et 1 finissent premiers
    while (!s.duel && s.phase !== 'over') { s = nextQuestion(s, now); if (s.duel || s.phase === 'over') break; s = play(s, { 0: 'good', 1: 'slow', 2: s.idx % 4 ? 'good' : 'bad' }, now); now += 1e5; }
    return { s, now };
  };
  let { s, now } = run();
  assert.ok(s.duel && s.phase === 'question' && s.idx === 10, 'le face-à-face commence après la dernière question');
  assert.deepEqual(s.duel.ids, [0, 1]);
  assert.equal(answer(s, { by: 2, raw: '0', idx: s.idx, now: now + 100 }).ok, false, 'le troisième regarde');
  assert.equal(useJoker(s, { by: 1, kind: 'half' }).ok, false, 'pas de joker');
  // le second (moins de points) répond juste le premier : il gagne et passe devant
  const q = fullQuestion(s);
  const r = answer(s, { by: 1, raw: good(q), idx: s.idx, now: now + 500 });
  assert.ok(r.ok && r.done, 'la première réponse décide');
  s = reveal(r.state, now + 600);
  assert.equal(s.duel.winner, 1);
  s = nextQuestion(s, now + 1e5);
  assert.equal(s.phase, 'over'); assert.deepEqual(s.ranking.slice(0, 2), [1, 0]);
  // une réponse fausse fait perdre, même la première
  ({ s, now } = run());
  s = reveal(answer(s, { by: 0, raw: bad(fullQuestion(s)), idx: s.idx, now: now + 500 }).state, now + 600);
  assert.equal(s.duel.winner, 1, 'le premier qui se trompe perd');
  // personne ne répond : on enchaîne, puis le score départage
  ({ s, now } = run());
  for (let k = 0; k < 5 && s.phase !== 'over'; k++) { s = reveal(s, now + 1); now += 1e5; s = nextQuestion(s, now); }
  assert.equal(s.phase, 'over'); assert.equal(s.ranking[0], 0, 'après 5 silences, le meilleur score gagne');
  // désactivé : pas de face-à-face
  let g = createGame({ players, cfg: { mode: 'chartier', len: 10, cut: 0, code: 0, duel: 0 }, seed: 12, now: 0 });
  now = 0;
  while (g.phase !== 'over') { g = nextQuestion(g, now); if (g.phase === 'over') break; g = play(g, { 0: 'good', 1: 'good', 2: 'good' }, now); now += 1e5; }
  assert.ok(!g.duel && g.history.length === 10);
});

t('The Candidate : modules par métier, rubriques orientées', () => {
  const count = (module) => { const c = {}; for (let i = 0; i < 3000; i++) { const q = makeQuestion(i * 7919 + 5, i % 15, 'chartier', 'normal', 0, 15, module); if (q.rubric) c[q.rubric] = (c[q.rubric] || 0) + 1; } return c; };
  const gen = count('gen'), trading = count('trading'), ma = count('ma'), quant = count('quant');
  assert.ok(trading['Dérivés'] > gen['Dérivés'] * 1.3 && (trading['Corporate'] || 0) === 0, 'trading : dérivés et marchés');
  assert.ok(ma['Corporate'] > gen['Corporate'] * 2.5, 'M&A : finance d\'entreprise');
  assert.ok(quant['Probas'] > gen['Probas'] * 2, 'quant : probabilités');
  assert.equal(createGame({ players: [{ id: 0, name: 'A' }], cfg: { mode: 'chartier', module: 'nimporte' }, seed: 1, now: 0 }).cfg.module, 'gen');
  assert.equal(createGame({ players: [{ id: 0, name: 'A' }], cfg: { mode: 'classic', module: 'quant' }, seed: 1, now: 0 }).cfg.module, 'gen');
});

t('The Candidate : fat finger, numéro de téléphone, réponses multiples', () => {
  const kinds = {};
  for (let i = 0; i < 6000; i++) { const q = makeQuestion(i * 7919 + 13, i % 15, 'chartier', 'normal', 0, 15); kinds[q.kind] = (kinds[q.kind] || 0) + 1;
    if (q.kind === 'phone') {
      const digits = [...q.copy.replace(/\D/g, '')].map(Number), sum = digits.reduce((a, b) => a + b, 0);
      assert.ok(/^0[67]( \d\d){4}$/.test(q.copy), q.copy);
      assert.equal(q.answer, /53/.test(q.text) ? sum * 53 : sum);
    }
  }
  assert.ok(kinds.fatfinger > 150 && kinds.phone > 60 && kinds['chartier-multi'] > 20, JSON.stringify(kinds));
  assert.equal(FAT_FINGER.length, 80); assert.equal(new Set(FAT_FINGER.map((f) => f.text)).size, 80);
  assert.equal(PHONES.length, 50); assert.equal(new Set(PHONES).size, 50);
  // une partie : la question à cocher compte juste, la mauvaise sélection coûte une vie
  const g = (cfg) => createGame({ players: [{ id: 0, name: 'A' }], cfg: { mode: 'chartier', len: 15, code: 0, ...cfg }, seed: 3, now: 0 });
  let s = g({}), now = 0, seen = 0;
  while (s.phase !== 'over' && seen < 2) {
    s = nextQuestion(s, now); if (s.phase === 'over') break;
    const q = fullQuestion(s);
    if (q.input === 'multi' || q.input === 'text') {
      seen++;
      const lives = s.players[0].lives, raw = q.input === 'multi' ? q.answer.slice(1).join(',') || String(q.choices.length - 1) : q.answer + 'X';
      s = reveal(answer(s, { by: 0, raw, idx: s.idx, now: now + 500 }).state, now + 1000);
      assert.equal(s.players[0].lives, lives - 1, `${q.kind} raté : une vie`);
    } else s = play(s, { 0: 'good' }, now);
    now += 1e5;
  }
  // un bot qui se trompe ne tombe pas juste par hasard
  const mq = { input: 'multi', choices: ['a', 'b', 'c', 'd'], answer: [0, 2], time: 20, isChartier: true, tier: 2 };
  for (let k = 0; k < 50; k++) { const b = botAnswer(mq, 'facile'); if (b && b.raw !== '0,2') assert.ok(!check(mq, b.raw).ok); }
});

t('QCM : la bonne réponse ne se repère pas à sa longueur', () => {
  const Q = CHARTIER_QUESTIONS.filter((q) => q.type === 'choice'), L = (q) => Math.max(...q.wrong.map((w) => w.length));
  const tell = Q.filter((q) => q.good.length >= 20 && q.good.length > 1.5 * L(q));
  assert.deepEqual(tell.map((q) => q.text), [], 'bonne réponse bien plus longue que toutes les autres');
  const longest = Q.filter((q) => q.good.length > L(q)).length / Q.length;
  assert.ok(longest < 0.32, `la bonne réponse est la plus longue dans ${Math.round(longest * 100)} % des QCM`);
});

t('The Candidate : épreuves Python et SQL réglables séparément', () => {
  const langs = (cfg) => { const l = new Set(); for (let seed = 1; seed < 160; seed++) { const g = createGame({ players: [{ id: 0, name: 'A' }], cfg: { mode: 'chartier', len: 15, ...cfg }, seed, now: 0 }); g.cats.forEach((c, i) => { if (c === 'code') l.add(fullQuestion(g, i).lang); }); } return [...l].sort(); };
  assert.deepEqual(langs({}), ['python', 'sql']);
  assert.deepEqual(langs({ sql: 0 }), ['python']);
  assert.deepEqual(langs({ code: 0 }), ['sql']);
  assert.ok(!createGame({ players: [{ id: 0, name: 'A' }], cfg: { mode: 'chartier', len: 15, code: 0, sql: 0 }, seed: 1, now: 0 }).cats.includes('code'), 'ni Python ni SQL : pas d\'épreuve');
});

t('Java : lire du code, choix distincts, et des questions qui sortent en partie', () => {
  assert.equal(JAVA_READ.length, 20);
  for (const q of JAVA_READ) assert.ok(q.lang === 'java' && !q.wrong.includes(q.good) && new Set(q.wrong).size === 3, q.code);
  let java = 0, concepts = 0;
  for (let i = 0; i < 8000; i++) { const q = makeQuestion(i * 7919 + 29, i % 15, 'chartier', 'normal', 0, 15, 'quant'); if (q.lang === 'java') java++; if (q.rubric === 'Java') concepts++; }
  assert.ok(java > 50, `programmes Java tirés : ${java}`);
  assert.equal(CHARTIER_QUESTIONS.filter((q) => q.cat === 'Java').length, 12);
});

t('The Candidate : règles maison (vies, jokers, code, coupe, sabotage)', () => {
  const players = [0, 1, 2, 3].map((id) => ({ id, name: 'P' + id }));
  const def = createGame({ players, cfg: { mode: 'chartier', len: 15 }, seed: 1, now: 0 });
  assert.ok(def.cfg.jokers && def.cfg.code && def.cfg.cut && def.cfg.lives === 3 && !def.cfg.sabotage, 'par défaut : tout, sauf le sabotage');
  assert.ok(def.cats.includes('code'));
  let s = createGame({ players, cfg: { mode: 'chartier', len: 15, lives: 5, jokers: 0, code: 0, sql: 0, cut: 0, chsab: 1 }, seed: 1, now: 0 });
  assert.equal(s.cfg.lives, 5); assert.ok(s.players.every((p) => p.lives === 5 && !p.jokers.length));
  assert.ok(!s.cats.includes('code'), 'pas d\'épreuve de code');
  assert.ok(s.cfg.sabotage);
  assert.equal(createGame({ players, cfg: { mode: 'chartier', lives: 4 }, seed: 1, now: 0 }).cfg.lives, 3, 'valeur inconnue : 3 vies');
  s = nextQuestion(s, 0);
  assert.equal(useJoker(s, { by: 0, kind: 'half' }).ok, false, 'jokers coupés');
  // sans coupe : personne ne saute au palier
  let now = 0;
  while (s.phase !== 'over') { s = play(s, { 0: 'good', 1: 'good', 2: 'good', 3: 'slow' }, now); now += 1e5; s = nextQuestion(s, now); }
  assert.ok(s.players.every((p) => !p.out) && s.history.filter((h) => !h.duel).length === 15);
  // la sabotage classique ne déborde pas sur The Candidate
  assert.equal(createGame({ players, cfg: { mode: 'chartier', sabotage: 1 }, seed: 1, now: 0 }).cfg.sabotage, false);
});

t('code : chaque exercice a une solution de référence et des tests sous la limite des entiers JSON', () => {
  for (const c of CODE_QUESTIONS) {
    assert.ok(c.fn && c.starter.includes(`def ${c.fn}`) && c.ref.includes(`def ${c.fn}`) && c.tests.length >= 4, c.title);
    const big = (v) => (Array.isArray(v) ? v.some(big) : typeof v === 'number' && Math.abs(v) > 2 ** 53);
    for (const [args, exp] of c.tests) assert.ok(!big(args) && !big(exp), `${c.title} : ${exp}`);
  }
});

t('figures à compter : chaque réponse recomptée par force brute', () => {
  const seen = new Set();
  for (const diff of DIFFS) for (let i = 0; i < 1500; i++) {
    const q = makeQuestion(i * 104729 + 17, i, 'visuel', diff);
    seen.add(q.kind); const f = q.fig;
    let n = null;
    if (q.kind === 'box') n = f.a * f.b * f.c;
    if (q.kind === 'painted') {
      const want = /aucune/.test(q.text) ? 0 : Number(q.text.match(/exactement (\d)/)[1]); n = 0;
      for (let x = 0; x < f.a; x++) for (let y = 0; y < f.a; y++) for (let z = 0; z < f.a; z++) n += [x, y, z].filter((v) => v === 0 || v === f.a - 1).length === want;
    }
    if (q.kind === 'stair') { n = 0; for (let k = 0; k < f.n; k++) n += (k + 1) * f.w; }
    if (q.kind === 'paths') { const W = Array.from({ length: f.n + 1 }, () => Array(f.m + 1).fill(1)); for (let y = 1; y <= f.n; y++) for (let x = 1; x <= f.m; x++) W[y][x] = W[y - 1][x] + W[y][x - 1]; n = W[f.n][f.m]; }
    if (q.kind === 'diag') { n = 0; for (let a = 0; a < f.n; a++) for (let b = a + 2; b < f.n; b++) if (!(a === 0 && b === f.n - 1)) n++; }
    if (q.kind === 'grid-sq' || q.kind === 'grid-sq-rect') { n = 0; for (let k = 1; k <= Math.min(f.n, f.m); k++) n += (f.m - k + 1) * (f.n - k + 1); }
    if (q.kind === 'strip') { n = 0; for (let a = 0; a <= f.m; a++) for (let b = a + 1; b <= f.m; b++) n++; }
    if (q.kind === 'fan') { n = 0; for (let a = 0; a < f.k + 2; a++) for (let b = a + 1; b < f.k + 2; b++) n++; }
    if (q.kind === 'grid-rect') { n = 0; for (let x1 = 0; x1 <= f.m; x1++) for (let x2 = x1 + 1; x2 <= f.m; x2++) for (let y1 = 0; y1 <= f.n; y1++) for (let y2 = y1 + 1; y2 <= f.n; y2++) n++; }
    if (n != null) assert.equal(q.answer, n, `${q.kind} ${q.text} ${JSON.stringify(f)}`);
    assert.ok(Number.isInteger(q.answer) && q.answer > 0 && q.tip && !/NaN|undefined/.test(q.text + q.tip + q.sub), `${q.kind} ${q.tip}`);
  }
  for (const k of KINDS.visuel) assert.ok(seen.has(k), `figure ${k} jamais tirée`);
});

t('graphiques : chaque réponse recalculée à partir des données dessinées', () => {
  const num = (t) => Number(String(t).replace('−', '-').replace(/\s/g, '').replace(',', '.').replace(/[^\d.\-+]/g, ''));
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const seen = new Set();
  for (let i = 0; i < 9000; i++) {
    const q = makeQuestion(i * 104729 + 3, i % 15, 'chartier', ['facile', 'normal', 'expert'][i % 3], 0, 15, ['gen', 'trading', 'ma', 'risk', 'quant'][i % 5]);
    if (q.kind !== 'chart') continue;
    const f = q.fig, good = q.choices[q.answer]; seen.add(f.c);
    assert.ok(q.trap >= 0 && q.trap !== q.answer && new Set(q.choices).size === 4, q.text);
    if (f.c === 'yc' && /décrire/.test(q.text)) {
      const up = f.y.every((v, k) => !k || v > f.y[k - 1]), down = f.y.every((v, k) => !k || v < f.y[k - 1]);
      const flat = Math.max(...f.y) - Math.min(...f.y) < 0.1, hump = [1, 2, 3].includes(f.y.indexOf(Math.max(...f.y))) && !up && !down;
      assert.ok({ 'Normale, pentue': up, Inversée: down, Plate: flat, 'En bosse': hump }[good], `${good} ${f.y}`);
    } else if (f.c === 'yc') assert.equal(num(good), Math.round((f.y[3] - f.y[1]) * 100), `${good} ${f.y}`);
    if (f.c === 'payoff') {
      const curve = (legs) => Array.from({ length: 41 }, (_, k) => payoffAt(legs, 50 + k * 2.5)).join();
      assert.equal(curve(STRATS[good].legs), curve(f.legs));
      for (const c of q.choices) if (c !== good) assert.notEqual(curve(STRATS[c].legs), curve(f.legs), `${c} se confond avec ${good}`);
    }
    if (f.c === 'line' && /Performance/.test(q.text)) assert.ok(near(num(good), ((f.y[6] - f.y[0]) / f.y[0]) * 100, 0.06), `${good} ${f.y}`);
    if (f.c === 'line' && /drawdown/.test(q.text)) {
      let peak = f.y[0], dd = 0; for (const x of f.y) { peak = Math.max(peak, x); dd = Math.max(dd, (peak - x) / peak); }
      assert.ok(near(-num(good), dd * 100, 0.06), `${good} ${f.y}`);
    }
    if (f.c === 'book' && /tout de suite/.test(q.text)) assert.ok(near(num(good), f.ask[0], 0.006));
    if (f.c === 'book' && /Prix moyen/.test(q.text)) {
      let left = f.buy, cost = 0; for (let k = 0; k < 4 && left > 0; k++) { const take = Math.min(left, f.aq[k]); cost += take * f.ask[k]; left -= take; }
      assert.equal(left, 0); assert.ok(near(num(good), cost / f.buy, 0.006), `${good} vs ${cost / f.buy}`);
    }
    if (f.c === 'book' && /points de base/.test(q.text)) assert.ok(near(num(good), ((f.ask[0] - f.bid[0]) / ((f.ask[0] + f.bid[0]) / 2)) * 1e4, 0.06));
    if (f.c === 'bars' && /Quelle année/.test(q.text)) {
      const g = f.y.slice(1).map((x, k) => (x - f.y[k]) / f.y[k]);
      assert.equal(good, `An ${g.indexOf(Math.max(...g)) + 2}`);
    }
    if (f.c === 'bars' && /TCAM/.test(q.text)) assert.ok(near(num(good), ((f.y[4] / f.y[0]) ** 0.25 - 1) * 100, 0.06));
  }
  assert.deepEqual([...seen].sort(), ['bars', 'book', 'line', 'payoff', 'yc']);
});

// Python local (le même harnais que dans le navigateur) : les solutions de référence passent tous leurs tests
const py = spawnSync('python3', ['-I', '-c', 'print(1)'], { encoding: 'utf8' });
const runPy = (code, fn, tests) => {
  const r = spawnSync('python3', ['-I', '-c', buildProgram(code, fn, tests, { print: true })], { encoding: 'utf8', timeout: 10000 });
  const line = (r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULT@@'));
  return line ? JSON.parse(line.slice(10)) : { error: r.stderr || 'pas de résultat', tests: [] };
};
if (py.status === 0) t('code : références justes, code vide ou tricheur refusé (python3)', () => {
  for (const c of CODE_QUESTIONS) {
    const out = runPy(c.ref, c.fn, c.tests);
    assert.equal(scoreRun(out, c.tests.length), c.tests.length, `${c.title} : ${JSON.stringify(out)}`);
    assert.equal(scoreRun(runPy(c.starter, c.fn, c.tests), c.tests.length) < c.tests.length, true, `${c.title} : le squelette ne suffit pas`);
  }
  const c = CODE_QUESTIONS[0];
  assert.ok(runPy('def ' + c.fn + '(:', c.fn, c.tests).error, 'erreur de syntaxe signalée');
  const cheat = `class T:\n    def __eq__(self, o): return True\ndef ${c.fn}(*a): return T()`;
  assert.equal(scoreRun(runPy(cheat, c.fn, c.tests), c.tests.length), 0, 'un objet « égal à tout » ne passe pas');
});
else console.log('· python3 absent : vérification des solutions de code sautée');

if (py.status === 0) t('code : lire du code, corriger un bug, SQL (python3)', () => {
  for (const q of READ_QUESTIONS) {
    const r = spawnSync('python3', ['-I', '-c', q.code], { encoding: 'utf8' });
    assert.equal(r.stdout.trim(), q.good, `sortie réelle de : ${q.code}`);
    assert.ok(!q.wrong.includes(q.good) && new Set(q.wrong).size === 3);
  }
  for (const q of FIX_QUESTIONS) {
    const T = q.tests.length;
    assert.equal(scoreRun(runPy(q.ref, q.fn, q.tests), T), T, `${q.title} : correction`);
    assert.ok(scoreRun(runPy(q.starter, q.fn, q.tests), T) < T, `${q.title} : le code de départ a bien un bug`);
  }
  const runSql = (code, q) => {
    const r = spawnSync('python3', ['-I', '-c', buildProgram(code, null, q.tests, { print: true, lang: 'sql', ordered: q.ordered })], { encoding: 'utf8', timeout: 10000 });
    const line = (r.stdout || '').split('\n').find((l) => l.startsWith('@@RESULT@@'));
    return line ? JSON.parse(line.slice(10)) : { error: r.stderr, tests: [] };
  };
  for (const q of SQL_QUESTIONS) {
    assert.equal(scoreRun(runSql(q.ref, q), 3), 3, `${q.title} : requête de référence`);
    assert.equal(scoreRun(runSql('SELECT 1', q), 3), 0, `${q.title} : une requête quelconque échoue`);
    assert.ok(runSql('SELEC nimporte', q).error, 'erreur de syntaxe signalée');
    assert.ok(q.tests.every(([, exp]) => exp.length > 0));
  }
  // l'ordre ne compte que si l'énoncé le demande
  const cnt = SQL_QUESTIONS.find((q) => q.id === 'sql_count');
  assert.equal(scoreRun(runSql("SELECT COUNT(*) FROM trades WHERE side='BUY'", cnt), 3), 3);
});

// Réseau simulé : l'hôte ne répond au joker qu'au joueur qui l'a demandé, et l'état diffusé ne révèle rien
{
  const { startHost } = await import('../calcul/net/host.js');
  const { INTRO_CH_MS } = await import('../calcul/engine/rules.js');
  const games = Array.from({ length: 8 }, () => {
    const sent = [], on = {};
    const bridge = { embedded: false, players: [0, 1, 2].map((id) => ({ id, name: 'P' + id, color: '#fff' })), readyMap: { 1: 'calcul', 2: 'calcul' },
      send: (to, m) => sent.push([to, JSON.parse(JSON.stringify(m))]), on: (ev, fn) => { on[ev] = fn; } };
    const host = startHost({ bridge, solo: false, settings: { mode: 'chartier', len: 10, bots: 0, code: 0, sql: 0 }, me: { id: 0, name: 'P0' }, onState() {}, onSetup() {}, onError() {} });
    return { host, sent, on };
  });
  await new Promise((r) => setTimeout(r, 50));
  for (const g of games) g.host.start();
  await new Promise((r) => setTimeout(r, INTRO_CH_MS + 300));
  const g = games.find((x) => x.host.state.phase === 'question' && fullQuestion(x.host.state).input === 'choice');
  assert.ok(g, 'une première question à choix');
  const q = fullQuestion(g.host.state);
  g.sent.length = 0;
  g.on.msg(1, { t: 'jok', kind: 'friend' });
  const jok = g.sent.filter(([, m]) => m.t === 'jok');
  assert.equal(jok.length, 1); assert.equal(jok[0][0], 1, 'la réponse du joker part au seul demandeur');
  assert.ok([q.answer, q.trap].includes(jok[0][1].suggest));
  for (const [to, m] of g.sent.filter(([, m]) => m.t === 'st')) {
    assert.equal(to, 'all');
    const txt = JSON.stringify(m.s);
    assert.ok(!/suggest|removed/.test(txt) && !('answer' in m.s.q) && !('trap' in m.s.q) && !('tests' in m.s.q), 'rien de secret dans l\'état diffusé');
  }
  g.on.msg(1, { t: 'jok', kind: 'friend' });
  assert.equal(g.sent.at(-1)[0], 1); assert.equal(g.sent.at(-1)[1].t, 'err', 'deuxième appel refusé, au seul demandeur');
  n++; console.log('✓ réseau : joker privé, rien de secret diffusé');
}

console.log(`\n${n} tests réussis`);
process.exit(0); // l'hôte garde des minuteurs (surveillance des absents)
