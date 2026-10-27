// Tests du moteur de Birdie Party : node tools/test-golf.mjs
// Distances des clubs, surfaces des 30 trous (îles, lacs, passages à porter, désert), coups reproductibles, eau et
// hors-limites, putts, règles d'une partie (ordre de jeu, pénalités, classement, équipes), bots des trois niveaux,
// et des parties entières jouées par la session (chacun pour soi, puis en équipes).
import assert from 'node:assert/strict';
import { CLUBS, TRAJ, PUTTER, putterRange, lieFactor } from '../golf/engine/clubs.js';
import { simulate, previewLanding, CUP_R } from '../golf/engine/physics.js';
import { HOLES, buildHole, windFor, COURSES } from '../golf/engine/course.js';
import { newRound, startHole, applyShot, holeOver, finishHole, ranking, totals, stableford, MAX_STROKES, nextPlayer } from '../golf/engine/rules.js';
import { botShot } from '../golf/engine/bot.js';
import { suggestClub, layupPoint } from '../golf/engine/advice.js';
import { startHost, startClient, holeByNumber } from '../golf/net/session.js';

let n = 0;
const t = (name, fn) => { fn(); n++; console.log('✓', name); };
// terrain plat factice, tout en fairway
const flat = (surf = 'fairway') => ({ pin: { x: 1e4, z: 1e4 }, heightAt: () => 0, surfaceAt: () => surf, slopeAt: () => [0, 0], treesNear: () => [] });
const ball0 = { x: 0, y: 0.021, z: 0, lie: 'fairway' };
const shot = (club, o = {}) => ({ club, traj: 'mid', aim: 0, power: 1, curve: 0, seed: 7, ...o });

t('chaque club va à sa distance sur un fairway plat, sans vent', () => {
  for (let c = 0; c < PUTTER; c++) {
    const r = simulate(flat(), ball0, shot(c), null);
    assert.ok(Math.abs(r.dist - CLUBS[c].dist) / CLUBS[c].dist < 0.05, `${CLUBS[c].name} : ${r.dist.toFixed(0)} m pour ${CLUBS[c].dist}`);
    assert.ok(r.carry.z > CLUBS[c].dist * 0.8 && r.carry.z < r.dist, 'la balle vole puis roule');
  }
});

t('la cible de visée correspond au point de chute d\'un coup plein', () => {
  for (let c = 0; c < PUTTER; c++) for (const tr of Object.keys(TRAJ)) {
    const p = previewLanding(flat(), ball0, c, tr, 0, 20), r = simulate(flat(), ball0, shot(c, { traj: tr }), null);
    assert.ok(Math.abs(p.z - r.carry.z) < 0.5, `${CLUBS[c].name} ${tr}`);
  }
});

t('le vent de face raccourcit, le vent de dos allonge, le vent de côté dévie', () => {
  const base = simulate(flat(), ball0, shot(0), null).dist;
  assert.ok(simulate(flat(), ball0, shot(0), { x: 0, z: -5 }).dist < base - 8);
  assert.ok(simulate(flat(), ball0, shot(0), { x: 0, z: 5 }).dist > base + 5);
  assert.ok(simulate(flat(), ball0, shot(0), { x: 5, z: 0 }).end.x > 5);
});

t('slice à droite, hook à gauche, trajectoire haute plus haute', () => {
  // la droite du joueur qui regarde vers +z est du côté des x négatifs
  assert.ok(simulate(flat(), ball0, shot(3, { curve: 0.8 }), null).end.x < -8);
  assert.ok(simulate(flat(), ball0, shot(3, { curve: -0.8 }), null).end.x > 8);
  assert.ok(simulate(flat(), ball0, shot(3, { traj: 'high' }), null).maxH > simulate(flat(), ball0, shot(3, { traj: 'low' }), null).maxH + 5);
});

t('rough et bunker font perdre de la distance, sauf le sand wedge dans le sable', () => {
  const fw = simulate(flat(), ball0, shot(3), null).dist;
  assert.ok(simulate(flat('rough'), { ...ball0, lie: 'rough' }, shot(3), null).dist < fw * 0.8);
  assert.equal(lieFactor('bunker', 3), 0.5);
  assert.ok(lieFactor('bunker', 6) > 0.8);
});

