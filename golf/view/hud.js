// Birdie Party — interface : carte du trou, distance, vent, club, trajectoire, jauge, mini-carte, bannières, écrans.
import { CLUBS, LIE } from '../engine/clubs.js';
import { COURSES } from '../engine/course.js';

const $ = (s) => document.querySelector(s);
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
    this.miniBg = null;
  }
  show(on) { this.el.hidden = !on; }
  hole(h, stroke) {
    $('#hNum').textContent = h.n; $('#hPar').textContent = `Par ${h.par}`; $('#hLen').textContent = `${h.length} m`;
    $('#hStroke').textContent = stroke;
  }
  // bandeau des joueurs : couleur, nom, score par rapport au par ; celui qui joue est mis en avant
  players(list) {
    $('#players').innerHTML = list.map((p) => `<div class="pl ${p.cur ? 'cur' : ''} ${p.done ? 'done' : ''}"><i style="background:${esc(p.color)}"></i><b>${esc(p.name)}</b><span>${p.toPar === 0 ? 'E' : p.toPar > 0 ? '+' + p.toPar : p.toPar}</span>${p.done ? '<em>✓</em>' : ''}</div>`).join('');
  }
  dist(m) { $('#distTxt').textContent = fmtM(m); }
  lie(l) { $('#lieTxt').textContent = lieLabel(l); }
  // flèche du vent dans le repère de la caméra (vers le haut = vent dans le dos)
  wind(w, heading) {
    const a = (w.dir - heading) * 180 / Math.PI;
    $('#windArrow').style.transform = `rotate(${-a}deg)`;
    $('#windArrow').style.opacity = w.speed < 0.25 ? 0.25 : 1;
    $('#windTxt').textContent = w.speed < 0.25 ? 'Calme' : `${String(w.speed).replace('.', ',')} m/s`;
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
    const t = $('#pinTag');
    if (!pos || !pos.on) { t.hidden = true; return; }
    t.hidden = false; t.style.left = pos.x + 'px'; t.style.top = pos.y + 'px';
    $('#pinTxt').textContent = fmtM(d);
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
    const pts = [...hole.center.map(([x, z]) => [x, z]), [hole.pin.x, hole.pin.z]];
    for (const [x, z] of pts) { const u = x * rx + z * rz, v = x * dx + z * dz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    u0 -= 48; u1 += 48; v0 -= 26; v1 += 34;
    let wm = u1 - u0, hm = v1 - v0;
    if (wm / hm < W / H) wm = hm * W / H; else hm = wm * H / W;
    const uc = (u0 + u1) / 2, vc = (v0 + v1) / 2;
    return { W, H, K, dx, dz, rx, rz, wm, hm, s: W / wm, cx: uc * rx + vc * dx, cz: uc * rz + vc * dz };
  }
  setMap(canvas, frame) {
    this.mini.width = frame.W; this.mini.height = frame.H;
    this.map = frame;
    this.miniBg = canvas;
  }
  toMap(x, z) { const m = this.map, px = x - m.cx, pz = z - m.cz; return { x: m.W / 2 + (px * m.rx + pz * m.rz) * m.s, y: m.H / 2 - (px * m.dx + pz * m.dz) * m.s }; }
  drawMap(hole, ball, target, aim, others = []) {
    if (!this.miniBg) return;
    const g = this.mctx, W = this.mini.width, H = this.mini.height, K = this.map.K;
    g.imageSmoothingEnabled = true;
    g.clearRect(0, 0, W, H);
    g.drawImage(this.miniBg, 0, 0);
    const b = this.toMap(ball.x, ball.z), p = this.toMap(hole.pin.x, hole.pin.z);
    if (target) {
      const t = this.toMap(target.x, target.z);
      // ligne de visée bleue, ponctuée de points blancs
      g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 7 * K / 2; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.stroke();
      g.strokeStyle = '#1f6bff'; g.lineWidth = 4 * K / 2; g.beginPath(); g.moveTo(b.x, b.y); g.lineTo(t.x, t.y); g.stroke();
      const L = Math.hypot(t.x - b.x, t.y - b.y), n = Math.max(1, Math.floor(L / (16 * K)));
      g.fillStyle = '#fff';
      for (let k = 1; k < n; k++) { g.beginPath(); g.arc(b.x + (t.x - b.x) * k / n, b.y + (t.y - b.y) * k / n, 2.4 * K, 0, Math.PI * 2); g.fill(); }
      // losange jaune : point de chute
      g.save(); g.translate(t.x, t.y); g.rotate(Math.PI / 4);
      g.fillStyle = '#ffd23f'; g.strokeStyle = '#fff'; g.lineWidth = 1.5 * K; g.fillRect(-4.5 * K, -4.5 * K, 9 * K, 9 * K); g.strokeRect(-4.5 * K, -4.5 * K, 9 * K, 9 * K);
      g.restore();
    }
    for (const o of others) { const q = this.toMap(o.x, o.z); g.fillStyle = o.color; g.beginPath(); g.arc(q.x, q.y, 3.5 * K, 0, Math.PI * 2); g.fill(); }
    // drapeau
    g.fillStyle = '#fff'; g.fillRect(p.x - 1 * K, p.y - 14 * K, 2 * K, 14 * K);
    g.fillStyle = '#ff2d2d'; g.strokeStyle = '#fff'; g.lineWidth = K;
    g.beginPath(); g.moveTo(p.x + 1 * K, p.y - 14 * K); g.lineTo(p.x + 11 * K, p.y - 10 * K); g.lineTo(p.x + 1 * K, p.y - 6 * K); g.closePath(); g.fill(); g.stroke();
    // balle : triangle cyan pointé dans la direction visée
    const ax = Math.sin(aim || 0), az = Math.cos(aim || 0), m = this.map;
    const dx = ax * m.rx + az * m.rz, dy = -(ax * m.dx + az * m.dz), sz = 8 * K;
    g.fillStyle = '#25d0f0'; g.strokeStyle = '#fff'; g.lineWidth = 1.6 * K;
    g.beginPath(); g.moveTo(b.x + dx * sz, b.y + dy * sz); g.lineTo(b.x - dx * sz * 0.6 - dy * sz * 0.7, b.y - dy * sz * 0.6 + dx * sz * 0.7); g.lineTo(b.x - dx * sz * 0.6 + dy * sz * 0.7, b.y - dy * sz * 0.6 - dx * sz * 0.7); g.closePath(); g.fill(); g.stroke();
  }
}

