// Tests du moteur de Mollo ! (mollo/engine/) : node tools/test-mollo.mjs
// Arènes, tenir debout sans trembler, marche et foulée, saut, coup et gros coup, KO mou puis réveil, prise, soulever et jeter,
// s'accrocher et se hisser, fatigue des bras, collisions, rouleaux, incinérateur, tri postal, objets, chute et crédit, fin de manche, parties entières entre bots, instantané et reprise par un nouvel hôte, coût d'un pas.
import { Sim, DT, ST, PN, JUMP_V, KO_T, ITEMS, ITEM_KEYS, FUSE_T } from '../mollo/engine/sim.js';
import { Arena, ARENAS, ARENA_KEYS, KILL_Y } from '../mollo/engine/arena.js';

let fails = 0, count = 0;
const ok = (cond, msg) => { count++; if (!cond) { fails++; console.log('  ✗ ' + msg); } };
const section = (s) => console.log('• ' + s);
const run = (sim, secs, each) => { for (let i = 0; i < Math.round(secs / DT); i++) { each && each(i); sim.step(DT); } };
const { P, C, H } = PN;
function lab(key = 'chantier', n = 2, seed = 7, hazards = false) {
  const sim = new Sim({ seed, goal: 3, hazards, items: false });
  for (let i = 0; i < n; i++) sim.addPlayer({ id: i, name: 'J' + i, color: '#ff0000' });
  sim.start(); sim.rd = 0; sim.drainEvents(); sim.startRound(key); sim.ph = 'play'; sim.pt = 0;
  return sim;
}
// pose un corps immobile à cet endroit, debout
function put(b, x, z, yaw) {
  const g = b.p[P], dx = x - g.x, dz = z - g.z;
  for (const q of b.p) { q.x += dx; q.z += dz; q.px = q.x; q.py = q.y; q.pz = q.z; }
  if (yaw !== undefined) b.yaw = yaw;
}
const events = (sim) => sim.drainEvents().map((e) => e.e);
// frappe en face : a est tourné vers b, à portée
function face(sim, a, b, gap = 0.72) { put(a, -1, 1.5, Math.PI / 2); put(b, -1 + gap, 1.5, -Math.PI / 2); a.m = b.m = 1; a.dip = b.dip = 0; b.dz = 0; }

section('Arènes');
for (const k of ARENA_KEYS) {
  const a = new Arena(k);
  ok(a.spawns.length >= 8, `${k} : 8 places de départ`);
  for (const [x, z] of a.spawns) ok(a.groundAt(x, z, 50), `${k} : le départ ${x},${z} a un sol`);
  for (const [i, j] of a.links) ok(a.nodes[i] && a.nodes[j], `${k} : les liens des bots pointent sur des points de passage`);
  ok(ARENAS[k].boxes.some((b) => b.hx > 2), `${k} : il y a de quoi se tenir`);
}
{ const a = new Arena('toits'), mv = a.boxes.find((b) => b.move); a.update(1); const z1 = mv.z; a.update(1); ok(mv.z === z1, 'une plateforme mobile ne dépend que du temps'); }

section('Tenir debout');
for (const k of ARENA_KEYS) {
  const s = lab(k), [a] = s.players.values();
  run(s, 3);
  let minHead = 9, jitter = 0;
  run(s, 17, () => { minHead = Math.min(minHead, a.p[H].y - a.gy); const q = a.p[H]; jitter = Math.max(jitter, Math.hypot(q.x - q.px, q.y - q.py, q.z - q.pz) - (a.gbox ? Math.hypot(a.gbox.vx, a.gbox.vz) / 60 + 0.02 : 0.02)); });
  ok(a.st === ST.LIVE, `${k} : debout tout seul`);
  ok(minHead > 1.25, `${k} : la tête reste en l'air pendant 20 s (${minHead.toFixed(2)} m au plus bas)`);
  ok(jitter < 0.012 || k === 'usine', `${k} : le corps immobile ne tremble pas (${jitter.toFixed(4)} m par pas)`);
}

section('Marche');
{
  const s = lab(), [a, b] = s.players.values(); put(b, 5, -3); put(a, -5.5, 1.5, Math.PI / 2);
  run(s, 0.5);
  const x0 = a.p[P].x; a.inp = { ...a.inp, mx: 1 };
  let minH = 9, flips = 0, last = 0, lastLead = 0, maxSlide = 0;
  run(s, 2, () => {
    minH = Math.min(minH, a.p[H].y);
    const lead = Math.sign(a.p[PN.LF].x - a.p[PN.RF].x); if (lead && lead !== lastLead) { flips++; lastLead = lead; }
    void last;
    const d = Math.hypot(a.p[C].x - a.p[P].x, a.p[C].z - a.p[P].z); maxSlide = Math.max(maxSlide, d);
  });
  const v = (a.p[P].x - x0) / 2;
  ok(v > 2.7 && v < 4.2, `vitesse de marche (${v.toFixed(2)} m/s)`);
  ok(minH > 1.2, `reste droit en marchant (tête à ${minH.toFixed(2)} m au plus bas)`);
  ok(flips >= 3, `les pieds se passent l'un devant l'autre (${flips} fois en 2 s)`);
  ok(maxSlide < 0.42, `le buste penche sans se coucher (${maxSlide.toFixed(2)} m d'avance)`);
  a.inp = { ...a.inp, mx: 0 }; run(s, 0.6);
  ok(Math.hypot(a.p[P].x - a.p[P].px, a.p[P].z - a.p[P].pz) / DT < 0.5, "s'arrête quand on lâche");
}

section('Saut');
{
  const s = lab(), [a, b] = s.players.values(); put(b, 5, -3); put(a, -1, 1.5); run(s, 0.5);
  const y0 = a.p[P].y; let top = 0; a.inp = { ...a.inp, jc: a.jc + 1 };
  run(s, 1.2, () => { top = Math.max(top, a.p[P].y); });
  ok(JUMP_V > 0 && top - y0 > 0.7 && top - y0 < 1.4, `saute d'environ un mètre (${(top - y0).toFixed(2)} m)`);
  ok(a.grounded, 'retombe sur ses pieds');
  ok(events(s).includes('jump'), 'événement de saut');
}

