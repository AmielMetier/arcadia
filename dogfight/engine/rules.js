// Règles de Dogfight 3D : joueurs et équipes, phases, dégâts localisés, réapparitions, victoire,
// et état compact pour le réseau. Moteur pur : l'état est un objet simple, qu'un nouvel hôte peut reprendre.
import { createFlight, stepFlight, computeAxes, TYPES, CENTER } from './flight.js';
import { stepGun, stepBullets, stepLock, launchMissile, stepMissiles, MISSILE_DAMAGE, FLARE_COOLDOWN, FLARE_TIME } from './weapons.js';
import { botInput } from './ai.js';

export const DT = 1 / 60;
export const COLORS = ['#3f7fe8', '#e0483c', '#2fa866', '#e29a2b', '#9a5be0', '#21a8c4'];
export const TEAM_COLORS = { 1: '#4f8dff', 2: '#ff5a4d' };
export const RESPAWN_DELAY = 4;
export const INVULNERABLE_TIME = 2.5;
export const COUNTDOWN = 3;
const ZONE_MULT = { C: 1, E: 1.25, T: 1, L: 0.9, R: 0.9 };
const ZONE_WEAR = 1 / 38;    // une zone est hors d'usage après ~38 points de dégâts
const ASSIST_TIME = 6;       // qui a touché juste avant un crash marque le point

export const blankInput = () => ({ p: 0, r: 0, y: 0, boost: false, brake: false, fire: false, msl: false, flare: false, free: false, lim: 1 });

function spawnPose(idx, total, world, ring = 900) {
  const a = (idx / Math.max(1, total)) * Math.PI * 2 + 0.4, x = CENTER + Math.cos(a) * ring, z = CENTER + Math.sin(a) * ring;
  const h = world ? world.obstacleAt(x, z) : 0;
  return { x, y: Math.max(h + 130, 230 + (idx % 3) * 35), z, heading: Math.atan2(CENTER - x, CENTER - z) };
}

function makePlane(p, idx, total, world, settings) {
  const T = TYPES[p.type] ? p.type : 'f16', stats = TYPES[T];
  const f = createFlight({ ...spawnPose(idx, total, world), type: T });
  return Object.assign(f, {
    id: p.id, name: p.name || `Pilote ${idx + 1}`, color: p.color || COLORS[idx % COLORS.length], bot: !!p.bot, lvl: p.lvl || settings.level || 'normal', team: p.team || 0,
    health: stats.hp, maxHp: stats.hp, kills: 0, deaths: 0, alive: true, respawn: 0, inv: INVULNERABLE_TIME,
    heat: 0, over: false, overT: 0, firing: false, fireAcc: 0, ms: stats.missiles, msCd: 0, fl: stats.flares, flCd: 0, flT: 0, lockId: null, lockT: 0, warn: false,
    lastHitBy: null, lastHitT: 0, ack: 0, inp: blankInput(), ready: !!p.bot,
  });
}

export function assignTeams(players, mode) {
  if (mode !== 'equipes') { players.forEach((p) => { p.team = 0; }); return players; }
  // les humains d'abord, en alternance, puis les bots comblent
  const humans = players.filter((p) => !p.bot), bots = players.filter((p) => p.bot);
  let a = 0, b = 0;
  for (const p of [...humans, ...bots]) { if (a <= b) { p.team = 1; a++; } else { p.team = 2; b++; } }
  return players;
}

export function createGame({ settings = {}, players = [], world = null } = {}) {
  const mode = settings.mode === 'equipes' ? 'equipes' : 'chacun';
  assignTeams(players, mode);
  const g = {
    settings: { target: Number(settings.kills || 8), time: Number(settings.time || 300), level: settings.level || 'normal', mode },
    ph: 'hangar', t: 0, left: Number(settings.time || 300), clock: 0, tk: { 1: 0, 2: 0 }, winner: null, winTeam: 0,
    planes: [], bullets: [], missiles: [], events: [], rev: 1,
  };
  g.planes = players.map((p, i) => makePlane(p, i, players.length, world, g.settings));
  return g;
}

export function startCountdown(g, world) {
  g.ph = 'countdown'; g.t = COUNTDOWN; g.rev++;
  g.planes.forEach((p, i) => { const type = p.type; Object.assign(p, createFlight({ ...spawnPose(i, g.planes.length, world), type }), { ...repaired(p), alive: true, inv: INVULNERABLE_TIME + COUNTDOWN }); });
  g.events.push({ e: 'count' });
}

