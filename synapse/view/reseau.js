// Réseau : écouter et regarder une séquence de nœuds, trouver l'intrus, puis refaire la séquence dans l'ordre.
import { sequence, oddOne } from '../engine/trials.js';
import { at, sfx } from './audio.js';
import { shapeSvg } from './shapes.js';
import { fmtMs, ind, pickTip } from './run.js';

const ODD_COUNT = 5;

export const Reseau = {
  id: 'reseau', title: 'Réseau',
  blurb: 'Refaire une séquence de nœuds après une épreuve réflexe.',
  setup: () => ({}),
  rules: () => `
    <p>Des nœuds s'allument l'un après l'autre, chacun avec sa note. Retenir l'ordre.</p>
    <p>Puis des pastilles apparaissent un court instant : une seule a une autre forme. La cliquer, ou la choisir avec <kbd>←</kbd> <kbd>→</kbd> et <kbd>Entrée</kbd>.</p>
    <p>Enfin, refaire la séquence : cliquer les nœuds, ou déplacer le curseur avec les flèches et valider avec <kbd>Espace</kbd> ou <kbd>Entrée</kbd>.</p>
    <p>Chaque nœud a un temps limité. Un mauvais nœud ou un temps écoulé arrête la séquence.</p>`,

  create(api) {
    const L = api.layer;
    L.innerHTML = '<div class="net"><p class="net-step" aria-live="polite"></p><div class="grid"></div><div class="odd" hidden></div><div class="timebar net-bar" aria-hidden="true"><i></i></div></div>';
    const gridEl = L.querySelector('.grid'), oddEl = L.querySelector('.odd'), stepEl = L.querySelector('.net-step'), bar = L.querySelector('.net-bar i');
    let size = 0, cells = [], cursor = 0;
    let phase = 'wait', phaseAt = api.t0, seq = [], lights = [], idx = 0, deadline = 0, p = api.p();
    let odd = null, oddSel = 0, oddT = 0, rounds = 0, wins = 0;

    function build(n) {
      size = n; gridEl.style.setProperty('--n', n); gridEl.classList.toggle('dense', n > 3);
      gridEl.innerHTML = Array.from({ length: n * n }, (_, i) => `<button type="button" class="node" data-i="${i}" tabindex="-1" aria-label="Nœud ${i + 1}"></button>`).join('');
      cells = [...gridEl.children]; cursor = Math.floor(n * n / 2);
    }
    function setStep(text) { if (stepEl.textContent !== text) stepEl.textContent = text; }

    function startRound(now) {
      p = api.p();
      if (p.size !== size) build(p.size);
      seq = sequence(api.rng, size * size, p.len);
      const t = now + 0.5;
      lights = seq.map((c, k) => ({ c, from: t + k * p.step, to: t + k * p.step + p.step * 0.75 }));
      seq.forEach((c, k) => at(t + k * p.step, (w) => sfx.note(c, w)));
      phase = 'show'; phaseAt = t + seq.length * p.step + 0.25;
      setStep(`Séquence de ${seq.length} nœuds`);
      rounds++;
    }
    function startOdd(now) {
      odd = oddOne(api.rng, ODD_COUNT); oddSel = Math.floor(ODD_COUNT / 2); oddT = now;
      oddEl.innerHTML = odd.shapes.map((s, i) => `<button type="button" class="pill" data-i="${i}" tabindex="-1" aria-label="Pastille ${i + 1}, ${s}">${shapeSvg(s, '#F8FAFC', { size: 46 })}</button>`).join('');
      oddEl.hidden = false; gridEl.hidden = true;
      phase = 'odd'; phaseAt = now + p.flash;
      setStep('Trouver l\'intrus');
    }
    function endOdd(ok, t) {
      if (ok) { api.m.rt.push((t - oddT) * 1000); api.trial('found'); } else api.trial('odd');
      oddEl.hidden = true; oddEl.innerHTML = ''; gridEl.hidden = false;
      phase = 'input'; idx = 0; deadline = t + p.node;
      setStep(`Refaire la séquence : 1 / ${seq.length}`);
    }
    function endRound(now, ok) {
      if (ok) { wins++; api.trial('seq'); } else if (idx < seq.length) {
        lights = [{ c: seq[idx], from: now, to: now + 0.6, hint: true }];
      }
      phase = 'wait'; phaseAt = now + 0.9; setStep('');
    }
    function pick(c, t) {
      if (phase !== 'input' || t == null) return;
      cursor = c;
      if (c === seq[idx]) {
        sfx.note(c); api.points(2);
        lights = [{ c, from: t, to: t + 0.25 }];
        idx++; deadline = t + p.node;
        if (idx >= seq.length) endRound(t, true);
        else setStep(`Refaire la séquence : ${idx + 1} / ${seq.length}`);
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
        const frac = phase === 'input' ? (deadline - now) / p.node : phase === 'odd' ? (phaseAt - now) / p.flash : 0;
        bar.style.transform = `scaleX(${Math.max(0, Math.min(1, frac))})`;
      },
    };
  },

  summary: (m, x) => [['Temps de réaction (intrus)', fmtMs(ind(m).rt)], ['Séquences complètes', x.rounds ? `${x.wins} / ${x.rounds}` : '—']],
  tip: (errs) => pickTip(errs, {
    node: 'Fredonner les notes pendant la séquence aide à retenir l\'ordre.',
    odd: 'Chercher l\'intrus d\'un seul regard, au centre de la rangée, sans passer d\'une pastille à l\'autre.',
    slow: 'Refaire la séquence d\'un geste continu : chaque nœud a son propre délai.',
    none: 'Associer chaque nœud à sa note : la mélodie se retient mieux que les positions.',
  }),
};
