// Island Rush — le journal des parties. L'hôte (ou le joueur seul) voit toute la partie : à la fin (ou à l'abandon), il
// en garde un résumé dans ce navigateur, et rien n'est envoyé nulle part. C'est l'outil des soirées de test : comment et
// quand meurent les joueurs, où ils se posent, combien de temps dure une partie, qui abandonne. stats.html le lit, l'exporte
// et y ajoute les journaux des amis.
export const JOURNAL_KEY = 'royale_journal';
const MAX = 80;

export function loadJournal() {
  try { const l = JSON.parse(localStorage.getItem(JOURNAL_KEY) || '[]'); return Array.isArray(l) ? l.filter((m) => m && m.id != null) : []; } catch (e) { return []; }
}
export function saveJournal(list) {
  const seen = new Set(), out = [];
  for (const m of [...list].sort((a, b) => (b.at || 0) - (a.at || 0))) if (!seen.has(m.id)) { seen.add(m.id); out.push(m); }
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(out.slice(0, MAX))); } catch (e) { /* pas de stockage */ }
  return out.slice(0, MAX);
}

// meta : { id, at, map, mode, teams, places, humans, bots, levels }
export function createRecorder() {
  let cur = null;
  const kind = (Q) => (!Q ? null : Q.bot ? 'b' : 'h');
  return {
    start(meta) { cur = { ...meta, deaths: [], jumps: {}, lands: {} }; },
    // événements de la partie, tels que la simulation (qui fait foi) les émet
    event(e, sim) {
      if (!cur) return;
      const t = Math.round(sim.S.t);
      if (e.e === 'elim') {
        // [instant, x, z, victime humaine (1) ou bot (0), tueur ('h', 'b' ou null), cause]
        const Q = sim.player(e.to), K = e.by != null ? sim.player(e.by) : null;
        cur.deaths.push([t, Q ? Math.round(Q.x) : 0, Q ? Math.round(Q.z) : 0, Q && !Q.bot ? 1 : 0, kind(K), e.cause || null]);
      } else if (e.e === 'saut') {
        const Q = sim.player(e.p);
        if (Q && !Q.bot && cur.jumps[Q.id] == null) cur.jumps[Q.id] = t;
      } else if (e.e === 'atterrit') {
        const Q = sim.player(e.p);
        if (Q && !Q.bot && !cur.lands[Q.id]) cur.lands[Q.id] = [Math.round(Q.x), Math.round(Q.z), t];
      }
    },
    // fin de partie ('fin') ou abandon ('abandon') : le résumé rejoint le journal
    end(sim, res, end = 'fin') {
      if (!cur) return null;
      const { jumps, lands, ...m } = cur;
      cur = null;
      m.end = end; m.dur = Math.round(sim.S.t); m.left = sim.alive().length;
      m.people = res.filter((r) => !r.bot).map((r) => ({
        name: r.name, place: end === 'abandon' && r.out == null ? null : r.place, kills: r.kills, dealt: r.dealt, shots: r.shots, hits: r.hits,
        dist: r.dist, out: r.out, how: r.how, by: r.by == null ? null : kind(sim.player(r.by)), jump: jumps[r.id] ?? null, land: lands[r.id] || null,
      }));
      saveJournal([m, ...loadJournal()]);
      return m;
    },
    get on() { return !!cur; },
  };
}
