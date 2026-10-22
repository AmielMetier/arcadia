// Déroulé d'une partie de Fil Rouge. Moteur pur : l'hôte l'utilise, les tests aussi.
// Coopération : une équipe, un démineur, les autres lisent le manuel.
// Duel : deux équipes reçoivent la même bombe (même graine) ; la première qui la désamorce gagne.
import { rngOf } from './rng.js';
import { makeManual } from './manual.js';
import { MODULES, makeBomb } from './modules.js';

export const DIFFS = [
  { id: 'initiation', label: 'Initiation', time: 300 },
  { id: 'facile', label: 'Facile', time: 300 },
  { id: 'normal', label: 'Moyen', time: 330 },
  { id: 'expert', label: 'Difficile', time: 390 },
];
export const TEAMS = [
  { name: 'Équipe Corail', color: '#ff5a4e' },
  { name: 'Équipe Lagon', color: '#2fb3d9' },
];
export const INTRO_MS = 3500;
export const SABOTAGES = ['noir', 'fumee', 'secousse', 'encre'];

export function makeConfig(s = {}) {
  const diff = { initiation: 0, facile: 1, normal: 2, expert: 3 }[s.diff] ?? (Number.isInteger(s.diff) ? s.diff : 2);
  return {
    mode: s.mode === 'versus' ? 'versus' : 'coop',
    diff: Math.max(0, Math.min(3, diff)),
    strikes: [1, 3, 5].includes(Number(s.strikes)) ? Number(s.strikes) : 3,
    sabotage: s.sabotage === undefined ? true : !!Number(s.sabotage),
  };
}

export const timeLeft = (team, now) => Math.max(0, team.clock.left - Math.max(0, now - team.clock.at) * team.clock.rate);
export const manualOf = (() => { let last = null; return (edition) => (last && last.edition === edition ? last : (last = makeManual(edition))); })();

// Rôles : chaque équipe a un démineur ; un joueur seul dans son équipe fait les deux (il a aussi le manuel)
export function fixRoles(players, mode) {
  const nTeams = mode === 'versus' ? 2 : 1;
  const out = players.map((p) => ({ ...p, team: Math.max(0, Math.min(nTeams - 1, p.team | 0)), role: p.role === 'defuser' ? 'defuser' : 'expert' }));
  for (let t = 0; t < nTeams; t++) {
    const mem = out.filter((p) => p.team === t);
    const defs = mem.filter((p) => p.role === 'defuser');
    if (mem.length && !defs.length) mem[0].role = 'defuser';
    defs.slice(1).forEach((p) => { p.role = 'expert'; });
  }
  return out;
}
export function teamsReady(players, mode) {
  if (!players.length) return 'Personne dans la partie.';
  if (mode === 'versus') {
    if (players.length < 2) return 'Le duel se joue à 2 joueurs minimum.';
    if (![0, 1].every((t) => players.some((p) => p.team === t))) return 'Chaque équipe doit avoir au moins un joueur.';
  }
  return '';
}

export function createGame({ players, cfg, seed, now }) {
  const ps = fixRoles(players, cfg.mode);
  const err = teamsReady(ps, cfg.mode);
  if (err) throw new Error(err);
  const edition = 1000 + (seed % 9000);
  const man = manualOf(edition);
  const st = { seed };
  const bomb = makeBomb(rngOf(st), man, cfg.diff);
  const nTeams = cfg.mode === 'versus' ? 2 : 1;
  const teams = Array.from({ length: nTeams }, (_, i) => ({
    i, ...TEAMS[i], bomb: structuredClone(bomb), strikes: 0, solved: 0, status: 'live', endedAt: null, left: null,
    clock: { left: DIFFS[cfg.diff].time * 1000, at: now + INTRO_MS, rate: 1 },
  }));
  return { phase: 'play', cfg, seed, edition, players: ps, teams, startedAt: now, n: 0, winner: null, ranking: null };
}

const solo = (state, team) => state.players.filter((p) => p.team === team).length === 1;
export const canSeeManual = (state, id) => { const p = state.players.find((q) => q.id === id); return !!p && (p.role === 'expert' || solo(state, p.team)); };

function finishTeam(state, team, status, now, ev) {
  team.left = timeLeft(team, now);
  team.status = status; team.endedAt = now;
  team.clock = { left: team.left, at: now, rate: 0 };
  ev.push({ k: status, team: team.i });
}

