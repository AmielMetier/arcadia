// Aiguillage : trier la figure selon la règle active (couleur ou forme), qui change sans prévenir.
import { figure, sideOf, ruleGap } from '../engine/trials.js';
import { sfx } from './audio.js';
import { shapeSvg, SORT_COLORS } from './shapes.js';
import { fmtMs, ind, pickTip } from './run.js';

const RULES = {
  color: { name: 'Couleur', left: () => swatch(0), right: () => swatch(1) },
  shape: { name: 'Forme', left: () => `${shapeSvg('rond', '#CBD5E1', { size: 34 })}<span>rond</span>`, right: () => `${shapeSvg('carré', '#CBD5E1', { size: 34 })}<span>carré</span>` },
};
function swatch(i) {
  const c = SORT_COLORS[i];
  return `${shapeSvg('losange', c.hex, { size: 34, striped: c.striped })}<span>${c.name} ${c.striped ? 'rayé' : 'plein'}</span>`;
}
const words = (rule) => (rule === 'color' ? ['bleu plein', 'ambre rayé'] : ['rond', 'carré']);

export const Aiguillage = {
  id: 'aiguillage', title: 'Aiguillage',
  blurb: 'Trier selon la règle active, qui change sans prévenir.',
  setup: () => ({}),
  rules: () => `
    <p>Une figure apparaît : un rond ou un carré, ${SORT_COLORS[0].name} plein ou ${SORT_COLORS[1].name} rayé.</p>
    <p>Règle <strong>Couleur</strong> : <kbd>←</kbd> pour bleu plein, <kbd>→</kbd> pour ambre rayé.
       Règle <strong>Forme</strong> : <kbd>←</kbd> pour rond, <kbd>→</kbd> pour carré.</p>
    <p>La règle change sans prévenir : un bandeau « Nouvelle règle » et un son l'annoncent. Répondre avant la fin de la barre de temps.</p>
    <p>Les deux grands boutons se cliquent aussi.</p>`,

  create(api) {
    const L = api.layer;
    L.innerHTML = `
      <div class="sort">
        <div class="rule" aria-live="polite"><span class="rule-tag">Règle</span><strong class="rule-name"></strong><span class="rule-new">Nouvelle règle</span></div>
        <p class="rule-map"></p>
        <div class="sort-row">
          <button type="button" class="side" data-side="left" tabindex="-1"><kbd>←</kbd><span class="side-what"></span></button>
          <div class="fig" aria-live="off"></div>
          <button type="button" class="side" data-side="right" tabindex="-1"><kbd>→</kbd><span class="side-what"></span></button>
        </div>
        <div class="timebar" aria-hidden="true"><i></i></div>
      </div>`;
    const $ = (s) => L.querySelector(s);
    const figEl = $('.fig'), bar = $('.timebar i'), ruleBox = $('.rule');
    let rule = api.rng.chance(0.5) ? 'color' : 'shape';
    let left = gap(), fig = null, figT = 0, limit = 0, nextAt = api.t0, afterSwitch = false, newUntil = -1;
    function gap() { const p = api.p(); return ruleGap(api.rng, p.gapMin, p.gapMax); }
    function showRule() {
      $('.rule-name').textContent = RULES[rule].name;
      const [a, b] = words(rule);
      $('.rule-map').textContent = `gauche = ${a} / droite = ${b}`;
      L.querySelector('[data-side="left"] .side-what').innerHTML = RULES[rule].left();
      L.querySelector('[data-side="right"] .side-what').innerHTML = RULES[rule].right();
    }
    showRule();

    function done(now) {
      fig = null; figEl.innerHTML = '';
      if (--left <= 0) {
        rule = rule === 'color' ? 'shape' : 'color'; left = gap(); afterSwitch = true;
        showRule(); sfx.rule();
        ruleBox.classList.add('changed'); newUntil = now + 1.4;
        nextAt = now + 0.9;
      } else nextAt = now + 0.35;
    }
    function answer(side, t) {
      if (!fig || t == null) return;
      const rt = (t - figT) * 1000;
      if (side === sideOf(fig, rule)) {
        api.m.rt.push(rt); (afterSwitch ? api.m.sw : api.m.rep).push(rt);
        api.trial('right');
      } else api.trial('wrong');
      afterSwitch = false;
      done(t);
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
        if (!live) return;
        if (!fig && now >= nextAt) {
          fig = figure(api.rng); figT = now; limit = api.p().time;
          const c = SORT_COLORS[fig.color];
          figEl.innerHTML = shapeSvg(fig.shape, c.hex, { size: 190, striped: c.striped, label: `${fig.shape} ${c.name}` });
        }
        if (fig && now - figT >= limit) { api.trial('slow'); afterSwitch = false; done(now); }
        bar.style.transform = `scaleX(${fig ? Math.max(0, 1 - (now - figT) / limit) : 0})`;
      },
    };
  },

  summary: (m) => { const v = ind(m); return [['Temps de réaction', fmtMs(v.rt)], ['Changement de règle', fmtMs(v.switch)]]; },
  tip: (errs) => pickTip(errs, {
    wrong: 'Lire le nom de la règle avant chaque réponse, surtout juste après le bandeau « Nouvelle règle ».',
    slow: 'Répondre dès que la figure apparaît : la barre de temps raccourcit avec le niveau.',
    none: 'Garder un œil sur le bandeau de la règle : le changement arrive sans prévenir.',
  }),
};
