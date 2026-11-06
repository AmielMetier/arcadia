// Fief Maudit : les sons. Enregistrements libres (CC0) déjà dans Arcadia : coups dans le bois et pas d'Island Rush,
// arbre et ambiance de campagne de Birdie Party (crédits dans royale/sounds/LICENSE.txt et golf/sounds/LICENSE.txt).
// Ce qui manque est synthétisé (WebAudio). Le contexte audio naît au premier geste.
const R = '../royale/sounds/', G = '../golf/sounds/';
const BANK = {
  hache: [R + 'impact-bois-1.mp3', R + 'impact-bois-2.mp3', R + 'impact-bois-3.mp3'],
  souffle: [G + 'swoosh.mp3'],
  arbre: [G + 'tree.mp3'], tronc: [G + 'trunk.mp3'],
  craque: [R + 'grince-1.mp3', R + 'grince-2.mp3'],
  sol: [R + 'impact-sol-1.mp3', R + 'impact-sol-2.mp3', R + 'impact-sol-3.mp3'],
  herbe: [1, 2, 3, 4, 5].map((i) => R + `pas-herbe-${i}.mp3`),
  gravier: [1, 2, 3, 4, 5].map((i) => R + `pas-gravier-${i}.mp3`),
  bois: [1, 2, 3, 4, 5].map((i) => R + `pas-bois-${i}.mp3`),
  ui: [G + 'ui-confirm.mp3'],
};

export class Sfx {
  constructor() { this.ctx = null; this.buf = new Map(); this.muted = false; this.amb = null; try { this.muted = localStorage.getItem('fief_mute') === '1'; } catch (e) {} }
  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    this.out = this.ctx.createGain(); this.out.gain.value = this.muted ? 0 : 0.9; this.out.connect(this.ctx.destination);
    for (const [k, list] of Object.entries(BANK)) list.forEach((u, i) => fetch(u).then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((d) => { if (!this.buf.has(k)) this.buf.set(k, []); this.buf.get(k)[i] = d; }).catch(() => {}));
    // ambiance de campagne en boucle
    fetch(G + 'amb-campagne.mp3').then((r) => r.arrayBuffer()).then((b) => this.ctx.decodeAudioData(b)).then((d) => {
      const s = this.ctx.createBufferSource(), g = this.ctx.createGain(); s.buffer = d; s.loop = true; g.gain.value = 0.35; s.connect(g).connect(this.out); s.start(); this.amb = g;
    }).catch(() => {});
  }
  toggleMute() { this.muted = !this.muted; try { localStorage.setItem('fief_mute', this.muted ? '1' : '0'); } catch (e) {} if (this.out) this.out.gain.value = this.muted ? 0 : 0.9; return this.muted; }
  // vol : 0..1 ; dist : mètres jusqu'à la caméra (atténue)
  play(k, { vol = 1, rate = 1, dist = 0, delay = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const list = (this.buf.get(k) || []).filter(Boolean);
    const att = 1 / (1 + Math.max(0, dist - 4) * 0.12);
    if (!list.length) return this.synth(k, vol * att, delay);
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = list[Math.floor(Math.random() * list.length)];
    s.playbackRate.value = rate * (0.94 + Math.random() * 0.12);
    g.gain.value = vol * att;
    s.connect(g).connect(this.out); s.start(this.ctx.currentTime + delay);
  }
  // repli : un coup sourd
  synth(k, vol, delay) {
    const c = this.ctx, t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(k === 'ui' ? 660 : 140, t); o.frequency.exponentialRampToValueAtTime(k === 'ui' ? 990 : 60, t + 0.12);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.25);
  }
}
