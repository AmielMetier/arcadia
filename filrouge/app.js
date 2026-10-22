// Démarrage de Fil Rouge : rôle (hôte, invité, solo), session réseau et vue.
import { startHost } from './net/host.js';
import { startClient } from './net/client.js';
import { mountGame } from './view/game.js';

const H = window.HubBridge;
const root = document.getElementById('app');

async function boot(info) {
  // les textures des étiquettes sont dessinées avec les polices du jeu
  try { await Promise.race([document.fonts.load('40px Bungee'), new Promise((r) => setTimeout(r, 1500))]); await document.fonts.load('600 30px "Chakra Petch"'); } catch (e) {}
  const role = H.embedded ? info.role : 'solo';
  const meP = H.players.find((p) => p.id === info.myId);
  const prof = (() => { try { return { name: JSON.parse(localStorage.getItem('dd_name')) || 'Moi', color: JSON.parse(localStorage.getItem('dd_color')) || '#ff4b2b' }; } catch (e) { return { name: 'Moi', color: '#ff4b2b' }; } })();
  const me = { id: H.embedded ? info.myId : 0, name: meP ? meP.name : prof.name, color: meP ? meP.color : prof.color };
  const qs = new URLSearchParams(location.search);
  // hors du Hub (filrouge/?diff=expert) : réglages dans l'adresse
  const settings = H.embedded ? info.settings || {} : { mode: 'coop', diff: qs.get('diff') || 'facile', strikes: qs.get('strikes') || 3 };

  let session;
  const proxy = {
    get isHost() { return session.isHost; },
    act: (a) => session.act(a), pick: (m) => session.pick(m), chat: (t) => session.chat(t),
    shuffle: () => session.shuffle(), start: () => session.start(), again: () => session.again(),
  };
  const view = mountGame(root, { me, session: proxy, exit: () => { if (H.embedded) H.exit(); else location.reload(); } });
  const on = {
    state: (s, off, ev) => view.update(s, off, ev),
    setup: (s) => view.setup(s),
    error: (msg, soft) => view.error(msg, soft),
    chat: (m) => view.chat(m),
  };
  session = role === 'guest' ? startClient({ bridge: H, on }) : startHost({ bridge: H, solo: role === 'solo', settings, me, on });
  // L'hôte est parti et ce joueur reprend le salon : il devient l'hôte, à partir du dernier état reçu
  let current = role;
  H.on('roster', () => {
    if (current === 'guest' && H.info.role === 'host') {
      current = 'host';
      const last = session.state, offset = session.offset;
      session = startHost({ bridge: H, solo: false, settings, me, on, initial: last ? { state: last, offset } : null });
      view.toast(last ? 'Tu reprends la partie en tant qu\'hôte' : 'Tu es maintenant l\'hôte');
    }
  });
  H.signalReady();
  if (qs.has('debug')) window.__fil = { get session() { return session; }, view };
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