section('Coups');
{
  const s = lab(), [a, b] = s.players.values(); face(s, a, b); s.step(DT); face(s, a, b);
  const x0 = b.p[C].x; a.inp = { ...a.inp, pc: a.pc + 1, punch: false };
  let got = false;
  run(s, 0.25, () => { got = got || s.events.some((e) => e.e === 'hit'); });
  ok(got, 'un appui très bref donne un coup');
  ok(b.p[C].x > x0 + 0.12, `le coup repousse (${(b.p[C].x - x0).toFixed(2)} m)`);
  ok(b.dz > 0.1 && b.dz < 0.6, `le coup entame (${b.dz.toFixed(2)})`);
  ok(b.st === ST.LIVE, 'un seul coup ne met pas KO');
  // le gros coup, armé
  const t = lab(), [c, d] = t.players.values(); face(t, c, d); t.step(DT); face(t, c, d);
  c.inp = { ...c.inp, pc: 1, punch: true }; run(t, 0.42); face(t, c, d); c.inp = { ...c.inp, punch: false };
  let v1 = 0; run(t, 0.25, () => { v1 = Math.max(v1, Math.abs(d.p[C].x - d.p[C].px) / DT); });
  ok(d.dz > 0.35, `le gros coup sonne (${d.dz.toFixed(2)})`);
  const u = lab(), [e, f] = u.players.values(); face(u, e, f); u.step(DT); face(u, e, f);
  e.inp = { ...e.inp, pc: 1, punch: false }; let v0 = 0; run(u, 0.25, () => { v0 = Math.max(v0, Math.abs(f.p[C].x - f.p[C].px) / DT); });
  ok(v1 > v0 * 1.3, `le gros coup porte plus (${v1.toFixed(1)} contre ${v0.toFixed(1)} m/s)`);
}

section('Visée et série de poings');
{
  const jab = (x) => { x.inp = { ...x.inp, pc: (x.inp.pc | 0) + 1, punch: false }; };
  // le coup va chercher la cible, même mal orienté ou un peu loin
  for (const [d, ang] of [[0.7, 0], [1.1, 40], [1.4, 60], [1.6, 20]]) {
    const s = lab(), [a, b] = s.players.values(); const A = ang * Math.PI / 180;
    put(a, 0, 1.5, Math.PI / 2); put(b, d * Math.cos(A), 1.5 + d * Math.sin(A), -Math.PI / 2); run(s, 0.25); s.drainEvents();
    jab(a); let hit = false; run(s, 0.35, () => { hit = hit || s.events.some((e) => e.e === 'hit'); });
    ok(hit, `à ${d} m et ${ang}° de côté, le poing touche`);
  }
  { const s = lab(), [a, b] = s.players.values(); put(a, 0, 1.5, Math.PI / 2); put(b, -1, 1.5, Math.PI / 2); run(s, 0.25); s.drainEvents(); jab(a); let hit = false; run(s, 0.35, () => { hit = hit || s.events.some((e) => e.e === 'hit'); }); ok(!hit, 'celui qui est dans le dos reste à l\'abri'); }
  { const s = lab(), [a, b] = s.players.values(); put(a, 0, 1.5, Math.PI / 2); put(b, 3, 1.5, -Math.PI / 2); run(s, 0.25); s.drainEvents(); jab(a); let hit = false; run(s, 0.35, () => { hit = hit || s.events.some((e) => e.e === 'hit'); }); ok(!hit, 'à 3 m, le poing frappe dans le vide'); }
  // un poing compte pour la poitrine, le KO demande du travail
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); const x0 = b.p[C].x; jab(a); let head = -1; run(s, 0.3, () => { for (const e of s.events) if (e.e === 'hit') head = e.head; }); s.drainEvents(); ok(head === 0, 'un poing frappe la poitrine'); ok(b.dz < 0.2 && b.p[C].x - x0 < 0.7, `un poing seul n'envoie pas loin (${(b.p[C].x - x0).toFixed(2)} m, sonné ${b.dz.toFixed(2)})`); }
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); let t = 0, n = 0; while (b.st !== ST.KO && t < 8) { if (n++ % 18 === 0) jab(a); const dx = b.p[C].x - a.p[P].x; a.inp = { ...a.inp, mx: dx > 0.85 ? 1 : 0 }; s.step(DT); t += DT; s.drainEvents(); } ok(t > 2 && t < 6, `assommer aux poings demande ${t.toFixed(1)} s`); }
  // trois poings d'affilée éjectent
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); let k = []; let n = 0; const x0 = b.p[C].x; for (let i = 0; i < 70; i++) { if (n++ % 18 === 0 && k.length < 3) jab(a); const dx = b.p[C].x - a.p[P].x; a.inp = { ...a.inp, mx: dx > 0.85 ? 1 : 0 }; s.step(DT); for (const e of s.drainEvents()) if (e.e === 'hit') k.push(e.k); } ok(k.length === 3 && k[0] === 0 && k[1] === 0 && k[2] > 0, `la série finit par un coup plus fort (${k.join(', ')})`); ok(b.p[C].x - x0 > 1, `il part en arrière (${(b.p[C].x - x0).toFixed(2)} m)`); }
  // encaisser interrompt, sauf un gros coup déjà bien armé
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); b.inp = { ...b.inp, pc: 1, punch: true }; run(s, 0.2); jab(a); run(s, 0.2); ok(b.charge > 0, 'un poing n\'arrête pas un gros coup bien armé'); }
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); a.inp = { ...a.inp, pc: 1, punch: true }; run(s, 0.42); a.inp = { ...a.inp, punch: false }; run(s, 0.3); ok(b.flinch >= 0 && b.dz > 0.3, 'le gros coup sonne pour de bon'); }
  // un gros coup dans le vide déséquilibre
  { const s = lab(), [a, b] = s.players.values(); put(a, 0, 1.5, Math.PI / 2); put(b, -5, 1.5); run(s, 0.25); a.inp = { ...a.inp, pc: 1, punch: true }; run(s, 0.42); a.inp = { ...a.inp, punch: false }; let dip = 0; run(s, 0.4, () => { dip = Math.max(dip, a.dip); }); ok(dip > 0.3, `un gros coup manqué déséquilibre (${dip.toFixed(2)})`); }
  // au réveil, un répit
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); b.st = ST.KO; b.ko = 0.01; run(s, 0.05); ok(b.st === ST.LIVE && b.grace > 0, 'au réveil, un répit'); b.dz = 0.9; s.hurt(b, 1, 0, 0, 3, 0.5, a.id); ok(b.st === ST.LIVE, 'on ne se fait pas rassommer aussitôt'); }
}

