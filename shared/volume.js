/* Volume de la musique et des effets, réglé jeu par jeu et retenu dans ce navigateur.
   Chaque jeu fait passer son son par deux niveaux (0 à 1, 1 = le son normal du jeu) et ouvre le même panneau
   depuis un bouton de sa barre d'outils. Le bouton muet propre à chaque jeu reste à part.

   API :
     DDVolume.get(kind)                 niveau 'music' ou 'fx', de 0 à 1
     DDVolume.set(kind, v)              change et retient le niveau
     DDVolume.on(fn)                    fn(niveaux) à chaque changement ; renvoie de quoi se désabonner
     DDVolume.gain(ctx, kind)           nœud WebAudio dont le gain suit le niveau (à brancher soi-même)
     DDVolume.media(el, kind, base)     élément <audio> dont le volume suit le niveau (base : son volume normal)
     DDVolume.level(kind, base)         base × niveau, pour un son joué une fois
     DDVolume.migrate(kind, v)          niveau de départ quand rien n'est encore retenu (ancien réglage du jeu)
     DDVolume.panel(button, opts)       le bouton ouvre le panneau ; opts.kinds : ['music', 'fx'] (par défaut) */
(function () {
  if (window.DDVolume) return;
  // le jeu : son dossier (drift/, kart/, …)
  const game = (location.pathname.replace(/\/(index\.html)?$/, '').split('/').filter(Boolean).pop() || 'hub').replace(/[^a-z0-9_-]/gi, '');
  const KEY = 'dd_vol_' + game;
  const LABEL = { music: 'Musique', fx: 'Effets' };
  const clamp = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  const lv = { music: 1, fx: 1 };
  if (saved) for (const k of ['music', 'fx']) if (typeof saved[k] === 'number') lv[k] = clamp(saved[k]);
  const subs = new Set(), nodes = [], medias = [];

  function apply(kind) {
    for (const n of nodes) {
      if (n.kind !== kind) continue;
      try { n.node.gain.setTargetAtTime(lv[kind], n.node.context.currentTime, 0.04); } catch (e) { n.node.gain.value = lv[kind]; }
    }
    for (const m of medias) if (m.kind === kind) { try { m.el.volume = clamp(m.base * lv[kind]); } catch (e) {} }
  }
  const V = {
    game,
    get: (kind) => lv[kind] ?? 1,
    set(kind, v) {
      if (!(kind in lv)) return;
      lv[kind] = clamp(+v || 0); saved = { ...lv };
      try { localStorage.setItem(KEY, JSON.stringify(lv)); } catch (e) {}
      apply(kind);
      for (const fn of subs) { try { fn({ ...lv }); } catch (e) { console.error(e); } }
    },
    on(fn) { subs.add(fn); return () => subs.delete(fn); },
    gain(ctx, kind) {
      const node = ctx.createGain(); node.gain.value = lv[kind] ?? 1;
      nodes.push({ node, kind });
      return node;
    },
    media(el, kind, base = 1) {
      const m = medias.find((x) => x.el === el);
      if (m) { m.kind = kind; m.base = base; } else medias.push({ el, kind, base });
      try { el.volume = clamp(base * lv[kind]); } catch (e) {}
      return el;
    },
    level: (kind, base = 1) => clamp(base * (lv[kind] ?? 1)),
    migrate(kind, v) { if (!saved && kind in lv && typeof v === 'number' && isFinite(v)) { lv[kind] = clamp(v); apply(kind); } },
    panel,
  };

  // ------------------------------------------------------------------ panneau
  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = `
.ddvol{position:fixed;z-index:2147483000;width:250px;padding:14px 16px 12px;border-radius:14px;box-sizing:border-box;
  background:var(--ddvol-bg,rgba(18,22,34,.94));color:var(--ddvol-fg,#f4f6fb);box-shadow:0 12px 36px rgba(0,0,0,.4),inset 0 0 0 1px rgba(255,255,255,.08);
  font:600 14px/1.3 system-ui,-apple-system,'Segoe UI',sans-serif;text-align:left;letter-spacing:0;text-transform:none;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:ddvol-in .16s ease-out;user-select:none;-webkit-user-select:none;touch-action:manipulation}
@keyframes ddvol-in{from{opacity:0;transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.ddvol{animation:none}}
.ddvol[hidden],.ddvol label[hidden]{display:none}
.ddvol b{display:block;margin:0 0 8px;font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;opacity:.7}
.ddvol label{display:grid;grid-template-columns:64px 1fr 48px;align-items:center;gap:8px;margin:6px 0;padding:0;font:inherit;color:inherit}
.ddvol span{font:inherit;color:inherit}
.ddvol input{width:100%;margin:0;height:24px;accent-color:var(--ddvol-accent,#5aa9ff);cursor:pointer;background:transparent}
.ddvol output{text-align:right;white-space:nowrap;font:inherit;font-variant-numeric:tabular-nums;opacity:.9}`;
    document.head.appendChild(s);
  }
  // un seul panneau par page, rattaché au bouton qui l'ouvre (les jeux qui redessinent leur barre d'outils en
  // créent de nouveaux : chacun l'ouvre à son tour)
  let pop = null, anchor = null, shown = [];
  function build() {
    style();
    pop = document.createElement('div');
    pop.className = 'ddvol'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Volume');
    pop.innerHTML = '<b>Volume</b>' + ['music', 'fx'].map((k) => `<label data-row="${k}"><span>${LABEL[k]}</span><input type="range" min="0" max="100" step="5" data-k="${k}" aria-label="Volume ${LABEL[k].toLowerCase()}"><output data-o="${k}"></output></label>`).join('');
    document.body.appendChild(pop);
    for (const r of pop.querySelectorAll('input')) r.addEventListener('input', () => { V.set(r.dataset.k, r.value / 100); refresh(); });
    // le panneau garde ses clics et ses touches : le jeu ne réagit pas pendant qu'on règle le son
    for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'keyup', 'wheel', 'contextmenu']) {
      pop.addEventListener(ev, (e) => {
        e.stopPropagation();
        if (ev === 'keydown' && e.key === 'Escape') { const a = anchor; close(); a && a.focus(); }
      }, { passive: ev === 'touchstart' || ev === 'wheel' });
    }
    addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !(anchor && anchor.contains(e.target))) close(); }, true);
    addEventListener('resize', () => { if (!pop.hidden) place(); });
  }
  function refresh() {
    if (!pop) return;
    for (const k of ['music', 'fx']) {
      const v = Math.round(lv[k] * 100);
      pop.querySelector(`[data-row="${k}"]`).hidden = !shown.includes(k);
      pop.querySelector(`[data-k="${k}"]`).value = v; pop.querySelector(`[data-o="${k}"]`).textContent = v + ' %';
    }
  }
  // sous le bouton, aligné sur son bord droit (au-dessus faute de place)
  function place() {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth || 250, h = pop.offsetHeight || 120, m = 8;
    let top = r.bottom + m;
    if (top + h > innerHeight - m && r.top - m - h > m) top = r.top - m - h;
    pop.style.left = Math.min(innerWidth - w - m, Math.max(m, r.right - w)) + 'px';
    pop.style.top = Math.max(m, Math.min(innerHeight - h - m, top)) + 'px';
  }
  function close() {
    if (!pop || pop.hidden) return;
    pop.hidden = true;
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    anchor = null;
  }
  function open(button, kinds) {
    if (!pop) build();
    if (anchor && anchor !== button) anchor.setAttribute('aria-expanded', 'false');
    anchor = button; shown = kinds;
    pop.hidden = false; button.setAttribute('aria-expanded', 'true');
    refresh(); place();
    pop.querySelector(`[data-k="${kinds[0]}"]`).focus({ preventScroll: true });
  }
  // button : bouton du jeu qui ouvre (ou referme) le panneau
  function panel(button, { kinds = ['music', 'fx'] } = {}) {
    if (!button) return null;
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
    if (!button.title) button.title = 'Volume de la musique et des effets';
    button.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (anchor === button && pop && !pop.hidden) close(); else open(button, kinds);
    });
    return { open: () => open(button, kinds), close, refresh };
  }

  window.DDVolume = V;
})();
