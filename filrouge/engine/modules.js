// Les six modules de la bombe. Pour chacun :
//   gen(rng, bomb, man, diff)    → état initial du module (données visibles par le démineur)
//   expect(mod, bomb, man)        → ce que le manuel demande (calculé, jamais stocké)
//   act(mod, a, bomb, man)        → 'ok' | 'strike' | 'solved' ; modifie mod sur place
//   solution(mod, bomb, man)      → suite d'actions qui désamorce le module (tests, démonstration)
import { cond, WIRE_COLORS, KEY_COLORS, GAUGE_COLORS, CITIES, INKS, LOT_LETTERS } from './manual.js';

/* ------------------------------------------------------------------ Raccordements */
function wireNeed(w, bomb, man) {
  const cell = man.wires[w.l][w.r];
  if (cell.k === 'cut') return true;
  if (cell.k === 'keep') return false;
  if (cell.k === 'col') return cell.c.includes(w.c);
  return cond(cell.q, bomb);
}
const wires = {
  gen(rng, bomb, man, diff) {
    for (let t = 0; t < 60; t++) {
      const n = diff >= 2 ? 5 + rng.int(2) : 4 + rng.int(2);
      const ls = rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, n).sort((a, b) => a - b);
      const rs = rng.shuffle([0, 1, 2, 3, 4, 5]).slice(0, n);
      const list = ls.map((l, k) => ({ l, r: rs[k], c: rng.int(WIRE_COLORS.length), cut: false }));
      const need = list.filter((w) => wireNeed(w, bomb, man)).length;
      if (need >= 1 && need < n) return { wires: list };
    }
    // repli improbable : un seul fil à couper, forcé sur une case « couper »
    const cut = man.wires.flat().findIndex((x) => x.k === 'cut'), keep = man.wires.flat().findIndex((x) => x.k === 'keep');
    const at = (k) => ({ l: Math.floor(k / 6), r: k % 6, c: rng.int(WIRE_COLORS.length), cut: false });
    return { wires: [at(Math.max(0, cut)), at(Math.max(0, keep))].filter((w, k, a) => k === 0 || w.l !== a[0].l) };
  },
  expect: (mod, bomb, man) => mod.wires.map((w) => wireNeed(w, bomb, man)),
  act(mod, a, bomb, man) {
    const w = mod.wires[a.i];
    if (a.op !== 'cut' || !w || w.cut) return 'ok';
    w.cut = true;
    const need = wires.expect(mod, bomb, man);
    if (!need[a.i]) return 'strike';
    return mod.wires.every((x, k) => !need[k] || x.cut) ? 'solved' : 'ok';
  },
  solution: (mod, bomb, man) => wires.expect(mod, bomb, man).flatMap((n, i) => (n ? [{ op: 'cut', i }] : [])),
};

/* ------------------------------------------------------------------ Coffre */
const safe = {
  gen(rng) {
    const runes = rng.shuffle([...Array(24).keys()]).slice(0, 3);
    return { runes, pos: rng.int(10), entered: [] };
  },
  expect(mod, bomb, man) {
    const d = mod.runes.map((r) => man.safe.digits[r]);
    if (man.safe.addStamps) d[0] = (d[0] + bomb.stamps.length) % 10;
    return cond(man.safe.reverseIf, bomb) ? d.reverse() : d;
  },
  act(mod, a, bomb, man) {
    if (a.op === 'dial') { mod.pos = (mod.pos + (a.d > 0 ? 1 : 9)) % 10; return 'ok'; }
    if (a.op !== 'enter') return 'ok';
    const want = safe.expect(mod, bomb, man);
    if (mod.pos !== want[mod.entered.length]) { mod.entered = []; return 'strike'; }
    mod.entered.push(mod.pos);
    return mod.entered.length === 3 ? 'solved' : 'ok';
  },
  solution(mod, bomb, man) {
    const out = []; let pos = mod.pos;
    for (const d of safe.expect(mod, bomb, man)) {
      while (pos !== d) { out.push({ op: 'dial', d: 1 }); pos = (pos + 1) % 10; }
      out.push({ op: 'enter' });
    }
    return out;
  },
};

