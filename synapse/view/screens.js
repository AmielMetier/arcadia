// Écrans hors partie : menu, consigne, bilan, bilan de session, demande de confirmation.
import { startLevel } from '../engine/levels.js';
import { streak, dayKey } from '../engine/days.js';
import { store } from './store.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const dayStreak = () => streak(store.data.history.map((g) => g.day), dayKey(new Date()));
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;

export function menuHtml(modes) {
  const s = dayStreak();
  const card = (M) => `<button type="button" class="card" data-go="${M.id}"><span class="card-t">${M.title}</span><span class="card-d">${M.blurb}</span><span class="card-l">Niveau ${store.data.levels[M.id]}</span></button>`;
  return `<section class="menu">
    <div class="menu-head"><h1>Synapse</h1><p>Réflexes et rythme : quatre épreuves, une difficulté qui s'adapte à chaque partie.</p>
      <p class="streak">${s ? `Série en cours : ${plural(s, 'jour', 'jours')}` : 'Aucune série en cours'}</p></div>
    <div class="menu-grid">
      ${modes.map(card).join('')}
      <button type="button" class="card session" data-go="session"><span class="card-t">Session du jour</span><span class="card-d">Les quatre épreuves enchaînées, 70 s chacune : 5 minutes en tout.</span></button>
      <button type="button" class="card board" data-go="board"><span class="card-t">Tableau de bord</span><span class="card-d">Série de jours, courbes, historique, export.</span></button>
    </div></section>`;
}

export function briefHtml(M, setup, { dur, session }) {
  const lv = startLevel(store.data.levels[M.id]);
  const head = session ? `<p class="brief-kicker">Session du jour · épreuve ${session.i + 1} sur ${session.n}</p>` : '';
  const actions = session
    ? '<p class="brief-count" aria-live="polite">Départ dans 5</p><div class="row"><button type="button" class="primary" data-go="start">Commencer maintenant</button><button type="button" data-go="menu">Arrêter la session</button></div>'
    : '<div class="row"><button type="button" class="primary" data-go="start">Commencer</button><button type="button" data-go="menu">Menu</button></div>';
  return `<section class="brief">${head}<h2>${M.title}</h2><div class="brief-rules">${M.rules(setup)}</div>
    <p class="brief-meta">${dur} s · niveau de départ ${lv} · <kbd>Échap</kbd> : pause</p>${actions}</section>`;
}

const stat = (k, v) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
export function reportHtml(r) {
  return `<section class="report"><h2>Bilan · ${esc(r.title)}</h2>
    <dl class="stats">${stat('Score', r.score)}${stat('Meilleure série', r.best)}${stat('Réussite', r.trials ? r.acc + ' %' : '—')}${stat('Niveau', `${r.lv0} → ${r.lv1}`)}${r.lines.map(([k, v]) => stat(k, v)).join('')}</dl>
    <p class="tip"><strong>Astuce</strong> ${esc(r.tip)}</p>
    ${r.trials ? '' : '<p class="note">Aucun essai joué : partie non enregistrée.</p>'}
    <div class="row"><button type="button" class="primary" data-go="again">Rejouer</button><button type="button" data-go="menu">Menu</button></div></section>`;
}

export function sessionHtml(results) {
  const played = results.filter((r) => r.trials);
  const trials = played.reduce((a, r) => a + r.trials, 0);
  const acc = trials ? Math.round(played.reduce((a, r) => a + r.acc * r.trials, 0) / trials) : null;
  const weakest = [...played].sort((a, b) => a.acc - b.acc)[0];
  const rows = results.map((r) => `<tr><th scope="row">${esc(r.title)}</th><td>${r.score}</td><td>${r.trials ? r.acc + ' %' : '—'}</td><td>${r.best}</td><td>${r.lv0} → ${r.lv1}</td><td>${r.lines.map(([k, v]) => `${esc(k)} : ${esc(v)}`).join('<br>')}</td></tr>`).join('');
  return `<section class="report wide"><h2>Bilan de la session</h2>
    <dl class="stats">${stat('Score total', results.reduce((a, r) => a + r.score, 0))}${stat('Réussite', acc == null ? '—' : acc + ' %')}${stat('Meilleure série', Math.max(0, ...results.map((r) => r.best)))}${stat('Épreuves jouées', `${played.length} / 4`)}</dl>
    <table class="tbl"><thead><tr><th>Épreuve</th><th>Score</th><th>Réussite</th><th>Série</th><th>Niveau</th><th>Indicateurs</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Aucune épreuve jouée.</td></tr>'}</tbody></table>
    <p class="tip"><strong>Astuce</strong> ${esc(weakest ? `${weakest.title} : ${weakest.tip}` : 'Jouer chaque épreuve jusqu\'au bout pour obtenir un bilan complet.')}</p>
    <div class="row"><button type="button" class="primary" data-go="again">Rejouer</button><button type="button" data-go="menu">Menu</button></div></section>`;
}

// Demande de confirmation dans la page ; renvoie une promesse de vrai / faux.
export function ask(text, yes) {
  return new Promise((done) => {
    const box = document.createElement('div');
    box.className = 'modal';
    box.innerHTML = `<div class="modal-card" role="alertdialog" aria-modal="true" aria-labelledby="askT"><p id="askT">${esc(text)}</p>
      <div class="row"><button type="button" class="danger" data-v="1">${esc(yes)}</button><button type="button" data-v="0">Annuler</button></div></div>`;
    const back = document.activeElement;
    const close = (v) => { box.remove(); if (back && back.focus) back.focus(); done(v); };
    box.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) close(b.dataset.v === '1'); });
    box.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
      if (e.key === 'Tab') { const bs = [...box.querySelectorAll('button')]; const i = bs.indexOf(document.activeElement); e.preventDefault(); bs[(i + (e.shiftKey ? bs.length - 1 : 1)) % bs.length].focus(); }
    });
    document.body.appendChild(box);
    box.querySelector('[data-v="0"]').focus();
  });
}
