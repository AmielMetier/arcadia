// Lecture de l'état : propriété des groupes, patrimoine, classement. Aucune modification.

export const isOwnable = (sp) => sp.type === 'street' || sp.type === 'station' || sp.type === 'utility';

export function groupSpaces(board, group) {
  return board.groups[group].spaces;
}

export function ownsGroup(state, board, pid, group) {
  return groupSpaces(board, group).every((i) => state.props[i].owner === pid);
}

// Niveau de construction : 0..housesPerHotel maisons, housesPerHotel + 1 pour un hôtel.
export function level(state, i) {
  const p = state.props[i];
  return p.hotel ? state.cfg.housesPerHotel + 1 : p.houses;
}

export function groupHasBuildings(state, board, group) {
  return groupSpaces(board, group).some((i) => level(state, i) > 0);
}

export function ownedBy(state, board, pid) {
  return board.spaces.filter((sp) => isOwnable(sp) && state.props[sp.i].owner === pid).map((sp) => sp.i);
}

export function monopolies(state, board, pid) {
  return Object.keys(board.groups).filter((g) => g !== 'station' && g !== 'utility' && ownsGroup(state, board, pid, g));
}

// Patrimoine net, calculé comme dans la variante « partie courte » des règles officielles :
// argent + prix des terrains (moitié si hypothéqués) + coût des bâtiments.
export function netWorth(state, board, pid) {
  const pl = state.players.find((p) => p.id === pid);
  let property = 0, buildings = 0, mortgaged = 0;
  for (const i of ownedBy(state, board, pid)) {
    const sp = board.spaces[i], pr = state.props[i];
    if (pr.mortgaged) { property += sp.price / 2; mortgaged++; } else property += sp.price;
    if (sp.type === 'street') {
      buildings += pr.hotel ? sp.houseCost * (state.cfg.housesPerHotel + 1) : pr.houses * sp.houseCost;
    }
  }
  const cash = pl ? pl.cash : 0;
  return {
    cash, property, buildings, mortgaged,
    total: cash + property + buildings,
    monopolies: monopolies(state, board, pid).length,
  };
}

// Classement individuel : joueurs en lice par patrimoine décroissant, puis faillis du dernier au premier éliminé.
function soloStandings(state, board) {
  const alive = state.players.filter((p) => !p.bankrupt)
    .map((p) => ({ id: p.id, ...netWorth(state, board, p.id) }))
    .sort((a, b) => b.total - a.total || b.cash - a.cash);
  const out = state.players.filter((p) => p.bankrupt)
    .sort((a, b) => b.bankruptAt - a.bankruptAt)
    .map((p) => ({ id: p.id, ...netWorth(state, board, p.id) }));
  return [...alive, ...out];
}

/* ------------------------------------------------------------------ équipes (2 contre 2) */
export const teamOf = (state, pid) => {
  if (!state.cfg.teams) return null;
  const p = state.players.find((q) => q.id === pid);
  return p ? p.team : null;
};
export const sameTeam = (state, a, b) => !!state.cfg.teams && a != null && b != null && a !== b && teamOf(state, a) === teamOf(state, b);
export const teammate = (state, pid) => {
  if (!state.cfg.teams) return null;
  const t = teamOf(state, pid);
  return state.players.find((q) => q.id !== pid && q.team === t) || null;
};
export const TEAM_NAMES = ['Équipe A', 'Équipe B'];

// Classement des équipes : équipes encore en lice d'abord (patrimoine cumulé), puis équipe éliminée.
export function teamStandings(state, board) {
  if (!state.cfg.teams) return [];
  const teams = [0, 1].map((t) => {
    const members = state.players.filter((p) => p.team === t);
    const alive = members.filter((p) => !p.bankrupt);
    const total = alive.reduce((n, p) => n + netWorth(state, board, p.id).total, 0);
    const out = Math.max(0, ...members.filter((p) => p.bankrupt).map((p) => p.bankruptAt));
    return { team: t, name: TEAM_NAMES[t], total, alive: alive.length, members: members.map((p) => p.id), out };
  });
  return teams.sort((a, b) => (b.alive > 0) - (a.alive > 0) || b.total - a.total || b.out - a.out);
}

// Classement : en 2 contre 2, les membres de l'équipe en tête d'abord ; sinon classement individuel.
export function standings(state, board) {
  const solo = soloStandings(state, board);
  if (!state.cfg.teams) return solo;
  const order = teamStandings(state, board).map((t) => t.team);
  const rankOf = (id) => order.indexOf(teamOf(state, id));
  return solo.map((r, k) => ({ r, k })).sort((a, b) => rankOf(a.r.id) - rankOf(b.r.id) || a.k - b.k).map((x) => x.r);
}
