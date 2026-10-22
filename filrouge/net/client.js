// Invité de Fil Rouge : envoie ses choix et ses manipulations à l'hôte, reçoit l'état complet.
export function startClient({ bridge, on }) {
  let state = null, offset = 0;
  bridge.on('msg', (from, m) => {
    if (from !== bridge.info.hostId || !m || typeof m !== 'object') return;
    if (m.t === 'st' && m.s) { state = m.s; offset = (m.now || Date.now()) - Date.now(); on.state(state, offset, Array.isArray(m.ev) ? m.ev : []); }
    else if (m.t === 'setup' && m.s && (!state || state.phase === 'over')) { state = null; on.setup(m.s); }
    else if (m.t === 'err') on.error(m.msg, m.soft);
    else if (m.t === 'chat') on.chat(m);
  });
  // nouvel hôte (migration) : on lui redemande l'état complet
  let hostSeen = bridge.info.hostId;
  bridge.on('roster', () => { if (bridge.info.hostId !== hostSeen) { hostSeen = bridge.info.hostId; setTimeout(() => bridge.send('host', { t: 'sync' }), 300); } });
  let got = false;
  const origSetup = on.setup;
  on.setup = (s) => { got = true; origSetup(s); };
  const ask = setInterval(() => { if (state || got) clearInterval(ask); else bridge.send('host', { t: 'sync' }); }, 1500);
  return {
    isHost: false,
    act(a) { bridge.send('host', { t: 'act', ...a }); },
    pick(m) { bridge.send('host', { t: 'pick', ...m }); },
    chat(text) { bridge.send('host', { t: 'chat', text }); },
    shuffle() {}, start() {}, again() {},
    get state() { return state; },
    get offset() { return offset; },
  };
}
