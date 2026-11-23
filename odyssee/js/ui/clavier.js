// odyssee/js/ui/clavier.js — saisie d'un nom façon DS : les lettres sur une grille qu'on parcourt aux flèches
// (Entrée tape la lettre, Échap efface), trois pages (majuscules, minuscules, accents), et en bas Maj, Accents,
// Effacer, OK. Au PC, on peut aussi taper directement au clavier (lettres, Retour arrière) : le curseur revient sur OK.
import { el, esc } from './ui.js';

const PAGES = {
  ABC: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ-\'. ',
  abc: 'abcdefghijklmnopqrstuvwxyz-\'. ',
  'éàç': 'éèêëàâäçîïôöûùüÿæœÉÈÀÇ!?&+ ',
};
const COLS = 10;
const ACTIONS = [['maj', 'ABC / abc'], ['acc', 'é à ç'], ['del', 'Effacer'], ['ok', 'OK']];
const TAPABLE = /^[\p{L}\-'.!?&+0-9]$/u;

/**
 * Ouvre le clavier ; renvoie le nom choisi (le nom par défaut si on valide à vide).
 * o : { titre, def, max = 10, sprite (image à gauche), parent (élément où l'afficher, l'écran sinon) }
 */
export function clavierNom(ui, { titre, def = '', max = 10, sprite = null, parent = null } = {}) {
  return new Promise((resolve) => {
    let nom = String(def || '').slice(0, Math.max(max, String(def || '').length)), page = 'ABC';
    let r = -1, c = ACTIONS.length - 1;   // le curseur part sur OK (r = -1 : la rangée des actions)
    const w = el('div', 'screen clavier-scr');
    w.innerHTML = `
      <div class="box clavier-tete">
        ${sprite ? `<img class="clavier-spr" src="${sprite}" alt="">` : ''}
        <div class="clavier-titre">${esc(titre || 'Quel est ton nom ?')}</div>
        <div class="clavier-nom"></div>
      </div>
      <div class="box clavier-grille"><div class="clavier-touches"></div><div class="clavier-actions"></div></div>
      <div class="clavier-aide">Flèches + Entrée · Échap efface · ou tape directement au clavier</div>`;
    (parent || ui.root).appendChild(w);
    const nomEl = w.querySelector('.clavier-nom'), touches = w.querySelector('.clavier-touches'), actions = w.querySelector('.clavier-actions');
    const lettres = () => [...PAGES[page]];
    const rangs = () => Math.ceil(lettres().length / COLS);
    const dessine = () => {
      const n = Math.max(max, nom.length);
      nomEl.innerHTML = Array.from({ length: n }, (_, i) => `<span class="${i === nom.length ? 'cur' : ''}">${nom[i] === ' ' ? '&nbsp;' : esc(nom[i] || '')}</span>`).join('');
      touches.innerHTML = lettres().map((ch, i) => `<div class="clavier-k${r === Math.floor(i / COLS) && c === i % COLS ? ' on' : ''}" data-i="${i}">${ch === ' ' ? '␣' : esc(ch)}</div>`).join('');
      actions.innerHTML = ACTIONS.map(([id, lbl], j) => `<div class="clavier-a${r === -1 && c === j ? ' on' : ''}${id === 'ok' ? ' ok' : ''}" data-a="${j}">${lbl}</div>`).join('');
    };
    const tape = (ch) => { if (nom.length < max) { nom += ch; ui.sound.sfx('blip'); } else ui.sound.sfx('cancel'); };
    const efface = () => { if (nom.length) { nom = nom.slice(0, -1); ui.sound.sfx('cancel'); } };
    const fin = () => { pop(); removeEventListener('keydown', clavierPC, true); w.remove(); ui.sound.sfx('select'); resolve(nom.trim() || def); };
    const active = () => {
      if (r === -1) {
        const id = ACTIONS[c][0];
        if (id === 'maj') { page = page === 'ABC' ? 'abc' : 'ABC'; ui.sound.sfx('blip'); }
        else if (id === 'acc') { page = page === 'éàç' ? 'ABC' : 'éàç'; ui.sound.sfx('blip'); }
        else if (id === 'del') efface();
        else { fin(); return; }
      } else {
        const ch = lettres()[r * COLS + c]; if (ch !== undefined) tape(ch);
        // comme sur DS : après une majuscule en début de nom, on passe aux minuscules
        if (page === 'ABC' && nom.length === 1) page = 'abc';
      }
      dessine();
    };
    const bouge = (dr, dc) => {
      if (dr) {
        const R = rangs(); let nr = r + dr;
        if (nr >= R) nr = -1; else if (nr < -1) nr = R - 1;
        if (r === -1 && nr !== -1) c = Math.min(COLS - 1, Math.round(c * (COLS - 1) / (ACTIONS.length - 1)));
        else if (nr === -1 && r !== -1) c = Math.min(ACTIONS.length - 1, Math.round(c * (ACTIONS.length - 1) / (COLS - 1)));
        r = nr;
      }
      if (dc) {
        const n = r === -1 ? ACTIONS.length : COLS; c = (c + dc + n) % n;
        if (r >= 0) while (r * COLS + c >= lettres().length) c = (c + dc + n) % n;
      }
      if (r >= 0 && r * COLS + c >= lettres().length) c = lettres().length - 1 - r * COLS;
      ui.sound.sfx('blip'); dessine();
    };
    // les touches du jeu (flèches, manette) : la grille
    const pop = ui.input.push((k) => {
      if (k === 'up') bouge(-1, 0); else if (k === 'down') bouge(1, 0);
      else if (k === 'left') bouge(0, -1); else if (k === 'right') bouge(0, 1);
      else if (k === 'a') active(); else if (k === 'b') { efface(); dessine(); }
    });
    // au PC : les lettres tapées s'écrivent directement (avant que le jeu ne les prenne pour des déplacements)
    const clavierPC = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (!e.repeat) active(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); e.stopImmediatePropagation(); efface(); dessine(); return; }
      if (e.key.length === 1 && TAPABLE.test(e.key)) { e.preventDefault(); e.stopImmediatePropagation(); tape(e.key); r = -1; c = ACTIONS.length - 1; dessine(); }   // puis Entrée valide (curseur sur OK)
    };
    addEventListener('keydown', clavierPC, true);
    // à la souris
    w.addEventListener('click', (e) => {
      const k = e.target.closest('.clavier-k'), a = e.target.closest('.clavier-a');
      if (k) { const i = +k.dataset.i; r = Math.floor(i / COLS); c = i % COLS; active(); }
      else if (a) { r = -1; c = +a.dataset.a; active(); }
      e.stopPropagation();
    });
    dessine();
  });
}
