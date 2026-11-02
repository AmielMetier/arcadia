// Système sonore WebAudio pour Dogfight 3D :
// Réacteur à turbine, rugissement de la postcombustion, mitrailleuse rotative Vulcan (BRRRRT) et explosions.

export class DogfightAudio {
  constructor() {
    this.ctx = null;
    this.fxGain = null;
    this.engineGain = null;
    this.engineOsc = null;
    this.engineFilter = null;
    this.unlocked = false;
    this.vulcanLoop = null;
  }

  unlock() {
    if (this.unlocked && this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();

    if (window.DDVolume) {
      this.fxGain = window.DDVolume.gain(this.ctx, 'fx');
    } else {
      this.fxGain = this.ctx.createGain();
      this.fxGain.gain.value = 0.8;
    }
    this.fxGain.connect(this.ctx.destination);

    // Démarrage du réacteur en boucle
    this.startEngineLoop();
    this.unlocked = true;
  }

  startEngineLoop() {
    const c = this.ctx;
    const t = c.currentTime;

    // 1. Souffle d'air (bruit blanc filtré passe-bande)
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    const noiseSrc = c.createBufferSource();
    noiseSrc.buffer = buf;
    noiseSrc.loop = true;

    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'bandpass';
    this.engineFilter.frequency.setValueAtTime(320, t);
    this.engineFilter.Q.setValueAtTime(1.8, t);

    this.engineGain = c.createGain();
    this.engineGain.gain.setValueAtTime(0.22, t);

    noiseSrc.connect(this.engineFilter).connect(this.engineGain).connect(this.fxGain);
    noiseSrc.start();

    // 2. Sifflement de turbine réacteur (haute fréquence)
    this.engineOsc = c.createOscillator();
    this.engineOsc.type = 'triangle';
    this.engineOsc.frequency.setValueAtTime(420, t);

    const oscGain = c.createGain();
    oscGain.gain.setValueAtTime(0.06, t);

    this.engineOsc.connect(oscGain).connect(this.engineGain);
    this.engineOsc.start();
  }

  // Modifie le son du réacteur selon la vitesse et la postcombustion
  updateEngine(speed, boosting, braking) {
    if (!this.unlocked || !this.ctx || !this.engineFilter) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Fréquence du filtre selon la vitesse
    const targetFreq = boosting ? 650 : braking ? 220 : 380 + (speed / 200) * 180;
    this.engineFilter.frequency.setTargetAtTime(targetFreq, t, 0.15);

    // Sifflement de turbine
    const turbineFreq = boosting ? 880 : 350 + (speed / 200) * 280;
    this.engineOsc.frequency.setTargetAtTime(turbineFreq, t, 0.15);

    // Volume du réacteur
    const targetVol = boosting ? 0.42 : braking ? 0.14 : 0.24;
    this.engineGain.gain.setTargetAtTime(targetVol, t, 0.12);
  }

  // Tir de canon rotatif Vulcan M61 (BRRRR-D-D-D-T)
  playVulcanShot() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Détonation courte et claquante
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.05);

    gain.gain.setValueAtTime(0.35, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.05);

    osc.connect(gain).connect(this.fxGain);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // Impact sur avion adverse (bruit d'impact métallique crunch)
  playHit() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);

    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.07);

    osc.connect(gain).connect(this.fxGain);
    osc.start(t);
    osc.stop(t + 0.07);
  }

  // Alarme de surchauffe
  playOverheat() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, t);
    osc.frequency.setValueAtTime(600, t + 0.08);

    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);

    osc.connect(gain).connect(this.fxGain);
    osc.start(t);
    osc.stop(t + 0.16);
  }

  // Explosion d'un avion en vol (KABOOM)
  playExplosion() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Détonation très grave
    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, t);
    osc.frequency.exponentialRampToValueAtTime(18, t + 0.6);

    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.6);

    osc.connect(gain).connect(this.fxGain);
    osc.start(t);
    osc.stop(t + 0.6);

    // Souffle de débris
    this.playNoise(t, 0.55, 0.7);
  }

  playNoise(startTime, duration, vol = 0.5) {
    const c = this.ctx;
    const bufferSize = Math.floor(c.sampleRate * duration);
    const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = c.createBufferSource();
    noise.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(600, startTime);
    filter.frequency.linearRampToValueAtTime(80, startTime + duration);

    const gain = c.createGain();
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

    noise.connect(filter).connect(gain).connect(this.fxGain);
    noise.start(startTime);
    noise.stop(startTime + duration);
  }
}
