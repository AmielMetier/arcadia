// pokemon/app.js
// Point d'entrée de Poké Duel : écoute le HubBridge, lance soit l'Aventure Kalos-Sud (Menton),
// soit le Tournoi 3v3 en Arène selon le mode choisi dans le Hub ou via le sélecteur en jeu.

import { startHost } from './net/host.js';
import { startClient } from './net/client.js';
import { mountGame } from './view/game.js';
import { mountAdventure } from './adventure/adventure.js';

const H = window.HubBridge;
const root = document.getElementById('app');

let activeInstance = null;
let hasBooted = false;

function boot(info = {}, forcedMode = null) {
  hasBooted = true;
  if (activeInstance && activeInstance.destroy) {
    activeInstance.destroy();
    activeInstance = null;
  }

  const role = H.embedded ? (info.role || H.info.role || 'solo') : 'solo';
  const meP = (H.players || []).find((p) => p.id === info.myId);
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
    id: H.embedded ? (info.myId ?? 0) : 0,
    name: meP ? meP.name : prof.name,
    color: meP ? meP.color : prof.color
  };

  const qs = new URLSearchParams(location.search);
  const settings = H.embedded ? (info.settings || H.info.settings || {}) : {
    mode: qs.get('mode') || 'adventure',
    timer: qs.get('timer') || 25,
    gen: qs.get('gen') || 'all',
    bots: qs.get('bots') ?? 1,
    level: qs.get('level') || 'normal'
  };

  const mode = forcedMode || settings.mode || 'adventure';

  // --- MODE AVENTURE MULTIJOUEUR À MENTON ---
  if (mode === 'adventure') {
    activeInstance = mountAdventure(root, {
      me,
      bridge: H,
      settings,
      onSwitchMode: (nextMode) => boot(info, nextMode),
      exit: () => {
        if (H.embedded) H.exit();
        else location.reload();
      }
    });
    H.signalReady();
    return;
  }

  // --- MODE TOURNOI 3V3 ARÈNE ---
  let session;

  const view = mountGame(root, {
    me,
    startMatch: () => session.startMatch(),
    restart: () => session.restart(),
    submitAction: (act) => session.submitAction(act),
    switchMode: (nextMode) => boot(info, nextMode),
    onSwitchMode: (nextMode) => boot(info, nextMode),
    exit: () => {
      if (H.embedded) H.exit();
      else location.reload();
    }
  });

  activeInstance = {
    destroy: () => {
      if (view && view.cleanup) view.cleanup();
    }
  };

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

if (H.embedded) {
  H.on('init', (info) => boot(info));
  // Sécurité : si l'événement init a été manqué pendant le chargement des modules ES,
  // on redemande l'initialisation au Hub parent.
  setTimeout(() => {
    if (!hasBooted) {
      try {
        window.parent.postMessage({ dd: 'hub', k: 'hello' }, '*');
      } catch (e) {}
    }
  }, 150);
  setTimeout(() => {
    if (!hasBooted) boot(H.info);
  }, 600);
} else {
  boot({ role: 'solo', myId: 0 });
}