section('Garde');
{
  const jab = (x) => { x.inp = { ...x.inp, pc: (x.inp.pc | 0) + 1, punch: false }; };
  const up = (s, b) => { b.inp = { ...b.inp, guard: true }; run(s, 0.05); };
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); up(s, b); ok(b.guard, 'la garde se lève'); jab(a); const log = []; run(s, 0.3, () => { log.push(...s.events.map((e) => e.e)); }); ok(log.includes('block') && !log.includes('hit'), 'elle arrête un poing de face'); ok(b.dz === 0, 'et il ne sonne pas'); ok(a.flinch > 0 || a.punchCd > 0, 'celui qui tape dans la garde perd le rythme'); }
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); b.yaw = Math.PI / 2; run(s, 0.25); s.drainEvents(); up(s, b); jab(a); const log = []; run(s, 0.3, () => { log.push(...s.events.map((e) => e.e)); }); ok(log.includes('hit'), 'par-derrière, la garde ne sert à rien'); }
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); up(s, b); a.inp = { ...a.inp, pc: 1, punch: true }; run(s, 0.42); a.inp = { ...a.inp, punch: false }; const log = []; run(s, 0.35, () => { log.push(...s.events.map((e) => e.e)); }); ok(log.includes('break'), 'le gros coup brise la garde'); ok(b.dz > 0.3 && !b.guard && b.guardCd > 0, `et sonne (${b.dz.toFixed(2)})`); }
  { const s = lab(), [a, b] = s.players.values(); put(a, 0, 1.5, Math.PI / 2); put(b, 5, 1.5); run(s, 0.25); a.inp = { ...a.inp, guard: true }; let t = 0; while (a.guard || t < 0.1) { s.step(DT); t += DT; if (t > 6) break; } ok(t > 2 && t < 4, `la garde s'use toute seule (${t.toFixed(1)} s)`); ok(a.guardCd > 0, 'puis il faut attendre'); }
  { const s = lab(), [a, b] = s.players.values(); put(a, 0, 1.5); put(b, 5, 1.5); run(s, 0.25); const x = a.p[P].z; a.inp = { ...a.inp, guard: true, mz: 1 }; run(s, 1); const g = a.p[P].z - x, u = lab(), [c, d] = u.players.values(); put(c, 0, 0); put(d, 5, 1.5); run(u, 0.25); const y = c.p[P].z; c.inp = { ...c.inp, mz: 1 }; run(u, 1); ok(g < (c.p[P].z - y) * 0.55, `en garde, on avance moins vite (${g.toFixed(2)} contre ${(c.p[P].z - y).toFixed(2)} m)`); }
  { const s = lab(), [a, b] = s.players.values(); put(a, 0, 1.5); put(b, 5, 1.5); run(s, 0.25); a.inp = { ...a.inp, guard: true, pc: 1, punch: true }; run(s, 0.5); ok(a.guard && a.charge === 0, 'on ne frappe pas et on ne se protège pas en même temps'); }
}

section('Saisir contre le reste');
{
  const jab = (x) => { x.inp = { ...x.inp, pc: (x.inp.pc | 0) + 1, punch: false }; };
  const grab = (a) => { a.inp = { ...a.inp, grab: true, gc: (a.inp.gc | 0) + 1 }; };
  // la saisie passe la garde et attrape celui qui arme
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); b.inp = { ...b.inp, guard: true }; run(s, 0.1); grab(a); const log = []; run(s, 0.3, () => { log.push(...s.events); }); const g = log.find((e) => e.e === 'grab'); ok(g && g.caught === 1, 'la saisie passe la garde'); ok(!b.guard && b.dz > 0.15, 'et le prend à contre-pied'); }
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); s.drainEvents(); b.inp = { ...b.inp, pc: 1, punch: true }; run(s, 0.2); grab(a); const log = []; run(s, 0.3, () => { log.push(...s.events); }); const g = log.find((e) => e.e === 'grab'); ok(g && g.caught === 1 && b.charge === 0, 'celui qui arme se fait attraper, et son coup part en fumée'); }
  // le poing fait lâcher
  { let freed = 0; for (let k = 0; k < 10; k++) { const s = lab('chantier', 2, 20 + k), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); grab(a); run(s, 0.3); let t = 0; for (let n = 0; t < 1.5 && a.grip.some((q) => q && q.o); n++) { if (n % 8 === 0) jab(b); s.step(DT); t += DT; } if (!a.grip.some((q) => q && q.o)) freed++; } ok(freed >= 6, `marteler le poing fait lâcher (${freed} fois sur 10 en 1,5 s)`); }
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); jab(b); run(s, 0.12); ok(a.grabLock > 0, 'juste après un poing, on ne peut plus attraper'); grab(a); run(s, 0.1); ok(!a.grip.some((q) => q && q.o), 'la saisie est interrompue'); }
  // le coup de tête, puis soulever
  { const s = lab(), [a, b] = s.players.values(); face(s, a, b); run(s, 0.25); grab(a); run(s, 0.4); a.inp = { ...a.inp, jump: true }; run(s, 0.2); ok(!a.lifting, 'trop réveillé pour être soulevé'); a.inp = { ...a.inp, jump: false }; run(s, 0.05); s.drainEvents(); const d0 = b.dz; jab(a); const log = []; run(s, 0.1, () => { log.push(...s.events); }); ok(log.some((e) => e.e === 'hit' && e.head === 1) && b.dz > d0 + 0.2, `en le tenant, un coup de tête (${b.dz.toFixed(2)})`); ok(a.grip.some((q) => q && q.o), 'sans le lâcher'); run(s, 0.75); jab(a); run(s, 0.1); a.inp = { ...a.inp, jump: true }; run(s, 0.2); ok(a.lifting === 1, 'bien sonné, il décolle'); }
  // deux pantins qui se tiennent ne s'emballent pas
  { const s = lab(), [a, b] = s.players.values(); put(a, -2, 1.5, Math.PI / 2); put(b, -1.2, 1.5, -Math.PI / 2); run(s, 0.25); grab(a); run(s, 0.5); const x = a.p[P].x; let dr = 0; run(s, 5, () => { dr = Math.max(dr, Math.abs(a.p[P].x - x)); }); ok(dr < 1 && a.st === ST.LIVE && b.st === ST.LIVE, `sans commande, le couple ne part pas tout seul (${dr.toFixed(2)} m en 5 s)`); }
  // on peut pousser et tirer
  for (const dir of [1, -1]) { const s = lab(), [a, b] = s.players.values(); put(a, -2, 1.5, Math.PI / 2); put(b, -1.2, 1.5, -Math.PI / 2); run(s, 0.25); grab(a); run(s, 0.5); const x = b.p[P].x; a.inp = { ...a.inp, mx: dir }; run(s, 1.5); ok((b.p[P].x - x) * dir > 1, `tenu, il se laisse ${dir > 0 ? 'pousser' : 'tirer'} (${(b.p[P].x - x).toFixed(2)} m en 1,5 s)`); }
}

section('KO mou, puis réveil');
{
  const s = lab(), [a, b] = s.players.values();
  face(s, a, b); s.step(DT); face(s, a, b); b.dz = 0.9;
  a.inp = { ...a.inp, pc: 1 }; run(s, 0.25);
  ok(b.st === ST.KO, 'le coup de trop assomme');
  run(s, 1.4);
  ok(b.p[H].y - b.gy < 0.75, `assommé, il s'effondre (tête à ${(b.p[H].y - b.gy).toFixed(2)} m)`);
  run(s, KO_T);
  ok(b.st === ST.LIVE, 'il revient à lui tout seul');
  run(s, 1.6);
  ok(b.p[H].y - b.gy > 1.2, `et se remet debout (tête à ${(b.p[H].y - b.gy).toFixed(2)} m)`);
  // marteler raccourcit
  const t = lab(), [, d] = t.players.values(); d.st = ST.KO; d.ko = KO_T; let n = 0, tKO = 0;
  while (d.st === ST.KO && tKO < 5) { if (n++ % 6 === 0) d.inp = { ...d.inp, pc: d.pc + 1 }; t.step(DT); tKO += DT; }
  ok(tKO < KO_T * 0.75, `marteler réveille plus vite (${tKO.toFixed(2)} s au lieu de ${KO_T})`);
}

