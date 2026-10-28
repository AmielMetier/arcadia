/* Réglages communs à tous les jeux : le volume de la musique et des effets, réglé jeu par jeu et retenu dans ce
   navigateur, et le même panneau « Réglages » partout, ouvert depuis le bouton ⚙️ du jeu. Le son vient en premier :
   deux curseurs, et à 0 % le son est coupé (pas de bouton muet à côté, qui ferait doublon). Viennent ensuite les
   réglages propres au jeu (graphismes, caméra…), présentés de la même façon dans tous les jeux.

   API :
     DDVolume.get(kind)                 niveau 'music' ou 'fx', de 0 à 1
     DDVolume.set(kind, v)              change et retient le niveau
     DDVolume.toggle(kinds)             touche « couper le son » (M…) : met à 0 les curseurs donnés (tous par défaut),
                                        ou les remet où ils étaient ; renvoie true si le son est coupé
     DDVolume.on(fn)                    fn(niveaux) à chaque changement ; renvoie de quoi se désabonner
     DDVolume.gain(ctx, kind)           nœud WebAudio dont le gain suit le niveau (à brancher soi-même)
     DDVolume.media(el, kind, base)     élément <audio> dont le volume suit le niveau (base : son volume normal)
     DDVolume.level(kind, base)         base × niveau, pour un son joué une fois
     DDVolume.migrate(kind, v)          niveau de départ quand rien n'est encore retenu (ancien curseur du jeu)
     DDVolume.legacy(key, kinds, off)   ancien bouton muet du jeu : si localStorage[key] disait le son coupé
                                        (off(valeur), par défaut valeur === '1'), ces curseurs passent à 0, une fois
     DDVolume.panel(button, opts)       le bouton ouvre (ou referme) le panneau Réglages
     DDVolume.close(), DDVolume.isOpen()
     DDVolume.ICON                      roue dentée (SVG) pour les jeux dont les boutons portent des icônes dessinées

   opts du panneau :
     kinds      curseurs du son : ['music', 'fx'] par défaut, ['fx'] pour un jeu sans musique
     sections   réglages du jeu, sous le son : [{ title, items, hint, hidden }]
                  { label, get, set }                                   interrupteur (oui / non)
                  { label, get, set, options: [[valeur, texte], …] }    choix
                  { label, get, set, range: [min, max, pas], format }   curseur (format(v) : texte affiché)
                  { note: () => texte }                                 ligne d'information
                  { keys: [[action, touches, manette?], …] }            commandes (HTML : <kbd>…</kbd>)
                  { bind: { rows, set, clear, reset } }                 touches modifiables, deux par action :
                      rows() → [[id, libellé, [touche 1, touche 2]], …] (texte ; '' : case vide)
                      set(id, case, { code, key } ou { mouse }) → texte affiché sous la liste (touche reprise ailleurs…)
                      clear(id, case), reset() : effacer une case, revenir aux touches d'origine
                      pad: true : boutons de manette (la case attend un bouton de la manette ; set reçoit { pad: n })
                  hidden: () => true masque la ligne (ou la section)
     hint       rappel en bas du panneau (HTML), par exemple la touche qui coupe le son
     test(kind) appelé quand on lâche un curseur du son : un petit bruit pour entendre le niveau
     accent     couleur du jeu pour les curseurs et les interrupteurs */
