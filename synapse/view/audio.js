// Son et horloge. Tout est réglé sur l'horloge de l'AudioContext : les temps sont programmés d'avance
// (boucle toutes les 25 ms qui programme les 100 ms à venir) et les appuis sont jugés sur la même horloge.
let ctx = null, bus = null;
const live = []; // sources programmées, pour couper celles à venir pendant une pause
const queue = [], sent = []; // sons à programmer { t (heure de jeu), fn(heure du contexte) }

// Créé au premier appui : le navigateur bloque le son avant.
export function unlock() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!ctx && AC) {
    ctx = new AC({ latencyHint: 'interactive' });
    const vol = window.DDVolume ? window.DDVolume.gain(ctx, 'fx') : ctx.createGain();
    vol.connect(ctx.destination);
    bus = ctx.createGain(); bus.gain.value = 0.7; bus.connect(vol);
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
export const audioState = () => (ctx ? ctx.state : 'absent');

// Heure du contexte qu'on entend à l'instant perfMs (horloge de performance.now et de event.timeStamp).
function rawAt(perfMs) {
  if (!ctx) return 0;
  if (ctx.state !== 'running') return ctx.currentTime;
  const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null;
  if (ts && ts.contextTime > 0 && ts.performanceTime > 0) return Math.max(0, ts.contextTime + (perfMs - ts.performanceTime) / 1000);
  return ctx.currentTime;
}

// Heure de jeu = heure du contexte − décalage ; figée pendant la pause et le décompte de reprise.
export const clock = {
  off: 0, frozen: null, thaw: Infinity,
  now(perfMs = performance.now()) {
    const r = rawAt(perfMs);
    if (this.frozen != null) {
      if (r < this.thaw) return this.frozen;
      this.frozen = null;
    }
    return r - this.off;
  },
  get paused() { return this.frozen != null; },
  reset() { this.frozen = null; this.thaw = Infinity; },
  pause() {
    if (this.frozen != null) { this.thaw = Infinity; return; }
    this.frozen = this.now(); this.thaw = Infinity;
    cancelFuture(this.frozen);
  },
  // Reprise sur trois temps de décompte ; le prochain temps du jeu tombe pile un intervalle après le troisième.
  resume(nextBeat, iv) {
    if (this.frozen == null) return null;
    const r0 = rawAt(performance.now()) + 0.2;
    const bt = nextBeat == null ? this.frozen + iv : Math.min(nextBeat, this.frozen + iv);
    this.off = r0 + 3 * iv - bt;
    this.thaw = this.frozen + this.off;
    for (let k = 0; k < 3; k++) tick(r0 + k * iv, k === 0);
    return { r0, iv };
  },
  raw: () => rawAt(performance.now()),
};

function cancelFuture(gameT) {
  const now = ctx ? ctx.currentTime : 0;
  for (const s of live) if (s.at > now) { try { s.o.stop(); } catch (e) {} }
  for (let i = sent.length - 1; i >= 0; i--) if (sent[i].t > gameT) queue.push(...sent.splice(i, 1));
}

// Programme un son à l'heure de jeu t (le son part même si t est déjà un peu passé).
export const at = (t, fn) => queue.push({ t, fn });
export function clearQueue() { queue.length = 0; sent.length = 0; }
setInterval(() => {
  if (!ctx || clock.paused || ctx.state !== 'running') return;
  const horizon = clock.now() + 0.1;
  for (let i = queue.length - 1; i >= 0; i--) {
    const q = queue[i];
    if (q.t >= horizon) continue;
    queue.splice(i, 1); sent.push(q);
    q.fn(Math.max(ctx.currentTime, q.t + clock.off));
  }
  const old = ctx.currentTime - 2;
  for (let i = live.length - 1; i >= 0; i--) if (live[i].at < old) live.splice(i, 1);
  for (let i = sent.length - 1; i >= 0; i--) if (sent[i].t + clock.off < old) sent.splice(i, 1);
}, 25);

// Timbres doux : triangle ou sinus filtrés, enveloppe courte façon marimba.
function tone(f, when, { dur = 0.25, vol = 0.3, type = 'sine', cut = 2400 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), lp = ctx.createBiquadFilter(), g = ctx.createGain();
  o.type = type; o.frequency.value = f;
  lp.type = 'lowpass'; lp.frequency.value = cut; lp.Q.value = 0.5;
  g.gain.setValueAtTime(0.0001, when);
  g.gain.exponentialRampToValueAtTime(vol, when + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(lp).connect(g).connect(bus);
  o.start(when); o.stop(when + dur + 0.05);
  live.push({ o, at: when });
}
function mallet(f, when, vol, dur) {
  tone(f, when, { dur, vol, type: 'triangle', cut: 1800 });
  tone(f * 4, when, { dur: dur * 0.25, vol: vol * 0.12, cut: 6000 });
}
const nowT = () => (ctx ? ctx.currentTime + 0.005 : 0);

// Gamme pentatonique de do, une note par nœud.
const PENTA = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

export function tick(when, accent) { mallet(accent ? 880 : 660, when, accent ? 0.3 : 0.22, 0.16); }
export const sfx = {
  tick,
  ok() { const w = nowT(); mallet(784, w, 0.14, 0.22); mallet(1175, w + 0.06, 0.1, 0.28); },
  err() { const w = nowT(); tone(185, w, { dur: 0.32, vol: 0.26, cut: 420 }); tone(139, w + 0.04, { dur: 0.36, vol: 0.2, cut: 380 }); },
  rule() { const w = nowT(); [523.25, 659.25, 783.99].forEach((f, i) => mallet(f, w + i * 0.09, 0.18, 0.4)); },
  note(i, when = nowT()) { mallet(PENTA[i % PENTA.length], when, 0.26, 0.55); },
  test() { mallet(660, nowT(), 0.22, 0.2); },
};
