// Plateau en 3D (CSS) : cases, coins illustrés, centre niçois, pions, bâtiments, propriétaires, caméra.
// Le plateau est un plan de 880 × 880 px incliné ; pions et bâtiments sont des « panneaux » toujours face à l'écran.
import { SIZE, CORNER, rect, side, pawnSpot, buildSpots, center, cellAt, homography } from './geometry.js';
import { ICONS, spaceIcon } from './icons.js';
import { tokenSvg } from './tokens.js';
import { esc, money, el, wait, store, save } from './util.js';

const TILT_3D = 52;
// Nom affiché sur la case (le titre de propriété garde le nom complet)
const shortName = (n) => n.replace(/^Boulevard /, 'Bd ').replace(/^Avenue /, 'Av. ').replace(/^Taxe de luxe — /, 'Taxe de luxe · ');

export function centerArt() {
  const c = SIZE - 2 * CORNER; // 648
  const deck = (cx, cy, face, back, label, icon) => `
    <g transform="translate(${cx} ${cy}) rotate(-45)">
      <rect x="-104" y="-66" width="208" height="132" rx="10" fill="none" stroke="#16181d" stroke-width="2.5" stroke-dasharray="8 6"/>
      ${[6, 4, 2].map((o) => `<rect x="${-88 + o}" y="${-54 + o}" width="176" height="108" rx="9" fill="${back}" stroke="#16181d" stroke-width="2"/>`).join('')}
      <rect x="-88" y="-54" width="176" height="108" rx="9" fill="${face}" stroke="#16181d" stroke-width="3"/>
      <rect x="-80" y="-46" width="160" height="92" rx="6" fill="none" stroke="#fff8ea" stroke-width="2"/>
      ${icon}
      <text x="0" y="40" text-anchor="middle" class="deckl" textLength="150" lengthAdjust="spacingAndGlyphs">${label}</text>
    </g>`;
  return `<svg class="center-art" viewBox="0 0 ${c} ${c}" aria-hidden="true">
    <defs>
      <radialGradient id="mint" cx=".5" cy=".45" r=".75"><stop offset="0" stop-color="#e4f2e5"/><stop offset="1" stop-color="#c3e0c8"/></radialGradient>
    </defs>
    <rect width="${c}" height="${c}" fill="url(#mint)"/>
    <rect x="10" y="10" width="${c - 20}" height="${c - 20}" fill="none" stroke="#16181d" stroke-opacity=".18" stroke-width="2"/>
    <g opacity=".5" stroke="#1C5FB4" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round">
      ${[0, 1, 2].map((k) => `<path transform="translate(${60 + k * 42} ${616 - k * 14})" d="M0 0 L0 -26 L19 -26 L19 0 M0 -12 L26 -12 L30 0"/>`).join('')}
      ${[0, 1, 2].map((k) => `<path transform="translate(${470 + k * 42} ${70 - k * 14})" d="M0 0 L0 -26 L19 -26 L19 0 M0 -12 L26 -12 L30 0"/>`).join('')}
    </g>
    ${deck(160, 160, '#1C5FB4', '#123f78', 'CAISSE DE COMMUNAUTÉ',
      '<g transform="translate(0 -10) scale(1.5)"><rect x="-17" y="-6" width="34" height="22" rx="3" fill="#ffc531" stroke="#16181d" stroke-width="2.2"/><path d="M-17 -6 Q0 -20 17 -6" fill="#ffdd75" stroke="#16181d" stroke-width="2.2"/><rect x="-4" y="-2" width="8" height="8" rx="1.5" fill="#16181d"/></g>')}
    ${deck(c - 160, c - 160, '#F7941D', '#b45f0b', 'CHANCE',
      '<text x="0" y="22" text-anchor="middle" class="deckq">?</text>')}
    <g transform="translate(${c / 2} ${c / 2}) rotate(-45)">
      <rect x="-312" y="-62" width="624" height="124" rx="6" fill="#16181d"/>
      <rect x="-304" y="-54" width="608" height="108" rx="4" fill="#e3262f" stroke="#fff8ea" stroke-width="3"/>
      <text x="0" y="20" text-anchor="middle" class="logo" textLength="540" lengthAdjust="spacingAndGlyphs">DAVIDSIMULATOR</text>
      <text x="0" y="45" text-anchor="middle" class="logosub" textLength="330" lengthAdjust="spacingAndGlyphs">ÉDITION NICE · CÔTE D'AZUR</text>
    </g>
  </svg>`;
}

