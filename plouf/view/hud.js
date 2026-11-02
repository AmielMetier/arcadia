// Plouf ! — interface par-dessus la 3D : tableau des manches, étiquettes des joueurs, annonces, fil des chutes,
// rappel des commandes, joystick tactile ; et les écrans (accueil, pause, fin de partie) en HTML.
import { ST } from '../engine/sim.js';
import { SHAPES } from '../engine/arena.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s) => document.querySelector(s);
const ARROWS = ['⬇️', '↘️', '➡️', '↗️', '⬆️', '↖️', '⬅️', '↙️']; // sens du vent : angle (0 = vers le bas de l'écran, +z)

export class HUD {
  constructor() {
    this.root = $('#hud'); this.score = $('#score'); this.round = $('#round'); this.labels = $('#labels');
    this.bannerEl = $('#banner'); this.feedEl = $('#feed'); this.promptEl = $('#prompt'); this.toastEl = $('#toast');
    this.windEl = $('#wind'); this.stickEl = $('#stick');
    this.sig = ''; this.tags = new Map(); this.bannerT = 0; this.toastT = 0;
  }
  show(on) { this.root.hidden = !on; }

  // annonce au centre de l'écran (cls : big, win, warn)
  banner(html, dur = 1.6, cls = '') {
    const b = this.bannerEl;
    b.innerHTML = html; b.className = 'banner ' + cls; b.hidden = false;
    void b.offsetWidth; b.classList.add('in');
    this.bannerT = dur;
  }
  toast(msg, dur = 2.5) { this.toastEl.textContent = msg; this.toastEl.hidden = false; this.toastT = dur; }
  feed(html) {
    const d = document.createElement('div'); d.className = 'fi'; d.innerHTML = html;
    this.feedEl.prepend(d);
    while (this.feedEl.children.length > 5) this.feedEl.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 5000);
  }

  update(v, dt, { toScreen, input, myId, tips }) {
    if ((this.bannerT -= dt) <= 0 && !this.bannerEl.hidden) { this.bannerEl.classList.remove('in'); if (this.bannerT < -0.4) this.bannerEl.hidden = true; }
    if ((this.toastT -= dt) <= 0) this.toastEl.hidden = true;
    // tableau des manches : une pastille par manche gagnée
    const sig = v.players.map((p) => `${p.id}:${p.pts}:${p.st === ST.GULL || p.order ? 1 : 0}:${p.name}`).join('|') + '/' + v.go;
    if (sig !== this.sig) {
      this.sig = sig;
      const lead = Math.max(0, ...v.players.map((p) => p.pts));
      this.score.innerHTML = v.players.map((p) => {
        const out = v.ph !== 'count' && (p.st === ST.GULL || p.order > 0);
        const dots = Array.from({ length: v.go }, (_, i) => `<i class="${i < p.pts ? 'on' : ''}"></i>`).join('');
        return `<div class="chip ${out ? 'out' : ''} ${p.me ? 'me' : ''}" style="--c:${esc(p.color)}"><b>${p.pts === lead && lead > 0 ? '👑 ' : ''}${esc(p.name)}</b><span class="dots">${dots}</span>${out ? '<em>🐦</em>' : ''}</div>`;
      }).join('');
    }
    const standing = v.players.filter((p) => p.st !== ST.GULL && !(p.st === ST.FALL && !p.buoy)).length;
    this.round.innerHTML = v.rd ? `<b>Manche ${v.rd}</b><span>${esc(SHAPES[v.sh]?.name || '')}</span>${v.ph === 'play' ? `<span class="n">${standing} au sec</span>` : ''}` : '';
    // vent : flèche qui reste affichée pendant le coup de mistral
    if (v.wind || v.windWarn) {
      this.windEl.hidden = false;
      this.windEl.innerHTML = `${ARROWS[Math.round(((v.windA % (Math.PI * 2)) + Math.PI * 2) / (Math.PI / 4)) % 8]} ${v.windWarn ? 'Mistral !' : 'Ça souffle !'}`;
      this.windEl.className = 'wind' + (v.windWarn ? ' warn' : '');
    } else this.windEl.hidden = true;
    // étiquettes au-dessus des têtes
    const seen = new Set();
    for (const p of v.players) {
      if (p.st === ST.FALL && p.y < -0.6) continue;
      seen.add(p.id);
      let t = this.tags.get(p.id);
      if (!t) { t = document.createElement('div'); t.className = 'tag'; this.labels.appendChild(t); this.tags.set(p.id, t); }
      const gull = p.st === ST.GULL, y = gull ? p.y + 0.8 : p.st === ST.HELD ? p.y + 1 : Math.max(p.y, -0.4) + 2;
      const s = toScreen(p.x, y, p.z);
      const html = `${p.me ? '▼ ' : ''}${esc(p.name)}${p.buoy ? ' 🛟' : ''}`;
      if (t._h !== html) { t.innerHTML = html; t._h = html; }
      t.style.setProperty('--c', p.color);
      t.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      t.classList.toggle('me', !!p.me); t.classList.toggle('gull', gull);
    }
    for (const [id, t] of this.tags) if (!seen.has(id)) { t.remove(); this.tags.delete(id); }
    // rappel de ce qu'on peut faire, selon ce qui nous arrive
    const me = v.players.find((p) => p.id === myId);
    this.promptEl.innerHTML = promptFor(v, me, input.mode, tips);
    this.promptEl.hidden = !this.promptEl.innerHTML;
    // joystick tactile
    const st = input.stick();
    if (st) {
      this.stickEl.hidden = false;
      const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy), k = d > 55 ? 55 / d : 1;
      this.stickEl.style.left = st.ox + 'px'; this.stickEl.style.top = st.oy + 'px';
      this.stickEl.firstElementChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
    } else this.stickEl.hidden = true;
  }

  clearTags() { for (const t of this.tags.values()) t.remove(); this.tags.clear(); this.sig = ''; }
}

