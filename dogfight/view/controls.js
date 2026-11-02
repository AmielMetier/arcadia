// Gestionnaire d'entrées (clavier, souris, manette, tactile) pour Dogfight 3D.

export class FlightControls {
  constructor({ onFirstGesture = null } = {}) {
    this.keys = new Set();
    this.mouse = { x: 0, y: 0, active: false, firing: false };
    this.touch = { aimX: 0, aimY: 0, fire: false, boost: false, brake: false };
    this.onFirstGesture = onFirstGesture;
    this.gestureTriggered = false;

    this.onKeyDown = (e) => {
      this.triggerGesture();
      this.keys.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    };

    this.onKeyUp = (e) => {
      this.keys.delete(e.code);
    };

    this.onMouseMove = (e) => {
      this.triggerGesture();
      const halfW = window.innerWidth / 2;
      const halfH = window.innerHeight / 2;
      // Normalisé entre -1 et 1 par rapport au centre de l'écran
      this.mouse.x = Math.max(-1, Math.min(1, (e.clientX - halfW) / (halfW * 0.85)));
      this.mouse.y = Math.max(-1, Math.min(1, (e.clientY - halfH) / (halfH * 0.85)));
      this.mouse.active = true;
    };

    this.onMouseDown = (e) => {
      this.triggerGesture();
      if (e.button === 0) {
        this.mouse.firing = true;
      }
    };

    this.onMouseUp = (e) => {
      if (e.button === 0) {
        this.mouse.firing = false;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('mousedown', this.onMouseDown);
    window.addEventListener('mouseup', this.onMouseUp);
    window.addEventListener('pointerdown', () => this.triggerGesture());
  }

  triggerGesture() {
    if (!this.gestureTriggered && this.onFirstGesture) {
      this.gestureTriggered = true;
      this.onFirstGesture();
    }
  }

  getInput() {
    const k = this.keys;

    // Détection manette
    const gp = this.getGamepadInput();
    if (gp) return gp;

    // Commandes clavier (gauche et droite inversées)
    const pitchUp = k.has('KeyS') || k.has('ArrowDown');
    const pitchDown = k.has('KeyZ') || k.has('KeyW') || k.has('ArrowUp');
    const rollLeft = k.has('KeyD') || k.has('ArrowRight');
    const rollRight = k.has('KeyQ') || k.has('KeyA') || k.has('ArrowLeft');
    const yawLeft = k.has('KeyL');
    const yawRight = k.has('KeyJ');

    const boost = k.has('ShiftLeft') || k.has('ShiftRight') || this.touch.boost;
    const brake = k.has('ControlLeft') || k.has('ControlRight') || k.has('KeyC') || k.has('KeyX') || this.touch.brake;
    const fire = this.mouse.firing || k.has('Space') || k.has('KeyF') || k.has('Enter') || this.touch.fire;

    // Pilotage 100% autonome au clavier : le relâchement des touches stabilise l'avion en ligne droite
    return {
      mouseAim: false,
      aimX: 0,
      aimY: 0,
      pitchUp,
      pitchDown,
      rollLeft,
      rollRight,
      yawLeft,
      yawRight,
      boost,
      brake,
      fire,
    };
  }

  getGamepadInput() {
    try {
      const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
      if (!gamepads || !gamepads[0]) return null;
      const gp = gamepads[0];
      const deadzone = 0.15;

      const lx = Math.abs(gp.axes[0]) > deadzone ? gp.axes[0] : 0;
      const ly = Math.abs(gp.axes[1]) > deadzone ? gp.axes[1] : 0;

      const boost = gp.buttons[7]?.value > 0.3 || gp.buttons[5]?.pressed; // Gâchette droite / R1
      const brake = gp.buttons[6]?.value > 0.3 || gp.buttons[4]?.pressed; // Gâchette gauche / L1
      const fire = gp.buttons[0]?.pressed || gp.buttons[7]?.pressed;      // Bouton A / Gâchette

      return {
        mouseAim: true,
        aimX: -lx,
        aimY: ly,
        pitchUp: ly > 0.3,
        pitchDown: ly < -0.3,
        rollLeft: lx > 0.3,
        rollRight: lx < -0.3,
        yawLeft: gp.buttons[15]?.pressed,
        yawRight: gp.buttons[14]?.pressed,
        boost,
        brake,
        fire,
      };
    } catch (e) {
      return null;
    }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('mousedown', this.onMouseDown);
    window.removeEventListener('mouseup', this.onMouseUp);
  }
}
