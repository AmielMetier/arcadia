// Convoy Storm — HUD (DOM) : tableau de bord de la locomotive, ligne à venir, carte du trajet, marqueurs dans le monde,
// panneau de gare, tutoriel ; écrans : briefing, menu, fin de partie.
// Les écrans sont reconstruits par innerHTML : leurs boutons disparaissent avec eux, aucun écouteur ne traîne.
import { REAR, DECK_Y, LOST_DIST, DIFFICULTY, MODES, CARDS, STATION_NAMES, THROTTLE, personalScore, cardCost,
  ROLES, BIOMES, MOMENTS, CONTRACTS, ENCOUNTERS } from '../engine/sim.js';
import { Line, forksOf, forkOptions, forkChoice, tunnelsOf, legAt, momentOf, momentPos, stationDist } from '../engine/line.js';
import { ic, ROLE_IC, CARD_CAT } from './icons.js';

const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m');
const stName = (i) => STATION_NAMES[i % STATION_NAMES.length];
const set = (el, t) => { if (el && el.textContent !== t) el.textContent = t; };
const html = (el, h, cache, key) => { if (cache[key] !== h) { cache[key] = h; el.innerHTML = h; } };
const BIO_COL = { plaine: '#c9d6e3', foret: '#3f7a5c', ville: '#8d8a93', lac: '#7cc2ea', col: '#a3a9b8', usine: '#b07a46', toundra: '#e9eef5' };
const CAT_COL = { fire: '#ff7a3d', fuel: '#ffc531', gauge: '#ff4b2b', heat: '#ff9a4a', train: '#9fd3ff', storm: '#8e99a8', hull: '#6fa0d8', compass: '#62d6a7',
  flare: '#ff5a3a', crate: '#c0821f', ladder: '#d8c49a', snow: '#bfe4ff', pouch: '#c79a6a', wrench: '#9aa3ad', axe: '#b98552', scrap: '#c8a24a', harpoon: '#ffd34d', gear: '#c8a24a', survivor: '#a8b8c8' };

