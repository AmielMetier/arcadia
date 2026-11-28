// Tests du moteur de Synapse : node tools/test-synapse.mjs
import assert from 'node:assert/strict';
import { createRng } from '../synapse/engine/rng.js';
import { params, startLevel, nextSaved, newAdapt, adapt, MODES } from '../synapse/engine/levels.js';
import { filterPress, judge, beatScore, calibrate } from '../synapse/engine/press.js';
import { pulseTarget, pulseSignal, figure, sideOf, ruleGap, sequence, oddOne, DOT_RULES, dotNumber } from '../synapse/engine/trials.js';
import { dayKey, prevDay, streak } from '../synapse/engine/days.js';
import { median, indicators, series, emptyMetrics } from '../synapse/engine/stats.js';
import { defaults, validate, parse, MAX_HISTORY } from '../synapse/engine/save.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };
const run = (st, oks) => oks.reduce((s, ok) => adapt(s, ok), st);
const rep = (ok, k) => Array(k).fill(ok);

t('réglages aux niveaux 1 et 10', () => {
  assert.deepEqual(params('pulse', 1), { bpm: 60, tol: 0.18, lure: 0.2 });
  const p10 = params('pulse', 10);
  assert.equal(p10.bpm, 110); assert.ok(Math.abs(p10.tol - 0.09) < 1e-9); assert.ok(Math.abs(p10.lure - 0.4) < 1e-9);
  assert.deepEqual(params('aiguillage', 1), { time: 2.5, gapMin: 5, gapMax: 7 });
  assert.equal(params('aiguillage', 10).time, 1.2); assert.equal(params('aiguillage', 10).gapMin, 2); assert.equal(params('aiguillage', 10).gapMax, 4);
  assert.equal(params('reseau', 4).size, 3); assert.equal(params('reseau', 5).size, 4);
  assert.equal(params('reseau', 1).len, 3); assert.equal(params('reseau', 10).len, 7);
  assert.equal(params('reseau', 1).node, 3); assert.equal(params('reseau', 10).flash, 0.8);
  assert.deepEqual([params('double', 1).bpm, params('double', 10).bpm], [60, 100]);
  assert.deepEqual([params('double', 1).silence, params('double', 10).silence], [2, 6]);
  assert.deepEqual([params('double', 1).life, params('double', 10).life], [3, 1.5]);
  assert.equal(params('pulse', 0).bpm, 60); assert.equal(params('pulse', 99).bpm, 110);
  assert.throws(() => params('autre', 1));
});

t('niveau de départ et niveau enregistré', () => {
  assert.equal(startLevel(1), 1); assert.equal(startLevel(5), 4); assert.equal(startLevel(10), 9);
  assert.equal(nextSaved(5, 4, 4), 5, 'partie neutre : le niveau enregistré ne baisse pas');
  assert.equal(nextSaved(5, 4, 5), 5); assert.equal(nextSaved(5, 4, 7), 7); assert.equal(nextSaved(5, 4, 3), 3);
  assert.equal(nextSaved(1, 1, 1), 1); assert.equal(nextSaved(1, 1, 2), 2);
});

t('difficulté qui s\'adapte : seuils stricts', () => {
  assert.equal(run(newAdapt(3), rep(true, 5)).level, 4, '5 sur 5 : monte');
  assert.equal(run(newAdapt(3), [...rep(true, 4), false]).level, 3, '4 sur 5 (80 %) : rien');
  const s = run(newAdapt(3), [...rep(true, 4), false]);
  assert.equal(run(s, [...rep(true, 4), false]).level, 3, '8 sur 10 : rien');
  assert.equal(run(s, [true, true, true, false, false]).level, 2, '7 sur 10 : baisse');
  assert.equal(run(newAdapt(3), rep(true, 4)).level, 3, 'pas d\'évaluation avant 5 essais');
  const nine = run(newAdapt(3), [...rep(true, 4), false, ...rep(true, 5)]);
  assert.equal(nine.level, 4, '9 sur 10 : monte');
});

t('difficulté : bornes et remise à zéro après un changement', () => {
  assert.equal(run(newAdapt(10), rep(true, 5)).level, 10);
  assert.equal(run(newAdapt(1), rep(false, 5)).level, 1);
  assert.equal(run(newAdapt(10), rep(true, 5)).win.length, 5, 'aux bornes : pas de changement, fenêtre gardée');
  const up = run(newAdapt(3), rep(true, 5));
  assert.deepEqual([up.win.length, up.n], [0, 0]);
  assert.equal(run(up, rep(true, 4)).level, 4, 'après un changement, il faut 5 nouveaux essais');
  assert.equal(run(up, rep(true, 5)).level, 5);
  assert.equal(run(newAdapt(3), rep(true, 30)).win.length, 0);
  assert.ok(run(newAdapt(1), rep(false, 3).concat(rep(true, 20))).win.length <= 10);
});

