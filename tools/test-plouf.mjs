// Tests du moteur de Plouf ! (plouf/engine/) : node tools/test-plouf.mjs
// Arènes, jab et poussée armée, KO, prise (traîner, soulever) et lancer, accroche au bord et coup de pied, chute et bouée, mouette et sardine, fin de manche, parties entières entre bots,
// instantané et reprise par un nouvel hôte, et prédiction d'un invité (stepPlayer rejoué à partir de l'état de l'hôte).
import { Sim, DT, ST, R, stepPlayer, playerFromRow, CHARGE_MAX, BOT_ID, HANG_V, KO_T } from '../plouf/engine/sim.js';
import { Arena, SHAPES, SHAPE_KEYS, T } from '../plouf/engine/arena.js';

let fails = 0, count = 0;
const ok = (cond, msg) => { count++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const section = (s) => console.log('• ' + s);
const run = (sim, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++) { each && each(i); sim.step(DT); } };
const idle = { mx: 0, mz: 0, push: false, pc: 0, gc: 0 };
// un joueur seul, posé au centre, sans objets ni vent : pour tester une mécanique à la fois
function lab(n = 2, shape = 'radeau') {
  const sim = new Sim({ seed: 7, goal: 3, items: false, wind: false });
  for (let i = 0; i < n; i++) sim.addPlayer({ id: i, name: 'J' + i, color: '#ff0000' });
  sim.start(); sim.arena = new Arena(shape); sim.ph = 'play'; sim.rt = 0;
  return sim;
}
const put = (p, x, z, yaw) => Object.assign(p, { x, z, yaw, vx: 0, vz: 0, y: 0, st: ST.RUN, stun: 0, chg: 0, lun: 0, cd: 0, dz: 0, ko: 0, hg: null, cl: 0, thr: 0 });

section('Arènes');
for (const k of SHAPE_KEYS) {
  const A = new Arena(k);
  ok(A.count() > 20, `${k} : assez de planches (${A.count()})`);
  ok(A.support(A.cx, A.cz) || k === 'bouee', `${k} : le centre porte`);
  ok(A.support(A.x0 - 1, 0) === 0, `${k} : le large est de l'eau`);
  const B = new Arena(k, A.encode());
  ok(B.encode() === A.encode(), `${k} : l'état des planches se transmet tel quel`);
  const Big = new Arena(k, null, true);
  ok(Big.cols === A.cols + 2 && Big.count() > A.count() + 10, `${k} : le grand radeau (6 joueurs et plus) a une rangée de plus`);
  // départ : un cercle de 8 joueurs, tous sur des planches
  const sim = new Sim({ seed: 3 });
  for (let i = 0; i < 8; i++) sim.addPlayer({ id: i, name: 'J' + i, color: '#fff' });
  sim.arena = Big;
  [...sim.players.values()].forEach((p, i) => sim.place([p], i, 8));
  ok([...sim.players.values()].every((p) => Big.support(p.x, p.z) === 1), `${k} : les 8 places de départ sont au sec`);
  const near = Math.min(...[...sim.players.values()].flatMap((p, i, a) => a.slice(i + 1).map((q) => Math.hypot(p.x - q.x, p.z - q.z))));
  ok(near > 1.2, `${k} : au départ, chacun a de la place (${near.toFixed(2)} m)`);
}
{
  const A = new Arena('radeau');
  const edge = A.x0 + 0.1; // juste au bord de la première colonne
  ok(A.support(A.x0 - 0.1, A.cz) === 2, 'au bord, on vacille sans tomber');
  ok(A.support(A.x0 - 0.4, A.cz) === 0, 'un peu plus loin, c\'est l\'eau');
  ok(A.support(edge, A.cz) === 1, 'sur la planche du bord, on est porté');
  const e = A.edges();
  ok(e.length > 0 && e.every((i) => !A.core.has(i)), 'les planches du bord ne comptent pas celles du centre');
  A.shake(e[0]); ok(A.st[e[0]] === 2, 'une planche se met à branler');
  let sunk = []; for (let i = 0; i < 120 && !sunk.length; i++) sunk = A.step(DT);
  ok(sunk[0] === e[0] && A.st[e[0]] === 0, 'puis elle coule');
}

