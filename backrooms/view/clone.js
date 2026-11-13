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

// Les phrases inventées. kind : l'usage ('call' attirer de loin, 'chat' se fondre dans le groupe, 'door' devant une
// porte ou un casier, 'radio' au talkie, 'reply' répondre d'un mot à qui lui parle) ; ctx : seulement dans cette
// circonstance ('dark' coupure, 'lift' monte-charge réalimenté, 'last' il manque un fusible, 'fuse' on en a trouvé) ;
// {n} : le prénom du joueur visé (une phrase par coéquipier). Courtes, banales : ce qu'un joueur dirait. Dans l'ordre
// où on les fabrique (une phrase coûte plusieurs secondes de calcul) : les plus utiles d'abord
export const LINES = {
  fr: [
    ['call', 'Hé, viens voir !'],
    ['reply', 'Ouais.'],
    ['radio', "T'es où ? Je te cherche."],
    ['call', '{n}, viens voir !'],
    ['chat', "Attends, j'ai cru entendre un truc."],
    ['door', "Ouvre, c'est moi."],
    ['reply', 'Quoi ?'],
    ['radio', "{n}, t'es où ?"],
    ['call', "J'ai trouvé un fusible, viens !", 'fuse'],
    ['radio', 'Il manque plus qu\'un fusible, je crois que je l\'ai vu. Viens.', 'last'],
    ['call', "Y a plus de courant, t'es où ?", 'dark'],
    ['radio', "Le monte-charge est rallumé, venez, je vous attends.", 'lift'],
    ['reply', 'Attends.'],
    ['chat', "C'est par là, je crois."],
    ['call', 'Par ici, venez !'],
    ['radio', "J'ai trouvé un truc, viens me rejoindre."],
    ['door', '{n}, ouvre, vite !'],
    ['chat', 'Reste avec moi, on se sépare pas.'],
    ['reply', "J'arrive."],
    ['call', 'Attends-moi, je suis juste derrière !'],
    ['chat', "On a combien de fusibles, là ?", 'fuse'],
    ['door', 'Laisse-moi entrer, vite !'],
  ],
  en: [
    ['call', 'Hey, come see this!'],
    ['reply', 'Yeah.'],
    ['radio', "Where are you? I'm looking for you."],
    ['call', '{n}, come here!'],
    ['chat', 'Wait, I think I heard something.'],
    ['door', "Open up, it's me."],
    ['reply', 'What?'],
    ['radio', '{n}, where are you?'],
    ['call', 'I found a fuse, come here!', 'fuse'],
    ['radio', "We only need one more fuse, I think I saw it. Come.", 'last'],
    ['call', "The power's out, where are you?", 'dark'],
    ['radio', "The lift is back on, come on, I'm waiting.", 'lift'],
    ['reply', 'Wait.'],
    ['chat', "It's this way, I think."],
    ['call', 'Over here, come on!'],
    ['radio', 'I found something, come and meet me.'],
    ['door', '{n}, open up, quick!'],
    ['chat', "Stay with me, let's not split up."],
    ['reply', 'Coming.'],
    ['call', "Wait for me, I'm right behind you!"],
    ['chat', 'How many fuses do we have?', 'fuse'],
    ['door', 'Let me in, quick!'],
  ],
};
// Un pseudo se dit-il ? Des lettres seulement, ni trop court ni trop long (« xX_Dark_Xx » ne se prononce pas)
export const sayable = (name) => /^[A-Za-zÀ-ÿ]{3,12}$/.test(String(name || '').trim());
// Les phrases à fabriquer pour la voix d'un joueur : others, les coéquipiers qu'elle peut nommer ({ id, name }) ;
// tic, son mot d'appui (« wesh », « frérot »…), glissé devant les appels et le bavardage
export function linesFor(lang, others = [], tic = '') {
  const out = [];
  const T = tic ? tic[0].toUpperCase() + tic.slice(1) : '';
  (LINES[lang] || LINES.en).forEach(([kind, text, ctx], k) => {
    if (text.includes('{n}')) {
      for (const o of others) if (sayable(o.name)) {
        const n = o.name.trim();
        out.push({ i: `${k}:${o.id}`, kind, ctx, to: o.id, text: text.replace('{n}', n[0].toUpperCase() + n.slice(1).toLowerCase()) });
      }
    } else out.push({ i: `${k}${T && (kind === 'call' || kind === 'chat') ? ':' + tic : ''}`, kind, ctx, text: T && (kind === 'call' || kind === 'chat') ? `${T}, ${text[0].toLowerCase()}${text.slice(1)}` : text });
  });
  return out;
}
const BUNDLE = { fr: 'french_24l', en: 'english_2026-04' };
const REF_S = 10; // s de voix écoutées pour cloner (voir les essais dans vendor/pocket-tts/LISEZMOI.txt)

// voice : createVoice ; lang : 'fr' ou 'en' ; load : () => la classe PocketTTS (les tests en donnent une fausse) ;
// onState : suivi ('loading', 'ready', 'error', 'off') ; names : () => les joueurs ({ id, name }), pour les prénoms
export function createCloner({ voice, lang = 'fr', load = null, onState = null, names = () => [] }) {
  const mine = (id) => linesFor(lang, names().filter((o) => o.id !== id), voice.tic ? voice.tic(id) : '');
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
    tts = new Cls({ language: BUNDLE[lang] || BUNDLE.en, voiceCloning: true, maxRefSeconds: REF_S });
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
          const r = !d || !mine(id).some((l) => !d.made.has(l.i)) ? voice.cloneRef(id) : null;
          // (première fois, ou l'échantillon a bien grossi depuis : au moins 4 s de plus, tant qu'il n'était pas plein)
          if (r && (!d || (d.secs < REF_S && r.secs >= d.secs + 4))) { job = { id, r }; break; }
        }
        if (job) {
          const ref = await tts.cloneVoice(job.r.data, { inputSampleRate: job.r.sr });
          done.set(job.id, { secs: job.r.secs, ref, rms: job.r.rms, made: new Set() });
          continue;
        }
        // une phrase de plus, pour la voix qui en a le moins (les prénoms et le tic arrivent en cours de route : la liste
        // est relue à chaque fois)
        const next = ids.map((id) => [id, done.get(id), mine(id)]).filter(([, d, ls]) => d && ls.some((l) => !d.made.has(l.i))).sort((a, b) => a[1].made.size - b[1].made.size)[0];
        if (!next) break;
        const [id, d, ls] = next;
        const line = ls.find((l) => !d.made.has(l.i));
        const f = await say(line.text, d.ref, d.rms);
        if (!alive) break;
        if (f.buf.length > f.sr * 0.2) voice.addFake(id, line, f.buf, f.sr);
        d.made.add(line.i);
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
      return [...done].map(([id, d]) => ({ id, secs: +d.secs.toFixed(1), lines: d.made.size }));
    },
    dispose() {
      alive = false;
      if (tts) try { tts.destroy(); } catch (e) {}
      tts = null;
      set('off');
    },
  };
}
