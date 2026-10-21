// Vue de Tête de Calcul : salle d'avant-partie, pupitre de question, révélation et podium final.
// La vue n'invente rien : elle affiche l'état reçu de l'hôte et envoie la saisie du joueur.
import { CATS, fmt } from '../engine/questions.js';
import { MODES } from '../engine/rules.js';
import { EMOTES, PHRASES, emoteOf } from './emotes.js';
import { sfx } from './sfx.js';
import { esc, el, prefersReducedMotion } from './util.js';

const DIFF_LABEL = { facile: 'Facile', normal: 'Normal', expert: 'Expert' };
const THEME_LABEL = { mix: 'Tout mélangé', base: 'Les 4 opérations', malin: 'Astuces & nombres', vite: 'Vitesse & estimations', compte: 'Compte est bon' };
const LEVEL_WORDS = { facile: ['facile', 'faciles'], normal: ['normal', 'normaux'], expert: ['expert', 'experts'] };
const qText = (t) => esc(t).replace(/\^(\d+)/g, '<sup>$1</sup>');
const secs = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const TAGS = { eclair: '⚡ Le plus rapide', serie: '🔥 Série', peril: '💀 Pénalité' };

export function mountGame(root, { me, answer, emote, start, exit }) {
  root.className = 'game';
  root.innerHTML = `
    <div class="deco" aria-hidden="true"><span>+</span><span>÷</span><span>×</span><span>−</span><span>√</span><span>%</span><span>π</span><span>=</span></div>
    <header class="topbar">
      <div class="info"><b>Tête de Calcul</b><span id="round"></span></div>
      <div class="tools">
        <button class="tool" id="tsnd" title="Bruitages">🔊</button>
        <button class="tool quit" id="tquit">Quitter</button>
      </div>
    </header>
    <aside class="roster" id="roster" aria-label="Joueurs"></aside>
    <main class="stage" id="stage"></main>
    <div class="dock">
      <button class="btn ghost emobtn" id="bEmote" title="Réagir" aria-expanded="false">😀</button>
      <div class="emopanel" id="emopanel" hidden>
        <div class="emogrid">${EMOTES.map((e) => `<button data-emo="${e.id}" aria-label="${e.id}">${e.glyph}</button>`).join('')}</div>
        <div class="phrases">${PHRASES.map((p) => `<button data-emo="${p.id}">${esc(p.text)}</button>`).join('')}</div>
      </div>
    </div>
    <div class="overlay" id="overlay" hidden></div>
    <div class="toast" id="toast" hidden role="status"></div>`;
  const $ = (s) => root.querySelector(s);
  const stage = $('#stage');

  let S = null, offset = 0, key = '', myAns = null, shown = {}, lastTick = -1, setupS = null;
  const name = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.name : '?'; };
  const now = () => Date.now() + offset;

  /* ---------------------------------------------------------- outils */
  const syncTools = () => { $('#tsnd').textContent = sfx.on ? '🔊' : '🔇'; $('#tsnd').classList.toggle('off', !sfx.on); };
  syncTools();
  $('#tsnd').onclick = () => { sfx.toggle(); syncTools(); };
  $('#tquit').onclick = () => exit();
  let toastT = 0;
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }

  /* ---------------------------------------------------------- réactions */
  const toggleEmo = (v) => { const p = $('#emopanel'); p.hidden = v == null ? !p.hidden : !v; $('#bEmote').setAttribute('aria-expanded', String(!p.hidden)); };
  $('#bEmote').onclick = () => toggleEmo();
  for (const b of root.querySelectorAll('[data-emo]')) b.onclick = () => { emote(b.dataset.emo); toggleEmo(false); };
  function showEmote(from, id) {
    const em = emoteOf(id); if (!em) return;
    const card = root.querySelector(`.pcard[data-id="${from}"]`);
    const b = el('div', 'bubble' + (em.glyph ? ' big' : ''), esc(em.glyph || em.text));
    if (card) { card.appendChild(b); } else { b.classList.add('free'); b.textContent = `${name(from)} : ${em.glyph || em.text}`; root.appendChild(b); }
    sfx.play('pop');
    setTimeout(() => b.remove(), 2600);
  }

  /* ---------------------------------------------------------- joueurs */
  function renderRoster() {
    if (!S) { $('#roster').innerHTML = ''; return; }
    const order = [...S.players].sort((a, b) => b.score - a.score);
    const box = $('#roster');
    // les cartes sont gardées d'un rendu à l'autre (bulles, animation des scores)
    for (const c of [...box.children]) if (!S.players.some((p) => String(p.id) === c.dataset.id)) c.remove();
    order.forEach((p, k) => {
      let c = box.querySelector(`.pcard[data-id="${p.id}"]`);
      if (!c) { c = el('div', 'pcard'); c.dataset.id = p.id; c.innerHTML = '<i class="band"></i><span class="rank"></span><span class="nm"></span><b class="sc"></b><span class="st"></span>'; box.appendChild(c); shown[p.id] = p.score; }
      c.style.setProperty('--pc', p.color); c.style.order = k;
      c.classList.toggle('me', p.id === me.id);
      c.querySelector('.rank').textContent = k + 1;
      c.querySelector('.nm').textContent = p.name + (p.bot ? ' 🤖' : '') + (p.id === me.id ? ' (toi)' : '');
      const a = S.answers && S.answers[p.id];
      let st = '';
      if (S.phase === 'question') st = a ? (a.locked ? '<em class="locked">🔒 bloqué</em>' : '<em class="done">✔ a répondu</em>') : '<em class="think">réfléchit…</em>';
      else if (S.phase === 'reveal' && S.last) { const r = S.last.results.find((x) => x.id === p.id); st = r ? (r.ok ? '<em class="good">juste</em>' : r.raw != null ? '<em class="bad">raté</em>' : '<em class="think">pas de réponse</em>') : ''; }
      if (p.streak >= 2 && S.phase !== 'over') st += `<em class="flame">🔥 ${p.streak}</em>`;
      c.querySelector('.st').innerHTML = st;
      animateScore(c.querySelector('.sc'), p.id, p.score);
    });
  }
  function animateScore(node, id, to) {
    const from = shown[id] ?? to;
    shown[id] = to;
    if (from === to || prefersReducedMotion()) { node.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); node.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    const pop = el('span', 'delta ' + (to > from ? 'up' : 'down'), (to > from ? '+' : '−') + fmt(Math.abs(to - from)));
    node.parentNode.appendChild(pop); setTimeout(() => pop.remove(), 1600);
  }

  /* ---------------------------------------------------------- avant-partie */
  function renderSetup(s) {
    setupS = s;
    const isHost = s.hostId === me.id, c = s.cfg, ready = s.players.filter((p) => p.ready);
    const w = LEVEL_WORDS[s.level] || LEVEL_WORDS.normal;
    stage.innerHTML = `
      <div class="card setup">
        <div class="setup-head">
          <div class="logo-c"><span>Tête de</span><b>Calcul</b></div>
          <div class="chips">
            <span class="chip strong">${esc(MODES[c.mode].label)}</span><span class="chip">${c.len} questions</span>
            <span class="chip">${esc(DIFF_LABEL[c.diff])}</span><span class="chip">${esc(THEME_LABEL[c.theme])}</span>
            ${c.finale ? '<span class="chip gold">Finale quitte ou double</span>' : ''}
            ${s.bots ? `<span class="chip">${s.bots} bot${s.bots > 1 ? 's' : ''} ${s.bots > 1 ? w[1] : w[0]}</span>` : ''}
          </div>
        </div>
        <p class="mdesc">${esc(MODES[c.mode].desc)}</p>
        <div class="rules">
          ${Object.entries(CATS).map(([k, v]) => `<div class="rule" style="--cc:${v.color}"><i>${v.icon}</i><b>${esc(v.label)}</b><small>${v.pts * 100} pts</small></div>`).join('')}
        </div>
        <ul class="howto">
          <li>Une seule réponse par question : <b>Entrée</b> pour valider.</li>
          <li>Plus tu réponds vite, plus tu marques. Le premier juste gagne <b>+50</b>.</li>
          <li>Trois bonnes réponses d'affilée : bonus de <b>série</b> 🔥.</li>
        </ul>
        <div class="who">${s.players.map((p) => `<span class="pp${p.ready ? '' : ' off'}"><i style="background:${esc(p.color)}"></i>${esc(p.name)}${p.ready ? '' : ' · charge…'}</span>`).join('')}</div>
        ${isHost ? `<button class="btn big block primary" id="bStart" ${ready.length ? '' : 'disabled'}>Lancer la partie</button>`
          : '<div class="waithost"><i></i>L\'hôte va lancer la partie…</div>'}
      </div>`;
    const b = $('#bStart'); if (b) b.onclick = () => { sfx.play('go'); start(); };
  }

  /* ---------------------------------------------------------- question */
  function renderQuestion() {
    const q = S.q, cat = CATS[q.cat];
    myAns = null; lastTick = -1;
    const expr = q.input === 'expr';
    stage.innerHTML = `
      <div class="card pupitre ${expr ? 'expr' : ''}" style="--cc:${cat.color}">
        <div class="qhead">
          <span class="cat"><i>${cat.icon}</i>${esc(cat.label)}</span>
          <span class="pts">${q.pts * 100} pts</span>
          ${q.final ? '<span class="final">Quitte ou double</span>' : ''}
        </div>
        <div class="timer"><i id="tbar"></i><b id="tsec"></b></div>
        ${expr ? `<div class="target"><small>Cible</small><b>${q.target}</b></div>
          <div class="tiles">${q.nums.map((n, k) => `<button class="tile" data-n="${n}" data-k="${k}">${n}</button>`).join('')}</div>`
          : `<div class="qtext">${qText(q.text)}<span class="eq"> = ?</span></div>`}
        <p class="qsub">${esc(q.sub)}</p>
        <form class="answer" id="aform" autocomplete="off">
          <input id="ain" ${expr ? 'inputmode="text" placeholder="ex. (8 + 4) × 5"' : 'inputmode="numeric" placeholder="Ta réponse"'} maxlength="${expr ? 40 : 12}" aria-label="Ta réponse" spellcheck="false">
          <button class="btn yellow" id="asend">Valider</button>
        </form>
        ${expr ? `<div class="ops">${['+', '−', '×', '÷', '(', ')'].map((o) => `<button type="button" data-op="${o}">${o}</button>`).join('')}<button type="button" data-op="back" aria-label="Effacer">⌫</button><button type="button" data-op="clear">C</button></div>` : ''}
        <div class="sent" id="sent" hidden></div>
      </div>`;
    const inp = $('#ain');
    setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
    $('#aform').onsubmit = (e) => {
      e.preventDefault();
      const v = inp.value.trim();
      if (!v || myAns) return;
      myAns = v; answer(v); sfx.play('lock'); lockInput(v, false);
    };
    if (expr) {
      const insert = (t) => { if (myAns) return; inp.value += t; markTiles(); inp.focus({ preventScroll: true }); };
      for (const b of root.querySelectorAll('.tile')) b.onclick = () => { if (!b.classList.contains('used')) insert((/\d$/.test(inp.value) ? ' + ' : '') + b.dataset.n); };
      for (const b of root.querySelectorAll('[data-op]')) b.onclick = () => {
        if (myAns) return;
        const o = b.dataset.op;
        if (o === 'back') inp.value = inp.value.replace(/\s*\S\s*$/, ''); else if (o === 'clear') inp.value = ''; else inp.value += ` ${o} `.replace(/^ \(/, '(').replace(/\) $/, ')');
        markTiles(); inp.focus({ preventScroll: true });
      };
      inp.addEventListener('input', markTiles);
    }
    sfx.play('question');
  }
  // tuiles déjà employées dans l'expression
  function markTiles() {
    const left = ($('#ain').value.match(/\d+/g) || []).map(Number);
    for (const b of root.querySelectorAll('.tile')) {
      const i = left.indexOf(Number(b.dataset.n));
      b.classList.toggle('used', i >= 0); if (i >= 0) left.splice(i, 1);
    }
  }
  function lockInput(v, locked) {
    const inp = $('#ain'); if (!inp) return;
    inp.disabled = true; $('#asend').disabled = true;
    const s = $('#sent'); s.hidden = false;
    s.className = 'sent' + (locked ? ' locked' : '');
    s.innerHTML = locked ? `🔒 Raté ! Tu es bloqué pour cette question.` : `Réponse verrouillée : <b>${esc(v)}</b> · on attend les autres…`;
  }

  /* ---------------------------------------------------------- révélation */
  function renderReveal() {
    const L = S.last, cat = CATS[L.cat], mine = L.results.find((r) => r.id === me.id);
    const res = [...L.results].sort((a, b) => b.pts - a.pts || (a.at ?? 1e9) - (b.at ?? 1e9));
    stage.innerHTML = `
      <div class="card reveal" style="--cc:${cat.color}">
        <div class="qhead"><span class="cat"><i>${cat.icon}</i>${esc(cat.label)}</span>${L.final ? '<span class="final">Quitte ou double</span>' : ''}</div>
        <div class="qrecall">${qText(S.history[S.history.length - 1].text)}${L.cat === 'compte' ? ' 🎯' : ' ='}</div>
        <div class="bigans">${esc(L.show)}</div>
        ${mine ? `<div class="verdict ${mine.ok ? 'ok' : mine.raw != null ? 'ko' : 'none'}">${mine.ok ? `Bravo ! +${fmt(mine.pts)}` : mine.raw != null ? (mine.pts < 0 ? `Raté… ${fmt(mine.pts)}` : 'Raté…') : 'Pas de réponse'}</div>` : ''}
        <div class="tip"><b>💡 L'astuce</b>${esc(L.tip)}</div>
        <ol class="results">${res.map((r) => {
          const p = S.players.find((x) => x.id === r.id); if (!p) return '';
          const tags = r.tags.map((t) => `<span class="tag t-${t}">${TAGS[t]}${t === 'serie' ? ' ×' + r.streak : ''}</span>`).join('');
          return `<li class="${r.ok ? 'ok' : r.raw != null ? 'ko' : 'none'}"><i class="dot" style="background:${esc(p.color)}"></i><span class="nm">${esc(p.name)}</span>
            <span class="raw">${r.raw != null ? esc(r.raw.replace(/\*/g, '×')) : '—'}</span><span class="tm">${r.at != null ? secs(r.at) : ''}</span>${tags}<b class="gain">${r.pts > 0 ? '+' : ''}${r.pts ? fmt(r.pts) : '0'}</b></li>`;
        }).join('')}</ol>
        <div class="nextbar"><i id="nbar"></i></div>
      </div>`;
    if (mine) sfx.play(mine.ok ? (mine.tags.includes('serie') ? 'streak' : 'ok') : mine.raw != null ? 'ko' : 'lock');
  }

  /* ---------------------------------------------------------- compte à rebours */
  function renderIntro() {
    const c = S.cfg;
    stage.innerHTML = `<div class="card intro"><div class="logo-c"><span>Tête de</span><b>Calcul</b></div>
      <p>${esc(MODES[c.mode].label)} · ${c.len} questions · ${esc(DIFF_LABEL[c.diff])}</p><div class="count" id="count">3</div></div>`;
  }

  /* ---------------------------------------------------------- podium */
  function renderOver() {
    const rank = S.ranking.map((id) => S.players.find((p) => p.id === id)).filter(Boolean);
    const podium = [rank[1], rank[0], rank[2]];
    const meP = S.players.find((p) => p.id === me.id);
    const myPlace = S.ranking.indexOf(me.id);
    const isHost = !setupS || setupS.hostId === me.id;
    const n = S.history.length || 1;
    const catStats = meP ? Object.entries(meP.byCat).map(([k, v]) => `<span class="chip" style="--cc:${CATS[k].color}"><i>${CATS[k].icon}</i> ${esc(CATS[k].label)} : ${v.ok}/${v.n}</span>`).join('') : '';
    stage.innerHTML = `
      <div class="card over">
        <h1>${myPlace === 0 ? '🏆 Champion du calcul !' : myPlace > 0 ? `Tu finis ${myPlace + 1}<sup>e</sup>` : 'Fin de partie'}</h1>
        <div class="podium">${podium.map((p, k) => p ? `<div class="step s${[2, 1, 3][k]}" style="--pc:${esc(p.color)}">
          <div class="who"><i></i><b>${esc(p.name)}</b><span>${fmt(p.score)} pts</span></div><div class="block">${[2, 1, 3][k]}</div></div>` : '<div class="step empty"></div>').join('')}</div>
        <table class="stats"><thead><tr><th>#</th><th>Joueur</th><th>Score</th><th>Justes</th><th>Série max</th><th>Plus rapide</th><th>Temps moyen</th><th>⚡ Premier</th></tr></thead>
          <tbody>${rank.map((p, k) => `<tr class="${p.id === me.id ? 'me' : ''}"><td>${k + 1}</td><td><i class="dot" style="background:${esc(p.color)}"></i>${esc(p.name)}</td>
            <td><b>${fmt(p.score)}</b></td><td>${p.right}/${n}</td><td>${p.bestStreak}</td><td>${p.fastest != null ? secs(p.fastest) : '—'}</td>
            <td>${p.right ? secs(p.totalMs / p.right) : '—'}</td><td>${p.firsts}</td></tr>`).join('')}</tbody></table>
        ${catStats ? `<div class="mycats"><b>Tes catégories</b>${catStats}</div>` : ''}
        ${meP ? `<div class="strip" aria-label="Tes réponses">${S.history.map((h) => { const r = h.results.find((x) => x.id === me.id); return `<i class="${r && r.ok ? 'ok' : 'ko'}" title="${esc(h.text)} = ${esc(h.show)}"></i>`; }).join('')}</div>` : ''}
        <div class="row end">${isHost ? '<button class="btn yellow big" id="bAgain">Rejouer</button>' : '<span class="waithost"><i></i>L\'hôte peut relancer une partie</span>'}<button class="btn ghost big" id="bBack">Retour au salon</button></div>
      </div>`;
    const a = $('#bAgain'); if (a) a.onclick = () => start();
    $('#bBack').onclick = () => exit();
    sfx.play('win');
    confetti();
  }
  function confetti() {
    if (prefersReducedMotion()) return;
    const box = el('div', 'confetti');
    const colors = ['#ff4b2b', '#ffc531', '#2b8cff', '#2fbf71', '#ff5fa2', '#fff8ea'];
    for (let k = 0; k < 90; k++) {
      const c = el('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = colors[k % colors.length];
      c.style.animationDelay = Math.random() * 0.8 + 's'; c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(c);
    }
    root.appendChild(box); setTimeout(() => box.remove(), 5000);
  }

  /* ---------------------------------------------------------- horloge : barre de temps, compte à rebours */
  function frame() {
    requestAnimationFrame(frame);
    if (!S) return;
    const left = S.endsAt - now();
    if (S.phase === 'question' && S.q) {
      const bar = $('#tbar'), sec = $('#tsec'); if (!bar) return;
      const k = Math.max(0, Math.min(1, left / (S.q.time * 1000)));
      bar.style.transform = `scaleX(${k})`;
      bar.classList.toggle('hurry', left < 5000);
      const s = Math.max(0, Math.ceil(left / 1000));
      sec.textContent = s + ' s';
      if (!myAns && s <= 3 && s > 0 && s !== lastTick) { lastTick = s; sfx.play('tick'); }
    } else if (S.phase === 'intro') {
      const c = $('#count'); if (!c) return;
      const s = Math.ceil(left / 1000), txt = s > 0 ? String(Math.min(3, s)) : 'Go !';
      if (c.textContent !== txt) { c.textContent = txt; c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); sfx.play(s > 0 ? 'count' : 'go'); }
    } else if (S.phase === 'reveal') {
      const b = $('#nbar'); if (b) b.style.transform = `scaleX(${Math.max(0, Math.min(1, left / 5200))})`;
    }
  }
  requestAnimationFrame(frame);

  // raccourcis : R pour réagir, Échap pour fermer
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') toggleEmo(false);
    if ((e.key === 'r' || e.key === 'R') && document.activeElement && document.activeElement.tagName !== 'INPUT') toggleEmo();
  });

  return {
    setup(s) { if (S && S.phase !== 'over') return; if (!S) renderSetup(s); else setupS = s; },
    update(state, off) {
      offset = off || 0;
      const prev = S; S = state;
      const k = state.phase + ':' + state.idx;
      const round = state.phase === 'over' ? 'Terminé' : state.idx >= 0 ? `Question ${state.idx + 1} / ${state.cfg.len} · ${MODES[state.cfg.mode].label}` : MODES[state.cfg.mode].label;
      $('#round').textContent = round;
      if (k !== key) {
        key = k;
        if (state.phase === 'intro') { shown = {}; $('#roster').innerHTML = ''; renderIntro(); }
        else if (state.phase === 'question') renderQuestion();
        else if (state.phase === 'reveal') renderReveal();
        else if (state.phase === 'over') renderOver();
      } else if (state.phase === 'question' && prev && prev.qAt !== state.qAt) renderQuestion(); // question relancée (nouvel hôte)
      renderRoster();
    },
    ack(m) { if (S && m.i === S.idx && m.locked) { lockInput(myAns, true); sfx.play('ko'); } },
    error(msg, soft) {
      // saisie illisible : le joueur peut corriger
      if (soft && S && S.phase === 'question') { myAns = null; const i = $('#ain'); if (i) { i.disabled = false; $('#asend').disabled = false; $('#sent').hidden = true; i.focus(); } }
      toast(msg);
    },
    toast,
    emote: showEmote,
  };
}
