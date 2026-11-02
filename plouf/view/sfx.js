// Plouf ! — sons et musique synthétisés (WebAudio), sans fichier : ressac, plongeons, bourrades, mouettes,
// et une petite musique de plage générée en direct (basse, ukulélé, maracas) qui s'emballe quand il reste peu de monde.
// Le contexte audio naît au premier geste du joueur (unlock) et se ferme dans dispose().
const N = (m) => 440 * 2 ** ((m - 69) / 12); // n° MIDI → Hz
// do majeur ensoleillé : C Am F G, puis F G Em Am pour varier
const PROG = [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50], [41, 45, 48], [43, 47, 50], [40, 43, 47], [45, 48, 52]];
const MELO = [72, 74, 76, 79, 81, 84];

export class Sfx {
  constructor() { this.ctx = null; this.m = { on: false, next: 0, step: 0, tense: 0 }; }

  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = 0.75; this.master.connect(c.destination);
    // réglages du joueur (panneau Réglages) : la musique d'un côté, les bruitages et la mer de l'autre
    this.fx = DDVolume.gain(c, 'fx'); this.fx.connect(this.master);
    this.mus = DDVolume.gain(c, 'music'); this.mus.connect(this.master);
    this.music = c.createGain(); this.music.gain.value = 0.16; this.music.connect(this.mus);
    const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.noise = buf;
    // ressac : bruit filtré qui monte et descend lentement
    const src = c.createBufferSource(); src.buffer = buf; src.loop = true;
    this.seaF = c.createBiquadFilter(); this.seaF.type = 'lowpass'; this.seaF.frequency.value = 600;
    this.seaG = c.createGain(); this.seaG.gain.value = 0;
    src.connect(this.seaF).connect(this.seaG).connect(this.fx); src.start();
    // mistral : souffle plus aigu, à part
    const w = c.createBufferSource(); w.buffer = buf; w.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 700; this.windF.Q.value = 0.8;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    w.connect(this.windF).connect(this.windG).connect(this.fx); w.start();
    this.m.next = c.currentTime + 0.2;
  }

  // à chaque image : la mer, le vent, la musique (music : 'play' | 'calm' | 'off', tense 0..1)
  update(dt, { wind = 0, music = 'calm', tense = 0 } = {}) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    this.seaF.frequency.setTargetAtTime(420 + Math.sin(t * 0.35) * 180, t, 0.3);
    this.seaG.gain.setTargetAtTime(0.07 + 0.05 * Math.max(0, Math.sin(t * 0.35)), t, 0.4);
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
      // ukulélé : accord gratté sur les temps « bas-haut »
      if ([0, 2, 3, 5, 6].includes(b)) ch.forEach((n, k) => this.pluck(N(n + 12), at + k * 0.012, b === 0 ? 0.32 : 0.2));
      // maracas
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
  // bruit filtré bref (éclaboussure, souffle, choc)
  burst(dur, freq, vol, type = 'bandpass', q = 1, sweep = 0, at = 0) {
    const c = this.ctx; if (!c) return;
    const t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq * sweep), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f).connect(g).connect(this.fx); s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  // note qui glisse (le « plouf », le tintement de la bouée, le sifflet)
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
      case 'plouf': // gros plongeon : le « ploc » grave puis la gerbe d'eau
        this.sweep(420, 70, 0.28, 0.5 * v); this.burst(0.7, 900, 0.5 * v, 'lowpass', 0.7, 0.3); this.burst(0.35, 2500, 0.18 * v, 'bandpass', 0.6, 0.5, 0.05);
        for (let i = 0; i < 4; i++) this.sweep(300 + Math.random() * 300, 900 + Math.random() * 500, 0.06, 0.08 * v, 'sine', 0.25 + i * 0.07);
        break;
      case 'plop': this.sweep(600, 150, 0.15, 0.25 * v); this.burst(0.25, 1200, 0.15 * v, 'lowpass'); break;
      case 'whoosh': this.burst(0.22, 500 + (o.k || 0) * 900, 0.18 + (o.k || 0) * 0.15, 'bandpass', 1.4, 3); break;
      case 'hit': this.sweep(160, 45, 0.18, 0.6 * v); this.burst(0.08, 1800, 0.35 * v, 'bandpass', 0.8); break;
      case 'bump': this.sweep(120, 60, 0.1, 0.25 * v); break;
      case 'grab': this.sweep(300, 520, 0.08, 0.2); this.burst(0.05, 3000, 0.08); break;
      case 'miss': this.burst(0.12, 900, 0.07, 'bandpass', 2, 0.6); break;
      case 'throw': this.burst(0.3, 400, 0.22, 'bandpass', 1.2, 4); break;
      case 'land': this.sweep(110, 50, 0.12, 0.3); this.burst(0.06, 700, 0.12, 'lowpass'); break;
      case 'splat': this.burst(0.3, 700, 0.45, 'lowpass', 1, 0.4); this.sweep(240, 80, 0.15, 0.3); break;
      case 'thud': this.sweep(140, 70, 0.1, 0.15); break;
      case 'creak': this.sweep(90 + Math.random() * 40, 60, 0.4, 0.06, 'sawtooth'); break;
      case 'sink': for (let i = 0; i < 3; i++) this.sweep(180 + i * 60, 500 + i * 120, 0.09, 0.07, 'sine', i * 0.11); break;
      case 'caw': // mouette : deux cris aigus
        for (let i = 0; i < 2; i++) { this.sweep(1500, 900, 0.16, 0.12, 'square', i * 0.2); this.sweep(1100, 1500, 0.06, 0.06, 'triangle', i * 0.2); }
        break;
      case 'fish': this.burst(0.18, 1400, 0.2, 'bandpass', 1.2, 0.5); this.sweep(500, 200, 0.1, 0.15); break;
      case 'buoy': this.sweep(880, 1320, 0.12, 0.2, 'triangle'); this.sweep(1320, 1760, 0.18, 0.15, 'triangle', 0.1); break;
      case 'bob': this.sweep(660, 990, 0.2, 0.2, 'triangle'); break;
      case 'drop': this.sweep(1200, 500, 0.4, 0.06, 'sine'); break;
      case 'tick': this.sweep(880, 880, 0.12, 0.2, 'triangle'); break;
      case 'go': // coup de sifflet
        { const c = this.ctx, t = c.currentTime, o2 = c.createOscillator(), lf = c.createOscillator(), lg = c.createGain(), g = c.createGain();
          o2.frequency.value = 2300; lf.frequency.value = 28; lg.gain.value = 140; lf.connect(lg).connect(o2.frequency);
          g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.18, t + 0.02); g.gain.setValueAtTime(0.18, t + 0.35); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
          o2.connect(g).connect(this.fx); o2.start(t); lf.start(t); o2.stop(t + 0.55); lf.stop(t + 0.55); }
        break;
      case 'windWarn': this.burst(1.4, 500, 0.12, 'bandpass', 0.8, 2.5); break;
      case 'round': [0, 4, 7, 12].forEach((n, i) => this.sweep(N(72 + n), N(72 + n), 0.22, 0.16, 'triangle', i * 0.1)); break;
      case 'win': [0, 4, 7, 12, 16, 19, 24].forEach((n, i) => this.sweep(N(67 + n), N(67 + n), 0.3, 0.16, 'triangle', i * 0.09)); break;
      case 'nobody': [7, 3, 0].forEach((n, i) => this.sweep(N(60 + n), N(60 + n) * 0.97, 0.35, 0.14, 'triangle', i * 0.18)); break;
      case 'click': this.sweep(1200, 900, 0.04, 0.1, 'triangle'); break;
    }
  }

  dispose() { if (this.ctx) { try { this.ctx.close(); } catch (e) {} this.ctx = null; } }
}
