// L'interface en jeu, en panneaux sombres comme Convoy Storm : survivants, éliminations et chrono de la tempête ;
// minicarte (nord en haut, flèche du joueur, tempête) et nom du lieu ; bouclier, vie et matériaux ; barre d'objets
// (pioche + 5 cases, couleur de rareté) ; munitions ; viseur qui s'ouvre avec la dispersion, marqueur de touche,
// chiffres de dégâts, direction des tirs reçus, jauge ronde de soin et de rechargement, lunette du fusil de
// précision, messages au centre ; le sac (Tab) où l'on range ses objets en les glissant ; la grande carte (M).
// En équipe : les coéquipiers (vie, bouclier, à terre) au-dessus de la vie, leur pseudo au-dessus de leur tête, leur
// point sur les cartes, et le bandeau « à terre » avec ce qu'il reste de réserve et le relevé en cours.
// Les cartes sont dessinées par view/maprender.js, comme l'aperçu de l'île.
import { terrainImage, drawMap, gridRef } from './maprender.js';
import { GROUND } from '../engine/map.js';
import { WEAPONS, ITEMS, AMMO, RARITY, MATERIALS, itemLabel } from '../engine/items.js';

const MINI_S = 1.15; // pixels par mètre sur la minicarte
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ pictogrammes des objets (silhouettes au canevas)
const iconCache = new Map();
let rendered = new Map();   // icônes rendues à partir des modèles 3D (view/weapons.js)
const renderedKey = (it) => (!it ? 'pioche' : it.t === 'arme' ? 'arme' + it.w + it.r : it.t + (it.c || it.a || it.m));
export function itemIcon(it) {
  const rk = renderedKey(it);
  if (rendered.has(rk)) return rendered.get(rk);
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

// key(action) : la touche de cette action, telle qu'elle est écrite (modifiable dans les Réglages)
export function createHud(map, { onTeleport, project, key = () => '' } = {}) {
  const img = terrainImage(map, { ppm: 0.5 });
  const mini = $('#mini'), mctx = mini.getContext('2d');
  const big = $('#bigmap'), bcv = big.querySelector('canvas'), bctx = bcv.getContext('2d');
  const place = $('#place'), fps = $('#fps'), promptEl = $('#prompt');
  if (onTeleport) $('#mapHint').innerHTML = `Clique pour t'y rendre · <kbd data-k="carte">${esc(key('carte'))}</kbd> fermer`;
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
  let mates = [], marks = [];
  // repères et largages : un losange de leur couleur
  const markDots = (ctx, cx, cz, s, W, H) => {
    for (const m of marks) {
      const x = Math.max(6, Math.min(W - 6, (m.x - cx) * s + W / 2)), y = Math.max(6, Math.min(H - 6, (m.z - cz) * s + H / 2)), r = m.big ? 7 : 5.5;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
      ctx.fillStyle = m.color; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    }
  };
  const mateDots = (ctx, cx, cz, s, W, H) => {
    for (const m of mates) {
      const x = (m.x - cx) * s + W / 2, y = (m.z - cz) * s + H / 2;
      if (x < 4 || y < 4 || x > W - 4 || y > H - 4) continue;
      ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = m.down ? '#ff5a4a' : m.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.fill(); ctx.stroke();
    }
  };
  function maps(t, p, yaw, frameMs, team = [], mk = []) {
    mates = team; marks = mk;
    if (t - last > 0.12) {
      last = t;
      const W = mini.clientWidth, H = mini.clientHeight, d = dpr();
      if (mini.width !== Math.round(W * d)) { mini.width = Math.round(W * d); mini.height = Math.round(H * d); }
      drawMap(mctx, map, img, { x: p.x, z: p.z, s: MINI_S, w: W, h: H, dpr: d }, mapOpts(LAY_MINI));
      mctx.setTransform(d, 0, 0, d, 0, 0);
      markDots(mctx, p.x, p.z, MINI_S, W, H);
      mateDots(mctx, p.x, p.z, MINI_S, W, H);
      arrow(mctx, W / 2, H / 2, yaw);
      const poi = map.poiAt(p.x, p.z);
      place.innerHTML = `<em>${gridRef(map, p.x, p.z)}</em>${esc(poi ? poi.name : GROUND[map.groundAt(p.x, p.z)])}`;
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
    markDots(bctx, bigView.x, bigView.z, bigView.s, W, H);
    mateDots(bctx, bigView.x, bigView.z, bigView.s, W, H);
    arrow(bctx, (p.x - bigView.x) * bigView.s + W / 2, (p.z - bigView.z) * bigView.s + H / 2, yaw, 12);
  }
  bcv.addEventListener('click', (e) => {
    if (!bigView || !onTeleport) return;
    const r = bcv.getBoundingClientRect();
    const x = bigView.x + (e.clientX - r.left - r.width / 2) / bigView.s, z = bigView.z + (e.clientY - r.top - r.height / 2) / bigView.s;
    if (x > 0 && z > 0 && x < map.size && z < map.size) onTeleport(x, z);
  });
  addEventListener('resize', () => { bigView = null; });

  // ------------------------------------------------------------------ joueur : vie, bouclier, objets, munitions
  const inv = $('#inv'), vit = $('#vit'), ammoEl = $('#ammo'), matsEl = $('#mats'), gauge = $('#gauge');
  const mStorm = $('#mStorm');
  let invKey = '', ammoKey = '', matsKey = '';
  const slotSig = (P) => P.sel + '|' + P.inv.map((s) => (s ? s.t + (s.w || s.c) + s.r + ':' + (s.mag ?? s.n) : '-')).join(',');
  function player(P, extra) {
    const hp = Math.max(0, P.hp), sh = Math.max(0, P.sh);
    vit.querySelector('.hp .bt i').style.width = hp + '%';
    vit.querySelector('.sh .bt i').style.width = sh + '%';
    // traînée blanche : ce qu'on vient de perdre, qui fond après un instant
    vit.querySelector('.hp .bt s').style.width = hp + '%';
    vit.querySelector('.sh .bt s').style.width = sh + '%';
    vit.querySelector('.hp b').textContent = Math.ceil(hp);
    vit.querySelector('.sh b').textContent = Math.ceil(sh);
    vit.querySelector('.hp').classList.toggle('low', hp > 0 && hp < 30);
    $('#mAlive').textContent = extra.alive;
    $('#mKills').textContent = P.kills;
    // matériaux (celui qu'on construit est surligné)
    const mk = Object.keys(MATERIALS).map((m) => P.mats[m]).join(',') + (extra.build ? extra.mat : '');
    if (mk !== matsKey) {
      matsKey = mk;
      matsEl.innerHTML = Object.entries(MATERIALS).map(([m, M]) => `<span class="${extra.build && extra.mat === m ? 'sel' : ''}" style="--c:${M.color}" title="${M.label}"><i></i>${P.mats[m]}</span>`).join('');
    }
    // barre d'objets : redessinée quand elle change
    const held = P.sel > 0 ? P.inv[P.sel - 1] : null;
    const k = slotSig(P);
    if (k !== invKey) {
      invKey = k;
      inv.innerHTML = [null, ...P.inv].map((s, i) => {
        const r = s ? RARITY[s.r] : null, sel = P.sel === i;
        const count = !s ? '' : s.t === 'arme' ? `<em>${s.mag}</em>` : s.n > 1 ? `<em>${s.n}</em>` : '';
        const title = i === 0 ? 'Pioche' : s ? itemLabel(s) : 'Vide';
        return `<div class="slot${sel ? ' sel' : ''}${i === 0 ? ' tool' : s ? '' : ' empty'}" style="--r:${r ? r.color : '#4a5260'}" title="${esc(title)}">
          <span class="k">${i === 0 ? 'X' : i}</span>${s || i === 0 ? `<img src="${itemIcon(i === 0 ? null : s)}" alt="">` : ''}${count}</div>`;
      }).join('');
      const hn = $('#heldname');
      hn.textContent = held ? itemLabel(held) : P.sel === 0 ? 'Pioche' : '';
      hn.style.color = held ? RARITY[held.r].color : '#fff8ea';
    }
    // rechargement : la case de l'arme se remplit
    const selEl = inv.children[P.sel];
    if (selEl) {
      const T = held && held.t === 'arme' && P.rl > 0 ? WEAPONS[held.w].reload[held.r] : 0;
      selEl.classList.toggle('reload', !!T);
      if (T) selEl.style.setProperty('--p', ((1 - P.rl / T) * 100).toFixed(0) + '%');
    }
    // munitions : celles de l'arme en main en grand, toutes les autres en dessous
    const used = new Set(P.inv.filter((s) => s && s.t === 'arme').map((s) => WEAPONS[s.w].ammo));
    const ak = (held && held.t === 'arme' ? held.w + held.mag : '-') + '|' + Object.keys(AMMO).map((a) => P.ammo[a]).join(',') + [...used].join();
    if (ak !== ammoKey) {
      ammoKey = ak;
      const W = held && held.t === 'arme' ? WEAPONS[held.w] : null;
      const cur = W ? `<div class="cur"><b class="${held.mag <= Math.ceil(W.mag / 4) ? 'low' : ''}">${held.mag}</b><span>/ ${P.ammo[W.ammo]}</span><small>${AMMO[W.ammo].short}</small></div>` : '';
      const list = Object.entries(AMMO).map(([a, A]) => `<span class="${used.has(a) || P.ammo[a] > 0 ? 'on' : ''}" title="${A.label}"><i class="bul" style="--c:${A.color}"></i>${P.ammo[a]}</span>`).join('');
      ammoEl.innerHTML = cur + `<div class="list">${list}</div>`;
    }
    // jauge ronde : soin, bouclier ou rechargement
    let f = -1, label = '', kind = '';
    if (extra.revive) { f = extra.revive.f; label = 'Relève ' + extra.revive.name; kind = 'heal'; }
    else if (P.use && P.use.T) { f = P.use.t / P.use.T; const I = ITEMS[P.use.c]; label = I ? I.label : 'Soin'; kind = I && I.shield ? 'shield' : 'heal'; }
    else if (P.rl > 0 && held && held.t === 'arme') { f = 1 - P.rl / WEAPONS[held.w].reload[held.r]; label = 'Rechargement'; }
    gauge.hidden = f < 0;
    if (f >= 0) {
      gauge.className = 'gauge ' + kind;
      gauge.querySelector('.fg').style.strokeDashoffset = (113.1 * (1 - Math.min(1, f))).toFixed(1);
      gauge.querySelector('span').textContent = label;
    }
  }
  // ------------------------------------------------------------------ équipe
  const teamEl = $('#team'), tagsEl = $('#tags'), downEl = $('#downed');
  let teamKey = '';
  // list : [{ id, name, color, hp, sh, down (réserve 0-100 ou null), alive }]
  function team(list) {
    teamEl.hidden = !list.length;
    const k = list.map((m) => `${m.id}:${Math.round(m.hp)}:${Math.round(m.sh)}:${m.down == null ? '' : Math.round(m.down)}:${m.alive}`).join('|');
    if (k === teamKey) return;
    teamKey = k;
    teamEl.innerHTML = list.map((m) => `<div class="m${!m.alive ? ' out' : m.down != null ? ' down' : ''}" style="--c:${esc(m.color)}"><i></i><span>${esc(m.name)}${!m.alive ? ' · éliminé' : m.down != null ? ' · à terre' : ''}</span>
      <span class="bars"><span class="s"><b style="width:${m.down != null || !m.alive ? 0 : Math.max(0, m.sh)}%"></b></span><span class="h"><b style="width:${!m.alive ? 0 : m.down != null ? m.down : Math.max(0, m.hp)}%"></b></span></span></div>`).join('');
  }
  // pseudos des coéquipiers au-dessus de leur tête (à travers les murs) : [{ id, name, color, x, y, z, down }]
  const tagEls = new Map();
  function tags(list) {
    const seen = new Set();
    for (const m of list) {
      const q = project(m.x, m.y, m.z);
      if (!q.on) continue;
      let el = tagEls.get(m.id);
      if (!el) { el = document.createElement('div'); el.className = 'tag'; tagsEl.appendChild(el); tagEls.set(m.id, el); }
      const html = esc(m.name) + (m.down ? ' · à terre' : '');
      if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = `<span>${html}</span>`; }
      el.classList.toggle('down', !!m.down);
      el.style.setProperty('--c', m.color);
      el.style.left = q.x.toFixed(0) + 'px'; el.style.top = q.y.toFixed(0) + 'px';
      seen.add(m.id);
    }
    for (const [id, el] of tagEls) el.hidden = !seen.has(id);
  }
  // repères à l'écran : [{ key, x, y, z, label, sub, color, fade (0-1), rel (angle par rapport au regard) }] ;
  // hors champ, ils se collent au bord, du côté où il faut se tourner
  const pingsEl = $('#pings'), pingEls = new Map();
  function pings(list) {
    const seen = new Set(), W = pingsEl.clientWidth, H = pingsEl.clientHeight;
    for (const m of list) {
      let el = pingEls.get(m.key);
      if (!el) { el = document.createElement('div'); el.className = 'ping'; pingsEl.appendChild(el); pingEls.set(m.key, el); }
      const html = `<i></i><b>${esc(m.label)}</b><small>${esc(m.sub)}</small>`;
      if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; }
      const q = project(m.x, m.y, m.z);
      let x = q.x, y = q.y;
      const edge = !q.on;
      if (edge) { x = W / 2 + Math.sin(m.rel) * W * 0.46; y = H / 2 - Math.cos(m.rel) * H * 0.42; }
      el.classList.toggle('edge', edge);
      el.style.setProperty('--c', m.color); el.style.opacity = m.fade.toFixed(2);
      el.style.left = Math.max(30, Math.min(W - 30, x)).toFixed(0) + 'px'; el.style.top = Math.max(40, Math.min(H - 30, y)).toFixed(0) + 'px';
      seen.add(m.key);
    }
    for (const [k, el] of pingEls) if (!seen.has(k)) { el.remove(); pingEls.delete(k); }
  }
  // à terre : ce qu'il reste (secondes) et, si un coéquipier relève, où il en est
  function downed(st) {
    downEl.hidden = !st;
    if (!st) return;
    downEl.innerHTML = `<b>À terre</b>${st.by ? `${esc(st.by)} te relève…` : `Encore ${Math.ceil(st.left)} s · rampe vers tes coéquipiers`}<div class="bt"><i style="width:${(st.by ? st.f : st.left / 30) * 100}%;${st.by ? 'background:#4ade80' : ''}"></i></div>`;
  }
  function storm(st, me) {
    S.storm = st && st.cur ? st : null;
    if (!S.storm) { mStorm.hidden = true; $('#stormtint').style.opacity = 0; return; }
    mStorm.hidden = false;
    const left = Math.max(0, st.left || 0), out = me && Math.hypot(me.x - st.cur.x, me.z - st.cur.z) > st.cur.r;
    $('#mStormL').textContent = out ? 'DANS LA TEMPÊTE' : st.state === 'attente' ? `CERCLE ${st.k + 1} · ZONE DANS` : st.state === 'fermeture' ? 'LA TEMPÊTE AVANCE' : 'DERNIER CERCLE';
    $('#mStormT').textContent = st.state === 'fin' ? '—' : mmss(left);
    mStorm.className = 'st' + (out ? ' out' : st.state === 'fermeture' ? ' closing' : '');
    $('#stormtint').style.opacity = out ? 1 : 0;
  }
  function flight(f) { S.flight = f; }

  // ------------------------------------------------------------------ le sac (Tab) : ranger en glissant, lâcher, détails
  const bagEl = $('#bag'), bslots = $('#bslots'), bdet = $('#bdet');
  let bagKey = '', bagP = null, onMove = null, hoverI = -1, drag = null;
  const fmt = (v) => String(Math.round(v * 10) / 10).replace('.', ',');
  function detail(it) {
    if (!it) { bdet.innerHTML = `<b>Case vide</b><div class="st">Ramasse une arme ou un objet (${esc(key('utiliser'))}) pour la remplir.</div>`; return; }
    const r = RARITY[it.r], head = `<b style="color:${r.color}">${esc(itemLabel(it))}</b>`;
    if (it.t === 'arme') {
      const W = WEAPONS[it.w];
      const st = [['Dégâts', fmt(W.dmg[it.r]) + (W.pellets ? ' × ' + W.pellets : '')], ['Cadence', fmt(W.rate) + ' tirs/s'], ['Chargeur', W.mag], ['Rechargement', fmt(W.reload[it.r]) + ' s'], ['Munitions', AMMO[W.ammo].label], ['Portée', W.range + ' m']];
      bdet.innerHTML = head + `<div class="st">${st.map(([a, b]) => `<span>${a} <b>${b}</b></span>`).join('')}</div>`;
    } else {
      const I = ITEMS[it.c];
      const what = I.heal ? `Rend ${I.heal} points de vie (jusqu'à ${I.max})` : I.shield ? `Donne ${I.shield} de bouclier (jusqu'à ${I.maxShield})` : I.throw === 'grenade' ? 'Explose après un rebond : dégâts et destruction' : I.throw ? 'Souffle qui projette en l\'air ceux qui sont autour' : 'Posé au sol, il propulse dans les airs';
      bdet.innerHTML = head + `<div class="st"><span>${what}</span>${I.time ? `<span>Durée <b>${fmt(I.time)} s</b></span>` : ''}<span>Pile <b>${it.n} / ${I.stack}</b></span></div>`;
    }
  }
  function bagRender(P) {
    const key = slotSig(P) + '|' + Object.keys(AMMO).map((a) => P.ammo[a]).join(',') + '|' + Object.keys(MATERIALS).map((m) => P.mats[m]).join(',');
    if (key === bagKey) return;
    bagKey = key;
    bslots.innerHTML = P.inv.map((s, i) => {
      const count = !s ? '' : s.t === 'arme' ? `<em>${s.mag}</em>` : s.n > 1 ? `<em>×${s.n}</em>` : '';
      return `<div class="bs${s ? '' : ' empty'}${P.sel === i + 1 ? ' sel' : ''}" data-i="${i}" style="--r:${s ? RARITY[s.r].color : '#4a5260'}"><span class="k">${i + 1}</span>${s ? `<img src="${itemIcon(s)}" alt=""><small>${esc(s.t === 'arme' ? WEAPONS[s.w].label : ITEMS[s.c].label)}</small>${count}` : ''}</div>`;
    }).join('');
    $('#bammo').innerHTML = Object.entries(AMMO).map(([a, A]) => `<div class="row2${P.ammo[a] ? '' : ' zero'}"><i class="bul" style="--c:${A.color}"></i>${A.label}<b>${P.ammo[a]}</b></div>`).join('');
    $('#bmats').innerHTML = Object.entries(MATERIALS).map(([m, M]) => `<div class="row2${P.mats[m] ? '' : ' zero'}"><i style="--c:${M.color}"></i>${M.label}<b>${P.mats[m]}</b></div>`).join('');
    detail(P.inv[hoverI >= 0 ? hoverI : P.sel - 1] || null);
  }
  const slotAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest ? el.closest('.bs') : null; };
  bslots.addEventListener('pointerover', (e) => { const el = e.target.closest('.bs'); if (!el || !bagP) return; hoverI = +el.dataset.i; detail(bagP.inv[hoverI]); });
  bslots.addEventListener('pointerleave', () => { hoverI = -1; if (bagP) detail(bagP.inv[bagP.sel - 1] || null); });
  bslots.addEventListener('contextmenu', (e) => { e.preventDefault(); const el = e.target.closest('.bs'); if (el && bagP && bagP.inv[+el.dataset.i] && onMove) onMove(+el.dataset.i, -1); });
  bslots.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('.bs');
    if (e.button !== 0 || !el || !bagP || !bagP.inv[+el.dataset.i]) return;
    e.preventDefault();
    drag = { i: +el.dataset.i, x: e.clientX, y: e.clientY, el, ghost: null };
  });
  addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (!drag.ghost && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) {
      drag.ghost = document.createElement('div'); drag.ghost.className = 'dragghost';
      drag.ghost.innerHTML = `<img src="${itemIcon(bagP.inv[drag.i])}" alt="">`;
      document.body.appendChild(drag.ghost); drag.el.classList.add('lift');
    }
    if (drag.ghost) {
      drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
      const over = slotAt(e.clientX, e.clientY);
      for (const c of bslots.children) c.classList.toggle('over', c === over && +c.dataset.i !== drag.i);
    }
  });
  addEventListener('pointerup', (e) => {
    if (!drag) return;
    const d = drag; drag = null;
    if (d.ghost) { d.ghost.remove(); d.el.classList.remove('lift'); for (const c of bslots.children) c.classList.remove('over'); }
    else return;
    const over = slotAt(e.clientX, e.clientY);
    if (over) { const j = +over.dataset.i; if (j !== d.i && onMove) onMove(d.i, j); }
    else if (!e.target.closest || !e.target.closest('.bagp')) { if (onMove) onMove(d.i, -1); }
  });

  // ------------------------------------------------------------------ retours de combat
  const feed = $('#feed'), hit = $('#hitm'), nums = $('#dmgnums'), dir = $('#dmgdir'), center = $('#center'), hurtEl = $('#hurt');
  function feedLine(html, mine) {
    const el = document.createElement('div'); el.className = 'line' + (mine ? ' me' : ''); el.innerHTML = html;
    feed.prepend(el);
    while (feed.children.length > 5) feed.lastChild.remove();
    setTimeout(() => el.classList.add('old'), 6000);
    setTimeout(() => el.remove(), 7000);
  }
  let hitT = 0;
  function hitMarker(head, kill) {
    // on relance l'animation à chaque touche
    hit.className = 'hitm'; void hit.offsetWidth;
    hit.className = 'hitm on' + (head ? ' head' : '') + (kill ? ' kill' : '');
    clearTimeout(hitT); hitT = setTimeout(() => { hit.className = 'hitm'; }, kill ? 420 : 200);
  }
  const floating = [];
  function damageNumber(x, y, z, n, head, shield) {
    const el = document.createElement('div');
    el.className = 'dn' + (head ? ' head' : '') + (shield ? ' sh' : '') + (n >= 50 ? ' big' : '');
    el.textContent = n;
    nums.appendChild(el);
    // les chiffres s'écartent en arc de part et d'autre de la cible
    const side = Math.random() < 0.5 ? -1 : 1;
    floating.push({ el, x, y, z, t: 0, dx: side * (18 + Math.random() * 30), up: 40 + Math.random() * 25 });
  }
  let hurtT = 0;
  function hurtFrom(angle, n = 20) {
    // angle : direction du tireur par rapport au regard (0 = devant), en radians ; null : sans direction (tempête, chute)
    if (angle != null) {
      const el = document.createElement('div'); el.className = 'arc' + (n >= 40 ? ' hard' : '');
      el.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      dir.appendChild(el);
      setTimeout(() => el.remove(), 1200);
    }
    hurtEl.className = 'hurt on';
    clearTimeout(hurtT); hurtT = setTimeout(() => { hurtEl.className = 'hurt'; }, 60);
  }
  let centerT = 0;
  function say(html, sec = 3, cls = '') {
    center.innerHTML = html; center.className = 'banner on ' + cls;
    clearTimeout(centerT); if (sec) centerT = setTimeout(() => { center.className = 'banner'; }, sec * 1000);
  }
  function frame(dt) {
    for (let i = floating.length - 1; i >= 0; i--) {
      const f = floating[i]; f.t += dt;
      if (f.t > 1.1) { f.el.remove(); floating.splice(i, 1); continue; }
      const p = project(f.x, f.y, f.z), k = Math.min(1, f.t / 0.35), ease = 1 - (1 - k) * (1 - k);
      f.el.style.opacity = p.on ? String(Math.min(1, (1.1 - f.t) * 3)) : '0';
      f.el.style.transform = `translate(${p.x + f.dx * ease}px, ${p.y - f.up * ease - f.t * 18}px) translate(-50%, -50%) scale(${1 + Math.max(0, 0.12 - f.t) * 6})`;
    }
  }
  // viseur : ses branches s'écartent jusqu'au bord du cône de dispersion (gap, en pixels) ; lunette pour le fusil de précision
  function crosshair(gap, scope) {
    $('#cross').style.setProperty('--g', Math.round(4 + Math.min(gap, 220)) + 'px');
    $('#scope').hidden = !scope;
    $('#cross').hidden = !!scope;
  }

  // points de vie de ce qu'on frappe, et matériaux récoltés
  let structT = 0, gainT = 0;
  function structure(hp, max) {
    const el = $('#structhp'); el.hidden = false;
    el.querySelector('i').style.width = Math.max(0, hp / max * 100) + '%';
    el.querySelector('span').textContent = `${Math.ceil(hp)} / ${Math.round(max)}`;
    clearTimeout(structT); structT = setTimeout(() => { el.hidden = true; }, 1500);
  }
  function gain(txt, color) {
    const el = $('#gain'); el.textContent = txt; el.style.color = color; el.className = 'gain on';
    clearTimeout(gainT); gainT = setTimeout(() => { el.className = 'gain'; }, 700);
  }
  return {
    maps, player, storm, flight, feedLine, hitMarker, damageNumber, hurtFrom, say, frame, crosshair, structure, gain, team, tags, downed, pings,
    get mapOpen() { return !big.hidden; },
    toggleMap(on = big.hidden) { big.hidden = !on; bigView = null; },
    showFps(on) { fps.hidden = !on; },
    // txt : l'action ; what : ce sur quoi elle porte (couleur de rareté)
    prompt(txt, what = '', color = '', kbd = key('utiliser')) {
      const key = txt + what + color + kbd;
      if (promptEl.dataset.t === key) return;
      promptEl.dataset.t = key; promptEl.hidden = !txt;
      promptEl.innerHTML = txt ? `<kbd>${esc(kbd)}</kbd><span>${esc(txt)}${what ? ` <i style="--rc:${color || '#fff8ea'}">${esc(what)}</i>` : ''}</span>` : '';
    },
    spectate(name) { const s = $('#spect'); s.hidden = !name; if (name) s.innerHTML = `Tu regardes <b>${esc(name)}</b> · <kbd>${esc(key('saut'))}</kbd> joueur suivant`; },
    // icônes rendues à partir des modèles : on redessine la barre d'objets et le sac
    setIcons(map) { rendered = map; invKey = ''; bagKey = ''; },
    get bagOpen() { return !bagEl.hidden; },
    openBag(P, move) { bagP = P; onMove = move; bagKey = ''; hoverI = -1; bagEl.hidden = false; bagRender(P); },
    closeBag() { bagEl.hidden = true; bagP = null; drag = null; for (const g of document.querySelectorAll('.dragghost')) g.remove(); },
    bag(P) { if (!bagEl.hidden && P) { bagP = P; bagRender(P); } },
  };
}
