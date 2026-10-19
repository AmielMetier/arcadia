/* Profil commun aux jeux : mêmes clés que Duo Drift, pour que pseudo et couleur suivent partout. */
(function () {
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
  window.DDProfile = {
    PALETTE, get, set,
    load() {
      const color = get('dd_color', PALETTE[0]);
      // identifiant permanent du joueur (classement entre potes), créé au premier passage
      let uid = get('dd_uid', null);
      if (!/^[a-z0-9]{6,16}$/.test(String(uid))) { uid = Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12); set('dd_uid', uid); }
      return { name: String(get('dd_name', '') || '').slice(0, 12), color: PALETTE.includes(color) ? color : PALETTE[0], lvl: 1, uid };
    },
    save(p) { set('dd_name', String(p.name || '').slice(0, 12)); if (PALETTE.includes(p.color)) set('dd_color', p.color); },
  };
})();
