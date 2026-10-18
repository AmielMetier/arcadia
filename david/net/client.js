// Invité de DavidSimulator : envoie ses intentions à l'hôte et affiche l'état reçu.
export function startClient({ bridge, me, onState, onError }) {
  let state = null;
  bridge.on('msg', (from, m) => {
    if (from !== bridge.info.hostId || !m || typeof m !== 'object') return;
    if (m.t === 'st' && m.s) {
      state = m.s;
      onState(state, Array.isArray(m.ev) ? m.ev : [], (m.now || Date.now()) - Date.now());
    } else if (m.t === 'err') onError(m.msg);
  });
  // demande l'état tant qu'on ne l'a pas (arrivée en cours de partie, messages perdus au chargement)
  const ask = setInterval(() => { if (state) clearInterval(ask); else bridge.send('host', { t: 'sync' }); }, 1500);
  return {
    act(a) { bridge.send('host', { t: 'act', a }); },
    get state() { return state; },
  };
}
