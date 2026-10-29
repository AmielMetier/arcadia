// Birdie Party — règles d'une partie : ordre de jeu, pénalités, balle ramassée, cartes de score, classement.
// Moteur pur et sérialisable : l'hôte tient l'état et le diffuse tel quel aux invités.
//
// Ordre de jeu (comme sur un vrai parcours) : au départ, l'honneur va au meilleur score du trou précédent ;
// ensuite, c'est toujours le joueur le plus loin du drapeau qui joue.
//
// En équipes (scramble) : chaque coéquipier joue depuis la balle de l'équipe ; une fois que tous ont joué (ou dès
// que l'un d'eux a rentré la balle), on garde la meilleure, toute l'équipe repart de là, et l'équipe compte un coup.
export const MAX_STROKES = 10; // au-delà, la balle est ramassée
// sur les très longs trous (par 6 et plus), on laisse un peu plus de marge : par + 5
export const maxStrokes = (par) => Math.max(MAX_STROKES, (par | 0) + 5);

// teams : [{ name, color }] ; chaque joueur porte l'indice de son équipe (team)
export function newRound({ holes, players, seed = 1, wind = 1, teams = null }) {
  return {
    v: 1, seed, wind, holes: holes.slice(), hi: 0, phase: 'play', turn: -1, shotNo: 0, teams: teams ? teams.map((t) => ({ name: t.name, color: t.color })) : null,
    players: players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot, level: p.level || 'normal', look: p.look || i, order: i, team: p.team ?? -1, scores: [], ball: null, strokes: 0, done: false, left: false, played: false, pending: null })),
  };
}

// début d'un trou : tout le monde au départ, l'honneur d'abord
export function startHole(R, hole) {
  for (const p of R.players) { p.ball = { x: hole.tee.x, z: hole.tee.z, lie: 'tee' }; p.strokes = 0; p.done = p.left; p.played = false; p.pending = null; }
  R.phase = 'play';
  R.turn = nextPlayer(R, hole);
  return R;
}

const honorKey = (R, p) => {
  // somme des derniers scores, du plus récent au plus ancien : départage à la mode golf
  const k = []; for (let i = R.hi - 1; i >= 0; i--) k.push(p.scores[i] ?? 99);
  return k;
};

