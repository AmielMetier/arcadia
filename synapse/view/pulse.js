// Pulse : des signaux arrivent par quatre voies et remplissent la cible sur le temps. Frapper les bons, laisser passer les leurres.
import { pulseTarget, pulseSignal, SHAPES, COLORS } from '../engine/trials.js';
import { judge, beatScore } from '../engine/press.js';
import { at, tick } from './audio.js';
import { path2d, shapeSvg, colorHex, colorName, rgba } from './shapes.js';
import { fmtPct, ind, pickTip } from './run.js';

const LEAD = 4; // temps d'annonce, sans signal
const WAYS = [-Math.PI / 2, 0, Math.PI / 2, Math.PI]; // haut, droite, bas, gauche
const OK = '#34D399', ERR = '#FB7185';

// Deux leurres d'exemple pour la consigne : autre forme et autre couleur.
function lures(target) {
  const shapes = SHAPES.filter((s) => s !== target.shape), colors = COLORS.map((_, i) => i).filter((i) => i !== target.color);
  return [0, 1].map((k) => shapeSvg(shapes[k], colorHex(colors[k]), { size: 46 })).join('');
}

export const Pulse = {
  id: 'pulse', title: 'Pulse', color: '#38BDF8',
  blurb: 'Frapper sur le temps, laisser passer les leurres.',
  setup: (rng) => ({ target: pulseTarget(rng) }),
  steps: ({ target }) => [
    [shapeSvg(target.shape, colorHex(target.color), { size: 64, label: `${target.shape} ${colorName(target.color)}` }),
      `Frapper le ${target.shape} ${colorName(target.color)}`, 'Avec <kbd>Espace</kbd> ou un clic, au moment où il remplit la cible.'],
    [lures(target), 'Laisser passer les autres', 'Ils n\'ont ni cette forme ni cette couleur : ne rien faire.'],
    ['<span class="ico-ring"></span>', 'Pile sur le temps', 'L\'anneau se referme sur la cible à chaque temps. Les quatre premiers servent à se caler.'],
  ],
  hint: ({ target }) => `${shapeSvg(target.shape, colorHex(target.color), { size: 28 })}<span>remplit la cible : <kbd>Espace</kbd></span><i class="sep"></i><span>une autre forme : ne rien faire</span>`,

  create(api, { target }) {
    const beats = [], fx = [];
    let next = api.t0, i = 0, flash = { t: -9, ok: true };
    const firstSignal = () => beats.find((b) => b.sig);
    const burst = (t, color) => fx.push({ t, color });

    function plan(now) {
      while (next < now + 2.6) {
        const p = api.p(), iv = 60 / p.bpm;
        const b = { t: next, iv, i, tol: p.tol, done: false, res: null };
        if (i >= LEAD) { b.sig = pulseSignal(api.rng, target, p.lure); b.lure = b.sig.lure; b.way = WAYS[Math.floor(api.rng.next() * 4)]; }
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
      const sigs = beats.filter((b) => b.sig);
      const r = judge(t, sigs), b = sigs[r.i];
      if (r.verdict === 'hit') {
        b.done = true; b.res = 'hit';
        api.m.beatN++; api.m.beatSum += beatScore(r.off, b.iv);
        api.trial('hit', true); burst(t, OK);
      } else if (r.verdict === 'lure') {
        b.done = true; b.res = 'lure'; api.m.lureN++;
        api.trial('lure'); burst(t, ERR);
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
          else { b.res = 'miss'; api.m.beatN++; api.trial('miss'); flash = { t: now, ok: false }; burst(now, ERR); }
        }
        const cx = w / 2, cy = h * 0.54, R = Math.min(w * 0.42, h * 0.38);
        const TR = Math.max(54, R * 0.24), S = TR * 0.56, col = api.color;
        api.place(cy + R * 0.42, cx + R * 0.62); // entre deux voies : ne cache jamais un signal
        const last = beats.filter((b) => b.t <= now).pop(), nb = beats.find((b) => b.t > now);
        const k = last ? Math.exp(-(now - last.t) * 7) : 0;

        // voies : d'où viennent les signaux, repère un temps avant l'arrivée
        g.lineCap = 'round';
        for (const a of WAYS) {
          const c = Math.cos(a), s = Math.sin(a);
          g.strokeStyle = 'rgba(148,163,184,0.16)'; g.lineWidth = 3;
          g.beginPath(); g.moveTo(cx + c * (TR + 14), cy + s * (TR + 14)); g.lineTo(cx + c * (R + S), cy + s * (R + S)); g.stroke();
          const mx = cx + c * R / 2, my = cy + s * R / 2;
          g.strokeStyle = 'rgba(148,163,184,0.3)'; g.lineWidth = 2;
          g.beginPath(); g.moveTo(mx - s * 9, my + c * 9); g.lineTo(mx + s * 9, my - c * 9); g.stroke();
        }
        // anneau qui se referme sur la cible à chaque temps
        if (nb) {
          const f = Math.max(0, Math.min(1, 1 - (nb.t - now) / nb.iv));
          g.strokeStyle = rgba(col, 0.12 + 0.5 * f); g.lineWidth = 3;
          g.beginPath(); g.arc(cx, cy, TR + TR * 0.85 * (1 - f), 0, 6.283); g.stroke();
        }
        // cible : disque, contour qui bat, empreinte du signal à frapper
        const fl = Math.exp(-(now - flash.t) * 4);
        g.fillStyle = rgba(col, 0.08 + k * 0.12);
        g.beginPath(); g.arc(cx, cy, TR, 0, 6.283); g.fill();
        g.lineWidth = 5;
        g.strokeStyle = fl > 0.05 ? rgba(flash.ok ? OK : ERR, 0.45 + fl * 0.55) : rgba(col, 0.6 + k * 0.4);
        g.beginPath(); g.arc(cx, cy, TR + (api.calm ? 0 : k * 5), 0, 6.283); g.stroke();
        drawShape(g, target.shape, cx, cy, S, colorHex(target.color), 0.22);
        g.save(); g.translate(cx, cy); g.scale(S, S); g.setLineDash([0.16, 0.12]); g.lineWidth = 2.5 / S;
        g.strokeStyle = rgba(colorHex(target.color), 0.8); g.stroke(path2d(target.shape)); g.restore();

        // signaux : ils entrent par leur voie ; un leurre (ou un signal raté) traverse et repart de l'autre côté
        for (const b of beats) {
          if (!b.sig) continue;
          const travel = 2 * b.iv, u = (b.t - now) / travel;
          if (u > 1) continue;
          let d = R * u, a = Math.min(1, (1 - u) * 5);
          if (u < 0) {
            if (b.res === 'hit') { d = 0; a = Math.max(0, 1 - (now - b.t) / 0.25); } else a = Math.max(0, 1 + u * 2.5);
          }
          if (a <= 0) continue;
          drawShape(g, b.sig.shape, cx + Math.cos(b.way) * d, cy + Math.sin(b.way) * d, S, colorHex(b.sig.color), a);
        }
        // éclats de réussite ou d'erreur sur la cible
        for (let j = fx.length - 1; j >= 0; j--) {
          const e = fx[j], age = now - e.t;
          if (age > 0.5 || age < -0.1) { fx.splice(j, 1); continue; }
          g.strokeStyle = rgba(e.color, Math.max(0, 1 - age / 0.5)); g.lineWidth = 4;
          g.beginPath(); g.arc(cx, cy, TR + 8 + (api.calm ? 0 : Math.max(0, age) * 90), 0, 6.283); g.stroke();
        }
        // mesure à quatre temps sous la cible
        const lead = !firstSignal() || now < firstSignal().t - 2 * firstSignal().iv;
        const beatIx = last ? last.i % 4 : -1, dy = cy + TR + 34;
        for (let q = 0; q < 4; q++) {
          g.fillStyle = q === beatIx ? rgba(col, 0.5 + k * 0.5) : 'rgba(148,163,184,0.25)';
          g.beginPath(); g.arc(cx + (q - 1.5) * 24, dy, q === 0 ? 7 : 5.5, 0, 6.283); g.fill();
        }
        if (lead) {
          g.fillStyle = '#CBD5E1'; g.font = '600 18px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText('Écouter le tempo', cx, dy + 34);
        }
      },
    };
  },

  summary: (m) => { const v = ind(m); return [['Leurres évités', fmtPct(v.lure)], ['Précision rythmique', fmtPct(v.rhythm)]]; },
  tip: (errs) => pickTip(errs, {
    early: 'Laisser le signal remplir la cible : appuyer quand l\'anneau se referme, pas avant.',
    late: 'L\'anneau se referme toujours au même rythme : le suivre des yeux aide à frapper à l\'heure.',
    lure: 'Vérifier la forme avant d\'appuyer : un leurre n\'a ni la forme ni la couleur de l\'empreinte au centre.',
    miss: 'Garder un doigt prêt sur Espace et suivre chaque signal jusqu\'à la cible.',
    none: 'Pour gagner en régularité, compter les temps à voix basse.',
  }),
};

function drawShape(g, shape, x, y, r, hex, alpha) {
  g.save(); g.globalAlpha = alpha; g.translate(x, y); g.scale(r, r);
  g.fillStyle = hex; g.fill(path2d(shape));
  g.lineWidth = 3 / r; g.strokeStyle = '#0F172A'; g.stroke(path2d(shape));
  g.restore();
}
export { drawShape };
