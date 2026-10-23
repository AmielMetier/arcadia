// Convoy Storm — HUD (DOM) et écrans : briefing, menu, fin de partie, connexion perdue.
// Les écrans sont reconstruits par innerHTML : leurs boutons disparaissent avec eux, aucun écouteur ne traîne.
import { REAR, DECK_Y, LOST_DIST, DIFFICULTY, personalScore } from '../engine/sim.js';

const $ = (s) => document.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtT = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const fmtM = (m) => (m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m');

export class HUD {
  constructor() {
    this.root = $('#hud'); this.el = {};
    for (const id of ['fuelBox', 'fuelBar', 'fuelTxt', 'burnTxt', 'speedTxt', 'distTxt', 'clockTxt', 'crateTxt', 'team', 'prompt', 'tracker', 'pops', 'toast'])
      this.el[id] = document.getElementById(id);
    this.teamKey = ''; this.toastT = 0; this.last = {};
  }
  show(on) { this.root.hidden = !on; }

  update(v, scene, dt) {
    const E = this.el;
    const fu = Math.max(0, v.fuel);
    E.fuelBar.style.width = fu.toFixed(1) + '%';
    set(E.fuelTxt, Math.ceil(fu) + ' %');
    set(E.burnTxt, fu > 0 ? `−${v.burn.toFixed(2).replace('.', ',')} %/s` : 'PANNE SÈCHE');
    set(E.speedTxt, Math.round(v.speed * 3.6) + ' km/h');
    E.fuelBox.classList.toggle('low', fu > 0 && fu < 25);
    E.fuelBox.classList.toggle('out', fu <= 0);
    set(E.distTxt, fmtM(v.dist)); set(E.clockTxt, fmtT(v.t)); set(E.crateTxt, String(v.fedTotal));

    // équipe
    const rows = v.players.map((p) => {
      const tag = p.st === 3 ? ['lost', 'perdu…'] : p.st === 2 ? ['', 'remonte'] : !p.on ? ['off', p.z > REAR ? `${Math.round(p.z - REAR)} m derrière` : 'dans la neige'] : ['', p.carry ? '📦 à bord' : 'à bord'];
      return `<div class="mate ${tag[0]}" style="--c:${esc(p.color)}"><span class="nm">${esc(p.name)}${p.me ? ' (toi)' : ''}</span><em>${p.carry && tag[1] !== '📦 à bord' ? '📦 ' : ''}${tag[1]}</em></div>`;
    }).join('');
    if (rows !== this.teamKey) { this.teamKey = rows; E.team.innerHTML = rows; }

    // consigne contextuelle
    const pr = v.prompt;
    if (pr !== this.last.prompt) { this.last.prompt = pr; E.prompt.hidden = !pr; if (pr) E.prompt.innerHTML = pr; }

    // flèche vers l'échelle quand on est descendu (ou derrière la caméra)
    const me = v.me;
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
export function briefingHtml({ role, squad, cfg, embedded }) {
  const host = role !== 'guest';
  const diffSeg = host && !embedded
    ? `<div class="seg">${Object.entries(DIFFICULTY).map(([k, d]) => `<button data-k="difficulty" data-v="${k}" class="${cfg.difficulty === k ? 'sel' : ''}">${d.label}</button>`).join('')}</div>`
    : `<b>${esc(DIFFICULTY[cfg.difficulty].label)}</b>`;
  return `<div class="panel card" id="briefPanel">
    <h1>CONVOY <span>STORM</span></h1>
    <p class="lead">Le blizzard ne s'arrête jamais. Le convoi non plus — tant que la chaudière a du fioul.</p>
    <div class="rules">
      <div><b>🔥 La chaudière</b>Elle brûle sans arrêt. Une caisse de fioul = +25 %. À 0 %, le convoi s'arrête : fin de la partie.</div>
      <div><b>🏚️ Les ruines</b>Saute du train, cours jusqu'aux lanternes et maintiens <b>E</b> pour fouiller.</div>
      <div><b>📦 Les caisses</b><b>E</b> pour les prendre, <b>F</b> pour les lancer : sur le wagon, à un équipier, ou en plein dans le foyer.</div>
      <div><b>❄️ La neige</b>On y avance moins vite et le convoi s'éloigne. Remonte par l'échelle de queue avant de te perdre.</div>
    </div>
    <h2>Équipage</h2>
    <div class="squad">${squad.map((p) => `<span class="${p.ready ? '' : 'wait'}" style="--c:${esc(p.color)}"><i></i>${esc(p.name)}${p.me ? ' (toi)' : ''}</span>`).join('')}</div>
    <h2>Difficulté</h2>${diffSeg}
    <div class="row end">
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
  const ps = snap.P.map((a) => ({ id: a[0], fed: a[17], found: a[18], falls: a[19] }));
  const names = new Map(snap.N.map(([id, n, c]) => [id, { n, c }]));
  ps.sort((a, b) => personalScore(b) - personalScore(a));
  const title = reason === 'host' ? 'LIAISON PERDUE' : 'PANNE SÈCHE';
  const sub = reason === 'host' ? 'L\'hôte a quitté la partie et personne n\'a pu reprendre le convoi.' : 'La chaudière s\'est éteinte. Le convoi s\'immobilise dans la tempête.';
  return `<div class="panel card" id="endPanel">
    <h1>${title}</h1><p>${sub}</p>
    <div class="big-num">${fmtM(snap.d)}</div>
    <p><b>${fmtT(snap.t)}</b> de route · <b>${snap.ft}</b> caisse${snap.ft > 1 ? 's' : ''} brûlée${snap.ft > 1 ? 's' : ''} · difficulté <b>${esc(DIFFICULTY[snap.df]?.label || '')}</b></p>
    ${ps.length ? `<table class="res"><thead><tr><th>#</th><th>CHAUFFEUR</th><th>CAISSES BRÛLÉES</th><th>TROUVÉES</th><th>CHUTES</th></tr></thead><tbody>
      ${ps.map((p, k) => { const nm = names.get(p.id) || { n: '?', c: '#888' }; return `<tr><td>${k + 1}</td><td><i style="background:${esc(nm.c)}"></i>${esc(nm.n)}</td><td>${p.fed}</td><td>${p.found}</td><td>${p.falls}</td></tr>`; }).join('')}
    </tbody></table>` : ''}
    <div class="row end">
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
      ${canReplay ? '<button class="btn big yellow" id="btnAgain">Repartir</button>' : embedded ? '<span class="wait"><i></i>L\'hôte peut relancer un convoi…</span>' : ''}
    </div></div>`;
}

export const fmt = { fmtT, fmtM };