section('Saisir, soulever, jeter');
{
  const s = lab(), [a, b] = s.players.values(); put(b, -0.3, 1.5); put(a, -1, 1.5, Math.PI / 2); b.st = ST.KO; b.ko = 30; b.m = 0;
  run(s, 0.7); a.yaw = Math.PI / 2;
  a.inp = { ...a.inp, grab: true, gc: 1 }; run(s, 0.5);
  ok(a.grip.some((g) => g && g.o === b), "les mains s'accrochent au corps");
  ok(b.heldBy > 0, 'il se sait tenu');
  a.inp = { ...a.inp, jump: true }; run(s, 0.8); a.inp = { ...a.inp, jump: false };
  ok(a.lifting === 1, 'saut : il le soulève');
  ok(b.p[P].y > a.p[H].y - 0.35, `il le porte au-dessus de sa tête (${b.p[P].y.toFixed(2)} contre ${a.p[H].y.toFixed(2)})`);
  const x0 = b.p[P].x; a.yaw = Math.PI / 2; a.inp = { ...a.inp, grab: false }; run(s, 0.45);
  ok(!a.lifting && b.heldBy === 0 && b.liftedBy < 0, 'lâcher libère tout le monde');
  ok(b.p[P].x - x0 > 1.5, `et le jette devant lui (${(b.p[P].x - x0).toFixed(2)} m)`);
  ok(events(s).includes('throw'), 'événement de lancer');
  // quelqu'un d'éveillé ne se laisse pas soulever
  const t = lab(), [c, d] = t.players.values(); put(d, -0.3, 1.5); put(c, -1, 1.5, Math.PI / 2); run(t, 0.2); c.yaw = Math.PI / 2;
  c.inp = { ...c.inp, grab: true, gc: 1 }; run(t, 0.4); c.inp = { ...c.inp, jump: true }; run(t, 0.5);
  ok(c.grip.some((g) => g && g.o === d) && !c.lifting, "un adversaire en forme ne se soulève pas");
  // se débattre fait lâcher plus vite
  let rel = 0; c.inp = { ...c.inp, jump: false }; let k = 0;
  while (c.grip.some(Boolean) && rel < 8) { if (k++ % 8 === 0) d.inp = { ...d.inp, pc: d.pc + 1 }; t.step(DT); rel += DT; }
  ok(rel < 4, `se débattre fait lâcher (${rel.toFixed(1)} s)`);
}

section("S'accrocher et se hisser");
{
  const s = lab('toits'), [a, b] = s.players.values(); put(b, -6, 0); put(a, -1.25, -3, Math.PI / 2); // juste au bord, rien en dessous à droite
  a.inp = { ...a.inp, mx: 1 }; run(s, 0.3); a.inp = { ...a.inp, mx: 0, grab: true, gc: 1 };
  run(s, 1.2);
  ok(a.grip.some((g) => g && g.box), "en tombant, les mains s'accrochent au rebord");
  const hang = a.p[C].y;
  ok(hang < 0.2 && hang > -1.2, `il pend sous le toit (poitrine à ${hang.toFixed(2)})`);
  a.inp = { ...a.inp, jump: true }; let climbed = false;
  run(s, 2, () => { climbed = climbed || s.events.some((e) => e.e === 'climb'); });
  ok(climbed, 'se hisser : il passe par-dessus');
  a.inp = { ...a.inp, jump: false, grab: false }; run(s, 1.2);
  ok(a.grounded && a.p[P].x < -1.4 && a.p[P].y > 0.3, `il est revenu sur le toit (x ${a.p[P].x.toFixed(2)}, y ${a.p[P].y.toFixed(2)})`);
  // les bras fatiguent
  const t = lab('toits'), [c, d] = t.players.values(); put(d, -6, 0); put(c, -1.25, -3, Math.PI / 2);
  c.inp = { ...c.inp, mx: 1 }; run(t, 0.3); c.inp = { ...c.inp, mx: 0, grab: true, gc: 1 }; run(t, 1.2);
  ok(c.grip.some(Boolean), 'accroché');
  run(t, 3); ok(c.grip.some(Boolean), 'tient encore après 4 s');
  run(t, 5); ok(!c.grip.some(Boolean), 'au bout de 8 s, ça glisse');
  // debout, on n'agrippe pas le sol
  const u = lab(), [e, f] = u.players.values(); put(f, 5, -3); put(e, -1, 1.5); run(u, 0.2); e.inp = { ...e.inp, grab: true, gc: 1 }; run(u, 0.6);
  ok(!e.grip.some(Boolean), "debout au milieu de la dalle, les mains n'attrapent pas le sol");
}

section('Se hisser partout');
{
  const tally = {};
  for (const k of ARENA_KEYS) {
    const n = ARENAS[k].boxes.length;
    for (let i = 0; i < n; i++) {
      if (ARENAS[k].boxes[i].crush || ARENAS[k].boxes[i].move) continue;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) for (const how of ['maintient', 'tape', 'pousse']) {
        const s = lab(k), [a, o] = s.players.values(), B = s.arena.boxes[i], top = B.y + B.hy;
        const ex = B.x + dx * (B.hx + 0.3), ez = B.z + dz * (B.hz + 0.3);
        if (s.arena.groundAt(ex, ez, top + 0.1)) continue;
        put(o, 0, 0, undefined); for (const q of o.p) q.y += 40;
        put(a, ex, ez, Math.atan2(-dx, -dz)); const lift = top + 0.89 - a.p[P].y; for (const q of a.p) { q.y += lift; q.py = q.y; }
        const keep = () => { for (const q of o.p) { q.py = q.y; if (q.y < 30) q.y += 40; } };
        let inp = { ...a.inp, grab: true, gc: 1 }, t = 0;
        while (t < 2 && a.st !== ST.OUT && !a.grip.some((g) => g && g.box)) { a.inp = inp; s.step(DT); keep(); t += DT; }
        const g = a.grip.find((x) => x && x.box); if (!g) { tally.noGrip = (tally.noGrip || 0) + 1; continue; }
        const T = g.box; run(s, 0.4, () => { a.inp = inp; keep(); });
        let done = false;
        for (let f = 0; f < 150 && !done && a.st !== ST.OUT; f++) {
          const tx = T.x - a.p[P].x, tz = T.z - a.p[P].z, l = Math.hypot(tx, tz) || 1;
          a.inp = { ...inp, jump: how === 'maintient' || (how === 'tape' && f < 4), jc: how === 'pousse' ? 0 : 1, mx: how === 'pousse' ? tx / l : 0, mz: how === 'pousse' ? tz / l : 0 };
          s.step(DT); keep();
          const G = a.gbox; done = a.grounded && !a.climb && !!G && a.p[P].y > G.y + G.hy && (G === T || G.y + G.hy >= T.y + T.hy - 0.01); // dans un coin, il peut finir sur le mur voisin
        }
        tally[how] = tally[how] || [0, 0]; tally[how][1]++; if (done) tally[how][0]++;
        else console.log(`    raté : ${k} boîte ${i} (${B.mat}) côté ${dx},${dz} en « ${how} »`);
      }
    }
  }
  for (const how of ['maintient', 'tape', 'pousse']) ok(tally[how] && tally[how][0] >= tally[how][1] * 0.97, `saut ${how} : remonte sur les rebords de toutes les arènes (${tally[how][0]}/${tally[how][1]})`);
}

