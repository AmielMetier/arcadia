// Sauvegardes de parties, chez l'hôte (localStorage). Mises à jour après chaque action, retirées en fin de partie.
const KEY = 'david_saves', MAX = 6;

function read() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
function write(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch (e) {
    // quota dépassé : on ne garde que la sauvegarde la plus récente
    const newest = Object.values(all).sort((a, b) => b.at - a.at)[0];
    try { localStorage.setItem(KEY, JSON.stringify(newest ? { [newest.id]: newest } : {})); } catch (e2) {}
    return false;
  }
}

export const saves = {
  list() {
    return Object.values(read()).sort((a, b) => b.at - a.at).map((s) => ({
      id: s.id, at: s.at, mode: s.state.mode, round: s.state.round,
      players: s.state.players.map((p) => ({ name: p.name, bot: p.bot, token: p.token, color: p.color, bankrupt: p.bankrupt })),
    }));
  },
  get(id) { return read()[id] || null; },
  put(state) {
    if (!state || !state.gid) return;
    const all = read();
    if (state.over) { delete all[state.gid]; write(all); return; }
    all[state.gid] = { id: state.gid, at: Date.now(), state };
    const ids = Object.values(all).sort((a, b) => b.at - a.at).map((s) => s.id);
    for (const id of ids.slice(MAX)) delete all[id];
    write(all);
  },
  remove(id) { const all = read(); delete all[id]; write(all); },
};
