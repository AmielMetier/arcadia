// pokemon/net/client.js
// Invité de Poké Duel : écoute les états diffusés par l'hôte et transmet ses choix de combat.

export function startClient({ bridge, me, onState, onError }) {
  let state = null;

  bridge.on('msg', (from, m) => {
    if (from !== bridge.info.hostId || !m || typeof m !== 'object') return;
    if (m.t === 'st' && m.s) {
      state = m.s;
      onState(state, (m.now || Date.now()) - Date.now());
    } else if (m.t === 'err') {
      onError(m.msg);
    }
  });

  return {
    startMatch() {},
    restart() {},
    submitAction(action) {
      bridge.send('host', { t: 'action', action });
    },
    get state() { return state; }
  };
}