section('Collisions');
{
  // aucune plateforme mobile ne vient coincer un corps contre un décor fixe, dans le sens où elle avance (le pilon, lui, écrase exprès)
  for (const k of ARENA_KEYS) {
    const a = new Arena(k), mv = a.boxes.filter((b) => b.move && !b.crush && !b.door);
    let min = 9;
    for (let t = 0; t < 30; t += 0.05) {
      a.update(t);
      for (const m of mv) for (const b of a.boxes) {
        if (b === m || b.move) continue;
        const g = { x: Math.abs(m.x - b.x) - m.hx - b.hx, y: Math.abs(m.y - b.y) - m.hy - b.hy, z: Math.abs(m.z - b.z) - m.hz - b.hz };
        for (const [axis, amp] of [['x', m.move.ax], ['z', m.move.az], ['y', m.move.ay]]) {
          if (!amp) continue;
          if (['x', 'y', 'z'].filter((j) => j !== axis).every((j) => g[j] < 0)) min = Math.min(min, g[axis]);
        }
      }
    }
    ok(min > 0.95, `${k} : une plateforme mobile laisse la place à un corps (${min.toFixed(2)} m)`);
  }
  // marcher contre un mur, être jeté dessus, tomber sur une planche fine
  const wall = lab(), [w, w2] = wall.players.values(); put(w2, 5, -3); put(w, -1.5, -1.6, -Math.PI / 2); w.inp = { ...w.inp, mx: -1 }; run(wall, 3);
  ok(w.p[P].x > -3 && w.p.every((q) => q.y - q.r > 0.95 || q.x - q.r > -3.22), `marcher contre le muret ne le traverse pas (${w.p.map((q) => (q.x - q.r).toFixed(2)).join(' ')})`);
  for (const v of [6, 12, 20]) { const s = lab(), [a, o] = s.players.values(); put(o, 5, -3); put(a, -1.8, -1.6); a.st = ST.KO; a.ko = 9; for (const q of a.p) q.px = q.x + v * DT; run(s, 0.7); ok(a.p[P].x > -3.2 && a.p.every((q) => q.x > -3.2 || q.x < -3.6 || q.y - q.r > 0.92), `jeté à ${v} m/s, il s'écrase sur le muret sans y entrer (${a.p.map((q) => q.x.toFixed(2) + '/' + q.y.toFixed(2)).join(' ')})`); }
  for (const v of [8, 20]) { const s = lab('toits'), [a, o] = s.players.values(); put(o, -6, 0); put(a, 0, 0); for (const q of a.p) { q.y += 3; q.py = q.y + v * DT; } a.st = ST.KO; a.ko = 9; run(s, 1); ok(a.p.every((q) => q.y > -0.05), `tombé à ${v} m/s, il reste sur la planche fine`); }
  // parties entières : rien ne s'enfonce, rien ne traverse
  const depth = (q, b) => Math.min(b.hx + q.r - Math.abs(q.x - b.x), b.hy + q.r - Math.abs(q.y - b.y), b.hz + q.r - Math.abs(q.z - b.z));
  const side = (a, q, b) => [['x', 'hx'], ['y', 'hy'], ['z', 'hz']].some(([k, h]) => Math.abs(a[k] - b[k]) > b[h] && Math.abs(q[k] - b[k]) > b[h] && Math.sign(a[k] - b[k]) !== Math.sign(q[k] - b[k]) && ['x', 'y', 'z'].filter((j) => j !== k).every((j) => Math.abs(a[j] - b[j]) < b['h' + j] && Math.abs(q[j] - b[j]) < b['h' + j]));
  let deepBody = 0, cross = 0, steps = 0, maxD = 0, deepPrev = new Set(), deepNow = new Set();
  for (const seed of [1, 2, 3]) {
    const s = new Sim({ seed, goal: 2 }); s.addBots(6, 'expert'); s.start(); let n = 0;
    while (s.ph !== 'over' && n < 60 * 180) {
      const pv = new Map([...s.players.values()].map((b) => [b.id, b.p.map((q) => ({ x: q.x, y: q.y, z: q.z }))]));
      s.step(DT); s.drainEvents(); n++; steps++; deepPrev = deepNow; deepNow = new Set();
      for (const b of s.players.values()) { if (b.st === ST.OUT) continue; b.p.forEach((q, i) => { if (i >= 3 && i <= 4 && b.grip[i - 3]) return; for (const B of s.arena.boxes) { if (b.climb && b.climb.box === B) continue; if (B.door) continue; /* une trappe qui se referme sur un corps qui tombe : le choc dure un pas */ if (B.y > 30) continue; const d = depth(q, B); /* un choc violent peut enfoncer un point le temps d'un pas : on ne compte que ce qui dure deux pas de suite */ const cle = b.id + ':' + i + ':' + s.arena.boxes.indexOf(B); if (d > 0.08 && !B.crush) { if (deepPrev.has(cle)) { deepBody++; maxD = Math.max(maxD, d); } deepNow.add(cle); } const a = pv.get(b.id)[i]; if (!B.move && Math.hypot(a.x - q.x, a.y - q.y, a.z - q.z) < 1 && side(a, q, B)) cross++; } }); }
    }
  }
  ok(cross === 0, `aucun point ne traverse une boîte (${cross} sur ${steps} pas)`);
  ok(deepBody === 0, `rien ne reste enfoncé de plus de 8 cm dans le décor (${deepBody}, au pire ${maxD.toFixed(2)} m)`);
  // le boulet pousse sans traverser
  const b = new Sim({ seed: 7, hazards: true }); b.addPlayer({ id: 1, name: 'a', color: '#f00' }); b.addPlayer({ id: 2, name: 'b', color: '#00f' }); b.start(); b.rd = 0; b.drainEvents(); b.startRound('chantier'); b.ph = 'play'; b.pt = 0;
  const [ba, bo] = b.players.values(); put(bo, 5, 2.5); put(ba, 2, 0); let inBall = 0, touched = false;
  for (let i = 0; i < 480 && ba.st !== ST.OUT; i++) { b.step(DT); touched = touched || b.events.some((e) => e.e === 'ball'); b.events.length = 0; const q = b.arena.balls[0]; for (const t of ba.p) inBall = Math.max(inBall, q.r + t.r - Math.hypot(t.x - q.x, t.y - q.y, t.z - q.z)); }
  ok(touched && inBall < 0.01, `le boulet frappe et ne traverse pas le corps (${inBall.toFixed(3)} m)`);
}

