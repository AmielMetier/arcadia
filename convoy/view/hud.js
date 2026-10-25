// Convoy Storm — HUD (DOM) et écrans : briefing, menu, fin de partie, connexion perdue.
// Les écrans sont reconstruits par innerHTML : leurs boutons disparaissent avec eux, aucun écouteur ne traîne.
import { REAR, DECK_Y, LOST_DIST, DIFFICULTY, MODES, CARDS, STATION_NAMES, THROTTLE, STORM_MAX, stationDist, personalScore, cardCost,
  ROLES, BIOMES, MOMENTS, momentKind, BRIDGE_LEN } from '../engine/sim.js';

const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m');
const stName = (i) => STATION_NAMES[i % STATION_NAMES.length];

export class HUD {
  constructor() {
    this.root = $('#hud'); this.el = {};
    for (const id of ['fuelBox', 'fuelBar', 'fuelTxt', 'burnTxt', 'speedTxt', 'distTxt', 'clockTxt', 'crateTxt', 'scrapTxt', 'team', 'prompt', 'tracker', 'pops', 'toast',
      'routeFill', 'routeTicks', 'routeTrain', 'routeTxt', 'mechBox', 'pressBar', 'pressTxt', 'thrTxt', 'stormBox', 'stormBar', 'stormTxt', 'hullBox', 'hullTxt', 'stormfx', 'vitals', 'heatBar', 'heatTxt', 'flareTxt', 'station', 'frost', 'flash',
      'dayTxt', 'bioTxt', 'bossBox', 'bossBar', 'bossTxt', 'banner', 'night'])
      this.el[id] = document.getElementById(id);
    this.teamKey = ''; this.toastT = 0; this.last = {}; this.flashT = 0; this.bannerT = 0;
    this.onBuy = null; this.onVote = null; this.onRoute = null;
    // boutons du panneau de gare (délégation : le contenu est reconstruit, l'écouteur reste)
    this.el.station.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      e.preventDefault(); e.stopPropagation();
      if (b.dataset.k) this.onBuy && this.onBuy(b.dataset.k);
      else if (b.dataset.r != null) this.onRoute && this.onRoute(+b.dataset.r);
      else if (b.dataset.vote != null) this.onVote && this.onVote();
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

    // pression, manette, front de tempête, solidité du convoi
    E.mechBox.hidden = E.stormBox.hidden = E.hullBox.hidden = !!v.calm;
    const prs = Math.max(0, Math.min(100, v.press || 0));
    E.pressBar.style.width = prs.toFixed(0) + '%'; set(E.pressTxt, Math.round(prs) + ' %');
    E.mechBox.classList.toggle('hot', prs > 75);
    set(E.thrTxt, THROTTLE[v.thr]?.label || '');
    E.mechBox.dataset.thr = v.thr;
    const g = Math.max(0, v.gap);
    E.stormBar.style.width = Math.min(100, g / STORM_MAX * 100).toFixed(1) + '%'; set(E.stormTxt, Math.round(g) + ' m');
    E.stormfx.style.opacity = v.calm ? '0' : Math.max(0, Math.min(1, (70 - g) / 55)).toFixed(2);
    E.stormBox.classList.toggle('near', g < 60); E.stormBox.classList.toggle('close', g < 25);
    set(E.hullTxt, Math.max(0, Math.round(v.hull)) + ' %'); E.hullBox.classList.toggle('low', v.hull < 40);

    // jour et nuit, ambiance du tronçon et moment fort qui approche, Brise-Glace
    const D = v.day || { night: false, left: 0 };
    set(E.dayTxt, `${D.night ? '🌙 nuit' : '☀️ jour'} ${fmtT(Math.max(0, D.left))}`);
    E.night.style.opacity = ((v.night || 0) * 0.42).toFixed(2);
    const B = BIOMES[v.bio] || BIOMES.plaine, M = v.moment;
    let mt = '';
    if (M && !v.calm) {
      const I = MOMENTS[M.k], d = M.d - v.dist;
      if (M.on && M.k === 'roar') mt = (M.t || 0) < 40 ? `${I.icon} Le Front rugit !` : `${I.icon} Le Front s'essouffle`;
      else if (M.on && M.k === 'boss') mt = `${I.icon} ${I.label} !`;
      else if (M.on && M.k === 'bridge' && d < 0) mt = `${I.icon} Sur le pont`;
      else if (d < 450 && d > 0) mt = `${I.icon} ${I.label} · ${fmtM(d)}`;
    }
    const bt = `${B.icon} ${B.label}${mt ? ` <em>${mt}</em>` : ''}`;
    if (bt !== this.last.bio) { this.last.bio = bt; E.bioTxt.innerHTML = bt; }
    const bo = v.boss && v.boss.st < 3 ? v.boss : null;
    E.bossBox.hidden = !bo;
    if (bo) { E.bossBar.style.width = (Math.max(0, bo.hp) / bo.hm * 100).toFixed(0) + '%'; set(E.bossTxt, `${'■'.repeat(Math.max(0, bo.hp))}${'□'.repeat(Math.max(0, bo.hm - bo.hp))} · ${v.hooks.length} grappin${v.hooks.length > 1 ? 's' : ''}`); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) E.banner.hidden = true; }

