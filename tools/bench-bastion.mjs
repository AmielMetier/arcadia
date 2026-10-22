// Banc de mesure de Bastion Clash : node tools/bench-bastion.mjs [minutes] [graine] [mode] [carte]
// Charge la vraie simulation de bastion/index.html (règles, bots, vision) hors navigateur, fait jouer
// 4 bots et mesure le coût d'un pas de simulation, les éliminations, les cibles des bots et les unités bloquées.
import fs from 'node:fs';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const minutes = Number(process.argv[2] || 12);
const seed = Number(process.argv[3] || 1);
const mode = process.argv[4] || 'ffa';
const map = process.argv[5] || 'vallee';

// BASTION_HTML=chemin permet de mesurer une autre version du jeu (avant / après une correction)
const html = fs.readFileSync(process.env.BASTION_HTML || fileURLToPath(new URL('../bastion/index.html', import.meta.url)), 'utf8');
const script = html.slice(html.indexOf("'use strict';"), html.lastIndexOf('</script>'));
const header = (title) => {
  const i = script.indexOf(title);
  if (i < 0) throw new Error('Repère introuvable : ' + title);
  return script.lastIndexOf('/* ====', i);
};
// Données + cartes, puis règles + simulation + bots, puis vision : ni audio, ni rendu, ni interface
const code = script.slice(0, header('AUDIO SYNTHÉTISÉ'))
  + script.slice(header('RÈGLES DE PLACEMENT'), header('MOTEUR 3D VUE DU DESSUS'))
  + script.slice(header('VISION & BROUILLARD'), header('PRIMITIVES DE PROJECTION'))
  + '\nlet role = "solo";\nglobalThis.__api = { createInitialState, stepWorld, runBots, PALETTE, TICK_DT, terTypeAt, getFlowCacheSize: () => flowCache.size };';

// Le décor et le brouillard dessinent dans des canvas : on les remplace par un objet qui absorbe tout
const stub = new Proxy(function () {}, {
  get: (t, k) => (k === Symbol.toPrimitive ? () => 0 : stub),
  apply: () => stub,
  construct: () => stub,
  set: () => true,
});
const ctx = vm.createContext({ document: { createElement: () => stub, querySelector: () => null, querySelectorAll: () => [] }, console, performance });
let a = seed >>> 0;
ctx.__rand = () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
vm.runInContext('Math.random = __rand;', ctx);
vm.runInContext(code, ctx, { filename: 'bastion-sim.js' });
const B = ctx.__api;

const roster = [0, 1, 2, 3].map((i) => ({ id: 100 + i, name: 'Bot' + i, color: B.PALETTE[i], bot: true }));
const s = B.createInitialState(roster, { map, mode, pace: 'standard', level: 'normal' });
const BOT_EVERY = 1.25;
const per = [];
let botT = 0, cur = null, worst = 0, slow = 0, steps = 0;
const elims = [];
const targets = new Map();

while (!s.over && s.time < minutes * 60) {
  const fx = [];
  const t0 = performance.now();
  B.stepWorld(s, B.TICK_DT, fx);
  botT += B.TICK_DT;
  if (botT >= BOT_EVERY) {
    botT = 0;
    const before = new Map(s.units.map((u) => [u.id, u.mode + ':' + u.orderX + ':' + u.orderY]));
    B.runBots(s, fx);
    // Cible d'une vague : le QG ennemi vers lequel partent les unités qui viennent de changer d'ordre
    for (const u of s.units) {
      if (u.kind === 'scv' || u.mode !== 'amove' || before.get(u.id) === u.mode + ':' + u.orderX + ':' + u.orderY) continue;
      const hq = s.buildings.filter((b) => b.kind === 'hq' && b.owner !== u.owner)
        .sort((p, q) => Math.hypot(p.x - u.orderX, p.y - u.orderY) - Math.hypot(q.x - u.orderX, q.y - u.orderY))[0];
      if (hq && Math.hypot(hq.x - u.orderX, hq.y - u.orderY) < 200) {
        const key = u.owner + '→' + hq.owner;
        targets.set(key, (targets.get(key) || 0) + 1);
      }
    }
  }
  const d = performance.now() - t0;
  steps++;
  worst = Math.max(worst, d);
  if (d > 1000 / 30) slow++;
  const m = Math.floor(s.time / 60);
  if (!cur || cur.m !== m) { cur = { m, sum: 0, n: 0, max: 0, units: 0 }; per.push(cur); }
  cur.sum += d; cur.n++; cur.max = Math.max(cur.max, d); cur.units = s.units.length;
  for (const e of fx) if (e.k === 'ELIM') elims.push(`${fmt(s.time)} ${e.name}`);
}

// Unités d'attaque qui n'ont pas bougé en 1 s, et combien sont encore dans leur base
const amove = s.units.filter((u) => u.mode === 'amove' && !u.boardedIn);
const pos = new Map(amove.map((u) => [u.id, [u.x, u.y]]));
if (!s.over) for (let i = 0; i < 30; i++) B.stepWorld(s, B.TICK_DT, []);
const stuck = amove.filter((u) => u.hp > 0 && Math.hypot(u.x - pos.get(u.id)[0], u.y - pos.get(u.id)[1]) < 5);
const stuckHome = stuck.filter((u) => { const p = s.players.find((q) => q.id === u.owner); return Math.hypot(u.x - p.spawnX, u.y - p.spawnY) < 450; });

function fmt(t) { return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`; }

console.log(`Bastion — ${mode} ${map}, graine ${seed}, ${minutes} min de jeu simulées (${steps} pas)`);
console.log('minute | unités | pas moyen | pas max');
for (const r of per.filter((q) => q.n > 30)) console.log(`${String(r.m + 1).padStart(6)} | ${String(r.units).padStart(6)} | ${(r.sum / r.n).toFixed(2).padStart(7)} ms | ${r.max.toFixed(1).padStart(6)} ms`);
console.log(`Pas le plus long : ${worst.toFixed(1)} ms · pas au-delà de 33 ms : ${slow}/${steps}`);
console.log(`Éliminations : ${elims.length ? elims.join(', ') : 'aucune'}${s.over ? ` · partie finie à ${fmt(s.time)}` : ''}`);
console.log(`Cibles des vagues (attaquant→QG visé, nb d'unités) : ${[...targets].map(([k, v]) => `${k} ×${v}`).join(', ') || 'aucune vague'}`);
console.log(`Unités d'attaque immobiles : ${stuck.length}/${amove.length}, dont ${stuckHome.length} dans leur propre base`);
