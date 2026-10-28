// Island Rush — les sons. De vrais enregistrements (sounds/, libres : voir sounds/LICENSE.txt) : tirs de chaque arme
// de près et de loin (le son arrive en retard au loin, à 343 m/s, étouffé, avec son écho), mécanique (pompe, culasse,
// chargeurs), dégainer, impacts selon la matière, pas selon le sol (herbe, route, bois, gravier, neige, métal, eau,
// carrelage), portes, explosions, sons de touche et d'élimination. Un écho d'extérieur ou de pièce selon l'endroit où
// l'on se tient. Ce qui n'a pas d'enregistrement (ou avant leur chargement) est synthétisé (WebAudio). Ambiances de
// nature (Birdie Party, CC0), vent en altitude, grondement de la tempête ; musique pendant la montgolfière et la
// descente seulement, jingles de fin. Le contexte audio naît au premier geste.
const AMB = { campagne: '../golf/sounds/amb-campagne.mp3', mer: '../golf/sounds/amb-mer.mp3', montagne: '../golf/sounds/amb-montagne.mp3' };
const DIR = 'sounds/';
// enregistrements : nom → nombre de variantes (fichiers nom-1.mp3 … ; 0 : un seul fichier nom.mp3)
const BANK = {
  'tir-fusil': 4, 'tir-smg': 3, 'tir-pistolet': 3, 'tir-pompe': 3, 'tir-sniper': 3,
  'loin-fusil': 0, 'loin-smg': 0, 'loin-pistolet': 0, 'loin-pompe': 0, 'loin-sniper': 0,
  'pompe-arme': 0, 'pompe-rack': 0, 'culasse-sniper': 0, 'chargeur-sort': 0, 'chargeur-entre': 0, 'chargeur-clic': 0, armement: 0,
  'pistolet-sort': 0, 'pistolet-culasse': 0, cartouche: 0, 'balle-sniper': 0,
  tissu: 4, degaine: 2, 'ramasse-cuir': 0, ceinture: 0, 'porte-ouvre': 2, 'porte-ferme': 4, grince: 3, pieces: 0,
  'impact-corps': 3, 'impact-bouclier': 3, 'impact-bois': 3, 'impact-metal': 3, 'impact-pierre': 3, 'impact-sol': 3,
  'coup-metal': 3, 'coup-plaque': 3, 'bouclier-casse': 0, boum: 3, 'boum-grave': 0, 'roquette-part': 0,
  'pas-herbe': 5, 'pas-beton': 5, 'pas-bois': 5, 'pas-neige': 5, 'pas-gravier': 5, 'pas-metal': 5, 'pas-eau': 5, 'pas-carrelage': 5,
};
const EXTRA = { 'jingle-victoire': '../golf/sounds/jingle-great.mp3', 'jingle-elimine': '../golf/sounds/jingle-bad.mp3' };
const MUSIC = DIR + 'musique-saut.mp3';
// on entend un tir jusqu'à… (m) ; volume de chaque arme
const SHOT_RANGE = { fusil: 340, smg: 240, pistolet: 220, pompe: 240, sniper: 560, roquette: 320 };
const SHOT_VOL = { fusil: 0.85, smg: 0.72, pistolet: 0.78, pompe: 1, sniper: 1, roquette: 0.8 };
// sous chaque détonation, un coup sourd synthétisé qui donne du corps : [fréquence de départ, d'arrivée (Hz), durée (s), volume]
const PUNCH = { fusil: [105, 42, 0.16, 0.95], smg: [125, 52, 0.1, 0.7], pistolet: [140, 55, 0.13, 0.8], pompe: [85, 32, 0.3, 1.15], sniper: [72, 28, 0.42, 1.25] };
// un bruitage = des enregistrements superposés [nom, volume, vitesse, retard] et, si syn > 0, sa version synthétisée
const LAYERS = {
  boum: { s: [['boum', 1], ['boum-grave', 0.9]], syn: 0.5 },
  'coup-bois': { s: [['impact-bois', 0.9, 0.9]] }, 'coup-pierre': { s: [['impact-pierre', 0.9]] }, 'coup-metal': { s: [['coup-metal', 0.6]] },
  porte: { s: [['porte-ouvre', 0.8], ['grince', 0.25, 1.1, 0.05]] }, porteF: { s: [['porte-ferme', 0.9]] },
  coffre: { s: [['grince', 0.5, 0.9], ['pieces', 0.35, 1, 0.15]], syn: 0.8 }, caisse: { s: [['coup-plaque', 0.6, 0.8], ['impact-bois', 0.5]] },
  construit: { s: [['impact-bois', 0.75, 0.85], ['impact-bois', 0.55, 0.95, 0.11]] },
  casse: { s: [['impact-bois', 1, 0.7], ['impact-pierre', 0.6, 0.8, 0.06]], syn: 0.6 },
  change: { s: [['tissu', 0.45], ['degaine', 0.6, 1, 0.07]] }, arme: { s: [['tissu', 0.45], ['degaine', 0.75, 1, 0.06]], syn: 0.5 },
  ramasse: { s: [['ramasse-cuir', 0.6]], syn: 0.6 }, impact: { s: [['impact-sol', 0.6]] },
  'impact-bois': { s: [['impact-bois', 0.7, 1.15]] }, 'impact-pierre': { s: [['impact-pierre', 0.7, 1.2]] }, 'impact-metal': { s: [['impact-metal', 0.55, 1.1]] },
  'impact-sol': { s: [['impact-sol', 0.6, 1.1]] }, 'impact-verre': { s: [['impact-bouclier', 0.6, 0.9]] },
  atterrit: { s: [['pas-gravier', 0.9, 0.8], ['tissu', 0.4, 0.9, 0.03]], syn: 0.6 }, pose: { s: [['impact-bois', 0.5, 1.1]] },
  vide: { s: [['degaine', 0.35, 1.5]], syn: 0.6 }, lance: { s: [['tissu', 0.6, 1.2]], syn: 0.6 },
  roquette: { s: [['roquette-part', 0.9], ['boum-grave', 0.25, 1.6]], syn: 0.4 },
  touche: { s: [['impact-corps', 0.32, 1.15]], syn: 1 }, bouclier: { s: [['impact-bouclier', 0.42, 1.25]], syn: 1 },
  tete: { s: [['impact-metal', 0.3, 1.5]], syn: 1 }, 'bouclier-casse': { s: [['bouclier-casse', 0.7, 1.1]], syn: 0 },
  elimination: { s: [['impact-corps', 0.6, 0.8], ['boum-grave', 0.25, 1.4]], syn: 1 },
  aie: { s: [['impact-corps', 0.65, 0.85]], syn: 0.5 },
  victoire: { s: [['jingle-victoire', 0.8]] }, elimine: { s: [['jingle-elimine', 0.8]] },
  pioche: { s: [['tissu', 0.35, 1.3]], syn: 0.6 }, bandage: { s: [['tissu', 0.5, 0.8], ['tissu', 0.45, 0.9, 0.45]] },
};
// rechargement : [instant (part du temps de recharge), enregistrement, volume]
const RELOAD = {
  fusil: [[0.1, 'chargeur-sort', 0.7], [0.5, 'chargeur-entre', 0.8], [0.8, 'armement', 0.7]],
  smg: [[0.1, 'chargeur-sort', 0.65], [0.5, 'chargeur-clic', 0.8], [0.82, 'armement', 0.6]],
  pistolet: [[0.06, 'pistolet-sort', 0.7], [0.45, 'chargeur-clic', 0.75], [0.8, 'pistolet-culasse', 0.75]],
  sniper: [[0.08, 'culasse-sniper', 0.55], [0.42, 'balle-sniper', 0.8], [0.74, 'culasse-sniper', 0.7]],
  roquette: [[0.12, 'tissu', 0.6], [0.55, 'coup-plaque', 0.45], [0.85, 'degaine', 0.7]],
};
// pas : volume par sol
const STEP_V = { herbe: 0.55, beton: 0.5, bois: 0.6, neige: 0.55, gravier: 0.5, metal: 0.5, eau: 0.65, carrelage: 0.45 };