/* ------------------------------------------------------------------ Leviers */
const switches = {
  gen(rng, bomb, man) {
    const row = man.switches.table[rng.int(man.switches.table.length)];
    const mod = { code: row.code, leds: Array.from({ length: 5 }, () => rng.int(3)), up: [] };
    const want = switches.expect(mod, bomb, man);
    do mod.up = Array.from({ length: 5 }, () => rng.next() < 0.5); while (mod.up.every((u, i) => u === want[i]));
    return mod;
  },
  expect(mod, bomb, man) {
    const row = man.switches.table.find((r) => r.code === mod.code);
    return row.up.map((u, i) => (mod.leds[i] === man.switches.invertLed ? !u : u));
  },
  act(mod, a, bomb, man) {
    if (a.op === 'flip' && a.i >= 0 && a.i < 5) { mod.up[a.i] = !mod.up[a.i]; return 'ok'; }
    if (a.op !== 'submit') return 'ok';
    const want = switches.expect(mod, bomb, man);
    return mod.up.every((u, i) => u === want[i]) ? 'solved' : 'strike';
  },
  solution(mod, bomb, man) {
    const want = switches.expect(mod, bomb, man);
    return [...mod.up.flatMap((u, i) => (u !== want[i] ? [{ op: 'flip', i }] : [])), { op: 'submit' }];
  },
};

/* ------------------------------------------------------------------ Carillon */
const chime = {
  gen(rng) { return { mel: rng.int(8), done: 0 }; },
  expect(mod, bomb, man) {
    const keys = [...man.chime.melodies[mod.mel].keys];
    return cond(man.chime.reverseIf, bomb) ? keys.reverse() : keys;
  },
  act(mod, a, bomb, man) {
    if (a.op !== 'key') return 'ok';
    const want = chime.expect(mod, bomb, man);
    if (a.i !== want[mod.done]) { mod.done = 0; return 'strike'; }
    mod.done++;
    return mod.done === want.length ? 'solved' : 'ok';
  },
  solution: (mod, bomb, man) => chime.expect(mod, bomb, man).map((i) => ({ op: 'key', i })),
};

/* ------------------------------------------------------------------ Tuyauterie (grille 4 × 4) */
// Côtés : 0 = haut, 1 = droite, 2 = bas, 3 = gauche
const DR = [-1, 0, 1, 0], DC = [0, 1, 0, -1];
export function pipeSides(t) {
  if (t.k === 'I') return t.rot % 2 === 0 ? [1, 3] : [0, 2];
  return [t.rot % 4, (t.rot + 1) % 4];
}
// Suit l'eau depuis l'arrivée (à gauche, ligne mod.inlet) : cases traversées et sortie atteinte (-1 = fuite)
export function pipeFlow(mod) {
  let r = mod.inlet, c = 0, from = 3;
  const cells = [];
  for (let step = 0; step < 32; step++) {
    const t = mod.grid[r * 4 + c], s = pipeSides(t);
    if (!s.includes(from)) return { cells, out: -1, leak: [r, c] };
    cells.push(r * 4 + c);
    const to = s[0] === from ? s[1] : s[0];
    const nr = r + DR[to], nc = c + DC[to];
    if (nr < 0 || nr > 3 || nc < 0 || nc > 3) return { cells, out: to === 1 && c === 3 ? r : -1, leak: to === 1 ? null : [r, c] };
    r = nr; c = nc; from = (to + 2) % 4;
  }
  return { cells, out: -1, leak: null };
}
function pipePath(rng, rin, rout) {
  // chemin sans croisement de (rin, 0) à (rout, 3), au moins 6 cases
  for (let t = 0; t < 400; t++) {
    const path = [[rin, 0]], seen = new Set([rin * 4]);
    for (let s = 0; s < 20; s++) {
      const [r, c] = path[path.length - 1];
      if (c === 3 && r === rout && path.length >= 6) return path;
      const opts = rng.shuffle([0, 1, 2, 3]).map((d) => [r + DR[d], c + DC[d]])
        .filter(([nr, nc]) => nr >= 0 && nr < 4 && nc >= 0 && nc < 4 && !seen.has(nr * 4 + nc));
      if (!opts.length) break;
      const nx = opts[0]; path.push(nx); seen.add(nx[0] * 4 + nx[1]);
    }
  }
  // repli : ligne droite puis descente
  const path = [];
  for (let c = 0; c < 3; c++) path.push([rin, c]);
  for (let r = rin; r !== rout; r += rout > rin ? 1 : -1) path.push([r, 3]);
  path.push([rout, 3]);
  return path;
}
const pipes = {
  gen(rng, bomb, man) {
    const inlet = rng.int(4), valve = rng.int(4);
    const target = man.pipes.table[valve][cond(man.pipes.cond, bomb) ? 1 : 0];
    const path = pipePath(rng, inlet, target);
    const grid = Array.from({ length: 16 }, () => ({ k: rng.next() < 0.5 ? 'I' : 'L', rot: 0 }));
    const sol = [];
    path.forEach(([r, c], k) => {
      const prev = k === 0 ? [r, c - 1] : path[k - 1], next = k === path.length - 1 ? [r, c + 1] : path[k + 1];
      const side = (a) => (a[0] < r ? 0 : a[1] > c ? 1 : a[0] > r ? 2 : 3);
      const a = side(prev), b = side(next);
      const t = grid[r * 4 + c];
      if ((a + 2) % 4 === b) { t.k = 'I'; sol.push({ cell: r * 4 + c, sides: [a, b] }); }
      else { t.k = 'L'; sol.push({ cell: r * 4 + c, sides: [a, b] }); }
    });
    const mod = { inlet, valve, grid, sol };
    for (let t = 0; t < 20; t++) {
      for (const g of grid) g.rot = rng.int(4);
      if (pipeFlow(mod).out !== target) break;
    }
    return mod;
  },
  expect: (mod, bomb, man) => man.pipes.table[mod.valve][cond(man.pipes.cond, bomb) ? 1 : 0],
  act(mod, a, bomb, man) {
    if (a.op === 'rot' && mod.grid[a.i]) { mod.grid[a.i].rot = (mod.grid[a.i].rot + 1) % 4; return 'ok'; }
    if (a.op !== 'open') return 'ok';
    return pipeFlow(mod).out === pipes.expect(mod, bomb, man) ? 'solved' : 'strike';
  },
  solution(mod) {
    const out = [];
    for (const { cell, sides } of mod.sol) {
      const t = { ...mod.grid[cell] };
      while (!sides.every((s) => pipeSides(t).includes(s))) { t.rot = (t.rot + 1) % 4; out.push({ op: 'rot', i: cell }); }
    }
    out.push({ op: 'open' });
    return out;
  },
};

