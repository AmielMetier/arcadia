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

// Classement : joueurs en lice par patrimoine décroissant, puis faillis du dernier au premier éliminé.
export function standings(state, board) {
  const alive = state.players.filter((p) => !p.bankrupt)
    .map((p) => ({ id: p.id, ...netWorth(state, board, p.id) }))
    .sort((a, b) => b.total - a.total || b.cash - a.cash);
  const out = state.players.filter((p) => p.bankrupt)
    .sort((a, b) => b.bankruptAt - a.bankruptAt)
    .map((p) => ({ id: p.id, ...netWorth(state, board, p.id) }));
  return [...alive, ...out];
}
