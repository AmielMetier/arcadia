/* Historique des parties et classement entre potes.
   Chaque navigateur garde les parties auxquelles il a participé ; dans un salon, les historiques
   de tous les joueurs sont fusionnés (doublons écartés par identifiant), donc tout le monde voit le même classement.
   Un joueur est reconnu par son identifiant permanent (uid), pas par son pseudo ; les bots par « bot:Nom ». */
(function () {
  const KEY = 'hub_results', MAX = 200;
  const get = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const put = (list) => { try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {} };
  const clean = (s, n) => String(s ?? '').replace(/[<>&"]/g, '').slice(0, n);

  // Validation d'un enregistrement venu du réseau
  function sane(r) {
    if (!r || typeof r !== 'object' || typeof r.id !== 'string' || !Array.isArray(r.players)) return null;
    if (!['david', 'drift'].includes(r.game)) return null;
    const players = r.players.slice(0, 8).map((p) => ({
      key: clean(p.key, 40), name: clean(p.name, 14) || '?', color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#888888',
      bot: !!p.bot, rank: Math.max(1, Math.min(8, p.rank | 0)), score: Number.isFinite(p.score) ? Math.round(p.score) : 0,
    })).filter((p) => p.key);
    if (players.length < 2) return null;
    return { id: clean(r.id, 60), game: r.game, mode: clean(r.mode, 20), at: Number(r.at) || Date.now(), players };
  }

  function merge(list) {
    const all = get(), ids = new Set(all.map((r) => r.id));
    let added = 0;
    for (const raw of list || []) { const r = sane(raw); if (r && !ids.has(r.id)) { all.push(r); ids.add(r.id); added++; } }
    if (added) { all.sort((a, b) => b.at - a.at); put(all.slice(0, MAX)); }
    return added;
  }

  // Agrégats par joueur : parties, victoires, podiums, meilleur score
  function table({ game = 'all', only = null, bots = true } = {}) {
    const rows = new Map();
    for (const r of get()) {
      if (game !== 'all' && r.game !== game) continue;
      for (const p of r.players) {
        if (!bots && p.bot) continue;
        if (only && !only.includes(p.key)) continue;
        let x = rows.get(p.key);
        if (!x) { x = { key: p.key, name: p.name, color: p.color, bot: p.bot, games: 0, wins: 0, podiums: 0, best: 0, last: 0 }; rows.set(p.key, x); }
        x.games++; if (p.rank === 1) x.wins++; if (p.rank <= 3) x.podiums++;
        x.best = Math.max(x.best, p.score || 0);
        if (r.at > x.last) { x.last = r.at; x.name = p.name; x.color = p.color; }
      }
    }
    return [...rows.values()].sort((a, b) => b.wins - a.wins || b.wins / b.games - a.wins / a.games || b.podiums - a.podiums || b.games - a.games);
  }

  window.DDResults = { all: get, merge, table, recent: (n = 10) => get().slice(0, n), clear: () => put([]) };
})();