section('Pousser');
{
  const sim = lab(2), [a, b] = [...sim.players.values()];
  put(a, -1.6, 0, Math.PI / 2); put(b, -0.1, 0, 0);
  // petite tape : appui et lâcher au même instant
  a.inp = { ...idle, pc: 1, push: false };
  sim.step(DT);
  ok(a.lun > 0 && a.cd > 0 && a.lk < 0 && a.vx > 4, 'une tape lance un jab (petit coup de poing)');
  run(sim, 0.2);
  ok(b.stun > 0 || b.vx > 2, 'le jab bouscule celui qui est devant');
  ok(b.dz > 0.3 && b.st === ST.RUN, 'un jab étourdit sans mettre à plat');
  const small = Math.abs(b.x - (-0.1));
  // poussée armée à fond
  const s2 = lab(2), [c, d] = [...s2.players.values()];
  put(c, -1, 0, Math.PI / 2); put(d, -0.1, 0, 0);
  c.inp = { ...idle, pc: 1, push: true };
  run(s2, CHARGE_MAX + 0.05);
  ok(Math.abs(c.chg - CHARGE_MAX) < 1e-6, 'maintenir arme la poussée jusqu\'au maximum');
  ok(Math.abs(c.x + 1) < 0.5, 'en armant, on avance au ralenti');
  c.inp = { ...idle, pc: 1, push: false };
  run(s2, 0.25);
  const big = Math.abs(d.x - (-0.1));
  ok(big > small * 1.3, `armer pousse plus loin qu'un jab (${big.toFixed(2)} m contre ${small.toFixed(2)} m)`);
  ok(d.st === ST.DOWN || d.dz > 0.9, 'une poussée à fond met à plat (KO)');
  ok(d.hitBy === c.id, 'le coup est attribué à celui qui pousse');
  // une poussée armée du centre vers le bord : à l'eau
  const s3 = lab(2), [e, f] = [...s3.players.values()], A = s3.arena;
  put(e, A.x0 + 3.2, 0, -Math.PI / 2); put(f, A.x0 + 2.4, 0, 0);
  e.inp = { ...idle, pc: 1, push: true }; run(s3, CHARGE_MAX);
  e.inp = { ...idle, pc: 1, push: false }; run(s3, 2.5);
  ok(f.st === ST.GULL, 'poussé fort près du bord, on tombe à l\'eau et on devient mouette');
  ok(e.ko2 === 1, 'celui qui a poussé compte un adversaire tombé');
  ok(s3.ph === 'round' && s3.rw === e.id && e.pts === 1, 'le dernier au sec gagne la manche');
  // pas de ruée quand on porte quelque chose, ni pendant le temps de recharge
  const s4 = lab(2), [g] = [...s4.players.values()];
  put(g, 0, 0, 0); g.ck = 1; g.cid = 99; g.inp = { ...idle, pc: 1 };
  stepPlayer(g, g.inp, DT, s4.ctx(), null);
  ok(g.lun === 0 && g.chg === 0, 'on ne pousse pas en portant');
  // trois jabs de suite : KO
  const s5 = lab(2), [h1, h2] = [...s5.players.values()];
  put(h1, -1.2, 0, Math.PI / 2); put(h2, -0.2, 0, 0);
  let kos = 0, koEv = false;
  for (let i = 0; i < 3; i++) { put(h1, h2.x - 1.0, h2.z, Math.PI / 2); h1.cd = 0; h1.inp = { ...idle, pc: i + 1 }; run(s5, 0.5, () => { koEv = koEv || s5.events.some((e) => e.e === 'ko'); }); h2.vx = h2.vz = 0; if (h2.st === ST.DOWN) kos++; }
  ok(kos > 0 && koEv, 'trois jabs de suite mettent à plat');
  ok(h2.ko > 0 && h2.ko <= KO_T, `à plat, on reste au sol ${KO_T} s au plus`);
  const koBefore = h2.ko; let k2 = 0; run(s5, 0.3, (i) => { if (i % 6 === 0) h2.inp = { ...idle, pc: ++k2 + 50 }; });
  ok(h2.ko < koBefore - 0.3 - 0.2, 'martelez les boutons : on se relève plus vite');
  let t = 0; while (h2.st === ST.DOWN && t < 3) { s5.step(DT); t += DT; }
  ok(h2.st === ST.RUN && h2.dz < 0.5, 'puis on se relève, encore un peu sonné');
}

