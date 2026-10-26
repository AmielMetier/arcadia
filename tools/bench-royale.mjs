// Banc de mesure d'Island Rush : node tools/bench-royale.mjs [joueurs] [niveau] [graine de partie] [minutes max]
// Fait jouer une partie entière entre bots hors navigateur, sur l'île officielle : coût d'un pas (bots compris),
// sauts et atterrissages, coffres ouverts, éliminations (qui, comment, quand), bots restés coincés, vainqueur.
import { generateMap, ILE } from '../royale/engine/map.js';
import { buildWorld } from '../royale/engine/world.js';
import { createSim, DT } from '../royale/engine/sim.js';
import { createBuild } from '../royale/engine/build.js';
import { createAI } from '../royale/engine/ai.js';

const n = Number(process.argv[2] || 24);
const level = process.argv[3] || 'normal';
const seed = Number(process.argv[4] || 1);
const maxMin = Number(process.argv[5] || 20);
const quiet = process.env.QUIET === '1';

const map = generateMap(ILE), world = buildWorld(map);
const roster = Array.from({ length: n }, (_, i) => ({ id: 'bot' + i, name: 'Bot' + i, color: '#888', bot: true, level }));
const sim = createSim({ map, world, seed, roster, mode: 'partie' });
createBuild(sim, map, world);
let t0 = performance.now();
const ai = createAI(sim, map, world);
const navMs = performance.now() - t0;
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const stats = { jumps: 0, land: [], chests: 0, picks: 0, shots: 0, hits: 0, heals: 0, nades: 0, doors: 0, causes: {}, elims: [] };
let steps = 0, sum = 0, worst = 0, slow = 0;
const moved = new Map([...sim.S.players.keys()].map((id) => [id, { d: 0, x: 0, z: 0, idle: 0 }]));
const perMin = [];
while (sim.S.phase !== 'fin' && sim.S.t < maxMin * 60) {
  const a = performance.now();
  sim.step(DT);
  const d = performance.now() - a;
  steps++; sum += d; worst = Math.max(worst, d); if (d > 8) slow++;
  const m = Math.floor(sim.S.t / 60);
  if (!perMin[m]) perMin[m] = { sum: 0, n: 0, max: 0 };
  perMin[m].sum += d; perMin[m].n++; perMin[m].max = Math.max(perMin[m].max, d);
  for (const e of sim.takeEvents()) {
    if (e.e === 'saut') stats.jumps++;
    else if (e.e === 'atterrit') stats.land.push(sim.S.t);
    else if (e.e === 'coffre') stats.chests++;
    else if (e.e === 'ramasse') stats.picks++;
    else if (e.e === 'tir') { stats.shots++; if (e.hit === 2) stats.hits++; }
    else if (e.e === 'soin') stats.heals++;
    else if (e.e === 'lance') stats.nades++;
    else if (e.e === 'porte') stats.doors++;
    else if (e.e === 'elim') {
      const c = e.cause || 'autre'; stats.causes[c] = (stats.causes[c] || 0) + 1;
      stats.elims.push(`${fmt(sim.S.t)} ${e.to}${e.by ? ' par ' + e.by : ''} (${c}) · ${e.left} restants`);
    }
  }
  // suivi d'un bot (WATCH=bot16)
  if (process.env.WATCH && steps % (+process.env.EVERY || 300) === 0) {
    const P = sim.S.players.get(process.env.WATCH), B = P && P.ai;
    if (P && P.alive && B) console.log(`${fmt(sim.S.t)} ${P.mode} ${P.x.toFixed(1)},${P.y.toFixed(1)},${P.z.toFixed(1)} hp${P.hp | 0}/${P.sh | 0} ${B.state} goal=${B.goal ? `${B.goal.kind}:${B.goal.id}@${B.goal.x.toFixed(0)},${B.goal.z.toFixed(0)}` : '-'} path=${B.path ? `${B.wp}/${B.path.length}${B.partial ? ' partiel' : ''}` : '-'} stuck${B.stuckN} enemy=${B.enemy || '-'} inv=${P.inv.map((i) => (i ? i.w || i.c : '_')).join(',')} mv=${P.inp.mx.toFixed(1)},${P.inp.mz.toFixed(1)}`);
  }
  // distance parcourue par chaque bot au sol, par tranches de 10 s
  if (steps % 600 === 0) for (const P of sim.S.players.values()) {
    const M = moved.get(P.id);
    if (P.alive && P.mode === 'sol') { const dd = Math.hypot(P.x - M.x, P.z - M.z); M.d += dd; if (dd < 3) M.idle++; }
    M.x = P.x; M.z = P.z;
  }
}
const res = sim.results();
console.log(`Island Rush · ${n} bots ${level} · partie ${seed} · chemins prêts en ${navMs.toFixed(0)} ms`);
console.log(`durée ${fmt(sim.S.t)} · ${steps} pas · ${(sum / steps).toFixed(3)} ms par pas en moyenne, pire ${worst.toFixed(1)} ms, ${slow} pas au-dessus de 8 ms`);
console.log('par minute (moy / max ms) :', perMin.map((p, i) => `${i}:${(p.sum / p.n).toFixed(2)}/${p.max.toFixed(0)}`).join(' '));
console.log(`sauts ${stats.jumps} · atterrissages ${stats.land.length} (dernier à ${fmt(Math.max(0, ...stats.land))}) · coffres ${stats.chests} · objets ramassés ${stats.picks} · portes ${stats.doors}`);
console.log(`tirs ${stats.shots} (${stats.hits} touchés, ${(stats.hits / Math.max(1, stats.shots) * 100).toFixed(0)} %) · soins ${stats.heals} · lancers ${stats.nades}`);
console.log('éliminations par cause :', JSON.stringify(stats.causes));
const idle = [...moved.entries()].filter(([, M]) => M.idle >= 6).map(([id, M]) => `${id}(${M.idle * 10}s)`);
console.log(`bots longtemps immobiles (au sol, >1 min cumulée) : ${idle.length ? idle.join(' ') : 'aucun'}`);
if (!quiet) for (const l of stats.elims) console.log('  ' + l);
const win = res[0];
console.log(sim.S.phase === 'fin' ? `vainqueur ${win.name} · ${win.kills} élim.` : `pas fini : ${sim.alive().length} en vie`);
console.log('top 5 :', res.slice(0, 5).map((r) => `${r.place}. ${r.name} ${r.kills}k ${r.dealt}dg`).join(' · '));
void ai;
