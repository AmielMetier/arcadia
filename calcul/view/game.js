// Vue de Tête de Calcul : salle d'avant-partie, pupitre de question, révélation et podium final.
// La vue n'invente rien : elle affiche l'état reçu de l'hôte et envoie la saisie du joueur.
import { CATS, TIER_LABEL, DIFFS, chartierTier, fmt } from '../engine/questions.js';
import { MODES, POWERS, STEAL_MS, FOG_MS, describeAnswer, JOKERS, LIVES } from '../engine/rules.js';
import { buildProgram } from '../engine/code-data.js';
import { runPython, preloadPython } from './py.js';
import { highlightPy } from './pyhl.js';
import { EMOTES, PHRASES, emoteOf } from './emotes.js';
import { figureSvg } from './figure.js';
import { sfx } from './sfx.js';
import { wallStreetMusic } from './music.js';
import { esc, el, prefersReducedMotion } from './util.js';

const DIFF_LABEL = { facile: 'Facile', normal: 'Moyen', expert: 'Difficile' };
const THEME_LABEL = {
  mix: 'Mélangé',
  chartier: 'The Candidate',
  base: 'Les 4 opérations',
  malin: 'Astuces & nombres',
  frac: 'Fractions & décimaux',
  logique: 'Suites & logique',
  vite: 'Vitesse & estimations',
  flash: 'Vrai/faux & comparaisons',
  algebre: 'Équations & devinettes',
  geo: 'Géométrie & mesures',
  compte: 'Compte est bon'
};
const LEVEL_WORDS = { facile: ['facile', 'faciles'], normal: ['moyen', 'moyens'], expert: ['difficile', 'difficiles'] };
const qText = (t) => esc(t).replace(/\^(\d+)/g, '<sup>$1</sup>');
const secs = (ms) => (ms / 1000).toFixed(1).replace('.', ',') + ' s';
const TAGS = { eclair: '⚡ Le plus rapide', serie: '🔥 Série', peril: '💀 Pénalité', power: '🎁 Pouvoir', trap: '🪤 Piège', cut: '✂️ Coupé', life: '♥ +1 vie' };
const hearts = (n, max = LIVES) => `${'♥'.repeat(Math.max(0, n))}<s>${'♥'.repeat(Math.max(0, max - n))}</s>`;
// valeurs des tests (JSON) écrites comme en Python
const pyRepr = (v) => (v === true ? 'True' : v === false ? 'False' : v == null ? 'None' : Array.isArray(v) ? `[${v.map(pyRepr).join(', ')}]` : typeof v === 'string' ? `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
  : typeof v === 'object' ? `{${Object.entries(v).map(([k, x]) => `${pyRepr(k)}: ${pyRepr(x)}`).join(', ')}}` : String(v));
const motion = () => !prefersReducedMotion();

// Les verdicts de Pierre Chartier, selon la réponse et la vitesse
const CHARTIER_QUOTES = {
  fast: [
    "Réflexe de trader. C'est exactement ce que je veux voir.",
    "Tu as répondu avant que je finisse de lire. Continue comme ça.",
    "Rapide et juste. Le desk aime les gens comme toi.",
    "Là, tu viens de gagner ma considération. Pour l'instant.",
    "Exécution parfaite. Pas une milliseconde de perdue.",
  ],
  ok: [
    "Juste. Mais sur un desk, cette hésitation coûte de l'argent.",
    "Correct. Maintenant, fais-le deux fois plus vite.",
    "Bonne réponse. Ne prends pas la confiance, la suite va trier.",
    "C'est validé. Mais je t'ai vu douter.",
    "Exact. Le marché, lui, n'aurait pas attendu.",
  ],
  ko: [
    "Non. Avec une erreur pareille, l'entretien s'arrête là chez nous.",
    "Faux. Tu viens de perdre l'argent du fonds en une seconde.",
    "Non non non. Révise tes bases avant de revenir me voir.",
    "Raté. On ne trade pas au doigt mouillé.",
    "Erreur de débutant. Le prochain candidat attend dans le couloir.",
  ],
  trap: [
    "Tu as foncé tête baissée dans le piège. C'est exactement ce que je teste.",
    "La réponse évidente était la mauvaise. Deux vies, c'est le prix de la naïveté.",
    "Classique. Tout le monde tombe là-dedans, et c'est pour ça que tout le monde ne passe pas.",
  ],
  partial: [
    "Ton code tourne à moitié. En production, à moitié, c'est un incident.",
    "Quelques tests passent. Je garde, mais je veux du propre.",
  ],
  out: [
    "Merci d'être venu. On vous rappellera… ou pas.",
    "C'est terminé pour toi. Tu peux rendre ton badge visiteur à l'accueil.",
  ],
  timeout: [
    "Temps écoulé. Le marché n'attend personne.",
    "Rien ? Le silence, en entretien, c'est éliminatoire.",
    "Trop lent. Quelqu'un d'autre a déjà pris le deal.",
    "Paralysé par la pression ? Mauvais signe pour la suite.",
  ],
  finalOk: ["Quitte ou double, et tu doubles. Respect.", "Sang-froid total sur la finale. Ça, ça ne s'apprend pas."],
  finalKo: ["Tout se jouait là. Et tu as craqué.", "La finale, c'est là qu'on voit les vrais. Pas aujourd'hui."],
};

// Le bandeau de cotations (indices fictifs qui bougent, puis les joueurs cotés comme des actions)
const TICKER_IDX = [['CAC 40', 7984.3], ['S&P 500', 5864.7], ['NASDAQ', 18392.1], ['EUR/USD', 1.0842], ['DAX', 19210.5], ['OR', 2720.5], ['BRENT', 74.2], ['US 10A', 4.22], ['VIX', 16.4]];
// Portrait de Pierre Chartier (ses initiales restent dessous si l'image ne charge pas)
const PC_IMG = 'img/chartier.jpg';
const pcFace = (cls) => `<div class="${cls}" aria-hidden="true"><span>PC</span><img src="${PC_IMG}" alt="" onerror="this.remove()"></div>`;
const symbolOf = (nm) => (String(nm).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase() + 'XXXX').slice(0, 4);

export function mountGame(root, { me, answer, emote, sabotage = () => {}, joker = () => {}, start, exit }) {
  root.className = 'game';
  root.innerHTML = `
    <div class="deco" aria-hidden="true"><span>+</span><span>÷</span><span>×</span><span>−</span><span>√</span><span>%</span><span>π</span><span>=</span></div>
    <header class="topbar">
      <div class="info"><b id="ibrand">Tête de Calcul</b><span id="round"></span></div>
      <div class="ticker" id="ticker" aria-hidden="true"><div class="ticker-track" id="ttrack"></div></div>
      <div class="tools">
        <button class="tool" id="tmus" title="Musique de salle de marché" hidden>🎵</button>
        <button class="tool" id="tsnd" title="Bruitages">🔊</button>
        <button class="tool quit" id="tquit">Quitter</button>
      </div>
    </header>
    <aside class="roster" id="roster" aria-label="Joueurs"></aside>
    <main class="stage" id="stage"></main>
    <div class="dock">
      <button class="btn ghost emobtn" id="bEmote" title="Réagir" aria-expanded="false">😀</button>
      <div class="powers" id="powers" aria-label="Tes pouvoirs"></div>
      <div class="emopanel" id="emopanel" hidden>
        <div class="emogrid">${EMOTES.map((e) => `<button data-emo="${e.id}" aria-label="${e.id}">${e.glyph}</button>`).join('')}</div>
        <div class="phrases">${PHRASES.map((p) => `<button data-emo="${p.id}">${esc(p.text)}</button>`).join('')}</div>
      </div>
      <div class="sabpick" id="sabpick" hidden></div>
    </div>
    <div class="toast" id="toast" hidden role="status"></div>
    <div class="inter" id="inter" aria-hidden="true"><div class="inter-band"><small id="ikick"></small><b id="ititle"></b><span id="isub"></span></div></div>`;
  const $ = (s) => root.querySelector(s);
  const stage = $('#stage');

  // La carte s'adapte à l'écran : réduite si elle déborde (jamais besoin de faire défiler, sauf écran minuscule),
  // agrandie sur les grands écrans pour occuper la place (jusqu'à ×1,5)
  let fitCard = null;
  function fit() {
    const c = stage.querySelector(':scope > .card'); if (!c) return;
    c.style.zoom = '';
    const availH = stage.clientHeight - 14, availW = stage.clientWidth - 14, h = c.offsetHeight, w = c.offsetWidth;
    if (!h || !w) return;
    const min = innerWidth < 820 ? 0.72 : 0.5, max = innerWidth < 820 ? 1 : 1.5;
    const k = Math.max(min, Math.min(max, availH / h, availW / w));
    c.style.zoom = Math.abs(k - 1) < 0.02 ? '' : String(Math.floor(k * 1000) / 1000);
  }
  const fitRO = typeof ResizeObserver === 'function' ? new ResizeObserver(() => requestAnimationFrame(fit)) : null;
  if (fitRO) fitRO.observe(stage);
  new MutationObserver(() => {
    const c = stage.querySelector(':scope > .card');
    if (c !== fitCard && fitRO) { if (fitCard) fitRO.unobserve(fitCard); fitCard = c; if (c) fitRO.observe(c); }
    requestAnimationFrame(fit);
  }).observe(stage, { childList: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fit());
  addEventListener('resize', () => requestAnimationFrame(fit));

  let S = null, offset = 0, key = '', myAns = null, shown = {}, lastTick = -1, setupS = null, sabSeen = -1, picking = null;
  let jokInfo = null, draft = { idx: -1, code: '' }, pyAsked = false, interFor = -2, interT = 0;
  const meP = () => S && S.players.find((p) => p.id === me.id);
  const iAmOut = () => !!(meP() && meP().out);
  const name = (id) => { const p = S && S.players.find((q) => q.id === id); return p ? p.name : '?'; };
  const now = () => Date.now() + offset;
  const myCurses = () => (S && S.active && S.active[me.id]) || [];
  const myDeadline = () => S.endsAt - (myCurses().some((c) => c.power === 'time') ? STEAL_MS : 0);

  /* ---------------------------------------------------------- outils */
  const syncTools = () => {
    $('#tsnd').textContent = sfx.on ? '🔊' : '🔇';
    $('#tsnd').classList.toggle('off', !sfx.on);
    const tm = $('#tmus');
    if (tm) {
      tm.textContent = wallStreetMusic.on ? '🎵' : '🔇';
      tm.classList.toggle('off', !wallStreetMusic.on);
    }
  };
  syncTools();
  $('#tsnd').onclick = () => { sfx.toggle(); syncTools(); };
  const tm = $('#tmus');
  if (tm) tm.onclick = () => { wallStreetMusic.toggle(); syncTools(); };
  $('#tquit').onclick = () => { wallStreetMusic.stop(); exit(); };
  let toastT = 0;
  function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.hidden = false; t.classList.remove('pop'); void t.offsetWidth; t.classList.add('pop'); clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, ms); }

  /* ---------------------------------------------------------- réactions */
  const toggleEmo = (v) => { const p = $('#emopanel'); p.hidden = v == null ? !p.hidden : !v; $('#bEmote').setAttribute('aria-expanded', String(!p.hidden)); if (!p.hidden) closePick(); };
  $('#bEmote').onclick = () => toggleEmo();
  for (const b of root.querySelectorAll('[data-emo]')) b.onclick = () => { emote(b.dataset.emo); toggleEmo(false); };
  const cardOf = (id) => root.querySelector(`.pcard[data-id="${id}"]`);
  function showEmote(from, id) {
    const em = emoteOf(id); if (!em) return;
    const card = cardOf(from);
    const b = el('div', 'bubble' + (em.glyph ? ' big' : ''), esc(em.glyph || em.text));
    if (card) { card.appendChild(b); } else { b.classList.add('free'); b.textContent = `${name(from)} : ${em.glyph || em.text}`; root.appendChild(b); }
    sfx.play('pop');
    setTimeout(() => b.remove(), 2600);
  }

  /* ---------------------------------------------------------- sabotage */
  const canSabotage = () => S && S.cfg.sabotage && S.phase === 'reveal' && S.idx + 1 < S.cfg.len;
  function renderPowers() {
    const box = $('#powers');
    const meP = S && S.players.find((p) => p.id === me.id);
    if (!S || !S.cfg.sabotage || !meP || S.phase === 'over') { box.innerHTML = ''; return; }
    const open = canSabotage();
    box.innerHTML = meP.powers.length
      ? meP.powers.map((pw, k) => pw === 'shield'
        ? `<span class="power shield" title="${esc(POWERS.shield.desc)}">${POWERS.shield.icon}<small>Bouclier</small></span>`
        : `<button class="power${open ? ' ready' : ''}" data-pw="${pw}" data-k="${k}" ${open ? '' : 'disabled'} title="${esc(POWERS[pw].label + ' : ' + POWERS[pw].desc)}">${POWERS[pw].icon}<small>${esc(POWERS[pw].label)}</small></button>`).join('')
      : '<span class="power empty" title="3 bonnes réponses d\'affilée = un pouvoir">🎁<small>3 d\'affilée</small></span>';
    for (const b of box.querySelectorAll('[data-pw]')) b.onclick = () => openPick(b.dataset.pw);
    if (picking && !open) closePick();
  }
  function openPick(pw) {
    if (!canSabotage()) return;
    toggleEmo(false);
    picking = pw;
    const box = $('#sabpick');
    const others = S.players.filter((p) => p.id !== me.id);
    box.innerHTML = `<b>${POWERS[pw].icon} ${esc(POWERS[pw].label)}</b><small>${esc(POWERS[pw].desc)} · sur qui ?</small>
      <div class="targets">${others.map((p) => `<button data-t="${p.id}"><i class="dot" style="background:${esc(p.color)}"></i>${esc(p.name)}<span>${fmt(p.score)}</span></button>`).join('')}</div>
      <button class="linkbtn" id="sabCancel">Annuler</button>`;
    box.hidden = false;
    for (const b of box.querySelectorAll('[data-t]')) b.onclick = () => { sabotage(pw, Number(b.dataset.t)); closePick(); };
    $('#sabCancel').onclick = closePick;
  }
  function closePick() { picking = null; $('#sabpick').hidden = true; }

  // un pouvoir qui vole d'un joueur à l'autre
  function playSabotage(e) {
    const from = cardOf(e.from), to = cardOf(e.to), P = POWERS[e.power];
    toast(e.blocked ? `🛡️ ${name(e.to)} bloque ${P.label.toLowerCase()} de ${name(e.from)} !` : `${P.icon} ${name(e.from)} envoie « ${P.label} » à ${name(e.to)} !`, 3000);
    sfx.play(e.blocked ? 'lock' : 'sab');
    if (!from || !to || !motion()) return;
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const f = el('div', 'fly', P.icon);
    f.style.left = a.left + a.width / 2 + 'px'; f.style.top = a.top + a.height / 2 + 'px';
    root.appendChild(f);
    const dx = b.left - a.left, dy = b.top - a.top;
    const anim = f.animate([
      { transform: 'translate(-50%,-50%) scale(.6)' },
      { transform: `translate(calc(-50% + ${dx / 2 + 60}px), calc(-50% + ${dy / 2 - 40}px)) scale(1.6) rotate(200deg)`, offset: 0.5 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(360deg)` },
    ], { duration: 900, easing: 'cubic-bezier(.4,.1,.3,1)' });
    anim.onfinish = () => {
      f.remove();
      to.classList.remove('hit', 'blocked'); void to.offsetWidth; to.classList.add(e.blocked ? 'blocked' : 'hit');
      if (e.blocked) { const s = el('div', 'shieldpop', '🛡️'); to.appendChild(s); setTimeout(() => s.remove(), 1200); }
    };
  }

  /* ---------------------------------------------------------- joueurs */
  function renderRoster() {
    if (!S) { $('#roster').innerHTML = ''; return; }
    // The Candidate : les éliminés descendent en bas, grisés
    const order = [...S.players].sort((a, b) => (a.out ? 1 : 0) - (b.out ? 1 : 0) || b.score - a.score);
    const box = $('#roster');
    // à 7 ou 8 autour de la table, cartes plus compactes pour que tout le monde tienne
    box.classList.toggle('many', S.players.length > 6);
    for (const c of [...box.children]) if (!S.players.some((p) => String(p.id) === c.dataset.id)) c.remove();
    // animation FLIP : on note la place de chaque carte avant de les réordonner
    const before = new Map([...box.children].map((c) => [c.dataset.id, c.getBoundingClientRect()]));
    order.forEach((p, k) => {
      let c = cardOf(p.id);
      if (!c) { c = el('div', 'pcard'); c.dataset.id = p.id; c.innerHTML = '<i class="band"></i><span class="rank"></span><span class="nm"></span><b class="sc"></b><span class="st"></span>'; box.appendChild(c); shown[p.id] = p.score; }
      c.style.setProperty('--pc', p.color); c.style.order = k;
      c.classList.toggle('me', p.id === me.id);
      c.classList.toggle('lead', k === 0 && p.score > 0 && !p.out);
      // éliminé à l'instant : la carte vacille et tombe avant de passer en gris
      if (p.out && !c.classList.contains('out') && motion()) { c.classList.remove('falling'); void c.offsetWidth; c.classList.add('falling'); }
      c.classList.toggle('out', !!p.out);
      c.querySelector('.rank').textContent = k === 0 && p.score > 0 ? '👑' : k + 1;
      c.querySelector('.nm').textContent = p.name + (p.bot ? ' 🤖' : '') + (p.id === me.id ? ' (toi)' : '');
      const a = S.answers && S.answers[p.id];
      let st = '';
      if (p.out) st = `<em class="outtag">${p.outWhy === 'palier' ? '✂️ coupé' : '🚪 éliminé'}</em>`;
      else if (S.phase === 'question') st = a ? (a.locked ? '<em class="locked">🔒 bloqué</em>' : a.grading ? '<em class="done">⚙️ code en test…</em>' : '<em class="done">✔ a répondu</em>') : '<em class="think">réfléchit…</em>';
      else if (S.phase === 'reveal' && S.last) { const r = S.last.results.find((x) => x.id === p.id); st = r ? (r.ok ? '<em class="good">juste</em>' : r.raw != null ? '<em class="bad">raté</em>' : '<em class="think">pas de réponse</em>') : ''; }
      if (p.streak >= 2 && S.phase !== 'over' && !p.out) st += `<em class="flame">🔥 ${p.streak}</em>`;
      const regained = S.phase === 'reveal' && S.last && S.last.results.some((x) => x.id === p.id && x.tags.includes('life'));
      if (S.cfg.lives && !p.out) st = `<em class="lives${regained ? ' up' : ''}" title="${p.lives} vie${p.lives > 1 ? 's' : ''}">${hearts(p.lives, S.cfg.lives)}</em>` + st;
      const curses = S.phase === 'question' ? (S.active && S.active[p.id]) || [] : (S.curses && S.curses[p.id]) || [];
      if (curses.length) st += `<em class="curse" title="Saboté">${curses.map((c) => POWERS[c.power].icon).join('')}</em>`;
      if (S.cfg.sabotage && p.powers && p.powers.length && p.id !== me.id) st += `<em class="pw" title="Pouvoirs en réserve">${p.powers.map((pw) => POWERS[pw].icon).join('')}</em>`;
      c.querySelector('.st').innerHTML = st;
      animateScore(c.querySelector('.sc'), p.id, p.score);
    });
    if (motion()) for (const c of box.children) {
      const b0 = before.get(c.dataset.id); if (!b0) continue;
      const b1 = c.getBoundingClientRect(), dx = b0.left - b1.left, dy = b0.top - b1.top;
      if (dx || dy) c.animate([{ transform: `translate(${dx}px,${dy}px)` }, { transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.3,.7,.25,1)' });
    }
    renderPowers();
  }
  function animateScore(node, id, to) {
    const from = shown[id] ?? to;
    shown[id] = to;
    if (from === to || !motion()) { node.textContent = fmt(to); return; }
    const t0 = performance.now(), dur = 900;
    const step = (t) => { const k = Math.min(1, (t - t0) / dur); node.textContent = fmt(Math.round(from + (to - from) * (1 - (1 - k) ** 3))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
    const pop = el('span', 'delta ' + (to > from ? 'up' : 'down'), (to > from ? '+' : '−') + fmt(Math.abs(to - from)));
    node.parentNode.appendChild(pop); setTimeout(() => pop.remove(), 1600);
  }

  /* ---------------------------------------------------------- The Candidate : bandeau de cotations */
  const isCh = () => !!(S ? S.cfg.mode === 'chartier' : setupS && setupS.cfg.mode === 'chartier');
  let tickKey = '';
  function renderTicker() {
    const on = isCh();
    root.classList.toggle('mode-chartier', on);
    if (!on) { tickKey = ''; return; }
    // reconstruit seulement quand les scores changent (sinon le défilement repartirait à zéro)
    const players = S ? S.players : (setupS ? setupS.players : []);
    const last = S && S.last && S.phase !== 'question' ? S.last.results : [];
    const k = players.map((p) => p.id + ':' + (p.score || 0)).join(',') + '|' + (S ? S.phase === 'over' : '');
    if (k === tickKey) return;
    tickKey = k;
    const seed = players.reduce((a, p) => a + (p.score || 0), 7);
    const idx = TICKER_IDX.map(([n, v], i) => {
      const ch = Math.sin(seed * 0.37 + i * 1.7) * 1.4;
      const val = v * (1 + ch / 100);
      const txt = v < 10 ? val.toFixed(4).replace('.', ',') : v < 100 ? val.toFixed(2).replace('.', ',') : fmt(Math.round(val * 10) / 10);
      return `<span class="${ch >= 0 ? 'up' : 'down'}">${esc(n)} <b>${txt}</b> ${ch >= 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(2).replace('.', ',')} %</span>`;
    });
    const ppl = [...players].sort((a, b) => (b.score || 0) - (a.score || 0)).map((p) => {
      const r = last.find((x) => x.id === p.id), d = r ? r.pts : 0;
      return `<span class="pl ${d > 0 ? 'up' : d < 0 ? 'down' : ''}"><i style="background:${esc(p.color)}"></i>${esc(symbolOf(p.name))} <b>${fmt(p.score || 0)}</b> ${d > 0 ? '▲ +' + fmt(d) : d < 0 ? '▼ ' + fmt(d) : '■'}</span>`;
    });
    const one = `<span class="badge">THE CANDIDATE</span>${ppl.join('')}<span class="sep">◆</span>${idx.join('')}<span class="sep">◆</span>`;
    $('#ttrack').innerHTML = one + one;
  }

  /* ---------------------------------------------------------- avant-partie */
  function renderSetup(s) {
    setupS = s;
    root.classList.add('noroster');
    const isHost = s.hostId === me.id, c = s.cfg, ready = s.players.filter((p) => p.ready);
    const isChartier = c.mode === 'chartier';
    root.classList.toggle('mode-chartier', isChartier);
    $('#tmus').hidden = !isChartier;
    $('#ibrand').textContent = isChartier ? 'The Candidate' : 'Tête de Calcul';
    const w = LEVEL_WORDS[s.level] || LEVEL_WORDS.normal;
    if (isChartier) { wallStreetMusic.setMode('lobby'); wallStreetMusic.start(); renderTicker(); }

    const briefingHtml = isChartier
      ? `<p class="mdesc">Un entretien façon salle de marché. Finance, calcul mental, probabilités et brainteasers : ça commence gentiment, ça finit en comité.</p>
         <div class="rules tiers">
           ${[1, 2, 3].map((t, i) => `<div class="rule" style="--k:${i}"><i>${'★'.repeat(t)}</i><b>${TIER_LABEL[t]}</b><small>${t * 100} pts</small></div>`).join('')}
           ${c.finale ? '<div class="rule" style="--k:3"><i>×2</i><b>Finale</b><small>quitte ou double</small></div>' : ''}
         </div>
         <ul class="howto">
           <li>QCM (<b>1 2 3 4</b> ou <b>A B C D</b>), calculs et estimations à taper, suites logiques, figures à compter${c.code && c.len >= 8 ? `, et ${c.len >= 15 ? 'deux <b>épreuves de code Python</b>' : 'une <b>épreuve de code Python</b>'} de 3 minutes` : ''}.</li>
           <li><b>${hearts(c.lives, c.lives)}</b> ${['', 'une vie', 'deux vies', 'trois vies', 'quatre vies', 'cinq vies'][c.lives]} : une erreur ou un silence en coûte une, <b>le piège en coûte deux</b> 🪤. Trois bonnes réponses d'affilée en rendent une.</li>
           ${c.cut ? '<li>À la fin de chaque tour, le dernier du classement est <b>coupé</b> ✂️ (tant qu\'il reste trois candidats).</li>' : ''}
           ${c.jokers ? '<li>Deux jokers, une fois chacun : <b>✂️ 50/50</b> et <b>📞 Appel à un ami</b> (qui a souvent raison…).</li>' : ''}
           ${c.sabotage ? '<li>Sabotage activé : trois bonnes réponses d\'affilée donnent un pouvoir à lancer sur un adversaire.</li>' : ''}
           <li>Le dernier debout décroche le poste ; sinon, le meilleur score.</li>
         </ul>`
      : `<p class="mdesc">${esc(MODES[c.mode].desc)}</p>
         <div class="rules">
           ${Object.entries(CATS).filter(([k]) => k !== 'chartier').map(([k, v], i) => `<div class="rule" style="--cc:${v.color};--k:${i}"><i>${v.icon}</i><b>${esc(v.label)}</b><small>${v.pts * 100} pts</small></div>`).join('')}
         </div>
         <ul class="howto">
           <li>Une seule réponse par question : <b>Entrée</b> pour valider (ou <b>1</b> / <b>2</b> pour les choix).</li>
           <li>Plus tu réponds vite, plus tu marques. Le premier juste gagne <b>+50</b>.</li>
           <li>Trois bonnes réponses d'affilée : bonus de <b>série</b> 🔥${c.sabotage ? ' et un <b>pouvoir de sabotage</b> à lancer sur un adversaire entre deux questions' : ''}.</li>
         </ul>`;

    stage.innerHTML = `
      <div class="card setup deal">
        <div class="setup-head">
          ${isChartier ? pcFace('pc-face big') : ''}<div class="logo-c"><span>${isChartier ? 'Pierre Chartier présente' : 'Tête de'}</span><b>${isChartier ? 'The Candidate' : 'Calcul'}</b></div>
          <div class="chips">
            <span class="chip strong">${esc(MODES[c.mode].label)}</span><span class="chip">${c.len} questions</span>
            <span class="chip">${esc(DIFF_LABEL[c.diff])}</span>
            ${!isChartier ? `<span class="chip">${esc(THEME_LABEL[c.theme] || c.theme)}</span>` : ''}
            ${c.finale ? '<span class="chip gold">Finale quitte ou double</span>' : ''}
            ${c.sabotage ? '<span class="chip sab">Sabotage 🌫️⏱️🙃</span>' : ''}
            ${s.bots ? `<span class="chip">${s.bots} bot${s.bots > 1 ? 's' : ''} ${s.bots > 1 ? w[1] : w[0]}</span>` : ''}
          </div>
        </div>
        ${briefingHtml}
        <div class="who">${s.players.map((p) => `<span class="pp${p.ready ? '' : ' off'}"><i style="background:${esc(p.color)}"></i>${esc(p.name)}${p.ready ? '' : ' · charge…'}</span>`).join('')}</div>
        ${isHost ? `<button class="btn big block primary" id="bStart" ${ready.length ? '' : 'disabled'}>${isChartier ? 'Entrer dans la salle' : 'Lancer la partie'}</button>`
          : '<div class="waithost"><i></i>L\'hôte va lancer la partie…</div>'}
      </div>`;
    const b = $('#bStart');
    if (b) b.onclick = () => { sfx.play('go'); if (isChartier) wallStreetMusic.start(); start(); };
  }

  /* ---------------------------------------------------------- question */
  function questionBody(q) {
    if (q.input === 'code') {
      const ex = (q.examples || []).map(([args, exp]) => `<code>${esc(q.fn)}(${esc(args.map(pyRepr).join(', '))}) → ${esc(pyRepr(exp))}</code>`).join('');
      return `<div class="qtext cand code-title">⌨ ${qText(q.text)}</div><p class="code-brief">${qText(q.prompt || '')}</p>
        <div class="code-ex"><b>Exemples</b>${ex}<small>+ ${Math.max(0, (q.ntests || 0) - (q.examples || []).length)} tests cachés</small></div>`;
    }
    if (q.input === 'expr') return `<div class="target"><small>Cible</small><b>${q.target}</b></div>
      <div class="tiles">${q.nums.map((n, k) => `<button class="tile" data-n="${n}" data-k="${k}" style="--k:${k}">${n}</button>`).join('')}</div>`;
    const cls = q.isChartier ? 'cand' : q.cat === 'devinette' ? 'riddle' : q.fig ? 'geo' : q.text.length > 16 ? 'long' : '';
    return `${q.fig ? figureSvg(q.fig) : ''}<div class="qtext ${cls}">${qText(q.text)}${q.eq !== false ? '<span class="eq"> = ?</span>' : ''}</div>`;
  }

  const LETTERS = ['A', 'B', 'C', 'D'];
  function answerZone(q) {
    if (iAmOut()) return '<div class="spect">👀 Tu es éliminé : tu regardes la suite de l\'entretien.</div>';
    if (q.input === 'code') {
      const code = draft.idx === S.idx && draft.code ? draft.code : q.starter || '';
      return `<div class="code-zone">
          <div class="code-wrap"><pre class="code-gut" id="cgut" aria-hidden="true"></pre><div class="code-box">
            <pre class="code-hl" aria-hidden="true"><code id="chl"></code></pre>
            <textarea id="code" class="code-ed" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" wrap="off" aria-label="Ton code Python">${esc(code)}</textarea>
          </div></div>
          <div class="code-bar"><button type="button" class="btn ghost" id="ctest">▶ Tester les exemples</button><small>Tab : indenter · Ctrl+Entrée : envoyer</small><button type="button" class="btn yellow" id="csend">Envoyer mon code</button></div>
          <pre class="code-out" id="cout" hidden></pre>
        </div>`;
    }
    if (q.isChartier && q.input === 'choice') {
      return `<div class="cand-choices">${q.choices.map((c, k) => `<button type="button" class="cchoice" data-c="${k}" style="--k:${k}">
          <span class="cl">${LETTERS[k]}</span><span class="ct">${qText(c)}</span><kbd>${k + 1}</kbd></button>`).join('')}</div>`;
    }
    if (q.input === 'choice') {
      const vf = q.choices.length === 2 && q.choices[0] === 'Vrai';
      return `<div class="choices ${vf ? 'vf' : 'cmp'}">${q.choices.map((c, k) => `<button class="choice c${k}" data-c="${k}"><kbd>${vf ? (k ? 'F' : 'V') : k + 1}</kbd>${qText(c)}</button>`).join('')}</div>`;
    }
    const expr = q.input === 'expr';
    return `<form class="answer" id="aform" autocomplete="off">
        <input id="ain" ${expr ? 'inputmode="text" placeholder="ex. (8 + 4) × 5"' : 'inputmode="decimal" placeholder="Ta réponse"'} maxlength="${expr ? 40 : 14}" aria-label="Ta réponse" spellcheck="false">
        ${q.unit ? `<span class="unit">${esc(q.unit)}</span>` : ''}
        <button class="btn yellow" id="asend">Valider</button>
      </form>
      ${q.isChartier && q.tol ? `<p class="tolhint">${q.tolMode === 'factor' ? `Ordre de grandeur : juste à ×${fmt(q.tol)} près` : `Accepté à ±${fmt(Math.round(q.tol * 1000) / 10)} % près`}</p>` : ''}
      ${expr ? `<div class="ops">${['+', '−', '×', '÷', '(', ')'].map((o) => `<button type="button" data-op="${o}">${o}</button>`).join('')}<button type="button" data-op="back" aria-label="Effacer">⌫</button><button type="button" data-op="clear">C</button></div>` : ''}`;
  }

  function renderQuestion() {
    const q = S.q, cat = CATS[q.cat];
    const ch = !!q.isChartier;
    if (ch) { wallStreetMusic.setMode(q.final ? 'final' : 'question'); wallStreetMusic.start(); }
    myAns = null; lastTick = -1;
    const curses = myCurses();
    const head = ch
      ? `<span class="cat"><i>${cat.icon}</i>${esc(q.rubric || cat.label)}</span>
         <span class="tierb t${q.tier}">${'★'.repeat(q.tier)} ${esc(TIER_LABEL[q.tier])}</span>
         <span class="pts">${q.pts * 100} pts</span>
         ${q.final ? '<span class="final">Quitte ou double</span>' : ''}
         <span class="live"><i></i>EN DIRECT</span>
         ${S.cfg.lives && meP() && !meP().out ? `<span class="mylives" title="Tes vies">${hearts(meP().lives, S.cfg.lives)}</span>` : ''}
         <span class="qnum">${q.n} / ${S.cfg.len}</span>`
      : `<span class="cat"><i>${cat.icon}</i>${esc(cat.label)}</span>
         <span class="pts">${q.pts * 100} pts</span>
         ${q.final ? '<span class="final">Quitte ou double</span>' : ''}
         <span class="qnum">${q.n} / ${S.cfg.len}</span>`;
    stage.innerHTML = `
      <div class="card pupitre in-${q.input}${ch ? ' cand' : ''}${q.final ? ' isfinal' : ''} deal" style="--cc:${cat.color}">
        ${curses.map((c) => `<div class="cursed c-${c.power}">${POWERS[c.power].icon} <b>${esc(name(c.from))}</b> t'a envoyé « ${esc(POWERS[c.power].label)} »${c.power === 'time' ? ' : −5 s' : ''}</div>`).join('')}
        <div class="qhead">${head}</div>
        <div class="timer" id="timer"><i id="tbar"></i><b id="tsec"></b></div>
        <div class="qzone ${q.input !== 'code' && curses.some((c) => c.power === 'fog') ? 'fog' : ''} ${q.input !== 'code' && curses.some((c) => c.power === 'flip') ? 'flip' : ''}" id="qzone">
          ${questionBody(q)}
          ${ch ? '' : `<p class="qsub">${esc(q.sub)}</p>`}
        </div>
        <div class="jokers" id="jokers"></div>
        ${answerZone(q)}
        <div class="sent" id="sent" hidden></div>
      </div>`;
    jokInfo = null;
    renderJokers();
    const fog = $('#qzone.fog'); if (fog) fog.style.setProperty('--fog', FOG_MS + 'ms');

    if (q.input === 'code') wireCode(q);
    else if (q.input === 'choice') {
      for (const b of root.querySelectorAll('[data-c]')) b.onclick = () => choose(Number(b.dataset.c));
    } else {
      const inp = $('#ain');
      if (inp) {
        setTimeout(() => { try { inp.focus({ preventScroll: true }); } catch (e) {} }, 60);
        $('#aform').onsubmit = (e) => {
          e.preventDefault();
          const v = inp.value.trim();
          if (!v || myAns != null) return;
          myAns = v; answer(v); sfx.play('lock'); lockInput(v, false);
        };
      }
      if (q.input === 'expr') {
        const insert = (t) => { if (myAns != null) return; inp.value += t; markTiles(); inp.focus({ preventScroll: true }); };
        for (const b of root.querySelectorAll('.tile')) b.onclick = () => { if (!b.classList.contains('used')) insert((/\d$/.test(inp.value) ? ' + ' : '') + b.dataset.n); };
        for (const b of root.querySelectorAll('[data-op]')) b.onclick = () => {
          if (myAns != null) return;
          const o = b.dataset.op;
          if (o === 'back') inp.value = inp.value.replace(/\s*\S\s*$/, ''); else if (o === 'clear') inp.value = ''; else inp.value += ` ${o} `.replace(/^ \(/, '(').replace(/\) $/, ')');
          markTiles(); inp.focus({ preventScroll: true });
        };
        inp.addEventListener('input', markTiles);
      }
    }
    sfx.play(curses.length ? 'sab' : 'question');
  }

  /* ---------------------------------------------------------- The Candidate : jokers */
  function renderJokers() {
    const box = $('#jokers'); if (!box) return;
    const p = meP();
    // les jokers ne servent que sur les QCM : ailleurs, on ne les affiche pas
    if (!S || !S.cfg.lives || !p || p.out || S.phase !== 'question' || !S.q || S.q.input !== 'choice') { box.innerHTML = ''; return; }
    const usable = myAns == null && !(S.answers && S.answers[me.id]);
    box.innerHTML = Object.entries(JOKERS).map(([k, j]) => {
      const has = p.jokers.includes(k);
      return `<button type="button" class="joker${has ? '' : ' used'}" data-jok="${k}" ${has && usable ? '' : 'disabled'} title="${esc(j.desc || j.label)}">${j.icon} ${esc(j.label)}</button>`;
    }).join('') + (jokInfo && jokInfo.kind === 'friend' && S.q.choices ? `<span class="friendsays">📞 Ton ami : « Je dirais <b>${LETTERS[jokInfo.suggest]}</b>, ${esc(S.q.choices[jokInfo.suggest])}… je crois. »</span>` : '');
    for (const b of box.querySelectorAll('[data-jok]')) b.onclick = () => { b.disabled = true; joker(b.dataset.jok); };
  }
  function applyJoker(m) {
    if (!S || S.phase !== 'question' || m.idx !== S.idx) return;
    jokInfo = m;
    // 50/50 : les deux réponses retirées s'effacent, les deux restantes se rapprochent
    if (m.kind === 'half') for (const k of m.removed) {
      const b = root.querySelector(`[data-c="${k}"]`); if (!b) continue;
      b.disabled = true; b.classList.add('going');
      setTimeout(() => { b.classList.add('gone'); requestAnimationFrame(fit); }, motion() ? 380 : 0);
    }
    sfx.play(m.kind === 'half' ? 'snip' : 'ring');
    renderJokers();
  }

  /* ---------------------------------------------------------- The Candidate : épreuve de code */
  function wireCode(q) {
    const ed = $('#code'), out = $('#cout');
    if (!ed) return;
    setTimeout(() => { try { ed.focus({ preventScroll: true }); ed.setSelectionRange(ed.value.length, ed.value.length); } catch (e) {} }, 60);
    // couleurs et numéros de ligne : une couche dessinée sous la zone de saisie (transparente), qui suit le défilement
    const hl = $('#chl'), gut = $('#cgut');
    const paint = () => {
      hl.innerHTML = highlightPy(ed.value) + '\n';
      gut.textContent = Array.from({ length: ed.value.split('\n').length }, (_, k) => k + 1).join('\n');
      draft = { idx: S.idx, code: ed.value };
    };
    const follow = () => { hl.parentNode.scrollTop = ed.scrollTop; hl.parentNode.scrollLeft = ed.scrollLeft; gut.scrollTop = ed.scrollTop; };
    paint();
    ed.addEventListener('input', () => { paint(); follow(); });
    ed.addEventListener('scroll', follow);
    ed.addEventListener('keydown', (e) => {
      // Tab indente (4 espaces), Entrée garde l'indentation, Ctrl/Cmd+Entrée envoie
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); ed.setRangeText('    ', ed.selectionStart, ed.selectionEnd, 'end'); paint(); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); }
      else if (e.key === 'Enter') {
        const line = ed.value.slice(0, ed.selectionStart).split('\n').pop();
        const ind = (line.match(/^\s*/) || [''])[0] + (/:\s*$/.test(line) ? '    ' : '');
        if (ind) { e.preventDefault(); ed.setRangeText('\n' + ind, ed.selectionStart, ed.selectionEnd, 'end'); paint(); follow(); }
      }
    });
    const show = (html, cls = '') => { out.hidden = false; out.className = 'code-out ' + cls; out.innerHTML = html; requestAnimationFrame(fit); };
    $('#ctest').onclick = async () => {
      const b = $('#ctest'); b.disabled = true; b.textContent = '⏳ Python…';
      show('Exécution des exemples…');
      const ex = q.examples || [];
      const r = await runPython(buildProgram(ed.value, q.fn, ex));
      b.disabled = myAns != null; b.textContent = '▶ Tester les exemples';
      if (!S || S.phase !== 'question' || !out.isConnected) return;
      const lines = r.error ? [`<span class="ko">✗ ${esc(r.error)}</span>`]
        : r.tests.map((t, k) => `<span class="${t.ok ? 'ok' : 'ko'}">${t.ok ? '✓' : '✗'} ${esc(q.fn)}(${esc(ex[k][0].map(pyRepr).join(', '))}) → ${esc(t.err || t.got || '')}${t.ok ? '' : ` (attendu ${esc(pyRepr(ex[k][1]))})`}</span>`);
      show(lines.join('\n') + (r.stdout ? `\n<span class="pr">${esc(r.stdout)}</span>` : ''), r.error || r.tests.some((t) => !t.ok) ? 'bad' : 'good');
    };
    $('#csend').onclick = send;
    function send() {
      if (myAns != null || !S || S.phase !== 'question') return;
      const v = ed.value;
      if (!v.trim()) return;
      myAns = v; answer(v); sfx.play('lock');
      ed.readOnly = true; $('#csend').disabled = true; $('#ctest').disabled = true;
      const st = $('#sent'); st.hidden = false; st.className = 'sent'; st.innerHTML = '⚙️ Code envoyé : l\'hôte le passe aux tests cachés…';
    }
  }
  function codeGraded(m) {
    if (!S || m.i !== S.idx) return;
    const st = $('#sent'); if (!st) return;
    st.hidden = false; st.className = 'sent' + (m.passed === m.total ? '' : ' locked');
    st.innerHTML = m.offline ? `⚠️ ${esc(m.error)}`
      : `${m.passed === m.total ? '✅' : m.passed ? '🟡' : '❌'} <b>${m.passed} / ${m.total}</b> tests réussis${m.error ? ` · ${esc(m.error)}` : ''} <span class="dots">${(m.tests || []).map((ok) => `<i class="${ok ? 'ok' : 'ko'}"></i>`).join('')}</span>`;
    sfx.play(m.passed === m.total ? 'ok' : 'ko');
  }

  function choose(k) {
    if (!S || S.phase !== 'question' || myAns != null || !S.q.choices || k < 0 || k >= S.q.choices.length) return;
    if (iAmOut()) return;
    myAns = String(k); answer(myAns); sfx.play('lock');
    for (const b of root.querySelectorAll('[data-c]')) { b.disabled = true; b.classList.toggle('picked', Number(b.dataset.c) === k); }
    renderJokers();
    const s = $('#sent'); s.hidden = false; s.className = 'sent'; s.innerHTML = `Réponse verrouillée : <b>${S.q.isChartier ? LETTERS[k] + ' · ' : ''}${qText(S.q.choices[k])}</b> · on attend les autres…`;
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
    const s = $('#sent'); if (!s) return;
    const inp = $('#ain');
    if (inp) { inp.disabled = true; $('#asend').disabled = true; $('#aform').classList.add('locked'); }
    for (const b of root.querySelectorAll('[data-c]')) b.disabled = true;
    s.hidden = false;
    s.className = 'sent' + (locked ? ' locked' : '');
    s.innerHTML = locked ? `🔒 Raté ! Tu es bloqué pour cette question.` : `Réponse verrouillée : <b>${esc(S && S.q && S.q.choices ? S.q.choices[Number(v)] ?? v : v)}</b> · on attend les autres…`;
    if (locked) shake();
  }

  function shake() { const c = root.querySelector('.card'); if (!c || !motion()) return; c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake'); }
  function burst(node) {
    if (!node || !motion()) return;
    const r = node.getBoundingClientRect();
    const glyphs = isCh() ? ['€', '$', '▲', '%', '★'] : ['★', '✦', '+', '×', '÷'];
    const colors = isCh() ? ['#ffd27a', '#2fbf71', '#e5a93c', '#ffffff', '#7dd3a8'] : ['#ffc531', '#ff4b2b', '#2fbf71', '#2b8cff', '#ff5fa2'];
    for (let k = 0; k < 14; k++) {
      const s = el('i', 'spark', pick(glyphs));
      s.style.left = r.left + r.width / 2 + 'px'; s.style.top = r.top + r.height / 2 + 'px';
      const a = (k / 14) * Math.PI * 2, d = 70 + Math.random() * 60;
      s.style.color = colors[k % 5];
      root.appendChild(s);
      s.animate([{ transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 }, { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1.2) rotate(180deg)`, opacity: 0 }],
        { duration: 800 + Math.random() * 300, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
    }
  }
  const pick = (l) => l[Math.floor(Math.random() * l.length)];

  /* ---------------------------------------------------------- révélation */
  function chartierQuote(mine, L, limitMs) {
    let type = !mine || mine.raw == null ? 'timeout' : mine.ok ? (mine.at < limitMs * 0.35 ? 'fast' : 'ok') : mine.tags.includes('trap') ? 'trap' : mine.pts > 0 ? 'partial' : 'ko';
    if (L.final && mine && mine.raw != null && type !== 'trap') type = mine.ok ? 'finalOk' : 'finalKo';
    if (mine && L.eliminated && L.eliminated.some((e) => e.id === me.id)) type = 'out';
    const list = CHARTIER_QUOTES[type], text = list[(S.seed + L.idx * 7) % list.length];
    const label = { fast: 'IMPRESSIONNÉ', ok: 'VALIDÉ', ko: 'RATÉ', trap: 'PIÉGÉ', partial: 'À MOITIÉ', out: 'ÉLIMINÉ', timeout: 'TROP LENT', finalOk: 'OFFRE EN VUE', finalKo: 'RECALÉ' }[type]
      + (mine && mine.pts ? ` · ${mine.pts > 0 ? '+' : ''}${fmt(mine.pts)}` : '') + (mine && mine.lost ? ` · −${'♥'.repeat(mine.lost)}` : '');
    const tone = { fast: 'ok', ok: 'ok', finalOk: 'ok', partial: 'timeout', ko: 'ko', trap: 'ko', out: 'ko', finalKo: 'ko', timeout: 'timeout' }[type];
    return `<div class="chartier-quote quote-${tone}" id="verdict">
        ${pcFace('quote-avatar')}
        <div class="quote-body"><div class="quote-meta"><b>Pierre Chartier</b><span class="quote-status">${label}</span></div>
        <p class="quote-text">« ${esc(text)} »</p></div>
      </div>`;
  }

  // les 4 réponses, la bonne en vert, et qui a choisi quoi
  function candGrid(L) {
    const who = (k) => L.results.filter((r) => r.raw != null && Number(r.raw) === k).map((r) => { const p = S.players.find((x) => x.id === r.id); return p ? `<i class="dot" title="${esc(p.name)}" style="background:${esc(p.color)}"></i>` : ''; }).join('');
    const mine = L.results.find((r) => r.id === me.id), mk = mine && mine.raw != null ? Number(mine.raw) : -1;
    return `<div class="cand-choices rev">${L.choices.map((c, k) => `<div class="cchoice ${k === L.answer ? 'good' : k === mk ? 'bad' : 'dim'}${k === L.trap ? ' trap' : ''}" style="--k:${k}">
        <span class="cl">${k === L.answer ? '✓' : k === mk ? '✗' : LETTERS[k]}</span><span class="ct">${qText(c)}${k === L.trap ? '<em class="trapmark">🪤 le piège</em>' : ''}</span><span class="who">${who(k)}</span></div>`).join('')}</div>`;
  }

  function renderReveal() {
    const L = S.last, cat = CATS[L.cat], mine = L.results.find((r) => r.id === me.id);
    const h = S.history[S.history.length - 1], q = S.q || h;
    const ch = !!L.isChartier;
    if (ch) wallStreetMusic.setMode('reveal');
    const res = L.results.filter((r) => !r.out).sort((a, b) => b.pts - a.pts || (a.at ?? 1e9) - (b.at ?? 1e9));
    const elim = (L.eliminated || []).map((e) => `<div class="elim"><b>${esc(name(e.id))}</b> ${e.why === 'palier' ? `est coupé : dernier à la fin du ${esc((TIER_LABEL[L.tierEnd] || 'tour').toLowerCase())}` : 'n\'a plus de vies'} ${e.why === 'palier' ? '✂️' : '🚪'}</div>`).join('')
      + (L.tierEnd && !(L.eliminated || []).some((e) => e.why === 'palier') && !L.endEarly && L.idx + 1 < S.cfg.len ? `<div class="elim soft">Fin du ${esc((TIER_LABEL[L.tierEnd] || 'tour').toLowerCase())} : tout le monde passe</div>` : '');
    const answerHtml = L.input === 'code' ? `<div class="code-ref"><small>Une solution</small><pre>${highlightPy(L.show)}</pre></div>`
      : ch && L.input === 'choice' ? candGrid(L) : `<div class="bigans">${qText(L.show)}</div>`;
    const fast = L.results.find((r) => r.tags.includes('eclair') || (S.cfg.mode === 'eclair' && r.pts > 0));
    const recall = q.input === 'expr' ? `${qText(h.text)} 🎯` : q.input === 'choice' ? qText(h.text) : qText(h.eq === false ? h.text.replace(/\?$/, '…').replace(/ \? /, ' … ') : h.text) + (h.eq === false ? '' : ' =');
    const verdict = mine ? `<div class="verdict ${mine.ok ? 'ok' : mine.raw != null ? 'ko' : 'none'}" id="verdict">${mine.ok ? `Bravo ! +${fmt(mine.pts)}` : mine.raw != null ? (mine.pts < 0 ? `Raté… ${fmt(mine.pts)}` : 'Raté…') : 'Pas de réponse'}</div>` : '';

    stage.innerHTML = `
      <div class="card reveal${ch ? ' cand' : ''} flipin" style="--cc:${cat.color}">
        ${fast ? `<div class="buzz">⚡ <b>${esc(name(fast.id))}</b> a dégainé le premier !</div>` : ''}
        ${elim}
        <div class="qhead"><span class="cat"><i>${cat.icon}</i>${esc(ch ? h.rubric || cat.label : cat.label)}</span>${L.final ? '<span class="final">Quitte ou double</span>' : ''}<span class="qnum">${L.idx + 1} / ${S.cfg.len}</span></div>
        ${ch ? '<div class="rv-cols"><div class="rv-l">' : ''}
        ${h.fig ? `<div class="figmini">${figureSvg(h.fig)}</div>` : ''}
        <div class="qrecall">${recall}</div>
        ${answerHtml}
        ${ch ? '</div><div class="rv-r">' : verdict}
        ${mine && mine.gained ? '<div class="gotlife"><b>♥</b> Trois d\'affilée : tu récupères une vie !</div>' : ''}
        ${mine && mine.power ? `<div class="gotpower">🎁 Nouveau pouvoir : ${POWERS[mine.power].icon} <b>${esc(POWERS[mine.power].label)}</b>${mine.power === 'shield' ? ' (il te protège tout seul)' : ' : lance-le en bas à gauche !'}</div>` : ''}
        ${ch && mine && !mine.out ? chartierQuote(mine, L, (q.time || 20) * 1000) : ''}
        <div class="tip"><b>${ch ? '📊 Le décryptage' : '💡 L\'astuce'}</b>${qText(L.tip)}</div>
        <ol class="results">${res.map((r, k) => {
          const p = S.players.find((x) => x.id === r.id); if (!p) return '';
          const tags = r.tags.map((t) => `<span class="tag t-${t}">${TAGS[t]}${t === 'serie' ? ' ×' + r.streak : ''}${t === 'power' ? ' ' + POWERS[r.power].icon : ''}</span>`).join('')
            + (r.lost ? `<span class="tag t-lost">−${'♥'.repeat(r.lost)}</span>` : '');
          const raw = r.raw == null ? '—' : ch && L.input === 'choice' ? LETTERS[Number(r.raw)] || '?' : qText(describeAnswer({ ...q, input: L.input }, r.raw));
          return `<li class="${r.ok ? 'ok' : r.raw != null ? 'ko' : 'none'}" style="--k:${k}"><i class="dot" style="background:${esc(p.color)}"></i><span class="nm">${esc(p.name)}</span>
            <span class="raw">${raw}</span><span class="tm">${r.at != null ? secs(r.at) : ''}</span>${tags}<b class="gain">${r.pts > 0 ? '+' : ''}${r.pts ? fmt(r.pts) : '0'}</b></li>`;
        }).join('')}</ol>
        ${ch ? '</div></div>' : ''}
        ${S.cfg.sabotage && S.idx + 1 < S.cfg.len ? '<p class="sabhint">⚔️ C\'est le moment de saboter !</p>' : ''}
        <div class="nextbar"><i id="nbar"></i></div>
      </div>`;
    const gone = L.eliminated || [];
    if (gone.length) setTimeout(() => sfx.play(gone.some((e) => e.id === me.id) ? 'elim' : gone.some((e) => e.why === 'palier') ? 'cut' : 'elim'), 900);
    if (mine && !mine.out) {
      sfx.play(mine.ok ? (mine.tags.includes('serie') ? 'streak' : 'ok') : mine.tags.includes('trap') ? 'trap' : mine.raw != null ? 'ko' : 'lock');
      if (mine.ok) setTimeout(() => burst($('#verdict')), 250); else if (mine.raw != null) setTimeout(shake, 200);
      if (mine.power) setTimeout(() => sfx.play('streak'), 700);
      if (mine.gained) setTimeout(() => sfx.play('life'), 500);
    }
  }

  /* ---------------------------------------------------------- compte à rebours */
  function renderIntro() {
    const c = S.cfg;
    const ch = c.mode === 'chartier';
    if (ch) { wallStreetMusic.start(); wallStreetMusic.setMode('intro'); }
    stage.innerHTML = `
      <div class="card intro deal">${ch ? pcFace('pc-face big') : ''}<div class="logo-c"><span>${ch ? 'Pierre Chartier présente' : 'Tête de'}</span><b>${ch ? 'The Candidate' : 'Calcul'}</b></div>
      <p>${ch ? 'Ouverture des marchés' : esc(MODES[c.mode].label)} · ${c.len} questions · ${esc(DIFF_LABEL[c.diff])}${c.sabotage ? ' · Sabotage' : ''}</p><div class="count" id="count">3</div></div>`;
  }

  /* ---------------------------------------------------------- podium et récapitulatif */
  function recapHtml() {
    const miss = S.history.map((h) => ({ h, r: h.results.find((x) => x.id === me.id) })).filter(({ r }) => r && !r.ok && !r.out);
    if (!S.players.some((p) => p.id === me.id)) return '';
    if (!miss.length) return '<div class="recap perfect"><b>🌟 Sans faute !</b> Aucune erreur sur toute la partie.</div>';
    return `<details class="recap" ${miss.length <= 4 ? 'open' : ''}><summary><b>📒 Tes erreurs à revoir</b><span>${miss.length} question${miss.length > 1 ? 's' : ''}</span></summary>
      <ol>${miss.map(({ h, r }) => {
        const c = CATS[h.cat];
        return `<li style="--cc:${c.color}">${h.fig ? `<div class="figmini">${figureSvg(h.fig)}</div>` : ''}<div class="rq"><span class="cat sm"><i>${c.icon}</i>${esc(h.isChartier ? h.rubric || c.label : c.label)}</span><b>${qText(h.text)}</b>${h.sub && h.input !== 'choice' ? `<small>${esc(h.sub)}</small>` : ''}</div>
          <div class="ra"><span class="mine">${r.raw != null ? 'Ta réponse : <s>' + qText(describeAnswer(h, r.raw)) + '</s>' : 'Pas de réponse'}</span><span class="good">${h.input === 'code' ? `Une solution : <pre>${highlightPy(h.show)}</pre>` : `Bonne réponse : <b>${qText(h.show)}</b>`}</span></div>
          <div class="rt">💡 ${qText(h.tip)}</div></li>`;
      }).join('')}</ol></details>`;
  }

  // Le verdict final du mode The Candidate, d'après la justesse et la vitesse (indépendant de la longueur de la partie)
  function offerHtml(meP, n) {
    const acc = meP.right / n, avg = meP.right ? meP.totalMs / meP.right / 1000 : 99;
    const alone = S.players.length > 1 && !meP.out && S.players.filter((p) => !p.out).length === 1;
    const O = meP.out ? ['rejected', meP.outWhy === 'palier' ? 'COUPÉ AU PALIER' : 'PLUS DE VIES', `Éliminé à la question ${meP.outIdx + 1}`,
        meP.outWhy === 'palier' ? 'Dernier du classement à la fin du tour : Pierre Chartier ne garde que les meilleurs.' : `Trop d'erreurs${meP.traps ? ` (dont ${meP.traps} piège${meP.traps > 1 ? 's' : ''})` : ''}. Le prochain candidat attend dans le couloir.`]
      : alone ? ['top', 'EMBAUCHÉ', 'Dernier candidat debout', 'Tous les autres sont sortis. Le poste est à toi, Pierre Chartier te tend la main.']
      : acc >= 0.85 && avg < 9 ? ['top', 'OFFRE IMMÉDIATE', 'Managing Director, desk dérivés', 'Rapide, juste, imperturbable. Pierre Chartier signe ton contrat avant la fin de l\'émission.']
      : acc >= 0.7 ? ['mid', 'OFFRE VALIDÉE', 'Associate, trading quantitatif', 'Solide sous la pression. Encore un peu de vitesse et tu passes au niveau supérieur.']
      : acc >= 0.5 ? ['low', 'PÉRIODE D\'ESSAI', 'Analyste M&A junior', 'Le potentiel est là, mais trop d\'hésitations. Six mois pour faire tes preuves.']
      : ['rejected', 'CANDIDATURE REJETÉE', 'Éliminé au premier tour', 'Pas cette fois. Révise tes gammes et reviens tenter ta chance.'];
    return `<div class="verdict-banner offer-${O[0]}">${pcFace('pc-face')}<span class="offer-stamp">${O[1]}</span><h3>${O[2]}</h3>
      <p>${O[3]}</p><p class="offer-stats">${S.cfg.lives && !meP.out ? hearts(meP.lives, S.cfg.lives) + ' · ' : ''}${meP.right}/${n} justes · ${fmt(meP.score)} pts${meP.right ? ' · ' + secs(meP.totalMs / meP.right) + ' par bonne réponse' : ''}</p></div>`;
  }

  function renderOver() {
    closePick();
    const ch = S.cfg.mode === 'chartier';
    // musique des scores : version gagnante pour le premier (et pour les spectateurs), doux-amère sinon
    if (ch) { wallStreetMusic.setMode('over', { win: S.ranking[0] === me.id || !S.players.some((p) => p.id === me.id) }); wallStreetMusic.start(); }

    const rank = S.ranking.map((id) => S.players.find((p) => p.id === id)).filter(Boolean);
    const podium = [rank[1], rank[0], rank[2]];
    const meP = S.players.find((p) => p.id === me.id);
    const myPlace = S.ranking.indexOf(me.id);
    const isHost = !setupS || setupS.hostId === me.id;
    const n = S.history.length || 1;
    // questions jouées par chacun (un éliminé s'arrête avant la fin)
    const played = (p) => S.history.filter((h) => { const r = h.results.find((x) => x.id === p.id); return r && !r.out; }).length || 1;
    const catStats = meP ? Object.entries(meP.byCat).map(([k, v]) => `<span class="chip" style="--cc:${CATS[k].color}"><i>${CATS[k].icon}</i> ${esc(CATS[k].label)} : ${v.ok}/${v.n}</span>`).join('') : '';
    const sab = S.cfg.sabotage;

    stage.innerHTML = `
      <div class="card over${ch ? ' cand' : ''} deal">
        <h1>${ch ? (myPlace === 0 ? (S.players.length > 1 && S.players.filter((p) => !p.out).length === 1 ? '🏆 Dernier candidat debout' : '🏆 Meilleur candidat de la session') : 'Le verdict de Pierre Chartier') : (myPlace === 0 ? '🏆 Champion du calcul !' : myPlace > 0 ? `Tu finis ${myPlace + 1}<sup>e</sup>` : 'Fin de partie')}</h1>
        ${ch && meP ? offerHtml(meP, played(meP)) : ''}
        <div class="podium">${podium.map((p, k) => p ? `<div class="step s${[2, 1, 3][k]}" style="--pc:${esc(p.color)}">
          <div class="who"><i></i><b>${esc(p.name)}</b><span>${fmt(p.score)} pts</span></div><div class="block">${[2, 1, 3][k]}</div></div>` : '<div class="step empty"></div>').join('')}</div>
        <table class="stats"><thead><tr><th>#</th><th>Joueur</th><th>Score</th><th>Justes</th><th>Série max</th><th>Plus rapide</th><th>Temps moyen</th><th>⚡ Premier</th>${sab ? '<th>Sabotages</th>' : ''}${S.cfg.lives ? '<th>Vies</th>' : ''}</tr></thead>
          <tbody>${rank.map((p, k) => `<tr class="${p.id === me.id ? 'me' : ''}"><td>${k + 1}</td><td><i class="dot" style="background:${esc(p.color)}"></i>${esc(p.name)}</td>
            <td><b>${fmt(p.score)}</b></td><td>${p.right}/${played(p)}</td><td>${p.bestStreak}</td><td>${p.fastest != null ? secs(p.fastest) : '—'}</td>
            <td>${p.right ? secs(p.totalMs / p.right) : '—'}</td><td>${p.firsts}</td>${sab ? `<td>${p.sabSent || 0} envoyé${(p.sabSent || 0) > 1 ? 's' : ''} · ${p.sabTaken || 0} reçu${(p.sabTaken || 0) > 1 ? 's' : ''}</td>` : ''}${S.cfg.lives ? `<td class="lives">${p.out ? `${p.outWhy === 'palier' ? '✂️' : '🚪'} Q${p.outIdx + 1}` : hearts(p.lives)}</td>` : ''}</tr>`).join('')}</tbody></table>
        ${catStats && !ch ? `<div class="mycats"><b>Tes catégories</b>${catStats}</div>` : ''}
        ${meP ? `<div class="strip" aria-label="Tes réponses">${S.history.map((h, k) => { const r = h.results.find((x) => x.id === me.id); if (r && r.out) return ''; return `<i class="${r && r.ok ? 'ok' : 'ko'}" style="--k:${k}" title="${esc(h.text)} → ${esc(h.show)}"></i>`; }).join('')}</div>` : ''}
        ${recapHtml()}
        <div class="row end">${isHost ? '<button class="btn yellow big" id="bAgain">Rejouer</button>' : '<span class="waithost"><i></i>L\'hôte peut relancer une partie</span>'}<button class="btn ghost big" id="bBack">Retour au salon</button></div>
      </div>`;
    const a = $('#bAgain'); if (a) a.onclick = () => start();
    $('#bBack').onclick = () => { wallStreetMusic.stop(); exit(); };
    sfx.play('win');
    confetti();
  }

  function confetti() {
    if (!motion()) return;
    const box = el('div', 'confetti');
    const colors = ['#ff4b2b', '#ffc531', '#2b8cff', '#2fbf71', '#ff5fa2', '#fff8ea'];
    for (let k = 0; k < 90; k++) {
      const c = el('i'); c.style.left = Math.random() * 100 + '%'; c.style.background = colors[k % colors.length];
      c.style.animationDelay = Math.random() * 0.8 + 's'; c.style.animationDuration = 2 + Math.random() * 2 + 's';
      c.style.transform = `rotate(${Math.random() * 360}deg)`; box.appendChild(c);
    }
    root.appendChild(box); setTimeout(() => box.remove(), 5000);
  }

  /* ---------------------------------------------------------- transitions entre deux étapes */
  // Jouées pendant la dernière seconde de la correction : la question suivante démarre à l'heure, sans temps perdu
  function showInter(kick, title, sub, tone) {
    const o = $('#inter'); if (!o || !motion()) return;
    $('#ikick').textContent = kick; $('#ititle').textContent = title; $('#isub').textContent = sub || '';
    o.className = 'inter ' + (tone || ''); void o.offsetWidth; o.classList.add('show');
    sfx.play(tone === 'tier' || tone === 'final' ? 'sab' : 'pop');
  }
  function nextInter() {
    const n = S.idx + 1, ch = S.cfg.mode === 'chartier';
    if (n >= S.cfg.len || (S.last && S.last.endEarly)) return showInter(ch ? 'Fin de l\'entretien' : 'Fin de la partie', ch ? 'Le verdict' : 'Les résultats', '', 'end');
    const cat = CATS[S.cats && S.cats[n]] || null, final = S.cfg.finale && n === S.cfg.len - 1;
    const d = Math.max(0, DIFFS.indexOf(S.cfg.diff)), tier = ch ? chartierTier(d, n, S.cfg.len) : 0;
    const newTier = ch && n > 0 && tier !== chartierTier(d, n - 1, S.cfg.len);
    if (final) return showInter(`Question ${n + 1} / ${S.cfg.len}`, 'Quitte ou double', 'Les points comptent double', 'final');
    if (newTier) return showInter(`${'★'.repeat(tier)} Nouveau tour`, TIER_LABEL[tier], `Question ${n + 1} / ${S.cfg.len}`, 'tier');
    // The Candidate : on annonce le tour (ou l'épreuve de code) ; ailleurs, la catégorie de la question
    if (ch) return showInter(`Question ${n + 1} / ${S.cfg.len}`, S.cats[n] === 'code' ? '⌨ Épreuve de code' : TIER_LABEL[tier], S.cats[n] === 'code' ? '3 minutes, en Python' : '★'.repeat(tier), S.cats[n] === 'code' ? 'tier' : '');
    showInter(`Question ${n + 1} / ${S.cfg.len}`, cat ? `${cat.icon} ${cat.label}` : 'Question suivante', '', '');
  }

  /* ---------------------------------------------------------- horloge : barre de temps, compte à rebours */
  function frame() {
    requestAnimationFrame(frame);
    if (!S) return;
    if (S.phase === 'question' && S.q) {
      const bar = $('#tbar'), sec = $('#tsec'); if (!bar) return;
      const left = myDeadline() - now();
      const k = Math.max(0, Math.min(1, left / (S.q.time * 1000)));
      bar.style.transform = `scaleX(${k})`;
      const hurry = left < 5000 && myAns == null;
      $('#timer').classList.toggle('hurry', hurry);
      const qt = root.querySelector('.qtext'); if (qt) qt.classList.toggle('hurry', left < 3000 && myAns == null);
      const s = Math.max(0, Math.ceil(left / 1000));
      sec.textContent = s + ' s';
      if (myAns == null && s <= 3 && s > 0 && s !== lastTick) { lastTick = s; sfx.play('tick'); }
      if (S.q.isChartier) wallStreetMusic.setTension(1 - k);
      if (left <= 0 && myAns == null && !root.querySelector('.sent:not([hidden])')) {
        const st = $('#sent'); if (st) { st.hidden = false; st.className = 'sent locked'; st.textContent = '⏰ Temps écoulé !'; }
        for (const b of root.querySelectorAll('[data-c], #ain, #asend, #csend, #ctest, [data-jok]')) b.disabled = true;
        const ed = $('#code'); if (ed) ed.readOnly = true;
      }
    } else if (S.phase === 'intro') {
      const c = $('#count'); if (!c) return;
      const s = Math.ceil((S.endsAt - now()) / 1000), txt = s > 0 ? String(Math.min(3, s)) : 'Go !';
      if (c.textContent !== txt) { c.textContent = txt; c.classList.remove('pulse'); void c.offsetWidth; c.classList.add('pulse'); sfx.play(s > 0 ? 'count' : 'go'); }
    } else if (S.phase === 'reveal') {
      const b = $('#nbar'); if (b) b.style.transform = `scaleX(${Math.max(0, Math.min(1, (S.endsAt - now()) / (S.revealMs || 5200)))})`;
    }
  }
  requestAnimationFrame(frame);

  // raccourcis : 1 / 2 (ou V / F) pour les choix, 1-4 ou A-D pour The Candidate, R pour réagir, Échap pour fermer
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { toggleEmo(false); closePick(); }
    const typing = document.activeElement && ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName);
    if (typing) return;
    if (S && S.phase === 'question' && S.q && S.q.input === 'choice') {
      if (S.q.isChartier) {
        const k = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
        if (e.key.length === 1 && k >= 0) { choose(k); return; }
      } else {
        const vf = S.q.choices[0] === 'Vrai';
        const k = e.key === '1' || (vf && /^v$/i.test(e.key)) ? 0 : e.key === '2' || (vf && /^f$/i.test(e.key)) ? 1 : -1;
        if (k >= 0) { choose(k); return; }
      }
    }
    if (e.key === 'r' || e.key === 'R') toggleEmo();
  });

  return {
    setup(s) {
      if (S && S.phase !== 'over') return;
      if (!S) renderSetup(s);
      else setupS = s;
    },
    update(state, off) {
      offset = off || 0;
      const prev = S; S = state;
      root.classList.remove('noroster');
      const isChartier = state.cfg.mode === 'chartier';
      root.classList.toggle('mode-chartier', isChartier);
      $('#tmus').hidden = !isChartier;
      $('#ibrand').textContent = isChartier ? 'The Candidate' : 'Tête de Calcul';
      if (!isChartier) wallStreetMusic.stop();
      // l'épreuve de code arrive : Python se télécharge en arrière-plan dès le début de la partie
      if (!pyAsked && state.cats && state.cats.includes('code') && state.phase !== 'over') { pyAsked = true; setTimeout(preloadPython, 1500); }
      const k = state.phase + ':' + state.idx;
      const modeLabel = MODES[state.cfg.mode] ? MODES[state.cfg.mode].label : state.cfg.mode;
      const round = state.phase === 'over' ? 'Terminé' : state.idx >= 0 ? `Question ${state.idx + 1} / ${state.cfg.len}${isChartier ? '' : ' · ' + modeLabel}` : isChartier ? 'Entretien' : modeLabel;
      $('#round').textContent = round;
      if (k !== key) {
        key = k;
        if (state.phase === 'intro') { shown = {}; sabSeen = -1; interFor = -2; $('#roster').innerHTML = ''; renderIntro(); }
        else if (state.phase === 'question') renderQuestion();
        else if (state.phase === 'reveal') {
          renderReveal();
          // la transition démarre une seconde avant la question suivante (minuteur : elle part même onglet en arrière-plan)
          clearTimeout(interT);
          interT = setTimeout(() => { if (S && S.phase === 'reveal' && interFor !== S.idx) { interFor = S.idx; nextInter(); } }, Math.max(0, state.endsAt - now() - 1150));
        }
        else if (state.phase === 'over') renderOver();
      } else if (state.phase === 'question' && prev && prev.qAt !== state.qAt) renderQuestion(); // question relancée (nouvel hôte)
      renderRoster();
      renderTicker();
      renderJokers();
      // sabotages lancés depuis la dernière mise à jour (pas ceux d'avant notre arrivée)
      const sabs = state.sabs || [];
      if (sabSeen < 0) sabSeen = state.phase === 'intro' ? 0 : sabs.length;
      for (const e of sabs.slice(sabSeen)) playSabotage(e);
      sabSeen = sabs.length;
    },
    ack(m) { if (S && m.i === S.idx && m.locked) { lockInput(myAns, true); sfx.play('ko'); } },
    // réponses privées de l'hôte : joker, correction de mon code
    note(m) { if (m.t === 'jok') applyJoker(m); else if (m.t === 'graded') codeGraded(m); },
    error(msg, soft) {
      // saisie illisible : le joueur peut corriger
      if (soft && S && S.phase === 'question') {
        myAns = null;
        const i = $('#ain'); if (i) { i.disabled = false; $('#asend').disabled = false; $('#aform').classList.remove('locked'); $('#sent').hidden = true; i.focus(); }
        for (const b of root.querySelectorAll('[data-c]:not(.gone), .btn-choice')) { b.disabled = false; b.classList.remove('picked', 'selected'); }
        const ed = $('#code'); if (ed) { ed.readOnly = false; $('#csend').disabled = false; $('#ctest').disabled = false; $('#sent').hidden = true; }
        renderJokers();
      }
      toast(msg);
    },
    toast,
    emote: showEmote,
  };
}
