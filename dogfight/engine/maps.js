// Les cartes de Dogfight 3D : de vrais reliefs, découpés dans le modèle Copernicus GLO-30 par tools/relief-dogfight.py,
// avec l'île d'Island Rush posée en mer. Chaque carte a sa zone de jeu, sa piste gagnée sur la mer, ses navires,
// son banc de nuages bas, ses couleurs, et les trois routes du transport d'Escorte (5, 8 et 10 min).
// Les coordonnées sont en mètres autour du centre de la zone (x vers l'est, z vers le sud) ; cx, cz placent ce centre
// dans le monde, où l'île d'Island Rush occupe le carré de 0 à 1 600 m. `look` : les couleurs du lieu (eau peu profonde,
// herbe verte, herbe sèche, maquis, roche, sable), son humidité (0 aride, 1 tropical), les altitudes de la roche nue
// et de la neige, où poussent les arbres.
// Points des routes : [x, z, façon de voler, altitude] ; 'c' altitude fixe, 'l' rase-mottes, 'v' par le fond des vallées
// depuis le point d'avant, 'b' le banc de nuages ('B' : dans l'autre sens). L'approche et l'atterrissage s'ajoutent seuls.

export const NEAR = { size: 14000, step: 25, n: 561 };   // la grille où l'on vole
export const FAR = { size: 32000, step: 100, n: 321 };   // l'horizon