const hole = buildHole(HOLES[0]);
t('le trou 1 : départ, green, bunkers, étang et drapeau au bon endroit', () => {
  assert.equal(hole.surfaceAt(hole.tee.x, hole.tee.z), 'tee');
  assert.equal(hole.surfaceAt(hole.pin.x, hole.pin.z), 'green');
  for (const b of hole.bunkers) assert.equal(hole.surfaceAt(b.x, b.z), 'bunker');
  for (const w of hole.waters) assert.equal(hole.surfaceAt(w.x, w.z), 'water');
  assert.equal(hole.surfaceAt(0, 150), 'fairway');
  assert.equal(hole.surfaceAt(hole.bounds.x1 + 5, 100), 'ob');
  assert.ok(hole.length > 300 && hole.length < 380, `longueur ${hole.length}`);
  assert.ok(hole.trees.length > 100);
  for (const tr of hole.trees) assert.notEqual(hole.surfaceAt(tr.x, tr.z), 'fairway', 'pas d\'arbre sur le fairway');
});

t('pente du green raisonnable (moins de 4 %)', () => {
  const G = hole.green;
  for (let a = 0; a < 6.28; a += 0.4) for (let r = 0; r < 0.95; r += 0.15) {
    const x = G.x + Math.sin(a) * G.rx * r, z = G.z + Math.cos(a) * G.rz * r;
    if (hole.surfaceAt(x, z) !== 'green') continue;
    const [sx, sz] = hole.slopeAt(x, z, 0.3);
    assert.ok(Math.hypot(sx, sz) < 0.04, `pente ${(Math.hypot(sx, sz) * 100).toFixed(1)} %`);
  }
});

t('un même coup donne toujours la même trajectoire', () => {
  const b = { x: 0, z: 0, lie: 'tee' }, s = shot(0, { aim: 0.05, curve: 0.3, seed: 99 }), w = windFor(hole, 5);
  const a = simulate(hole, b, s, w), c = simulate(hole, b, s, w);
  assert.deepEqual([a.end.x, a.end.z, a.n, a.kind], [c.end.x, c.end.z, c.n, c.kind]);
  assert.deepEqual(windFor(hole, 5), windFor(hole, 5));
});

t('dans l\'étang : plouf, et la balle est replacée au sec', () => {
  const w = hole.waters[0], b = { x: 0, z: 0, lie: 'tee' };
  const aim = Math.atan2(w.x - b.x, w.z - b.z), d = Math.hypot(w.x - b.x, w.z - b.z);
  // un fer qui tombe au milieu de l'étang
  const r = simulate(hole, b, shot(2, { aim, power: d / (CLUBS[2].dist * CLUBS[2].carry) }), null);
  assert.equal(r.kind, 'water');
  assert.ok(r.drop);
  const s = hole.surfaceAt(r.drop.x, r.drop.z);
  assert.ok(s !== 'water' && s !== 'ob', `reprise sur ${s}`);
});

t('un drive hors du parcours finit hors limites, et le hors-limites suit la forme du trou', () => {
  const r = simulate(hole, { x: 0, z: 0, lie: 'tee' }, shot(0, { aim: -1.3 }), null);
  assert.equal(r.kind, 'ob');
  assert.equal(hole.surfaceAt(90, 180), 'ob', 'loin du fairway');
  assert.notEqual(hole.surfaceAt(40, 180), 'ob', 'dans le rough');
});

t('les petits putts bien dosés rentrent, trop fort ils ressortent', () => {
  const p = hole.pin;
  let made = 0, tot = 0;
  for (let a = 0; a < 6.28; a += 0.5) {
    const b = { x: p.x + Math.sin(a) * 1.2, z: p.z + Math.cos(a) * 1.2, lie: 'green' }, aim = Math.atan2(p.x - b.x, p.z - b.z), range = putterRange(1.2);
    const r = simulate(hole, b, { club: PUTTER, aim, power: 1.6 / range, seed: 1 }, null, { putt: range });
    tot++; if (r.kind === 'holed') made++;
    const hard = simulate(hole, b, { club: PUTTER, aim, power: 1, seed: 1 }, null, { putt: 30 });
    assert.notEqual(hard.kind, 'holed', 'un putt à 30 m ne rentre pas à 1,2 m');
  }
  assert.ok(made / tot > 0.7, `${made}/${tot} putts de 1,2 m`);
  assert.ok(CUP_R >= 0.054);
});

