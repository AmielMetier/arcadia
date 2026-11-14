// The Backrooms (Level 17, le Mall) - Le son du centre commercial, tout en synthèse, branché sur le son du jeu (sfx.js) :
//  - la poupée : ses roulettes sur le carrelage (un roulement sourd, le cliquetis des joints, une roulette qui couine),
//    là où elle est : c'est à l'oreille qu'on sait d'où elle vient ; un grincement quand elle se fige ; quelques notes
//    de boîte à musique, très loin, quand elle s'est replacée ailleurs ;
//  - la cabine de projection : le ventilateur de la lanterne, puis, quand le film passe, le moteur et le claquement
//    de la croix de Malte (24 images par seconde) ; la bande-son du film derrière l'écran (le « bip » de l'amorce, puis
//    une valse d'orgue de foire qui pleure un peu) ; le ramassage d'une boîte, le montage des bobines ;
//  - l'ambiance par zone : plus d'écho dans les mails et les cours, la moquette du cinéma qui boit tout, la ventilation
//    plus présente dans les coulisses ; au loin, de temps en temps : le carillon d'une annonce, un reste de musique
//    d'ambiance, un rideau de fer qui frémit, une gaine qui cogne ;
//  - la descente de l'escalier de secours (view/stairwell.js) : les pas sur le béton, la cage qui résonne, la porte.
// installMallSfx(sfx) ajoute ces sons au son du jeu et rend de quoi les tenir à jour : update(sim, ear, dt, o).
import { FILM_LEAD_T } from '../engine/mall.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
// l'écho et le souffle de la ventilation selon la salle où l'on se tient : [part d'écho, fond]
const ZONES = {
  mail: [0.5, 1], court: [0.52, 1], food: [0.5, 1], portal: [0.46, 1], store: [0.44, 1], closed: [0.44, 1], market: [0.44, 1], flea: [0.4, 0.9], garden: [0.46, 1],
  dock: [0.5, 1.5], parking: [0.5, 1.5], service: [0.4, 1.7], storage: [0.34, 1.6], lobby: [0.36, 1.1], plaza: [0.34, 0.9], annex: [0.36, 0.9], shop: [0.3, 0.8], wc: [0.44, 1],
  fun: [0.26, 0.7], cine: [0.2, 0.55], cineHall: [0.15, 0.5], screen: [0.24, 0.45], booth: [0.1, 0.6], office: [0.14, 0.7],
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
// la valse du film (trois temps, 138 à la noire) : [temps, note] pour le chant, et la pompe « oum-pa-pa » dessous ;
// huit mesures qui tournent en boucle
const WALTZ = [
  [0, 76], [1, 79], [2, 76], [3, 72], [4.5, 74], [5, 76], [6, 77], [7, 81], [8, 77], [9, 74], [10.5, 76], [11, 77],
  [12, 79], [13, 84], [14, 83], [15, 81], [16, 79], [17, 76], [18, 77], [19, 74], [20, 71], [21, 72], [22, 76], [23, 72],
];
const BASS = [48, 48, 53, 53, 55, 55, 48, 48];
const CHORD = [[64, 67], [64, 67], [65, 69], [65, 69], [62, 65], [62, 67], [64, 67], [64, 67]];
const BEAT = 60 / 138;

export function installMallSfx(sfx) {
  const ok = () => sfx.unlocked && sfx.ctx;
  let wheels = null; // les roulettes de la poupée : { g, lp, pan, rattle, hum, squeakT, on, v, x, z }
  let proj = null; // le projecteur : { g, lp, pan, clat, fan, run }
  let track = null; // la bande-son du film : { g, lp, pan, vib, next }
  let zone = '';
  let lastFilm = 0;
  let lastX = 0;
  let lastZ = 0;
  let wasRoll = false;

  // --- les roulettes ---
  const wheelsOn = () => {
    if (wheels) return wheels;
    const c = sfx.ctx;
    const pan = sfx.panner(1.05, 3.2);
    const lp = sfx.filt('lowpass', 9000, 0.5);
    const g = sfx.gainNode(0);
    g.connect(lp).connect(pan);
    // le roulement : un grave qui gronde dans le socle creux, le caoutchouc dur sur le grès
    const src = sfx.longNoise();
    const hum = sfx.gainNode(0.9);
    src.connect(sfx.filt('bandpass', 150, 0.8)).connect(hum).connect(g);
    src.connect(sfx.filt('bandpass', 620, 1.1)).connect(sfx.gainNode(0.28)).connect(g);
    // le cliquetis des joints du carrelage : un aigu haché, d'autant plus serré qu'elle va vite
    const rattle = sfx.gainNode(0);
    const chop = sfx.osc('square', 9);
    const depth = sfx.gainNode(0.11);
    chop.connect(depth).connect(rattle.gain);
    src.connect(sfx.filt('bandpass', 2300, 2.2)).connect(rattle).connect(g);
    src.start(c.currentTime);
    chop.start(c.currentTime);
    return (wheels = { g, lp, pan, rattle, chop, hum, squeakT: 0, v: 0 });
  };
  // une roulette qui couine : deux petits cris de métal sec, qui montent
  const squeak = (dest, vol = 1) => {
    const c = sfx.ctx;
    const t = c.currentTime + 0.01;
    const f = rnd(1900, 2700);
    for (let i = 0; i < (Math.random() < 0.4 ? 2 : 1); i++) {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(f * (1 + i * 0.07), t + i * 0.09);
      o.frequency.linearRampToValueAtTime(f * (1.18 + i * 0.07), t + i * 0.09 + 0.07);
      g.gain.setValueAtTime(0.0001, t + i * 0.09);
      g.gain.exponentialRampToValueAtTime(0.035 * vol, t + i * 0.09 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.09 + 0.085);
      o.connect(g).connect(dest);
      o.start(t + i * 0.09);
      o.stop(t + i * 0.09 + 0.12);
    }
  };
  // elle se fige : le socle qui se tasse (un « toc » de bois creux), le châssis qui grince en s'arrêtant
  const settle = (pos, v, occ) => {
    const dest = sfx.at(pos, 0.5 + 0.5 * clamp01(v / 5), occ);
    const t = sfx.ctx.currentTime + 0.01;
    sfx.tone(dest, t, 'sine', 170, 95, 0.16, 0.22, 0.002);
    sfx.burst(dest, t, 0.05, 'bandpass', 1300, 1.5, 0.08);
    sfx.tone(dest, t + 0.03, 'sawtooth', 620, 410, 0.28, 0.018, 0.02);
    sfx.caption('[wheels stop]', pos);
  };

  // --- le projecteur ---
  const projOn = (b) => {
    if (proj) return proj;
    const c = sfx.ctx;
    const pan = sfx.panner(1.5, 1.6);
    sfx.moveTo(pan, b.proj.x, b.proj.z);
    const lp = sfx.filt('lowpass', 8000, 0.5);
    const g = sfx.gainNode(0);
    g.connect(lp).connect(pan);
    const src = sfx.longNoise();
    // le ventilateur de la lanterne (il tourne toujours un peu : le carton de l'entracte est resté dans le couloir)
    const fan = sfx.gainNode(0.5);
    src.connect(sfx.filt('lowpass', 520, 0.6)).connect(fan).connect(g);
    // quand le film passe : le moteur (100 Hz et son octave), la croix de Malte qui claque 24 fois par seconde
    const run = sfx.gainNode(0);
    run.connect(g);
    const m1 = sfx.osc('sawtooth', 100);
    m1.connect(sfx.filt('lowpass', 420, 0.8)).connect(sfx.gainNode(0.35)).connect(run);
    const clat = sfx.gainNode(0);
    const chop = sfx.osc('square', 24);
    chop.connect(sfx.gainNode(0.5)).connect(clat.gain);
    src.connect(sfx.filt('bandpass', 2600, 1.4)).connect(clat).connect(sfx.gainNode(0.9)).connect(run);
    src.connect(sfx.filt('bandpass', 900, 1.0)).connect(sfx.gainNode(0.25)).connect(run);
    for (const n of [src, m1, chop]) n.start(c.currentTime);
    return (proj = { g, lp, pan, fan, run, on: false });
  };

  // --- la bande-son du film, derrière l'écran ---
  const trackOn = (b) => {
    if (track) return track;
    const c = sfx.ctx;
    const pan = sfx.panner(0.85, 7);
    sfx.moveTo(pan, b.screen.x - 0.5, (b.screen.z0 + b.screen.z1) / 2);
    const lp = sfx.filt('lowpass', 3200, 0.7);
    const g = sfx.gainNode(0);
    // une vieille piste optique : le médium d'un haut-parleur de salle, un souffle, des craquements
    g.connect(sfx.filt('highpass', 180, 0.7)).connect(lp).connect(pan);
    const hiss = sfx.longNoise();
    hiss.connect(sfx.filt('highpass', 2600, 0.6)).connect(sfx.gainNode(0.012)).connect(g);
    hiss.start(c.currentTime);
    // le pleurage : toute la musique monte et descend un peu (la bobine n'est plus ronde)
    const vib = sfx.osc('sine', 0.55);
    const vibG = sfx.gainNode(9);
    vib.connect(vibG);
    const fl = sfx.osc('sine', 6.3);
    const flG = sfx.gainNode(3);
    fl.connect(flG);
    vib.start(c.currentTime);
    fl.start(c.currentTime);
    return (track = { g, lp, pan, vibG, flG, next: -1 });
  };
  // une note d'orgue de foire : deux anches désaccordées, un peu de souffle
  const pipe = (T, when, f, dur, vol) => {
    const c = sfx.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(vol, when + 0.03);
    g.gain.setValueAtTime(vol, when + Math.max(0.04, dur - 0.06));
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    g.connect(T.g);
    for (const [type, det, k] of [['square', -5, 0.5], ['triangle', 6, 1]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = det;
      T.vibG.connect(o.detune);
      T.flG.connect(o.detune);
      const og = c.createGain();
      og.gain.value = k;
      o.connect(og).connect(g);
      o.start(when);
      o.stop(when + dur + 0.05);
    }
  };
  // ce qui doit sonner entre deux instants du film (en secondes de film) : l'amorce, puis la valse
  const schedule = (T, from, to, now) => {
    const at = (ft) => now + Math.max(0, ft - from);
    if (from < FILM_LEAD_T) {
      // l'amorce : un tic à chaque chiffre, et le « bip » du 2
      for (let s = Math.max(1, Math.ceil(from)); s < Math.min(to, FILM_LEAD_T - 1); s++) {
        if (s === FILM_LEAD_T - 2) sfx.tone(T.g, at(s), 'sine', 1000, 0, 0.09, 0.3, 0.002);
        else sfx.burst(T.g, at(s), 0.03, 'bandpass', 1800, 2, 0.12);
      }
    }
    const f0 = Math.max(from, FILM_LEAD_T) - FILM_LEAD_T;
    const f1 = to - FILM_LEAD_T;
    if (f1 <= 0) return;
    const LOOP = 24 * BEAT;
    for (let k = Math.floor(f0 / LOOP); k <= Math.floor(f1 / LOOP); k++) {
      for (let i = 0; i < WALTZ.length; i++) {
        const [b, n] = WALTZ[i];
        const ft = k * LOOP + b * BEAT;
        if (ft < f0 || ft >= f1) continue;
        const nb = i + 1 < WALTZ.length ? WALTZ[i + 1][0] : 24;
        pipe(T, at(ft + FILM_LEAD_T), midi(n), Math.max(0.12, (nb - b) * BEAT * 0.92), 0.09);
      }
      for (let m = 0; m < 8; m++)
        for (let q = 0; q < 3; q++) {
          const ft = k * LOOP + (m * 3 + q) * BEAT;
          if (ft < f0 || ft >= f1) continue;
          if (q === 0) pipe(T, at(ft + FILM_LEAD_T), midi(BASS[m]), BEAT * 0.8, 0.1);
          else for (const n of CHORD[m]) pipe(T, at(ft + FILM_LEAD_T), midi(n), BEAT * 0.45, 0.035);
        }
    }
    // un craquement de la piste, de temps en temps
    if (Math.random() < (to - from) * 0.8) sfx.burst(T.g, now + Math.random() * 0.2, 0.012, 'highpass', 2500, 0.7, 0.1);
  };

  const api = {
    // À chaque image. sim : la partie si l'on est au Level 17 (sinon null) ; ear : celui que suit la caméra ;
    // o : { occ (0 à 1 : ce qui sépare la poupée de l'oreille), paused }
    update(sim, ear, dt, o = {}) {
      if (!ok()) return;
      const c = sfx.ctx;
      const t = c.currentTime;
      const live = !!sim && sim.state === 'playing' && !o.paused;
      // 1. la poupée
      const M = live && sim.doll ? sim.monster : null;
      if (M) {
        const W = wheelsOn();
        const sp = dt > 0 ? Math.hypot(M.x - lastX, M.z - lastZ) / dt : 0;
        lastX = M.x;
        lastZ = M.z;
        const roll = M.mode === 'roll' && sp < 12; // (un saut de 12 m/s : elle s'est replacée, ce n'est pas un roulement)
        W.v += ((roll ? Math.min(6, sp) : 0) - W.v) * Math.min(1, dt * (roll ? 6 : 14));
        const floors = (M.floor || 0) !== (ear.floor || 0);
        const occ = floors ? 1 : clamp01(o.occ || 0);
        const k = clamp01(W.v / 5.4);
        sfx.moveTo(W.pan, M.x, M.z, 0.05);
        W.g.gain.setTargetAtTime(W.v > 0.2 ? (0.1 + 0.3 * k) * (floors ? 0.3 : 1 - 0.45 * occ) : 0, t, 0.06);
        W.lp.frequency.setTargetAtTime(floors ? 380 : 9000 - 7600 * occ, t, 0.15);
        W.chop.frequency.setTargetAtTime(5 + W.v * 3.4, t, 0.1);
        W.rattle.gain.setTargetAtTime(0.07 + 0.1 * k, t, 0.1);
        if (W.v > 0.6) {
          W.squeakT -= dt;
          if (W.squeakT <= 0) {
            W.squeakT = rnd(0.35, 1.1) / (0.6 + k);
            if (!floors) squeak(W.lp, 0.6 + 0.6 * k);
          }
          if (Math.hypot(M.x - ear.x, M.z - ear.z) < 34 && !floors) sfx.caption('[small wheels rolling on the tile]', M);
        }
        if (wasRoll && !roll && sp < 12 && !floors && Math.hypot(M.x - ear.x, M.z - ear.z) < 45) settle(M, W.v, occ);
        wasRoll = roll;
      } else if (wheels) {
        wheels.g.gain.setTargetAtTime(0, t, 0.1);
        wheels.v = 0;
        wasRoll = false;
      }
      // 2. le projecteur et la bande-son du film (le cinéma est en haut)
      const b = live ? sim.fm(0).booth : null;
      const film = b ? sim.film || 0 : 0;
      const room = b && (ear.floor || 0) === 0 ? sim.fm(0).roomAt(ear.x, ear.z) : null;
      const kind = room ? room.kind : '';
      if (b && (ear.floor || 0) === 0 && Math.hypot(ear.x - b.proj.x, ear.z - b.proj.z) < 45) {
        const P = projOn(b);
        const inBooth = kind === 'booth';
        const inRoom = room && room.id === b.screen.room;
        P.g.gain.setTargetAtTime((film > 0 ? 0.5 : 0.09) * (inBooth ? 1 : inRoom ? 0.4 : 0.14), t, 0.3);
        P.lp.frequency.setTargetAtTime(inBooth ? 8000 : inRoom ? 2200 : 650, t, 0.3);
        P.run.gain.setTargetAtTime(film > 0 ? 1 : 0, t, film > 0 ? 0.5 : 0.2);
        if (film > 0 && !P.on) {
          // le démarrage : le contacteur, la courroie qui prend
          const d = sfx.at(b.proj, inBooth ? 1 : 0.4);
          sfx.burst(d, t + 0.01, 0.03, 'bandpass', 1500, 2, 0.4);
          sfx.tone(d, t + 0.05, 'sawtooth', 28, 100, 1.1, 0.12, 0.05);
          sfx.caption('[the projector rattles to life]', b.proj);
        }
        P.on = film > 0;
        if (film > 0) {
          const T = trackOn(b);
          T.g.gain.setTargetAtTime(inRoom ? 0.9 : inBooth ? 0.34 : kind === 'cineHall' || kind === 'service' ? 0.1 : 0.03, t, 0.4);
          T.lp.frequency.setTargetAtTime(inRoom ? 3200 : inBooth ? 1500 : 500, t, 0.4);
          // la musique s'écrit un quart de seconde à l'avance, au fil du film
          if (T.next < 0 || Math.abs(T.next - film) > 1.5) T.next = film;
          const to = film + 0.3;
          if (to > T.next) {
            schedule(T, T.next, to, t + Math.max(0, T.next - film));
            T.next = to;
          }
          if (lastFilm <= 0) sfx.caption('[a fairground waltz, behind the screen]', { x: b.screen.x, z: (b.screen.z0 + b.screen.z1) / 2 });
        } else if (track) track.g.gain.setTargetAtTime(0, t, 0.2);
      } else {
        if (proj) proj.g.gain.setTargetAtTime(0, t, 0.4);
        if (track) track.g.gain.setTargetAtTime(0, t, 0.4);
      }
      lastFilm = film;
      // 3. la salle où l'on est : plus ou moins d'écho, la ventilation plus ou moins présente
      if (live) {
        const r = sim.fm(ear.floor || 0).roomAt(ear.x, ear.z);
        const z = (r && r.kind) || 'service';
        if (z !== zone) {
          zone = z;
          const [wet, bed] = ZONES[z] || [0.4, 1];
          if (sfx.wet) sfx.wet.gain.setTargetAtTime(wet, t, 0.7);
          if (sfx.bed && sfx.bed.mall) sfx.bed.g.gain.setTargetAtTime(sfx.bed.vol * bed, t, 1.2);
        }
      } else zone = '';
    },
    // la poupée s'est replacée : quelques notes de boîte à musique, loin, là où elle est maintenant
    chime(ev, ear) {
      if (!ok() || !ear || (ev.floor || 0) !== (ear.floor || 0)) return;
      const d = Math.hypot(ev.x - ear.x, ev.z - ear.z);
      if (d > 70) return;
      const c = sfx.ctx;
      const dest = sfx.at({ x: ev.x, z: ev.z, ref: 6, rolloff: 0.7 }, 0.7, 0.4, sfx.bedWet || sfx.out);
      const t0 = c.currentTime + 0.4;
      [76, 79, 76, 72, 74].forEach((n, i) => {
        const t = t0 + i * 0.42 + (i === 4 ? 0.2 : 0);
        sfx.ring(dest, t, midi(n) * (0.992 + Math.random() * 0.016), [[1, 1, 1.3], [2.76, 0.35, 0.5], [5.4, 0.12, 0.25]], 0.05);
      });
      sfx.caption('[a music box, far away]', ev);
    },
    // le monte-charge, quand elle change d'étage : le contacteur, un moteur lourd qui ronfle le temps du trajet ; puis,
    // à l'arrivée, le choc de l'arrêt et les portes qui roulent. Il s'entend de loin, du côté du monte-charge de
    // l'étage où l'on est (at) ; à l'arrivée, seulement à l'étage où elle sort
    lift(ev, ear, at) {
      if (!ok() || !ear) return;
      const t = sfx.ctx.currentTime + 0.05;
      if (ev.out) {
        if ((ev.floor || 0) !== (ear.floor || 0)) return;
        const dest = sfx.at({ x: ev.lx, z: ev.lz, ref: 14, rolloff: 0.6 }, 0.9, 0.5, sfx.bedWet || sfx.out);
        sfx.tone(dest, t, 'sine', 90, 48, 0.5, 0.5, 0.004);
        sfx.burst(dest, t + 0.02, 0.18, 'lowpass', 500, 0.8, 0.3);
        sfx.burst(dest, t + 0.7, 1.6, 'bandpass', 260, 0.9, 0.12);
        sfx.tone(dest, t + 2.3, 'sine', 120, 60, 0.3, 0.35, 0.003);
        sfx.caption('[freight elevator doors]', { x: ev.lx, z: ev.lz });
        return;
      }
      if (!at) return;
      const dest = sfx.at({ x: at.x, z: at.z, ref: 14, rolloff: 0.6 }, 0.8, 0.5, sfx.bedWet || sfx.out);
      const T = ev.t || 7;
      sfx.tone(dest, t, 'sine', 70, 40, 0.4, 0.45, 0.004);
      sfx.tone(dest, t + 0.3, 'sawtooth', 38, 54, T - 0.6, 0.11, 0.6);
      sfx.tone(dest, t + 0.3, 'sine', 76, 108, T - 0.6, 0.09, 0.8);
      sfx.burst(dest, t + 0.3, T - 0.6, 'bandpass', 180, 0.7, 0.05);
      sfx.caption('[a freight elevator, somewhere]', at);
    },
    // une boîte de film ramassée : le métal mince qui sonne, la bobine qui bouge dedans
    reel() {
      if (!ok()) return;
      const t = sfx.ctx.currentTime + 0.01;
      const out = sfx.gainNode(0.9);
      out.connect(sfx.out);
      sfx.ring(out, t, 640, [[1, 1, 0.5], [1.52, 0.7, 0.4], [2.7, 0.45, 0.3], [4.1, 0.2, 0.18]], 0.07);
      sfx.burst(out, t, 0.04, 'bandpass', 2400, 1.2, 0.2);
      sfx.burst(out, t + 0.09, 0.12, 'bandpass', 900, 0.8, 0.08);
    },
    // les bobines montées sur le projecteur : deux déclics, la manivelle qui cliquette ; la dernière : le carter qu'on ferme
    thread(last = false) {
      if (!ok()) return;
      const t = sfx.ctx.currentTime + 0.01;
      const out = sfx.gainNode(0.9);
      out.connect(sfx.out);
      for (const d of [0, 0.16]) {
        sfx.burst(out, t + d, 0.02, 'bandpass', 2100, 3, 0.4);
        sfx.burst(out, t + d, 0.05, 'lowpass', 500, 0.8, 0.22);
      }
      for (let i = 0; i < 9; i++) sfx.burst(out, t + 0.34 + i * 0.055, 0.012, 'bandpass', 3200, 5, 0.16);
      if (last) {
        sfx.tone(out, t + 0.95, 'sine', 140, 70, 0.25, 0.4, 0.003);
        sfx.ring(out, t + 0.95, 310, [[1, 1, 0.6], [2.3, 0.5, 0.4], [3.9, 0.25, 0.2]], 0.08);
      }
    },
    // le journal du projectionniste : du papier qu'on feuillette
    paper() {
      if (!ok()) return;
      const t = sfx.ctx.currentTime + 0.01;
      for (const [d, f] of [[0, 3200], [0.13, 4200], [0.3, 2800]]) sfx.burst(sfx.out, t + d, 0.09, 'highpass', f, 0.7, 0.05);
    },
    // les bruits lointains du centre (tirés par la partie : même instant chez tous) ; pos(r1, r2), vol(v0, v1) : un
    // point et un volume tirés au hasard autour de l'oreille (voir sfx.ambCue)
    cue(slot, pos, vol, w) {
      if (!ok()) return;
      const c = sfx.ctx;
      const t = c.currentTime + 0.05;
      const far = sfx.bedWet || sfx.out;
      if (slot === 'rec') {
        // tout près : un tube qui tinte en refroidissant, une dalle de plafond qui travaille
        const dest = sfx.at(pos(4, 14), vol(0.5, 0.9));
        if (w < 0.55) {
          sfx.ring(dest, t, rnd(2400, 3600), [[1, 1, 0.25], [2.4, 0.4, 0.12]], 0.03);
          if (w < 0.25) sfx.ring(dest, t + rnd(0.2, 0.5), rnd(2400, 3600), [[1, 1, 0.2]], 0.02);
        } else sfx.tone(dest, t, 'sine', rnd(150, 210), 90, 0.22, 0.09, 0.004);
      } else if (slot === 'a') {
        if (w < 0.5) {
          // un rideau de fer qui frémit dans un courant d'air
          const p = pos(14, 36);
          const dest = sfx.at(p, vol(0.5, 0.9), 0.3, far);
          for (let i = 0; i < 7; i++) sfx.burst(dest, t + i * rnd(0.05, 0.11), 0.05, 'bandpass', rnd(1500, 2600), 3, 0.09 * (1 - i / 9));
          sfx.caption('[a shutter rattles]', p);
        } else {
          // une gaine de ventilation qui se dilate : deux coups sourds dans la tôle
          const dest = sfx.at(pos(10, 30), vol(0.5, 0.9), 0.5, far);
          for (const d of [0, rnd(0.25, 0.6)]) {
            sfx.tone(dest, t + d, 'sine', 95, 60, 0.3, 0.3, 0.003);
            sfx.ring(dest, t + d, 240, [[1, 0.6, 0.4], [1.7, 0.4, 0.3], [2.9, 0.2, 0.2]], 0.05);
          }
        }
      } else if (slot === 'b') {
        // le carillon d'une annonce, très loin dans les haut-parleurs du mail : trois notes, puis une voix qu'on ne comprend pas
        const p = pos(30, 60);
        const dest = sfx.at({ ...p, ref: 10, rolloff: 0.6 }, vol(0.45, 0.8), 0.5, far);
        [659, 523, 392].forEach((f, i) => sfx.ring(dest, t + i * 0.52, f, [[1, 1, 1.5], [2, 0.3, 0.8], [3.01, 0.12, 0.5]], 0.07));
        if (w < 0.6) {
          const g = sfx.gainNode(0);
          g.connect(sfx.filt('bandpass', 620, 3)).connect(dest);
          const o = sfx.osc('sawtooth', 135);
          o.connect(g);
          let k = t + 2.1;
          for (let i = 0; i < 9; i++) {
            const d = rnd(0.09, 0.26);
            o.frequency.setTargetAtTime(rnd(110, 170), k, 0.03);
            g.gain.setTargetAtTime(rnd(0.02, 0.05), k, 0.02);
            g.gain.setTargetAtTime(0, k + d, 0.03);
            k += d + rnd(0.04, 0.12);
          }
          o.start(t + 2.05);
          o.stop(k + 0.3);
        }
        sfx.caption('[a public-address chime, far away]', p);
      } else if (slot === 'c') {
        // un reste de musique d'ambiance : quatre accords d'orgue électrique très lents, étouffés, qui pleurent
        const p = pos(35, 65);
        const dest = sfx.at({ ...p, ref: 12, rolloff: 0.5 }, vol(0.4, 0.7), 0.7, far);
        const g = sfx.gainNode(0);
        g.connect(sfx.filt('lowpass', 900, 0.7)).connect(dest);
        const wow = sfx.osc('sine', 0.4);
        const wowG = sfx.gainNode(14);
        wow.connect(wowG);
        wow.start(t);
        const chords = [[60, 64, 67, 71], [57, 60, 64, 67], [53, 57, 60, 64], [55, 59, 62, 65]];
        chords.forEach((ch, i) => {
          for (const n of ch) {
            const o = sfx.osc('triangle', midi(n));
            wowG.connect(o.detune);
            const og = sfx.gainNode(0);
            og.gain.setTargetAtTime(0.018, t + i * 2.2, 0.25);
            og.gain.setTargetAtTime(0, t + i * 2.2 + 1.9, 0.3);
            o.connect(og).connect(g);
            o.start(t + i * 2.2);
            o.stop(t + i * 2.2 + 3.2);
          }
        });
        g.gain.setTargetAtTime(1, t, 0.5);
        wow.stop(t + 12);
        sfx.caption('[muzak, somewhere in the mall]', p);
      }
    },
  };

  // --- la descente de l'escalier de secours (view/stairwell.js) ---
  // le souffle de la course et la cage qui gronde : { set(vitesse, présence), stop() }
  sfx.stairRun = () => {
    if (!ok()) return null;
    const c = sfx.ctx;
    const src = sfx.longNoise();
    const low = sfx.gainNode(0.0001);
    const air = sfx.gainNode(0.0001);
    src.connect(sfx.filt('lowpass', 140, 0.7)).connect(low).connect(sfx.out);
    src.connect(sfx.filt('bandpass', 1500, 0.7)).connect(air).connect(sfx.out);
    src.start(c.currentTime);
    let on = true;
    return {
      set: (v, k = 1) => {
        if (!on) return;
        const x = clamp01(v / 6.6);
        low.gain.setTargetAtTime(Math.max(0.0001, (0.05 + 0.16 * x) * k), c.currentTime, 0.1);
        air.gain.setTargetAtTime(Math.max(0.0001, (0.006 + 0.03 * x) * k), c.currentTime, 0.1);
      },
      stop: () => {
        if (!on) return;
        on = false;
        low.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
        air.gain.setTargetAtTime(0.0001, c.currentTime, 0.1);
        src.stop(c.currentTime + 0.8);
      },
    };
  };
  // un pas dans la cage : la semelle qui claque sur le béton, renvoyé par les murs ; parfois la rampe qui sonne
  sfx.stairStep = (k = 0.5, wet = 1) => {
    if (!ok() || wet <= 0.02) return;
    const t = sfx.ctx.currentTime + 0.005;
    const out = sfx.gainNode(0.8 * wet);
    out.connect(sfx.out);
    const v = 0.75 + 0.5 * k;
    sfx.tone(out, t, 'sine', 120, 62, 0.11, 0.3 * v, 0.002);
    sfx.burst(out, t, 0.035, 'bandpass', rnd(1500, 2200), 1.2, 0.2 * v);
    sfx.burst(out, t + 0.085, 0.05, 'bandpass', 900, 0.9, 0.06 * v);
    sfx.burst(out, t + 0.19, 0.07, 'bandpass', 700, 0.8, 0.03 * v);
    if (Math.random() < 0.12) sfx.ring(out, t + 0.02, rnd(380, 520), [[1, 1, 0.7], [2.6, 0.4, 0.4], [4.3, 0.2, 0.25]], 0.035);
  };
  // la dernière porte : la barre antipanique qu'on enfonce, le vantail qui part, l'air du centre commercial
  sfx.stairDoor = () => {
    if (!ok()) return;
    const t = sfx.ctx.currentTime + 0.01;
    const out = sfx.gainNode(0.9);
    out.connect(sfx.out);
    sfx.burst(out, t, 0.03, 'bandpass', 1900, 2.5, 0.5);
    sfx.tone(out, t, 'sine', 150, 70, 0.22, 0.5, 0.002);
    sfx.ring(out, t + 0.01, 420, [[1, 1, 0.5], [2.2, 0.5, 0.35], [3.7, 0.25, 0.2]], 0.08);
    sfx.tone(out, t + 0.12, 'sawtooth', 300, 470, 0.45, 0.02, 0.05);
    sfx.burst(out, t + 0.15, 0.9, 'lowpass', 500, 0.6, 0.22);
  };
  // les bruits lointains du Level 17 (sfx.ambCue les lui passe)
  sfx.mallCue = api.cue;
  return api;
}
