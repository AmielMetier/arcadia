// The Backrooms - Synthétiseur audio WebAudio spatialisé
// Bourdonnement strident et glitché qui s'amplifie à l'approche de l'entité

export class BackroomsSfx {
  constructor() {
    this.ctx = null;
    this.unlocked = false;

    // Nœuds pour le bourdonnement de l'entité
    this.monsterGain = null;
    this.monsterPanner = null;
    this.monsterOsc1 = null;
    this.monsterOsc2 = null;
    this.monsterMod = null;
    this.monsterFilter = null;

    // Nœud pour l'ambiance des néons fluorescents
    this.ambientGain = null;
  }

  unlock() {
    if (this.unlocked) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const c = (this.ctx = new AudioCtx());
    if (c.state === 'suspended') c.resume();

    // 1. Initialiser le bourdonnement strident et glitché de l'entité
    this.initMonsterAudio();

    // 2. Initialiser l'ambiance des néons fluorescents
    this.initAmbientAudio();

    this.unlocked = true;
  }

  initMonsterAudio() {
    const c = this.ctx;

    // Gain principal du monstre (contrôlé en continu par la distance)
    this.monsterGain = c.createGain();
    this.monsterGain.gain.setValueAtTime(0.0001, c.currentTime);

    // Panoramique stéréo (gauche/droite)
    if (c.createStereoPanner) {
      this.monsterPanner = c.createStereoPanner();
      this.monsterPanner.pan.setValueAtTime(0, c.currentTime);
      this.monsterGain.connect(this.monsterPanner);
      this.monsterPanner.connect(c.destination);
    } else {
      this.monsterGain.connect(c.destination);
    }

    // Oscillateur principal : onde en dents de scie agressive
    this.monsterOsc1 = c.createOscillator();
    this.monsterOsc1.type = 'sawtooth';
    this.monsterOsc1.frequency.setValueAtTime(140, c.currentTime);

    // Second oscillateur : carré désaccordé pour le côté glitch / métallique
    this.monsterOsc2 = c.createOscillator();
    this.monsterOsc2.type = 'square';
    this.monsterOsc2.frequency.setValueAtTime(147, c.currentTime);

    // Oscillateur modulateur LFO pour le strident / tremblement glitch
    this.monsterMod = c.createOscillator();
    this.monsterMod.type = 'sawtooth';
    this.monsterMod.frequency.setValueAtTime(18, c.currentTime);

    const modGain = c.createGain();
    modGain.gain.setValueAtTime(120, c.currentTime);
    this.monsterMod.connect(modGain);
    modGain.connect(this.monsterOsc1.frequency);
    modGain.connect(this.monsterOsc2.frequency);

    // Filtre passe-bande résonant pour le strident perçant
    this.monsterFilter = c.createBiquadFilter();
    this.monsterFilter.type = 'bandpass';
    this.monsterFilter.frequency.setValueAtTime(900, c.currentTime);
    this.monsterFilter.Q.setValueAtTime(4, c.currentTime);

    this.monsterOsc1.connect(this.monsterFilter);
    this.monsterOsc2.connect(this.monsterFilter);
    this.monsterFilter.connect(this.monsterGain);

    this.monsterOsc1.start();
    this.monsterOsc2.start();
    this.monsterMod.start();
  }

  initAmbientAudio() {
    const c = this.ctx;
    this.ambientGain = c.createGain();
    this.ambientGain.gain.setValueAtTime(0.045, c.currentTime); // son d'ambiance discret

    // Bourdonnement 60 Hz + 120 Hz des vieux néons de bureau
    const hum1 = c.createOscillator();
    hum1.type = 'sine';
    hum1.frequency.setValueAtTime(60, c.currentTime);

    const hum2 = c.createOscillator();
    hum2.type = 'sine';
    hum2.frequency.setValueAtTime(120, c.currentTime);

    const humGain2 = c.createGain();
    humGain2.gain.value = 0.35;
    hum2.connect(humGain2);

    hum1.connect(this.ambientGain);
    humGain2.connect(this.ambientGain);
    this.ambientGain.connect(c.destination);

    hum1.start();
    hum2.start();
  }

  // Mettre à jour le bourdonnement strident de l'entité à chaque frame
  updateMonsterSound(danger, pan) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Danger va de 0.0 (silencieux) à 1.0 (très proche, assourdissant)
    const targetVol = Math.max(0.0001, danger * 0.45);
    this.monsterGain.gain.setTargetAtTime(targetVol, t, 0.08);