/* ------------------------------------------------------------------ Manomètres */
const gauges = {
  gen(rng, bomb, man) {
    const mod = { g: Array.from({ length: 3 }, () => ({ c: rng.int(GAUGE_COLORS.length), v: rng.int(10), set: rng.int(10) })) };
    const want = gauges.expect(mod, bomb, man);
    if (mod.g.every((g, i) => g.set === want[i])) mod.g[0].set = (mod.g[0].set + 3) % 10;
    return mod;
  },
  expect: (mod, bomb, man) => mod.g.map((g) => man.gauges.table[g.c][g.v]),
  act(mod, a, bomb, man) {
    if (a.op === 'knob' && mod.g[a.i]) { mod.g[a.i].set = (mod.g[a.i].set + (a.d > 0 ? 1 : 9)) % 10; return 'ok'; }
    if (a.op !== 'submit') return 'ok';
    const want = gauges.expect(mod, bomb, man);
    return mod.g.every((g, i) => g.set === want[i]) ? 'solved' : 'strike';
  },
  solution(mod, bomb, man) {
    const out = [];
    gauges.expect(mod, bomb, man).forEach((w, i) => { let s = mod.g[i].set; while (s !== w) { out.push({ op: 'knob', i, d: 1 }); s = (s + 1) % 10; } });
    out.push({ op: 'submit' });
    return out;
  },
};

export const MODULES = { wires, safe, switches, chime, pipes, gauges };

/* ------------------------------------------------------------------ la bombe */
// Emplacements : 0-5 face avant (2 rangées × 3), 6-11 face arrière. Le chrono occupe toujours le 1 (avant, en haut au milieu).
export const TIMER_SLOT = 1;
const COUNTS = [2, 3, 5, 7];
const POOLS = [['wires', 'gauges'], ['wires', 'gauges', 'switches', 'safe'], Object.keys(MODULES), Object.keys(MODULES)];

export function makeBomb(rng, man, diff) {
  const d = Math.max(0, Math.min(3, diff | 0));
  const lot = [LOT_LETTERS[rng.int(LOT_LETTERS.length)], rng.int(10), LOT_LETTERS[rng.int(LOT_LETTERS.length)], '-',
    rng.int(10), rng.int(10), LOT_LETTERS[rng.int(LOT_LETTERS.length)]].join('');
  const nStamps = [0, 1, 1, 2, 2, 3][rng.int(6)];
  const stamps = rng.shuffle([...CITIES]).slice(0, nStamps).map((city) => ({ city, ink: INKS[rng.int(2)] }));
  const screwsMissing = [0, 0, 0, 1, 1, 2, 3][rng.int(7)];
  const bomb = { lot, stamps, screwsMissing, modules: [] };

  let types = rng.shuffle([...POOLS[d]]).slice(0, Math.min(COUNTS[d], POOLS[d].length));
  while (types.length < COUNTS[d]) types.push(POOLS[d][rng.int(POOLS[d].length)]);
  const free = rng.shuffle([0, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // au moins un module au dos dès qu'il y en a 3, pour obliger à retourner la bombe
  let slots = free.slice(0, types.length);
  if (types.length >= 3 && !slots.some((s) => s >= 6)) slots[slots.length - 1] = free.find((s) => s >= 6);
  if (types.length <= 2) slots = [0, 2].slice(0, types.length);
  types.forEach((type, k) => bomb.modules.push({ type, slot: slots[k], solved: false, ...MODULES[type].gen(rng, bomb, man, d) }));
  return bomb;
}