// golfeur automatique : vise le drapeau quand il est à portée, sinon le fairway ; dose à la distance
function autoplay(h, seed) {
  const w = windFor(h, seed);
  let ball = { x: h.tee.x, z: h.tee.z, lie: 'tee' }, strokes = 0;
  const pin = h.pin;
  for (let k = 0; k < 12; k++) {
    const d = Math.hypot(pin.x - ball.x, pin.z - ball.z);
    let club, power, aim = Math.atan2(pin.x - ball.x, pin.z - ball.z), putt = 20;
    if (ball.lie === 'green' || (ball.lie === 'fringe' && d < 15)) { club = PUTTER; putt = putterRange(d); power = Math.min(1, (d + 0.4) / putt); }
    else {
      club = 6;
      for (let c = PUTTER - 1; c >= 0; c--) { if (CLUBS[c].teeOnly && ball.lie !== 'tee') continue; club = c; if (CLUBS[c].dist * lieFactor(ball.lie, c) >= d) break; }
      const reach = CLUBS[club].dist * lieFactor(ball.lie, club);
      power = Math.min(1, d / reach);
      if (d > reach) { // vise le fairway à portée
        let best = null;
        for (const [x, z] of h.fair) if (Math.hypot(x - ball.x, z - ball.z) <= reach && Math.hypot(pin.x - x, pin.z - z) < d) best = [x, z];
        if (best) aim = Math.atan2(best[0] - ball.x, best[1] - ball.z);
      }
    }
    const r = simulate(h, ball, { club, traj: 'mid', aim, power, curve: 0, seed: seed * 13 + k }, w, { putt });
    strokes++;
    if (r.kind === 'holed') return strokes;
    if (r.kind === 'water' || r.kind === 'ob') strokes++; // on rejoue du même endroit
    else ball = { x: r.end.x, z: r.end.z, lie: r.surf };
  }
  return 99;
}

t('un golfeur automatique termine le trou en un nombre de coups raisonnable', () => {
  const scores = [];
  for (let s = 1; s <= 12; s++) scores.push(autoplay(hole, s));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  console.log(`   scores : ${scores.join(' ')} (moyenne ${avg.toFixed(1)})`);
  assert.ok(scores.every((s) => s < 99), 'toujours terminé');
  assert.ok(avg <= hole.par + 2.5, 'moyenne raisonnable');
});

t('un coup se calcule vite (moins de 60 ms)', () => {
  const t0 = performance.now();
  for (let i = 0; i < 10; i++) simulate(hole, { x: 0, z: 0, lie: 'tee' }, shot(0, { aim: 0.02 * i, seed: i }), windFor(hole, i));
  const ms = (performance.now() - t0) / 10;
  assert.ok(ms < 60, `${ms.toFixed(1)} ms`);
});

const holes = HOLES.map(buildHole);
const byName = (name) => holes.find((h) => h.name === name);
t('les 30 trous : départ, green, drapeau, longueur conforme au par', () => {
  assert.equal(holes.length, 30);
  let par = 0;
  for (const h of holes) {
    par += h.par;
    assert.equal(h.surfaceAt(h.tee.x, h.tee.z), 'tee', `départ du trou ${h.n}`);
    assert.equal(h.surfaceAt(h.pin.x, h.pin.z), 'green', `drapeau du trou ${h.n}`);
    const [lo, hi] = { 3: [95, 210], 4: [280, 440], 5: [430, 560] }[h.par];
    assert.ok(h.length >= lo && h.length <= hi, `trou ${h.n} : ${h.length} m pour un par ${h.par}`);
    assert.equal(suggestClub(h, { x: h.tee.x, z: h.tee.z, lie: 'tee' }) < 7, true);
  }
  assert.equal(par, 122);
  for (const c of Object.values(COURSES)) assert.ok([6, 8, 9, 18, 30].includes(c.holes.length));
  assert.equal(new Set(HOLES.map((d) => d.seed)).size, 30, 'une graine par trou');
});

