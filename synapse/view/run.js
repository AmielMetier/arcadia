// Déroulé d'une partie : chrono, score, série, difficulté qui s'adapte, pause et reprise, bilan enregistré.
import { params, startLevel, nextSaved, newAdapt, adapt } from '../engine/levels.js';
import { filterPress } from '../engine/press.js';
import { emptyMetrics, indicators } from '../engine/stats.js';
import { dayKey } from '../engine/days.js';
import { MAX_SAMPLES } from '../engine/save.js';
import { clock, sfx, clearQueue, audioState } from './audio.js';
import { fitCanvas } from './backdrop.js';
import { store } from './store.js';

// [libellé, réussite]
const KINDS = {
  hit: ['Juste', true], avoid: ['Leurre évité', true], right: ['Juste', true], found: ['Trouvé', true],
  seq: ['Séquence complète', true], dotok: ['Bonne pastille', true], left: ['Pastille laissée', true],
  early: ['Trop tôt', false], late: ['Trop tard', false], lure: ['Leurre', false], miss: ['Manqué', false],
  wrong: ['Mauvais côté', false], slow: ['Temps écoulé', false], node: ['Mauvais nœud', false],
  odd: ['Intrus manqué', false], dot: ['Pastille à laisser', false], dotmiss: ['Pastille manquée', false],
};

export function emptyResult(Mode, session) {
  const lv = startLevel(store.data.levels[Mode.id]);
  return { mode: Mode.id, title: Mode.title, color: Mode.color, session, dur: 0, score: 0, best: 0, trials: 0, acc: 0, lv0: lv, lv1: lv, m: emptyMetrics(), errs: {}, lines: Mode.summary(emptyMetrics(), {}), tip: Mode.tip({}) };
}

