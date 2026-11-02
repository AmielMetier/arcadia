// Mollo ! — interface par-dessus la 3D : tableau des manches, étiquettes des joueurs, annonces, fil des chutes,
// rappel des commandes, joystick tactile ; et les écrans (accueil, pause, fin de partie) en HTML.
import { ST, FL } from '../engine/sim.js';
import { ARENAS } from '../engine/arena.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s) => document.querySelector(s);

export class HUD {
  constructor() {
    this.root = $('#hud'); this.score = $('#score'); this.round = $('#round'); this.labels = $('#labels');
    this.bannerEl = $('#banner'); this.feedEl = $('#feed'); this.promptEl = $('#prompt'); this.toastEl = $('#toast');
    this.gustEl = $('#gust'); this.stickEl = $('#stick');
    this.sig = ''; this.tags = new Map(); this.bannerT = 0; this.toastT = 0;
  }
  show(on) { this.root.hidden = !on; }
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
    const sig = v.players.map((p) => `${p.id}:${p.pts}:${p.st}:${p.name}`).join('|') + '/' + v.go;
    if (sig !== this.sig) {
      this.sig = sig;
      const lead = Math.max(0, ...v.players.map((p) => p.pts));
      this.score.innerHTML = v.players.map((p) => {
        const out = p.st === ST.OUT;
        const dots = Array.from({ length: v.go }, (_, i) => `<i class="${i < p.pts ? 'on' : ''}"></i>`).join('');
        return `<div class="chip ${out ? 'out' : ''} ${p.me ? 'me' : ''}" style="--c:${esc(p.color)}"><b>${p.pts === lead && lead > 0 ? '👑 ' : ''}${esc(p.name)}</b><span class="dots">${dots}</span>${out ? '<em>💨</em>' : p.st === ST.KO ? '<em>💫</em>' : ''}</div>`;
      }).join('');
    }
    const standing = v.players.filter((p) => p.st !== ST.OUT).length;
    this.round.innerHTML = v.rd ? `<b>Manche ${v.rd}</b><span>${esc(ARENAS[v.ar]?.name || '')}</span>${v.ph === 'play' ? `<span class="n">${standing} encore là</span>` : ''}` : '';
    if (v.gu) { this.gustEl.hidden = false; this.gustEl.textContent = 'Ça souffle !'; this.gustEl.className = 'gust warn'; } else this.gustEl.hidden = true;
    const seen = new Set();
    for (const p of v.players) {
      if (!p.pos || p.pos[7] < -6) continue;
      seen.add(p.id);
      let t = this.tags.get(p.id);
      if (!t) { t = document.createElement('div'); t.className = 'tag'; this.labels.appendChild(t); this.tags.set(p.id, t); }
      const s = toScreen(p.pos[6], p.pos[7] + 0.68, p.pos[8]);
      const html = `${p.me ? '▼ ' : ''}${esc(p.name)}`;
      if (t._h !== html) { t.innerHTML = html; t._h = html; }
      t.style.setProperty('--c', p.color);
      t.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
      t.classList.toggle('me', !!p.me);
    }
    for (const [id, t] of this.tags) if (!seen.has(id)) { t.remove(); this.tags.delete(id); }
    const me = v.players.find((p) => p.id === myId);
    this.promptEl.innerHTML = promptFor(v, me, input.mode, tips);
    this.promptEl.hidden = !this.promptEl.innerHTML;
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
  if (!me || v.ph === 'over' || v.ph === 'round') return '';
  const pu = K(mode, 'F', 'X', '👊'), gr = K(mode, 'E', 'B', '✋'), ju = K(mode, 'Espace', 'A', '⬆️');
  const all = `${pu} <b>frappe</b> (maintiens : gros coup) · ${gr} <b>saisis</b> (maintiens pour tenir) · ${ju} <b>saute</b>`;
  if (v.ph === 'count') return tips ? all : '';
  if (me.st === ST.OUT) return v.ph === 'play' ? '💨 Tu es tombé… regarde les autres se débrouiller' : '';
  if (me.st === ST.KO) return `💫 Assommé ! Martèle ${pu} ou ${ju} pour revenir à toi`;
  const f = me.fl;
  if (f & FL.LIFTED) return `😱 On te porte ! Martèle ${pu} pour lui faire lâcher prise`;
  if (f & FL.LIFTING) return `💪 Va au bord et lâche ${gr} : tu le jettes`;
  if (f & FL.HANG) return `🫳 Garde ${gr} et maintiens ${ju} pour te hisser`;
  if (f & FL.GRIP) return `✊ Tu le tiens : traîne-le au bord, ou ${ju} pour le soulever s'il est sonné`;
  if (f & FL.HELD) return `😬 On te tient ! Martèle ${pu} pour te dégager`;
  if (!(f & FL.GROUND)) return `✋ Maintiens ${gr} pour attraper un rebord`;
  if (f & FL.CHARGE) return '💥 Lâche pour frapper fort';
  if (me.dz > 0.65) return '😵 Encore un coup et tu t\'endors : éloigne-toi !';
  return tips ? all : '';
}

