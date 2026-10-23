// Dés 3D (CSS) : lancer avec rebonds et rotation qui s'arrête sur la bonne face.
import { el, wait } from './util.js';

// Faces : avant 1, arrière 6, droite 3, gauche 4, dessus 2, dessous 5 (faces opposées = 7)
const FACES = [['f', 1], ['b', 6], ['r', 3], ['l', 4], ['t', 2], ['d', 5]];
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
// rotation (x, y) du cube qui amène la face n vers l'écran
const SHOW = { 1: [0, 0], 6: [0, 180], 3: [0, -90], 4: [0, 90], 2: [-90, 0], 5: [90, 0] };

function dieHtml() {
  return `<div class="cube">${FACES.map(([f, n]) => `<div class="face ${f}">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((k) => `<i class="${PIPS[n].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`).join('')}</div>`;
}

export function mountDice(host) {
  const tray = el('div', 'dicetray');
  const dice = [0, 1].map(() => { const d = el('div', 'die', dieHtml()); d.appendChild(el('i', 'dshadow')); d.appendChild(el('b', 'dval')); tray.appendChild(d); return d; });
  host.appendChild(tray);
  let hideT = 0;

  return {
    async roll(values, speed = 1) {
      clearTimeout(hideT);
      tray.classList.add('on'); tray.classList.remove('landed');
      const dur = Math.max(260, 1100 / speed);
      const runs = values.map((v, k) => {
        const cube = dice[k].querySelector('.cube');
        const [sx, sy] = SHOW[v];
        const spins = 2 + k;
        // vue presque de face : la face qui compte (devant) domine, le dessus se voit à peine
        const tilt = k ? 'rotateX(-7deg) rotateY(-12deg)' : 'rotateX(-7deg) rotateY(10deg)';
        dice[k].querySelector('.dval').textContent = v;
        const end = `${tilt} rotateX(${sx + 360 * spins}deg) rotateY(${sy + 360 * (spins + 1)}deg)`;
        const start = `rotateX(${Math.random() * 360}deg) rotateY(${Math.random() * 360}deg)`;
        cube.animate([{ transform: start }, { transform: end }], { duration: dur, easing: 'cubic-bezier(.15,.6,.25,1)', fill: 'forwards' });
        const fromX = 260 + k * 40, fromY = 220 - k * 30;
        return dice[k].animate([
          { transform: `translate3d(${fromX}px, ${fromY}px, 0) scale(.6)`, opacity: 0 },
          { transform: `translate3d(${fromX * 0.35}px, ${-60 + k * 10}px, 0) scale(1.08)`, opacity: 1, offset: 0.35 },
          { transform: `translate3d(${fromX * 0.1}px, 0px, 0) scale(1)`, opacity: 1, offset: 0.62 },
          { transform: `translate3d(0, -14px, 0) scale(1)`, opacity: 1, offset: 0.8 },
          { transform: 'translate3d(0, 0, 0) scale(1)', opacity: 1 },
        ], { duration: dur, easing: 'ease-out', fill: 'forwards' }).finished;
      });
      await Promise.all(runs);
      tray.classList.toggle('double', values[0] === values[1]);
      tray.classList.add('landed');
      await wait(180 / speed);
      hideT = setTimeout(() => tray.classList.remove('on', 'double', 'landed'), 2600);
    },
    hide() { tray.classList.remove('on', 'double', 'landed'); },
  };
}
