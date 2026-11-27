// Aiguillage : trier la figure selon la règle active (couleur ou forme), qui change sans prévenir.
import { figure, sideOf, ruleGap } from '../engine/trials.js';
import { sfx } from './audio.js';
import { shapeSvg, SORT_COLORS } from './shapes.js';
import { fmtMs, ind, pickTip } from './run.js';

const GREY = '#CBD5E1';
const swatch = (i, size) => shapeSvg('losange', SORT_COLORS[i].hex, { size, striped: SORT_COLORS[i].striped });
const RULES = {
  color: { name: 'Couleur', ico: () => swatch(0, 30) + swatch(1, 30),
    left: () => `${swatch(0, 56)}<span>${SORT_COLORS[0].name} plein</span>`, right: () => `${swatch(1, 56)}<span>${SORT_COLORS[1].name} rayé</span>` },
  shape: { name: 'Forme', ico: () => shapeSvg('rond', GREY, { size: 30 }) + shapeSvg('carré', GREY, { size: 30 }),
    left: () => `${shapeSvg('rond', GREY, { size: 56 })}<span>rond</span>`, right: () => `${shapeSvg('carré', GREY, { size: 56 })}<span>carré</span>` },
};

export const Aiguillage = {
  id: 'aiguillage', title: 'Aiguillage', color: '#FBBF24',
  blurb: 'Trier selon la règle active, qui change sans prévenir.',
  setup: () => ({}),
  steps: () => [
    [shapeSvg('rond', SORT_COLORS[0].hex, { size: 44 }) + shapeSvg('carré', SORT_COLORS[1].hex, { size: 44, striped: true }),
      'Une figure au centre', `Un rond ou un carré, ${SORT_COLORS[0].name} plein ou ${SORT_COLORS[1].name} rayé.`],
    ['<kbd>←</kbd><kbd>→</kbd>', 'L\'envoyer du bon côté',
      'Règle <b>Couleur</b> : bleu à gauche, ambre à droite. Règle <b>Forme</b> : rond à gauche, carré à droite. Les deux côtés se cliquent aussi.'],
    [`<span class="ico-swap">${RULES.color.ico()}<i aria-hidden="true">⇄</i>${RULES.shape.ico()}</span>`, 'La règle change sans prévenir',
      'Un bandeau et un son l\'annoncent. Répondre avant que l\'anneau autour de la figure se vide.'],
  ],

  create(api) {
    const L = api.layer;
    L.innerHTML = `
      <div class="sort">
        <div class="rule" aria-live="polite"><span class="rule-ico"></span><span class="rule-tag">Règle</span><strong class="rule-name"></strong><span class="rule-new">Nouvelle règle</span></div>
        <div class="sort-row">
          <button type="button" class="side" data-side="left" tabindex="-1"><span class="side-what"></span><kbd>←</kbd></button>
          <div class="fig" aria-live="off"><div class="fig-in"></div></div>
          <button type="button" class="side" data-side="right" tabindex="-1"><span class="side-what"></span><kbd>→</kbd></button>
        </div>
      </div>`;
    const $ = (s) => L.querySelector(s);
    const ring = $('.fig'), figIn = $('.fig-in'), ruleBox = $('.rule'), sides = { left: $('[data-side="left"]'), right: $('[data-side="right"]') };
    let rule = api.rng.chance(0.5) ? 'color' : 'shape';
    let left = gap(), fig = null, figT = 0, limit = 0, nextAt = api.t0, afterSwitch = false, newUntil = -1;
    const marks = []; // reflets passagers sur les côtés : { el, cls, until }
    function gap() { const p = api.p(); return ruleGap(api.rng, p.gapMin, p.gapMax); }
    function mark(el, cls, now, d) { el.classList.add(cls); marks.push({ el, cls, until: now + d }); }
    function showRule() {
      $('.rule-name').textContent = RULES[rule].name;
      $('.rule-ico').innerHTML = RULES[rule].ico();
      sides.left.querySelector('.side-what').innerHTML = RULES[rule].left();
      sides.right.querySelector('.side-what').innerHTML = RULES[rule].right();
    }
    showRule();

    // La figure part du côté choisi (side), ou s'efface si le temps est écoulé.
    function done(now, side) {
      const s = figIn.firstElementChild;
      if (s && side) { s.classList.add('out'); s.style.setProperty('--dx', side === 'left' ? -1 : 1); setTimeout(() => s.remove(), 300); } else figIn.innerHTML = '';
      fig = null;
      if (--left <= 0) {
        rule = rule === 'color' ? 'shape' : 'color'; left = gap(); afterSwitch = true;
        showRule(); sfx.rule();
        ruleBox.classList.add('changed'); newUntil = now + 1.4;
        nextAt = now + 0.9;
      } else nextAt = now + 0.35;
    }
    function answer(side, t) {
      if (!fig || t == null) return;
      const rt = (t - figT) * 1000, want = sideOf(fig, rule);
      if (side === want) {
        api.m.rt.push(rt); (afterSwitch ? api.m.sw : api.m.rep).push(rt);
        api.trial('right'); mark(sides[side], 'ok', t, 0.35);
      } else { api.trial('wrong'); mark(sides[side], 'err', t, 0.35); mark(sides[want], 'want', t, 0.7); }
      afterSwitch = false;
      done(t, side);
    }
    const onPointer = (e) => {
      const b = e.target.closest('.side');
      if (!b || e.button !== 0) return;
      e.preventDefault();
      answer(b.dataset.side, api.press(e, 'pointer'));
    };
    L.addEventListener('pointerdown', onPointer);

    return {
      key(e) {
        if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { e.preventDefault(); answer(e.code === 'ArrowLeft' ? 'left' : 'right', api.press(e, 'key')); }
      },
      stop() { L.removeEventListener('pointerdown', onPointer); L.innerHTML = ''; },
      debug: () => ({ rule, figure: fig, expected: fig ? sideOf(fig, rule) : null }),
      frame(now, g, w, h, live) {
        if (now > newUntil) ruleBox.classList.remove('changed');
        for (let i = marks.length - 1; i >= 0; i--) if (now > marks[i].until) { marks[i].el.classList.remove(marks[i].cls); marks.splice(i, 1); }
        if (!live) return;
        if (!fig && now >= nextAt) {
          fig = figure(api.rng); figT = now; limit = api.p().time;
          const c = SORT_COLORS[fig.color];
          figIn.innerHTML = shapeSvg(fig.shape, c.hex, { size: 180, striped: c.striped, label: `${fig.shape} ${c.name}` });
        }
        if (fig && now - figT >= limit) { api.trial('slow'); mark(sides[sideOf(fig, rule)], 'want', now, 0.7); afterSwitch = false; done(now, null); }
        ring.style.setProperty('--p', fig ? Math.max(0, 1 - (now - figT) / limit).toFixed(3) : 0);
      },
    };
  },

  summary: (m) => { const v = ind(m); return [['Temps de réaction', fmtMs(v.rt)], ['Changement de règle', fmtMs(v.switch)]]; },
  tip: (errs) => pickTip(errs, {
    wrong: 'Lire le nom de la règle avant chaque réponse, surtout juste après le bandeau « Nouvelle règle ».',
    slow: 'Répondre dès que la figure apparaît : l\'anneau se vide plus vite avec le niveau.',
    none: 'Garder un œil sur le bandeau de la règle : le changement arrive sans prévenir.',
  }),
};