(function () {
  if (window.DDVolume) return;
  // le jeu : son dossier (drift/, kart/, …)
  const game = (location.pathname.replace(/\/(index\.html)?$/, '').split('/').filter(Boolean).pop() || 'hub').replace(/[^a-z0-9_-]/gi, '');
  const KEY = 'dd_vol_' + game;
  const KINDS = ['music', 'fx'];
  const LABEL = { music: 'Musique', fx: 'Effets' };
  const clamp = (v) => (v > 1 ? 1 : v > 0 ? v : 0);
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (!saved || typeof saved !== 'object') saved = {};
  const lv = { music: 1, fx: 1 };
  const rest = { music: 1, fx: 1 }; // dernier niveau entendu : la touche « couper le son » y revient
  const own = new Set(); // niveaux choisis par le joueur : retenus (les autres suivent migrate)
  for (const k of KINDS) if (typeof saved[k] === 'number') { lv[k] = clamp(saved[k]); own.add(k); }
  if (saved.rest) for (const k of KINDS) if (saved.rest[k] > 0) rest[k] = clamp(saved.rest[k]);
  for (const k of KINDS) if (lv[k] > 0) rest[k] = lv[k];
  const done = new Set(Array.isArray(saved.legacy) ? saved.legacy : []); // anciens boutons muets déjà repris
  let cut = Array.isArray(saved.cut) ? saved.cut.filter((k) => KINDS.includes(k)) : []; // coupés par la touche « couper le son »
  const subs = new Set(), nodes = [], medias = [];

  function persist() {
    const o = { rest: { ...rest }, legacy: [...done], cut };
    for (const k of own) o[k] = lv[k];
    try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {}
  }
  function apply(kind) {
    for (const n of nodes) {
      if (n.kind !== kind) continue;
      try { n.node.gain.setTargetAtTime(lv[kind], n.node.context.currentTime, 0.04); } catch (e) { n.node.gain.value = lv[kind]; }
    }
    for (const m of medias) if (m.kind === kind) { try { m.el.volume = clamp(m.base * lv[kind]); } catch (e) {} }
  }
  function notify() {
    for (const fn of subs) { try { fn({ ...lv }); } catch (e) { console.error(e); } }
    refresh();
  }
  // keep : on glisse un curseur, son dernier niveau entendu sera repris quand on le lâche
  function put(kind, v, keep) {
    lv[kind] = clamp(+v || 0); own.add(kind);
    if (lv[kind] > 0 && !keep) rest[kind] = lv[kind];
    apply(kind);
  }
  const V = {
    game,
    get: (kind) => lv[kind] ?? 1,
    set(kind, v) {
      if (!(kind in lv)) return;
      put(kind, v); persist(); notify();
    },
    toggle(kinds = KINDS) {
      const ks = [].concat(kinds).filter((k) => k in lv);
      const off = ks.some((k) => lv[k] > 0);
      if (off) {
        // on coupe ce qui s'entend, et on retient quoi : un curseur déjà à 0 le reste au retour
        cut = [...new Set([...cut.filter((k) => !ks.includes(k)), ...ks.filter((k) => lv[k] > 0)])];
        for (const k of ks) put(k, 0);
      } else {
        const back = ks.filter((k) => cut.includes(k));
        for (const k of back.length ? back : ks) put(k, rest[k] || 1);
        cut = cut.filter((k) => !ks.includes(k));
      }
      persist(); notify();
      return off;
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
    migrate(kind, v) {
      if (own.has(kind) || !(kind in lv) || typeof v !== 'number' || !isFinite(v)) return;
      lv[kind] = clamp(v); if (lv[kind] > 0) rest[kind] = lv[kind];
      apply(kind);
    },
    legacy(key, kinds = KINDS, off = (v) => v === '1') {
      if (done.has(key)) return false;
      let v = null;
      try { v = localStorage.getItem(key); } catch (e) {}
      const mute = v != null && !!off(v);
      if (mute) for (const k of [].concat(kinds)) if (k in lv) { if (lv[k] > 0) rest[k] = lv[k]; lv[k] = 0; own.add(k); apply(k); }
      done.add(key); persist();
      if (mute) notify();
      return mute;
    },
    panel,
    close: () => close(),
    isOpen: () => !!(pop && !pop.hidden),
    waiting: () => !!wait,  // une case attend sa touche (ou son bouton de manette) : le jeu ne réagit pas
    ICON: '<svg class="ddvol-ico" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  };

  // ------------------------------------------------------------------ panneau
  let styled = false;
  function style() {
    if (styled) return; styled = true;
    const s = document.createElement('style');
    s.textContent = `
.ddvol{position:fixed;z-index:2147483000;width:300px;max-width:calc(100vw - 16px);max-height:calc(100vh - 16px);overflow:auto;overscroll-behavior:contain;
  padding:10px 16px 14px;border-radius:14px;box-sizing:border-box;background:rgba(16,20,31,.96);color:#f4f6fb;
  box-shadow:0 14px 40px rgba(0,0,0,.45),inset 0 0 0 1px rgba(255,255,255,.09);
  font:600 14px/1.3 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:left;letter-spacing:0;text-transform:none;text-shadow:none;
  -webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);animation:ddvol-in .16s ease-out;user-select:none;-webkit-user-select:none;touch-action:manipulation}
.ddvol *{box-sizing:border-box;letter-spacing:0;text-transform:none;text-shadow:none}
@keyframes ddvol-in{from{opacity:0;transform:translateY(-4px)}}
@media (prefers-reduced-motion:reduce){.ddvol{animation:none}.ddvol-sw,.ddvol-sw::after{transition:none}}
.ddvol[hidden],.ddvol [hidden]{display:none!important}
.ddvol-h{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 -6px 2px 0}
.ddvol-h b{font-size:16px;font-weight:800}
.ddvol-x{width:32px;height:32px;margin:0;padding:0;border:0;border-radius:8px;background:transparent;color:inherit;font:400 24px/1 system-ui,sans-serif;cursor:pointer;opacity:.65}
.ddvol-x:hover{opacity:1;background:rgba(255,255,255,.1)}
.ddvol section{margin:0;padding:0}
.ddvol h3{margin:12px 0 4px;padding:0;font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;opacity:.6;color:inherit}
.ddvol-r{display:grid;grid-template-columns:84px 1fr 54px;align-items:center;gap:8px;min-height:34px;margin:0;padding:0;font:inherit;color:inherit;cursor:default}
.ddvol-r.st{grid-template-columns:1fr 54px;gap:2px 8px;margin:6px 0 4px}
.ddvol-r.st>span{grid-column:1/-1}
.ddvol-r span,.ddvol-s span,.ddvol-c span{font:inherit;color:inherit}
.ddvol input[type=range]{width:100%;min-width:0;height:26px;margin:0;padding:0;accent-color:var(--ddvol-a);cursor:pointer;background:transparent;border:0;box-shadow:none}
.ddvol output{text-align:right;white-space:nowrap;font:inherit;font-variant-numeric:tabular-nums;opacity:.85}
.ddvol output.off{opacity:.55}
.ddvol-s{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:36px;margin:0;padding:0}
.ddvol-sw{position:relative;flex:none;width:44px;height:26px;margin:0;padding:0;border:0;border-radius:13px;background:rgba(255,255,255,.22);cursor:pointer;transition:background .15s}
.ddvol-sw::after{content:'';position:absolute;left:3px;top:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform .15s}
.ddvol-sw[aria-checked=true]{background:var(--ddvol-a)}
.ddvol-sw[aria-checked=true]::after{transform:translateX(18px)}
.ddvol-c{margin:6px 0 8px;padding:0}
.ddvol-c>span{display:block;margin:0 0 6px}
.ddvol-seg{display:flex;gap:2px;margin:0;padding:2px;border-radius:9px;background:rgba(255,255,255,.1)}
.ddvol-seg button{flex:1 1 0;min-width:0;min-height:32px;margin:0;padding:4px 6px;border:0;border-radius:7px;background:transparent;color:inherit;
  font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:none}
.ddvol-seg button:hover{background:rgba(255,255,255,.08)}
.ddvol-seg button[aria-pressed=true]{background:var(--ddvol-a);color:var(--ddvol-on)}
.ddvol-n,.ddvol-hint{margin:6px 0 0;padding:0;font-size:12.5px;font-weight:500;line-height:1.4;opacity:.7}
.ddvol-hint{margin-top:10px}
.ddvol.wide{width:400px}
.ddvol-k{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px 10px;align-items:center;margin:4px 0 0;font-size:12.5px;font-weight:500}
.ddvol-k.three{grid-template-columns:minmax(0,1fr) auto auto}
.ddvol-k>*{min-width:0;text-align:right;white-space:nowrap;opacity:.9}
.ddvol-k>.a{text-align:left;white-space:normal;opacity:1}
.ddvol-k i{font-style:normal;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;opacity:.55}
.ddvol kbd{display:inline-block;min-width:20px;margin:0 1px;padding:1px 5px;border:0;border-radius:5px;background:rgba(255,255,255,.12);box-shadow:inset 0 -1px 0 rgba(0,0,0,.35);
  font:700 11.5px/1.5 system-ui,sans-serif;text-align:center;color:inherit}
.ddvol button:focus-visible,.ddvol input:focus-visible{outline:2px solid var(--ddvol-a);outline-offset:2px}
.ddvol-ico{display:inline-block;vertical-align:-0.125em}
.ddvol-b{display:grid;grid-template-columns:minmax(0,1fr) 92px 92px;gap:4px 6px;align-items:center;margin:4px 0 0;font-size:12.5px;font-weight:500}
.ddvol-b>span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ddvol-key{min-width:0;height:28px;margin:0;padding:0 6px;border:0;border-radius:6px;background:rgba(255,255,255,.12);box-shadow:inset 0 -1px 0 rgba(0,0,0,.35);
  color:inherit;font:700 12px/1 system-ui,sans-serif;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ddvol-key:hover{background:rgba(255,255,255,.2)}
.ddvol-key.empty{opacity:.45;font-weight:500}
.ddvol-key.wait{background:var(--ddvol-a);color:var(--ddvol-on);animation:ddvol-blink 1s steps(2) infinite}
@keyframes ddvol-blink{50%{opacity:.6}}
.ddvol-reset{margin:8px 0 0;padding:6px 10px;border:0;border-radius:7px;background:rgba(255,255,255,.1);color:inherit;font:inherit;font-size:12.5px;cursor:pointer}
.ddvol-reset:hover{background:rgba(255,255,255,.18)}`;
    document.head.appendChild(s);
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // texte lisible sur la couleur du jeu
  function onColor(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
    if (!m) return '#0b1020';
    const h = m[1].length === 3 ? m[1].replace(/./g, '$&$&') : m[1];
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#0b1020' : '#ffffff';
  }

  // un seul panneau par page, rattaché au bouton qui l'ouvre (les jeux qui redessinent leur barre d'outils en
  // créent de nouveaux : chacun l'ouvre à son tour)
  let pop = null, anchor = null, cur = null, watch = 0;
  // touche modifiable en attente : { btn, it, id, slot } ; skip : le clic qui suit un bouton de souris choisi
  let wait = null, skip = false;
  function endWait() { if (wait) { wait.btn.classList.remove('wait'); wait = null; } refresh(); }
  function bindNote(it, id, text) { const n = pop.querySelector(`[data-bn="${id}"]`); if (n) { n.textContent = text || ''; n.hidden = !text; } }
  const item = (id) => { const [s, i] = id.split('.').map(Number); return cur.sections[s].items[i]; };
  const pct = (v) => (v > 0 ? Math.round(v * 100) + ' %' : 'Coupé');
  function build() {
    style();
    pop = document.createElement('div');
    pop.className = 'ddvol'; pop.hidden = true;
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Réglages');
    document.body.appendChild(pop);
    // en glissant un curseur du son jusqu'à 0, la touche « couper le son » reviendra au niveau d'avant
    let from = null;
    pop.addEventListener('input', (e) => {
      const r = e.target, k = r.dataset.k;
      if (k) {
        if (!from || from.k !== k) from = { k, v: lv[k] };
        put(k, r.value / 100, true); persist(); notify();
      } else if (r.dataset.i) { const it = item(r.dataset.i); it.set(+r.value); refresh(); }
    });
    pop.addEventListener('change', (e) => {
      const k = e.target.dataset.k;
      if (!k) return;
      const was = from && from.k === k ? from.v : 0; from = null;
      rest[k] = lv[k] > 0 ? lv[k] : was > 0 ? was : rest[k]; persist();
      if (cur.test && lv[k] > 0) { try { cur.test(k); } catch (err) {} }
    });
    pop.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (skip) { skip = false; return; }
      if (b.classList.contains('ddvol-x')) { const a = anchor; close(); if (a) a.focus(); return; }
      const it = b.dataset.i && item(b.dataset.i);
      if (!it) return;
      if (b.classList.contains('ddvol-key')) {
        // une case de touche : on attend la nouvelle touche (ou un bouton de la souris sur cette même case)
        const again = wait && wait.btn === b;
        endWait();
        if (again) return;
        wait = { btn: b, it, id: b.dataset.i, act: b.dataset.b, slot: +b.dataset.s };
        b.classList.add('wait'); b.textContent = it.bind.pad ? 'Bouton…' : 'Touche…';
        bindNote(it, wait.id, '');
        if (it.bind.pad) padWait(wait);
        return;
      }
      if (b.classList.contains('ddvol-reset')) { endWait(); it.bind.reset(); bindNote(it, b.dataset.i, it.bind.pad ? 'Boutons d\'origine remis.' : 'Touches d\'origine remises.'); refresh(); return; }
      if (b.classList.contains('ddvol-sw')) it.set(!it.get());
      else it.set(it.options[+b.dataset.v][0]);
      refresh();
    });
    // touche modifiable en attente : la touche appuyée, où qu'elle arrive (Safari ne donne pas le focus au bouton cliqué) ;
    // Échap annule, Suppr ou Retour efface la case ; le jeu ne la voit pas
    addEventListener('keydown', (e) => {
      if (!wait) return;
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      const w = wait;
      if (e.code === 'Escape') { endWait(); return; }
      if (e.code === 'Delete' || e.code === 'Backspace') { w.it.bind.clear(w.act, w.slot); endWait(); return; }
      if (w.it.bind.pad) return; // une case de manette ne prend pas les touches du clavier
      const note = w.it.bind.set(w.act, w.slot, { code: e.code, key: e.key });
      endWait(); bindNote(w.it, w.id, note);
    }, true);
    // un bouton de la souris sur la case en attente la prend ; ailleurs dans le panneau, l'attente s'arrête
    pop.addEventListener('mousedown', (e) => {
      if (!wait) return;
      const w = wait;
      if (e.target.closest('button') !== w.btn) { endWait(); return; }
      if (w.it.bind.pad) return; // ni les boutons de la souris (un second clic sur la case l'abandonne)
      e.preventDefault();
      const note = w.it.bind.set(w.act, w.slot, { mouse: e.button });
      skip = e.button === 0;
      endWait(); bindNote(w.it, w.id, note);
    }, true);
    pop.addEventListener('mouseup', (e) => { if (e.button > 2) e.preventDefault(); });
    // le panneau garde ses clics et ses touches : le jeu ne réagit pas pendant qu'on règle
    for (const ev of ['pointerdown', 'mousedown', 'touchstart', 'click', 'keydown', 'keyup', 'wheel', 'contextmenu']) {
      pop.addEventListener(ev, (e) => {
        e.stopPropagation();
        if (ev === 'contextmenu' && e.target.closest('.ddvol-key')) e.preventDefault();
        if (ev === 'keydown' && e.key === 'Escape') { e.preventDefault(); const a = anchor; close(); if (a) a.focus(); }
      }, { passive: ev === 'touchstart' || ev === 'wheel' });
    }
    addEventListener('pointerdown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !(anchor && anchor.contains(e.target))) close(); }, true);
    addEventListener('resize', () => { if (!pop.hidden) place(); });
  }
  // case de manette en attente : on lit les manettes toutes les 30 ms ; le premier bouton enfoncé la prend (ceux qui
  // l'étaient déjà quand on a cliqué ne comptent qu'une fois relâchés)
  const padDown = () => {
    const s = new Set();
    for (const g of (navigator.getGamepads ? navigator.getGamepads() : [])) if (g) g.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) s.add(i); });
    return s;
  };
  function padWait(w) {
    const held = padDown();
    const tick = () => {
      if (wait !== w) return;
      const now = padDown();
      for (const i of now) if (!held.has(i)) { const note = w.it.bind.set(w.act, w.slot, { pad: i }); endWait(); bindNote(w.it, w.id, note); return; }
      for (const i of [...held]) if (!now.has(i)) held.delete(i);
      setTimeout(tick, 30);
    };
    setTimeout(tick, 30);
  }
  function itemHtml(it, id) {
    if (it.note) return `<p class="ddvol-n" data-n="${id}"></p>`;
    if (it.bind) {
      const rows = it.bind.rows().map(([a, l]) => `<span>${esc(l)}</span>${[0, 1].map((k) => `<button type="button" class="ddvol-key" data-i="${id}" data-b="${esc(a)}" data-s="${k}" aria-label="${esc(l)}, ${it.bind.pad ? 'bouton' : 'touche'} ${k + 1}"></button>`).join('')}`).join('');
      return `<div data-r="${id}"><div class="ddvol-b">${rows}</div><p class="ddvol-n" data-bn="${id}" hidden></p><button type="button" class="ddvol-reset" data-i="${id}">${it.bind.pad ? 'Boutons' : 'Touches'} d'origine</button></div>`;
    }
    if (it.keys) {
      const three = it.keys.some((r) => r.length > 2);
      const head = it.head ? it.head.map((h, j) => `<i${j ? '' : ' class="a"'}>${esc(h)}</i>`).join('') : '';
      return `<div class="ddvol-k${three ? ' three' : ''}" data-r="${id}">${head}${it.keys.map((r) => r.map((c, j) => (j ? `<span>${c}</span>` : `<span class="a">${esc(c)}</span>`)).join('') + (three && r.length < 3 ? '<span></span>' : '')).join('')}</div>`;
    }
    const lab = esc(it.label);
    if (it.range) {
      const [a, b, s] = it.range;
      return `<label class="ddvol-r st" data-r="${id}"><span>${lab}</span><input type="range" min="${a}" max="${b}" step="${s}" data-i="${id}" aria-label="${lab}"><output data-o="${id}"></output></label>`;
    }
    if (it.options) {
      return `<div class="ddvol-c" data-r="${id}" role="group" aria-label="${lab}"><span>${lab}</span><div class="ddvol-seg">${it.options.map((o, j) => `<button type="button" data-i="${id}" data-v="${j}" aria-pressed="false">${esc(o[1])}</button>`).join('')}</div></div>`;
    }
    return `<div class="ddvol-s" data-r="${id}"><span id="ddvol-l${id.replace('.', '-')}">${lab}</span><button type="button" class="ddvol-sw" role="switch" data-i="${id}" aria-checked="false" aria-labelledby="ddvol-l${id.replace('.', '-')}"></button></div>`;
  }
  function render() {
    let h = '<div class="ddvol-h"><b>Réglages</b><button type="button" class="ddvol-x" aria-label="Fermer" title="Fermer">×</button></div>';
    if (cur.kinds.length) h += '<section><h3>Son</h3>' + cur.kinds.map((k) => `<label class="ddvol-r"><span>${LABEL[k]}</span><input type="range" min="0" max="100" step="5" data-k="${k}" aria-label="Volume ${LABEL[k].toLowerCase()}"><output data-o="${k}"></output></label>`).join('') + '</section>';
    cur.sections.forEach((s, si) => {
      h += `<section data-s="${si}"><h3>${esc(s.title || 'Jeu')}</h3>${(s.items || []).map((it, ii) => itemHtml(it, si + '.' + ii)).join('')}${s.hint ? `<p class="ddvol-hint">${s.hint}</p>` : ''}</section>`;
    });
    if (cur.hint) h += `<p class="ddvol-hint">${cur.hint}</p>`;
    pop.innerHTML = h;
    // tableau de commandes à trois colonnes (clavier et manette) : panneau plus large
    pop.classList.toggle('wide', cur.sections.some((s) => (s.items || []).some((it) => it.bind || (it.keys && it.keys.some((r) => r.length > 2)))));
    pop.style.setProperty('--ddvol-a', cur.accent || '#5aa9ff');
    pop.style.setProperty('--ddvol-on', onColor(cur.accent || '#5aa9ff'));
  }
  const hid = (o) => { try { return !!(o.hidden && o.hidden()); } catch (e) { return false; } };
  function refresh() {
    if (!pop || pop.hidden || !cur) return;
    for (const k of cur.kinds) {
      const r = pop.querySelector(`[data-k="${k}"]`), o = pop.querySelector(`[data-o="${k}"]`);
      if (!r) continue;
      if (document.activeElement !== r) r.value = Math.round(lv[k] * 100);
      o.textContent = pct(lv[k]); o.classList.toggle('off', !(lv[k] > 0));
    }
    cur.sections.forEach((s, si) => {
      const sec = pop.querySelector(`[data-s="${si}"]`);
      if (sec) sec.hidden = hid(s);
      (s.items || []).forEach((it, ii) => {
        const id = si + '.' + ii;
        const row = pop.querySelector(`[data-r="${id}"], [data-n="${id}"]`);
        if (row) row.hidden = hid(it);
        if (it.keys) return;
        if (it.bind) {
          for (const [a, , ks] of it.bind.rows()) for (let k = 0; k < 2; k++) {
            const b = pop.querySelector(`.ddvol-key[data-i="${id}"][data-b="${a}"][data-s="${k}"]`);
            if (!b || (wait && wait.btn === b)) continue;
            b.textContent = ks[k] || '—'; b.classList.toggle('empty', !ks[k]); b.title = ks[k] || '';
          }
          return;
        }
        if (it.note) { const n = pop.querySelector(`[data-n="${id}"]`); let t = ''; try { t = it.note() || ''; } catch (e) {} n.textContent = t; n.hidden = n.hidden || !t; return; }
        let v; try { v = it.get(); } catch (e) { v = null; }
        if (it.range) {
          const r = pop.querySelector(`input[data-i="${id}"]`);
          if (document.activeElement !== r) r.value = v;
          pop.querySelector(`[data-o="${id}"]`).textContent = it.format ? it.format(v) : String(v);
        } else if (it.options) {
          pop.querySelectorAll(`button[data-i="${id}"]`).forEach((b) => b.setAttribute('aria-pressed', String(it.options[+b.dataset.v][0] === v)));
        } else pop.querySelector(`button[data-i="${id}"]`).setAttribute('aria-checked', String(!!v));
      });
    });
  }
  // sous le bouton, aligné sur son bord droit (au-dessus faute de place)
  function place() {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth || 300, h = pop.offsetHeight || 140, m = 8;
    let top = r.bottom + m;
    if (top + h > innerHeight - m && r.top - m - h > m) top = r.top - m - h;
    pop.style.left = Math.round(Math.min(innerWidth - w - m, Math.max(m, r.right - w))) + 'px';
    pop.style.top = Math.round(Math.max(m, Math.min(innerHeight - h - m, top))) + 'px';
  }
  function close() {
    if (!pop || pop.hidden) return;
    if (wait) { wait.btn.classList.remove('wait'); wait = null; }
    pop.hidden = true; clearInterval(watch);
    if (anchor) anchor.setAttribute('aria-expanded', 'false');
    anchor = null;
  }
  function open(button, o) {
    if (!pop) build();
    if (anchor && anchor !== button) anchor.setAttribute('aria-expanded', 'false');
    anchor = button; cur = o;
    render();
    pop.hidden = false; button.setAttribute('aria-expanded', 'true');
    refresh(); place();
    const first = pop.querySelector('input, .ddvol-sw, .ddvol-seg button');
    if (first) first.focus({ preventScroll: true });
    // le bouton disparaît (menu refermé, écran changé) : le panneau aussi ; les notes se mettent à jour
    clearInterval(watch);
    watch = setInterval(() => {
      if (!anchor || !anchor.isConnected || !anchor.getClientRects().length) close();
      else if (cur.sections.some((s) => (s.items || []).some((it) => it.note))) refresh();
    }, 400);
  }
  // button : bouton du jeu qui ouvre (ou referme) le panneau
  function panel(button, opts = {}) {
    if (!button) return null;
    const o = { kinds: KINDS, sections: [], ...opts };
    o.kinds = (o.kinds || []).filter((k) => k in lv);
    button.setAttribute('aria-haspopup', 'dialog'); button.setAttribute('aria-expanded', 'false');
    if (!button.title) button.title = 'Réglages';
    if (!button.getAttribute('aria-label')) button.setAttribute('aria-label', 'Réglages');
    button.addEventListener('click', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (anchor === button && pop && !pop.hidden) close(); else open(button, o);
    });
    return { open: () => open(button, o), close, refresh, isOpen: () => anchor === button && !!pop && !pop.hidden };
  }

  window.DDVolume = V;
})();