section('Attraper et lancer');
{
  const sim = lab(2), [a, b] = [...sim.players.values()], A = sim.arena;
  put(a, A.x0 + 3, 0, -Math.PI / 2); put(b, A.x0 + 2.2, 0, 0);
  a.inp = { ...idle, gc: 1 }; sim.step(DT);
  ok(a.ck === 2 && b.st === ST.HELD && b.by === a.id && !a.lift, 'on attrape le joueur debout devant soi : on le tient par le bras');
  run(sim, 0.3);
  ok(b.y === 0 && Math.abs(Math.hypot(b.x - a.x, b.z - a.z) - 0.72) < 0.15, 'il est traîné au bout du bras, au sol');
  // on recule vers le bord en le traînant : il passe à l'eau
  a.inp = { ...idle, gc: 1, mx: -1, mz: 0 };
  run(sim, 2.5);
  ok(b.st === ST.GULL || b.st === ST.FALL, 'traîné jusqu\'au bord, il passe à l\'eau');
  ok(b.hitBy === a.id || a.ko2 === 1, 'et c\'est compté pour celui qui le traînait');
  // un joueur à plat se soulève au-dessus de la tête et se jette loin
  const sL = lab(2), [la, lb] = [...sL.players.values()], AL = sL.arena;
  put(la, AL.x0 + 3.2, 0, -Math.PI / 2); put(lb, AL.x0 + 2.4, 0, 0); lb.st = ST.DOWN; lb.ko = 3;
  la.inp = { ...idle, gc: 1 }; sL.step(DT);
  ok(la.ck === 2 && la.lift === 1 && lb.st === ST.HELD && Math.abs(lb.y - 1.15) < 1e-6, 'un joueur à plat se soulève au-dessus de la tête');
  la.inp = { ...idle, gc: 2 }; run(sL, 2);
  ok(lb.st === ST.GULL || lb.st === ST.FALL, 'lancé vers le large, il tombe à l\'eau');
  // jeté sur les planches, on s'étale
  const sT = lab(2), [ta, tb] = [...sT.players.values()];
  put(ta, -4.6, 0, Math.PI / 2); put(tb, -3.8, 0, 0); tb.st = ST.DOWN; tb.ko = 3;
  ta.inp = { ...idle, gc: 1 }; sT.step(DT); ta.inp = { ...idle, gc: 2 }; run(sT, 1.5);
  ok(tb.st === ST.DOWN && tb.x > 0, 'jeté sur les planches, on retombe à plat plus loin');
  // se dégager en gigotant
  const s2 = lab(2), [c, d] = [...s2.players.values()];
  put(c, 0, 0, Math.PI / 2); put(d, 0.8, 0, 0);
  c.inp = { ...idle, gc: 1 }; s2.step(DT);
  let k = 0, freeAt = 0; run(s2, 2, (i) => { if (d.st === ST.HELD && i % 6 === 0) d.inp = { ...idle, pc: ++k }; else if (d.st !== ST.HELD && !freeAt) freeAt = i * DT; });
  ok(d.st === ST.RUN && c.ck === 0 && freeAt < 0.8, `on se dégage plus vite en appuyant sur les boutons (${freeAt.toFixed(2)} s)`);
  const s3 = lab(2), [e, f] = [...s3.players.values()];
  put(e, 0, 0, Math.PI / 2); put(f, 0.8, 0, 0);
  e.inp = { ...idle, gc: 1 }; s3.step(DT);
  let t = 0; while (f.st === ST.HELD && t < 3) { s3.step(DT); t += DT; }
  ok(t > 1.5 && t < 2, `sans rien faire, on se dégage seul au bout de ${t.toFixed(2)} s`);
  // pastèque : on la prend, on la lance, elle renverse
  const s4 = lab(2), [g, h] = [...s4.players.values()];
  put(g, -2, 0, Math.PI / 2); put(h, 1.5, 0, 0);
  s4.objs.push({ id: 50, k: 'melon', x: -1.4, z: 0, y: 0, vx: 0, vz: 0, vy: 0, st: 0, by: -1, age: 0 });
  g.inp = { ...idle, gc: 1 }; s4.step(DT);
  ok(g.ck === 1 && s4.objs[0].st === 1, 'on ramasse une pastèque');
  g.inp = { ...idle, gc: 2 }; let hitEv = false;
  run(s4, 0.6, () => { hitEv = hitEv || s4.events.some((x) => x.e === 'splat'); });
  ok(hitEv && h.hitBy === g.id && !s4.objs.length, 'la pastèque lancée renverse celui qu\'elle touche et éclate');
  // un coup fait lâcher ce qu'on porte
  const s5 = lab(3), [i1, i2, i3] = [...s5.players.values()];
  put(i1, 0, 0, Math.PI / 2); put(i2, 0.8, 0, 0); put(i3, -1, 0, Math.PI / 2);
  i1.inp = { ...idle, gc: 1 }; s5.step(DT);
  i3.inp = { ...idle, pc: 1 }; run(s5, 0.3);
  ok(i1.ck === 0 && i2.st !== ST.HELD, 'bousculé, on lâche celui qu\'on porte');
}

