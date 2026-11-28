// Écrans hors partie : menu, consigne, bilan, bilan de session, demande de confirmation.
import { startLevel } from '../engine/levels.js';
import { streak, dayKey } from '../engine/days.js';
import { store } from './store.js';
import { GLYPHS } from './glyphs.js';

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const dayStreak = () => streak(store.data.history.map((g) => g.day), dayKey(new Date()));
const plural = (n, one, many) => `${n} ${n > 1 ? many : one}`;
const DAY_LETTERS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];

// Niveau sur dix crans, dans la couleur de l'épreuve.
const pips = (lv) => `<span class="pips" role="img" aria-label="Niveau ${lv} sur 10">${Array.from({ length: 10 }, (_, i) => `<i${i < lv ? ' class="on"' : ''}></i>`).join('')}</span>`;

export function menuHtml(modes) {
  const today = dayKey(new Date()), hist = store.data.history;
  const played = new Set(hist.map((g) => g.day)), s = dayStreak();
  const week = Array.from({ length: 7 }, (_, k) => { const d = new Date(); d.setDate(d.getDate() - 6 + k); return d; });
  const doneToday = new Set(hist.filter((g) => g.session && g.day === today).map((g) => g.mode)).size;
  const status = doneToday >= modes.length ? '<span class="chip done">Faite aujourd\'hui</span>'
    : doneToday ? `<span class="chip">${doneToday} sur ${modes.length} aujourd'hui</span>` : '';
  const tile = (M) => `<button type="button" class="card tile" data-go="${M.id}" style="--m:${M.color}">${GLYPHS[M.id]}
      <span class="card-t">${M.title}</span><span class="card-d">${M.blurb}</span>
      <span class="tile-lv">${pips(store.data.levels[M.id])}<span>Niveau ${store.data.levels[M.id]}</span></span></button>`;
  return `<section class="menu">
    <header class="menu-head">
      <div><h1>Synapse</h1><p>Quatre épreuves de réflexes et de rythme, une difficulté qui suit le niveau.</p></div>
      <div class="week"><div class="week-days" role="img" aria-label="Jours joués cette semaine">${week.map((d) => {
        const k = dayKey(d);
        return `<i class="${played.has(k) ? 'on' : ''}${k === today ? ' today' : ''}">${DAY_LETTERS[d.getDay()]}</i>`;
      }).join('')}</div><b>${s ? `Série : ${plural(s, 'jour', 'jours')}` : 'Aucune série en cours'}</b></div>
    </header>
    <button type="button" class="card hero" data-go="session">
      <span class="hero-txt"><span class="card-t">Session du jour ${status}</span><span class="card-d">Les quatre épreuves enchaînées, 70 s chacune : 5 minutes en tout.</span></span>
      <span class="hero-modes">${modes.map((M) => `<span style="--m:${M.color}">${GLYPHS[M.id]}</span>`).join('')}</span>
      <span class="hero-go">Commencer</span>
    </button>
    <div class="tiles">${modes.map(tile).join('')}</div>
    <button type="button" class="card boardlink" data-go="board"><span class="card-t">Tableau de bord</span>
      <span class="card-d">${hist.length ? plural(hist.length, 'partie enregistrée', 'parties enregistrées') + ' · ' : ''}courbes, historique, export</span><span class="chev" aria-hidden="true">→</span></button>
  </section>`;
}

export function briefHtml(M, setup, { dur, session }) {
  const lv = startLevel(store.data.levels[M.id]);
  const actions = session
    ? '<div class="brief-go"><p class="brief-count" aria-live="polite">Départ dans 5</p><div class="row"><button type="button" class="primary" data-go="start">Commencer maintenant</button><button type="button" data-go="menu">Arrêter la session</button></div></div>'
    : '<div class="brief-go"><div class="row"><button type="button" class="primary" data-go="start">Commencer</button><button type="button" data-go="menu">Menu</button></div></div>';
  const steps = M.steps(setup).map(([ico, t, sub], i) => `<li><span class="st-ico">${ico}</span><span class="st-n">${i + 1}</span><b>${t}</b><span class="st-sub">${sub}</span></li>`).join('');
  return `<section class="brief" style="--m:${M.color}">
    <header class="brief-head">${GLYPHS[M.id]}<div>${session ? `<p class="kicker">Session du jour · épreuve ${session.i + 1} sur ${session.n}</p>` : '<p class="kicker">Comment jouer</p>'}<h2>${M.title}</h2></div>
      <div class="chips"><span class="chip">${dur} s</span><span class="chip">Départ : niveau ${lv}</span><span class="chip"><kbd>Échap</kbd> pause</span></div></header>
    <ol class="steps">${steps}</ol>
    <p class="brief-foot">Une erreur remet la série à zéro. La partie démarre un cran sous le niveau atteint, puis la difficulté s'ajuste toute seule.</p>
    ${actions}</section>`;
}

