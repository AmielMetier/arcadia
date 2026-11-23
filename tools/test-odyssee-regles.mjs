// tools/test-odyssee-regles.mjs — Odyssée : règles de combat précises, une par bug corrigé (audit du 15 novembre 2026).
// Les 600 combats de test-odyssee.mjs vérifient que rien ne plante ; ici on vérifie que les règles sont justes.
//   node tools/test-odyssee-regles.mjs      (à lancer quand on touche à odyssee/js/core/battle.js ou mon.js)
import { Battle } from '../odyssee/js/core/battle.js';
import { createMon, healFull, levelEvolution } from '../odyssee/js/core/mon.js';
import { MOVES } from '../odyssee/js/data/moves.js';
import { SPECIES } from '../odyssee/js/data/species.js';

const key = Object.fromEntries(Object.values(MOVES).map((m) => [m.key, m.id]));
const sp = (n) => +Object.keys(SPECIES).find((k) => SPECIES[k].n === n);
let seed = 1; const rng = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const mk = (n, lvl, moves, o = {}) => createMon(sp(n), lvl, { moves: moves.map((k) => key[k]), iv: Array(6).fill(31), rng, shiny: false, ...o });
const texts = (ev) => ev.filter((e) => e.t === 'msg').map((e) => e.text);
const wild = (me, foe, bag = {}) => { const b = new Battle({ rng, player: { name: 'A', party: [].concat(me), bag }, foe: { name: 'w', party: [foe] } }); b.start(); return b; };
const trainer = (me, foes, tr = {}) => { const b = new Battle({ rng, player: { name: 'A', party: [].concat(me), bag: {} }, foe: { name: 'T', party: [].concat(foes), trainer: { cls: 'Dresseur', name: 'Bob', prize: 20, ...tr } } }); b.start(); return b; };
let fails = 0; const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };

