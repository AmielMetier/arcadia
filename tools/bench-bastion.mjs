// Banc de mesure de Bastion Clash : node tools/bench-bastion.mjs [minutes] [graine] [mode] [carte]
// Fait jouer 4 bots hors navigateur et mesure le coût d'un pas de simulation, les éliminations,
// les cibles des bots et les unités bloquées. BASTION_ENGINE=dossier mesure une autre version du moteur.
import { loadEngine, playBots } from './bastion-engine.mjs';

const minutes = Number(process.argv[2] || 12);
const seed = Number(process.argv[3] || 1);
const mode = process.argv[4] || 'ffa';
const map = process.argv[5] || 'vallee';

const E = loadEngine({ seed });
const per = [];
let cur = null, worst = 0, slow = 0, steps = 0;
const elims = [];
const targets = new Map();
const fmt = (t) => `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

const s = playBots(E, {
  minutes, mode, map,
  onStep(st, fx, d) {
    steps++;
    worst = Math.max(worst, d);
    if (d > 1000 / 30) slow++;
    const m = Math.floor((st.time - E.TICK_DT / 2) / 60);
    if (!cur || cur.m !== m) { cur = { m, sum: 0, n: 0, max: 0, units: 0 }; per.push(cur); }
    cur.sum += d; cur.n++; cur.max = Math.max(cur.max, d); cur.units = st.units.length;
    for (const e of fx) if (e.k === 'ELIM') elims.push(`${fmt(st.time)} ${e.name}`);
    // Cible des vagues : le QG ennemi que chaque bot a choisi
    for (const p of st.players) {
      if (!p.bot || p.botTargetId == null) continue;
      const b = st.buildings.find((x) => x.id === p.botTargetId);
      if (b) { const k = `${p.id}→${b.owner}`; if (!targets.has(k)) targets.set(k, fmt(st.time)); }
    }
  },
});

// Unités d'attaque qui n'ont pas bougé en 1 s, et combien sont encore dans leur base
const amove = s.units.filter((u) => u.mode === 'amove' && !u.boardedIn);
const pos = new Map(amove.map((u) => [u.id, [u.x, u.y]]));
if (!s.over) for (let i = 0; i < 30; i++) E.stepWorld(s, E.TICK_DT, []);
const stuck = amove.filter((u) => u.hp > 0 && Math.hypot(u.x - pos.get(u.id)[0], u.y - pos.get(u.id)[1]) < 5);
const stuckHome = stuck.filter((u) => { const p = s.players.find((q) => q.id === u.owner); return Math.hypot(u.x - p.spawnX, u.y - p.spawnY) < 450; });

console.log(`Bastion — ${mode} ${map}, graine ${seed}, ${minutes} min de jeu simulées (${steps} pas)`);
console.log('minute | unités | pas moyen | pas max');
for (const r of per) console.log(`${String(r.m + 1).padStart(6)} | ${String(r.units).padStart(6)} | ${(r.sum / r.n).toFixed(2).padStart(7)} ms | ${r.max.toFixed(1).padStart(6)} ms`);
console.log(`Pas le plus long : ${worst.toFixed(1)} ms · pas au-delà de 33 ms : ${slow}/${steps}`);
console.log(`Éliminations : ${elims.length ? elims.join(', ') : 'aucune'}${s.over ? ` · partie finie à ${fmt(s.time)}` : ''}`);
console.log(`Cibles choisies par les bots (attaquant→QG visé, dès) : ${[...targets].map(([k, v]) => `${k} ${v}`).join(', ') || 'aucune'}`);
console.log(`Unités d'attaque immobiles : ${stuck.length}/${amove.length}, dont ${stuckHome.length} dans leur propre base`);
