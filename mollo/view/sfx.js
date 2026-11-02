// Mollo ! — sons et musique synthétisés (WebAudio), sans fichier : coups mous, chutes dans le vide, ferraille,
// et une petite fanfare de bras cassés générée en direct (basse, cuivre pincé, charleston) qui s'emballe quand il reste peu de monde.
// Le contexte audio naît au premier geste du joueur (unlock) et se ferme dans dispose().
const N = (m) => 440 * 2 ** ((m - 69) / 12); // n° MIDI → Hz
// la mineur qui se dandine : Am F Dm E
const PROG = [[45, 48, 52], [45, 48, 52], [41, 45, 48], [41, 45, 48], [38, 41, 45], [38, 41, 45], [40, 44, 47], [40, 44, 47]];
const MELO = [69, 71, 72, 76, 77, 80];

export class Sfx {
  constructor() { this.ctx = null; this.m = { on: false, next: 0, step: 0, tense: 0 }; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.75; this.master.connect(c.destination);
    // réglages du joueur (panneau Réglages) : la musique d'un côté, les bruitages de l'autre
    this.fx = DDVolume.gain(c, 'fx'); this.fx.connect(this.master);
    this.mus = DDVolume.gain(c, 'music'); this.mus.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.16; this.music.connect(this.mus);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // bourrasque : un souffle, à part
    const w = c.createBufferSource(); w.buffer = buf; w.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 700; this.windF.Q.value = 0.8;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    w.connect(this.windF).connect(this.windG).connect(this.fx); w.start();
    this.m.next = c.currentTime + 0.2;
  }

