// Réseau : écouter et regarder une séquence de nœuds, trouver l'intrus, puis refaire la séquence dans l'ordre.
import { sequence, oddOne } from '../engine/trials.js';
import { at, sfx } from './audio.js';
import { shapeSvg, rgba } from './shapes.js';
import { fmtMs, ind, pickTip } from './run.js';

const ODD_COUNT = 5;
// Chaque nœud a sa teinte (angle d'or : voisines bien distinctes), en plus de sa note.
const hue = (i) => Math.round((i * 137.508 + 200) % 360);
const nodeColor = (i, a = 1) => `hsla(${hue(i)}, 78%, 64%, ${a})`;
const PHASES = [['show', 'Regarder'], ['odd', 'Trouver l\'intrus'], ['input', 'Refaire']];

export const Reseau = {
  id: 'reseau', title: 'Réseau', color: '#A78BFA',
  blurb: 'Refaire une séquence de nœuds après une épreuve réflexe.',
  setup: () => ({}),
  steps: () => [
    [`<span class="ico-nodes">${[0, 1, 2].map((i) => `<i style="--c:${nodeColor(i)}"${i === 1 ? ' class="on"' : ''}></i>`).join('')}</span>`,
      'Regarder la séquence', 'Des nœuds s\'allument l\'un après l\'autre, chacun avec sa couleur et sa note. Retenir l\'ordre.'],
    [`<span class="ico-odd">${shapeSvg('rond', '#F8FAFC', { size: 30 })}${shapeSvg('carré', '#F8FAFC', { size: 30 })}${shapeSvg('rond', '#F8FAFC', { size: 30 })}</span>`,
      'Trouver l\'intrus', 'Des pastilles passent un court instant : cliquer celle qui n\'a pas la même forme, ou <kbd>←</kbd> <kbd>→</kbd> puis <kbd>Entrée</kbd>.'],
    ['<kbd>Espace</kbd>', 'Refaire la séquence', 'Cliquer les nœuds dans l\'ordre, ou les flèches puis <kbd>Espace</kbd>. Chaque nœud a son délai, une erreur arrête la séquence.'],
  ],

  create(api) {
    const L = api.layer;
    L.innerHTML = `<div class="net">
      <ol class="stepper">${PHASES.map(([k, t], i) => `<li data-p="${k}"><span>${i + 1}</span>${t}</li>`).join('')}</ol>
      <p class="sr" aria-live="polite"></p>
      <div class="net-main"><div class="grid"></div><div class="odd" hidden></div></div>
      <div class="seqdots" aria-hidden="true"></div>
      <div class="timebar net-bar" aria-hidden="true"><i></i></div></div>`;
    const $ = (s) => L.querySelector(s);
    const gridEl = $('.grid'), oddEl = $('.odd'), stepEl = $('.sr'), bar = $('.net-bar i'), dotsEl = $('.seqdots');
    const stepLis = [...L.querySelectorAll('.stepper li')];
    let size = 0, cells = [], cursor = 0, dots = [];
    let phase = 'wait', phaseAt = api.t0, seq = [], lights = [], idx = 0, deadline = 0, p = api.p();
    let odd = null, oddSel = 0, oddT = 0, rounds = 0, wins = 0;

    function build(n) {
      size = n; gridEl.style.setProperty('--n', n); gridEl.classList.toggle('dense', n > 3);
      gridEl.innerHTML = Array.from({ length: n * n }, (_, i) => `<button type="button" class="node" data-i="${i}" tabindex="-1" style="--c:${nodeColor(i)}" aria-label="Nœud ${i + 1}"></button>`).join('');
      cells = [...gridEl.children]; cursor = Math.floor(n * n / 2);
    }
    function setStep(text) { if (stepEl.textContent !== text) stepEl.textContent = text; }
    function setPhase(k) {
      phase = k;
      const at = PHASES.findIndex(([x]) => x === k);
      stepLis.forEach((li, i) => { li.classList.toggle('on', i === at); li.classList.toggle('done', at > i); });
      dotsEl.classList.toggle('mine', k === 'input'); // couleurs des nœuds seulement pour ce qui est déjà refait
    }
    // Avancement de la séquence : n pastilles colorées sur seq.length.
    function fill(n, held) {
      dots.forEach((el, k) => { el.classList.toggle('on', k < n); el.classList.toggle('held', !!held); });
    }

    function startRound(now) {
      p = api.p();
      if (p.size !== size) build(p.size);
      seq = sequence(api.rng, size * size, p.len);
      dotsEl.innerHTML = seq.map((c) => `<i style="--c:${nodeColor(c)}"></i>`).join('');
      dots = [...dotsEl.children];
      const t = now + 0.5;
      lights = seq.map((c, k) => ({ c, from: t + k * p.step, to: t + k * p.step + p.step * 0.75 }));
      seq.forEach((c, k) => at(t + k * p.step, (w) => sfx.note(c, w)));
      setPhase('show'); phaseAt = t + seq.length * p.step + 0.25;
      setStep(`Séquence de ${seq.length} nœuds`);
      rounds++;
    }
    function startOdd(now) {
      odd = oddOne(api.rng, ODD_COUNT); oddSel = Math.floor(ODD_COUNT / 2); oddT = now;
      oddEl.innerHTML = odd.shapes.map((s, i) => `<button type="button" class="pill" data-i="${i}" tabindex="-1" aria-label="Pastille ${i + 1}, ${s}">${shapeSvg(s, '#F8FAFC', { size: 58 })}</button>`).join('');
      oddEl.hidden = false; gridEl.hidden = true;
      setPhase('odd'); phaseAt = now + p.flash;
      fill(seq.length, true);
      setStep('Trouver l\'intrus');
    }
    function endOdd(ok, t) {
      if (ok) { api.m.rt.push((t - oddT) * 1000); api.trial('found'); } else api.trial('odd');
      oddEl.hidden = true; oddEl.innerHTML = ''; gridEl.hidden = false;
      setPhase('input'); idx = 0; deadline = t + p.node;
      fill(0);
      setStep(`Refaire la séquence : 1 sur ${seq.length}`);
    }
    function endRound(now, ok) {
      if (ok) { wins++; api.trial('seq'); } else if (idx < seq.length) {
        lights = [{ c: seq[idx], from: now, to: now + 0.6, hint: true }];
      }
      setPhase('wait'); phaseAt = now + 0.9; setStep('');
    }
    function pick(c, t) {
      if (phase !== 'input' || t == null) return;
      cursor = c;
      if (c === seq[idx]) {
        sfx.note(c); api.points(2);
        lights = [{ c, from: t, to: t + 0.25 }];
        idx++; deadline = t + p.node; fill(idx);
        if (idx >= seq.length) endRound(t, true);
        else setStep(`Refaire la séquence : ${idx + 1} sur ${seq.length}`);
      } else { api.trial('node'); endRound(t, false); }
    }
    function choose(i, t) {
      if (phase !== 'odd' || t == null) return;
      endOdd(i === odd.odd, t);
    }

    const onPointer = (e) => {
      if (e.button !== 0) return;
      const n = e.target.closest('.node'), pl = e.target.closest('.pill');
      if (!n && !pl) return;
      e.preventDefault();
      const t = api.press(e, 'pointer');
      if (n) pick(+n.dataset.i, t); else choose(+pl.dataset.i, t);
    };
    L.addEventListener('pointerdown', onPointer);

    // Centres des nœuds dans le repère du canvas (l'interface peut être agrandie par zoom).
    function centers(cv) {
      const z = cv.currentCSSZoom || 1, b = cv.getBoundingClientRect();
      return cells.map((el) => { const r = el.getBoundingClientRect(); return [(r.left + r.width / 2 - b.left) / z, (r.top + r.height / 2 - b.top) / z]; });
    }
    function path(g, pts, list) {
      g.beginPath();
      list.forEach((c, k) => (k ? g.lineTo(...pts[c]) : g.moveTo(...pts[c])));
      g.stroke();
    }

    return {
      key(e) {
        const k = e.code, ok = k === 'Space' || k === 'Enter' || k === 'NumpadEnter';
        if (!ok && !k.startsWith('Arrow')) return;
        e.preventDefault();
        if (phase === 'odd') {
          if (k === 'ArrowLeft') oddSel = (oddSel + ODD_COUNT - 1) % ODD_COUNT;
          else if (k === 'ArrowRight') oddSel = (oddSel + 1) % ODD_COUNT;
          else if (ok) choose(oddSel, api.press(e, 'key'));
        } else if (phase === 'input') {
          const x = cursor % size, y = Math.floor(cursor / size);
          if (k === 'ArrowLeft') cursor = y * size + (x + size - 1) % size;
          else if (k === 'ArrowRight') cursor = y * size + (x + 1) % size;
          else if (k === 'ArrowUp') cursor = ((y + size - 1) % size) * size + x;
          else if (k === 'ArrowDown') cursor = ((y + 1) % size) * size + x;
          else if (ok) pick(cursor, api.press(e, 'key'));
        }
      },
      stop() { L.removeEventListener('pointerdown', onPointer); L.innerHTML = ''; },
      extra: () => ({ rounds, wins }),
      debug: () => ({ phase, seq, idx, odd: odd ? odd.odd : null, oddSel, cursor, size }),
      frame(now, g, w, h, live) {
        if (live) {
          if (phase === 'wait' && now >= phaseAt) startRound(now);
          else if (phase === 'show' && now >= phaseAt) startOdd(now);
          else if (phase === 'odd' && now >= phaseAt) endOdd(false, now);
          else if (phase === 'input' && now >= deadline) { api.trial('slow'); endRound(now, false); }
        }
        cells.forEach((el, i) => {
          const l = lights.find((x) => x.c === i && now >= x.from && now < x.to);
          el.classList.toggle('lit', !!l && !l.hint);
          el.classList.toggle('hint', !!l && !!l.hint);
          el.classList.toggle('cursor', phase === 'input' && i === cursor);
        });
        if (phase === 'odd') [...oddEl.children].forEach((el, i) => el.classList.toggle('cursor', i === oddSel));
        if (phase === 'show') fill(lights.filter((x) => now >= x.from).length);
        const frac = phase === 'input' ? (deadline - now) / p.node : phase === 'odd' ? (phaseAt - now) / p.flash : 0;
        bar.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;

        // liaisons du réseau ; le chemin de la séquence se dessine à mesure (vue, puis refaite)
        if (!cells.length || gridEl.hidden) return;
        const pts = centers(g.canvas);
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(148,163,184,0.14)'; g.lineWidth = 3;
        g.beginPath();
        pts.forEach(([x, y], i) => {
          if ((i + 1) % size) { g.moveTo(x, y); g.lineTo(...pts[i + 1]); }
          if (i + size < pts.length) { g.moveTo(x, y); g.lineTo(...pts[i + size]); }
        });
        g.stroke();
        g.lineWidth = 6;
        // pendant la séquence, seul le dernier trait reste un instant : la mémoire travaille autant qu'avant
        if (phase === 'show') for (let k = 1; k < lights.length; k++) {
          const a = now < lights[k].from ? 0 : Math.max(0, 1 - (now - lights[k].from) / (p.step * 1.2));
          if (a > 0) { g.strokeStyle = rgba(api.color, 0.6 * a); path(g, pts, [seq[k - 1], seq[k]]); }
        }
        if (phase === 'input' && idx > 1) { g.strokeStyle = rgba(api.color, 0.55); path(g, pts, seq.slice(0, idx)); }
      },
    };
  },

  summary: (m, x) => [['Temps de réaction (intrus)', fmtMs(ind(m).rt)], ['Séquences complètes', x.rounds ? `${x.wins} / ${x.rounds}` : '—']],
  tip: (errs) => pickTip(errs, {
    node: 'Associer chaque nœud à sa couleur et à sa note : la mélodie se retient mieux que les positions.',
    odd: 'Chercher l\'intrus d\'un seul regard, au centre de la rangée, sans passer d\'une pastille à l\'autre.',
    slow: 'Refaire la séquence d\'un geste continu : chaque nœud a son propre délai.',
    none: 'Suivre le chemin qui se dessine entre les nœuds : il aide à retenir l\'ordre.',
  }),
};
