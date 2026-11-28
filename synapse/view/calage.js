// Calage du son : frapper 8 temps avec le métronome ; le décalage médian est retranché ensuite de chaque appui.
import { calibrate, filterPress } from '../engine/press.js';
import { clock, at, tick, clearQueue } from './audio.js';
import { store } from './store.js';

const BPM = 90, LEAD = 4, TAPS = 8;

export function showCalage(root, { back }) {
  root.innerHTML = `<section class="calib"><h2>Calage du son</h2>
    <p>Après les ${LEAD} temps d'annonce, appuyer sur <kbd>Espace</kbd> ou cliquer le cercle sur chacun des ${TAPS} temps suivants, en suivant le son plutôt que l'image.</p>
    <button type="button" class="calib-ring" tabindex="-1" aria-label="Frapper ici"><span></span></button>
    <p class="calib-count" aria-live="polite"></p><p class="calib-res" role="status"></p>
    <div class="row"><button type="button" class="primary" data-go="restart">Recommencer</button><button type="button" data-go="menu">Menu</button></div></section>`;
  const ring = root.querySelector('.calib-ring'), countEl = root.querySelector('.calib-count'), res = root.querySelector('.calib-res');
  let beats = [], offs = new Map(), end = 0, done = false, last = null;

  function start() {
    clock.reset(); clearQueue();
    const iv = 60 / BPM, t0 = clock.now() + 0.6;
    beats = Array.from({ length: LEAD + TAPS }, (_, k) => t0 + k * iv);
    beats.forEach((t, k) => at(t, (w) => tick(w, k % 4 === 0)));
    offs = new Map(); end = beats[beats.length - 1] + iv; done = false; last = null;
    res.textContent = '';
  }
  // Écart brut, sans le calage actuel : c'est lui qu'on mesure.
  function press(e) {
    const f = filterPress(last, e.timeStamp, store.data.settings.gap, e.repeat);
    if (done || !f.ok) return;
    last = f.last;
    const t = clock.now(e.timeStamp), iv = 60 / BPM;
    let k = LEAD, d = Infinity;
    for (let j = LEAD; j < beats.length; j++) if (Math.abs(t - beats[j]) < d) { d = Math.abs(t - beats[j]); k = j; }
    if (d < iv / 2 && !offs.has(k)) offs.set(k, (t - beats[k]) * 1000);
  }
  function finish() {
    done = true;
    const c = calibrate([...offs.values()]);
    if (c == null) { res.textContent = 'Pas assez de frappes (5 au minimum) : recommencer.'; return; }
    store.data.settings.calib = c; store.save();
    res.textContent = `Décalage mesuré : ${c > 0 ? '+' : ''}${c} ms. Il sera retranché de chaque appui.`;
  }
  ring.addEventListener('pointerdown', (e) => { if (e.button === 0) { e.preventDefault(); press(e); } });
  root.querySelector('.row').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b && b.dataset.go === 'restart') start();
    if (b && b.dataset.go === 'menu') { clearQueue(); back(); }
  });
  start();
  root.querySelector('[data-go="restart"]').blur();

  return {
    key(e) { if (e.code === 'Space') { e.preventDefault(); press(e); } },
    frame() {
      const now = clock.now();
      if (!done && now > end) finish();
      const lastBeat = beats.filter((t) => t <= now).length;
      const k = lastBeat ? Math.exp(-(now - beats[lastBeat - 1]) * 7) : 0;
      ring.style.setProperty('--k', k.toFixed(3));
      countEl.textContent = done ? '' : lastBeat <= LEAD ? `Annonce : ${lastBeat} / ${LEAD}` : `Temps ${lastBeat - LEAD} / ${TAPS} · ${offs.size} frappe${offs.size > 1 ? 's' : ''} comptée${offs.size > 1 ? 's' : ''}`;
    },
    state: () => { const now = clock.now(); return { done, taps: offs.size, calib: store.data.settings.calib, now, next: beats.find((t) => t > now) ?? null }; },
  };
}