// cadran à aiguille (SVG) : une valeur de 0 à 1, une zone rouge au-delà de red
function dialSvg(label, red) {
  const arc = (a0, a1, r) => { const p = (a) => [50 + r * Math.cos(a), 58 + r * Math.sin(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const A0 = Math.PI * 0.85, A1 = Math.PI * 2.15, ar = A0 + (A1 - A0) * (red ?? 2);
  let ticks = '';
  for (let i = 0; i <= 10; i++) { const a = A0 + (A1 - A0) * i / 10, r0 = i % 5 ? 33 : 30; ticks += `<line x1="${(50 + r0 * Math.cos(a)).toFixed(1)}" y1="${(58 + r0 * Math.sin(a)).toFixed(1)}" x2="${(50 + 37 * Math.cos(a)).toFixed(1)}" y2="${(58 + 37 * Math.sin(a)).toFixed(1)}"/>`; }
  return `<svg viewBox="0 0 100 76" class="dial"><path d="${arc(A0, A1, 40)}" class="rim"/>${red != null ? `<path d="${arc(ar, A1, 37)}" class="red"/>` : ''}<g class="tk">${ticks}</g>`
    + `<g class="ndl"><line x1="50" y1="58" x2="50" y2="26"/><circle cx="50" cy="58" r="5"/></g><text x="50" y="74" class="lb">${label}</text><text x="50" y="50" class="val">0</text></svg>`;
}

export class HUD {
  constructor() {
    this.root = $('#hud'); this.el = {};
    for (const id of ['dash', 'gFuel', 'gPress', 'gSpeed', 'thr', 'grade', 'hullBar', 'hullTxt', 'heatBar', 'heatTxt', 'flareTxt', 'scrapTxt', 'survTxt', 'burnTxt',
      'stripSvg', 'bioChip', 'dayChip', 'nextTxt', 'distTxt', 'clockTxt', 'team', 'prompt', 'tracker', 'pops', 'toast', 'markers', 'mapView', 'mapCanvas',
      'stormfx', 'station', 'frost', 'flash', 'bossBox', 'bossBar', 'bossTxt', 'banner', 'night', 'tuto'])
      this.el[id] = document.getElementById(id);
    this.teamKey = ''; this.toastT = 0; this.last = {}; this.flashT = 0; this.bannerT = 0; this.cache = {};
    this.onBuy = null; this.onVote = null; this.onChoose = null;
    this.mapOn = false; this.line = null; this.lineKey = '';
    this.markers = []; this.tuto = loadTuto();
    // cadrans du tableau de bord
    this.el.gFuel.innerHTML = dialSvg('FIOUL', null); this.el.gPress.innerHTML = dialSvg('PRESSION', 0.75); this.el.gSpeed.innerHTML = dialSvg('KM/H', 0.83);
    this.dial = { fuel: this.el.gFuel.querySelector('.ndl'), press: this.el.gPress.querySelector('.ndl'), speed: this.el.gSpeed.querySelector('.ndl') };
    this.dialV = { fuel: this.el.gFuel.querySelector('.val'), press: this.el.gPress.querySelector('.val'), speed: this.el.gSpeed.querySelector('.val') };
    // boutons du panneau de gare (délégation : le contenu est reconstruit, l'écouteur reste)
    this.el.station.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.k) this.onBuy && this.onBuy(b.dataset.k);
      else if (b.dataset.o != null) this.onChoose && this.onChoose(+b.dataset.o);
      else if (b.dataset.vote != null) this.onVote && this.onVote();
    });
    this.el.tuto.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-skip]')) { e.preventDefault(); e.stopPropagation(); this.tuto.off = 1; saveTuto(this.tuto); this.el.tuto.hidden = true; } });
  }
  show(on) { this.root.hidden = !on; if (!on) this.setMap(false); }
  setMap(on) { this.mapOn = on; this.el.mapView.hidden = !on; }
  toggleMap() { this.setMap(!this.mapOn); }
  resetTuto() { this.tuto = {}; saveTuto(this.tuto); this.last.tuto = ''; }

  update(v, scene, dt) {
    const E = this.el, me = v.me;
    // tableau de bord : fioul, pression, vitesse, manette, pente, solidité
    const fmax = v.fmax || 100, fu = Math.max(0, v.fuel);
    const rot = (k) => `rotate(${(-153 + 306 * Math.max(0, Math.min(1, k))).toFixed(1)} 50 58)`;
    this.dial.fuel.setAttribute('transform', rot(fu / fmax)); set(this.dialV.fuel, Math.ceil(fu) + '%');
    this.dial.press.setAttribute('transform', rot((v.press || 0) / 100)); set(this.dialV.press, Math.round(v.press || 0) + '%');
    this.dial.speed.setAttribute('transform', rot(v.speed * 3.6 / 15)); set(this.dialV.speed, String(Math.round(v.speed * 3.6)));
    E.gFuel.classList.toggle('low', fu > 0 && fu < 25); E.gFuel.classList.toggle('out', fu <= 0); E.gPress.classList.toggle('hot', (v.press || 0) > 75);
    set(E.burnTxt, v.stop && v.stop.k === 'station' ? 'en gare · foyer en veille' : v.stop ? 'à l\'arrêt' : fu > 0 ? `−${v.burn.toFixed(2).replace('.', ',')} %/s` : 'PANNE SÈCHE');
    html(E.thr, THROTTLE.map((t, i) => `<span class="${i === v.thr ? 'on' : ''} t${i}">${t.label}</span>`).join(''), this.cache, 'thr');
    const g = v.gr || 0;
    set(E.grade, Math.abs(g) < 0.004 ? (v.tn ? 'tunnel' : 'plat') : `${g > 0 ? '⬈ montée' : '⬊ descente'} ${Math.round(Math.abs(g) * 100)} %`);
    E.grade.className = 'grade ' + (g > 0.004 ? 'up' : g < -0.004 ? 'down' : '');
    const hu = Math.max(0, Math.min(100, v.hull));
    E.hullBar.style.width = hu.toFixed(0) + '%'; set(E.hullTxt, Math.round(hu) + '%'); E.hullBar.parentNode.classList.toggle('low', hu < 40);
    if (me) {
      const h = Math.max(0, Math.min(100, me.heat ?? 100));
      E.heatBar.style.width = h.toFixed(0) + '%'; set(E.heatTxt, Math.round(h) + '%'); E.heatBar.parentNode.classList.toggle('cold', h < 30);
      set(E.flareTxt, '×' + (me.flares | 0));
      E.frost.style.opacity = h < 60 ? ((60 - h) / 60 * 0.9).toFixed(2) : '0';
    } else E.frost.style.opacity = '0';
    set(E.scrapTxt, String(v.scrap | 0));
    const aboard = (v.surv || []).filter((s) => s.ss === 2).length;
    set(E.survTxt, `${aboard}${v.saved ? ` · ${v.saved} sauvé${v.saved > 1 ? 's' : ''}` : ''}`);
    set(E.distTxt, fmtM(v.dist)); set(E.clockTxt, fmtT(v.t));

    // la ligne à venir : le Front, le convoi, les aiguillages, les moments forts, les tunnels, la gare suivante
    this.strip(v);

    // effets d'écran : nuit, front tout proche, loup en chasse
    E.night.style.opacity = ((v.night || 0) * 0.42).toFixed(2);
    const gap = Math.max(0, v.gap);
    E.stormfx.style.opacity = v.calm ? '0' : Math.max(0, Math.min(1, (70 - gap) / 55)).toFixed(2);
    const hunted = me && v.wolves.some((w) => w.st === 1 && w.tg === me.id);
    if (this.flashT > 0) this.flashT -= dt;
    const fc = 'flash' + (this.flashT > 0 ? ' bite' : hunted ? ' hunt' : '');
    if (E.flash.className !== fc) E.flash.className = fc;

    // Brise-Glace
    const bo = v.boss && v.boss.st < 3 ? v.boss : null;
    E.bossBox.hidden = !bo;
    if (bo) { E.bossBar.style.width = (Math.max(0, bo.hp) / bo.hm * 100).toFixed(0) + '%'; set(E.bossTxt, `${v.hooks.length} grappin${v.hooks.length > 1 ? 's' : ''}`); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) E.banner.hidden = true; }

    // équipe (rôle, chaleur, où chacun se trouve)
    const rows = v.players.map((p) => {
      const tag = p.st === 3 ? ['lost', p.heat <= 0.5 ? 'gelé…' : 'perdu…'] : p.st === 2 ? ['', 'remonte'] : !p.on ? ['off', p.z > REAR ? `${Math.round(p.z - REAR)} m derrière` : 'dehors'] : ['', p.tu ? 'tourelle' : 'à bord'];
      const h = Math.round(Math.max(0, Math.min(100, p.heat ?? 100)) / 10) * 10;
      return `<div class="mate ${tag[0]} ${h < 30 ? 'cold' : ''}" style="--c:${esc(p.color)};--h:${h}%" title="${esc(ROLES[p.role]?.label || '')}">${ic(ROLE_IC[p.role] || 'person')}<span class="nm">${esc(p.name)}${p.me ? ' (toi)' : ''}</span><em>${p.carry ? '▣ ' : ''}${tag[1]}</em><s></s></div>`;
    }).join('');
    if (rows !== this.teamKey) { this.teamKey = rows; E.team.innerHTML = rows; }

    this.stationPanel(v);
    this.markersUpdate(v, scene);
    if (this.mapOn) this.drawMap(v);
    this.tutoUpdate(v);

    // consigne contextuelle
    const pr = v.prompt;
    if (pr !== this.last.prompt) { this.last.prompt = pr; E.prompt.hidden = !pr; if (pr) E.prompt.innerHTML = pr; }

    // flèche vers l'échelle quand on est descendu
    if (me && !me.on && me.st < 2) {
      const s = scene.toScreen(0, DECK_Y, REAR + 0.4, true);
      const W = innerWidth, H = innerHeight, m = 40;
      const inside = s.front && s.x > m && s.x < W - m && s.y > m && s.y < H - m;
      const x = Math.min(W - m, Math.max(m, s.x)), y = Math.min(H - m - 60, Math.max(m + 60, s.y));
      E.tracker.hidden = false;
      E.tracker.style.left = x + 'px'; E.tracker.style.top = y + 'px';
      const d = Math.max(0, me.z - REAR);
      E.tracker.querySelector('i').style.transform = inside ? 'rotate(180deg)' : `rotate(${Math.atan2(s.x - x, -(s.y - y))}rad)`;
      E.tracker.querySelector('span').textContent = d > 1 ? `Échelle · ${Math.round(d)} m` : 'Échelle';
      E.tracker.classList.toggle('far', d > LOST_DIST * 0.7);
    } else E.tracker.hidden = true;

    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) E.toast.hidden = true; }
  }

  // bande du haut : 600 m de ligne, de la position du Front jusqu'à la gare suivante
  strip(v) {
    const E = this.el, W = 560, d0 = v.dist - 170, d1 = v.dist + 430, X = (d) => ((d - d0) / (d1 - d0)) * W;
    const R = v.route || { legs: v.legs || ['plaine'], mk: [] };
    const key = Math.round(v.dist) + ':' + Math.round(v.gap) + ':' + R.legs.join() + R.mk.join() + (v.lc | 0) + (v.stop ? v.stop.k : '') + (v.mm ? v.mm.k : '');
    if (key !== this.last.strip) {
      this.last.strip = key;
      let s = '';
      // paysage de chaque tronçon (hachuré : pas encore choisi)
      const L0 = Math.max(0, legAt(v.mode, v.goal, d0)), L1 = legAt(v.mode, v.goal, d1);
      for (let L = L0; L <= L1; L++) {
        const a = L === 0 ? -1e9 : (stationDist(v.mode, v.goal, L - 1) ?? 0) + 110, b = (stationDist(v.mode, v.goal, L) ?? (v.mode === 'expedition' ? v.goal : 1e9)) + 110;
        const x0 = Math.max(0, X(a)), x1 = Math.min(W, X(b)); if (x1 <= x0) continue;
        const bio = R.legs[L];
        s += `<rect x="${x0.toFixed(1)}" y="26" width="${(x1 - x0).toFixed(1)}" height="10" rx="2" fill="${bio ? BIO_COL[bio] : 'url(#unk)'}" opacity="${bio ? 0.95 : 0.7}"/>`;
      }
      // tunnels
      for (let L = Math.max(0, L0 - 1); L <= L1; L++) for (const [t0, t1] of tunnelsOf(v.seed, v.mode, v.goal, R, L)) {
        if (t1 < d0 || t0 > d1) continue; s += `<rect x="${X(t0).toFixed(1)}" y="23" width="${(X(t1) - X(t0)).toFixed(1)}" height="16" rx="3" fill="#1b1e25" opacity=".85"/>`;
      }
      // gares et arrivée
      for (let i = 0; i < 40; i++) { const sd = stationDist(v.mode, v.goal, i); if (sd == null || sd > d1) break; if (sd < d0) continue; s += `<g transform="translate(${X(sd).toFixed(1)} 31)" class="st"><circle r="9"/><text y="4">⚑</text></g>`; }
      if (v.mode === 'expedition' && v.goal >= d0 && v.goal <= d1) s += `<g transform="translate(${X(v.goal).toFixed(1)} 31)" class="st goal"><circle r="10"/><text y="4">♜</text></g>`;
      // aiguillages et moments forts
      const Lc = legAt(v.mode, v.goal, v.dist);
      for (const L of [Lc, Lc + 1, Lc + 2]) {
        for (const f of forksOf(v.seed, v.mode, v.goal, L)) {
          if (f.at < d0 || f.at > d1) continue;
          const o = forkOptions(v.seed, R, f), c = forkChoice(v.seed, R, f), done = f.k === 'st' ? !!R.legs[f.L] : R.mk[f.L] != null;
          s += `<g transform="translate(${X(f.at).toFixed(1)} 31)" class="fk ${done ? 'done' : ''}"><path d="M0 9V1L-7 -9M0 1L7 -9"/>${o ? `<text x="${c ? 8 : -8}" y="-12" class="ol ${c ? 'r' : 'l'}">${esc(f.k === 'st' ? BIOMES[o[c]]?.label : MOMENTS[o[c]]?.label)}</text>` : ''}</g>`;
        }
        const m = momentOf(v.seed, v.mode, v.goal, R, L) || (R.legs[L] && momentPos(v.seed, v.mode, v.goal, L) != null ? { k: '?', d: momentPos(v.seed, v.mode, v.goal, L) } : null);
        if (m && m.d >= d0 && m.d <= d1) s += `<g transform="translate(${X(m.d).toFixed(1)} 31)" class="mo"><rect x="-7" y="-7" width="14" height="14" rx="3" transform="rotate(45)"/><text y="4">${m.k === '?' ? '?' : '!'}</text></g>`;
      }
      // le Front, le convoi
      const xs = X(v.dist - Math.max(0, v.gap));
      s += `<rect x="0" y="14" width="${Math.max(0, xs).toFixed(1)}" height="34" fill="url(#storm)"/><line x1="${xs.toFixed(1)}" y1="12" x2="${xs.toFixed(1)}" y2="50" class="front"/>`;
      s += `<g transform="translate(${X(v.dist).toFixed(1)} 31)" class="me"><rect x="-13" y="-6" width="26" height="12" rx="3"/><circle cx="-7" cy="7" r="2.4"/><circle cx="0" cy="7" r="2.4"/><circle cx="7" cy="7" r="2.4"/></g>`;
      html(E.stripSvg, `<defs><pattern id="unk" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#5a6070"/><rect width="3" height="6" fill="#7a8090"/></pattern>`
        + `<linearGradient id="storm" x1="0" x2="1"><stop offset="0" stop-color="#3a4252" stop-opacity=".95"/><stop offset="1" stop-color="#5a6478" stop-opacity=".55"/></linearGradient></defs>`
        + `<line x1="0" y1="31" x2="${W}" y2="31" class="base"/>${s}`, this.cache, 'strip');
    }
    // étiquettes : paysage, jour/nuit, prochaine étape, avance sur le Front
    const B = BIOMES[v.bio] || BIOMES.plaine, D = v.day || { night: false, left: 0 };
    html(E.bioChip, `${ic(v.bio)}<b>${esc(B.label)}</b>`, this.cache, 'bio');
    html(E.dayChip, `${ic(D.night ? 'snow' : 'plaine')}<b>${D.night ? 'Nuit' : 'Jour'} ${fmtT(Math.max(0, D.left))}</b>`, this.cache, 'day');
    const nx = v.next, gap = Math.max(0, v.gap);
    const t = v.stop && v.stop.k === 'station' ? `En gare : ${stName(v.stop.i)}` : nx ? (nx.k === 'station' ? `${stName(nx.i)} · ${fmtM(Math.max(0, nx.d - v.dist))}` : `Fort-Givre · ${fmtM(Math.max(0, nx.d - v.dist))}`) : '';
    html(E.nextTxt, `${ic(nx && nx.k === 'goal' ? 'castle' : 'station')}<b>${esc(t)}</b><span class="fr ${gap < 25 ? 'close' : gap < 60 ? 'near' : ''}">${ic('storm')}${Math.round(gap)} m</span>`, this.cache, 'next');
  }

  // marqueurs dans le monde : levier d'aiguillage, caisses, survivants, grappins, pannes, tireurs, Brise-Glace
  markersUpdate(v, scene) {
    const me = v.me, W = innerWidth, H = innerHeight, list = [];
    if (me && v.phase === 'play' && v.cine == null) {
      const near = (x, z, r) => Math.hypot(x - me.x, z - me.z) < r;
      const fk = v.fork;
      if (fk) { const z = v.dist - fk.lD, dd = fk.at - (v.dist + 19.4); if (dd > -2 && dd < 220) list.push({ s: scene.toScreen(fk.lx, 2.4, z), i: 'lever', c: 'lever', edge: 1, t: `${Math.max(0, Math.round(dd))} m` }); }
      if (!me.on) for (const c of v.crates) if (c.m === 0 && near(c.x, c.z + v.dist, 16)) list.push({ s: scene.toScreen(c.x, 1.1, c.z + v.dist), i: c.t === 5 ? 'wood' : c.t === 4 ? 'scrap' : c.t === 3 ? 'snow' : 'fuel', c: 'crate' });
      for (const s of v.surv || []) if (s.ss === 0 && near(s.x, s.z, 30)) list.push({ s: scene.toScreen(s.x, 2.4, s.z), i: 'survivor', c: 'surv', edge: 1 });
      if (me.on) {
        for (const h of v.hooks || []) list.push({ s: scene.toScreen(h.x, DECK_Y + 1.8, h.z, true), i: 'harpoon', c: 'danger' });
        for (const f of v.faults || []) list.push({ s: scene.toScreen(f.x, DECK_Y + 1.9, f.z, true), i: f.k === 'fire' ? 'fire' : f.k === 'pipe' ? 'snow' : 'fuel', c: 'danger' });
        for (const w of v.raiders || []) if (w.st === 5) list.push({ s: scene.toScreen(w.rx, DECK_Y + 2.2, w.rz, true), i: 'sword', c: 'danger' });
      }
      for (const q of v.snipers || []) if (q.st === 1 && q.tg === me.id) list.push({ s: scene.groundToScreen(q.x, q.h + 1.4, q.zw), i: 'target', c: 'danger', edge: 1 });
      if (v.boss && v.boss.st < 2) list.push({ s: scene.toScreen(v.boss.x, 4.2, v.boss.z), i: 'boss', c: 'danger', edge: 1 });
    }
    while (this.markers.length < list.length) { const d = document.createElement('div'); d.className = 'mk'; this.el.markers.appendChild(d); this.markers.push({ d, k: '' }); }
    this.markers.forEach((m, i) => {
      const q = list[i];
      if (!q || (!q.s.front && !q.edge)) { if (m.d.style.display !== 'none') m.d.style.display = 'none'; return; }
      let x = q.s.x, y = q.s.y; const off = !q.s.front || x < 30 || x > W - 30 || y < 70 || y > H - 90;
      if (off && !q.edge) { m.d.style.display = 'none'; return; }
      m.d.style.display = '';
      if (off) { if (!q.s.front) { x = W - x; y = H - 80; } x = Math.max(30, Math.min(W - 30, x)); y = Math.max(80, Math.min(H - 100, y)); }
      const k = q.i + q.c + (q.t || '') + (off ? 'o' : '');
      if (m.k !== k) { m.k = k; m.d.className = `mk ${q.c}${off ? ' off' : ''}`; m.d.innerHTML = ic(q.i) + (q.t ? `<b>${q.t}</b>` : ''); }
      m.d.style.transform = `translate(${x.toFixed(0)}px,${y.toFixed(0)}px)`;
    });
  }

  // carte du trajet (touche M) : la voie réellement parcourue, les fourches à venir, le Front, les gares
  drawMap(v) {
    const cv = this.el.mapCanvas, ctx = cv.getContext('2d'), R = v.route || { legs: ['plaine'], mk: [], pc: null };
    const key = v.seed + ':' + v.mode + ':' + v.goal;
    if (key !== this.lineKey) { this.lineKey = key; this.line = new Line(v.seed, v.mode, v.goal); }
    const line = this.line; line.setRoute(R.legs, R.mk, R.pc);
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const end = v.mode === 'expedition' ? v.goal : v.dist + 700;
    const pts = []; let mnx = 1e9, mxx = -1e9, mnz = 1e9, mxz = -1e9;
    for (let d = 0; d <= end; d += 4) { const p = line.at(d); pts.push([d, p.x, p.z]); mnx = Math.min(mnx, p.x); mxx = Math.max(mxx, p.x); mnz = Math.min(mnz, p.z); mxz = Math.max(mxz, p.z); }
    const pad = 46, sc = Math.min((W - pad * 2) / Math.max(60, mxx - mnx), (H - pad * 2) / Math.max(60, mxz - mnz));
    const ox = (W - (mxx - mnx) * sc) / 2, oz = (H - (mxz - mnz) * sc) / 2;
    const P = (x, z) => [ox + (x - mnx) * sc, oz + (z - mnz) * sc];
    // tracé coloré par paysage ; en pointillé ce qui n'est pas encore choisi
    for (let i = 1; i < pts.length; i++) {
      const [d, x, z] = pts[i], [, x0, z0] = pts[i - 1], bio = R.legs[legAt(v.mode, v.goal, d)];
      ctx.strokeStyle = bio ? BIO_COL[bio] : '#6a7080'; ctx.lineWidth = d < v.dist ? 5 : 4; ctx.globalAlpha = d < v.dist ? 0.55 : 1;
      ctx.setLineDash(bio ? [] : [6, 6]);
      ctx.beginPath(); ctx.moveTo(...P(x0, z0)); ctx.lineTo(...P(x, z)); ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
    ctx.font = '700 12px "Chakra Petch", sans-serif'; ctx.textAlign = 'center';
    // étiquette centrée en x, gardée dans le cadre (écran étroit)
    const label = (t, x, y) => { const w = ctx.measureText(t).width / 2; ctx.fillText(t, Math.max(6 + w, Math.min(W - 6 - w, x)), y); };
    for (let L = 1; L < 40; L++) {
      if (stationDist(v.mode, v.goal, L - 1) == null) break;
      for (const f of forksOf(v.seed, v.mode, v.goal, L)) {
        if (f.at > end) continue;
        const p = line.at(f.at), o = forkOptions(v.seed, R, f), c = forkChoice(v.seed, R, f), [px, pz] = P(p.x, p.z);
        ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.arc(px, pz, 5, 0, 7); ctx.fill();
        if (o && f.at > v.dist - 40) {
          const lab = (k) => (f.k === 'st' ? BIOMES[k]?.label : MOMENTS[k]?.label) || '';
          const a = `◄ ${lab(o[0])}${c === 0 ? ' ✔' : ''}`, b = `${lab(o[1])}${c === 1 ? ' ✔' : ''} ►`;
          ctx.fillStyle = '#fff8ea'; label(a, px - 12 - ctx.measureText(a).width / 2, pz - 10); label(b, px + 12 + ctx.measureText(b).width / 2, pz - 10);
        }
      }
    }
    for (let i = 0; i < 40; i++) {
      const sd = stationDist(v.mode, v.goal, i); if (sd == null || sd > end) break;
      const p = line.at(sd), [x, z] = P(p.x, p.z);
      ctx.fillStyle = '#16181d'; ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, z, 8, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#fff8ea'; label(stName(i), x, z + 22);
    }
    if (v.mode === 'expedition') { const p = line.at(v.goal), [x, z] = P(p.x, p.z); ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.arc(x, z, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#16181d'; ctx.fillText('♜', x, z + 4); ctx.fillStyle = '#ffc531'; label('Fort-Givre', x, z + 26); }
    const ps = line.at(Math.max(0, v.dist - Math.max(0, v.gap))), [sx, sz] = P(ps.x, ps.z); ctx.fillStyle = '#ff4b2b'; ctx.beginPath(); ctx.arc(sx, sz, 7, 0, 7); ctx.fill(); label('Front', sx - 26, sz + 4);
    const pm = line.at(v.dist), [mx, mz] = P(pm.x, pm.z); ctx.fillStyle = '#9fd3ff'; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, mz, 8, 0, 7); ctx.fill(); ctx.stroke();
  }

  // tutoriel : quelques étapes cochées au fil de la première partie
  tutoEvent(e, mine) {
    const T = this.tuto; if (T.off || !mine) return;
    const k = { feed: 'feed', found: 'search', empty: 'search', board: 'ladder', vent: 'vent', lever: 'lever', buy: 'card', timber: 'chop' }[e.e];
    if (k && !T[k]) { T[k] = 1; saveTuto(T); this.last.tuto = ''; }
  }
  tutoUpdate(v) {
    const T = this.tuto, E = this.el.tuto;
    if (T.off || v.phase !== 'play' || v.cine != null) { E.hidden = true; return; }
    const steps = [['feed', 'Jette une caisse dans la chaudière (E devant le foyer)'], ['search', 'Saute du train et fouille une ruine (lanterne jaune, E maintenu)'], ['ladder', 'Remonte à bord par l\'échelle de queue'],
      ['vent', 'Quand la pression grimpe, lâche la vapeur à la soupape'], ['lever', 'Bascule le levier d\'un aiguillage, au bord de la voie'], ['card', 'En gare, prends une carte d\'amélioration'], ['chop', 'En forêt, abats un arbre pour faire des bûches']];
    if (steps.every(([k]) => T[k])) { T.off = 1; saveTuto(T); E.hidden = true; return; }
    const h = `<b>${ic('info')} Premiers pas</b>${steps.map(([k, t]) => `<div class="${T[k] ? 'ok' : ''}">${ic(T[k] ? 'check' : 'crate')}<span>${esc(t)}</span></div>`).join('')}<button data-skip>Masquer</button>`;
    if (this.last.tuto !== h) { this.last.tuto = h; E.innerHTML = h; }
    E.hidden = !!(v.stop && v.stop.k === 'station');
  }

  // panneau de gare : cartes (la première offerte), contrat, rencontre, aiguillage, départ à l'unanimité ; au convoi abandonné, le départ seul
  stationPanel(v) {
    const E = this.el, s = v.stop;
    if (!s || (s.k !== 'station' && s.k !== 'wreck') || v.phase !== 'play') { E.station.hidden = true; this.last.st = ''; return; }
    E.station.hidden = false;
    const n = v.players.length, votes = (s.v || []).length, mine = (s.v || []).includes(v.meId);
    const go = `<button class="go ${mine ? 'on' : ''}" data-vote>${mine ? '✔ Prêt' : s.k === 'wreck' ? 'Repartir' : 'Prêt à partir'} <img class="key" src="img/icons/keys/v.png" alt="V"> <em>${votes}/${n}</em></button>`;
    if (s.k === 'wreck') {
      const h = `<div class="sh">${ic('wreck')}<b>Convoi abandonné</b><span>${ic('time')}${Math.max(0, Math.ceil(s.t))} s</span></div>`
        + `<p class="wk">Des caisses attendent le long du vieux train, côté gauche. Le Front, lui, ne s'arrête pas.</p>` + go;
      if (h !== this.last.st) { this.last.st = h; E.station.innerHTML = h; }
      return;
    }
    const cards = (s.c || []).map((k, i) => {
      const U = CARDS[k], l = v.up[k] | 0, taken = s.b && s.b[i], c = s.f ? 0 : cardCost(k, l), cat = CARD_CAT[k] || 'star';
      const pips = U.max > 1 ? `<span class="lv">${Array.from({ length: U.max }, (_, j) => `<i class="${j < l ? 'on' : ''}"></i>`).join('')}</span>` : '';
      const cls = taken ? 'taken' : v.scrap >= c ? (s.f ? 'free' : '') : 'poor';
      return `<button data-k="${k}" class="crd ${cls} ${U.mod ? 'mod' : ''}" ${taken ? 'disabled' : ''} style="--cc:${CAT_COL[cat] || '#ffc531'}">`
        + `<span class="art">${ic(cat)}<img class="key" src="img/icons/keys/${i + 1}.png" alt="${i + 1}"></span><span class="tx"><b>${esc(U.label)}${U.mod ? ' <i>module</i>' : ''}</b><small>${esc(U.desc)}</small></span>`
        + `<span class="co">${pips}${taken ? 'PRISE' : s.f ? 'OFFERTE' : `${ic('scrap')}${c}`}</span></button>`;
    }).join('');
    let extra = '';
    if (v.ct) extra += `<div class="ctr">${ic('award')}<span><b>Contrat · ${esc(CONTRACTS[v.ct.k].label)}</b><small>${esc(CONTRACTS[v.ct.k].desc)} Récompense : ${CONTRACTS[v.ct.k].r} ferraille.</small></span></div>`;
    if (s.en) {
      const EN = ENCOUNTERS[s.en];
      extra += `<div class="enc ${s.ed ? 'done' : ''}">${ic('person')}<span><b>${esc(EN.label)}</b><small>${esc(EN.desc)}</small>`
        + (s.ed ? `<em>${s.ed === 1 ? 'Marché conclu.' : 'Vous avez refusé.'}</em>` : `<span class="ch"><button data-o="0">${esc(EN.opts[0])} <img class="key" src="img/icons/keys/o.png" alt="O"></button><button data-o="1">${esc(EN.opts[1])} <img class="key" src="img/icons/keys/n.png" alt="N"></button></span>`) + '</span></div>';
    }
    if (s.fk) {
      const c = v.lc | 0;
      extra += `<div class="fkh">${ic('fork')}<span><b>Aiguillage de sortie</b><small>Le levier est au bout du quai, côté gauche. Voie choisie : <b>${esc(BIOMES[s.fk[c]]?.label)}</b> · l'autre : ${esc(BIOMES[s.fk[1 - c]]?.label)}.</small></span></div>`;
    }
    const h = `<div class="sh">${ic('station')}<b>${esc(stName(s.i))}</b><span>${ic('time')}${Math.max(0, Math.ceil(s.t))} s</span></div>`
      + `<div class="sc">${ic('scrap')}Ferraille commune : <b>${v.scrap | 0}</b>${s.f ? ' · <span class="gift">une carte offerte</span>' : ''}</div>`
      + `<div class="ups">${cards}</div>` + extra + go;
    if (h !== this.last.st) { this.last.st = h; E.station.innerHTML = h; }
  }

  // grand titre au centre de l'écran (nouveau paysage, moment fort)
  banner(title, sub, sec = 3.2, icon = '') {
    const E = this.el;
    E.banner.innerHTML = `<b>${icon ? ic(icon) : ''}${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
    E.banner.hidden = false; E.banner.classList.remove('in'); void E.banner.offsetWidth; E.banner.classList.add('in');
    this.bannerT = sec;
  }
  flash() { this.flashT = 0.35; }
  toast(txt, sec = 2.5) { this.el.toast.textContent = txt; this.el.toast.hidden = false; this.toastT = sec; }
  pop(txt, sx, sy, cls = '') {
    const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = txt;
    d.style.left = sx + 'px'; d.style.top = sy + 'px';
    this.el.pops.appendChild(d);
    setTimeout(() => d.remove(), 1600);
  }
}
function loadTuto() { try { return JSON.parse(localStorage.getItem('convoy_tuto2') || '{}') || {}; } catch (e) { return {}; } }
function saveTuto(T) { try { localStorage.setItem('convoy_tuto2', JSON.stringify(T)); } catch (e) {} }

// ------------------------------------------------------------------ écrans
const seg = (key, entries, cur) => `<div class="seg">${entries.map(([k, label]) => `<button data-k="${key}" data-v="${k}" class="${cur === k ? 'sel' : ''}">${label}</button>`).join('')}</div>`;

export function briefingHtml({ role, squad, cfg, embedded, myRole = -1 }) {
  const host = role !== 'guest', edit = host && !embedded;
  const diffSeg = edit ? seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, esc(d.label)]), cfg.difficulty) : `<b class="val">${esc(DIFFICULTY[cfg.difficulty].label)}</b>`;
  const modeSeg = edit ? seg('mode', Object.entries(MODES).map(([k, m]) => [k, esc(m.label)]), cfg.mode) : `<b class="val">${esc(MODES[cfg.mode].label)}</b>`;
  const goal = DIFFICULTY[cfg.difficulty].goal;
  const tile = (i, t, d) => `<div>${ic(i)}<span><b>${t}</b>${d}</span></div>`;
  return `<div class="panel card" id="briefPanel">
    <h1>CONVOY <span>STORM</span></h1>
    <p class="lead">Un convoi blindé, une chaudière, un équipage. Derrière vous, le Front de tempête. Devant, des forêts, des villes mortes, des lacs gelés et des cols… et c'est vous qui choisissez la route.</p>
    <div class="rules">
      ${tile('fuel', 'Nourrir la chaudière', 'Fioul, charbon, bûches, fioul gelé à dégeler. À 0 %, c\'est la panne sèche.')}
      ${tile('storm', 'Garder de l\'avance', 'Le Front ne s\'arrête jamais (il ralentit en gare). S\'il vous rattrape, c\'est fini.')}
      ${tile('fork', 'Choisir sa route', 'Aux aiguillages, un joueur bascule le levier au bord de la voie : la forêt ou le lac ? le pont ou le convoi abandonné ?')}
      ${tile('axe', 'Chaque paysage, son geste', 'Abattre des arbres, pousser un wagonnet de charbon, pomper une cuve, fouiller les immeubles…')}
      ${tile('wolf', 'Survivre', 'Le froid, les loups (fusées), les pillards (renversez-les), les tireurs, la nuit.')}
      ${tile('station', 'En gare', 'Des cartes d\'amélioration (la première offerte), un contrat, parfois une rencontre.')}
    </div>
    <p class="keys"><img class="key" src="img/icons/keys/arrows.png" alt=""> bouger · <img class="key" src="img/icons/keys/e.png" alt="E"> agir (maintenir) · <img class="key" src="img/icons/keys/f.png" alt="F"> lancer · <img class="key" src="img/icons/keys/g.png" alt="G"> fusée · <img class="key" src="img/icons/keys/space.png" alt="Espace"> sauter · <img class="key" src="img/icons/keys/tab.png" alt="Tab"> carte</p>
    <div class="opts">
      <div><h2>Mode</h2>${modeSeg}<p class="hint">${cfg.mode === 'expedition' ? `Rallier Fort-Givre à ${fmtM(goal)}, trois gares en chemin.` : esc(MODES.endless.desc)}</p></div>
      <div><h2>Difficulté</h2>${diffSeg}</div>
    </div>
    <h2>Ton rôle</h2>${seg('role', ROLES.map((r, i) => [String(i), `${ic(ROLE_IC[i])} ${esc(r.label)}`]), String(myRole))}
    <p class="hint">${myRole >= 0 ? esc(ROLES[myRole].desc) : 'Choisis un talent ; sinon tu prendras celui qui manque à l\'équipage.'}</p>
    <h2>Équipage</h2>
    <div class="squad">${squad.map((p) => `<span class="${p.ready ? '' : 'wait'}" style="--c:${esc(p.color)}"><i></i>${p.role >= 0 ? ic(ROLE_IC[p.role]) : ''}${esc(p.name)}${p.me ? ' (toi)' : ''}</span>`).join('')}</div>
    <div class="row end">
      <small class="cred">Modèles 3D et icônes : Kenney (CC0)</small>
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
      ${host ? '<button class="btn big yellow" id="btnGo">Départ !</button>' : '<span class="wait"><i></i>L\'hôte lance le convoi…</span>'}
    </div></div>`;
}

export function menuHtml({ muted, solo }) {
  return `<div class="panel card" style="width:min(360px,100%)"><h1 style="font-size:28px">PAUSE${solo ? '' : ' <small style="font-size:14px">(le convoi roule toujours)</small>'}</h1>
    <div class="row" style="flex-direction:column;align-items:stretch;margin-top:16px">
      <button class="btn yellow" id="btnResume">Reprendre</button>
      <button class="btn ghost" id="btnSound">${muted ? 'Activer le son' : 'Couper le son'}</button>
      <button class="btn ghost" id="btnTuto">Revoir les premiers pas</button>
      <button class="btn" id="btnQuit">Quitter la partie</button></div></div>`;
}

export function endHtml({ snap, canReplay, embedded, reason }) {
  const ps = snap.P.map((a) => ({ id: a[0], fed: a[17], found: a[18], falls: a[19], bites: a[25] | 0, role: a[27] | 0 }));
  const names = new Map(snap.N.map(([id, n, c]) => [id, { n, c }]));
  ps.sort((a, b) => personalScore(b) - personalScore(a));
  const win = !!snap.wn && reason !== 'host';
  const why = snap.wy || 'fuel';
  const title = reason === 'host' ? 'LIAISON PERDUE' : win ? 'FORT-GIVRE !' : { storm: 'ENGLOUTIS', hull: 'CONVOI DÉTRUIT' }[why] || 'PANNE SÈCHE';
  const exp = (snap.mo || 'expedition') === 'expedition';
  const sub = reason === 'host' ? 'L\'hôte a quitté la partie et personne n\'a pu reprendre le convoi.'
    : win ? 'Le convoi passe les portes de la ville. Bravo !'
      : (why === 'storm' ? 'Le front de tempête a rattrapé le convoi.' : why === 'hull' ? 'Explosions, avalanches, pillards et virages : le convoi n\'a pas tenu.' : 'La chaudière s\'est éteinte.')
        + (exp ? ` À ${fmtM(Math.max(0, (snap.gl || 0) - snap.d))} de Fort-Givre.` : '');
  const saved = snap.sv | 0;
  return `<div class="panel card ${win ? 'win' : ''}" id="endPanel">
    <h1>${title}</h1><p>${sub}</p>
    <div class="big-num">${win ? fmtT(snap.t) : fmtM(snap.d)}</div>
    <p>${win ? `<b>${fmtM(snap.d)}</b>` : `<b>${fmtT(snap.t)}</b> de route`} · <b>${snap.ft}</b> caisse${snap.ft > 1 ? 's' : ''} au feu · ${snap.ns | 0} gare${(snap.ns | 0) > 1 ? 's' : ''} · <b>${saved}</b> survivant${saved > 1 ? 's' : ''} sauvé${saved > 1 ? 's' : ''} · ${esc(MODES[snap.mo]?.label || '')} <b>${esc(DIFFICULTY[snap.df]?.label || '')}</b></p>
    <p class="legs">${(snap.lg || ['plaine']).map((b) => `<span style="--bc:${BIO_COL[b] || '#ccc'}">${ic(b)}${esc(BIOMES[b]?.label || '')}</span>`).join('<i>→</i>')}</p>
    ${ps.length ? `<table class="res"><thead><tr><th>#</th><th>CHAUFFEUR</th><th>AU FEU</th><th>TROUVÉES</th><th>CHUTES</th><th>MORSURES</th></tr></thead><tbody>
      ${ps.map((p, k) => { const nm = names.get(p.id) || { n: '?', c: '#888' }; return `<tr><td>${k + 1}</td><td><i style="background:${esc(nm.c)}"></i>${ic(ROLE_IC[p.role])} ${esc(nm.n)}</td><td>${p.fed}</td><td>${p.found}</td><td>${p.falls}</td><td>${p.bites}</td></tr>`; }).join('')}
    </tbody></table>` : ''}
    <div class="row end">
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
      ${canReplay ? '<button class="btn big yellow" id="btnAgain">Repartir</button>' : embedded ? '<span class="wait"><i></i>L\'hôte peut relancer un convoi…</span>' : ''}
    </div></div>`;
}

export const fmt = { fmtT, fmtM };
