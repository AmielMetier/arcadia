// Convoy Storm — HUD (DOM) et écrans : briefing, menu, fin de partie, connexion perdue.
// Les écrans sont reconstruits par innerHTML : leurs boutons disparaissent avec eux, aucun écouteur ne traîne.
import { REAR, DECK_Y, LOST_DIST, DIFFICULTY, MODES, UPGRADES, UPG_KEYS, STATION_NAMES, stationDist, personalScore } from '../engine/sim.js';

const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m');
const stName = (i) => STATION_NAMES[i % STATION_NAMES.length];

export class HUD {
  constructor() {
    this.root = $('#hud'); this.el = {};
    for (const id of ['fuelBox', 'fuelBar', 'fuelTxt', 'burnTxt', 'speedTxt', 'distTxt', 'clockTxt', 'crateTxt', 'scrapTxt', 'team', 'prompt', 'tracker', 'pops', 'toast',
      'routeFill', 'routeTicks', 'routeTrain', 'routeTxt', 'vitals', 'heatBar', 'heatTxt', 'flareTxt', 'station', 'frost', 'flash'])
      this.el[id] = document.getElementById(id);
    this.teamKey = ''; this.toastT = 0; this.last = {}; this.flashT = 0;
    this.onBuy = null; this.onVote = null;
    // boutons du panneau de gare (délégation : le contenu est reconstruit, l'écouteur reste)
    this.el.station.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.k) this.onBuy && this.onBuy(b.dataset.k); else if (b.dataset.vote != null) this.onVote && this.onVote();
    });
  }
  show(on) { this.root.hidden = !on; }

  update(v, scene, dt) {
    const E = this.el;
    const fu = Math.max(0, v.fuel), fmax = v.fmax || 100;
    E.fuelBar.style.width = (fu / fmax * 100).toFixed(1) + '%';
    set(E.fuelTxt, Math.ceil(fu) + ' %' + (fmax > 100 ? ` / ${fmax}` : ''));
    set(E.burnTxt, v.stop && v.stop.k === 'station' ? 'EN GARE · foyer en veille' : v.stop ? 'À L\'ARRÊT' : fu > 0 ? `−${v.burn.toFixed(2).replace('.', ',')} %/s` : 'PANNE SÈCHE');
    set(E.speedTxt, Math.round(v.speed * 3.6) + ' km/h');
    E.fuelBox.classList.toggle('low', fu > 0 && fu < 25);
    E.fuelBox.classList.toggle('out', fu <= 0);
    set(E.distTxt, fmtM(v.dist)); set(E.clockTxt, fmtT(v.t)); set(E.crateTxt, String(v.fedTotal)); set(E.scrapTxt, String(v.scrap | 0));

    this.route(v);

    // équipe (chaleur de chacun)
    const rows = v.players.map((p) => {
      const tag = p.st === 3 ? ['lost', p.heat <= 0.5 ? 'gelé…' : 'perdu…'] : p.st === 2 ? ['', 'remonte'] : !p.on ? ['off', p.z > REAR ? `${Math.round(p.z - REAR)} m derrière` : 'dans la neige'] : ['', p.carry ? '📦 à bord' : 'à bord'];
      const h = Math.round(Math.max(0, Math.min(100, p.heat ?? 100)) / 10) * 10;
      return `<div class="mate ${tag[0]} ${h < 30 ? 'cold' : ''}" style="--c:${esc(p.color)};--h:${h}%"><span class="nm">${esc(p.name)}${p.me ? ' (toi)' : ''}</span><em>${p.carry && tag[1] !== '📦 à bord' ? '📦 ' : ''}${tag[1]}</em><s></s></div>`;
    }).join('');
    if (rows !== this.teamKey) { this.teamKey = rows; E.team.innerHTML = rows; }

    // chaleur et fusées du joueur local ; givre au bord de l'écran quand il a froid
    const me = v.me;
    E.vitals.hidden = !me;
    if (me) {
      const h = Math.max(0, Math.min(100, me.heat ?? 100));
      E.heatBar.style.width = h.toFixed(0) + '%';
      set(E.heatTxt, Math.round(h) + ' %');
      E.vitals.classList.toggle('cold', h < 30);
      set(E.flareTxt, '×' + (me.flares | 0));
      E.frost.style.opacity = h < 60 ? ((60 - h) / 60 * 0.9).toFixed(2) : '0';
    } else E.frost.style.opacity = '0';
    // loup en chasse : vignette rouge qui pulse
    const hunted = me && v.wolves.some((w) => w.st === 1 && w.tg === me.id);
    if (this.flashT > 0) this.flashT -= dt;
    const fc = 'flash' + (this.flashT > 0 ? ' bite' : hunted ? ' hunt' : '');
    if (E.flash.className !== fc) E.flash.className = fc;

    this.stationPanel(v);

    // consigne contextuelle
    const pr = v.prompt;
    if (pr !== this.last.prompt) { this.last.prompt = pr; E.prompt.hidden = !pr; if (pr) E.prompt.innerHTML = pr; }

    // flèche vers l'échelle quand on est descendu (ou derrière la caméra)
    if (me && !me.on && me.st < 2) {
      const s = scene.toScreen(0, DECK_Y, REAR + 0.4);
      const W = innerWidth, H = innerHeight, m = 40;
      const inside = s.front && s.x > m && s.x < W - m && s.y > m && s.y < H - m;
      const x = Math.min(W - m, Math.max(m, s.x)), y = Math.min(H - m - 60, Math.max(m + 60, s.y));
      E.tracker.hidden = false;
      E.tracker.style.left = x + 'px'; E.tracker.style.top = y + 'px';
      const d = Math.max(0, me.z - REAR);
      E.tracker.querySelector('i').style.transform = inside ? 'rotate(180deg)' : `rotate(${Math.atan2(s.x - x, -(s.y - y))}rad)`;
      E.tracker.querySelector('span').textContent = d > 1 ? `Échelle · ${Math.round(d)} m` : 'Échelle';
      E.tracker.style.color = d > LOST_DIST * 0.7 ? '#ff4b2b' : '';
    } else E.tracker.hidden = true;

    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) E.toast.hidden = true; }
  }

  // barre d'itinéraire : expédition = toute la ligne jusqu'à Fort-Givre ; sans fin = jusqu'à la prochaine gare
  route(v) {
    const E = this.el;
    let a = 0, b = 1, txt;
    const ticks = [];
    if (v.mode === 'expedition' && v.goal) {
      b = v.goal;
      for (let i = 0; i < 3; i++) ticks.push([stationDist('expedition', v.goal, i), i < v.ns]);
      const nx = v.next;
      txt = v.win ? '🏰 Fort-Givre · arrivés !' : nx && nx.k === 'station' ? `🚉 ${stName(nx.i)} · ${fmtM(Math.max(0, nx.d - v.dist))}` : `🏰 Fort-Givre · ${fmtM(Math.max(0, v.goal - v.dist))}`;
    } else {
      const nd = stationDist('endless', 0, v.ns);
      a = v.ns > 0 ? stationDist('endless', 0, v.ns - 1) : 0; b = nd;
      txt = `🚉 ${stName(v.ns)} · ${fmtM(Math.max(0, nd - v.dist))}`;
    }
    if (v.stop && v.stop.k === 'station') txt = `🚉 En gare : ${stName(v.stop.i)}`;
    const k = Math.max(0, Math.min(1, (v.dist - a) / Math.max(1, b - a)));
    E.routeFill.style.width = (k * 100).toFixed(1) + '%';
    E.routeTrain.style.left = (k * 100).toFixed(1) + '%';
    const key = ticks.map(([d, p]) => d + ':' + p).join('|') + v.mode;
    if (key !== this.last.ticks) {
      this.last.ticks = key;
      E.routeTicks.innerHTML = ticks.map(([d, passed]) => `<i class="${passed ? 'ok' : ''}" style="left:${(d / b * 100).toFixed(1)}%"></i>`).join('') + `<b>${v.mode === 'expedition' ? '🏰' : '🚉'}</b>`;
    }
    set(E.routeTxt, txt);
  }

  // panneau de gare : améliorations (achetées avec la ferraille commune) et départ à l'unanimité
  stationPanel(v) {
    const E = this.el, s = v.stop;
    if (!s || s.k !== 'station' || v.phase !== 'play') { E.station.hidden = true; this.last.st = ''; return; }
    E.station.hidden = false;
    const n = v.players.length, votes = (s.v || []).length, mine = (s.v || []).includes(v.meId);
    const rows = UPG_KEYS.map((k, i) => {
      const U = UPGRADES[k], l = v.up[k] | 0, max = U.cost.length, c = U.cost[l];
      const pips = Array.from({ length: max }, (_, j) => `<i class="${j < l ? 'on' : ''}"></i>`).join('');
      return `<button data-k="${k}" class="${l >= max ? 'max' : v.scrap >= c ? '' : 'poor'}" ${l >= max ? 'disabled' : ''} title="${esc(U.desc)}">`
        + `<kbd>${i + 1}</kbd><span class="ic">${U.icon}</span><span class="tx"><b>${esc(U.label)}</b><small>${esc(U.desc)}</small></span>`
        + `<span class="lv">${pips}</span><span class="co">${l >= max ? 'MAX' : `⚙️ ${c}`}</span></button>`;
    }).join('');
    const html = `<div class="sh"><b>🚉 ${esc(stName(s.i))}</b><span>départ dans ${Math.max(0, Math.ceil(s.t))} s</span></div>`
      + `<div class="sc">Ferraille commune : <b>⚙️ ${v.scrap | 0}</b></div>`
      + `<div class="ups">${rows}</div>`
      + `<button class="go ${mine ? 'on' : ''}" data-vote>${mine ? '✔ Prêt' : 'Prêt à partir'} <kbd>V</kbd> <em>${votes}/${n}</em></button>`;
    if (html !== this.last.st) { this.last.st = html; E.station.innerHTML = html; }
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
const set = (el, t) => { if (el.textContent !== t) el.textContent = t; };

// ------------------------------------------------------------------ écrans
const seg = (key, entries, cur) => `<div class="seg">${entries.map(([k, label]) => `<button data-k="${key}" data-v="${k}" class="${cur === k ? 'sel' : ''}">${esc(label)}</button>`).join('')}</div>`;

export function briefingHtml({ role, squad, cfg, embedded }) {
  const host = role !== 'guest', edit = host && !embedded;
  const diffSeg = edit ? seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]), cfg.difficulty) : `<b class="val">${esc(DIFFICULTY[cfg.difficulty].label)}</b>`;
  const modeSeg = edit ? seg('mode', Object.entries(MODES).map(([k, m]) => [k, m.label]), cfg.mode) : `<b class="val">${esc(MODES[cfg.mode].label)}</b>`;
  const goal = DIFFICULTY[cfg.difficulty].goal;
  return `<div class="panel card" id="briefPanel">
    <h1>CONVOY <span>STORM</span></h1>
    <p class="lead">Le blizzard ne s'arrête jamais. Le convoi non plus — tant que la chaudière a du fioul et que l'équipage tient le froid.</p>
    <div class="rules">
      <div><b class="t">🔥 Chaudière</b>Une caisse de fioul = +25 %. À 0 %, le convoi s'arrête pour de bon. Sa chaleur te réchauffe.</div>
      <div><b class="t">🏚️ Ruines</b>Saute du train, cours aux lanternes, maintiens <kbd>E</kbd> : fioul et ferraille.</div>
      <div><b class="t">📦 Caisses</b><kbd>E</kbd> prendre, <kbd>F</kbd> lancer : sur le wagon, à un équipier ou dans le foyer.</div>
      <div><b class="t">🥶 Froid</b>Dehors, ta chaleur baisse. À zéro tu t'effondres : reviens près du feu à temps.</div>
      <div><b class="t">🐺 Loups</b>Ils traquent les isolés. <kbd>G</kbd> plante une fusée éclairante qui les fait fuir.</div>
      <div><b class="t">⛔ Voie</b>Congères à déblayer (<kbd>E</kbd> devant la loco), avalanches, bourrasques…</div>
      <div><b class="t">🚉 Gares</b>Fioul, chaleur, fusées. La ferraille achète des améliorations (<kbd>1</kbd>–<kbd>5</kbd>), <kbd>V</kbd> pour repartir.</div>
    </div>
    <div class="opts">
      <div><h2>Mode</h2>${modeSeg}<p class="hint">${cfg.mode === 'expedition' ? `Rallier Fort-Givre à ${fmtM(goal)}, trois gares en chemin.` : esc(MODES.endless.desc)}</p></div>
      <div><h2>Difficulté</h2>${diffSeg}</div>
    </div>
    <h2>Équipage</h2>
    <div class="squad">${squad.map((p) => `<span class="${p.ready ? '' : 'wait'}" style="--c:${esc(p.color)}"><i></i>${esc(p.name)}${p.me ? ' (toi)' : ''}</span>`).join('')}</div>
    <div class="row end">
      <small class="cred">Modèles 3D : Kenney (CC0)</small>
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
      ${host ? '<button class="btn big yellow" id="btnGo">Départ !</button>' : '<span class="wait"><i></i>L\'hôte lance le convoi…</span>'}
    </div></div>`;
}

