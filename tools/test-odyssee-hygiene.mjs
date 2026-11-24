// tools/test-odyssee-hygiene.mjs — tests d'hygiène du code (Point 3) : core/safe.js, zéro catch vide, et API/prototypes des modules extraits.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import moduleApi from 'node:module';

// Reproduire l'importmap d'odyssee/index.html ("three" -> shared/vendor/three/three.module.min.js) sous Node
const threeUrl = new URL('../shared/vendor/three/three.module.min.js', import.meta.url).href;
if (typeof moduleApi.registerHooks === 'function') {
  moduleApi.registerHooks({
    resolve(specifier, context, nextResolve) {
      if (specifier === 'three') return { url: threeUrl, shortCircuit: true };
      return nextResolve(specifier, context);
    },
  });
} else if (typeof moduleApi.register === 'function') {
  const hook = `export async function resolve(s, c, n) { return s === 'three' ? { url: ${JSON.stringify(threeUrl)}, shortCircuit: true } : n(s, c); }`;
  moduleApi.register('data:text/javascript,' + encodeURIComponent(hook));
}

const safeMod = await import('../odyssee/js/core/safe.js');
const { isDebug, warnDev, storeGet, storeSet, storeDel, sessGet, sessSet, sessPop } = safeMod;

// ---------------- 1. Tests unitaires de core/safe.js ----------------
const origDescriptors = {
  window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
  location: Object.getOwnPropertyDescriptor(globalThis, 'location'),
  localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
  sessionStorage: Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage'),
  consoleWarn: console.warn,
};

function restoreGlobals() {
  for (const key of ['window', 'location', 'localStorage', 'sessionStorage']) {
    if (origDescriptors[key]) Object.defineProperty(globalThis, key, origDescriptors[key]);
    else delete globalThis[key];
  }
  console.warn = origDescriptors.consoleWarn;
}

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { map.set(k, String(v)); },
    removeItem(k) { map.delete(k); },
  };
}

try {
  // isDebug sans window
  delete globalThis.window;
  assert.equal(isDebug(), false, 'isDebug() doit être false sans window');

  // isDebug par défaut / __ODY_DEBUG / query string
  globalThis.window = { location: { search: '' } };
  assert.equal(isDebug(), false, 'isDebug() doit être false par défaut');

  globalThis.window = { __ODY_DEBUG: true, location: { search: '' } };
  assert.equal(isDebug(), true, 'isDebug() doit être true avec __ODY_DEBUG = true');

  globalThis.window = { location: { search: '?foo=1&debug=1' } };
  assert.equal(isDebug(), true, 'isDebug() doit être true avec ?foo=1&debug=1');

  globalThis.window = { location: { search: '?debugged=1' } };
  assert.equal(isDebug(), false, 'isDebug() doit ignorer ?debugged=1');

  globalThis.window = {
    get location() { throw new Error('SecurityError'); },
  };
  assert.equal(isDebug(), false, 'isDebug() doit renvoyer false si location jette une erreur');

  // warnDev silencieuse hors debug, active en debug, et sûre si err falsy ou console.warn jette
  const warns = [];
  console.warn = (...args) => warns.push(args);

  globalThis.window = { location: { search: '' } };
  warnDev('test', new Error('boom'));
  assert.equal(warns.length, 0, 'warnDev doit rester silencieuse hors mode debug');

  globalThis.window = { __ODY_DEBUG: true, location: { search: '' } };
  warnDev('test', null);
  warnDev('test', undefined);
  assert.equal(warns.length, 0, 'warnDev doit ignorer les erreurs falsy');

  const sampleErr = new Error('boom');
  warnDev('test', sampleErr);
  assert.equal(warns.length, 1, 'warnDev doit appeler console.warn en mode debug');
  assert.equal(warns[0][0], '[Odyssée:test]');
  assert.equal(warns[0][1], sampleErr);

  console.warn = () => { throw new Error('console disabled'); };
  assert.doesNotThrow(() => warnDev('test', sampleErr), 'warnDev ne doit pas jeter si console.warn échoue');
  console.warn = (...args) => warns.push(args);

  // storeGet / storeSet / storeDel — cas nominal et cas d'erreur
  globalThis.localStorage = makeMemoryStorage();
  assert.equal(storeGet('k', 'def'), 'def');
  assert.equal(storeSet('k', 42), true);
  assert.equal(storeGet('k', 'def'), '42');
  assert.equal(storeDel('k'), true);
  assert.equal(storeGet('k', 'def'), 'def');

  globalThis.localStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  const beforeStorageWarn = warns.length;
  assert.equal(storeGet('k', 'fallback'), 'fallback');
  assert.equal(storeSet('k', 'v'), false);
  assert.equal(storeDel('k'), false);
  assert.equal(warns.length - beforeStorageWarn, 3, 'les erreurs storage doivent être journalisées via warnDev en debug');

  // sessGet / sessSet / sessPop — cas nominal et cas d'erreur
  globalThis.sessionStorage = makeMemoryStorage();
  assert.equal(sessGet('sk', 'sdef'), 'sdef');
  assert.equal(sessSet('sk', 'continue'), true);
  assert.equal(sessGet('sk', null), 'continue');
  assert.equal(sessPop('sk', null), 'continue');
  assert.equal(sessGet('sk', 'gone'), 'gone', 'sessPop doit supprimer la clé après lecture');

  globalThis.sessionStorage = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota'); },
    removeItem() { throw new Error('blocked'); },
  };
  assert.equal(sessGet('sk', 'fb'), 'fb');
  assert.equal(sessSet('sk', 'x'), false);
  assert.equal(sessPop('sk', 'fb2'), 'fb2');
} finally {
  restoreGlobals();
}
console.log('✓ core/safe.js (isDebug, warnDev, storeGet/Set/Del, sessGet/Set/Pop) validé');

