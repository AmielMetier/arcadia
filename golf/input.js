// Birdie Party — commandes. Le swing se fait d'un geste : on maintient le clic (ou le doigt) et on tire vers le bas
// pour armer (la longueur tirée au moment du lâcher donne la force), puis on relâche pour frapper. Revenir au point
// de départ avant de lâcher, Échap ou le clic droit annulent. Tirer de travers fait partir la balle en hook (vers la
// gauche) ou en slice (vers la droite). Au clavier : maintenir Espace pour armer, relâcher pour frapper.
export const MAX_POWER = 1.18;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Input {
  constructor(surface, h) {
    this.h = h; // { canSwing(), back(p), release({ power, curve }), cancel(), key(code, down) }
    this.surface = surface;
    this.sw = null;
    this.keys = new Set();
    this.offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); this.offs.push(() => el.removeEventListener(ev, fn, o)); };
    this.listen = on;
    on(surface, 'pointerdown', (e) => this.down(e));
    on(window, 'pointermove', (e) => this.move(e));
    on(window, 'pointerup', (e) => this.up(e));
    on(window, 'pointercancel', () => this.abort());
    on(window, 'keydown', (e) => this.keyDown(e));
    on(window, 'keyup', (e) => this.keyUp(e));
    on(window, 'blur', () => { this.keys.clear(); if (this.sw) this.abort(); });
    on(surface, 'contextmenu', (e) => e.preventDefault());
  }
  // longueur de geste pour une frappe à 100 %
  get span() { return Math.max(140, innerHeight * 0.3); }

  down(e) {
    this.h.unlock && this.h.unlock();
    if (this.sw || !this.h.canSwing()) return;
    if (e.button != null && e.button !== 0) return;
    this.sw = { id: e.pointerId, kind: 'ptr', y0: e.clientY, x0: e.clientX, power: 0 };
    try { this.surface.setPointerCapture(e.pointerId); } catch (err) {}
    this.h.back(0);
  }
  move(e) {
    const s = this.sw; if (!s || s.kind !== 'ptr' || e.pointerId !== s.id) return;
    if (e.buttons & 2) { this.abort(); return; } // clic droit pendant le geste : on annule
    s.power = clamp((e.clientY - s.y0) / this.span, 0, MAX_POWER);
    this.h.back(s.power);
  }
  up(e) {
    const s = this.sw; if (!s || s.kind !== 'ptr' || e.pointerId !== s.id) return;
    this.sw = null;
    const dy = e.clientY - s.y0, power = clamp(dy / this.span, 0, MAX_POWER);
    // un geste un peu penché reste droit ; au-delà, la balle part du côté où la main a dérivé
    const lean = (e.clientX - s.x0) / Math.max(40, dy);
    const curve = clamp(Math.sign(lean) * Math.max(0, Math.abs(lean) - 0.15) * 1.2, -1.5, 1.5);
    this.h.release({ power, curve });
  }
  abort() { if (!this.sw) return; this.sw = null; this.h.cancel(); }

  keyDown(e) {
    const k = e.code;
    if (k === 'Space') {
      e.preventDefault();
      this.h.unlock && this.h.unlock();
      if (e.repeat || this.sw || !this.h.canSwing()) return;
      this.sw = { kind: 'key', t0: performance.now(), power: 0 };
      this.h.back(0);
      return;
    }
    if (k === 'Escape' && this.sw) { this.abort(); return; }
    if (!this.keys.has(k)) { this.keys.add(k); this.h.key(k, true, e); }
  }
  keyUp(e) {
    const k = e.code;
    if (k === 'Space') {
      const s = this.sw; if (!s || s.kind !== 'key') return;
      this.sw = null;
      this.h.release({ power: s.power, curve: 0 });
      return;
    }
    this.keys.delete(k);
    this.h.key(k, false, e);
  }
  // au clavier la jauge monte toute seule (1,1 s pour 100 %)
  update() {
    const s = this.sw;
    if (s && s.kind === 'key') { s.power = clamp((performance.now() - s.t0) / 1100, 0, MAX_POWER); this.h.back(s.power); }
  }
  held(code) { return this.keys.has(code); }
  get swinging() { return !!this.sw; }
  dispose() { for (const f of this.offs) f(); this.offs = []; }
}
