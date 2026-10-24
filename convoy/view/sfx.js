// Convoy Storm — sons et musique synthétisés (WebAudio), sans fichier : vent, halètement de la locomotive,
// effets, et une musique générée en direct (tendue sur la voie, plus chaude en gare, fanfare à l'arrivée).
// Le contexte audio naît au premier geste du joueur (unlock) et se ferme dans dispose().
const N = (m) => 440 * 2 ** ((m - 69) / 12); // n° MIDI → Hz
// progressions (accords en notes MIDI) : sur la voie (ré mineur, grave) et en gare (ré majeur, apaisé)
const RUN = [[50, 53, 57], [46, 50, 53], [53, 57, 60], [48, 52, 55]];       // Dm Bb F C
const RUN_DARK = [[50, 53, 57], [51, 55, 58], [50, 53, 56], [49, 53, 56]];  // Dm Eb Ddim C#… plus inquiétant
const CALM = [[50, 54, 57], [55, 59, 62], [47, 50, 54], [45, 49, 52]];      // D G Bm A
const PENTA = [62, 64, 66, 69, 71, 74, 76, 78];

export class Sfx {
  constructor() {
    this.ctx = null; this.muted = false;
    try { this.muted = localStorage.getItem('convoy_mute') === '1'; } catch (e) {}
    this.chugT = 0;
    this.m = { mode: 'off', next: 0, step: 0, danger: 0, won: false };
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
    // un peu d'écho pour la musique et les sons lointains (loups, cloche)
    this.verb = c.createDelay(1); this.verb.delayTime.value = 0.29;
    const fb = c.createGain(); fb.gain.value = 0.32; const vf = c.createBiquadFilter(); vf.type = 'lowpass'; vf.frequency.value = 2200;
    this.verb.connect(vf).connect(fb).connect(this.verb); this.verbOut = c.createGain(); this.verbOut.gain.value = 0.5;
    vf.connect(this.verbOut).connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.2; this.music.connect(this.master); this.music.connect(this.verb);
    // bruit blanc partagé
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // vent : bruit filtré en continu, modulé par le blizzard
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 500; this.windF.Q.value = 0.7;
    this.windG = c.createGain(); this.windG.gain.value = 0.0;
    src.connect(this.windF).connect(this.windG).connect(this.master); src.start();
    this.windSrc = src;
    this.m.next = c.currentTime + 0.2;
  }
  setMuted(m) {
    this.muted = m; try { localStorage.setItem('convoy_mute', m ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }
  // à chaque image : vent, rythme de la locomotive, musique (state = { mode: run|station|win|off, danger 0..1 })
  update(dt, speed, storm = 1, state = { mode: 'off' }) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    this.windF.frequency.setTargetAtTime(380 + Math.sin(t * 0.7) * 160 + Math.sin(t * 2.3) * 60 + (storm > 1.5 ? 250 : 0), t, 0.2);
    this.windG.gain.setTargetAtTime((0.12 + 0.08 * Math.sin(t * 0.43)) * storm, t, 0.3);
    if (speed > 0.15) {
      this.chugT -= dt * speed * 1.6;
      if (this.chugT <= 0) { this.chugT = 1; this.burst(0.09, 180, 0.12, 'lowpass'); }
    }
    this.score(state);
  }

  /* ------------------------------------------------------------ musique */
  score(state) {
    const c = this.ctx, M = this.m, t = c.currentTime;
    if (state.mode === 'win' && !M.won) { M.won = true; this.fanfare(); }
    if (state.mode !== 'win') M.won = false;
    if (state.mode !== M.mode) { M.mode = state.mode; M.step = 0; M.next = Math.max(M.next, t + 0.05); }
    M.danger += ((state.danger || 0) - M.danger) * 0.02;
    if (M.mode === 'off') { M.next = t + 0.1; return; }
    const calm = M.mode === 'station' || M.mode === 'win';
    const bpm = calm ? 72 : 84 + M.danger * 26, sx = 60 / bpm / 4; // une double croche
    if (M.next < t - 0.5) M.next = t + 0.05;  // l'onglet a dormi : on repart proprement
    while (M.next < t + 0.15) { this.beat(M.step, M.next, sx, calm); M.step = (M.step + 1) % 64; M.next += sx; }
  }
  beat(s, at, sx, calm) {
    const M = this.m, bar = Math.floor(s / 16), i = s % 16;
    const prog = calm ? CALM : M.danger > 0.55 ? RUN_DARK : RUN, ch = prog[bar];
    if (i === 0) for (const n of ch) this.pad(N(n), sx * 16, at, calm ? 0.05 : 0.045, calm ? 'triangle' : 'sawtooth');
    if (i === 0) this.pad(N(ch[0] - 12), sx * 16, at, 0.07, 'sine');
    if (calm) {
      // boîte à musique pentatonique, notes clairsemées
      if (i % 4 === 0 || (i % 2 === 0 && Math.random() < 0.3)) this.pluck(N(PENTA[(s * 5 + bar * 3) % PENTA.length] + (Math.random() < 0.2 ? 12 : 0)), at, 0.06);
      return;
    }
    // arpège ostinato, qui monte avec le danger
    if (i % 2 === 0) { const n = ch[(i / 2) % 3] + 12 + (i >= 8 && M.danger > 0.3 ? 12 : 0); this.pluck(N(n), at, 0.035 + M.danger * 0.02, 'triangle'); }
    // pulsation de basse et tic-tac (danger)
    if (i % 4 === 0) this.bass(N(ch[0] - 24), at, 0.06 + M.danger * 0.12);
    if (M.danger > 0.25 && i % 2 === 1) this.hat(at, 0.025 + M.danger * 0.04);
    if (M.danger > 0.6 && i === 12) this.pluck(N(ch[0] + 18), at, 0.04, 'square'); // triton qui grince
  }
  pad(f, dur, at, vol, type) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = o2.type = type; o.frequency.value = f; o2.frequency.value = f * 1.004;
    lp.type = 'lowpass'; lp.frequency.value = type === 'sawtooth' ? 900 : 2400;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(vol, at + Math.min(0.8, dur * 0.3)); g.gain.setTargetAtTime(0.0001, at + dur * 0.85, dur * 0.12);
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(this.music);
    o.start(at); o2.start(at); o.stop(at + dur + 0.6); o2.stop(at + dur + 0.6);
  }
  pluck(f, at, vol, type = 'sine') {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(vol, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
    o.connect(g).connect(this.music); o.start(at); o.stop(at + 0.55);
  }
  bass(f, at, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.setValueAtTime(400, at); lp.frequency.exponentialRampToValueAtTime(90, at + 0.25);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.32);
    o.connect(lp).connect(g).connect(this.music); o.start(at); o.stop(at + 0.35);
  }
  hat(at, vol) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'highpass'; f.frequency.value = 7000;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    s.connect(f).connect(g).connect(this.music); s.start(at, Math.random()); s.stop(at + 0.06);
  }
  fanfare() {
    const t = this.ctx.currentTime + 0.05;
    [[62, 0], [66, 0.18], [69, 0.36], [74, 0.6], [69, 0.9], [74, 1.08], [78, 1.3]].forEach(([n, d]) => {
      this.pad(N(n), d === 1.3 ? 1.8 : 0.3, t + d, 0.1, 'square'); this.pad(N(n - 12), d === 1.3 ? 1.8 : 0.3, t + d, 0.06, 'triangle');
    });
    this.play('bell');
  }

  /* ------------------------------------------------------------ effets */
  burst(dur, freq, vol, type = 'bandpass', q = 1, delay = 0, out = this.master) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime + delay;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(out); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return f;
  }
  tone(freq, dur, vol, type = 'sine', to = null, delay = 0, out = this.master) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type; const g = c.createGain(); const t = c.currentTime + delay;
    o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  // hurlement : glissando avec vibrato, au loin (passe dans l'écho)
  howl(delay = 0, pitch = 1) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), lfo = c.createOscillator(), lg = c.createGain(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; lp.type = 'lowpass'; lp.frequency.value = 1100;
    o.frequency.setValueAtTime(330 * pitch, t); o.frequency.exponentialRampToValueAtTime(560 * pitch, t + 0.5); o.frequency.setValueAtTime(560 * pitch, t + 1.2); o.frequency.exponentialRampToValueAtTime(380 * pitch, t + 2);
    lfo.frequency.value = 5.5; lg.gain.value = 9; lfo.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.07, t + 0.35); g.gain.setValueAtTime(0.07, t + 1.4); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.1);
    o.connect(lp).connect(g); g.connect(this.master); g.connect(this.verb);
    o.start(t); lfo.start(t); o.stop(t + 2.2); lfo.stop(t + 2.2);
  }
  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump': this.tone(300, 0.12, 0.08, 'triangle', 520); break;
      case 'land': this.burst(0.12, 900, 0.18, 'lowpass'); break;
      case 'fall': this.burst(0.35, 600, 0.35, 'lowpass'); this.tone(240, 0.25, 0.06, 'triangle', 120); break;
      case 'pick': this.tone(420, 0.08, 0.1, 'square', 560); this.burst(0.06, 2000, 0.08); break;
      case 'throw': this.burst(0.2, 1400, 0.12, 'bandpass', 2); break;
      case 'thud': this.burst(0.15, 250, 0.3, 'lowpass'); break;
      case 'feed': this.burst(0.8, 300, 0.4, 'lowpass'); this.tone(110, 0.6, 0.15, 'sawtooth', 70); this.tone(660, 0.2, 0.06, 'sine', 990, 0.15); break;
      case 'found': [523, 659, 784].forEach((f, i) => this.tone(f, 0.18, 0.08, 'triangle', null, i * 0.08)); break;
      case 'empty': this.tone(330, 0.2, 0.07, 'triangle', 220); break;
      case 'board': this.tone(392, 0.1, 0.07, 'square', null); this.tone(523, 0.12, 0.07, 'square', null, 0.08); break;
      case 'low': [880, 660, 880, 660].forEach((f, i) => this.tone(f, 0.14, 0.07, 'square', null, i * 0.18)); break;
      case 'lost': this.tone(300, 0.9, 0.08, 'sine', 90); break;
      case 'stall': this.burst(1.6, 120, 0.35, 'lowpass'); this.tone(90, 1.4, 0.12, 'sawtooth', 40); break;
      case 'click': this.tone(700, 0.04, 0.05, 'square'); break;
      case 'nope': this.tone(220, 0.12, 0.07, 'square', 180); this.tone(180, 0.16, 0.07, 'square', 150, 0.1); break;
      // froid et loups
      case 'shiver': for (let i = 0; i < 6; i++) this.burst(0.05, 2400, 0.06, 'bandpass', 3, i * 0.07); this.tone(520, 0.4, 0.03, 'sine', 480); break;
      case 'howl': this.howl(0, 0.95 + Math.random() * 0.1); if (Math.random() < 0.6) this.howl(0.7, 1.18); break;
      case 'growl': { const o = this.tone(68, 0.7, 0.12, 'sawtooth', 58); this.burst(0.6, 220, 0.12, 'lowpass', 1); if (o) { const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = 23; lg.gain.value = 18; l.connect(lg).connect(o.frequency); l.start(); l.stop(this.ctx.currentTime + 0.8); } break; }
      case 'bite': this.burst(0.12, 1800, 0.35, 'bandpass', 1.5); this.burst(0.25, 500, 0.3, 'lowpass'); this.tone(520, 0.15, 0.06, 'square', 260); break;
      case 'yelp': this.tone(900, 0.12, 0.08, 'triangle', 1400); this.tone(1300, 0.25, 0.07, 'triangle', 600, 0.12); break;
      case 'flare': this.burst(0.08, 900, 0.3, 'lowpass'); this.burst(1.6, 3200, 0.1, 'bandpass', 0.8, 0.05); this.tone(1800, 0.3, 0.03, 'sine', 900); break;
      // voie
      case 'warn': this.tone(587, 0.2, 0.08, 'square'); this.tone(440, 0.3, 0.08, 'square', null, 0.22); break;
      case 'brake': this.burst(1.0, 2600, 0.14, 'bandpass', 12); this.burst(0.8, 200, 0.25, 'lowpass'); break;
      case 'shovel': this.burst(0.09, 1500, 0.12, 'bandpass', 1.2); this.burst(0.22, 700, 0.1, 'lowpass', 1, 0.08); break;
      case 'cleared': [440, 554, 659, 880].forEach((f, i) => this.tone(f, 0.2, 0.07, 'triangle', null, i * 0.07)); break;
      case 'rumble': { const f = this.burst(3.6, 60, 0.5, 'lowpass', 0.7); if (f) f.frequency.linearRampToValueAtTime(260, this.ctx.currentTime + 3.6); break; }
      case 'aval': this.burst(2.4, 380, 0.7, 'lowpass', 0.6); this.burst(1.8, 120, 0.6, 'lowpass', 0.6, 0.1); break;
      case 'gust': { const f = this.burst(2.2, 400, 0.3, 'bandpass', 0.8); if (f) f.frequency.exponentialRampToValueAtTime(1600, this.ctx.currentTime + 1.6); break; }
      // gares
      case 'bell': for (const [f, v] of [[880, 0.08], [1318, 0.05], [2217, 0.025]]) { this.tone(f, 2.2, v, 'sine', null, 0, this.verb); this.tone(f, 1.6, v, 'sine'); } break;
      case 'whistle': this.tone(523, 0.9, 0.06, 'square', 520); this.tone(659, 0.9, 0.05, 'square', 655); this.burst(0.9, 1800, 0.08, 'bandpass', 2); break;
      case 'buy': this.tone(1175, 0.1, 0.07, 'triangle'); this.tone(1568, 0.25, 0.07, 'triangle', null, 0.08); this.burst(0.1, 5000, 0.05, 'highpass'); break;
      case 'arrive': this.play('whistle'); break;
    }
  }
  dispose() {
    try { this.windSrc && this.windSrc.stop(); } catch (e) {}
    try { this.ctx && this.ctx.close(); } catch (e) {}
    this.ctx = null;
  }
}