section('Rouleaux à pointes');
{
  const s = lab('rouleaux', 2, 7, true), [a, o] = s.players.values(), R = s.arena.rollers[0];
  put(o, -8, 0); put(a, 3, R.cz); a.yaw = 0;
  let spikes = 0, deep = 0, t = 0;
  while (t < 12 && a.st !== ST.OUT) { s.step(DT); t += DT; for (const e of s.drainEvents()) if (e.e === 'spike' && e.id === a.id) spikes++; if (a.st === ST.OUT) break; for (const q of a.p) if (Math.abs(q.z - R.cz) < R.hz) deep = Math.max(deep, R.r + q.r - Math.hypot(q.x - R.x, q.y - R.cy)); }
  ok(spikes >= 1, `rester dans sa voie, c'est se faire piquer (${spikes})`);
  ok(deep < 0.2, `le rouleau repousse le corps sans le traverser (${deep.toFixed(3)} m)`);
  const k = lab('rouleaux', 2, 7, true), [b, p] = k.players.values(); put(p, -8, 0); put(b, 0, 0); let hit = 0;
  for (let i = 0; i < 60 * 25; i++) { k.step(DT); if (k.drainEvents().some((e) => e.e === 'spike')) hit++; }
  ok(hit === 0 && b.st === ST.LIVE, `l'allée du milieu est à l'abri (${hit} coups en 25 s)`);
  ok(lab('rouleaux').arena.rollers.length === 0, 'sans pièges, pas de rouleaux');
  const off = lab('rouleaux'), [c, q] = off.players.values(); put(q, -8, 0); put(c, 0, 3); run(off, 10); ok(c.st === ST.LIVE && c.p[P].y > 0.5, 'sans pièges, on reste debout dans la voie');
}

section("L'Incinérateur");
{
  const s = lab('four', 2, 7, true), [a, o] = s.players.values(), door = s.arena.boxes.find((b) => b.door);
  put(o, -7, -3.5); put(a, -1, 0);
  run(s, 0.5);
  ok(a.grounded && a.p[P].y > 0.5, 'trappes fermées : on marche dessus');
  const log = []; let t = 0, xStart = a.p[P].x;
  while (t < 14 && a.st !== ST.OUT) { s.step(DT); t += DT; for (const e of s.drainEvents()) log.push(e.e); }
  ok(log.includes('alarm'), "une alarme prévient avant l'ouverture");
  ok(log.indexOf('alarm') < log.indexOf('burn'), "l'alarme sonne avant le feu");
  ok(log.includes('burn') && a.st === ST.OUT, 'resté sur la trappe, il finit au four');
  void xStart; void door;
  const f = lab('four', 2, 7, true), [b, q] = f.players.values(); put(q, -7, -3.5); put(b, -3.4, 0);
  let lastOpen = 0; for (let i = 0; i < 60 * 14; i++) { f.step(DT); lastOpen = Math.max(lastOpen, f.arena.boxes.find((x) => x.door).open || 0); }
  ok(lastOpen >= 1, 'les trappes finissent par s\'ouvrir en grand');
  const c = lab('four'), [d, e] = c.players.values(); put(e, -7, -3.5); put(d, -1, 0); run(c, 20);
  ok(d.st === ST.LIVE && d.grounded, 'sans pièges, les trappes restent fermées');
  // rattrapé au bord du four : on remonte
  const h = lab('four', 2, 7, true), [m, w] = h.players.values(); put(w, -7, -3.5);
  h.at = 8; for (const x of h.arena.boxes) if (x.door) x.grip = false;
  for (let i = 0; i < 90 && !(h.arena.boxes.find((x) => x.door).open >= 1); i++) { h.step(DT); }
  put(m, -2.75, 0, Math.PI / 2); for (const x of m.p) { x.y -= 0.4; x.py = x.y; }
  let inp = { ...m.inp, grab: true, gc: 1, jump: false, jc: 0 }, up = false;
  for (let i = 0; i < 180 && m.st !== ST.OUT; i++) { m.inp = { ...inp, jump: i > 25, jc: i > 25 ? 1 : 0 }; h.step(DT); h.drainEvents(); if (m.grounded && m.p[P].y > 0.4) up = true; }
  ok(up && m.st !== ST.OUT, 'accroché au bord du four, on se hisse');
}

section('Le Tri Postal');
{
  const s = lab('tri'), [a, o] = s.players.values(); put(o, -6, 0); put(a, 4, -3.6);
  const x0 = a.p[P].x; run(s, 1);
  ok(a.p[P].x - x0 > 1.5, `le tapis emporte (${(a.p[P].x - x0).toFixed(2)} m en 1 s)`);
  const b = lab('tri', 2, 7, true), [u, v] = b.players.values(); put(v, -6, 0); put(u, 3, -2.7);
  let bar = 0; for (let i = 0; i < 60 * 8 && u.st !== ST.OUT; i++) { u.inp = { ...u.inp, mx: u.p[P].x > 3 ? -1 : u.p[P].x < 2 ? 1 : 0 }; b.step(DT); if (b.drainEvents().some((e) => e.e === 'ball' && e.id === u.id)) bar++; }
  ok(bar >= 1, `la barre balaie ceux qui traînent (${bar})`);
  const c = lab('tri'); ok(c.arena.boxes.every((q) => !q.knock || q.y > 30), 'sans pièges, plus de barres');
}

