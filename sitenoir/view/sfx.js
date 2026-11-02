// Site Noir : tous les sons sont synthétisés (WebAudio) et placés dans l'espace : volume selon la distance, gauche/droite selon le regard.
// Le fond (bourdon, cœur, générateur) passe par le curseur Musique ; le reste par le curseur Effets.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class Sfx {
  constructor() { this.ctx = null; this.L = { x: 0, y: 0, z: 0, yaw: 0 }; this.heartT = 0; this.emfT = 0; this.alive = true; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.fx = window.DDVolume ? DDVolume.gain(c, 'fx') : c.createGain();
    this.music = window.DDVolume ? DDVolume.gain(c, 'music') : c.createGain();
    this.fx.connect(c.destination); this.music.connect(c.destination);
    // bruit réutilisable
    const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
    // bourdon de fond : deux graves qui battent, et un souffle filtré
    this.drone = c.createGain(); this.drone.gain.value = 0; this.drone.connect(this.music);
    for (const [f, g] of [[46, 0.5], [46.7, 0.45], [92.5, 0.12]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; const v = c.createGain(); v.gain.value = g * 0.2; o.connect(lp); lp.connect(v); v.connect(this.drone); o.start(); }
    const s = c.createBufferSource(); s.buffer = n; s.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6; const sv = c.createGain(); sv.gain.value = 0.03; s.connect(bp); bp.connect(sv); sv.connect(this.drone); s.start();
    // générateur
    this.genG = c.createGain(); this.genG.gain.value = 0; this.genP = c.createStereoPanner(); this.genG.connect(this.genP); this.genP.connect(this.fx);
    const go = c.createOscillator(); go.type = 'square'; go.frequency.value = 58; const glp = c.createBiquadFilter(); glp.type = 'lowpass'; glp.frequency.value = 260; go.connect(glp); glp.connect(this.genG); go.start();
    this.genOsc = go;
  }
  listener(x, y, z, yaw) { Object.assign(this.L, { x, y, z, yaw }); }
  // gain et position stéréo d'un son placé
  place(x, y, z, range = 28) {
    const L = this.L;
    if (x === undefined) return { g: 1, pan: 0 };
    const dx = x - L.x, dz = z - L.z, dy = (y ?? L.y) - L.y, d = Math.hypot(dx, dz, dy * 1.6);
    const g = clamp(1 - d / range, 0, 1) ** 1.6;
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    return { g, pan: d < 0.5 ? 0 : clamp((dx * rx + dz * rz) / Math.max(d, 1), -0.9, 0.9), behind: (dx * fx + dz * fz) < 0 };
  }
  tone(f0, f1, dur, type, vol, pan, dest, when = 0) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; o.connect(g); g.connect(p); p.connect(dest || this.fx); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, freq, q, vol, pan, type = 'bandpass', dest, when = 0, f1) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.015, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; s.connect(f); f.connect(g); g.connect(p); p.connect(dest || this.fx); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = this.place(o.x, o.y, o.z, o.range), v = (o.vol ?? 1) * P.g, pan = P.pan;
    if (v < 0.004) return;
    switch (name) {
      case 'step': this.noise(0.09, o.soft ? 240 : o.hard ? 900 : 420, 1, 0.22 * v, pan); this.tone(80, 45, 0.07, 'sine', 0.2 * v, pan); break;
      case 'mstep': this.tone(60, 30, 0.2, 'sine', 0.7 * v, pan); this.noise(0.13, 200, 1, 0.25 * v, pan); break;
      case 'door': this.noise(0.55, 700, 2, 0.16 * v, pan, 'bandpass', null, 0, 220); this.tone(90, 55, 0.25, 'triangle', 0.3 * v, pan, null, o.open ? 0.46 : 0.46); break;
      case 'liftdoor': this.noise(0.9, 500, 3, 0.15 * v, pan, 'bandpass', null, 0, 1100); break;
      case 'deny': this.tone(170, 120, 0.13, 'square', 0.1 * v, pan); this.tone(150, 110, 0.16, 'square', 0.1 * v, pan, null, 0.16); break;
      case 'unlock': this.tone(620, 640, 0.07, 'square', 0.1 * v, pan); this.tone(930, 950, 0.1, 'square', 0.1 * v, pan, null, 0.09); this.noise(0.08, 1800, 4, 0.2 * v, pan, 'bandpass', null, 0.2); break;
      case 'pick': this.noise(0.08, 1400, 2, 0.16 * v, pan); this.tone(520, 860, 0.1, 'triangle', 0.14 * v, pan, null, 0.04); break;
      case 'search': this.noise(0.25, 1100, 1.4, 0.13 * v, pan); break;
      case 'empty': this.noise(0.14, 700, 2, 0.1 * v, pan); break;
      case 'found': for (const [i, f] of [440, 554, 740].entries()) this.tone(f, f, 0.26, 'triangle', 0.15 * v, pan, null, i * 0.09); break;
      case 'torch': this.noise(0.03, 3400, 3, 0.25 * v, pan); break;
      case 'reload': this.noise(0.06, 2400, 3, 0.2 * v, pan); this.noise(0.06, 1600, 3, 0.2 * v, pan, 'bandpass', null, 0.12); break;
      case 'flash': this.tone(2600, 7200, 0.3, 'sine', 0.07 * v, pan); this.noise(0.07, 3800, 2, 0.45 * v, pan, 'highpass', null, 0.26); break;
      case 'proof': for (const [i, f] of [660, 880, 1320].entries()) this.tone(f, f, 0.24, 'sine', 0.13 * v, 0, null, i * 0.1); break;
      case 'locker': this.noise(0.2, 500, 3, 0.3 * v, pan); this.tone(130, 70, 0.2, 'square', 0.14 * v, pan); break;
      case 'bang': this.noise(0.28, 300, 1, 0.75 * v, pan); this.tone(110, 40, 0.34, 'square', 0.4 * v, pan); break;
      case 'swing': this.noise(0.26, 900, 1, 0.34 * v, pan, 'bandpass', null, 0, 2600); break;
      case 'hit': this.noise(0.17, 500, 1, 0.8 * v, pan); this.tone(180, 45, 0.24, 'sawtooth', 0.45 * v, pan); break;
      case 'down': this.tone(240, 70, 0.9, 'sawtooth', 0.28 * v, pan); this.noise(0.5, 300, 1, 0.5 * v, pan); break;
      case 'roar': { const d = 1.5; this.tone(95, 42, d, 'sawtooth', 0.5 * v, pan); this.tone(142, 60, d, 'sawtooth', 0.3 * v, pan); this.tone(61, 33, d, 'square', 0.28 * v, pan); this.noise(d, 900, 0.8, 0.55 * v, pan, 'bandpass', null, 0, 240); break; }
      case 'growl': this.tone(70, 48, 0.8, 'sawtooth', 0.3 * v, pan); this.noise(0.8, 500, 0.8, 0.22 * v, pan, 'bandpass', null, 0, 200); break;
      case 'scare': this.tone(1760, 1600, 0.8, 'sawtooth', 0.09, 0); this.tone(1865, 1700, 0.8, 'sawtooth', 0.09, 0); this.tone(55, 35, 1, 'sawtooth', 0.55, 0); this.noise(0.8, 2400, 0.8, 0.3, 0); break;
      case 'dark': this.noise(0.32, 180, 1, 0.5 * v, 0); this.tone(180, 40, 0.5, 'square', 0.2 * v, 0); break;
      case 'lightsback': this.tone(60, 120, 0.4, 'square', 0.08, 0); break;
      case 'genwork': this.noise(0.13, 1900, 3, 0.2 * v, pan); this.tone(180, 240, 0.18, 'square', 0.1 * v, pan, null, 0.12); break;
      case 'gen': this.tone(35, 150, 2.5, 'sawtooth', 0.5, 0); this.noise(2.4, 300, 1, 0.28, 0, 'bandpass', null, 0, 1400); for (const [i, f] of [392, 523, 659].entries()) this.tone(f, f, 0.4, 'triangle', 0.12, 0, null, 2 + i * 0.16); break;
      case 'fuse': this.noise(0.05, 3000, 2, 0.45 * v, pan); this.tone(120, 90, 0.5, 'square', 0.13 * v, pan, null, 0.06); break;
      case 'smash': this.noise(0.35, 800, 1, 0.8 * v, pan); this.tone(200, 50, 0.5, 'square', 0.4 * v, pan); break;
      case 'ding': this.tone(988, 988, 0.9, 'sine', 0.3 * v, pan); this.tone(784, 784, 1.2, 'sine', 0.26 * v, pan, null, 0.36); break;
      case 'lifthum': this.tone(70, 110, o.d || 6, 'sawtooth', 0.09 * v, pan); this.noise(o.d || 6, 300, 0.8, 0.07 * v, pan); break;
      case 'extract': for (const [i, f] of [392, 494, 587, 784].entries()) this.tone(f, f, 0.5, 'triangle', 0.18, 0, null, i * 0.13); break;
      case 'stun': this.tone(1200, 200, 0.55, 'sawtooth', 0.15 * v, pan); this.tone(60, 34, 0.9, 'sawtooth', 0.5 * v, pan); break;
      case 'wake': this.tone(40, 80, 2, 'sawtooth', 0.5, 0); this.noise(2, 240, 1, 0.26, 0); this.play('roar', { vol: 0.55 }); break;
      case 'cam': this.noise(0.05, 2400, 3, 0.2 * v, pan); this.tone(1400, 1400, 0.1, 'sine', 0.08 * v, pan, null, 0.08); break;
      case 'camdead': this.noise(0.2, 2600, 1, 0.45 * v, pan); this.tone(900, 90, 0.26, 'square', 0.13 * v, pan); break;
      case 'click': this.noise(0.03, 2200, 3, 0.2, 0); break;
      case 'beep': this.tone(o.f || 1500, o.f || 1500, 0.04, 'square', 0.05, 0.25); break;
      case 'over': this.tone(150, 38, 3, 'sawtooth', 0.4, 0); break;
    }
  }
  // boucle : ambiance, cœur quand le monstre approche, générateur
  update(dt, st) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    this.drone.gain.setTargetAtTime(st.drone ?? 0.8, t, 0.6);
    if (st.gen) { const P = this.place(st.gen.x, st.gen.y, st.gen.z, 34); this.genG.gain.setTargetAtTime(P.g * (st.gen.on ? 0.1 : st.gen.work ? 0.08 : 0), t, 0.3); this.genP.pan.setTargetAtTime(P.pan, t, 0.2); this.genOsc.frequency.setTargetAtTime(st.gen.on ? 62 : 40 + st.gen.k * 16, t, 0.3); }
    if (st.fear > 0.02) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 1.15 - st.fear * 0.68; const v = 0.18 + st.fear * 0.65; this.tone(62, 38, 0.12, 'sine', v, 0, this.music); this.tone(56, 34, 0.14, 'sine', v * 0.75, 0, this.music, 0.2); }
    }
    if (st.emf > 0) { this.emfT -= dt; if (this.emfT <= 0) { this.emfT = 0.9 - st.emf * 0.16; this.play('beep', { f: 800 + st.emf * 260 }); } }
  }
  dispose() { this.alive = false; if (this.ctx) this.ctx.close().catch(() => {}); this.ctx = null; }
}
