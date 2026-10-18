// Effets à l'écran : montants flottants, pièces qui volent, bandeaux, tampons, cartes, confettis.
import { el, wait, esc, money } from './util.js';

export function mountFx(host) {
  const layer = el('div', 'fx');
  host.appendChild(layer);

  const api = {
    float(x, y, text, kind = 'plus') {
      const e = el('div', `fl ${kind}`, esc(text));
      e.style.left = x + 'px'; e.style.top = y + 'px';
      layer.appendChild(e);
      e.animate([{ transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 }, { transform: 'translate(-50%,-90%) scale(1.15)', opacity: 1, offset: 0.2 },
        { transform: 'translate(-50%,-220%) scale(1)', opacity: 0 }], { duration: 1500, easing: 'ease-out' }).finished.then(() => e.remove());
    },

    // n pièces de a vers b (coordonnées écran), avec une courbe
    async coins(a, b, n = 6, speed = 1) {
      if (!a || !b) return;
      const runs = [];
      for (let k = 0; k < n; k++) {
        const c = el('i', 'coin'); layer.appendChild(c);
        const mx = (a.x + b.x) / 2 + (Math.random() - 0.5) * 80, my = Math.min(a.y, b.y) - 70 - Math.random() * 60;
        const dur = (620 + k * 40) / speed;
        runs.push(c.animate([
          { transform: `translate(${a.x}px, ${a.y}px) scale(.5)`, opacity: 0 },
          { transform: `translate(${mx}px, ${my}px) scale(1.1)`, opacity: 1, offset: 0.45 },
          { transform: `translate(${b.x}px, ${b.y}px) scale(.7)`, opacity: 1 },
        ], { duration: dur, delay: (k * 55) / speed, easing: 'cubic-bezier(.3,.1,.4,1)', fill: 'both' }).finished.then(() => c.remove()));
      }
      await Promise.all(runs);
    },

    async banner(title, sub = '', color = '#16181d', ms = 1200) {
      const e = el('div', 'banner', `<b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}`);
      e.style.setProperty('--c', color);
      layer.appendChild(e);
      await e.animate([{ transform: 'translate(-50%,-50%) scaleX(0)', opacity: 0 }, { transform: 'translate(-50%,-50%) scaleX(1.05)', opacity: 1, offset: 0.15 },
        { transform: 'translate(-50%,-50%) scaleX(1)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) scaleX(1)', opacity: 0 }],
      { duration: ms, easing: 'ease-out' }).finished;
      e.remove();
    },

    stamp(x, y, text, color) {
      const e = el('div', 'stampfx', esc(text));
      e.style.left = x + 'px'; e.style.top = y + 'px'; e.style.setProperty('--c', color);
      layer.appendChild(e);
      e.animate([{ transform: 'translate(-50%,-50%) rotate(-12deg) scale(2.6)', opacity: 0 }, { transform: 'translate(-50%,-50%) rotate(-12deg) scale(.95)', opacity: 1, offset: 0.25 },
        { transform: 'translate(-50%,-50%) rotate(-12deg) scale(1)', opacity: 1, offset: 0.8 }, { transform: 'translate(-50%,-50%) rotate(-12deg) scale(1)', opacity: 0 }],
      { duration: 1300, easing: 'ease-out' }).finished.then(() => e.remove());
    },

    burst(x, y, color, n = 12) {
      for (let k = 0; k < n; k++) {
        const p = el('i', 'spark'); p.style.background = color; layer.appendChild(p);
        const a = (k / n) * Math.PI * 2, d = 40 + Math.random() * 40;
        p.animate([{ transform: `translate(${x}px, ${y}px) scale(1)`, opacity: 1 }, { transform: `translate(${x + Math.cos(a) * d}px, ${y + Math.sin(a) * d}px) scale(.2)`, opacity: 0 }],
          { duration: 600, easing: 'cubic-bezier(.2,.7,.3,1)' }).finished.then(() => p.remove());
      }
    },

    // Carte Chance / Caisse de communauté : sort du paquet, se retourne, reste lisible
    async card(deck, text, speed = 1) {
      const title = deck === 'chance' ? 'Chance' : 'Caisse de communauté';
      const e = el('div', `bigcard ${deck}`, `<div class="inner"><div class="back"><b>${deck === 'chance' ? '?' : 'CAISSE'}</b></div>
        <div class="front"><h4>${title}</h4><p>${esc(text)}</p></div></div>`);
      layer.appendChild(e);
      const inner = e.querySelector('.inner');
      const hold = Math.max(900, Math.min(3200, 900 + text.length * 22)) / speed;
      e.animate([{ transform: 'translate(-50%,-50%) translateY(40vh) scale(.4) rotate(-20deg)', opacity: 0 }, { transform: 'translate(-50%,-50%) scale(1) rotate(0)', opacity: 1 }],
        { duration: 420 / speed, easing: 'cubic-bezier(.2,.9,.3,1.2)', fill: 'forwards' });
      await inner.animate([{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(0deg)' }], { duration: 520 / speed, delay: 260 / speed, easing: 'ease-in-out', fill: 'forwards' }).finished;
      await new Promise((r) => { const t = setTimeout(r, hold); e.onclick = () => { clearTimeout(t); r(); }; });
      await e.animate([{ opacity: 1 }, { opacity: 0, transform: 'translate(-50%,-50%) scale(.85)' }], { duration: 220, fill: 'forwards' }).finished;
      e.remove();
    },

    confetti(n = 120) {
      const colors = ['#ff4b2b', '#ffc531', '#2fbf71', '#2b8cff', '#b45cff', '#ff5fa2', '#1fc7c1'];
      for (let k = 0; k < n; k++) {
        const p = el('i', 'conf'); p.style.background = colors[k % colors.length];
        p.style.left = Math.random() * 100 + 'vw'; layer.appendChild(p);
        const dx = (Math.random() - 0.5) * 200, rot = Math.random() * 720;
        p.animate([{ transform: `translate(0,-10vh) rotate(0)` }, { transform: `translate(${dx}px, 110vh) rotate(${rot}deg)` }],
          { duration: 2200 + Math.random() * 1800, delay: Math.random() * 600, easing: 'cubic-bezier(.3,.5,.6,1)' }).finished.then(() => p.remove());
      }
    },
    money,
  };
  return api;
}
