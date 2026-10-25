// pokemon/app.js
// Point d'entrée de Poké Duel : écoute le HubBridge, lance le rôle (hôte/invité/solo) et monte la vue.

import { startHost } from './net/host.js';
import { startClient } from './net/client.js';
import { mountGame } from './view/game.js';

const H = window.HubBridge;
const root = document.getElementById('app');

function boot(info) {
  const role = H.embedded ? info.role : 'solo';
  const meP = H.players.find((p) => p.id === info.myId);
  const prof = (() => {
    try {
      return {
        name: JSON.parse(localStorage.getItem('dd_name')) || 'Dresseur',
        color: JSON.parse(localStorage.getItem('dd_color')) || '#ff4b2b'
      };
    } catch (e) {
      return { name: 'Dresseur', color: '#ff4b2b' };
    }
  })();

  const me = {
    id: H.embedded ? info.myId : 0,
    name: meP ? meP.name : prof.name,
    color: meP ? meP.color : prof.color
  };

  const qs = new URLSearchParams(location.search);
  const settings = H.embedded ? (info.settings || {}) : {
    timer: qs.get('timer') || 25,
    gen: qs.get('gen') || 'all',
    bots: qs.get('bots') ?? 1,
    level: qs.get('level') || 'normal'
  };

  let session;

  const view = mountGame(root, {
    me,
    startMatch: () => session.startMatch(),
    restart: () => session.restart(),
    submitAction: (act) => session.submitAction(act),
    exit: () => {
      if (H.embedded) H.exit();
      else location.reload();
    }
  });

  const handlers = {
    bridge: H,
    solo: role === 'solo',
    settings,
    me,
    onState: (state, offset) => view.update(state, offset),
    onError: (msg) => view.toast(msg)
  };

  if (role === 'guest') {
    session = startClient(handlers);
  } else {
    session = startHost(handlers);
  }

  // Si l'hôte quitte le salon et que ce joueur reprend l'hôte
  let currentRole = role;
  H.on('roster', () => {
    if (currentRole === 'guest' && H.info.role === 'host') {
      currentRole = 'host';
      session = startHost(handlers);
      view.toast('Tu es maintenant l\'hôte du tournoi !');
    }
  });

  H.signalReady();
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
