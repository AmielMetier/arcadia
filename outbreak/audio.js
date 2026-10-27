// Sons synthétisés (WebAudio), sans fichier. Volume selon la distance à l'écouteur (le joueur local).
// Deux réglages du joueur (panneau Réglages) : la musique d'ambiance et les bruitages, chacun sur son bus ;
// à 0, ils se taisent (l'ancien bouton « son coupé » met les deux à 0).
export class Audio {
  constructor() {
    this.ctx = null; this.master = null; this.lx = 0; this.ly = 0; this.intensity = 0; this.musicOn = false;
    DDVolume.legacy('outbreak_mute');
    this.last = {};
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.55;
    const comp = this.ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 6;
    this.master.connect(comp); comp.connect(this.ctx.destination);
    this.fx = DDVolume.gain(this.ctx, 'fx'); this.fx.connect(this.master);
    this.mus = DDVolume.gain(this.ctx, 'music'); this.mus.connect(this.master);
    const len = this.ctx.sampleRate * 1.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startMusic();
  }
  listener(x, y) { this.lx = x; this.ly = y; }

  // volume selon la distance ; null = inaudible
  vol(x, y, base = 1) {
    if (x == null) return base;
    const d = Math.hypot(x - this.lx, y - this.ly);
    if (d > 1400) return null;
    return base * Math.max(0.08, 1 - d / 1400);
  }
  pan(x) { return x == null ? 0 : Math.max(-0.8, Math.min(0.8, (x - this.lx) / 700)); }
  out(v, x, bus = this.fx) {
    const g = this.ctx.createGain(); g.gain.value = v;
    if (this.ctx.createStereoPanner) { const p = this.ctx.createStereoPanner(); p.pan.value = this.pan(x); g.connect(p); p.connect(bus); }
    else g.connect(bus);
    return g;
  }
  noise(dest, t, dur, { type = 'lowpass', f0 = 1000, f1 = f0, q = 1, a = 0.002, v = 1 } = {}) {
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1); s.stop(t + dur + 0.05);
  }
  tone(dest, t, dur, { type = 'sine', f0 = 440, f1 = f0, a = 0.005, v = 1, vib = 0 } = {}) {
    const o = this.ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    if (vib) { const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = vib; lg.gain.value = f0 * 0.06; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  play(name, x, y, base = 1) {
    if (!this.ctx || !(DDVolume.get('fx') > 0)) return;
    // limiter les sons répétés (rafales, impacts)
    const now = this.ctx.currentTime, gap = { hit: 0.03, smg: 0.04, minigun: 0.04, flamer: 0.09, groan: 0.5, zs: 0.08, spark: 0.05, step: 0.1 }[name] || 0;
    if (gap && this.last[name] && now - this.last[name] < gap) return;
    this.last[name] = now;
    const v = this.vol(x, y, base); if (v == null) return;
    const o = this.out(v, x), t = now + 0.005;
    switch (name) {
      case 'pistol': this.noise(o, t, 0.12, { type: 'bandpass', f0: 2400, f1: 600, q: 0.8, v: 0.8 }); this.tone(o, t, 0.1, { f0: 160, f1: 50, v: 0.6 }); break;
      case 'smg': this.noise(o, t, 0.07, { type: 'bandpass', f0: 3000, f1: 900, q: 0.9, v: 0.5 }); this.tone(o, t, 0.06, { f0: 200, f1: 70, v: 0.35 }); break;
      case 'rifle': this.noise(o, t, 0.14, { type: 'bandpass', f0: 2000, f1: 400, q: 0.7, v: 0.7 }); this.tone(o, t, 0.12, { f0: 130, f1: 45, v: 0.6 }); break;
      case 'minigun': this.noise(o, t, 0.06, { type: 'bandpass', f0: 2600, f1: 800, q: 1, v: 0.4 }); this.tone(o, t, 0.05, { f0: 180, f1: 60, v: 0.25 }); break;
      case 'shotgun': this.noise(o, t, 0.32, { f0: 3000, f1: 200, v: 1 }); this.tone(o, t, 0.25, { f0: 110, f1: 35, v: 1 }); this.noise(o, t + 0.28, 0.06, { type: 'highpass', f0: 3000, v: 0.25 }); break;
      case 'rail': this.tone(o, t, 0.35, { type: 'sawtooth', f0: 1800, f1: 120, v: 0.35 }); this.noise(o, t, 0.25, { type: 'highpass', f0: 4000, f1: 800, v: 0.4 }); this.tone(o, t, 0.2, { f0: 90, f1: 40, v: 0.6 }); break;
      case 'launcher': this.tone(o, t, 0.2, { f0: 260, f1: 70, v: 0.8 }); this.noise(o, t, 0.12, { f0: 900, f1: 200, v: 0.5 }); break;
      case 'flamer': this.noise(o, t, 0.16, { type: 'bandpass', f0: 500, f1: 900, q: 0.6, v: 0.35 }); break;
      case 'dry': this.noise(o, t, 0.03, { type: 'highpass', f0: 3000, v: 0.4 }); break;
      case 'reload': this.noise(o, t, 0.04, { type: 'highpass', f0: 2500, v: 0.35 }); this.noise(o, t + 0.12, 0.05, { type: 'bandpass', f0: 1500, v: 0.35 }); break;
      case 'reloaded': this.noise(o, t, 0.04, { type: 'bandpass', f0: 1200, v: 0.45 }); this.noise(o, t + 0.07, 0.05, { type: 'highpass', f0: 2600, v: 0.45 }); break;
      case 'switch': this.noise(o, t, 0.05, { type: 'bandpass', f0: 1800, v: 0.3 }); break;
      case 'hit': this.noise(o, t, 0.07, { f0: 700, f1: 150, v: 0.45 }); break;
      case 'crit': this.noise(o, t, 0.07, { f0: 900, f1: 150, v: 0.5 }); this.tone(o, t, 0.12, { type: 'triangle', f0: 1400, f1: 1800, v: 0.18 }); break;
      case 'zdie': this.noise(o, t, 0.28, { f0: 900, f1: 80, v: 0.55 }); this.tone(o, t, 0.25, { type: 'sawtooth', f0: 110 + Math.random() * 40, f1: 50, v: 0.12 }); break;
      case 'groan': {
        const f = 70 + Math.random() * 60, d = 0.6 + Math.random() * 0.6;
        const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400 + Math.random() * 300; bp.Q.value = 3; bp.connect(o);
        this.tone(bp, t, d, { type: 'sawtooth', f0: f, f1: f * 0.8, a: 0.15, v: 0.6, vib: 5 + Math.random() * 3 });
        break;
      }
      case 'zs': this.noise(o, t, 0.12, { type: 'bandpass', f0: 600, f1: 1600, q: 1.5, v: 0.25 }); break;
      case 'boom': this.noise(o, t, 1.3, { f0: 1600, f1: 60, a: 0.005, v: 1 }); this.tone(o, t, 0.8, { f0: 70, f1: 25, v: 1 }); break;
      case 'smallboom': this.noise(o, t, 0.6, { f0: 1200, f1: 80, v: 0.7 }); this.tone(o, t, 0.4, { f0: 90, f1: 35, v: 0.7 }); break;
      case 'hurt': this.tone(o, t, 0.18, { type: 'square', f0: 230, f1: 140, v: 0.12 }); this.noise(o, t, 0.1, { f0: 500, f1: 100, v: 0.5 }); break;
      case 'down': this.tone(o, t, 0.6, { type: 'triangle', f0: 400, f1: 120, v: 0.35 }); break;
      case 'revive': [523, 659, 784].forEach((f, i) => this.tone(o, t + i * 0.08, 0.25, { type: 'triangle', f0: f, v: 0.3 })); break;
      case 'pickup': this.tone(o, t, 0.12, { type: 'triangle', f0: 880, v: 0.25 }); this.tone(o, t + 0.07, 0.16, { type: 'triangle', f0: 1320, v: 0.22 }); break;
      case 'heal': [660, 880, 1100].forEach((f, i) => this.tone(o, t + i * 0.05, 0.18, { type: 'sine', f0: f, v: 0.2 })); break;
      case 'weapon': this.noise(o, t, 0.06, { type: 'bandpass', f0: 1500, v: 0.5 }); this.noise(o, t + 0.1, 0.07, { type: 'highpass', f0: 2500, v: 0.5 }); this.tone(o, t + 0.12, 0.25, { type: 'triangle', f0: 990, v: 0.2 }); break;
      case 'vent': [310, 467, 733].forEach((f) => this.tone(o, t, 0.5, { type: 'triangle', f0: f, f1: f * 0.97, v: 0.16 })); this.noise(o, t, 0.15, { type: 'bandpass', f0: 800, v: 0.3 }); break;
      case 'spit': this.noise(o, t, 0.22, { type: 'bandpass', f0: 400, f1: 1500, q: 2, v: 0.5 }); break;
      case 'splash': this.noise(o, t, 0.45, { type: 'highpass', f0: 2500, f1: 5000, v: 0.3 }); break;
      case 'scream': this.tone(o, t, 0.9, { type: 'sawtooth', f0: 700, f1: 950, a: 0.05, v: 0.25, vib: 18 }); this.noise(o, t, 0.8, { type: 'bandpass', f0: 2500, q: 2, v: 0.2 }); break;
      case 'roar': this.tone(o, t, 1.0, { type: 'sawtooth', f0: 85, f1: 55, a: 0.08, v: 0.5, vib: 9 }); this.noise(o, t, 0.9, { f0: 400, f1: 150, v: 0.4 }); break;
      case 'slam': this.noise(o, t, 0.7, { f0: 600, f1: 50, v: 0.9 }); this.tone(o, t, 0.5, { f0: 55, f1: 25, v: 1 }); break;
      case 'alarm': for (let k = 0; k < 2; k++) { this.tone(o, t + k * 0.7, 0.35, { type: 'square', f0: 620, v: 0.08 }); this.tone(o, t + k * 0.7 + 0.35, 0.35, { type: 'square', f0: 470, v: 0.08 }); } break;
      case 'clear': [523, 659, 784, 1046].forEach((f, i) => this.tone(o, t + i * 0.11, 0.5, { type: 'triangle', f0: f, v: 0.25 })); break;
      case 'door': this.noise(o, t, 0.9, { type: 'bandpass', f0: 300, f1: 1200, v: 0.4 }); this.tone(o, t, 0.8, { f0: 60, f1: 45, v: 0.5 }); break;
      case 'wave': this.tone(o, t, 0.9, { type: 'sawtooth', f0: 98, f1: 92, a: 0.05, v: 0.22 }); this.tone(o, t, 0.9, { type: 'sawtooth', f0: 147, f1: 139, a: 0.05, v: 0.16 }); break;
      case 'perk': [784, 988, 1175, 1568].forEach((f, i) => this.tone(o, t + i * 0.06, 0.3, { type: 'sine', f0: f, v: 0.18 })); break;
      case 'offer': [440, 660].forEach((f, i) => this.tone(o, t + i * 0.1, 0.25, { type: 'triangle', f0: f, v: 0.18 })); break;
      case 'dash': this.noise(o, t, 0.22, { type: 'bandpass', f0: 600, f1: 2200, q: 1.2, v: 0.35 }); break;
      case 'throw': this.noise(o, t, 0.18, { type: 'bandpass', f0: 900, f1: 1800, q: 1.5, v: 0.25 }); break;
      case 'fuse': this.noise(o, t, 0.75, { type: 'highpass', f0: 2000, f1: 6000, a: 0.3, v: 0.35 }); break;
      case 'crate': this.noise(o, t, 0.25, { type: 'bandpass', f0: 500, f1: 250, q: 0.8, v: 0.6 }); break;
      case 'spark': this.noise(o, t, 0.04, { type: 'highpass', f0: 4000, v: 0.18 }); break;
      case 'boss': this.tone(o, t, 2.2, { type: 'sawtooth', f0: 55, f1: 41, a: 0.2, v: 0.4, vib: 3 }); this.tone(o, t, 2.2, { type: 'sawtooth', f0: 82, f1: 61, a: 0.2, v: 0.3 }); break;
      case 'won': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(o, t + i * 0.14, 0.7, { type: 'triangle', f0: f, v: 0.25 })); break;
      case 'over': [392, 330, 262, 196].forEach((f, i) => this.tone(o, t + i * 0.22, 0.6, { type: 'triangle', f0: f, v: 0.25 })); break;
      case 'slash': this.noise(o, t, 0.16, { type: 'bandpass', f0: 1800, f1: 5000, q: 1.2, v: 0.45 }); break;
      case 'crossbow': this.noise(o, t, 0.08, { type: 'bandpass', f0: 900, f1: 300, q: 2, v: 0.6 }); this.tone(o, t, 0.18, { type: 'triangle', f0: 180, f1: 90, v: 0.4 }); break;
      case 'tesla': this.tone(o, t, 0.2, { type: 'sawtooth', f0: 90, f1: 60, v: 0.25 }); this.noise(o, t, 0.22, { type: 'highpass', f0: 3500, f1: 7000, v: 0.4 }); this.tone(o, t, 0.15, { type: 'square', f0: 1200, f1: 400, v: 0.08 }); break;
      case 'clank': this.tone(o, t, 0.25, { type: 'triangle', f0: 1650, f1: 1500, v: 0.18 }); this.tone(o, t, 0.2, { type: 'triangle', f0: 2470, f1: 2300, v: 0.1 }); this.noise(o, t, 0.05, { type: 'highpass', f0: 3000, v: 0.3 }); break;
      case 'ability': [392, 523, 659, 784].forEach((f, i) => this.tone(o, t + i * 0.04, 0.3, { type: 'square', f0: f, v: 0.07 })); this.noise(o, t, 0.3, { type: 'bandpass', f0: 600, f1: 2400, v: 0.3 }); break;
      case 'ready': this.tone(o, t, 0.12, { type: 'triangle', f0: 1046, v: 0.15 }); this.tone(o, t + 0.08, 0.2, { type: 'triangle', f0: 1568, v: 0.15 }); break;
      case 'pounce': this.tone(o, t, 0.4, { type: 'sawtooth', f0: 500, f1: 1100, a: 0.02, v: 0.22, vib: 25 }); this.noise(o, t, 0.3, { type: 'bandpass', f0: 1500, q: 2, v: 0.25 }); break;
      case 'buy': [784, 1046, 1318].forEach((f, i) => this.tone(o, t + i * 0.05, 0.2, { type: 'square', f0: f, v: 0.08 })); this.noise(o, t, 0.12, { type: 'highpass', f0: 5000, v: 0.3 }); break;
      case 'powerdown': this.tone(o, t, 1.2, { type: 'sawtooth', f0: 220, f1: 30, a: 0.01, v: 0.25 }); this.noise(o, t, 0.2, { type: 'bandpass', f0: 2000, v: 0.3 }); break;
      case 'powerup': this.tone(o, t, 0.8, { type: 'sawtooth', f0: 40, f1: 220, a: 0.05, v: 0.2 }); break;
      case 'plane': this.tone(o, t, 2.5, { type: 'sawtooth', f0: 70, f1: 60, a: 0.6, v: 0.12, vib: 12 }); this.noise(o, t, 2.5, { f0: 300, f1: 200, a: 0.8, v: 0.2 }); break;
      case 'horn': for (let k = 0; k < 2; k++) { this.tone(o, t + k * 0.55, 0.45, { type: 'sawtooth', f0: 311, v: 0.18 }); this.tone(o, t + k * 0.55, 0.45, { type: 'sawtooth', f0: 392, v: 0.14 }); } break;
      case 'trainPass': this.noise(o, t, 1.4, { f0: 600, f1: 120, a: 0.1, v: 0.9 }); this.tone(o, t, 1.3, { type: 'sawtooth', f0: 70, f1: 50, a: 0.1, v: 0.35 }); for (let k = 0; k < 8; k++) this.noise(o, t + k * 0.14, 0.05, { type: 'highpass', f0: 2500, v: 0.4 }); break;
      case 'carAlarm': for (let k = 0; k < 8; k++) this.tone(o, t + k * 0.25, 0.22, { type: 'square', f0: k % 2 ? 880 : 1175, v: 0.09 }); break;
      case 'radio': this.noise(o, t, 0.12, { type: 'bandpass', f0: 2200, q: 3, v: 0.25 }); this.tone(o, t + 0.1, 0.06, { type: 'square', f0: 1400, v: 0.05 }); break;
      case 'note': [523, 784, 659].forEach((f, i) => this.tone(o, t + i * 0.09, 0.3, { type: 'triangle', f0: f, v: 0.16 })); this.noise(o, t, 0.15, { type: 'highpass', f0: 3000, v: 0.2 }); break;
      case 'heli': this.noise(o, t, 2.6, { type: 'lowpass', f0: 500, f1: 300, a: 0.4, v: 0.35 }); for (let k = 0; k < 20; k++) this.noise(o, t + k * 0.12, 0.06, { type: 'lowpass', f0: 300, v: 0.4 }); break;
      case 'static': this.noise(o, t, 1.6, { type: 'bandpass', f0: 3000, q: 0.5, a: 0.05, v: 0.25 }); break;
      case 'build': this.noise(o, t, 0.08, { type: 'bandpass', f0: 900, v: 0.5 }); this.noise(o, t + 0.12, 0.08, { type: 'bandpass', f0: 1200, v: 0.5 }); this.tone(o, t + 0.2, 0.25, { type: 'triangle', f0: 880, v: 0.15 }); break;
      case 'hammer': this.noise(o, t, 0.05, { type: 'bandpass', f0: 1600, q: 3, v: 0.4 }); this.tone(o, t, 0.06, { type: 'triangle', f0: 600, v: 0.1 }); break;
      case 'wood': this.noise(o, t, 0.12, { type: 'bandpass', f0: 400, f1: 250, q: 1.5, v: 0.5 }); break;
      case 'whoosh': this.noise(o, t, 0.9, { type: 'bandpass', f0: 300, f1: 2400, q: 0.8, a: 0.4, v: 0.55 }); break;
      case 'thunder': this.noise(o, t, 2.2, { f0: 800, f1: 60, a: 0.01, v: 1 }); this.tone(o, t, 1.6, { f0: 50, f1: 28, v: 0.8 }); this.noise(o, t + 0.25, 1.4, { f0: 400, f1: 50, v: 0.6 }); break;
      case 'slam': this.tone(o, t, 0.45, { f0: 120, f1: 38, v: 0.9 }); this.noise(o, t, 0.25, { f0: 2500, f1: 200, v: 0.6 }); this.tone(o, t, 0.6, { type: 'sawtooth', f0: 220, f1: 180, a: 0.01, v: 0.08 }); break;
      case 'titleHit': this.tone(o, t, 1.6, { f0: 55, f1: 30, v: 1 }); this.noise(o, t, 1.2, { f0: 3000, f1: 80, v: 0.8 }); [110, 165, 220].forEach((f) => this.tone(o, t, 2.2, { type: 'sawtooth', f0: f, f1: f * 0.98, a: 0.02, v: 0.09 })); break;
      case 'beep': this.tone(o, t, 0.12, { type: 'square', f0: 880, v: 0.1 }); break;
      case 'beepHi': this.tone(o, t, 0.5, { type: 'square', f0: 1320, v: 0.12 }); break;
      case 'mapPing': this.tone(o, t, 0.5, { type: 'sine', f0: 1480, f1: 1460, v: 0.18 }); this.tone(o, t + 0.12, 0.6, { type: 'sine', f0: 740, v: 0.08 }); break;
      case 'click': this.tone(o, t, 0.05, { type: 'triangle', f0: 1200, v: 0.15 }); break;
    }
  }

  // Ambiance : bourdonnement grave + pulsation qui monte avec l'intensité du combat
  startMusic() {
    if (this.musicOn || !this.ctx) return;
    this.musicOn = true;
    const c = this.ctx;
    const drone = c.createGain(); drone.gain.value = 0.05; drone.connect(this.mus);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 180; lp.connect(drone);
    for (const f of [55, 55.4, 82.4]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); }
    const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    this.beat = 0;
    const tick = () => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + 0.05, I = this.intensity;
      if (DDVolume.get('music') > 0 && I > 0.08) {
        const step = this.beat % 8;
        const o = this.out(1, null, this.mus);
        if (step % 4 === 0) this.tone(o, t, 0.25, { f0: 90, f1: 40, v: 0.32 * I });
        if (I > 0.35 && step % 2 === 1) this.noise(o, t, 0.05, { type: 'highpass', f0: 6000, v: 0.08 * I });
        if (I > 0.55 && (step === 3 || step === 6)) this.tone(o, t, 0.18, { type: 'square', f0: [110, 98, 131, 117][(this.beat >> 3) % 4], v: 0.04 * I });
      }
      this.beat++;
      setTimeout(tick, 230 - this.intensity * 60);
    };
    tick();
  }
}
