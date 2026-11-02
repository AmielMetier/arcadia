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

// Crash au sol
flight.y = 5;
flight.update({}, 0.1, { heightAt: () => 10 });
assert(flight.crashed === true, 'Crash détecté lors du contact avec le sol');
console.log('✓ Modèle de vol, postcombustion et crash');

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
console.log('✓ Déroulement d\'une session de jeu');

console.log(`\nTOUS LES TESTS SONT VALIDES (${passed} assertions réussies)`);
