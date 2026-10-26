// L'interface en jeu : minicarte (nord en haut, flèche du joueur, tempête), nom du lieu, viseur qui s'ouvre avec la
// dispersion, barres de vie et de bouclier, inventaire (outil + 5 cases, couleur de rareté), munitions, matériaux,
// survivants et éliminations, chrono de la tempête, fil des éliminations, marqueur de touche, chiffres de dégâts,
// direction des tirs reçus, jauge de soin et de rechargement, lunette du fusil de précision, messages au centre,
// et la grande carte (touche M). Les cartes sont dessinées par view/maprender.js, comme l'aperçu de l'île.
import { terrainImage, drawMap, gridRef } from './maprender.js';
import { GROUND } from '../engine/map.js';
import { WEAPONS, ITEMS, AMMO, RARITY, MATERIALS, itemLabel } from '../engine/items.js';

const MINI_S = 1.15; // pixels par mètre sur la minicarte
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ pictogrammes des objets (silhouettes au canevas)
const iconCache = new Map();
export function itemIcon(it) {
  const key = it ? it.t + (it.w || it.c || it.a || it.m) : 'pioche';
  if (iconCache.has(key)) return iconCache.get(key);
  const c = document.createElement('canvas'); c.width = 96; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff'; g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 3; g.lineJoin = 'round';
  const R = (x, y, w, h) => { g.beginPath(); g.rect(x, y, w, h); g.fill(); g.stroke(); };
  const C = (x, y, r) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke(); };
  const shapes = {
    pioche: () => { g.save(); g.translate(48, 34); g.rotate(-0.6); R(-4, -26, 8, 52); g.fillStyle = '#ffd8c8'; R(-24, -30, 48, 10); g.restore(); },
    fusil: () => { R(8, 26, 60, 12); R(66, 29, 22, 5); R(36, 36, 9, 16); R(20, 36, 10, 12); R(2, 24, 14, 12); },
    pompe: () => { R(14, 26, 46, 13); R(58, 28, 30, 7); R(56, 36, 18, 7); R(2, 28, 16, 14); },
    pistolet: () => { R(26, 22, 42, 12); R(30, 32, 12, 22); },
    smg: () => { R(16, 24, 46, 13); R(60, 27, 16, 6); R(40, 36, 8, 22); R(20, 36, 9, 10); },
    sniper: () => { R(4, 28, 74, 10); R(76, 30, 18, 5); R(30, 16, 30, 9); R(2, 30, 16, 14); },
    roquette: () => { R(6, 22, 84, 16); R(30, 36, 9, 14); R(60, 14, 10, 9); },
    bandage: () => { g.fillStyle = '#f5efe6'; C(48, 32, 18); g.fillStyle = '#e8473a'; R(30, 28, 36, 8); },
    soin: () => { g.fillStyle = '#f5efe6'; R(24, 14, 48, 38); g.fillStyle = '#e8473a'; R(43, 20, 10, 26); R(35, 28, 26, 10); },
    potion_petite: () => { g.fillStyle = '#5aa8ff'; C(48, 38, 15); g.fillStyle = '#ddd'; R(43, 14, 10, 12); },
    potion: () => { g.fillStyle = '#5aa8ff'; R(32, 22, 32, 34); g.fillStyle = '#ddd'; R(42, 10, 12, 12); },
    grenade: () => { g.fillStyle = '#7f9a5a'; C(48, 36, 16); g.fillStyle = '#ccc'; R(44, 14, 8, 10); },
    souffle: () => { g.fillStyle = '#b07ae8'; C(48, 36, 16); g.fillStyle = '#f2d060'; R(44, 14, 8, 10); },
    tremplin: () => { g.fillStyle = '#f2c14e'; R(14, 34, 68, 12); g.fillStyle = '#e8473a'; g.beginPath(); g.moveTo(48, 10); g.lineTo(62, 30); g.lineTo(34, 30); g.closePath(); g.fill(); g.stroke(); },
  };
  (shapes[it ? it.w || it.c : 'pioche'] || (() => R(24, 20, 48, 26)))();
  const url = c.toDataURL();
  iconCache.set(key, url);
  return url;
}