section('Accroche au bord et coup de pied');
{
  // on marche vers le bord : on se rattrape d'une main et on reste suspendu
  const sim = lab(2), [a, b] = [...sim.players.values()], A = sim.arena;
  put(a, A.x0 + 1.0, 0, -Math.PI / 2); put(b, 2, 2, 0);
  a.inp = { ...idle, mx: -1, mz: 0 };
  let t = 0; while (a.st === ST.RUN && t < 3) { sim.step(DT); t += DT; }
  ok(a.st === ST.HANG && a.hg && a.hg.nx === -1, `arrivé au bord en marchant (${Math.hypot(a.vx, a.vz).toFixed(1)} < ${HANG_V} m/s), on se rattrape d'une main`);
  ok(a.x < A.x0 && a.y < 0, 'le corps pend juste au-delà du bord');
  // sans rien faire, on finit par lâcher
  a.inp = { ...idle }; run(sim, 7.5);
  ok(a.st === ST.GULL || a.st === ST.FALL, 'au bout de 7 s suspendu, on lâche');
  // on remonte en poussant vers le radeau et en appuyant
  const s2 = lab(2), [c, d] = [...s2.players.values()];
  put(c, A.x0 + 1.0, 0, -Math.PI / 2); put(d, 2, 2, 0);
  c.inp = { ...idle, mx: -1 }; t = 0; while (c.st === ST.RUN && t < 3) { s2.step(DT); t += DT; }
  c.inp = { ...idle, mx: 1 }; let k = 0, climbed = false, tc = 0;
  while (c.st === ST.HANG && tc < 3) { if (Math.round(tc * 60) % 10 === 0) c.inp = { ...idle, mx: 1, pc: ++k }; s2.step(DT); tc += DT; climbed = climbed || s2.events.some((e) => e.e === 'climb'); }
  run(s2, 1);
  ok(climbed && tc < 1 && c.st === ST.RUN && s2.arena.support(c.x, c.z), `en poussant vers le radeau et en martelant, on remonte en ${tc.toFixed(2)} s`);
  // un coup de pied sur les doigts
  const s3 = lab(2), [e, f] = [...s3.players.values()];
  put(e, A.x0 + 1.0, 0, -Math.PI / 2); put(f, A.x0 + 0.85, 0, -Math.PI / 2);
  e.inp = { ...idle, mx: -1 }; t = 0; while (e.st === ST.RUN && t < 3) { s3.step(DT); t += DT; }
  e.inp = { ...idle }; put(f, A.x0 + 0.85, 0, -Math.PI / 2);
  f.inp = { ...idle, pc: 1 }; let stomp = false; run(s3, 0.6, () => { stomp = stomp || s3.events.some((x) => x.e === 'stomp'); });
  ok(stomp && (e.st === ST.FALL || e.st === ST.GULL) && e.hitBy === f.id, 'un jab donné à un suspendu lui fait lâcher prise, à son compte');
  // en pleine ruée, pas d'accroche : plongeon
  const s4 = lab(2), [g] = [...s4.players.values()];
  put(g, A.x0 + 1.2, 0, -Math.PI / 2);
  g.inp = { ...idle, pc: 1, push: true }; run(s4, CHARGE_MAX); g.inp = { ...idle, pc: 1 }; run(s4, 0.6);
  ok(g.st === ST.FALL || g.st === ST.GULL, 'en pleine ruée vers le bord, c\'est le plongeon');
}

