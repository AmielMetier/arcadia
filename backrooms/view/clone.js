// La voix clonée (Level 1). L'entité rejoue les vraies phrases des joueurs (view/voice.js) ; ici, en plus, elle en
// invente : une synthèse vocale qui tourne dans le navigateur (Pocket TTS de Kyutai, vendor/pocket-tts, dans un Web
// Worker : le jeu ne ralentit pas) écoute une dizaine de secondes de la voix d'un coéquipier et dit des phrases qu'il
// n'a jamais dites (LINES). Tout se prépare pendant le Level 0 : le modèle se télécharge dès le début de la partie
// (environ 150 Mo la première fois, gardés en cache), puis chaque voix est clonée dès qu'on en a assez entendu, et ses
// phrases sont fabriquées d'avance : quand l'entité parle, il n'y a rien à attendre. Une voix est refaite quand on a un
// meilleur échantillon (le joueur a parlé davantage).
// Seulement entre joueurs qui l'ont tous deux autorisé (réglage « clone ») : rien ne se télécharge sinon, et la voix
// d'un joueur qui n'a pas dit oui n'est jamais clonée. Rien ne quitte le navigateur. Si quoi que ce soit échoue (pas
// de réseau, navigateur trop ancien), l'entité se contente des vraies phrases.
import { speechRms } from './voice.js';

// Les phrases inventées, par usage (kind de l'appel) : 'call' attirer de loin, 'chat' se fondre dans le groupe,
// 'door' devant une porte ou un casier, 'radio' au talkie. Courtes, banales : ce qu'un joueur dirait
export const LINES = {
  fr: [
    ['call', 'Hé, viens voir !'],
    ['radio', "T'es où ? Je te cherche."],
    ['chat', "Attends, j'ai cru entendre un truc."],
    ['door', "Ouvre, c'est moi."],
    ['call', "J'ai trouvé un truc, viens !"],
    ['radio', "J'ai trouvé un fusible, viens me rejoindre."],
    ['chat', "C'est par là, je crois."],
    ['call', 'Par ici, venez !'],
    ['chat', "T'as trouvé un fusible, toi ?"],
    ['door', 'Laisse-moi entrer, vite !'],
    ['radio', "Revenez vers l'ascenseur, je vous attends."],
    ['call', 'Attends-moi, je suis juste derrière !'],
    ['chat', 'Reste avec moi, on se sépare pas.'],
  ],
  en: [
    ['call', 'Hey, come see this!'],
    ['radio', "Where are you? I'm looking for you."],
    ['chat', 'Wait, I think I heard something.'],
    ['door', "Open up, it's me."],
    ['call', 'I found something, come here!'],
    ['radio', 'I found a fuse, come and meet me.'],
    ['chat', "It's this way, I think."],
    ['call', 'Over here, come on!'],
    ['chat', 'Did you find a fuse?'],
    ['door', 'Let me in, quick!'],
    ['radio', "Come back to the elevator, I'm waiting."],
    ['call', "Wait for me, I'm right behind you!"],
    ['chat', "Stay with me, let's not split up."],
  ],
};
const BUNDLE = { fr: 'french_24l', en: 'english_2026-04' };

// voice : createVoice ; lang : 'fr' ou 'en' ; load : () => la classe PocketTTS (les tests en donnent une fausse) ;
// onState : suivi ('loading', 'ready', 'error', 'off')
export function createCloner({ voice, lang = 'fr', load = null, onState = null }) {
  const lines = LINES[lang] || LINES.en;
  let tts = null;
  let state = 'off';
  let alive = true;
  let busy = false;
  const done = new Map(); // id → { secs de l'échantillon, voix clonée, n phrases faites }
  const set = (st) => {
    state = st;
    if (onState) onState(st);
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  async function boot() {
    set('loading');
    const Cls = load ? await load() : (await import('../vendor/pocket-tts/index.js')).PocketTTS;
    tts = new Cls({ language: BUNDLE[lang] || BUNDLE.en, voiceCloning: true });
    await tts.load();
    if (!alive) return tts.destroy();
    set('ready');
  }

  // une phrase, mise au niveau de la vraie voix
  async function say(text, ref, rms) {
    const parts = [];
    await tts.generate(text, { voice: ref, onChunk: (a) => parts.push(Float32Array.from(a)) });
    const buf = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
    let o = 0;
    for (const p of parts) {
      buf.set(p, o);
      o += p.length;
    }
    const sr = tts.sampleRate;
    // (le silence que le modèle laisse à la fin, et un fondu aux bords)
    let end = buf.length;
    while (end > sr * 0.3 && Math.abs(buf[end - 1]) < 0.004) end--;
    const out = buf.slice(0, Math.min(buf.length, end + Math.round(sr * 0.08)));
    const g0 = speechRms(out, sr);
    let g = g0 > 1e-4 && rms > 1e-4 ? Math.min(3, Math.max(0.3, rms / g0)) : 1;
    let peak = 0;
    for (const x of out) if (Math.abs(x) > peak) peak = Math.abs(x);
    if (peak * g > 0.98) g = 0.98 / peak;
    const fade = Math.min(Math.round(sr * 0.01), out.length >> 1);
    for (let i = 0; i < out.length; i++) out[i] *= g * Math.min(1, i / fade, (out.length - 1 - i) / fade);
    return { buf: out, sr };
  }

  // Le travail, pas à pas : une voix à (re)cloner, sinon une phrase de plus pour la voix qui en a le moins
  async function work() {
    if (busy || !alive || state === 'error') return;
    busy = true;
    try {
      if (!tts) await boot();
      while (alive) {
        const ids = voice.cloneIds();
        let job = null;
        for (const id of ids) {
          const d = done.get(id);
          const r = !d || d.n >= lines.length ? voice.cloneRef(id) : null;
          // (première fois, ou l'échantillon a bien grossi depuis : au moins 4 s de plus, tant qu'il n'était pas plein)
          if (r && (!d || (d.secs < 10 && r.secs >= d.secs + 4))) { job = { id, r }; break; }
        }
        if (job) {
          const ref = await tts.cloneVoice(job.r.data, { inputSampleRate: job.r.sr });
          done.set(job.id, { secs: job.r.secs, ref, rms: job.r.rms, n: 0 });
          continue;
        }
        const next = ids.map((id) => [id, done.get(id)]).filter(([, d]) => d && d.n < lines.length).sort((a, b) => a[1].n - b[1].n)[0];
        if (!next) break;
        const [id, d] = next;
        const [kind, text] = lines[d.n];
        const f = await say(text, d.ref, d.rms);
        if (!alive) break;
        if (f.buf.length > f.sr * 0.3) voice.addFake(id, kind, d.n, f.buf, f.sr);
        d.n++;
        await sleep(120); // (on laisse souffler la machine entre deux phrases)
      }
    } catch (e) {
      set('error');
      if (tts) try { tts.destroy(); } catch (e2) {}
      tts = null;
    }
    busy = false;
  }

  return {
    get state() { return state; },
    // à appeler de temps en temps (une fois par seconde suffit) : charge le modèle, puis suit les voix à cloner
    tick() {
      work();
    },
    // (tests) attendre la fin du travail en cours
    async idle() {
      while (busy) await sleep(30);
    },
    progress() {
      return [...done].map(([id, d]) => ({ id, secs: +d.secs.toFixed(1), lines: d.n }));
    },
    dispose() {
      alive = false;
      if (tts) try { tts.destroy(); } catch (e) {}
      tts = null;
      set('off');
    },
  };
}
