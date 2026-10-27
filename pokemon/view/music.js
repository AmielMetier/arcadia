// pokemon/view/music.js
// Lecteur de musique de combat officiel (Darude Sandstorm & Thème de Cynthia)

class BattleMusicPlayer {
  constructor() {
    this.audio = null;
    this.musicEnabled = true;
    this.currentTrack = 'sandstorm';
    this.volume = 0.35;
  }

  getTrackPath(trackName) {
    if (trackName === 'cynthia') return 'assets/bgm_cynthia.mp3';
    if (trackName === 'trainer') return 'assets/bgm_trainer.mp3';
    return 'assets/bgm_sandstorm.mp3'; // Thème Sandstorm culte par défaut
  }

  start(trackName = 'sandstorm') {
    if (!this.musicEnabled) return;
    this.currentTrack = trackName;
    const path = this.getTrackPath(trackName);

    if (this.audio) {
      if (this.audio.src.includes(path) && !this.audio.paused) return;
      this.stop();
    }

    try {
      this.audio = new Audio(path);
      this.audio.loop = true;
      DDVolume.media(this.audio, 'music', this.volume);
      this.audio.play().catch(() => {
        // En attente d'interaction utilisateur (navigateur autoplay policy)
        const unlock = () => {
          if (this.audio && this.musicEnabled) {
            this.audio.play().catch(() => {});
          }
          window.removeEventListener('click', unlock);
          window.removeEventListener('keydown', unlock);
        };
        window.addEventListener('click', unlock, { once: true });
        window.addEventListener('keydown', unlock, { once: true });
      });
    } catch (e) {}
  }

  stop() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (e) {}
      this.audio = null;
    }
  }

  toggle() {
    this.musicEnabled = !this.musicEnabled;
    if (this.musicEnabled) {
      this.start(this.currentTrack);
    } else {
      this.stop();
    }
    return this.musicEnabled;
  }

  isPlaying() {
    return Boolean(this.audio && !this.audio.paused);
  }
}

export const battleMusic = new BattleMusicPlayer();
