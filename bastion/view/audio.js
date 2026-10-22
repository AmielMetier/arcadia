// Interface de Bastion Clash (navigateur uniquement).
// Effets sonores et musique synthétisés (WebAudio).
'use strict';

/* ============================================================================
   AUDIO SYNTHÉTISÉ + BANDE-SON ORCHESTRALE RTS ÉPIQUE (WebAudio)
   ============================================================================ */
const Sfx = (() => {
  // Bus audio : musique et effets ont chacun leur volume, et un gain maître coupe TOUT (bouton / touche M)
  const SAVE_KEY = 'bastion_audio_v2';
  const cfg = { musicOn: true, sfxOn: true, musicVol: 0.55, sfxVol: 0.8, allMuted: false };
  try { Object.assign(cfg, JSON.parse(localStorage.getItem(SAVE_KEY) || '{}')); } catch (e) { /* stockage indisponible */ }
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(cfg)); } catch (e) { /* ignoré */ } };

  let ctx = null, musicTimer = null;
  let stepIdx = 0, nextNoteTime = 0, noiseBuf = null, masterComp = null;
  let masterGain = null, musicBus = null, sfxBus = null;
  let lastMineSound = 0, lastShotSound = 0, lastBoomSound = 0;
  let combatUntil = 0, musicMode = 'calm', pendingMode = 'calm';

  function applyGains() {
    if (!ctx || !masterGain) return;
    const t = ctx.currentTime;
    masterGain.gain.setTargetAtTime(cfg.allMuted ? 0 : 1, t, 0.03);
    musicBus.gain.setTargetAtTime(cfg.musicOn ? cfg.musicVol * 0.9 : 0, t, 0.05);
    sfxBus.gain.setTargetAtTime(cfg.sfxOn ? cfg.sfxVol : 0, t, 0.03);
  }

  function ensureContext() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    if (ctx && !masterComp) {
      masterComp = ctx.createDynamicsCompressor();
      masterComp.threshold.setValueAtTime(-14, ctx.currentTime);
      masterComp.knee.setValueAtTime(12, ctx.currentTime);
      masterComp.ratio.setValueAtTime(5, ctx.currentTime);
      masterComp.attack.setValueAtTime(0.003, ctx.currentTime);
      masterComp.release.setValueAtTime(0.16, ctx.currentTime);
      masterGain = ctx.createGain();
      musicBus = ctx.createGain();
      sfxBus = ctx.createGain();
      musicBus.connect(masterComp);
      sfxBus.connect(masterComp);
      masterComp.connect(masterGain);
      masterGain.connect(ctx.destination);
      applyGains();
    }
    if (ctx && !noiseBuf) {
      const len = ctx.sampleRate * 1.0;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < len; i++) {
        const white = Math.random() * 2 - 1;
        lastOut = (lastOut * 0.45) + (white * 0.55);
        data[i] = lastOut;
      }
    }
    return ctx;
  }

  function dest() { return sfxBus || (ctx ? ctx.destination : null); }
  function mdest() { return musicBus || (ctx ? ctx.destination : null); }

  function ensure() {
    if (cfg.allMuted || !cfg.sfxOn) return null;
    return ensureContext();
  }

  function tone(freq, dur, type = 'triangle', vol = 0.11, slide = 0) {
    const c = ensure(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    const t = c.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(dest());
    o.start(t); o.stop(t + dur);
  }

  // --- INSTRUMENTS DE LA MUSIQUE ÉPIQUE RTS (Ré mineur / 132 BPM) ---
  function mtof(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function playKick(c, t, accent = false) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(accent ? 145 : 120, t);
    o.frequency.exponentialRampToValueAtTime(34, t + 0.19);
    g.gain.setValueAtTime(accent ? 0.22 : 0.16, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g); g.connect(mdest());
    o.start(t); o.stop(t + 0.23);
  }

  function playSnare(c, t, vol = 0.09) {
    if (noiseBuf) {
      const src = c.createBufferSource();
      src.buffer = noiseBuf;
      const flt = c.createBiquadFilter();
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(1650, t);
      const g = c.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      src.connect(flt); flt.connect(g); g.connect(mdest());
      src.start(t); src.stop(t + 0.15);
    }
    const o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(195, t);
    o.frequency.exponentialRampToValueAtTime(92, t + 0.09);
    og.gain.setValueAtTime(vol * 0.7, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(og); og.connect(mdest());
    o.start(t); o.stop(t + 0.11);
  }

  function playHat(c, t, open = false) {
    if (!noiseBuf) return;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const flt = c.createBiquadFilter();
    flt.type = 'highpass';
    flt.frequency.setValueAtTime(6500, t);
    const g = c.createGain();
    const dur = open ? 0.14 : 0.045;
    g.gain.setValueAtTime(open ? 0.045 : 0.026, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(mdest());
    src.start(t); src.stop(t + dur + 0.01);
  }

  function playBass(c, t, midi, dur) {
    const f = mtof(midi);
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    const flt = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'square';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f * 0.5, t);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(680, t);
    flt.frequency.exponentialRampToValueAtTime(190, t + dur);
    g.gain.setValueAtTime(0.085, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(mdest());
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.01); o2.stop(t + dur + 0.01);
  }

  function playBrassChord(c, t, midis, dur) {
    const flt = c.createBiquadFilter(), g = c.createGain();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(420, t);
    flt.frequency.linearRampToValueAtTime(1450, t + dur * 0.35);
    flt.frequency.exponentialRampToValueAtTime(520, t + dur);
    g.gain.setValueAtTime(0.002, t);
    g.gain.linearRampToValueAtTime(0.048, t + 0.08);
    g.gain.setValueAtTime(0.042, t + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    flt.connect(g); g.connect(mdest());

    for (const m of midis) {
      for (const det of [-4.5, 4.5]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(mtof(m), t);
        o.detune.setValueAtTime(det, t);
        o.connect(flt);
        o.start(t); o.stop(t + dur + 0.02);
      }
    }
  }

  function playHeroLead(c, t, midi, dur) {
    const f = mtof(midi);
    const o1 = c.createOscillator(), o2 = c.createOscillator();
    const flt = c.createBiquadFilter(), g = c.createGain();
    o1.type = 'sawtooth'; o2.type = 'triangle';
    o1.frequency.setValueAtTime(f, t);
    o2.frequency.setValueAtTime(f, t);
    o1.detune.setValueAtTime(6, t);
    o2.detune.setValueAtTime(-6, t);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(2400, t);
    g.gain.setValueAtTime(0.002, t);
    g.gain.linearRampToValueAtTime(0.068, t + 0.025);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o1.connect(flt); o2.connect(flt); flt.connect(g); g.connect(mdest());
    o1.start(t); o2.start(t);
    o1.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }

  // Partition épique sur 64 pas (4 mesures en 4/4 à 132 BPM : Dm -> Bb -> Gm -> A7 / Dm -> F -> C -> A7)
  const CHORDS_8BARS = [
    [50, 57, 62, 65], // Dm
    [46, 53, 58, 62], // Bb
    [43, 50, 55, 58], // Gm
    [45, 52, 57, 61], // A7
    [50, 57, 62, 65], // Dm
    [41, 48, 53, 57], // F
    [48, 55, 60, 64], // C
    [45, 52, 57, 61], // A7
  ];
  const BASS_ROOTS = [38, 34, 31, 33, 38, 41, 36, 33];

  // Mélodie héroïque style Terran / Command & Conquer (par pas de 1/16e sur 128 pas = 8 mesures)
  const LEAD_SEQ = {
    0: [62, 3], 3: [65, 3], 6: [69, 6], 12: [67, 2], 14: [65, 2],
    16: [64, 6], 22: [62, 4], 26: [58, 6],
    32: [62, 3], 35: [65, 3], 38: [67, 6], 44: [70, 4],
    48: [69, 10], 58: [64, 3], 61: [67, 3],
    64: [69, 4], 68: [74, 6], 74: [72, 3], 77: [69, 3],
    80: [65, 6], 86: [69, 4], 90: [72, 6],
    96: [70, 4], 100: [67, 4], 104: [64, 4], 108: [67, 4],
    112: [69, 12], 124: [61, 4],
  };

  // --- MUSIQUE CALME (exploration / économie) : nappes, arpège, basse ronde ---
  const CALM_CHORDS = [
    [50, 57, 60, 65, 69], // Dm9
    [46, 53, 57, 62, 65], // Bbmaj7
    [43, 50, 53, 58, 62], // Gm9
    [45, 52, 55, 61, 64], // A7sus
  ];
  function playPad(c, t, midis, dur) {
    const flt = c.createBiquadFilter(), g = c.createGain();
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(380, t);
    flt.frequency.linearRampToValueAtTime(900, t + dur * 0.5);
    flt.frequency.linearRampToValueAtTime(420, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.034, t + dur * 0.3);
    g.gain.setValueAtTime(0.03, t + dur * 0.75);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.4);
    flt.connect(g); g.connect(mdest());
    for (const m of midis) {
      for (const det of [-7, 7]) {
        const o = c.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(mtof(m), t);
        o.detune.setValueAtTime(det, t);
        o.connect(flt);
        o.start(t); o.stop(t + dur + 0.45);
      }
    }
  }
  function playPluck(c, t, midi, vol = 0.035) {
    const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(mtof(midi), t);
    flt.type = 'lowpass';
    flt.frequency.setValueAtTime(3200, t);
    flt.frequency.exponentialRampToValueAtTime(600, t + 0.5);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + 0.6);
    o.connect(flt); flt.connect(g); g.connect(mdest());
    o.start(t); o.stop(t + 0.62);
  }
  function playSub(c, t, midi, dur) {
    const o = c.createOscillator(), g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(mtof(midi), t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.07, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(mdest());
    o.start(t); o.stop(t + dur + 0.02);
  }
  const ARP_SHAPE = [0, 2, 4, 3, 1, 3, 4, 2];

  function scheduleCalmStep(c, t, s, stepDur) {
    const bar = Math.floor(s / 16) % 8, inBar = s % 16;
    const chord = CALM_CHORDS[Math.floor(bar / 2) % 4];
    if (inBar === 0 && bar % 2 === 0) playPad(c, t, chord, stepDur * 32);
    if (inBar === 0) playSub(c, t, chord[0] - 12, stepDur * 15);
    if (inBar === 8 && bar % 2 === 1) playSub(c, t, chord[0] - 5, stepDur * 7);
    if (inBar % 2 === 0) {
      const idx = ARP_SHAPE[(inBar / 2 + bar) % 8];
      const note = chord[idx] + 12;
      playPluck(c, t, note, inBar === 0 ? 0.04 : 0.028);
      if (inBar % 4 === 0) playPluck(c, t + stepDur * 3, note + 12, 0.012);   // écho
    }
    if (inBar === 0) playKick(c, t, false);
    if (inBar === 8 && bar % 2 === 1) playKick(c, t, false);
    if (inBar % 4 === 2) playHat(c, t, false);
  }

  function scheduleBattleStep(c, t, s, stepDur) {
    const bar = Math.floor(s / 16) % 8, inBar = s % 16;
    if (inBar === 0) playBrassChord(c, t, CHORDS_8BARS[bar], stepDur * 15.5);
    const root = BASS_ROOTS[bar];
    if (inBar % 2 === 0 || inBar === 3 || inBar === 11 || inBar === 15) {
      const pitch = (inBar === 6 || inBar === 14) ? root + 12 : (inBar === 15 ? root + 7 : root);
      playBass(c, t, pitch, stepDur * 1.6);
    }
    if (inBar === 0 || inBar === 6 || inBar === 8 || inBar === 11) playKick(c, t, inBar === 0 || inBar === 8);
    if (inBar === 4 || inBar === 12) playSnare(c, t, 0.095);
    else if (bar % 2 === 1 && (inBar === 14 || inBar === 15)) playSnare(c, t, 0.065);
    if (inBar % 2 === 0) playHat(c, t, inBar === 10);
    const note = LEAD_SEQ[s % 128];
    if (note) playHeroLead(c, t, note[0], stepDur * note[1]);
  }

  function scheduleMusic() {
    if (!cfg.musicOn || cfg.allMuted) return;
    const c = ensureContext();
    if (!c || c.state !== 'running') return;
    const stepDur = 60 / 132 / 4;
    if (nextNoteTime < c.currentTime) nextNoteTime = c.currentTime + 0.04;
    pendingMode = performance.now() < combatUntil ? 'battle' : 'calm';
    while (nextNoteTime < c.currentTime + 0.25) {
      // Changement d'ambiance seulement en début de mesure (transition propre)
      if (stepIdx % 16 === 0 && pendingMode !== musicMode) {
        musicMode = pendingMode;
        stepIdx = 0;
        if (musicMode === 'battle') playSnare(c, nextNoteTime, 0.08);
      }
      if (musicMode === 'battle') scheduleBattleStep(c, nextNoteTime, stepIdx, stepDur);
      else scheduleCalmStep(c, nextNoteTime, stepIdx, stepDur);
      nextNoteTime += stepDur;
      stepIdx++;
    }
  }

  function startMusic() {
    const c = ensureContext();
    if (c && nextNoteTime < c.currentTime) nextNoteTime = c.currentTime + 0.05;
    if (!musicTimer) musicTimer = setInterval(scheduleMusic, 80);
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function chime(notes, type = 'triangle', vol = 0.07, gap = 0.07, len = 0.16, bus = dest) {
    const c = ensureContext(); if (!c || cfg.allMuted) return;
    const t = c.currentTime;
    notes.forEach((f, i) => {
      const o = c.createOscillator(), g = c.createGain(), flt = c.createBiquadFilter();
      o.type = type;
      o.frequency.setValueAtTime(f, t + i * gap);
      flt.type = 'lowpass'; flt.frequency.setValueAtTime(3600, t);
      g.gain.setValueAtTime(0.0001, t + i * gap);
      g.gain.linearRampToValueAtTime(vol, t + i * gap + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, t + i * gap + len);
      o.connect(flt); flt.connect(g); g.connect(bus());
      o.start(t + i * gap); o.stop(t + i * gap + len + 0.02);
    });
  }

  return {
    get muted() { return cfg.allMuted; },
    get settings() { return { ...cfg }; },
    get musicPlaying() { return cfg.musicOn && !cfg.allMuted; },
    toggleAll() { cfg.allMuted = !cfg.allMuted; ensureContext(); applyGains(); save(); return cfg.allMuted; },
    setMusicOn(v) { cfg.musicOn = !!v; ensureContext(); applyGains(); if (cfg.musicOn) startMusic(); save(); },
    setSfxOn(v) { cfg.sfxOn = !!v; ensureContext(); applyGains(); save(); },
    setMusicVol(v) { cfg.musicVol = clamp(v, 0, 1); ensureContext(); applyGains(); save(); },
    setSfxVol(v) { cfg.sfxVol = clamp(v, 0, 1); ensureContext(); applyGains(); save(); },
    // Appelé à chaque échange de tirs visible : la musique passe en mode bataille ~14 s
    combat() { combatUntil = performance.now() + 14000; },
    startMusic,
    stopMusic,
    wake() {
      ensureContext();
      applyGains();
      if (!musicTimer) startMusic();
    },
    victory() { stopMusic(); chime([587, 740, 880, 1175, 1480], 'sawtooth', 0.06, 0.13, 0.55, mdest); setTimeout(() => chime([294, 440, 587, 880], 'triangle', 0.07, 0.0, 1.6, mdest), 700); },
    defeat() { stopMusic(); chime([440, 415, 370, 294], 'sawtooth', 0.05, 0.22, 0.6, mdest); setTimeout(() => chime([147, 220, 294], 'triangle', 0.08, 0.0, 1.8, mdest), 900); },
    // Alerte « Base attaquée » : sirène à deux tons
    alert() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      for (let k = 0; k < 3; k++) {
        const o = c.createOscillator(), g = c.createGain(), flt = c.createBiquadFilter();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(k % 2 ? 620 : 880, t + k * 0.18);
        flt.type = 'lowpass'; flt.frequency.setValueAtTime(1800, t);
        g.gain.setValueAtTime(0.0001, t + k * 0.18);
        g.gain.linearRampToValueAtTime(0.07, t + k * 0.18 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + k * 0.18 + 0.17);
        o.connect(flt); flt.connect(g); g.connect(dest());
        o.start(t + k * 0.18); o.stop(t + k * 0.18 + 0.19);
      }
    },
    // Tour de Détection : impulsion radar
    radar() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      for (const [d, v] of [[0, 0.09], [0.22, 0.04], [0.44, 0.018]]) {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(1320, t + d);
        o.frequency.exponentialRampToValueAtTime(990, t + d + 0.16);
        g.gain.setValueAtTime(v, t + d);
        g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.2);
        o.connect(g); g.connect(dest());
        o.start(t + d); o.stop(t + d + 0.22);
      }
    },
    ping() { chime([1568, 2093], 'sine', 0.05, 0.05, 0.12); },
    done() { chime([523, 659, 784, 1047], 'triangle', 0.07, 0.07, 0.22); },
    click() { chime([1800], 'square', 0.018, 0, 0.03); },
    ack(kind = 'marine') {
      // « Bien reçu » radio : petit motif différent selon le type d'unité
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const base = kind === 'scv' ? 420 : (kind === 'tank' || kind === 'siege' || kind === 'titan') ? 230 : (kind === 'dropship' || kind === 'medivac') ? 560 : 330;
      [1, 1.25, 1.12].forEach((m, i) => {
        const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(base * m, t + i * 0.045);
        flt.type = 'bandpass'; flt.frequency.setValueAtTime(1400, t); flt.Q.setValueAtTime(2.5, t);
        g.gain.setValueAtTime(0.03, t + i * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.045 + 0.05);
        o.connect(flt); flt.connect(g); g.connect(dest());
        o.start(t + i * 0.045); o.stop(t + i * 0.045 + 0.06);
      });
      if (noiseBuf) {
        const src = c.createBufferSource(), flt = c.createBiquadFilter(), g = c.createGain();
        src.buffer = noiseBuf;
        flt.type = 'highpass'; flt.frequency.setValueAtTime(2500, t);
        g.gain.setValueAtTime(0.02, t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        src.connect(flt); flt.connect(g); g.connect(dest());
        src.start(t + 0.14); src.stop(t + 0.21);
      }
    },
    canShoot() { const n = performance.now(); if (n - lastShotSound < 45) return false; lastShotSound = n; return true; },
    canBoom() { const n = performance.now(); if (n - lastBoomSound < 70) return false; lastBoomSound = n; return true; },

    // --- BRUITAGES SCI-FI RTS IMMERSIFS HAUTE FIDÉLITÉ ---
    // Tir fusil d'assaut Gauss des Marines : détonation percutante + bruit de culasse métallique
    shoot() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const pitchMod = 0.92 + Math.random() * 0.16;

      // 1. Détonation supersonique (crack de bouche filtré)
      if (noiseBuf) {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const flt = c.createBiquadFilter();
        flt.type = 'bandpass';
        flt.frequency.setValueAtTime(2200 * pitchMod, t);
        flt.Q.setValueAtTime(2.2, t);
        const g = c.createGain();
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.042);
        src.connect(flt); flt.connect(g); g.connect(dest());
        src.start(t); src.stop(t + 0.045);
      }

      // 2. Choc de culasse mécanique (corps percutant basse fréquence)
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(260 * pitchMod, t);
      o.frequency.exponentialRampToValueAtTime(65 * pitchMod, t + 0.038);
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      o.connect(g); g.connect(dest());
      o.start(t); o.stop(t + 0.042);
    },

    // Tir Plasma / Roquette Maraudeur / Canons Thor : balayage résonant + onde de choc plasma
    plasma() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;

      // 1. Sifflement d'énergie concentrée
      const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(1150, t);
      o.frequency.exponentialRampToValueAtTime(175, t + 0.13);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(2600, t);
      flt.frequency.exponentialRampToValueAtTime(240, t + 0.13);
      flt.Q.setValueAtTime(4.5, t);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(flt); flt.connect(g); g.connect(dest());
      o.start(t); o.stop(t + 0.15);

      // 2. Impact sub-basse
      const sub = c.createOscillator(), subG = c.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(140, t);
      sub.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      subG.gain.setValueAtTime(0.13, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + 0.17);
      sub.connect(subG); subG.connect(dest());
      sub.start(t); sub.stop(t + 0.18);
    },

    // Explosion cinéma (unités et bâtiments) : sub-kick + grondement de flammes et débris
    boom(big = false) {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const dur = big ? 0.65 : 0.32;

      // 1. Onde de choc sub-graves (ressentie dans les oreilles)
      const sub = c.createOscillator(), subG = c.createGain();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(big ? 105 : 145, t);
      sub.frequency.exponentialRampToValueAtTime(26, t + dur * 0.85);
      subG.gain.setValueAtTime(big ? 0.34 : 0.22, t);
      subG.gain.exponentialRampToValueAtTime(0.001, t + dur);
      sub.connect(subG); subG.connect(dest());
      sub.start(t); sub.stop(t + dur + 0.02);

      // 2. Débris, flammes et souffle (filtre passe-bas descendant sur bruit rose)
      if (noiseBuf) {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const flt = c.createBiquadFilter(), g = c.createGain();
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(big ? 2800 : 1800, t);
        flt.frequency.exponentialRampToValueAtTime(80, t + dur);
        g.gain.setValueAtTime(big ? 0.28 : 0.16, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(flt); flt.connect(g); g.connect(dest());
        src.start(t); src.stop(t + dur + 0.02);
      }

      // 3. Déflagration métallique pour grandes explosions
      if (big) {
        const crunch = c.createOscillator(), crG = c.createGain();
        crunch.type = 'sawtooth';
        crunch.frequency.setValueAtTime(65, t);
        crunch.frequency.exponentialRampToValueAtTime(22, t + 0.38);
        crG.gain.setValueAtTime(0.18, t);
        crG.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        crunch.connect(crG); crG.connect(dest());
        crunch.start(t); crunch.stop(t + 0.42);
      }
    },

    // Mode Siège du Char d'Assaut : servomoteur hydraulique + verrouillage de blindage lourd
    siege() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;

      // Servomoteur ascendant
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(210, t);
      o.frequency.exponentialRampToValueAtTime(510, t + 0.18);
      g.gain.setValueAtTime(0.085, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      o.connect(g); g.connect(dest());
      o.start(t); o.stop(t + 0.21);

      // Décharge pneumatique
      if (noiseBuf) {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const flt = c.createBiquadFilter(), ng = c.createGain();
        flt.type = 'bandpass';
        flt.frequency.setValueAtTime(2100, t + 0.08);
        flt.frequency.exponentialRampToValueAtTime(650, t + 0.26);
        ng.gain.setValueAtTime(0.001, t);
        ng.gain.setValueAtTime(0.09, t + 0.08);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
        src.connect(flt); flt.connect(ng); ng.connect(dest());
        src.start(t + 0.08); src.stop(t + 0.29);
      }

      // Verrouillage mécanique métallique (clank)
      setTimeout(() => tone(165, 0.14, 'square', 0.13, -45), 130);
    },

    // Stimpack des Marines : injection pneumatique sifflante + montée d'adrénaline
    stim() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;

      // Pschitt pneumatique haute pression
      if (noiseBuf) {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const flt = c.createBiquadFilter(), g = c.createGain();
        flt.type = 'highpass';
        flt.frequency.setValueAtTime(3600, t);
        g.gain.setValueAtTime(0.13, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
        src.connect(flt); flt.connect(g); g.connect(dest());
        src.start(t); src.stop(t + 0.16);
      }

      // Fréquence ascendante d'adrénaline
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(280, t);
      o.frequency.exponentialRampToValueAtTime(740, t + 0.22);
      og.gain.setValueAtTime(0.11, t);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
      o.connect(og); og.connect(dest());
      o.start(t); o.stop(t + 0.25);
    },

    // Ordre de déplacement tactique : bip radio haute technologie double impulsion
    order() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const o1 = c.createOscillator(), g1 = c.createGain();
      o1.type = 'sine';
      o1.frequency.setValueAtTime(784, t);
      g1.gain.setValueAtTime(0.08, t);
      g1.gain.exponentialRampToValueAtTime(0.001, t + 0.032);
      o1.connect(g1); g1.connect(dest());
      o1.start(t); o1.stop(t + 0.035);

      const o2 = c.createOscillator(), g2 = c.createGain();
      o2.type = 'sine';
      o2.frequency.setValueAtTime(1046, t + 0.04);
      g2.gain.setValueAtTime(0.09, t + 0.04);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o2.connect(g2); g2.connect(dest());
      o2.start(t + 0.04); o2.stop(t + 0.085);
    },

    // Ordre d'attaque : confirmation militaire agressive et tranchante
    attack() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(988, t);
      o.frequency.exponentialRampToValueAtTime(740, t + 0.065);
      flt.type = 'lowpass';
      flt.frequency.setValueAtTime(2600, t);
      g.gain.setValueAtTime(0.1, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
      o.connect(flt); flt.connect(g); g.connect(dest());
      o.start(t); o.stop(t + 0.075);
    },

    // Déploiement de bâtiment : accord technologique ascendant + vérin pneumatique
    build() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const notes = [622, 784, 932];
      notes.forEach((f, idx) => {
        const o = c.createOscillator(), g = c.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t + idx * 0.045);
        g.gain.setValueAtTime(0.075, t + idx * 0.045);
        g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.045 + 0.085);
        o.connect(g); g.connect(dest());
        o.start(t + idx * 0.045); o.stop(t + idx * 0.045 + 0.09);
      });
    },

    // Unité prête au combat / Hangar ouvert : carillon martial noble
    spawn() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const notes = [587, 880, 1175];
      notes.forEach((f, idx) => {
        const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(f, t + idx * 0.05);
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(2400, t + idx * 0.05);
        g.gain.setValueAtTime(0.065, t + idx * 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, t + idx * 0.05 + 0.12);
        o.connect(flt); flt.connect(g); g.connect(dest());
        o.start(t + idx * 0.05); o.stop(t + idx * 0.05 + 0.13);
      });
    },

    // Scanner Comsat : impulsion sonar holographique avec écho scintillant
    scan() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(460, t);
      o.frequency.exponentialRampToValueAtTime(2400, t + 0.14);
      o.frequency.exponentialRampToValueAtTime(700, t + 0.38);
      flt.type = 'bandpass';
      flt.frequency.setValueAtTime(1600, t);
      flt.Q.setValueAtTime(3.5, t);
      g.gain.setValueAtTime(0.12, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
      o.connect(flt); flt.connect(g); g.connect(dest());
      o.start(t); o.stop(t + 0.45);
    },

    // Récolte de minéraux / étincelle de soudure VCS : crépitement laser discret
    mine() {
      const now = performance.now();
      if (now - lastMineSound < 130) return;
      lastMineSound = now;
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      if (noiseBuf) {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const flt = c.createBiquadFilter(), g = c.createGain();
        flt.type = 'bandpass';
        flt.frequency.setValueAtTime(2900 + Math.random() * 400, t);
        flt.Q.setValueAtTime(3.0, t);
        g.gain.setValueAtTime(0.045, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
        src.connect(flt); flt.connect(g); g.connect(dest());
        src.start(t); src.stop(t + 0.045);
      }
      tone(1350 + Math.random() * 150, 0.035, 'triangle', 0.03, -150);
    },

    // Action impossible / Ravitaillement bloqué : double buzzer grave feutré
    error() {
      const c = ensure(); if (!c) return;
      const t = c.currentTime;
      [0, 0.09].forEach((offset) => {
        const o = c.createOscillator(), flt = c.createBiquadFilter(), g = c.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(135, t + offset);
        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(460, t + offset);
        g.gain.setValueAtTime(0.08, t + offset);
        g.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.065);
        o.connect(flt); flt.connect(g); g.connect(dest());
        o.start(t + offset); o.stop(t + offset + 0.07);
      });
    },
  };
})();