const K = (mode, k, pad, touch) => (mode === 'touch' ? `<kbd class="t">${touch}</kbd>` : mode === 'pad' ? `<kbd class="p">${pad}</kbd>` : `<kbd>${k}</kbd>`);
function promptFor(v, me, mode, tips) {
  if (!me || v.ph === 'over') return '';
  const push = K(mode, 'Espace', 'A', '👊'), grab = K(mode, 'E', 'X', '✋');
  if (v.ph === 'count') return tips ? `Maintiens ${push} pour armer, lâche pour <b>pousser</b> · ${grab} pour <b>attraper</b> et lancer` : '';
  switch (me.st) {
    case ST.GULL:
      if (v.ph !== 'play') return '';
      return me.cd > 0 ? '🐦 Tu es une mouette… la prochaine sardine arrive' : `🐦 Tu es une mouette : ${push} lâche une sardine sur ceux qui restent`;
    case ST.HELD: return `😱 On te soulève ! Martèle ${push} pour te dégager`;
    case ST.BOB: return '🛟 La bouée te sauve : retour sur le radeau !';
    case ST.FALL: return '';
    case ST.AIR: return '';
  }
  if (me.ck === 2) return `💪 ${grab} : jette-le… vers l'eau, de préférence !`;
  if (me.ck === 1) return `🍉 ${grab} : lance la pastèque droit devant`;
  if (me.tee) return '😬 Tu vacilles au bord !';
  if (me.chg > 0) return me.chgK >= 1 ? '💥 Chargé à bloc : lâche !' : 'Ça charge… lâche pour foncer';
  if (tips) return `Maintiens ${push} pour armer, lâche pour <b>pousser</b> · ${grab} <b>attraper</b> / lancer`;
  return '';
}