export function menuHtml({ muted, solo }) {
  return `<div class="panel card" style="width:min(360px,100%)"><h1 style="font-size:28px">PAUSE${solo ? '' : ' <small style="font-size:14px">(le convoi roule toujours)</small>'}</h1>
    <div class="row" style="flex-direction:column;align-items:stretch;margin-top:16px">
      <button class="btn yellow" id="btnResume">Reprendre</button>
      <button class="btn ghost" id="btnSound">${muted ? 'Activer le son' : 'Couper le son'}</button>
      <button class="btn" id="btnQuit">Quitter la partie</button></div></div>`;
}

export function endHtml({ snap, canReplay, embedded, reason }) {
  const ps = snap.P.map((a) => ({ id: a[0], fed: a[17], found: a[18], falls: a[19], bites: a[25] | 0 }));
  const names = new Map(snap.N.map(([id, n, c]) => [id, { n, c }]));
  ps.sort((a, b) => personalScore(b) - personalScore(a));
  const win = !!snap.wn && reason !== 'host';
  const title = reason === 'host' ? 'LIAISON PERDUE' : win ? 'FORT-GIVRE !' : 'PANNE SÈCHE';
  const exp = (snap.mo || 'expedition') === 'expedition';
  const sub = reason === 'host' ? 'L\'hôte a quitté la partie et personne n\'a pu reprendre le convoi.'
    : win ? 'Le convoi passe les portes de la ville. Tout l\'équipage est sauf — bravo !'
      : exp ? `La chaudière s'est éteinte à ${fmtM(Math.max(0, (snap.gl || 0) - snap.d))} de Fort-Givre.` : 'La chaudière s\'est éteinte. Le convoi s\'immobilise dans la tempête.';
  return `<div class="panel card ${win ? 'win' : ''}" id="endPanel">
    <h1>${title}</h1><p>${sub}</p>
    <div class="big-num">${win ? fmtT(snap.t) : fmtM(snap.d)}</div>
    <p>${win ? `<b>${fmtM(snap.d)}</b>` : `<b>${fmtT(snap.t)}</b> de route`} · <b>${snap.ft}</b> caisse${snap.ft > 1 ? 's' : ''} brûlée${snap.ft > 1 ? 's' : ''} · ${snap.ns | 0} gare${(snap.ns | 0) > 1 ? 's' : ''} · ${esc(MODES[snap.mo]?.label || '')} <b>${esc(DIFFICULTY[snap.df]?.label || '')}</b></p>
    ${ps.length ? `<table class="res"><thead><tr><th>#</th><th>CHAUFFEUR</th><th>BRÛLÉES</th><th>TROUVÉES</th><th>CHUTES</th><th>MORSURES</th></tr></thead><tbody>
      ${ps.map((p, k) => { const nm = names.get(p.id) || { n: '?', c: '#888' }; return `<tr><td>${k + 1}</td><td><i style="background:${esc(nm.c)}"></i>${esc(nm.n)}</td><td>${p.fed}</td><td>${p.found}</td><td>${p.falls}</td><td>${p.bites}</td></tr>`; }).join('')}
    </tbody></table>` : ''}
    <div class="row end">
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
      ${canReplay ? '<button class="btn big yellow" id="btnAgain">Repartir</button>' : embedded ? '<span class="wait"><i></i>L\'hôte peut relancer un convoi…</span>' : ''}
    </div></div>`;
}

export const fmt = { fmtT, fmtM };