section('Bouée, mouette et sardine');
{
  const sim = lab(2), [a, b] = [...sim.players.values()], A = sim.arena;
  put(a, 0, 0, 0); put(b, 1, 0, 0);
  sim.objs.push({ id: 60, k: 'buoy', x: 0.1, z: 0, y: 0, vx: 0, vz: 0, vy: 0, st: 0, by: -1, age: 0 });
  sim.step(DT);
  ok(a.buoy === 1 && !sim.objs.length, 'on enfile la bouée en passant dessus');
  put(a, A.x0 - 1, 0, 0); a.buoy = 1; sim.step(DT);
  ok(a.st === ST.FALL, 'dans l\'eau, on tombe');
  run(sim, 3);
  ok(a.st === ST.RUN && A.support(a.x, a.z) && a.buoy === 0, 'la bouée nous ramène une fois sur les planches');
  put(a, A.x0 - 1, 0, 0); run(sim, 2);
  ok(a.st === ST.GULL, 'sans bouée, on devient mouette');
  // la mouette lâche une sardine qui bouscule
  put(b, 0, 0, 0); a.x = 0; a.z = 0; a.cd = 0;
  a.inp = { ...idle, pc: (a.pc | 0) + 1 }; sim.step(DT);
  ok(sim.objs.some((o) => o.k === 'fish'), 'la mouette lâche une sardine');
  const bx = b.x; b.x = 0.4;
  let fish = false; run(sim, 1, () => { fish = fish || sim.events.some((x) => x.e === 'fish'); });
  ok(fish && b.hitBy === a.id && Math.abs(b.x - 0.4) > 0.3, 'la sardine bouscule celui qui est dessous');
  ok(a.cd > 0, 'puis il faut attendre avant la suivante');
  void bx;
}

