// Moteur de Bastion Clash (sans DOM) : chargé par la page et par les outils Node (tools/test-bastion.mjs, tools/bench-bastion.mjs).
// Mode coop « Défense contre des vagues ».
'use strict';

/* ============================================================================
   DÉFENSE CONTRE DES VAGUES
   - Tous les joueurs (et leurs bots alliés) sont dans la même équipe.
   - La Horde, un adversaire sans base, attaque par vagues de plus en plus fortes depuis les bords
     de la carte et le centre. Toutes les 5 vagues, un boss : un Colosse (Thor renforcé).
   - Chaque vague repoussée rapporte une prime de minéraux et de gaz à chaque joueur.
   - Victoire : survivre à la dernière vague. Défaite : toutes les bases tombent.
   ============================================================================ */
const HORDE_ID = 999;
const HORDE_TEAM = 99;
const WAVE_FIRST = 150;      // première vague à 2 min 30 (le temps de s'installer)
const WAVE_GAP = 70;         // puis une vague toutes les 70 s
const WAVE_BOUNTY = { min: 150, gas: 60 };

function setupWaves(state, blitz) {
  state.coop = 'waves';
  state.waves = { n: 0, total: blitz ? 10 : 15, nextAt: blitz ? 100 : WAVE_FIRST, alive: 0, cleared: 0 };
  state.players.push({
    id: HORDE_ID, name: 'La Horde', color: '#7a1020', bot: false, horde: true, team: HORDE_TEAM,
    upgrades: {}, minerals: 0, gas: 0, dead: false, score: 0, nextUnitSeq: 20, ping: 0,
    spawnX: HALF_W, spawnY: HALF_W,
  });
}

// Points d'entrée : milieux des bords de la carte et plateau central
function waveSpawnPoints() {
  const W = WORLD_SIZE, C = HALF_W, m = 150;
  return [[C, m], [C, W - m], [m, C], [W - m, C], [C, C]].map(([x, y]) => nearestLand(x, y));
}

// Composition d'une vague : plus nombreuse et plus lourde à chaque fois
// (taille ajustée au nombre de défenseurs et au niveau choisi pour la partie)
function waveComposition(n, defenders = 2, level = 'normal') {
  const list = [];
  const scale = (0.55 + 0.225 * defenders) * ({ facile: 0.75, normal: 1, expert: 1.25 }[level] || 1);
  const count = Math.max(3, Math.round((4 + n * 2.2) * scale));
  for (let i = 0; i < count; i++) {
    const r = (i * 37 + n * 11) % 100;
    if (n >= 8 && r < 14) list.push('titan');
    else if (n >= 5 && r < 30) list.push(r % 2 ? 'siege' : 'tank');
    else if (n >= 3 && r < 50) list.push('sapper');
    else if (n >= 2 && r < 72) list.push('rocket');
    else list.push('marine');
  }
  if (n % 5 === 0) list.push('boss');
  return list;
}

function spawnWave(state, fx) {
  const w = state.waves;
  w.n++;
  const horde = state.players.find((p) => p.id === HORDE_ID);
  const pts = waveSpawnPoints();
  // Vagues paires : depuis deux bords ; impaires : depuis le centre et un bord
  const from = w.n % 2 ? [pts[4], pts[w.n % 4]] : [pts[w.n % 4], pts[(w.n + 2) % 4]];
  const hpMult = 1 + 0.06 * (w.n - 1);
  const defenders = state.players.filter((p) => !p.horde && !p.dead && !p.spectator).length;
  const comp = waveComposition(w.n, defenders, state.level);
  comp.forEach((kind, i) => {
    const boss = kind === 'boss';
    const k = boss ? 'titan' : kind;
    const def = UNITS[k];
    const at = from[i % from.length];
    const ang = (i / comp.length) * TAU;
    const hp = Math.round(def.hp * hpMult * (boss ? 3.2 : 1));
    const seq = (horde.nextUnitSeq = (horde.nextUnitSeq || 20) + 1);
    state.units.push({
      id: (HORDE_ID + 1) * 10000 + seq, kind: k, owner: HORDE_ID, team: HORDE_TEAM,
      x: clamp(at.x + Math.cos(ang) * 60, 30, WORLD_SIZE - 30), y: clamp(at.y + Math.sin(ang) * 60, 30, WORLD_SIZE - 30),
      vx: 0, vy: 0, a: 0, hp, maxHp: hp, radius: boss ? def.radius * 1.35 : def.radius, cd: 0, mode: 'idle',
      orderX: null, orderY: null, targetEntId: null, harvestId: null, gatherT: 0, carryType: null, carryAmt: 0,
      buildTargetId: null, stimT: 0, sieged: false, flying: false, cargo: [], boardedIn: null, healingTargetId: null,
      boss,
    });
  });
  w.alive = comp.length;
  w.nextAt = state.time + WAVE_GAP + Math.min(40, w.n * 2);
  fx.push({ k: 'WAVE', n: w.n, total: w.total, boss: w.n % 5 === 0, points: from.map((p) => ({ x: p.x, y: p.y })) });
}

// Chaque unité de la Horde fonce sur le bâtiment allié le plus proche
function steerHorde(state) {
  const targets = state.buildings.filter((b) => b.team !== HORDE_TEAM && b.hp > 0);
  if (!targets.length) return;
  for (const u of state.units) {
    if (u.owner !== HORDE_ID || u.hp <= 0) continue;
    if (u.mode === 'amove' && u.orderX != null && state.buildings.some((b) => b.hp > 0 && b.team !== HORDE_TEAM && hypot(b.x, b.y, u.orderX, u.orderY) < 30)) continue;
    let best = null, bd = Infinity;
    for (const b of targets) {
      const d = dist2(u.x, u.y, b.x, b.y);
      if (d < bd) { bd = d; best = b; }
    }
    u.mode = 'amove'; u.orderX = best.x; u.orderY = best.y; u.pathX = best.x; u.pathY = best.y;
  }
}

function stepWaves(state, dt, fx) {
  const w = state.waves;
  if (!w || state.over) return;
  const hordeAlive = state.units.filter((u) => u.owner === HORDE_ID && u.hp > 0).length;
  // Vague repoussée : prime pour chaque joueur encore debout
  if (w.n > w.cleared && hordeAlive === 0) {
    w.cleared = w.n;
    for (const p of state.players) {
      if (p.horde || p.dead) continue;
      p.minerals = Math.min(9999, p.minerals + WAVE_BOUNTY.min);
      p.gas = Math.min(9999, p.gas + WAVE_BOUNTY.gas);
      p.score += 120 + 20 * w.n;
    }
    fx.push({ k: 'WAVE_CLEARED', n: w.n, total: w.total });
    if (w.n >= w.total) {
      state.over = true;
      state.winnerTeam = state.players.find((p) => !p.horde)?.team ?? 0;
      state.ranking = state.players.filter((p) => !p.horde).sort((a, b) => b.score - a.score).map((p) => p.id);
      return;
    }
    // Une vague repoussée vite avance la suivante, pour garder le rythme
    w.nextAt = Math.min(w.nextAt, state.time + 25);
  }
  w.alive = hordeAlive;
  if (w.n < w.total && state.time >= w.nextAt && (w.n === w.cleared || state.time >= w.nextAt + 20)) spawnWave(state, fx);
  if (Math.round(state.time * 30) % 15 === 0) steerHorde(state);
}