t('îles et lacs : le green sur son île, l\'eau autour, le départ au sec', () => {
  const h = byName("L'Île du Lac");
  assert.equal(h.surfaceAt(0, 121), 'green');
  assert.equal(h.surfaceAt(0, 70), 'water');
  assert.equal(h.surfaceAt(30, 121), 'water');
  // l'îlot : un passage d'eau à porter juste avant le green
  const i = byName("L'Îlot");
  assert.equal(i.surfaceAt(-10, 290), 'water');
  assert.equal(i.surfaceAt(0, 150), 'fairway');
  // pas de flaque au milieu des îles
  for (const g of [byName('Les Îles'), byName('La Baie'), byName('Le Récif')]) {
    for (const [x, z, w] of g.fair) if (w > 0) assert.notEqual(g.surfaceAt(x, z), 'water', `${g.name} : flaque en ${x}, ${z}`);
  }
});

t('bord de mer : la balle dans la baie est repêchée au sec', () => {
  const h = byName('La Baie');
  assert.equal(h.surfaceAt(...h.coast.sea), 'water');
  const r = simulate(h, { x: 0, z: 0, lie: 'tee' }, shot(0, { aim: Math.atan2(h.coast.sea[0], h.coast.sea[1]) }), null);
  assert.equal(r.kind, 'water');
  assert.ok(!['water', 'ob'].includes(h.surfaceAt(r.drop.x, r.drop.z)));
});

t('montagne : le torrent au fond du ravin est un obstacle d\'eau', () => {
  const h = byName('Le Ravin');
  assert.equal(h.surfaceAt(0, 88), 'water');
  assert.ok(h.heightAt(0, 88) < h.heightAt(0, 40) - 4, 'le ravin est creusé');
  const short = simulate(h, { x: 0, z: 0, lie: 'tee' }, shot(5, { power: 0.85 }), null);
  assert.equal(short.kind, 'water');
});

t('désert : du sable dur hors du fairway, et un canyon sec sans eau', () => {
  const h = byName('La Piste');
  assert.equal(h.surfaceAt(3, 200), 'fairway');
  assert.equal(h.surfaceAt(30, 200), 'desert');
  const c = byName('Le Canyon');
  assert.notEqual(c.surfaceAt(0, 90), 'water');
  assert.ok(c.heightAt(0, 90) < c.heightAt(0, 30) - 8, 'le canyon est profond');
});

t('le caddie ne fait pas viser l\'eau ni la forêt', () => {
  // aux Lacets, le premier coup reste sur la première branche du lacet
  const h = byName('Les Lacets'), p = layupPoint(h, { x: 0, z: 0, lie: 'tee' }, 218);
  assert.ok(p.z < 175, `point visé ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`);
  for (const g of holes) {
    const q = layupPoint(g, { x: g.tee.x, z: g.tee.z, lie: 'tee' }, 200);
    if (q) assert.ok(!['water', 'ob'].includes(g.surfaceAt(q.x, q.z)), `trou ${g.n}`);
  }
});

t('ordre de jeu : honneur au départ, puis le plus loin du drapeau', () => {
  const h = holes[0];
  const R = newRound({ holes: [1, 2], players: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }] });
  startHole(R, h);
  assert.equal(R.turn, 0, 'premier trou : ordre d\'arrivée');
  const lie = (x, z) => h.surfaceAt(x, z);
  applyShot(R, h, 0, { kind: 'rest', end: { x: 0, z: 250 }, surf: 'fairway' }, lie);
  assert.equal(R.turn, 1, 'les autres partent du départ');
  applyShot(R, h, 1, { kind: 'rest', end: { x: 0, z: 150 }, surf: 'fairway' }, lie);
  applyShot(R, h, 2, { kind: 'rest', end: { x: 0, z: 200 }, surf: 'fairway' }, lie);
  assert.equal(R.turn, 1, 'le plus loin joue');
  // eau ou hors limites : un coup de pénalité, et on rejoue du même endroit
  const wet = { ...R.players[1].ball };
  applyShot(R, h, 1, { kind: 'water', end: { x: 0, z: 0 } }, lie);
  assert.deepEqual(R.players[1].ball, wet, 'à l\'eau : on rejoue du même endroit');
  assert.equal(R.players[1].strokes, 3);
  const before = { ...R.players[2].ball };
  applyShot(R, h, 2, { kind: 'ob', end: { x: 500, z: 0 } }, lie);
  assert.deepEqual(R.players[2].ball, before);
  assert.equal(R.players[2].strokes, 3);
  for (let k = 0; k < 3; k++) applyShot(R, h, k, { kind: 'holed' }, lie);
  assert.ok(holeOver(R));
  finishHole(R);
  assert.deepEqual(R.players.map((p) => p.scores[0]), [2, 4, 4]);
  startHole(R, holes[1]);
  assert.equal(R.turn, 0, 'honneur au meilleur score du trou précédent');
});