section('Parties entières entre bots');
for (const level of ['facile', 'normal', 'expert']) {
  const lens = [];
  for (let s = 1; s <= 6; s++) {
    const sim = new Sim({ seed: s * 101, goal: 3, items: true, wind: true });
    sim.addBots(6, level);
    sim.start();
    let t = 0, rounds = [];
    while (sim.ph !== 'over' && t < 900) {
      sim.step(DT); t += DT;
      for (const e of sim.drainEvents()) if (e.e === 'roundEnd') rounds.push(sim.rt);
    }
    ok(sim.ph === 'over' && sim.win >= BOT_ID, `${level} graine ${s} : la partie se termine avec un vainqueur`);
    ok(rounds.every((x) => x < 100), `${level} graine ${s} : aucune manche ne dépasse 100 s (${rounds.map((x) => Math.round(x)).join(', ')})`);
    lens.push(...rounds);
  }
  const avg = lens.reduce((a, b) => a + b, 0) / lens.length;
  console.log(`  ${level} : ${lens.length} manches, ${avg.toFixed(0)} s en moyenne (de ${Math.round(Math.min(...lens))} à ${Math.round(Math.max(...lens))} s)`);
  const lo = level === 'expert' ? 12 : 20; // les experts enchaînent KO, soulevé, jeté : c'est voulu, ça va vite
  ok(avg > lo && avg < 80, `${level} : une manche dure entre ${lo} et 80 s en moyenne`);
}
{
  // un joueur immobile au centre et 5 bots : les bots viennent le chercher
  let fell = 0;
  for (let s = 1; s <= 5; s++) {
    const sim = new Sim({ seed: s, goal: 1, items: false, wind: false });
    sim.addPlayer({ id: 0, name: 'Moi', color: '#fff' });
    sim.addBots(5, 'expert');
    sim.start();
    let t = 0; const me = sim.players.get(0);
    while (me.st !== ST.GULL && t < 60) { sim.step(DT); t += DT; }
    if (me.st === ST.GULL && t < 60) fell++;
  }
  ok(fell >= 4, `les bots experts font tomber un joueur qui ne bouge pas (${fell}/5)`);
}

section('Instantané, reprise et prédiction');
{
  const sim = new Sim({ seed: 42, goal: 3 });
  sim.addPlayer({ id: 0, name: 'Hôte', color: '#ff0000' });
  sim.addPlayer({ id: 1, name: 'Invité', color: '#0000ff' });
  sim.addBots(2, 'normal');
  sim.start();
  run(sim, 25);
  const snap = JSON.parse(JSON.stringify(sim.snapshot()));
  ok(JSON.stringify(snap).length < 4000, `l'instantané reste petit (${JSON.stringify(snap).length} octets)`);
  const r = Sim.restore(snap);
  ok(r.players.size === 4 && r.arena.encode() === sim.arena.encode() && r.rd === sim.rd, 'le nouvel hôte reprend joueurs, planches et manche');
  ok([...r.players.values()].filter((p) => p.bot).length === 2, 'les bots continuent de jouer');
  let t = 0; while (r.ph !== 'over' && t < 600) { r.step(DT); t += DT; }
  ok(r.ph === 'over', 'la partie reprise va jusqu\'au bout');

  // prédiction : l'invité rejoue ses commandes à partir de l'état de l'hôte et retombe au même endroit
  const h = new Sim({ seed: 9, goal: 3, items: false, wind: false });
  h.addPlayer({ id: 1, name: 'Invité', color: '#00f' });
  h.start(); run(h, 3.1);
  const me = h.players.get(1), inputs = [];
  for (let i = 0; i < 90; i++) inputs.push({ mx: Math.sin(i / 20), mz: Math.cos(i / 30) * 0.6, push: i > 30 && i < 50, pc: i > 30 ? 1 : 0, gc: 0 });
  const row = h.snapshot().P.find((x) => x[0] === 1);
  const pred = { ...playerFromRow(row) };
  const ctx = { arena: new Arena(h.arena.key, h.arena.encode()), wind: { x: 0, z: 0 }, frozen: false };
  for (const inp of inputs) { me.inp = inp; h.step(DT); stepPlayer(pred, inp, DT, ctx, null); }
  ok(Math.hypot(pred.x - me.x, pred.z - me.z) < 0.05, `la prédiction de l'invité suit l'hôte à ${Math.hypot(pred.x - me.x, pred.z - me.z).toFixed(3)} m près (ruée comprise)`);
}

console.log(fails ? `\n${fails} échec(s) sur ${count} vérifications` : `\nTout est bon (${count} vérifications)`);
process.exit(fails ? 1 : 0);
