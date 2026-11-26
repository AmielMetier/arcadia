// tools/test-odyssee-lot4.mjs — tests de régression Lot 4 (AZERTY, UI/repeat, savecode, audio mute/init, assets timer, options/dex souris, intégration UX)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

const listeners = new Map();
globalThis.addEventListener = (type, fn, opts) => {
  if (!listeners.has(type)) listeners.set(type, []);
  listeners.get(type).push({ fn, once: !!opts?.once });
};
globalThis.removeEventListener = (type, fn) => {
  const arr = listeners.get(type);
  if (!arr) return;
  listeners.set(type, arr.filter((x) => x.fn !== fn));
};
const fire = (type, ev = {}) => {
  for (const item of [...(listeners.get(type) || [])]) {
    if (item.once) removeEventListener(type, item.fn);
    item.fn(ev);
  }
};

globalThis.window = globalThis;
globalThis.location = new URL('http://localhost:3000/odyssee/index.html');
const ls = new Map();
globalThis.localStorage = { getItem: (k) => (ls.has(k) ? ls.get(k) : null), setItem: (k, v) => ls.set(k, String(v)) };
globalThis.requestAnimationFrame ??= (fn) => setTimeout(() => fn(performance.now()), 16);

function makeEl(tag = 'div') {
  const evs = new Map();
  const cls = new Set();
  let _html = '';
  const el = {
    tagName: tag.toUpperCase(),
    className: '',
    isConnected: true,
    children: [],
    dataset: {},
    style: { setProperty() {}, removeProperty() {} },
    classList: {
      add: (...c) => c.forEach((k) => cls.add(k)),
      remove: (...c) => c.forEach((k) => cls.delete(k)),
      toggle: (c, f) => (f === undefined ? (cls.has(c) ? cls.delete(c) : cls.add(c)) : f ? cls.add(c) : cls.delete(c)),
      contains: (c) => cls.has(c),
    },
    get innerHTML() { return _html; },
    set innerHTML(v) {
      _html = String(v);
      this._rows = [..._html.matchAll(/data-opt="(\d+)"/g)].map((m) => makeEl('div'));
    },
    appendChild(ch) { this.children.push(ch); return ch; },
    append(...chs) { this.children.push(...chs); },
    remove() { this.isConnected = false; },
    scrollIntoView() {},
    getBoundingClientRect: () => ({ left: 100, top: 100, width: 100, height: 24 }),
    addEventListener(t, fn) { if (!evs.has(t)) evs.set(t, []); evs.get(t).push(fn); },
    removeEventListener(t, fn) { if (evs.has(t)) evs.set(t, evs.get(t).filter((f) => f !== fn)); },
    trigger(t, e = {}) {
      for (const fn of [...(evs.get(t) || [])]) fn({ stopPropagation() {}, preventDefault() {}, clientX: 180, ...e });
    },
    querySelector(sel) {
      if (sel === '.dlg-txt') return (this._dlgTxt ||= makeEl('div'));
      if (sel === '.dlg-arrow') return (this._dlgArrow ||= makeEl('div'));
      if (sel === '.dlg-name') return (this._dlgName ||= makeEl('div'));
      if (sel === '.box.opts') return this._optBox || this;
      if (sel === '.dex-list') return (this._dexList ||= { ...makeEl('div'), children: Array.from({ length: 10 }, () => makeEl('div')) });
      if (sel === '.dex-spr') return (this._dexSpr ||= makeEl('img'));
      if (sel === '.dex-info') return (this._dexInfo ||= makeEl('div'));
      if (sel === '[data-act="close"]') return (this._closeBtn ||= makeEl('button'));
      return makeEl('div');
    },
    querySelectorAll(sel) {
      if (sel === '.list-row') return this._rows || [];
      return [];
    },
  };
  return el;
}

globalThis.document = {
  createElement: (tag) => makeEl(tag),
  documentElement: { classList: { add() {}, remove() {} }, style: { setProperty() {} } },
  addEventListener: globalThis.addEventListener,
};