export const MAPS = {
  eoliennes: {
    name: 'Îles Éoliennes', place: 'Lipari, Vulcanello et Vulcano', lat: 38.445, lon: 14.955, cx: -1100, cz: 800,
    runway: { from: [2600, -2600], to: [900, -2600], side: -1 },
    navy: [['porteavions', 4700, 1900, -0.35], ['destroyer', 3700, 2700, -0.2], ['chalutier', -1000, 1150, 1.1], ['chalutier', 2900, -1500, 2.4], ['chalutier', -3600, -500, 0.3], ['chalutier', 3800, -5200, -1.2]],
    bank: { pts: [[-2400, 500], [-3500, -200], [-4250, -1500], [-4500, -3000]], y: 330, base: 250 },
    look: { water: [0.27, 0.62, 0.6], lush: [0.4, 0.43, 0.26], dry: [0.6, 0.52, 0.37], scrub: [0.23, 0.27, 0.15], rock: [0.44, 0.41, 0.39], sand: [0.4, 0.38, 0.36], moist: 0.38, rockLine: [9000, 9500], snowLine: [9000, 9500], trees: { lo: 8, hi: 560, amount: 0.38, pine: 9000 } },
    routes: {
      traversee: { name: 'Le canal de Lipari', model: 'a400m', time: 300, pts: [
        [3800, 4300, 'c', 300], [2400, 2800, 'l'], [900, 1000, 'l'], [-1200, 1000, 'l'], ['b'], [-5000, -3800, 'l'], [100, -3300, 'v'], [1400, -4900, 'l'], [4600, -4700, 'c', 220], [5700, -3800, 'c', 190],
      ] },
      tour: { name: 'Le tour de Vulcano', model: 'c17', time: 480, pts: [
        [5600, 0, 'c', 380], [3600, 2400, 'c', 220], [2000, 3600, 'l'], [1400, 5400, 'v'], [0, 5600, 'l'], [-1200, 4400, 'l'], [-900, 2900, 'l'], [-1200, 1400, 'l'],
        ['b'], [-5000, -3800, 'l'], [100, -3300, 'v'], [300, -5400, 'l'], [2400, -5400, 'c', 220], [4800, -4800, 'c', 200], [5700, -3800, 'c', 190],
      ] },
      odyssee: { name: 'L\'odyssée éolienne', model: 'c17', time: 600, pts: [
        [5600, 4400, 'c', 380], [4400, 600, 'l'], [3000, -1500, 'l'], [1000, -1400, 'l'], [700, 900, 'l'], [2000, 2600, 'l'], [2400, 3600, 'l'], [1400, 5400, 'v'], [0, 5600, 'l'],
        [-1200, 4400, 'l'], [-900, 2900, 'l'], [-1200, 1400, 'l'], ['b'], [-5000, -3800, 'l'], [100, -3300, 'v'], [300, -5400, 'l'], [2400, -5400, 'c', 220], [4800, -4800, 'c', 200], [5700, -3800, 'c', 190],
      ] },
    },
  },
  teno: {
    name: 'Tenerife', place: 'le massif de Teno et les falaises de Los Gigantes', lat: 28.29, lon: -16.86, cx: 2300, cz: -500,
    runway: { from: [-1000, 4400], to: [200, 5600], side: 1 },
    navy: [['porteavions', -4300, -1200, 0.9], ['destroyer', -4900, 300, 0.7], ['chalutier', -2600, -2300, 2.0], ['chalutier', -500, 3000, 0.4], ['chalutier', -3600, 4200, 1.3], ['chalutier', -4000, -3700, -0.6]],
    bank: { pts: [[-5800, -500], [-5200, 300], [-4500, 1100], [-3700, 1900]], y: 340, base: 260 },
    look: { water: [0.2, 0.46, 0.52], lush: [0.38, 0.41, 0.25], dry: [0.56, 0.45, 0.32], scrub: [0.25, 0.29, 0.17], rock: [0.47, 0.37, 0.3], sand: [0.27, 0.26, 0.25], moist: 0.3, rockLine: [1150, 1450], snowLine: [9000, 9500], trees: { lo: 650, hi: 1450, amount: 0.5, pine: 650 } },
    routes: {
      traversee: { name: 'Le barranco de Masca', model: 'a400m', time: 300, pts: [
        [-1600, 5600, 'c', 200], [900, 3300, 'l'], [200, 1600, 'l'], [2200, 300, 'v'], [1900, -1300, 'v'], [0, -250, 'v'], [-1600, -1400, 'l'], [-2600, -2600, 'l'], [-3800, -3800, 'l'], [-5500, -2400, 'l'], ['b'],
      ] },
      tour: { name: 'Les barrancos de Teno', model: 'c17', time: 480, pts: [
        [-3400, 5700, 'c', 300], [-1400, 4400, 'l'], [900, 3300, 'l'], [200, 1600, 'l'], [2200, 300, 'v'], [1900, -1300, 'v'], [0, -250, 'v'], [-2000, -1400, 'l'], [-400, -2000, 'v'], [-800, -3600, 'v'],
        [-3000, -3300, 'v'], [-4200, -4400, 'l'], [-5500, -2400, 'l'], ['b'],
      ] },
      odyssee: { name: 'Le grand tour de Teno', model: 'c17', time: 600, pts: [
        [-1600, 5800, 'c', 380], [900, 3300, 'l'], [200, 1600, 'l'], [2200, 300, 'v'], [1900, -1300, 'v'], [0, -250, 'v'], [-2000, -1400, 'l'], [-400, -2000, 'v'], [-800, -3600, 'v'],
        [-3000, -3300, 'v'], [-4200, -4400, 'l'], [-5600, -1600, 'l'], [-5400, 3600, 'l'], [-2400, 4200, 'l'], [-200, 3000, 'l'], [-1400, 0, 'l'], [-3000, -2400, 'l'], [-5500, -2400, 'l'], ['b'],
      ] },
    },
  },
  kauai: {
    name: 'Kauai', place: 'la côte de Nā Pali et la vallée de Kalalau', lat: 22.20, lon: -159.62, cx: 1400, cz: 2000,
    runway: { from: [-4600, 900], to: [-6100, 1700], side: -1 },
    navy: [['porteavions', 2600, -4600, 0.55], ['destroyer', 1300, -5200, 0.4], ['chalutier', -2900, -2600, 1.8], ['chalutier', 1500, -1600, 0.2], ['chalutier', -5200, 400, -0.9], ['chalutier', 4300, -3600, 2.7]],
    bank: { pts: [[3000, -4600], [1400, -3600], [0, -2600], [-1100, -1700]], y: 330, base: 250 },
    look: { water: [0.25, 0.6, 0.62], lush: [0.25, 0.39, 0.15], dry: [0.44, 0.45, 0.26], scrub: [0.12, 0.25, 0.1], rock: [0.55, 0.33, 0.24], sand: [0.8, 0.72, 0.56], moist: 0.82, rockLine: [9000, 9500], snowLine: [9000, 9500], trees: { lo: 6, hi: 1250, amount: 0.8, pine: 9000 } },
    routes: {
      traversee: { name: 'Les falaises de Nā Pali', model: 'a400m', time: 300, pts: [
        [-5800, 1200, 'c', 300], [-5300, 3300, 'l'], [-4500, 3900, 'v'], [-2300, 3900, 'v'], [-2800, 2500, 'v'], [-1000, 400, 'l'], [1000, -400, 'l'], [2000, -1400, 'l'], [3600, -2800, 'l'], [3700, -4300, 'c', 300], ['b'],
      ] },
      tour: { name: 'La vallée de Kalalau', model: 'c17', time: 480, pts: [
        [-5800, 1200, 'c', 300], [-5300, 3300, 'l'], [-4500, 3900, 'v'], [-2300, 3900, 'v'], [-2800, 2500, 'v'], [-1000, 400, 'l'], [1000, -400, 'l'], [2000, -1400, 'l'], [4300, -2200, 'l'],
        [5000, 3000, 'v'], [5900, 1200, 'v'], [5300, -2800, 'l'], [3700, -4600, 'c', 300], ['b'],
      ] },
      odyssee: { name: 'Le tour de Nā Pali', model: 'c17', time: 600, pts: [
        [2400, -5600, 'c', 380], [-3000, -4400, 'c', 300], [-5800, -1000, 'l'], [-5800, 1200, 'l'], [-5300, 3300, 'l'], [-4500, 3900, 'v'], [-2300, 3900, 'v'], [-2800, 2500, 'v'], [-1000, 400, 'l'], [1000, -400, 'l'],
        [2000, -1400, 'l'], [4300, -2200, 'l'], [5000, 3000, 'v'], [5900, 1200, 'v'], [5300, -2800, 'l'], [3700, -4600, 'c', 300], ['b'],
      ] },
    },
  },
  lofoten: {
    name: 'Lofoten', place: 'Reine, ses fjords et ses aiguilles', lat: 67.93, lon: 13.075, cx: -500, cz: -1000,
    runway: { from: [3800, 2000], to: [3800, 300], side: 1 },
    navy: [['porteavions', 5000, -1200, 1.2], ['destroyer', 4900, 400, 1.4], ['chalutier', 1500, -2400, 0.4], ['chalutier', -1000, 1300, 2.9], ['chalutier', 2600, 4400, -0.8], ['chalutier', 1200, -3400, 1.9]],
    bank: { pts: [[800, -2000], [-800, -2200], [-2200, -2400], [-3200, -2600]], y: 330, base: 250 },
    look: { water: [0.24, 0.52, 0.5], lush: [0.36, 0.44, 0.25], dry: [0.5, 0.49, 0.36], scrub: [0.24, 0.32, 0.19], rock: [0.5, 0.5, 0.51], sand: [0.72, 0.7, 0.63], moist: 0.68, rockLine: [260, 460], snowLine: [620, 780], trees: { lo: 4, hi: 230, amount: 0.42, pine: 9000 } },
    routes: {
      traversee: { name: 'Le fjord de Reine', model: 'a400m', time: 300, pts: [
        [5400, -4400, 'c', 360], [2400, -2400, 'l'], ['b'], [-4600, -200, 'v'], [-1000, 1400, 'v'], [400, 3000, 'l'], [2400, 5700, 'l'],
      ] },
      tour: { name: 'Les aiguilles de Moskenesøya', model: 'c17', time: 480, pts: [
        [5600, -1000, 'c', 380], [2600, -600, 'l'], [2400, -3200, 'l'], [-400, -5600, 'v'], [-3600, -4000, 'v'], [-3600, -2800, 'v'], ['B'], [2200, -800, 'l'], [800, 600, 'l'],
        [-1400, 1400, 'v'], [-400, 3400, 'v'], [800, 4600, 'l'], [2400, 5700, 'l'],
      ] },
      odyssee: { name: 'Le tour des fjords', model: 'c17', time: 600, pts: [
        [5600, 4400, 'c', 380], [4400, -1200, 'l'], [2400, -3200, 'l'], [-400, -5600, 'v'], [-3600, -4000, 'v'], [-3600, -2800, 'v'], ['B'], [2200, -800, 'l'], [800, 600, 'l'],
        [-1400, 1400, 'v'], [-4600, -200, 'v'], [-4400, 2600, 'v'], [-1600, 3200, 'v'], [800, 4600, 'l'], [2400, 5700, 'l'],
      ] },
    },
  },
};
export const MAP_IDS = Object.keys(MAPS);
export const DEFAULT_MAP = 'eoliennes';
