// pokemon/view/sfx.js
// Bruitages officiels Pokémon (PokéRogue & PokeAPI Cries) + Synthétiseur WebAudio rétro (Centre Pokémon, Level Up, Capture)

const SFX_FILES = {
  hit: 'assets/sfx_hit.wav',
  hit_strong: 'assets/sfx_hit_strong.wav',
  hit_weak: 'assets/sfx_hit_weak.wav',
  faint: 'assets/sfx_faint.wav',
  low_hp: 'assets/sfx_low_hp.wav',
  switch: 'assets/sfx_switch.wav',
  beam: 'assets/sfx_beam.wav',
  victory: 'assets/sfx_victory.wav'
};

class SoundManager {
  constructor() {
    this.enabled = true;
    this.audioPool = new Map();
    this.cryCache = new Map();
    this.ctx = null;
    this.preload();
  }

  getAudioContext() {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  preload() {
    if (typeof window === 'undefined') return;
    for (const [key, path] of Object.entries(SFX_FILES)) {
      try {
        const audio = new Audio(path);
        audio.preload = 'auto';
        this.audioPool.set(key, audio);
      } catch (e) {}
    }
  }

  playTone(freq, durationMs, delayMs = 0, type = 'triangle', gainVal = 0.18) {
    if (!this.enabled) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;
    try {
      const start = ctx.currentTime + delayMs / 1000;
      const dur = durationMs / 1000;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(gainVal, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + dur + 0.02);
    } catch (e) {}
  }

  // Jingle emblématique du Centre Pokémon (B-B-B-G#-E)
  playHeal() {
    if (!this.enabled) return;
    const notes = [
      { f: 987.77, d: 160, t: 0 },    // B5
      { f: 987.77, d: 160, t: 180 },  // B5
      { f: 987.77, d: 160, t: 360 },  // B5
      { f: 830.61, d: 160, t: 540 },  // G#5
      { f: 1318.51, d: 420, t: 720 }, // E6
    ];
    for (const n of notes) {
      this.playTone(n.f, n.d, n.t, 'sine', 0.22);
    }
  }

  // Fanfare de montée de niveau / évolution
  playLevelUp() {
    if (!this.enabled) return;
    const notes = [
      { f: 587.33, d: 110, t: 0 },    // D5
      { f: 587.33, d: 110, t: 120 },  // D5
      { f: 587.33, d: 110, t: 240 },  // D5
      { f: 880.00, d: 380, t: 360 },  // A5
    ];
    for (const n of notes) {
      this.playTone(n.f, n.d, n.t, 'square', 0.14);
    }
  }

  // Petit carillon d'objet ramassé / Citron cueilli
  playItem() {
    if (!this.enabled) return;
    this.playTone(659.25, 100, 0, 'sine', 0.2);   // E5
    this.playTone(880.00, 220, 110, 'sine', 0.2); // A5
  }

  // Oscillation de Poké Ball
  playBallWobble(step = 0) {
    if (!this.enabled) return;
    const base = 320 + step * 40;
    this.playTone(base, 70, 0, 'sine', 0.18);
    this.playTone(base * 1.25, 80, 75, 'sine', 0.15);
  }

  // Alerte d'entrée en combat sauvage / dresseur
  playEncounter() {
    if (!this.enabled) return;
    this.playTone(440, 80, 0, 'sawtooth', 0.15);
    this.playTone(554.37, 80, 85, 'sawtooth', 0.15);
    this.playTone(659.25, 80, 170, 'sawtooth', 0.15);
    this.playTone(880, 180, 255, 'sawtooth', 0.18);
  }

  playCry(pokemonId) {
    if (!this.enabled || !pokemonId) return;
    try {
      let audio = this.cryCache.get(pokemonId);
      if (!audio) {
        audio = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${pokemonId}.ogg`);
        audio.volume = 0.55;
        this.cryCache.set(pokemonId, audio);
      }
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch (e) {}
  }

  playAudioFile(key, volume = 0.6) {
    if (!this.enabled) return;
    try {
      const src = SFX_FILES[key];
      if (!src) return;
      const sound = new Audio(src);
      sound.volume = volume;
      sound.play().catch(() => {});
    } catch (e) {}
  }

  playHit(effectiveness = 1) {
    if (effectiveness > 1) {
      this.playAudioFile('hit_strong', 0.75);
    } else if (effectiveness > 0 && effectiveness < 1) {
      this.playAudioFile('hit_weak', 0.55);
    } else {
      this.playAudioFile('hit', 0.65);
    }
  }

  playBeam() {
    this.playAudioFile('beam', 0.6);
  }

  play(type) {
    if (!this.enabled) return;
    switch (type) {
      case 'hit':
        this.playAudioFile('hit', 0.65);
        break;
      case 'supereffective':
        this.playAudioFile('hit_strong', 0.75);
        break;
      case 'faint':
        this.playAudioFile('faint', 0.7);
        break;
      case 'switch':
        this.playAudioFile('switch', 0.6);
        break;
      case 'low_hp':
        this.playAudioFile('low_hp', 0.5);
        break;
      case 'beam':
        this.playAudioFile('beam', 0.6);
        break;
      case 'victory':
        this.playAudioFile('victory', 0.75);
        break;
      case 'heal':
        this.playHeal();
        break;
      case 'levelup':
        this.playLevelUp();
        break;
      case 'item':
        this.playItem();
        break;
      case 'wobble':
        this.playBallWobble();
        break;
      case 'encounter':
        this.playEncounter();
        break;
      default:
        this.playAudioFile('hit', 0.5);
    }
  }

  toggle() {
    this.enabled = !this.enabled;
    return this.enabled;
  }
}

export const sfx = new SoundManager();