t('balle ramassée, Stableford et classement avec ex æquo', () => {
  const h = holes[1];
  const R = newRound({ holes: [2], players: [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }] });
  startHole(R, h);
  const lie = () => 'rough';
  while (!R.players[0].done) applyShot(R, h, 0, { kind: 'rest', end: { x: 0, z: 10 }, surf: 'rough' }, lie);
  assert.equal(R.players[0].strokes, MAX_STROKES);
  applyShot(R, h, 1, { kind: 'holed' }, lie); applyShot(R, h, 2, { kind: 'holed' }, lie);
  finishHole(R);
  assert.equal(R.phase, 'over');
  const rk = ranking(R, [3]);
  assert.deepEqual(rk.map((x) => x.rank), [1, 1, 3]);
  assert.equal(stableford(1, 3), 4); assert.equal(stableford(3, 3), 2); assert.equal(stableford(6, 3), 0);
  assert.equal(totals(R, [3])[0].toPar, MAX_STROKES - 3);
});

t('équipes (scramble) : chacun joue depuis la balle de l\'équipe, on garde la meilleure', () => {
  const h = holes[0];
  const R = newRound({ holes: [1], players: [{ id: 1, name: 'A', team: 0 }, { id: 2, name: 'B', team: 1 }, { id: 3, name: 'C', team: 0 }, { id: 4, name: 'D', team: 1 }], teams: [{ name: 'Bleus', color: '#00f' }, { name: 'Rouges', color: '#f00' }] });
  startHole(R, h);
  const lie = (x, z) => h.surfaceAt(x, z);
  assert.equal(R.turn, 0);
  applyShot(R, h, 0, { kind: 'rest', end: { x: 0, z: 150 }, surf: 'fairway' }, lie);
  assert.equal(R.turn, 2, 'le coéquipier joue ensuite, depuis le même endroit');
  assert.deepEqual(R.players[2].ball, { x: 0, z: 0, lie: 'tee' });
  const out = applyShot(R, h, 2, { kind: 'rest', end: { x: 0, z: 230 }, surf: 'fairway' }, lie);
  assert.ok(out.resolved && out.best === 2, 'la meilleure balle est celle de C');
  assert.equal(R.players[0].strokes, 1, 'une volée = un coup pour l\'équipe');
  assert.deepEqual([R.players[0].ball.z, R.players[2].ball.z], [230, 230]);
  assert.equal(R.turn, 1, 'puis l\'autre équipe');
  applyShot(R, h, 1, { kind: 'water', end: { x: 0, z: 100 } }, lie);
  const o2 = applyShot(R, h, 3, { kind: 'rest', end: { x: 0, z: 120 }, surf: 'fairway' }, lie);
  assert.equal(o2.best, 3, 'une balle sans pénalité vaut mieux qu\'une balle à l\'eau');
  assert.equal(R.players[1].strokes, 1);
  // une balle rentrée termine la volée de l'équipe tout de suite
  const k = R.turn, mate = R.players.findIndex((p, j) => j !== k && p.team === R.players[k].team);
  const o3 = applyShot(R, h, k, { kind: 'holed' }, lie);
  assert.ok(o3.holed && R.players[k].done && R.players[mate].done);
});