function repaired(p) { const T = TYPES[p.type] || TYPES.f16; return { health: T.hp, maxHp: T.hp, ms: T.missiles, fl: T.flares, msCd: 0, flCd: 0, flT: 0, heat: 0, over: false, overT: 0, lockId: null, lockT: 0, warn: false, lastHitBy: null, dE: 0, dL: 0, dR: 0, dT: 0, inp: p.bot ? blankInput() : p.inp, ai: null }; }

export function addPlayer(g, p, world) {
  if (g.planes.some((q) => q.id === p.id)) return;
  if (g.settings.mode === 'equipes') { const a = g.planes.filter((q) => q.team === 1).length, b = g.planes.filter((q) => q.team === 2).length; p.team = a <= b ? 1 : 2; } else p.team = 0;
  const q = makePlane(p, g.planes.length, g.planes.length + 1, world, g.settings);
  q.inv = INVULNERABLE_TIME;
  g.planes.push(q); g.rev++;
}

// Un joueur part : un bot reprend son avion et son score
export function replaceByBot(g, id) {
  const p = g.planes.find((q) => q.id === id);
  if (!p || p.bot) return;
  p.bot = true; p.ai = null; p.lvl = g.settings.level; p.inp = blankInput(); g.rev++;
  g.events.push({ e: 'left', name: p.name });
}

function kill(g, victim, killer, cause, world) {
  if (!victim.alive) return;
  victim.alive = false; victim.deaths++; victim.respawn = RESPAWN_DELAY; victim.firing = false; g.rev++;
  victim.killedBy = killer && killer.id !== victim.id ? killer.name : null;
  victim.deathCause = cause;
  const at = { x: Math.round(victim.x), y: Math.round(victim.y), z: Math.round(victim.z) };
  if (killer && killer.id !== victim.id && !(killer.team && killer.team === victim.team)) {
    killer.kills++;
    if (killer.team) g.tk[killer.team]++;
    g.events.push({ e: 'kill', by: killer.id, byName: killer.name, id: victim.id, name: victim.name, cause, ...at });
    const reached = killer.team ? g.tk[killer.team] >= g.settings.target : killer.kills >= g.settings.target;
    if (reached) finish(g);
  } else g.events.push({ e: 'crash', id: victim.id, name: victim.name, cause, ...at });
}

function finish(g) {
  if (g.ph === 'over') return;
  g.ph = 'over'; g.t = 0; g.rev++;
  const best = ranking(g)[0];
  if (g.settings.mode === 'equipes') {
    g.winTeam = g.tk[1] > g.tk[2] ? 1 : g.tk[2] > g.tk[1] ? 2 : 0;
    g.winner = null;
  } else {
    // personne n'a marqué, ou égalité parfaite : match nul
    const second = ranking(g)[1];
    g.winner = best && best.kills > 0 && !(second && second.kills === best.kills && second.deaths === best.deaths) ? best.id : null;
  }
  g.events.push({ e: 'over', winner: g.winner, winTeam: g.winTeam });
}

export function ranking(g) {
  const score = (p) => (g.settings.mode === 'equipes' && p.team === g.winTeam ? 1000 : 0) + p.kills * 10 - p.deaths * 0.01;
  return [...g.planes].sort((a, b) => score(b) - score(a));
}

function respawn(g, p, world) {
  const a = Math.random() * Math.PI * 2, r = 650 + Math.random() * 450, x = CENTER + Math.cos(a) * r, z = CENTER + Math.sin(a) * r;
  const y = Math.max(world ? world.obstacleAt(x, z) + 150 : 150, 250 + Math.random() * 90);
  Object.assign(p, createFlight({ x, y, z, heading: Math.atan2(CENTER - x, CENTER - z), type: p.type }), repaired(p), { alive: true, inv: INVULNERABLE_TIME, killedBy: null, deathCause: null });
  g.rev++;
  g.events.push({ e: 'respawn', id: p.id });
}

