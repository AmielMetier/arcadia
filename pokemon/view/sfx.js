// pokemon/view/sfx.js
// Bruitages officiels Pokémon (PokéRogue & PokeAPI Cries) avec préchargement audio

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
    this.preload();
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
      // Cloner pour permettre plusieurs sons simultanés sans coupure
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
