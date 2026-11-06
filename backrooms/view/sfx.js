// The Backrooms - Synthétiseur audio WebAudio spatialisé
// Bourdonnement strident et glitché qui s'amplifie à l'approche de l'entité
//
// Le mixage : tout finit dans this.master (curseur « Effets »), puis une coupure (scareCut) et un limiteur qui ne
// sert qu'à rattraper les jumpscares. En amont :
//   this.out    les bruits de la pièce (son direct + écho des couloirs, réglé par setRoom)
//   this.bedWet l'ambiance de la pièce (gouttes, ambiances, lits synthétisés) : baissée par duck/setChase/silence
//   this.bedDry l'ambiance sèche (le grésillement des néons) : idem
//   this.music  la musique de tension (setTension) : baissée par duck et silence, pas par la poursuite
//   this.ui     les sons hors du monde (bande VHS, cœur, neige télé) : secs, jamais baissés
// Le silence fait plus peur que le bruit : tout reste bas, le limiteur ne doit presque jamais travailler.

import { growlBuffer } from './entity.js';
import { PIPES_LEVEL } from '../engine/level2.js';
const VOICE = new URL('../monster/david.mp3', import.meta.url).href;
// souffle haletant (« breathing tired » de mikeask, OpenGameArt, CC0)
const BREATH = new URL('../sfx/souffle.mp3', import.meta.url).href;
// sons du jeu (backrooms/sfx/) : un dossier par niveau (cris de poursuite, ambiances jouées au hasard, le son de la
// mort toute proche) ; ce qui est à la racine du dossier sert partout
const SFX = (name) => new URL(`../sfx/${name}.mp3`, import.meta.url).href;
const range = (dir, base, n) => Array.from({ length: n }, (_, i) => `${dir}/${base}_${i + 1}`);
// entity : false là où l'entité ne vit pas (ses cris, ses pas, son bourdonnement ne doivent pas y jouer)
const LEVEL_SFX = {
  0: { chase: range('level0', 'chase', 3), ambient: range('level0', 'ambiant', 9), death: 'level0/death' },
  1: { chase: range('level1', 'chase', 1), ambient: [], death: null },
  2: null, // Poolrooms : la même entité qu'au Level 1, les mêmes sons (voir levelSfx)
  [PIPES_LEVEL]: { chase: [], ambient: [], death: null, entity: false }, // Tuyauteries : le troupeau, pas l'entité
  4: { chase: [], ambient: [], death: null }, // Terror Hotel (HOTEL_LEVEL) : pas encore de sons (des craquements synthétisés)
};
const NO_SFX = { chase: [], ambient: [], death: null };
// joué en boucle par-dessus les cris de poursuite, à tous les niveaux où l'entité chasse
const CHASE_ALL = 'chase_all';
const levelSfx = (level) => LEVEL_SFX[level === 2 ? 1 : level] || NO_SFX; // Poolrooms : les sons du Level 1
const hasEntity = (level) => levelSfx(level).entity !== false;

