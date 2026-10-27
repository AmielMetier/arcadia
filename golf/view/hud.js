// Birdie Party — interface : carte du trou, distance, vent, club, trajectoire, jauge, mini-carte, bannières, écrans.
import { CLUBS, LIE } from '../engine/clubs.js';

const $ = (s) => document.querySelector(s);
// écritures faites à chaque image : on ne touche au DOM que si la valeur change (sinon le navigateur refait la mise en page)
const shown = new Map();
const put = (sel, key, v, apply) => { const k = sel + key; if (shown.get(k) === v) return; shown.set(k, v); apply($(sel), v); };
const setText = (sel, v) => put(sel, '#text', v, (el) => { el.textContent = v; });
const setStyle = (sel, prop, v) => put(sel, prop, v, (el) => { el.style[prop] = v; });
const setHidden = (sel, v) => put(sel, '#hidden', v, (el) => { el.hidden = v; });
export const fmtM = (m) => (m < 10 ? m.toFixed(1).replace('.', ',') : Math.round(m)) + ' m';
export const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const lieLabel = (l) => LIE[l]?.label || (l === 'water' ? 'Eau' : l === 'ob' ? 'Hors limites' : 'Rough');
const toParTxt = (d) => (d === 0 ? 'E' : d > 0 ? '+' + d : String(d));
// icônes des clubs (dessins du jeu) : bois, fer, putter
const ICONS = {
  wood: '<svg viewBox="0 0 64 64"><path d="M50 4 L22 46" stroke="#c9ced6" stroke-width="3.5" stroke-linecap="round"/><path d="M50 4 L45 12" stroke="#2a2c31" stroke-width="6" stroke-linecap="round"/><ellipse cx="17" cy="50" rx="13" ry="9" fill="#2b2e36" transform="rotate(-18 17 50)"/><ellipse cx="14" cy="47" rx="6" ry="3" fill="#7d8594" transform="rotate(-18 14 47)"/></svg>',
  iron: '<svg viewBox="0 0 64 64"><path d="M50 4 L24 46" stroke="#c9ced6" stroke-width="3.5" stroke-linecap="round"/><path d="M50 4 L45 12" stroke="#2a2c31" stroke-width="6" stroke-linecap="round"/><path d="M27 42 L10 50 Q6 53 9 57 L30 52 Z" fill="#b9c1cc" stroke="#6b7480" stroke-width="2"/></svg>',
  putter: '<svg viewBox="0 0 64 64"><path d="M48 4 L30 48" stroke="#c9ced6" stroke-width="3.5" stroke-linecap="round"/><path d="M48 4 L44 12" stroke="#2a2c31" stroke-width="6" stroke-linecap="round"/><rect x="12" y="46" width="26" height="9" rx="3" fill="#9aa3b0" stroke="#5c6470" stroke-width="2"/></svg>',
};

// nom du score par rapport au par
export function scoreName(strokes, par) {
  if (strokes === 1) return 'Trou en un !';
  const d = strokes - par;
  return ({ '-3': 'Albatros !', '-2': 'Eagle !', '-1': 'Birdie !', 0: 'Par', 1: 'Bogey', 2: 'Double bogey', 3: 'Triple bogey' })[d] || (d > 0 ? `+${d}` : `${d}`);
}
const scoreClass = (s, p) => (s - p <= -2 || s === 1 ? 'eagle' : s - p === -1 ? 'birdie' : s - p > 0 ? 'bogey' : '');

