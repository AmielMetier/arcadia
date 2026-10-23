// Clavier (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris et manette.
export class Input {
  constructor(canvas, hooks = {}) {
    this.keys = new Set();
    this.mouse = { x: innerWidth / 2, y: innerHeight / 2, down: false, inside: false };
    this.c = { dash: 0, reload: 0, sw: 0, sl: 0, nade: 0, pk: 0, pi: -1, ab: 0, sk: 0 };
    this.useHeld = false; this.mode = 'mouse'; this.aim = -Math.PI / 2; this.padAim = null; this.padPrev = [];
    this.hooks = hooks; this.enabled = true; this.offerOpen = false;
    const kd = (e) => {
      if (!this.enabled || e.target.closest?.('input,textarea')) return;
      const k = e.code;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) e.preventDefault();
      if (e.repeat) return;
      this.keys.add(k); this.mode = 'mouse';
      if (k === 'Space' || k === 'Enter' || k === 'Escape') this.c.sk++;
      if (k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') this.c.dash++;
      else if (k === 'KeyR') this.c.reload++;
      else if (k === 'KeyG') this.c.nade++;
      else if (k === 'KeyQ' || k === 'KeyC') this.c.ab++;
      else if (/^Digit[1-4]$/.test(k) || /^Numpad[1-4]$/.test(k)) {
        const i = +k.slice(-1) - 1;
        if (this.offerOpen) { this.c.pk++; this.c.pi = i; } else { this.c.sw++; this.c.sl = i; }
      }
      else if (k === 'Escape') hooks.menu && hooks.menu();
      else if (k === 'KeyM') hooks.mute && hooks.mute();
      else if (k === 'KeyT' || k === 'Enter') hooks.chat && hooks.chat();
    };
    addEventListener('keydown', kd);
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.mouse.down = false; });
    // ---- tactile : stick de déplacement à gauche, stick de visée/tir à droite
    this.touch = { move: null, aim: null };
    const tMove = (e) => {
      const t = this.touch;
      for (const k of ['move', 'aim']) if (t[k] && t[k].id === e.pointerId) { t[k].x = e.clientX; t[k].y = e.clientY; }
    };
    const tEnd = (e) => { const t = this.touch; for (const k of ['move', 'aim']) if (t[k] && t[k].id === e.pointerId) t[k] = null; };
    canvas.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') { tMove(e); return; }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mode = 'mouse';
    });
    addEventListener('pointerup', (e) => { if (e.pointerType === 'touch') tEnd(e); });
    addEventListener('pointercancel', (e) => { if (e.pointerType === 'touch') tEnd(e); });
    canvas.addEventListener('pointerdown', (e) => {
      hooks.unlock && hooks.unlock();
      this.c.sk++;
      if (e.pointerType === 'touch') {
        this.mode = 'touch'; document.body.classList.add('touch');
        const side = e.clientX < innerWidth * 0.45 ? 'move' : 'aim';
        if (!this.touch[side]) this.touch[side] = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
        return;
      }
      this.mouse.x = e.clientX; this.mouse.y = e.clientY; this.mode = 'mouse';
      if (e.button === 0) this.mouse.down = true;
      else if (e.button === 2) this.c.nade++;
      else if (e.button === 1) { e.preventDefault(); this.c.dash++; }
      try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    });
    addEventListener('pointerup', (e) => { if (e.button === 0) this.mouse.down = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.c.sw++; this.c.sl = e.deltaY > 0 ? -1 : -2; }, { passive: false });
  }

  pickPerk(i) { this.c.pk++; this.c.pi = i; }

  // Lit la manette (bouton « front montant » pour les actions ponctuelles)
  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const prev = this.padPrev; const edge = (i) => b(i) && !prev[i];
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0), rx = dz(gp.axes[2] || 0), ry = dz(gp.axes[3] || 0);
    const any = lx || ly || rx || ry || gp.buttons.some((x) => x.pressed);
    if (any) this.mode = 'pad';
    if (edge(0) || edge(6)) { this.c.dash++; this.c.sk++; }
    if (edge(2)) this.c.reload++;
    if (edge(5)) { this.c.sw++; this.c.sl = -1; }
    if (edge(3)) this.c.ab++;
    if (edge(4)) this.c.nade++;
    if (edge(9)) this.hooks.menu && this.hooks.menu();
    if (this.offerOpen) { if (edge(14)) { this.c.pk++; this.c.pi = 0; } if (edge(12)) { this.c.pk++; this.c.pi = 1; } if (edge(15)) { this.c.pk++; this.c.pi = 2; } }
    this.padPrev = gp.buttons.map((x) => x.pressed || x.value > 0.5);
    if (Math.hypot(rx, ry) > 0.3) this.padAim = { a: Math.atan2(ry, rx), m: Math.min(1, Math.hypot(rx, ry)) };
    return { lx, ly, rx, ry, fire: b(7), use: b(1) };
  }

  // origin : position écran du joueur ; toWorldDist : distance écran → monde
  sample(origin, zoom) {
    const pad = this.pollPad();
    let mx = 0, my = 0;
    const K = this.keys;
    if (K.has('KeyW') || K.has('ArrowUp')) my -= 1;
    if (K.has('KeyS') || K.has('ArrowDown')) my += 1;
    if (K.has('KeyA') || K.has('ArrowLeft')) mx -= 1;
    if (K.has('KeyD') || K.has('ArrowRight')) mx += 1;
    let fire = this.mouse.down, use = K.has('KeyE') || K.has('KeyF') || this.touchUse, td = 300;
    if (this.mode === 'touch') {
      const { move, aim } = this.touch;
      if (move) { const dx = move.x - move.ox, dy = move.y - move.oy, d = Math.hypot(dx, dy); if (d > 8) { const m = Math.min(1, d / 60); mx = (dx / d) * m; my = (dy / d) * m; } }
      fire = false;
      if (aim) { const dx = aim.x - aim.ox, dy = aim.y - aim.oy, d = Math.hypot(dx, dy); if (d > 10) { this.aim = Math.atan2(dy, dx); td = 140 + Math.min(1, d / 80) * 300; fire = d > 26; } }
      else if (mx || my) this.aim = Math.atan2(my, mx);
    } else if (pad && this.mode === 'pad') {
      if (pad.lx || pad.ly) { mx = pad.lx; my = pad.ly; }
      fire = fire || pad.fire; use = use || pad.use;
      if (this.padAim) { this.aim = this.padAim.a; td = 140 + this.padAim.m * 300; }
      else if (mx || my) this.aim = Math.atan2(my, mx);
    } else if (origin) {
      this.aim = Math.atan2(this.mouse.y - origin.y, this.mouse.x - origin.x);
      td = Math.hypot(this.mouse.x - origin.x, this.mouse.y - origin.y) / (zoom || 1);
    }
    const l = Math.hypot(mx, my); if (l > 1) { mx /= l; my /= l; }
    return { mx, my, a: this.aim, fire, use, td, dash: this.c.dash, reload: this.c.reload, sw: this.c.sw, sl: this.c.sl, nade: this.c.nade, pk: this.c.pk, pi: this.c.pi, ab: this.c.ab, sk: this.c.sk };
  }

  crosshair(origin) {
    if (this.mode === 'pad' || this.mode === 'touch') return origin ? { x: origin.x + Math.cos(this.aim) * 170, y: origin.y + Math.sin(this.aim) * 170 } : null;
    return { x: this.mouse.x, y: this.mouse.y };
  }
}
