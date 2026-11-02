// Mollo ! — clavier (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris, tactile et manette.
// Trois gestes, tous maintenus : Sauter (se hisser, soulever), Frapper (maintenu : gros coup), Saisir (les mains restent fermées tant qu'on tient).
// Les appuis sont comptés (pc, jc, gc) : un appui très bref ou un paquet perdu ne fait pas rater l'action.
// La caméra regarde vers le nord (-z) : le haut de l'écran est -z, la droite +x.
// Chaque écouteur passe par listen() : dispose() les retire tous.

export class Input {
  constructor(root, hooks = {}) {
    this.keys = new Set();
    this.pc = 0; this.jc = 0; this.gc = 0;
    this.mouse = { punch: false, grab: false }; this.btn = { punch: false, grab: false, jump: false }; this.pad = { punch: false, grab: false, jump: false };
    this.padPrev = []; this.touch = { move: null };
    this.mode = 'keys';
    this.off = [];
    const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); this.off.push(() => t.removeEventListener(type, fn, o)); };
    this.listen = listen;
    this.PUNCH = ['KeyF', 'KeyJ']; this.GRAB = ['KeyE', 'KeyK', 'KeyR']; this.JUMP = ['Space'];

    listen(window, 'keydown', (e) => {
      if (e.target.closest?.('input,textarea')) return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
      hooks.unlock && hooks.unlock();
      if (e.repeat) return;
      this.keys.add(k); this.mode = 'keys';
      if (this.JUMP.includes(k)) this.jc++;
      else if (this.PUNCH.includes(k)) this.pc++;
      else if (this.GRAB.includes(k)) this.gc++;
      else if (k === 'Escape' || k === 'KeyP') hooks.menu && hooks.menu();
      else if (k === 'KeyM') hooks.mute && hooks.mute();
      else if (k === 'Enter') hooks.enter && hooks.enter();
    });
    listen(window, 'keyup', (e) => this.keys.delete(e.code));
    listen(window, 'blur', () => { this.keys.clear(); this.mouse.punch = this.mouse.grab = false; this.btn.punch = this.btn.grab = this.btn.jump = false; this.touch.move = null; });
    listen(root, 'contextmenu', (e) => e.preventDefault());
    listen(root, 'pointerdown', (e) => {
      hooks.unlock && hooks.unlock();
      if (e.target.closest?.('button,.screen,.dd-vol')) return;
      if (e.pointerType === 'touch') {
        this.mode = 'touch'; document.body.classList.add('touch');
        if (e.clientX < innerWidth * 0.55 && !this.touch.move) {
          this.touch.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
          try { root.setPointerCapture(e.pointerId); } catch (err) {}
        }
        return;
      }
      this.mode = 'keys';
      if (e.button === 0) { this.mouse.punch = true; this.pc++; }
      else if (e.button === 2) { this.mouse.grab = true; this.gc++; }
      else if (e.button === 1) { e.preventDefault(); this.jc++; }
    });
    listen(root, 'pointermove', (e) => { const m = this.touch.move; if (m && m.id === e.pointerId) { m.x = e.clientX; m.y = e.clientY; } });
    const end = (e) => { const m = this.touch.move; if (m && m.id === e.pointerId) this.touch.move = null; if (e.button === 0) this.mouse.punch = false; if (e.button === 2) this.mouse.grab = false; };
    listen(window, 'pointerup', end); listen(window, 'pointercancel', end);
  }

  bindTouchButtons(box) {
    for (const b of box.querySelectorAll('button[data-a]')) {
      const a = b.dataset.a;
      this.listen(b, 'pointerdown', (e) => {
        e.preventDefault(); this.mode = 'touch'; document.body.classList.add('touch');
        this.btn[a] = true; if (a === 'punch') this.pc++; else if (a === 'jump') this.jc++; else this.gc++;
        b.classList.add('on');
      });
      const up = () => { this.btn[a] = false; b.classList.remove('on'); };
      this.listen(b, 'pointerup', up); this.listen(b, 'pointerleave', up); this.listen(b, 'pointercancel', up);
    }
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) { this.pad.punch = this.pad.grab = this.pad.jump = false; return null; }
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const edge = (i) => b(i) && !this.padPrev[i];
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    if (lx || ly || gp.buttons.some((x) => x.pressed)) this.mode = 'pad';
    // A : sauter · X ou gâchette droite : frapper · B ou gâchette gauche : saisir · Start : menu
    if (edge(0)) this.jc++;
    if (edge(2) || edge(7)) this.pc++;
    if (edge(1) || edge(6)) this.gc++;
    if (edge(9) && this.onMenu) this.onMenu();
    this.pad.jump = b(0); this.pad.punch = b(2) || b(7); this.pad.grab = b(1) || b(6);
    this.padPrev = gp.buttons.map((x, i) => b(i));
    return { lx, ly };
  }

  sample() {
    const K = this.keys, any = (l) => l.some((k) => K.has(k));
    let sx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let sy = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    const pad = this.pollPad();
    if (pad && (pad.lx || pad.ly)) { sx = pad.lx; sy = -pad.ly; }
    const m = this.touch.move;
    if (m) { const dx = m.x - m.ox, dy = m.y - m.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 60); sx = dx / d * k; sy = -dy / d * k; } }
    let mx = sx, mz = -sy;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return { mx: Math.round(mx * 100) / 100, mz: Math.round(mz * 100) / 100,
      jump: any(this.JUMP) || this.btn.jump || this.pad.jump, punch: any(this.PUNCH) || this.mouse.punch || this.btn.punch || this.pad.punch, grab: any(this.GRAB) || this.mouse.grab || this.btn.grab || this.pad.grab,
      pc: this.pc, jc: this.jc, gc: this.gc };
  }

  stick() { const m = this.touch.move; return m ? { ox: m.ox, oy: m.oy, x: m.x, y: m.y } : null; }

  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); }
}
