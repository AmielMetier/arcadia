// Données enregistrées (clé synapse_v1) : valeurs par défaut et validation, pour l'import comme au démarrage.
// Tout est reconstruit champ par champ : rien d'inconnu ne passe.
import { MODES } from './levels.js';
import { GAPS } from './press.js';

export const VERSION = 1;
export const MAX_HISTORY = 1000, MAX_SAMPLES = 300, MAX_BYTES = 2_000_000;

export const defaults = () => ({
  v: VERSION,
  settings: { gap: 120, calib: 0, calm: false },
  levels: Object.fromEntries(MODES.map((m) => [m, 1])),
  history: [],
});

class Invalid extends Error {}
const fail = (msg) => { throw new Invalid(msg); };
const isObj = (o) => o !== null && typeof o === 'object' && !Array.isArray(o);
function num(v, min, max, what, int = false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (int && !Number.isInteger(v))) fail(`valeur hors bornes : ${what}`);
  return v;
}
function samples(a, what) {
  if (!Array.isArray(a) || a.length > MAX_SAMPLES) fail(`liste invalide : ${what}`);
  return a.map((x) => num(x, 0, 60000, what));
}
function game(g, i) {
  if (!isObj(g)) fail(`partie n° ${i + 1} illisible`);
  if (!MODES.includes(g.mode)) fail(`mode inconnu dans la partie n° ${i + 1}`);
  if (typeof g.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(g.day)) fail(`date invalide dans la partie n° ${i + 1}`);
  if (!isObj(g.m)) fail(`indicateurs absents dans la partie n° ${i + 1}`);
  const m = g.m;
  const out = {
    at: num(g.at, 0, 8.64e15, 'heure', true), day: g.day, mode: g.mode,
    dur: num(g.dur, 0, 3600, 'durée'), score: num(g.score, 0, 1e7, 'score', true),
    best: num(g.best, 0, 1e5, 'meilleure série', true), acc: num(g.acc, 0, 100, 'réussite'),
    trials: num(g.trials, 0, 1e5, 'essais', true),
    lv0: num(g.lv0, 1, 10, 'niveau', true), lv1: num(g.lv1, 1, 10, 'niveau', true),
    session: g.session === true,
    m: {
      rt: samples(m.rt, 'temps de réponse'), sw: samples(m.sw, 'temps après changement'), rep: samples(m.rep, 'temps'),
      lureN: num(m.lureN, 0, 1e5, 'leurres', true), lureOk: num(m.lureOk, 0, 1e5, 'leurres évités', true),
      beatN: num(m.beatN, 0, 1e5, 'temps', true), beatSum: num(m.beatSum, 0, 1e5, 'justesse'),
    },
  };
  if (out.m.lureOk > out.m.lureN || out.m.beatSum > out.m.beatN) fail(`indicateurs incohérents dans la partie n° ${i + 1}`);
  return out;
}

// Renvoie { ok: true, data } ou { ok: false, error } (message lisible).
export function validate(raw) {
  try {
    if (!isObj(raw)) fail('ce fichier ne contient pas de données Synapse');
    if (raw.v !== VERSION) fail('version de fichier inconnue');
    const s = raw.settings, l = raw.levels;
    if (!isObj(s) || !isObj(l) || !Array.isArray(raw.history)) fail('structure inattendue');
    if (!GAPS.includes(s.gap)) fail('filtre des doubles appuis invalide');
    if (typeof s.calm !== 'boolean') fail('réglage des animations invalide');
    const data = {
      v: VERSION,
      settings: { gap: s.gap, calib: num(s.calib, -300, 300, 'calage', true), calm: s.calm },
      levels: Object.fromEntries(MODES.map((m) => [m, num(l[m], 1, 10, 'niveau ' + m, true)])),
      history: raw.history.slice(-MAX_HISTORY).map(game),
    };
    return { ok: true, data };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}

// Lecture d'un texte (fichier importé ou localStorage).
export function parse(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return { ok: false, error: 'fichier trop volumineux' };
  let raw;
  try { raw = JSON.parse(text); } catch (e) { return { ok: false, error: 'fichier JSON illisible' }; }
  return validate(raw);
}