export function createSound() {
  let ctx = null, master = null, comp = null, fxBus = null, gunBus = null, bed = null, noiseBuf = null, brown = null, revBus = null, revOut = null, revIn = null;
  let voices = 0, music = null, musicOn = false;
  const amb = {}, last = {}, bufs = new Map();
  let wind = null, storm = null, stepT = 0, stepsOther = new Map();
  let ear = { x: 0, y: 0, z: 0, yaw: 0 };
  // coffre doré tout proche : un accord doux qui frémit et des notes scintillantes, de plus en plus fort en approchant
  // (on le trouve à l'oreille, même derrière un mur)
  const HUM_R = 12, SPARK = [1318.5, 1568, 1760, 1975.5, 2349.3, 2637];
  let hum = null, humT = 0, humFrom = null, hush = 0;
  // combat proche (des tirs à moins de 60 m, ou les siens) : l'ambiance de nature s'efface un moment, on entend mieux le combat
  let fightT = -99;
  function makeHum() {
    const g = ctx.createGain(); g.gain.value = 0;
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    // l'accord (mi majeur, avec l'octave) : chaque note vibre un peu, l'ensemble palpite
    const trem = ctx.createGain(); trem.gain.value = 0.7;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 5.5; lg.gain.value = 0.3; lfo.connect(lg); lg.connect(trem.gain); lfo.start();
    for (const [f, v] of [[659.3, 0.32], [830.6, 0.22], [987.8, 0.2], [1318.5, 0.09]]) {
      const o = ctx.createOscillator(), vg = ctx.createGain(), vib = ctx.createOscillator(), vibG = ctx.createGain();
      o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 10; vg.gain.value = v;
      vib.frequency.value = 3.5 + Math.random() * 1.5; vibG.gain.value = f * 0.004; vib.connect(vibG); vibG.connect(o.frequency);
      o.connect(vg); vg.connect(trem); o.start(); vib.start();
    }
    const sp = ctx.createGain(); sp.gain.value = 0;
    trem.connect(g);
    if (pan) { g.connect(pan); sp.connect(pan); pan.connect(fxBus); } else { g.connect(fxBus); sp.connect(fxBus); }
    hum = { g, sp, pan };
  }
  function chestHum(dt, S, t) {
    let best = null, bd = HUM_R;
    for (const c of S.chests.values()) {
      if (c.kind !== 'coffre' || c.open || Math.abs(c.x - ear.x) > HUM_R || Math.abs(c.z - ear.z) > HUM_R) continue;
      const d = Math.hypot(c.x - ear.x, c.y + 0.5 - ear.y, c.z - ear.z);
      if (d < bd) { bd = d; best = c; }
    }
    if (!best && !hum) return;
    if (!hum) makeHum();
    // le coffre qu'on entendait vient d'être ouvert : silence net (paillettes déjà lancées comprises), puis un moment sans
    // carillon, pour qu'on ne croie pas qu'il sonne encore (un autre coffre proche reprend ensuite, de sa direction)
    const was = humFrom != null && S.chests.get(humFrom);
    if (was && was.open) {
      hush = t + 4;
      for (const g of [hum.g.gain, hum.sp.gain]) { g.cancelScheduledValues(t); g.setValueAtTime(0, t); }
    }
    humFrom = best ? best.id : null;
    const p = best && t >= hush ? place(best.x, best.y + 0.5, best.z, HUM_R) : null, k = p ? Math.pow(1 - p.d / HUM_R, 1.5) : 0;
    hum.g.gain.setTargetAtTime(k * 0.13, t, 0.2);
    hum.sp.gain.setTargetAtTime(k * 0.22, t, 0.2);
    if (hum.pan && p) hum.pan.pan.setTargetAtTime(p.pan * 0.8, t, 0.1);
    // de petites notes aiguës au hasard, comme des paillettes
    if (k > 0.02 && (humT -= dt) <= 0) {
      humT = 0.18 + Math.random() * 0.45;
      const f = SPARK[Math.floor(Math.random() * SPARK.length)];
      tone(hum.sp, t + 0.01, 0.5 + Math.random() * 0.4, { type: 'sine', f0: f, f1: f * 1.002, a: 0.006, v: 0.35 + Math.random() * 0.35 });
    }
  }

  function unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    // volume : le curseur « Effets » du panneau Réglages (à 0 : coupé) ; la musique a le sien (setMusic)
    master = ctx.createGain(); master.gain.value = 0.8;
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -12; comp.ratio.value = 6; comp.attack.value = 0.002; comp.release.value = 0.15;
    master.connect(DDVolume.gain(ctx, 'fx')).connect(comp); comp.connect(ctx.destination);
    fxBus = ctx.createGain(); fxBus.gain.value = 0.9; fxBus.connect(master);
    // les détonations passent par une légère saturation : plus denses, plus fortes sans saturer la sortie
    gunBus = ctx.createGain(); gunBus.gain.value = 1;
    const sat = ctx.createWaveShaper(), curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
    sat.curve = curve; sat.oversample = '2x';
    const satOut = ctx.createGain(); satOut.gain.value = 0.85;
    gunBus.connect(sat); sat.connect(satOut); satOut.connect(fxBus);
    bed = ctx.createGain(); bed.gain.value = 0.5; bed.connect(master);
    const len = ctx.sampleRate * 2;
    noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    // bruit brun (grondements)
    brown = ctx.createBuffer(1, len, ctx.sampleRate);
    const b = brown.getChannelData(0); let l = 0;
    for (let i = 0; i < len; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; b[i] = l * 3.5; }
    // écho : dehors, une longue queue sombre et quelques échos sur le relief ; dedans, une pièce courte et claire
    revBus = ctx.createGain();
    revOut = reverb(impulse(2.6, 3.2, 0.18, [[0.16, 0.5], [0.37, 0.32], [0.71, 0.18]]), 0.75);
    revIn = reverb(impulse(0.75, 2.4, 0.55, [[0.018, 0.5], [0.041, 0.35], [0.07, 0.2]]), 0);
    // vent et tempête : deux boucles filtrées dont on règle le volume à chaque image
    wind = loopNoise(noiseBuf, 'bandpass', 420, 0.5);
    storm = loopNoise(brown, 'lowpass', 220, 0.7);
    for (const [k, url] of Object.entries(AMB)) {
      const g = ctx.createGain(); g.gain.value = 0; g.connect(bed);
      amb[k] = { g, src: null };
      decode(url).then((buf) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); s.start(0, Math.random() * buf.duration); amb[k].src = s;
      }).catch(() => {});
    }
    // les enregistrements (≈ 1 Mo) : chacun sert dès qu'il est prêt
    for (const [name, n] of Object.entries(BANK)) {
      const files = n ? Array.from({ length: n }, (_, i) => `${DIR}${name}-${i + 1}.mp3`) : [`${DIR}${name}.mp3`];
      Promise.all(files.map((f) => decode(f).catch(() => null))).then((list) => { const ok = list.filter(Boolean); if (ok.length) { level(name, ok); bufs.set(name, ok); } });
    }
    for (const [name, url] of Object.entries(EXTRA)) decode(url).then((buf) => bufs.set(name, [buf])).catch(() => {});
  }
  // mixage : les variantes d'un même bruitage n'ont pas la même force (jusqu'à 5 dB d'écart d'un pas à l'autre) ; chacune
  // est ramenée au niveau médian de sa famille (crête d'intensité sur 50 ms), et TRIM corrige ce qui détonne d'une famille
  // à l'autre (la culasse du pistolet couvrait tout son rechargement)
  const TRIM = { 'pistolet-culasse': -6, 'pompe-rack': -2.5, 'chargeur-entre': -2 };
  const gainOf = new WeakMap();
  function peakDb(buf) {
    const a = buf.getChannelData(0), W = Math.max(1, Math.round(buf.sampleRate * 0.05));
    let s = 0, best = 0;
    for (let i = 0; i < a.length; i++) { s += a[i] * a[i]; if (i >= W) s -= a[i - W] * a[i - W]; if (s > best) best = s; }
    return 10 * Math.log10(best / W + 1e-12);
  }
  function level(name, list) {
    const db = list.map(peakDb), mid = [...db].sort((x, y) => x - y)[Math.floor(db.length / 2)], trim = TRIM[name] || 0;
    list.forEach((b, i) => gainOf.set(b, 10 ** ((Math.max(-6, Math.min(6, mid - db[i])) + trim) / 20)));
  }
  const decode = (url) => fetch(url).then((r) => { if (!r.ok) throw new Error(url); return r.arrayBuffer(); }).then((a) => new Promise((res, rej) => ctx.decodeAudioData(a, res, rej)));
  function loopNoise(buf, type, f, q) {
    const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(fl); fl.connect(g); g.connect(bed); s.start();
    return { g, f: fl };
  }
  // réponse impulsionnelle : bruit filtré (damp : clarté) qui s'éteint, plus quelques échos francs
  function impulse(sec, decay, damp, echoes) {
    const sr = ctx.sampleRate, n = Math.floor(sec * sr), buf = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c); let lp = 0;
      for (let i = 0; i < n; i++) { lp += (Math.random() * 2 - 1 - lp) * damp; d[i] = lp * Math.pow(1 - i / n, decay); }
      for (const [at, g] of echoes) {
        const i0 = Math.floor(at * sr) + c * 41;
        for (let k = 0; k < 400 && i0 + k < n; k++) d[i0 + k] += (Math.random() * 2 - 1) * g * (1 - k / 400);
      }
    }
    return buf;
  }
  function reverb(ir, v) {
    const c = ctx.createConvolver(); c.buffer = ir;
    const g = ctx.createGain(); g.gain.value = v;
    revBus.connect(c); c.connect(g); g.connect(master);
    return g;
  }

  // ------------------------------------------------------------------ briques
  function out(v, pan = 0, cut = 0, rev = 0, bus = fxBus) {
    const g = ctx.createGain(); g.gain.value = v;
    let node = g;
    if (cut) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; g.connect(f); node = f; }
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p; }
    node.connect(bus);
    if (rev > 0) { const r = ctx.createGain(); r.gain.value = rev; node.connect(r); r.connect(revBus); }
    return g;
  }
  // un enregistrement (une variante au hasard) ; faux s'il n'est pas (encore) chargé
  function voice(name, { v = 1, pan = 0, cut = 0, rate = 1, rev = 0.12, t = 0, bus = fxBus } = {}) {
    const list = bufs.get(name);
    if (!list) return false;
    if (voices > 56) return true;
    const s = ctx.createBufferSource(); s.buffer = list[Math.floor(Math.random() * list.length)];
    s.playbackRate.value = rate * (0.97 + Math.random() * 0.06);
    s.connect(out(v * (gainOf.get(s.buffer) || 1), pan, cut, rev, bus));
    voices++; s.onended = () => { voices--; };
    s.start(Math.max(ctx.currentTime, t || 0));
    return true;
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
    return { v, d, pan: Math.max(-0.85, Math.min(0.85, side * 0.85)), cut: d > 25 ? Math.max(500, 9000 - d * 45) : 0 };
  }
  const gap = { bruleur: 0.8, touche: 0.03, impact: 0.05, bouclier: 0.03, pas: 0.08, recharge: 0.1, coup: 0.05, aie: 0.08, tempete: 0.5, casse: 0.08, 'impact-': 0.03 };
  function ok(name) {
    const now = ctx.currentTime, g = gap[name] || 0;
    if (g && last[name] && now - last[name] < g) return false;
    last[name] = now; return true;
  }

  // ------------------------------------------------------------------ bruitages synthétisés (repli, et couches d'interface)
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
      // une balle qui frôle : claquement sec puis souffle qui passe
      case 'siffle': noise(o, t, 0.02, { type: 'highpass', f0: 5000, v: 0.5 }); noise(o, t + 0.01, 0.18, { type: 'bandpass', f0: 3800, f1: 900, q: 2.5, v: 0.4 }); break;
      // touché, éliminations (le tireur entend tout de suite qu'il touche)
      case 'touche': tone(o, t, 0.045, { type: 'triangle', f0: 1700, f1: 1500, v: 0.22 }); noise(o, t, 0.02, { type: 'highpass', f0: 4500, v: 0.18 }); break;
      case 'bouclier': tone(o, t, 0.07, { type: 'triangle', f0: 2300, f1: 2600, v: 0.18 }); tone(o, t + 0.01, 0.12, { f0: 3500, v: 0.07 }); break;
      case 'tete': tone(o, t, 0.2, { type: 'triangle', f0: 2100, f1: 2250, v: 0.28 }); tone(o, t + 0.02, 0.24, { f0: 3150, v: 0.13 }); tone(o, t + 0.04, 0.2, { f0: 4200, v: 0.06 }); break;
      case 'aie': noise(o, t, 0.12, { f0: 700, f1: 160, v: 0.55 }); tone(o, t, 0.1, { f0: 120, f1: 60, v: 0.5 }); break;
      case 'tempete': tone(o, t, 0.25, { type: 'sawtooth', f0: 90, f1: 70, v: 0.25 }); noise(o, t, 0.25, { type: 'bandpass', f0: 500, v: 0.25 }); break;
      case 'elimination': tone(o, t, 0.5, { type: 'triangle', f0: 880, v: 0.26 }); tone(o, t + 0.09, 0.6, { type: 'triangle', f0: 1320, v: 0.26 }); tone(o, t + 0.09, 0.6, { f0: 2640, v: 0.06 }); tone(o, t, 0.25, { f0: 90, f1: 45, v: 0.5 }); break;
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
      // repère d'équipe : deux notes claires ; largage annoncé : appel de cor qui monte
      case 'repere': tone(o, t, 0.12, { type: 'triangle', f0: 1175, v: 0.22 }); tone(o, t + 0.09, 0.2, { type: 'triangle', f0: 1568, v: 0.2 }); break;
      case 'largage': [392, 523, 659].forEach((f, i) => tone(o, t + i * 0.16, 0.42, { type: 'sawtooth', f0: f, f1: f * 1.01, v: 0.09 })); tone(o, t + 0.48, 0.7, { type: 'triangle', f0: 784, v: 0.18 }); break;
      // orage de la tempête : le claquement de la foudre (de près), puis le grondement qui roule
      case 'foudre': noise(o, t, 0.3, { type: 'highpass', f0: 3000, f1: 700, v: 0.7 }); noise(o, t, 0.6, { f0: 1800, f1: 200, v: 0.6, buf: brown }); break;
      case 'tonnerre': noise(o, t, 3, { f0: 480, f1: 60, a: 0.05, v: 1, buf: brown }); noise(o, t + 0.35, 2.4, { f0: 300, f1: 45, a: 0.25, v: 0.8, buf: brown }); tone(o, t, 1.4, { f0: 52, f1: 28, a: 0.08, v: 0.45 }); break;
      // brûleur de la montgolfière : souffle grave qui rugit
      case 'bruleur': noise(o, t, 1.5, { type: 'bandpass', f0: 380, f1: 300, q: 0.6, a: 0.12, v: 0.7 }); noise(o, t, 1.5, { f0: 260, f1: 180, a: 0.15, v: 0.9, buf: brown }); break;
      default: break;
    }
  }
  // un bruitage : ses enregistrements s'ils sont là, sinon (ou en plus) sa version synthétisée
  function fire(name, { v = 1, pan = 0, cut = 0, rev = 0.12, t = ctx.currentTime + 0.005 } = {}) {
    const L = LAYERS[name];
    let played = false;
    if (L) for (const [s, sv = 1, rate = 1, dt = 0] of L.s) played = voice(s, { v: v * sv, pan, cut, rate, rev, t: t + dt }) || played;
    else if (bufs.has(name)) played = voice(name, { v, pan, cut, rev, t });
    if (!played || (L && L.syn)) synth(name, out(v * (played ? L.syn : 1), pan, cut, rev * 0.5), t);
  }
  // un son « dans la tête » (le sien, l'interface)
  function play(name, v = 1) {
    if (!ctx || !master) return;
    const key = name.startsWith('coup') ? 'coup' : name.startsWith('impact-') ? 'impact-' : name;
    if (!ok(key)) return;
    fire(name, { v, rev: 0.06 });
  }
  // un son posé dans le monde
  function at(name, x, y, z, v = 1, range = 60) {
    if (!ctx) return;
    const p = place(x, y, z, range);
    if (!p) return;
    const key = name.startsWith('coup') ? 'coup' : name.startsWith('impact-') ? 'impact-' : name;
    if (!ok(key + (p.v > 0.5 ? '' : '~'))) return;
    fire(name, { v: p.v * v, pan: p.pan, cut: p.cut, rev: 0.1 + Math.min(0.5, p.d / 80) });
  }
  // un tir. Le sien plein pot ; les autres : de près la détonation, de loin le claquement étouffé et son écho, qui
  // arrive en retard (le son parcourt 343 m par seconde)
  function shot(w, Q, mine) {
    if (!ctx) return;
    const t = ctx.currentTime + 0.003, vol = SHOT_VOL[w] || 0.8;
    if (w === 'roquette') { if (mine) fire('roquette', { v: 0.9, rev: 0.15 }); else at('roquette', Q.x, Q.y + 1.4, Q.z, 1, SHOT_RANGE.roquette); return; }
    if (mine) {
      fightT = ctx.currentTime;
      if (!voice('tir-' + w, { v: vol, rev: 0.22, t, bus: gunBus })) synth(w, out(0.75), t);
      punch(w, out(1, 0, 0, 0.1, gunBus), t, 1);
      if (w === 'pompe') voice('pompe-arme', { v: 0.55, t: t + 0.42, rev: 0.05 });
      if (w === 'sniper') voice('culasse-sniper', { v: 0.5, t: t + 0.55, rev: 0.05 });
      return;
    }
    const range = SHOT_RANGE[w] || 220, dx = Q.x - ear.x, dy = Q.y + 1.4 - ear.y, dz = Q.z - ear.z, d = Math.hypot(dx, dy, dz);
    if (d > range) return;
    if (d < 60) fightT = ctx.currentTime;
    if (!ok('tir' + w + (d < 40 ? '' : '~'))) return;
    const side = d > 0.5 ? (-dx * Math.cos(ear.yaw) + dz * Math.sin(ear.yaw)) / Math.hypot(dx, dz || 0.001) : 0;
    const pan = Math.max(-0.85, Math.min(0.85, side * 0.85)), delay = Math.min(1.3, d / 343);
    const v = vol / (1 + d / 22) * (1 - d / range) ** 0.7;
    const near = Math.max(0, Math.min(1, 1 - (d - 20) / 45)), far = Math.max(0, Math.min(1, (d - 12) / 40));
    let played = false;
    if (near > 0) {
      played = voice('tir-' + w, { v: v * near, pan, cut: d > 15 ? Math.max(2500, 14000 - d * 160) : 0, rev: 0.18 + d / 120, t: t + delay, bus: gunBus }) || played;
      punch(w, out(v * near, pan, 0, 0.15, gunBus), t + delay, 1);
    }
    if (far > 0) {
      played = voice('loin-' + w, { v: v * far * 1.7, pan, cut: Math.max(650, 4200 - d * 9), rev: 0.45, t: t + delay }) || played;
      // de loin, il reste le grondement grave qui roule
      punch(w, out(v * far * 0.9, pan, 300, 0.5), t + delay, 1.8);
    }
    if (!played) at(w, Q.x, Q.y + 1.4, Q.z, 1.1, range);
  }
  // coup sourd sous la détonation (grave qui descend) et claquement très bref ; slow > 1 : plus lent (de loin)
  function punch(w, o, t, slow = 1) {
    const P = PUNCH[w];
    if (!P) return;
    tone(o, t, P[2] * slow, { f0: P[0], f1: P[1], a: 0.002, v: P[3] });
    tone(o, t, P[2] * 0.6 * slow, { type: 'triangle', f0: P[0] * 2, f1: P[1] * 1.5, a: 0.001, v: P[3] * 0.35 });
    if (slow === 1) noise(o, t, 0.018, { type: 'highpass', f0: 3500, a: 0.0005, v: 0.55 });
  }
  // une balle qui passe près de l'oreille (tirée par un autre)
  function whiz(from, to) {
    if (!ctx) return;
    const ax = to[0] - from[0], ay = to[1] - from[1], az = to[2] - from[2], L2 = ax * ax + ay * ay + az * az || 1;
    const k = Math.max(0, Math.min(1, ((ear.x - from[0]) * ax + (ear.y - from[1]) * ay + (ear.z - from[2]) * az) / L2));
    const d = Math.hypot(from[0] + ax * k - ear.x, from[1] + ay * k - ear.y, from[2] + az * k - ear.z);
    if (d > 3.2 || k <= 0.02 || k >= 0.99 || !ok('siffle')) return;
    const side = (-(from[0] + ax * k - ear.x) * Math.cos(ear.yaw) + (from[2] + az * k - ear.z) * Math.sin(ear.yaw)) / Math.max(0.3, d);
    synth('siffle', out(0.8 * (1 - d / 3.4), Math.max(-0.8, Math.min(0.8, side * 0.8))), ctx.currentTime + 0.005);
  }
  // rechargement : chargeur, culasse, cartouches une à une pour le fusil à pompe ; pos : un autre joueur (sinon soi)
  function reload(w, T, pos = null, n = 3) {
    if (!ctx) return;
    let p = { v: 1, pan: 0, cut: 0, d: 0 };
    if (pos) { p = place(pos.x, pos.y + 1, pos.z, 26); if (!p) return; }
    const t = ctx.currentTime + 0.01, base = pos ? 0.55 : 0.85;
    let steps = RELOAD[w];
    if (w === 'pompe') {
      steps = [];
      for (let i = 0; i < n; i++) steps.push([(i + 0.6) / (n + 1), 'cartouche', 0.75]);
      steps.push([0.93, 'pompe-rack', 0.75]);
    }
    if (!steps || !bufs.has('chargeur-sort')) { fire('recharge', { v: p.v * base, pan: p.pan, cut: p.cut }); return; }
    for (const [f, s, sv] of steps) voice(s, { v: p.v * base * sv, pan: p.pan, cut: p.cut, rev: 0.06, t: t + f * T });
  }

  // ------------------------------------------------------------------ chaque image : oreille, ambiances, pas, musique
  // surface(Q) : sol sous les pieds ('herbe', 'beton', 'bois', 'gravier', 'neige', 'metal', 'eau', 'carrelage') ;
  // indoor : 0 → 1, l'oreille est sous un toit (écho de pièce)
  function update(dt, { cam, yaw, sim, me, disp, storm: gapStorm, surface = null, indoor = 0 }) {
    if (!ctx) return;
    ear = { x: cam.x, y: cam.y, z: cam.z, yaw };
    const t = ctx.currentTime, S = sim.S;
    revOut.gain.setTargetAtTime(0.75 * (1 - indoor), t, 0.25);
    revIn.gain.setTargetAtTime(0.9 * indoor, t, 0.25);
    // ambiance : bord de mer, campagne, montagne (selon où l'on est), étouffée dedans
    const ground = me && me.alive ? me : null;
    const h = cam.y, coast = ambCoast(cam);
    const air = ground && (ground.mode === 'chute' || ground.mode === 'planeur' || ground.mode === 'ballon') ? 1 : 0;
    const high = Math.min(1, Math.max(0, (h - 45) / 50)), inside = (1 - indoor * 0.6) * (t - fightT < 3 ? 0.35 : 1);
    setG(amb.mer, (1 - air) * coast * 0.9 * (1 - high) * inside);
    setG(amb.campagne, (1 - air) * (1 - coast) * (1 - high) * 0.8 * inside);
    setG(amb.montagne, (1 - air) * high * 0.8 * inside);
    // vent : fort en chute libre, souffle en planeur, léger au sol en hauteur
    const wv = air ? (ground.mode === 'chute' ? 0.55 : ground.mode === 'planeur' ? 0.35 : 0.18) : (0.04 + high * 0.12) * inside;
    wind.g.gain.setTargetAtTime(wv, t, 0.3);
    wind.f.frequency.setTargetAtTime(air ? 650 : 380, t, 0.5);
    // tempête : grondement à l'approche du mur, fort dedans
    const sv = gapStorm < 0 ? 0.65 : gapStorm < 40 ? (1 - gapStorm / 40) * 0.35 : 0;
    storm.g.gain.setTargetAtTime(sv, t, 0.4);
    // musique : dans la montgolfière et pendant la descente, puis elle s'efface à l'atterrissage
    setMusic(!!air && S.mode !== 'exploration');
    chestHum(dt, S, t);
    // ses pas : plus forts en courant, discrets accroupi
    if (ground && ground.mode === 'sol') {
      const sp = Math.hypot(ground.vx, ground.vz);
      if (sp > 1.2 && (ground.ground || ground.swim)) {
        stepT -= dt;
        if (stepT <= 0) {
          stepT = ground.swim ? 0.55 : ground.sprint ? 0.27 : ground.crouch ? 0.5 : 0.36;
          const s = ground.swim ? 'eau' : surface ? surface(ground) : 'herbe', k = ground.crouch ? 0.35 : ground.sprint ? 1.05 : 0.8;
          if (!voice('pas-' + s, { v: (STEP_V[s] || 0.5) * k, rate: ground.swim ? 0.8 : 1, rev: 0.04 })) synth(ground.swim ? 'nage' : 'pas', out(ground.crouch ? 0.25 : 0.55), t + 0.005);
        }
      } else stepT = 0.05;
    }
    // les pas des joueurs proches : on entend quelqu'un approcher (et sur quoi il marche)
    let n = 0;
    for (const Q of S.players.values()) {
      if (Q === me || !Q.alive || Q.mode !== 'sol' || n >= 5) continue;
      const pos = disp ? disp(Q) : Q;
      if (Math.abs(pos.x - cam.x) > 26 || Math.abs(pos.z - cam.z) > 26) continue;
      const sp = Math.hypot(Q.vx, Q.vz);
      if (sp < 1.5 || Q.crouch || !Q.ground) continue;
      n++;
      const k = (stepsOther.get(Q.id) || 0) - dt;
      if (k <= 0) {
        stepsOther.set(Q.id, Q.sprint ? 0.28 : 0.37);
        const p = place(pos.x, pos.y, pos.z, 26), s = Q.swim ? 'eau' : surface ? surface(Q) : 'herbe';
        if (p && !voice('pas-' + s, { v: p.v * (STEP_V[s] || 0.5) * (Q.sprint ? 1.6 : 1.2), pan: p.pan, cut: p.cut, rev: 0.06 })) at('pas', pos.x, pos.y, pos.z, 0.9, 22);
      } else stepsOther.set(Q.id, k);
    }
  }
  function setG(a, v) { if (a && a.g) a.g.gain.setTargetAtTime(Math.max(0, v), ctx.currentTime, 0.8); }
  function setMusic(on) {
    if (on === musicOn) return;
    musicOn = on;
    if (on && !music) {
      const a = new Audio(MUSIC); a.loop = true; a.preload = 'auto';
      const g = ctx.createGain(); g.gain.value = 0; g.connect(DDVolume.gain(ctx, 'music')).connect(comp);
      try { ctx.createMediaElementSource(a).connect(g); } catch (e) { a.volume = 0.4 * DDVolume.get('music'); }
      music = { a, g, stop: 0 };
    }
    if (!music) return;
    clearTimeout(music.stop);
    if (on) { music.a.play().catch(() => {}); music.g.gain.setTargetAtTime(0.38, ctx.currentTime, 0.6); }
    else { music.g.gain.setTargetAtTime(0, ctx.currentTime, 1.4); music.stop = setTimeout(() => { if (!musicOn) music.a.pause(); }, 7000); }
  }
  // près de la côte ? (au-delà des trois quarts du rayon de l'île)
  let coastRef = null;
  function ambCoast(cam) {
    if (!coastRef) return 0.3;
    const d = Math.hypot(cam.x - coastRef.x, cam.z - coastRef.z);
    return Math.max(0, Math.min(1, (d - coastRef.r * 0.75) / (coastRef.r * 0.3)));
  }
  return {
    unlock, play, at, shot, whiz, reload, update,
    island(c, r) { coastRef = { x: c, z: c, r }; },
    // un éclair à d mètres : le tonnerre arrive après (343 m/s), plus sourd et plus faible de loin
    thunder(d) {
      if (!ctx || !master) return;
      const t = ctx.currentTime + 0.02 + d / 343, v = Math.max(0.12, Math.min(0.9, 1 - d / 900)), cut = d > 150 ? Math.max(260, 1400 - d) : 0;
      if (d < 160) fire('foudre', { v: v * 0.8, cut, rev: 0.3, t });
      fire('tonnerre', { v, cut, rev: 0.45, t: t + 0.05 });
    },
    dispose() { try { if (music) music.a.pause(); if (ctx) ctx.close(); } catch (e) { /* déjà fermé */ } ctx = null; },
  };
}
