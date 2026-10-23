// Démarrage de Tête de Calcul : rôle (hôte, invité, solo), session réseau et vue.
import { startHost } from './net/host.js';
import { startClient } from './net/client.js';
import { mountGame } from './view/game.js';

const H = window.HubBridge;
const root = document.getElementById('app');

function boot(info) {
  const role = H.embedded ? info.role : 'solo';
  const meP = H.players.find((p) => p.id === info.myId);
  const prof = (() => { try { return { name: JSON.parse(localStorage.getItem('dd_name')) || 'Moi', color: JSON.parse(localStorage.getItem('dd_color')) || '#ff4b2b' }; } catch (e) { return { name: 'Moi', color: '#ff4b2b' }; } })();
  const me = { id: H.embedded ? info.myId : 0, name: meP ? meP.name : prof.name, color: meP ? meP.color : prof.color };
  const qs = new URLSearchParams(location.search);
  // hors du Hub (calcul/?mode=eclair&len=15…) : réglages dans l'adresse, deux bots par défaut
  const settings = H.embedded ? info.settings || {} : {
    mode: qs.get('mode'), len: qs.get('len'), diff: qs.get('diff'), theme: qs.get('theme'),
    finale: qs.get('finale'), sabotage: qs.get('sabotage'), bots: qs.get('bots') ?? 2, level: qs.get('level') || 'normal',
    lives: qs.get('lives'), jokers: qs.get('jokers'), code: qs.get('code'), cut: qs.get('cut'), chsab: qs.get('chsab'),
  };

  const view = mountGame(root, {
    me,
    answer: (v) => session.answer(v),
    emote: (id) => session.emote(id),
    sabotage: (power, target) => session.sabotage(power, target),
    joker: (kind) => session.joker(kind),
    start: () => session.start(),
    exit: () => { if (H.embedded) H.exit(); else location.reload(); },
  });
  const handlers = {
    onState: (s, offset) => view.update(s, offset),
    onSetup: (s) => view.setup(s),
    onError: (msg, soft) => view.error(msg, soft),
    onAck: (m) => view.ack(m),
    onEmote: (from, id) => view.emote(from, id),
    onNote: (m) => view.note(m),
  };
  let session;
  if (role === 'guest') session = startClient({ bridge: H, me, ...handlers });
  else session = startHost({ bridge: H, solo: role === 'solo', settings, me, ...handlers });
  // L'hôte est parti et ce joueur reprend le salon : il devient l'hôte de la partie, à partir du dernier état reçu
  let current = role;
  H.on('roster', () => {
    if (current === 'guest' && H.info.role === 'host') {
      current = 'host';
      const last = session.state;
      session = startHost({ bridge: H, solo: false, settings, me, ...handlers, initial: last });
      view.toast(last ? 'Tu reprends la partie en tant qu\'hôte' : 'Tu es maintenant l\'hôte');
    }
  });
  H.signalReady();
  if (qs.has('debug')) window.__calcul = { get session() { return session; }, view };
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
