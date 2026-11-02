// pokemon/view/fx.js
// Animations de combat du tournoi : lancer de Poké Ball, rappel, attaques (élan, projectile, impact),
// cible touchée qui clignote, K.O., flèches de stats, effets de statut, soins.
// Tout se dessine dans le calque d'effets de l'arène, en coordonnées de la scène (avant mise à l'échelle).

const BALL = 'assets/poke-ball.png';
const STATUS_COLORS = { burn: '#f08030', paralysis: '#f8d030', poison: '#a040a0', toxic: '#7a2a8a', freeze: '#98d8d8', sleep: '#a8a8b8' };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function createFx({ inner, layer, scale }) {
  // Centre d'un élément dans la scène (en pixels de la scène, indépendants de la taille de la fenêtre)
  function center(el, dy = 0) {
    const r = el.getBoundingClientRect();
    const ri = inner.getBoundingClientRect();
    const k = scale() || 1;
    return { x: (r.left + r.width / 2 - ri.left) / k, y: (r.top + r.height / 2 - ri.top) / k + dy, w: r.width / k, h: r.height / k };
  }

  function spawn(cls, x, y, style = {}) {
    const d = document.createElement('div');
    d.className = `fx ${cls}`;
    d.style.left = `${x}px`;
    d.style.top = `${y}px`;
    Object.assign(d.style, style);
    layer.appendChild(d);
    return d;
  }

  const done = (anim, el) => anim.finished.then(() => el && el.remove()).catch(() => el && el.remove());

  /** Lancer de Poké Ball depuis le bord de l'écran jusqu'au socle, puis éclair blanc. */
  async function throwBall(sprite, fromBottom) {
    const to = center(sprite, sprite.offsetHeight ? 0 : 0);
    const W = inner.offsetWidth;
    const from = fromBottom ? { x: -20, y: to.y + 40 } : { x: W + 20, y: to.y - 60 };
    const ball = document.createElement('img');
    ball.src = BALL;
    ball.className = 'fx fx-ball';
    layer.appendChild(ball);
    const mid = { x: (from.x + to.x) / 2, y: Math.min(from.y, to.y) - 90 };
    const a = ball.animate([
      { transform: `translate(${from.x}px, ${from.y}px) rotate(0deg)` },
      { transform: `translate(${mid.x}px, ${mid.y}px) rotate(${fromBottom ? 360 : -360}deg)`, offset: 0.5 },
      { transform: `translate(${to.x}px, ${to.y}px) rotate(${fromBottom ? 720 : -720}deg)` },
    ], { duration: 560, easing: 'linear' });
    await a.finished.catch(() => {});
    ball.remove();
    flash(to.x, to.y);
  }

  function flash(x, y, color = '#ffffff', size = 150) {
    const f = spawn('fx-flash', x, y, { width: `${size}px`, height: `${size}px`, background: `radial-gradient(circle, ${color} 0 30%, transparent 70%)` });
    done(f.animate([{ transform: 'translate(-50%, -50%) scale(0.2)', opacity: 1 }, { transform: 'translate(-50%, -50%) scale(1.4)', opacity: 0 }], { duration: 420, easing: 'ease-out' }), f);
  }

  /** Le Pokémon sort de la Poké Ball : silhouette blanche qui grandit puis reprend ses couleurs. */
  function appear(sprite) {
    sprite.classList.remove('fx-hidden', 'fainted', 'anim-enter', 'anim-faint');
    sprite.style.opacity = '';
    return sprite.animate([
      { transform: 'translateX(-50%) scale(0.1)', filter: 'brightness(0) invert(1)', opacity: 0.4 },
      { transform: 'translateX(-50%) scale(1.08)', filter: 'brightness(0) invert(1)', opacity: 1, offset: 0.55 },
      { transform: 'translateX(-50%) scale(1)', filter: 'none', opacity: 1 },
    ], { duration: 520, easing: 'ease-out' }).finished.catch(() => {});
  }

  /** Rappel : le Pokémon devient rouge et rétrécit dans sa Poké Ball. */
  async function recall(sprite) {
    await sprite.animate([
      { transform: 'translateX(-50%) scale(1)', filter: 'none', opacity: 1 },
      { transform: 'translateX(-50%) scale(1)', filter: 'brightness(0.6) sepia(1) saturate(8) hue-rotate(-50deg)', opacity: 1, offset: 0.3 },
      { transform: 'translateX(-50%) scale(0.05)', filter: 'brightness(0.6) sepia(1) saturate(8) hue-rotate(-50deg)', opacity: 0 },
    ], { duration: 420, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    sprite.getAnimations().forEach((an) => an.cancel());
    sprite.classList.add('fx-hidden');
  }

  /** Élan de l'attaquant vers sa cible. */
  function lunge(sprite, towardsTop) {
    const dx = towardsTop ? 34 : -34;
    const dy = towardsTop ? -22 : 18;
    return sprite.animate([
      { transform: 'translateX(-50%)' },
      { transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(1.06)`, offset: 0.45 },
      { transform: 'translateX(-50%)' },
    ], { duration: 340, easing: 'ease-in-out' }).finished.catch(() => {});
  }

  /** Orbe d'énergie de la couleur du type, de l'attaquant vers la cible. */
  async function projectile(fromEl, toEl, color) {
    const a = center(fromEl, -10);
    const b = center(toEl, -10);
    const orb = spawn('fx-orb', 0, 0, { background: `radial-gradient(circle, #fff 0 22%, ${color} 45%, transparent 72%)` });
    const trail = [];
    for (let i = 0; i < 3; i++) {
      const t = spawn('fx-orb small', 0, 0, { background: `radial-gradient(circle, ${color} 0 40%, transparent 70%)` });
      trail.push(t);
      done(t.animate([
        { transform: `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) scale(0.6)`, opacity: 0.8 },
        { transform: `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) scale(0.3)`, opacity: 0 },
      ], { duration: 420, delay: 60 * (i + 1), easing: 'ease-in' }), t);
    }
    await orb.animate([
      { transform: `translate(${a.x}px, ${a.y}px) translate(-50%, -50%) scale(0.4)` },
      { transform: `translate(${b.x}px, ${b.y}px) translate(-50%, -50%) scale(1.1)` },
    ], { duration: 420, easing: 'ease-in' }).finished.catch(() => {});
    orb.remove();
  }

  /** Impact sur la cible : étoile de la couleur du type et éclats. */
  function impact(toEl, color, big = false) {
    const c = center(toEl, -10);
    const star = spawn('fx-star', c.x, c.y, { background: color });
    done(star.animate([
      { transform: 'translate(-50%, -50%) scale(0.2) rotate(0deg)', opacity: 1 },
      { transform: `translate(-50%, -50%) scale(${big ? 1.5 : 1.1}) rotate(25deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(-50%, -50%) scale(${big ? 1.8 : 1.3}) rotate(40deg)`, opacity: 0 },
    ], { duration: 420, easing: 'ease-out' }), star);
    const n = big ? 8 : 5;
    for (let i = 0; i < n; i++) {
      const ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      const dist = 50 + Math.random() * 40;
      const p = spawn('fx-chip', c.x, c.y, { background: i % 2 ? '#fff' : color });
      done(p.animate([
        { transform: 'translate(-50%, -50%)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(ang) * dist}px), calc(-50% + ${Math.sin(ang) * dist}px))`, opacity: 0 },
      ], { duration: 380 + Math.random() * 120, easing: 'ease-out' }), p);
    }
  }

  /** Étincelles autour d'un Pokémon (capacités de statut, soins). */
  function sparkles(el, color, rising = true) {
    const c = center(el, -10);
    for (let i = 0; i < 10; i++) {
      const x = c.x + (Math.random() - 0.5) * c.w * 0.8;
      const y = c.y + (Math.random() - 0.2) * c.h * 0.6;
      const s = spawn('fx-spark', x, y, { background: i % 3 === 0 ? '#fff' : color });
      done(s.animate([
        { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
        { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, offset: 0.3 },
        { transform: `translate(-50%, ${rising ? -60 : 30}px) scale(0.4)`, opacity: 0 },
      ], { duration: 700, delay: i * 45, easing: 'ease-out' }), s);
    }
  }

  /** Cible touchée : clignote trois fois et tremble. */
  function blink(sprite) {
    return sprite.animate([
      { opacity: 1, transform: 'translateX(-50%)' },
      { opacity: 0, transform: 'translateX(calc(-50% - 6px))', offset: 0.16 },
      { opacity: 1, transform: 'translateX(calc(-50% + 6px))', offset: 0.33 },
      { opacity: 0, transform: 'translateX(calc(-50% - 4px))', offset: 0.5 },
      { opacity: 1, transform: 'translateX(calc(-50% + 4px))', offset: 0.66 },
      { opacity: 0, transform: 'translateX(-50%)', offset: 0.83 },
      { opacity: 1, transform: 'translateX(-50%)' },
    ], { duration: 440, easing: 'steps(1, end)' }).finished.catch(() => {});
  }

  /** Secousse de toute la scène (coup critique, super efficace). */
  function shake(strength = 6) {
    inner.animate([
      { translate: '0 0' }, { translate: `${strength}px -${strength / 2}px` }, { translate: `-${strength}px ${strength / 2}px` },
      { translate: `${strength / 2}px 0` }, { translate: '0 0' },
    ], { duration: 300, easing: 'linear', composite: 'add' });
  }

  /** K.O. : le Pokémon s'enfonce sous son socle. */
  async function faint(sprite) {
    await sprite.animate([
      { transform: 'translateX(-50%) translateY(0)', clipPath: 'inset(0 0 0 0)', opacity: 1 },
      { transform: 'translateX(-50%) translateY(100%)', clipPath: 'inset(0 0 100% 0)', opacity: 1 },
    ], { duration: 650, easing: 'ease-in', fill: 'forwards' }).finished.catch(() => {});
    sprite.getAnimations().forEach((an) => an.cancel());
    sprite.classList.add('fx-hidden');
  }

  /** Flèches qui montent (bleu) ou descendent (rouge) sur le Pokémon. */
  // Comme dans les jeux : des flèches qui défilent À L'INTÉRIEUR de la silhouette du Pokémon (masque = son sprite),
  // bleues vers le haut si la stat monte, rouges vers le bas si elle baisse, et le Pokémon s'illumine de la même couleur.
  function statArrows(sprite, up) {
    const c = center(sprite, 0);
    const src = sprite.currentSrc || sprite.src;
    const box = spawn(`fx-stat ${up ? 'up' : 'down'}`, c.x, c.y, {
      width: `${c.w}px`, height: `${c.h}px`,
      webkitMaskImage: `url("${src}")`, maskImage: `url("${src}")`,
    });
    const col = up ? '#4aa0ff' : '#ff4a3a';
    const glow = sprite.animate([
      { filter: 'none' },
      { filter: `drop-shadow(0 0 6px ${col}) brightness(1.25)`, offset: 0.2 },
      { filter: `drop-shadow(0 0 10px ${col}) brightness(1.35)`, offset: 0.6 },
      { filter: 'none' },
    ], { duration: 1300, easing: 'ease-in-out' });
    const a = box.animate([{ opacity: 0 }, { opacity: 1, offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 1300 });
    done(a, box);
    return Promise.all([a.finished, glow.finished]).catch(() => {});
  }

  /** Effet de statut : le Pokémon se teinte et des bulles de la couleur du statut apparaissent. */
  function statusPulse(sprite, status) {
    const color = STATUS_COLORS[status] || '#a8a8b8';
    sparkles(sprite, color, status !== 'sleep');
    return sprite.animate([
      { filter: 'none' },
      { filter: `drop-shadow(0 0 0 ${color}) brightness(1.4) sepia(0.6) saturate(3)`, offset: 0.25 },
      { filter: 'none', offset: 0.5 },
      { filter: `drop-shadow(0 0 0 ${color}) brightness(1.4) sepia(0.6) saturate(3)`, offset: 0.75 },
      { filter: 'none' },
    ], { duration: 700 }).finished.catch(() => {});
  }

  /** L'objet tenu entre en jeu : son icône surgit au-dessus du Pokémon, grossit puis s'efface. */
  function itemPop(sprite, icon) {
    const c = center(sprite, -sprite.getBoundingClientRect().height * 0.15);
    const d = spawn('fx-item', c.x, c.y);
    d.innerHTML = `<img src="${icon}" alt="">`;
    done(d.animate([
      { transform: 'translate(-50%, -20%) scale(0.4)', opacity: 0 },
      { transform: 'translate(-50%, -90%) scale(1.25)', opacity: 1, offset: 0.3 },
      { transform: 'translate(-50%, -100%) scale(1)', opacity: 1, offset: 0.75 },
      { transform: 'translate(-50%, -120%) scale(1)', opacity: 0 },
    ], { duration: 1100, easing: 'ease-out' }), d);
  }

  /** Méga-Évolution : le Pokémon s'entoure d'un halo arc-en-ciel, devient une silhouette blanche qui pulse,
      un éclair blanc remplit la scène, puis il réapparaît sous sa forme Méga. */
  async function megaEvolve(sprite, newSrc) {
    const c = center(sprite, 0);
    const ring = spawn('fx-mega-ring', c.x, c.y, { width: `${c.w * 1.5}px`, height: `${c.w * 1.5}px` });
    const r = ring.animate([{ transform: 'translate(-50%, -50%) scale(0.3) rotate(0deg)', opacity: 0 }, { transform: 'translate(-50%, -50%) scale(1) rotate(180deg)', opacity: 1, offset: 0.4 },
      { transform: 'translate(-50%, -50%) scale(1.1) rotate(360deg)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%, -50%) scale(1.6) rotate(420deg)', opacity: 0 }], { duration: 1500, easing: 'ease-in-out' });
    done(r, ring);
    await sprite.animate([
      { filter: 'none', transform: getComputedStyle(sprite).transform },
      { filter: 'brightness(4) saturate(0)', offset: 0.35 },
      { filter: 'brightness(1.2) saturate(1.5)', offset: 0.5 },
      { filter: 'brightness(4) saturate(0)', offset: 0.7 },
      { filter: 'brightness(5) saturate(0)' },
    ], { duration: 1100, easing: 'ease-in' }).finished.catch(() => {});
    const fl = spawn('fx-mega-flash', 0, 0);
    done(fl.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 650 }), fl);
    await new Promise((res) => setTimeout(res, 160));
    if (newSrc) sprite.src = newSrc;
    await sprite.animate([{ filter: 'brightness(5) saturate(0)' }, { filter: 'none' }], { duration: 500, easing: 'ease-out' }).finished.catch(() => {});
    sparkles(sprite, '#ffffff', true);
  }

  return { megaEvolve, itemPop, center, throwBall, appear, recall, lunge, projectile, impact, sparkles, blink, shake, faint, statArrows, statusPulse, flash, wait };
}
