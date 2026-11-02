// Mystère Mystère : sons synthétisés (WebAudio), placés dans l'espace : volume selon la distance, gauche/droite selon le
// regard. Une petite valse de boîte à musique tourne en fond (curseur Musique), le reste passe par le curseur Effets.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const N = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class Sfx {
  constructor() { this.ctx = null; this.L = { x: 0, y: 0, z: 0, yaw: 0 }; this.musicOn = false; this.beat = 0; this.next = 0; this.mood = 'calme'; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.fx = window.DDVolume ? DDVolume.gain(c, 'fx') : c.createGain();
    this.music = window.DDVolume ? DDVolume.gain(c, 'music') : c.createGain();
    this.fx.connect(c.destination); this.music.connect(c.destination);
    this.mus = c.createGain(); this.mus.gain.value = 0.5; this.mus.connect(this.music);
    // un peu d'écho pour la boîte à musique et les coups de feu
    this.echo = c.createDelay(1); this.echo.delayTime.value = 0.21; const fb = c.createGain(); fb.gain.value = 0.28; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); const ew = c.createGain(); ew.gain.value = 0.35; lp.connect(ew); ew.connect(this.music);
    const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
  }
  listener(x, y, z, yaw) { Object.assign(this.L, { x, y, z, yaw }); }
  place(x, y, z, range = 28) {
    const L = this.L;
    if (x === undefined) return { g: 1, pan: 0 };
    const dx = x - L.x, dz = z - L.z, dy = (y ?? L.y) - L.y, d = Math.hypot(dx, dz, dy * 1.8);
    const g = clamp(1 - d / range, 0, 1) ** 1.5;
    const rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    return { g, pan: d < 0.5 ? 0 : clamp((dx * rx + dz * rz) / Math.max(d, 1), -0.85, 0.85) };
  }
  tone(f0, f1, dur, type, vol, pan, dest, when = 0, attack) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + (attack ?? Math.min(0.015, dur / 3))); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; o.connect(g); g.connect(p); p.connect(dest || this.fx); o.start(t); o.stop(t + dur + 0.02);
    return p;
  }
  noise(dur, freq, q, vol, pan, type = 'bandpass', dest, when = 0, f1) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.01, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; s.connect(f); f.connect(g); g.connect(p); p.connect(dest || this.fx); s.start(t, Math.random()); s.stop(t + dur + 0.02);
    return p;
  }
  bell(n, when, vol = 0.12, dest) { const f = N(n); this.tone(f, f, 1.4, 'sine', vol, 0, dest, when, 0.005); this.tone(f * 2.01, f * 2.01, 0.6, 'sine', vol * 0.35, 0, dest, when, 0.005); this.tone(f * 3.98, f * 3.98, 0.25, 'triangle', vol * 0.12, 0, dest, when, 0.003); }
  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = this.place(o.x, o.y, o.z, o.range), v = (o.vol ?? 1) * P.g, pan = P.pan;
    if (v < 0.004) return;
    switch (name) {
      case 'step': this.noise(0.07, o.surf === 'pierre' ? 1100 : o.surf === 'tapis' ? 260 : 520, 1.2, (o.surf === 'tapis' ? 0.12 : 0.2) * v, pan); this.tone(o.surf === 'pierre' ? 130 : 95, 50, 0.06, 'sine', 0.16 * v, pan); break;
      case 'land': this.noise(0.12, 380, 1, 0.3 * v, pan); this.tone(90, 40, 0.12, 'sine', 0.35 * v, pan); break;
      case 'drawKnife': this.noise(0.22, 3800, 6, 0.22 * v, pan, 'bandpass', null, 0, 6400); this.tone(2400, 3200, 0.18, 'sine', 0.05 * v, pan); break;
      case 'drawGun': this.noise(0.04, 2600, 4, 0.3 * v, pan); this.noise(0.04, 1800, 4, 0.28 * v, pan, 'bandpass', null, 0.09); break;
      case 'holster': this.noise(0.08, 1200, 2, 0.12 * v, pan); break;
      case 'swing': this.noise(0.22, 900, 1.2, 0.32 * v, pan, 'bandpass', null, 0, 3000); break;
      case 'stab': this.noise(0.12, 420, 1, 0.6 * v, pan); this.tone(160, 50, 0.2, 'triangle', 0.4 * v, pan); break;
      case 'throw': this.noise(0.35, 700, 2, 0.35 * v, pan, 'bandpass', null, 0, 2400); break;
      case 'stick': this.noise(0.05, 2400, 3, 0.4 * v, pan); this.tone(320, 180, 0.12, 'square', 0.12 * v, pan); this.tone(900, 860, 0.25, 'sine', 0.05 * v, pan, null, 0.02); break;
      case 'shot': { const p = this.noise(0.32, 900, 0.7, 0.9 * v, pan, 'lowpass', null, 0, 200); this.tone(160, 40, 0.3, 'square', 0.45 * v, pan); this.noise(0.6, 600, 0.6, 0.18 * v, pan, 'lowpass', this.echo, 0.02, 180); void p; break; }
      case 'click': this.noise(0.03, 3000, 4, 0.2 * v, pan); break;
      case 'reload': this.noise(0.04, 2200, 4, 0.18 * v, pan); this.noise(0.04, 2800, 4, 0.18 * v, pan, 'bandpass', null, 0.18); this.noise(0.05, 1600, 4, 0.22 * v, pan, 'bandpass', null, 0.5); break;
      case 'kill': this.tone(520, 160, 0.5, 'sawtooth', 0.12 * v, pan); this.tone(390, 120, 0.55, 'triangle', 0.16 * v, pan, null, 0.02); this.noise(0.25, 380, 1, 0.3 * v, pan, 'bandpass', null, 0.25); this.tone(80, 40, 0.3, 'sine', 0.4 * v, pan, null, 0.4); break;
      case 'misfire': this.tone(900, 200, 0.6, 'sawtooth', 0.14 * v, pan); for (let i = 0; i < 4; i++) this.tone(1400 + i * 120, 1300 + i * 120, 0.18, 'sine', 0.06 * v, pan, null, 0.2 + i * 0.12); break;
      case 'coin': this.tone(N(88), N(88), 0.09, 'square', 0.07 * v, pan); this.tone(N(93), N(93), 0.3, 'square', 0.07 * v, pan, null, 0.07); break;
      case 'gundrop': this.noise(0.15, 2600, 3, 0.35 * v, pan); this.tone(300, 200, 0.15, 'square', 0.12 * v, pan, null, 0.05); for (const [i, n] of [76, 79, 83].entries()) this.bell(n, 0.25 + i * 0.12, 0.1); break;
      case 'gunpick': for (const [i, n] of [67, 72, 76, 79].entries()) this.tone(N(n), N(n), 0.32, 'triangle', 0.14, 0, null, i * 0.08); break;
      case 'pass': this.noise(1.2, 220, 1.2, 0.35 * v, pan, 'bandpass', null, 0, 120); this.tone(70, 55, 1.1, 'sawtooth', 0.08 * v, pan); this.noise(0.08, 1800, 3, 0.25 * v, pan, 'bandpass', null, 1.1); break;
      case 'blackout': this.tone(220, 30, 1.1, 'sawtooth', 0.28, 0); this.noise(0.4, 300, 1, 0.4, 0); this.tone(60, 40, 1.4, 'sine', 0.4, 0, null, 0.1); break;
      case 'lights': this.tone(60, 240, 0.4, 'square', 0.08, 0); this.noise(0.06, 3000, 2, 0.15, 0, 'bandpass', null, 0.35); break;
      case 'start': this.bell(57, 0, 0.25); this.bell(64, 0.02, 0.18); this.tone(55, 50, 2.5, 'sine', 0.3, 0); break;
      case 'role-m': for (const [i, n] of [50, 53, 56, 59].entries()) this.tone(N(n), N(n) * 0.98, 0.5, 'sawtooth', 0.09, 0, null, i * 0.11); this.tone(N(38), N(36), 1.6, 'sawtooth', 0.18, 0, null, 0.45); break;
      case 'role-s': for (const [i, n] of [60, 64, 67, 72].entries()) this.tone(N(n), N(n), 0.42, 'triangle', 0.14, 0, null, i * 0.1); this.bell(84, 0.45, 0.12); break;
      case 'role-i': for (const [i, n] of [67, 71, 74].entries()) this.bell(n, i * 0.13, 0.14); break;
      case 'tick': this.tone(1800, 1800, 0.04, 'square', 0.05, 0); break;
      case 'win': for (const [i, n] of [60, 64, 67, 72, 76, 79, 84].entries()) this.tone(N(n), N(n), 0.35, 'triangle', 0.12, 0, null, i * 0.09); break;
      case 'lose': for (const [i, n] of [64, 60, 57, 52].entries()) this.tone(N(n), N(n) * 0.97, 0.5, 'triangle', 0.13, 0, null, i * 0.22); break;
      case 'ui': this.noise(0.03, 2400, 3, 0.15, 0); break;
      case 'hit': this.tone(1200, 900, 0.08, 'square', 0.08, 0); break;
      case 'heart': this.tone(62, 38, 0.12, 'sine', 0.35 * (o.vol ?? 1), 0, this.music); this.tone(56, 34, 0.14, 'sine', 0.26 * (o.vol ?? 1), 0, this.music, 0.2); break;
    }
  }
  // boîte à musique : une valse en mineur, plus vive quand la tension monte
  update(dt, st) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    this.mus.gain.setTargetAtTime(st.music ?? 0.5, c.currentTime, 0.8);
    if (!st.play) { this.next = 0; return; }
    const bpm = st.tense ? 150 : 108, beat = 60 / bpm;
    if (!this.next || this.next < c.currentTime - 1) this.next = c.currentTime + 0.1;
    const MEL = [69, 72, 76, 74, 72, 71, 72, 69, 68, 71, 74, 72, 71, 69, 68, 64, 69, 72, 76, 79, 77, 76, 74, 72, 71, 74, 72, 71, 69, 68, 69, -1];
    const BASS = [45, 52, 40, 47, 45, 52, 41, 48];
    while (this.next < c.currentTime + 0.25) {
      const i = this.beat % MEL.length, n = MEL[i];
      if (n > 0) this.bell(n + 12, this.next - c.currentTime, 0.06, this.mus);
      if (i % 3 === 0) { const b = BASS[(Math.floor(this.beat / 3)) % BASS.length]; this.tone(N(b), N(b), beat * 2.6, 'triangle', 0.05, 0, this.mus, this.next - c.currentTime, 0.01); }
      else this.bell(BASS[(Math.floor(this.beat / 3)) % BASS.length] + 19, this.next - c.currentTime, 0.022, this.mus);
      this.next += beat; this.beat++;
    }
  }
  dispose() { if (this.ctx) this.ctx.close().catch(() => {}); this.ctx = null; }
}
