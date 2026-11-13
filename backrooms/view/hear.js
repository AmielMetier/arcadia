// Ce que dit le joueur, en texte. Chaque joueur qui a autorisé le clonage de sa voix transcrit ses propres phrases
// dans son navigateur (Whisper, hear-worker.js) et n'envoie que le texte à ses coéquipiers : ils savent alors ce que
// veut dire chaque phrase gardée (l'entité choisit celles qui collent à la situation et laisse celles qui la
// trahiraient, senseOf de voice.js) et quels mots d'appui il emploie (ticOf). Le son ne quitte pas le navigateur.
// Si le modèle ne se charge pas, tout marche comme avant, sans le sens.
// (essayé dans Chrome : « tiny » se trompe trop sur du français parlé ; « base » met 3 à 4 s par phrase, dans son fil)
const MODEL = 'onnx-community/whisper-base';

// Whisper invente parfois sur du bruit ou du silence : sous-titres, musique, remerciements. On jette
const JUNK = /sous-titr|amara\.org|merci d'avoir regard|abonnez|♪|\[.*\]|\(.*\)|thanks for watching|subtitles/i;
export function cleanText(t) {
  t = String(t || '').replace(/\s+/g, ' ').trim();
  if (!t || JUNK.test(t) || !/[a-zà-ÿ]{2}/i.test(t)) return '';
  return t.slice(0, 120);
}

// lang : 'fr' ou 'en' ; onText(n, texte) ; make : () => un Worker (les tests en donnent un faux)
export function createHearer({ lang = 'fr', onText, make = null }) {
  let worker = null;
  let dead = false;
  let busy = false;
  const queue = []; // les phrases en attente (les plus anciennes sont jetées : le sens n'est qu'un plus)
  function next() {
    if (busy || dead || !queue.length) return;
    if (!worker) {
      try {
        worker = make ? make() : new Worker(new URL('./hear-worker.js' + new URL(import.meta.url).search, import.meta.url), { type: 'module' });
      } catch (e) {
        dead = true;
        return;
      }
      worker.onmessage = (e) => {
        busy = false;
        if (e.data.error) { // (pas de réseau, navigateur trop ancien : on n'insiste pas)
          dead = true;
          worker.terminate();
          return;
        }
        const t = cleanText(e.data.text);
        if (t && onText) onText(e.data.id, t);
        next();
      };
      worker.onerror = () => {
        dead = true;
      };
    }
    const job = queue.shift();
    busy = true;
    worker.postMessage({ id: job.n, audio: job.audio, lang: lang === 'fr' ? 'french' : 'english', model: MODEL }, [job.audio.buffer]);
  }
  return {
    get dead() { return dead; },
    push(n, audio) {
      if (dead) return;
      queue.push({ n, audio });
      while (queue.length > 3) queue.shift();
      next();
    },
    dispose() {
      dead = true;
      queue.length = 0;
      if (worker) worker.terminate();
      worker = null;
    },
  };
}
