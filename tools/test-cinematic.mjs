import assert from 'assert';
import fs from 'fs';
import { playLugiaCinematic } from '../odyssee/js/ui/cinematic.js';
import { Sound } from '../odyssee/js/audio.js';

console.log('=== Test Intégration Cinématique 3D Lugia Obscur ===');

// 1. Vérification du code 3D procédural Three.js & architecture sans vidéo externe
const cineSrc = fs.readFileSync(new URL('../odyssee/js/ui/cinematic.js', import.meta.url), 'utf8');
assert.ok(cineSrc.includes('createLugia3DScene'), 'La scène 3D Three.js doit être définie');
assert.ok(cineSrc.includes('buildSanctuary') && cineSrc.includes('buildBlackPrism') && cineSrc.includes('buildShadowLugia3D'), 'La sculpture 3D procédurale (Sanctuaire, Prisme Noir, Lugia) doit exister');
assert.ok(cineSrc.includes('dispose'), 'La libération des ressources WebGL/Three.js doit être implémentée');
assert.ok(!cineSrc.includes('lugia_dark.mp4'), 'La cinématique ne doit plus dépendre du fichier vidéo MP4');
console.log('✓ Scène 3D procédurale Three.js et nettoyage WebGL vérifiés');

// 2. Vérification de la fonction cinématique
assert.strictEqual(typeof playLugiaCinematic, 'function', 'playLugiaCinematic doit être une fonction exportée');
console.log('✓ playLugiaCinematic est bien exportée sans faire échouer l\'import Node');

// 3. Vérification du sound design synthétisé
const sound = new Sound();
assert.strictEqual(typeof sound.playLugiaCinematicAudio, 'function', 'Sound.prototype.playLugiaCinematicAudio doit être définie');
const audioCtrl = sound.playLugiaCinematicAudio();
assert.ok(audioCtrl && typeof audioCtrl.stop === 'function', 'Le contrôleur audio doit fournir une méthode stop()');
const soundMuted = new Sound();
soundMuted.muted = true;
const mutedCtrl = soundMuted.playLugiaCinematicAudio();
assert.ok(mutedCtrl && typeof mutedCtrl.stop === 'function', 'playLugiaCinematicAudio gère muted proprement');
console.log('✓ Le synthétiseur audio cinématique est fonctionnel');

// 4. Vérification de l\'appel dans story.js & préservation de game.busy + test complet de skip
const storySrc = fs.readFileSync(new URL('../odyssee/js/story.js', import.meta.url), 'utf8');
assert.ok(storySrc.includes('playLugiaCinematic'), 'story.js doit importer et appeler playLugiaCinematic');
assert.ok(storySrc.includes('lugiaWakes'), 'lugiaWakes doit déclencher la cinématique');
assert.ok(cineSrc.includes('prevBusy'), 'playLugiaCinematic doit restaurer prevBusy dans finally');

// 5. Exécution simulée sans WebGL (repli Canvas 2D) avec annulation via clavier
{
  const makeEl = (cls = '') => ({
    className: cls,
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    innerHTML: '',
    isConnected: true,
    clientWidth: 800,
    clientHeight: 450,
    appendChild() {},
    remove() { this.isConnected = false; },
    addEventListener() {},
    getContext: () => null,
    querySelector(sel) {
      if (sel.includes('3d')) return makeEl('lugia-cine-3d');
      if (sel.includes('skip')) return { addEventListener: () => {} };
      return makeEl(sel);
    },
  });
  globalThis.window = globalThis;
  globalThis.location = new URL('http://localhost:3000/odyssee/index.html');
  globalThis.Image = class { set src(_) { setTimeout(() => this.onerror?.(), 0); } };
  globalThis.document = { createElement: () => makeEl() };
  globalThis.requestAnimationFrame ??= (fn) => setTimeout(() => fn(performance.now()), 16);
  globalThis.addEventListener ??= () => {};
  globalThis.removeEventListener ??= () => {};

  let activePop = null;
  const mockGame = {
    busy: false,
    state: { flags: {} },
    save() {},
    ui: {
      root: makeEl('ui'),
      fade: async () => {},
      input: {
        push: (fn) => { activePop = fn; return () => { activePop = null; }; },
      },
    },
    sound: { stopMusic() {}, sfx() {}, muted: false, vol: 0.7 },
  };
  const p = playLugiaCinematic(mockGame);
  setTimeout(() => activePop?.('a'), 380);
  await p;
  assert.strictEqual(mockGame.busy, false, 'game.busy doit revenir à sa valeur d\'origine après la cinématique');
  assert.strictEqual(mockGame.state.flags.seenLugiaCinematic, true, 'seenLugiaCinematic doit être activé à la fin');
  console.log('✓ Déroulement simulé, skip clavier et restauration de game.busy validés');
}

console.log('\n=== Tous les tests de cinématique sont validés avec succès ! ===');
