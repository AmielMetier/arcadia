// odyssee/js/net/cloud.js — sauvegarde en ligne : la partie suit le compte du Hub d'un appareil à l'autre.
// La partie est envoyée (sous forme de code ODY1) au serveur relais, qui la range dans le dépôt GitHub du jeu
// (branche « saves »). Le compte est reconnu grâce à la clé secrète du Hub (celle des amis), gardée dans ce navigateur
// et emportée par le code de transfert du Hub : sur un autre appareil, on retrouve donc sa partie sans rien recopier.
import { encodeSave, decodeSave } from '../core/savecode.js';

const QS = new URLSearchParams(location.search);
const WS = QS.get('ws') || 'wss://duo-drift-relay.onrender.com';
const HTTP = WS.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/$/, '');
// tests entre onglets (?local) : pas de serveur, sauf si ?ws= est donné
const OFF = QS.has('local') && !QS.has('ws');
const AS = (QS.get('as') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
const KEY_K = 'hub_fkey' + (AS ? '_' + AS : '');
const GAP = 45000; // au plus une sauvegarde automatique envoyée toutes les 45 s

/** clé du compte Hub (créée comme le fait le Hub si ce navigateur n'en a pas encore) */
function accountKey() {
  try {
    let k = JSON.parse(localStorage.getItem(KEY_K) || 'null');
    if (typeof k !== 'string' || k.length < 16) {
      k = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join('');
      localStorage.setItem(KEY_K, JSON.stringify(k));
    }
    return k;
  } catch (e) { return null; }
}

async function call(path, body, o = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeout || 20000);
  try {
    // text/plain : requête « simple », sans aller-retour CORS préalable (et compatible keepalive)
    const r = await fetch(HTTP + path, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(body), signal: ctl.signal, keepalive: !!o.keepalive });
    const j = await r.json().catch(() => null);
    // un relais pas encore mis à jour répond par du texte : la sauvegarde en ligne n'y existe pas
    if (!j) return { status: r.status, ok: false, error: r.status === 404 || r.ok ? 'off' : 'http' };
    return { status: r.status, ...j };
  } catch (e) { return { status: 0, ok: false, error: 'net' }; } finally { clearTimeout(t); }
}

export class Cloud {
  constructor() {
    this.key = OFF ? null : accountKey();
    this.on = !!this.key;       // false : serveur non configuré, mode test ou stockage bloqué
    this.state = this.on ? 'idle' : 'off'; // idle · sending · ok · err · off
    this.lastSent = 0; this.lastCode = null; this.timer = 0; this.pending = null; this.remote = undefined;
  }
  /** la sauvegarde en ligne de ce compte : { state, meta } | null (aucune) | undefined (injoignable) */
  fetch(timeout = 60000) {
    if (!this.on) return Promise.resolve(undefined);
    if (!this._get) this._get = (async () => {
      const r = await call('/save/odyssee/get', { key: this.key }, { timeout });
      if (r.error === 'off') { this.on = false; this.state = 'off'; return undefined; }
      if (!r.ok) { this._get = null; this.unreachable = true; return undefined; }
      this.unreachable = false;
      this.fid = r.fid;
      if (!r.save) { this.remote = null; return null; }
      const d = await decodeSave(r.save.code);
      if (d.error) return null;
      this.remote = { state: d.state, updated: r.save.updated };
      return this.remote;
    })();
    return this._get;
  }
  /** envoi de la partie ; now : tout de suite (bouton Sauver), sinon regroupé (sauvegardes automatiques) */
  queue(state, now = false) {
    if (!this.on) return Promise.resolve(false);
    this.pending = state;
    const wait = now ? 0 : Math.max(0, this.lastSent + GAP - Date.now());
    clearTimeout(this.timer);
    return new Promise((res) => { this.timer = setTimeout(() => this.send().then(res), wait); });
  }
  async send(keepalive = false) {
    const st = this.pending; if (!st || !this.on) return false;
    this.pending = null; clearTimeout(this.timer);
    const code = await encodeSave(st);
    if (code === this.lastCode) return true;
    this.state = 'sending'; this.lastSent = Date.now();
    const meta = { name: st.name, badges: st.badges.filter(Boolean).length, dex: st.dex.caught.length, time: Math.floor(st.time || 0) };
    const r = await call('/save/odyssee/put', { key: this.key, code, meta }, { keepalive, timeout: 30000 });
    if (r.error === 'off') { this.on = false; this.state = 'off'; return false; }
    if (r.ok) { this.lastCode = code; this.state = 'ok'; this.remote = { state: JSON.parse(JSON.stringify(st)), updated: r.updated }; return true; }
    this.state = 'err'; this.pending = this.pending || st; // nouvel essai à la prochaine sauvegarde
    return false;
  }
  /** la page se ferme ou passe en arrière-plan : dernier envoi */
  flush() { if (this.pending) this.send(true); }
}
