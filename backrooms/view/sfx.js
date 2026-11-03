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
    // sortie commune, réglée par le curseur « Effets » du panneau Réglages
    this.out = window.DDVolume ? window.DDVolume.gain(c, 'fx') : c.createGain();
    this.out.connect(c.destination);

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
      this.monsterPanner.connect(this.out);
    } else {
      this.monsterGain.connect(this.out);
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
    this.ambientGain.connect(this.out);

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
    g.connect(this.out);
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
    cg.connect(this.out);
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
      g.connect(this.out);
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
      g.connect(this.out);
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
    ng.connect(this.out);
    whiteNoise.start(t);

    osc.connect(g);
    g.connect(this.out);
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
      g.connect(this.out);
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
    lg.connect(this.out);
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
    hg.connect(this.out);
    hi.start(t);
    hi.stop(t + 0.75);
  }

  // Clic des piles (ou lampe à plat : clic sec et grésillement qui meurt)
  battery(empty = false) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const freqs = empty ? [900, 420] : [1200, 1600, 2100];
    freqs.forEach((f, i) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(f, t + i * 0.07);
      if (empty) osc.frequency.exponentialRampToValueAtTime(f * 0.4, t + i * 0.07 + 0.3);
      g.gain.setValueAtTime(0.06, t + i * 0.07);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.07 + (empty ? 0.3 : 0.06));
      osc.connect(g);
      g.connect(this.out);
      osc.start(t + i * 0.07);
      osc.stop(t + i * 0.07 + 0.32);
    });
  }

  // Pas lourds de l'entité, spatialisés, plus forts quand elle est près
  monsterStep(danger, pan) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(75, t);
    osc.frequency.exponentialRampToValueAtTime(30, t + 0.18);
    g.gain.setValueAtTime(0.5 * danger, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
    osc.connect(g);
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(pan, t);
      g.connect(p);
      p.connect(this.out);
    } else g.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  // Coupure de courant : gros claquement du disjoncteur, le bourdonnement des néons se tait
  blackout() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.5);
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    osc.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.65);
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0, t, 0.08);
  }

  // Le courant revient : le bourdonnement remonte
  power() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0.045, t, 0.4);
    this.battery();
  }

  // Ding de l'ascenseur (deux notes de cloche)
  ding() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    [[1318, 0], [1046, 0.28]].forEach(([f, d]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t + d);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.16, t + d + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + 1.2);
      osc.connect(g);
      g.connect(this.out);
      osc.start(t + d);
      osc.stop(t + d + 1.3);
    });
  }

  // L'ascenseur descend : grondement grave qui tremble
  elevator(sec = 3) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const osc = c.createOscillator();
    const lfo = c.createOscillator();
    const lg = c.createGain();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(48, t);
    lfo.frequency.setValueAtTime(7, t);
    lg.gain.setValueAtTime(6, t);
    lfo.connect(lg);
    lg.connect(osc.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(160, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.5);
    g.gain.setValueAtTime(0.2, t + sec - 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + sec);
    osc.connect(f);
    f.connect(g);
    g.connect(this.out);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + sec + 0.1);
    lfo.stop(t + sec + 0.1);
  }

  // Sifflet : deux notes aiguës qui montent ; vol de 0 à 1 (plus faible de loin), pan de -1 (gauche) à 1 (droite)
  whistle(vol = 1, pan = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(0.13 * vol, t);
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.setValueAtTime(pan, t);
      out.connect(p);
      p.connect(this.out);
    } else out.connect(this.out);
    [[1700, 2300, 0, 0.28], [2100, 2700, 0.32, 0.45]].forEach(([f0, f1, d, len]) => {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f0, t + d);
      osc.frequency.exponentialRampToValueAtTime(f1, t + d + len);
      g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(1, t + d + 0.03);
      g.gain.setValueAtTime(1, t + d + len - 0.05);
      g.gain.exponentialRampToValueAtTime(0.001, t + d + len);
      osc.connect(g);
      g.connect(out);
      osc.start(t + d);
      osc.stop(t + d + len + 0.02);
    });
  }

  // Chute dans un trou : un frottement puis un choc sourd (plus fort pour celui qui tombe)
  fall(mine = true) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const k = mine ? 1 : 0.4;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.45);
    g.gain.setValueAtTime(0.25 * k, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + 0.55);
    const thud = c.createOscillator();
    const tg = c.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(70, t + 0.45);
    thud.frequency.exponentialRampToValueAtTime(30, t + 0.7);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.setValueAtTime(0.6 * k, t + 0.45);
    tg.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    thud.connect(tg);
    tg.connect(this.out);
    thud.start(t);
    thud.stop(t + 0.8);
  }

  // Corde qu'on déroule : un sifflement de frottement qui descend
  rope() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const len = 0.6;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(2200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.25, t);
    src.connect(f);
    f.connect(g);
    g.connect(this.out);
    src.start(t);
  }

  // Victoire
  win() {
    if (!this.unlocked || !this.ctx) return;
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
  }
}
