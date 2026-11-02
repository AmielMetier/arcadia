// Site Noir : le son. De vrais enregistrements (sitenoir/sounds/, tous CC0) pour les pas, la lampe, le monstre et les fonds ; le reste est synthétisé (WebAudio) et sert de repli tant qu'un fichier n'est pas chargé.
// Tout est placé dans l'espace : volume et aigus selon la distance, gauche/droite selon le regard, étouffé derrière un mur, et une réverbération qui dépend de la zone.
// Le fond (ambiances, cœur, tension) passe par le curseur Musique ; le reste par le curseur Effets.
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const BASE = new URL('../sounds/', import.meta.url).href;
// nom du son → fichiers
const BANK = {
  beton: ['pas-beton', 6], sourd: ['pas-sourd', 4], metal: ['pas-metal', 5], escalier: ['pas-escalier', 5], gravier: ['pas-gravier', 5], monstre: ['pas-monstre', 3],
  lampeOn: ['lampe-on'], lampeOff: ['lampe-off'], clank: ['metal', 3], porte: ['porte', 2], grince: ['grince', 3], gemit: ['gemit', 3], enfants: ['enfants'],
  souffle: ['souffle'], grogne: ['grogne', 4], grondement: ['grondement', 3], hurlement: ['hurlement'], cri: ['cri'], coeur: ['coeur'],
  fondDehors: ['fond-dehors'], fondBatiment: ['fond-batiment'], fondSousSol: ['fond-sous-sol'], fondChasse: ['fond-chasse'],
};
// bruits lointains, tirés au sort selon l'endroit : [son, poids]
const FAR = {
  dehors: [['clank', 1], ['grince', 1]],
  batiment: [['grince', 4], ['clank', 3], ['gemit', 2], ['enfants', 0.6], ['grondement', 0.8]],
  soussol: [['clank', 4], ['grince', 2], ['grondement', 2], ['gemit', 1.5]],
};