function cornerHtml(sp) {
  switch (sp.type) {
    case 'go': return `<div class="corner go"><div class="rot"><small>Recevez ${money(sp.salary)}<br>de salaire en passant</small><b>DÉPART</b></div><span class="arrow">${ICONS.go}</span></div>`;
    case 'jail': return `<div class="corner jail"><div class="cellblock"><span class="ico">${ICONS.bars}</span><b>EN<br>PRISON</b></div><small class="visit v1">SIMPLE</small><small class="visit v2">VISITE</small></div>`;
    case 'parking': return `<div class="corner parking"><div class="rot"><b>PARC</b><span class="ico big">${ICONS.hill}</span><b>GRATUIT</b><small>Colline du Château</small></div><span class="pot" hidden></span></div>`;
    case 'gotojail': return `<div class="corner gotojail"><div class="rot r2"><b>ALLEZ EN</b><span class="ico big">${ICONS.police}</span><b>PRISON</b></div></div>`;
    default: return '';
  }
}

export function mountBoard(host, board, { onCell } = {}) {
  const stage = el('div', 'stage');
  const cam = el('div', 'camera');
  const plane = el('div', 'plane');
  plane.style.width = plane.style.height = SIZE + 'px';
  cam.appendChild(plane); stage.appendChild(cam); host.appendChild(stage);

  // socle épais (faces visibles depuis la caméra) et centre
  plane.appendChild(el('div', 'plinth'));
  for (const f of ['front', 'left', 'right']) plane.appendChild(el('div', 'slab ' + f));
  const mid = el('div', 'mid', centerArt());
  Object.assign(mid.style, { left: CORNER + 'px', top: CORNER + 'px', width: SIZE - 2 * CORNER + 'px', height: SIZE - 2 * CORNER + 'px' });
  plane.appendChild(mid);

  // cases
  const cells = [];
  for (const sp of board.spaces) {
    const r = rect(sp.i), s = side(sp.i);
    const c = el('button', `cell s-${s} t-${sp.type}`);
    Object.assign(c.style, { left: r.x + 'px', top: r.y + 'px', width: r.w + 'px', height: r.h + 'px' });
    c.dataset.i = sp.i;
    c.setAttribute('aria-label', sp.name + (sp.price ? `, ${sp.price} euros` : ''));
    if (s === 'corner') c.innerHTML = cornerHtml(sp);
    else {
      const band = sp.type === 'street' ? `<i class="band" style="background:${sp.color}"></i>` : '';
      const ic = spaceIcon(sp);
      const price = sp.price ? money(sp.price) : sp.amount ? 'Payez ' + money(sp.amount) : '';
      c.innerHTML = `${band}<span class="body">${ic ? `<span class="ico">${ic}</span>` : ''}<span class="cname" lang="fr">${esc(shortName(sp.name))}</span>${price ? `<span class="cprice">${price}</span>` : ''}</span>
        <i class="own"></i><i class="stampm">HYPOTHÉQUÉE</i>`;
    }
    c.onclick = (e) => { if (e.detail === 0 && onCell) onCell(sp.i); }; // clavier (Entrée / Espace)
    plane.appendChild(c);
    cells[sp.i] = c;
  }

  const layer = el('div', 'pieces');
  plane.appendChild(layer);

  /* ---------------------------------------------------------- pointeur → case
     Le navigateur détecte mal les clics sur un plan incliné en 3D : on repère les 4 coins
     du plateau à l'écran et on inverse la projection (homographie) pour trouver la case visée. */
  const marks = [[0, 0], [SIZE, 0], [SIZE, SIZE], [0, SIZE]].map(([x, y]) => {
    const m = el('i', 'mk'); m.style.left = x + 'px'; m.style.top = y + 'px'; plane.appendChild(m); return m;
  });
  function pickCell(cx, cy) {
    const scr = marks.map((m) => { const b = m.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
    const [x, y] = homography(scr, [[0, 0], [SIZE, 0], [SIZE, SIZE], [0, SIZE]])(cx, cy);
    return cellAt(x, y);
  }
  let hover = -1;
  stage.addEventListener('pointermove', (e) => {
    const i = pickCell(e.clientX, e.clientY);
    if (i === hover) return;
    if (hover >= 0) cells[hover].classList.remove('hov');
    hover = i; if (i >= 0) cells[i].classList.add('hov');
    stage.style.cursor = i >= 0 ? 'pointer' : '';
  });
  stage.addEventListener('pointerleave', () => { if (hover >= 0) cells[hover].classList.remove('hov'); hover = -1; });
  stage.addEventListener('click', (e) => { const i = pickCell(e.clientX, e.clientY); if (i >= 0 && onCell) onCell(i); });

  /* ---------------------------------------------------------- caméra */
  const view = { tilt: store('david_view3d', true) ? TILT_3D : 0, fit: 1, focus: null, zoom: 1, follow: store('david_follow', true) };
  function applyCam(instant) {
    const f = view.focus;
    const dx = f ? (SIZE / 2 - f.x) * 0.55 : 0, dy = f ? (SIZE / 2 - f.y) * 0.55 : 0;
    const z = f ? view.zoom : 1;
    if (instant) cam.style.transition = 'none';
    cam.style.setProperty('--tilt', view.tilt + 'deg');
    plane.style.setProperty('--tilt', view.tilt + 'deg');
    cam.style.transform = `scale(${view.fit * z}) rotateX(${view.tilt}deg) translate(${dx}px, ${dy}px)`;
    if (instant) { void cam.offsetWidth; cam.style.transition = ''; }
  }
  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight;
    if (!W || !H) return;
    const f = view.focus; view.focus = null;
    view.fit = 1; applyCam(true);
    for (let k = 0; k < 2; k++) {
      const b = plane.getBoundingClientRect();
      view.fit *= Math.min((W * 0.98) / b.width, (H * 0.97) / b.height);
      applyCam(true);
    }
    view.focus = f; applyCam(true);
  }
  new ResizeObserver(() => fit()).observe(stage);

  /* ---------------------------------------------------------- pions */
  const pawns = new Map(); // id → { el, pos, inJail }
  function ensurePawn(p) {
    let o = pawns.get(p.id);
    if (!o) {
      const e = el('div', 'pawn3d', `<i class="shadow"></i><div class="sprite">${tokenSvg(p.token, p.color)}</div>`);
      layer.appendChild(e);
      o = { el: e, pos: p.pos, inJail: p.inJail };
      pawns.set(p.id, o);
    }
    return o;
  }
  function place(o, x, y) { o.el.style.transform = `translate3d(${x}px, ${y}px, 0)`; o.x = x; o.y = y; }
  function layoutPawns(players) {
    const groups = new Map();
    for (const p of players) {
      if (p.bankrupt) continue;
      const o = pawns.get(p.id); if (!o) continue;
      const key = o.pos + (o.pos === 10 && o.inJail ? 'j' : '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(o);
    }
    for (const list of groups.values()) list.forEach((o, k) => { const s = pawnSpot(o.pos, k, list.length, o.inJail); place(o, s.x, s.y); });
  }

  /* ---------------------------------------------------------- bâtiments */
  const builds = new Map(); // i → { key, els }
  function setBuildings(i, houses, hotel, animate) {
    const key = hotel ? 'H' : String(houses);
    const cur = builds.get(i);
    if (cur && cur.key === key) return;
    const before = cur ? cur.els.length : 0;
    if (cur) cur.els.forEach((e) => e.remove());
    const spots = buildSpots(i, hotel ? 1 : houses, hotel);
    const els = spots.map((s, k) => {
      const e = el('div', 'bld3d' + (hotel ? ' hotel' : ''), `<div class="sprite">${hotel ? ICONS.hotel : ICONS.house}</div>`);
      e.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      if (animate && (hotel || k >= before)) e.classList.add('drop');
      layer.appendChild(e);
      return e;
    });
    builds.set(i, { key, els });
  }

  /* ---------------------------------------------------------- API */
  const api = {
    stage, cells,
    // Synchronisation sans animation (ou presque) avec un état
    sync(S, { animateBuild = false } = {}) {
      for (const p of S.players) {
        const o = ensurePawn(p);
        o.pos = p.pos; o.inJail = p.inJail;
        o.el.classList.toggle('gone', p.bankrupt);
        o.el.classList.toggle('jailed', p.inJail);
      }
      layoutPawns(S.players);
      const pot = cells[20].querySelector('.pot');
      if (pot) { pot.hidden = !S.cfg.freeParkingJackpot; pot.textContent = money(S.pot || 0); }
      for (const sp of board.spaces) {
        const pr = S.props[sp.i]; if (!pr) continue;
        const c = cells[sp.i], owner = S.players.find((q) => q.id === pr.owner);
        c.classList.toggle('owned', !!owner);
        c.style.setProperty('--own', owner ? owner.color : 'transparent');
        c.classList.toggle('mort', !!pr.mortgaged);
        if (sp.type === 'street') setBuildings(sp.i, pr.houses, pr.hotel, animateBuild);
      }
    },
    setCurrent(id) { for (const [pid, o] of pawns) o.el.classList.toggle('cur', pid === id); },
    markOwner(i, color) { const c = cells[i]; c.classList.toggle('owned', !!color); c.style.setProperty('--own', color || 'transparent'); },
    select(i) { for (const c of cells) c.classList.toggle('sel', +c.dataset.i === i); },
    pulse(i) { for (const c of cells) c.classList.toggle('pulse', +c.dataset.i === i); },
    // Déplacement case par case (steps négatif : recul)
    async hop(pid, steps, speed = 1) {
      const o = pawns.get(pid); if (!o || !steps) return;
      const dir = Math.sign(steps), n = Math.abs(steps);
      const dur = Math.max(70, 190 / speed);
      o.el.classList.add('moving'); o.inJail = false;
      if (view.follow && speed <= 1.5) { view.focus = center(o.pos); view.zoom = stage.clientWidth < 700 ? 1.08 : 1.28; applyCam(); }
      for (let k = 0; k < n; k++) {
        o.pos = (o.pos + dir + 40) % 40;
        const s = pawnSpot(o.pos, 0, 1, false);
        o.el.style.transition = `transform ${dur}ms cubic-bezier(.3,.7,.4,1)`;
        place(o, s.x, s.y);
        const sprite = o.el.querySelector('.sprite');
        sprite.animate([{ translate: '0 0' }, { translate: '0 -26px', offset: 0.45 }, { translate: '0 0' }], { duration: dur, easing: 'ease-out' });
        if (view.follow && speed <= 1.5 && k % 3 === 2) { view.focus = center(o.pos); applyCam(); }
        api.onStep && api.onStep(o.pos, speed);
        await wait(dur);
      }
      if (view.follow && speed <= 1.5) { view.focus = center(o.pos); applyCam(); }
      o.el.classList.remove('moving');
      o.el.style.transition = '';
    },
    // Téléportation en glissant (prison)
    async slide(pid, to, inJail, speed = 1) {
      const o = pawns.get(pid); if (!o) return;
      o.pos = to; o.inJail = inJail;
      const s = pawnSpot(to, 0, 1, inJail);
      const dur = 650 / speed;
      o.el.style.transition = `transform ${dur}ms cubic-bezier(.5,0,.3,1)`;
      place(o, s.x, s.y);
      await wait(dur);
      o.el.style.transition = '';
    },
    relax() { if (view.focus) { view.focus = null; applyCam(); } },
    // Position à l'écran du centre d'une case (pour les effets)
    pickCell,
    cellScreen(i) { const b = cells[i].getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; },
    pawnScreen(pid) { const o = pawns.get(pid); if (!o) return null; const b = o.el.querySelector('.sprite').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; },
    // Heatmap posée sur les cases : [{ bg, ink, label } | null] × 40, ou null pour l'enlever
    heat(list) {
      for (const c of cells) {
        const h = list && list[+c.dataset.i];
        c.classList.toggle('heated', !!h);
        if (h) { c.style.setProperty('--heat', h.bg); c.style.setProperty('--heatInk', h.ink); c.dataset.heat = h.label; }
        else delete c.dataset.heat;
      }
    },
    // Arrivée des pions sur Départ, l'un après l'autre
    intro() {
      let k = 0;
      for (const o of pawns.values()) {
        const sp = o.el.querySelector('.sprite');
        sp.animate([{ translate: '0 0 260px', opacity: 0 }, { translate: '0 0 0', opacity: 1, offset: 0.7 }, { translate: '0 0 18px', offset: 0.85 }, { translate: '0 0 0', opacity: 1 }],
          { duration: 700, delay: 300 + k * 260, easing: 'cubic-bezier(.4,0,.6,1)', fill: 'backwards' });
        setTimeout(() => api.onStep && api.onStep(0, 1), 300 + k * 260 + 480);
        k++;
      }
    },
    is3d: () => view.tilt > 0,
    toggle3d() { view.tilt = view.tilt ? 0 : TILT_3D; save('david_view3d', view.tilt > 0); fit(); },
    follow: () => view.follow,
    toggleFollow() { view.follow = !view.follow; save('david_follow', view.follow); if (!view.follow) api.relax(); },
    fit,
  };
  requestAnimationFrame(fit);
  return api;
}
