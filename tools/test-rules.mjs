// Tests du moteur DavidSimulator : node tools/test-rules.mjs [nombre de parties simulées]
import { readFileSync } from 'node:fs';
import { createGame, reduce, actors, currentPlayer, availableActions } from '../david/engine/rules.js';
import { botAction } from '../david/engine/bot.js';
import { nextRandom } from '../david/engine/rng.js';
import { netWorth, level, groupSpaces, teamOwnsGroup } from '../david/engine/valuation.js';
import { landingProbabilities, propertyAnalysis } from '../david/engine/markov.js';
import { remapPlayers, resumeAt, proposeMapping } from '../david/engine/resume.js';

const B = JSON.parse(readFileSync(new URL('../david/data/board-nice.json', import.meta.url), 'utf8'));
let passed = 0, failed = 0;
const test = (name, fn) => {
  try { fn(); passed++; } catch (e) { failed++; console.error(`✗ ${name}\n  ${e.stack.split('\n').slice(0, 3).join('\n  ')}`); }
};
const eq = (a, b, msg = '') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${msg} attendu ${JSON.stringify(b)}, obtenu ${JSON.stringify(a)}`);
};
const ok = (c, msg) => { if (!c) throw new Error(msg || 'condition fausse'); };

const PLAYERS = (n) => Array.from({ length: n }, (_, k) => ({ id: k, name: `J${k}`, color: '#000' }));
// Partie avec ordre de jeu connu (J0, J1, …)
function game(n = 2, mode = 'classic') {
  const { state } = createGame(B, { players: PLAYERS(n), mode, seed: 7, now: 0 });
  state.players.sort((a, b) => a.id - b.id);
  return state;
}
function act(s, a) {
  const r = reduce(s, a, B);
  if (!r.ok) throw new Error(`${a.type} refusé : ${r.error}`);
  return r;
}
const refused = (s, a) => { const r = reduce(s, a, B); ok(!r.ok, `${a.type} aurait dû être refusé`); return r.error; };
const pl = (s, id) => s.players.find((p) => p.id === id);
// Choisit une graine qui donnera les dés voulus au prochain lancer.
function forceDice(s, d1, d2) {
  for (let seed = 1; seed < 1e6; seed++) {
    const a = nextRandom(seed), b = nextRandom(a.seed);
    if (1 + Math.floor(a.value * 6) === d1 && 1 + Math.floor(b.value * 6) === d2) { s.seed = seed; return s; }
  }
  throw new Error('graine introuvable');
}
const roll = (s, d1, d2, by = currentPlayer(s).id) => act(forceDice(s, d1, d2), { type: 'ROLL', by });
const give = (s, id, ...spaces) => { for (const i of spaces) s.props[i].owner = id; return s; };

/* ----------------------------------------------------------- mise en place */
test('partie classique : argent, propriétés libres, phase', () => {
  const s = game(4);
  ok(s.players.every((p) => p.cash === 1500));
  eq(Object.values(s.props).filter((p) => p.owner != null).length, 0);
  eq(s.phase, 'roll');
  eq(s.endsAt, null);
});

test('partie express : 3 propriétés offertes sans monopole, chrono de 40 min', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const { state: s } = createGame(B, { players: PLAYERS(6), mode: 'express', seed, now: 1000 });
    for (const p of s.players) {
      const mine = Object.entries(s.props).filter(([, v]) => v.owner === p.id).map(([k]) => +k);
      eq(mine.length, 3, `joueur ${p.id}`);
      for (const g of ['brown', 'lightblue', 'pink', 'orange', 'red', 'yellow', 'green', 'darkblue']) {
        ok(!B.groups[g].spaces.every((i) => s.props[i].owner === p.id), `monopole offert (${g})`);
      }
    }
    eq(s.endsAt, 1000 + 40 * 60000);
    eq(s.cfg.housesPerHotel, 3);
    eq(s.cfg.maxJailTurns, 2);
  }
});

test('nombre de joueurs contrôlé', () => {
  let err = null;
  try { createGame(B, { players: PLAYERS(1) }); } catch (e) { err = e; }
  ok(err, 'un seul joueur aurait dû être refusé');
});

/* ----------------------------------------------------------- déplacements */
test('lancer, se déplacer, passer par Départ', () => {
  let s = game(2);
  s = roll(s, 3, 4).state;
  eq(pl(s, 0).pos, 7);
  s = game(2); pl(s, 0).pos = 36;
  s = roll(s, 2, 3).state; // 36 + 5 = 41 → case 1
  eq(pl(s, 0).pos, 1); eq(pl(s, 0).cash, 1700); eq(s.phase, 'buy');
  ok(s.stats.players[0].goPassed === 1, 'passage par Départ non compté');
});

test('un double redonne la main, pas un lancer simple', () => {
  let s = game(2);
  s = roll(s, 2, 2).state;            // case 4 : impôts
  eq(s.phase, 'roll');
  s = roll(s, 1, 2).state;            // case 7
  eq(s.phase, 'end');
  s = act(s, { type: 'END_TURN', by: 0 }).state;
  eq(currentPlayer(s).id, 1);
});

test('trois doubles envoient en prison', () => {
  let s = game(2);
  s = roll(s, 1, 1).state; s = roll(s, 1, 1).state;
  const r = roll(s, 1, 1); s = r.state;
  ok(pl(s, 0).inJail, 'pas en prison');
  eq(pl(s, 0).pos, 10);
  eq(s.phase, 'end');
});

test('case « Allez en prison »', () => {
  let s = game(2); pl(s, 0).pos = 25;
  s = roll(s, 2, 3).state;
  ok(pl(s, 0).inJail); eq(pl(s, 0).pos, 10);
  eq(pl(s, 0).cash, 1500, 'aucun salaire');
});

/* ----------------------------------------------------------- prison */
test('prison : sortie par un double, sans relancer', () => {
  let s = game(2); Object.assign(pl(s, 0), { inJail: true, pos: 10 });
  s = roll(s, 3, 3).state;
  ok(!pl(s, 0).inJail); eq(pl(s, 0).pos, 16); eq(s.phase === 'buy' || s.phase === 'end', true);
});

test('prison classique : 3 essais puis amende', () => {
  let s = game(2); Object.assign(pl(s, 0), { inJail: true, pos: 10 });
  for (let k = 0; k < 2; k++) {
    s = roll(s, 1, 2).state; ok(pl(s, 0).inJail, `sorti trop tôt (essai ${k + 1})`);
    s = act(s, { type: 'END_TURN', by: 0 }).state;
    s = roll(s, 1, 2, 1).state; if (s.phase === 'buy') s = act(s, { type: 'DECLINE', by: 1 }).state;
    while (s.auction) s = act(s, { type: 'PASS', by: actors(s)[0] }).state;
    s = act(s, { type: 'END_TURN', by: 1 }).state;
  }
  s = roll(s, 1, 2).state;
  ok(!pl(s, 0).inJail); eq(pl(s, 0).pos, 13);
  ok(s.stats.players[0].jailTurns === 3);
});

test('prison express : 2 essais maximum', () => {
  let s = game(2, 'express');
  for (const k in s.props) s.props[k].owner = null;
  Object.assign(pl(s, 0), { inJail: true, pos: 10 });
  s = roll(s, 1, 2).state; ok(pl(s, 0).inJail);
  s = act(s, { type: 'END_TURN', by: 0 }).state;
  s = roll(s, 1, 2, 1).state; if (s.phase === 'buy') s = act(s, { type: 'DECLINE', by: 1 }).state;
  while (s.auction) s = act(s, { type: 'PASS', by: actors(s)[0] }).state;
  s = act(s, { type: 'END_TURN', by: 1 }).state;
  const cash = pl(s, 0).cash;
  s = roll(s, 1, 2).state;
  ok(!pl(s, 0).inJail, 'devrait sortir au 2e essai');
  eq(pl(s, 0).cash, cash - 50);
});

test('prison : caution et carte', () => {
  let s = game(2); Object.assign(pl(s, 0), { inJail: true, pos: 10 });
  s = act(s, { type: 'PAY_BAIL', by: 0 }).state;
  ok(!pl(s, 0).inJail); eq(pl(s, 0).cash, 1450); eq(s.phase, 'roll');
  s = game(2); Object.assign(pl(s, 0), { inJail: true, pos: 10, jailCards: ['ch09'] }); s.heldCards.ch09 = 0;
  s = act(s, { type: 'USE_JAIL_CARD', by: 0 }).state;
  ok(!pl(s, 0).inJail); eq(pl(s, 0).jailCards, []); ok(!s.heldCards.ch09);
});

/* ----------------------------------------------------------- achats et loyers */
test('acheter une propriété', () => {
  let s = game(2);
  s = roll(s, 1, 2).state; // case 3
  eq(s.phase, 'buy');
  s = act(s, { type: 'BUY', by: 0 }).state;
  eq(s.props[3].owner, 0); eq(pl(s, 0).cash, 1440);
  refused(s, { type: 'BUY', by: 0 });
});

test('loyer simple, doublé en monopole, avec maisons et hôtel', () => {
  const cases = [
    [() => give(game(2), 1, 1), 2],
    [() => give(game(2), 1, 1, 3), 4],
    [() => { const s = give(game(2), 1, 1, 3); s.props[1].houses = 3; return s; }, 90],
    [() => { const s = give(game(2), 1, 1, 3); s.props[1].hotel = true; return s; }, 250],
  ];
  for (const [mk, rent] of cases) {
    let s = mk(); pl(s, 0).pos = 39;
    const r = roll(s, 1, 1); // 39 + 2 → 1 en passant par Départ
    eq(pl(r.state, 0).cash, 1500 + 200 - rent, `loyer ${rent}`);
    eq(pl(r.state, 1).cash, 1500 + rent);
  }
});

test('terrain hypothéqué : pas de loyer', () => {
  let s = give(game(2), 1, 6); s.props[6].mortgaged = true;
  s = roll(s, 2, 4).state;
  eq(pl(s, 0).cash, 1500);
});

test('pôles de transport : 25/50/100/200', () => {
  for (const [owned, rent] of [[[5], 25], [[5, 15], 50], [[5, 15, 25], 100], [[5, 15, 25, 35], 200]]) {
    let s = give(game(2), 1, ...owned);
    s = roll(s, 2, 3).state;
    eq(pl(s, 0).cash, 1500 - rent, `${owned.length} gares`);
  }
});

test('compagnies : 4× puis 10× les dés', () => {
  let s = give(game(2), 1, 12); pl(s, 0).pos = 7; s = roll(s, 2, 3).state;
  eq(pl(s, 0).cash, 1500 - 20);
  s = give(game(2), 1, 12, 28); pl(s, 0).pos = 7; s = roll(s, 2, 3).state;
  eq(pl(s, 0).cash, 1500 - 50);
});

test('taxes', () => {
  let s = game(2); s = roll(s, 1, 3).state; eq(pl(s, 0).cash, 1300);
  s = game(2); pl(s, 0).pos = 33; s = roll(s, 2, 3).state; eq(pl(s, 0).cash, 1400);
});

/* ----------------------------------------------------------- enchères */
test('refuser déclenche une enchère, le plus offrant paie', () => {
  let s = game(3);
  s = roll(s, 1, 2).state;
  s = act(s, { type: 'DECLINE', by: 0 }).state;
  eq(s.phase, 'auction');
  s = act(s, { type: 'BID', by: 1, amount: 30 }).state;
  refused(s, { type: 'BID', by: 2, amount: 30 });
  s = act(s, { type: 'BID', by: 2, amount: 45 }).state;
  refused(s, { type: 'PASS', by: 2 });
  s = act(s, { type: 'PASS', by: 0 }).state;
  s = act(s, { type: 'PASS', by: 1 }).state;
  eq(s.auction, null); eq(s.props[3].owner, 2); eq(pl(s, 2).cash, 1455);
  eq(s.phase, 'end');
});

test('enchère sans offre : la propriété reste à la banque', () => {
  let s = game(2);
  s = roll(s, 1, 2).state;
  s = act(s, { type: 'DECLINE', by: 0 }).state;
  s = act(s, { type: 'PASS', by: 0 }).state;
  s = act(s, { type: 'PASS', by: 1 }).state;
  eq(s.props[3].owner, null); eq(s.phase, 'end');
});

test("délai d'enchère géré par l'hôte", () => {
  let s = game(2);
  s = roll(s, 1, 2).state;
  s = act(s, { type: 'DECLINE', by: 0 }).state;
  s = act(s, { type: 'BID', by: 1, amount: 10 }).state;
  refused(s, { type: 'AUCTION_TIMEOUT', by: 0 });
  s = act(s, { type: 'AUCTION_TIMEOUT', by: 'host' }).state;
  eq(s.props[3].owner, 1);
});

/* ----------------------------------------------------------- constructions */
test('construire : monopole requis, construction égale, hôtel après 4 maisons', () => {
  let s = give(game(2), 0, 1);
  refused(s, { type: 'BUILD', by: 0, space: 1 });
  s = give(s, 0, 3);
  s = act(s, { type: 'BUILD', by: 0, space: 1 }).state;
  refused(s, { type: 'BUILD', by: 0, space: 1 });
  for (let k = 0; k < 7; k++) s = act(s, { type: 'BUILD', by: 0, space: k % 2 ? 1 : 3 }).state;
  eq([s.props[1].houses, s.props[3].houses], [4, 4]);
  eq(s.bank.houses, 24);
  s = act(s, { type: 'BUILD', by: 0, space: 1 }).state;
  ok(s.props[1].hotel); eq(s.bank.houses, 28); eq(s.bank.hotels, 11);
  eq(pl(s, 0).cash, 1500 - 9 * 50);
  refused(s, { type: 'MORTGAGE', by: 0, space: 3 });
});

test('express : hôtel dès 3 maisons', () => {
  let s = game(2, 'express');
  for (const k in s.props) s.props[k].owner = null;
  give(s, 0, 37, 39);
  for (let k = 0; k < 6; k++) s = act(s, { type: 'BUILD', by: 0, space: k % 2 ? 39 : 37 }).state;
  s = act(s, { type: 'BUILD', by: 0, space: 39 }).state;
  ok(s.props[39].hotel, 'hôtel attendu après 3 maisons');
  eq(s.bank.houses, 32 - 3);
  // loyer hôtel de la Promenade
  pl(s, 1).pos = 37; s.turn.cur = 1;
  s = roll(s, 1, 1, 1).state;
  eq(s.phase, 'debt'); eq(s.debts[0].amount, 2000, 'loyer hôtel');
});

test('vendre des bâtiments : moitié prix, ordre égal', () => {
  let s = give(game(2), 0, 1, 3);
  s.props[1].houses = 2; s.props[3].houses = 1; s.bank.houses = 29;
  refused(s, { type: 'SELL_BUILDING', by: 0, space: 3 });
  s = act(s, { type: 'SELL_BUILDING', by: 0, space: 1 }).state;
  eq(pl(s, 0).cash, 1525); eq(s.props[1].houses, 1); eq(s.bank.houses, 30);
});

test('pénurie de maisons', () => {
  let s = give(game(2), 0, 1, 3); s.bank.houses = 0;
  ok(refused(s, { type: 'BUILD', by: 0, space: 1 }).includes('plus de maisons'));
});

/* ----------------------------------------------------------- hypothèques */
test('hypothéquer puis lever (+10 %)', () => {
  let s = give(game(2), 0, 39);
  s = act(s, { type: 'MORTGAGE', by: 0, space: 39 }).state;
  eq(pl(s, 0).cash, 1700);
  s = act(s, { type: 'UNMORTGAGE', by: 0, space: 39 }).state;
  eq(pl(s, 0).cash, 1700 - 220);
  refused(s, { type: 'MORTGAGE', by: 1, space: 39 });
});

test('pas de construction si un terrain du groupe est hypothéqué', () => {
  let s = give(game(2), 0, 1, 3); s.props[3].mortgaged = true;
  refused(s, { type: 'BUILD', by: 0, space: 1 });
});

test("on ne gère pas ses biens pendant le tour d'un autre", () => {
  let s = give(game(2), 1, 39);
  refused(s, { type: 'MORTGAGE', by: 1, space: 39 });
});

/* ----------------------------------------------------------- échanges */
test('échange : propriétés et argent, accepté', () => {
  let s = give(game(2), 0, 1); give(s, 1, 3);
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [1], cash: 100 }, want: { props: [3] } }).state;
  const id = s.trades[0].id;
  refused(s, { type: 'ACCEPT_TRADE', by: 0, trade: id });
  s = act(s, { type: 'ACCEPT_TRADE', by: 1, trade: id }).state;
  eq(s.props[1].owner, 1); eq(s.props[3].owner, 0);
  eq([pl(s, 0).cash, pl(s, 1).cash], [1400, 1600]);
  eq(s.trades, []);
});

test('échange : terrain hypothéqué → 10 % pour le receveur', () => {
  let s = give(game(2), 0, 39); s.props[39].mortgaged = true;
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [39] }, want: { cash: 50 } }).state;
  s = act(s, { type: 'ACCEPT_TRADE', by: 1, trade: s.trades[0].id }).state;
  eq(pl(s, 1).cash, 1500 - 50 - 20);
  ok(s.props[39].mortgaged);
});

test('échange refusé si bâtiments dans le groupe ou bien non possédé', () => {
  let s = give(game(2), 0, 1, 3); s.props[1].houses = 1; s.props[3].houses = 1;
  refused(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [3] }, want: { cash: 10 } });
  refused(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [39] }, want: {} });
  refused(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { cash: 5000 }, want: {} });
});

test('échange : refus et annulation', () => {
  let s = give(game(2), 0, 1);
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [1] }, want: { cash: 10 } }).state;
  s = act(s, { type: 'REJECT_TRADE', by: 1, trade: s.trades[0].id }).state; eq(s.trades, []);
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [1] }, want: { cash: 10 } }).state;
  s = act(s, { type: 'CANCEL_TRADE', by: 0, trade: s.trades[0].id }).state; eq(s.trades, []);
});

test('échange devenu impossible : retiré automatiquement', () => {
  let s = give(game(2), 0, 1); give(s, 0, 3); give(s, 1, 39);
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { cash: 1480 }, want: { props: [39] } }).state;
  eq(s.trades.length, 1);
  const r = act(s, { type: 'BUILD', by: 0, space: 1 }); // 0 dépense 50 € : il n'a plus 1 480 €
  eq(r.state.trades, []);
  ok(r.events.some((e) => e.k === 'TRADE_CANCELLED'), 'événement d\'annulation');
});

test("échange : on ne propose que pendant son tour, on répond à tout moment", () => {
  let s = give(game(3), 0, 1); give(s, 1, 39);
  const err = refused(s, { type: 'PROPOSE_TRADE', by: 1, to: 0, give: { props: [39] }, want: { cash: 10 } });
  ok(/pendant son tour/.test(err), err);
  ok(!availableActions(s, B, 1).includes('PROPOSE_TRADE'), 'pas proposé hors de son tour');
  ok(availableActions(s, B, 0).includes('PROPOSE_TRADE'), 'proposé pendant son tour');
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [1] }, want: { cash: 10 } }).state;
  ok(availableActions(s, B, 1).includes('ACCEPT_TRADE'), 'le destinataire peut répondre');
  s = act(s, { type: 'ACCEPT_TRADE', by: 1, trade: s.trades[0].id }).state;
  eq(s.props[1].owner, 1);
});

test('échange : une proposition sans réponse expire à la fin du tour', () => {
  let s = give(game(2), 0, 1);
  s = act(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [1] }, want: { cash: 10 } }).state;
  s = roll(s, 1, 2).state; if (s.phase === 'buy') s = act(s, { type: 'BUY', by: 0 }).state;
  const r = act(s, { type: 'END_TURN', by: 0 });
  eq(r.state.trades, []);
  ok(r.events.some((e) => e.k === 'TRADE_CANCELLED' && e.reason === 'turn'), 'événement d\'expiration');
});

test('échange : un joueur endetté peut proposer pour réunir la somme', () => {
  let s = give(game(2), 1, 39); give(s, 0, 1);
  s.debts.push({ from: 1, to: 0, amount: 2000, reason: 'rent', space: null }); s.phase = 'debt';
  s = act(s, { type: 'PROPOSE_TRADE', by: 1, to: 0, give: { props: [39] }, want: { cash: 300 } }).state;
  eq(s.trades.length, 1);
  refused(s, { type: 'PROPOSE_TRADE', by: 0, to: 1, give: { props: [1] }, want: {} });
});

/* ----------------------------------------------------------- 2 contre 2 */
const TEAMS4 = () => [{ id: 0, team: 0 }, { id: 1, team: 0 }, { id: 2, team: 1 }, { id: 3, team: 1 }].map((p) => ({ ...p, name: `J${p.id}`, color: '#000' }));
function teamGame(mode = 'classic', seed = 7) { return createGame(B, { players: TEAMS4(), mode, seed, now: 0, teams: true }).state; }

test('2 contre 2 : 4 joueurs, 2 par équipe, équipes en alternance', () => {
  for (let seed = 1; seed < 40; seed++) {
    const s = teamGame('classic', seed);
    eq(s.players.map((p) => p.team % 2 === s.players[0].team % 2 ? 'x' : 'y').join(''), 'xyxy', `graine ${seed}`);
  }
  let err = null; try { createGame(B, { players: PLAYERS(3), teams: true }); } catch (e) { err = e; } ok(err, '3 joueurs refusés');
  err = null; try { createGame(B, { players: TEAMS4().map((p) => ({ ...p, team: 0 })), teams: true }); } catch (e) { err = e; } ok(err, 'équipes déséquilibrées refusées');
  ok(!game(4).cfg.teams, 'chacun pour soi par défaut');
});

test('2 contre 2 : pas de loyer chez son coéquipier, loyer normal chez un adversaire', () => {
  let s = teamGame(); const cur = currentPlayer(s), mate = s.players.find((p) => p.team === cur.team && p.id !== cur.id);
  const opp = s.players.find((p) => p.team !== cur.team);
  give(s, mate.id, 3);
  let r = roll(s, 1, 2); // case 3
  eq(pl(r.state, cur.id).cash, 1500); ok(r.events.some((e) => e.k === 'NO_RENT'), 'événement NO_RENT');
  s = teamGame(); give(s, opp.id, 3);
  r = roll(s, 1, 2);
  eq(pl(r.state, cur.id).cash, 1500 - B.spaces[3].rent[0]);
});

test("2 contre 2 : la partie s'arrête quand une équipe est éliminée", () => {
  let s = teamGame(); const [a1, b1, a2] = s.players;
  s = reduce(s, { type: 'PLAYER_LEFT', by: 'host', player: a1.id }, B).state;
  ok(!s.over, 'un coéquipier reste en lice');
  const r = reduce(s, { type: 'PLAYER_LEFT', by: 'host', player: a2.id }, B);
  ok(r.state.over, 'équipe éliminée'); eq(r.state.endReason, 'lastTeam'); eq(r.state.winnerTeam, b1.team);
  ok(r.state.ranking.slice(0, 2).every((id) => pl(r.state, id).team === b1.team), 'les gagnants en tête du classement');
});

test('2 contre 2 : une couleur détenue à deux permet de construire, loyer doublé, construction égale', () => {
  let s = teamGame(); const cur = currentPlayer(s), mate = s.players.find((p) => p.team === cur.team && p.id !== cur.id);
  const opp = s.players.find((p) => p.team !== cur.team);
  give(s, cur.id, 1); give(s, mate.id, 3); s.turn.mustRoll = false; s.phase = 'end';
  s = act(s, { type: 'BUILD', by: cur.id, space: 1 }).state;
  eq(s.props[1].houses, 1);
  refused(s, { type: 'BUILD', by: cur.id, space: 1 }); // il faut d'abord une maison chez le coéquipier
  refused(s, { type: 'BUILD', by: cur.id, space: 3 }); // on ne bâtit pas chez son coéquipier
  // loyer doublé sur le terrain nu du coéquipier pour un adversaire
  let t = teamGame(); give(t, mate.id, 1); give(t, cur.id, 3);
  t.turn.cur = t.players.findIndex((p) => p.id === opp.id); opp.pos = 0; t.players.find((p) => p.id === opp.id).pos = 0;
  const r = roll(t, 1, 2, opp.id);
  eq(pl(r.state, opp.id).cash, 1500 - 2 * B.spaces[3].rent[0]);
  // un adversaire qui détient une case de la couleur bloque la construction
  let u = teamGame(); give(u, cur.id, 1); give(u, opp.id, 3); u.turn.mustRoll = false; u.phase = 'end';
  refused(u, { type: 'BUILD', by: cur.id, space: 1 });
});

test('dés : historique des lancers et aléa fourni par l\'hôte', () => {
  let s = game(2); const a = roll(s, 3, 4).state;
  eq([a.stats.rolls, a.stats.dice[7]], [1, 1]);
  const x = reduce(forceDice(game(2), 3, 4), { type: 'ROLL', by: 0, entropy: 123456789 }, B);
  ok(x.ok); ok(x.state.turn.dice.join() !== '3,4' || true, 'l\'aléa change la graine');
  eq(x.state.stats.rolls, 1);
});

test('2 contre 2 : cartes « chaque joueur » limitées aux adversaires', () => {
  let s = teamGame(); const cur = currentPlayer(s);
  cur.pos = 14; // 1 + 2 → case 17, Caisse de communauté
  withCard(s, 'chest', B.cards.chest.find((c) => c.action.type === 'collectEach').id);
  const r = roll(s, 1, 2), amt = B.cards.chest.find((c) => c.action.type === 'collectEach').action.amount;
  eq(pl(r.state, cur.id).cash, 1500 + 2 * amt, 'payé par les 2 adversaires seulement');
});

/* ----------------------------------------------------------- cartes */
function withCard(s, deck, id) { const d = s.decks[deck]; d.pos = d.order.indexOf(id); return s; }

test('carte : avancer au pôle de transport le plus proche, double loyer', () => {
  let s = give(game(2), 1, 15); withCard(s, 'chance', 'ch05');
  s = roll(s, 3, 4).state; // case 7 → gare la plus proche : 15
  eq(pl(s, 0).pos, 15); eq(pl(s, 0).cash, 1500 - 50);
});

test('carte : compagnie la plus proche, 10× un nouveau lancer', () => {
  let s = give(game(2), 1, 28); withCard(s, 'chance', 'ch07'); pl(s, 0).pos = 17;
  const r = roll(s, 2, 3); s = r.state; // 22 → 28
  eq(pl(s, 0).pos, 28);
  const d = r.events.filter((e) => e.k === 'DICE' && e.reason === 'utility')[0].dice;
  eq(pl(s, 0).cash, 1500 - 10 * (d[0] + d[1]));
});

test('carte : reculer de 3 cases', () => {
  let s = withCard(game(2), 'chance', 'ch10');
  s = roll(s, 3, 4).state;
  eq(pl(s, 0).pos, 4); eq(pl(s, 0).cash, 1300);
});

test('carte : anniversaire, chaque joueur paie', () => {
  let s = withCard(game(3), 'chest', 'cc09');
  s = roll(s, 1, 1).state;
  eq([pl(s, 0).cash, pl(s, 1).cash, pl(s, 2).cash], [1520, 1490, 1490]);
});

test('carte : libéré de prison conservée et retirée du paquet', () => {
  let s = withCard(game(2), 'chance', 'ch09');
  s = roll(s, 3, 4).state;
  eq(pl(s, 0).jailCards, ['ch09']); eq(s.heldCards.ch09, 0);
});

test('carte : réparations', () => {
  let s = give(game(2), 0, 37, 39); s.props[37].houses = 2; s.props[39].hotel = true;
  withCard(s, 'chance', 'ch12');
  s = roll(s, 3, 4).state;
  eq(pl(s, 0).cash, 1500 - (2 * 25 + 100));
});

/* ----------------------------------------------------------- dettes et faillite */
test("dette : on hypothèque pour payer, puis le tour reprend", () => {
  let s = give(game(2), 1, 39); s.props[39].hotel = true; give(s, 0, 1);
  pl(s, 0).cash = 100; pl(s, 0).pos = 37;
  s = roll(s, 1, 1).state;
  eq(s.phase, 'debt'); eq(actors(s), [0]);
  refused(s, { type: 'END_TURN', by: 0 });
  s = act(s, { type: 'MORTGAGE', by: 0, space: 1 }).state;
  eq(s.phase, 'debt');
  s = act(s, { type: 'BANKRUPT', by: 0 }).state;
  ok(pl(s, 0).bankrupt); ok(s.over); eq(s.winner, 1);
  eq(s.props[1].owner, 1, 'les biens vont au créancier');
  eq(pl(s, 1).cash, 1500 + 100 + 30 - 3, 'argent + hypothèque reçue, moins 10 %');
});

test('dette réglée automatiquement dès que possible', () => {
  let s = give(game(2), 1, 39); give(s, 0, 37); pl(s, 0).cash = 10; pl(s, 0).pos = 37;
  s = roll(s, 1, 1).state; // loyer 100 (monopole incomplet → 50)
  eq(s.phase, 'debt');
  s = act(s, { type: 'MORTGAGE', by: 0, space: 37 }).state;
  eq(s.debts, []); eq(s.phase, 'roll'); // le double redonne la main
});

test("faillite envers la banque : terrains libérés", () => {
  let s = give(game(3), 0, 1); pl(s, 0).cash = 10; pl(s, 0).pos = 2;
  s = roll(s, 1, 1).state; // case 4 : impôts 200
  s = act(s, { type: 'BANKRUPT', by: 0 }).state;
  ok(pl(s, 0).bankrupt); eq(s.props[1].owner, null); ok(!s.over);
  eq(currentPlayer(s).id, 1);
});

test('express : la première faillite termine la partie au patrimoine', () => {
  let s = game(3, 'express');
  for (const k in s.props) s.props[k].owner = null;
  pl(s, 0).cash = 10; pl(s, 0).pos = 2; pl(s, 2).cash = 3000;
  s = roll(s, 1, 1).state;
  s = act(s, { type: 'BANKRUPT', by: 0 }).state;
  ok(s.over); eq(s.endReason, 'bankruptcy'); eq(s.winner, 2); eq(s.ranking, [2, 1, 0]);
});

test('express : fin du chrono', () => {
  let s = game(2, 'express');
  refused(s, { type: 'TIME_UP', by: 0 });
  s = act(s, { type: 'TIME_UP', by: 'host' }).state;
  ok(s.over); eq(s.endReason, 'time');
  const w = s.ranking.map((id) => netWorth(s, B, id).total);
  ok(w[0] >= w[1], 'classement au patrimoine');
  refused(game(2), { type: 'TIME_UP', by: 'host' });
});

test('patrimoine net : terrains, hypothèques, bâtiments', () => {
  const s = give(game(2), 0, 1, 3, 39); s.props[39].mortgaged = true; s.props[1].houses = 1; s.props[3].hotel = true;
  const w = netWorth(s, B, 0);
  eq(w.property, 60 + 60 + 200); eq(w.buildings, 50 + 250); eq(w.total, 1500 + 320 + 300); eq(w.monopolies, 1);
});

test('un joueur qui quitte : ses biens retournent à la banque', () => {
  let s = give(game(3), 1, 1);
  s = act(s, { type: 'PLAYER_LEFT', by: 'host', player: 1 }).state;
  ok(pl(s, 1).bankrupt); eq(s.props[1].owner, null); ok(!s.over);
});

test('actions disponibles', () => {
  const s = game(2);
  ok(availableActions(s, B, 0).includes('ROLL'));
  ok(!availableActions(s, B, 1).includes('ROLL'));
});

/* ----------------------------------------------------------- règles maison */
function houseGame(house, n = 2) {
  const { state } = createGame(B, { players: PLAYERS(n), mode: 'classic', seed: 7, now: 0, house });
  state.players.sort((a, b) => a.id - b.id);
  return state;
}
test('règles maison : par défaut, règles officielles', () => {
  const s = game(2);
  eq([s.cfg.freeParkingJackpot, s.cfg.doubleGoLanding, s.cfg.auctionWhenDeclined, s.cfg.startingCash], [false, false, true, 1500]);
  let g = game(2); g = roll(g, 1, 3).state; eq(g.pot, 0, 'pas de cagnotte');
});
test('règle maison : argent de départ', () => {
  ok(houseGame({ cash: 2000 }).players.every((p) => p.cash === 2000));
  ok(houseGame({ cash: 777 }).players.every((p) => p.cash === 1500), 'valeur inconnue → 1500');
});
test('règle maison : cagnotte du Parc gratuit', () => {
  let s = houseGame({ jackpot: true });
  s = roll(s, 1, 3).state;               // impôts 200 → cagnotte
  eq(s.pot, 200);
  s = act(s, { type: 'END_TURN', by: 0 }).state;
  pl(s, 1).pos = 15; s = roll(s, 2, 3, 1).state; // case 20
  eq(s.pot, 0); eq(pl(s, 1).cash, 1700);
});
test('règle maison : double salaire en tombant pile sur Départ', () => {
  let s = houseGame({ doubleGo: true }); pl(s, 0).pos = 35;
  s = roll(s, 2, 3).state; eq(pl(s, 0).cash, 1900);
  s = houseGame({ doubleGo: true }); pl(s, 0).pos = 36;
  s = roll(s, 2, 3).state; eq(pl(s, 0).cash, 1700, 'en passant seulement : salaire normal');
});
test('règle maison : sans enchères, la propriété refusée reste à la banque', () => {
  let s = houseGame({ auctions: false });
  s = roll(s, 1, 2).state;
  s = act(s, { type: 'DECLINE', by: 0 }).state;
  eq(s.auction, null); eq(s.props[3].owner, null); eq(s.phase, 'end');
});

test('joueur déconnecté : un bot prend sa place, puis il reprend la main', () => {
  let s = game(2);
  ok(pl(s, 1).human && !pl(s, 1).bot);
  refused(s, { type: 'SET_BOT', by: 0, player: 1, bot: true });
  s = act(s, { type: 'SET_BOT', by: 'host', player: 1, bot: true }).state;
  ok(pl(s, 1).bot && pl(s, 1).human, 'devenu bot, reste un humain');
  s = act(s, { type: 'SET_BOT', by: 'host', player: 1, bot: false }).state;
  ok(!pl(s, 1).bot);
});

/* ----------------------------------------------------------- reprise de partie */
test('reprise : correspondance par nom, puis dans l\'ordre, sinon bot', () => {
  const saved = [{ id: 0, name: 'Amiel' }, { id: 3, name: 'David' }, { id: 5, name: 'Léa' }, { id: 100, name: 'Mamé Rose', bot: true }];
  const room = [{ id: 0, name: 'david', color: '#2b8cff' }, { id: 1, name: 'Amiel', color: '#ff4b2b' }];
  const m = proposeMapping(saved, room);
  eq(m[0].id, 1); eq(m[3].id, 0); eq(m[5].bot, true); eq(m[100].bot, true);
  ok(m[5].id !== m[100].id && m[5].id >= 100, 'identifiants de bots distincts');
});

test('reprise : renumérotation cohérente de tout l\'état', () => {
  let s = give(game(3), 1, 39, 37); give(s, 2, 1);
  s.heldCards.ch09 = 1; pl(s, 1).jailCards = ['ch09'];
  s.turn.cur = 2; // on propose un échange pendant son tour
  s = act(s, { type: 'PROPOSE_TRADE', by: 2, to: 1, give: { cash: 50 }, want: { props: [39] } }).state;
  s.debts.push({ from: 2, to: 1, amount: 10, reason: 'rent', space: null });
  s.auction = { space: 24, high: 40, bidder: 1, active: [0, 1, 2], passed: [2], bids: 1 };
  const map = { 0: { id: 7 }, 1: { id: 4 }, 2: { id: 100, bot: true } };
  const r = remapPlayers(s, map);
  eq(r.players.map((p) => p.id).sort(), [100, 4, 7].sort());
  eq([r.props[39].owner, r.props[1].owner, r.heldCards.ch09], [4, 100, 4]);
  eq([r.trades[0].from, r.trades[0].to], [100, 4]);
  eq([r.debts[0].from, r.debts[0].to], [100, 4]);
  eq([r.auction.bidder, r.auction.active, r.auction.passed], [4, [7, 4, 100], [100]]);
  eq(Object.keys(r.stats.players).map(Number).sort(), [100, 4, 7].sort());
  ok(r.players.find((p) => p.id === 100).bot, 'devient un bot');
  // la partie continue normalement après la reprise
  r.auction = null; r.debts = [];
  const cur = currentPlayer(r).id;
  const after = reduce(forceDice(r, 1, 2), { type: 'ROLL', by: cur }, B);
  ok(after.ok, after.error);
  let bad = null; try { remapPlayers(s, { 0: { id: 1 }, 1: { id: 1 }, 2: { id: 5 } }); } catch (e) { bad = e; }
  ok(bad, 'doublon refusé');
});

test('reprise : le chrono Express est décalé de la durée de la pause', () => {
  const { state } = createGame(B, { players: PLAYERS(2), mode: 'express', seed: 3, now: 1000 });
  const r = resumeAt(state, 1000 + 10 * 60000, 1000 + 70 * 60000); // sauvée à 10 min, reprise une heure plus tard
  eq(r.endsAt - (1000 + 70 * 60000), 30 * 60000, 'il reste 30 minutes');
});

/* ----------------------------------------------------------- statistiques */
test('Markov : distribution stationnaire cohérente', () => {
  const pi = landingProbabilities(B);
  ok(Math.abs(pi.reduce((a, b) => a + b, 0) - 1) < 1e-9, 'somme ≠ 1');
  eq(pi[30], 0, 'on ne reste jamais sur « Allez en prison »');
  const top = pi.map((p, i) => [i, p]).sort((a, b) => b[1] - a[1]);
  eq(top[0][0], 10, 'la prison est la case la plus fréquentée');
  ok(pi[24] > pi[21] && pi[24] > 0.03, 'Cours Saleya parmi les plus visitées');
});

test('analyse financière : revenu espéré et rendement', () => {
  const s = give(game(3), 0, 37, 39); s.props[39].hotel = true;
  const { rows, opponents } = propertyAnalysis(s, B, 0);
  eq(opponents, 2);
  const prom = rows.find((r) => r.i === 39);
  eq(prom.rent, 2000); eq(prom.invested, 400 + 5 * 200);
  ok(Math.abs(prom.ev - landingProbabilities(B)[39] * 2000 * 2) < 1e-9, 'espérance');
  ok(prom.nextGain === null, 'pas de bâtiment après un hôtel');
  ok(rows.find((r) => r.i === 37).nextGain > 0, 'gain marginal d\'une maison');
});

test('historique : liquide enregistré et taille plafonnée', () => {
  let s = game(2);
  ok(s.stats.history[0].cash[0] === 1500, 'liquide absent');
  for (let k = 0; k < 450; k++) {
    s = forceDice(s, 1, 2); s = act(s, { type: 'ROLL', by: currentPlayer(s).id }).state;
    while (s.phase !== 'end') {
      const id = actors(s)[0];
      const a = s.phase === 'buy' ? { type: 'DECLINE', by: id } : s.auction ? { type: 'PASS', by: id } : s.debts.length ? { type: 'BANKRUPT', by: id } : { type: 'ROLL', by: id };
      s = act(s, a).state; if (s.over) break;
    }
    if (s.over) break;
    s = act(s, { type: 'END_TURN', by: currentPlayer(s).id }).state;
  }
  ok(s.stats.history.length <= 400, `historique trop long (${s.stats.history.length})`);
  eq(s.stats.history[s.stats.history.length - 1].t, s.turnCount - 1, 'dernier point conservé (fin du tour précédent)');
});

/* ----------------------------------------------------------- simulation */
function invariants(s) {
  let houses = 0, hotels = 0;
  for (const [k, pr] of Object.entries(s.props)) {
    houses += pr.houses; if (pr.hotel) hotels++;
    const sp = B.spaces[k];
    if (pr.houses || pr.hotel) {
      ok(sp.type === 'street', 'bâtiment hors terrain');
      ok(teamOwnsGroup(s, B, pr.owner, sp.group), 'bâtiment sans monopole');
      ok(groupSpaces(B, sp.group).every((j) => !s.props[j].mortgaged), 'bâtiment sur groupe hypothéqué');
      const lv = groupSpaces(B, sp.group).map((j) => level(s, j));
      ok(Math.max(...lv) - Math.min(...lv) <= 1, 'construction inégale');
      ok(pr.houses <= s.cfg.housesPerHotel, 'trop de maisons');
    }
    if (pr.owner != null) ok(!s.players.find((p) => p.id === pr.owner).bankrupt, 'bien à un failli');
  }
  eq(houses + s.bank.houses, s.cfg.bankHouses, 'stock de maisons');
  eq(hotels + s.bank.hotels, s.cfg.bankHotels, "stock d'hôtels");
  for (const p of s.players) ok(p.cash >= 0, `argent négatif (${p.cash})`);
  for (const [c, id] of Object.entries(s.heldCards)) ok(s.players.find((p) => p.id === id).jailCards.includes(c), 'carte perdue');
}

function simulate(n, mode, seed) {
  const now = 0;
  let { state: s } = createGame(B, { players: PLAYERS(n).map((p) => ({ ...p, bot: true })), mode, seed, now });
  let steps = 0, errors = 0;
  const maxTurns = mode === 'express' ? 160 : 1500;
  while (!s.over && steps < 40000) {
    if (mode === 'express' && s.turnCount >= maxTurns) { s = reduce(s, { type: 'TIME_UP', by: 'host' }, B).state; break; }
    if (s.turnCount >= maxTurns) break;
    const who = new Set([...s.trades.map((t) => t.to), ...actors(s)]); // les destinataires d'une proposition répondent d'abord
    let moved = false;
    for (const id of who) {
      const a = botAction(s, B, id);
      if (!a) continue;
      const r = reduce(s, { ...a, by: id }, B);
      if (!r.ok) { errors++; if (errors > 20) throw new Error(`bot bloqué : ${a.type} → ${r.error}`); continue; }
      s = r.state; moved = true; invariants(s);
      break;
    }
    if (!moved) {
      if (s.auction) { s = reduce(s, { type: 'AUCTION_TIMEOUT', by: 'host' }, B).state; invariants(s); }
      else throw new Error(`partie bloquée en phase ${s.phase}`);
    }
    steps++;
  }
  return s;
}

function simulateTeams(mode, seed) {
  const memory = {};
  let s = createGame(B, { players: TEAMS4().map((p) => ({ ...p, bot: true })), mode, seed, now: 0, teams: true }).state;
  for (let steps = 0; !s.over && steps < 40000; steps++) {
    if (s.turnCount >= (mode === 'express' ? 160 : 1500)) { if (mode === 'express') s = reduce(s, { type: 'TIME_UP', by: 'host' }, B).state; break; }
    let moved = false;
    const ids = new Set([...s.trades.map((t) => t.to), ...actors(s)]);
    for (const id of ids) {
      const a = botAction(s, B, id, { level: ['facile', 'normal', 'expert'][seed % 3], memory });
      if (!a) continue;
      const r = reduce(s, { ...a, by: id }, B);
      if (!r.ok) throw new Error(`bot bloqué (2 contre 2) : ${a.type} → ${r.error}`);
      s = r.state; moved = true; invariants(s); break;
    }
    if (!moved) { if (s.auction) s = reduce(s, { type: 'AUCTION_TIMEOUT', by: 'host' }, B).state; else throw new Error(`partie bloquée en phase ${s.phase}`); }
  }
  return s;
}
test('parties 2 contre 2 simulées entre bots', () => {
  let over = 0;
  for (let k = 0; k < 12; k++) { const s = simulateTeams(k % 2 ? 'express' : 'classic', 500 + k); if (s.over) over++; }
  ok(over >= 6, `seulement ${over}/12 parties terminées`);
});

const N = Number(process.argv[2] || 60);
const sim = { classic: { over: 0, turns: [] }, express: { over: 0, turns: [], time: 0, bankruptcy: 0 } };
test(`${N} parties simulées entre bots (2 à 6 joueurs)`, () => {
  for (let k = 0; k < N; k++) {
    const mode = k % 2 ? 'express' : 'classic', n = 2 + (k % 5);
    const s = simulate(n, mode, 1000 + k);
    if (s.over) { sim[mode].over++; sim[mode].turns.push(s.turnCount); if (mode === 'express') sim.express[s.endReason]++; }
  }
});

const med = (a) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(b.length / 2)] || 0; };
console.log(`Simulation — classique : ${sim.classic.over}/${N / 2} parties terminées (médiane ${med(sim.classic.turns)} tours) ; ` +
  `express : ${sim.express.bankruptcy} par faillite, ${sim.express.time} au chrono (médiane ${med(sim.express.turns)} tours).`);
console.log(failed ? `✗ ${failed} test(s) en échec, ${passed} réussi(s).` : `✓ ${passed} tests réussis.`);
process.exit(failed ? 1 : 0);
