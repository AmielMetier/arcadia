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
    if (trackName === 'cynthia') return 'assets/bgm_cynthia.mp3?v=3.35';
    if (trackName === 'trainer') return 'assets/bgm_trainer.mp3?v=3.35';
    return 'assets/bgm_sandstorm.mp3?v=3.35'; // Thème Sandstorm culte par défaut
  }

  // Un seul lecteur <audio> pour toute la partie : une fois débloqué par un clic, il le reste
  // (Safari et Chrome refusent de lancer un NOUVEAU lecteur sans clic : c'est ce qui coupait Sandstorm au début du combat).
  player() {
    if (this.audio) return this.audio;
    const a = new Audio();
    a.preload = 'auto';
    a.addEventListener('ended', () => {
      if (!this.wanted || this.audio !== a) return;
      a.currentTime = this.audioTrack === 'sandstorm' ? 7.8 : 0;   // Sandstorm : on repart après l'intro
      a.play().catch(() => {});
    });
    DDVolume.media(a, 'music', this.volume);
    this.audio = a;
    const unlock = () => { if (this.wanted && this.musicEnabled && a.paused && a.src) a.play().catch(() => {}); };
    for (const ev of ['pointerdown', 'click', 'keydown', 'touchend']) window.addEventListener(ev, unlock, true);
    return a;
  }

  start(trackName = 'sandstorm') {
    this.wanted = true;
    this.currentTrack = trackName;
    if (!this.musicEnabled) return;
    const a = this.player();
    if (this.audioTrack !== trackName) {
      this.audioTrack = trackName;
      a.src = new URL(this.getTrackPath(trackName), import.meta.url.replace(/view\/music\.js.*$/, '')).href;
      a.currentTime = 0;
    }
    if (a.paused) a.play().catch(() => {});
  }

  stop() { this.wanted = false; this.halt(); }

  halt() {
    if (this.audio) { try { this.audio.pause(); } catch (e) {} }
    this.audioTrack = null;
  }

  isPlaying() {
    return Boolean(this.audio && !this.audio.paused);
  }
}

export const battleMusic = new BattleMusicPlayer();