t('bots : les trois niveaux finissent les 30 trous, le meilleur niveau joue mieux', () => {
  const play = (level, seed) => {
    let total = 0;
    for (const h of holes) {
      const w = windFor(h, seed);
      let ball = { x: h.tee.x, z: h.tee.z, lie: 'tee' }, s = 0;
      for (let k = 0; k < MAX_STROKES; k++) {
        const b = botShot(h, ball, w, level, seed * 100 + h.n * 10 + k);
        const r = simulate(h, ball, { ...b, seed: seed + k }, w, { putt: b.putt });
        s++;
        if (r.kind === 'holed') break;
        if (r.kind === 'water' || r.kind === 'ob') s++; // on rejoue du même endroit
        else ball = { x: r.end.x, z: r.end.z, lie: r.surf };
      }
      total += Math.min(s, MAX_STROKES);
    }
    return total;
  };
  const f = play('facile', 3), m = play('normal', 3), e = play('expert', 3);
  console.log(`   30 trous (par 122) : facile ${f}, moyen ${m}, difficile ${e}`);
  assert.ok(e < f, 'le niveau difficile bat le niveau facile');
  assert.ok(e < 140 && f < 190);
});

// une partie entière déroulée par la session : un joueur (joué ici par l'IA) et deux bots
await new Promise((resolve, reject) => {
  const me = { id: 7, name: 'Moi', color: '#ff4b2b' };
  let host = null, shots = 0;
  const bridge = { embedded: false, players: [me], on() {}, send() {}, report() {} };
  const emit = (e) => {
    if (e.type === 'shot') { shots++; setTimeout(() => host.done(e.ev.no), 0); }
    if (e.type === 'state') {
      const R = e.R;
      if (R.phase === 'over') {
        const rk = ranking(R, R.holes.map((x) => holeByNumber(x).par));
        try {
          assert.equal(rk.length, 3);
          assert.ok(R.players.every((p) => p.scores.length === 8 && p.scores.every((s) => s >= 1 && s <= MAX_STROKES)));
          console.log(`   partie de 8 trous en ${shots} coups : ${rk.map((x) => `${x.name} ${x.strokes}`).join(', ')}`);
          n++; console.log('✓ une partie de 8 trous se joue de bout en bout (session, tours, bots, scores)');
          host.stop(); resolve();
        } catch (err) { reject(err); }
        return;
      }
      const P = R.players[R.turn];
      if (P && P.id === me.id) {
        const h = holeByNumber(R.holes[R.hi]);
        setTimeout(() => host.shot(botShot(h, P.ball, windFor(h, R.seed, R.wind), 'expert', R.shotNo + 1)), 0);
      }
    }
  };
  host = startHost({ bridge, solo: true, settings: { course: 'montagne', bots: 2, level: 'normal' }, me, emit, speed: 1000 });
  host.begin();
  setTimeout(() => reject(new Error('la partie ne se termine pas')), 60000);
});

// une partie en équipes (2 contre 2) jouée par la session : le joueur et un bot contre deux bots, au crépuscule
await new Promise((resolve, reject) => {
  const me = { id: 7, name: 'Moi', color: '#ff4b2b' };
  let host = null;
  const bridge = { embedded: false, players: [me], on() {}, send() {}, report() {} };
  const emit = (e) => {
    if (e.type === 'shot') setTimeout(() => host.done(e.ev.no), 0);
    if (e.type === 'state') {
      const R = e.R;
      if (R.phase === 'over') {
        try {
          assert.equal(R.players.length, 4);
          assert.equal(R.time, 'crepuscule');
          for (const k of [0, 1]) { const m = R.players.filter((p) => p.team === k); assert.equal(m.length, 2); assert.deepEqual(m[0].scores, m[1].scores, 'même score pour les coéquipiers'); }
          console.log(`   2 contre 2 sur 6 trous : ${R.teams.map((t, k) => `${t.name} ${R.players.find((p) => p.team === k).scores.reduce((a, b) => a + b, 0)}`).join(', ')}`);
          n++; console.log('✓ une partie en équipes se joue de bout en bout (scramble, scores d\'équipe)');
          host.stop(); resolve();
        } catch (err) { reject(err); }
        return;
      }
      const P = R.players[R.turn];
      if (P && P.id === me.id) {
        const h = holeByNumber(R.holes[R.hi]);
        setTimeout(() => host.shot(botShot(h, P.ball, windFor(h, R.seed, R.wind), 'expert', R.shotNo + 1)), 0);
      }
    }
  };
  host = startHost({ bridge, solo: true, settings: { course: 'desert', teams: '2v2', time: 'crepuscule', level: 'normal' }, me, emit, speed: 1000 });
  host.begin();
  setTimeout(() => reject(new Error('la partie en équipes ne se termine pas')), 60000);
});