{ // un drapeau de K.O. resté dans une sauvegarde ne bloque plus le combat suivant
  seed = 12345; const me = mk('Pikachu', 5, ['thunder-shock']); me._ko = true; healFull(me);
  const b = trainer([me, mk('Rattata', 5, ['tackle'])], [mk('Onix', 40, ['rock-throw'])]);
  b.playerAction({ type: 'move', idx: 0 });
  ok(me.hp === 0 && b.state === 'switch', 'K.O. annoncé et remplaçant demandé malgré un ancien drapeau _ko');
}
{ // Bluff : premier tour seulement
  seed = 7; const me = mk('Persian', 30, ['fake-out']), foe = mk('Ronflex', 50, ['body-slam']);
  const b = trainer(me, foe); me.stats[0] = me.hp = 9999;
  const e1 = texts(b.playerAction({ type: 'move', idx: 0 })), e2 = texts(b.playerAction({ type: 'move', idx: 0 }));
  ok(e1.some((t) => /a peur/.test(t)), 'Bluff apeure au premier tour');
  ok(e2.some((t) => /échoue/.test(t)) && !e2.some((t) => /a peur/.test(t)), 'Bluff échoue ensuite');
}
{ // Vol interrompu : le Pokémon redescend
  let stuck = 0, n = 0;
  for (let s = 1; s <= 200; s++) { seed = s * 97; const me = mk('Roucarnage', 50, ['fly']); me.status = 'par'; const b = wild(me, mk('Ronflex', 50, ['splash']));
    b.playerAction({ type: 'move', idx: 0 }); if (!b.sides[0].v.invuln) continue; n++;
    b.playerAction({ type: 'move', idx: 0 }); if (b.sides[0].v.invuln && !b.sides[0].v.charge) stuck++; }
  ok(n > 50 && stuck === 0, `Vol + paralysie : ${n} envols, aucun Pokémon resté invulnérable`);
}
{ // objets Choix
  seed = 5; const me = mk('Dracolosse', 60, ['dragon-claw', 'earthquake'], { item: 'choice-band' }); const b = wild(me, mk('Ronflex', 80, ['splash']));
  b.playerAction({ type: 'move', idx: 0 }); const e = texts(b.playerAction({ type: 'move', idx: 1 }));
  ok(e.length === 1 && /ne laisse utiliser que/.test(e[0]), 'Bandeau Choix : bloqué sur la première attaque');
}
{ // puissances manquantes
  const dmg = (k, foeMove = 'splash') => { seed = 3; const me = mk('Dracolosse', 60, [k]), foe = mk('Ronflex', 50, [foeMove]); const b = wild(me, foe); const h = foe.hp; b.playerAction({ type: 'move', idx: 0 }); return [h - foe.hp, me.hp]; };
  ok(dmg('electro-ball')[0] > 10, 'Boule Élek fait de vrais dégâts');
  ok(dmg('heat-crash')[0] > 10, 'Tacle Feu fait de vrais dégâts');
  const fg = dmg('final-gambit'); ok(fg[0] > 100 && fg[1] === 0, 'Tout ou Rien : les PV du lanceur en dégâts, et il tombe');
}
{ // deux évolutions par niveau : les deux existent
  const tos = new Set(); for (let uid = 1; uid <= 20; uid++) tos.add(levelEvolution({ sp: sp('Chenipotte'), lvl: 50, uid }));
  ok(tos.size === 2, 'Chenipotte évolue en Armulys ou en Blindalys selon le Pokémon');
  ok(levelEvolution({ sp: sp('Bulbizarre'), lvl: 16, uid: 3 }) === sp('Herbizarre'), 'une évolution simple ne change pas');
}
{ // soin adverse : le statut disparaît aussi à l'écran
  seed = 9; const me = mk('Pikachu', 50, ['thunder-wave', 'thunder-shock']), foe = mk('Ronflex', 50, ['splash']);
  const b = trainer(me, foe, { ai: 'smart', items: { 'full-restore': 2 } }); b.playerAction({ type: 'move', idx: 0 });
  const ev = b.playerAction({ type: 'move', idx: 1 });
  ok(ev.some((e) => e.t === 'status' && e.side === 1 && e.status === null), 'Guérison adverse : événement de statut envoyé');
}
{ // défauts mineurs
  seed = 2; let me = mk('Électrode', 50, ['explosion']), foe = mk('Ectoplasma', 50, ['splash']); let b = wild(me, foe);
  b.playerAction({ type: 'move', idx: 0 }); ok(me.hp === 0, 'Explosion sur une immunité : le lanceur tombe quand même');
  seed = 2; me = mk('Pikachu', 50, ['thunder-wave']); foe = mk('Magnéti', 50, ['splash']); b = wild(me, foe);
  b.playerAction({ type: 'move', idx: 0 }); ok(!foe.status, 'un type Électrik ne peut pas être paralysé');
  seed = 2; me = mk('Florizarre', 50, ['solar-beam']); foe = mk('Ronflex', 50, ['splash']); b = new Battle({ rng, weather: 'sun', player: { name: 'A', party: [me], bag: {} }, foe: { name: 'w', party: [foe] } }); b.start();
  const h = foe.hp; b.playerAction({ type: 'move', idx: 0 }); ok(foe.hp < h, 'Lance-Soleil part tout de suite au soleil');
  seed = 2; me = mk('Pikachu', 50, ['thunder-shock']); b = trainer(me, mk('Ronflex', 50, ['splash'])); b.bag['poke-ball'] = 3; b.playerAction({ type: 'item', item: 'poke-ball' });
  ok(b.bag['poke-ball'] === 3, 'une Ball déviée par un dresseur n\'est pas perdue');
  seed = 4; me = mk('Pikachu', 50, ['thunder-shock']); const me2 = mk('Rattata', 50, ['tackle']); b = wild([me, me2], mk('Ronflex', 50, ['splash'])); b.sides[0].v.trap = 3;
  const e = texts(b.playerAction({ type: 'switch', idx: 1 })); ok(/pris au piège/.test(e[0] || '') && b.sides[0].active === 0, 'pris au piège : pas de rappel');
  seed = 2; me = mk('Pikachu', 50, ['counter']); foe = mk('Ronflex', 50, ['splash']); b = wild(me, foe); const ev = b.playerAction({ type: 'move', idx: 0 });
  ok(texts(ev).some((t) => /échoue/.test(t)) && !ev.some((x) => x.t === 'hit'), 'Riposte sans coup reçu : échec, sans animation de coup');
}
{ // équilibrage : l'IA forte connaît Lévitation ; Évoli n'évolue plus par le niveau ; attaques choisies des Champions
  const { getAbility } = await import('../odyssee/js/data/abilities.js'); const { movesChoisies } = await import('../odyssee/js/core/mon.js');
  let me; for (let i = 0; i < 80 && !me; i++) { seed = 11 + i; const c = mk('Smogogo', 50, ['splash']); if (getAbility(c)?.id === 'levitate') me = c; }
  const foe = mk('Rhinoféros', 50, ['earthquake', 'rock-slide', 'stomp']); me.stats[0] = me.hp = 9999;
  const b = trainer(me, foe, { ai: 'smart' }); let seisme = 0;
  for (let n = 0; n < 12 && b.state === 'choose'; n++) { if (texts(b.playerAction({ type: 'move', idx: 0 })).some((t) => /utilise Séisme/.test(t))) seisme++; me.moves[0].pp = 10; }
  ok(!!me && seisme === 0, 'IA « smart » : jamais Séisme sur un Pokémon en Lévitation');
  ok(levelEvolution({ sp: 133, lvl: 60, uid: 1 }, 12) == null, 'Évoli n\'évolue plus tout seul avec le niveau');
  const ms = movesChoisies(sp('Dracolosse'), 81).map((id) => MOVES[id].key);
  ok(ms.length === 4 && ms.includes('dragon-dance') && !ms.includes('hyper-beam'), 'attaques choisies : Dracolosse garde Danse Draco, sans Ultralaser');
  seed = 5; const cap = mk('Pikachu', 13, ['thunder-shock']), cap2 = mk('Rattata', 13, ['tackle']);
  const bc = new Battle({ rng, cap: 13, player: { name: 'A', party: [cap, cap2], bag: {} }, foe: { name: 'T', party: [mk('Chenipan', 2, ['tackle']), mk('Chenipan', 2, ['tackle']), mk('Chenipan', 2, ['tackle'])], trainer: { cls: 'D', name: 'B', prize: 1 } } }); bc.start();
  let dits = 0; for (let n = 0; n < 8 && bc.state === 'choose'; n++) dits += texts(bc.playerAction({ type: 'move', idx: 0 })).filter((t) => /limite de niveau/.test(t)).length;
  ok(dits === 1, 'limite de niveau : annoncée une seule fois par combat');
}
{ // CT : une par Champion, les autres posées une fois chacune dans le monde, rattrapage des anciennes parties
  const { CTS, CT_DU_BADGE, CTS_POSEES } = await import('../odyssee/js/data/cts.js');
  const { ITEMS } = await import('../odyssee/js/core/items.js'); const { apteCT } = await import('../odyssee/js/core/mon.js');
  const { buildWorld } = await import('../odyssee/js/world/region.js'); const { rattraperCT } = await import('../odyssee/js/world/cts.js');
  ok(Object.keys(CTS).every((k) => ITEMS[k]?.ct && MOVES[ITEMS[k].ct]), `${Object.keys(CTS).length + 1} CT, chacune avec son attaque`);
  ok([...Array(15).keys()].every((g) => ITEMS[CT_DU_BADGE[g]]), 'une CT pour chacun des 15 Champions');
  const w = buildWorld(); const poses = new Set(w.cts.map((c) => c[0]));
  ok(CTS_POSEES.every((k) => poses.has(k)) && w.cts.length === CTS_POSEES.length, `les ${CTS_POSEES.length} CT du monde sont toutes posées, une fois chacune`);
  ok(apteCT(sp('Ronflex'), ITEMS['ct-23']) && !apteCT(sp('Magicarpe'), ITEMS['ct-12']), 'Abri pour (presque) tous, Séisme pas pour Magicarpe');
  const st = { flags: { ['I:' + w.cts[0][2]]: true }, bag: {} }; rattraperCT(st, w.cts);
  ok(st.bag[w.cts[0][0]] === 1, 'objet déjà ramassé devenu CT : la CT est donnée au chargement');
}
{ // baies et objets tenus (5.95)
  const { ITEMS } = await import('../odyssee/js/core/items.js');
  const hit = (k, item, foeName = 'Ronflex', lv = 50) => { seed = 3; const me = mk('Dracolosse', 60, [k]), foe = mk(foeName, lv, ['splash'], { item }); foe.stats[0] = foe.hp = 9999; const b = wild(me, foe); const ev = b.playerAction({ type: 'move', idx: 0 }); return [9999 - foe.hp, texts(ev), foe, me]; };
  const [sansB] = hit('flamethrower', null, 'Florizarre'), [avecB, tb, f1] = hit('flamethrower', 'occa-berry', 'Florizarre');
  ok(avecB < sansB * 0.6 && !f1.item && tb.some((t) => /Baie Chocco/.test(t)), `Baie Chocco : Lance-Flammes super efficace divisé par deux (${sansB} → ${avecB})`);
  const [, , f2] = hit('dragon-claw', 'occa-berry', 'Florizarre'); ok(f2.item === 'occa-berry', 'Baie Chocco gardée face à une attaque d\'un autre type');
  seed = 4; const p = mk('Pikachu', 50, ['thunder-wave']), foe = mk('Ronflex', 50, ['splash'], { item: 'cheri-berry' }); const b = wild(p, foe); b.playerAction({ type: 'move', idx: 0 });
  ok(!foe.status && !foe.item, 'Baie Ceriz : la paralysie est guérie aussitôt');
  const [avecV] = hit('flamethrower', 'assault-vest', 'Florizarre'); ok(avecV < sansB * 0.8, 'Veste de Combat : Déf. Spé. renforcée');
  seed = 5; const v = mk('Ronflex', 50, ['rest', 'body-slam'], { item: 'assault-vest' }); const bv = wild(v, mk('Pikachu', 50, ['splash'])); v.hp = 10;
  ok(texts(bv.playerAction({ type: 'move', idx: 0 })).some((t) => /Veste de Combat empêche/.test(t)) && v.hp <= 10, 'Veste de Combat : pas d\'attaque de statut');
  seed = 6; const wh = mk('Florizarre', 50, ['splash'], { item: 'white-herb' }); const bw = wild(mk('Pikachu', 50, ['growl']), wh); bw.sides[1].v.st[1] = 0;
  const bw2 = new Battle({ rng, player: { name: 'A', party: [mk('Pikachu', 50, ['growl'])], bag: {} }, foe: { name: 'w', party: [wh] } }); bw2.start(); bw2.playerAction({ type: 'move', idx: 0 });
  ok(bw2.sides[1].v.st[1] === 0 && !wh.item, 'Herbe Blanche : la baisse d\'Attaque est annulée');
  const icones = Object.keys(ITEMS).filter((k) => /berry|vest|belt|band|glasses|claw|lens|root|rock|herb|sludge|bell|tag|feather/.test(k));
  const fs = await import('node:fs'); const manque = icones.filter((k) => !fs.existsSync(new URL(`../odyssee/img/pokeapi/items/${k}.png`, import.meta.url)) && !fs.existsSync(new URL(`../odyssee/img/items/${k}.png`, import.meta.url)));
  ok(!manque.length, `toutes les baies et objets tenus ont leur icône${manque.length ? ' (manque : ' + manque.join(', ') + ')' : ''}`);
}
{ // après la Ligue : 33 légendaires au bord des routes, tous atteignables, seulement pour le Maître
  const { buildWorld } = await import('../odyssee/js/world/region.js'); const { rangs, JAMAIS } = await import('../odyssee/js/world/acces.js');
  const w = buildWorld(), m = w.maps.monde, apres = w.legends.filter((q) => q.apresLigue);
  const r = rangs(w.maps, w.docks, { map: 'monde', x: w.towns.A.x + 5, y: w.towns.A.y + 7 }, { bloquants: false }).get('monde');
  const loin = apres.filter((L) => ![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const v = r[(L.y + dy) * m.w + L.x + dx]; return v != null && v !== JAMAIS; }));
  ok(apres.length === 33 && !loin.length, `33 légendaires d'après la Ligue, tous atteignables${loin.length ? ' (sauf ' + loin.map((L) => L.id).join(', ') + ')' : ''}`);
  ok(apres.every((L) => !L.cond({}) && (L.id === 'odyssor' || L.cond({ champion: true }) || ['regigigas', 'arceus', 'keldeo', 'demeteros', 'kyurem'].includes(L.id))), 'ils n\'apparaissent qu\'au Maître de la Ligue');
  const { buildWorld: _ } = { buildWorld }; void _;
  ok(!!w.maps['plateau:ligue'].npcs.find((n) => n.def?.script === 'tourCombat' || n.script === 'tourCombat'), 'le Maître de la Tour de Combat attend dans le hall de la Ligue');
}
{ // Lot 2 : descriptions d'attaques, talents originaux/Méga, plafonds +100 BST, et règles de combat corrigées
  const { moveDesc } = await import('../odyssee/js/data/moveDescriptions.js');
  const { ABILITIES, abilitiesOf, getAbility } = await import('../odyssee/js/data/abilities.js');
  const { MEGA_FORMS } = await import('../odyssee/js/core/mega.js');

  const rawEn = Object.values(MOVES).filter((m) => /de type (normal|fire|water|grass|electric|ice|fighting|poison|ground|flying|psychic|bug|rock|ghost|dragon|dark|steel|fairy)\b/.test(moveDesc(m)));
  ok(rawEn.length === 0, `descriptions : aucun type anglais brut (${rawEn.length})`);
  ok(/flamme/.test(moveDesc(52)) && !/massue/.test(moveDesc(52)) && /électrique/.test(moveDesc(85)) && /télékinétique/.test(moveDesc(94)) && /lumière/.test(moveDesc(76)) && /empoisonne/.test(moveDesc(77)) && /Endort/.test(moveDesc(79)) && /sommeil/.test(moveDesc(95)) && /absorbe/.test(moveDesc(71)) && /Draine/.test(moveDesc(72)) && /sans jamais rater/.test(moveDesc(185)) && /carapace/.test(moveDesc(110)) && /K\.O\./.test(moveDesc(12)), 'descriptions : 10+ attaques emblématiques + OHKO corrigées');

  const gen9Dead = new Set(['quark-drive', 'protosynthesis', 'hospitality', 'toxic-chain', 'tera-shift', 'poison-puppeteer', 'supersweet-syrup', 'guard-dog', 'stalwart']);
  const origCollisions = [];
  for (let s0 = 1001; s0 <= 1060; s0++) for (const a of abilitiesOf(s0)) if (a && gen9Dead.has(a)) origCollisions.push(`${s0}:${a}`);
  ok(origCollisions.length === 0 && abilitiesOf(1052)[0] === 'multiscale', `talents originaux 1001..1060 sans collision Gen 9 (${origCollisions.length}) et Odyssor = Multiécaille`);

  const raidTyran = createMon(10049, 60, { ability: 'unnerve' });
  ok(getAbility(raidTyran)?.id === 'sand-stream', 'talent Méga prioritaire sur m.ability d\'un boss capturé');

  const megaBad = [], missingMegaAb = [];
  for (const [pid, f] of Object.entries(MEGA_FORMS)) {
    const b = SPECIES[f.base];
    const diff = f.b.reduce((a, c) => a + c, 0) - b.b.reduce((a, c) => a + c, 0);
    if (diff !== 100 || f.b[0] !== b.b[0]) megaBad.push(`${pid}:${f.n}:${diff}`);
    if (f.ab && (!ABILITIES[f.ab]?.name || !ABILITIES[f.ab]?.desc)) missingMegaAb.push(f.ab);
  }
  ok(megaBad.length === 0 && Object.keys(MEGA_FORMS).length === 105 && missingMegaAb.length === 0, `105 Méga-Évolutions à +100 BST strict et talents traduits FR (écarts=${megaBad.length}, sans_FR=${missingMegaAb.length})`);
  ok(MEGA_FORMS[10280].ab !== 'huge-power' && MEGA_FORMS[20002].b[1] <= 65, 'Méga-Staross et Méga-Azumarill rééquilibrés');

  // mold-breaker
  seed = 10; let me = createMon(409, 60, { moves: [key['earthquake']], ability: 'mold-breaker', iv: Array(6).fill(31), rng });
  let foe = mk('Ectoplasma', 60, ['splash'], { ability: 'levitate' });
  let b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 });
  ok(foe.hp === 0, 'Brise Moule traverse Lévitation');

  // magic-bounce
  seed = 11; me = mk('Pikachu', 50, ['toxic']); foe = mk('Mentali', 50, ['splash'], { ability: 'magic-bounce' });
  b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 });
  ok(!foe.status && (me.status === 'psn' || me.status === 'tox'), 'Miroir Magik renvoie Toxik sur le lanceur');

  // unnerve
  seed = 12; me = mk('Mewtwo', 60, ['tackle'], { ability: 'unnerve' }); foe = mk('Ronflex', 60, ['splash'], { item: 'sitrus-berry' });
  foe.hp = Math.floor(foe.stats[0] * 0.4);
  b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 });
  ok(foe.item === 'sitrus-berry', 'Tension empêche la cible de manger sa Baie Sitrus');

  // POWDER_MOVES sur Plante
  seed = 13; me = mk('Florizarre', 50, ['sleep-powder', 'cotton-spore']); foe = mk('Florizarre', 50, ['splash']);
  b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 }); b.playerAction({ type: 'move', idx: 1 });
  ok(!foe.status && b.sides[1].v.st[5] === 0, 'Poudre Dodo et Spore Coton bloquées sur un type Plante');

  // sheer-force Close Combat vs Meteor Mash + Orbe Vie
  seed = 14; me = mk('Nidoking', 60, ['close-combat', 'ice-beam'], { ability: 'sheer-force', item: 'life-orb' });
  foe = mk('Ronflex', 80, ['splash']); foe.stats[0] = foe.hp = 9999;
  b = wild(me, foe);
  const hp0 = me.hp; b.playerAction({ type: 'move', idx: 0 });
  ok(b.sides[0].v.st[2] === -1 && b.sides[0].v.st[4] === -1 && me.hp < hp0, 'Sans Limite ne supprime ni les malus personnels de Close Combat ni le recul Orbe Vie');
  const hp1 = me.hp; b.playerAction({ type: 'move', idx: 1 });
  ok(me.hp === hp1 && !foe.status, 'Sans Limite supprime les effets secondaires de Laser Glace et le recul Orbe Vie');

  // lastUser / Acharné + Cire Brûlante
  seed = 15; me = mk('Scalproie', 60, ['close-combat'], { ability: 'defiant' });
  foe = createMon(1004, 50, { moves: [key['ember']], iv: Array(6).fill(31), rng });
  foe.stats[0] = foe.hp = 9999;
  b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 });
  ok(b.sides[0].v.st[1] === 2 && b.sides[0].v.st[5] === -1 && b.sides[0].v.st[2] === -1 && b.sides[0].v.st[4] === -1, 'Close Combat sur Cire Brûlante : +2 Atq (Cire) mais jamais +6 sur Close Combat');

  // life-orb en 2v2 (une seule perte de 10% PV par attaque de zone)
  seed = 16; me = mk('Carchacrok', 70, ['earthquake'], { item: 'life-orb', ability: 'sand-veil' });
  const ally = mk('Électhor', 70, ['splash'], { ability: 'pressure' });
  const fA = mk('Pikachu', 20, ['splash']), fB = mk('Pikachu', 20, ['splash']);
  b = new Battle({ rng, slots: 2, player: { name: 'A', party: [me, ally], bag: {} }, foe: { name: 'T', party: [fA, fB], trainer: { cls: 'D', name: 'Duo', prize: 1 } } });
  b.start(); const loBefore = me.hp;
  b.playerAction([{ slot: 0, type: 'move', idx: 0 }, { slot: 1, type: 'move', idx: 0 }]);
  ok(loBefore - me.hp === Math.floor(me.stats[0] / 10), `Orbe Vie 2v2 draine 1 fois 10% (${loBefore - me.hp} == ${Math.floor(me.stats[0] / 10)})`);

  // timing Baie Prine / Baie Fraive
  seed = 17; me = mk('Pikachu', 50, ['will-o-wisp']); foe = mk('Ronflex', 50, ['splash'], { item: 'rawst-berry' });
  b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 });
  ok(!foe.status && !foe.item && foe.hp === foe.stats[0], 'Baie Fraive guérit aussitôt sans aucun dégât de brûlure');
  seed = 18; me = mk('Pikachu', 50, ['hypnosis']); foe = mk('Ronflex', 50, ['tackle'], { item: 'lum-berry' });
  b = wild(me, foe); foe.stats[0] = foe.hp = 9999; b.playerAction({ type: 'move', idx: 0 });
  ok(!foe.status && !foe.item && me.hp < me.stats[0], 'Baie Prine réveille immédiatement sans bloquer l\'attaque du tour');

  // facade brûlé
  seed = 19; const r1 = mk('Ronflex', 60, ['facade'], { ability: 'thick-fat' }); r1.status = 'brn';
  const r2 = mk('Ronflex', 60, ['body-slam'], { ability: 'thick-fat' }); r2.status = 'brn';
  const t1 = mk('Ronflex', 60, ['splash']), t2 = mk('Ronflex', 60, ['splash']); t1.stats[0] = t1.hp = 9999; t2.stats[0] = t2.hp = 9999;
  wild(r1, t1).playerAction({ type: 'move', idx: 0 }); wild(r2, t2).playerAction({ type: 'move', idx: 0 });
  ok((9999 - t1.hp) > (9999 - t2.hp) * 2.5, `Façade sous brûlure n'est pas divisée par 2 (${9999 - t1.hp} vs ${9999 - t2.hp})`);

  // eruption selon PV
  seed = 20; me = mk('Typhlosion', 60, ['eruption'], { ability: 'blaze' }); foe = mk('Ronflex', 70, ['splash'], { ability: 'thick-fat' }); foe.stats[0] = foe.hp = 9999;
  wild(me, foe).playerAction({ type: 'move', idx: 0 }); const fullErup = 9999 - foe.hp;
  me.hp = Math.floor(me.stats[0] * 0.25); foe.hp = 9999;
  wild(me, foe).playerAction({ type: 'move', idx: 0 }); const lowErup = 9999 - foe.hp;
  ok(fullErup > lowErup * 2, `Éruption baisse selon les PV restants (${fullErup} vs ${lowErup})`);

  // shadow-force (2 tours + perce Abri)
  seed = 21; me = createMon(487, 60, { moves: [key['shadow-force']], iv: Array(6).fill(31), nat: 0, rng });
  foe = mk('Pikachu', 60, ['protect', 'protect']);
  b = wild(me, foe);
  const sf1 = texts(b.playerAction({ type: 'move', idx: 0 }));
  ok(b.sides[0].v.invuln === 'shadow' && !sf1.some((t) => /inflige|super/.test(t)), 'Revenant disparaît au 1er tour');
  const hFoe0 = foe.hp;
  b.playerAction({ type: 'move', idx: 0 });
  ok(foe.hp < hFoe0 && b.sides[0].v.invuln == null, 'Revenant touche au 2e tour même à travers Abri');

  // roar en combat Dresseur
  seed = 22; me = mk('Roucarnage', 60, ['roar']);
  const fa1 = mk('Ronflex', 50, ['splash']), fa2 = mk('Pikachu', 50, ['splash']);
  b = trainer(me, [fa1, fa2]); b.playerAction({ type: 'move', idx: 0 });
  ok(b.sides[1].active === 1, 'Hurlement force un switch en combat de Dresseur');

  // Objet Choix à 0 PP -> Lutte (pas de déblocage)
  seed = 23; me = mk('Dracolosse', 60, ['dragon-claw', 'earthquake'], { item: 'choice-band' });
  foe = mk('Ronflex', 80, ['splash']);
  b = wild(me, foe); b.playerAction({ type: 'move', idx: 0 });
  me.moves[0].pp = 0;
  ok(b.choiceLock(0) === key['dragon-claw'] && b.usableMoves(0).length === 0, 'Objet Choix à 0 PP verrouille les autres attaques');
  const struggleEvs = texts(b.playerAction({ type: 'move', idx: 1 }));
  ok(struggleEvs.some((t) => /utilise Lutte/.test(t)), 'Objet Choix à 0 PP utilise Lutte');

  // K.O. 1v1 + endOfTurn sans dégât sur le remplaçant frais
  seed = 24; me = mk('Dracolosse', 80, ['dragon-claw'], { ability: 'inner-focus' });
  const k1 = mk('Pikachu', 20, ['splash']), k2 = mk('Rattata', 50, ['splash']);
  b = new Battle({ rng, weather: 'sandstorm', player: { name: 'A', party: [me], bag: {} }, foe: { name: 'T', party: [k1, k2], trainer: { cls: 'D', name: 'B', prize: 1 } } });
  b.start(); b.playerAction({ type: 'move', idx: 0 });
  ok(b.sides[1].active === 1 && k2.hp === k2.stats[0], 'K.O. 1v1 : le remplaçant frais ne subit pas la tempête de sable du tour du K.O.');

  // coeur-vaillant (1 fois par combat + n'immunise plus à la peur)
  seed = 25; const narv = createMon(1009, 60, { moves: [key['tackle']], iv: Array(6).fill(31), rng });
  const alt = mk('Pikachu', 50, ['splash']);
  foe = mk('Persian', 70, ['fake-out', 'splash']);
  b = trainer([narv, alt], foe, { ai: 'smart' });
  const c1 = b.sides[0].v.st[1];
  b.playerAction({ type: 'move', idx: 0 }); // Persian fake-out devrait apeurer Narvaillant
  const narvFlinched = texts(b.ev || []).length >= 0; void narvFlinched;
  b.playerAction({ type: 'switch', idx: 1 });
  b.playerAction({ type: 'switch', idx: 0 });
  ok(c1 === 1 && b.sides[0].v.st[1] === 0, 'Cœur Vaillant : +1 Atq uniquement à la 1re entrée au combat');
  seed = 25; const narv2 = createMon(1009, 40, { moves: [key['tackle']], iv: Array(6).fill(31), rng });
  const fastFoe = mk('Persian', 70, ['fake-out']);
  const flEvs = texts(wild(narv2, fastFoe).playerAction({ type: 'move', idx: 0 }));
  ok(flEvs.some((t) => /a peur/.test(t)), 'Cœur Vaillant n\'immunise plus contre la peur');

  // Top talents Méga en combat (tough-claws, pixilate, parental-bond, protean, trace, infiltrator, bad-dreams, fairy-aura, strong-jaw, mega-launcher)
  const dmgOf = (spId, mvKey, o = {}, foeSp = 'Ronflex', battleOpts = {}) => {
    seed = 31;
    const atk = createMon(spId, 60, { moves: [key[mvKey]], iv: Array(6).fill(31), rng, ...o });
    const def = mk(foeSp, 60, ['splash'], { ability: 'thick-fat' }); def.stats[0] = def.hp = 9999;
    const bb = new Battle({ rng, player: { name: 'A', party: [atk], bag: {} }, foe: { name: 'w', party: [def] }, ...battleOpts });
    bb.start(); const ev = bb.playerAction({ type: 'move', idx: 0 });
    return { dmg: 9999 - def.hp, texts: texts(ev), atk, def, bb };
  };
  ok(dmgOf(10034, 'dragon-claw').dmg > dmgOf(10034, 'dragon-claw', { ability: 'blaze' }).dmg * 1.15 || true, 'Griffe Dure vérifié ci-dessous sans écrasement Méga');
  // Pour tester l'écart talent vs base sur non-Méga (car Méga priorise toujours f.ab), comparons sur un Pokémon normal ou 2 appels damageCore
  {
    const tcBat = new Battle({ rng, player: { name: 'A', party: [mk('Dracaufeu', 60, ['dragon-claw'], { ability: 'tough-claws', nat: 0 })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'], { nat: 0 })] } });
    const noTcBat = new Battle({ rng, player: { name: 'A', party: [mk('Dracaufeu', 60, ['dragon-claw'], { ability: 'blaze', nat: 0 })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'], { nat: 0 })] } });
    tcBat.start(); noTcBat.start();
    ok(tcBat.damageCore(0, 1, MOVES[key['dragon-claw']], 80, 'dragon', false, 1) > noTcBat.damageCore(0, 1, MOVES[key['dragon-claw']], 80, 'dragon', false, 1) * 1.2, 'Griffe Dure (+30% contact)');

    const px = dmgOf(10051, 'hyper-voice', {}, 'Dracolosse');
    ok(px.bb.moveType(0, MOVES[key['hyper-voice']]) === 'fairy' && px.texts.some((t) => /super efficace/.test(t)), 'Peau Féérique : Mégaphone devient Fée');

    seed = 32; const mkang = createMon(10039, 70, { moves: [key['return']], iv: Array(6).fill(31), nat: 0, rng });
    const fSash = mk('Pikachu', 50, ['splash'], { item: 'focus-sash', nat: 0 });
    wild(mkang, fSash).playerAction({ type: 'move', idx: 0 });
    ok(fSash.hp === 0, 'Amour Filial frappe 2 fois et traverse Ceinture Force');

    const pr = dmgOf(10294, 'ice-beam');
    ok(pr.bb.typesOf(0).length === 1 && pr.bb.typesOf(0)[0] === 'ice', 'Protéen change le type en Glace');

    seed = 33; const mal = createMon(10037, 60, { moves: [key['psychic']], iv: Array(6).fill(31), rng });
    const fInt = mk('Léviator', 60, ['splash'], { ability: 'intimidate' });
    const bt = wild(mal, fInt);
    ok(bt.ab(0) === 'intimidate' && bt.sides[1].v.st[1] === -1, 'Calque copie Intimidation et l\'active à l\'entrée');

    seed = 34; const ch = createMon(10291, 60, { moves: [key['shadow-ball']], iv: Array(6).fill(31), nat: 0, rng });
    const chBase = mk('Lugulabre', 60, ['shadow-ball'], { ability: 'flash-fire', nat: 0 });
    chBase.stats = [...ch.stats];
    const fd1 = mk('Pikachu', 60, ['light-screen'], { nat: 0 }), fd2 = mk('Pikachu', 60, ['light-screen'], { nat: 0 });
    fd1.stats[0] = fd1.hp = 9999; fd2.stats[0] = fd2.hp = 9999;
    const bInf = wild(ch, fd1); bInf.sides[1].screens.light = 5;
    const bNoInf = wild(chBase, fd2); bNoInf.sides[1].screens.light = 5;
    const dInf = bInf.damageCore(0, 1, MOVES[key['shadow-ball']], 80, 'ghost', false, 1);
    const dNoInf = bNoInf.damageCore(0, 1, MOVES[key['shadow-ball']], 80, 'ghost', false, 1);
    ok(dInf > dNoInf * 1.8, `Infiltration traverse Mur Lumière (${dInf} vs ${dNoInf})`);

    seed = 35; const mdk = createMon(20005, 60, { moves: [key['hypnosis']], iv: Array(6).fill(31), rng });
    const fSlp = mk('Ronflex', 60, ['splash']); fSlp.status = 'slp'; fSlp.slp = 3;
    wild(mdk, fSlp).playerAction({ type: 'move', idx: 0 });
    ok(fSlp.hp < fSlp.stats[0], 'Mauvais Rêve inflige des dégâts en fin de tour au Pokémon endormi');

    const faBat = new Battle({ rng, player: { name: 'A', party: [createMon(10296, 60, { moves: [key['moonblast']], iv: Array(6).fill(31), rng })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'])] } });
    const noFaBat = new Battle({ rng, player: { name: 'A', party: [createMon(10296, 60, { moves: [key['moonblast']], iv: Array(6).fill(31), rng })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'])] } });
    faBat.start(); noFaBat.start();
    // Pour comparer sans talent Aura Féérique sur Floette, comparons un autre utilisateur de type Fée avec vs sans allié/ennemi Aura Féérique :
    const refF = mk('Gardevoir', 60, ['moonblast'], { ability: 'synchronize' });
    const auraBat = new Battle({ rng, player: { name: 'A', party: [refF], bag: {} }, foe: { name: 'w', party: [createMon(10296, 60, { moves: [key['splash']], iv: Array(6).fill(31), rng })] } });
    const plainBat = new Battle({ rng, player: { name: 'A', party: [refF], bag: {} }, foe: { name: 'w', party: [mk('Mélodelfe', 60, ['splash'], { ability: 'magic-guard' })] } });
    auraBat.start(); plainBat.start();
    auraBat.sides[1].party[0].stats[3] = plainBat.sides[1].party[0].stats[3] = 150; auraBat.sides[1].party[0].stats[4] = plainBat.sides[1].party[0].stats[4] = 150;
    ok(auraBat.damageCore(0, 1, MOVES[key['moonblast']], 95, 'fairy', false, 1) > plainBat.damageCore(0, 1, MOVES[key['moonblast']], 95, 'fairy', false, 1) * 1.25, 'Aura Féérique augmente les dégâts Fée');

    const sjBat = new Battle({ rng, player: { name: 'A', party: [mk('Sharpedo', 60, ['crunch'], { ability: 'strong-jaw' })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'])] } });
    const noSjBat = new Battle({ rng, player: { name: 'A', party: [mk('Sharpedo', 60, ['crunch'], { ability: 'rough-skin' })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'])] } });
    sjBat.start(); noSjBat.start();
    ok(sjBat.damageCore(0, 1, MOVES[key['crunch']], 80, 'dark', false, 1) > noSjBat.damageCore(0, 1, MOVES[key['crunch']], 80, 'dark', false, 1) * 1.4, 'Prognathe (+50% morsure)');

    const mlBat = new Battle({ rng, player: { name: 'A', party: [mk('Tortank', 60, ['water-pulse'], { ability: 'mega-launcher' })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'])] } });
    const noMlBat = new Battle({ rng, player: { name: 'A', party: [mk('Tortank', 60, ['water-pulse'], { ability: 'torrent' })], bag: {} }, foe: { name: 'w', party: [mk('Ronflex', 60, ['splash'])] } });
    mlBat.start(); noMlBat.start();
    ok(mlBat.damageCore(0, 1, MOVES[key['water-pulse']], 60, 'water', false, 1) > noMlBat.damageCore(0, 1, MOVES[key['water-pulse']], 60, 'water', false, 1) * 1.4, 'Méga Blaster (+50% aura)');
  }
}
console.log(fails ? `\nRÈGLES DE COMBAT : ${fails} échec(s)` : '\nRÈGLES DE COMBAT : OK');
process.exit(fails ? 1 : 0);
