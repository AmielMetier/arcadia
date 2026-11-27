// Double Tempo : tenir le tempo à la barre d'espace (même pendant les silences) et cliquer les bonnes pastilles.
import { DOT_RULES, ruleById, dotNumber, soundRun } from '../engine/trials.js';
import { judge, beatScore } from '../engine/press.js';
import { at, tick } from './audio.js';
import { rgba } from './shapes.js';
import { fmtMs, fmtPct, ind, pickTip } from './run.js';

const LEAD = 4, MAX_DOTS = 3, OK = '#34D399', ERR = '#FB7185';
// Emplacements fixes sur le pourtour (en % de la scène), loin du tempo central : les pastilles ne se chevauchent jamais.
const SLOTS = [[15, 24], [36, 22], [64, 22], [85, 24], [15, 84], [36, 86], [64, 86], [85, 84], [8, 54], [92, 54]];
const dotIco = (n, on) => `<span class="ico-dot${on ? ' on' : ''}">${n}</span>`;

export const Double = {
  id: 'double', title: 'Double Tempo', color: '#A3E635',
  blurb: 'Tenir le tempo et cliquer les bonnes pastilles en même temps.',
  setup: (rng) => ({ rule: rng.pick(DOT_RULES).id }),
  steps: ({ rule }) => {
    const r = ruleById(rule), yes = [1, 2, 3, 4, 6, 7, 8, 9].find((n) => r.test(n)), no = [1, 2, 3, 4, 6, 7, 8, 9].find((n) => !r.test(n));
    return [
      ['<span class="ico-ring"></span><kbd>Espace</kbd>', 'Frapper chaque temps', 'Un appui quand l\'aiguille arrive en haut. Les quatre premiers servent à se caler.'],
      ['<span class="ico-ring off"></span>', 'Continuer pendant les silences', 'Par moments, le tempo se tait : garder le même rythme jusqu\'à son retour.'],
      [`${dotIco(yes, true)}${dotIco(no, false)}`, `Cliquer ${r.label}`, 'Avant que leur anneau se vide. Laisser les autres.'],
    ];
  },
  hint: ({ rule }) => `<kbd>Espace</kbd><span>à chaque temps</span><i class="sep"></i><span class="mouse" aria-hidden="true"></span><span>cliquer ${ruleById(rule).label}</span>`,

  create(api, setup) {
    const rule = ruleById(setup.rule), L = api.layer;
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
        const b = { t: next, iv, n: i, tol: iv / 4, lure: false, done: i < LEAD, audible, judged: i >= LEAD };
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
    // Une pastille cliquée ou expirée s'efface en montrant si c'était juste.
    function drop(d, res) {
      dots.splice(dots.indexOf(d), 1);
      if (!res) { d.el.remove(); return; }
      d.el.classList.add('gone', res); d.el.disabled = true;
      setTimeout(() => d.el.remove(), 420);
    }

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
      drop(d, d.ok ? 'ok' : 'err');
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
          for (const d of [...dots]) if (now - d.born >= d.life) { api.trial(d.ok ? 'dotmiss' : 'left', true); drop(d, d.ok ? 'err' : null); }
        }
        for (const d of dots) d.el.style.setProperty('--p', Math.max(0, 1 - (now - d.born) / d.life).toFixed(3));

        // tempo central : une aiguille fait le tour en un temps et arrive en haut sur le temps ; muette pendant les silences
        const cx = w / 2, cy = h * 0.54, RR = Math.max(84, Math.min(130, Math.min(w, h) * 0.18)), col = api.color;
        api.place(cy + RR + 86);
        const last = beats.filter((b) => b.t <= now).pop(), nb = beats.find((b) => b.t > now);
        const heard = !last || last.audible, sweep = nb && nb.audible;
        const k = last && heard ? Math.exp(-(now - last.t) * 7) : 0;
        const fl = Math.exp(-(now - flash.t) * 4);
        g.lineCap = 'round';
        g.lineWidth = 10; g.strokeStyle = 'rgba(51,65,85,0.75)';
        if (!sweep) g.setLineDash([3, 16]);
        g.beginPath(); g.arc(cx, cy, RR, 0, 6.283); g.stroke(); g.setLineDash([]);
        if (sweep) {
          const f = Math.max(0, Math.min(1, 1 - (nb.t - now) / nb.iv)), a0 = -Math.PI / 2, a1 = a0 + f * Math.PI * 2;
          g.strokeStyle = rgba(col, 0.85); g.lineWidth = 10;
          g.beginPath(); g.arc(cx, cy, RR, a0, a1); g.stroke();
          g.fillStyle = '#F8FAFC';
          g.beginPath(); g.arc(cx + Math.cos(a1) * RR, cy + Math.sin(a1) * RR, 9, 0, 6.283); g.fill();
        }
        // repère du temps, en haut
        g.fillStyle = sweep ? rgba(col, 0.6 + k * 0.4) : 'rgba(148,163,184,0.4)';
        g.beginPath(); g.arc(cx, cy - RR, 15 + (api.calm ? 0 : k * 4), 0, 6.283); g.fill();
        // disque : bat avec le tempo, se colore du résultat de la frappe
        g.fillStyle = fl > 0.05 ? rgba(flash.ok ? OK : ERR, 0.12 + fl * 0.3) : rgba(col, 0.05 + k * 0.22);
        g.beginPath(); g.arc(cx, cy, RR - 24, 0, 6.283); g.fill();
        g.textAlign = 'center'; g.textBaseline = 'middle';
        if (heard && last) {
          g.fillStyle = '#F8FAFC'; g.font = `800 ${Math.round(RR * 0.62)}px system-ui, sans-serif`;
          g.fillText(String(last.n % 4 + 1), cx, cy + 2);
        } else if (!heard) {
          g.fillStyle = '#CBD5E1'; g.font = '700 26px system-ui, sans-serif'; g.fillText('Silence', cx, cy - 12);
          g.font = '500 17px system-ui, sans-serif'; g.fillText('continuer seul', cx, cy + 18);
        }
        // mesure à quatre temps sous le cercle
        const beatIx = last && heard ? last.n % 4 : -1, dy = cy + RR + 38;
        for (let q = 0; q < 4; q++) {
          g.fillStyle = q === beatIx ? rgba(col, 0.5 + k * 0.5) : 'rgba(148,163,184,0.25)';
          g.beginPath(); g.arc(cx + (q - 1.5) * 24, dy, q === 0 ? 7 : 5.5, 0, 6.283); g.fill();
        }
      },
    };
  },

  summary: (m) => { const v = ind(m); return [['Temps de réaction (pastilles)', fmtMs(v.rt)], ['Précision rythmique', fmtPct(v.rhythm)]]; },
  tip: (errs) => pickTip(errs, {
    early: 'Pendant les silences, compter « un, deux, trois, quatre » pour garder le tempo sans accélérer.',
    late: 'Pendant les silences, garder le geste régulier : le tempo ne ralentit pas.',
    miss: 'Garder la main sur Espace et frapper chaque temps, même en regardant les pastilles.',
    dot: 'Relire la consigne en haut de l\'écran : ne cliquer que les pastilles qui la respectent.',
    dotmiss: 'Jeter un œil au pourtour juste après chaque temps frappé.',
    none: 'Garder le tempo au clavier et laisser la souris travailler seule.',
  }),
};