const clamp01 = (v) => Math.max(0, Math.min(1, +v || 0));
const rnd = (a, b) => a + Math.random() * (b - a);
// l'occlusion (un mur entre la source et toi) : true, ou de 0 à 1 ; passe-bas jusqu'à 700 Hz et -4 dB
const occOf = (o) => (o === true ? 1 : clamp01(o));
const occFreq = (k) => 20000 * Math.pow(700 / 20000, k);
const occGain = (k) => Math.pow(10, (-4 * k) / 20);
// des voyelles (trois formants) pour les voix inintelligibles
const VOWELS = [[300, 870, 2240], [730, 1090, 2440], [270, 2290, 3010], [570, 840, 2410], [440, 1020, 2240], [660, 1700, 2400]];
// les couches de la musique de tension selon le moment de la traque (pulse : battements par seconde)
const TENSION = {
  calm: { drone: 0.5, pad: 0.35, strings: 0, pulse: 0 },
  stalk: { drone: 1, pad: 0.8, strings: 0.45, pulse: 0 },
  search: { drone: 1, pad: 1, strings: 0.7, pulse: 0.55, rate: 1.1 },
  chase: { drone: 1, pad: 0.6, strings: 1, pulse: 1, rate: 2.3 },
  relief: { drone: 0.25, pad: 0.3, strings: 0, pulse: 0 },
};
// les sous-titres des sons lointains
const DISTANT_CAP = {
  door: '[door slams]',
  knock: '[knocking in the vents]',
  groan: '[metal groaning]',
  hammer: '[pipes banging]',
  steps: '[footsteps]',
  buzz: '[buzzing]',
  ding: '[elevator ding]',
  drag: '[something dragging]',
  laugh: '[distant laughter]',
};

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

    // sous-titres : onCaption(texte, direction) ; direction 'left' | 'right' | 'behind' | 'ahead' | null
    this.onCaption = null;

    // le mixage : baisse temporaire (duck), poursuite (setChase / updateChase), fenêtre de silence
    this.duckUntil = 0;
    this.duckAmt = 1;
    this.silenceUntil = 0;
    this.chaseAuto = false;
    this.chaseManual = false;
    this.heartRate = 0;
  }

  unlock() {
    if (this.unlocked) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const c = (this.ctx = new AudioCtx());
    if (c.state === 'suspended') c.resume();
    // sortie commune, réglée par le curseur « Effets » du panneau Réglages ; puis la coupure des jumpscares et un
    // limiteur (seuil -6 dB, attaque rapide) qui rattrape les crêtes
    this.master = window.DDVolume ? window.DDVolume.gain(c, 'fx') : c.createGain();
    this.cut = c.createGain();
    this.limiter = c.createDynamicsCompressor();
    this.limiter.threshold.value = -6;
    this.limiter.knee.value = 0;
    this.limiter.ratio.value = 20;
    this.limiter.attack.value = 0.002;
    this.limiter.release.value = 0.15;
    this.master.connect(this.cut).connect(this.limiter).connect(c.destination);
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
    // les bus : sons hors du monde (secs), ambiance de la pièce (avec écho), ambiance sèche, musique
    this.ui = c.createGain();
    this.ui.connect(this.master);
    this.bedWet = c.createGain();
    this.bedWet.connect(this.out);
    this.bedDry = c.createGain();
    this.bedDry.connect(this.master);
    this.music = c.createGain();
    this.music.connect(this.master);

    // 1. Initialiser le bourdonnement strident et glitché de l'entité
    this.initMonsterAudio();

    // 2. Initialiser l'ambiance des néons fluorescents
    this.initAmbientAudio();

    this.setRoom(0);
    // l'oreille : HRTF (on entend devant, derrière, à gauche, à droite)
    this.setListener(0, 0, 0);

    this.unlocked = true;
  }

  // --- Mixage ---

  // recalcule le volume des bus d'ambiance et de musique à partir des baisses en cours ; les fins de baisse sont
  // programmées d'avance (le son remonte tout seul)
  remix(tc = 0.08) {
    const c = this.ctx;
    if (!c || !this.bedDry) return;
    const t = c.currentTime;
    const state = (at) => {
      const ducked = at < this.duckUntil ? this.duckAmt : 1;
      const hushed = at < this.silenceUntil ? 0 : 1;
      const chase = this.chaseAuto || this.chaseManual ? 0.316 : 1; // -10 dB pendant une poursuite
      return [ducked * chase * hushed, ducked * hushed, hushed];
    };
    const nodes = [[this.bedDry, 0], [this.bedWet, 0], [this.music, 1], [this.monsterHush, 2]].filter(([n]) => n);
    for (const [n] of nodes) n.gain.cancelScheduledValues(t);
    const apply = (at, s, k) => nodes.forEach(([n, i]) => n.gain.setTargetAtTime(s[i], at, k));
    apply(t, state(t), tc);
    for (const at of [this.duckUntil, this.silenceUntil].filter((x) => x > t).sort((a, b) => a - b)) apply(at, state(at + 1e-4), 0.6);
  }

  // baisse temporaire de l'ambiance (néons, gouttes, ambiances, drones) : poursuite qui démarre, jumpscare…
  // amount : le volume gardé (0.3 = -10 dB), sec : la durée avant qu'elle remonte (en 2 s environ)
  duck(amount = 0.3, sec = 1.5) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const a = clamp01(amount);
    this.duckAmt = t < this.duckUntil ? Math.min(this.duckAmt, a) : a;
    this.duckUntil = Math.max(this.duckUntil, t + Math.max(0.05, sec));
    this.remix(0.05);
  }

  // pendant une poursuite (ou une charge du troupeau), l'ambiance reste ~10 dB plus bas ; updateChase le fait aussi
  // tout seul pour l'entité, les deux s'additionnent
  setChase(on) {
    if (this.chaseManual === !!on) return;
    this.chaseManual = !!on;
    this.remix(on ? 0.25 : 1.2);
  }

  // une fenêtre de silence avant un événement : plus de néons, d'ambiance, de drones, de bourdonnement pendant sec
  silence(sec = 2) {
    if (!this.ctx) return;
    this.silenceUntil = Math.max(this.silenceUntil, this.ctx.currentTime + Math.max(0.05, sec));
    this.remix(0.12);
  }

  // 200 ms de silence total (tout le master), puis tout revient d'un coup ; rend l'instant où le son revient
  scareCut(sec = 0.2) {
    if (!this.unlocked || !this.ctx) return 0;
    const g = this.cut.gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.008);
    g.setValueAtTime(0, t + sec);
    g.linearRampToValueAtTime(1, t + sec + 0.004);
    return t + sec;
  }

  // --- Sous-titres ---

  // un sous-titre (en anglais, entre crochets) ; pos : d'où vient le son (la direction est calculée depuis l'oreille).
  // Le même texte au plus toutes les 2 s.
  caption(text, pos = null) {
    if (!this.onCaption || !text) return;
    const now = Date.now();
    this.capT = this.capT || new Map();
    if (now - (this.capT.get(text) || -1e9) < 2000) return;
    this.capT.set(text, now);
    try {
      this.onCaption(text, this.dirOf(pos));
    } catch (e) {
      /* l'affichage ne doit jamais casser le son */
    }
  }

  // la direction d'un point vu depuis l'oreille : 'ahead', 'behind', 'left', 'right' (null : sur soi ou inconnu)
  dirOf(pos) {
    const e = this.ear;
    if (!pos || typeof pos !== 'object' || !e) return null;
    const dx = pos.x - e.x;
    const dz = pos.z - e.z;
    if (!(Math.hypot(dx, dz) > 1.5)) return null;
    const a = Math.atan2(dx * Math.cos(e.yaw) - dz * Math.sin(e.yaw), -dx * Math.sin(e.yaw) - dz * Math.cos(e.yaw));
    const deg = (Math.abs(a) * 180) / Math.PI;
    if (deg < 45) return 'ahead';
    if (deg > 135) return 'behind';
    return a > 0 ? 'right' : 'left';
  }

  // L'écho des couloirs : une réponse impulsionnelle calculée (premières réflexions sur les murs proches, puis une
  // longue queue qui s'éteint). Level 0 : moquette et faux plafond, un écho moyen ; Level 1 : béton, il traîne ;
  // Tuyauteries : une galerie carrelée sous des tuyaux, qui sonne comme une cloche.
  setRoom(level = 0) {
    if (!this.ctx || this.roomLevel === level) return;
    this.roomLevel = level;
    const c = this.ctx;
    const pipes = level === PIPES_LEVEL;
    // Poolrooms : salle carrelée immense et vide, une queue de 4,5 s et des échos plus francs
    const len = level === 2 ? 4.5 : pipes ? 3.5 : level === 1 ? 3.4 : 2.3;
    const n = Math.floor(c.sampleRate * len);
    const ir = c.createBuffer(2, n, c.sampleRate);
    const sr = c.sampleRate;
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      const pre = Math.floor(sr * 0.018);
      const curve = level === 2 ? 2.2 : pipes ? 2.4 : level === 1 ? 2.6 : 3.4;
      for (let i = pre; i < n; i++) {
        const k = (i - pre) / (n - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, curve) * (pipes ? 0.5 : 0.6);
      }
      // quelques échos francs sur les murs (décalés à gauche et à droite) ; la galerie renvoie aussi les plus lointains
      const echoes = pipes
        ? [[19, 0.8], [31, 0.75], [58, 0.6], [89, 0.5], [143, 0.42], [211, 0.33], [307, 0.26], [420, 0.18], [560, 0.12]]
        : [[23, 0.9], [41, 0.6], [67, 0.45], [97, 0.35], [131, 0.25], [173, 0.18]];
      for (const [ms, a] of echoes) {
        const i = Math.floor((sr * (ms + (ch ? 7 : 0))) / 1000);
        if (i < n) d[i] += (Math.random() < 0.5 ? -1 : 1) * a;
      }
      if (pipes) {
        // les tuyaux qui résonnent : des modes métalliques qui sonnent longtemps (fréquence, amplitude, durée)
        for (const [f, a, dec] of [[183, 0.05, 2.6], [266, 0.04, 2.2], [412, 0.035, 1.8], [589, 0.03, 1.4], [913, 0.02, 1.0], [1342, 0.014, 0.7], [2210, 0.008, 0.45]]) {
          const w = (2 * Math.PI * f * (1 + (ch ? 0.004 : 0))) / sr;
          const ph = Math.random() * 6.28;
          const m = Math.min(n, Math.floor(sr * dec * 2.2));
          for (let i = pre; i < m; i++) d[i] += Math.sin(w * i + ph) * a * Math.exp(-(i - pre) / (sr * dec * 0.45));
        }
      }
    }
    this.verb.buffer = ir;
    this.wet.gain.setTargetAtTime(level === 2 ? 0.62 : pipes ? 0.55 : level === 1 ? 0.5 : 0.38, c.currentTime, 0.2);
    this.verbLp.frequency.value = level === 2 ? 7000 : pipes ? 6000 : level === 1 ? 5200 : 3600;
    this.setPool(level === 2);
    this.levelBed(level);
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

  // une source placée dans l'espace (HRTF) ; rolloff 0 : seule la direction compte ; dest : le bus (this.out par défaut)
  panner(rolloff = 1, ref = 2.5, dest = this.out) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = ref;
    p.rolloffFactor = rolloff;
    p.maxDistance = 120;
    p.connect(dest);
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

  // déplacer une source à un instant précis (des pas qui avancent, quelque chose qu'on traîne)
  moveAt(p, x, z, at, glide = 0) {
    if (!p.positionX) return p.setPosition(x, 1.2, z);
    if (glide) {
      p.positionX.linearRampToValueAtTime(x, at);
      p.positionZ.linearRampToValueAtTime(z, at);
    } else {
      p.positionX.setValueAtTime(x, at);
      p.positionZ.setValueAtTime(z, at);
    }
  }

  // un point au hasard autour de l'oreille, entre rMin et rMax mètres
  around(rMin, rMax) {
    const e = this.ear || { x: 0, z: 0 };
    const a = Math.random() * Math.PI * 2;
    const r = rnd(rMin, rMax);
    return { x: e.x + Math.cos(a) * r, z: e.z + Math.sin(a) * r };
  }

  // une source ponctuelle placée en { x, z } : rend son entrée (input) et son panoramique (panner).
  // muffled : de l'autre étage, étouffé à travers le plancher ; occluded : derrière un mur (true ou 0 à 1)
  place(pos, vol = 1, occluded = 0, dest = this.out) {
    const c = this.ctx;
    const p = this.panner(pos.rolloff ?? 1, pos.ref ?? 2.5, dest);
    this.moveTo(p, pos.x, pos.z);
    let head = p;
    const occ = occOf(occluded || pos.occluded);
    if (pos.muffled || occ > 0) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = Math.min(pos.muffled ? 420 : 20000, occ > 0 ? occFreq(occ) : 20000);
      lp.connect(head);
      head = lp;
    }
    const g = c.createGain();
    g.gain.value = vol * (pos.muffled ? 0.5 : 1) * occGain(occ);
    g.connect(head);
    return { input: g, panner: p };
  }

  // entrée d'un son ponctuel placé en { x, z } ; muffled : de l'autre étage, étouffé à travers le plancher ;
  // occluded : un mur entre la source et toi (true ou de 0 à 1 : passe-bas ~700 Hz et -4 dB)
  at(pos, vol = 1, occluded = 0, dest = this.out) {
    return this.place(pos, vol, occluded, dest).input;
  }

  // --- Petits outils de synthèse ---

  // une note qui glisse de f0 à f1 et s'éteint (attaque att, durée dur)
  tone(out, t, type, f0, f1, dur, vol, att = 0.004) {
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + att);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.03);
    return o;
  }

  // du métal frappé : des partiels [multiple, volume, durée] autour de f
  ring(out, t, f, partials, vol) {
    for (const [m, g, d] of partials) this.tone(out, t, 'sine', f * m, 0, d, vol * g, 0.002);
  }

  // une courbe de saturation (tanh), gardée par intensité
  curve(drive) {
    this.curves = this.curves || new Map();
    if (!this.curves.has(drive)) {
      const k = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) k[i] = Math.tanh(((i / 1023) * 2 - 1) * drive) / Math.tanh(drive);
      this.curves.set(drive, k);
    }
    return this.curves.get(drive);
  }

  shaper(drive) {
    const w = this.ctx.createWaveShaper();
    w.curve = this.curve(drive);
    return w;
  }

  filt(type, f, q = 1) {
    const b = this.ctx.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  gainNode(v = 0) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  osc(type, f) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    return o;
  }

  // un souffle (inspiration, expiration) : du bruit dans un formant qui glisse de f0 à f1
  breathNoise(out, t, dur, f0, f1, vol) {
    const c = this.ctx;
    const n = this.noise();
    const bp = this.filt('bandpass', f0, 1.3);
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.02);
  }

  // --- L'entité ---

  // Le bourdonnement de l'entité : la chaîne reste en place, les oscillateurs ne tournent que quand elle est proche
  // (startBuzz / stopBuzz). Elle passe par la fenêtre de silence (monsterHush) et par l'occlusion (monsterOcc).
  initMonsterAudio() {
    const c = this.ctx;

    // Gain principal du monstre (contrôlé en continu par la distance)
    this.monsterGain = c.createGain();
    this.monsterGain.gain.setValueAtTime(0.0001, c.currentTime);
    this.monsterHush = c.createGain();
    this.monsterOcc = this.filt('lowpass', 20000, 0.5);
    this.monsterOccG = c.createGain();

    // placé en 3D là où se trouve l'entité (son volume, lui, suit le danger : pas d'atténuation en plus)
    this.monsterPanner = this.panner(0);
    this.monsterGain.connect(this.monsterHush).connect(this.monsterOcc);
    this.monsterOcc.connect(this.monsterOccG).connect(this.monsterPanner);

    // Filtre passe-bande résonant pour le strident perçant, puis le bégaiement électrique (stutter)
    this.monsterFilter = this.filt('bandpass', 900, 4);
    this.monsterStutter = this.gainNode(0.75);
    this.monsterFilter.connect(this.monsterStutter).connect(this.monsterGain);
  }

  // les oscillateurs du bourdonnement : une dent de scie et un carré désaccordés qui battent, un tremblement de
  // fréquence et un bégaiement de volume qui s'accélèrent avec le danger
  startBuzz() {
    const c = this.ctx;
    const t = c.currentTime;
    this.monsterOsc1 = this.osc('sawtooth', 140);
    this.monsterOsc2 = this.osc('square', 147);
    const sq = this.gainNode(0.35);
    this.monsterMod = this.osc('sawtooth', 12);
    const modGain = this.gainNode(7);
    this.monsterMod.connect(modGain);
    modGain.connect(this.monsterOsc1.frequency);
    modGain.connect(this.monsterOsc2.frequency);
    this.monsterStut = this.osc('square', 7);
    const stDepth = this.gainNode(0.25);
    this.monsterStut.connect(stDepth).connect(this.monsterStutter.gain);
    this.monsterOsc1.connect(this.monsterFilter);
    this.monsterOsc2.connect(sq).connect(this.monsterFilter);
    for (const o of [this.monsterOsc1, this.monsterOsc2, this.monsterMod, this.monsterStut]) o.start(t);
  }

  stopBuzz() {
    const t = this.ctx.currentTime;
    for (const o of [this.monsterOsc1, this.monsterOsc2, this.monsterMod, this.monsterStut]) {
      try {
        o && o.stop(t + 0.05);
      } catch (e) {
        /* déjà arrêté */
      }
    }
    this.monsterOsc1 = this.monsterOsc2 = this.monsterMod = this.monsterStut = null;
    this.buzzOffAt = 0;
  }

  initAmbientAudio() {
    const c = this.ctx;
    this.ambientGain = c.createGain();
    this.ambientGain.gain.setValueAtTime(0.045, c.currentTime); // son d'ambiance discret
    // les tubes qui papillotent (setHum, power) : un gain en série, à 1 le reste du temps
    this.humFlutter = c.createGain();
    this.ambientGain.connect(this.humFlutter).connect(this.bedDry);

    // Le grésillement des ballasts : un 120 Hz riche en harmoniques, adouci, avec une pointe de sifflement aigu.
    // Rien n'est tout à fait fixe : le ballast dérive un peu, le filtre respire, l'harmonique du starter va et vient.
    const buzz = this.osc('sawtooth', 120);
    const drift = this.osc('sine', 0.11);
    const driftG = this.gainNode(0.35);
    drift.connect(driftG).connect(buzz.frequency);
    const buzzLp = this.filt('lowpass', 700, 0.7);
    const breathe = this.osc('sine', 0.07);
    const breatheG = this.gainNode(150);
    breathe.connect(breatheG).connect(buzzLp.frequency);
    const buzzGain = this.gainNode(0.32);
    buzz.connect(buzzLp).connect(buzzGain).connect(this.ambientGain);
    // le 240 Hz qui grince par moments
    const harm = this.osc('square', 240);
    const harmBp = this.filt('bandpass', 1500, 2.5);
    const harmG = this.gainNode(0.04);
    const harmLfo = this.osc('sine', 0.19);
    const harmLfoG = this.gainNode(0.035);
    harmLfo.connect(harmLfoG).connect(harmG.gain);
    harm.connect(harmBp).connect(harmG).connect(this.ambientGain);
    // le 60 Hz du secteur, en fond
    const hum = this.osc('sine', 60);
    hum.connect(this.ambientGain);
    // sifflement aigu, qui flotte un peu
    const whine = this.osc('sine', 7400);
    const wob = this.osc('sine', 0.3);
    const wobGain = this.gainNode(40);
    wob.connect(wobGain).connect(whine.frequency);
    const whineGain = this.gainNode(0.025);
    whine.connect(whineGain).connect(this.ambientGain);

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
    const roomLp = this.filt('lowpass', 380);
    this.roomGain = this.gainNode(0.05);
    room.connect(roomLp).connect(this.roomGain).connect(this.master);

    for (const o of [buzz, drift, breathe, harm, harmLfo, hum, whine, wob, room]) o.start();
  }

  // Ton souffle : il s'emballe quand tu sprintes, reste haletant tant que tu n'as pas récupéré, et la peur
  // l'accélère quand l'entité approche (level de 0 à 1). Souffle retenu (holdBreath) : rien.
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
    if (this.breathHeld) level = 0;
    const t = c.currentTime;
    this.breathGain.gain.setTargetAtTime(Math.max(0, Math.min(1, level)) * 0.55, t, level > 0.05 ? 0.35 : this.breathHeld ? 0.06 : 0.8);
    // plus essoufflé, plus rapide
    if (this.breathSrc) this.breathSrc.playbackRate.setTargetAtTime(0.9 + Math.min(1, level) * 0.25, t, 0.5);
  }

  // Le grésillement suit les néons autour de toi (light : la lumière reçue là où tu es, 0 dans le noir) ; sous une
  // bonne lumière, de temps en temps, un tube papillote
  setHum(light) {
    if (!this.unlocked || !this.ambientGain || this.dark) return;
    const t = this.ctx.currentTime;
    this.ambientGain.gain.setTargetAtTime(0.012 + Math.min(1, light) * 0.07, t, 0.3);
    if (this.humFlutterT === undefined) this.humFlutterT = t + rnd(8, 20);
    if (light > 0.35 && t > this.humFlutterT) {
      this.humFlutterT = t + rnd(7, 25);
      const g = this.humFlutter.gain;
      let k = t + 0.02;
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) {
        g.setTargetAtTime(rnd(0.25, 0.55), k, 0.006);
        k += rnd(0.03, 0.12);
        g.setTargetAtTime(1, k, 0.015);
        k += rnd(0.04, 0.15);
      }
    }
  }

  // Un tube qui s'amorce ou claque : le tic du starter, le verre qui tinte, puis deux ou trois bégaiements du ballast
  // avant que le tube ne tienne. pos : { x, z } (null : au-dessus de toi) ; delay : en secondes
  neonClick(pos = null, vol = 1, delay = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01 + delay;
    const out = pos ? this.at({ ...pos, rolloff: 0.8, ref: 3 }, vol) : this.gainNode(vol * 0.6);
    if (!pos) out.connect(this.out);
    this.burst(out, t, 0.012, 'bandpass', 4200, 2, 0.22);
    this.tone(out, t + 0.002, 'sine', 2600 + Math.random() * 500, 0, 0.05, 0.02, 0.001);
    let k = t + rnd(0.05, 0.12);
    const n = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const last = i === n - 1;
      const len = last ? 0.3 : rnd(0.03, 0.09);
      const o = this.osc('sawtooth', 120);
      const bp = this.filt('bandpass', 900, 1.2);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, k);
      g.gain.exponentialRampToValueAtTime(0.05, k + 0.006);
      g.gain.setValueAtTime(0.05, k + len * 0.6);
      g.gain.exponentialRampToValueAtTime(0.0001, k + len);
      o.connect(bp).connect(g).connect(out);
      o.start(k);
      o.stop(k + len + 0.02);
      this.burst(out, k, 0.008, 'highpass', 3000, 0.7, 0.08);
      k += len + rnd(0.04, 0.12);
    }
    if (pos) this.caption('[lights flicker]', pos);
  }

  // La voix de l'entité du Level 1 : la bande-son de sa vidéo, jouée en boucle sans fin. Chargée une seule fois,
  // au premier besoin ; elle passe par le même panoramique (et la même occlusion) que le bourdonnement.
  initVoice() {
    const c = this.ctx;
    this.voiceGain = c.createGain();
    this.voiceGain.gain.setValueAtTime(0.0001, c.currentTime);
    this.voiceGain.connect(this.monsterOcc || this.monsterPanner || this.out);
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
  // pos : { x, z } de l'entité (null : on ne bouge pas la source) ; occluded : un mur entre elle et toi (true, 0 à 1)
  updateMonsterSound(danger, pos, voice = false, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const ent = hasEntity(this.roomLevel);
    const d = ent ? clamp01(danger) : 0;
    if (!ent) voice = false;
    if (voice && !this.voiceGain) this.initVoice();
    // toujours un murmure au loin, de plus en plus fort à mesure qu'elle approche
    if (this.voiceGain && !(t < this.scareUntil)) this.voiceGain.gain.setTargetAtTime(voice ? 0.04 + Math.pow(d, 0.8) * 1.3 : 0.0001, t, 0.1);
    if (voice && d > 0.25) this.caption('[garbled voice]', pos);

    if (pos && typeof pos === 'object') this.moveTo(this.monsterPanner, pos.x, pos.z, 0.05);
    // derrière un mur : étouffée
    const occ = occOf(occluded);
    this.monsterOcc.frequency.setTargetAtTime(occFreq(occ), t, 0.12);
    this.monsterOccG.gain.setTargetAtTime(occGain(occ), t, 0.12);

    // le grésillement électrique : un fond à peine audible au loin, qui devient strident tout près ; hors danger
    // (ou quand c'est la voix qu'on entend) les oscillateurs s'arrêtent
    const want = !voice && d > 0.03 && !(t < this.scareUntil) ? 0.015 + Math.pow(d, 1.4) * 0.3 : 0;
    if (want > 0 && !this.monsterOsc1) this.startBuzz();
    this.monsterGain.gain.setTargetAtTime(want || 0.0001, t, want ? 0.15 : 0.25);
    if (want) this.buzzOffAt = 0;
    else if (this.monsterOsc1) {
      if (!this.buzzOffAt) this.buzzOffAt = t + 1.5;
      else if (t > this.buzzOffAt) this.stopBuzz();
    }
    if (want && d > 0.15 && !this.buzzHeard) {
      this.buzzHeard = true;
      this.caption('[buzzing]', pos);
    } else if (d < 0.05) this.buzzHeard = false;
    if (!this.monsterOsc1) return;

    // Plus l'entité est proche, plus la fréquence monte dans les aigus stridents et le glitch accélère
    const baseFreq = 110 + d * 260; // 110Hz -> 370Hz
    const filterFreq = 700 + d * 1500; // 700Hz -> 2200Hz
    this.monsterOsc1.frequency.setTargetAtTime(baseFreq, t, 0.08);
    this.monsterOsc2.frequency.setTargetAtTime(baseFreq * 1.05, t, 0.08);
    this.monsterFilter.frequency.setTargetAtTime(filterFreq, t, 0.08);
    this.monsterMod.frequency.setTargetAtTime(9 + d * 30, t, 0.08);
    this.monsterStut.frequency.setTargetAtTime(6 + d * 22 + Math.random() * 3, t, 0.1);
    // tout près, des étincelles qui crépitent
    if (d > 0.45 && Math.random() < d * 0.05) this.burst(this.monsterGain, t + 0.01, rnd(0.015, 0.05), 'highpass', 3000, 0.7, 0.6);
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
      lp.connect(g).connect(this.bedWet || this.out);
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
    this.plop(this.ctx.currentTime, 0.05 + Math.random() * 0.05, this.at(this.around(6, 24), 1, 0, this.bedWet));
  }

  // Une cassette VHS (kind 'tape') : le boîtier qui claque, la cassette qu'on enfonce, le caméscope qui l'avale
  // (moteur, chargement de la bande) et le tambour des têtes qui s'enclenche.
  // kind 'fuse' : un fusible céramique qu'on enfonce ; 'valve' : une vanne qui se ferme d'un coup sec
  cassette(kind = 'tape') {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.gainNode(0.9);
    out.connect(this.out);
    if (kind === 'fuse') {
      this.burst(out, t, 0.07, 'bandpass', 3000, 1, 0.1);
      this.burst(out, t + 0.08, 0.015, 'bandpass', 2000, 4, 0.35);
      this.burst(out, t + 0.08, 0.04, 'lowpass', 600, 0.8, 0.2);
      this.tone(out, t + 0.08, 'sine', 1800, 0, 0.04, 0.02, 0.001);
      return;
    }
    if (kind === 'valve') {
      this.tone(out, t, 'sine', 110, 55, 0.35, 0.45, 0.003);
      this.ring(out, t, 223, [[1, 1, 0.9], [2.31, 0.6, 0.6], [4.13, 0.3, 0.35], [6.7, 0.12, 0.2]], 0.1);
      this.burst(out, t, 0.12, 'lowpass', 800, 0.8, 0.45);
      return;
    }
    // le boîtier : deux clacs de plastique creux
    for (const [k, v] of [[0, 1], [0.16, 0.6]]) {
      this.burst(out, t + k, 0.02, 'bandpass', 1800, 2, 0.3 * v);
      this.burst(out, t + k, 0.05, 'lowpass', 420, 0.8, 0.25 * v);
      this.tone(out, t + k, 'triangle', 210, 140, 0.05, 0.08 * v, 0.002);
    }
    // la cassette glisse dans la trappe et s'enclenche
    this.burst(out, t + 0.36, 0.12, 'bandpass', 1200, 1, 0.08);
    this.burst(out, t + 0.48, 0.015, 'bandpass', 2600, 4, 0.22);
    // le moteur qui l'avale : un ronron qui monte, avec le frottement de la bande
    const m0 = t + 0.5;
    const mo = this.osc('sawtooth', 95);
    mo.frequency.setValueAtTime(95, m0);
    mo.frequency.exponentialRampToValueAtTime(140, m0 + 0.25);
    const fl = this.osc('sine', 31);
    const flG = this.gainNode(6);
    fl.connect(flG).connect(mo.frequency);
    const mbp = this.filt('bandpass', 700, 1.5);
    const mg = c.createGain();
    mg.gain.setValueAtTime(0.0001, m0);
    mg.gain.exponentialRampToValueAtTime(0.045, m0 + 0.05);
    mg.gain.setValueAtTime(0.045, m0 + 0.55);
    mg.gain.exponentialRampToValueAtTime(0.0001, m0 + 0.75);
    mo.connect(mbp).connect(mg).connect(out);
    for (const o of [mo, fl]) {
      o.start(m0);
      o.stop(m0 + 0.8);
    }
    this.burst(out, m0, 0.7, 'bandpass', 1600, 2, 0.025);
    // le tambour des têtes s'enclenche
    this.burst(out, t + 1.18, 0.06, 'lowpass', 500, 0.8, 0.22);
    this.burst(out, t + 1.18, 0.01, 'bandpass', 3000, 3, 0.1);
  }

  // Déverrouillage de la sortie : un relais qui claque, puis au loin le moteur d'un ascenseur (ou d'un monte-charge)
  // qui démarre et tourne quelques secondes ; pos : { x, z } de l'ascenseur (null : non placé)
  exitUnlocked(pos = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = pos ? this.at({ ...pos, rolloff: 0.4, ref: 6 }, 1.2) : this.gainNode(0.7);
    if (!pos) out.connect(this.out);
    // les relais : un claquement sec, un second plus léger
    this.burst(out, t, 0.02, 'bandpass', 2400, 3, 0.4);
    this.burst(out, t, 0.08, 'lowpass', 500, 0.8, 0.45);
    this.burst(out, t + 0.12, 0.015, 'bandpass', 2900, 3, 0.2);
    // le moteur, étouffé par les murs et la cage
    const m0 = t + 0.35;
    const M = 4.2;
    const lp = this.filt('lowpass', 900, 0.7);
    const mg = c.createGain();
    mg.gain.setValueAtTime(0.0001, m0);
    mg.gain.exponentialRampToValueAtTime(0.16, m0 + 1);
    mg.gain.setValueAtTime(0.16, m0 + M - 1);
    mg.gain.exponentialRampToValueAtTime(0.0001, m0 + M);
    lp.connect(mg).connect(out);
    const m1 = this.osc('sawtooth', 40);
    m1.frequency.setValueAtTime(40, m0);
    m1.frequency.exponentialRampToValueAtTime(50, m0 + 1.2);
    const m2 = this.osc('sawtooth', 100.6);
    m2.frequency.setValueAtTime(80, m0);
    m2.frequency.exponentialRampToValueAtTime(100.6, m0 + 1.2);
    const mlp = this.filt('lowpass', 260, 1.2);
    const m2g = this.gainNode(0.4);
    m1.connect(mlp);
    m2.connect(m2g).connect(mlp);
    mlp.connect(lp);
    // l'engrenage qui gémit
    const gear = this.osc('sine', 640);
    gear.frequency.setValueAtTime(520, m0);
    gear.frequency.exponentialRampToValueAtTime(720, m0 + 1.4);
    const gg = this.gainNode(0.03);
    gear.connect(gg).connect(lp);
    // les câbles qui vibrent
    const cab = this.noise();
    const cbp = this.filt('bandpass', 900, 1);
    const cam = this.gainNode(0.12);
    const lfo = this.osc('sine', 13);
    const lfoG = this.gainNode(0.1);
    lfo.connect(lfoG).connect(cam.gain);
    cab.connect(cbp).connect(cam).connect(lp);
    for (const o of [m1, m2, gear, cab, lfo]) {
      o.start(m0);
      o.stop(m0 + M + 0.1);
    }
    this.caption('[machinery starts]', pos);
  }

  // Jumpscare / cri violent lors de la capture : 200 ms de silence total, puis le coup (un impact grave, un cri
  // formanté et saturé) et la bande qui se froisse. L'ambiance est baissée pendant quelques secondes.
  jumpscare(level = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const t0 = this.scareCut(0.2);
    this.duck(0.12, 4);

    // Coupe le son de traque continu
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, t);
    this.scareUntil = t0 + 1.6;

    // Level 1 : sa voix à plein volume, collée à l'oreille, puis le silence
    if (level === 1 && this.voiceGain) {
      // juste devant toi
      if (this.monsterPanner && this.ear) this.moveTo(this.monsterPanner, this.ear.x - Math.sin(this.ear.yaw) * 0.6, this.ear.z - Math.cos(this.ear.yaw) * 0.6);
      this.monsterOcc.frequency.setValueAtTime(20000, t);
      this.monsterOccG.gain.setValueAtTime(1, t);
      this.voiceGain.gain.cancelScheduledValues(t);
      this.voiceGain.gain.setValueAtTime(0.0001, t);
      this.voiceGain.gain.setValueAtTime(2.2, t0);
      this.voiceGain.gain.setTargetAtTime(0.0001, t0 + 1.2, 0.15);
      this.scareHit(t0, 0.6);
      this.tapeCrumple(t0 + 1.3);
      return;
    }

    // Level 5 : un hurlement humain déchiré (deux voix désaccordées qui montent puis s'effondrent), un coup sourd
    if (level === 4) { // HOTEL_LEVEL
      if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, t);
      const shaper = c.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        const x = (i / 1023) * 2 - 1;
        curve[i] = Math.tanh(x * 6);
      }
      shaper.curve = curve;
      const out = c.createGain();
      out.gain.setValueAtTime(0.0001, t);
      out.gain.exponentialRampToValueAtTime(0.55, t + 0.03);
      out.gain.setValueAtTime(0.55, t + 0.9);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
      shaper.connect(out).connect(this.master || this.out);
      for (const [f0, det] of [[420, 0], [445, 12], [210, -7]]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.detune.value = det;
        o.frequency.setValueAtTime(f0 * 0.7, t);
        o.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + 0.25);
        o.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 1.4);
        // la voix tremble
        const lfo = c.createOscillator();
        lfo.frequency.value = 9 + Math.random() * 5;
        const lg = c.createGain();
        lg.gain.value = f0 * 0.08;
        lfo.connect(lg).connect(o.frequency);
        const g = c.createGain();
        g.gain.value = 0.3;
        o.connect(g).connect(shaper);
        o.start(t);
        lfo.start(t);
        o.stop(t + 1.5);
        lfo.stop(t + 1.5);
      }
      const thud = c.createOscillator();
      const tg = c.createGain();
      thud.frequency.setValueAtTime(90, t);
      thud.frequency.exponentialRampToValueAtTime(35, t + 0.4);
      tg.gain.setValueAtTime(0.9, t);
      tg.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      thud.connect(tg).connect(this.master || this.out);
      thud.start(t);
      thud.stop(t + 0.55);
      return;
    }
    if (this.voiceGain) this.voiceGain.gain.setValueAtTime(0.0001, t);
    this.scareHit(t0, 1);
    this.scareScream(t0, 1);
    this.tapeCrumple(t0 + 1.05);
  }

  // le coup : un impact très grave, un choc sourd et un craquement, saturés ; un peu d'écho
  scareHit(t, k = 1) {
    const sat = this.shaper(2.5);
    const g = this.gainNode(0.6 * k);
    sat.connect(g).connect(this.master);
    const wet = this.gainNode(0.25);
    g.connect(wet).connect(this.out);
    this.tone(sat, t, 'sine', 70, 28, 0.55, 0.9, 0.003);
    this.burst(sat, t, 0.35, 'lowpass', 400, 0.7, 0.8);
    this.burst(sat, t, 0.06, 'bandpass', 2200, 1, 0.6);
  }

  // le cri : une voix (dent de scie et souffle) qui tremble, passe d'un « aa » à un « ii », très saturée
  scareScream(t, k = 1) {
    const c = this.ctx;
    const D = 1.05;
    const vo = this.osc('sawtooth', 520);
    vo.frequency.setValueAtTime(480, t);
    vo.frequency.linearRampToValueAtTime(660, t + 0.15);
    vo.frequency.exponentialRampToValueAtTime(300, t + D);
    const sub = this.osc('sawtooth', 260);
    sub.frequency.setValueAtTime(240, t);
    sub.frequency.linearRampToValueAtTime(330, t + 0.15);
    sub.frequency.exponentialRampToValueAtTime(150, t + D);
    // le tremblement : deux vibratos qui ne s'accordent pas
    const j1 = this.osc('sine', 23);
    const j2 = this.osc('sine', 37);
    const jg = this.gainNode(30);
    j1.connect(jg);
    j2.connect(jg);
    jg.connect(vo.frequency);
    const subG = this.gainNode(0.5);
    const breath = this.noise();
    const brG = this.gainNode(0.35);
    const mix = this.gainNode(1);
    for (const [fa, fb, q, g] of [[900, 600, 6, 1], [1300, 2100, 8, 0.7], [2800, 3100, 10, 0.4]]) {
      const bp = this.filt('bandpass', fa, q);
      bp.frequency.setValueAtTime(fa, t);
      bp.frequency.linearRampToValueAtTime(fb, t + D * 0.7);
      const bg = this.gainNode(g * 3);
      vo.connect(bp);
      sub.connect(subG).connect(bp);
      breath.connect(brG).connect(bp);
      bp.connect(bg).connect(mix);
    }
    const hp = this.filt('highpass', 140, 0.7);
    const sat = this.shaper(6);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.32 * k, t + 0.012);
    env.gain.setValueAtTime(0.32 * k, t + D * 0.5);
    env.gain.exponentialRampToValueAtTime(0.0001, t + D);
    mix.connect(hp).connect(sat).connect(env).connect(this.master);
    const wet = this.gainNode(0.3);
    env.connect(wet).connect(this.out);
    for (const o of [vo, sub, j1, j2, breath]) {
      o.start(t);
      o.stop(t + D + 0.05);
    }
  }

  // la bande qui se froisse dans le caméscope : une pluie de petits craquements aigus qui s'espace
  tapeCrumple(t, dur = 0.7) {
    let k = t;
    while (k < t + dur) {
      const f = rnd(2500, 7000);
      this.burst(this.ui, k, rnd(0.004, 0.015), 'bandpass', f, 2, rnd(0.04, 0.12) * (1 - (k - t) / dur));
      k += rnd(0.006, 0.03) * (1 + ((k - t) / dur) * 3);
    }
    this.tone(this.ui, t, 'sine', 90, 40, 0.25, 0.08, 0.01);
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

  // un bruit plus long (5 s) pour les fonds continus : on n'entend pas la boucle
  longNoise() {
    if (!this.longBuf) {
      const c = this.ctx;
      this.longBuf = c.createBuffer(1, c.sampleRate * 5, c.sampleRate);
      const d = this.longBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const n = this.ctx.createBufferSource();
    n.buffer = this.longBuf;
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
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.02);
  }

  // Bêlement : une voix nasale (dents de scie passées par les formants d'un « è ») qui chevrote, un peu rauque.
  // kind : 'bleat' (au loin), 'spot' (elle t'a vu : plus fort, qui monte), 'flee' (cri aigu), 'hurt' (sonnée),
  // 'scream' (collée à toi) ; occluded : derrière un mur (true ou 0 à 1)
  goatBleat(pos, kind = 'bleat', occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    // bellow : le bouc alpha, grave et long, qui porte dans toutes les galeries
    const dur = kind === 'bellow' ? 1.7 : kind === 'flee' ? 0.5 : kind === 'spot' ? 1.15 : kind === 'scream' ? 1.0 : kind === 'hurt' ? 0.45 : 0.75 + Math.random() * 0.45;
    const f0 = (kind === 'bellow' ? 118 : kind === 'flee' ? 560 : kind === 'scream' ? 430 : kind === 'spot' ? 290 : kind === 'hurt' ? 360 : 250) * (0.88 + Math.random() * 0.24);
    const vol = { bleat: 0.6, spot: 1.0, flee: 0.8, hurt: 0.7, scream: 2.0, bellow: 2.6 }[kind] ?? 0.6;
    if (kind === 'bellow') pos = { ...pos, rolloff: 0.5, ref: 6 };
    const out = this.at(pos, vol, occluded);
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
    if (kind === 'bellow') this.caption('[billy goat bellows]', pos);
    else if (kind !== 'scream') this.caption('[goat bleating]', pos);
  }

  // Avant la charge : elle souffle par les naseaux et racle le sol du sabot
  goatSnort(pos, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.at(pos, 1, occluded);
    this.burst(out, t, 0.22, 'bandpass', 900, 1.2, 0.5);
    this.burst(out, t + 0.28, 0.18, 'bandpass', 1100, 1.2, 0.4);
    for (const k of [0.15, 0.4, 0.62]) this.burst(out, t + k, 0.09, 'highpass', 2600, 0.8, 0.35);
    this.caption('[snorting]', pos);
  }

  // un sabot sur le carrelage : un claquement sec et un coup sourd (vol 1 : la charge)
  goatHoof(pos, vol = 1, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    const out = this.at(pos, vol, occluded);
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
    if (vol >= 1) this.caption('[hooves charging]', pos);
  }

  // dans les gaines : des coups métalliques irréguliers et un raclement, étouffés par la tôle
  goatVent(pos, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime + 0.01;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.connect(this.at(pos, 0.8, occluded));
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
    this.caption('[something in the vents]', pos);
  }

  // la charge finit dans le mur : un choc sourd, puis elle bêle, sonnée
  goatCrash(pos, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.at(pos, 1.3, occluded);
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
    this.caption('[crash]', pos);
    setTimeout(() => this.goatBleat(pos, 'hurt', occluded), 350);
  }

  // la cloche du bouc : un bronze fêlé (partiels inharmoniques), qui s'entend de loin
  goatBell(pos, vol = 1, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    const out = this.at({ ...pos, rolloff: 0.55, ref: 5 }, 0.55 * vol, occluded);
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
    this.caption('[bell]', pos);
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
    this.caption('[lights blow out]', pos);
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
    this.caption('[breaker clunks]', pos);
  }

  // brûlé par un jet de vapeur : le sifflement qui gicle et le cri étouffé
  steamBurn(pos) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    const out = this.at(pos, 1);
    this.burst(out, t, 0.9, 'highpass', 2800, 0.7, 0.6);
    this.burst(out, t, 0.35, 'bandpass', 600, 1.5, 0.5);
    this.caption('[steam hiss]', pos);
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
    this.duck(0.1, CUT + 5);
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
    this.duck(0.2, 3);
    this.goatBleat(pos, 'scream');
    const t = this.ctx.currentTime + 0.01;
    this.burst(this.out, t, 0.45, 'lowpass', 900, 0.7, 1.2);
    this.burst(this.out, t, 0.3, 'highpass', 1500, 0.7, 0.5);
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, t);
  }

  // Gorgée d'eau d'amande : le bouchon qui craque, trois gorgées (la gorge qui avale), un soupir
  bottle() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.out;
    // le bouchon : de petits craquements de plastique
    for (let i = 0; i < 5; i++) this.burst(out, t + i * 0.03 + Math.random() * 0.02, 0.006, 'highpass', 3000, 0.8, 0.07);
    const t0 = t + 0.3;
    for (let i = 0; i < 3; i++) {
      const k = t0 + i * 0.34 + Math.random() * 0.04;
      // l'eau qui passe : un bruit dans un formant qui descend
      const n = this.noise();
      const bp = this.filt('bandpass', 900, 6);
      bp.frequency.setValueAtTime(900, k);
      bp.frequency.exponentialRampToValueAtTime(380, k + 0.12);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, k);
      g.gain.exponentialRampToValueAtTime(0.12, k + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, k + 0.14);
      n.connect(bp).connect(g).connect(out);
      n.start(k, Math.random() * 0.5);
      n.stop(k + 0.16);
      // la gorge
      this.tone(out, k + 0.02, 'sine', 150, 95, 0.09, 0.07, 0.008);
    }
    this.breathNoise(out, t0 + 1.1, 0.4, 900, 500, 0.04);
  }

  // L'entité vient de repérer le joueur : un coup très grave et deux cordes qui frottent à un demi-ton d'écart
  // (hors du monde : bus ui), assez bas
  spotted() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    this.duck(0.5, 1.5);
    this.tone(this.ui, t, 'sine', 48, 30, 1.2, 0.3, 0.01);
    const n = this.noise();
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.12);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    for (const f of [1480, 1568]) {
      const bp = this.filt('bandpass', f, 35);
      bp.frequency.setValueAtTime(f, t);
      bp.frequency.linearRampToValueAtTime(f * 1.015, t + 1.2);
      const bg = this.gainNode(3);
      n.connect(bp).connect(bg).connect(g);
    }
    g.connect(this.ui);
    n.start(t);
    n.stop(t + 1.45);
    // une corde grave, désaccordée
    const lp = this.filt('lowpass', 400, 0.7);
    const lg = c.createGain();
    lg.gain.setValueAtTime(0.0001, t);
    lg.gain.exponentialRampToValueAtTime(0.03, t + 0.08);
    lg.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
    lp.connect(lg).connect(this.ui);
    for (const f of [73.4, 77.8]) {
      const o = this.osc('sawtooth', f);
      o.connect(lp);
      o.start(t);
      o.stop(t + 1.65);
    }
  }

  // Les piles : la trappe qui se déclipse, les piles qui glissent, le ressort, la trappe qui reclaque.
  // empty : la lampe à plat, un clic mou et le filament qui grésille et meurt
  battery(empty = false) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.out;
    if (empty) {
      this.burst(out, t, 0.012, 'bandpass', 2200, 3, 0.2);
      const n = this.noise();
      const bp = this.filt('bandpass', 5000, 1);
      const g = c.createGain();
      g.gain.setValueAtTime(0.02, t + 0.02);
      for (let k = 0.05; k < 0.5; k += rnd(0.02, 0.06)) g.gain.setValueAtTime(Math.random() * 0.02 * (1 - k / 0.5), t + k);
      g.gain.setValueAtTime(0, t + 0.52);
      n.connect(bp).connect(g).connect(out);
      n.start(t);
      n.stop(t + 0.55);
      this.tone(out, t, 'sine', 3200, 1800, 0.3, 0.006, 0.01);
      return;
    }
    this.burst(out, t, 0.012, 'bandpass', 2800, 3, 0.25);
    this.burst(out, t + 0.08, 0.09, 'bandpass', 1400, 1.2, 0.1);
    // le ressort qui vibre
    this.tone(out, t + 0.2, 'sine', 2300, 1900, 0.18, 0.025, 0.002);
    this.tone(out, t + 0.2, 'sine', 3450, 3100, 0.12, 0.01, 0.002);
    this.burst(out, t + 0.24, 0.01, 'bandpass', 3200, 4, 0.3);
    this.burst(out, t + 0.24, 0.03, 'lowpass', 700, 0.8, 0.12);
  }

  // Pas lourds de l'entité, placés là où elle est, par-dessus ses cris : de plus en plus forts à mesure qu'elle approche
  // occluded : un mur entre elle et toi (true ou 0 à 1)
  monsterStep(danger, pos, occluded = 0) {
    if (!this.unlocked || !this.ctx || !hasEntity(this.roomLevel)) return;
    const c = this.ctx;
    const t = c.currentTime;
    const v = 0.35 + Math.min(1, danger) * 1.15;
    const dest = c.createGain();
    dest.gain.value = v;
    dest.connect(pos && typeof pos === 'object' ? this.at({ ...pos, rolloff: 0 }, 1, occluded) : this.out);
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
    this.caption('[heavy footsteps]', pos);
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
  // là où elle est ; ils montent avec le danger et s'éteignent en une seconde et demie quand elle lâche prise.
  // Pendant la poursuite l'ambiance est baissée de 10 dB. Rien là où l'entité ne vit pas (Tuyauteries).
  updateChase(on, danger, pos, occluded = 0) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    if (!hasEntity(this.roomLevel)) on = false;
    on = !!on;
    if (on !== this.chaseAuto) {
      this.chaseAuto = on;
      this.remix(on ? 0.25 : 1.2);
      if (on) this.caption('[shrieking]', pos);
    }
    if (!this.chaseGain) {
      if (!on) return;
      this.chaseGain = c.createGain();
      this.chaseGain.gain.value = 0;
      this.chasePanner = this.panner(0);
      this.chaseOcc = this.filt('lowpass', 20000, 0.5);
      this.chaseGain.connect(this.chaseOcc).connect(this.chasePanner);
      this.sample(CHASE_ALL);
    }
    const list = levelSfx(this.roomLevel).chase;
    if (this.chaseList !== list) {
      this.chaseList = list;
      for (const n of list) this.sample(n);
    }
    if (pos && typeof pos === 'object') this.moveTo(this.chasePanner, pos.x, pos.z, 0.05);
    const occ = occOf(occluded);
    this.chaseOcc.frequency.setTargetAtTime(occFreq(occ), t, 0.12);
    const want = on ? (0.35 + Math.min(1, danger) * 0.75) * occGain(occ) : 0;
    this.chaseGain.gain.setTargetAtTime(want, t, on ? 0.25 : 0.5);
    if (on && !this.chasePlaying) this.nextChase();
    if (on && !this.chaseAll) this.startChaseAll();
    else if (!on && this.chaseAll && this.chaseGain.gain.value < 0.02) {
      try {
        if (this.chaseAll !== true) this.chaseAll.stop();
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
  // des couloirs ; pas pendant une poursuite. Par-dessus, les bruits synthétisés propres à chaque niveau.
  ambience(dt, active) {
    if (!this.unlocked || !this.ctx) return;
    if (this.ambT === undefined) this.ambT = 6 + Math.random() * 10;
    if (!active) return;
    if (this.ctx.currentTime < this.silenceUntil) return;
    this.synthAmbience(dt);
    this.ambT -= dt;
    if (this.ambT > 0) return;
    this.ambT = 20 + Math.random() * 30;
    const AMBIENT = levelSfx(this.roomLevel).ambient;
    if (this.roomLevel === 4) { // HOTEL_LEVEL
      // l'hôtel : un parquet qui craque quelque part, plus rarement une boîte à musique désaccordée au loin
      this.ambT = 9 + Math.random() * 18;
      if (Math.random() < 0.25) this.musicBox();
      else this.creak();
      return;
    }
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
      src.connect(g).connect(this.bedWet);
      src.start();
    });
  }

  // les fonds continus de chaque niveau, sous tout le reste (bus bedWet) : Level 1 la ventilation, Poolrooms l'eau
  // qui s'écoule, Tuyauteries le grondement des conduites. Rien au Level 0 : la moquette boit tout.
  levelBed(level) {
    const c = this.ctx;
    const t = c.currentTime;
    if (this.bed) {
      const old = this.bed;
      old.g.gain.setTargetAtTime(0, t, 0.8);
      setTimeout(() => old.srcs.forEach((s) => { try { s.stop(); } catch (e) { /* déjà arrêté */ } }), 5000);
      this.bed = null;
    }
    this.amb = { a: rnd(6, 14), b: rnd(10, 20), c: rnd(14, 26) };
    const g = this.gainNode(0);
    g.connect(this.bedWet);
    const srcs = [];
    const src = (n) => (srcs.push(n), n);
    let vol = 0;
    if (level === 1) {
      // la ventilation : un souffle grave dans les gaines, l'air qui siffle aux grilles, une pale qui tourne
      const am = this.gainNode(0.8);
      const lfo = src(this.osc('sine', 0.05));
      const lfoG = this.gainNode(0.2);
      lfo.connect(lfoG).connect(am.gain);
      am.connect(g);
      src(this.longNoise()).connect(this.filt('bandpass', 210, 0.6)).connect(this.gainNode(0.6)).connect(am);
      src(this.longNoise()).connect(this.filt('bandpass', 820, 1.2)).connect(this.gainNode(0.12)).connect(am);
      src(this.osc('sawtooth', 24)).connect(this.filt('lowpass', 90, 0.7)).connect(this.gainNode(0.12)).connect(am);
      vol = 0.2;
    } else if (level === 2) {
      // l'eau qui s'écoule dans les rigoles : un filet aigu qui frémit, et un écoulement grave
      const am = this.gainNode(0.5);
      for (const [f, d] of [[3.3, 0.25], [5.9, 0.2]]) {
        const lfo = src(this.osc('sine', f));
        const lg = this.gainNode(d);
        lfo.connect(lg).connect(am.gain);
      }
      src(this.longNoise()).connect(this.filt('bandpass', 2400, 1.2)).connect(am).connect(g);
      src(this.longNoise()).connect(this.filt('lowpass', 500, 0.7)).connect(this.gainNode(0.3)).connect(g);
      vol = 0.08;
    } else if (level === PIPES_LEVEL) {
      // le grondement des conduites, le flux qui chuinte, et un tuyau qui chante tout bas
      src(this.longNoise()).connect(this.filt('lowpass', 80, 0.7)).connect(this.gainNode(0.9)).connect(g);
      src(this.longNoise()).connect(this.filt('bandpass', 1100, 0.6)).connect(this.gainNode(0.08)).connect(g);
      const sing = this.gainNode(0.12);
      const lfo = src(this.osc('sine', 0.13));
      const lg = this.gainNode(0.06);
      lfo.connect(lg).connect(sing.gain);
      src(this.osc('sine', 58)).connect(sing).connect(g);
      src(this.osc('sawtooth', 29)).connect(this.filt('lowpass', 70, 0.7)).connect(this.gainNode(0.2)).connect(g);
      vol = 0.08;
    } else return;
    for (const s of srcs) s.start(t, s.buffer ? Math.random() * 4 : 0);
    g.gain.setTargetAtTime(vol, t, 2);
    this.bed = { g, srcs };
  }

  // les bruits ponctuels synthétisés de chaque niveau (appelé par ambience, hors poursuite et hors silence)
  synthAmbience(dt) {
    const A = this.amb;
    if (!A) return;
    A.a -= dt;
    A.b -= dt;
    A.c -= dt;
    const lv = this.roomLevel;
    if (lv === 1) {
      // la tôle et les étagères qui craquent ; parfois des coups dans les gaines
      if (A.a <= 0) {
        A.a = rnd(7, 20);
        this.creak(this.around(8, 25), rnd(0.5, 1));
      }
      if (A.b <= 0) {
        A.b = rnd(25, 50);
        this.distant(Math.random() < 0.6 ? 'groan' : 'knock', this.around(18, 32), 0.5, this.bedWet);
      }
    } else if (lv === 2) {
      // l'eau qui clapote contre le carrelage
      if (A.a <= 0) {
        A.a = rnd(4, 10);
        this.slosh(this.around(5, 16), rnd(0.5, 1));
      }
    } else if (lv === PIPES_LEVEL) {
      // coups de bélier, vapeur qui siffle au loin, tuyaux qui gémissent
      if (A.a <= 0) {
        A.a = rnd(9, 22);
        this.steamFar(this.around(14, 30), rnd(0.5, 0.9));
      }
      if (A.b <= 0) {
        A.b = rnd(18, 40);
        this.distant('hammer', this.around(15, 35), rnd(0.5, 0.8), this.bedWet);
      }
      if (A.c <= 0) {
        A.c = rnd(14, 32);
        this.distant('groan', this.around(12, 30), rnd(0.4, 0.7), this.bedWet);
      }
    }
  }

  // un craquement de tôle ou d'étagère : quelques grains métalliques très résonants
  creak(pos, vol = 1) {
    const out = this.at({ ...pos, rolloff: 0.5, ref: 4 }, vol, 0, this.bedWet);
    const t = this.ctx.currentTime + 0.02;
    let k = t;
    const f = rnd(700, 1400);
    for (let i = 0; i < 3 + Math.floor(Math.random() * 4); i++) {
      const o = this.osc('sawtooth', f * rnd(0.95, 1.05));
      const bp = this.filt('bandpass', f * 2, 12);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, k);
      g.gain.exponentialRampToValueAtTime(0.05, k + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, k + 0.03);
      o.connect(bp).connect(g).connect(out);
      o.start(k);
      o.stop(k + 0.04);
      k += rnd(0.03, 0.12);
    }
    this.caption('[metal creaks]', pos);
  }

  // l'eau qui clapote : une vague étouffée qui enfle et retombe, deux gouttes
  slosh(pos, vol = 1) {
    const c = this.ctx;
    const out = this.at({ ...pos, rolloff: 0.6, ref: 3 }, vol, 0, this.bedWet);
    const t = c.currentTime + 0.02;
    const n = this.noise();
    const lp = this.filt('lowpass', 600, 0.8);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(900, t + 0.3);
    lp.frequency.linearRampToValueAtTime(350, t + 0.8);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
    n.connect(lp).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + 0.9);
    this.plop(t + 0.35, 0.03, out);
    this.plop(t + 0.5, 0.02, out);
  }

  // un jet de vapeur qui siffle au loin, qui crachote puis se tait
  steamFar(pos, vol = 1) {
    const c = this.ctx;
    const out = this.at({ ...pos, rolloff: 0.35, ref: 4 }, vol, 0, this.bedWet);
    const t = c.currentTime + 0.02;
    const dur = rnd(1.4, 3.2);
    const n = this.noise();
    const hp = this.filt('highpass', 2200, 0.7);
    const lp = this.filt('lowpass', 6000, 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.15);
    for (let k = 0.3; k < dur - 0.3; k += rnd(0.08, 0.3)) g.gain.setTargetAtTime(rnd(0.08, 0.2), t + k, 0.03);
    g.gain.setTargetAtTime(0.0001, t + dur - 0.3, 0.1);
    n.connect(hp).connect(lp).connect(g).connect(out);
    n.start(t, Math.random() * 0.5);
    n.stop(t + dur + 0.5);
    this.caption('[steam hiss]', pos);
  }

  // Un bruit lointain (fausse alerte, événement) : kind 'door' (porte qui claque), 'knock' (coups dans la
  // ventilation), 'groan' (tôle qui gémit), 'hammer' (coup de bélier dans les tuyaux), 'steps' (pas fantômes),
  // 'buzz' (bouffée du bourdonnement de l'entité), 'ding' (sonnette d'ascenseur), 'drag' (quelque chose qu'on traîne),
  // 'laugh' (rire étouffé, à garder rare). pos : { x, z } (null : au hasard, 20 à 40 m) ; tout est étouffé et noyé
  // dans l'écho. bus : réservé (les ambiances passent par bedWet).
  distant(kind, pos = null, vol = 1, bus = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.02;
    const lpF = { door: 1100, knock: 1500, groan: 900, hammer: 1300, steps: 900, buzz: 1500, ding: 2400, drag: 1000, laugh: 650 }[kind];
    if (!lpF) return;
    const p = pos && typeof pos === 'object' ? pos : this.around(20, 40);
    const pl = this.place({ ...p, rolloff: p.rolloff ?? 0.35, ref: p.ref ?? 4 }, 0.6 * vol, p.occluded || 0, bus || this.out);
    const o = this.filt('lowpass', lpF, 0.5);
    o.connect(pl.input);
    // c'est loin : un peu plus d'écho que de son direct
    o.connect(this.gainNode(0.35 * vol)).connect(this.verb);
    const mk = (fn) => fn.call(this, o, t, pl, p);
    ({
      door: () => mk(this.farDoor),
      knock: () => mk(this.farKnock),
      groan: () => mk(this.farGroan),
      hammer: () => mk(this.farHammer),
      steps: () => mk(this.farSteps),
      buzz: () => mk(this.farBuzz),
      ding: () => this.ring(o, t, 830, [[1, 1, 1.6], [1.004, 0.5, 1.5], [2, 0.25, 0.8], [2.76, 0.12, 0.45], [5.4, 0.05, 0.2]], 0.12),
      drag: () => mk(this.farDrag),
      laugh: () => mk(this.farLaugh),
    })[kind]();
    this.caption(DISTANT_CAP[kind], p);
  }

  // une porte qui claque : le battant, le pêne, la vitre ou le cadre qui vibre
  farDoor(o, t) {
    this.tone(o, t, 'sine', 80, 38, 0.45, 0.9, 0.003);
    this.burst(o, t, 0.3, 'lowpass', 350, 0.7, 0.8);
    this.burst(o, t + 0.01, 0.03, 'bandpass', 1900, 4, 0.35);
    this.burst(o, t + 0.09, 0.05, 'bandpass', 1100, 3, 0.2);
  }

  // des coups dans une gaine de ventilation, comme des phalanges sur la tôle
  farKnock(o, t) {
    let k = t;
    const f = rnd(280, 340);
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      this.tone(o, k, 'triangle', f * rnd(0.95, 1.05), f * 0.8, 0.12, 0.5, 0.002);
      this.ring(o, k, f, [[1, 1, 0.25], [2.7, 0.5, 0.15], [4.8, 0.25, 0.08]], 0.25);
      this.burst(o, k, 0.03, 'bandpass', 900, 2, 0.3);
      k += rnd(0.12, 0.35);
    }
  }

  // une tôle (ou un tuyau) qui gémit : un souffle dans deux filtres très étroits qui glissent vers le grave
  farGroan(o, t) {
    const c = this.ctx;
    const D = rnd(1.8, 3);
    const n = this.noise();
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    let k = 0;
    while (k < D) {
      k += rnd(0.15, 0.5);
      g.gain.linearRampToValueAtTime(rnd(0.3, 1), t + Math.min(k, D));
    }
    g.gain.linearRampToValueAtTime(0.0001, t + D + 0.3);
    const f = rnd(130, 190);
    for (const [m, q, v] of [[1, 30, 6], [2.7, 25, 3]]) {
      const bp = this.filt('bandpass', f * m, q);
      bp.frequency.setValueAtTime(f * m, t);
      bp.frequency.exponentialRampToValueAtTime(f * m * 0.75, t + D);
      const bg = this.gainNode(v);
      n.connect(bp).connect(bg).connect(g);
    }
    const s = this.osc('sawtooth', f * 0.4);
    s.frequency.setValueAtTime(f * 0.4, t);
    s.frequency.exponentialRampToValueAtTime(f * 0.3, t + D);
    s.connect(this.filt('lowpass', 200, 0.7)).connect(this.gainNode(0.06)).connect(g);
    g.connect(o);
    n.start(t, Math.random() * 0.5);
    s.start(t);
    n.stop(t + D + 0.4);
    s.stop(t + D + 0.4);
  }

  // un coup de bélier : un tuyau qui cogne, une, deux ou trois fois, et qui sonne longtemps
  farHammer(o, t) {
    const c = this.ctx;
    // la résonance du tuyau : un écho très court qui se renvoie
    const comb = c.createDelay(0.05);
    comb.delayTime.value = 1 / rnd(180, 240);
    const fb = this.gainNode(0.72);
    const inp = this.gainNode(1);
    inp.connect(comb).connect(fb).connect(comb);
    comb.connect(this.gainNode(0.5)).connect(o);
    inp.connect(o);
    let k = t;
    let v = 1;
    for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
      this.tone(inp, k, 'sine', 95, 45, 0.35, 0.8 * v, 0.002);
      this.burst(inp, k, 0.08, 'lowpass', 900, 0.7, 0.6 * v);
      this.ring(inp, k, 187, [[1, 1, 1.2], [2.3, 0.7, 0.9], [4.6, 0.5, 0.6], [6.9, 0.3, 0.4], [11.8, 0.15, 0.25]], 0.22 * v);
      k += rnd(0.35, 0.7);
      v *= 0.6;
    }
  }

  // des pas fantômes : quatre à six pas lourds, qui avancent un peu
  farSteps(o, t, pl, p) {
    const a = Math.random() * Math.PI * 2;
    let k = t;
    for (let i = 0; i < 4 + Math.floor(Math.random() * 3); i++) {
      this.moveAt(pl.panner, p.x + Math.cos(a) * 0.7 * i, p.z + Math.sin(a) * 0.7 * i, k);
      this.tone(o, k, 'sine', 70, 32, 0.28, 0.7, 0.008);
      this.burst(o, k, 0.1, 'lowpass', 450, 0.7, 0.5);
      this.burst(o, k + 0.01, 0.03, 'bandpass', 1200, 2, 0.15);
      k += rnd(0.5, 0.62);
    }
  }

  // une bouffée du bourdonnement de l'entité, sans l'entité
  farBuzz(o, t) {
    const c = this.ctx;
    const D = 2;
    const o1 = this.osc('sawtooth', 150);
    const o2 = this.osc('square', 158);
    const bp = this.filt('bandpass', 900, 4);
    const st = this.gainNode(0.7);
    const lfo = this.osc('square', 11);
    const lg = this.gainNode(0.3);
    lfo.connect(lg).connect(st.gain);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.6, t + 0.5);
    env.gain.setValueAtTime(0.6, t + 1.2);
    env.gain.exponentialRampToValueAtTime(0.0001, t + D);
    o1.connect(bp);
    o2.connect(this.gainNode(0.35)).connect(bp);
    bp.connect(st).connect(env).connect(o);
    for (const x of [o1, o2, lfo]) {
      x.start(t);
      x.stop(t + D + 0.05);
    }
    for (let i = 0; i < 3; i++) this.burst(o, t + rnd(0.4, 1.5), rnd(0.015, 0.04), 'highpass', 3000, 0.7, 0.08);
  }

  // quelque chose qu'on traîne sur le sol : un raclement irrégulier qui se déplace lentement
  farDrag(o, t, pl, p) {
    const c = this.ctx;
    const D = rnd(2.4, 3.4);
    const am = c.createGain();
    am.gain.setValueAtTime(0.0001, t);
    for (let k = 0.05; k < D; k += rnd(0.07, 0.18)) am.gain.linearRampToValueAtTime(rnd(0.1, 0.9) * Math.min(1, k * 3, (D - k) * 3), t + k);
    am.gain.linearRampToValueAtTime(0.0001, t + D);
    const n = this.noise();
    n.connect(this.filt('bandpass', 380, 0.9)).connect(am);
    n.connect(this.filt('bandpass', 1700, 2.5)).connect(this.gainNode(0.3)).connect(am);
    am.connect(this.gainNode(0.8)).connect(o);
    n.start(t, Math.random() * 0.5);
    n.stop(t + D + 0.05);
    const a = Math.random() * Math.PI * 2;
    if (pl.panner.positionX) {
      pl.panner.positionX.setValueAtTime(p.x, t);
      pl.panner.positionZ.setValueAtTime(p.z, t);
    }
    this.moveAt(pl.panner, p.x + Math.cos(a) * 3, p.z + Math.sin(a) * 3, t + D, true);
  }

  // un rire étouffé, très loin : une voix hachée (« ha… ha… ha ») qui descend
  farLaugh(o, t) {
    const c = this.ctx;
    const D = 1.8;
    const vo = this.osc('sawtooth', 185);
    vo.frequency.setValueAtTime(185, t);
    vo.frequency.exponentialRampToValueAtTime(140, t + D);
    const mix = this.gainNode(1);
    for (const [f, q, g] of [[750, 6, 1], [1150, 7, 0.5], [2500, 9, 0.2]]) vo.connect(this.filt('bandpass', f, q)).connect(this.gainNode(g * 3)).connect(mix);
    const chop = this.gainNode(0);
    const lfo = this.osc('sine', 4.6);
    lfo.frequency.setValueAtTime(4.6, t);
    lfo.frequency.exponentialRampToValueAtTime(3.2, t + D);
    const sq = c.createWaveShaper();
    const k = new Float32Array(256);
    for (let i = 0; i < 256; i++) k[i] = Math.max(0, Math.tanh(((i / 255) * 2 - 1) * 6));
    sq.curve = k;
    lfo.connect(sq).connect(chop.gain);
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.4, t + 0.1);
    env.gain.setValueAtTime(0.4, t + D * 0.6);
    env.gain.exponentialRampToValueAtTime(0.0001, t + D);
    mix.connect(chop).connect(env).connect(o);
    for (const x of [vo, lfo]) {
      x.start(t);
      x.stop(t + D + 0.05);
    }
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

  // Coupure de courant : le gros contacteur qui claque, le transformateur qui s'éteint en descendant, les ballasts qui
  // meurent ; le bourdonnement des néons se tait
  blackout() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.out;
    // le contacteur
    this.burst(out, t, 0.18, 'lowpass', 300, 0.8, 0.7);
    this.burst(out, t, 0.04, 'bandpass', 1600, 2, 0.4);
    this.tone(out, t, 'sine', 95, 40, 0.3, 0.35, 0.002);
    // le transfo : son 50 Hz et ses harmoniques qui descendent et s'éteignent
    const lp = this.filt('lowpass', 380, 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    lp.connect(g).connect(out);
    for (const [f, a] of [[50, 1], [100, 0.6], [150, 0.25]]) {
      const o = this.osc(f === 50 ? 'triangle' : 'sine', f);
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 0.8, t + 1.8);
      o.connect(this.gainNode(a)).connect(lp);
      o.start(t);
      o.stop(t + 1.85);
    }
    // les ballasts qui lâchent
    const b = this.osc('sawtooth', 120);
    const bg = c.createGain();
    bg.gain.setValueAtTime(0.03, t);
    bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    b.connect(this.filt('bandpass', 900, 1.2)).connect(bg).connect(out);
    b.start(t);
    b.stop(t + 0.3);
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0, t, 0.08);
    this.dark = true;
    this.caption('[power cuts out]');
  }

  // Le courant revient : le transformateur remonte, les starters claquent ici et là, les tubes papillotent puis
  // tiennent, le bourdonnement revient
  power() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = this.out;
    this.dark = false;
    // le transfo qui remonte
    const lp = this.filt('lowpass', 300, 0.7);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.9);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    lp.connect(g).connect(out);
    for (const [f, a] of [[50, 1], [100, 0.5]]) {
      const o = this.osc('triangle', f);
      o.frequency.setValueAtTime(f * 0.76, t);
      o.frequency.exponentialRampToValueAtTime(f, t + 1.2);
      o.connect(this.gainNode(a)).connect(lp);
      o.start(t);
      o.stop(t + 2.65);
    }
    // les tubes qui s'amorcent, un par un, autour de toi
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) this.neonClick(this.around(2, 9), 0.7, 0.25 + i * rnd(0.15, 0.35));
    // le bourdonnement qui revient en papillotant
    if (this.ambientGain) this.ambientGain.gain.setTargetAtTime(0.045, t + 0.3, 0.4);
    if (this.humFlutter) {
      const f = this.humFlutter.gain;
      f.cancelScheduledValues(t);
      f.setValueAtTime(0, t);
      let k = t + 0.3;
      for (let i = 0; i < 5; i++) {
        f.setValueAtTime(rnd(0.5, 1), k);
        k += rnd(0.04, 0.12);
        f.setValueAtTime(rnd(0, 0.2), k);
        k += rnd(0.05, 0.15);
      }
      f.setValueAtTime(1, k);
    }
    this.caption('[power returns]');
  }

  // Level 5 : une touche du clavier à code, et le refus d'un mauvais code
  beep(f = 1250, len = 0.07, vol = 0.08, type = 'square') {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = f;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(this.out);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  buzz() {
    this.beep(160, 0.45, 0.12, 'sawtooth');
  }

  // Ding de l'ascenseur : une cloche frappée (partiels de bronze, un léger battement), deux notes qui descendent.
  // pos : { x, z } de l'ascenseur (null : non placé)
  ding(pos = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = pos ? this.at({ ...pos, rolloff: 0.5, ref: 5 }, 1) : this.out;
    for (const [f, d] of [[1046, 0], [830, 0.3]]) {
      this.ring(out, t + d, f, [[1, 1, 1.4], [1.003, 0.5, 1.3], [2, 0.25, 0.7], [2.76, 0.12, 0.4], [5.4, 0.05, 0.2]], 0.1);
      this.burst(out, t + d, 0.01, 'bandpass', 4000, 2, 0.04);
    }
    this.caption('[elevator ding]', pos);
  }

  // Level 5 : une latte de parquet qui craque, quelque part dans l'hôtel
  creak() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const f = 70 + Math.random() * 60;
    o.frequency.setValueAtTime(f, t);
    o.frequency.linearRampToValueAtTime(f * (1.3 + Math.random() * 0.6), t + 0.5 + Math.random() * 0.5);
    // un grincement saccadé : le volume tremble vite
    const am = c.createOscillator();
    am.frequency.value = 18 + Math.random() * 20;
    const amg = c.createGain();
    amg.gain.value = 0.5;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    am.connect(amg).connect(g.gain);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 600 + Math.random() * 500;
    bp.Q.value = 4;
    o.connect(bp).connect(g).connect(this.out);
    o.start(t);
    am.start(t);
    o.stop(t + 1.2);
    am.stop(t + 1.2);
  }

  // Level 5 : quelques notes de boîte à musique, lentes et désaccordées, très bas
  musicBox() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t0 = c.currentTime;
    const notes = [659, 587, 523, 494, 523, 392, 440, 330];
    const start = Math.floor(Math.random() * 3);
    notes.slice(start, start + 5).forEach((f, i) => {
      const t = t0 + i * 0.55;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.value = f * (0.985 + Math.random() * 0.02);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.025, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
      o.connect(g).connect(this.out);
      o.start(t);
      o.stop(t + 1.5);
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
    if (pos) this.caption('[whistle]', pos);
  }

  // Chute dans un trou : un long sifflement d'air qui descend pendant plus d'une seconde, puis un choc sourd et lourd
  // (plus fort pour celui qui tombe) ; pos : { x, z } d'un coéquipier qui tombe (sa chute est alors placée là)
  fall(mine = true, pos = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const placed = !mine && pos && typeof pos === 'object';
    const k = mine ? 1 : placed ? 0.8 : 0.4;
    const dest = placed ? this.at({ ...pos, rolloff: 0.6, ref: 3 }, 1) : this.out;
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
    g.connect(dest);
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
    ag.connect(dest);
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
    tg.connect(dest);
    thud.start(t);
    thud.stop(t + T + 0.65);
    if (!mine) this.caption('[someone falls]', pos);
  }

  // Victoire : l'entité se tait, la tension retombe, plus de cœur ni de lutte
  win() {
    if (!this.unlocked || !this.ctx) return;
    if (this.monsterGain) this.monsterGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    this.setChase(false);
    this.heartbeat(0);
    this.stopGrab();
    if (this.tension) this.setTension(0, 'relief');
  }

  // --- Musique de tension ---

  // t de 0 à 1, mode 'calm' | 'stalk' | 'search' | 'chase' | 'relief' : un drone grave, une nappe désaccordée, des
  // cordes bruitées aiguës et une pulsation, en fondu selon t ; à peine audible à bas niveau. À appeler chaque image
  // (ou à chaque changement) ; à 0 pendant une dizaine de secondes, tout s'arrête.
  setTension(t = 0, mode = 'stalk') {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const now = c.currentTime;
    t = clamp01(t);
    if (!TENSION[mode]) mode = 'stalk';
    if (!this.tension) {
      if (t < 0.01) return;
      this.initTension();
    }
    const T = this.tension;
    if (t < 0.01) {
      if (!T.idle) T.idle = now;
      else if (now - T.idle > 12) return this.stopTension();
    } else T.idle = 0;
    if (Math.abs(t - T.t) < 0.01 && mode === T.mode) return;
    T.t = t;
    T.mode = mode;
    const m = TENSION[mode];
    const k = mode === 'relief' ? 2.5 : mode === 'chase' ? 0.4 : 1.2;
    T.drone.gain.setTargetAtTime(0.07 * m.drone * Math.pow(t, 1.3), now, k);
    T.pad.gain.setTargetAtTime(0.028 * m.pad * Math.pow(t, 1.6), now, k);
    T.strings.gain.setTargetAtTime(0.03 * m.strings * Math.pow(Math.max(0, (t - 0.3) / 0.7), 1.5), now, k);
    this.ensureClock();
  }

  initTension() {
    const c = this.ctx;
    const t = c.currentTime;
    const srcs = [];
    const src = (n) => (srcs.push(n), n);
    const layer = () => {
      const g = this.gainNode(0);
      g.connect(this.music);
      return g;
    };
    // le drone : un mi très grave, son octave, et une dent de scie qui bat contre lui
    const drone = layer();
    const dAm = this.gainNode(0.8);
    const dl = src(this.osc('sine', 0.08));
    dl.connect(this.gainNode(0.2)).connect(dAm.gain);
    dAm.connect(drone);
    src(this.osc('sine', 41.2)).connect(dAm);
    src(this.osc('sine', 82.4)).connect(this.gainNode(0.35)).connect(dAm);
    src(this.osc('sawtooth', 41.5)).connect(this.filt('lowpass', 140, 0.7)).connect(this.gainNode(0.5)).connect(dAm);
    // la nappe : sol, sol désaccordé, si bémol, do dièse (un triton) dans un filtre qui respire
    const pad = layer();
    const plp = this.filt('lowpass', 420, 0.8);
    const pl = src(this.osc('sine', 0.045));
    pl.connect(this.gainNode(160)).connect(plp.frequency);
    plp.connect(pad);
    for (const f of [98, 98.6, 116.5, 138.6]) {
      const o = src(this.osc('sawtooth', f));
      o.connect(this.gainNode(0.25)).connect(plp);
      if (f === 98.6) src(this.osc('sine', 0.09)).connect(this.gainNode(0.8)).connect(o.frequency);
    }
    // les cordes : deux notes aiguës à un demi-ton, frottées (bruit très filtré) avec un peu de son pur qui vibre
    const strings = layer();
    const sAm = this.gainNode(0.75);
    src(this.osc('sine', 7)).connect(this.gainNode(0.25)).connect(sAm.gain);
    sAm.connect(strings);
    const sn = src(this.longNoise());
    for (const f of [1760, 1865]) {
      sn.connect(this.filt('bandpass', f, 45)).connect(this.gainNode(8)).connect(sAm);
      const o = src(this.osc('sine', f));
      src(this.osc('sine', 5.3)).connect(this.gainNode(5)).connect(o.frequency);
      o.connect(this.gainNode(0.05)).connect(sAm);
    }
    for (const s of srcs) s.start(t);
    this.tension = { drone, pad, strings, srcs, t: 0, mode: 'calm', idle: 0, beat: 0, pulseNext: 0 };
  }

  stopTension() {
    const T = this.tension;
    if (!T) return;
    const t = this.ctx.currentTime;
    for (const g of [T.drone, T.pad, T.strings]) g.gain.setTargetAtTime(0, t, 0.3);
    for (const s of T.srcs) {
      try {
        s.stop(t + 2);
      } catch (e) {
        /* déjà arrêté */
      }
    }
    this.tension = null;
  }

  // la pulsation de la musique : un coup grave et feutré
  pulseBeat(at, k, accent) {
    const v = 0.1 * k * (accent ? 1.3 : 1);
    this.tone(this.music, at, 'sine', 62, 41, 0.3, v, 0.006);
    this.burst(this.music, at, 0.05, 'lowpass', 180, 0.7, v * 0.5);
  }

  // l'horloge des sons rythmés (cœur, pulsation) : programmés un peu d'avance, elle s'arrête quand rien ne bat
  ensureClock() {
    const T = this.tension;
    const need = this.heartRate > 0 || (T && T.t > 0.05 && TENSION[T.mode].pulse > 0);
    if (need && !this.clockId) this.clockId = setInterval(() => this.clock(), 50);
  }

  clock() {
    const c = this.ctx;
    if (!c) return;
    const now = c.currentTime;
    const ahead = now + 0.16;
    let busy = false;
    if (this.heartRate > 0) {
      busy = true;
      if (!(this.heartNext > now)) this.heartNext = now + 0.03;
      while (this.heartNext < ahead) {
        this.heartBeat(this.heartNext);
        this.heartNext += 60 / this.heartRate;
      }
    }
    const T = this.tension;
    const m = T && TENSION[T.mode];
    if (m && m.pulse > 0 && T.t > 0.05) {
      busy = true;
      if (now >= this.silenceUntil) {
        if (!(T.pulseNext > now)) T.pulseNext = now + 0.05;
        while (T.pulseNext < ahead) {
          this.pulseBeat(T.pulseNext, m.pulse * Math.pow(T.t, 1.2), T.beat++ % 4 === 0);
          T.pulseNext += 1 / (m.rate * (0.8 + T.t * 0.4));
        }
      }
    }
    if (!busy) {
      clearInterval(this.clockId);
      this.clockId = null;
    }
  }

  // --- Le corps du joueur ---

  // Le cœur, dans ta tête (bus ui) : rate en battements par minute, 0 pour l'arrêter
  heartbeat(rate = 0) {
    this.heartRate = rate > 0 ? Math.max(30, Math.min(200, rate)) : 0;
    if (this.unlocked && this.ctx) this.ensureClock();
  }

  heartBeat(at) {
    const r = this.heartRate || 70;
    const k = Math.min(1, Math.max(0, (r - 50) / 100));
    const v = 0.14 + k * 0.12;
    const gap = Math.min(0.2, 0.32 * (60 / r));
    this.tone(this.ui, at, 'sine', 58, 36, 0.16, v, 0.012);
    this.tone(this.ui, at, 'triangle', 110, 70, 0.08, v * 0.15, 0.01);
    this.burst(this.ui, at, 0.08, 'lowpass', 120, 0.7, v * 0.4);
    this.tone(this.ui, at + gap, 'sine', 52, 34, 0.13, v * 0.6, 0.012);
  }

  // Le souffle retenu dans une cachette (on) : une inspiration rapide, puis plus rien ; en le relâchant, l'air qui
  // ressort d'un coup et quelques reprises haletantes
  holdBreath(on) {
    if (!this.unlocked || !this.ctx) return;
    on = !!on;
    if (on === !!this.breathHeld) return;
    this.breathHeld = on;
    const t = this.ctx.currentTime + 0.01;
    if (this.breathGain) this.breathGain.gain.setTargetAtTime(0, t, on ? 0.06 : 0.3);
    if (on) {
      this.breathNoise(this.master, t, 0.42, 700, 1500, 0.06);
      this.burst(this.master, t + 0.45, 0.012, 'bandpass', 2000, 3, 0.03);
      return;
    }
    this.breathNoise(this.master, t, 0.55, 1100, 500, 0.1);
    for (let i = 0; i < 4; i++) {
      const k = t + 0.65 + i * 0.62;
      const v = 1 - i * 0.18;
      this.breathNoise(this.master, k, 0.26, 600, 1100, 0.04 * v);
      this.breathNoise(this.master, k + 0.3, 0.3, 900, 500, 0.05 * v);
    }
  }

  // S'accroupir (on) ou se relever : un froissement de vêtements, le genou qui touche le sol
  crouch(on) {
    if (!this.unlocked || !this.ctx) return;
    const t = this.ctx.currentTime + 0.01;
    this.burst(this.out, t, 0.18, 'bandpass', 1800, 0.6, 0.05);
    this.burst(this.out, t + 0.08, 0.15, 'bandpass', 3200, 0.6, 0.035);
    if (on) this.tone(this.out, t + 0.12, 'sine', 90, 50, 0.1, 0.06, 0.006);
  }

  // La porte d'un casier métallique (se cacher, en sortir) : le loquet, la charnière qui grince, la tôle qui claque
  // et vibre. pos : { x, z } quand c'est un autre joueur (null : toi)
  hide(pos = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const out = pos ? this.at({ ...pos, rolloff: 0.8, ref: 3 }, 1) : this.out;
    this.burst(out, t, 0.025, 'bandpass', 3500, 3, 0.25);
    // la charnière
    const sq = this.osc('sawtooth', 700);
    sq.frequency.setValueAtTime(700, t + 0.04);
    sq.frequency.linearRampToValueAtTime(900, t + 0.24);
    const sg = c.createGain();
    sg.gain.setValueAtTime(0.0001, t + 0.04);
    sg.gain.exponentialRampToValueAtTime(0.03, t + 0.08);
    sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
    sq.connect(this.filt('bandpass', 1400, 12)).connect(sg).connect(out);
    sq.start(t + 0.04);
    sq.stop(t + 0.28);
    // la porte qui claque, la tôle qui vibre, puis un petit cliquetis
    const k = t + 0.3;
    this.tone(out, k, 'sine', 120, 60, 0.22, 0.3, 0.003);
    this.ring(out, k, 190, [[1, 1, 0.5], [2.3, 0.7, 0.35], [4.1, 0.45, 0.22], [6.8, 0.25, 0.15]], 0.07);
    this.burst(out, k, 0.06, 'lowpass', 900, 0.8, 0.3);
    for (let i = 0; i < 3; i++) this.burst(out, k + 0.08 + i * rnd(0.03, 0.06), 0.012, 'bandpass', 2600, 4, 0.06);
    if (pos) this.caption('[locker door]', pos);
  }

  // Une vanne qu'on tourne (appelée chaque image, progress de 0 à 1) : un grincement métallique, par à-coups, qui
  // monte à mesure qu'elle se ferme ; à 1, elle claque et se tait ; progress < 0 (ou null) : on lâche, le son s'arrête.
  // pos : { x, z } de la vanne (null : celle que tu tournes, devant toi). Un seul grincement à la fois.
  valveTurn(progress, pos = null) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    let V = this.valve;
    if (progress == null || progress < 0) {
      this.valveDone = false;
      if (V) this.stopValve();
      return;
    }
    const p = clamp01(progress);
    if (p >= 1) {
      if (V && !this.valveDone) {
        const out = V.pl ? V.pl.input : this.out;
        this.tone(out, t + 0.01, 'sine', 110, 55, 0.35, 0.4, 0.003);
        this.ring(out, t + 0.01, 223, [[1, 1, 0.9], [2.31, 0.6, 0.6], [4.13, 0.3, 0.35], [6.7, 0.12, 0.2]], 0.09);
        this.burst(out, t + 0.01, 0.12, 'lowpass', 800, 0.8, 0.4);
        this.stopValve();
      }
      this.valveDone = true;
      return;
    }
    this.valveDone = false;
    if (!V) {
      const pl = pos && typeof pos === 'object' ? this.place({ ...pos, rolloff: 0.8, ref: 3 }, 1) : null;
      const g = this.gainNode(0);
      g.connect(pl ? pl.input : this.out);
      const n = this.noise();
      const bp = this.filt('bandpass', 300, 18);
      n.connect(bp).connect(this.gainNode(0.9)).connect(g);
      const groan = this.osc('sawtooth', 62);
      groan.connect(this.filt('lowpass', 300, 1)).connect(this.gainNode(0.25)).connect(g);
      n.start(t);
      groan.start(t);
      V = this.valve = { g, bp, n, groan, pl, next: t };
      if (pl) this.caption('[valve creaking]', pos);
    }
    if (pos && V.pl) this.moveTo(V.pl.panner, pos.x, pos.z, 0.05);
    V.bp.frequency.setTargetAtTime(280 + p * 620, t, 0.1);
    V.groan.frequency.setTargetAtTime(62 + p * 40, t, 0.2);
    V.g.gain.setTargetAtTime(0.08 + p * 0.08, t, 0.15);
    // le métal qui accroche et lâche
    if (t >= V.next) {
      V.next = t + rnd(0.07, 0.19);
      const f = (500 + p * 900) * rnd(0.95, 1.05);
      const o = this.osc('sawtooth', f);
      const e = c.createGain();
      const len = rnd(0.06, 0.12);
      e.gain.setValueAtTime(0.0001, t);
      e.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      e.gain.exponentialRampToValueAtTime(0.0001, t + len);
      o.connect(this.filt('bandpass', f * 2, 12)).connect(e).connect(V.g);
      o.start(t);
      o.stop(t + len + 0.02);
    }
  }

  stopValve() {
    const V = this.valve;
    if (!V) return;
    const t = this.ctx.currentTime;
    V.g.gain.setTargetAtTime(0, t, 0.06);
    try {
      V.n.stop(t + 0.4);
      V.groan.stop(t + 0.4);
    } catch (e) {
      /* déjà arrêté */
    }
    this.valve = null;
  }

  // L'entité t'agrippe : un choc, ton souffle coupé, puis la lutte (vêtements, raclements, son souffle à elle sur
  // ta nuque) en boucle jusqu'à release(escaped)
  grab() {
    if (!this.unlocked || !this.ctx || this.grabbed) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    this.duck(0.25, 1.5);
    // le choc
    this.tone(this.master, t, 'sine', 60, 30, 0.35, 0.6, 0.003);
    this.burst(this.master, t, 0.2, 'lowpass', 500, 0.7, 0.5);
    this.burst(this.master, t, 0.12, 'bandpass', 2500, 0.7, 0.2);
    // ton souffle coupé
    this.breathNoise(this.master, t + 0.05, 0.35, 900, 1500, 0.12);
    // la lutte, en boucle
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.3);
    g.connect(this.master);
    const srcs = [];
    const src = (n) => (srcs.push(n), n);
    // les vêtements qui frottent, par saccades
    const scuff = this.gainNode(0.3);
    src(this.osc('square', 5.3)).connect(this.gainNode(0.2)).connect(scuff.gain);
    src(this.osc('sine', 2.1)).connect(this.gainNode(0.12)).connect(scuff.gain);
    src(this.longNoise()).connect(this.filt('bandpass', 350, 0.8)).connect(scuff).connect(this.gainNode(0.25)).connect(g);
    // son souffle à elle : des expirations rauques, et un grondement grave
    const huff = this.gainNode(0.25);
    const hl = src(this.osc('sine', 0.9));
    hl.connect(this.gainNode(0.25)).connect(huff.gain);
    src(this.longNoise()).connect(this.filt('bandpass', 600, 2)).connect(huff).connect(this.gainNode(0.12)).connect(g);
    const growl = this.gainNode(0.2);
    hl.connect(this.gainNode(0.2)).connect(growl.gain);
    src(this.osc('sawtooth', 55)).connect(this.filt('lowpass', 300, 1)).connect(growl).connect(this.gainNode(0.06)).connect(g);
    for (const s of srcs) s.start(t, s.buffer ? Math.random() * 4 : 0);
    this.grabbed = { g, srcs, scuff };
    this.caption('[struggling]');
    this.caption('[heavy breathing]');
  }

  // un à-coup de lutte (à chaque pression) : un choc, un froissement, un grognement
  struggle() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.005;
    if (t - (this.struggleT || 0) < 0.07) return;
    this.struggleT = t;
    this.tone(this.master, t, 'sine', 90, 45, 0.12, 0.3, 0.004);
    this.burst(this.master, t, 0.1, 'bandpass', 2500, 0.7, 0.18);
    // le grognement : une voix rauque, un « hmf »
    const vo = this.osc('sawtooth', 145);
    vo.frequency.setValueAtTime(rnd(130, 160), t);
    vo.frequency.exponentialRampToValueAtTime(100, t + 0.15);
    const e = c.createGain();
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    const mix = this.gainNode(1);
    for (const [f, q, v] of [[500, 6, 1], [1000, 7, 0.5]]) vo.connect(this.filt('bandpass', f, q)).connect(this.gainNode(v * 3)).connect(mix);
    mix.connect(this.shaper(3.2)).connect(e).connect(this.master);
    vo.start(t);
    vo.stop(t + 0.18);
    if (this.grabbed) {
      const s = this.grabbed.scuff.gain;
      s.setTargetAtTime(0.9, t, 0.01);
      s.setTargetAtTime(0.3, t + 0.1, 0.08);
    }
  }

  // la lutte se termine : escaped, tu t'arraches (bousculade, souffle qui revient) ; sinon tout se tait (la mort suit)
  release(escaped = false) {
    if (!this.grabbed) return;
    this.stopGrab();
    if (!escaped) return;
    const t = this.ctx.currentTime + 0.01;
    this.tone(this.master, t, 'sine', 80, 40, 0.2, 0.35, 0.003);
    this.burst(this.master, t, 0.15, 'bandpass', 2200, 0.7, 0.2);
    this.breathNoise(this.master, t + 0.1, 0.5, 900, 450, 0.1);
    for (let i = 0; i < 3; i++) {
      this.breathNoise(this.master, t + 0.7 + i * 0.45, 0.2, 600, 1100, 0.05);
      this.breathNoise(this.master, t + 0.92 + i * 0.45, 0.22, 900, 500, 0.06);
    }
  }

  stopGrab() {
    const G = this.grabbed;
    if (!G || !this.ctx) return;
    const t = this.ctx.currentTime;
    G.g.gain.cancelScheduledValues(t);
    G.g.gain.setTargetAtTime(0, t, 0.06);
    for (const s of G.srcs) {
      try {
        s.stop(t + 0.5);
      } catch (e) {
        /* déjà arrêté */
      }
    }
    this.grabbed = null;
  }

  // --- La bande VHS (hors du monde : bus ui) ---

  // le magnétoscope qui s'arrête (écran de mort) : le moteur qui ralentit, le galet qui se relâche, le souffle qui meurt
  tapeStop() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    const mo = this.osc('sawtooth', 180);
    mo.frequency.setValueAtTime(180, t);
    mo.frequency.exponentialRampToValueAtTime(25, t + 1.1);
    const mg = c.createGain();
    mg.gain.setValueAtTime(0.06, t);
    mg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1);
    mo.connect(this.filt('bandpass', 600, 1)).connect(mg).connect(this.ui);
    mo.start(t);
    mo.stop(t + 1.15);
    const n = this.noise();
    const ng = c.createGain();
    ng.gain.setValueAtTime(0.04, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 1.3);
    const lp = this.filt('lowpass', 6000, 0.7);
    lp.frequency.setValueAtTime(6000, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 1.2);
    n.connect(lp).connect(ng).connect(this.ui);
    n.start(t);
    n.stop(t + 1.35);
    this.burst(this.ui, t + 1, 0.08, 'lowpass', 600, 0.8, 0.25);
    this.burst(this.ui, t + 1, 0.02, 'bandpass', 2500, 3, 0.12);
  }

  // un raccord de bande (transition de niveau) : un claquement, un trou, un souffle qui ondule
  tapeSplice() {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime + 0.01;
    this.burst(this.ui, t, 0.006, 'highpass', 1000, 0.7, 0.25);
    this.tone(this.ui, t, 'sine', 4000, 1500, 0.02, 0.03, 0.001);
    this.tone(this.ui, t, 'sine', 70, 40, 0.06, 0.12, 0.002);
    const k = t + 0.06;
    const n = this.noise();
    const bp = this.filt('bandpass', 3000, 0.6);
    const lfo = this.osc('sine', 3.5);
    lfo.connect(this.gainNode(1200)).connect(bp.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, k);
    g.gain.exponentialRampToValueAtTime(0.06, k + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, k + 0.7);
    n.connect(bp).connect(g).connect(this.ui);
    for (const s of [n, lfo]) {
      s.start(k);
      s.stop(k + 0.75);
    }
  }

  // la neige d'une télé sans signal, en continu (on) ou qui s'éteint (off)
  noSignal(on) {
    if (!this.unlocked || !this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    if (on && !this.snow) {
      const g = this.gainNode(0);
      g.connect(this.ui);
      const n = this.longNoise();
      const fl = this.gainNode(0.85);
      const lfo = this.osc('square', 13);
      lfo.connect(this.gainNode(0.12)).connect(fl.gain);
      n.connect(this.filt('highpass', 500, 0.7)).connect(this.filt('lowpass', 9000, 0.7)).connect(fl).connect(g);
      n.start(t, Math.random() * 4);
      lfo.start(t);
      g.gain.setTargetAtTime(0.035, t, 0.05);
      this.snow = { g, srcs: [n, lfo] };
    } else if (!on && this.snow) {
      const S = this.snow;
      S.g.gain.setTargetAtTime(0, t, 0.08);
      for (const s of S.srcs) s.stop(t + 1);
      this.snow = null;
    }
  }

  // Une cassette qu'on lit (environ 15 s) : le bouton Play, le souffle de la bande, la ronflette du secteur, et une
  // voix lointaine, inintelligible, qui pleure par moments (pleurage de la bande). stopLore() l'interrompt.
  // Rend la durée.
  loreTape(sec = 15) {
    if (!this.unlocked || !this.ctx) return 0;
    this.stopLore();
    const c = this.ctx;
    const t = c.currentTime + 0.05;
    const end = t + sec;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.4);
    g.gain.setValueAtTime(1, end - 0.3);
    g.gain.linearRampToValueAtTime(0.0001, end);
    g.connect(this.ui);
    const endG = this.gainNode(1);
    endG.connect(this.ui);
    const srcs = [];
    const src = (n) => (srcs.push(n), n);
    // le bouton Play
    this.burst(this.ui, t, 0.05, 'lowpass', 700, 0.8, 0.25);
    this.burst(this.ui, t, 0.015, 'bandpass', 2600, 3, 0.15);
    // le souffle de la bande, la ronflette
    src(this.longNoise()).connect(this.filt('highpass', 2600, 0.7)).connect(this.gainNode(0.02)).connect(g);
    src(this.osc('sine', 60)).connect(this.gainNode(0.01)).connect(g);
    src(this.osc('sine', 180)).connect(this.gainNode(0.004)).connect(g);
    // la voix : une dent de scie et du souffle dans trois formants, qui sautent d'une voyelle à l'autre
    const vo = src(this.osc('sawtooth', 118));
    src(this.osc('sine', 0.55)).connect(this.gainNode(2.2)).connect(vo.frequency);
    src(this.osc('sine', 6.5)).connect(this.gainNode(1.2)).connect(vo.frequency);
    const br = src(this.longNoise());
    const vmix = this.gainNode(1);
    const forms = [[8, 1], [10, 0.5], [12, 0.25]].map(([q, v], j) => {
      const b = this.filt('bandpass', VOWELS[0][j], q);
      vo.connect(b);
      br.connect(this.gainNode(0.25)).connect(b);
      b.connect(this.gainNode(v * 3)).connect(vmix);
      return b;
    });
    const gate = this.gainNode(0);
    const vl = this.gainNode(0.09);
    vmix.connect(this.filt('highpass', 350, 0.7)).connect(this.filt('lowpass', 2200, 0.7)).connect(this.shaper(3.2)).connect(gate).connect(vl).connect(g);
    // une petite pièce autour de la voix
    const dl = c.createDelay(0.2);
    dl.delayTime.value = 0.09;
    const fb = this.gainNode(0.3);
    vl.connect(dl).connect(fb).connect(dl);
    dl.connect(this.gainNode(0.5)).connect(g);
    let k = t + 1.2;
    while (k < end - 1.5) {
      let f = rnd(105, 135);
      for (let i = 0, n = 3 + Math.floor(Math.random() * 6); i < n && k < end - 1.5; i++) {
        const len = rnd(0.1, 0.28);
        const v = VOWELS[Math.floor(Math.random() * VOWELS.length)];
        forms.forEach((b, j) => b.frequency.setTargetAtTime(v[j] * rnd(0.92, 1.08), k, 0.025));
        vo.frequency.setTargetAtTime(f * rnd(0.9, 1.15), k, 0.04);
        gate.gain.setTargetAtTime(rnd(0.6, 1), k, 0.02);
        gate.gain.setTargetAtTime(0, k + len, 0.03);
        k += len + rnd(0.03, 0.1);
        f *= 0.97;
      }
      k += rnd(0.5, 1.4);
    }
    // deux ou trois trous de bande
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const d = t + rnd(2, sec - 2);
      vl.gain.setTargetAtTime(0.01, d, 0.01);
      vl.gain.setTargetAtTime(0.09, d + rnd(0.05, 0.12), 0.02);
    }
    for (const s of srcs) s.start(t, s.buffer ? Math.random() * 4 : 0);
    for (const s of srcs) s.stop(end + 0.1);
    // le bouton Stop en fin de bande
    this.burst(endG, end, 0.05, 'lowpass', 600, 0.8, 0.2);
    this.burst(endG, end, 0.015, 'bandpass', 2400, 3, 0.12);
    this.lore = { g, endG, srcs, end };
    this.caption('[tape playing]');
    return sec;
  }

  stopLore() {
    const L = this.lore;
    if (!L || !this.ctx) return;
    this.lore = null;
    const t = this.ctx.currentTime;
    if (t >= L.end) return;
    for (const g of [L.g, L.endG]) {
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0, t, 0.04);
    }
    for (const s of L.srcs) {
      try {
        s.stop(t + 0.3);
      } catch (e) {
        /* déjà arrêté */
      }
    }
    // le bouton Stop
    this.burst(this.ui, t + 0.01, 0.05, 'lowpass', 600, 0.8, 0.2);
  }
}