// partie à deux en réseau (pont simulé) : l'hôte attend que l'invité ait vu chaque coup, n'attend plus un joueur
// coupé, joue pour lui s'il ne joue pas, et un bot attend que tout le monde voie son tour
{
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = { id: 0, name: 'Hôte', color: '#ff4b2b' }, guest = { id: 1, name: 'Invité', color: '#2b8cff' };
  const handlers = {}, sent = [], states = [], shots = [];
  const bridge = { embedded: false, players: [host, guest], on(k, fn) { (handlers[k] = handlers[k] || []).push(fn); }, send(to, m) { sent.push({ to, m }); }, report() {} };
  const fire = (k, ...a) => (handlers[k] || []).forEach((f) => f(...a));
  const emit = (e) => { if (e.type === 'state') states.push(e.R); if (e.type === 'shot') shots.push(e.ev); };
  const S = startHost({ bridge, solo: false, settings: { course: 'campagne', bots: 1, level: 'normal' }, me: host, emit, speed: 20 });
  S.begin();
  await wait(20);
  let R = states.at(-1);
  assert.equal(R.players[R.turn].id, 0, 'l\'hôte ouvre');
  S.shot({ club: 0, aim: 0, power: 0.8, curve: 0 });
  assert.equal(shots.length, 1);
  S.done(0);
  await wait(150);
  assert.equal(states.length, 1, 'l\'hôte a vu le coup, mais l\'invité le regarde encore : on attend');
  fire('msg', 1, { t: 'seen', no: 0 });
  await wait(20);
  assert.equal(states.length, 2, 'tout le monde a vu le coup : on passe au suivant');
  R = states.at(-1);
  // l'invité ou le bot est le plus loin du drapeau (tous deux au départ) ; si c'est le bot, il attend que chacun voie son tour
  if (R.players[R.turn].bot) {
    await wait(300);
    assert.equal(shots.length, 1, 'le bot attend que tout le monde voie son tour');
    S.ready(R.shotNo); fire('msg', 1, { t: 'ready', no: R.shotNo });
    for (let k = 0; k < 40 && shots.length < 2; k++) await wait(20);
    assert.equal(shots.length, 2, 'tout le monde est prêt : le bot joue');
    S.done(1); fire('msg', 1, { t: 'seen', no: 1 });
    await wait(20);
    R = states.at(-1);
  }
  assert.equal(R.players[R.turn].id, 1, 'au tour de l\'invité');
  // l'invité perd sa connexion (le salon lui garde sa place) : son coup part tout seul au bout de 20 s, et personne ne
  // l'attend plus pour regarder les coups
  const before = shots.length;
  bridge.players = [host, { ...guest, away: true }]; fire('roster');
  for (let k = 0; k < 120 && shots.length === before; k++) await wait(20);
  assert.equal(shots.length, before + 1, 'joueur coupé : son coup part tout seul');
  assert.ok(sent.some(({ m }) => m.t === 'note'), 'les autres sont prévenus');
  const nst = states.length;
  S.done(shots.at(-1).no);
  await wait(20);
  assert.ok(states.length > nst, 'on n\'attend pas le joueur coupé pour avancer');
  // le bot (encore au départ) joue ensuite : il attend que l'hôte voie son tour (l'invité coupé n'est pas attendu)
  R = states.at(-1);
  assert.ok(R.players[R.turn].bot, 'au tour du bot');
  const nb = shots.length;
  await wait(300);
  assert.equal(shots.length, nb, 'le bot attend que tout le monde voie son tour');
  S.ready(R.shotNo);
  for (let k = 0; k < 40 && shots.length === nb; k++) await wait(20);
  assert.equal(shots.length, nb + 1, 'tout le monde est prêt : le bot joue');
  S.stop();
  n++; console.log('✓ partie en réseau : on avance quand tout le monde a vu le coup, sans attendre un joueur coupé');
}