function damage(g, victim, by, dmg, zone, world) {
  if (!victim.alive || victim.inv > 0) return;
  victim.health -= dmg * (ZONE_MULT[zone] || 1);
  victim.lastHitBy = by; victim.lastHitT = g.clock;
  if (zone === 'E') victim.dE = Math.min(1, victim.dE + dmg * ZONE_WEAR);
  else if (zone === 'T') victim.dT = Math.min(1, victim.dT + dmg * ZONE_WEAR);
  else if (zone === 'L') victim.dL = Math.min(1, victim.dL + dmg * ZONE_WEAR);
  else if (zone === 'R') victim.dR = Math.min(1, victim.dR + dmg * ZONE_WEAR);
  if (victim.health <= 0) { victim.health = 0; kill(g, victim, g.planes.find((q) => q.id === by), 'tir', world); }
}

export function stepGame(g, dt, world) {
  g.clock += dt;
  if (g.ph === 'hangar' || g.ph === 'over') {
    if (g.ph === 'over') g.t += dt;
    return;
  }
  if (g.ph === 'countdown') {
    g.t -= dt;
    // l'instructeur amène chacun vers l'île pendant le décompte
    for (const p of g.planes) { const n = Math.hypot(CENTER - p.x, CENTER - p.z) || 1; stepFlight(p, { ax: (CENTER - p.x) / n, ay: 0, az: (CENTER - p.z) / n }, dt); }
    if (g.t <= 0) { g.ph = 'play'; g.rev++; g.events.push({ e: 'start' }); for (const p of g.planes) p.inv = Math.min(p.inv, INVULNERABLE_TIME); }
    return;
  }

  g.left -= dt;
  if (g.left <= 0) { g.left = 0; finish(g); return; }

  for (const p of g.planes) {
    if (!p.alive) { p.respawn -= dt; if (p.respawn <= 0) respawn(g, p, world); continue; }
    if (p.inv > 0) p.inv -= dt;
    if (p.msCd > 0) p.msCd -= dt;
    if (p.flCd > 0) p.flCd -= dt;
    if (p.flT > 0) p.flT -= dt;
    if (p.bot) p.inp = botInput(p, g, world, dt);
    stepFlight(p, p.inp, dt);
    // sol, mer ou toit : crash (le point va à celui qui l'a touché juste avant)
    if (world && p.y <= world.obstacleAt(p.x, p.z) + 2.5) {
      const hitter = p.lastHitBy !== null && g.clock - p.lastHitT < ASSIST_TIME ? g.planes.find((q) => q.id === p.lastHitBy) : null;
      kill(g, p, hitter, hitter ? 'force' : (world.groundAt(p.x, p.z) < 0.5 ? 'mer' : 'sol'), world);
      if (g.ph === 'over') return;
      continue;
    }
  }

  // collisions entre avions
  for (let i = 0; i < g.planes.length; i++) for (let j = i + 1; j < g.planes.length; j++) {
    const a = g.planes[i], b = g.planes[j];
    if (!a.alive || !b.alive || a.inv > 0 || b.inv > 0) continue;
    if ((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2 < 25) { kill(g, a, null, 'collision', world); kill(g, b, null, 'collision', world); }
  }

  for (const p of g.planes) {
    if (!p.alive) { p.firing = false; continue; }
    stepLock(p, g.planes, world, dt);
    stepGun(p, p.inp.fire && g.ph === 'play', dt, g.bullets, g.events);
    if (p.inp.msl) launchMissile(p, g.missiles, g.events);
    if (p.inp.flare && p.fl > 0 && p.flCd <= 0) { p.fl--; p.flCd = FLARE_COOLDOWN; p.flT = FLARE_TIME; g.events.push({ e: 'flare', id: p.id, x: Math.round(p.x), y: Math.round(p.y), z: Math.round(p.z) }); }
    if (!p.bot) { p.inp.msl = false; p.inp.flare = false; }
    if (g.ph !== 'play') return;
  }

  stepBullets(g.bullets, g.planes, world, dt, (t, zone, b, at) => {
    g.events.push({ e: 'hit', by: b.by, id: t.id, zone, x: Math.round(at.x), y: Math.round(at.y), z: Math.round(at.z) });
    damage(g, t, b.by, b.dmg, zone, world);
  }, g.events);
  stepMissiles(g.missiles, g.planes, world, dt, (t, m) => {
    g.events.push({ e: 'hit', by: m.by, id: t.id, zone: 'C', msl: 1, x: Math.round(t.x), y: Math.round(t.y), z: Math.round(t.z) });
    for (const z of ['E', 'T', 'L', 'R']) if (Math.random() < 0.5) damage(g, t, m.by, 0, z, world), t['d' + z] = Math.min(1, t['d' + z] + 0.35);
    damage(g, t, m.by, MISSILE_DAMAGE, 'C', world);
  }, g.events);
}

export function drainEvents(g) { const e = g.events; g.events = []; return e; }

// ---------------------------------------------------------------- réseau
const q4 = (v) => Math.round(v * 1e4);
const d1 = (v) => Math.round(v * 10) / 10;

// Ligne compacte d'un avion, envoyée vingt fois par seconde
export function snapRows(g) {
  return g.planes.map((p) => [p.id, d1(p.x), d1(p.y), d1(p.z), q4(p.qx), q4(p.qy), q4(p.qz), q4(p.qw), d1(p.speed), Math.round(p.health), flagsOf(p), p.ack, Math.round(p.ab * 100), Math.round(p.heat * 100), Math.round(p.lockT * 100), p.lockId, Math.round(p.load)]);
}
const flagsOf = (p) => (p.alive ? 1 : 0) | (p.boosting ? 2 : 0) | (p.braking ? 4 : 0) | (p.firing ? 8 : 0) | (p.over ? 16 : 0) | (p.warn ? 32 : 0) | (p.inv > 0 ? 64 : 0) | (p.abOut ? 128 : 0);

export function applyRow(p, r) {
  p.x = r[1]; p.y = r[2]; p.z = r[3]; p.qx = r[4] / 1e4; p.qy = r[5] / 1e4; p.qz = r[6] / 1e4; p.qw = r[7] / 1e4; p.speed = r[8]; p.health = r[9];
  const f = r[10]; p.alive = !!(f & 1); p.boosting = !!(f & 2); p.braking = !!(f & 4); p.firing = !!(f & 8); p.over = !!(f & 16); p.warn = !!(f & 32); p.inv = f & 64 ? 1 : 0; p.abOut = !!(f & 128);
  p.ack = r[11]; p.ab = r[12] / 100; p.heat = r[13] / 100; p.lockT = r[14] / 100; p.lockId = r[15]; p.load = r[16];
  const n = 1 / (Math.hypot(p.qx, p.qy, p.qz, p.qw) || 1); p.qx *= n; p.qy *= n; p.qz *= n; p.qw *= n;
  return computeAxes(p);
}

// Missiles en vol
export const snapMissiles = (g) => g.missiles.map((m) => [m.key, d1(m.x), d1(m.y), d1(m.z), m.target]);

// L'état lent : ce qui change rarement, envoyé à chaque changement et une fois par seconde
export function worldOf(g) {
  return {
    settings: g.settings, ph: g.ph, t: d1(g.t), left: d1(g.left), clock: d1(g.clock), tk: g.tk, winner: g.winner, winTeam: g.winTeam, rev: g.rev,
    pl: g.planes.map((p) => ({ id: p.id, name: p.name, color: p.color, bot: p.bot, lvl: p.lvl, team: p.team, type: p.type, kills: p.kills, deaths: p.deaths, respawn: d1(p.respawn), maxHp: p.maxHp, ms: p.ms, fl: p.fl, dE: d1(p.dE), dL: d1(p.dL), dR: d1(p.dR), dT: d1(p.dT), killedBy: p.killedBy || null, deathCause: p.deathCause || null, ready: !!p.ready })),
  };
}

// Reprise par un nouvel hôte à partir du dernier état reçu
export function restoreGame(w, rows, world) {
  const g = { settings: w.settings, ph: w.ph, t: w.t, left: w.left, clock: w.clock, tk: w.tk, winner: w.winner, winTeam: w.winTeam, rev: (w.rev || 1) + 1, planes: [], bullets: [], missiles: [], events: [] };
  const byId = new Map((rows || []).map((r) => [r[0], r]));
  w.pl.forEach((s, i) => {
    const p = makePlane(s, i, w.pl.length, world, g.settings);
    p.team = s.team; p.kills = s.kills; p.deaths = s.deaths; p.respawn = s.respawn; p.maxHp = s.maxHp; p.ms = s.ms; p.fl = s.fl; p.dE = s.dE; p.dL = s.dL; p.dR = s.dR; p.dT = s.dT; p.ready = s.ready;
    const r = byId.get(s.id);
    if (r) { applyRow(p, r); p.ack = 0; p.firing = false; }
    g.planes.push(p);
  });
  return g;
}
