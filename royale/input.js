// Commandes : chaque action a ses touches (keys.js, modifiables dans les Réglages) ; par défaut ZQSD sur un clavier
// français (les mêmes positions ailleurs), flèches aussi. Souris capturée pour viser (clic sur l'image pour la capturer,
// Échap pour la libérer). Si le navigateur refuse la capture (certaines iframes, navigateurs intégrés), on vise quand
// même en bougeant la souris : le curseur est caché et, arrivé près d'un bord de l'image, la vue continue de tourner
// de ce côté.
// Manette (API Gamepad), lue à chaque image (poll) : ses boutons sont des touches comme les autres (« Pad0 »…, voir
// keys.js), le stick gauche fait avancer (doucement s'il est à peine poussé), le droit regarder, Menu met en pause ;
// s'accroupir et sprinter s'enclenchent d'un appui. Hors du jeu (écrans, sac, carte, Réglages), elle pilote l'interface :
// h.pad({ nav }) pour la croix ou le stick gauche, h.pad({ button, acts }) pour un bouton.
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
    // manette : jouée sans capture de la souris (padOn), boutons tenus, stick gauche, regard (rad/s), réglages
    this.padOn = false; this.padPrev = new Set(); this.padMove = { mx: 0, mz: 0 }; this.padLook = [0, 0];
    this.padSens = 1; this.padInvert = false; this.assist = true; this.assistSlow = 1;
    this.sprintLatch = false; this.sprintIdle = 0; this.crouchLatch = false; this.navDir = null; this.navT = 0; this.gp = null;
    this.offs = [];
    const on = (el, ev, fn, o) => { el.addEventListener(ev, fn, o); this.offs.push(() => el.removeEventListener(ev, fn, o)); };
    on(surface, 'click', () => this.lock());
    on(document, 'pointerlockchange', () => { this.locked = document.pointerLockElement === surface; if (!this.locked) this.release(); this.h.lock && this.h.lock(this.locked); });
    on(document, 'pointerlockerror', () => this.fallback());
    // plein écran : Échap revient au jeu au lieu de quitter le plein écran (Chrome, Edge ; un appui long le quitte)
    on(document, 'fullscreenchange', () => { const kb = navigator.keyboard; if (document.fullscreenElement && kb && kb.lock) kb.lock(['Escape']).catch(() => {}); });
    on(document, 'mousemove', (e) => {
      if (this.locked || Math.abs(e.movementX) + Math.abs(e.movementY) > 6) this.k.setDevice('kb');
      if (this.free) { const r = surface.getBoundingClientRect(); this.cx = (e.clientX - r.left) / (r.width || 1); this.cy = (e.clientY - r.top) / (r.height || 1); }
      if (this.locked || (this.free && this.over)) { this.dx += e.movementX; this.dy += e.movementY; }
    });
    on(surface, 'pointerenter', () => { this.over = true; });
    on(surface, 'pointerleave', () => { this.over = false; });
    on(window, 'keydown', (e) => {
      if (typing(e.target)) return;
      this.k.setDevice('kb');
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
      this.k.setDevice('kb');
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
  get playing() { return this.locked || this.free || this.padOn; }
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
  release() { this.keys.clear(); this.chars.clear(); this.fire = this.aim = false; this.sprintLatch = this.crouchLatch = false; }
  lock() {
    if (this.playing) return;
    // à la manette : pas de capture de la souris, on joue tout de suite
    if (this.k.device === 'pad') { this.padOn = true; this.h.lock && this.h.lock(true); return; }
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
    if (this.padOn) { this.padOn = false; this.release(); this.h.lock && this.h.lock(false); }
  }
  // déplacement voulu : mx droite/gauche, mz avant/arrière (clavier, ou stick gauche : entre −1 et 1)
  axes() {
    const chars = new Set(this.chars.values()), d = (a) => (this.k.held(a, this.keys, chars) ? 1 : 0);
    const c = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);
    return { mx: c(d('droite') - d('gauche') + this.padMove.mx), mz: c(d('avant') - d('arriere') + this.padMove.mz) };
  }
  get sprint() { return this.down('sprint') || this.sprintLatch; }
  get crouch() { return this.down('accroupi') || this.crouchLatch; }
  // la manette branchée (la première, de préférence au format standard)
  gamepad() {
    let g = null;
    for (const p of (navigator.getGamepads ? navigator.getGamepads() : [])) if (p && p.connected && (!g || (p.mapping === 'standard' && g.mapping !== 'standard'))) g = p;
    return g;
  }
  // une image : boutons appuyés et relâchés, sticks
  poll(dt) {
    const g = this.gamepad();
    this.gp = g;
    if (!g) {
      if (this.padPrev.size) { for (const i of this.padPrev) this.keys.delete('Pad' + i); this.padPrev.clear(); this.sync(); }
      this.padMove.mx = this.padMove.mz = 0; this.padLook[0] = this.padLook[1] = 0;
      return;
    }
    const now = new Set();
    g.buttons.forEach((b, i) => { if (b.pressed || b.value > (i === 6 || i === 7 ? 0.35 : 0.5)) now.add(i); });
    // zone morte ronde, puis de 0 à 1 jusqu'au bord
    const dz = (x, y, d) => { const l = Math.hypot(x, y); if (l < d) return [0, 0]; const k = Math.min(1, (l - d) / (1 - d)) / l; return [x * k, y * k]; };
    const [lx, ly] = dz(g.axes[0] || 0, g.axes[1] || 0, 0.16), [rx, ry] = dz(g.axes[2] || 0, g.axes[3] || 0, 0.12);
    if ((now.size || lx || ly || rx || ry) && this.k.device !== 'pad') this.k.setDevice('pad', /054c|playstation|dualsense|dualshock/i.test(g.id) ? 'ps' : 'xbox');
    const down = [...now].filter((i) => !this.padPrev.has(i)), up = [...this.padPrev].filter((i) => !now.has(i));
    this.padPrev = now;
    for (const i of up) this.keys.delete('Pad' + i);
    if (up.length) this.sync();
    if (!this.playing) {
      this.padMove.mx = this.padMove.mz = 0; this.padLook[0] = this.padLook[1] = 0;
      if (!this.h.pad) return;
      for (const i of down) this.h.pad({ button: i, acts: this.k.match('Pad' + i, '') });
      // croix ou stick gauche : la sélection se déplace, et recommence si on tient
      const dir = now.has(12) || ly < -0.6 ? 'up' : now.has(13) || ly > 0.6 ? 'down' : now.has(14) || lx < -0.6 ? 'left' : now.has(15) || lx > 0.6 ? 'right' : null;
      if (dir !== this.navDir) { this.navDir = dir; this.navT = 0.38; if (dir) this.h.pad({ nav: dir }); }
      else if (dir && (this.navT -= dt) <= 0) { this.navT = 0.11; this.h.pad({ nav: dir }); }
      return;
    }
    this.navDir = null;
    // en jeu : Menu met en pause, les autres boutons sont des touches (accroupi et sprint s'enclenchent d'un appui)
    if (down.includes(9)) { this.unlock(); return; }
    for (const i of down) {
      const code = 'Pad' + i, acts = this.k.match(code, '');
      this.keys.add(code);
      if (acts.includes('accroupi')) this.crouchLatch = !this.crouchLatch;
      if (acts.includes('sprint')) { this.sprintLatch = true; this.sprintIdle = 0; this.crouchLatch = false; }
      if (acts.includes('saut')) this.crouchLatch = false;
      for (const a of acts) this.press(a);
    }
    this.padMove.mx = lx; this.padMove.mz = -ly;
    // le sprint s'arrête quand on lâche le stick un instant (pas s'il n'est pas encore poussé)
    this.sprintIdle = Math.hypot(lx, ly) < 0.3 ? this.sprintIdle + dt : 0;
    if (this.sprintIdle > 0.35) this.sprintLatch = false;
    // regard : précis au centre du stick, rapide au bout (rad/s) ; ralenti sur un ennemi par l'aide à la visée
    const curve = (v) => Math.sign(v) * Math.pow(Math.abs(v), 1.8), k = this.padSens * this.assistSlow;
    this.padLook[0] = curve(rx) * 3.4 * k; this.padLook[1] = curve(ry) * 2.3 * k * (this.padInvert ? -1 : 1);
  }
  // vibration de la manette (forte, faible : 0 → 1 ; durée en ms), si l'on y joue
  rumble(strong, weak, ms) {
    const g = this.gp, v = g && g.vibrationActuator;
    if (!v || this.k.device !== 'pad' || !v.playEffect) return;
    try { v.playEffect('dual-rumble', { duration: ms, strongMagnitude: Math.min(1, strong), weakMagnitude: Math.min(1, weak) }).catch(() => {}); } catch (e) { /* pas de vibration */ }
  }
  takeJump() { const j = this.jumps > 0; this.jumps = 0; return j; }
  // dt : souris libre, la vue tourne toute seule quand le curseur touche un bord de l'image
  takeMouse(dt = 1 / 60) {
    if (this.free && this.over) {
      const edge = (v) => (v < 0.06 ? -(0.06 - v) / 0.06 : v > 0.94 ? (v - 0.94) / 0.06 : 0);
      this.dx += Math.max(-1, Math.min(1, edge(this.cx))) * 900 * dt;
      this.dy += Math.max(-1, Math.min(1, edge(this.cy))) * 450 * dt;
    }
    const d = [this.dx * this.sens + this.padLook[0] * dt, this.dy * this.sens + this.padLook[1] * dt]; this.dx = this.dy = 0; return d;
  }
  dispose() { this.unlock(); for (const f of this.offs) f(); }
}
