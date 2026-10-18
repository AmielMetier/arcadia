/* Profil commun aux jeux : mêmes clés que Duo Drift, pour que pseudo et couleur suivent partout. */
(function () {
  const get = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
  window.DDProfile = {
    PALETTE, get, set,
    load() {
      const color = get('dd_color', PALETTE[0]);
      return { name: String(get('dd_name', '') || '').slice(0, 12), color: PALETTE.includes(color) ? color : PALETTE[0], lvl: 1 };
    },
    save(p) { set('dd_name', String(p.name || '').slice(0, 12)); if (PALETTE.includes(p.color)) set('dd_color', p.color); },
  };
})();
