// calcul/view/music.js
// Générateur procédural de bande-son "Stress Financier Wall Street" (Web Audio API)
// Ambiance The Candidate : Ticker de marché métronomique, pulsations cardiaques, basse synthétique sous tension.

import { store, save } from './util.js';

let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let musicEnabled = store('calcul_music', true);

let schedulerTimer = null;
let current16thNote = 0;
let nextNoteTime = 0.0;
const BPM = 130;
const secondsPerBeat = 60.0 / BPM;
const secondsPer16th = secondsPerBeat / 4.0;
const lookahead = 25.0; // ms
const scheduleAheadTime = 0.12; // s

let currentTension = 0.0; // 0.0 (normal) à 1.0 (panique < 5s)

// Bassline ostinato en Ré mineur (16 doubles croches par mesure, 2 mesures)
// Fréquences MIDI pour D1(36), F1(41), G1(43), C1(34), Bb0(34)...
const mtof = (note) => 440 * Math.pow(2, (note - 69) / 12);

const BASS_PATTERN = [
  // Mesure 1 (D minor)
  38, 38, 41, 38,  43, 38, 41, 36,
  38, 38, 41, 38,  45, 43, 41, 36,
  // Mesure 2 (Bb / A tension)
  34, 34, 38, 34,  41, 34, 38, 34,
  33, 33, 37, 33,  40, 39, 37, 33
];

// Accords de nappes d'angoisse
const CHORD_PROGRESSION = [
  [50, 53, 57, 62], // Dm9
  [46, 50, 53, 58], // Bbmaj7
  [43, 46, 50, 55], // Gm6
  [45, 49, 52, 58]  // A7(b9)
];

function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// 1. Ticker / Horloge métronomique de marché
function playMarketTick(time, isBeat, tension) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc.type = 'triangle';
  osc.frequency.setValueAtTime(isBeat ? 1600 : 2400 + tension * 800, time);

  filter.type = 'highpass';
  filter.frequency.setValueAtTime(isBeat ? 1200 : 1800, time);

  const vol = isBeat ? 0.09 : 0.04;
  gain.gain.setValueAtTime(vol + tension * 0.05, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.03);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start(time);
  osc.stop(time + 0.04);
}

// 2. Pouls cardiaque / Heartbeat Sub-Bass (tendu sur les temps)
function playHeartbeat(time, tension) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'sine';
  osc.frequency.setValueAtTime(55 + tension * 15, time);
  osc.frequency.exponentialRampToValueAtTime(35, time + 0.12);

  const vol = 0.35 + tension * 0.25;
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.exponentialRampToValueAtTime(vol, time + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(time);
  osc.stop(time + 0.2);
}

// 3. Basse synthétique de tension Wall Street
function playBassNote(note, time, tension) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();

  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(mtof(note), time);

  // Filtre coupe-bas dynamique qui s'ouvre avec la panique du chrono
  filter.type = 'lowpass';
  const cutoff = 260 + tension * 950;
  filter.frequency.setValueAtTime(cutoff, time);
  filter.Q.setValueAtTime(4.0 + tension * 3.0, time);

  const dur = secondsPer16th * 0.85;
  gain.gain.setValueAtTime(0.22 + tension * 0.12, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start(time);
  osc.stop(time + dur + 0.02);
}

// 4. Sirène d'urgence boursière discrète (Panic Alarm) quand < 5s
function playPanicPulse(time) {
  if (!audioCtx || currentTension < 0.6) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.type = 'square';
  osc.frequency.setValueAtTime(880, time);
  osc.frequency.setValueAtTime(987, time + 0.05);

  gain.gain.setValueAtTime(0.06 * currentTension, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);

  osc.connect(gain);
  gain.connect(masterGain);

  osc.start(time);
  osc.stop(time + 0.12);
}

function scheduleNote(step, time) {
  const is16th = step % 4 !== 0;
  const isBeat = step % 4 === 0;
  const isDownbeat = step % 16 === 0;

  // Ticker de marché (chaque double croche)
  playMarketTick(time, isBeat, currentTension);

  // Pouls cardiaque (sur le temps 1 et le temps 2.5)
  if (isDownbeat || step % 16 === 6) {
    playHeartbeat(time, currentTension);
  }

  // Basse synthétique sous pression
  const noteIndex = step % BASS_PATTERN.length;
  playBassNote(BASS_PATTERN[noteIndex], time, currentTension);

  // Pulsation d'alerte quand temps critique
  if (currentTension > 0.65 && (step % 8 === 0)) {
    playPanicPulse(time);
  }
}

function scheduler() {
  if (!isPlaying || !audioCtx) return;
  while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
    scheduleNote(current16thNote, nextNoteTime);
    nextNoteTime += secondsPer16th;
    current16thNote = (current16thNote + 1) % 64;
  }
  schedulerTimer = setTimeout(scheduler, lookahead);
}

export const wallStreetMusic = {
  get on() {
    return musicEnabled;
  },

  toggle() {
    musicEnabled = !musicEnabled;
    save('calcul_music', musicEnabled);
    if (!musicEnabled) {
      this.stop();
    } else {
      this.start();
    }
    return musicEnabled;
  },

  start() {
    if (!musicEnabled || isPlaying) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    isPlaying = true;
    current16thNote = 0;
    nextNoteTime = ctx.currentTime + 0.05;
    scheduler();
  },

  stop() {
    isPlaying = false;
    clearTimeout(schedulerTimer);
  },

  setTension(ratio) {
    // ratio: 0.0 (temps abondant) -> 1.0 (dernières secondes sous panique)
    currentTension = Math.max(0.0, Math.min(1.0, ratio));
  }
};