  // à chaque image : le vent, la musique (music : 'play' | 'calm' | 'off', tense 0..1)
  update(dt, { wind = 0, music = 'calm', tense = 0 } = {}) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    this.windG.gain.setTargetAtTime(wind * 0.22, t, 0.25);
    this.windF.frequency.setTargetAtTime(600 + Math.sin(t * 3.1) * 250, t, 0.1);
    this.m.tense = tense;
    this.score(music);
  }

  /* ------------------------------------------------------------ musique */
  score(mode) {
    const c = this.ctx, M = this.m, t = c.currentTime;
    if (mode === 'off') { M.next = t + 0.1; return; }
    const bpm = mode === 'play' ? 112 + M.tense * 24 : 96, step = 60 / bpm / 2; // croches
    while (M.next < t + 0.15) {
      const s = M.step, bar = Math.floor(s / 8) % PROG.length, ch = PROG[bar], b = s % 8, at = Math.max(M.next, t);
      // basse : fondamentale sur 1 et 5, quinte sur 7
      if (b === 0 || b === 4) this.tone(N(ch[0] - 12), at, step * 1.6, 'triangle', 0.5);
      if (b === 7) this.tone(N(ch[0] - 5), at, step * 0.8, 'triangle', 0.35);
      // le contretemps : accord pincé sur les temps faibles
      if (b % 2) ch.forEach((n, k) => this.pluck(N(n + 12), at + k * 0.006, 0.22));
      // charleston
      if (mode === 'play') this.shaker(at, b % 2 ? 0.05 : 0.09);
      // une petite mélodie de temps en temps, plus présente quand ça se resserre
      if (mode === 'play' && (b === 1 || b === 4) && (s * 7919) % 5 < 2 + M.tense * 2) this.pluck(N(MELO[(s * 31 + bar) % MELO.length]), at, 0.22, 2400);
      M.next += step; M.step++;
    }
  }
  tone(f, at, dur, type, vol) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0, at); g.gain.linearRampToValueAtTime(vol, at + 0.02); g.gain.exponentialRampToValueAtTime(0.001, at + dur);
    o.connect(g).connect(this.music); o.start(at); o.stop(at + dur + 0.05);
  }
  pluck(f, at, vol, cut = 1800) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = f;
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(cut, at); lp.frequency.exponentialRampToValueAtTime(400, at + 0.25);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.35);
    o.connect(lp).connect(g).connect(this.music); o.start(at); o.stop(at + 0.4);
  }
  shaker(at, vol) {
    const c = this.ctx, s = c.createBufferSource(), hp = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; hp.type = 'highpass'; hp.frequency.value = 6000;
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.001, at + 0.06);
    s.connect(hp).connect(g).connect(this.music); s.start(at, Math.random()); s.stop(at + 0.08);
  }

  /* ------------------------------------------------------------ bruitages */
  // bruit filtré bref (souffle, choc)
  burst(dur, freq, vol, type = 'bandpass', q = 1, sweep = 0, at = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.fx); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  // note qui glisse (la chute, le sifflet)
  sweep(f0, f1, dur, vol, type = 'sine', at = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.fx); o.start(t); o.stop(t + dur + 0.05);
  }

  play(k, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const v = o.vol ?? 1;
    switch (k) {
      case 'swing': this.burst(0.14 + (o.k || 0) * 0.1, 800 + (o.k || 0) * 500, 0.12 + (o.k || 0) * 0.12, 'bandpass', 1.5, 2.2); break;
      case 'hit': this.sweep(170, 45, 0.18, 0.6 * v); this.burst(0.08, 1500, 0.3 * v, 'bandpass', 0.8); break;
      case 'head': this.sweep(420, 90, 0.2, 0.4 * v, 'triangle'); this.sweep(150, 50, 0.16, 0.5 * v); this.burst(0.06, 2400, 0.2 * v, 'bandpass', 1); break;
      case 'ko': this.sweep(220, 40, 0.35, 0.5); this.burst(0.3, 300, 0.4, 'lowpass'); [12, 7, 3].forEach((n, i) => this.sweep(N(72 + n), N(70 + n), 0.18, 0.12, 'triangle', 0.1 + i * 0.12)); break;
      case 'wake': this.sweep(240, 520, 0.2, 0.14, 'triangle'); break;
      case 'jump': this.sweep(240, 520, 0.14, 0.14, 'triangle'); break;
      case 'land': this.sweep(120, 45, 0.14, 0.2 + 0.3 * v); this.burst(0.08, 600, 0.16 * v, 'lowpass'); break;
      case 'grab': this.sweep(300, 520, 0.08, 0.2); this.burst(0.05, 3000, 0.08); break;
      case 'hold': this.burst(0.07, 1600, 0.16, 'bandpass', 1.2, 0.6); this.sweep(260, 180, 0.08, 0.14); break;
      case 'slip': this.sweep(900, 300, 0.22, 0.12, 'triangle'); break;
      case 'climb': this.burst(0.2, 700, 0.18, 'lowpass'); this.sweep(200, 420, 0.18, 0.15, 'triangle'); break;
      case 'lift': this.sweep(140, 300, 0.3, 0.22, 'sawtooth'); break;
      case 'throw': this.burst(0.3, 400, 0.24, 'bandpass', 1.2, 4); this.sweep(180, 80, 0.12, 0.3); break;
      case 'fall': this.sweep(1500, 240, 1.1, 0.13, 'sine'); this.sweep(90, 40, 0.3, 0.32, 'sine', 1.05); this.burst(0.2, 350, 0.18, 'lowpass', 0.8, 0.6, 1.05); break;
      case 'clang': this.sweep(520, 300, 0.5, 0.2, 'square'); this.sweep(790, 410, 0.4, 0.12, 'square'); this.burst(0.15, 2600, 0.3, 'bandpass', 0.8); this.sweep(110, 40, 0.28, 0.5); break;
      case 'crush': this.burst(0.35, 300, 0.6, 'lowpass', 1, 0.5); this.sweep(90, 28, 0.4, 0.7); this.burst(0.08, 3000, 0.22, 'bandpass', 1); break;
      case 'boom': this.burst(0.7, 240, 0.85, 'lowpass', 0.7, 0.4); this.sweep(160, 26, 0.6, 0.9); this.burst(0.12, 3200, 0.3, 'bandpass', 0.7); break;
      case 'pan': this.sweep(1250, 780, 0.5, 0.2, 'triangle'); this.sweep(1880, 1400, 0.34, 0.11, 'triangle'); this.sweep(150, 50, 0.14, 0.5); break;
      case 'spike': this.burst(0.09, 3600, 0.36, 'bandpass', 2); this.sweep(240, 60, 0.2, 0.44, 'sawtooth'); break;
      case 'burn': this.burst(1.1, 1500, 0.34, 'bandpass', 0.5, 0.4); this.sweep(240, 60, 0.5, 0.26, 'sawtooth'); break;
      case 'alarm': [0, 0.34, 0.68].forEach((d) => { this.sweep(660, 880, 0.26, 0.17, 'square', d); }); break;
      case 'peel': this.sweep(1500, 240, 0.28, 0.2, 'sine'); this.sweep(90, 70, 0.1, 0.2, 'triangle', 0.26); break;
      case 'pick': this.sweep(520, 880, 0.09, 0.16, 'triangle'); break;
      case 'toss': this.burst(0.16, 900, 0.16, 'bandpass', 1.4, 3); break;
      case 'block': this.sweep(190, 120, 0.1, 0.34, 'triangle'); this.burst(0.05, 900, 0.16, 'bandpass', 1); break;
      case 'break': this.burst(0.12, 2200, 0.34, 'bandpass', 0.7); this.sweep(420, 90, 0.26, 0.4, 'sawtooth'); break;
      case 'catch': this.sweep(300, 760, 0.12, 0.28); this.burst(0.08, 2600, 0.16); break;
      case 'gust': this.burst(1.4, 500, 0.14, 'bandpass', 0.8, 2.5); break;
      case 'tick': this.sweep(880, 880, 0.12, 0.2, 'triangle'); break;
      case 'go': // coup de sifflet de chef de chantier
        { const c = this.ctx, t = c.currentTime, o2 = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), g = c.createGain();
          o2.frequency.value = 2300; lf.frequency.value = 28; lg.gain.value = 140; lf.connect(lg).connect(o2.frequency);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.setValueAtTime(0.18, t + 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o2.connect(g).connect(this.fx); o2.start(t); lf.start(t); o2.stop(t + 0.55); lf.stop(t + 0.55); }
        break;
      case 'round': [0, 3, 7, 12].forEach((n, i) => this.sweep(N(69 + n), N(69 + n), 0.22, 0.16, 'triangle', i * 0.1)); break;
      case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.sweep(N(67 + n), N(67 + n), 0.3, 0.16, 'triangle', i * 0.09)); break;
      case 'nobody': [7, 3, 0].forEach((n, i) => this.sweep(N(60 + n), N(60 + n) * 0.97, 0.35, 0.14, 'triangle', i * 0.18)); break;
      case 'click': this.sweep(1200, 900, 0.04, 0.1, 'triangle'); break;
    }
  }

  dispose() { if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; } }
}
