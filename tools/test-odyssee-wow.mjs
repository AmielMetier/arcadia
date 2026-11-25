// tools/test-odyssee-wow.mjs — Tests des 3 fonctionnalités : Phénomènes célestes (#1), Failles spatio-temporelles (#4) et Suiveur vivant / Souvenirs / Auras (#7)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.chdir(ROOT);

import { SPECIES } from '../odyssee/js/data/species.js';
import { MOVES } from '../odyssee/js/data/moves.js';
import { ITEMS, itemPluralName } from '../odyssee/js/core/items.js';
import { createMon, refreshStats } from '../odyssee/js/core/mon.js';
import { typeEff } from '../odyssee/js/core/battle-helpers.js';
import { Battle } from '../odyssee/js/core/battle.js';
import { foeChooseAll } from '../odyssee/js/core/battle-ai.js';
import { TROPHIES_CATALOG, checkAllTrophies } from '../odyssee/js/core/trophies.js';
import { encodeSave, decodeSave } from '../odyssee/js/core/savecode.js';
import { T } from '../odyssee/js/world/tiles.js';
import { CelestialSystem, CELESTIAL_SPECIES, JIRACHI_SP, CIEL } from '../odyssee/js/game/celestial.js';
import { SALLES, LOTS, LOTS_GARDIEN } from '../odyssee/js/game/faille.js';
import { PLANS, construireIle, verifierIle, echangerPonts, finCourant, pasVers } from '../odyssee/js/game/faille-iles.js';
import { RiftSystem, RIFT_KINDS, ALPHA_POOL, createAlphaMon, normalizeCapturedAlpha, formeAdaptee, FAILLES } from '../odyssee/js/game/rifts.js';
import {
  MEMORIES, ENTRANCE_AURAS, addMemory, unlockedAuras, activeEntranceAura, auraBurstSpec, recordBattleMemories,
} from '../odyssee/js/game/follower-life.js';