// menu en réseau (pont simulé entre un hôte et un invité) : l'invité voit les réglages de l'hôte et leurs changements,
// la partie démarre chez lui quand l'hôte la lance, l'hôte peut revenir au menu, et chaque partie terminée compte
{
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const host = { id: 0, name: 'Hôte', color: '#ff4b2b' }, guest = { id: 1, name: 'Invité', color: '#2b8cff' };
  const hH = {}, gH = {}, reports = [], gEv = [];
  const fire = (hs, k, ...a) => (hs[k] || []).forEach((f) => f(...a));
  const hostBridge = { embedded: true, players: [host, guest], on(k, fn) { (hH[k] = hH[k] || []).push(fn); }, report(r) { reports.push(r); },
    send(to, m) { if (to === 'all' || to === 1) setTimeout(() => fire(gH, 'msg', 0, JSON.parse(JSON.stringify(m))), 0); } };
  const guestBridge = { embedded: true, players: [host, guest], on(k, fn) { (gH[k] = gH[k] || []).push(fn); }, report() {},
    send(to, m) { if (to === 'host') setTimeout(() => fire(hH, 'msg', 1, JSON.parse(JSON.stringify(m))), 0); } };
  let S = null;
  // l'hôte joue ses coups comme un bot ; les deux regardent chaque coup jusqu'au bout
  const emit = (e) => {
    if (e.type === 'shot') { S.done(e.ev.no); return; }
    if (e.type !== 'state' || e.R.phase !== 'play') return;
    const P = e.R.players[e.R.turn], h = holeByNumber(e.R.holes[e.R.hi]);
    if (P.id === host.id) setTimeout(() => S.shot(botShot(h, P.ball, windFor(h, e.R.seed, e.R.wind), 'expert', e.R.shotNo + 1)), 0);
  };
  const C = startClient({ bridge: guestBridge, me: guest, emit: (e) => {
    gEv.push(e);
    if (e.type === 'shot') guestBridge.send('host', { t: 'seen', no: e.ev.no });
    if (e.type === 'state' && e.R.phase === 'play') {
      const P = e.R.players[e.R.turn], h = holeByNumber(e.R.holes[e.R.hi]);
      if (P.id === guest.id) setTimeout(() => C.shot(botShot(h, P.ball, windFor(h, e.R.seed, e.R.wind), 'expert', e.R.shotNo + 3)), 0);
    }
  } });
  S = startHost({ bridge: hostBridge, solo: false, settings: { course: 'campagne', bots: 0, time: 'jour' }, me: host, emit, speed: 200 });
  await wait(30);
  const setups = () => gEv.filter((e) => e.type === 'setup');
  assert.equal(setups().at(-1)?.set.course, 'campagne', 'l\'invité qui arrive au menu reçoit les réglages de l\'hôte');
  S.configure({ course: 'desert', bots: 0, time: 'soir', startHole: 30 });
  await wait(20);
  assert.equal(setups().at(-1).set.course, 'desert', 'l\'invité voit le parcours choisi par l\'hôte');
  assert.equal(setups().at(-1).set.time, 'soir');
  const playOnce = async () => {
    S.begin();
    for (let k = 0; k < 500 && !gEv.some((e) => e.type === 'state' && e.R.phase === 'over' && e.R.started === S.state?.started); k++) await wait(20);
  };
  await playOnce();
  const first = gEv.find((e) => e.type === 'state');
  assert.ok(first && first.R.course === 'desert' && first.R.time === 'soir', 'la partie démarre chez l\'invité avec les réglages de l\'hôte');
  assert.equal(S.state.phase, 'over', 'la partie se termine');
  assert.equal(reports.length, 1, 'la partie est comptée dans le classement');
  S.menu();
  await wait(20);
  assert.equal(gEv.at(-1).type, 'menu', 'l\'hôte revient au menu : l\'invité aussi');
  assert.equal(gEv.at(-1).set.course, 'desert');
  // au menu, l'invité qui redemande l'état reçoit les réglages, pas l'ancienne partie
  C.resync(); await wait(20);
  assert.equal(gEv.at(-1).type, 'setup');
  await wait(5);
  await playOnce();
  assert.equal(reports.length, 2, 'la seconde partie compte aussi');
  C.stop(); S.stop();
  n++; console.log('✓ menu en réseau : l\'invité suit les choix de l\'hôte, la partie démarre chez lui, retour au menu et nouvelle partie');
}

console.log(`\n${n} tests réussis`);
