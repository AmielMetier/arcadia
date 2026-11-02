// Mystère Mystère : clavier (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris capturée, tactile et manette.
// Les actions sont comptées (fc : clic, sc : clic droit, uc : E, bc : coupure) : un appui bref ou un paquet perdu ne fait
// pas rater l'action. « draw » est l'état voulu de l'arme (sortie ou rangée) ; « ws » : arme choisie en mode découverte.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export class Input {
  constructor(surface, hooks = {}) {
    this.surface = surface; this.h = hooks;
    this.keys = new Set(); this.off = [];
    this.c = { fc: 0, sc: 0, uc: 0, bc: 0 };
    this.yaw = 0; this.pitch = 0; this.sens = 1; this.draw = false; this.ws = 0;
    this.btn = { run: false, jump: false };
    this.locked = false; this.free = false; this.touch = { move: null, look: null }; this.padPrev = [];
    const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); this.off.push(() => t.removeEventListener(type, fn, o)); };
    this.listen = listen;
    try { this.sens = clamp(+(localStorage.getItem('mystery_sens') || 1), 0.3, 3); } catch (e) {}
    listen(document, 'pointerlockchange', () => { const was = this.locked; this.locked = document.pointerLockElement === surface; if (was && !this.locked) { this.release(); hooks.unlocked && hooks.unlocked(); } });
    listen(document, 'mousemove', (e) => { if (!this.locked && !this.free) return; this.look(e.movementX, e.movementY, 0.0022); });
    listen(window, 'keydown', (e) => {
      if (e.target.closest?.('input,textarea,select')) return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
      hooks.unlock && hooks.unlock();
      if (e.repeat) return;
      this.keys.add(k);
      if (k === 'KeyE') this.c.uc++;
      else if (k === 'KeyF') this.c.bc++;
      else if (k === 'Digit1' || k === 'Numpad1') this.setDraw(false);
      else if (k === 'Digit2' || k === 'Numpad2') { this.ws = 0; this.setDraw(true); }
      else if (k === 'Digit3' || k === 'Numpad3') { this.ws = 1; this.setDraw(true); }
      else if (k === 'Tab') hooks.board && hooks.board(true);
      else if (k === 'Escape' || k === 'KeyP') hooks.menu && hooks.menu();
      else if (k === 'KeyM') hooks.mute && hooks.mute();
      else if (k === 'Enter') hooks.enter && hooks.enter();
      else if (k === 'ArrowLeft') hooks.spec && hooks.spec(-1);
      else if (k === 'ArrowRight') hooks.spec && hooks.spec(1);
    });
    listen(window, 'keyup', (e) => { this.keys.delete(e.code); if (e.code === 'Tab') hooks.board && hooks.board(false); });
    listen(window, 'blur', () => this.release());
    listen(document, 'contextmenu', (e) => e.preventDefault());
    listen(window, 'wheel', (e) => { if (!this.locked && !this.free) return; if (hooks.wheel) hooks.wheel(e.deltaY > 0 ? 1 : -1); else this.setDraw(!this.draw); }, { passive: true });
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
      if (e.button === 0) this.primary();
      else if (e.button === 2) this.secondary();
    });
    listen(surface, 'pointermove', (e) => {
      const m = this.touch.move, l = this.touch.look;
      if (m && m.id === e.pointerId) { m.x = e.clientX; m.y = e.clientY; }
      if (l && l.id === e.pointerId) { this.look(e.clientX - l.x, e.clientY - l.y, 0.0052); l.x = e.clientX; l.y = e.clientY; }
    });
    const end = (e) => { const t = this.touch; if (t.move && t.move.id === e.pointerId) t.move = null; if (t.look && t.look.id === e.pointerId) t.look = null; };
    listen(window, 'pointerup', end); listen(window, 'pointercancel', end);
  }
  // clic : sort l'arme si elle est rangée, sinon frappe ou tire
  primary() { if (this.h.canDraw && !this.h.canDraw()) { this.c.fc++; return; } if (!this.draw) { this.setDraw(true); return; } this.c.fc++; }
  secondary() { if (!this.draw && this.h.canDraw && this.h.canDraw()) { this.setDraw(true); return; } this.c.sc++; }
  setDraw(on) { if (this.draw !== on) { this.draw = on; this.h.drawChanged && this.h.drawChanged(on); } }
  look(dx, dy, k) { this.yaw -= dx * k * this.sens; this.pitch = clamp(this.pitch - dy * k * this.sens, -1.4, 1.4); }
  setSens(v) { this.sens = clamp(v, 0.3, 3); try { localStorage.setItem('mystery_sens', String(this.sens)); } catch (e) {} }
  lock() {
    let r;
    try { r = this.surface.requestPointerLock({ unadjustedMovement: true }); } catch (e) { this.fallback(); return; }
    if (r && r.catch) r.catch(() => { let r2; try { r2 = this.surface.requestPointerLock(); } catch (e) { this.fallback(); return; } if (r2 && r2.catch) r2.catch(() => this.fallback()); });
  }
  fallback() { this.free = true; }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  release() { this.keys.clear(); this.btn.run = this.btn.jump = false; this.touch.move = null; this.touch.look = null; }
  // boutons tactiles
  bindTouch(box) {
    for (const b of box.querySelectorAll('button[data-a]')) {
      const a = b.dataset.a;
      this.listen(b, 'pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation(); document.body.classList.add('touch'); this.free = true;
        if (a === 'fire') this.primary();
        else if (a === 'alt') this.secondary();
        else if (a === 'use') this.c.uc++;
        else if (a === 'draw') this.setDraw(!this.draw);
        else if (a === 'bo') this.c.bc++;
        else if (a === 'run') this.btn.run = true;
        else if (a === 'jump') this.btn.jump = true;
        b.classList.add('on');
      });
      const up = () => { if (a === 'run') this.btn.run = false; else if (a === 'jump') this.btn.jump = false; b.classList.remove('on'); };
      this.listen(b, 'pointerup', up); this.listen(b, 'pointerleave', up); this.listen(b, 'pointercancel', up);
    }
  }
  pollPad(dt) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [], gp = [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5)), edge = (i) => b(i) && !this.padPrev[i];
    const dz = (v) => (Math.abs(v) < 0.18 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    this.yaw -= rx * dt * 2.8 * this.sens; this.pitch = clamp(this.pitch - ry * dt * 2 * this.sens, -1.4, 1.4);
    // gâchette droite : frapper / tirer · gâchette gauche : lancer · A : sauter · X : utiliser · Y : arme · B : coupure · LB : courir
    if (edge(7)) this.primary();
    if (edge(6)) this.secondary();
    if (edge(2)) this.c.uc++;
    if (edge(3)) this.setDraw(!this.draw);
    if (edge(1)) this.c.bc++;
    if (edge(9) && this.h.menu) this.h.menu();
    const out = { lx, ly, jump: b(0), run: b(4) || b(10) };
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
    return { mx: Math.round(mx * 100) / 100, my: Math.round(my * 100) / 100, yaw: this.yaw, pitch: this.pitch,
      run: K.has('ShiftLeft') || K.has('ShiftRight') || this.btn.run || !!pad?.run, jump: K.has('Space') || this.btn.jump || !!pad?.jump,
      draw: this.draw, ws: this.ws, ...this.c };
  }
  stick() { const m = this.touch.move; return m ? { ox: m.ox, oy: m.oy, x: m.x, y: m.y } : null; }
  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); this.unlock(); }
}