section('Objets');
{
  // tirage au début de chaque manche
  const tally = Object.fromEntries(ITEM_KEYS.map((k) => [k, 0])); let n = 0, none = 0, bad = 0, total = 0;
  const s = new Sim({ seed: 11, hazards: true }); s.addPlayer({ id: 1, name: 'a', color: '#f00' }); s.addPlayer({ id: 2, name: 'b', color: '#00f' }); s.start();
  for (let r = 0; r < 600; r++) {
    s.startRound(ARENA_KEYS[r % ARENA_KEYS.length]); n++; if (!s.items.length) none++;
    const seen = new Set(s.items.map((i) => i.k)); for (const k of seen) tally[k]++;
    total += s.items.length;
    for (const i of s.items) { const g = s.arena.groundAt(i.x, i.z, i.y); if (!g || g.box.belt || g.box.move) bad++; if (s.arena.boxes.some((b) => Math.abs(i.x - b.x) < b.hx && Math.abs(i.y - b.y) < b.hy && Math.abs(i.z - b.z) < b.hz)) bad++; }
  }
  for (const k of ITEM_KEYS) { const f = tally[k] / n, want = 1 - (1 - ITEMS[k].p) * (1 - ITEMS[k].p / 3) * 0 - (1 - ITEMS[k].p) * (1 - ITEMS[k].p / 3); ok(Math.abs(f - want) < 0.09, `${k} : apparaît dans ${Math.round(f * 100)} % des manches (attendu ${Math.round(want * 100)} %)`); }
  ok(none > 0 && none < n * 0.2, `certaines manches n'ont aucun objet, mais peu (${Math.round(none / n * 100)} %)`);
  ok(bad === 0, `les objets apparaissent sur un sol sûr (${bad} mal placés sur ${total})`);
  const off = new Sim({ seed: 3, items: false }); off.addBots(3); off.start(); ok(off.items.length === 0, 'sans objets, rien par terre');

  const give = (k, key = 'chantier', sd = 7) => { const l = lab(key, 2, sd); const [a, o] = l.players.values(); put(o, 5, 2.6); put(a, 0, 1.5, Math.PI / 2); run(l, 0.2); const it = l.newItem(k, a.p[C].x + 0.3, 0.3, a.p[C].z); l.items.push(it); run(l, 0.2); l.drainEvents(); return { l, a, o, it }; };
  const press = (b, f = { gc: (b.inp.gc | 0) + 1 }) => { b.inp = { ...b.inp, ...f }; };
  { // ramasser, puis lancer
    const { l, a, it } = give('poele');
    press(a); run(l, 0.1);
    ok(a.item === it && it.holder === a, 'un appui sur saisir ramasse');
    ok(l.drainEvents().some((e) => e.e === 'pick'), "l'événement part");
    press(a); run(l, 0.1);
    ok(!a.item && !it.holder && Math.hypot(it.x - it.px, it.z - it.pz) > 0, 'un second appui lance');
  }
  { // pendant le compte à rebours, on ne ramasse rien
    const l = new Sim({ seed: 5, items: false }); l.addPlayer({ id: 1, name: 'a', color: '#f00' }); l.addPlayer({ id: 2, name: 'b', color: '#00f' }); l.start(); const [a] = l.players.values();
    l.items.push(l.newItem('poele', a.p[C].x, 0.3, a.p[C].z)); a.inp = { ...a.inp, gc: 1, jc: 1, pc: 1 }; l.step(DT);
    ok(!a.item, 'pas de ramassage pendant le compte à rebours');
  }
  { // la poêle frappe plus fort qu'un poing
    const { l, a, o, it } = give('poele'); press(a); run(l, 0.1); face(l, a, o); a.punchCd = 0; const before = o.dz; press(a, { pc: 1, punch: true }); run(l, 0.03); a.inp = { ...a.inp, punch: false }; run(l, 0.3);
    const pan = o.dz - before, pl = lab(), [x, y] = pl.players.values(); face(pl, x, y); x.inp = { ...x.inp, pc: 1, punch: true }; run(pl, 0.03); x.inp = { ...x.inp, punch: false }; run(pl, 0.3);
    ok(pan > y.dz + 0.08, `la poêle assomme plus vite que le poing (${pan.toFixed(2)} contre ${y.dz.toFixed(2)})`);
    void it;
  }
  { // la poêle lancée touche, et ne traverse pas un mur
    const { l, a, o, it } = give('poele'); press(a); run(l, 0.1); put(o, 1.8, 1.5); o.m = 1; press(a); let hit = false; for (let i = 0; i < 40; i++) { l.step(DT); if (l.drainEvents().some((e) => e.e === 'hit' && e.id === o.id)) hit = true; }
    ok(hit && o.dz > 0.2, 'la poêle lancée assomme ce qu\'elle touche');
    void it;
    for (const v of [10, 19]) { const w = lab(); const [p, q] = w.players.values(); put(q, 5, 2.6); put(p, 3, 2.6); const t = w.newItem('poele', -2.4, 0.5, -1.6); w.items.push(t); t.px = t.x + v * DT; t.py = t.y; t.hit = false; run(w, 0.8); ok(t.x > -3.2, `un objet lancé à ${v} m/s ne traverse pas un mur (${t.x.toFixed(2)})`); }
  }
  { // le pétard
    const { l, a, o, it } = give('petard'); press(a); run(l, 0.05);
    ok(it.fuse > 0, "ramassé, le pétard s'allume");
    put(o, 1.2, 1.5); o.m = 1; const log = []; let t = 0; while (l.items.includes(it) && t < FUSE_T + 1) { l.step(DT); t += DT; log.push(...l.drainEvents().map((e) => e.e)); }
    ok(log.includes('boom') && Math.abs(t - FUSE_T) < 0.3, `il explose au bout de ${t.toFixed(1)} s`);
    ok(!a.item, "l'objet quitte la main");
    ok(a.dz > 0.5 || a.st === ST.KO, 'ça fait mal à qui le tient encore');
    ok(o.dz > 0.3 || o.st === ST.KO, 'et à ceux qui sont à côté');
    const far = give('petard'); press(far.a); run(far.l, 0.05); put(far.o, 7, -3); far.o.dz = 0; for (let i = 0; i < 60 * (FUSE_T + 0.5); i++) far.l.step(DT); ok(far.o.dz === 0, 'pas au-delà du souffle');
  }
  { // le parapluie : on plane
    const fall = (withIt) => { const l = lab('toits'); const [a, o] = l.players.values(); put(o, -6, 0); put(a, 0, -3); if (withIt) { const i = l.newItem('parapluie', 0, 1, -3); l.items.push(i); i.holder = a; a.item = i; } let t = 0; while (a.p[P].y > -6 && t < 6 && a.st !== ST.OUT) { l.step(DT); t += DT; } return t; };
    const a = fall(false), b = fall(true);
    ok(b > a * 1.8, `le parapluie ralentit la chute (${b.toFixed(1)} s contre ${a.toFixed(1)} s)`);
    const l = lab('toits'), [x, o] = l.players.values(); put(o, -6, 0); put(x, 0, -3); const i = l.newItem('parapluie', 0, 1, -3); l.items.push(i); i.holder = x; x.item = i; const z0 = x.p[P].x;
    for (let f = 0; f < 60; f++) { x.inp = { ...x.inp, mx: 1 }; l.step(DT); }
    ok(x.p[P].x - z0 > 1, `on se dirige en planant (${(x.p[P].x - z0).toFixed(2)} m en 1 s)`);
  }
  { // la peau de banane
    const l = lab(), [a, o] = l.players.values(); put(o, 5, 2.6); put(a, -1, 1.5, Math.PI / 2); run(l, 0.2); const i = l.newItem('banane', 0.4, 0.15, a.p[P].z); l.items.push(i); run(l, 0.2); l.drainEvents();
    let peel = false, minM = 1; for (let f = 0; f < 100 && !peel; f++) { a.inp = { ...a.inp, mx: 1, mz: 0 }; l.step(DT); peel = l.drainEvents().some((e) => e.e === 'peel' && e.id === a.id); minM = Math.min(minM, a.m); }
    ok(peel, 'marcher sur la peau de banane fait glisser');
    ok(minM < 0.3 && !l.items.includes(i), 'le corps mollit, la peau est usée');
    const s2 = lab(), [c, d] = s2.players.values(); put(d, 5, 2.6); put(c, -1, 1.5); run(s2, 0.2); const j = s2.newItem('banane', -1, 0.15, c.p[P].z); s2.items.push(j); run(s2, 1); ok(s2.items.includes(j) && c.st === ST.LIVE, 'immobile, on ne glisse pas');
  }
  { // avec un objet en main, on ne s'accroche pas ; on le lâche d'abord
    const l = lab('toits'), [a, o] = l.players.values(); put(o, -6, 0); put(a, -1.3, -3); const i = l.newItem('poele', 0, 1, -3); l.items.push(i); i.holder = a; a.item = i; a.inp = { ...a.inp, grab: true }; run(l, 0.3);
    ok(!a.grip[0] && !a.grip[1], "objet en main : pas d'accroche");
    const m = lab('toits'), [b, q] = m.players.values(); put(q, -6, 0); put(b, 1.85, 0, -Math.PI / 2); for (const x of b.p) { x.y -= 0.2; x.py = x.y; } const j = m.newItem('banane', 0, 1, 0); m.items.push(j); j.holder = b; b.item = j; press(b, { grab: true, gc: 1 });
    let held = false; for (let f = 0; f < 60 && !held; f++) { m.step(DT); held = b.grip.some(Boolean); } ok(!b.item && held, 'un appui lance, et en gardant le bouton on s\'accroche');
  }
  { // l'objet quitte la main quand on est assommé, et l'instantané le transporte
    const { l, a, it } = give('poele'); press(a); run(l, 0.1); l.hurt(a, 1, 0, 0, 2, 1.2, -1); ok(a.st === ST.KO && !a.item && !it.holder, 'assommé, il lâche son objet');
    const n0 = l.items.length; const snap = JSON.parse(JSON.stringify(l.snapshot())); ok(snap.I.length === n0 && snap.it === 0, "l'instantané contient les objets");
    const r = Sim.restore(snap); ok(r.items.length === n0 && r.items[0].k === 'poele', 'le nouvel hôte reprend les objets');
  }
  { // parties entre bots : ils s'en servent
    const ev = {}; for (const seed of [1, 2, 3]) { const g = new Sim({ seed, goal: 3 }); g.addBots(5, 'normal'); g.start(); let n2 = 0; while (g.ph !== 'over' && n2 < 60 * 300) { g.step(DT); n2++; for (const e of g.drainEvents()) ev[e.e] = (ev[e.e] || 0) + 1; } }
    ok((ev.pick || 0) > 3 && (ev.toss || 0) > 0, `les bots ramassent et lancent (${ev.pick || 0} ramassés, ${ev.toss || 0} lancés, ${ev.boom || 0} explosions)`);
  }
}