    // équipe (chaleur de chacun)
    const rows = v.players.map((p) => {
      const tag = p.st === 3 ? ['lost', p.heat <= 0.5 ? 'gelé…' : 'perdu…'] : p.st === 2 ? ['', 'remonte'] : !p.on ? ['off', p.z > REAR ? `${Math.round(p.z - REAR)} m derrière` : 'dans la neige'] : ['', p.carry ? '📦 à bord' : 'à bord'];
      const h = Math.round(Math.max(0, Math.min(100, p.heat ?? 100)) / 10) * 10;
      const R = ROLES[p.role] || ROLES[0];
      return `<div class="mate ${tag[0]} ${h < 30 ? 'cold' : ''}" style="--c:${esc(p.color)};--h:${h}%"><span class="nm" title="${esc(R.label)}">${R.icon} ${esc(p.name)}${p.me ? ' (toi)' : ''}</span><em>${p.carry && tag[1] !== '📦 à bord' ? '📦 ' : ''}${tag[1]}</em><s></s></div>`;
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

  // panneau de gare : trois cartes (la première offerte), l'aiguillage, le départ à l'unanimité ; au convoi abandonné, le départ seul
  stationPanel(v) {
    const E = this.el, s = v.stop;
    if (!s || (s.k !== 'station' && s.k !== 'wreck') || v.phase !== 'play') { E.station.hidden = true; this.last.st = ''; return; }
    E.station.hidden = false;
    const n = v.players.length, votes = (s.v || []).length, mine = (s.v || []).includes(v.meId);
    const go = `<button class="go ${mine ? 'on' : ''}" data-vote>${mine ? '✔ Prêt' : s.k === 'wreck' ? 'Repartir' : 'Prêt à partir'} <kbd>V</kbd> <em>${votes}/${n}</em></button>`;
    if (s.k === 'wreck') {
      const html = `<div class="sh"><b>🚃 Convoi abandonné</b><span>départ dans ${Math.max(0, Math.ceil(s.t))} s</span></div>`
        + `<p class="wk">Des caisses attendent le long du vieux train, côté gauche. Le Front, lui, ne s'arrête pas.</p>` + go;
      if (html !== this.last.st) { this.last.st = html; E.station.innerHTML = html; }
      return;
    }
    const cards = (s.c || []).map((k, i) => {
      const U = CARDS[k], l = v.up[k] | 0, taken = s.b && s.b[i], c = s.f ? 0 : cardCost(k, l);
      const pips = U.max > 1 ? `<span class="lv">${Array.from({ length: U.max }, (_, j) => `<i class="${j < l ? 'on' : ''}"></i>`).join('')}</span>` : '<span></span>';
      const cls = taken ? 'max' : v.scrap >= c ? (s.f ? 'free' : '') : 'poor';
      return `<button data-k="${k}" class="${cls}" ${taken ? 'disabled' : ''} title="${esc(U.desc)}">`
        + `<kbd>${i + 1}</kbd><span class="ic">${U.icon}</span><span class="tx"><b>${esc(U.label)}</b><small>${esc(U.desc)}</small></span>`
        + `${pips}<span class="co">${taken ? 'PRISE' : s.f ? 'OFFERTE' : `⚙️ ${c}`}</span></button>`;
    }).join('');
    let fork = '';
    if (s.fk) {
      const rv = s.rv || [], my = rv.find((x) => x[0] === v.meId);
      fork = `<div class="fk"><h3>🔀 Aiguillage · prochain tronçon</h3>` + s.fk.map((b, i) => {
        const B = BIOMES[b], M = MOMENTS[momentKind(v.seed, s.i + 1, b)], nv = rv.filter((x) => x[1] === i).length;
        return `<button data-r="${i}" class="${my && my[1] === i ? 'sel' : ''}"><kbd>${i + 4}</kbd><span class="ic">${B.icon}</span>`
          + `<span class="tx"><b>${esc(B.label)}</b><small>${esc(B.desc)}</small><small class="mo">${M.icon} ${esc(M.label)}</small></span><em>${nv ? '●'.repeat(nv) : ''}</em></button>`;
      }).join('') + '</div>';
    }
    const html = `<div class="sh"><b>🚉 ${esc(stName(s.i))}</b><span>départ dans ${Math.max(0, Math.ceil(s.t))} s</span></div>`
      + `<div class="sc">Ferraille commune : <b>⚙️ ${v.scrap | 0}</b>${s.f ? ' · <span class="gift">🎁 une carte offerte</span>' : ''}</div>`
      + `<div class="ups">${cards}</div>` + fork + go;
    if (html !== this.last.st) { this.last.st = html; E.station.innerHTML = html; }
  }

  // grand titre au centre de l'écran (nouveau paysage, moment fort)
  banner(title, sub, sec = 3.2) {
    const E = this.el;
    E.banner.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`;
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
const set = (el, t) => { if (el.textContent !== t) el.textContent = t; };

// ------------------------------------------------------------------ écrans
const seg = (key, entries, cur) => `<div class="seg">${entries.map(([k, label]) => `<button data-k="${key}" data-v="${k}" class="${cur === k ? 'sel' : ''}">${esc(label)}</button>`).join('')}</div>`;

export function briefingHtml({ role, squad, cfg, embedded, myRole = -1 }) {
  const host = role !== 'guest', edit = host && !embedded;
  const diffSeg = edit ? seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]), cfg.difficulty) : `<b class="val">${esc(DIFFICULTY[cfg.difficulty].label)}</b>`;
  const modeSeg = edit ? seg('mode', Object.entries(MODES).map(([k, m]) => [k, m.label]), cfg.mode) : `<b class="val">${esc(MODES[cfg.mode].label)}</b>`;
  const goal = DIFFICULTY[cfg.difficulty].goal;
  return `<div class="panel card" id="briefPanel">
    <h1>CONVOY <span>STORM</span></h1>
    <p class="lead">Le blizzard ne s'arrête jamais. Le convoi non plus — tant que la chaudière a du fioul et que l'équipage tient le froid.</p>
    <div class="rules">
      <div><b class="t">🔥 Chaudière</b>Fioul +25 %, charbon +45 % (lourd), fioul gelé à dégeler près du feu, pièces = ferraille. À 0 %, c'est la panne.</div>
      <div><b class="t">🏚️ Ruines</b>Saute du train, cours aux lanternes, maintiens <kbd>E</kbd> : fioul et ferraille.</div>
      <div><b class="t">📦 Caisses</b><kbd>E</kbd> prendre, <kbd>F</kbd> lancer : sur le wagon, à un équipier ou dans le foyer.</div>
      <div><b class="t">🥶 Froid</b>Dehors, ta chaleur baisse. À zéro tu t'effondres : reviens près du feu à temps.</div>
      <div><b class="t">🐺 Loups</b>Ils traquent les isolés. <kbd>G</kbd> plante une fusée éclairante qui les fait fuir.</div>
      <div><b class="t">🌪️ Le Front</b>Un mur de tempête vous suit et ne s'arrête jamais. S'il rattrape le convoi, c'est fini : gardez de l'avance.</div>
      <div><b class="t">🕹️ Cabine</b>La manette règle la vitesse : Éco, Normal ou À fond (plus vite, mais ça brûle et la pression grimpe).</div>
      <div><b class="t">♨️ À bord</b>Lâchez la vapeur à la soupape avant l'explosion, dégelez les tuyaux, colmatez les fuites (<kbd>E</kbd> maintenu).</div>
      <div><b class="t">🏴 Pillards</b>En motoneige, ils volent les caisses du pont et sabotent le convoi. Renversez-les (<kbd>E</kbd> au bord) ou visez-les.</div>
      <div><b class="t">⛔ Voie</b>Congères à déblayer (<kbd>E</kbd> devant la loco), avalanches, bourrasques…</div>
      <div><b class="t">🚉 Gares</b>Le Front y ralentit. Trois cartes d'amélioration (<kbd>1</kbd>–<kbd>3</kbd>, la première offerte), <kbd>V</kbd> pour repartir.</div>
      <div><b class="t">🔀 Aiguillage</b>En gare, votez la voie suivante (<kbd>4</kbd> <kbd>5</kbd>) : forêt, ville, lac gelé, col… chacune a ses règles.</div>
      <div><b class="t">🌙 Nuit</b>Les loups sont plus nombreux et voient plus loin, le froid mord ; les pillards, eux, se terrent.</div>
      <div><b class="t">⚡ Moments forts</b>Le Brise-Glace, un pont fragile (en Éco !), un convoi abandonné, le Front qui rugit…</div>
    </div>
    <div class="opts">
      <div><h2>Mode</h2>${modeSeg}<p class="hint">${cfg.mode === 'expedition' ? `Rallier Fort-Givre à ${fmtM(goal)}, trois gares en chemin.` : esc(MODES.endless.desc)}</p></div>
      <div><h2>Difficulté</h2>${diffSeg}</div>
    </div>
    <h2>Ton rôle</h2>${seg('role', ROLES.map((r, i) => [String(i), `${r.icon} ${r.label}`]), String(myRole))}
    <p class="hint">${myRole >= 0 ? esc(ROLES[myRole].desc) : 'Choisis un talent ; sinon tu prendras celui qui manque à l\'équipage.'}</p>
    <h2>Équipage</h2>
    <div class="squad">${squad.map((p) => `<span class="${p.ready ? '' : 'wait'}" style="--c:${esc(p.color)}"><i></i>${p.role >= 0 ? ROLES[p.role].icon + ' ' : ''}${esc(p.name)}${p.me ? ' (toi)' : ''}</span>`).join('')}</div>
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
  const ps = snap.P.map((a) => ({ id: a[0], fed: a[17], found: a[18], falls: a[19], bites: a[25] | 0, role: a[27] | 0 }));
  const names = new Map(snap.N.map(([id, n, c]) => [id, { n, c }]));
  ps.sort((a, b) => personalScore(b) - personalScore(a));
  const win = !!snap.wn && reason !== 'host';
  const why = snap.wy || 'fuel';
  const title = reason === 'host' ? 'LIAISON PERDUE' : win ? 'FORT-GIVRE !' : { storm: 'ENGLOUTIS', hull: 'CONVOI DÉTRUIT' }[why] || 'PANNE SÈCHE';
  const exp = (snap.mo || 'expedition') === 'expedition';
  const sub = reason === 'host' ? 'L\'hôte a quitté la partie et personne n\'a pu reprendre le convoi.'
    : win ? 'Le convoi passe les portes de la ville. Tout l\'équipage est sauf — bravo !'
      : (why === 'storm' ? 'Le front de tempête a rattrapé le convoi.' : why === 'hull' ? 'Explosions, avalanches et pillards : le convoi n\'a pas tenu.' : 'La chaudière s\'est éteinte.')
        + (exp ? ` À ${fmtM(Math.max(0, (snap.gl || 0) - snap.d))} de Fort-Givre.` : '');
  return `<div class="panel card ${win ? 'win' : ''}" id="endPanel">
    <h1>${title}</h1><p>${sub}</p>
    <div class="big-num">${win ? fmtT(snap.t) : fmtM(snap.d)}</div>
    <p>${win ? `<b>${fmtM(snap.d)}</b>` : `<b>${fmtT(snap.t)}</b> de route`} · <b>${snap.ft}</b> caisse${snap.ft > 1 ? 's' : ''} brûlée${snap.ft > 1 ? 's' : ''} · ${snap.ns | 0} gare${(snap.ns | 0) > 1 ? 's' : ''} · ${esc(MODES[snap.mo]?.label || '')} <b>${esc(DIFFICULTY[snap.df]?.label || '')}</b></p>
    <p class="legs">${(snap.lg || ['plaine']).map((b) => `${BIOMES[b]?.icon || ''} ${esc(BIOMES[b]?.label || '')}`).join(' → ')}</p>
    ${ps.length ? `<table class="res"><thead><tr><th>#</th><th>CHAUFFEUR</th><th>BRÛLÉES</th><th>TROUVÉES</th><th>CHUTES</th><th>MORSURES</th></tr></thead><tbody>
      ${ps.map((p, k) => { const nm = names.get(p.id) || { n: '?', c: '#888' }; return `<tr><td>${k + 1}</td><td><i style="background:${esc(nm.c)}"></i>${ROLES[p.role]?.icon || ''} ${esc(nm.n)}</td><td>${p.fed}</td><td>${p.found}</td><td>${p.falls}</td><td>${p.bites}</td></tr>`; }).join('')}
    </tbody></table>` : ''}
    <div class="row end">
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
      ${canReplay ? '<button class="btn big yellow" id="btnAgain">Repartir</button>' : embedded ? '<span class="wait"><i></i>L\'hôte peut relancer un convoi…</span>' : ''}
    </div></div>`;
}

export const fmt = { fmtT, fmtM };