export function createRun({ Mode, setup, dur, session, rng, els, onEnd }) {
  const id = Mode.id, saved = store.data.levels[id];
  const lv0 = startLevel(saved);
  let ad = newAdapt(lv0);
  const m = emptyMetrics(), errs = {}, last = {};
  let score = 0, streak = 0, best = 0, trials = 0, oks = 0, phase = 'play', count = null, fbTimer = 0;
  clock.reset(); clearQueue();
  const t0 = clock.now() + 0.8, tEnd = t0 + dur;

  function feedback(text, ok) {
    const fb = els.fb;
    fb.textContent = (ok ? '✓ ' : '✕ ') + text;
    fb.dataset.k = ok ? 'ok' : 'err';
    fb.classList.remove('show'); void fb.offsetWidth; fb.classList.add('show');
    clearTimeout(fbTimer); fbTimer = setTimeout(() => fb.classList.remove('show'), 700);
  }

  const api = {
    rng, t0, layer: els.layer, m, color: Mode.color,
    // Place le retour « Juste / Manqué » près de l'élément principal (centre en px de la scène ; x : centré par défaut).
    place(y, x) {
      const s = els.fb.style, t = Math.round(y) + 'px', l = x == null ? '' : Math.round(x) + 'px';
      if (s.top !== t) s.top = t;
      if (s.left !== l) s.left = l;
    },
    get level() { return ad.level; },
    get calm() { return document.body.classList.contains('calm'); },
    p: () => params(id, ad.level),
    // Heure de jeu d'un appui, ou null s'il est filtré (double appui, répétition automatique).
    press(e, channel) {
      const r = filterPress(last[channel] ?? null, e.timeStamp, store.data.settings.gap, e.repeat);
      if (!r.ok) return null;
      last[channel] = r.last;
      return clock.now(e.timeStamp) - store.data.settings.calib / 1000;
    },
    // quiet : pas de son de réussite (sur le temps, il couvrirait le métronome)
    trial(kind, quiet) {
      const [label, ok] = KINDS[kind];
      trials++;
      if (ok) { oks++; streak++; best = Math.max(best, streak); score += 10 + Math.min(streak, 20); if (!quiet) sfx.ok(); }
      else { errs[kind] = (errs[kind] || 0) + 1; streak = 0; score = Math.max(0, score - 5); sfx.err(); }
      const before = ad.level;
      ad = adapt(ad, ok);
      if (ad.level !== before) { const el = els.hud.levelBox; el.classList.remove('moved'); void el.offsetWidth; el.classList.add('moved'); }
      feedback(label, ok);
    },
    points(n) { score += n; },
  };
  const mode = Mode.create(api, setup);

  const pauseBox = els.pause;
  function showPause(kind) {
    pauseBox.hidden = !kind;
    pauseBox.dataset.k = kind || '';
    els.stage.classList.toggle('paused', !!kind);
    if (kind === 'pause') pauseBox.querySelector('[data-go="resume"]').focus({ preventScroll: true });
  }

  function finish() {
    if (phase === 'over') return;
    const now = clock.now();
    phase = 'over'; mode.stop(); clearQueue(); clock.reset(); showPause(null);
    for (const k of ['rt', 'sw', 'rep']) m[k] = m[k].slice(-MAX_SAMPLES).map((v) => Math.max(0, Math.round(v))); // le calage peut rendre un temps négatif
    const r = {
      mode: id, title: Mode.title, color: Mode.color, session: !!session, dur: Math.round(Math.max(0, Math.min(dur, now - t0)) * 10) / 10,
      score, best, trials, acc: trials ? Math.round(100 * oks / trials) : 0, lv0, lv1: ad.level, m, errs,
    };
    if (trials > 0) {
      store.data.levels[id] = nextSaved(saved, lv0, ad.level);
      const at = Date.now();
      store.addGame({ at, day: dayKey(new Date(at)), mode: id, dur: r.dur, score, best, acc: r.acc, trials, lv0, lv1: ad.level, session: !!session, m: { ...m, beatSum: Math.round(m.beatSum * 1000) / 1000 } });
    }
    r.lines = Mode.summary(m, mode.extra ? mode.extra() : {});
    r.tip = Mode.tip(errs);
    onEnd(r);
  }

  function setText(el, v) { const s = String(v); if (el.textContent !== s) el.textContent = s; }

  return {
    get phase() { return phase; },
    get streak() { return streak; },
    key(e) {
      if (e.key === 'Escape') { e.preventDefault(); if (phase === 'play') this.pause(); else if (phase === 'pause' || phase === 'count') { if (phase === 'count') this.pause(); else this.resume(); } return; }
      if (phase === 'play') mode.key(e);
    },
    pause() {
      if (phase !== 'play' && phase !== 'count') return;
      clock.pause(); phase = 'pause'; showPause('pause');
    },
    resume() {
      if (phase !== 'pause') return;
      const now = clock.now();
      count = clock.resume(mode.nextBeat ? mode.nextBeat(now) : null, mode.interval ? mode.interval() : 0.6);
      phase = 'count'; showPause('count');
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); // Espace ne doit pas actionner un bouton
    },
    end: finish,
    frame() {
      if (phase === 'over') return;
      const now = clock.now();
      if (phase === 'count') {
        if (!clock.paused) { phase = 'play'; showPause(null); }
        else { const k = Math.max(1, Math.min(3, 3 - Math.floor((clock.raw() - count.r0) / count.iv))); setText(els.count, clock.raw() < count.r0 ? 3 : k); }
      }
      if (phase === 'play' && now >= tEnd) { finish(); return; }
      const { g, w, h } = fitCanvas(els.canvas);
      g.clearRect(0, 0, w, h);
      mode.frame(now, g, w, h, phase === 'play');
      const hd = els.hud;
      setText(hd.level, ad.level); setText(hd.score, score); setText(hd.streak, streak);
      setText(hd.time, Math.max(0, Math.ceil(tEnd - Math.max(now, t0))) + ' s');
      els.tbar.style.transform = `scaleX(${Math.max(0, Math.min(1, (tEnd - Math.max(now, t0)) / dur)).toFixed(4)})`;
      els.wait.hidden = audioState() === 'running';
    },
    state() {
      const now = clock.now();
      return { phase, mode: id, now, level: ad.level, startLevel: lv0, score, streak, best, trials, acc: trials ? Math.round(100 * oks / trials) : 0, timeLeft: Math.max(0, Math.round((tEnd - Math.max(now, t0)) * 10) / 10), detail: mode.debug ? mode.debug(now) : null };
    },
  };
}

// Valeurs à afficher au bilan, communes à plusieurs modes.
export const fmtMs = (v) => (v == null ? '—' : `${v} ms`);
export const fmtPct = (v) => (v == null ? '—' : `${v} %`);
export const ind = (m) => indicators([{ m }]);
// Astuce : celle de l'erreur la plus fréquente, sinon celle par défaut.
export function pickTip(errs, tips) {
  let k = null, n = 0;
  for (const [kind, c] of Object.entries(errs)) if (c > n && tips[kind]) { k = kind; n = c; }
  return tips[k] || tips.none;
}