export function createHud(map, { onTeleport, project } = {}) {
  const img = terrainImage(map, { ppm: 0.5 });
  const mini = $('#mini'), mctx = mini.getContext('2d');
  const big = $('#bigmap'), bcv = big.querySelector('canvas'), bctx = bcv.getContext('2d');
  const place = $('#place'), fps = $('#fps'), promptEl = $('#prompt');
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  const LAY_MINI = { relief: true, routes: true, batiments: true, vegetation: true, vehicules: false, coffres: false, noms: false, grille: false, tempete: false, vol: false };
  const LAY_BIG = { relief: true, routes: true, batiments: true, vegetation: true, vehicules: true, coffres: false, noms: true, grille: true, tempete: false, vol: false };
  let last = 0, bigView = null, lastSide = 0;
  const S = { storm: null, flight: null };

  const arrow = (ctx, x, y, yaw, r = 9, color = '#ffd23f') => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw)));
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r * 0.65); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.7, r * 0.65); ctx.closePath();
    ctx.fillStyle = color; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 2.2; ctx.fill(); ctx.stroke();
    ctx.restore();
  };
  const mapOpts = (L) => {
    const o = { layers: { ...L }, level: 0 };
    if (S.storm) { o.layers.tempete = true; o.storm = [S.storm.cur, S.storm.next]; o.phase = 0; }
    if (S.flight) { o.layers.vol = true; o.flight = S.flight; }
    return o;
  };

  // ------------------------------------------------------------------ cartes
  function maps(t, p, yaw, frameMs) {
    if (t - last > 0.12) {
      last = t;
      const W = mini.clientWidth, H = mini.clientHeight, d = dpr();
      if (mini.width !== Math.round(W * d)) { mini.width = Math.round(W * d); mini.height = Math.round(H * d); }
      drawMap(mctx, map, img, { x: p.x, z: p.z, s: MINI_S, w: W, h: H, dpr: d }, mapOpts(LAY_MINI));
      mctx.setTransform(d, 0, 0, d, 0, 0);
      arrow(mctx, W / 2, H / 2, yaw);
      const poi = map.poiAt(p.x, p.z);
      place.textContent = `${gridRef(map, p.x, p.z)} · ${poi ? poi.name : GROUND[map.groundAt(p.x, p.z)]}`;
      if (!fps.hidden) fps.textContent = `${Math.round(1000 / Math.max(1, frameMs))} i/s · ${frameMs.toFixed(1)} ms`;
    }
    if (!big.hidden) drawBig(p, yaw);
  }
  function drawBig(p, yaw) {
    const W = bcv.clientWidth, H = bcv.clientHeight, d = dpr();
    if (bcv.width !== Math.round(W * d) || bcv.height !== Math.round(H * d)) { bcv.width = Math.round(W * d); bcv.height = Math.round(H * d); }
    if (!bigView) bigView = { x: map.center, z: map.center, s: Math.min(W, H) / (map.stats.spanM + 120) };
    drawMap(bctx, map, img, { ...bigView, w: W, h: H, dpr: d }, mapOpts(LAY_BIG));
    bctx.setTransform(d, 0, 0, d, 0, 0);
    arrow(bctx, (p.x - bigView.x) * bigView.s + W / 2, (p.z - bigView.z) * bigView.s + H / 2, yaw, 12);
  }
  bcv.addEventListener('click', (e) => {
    if (!bigView || !onTeleport) return;
    const r = bcv.getBoundingClientRect();
    const x = bigView.x + (e.clientX - r.left - r.width / 2) / bigView.s, z = bigView.z + (e.clientY - r.top - r.height / 2) / bigView.s;
    if (x > 0 && z > 0 && x < map.size && z < map.size) onTeleport(x, z);
  });
  addEventListener('resize', () => { bigView = null; });

  // ------------------------------------------------------------------ joueur : vie, inventaire, munitions
  const inv = $('#inv'), bars = $('#bars'), ammoEl = $('#ammo'), resEl = $('#res'), stats = $('#stats'), stormEl = $('#storm');
  let invKey = '';
  function player(P, extra) {
    // barres
    bars.querySelector('.hp i').style.width = Math.max(0, P.hp) + '%';
    bars.querySelector('.sh i').style.width = Math.max(0, P.sh) + '%';
    bars.querySelector('.hp b').textContent = Math.ceil(Math.max(0, P.hp));
    bars.querySelector('.sh b').textContent = Math.ceil(P.sh);
    // inventaire : redessiné quand il change
    const k = P.sel + '|' + P.inv.map((s) => (s ? s.t + (s.w || s.c) + s.r + ':' + (s.mag ?? s.n) : '-')).join(',');
    if (k !== invKey) {
      invKey = k;
      const cells = [null, ...P.inv].map((s, i) => {
        const r = s ? RARITY[s.r] : null, sel = P.sel === i;
        const count = !s ? '' : s.t === 'arme' ? `<em>${s.mag}</em>` : s.n > 1 ? `<em>${s.n}</em>` : '';
        const title = i === 0 ? 'Outil de récolte' : s ? itemLabel(s) : 'Vide';
        return `<div class="slot${sel ? ' sel' : ''}${s || i === 0 ? '' : ' empty'}" style="--r:${r ? r.color : '#4a5260'}" title="${esc(title)}">
          <span class="k">${i === 0 ? '0' : i}</span>${s || i === 0 ? `<img src="${itemIcon(i === 0 ? null : s)}" alt="">` : ''}${count}</div>`;
      });
      inv.innerHTML = cells.join('');
      const held = P.sel > 0 ? P.inv[P.sel - 1] : null;
      inv.dataset.label = held ? itemLabel(held) : P.sel === 0 ? 'Outil de récolte' : '';
      $('#heldname').textContent = inv.dataset.label;
      $('#heldname').style.color = held ? RARITY[held.r].color : '#fff';
    }
    // munitions de l'arme tenue
    const held = P.sel > 0 ? P.inv[P.sel - 1] : null;
    if (held && held.t === 'arme') { const W = WEAPONS[held.w]; ammoEl.hidden = false; ammoEl.innerHTML = `<b>${held.mag}</b><span>/ ${P.ammo[W.ammo]}</span><small>${AMMO[W.ammo].short}</small>`; }
    else ammoEl.hidden = true;
    resEl.innerHTML = Object.entries(MATERIALS).map(([m, M]) => `<span style="--c:${M.color}"><i></i>${P.mats[m]}</span>`).join('')
      + Object.entries(AMMO).filter(([a]) => P.ammo[a] > 0).map(([a, A]) => `<span class="am" style="--c:${A.color}" title="${A.label}"><i></i>${P.ammo[a]}</span>`).join('');
    stats.innerHTML = `<span title="Joueurs encore en vie">👤 ${extra.alive}</span><span title="Tes éliminations">💀 ${P.kills}</span>`;
    // jauge : soin ou rechargement
    const g = $('#gauge');
    if (P.use) { g.hidden = false; g.querySelector('i').style.width = (P.use.t / P.use.T * 100) + '%'; g.querySelector('span').textContent = ITEMS[P.use.c].label; }
    else if (P.rl > 0 && held && held.t === 'arme') { const T = WEAPONS[held.w].reload[held.r]; g.hidden = false; g.querySelector('i').style.width = ((1 - P.rl / T) * 100) + '%'; g.querySelector('span').textContent = 'Rechargement'; }
    else g.hidden = true;
  }
  function storm(st, me) {
    S.storm = st && st.cur ? st : null;
    if (!S.storm) { stormEl.hidden = true; $('#stormtint').style.opacity = 0; return; }
    stormEl.hidden = false;
    const left = Math.max(0, st.left || 0);
    stormEl.innerHTML = st.state === 'attente' ? `🌀 La tempête se referme dans <b>${mmss(left)}</b>` : st.state === 'fermeture' ? `🌀 La tempête se referme <b>${mmss(left)}</b>` : '🌀 Dernier cercle';
    const out = me && Math.hypot(me.x - st.cur.x, me.z - st.cur.z) > st.cur.r;
    $('#stormtint').style.opacity = out ? 1 : 0;
    stormEl.classList.toggle('out', !!out);
  }
  function flight(f) { S.flight = f; }

  // ------------------------------------------------------------------ retours de combat
  const feed = $('#feed'), hit = $('#hitm'), nums = $('#dmgnums'), dir = $('#dmgdir'), center = $('#center');
  function feedLine(html) {
    const el = document.createElement('div'); el.className = 'line'; el.innerHTML = html;
    feed.prepend(el);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => el.classList.add('old'), 6000);
    setTimeout(() => el.remove(), 7000);
  }
  let hitT = 0;
  function hitMarker(head, kill) {
    hit.className = 'hitm on' + (head ? ' head' : '') + (kill ? ' kill' : '');
    clearTimeout(hitT); hitT = setTimeout(() => { hit.className = 'hitm'; }, 160);
  }
  const floating = [];
  function damageNumber(x, y, z, n, head, shield) {
    const el = document.createElement('div');
    el.className = 'dn' + (head ? ' head' : '') + (shield ? ' sh' : '');
    el.textContent = n;
    nums.appendChild(el);
    floating.push({ el, x, y, z, t: 0, dx: (Math.random() - 0.5) * 30 });
  }
  function hurtFrom(angle) {
    // angle : direction du tireur par rapport au regard (0 = devant), en radians
    const el = document.createElement('div'); el.className = 'arc';
    el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    dir.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }
  let centerT = 0;
  function say(html, sec = 3, cls = '') {
    center.innerHTML = html; center.className = 'center on ' + cls;
    clearTimeout(centerT); if (sec) centerT = setTimeout(() => { center.className = 'center'; }, sec * 1000);
  }
  function frame(dt) {
    for (let i = floating.length - 1; i >= 0; i--) {
      const f = floating[i]; f.t += dt;
      if (f.t > 0.9) { f.el.remove(); floating.splice(i, 1); continue; }
      const p = project(f.x, f.y + f.t * 1.2, f.z);
      f.el.style.opacity = p.on ? String(Math.min(1, (0.9 - f.t) * 3)) : '0';
      f.el.style.transform = `translate(${p.x + f.dx}px, ${p.y}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.15 - f.t) * 3})`;
    }
  }
  // viseur : écart selon la dispersion ; lunette pour le fusil de précision
  function crosshair(spread, scope) {
    $('#cross').style.setProperty('--g', Math.round(6 + spread * 520) + 'px');
    $('#scope').hidden = !scope;
    $('#cross').hidden = !!scope;
  }

  return {
    maps, player, storm, flight, feedLine, hitMarker, damageNumber, hurtFrom, say, frame, crosshair,
    get mapOpen() { return !big.hidden; },
    toggleMap(on = big.hidden) { big.hidden = !on; bigView = null; },
    showFps(on) { fps.hidden = !on; },
    prompt(txt) { if (promptEl.dataset.t === txt) return; promptEl.dataset.t = txt; promptEl.hidden = !txt; promptEl.innerHTML = txt ? `<kbd>E</kbd> ${txt}` : ''; },
    spectate(name) { const s = $('#spect'); s.hidden = !name; if (name) s.innerHTML = `Tu regardes <b>${esc(name)}</b> · <kbd>Espace</kbd> joueur suivant`; },
  };
}
