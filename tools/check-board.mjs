// Vérifie qu'un plateau DavidSimulator est fidèle au Monopoly classique.
// Usage : node tools/check-board.mjs [chemin/vers/board.json]
import { readFileSync } from 'node:fs';

const file = process.argv[2] || new URL('../david/data/board-nice.json', import.meta.url);
const B = JSON.parse(readFileSync(file, 'utf8'));

// Référence officielle (édition classique en euros, mêmes valeurs que l'édition internationale)
// [case, type, prix, hypothèque, coût maison, loyers]
const REF = [
  [0,'go'], [1,'street',60,30,50,[2,10,30,90,160,250]], [2,'chest'], [3,'street',60,30,50,[4,20,60,180,320,450]],
  [4,'tax',200], [5,'station',200,100], [6,'street',100,50,50,[6,30,90,270,400,550]], [7,'chance'],
  [8,'street',100,50,50,[6,30,90,270,400,550]], [9,'street',120,60,50,[8,40,100,300,450,600]], [10,'jail'],
  [11,'street',140,70,100,[10,50,150,450,625,750]], [12,'utility',150,75], [13,'street',140,70,100,[10,50,150,450,625,750]],
  [14,'street',160,80,100,[12,60,180,500,700,900]], [15,'station',200,100], [16,'street',180,90,100,[14,70,200,550,750,950]],
  [17,'chest'], [18,'street',180,90,100,[14,70,200,550,750,950]], [19,'street',200,100,100,[16,80,220,600,800,1000]],
  [20,'parking'], [21,'street',220,110,150,[18,90,250,700,875,1050]], [22,'chance'], [23,'street',220,110,150,[18,90,250,700,875,1050]],
  [24,'street',240,120,150,[20,100,300,750,925,1100]], [25,'station',200,100], [26,'street',260,130,150,[22,110,330,800,975,1150]],
  [27,'street',260,130,150,[22,110,330,800,975,1150]], [28,'utility',150,75], [29,'street',280,140,150,[24,120,360,850,1025,1200]],
  [30,'gotojail'], [31,'street',300,150,200,[26,130,390,900,1100,1275]], [32,'street',300,150,200,[26,130,390,900,1100,1275]],
  [33,'chest'], [34,'street',320,160,200,[28,150,450,1000,1200,1400]], [35,'station',200,100], [36,'chance'],
  [37,'street',350,175,200,[35,175,500,1100,1300,1500]], [38,'tax',100], [39,'street',400,200,200,[50,200,600,1400,1700,2000]],
];
const errors = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fail = (m) => errors.push(m);

if (B.spaces.length !== 40) fail(`40 cases attendues, ${B.spaces.length} trouvées`);
B.spaces.forEach((s, k) => { if (s.i !== k) fail(`case n°${k} : index ${s.i}`); });

for (const [i, type, price, mortgage, house, rent] of REF) {
  const s = B.spaces[i]; if (!s) continue;
  const tag = `case ${i} (${s.name})`;
  if (s.type !== type) fail(`${tag} : type ${s.type} au lieu de ${type}`);
  if (!s.name) fail(`${tag} : nom manquant`);
  if (type === 'tax' && s.amount !== price) fail(`${tag} : taxe ${s.amount} au lieu de ${price}`);
  if (['street', 'station', 'utility'].includes(type)) {
    if (s.price !== price) fail(`${tag} : prix ${s.price} au lieu de ${price}`);
    if (s.mortgage !== mortgage) fail(`${tag} : hypothèque ${s.mortgage} au lieu de ${mortgage}`);
    const g = B.groups[s.group];
    if (!g) fail(`${tag} : groupe ${s.group} inconnu`);
    else {
      if (!g.spaces.includes(i)) fail(`${tag} : absente de la liste du groupe ${s.group}`);
      if (s.color !== g.color) fail(`${tag} : couleur différente de celle du groupe`);
    }
  }
  if (type === 'street') {
    if (s.houseCost !== house) fail(`${tag} : maison ${s.houseCost} au lieu de ${house}`);
    if (B.groups[s.group] && B.groups[s.group].houseCost !== house) fail(`${tag} : coût maison du groupe incohérent`);
    if (!eq(s.rent, rent)) fail(`${tag} : loyers ${s.rent} au lieu de ${rent}`);
  }
  if (type === 'station' && !eq(s.rent, [25, 50, 100, 200])) fail(`${tag} : loyers de gare incorrects`);
  if (type === 'utility' && !eq(s.diceMultiplier, [4, 10])) fail(`${tag} : multiplicateurs incorrects`);
}

// Noms uniques pour toutes les cases achetables
const names = B.spaces.filter(s => s.price).map(s => s.name);
if (new Set(names).size !== names.length) fail('noms de propriétés en double');

// Règles de base
const R = B.rules, want = { startingCash: 1500, goSalary: 200, jailFine: 50, maxJailTurns: 3, doublesToJail: 3,
  mortgageInterest: 0.1, buildingResaleRatio: 0.5, bankHouses: 32, bankHotels: 12, housesPerHotel: 4 };
for (const k in want) if (R[k] !== want[k]) fail(`règle ${k} = ${R[k]} au lieu de ${want[k]}`);

// Cartes : 16 + 16, cibles valides
const ACTIONS = ['advance', 'advanceNearest', 'collect', 'pay', 'jailFree', 'back', 'goToJail', 'repairs', 'payEach', 'collectEach'];
for (const deck of ['chance', 'chest']) {
  const cards = B.cards[deck];
  // 16 cartes officielles ; Chance a en plus une carte maison (Sylvain Durif)
  const want = deck === 'chance' ? 17 : 16;
  if (cards.length !== want) fail(`paquet ${deck} : ${cards.length} cartes au lieu de ${want}`);
  for (const c of cards) {
    if (!ACTIONS.includes(c.action.type)) fail(`carte ${c.id} : action ${c.action.type} inconnue`);
    if (c.action.type === 'advance' && !(c.action.to >= 0 && c.action.to < 40)) fail(`carte ${c.id} : destination invalide`);
  }
}

const count = t => B.spaces.filter(s => s.type === t).length;
const summary = `${count('street')} terrains, ${count('station')} pôles de transport, ${count('utility')} compagnies, ` +
  `${count('chance')} Chance, ${count('chest')} Caisse de communauté, ${count('tax')} taxes`;
if (errors.length) { console.error(`✗ ${errors.length} écart(s) :\n- ` + errors.join('\n- ')); process.exit(1); }
console.log(`✓ Plateau « ${B.title} » fidèle à l'original — ${summary}.`);