export class Sfx {
  constructor() { this.ctx = null; this.L = { x: 0, y: 0, z: 0, yaw: 0 }; this.heartT = 0; this.emfT = 0; this.alive = true; this.bank = {}; this.layers = {}; this.farT = 12; this.breathT = 0; this.occluded = null; this.monT = 3; this.last = {}; }
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = this.ctx = new AC();
    this.fx = window.DDVolume ? DDVolume.gain(c, 'fx') : c.createGain();
    this.music = window.DDVolume ? DDVolume.gain(c, 'music') : c.createGain();
    this.fx.connect(c.destination); this.music.connect(c.destination);
    // bruit réutilisable
    const n = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = n.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noiseBuf = n;
    // l'écho du bâtiment : une réponse faite de bruit qui s'éteint, un peu plus sourde sur la fin
    const len = Math.floor(c.sampleRate * 1.9), ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const o = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / len, k = 0.5 - t * 0.42; lp += ((Math.random() * 2 - 1) - lp) * k; o[i] = lp * (1 - t) ** 3.2; } }
    this.rev = c.createConvolver(); this.rev.buffer = ir; this.revG = c.createGain(); this.revG.gain.value = 0.25; this.rev.connect(this.revG); this.revG.connect(this.fx);
    // bourdon de fond : deux graves qui battent, et un souffle filtré
    this.drone = c.createGain(); this.drone.gain.value = 0; this.drone.connect(this.music);
    for (const [f, g] of [[46, 0.5], [46.7, 0.45], [92.5, 0.12]]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; const v = c.createGain(); v.gain.value = g * 0.2; o.connect(lp); lp.connect(v); v.connect(this.drone); o.start(); }
    const s = c.createBufferSource(); s.buffer = n; s.loop = true; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6; const sv = c.createGain(); sv.gain.value = 0.03; s.connect(bp); bp.connect(sv); sv.connect(this.drone); s.start();
    // générateur
    this.genG = c.createGain(); this.genG.gain.value = 0; this.genP = c.createStereoPanner(); this.genG.connect(this.genP); this.genP.connect(this.fx);
    const go = c.createOscillator(); go.type = 'square'; go.frequency.value = 58; const glp = c.createBiquadFilter(); glp.type = 'lowpass'; glp.frequency.value = 260; go.connect(glp); glp.connect(this.genG); go.start();
    this.genOsc = go;
    // grésillement des lampes de secours toutes proches
    this.humG = c.createGain(); this.humG.gain.value = 0; this.humP = c.createStereoPanner(); this.humG.connect(this.humP); this.humP.connect(this.fx);
    const ho = c.createOscillator(); ho.type = 'sawtooth'; ho.frequency.value = 100; const hb = c.createBiquadFilter(); hb.type = 'bandpass'; hb.frequency.value = 1400; hb.Q.value = 2.5; ho.connect(hb); hb.connect(this.humG); ho.start();
    // les fichiers arrivent après le premier clic : en attendant, les sons synthétisés font le travail
    for (const [k, [f, count]] of Object.entries(BANK)) {
      this.bank[k] = [];
      for (let i = 1; i <= (count || 1); i++) fetch(`${BASE}${f}${count ? `-${i}` : ''}.mp3`).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(f)))).then((b) => c.decodeAudioData(b)).then((a) => { if (this.ctx) this.bank[k].push(a); }).catch(() => {});
    }
  }
  listener(x, y, z, yaw) { Object.assign(this.L, { x, y, z, yaw }); }
  // gain et position stéréo d'un son placé
  place(x, y, z, range = 28) {
    const L = this.L;
    if (x === undefined) return { g: 1, pan: 0, d: 0 };
    const dx = x - L.x, dz = z - L.z, dy = (y ?? L.y) - L.y, d = Math.hypot(dx, dz, dy * 1.6);
    const g = clamp(1 - d / range, 0, 1) ** 1.6;
    const fx = -Math.sin(L.yaw), fz = -Math.cos(L.yaw), rx = Math.cos(L.yaw), rz = -Math.sin(L.yaw);
    return { g, d, pan: d < 0.5 ? 0 : clamp((dx * rx + dz * rz) / Math.max(d, 1), -0.9, 0.9), behind: (dx * fx + dz * fz) < 0 };
  }
  tone(f0, f1, dur, type, vol, pan, dest, when = 0) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain(), p = c.createStereoPanner();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; o.connect(g); g.connect(p); p.connect(dest || this.fx); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, freq, q, vol, pan, type = 'bandpass', dest, when = 0, f1) {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    s.buffer = this.noiseBuf; s.loop = true; f.type = type; f.frequency.setValueAtTime(freq, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur); f.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + Math.min(0.015, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    p.pan.value = pan; s.connect(f); f.connect(g); g.connect(p); p.connect(dest || this.fx); s.start(t, Math.random()); s.stop(t + dur + 0.02);
  }
  // un enregistrement, choisi au hasard sans répéter le précédent. Rend false s'il n'est pas (encore) chargé.
  sample(name, { vol = 1, pan = 0, rate = 1, cut = 20000, wet = 1, dest, when = 0 } = {}) {
    const list = this.bank[name];
    if (!list || !list.length) return false;
    let i = Math.floor(Math.random() * list.length);
    if (list.length > 1 && i === this.last[name]) i = (i + 1) % list.length;
    this.last[name] = i;
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), p = c.createStereoPanner();
    s.buffer = list[i]; s.playbackRate.value = rate;
    f.type = 'lowpass'; f.frequency.value = cut; g.gain.value = vol; p.pan.value = pan;
    s.connect(f); f.connect(g); g.connect(p); p.connect(dest || this.fx);
    if (wet > 0 && this.rev) { const w = c.createGain(); w.gain.value = wet * 0.55; g.connect(w); w.connect(this.rev); }
    s.start(c.currentTime + when);
    return true;
  }
  // même chose, placé dans l'espace : les aigus se perdent avec la distance, et derrière un mur il ne reste que le grave
  at(name, P, o, v, x, y, z) {
    const wall = x !== undefined && this.occluded && this.occluded(x, y, z);
    const cut = wall ? 620 : clamp(16000 * (1 - P.d / 34) ** 2, 1100, 18000);
    return this.sample(name, { ...o, vol: v * (wall ? 0.62 : 1), pan: P.pan, cut, wet: 0.4 + clamp(P.d / 18, 0, 1) * 0.9 });
  }
  play(name, o = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const P = this.place(o.x, o.y, o.z, o.range), v = (o.vol ?? 1) * P.g, pan = P.pan;
    if (v < 0.004) return;
    const r = (a = 0.06) => 1 + (Math.random() * 2 - 1) * a;
    const S = (n, k = 1, rate = r(0.04)) => this.at(n, P, { rate }, v * k, o.x, o.y, o.z);
    switch (name) {
      // pas : la matière dépend du sol ; en course c'est plus fort, plus rapide, et on entend les vêtements
      case 'step': {
        const surf = o.surf || 'beton', k = o.crouch ? 0.28 : o.run ? 1 : 0.62;
        if (!S(surf, k, r(0.05) * (o.run ? 1.12 : o.crouch ? 0.9 : 1))) { this.noise(0.09, surf === 'sourd' ? 240 : surf === 'metal' ? 900 : 420, 1, 0.22 * v, pan); this.tone(80, 45, 0.07, 'sine', 0.2 * v, pan); }
        if (o.run) { this.noise(0.11, 2300, 0.8, 0.035 * v, pan, 'bandpass', null, 0.02); this.tone(90, 48, 0.09, 'sine', 0.26 * v, pan); }
        break;
      }
      // lui : une chair lourde, ralentie, et un choc qu'on sent au ventre
      case 'mstep': S('monstre', 0.8, 0.62 * r(0.07)); this.tone(58, 28, 0.26, 'sine', 0.8 * v, pan); this.noise(0.14, 170, 1, 0.26 * v, pan); break;
      case 'door': if (!S('porte', 0.55, (o.open ? 1 : 0.86) * r(0.05))) this.noise(0.55, 700, 2, 0.16 * v, pan, 'bandpass', null, 0, 220); this.noise(0.5, 620, 2, 0.08 * v, pan, 'bandpass', null, 0, 240); this.tone(90, 55, 0.25, 'triangle', 0.3 * v, pan, null, 0.46); break;
      case 'liftdoor': this.noise(0.9, 500, 3, 0.15 * v, pan, 'bandpass', null, 0, 1100); break;
      case 'deny': this.tone(170, 120, 0.13, 'square', 0.1 * v, pan); this.tone(150, 110, 0.16, 'square', 0.1 * v, pan, null, 0.16); break;
      case 'unlock': this.tone(620, 640, 0.07, 'square', 0.1 * v, pan); this.tone(930, 950, 0.1, 'square', 0.1 * v, pan, null, 0.09); this.noise(0.08, 1800, 4, 0.2 * v, pan, 'bandpass', null, 0.2); break;
      case 'pick': this.noise(0.08, 1400, 2, 0.16 * v, pan); this.tone(520, 860, 0.1, 'triangle', 0.14 * v, pan, null, 0.04); break;
      case 'search': this.noise(0.25, 1100, 1.4, 0.13 * v, pan); break;
      case 'empty': this.noise(0.14, 700, 2, 0.1 * v, pan); break;
      case 'found': for (const [i, f] of [440, 554, 740].entries()) this.tone(f, f, 0.26, 'triangle', 0.15 * v, pan, null, i * 0.09); break;
      // lampe : le clic du bouton, puis le filament (allumage) ou la coupure sèche (extinction)
      case 'torch':
        if (!S(o.on ? 'lampeOn' : 'lampeOff', o.on ? 0.8 : 0.7, 1)) this.noise(0.03, o.on ? 3400 : 2400, 3, 0.25 * v, pan);
        if (o.on) this.noise(0.14, 5200, 1.2, 0.012 * v, pan, 'bandpass', null, 0.03);
        break;
      case 'flicker': this.noise(0.03, 4200, 3, 0.05 * v, pan); break;
      case 'reload': this.noise(0.06, 2400, 3, 0.2 * v, pan); this.noise(0.06, 1600, 3, 0.2 * v, pan, 'bandpass', null, 0.12); break;
      case 'flash': this.tone(2600, 7200, 0.3, 'sine', 0.07 * v, pan); this.noise(0.07, 3800, 2, 0.45 * v, pan, 'highpass', null, 0.26); break;
      case 'proof': for (const [i, f] of [660, 880, 1320].entries()) this.tone(f, f, 0.24, 'sine', 0.13 * v, 0, null, i * 0.1); break;
      case 'locker': S('clank', 0.5, 0.8); this.noise(0.2, 500, 3, 0.2 * v, pan); this.tone(130, 70, 0.2, 'square', 0.1 * v, pan); break;
      case 'bang': S('clank', 1, 0.6); this.noise(0.28, 300, 1, 0.75 * v, pan); this.tone(110, 40, 0.34, 'square', 0.4 * v, pan); break;
      case 'swing': this.noise(0.26, 900, 1, 0.34 * v, pan, 'bandpass', null, 0, 2600); S('grogne', 0.3, 1.3); break;
      case 'hit': this.noise(0.17, 500, 1, 0.8 * v, pan); this.tone(180, 45, 0.24, 'sawtooth', 0.45 * v, pan); break;
      case 'down': this.tone(240, 70, 0.9, 'sawtooth', 0.28 * v, pan); this.noise(0.5, 300, 1, 0.5 * v, pan); S('cri', 0.5, 0.75); break;
      case 'roar': if (!S('hurlement', 1.1, 0.92)) { const d = 1.5; this.tone(95, 42, d, 'sawtooth', 0.5 * v, pan); this.tone(142, 60, d, 'sawtooth', 0.3 * v, pan); this.tone(61, 33, d, 'square', 0.28 * v, pan); this.noise(d, 900, 0.8, 0.55 * v, pan, 'bandpass', null, 0, 240); } this.tone(44, 30, 2.2, 'sine', 0.8 * v, pan); break;
      case 'growl': if (!S('grogne', 0.9, 0.8 * r(0.1))) { this.tone(70, 48, 0.8, 'sawtooth', 0.3 * v, pan); this.noise(0.8, 500, 0.8, 0.22 * v, pan, 'bandpass', null, 0, 200); } break;
      case 'breath': if (!S('souffle', 0.8, 0.72 * r(0.08))) this.noise(1.2, 380, 0.9, 0.14 * v, pan, 'bandpass', null, 0, 190); break;
      // la main sur l'épaule : cri, dissonance et coup au ventre
      case 'scare': this.sample('cri', { vol: 1, rate: 0.9, wet: 0.5 }); this.sample('hurlement', { vol: 0.8, rate: 1.25, wet: 0.4 }); this.tone(1760, 1600, 0.8, 'sawtooth', 0.09, 0); this.tone(1865, 1700, 0.8, 'sawtooth', 0.09, 0); this.tone(55, 35, 1, 'sawtooth', 0.55, 0); this.noise(0.8, 2400, 0.8, 0.3, 0); break;
      // quand on l'aperçoit pour la première fois : des cordes qui crissent et un grave qui tombe
      case 'sting': for (const f of [622, 659, 932, 987]) this.tone(f, f * 1.03, 1.3, 'sawtooth', 0.035, (Math.random() - 0.5) * 0.8, this.music); this.tone(82, 36, 1.6, 'sawtooth', 0.4, 0, this.music); this.noise(1.1, 3000, 0.7, 0.07, 0, 'bandpass', this.music, 0, 900); break;
      case 'dark': this.noise(0.32, 180, 1, 0.5 * v, 0); this.tone(180, 40, 0.5, 'square', 0.2 * v, 0); break;
      case 'lightsback': this.tone(60, 120, 0.4, 'square', 0.08, 0); break;
      case 'genwork': this.noise(0.13, 1900, 3, 0.2 * v, pan); this.tone(180, 240, 0.18, 'square', 0.1 * v, pan, null, 0.12); S('clank', 0.5); break;
      case 'gen': this.tone(35, 150, 2.5, 'sawtooth', 0.5, 0); this.noise(2.4, 300, 1, 0.28, 0, 'bandpass', null, 0, 1400); for (const [i, f] of [392, 523, 659].entries()) this.tone(f, f, 0.4, 'triangle', 0.12, 0, null, 2 + i * 0.16); break;
      case 'fuse': this.noise(0.05, 3000, 2, 0.45 * v, pan); this.tone(120, 90, 0.5, 'square', 0.13 * v, pan, null, 0.06); break;
      case 'smash': S('clank', 1, 0.7); this.noise(0.35, 800, 1, 0.8 * v, pan); this.tone(200, 50, 0.5, 'square', 0.4 * v, pan); break;
      case 'ding': this.tone(988, 988, 0.9, 'sine', 0.3 * v, pan); this.tone(784, 784, 1.2, 'sine', 0.26 * v, pan, null, 0.36); break;
      case 'lifthum': this.tone(70, 110, o.d || 6, 'sawtooth', 0.09 * v, pan); this.noise(o.d || 6, 300, 0.8, 0.07 * v, pan); break;
      case 'extract': for (const [i, f] of [392, 494, 587, 784].entries()) this.tone(f, f, 0.5, 'triangle', 0.18, 0, null, i * 0.13); break;
      case 'stun': this.tone(1200, 200, 0.55, 'sawtooth', 0.15 * v, pan); this.tone(60, 34, 0.9, 'sawtooth', 0.5 * v, pan); S('grogne', 1, 1.25); break;
      case 'wake': this.tone(40, 80, 2, 'sawtooth', 0.5, 0); this.noise(2, 240, 1, 0.26, 0); this.sample('hurlement', { vol: 0.55, rate: 0.85, wet: 1.4, cut: 2400 }); break;
      case 'cam': this.noise(0.05, 2400, 3, 0.2 * v, pan); this.tone(1400, 1400, 0.1, 'sine', 0.08 * v, pan, null, 0.08); break;
      case 'camdead': this.noise(0.2, 2600, 1, 0.45 * v, pan); this.tone(900, 90, 0.26, 'square', 0.13 * v, pan); break;
      case 'click': this.noise(0.03, 2200, 3, 0.2, 0); break;
      case 'beep': this.tone(o.f || 1500, o.f || 1500, 0.04, 'square', 0.05, 0.25); break;
      case 'over': this.tone(150, 38, 3, 'sawtooth', 0.4, 0); break;
    }
  }
  // un fond qui tourne : il se raccorde à lui-même en fondu, sans dépendre d'une coupure parfaite du fichier
  layer(name, want, t) {
    const list = this.bank[name];
    if (!list || !list.length) return;
    const L = this.layers[name] ||= (() => { const g = this.ctx.createGain(); g.gain.value = 0; g.connect(this.music); return { g, next: 0 }; })();
    L.g.gain.setTargetAtTime(want, t, 1.1);
    if (want < 0.005 && L.g.gain.value < 0.005) { L.next = 0; return; } // silencieux : on ne relance rien
    if (t >= L.next) {
      const b = list[0], xf = Math.min(2.5, b.duration / 4), s = this.ctx.createBufferSource(), g = this.ctx.createGain();
      s.buffer = b; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(1, t + xf); g.gain.setValueAtTime(1, t + b.duration - xf); g.gain.linearRampToValueAtTime(0.0001, t + b.duration);
      s.connect(g); g.connect(L.g); s.start(t); L.next = t + b.duration - xf;
    }
  }
  // boucle : ambiances, cœur quand le monstre approche, souffle, générateur, bruits lointains
  update(dt, st) {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    const t = c.currentTime, place = st.place || 'batiment', on = st.drone ?? 0.8, inGame = on > 0.5;
    this.drone.gain.setTargetAtTime(on * (this.bank.fondBatiment?.length ? 0.45 : 1), t, 0.6);
    this.layer('fondDehors', on * (place === 'dehors' ? 0.55 : 0.05), t);
    this.layer('fondBatiment', on * (place === 'batiment' ? 0.6 : place === 'soussol' ? 0.16 : 0), t);
    this.layer('fondSousSol', on * (place === 'soussol' ? 0.75 : 0), t);
    this.layer('fondChasse', inGame ? clamp(st.chase || 0, 0, 1) * 0.75 : 0, t);
    this.revG.gain.setTargetAtTime(place === 'dehors' ? 0.06 : place === 'soussol' ? 0.5 : 0.28, t, 0.5);
    if (st.gen) { const P = this.place(st.gen.x, st.gen.y, st.gen.z, 34); this.genG.gain.setTargetAtTime(P.g * (st.gen.on ? 0.1 : st.gen.work ? 0.08 : 0), t, 0.3); this.genP.pan.setTargetAtTime(P.pan, t, 0.2); this.genOsc.frequency.setTargetAtTime(st.gen.on ? 62 : 40 + st.gen.k * 16, t, 0.3); }
    if (st.hum) { const P = this.place(st.hum.x, st.hum.y, st.hum.z, 7); this.humG.gain.setTargetAtTime(P.g * 0.018 * st.hum.k, t, 0.05); this.humP.pan.setTargetAtTime(P.pan, t, 0.1); } else this.humG.gain.setTargetAtTime(0, t, 0.2);
    if (st.fear > 0.02) {
      this.heartT -= dt;
      if (this.heartT <= 0) { this.heartT = 1.15 - st.fear * 0.68; const v = 0.3 + st.fear * 0.65; if (!this.sample('coeur', { vol: v, wet: 0, dest: this.music })) { this.tone(62, 38, 0.12, 'sine', v * 0.6, 0, this.music); this.tone(56, 34, 0.14, 'sine', v * 0.45, 0, this.music, 0.2); } }
    }
    if (st.emf > 0) { this.emfT -= dt; if (this.emfT <= 0) { this.emfT = 0.9 - st.emf * 0.16; this.play('beep', { f: 800 + st.emf * 260 }); } }
    // essoufflé : on s'entend reprendre sa respiration
    if (st.pant > 0.02) {
      this.breathT -= dt;
      if (this.breathT <= 0) { const k = st.pant; this.breathT = 1.25 - k * 0.6; this.noise(0.3, 1050, 1.1, 0.02 + k * 0.05, 0, 'bandpass', null, 0, 1500); this.noise(0.36, 680, 1, 0.016 + k * 0.04, 0, 'bandpass', null, 0.42 - k * 0.1, 460); }
    }
    // lui : on l'entend respirer de près et grogner d'assez loin, avant de le voir
    if (st.monster) {
      this.monT -= dt;
      if (this.monT <= 0) {
        const m = st.monster; this.monT = (m.self ? 4.5 : 2.6) + Math.random() * 3.5;
        if (m.self) this.play('breath', { vol: 0.32 });
        else if (Math.random() < 0.6) this.play('breath', { x: m.x, y: m.y + 1.9, z: m.z, range: 15, vol: 1.1 });
        else this.play('growl', { x: m.x, y: m.y + 1.9, z: m.z, range: 26, vol: 0.9 });
      }
    }
    // la vie du bâtiment : quelque chose grince, tombe ou gémit, jamais au même endroit
    if (inGame) {
      this.farT -= dt;
      if (this.farT <= 0) {
        this.farT = 9 + Math.random() * 16;
        const list = FAR[place] || FAR.batiment, tot = list.reduce((a, l) => a + l[1], 0);
        let w = Math.random() * tot, name = list[0][0];
        for (const [n, k] of list) { w -= k; if (w <= 0) { name = n; break; } }
        const a = Math.random() * 6.283, d = 9 + Math.random() * 15, L = this.L, P = this.place(L.x + Math.cos(a) * d, L.y, L.z + Math.sin(a) * d, 60);
        this.sample(name, { vol: 0.34 * (name === 'enfants' ? 0.6 : 1), pan: P.pan, cut: clamp(5200 - d * 170, 900, 5200), wet: 1.5, rate: 0.82 + Math.random() * 0.26 });
      }
    }
  }
  dispose() { this.alive = false; if (this.ctx) this.ctx.close().catch(() => {}); this.ctx = null; }
}
