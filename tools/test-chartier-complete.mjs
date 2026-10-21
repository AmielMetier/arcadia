// tools/test-chartier-complete.mjs
// Test complet de l'intégration du mode Pierre Chartier "The Candidate"

import { CHARTIER_QUESTIONS, getQuestionsByLevel } from '../calcul/engine/chartier-data.js';
import { makeQuestion, publicQuestion, planCats, CATS, THEMES } from '../calcul/engine/questions.js';
import { createGame, nextQuestion, answer, reveal, checkChartier, MODES } from '../calcul/engine/rules.js';
import { botAnswer } from '../calcul/engine/bot.js';

console.log('--- 1. Vérification du jeu de données (300 questions) ---');
if (CHARTIER_QUESTIONS.length !== 300) {
  throw new Error(`Attendu 300 questions, reçu ${CHARTIER_QUESTIONS.length}`);
}

const facile = getQuestionsByLevel('facile');
const normal = getQuestionsByLevel('normal');
const expert = getQuestionsByLevel('expert');

console.log(`Facile : ${facile.length} questions (IDs ${facile[0].id} à ${facile[facile.length - 1].id})`);
console.log(`Normal : ${normal.length} questions (IDs ${normal[0].id} à ${normal[normal.length - 1].id})`);
console.log(`Expert : ${expert.length} questions (IDs ${expert[0].id} à ${expert[expert.length - 1].id})`);

if (facile.length !== 100 || normal.length !== 100 || expert.length !== 100) {
  throw new Error('Chaque niveau doit comporter exactement 100 questions');
}

// Vérification de chaque question
for (const q of CHARTIER_QUESTIONS) {
  if (!q.text || !q.cleanAns || !q.choices || q.choices.length !== 4) {
    throw new Error(`Question ${q.id} invalide : ${JSON.stringify(q)}`);
  }
  if (!q.choices.includes(q.correctChoice)) {
    throw new Error(`Question ${q.id} : correctChoice non présent dans les choices!`);
  }
}
console.log('✓ Les 300 questions possèdent 4 choix et un choix correct valide.');

console.log('\n--- 2. Vérification de la validation checkChartier ---');
const qSample = CHARTIER_QUESTIONS[0]; // Q1: CAC 40
console.log('Sample Q:', qSample.text);

// Test clic direct sur le bon choix
const resDirect = checkChartier(qSample, qSample.correctChoice);
if (!resDirect.ok) throw new Error('Échec clic direct bon choix');

// Test numéro 1-4
const correctIdx = qSample.choices.indexOf(qSample.correctChoice) + 1;
const resNum = checkChartier(qSample, String(correctIdx));
if (!resNum.ok) throw new Error(`Échec raccourci numérique ${correctIdx}`);

// Test lettre A-D
const correctLetter = ['a', 'b', 'c', 'd'][correctIdx - 1];
const resLetter = checkChartier(qSample, correctLetter);
if (!resLetter.ok) throw new Error(`Échec raccourci lettre ${correctLetter}`);

// Test alias textuel
const resAlias = checkChartier(qSample, 'cotation assistee en continu');
if (!resAlias.ok) throw new Error('Échec alias textuel');

// Test mauvaise réponse
const wrongChoice = qSample.choices.find(c => c !== qSample.correctChoice);
const resWrong = checkChartier(qSample, wrongChoice);
if (resWrong.ok) throw new Error('Mauvaise réponse acceptée !');

console.log('✓ Validation checkChartier fonctionne sur clics, chiffres, lettres et aliases.');

console.log('\n--- 3. Simulation d\'une partie complète The Candidate avec 3 bots ---');
const players = [
  { id: 1, name: 'Candidat Humain', color: '#ff4b2b' },
  { id: 101, name: 'Alexandre (M&A Lazard)', color: '#2b8cff', bot: true },
  { id: 102, name: 'Clara (Quant Citadel)', color: '#2fbf71', bot: true },
  { id: 103, name: 'Julien (Ex-McKinsey)', color: '#ffd27a', bot: true }
];

const cfg = {
  mode: 'chartier',
  theme: 'chartier',
  len: 15,
  diff: 'expert',
  finale: true
};

let now = Date.now();
let state = createGame({ players, cfg, seed: 424242, now });

console.log(`Partie initialisée : Mode = ${state.cfg.mode}, Thème = ${state.cfg.theme}, Diff = ${state.cfg.diff}`);
console.log(`Catégories prévues : ${state.cats.join(', ')}`);

for (let round = 0; round < cfg.len; round++) {
  state = nextQuestion(state, now);
  const q = state.q;
  if (!q.isChartier || !q.choices) {
    throw new Error(`La question ${round + 1} n'est pas configurée en mode Chartier !`);
  }

  // Humain répond (parfois bon choix, parfois raccourci)
  if (round % 2 === 0) {
    const res = answer(state, { by: 1, raw: q.choices[0], idx: state.idx, now: now + 2500 });
    if (res.ok) state = res.state;
  } else {
    const res = answer(state, { by: 1, raw: 'B', idx: state.idx, now: now + 3200 });
    if (res.ok) state = res.state;
  }

  // Bots répondent via botAnswer
  for (const bot of players.filter(p => p.bot)) {
    const fullQ = makeQuestion(state.seed, state.idx, state.cats[state.idx], state.cfg.diff);
    const bAns = botAnswer(fullQ, 'expert');
    if (bAns) {
      const bRes = answer(state, { by: bot.id, raw: bAns.raw, idx: state.idx, now: now + bAns.delay });
      if (bRes.ok) state = bRes.state;
    }
  }

  now += (q.time + 1) * 1000;
  state = reveal(state, now);
  now += 5000;
}

// Dernière question passée -> passage à over
state = nextQuestion(state, now);
if (state.phase !== 'over') {
  throw new Error(`La partie devrait être terminée, reçue phase : ${state.phase}`);
}

console.log('\n✓ Partie terminée avec succès !');
console.log('Classement final The Candidate :');
state.ranking.forEach((id, rank) => {
  const p = state.players.find(x => x.id === id);
  console.log(`  ${rank + 1}e: ${p.name} - ${p.score} pts (${p.right}/${cfg.len} justes)`);
});

console.log('\nTOUS LES TESTS SONT AU VERT !');
