// Démarrage de Synapse : menu, consignes, parties, Session du jour, tableau de bord, calage et réglages.
import { MODES } from './engine/levels.js';
import { GAPS } from './engine/press.js';
import { createRng } from './engine/rng.js';
import { unlock, audioState, sfx, clearQueue } from './view/audio.js';
import { createBackdrop } from './view/backdrop.js';
import { store } from './view/store.js';
import { createRun, emptyResult } from './view/run.js';
import { menuHtml, briefHtml, reportHtml, sessionHtml } from './view/screens.js';
import { showBoard } from './view/dashboard.js';
import { showCalage } from './view/calage.js';
import { Pulse } from './view/pulse.js';
import { Aiguillage } from './view/aiguillage.js';
import { Reseau } from './view/reseau.js';
import { Double } from './view/double.js';

const H = window.HubBridge || { embedded: false, on() {}, signalReady() {}, shown() {}, exit() {} };
const V = window.DDVolume;
const BY_ID = { pulse: Pulse, aiguillage: Aiguillage, reseau: Reseau, double: Double };
const LIST = MODES.map((id) => BY_ID[id]);
const FREE_DUR = 90, SESSION_DUR = 70, BRIEF_MS = 5000;
const qs = new URLSearchParams(location.search);
const seed = qs.has('seed') ? (parseInt(qs.get('seed'), 10) >>> 0) : (Math.random() * 2 ** 32) >>> 0;
let played = 0;
const rngFor = () => createRng(seed + 7919 * played++);

const $ = (s) => document.querySelector(s);
const main = $('#screen'), pauseBtn = $('#tpause'), quitBtn = $('#tquit');
const hud = { box: $('#hud'), mode: $('#hMode'), level: $('#hLevel'), levelBox: $('#hLevelBox'), score: $('#hScore'), streak: $('#hStreak'), time: $('#hTime') };
const bg = createBackdrop($('#bg'));

let leaving = false, screen = 'menu', run = null, calage = null, brief = null, session = null, report = null;

// Pensé pour 1280 × 720 : l'interface suit la fenêtre, de × 0,5 à × 2 (2560 × 1440), pour que rien ne soit coupé.
const fitZoom = () => document.documentElement.style.setProperty('--z', Math.max(0.5, Math.min(2, innerWidth / 1280, innerHeight / 720)).toFixed(3));
addEventListener('resize', fitZoom); fitZoom();

const mq = matchMedia('(prefers-reduced-motion: reduce)');
const applyCalm = () => document.body.classList.toggle('calm', store.data.settings.calm || mq.matches);
if (mq.addEventListener) mq.addEventListener('change', applyCalm);
applyCalm();

function setHud(on, title = '') {
  hud.box.hidden = !on; pauseBtn.hidden = !on;
  hud.mode.textContent = title;
}
function focusFirst(sel) { const b = main.querySelector(sel); if (b) b.focus({ preventScroll: true }); }
function leave() { brief = null; calage = null; clearQueue(); setHud(false); quitBtn.hidden = true; }
// Couleur de l'épreuve en cours (barre du haut, fond) ; celle du jeu hors épreuve.
let tint = null;
function setTint(color) { tint = color; document.body.style.setProperty('--m', color || 'var(--accent)'); }

function showMenu() {
  if (run) { const r = run; run = null; session = null; leaving = true; r.end(); leaving = false; }
  leave(); session = null; screen = 'menu'; setTint(null);
  main.innerHTML = menuHtml(LIST);
  quitBtn.hidden = !H.embedded; // dans le Hub : retour au salon, depuis le menu
  focusFirst('.card');
}

function showBrief(id) {
  leave(); screen = 'consigne';
  const M = BY_ID[id], rng = rngFor(), setup = M.setup(rng), dur = session ? SESSION_DUR : FREE_DUR;
  main.innerHTML = briefHtml(M, setup, { dur, session: session && { i: session.i, n: MODES.length } });
  brief = { M, setup, rng, dur, deadline: session ? performance.now() + BRIEF_MS : null };
  setTint(M.color);
  focusFirst('.primary');
}

