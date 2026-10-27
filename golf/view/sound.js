// Birdie Party — réglage du son, ouvert depuis le bouton haut-parleur (en jeu comme au menu) : volume de la musique
// (morceau du menu, petits airs de fin de coup) et des effets (frappes, foule, nature), et « couper le son » (touche M).
import { icon } from './icons.js';

const ROWS = [['music', 'Musique'], ['fx', 'Effets']];

// sfx : moteur de son ; btn : bouton qui ouvre le panneau (le panneau se place sous son conteneur)
export function soundPanel(sfx, btn) {
  const pop = document.createElement('div');
  pop.className = 'sndpop'; pop.hidden = true;
  pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Réglage du son');
  pop.innerHTML = `<b class="sp-t">Son</b>${ROWS.map(([k, l]) => `<label class="sp-row"><span>${l}</span><input type="range" min="0" max="100" step="5" data-k="${k}" aria-label="Volume ${l.toLowerCase()}"><output data-o="${k}"></output></label>`).join('')}
    <button class="btn secondary sp-mute" type="button"></button>`;
  btn.parentElement.appendChild(pop);
  btn.setAttribute('aria-haspopup', 'dialog'); btn.setAttribute('aria-expanded', 'false');
  const $ = (s) => pop.querySelector(s);
  let tickT = 0;

  function refresh() {
    for (const [k] of ROWS) {
      const v = Math.round(sfx.vol[k] * 100);
      $(`[data-k="${k}"]`).value = v; $(`[data-o="${k}"]`).textContent = v + ' %';
    }
    $('.sp-mute').textContent = sfx.muted ? 'Remettre le son' : 'Couper le son';
    pop.classList.toggle('muted', sfx.muted);
    btn.innerHTML = icon(sfx.muted || (!sfx.vol.music && !sfx.vol.fx) ? 'soundOff' : 'soundOn');
  }
  function open(on) {
    pop.hidden = !on; btn.setAttribute('aria-expanded', String(on)); btn.setAttribute('aria-pressed', String(on));
    if (on) { refresh(); sfx.ui('open'); }
  }
  const onBtn = (e) => { e.stopPropagation(); sfx.unlock(); open(pop.hidden); };
  btn.addEventListener('click', onBtn);
  for (const r of pop.querySelectorAll('input')) {
    r.addEventListener('input', () => {
      sfx.setVolume(r.dataset.k, r.value / 100);
      if (sfx.muted) sfx.setMuted(false);
      refresh();
      // un petit son pour entendre le niveau des effets
      const now = performance.now();
      if (r.dataset.k === 'fx' && now - tickT > 120) { tickT = now; sfx.ui('tick'); }
    });
  }
  $('.sp-mute').addEventListener('click', () => { sfx.setMuted(!sfx.muted); refresh(); });
  // le panneau garde ses clics et ses touches pour lui (pas de visée ni de swing en réglant le son)
  for (const ev of ['pointerdown', 'click', 'keydown', 'wheel']) pop.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === 'keydown' && e.code === 'Escape') { open(false); btn.focus(); } });
  const away = (e) => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) open(false); };
  addEventListener('pointerdown', away, true);
  refresh();
  return {
    refresh, close: () => open(false),
    dispose() { removeEventListener('pointerdown', away, true); btn.removeEventListener('click', onBtn); pop.remove(); },
  };
}