t('filtre des doubles appuis', () => {
  let last = null; const kept = [];
  for (const ms of [0, 100, 200]) { const r = filterPress(last, ms, 120); last = r.last; if (r.ok) kept.push(ms); }
  assert.deepEqual(kept, [0, 200], 'un appui ignoré ne déplace pas la référence');
  assert.equal(filterPress(0, 119, 120).ok, false); assert.equal(filterPress(0, 120, 120).ok, true);
  assert.equal(filterPress(0, 5, 0).ok, true, 'filtre à 0 : tout passe');
  assert.equal(filterPress(null, 1000, 120, true).ok, false, 'répétition automatique ignorée');
  assert.equal(filterPress(null, 0, 120).ok, true);
});

t('jugement d\'un appui', () => {
  const beats = [{ t: 1, tol: 0.1, lure: false, done: false }, { t: 2, tol: 0.1, lure: true, done: false }, { t: 3, tol: 0.1, lure: false, done: true }];
  assert.equal(judge(1.05, beats).verdict, 'hit'); assert.ok(Math.abs(judge(1.05, beats).off - 0.05) < 1e-9);
  assert.equal(judge(0.95, beats).verdict, 'hit');
  assert.equal(judge(0.85, beats).verdict, 'early'); assert.equal(judge(1.2, beats).verdict, 'late');
  assert.equal(judge(2.02, beats).verdict, 'lure');
  assert.equal(judge(3.0, beats).verdict, 'late', 'temps déjà joué : erreur');
  assert.equal(judge(1.1, beats).verdict, 'hit', 'bord de la fenêtre compris');
  assert.equal(judge(1, []).verdict, 'early');
});

t('justesse rythmique et calage', () => {
  assert.equal(beatScore(0, 1), 1); assert.equal(beatScore(0.125, 1), 0.5); assert.equal(beatScore(-0.25, 1), 0); assert.equal(beatScore(null, 1), 0);
  assert.equal(calibrate([40, 50, 60, 45, 55, 1000, 52, 48]), 51);
  assert.equal(calibrate([10, 20]), null);
  assert.equal(calibrate([900, 900, 900, 900, 900]), 300);
});

t('tirages reproductibles', () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 50; i++) assert.equal(a.next(), b.next());
  const rng = createRng(7);
  for (let i = 0; i < 300; i++) { const x = rng.range(2, 4); assert.ok(x >= 2 && x <= 4); }
});

t('Pulse : un leurre change la forme et la couleur', () => {
  const rng = createRng(1); const target = pulseTarget(rng); let lures = 0;
  for (let i = 0; i < 2000; i++) {
    const s = pulseSignal(rng, target, 0.3);
    if (s.lure) { lures++; assert.notEqual(s.shape, target.shape); assert.notEqual(s.color, target.color); }
    else assert.deepEqual([s.shape, s.color], [target.shape, target.color]);
  }
  assert.ok(lures > 500 && lures < 700, 'part de leurres ≈ 30 %');
});

t('Aiguillage : côté selon la règle', () => {
  assert.equal(sideOf({ shape: 'rond', color: 1 }, 'color'), 'right');
  assert.equal(sideOf({ shape: 'rond', color: 1 }, 'shape'), 'left');
  assert.equal(sideOf({ shape: 'carré', color: 0 }, 'shape'), 'right');
  const rng = createRng(3);
  for (let i = 0; i < 100; i++) { const g = ruleGap(rng, 5, 7); assert.ok(g >= 5 && g <= 7); const f = figure(rng); assert.ok(['rond', 'carré'].includes(f.shape)); }
});

t('Réseau : séquence et intrus', () => {
  const rng = createRng(5);
  for (let k = 0; k < 50; k++) {
    const s = sequence(rng, 9, 7);
    assert.equal(s.length, 7); s.forEach((c, i) => { assert.ok(c >= 0 && c < 9); if (i) assert.notEqual(c, s[i - 1]); });
    const o = oddOne(rng, 5);
    assert.equal(o.shapes.filter((x) => x === o.shapes[o.odd]).length, 1);
  }
});

t('Double Tempo : nombres selon la consigne', () => {
  const rng = createRng(9);
  for (const rule of DOT_RULES) {
    let yes = 0;
    for (let i = 0; i < 400; i++) { const v = dotNumber(rng, rule); assert.ok(v >= 1 && v <= 9 && v !== 5); if (rule.test(v)) yes++; }
    assert.ok(yes > 150 && yes < 250);
  }
});

