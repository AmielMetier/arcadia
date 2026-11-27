// Double Tempo : tenir le tempo à la barre d'espace (même pendant les silences) et cliquer les bonnes pastilles.
import { DOT_RULES, ruleById, dotNumber, soundRun } from '../engine/trials.js';
import { judge, beatScore } from '../engine/press.js';
import { at, tick } from './audio.js';
import { fmtMs, fmtPct, ind, pickTip } from './run.js';

const LEAD = 4, MAX_DOTS = 3;
// Emplacements fixes sur le pourtour (en % de la scène) : les pastilles ne se chevauchent jamais.
const SLOTS = [[16, 13], [38, 13], [62, 13], [84, 13], [16, 87], [38, 87], [62, 87], [84, 87], [7, 50], [93, 50]];

export const Double = {
  id: 'double', title: 'Double Tempo',
  blurb: 'Tenir le tempo et cliquer les bonnes pastilles en même temps.',
  setup: (rng) => ({ rule: rng.pick(DOT_RULES).id }),
  rules: ({ rule }) => `
    <p>Battre le tempo avec <kbd>Espace</kbd>, un appui par temps, calé sur la pulsation.</p>
    <p>Par moments, la pulsation se tait : continuer seul, au même tempo, jusqu'à son retour.</p>
    <p>En même temps, des pastilles apparaissent sur le pourtour. Cliquer <strong>${ruleById(rule).label}</strong> avant que leur anneau se referme ; laisser les autres.</p>`,

  create(api, setup) {
    const rule = ruleById(setup.rule), L = api.layer;
    L.innerHTML = `<p class="dot-rule">Cliquer ${rule.label}</p>`;
    const beats = [], dots = [];
    let next = api.t0, i = 0, run = soundRun(api.rng), silent = 0, nextDot = 0, flash = { t: -9, ok: true };

    function plan(now) {
      while (next < now + 1.5) {
        const p = api.p(), iv = 60 / p.bpm;
        let audible = true;
        if (i >= LEAD) {
          if (silent > 0) { audible = false; silent--; if (!silent) run = soundRun(api.rng); }
          else if (--run <= 0) { silent = p.silence - 1; audible = false; if (!silent) run = soundRun(api.rng); }
        }
        const b = { t: next, iv, tol: iv / 4, lure: false, done: i < LEAD, audible, judged: i >= LEAD };
        beats.push(b);
        if (audible) { const accent = i % 4 === 0; at(next, (w) => tick(w, accent)); }
        if (i === LEAD) nextDot = next;
        next += iv; i++;
      }
      while (beats.length && beats[0].t < now - 3) beats.shift();
    }
    function spawn(now) {
      const p = api.p();
      nextDot = now + p.every;
      if (dots.length >= MAX_DOTS) return;
      const free = SLOTS.map((_, k) => k).filter((k) => !dots.some((d) => d.slot === k));
      const slot = api.rng.pick(free), n = dotNumber(api.rng, rule);
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'dot'; el.tabIndex = -1;
      el.style.left = SLOTS[slot][0] + '%'; el.style.top = SLOTS[slot][1] + '%';
      el.innerHTML = `<span>${n}</span>`;
      el.setAttribute('aria-label', 'Pastille ' + n);
      L.appendChild(el);
      dots.push({ n, ok: rule.test(n), born: now, life: p.life, slot, el });
    }
    function drop(d) { d.el.remove(); dots.splice(dots.indexOf(d), 1); }

    function tap(e) {
      const t = api.press(e, 'key');
      if (t == null) return;
      const first = beats.find((b) => b.judged);
      if (!first || t < first.t - first.iv / 2) return; // temps d'annonce
      const r = judge(t, beats.filter((b) => b.judged));
      if (r.verdict === 'hit') {
        const b = beats.filter((x) => x.judged)[r.i];
        b.done = true; api.m.beatN++; api.m.beatSum += beatScore(r.off, b.iv);
        api.trial('hit', true);
      } else api.trial(r.verdict);
      flash = { t, ok: r.verdict === 'hit' };
    }
    const onPointer = (e) => {
      const el = e.target.closest('.dot');
      if (!el || e.button !== 0) return;
      e.preventDefault();
      const d = dots.find((x) => x.el === el), t = api.press(e, 'pointer');
      if (!d || t == null) return;
      if (d.ok) { api.m.rt.push((t - d.born) * 1000); api.trial('dotok'); } else api.trial('dot');
      drop(d);
    };
    L.addEventListener('pointerdown', onPointer);

    return {
      key(e) { if (e.code === 'Space') { e.preventDefault(); tap(e); } },
      nextBeat: (now) => (beats.find((b) => b.t > now) || {}).t ?? null,
      interval: () => 60 / api.p().bpm,
      stop() { L.removeEventListener('pointerdown', onPointer); L.innerHTML = ''; },
      debug: (now) => ({ bpm: Math.round(api.p().bpm), next: (beats.find((b) => b.judged && !b.done && b.t > now) || {}).t ?? null, silent: !((beats.filter((b) => b.t <= now).pop() || { audible: true }).audible), dots: dots.map((d) => ({ n: d.n, ok: d.ok })) }),
      frame(now, g, w, h, live) {
        if (live) {
          plan(now);
          if (nextDot && now >= nextDot) spawn(now);
          for (const b of beats) if (b.judged && !b.done && now > b.t + b.tol) { b.done = true; api.m.beatN++; api.trial('miss'); flash = { t: now, ok: false }; }
          for (const d of [...dots]) if (now - d.born >= d.life) { api.trial(d.ok ? 'dotmiss' : 'left', true); drop(d); }
        }
        for (const d of dots) d.el.style.setProperty('--p', Math.max(0, 1 - (now - d.born) / d.life).toFixed(3));
        // pulsation centrale, muette pendant les silences
        const cx = w / 2, cy = h / 2;
        const last = beats.filter((b) => b.t <= now).pop();
        const heard = !last || last.audible;
        const k = last && heard ? Math.exp(-(now - last.t) * 7) : 0;
        const fl = Math.exp(-(now - flash.t) * 4);
        g.lineWidth = 4;
        if (!heard) g.setLineDash([10, 10]);
        g.strokeStyle = fl > 0.05 ? (flash.ok ? `rgba(52,211,153,${0.4 + fl * 0.6})` : `rgba(251,113,133,${0.4 + fl * 0.6})`) : `rgba(56,189,248,${heard ? 0.55 + k * 0.45 : 0.4})`;
        g.beginPath(); g.arc(cx, cy, 70 + (api.calm ? 0 : k * 8), 0, 6.283); g.stroke(); g.setLineDash([]);
        g.fillStyle = `rgba(56,189,248,${0.08 + k * 0.25})`;
        g.beginPath(); g.arc(cx, cy, 56, 0, 6.283); g.fill();
        g.fillStyle = '#CBD5E1'; g.font = '600 17px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(heard ? 'Espace sur le temps' : 'Continuer seul', cx, cy + 104);
      },
    };
  },

  summary: (m) => { const v = ind(m); return [['Temps de réaction (pastilles)', fmtMs(v.rt)], ['Précision rythmique', fmtPct(v.rhythm)]]; },
  tip: (errs) => pickTip(errs, {
    early: 'Pendant les silences, compter « un, deux, trois, quatre » pour garder le tempo sans accélérer.',
    late: 'Pendant les silences, garder le geste régulier : le tempo ne ralentit pas.',
    miss: 'Garder la main sur Espace et frapper chaque temps, même en regardant les pastilles.',
    dot: 'Relire la consigne des pastilles : ne cliquer que celles qui la respectent.',
    dotmiss: 'Jeter un œil au pourtour juste après chaque temps frappé.',
    none: 'Garder le tempo au clavier et laisser la souris travailler seule.',
  }),
};
