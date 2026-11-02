// Site Noir : clavier (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris capturée, tactile et manette.
// Les appuis sont comptés (uc, fc…) : un appui très bref ou un paquet perdu ne fait pas rater l'action. Chaque écouteur passe par listen() : dispose() les retire tous.

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export class Input {
  constructor(surface, hooks = {}) {
    this.surface = surface; this.h = hooks;
    this.keys = new Set(); this.off = [];
    this.c = { uc: 0, fc: 0, dc: 0, tc: 0, rc: 0, a1: 0, a2: 0, a3: 0 };
    this.yaw = 0; this.pitch = 0; this.sel = 0; this.sens = 1;
    this.fire = false; this.btn = { use: false, fire: false, run: false, crouch: false };
    this.locked = false; this.free = false; this.crouchLatch = false; this.touch = { move: null, look: null }; this.padPrev = [];
    const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); this.off.push(() => t.removeEventListener(type, fn, o)); };
    this.listen = listen;
    listen(document, 'pointerlockchange', () => { const was = this.locked; this.locked = document.pointerLockElement === surface; if (was && !this.locked) { this.release(); hooks.unlocked && hooks.unlocked(); } });
    listen(document, 'mousemove', (e) => {
      if (!this.locked && !this.free) return;
      this.look(e.movementX, e.movementY, 0.0022);
    });
    listen(window, 'keydown', (e) => {
      if (e.target.closest?.('input,textarea')) return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
      hooks.unlock && hooks.unlock();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'KeyE') this.c.uc++;
      else if (k === 'KeyF') this.c.tc++;
      else if (k === 'KeyR') this.c.rc++;
      else if (k === 'KeyG') this.c.dc++;
      else if (k === 'KeyT') hooks.screens && hooks.screens();
      else if (k === 'KeyC') this.crouchLatch = !this.crouchLatch;
      else if (k === 'Digit1' || k === 'Numpad1') { this.sel = 0; this.c.a1++; }
      else if (k === 'Digit2' || k === 'Numpad2') { this.sel = 1; this.c.a2++; }
      else if (k === 'Digit3' || k === 'Numpad3') { this.sel = 2; this.c.a3++; }
      else if (k === 'Tab') hooks.map && hooks.map(true);
      else if (k === 'Escape' || k === 'KeyP') hooks.menu && hooks.menu();
      else if (k === 'KeyM') hooks.mute && hooks.mute();
      else if (k === 'Enter') hooks.enter && hooks.enter();
      else if (k === 'ArrowLeft') hooks.cam && hooks.cam(-1);
      else if (k === 'ArrowRight') hooks.cam && hooks.cam(1);
    });
    listen(window, 'keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Tab') hooks.map && hooks.map(false); });
    listen(window, 'blur', () => this.release());
    listen(document, 'contextmenu', (e) => e.preventDefault());
    listen(window, 'wheel', (e) => { if (!this.locked && !this.free) return; this.sel = (this.sel + (e.deltaY > 0 ? 1 : 2)) % 3; }, { passive: true });
    listen(surface, 'pointerdown', (e) => {
      hooks.unlock && hooks.unlock();
      if (e.pointerType === 'touch') {
        document.body.classList.add('touch'); this.free = true;
        if (e.clientX < innerWidth * 0.42 && !this.touch.move) this.touch.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        else if (!this.touch.look) this.touch.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
        try { surface.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      if (!this.locked && !this.free) { this.lock(); return; }
      if (e.button === 0) { this.fire = true; this.c.fc++; }
      else if (e.button === 2) { this.btn.use = true; this.c.uc++; }
    });
    listen(surface, 'pointermove', (e) => {
      const m = this.touch.move, l = this.touch.look;
      if (m && m.id === e.pointerId) { m.x = e.clientX; m.y = e.clientY; }
      if (l && l.id === e.pointerId) { this.look(e.clientX - l.x, e.clientY - l.y, 0.0052); l.x = e.clientX; l.y = e.clientY; }
    });
    const end = (e) => { const t = this.touch; if (t.move && t.move.id === e.pointerId) t.move = null; if (t.look && t.look.id === e.pointerId) t.look = null; if (e.button === 0 || e.pointerType === 'touch') this.fire = false; if (e.button === 2) this.btn.use = false; };
    listen(window, 'pointerup', end); listen(window, 'pointercancel', end);
  }
  look(dx, dy, k) { this.yaw -= dx * k * this.sens; this.pitch = clamp(this.pitch - dy * k * this.sens, -1.35, 1.35); }
  lock() {
    let r;
    try { r = this.surface.requestPointerLock({ unadjustedMovement: true }); } catch (e) { this.fallback(); return; }
    if (r && r.catch) r.catch(() => { let r2; try { r2 = this.surface.requestPointerLock(); } catch (e) { this.fallback(); return; } if (r2 && r2.catch) r2.catch(() => this.fallback()); });
  }
  fallback() { this.free = true; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  release() { this.keys.clear(); this.fire = false; this.btn.use = this.btn.fire = this.btn.run = false; this.touch.move = null; this.touch.look = null; }
  // boutons tactiles
  bindTouch(box) {
    for (const b of box.querySelectorAll('button[data-a]')) {
      const a = b.dataset.a;
      this.listen(b, 'pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); document.body.classList.add('touch'); this.free = true;
        if (a === 'use') { this.btn.use = true; this.c.uc++; }
        else if (a === 'fire') { this.btn.fire = true; this.fire = true; this.c.fc++; }
        else if (a === 'run') this.btn.run = true;
        else if (a === 'crouch') this.crouchLatch = !this.crouchLatch;
        else if (a === 'torch') this.c.tc++;
        else if (a === 'reload') this.c.rc++;
        else if (a === 'next') this.sel = (this.sel + 1) % 3;
        else if (a === 'a1' || a === 'a2' || a === 'a3') this.c[a]++;
        b.classList.add('on');
      });
      const up = () => { if (a === 'use') this.btn.use = false; else if (a === 'fire') { this.btn.fire = false; this.fire = false; } else if (a === 'run') this.btn.run = false; b.classList.remove('on'); };
      this.listen(b, 'pointerup', up); this.listen(b, 'pointerleave', up); this.listen(b, 'pointercancel', up);
    }
  }
  pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], gp = [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5)), edge = (i) => b(i) && !this.padPrev[i];
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    this.yaw -= rx * dt * 2.8 * this.sens; this.pitch = clamp(this.pitch - ry * dt * 2 * this.sens, -1.35, 1.35);
    // A : utiliser · gâchette droite : objet · LB : courir · B : accroupi · Y : lampe · X : pile · flèches : case · haut/gauche/droite : pouvoirs · Start : menu
    if (edge(0)) this.c.uc++;
    if (edge(7)) this.c.fc++;
    if (edge(1)) this.crouchLatch = !this.crouchLatch;
    if (edge(3)) this.c.tc++;
    if (edge(2)) this.c.rc++;
    if (edge(14)) { this.sel = 0; this.c.a1++; }
    if (edge(12)) { this.sel = 1; this.c.a2++; }
    if (edge(15)) { this.sel = 2; this.c.a3++; }
    if (edge(9) && this.h.menu) this.h.menu();
    const out = { lx, ly, use: b(0), fire: b(7), run: b(4) || b(10) };
    this.padPrev = gp.buttons.map((x, i) => b(i));
    return out;
  }
  sample(dt) {
    const K = this.keys;
    let mx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let my = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    const pad = this.pollPad(dt);
    if (pad && (pad.lx || pad.ly)) { mx = pad.lx; my = -pad.ly; }
    const m = this.touch.move;
    if (m) { const dx = m.x - m.ox, dy = m.y - m.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 60); mx = dx / d * k; my = -dy / d * k; } }
    return { mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, yaw: this.yaw, pitch: this.pitch, sel: this.sel,
      run: K.has('ShiftLeft') || K.has('ShiftRight') || this.btn.run || !!pad?.run, crouch: this.crouchLatch,
      use: K.has('KeyE') || this.btn.use || !!pad?.use, fire: this.fire || !!pad?.fire, ...this.c };
  }
  stick() { const m = this.touch.move; return m ? { ox: m.ox, oy: m.oy, x: m.x, y: m.y } : null; }
  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); this.unlock(); }
}
