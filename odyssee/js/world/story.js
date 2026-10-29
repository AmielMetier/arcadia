// odyssee/js/world/story.js — l'histoire posée sur la carte : la Team Éclipse, Lugia Obscur, le Conseil 4,
// les CS (Coupe, Flash, Surf, Force) avec leurs chemins cachés, et les quêtes annexes. Sans DOM.
// Les scènes elles-mêmes (dialogues, combats enchaînés) sont jouées par js/story.js.
import { T, walkable } from './tiles.js';
import { GameMap, along, nearestWalkable, rng } from './mapgen.js';
import { room, leagueInterior } from './interiors.js';
import { SPECIES } from '../data/species.js';

const key = (x, y) => x + ',' + y;

/* ---------------- équipes ---------------- */
const GRUNT = {
  a: [[19, 10], [41, 11]], b: [[23, 11], [109, 10]],                                            // Bois Murmure
  c: [[41, 14], [74, 15]], d: [[109, 14], [19, 15]], erebe1: [[41, 16], [109, 16], [198, 18]],  // Grotte Lunaire
  e: [[20, 19], [109, 20]], nyx1: [[41, 21], [228, 22], [215, 23]],                             // Port-Azur
  f: [[81, 26], [100, 26]], g: [[110, 27], [42, 27]], erebe2: [[42, 29], [110, 29], [82, 29], [198, 31]], // Centrale
  h: [[20, 31], [24, 31]], i: [[42, 32], [215, 32]], j: [[110, 32], [89, 33]], k: [[24, 33], [228, 33]], l: [[198, 33], [20, 33]],
  nyx2: [[42, 35], [215, 35], [229, 36], [24, 37]],
  boss1: [[197, 37], [110, 37], [215, 38], [229, 40]],                                          // repaire
  m: [[89, 42], [24, 43], [229, 43]], n: [[42, 43], [110, 43], [215, 44]],
  nyx3: [[169, 45], [215, 45], [229, 46], [24, 46]], erebe3: [[42, 45], [89, 45], [110, 46], [198, 47]],
  boss2: [[197, 48], [215, 48], [94, 49], [110, 48], [229, 50]],                                // Sanctuaire
};
export const ELITE = [
  { id: 'c4:1', name: 'Frimas', ow: 'hiker', bs: 'pryce', team: [[87, 46], [91, 46], [221, 47], [124, 47], [131, 48]], room: 'Salle de Glace', floor: 'gymWater',
    intro: 'Bienvenue au Conseil 4. Je suis Frimas. Mon cœur s\'est figé il y a bien longtemps... Le tien tiendra-t-il face au froid ?', lose: 'Ta flamme a fait fondre ma glace. Passe, la salle suivante t\'attend.' },
  { id: 'c4:2', name: 'Spectrel', ow: 'nurse', bs: 'morty', team: [[93, 47], [200, 47], [110, 48], [94, 49]], room: 'Salle des Ombres', floor: 'gymPsy',
    intro: 'Chut... Les esprits me murmurent ton nom depuis que tu es entré. Ils ont hâte de jouer avec toi.', lose: 'Les esprits se taisent... Tu les as impressionnés.' },
  { id: 'c4:3', name: 'Brutus', ow: 'hiker', bs: 'bruno', team: [[237, 48], [106, 48], [107, 48], [57, 49], [68, 50]], room: 'Salle du Poing', floor: 'gymRock',
    intro: 'Je suis Brutus ! J\'ai entraîné mes muscles et ceux de mes Pokémon chaque jour de ma vie. Hoo ! Hah !', lose: 'Ma force n\'a pas suffi... Va. Tu le mérites.' },
  { id: 'c4:4', name: 'Ombrelle', ow: 'cooltrainer_f', bs: 'karen', team: [[197, 49], [198, 49], [215, 50], [229, 50], [248, 51]], room: 'Salle de la Nuit', floor: 'gymDragon',
    intro: 'Je suis Ombrelle, la dernière du Conseil 4. Les gentils Pokémon, les méchants Pokémon... Seuls les dresseurs comptent. Montre-moi ce que tu vaux.', lose: 'Tu es fort, et tu aimes tes Pokémon. C\'est ce qui fait un vrai dresseur. La Maître t\'attend.' },
];

/* ---------------- rencontres supplémentaires ---------------- */
const SURF_HARBOR = [[72, 14, 20, 40], [129, 10, 20, 30], [54, 14, 20, 15], [60, 14, 20, 10], [118, 14, 20, 5]];
const SURF_SOUTH = [[72, 34, 40, 30], [73, 38, 42, 5], [129, 30, 40, 20], [130, 38, 42, 5], [116, 34, 40, 10], [117, 38, 42, 4], [120, 34, 40, 10], [170, 36, 40, 8], [171, 38, 42, 4], [222, 36, 40, 4]];
const SANCT = [[73, 40, 44, 25], [130, 40, 44, 10], [171, 40, 44, 15], [226, 40, 44, 15], [42, 40, 44, 20], [198, 40, 43, 10], [55, 40, 44, 5]];