console.log('=== Tests de régression Lot 4 ===');

// 1. Clavier AZERTY / QWERTY et blur
{
  const { Input, resolveKey } = await import('../odyssee/js/input.js');
  assert.equal(resolveKey({ code: 'KeyA', key: 'q' }), 'left', 'AZERTY Q (KeyA) -> left');
  assert.equal(resolveKey({ code: 'KeyQ', key: 'a' }), null, 'AZERTY A (KeyQ) ne déclenche pas Quêtes');
  assert.equal(resolveKey({ code: 'Semicolon', key: 'm' }), 'menu', 'AZERTY M (Semicolon) -> menu');
  assert.equal(resolveKey({ code: 'KeyJ', key: 'j' }), 'quests', 'J -> quests');
  assert.equal(resolveKey({ code: 'KeyQ', key: 'q' }), 'quests', 'QWERTY Q (KeyQ) -> quests');
  assert.equal(resolveKey({ code: 'KeyB', key: 'b' }), 'ball', 'KeyB -> ball');
  assert.equal(resolveKey({ code: 'KeyY', key: 'y' }), 'ball', 'KeyY -> ball');

  const inp = new Input();
  fire('keydown', { code: 'ShiftLeft', key: 'Shift', target: {}, preventDefault() {} });
  assert.equal(inp.isDown('run'), true, 'ShiftLeft active run');
  fire('blur', {});
  assert.equal(inp.isDown('run'), false, 'blur relâche run');
  console.log('✓ Input AZERTY/QWERTY et blur OK');
}

// 2. UI typePage overlap + ignore repeat sur list/typePage
{
  const { Input } = await import('../odyssee/js/input.js');
  const { UI } = await import('../odyssee/js/ui/ui.js');
  const inp = new Input();
  const root = makeEl('div');
  const ui = new UI(root, inp, { sfx() {} });
  ui.textSpeed = 3; // instantané

  const box = ui.dialogBox({ speaker: 'Test' });
  let p1Done = false, p2Done = false;
  const p1 = ui.typePage(box, 'Première').then(() => { p1Done = true; });
  const p2 = ui.typePage(box, 'Seconde').then(() => { p2Done = true; });
  await p1;
  assert.equal(p1Done, true, 'typePage précédent annulé proprement lors d\'un appel concurrent');
  await new Promise((r) => setTimeout(r, 35));
  inp.appui('a', true);   // repeat ignoré
  assert.equal(p2Done, false, 'repeat sur a ne ferme pas typePage');
  inp.appui('a', false);
  await p2;
  assert.equal(p2Done, true, 'appui non répété ferme typePage');

  let listRes = null;
  const lp = ui.list({ items: [{ label: 'Choix 1' }, { label: 'Annuler' }], cancel: 1 }).then((r) => { listRes = r; });
  inp.appui('a', true);
  assert.equal(listRes, null, 'repeat sur a ne valide pas list');
  inp.appui('b', true);
  assert.equal(listRes, null, 'repeat sur b ne ferme pas list');
  inp.appui('b', false);
  await lp;
  assert.equal(listRes, 1, 'appui simple b ferme list');
  console.log('✓ UI typePage anti-race & anti-repeat OK');
}

// 3. savecode checkState
{
  const { checkState } = await import('../odyssee/js/core/savecode.js');
  const valid = {
    v: 2, name: 'Léa', party: [{ sp: 25, lvl: 12, moves: [], stats: [30, 15, 15, 15, 15, 20] }],
    box: [], badges: Array(15).fill(false), bag: { 'poke-ball': 5 }, flags: {}, dex: { seen: [25], caught: [25] },
    map: 'monde', x: 10, y: 10,
  };
  assert.equal(checkState(valid), null, 'sauvegarde valide acceptée');
  assert.notEqual(checkState({ ...valid, bag: null }), null, 'refuse bag absent');
  assert.notEqual(checkState({ ...valid, flags: [] }), null, 'refuse flags tableau');
  assert.notEqual(checkState({ ...valid, dex: {} }), null, 'refuse dex incomplet');
  assert.notEqual(checkState({ ...valid, party: [{ sp: 999999, lvl: 10, moves: [], stats: [] }] }), null, 'refuse espèce inconnue');
  assert.notEqual(checkState({ ...valid, party: [{ sp: 25, lvl: 150, moves: [], stats: [] }] }), null, 'refuse niveau > 100');
  console.log('✓ savecode checkState strict OK');
}

