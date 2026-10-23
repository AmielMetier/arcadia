// Python dans le navigateur pour l'épreuve de code de The Candidate : Pyodide tourne dans un Worker à part,
// coupé du réseau une fois chargé, et un programme trop long (boucle infinie) est arrêté puis le Worker recréé.
// Chaque exécution porte un jeton tiré ici : le code du joueur ne peut pas fabriquer lui-même un « tous les tests passent ».
const BASE = 'https://cdn.jsdelivr.net/pyodide/v0.27.7/full/';
const RUN_MS = 4000;

const WORKER = `
const post = self.postMessage.bind(self);
let py = null;
const out = [];
self.onmessage = async (e) => {
  const m = e.data;
  if (m.t === 'load') {
    try {
      importScripts(${JSON.stringify(BASE)} + 'pyodide.js');
      py = await loadPyodide({ indexURL: ${JSON.stringify(BASE)}, stdout: (s) => { if (out.length < 80) out.push(s); }, stderr: (s) => { if (out.length < 80) out.push(s); } });
      // SQLite pour les épreuves SQL (chargé avant de couper le réseau)
      try { await py.loadPackage('sqlite3'); } catch (err) { /* sans lui, seules les épreuves SQL échouent */ }
      // plus de réseau pour le code des joueurs
      for (const k of ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'loadPyodide']) {
        try { Object.defineProperty(self, k, { value: undefined, writable: false, configurable: false }); } catch (err) {}
      }
      post({ t: 'ready' });
    } catch (err) { post({ t: 'fail', msg: String(err && err.message || err) }); }
    return;
  }
  if (m.t === 'run') {
    const tok = m.tok;
    out.length = 0;
    let res = null;
    try {
      const ns = py.globals.get('dict')();
      py.runPython(m.program, { globals: ns });
      res = ns.get('__RESULT');
      ns.destroy();
    } catch (err) {
      const lines = String(err && err.message || err).split('\\n').filter(Boolean);
      res = JSON.stringify({ error: lines[lines.length - 1] || 'Erreur Python', tests: [] });
    }
    post({ t: 'res', tok, res: typeof res === 'string' ? res : null, stdout: out.join('\\n').slice(0, 2000) });
  }
};`;

let worker = null, ready = null, chain = Promise.resolve();
let listener = null; // le seul message attendu : la réponse à l'exécution en cours

function spawn() {
  if (ready) return ready;
  const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
  worker = new Worker(url);
  URL.revokeObjectURL(url);
  ready = new Promise((resolve, reject) => {
    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.t === 'ready') resolve();
      else if (m.t === 'fail') reject(new Error(m.msg));
      else if (listener) listener(m);
    };
    worker.onerror = (e) => { e.preventDefault(); reject(new Error('Python n’a pas pu démarrer')); if (listener) listener({ t: 'crash' }); };
  });
  ready.catch(() => { kill(); });
  worker.postMessage({ t: 'load' });
  return ready;
}
function kill() {
  if (worker) worker.terminate();
  worker = null; ready = null;
}

// Télécharge Pyodide d'avance (quelques secondes, une seule fois) : appelé dès qu'une partie The Candidate commence
export function preloadPython() { spawn().catch(() => {}); }

// Exécute un programme (voir buildProgram) → { error, tests:[{ ok, got|err }], stdout }
export function runPython(program, { timeout = RUN_MS } = {}) {
  const job = chain.then(() => once(program, timeout));
  chain = job.catch(() => {});
  return job;
}

async function once(program, timeout) {
  try { await spawn(); }
  catch (e) { return { error: 'Python indisponible (connexion ?) : ' + e.message, tests: [], offline: true }; }
  const tok = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      listener = null; kill();
      resolve({ error: `Temps dépassé (${timeout / 1000} s) : une boucle sans fin ?`, tests: [] });
    }, timeout);
    listener = (m) => {
      if (m.t === 'crash') { clearTimeout(timer); listener = null; kill(); resolve({ error: 'Le programme a planté (mémoire ?)', tests: [] }); return; }
      if (m.t !== 'res' || m.tok !== tok) return;
      clearTimeout(timer); listener = null;
      let out = null;
      try { out = JSON.parse(m.res); } catch (e) { /* résultat illisible */ }
      if (!out || typeof out !== 'object' || !Array.isArray(out.tests)) out = { error: 'Résultat illisible', tests: [] };
      resolve({ error: out.error || null, tests: out.tests.map((t) => ({ ok: t.ok === true, got: t.got, err: t.err })), stdout: m.stdout || '' });
    };
    worker.postMessage({ t: 'run', tok, program });
  });
}
