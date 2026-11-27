// Pulse : des signaux convergent vers la cible et l'atteignent sur le temps. Frapper les bons, laisser passer les leurres.
import { pulseTarget, pulseSignal } from '../engine/trials.js';
import { judge, beatScore } from '../engine/press.js';
import { at, tick } from './audio.js';
import { path2d, shapeSvg, colorHex, colorName } from './shapes.js';
import { fmtPct, ind, pickTip } from './run.js';

const LEAD = 4; // temps d'annonce, sans signal

export const Pulse = {
  id: 'pulse', title: 'Pulse',
  blurb: 'Frapper sur le temps, laisser passer les leurres.',
  setup: (rng) => ({ target: pulseTarget(rng) }),
  rules: ({ target }) => `
    <p class="target">${shapeSvg(target.shape, colorHex(target.color), { size: 56, label: `${target.shape} ${colorName(target.color)}` })}
      <span>Signal à frapper : <strong>${target.shape} ${colorName(target.color)}</strong></span></p>
    <p>Appuyer sur <kbd>Espace</kbd> ou cliquer au moment où ce signal touche la cible, pile sur le temps.</p>
    <p>Laisser passer les leurres : ils n'ont ni cette forme ni cette couleur.</p>
    <p>Trop tôt, trop tard, un leurre frappé ou un signal manqué : la série retombe à zéro.</p>`,

  create(api, { target }) {
    const beats = [];
    let next = api.t0, i = 0, flash = { t: -9, ok: true };
    const firstSignal = () => beats.find((b) => b.sig);

    function plan(now) {
      while (next < now + 2.6) {
        const p = api.p(), iv = 60 / p.bpm;
        const b = { t: next, iv, i, tol: p.tol, done: false, res: null };
        if (i >= LEAD) { b.sig = pulseSignal(api.rng, target, p.lure); b.lure = b.sig.lure; b.ang = api.rng.next() * Math.PI * 2; }
        beats.push(b);
        const accent = i % 4 === 0;
        at(next, (w) => tick(w, accent));
        next += iv; i++;
      }
      while (beats.length && beats[0].t < now - 3) beats.shift();
    }

    function press(e) {
      const t = api.press(e, e.type === 'keydown' ? 'key' : 'pointer');
      if (t == null) return;
      const f = firstSignal();
      if (!f || t < f.t - f.iv / 2) return; // pendant l'annonce : rien à juger
      const r = judge(t, beats.filter((b) => b.sig));
      const b = beats.filter((x) => x.sig)[r.i];
      if (r.verdict === 'hit') {
        b.done = true; b.res = 'hit';
        api.m.beatN++; api.m.beatSum += beatScore(r.off, b.iv);
        api.trial('hit', true);
      } else if (r.verdict === 'lure') {
        b.done = true; b.res = 'lure'; api.m.lureN++;
        api.trial('lure');
      } else api.trial(r.verdict);
      flash = { t, ok: r.verdict === 'hit' };
    }
    const onPointer = (e) => { if (e.button === 0) { e.preventDefault(); press(e); } };
    api.layer.addEventListener('pointerdown', onPointer);

    return {
      key(e) { if (e.code === 'Space') { e.preventDefault(); press(e); } },
      nextBeat: (now) => (beats.find((b) => b.t > now) || {}).t ?? null,
      interval: () => 60 / api.p().bpm,
      stop() { api.layer.removeEventListener('pointerdown', onPointer); },
      debug: (now) => ({ bpm: Math.round(api.p().bpm), next: (beats.find((b) => b.sig && !b.done && b.t > now) || {}).t ?? null, lure: (beats.find((b) => b.sig && !b.done && b.t > now) || {}).lure ?? null }),
      frame(now, g, w, h, live) {
        if (live) plan(now);
        // fin de fenêtre : signal valide manqué ou leurre évité
        for (const b of beats) {
          if (!b.sig || b.done || now <= b.t + b.tol) continue;
          b.done = true;
          if (b.lure) { b.res = 'avoid'; api.m.lureN++; api.m.lureOk++; api.trial('avoid', true); }
          else { b.res = 'miss'; api.m.beatN++; api.trial('miss'); flash = { t: now, ok: false }; }
        }
        const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.42;
        const lastBeat = beats.filter((b) => b.t <= now).pop();
        const k = lastBeat ? Math.exp(-(now - lastBeat.t) * 7) : 0;
        g.setLineDash([4, 10]); g.strokeStyle = 'rgba(148,163,184,0.18)'; g.lineWidth = 1;
        g.beginPath(); g.arc(cx, cy, R, 0, 6.283); g.stroke(); g.setLineDash([]);
        // cible : un anneau qui bat avec le tempo, le signal attendu en filigrane
        const ring = 58 + (api.calm ? 0 : k * 7);
        const fl = Math.exp(-(now - flash.t) * 4);
        g.lineWidth = 4;
        g.strokeStyle = fl > 0.05 ? (flash.ok ? `rgba(52,211,153,${0.4 + fl * 0.6})` : `rgba(251,113,133,${0.4 + fl * 0.6})`) : `rgba(56,189,248,${0.55 + k * 0.45})`;
        g.beginPath(); g.arc(cx, cy, ring, 0, 6.283); g.stroke();
        drawShape(g, target.shape, cx, cy, 20, colorHex(target.color), 0.18);
        for (const b of beats) {
          if (!b.sig) continue;
          const travel = 2 * b.iv, u = (b.t - now) / travel;
          if (u > 1) continue;
          let d, a;
          if (u >= 0) { d = R * u; a = Math.min(1, (1 - u) * 4); }
          else { d = 0; a = Math.max(0, 1 - (now - b.t) / 0.35); }
          if (a <= 0) continue;
          const grow = b.res === 'hit' && !api.calm ? 1 + (now - b.t) * 1.2 : 1;
          drawShape(g, b.sig.shape, cx + Math.cos(b.ang) * d, cy + Math.sin(b.ang) * d, 24 * grow, colorHex(b.sig.color), a);
        }
      },
    };
  },

  summary: (m) => { const v = ind(m); return [['Leurres évités', fmtPct(v.lure)], ['Précision rythmique', fmtPct(v.rhythm)]]; },
  tip: (errs) => pickTip(errs, {
    early: 'Laisser le signal toucher la cible : appuyer avec le battement, pas avant.',
    late: 'Le battement est régulier : le compter à l\'avance aide à frapper à l\'heure.',
    lure: 'Vérifier la forme avant d\'appuyer : un leurre n\'a ni la forme ni la couleur annoncées.',
    miss: 'Garder un doigt prêt sur Espace et suivre chaque signal jusqu\'à la cible.',
    none: 'Pour gagner en régularité, compter les temps à voix basse.',
  }),
};

function drawShape(g, shape, x, y, r, hex, alpha) {
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(r, r);
  g.fillStyle = hex; g.fill(path2d(shape));
  g.lineWidth = 2 / r; g.strokeStyle = '#0F172A'; g.stroke(path2d(shape));
  g.restore();
}
export { drawShape };
