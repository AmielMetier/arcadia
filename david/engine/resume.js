// Reprise d'une partie sauvegardée : les joueurs de la nouvelle session du salon n'ont pas les mêmes
// numéros. On renumérote donc tous les identifiants de l'état d'un coup, à partir d'une table de correspondance.

// map : { ancienId: { id: nouvelId, bot?: boolean, name?, color? } } — doit couvrir tous les joueurs.
export function remapPlayers(state, map) {
  const s = structuredClone(state);
  const m = (id) => (id == null ? id : map[id] ? map[id].id : id);
  const ids = s.players.map((p) => map[p.id] && map[p.id].id);
  if (new Set(ids).size !== ids.length || ids.some((x) => x == null)) throw new Error('Correspondance des joueurs incomplète ou en double.');
  for (const p of s.players) {
    const t = map[p.id];
    p.id = t.id;
    if (t.bot != null) { p.bot = !!t.bot; p.human = !t.bot; }
    if (t.name) p.name = t.name;
    if (t.color) p.color = t.color;
  }
  for (const k of Object.keys(s.props)) s.props[k].owner = m(s.props[k].owner);
  for (const k of Object.keys(s.heldCards)) s.heldCards[k] = m(s.heldCards[k]);
  for (const t of s.trades) { t.from = m(t.from); t.to = m(t.to); }
  for (const d of s.debts) { d.from = m(d.from); d.to = m(d.to); }
  if (s.auction) {
    s.auction.bidder = m(s.auction.bidder);
    s.auction.active = s.auction.active.map(m);
    s.auction.passed = s.auction.passed.map(m);
  }
  const rekey = (obj) => { if (!obj) return obj; const o = {}; for (const k of Object.keys(obj)) o[m(+k)] = obj[k]; return o; };
  s.stats.players = rekey(s.stats.players);
  for (const h of s.stats.history) { h.worth = rekey(h.worth); if (h.cash) h.cash = rekey(h.cash); }
  if (s.winner != null) s.winner = m(s.winner);
  if (s.ranking) s.ranking = s.ranking.map(m);
  return s;
}

// Prépare l'état pour reprendre à l'instant `now` : décale les horloges (chrono Express) de la durée de la pause.
export function resumeAt(state, savedAt, now) {
  const s = structuredClone(state);
  const pause = Math.max(0, now - savedAt);
  if (s.endsAt) s.endsAt += pause;
  if (s.startedAt) s.startedAt += pause;
  return s;
}

// Associe les joueurs humains de la sauvegarde aux joueurs présents dans le salon :
// d'abord par nom (sans tenir compte des majuscules), puis dans l'ordre ; les autres deviennent des bots.
export function proposeMapping(savedPlayers, room) {
  const free = [...room];
  const out = {};
  const norm = (x) => String(x || '').trim().toLowerCase();
  const humans = savedPlayers.filter((p) => !p.bot);
  for (const p of humans) {
    const k = free.findIndex((r) => norm(r.name) === norm(p.name));
    if (k >= 0) { out[p.id] = { id: free[k].id, bot: false, name: free[k].name, color: free[k].color }; free.splice(k, 1); }
  }
  for (const p of humans) if (!out[p.id] && free.length) { const r = free.shift(); out[p.id] = { id: r.id, bot: false, name: r.name, color: r.color }; }
  // bots (anciens bots et humains absents) : identifiants libres à partir de 100
  const used = new Set(Object.values(out).map((x) => x.id));
  let next = 100;
  for (const p of savedPlayers) {
    if (out[p.id]) continue;
    while (used.has(next)) next++;
    out[p.id] = { id: next, bot: true }; used.add(next);
  }
  return out;
}
