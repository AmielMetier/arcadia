/* Serveurs utilisés par WebRTC pour se connecter, du plus direct au plus robuste.
   Sur les réseaux publics (wifi d'université, d'hôtel, de gare…), l'UDP et le port 3478 sont souvent bloqués
   et les appareils isolés les uns des autres : seule une connexion relayée sur le port 443 (comme le web) passe.

   1. STUN Google            : connexion directe quand le réseau le permet (le cas le plus fréquent à la maison).
   2. TURN PeerJS (3478)      : relais par défaut de PeerJS.
   3. TURN Open Relay (80/443, TLS compris) : relais public de Metered. Identifiants temporaires calculés ici
      à partir du secret partagé publié par Metered (schéma « TURN REST » : utilisateur = expiration, mot de passe = HMAC-SHA1).
   4. TURN personnel (facultatif) : remplir CUSTOM_TURN avec ses identifiants (ex. ExpressTURN, 1 To/mois gratuit). */
(function () {
  const CUSTOM_TURN = null;
  /* Exemple :
  const CUSTOM_TURN = {
    urls: ['turn:relay1.expressturn.com:3478?transport=udp', 'turn:relay1.expressturn.com:3478?transport=tcp', 'turns:relay1.expressturn.com:443?transport=tcp'],
    username: 'IDENTIFIANT', credential: 'MOT_DE_PASSE',
  }; */

  const QS = new URLSearchParams(location.search);
  const STUN = { urls: 'stun:stun.l.google.com:19302' };
  const PEERJS_TURN = { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' };
  const OPENRELAY_HOST = 'staticauth.openrelay.metered.ca';
  const OPENRELAY_SECRET = 'openrelayprojectsecret';
  let openRelay = null;

  async function makeOpenRelay() {
    if (!(window.crypto && crypto.subtle)) return null;
    const username = `${Math.floor(Date.now() / 1000) + 24 * 3600}:duodrift`;
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(OPENRELAY_SECRET), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(username));
    const credential = btoa(String.fromCharCode(...new Uint8Array(sig)));
    return {
      urls: [`turn:${OPENRELAY_HOST}:80`, `turn:${OPENRELAY_HOST}:80?transport=tcp`, `turn:${OPENRELAY_HOST}:443`, `turn:${OPENRELAY_HOST}:443?transport=tcp`, `turns:${OPENRELAY_HOST}:443?transport=tcp`],
      username, credential,
    };
  }
  const ready = makeOpenRelay().then((r) => { openRelay = r; }).catch(() => {});

  // ?turn=url,identifiant,motdepasse : relais supplémentaire (tests)
  const qsTurn = (() => { const v = QS.get('turn'); if (!v) return null; const [urls, username, credential] = v.split(','); return { urls, username, credential }; })();

  function iceServers() {
    if (qsTurn) return [qsTurn];
    const list = [STUN, PEERJS_TURN];
    if (openRelay) list.push(openRelay);
    if (CUSTOM_TURN) list.push(CUSTOM_TURN);
    return list;
  }

  // Options passées à new Peer(...) : serveur de mise en relation (?peer=hôte:port) et serveurs ICE.
  // ?relay force le passage par un relais (pour vérifier que le relais fonctionne).
  function peerOptions() {
    const o = { debug: 1, config: { iceServers: iceServers(), iceTransportPolicy: QS.has('relay') ? 'relay' : 'all' } };
    const custom = QS.get('peer');
    if (custom) {
      const [hp, ...rest] = custom.split('/');
      const [host, port] = hp.split(':');
      Object.assign(o, { host, port: Number(port) || 443, path: '/' + rest.join('/'), secure: !/^(localhost|127\.)/.test(host) });
    }
    return o;
  }

  window.DDIce = { ready, iceServers, peerOptions, get openRelay() { return openRelay; }, STUN, PEERJS_TURN, get custom() { return CUSTOM_TURN; } };
})();
