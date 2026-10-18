// Démarrage de DavidSimulator : rôle (hôte, invité, solo), session réseau et vue.
import { startHost } from './net/host.js';
import { startClient } from './net/client.js';
import { mountGame } from './view/game.js';

const H = window.HubBridge;
const board = await fetch('data/board-nice.json').then((r) => r.json());
const root = document.getElementById('app');

function boot(info) {
  const role = H.embedded ? info.role : 'solo';
  const meP = H.players.find((p) => p.id === info.myId);
  const prof = (() => { try { return { name: JSON.parse(localStorage.getItem('dd_name')) || 'Moi', color: JSON.parse(localStorage.getItem('dd_color')) || '#ff4b2b' }; } catch (e) { return { name: 'Moi', color: '#ff4b2b' }; } })();
  const me = { id: H.embedded ? info.myId : 0, name: meP ? meP.name : prof.name, color: meP ? meP.color : prof.color };
  const qs = new URLSearchParams(location.search);
  const settings = H.embedded ? info.settings || {} : {
    mode: qs.get('mode') || 'classic', bots: 3,
    jackpot: qs.get('jackpot'), doubleGo: qs.get('doubleGo'), auctions: qs.get('auctions') ?? 1, cash: qs.get('cash'),
  };

  const view = mountGame(root, board, {
    me,
    act: (a) => session.act(a),
    pick: (token) => session.pick(token),
    start: () => session.start(),
    chooseSave: (id) => session.chooseSave(id),
    deleteSave: (id) => session.deleteSave(id),
    exit: () => { if (H.embedded) H.exit(); else location.reload(); },
  });
  const handlers = {
    onState: (s, ev, offset) => view.update(s, ev, offset),
    onSetup: (s) => view.setup(s),
    onError: (msg) => view.toast(msg),
  };
  let session;
  if (role === 'guest') session = startClient({ bridge: H, me, ...handlers });
  else session = startHost({ board, bridge: H, solo: role === 'solo', settings, me, ...handlers });
  // L'hôte est parti et ce joueur reprend le salon : il devient l'hôte de la partie, à partir du dernier état reçu
  let current = role;
  H.on('roster', () => {
    if (current === 'guest' && H.info.role === 'host') {
      current = 'host';
      const last = session.state;
      session = startHost({ board, bridge: H, solo: false, settings, me, ...handlers, initial: last });
      view.toast(last ? 'Tu reprends la partie en tant qu\'hôte' : 'Tu es maintenant l\'hôte');
    }
  });
  H.signalReady();
  if (new URLSearchParams(location.search).has('debug')) window.__david = { session, view, board };
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
