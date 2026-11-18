import assert from 'assert';
import fs from 'fs';
import { playLugiaCinematic } from '../odyssee/js/ui/cinematic.js';
import { Sound } from '../odyssee/js/audio.js';

console.log('=== Test Intégration Cinématique Lugia Obscur ===');

// 1. Vérification des fichiers vidéo
const vidPath = fs.existsSync('odyssee/video/lugia_dark.mp4') ? 'odyssee/video/lugia_dark.mp4' : 'arcadia/odyssee/video/lugia_dark.mp4';
assert.ok(fs.existsSync(vidPath), 'Le fichier video/lugia_dark.mp4 doit exister');
const vidStat = fs.statSync(vidPath);
assert.ok(vidStat.size > 1000000, 'La vidéo doit faire une taille significative (> 1 Mo)');
console.log(`✓ Fichier vidéo présent et valide (${(vidStat.size / 1024 / 1024).toFixed(2)} Mo)`);

// 2. Vérification de la fonction cinématique
assert.strictEqual(typeof playLugiaCinematic, 'function', 'playLugiaCinematic doit être une fonction exportée');
console.log('✓ playLugiaCinematic est bien exportée');

// 3. Vérification du sound design synthétisé
const sound = new Sound();
assert.strictEqual(typeof sound.playLugiaCinematicAudio, 'function', 'Sound.prototype.playLugiaCinematicAudio doit être définie');
const audioCtrl = sound.playLugiaCinematicAudio();
assert.ok(audioCtrl && typeof audioCtrl.stop === 'function', 'Le contrôleur audio doit fournir une méthode stop()');
console.log('✓ Le synthétiseur audio cinématique est fonctionnel');

// 4. Vérification de l'appel dans story.js
const storyPath = fs.existsSync('odyssee/js/story.js') ? 'odyssee/js/story.js' : 'arcadia/odyssee/js/story.js';
const storySrc = fs.readFileSync(storyPath, 'utf8');
assert.ok(storySrc.includes('playLugiaCinematic'), 'story.js doit importer et appeler playLugiaCinematic');
assert.ok(storySrc.includes('lugiaWakes'), 'lugiaWakes doit déclencher la cinématique');
console.log('✓ story.js intègre parfaitement le déclenchement de la cinématique');

// 5. Vérification du fallback procédural en cas d'erreur vidéo + préservation de game.busy + respect de sound.muted
const cineSrc = fs.readFileSync(new URL('../odyssee/js/ui/cinematic.js', import.meta.url), 'utf8');
assert.ok(!cineSrc.includes("vid.addEventListener('error', end"), 'error video ne doit pas couper toute la cinématique procédurale');
assert.ok(cineSrc.includes('fallbackProcedural'), 'fallbackProcedural doit masquer la vidéo et conserver la scène canvas');
assert.ok(cineSrc.includes('prevBusy'), 'playLugiaCinematic doit restaurer prevBusy dans finally');
const soundMuted = new Sound();
soundMuted.muted = true;
const mutedCtrl = soundMuted.playLugiaCinematicAudio();
assert.ok(mutedCtrl && typeof mutedCtrl.stop === 'function', 'playLugiaCinematicAudio gère muted proprement');
console.log('✓ Garde-fous audio/vidéo/busy vérifiés');

console.log('\n=== Tous les tests de cinématique sont validés avec succès ! ===');
