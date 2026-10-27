// Commandes : clavier lu par position des touches (ZQSD sur un clavier français, WASD ailleurs, flèches aussi),
// souris capturée pour viser (clic sur l'image pour la capturer, Échap pour la libérer). Si le navigateur refuse
// la capture (certaines iframes, navigateurs intégrés), on vise quand même en bougeant la souris : le curseur est
// caché et, arrivé près d'un bord de l'image, la vue continue de tourner de ce côté.
const MOVE_KEYS = { KeyW: [0, 1], ArrowUp: [0, 1], KeyS: [0, -1], ArrowDown: [0, -1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };

export class Input {
  constructor(surface, h = {}) {
    this.h = h; // { key(code), lock(locked) }
    this.surface = surface;
    this.keys = new Set();
    this.dx = 0; this.dy = 0;
    this.jumps = 0;
    this.fire = false; this.aim = false; this.shots = 0;   // tir maintenu, visée (clic droit), clics de tir
    this.locked = false;   // souris capturée
    this.free = false;     // capture refusée : on joue quand même, la souris libre fait tourner la vue
    this.over = false; this.cx = 0.5; this.cy = 0.5; // souris libre : au-dessus de l'image ? où (0 → 1) ?
    this.sens = 0.0024;
    this.offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); this.offs.push(() => el.removeEventListener(ev, fn, o)); };
    on(surface, 'click', () => this.lock());
    on(document, 'pointerlockchange', () => { this.locked = document.pointerLockElement === surface; if (!this.locked) { this.keys.clear(); this.fire = this.aim = false; } this.h.lock && this.h.lock(this.locked); });
    on(document, 'pointerlockerror', () => this.fallback());
    // plein écran : Échap revient au jeu au lieu de quitter le plein écran (Chrome, Edge ; un appui long le quitte)
    on(document, 'fullscreenchange', () => { const kb = navigator.keyboard; if (document.fullscreenElement && kb && kb.lock) kb.lock(['Escape']).catch(() => {}); });
    on(document, 'mousemove', (e) => {
      if (this.free) { const r = surface.getBoundingClientRect(); this.cx = (e.clientX - r.left) / (r.width || 1); this.cy = (e.clientY - r.top) / (r.height || 1); }
      if (this.locked || (this.free && this.over)) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    on(surface, 'pointerenter', () => { this.over = true; });
    on(surface, 'pointerleave', () => { this.over = false; });
    on(window, 'keydown', (e) => {
      if (e.repeat) { if (MOVE_KEYS[e.code] || e.code === 'Space') e.preventDefault(); return; }
      if (e.code === 'Space') { this.jumps++; e.preventDefault(); }
      // Échap reste dans le jeu (fermer le sac, la carte) : pas d'action du navigateur
      if (e.code === 'Escape') e.preventDefault();
      if (e.code === 'Escape' && this.free) { this.free = false; this.surface.style.cursor = ''; this.keys.clear(); this.h.lock && this.h.lock(false); return; }
      if (e.code === 'Tab' || (e.ctrlKey && MOVE_KEYS[e.code])) e.preventDefault();
      this.keys.add(e.code);
      // lettres d'action lues par leur sens (E, R, M…) : la même touche sur un clavier français ou anglais
      this.h.key && this.h.key(e.code, (e.key || '').toLowerCase());
    });
    on(window, 'keyup', (e) => this.keys.delete(e.code));
    // souris : tir (gauche), visée (droit), molette (objet suivant ou précédent)
    on(document, 'mousedown', (e) => {
      if (!this.playing) return;
      if (e.button === 0) { this.fire = true; this.shots++; }
      if (e.button === 2) this.aim = true;
    });
    on(document, 'mouseup', (e) => { if (e.button === 0) this.fire = false; if (e.button === 2) this.aim = false; });
    on(window, 'wheel', (e) => { if (this.playing && this.h.wheel) this.h.wheel(Math.sign(e.deltaY)); }, { passive: true });
    on(window, 'blur', () => { this.keys.clear(); this.fire = this.aim = false; });
    on(surface, 'contextmenu', (e) => e.preventDefault());
  }
  get playing() { return this.locked || this.free; }
  lock() {
    if (this.playing) return;
    let r;
    try { r = this.surface.requestPointerLock({ unadjustedMovement: true }); } catch (e) { this.fallback(); return; }
    if (r && r.catch) r.catch(() => {
      // sans mouvement brut (certains systèmes) puis, si c'est encore refusé, visée au glisser
      let r2;
      try { r2 = this.surface.requestPointerLock(); } catch (e) { this.fallback(); return; }
      if (r2 && r2.catch) r2.catch(() => this.fallback());
    });
  }
  fallback() {
    if (this.locked || this.free) return;
    this.free = true; this.over = true;
    this.surface.style.cursor = 'none';
    this.h.lock && this.h.lock(true, true);
  }
  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.free) { this.free = false; this.surface.style.cursor = ''; this.keys.clear(); this.h.lock && this.h.lock(false); }
  }
  // déplacement voulu : mx droite/gauche, mz avant/arrière
  axes() {
    let mx = 0, mz = 0;
    for (const k of this.keys) { const a = MOVE_KEYS[k]; if (a) { mx += a[0]; mz += a[1]; } }
    return { mx: Math.max(-1, Math.min(1, mx)), mz: Math.max(-1, Math.min(1, mz)) };
  }
  get sprint() { return this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'); }
  get crouch() { return this.keys.has('ControlLeft') || this.keys.has('ControlRight'); }
  takeJump() { const j = this.jumps > 0; this.jumps = 0; return j; }
  // dt : souris libre, la vue tourne toute seule quand le curseur touche un bord de l'image
  takeMouse(dt = 1 / 60) {
    if (this.free && this.over) {
      const edge = (v) => (v < 0.06 ? -(0.06 - v) / 0.06 : v > 0.94 ? (v - 0.94) / 0.06 : 0);
      this.dx += Math.max(-1, Math.min(1, edge(this.cx))) * 900 * dt;
      this.dy += Math.max(-1, Math.min(1, edge(this.cy))) * 450 * dt;
    }
    const d = [this.dx * this.sens, this.dy * this.sens]; this.dx = this.dy = 0; return d;
  }
  dispose() { this.unlock(); for (const f of this.offs) f(); }
}
