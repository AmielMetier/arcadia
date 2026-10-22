// Tournoi entre niveaux de bots : node tools/bot-arena.mjs [parties] [niveaux séparés par des virgules]
// Chaque partie réunit les niveaux demandés (places tournantes) ; on compte les victoires
// (dernier solvable, ou meilleur patrimoine au bout de MAX_TURNS tours).
import { readFileSync } from 'node:fs';
import { createGame, reduce, actors } from '../david/engine/rules.js';
import { botAction } from '../david/engine/bot.js';
import { standings } from '../david/engine/valuation.js';

const B = JSON.parse(readFileSync(new URL('../david/data/board-nice.json', import.meta.url), 'utf8'));
const N = Number(process.argv[2] || 120);
const LEVELS = (process.argv[3] || 'expert,normal,normal,facile').split(',');
const MAX_TURNS = 500;

const wins = {}, seats = {}, trades = { proposed: 0, done: 0 };
let errors = 0, stalls = 0, turnsTotal = 0;
for (const l of LEVELS) { wins[l] = 0; seats[l] = 0; }

for (let g = 0; g < N; g++) {
  const order = LEVELS.map((_, k) => LEVELS[(k + g) % LEVELS.length]);
  const players = order.map((l, k) => ({ id: k, name: `${l}${k}`, color: '#000', bot: true, level: l }));
  let { state: s } = createGame(B, { players, mode: 'classic', seed: 5000 + g, now: 0 });
  const level = Object.fromEntries(players.map((p) => [p.id, p.level]));
  const memory = {};
  let steps = 0;
  while (!s.over && s.turnCount < MAX_TURNS && steps < 60000) {
    let moved = false;
    const ids = new Set([...s.trades.map((t) => t.to), ...actors(s)]); // les destinataires d'une proposition répondent d'abord
    for (const id of ids) {
      const a = botAction(s, B, id, { level: level[id], memory });
      if (!a) continue;
      const r = reduce(s, { ...a, by: id }, B);
      if (!r.ok) { errors++; continue; }
      if (a.type === 'PROPOSE_TRADE') trades.proposed++;
      if (r.events.some((e) => e.k === 'TRADE_DONE')) trades.done++;
      s = r.state; moved = true; break;
    }
    if (!moved) {
      if (s.auction) s = reduce(s, { type: 'AUCTION_TIMEOUT', by: 'host' }, B).state;
      else { stalls++; break; }
    }
    steps++;
  }
  turnsTotal += s.turnCount;
  const winner = s.over ? s.winner : standings(s, B)[0].id;
  wins[level[winner]]++;
  for (const l of order) seats[l]++;
}

console.log(`${N} parties · niveaux : ${LEVELS.join(', ')} · ${Math.round(turnsTotal / N)} tours en moyenne`);
for (const l of Object.keys(wins)) {
  const share = seats[l] / N;           // nombre de places de ce niveau par partie
  console.log(`  ${l.padEnd(7)} ${String(wins[l]).padStart(4)} victoires · ${(100 * wins[l] / N).toFixed(1)} % (à égalité : ${(100 * share / LEVELS.length).toFixed(1)} %)`);
}
console.log(`  échanges proposés ${trades.proposed}, conclus ${trades.done} · actions refusées ${errors} · blocages ${stalls}`);