function play() {
  if (!brief) return;
  const { M, setup, rng, dur } = brief;
  leave(); unlock(); screen = 'jeu';
  main.innerHTML = `<section class="stage" data-mode="${M.id}" style="--m:${M.color}">
    <canvas class="cv"></canvas><div class="layer"></div>
    <div class="tbar" aria-hidden="true"><i></i></div>
    ${M.hint ? `<p class="strip">${M.hint(setup)}</p>` : ''}
    <p class="fb" aria-live="polite"></p>
    <p class="wait" hidden>Cliquer ou appuyer sur une touche pour activer le son.</p>
    <div class="pause" hidden><div class="pause-card">
      <div class="pause-p"><h2>Pause</h2><p>Reprise sur un décompte de trois temps.</p>
        <div class="row"><button type="button" class="primary" data-go="resume">Reprendre</button><button type="button" data-go="stop">Terminer la partie</button></div></div>
      <p class="pause-count" aria-live="polite"></p></div></div></section>`;
  const st = main.querySelector('.stage');
  const els = { stage: st, canvas: st.querySelector('.cv'), layer: st.querySelector('.layer'), fb: st.querySelector('.fb'), tbar: st.querySelector('.tbar i'), wait: st.querySelector('.wait'), pause: st.querySelector('.pause'), count: st.querySelector('.pause-count'), hud };
  setHud(true, M.title);
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  run = createRun({ Mode: M, setup, dur, session: !!session, rng, els, onEnd: ended });
}

function ended(r) {
  run = null; setHud(false);
  if (leaving) return;
  if (session) {
    if (r.trials) session.results.push(r);
    nextBlock();
  } else showReport(r);
}
function nextBlock() {
  session.i++;
  if (session.i < MODES.length) showBrief(MODES[session.i]);
  else showSessionReport();
}
function showReport(r) {
  leave(); screen = 'bilan'; report = r; setTint(r.color);
  main.innerHTML = reportHtml(r);
  focusFirst('.primary');
}
function showSessionReport() {
  leave(); screen = 'session-bilan'; report = { session: session.results }; setTint(null);
  main.innerHTML = sessionHtml(session.results);
  session = null;
  focusFirst('.primary');
}
function startSession() { session = { i: 0, results: [] }; showBrief(MODES[0]); }
function openBoard() {
  if (run) return;
  leave(); session = null; screen = 'board'; setTint(null);
  main.innerHTML = '<div class="board-wrap"></div>';
  showBoard(main.firstChild, { back: () => { applyCalm(); showMenu(); } });
}
function openCalage() {
  if (run) return;
  leave(); session = null; screen = 'calage'; unlock(); setTint(null);
  calage = showCalage(main, { back: showMenu });
}

main.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (!b || screen === 'board' || screen === 'calage') return;
  const go = b.dataset.go;
  if (BY_ID[go] && screen === 'menu') showBrief(go);
  else if (go === 'session') startSession();
  else if (go === 'board') openBoard();
  else if (go === 'menu') showMenu();
  else if (go === 'start') play();
  else if (go === 'again') { if (report && report.session) startSession(); else if (report) showBrief(report.mode); }
  else if (go === 'resume' && run) { run.resume(); b.blur(); }
  else if (go === 'stop' && run) run.end();
});
$('#tset').addEventListener('click', () => { if (run) run.pause(); }); // régler met la partie en pause
quitBtn.addEventListener('click', () => H.exit());
pauseBtn.addEventListener('click', () => { if (!run) return; if (run.phase === 'play' || run.phase === 'count') run.pause(); else run.resume(); pauseBtn.blur(); });

addEventListener('pointerdown', unlock, true);
addEventListener('keydown', (e) => {
  unlock();
  if ((V && V.isOpen()) || document.querySelector('.modal')) return;
  const code = e.code || '';
  if (screen === 'jeu' && run) {
    if (run.phase === 'pause') { if (e.key === 'Escape') { e.preventDefault(); run.resume(); } return; }
    if (code === 'Space' || code === 'Enter' || code.startsWith('Arrow')) e.preventDefault();
    run.key(e);
    return;
  }
  if (screen === 'calage' && calage) { if (code === 'Space') calage.key(e); return; }
  if (e.key === 'Escape' && screen !== 'menu') { e.preventDefault(); showMenu(); return; }
  if (screen === 'menu' && code.startsWith('Arrow')) {
    const bs = [...main.querySelectorAll('.card')], i = bs.indexOf(document.activeElement);
    const d = code === 'ArrowRight' || code === 'ArrowDown' ? 1 : -1;
    e.preventDefault();
    bs[(i < 0 ? 0 : i + d + bs.length) % bs.length].focus();
  }
}, true);
addEventListener('keyup', (e) => { if (screen === 'jeu' && run && run.phase !== 'pause' && (e.code === 'Space' || e.code === 'Enter')) e.preventDefault(); }, true);
let hiddenAt = 0; // hors de l'onglet : la consigne de session attend
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { hiddenAt = performance.now(); if (run) run.pause(); }
  else if (brief && brief.deadline) brief.deadline += performance.now() - hiddenAt;
});

