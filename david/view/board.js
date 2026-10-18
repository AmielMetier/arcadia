// Plateau en 3D (CSS) : cases, coins illustrés, centre niçois, pions, bâtiments, propriétaires, caméra.
// Le plateau est un plan de 880 × 880 px incliné ; pions et bâtiments sont des « panneaux » toujours face à l'écran.
import { SIZE, CORNER, rect, side, pawnSpot, buildSpots, center } from './geometry.js';
import { ICONS, spaceIcon, pawnSvg } from './icons.js';
import { esc, money, el, wait, store, save } from './util.js';

const TILT_3D = 52;
// Nom affiché sur la case (le titre de propriété garde le nom complet)
const shortName = (n) => n.replace(/^Boulevard /, 'Bd ').replace(/^Avenue /, 'Av. ').replace(/^Taxe de luxe — /, 'Taxe de luxe · ');

function centerArt() {
  const c = SIZE - 2 * CORNER; // 648
  return `<svg class="center-art" viewBox="0 0 ${c} ${c}" aria-hidden="true">
    <defs>
      <linearGradient id="sea" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d9f0fa"/><stop offset=".55" stop-color="#9FD8F5"/><stop offset="1" stop-color="#5fb3e3"/></linearGradient>
      <pattern id="waves" width="60" height="26" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><path d="M0 13 q15 -10 30 0 t30 0" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="2"/></pattern>
    </defs>
    <rect width="${c}" height="${c}" fill="url(#sea)"/>
    <rect width="${c}" height="${c}" fill="url(#waves)"/>
    <g transform="translate(${c / 2} ${c / 2}) rotate(-45)">
      <rect x="-300" y="-54" width="600" height="108" rx="16" fill="#e3262f" stroke="#16181d" stroke-width="6"/>
      <rect x="-300" y="-54" width="600" height="20" rx="10" fill="#ff6a50" opacity=".55"/>
      <text x="0" y="16" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="60" fill="#fff8ea" stroke="#16181d" stroke-width="5" paint-order="stroke">DavidSimulator</text>
      <text x="0" y="44" text-anchor="middle" font-family="'Chakra Petch',sans-serif" font-weight="700" font-size="17" letter-spacing="9" fill="#fff8ea">ÉDITION NICE</text>
    </g>
    <g transform="translate(150 150) rotate(-45)">
      <rect x="-92" y="-56" width="184" height="112" rx="12" fill="#0f3f7a" transform="translate(7 7)"/>
      <rect x="-92" y="-56" width="184" height="112" rx="12" fill="#1C5FB4" stroke="#16181d" stroke-width="5"/>
      <rect x="-80" y="-44" width="160" height="88" rx="8" fill="none" stroke="#fff8ea" stroke-width="2.5" stroke-dasharray="6 5"/>
      <text x="0" y="-6" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="20" fill="#fff8ea">CAISSE DE</text>
      <text x="0" y="20" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="20" fill="#fff8ea">COMMUNAUTÉ</text>
    </g>
    <g transform="translate(${c - 150} ${c - 150}) rotate(-45)">
      <rect x="-92" y="-56" width="184" height="112" rx="12" fill="#a8510a" transform="translate(7 7)"/>
      <rect x="-92" y="-56" width="184" height="112" rx="12" fill="#F7941D" stroke="#16181d" stroke-width="5"/>
      <text x="0" y="34" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="84" fill="#fff8ea" stroke="#16181d" stroke-width="4" paint-order="stroke">?</text>
      <text x="0" y="-30" text-anchor="middle" font-family="Bungee,Impact,sans-serif" font-size="16" fill="#16181d">CHANCE</text>
    </g>
    <g transform="translate(560 96)">
      <circle r="30" fill="#ffc531" stroke="#16181d" stroke-width="5"/>
    </g>
    <g transform="translate(64 498) scale(.82)" stroke="#16181d" stroke-width="4" stroke-linejoin="round" stroke-linecap="round">
      <path d="M0 110 C 4 70 10 40 22 10" fill="none"/>
      <path d="M22 10 C 0 0 -24 8 -34 22 M22 10 C 40 -6 64 0 72 14 M22 10 C 12 -14 28 -32 46 -32 M22 10 C 30 -10 6 -26 -14 -20" fill="none" stroke-width="5"/>
      <path d="M22 10 C 0 0 -24 8 -34 22 M22 10 C 40 -6 64 0 72 14 M22 10 C 12 -14 28 -32 46 -32 M22 10 C 30 -10 6 -26 -14 -20" fill="none" stroke="#2fbf71" stroke-width="2.5"/>
    </g>
    <g transform="translate(120 616) scale(.8)" stroke="#16181d" stroke-width="4" stroke-linejoin="round">
      ${[0, 1, 2].map((k) => `<g transform="translate(${k * 52} ${k * -18})"><path d="M0 0 L0 -30 L22 -30 L22 0 M0 -14 L30 -14 L34 0" fill="none" stroke="#2b8cff" stroke-width="7" stroke-linecap="round"/><path d="M0 0 L0 -30 L22 -30 L22 0 M0 -14 L30 -14 L34 0" fill="none" stroke-width="2"/></g>`).join('')}
    </g>
  </svg>`;
}

function cornerHtml(sp) {
  switch (sp.type) {
    case 'go': return `<div class="corner go"><b>DÉPART</b><span class="ico big">${ICONS.go}</span><small>Recevez ${money(sp.salary)}<br>en passant</small></div>`;
    case 'jail': return `<div class="corner jail"><div class="cellblock"><span class="ico">${ICONS.bars}</span><b>EN PRISON</b></div><small class="visit v1">SIMPLE</small><small class="visit v2">VISITE</small></div>`;
    case 'parking': return `<div class="corner parking"><b>PARC GRATUIT</b><span class="ico big">${ICONS.hill}</span><small>Colline du Château</small></div>`;
    case 'gotojail': return `<div class="corner gotojail"><b>ALLEZ EN<br>PRISON</b><span class="ico big">${ICONS.police}</span></div>`;
    default: return '';
  }
}

export function mountBoard(host, board, { onCell } = {}) {
  const stage = el('div', 'stage');
  const cam = el('div', 'camera');
  const plane = el('div', 'plane');
  plane.style.width = plane.style.height = SIZE + 'px';
  cam.appendChild(plane); stage.appendChild(cam); host.appendChild(stage);

  // socle et centre
  plane.appendChild(el('div', 'plinth'));
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
    c.onclick = () => onCell && onCell(sp.i);
    plane.appendChild(c);
    cells[sp.i] = c;
  }

  const layer = el('div', 'pieces');
  plane.appendChild(layer);

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
      const e = el('div', 'pawn3d', `<i class="shadow"></i><div class="sprite">${pawnSvg(p.color, esc((p.name || '?')[0].toUpperCase()))}</div>`);
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
    is3d: () => view.tilt > 0,
    toggle3d() { view.tilt = view.tilt ? 0 : TILT_3D; save('david_view3d', view.tilt > 0); fit(); },
    follow: () => view.follow,
    toggleFollow() { view.follow = !view.follow; save('david_follow', view.follow); if (!view.follow) api.relax(); },
    fit,
  };
  requestAnimationFrame(fit);
  return api;
}
