// Convoy Storm — sons synthétisés (WebAudio), sans fichier : vent, halètement de la locomotive, effets.
// Le contexte audio naît au premier geste du joueur (unlock) et se ferme dans dispose().
export class Sfx {
  constructor() {
    this.ctx = null; this.muted = false;
    try { this.muted = localStorage.getItem('convoy_mute') === '1'; } catch (e) {}
    this.chugT = 0;
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.7; this.master.connect(c.destination);
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
  }
  setMuted(m) {
    this.muted = m; try { localStorage.setItem('convoy_mute', m ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.7, this.ctx.currentTime, 0.05);
  }
  // à chaque image : vent et rythme de la locomotive
  update(dt, speed, storm = 1) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime;
    this.windF.frequency.setTargetAtTime(380 + Math.sin(t * 0.7) * 160 + Math.sin(t * 2.3) * 60, t, 0.2);
    this.windG.gain.setTargetAtTime((0.12 + 0.08 * Math.sin(t * 0.43)) * storm, t, 0.3);
    if (speed > 0.15) {
      this.chugT -= dt * speed * 1.6;
      if (this.chugT <= 0) { this.chugT = 1; this.burst(0.09, 180, 0.12, 'lowpass'); }
    }
  }
  burst(dur, freq, vol, type = 'bandpass', q = 1) {
    const c = this.ctx; if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.noise; s.playbackRate.value = 0.7 + Math.random() * 0.6;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain(); const t = c.currentTime;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(f).connect(g).connect(this.master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  tone(freq, dur, vol, type = 'sine', to = null, delay = 0) {
    const c = this.ctx; if (!c) return;
    const o = c.createOscillator(); o.type = type; const g = c.createGain(); const t = c.currentTime + delay;
    o.frequency.setValueAtTime(freq, t); if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
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
    }
  }
  dispose() {
    try { this.windSrc && this.windSrc.stop(); } catch (e) {}
    try { this.ctx && this.ctx.close(); } catch (e) {}
    this.ctx = null;
  }
}