let lastPerf = performance.now();
function loop(perf) {
  const dt = perf - lastPerf; lastPerf = perf;
  bg.draw(perf / 1000, run ? run.streak : 0, document.body.classList.contains('calm'), tint);
  if (run) { if (V && V.isOpen() && run.phase === 'play') run.pause(); run.frame(); }
  if (calage) calage.frame();
  if (brief && brief.deadline) {
    if (V && V.isOpen()) brief.deadline += dt; // pas de départ pendant qu'on règle
    const s = Math.ceil((brief.deadline - perf) / 1000), el = main.querySelector('.brief-count');
    if (s <= 0) play();
    else if (el && el.textContent !== `Départ dans ${s}`) el.textContent = `Départ dans ${s}`;
  }
  requestAnimationFrame(loop);
}

if (V) {
  const S = () => store.data.settings;
  V.panel($('#tset'), {
    kinds: ['fx'], accent: '#38BDF8',
    test: () => { unlock(); sfx.test(); },
    sections: [{
      title: 'Confort de jeu',
      items: [
        { label: 'Filtre des doubles appuis (ms)', options: GAPS.map((g) => [g, String(g)]), get: () => S().gap, set: (v) => { S().gap = v; store.save(); } },
        { label: 'Animations réduites', get: () => S().calm, set: (v) => { S().calm = !!v; store.save(); applyCalm(); } },
        { label: 'Calage du son', options: [['go', 'Lancer le calage'], ['zero', 'Remettre à zéro']], get: () => null, hidden: () => screen === 'jeu',
          set: (v) => { if (v === 'go') { V.close(); openCalage(); } else { S().calib = 0; store.save(); } } },
        { note: () => `Décalage retranché de chaque appui : ${S().calib} ms.` },
      ],
      hint: 'Le filtre ignore, sans pénalité, un appui trop proche du précédent. Le calage compense le retard du son, par exemple avec un casque sans fil.',
    }],
  });
}

if (qs.has('debug')) {
  window.__synapse = {
    seed,
    start(mode = 'pulse') {
      unlock();
      if (mode === 'session') { if (run) return null; startSession(); return 'session'; }
      if (!BY_ID[mode]) throw new Error('mode inconnu : ' + mode + ' (pulse, aiguillage, reseau, double, session)');
      if (run) return null;
      session = null; showBrief(mode); play();
      return mode;
    },
    // Termine la partie en cours et affiche son bilan. En session : termine l'épreuve en cours (ou saute sa consigne)
    // et passe à la suivante ; après la quatrième, le bilan de session.
    end() {
      if (run) run.end();
      else if (brief && session) nextBlock();
      else if (brief) showReport(emptyResult(brief.M, false));
      return this.state();
    },
    state: () => ({
      screen, seed, audio: audioState(),
      session: session ? { block: session.i + 1, of: MODES.length, done: session.results.length } : null,
      run: run ? run.state() : null,
      report: screen === 'bilan' || screen === 'session-bilan' ? report : null,
      calage: calage ? calage.state() : null,
      levels: { ...store.data.levels }, settings: { ...store.data.settings }, games: store.data.history.length,
    }),
    menu: showMenu, board: openBoard, calibrate: openCalage,
    pause: () => run && run.pause(), resume: () => run && run.resume(),
  };
}

function boot() {
  showMenu();
  requestAnimationFrame(loop);
  H.signalReady();
  requestAnimationFrame(() => requestAnimationFrame(() => H.shown && H.shown()));
}
if (H.embedded) H.on('init', boot); else boot();