// ------------------------------------------------------------------ écrans
const SETTINGS_KEY = 'golf_setup';
export function loadSetup() {
  const d = { course: 'campagne', bots: 1, level: 'normal', wind: 'normal' };
  try { return { ...d, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; } catch (e) { return d; }
}
export function saveSetup(o) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(o)); } catch (e) {} }

// écran titre (hors du Hub) : parcours, bots, niveau et vent
export function titleHtml(set) {
  const seg = (key, opts) => `<div class="seg" data-k="${key}">${opts.map(([v, l]) => `<button data-v="${v}" class="${String(set[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  return `<div class="title">
    <div class="logo">Birdie <span>Party</span></div>
    <div class="setup panel">
      <h3>Parcours</h3>
      <div class="courses" data-k="course">${Object.entries(COURSES).map(([k, c]) => `<button data-v="${k}" class="course ${k} ${set.course === k ? 'on' : ''}"><b>${c.label.split(' · ')[0]}</b><small>${c.holes.length} trous</small></button>`).join('')}</div>
      <div class="opts">
        <label>Bots</label>${seg('bots', [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']])}
        <label>Niveau</label>${seg('level', [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']])}
        <label>Vent</label>${seg('wind', [['calme', 'Calme'], ['normal', 'Normal'], ['fort', 'Fort']])}
      </div>
    </div>
    <button class="bigbtn" id="btnPlay">Jouer</button>
    <div class="howto">Glisse vers le bas pour armer, lance vers le haut pour frapper · <b>Espace</b> au clavier · <b>← →</b> viser · <b>↑ ↓</b> club · <b>V</b> vue d'ensemble</div>
  </div>`;
}
export function loadingHtml(txt = 'Préparation du parcours') { return `<div class="title"><div class="logo">Birdie <span>Party</span></div><div class="loading dots">${esc(txt)}</div></div>`; }

// carte de score : un tableau par série de 9 trous ; `final` ajoute le podium et les boutons de fin
export function scorecardHtml(R, holes, { final = false, ranking = null, canReplay = false, embedded = false, title = '' } = {}) {
  const cls = (s, par) => (s == null ? 'nd' : s === 1 ? 'eagle' : s - par <= -2 ? 'eagle' : s - par === -1 ? 'birdie' : s - par === 0 ? 'par' : s - par === 1 ? 'bogey' : 'worse');
  const chunks = []; for (let k = 0; k < holes.length; k += 9) chunks.push([k, Math.min(holes.length, k + 9)]);
  const tables = chunks.map(([a, b]) => `<table class="score">
    <tr><th class="nm">Trou</th>${holes.slice(a, b).map((h) => `<th>${h.n}</th>`).join('')}<th class="tot">${b - a === holes.length ? 'Total' : a === 0 ? 'Aller' : 'Retour'}</th></tr>
    <tr class="parrow"><td class="nm">Par</td>${holes.slice(a, b).map((h) => `<td>${h.par}</td>`).join('')}<td class="tot">${holes.slice(a, b).reduce((t, h) => t + h.par, 0)}</td></tr>
    ${R.players.map((p) => { let t = 0; return `<tr><td class="nm"><i style="background:${esc(p.color)}"></i>${esc(p.name)}</td>${holes.slice(a, b).map((h, k) => { const s = p.scores[a + k]; if (s != null) t += s; return `<td><span class="${cls(s, h.par)}">${s ?? (a + k < R.hi ? '–' : '')}</span></td>`; }).join('')}<td class="tot">${t || ''}</td></tr>`; }).join('')}
  </table>`).join('');
  const pod = final && ranking ? `<div class="podium">${ranking.map((x) => `<div class="rk r${Math.min(x.rank, 4)}"><b>${x.rank === 1 ? '🏆' : x.rank === 2 ? '🥈' : x.rank === 3 ? '🥉' : x.rank + 'e'}</b><i style="background:${esc(x.color)}"></i><span>${esc(x.name)}</span><em>${x.strokes} coups · ${toParTxt(x.toPar)}</em></div>`).join('')}</div>` : '';
  const btns = final ? `<div class="row">${canReplay ? '<button class="bigbtn" id="btnAgain">Rejouer</button>' : ''}<button class="bigbtn blue" id="btnQuit">${embedded ? 'Retour au salon' : 'Menu'}</button></div>` : '';
  return `<div class="card panel scorecard ${final ? 'final' : ''}"><h2>${esc(title)}</h2>${pod}${tables}${btns}</div>`;
}