// ------------------------------------------------------------------ écrans
const SEGS = [
  ['goal', 'Manches à gagner', [[2, '2'], [3, '3'], [5, '5']]],
  ['bots', 'Bots', [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']]],
  ['level', 'Niveau des bots', [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']]],
  ['items', 'Pastèques et bouées', [[1, 'Oui'], [0, 'Non']]],
  ['wind', 'Coups de mistral', [[1, 'Oui'], [0, 'Non']]],
];
const LEVEL = { facile: 'Facile', normal: 'Moyen', expert: 'Difficile' };

export function briefingHtml({ role, squad, cfg, embedded, bots }) {
  const host = role !== 'guest';
  const list = squad.map((p) => `<li style="--c:${esc(p.color)}"><i></i>${esc(p.name)}${p.me ? ' <small>(toi)</small>' : ''}${p.ready ? '' : ' <small>arrive…</small>'}</li>`).join('')
    + (bots > 0 ? `<li class="bot"><i></i>${bots} bot${bots > 1 ? 's' : ''} <small>(${LEVEL[cfg.level] || 'Moyen'})</small></li>` : '');
  const segs = !embedded && host ? `<div class="segs">${SEGS.map(([k, label, opts]) => `<div class="seg"><span>${label}</span><div>${opts.map(([v, t]) =>
    `<button data-k="${k}" data-v="${v}" class="${String(cfg[k]) === String(v) ? 'sel' : ''}">${t}</button>`).join('')}</div></div>`).join('')}</div>`
    : `<p class="rules">Premier à <b>${cfg.goal}</b> manche${cfg.goal > 1 ? 's' : ''} · ${cfg.items ? 'pastèques et bouées' : 'sans objets'} · ${cfg.wind ? 'mistral' : 'sans vent'}</p>`;
  return `<div class="brief">
    <h1 class="logo">PLOUF<span>!</span></h1>
    <p class="sub">Le dernier au sec gagne la manche. Pousse, attrape, jette… et méfie-toi des planches qui coulent.</p>
    <div class="cols">
      <div><h3>Sur le radeau</h3><ul class="squad">${list}</ul>${segs}</div>
      <div class="ctrl"><h3>Commandes</h3>
        <p><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> se déplacer</p>
        <p><kbd>Espace</kbd> maintenir pour armer, lâcher pour <b>pousser</b></p>
        <p><kbd>E</kbd> <b>attraper</b> un joueur ou une pastèque, puis <b>lancer</b></p>
        <p>🛟 la bouée te repêche une fois · 🐦 tombé, tu deviens mouette et tu bombardes de sardines</p>
        <p class="alt">Manette : stick, Ⓐ pousser, Ⓧ attraper · Au doigt : joystick à gauche, boutons à droite</p>
      </div>
    </div>
    <div class="btns">${host ? '<button class="btn go" id="btnGo">C\'est parti !</button>' : '<p class="wait">L\'hôte va lancer la partie…</p>'}${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}</div>
  </div>`;
}

export function endHtml({ ranking, canReplay, embedded, reason }) {
  const pod = ranking.slice(0, 3);
  const order = [1, 0, 2].filter((i) => pod[i]);
  return `<div class="end">
    <h1 class="logo small">${reason === 'host' ? 'Partie interrompue' : `${esc(ranking[0]?.name || '')} gagne !`}</h1>
    ${reason === 'host' ? '<p class="sub">La liaison avec l\'hôte a été perdue.</p>' : ''}
    <div class="podium">${order.map((i) => { const p = pod[i]; return `<div class="pl p${i + 1}" style="--c:${esc(p.color)}"><b>${esc(p.name)}</b><span>${p.pts} manche${p.pts > 1 ? 's' : ''}</span><div class="step">${i + 1}</div></div>`; }).join('')}</div>
    <table class="stats"><thead><tr><th></th><th>Joueur</th><th>Manches</th><th>Envoyés à l'eau</th><th>Au sec</th></tr></thead><tbody>
      ${ranking.map((p, k) => `<tr class="${p.me ? 'me' : ''}"><td>${k + 1}</td><td><i style="--c:${esc(p.color)}"></i>${esc(p.name)}${p.bot ? ' <small>bot</small>' : ''}</td><td>${p.pts}</td><td>${p.ko}</td><td>${Math.round(p.surv)} s</td></tr>`).join('')}
    </tbody></table>
    <div class="btns">${canReplay ? '<button class="btn go" id="btnAgain">Rejouer</button>' : '<p class="wait">L\'hôte peut relancer une partie.</p>'}${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}</div>
  </div>`;
}

export function menuHtml({ solo, embedded }) {
  return `<div class="menu"><h2>${solo ? 'Pause' : 'Menu'}</h2>
    <button class="btn go" id="btnResume">Reprendre</button>
    <button class="btn" id="btnSettings">⚙️ Réglages</button>
    <button class="btn ghost" id="btnQuit">${embedded ? 'Retour au salon' : 'Quitter la partie'}</button></div>`;
}