export function nextPlayer(R, hole) {
  if (R.teams) return nextTeamPlayer(R, hole);
  const live = R.players.map((p, i) => ({ p, i })).filter(({ p }) => !p.done && !p.left);
  if (!live.length) return -1;
  const atTee = live.filter(({ p }) => p.strokes === 0);
  if (atTee.length) {
    atTee.sort((a, b) => {
      const ka = honorKey(R, a.p), kb = honorKey(R, b.p);
      for (let j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return ka[j] - kb[j];
      return a.p.order - b.p.order;
    });
    return atTee[0].i;
  }
  let best = live[0], bd = -1;
  for (const e of live) { const d = Math.hypot(hole.pin.x - e.p.ball.x, hole.pin.z - e.p.ball.z); if (d > bd + 1e-6) { bd = d; best = e; } }
  return best.i;
}

// équipes : une équipe qui a commencé sa volée la termine ; sinon l'honneur au départ, puis la plus loin du drapeau
const mates = (R, k) => R.players.map((p, i) => ({ p, i })).filter(({ p }) => p.team === k && !p.left);
function nextTeamPlayer(R, hole) {
  const teams = R.teams.map((t, k) => mates(R, k)).filter((m) => m.length && !m[0].p.done);
  if (!teams.length) return -1;
  const first = (m) => m.filter(({ p }) => !p.played).sort((a, b) => a.p.order - b.p.order)[0].i;
  const mid = teams.find((m) => m.some(({ p }) => p.played));
  if (mid) return first(mid);
  const atTee = teams.filter((m) => m[0].p.strokes === 0);
  if (atTee.length) {
    atTee.sort((a, b) => {
      const ka = honorKey(R, a[0].p), kb = honorKey(R, b[0].p);
      for (let j = 0; j < ka.length; j++) if (ka[j] !== kb[j]) return ka[j] - kb[j];
      return a[0].p.team - b[0].p.team;
    });
    return first(atTee[0]);
  }
  let best = teams[0], bd = -1;
  for (const m of teams) { const b = m[0].p.ball, d = Math.hypot(hole.pin.x - b.x, hole.pin.z - b.z); if (d > bd + 1e-6) { bd = d; best = m; } }
  return first(best);
}

// la volée d'une équipe est finie : on garde la meilleure balle (dans le trou, puis la plus près du drapeau, sans
// pénalité et hors du sable si possible) ; toute l'équipe repart de là. Renvoie l'indice du joueur retenu.
const LIE_COST = { bunker: 14, beach: 14, rough: 5, desert: 7 };
function resolveTeam(R, hole, k, out) {
  const m = mates(R, k).filter(({ p }) => p.pending);
  if (!m.length) return -1;
  let best = null, bk = Infinity;
  for (const e of m) {
    const r = e.p.pending;
    const key = r.holed ? -1 : (r.pen ? 1000 : 0) + Math.hypot(hole.pin.x - r.ball.x, hole.pin.z - r.ball.z) + (LIE_COST[r.ball.lie] || 0);
    if (key < bk) { bk = key; best = e; }
  }
  const r = best.p.pending, strokes = m[0].p.strokes + 1 + (r.holed ? 0 : r.pen);
  for (const { p } of mates(R, k)) {
    p.strokes = strokes; p.played = false; p.pending = null;
    if (r.holed) { p.done = true; p.ball = { x: hole.pin.x, z: hole.pin.z, lie: 'green' }; }
    else p.ball = { ...r.ball };
    if (!p.done && p.strokes >= maxStrokes(hole.par)) { p.done = true; p.strokes = maxStrokes(hole.par); out.pickedUp = true; }
  }
  out.best = best.i; out.resolved = true; out.holed = r.holed;
  return best.i;
}

// résultat d'un coup du joueur i : res = { kind: rest|holed|water|ob, end:{x,z}, surf }
// À l'eau ou hors limites : un coup de pénalité, et on rejoue du même endroit.
// Renvoie { penalty, holed, pickedUp } (+ best en équipes).
export function applyShot(R, hole, i, res) {
  const p = R.players[i], from = { ...p.ball };
  if (R.teams && p.team >= 0) {
    // scramble : le coup est noté, la balle de l'équipe ne bouge qu'à la fin de la volée
    R.shotNo++; p.played = true;
    const out = { penalty: 0, holed: false, pickedUp: false, team: true };
    let ball = null, pen = 0;
    if (res.kind === 'water' || res.kind === 'ob') { pen = 1; ball = from; }
    else if (res.kind !== 'holed') ball = { x: res.end.x, z: res.end.z, lie: res.surf };
    p.pending = { holed: res.kind === 'holed', pen, ball };
    out.penalty = pen;
    if (res.kind === 'holed' || mates(R, p.team).every(({ p: q }) => q.played)) resolveTeam(R, hole, p.team, out);
    R.turn = nextPlayer(R, hole);
    return out;
  }
  p.strokes++; R.shotNo++;
  const out = { penalty: 0, holed: false, pickedUp: false };
  if (res.kind === 'holed') { p.done = true; out.holed = true; p.ball = { x: hole.pin.x, z: hole.pin.z, lie: 'green' }; }
  else if (res.kind === 'water' || res.kind === 'ob') { p.strokes++; out.penalty = 1; p.ball = from; } // on rejoue du même endroit
  else p.ball = { x: res.end.x, z: res.end.z, lie: res.surf };
  const cap = maxStrokes(hole.par);
  if (!p.done && p.strokes >= cap) { p.done = true; p.strokes = cap; out.pickedUp = true; }
  R.turn = nextPlayer(R, hole);
  return out;
}

export const holeOver = (R) => R.players.every((p) => p.done || p.left);

// fin du trou : les scores sont inscrits, on passe au suivant ou la partie se termine
export function finishHole(R) {
  for (const p of R.players) p.scores[R.hi] = p.left ? null : p.strokes;
  R.hi++;
  R.phase = R.hi >= R.holes.length ? 'over' : 'play';
  R.turn = -1;
  return R;
}

// un joueur quitte la partie : il ne joue plus, ses scores restent
export function leave(R, hole, id) {
  const p = R.players.find((q) => q.id === id); if (!p) return;
  p.left = true; p.done = true;
  // en équipes : si ses coéquipiers avaient tous joué, la volée se termine sans lui
  if (R.teams && p.team >= 0 && hole && R.phase === 'play') {
    const m = mates(R, p.team);
    if (m.length && m.every(({ p: q }) => q.played)) resolveTeam(R, hole, p.team, {});
  }
  if (hole && R.phase === 'play') R.turn = nextPlayer(R, hole);
}

// Stableford : 2 points pour le par, 1 de plus par coup de moins, 0 au-delà du double bogey
export const stableford = (strokes, par) => (strokes == null ? 0 : Math.max(0, 2 + par - strokes));

export function totals(R, pars) {
  return R.players.map((p) => {
    let strokes = 0, par = 0, pts = 0, played = 0;
    p.scores.forEach((s, k) => { if (s == null) return; strokes += s; par += pars[k]; pts += stableford(s, pars[k]); played++; });
    return { id: p.id, name: p.name, color: p.color, bot: p.bot, team: p.team, strokes, toPar: strokes - par, stableford: pts, played, left: p.left };
  });
}

// classement : le moins de coups gagne (les joueurs partis en cours de route passent derrière) ; ex æquo = même rang
export function ranking(R, pars) {
  const t = totals(R, pars).sort((a, b) => (a.left - b.left) || (b.played - a.played) || (a.strokes - b.strokes));
  let rank = 0, prev = null;
  t.forEach((x, k) => { const key = `${x.left}|${x.played}|${x.strokes}`; if (key !== prev) { rank = k + 1; prev = key; } x.rank = rank; });
  return t;
}