// ------------------------------------------------------------------ écrans
const SEGS = [
  ['goal', 'Manches à gagner', [[2, '2'], [3, '3'], [5, '5']]],
  ['bots', 'Bots', [[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5'], [6, '6'], [7, '7']]],
  ['level', 'Niveau des bots', [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']]],
  ['hazards', 'Pièges du décor', [[1, 'Oui'], [0, 'Non']]],
];
const LEVEL = { facile: 'Facile', normal: 'Moyen', expert: 'Difficile' };

export function briefingHtml({ role, squad, cfg, embedded, bots }) {
  const host = role !== 'guest';
  const list = squad.map((p) => `<li style="--c:${esc(p.color)}"><i></i>${esc(p.name)}${p.me ? ' <small>(toi)</small>' : ''}${p.ready ? '' : ' <small>arrive…</small>'}</li>`).join('')
    + (bots > 0 ? `<li class="bot"><i></i>${bots} bot${bots > 1 ? 's' : ''} <small>(${LEVEL[cfg.level] || 'Moyen'})</small></li>` : '');
  const segs = !embedded && host ? `<div class="segs">${SEGS.map(([k, label, opts]) => `<div class="seg"><span>${label}</span><div>${opts.map(([v, t]) =>
    `<button data-k="${k}" data-v="${v}" class="${String(cfg[k]) === String(v) ? 'sel' : ''}">${t}</button>`).join('')}</div></div>`).join('')}</div>`
    : `<p class="rules">Premier à <b>${cfg.goal}</b> manche${cfg.goal > 1 ? 's' : ''} · ${cfg.hazards ? 'avec les pièges du décor' : 'sans pièges'}</p>`;
  return `<div class="brief">
    <h1 class="logo">MOLLO<span>!</span></h1>
    <p class="sub">Des pantins tout mous, du vide tout autour. Cogne, attrape, porte, jette : le dernier debout gagne la manche.</p>
    <div class="cols">
      <div><h3>Sur le toit</h3><ul class="squad">${list}</ul>${segs}</div>
      <div class="ctrl"><h3>Commandes</h3>
        <p><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> marcher · <kbd>Espace</kbd> <b>sauter</b></p>
        <p><kbd>F</kbd> ou clic gauche <b>frapper</b> · maintiens, lâche : <b>gros coup</b> · en pleine course et en l'air : <b>coup de pied sauté</b></p>
        <p><kbd>E</kbd> ou clic droit, <b>maintenu</b> : tes mains s'accrochent à ce qu'elles touchent, un rebord ou un adversaire</p>
        <p>💫 Trop de coups, surtout à la tête : assommé. Tiens-le, <kbd>Espace</kbd> pour le soulever, lâche <kbd>E</kbd> pour le jeter</p>
        <p>🫳 Accroché à un rebord, garde <kbd>E</kbd> et maintiens <kbd>Espace</kbd> pour te hisser. Tes bras fatiguent vite !</p>
        <p class="alt">Manette : stick, Ⓐ sauter, Ⓧ frapper, Ⓑ saisir · Au doigt : joystick à gauche, boutons à droite</p>
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
    <table class="stats"><thead><tr><th></th><th>Joueur</th><th>Manches</th><th>Jetés dans le vide</th><th>Tenu debout</th></tr></thead><tbody>
      ${ranking.map((p, k) => `<tr class="${p.me ? 'me' : ''}"><td>${k + 1}</td><td><i style="--c:${esc(p.color)}"></i>${esc(p.name)}${p.bot ? ' <small>bot</small>' : ''}</td><td>${p.pts}</td><td>${p.kos}</td><td>${Math.round(p.surv)} s</td></tr>`).join('')}
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