const moveByKey = Object.fromEntries(Object.values(MOVES).map((m) => [m.key, m.id]));
const spByName = (name) => +Object.keys(SPECIES).find((id) => SPECIES[id].n === name);
const mkRng = (init = 42) => {
  let s = init;
  return () => (s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
};

console.log('=== Tests Odyssée Wow (#1 Céleste, #4 Failles, #7 Suiveur/Souvenirs/Auras) ===');

// 1. Efficacité Inversée (#4)
{
  assert.equal(typeEff('normal', ['ghost'], false), 0);
  assert.equal(typeEff('normal', ['ghost'], true), 2, 'Normal vs Spectre doit être ×2 en Inversé');
  assert.equal(typeEff('electric', ['ground'], true), 2, 'Électrik vs Sol doit être ×2 en Inversé');
  assert.equal(typeEff('fire', ['grass'], true), 0.5, 'Feu vs Plante doit être ×0.5 en Inversé');
  assert.equal(typeEff('water', ['fire'], true), 0.5, 'Eau vs Feu doit être ×0.5 en Inversé');
  // Double type Sol vs Vol/Acier : Sol vs Vol (0 -> 2), Sol vs Acier (2 -> 0.5) => produit 1
  assert.equal(typeEff('ground', ['flying', 'steel'], true), 1);

  // IA choisit une capacité normalement inefficace (Plaquage Normal = ×0 sur Spectre -> ×2 en Inversé !) plutôt qu'une capacité neutre
  const me = createMon(94, 50, { moves: [moveByKey['shadow-ball']], iv: Array(6).fill(31), rng: mkRng(1) });
  const foe = createMon(143, 50, {
    moves: [moveByKey['body-slam'], moveByKey['hydro-pump']], // Normal (85×2×1.5=255) vs Eau (110×1=110)
    iv: Array(6).fill(31),
    rng: mkRng(2),
  });
  const bInv = new Battle({
    rng: mkRng(3),
    inverse: true,
    player: { name: 'A', party: [me], bag: {} },
    foe: { name: 'IA', party: [foe], trainer: { cls: 'Dresseur', name: 'IA', ai: 'strategic' } },
  });
  bInv.start();
  assert.equal(bInv.effOn({ side: 1, slot: 0 }, { side: 0, slot: 0 }, 'normal'), 2);
  const pick = foeChooseAll(bInv)[0].a;
  assert.equal(pick.type, 'move');
  assert.equal(pick.id, moveByKey['body-slam'], 'IA en Combat Inversé doit choisir Plaquage (×2 sur Spectre)');
  console.log('✓ Combat Inversé (typeEff + battle.effOn + IA) OK');
}

// 2. Météo Chaotique & Zéro dérive RNG en combat normal (#4)
{
  const runNormal = (seed) => {
    const a = createMon(1, 30, { moves: [moveByKey.tackle], iv: Array(6).fill(31), rng: mkRng(seed) });
    const b = createMon(4, 30, { moves: [moveByKey.tackle], iv: Array(6).fill(31), rng: mkRng(seed + 1) });
    const rng = mkRng(seed + 2);
    let calls = 0;
    const tracked = () => { calls++; return rng(); };
    const bat = new Battle({ rng: tracked, player: { name: 'A', party: [a], bag: {} }, foe: { name: 'S', party: [b] } });
    const sEv = bat.start();
    const tEv = bat.playerAction({ type: 'move', idx: 0 });
    return { calls, sEv, tEv, hpA: a.hp, hpB: b.hp };
  };
  const r1 = runNormal(77), r2 = runNormal(77);
  assert.equal(r1.calls, r2.calls);
  assert.equal(r1.hpA, r2.hpA);
  assert.equal(r1.hpB, r2.hpB);
  assert.deepEqual(r1.tEv, r2.tEv);

  const a = createMon(6, 50, { moves: [moveByKey.protect], iv: Array(6).fill(31), rng: mkRng(10) });
  const b = createMon(9, 50, { moves: [moveByKey.tackle], iv: Array(6).fill(31), rng: mkRng(11) });
  const batChaos = new Battle({
    rng: mkRng(12),
    chaosWeather: true,
    weather: 'rain',
    player: { name: 'A', party: [a], bag: {} },
    foe: { name: 'Faille', party: [b] },
  });
  const evStart = batChaos.start();
  assert(evStart.some((e) => e.t === 'msg' && e.text.includes('Météo chaotique')));
  const w0 = batChaos.weather;
  batChaos.playerAction({ type: 'move', idx: 0 });
  const w1 = batChaos.weather;
  assert.notEqual(w1, w0, 'Météo Chaotique doit changer de climat à la fin du tour');
  assert(['rain', 'sun', 'sandstorm', 'hail'].includes(w1));
  console.log('✓ Météo Chaotique + déterminisme RNG normal OK');
}

// 3. Pokémon Alpha géant + normalisation à la capture (#4)
{
  for (const e of ALPHA_POOL) {
    assert(SPECIES[e.sp], `Espèce Alpha ${e.sp} introuvable dans SPECIES`);
    assert(MOVES[e.sigMoveId], `Attaque signature ${e.sigMoveId} introuvable dans MOVES`);
  }
  const alpha = createAlphaMon(ALPHA_POOL[0], 40, 'Route 1 (Faille)');
  assert.equal(alpha.alpha, true);
  assert.equal(alpha.iv.filter((v) => v === 31).length >= 3, true, 'Un Alpha doit avoir au moins 3 IV à 31');
  assert.equal(alpha.moves.some((mv) => mv.id === ALPHA_POOL[0].sigMoveId), true, 'L\'Alpha doit connaître son attaque signature');
  const bossHp = alpha.stats[0];
  normalizeCapturedAlpha(alpha);
  assert.equal(alpha.alpha, true, 'Le statut Alpha doit persister après capture');
  assert(alpha.stats[0] < bossHp, 'Les PV boss +25% doivent être normalisés après capture');
  assert.equal(alpha._alphaBoosted, undefined);
  console.log(`✓ Pool Alpha (${ALPHA_POOL.length} espèces), PV boss & capture normalisée OK`);
}

// 4. Phénomènes célestes (#1) + isolation stricte getMapWeather
{
  for (const id of CELESTIAL_SPECIES) assert(SPECIES[id], `Espèce céleste ${id} introuvable`);
  assert(SPECIES[JIRACHI_SP], 'Jirachi introuvable');

  // Fausse carte minimaliste 20x20 marchable (tuile 1 = herbe/sol libre, Tile 0 = T.VOID ?)
  const fakeMap = {
    id: 'monde',
    outdoor: true,
    w: 24,
    h: 24,
    in: (x, y) => x >= 0 && y >= 0 && x < 24 && y < 24,
    get: () => T.PATH,
    height: () => 0,
    zoneAt: () => ({ name: 'Plaine Étoilée' }),
  };
  let skyView = 'none';
  const fakeGame = {
    mapObj: fakeMap,
    player: { x: 12, y: 12, dir: 'down' },
    state: { flags: {}, party: [], box: [], bag: {} },
    npcs: [],
    items: [],
    hour: () => 22,
    locationName: () => 'Plaine Étoilée',
    view: {
      actors: new Map(),
      setCelestial: (k) => { skyView = k; },
      removeActor: () => {},
    },
    hud: { update: () => {} },
  };
  const cel = new CelestialSystem(fakeGame);
  fakeGame.celestial = cel;
  cel.invoke('aurora', 5);
  assert.equal(cel.activeKind, 'aurora');
  assert.equal(skyView, 'aurora');

  cel.invoke('meteor', 5);
  assert.equal(cel.activeKind, 'meteor');
  assert.equal(skyView, 'meteor');
  assert(cel.meteors.length >= 2 && cel.meteors.length <= 3, 'L\'invocation pluie d\'étoiles fait tomber des météorites accessibles');
  for (const m of cel.meteors) {
    const d = Math.abs(m.x - 12) + Math.abs(m.y - 12);
    assert(d >= 4 && d <= 11);
  }
  cel.invoke(null);
  assert.equal(cel.activeKind, 'none');
  assert.equal(skyView, 'none');

  const rifts = new RiftSystem(fakeGame);
  const rf = rifts.spawnNearPlayer('inverse', true);
  assert(rf && rf.kind === 'inverse' && RIFT_KINDS[rf.kind]);
  assert(rifts.compassFromPlayer().includes('pas'));
  console.log('✓ Phénomènes célestes, météorites & failles spatio-temporelles OK');
}

// 4 bis. Audit du 24 novembre 2026 : accès à pied, recharge, faille dissipée, Jirachi, formes selon le niveau, inversé
{
  // un mur coupe la carte en deux : rien ne doit tomber de l'autre côté
  const mur = { id: 'monde', outdoor: true, in: (x, y) => x >= 0 && y >= 0 && x < 30 && y < 30, get: (x) => (x === 15 ? T.TREE : T.PATH), height: () => 0, zoneAt: () => ({ name: 'Mur' }) };
  const dits = [];
  const g = {
    mapObj: mur, player: { x: 12, y: 12, dir: 'down' }, npcs: [{ x: 8, y: 12 }], items: [], hour: () => 12,
    state: { flags: { dex: 1 }, party: [createMon(25, 12)], box: [], bag: {}, money: 0, name: 'Test' }, locationName: () => 'Mur', levelCap: () => 100, badgeCount: () => 8,
    view: { actors: new Map(), setCelestial: () => {}, removeActor: () => {} }, hud: { update: () => {} }, sound: { sfx: () => {} }, save: () => {}, give: (k, n = 1) => { g.state.bag[k] = (g.state.bag[k] || 0) + n; }, take: (k, n = 1) => { g.state.bag[k] -= n; }, checkTrophies: () => {},
    ui: { say: async (t) => { dits.push(...[].concat(t)); }, yesNo: async () => true, list: async () => 0, toast: () => {} },
  };
  g.celestial = new CelestialSystem(g); g.rifts = new RiftSystem(g);
  for (let i = 0; i < 60; i++) {
    const r = g.rifts.spawnNearPlayer(null, true);
    assert(r.x < 15, 'une faille ne s\'ouvre jamais derrière un mur');
    assert(!(r.x === 8 && r.y === 12), 'ni sur un habitant');
  }
  // les failles s'ouvrent au hasard : après une attente, n'importe quel genre, et se referment d'elles-mêmes
  const vusG = new Set(), attentes = [];
  for (let n = 0; n < 40; n++) {
    g.state.flags = { dex: 1 }; g.rifts = new RiftSystem(g); let t = 0;
    while (!g.rifts.active && t < 4000) { g.rifts.tick(1); t++; }
    assert(t >= FAILLES.premiere[0] - 2 && t <= FAILLES.premiere[1] + 4, `première faille après ${t} s`); attentes.push(t); vusG.add(g.rifts.active.kind);
    assert.equal(g.rifts.active.manual, false);
  }
  assert.equal(vusG.size, 3, 'les trois genres sortent'); assert(new Set(attentes).size > 10, 'jamais au même moment');
  // elle reste si l'on quitte le jeu, se referme quand on s'éloigne trop longtemps, et une autre viendra plus tard
  { const k = g.rifts.active.kind; g.rifts = new RiftSystem(g); g.rifts.tick(0.1); assert.equal(g.rifts.active?.kind, k, 'la même après un rechargement'); }
  g.state.flags.faille.reste = 1; g.rifts.active.x = 12; g.rifts.active.y = 13; g.rifts.tick(2); assert(g.rifts.active, 'jamais sous le nez du joueur');
  g.rifts.active.x = 1; g.rifts.active.y = 1; g.rifts.tick(1); assert.equal(g.rifts.active, null); assert(g.state.flags.faille.dans >= FAILLES.attente[0] && !g.state.flags.faille.kind);
  // pas de faille avant le Pokédex, ni pendant une scène
  g.state.flags = {}; g.rifts = new RiftSystem(g); for (let n = 0; n < 900; n++) g.rifts.tick(1); assert.equal(g.rifts.active, null, 'pas de faille avant le Pokédex');
  g.state.flags = { dex: 1 }; g.busy = true; for (let n = 0; n < 900; n++) g.rifts.tick(1); assert.equal(g.rifts.active, null, 'pas pendant une scène'); g.busy = false;
  // le ciel : la nuit seulement, au hasard
  g.hour = () => 12; g.state.flags = { dex: 1 }; for (let n = 0; n < 3000; n++) g.celestial.tick(1); assert.equal(g.celestial.activeKind, 'none', 'rien en plein jour');
  g.hour = () => 23; const cieux = new Set();
  for (let n = 0; n < 30; n++) { g.state.flags = { dex: 1 }; g.celestial = new CelestialSystem(g); let t = 0; while (g.celestial.activeKind === 'none' && t < 2000) { g.celestial.tick(1); t++; } assert(t <= CIEL.premier[1] + 4); cieux.add(g.celestial.activeKind); let d = 0; while (g.celestial.activeKind !== 'none' && d < 2000) { g.celestial.tick(1); d++; } assert(d >= CIEL.duree[0] - 3 && d <= CIEL.duree[1] + 4, `durée ${d}`); }
  assert.deepEqual([...cieux].sort(), ['aurora', 'meteor']);
  g.hour = () => 12; g.celestial = new CelestialSystem(g); g.rifts = new RiftSystem(g); g.state.flags = { dex: 1 };
  // les îles : tout est atteignable, aucun cul-de-sac, ponts et courants compris
  for (const kind in PLANS) for (const plan of PLANS[kind]) for (const miroir of [false, true]) assert.deepEqual(verifierIle(construireIle('t', kind, plan, { miroir })), [], `île ${kind}`);
  { const m = construireIle('t', 'inverse', PLANS.inverse[0]), [a] = m.faille.ponts.a, [b] = m.faille.ponts.b; assert(m.get(...a) === T.CAVE && m.get(...b) !== T.CAVE); echangerPonts(m); assert(m.get(...a) !== T.CAVE && m.get(...b) === T.CAVE); }
  { const m = construireIle('t', 'chaos', PLANS.chaos[0]); for (const id of m.faille.courants.keys()) { const [x, y] = finCourant(m, ...id.split(',').map(Number)); assert(!m.faille.courants.has(x + ',' + y), 'un courant dépose toujours sur la roche'); } }
  for (const [k] of [...LOTS, ...LOTS_GARDIEN]) assert(ITEMS[k] && !ITEMS[k].key && k !== 'master-ball', `butin ${k}`);
  // l'expédition : trois îles, un Pokémon à vaincre sur chacune, des portails, un gardien ; le butin seulement à la sortie
  g.world = { maps: { monde: mur } }; g.setMap = (id) => { g.mapObj = g.world.maps[id]; }; g.updateZone = () => {}; g.ui.fade = async () => {}; g.input = { free: true };
  const aventure = async (kind, manuelle, resultats, portes, oui = true) => {
    g.state.bag = {}; g.state.money = 0; g.state.flags = { dex: 1 }; g.rifts = new RiftSystem(g); g.mapObj = mur; g.player.x = 12; g.player.y = 12;
    const r = g.rifts.spawnNearPlayer(kind, manuelle); r.x = 13; r.y = 12; g.player.dir = 'right'; dits.length = 0; g.ui.yesNo = async () => true;
    const vus = []; let n = 0;
    g.runBattle = async (o) => { vus.push(o); assert.equal(g.busy, true, 'le joueur ne reprend pas la main avant le combat'); assert(o.sansFuite && o.sansSoins); const res = resultats[n++]; if (res === 'lose') { o.surDefaite?.(); g.setMap('monde'); } return res; };
    assert.equal(await g.rifts.interagir(), true); assert.equal(g.busy, false);
    const X = g.rifts.exp; assert(X && g.mapObj.faille, 'on est sur une île'); assert(X.retour.x === 12 && X.retour.y === 12);
    for (const p of portes) {
      if (!g.mapObj.faille) break;
      const F = g.mapObj.faille, va = async ([x, y]) => { [g.player.x, g.player.y] = [x, y]; await X.surCase(); };
      if (p === 'quitte') { await va(F.sortie); break; }
      X.trouve = 0; await va([F.ennemi[0], F.ennemi[1] + 1]);          // à côté du Pokémon : il attaque
      if (!g.mapObj.faille || !X.gagnee) break;
      assert.equal(X.mon, null); assert.equal(g.busy, false);
      if (p === 'eclat') { await va([X.eclats[0].x, X.eclats[0].y]); await va(F.sortie); }
      else await va(p === 'sortie' ? F.sortie : F.portes[Math.min(p, F.portes.length - 1)]);
    }
    assert.equal(g.busy, false);
    return { vus, argent: g.state.money, objets: g.state.bag, nb: Object.keys(g.state.bag).length, ouverte: !!g.rifts.active, f: g.state.flags, ile: !!g.mapObj.faille, reste: Object.keys(g.world.maps).filter((k) => k.startsWith('faille')).length, X };
  };
  let E = await aventure('inverse', true, ['win', 'caught', 'win'], [0, 1, 0]);
  assert.equal(E.vus.length, SALLES); assert.equal(E.vus[0].inverse, true); assert.equal(E.vus[2].alpha, true, 'le gardien est un Alpha'); assert(E.vus[2].wild.lvl >= E.vus[0].wild.lvl);
  assert.equal(E.argent, 9000); assert(E.nb >= 2); assert.equal(E.f.gardiensFaille, 1); assert.equal(E.f.riftsCleared, 1); assert.equal(E.ouverte, false); assert.equal(E.ile, false); assert.equal(E.reste, 0, 'les îles sont rangées'); assert.equal(g.rifts.exp, null); assert(E.f.faille.dans > 0, 'la suivante est programmée');
  E = await aventure('chaos', false, ['win', 'win'], [0, 'sortie']); assert.equal(E.vus.length, 2); assert.equal(E.vus[0].chaosWeather, true); assert.equal(E.argent, 4000); assert(E.objets['fragment-meteore'] >= 1, 'une faille naturelle donne un fragment'); assert(!E.f.gardiensFaille); assert.equal(E.ouverte, false);
  E = await aventure('inverse', true, ['win'], ['eclat']); assert(E.argent > 1500 || E.nb >= 2, 'un éclat ramassé rejoint le butin');
  E = await aventure('alpha', true, [], ['quitte']); assert.equal(E.ile, false); assert.equal(E.ouverte, true, 'repartir sans combattre : elle reste ouverte'); assert.equal(E.argent, 0);
  E = await aventure('inverse', true, ['flee'], [0]); assert.equal(E.ile, true, 'fuir sur la première île : on y reste'); assert.equal(E.X.gagnee, false); await E.X.ranger(); g.setMap('monde');
  for (const fin of ['lose', 'flee']) { E = await aventure('inverse', true, ['win', fin], [1, 0]); assert.equal(E.argent, 0, 'butin perdu'); assert.equal(E.nb, 0); assert.equal(E.ouverte, false); assert.equal(E.ile, false); assert.equal(E.f['riftKind:inverse'], 1); assert.equal(E.reste, 0); }
  E = await aventure('inverse', true, ['lose'], [0]); assert.equal(E.ouverte, true, 'vaincu sur la première île : elle reste ouverte'); assert.equal(g.rifts.exp, null);
  // scellé tant que l'île 2 est gardée ; l'Alpha prend en chasse
  { const X0 = await aventure('inverse', true, ['win'], [0]); assert.equal(X0.ile, true); assert.equal(X0.X.salle, 2); [g.player.x, g.player.y] = g.mapObj.faille.sortie; dits.length = 0; await X0.X.surCase(); assert(dits.some((t) => /scellé/.test(t))); assert(g.mapObj.faille); X0.X.ranger(); g.setMap('monde'); }
  { const X0 = await aventure('alpha', true, [], []); const M = X0.X.mon, F = g.mapObj.faille; assert(X0.ile); [g.player.x, g.player.y] = [F.ennemi[0], F.ennemi[1] + 5]; const d0 = Math.abs(M.y - g.player.y); for (let i = 0; i < 30; i++) X0.X.tick(0.1); assert(Math.abs(M.x - g.player.x) + Math.abs(M.y - g.player.y) < d0, 'l\'Alpha approche'); assert(pasVers(g.mapObj, [...F.ennemi], [...F.depart]), 'un chemin mène au joueur'); X0.X.ranger(); g.setMap('monde'); }
  g.rifts = new RiftSystem(g); g.player.x = 12; g.player.y = 12;
  // Jirachi mis K.O. n'est pas perdu
  const alea = Math.random;
  for (const [res, pris] of [['win', false], ['caught', true]]) {
    g.state.flags = { dex: 1 }; g.celestial.meteors = [{ id: 1, x: 12, y: 13 }]; g.player.dir = 'down';
    let n = 0; Math.random = () => (n++ === 0 ? 0.9 : 0.01);   // rencontre, puis Jirachi
    let vu = null; g.runBattle = async (o) => { Math.random = alea; vu = o.wild.sp; assert.equal(g.busy, true); return res; };
    await g.celestial.interagir(); Math.random = alea;
    assert.equal(vu, JIRACHI_SP); assert.equal(!!g.state.flags.meteorJirachi, pris, `Jirachi après ${res}`);
  }
  // formes selon le niveau
  assert.equal(formeAdaptee(149, 10), 147); assert.equal(formeAdaptee(149, 40), 148); assert.equal(formeAdaptee(149, 60), 149);
  assert.equal(formeAdaptee(59, 12), 58); assert.equal(formeAdaptee(59, 40), 59);
  for (const e of ALPHA_POOL) for (const l of [10, 25, 45, 80]) assert(SPECIES[createAlphaMon(e, l).sp], 'forme Alpha valide');
  // inversé : les talents protègent toujours, Cage-Éclair touche le type Sol
  const R = (o, inverse) => new Battle({ rng: mkRng(5), inverse, player: { name: 'A', party: [createMon(25, 50, { moves: o.moves, rng: mkRng(1) })], bag: {} }, foe: { name: 'S', party: [createMon(o.sp, 50, { rng: mkRng(2), ability: o.ab || null, moves: [moveByKey.splash || moveByKey.tackle] })] } });
  for (const [ab, mv] of [['levitate', 'earthquake'], ['water-absorb', 'water-gun'], ['volt-absorb', 'thunderbolt'], ['flash-fire', 'flamethrower'], ['sap-sipper', 'energy-ball']]) {
    const b = R({ sp: 143, ab, moves: [moveByKey[mv]] }, true); b.start();
    assert.equal(b.estimate({ side: 0, slot: 0 }, { side: 1, slot: 0 }, MOVES[moveByKey[mv]]), 0, `${ab} protège en inversé (estimation)`);
    const pv = b.foe.hp; b.playerAction({ type: 'move', idx: 0 }); assert(b.foe.hp >= pv, `${ab} protège en inversé`);
  }
  for (const inv of [false, true]) {
    let par = 0;
    for (let s = 1; s < 12; s++) { const b = R({ sp: 27, moves: [moveByKey['thunder-wave']] }, inv); b.rng = mkRng(s); b.start(); b.playerAction({ type: 'move', idx: 0 }); if (b.foe.status === 'par') par++; }
    assert.equal(par > 0, inv, 'Cage-Éclair sur le type Sol : seulement en inversé');
  }
  // dans une faille, on ne fuit pas
  for (const mv of ['teleport', 'roar', 'whirlwind']) { const b = new Battle({ rng: mkRng(5), sansFuite: true, player: { name: 'A', party: [createMon(25, 60, { moves: [moveByKey[mv]], rng: mkRng(1) })], bag: {} }, foe: { name: 'S', party: [createMon(143, 20, { rng: mkRng(2), moves: [moveByKey.splash, moveByKey.teleport, moveByKey.roar] })] } }); b.start(); for (let n = 0; n < 4; n++) b.playerAction({ type: 'move', idx: 0 }); assert.notEqual(b.state, 'over', `${mv} ne termine pas le combat`); const t = b.turn, ev = b.playerAction({ type: 'run' }); assert(ev.some((e) => /impossible de fuir/.test(e.text || ''))); assert.equal(b.turn, t, 'essayer de fuir ne coûte pas le tour'); }
  // ni objets de soin : le tour n'est pas perdu, les Balls restent permises
  { const b = new Battle({ rng: mkRng(5), sansSoins: true, player: { name: 'A', party: [createMon(25, 60, { rng: mkRng(1) })], bag: { potion: 2, 'max-revive': 1, ether: 1, 'ultra-ball': 3 } }, foe: { name: 'S', party: [createMon(143, 20, { rng: mkRng(2), moves: [moveByKey.splash] })] } }); b.start(); b.me.hp = 10;
    for (const it of ['potion', 'max-revive', 'ether']) { const t = b.turn, ev = b.playerAction({ type: 'item', item: it, target: 0 }); assert(ev.some((e) => /aucun effet dans une faille/.test(e.text || ''))); assert.equal(b.turn, t); } assert.equal(b.me.hp, 10); assert.equal(b.sides[0].bag?.potion ?? 2, 2);
    const t = b.turn; b.playerAction({ type: 'item', item: 'ultra-ball' }); assert.equal(b.turn, t + 1, 'une Ball se lance'); }
  // parties d'avant : aucun champ nouveau, rien ne casse
  const vieux = createMon(25, 20); delete vieux.memories; delete vieux.entranceAura;
  assert.equal(auraBurstSpec(vieux), null); assert.deepEqual(unlockedAuras(vieux), []);
  for (const t of TROPHIES_CATALOG) t.check({ party: [vieux], box: [null], bag: {}, badges: [], dex: { seen: [], caught: [] } });
  console.log('✓ Accès à pied, recharge, fuite/défaite/victoire, Jirachi, formes, inversé & anciennes parties OK');
}

// 5. Souvenirs, Auras, survie héroïque (≤5% PV) & persistance savecode (#7)
{
  const pikachu = createMon(spByName('Pikachu') || 25, 25, { ot: 'Sacha', met: 'Bourg-Aube' });
  const r1 = addMemory(pikachu, 'first_walk', 'Route 1');
  assert.equal(r1.added, true);
  const r1dup = addMemory(pikachu, 'first_walk', 'Route 2');
  assert.equal(r1dup.added, false, 'Un souvenir identique ne doit pas être dupliqué');

  addMemory(pikachu, 'celestial', 'Route 1');
  assert(unlockedAuras(pikachu).some((a) => a.id === 'stars'), 'Témoin des Étoiles débloque Éclat Stellaire');
  assert.equal(activeEntranceAura(pikachu)?.id, 'stars');

  pikachu.entranceAura = 'none';
  assert.equal(activeEntranceAura(pikachu), null, 'Le choix Aucune doit couper l\'aura');
  assert.equal(auraBurstSpec(pikachu), null);

  pikachu.entranceAura = 'stars';
  assert.equal(auraBurstSpec(pikachu)?.id, 'stars');

  // Test survie héroïque à ≤5% PV en combat
  const ally = createMon(448, 40, { iv: Array(6).fill(31), rng: mkRng(20) });
  ally.hp = 10;
  ally.stats[0] = 200;
  const foe = createMon(130, 40, { iv: Array(6).fill(31), rng: mkRng(21) });
  const bat = new Battle({ rng: mkRng(22), player: { name: 'Red', party: [ally], bag: {} }, foe: { name: 'Foe', party: [foe] } });
  bat.hp({ side: 0, slot: 0 }, -5); // passe de 10 à 5 PV (2.5% ≤ 5%)
  assert(bat.clutchUids.has(ally.uid), 'Une survie à ≤5% PV doit être tracée dans clutchUids');
  const rec = recordBattleMemories({
    state: { party: [ally], flags: {}, bag: {} },
    locationName: () => 'Tour Céleste',
    checkTrophies: () => {},
  }, bat, 'win', { rift: true, alpha: true });
  assert.equal(rec.length >= 3, true, 'Doit enregistrer clutch_1hp, rift et alpha');
  assert(unlockedAuras(ally).some((a) => a.id === 'crimson'), 'Cœur de Colosse débloque Flamme Alpha');

  // Persistance savecode roundtrip
  pikachu.alpha = true;
  const st = {
    v: 2,
    name: 'Red',
    gender: 'm',
    id: 1,
    money: 5000,
    badges: Array(15).fill(false),
    flags: { celestialMeteors: 2, riftsCleared: 1 },
    party: [pikachu],
    box: [],
    bag: { 'fragment-meteore': 3 },
    dex: { seen: [25], caught: [25], seenCount: { 25: 1 } },
    map: 'monde',
    x: 10,
    y: 10,
  };
  const code = await encodeSave(st);
  const { state: back, error: decErr } = await decodeSave(code);
  assert.equal(decErr, undefined, `decodeSave erreur inattendue: ${decErr}`);
  assert.equal(back.party[0].alpha, true);
  assert.equal(back.party[0].entranceAura, 'stars');
  assert.equal(back.party[0].memories.length, 2);
  assert.equal(back.bag['fragment-meteore'], 3);
  console.log('✓ Souvenirs, Auras, survie ≤5% PV et roundtrip savecode OK');
}

// 6. Objets (Fragment Météorique vs Éclat d'Étoile), icônes PNG, pluriels & 12 trophées thématiques
{
  assert.equal(ITEMS.astrolabe, undefined, 'plus d\'Astrolabe : les phénomènes arrivent au hasard');
  assert.equal(ITEMS['fragment-meteore']?.name, 'Fragment Météorique');
  assert.equal(ITEMS['fragment-meteore']?.pocket, 'objets');
  assert.equal(ITEMS['fragment-meteore']?.price, 4500);
  assert.equal(itemPluralName('fragment-meteore', 3), '3 Fragments Météoriques');
  for (const k of ['fragment-meteore']) {
    const ic = ITEMS[k].icon || k;
    const p1 = path.join(ROOT, 'odyssee/img/items', `${ic}.png`);
    const p2 = path.join(ROOT, 'odyssee/img/pokeapi/items', `${ic}.png`);
    assert(fs.existsSync(p1) || fs.existsSync(p2), `Icône manquante pour ${k} (${ic}.png)`);
  }

  const WOW_TROPHY_IDS = [
    'celestial_meteor', 'celestial_aurora', 'celestial_meteor_5', 'celestial_cosmic_catch',
    'rift_clear', 'rift_inverse_win', 'rift_chaos_win', 'rift_alpha_catch', 'rift_trinity',
    'follower_memories', 'follower_clutch', 'follower_legend_bond',
  ];
  for (const tid of WOW_TROPHY_IDS) {
    const t = TROPHIES_CATALOG.find((q) => q.id === tid);
    assert(t, `Trophée ${tid} absent du catalogue`);
    assert.notEqual(t.reward?.item, 'master-ball', `${tid} ne doit pas donner de Master Ball`);
  }

  const stT = {
    name: 'A',
    badges: Array(15).fill(false),
    flags: {
      celestialMeteors: 5,
      celestialAuroraSeen: true,
      celestialCosmicCaught: 1,
      riftsCleared: 3,
      'riftKind:inverse': 1,
      'riftKind:chaos': 1,
      'riftKind:alpha': 1,
      alphaCaught: 1,
    },
    party: [{
      sp: 25,
      alpha: true,
      memories: [
        { id: 'first_walk' }, { id: 'weather_bond' }, { id: 'celestial' },
        { id: 'rift' }, { id: 'clutch_1hp' }, { id: 'alpha' },
      ],
    }],
    box: [],
    dex: { seen: [], caught: [] },
    bag: {},
  };
  const unlocked = checkAllTrophies(stT).map((t) => t.id);
  for (const tid of WOW_TROPHY_IDS) {
    assert(unlocked.includes(tid), `Trophée ${tid} devrait se débloquer`);
  }
  console.log(`✓ Objets, icônes PNG, pluriels & ${WOW_TROPHY_IDS.length} trophées thématiques OK`);
}

// 7. Quêtes narratives (lore céleste, failles, Alpha & souvenirs) + journal multi-étapes
{
  const { buildWorld } = await import('../odyssee/js/world/region.js');
  const { MISSIONS } = await import('../odyssee/js/world/habitants.js');
  const { getAllQuests, syncJournal } = await import('../odyssee/js/core/questsData.js');

  const W = buildWorld();
  assert.equal(ITEMS['eclat-etoile']?.key, true, 'La quête de Jirachi garde eclat-etoile en objet rare');
  assert.equal(ITEMS['fragment-meteore']?.pocket, 'objets', 'Fragment Météorique reste un objet vendable');

  const WOW_QUESTS = ['mAstronome', 'mFailles', 'mAlpha', 'mMemoire'];
  const HINT = /📍|destination|rends-toi|va voir|il faut aller/i;
  for (const qid of WOW_QUESTS) {
    const q = MISSIONS.find((m) => m.id === qid);
    assert(q, `Quête ${qid} absente de MISSIONS`);
    const npc = W.maps.monde.npcs.find((n) => n.mission?.id === qid);
    assert(npc, `PNJ de la quête ${qid} introuvable sur la carte monde`);
  }

  // Test progression multi-étapes dans le journal
  const mockG = {
    state: {
      name: 'Sacha',
      badges: Array(15).fill(false),
      time: 1200,
      flags: { 'A:mFailles': true, 'riftKind:inverse': true, 'riftKind:chaos': true, 'A:mAstronome': true, 'A:mAlpha': true, 'A:mMemoire': true },
      bag: { 'fragment-meteore': 2 },
      party: [],
      box: [],
      dex: { seen: [], caught: [] },
    },
    world: W,
  };
  syncJournal(mockG);
  const qs = getAllQuests(mockG);
  const qFailles = qs.find((q) => q.id === 'mFailles');
  const qAstro = qs.find((q) => q.id === 'mAstronome');
  assert.equal(qFailles.status, 'active');
  assert.equal(qFailles.notes.length, 3, 'mFailles doit afficher 3 entrées après 2 failles sur 3');
  assert.equal(qAstro.notes.length, 2, 'mAstronome doit afficher le compteur 2/3 dans le journal');
  for (const q of qs) for (const n of q.notes) assert.equal(HINT.test(n), false, `Indice interdit dans ${q.id}: ${n}`);

  // Conditions de validation des quêtes
  const mFailles = MISSIONS.find((m) => m.id === 'mFailles');
  const mAlpha = MISSIONS.find((m) => m.id === 'mAlpha');
  const mMem = MISSIONS.find((m) => m.id === 'mMemoire');
  assert.equal(mFailles.test(mockG.state), false);
  mockG.state.flags['riftKind:alpha'] = true;
  assert.equal(mFailles.test(mockG.state), true);
  assert.equal(mAlpha.test({ alpha: true }), true);
  assert.equal(mAlpha.test({ alpha: false }), false);
  assert.equal(mMem.test({ memories: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }] }), true);
  assert.equal(mMem.test({ memories: [{ id: 'a' }] }), false);
  console.log('✓ 4 quêtes lore (PNJ placés, journal multi-étapes sans indice, validations) OK');
}

