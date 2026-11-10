/* Compte Arcadia en ligne : identifiant + mot de passe, profil chiffré dans ce navigateur puis rangé sur GitHub par le relais.

   Le mot de passe ne quitte jamais le navigateur. On en tire 64 octets avec PBKDF2 (SHA-256, 250 000 tours, sel lié à
   l'identifiant) :
     - les 32 premiers forment la clé d'accès, envoyée au relais (qui n'en garde qu'une empreinte scrypt) ;
     - les 32 suivants forment la clé de chiffrement AES-GCM, qui reste ici : le profil part déjà chiffré.
   Un mot de passe oublié ne se récupère donc pas : on ne peut pas déchiffrer sans lui.

   API (window.HubAccount) :
     normUser(texte)                       identifiant valide (minuscules, chiffres, . _ -, 3 à 20) ou ''
     status() → Promise<bool>              le relais sait-il gérer les comptes ?
     create(user, pass, data) → Promise    crée le compte (erreur 'taken' si l'identifiant est pris)
     login(user, pass) → Promise<data>     se connecte et renvoie le profil déchiffré (erreur 'auth', 'wait', 'off'…)
     save(data) → Promise                  envoie le profil chiffré (compte connecté)
     session() → { user } | null           compte connecté sur ce navigateur
     vipKey() → Promise<string|null>       clé du coffre VIP des Backrooms, si le compte connecté est VIP
     vipSeed(key) → Promise<bool>          la réapprend au relais s'il ne l'a plus (true : le relais l'a)
     logout()                            oublie la session (le compte en ligne reste) */
(function () {
  const QS = new URLSearchParams(location.search);
  const WS = QS.get('ws') || 'wss://duo-drift-relay.onrender.com';
  const HTTP = WS.replace(/^wss:/i, 'https:').replace(/^ws:/i, 'http:').replace(/\/$/, '');
  const OFF = QS.has('local') && !QS.has('ws');   // tests entre onglets : pas de serveur
  const AS = (QS.get('as') || '').replace(/[^a-z0-9]/gi, '').slice(0, 12);
  const SESS_K = 'hub_login' + (AS ? '_' + AS : '');
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (u8) => btoa(String.fromCharCode(...u8));
  const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, '0')).join('');
  const fail = (code) => Object.assign(new Error(code), { code });

  const normUser = (t) => {
    const u = String(t || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_').replace(/[^a-z0-9_.-]/g, '');
    return /^[a-z0-9_.-]{3,20}$/.test(u) ? u : '';
  };

  async function derive(user, pass) {
    const salt = await crypto.subtle.digest('SHA-256', enc.encode('arcadia-account-salt:' + user));
    const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveBits']);
    const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, base, 512));
    return { auth: hex(bits.slice(0, 32)), ek: b64(bits.slice(32)) };
  }
  const aesKey = (ek) => crypto.subtle.importKey('raw', unb64(ek), 'AES-GCM', false, ['encrypt', 'decrypt']);
  async function seal(ek, data) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await aesKey(ek), enc.encode(JSON.stringify(data))));
    return { iv: b64(iv), ct: b64(ct) };
  }
  async function open(ek, blob) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(blob.iv) }, await aesKey(ek), unb64(blob.ct));
    return JSON.parse(dec.decode(pt));
  }

  async function call(path, body) {
    if (OFF) throw fail('off');
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 45000);   // le relais gratuit peut mettre ~30 s à se réveiller
    try {
      // text/plain : requête « simple », sans aller-retour CORS préalable
      const r = await fetch(HTTP + path, { method: body ? 'POST' : 'GET', headers: body ? { 'Content-Type': 'text/plain' } : undefined, body: body ? JSON.stringify(body) : undefined, signal: ctl.signal });
      const j = await r.json().catch(() => null);
      if (!j) throw fail(r.status === 404 || r.ok ? 'off' : 'http');   // relais pas encore mis à jour
      if (!j.ok) throw fail(j.error || 'http');
      return j;
    } catch (e) { throw e.code ? e : fail('net'); } finally { clearTimeout(t); }
  }

  const getSess = () => { try { const s = JSON.parse(localStorage.getItem(SESS_K) || 'null'); return s && s.user && s.auth && s.ek ? s : null; } catch (e) { return null; } };
  const setSess = (s) => { try { if (s) localStorage.setItem(SESS_K, JSON.stringify(s)); else localStorage.removeItem(SESS_K); } catch (e) {} };

  window.HubAccount = {
    normUser,
    async status() { try { return !!(await call('/account/status')).on; } catch (e) { return false; } },
    async create(user, pass, data) {
      user = normUser(user); if (!user) throw fail('user');
      const k = await derive(user, pass);
      await call('/account/create', { user, auth: k.auth, blob: await seal(k.ek, data) });
      setSess({ user, ...k });
    },
    async login(user, pass) {
      user = normUser(user); if (!user) throw fail('user');
      const k = await derive(user, pass);
      const r = await call('/account/login', { user, auth: k.auth });
      let data; try { data = await open(k.ek, r.blob); } catch (e) { throw fail('decrypt'); }
      setSess({ user, ...k });
      return data;
    },
    async save(data) {
      const s = getSess(); if (!s) throw fail('nosession');
      await call('/account/put', { user: s.user, auth: s.auth, blob: await seal(s.ek, data) });
    },
    session() { const s = getSess(); return s ? { user: s.user } : null; },
    // la clé du coffre VIP des Backrooms : le relais la donne au compte connecté s'il est VIP (null sinon, ou hors ligne)
    async vipKey() {
      const s = getSess(); if (!s) return null;
      try { const r = await call('/account/vipkey', { user: s.user, auth: s.auth }); return typeof r.key === 'string' ? r.key : null; } catch (e) { return null; }
    },
    async vipSeed(key) {
      try { if ((await call('/account/status')).vipkey) return true; await call('/account/vipseed', { key }); return true; } catch (e) { return false; }
    },
    logout() { setSess(null); },
  };
})();
