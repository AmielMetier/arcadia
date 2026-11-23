// odyssee/js/input.js — clavier : flèches ou ZQSD (WASD en QWERTY), F (ou Espace / Entrée) = interagir / valider,
// Échap / Retour arrière = annuler, menu ; Maj = courir ; R = course continue ; C = carte ; V = vélo ; U = afficher / replier le HUD ; H = aide des touches
const CODE_MAP = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right',
  Space: 'a', Enter: 'a', NumpadEnter: 'a',
  Escape: 'b', Backspace: 'b',
  ShiftLeft: 'run', ShiftRight: 'run', CapsLock: 'autorun',
  KeyB: 'ball', KeyY: 'ball',
  Tab: 'menu', F1: 'help',
};
const KEY_MAP = {
  f: 'a', e: 'a', k: 'a',
  x: 'b', l: 'b',
  r: 'autorun',
  p: 'chat', i: 'bag', m: 'menu', c: 'map', v: 'velo',
  j: 'quests', q: 'quests', t: 'trophies', o: 'friends', g: 'friends',
  u: 'hud', h: 'help',
};
export function resolveKey(e) {
  return CODE_MAP[e?.code] || KEY_MAP[e?.key?.toLowerCase()] || null;
}
export class Input {
  constructor() {
    this.held = new Map(); this.handlers = []; this.dirOrder = []; this.tap = null; this._codeAction = new Map();
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      const k = resolveKey(e); if (!k) return;
      e.preventDefault();
      if (!e.repeat) this._codeAction.set(e.code, k);
      this.appui(k, e.repeat);
    });
    addEventListener('keyup', (e) => {
      const k = this._codeAction.get(e.code) || resolveKey(e);
      this._codeAction.delete(e.code);
      if (!k) return;
      this.relache(k);
    });
    addEventListener('blur', () => { this.clearAll(); });
  }
  /** une touche du jeu enfoncée (clavier, manette ou boutons tactiles : manette.js, tactile.js) */
  appui(k, repeat = false) {
    // l'aide des touches s'ouvre partout, par-dessus le reste
    if (k === 'help') { if (!repeat) this.onHelp?.(); return; }
    if (this.helpOpen) { if (k === 'b' || k === 'a') this.onHelp?.(); return; }
    if (!this.held.has(k)) {
      this.held.set(k, performance.now());
      if (['up', 'down', 'left', 'right'].includes(k)) {
        this.dirOrder = this.dirOrder.filter((d) => d !== k);
        this.dirOrder.push(k);
        // On n'enregistre un tap de déplacement que si le joueur est libre sur la carte
        if (this.free) this.tap = k;
      }
    }
    this.emit(k, repeat);
  }
  /** la touche est relâchée */
  relache(k) { this.held.delete(k); this.dirOrder = this.dirOrder.filter((d) => d !== k); }
  /** nettoie les directions mémorisées (en sortant d'un combat ou d'un menu pour éviter un pas involontaire) */
  clearDirs() {
    this.tap = null;
    this.dirOrder = [];
    this.held.delete('up');
    this.held.delete('down');
    this.held.delete('left');
    this.held.delete('right');
  }
  /** vide toutes les touches maintenues (changement de fenêtre) */
  clearAll() {
    this.clearDirs();
    this.held.clear();
    this._codeAction.clear();
  }
  /** dernière direction enfoncée encore maintenue */
  dir() { return this.dirOrder.length ? this.dirOrder[this.dirOrder.length - 1] : null; }
  /** direction tapée depuis la dernière lecture (un appui très bref compte quand même) */
  takeTap() { const t = this.tap; this.tap = null; return t; }
  heldFor(k) { const t = this.held.get(k); return t ? performance.now() - t : 0; }
  isDown(k) { return this.held.has(k); }
  /** pile de récepteurs : le dernier ajouté reçoit les touches */
  push(fn) {
    this.tap = null;
    this.handlers.push(fn);
    return () => {
      const i = this.handlers.lastIndexOf(fn);
      if (i >= 0) this.handlers.splice(i, 1);
      this.tap = null;
    };
  }
  emit(k, repeat) {
    const h = this.handlers[this.handlers.length - 1];
    if (h) h(k, repeat);
    else this.onFree?.(k, repeat);
  }
  get free() { return this.handlers.length === 0; }
}
