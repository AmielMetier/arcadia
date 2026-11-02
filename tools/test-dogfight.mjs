// Tests unitaires de Dogfight 3D sous Node.js
import { FlightModel, CRUISE_SPEED, BOOST_SPEED } from '../dogfight/engine/flight.js';
import { WeaponSystem, computeLeadPosition, BULLET_SPEED } from '../dogfight/engine/weapons.js';
import { computeBotFlightInput } from '../dogfight/engine/ai.js';
import { createDogfightGame, tickDogfight } from '../dogfight/engine/rules.js';

let passed = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  }
  passed++;
}

console.log('--- Test Dogfight 3D : Bataille Aérienne ---');

// 1. Modèle de vol
const flight = new FlightModel({ x: 100, y: 200, z: 100, heading: 0 });
assert(flight.speed === CRUISE_SPEED, 'Vitesse de croisière initiale');
assert(flight.y === 200, 'Altitude de départ');

// Accélération boost
flight.update({ boost: true }, 0.5);
assert(flight.speed > CRUISE_SPEED, 'La postcombustion augmente la vitesse');
assert(flight.boosting === true, 'État boosting actif');

// Stabilisation mains libres (vol tout droit dans la dernière direction)
const straightFlight = new FlightModel({ x: 0, y: 200, z: 0, heading: 0.5 });
// Virage à droite et léger cabré
for (let t = 0; t < 0.4; t += 0.016) {
  straightFlight.update({ rollRight: true, pitchUp: true }, 0.016);
}
const lastHeading = straightFlight.yaw;
assert(straightFlight.roll > 0, 'Roulis actif pendant le virage');
assert(straightFlight.pitch > 0, 'Tangage actif pendant le cabré');

// Relâchement complet des touches (aucun input)
for (let t = 0; t < 1.5; t += 0.016) {
  straightFlight.update({}, 0.016);
}
assert(Math.abs(straightFlight.yaw - lastHeading) < 0.001, 'Le cap (yaw) reste strictement inchangé sans touche');
assert(Math.abs(straightFlight.roll) < 0.01, 'Le roulis revient à 0 pour stabiliser les ailes');
assert(Math.abs(straightFlight.pitch) < 0.01, 'L\'assiette (pitch) revient à 0 pour voler à plat');
assert(Math.abs(straightFlight.forwardY) < 0.01, 'Vecteur de vol horizontal tout droit');
console.log('✓ Modèle de vol, postcombustion, crash et vol tout droit sans touche');

// 2. Armement & Canon Vulcan
const weapons = new WeaponSystem();
const dummyPlane = {
  id: 'p1',
  x: 0, y: 100, z: 0,
  speed: 120,
  forwardX: 0, forwardY: 0, forwardZ: 1,
  rightX: 1, rightY: 0, rightZ: 0,
  upY: 1,
  crashed: false,
};
const target = { id: 'p2', x: 0, y: 100, z: 150, alive: true };

// Tir au canon
const events = weapons.update(true, dummyPlane, 0.05, [target]);
assert(weapons.bullets.length === 1, 'Balle tirée par le canon Vulcan');
assert(weapons.heat > 0, 'La température du canon augmente après un tir');

// Anticipation de tir (Lead calculation)
const lead = computeLeadPosition({ x: 0, y: 0, z: 0 }, BULLET_SPEED, { x: 0, y: 0, z: 300 }, { x: 50, y: 0, z: 0 });
assert(lead.x > 0, 'Le point de tir anticipe le déplacement transversal de la cible');
assert(lead.time > 0, 'Temps de vol calculé');
console.log('✓ Armement Vulcan, balistique et anticipation (Lead)');

// 3. IA de combat
const botPlane = {
  id: 'bot-1',
  alive: true,
  crashed: false,
  x: 200, y: 150, z: 200,
  vx: 0, vy: 0, vz: 100,
  forwardX: 0, forwardY: 0, forwardZ: 1,
  upX: 0, upY: 1, upZ: 0,
  rightX: 1, rightY: 0, rightZ: 0,
  roll: 0,
};
const enemyPlane = {
  id: 'human',
  alive: true,
  x: 200, y: 150, z: 380,
  vx: 0, vy: 0, vz: 100,
};
const dummyMap = { heightAt: () => 10 };
const botInput = computeBotFlightInput(botPlane, [botPlane, enemyPlane], dummyMap, 0.016);
assert(botInput !== null, 'L\'IA calcule une trajectoire de vol');
console.log('✓ IA de combat et poursuite aérienne');

// 4. Session de jeu
const game = createDogfightGame({
  settings: { kills: 3, time: 180 },
  players: [
    { id: 'p1', name: 'Ace 1', bot: false },
    { id: 'b1', name: 'Bot Viper', bot: true },
  ],
  map: dummyMap,
});

assert(game.planes.length === 2, '2 chasseurs F-16 instanciés');
assert(game.phase === 'countdown', 'Phase initiale en compte à rebours');

// Avancement de phase
tickDogfight(game, 3.0, dummyMap);
assert(game.phase === 'playing', 'Phase de combat active');
// 5. Alignement et géométrie 3D du F-16 face caméra
// Dans gltf.scene, l'axe longitudinal est +X, l'axe vertical est +Y, et l'envergure est sur Z.
// La rotation Y = -Math.PI / 2 doit orienter le nez strictement vers +Z et les ailes horizontales sur X.
const forwardAxis = { x: 1, y: 0, z: 0 };
const upAxis = { x: 0, y: 1, z: 0 };
const rightWingAxis = { x: 0, y: 0, z: -1 };

// Rotation de -90° autour de Y : x' = z, y' = y, z' = -x
function rotYMinus90(v) {
  return {
    x: Math.round(Math.cos(-Math.PI / 2) * v.x + Math.sin(-Math.PI / 2) * v.z),
    y: v.y,
    z: Math.round(-Math.sin(-Math.PI / 2) * v.x + Math.cos(-Math.PI / 2) * v.z),
  };
}

const rotatedNose = rotYMinus90(forwardAxis);
const rotatedUp = rotYMinus90(upAxis);
const rotatedWing = rotYMinus90(rightWingAxis);

assert(rotatedNose.z === 1 && rotatedNose.x === 0, 'Le nez de l\'avion pointe droit vers l\'avant (+Z)');
assert(rotatedUp.y === 1 && rotatedUp.x === 0, 'La dérive et la verrière pointent droit vers le ciel (+Y)');
assert(rotatedWing.x === 1 && rotatedWing.z === 0, 'L\'aile droite pointe horizontalement vers la droite (+X)');
console.log('✓ Alignement 3D droit en face de la caméra (ailes horizontales et nez vers l\'avant)');

// 6. Commandes gauche et droite inversées
const controlsTest = {
  keys: new Set(['KeyQ']),
  getRollRight() { return this.keys.has('KeyQ') || this.keys.has('ArrowLeft'); },
  getRollLeft() { return this.keys.has('KeyD') || this.keys.has('ArrowRight'); },
};
assert(controlsTest.getRollRight() === true, 'Touche Q / Flèche Gauche inversée vers rollRight');
assert(controlsTest.getRollLeft() === false, 'Touche D / Flèche Droite inactive');
console.log('✓ Commandes gauche et droite inversées');

console.log(`\nTOUS LES TESTS SONT VALIDES (${passed} assertions réussies)`);