t('jours locaux et série', () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(prevDay('2026-03-01'), '2026-02-28'); assert.equal(prevDay('2026-01-01'), '2025-12-31');
  assert.equal(prevDay('2026-10-26'), '2026-10-25'); assert.equal(prevDay('2026-10-25'), '2026-10-24');
  assert.equal(prevDay('2026-03-30'), '2026-03-29'); assert.equal(prevDay('2026-03-29'), '2026-03-28');
  assert.equal(prevDay('2024-03-01'), '2024-02-29');
  const days = ['2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26'];
  assert.equal(streak(days, '2026-10-26'), 4, 'à travers le changement d\'heure');
  assert.equal(streak(days, '2026-10-27'), 4, 'hier compte encore');
  assert.equal(streak(days, '2026-10-28'), 0);
  assert.equal(streak(['2026-10-20', '2026-10-26'], '2026-10-26'), 1);
  assert.equal(streak([], '2026-10-26'), 0);
});

const g = (day, mode, m) => ({ at: 1, day, mode, dur: 90, score: 10, best: 2, acc: 80, trials: 10, lv0: 1, lv1: 2, session: false, m: { ...emptyMetrics(), ...m } });

t('indicateurs et courbes', () => {
  assert.equal(median([3, 1, 2]), 2); assert.equal(median([4, 1, 2, 3]), 2.5); assert.equal(median([]), null);
  const h = [
    g('2026-11-02', 'aiguillage', { rt: [500, 700], sw: [900, 800], rep: [500, 600] }),
    g('2026-11-01', 'pulse', { lureN: 10, lureOk: 7, beatN: 4, beatSum: 3 }),
    g('2026-11-02', 'double', { rt: [600], beatN: 2, beatSum: 0 }),
    g('2026-11-02', 'pulse', { lureN: 10, lureOk: 10 }),
  ];
  assert.deepEqual(series(h, 'rt'), [{ day: '2026-11-02', v: 600 }]);
  assert.deepEqual(series(h, 'lure'), [{ day: '2026-11-01', v: 70 }, { day: '2026-11-02', v: 100 }]);
  assert.deepEqual(series(h, 'switch'), [{ day: '2026-11-02', v: 300 }]);
  assert.deepEqual(series(h, 'rhythm'), [{ day: '2026-11-01', v: 75 }, { day: '2026-11-02', v: 0 }]);
  assert.equal(indicators([g('d', 'aiguillage', { sw: [300], rep: [500] })]).switch, 0, 'minimum 0');
  assert.deepEqual(indicators([g('d', 'reseau', {})]), { rt: null, lure: null, switch: null, rhythm: null });
  assert.deepEqual(series([], 'rt'), []);
});

t('validation de l\'import', () => {
  const d = defaults(); d.history.push(g('2026-11-02', 'pulse', { rt: [1, 2] }));
  const ok = validate(JSON.parse(JSON.stringify(d)));
  assert.ok(ok.ok); assert.deepEqual(ok.data, d);
  const bad = (mut, why) => { const x = JSON.parse(JSON.stringify(d)); mut(x); const r = validate(x); assert.equal(r.ok, false, why); assert.equal(typeof r.error, 'string'); };
  bad((x) => { x.v = 2; }, 'version');
  bad((x) => { x.levels.pulse = 11; }, 'niveau hors bornes');
  bad((x) => { x.levels.pulse = 2.5; }, 'niveau non entier');
  bad((x) => { x.settings.gap = 50; }, 'filtre hors liste');
  bad((x) => { x.settings.calm = 'oui'; }, 'type');
  bad((x) => { x.history[0].mode = 'autre'; }, 'mode inconnu');
  bad((x) => { x.history[0].day = '2026-1-2'; }, 'date');
  bad((x) => { x.history[0].m.lureOk = 5; }, 'incohérent');
  bad((x) => { x.history[0].m.rt = Array(301).fill(1); }, 'trop d\'échantillons');
  bad((x) => { x.history = {}; }, 'historique');
  assert.equal(validate(null).ok, false); assert.equal(validate([]).ok, false);
  assert.equal(parse('{"v":1,"settings":{"gap":120,"calib":1e999,"calm":false},"levels":{}, "history":[]}').ok, false, 'Infinity refusé');
  assert.equal(parse('pas du json').ok, false); assert.equal(parse('x'.repeat(2_000_001)).ok, false);
  const big = defaults(); for (let i = 0; i < MAX_HISTORY + 50; i++) big.history.push(g('2026-11-02', 'reseau', {}));
  assert.equal(validate(big).data.history.length, MAX_HISTORY, 'historique plafonné');
  const extra = JSON.parse(JSON.stringify(d)); extra.intrus = 1; extra.history[0].intrus = 2;
  const r = validate(extra); assert.ok(r.ok); assert.equal('intrus' in r.data, false); assert.equal('intrus' in r.data.history[0], false);
  assert.ok(MODES.every((m) => d.levels[m] === 1));
});

console.log(`\n${n} tests passés.`);
