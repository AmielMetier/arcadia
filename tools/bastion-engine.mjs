// Charge le moteur de Bastion Clash (bastion/engine/*.js, scripts classiques du navigateur) dans un contexte Node isolé.
// Le hasard est remplacé par un générateur à graine pour que les parties soient rejouables.
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ENGINE_FILES = ['core.js', 'map.js', 'vision.js', 'rules.js', 'sim.js', 'bots.js', 'waves.js', 'snapshot.js'];

export function loadEngine({ seed = 1, dir = process.env.BASTION_ENGINE || fileURLToPath(new URL('../bastion/engine/', import.meta.url)) } = {}) {
  const ctx = vm.createContext({ console, performance });
  let a = seed >>> 0;
  ctx.__rand = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  vm.runInContext('Math.random = __rand;', ctx);
  // Les scripts partagent leur portée globale, comme dans la page
  const code = ENGINE_FILES.map((f) => fs.readFileSync(path.join(dir, f), 'utf8')).join('\n;\n')
    + "\ninitMap('vallee', 'ffa');";
  vm.runInContext(code, ctx, { filename: 'bastion-engine.js' });
  // Accès à n'importe quel nom du moteur : E.stepWorld, E.UNITS, E.WORLD_SIZE…
  // (les fonctions sont mémorisées ; les variables, qui changent avec la carte, sont relues à chaque fois)
  const fns = new Map();
  return new Proxy({}, {
    get: (t, k) => {
      if (typeof k !== 'string') return undefined;
      if (fns.has(k)) return fns.get(k);
      const v = vm.runInContext(k, ctx);
      if (typeof v === 'function') fns.set(k, v);
      return v;
    },
  });
}

// Fait jouer des bots : renvoie l'état final et le coût des pas de simulation
export function playBots(E, { minutes = 10, mode = 'ffa', map = 'vallee', level = 'normal', players = 4, onStep } = {}) {
  const roster = Array.from({ length: players }, (_, i) => ({ id: 100 + i, name: 'Bot' + i, color: E.PALETTE[i], bot: true }));
  const s = E.createInitialState(roster, { map, mode, pace: 'standard', level });
  const botEvery = level === 'expert' ? 0.85 : level === 'facile' ? 2 : 1.25;
  let botT = 0;
  while (!s.over && s.time < minutes * 60) {
    const fx = [];
    const t0 = performance.now();
    E.stepWorld(s, E.TICK_DT, fx);
    botT += E.TICK_DT;
    if (botT >= botEvery) { botT = 0; E.runBots(s, fx); }
    if (onStep) onStep(s, fx, performance.now() - t0);
  }
  return s;
}