function endCheck(state, now, ev) {
  if (state.phase !== 'play') return;
  const live = state.teams.filter((t) => t.status === 'live');
  const won = state.teams.find((t) => t.status === 'defused');
  // duel : fini dès qu'une équipe a désamorcé ou qu'il ne reste qu'une équipe en vie (l'autre a sauté ou abandonné)
  if (state.cfg.mode === 'versus' ? !won && live.length > 1 : live.length) return;
  for (const t of live) finishTeam(state, t, 'stopped', now, ev);
  state.phase = 'over';
  const rank = { defused: 2, stopped: 1, boom: 0 };
  state.ranking = [...state.teams].sort((a, b) =>
    rank[b.status] - rank[a.status] || (b.status === 'defused' ? b.left - a.left : 0)
    || b.solved - a.solved || a.strikes - b.strikes || (b.endedAt || 0) - (a.endedAt || 0)).map((t) => t.i);
  state.winner = state.teams[state.ranking[0]].status === 'defused' || state.cfg.mode === 'versus' ? state.ranking[0] : null;
  ev.push({ k: 'over' });
}

// Le temps qui passe : une équipe à zéro explose
export function tick(state, now) {
  const ev = [];
  if (state.phase !== 'play') return { state, ev };
  for (const t of state.teams) if (t.status === 'live' && timeLeft(t, now) <= 0) finishTeam(state, t, 'boom', now, ev);
  endCheck(state, now, ev);
  return { state, ev };
}

// Une manipulation du démineur sur un module : { by, m, op, i, d, now }
export function act(state0, a) {
  const state = structuredClone(state0), now = a.now, ev = [];
  if (state.phase !== 'play') return { ok: false, error: 'La partie est terminée.' };
  const p = state.players.find((q) => q.id === a.by);
  if (!p) return { ok: false, error: 'Tu ne joues pas dans cette partie.' };
  if (p.role !== 'defuser') return { ok: false, error: 'Seul le démineur touche à la bombe.' };
  const team = state.teams[p.team];
  tick(state, now).ev.forEach((e) => ev.push(e));
  if (team.status !== 'live') return { ok: true, state, ev };
  if (now < team.clock.at) return { ok: false, error: 'Attends le top départ !', soft: true };
  const mod = team.bomb.modules[a.m];
  if (!mod || mod.solved) return { ok: false, error: 'Module déjà désamorcé.', soft: true };
  const man = manualOf(state.edition);
  const r = MODULES[mod.type].act(mod, { op: String(a.op), i: Number(a.i), d: Number(a.d) }, team.bomb, man);
  state.n++;
  if (r === 'strike') {
    team.clock = { left: timeLeft(team, now), at: now, rate: 1 + 0.25 * (team.strikes + 1) };
    team.strikes++;
    ev.push({ k: 'strike', team: team.i, m: a.m });
    if (team.strikes >= state.cfg.strikes) finishTeam(state, team, 'boom', now, ev);
  } else if (r === 'solved') {
    mod.solved = true; team.solved++;
    ev.push({ k: 'solve', team: team.i, m: a.m });
    if (team.bomb.modules.every((x) => x.solved)) finishTeam(state, team, 'defused', now, ev);
    else if (state.cfg.mode === 'versus' && state.cfg.sabotage) {
      const other = state.teams.find((t) => t.i !== team.i && t.status === 'live');
      if (other) ev.push({ k: 'sab', team: other.i, from: team.i, kind: SABOTAGES[(state.n + a.m) % SABOTAGES.length] });
    }
  } else ev.push({ k: 'act', team: team.i, m: a.m });
  endCheck(state, now, ev);
  return { ok: true, state, ev, result: r };
}

// Un joueur a quitté le salon : son équipe désigne un autre démineur, ou abandonne si elle est vide
export function dropPlayer(state0, id, now) {
  const state = structuredClone(state0), ev = [];
  const p = state.players.find((q) => q.id === id);
  if (!p || state.phase !== 'play') return { state, ev };
  state.players = state.players.filter((q) => q.id !== id);
  const team = state.teams[p.team];
  const mates = state.players.filter((q) => q.team === p.team);
  if (!mates.length) { if (team.status === 'live') finishTeam(state, team, 'boom', now, ev); }
  else if (p.role === 'defuser') { mates[0].role = 'defuser'; ev.push({ k: 'promote', team: team.i, id: mates[0].id }); }
  endCheck(state, now, ev);
  return { state, ev };
}

// Reprise par un nouvel hôte : les chronos sont recalés sur son horloge
export function rebase(state0, offset) {
  const state = structuredClone(state0);
  for (const t of state.teams) t.clock.at -= offset;
  return state;
}

// Pour les tests : toutes les actions qui désamorcent la bombe d'une équipe
export function solutionOf(state, team) {
  const t = state.teams[team], man = manualOf(state.edition);
  return t.bomb.modules.flatMap((mod, m) => MODULES[mod.type].solution(structuredClone(mod), t.bomb, man).map((a) => ({ m, ...a })));
}
