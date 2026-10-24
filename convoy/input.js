// Convoy Storm — clavier (touches physiques : ZQSD sur AZERTY = WASD sur QWERTY), souris, tactile et manette.
// Chaque écouteur passe par listen() : dispose() les retire tous (aucune fuite quand on quitte la partie).
// La commande renvoyée est déjà dans le repère du monde : le haut de l'écran correspond à la direction de la caméra.
import { CAM_DIR } from './view/scene.js';

export class Input {
  constructor(root, hooks = {}) {
    this.keys = new Set();
    this.c = { jump: 0, thr: 0, fl: 0 };          // compteurs : une pression = une action, même si un paquet se perd
    this.useMouse = false; this.useTouch = false; this.padPrev = [];
    this.touch = { move: null };
    this.mode = 'keys';
    this.off = [];
    const listen = (t, type, fn, o) => { t.addEventListener(type, fn, o); this.off.push(() => t.removeEventListener(type, fn, o)); };
    this.listen = listen;

    listen(window, 'keydown', (e) => {
      if (e.target.closest?.('input,textarea')) return;
      const k = e.code;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(k)) e.preventDefault();
      hooks.unlock && hooks.unlock();
      if (e.repeat) return;
      this.keys.add(k); this.mode = 'keys';
      if (k === 'Space') this.c.jump++;
      else if (k === 'KeyF' || k === 'KeyR') this.c.thr++;
      else if (k === 'KeyG') this.c.fl++;
      else if (k === 'Escape' || k === 'KeyP') hooks.menu && hooks.menu();
      else if (k === 'KeyM') hooks.mute && hooks.mute();
      else hooks.key && hooks.key(k);
    });
    listen(window, 'keyup', (e) => this.keys.delete(e.code));
    listen(window, 'blur', () => { this.keys.clear(); this.useMouse = false; this.touch.move = null; });
    listen(root, 'contextmenu', (e) => e.preventDefault());
    listen(root, 'pointerdown', (e) => {
      hooks.unlock && hooks.unlock();
      if (e.target.closest?.('button,.screen')) return;
      if (e.pointerType === 'touch') {
        this.mode = 'touch'; document.body.classList.add('touch');
        if (e.clientX < innerWidth * 0.55 && !this.touch.move) {
          this.touch.move = { id: e.pointerId, ox: e.clientX, oy: e.clientY, x: e.clientX, y: e.clientY };
          try { root.setPointerCapture(e.pointerId); } catch (err) {}
        }
        return;
      }
      if (e.button === 0) this.useMouse = true;
      else if (e.button === 2) this.c.thr++;
    });
    listen(root, 'pointermove', (e) => { const m = this.touch.move; if (m && m.id === e.pointerId) { m.x = e.clientX; m.y = e.clientY; } });
    const end = (e) => { const m = this.touch.move; if (m && m.id === e.pointerId) this.touch.move = null; if (e.button === 0) this.useMouse = false; };
    listen(window, 'pointerup', end); listen(window, 'pointercancel', end);
  }

  // Boutons tactiles (sauter, fouiller/prendre/creuser, lancer, fusée)
  bindTouchButtons(box) {
    for (const b of box.querySelectorAll('button[data-a]')) {
      const a = b.dataset.a;
      this.listen(b, 'pointerdown', (e) => { e.preventDefault(); if (a === 'use') this.useTouch = true; else this.c[a]++; });
      const up = () => { if (a === 'use') this.useTouch = false; };
      this.listen(b, 'pointerup', up); this.listen(b, 'pointerleave', up); this.listen(b, 'pointercancel', up);
    }
  }

  pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    const gp = [...pads].find((p) => p && p.connected);
    if (!gp) return null;
    const b = (i) => !!(gp.buttons[i] && (gp.buttons[i].pressed || gp.buttons[i].value > 0.5));
    const edge = (i) => b(i) && !this.padPrev[i];
    const dz = (v) => (Math.abs(v) < 0.2 ? 0 : v);
    const lx = dz(gp.axes[0] || 0), ly = dz(gp.axes[1] || 0);
    if (lx || ly || gp.buttons.some((x) => x.pressed)) this.mode = 'pad';
    if (edge(0)) this.c.jump++;
    if (edge(1) || edge(5)) this.c.thr++;
    if (edge(3) || edge(4)) this.c.fl++;
    const use = b(2) || b(7);
    this.padPrev = gp.buttons.map((x, i) => b(i));
    return { lx, ly, use };
  }

  // Commande du moment : { mx, mz } dans le repère du monde, use maintenu, compteurs jump / thr
  sample() {
    const K = this.keys;
    let sx = (K.has('KeyD') || K.has('ArrowRight') ? 1 : 0) - (K.has('KeyA') || K.has('ArrowLeft') ? 1 : 0);
    let sy = (K.has('KeyW') || K.has('ArrowUp') ? 1 : 0) - (K.has('KeyS') || K.has('ArrowDown') ? 1 : 0);
    let use = K.has('KeyE') || K.has('Enter') || this.useMouse || this.useTouch;
    const pad = this.pollPad();
    if (pad && (pad.lx || pad.ly)) { sx = pad.lx; sy = -pad.ly; }
    if (pad && pad.use) use = true;
    const m = this.touch.move;
    if (m) { const dx = m.x - m.ox, dy = m.y - m.oy, d = Math.hypot(dx, dy); if (d > 8) { const k = Math.min(1, d / 60); sx = dx / d * k; sy = -dy / d * k; } }
    // écran → monde : haut = CAM_DIR, droite = CAM_DIR tourné d'un quart de tour
    const fx = CAM_DIR.x, fz = CAM_DIR.z, rx = -fz, rz = fx;
    let mx = fx * sy + rx * sx, mz = fz * sy + rz * sx;
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    return { mx: Math.round(mx * 100) / 100, mz: Math.round(mz * 100) / 100, use, jump: this.c.jump, thr: this.c.thr, fl: this.c.fl };
  }

  dispose() { for (const f of this.off) f(); this.off = []; this.keys.clear(); }
}
