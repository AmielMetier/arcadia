// pokemon/net/client.js
// Invité du tournoi Poké Duel : affiche l'état diffusé par l'hôte et lui transmet ses choix.

export function startClient({ bridge, onState, onError }) {
  let state = null;
  let alive = true;

  bridge.on('msg', (from, m) => {
    if (!alive || !m || typeof m !== 'object') return;
    if (String(from) !== String(bridge.info.hostId)) return;
    if (m.t === 'st' && m.s) {
      state = m.s;
      onState(state, (m.now || Date.now()) - Date.now());
    } else if (m.t === 'err') {
      onError(m.msg);
    }
  });

  const send = (msg) => { if (alive) bridge.send('host', msg); };

  // Demander l'état à l'hôte dès la connexion (et une seconde fois si la première réponse se perd)
  send({ t: 'sync' });
  setTimeout(() => { if (alive && !state) send({ t: 'sync' }); }, 1500);

  return {
    draft: (picks, items) => send({ t: 'draft', picks, items }),
    lead: (idx) => send({ t: 'lead', idx }),
    ready: (idx) => send({ t: 'ready', idx }),
    submitAction: (action) => send({ t: 'action', action }),
    cont: () => send({ t: 'continue' }),
    skip: () => {},
    restart: () => {},
    isHost: false,
    get state() { return state; },
    destroy() { alive = false; },
  };
}
