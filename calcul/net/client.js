// Invité de Tête de Calcul : envoie ses réponses à l'hôte et affiche l'état reçu.
export function startClient({ bridge, onState, onSetup, onError, onAck = () => {}, onEmote = () => {} }) {
  let state = null;
  bridge.on('msg', (from, m) => {
    if (from !== bridge.info.hostId || !m || typeof m !== 'object') return;
    if (m.t === 'st' && m.s) { state = m.s; onState(state, (m.now || Date.now()) - Date.now()); }
    else if (m.t === 'setup' && m.s && (!state || state.phase === 'over')) onSetup(m.s);
    else if (m.t === 'err') onError(m.msg, m.soft);
    else if (m.t === 'ack') onAck(m);
    else if (m.t === 'emo') onEmote(m.from, m.id);
  });
  // nouvel hôte (migration) : on lui redemande l'état complet
  let hostSeen = bridge.info.hostId;
  bridge.on('roster', () => { if (bridge.info.hostId !== hostSeen) { hostSeen = bridge.info.hostId; setTimeout(() => bridge.send('host', { t: 'sync' }), 300); } });
  const ask = setInterval(() => { if (state) clearInterval(ask); else bridge.send('host', { t: 'sync' }); }, 1500);
  return {
    answer(raw) { if (state) bridge.send('host', { t: 'ans', i: state.idx, v: raw }); },
    emote(id) { bridge.send('host', { t: 'emote', id }); },
    sabotage(power, target) { bridge.send('host', { t: 'sab', power, target }); },
    start() {},
    get state() { return state; },
  };
}