const stat = (k, v) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`;
// Meilleur score de l'épreuve, la partie qui vient d'être enregistrée exceptée.
function isRecord(r) {
  if (!r.trials || r.session || r.score <= 0) return false;
  const before = store.data.history.filter((g) => g.mode === r.mode).slice(0, -1);
  return before.length > 0 && r.score > Math.max(...before.map((g) => g.score));
}
const tipHtml = (text) => `<p class="tip"><strong>Astuce</strong><span>${esc(text)}</span></p>`;
const again = '<div class="row"><button type="button" class="primary" data-go="again">Rejouer</button><button type="button" data-go="menu">Menu</button></div>';

export function reportHtml(r) {
  return `<section class="report" style="--m:${r.color}">
    <header class="rep-head">${GLYPHS[r.mode]}<div><p class="kicker">Bilan</p><h2>${esc(r.title)}</h2></div>${isRecord(r) ? '<span class="chip rec">Record</span>' : ''}</header>
    <div class="rep-main"><p class="big">${r.score}<small>points</small></p>
      <div class="lvl"><span>Niveau ${r.lv0} → ${r.lv1}${r.lv1 > r.lv0 ? ' <b class="up">en hausse</b>' : ''}</span>${pips(r.lv1)}</div></div>
    <dl class="stats">${stat('Meilleure série', r.best)}${stat('Réussite', r.trials ? r.acc + ' %' : '—')}${r.lines.map(([k, v]) => stat(k, v)).join('')}</dl>
    ${tipHtml(r.tip)}
    ${r.trials ? '' : '<p class="note">Aucun essai joué : partie non enregistrée.</p>'}
    ${again}</section>`;
}

export function sessionHtml(results) {
  const played = results.filter((r) => r.trials);
  const trials = played.reduce((a, r) => a + r.trials, 0);
  const acc = trials ? Math.round(played.reduce((a, r) => a + r.acc * r.trials, 0) / trials) : null;
  const weakest = [...played].sort((a, b) => a.acc - b.acc)[0];
  const rows = results.map((r) => `<tr style="--m:${r.color}"><th scope="row"><i class="mdot"></i>${esc(r.title)}</th><td>${r.score}</td><td>${r.trials ? r.acc + ' %' : '—'}</td><td>${r.best}</td><td>${r.lv0} → ${r.lv1}</td><td>${r.lines.map(([k, v]) => `${esc(k)} : ${esc(v)}`).join('<br>')}</td></tr>`).join('');
  return `<section class="report wide">
    <header class="rep-head"><div><p class="kicker">Session du jour</p><h2>Bilan de la session</h2></div>${played.length === 4 ? '<span class="chip done">Session complète</span>' : ''}</header>
    <div class="rep-main"><p class="big">${results.reduce((a, r) => a + r.score, 0)}<small>points</small></p>
      <dl class="stats inline">${stat('Réussite', acc == null ? '—' : acc + ' %')}${stat('Meilleure série', Math.max(0, ...results.map((r) => r.best)))}${stat('Épreuves jouées', `${played.length} / 4`)}</dl></div>
    <table class="tbl"><thead><tr><th>Épreuve</th><th>Score</th><th>Réussite</th><th>Série</th><th>Niveau</th><th>Indicateurs</th></tr></thead><tbody>${rows || '<tr><td colspan="6">Aucune épreuve jouée.</td></tr>'}</tbody></table>
    ${tipHtml(weakest ? `${weakest.title} : ${weakest.tip}` : 'Jouer chaque épreuve jusqu\'au bout pour obtenir un bilan complet.')}
    ${again}</section>`;
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
