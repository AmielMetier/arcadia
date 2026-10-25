// pokemon/view/music.js
// Générateur procédural du thème de combat Pokémon rétro 8-bit (Web Audio API)

let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let musicEnabled = true;
let schedulerTimer = null;
let current16thNote = 0;
let nextNoteTime = 0.0;

const BPM = 142;
const secondsPerBeat = 60.0 / BPM;
const secondsPer16th = secondsPerBeat / 4.0;
const lookahead = 25.0; // ms
const scheduleAheadTime = 0.12; // s

// Bassline énergique de combat Pokémon (D minor / G minor)
const BASS = [
  38, 38, 50, 38,  41, 38, 50, 38,
  43, 38, 50, 38,  41, 38, 40, 36,
  38, 38, 50, 38,  41, 38, 50, 38,
  45, 43, 41, 38,  40, 38, 36, 33,
  // Partie 2
  35, 35, 47, 35,  38, 35, 47, 35,
  40, 35, 47, 35,  38, 35, 37, 33,
  38, 38, 50, 38,  41, 38, 50, 38,
  46, 45, 43, 41,  45, 43, 41, 40
];

const LEAD = [
  62, 0, 65, 0, 69, 0, 74, 72,
  69, 0, 65, 67, 69, 0, 67, 0,
  62, 0, 65, 0, 69, 0, 77, 76,
  74, 0, 72, 74, 76, 0, 77, 0
];

const mtof = (note) => 440 * Math.pow(2, (note - 69) / 12);

function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

function playDrum(time, isBeat) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = isBeat ? 'triangle' : 'square';
  osc.frequency.setValueAtTime(isBeat ? 120 : 60, time);
  osc.frequency.exponentialRampToValueAtTime(30, time + 0.08);

  gain.gain.setValueAtTime(isBeat ? 0.15 : 0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + 0.09);
}

function playBass(note, time) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(mtof(note), time);

  gain.gain.setValueAtTime(0.14, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + secondsPer16th * 0.9);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + secondsPer16th);
}

function playLead(note, time) {
  if (!audioCtx || !note) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(mtof(note), time);

  gain.gain.setValueAtTime(0.08, time);
  gain.gain.exponentialRampToValueAtTime(0.001, time + secondsPer16th * 1.8);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(time);
  osc.stop(time + secondsPer16th * 2);
}

function scheduleNote(step, time) {
  if (step % 2 === 0) {
    playDrum(time, step % 4 === 0);
  }
  const bassNote = BASS[step % BASS.length];
  playBass(bassNote, time);

  const leadNote = LEAD[step % LEAD.length];
  if (leadNote) playLead(leadNote, time);
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

export const battleMusic = {
  get on() { return musicEnabled; },
  toggle() {
    musicEnabled = !musicEnabled;
    if (!musicEnabled) this.stop();
    else this.start();
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
  }
};
