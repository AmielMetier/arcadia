// The Backrooms - Synthétiseur audio WebAudio spatialisé
// Bourdonnement strident et glitché qui s'amplifie à l'approche de l'entité

import { growlBuffer } from './entity.js';
const VOICE = new URL('../monster/david.mp3', import.meta.url).href;
// souffle haletant (« breathing tired » de mikeask, OpenGameArt, CC0)
const BREATH = new URL('../sfx/souffle.mp3', import.meta.url).href;
// sons du jeu (backrooms/sfx/) : un dossier par niveau (cris de poursuite, ambiances jouées au hasard, le son de la
// mort toute proche) ; ce qui est à la racine du dossier sert partout
const SFX = (name) => new URL(`../sfx/${name}.mp3`, import.meta.url).href;
const range = (dir, base, n) => Array.from({ length: n }, (_, i) => `${dir}/${base}_${i + 1}`);
const LEVEL_SFX = {
  0: { chase: range('level0', 'chase', 3), ambient: range('level0', 'ambiant', 9), death: 'level0/death' },
  1: { chase: range('level1', 'chase', 1), ambient: [], death: null },
  2: { chase: [], ambient: [], death: null }, // Poolrooms : pas encore de sons
};
// joué en boucle par-dessus les cris de poursuite, à tous les niveaux
const CHASE_ALL = 'chase_all';
const levelSfx = (level) => LEVEL_SFX[level] || LEVEL_SFX[0];

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
    this.master = window.DDVolume ? window.DDVolume.gain(c, 'fx') : c.createGain();
    this.master.connect(c.destination);
    // les bruits de la pièce passent par this.out : le son direct, plus son écho dans les couloirs (réverbération
    // à convolution, réglée par setRoom). L'ambiance et ton propre souffle restent secs (this.master).
    this.out = c.createGain();
    this.out.connect(this.master);
    this.verb = c.createConvolver();
    this.verbLp = c.createBiquadFilter();
    this.verbLp.type = 'lowpass';
    this.verbLp.frequency.value = 4200;
    this.wet = c.createGain();
    this.out.connect(this.verb).connect(this.verbLp).connect(this.wet).connect(this.master);
    this.setRoom(0);
    // l'oreille : HRTF (on entend devant, derrière, à gauche, à droite)
    this.setListener(0, 0, 0);

    // 1. Initialiser le bourdonnement strident et glitché de l'entité
    this.initMonsterAudio();

    // 2. Initialiser l'ambiance des néons fluorescents
    this.initAmbientAudio();

    this.unlocked = true;
  }

  // L'écho des couloirs : une réponse impulsionnelle calculée (premières réflexions sur les murs proches, puis une
  // longue queue qui s'éteint). Level 0 : moquette et faux plafond, un écho moyen ; Level 1 : béton, il traîne.
  setRoom(level = 0) {
    if (!this.ctx || this.roomLevel === level) return;
    this.roomLevel = level;
    const c = this.ctx;
    // Poolrooms : salle carrelée immense et vide, une queue de 4,5 s et des échos plus francs
    const len = level === 2 ? 4.5 : level === 1 ? 3.4 : 2.3;
    const n = Math.floor(c.sampleRate * len);
    const ir = c.createBuffer(2, n, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      const pre = Math.floor(c.sampleRate * 0.018);
      for (let i = pre; i < n; i++) {
        const k = (i - pre) / (n - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, level === 2 ? 2.2 : level === 1 ? 2.6 : 3.4) * 0.6;
      }
      // quelques échos francs sur les murs (décalés à gauche et à droite)
      for (const [ms, a] of [[23, 0.9], [41, 0.6], [67, 0.45], [97, 0.35], [131, 0.25], [173, 0.18]]) {
        const i = Math.floor(c.sampleRate * (ms + (ch ? 7 : 0)) / 1000);
        if (i < n) d[i] += (Math.random() < 0.5 ? -1 : 1) * a;
      }
    }
    this.verb.buffer = ir;
    this.wet.gain.setTargetAtTime(level === 2 ? 0.62 : level === 1 ? 0.5 : 0.38, c.currentTime, 0.2);
    this.verbLp.frequency.value = level === 2 ? 7000 : level === 1 ? 5200 : 3600;
    this.setPool(level === 2);
  }

  // l'oreille du joueur : sa position et la direction de son regard (yaw de la caméra)
  setListener(x, z, yaw) {
    const L = this.ctx && this.ctx.listener;
    if (!L) return;
    this.ear = { x, z, yaw };
    const fx = -Math.sin(yaw);
    const fz = -Math.cos(yaw);
    if (L.positionX) {
      const t = this.ctx.currentTime;
      L.positionX.setTargetAtTime(x, t, 0.02);
      L.positionY.setTargetAtTime(1.6, t, 0.02);
      L.positionZ.setTargetAtTime(z, t, 0.02);
      L.forwardX.setTargetAtTime(fx, t, 0.02);
      L.forwardY.setTargetAtTime(0, t, 0.02);
      L.forwardZ.setTargetAtTime(fz, t, 0.02);
      L.upX.value = 0;
      L.upY.value = 1;
      L.upZ.value = 0;
    } else {
      L.setPosition(x, 1.6, z);
      L.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  // une source placée dans l'espace (HRTF) ; rolloff 0 : seule la direction compte
  panner(rolloff = 1, ref = 2.5) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = 120;
    p.connect(this.out);
    return p;
  }

  moveTo(p, x, z, smooth = 0) {
    if (p.positionX) {
      const t = this.ctx.currentTime;
      if (smooth) {
        p.positionX.setTargetAtTime(x, t, smooth);
        p.positionY.setTargetAtTime(1.2, t, smooth);
        p.positionZ.setTargetAtTime(z, t, smooth);
      } else {
        p.positionX.setValueAtTime(x, t);
        p.positionY.setValueAtTime(1.2, t);
        p.positionZ.setValueAtTime(z, t);
      }
    } else p.setPosition(x, 1.2, z);
  }

  // entrée d'un son ponctuel placé en { x, z } ; muffled : de l'autre étage, étouffé à travers le plancher
  at(pos, vol = 1) {
    const c = this.ctx;
    const p = this.panner(pos.rolloff ?? 1, pos.ref ?? 2.5);
    this.moveTo(p, pos.x, pos.z);
    let head = p;
    if (pos.muffled) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.connect(head);
      head = lp;
    }
    const g = c.createGain();
    g.gain.value = vol * (pos.muffled ? 0.5 : 1);
    g.connect(head);
    return g;
  }

  initMonsterAudio() {
    const c = this.ctx;

    // Gain principal du monstre (contrôlé en continu par la distance)
    this.monsterGain = c.createGain();
    this.monsterGain.gain.setValueAtTime(0.0001, c.currentTime);

    // placé en 3D là où se trouve l'entité (son volume, lui, suit le danger : pas d'atténuation en plus)
    this.monsterPanner = this.panner(0);
    this.monsterGain.connect(this.monsterPanner);

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

    // Le grésillement des ballasts : un 120 Hz riche en harmoniques, adouci, avec une pointe de sifflement aigu
    const buzz = c.createOscillator();
    buzz.type = 'sawtooth';
    buzz.frequency.setValueAtTime(120, c.currentTime);
    const buzzLp = c.createBiquadFilter();
    buzzLp.type = 'lowpass';
    buzzLp.frequency.value = 700;
    buzzLp.Q.value = 0.7;
    const buzzGain = c.createGain();
    buzzGain.gain.value = 0.32;
    buzz.connect(buzzLp).connect(buzzGain).connect(this.ambientGain);
    // le 60 Hz du secteur, en fond
    const hum = c.createOscillator();
    hum.type = 'sine';
    hum.frequency.setValueAtTime(60, c.currentTime);
    hum.connect(this.ambientGain);
    // sifflement aigu, qui flotte un peu
    const whine = c.createOscillator();
    whine.type = 'sine';
    whine.frequency.setValueAtTime(7400, c.currentTime);
    const wob = c.createOscillator();
    wob.frequency.value = 0.3;
    const wobGain = c.createGain();
    wobGain.gain.value = 40;
    wob.connect(wobGain).connect(whine.frequency);
    const whineGain = c.createGain();
    whineGain.gain.value = 0.025;
    whine.connect(whineGain).connect(this.ambientGain);
    this.ambientGain.connect(this.master);

    // Le « silence » d'une pièce vide : un souffle grave, toujours là, même dans le noir
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; // bruit brun
      d[i] = last * 3.5;
    }
    const room = c.createBufferSource();
    room.buffer = buf;
    room.loop = true;
    const roomLp = c.createBiquadFilter();
    roomLp.type = 'lowpass';
    roomLp.frequency.value = 380;
    this.roomGain = c.createGain();
    this.roomGain.gain.value = 0.05;
    room.connect(roomLp).connect(this.roomGain).connect(this.master);

    buzz.start();
    hum.start();
    whine.start();
    wob.start();
    room.start();
  }

  // Ton souffle : il s'emballe quand tu sprintes, reste haletant tant que tu n'as pas récupéré, et la peur
  // l'accélère quand l'entité approche (level de 0 à 1)
  setBreath(level) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    if (!this.breathGain) {
      this.breathGain = c.createGain();
      this.breathGain.gain.value = 0;
      this.breathGain.connect(this.master);
      fetch(BREATH)
        .then((r) => r.arrayBuffer())
        .then((b) => c.decodeAudioData(b))
        .then((buf) => {
          const src = c.createBufferSource();
          src.buffer = buf;
          src.loop = true;
          src.connect(this.breathGain);
          src.start();
          this.breathSrc = src;
        })
        .catch(() => {});
    }
    const t = c.currentTime;
    this.breathGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.55, t, level > 0.05 ? 0.35 : 0.8);
    // plus essoufflé, plus rapide
    if (this.breathSrc) this.breathSrc.playbackRate.setTargetAtTime(0.9 + Math.min(1, level) * 0.25, t, 0.5);
  }

  // Le grésillement suit les néons autour de toi (light : la lumière reçue là où tu es, 0 dans le noir)
  setHum(light) {
    if (!this.unlocked || !this.ambientGain || this.dark) return;
    const t = this.ctx.currentTime;
    this.ambientGain.gain.setTargetAtTime(0.012 + Math.min(1, light) * 0.07, t, 0.3);
  }

  // La voix de l'entité du Level 1 : la bande-son de sa vidéo, jouée en boucle sans fin. Chargée une seule fois,
  // au premier besoin ; elle passe par le même panoramique que le bourdonnement.
  initVoice() {
    const c = this.ctx;
    this.voiceGain = c.createGain();
    this.voiceGain.gain.setValueAtTime(0.0001, c.currentTime);
    this.voiceGain.connect(this.monsterPanner || this.out);
    this.loadVoice();
  }

  // mode VIP : la voix d'origine ; sinon un grognement grave synthétisé
  setVoiceMode(vip) {
    if (this.voiceVip === !!vip) return;
    this.voiceVip = !!vip;
    if (this.voiceGain) this.loadVoice();
  }

  loadVoice() {
    const c = this.ctx;
    try { this.voiceSrc?.stop(); } catch {}
    this.voiceSrc = null;
    const want = !!this.voiceVip;
    (want ? fetch(VOICE).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)) : Promise.resolve(growlBuffer(c)))
      .then((buf) => {
        if (want !== !!this.voiceVip) return;
        const src = c.createBufferSource();
        this.voiceSrc = src;
        src.buffer = buf;
        src.loop = true;
        src.connect(this.voiceGain);
        src.start();
      })
      .catch(() => {});
  }

  // Mettre à jour le bourdonnement strident de l'entité à chaque frame ; voice : c'est la voix du Level 1 qu'on
  // entend à la place du bourdonnement
  // pos : { x, z } de l'entité (null : on ne bouge pas la source)
  updateMonsterSound(danger, pos, voice = false) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    if (voice && !this.voiceGain) this.initVoice();
    // toujours un murmure au loin, de plus en plus fort à mesure qu'elle approche
    if (this.voiceGain && !(t < this.scareUntil)) this.voiceGain.gain.setTargetAtTime(voice ? 0.04 + Math.pow(danger, 0.8) * 1.3 : 0.0001, t, 0.1);

    // le grésillement électrique de l'entité est coupé : on l'entend venir par ses cris et ses pas
    const targetVol = 0.0001;
    this.monsterGain.gain.setTargetAtTime(targetVol, t, 0.08);

    if (pos && typeof pos === 'object') this.moveTo(this.monsterPanner, pos.x, pos.z, 0.05);

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
  // Un pas : étouffé et un peu spongieux sur la moquette humide, sec et claquant sur le béton (hard)
  // pos : { x, z, muffled } pour les pas d'un autre joueur (sinon ce sont les tiens) ; vol : plus bas pour les autres
  // hard : true sur le béton ou le carrelage, false sur la moquette, 'water' dans l'eau (Poolrooms)
  step(hard = false, pos = null, vol = 1) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const v = 0.8 + Math.random() * 0.4;
    const dest = pos ? this.at(pos, vol) : this.out;
    if (hard === 'water') {
      // pataugeage : l'eau fendue (bruit filtré qui monte et retombe) et deux ou trois gouttes qui retombent
      const n = Math.floor(c.sampleRate * 0.35);
      const buf = c.createBuffer(1, n, c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) {
        const k = i / n;
        d[i] = (Math.random() * 2 - 1) * Math.sin(Math.PI * Math.min(1, k * 3)) * Math.pow(1 - k, 2);
      }
      const src = c.createBufferSource();
      src.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.setValueAtTime(900 * v, t);
      f.frequency.exponentialRampToValueAtTime(2600 * v, t + 0.12);
      f.Q.value = 0.8;
      const g = c.createGain();
      g.gain.value = 0.16 * v;
      src.connect(f).connect(g).connect(dest);
      src.start(t);
      for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) this.plop(t + 0.12 + Math.random() * 0.25, 0.04 * v, dest);
      return;
    }

    // le talon : un coup sourd
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime((hard ? 110 : 80) * v, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + 0.07);
    g.gain.setValueAtTime(hard ? 0.05 : 0.045, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g);
    g.connect(dest);
    osc.start(t);
    osc.stop(t + 0.09);

    // la semelle : un frottement de fibres (moquette) ou un claquement (béton)
    const n = Math.floor(c.sampleRate * (hard ? 0.05 : 0.12));
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, hard ? 4 : 1.6);
    const src = c.createBufferSource();
    src.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = hard ? 'highpass' : 'lowpass';
    f.frequency.value = hard ? 1800 * v : 900 * v;
    const ng = c.createGain();
    ng.gain.value = (hard ? 0.09 : 0.05) * v;
    src.connect(f).connect(ng).connect(dest);
    src.start(t + (hard ? 0 : 0.02));
  }

  // une goutte qui tombe dans l'eau : un « plop » qui monte vite
  plop(t, vol, dest) {
    const c = this.ctx;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    const f0 = 500 + Math.random() * 700;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.6, t + 0.05);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + 0.08);
  }

  // Poolrooms : le ronronnement grave des pompes de filtration (50 Hz et ses harmoniques), toujours là, très bas
  setPool(on) {
    const c = this.ctx;
    if (!c) return;
    if (on && !this.pump) {
      const g = c.createGain();
      g.gain.value = 0;
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 260;
      const oscs = [[50, 1], [100, 0.5], [150, 0.22], [200, 0.1]].map(([f, a]) => {
        const o = c.createOscillator();
        o.frequency.value = f;
        const og = c.createGain();
        og.gain.value = a;
        o.connect(og).connect(lp);
        o.start();
        return o;
      });
      // une lente respiration du moteur
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.13;
      const lg = c.createGain();
      lg.gain.value = 0.006;
      lfo.connect(lg).connect(g.gain);
      lfo.start();
      lp.connect(g).connect(this.out);
      this.pump = { g, oscs, lfo };
      this.dripT = 2;
    }
    if (this.pump) this.pump.g.gain.setTargetAtTime(on ? 0.022 : 0, c.currentTime, 1.5);
    this.poolOn = on;
  }

  // Poolrooms : des gouttes lointaines, à intervalles irréguliers, d'un côté ou de l'autre
  drips(dt) {
    if (!this.poolOn || !this.unlocked || !this.ctx) return;
    this.dripT -= dt;
    if (this.dripT > 0) return;
    this.dripT = 0.7 + Math.random() * 3.3;
    const e = this.ear || { x: 0, z: 0 };
    const a = Math.random() * Math.PI * 2;
    const r = 6 + Math.random() * 18;
    this.plop(this.ctx.currentTime, 0.05 + Math.random() * 0.05, this.at({ x: e.x + Math.cos(a) * r, z: e.z + Math.sin(a) * r }, 1));
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
  jumpscare(level = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;

    // Level 1 : sa voix à plein volume, collée à l'oreille, puis le silence
    if (level === 1 && this.voiceGain) {
      if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, t);
      // juste devant toi
      if (this.monsterPanner && this.ear) this.moveTo(this.monsterPanner, this.ear.x - Math.sin(this.ear.yaw) * 0.6, this.ear.z - Math.cos(this.ear.yaw) * 0.6);
      this.voiceGain.gain.cancelScheduledValues(t);
      this.voiceGain.gain.setValueAtTime(2.2, t);
      this.scareUntil = t + 1.6;
      this.voiceGain.gain.setTargetAtTime(0.0001, t + 1.2, 0.15);
      return;
    }

    // Coupe le son de traque continu
    if (this.monsterGain) {
      this.monsterGain.gain.setValueAtTime(0.0001, t);
    }
    if (this.voiceGain) this.voiceGain.gain.setValueAtTime(0.0001, t);

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

  // --- Level 2 : le troupeau ---

  // un bruit blanc d'une seconde, partagé
  noise() {
    if (!this.noiseBuf) {
      const c = this.ctx;
      this.noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.loop = true;
    return n;
  }

  // une rafale de bruit filtré (souffle, raclement, choc) : début t, durée, filtre, volume
  burst(out, t, dur, type, freq, q, vol) {
    const c = this.ctx;
    const n = this.noise();
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.02);
  }

  // Bêlement : une voix nasale (dents de scie passées par les formants d'un « è ») qui chevrote, un peu rauque.
  // kind : 'bleat' (au loin), 'spot' (elle t'a vu : plus fort, qui monte), 'flee' (cri aigu), 'hurt' (sonnée),
  // 'scream' (collée à toi)
  goatBleat(pos, kind = 'bleat') {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    // bellow : le bouc alpha, grave et long, qui porte dans toutes les galeries
    const dur = kind === 'bellow' ? 1.7 : kind === 'flee' ? 0.5 : kind === 'spot' ? 1.15 : kind === 'scream' ? 1.0 : kind === 'hurt' ? 0.45 : 0.75 + Math.random() * 0.45;
    const f0 = (kind === 'bellow' ? 118 : kind === 'flee' ? 560 : kind === 'scream' ? 430 : kind === 'spot' ? 290 : kind === 'hurt' ? 360 : 250) * (0.88 + Math.random() * 0.24);
    const vol = { bleat: 0.6, spot: 1.0, flee: 0.8, hurt: 0.7, scream: 2.0, bellow: 2.6 }[kind];
    if (kind === 'bellow') pos = { ...pos, rolloff: 0.5, ref: 6 };
    const out = this.at(pos, vol);
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(f0 * 0.9, t);
    osc.frequency.linearRampToValueAtTime(f0 * (kind === 'spot' || kind === 'scream' ? 1.18 : 1.03), t + dur * 0.35);
    osc.frequency.linearRampToValueAtTime(f0 * (kind === 'scream' ? 0.55 : 0.82), t + dur);
    // le chevrotement : la voix tremble, en hauteur et en volume (15 à 22 fois par seconde)
    const lfo = c.createOscillator();
    lfo.frequency.value = 15 + Math.random() * 7;
    const lf = c.createGain();
    lf.gain.value = f0 * 0.07;
    lfo.connect(lf).connect(osc.frequency);
    const trem = c.createGain();
    trem.gain.value = 0.55;
    const la = c.createGain();
    la.gain.value = 0.45;
    lfo.connect(la).connect(trem.gain);
    const mix = c.createGain();
    for (const [f, q, g] of [[640, 5, 1], [1750, 7, 0.55], [2700, 9, 0.3]]) {
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = f * (kind === 'flee' ? 1.25 : kind === 'bellow' ? 0.62 : 1);
      bp.Q.value = q;
      const bg = c.createGain();
      bg.gain.value = g * 2.2;
      osc.connect(bp).connect(bg).connect(mix);
    }
    if (!this.rasp) {
      this.rasp = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) this.rasp[i] = Math.tanh(((i / 1023) * 2 - 1) * 3.2);
    }
    const sh = c.createWaveShaper();
    sh.curve = this.rasp;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5, t + 0.05);
    env.gain.setValueAtTime(0.5, t + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    mix.connect(sh).connect(trem).connect(env).connect(out);
    osc.start(t);
    lfo.start(t);
    osc.stop(t + dur + 0.05);
    lfo.stop(t + dur + 0.05);
  }

  // Avant la charge : elle souffle par les naseaux et racle le sol du sabot
  goatSnort(pos) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.at(pos, 1);
    this.burst(out, t, 0.22, 'bandpass', 900, 1.2, 0.5);
    this.burst(out, t + 0.28, 0.18, 'bandpass', 1100, 1.2, 0.4);
    for (const k of [0.15, 0.4, 0.62]) this.burst(out, t + k, 0.09, 'highpass', 2600, 0.8, 0.35);
  }

  // un sabot sur le carrelage : un claquement sec et un coup sourd
  goatHoof(pos, vol = 1) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    const out = this.at(pos, vol);
    this.burst(out, t, 0.035, 'bandpass', 2100 + Math.random() * 600, 2.5, 0.6);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.06);
    const g = c.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.08);
  }

  // dans les gaines : des coups métalliques irréguliers et un raclement, étouffés par la tôle
  goatVent(pos) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.01;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.connect(this.at(pos, 0.8));
    this.burst(lp, t0, 1.4, 'bandpass', 1300, 2, 0.12);
    let t = t0;
    for (let i = 0; i < 6 + Math.floor(Math.random() * 5); i++) {
      t += 0.08 + Math.random() * 0.2;
      for (const [f, a] of [[290, 0.3], [830, 0.2], [1610, 0.12]]) {
        const o = c.createOscillator();
        o.frequency.value = f * (0.9 + Math.random() * 0.2);
        const g = c.createGain();
        g.gain.setValueAtTime(a, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
        o.connect(g).connect(lp);
        o.start(t);
        o.stop(t + 0.2);
      }
    }
  }

  // la charge finit dans le mur : un choc sourd, puis elle bêle, sonnée
  goatCrash(pos) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.at(pos, 1.3);
    const o = c.createOscillator();
    o.frequency.setValueAtTime(110, t);
    o.frequency.exponentialRampToValueAtTime(38, t + 0.3);
    const g = c.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + 0.4);
    this.burst(out, t, 0.25, 'lowpass', 700, 0.7, 0.7);
    setTimeout(() => this.goatBleat(pos, 'hurt'), 350);
  }

  // la cloche du bouc : un bronze fêlé (partiels inharmoniques), qui s'entend de loin
  goatBell(pos, vol = 1) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    const out = this.at({ ...pos, rolloff: 0.55, ref: 5 }, 0.55 * vol);
    const f = 560 * (0.97 + Math.random() * 0.06);
    for (const [m, g, d] of [[1, 1, 0.9], [2.32, 0.55, 0.6], [3.76, 0.35, 0.4], [5.4, 0.2, 0.25], [1.5, 0.25, 0.5]]) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = f * m;
      const e = c.createGain();
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(0.3 * g, t + 0.004);
      e.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(e).connect(out);
      o.start(t);
      o.stop(t + d + 0.05);
    }
    this.burst(out, t, 0.04, 'bandpass', 3200, 2, 0.4); // le battant
  }

  // un secteur qui saute : des claquements électriques, puis le bourdonnement qui retombe
  blowout(pos) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.at({ ...pos, rolloff: 0.6, ref: 6 }, 1.2);
    for (let i = 0; i < 5; i++) this.burst(out, t + i * 0.09 + Math.random() * 0.05, 0.05, 'highpass', 2500, 0.8, 0.6);
    this.burst(out, t + 0.45, 0.5, 'lowpass', 220, 0.8, 1.2);
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(30, t + 1.2);
    const e = c.createGain();
    e.gain.setValueAtTime(0.12, t);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 600;
    o.connect(lp).connect(e).connect(out);
    o.start(t);
    o.stop(t + 1.3);
  }

  // le levier du disjoncteur qui claque, puis les ballasts qui se rallument
  breakerClunk(pos) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.at({ ...pos, rolloff: 0.7, ref: 4 }, 1.4);
    this.burst(out, t, 0.12, 'lowpass', 400, 1, 1.4);
    this.burst(out, t, 0.05, 'bandpass', 2400, 3, 0.6);
    for (let i = 0; i < 4; i++) this.burst(out, t + 0.35 + i * 0.12, 0.04, 'bandpass', 4000, 4, 0.25);
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 100;
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t + 0.3);
    e.gain.exponentialRampToValueAtTime(0.05, t + 0.6);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    o.connect(lp).connect(e).connect(out);
    o.start(t + 0.3);
    o.stop(t + 1.9);
  }

  // brûlé par un jet de vapeur : le sifflement qui gicle et le cri étouffé
  steamBurn(pos) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.at(pos, 1);
    this.burst(out, t, 0.9, 'highpass', 2800, 0.7, 0.6);
    this.burst(out, t, 0.35, 'bandpass', 600, 1.5, 0.5);
  }

  // L'écran de mort du Level 2, calé sur l'image qui monte (8 s) : un grondement sous les pieds, un chœur de chèvres qui
  // hurlent au ralenti en accords faux (voix modulées en anneau, inhumaines), une plainte de métal qui grince, des
  // chuchotements qui tournent autour de la tête, un cœur lourd. Tout enfle… et se tait d'un coup quand le texte
  // apparaît. Dans le silence, tout près, un rire de bouc ralenti, qui s'éteint.
  goatDeath() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.03;
    const CUT = 8.6;
    // tout passe par un compresseur, coupé net à CUT
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.ratio.value = 6;
    comp.attack.value = 0.01;
    comp.release.value = 0.3;
    const bus = c.createGain();
    bus.gain.setValueAtTime(0.62, t);
    bus.gain.setValueAtTime(0.62, t + CUT - 0.015);
    bus.gain.linearRampToValueAtTime(0, t + CUT);
    comp.connect(bus).connect(this.master);
    const stop = (n, a = 0) => {
      n.start(t + a);
      n.stop(t + CUT + 0.1);
      return n;
    };
    const osc = (type, f) => {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      return o;
    };
    const gain = (v = 0) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };
    const filt = (type, f, q = 1) => {
      const b = c.createBiquadFilter();
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    const swell = (g, a, b, v, curve = 2) => {
      // montée lente, de plus en plus raide
      const pts = 24;
      g.gain.setValueAtTime(0.0001, t + a);
      for (let i = 1; i <= pts; i++) g.gain.linearRampToValueAtTime(v * Math.pow(i / pts, curve), t + a + ((b - a) * i) / pts);
    };
    if (!this.rasp) {
      this.rasp = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) this.rasp[i] = Math.tanh(((i / 1023) * 2 - 1) * 3.2);
    }
    const shaper = () => {
      const w = c.createWaveShaper();
      w.curve = this.rasp;
      return w;
    };

    // 1. le grondement : trois sons très graves qui battent entre eux, comme un moteur sous le sol
    const rg = gain();
    swell(rg, 0, CUT, 0.55, 1.4);
    const rl = filt('lowpass', 110, 0.7);
    rl.connect(rg).connect(comp);
    for (const f of [29, 30.7, 43.6]) stop(osc('sawtooth', f)).connect(rl);

    // 2. le chœur : six chèvres qui hurlent au ralenti, en grappe d'accords faux, chacune à sa place autour de toi.
    // Leur bouche se referme lentement (« aa » vers « ou »), leur voix tremble et se modulent en anneau.
    const cluster = [[185, -0.8], [196, 0.6], [262, -0.3], [277, 0.25], [370, 0.85], [392, -0.6]];
    cluster.forEach(([f0, pan], i) => {
      const o = stop(osc('sawtooth', f0));
      o.frequency.setValueAtTime(f0, t);
      o.frequency.linearRampToValueAtTime(f0 * (0.86 + Math.random() * 0.05), t + CUT);
      const wob = stop(osc('sine', 4.5 + Math.random() * 2.5));
      const wg = gain(f0 * 0.035);
      wob.connect(wg).connect(o.frequency);
      const drift = stop(osc('sine', 0.15 + Math.random() * 0.2));
      const dg = gain(f0 * 0.04);
      drift.connect(dg).connect(o.frequency);
      const mouth = gain(1);
      for (const [fa, fb, q, g] of [[820, 330, 6, 1], [1200, 870, 7, 0.6], [2800, 2300, 9, 0.3]]) {
        const bp = filt('bandpass', fa, q);
        bp.frequency.setValueAtTime(fa, t);
        bp.frequency.linearRampToValueAtTime(fb, t + CUT);
        const bg = gain(g * 3);
        o.connect(bp).connect(bg).connect(mouth);
      }
      // modulation en anneau : la voix multipliée par un son grave, elle n'a plus rien d'animal
      const ring = gain(0);
      stop(osc('sine', 31 + i * 7.3)).connect(ring.gain);
      const dry = gain(0.45);
      const vg = gain();
      swell(vg, 0.6 + i * 0.45, CUT, 0.085, 2.2);
      const p = c.createStereoPanner();
      p.pan.value = pan;
      const sh = shaper();
      mouth.connect(ring).connect(sh);
      mouth.connect(dry).connect(sh);
      sh.connect(vg).connect(p).connect(comp);
    });

    // 3. le métal qui grince : un souffle dans un filtre très étroit qui glisse, renvoyé par un écho très court
    const n = stop(this.noise(), 0);
    const bp = filt('bandpass', 1900, 38);
    bp.frequency.setValueAtTime(1900, t + 2);
    bp.frequency.linearRampToValueAtTime(3400, t + CUT);
    const sweep = stop(osc('sine', 0.37));
    const sweepG = gain(260);
    sweep.connect(sweepG).connect(bp.frequency);
    const comb = c.createDelay(0.05);
    comb.delayTime.value = 0.0029;
    const fb = gain(0.82);
    const mg = gain();
    swell(mg, 2.2, CUT, 0.5, 2.6);
    n.connect(bp).connect(comb).connect(fb).connect(comb);
    comb.connect(mg).connect(comp);

    // 4. des chuchotements : des syllabes de souffle (formants qui sautent d'une voyelle à l'autre) qui passent d'une
    // oreille à l'autre
    const wn = stop(this.noise(), 0);
    const wm = gain(1);
    const vowels = [[300, 870, 2240], [730, 1090, 2440], [270, 2290, 3010], [570, 840, 2410], [440, 1020, 2240]];
    const forms = [0, 1, 2].map((k) => {
      const b = filt('bandpass', vowels[0][k], 9);
      const g = gain([1, 0.7, 0.4][k] * 4);
      wn.connect(b).connect(g).connect(wm);
      return b;
    });
    const gate = gain(0);
    const wp = c.createStereoPanner();
    const ww = gain();
    swell(ww, 1.5, CUT, 0.9, 1.2);
    wm.connect(gate).connect(wp).connect(ww).connect(comp);
    for (let k = 1.5; k < CUT - 0.1; ) {
      const len = 0.08 + Math.random() * 0.22;
      const v = vowels[Math.floor(Math.random() * vowels.length)];
      forms.forEach((b, j) => b.frequency.setTargetAtTime(v[j] * (0.9 + Math.random() * 0.2), t + k, 0.02));
      gate.gain.setTargetAtTime(0.7 + Math.random() * 0.3, t + k, 0.015);
      gate.gain.setTargetAtTime(0, t + k + len, 0.03);
      wp.pan.setTargetAtTime(Math.sin(k * 1.7) * 0.95, t + k, 0.2);
      k += len + (Math.random() < 0.3 ? 0.35 + Math.random() * 0.5 : 0.04 + Math.random() * 0.1);
    }

    // 5. le cœur : lourd, et qui ralentit au lieu d'accélérer
    let bt = 0.3;
    let gap = 0.95;
    while (bt < CUT - 0.3) {
      for (const [dt, v] of [[0, 1], [0.2, 0.7]]) {
        const o = osc('sine', 58);
        o.frequency.setValueAtTime(58, t + bt + dt);
        o.frequency.exponentialRampToValueAtTime(34, t + bt + dt + 0.18);
        const g = gain();
        g.gain.setValueAtTime(0.0001, t + bt + dt);
        g.gain.exponentialRampToValueAtTime(v * 0.5, t + bt + dt + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + bt + dt + 0.22);
        o.connect(g).connect(comp);
        o.start(t + bt + dt);
        o.stop(t + bt + dt + 0.25);
      }
      bt += gap;
      gap *= 1.07;
    }

    // 6. dans le silence, tout près et sans écho : un rire de bouc ralenti (une voix hachée « ha… ha… ha »), qui
    // descend et s'éteint
    const T2 = t + CUT + 0.9;
    const L = 3.6;
    const late = gain(1);
    late.connect(this.master);
    const vo = osc('sawtooth', 120);
    vo.frequency.setValueAtTime(120, T2);
    vo.frequency.exponentialRampToValueAtTime(58, T2 + L);
    const vib = osc('sine', 6);
    const vibG = gain(5);
    vib.connect(vibG).connect(vo.frequency);
    const lm = gain(1);
    for (const [f, q, g] of [[700, 6, 1], [1150, 7, 0.55], [2500, 9, 0.25]]) {
      const b = filt('bandpass', f, q);
      b.frequency.setValueAtTime(f, T2);
      b.frequency.exponentialRampToValueAtTime(f * 0.7, T2 + L);
      const bg = gain(g * 3);
      vo.connect(b).connect(bg).connect(lm);
    }
    // le hachage du rire : de 4,5 à 1,6 coups par seconde
    const chop = gain(0);
    const lfo = osc('sine', 4.5);
    lfo.frequency.setValueAtTime(4.5, T2);
    lfo.frequency.exponentialRampToValueAtTime(1.6, T2 + L);
    const lfoSq = c.createWaveShaper();
    const sq = new Float32Array(256);
    for (let i = 0; i < 256; i++) sq[i] = Math.max(0, Math.tanh(((i / 255) * 2 - 1) * 6));
    lfoSq.curve = sq;
    lfo.connect(lfoSq).connect(chop.gain);
    const lg = gain();
    lg.gain.setValueAtTime(0.0001, T2);
    lg.gain.exponentialRampToValueAtTime(0.6, T2 + 0.08);
    lg.gain.setValueAtTime(0.6, T2 + L * 0.6);
    lg.gain.exponentialRampToValueAtTime(0.0001, T2 + L);
    const lsh = shaper();
    lm.connect(chop).connect(lsh).connect(lg).connect(late);
    for (const o of [vo, vib, lfo]) {
      o.start(T2);
      o.stop(T2 + L + 0.1);
    }
    // et, très bas, le souffle de la bande qui continue
    const hiss = this.noise();
    const hf = filt('highpass', 2500);
    const hg = gain();
    hg.gain.setValueAtTime(0.0001, t + CUT + 0.3);
    hg.gain.linearRampToValueAtTime(0.025, t + CUT + 1.5);
    hg.gain.linearRampToValueAtTime(0.0001, T2 + L + 2);
    hiss.connect(hf).connect(hg).connect(late);
    hiss.start(t + CUT + 0.3);
    hiss.stop(T2 + L + 2.1);
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, t);
  }

  // percuté : le cri de la chèvre collé à toi et le choc
  goatJumpscare() {
    if (!this.unlocked || !this.ctx) return;
    const e = this.ear || { x: 0, z: 0, yaw: 0 };
    const pos = { x: e.x - Math.sin(e.yaw) * 0.5, z: e.z - Math.cos(e.yaw) * 0.5 };
    this.goatBleat(pos, 'scream');
    const t = this.ctx.currentTime + 0.01;
    this.burst(this.out, t, 0.45, 'lowpass', 900, 0.7, 1.2);
    this.burst(this.out, t, 0.3, 'highpass', 1500, 0.7, 0.5);
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, t);
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
  // Pas lourds de l'entité, placés là où elle est, par-dessus ses cris : de plus en plus forts à mesure qu'elle approche
  monsterStep(danger, pos) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const v = 0.35 + Math.min(1, danger) * 1.15;
    const dest = c.createGain();
    dest.gain.value = v;
    dest.connect(pos && typeof pos === 'object' ? this.at({ ...pos, rolloff: 0 }) : this.out);
    // le poids : une basse qui tombe
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(68, t);
    osc.frequency.exponentialRampToValueAtTime(26, t + 0.3);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + 0.36);
    // le choc sur le sol, et un craquement de la dalle
    const n = Math.floor(c.sampleRate * 0.22);
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 5);
    const src = c.createBufferSource();
    src.buffer = buf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 520 + Math.random() * 160;
    const ng = c.createGain();
    ng.gain.value = 0.75;
    src.connect(lp).connect(ng).connect(dest);
    src.start(t);
  }

  // Un son du dossier sfx/, chargé une fois puis gardé
  sample(name) {
    this.samples = this.samples || new Map();
    if (!this.samples.has(name)) {
      const c = this.ctx;
      this.samples.set(
        name,
        fetch(SFX(name))
          .then((r) => r.arrayBuffer())
          .then((b) => c.decodeAudioData(b))
          .catch(() => null),
      );
    }
    return this.samples.get(name);
  }

  // Les cris de la poursuite : tant que l'entité traque, les trois enregistrements s'enchaînent au hasard, placés
  // là où elle est ; ils montent avec le danger et s'éteignent en une seconde et demie quand elle lâche prise
  updateChase(on, danger, pos) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    if (!this.chaseGain) {
      this.chaseGain = c.createGain();
      this.chaseGain.gain.value = 0;
      this.chasePanner = this.panner(0);
      this.chaseGain.connect(this.chasePanner);
      this.sample(CHASE_ALL);
    }
    const list = levelSfx(this.roomLevel).chase;
    if (this.chaseList !== list) {
      this.chaseList = list;
      for (const n of list) this.sample(n);
    }
    if (pos && typeof pos === 'object') this.moveTo(this.chasePanner, pos.x, pos.z, 0.05);
    const want = on ? 0.35 + Math.min(1, danger) * 0.75 : 0;
    this.chaseGain.gain.setTargetAtTime(want, t, on ? 0.25 : 0.5);
    if (on && !this.chasePlaying) this.nextChase();
    if (on && !this.chaseAll) this.startChaseAll();
    else if (!on && this.chaseAll && this.chaseGain.gain.value < 0.02) {
      try {
        this.chaseAll.stop();
      } catch (e) {
        /* déjà fini */
      }
      this.chaseAll = null;
    }
  }

  // la couche commune à toutes les poursuites, en boucle tant que dure la traque
  startChaseAll() {
    this.chaseAll = true; // réservé pendant le chargement
    this.sample(CHASE_ALL).then((buf) => {
      if (!buf || this.chaseAll !== true) return (this.chaseAll = null);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(this.chaseGain);
      src.start();
      this.chaseAll = src;
    });
  }

  nextChase() {
    const CHASE = levelSfx(this.roomLevel).chase;
    if (!CHASE.length) return (this.chasePlaying = false);
    this.chasePlaying = true;
    let name = CHASE[Math.floor(Math.random() * CHASE.length)];
    if (name === this.lastChase && CHASE.length > 1) name = CHASE[(CHASE.indexOf(name) + 1) % CHASE.length];
    this.lastChase = name;
    this.sample(name).then((buf) => {
      if (!buf) return (this.chasePlaying = false);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.connect(this.chaseGain);
      src.start();
      src.onended = () => {
        // on enchaîne tant que la poursuite dure (le volume dit si elle dure encore)
        if (this.chaseGain.gain.value > 0.02) this.nextChase();
        else this.chasePlaying = false;
      };
    });
  }

  // Les ambiances : de temps en temps (toutes les 20 à 50 s), un des enregistrements du niveau, assez bas, avec l'écho
  // des couloirs ; pas pendant une poursuite
  ambience(dt, active) {
    if (!this.unlocked || !this.ctx) return;
    if (this.ambT === undefined) this.ambT = 6 + Math.random() * 10;
    if (!active) return;
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 20 + Math.random() * 30;
    const AMBIENT = levelSfx(this.roomLevel).ambient;
    if (!AMBIENT.length) return;
    let name = AMBIENT[Math.floor(Math.random() * AMBIENT.length)];
    if (name === this.lastAmb) name = AMBIENT[(AMBIENT.indexOf(name) + 1) % AMBIENT.length];
    this.lastAmb = name;
    this.sample(name).then((buf) => {
      if (!buf) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 0.12; // très bas : un fond qu'on devine plus qu'on n'entend
      src.connect(g).connect(this.out);
      src.start();
    });
  }

  // La mort toute proche : l'entité est sur toi
  death() {
    const name = levelSfx(this.roomLevel).death;
    if (!this.unlocked || !this.ctx || !name) return;
    this.sample(name).then((buf) => {
      if (!buf) return;
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = buf;
      const g = c.createGain();
      g.gain.value = 1.1;
      src.connect(g).connect(this.master);
      src.start();
      this.deathSrc = { src, g };
    });
  }

  // on s'en est sorti (ou une nouvelle partie commence) : le son de la mort s'éteint en une demi-seconde
  stopDeath() {
    if (!this.deathSrc || !this.ctx) return;
    const { src, g } = this.deathSrc;
    const t = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, t, 0.15);
    try {
      src.stop(t + 0.8);
    } catch (e) {
      /* déjà fini */
    }
    this.deathSrc = null;
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
    this.dark = true;
  }

  // Le courant revient : le bourdonnement remonte
  power() {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0.045, t, 0.4);
    this.dark = false;
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

  // On se glisse dans un toboggan : un frottement d'eau qui file et s'éloigne, puis quelques gouttes
  splashDown() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const len = 2.2;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource();
    src.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.35);
    bp.frequency.exponentialRampToValueAtTime(300, t + len);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.001, t + len);
    src.connect(bp).connect(g).connect(this.out);
    src.start(t);
    for (let k = 0; k < 4; k++) this.plop(t + 0.1 + Math.random() * 0.6, 0.12, this.out);
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

  // Sifflet : deux notes aiguës qui montent ; pos : { x, z, muffled } d'un autre joueur (null : c'est toi qui siffles).
  // De loin il faiblit mais porte loin dans les couloirs (atténuation douce), d'un autre étage il est étouffé.
  whistle(pos = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const out = c.createGain();
    out.gain.setValueAtTime(pos ? 0.3 : 0.13, t);
    out.connect(pos ? this.at({ ...pos, ref: 3, rolloff: 0.35 }) : this.out);
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

  // Chute dans un trou : un long sifflement d'air qui descend pendant plus d'une seconde, puis un choc sourd et lourd
  // (plus fort pour celui qui tombe)
  fall(mine = true) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const k = mine ? 1 : 0.4;
    const T = 1.1; // durée de la chute
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, t);
    osc.frequency.exponentialRampToValueAtTime(35, t + T);
    g.gain.setValueAtTime(0.05 * k, t);
    g.gain.linearRampToValueAtTime(0.22 * k, t + T * 0.9);
    g.gain.exponentialRampToValueAtTime(0.001, t + T + 0.05);
    osc.connect(g);
    g.connect(this.out);
    osc.start(t);
    osc.stop(t + T + 0.1);
    // l'air qui siffle (bruit filtré)
    const len = Math.floor(c.sampleRate * T);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const air = c.createBufferSource();
    air.buffer = buf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.linearRampToValueAtTime(1600, t + T);
    const ag = c.createGain();
    ag.gain.setValueAtTime(0.0001, t);
    ag.gain.exponentialRampToValueAtTime(0.35 * k, t + T);
    air.connect(bp);
    bp.connect(ag);
    ag.connect(this.out);
    air.start(t);
    // le choc
    const thud = c.createOscillator();
    const tg = c.createGain();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(80, t + T);
    thud.frequency.exponentialRampToValueAtTime(25, t + T + 0.4);
    tg.gain.setValueAtTime(0.0001, t);
    tg.gain.setValueAtTime(0.9 * k, t + T);
    tg.gain.exponentialRampToValueAtTime(0.001, t + T + 0.6);
    thud.connect(tg);
    tg.connect(this.out);
    thud.start(t);
    thud.stop(t + T + 0.65);
  }

  // Victoire
  win() {
    if (!this.unlocked || !this.ctx) return;
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
  }
}