export function addStory({ W, maps, towns, routes, trainerNpc, champion }) {
  const R = routes;
  W.surf = [];
  const tn = (t, lx, ly, o) => W.npc({ ...o, id: `${t.id}:${o.id}`, x: t.x + lx, y: t.y + ly });
  const grunt = (map, x, y, dir, id, team, o = {}) => Object.assign(trainerNpc(map, x, y, dir, 'Sbire', 'de la Team Éclipse', team, {
    id, sight: o.sight ?? 3, ow: o.f ? 'gruntf' : 'grunt', bs: o.f ? 'galacticgruntf' : 'galacticgrunt', prize: 40 + team[0][1] * 2,
    intro: o.intro || 'Hé ! La Team Éclipse est occupée ici. Dégage, ou je te fais tâter de mes Pokémon !',
    lose: o.lose || 'Gnn... Pas possible !', after: o.after || 'La Team Éclipse ne se laissera pas faire...',
  }), { vanish: o.vanish ?? true, music: 'eclipse', speaker: 'Sbire' });
  const admin = (map, x, y, dir, id, who, team, o) => Object.assign(trainerNpc(map, x, y, dir, 'Admin Éclipse', who === 'nyx' ? 'Nyx' : 'Erèbe', team, {
    id, sight: o.sight ?? 3, ow: who, bs: who === 'nyx' ? 'mars' : 'saturn', prize: 70, ai: 'smart', items: { 'super-potion': 1, 'hyper-potion': team[0][1] > 30 ? 1 : 0 }, intro: o.intro, lose: o.lose, after: o.after,
  }), { vanish: true, music: 'eclipse', winScript: o.win });
  const spot = (pts, t, side, off) => { const p = along(pts, t); return nearestWalkable(W, p.x + 0.5 + p.nx * side * off, p.y + 0.5 + p.ny * side * off); };

  /* ======================== Acte 1 · Bois Murmure ======================== */
  {
    const [lx, ly] = spot(R.bois, 0.5, 1, 3.2);
    W.npc({ id: 'lumen-bois', x: lx, y: ly, sprite: 'lumen', dir: 'left', script: 'lumenBois' });
    const [ax, ay] = spot(R.bois, 0.46, 0, 0), [bx, by] = spot(R.bois, 0.53, -1, 2.5);
    grunt(W, ax, ay, 'down', 'ecl:bois1', GRUNT.a, { sight: 4, intro: 'Ce scientifique sait des choses sur les Plumes Argent. Toi, ne te mêle pas de ça !' });
    grunt(W, bx, by, 'right', 'ecl:bois2', GRUNT.b, { f: 1, sight: 4, intro: 'Le Chef Nocturne veut ces données. Personne ne nous arrêtera !' });
  }

  /* ======================== Acte 2 · Grotte Lunaire ======================== */
  {
    const g = maps.grotte; g.dark = true;
    const [ex, ey] = nearestCave(g, 30, 20);
    admin(g, ex, ey, 'left', 'ecl:erebe1', 'erebe', GRUNT.erebe1, {
      intro: 'Tiens, un gamin. Je suis Erèbe, Admin de la Team Éclipse. Ces Pierres Lune nourriront le Prisme Noir. Ne te mets pas en travers de notre chemin.',
      lose: 'Intéressant... Tu as du cran. Mais le Prisme est presque prêt.', after: '...',
    });
    const [ax, ay] = nearestCave(g, 14, 8), [bx, by] = nearestCave(g, 36, 7);
    grunt(g, ax, ay, 'down', 'ecl:grotte1', GRUNT.c, { intro: 'On creuse pour le Chef ! Tu tombes mal, gamin !' });
    grunt(g, bx, by, 'left', 'ecl:grotte2', GRUNT.d, { f: 1, intro: 'Ces cailloux brillent dans le noir... Le Chef va adorer. Mais toi, tu vas disparaître !' });
  }

  /* ======================== Acte 3 · Port-Azur ======================== */
  {
    const D = towns.D;
    admin(W, D.x + 19, D.y + 5, 'down', 'ecl:nyx1', 'nyx', GRUNT.nyx1, {
      intro: 'Oh, un petit curieux ! Je suis Nyx, Admin de la Team Éclipse. On cherche le Sanctuaire des Marées... et ce vieux marin refuse de parler. Tu veux payer à sa place ?',
      lose: 'Pfff, quelle plaie ! On trouvera le Sanctuaire sans lui. Ciao !', after: '...',
    });
    grunt(W, D.x + 12, D.y + 5, 'down', 'ecl:azur1', GRUNT.e, { sight: 2, intro: 'Le ponton est réquisitionné par la Team Éclipse !' });
    // le marin donne Surf une fois Nyx chassée
    const marin = W.npcs.find((n) => n.id === 'azur:marin');
    Object.assign(marin, { script: 'gift', move: 'static', dir: 'down', text: null, gift: {
      item: 'hm03', flag: 'giftSurf', who: 'Vieux marin', need: (st) => st.flags['T:ecl:nyx1'] && st.badges[2],
      pre: (st) => (st.flags['T:ecl:nyx1'] ? ['Merci de m\'avoir débarrassé de cette Nyx, petit.', 'Reviens me voir avec le Badge Écume de Marine : j\'aurai un cadeau pour toi.'] : ['Ahoy... Ces gens en noir veulent savoir où dort le gardien des mers.', 'Jamais je ne leur dirai !']),
      give: ['Tu as le Badge Écume, et tu as chassé ces vauriens. Tiens, prends ça.'],
      got: ['La CS03 contient Surf. Ton Pokémon pourra te porter sur l\'eau calme.', 'Il paraît qu\'un îlot du port cache un trésor... et que le gardien des mers dort sous les vagues, au sud.'],
      done: ['Bon vent, petit ! Les marées te seront favorables.'] } });
    // le pêcheur : montre-moi un Magicarpe
    const pe = W.npcs.find((n) => n.id === 'azur:pecheur');
    Object.assign(pe, { script: 'show', move: 'turn', text: null, show: {
      flag: 'qMagicarpe', who: 'Pêcheur', test: (m) => m.sp === 129, reward: [['rare-candy', 2]],
      ask: ['Les Krabby pincent fort, méfie-toi en marchant sur la plage.', 'Dis, tu me montrerais un Magicarpe ? Juste pour le voir. On en trouve en surfant dans le port.'],
      thanks: ['Ooooh ! Un Magicarpe ! Ses écailles brillent, c\'est un beau spécimen.', 'Tiens, pour ta peine.'], done: ['Un jour, ton Magicarpe deviendra un Léviator. Patience !'] } });
    // îlot caché du port, accessible avec Surf
    W.rect(D.x + 24, D.y + 1, D.x + 27, D.y + 2, T.SAND);
    W.item(D.x + 26, D.y + 1, 'rare-candy'); W.item(D.x + 24, D.y + 2, 'water-stone');
    W.items.slice(-2).forEach((it) => { it.secret = 'surf'; });
    W.surf.push({ x0: D.x + 2, y0: D.y, x1: D.x + 31, y1: D.y + 3, enc: SURF_HARBOR, name: 'Port-Azur' });
  }

  /* ======================== Acte 4 · Voltacité, la Centrale ======================== */
  {
    const E = towns.E, cen = maps['volta:tower17'];
    cen.npcs.length = 0; cen.name = 'Centrale de Voltacité'; cen.music = 'hideout';
    cen.npc({ id: 'volta:ingenieur', x: 1, y: 6, sprite: 'clerk', dir: 'right', script: 'gift', gift: {
      item: 'hm04', flag: 'giftForce', who: 'Ingénieur', need: (st) => st.flags['T:ecl:erebe2'],
      pre: ['Ils ont pris le contrôle des générateurs ! Ils volent l\'électricité de toute la région pour leur Prisme Noir...', 'Leur chef, Erèbe, est au fond de la salle. Je t\'en prie, chasse-les !'],
      give: ['Les générateurs repartent ! Tu nous as sauvés. Prends ceci, ça devrait t\'aider dans ton voyage.'],
      got: ['La CS04 contient Force. Tu pourras pousser les gros rochers qui bloquent certains chemins.', 'Volta t\'attend à l\'Arène, maintenant que tout est rentré dans l\'ordre.'],
      done: ['Les Voltorbe sont revenus se blottir contre les générateurs. Tout va bien !'] } });
    grunt(cen, 3, 6, 'right', 'ecl:volta1', GRUNT.f, { sight: 3, intro: 'Bzzt ! Accès interdit ! La Centrale appartient à la Team Éclipse !' });
    grunt(cen, 8, 4, 'left', 'ecl:volta2', GRUNT.g, { f: 1, sight: 3, intro: 'Chaque watt de cette ville sert le Prisme Noir. Recule !' });
    admin(cen, 7, 2, 'down', 'ecl:erebe2', 'erebe', GRUNT.erebe2, {
      sight: 2, intro: 'Encore toi. Le Prisme Noir a besoin d\'énergie pour « fermer le cœur » d\'un Pokémon légendaire. Lorsque Lugia sera à nous, la région plongera dans une nuit éternelle.',
      lose: 'Hmph. Ce n\'est qu\'un contretemps. Le Chef Nocturne a déjà ce qu\'il lui faut. Nous nous retirons.', after: '...',
    });
    cen.item(9, 6, 'thunder-stone');
    // l'Arène est fermée tant que la Centrale est occupée
    const n = tn(E, 21, 18, { id: 'arene-fermee', sprite: 'clerk', dir: 'down', gate: { badges: 0, until: 'T:ecl:erebe2', tiles: [[E.x + 21, E.y + 18]] }, text: ['L\'Arène est fermée ! La Team Éclipse a envahi la Centrale, et Volta refuse de combattre tant qu\'elle est occupée.', 'La Centrale, c\'est le grand bâtiment doré au nord.'] });
    W.gates.push({ npc: n.id, ...n.gate });
  }

  /* ======================== Acte 5 · le repaire (route 6) ======================== */
  {
    const door = cavePortal(W, 212, 120);
    const rep = room('repaire', 23, 16, { floor: 'lab', music: 'hideout', wall: 'wall_mart', name: 'Repaire Éclipse', exitX: 11 });
    // rangées de machines et de consoles de la Team Éclipse, qui forment un petit labyrinthe
    const wall = (y, gap) => { for (let x = 1; x < 22; x++) if (x !== gap) rep.prop((x + y) % 4 === 0 ? 'console' : 'machine', x, y); };
    wall(12, 6); wall(8, 17); wall(4, 11);
    rep.prop('console', 9, 2); rep.prop('console', 13, 2); rep.prop('machine', 10, 2); rep.prop('machine', 12, 2); rep.prop('darkpillar', 1, 2); rep.prop('darkpillar', 21, 2);
    rep.outside = { map: 'monde', x: door.x, y: door.y + 1, dir: 'down' };
    rep.warp(rep.exitX, rep.exitY, rep.outside);
    W.warp(door.x, door.y, { map: 'repaire', x: rep.exitX, y: rep.exitY, dir: 'up' });
    grunt(rep, 9, 13, 'left', 'ecl:rep1', GRUNT.h, { vanish: false, after: 'Le Chef est tout là-haut... mais tu n\'arriveras jamais jusqu\'à lui.' });
    grunt(rep, 12, 10, 'down', 'ecl:rep2', GRUNT.i, { f: 1, sight: 1, vanish: false, after: 'Le Prisme Noir... j\'en ai froid dans le dos.' });
    grunt(rep, 14, 9, 'left', 'ecl:rep3', GRUNT.j, { sight: 3, vanish: false });
    grunt(rep, 14, 6, 'right', 'ecl:rep4', GRUNT.k, { sight: 2, vanish: false });
    grunt(rep, 8, 6, 'right', 'ecl:rep5', GRUNT.l, { f: 1, sight: 3, vanish: false });
    admin(rep, 18, 9, 'left', 'ecl:nyx2', 'nyx', GRUNT.nyx2, { sight: 2,
      intro: 'Toi, ici ?! Tu es vraiment collant. Le Chef est en train d\'achever le Prisme Noir. Je ne te laisserai pas le déranger !', lose: 'Non, non, NON ! ... Bon, vas-y. De toute façon, il est trop tard.', after: '...' });
    const boss = trainerNpc(rep, 11, 3, 'down', 'Chef Éclipse', 'Nocturne', GRUNT.boss1, { id: 'ecl:boss1', sight: 1, ow: 'boss', bs: 'cyrus', prize: 120, ai: 'smart', items: { 'hyper-potion': 2 },
      intro: 'Je suis Nocturne, chef de la Team Éclipse. Le jour rend les gens faibles et bruyants. Sous une nuit éternelle, tout serait enfin calme... Le Prisme Noir fermera le cœur de Lugia, et Lugia obéira. Toi, tu n\'es qu\'un grain de sable.',
      lose: 'Impressionnant. Mais il est trop tard : le Prisme Noir est déjà au Sanctuaire des Marées.', after: '...' });
    Object.assign(boss, { vanish: true, music: 'eclipse', winScript: 'boss1' });
    rep.item(2, 6, 'ultra-ball', 2); rep.item(20, 10, 'full-heal'); rep.item(20, 14, 'hyper-potion');
    maps.repaire = rep;
    // les sbires bloquent l'entrée de Mirage tant que le Chef n'est pas battu
    const G = towns.G;
    const gt = tn(G, 2, 9, { id: 'sbire-garde', sprite: 'grunt', dir: 'left', gate: { badges: 0, until: 'eclipse', tiles: [[G.x, G.y + 10], [G.x, G.y + 11]] }, text: ['Halte ! Mirage est sous le contrôle de la Team Éclipse.', 'Personne ne passe tant que le Chef n\'en a pas fini dans notre repaire, plus à l\'ouest sur la route 6 !'] });
    W.gates.push({ npc: gt.id, ...gt.gate });
  }

  /* ======================== Acte 6 · le Sanctuaire des Marées ======================== */
  {
    // îlot au sud du Pont des Marées, accessible en surfant depuis le pont
    W.blob(252.5, 259, 7, 4.5, T.SAND, rng(99), [T.WATER]);
    const b = W.building('cave', 250, 255);
    W.rect(b.doorX - 1, b.doorY + 1, b.doorX + 1, b.doorY + 3, T.SAND);
    W.prop('statue', b.doorX - 2, b.doorY + 2); W.prop('statue', b.doorX + 2, b.doorY + 2);
    W.zone(240, 252, 264, 266, { name: 'Îlot des Marées', music: 'sanctuary' });
    W.surf.push({ x0: 228, y0: 239, x1: 268, y1: 272, enc: SURF_SOUTH, name: 'Mer des Marées' });
    const s = new GameMap('sanctuaire', 25, 34, { outdoor: false, fill: T.CAVEWALL, floor: 'cave', music: 'sanctuary', name: 'Sanctuaire des Marées', battleBg: 'cave' });
    s.edge = T.CAVEWALL;
    s.rect(11, 24, 13, 31, T.CAVE); s.rect(3, 16, 21, 26, T.CAVE); s.rect(11, 11, 13, 16, T.CAVE); s.set(12, 10, T.CAVE); s.rect(5, 2, 19, 9, T.CAVE);
    s.rect(4, 18, 7, 22, T.WATER); s.rect(17, 18, 20, 22, T.WATER); s.rect(5, 3, 8, 7, T.WATER); s.rect(16, 3, 19, 7, T.WATER);
    for (const [x, y] of [[9, 3], [15, 3], [9, 6], [15, 6], [3, 25], [21, 25], [9, 17], [15, 17]]) s.prop('statue', x, y);
    for (const [x, y] of [[4, 24], [20, 16], [6, 25], [18, 25]]) s.prop('stalag', x, y);
    for (const p of s.deco) s.under.set(key(p.x, p.y), T.CAVE);
    s.set(12, 32, T.CAVEDOOR); s.set(12, 33, T.CAVEWALL);
    s.deco.push({ k: 'exitlight', x: 12, y: 32 });
    s.warp(12, 32, { map: 'monde', x: b.doorX, y: b.doorY + 1, dir: 'down' });
    W.warp(b.doorX, b.doorY, { map: 'sanctuaire', x: 12, y: 31, dir: 'up', need: 'silver-wing' });
    s.encounter = SANCT;
    s.zone(11, 26, 13, 27, { name: s.name, music: 'sanctuary', trigger: 'lumenSanct' });
    // Lugia Obscur repose sur l'autel
    s.under.set(key(12, 4), T.CAVE); s.set(12, 4, T.BLOCK); s.object(12, 4, { type: 'lugia' });
    s.npc({ id: 'lumen-sanct', x: 13, y: 29, sprite: 'lumen', dir: 'left', script: 'lumenSanct' });
    grunt(s, 8, 24, 'right', 'ecl:sanct1', GRUNT.m, { sight: 4, intro: 'Le rituel a commencé ! Tu ne passeras pas !' });
    grunt(s, 16, 20, 'left', 'ecl:sanct2', GRUNT.n, { f: 1, sight: 4, intro: 'Tu entends ? C\'est Lugia qui gronde sous nos pieds...' });
    admin(s, 11, 14, 'right', 'ecl:nyx3', 'nyx', GRUNT.nyx3, { sight: 2, intro: 'Encore toi ! Tu ne comprends donc rien ? Quand Lugia ouvrira les yeux, plus rien ne pourra l\'arrêter !', lose: 'Ce gamin... c\'est un vrai cauchemar.', after: '...' });
    admin(s, 13, 11, 'left', 'ecl:erebe3', 'erebe', GRUNT.erebe3, { sight: 2, intro: 'Tu es arrivé jusqu\'ici. Alors je vais devoir être sérieux.', lose: 'Je... Peut-être que la nuit éternelle n\'était pas une si bonne idée.', after: '...' });
    const boss = trainerNpc(s, 12, 8, 'down', 'Chef Éclipse', 'Nocturne', GRUNT.boss2, { id: 'ecl:boss2', sight: 2, ow: 'boss', bs: 'cyrus', prize: 200, ai: 'smart', items: { 'hyper-potion': 2, 'full-restore': 1 },
      intro: 'Te voilà enfin. Regarde. Lugia dort encore, mais le Prisme Noir a déjà refermé son cœur. Dans un instant, il se réveillera, et il m\'obéira. Rien ne peut plus empêcher l\'Éclipse.',
      lose: 'Impossible... Battu par un enfant, ici, au moment de mon triomphe...', after: '...' });
    Object.assign(boss, { vanish: true, music: 'eclipse', winScript: 'boss2' });
    s.item(3, 16, 'revive', 2); s.item(21, 17, 'full-restore');
    maps.sanctuaire = s;
  }

  /* ======================== Conseil 4 et Maître ======================== */
  {
    const rooms = ['plateau:ligue', 'ligue:c2', 'ligue:c3', 'ligue:c4', 'ligue:maitre'];
    for (let i = 1; i < rooms.length; i++) {
      const m = leagueInterior(rooms[i]);
      m.set(m.exitX, m.exitY, T.FLOOR);
      m.townId = 'plateau'; m.outside = maps['plateau:ligue'].outside;
      maps[rooms[i]] = m;
    }
    const DECO = ['icecrystal', 'candle', 'brazier', 'darkpillar'];
    ELITE.forEach((e, i) => {
      const m = maps[rooms[i]]; if (i) m.name = e.room;
      m.floor = e.floor;
      // chaque salle du Conseil 4 a son décor, le long des murs
      for (const y of [3, 7, 11, 15]) { m.prop(DECO[i], 1, y); m.prop(DECO[i], 13, y); }
      const n = trainerNpc(m, 7, 3, 'down', 'Conseil 4', e.name, e.team, { id: e.id, sight: 0, ow: e.ow, bs: e.bs, prize: 150, ai: 'smart', items: { 'hyper-potion': 2, 'full-heal': 1 }, intro: e.intro, lose: e.lose, after: 'Avance. La salle suivante t\'attend.' });
      Object.assign(n, { beatenPos: [9, 3], music: 'leader' });
      // porte du fond vers la salle suivante
      m.set(7, 1, T.DOOR); m.warp(7, 1, { map: rooms[i + 1], x: 7, y: 16, dir: 'up' });
    });
    const M = maps['ligue:maitre']; M.name = 'Salle de la Maître'; M.music = 'league';
    M.npc({ id: 'champion', x: 7, y: 3, dir: 'down', sprite: champion.ow, champion: true, trainer: { cls: 'Maître', name: champion.name, team: champion.team, prize: 200, bs: champion.bs, ai: 'smart', items: { 'full-restore': 2 }, intro: champion.intro, lose: champion.lose, sight: 0 } });
  }

  /* ======================== CS et chemins cachés ======================== */
  {
    const B = towns.B;
    tn(B, 28, 8, { id: 'bucheron', sprite: 'hiker', dir: 'down', script: 'gift', gift: {
      item: 'hm01', flag: 'giftCoupe', who: 'Bûcheron', need: (st) => st.badges[0],
      pre: ['Tu vois ces petits arbres qui barrent certains chemins ? On peut les couper.', 'Reviens avec le badge de l\'Arène, et je t\'apprendrai comment faire.'],
      give: ['Le Badge Élytre ! Bravo, petit. Tiens, prends cette CS.'],
      got: ['La CS01 contient Coupe. Face à un petit arbre, appuie sur Espace et ton Pokémon le taillera.', 'Il y a des recoins cachés un peu partout le long des routes. Ouvre l\'œil !'],
      done: ['Couper du bois, c\'est tout un art. Ton Pokémon a l\'air doué !'] } });
    // recoins secrets : [route, t, côté, obstacle, objets]
    const pockets = [
      [R.r1, 0.42, 1, T.BUSH, [['great-ball', 3]]], [R.r2, 0.55, -1, T.BUSH, [['rare-candy', 1]]], [R.bois, 0.62, -1, T.BUSH, [['medaillon', 1]]],
      [R.r3a, 0.5, -1, T.BOULDER, [['moon-stone', 1]]], [R.r4, 0.5, 1, T.BUSH, [['ultra-ball', 2]]], [R.r5, 0.38, 1, T.BOULDER, [['rare-candy', 1], ['max-repel', 1]]],
      [R.r6, 0.6, -1, T.BUSH, [['full-heal', 2]]], [R.r7, 0.35, 1, T.BOULDER, [['max-potion', 1]]], [R.r10, 0.55, -1, T.BOULDER, [['full-restore', 1]]],
      [R.r1, 0.75, -1, T.BOULDER, [['sun-stone', 1]]],
    ];
    W.pockets = [];
    for (const [pts, t, side, obs, items] of pockets) { const p = secretPocket(W, pts, t, side, obs, items); W.pockets.push(p); }
  }

  /* ======================== quêtes annexes ======================== */
  {
    const { B, C, E, G, H, I } = towns;
    tn(B, 24, 13, { id: 'medaillon', sprite: 'lass', dir: 'down', move: 'turn', script: 'deliver', deliver: {
      item: 'medaillon', flag: 'qMedaillon', who: 'Lucie', reward: [['rare-candy', 1], ['super-potion', 3]],
      ask: ['Snif... J\'ai perdu le médaillon de ma grand-mère en jouant dans le Bois Murmure.', 'Il est sûrement tombé derrière un petit arbre... Je n\'arrive pas à passer !'],
      thanks: ['Mon médaillon ! Tu l\'as retrouvé ! Merci, merci, merci !', 'Tiens, c\'est tout ce que j\'ai. Grand-mère dit que ça rend les Pokémon plus forts.'], done: ['Je ne le quitterai plus jamais !'] } });
    tn(C, 8, 12, { id: 'geologue', sprite: 'hiker', dir: 'down', script: 'show', show: {
      flag: 'qRoche', who: 'Géologue', test: (m) => SPECIES[m.sp].t.includes('rock'), reward: [['great-ball', 4]],
      ask: ['Je collectionne les observations de Pokémon Roche.', 'Montre-m\'en un, n\'importe lequel, et je te récompenserai !'],
      thanks: ['Magnifique ! Regarde-moi cette carapace minérale...', 'Voilà pour toi, comme promis.'], done: ['La Grotte Lunaire regorge de Pokémon Roche. Et de Pierres Lune !'] } });
    tn(E, 14, 3, { id: 'echange', sprite: 'youngster', dir: 'down', script: 'trade', trade: {
      flag: 'qEchange', who: 'Bastien', want: 16, give: 81, lvl: 18, nick: 'Boulon',
      ask: ['J\'adore les Pokémon Vol ! Tu n\'aurais pas un Roucool ?', 'Je te l\'échange contre mon Magnéti, Boulon !'],
      thanks: ['Génial ! Prends soin de Boulon, il adore les néons de la ville.'], done: ['Mon Roucool vole déjà comme un pro !'] } });
    maps['flora:bighouse21'].npc({ id: 'flora:evoli', x: 8, y: 3, sprite: 'cooltrainer_f', dir: 'down', script: 'giftmon', giftmon: {
      sp: 133, lvl: 20, flag: 'giftEvoli', who: 'Éleveuse',
      ask: ['Mon Évoli a eu des petits, et ils cherchent tous un dresseur attentionné.', 'Tu veux bien en adopter un ?'],
      got: ['Évoli peut évoluer de bien des façons... Avec une pierre, par exemple !'], done: ['Ton Évoli a l\'air heureux avec toi. Ça me fait chaud au cœur.'] } });
    tn(G, 24, 5, { id: 'dexpert', sprite: 'prof', dir: 'down', script: 'dexq', dexq: { who: 'Chercheur', tiers: [[25, 'ultra-ball', 5], [50, 'rare-candy', 3], [80, 'master-ball', 1]] } });
    tn(H, 26, 5, { id: 'sources', sprite: 'hiker', dir: 'down', script: 'show', show: {
      flag: 'qNiveau', who: 'Vétéran', test: (m) => m.lvl >= 40, reward: [['full-restore', 2]],
      ask: ['Les sources chaudes de Cendrelune n\'acceptent que les Pokémon aguerris.', 'Montre-moi un Pokémon de niveau 40 au moins !'],
      thanks: ['Ça, c\'est un Pokémon bien entraîné ! Prends ces Guérisons, tu les mérites.'], done: ['Reviens te baigner quand tu veux !'] } });
    tn(I, 20, 12, { id: 'ancien', sprite: 'prof', dir: 'down', script: 'giftmon', giftmon: {
      sp: 147, lvl: 30, flag: 'giftMinidraco', who: 'Ancien du clan', need: (st) => st.badges[7],
      pre: ['Seuls ceux que Drakon a reconnus peuvent recevoir l\'héritage du clan des dragons.'],
      ask: ['Tu portes le Badge Écaille... Drakon t\'a reconnu.', 'Alors accepte ce Minidraco. Il deviendra un jour un puissant Dracolosse.'],
      got: ['Traite-le avec respect, et il te le rendra au centuple.'], done: ['Les dragons veillent sur toi, jeune dresseur.'] } });
    // pendant l'Éclipse, les habitants s'inquiètent
    const worry = [
      [towns.A, 11, 16, 'Il fait nuit en plein jour... Les Pokémon de la route 1 ne sortent plus de leurs terriers.'],
      [towns.D, 6, 13, 'La mer est noire comme de l\'encre depuis que le ciel s\'est éteint. Les marins ne veulent plus sortir.'],
      [towns.F, 13, 25, 'Mes fleurs se referment toutes... Elles croient que c\'est la nuit. Elles ont raison, d\'ailleurs.'],
      [towns.H, 5, 14, 'Le volcan gronde depuis que le ciel est devenu violet. Quelque chose ne va pas, au sud de la mer.'],
      [towns.I, 25, 12, 'Les dragons de Cimelune s\'agitent. Ils sentent la présence d\'un Pokémon immense, quelque part au sud-est.'],
    ];
    worry.forEach(([t, lx, ly, line], i) => tn(t, lx, ly, { id: 'eclipse' + i, sprite: ['lass', 'sailor', 'cooltrainer_f', 'hiker', 'youngster'][i], dir: 'down', move: 'turn', showIf: 'eclipse', hideIf: 'lugia', text: [line] }));
    // la voyante de Mirage connaît la légende et garde la Plume Argent
    const voy = W.npcs.find((n) => n.id === 'mirage:voyante');
    Object.assign(voy, { script: 'gift', text: null, gift: {
      item: 'silver-wing', flag: 'giftPlume', who: 'Voyante', need: (st) => st.flags.eclipse && st.badges[5],
      pre: (st) => (st.flags.eclipse ? ['Le ciel s\'est éteint... Je vois une grande ombre sous les vagues.', 'Bats d\'abord Sibylle, à l\'Arène. Ensuite, reviens me voir.'] : ['Je vois... un grand combat dans ton avenir.', 'Et un Centre Pokémon juste après, je pense.']),
      give: ['Tu as le Badge Mirage. Écoute-moi bien.', 'Lugia, le gardien des marées, dort dans le Sanctuaire, sur un îlot au sud du Pont des Marées.', 'La Team Éclipse a fermé son cœur avec le Prisme Noir. S\'il se réveille ainsi, la nuit ne finira jamais.', 'Cette Plume Argent ouvre le Sanctuaire. Surfe depuis le pont, vers le sud. Va, vite !'],
      got: ['Le Pont des Marées part de Cendrelune, au bout de la route 7.'], done: ['Le Sanctuaire t\'attend, au sud du Pont des Marées...'] } });
  }
}

