// Island Rush — les sons. Les bruitages sont synthétisés (WebAudio, sans fichier) : armes (une signature par arme,
// étouffée au loin), impacts, explosions, portes, coffres, rechargements, soins, pioche, constructions, pas (les
// siens et ceux des joueurs proches : on entend venir), interface. Ambiance de nature en boucle (campagne, bord de
// mer, montagne selon l'endroit), vent en altitude et grondement de la tempête. Les ambiances viennent de
// Birdie Party (enregistrements CC0, voir golf/sounds/LICENSE.txt). Le contexte audio naît au premier geste.
const AMB = { campagne: '../golf/sounds/amb-campagne.mp3', mer: '../golf/sounds/amb-mer.mp3', montagne: '../golf/sounds/amb-montagne.mp3' };
const SHOT_RANGE = { fusil: 180, smg: 120, pistolet: 120, pompe: 140, sniper: 320, roquette: 220 };

export function createSound() {
  let ctx = null, master = null, fxBus = null, bed = null, noiseBuf = null, brown = null;
  const amb = {}, last = {};
  let wind = null, storm = null, stepT = 0, stepsOther = new Map();
  let ear = { x: 0, y: 0, z: 0, yaw: 0 };

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // volume : le curseur « Effets » du panneau Réglages (à 0 : coupé)
    master = ctx.createGain(); master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
    master.connect(DDVolume.gain(ctx, 'fx')).connect(comp); comp.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
    bed = ctx.createGain(); bed.gain.value = 0.5; bed.connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // bruit brun (grondements)
    brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = brown.getChannelData(0); let l = 0;
    for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
    // vent et tempête : deux boucles filtrées dont on règle le volume à chaque image
    wind = loopNoise(noiseBuf, 'bandpass', 420, 0.5);
    storm = loopNoise(brown, 'lowpass', 220, 0.7);
    for (const [k, url] of Object.entries(AMB)) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(bed);
      amb[k] = { g, src: null };
      fetch(url).then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((buf) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); s.start(0, Math.random() * buf.duration); amb[k].src = s;
      }).catch(() => {});
    }
  }
  function loopNoise(buf, type, f, q) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(bed); s.start();
    return { g, f: fl };
  }

  // ------------------------------------------------------------------ briques
  function out(v, pan = 0, cut = 0) {
    const g = ctx.createGain(); g.gain.value = v;
    let node = g;
    if (cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; g.connect(f); node = f; }
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); p.connect(fxBus); }
    else node.connect(fxBus);
    return g;
  }
  function noise(dest, t, dur, { type = 'lowpass', f0 = 1000, f1 = f0, q = 1, a = 0.002, v = 1, buf = noiseBuf } = {}) {
    const s = ctx.createBufferSource(); s.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  function tone(dest, t, dur, { type = 'sine', f0 = 440, f1 = f0, a = 0.004, v = 1, vib = 0 } = {}) {
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    if (vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = vib; lg.gain.value = f0 * 0.05; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur); }
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  // volume, panoramique et étouffement selon la distance à la caméra
  function place(x, y, z, range = 60) {
    const dx = x - ear.x, dy = y - ear.y, dz = z - ear.z, d = Math.hypot(dx, dy, dz);
    if (d > range) return null;
    const v = Math.min(1, 1 / (1 + d / 9)) * (1 - d / range) ** 0.6;
    // à droite de la caméra : (−cos yaw, sin yaw)
    const side = d > 0.5 ? (-dx * Math.cos(ear.yaw) + dz * Math.sin(ear.yaw)) / Math.hypot(dx, dz || 0.001) : 0;
    return { v, pan: Math.max(-0.85, Math.min(0.85, side * 0.85)), cut: d > 25 ? Math.max(500, 9000 - d * 45) : 0 };
  }
  const gap = { touche: 0.03, impact: 0.05, bouclier: 0.03, pas: 0.08, recharge: 0.1, coup: 0.05, aie: 0.08, tempete: 0.5, casse: 0.08 };
  function ok(name) {
    const now = ctx.currentTime, g = gap[name] || 0;
    if (g && last[name] && now - last[name] < g) return false;
    last[name] = now; return true;
  }

  // ------------------------------------------------------------------ bruitages
  function synth(name, o, t) {
    switch (name) {
      // armes
      case 'fusil': noise(o, t, 0.13, { type: 'bandpass', f0: 2200, f1: 450, q: 0.7, v: 0.75 }); tone(o, t, 0.11, { f0: 140, f1: 48, v: 0.6 }); break;
      case 'smg': noise(o, t, 0.07, { type: 'bandpass', f0: 3000, f1: 900, q: 0.9, v: 0.5 }); tone(o, t, 0.06, { f0: 210, f1: 75, v: 0.35 }); break;
      case 'pistolet': noise(o, t, 0.1, { type: 'bandpass', f0: 2600, f1: 650, q: 0.8, v: 0.7 }); tone(o, t, 0.08, { f0: 170, f1: 55, v: 0.5 }); break;
      case 'pompe': noise(o, t, 0.34, { f0: 3200, f1: 180, v: 1 }); tone(o, t, 0.26, { f0: 105, f1: 34, v: 1 }); noise(o, t + 0.42, 0.05, { type: 'highpass', f0: 2600, v: 0.28 }); noise(o, t + 0.55, 0.06, { type: 'bandpass', f0: 1400, v: 0.3 }); break;
      case 'sniper': noise(o, t, 0.06, { type: 'highpass', f0: 4200, f1: 1500, v: 0.8 }); noise(o, t, 0.9, { f0: 1800, f1: 120, v: 0.55 }); tone(o, t, 0.3, { f0: 95, f1: 32, v: 0.9 }); break;
      case 'roquette': noise(o, t, 0.6, { type: 'bandpass', f0: 380, f1: 1600, q: 0.8, v: 0.6 }); tone(o, t, 0.2, { f0: 240, f1: 70, v: 0.6 }); break;
      case 'impact': noise(o, t, 0.05, { type: 'bandpass', f0: 2600, f1: 1200, q: 1.2, v: 0.4 }); break;
      case 'boum': noise(o, t, 1.4, { f0: 900, f1: 60, v: 1, buf: brown }); noise(o, t, 0.3, { f0: 2600, f1: 300, v: 0.7 }); tone(o, t, 0.6, { f0: 70, f1: 28, v: 1 }); break;
      case 'souffle': noise(o, t, 0.55, { type: 'bandpass', f0: 300, f1: 1400, q: 0.6, v: 0.7 }); tone(o, t, 0.35, { f0: 180, f1: 60, v: 0.5 }); break;
      case 'vide': noise(o, t, 0.025, { type: 'highpass', f0: 3200, v: 0.35 }); break;
      case 'recharge': noise(o, t, 0.04, { type: 'highpass', f0: 2600, v: 0.32 }); noise(o, t + 0.16, 0.05, { type: 'bandpass', f0: 1500, v: 0.34 }); noise(o, t + 0.32, 0.05, { type: 'highpass', f0: 2200, v: 0.3 }); break;
      case 'change': noise(o, t, 0.05, { type: 'bandpass', f0: 1800, v: 0.28 }); break;
      case 'lance': noise(o, t, 0.25, { type: 'bandpass', f0: 600, f1: 1500, q: 0.7, v: 0.35 }); break;
      // touché, éliminations
      case 'touche': tone(o, t, 0.06, { type: 'triangle', f0: 950, f1: 900, v: 0.22 }); break;
      case 'bouclier': tone(o, t, 0.08, { type: 'triangle', f0: 1350, f1: 1500, v: 0.2 }); break;
      case 'tete': tone(o, t, 0.16, { type: 'triangle', f0: 1900, f1: 2200, v: 0.26 }); tone(o, t + 0.03, 0.12, { f0: 2850, v: 0.12 }); break;
      case 'aie': noise(o, t, 0.12, { f0: 700, f1: 160, v: 0.55 }); tone(o, t, 0.1, { f0: 120, f1: 60, v: 0.5 }); break;
      case 'tempete': tone(o, t, 0.25, { type: 'sawtooth', f0: 90, f1: 70, v: 0.25 }); noise(o, t, 0.25, { type: 'bandpass', f0: 500, v: 0.25 }); break;
      case 'elimination': [660, 990].forEach((f, i) => tone(o, t + i * 0.09, 0.2, { type: 'triangle', f0: f, v: 0.3 })); break;
      case 'elimine': [440, 370, 294, 220].forEach((f, i) => tone(o, t + i * 0.16, 0.32, { type: 'triangle', f0: f, f1: f * 0.98, v: 0.3 })); break;
      case 'victoire': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(o, t + i * 0.13, i === 5 ? 0.9 : 0.22, { type: 'triangle', f0: f, v: 0.32, vib: i === 5 ? 6 : 0 })); break;
      case 'alerte': tone(o, t, 0.22, { type: 'square', f0: 520, v: 0.12 }); tone(o, t + 0.3, 0.22, { type: 'square', f0: 390, v: 0.12 }); break;
      // butin, soins
      case 'coffre': [523, 659, 784, 1047].forEach((f, i) => tone(o, t + i * 0.06, 0.4, { f0: f, v: 0.25 })); noise(o, t, 0.12, { f0: 500, f1: 150, v: 0.4 }); break;
      case 'caisse': noise(o, t, 0.14, { f0: 600, f1: 120, v: 0.55 }); tone(o, t, 0.12, { f0: 160, f1: 90, v: 0.35 }); break;
      case 'ramasse': tone(o, t, 0.09, { f0: 600, f1: 950, v: 0.25 }); break;
      case 'arme': noise(o, t, 0.06, { type: 'bandpass', f0: 1600, v: 0.35 }); tone(o, t + 0.04, 0.18, { type: 'triangle', f0: 880, f1: 1320, v: 0.2 }); break;
      case 'bandage': noise(o, t, 0.35, { type: 'highpass', f0: 2500, f1: 4000, v: 0.18 }); noise(o, t + 0.5, 0.3, { type: 'highpass', f0: 2200, v: 0.15 }); break;
      case 'potion': for (let i = 0; i < 5; i++) tone(o, t + i * 0.09, 0.08, { f0: 500 + Math.random() * 500, f1: 900 + Math.random() * 400, v: 0.12 }); break;
      case 'soigne': tone(o, t, 0.3, { type: 'triangle', f0: 660, f1: 990, v: 0.22 }); tone(o, t + 0.08, 0.3, { f0: 1320, v: 0.1 }); break;
      // déplacements
      case 'saut': noise(o, t, 0.6, { type: 'bandpass', f0: 300, f1: 900, q: 0.5, v: 0.4 }); break;
      case 'atterrit': noise(o, t, 0.18, { f0: 500, f1: 90, v: 0.6 }); tone(o, t, 0.12, { f0: 90, f1: 50, v: 0.5 }); break;
      case 'pas': noise(o, t, 0.07, { f0: 650, f1: 140, v: 0.32 }); break;
      case 'nage': noise(o, t, 0.22, { type: 'bandpass', f0: 900, f1: 400, q: 0.6, v: 0.25 }); break;
      case 'tremplin': tone(o, t, 0.4, { f0: 180, f1: 720, v: 0.45 }); noise(o, t, 0.4, { type: 'bandpass', f0: 400, f1: 1500, v: 0.3 }); break;
      case 'pose': noise(o, t, 0.1, { f0: 700, f1: 160, v: 0.45 }); break;
      // portes, récolte, constructions
      case 'porte': tone(o, t, 0.38, { type: 'sawtooth', f0: 210, f1: 300, v: 0.05, vib: 18 }); noise(o, t, 0.08, { f0: 900, f1: 200, v: 0.25 }); break;
      case 'porteF': noise(o, t, 0.12, { f0: 500, f1: 90, v: 0.55 }); tone(o, t, 0.1, { f0: 110, f1: 60, v: 0.35 }); break;
      case 'pioche': noise(o, t, 0.16, { type: 'bandpass', f0: 500, f1: 1400, q: 0.6, v: 0.18 }); break;
      case 'coup-bois': noise(o, t, 0.09, { type: 'bandpass', f0: 420, f1: 300, q: 1.5, v: 0.6 }); tone(o, t, 0.08, { f0: 230, f1: 170, v: 0.35 }); break;
      case 'coup-pierre': noise(o, t, 0.08, { type: 'bandpass', f0: 1600, f1: 900, q: 1.2, v: 0.55 }); tone(o, t, 0.05, { f0: 520, f1: 300, v: 0.2 }); break;
      case 'coup-metal': tone(o, t, 0.45, { type: 'triangle', f0: 620, f1: 600, v: 0.22 }); tone(o, t, 0.35, { f0: 1530, f1: 1500, v: 0.14 }); noise(o, t, 0.05, { type: 'highpass', f0: 3000, v: 0.3 }); break;
      case 'construit': noise(o, t, 0.08, { type: 'bandpass', f0: 520, q: 1.4, v: 0.5 }); noise(o, t + 0.11, 0.08, { type: 'bandpass', f0: 600, q: 1.4, v: 0.45 }); break;
      case 'casse': noise(o, t, 0.6, { f0: 1500, f1: 120, v: 0.65 }); for (let i = 0; i < 4; i++) noise(o, t + 0.05 + Math.random() * 0.3, 0.05, { type: 'bandpass', f0: 800 + Math.random() * 1500, v: 0.3 }); break;
      case 'clic': noise(o, t, 0.03, { type: 'bandpass', f0: 2200, v: 0.2 }); break;
      default: break;
    }
  }
  // un son « dans la tête » (le sien, l'interface)
  function play(name, v = 1) {
    if (!ctx || !master) return;
    const key = name.startsWith('coup') ? 'coup' : name;
    if (!ok(key)) return;
    synth(name, out(v), ctx.currentTime + 0.005);
  }
  // un son posé dans le monde
  function at(name, x, y, z, v = 1, range = 60) {
    if (!ctx) return;
    const p = place(x, y, z, range);
    if (!p) return;
    const key = name.startsWith('coup') ? 'coup' : name;
    if (!ok(key + (p.v > 0.5 ? '' : '~'))) return;
    synth(name, out(p.v * v, p.pan, p.cut), ctx.currentTime + 0.005);
  }
  // un tir : le sien plein pot, les autres selon la distance (on les entend de loin, étouffés)
  function shot(w, Q, mine) {
    if (!ctx) return;
    if (mine) { synth(w, out(0.75), ctx.currentTime + 0.003); return; }
    at(w, Q.x, Q.y + 1.4, Q.z, 1.1, SHOT_RANGE[w] || 150);
  }

  // ------------------------------------------------------------------ chaque image : oreille, ambiances, pas
  function update(dt, { cam, yaw, sim, me, disp, storm: gapStorm }) {
    if (!ctx) return;
    ear = { x: cam.x, y: cam.y, z: cam.z, yaw };
    const t = ctx.currentTime, S = sim.S;
    // ambiance : bord de mer, campagne, montagne (selon où l'on est)
    const ground = me && me.alive ? me : null;
    const h = cam.y, coast = ambCoast(cam);
    const air = ground && (ground.mode === 'chute' || ground.mode === 'planeur' || ground.mode === 'ballon') ? 1 : 0;
    const high = Math.min(1, Math.max(0, (h - 45) / 50));
    setG(amb.mer, (1 - air) * coast * 0.9 * (1 - high));
    setG(amb.campagne, (1 - air) * (1 - coast) * (1 - high) * 0.8);
    setG(amb.montagne, (1 - air) * high * 0.8);
    // vent : fort en chute libre, souffle en planeur, léger au sol en hauteur
    const wv = air ? (ground.mode === 'chute' ? 0.55 : ground.mode === 'planeur' ? 0.35 : 0.18) : 0.04 + high * 0.12;
    wind.g.gain.setTargetAtTime(wv, t, 0.3);
    wind.f.frequency.setTargetAtTime(air ? 650 : 380, t, 0.5);
    // tempête : grondement à l'approche du mur, fort dedans
    const sv = gapStorm < 0 ? 0.65 : gapStorm < 40 ? (1 - gapStorm / 40) * 0.35 : 0;
    storm.g.gain.setTargetAtTime(sv, t, 0.4);
    // ses pas
    if (ground && ground.mode === 'sol') {
      const sp = Math.hypot(ground.vx, ground.vz);
      if (sp > 1.2 && (ground.ground || ground.swim)) {
        stepT -= dt;
        if (stepT <= 0) { stepT = ground.swim ? 0.55 : ground.sprint ? 0.27 : ground.crouch ? 0.5 : 0.36; synth(ground.swim ? 'nage' : 'pas', out(ground.crouch ? 0.25 : 0.55), t + 0.005); }
      } else stepT = 0.05;
    }
    // les pas des joueurs proches : on entend quelqu'un approcher
    let n = 0;
    for (const Q of S.players.values()) {
      if (Q === me || !Q.alive || Q.mode !== 'sol' || n >= 4) continue;
      const pos = disp ? disp(Q) : Q;
      if (Math.abs(pos.x - cam.x) > 22 || Math.abs(pos.z - cam.z) > 22) continue;
      const sp = Math.hypot(Q.vx, Q.vz);
      if (sp < 1.5 || Q.crouch) continue;
      n++;
      const k = (stepsOther.get(Q.id) || 0) - dt;
      if (k <= 0) { stepsOther.set(Q.id, Q.sprint ? 0.28 : 0.37); at('pas', pos.x, pos.y, pos.z, 0.9, 22); } else stepsOther.set(Q.id, k);
    }
  }
  function setG(a, v) { if (a && a.g) a.g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.8); }
  // près de la côte ? (au-delà des trois quarts du rayon de l'île)
  let coastRef = null;
  function ambCoast(cam) {
    if (!coastRef) return 0.3;
    const d = Math.hypot(cam.x - coastRef.x, cam.z - coastRef.z);
    return Math.max(0, Math.min(1, (d - coastRef.r * 0.75) / (coastRef.r * 0.3)));
  }
  return {
    unlock, play, at, shot, update,
    island(c, r) { coastRef = { x: c, z: c, r }; },
    dispose() { try { if (ctx) ctx.close(); } catch (e) { /* déjà fermé */ } ctx = null; },
  };
}
