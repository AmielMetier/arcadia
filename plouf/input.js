// Plouf ! — clavier (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris, tactile et manette.
// Deux actions : Pousser (maintenir pour armer, lâcher pour foncer) et Attraper / lancer.
// Les appuis sont comptés (pc, gc) : un appui très bref ou un paquet perdu ne fait pas rater l'action.
// La caméra regarde vers le nord (-z) : le haut de l'écran est -z, la droite +x.
// Chaque écouteur passe par listen() : dispose() les retire tous.

export class Input {
  constructor(root, hooks = {}) {
    this.keys = new Set();
    this.pc = 0; this.gc = 0;               // appuis sur Pousser, sur Attraper
    this.mouseL = false; this.touchPush = false; this.padPush = false;
    this.padPrev = []; this.touch = { move: null };
    this.mode = 'keys';
    this.off = [];
    const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); this.off.push(() => t.removeEventListener(type, fn, o)); };
    this.listen = listen;
    const PUSH = ['Space'], GRAB = ['KeyE', 'KeyF', 'ShiftLeft', 'ShiftRight'];

    listen(window, 'keydown', (e) => {
      if (e.target.closest?.('input,textarea')) return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
      hooks.unlock && hooks.unlock();
      if (e.repeat) return;
      this.keys.add(k); this.mode = 'keys';
      if (PUSH.includes(k)) this.pc++;
      else if (GRAB.includes(k)) this.gc++;
      else if (k === 'Escape' || k === 'KeyP') hooks.menu && hooks.menu();
      else if (k === 'KeyM') hooks.mute && hooks.mute();
      else if (k === 'Enter') hooks.enter && hooks.enter();
    });
    listen(window, 'keyup', (e) => this.keys.delete(e.code));
    listen(window, 'blur', () => { this.keys.clear(); this.mouseL = false; this.touchPush = false; this.touch.move = null; });
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
      if (e.button === 0) { this.mouseL = true; this.pc++; }
      else if (e.button === 2) this.gc++;
    });
    listen(root, 'pointermove', (e) => { const m = this.touch.move; if (m && m.id === e.pointerId) { m.x = e.clientX; m.y = e.clientY; } });
    const end = (e) => { const m = this.touch.move; if (m && m.id === e.pointerId) this.touch.move = null; if (e.button === 0) this.mouseL = false; };
    listen(window, 'pointerup', end); listen(window, 'pointercancel', end);
  }

  // Boutons tactiles : Pousser (maintenir, lâcher) et Attraper
  bindTouchButtons(box) {
    for (const b of box.querySelectorAll('button[data-a]')) {
      const a = b.dataset.a;
      this.listen(b, 'pointerdown', (e) => {
        e.preventDefault(); this.mode = 'touch'; document.body.classList.add('touch');
        if (a === 'push') { this.touchPush = true; this.pc++; } else this.gc++;
        b.classList.add('on');
      });
      const up = () => { if (a === 'push') this.touchPush = false; b.classList.remove('on'); };
      this.listen(b, 'pointerup', up); this.listen(b, 'pointerleave', up); this.listen(b, 'pointercancel', up);
    }
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) { this.padPush = false; return null; }
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const edge = (i) => b(i) && !this.padPrev[i];
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    if (lx || ly || gp.buttons.some((x) => x.pressed)) this.mode = 'pad';
    // A ou gâchette droite : pousser · X, B ou bouton de tranche : attraper / lancer · Start : menu
    if (edge(0) || edge(7)) this.pc++;
    if (edge(2) || edge(1) || edge(5)) this.gc++;
    if (edge(9) && this.onMenu) this.onMenu();
    this.padPush = b(0) || b(7);
    this.padPrev = gp.buttons.map((x, i) => b(i));
    return { lx, ly };
  }

  // Commande du moment, dans le repère du monde
  sample() {
    const K = this.keys;
    let sx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let sy = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    const pad = this.pollPad();
    if (pad && (pad.lx || pad.ly)) { sx = pad.lx; sy = -pad.ly; }
    const m = this.touch.move;
    if (m) { const dx = m.x - m.ox, dy = m.y - m.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 60); sx = dx / d * k; sy = -dy / d * k; } }
    let mx = sx, mz = -sy;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    const push = K.has('Space') || this.mouseL || this.touchPush || this.padPush;
    return { mx: Math.round(mx * 100) / 100, mz: Math.round(mz * 100) / 100, push, pc: this.pc, gc: this.gc };
  }

  // joystick tactile à l'écran (base et pouce), pour l'affichage
  stick() { const m = this.touch.move; return m ? { ox: m.ox, oy: m.oy, x: m.x, y: m.y } : null; }

  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); }
}