/* ---------------- outils de construction ---------------- */
function nearestCave(m, x, y) {
  for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const a = x + dx, b = y + dy;
    if (m.get(a, b) === T.CAVE && m.get(a + 1, b) === T.CAVE && m.get(a - 1, b) === T.CAVE && !m.npcs.some((n) => n.x === a && n.y === b) && !m.items.some((n) => n.x === a && n.y === b) && !m.warpAt(a, b)) return [a, b];
  }
  return [x, y];
}

/** entrée de grotte posée dans la forêt, reliée au sentier le plus proche en dessous */
function cavePortal(W, x, y) {
  const b = W.building('cave', x, y);
  for (let yy = b.doorY + 1; yy < b.doorY + 12; yy++) { if (walkable(W.get(b.doorX, yy))) break; W.set(b.doorX, yy, T.PATH); if (!walkable(W.get(b.doorX + 1, yy))) W.set(b.doorX + 1, yy, T.GRASS); }
  return { x: b.doorX, y: b.doorY };
}

/**
 * Recoin secret derrière un obstacle (petit arbre à couper ou rocher à pousser), creusé dans la forêt au bord d'une route :
 * obstacle, couloir de 3 tuiles, clairière 3 × 3 avec les objets. Ne creuse que des arbres et ne touche aucune autre zone.
 */
