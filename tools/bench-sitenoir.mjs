// Parties entières entre bots, hors navigateur : node tools/bench-sitenoir.mjs [parties] [niveau] [enquêteurs]
// Mesure la durée (objectif : une quinzaine de minutes), les victoires, les preuves, le coût d'un pas et les bots bloqués.
import { Sim, DT } from '../sitenoir/engine/sim.js';
const games = +(process.argv[2] || 12), levels = process.argv[3] && process.argv[3] !== 'all' ? [process.argv[3]] : ['facile', 'normal', 'expert'], places = +(process.argv[4] || 4);
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
for (const level of levels) {
  const T = [], marks = { gen: [], first: [], lift: [] };
  let sw = 0, proofs = 0, stuck = 0, worst = 0, purge = 0, deaths = 0, downs = 0;
  for (let g = 0; g < games; g++) {
    const sim = new Sim({ seed: 1000 + g * 37, level });
    for (let i = 0; i < places; i++) sim.addPlayer({ id: i + 1, name: 'E' + i, color: '#888888', bot: true });
    sim.addPlayer({ id: 9, name: 'M', color: '#000000', bot: true, role: 'm' });
    let first = 0;
    while (sim.w.ph !== 'over') {
      const t0 = performance.now(); sim.step(DT); worst = Math.max(worst, performance.now() - t0);
      for (const e of sim.drainEvents()) {
        if (e.e === 'unlock' && !first) { first = sim.w.t; marks.first.push(first); }
        if (e.e === 'gen') marks.gen.push(sim.w.t);
        if (e.e === 'lift' && e.k === 'call') marks.lift.push(sim.w.t);
        if (e.e === 'dead') deaths++;
        if (e.e === 'down') downs++;
      }
    }
    T.push(sim.w.t); if (sim.w.win === 's') sw++; proofs += sim.w.banked; stuck += sim.botStuck || 0; if (sim.w.end === 'purge') purge++;
  }
  T.sort((a, b) => a - b);
  const avg = (l) => (l.length ? clock(l.reduce((a, b) => a + b, 0) / l.length) : '—');
  console.log(`${level.padEnd(7)} durée mini ${clock(T[0])} · médiane ${clock(T[T.length >> 1])} · maxi ${clock(T[T.length - 1])} | enquêteurs ${sw}/${games}, temps écoulé ${purge} | 1re porte ${avg(marks.first)}, générateur ${avg(marks.gen)} (${marks.gen.length}/${games}), appel ${avg(marks.lift)} | à terre ${(downs / games).toFixed(1)}, morts ${(deaths / games).toFixed(1)}, preuves ${(proofs / Math.max(1, sw)).toFixed(1)} | blocages ${(stuck / games).toFixed(1)}, pire pas ${worst.toFixed(1)} ms`);
}
