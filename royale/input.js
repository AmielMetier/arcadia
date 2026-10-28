// Commandes : chaque action a ses touches (keys.js, modifiables dans les Réglages) ; par défaut ZQSD sur un clavier
// français (les mêmes positions ailleurs), flèches aussi. Souris capturée pour viser (clic sur l'image pour la capturer,
// Échap pour la libérer). Si le navigateur refuse la capture (certaines iframes, navigateurs intégrés), on vise quand
// même en bougeant la souris : le curseur est caché et, arrivé près d'un bord de l'image, la vue continue de tourner
// de ce côté.
const typing = (el) => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

export class Input {
  constructor(surface, keys, h = {}) {
    this.h = h; // { key(code) : Échap, action(id) : une action appuyée, lock(locked), wheel(dir) }
    this.k = keys;
    this.surface = surface;
    this.keys = new Set();     // touches et boutons de la souris enfoncés (KeyW, Mouse0…)
    this.chars = new Map();    // touche enfoncée → lettre qu'elle a tapée
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
    on(document, 'pointerlockchange', () => { this.locked = document.pointerLockElement === surface; if (!this.locked) this.release(); this.h.lock && this.h.lock(this.locked); });
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
      if (typing(e.target)) return;
      const ch = (e.key || '').length === 1 ? e.key.toLowerCase() : '';
      const acts = e.code === 'Escape' ? [] : this.k.match(e.code, ch);
      // touches du jeu : pas d'action du navigateur (défilement, tabulation, recherche…)
      if (acts.length && (this.playing || e.code === 'Tab' || e.code === 'Space' || e.ctrlKey)) e.preventDefault();
      if (e.repeat) return;
      // Échap reste dans le jeu (fermer le sac, la carte) : pas d'action du navigateur
      if (e.code === 'Escape') {
        e.preventDefault();
        if (this.free) { this.free = false; this.surface.style.cursor = ''; this.release(); this.h.lock && this.h.lock(false); return; }
        this.h.key && this.h.key('Escape');
        return;
      }
      this.k.learn(e.code, e.key);
      this.keys.add(e.code);
      if (ch) this.chars.set(e.code, ch);
      for (const a of acts) this.press(a);
    });
    on(window, 'keyup', (e) => { this.keys.delete(e.code); this.chars.delete(e.code); this.sync(); });
    // souris : ses boutons sont des touches comme les autres (tir, visée, repère…) ; la molette change d'objet
    on(document, 'mousedown', (e) => {
      if (!this.playing) return;
      const b = 'Mouse' + e.button, acts = this.k.match(b, '');
      // clic molette sans défilement automatique, boutons du côté sans page précédente
      if (e.button === 1 || e.button > 2) e.preventDefault();
      this.keys.add(b);
      for (const a of acts) this.press(a);
    });
    on(document, 'mouseup', (e) => { if (e.button > 2 && this.playing) e.preventDefault(); this.keys.delete('Mouse' + e.button); this.sync(); });
    on(window, 'wheel', (e) => { if (this.playing && this.h.wheel) this.h.wheel(Math.sign(e.deltaY)); }, { passive: true });
    on(window, 'blur', () => this.release());
    on(surface, 'contextmenu', (e) => e.preventDefault());
  }
  get playing() { return this.locked || this.free; }
  // une action appuyée : saut, tir et visée sont lus ici, les autres vont au jeu
  press(a) {
    if (a === 'saut') this.jumps++;
    if (a === 'tir' && this.playing) { this.fire = true; this.shots++; }
    if (a === 'visee' && this.playing) this.aim = true;
    this.h.action && this.h.action(a);
  }
  down(a) { return this.k.held(a, this.keys, new Set(this.chars.values())); }
  // une touche relâchée : tir et visée continuent tant qu'une de leurs touches reste enfoncée
  sync() { this.fire = this.fire && this.down('tir'); this.aim = this.aim && this.down('visee'); }
  release() { this.keys.clear(); this.chars.clear(); this.fire = this.aim = false; }
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
    if (this.free) { this.free = false; this.surface.style.cursor = ''; this.release(); this.h.lock && this.h.lock(false); }
  }
  // déplacement voulu : mx droite/gauche, mz avant/arrière
  axes() {
    const chars = new Set(this.chars.values()), d = (a) => (this.k.held(a, this.keys, chars) ? 1 : 0);
    return { mx: d('droite') - d('gauche'), mz: d('avant') - d('arriere') };
  }
  get sprint() { return this.down('sprint'); }
  get crouch() { return this.down('accroupi'); }
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