function secretPocket(W, pts, t0, side, obs, items) {
  for (let tries = 0; tries < 24; tries++) {
    const t = t0 + (tries % 2 ? 1 : -1) * Math.ceil(tries / 2) * 0.015;
    const p = along(pts, t);
    let dx = p.nx * side, dy = p.ny * side;
    if (Math.abs(dx) > Math.abs(dy)) { dx = Math.sign(dx); dy = 0; } else { dy = Math.sign(dy); dx = 0; }
    // part du sentier vers l'extérieur jusqu'au premier arbre
    let x = Math.round(p.x), y = Math.round(p.y), k = 0;
    while (k++ < 14 && W.get(x, y) !== T.TREE && W.get(x, y) !== T.PINE) { x += dx; y += dy; }
    const before = W.get(x - dx, y - dy);
    if (k >= 14 || !walkable(before) || before === T.TALL || before === T.DARKTALL) continue;
    const ex = x, ey = y;
    const set = [];
    for (let i = 1; i <= 3; i++) set.push([ex + dx * i, ey + dy * i]);
    const cx = ex + dx * 5, cy = ey + dy * 5; // centre de la clairière
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) set.push([cx + i, cy + j]);
    const inSet = new Set(set.map(([a, b]) => key(a, b)));
    let ok = W.in(cx - 3, cy - 3) && W.in(cx + 3, cy + 3);
    for (const [a, b] of set) {
      if (!ok) break;
      if (W.get(a, b) !== T.TREE && W.get(a, b) !== T.PINE) ok = false;
      for (let j = -1; j <= 1 && ok; j++) for (let i = -1; i <= 1; i++) {
        const q = key(a + i, b + j); if (inSet.has(q) || (a + i === ex && b + j === ey)) continue;
        const tt = W.get(a + i, b + j); if (tt !== T.TREE && tt !== T.PINE && tt !== T.WATER) { ok = false; break; }
      }
    }
    // l'obstacle ne touche que le sentier, côté route
    for (const [i, j] of [[dy, dx], [-dy, -dx]]) { const tt = W.get(ex + i, ey + j); if (tt !== T.TREE && tt !== T.PINE) ok = false; }
    if (!ok || W.zones.some((z) => z.town && cx >= z.x0 - 2 && cx <= z.x1 + 2 && cy >= z.y0 - 2 && cy <= z.y1 + 2)) continue;
    for (const [a, b] of set) W.set(a, b, T.GRASS);
    W.set(ex, ey, obs);
    // un rocher poussé finit au fond de la clairière : les objets sont posés sur le côté,
    // et jamais sur la rangée du bas, cachée par les arbres de devant
    const spots = dx ? [[cx, cy - 1], [cx + dx, cy - 1]] : [[cx - 1, cy], [cx + 1, cy]];
    items.forEach(([it, q], i) => { W.item(spots[i][0], spots[i][1], it, q); W.items[W.items.length - 1].secret = obs; });
    return { x: ex, y: ey, dx, dy, obs, items: items.map((i) => i[0]), clearing: [cx, cy] };
  }
  return null;
}
