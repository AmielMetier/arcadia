// pokemon/view/music.js
// Lecteur de musique de combat officiel (Darude Sandstorm & Thème de Cynthia)

class BattleMusicPlayer {
  constructor() {
    this.audio = null;
    this.wanted = false; // le combat veut sa musique
    this.currentTrack = 'sandstorm';
    this.volume = 0.35;
    // curseur « Musique » des réglages à 0 : elle s'arrête ; relevé : elle reprend
    DDVolume.on(() => { if (!this.musicEnabled) this.halt(); else if (this.wanted && !this.isPlaying()) this.start(this.currentTrack); });
  }

  get musicEnabled() { return DDVolume.get('music') > 0; }

  getTrackPath(trackName) {
    if (trackName === 'cynthia') return 'assets/bgm_cynthia.mp3';
    if (trackName === 'trainer') return 'assets/bgm_trainer.mp3';
    return 'assets/bgm_sandstorm.mp3'; // Thème Sandstorm culte par défaut
  }

  start(trackName = 'sandstorm') {
    this.wanted = true;
    this.currentTrack = trackName;
    if (!this.musicEnabled) return;
    const path = this.getTrackPath(trackName);

    if (this.audio) {
      // même morceau déjà lancé (même s'il est encore en train de charger, donc « en pause ») : on n'y touche pas.
      // Avant, chaque rafraîchissement de l'écran le supprimait et le relançait : il n'avait jamais le temps de démarrer.
      if (this.audioTrack === trackName) { if (this.audio.paused && this.audio.readyState >= 2 && !this.blocked) this.audio.play().catch(() => {}); return; }
      this.halt();
    }

    try {
      this.audio = new Audio(path);
      this.audioTrack = trackName; this.blocked = false;
      this.audio.preload = 'auto';
      // Sandstorm : version longue (≈ 2 min 30) avec une intro ; en boucle, on repart après l'intro (pas de coupure)
      const loopAt = trackName === 'sandstorm' ? 7.8 : 0;
      this.audio.loop = !loopAt;
      if (loopAt) {
        const a = this.audio;
        a.addEventListener('ended', () => { if (this.audio === a && this.wanted) { a.currentTime = loopAt; a.play().catch(() => {}); } });
      }
      DDVolume.media(this.audio, 'music', this.volume);
      this.audio.play().catch(() => {
        this.blocked = true;
        // En attente d'interaction utilisateur (navigateur autoplay policy)
        const unlock = () => {
          if (this.audio && this.musicEnabled) {
            this.blocked = false;
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

  stop() { this.wanted = false; this.halt(); }

  halt() {
    if (this.audio) {
      try {
        this.audio.pause();
        this.audio.currentTime = 0;
      } catch (e) {}
      this.audio = null; this.audioTrack = null;
    }
  }

  isPlaying() {
    return Boolean(this.audio && !this.audio.paused);
  }
}

export const battleMusic = new BattleMusicPlayer();
