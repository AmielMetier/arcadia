// Birdie Party — commandes. Le swing se fait d'un geste, comme avec une télécommande :
// on tire vers le bas pour armer (la longueur du geste donne la force), puis on lance vers le haut.
// Un geste de travers fait partir la balle en hook (vers la gauche) ou en slice (vers la droite) ;
// un geste trop lent coûte de la distance. Au clavier : maintenir Espace pour armer, relâcher pour frapper.
export const MAX_POWER = 1.18;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Input {
  constructor(surface, h) {
    this.h = h; // { canSwing(), back(p), release({ power, curve, slow }), cancel(), key(code, down) }
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
    this.sw = { id: e.pointerId, kind: 'ptr', y0: e.clientY, x0: e.clientX, low: e.clientY, lowX: e.clientX, lowT: performance.now(), power: 0, phase: 'back' };
    try { this.surface.setPointerCapture(e.pointerId); } catch (err) {}
    this.h.back(0);
  }
  move(e) {
    const s = this.sw; if (!s || s.kind !== 'ptr' || e.pointerId !== s.id) return;
    const y = e.clientY;
    if (s.phase === 'back') {
      if (y > s.low) { s.low = y; s.lowX = e.clientX; s.lowT = performance.now(); }
      s.power = clamp((s.low - s.y0) / this.span, 0, MAX_POWER);
      this.h.back(s.power);
      // le geste repart vers le haut : c'est la descente du club
      if (s.power > 0.03 && y < s.low - 14) { s.phase = 'down'; s.downT = s.lowT; }
    } else if (s.phase === 'down') {
      // la frappe part quand le geste repasse au-dessus du point de départ
      if (y <= s.y0 - 8) this.fire(e.clientX, y);
    }
  }
  up(e) {
    const s = this.sw; if (!s || s.kind !== 'ptr' || e.pointerId !== s.id) return;
    if (s.phase === 'down' && s.low - e.clientY > (s.low - s.y0) * 0.5) this.fire(e.clientX, e.clientY);
    else this.abort();
  }
  fire(x, y) {
    const s = this.sw; if (!s) return;
    this.sw = null;
    const rise = Math.max(40, s.low - y), dx = x - s.lowX;
    const dt = (performance.now() - s.downT) / 1000;
    const slow = dt > 0.55;
    this.h.release({ power: s.power, curve: clamp((dx / rise) * 1.25, -1.5, 1.5), slow });
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
      this.h.release({ power: s.power, curve: 0, slow: false });
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
