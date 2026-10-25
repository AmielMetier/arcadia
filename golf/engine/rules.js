// Birdie Party — règles d'une partie : ordre de jeu, pénalités, balle ramassée, cartes de score, classement.
// Moteur pur et sérialisable : l'hôte tient l'état et le diffuse tel quel aux invités.
//
// Ordre de jeu (comme sur un vrai parcours) : au départ, l'honneur va au meilleur score du trou précédent ;
// ensuite, c'est toujours le joueur le plus loin du drapeau qui joue.
export const MAX_STROKES = 10; // au-delà, la balle est ramassée

export function newRound({ holes, players, seed = 1, wind = 1 }) {
  return {
    v: 1, seed, wind, holes: holes.slice(), hi: 0, phase: 'play', turn: -1, shotNo: 0,
    players: players.map((p, i) => ({ id: p.id, name: p.name, color: p.color, bot: !!p.bot, level: p.level || 'normal', look: p.look || i, order: i, scores: [], ball: null, strokes: 0, done: false, left: false })),
  };
}

// début d'un trou : tout le monde au départ, l'honneur d'abord
export function startHole(R, hole) {
  for (const p of R.players) { p.ball = { x: hole.tee.x, z: hole.tee.z, lie: 'tee' }; p.strokes = 0; p.done = p.left; }
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

// résultat d'un coup du joueur i : res = { kind: rest|holed|water|ob, end:{x,z}, drop:{x,z}, surf }
// lieAt(x, z) donne la surface d'un point de reprise. Renvoie { penalty, holed, pickedUp }.
export function applyShot(R, hole, i, res, lieAt) {
  const p = R.players[i], from = { ...p.ball };
  p.strokes++; R.shotNo++;
  const out = { penalty: 0, holed: false, pickedUp: false };
  if (res.kind === 'holed') { p.done = true; out.holed = true; p.ball = { x: hole.pin.x, z: hole.pin.z, lie: 'green' }; }
  else if (res.kind === 'water') { p.strokes++; out.penalty = 1; p.ball = { x: res.drop.x, z: res.drop.z, lie: lieAt(res.drop.x, res.drop.z) }; }
  else if (res.kind === 'ob') { p.strokes++; out.penalty = 1; p.ball = from; }
  else p.ball = { x: res.end.x, z: res.end.z, lie: res.surf };
  if (!p.done && p.strokes >= MAX_STROKES) { p.done = true; p.strokes = MAX_STROKES; out.pickedUp = true; }
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
  if (hole && R.phase === 'play') R.turn = nextPlayer(R, hole);
}

// Stableford : 2 points pour le par, 1 de plus par coup de moins, 0 au-delà du double bogey
export const stableford = (strokes, par) => (strokes == null ? 0 : Math.max(0, 2 + par - strokes));

export function totals(R, pars) {
  return R.players.map((p) => {
    let strokes = 0, par = 0, pts = 0, played = 0;
    p.scores.forEach((s, k) => { if (s == null) return; strokes += s; par += pars[k]; pts += stableford(s, pars[k]); played++; });
    return { id: p.id, name: p.name, color: p.color, bot: p.bot, strokes, toPar: strokes - par, stableford: pts, played, left: p.left };
  });
}

// classement : le moins de coups gagne (les joueurs partis en cours de route passent derrière) ; ex æquo = même rang
export function ranking(R, pars) {
  const t = totals(R, pars).sort((a, b) => (a.left - b.left) || (b.played - a.played) || (a.strokes - b.strokes));
  let rank = 0, prev = null;
  t.forEach((x, k) => { const key = `${x.left}|${x.played}|${x.strokes}`; if (key !== prev) { rank = k + 1; prev = key; } x.rank = rank; });
  return t;
}