// ---------------- 2. Zéro catch vide dans odyssee/js/ ----------------
const jsRoot = path.resolve(new URL('../odyssee/js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
function walkJs(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkJs(full));
    else if (ent.name.endsWith('.js')) out.push(full);
  }
  return out;
}

const emptyCatches = [];
for (const file of walkJs(jsRoot)) {
  const rel = path.relative(jsRoot, file).replace(/\\/g, '/');
  if (rel === 'data/monde-cache.js') continue;
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/\bcatch\s*(?:\([^)]*\))?\s*\{\s*\}/g)) {
    const line = src.slice(0, m.index).split(/\r?\n/).length;
    emptyCatches.push(`${rel}:${line}: ${m[0].replace(/\s+/g, ' ')}`);
  }
  for (const m of src.matchAll(/\.catch\(\s*(?:\(\s*[^)]*\)|[A-Za-z0-9_$]+)?\s*=>\s*\{\s*\}\s*\)/g)) {
    const line = src.slice(0, m.index).split(/\r?\n/).length;
    emptyCatches.push(`${rel}:${line}: ${m[0].replace(/\s+/g, ' ')}`);
  }
}
assert.deepEqual(emptyCatches, [], `Aucun catch vide autorisé dans odyssee/js/:\n${emptyCatches.join('\n')}`);
console.log('✓ Zéro catch vide et zéro .catch(() => {}) dans odyssee/js/');

// ---------------- 3. Compatibilité des exports et prototypes extraits ----------------
globalThis.location = new URL('http://localhost:3000/index.html');
globalThis.window = globalThis;
globalThis.document = {
  createElement: (tag) => ({
    tagName: tag.toUpperCase(),
    className: '',
    style: {},
    dataset: {},
    classList: { toggle: () => {}, add: () => {}, remove: () => {} },
    appendChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    remove: () => {},
  }),
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
  removeEventListener: () => {},
};

try {
  const [audioBoss, audio, battleHelpers, battleAi, battle, puzzles, triggers, worldEvents, gameMod] = await Promise.all([
    import('../odyssee/js/audio-boss.js'),
    import('../odyssee/js/audio.js'),
    import('../odyssee/js/core/battle-helpers.js'),
    import('../odyssee/js/core/battle-ai.js'),
    import('../odyssee/js/core/battle.js'),
    import('../odyssee/js/game/puzzles.js'),
    import('../odyssee/js/game/triggers.js'),
    import('../odyssee/js/game/world-events.js'),
    import('../odyssee/js/game.js'),
  ]);

  // Audio
  assert.ok(Array.isArray(audioBoss.CINE_AUDIO_KEYS) && audioBoss.CINE_AUDIO_KEYS.length >= 20);
  assert.deepEqual(audio.CINE_AUDIO_KEYS, audioBoss.CINE_AUDIO_KEYS);
  assert.equal(typeof audio.Sound.prototype.playBossCinematicAudio, 'function');

  // Combat
  assert.deepEqual(battle.STAGE_NAMES, battleHelpers.STAGE_NAMES);
  assert.equal(battle.typeEff, battleHelpers.typeEff);
  assert.equal(battle.hiddenPower, battleHelpers.hiddenPower);
  for (const fn of ['foeThreatInfo', 'foePickBestReplacement', 'foeConsiderSwitch', 'foeChooseAll', 'foeChoose', 'foeChooseSlot', 'damagePreview', 'estimate']) {
    assert.equal(typeof battle.Battle.prototype[fn], 'function', `Battle.prototype.${fn} manquant`);
    if (fn !== 'foeChoose') assert.equal(typeof battleAi[fn], 'function', `battleAi.${fn} manquant`);
  }

  // Jeu et sous-modules
  assert.ok(worldEvents.GYM_HINTS && Object.keys(worldEvents.GYM_HINTS).length >= 10, 'GYM_HINTS doit être exporté');
  assert.ok(triggers.RIVAL_TEAMS && Object.keys(triggers.RIVAL_TEAMS).length >= 9, 'RIVAL_TEAMS doit être exporté');
  for (const fn of ['glisse', 'dalle', 'souffle', 'remiseSerre', 'pupitreSerre', 'teleporte', 'savoir', 'pylon', 'stele', 'shrine']) {
    assert.equal(typeof puzzles[fn], 'function', `puzzles.${fn} manquant`);
    assert.equal(typeof gameMod.Game.prototype[fn], 'function', `Game.prototype.${fn} manquant`);
  }
  for (const fn of ['reveilBetes', 'spawnLegends', 'legendReady', 'legendBattle', 'ferry', 'odyssorEvent']) {
    assert.equal(typeof worldEvents[fn], 'function', `worldEvents.${fn} manquant`);
    assert.equal(typeof gameMod.Game.prototype[fn], 'function', `Game.prototype.${fn} manquant`);
  }
  assert.equal(typeof worldEvents.runNpcScript, 'function');
  for (const fn of ['spawnAhead', 'trigger']) {
    assert.equal(typeof triggers[fn], 'function', `triggers.${fn} manquant`);
    assert.equal(typeof gameMod.Game.prototype[fn], 'function', `Game.prototype.${fn} manquant`);
  }
  for (const fn of ['script', 'ending', 'checkNearbySigns', 'promptStarterChoice']) {
    assert.equal(typeof gameMod.Game.prototype[fn], 'function', `Game.prototype.${fn} manquant`);
  }
  console.log('✓ Exports et délégations de prototypes (audio, battle, game) validés');
} finally {
  restoreGlobals();
}

console.log('HYGIENE_TESTS_OK');
