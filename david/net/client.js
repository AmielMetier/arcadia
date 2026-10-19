// Invité de DavidSimulator : envoie ses intentions à l'hôte et affiche l'état reçu.
export function startClient({ bridge, me, onState, onSetup, onError, onEmote = () => {} }) {
  let state = null;
  bridge.on('msg', (from, m) => {
    if (from !== bridge.info.hostId || !m || typeof m !== 'object') return;
    if (m.t === 'st' && m.s) {
      state = m.s;
      onState(state, Array.isArray(m.ev) ? m.ev : [], (m.now || Date.now()) - Date.now());
    } else if (m.t === 'setup' && m.s && !state) onSetup(m.s);
    else if (m.t === 'err') onError(m.msg);
    else if (m.t === 'emo') onEmote(m.from, m.id);
  });
  // nouvel hôte (migration) : on lui redemande l'état complet
  let hostSeen = bridge.info.hostId;
  bridge.on('roster', () => { if (bridge.info.hostId !== hostSeen) { hostSeen = bridge.info.hostId; setTimeout(() => bridge.send('host', { t: 'sync' }), 300); } });
  // demande l'état tant qu'on ne l'a pas (arrivée en cours de partie, messages perdus au chargement)
  const ask = setInterval(() => { if (state) clearInterval(ask); else bridge.send('host', { t: 'sync' }); }, 1500);
  return {
    act(a) { bridge.send('host', { t: 'act', a }); },
    emote(id) { bridge.send('host', { t: 'emote', id }); },
    pick(token) { bridge.send('host', { t: 'pick', token }); },
    start() {},
    chooseSave() {},
    deleteSave() {},
    get state() { return state; },
  };
}