// 8. Musiques stylées (#1/#4), ambiances et SFX WebAudio (moderne & rétro)
{
  class MockNode {
    constructor() {
      this.gain = { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} };
      this.frequency = { value: 440, setValueAtTime() {}, exponentialRampToValueAtTime() {} };
      return new Proxy(this, {
        get(t, k) {
          if (k in t || typeof k === 'symbol' || k === 'then') return t[k];
          return (t[k] = { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
        },
      });
    }
    connect() {}
    disconnect() {}
    start() {}
    stop() {}
    setPeriodicWave() {}
  }
  class MockAC {
    constructor() { this.currentTime = 0; this.sampleRate = 44100; this.destination = new MockNode(); }
    createGain() { return new MockNode(); }
    createOscillator() { return new MockNode(); }
    createBufferSource() { return new MockNode(); }
    createBiquadFilter() { return new MockNode(); }
    createWaveShaper() { return { curve: null, oversample: '2x', connect() {} }; }
    createBuffer(ch, len) { return { getChannelData() { return new Float32Array(len); } }; }
    createPeriodicWave() { return {}; }
  }
  const prevWin = globalThis.window;
  globalThis.window = { AudioContext: MockAC };
  try {
    const { Sound, THEMES, CUSTOM_COMPOSERS, WOW_SFX_KEYS } = await import('../odyssee/js/audio.js');
    const wowThemes = ['aurora', 'meteor', 'riftBattle', 'alphaBoss', 'ileInverse', 'ileChaos', 'ileAlpha', 'ileTrone', 'gardienFaille'];
    for (const name of wowThemes) {
      assert(THEMES[name], `Thème musical ${name} manquant dans THEMES`);
      assert.equal(typeof CUSTOM_COMPOSERS[name], 'function', `CUSTOM_COMPOSERS[${name}] manquant`);
      const song = CUSTOM_COMPOSERS[name]();
      assert(song.steps > 0 && song.loopStart != null && song.loopStart < song.steps, `${name}: structure steps/loopStart invalide`);
      assert(song.tracks.length >= 6, `${name}: au moins 6 pistes attendues`);
      for (const tr of song.tracks) {
        for (const nt of tr.notes) {
          const double = nt.m != null && tr.notes.some((q) => q !== nt && q.s === nt.s && q.m === nt.m && q.k === nt.k && q.d === nt.d);
          assert(!double, `${name}: deux notes identiques empilées au pas ${nt.s} (saturation)`);
        }
        if (tr.type === 'drum') continue;
        for (const nt of tr.notes) {
          assert(nt.s >= 0 && nt.s < song.steps, `${name}: step hors bornes ${nt.s}`);
          assert(nt.d > 0, `${name}: durée <= 0`);
          assert(nt.m >= 20 && nt.m <= 110, `${name}: MIDI hors registre [20, 110]: ${nt.m}`);
        }
      }
      if (['riftBattle', 'alphaBoss', 'gardienFaille'].includes(name)) {
        assert(song.tracks.some((tr) => tr.dist && tr.type === 'sawtooth'), `${name}: guitare dist attendue`);
        assert(song.bpm >= 165 && song.bpm <= 190, `${name}: BPM combat attendu`);
      }
    }

    const s = new Sound();
    s.init();
    for (const style of ['moderne', 'retro']) {
      s.setStyle(style);
      for (const name of wowThemes) { s.play(name); s.stopMusic(0); }
      for (const k of WOW_SFX_KEYS) s.sfx(k);
    }
    assert.equal(WOW_SFX_KEYS.length, 26);
    console.log(`✓ ${wowThemes.length} musiques stylées & ${WOW_SFX_KEYS.length} SFX/ambiances validés (moderne + rétro)`);
  } finally {
    globalThis.window = prevWin;
  }
}

console.log('\n🎉 TOUS LES TESTS WOW (#1, #4, #7, LORE, MÉDAILLES & AUDIO) SONT PASSÉS !');