export class HUD {
  constructor() {
    this.el = $('#hud');
    this.mini = $('#minimap'); this.mctx = this.mini.getContext('2d');
    this.bannerT = 0; this.toastT = 0;
    this.bg = null;
    this.initMap();
  }
  show(on) { this.el.hidden = !on; }
  hole(h, stroke) {
    $('#hNum').textContent = h.n; $('#hPar').textContent = `Par ${h.par}`; $('#hLen').textContent = `${h.length} m`;
    $('#hStroke').textContent = stroke;
  }
  // bandeau des joueurs : couleur, nom, score par rapport au par ; celui qui joue est mis en avant
  // en équipes : les joueurs sont rangés sous leur équipe (même score), un point blanc pour ceux qui ont joué la volée
  players(list, teams) {
    const row = (p) => `<div class="pl ${p.cur ? 'cur' : ''} ${p.done ? 'done' : ''}"><i style="background:${esc(p.color)}"></i><b>${esc(p.name)}</b>${teams ? (p.played ? '<em>•</em>' : '') : `<span>${toParTxt(p.toPar)}</span>${p.done ? '<em>✓</em>' : ''}`}</div>`;
    if (!teams) { $('#players').innerHTML = list.map(row).join(''); return; }
    $('#players').innerHTML = teams.map((t, k) => {
      const m = list.filter((p) => p.team === k);
      return m.length ? `<div class="tm"><div class="tm-h"><i style="background:${esc(t.color)}"></i><b>${esc(t.name)}</b><span>${toParTxt(m[0].toPar)}</span>${m[0].done ? '<em>✓</em>' : ''}</div>${m.map(row).join('')}</div>` : '';
    }).join('');
  }
  dist(m) { setText('#distTxt', fmtM(m)); }
  lie(l) { $('#lieTxt').textContent = lieLabel(l); }
  // flèche du vent dans le repère de la caméra (vers le haut = vent dans le dos)
  wind(w, heading) {
    const a = (w.dir - heading) * 180 / Math.PI;
    setStyle('#windArrow', 'transform', `rotate(${(-a).toFixed(1)}deg)`);
    setStyle('#windArrow', 'opacity', w.speed < 0.25 ? '0.25' : '1');
    setText('#windTxt', w.speed < 0.25 ? 'Calme' : `${String(w.speed).replace('.', ',')} m/s`);
  }
  club(i, dist) {
    const c = CLUBS[i];
    $('#clubShort').textContent = c.short; $('#clubName').textContent = c.name; $('#clubDist').textContent = fmtM(dist);
    $('#clubIcon').innerHTML = ICONS[c.putter ? 'putter' : i <= 1 ? 'wood' : 'iron'];
  }
  controls(on) { for (const s of ['#clubBox', '#aimPad']) $(s).style.visibility = on ? 'visible' : 'hidden'; }
  // jauge toujours visible pendant la visée ; elle se remplit pendant l'armé
  gauge(p, on, max = 1.18) {
    $('#gauge').hidden = !on; if (!on) return;
    const f = $('#gaugeFill');
    f.style.height = `calc(${(Math.min(p, max) / max) * 100}% - 6px)`;
    f.style.opacity = p > 0 ? 1 : 0;
    f.classList.toggle('hot', p > 1);
    $('#gaugeTxt').textContent = p > 0 ? Math.round(p * 100) + ' %' : '';
  }
  pinTag(pos, d) {
    if (!pos || !pos.on) { setHidden('#pinTag', true); return; }
    setHidden('#pinTag', false); setStyle('#pinTag', 'left', pos.x.toFixed(1) + 'px'); setStyle('#pinTag', 'top', pos.y.toFixed(1) + 'px');
    setText('#pinTxt', fmtM(d));
  }
  hint(txt) { $('#hint').textContent = txt; }
  banner(text, kind = '', sub = '', dur = 2) {
    const b = $('#banner');
    b.className = 'banner ' + kind; b.innerHTML = `${text}${sub ? `<small>${sub}</small>` : ''}`;
    b.hidden = false; b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    this.bannerT = dur;
  }
  toast(text, dur = 2.5) { const t = $('#toast'); t.textContent = text; t.hidden = false; this.toastT = dur; }
  tick(dt) {
    if (this.bannerT > 0 && (this.bannerT -= dt) <= 0) $('#banner').hidden = true;
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) $('#toast').hidden = true;
  }
  hideBanner() { this.bannerT = 0; $('#banner').hidden = true; }

  // ---------------------------------------------------------------- mini-carte : photo aérienne du trou
  // cadre : rectangle orienté du départ vers le green (green en haut), à la taille affichée du canevas
  mapFrame(hole) {
    const css = this.mini.getBoundingClientRect().height || (innerWidth <= 720 ? Math.min(210, innerHeight * 0.3) : Math.min(500, innerHeight - 300));
    const K = Math.max(1, Math.min(2.5, devicePixelRatio || 1)) * Math.max(1, css / 250);
    const W = Math.round(170 * K), H = Math.round(250 * K);
    const dxz = [hole.pin.x - hole.tee.x, hole.pin.z - hole.tee.z], L = Math.hypot(...dxz);
    const dx = dxz[0] / L, dz = dxz[1] / L, rx = -dz, rz = dx; // d : vers le green ; r : à droite en regardant le green
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    // la ligne de jeu, plus les terres posées sur l'eau (îles, anneau d'un lagon) pour qu'on les voie en entier
    const pts = [...hole.center.map(([x, z]) => [x, z]), [hole.pin.x, hole.pin.z]];
    for (const L of hole.coast?.land || []) {
      if (L.pts) for (const [x, z] of L.pts) { if (Math.hypot(x - hole.tee.x, z - hole.tee.z) < 260) pts.push([x, z]); }
      else pts.push([L.x - L.rx, L.z - L.rz], [L.x + L.rx, L.z + L.rz]);
    }
    for (const [x, z] of pts) { const u = x * rx + z * rz, v = x * dx + z * dz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    u0 -= 48; u1 += 48; v0 -= 26; v1 += 34;
    let wm = u1 - u0, hm = v1 - v0;
    if (wm / hm < W / H) wm = hm * W / H; else hm = wm * H / W;
    const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    return { W, H, K, dx, dz, rx, rz, wm, hm, s: W / wm, cx: uc * rx + vc * dx, cz: uc * rz + vc * dz };
  }
  // fond rendu une fois par trou, plus grand que le canevas : zoomer et se déplacer ne font que recadrer l'image
  mapScale(frame) { return Math.min(2.5, 4096 / frame.H); }
  // photo : canevas de la vue aérienne ; relief : fonction qui calcule la carte en relief à la première demande
  setMap(frame, { photo, relief }) {
    this.mini.width = frame.W; this.mini.height = frame.H;
    this.map = frame;
    this.bg = { photo, relief: null, makeRelief: relief };
    this.mv = { cx: frame.W / 2, cy: frame.H / 2, pan: [0, 0], ball: '' };
    this.mapKey = '';
    this.mapUi();
  }
  toMap(x, z) { const m = this.map, px = x - m.cx, pz = z - m.cz; return { x: m.W / 2 + (px * m.rx + pz * m.rz) * m.s, y: m.H / 2 - (px * m.dx + pz * m.dz) * m.s }; }

  // commandes de la mini-carte : molette et boutons pour zoomer, glisser pour se déplacer, bouton relief
  initMap() {
    try { this.mapPref = { z: 1, relief: false, ...JSON.parse(localStorage.getItem('golf_map') || '{}') }; } catch (e) { this.mapPref = { z: 1, relief: false }; }
    const m = this.mini;
    m.addEventListener('wheel', (e) => { e.preventDefault(); this.zoomMap(this.mapPref.z * Math.exp(-e.deltaY * 0.0018)); }, { passive: false });
    m.addEventListener('pointerdown', (e) => {
      if (this.mapPref.z <= 1.01 || !this.mv) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: [...this.mv.pan] };
      try { m.setPointerCapture(e.pointerId); } catch (err) {}
      m.classList.add('grab');
    });
    m.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d || e.pointerId !== d.id) return;
      const k = m.width / (m.clientWidth || 1) / this.mapPref.z;
      this.mv.pan = [d.pan[0] - (e.clientX - d.x) * k, d.pan[1] - (e.clientY - d.y) * k];
      this.redrawMap();
    });
    const end = () => { this.drag = null; m.classList.remove('grab'); };
    m.addEventListener('pointerup', end); m.addEventListener('pointercancel', end);
    $('#mapIn').addEventListener('click', () => this.zoomMap(this.mapPref.z * 1.6));
    $('#mapOut').addEventListener('click', () => this.zoomMap(this.mapPref.z / 1.6));
    $('#mapRelief').addEventListener('click', () => this.toggleRelief());
  }
  saveMap() { try { localStorage.setItem('golf_map', JSON.stringify(this.mapPref)); } catch (e) {} }
  zoomMap(z) {
    z = Math.min(3.5, Math.max(1, z));
    if (Math.abs(z - this.mapPref.z) < 1e-3) return;
    this.mapPref.z = z < 1.04 ? 1 : z; this.saveMap();
    if (this.mapPref.z === 1 && this.mv) this.mv.pan = [0, 0];
    this.mapUi(); this.redrawMap();
  }
  // zoom au clavier : 1 → 2 → 3,5 → 1
  cycleZoom() { const z = this.mapPref.z; this.zoomMap(z < 1.9 ? 2 : z < 3.4 ? 3.5 : 1); }
  toggleRelief() { this.mapPref.relief = !this.mapPref.relief; this.saveMap(); this.mapUi(); this.redrawMap(); }
  mapUi() {
    const r = this.mapPref.relief;
    $('#mapRelief').setAttribute('aria-pressed', String(r));
    $('#mapIn').disabled = this.mapPref.z >= 3.5; $('#mapOut').disabled = this.mapPref.z <= 1;
    const bg = r && this.bg ? this.reliefBg() : null;
    $('#mapLegend').hidden = !bg;
    if (bg) $('#mapLegend').textContent = `Courbes tous les ${String(bg.contourStep).replace('.', ',')} m · green : 15 cm`;
    this.mini.classList.toggle('zoomed', this.mapPref.z > 1);
  }
  reliefBg() { if (!this.bg.relief && this.bg.makeRelief) this.bg.relief = this.bg.makeRelief(); return this.bg.relief; }
  // redessin demandé par le joueur (zoom, relief, glisser) : le cadre se pose tout de suite
  redrawMap() { this.mapKey = ''; this.mapSnap = true; if (this.lastMap) this.drawMap(...this.lastMap); this.mapSnap = false; }

  drawMap(hole, ball, target, aim, others = [], marks = []) {
    if (!this.bg) return;
    this.lastMap = [hole, ball, target, aim, others, marks];
    const W = this.mini.width, H = this.mini.height, K = this.map.K, z = this.mapPref.z, mv = this.mv;
    const b = this.toMap(ball.x, ball.z), p = this.toMap(hole.pin.x, hole.pin.z), t = target ? this.toMap(target.x, target.z) : null;
    // zoomée, la carte suit la balle et le point visé ; on la déplace à la main jusqu'au coup suivant
    const bk = `${Math.round(ball.x)},${Math.round(ball.z)}`;
    if (bk !== mv.ball) { mv.ball = bk; mv.pan = [0, 0]; }
    let fx = W / 2, fy = H / 2;
    if (z > 1) { fx = (t ? (b.x + t.x) / 2 : b.x) + mv.pan[0]; fy = (t ? (b.y + t.y) / 2 : b.y) + mv.pan[1]; }
    const hw = W / (2 * z), hh = H / (2 * z);
    fx = Math.min(W - hw, Math.max(hw, fx)); fy = Math.min(H - hh, Math.max(hh, fy));
    const k = this.mapSnap ? 1 : 0.22;
    mv.cx += (fx - mv.cx) * k; mv.cy += (fy - mv.cy) * k;
    if (Math.abs(fx - mv.cx) < 0.3) mv.cx = fx;
    if (Math.abs(fy - mv.cy) < 0.3) mv.cy = fy;
    // redessinée seulement quand quelque chose a bougé
    const r = (v) => Math.round(v * 20);
    const key = [this.mapPref.relief ? 'R' : 'P', z * 100, mv.cx, mv.cy, ball.x, ball.z, (aim || 0) * 100, ...(t ? [target.x, target.z] : []), ...marks.flatMap((m) => [m.x, m.z]), ...others.flatMap((o) => [o.x, o.z, o.color])].map((v) => (typeof v === 'number' ? r(v) : v)).join(',');
    if (key === this.mapKey) return;
    this.mapKey = key;
    const bg = this.mapPref.relief ? this.reliefBg() : this.bg.photo, S = bg.width / W;
    const v = (q) => ({ x: (q.x - mv.cx) * z + W / 2, y: (q.y - mv.cy) * z + H / 2 });
    const g = this.mctx;
    g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
    g.clearRect(0, 0, W, H);
    g.drawImage(bg, (mv.cx - hw) * S, (mv.cy - hh) * S, 2 * hw * S, 2 * hh * S, 0, 0, W, H);
    const B = v(b), P = v(p);
    if (t) {
      const T = v(t);
      // ligne de visée bleue ; les points blancs tombent là où la balle irait aux repères 1/3 et 2/3 de la jauge
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,.92)'; g.lineWidth = 3.5 * K; g.beginPath(); g.moveTo(B.x, B.y); g.lineTo(T.x, T.y); g.stroke();
      g.strokeStyle = '#1f6bff'; g.lineWidth = 2 * K; g.beginPath(); g.moveTo(B.x, B.y); g.lineTo(T.x, T.y); g.stroke();
      g.fillStyle = '#fff';
      for (const m of marks) { const q = v(this.toMap(m.x, m.z)); g.beginPath(); g.arc(q.x, q.y, 2.6 * K, 0, Math.PI * 2); g.fill(); }
      // losange jaune : point de chute
      g.save(); g.translate(T.x, T.y); g.rotate(Math.PI / 4);
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * K; g.fillRect(-4.5 * K, -4.5 * K, 9 * K, 9 * K); g.strokeRect(-4.5 * K, -4.5 * K, 9 * K, 9 * K);
      g.restore();
    }
    for (const o of others) { const q = v(this.toMap(o.x, o.z)); g.fillStyle = o.color; g.strokeStyle = '#fff'; g.lineWidth = 1.2 * K; g.beginPath(); g.arc(q.x, q.y, 3.5 * K, 0, Math.PI * 2); g.fill(); g.stroke(); }
    // drapeau
    g.fillStyle = '#fff'; g.fillRect(P.x - 1 * K, P.y - 14 * K, 2 * K, 14 * K);
    g.fillStyle = '#ff2d2d'; g.strokeStyle = '#fff'; g.lineWidth = K;
    g.beginPath(); g.moveTo(P.x + 1 * K, P.y - 14 * K); g.lineTo(P.x + 11 * K, P.y - 10 * K); g.lineTo(P.x + 1 * K, P.y - 6 * K); g.closePath(); g.fill(); g.stroke();
    // balle : triangle cyan pointé dans la direction visée
    const ax = Math.sin(aim || 0), az = Math.cos(aim || 0), m = this.map;
    const dx = ax * m.rx + az * m.rz, dy = -(ax * m.dx + az * m.dz), sz = 8 * K;
    g.fillStyle = '#25d0f0'; g.strokeStyle = '#fff'; g.lineWidth = 1.6 * K;
    g.beginPath(); g.moveTo(B.x + dx * sz, B.y + dy * sz); g.lineTo(B.x - dx * sz * 0.6 - dy * sz * 0.7, B.y - dy * sz * 0.6 + dx * sz * 0.7); g.lineTo(B.x - dx * sz * 0.6 + dy * sz * 0.7, B.y - dy * sz * 0.6 - dx * sz * 0.7); g.closePath(); g.fill(); g.stroke();
  }
}