// 4. Audio setMuted + cry + playBossCinematicAudio init
{
  let audioCount = 0;
  globalThis.Audio = class { constructor() { audioCount++; this.volume = 1; } play() { return Promise.resolve(); } };
  globalThis.AudioContext = class {
    constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
    createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} }, connect() {} }; }
    createOscillator() { return { type: 'sine', frequency: { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
    createBiquadFilter() { return { type: 'lowpass', frequency: { value: 1000, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, Q: { value: 1 }, connect() {} }; }
    createBufferSource() { return { buffer: null, loop: false, connect() {}, start() {}, stop() {} }; }
    createBuffer() { return { getChannelData: () => new Float32Array(256) }; }
    createWaveShaper() { return { curve: null, oversample: 'none', connect() {} }; }
    resume() { return Promise.resolve(); }
    suspend() { return Promise.resolve(); }
  };
  const { Sound } = await import('../odyssee/js/audio.js');
  const s = new Sound();
  s.setMuted(true);
  assert.equal(ls.get('odyssee-muted'), '1', 'setMuted persiste dans localStorage');
  s.cry('snd/cris/25.ogg');
  assert.equal(audioCount, 0, 'cry() n\'instancier pas Audio quand muted=true');
  s.setMuted(false);
  let initCalled = false;
  const origInit = s.init.bind(s);
  s.init = (...a) => { initCalled = true; return origInit(...a); };
  const ctrl = s.playBossCinematicAudio('fire', 4.0);
  ctrl.stop();
  assert.equal(initCalled, true, 'playBossCinematicAudio débloque via init()');
  console.log('✓ Audio mute + cry + playBossCinematicAudio OK');
}

// 5. assets loadImg clearTimeout
{
  const cleared = [];
  const origSet = globalThis.setTimeout;
  const origClr = globalThis.clearTimeout;
  let fakeId = 1000;
  const timers = [];
  globalThis.setTimeout = (fn, ms) => {
    if (ms === 8000) { const id = ++fakeId; timers.push(id); return id; }
    return origSet(fn, ms);
  };
  globalThis.clearTimeout = (id) => {
    if (id > 1000) cleared.push(id);
    else origClr(id);
  };
  globalThis.Image = class {
    set src(_) { queueMicrotask(() => this.onload?.()); }
  };
  const { loadImg } = await import('../odyssee/js/assets.js');
  await loadImg('img/test.png');
  globalThis.setTimeout = origSet;
  globalThis.clearTimeout = origClr;
  assert.ok(timers.length === 1 && cleared.includes(timers[0]), 'loadImg annule le timeout 8s au chargement');
  console.log('✓ assets loadImg clearTimeout OK');
}

// 6. Options souris & Pokédex bouton fermeture
{
  const { Input } = await import('../odyssee/js/input.js');
  const { UI } = await import('../odyssee/js/ui/ui.js');
  const { optionsScreen, dexScreen } = await import('../odyssee/js/ui/screens.js');
  const inp = new Input();
  const root = makeEl('div');
  const snd = { vol: 0.7, muted: false, style: 'moderne', sfx() {}, cry() {}, setVolume(v) { this.vol = v; }, setMuted(v) { this.muted = v; }, setStyle(st) { this.style = st; } };
  const ui = new UI(root, inp, snd);
  const game = {
    ui, sound: snd, runSpeed: 1, followOff: false,
    state: { dex: { seen: [1], caught: [1], seenCount: { 1: 1 } } },
    hud: { dexnavHidden: false, update() {}, reglage: () => 'Masqué', setDexnavHidden(v) { this.dexnavHidden = v; }, changerReglage() {} },
  };
  const optP = optionsScreen(game);
  const optScr = root.children[root.children.length - 1];
  const optBox = optScr.children[optScr.children.length - 1];
  optBox.trigger('click', { target: { closest: () => ({ dataset: { opt: '3' }, querySelector: () => makeEl('span') }) } });
  assert.equal(snd.muted, true, 'Options : clic ligne Son active le mode muet');
  optBox.trigger('click', { target: { closest: () => ({ dataset: { opt: '12' }, querySelector: () => null }) } });
  const optRes = await optP;
  assert.equal(optRes.reload, false, 'Options : clic ligne Retour ferme l\'écran');

  let dexClosed = false;
  const dexP = dexScreen(game).then(() => { dexClosed = true; });
  const dexScr = root.children[root.children.length - 1];
  dexScr._closeBtn.trigger('click');
  await dexP;
  assert.equal(dexClosed, true, 'Pokédex : bouton ✕ ferme l\'écran');
  console.log('✓ Options (souris) et Pokédex (fermeture ✕) OK');
}

// 7. Vérifications statiques d'intégration Lot 4
{
  const gameSrc = fs.readFileSync('odyssee/js/game.js', 'utf8');
  assert.ok(gameSrc.includes("learnMoveScreen(this, m, moveId)"), 'game.js doit appeler learnMoveScreen');
  // la partie se sauvegarde toute seule : plus de bouton Sauvegarder dans le menu Pause
  assert.ok(!gameSrc.includes("['Sauvegarder', 'save']"), 'le menu Pause ne doit plus proposer Sauvegarder');

  const cineSrc = fs.readFileSync('odyssee/js/ui/cinematic.js', 'utf8');
  const lugiaSrc = fs.readFileSync('odyssee/js/ui/cine-lugia.js', 'utf8');
  assert.ok(cineSrc.includes('forceContextLoss'), 'cinematic.js doit appeler forceContextLoss');
  assert.ok(lugiaSrc.includes('forceContextLoss'), 'cine-lugia.js doit appeler forceContextLoss');

  const tacSrc = fs.readFileSync('odyssee/js/tactile.js', 'utf8');
  assert.ok(tacSrc.includes('z-index: 16'), 'tactile.js doit abaisser z-index à 16');
  assert.ok(tacSrc.includes('~ .tactile { display: none !important; }'), 'tactile.js doit masquer .tactile hors exploration');

  const hudCss = fs.readFileSync('odyssee/css/10-hud.css', 'utf8');
  assert.ok(!hudCss.includes('.hud.collapsed .hud-gear { display: none; }'), '10-hud.css ne doit plus masquer entièrement .hud-gear replié');
  assert.ok(hudCss.includes('.chat-modal-overlay') && hudCss.includes('.starter-select-modal'), '10-hud.css masque le HUD sous les modales');

  const html = fs.readFileSync('odyssee/index.html', 'utf8');
  assert.ok(html.includes('css/odyssee.bundle.css'), 'odyssee/index.html utilise le bundle CSS');

  const mainSrc = fs.readFileSync('odyssee/js/main.js', 'utf8');
  assert.ok(mainSrc.includes("'touchend'") && mainSrc.includes("'click'"), 'main.js doit enregistrer touchend et click pour le déblocage audio Safari/iOS');
  const audioSrc = fs.readFileSync('odyssee/js/audio.js', 'utf8');
  assert.ok(audioSrc.includes('resume().catch'), 'audio.js doit gérer resume().catch() sans rejet non capturé');
  console.log('✓ Contrôles d\'intégration Lot 4 OK');
}

console.log('\nLOT 4 UX/UI & BOOT : TOUS LES TESTS SONT AU VERT');
