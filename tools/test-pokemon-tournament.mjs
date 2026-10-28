// tools/test-pokemon-tournament.mjs
// Test du tournoi de Poké Duel : draft, arbre, exemptions, forfaits, finale au meilleur des 3, classement.
// node tools/test-pokemon-tournament.mjs

import {
  createTournament, makeOffers, autoDraft, submitDraft, draftComplete, closeDraft,
  nextPlayableMatch, openPreview, setReady, buildBattle, simulateBattle, recordGame,
  resolveAutomatic, markGone, isOver, getParticipant, allMatches, tournamentMvp, OFFER_SIZE,
} from '../pokemon/engine/tournament.js';

let seed = 12345;
const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);

const ok = (cond, msg) => { if (!cond) throw new Error('ÉCHEC : ' + msg); };
const humans = (n) => Array.from({ length: n }, (_, i) => ({ id: i + 1, name: `J${i + 1}`, color: '#123456' }));

// Joue un tournoi entier : les humains draftent automatiquement, tous les matchs sont simulés
function playOut(t, leaveAt = null) {
  for (const p of t.participants) if (!p.bot) ok(submitDraft(t, p.id, autoDraft(p.offer)), 'draft refusé');
  ok(draftComplete(t), 'draft incomplet');
  closeDraft(t);
  let guard = 0;
  while (!isOver(t) && guard++ < 40) {
    const m = nextPlayableMatch(t);
    ok(m, 'aucun match jouable alors que le tournoi continue');
    openPreview(t, m);
    if (leaveAt && guard === leaveAt.step) {
      markGone(t, leaveAt.id);
      resolveAutomatic(t);
      continue;
    }
    setReady(t, 'A', 0);
    setReady(t, 'B', 2);
    const battle = buildBattle(t, m);
    ok(battle.teamA[0].id === getParticipant(t, m.a).team[0], 'Pokémon de tête A mal placé');
    ok(battle.teamB[0].id === getParticipant(t, m.b).team[2], 'Pokémon de tête B mal placé');
    const { credits } = simulateBattle(battle);
    recordGame(t, m, battle, credits);
    resolveAutomatic(t);
  }
  ok(isOver(t), 'tournoi non terminé');
  return t;
}

console.log('--- Offres de draft ---');
for (const gen of ['all', 'kanto', 'hoenn']) {
  const offers = makeOffers(8, gen, rng);
  for (const o of offers) {
    ok(o.length === OFFER_SIZE, `offre de ${o.length} Pokémon (${gen})`);
    ok(new Set(o).size === OFFER_SIZE, 'doublon dans une offre');
  }
}
console.log('✓ 8 offres de 6 Pokémon distincts pour chaque génération');

console.log('--- Tailles d\'arbre ---');
const cases = [
  [1, 1, 4, 3], [1, 0, 2, 1], [2, 1, 4, 2], [2, 0, 2, 0], [3, 1, 4, 1], [3, 0, 4, 0],
  [4, 1, 4, 0], [5, 1, 8, 3], [6, 1, 8, 2], [6, 0, 8, 0],
];
for (const [n, bots, size, nbBots] of cases) {
  const t = createTournament(humans(n), { bots, rng });
  ok(t.size === size, `${n} humains bots=${bots} : arbre de ${t.size} au lieu de ${size}`);
  ok(t.participants.filter((p) => p.bot).length === nbBots, `${n} humains : ${nbBots} bots attendus`);
  // Pas de bot contre bot au premier tour tant qu'il y a des humains à placer
  if (n >= t.size / 2) {
    ok(t.rounds[0].every((m) => [m.a, m.b].some((id) => id != null && !getParticipant(t, id).bot)), 'match bot contre bot évitable');
  }
  playOut(t);
  const finale = t.rounds.at(-1)[0];
  ok(finale.status === 'done' && finale.winner === t.champion, 'finale incohérente');
  ok(t.standings[0].place === 1 && String(t.standings[0].id) === String(t.champion), 'classement incohérent');
}
console.log('✓ 10 configurations jouées jusqu\'au champion (exemptions et bots compris)');

console.log('--- Finale au meilleur des 3 ---');
{
  const t = playOut(createTournament(humans(2), { bots: 0, rng }));
  const f = t.rounds.at(-1)[0];
  ok(f.bestOf === 3, 'la finale doit se jouer en 3 manches');
  ok(Math.max(f.scoreA, f.scoreB) === 2, `finale gagnée ${f.scoreA}-${f.scoreB}`);
  const t1 = playOut(createTournament(humans(2), { bots: 0, finalBestOf: 1, rng }));
  ok(Math.max(t1.rounds.at(-1)[0].scoreA, t1.rounds.at(-1)[0].scoreB) === 1, 'finale en une manche');
  console.log(`✓ Finale ${f.scoreA}-${f.scoreB}, réglage « une manche » respecté`);
}

console.log('--- Forfait ---');
{
  const t2 = createTournament(humans(4), { bots: 0, rng });
  for (const p of t2.participants) submitDraft(t2, p.id, autoDraft(p.offer));
  closeDraft(t2);
  const m = nextPlayableMatch(t2);
  openPreview(t2, m);
  const leaver = m.a;
  markGone(t2, leaver);
  ok(m.status === 'done' && String(m.winner) === String(m.b), 'le partant doit perdre par forfait');
  ok(m.how === 'forfeit', 'match non marqué forfait');
  resolveAutomatic(t2);
  ok(nextPlayableMatch(t2) && !allMatches(t2).some((x) => x.status !== 'done' && (x.a === leaver || x.b === leaver)), 'le partant rejoue');
  console.log('✓ Un dresseur qui quitte perd par forfait et ne réapparaît plus');
}

console.log('--- Draft invalide ---');
{
  const t = createTournament(humans(2), { rng });
  const p = t.participants.find((x) => !x.bot);
  ok(!submitDraft(t, p.id, [p.offer[0], p.offer[0], p.offer[1]]), 'doublon accepté');
  ok(!submitDraft(t, p.id, [p.offer[0], p.offer[1]]), 'équipe de 2 acceptée');
  ok(!submitDraft(t, p.id, [p.offer[0], p.offer[1], 9999]), 'Pokémon hors offre accepté');
  ok(submitDraft(t, p.id, p.offer.slice(0, 3)), 'draft valide refusé');
  console.log('✓ Sélections invalides refusées');
}

console.log('--- Statistiques ---');
{
  const t = playOut(createTournament(humans(5), { rng }));
  const mvp = tournamentMvp(t);
  ok(mvp && mvp.ko > 0, 'aucun Pokémon décisif');
  const totalKo = t.participants.reduce((n, p) => n + p.stats.ko, 0);
  const totalLost = t.participants.reduce((n, p) => n + p.stats.lost, 0);
  ok(totalKo <= totalLost && totalKo > 0, `K.O. (${totalKo}) et pertes (${totalLost}) incohérents`);
  ok(JSON.parse(JSON.stringify(t)).rounds.length === t.rounds.length, 'état non sérialisable');
  console.log(`✓ ${totalKo} K.O. attribués, Pokémon décisif : n°${mvp.dex} (${mvp.ko} K.O.)`);
}

console.log('\nTOURNOI POKÉ DUEL : TOUS LES TESTS SONT AU VERT');
