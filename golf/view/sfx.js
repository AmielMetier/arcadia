// Birdie Party — sons : enregistrements libres (CC0, voir sounds/LICENSE.txt) joués en WebAudio.
// Ambiance de nature en boucle selon le décor, vent qui souffle selon sa force, frappes de club, rebonds,
// foule (applaudissements, « oh ! », « oh non… ») et petits jingles quand la balle s'arrête.
// Le contexte audio naît au premier geste du joueur (unlock) et se ferme dans dispose().
const FILES = [
  'hit-drive', 'hit-iron', 'hit-chip', 'hit-putt', 'swoosh', 'cup-rattle', 'cup-drop', 'cup', 'bounce-grass1', 'bounce-grass2', 'bounce-sand', 'tree', 'trunk',
  'splash', 'splash-small', 'applause-big', 'applause-big2', 'clap', 'cheer', 'pleased', 'gasp', 'ooh1', 'ooh2', 'ooh3', 'aww', 'aww2',
  'jingle-good', 'jingle-good2', 'jingle-par', 'jingle-neutral', 'jingle-bad', 'jingle-bad2', 'jingle-bogey', 'jingle-great', 'jingle-birdie', 'jingle-water', 'jingle-hole',
  'ui-click', 'ui-select', 'ui-confirm', 'ui-tick', 'ui-switch', 'ui-open', 'ui-close', 'ui-card',
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

export class Sfx {
  constructor(base) {
    this.base = base; this.ctx = null; this.buf = new Map(); this.muted = false;
    this.amb = { name: null, src: null, gain: null };
    try { this.muted = localStorage.getItem('golf_mute') === '1'; } catch (e) {}
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(c.destination);
    this.fx = c.createGain(); this.fx.gain.value = 1; this.fx.connect(this.master);
    this.bed = c.createGain(); this.bed.gain.value = 0.55; this.bed.connect(this.master);
    // bruit blanc partagé (vent)
    const len = c.sampleRate * 2, b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = b; src.loop = true;
    this.windF = c.createBiquadFilter(); this.windF.type = 'bandpass'; this.windF.frequency.value = 380; this.windF.Q.value = 0.6;
    this.windG = c.createGain(); this.windG.gain.value = 0;
    src.connect(this.windF).connect(this.windG).connect(this.bed); src.start();
    this.windT = 0;
    for (const f of FILES) this.load(f);
    if (this.amb.want) this.ambience(this.amb.want);
  }
  load(f) {
    if (!this.ctx || this.buf.has(f)) return Promise.resolve(this.buf.get(f));
    const p = fetch(`${this.base}${f}.mp3`).then((r) => r.arrayBuffer()).then((a) => this.ctx.decodeAudioData(a)).then((buf) => { this.buf.set(f, buf); return buf; }).catch(() => null);
    this.buf.set(f, null);
    return p;
  }
  setMuted(m) {
    this.muted = m;
    try { localStorage.setItem('golf_mute', m ? '1' : '0'); } catch (e) {}
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05);
  }
  play(name, { vol = 1, rate = 1, delay = 0, bus } = {}) {
    const c = this.ctx, b = this.buf.get(name); if (!c || !b) return null;
    const s = c.createBufferSource(); s.buffer = b; s.playbackRate.value = rate;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(g).connect(bus || this.fx); s.start(c.currentTime + delay);
    return s;
  }

  // ---------------------------------------------------------------- ambiance (boucle selon le décor) et vent
  ambience(theme) {
    const name = `amb-${theme}`;
    this.amb.want = theme;
    if (!this.ctx || this.amb.name === name) return;
    const c = this.ctx, old = this.amb;
    if (old.gain) { old.gain.gain.setTargetAtTime(0, c.currentTime, 0.6); const s = old.src; setTimeout(() => { try { s.stop(); } catch (e) {} }, 3000); }
    this.amb = { name, want: theme, src: null, gain: null };
    this.load(name).then((buf) => {
      if (!buf || this.amb.name !== name || !this.ctx) return;
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const g = c.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(1, c.currentTime, 0.8);
      s.connect(g).connect(this.bed); s.start();
      this.amb.src = s; this.amb.gain = g;
    });
  }
  // le vent souffle plus ou moins fort ; avec quelques rafales
  wind(speed, dt) {
    if (!this.ctx) return;
    this.windT += dt;
    const k = Math.min(1, speed / 8), gust = 0.75 + 0.25 * Math.sin(this.windT * 0.7) * Math.sin(this.windT * 0.23 + 1);
    this.windG.gain.setTargetAtTime(0.14 * k * k * gust, this.ctx.currentTime, 0.3);
    this.windF.frequency.setTargetAtTime(260 + 320 * k * gust, this.ctx.currentTime, 0.3);
  }
  // pendant un vol, l'ambiance s'efface un peu pour laisser la place à la foule
  duck(on) { if (this.ctx) this.bed.gain.setTargetAtTime(on ? 0.3 : 0.55, this.ctx.currentTime, 0.4); }

  // ---------------------------------------------------------------- coups
  hit(kind, power) {
    const v = 0.5 + 0.5 * Math.min(1, power);
    if (kind === 'putter') this.play('hit-putt', { vol: 0.5 + 0.5 * power });
    else if (kind === 'wood') this.play('hit-drive', { vol: v, rate: 0.96 + power * 0.08 });
    else if (kind === 'wedge') this.play('hit-chip', { vol: v });
    else this.play('hit-iron', { vol: v, rate: 0.95 + power * 0.08 });
  }
  whoosh(power) { this.play('swoosh', { vol: 0.25 + 0.5 * Math.min(1, power), rate: 0.85 + 0.35 * Math.min(1, power) }); }
  bounce(surf, v) {
    if (v < 1) return;
    const vol = Math.max(0.12, Math.min(0.9, v / 14));
    if (surf === 'bunker') this.play('bounce-sand', { vol });
    else this.play(Math.random() < 0.5 ? 'bounce-grass1' : 'bounce-grass2', { vol: vol * 0.8, rate: surf === 'green' ? 1.15 : 1 });
  }
  splash(big = true) { this.play(big ? 'splash' : 'splash-small', { vol: 0.9 }); }
  cup() { this.play('cup-rattle', { vol: 1 }); this.play('cup-drop', { vol: 0.7, delay: 0.08 }); }
  lip() { this.play('cup', { vol: 0.5, rate: 1.3 }); }
  ui(name) { this.play(`ui-${name}`, { vol: 0.55 }); }

  // ---------------------------------------------------------------- foule et jingles
  ooh() { this.play(pick(['ooh1', 'ooh2', 'ooh3']), { vol: 0.75, bus: this.fx }); }
  // réaction quand la balle s'arrête : kind = holeinone, eagle, birdie, par, bogey, worse, green, great, fairway, rough, bunker, trees, water, ob, close, lip, miss
  react(kind) {
    const J = (n, d = 0.15) => this.play(n, { vol: 0.7, delay: d });
    switch (kind) {
      case 'holeinone': this.play('cheer', { vol: 1 }); this.play('applause-big', { vol: 0.9, delay: 0.4 }); J('jingle-birdie', 0.2); break;
      case 'eagle': this.play('cheer', { vol: 0.9 }); this.play('applause-big2', { vol: 0.85, delay: 0.3 }); J('jingle-birdie'); break;
      case 'birdie': this.play('applause-big', { vol: 0.85 }); J('jingle-birdie'); break;
      case 'par': this.play('clap', { vol: 0.8 }); J('jingle-par'); break;
      case 'bogey': this.play('clap', { vol: 0.45 }); J('jingle-bogey'); break;
      case 'worse': J('jingle-bad2'); break;
      case 'great': this.play('pleased', { vol: 0.7 }); J(Math.random() < 0.5 ? 'jingle-great' : 'jingle-good2'); break;
      case 'close': this.play(pick(['ooh1', 'ooh2']), { vol: 0.8 }); this.play('clap', { vol: 0.5, delay: 0.5 }); J('jingle-good'); break;
      case 'green': J('jingle-good'); this.play('clap', { vol: 0.35, delay: 0.3 }); break;
      case 'fairway': J('jingle-neutral'); break;
      case 'rough': J('jingle-neutral'); break;
      case 'bunker': this.play('aww2', { vol: 0.6 }); J('jingle-bad'); break;
      case 'trees': this.play('gasp', { vol: 0.55 }); J('jingle-bad2'); break;
      case 'water': this.play('aww', { vol: 0.8, delay: 0.3 }); J('jingle-water', 0.5); break;
      case 'ob': this.play('gasp', { vol: 0.7 }); J('jingle-water', 0.4); break;
      case 'lip': this.play('aww', { vol: 0.8 }); break;
      case 'miss': this.play('aww2', { vol: 0.5 }); break;
    }
  }
  holeStart() { this.play('jingle-hole', { vol: 0.6 }); }
  dispose() { try { this.ctx && this.ctx.close(); } catch (e) {} this.ctx = null; }
}
