// Convoy Storm — HUD (DOM) : tableau de bord de la locomotive, ligne à venir, carte du trajet, marqueurs dans le monde,
// panneau de gare, tutoriel ; écrans : briefing, menu, fin de partie.
// Les écrans sont reconstruits par innerHTML : leurs boutons disparaissent avec eux, aucun écouteur ne traîne.
import { REAR, DECK_Y, LOST_DIST, DIFFICULTY, MODES, CARDS, STATION_NAMES, THROTTLE, personalScore, cardCost,
  ROLES, BIOMES, MOMENTS, CONTRACTS, ENCOUNTERS } from '../engine/sim.js';
import { Line, forksOf, forkOptions, forkChoice, tunnelsOf, legAt, momentOf, momentPos, momentKinds, stationDist } from '../engine/line.js';
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

  // carte du trajet (Tab) : toutes les voies possibles, chaque aiguillage à venir ouvrant ses deux branches jusqu'au bout
  // de l'expédition (700 m devant en mode sans fin). L'arbre est dessiné une fois par route ; par-dessus, à chaque image,
  // la voie parcourue, le convoi et le Front.
  drawMap(v) {
    const cv = this.el.mapCanvas, ctx = cv.getContext('2d'), R = v.route || { legs: ['plaine'], mk: [], pc: null };
    const key = v.seed + ':' + v.mode + ':' + v.goal;
    if (key !== this.lineKey) { this.lineKey = key; this.line = new Line(v.seed, v.mode, v.goal); this.treeLine = new Line(v.seed, v.mode, v.goal); this.treeKey = ''; }
    const line = this.line; line.setRoute(R.legs, R.mk, R.pc);
    const dpr = Math.min(2, devicePixelRatio || 1), W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const tk = R.legs.join(',') + '|' + R.mk.join(',') + '|' + (R.pc ? R.pc.at + ':' + R.pc.c : '') + '|' + (v.mode === 'expedition' ? '' : Math.floor(v.dist / 100));
    if (this.treeKey !== tk) { this.treeKey = tk; this.tree = mapTree(this.treeLine, v, R); this.treeImg = null; }
    const T = this.tree;
    if (!this.treeImg || this.treeImg.w !== W || this.treeImg.h !== H || this.treeImg.dpr !== dpr) this.treeImg = paintTree(T, W, H, dpr);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(this.treeImg.c, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const P = T.P;
    // la voie déjà parcourue
    ctx.strokeStyle = '#9fd3ff'; ctx.lineWidth = 5; ctx.globalAlpha = 0.85; ctx.lineCap = 'round'; ctx.beginPath();
    for (let d = T.start; ; d = Math.min(v.dist, d + 4)) { const p = line.at(d), [x, z] = P(p.x, p.z); if (d === T.start) ctx.moveTo(x, z); else ctx.lineTo(x, z); if (d >= v.dist) break; }
    ctx.stroke(); ctx.globalAlpha = 1;
    // le prochain aiguillage : il clignote
    const nx = T.next;
    if (nx) { const [x, z] = P(nx.x, nx.z); ctx.strokeStyle = '#ffc531'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(performance.now() / 180); ctx.beginPath(); ctx.arc(x, z, 11, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
    const ps = line.at(Math.max(0, v.dist - Math.max(0, v.gap))), [sx, sz] = P(ps.x, ps.z);
    const pm = line.at(v.dist), [mx, mz] = P(pm.x, pm.z);
    ctx.fillStyle = '#ff4b2b'; ctx.beginPath(); ctx.arc(sx, sz, 7, 0, 7); ctx.fill();
    ctx.fillStyle = '#9fd3ff'; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, mz, 8, 0, 7); ctx.fill(); ctx.stroke();
    // l'étiquette du Front se pose là où il reste de la place (pas sur une gare ni un nom déjà écrit)
    placeLabels(ctx, W, T.H, [{ x: sx, y: sz, r: 7, t: 'Front', pri: 9, col: '#ff8a6a' }], [...T.blocks, [mx - 9, mz - 9, mx + 9, mz + 9]], []);
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
// Les voies possibles sur les deux prochains aiguillages (quatre au plus) : on parcourt l'arbre (la voie retenue au levier
// d'abord) et chaque branche n'est tracée qu'une fois, depuis l'aiguillage où elle se sépare ; elle s'arrête au troisième
// aiguillage. La voie retenue (def : celle que suivra le convoi si personne ne touche aux leviers) continue en pointillé
// jusqu'au bout. Les aiguillages déjà franchis gardent une amorce grisée de la voie laissée de côté.
const MAP_DEPTH = 2;
function mapTree(line, v, R) {
  const { seed, mode, goal } = v, exp = mode === 'expedition';
  const end = exp ? goal : v.dist + 700, start = exp ? 0 : Math.max(0, Math.floor(v.dist - 1600));
  const forks = [];
  for (let L = 1; L < 500; L++) {
    const a = stationDist(mode, goal, L - 1); if (a == null || a > end) break;
    for (const f of forksOf(seed, mode, goal, L)) if (f.at >= start && f.at < end) forks.push(f);
  }
  forks.sort((p, q) => p.at - q.at);
  const T = { start, segs: [], nodes: [], cuts: [], stations: [], labels: [], ends: [], bio: new Set(), mom: new Set(), next: null, tail: false, box: [1e9, -1e9, 1e9, -1e9] };
  const pt = (d) => { const p = line.at(d), B = T.box; B[0] = Math.min(B[0], p.x); B[1] = Math.max(B[1], p.x); B[2] = Math.min(B[2], p.z); B[3] = Math.max(B[3], p.z); return p; };
  // une portion [d0, d1] de la route (legs, mk) ; kind : 'live' (voie possible), 'gone' (voie laissée), 'tail' (suite de la voie retenue)
  const draw = (legs, mk, d0, d1, kind, def) => {
    line.setRoute(legs, mk, null);
    let seg = null, lx = 0, lz = 0;
    for (let d = d0; ; d = Math.min(d1, d + 4)) {
      const bio = legs[legAt(mode, goal, d)] || 'plaine', p = pt(d);
      if (!seg || seg.bio !== bio) { seg = { bio, kind, def, pts: seg ? [lx, lz] : [] }; T.segs.push(seg); if (kind !== 'gone') T.bio.add(bio); }
      seg.pts.push(p.x, p.z); lx = p.x; lz = p.z;
      if (d >= d1) break;
    }
    if (kind === 'gone') return;
    if (kind === 'tail') T.tail = true;
    for (let i = 0; i < 99; i++) {
      const sd = stationDist(mode, goal, i); if (sd == null || sd > d1) break;
      if (sd > d0 || d0 === start) T.stations.push({ ...pt(sd), i, def });
    }
    if (exp && d1 >= goal) T.ends.push({ ...pt(goal), def });
  };
  const setC = (f, legs, mk, c) => {
    const L2 = legs.slice(), M2 = mk.slice();
    if (f.k === 'st') L2[f.L] = forkOptions(seed, { legs: L2, mk: M2 }, f)[c]; else M2[f.L] = c;
    return [L2, M2];
  };
  const name = (f, o) => (f.k === 'st' ? `${BIOMES[o]?.icon || ''} ${BIOMES[o]?.label || o}` : `${MOMENTS[o]?.icon || ''} ${MOMENTS[o]?.label || o}`);
  const node = (legs, mk, f, def, decided, c) => { line.setRoute(legs, mk, null); const n = { ...pt(f.at), f, def, decided, c }; T.nodes.push(n); return n; };
  const dfs = (i, legs, mk, from, def, lvl) => {
    if (i === forks.length) { draw(legs, mk, from, end, 'live', def); return; }
    const f = forks[i], nextAt = forks[i + 1] ? forks[i + 1].at : end;
    if (f.k === 'st' ? R.legs[f.L] != null : R.mk[f.L] != null) {
      // aiguillage franchi : la voie prise continue, l'autre n'est plus qu'une amorce
      const c = forkChoice(seed, R, f), [L1, M1] = setC(f, legs, mk, c), [L2, M2] = setC(f, legs, mk, 1 - c);
      node(legs, mk, f, def, true, c);
      dfs(i + 1, L1, M1, from, def, lvl);
      draw(L2, M2, f.at, Math.min(end, nextAt, f.at + 260), 'gone', false);
      return;
    }
    if (lvl >= MAP_DEPTH) {
      // au-delà des deux prochains aiguillages : la branche s'arrête ; la voie retenue continue en pointillé
      draw(legs, mk, from, f.at, 'live', def); T.cuts.push(pt(f.at));
      if (def) { let L2 = legs, M2 = mk; for (let j = i; j < forks.length; j++) [L2, M2] = setC(forks[j], L2, M2, 0); draw(L2, M2, f.at, end, 'tail', true); }
      return;
    }
    const cd = R.pc && R.pc.at === f.at ? R.pc.c : 0, n = node(legs, mk, f, def, false, cd), lc = Math.cos(n.th), ls = Math.sin(n.th);
    if (def && !T.next) T.next = n;
    for (const c of [cd, 1 - cd]) {
      const [L2, M2] = setC(f, legs, mk, c), o = f.k === 'st' ? L2[f.L] : momentKinds(seed, f.L, L2[f.L])[c];
      if (f.k === 'mid') T.mom.add(o);
      // le nom de la branche (paysage ou moment fort), un peu après l'aiguille ; ✔ : la voie du levier
      // l'étiquette se pose du côté où part la branche (dir : vers l'extérieur de l'aiguillage)
      line.setRoute(L2, M2, null); const p = pt(Math.min(f.at + 60, nextAt - 12)), side = (p.x - n.x) * lc + (p.z - n.z) * ls >= 0 ? 1 : -1;
      T.labels.push({ x: p.x, z: p.z, t: name(f, o) + (c === cd ? ' ✔' : ''), pri: lvl ? 4 : 5, col: def && c === cd ? '#fff8ea' : '#c9d2df', dir: [side * lc, side * ls], dot: BIO_COL[L2[legAt(mode, goal, f.at + 60)]] || '#c9d6e3' });
      dfs(i + 1, L2, M2, c === cd ? from : f.at, def && c === cd, lvl + 1);
    }
  };
  dfs(0, R.legs.slice(), R.mk.slice(), start, true, 0);
  return T;
}

// Placement des étiquettes sans chevauchement : autour de chaque repère, on essaie plusieurs positions et l'on garde la
// moins encombrée (une autre étiquette ou un repère : interdit ; une voie dessous : pénalité). Les moins utiles sautent.
function placeLabels(ctx, W, H, items, blocks, dots) {
  const hit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
  const placed = [];
  for (const it of [...items].sort((p, q) => q.pri - p.pri)) {
    ctx.font = it.font || '700 12px "Chakra Petch", sans-serif';
    const w = ctx.measureText(it.t).width + 6, h = 15, r = (it.r || 4) + 3, { x, y } = it;
    const cand = [[x - w / 2, y + r], [x - w / 2, y - r - h], [x + r, y - h / 2], [x - r - w, y - h / 2], [x + r, y + 2], [x + r, y - h - 2], [x - r - w, y + 2], [x - r - w, y - h - 2],
      [x - w / 2, y + r + 14], [x - w / 2, y - r - h - 14], [x + r + 16, y - h / 2], [x - r - w - 16, y - h / 2]];
    // côté préféré d'abord (la branche part de ce côté-là)
    if (it.dir) cand.sort((p, q) => ((q[0] + w / 2 - x) * it.dir[0] + (q[1] + h / 2 - y) * it.dir[1]) - ((p[0] + w / 2 - x) * it.dir[0] + (p[1] + h / 2 - y) * it.dir[1]));
    let best = null, bs = Infinity;
    for (const [cx, cy] of cand) {
      const bx = [cx, cy, cx + w, cy + h];
      if (bx[0] < 4 || bx[2] > W - 4 || bx[1] < 4 || bx[3] > H - 4) continue;
      if (blocks.some((q) => hit(bx, q))) continue;
      let sc = 0; for (const [px, py] of dots) if (px > bx[0] && px < bx[2] && py > bx[1] && py < bx[3]) sc++;
      if (it.dir && ((cx + w / 2 - x) * it.dir[0] + (cy + h / 2 - y) * it.dir[1]) < 0) sc += 3; // du mauvais côté : on n'y va qu'à défaut
      if (sc < bs) { bs = sc; best = bx; if (!sc) break; }
    }
    if (!best) continue;
    blocks.push(best); placed.push([it, best]);
  }
  // un liseré sombre sous chaque texte : lisible même posé sur une voie
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  for (const [it, b] of placed) {
    if (!it.dot) continue;
    // trait de rappel jusqu'au point de la branche nommée
    const qx = Math.max(b[0], Math.min(b[2], it.x)), qy = Math.max(b[1], Math.min(b[3], it.y));
    ctx.strokeStyle = 'rgba(201,210,223,.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(it.x, it.y); ctx.lineTo(qx, qy); ctx.stroke();
    ctx.fillStyle = it.dot; ctx.strokeStyle = '#0c0e14'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x, it.y, 3, 0, 7); ctx.fill(); ctx.stroke();
  }
  for (const [it, b] of placed) {
    ctx.font = it.font || '700 12px "Chakra Petch", sans-serif';
    ctx.strokeStyle = 'rgba(12,14,20,.92)'; ctx.lineWidth = 4; ctx.strokeText(it.t, b[0] + 3, (b[1] + b[3]) / 2);
    ctx.fillStyle = it.col || '#fff8ea'; ctx.fillText(it.t, b[0] + 3, (b[1] + b[3]) / 2);
  }
  ctx.textBaseline = 'alphabetic';
}

// L'arbre des voies, peint une fois dans une image (taille de la carte) ; garde la projection (T.P) et les zones occupées
function paintTree(T, W, H, dpr) {
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W * dpr)); c.height = Math.max(1, Math.round(H * dpr));
  const ctx = c.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // légende : symboles, paysages et moments forts présents sur la carte
  ctx.font = '700 11px "Chakra Petch", sans-serif';
  const items = [{ sym: 'fork', t: 'aiguillage' }, { sym: 'st', t: 'gare' }, ...(T.ends.length ? [{ sym: 'end', t: 'Fort-Givre' }] : []), { sym: 'def', t: 'voie retenue' },
    ...(T.tail ? [{ sym: 'tail', t: 'suite prévue' }] : []),
    ...[...T.bio].map((b) => ({ col: BIO_COL[b], t: BIOMES[b]?.label || b })), ...[...T.mom].map((k) => ({ ic: MOMENTS[k]?.icon, t: MOMENTS[k]?.label || k }))];
  const rows = []; let row = [], rw = 12;
  for (const it of items) { const w = 20 + ctx.measureText(it.t).width + 14; if (rw + w > W - 12 && row.length) { rows.push(row); row = []; rw = 12; } row.push({ ...it, x: rw }); rw += w; }
  if (row.length) rows.push(row);
  const legH = rows.length * 18 + 10;
  const [mnx, mxx, mnz, mxz] = T.box, pad = 40;
  const sc = Math.min((W - pad * 2) / Math.max(60, mxx - mnx), (H - legH - pad * 2) / Math.max(60, mxz - mnz));
  const ox = (W - (mxx - mnx) * sc) / 2, oz = (H - legH - (mxz - mnz) * sc) / 2;
  const P = T.P = (x, z) => [ox + (x - mnx) * sc, oz + (z - mnz) * sc];
  // les voies (et des points de passage, pour que les étiquettes évitent de s'y poser)
  const dots = [];
  const path = (pts) => {
    ctx.beginPath(); let qx = -99, qz = -99;
    for (let i = 0; i < pts.length; i += 2) { const [x, z] = P(pts[i], pts[i + 1]); if (i) ctx.lineTo(x, z); else ctx.moveTo(x, z); if (Math.hypot(x - qx, z - qz) > 5) { dots.push([x, z]); qx = x; qz = z; } }
    ctx.stroke();
  };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.setLineDash([5, 5]); ctx.strokeStyle = '#6a7080'; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
  for (const s of T.segs) if (s.kind === 'gone') path(s.pts);
  ctx.setLineDash([3, 6]); ctx.lineWidth = 2.5; ctx.globalAlpha = 0.6;
  for (const s of T.segs) if (s.kind === 'tail') { ctx.strokeStyle = BIO_COL[s.bio] || '#6a7080'; path(s.pts); }
  ctx.setLineDash([]); ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
  for (const s of T.segs) if (s.kind === 'live' && !s.def) { ctx.strokeStyle = BIO_COL[s.bio] || '#6a7080'; path(s.pts); }
  ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = 10; ctx.globalAlpha = 0.2;
  for (const s of T.segs) if (s.kind === 'live' && s.def) path(s.pts);
  ctx.lineWidth = 5; ctx.globalAlpha = 1;
  for (const s of T.segs) if (s.kind === 'live' && s.def) { ctx.strokeStyle = BIO_COL[s.bio] || '#6a7080'; path(s.pts); }
  // repères : aiguillages (losanges), bouts de branche, gares, Fort-Givre ; chacun réserve sa place
  const blocks = [], reserve = (x, z, r) => blocks.push([x - r, z - r, x + r, z + r]);
  const diamond = (x, z, r) => { ctx.beginPath(); ctx.moveTo(x, z - r); ctx.lineTo(x + r, z); ctx.lineTo(x, z + r); ctx.lineTo(x - r, z); ctx.closePath(); };
  for (const q of T.cuts) { const [x, z] = P(q.x, q.z); ctx.strokeStyle = '#ffc531'; ctx.lineWidth = 1.5; diamond(x, z, 4); ctx.stroke(); reserve(x, z, 5); }
  for (const n of T.nodes) { const [x, z] = P(n.x, n.z), r = n === T.next ? 7 : 5; ctx.fillStyle = n.decided ? '#8e99a8' : '#ffc531'; diamond(x, z, r); ctx.fill(); reserve(x, z, r + 1); }
  const labels = [];
  for (const s of T.stations) {
    const [x, z] = P(s.x, s.z), r = s.def ? 7 : 4; ctx.fillStyle = '#16181d'; ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = s.def ? 2 : 1.5;
    ctx.beginPath(); ctx.arc(x, z, r, 0, 7); ctx.fill(); ctx.stroke(); reserve(x, z, r + 1);
    if (s.def) labels.push({ x, y: z, r, t: stName(s.i), pri: 6 });
  }
  ctx.textAlign = 'center'; ctx.font = '700 12px "Chakra Petch", sans-serif';
  for (const e of T.ends) {
    const [x, z] = P(e.x, e.z);
    if (e.def) { ctx.fillStyle = '#ffc531'; ctx.beginPath(); ctx.arc(x, z, 11, 0, 7); ctx.fill(); ctx.fillStyle = '#16181d'; ctx.fillText('♜', x, z + 4); reserve(x, z, 12); labels.push({ x, y: z, r: 11, t: 'Fort-Givre', pri: 7, col: '#ffc531' }); }
    else { ctx.fillStyle = '#ffc531'; ctx.fillText('♜', x, z + 4); reserve(x, z, 6); }
  }
  for (const l of T.labels) { const [x, y] = P(l.x, l.z); labels.push({ ...l, x, y, r: 2 }); }
  placeLabels(ctx, W, H - legH, labels, blocks, dots);
  T.blocks = blocks; T.H = H - legH;
  // légende
  ctx.font = '700 11px "Chakra Petch", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  rows.forEach((r, i) => {
    const y = H - legH + 9 + i * 18;
    for (const it of r) {
      if (it.col) { ctx.fillStyle = it.col; ctx.fillRect(it.x, y - 4, 14, 8); }
      else if (it.sym === 'fork') { ctx.fillStyle = '#ffc531'; diamond(it.x + 7, y, 5); ctx.fill(); }
      else if (it.sym === 'st') { ctx.fillStyle = '#16181d'; ctx.strokeStyle = '#fff8ea'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(it.x + 7, y, 4.5, 0, 7); ctx.fill(); ctx.stroke(); }
      else if (it.sym === 'end') { ctx.fillStyle = '#ffc531'; ctx.fillText('♜', it.x + 2, y + 1); }
      else if (it.sym === 'def') { ctx.strokeStyle = '#fff8ea'; ctx.globalAlpha = 0.35; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(it.x + 1, y); ctx.lineTo(it.x + 13, y); ctx.stroke(); ctx.globalAlpha = 1; ctx.lineWidth = 3; ctx.strokeStyle = '#c9d6e3'; ctx.stroke(); }
      else if (it.sym === 'tail') { ctx.strokeStyle = '#c9d6e3'; ctx.lineWidth = 2.5; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(it.x, y); ctx.lineTo(it.x + 14, y); ctx.stroke(); ctx.setLineDash([]); }
      else { ctx.font = '12px sans-serif'; ctx.fillText(it.ic || '', it.x, y); ctx.font = '700 11px "Chakra Petch", sans-serif'; }
      ctx.fillStyle = '#c9d2df'; ctx.fillText(it.t, it.x + 20, y);
    }
  });
  ctx.textBaseline = 'alphabetic';
  return { c, w: W, h: H, dpr };
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