// ------------------------------------------------------------------ écrans
const SETTINGS_KEY = 'golf_setup';
export function loadSetup() {
  const d = { course: 'campagne', bots: 1, level: 'normal', wind: 'normal', time: 'jour', teams: 'solo' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (e) { return d; }
}
export function saveSetup(o) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(o)); } catch (e) {} }

export function loadingHtml(txt = 'Préparation du parcours') {
  return `<div class="loadscr"><div class="logo">Birdie <span>Party</span></div><div class="spinner" aria-hidden="true"></div><p class="loading" role="status">${esc(txt)}</p></div>`;
}

// carte de score : un tableau par série de 9 trous ; `final` ajoute le podium et les boutons de fin
export function scorecardHtml(R, holes, { final = false, ranking = null, canReplay = false, embedded = false, title = '' } = {}) {
  const cls = (s, par) => (s == null ? 'nd' : s === 1 ? 'eagle' : s - par <= -2 ? 'eagle' : s - par === -1 ? 'birdie' : s - par === 0 ? 'par' : s - par === 1 ? 'bogey' : 'worse');
  const chunks = []; for (let k = 0; k < holes.length; k += 9) chunks.push([k, Math.min(holes.length, k + 9)]);
  const tables = chunks.map(([a, b]) => `<table class="score">
    <thead><tr><th class="nm" scope="col">Trou</th>${holes.slice(a, b).map((h) => `<th scope="col">${h.n}</th>`).join('')}<th class="tot" scope="col">${b - a === holes.length ? 'Total' : a === 0 ? 'Aller' : 'Retour'}</th></tr>
    <tr class="parrow"><td class="nm">Par</td>${holes.slice(a, b).map((h) => `<td>${h.par}</td>`).join('')}<td class="tot">${holes.slice(a, b).reduce((t, h) => t + h.par, 0)}</td></tr></thead>
    <tbody>${R.players.map((p) => { let t = 0; return `<tr><th class="nm" scope="row"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</th>${holes.slice(a, b).map((h, k) => { const s = p.scores[a + k]; if (s != null) t += s; return `<td><span class="${cls(s, h.par)}">${s ?? (a + k < R.hi ? '–' : '')}</span></td>`; }).join('')}<td class="tot">${t || ''}</td></tr>`; }).join('')}</tbody>
  </table>`).join('');
  const pod = final && ranking ? `<ol class="podium">${ranking.map((x) => `<li class="rk r${Math.min(x.rank, 4)}"><b class="medal">${x.rank}</b><i style="background:${esc(x.color)}"></i><span>${esc(x.name)}</span><em>${x.strokes} coups · <strong>${toParTxt(x.toPar)}</strong></em></li>`).join('')}</ol>` : '';
  const legend = '<p class="sc-legend"><span><span class="eagle">2</span> eagle</span><span><span class="birdie">3</span> birdie</span><span><span class="bogey">5</span> bogey</span><span><span class="worse">6</span> double et plus</span></p>';
  // fin de partie : rejouer ou changer de parcours (l'hôte, ou le joueur seul) ; un invité attend que l'hôte choisisse
  const btns = !final ? '' : `<div class="sheet-actions">${canReplay
    ? `<button class="btn primary big" id="btnAgain">Rejouer</button>${embedded ? '<button class="btn secondary big" id="btnMenu">Changer de parcours</button>' : ''}`
    : '<p class="wait-host" role="status"><i aria-hidden="true"></i>L\'hôte choisit la suite : rejouer ou changer de parcours</p>'}<button class="btn ${canReplay && embedded ? 'ghost' : 'secondary big'}" id="btnQuit">${embedded ? 'Retour au salon' : 'Menu principal'}</button></div>`;
  return `<div class="sheet ${final ? 'final' : ''}" role="dialog" aria-label="${esc(title)}"><h2>${esc(title)}</h2>${pod}<div class="tables">${tables}</div>${legend}${btns}</div>`;
}