    // Ajuster le panoramique stéréo (-1 à 1)
    if (this.monsterPanner) {
      this.monsterPanner.pan.setTargetAtTime(pan, t, 0.05);
    }

    // Plus l'entité est proche, plus la fréquence monte dans les aigus stridents et le glitch accélère
    const baseFreq = 140 + danger * 380; // 140Hz -> 520Hz
    const filterFreq = 600 + danger * 1600; // 600Hz -> 2200Hz
    const modRate = 12 + danger * 45; // 12Hz -> 57Hz (glitch frénétique)

    this.monsterOsc1.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.monsterOsc2.frequency.setTargetAtTime(baseFreq * 1.05, t, 0.08);
    this.monsterFilter.frequency.setTargetAtTime(filterFreq, t, 0.08);
    this.monsterMod.frequency.setTargetAtTime(modRate, t, 0.08);
  }

  // Bruit de pas feutrés sur moquette
  step() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.07);

    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);

    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.08);
  }

  // Ramassage d'une cassette VHS
  cassette() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Bruit de clic mécanique
    const click = c.createOscillator();
    const cg = c.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(800, t);
    cg.gain.setValueAtTime(0.12, t);
    cg.gain.exponentialRampToValueAtTime(0.001, t + 0.03);
    click.connect(cg);
    cg.connect(c.destination);
    click.start(t);
    click.stop(t + 0.04);

    // Chime mystérieux montant
    const notes = [440, 554.37, 659.25];
    notes.forEach((f, idx) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + idx * 0.06);

      g.gain.setValueAtTime(0.001, t + idx * 0.06);
      g.gain.linearRampToValueAtTime(0.14, t + idx * 0.06 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.06 + 0.4);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(t + idx * 0.06);
      osc.stop(t + idx * 0.06 + 0.45);
    });
  }

  // Déverrouillage de la sortie
  exitUnlocked() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Alarme/cloche positive
    [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, t + idx * 0.08);

      g.gain.setValueAtTime(0.001, t + idx * 0.08);
      g.gain.linearRampToValueAtTime(0.2, t + idx * 0.08 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.08 + 0.6);

      osc.connect(g);
      g.connect(c.destination);
      osc.start(t + idx * 0.08);
      osc.stop(t + idx * 0.08 + 0.65);
    });
  }

  // Jumpscare / cri violent lors de la capture
  jumpscare() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Coupe le son de traque continu
    if (this.monsterGain) {
      this.monsterGain.gain.setValueAtTime(0.0001, t);
    }

    // Cri strident distordu immédiat
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, t);
    osc.frequency.linearRampToValueAtTime(140, t + 0.6);

    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.7);

    // Bruit blanc d'impact
    const bufferSize = c.sampleRate * 0.4;
    const noiseBuffer = c.createBuffer(1, bufferSize, c.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    const whiteNoise = c.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.4, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.4);

    whiteNoise.connect(ng);
    ng.connect(c.destination);
    whiteNoise.start(t);

    osc.connect(g);
    g.connect(c.destination);
    osc.start(t);
    osc.stop(t + 0.75);
  }

  // Gorgée d'eau d'amande
  bottle() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = c.createOscillator();
      const g = c.createGain();
      const t0 = t + i * 0.13;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, t0);
      osc.frequency.exponentialRampToValueAtTime(180, t0 + 0.1);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(0.12, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
      osc.connect(g);
      g.connect(c.destination);
      osc.start(t0);
      osc.stop(t0 + 0.12);
    }
  }

  // L'entité vient de repérer le joueur : coup sourd et grincement
  spotted() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const low = c.createOscillator();
    const lg = c.createGain();
    low.type = 'sine';
    low.frequency.setValueAtTime(70, t);
    low.frequency.exponentialRampToValueAtTime(32, t + 0.9);
    lg.gain.setValueAtTime(0.45, t);
    lg.gain.exponentialRampToValueAtTime(0.001, t + 1);
    low.connect(lg);
    lg.connect(c.destination);
    low.start(t);
    low.stop(t + 1.05);
    const hi = c.createOscillator();
    const hg = c.createGain();
    hi.type = 'sawtooth';
    hi.frequency.setValueAtTime(1900, t);
    hi.frequency.linearRampToValueAtTime(2300, t + 0.6);
    hg.gain.setValueAtTime(0.0001, t);
    hg.gain.linearRampToValueAtTime(0.05, t + 0.05);
    hg.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
    hi.connect(hg);
    hg.connect(c.destination);
    hi.start(t);
    hi.stop(t + 0.75);
  }

  // Victoire
  win() {
    if (!this.unlocked || !this.ctx) return;
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
  }
}