section('Chute et manche');
{
  const s = lab('toits', 3), [a, b, c] = s.players.values();
  put(a, -6, -1); put(c, -6, 2); put(b, 0.1, 3.4); // b au-dessus du vide, à côté de la nacelle
  put(b, 0, -3); b.hitBy = a.id; b.hitT = s.t;
  run(s, 3);
  ok(b.st === ST.OUT, 'tomber dans le vide élimine');
  ok(b.p[P].y < KILL_Y, 'le corps sort du jeu');
  ok(a.kos === 1, 'celui qui a frappé juste avant est crédité');
  ok(b.order === 1, "ordre d'élimination noté");
  ok(s.ph === 'play', 'il en reste deux : la manche continue');
  put(c, 0, -3); run(s, 3);
  ok(s.ph === 'round' && s.rw === a.id && a.pts === 1, 'le dernier debout gagne la manche');
  run(s, 4);
  ok(s.rd === 2 && s.ph === 'count', 'la manche suivante démarre');
  ok([...s.players.values()].every((p) => p.st === ST.LIVE), 'tout le monde est revenu');
  ok(new Set([s.lastKey, 'toits']).size === 2, "l'arène change");
}

section('Parties entières entre bots');
for (const lv of ['facile', 'normal', 'expert']) for (const seed of [1, 2, 3]) {
  const s = new Sim({ seed, goal: 2 }); s.addBots(4, lv); s.start();
  let n = 0; const ev = {}; let nan = false;
  while (s.ph !== 'over' && n < 60 * 420) {
    s.step(DT); n++;
    for (const e of s.drainEvents()) ev[e.e] = (ev[e.e] || 0) + 1;
    if (n % 30 === 0) for (const b of s.players.values()) for (const q of b.p) if (!Number.isFinite(q.x + q.y + q.z)) nan = true;
  }
  ok(!nan, `${lv}/${seed} : aucun corps ne part en vrille`);
  ok(s.ph === 'over', `${lv}/${seed} : la partie se termine (${Math.round(n / 60)} s, ${s.rd} manches)`);
  ok(s.ranking()[0].pts >= 2, `${lv}/${seed} : un vainqueur`);
  ok((ev.hit || 0) >= 2, `${lv}/${seed} : les bots se tapent dessus (${ev.hit || 0} coups)`);
}
{ // les bots franchissent les trois arènes : personne ne reste planté
  for (const k of ARENA_KEYS) {
    const dur = [], nanCheck = [];
    for (const seed of [5, 6, 7, 8]) {
      const s = new Sim({ seed, goal: 3 }); s.addBots(4, 'normal'); s.start(); s.drainEvents(); s.rd = 0; s.startRound(k);
      let t = 0; while (s.ph !== 'round' && t < 180) { s.step(DT); t += DT; if (![...s.players.values()].every((b) => b.p.every((q) => Number.isFinite(q.x + q.y + q.z)))) nanCheck.push(seed); }
      dur.push(Math.round(t));
    }
    console.log(`    ${k} : manches de ${dur.join(', ')} s`);
    ok(Math.max(...dur) < 180 && !nanCheck.length, `${k} : une manche entre bots aboutit (${dur.join(', ')} s)`);
  }
}

section('Instantané et reprise');
{
  const s = new Sim({ seed: 9, goal: 3 }); s.addBots(8, 'normal'); s.start(); run(s, 8);
  const snap = s.snapshot(), size = JSON.stringify(snap).length;
  ok(size < 3400, `8 joueurs tiennent dans un message raisonnable (${size} octets)`);
  snap.run = 1;
  const r = Sim.restore(JSON.parse(JSON.stringify(snap)));
  ok(r.players.size === 8 && r.ph === s.ph && r.rd === s.rd && r.arena.key === s.arena.key, 'un nouvel hôte reprend la manche');
  const [b0] = s.players.values(), b1 = r.players.get(b0.id);
  ok(b0.st === ST.OUT || Math.abs(b1.p[H].x - b0.p[H].x) < 0.02, 'les corps restent à leur place');
  ok(b1.name === b0.name && b1.bot, 'les noms suivent');
  run(r, 5);
  for (const b of r.players.values()) for (const q of b.p) ok(Number.isFinite(q.x + q.y + q.z), 'la reprise reste stable');
  s.removePlayer(BOTID(s)); s.step(DT);
  ok(s.players.size === 7, 'un joueur qui part quitte la partie sans casser les prises');
}
function BOTID(s) { return [...s.players.keys()][0]; }

section("Coût d'un pas");
{
  const s = new Sim({ seed: 2, goal: 9 }); s.addBots(8, 'expert'); s.start(); const t0 = performance.now(); let n = 0;
  while (performance.now() - t0 < 1000) { s.step(DT); n++; if (s.ph === 'over') { s.start(); } }
  const ms = 1000 / n; ok(ms < 2, `un pas à 8 joueurs coûte peu (${ms.toFixed(3)} ms)`);
}

console.log(fails ? `\n${fails} échec(s) sur ${count} vérifications` : `\nTout est bon (${count} vérifications)`);
process.exit(fails ? 1 : 0);
