/* =============================================================================
   Mini-Golf Party — 5 parcours supplémentaires (30 trous), plus longs, façon Golf It :
   grandes descentes, montées, chutes, vide, obstacles mobiles, tremplins, boue, glu,
   plafonds aimantés (on roule et on joue à l'envers), glace, trampolines, loopings.
   Repère local : départ à l'origine vers +z ; +x = gauche ; tourner de +deg = à gauche.
   ============================================================================= */
import { V } from './build.js';

const fwdOf = (yaw) => [Math.sin(yaw), 0, Math.cos(yaw)];
const leftOf = (yaw) => [Math.cos(yaw), 0, -Math.sin(yaw)];
const ring = (c, R, a0, a1, n = 24) => { const pts = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push([c[0] + Math.sin(a) * R, c[2] + Math.cos(a) * R]); } return pts; };

/* ---------- obstacles réutilisables ---------- */
/** Bloc qui glisse en travers de l'allée (porte, rocher, nacelle…) */
function slider(B, t, ahead, o = {}) {
  const yaw = t.dir(), p = t.here(ahead, o.lat || 0, 0);
  const s = o.size || [1.1, 0.5, 0.35];
  B.kin({ pivot: p, pose: { type: 'slide', dir: [1, 0, 0], amp: o.amp ?? 1.2, period: o.period ?? 2.6, phase: o.phase || 0, yaw }, look: o.look || 'door', mat: o.mat || 'metalw',
    boxes: [{ c: [0, s[1] / 2, 0], s }] });
}
/** Bras qui tourne autour d'un axe vertical au milieu de l'allée */
function spinner(B, t, ahead, o = {}) {
  const yaw = t.dir(), p = t.here(ahead, o.lat || 0, 0.14);
  const L = o.len ?? (t.last.w - 0.1);
  const boxes = [{ c: [0, 0, 0], s: [L, 0.16, 0.16] }];
  if (o.cross) boxes.push({ c: [0, 0, 0], s: [0.16, 0.16, L] });
  B.kin({ pivot: p, pose: { type: 'spin', axis: [0, 1, 0], speed: o.speed ?? 1.6, phase: o.phase || 0, yaw }, look: o.look || 'bar', mat: o.mat || 'hazard', boxes });
  B.cyl(t.here(ahead, o.lat || 0, 0), 0.08, 0.55, { mat: 'metalw', seg: 10 });
}
/** Roue à aubes : 4 pales qui balaient l'allée dans le sens de la marche */
function wheel(B, t, ahead, o = {}) {
  const yaw = t.dir(), R = o.R ?? 1.5, w = (o.w ?? t.last.w) - 0.15;
  const piv = t.here(ahead, 0, R + 0.05);
  B.kin({ pivot: piv, pose: { type: 'spin', axis: [1, 0, 0], speed: o.speed ?? 1.2, phase: o.phase || 0, yaw }, look: o.look || 'wheel', mat: o.mat || 'logw',
    boxes: [{ c: [0, R / 2, 0], s: [w, R, 0.12] }, { c: [0, -R / 2, 0], s: [w, R, 0.12] }, { c: [0, 0, R / 2], s: [w, 0.12, R] }, { c: [0, 0, -R / 2], s: [w, 0.12, R] }] });
}
/** Balancier qui traverse l'allée de gauche à droite */
function pendulum(B, t, ahead, o = {}) {
  const yaw = t.dir(), H = o.h ?? 2.6, p = t.here(ahead, 0, 0);
  B.kin({ pivot: V.add(p, [0, H, 0]), pose: { type: 'swing', axis: [0, 0, 1], amp: o.amp ?? 0.95, period: o.period ?? 2.4, phase: o.phase || 0, yaw }, look: o.look || 'log', mat: o.mat || 'logw',
    boxes: [{ c: [0, -H + 0.27, 0], s: o.head || [0.8, 0.48, 0.5] }, { c: [0, -H / 2, 0], s: [0.1, H - 0.6, 0.1] }] });
  if (o.gantry !== false) B.deco('gantry', p, { yaw, h: H + 0.3 });
}
/** Tunnel à plafond aimanté : on roule (et on joue) la tête en bas ; le sol disparaît sur « gap » mètres */
function magnetTunnel(B, t, len, gap, o = {}) {
  t.wallH(o.h ?? 1.0);
  const s0 = t.last.s;
  t.roof(true, 'magnet');
  const lead = (len - gap) / 2;
  t.straight(lead);
  t.floorOff(true).straight(gap).floorOff(false);
  t.straight(lead);
  const s1 = t.last.s;
  t.roof(false).wallH(0.3);
  B.zoneAlong(t, s0 + 0.6, s1 - 0.6, 'antigrav', { above: 0.25 });
}
function lamp(B, p, color = 0xffb35a, i = 5, d = 7) { B.deco('torch', p); B.light([p[0], p[1] + 1.4, p[2]], color, i, d); }

/* =============================================================================
   5. CANYON EXPRESS — mesas, ravins et ruée vers l'or
   ============================================================================= */
const canyon = {
  id: 'canyon', name: 'Canyon Express', sub: 'Grandes descentes, tremplins et mine d\'or', diff: 2, theme: 'canyon', groundY: 0, groundType: 'grass',
  holes: [
    { name: 'La Grande Descente', par: 3, at: [0, 0, 0], skirt: 'skirtrock', build(B) {
      const t = B.path({ y: 7, w: 2.4 }).capStart(); B.tee(t.here(0.9));
      t.straight(4).slope(16, -5.5).straight(3).turn(-70, 6, { bank: -8 }).straight(3, { bank: 0 })
        .mat('sand').straight(2.2).mat('sandstone').straight(5).capEnd();
      B.cup(t.here(-1.5));
      B.deco('mesa', B.L(-7, 0, 6), { r: 4, h: 9 }); B.deco('cactus', t.here(0.5, 2.2, 0));
    } },
    { name: 'Le Saut du Coyote', par: 4, at: [45, 0, 0], build(B) {
      const t = B.path({ y: 1.2 }).capStart(); B.tee(t.here(0.9));
      t.straight(5).slope(6, 1.4).straight(2).slope(2.4, 0.6, { ease: 'in' });
      t.w = 4.4; t.gap(5, -2.4);
      t.straight(4).turn(-90, 4).straight(3).mat('mud').straight(3).mat('sandstone').straight(4).capEnd();
      B.cup(t.here(-1.5));
      B.deco('tumbleweed', B.L(2, 0, 14)); B.deco('mesa', B.L(8, 0, 22), { r: 3, h: 6 });
    } },
    { name: 'Les Lacets', par: 4, at: [90, 0, 0], build(B) {
      const t = B.path({ y: 1 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).seg({ len: 9, turn: 180, dh: 1.4, bank: 12 }).straight(2, { bank: 0 });
      slider(B, t, 1, { size: [1.0, 0.7, 0.9], amp: 0.9, period: 3.2, look: 'boulder', mat: 'redrock' });
      t.seg({ len: 9, turn: -180, dh: 1.4, bank: -12 }).straight(2, { bank: 0 })
        .seg({ len: 9, turn: 180, dh: 1.0, bank: 12 }).straight(4, { bank: 0 }).capEnd();
      B.cup(t.here(-1.4));
    } },
    { name: 'Le Pont de Corde', par: 4, at: [90, 170, 180], skirt: 'skirtrock', build(B) {
      const t = B.path({ y: 6, base: 'slab' }).capStart(); B.tee(t.here(0.9));
      t.straight(4, { w: 2.4 }).walls(false, false).mat('logf', 'logw').straight(1, { w: 1.3 }).straight(9);
      pendulum(B, t, -4.5, { period: 2.6, h: 2.4 });
      t.straight(1, { w: 2.6 }).walls(true, true).mat('sandstone', 'redrock').straight(3).turn(80, 4).slope(5, -1.5).straight(4).capEnd();
      B.cup(t.here(-1.4));
      B.deco('cliff', B.L(0, 0, 2), { r: 4, h: 6 }); B.deco('mesa', t.here(-2, 0, -4.5), { r: 5, h: 4.4 });
    } },
    { name: 'Le Canyon aux Échos', par: 5, at: [45, 170, 180], build(B) {
      const t = B.path({ y: 2.3, w: 2.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(4).turn(40, 8).straight(6);
      for (const [d, l] of [[-4.5, 0.6], [-2.5, -0.7], [-0.8, 0.3]]) B.cyl(t.here(d, l, 0), 0.3, 0.45, { mat: 'redrock', seg: 9 });
      t.turn(-80, 7).mat('sand').straight(2.5).mat('sandstone').straight(4);
      t.gap(2.2, -1.2);
      t.straight(3).mat('boost').flow(1).straight(1.6).flow(0).mat('sandstone').slope(5, 1.5).straight(2).turn(70, 4).straight(3).capEnd();
      B.cup(t.here(-1.4));
      B.deco('mesa', B.L(-15, 0, 10), { r: 5, h: 12 });
    } },
    { name: 'La Ruée vers l\'Or', par: 4, at: [0, 170, 180], build(B) {
      const t = B.path({ y: 1.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).wallH(0.8).roof(true, 'logw').mat('logf', 'logw').straight(7).roof(false).wallH(0.3);
      B.light(t.here(-3.5, 0, 0.6), 0xffb35a, 5, 6);
      t.mat('conveyor', 'redrock').flow(1).slope(6, 1.2).flow(0).mat('sandstone').straight(2)
        .turn(-120, 4, { bank: -14 }).straight(2, { bank: 0 }).slope(6, -1.2).straight(0.4);
      const R = 3.2, c = t.here(R - 0.2, 0, 0); t.straight(0.2);
      const y = c[1];
      B.cup(B.bowl(c, R, 0.7, { floor: 'sandstone' }));
      const back = t.dir() + Math.PI, gapA = Math.asin(1.32 / R);
      B.wallLine(ring(c, R, back + gapA, back + 2 * Math.PI - gapA, 30), y, { center: c, mat: 'redrock' });
      B.cyl([c[0], 0, c[2]], R + 0.2, y, { mat: 'skirtrock', phys: false, noTop: true, seg: 40 });
      B.deco('minecart', t.here(-12, 2.2, -1.6)); lamp(B, V.add(c, [R + 0.8, -y, 0]));
    } },
  ],
  center: [{ type: 'mesa', p: [45, 0, 85], r: 9, h: 16 }, { type: 'mesa', p: [10, 0, 95], r: 5, h: 10 }],
};

/* =============================================================================
   6. STATION ORBITALE — gravité inversée, plafonds aimantés et vide
   ============================================================================= */
const space = {
  id: 'space', name: 'Station Orbitale', sub: 'Plafonds aimantés, portes et vide spatial', diff: 3, theme: 'space', groundY: -40, groundType: 'void', base: 'slab',
  holes: [
    { name: 'Le Sas d\'Embarquement', par: 3, at: [0, 0, 0], build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(4).mat('grate');
      for (let k = 0; k < 3; k++) { t.straight(2.4); slider(B, t, -1.2, { amp: 1.15, period: 2.2 + k * 0.4, phase: k * 1.7 }); }
      t.mat('metal').straight(2).mat('boost').flow(1).straight(1.4).flow(0).mat('metal').straight(6).capEnd();
      B.cup(t.here(-1.5));
      B.light(t.here(-3, 0, 1.2), 0xff3fa8, 5, 8);
    } },
    { name: 'Plafond Magnétique', par: 3, at: [45, 0, 0], build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(5);
      magnetTunnel(B, t, 10, 7);
      t.straight(6).capEnd(); B.cup(t.here(-1.5));
      B.light(t.here(-8, 0, 1.2), 0xb36bff, 6, 8);
    } },
    { name: 'L\'Anneau', par: 4, at: [90, 0, 0], build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(4).mat('boost').flow(1).straight(1.6).flow(0).mat('metal').straight(2).loop(2.4).straight(3).slope(2, 0.5, { ease: 'in' });
      t.w = 4; t.gap(4.5, 0);
      t.straight(6).capEnd(); B.cup(t.here(-1.5));
      B.deco('satellite', B.L(-8, 3, 12));
    } },
    { name: 'Champ d\'Astéroïdes', par: 5, at: [90, 170, 180], build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).straight(2, { w: 6 }).walls(false, false).mat('grate').straight(16);
      for (const [d, sp, ph] of [[-13, 1.0, 0], [-8, -1.3, 1], [-3, 0.9, 2]]) {
        const p = t.here(d, 0, 0.18), yaw = t.dir();
        B.kin({ pivot: p, pose: { type: 'spin', axis: [0, 1, 0], speed: sp, phase: ph, yaw }, look: 'asteroid', mat: 'rock', boxes: [{ c: [2.0, 0.1, 0], s: [0.9, 0.55, 0.9] }, { c: [-2.0, 0.1, 0], s: [0.9, 0.55, 0.9] }] });
        B.cyl(t.here(d, 0, 0), 0.25, 0.5, { mat: 'metalw', seg: 12 });
      }
      t.mat('metal').walls(true, true).straight(2, { w: 2.4 }).turn(90, 3).straight(5).capEnd();
      B.cup(t.here(-1.4));
    } },
    { name: 'Le Labyrinthe Inversé', par: 4, at: [45, 170, 180], build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(4).wallH(1.0);
      const s0 = t.last.s;
      t.roof(true, 'magnet').straight(2).floorOff(true).straight(3).turn(-90, 2).straight(3).turn(90, 2).straight(3).floorOff(false).straight(2);
      const s1 = t.last.s;
      t.roof(false).wallH(0.3);
      B.zoneAlong(t, s0 + 0.6, s1 - 0.6, 'antigrav', { above: 0.25 });
      t.straight(5).capEnd(); B.cup(t.here(-1.4));
      B.light(t.frameAt((s0 + s1) / 2).p, 0xb36bff, 6, 9);
    } },
    { name: 'Le Cœur du Réacteur', par: 6, at: [0, 170, 180], build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).mat('grate');
      for (let k = 0; k < 2; k++) { t.straight(2.4); slider(B, t, -1.2, { amp: 1.15, period: 2.4, phase: k * 2.1 }); }
      t.mat('metal').straight(2).mat('boost').flow(1).straight(1.6).flow(0).mat('metal').straight(2).loop(1.8).straight(3);
      magnetTunnel(B, t, 8, 5);
      t.straight(2).straight(2, { w: 4.4 });
      t.straight(6);
      spinner(B, t, -3, { len: 4.2, cross: true, speed: 1.3 });
      t.straight(2, { w: 2.4 }).slope(2, 0.45, { ease: 'in' });
      t.w = 4.2; t.gap(3.2, -0.45);
      t.straight(5).capEnd(); B.cup(t.here(-1.5));
      B.light(t.here(-12, 0, 1.4), 0xff3fa8, 7, 10);
    } },
  ],
  center: [{ type: 'planet', p: [60, -60, 260], r: 45, color: '#4a6aff' }, { type: 'planet', p: [-120, 40, 40], r: 18, color: '#ff8a5a' }],
};

/* =============================================================================
   7. MARAIS BRUMEUX — pontons, boue et glu
   ============================================================================= */
const swamp = {
  id: 'swamp', name: 'Marais Brumeux', sub: 'Boue, glu et pontons branlants', diff: 2, theme: 'swamp', groundY: 0, groundType: 'water', base: 'slab',
  holes: [
    { name: 'Le Ponton Branlant', par: 3, at: [0, 0, 0], build(B) {
      const t = B.path({ y: 0.9 }).capStart(); B.tee(t.here(0.9));
      t.straight(4).turn(30, 6).walls(false, false).straight(6).walls(true, true).turn(-60, 6).mat('moss').straight(4)
        .mat('mud').straight(2.5).mat('logf').straight(3).capEnd();
      B.cup(t.here(-1.4));
      lamp(B, t.here(0.3, 1.8, 0), 0xd8ff6a);
    } },
    { name: 'La Boue Collante', par: 4, at: [45, 0, 0], build(B) {
      const t = B.path({ y: 0.9, w: 2.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).slope(5, 0.8).mat('mud').straight(3).mat('logf').straight(2);
      const s0 = t.last.s; t.straight(4); B.zoneAlong(t, s0, t.last.s, 'slow', { above: 0.3, extra: { k: 2.2 } });
      t.turn(90, 4).mat('mud').straight(2).mat('logf').straight(5).capEnd();
      B.cup(t.here(-1.4));
    } },
    { name: 'Les Nénuphars', par: 3, at: [90, 0, 0], build(B) {
      const t = B.path({ y: 0.9 }).capStart(); B.tee(t.here(0.9));
      t.straight(5);
      for (let k = 0; k < 3; k++) { t.slope(1.8, 0.35, { ease: 'in' }); t.w = 3.4; t.gap(2.2, -0.35); t.mat('moss').straight(3).mat('logf'); }
      t.straight(3).capEnd(); B.cup(t.here(-1.5));
      for (let k = 0; k < 3; k++) B.deco('lilypad', t.here(-6 - k * 5.5, (k % 2 ? 1 : -1) * 2.6, -0.88));
    } },
    { name: 'Le Moulin à Eau', par: 4, at: [90, 170, 180], build(B) {
      const t = B.path({ y: 0.9 }).capStart(); B.tee(t.here(0.9));
      t.straight(6); wheel(B, t, 0.8, { R: 1.4, speed: 1.0 }); t.straight(2);
      t.straight(2).mat('conveyor').flow(-1).straight(5).flow(0).mat('logf').straight(2).turn(-90, 3).straight(4).capEnd();
      B.cup(t.here(-1.4));
      lamp(B, t.here(0.3, -1.8, 0), 0xd8ff6a);
    } },
    { name: 'Le Bayou Tortueux', par: 5, at: [45, 170, 180], build(B) {
      const t = B.path({ y: 0.9 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).walls(false, true).seg({ len: 6, turn: 70, bank: 8 }).walls(true, true).straight(3, { bank: 0 });
      B.cyl(t.here(-1.5, 0.5, 0), 0.32, 0.5, { mat: 'logw', seg: 9 });
      t.walls(true, false).seg({ len: 11, turn: -140, bank: -10 }).walls(true, true).straight(1, { bank: 0 });
      const s0 = t.last.s; t.straight(4); B.zoneAlong(t, s0, t.last.s, 'slow', { above: 0.3, extra: { k: 1.8 } });
      t.seg({ len: 6, turn: 70, bank: 8 }).straight(1, { bank: 0 }).mat('mud').straight(3).mat('logf').straight(4).capEnd();
      B.cup(t.here(-1.4));
      B.deco('hut', B.L(-9, 0, 4));
    } },
    { name: 'La Cabane de la Sorcière', par: 4, at: [0, 170, 180], build(B) {
      const t = B.path({ y: 1.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).slope(6, 2.0).straight(1).wallH(0.85).roof(true, 'logw').straight(5);
      spinner(B, t, -2.5, { look: 'ladle', speed: 2.0 });
      B.light(t.here(-2.5, 0, 0.6), 0x7affd8, 5, 6);
      t.roof(false).wallH(0.3).straight(1).slope(8, -2.6, { ease: 'in' }).straight(0.4);
      const R = 3.2, c = t.here(R - 0.2, 0, 0); t.straight(0.2);
      const y = c[1];
      B.cup(B.bowl(c, R, 0.6, { floor: 'moss' }));
      const back = t.dir() + Math.PI, gapA = Math.asin(1.32 / R);
      B.wallLine(ring(c, R, back + gapA, back + 2 * Math.PI - gapA, 30), y, { center: c, mat: 'logw' });
      B.cyl([c[0], 0, c[2]], R + 0.2, y, { mat: 'skirtwood', phys: false, noTop: true, seg: 40 });
      B.deco('hut', t.here(-14, 3.6, -3.6));
    } },
  ],
  center: [{ type: 'hut', p: [45, 0, 85] }, { type: 'deadtree', p: [20, 0, 80] }],
};

/* =============================================================================
   8. SOMMETS GLACÉS — glace, neige et tremplins
   ============================================================================= */
const ice = {
  id: 'ice', name: 'Sommets Glacés', sub: 'Glace, neige, tremplin et bobsleigh', diff: 3, theme: 'ice', groundY: 0, groundType: 'grass',
  holes: [
    { name: 'La Piste Bleue', par: 3, at: [0, 0, 0], skirt: 'skirtice', build(B) {
      const t = B.path({ y: 6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).mat('ice').seg({ len: 8, turn: 60, dh: -1.6, bank: 10 }).seg({ len: 8, turn: -120, dh: -1.8, bank: -12 }).seg({ len: 6, turn: 60, dh: -1.2, bank: 8 })
        .mat('snowpack').straight(2, { bank: 0 }).mat('snow').straight(2).mat('snowpack').straight(4).capEnd();
      B.cup(t.here(-1.4));
      B.deco('snowman', t.here(0.5, 2.2, 0));
    } },
    { name: 'Le Tremplin', par: 3, at: [45, 0, 0], skirt: 'skirtice', build(B) {
      const t = B.path({ y: 9 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).mat('ice').slope(12, -6.5, { ease: 'in' }).straight(1).slope(2.4, 0.7, { ease: 'in' });
      t.w = 4.6; t.gap(8, -1.6);
      t.mat('snowpack').slope(5, -0.8, { ease: 'out' }).mat('snow').straight(2).mat('snowpack').straight(8).capEnd();
      B.cup(t.here(-1.6));
      B.deco('snowpine', t.here(-6, 3.4, 0)); B.deco('snowpine', t.here(-10, -3.4, 0));
    } },
    { name: 'Le Lac Gelé', par: 3, at: [90, 0, 0], build(B) {
      const t = B.path({ y: 1, w: 5.5 }).capStart(); B.tee(t.here(0.9));
      t.mat('ice').straight(18);
      for (const [d, l] of [[-14, 1.2], [-11, -1.4], [-8, 0.2], [-5, 1.6], [-3, -1.0]]) B.cyl(t.here(d, l, 0), 0.34, 0.45, { mat: 'icew', seg: 10 });
      t.turn(-90, 5).straight(3).mat('snowpack').straight(5).capEnd();
      B.cup(t.here(-1.6));
    } },
    { name: 'Les Télécabines', par: 4, at: [90, 170, 180], build(B) {
      const t = B.path({ y: 1 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).mat('boost').flow(1).straight(1.6).flow(0).mat('snowpack').slope(8, 2.2).straight(2);
      slider(B, t, -1, { size: [1.2, 0.9, 0.9], amp: 2.0, period: 3.4, look: 'gondola', mat: 'metalw' });
      t.straight(6);
      slider(B, t, -2.5, { size: [1.2, 0.9, 0.9], amp: 2.0, period: 2.9, phase: 1.5, look: 'gondola', mat: 'metalw' });
      t.turn(90, 4).mat('ice').straight(4).mat('snowpack').straight(3).capEnd();
      B.cup(t.here(-1.4));
    } },
    { name: 'La Crevasse', par: 4, at: [45, 170, 180], build(B) {
      const t = B.path({ y: 6, base: 'slab' }).capStart(); B.tee(t.here(0.9));
      t.straight(4).mat('ice').walls(false, false).straight(1, { w: 1.4 }).straight(6).straight(1, { w: 3 }).walls(true, true).mat('snow').straight(3)
        .mat('ice').walls(false, false).straight(1, { w: 1.4 }).turn(30, 6).straight(3).straight(1, { w: 2.6 }).walls(true, true).mat('snowpack').straight(4).capEnd();
      B.cup(t.here(-1.4));
      B.deco('cliff', B.L(0, 0, 2), { r: 4, h: 6 }); B.deco('cliff', t.here(-2, 0, -6), { r: 4.5, h: 6 });
    } },
    { name: 'Le Bobsleigh', par: 6, at: [0, 170, 180], skirt: 'skirtice', build(B) {
      const t = B.path({ y: 9, wall: 'icew' }).capStart(); B.tee(t.here(0.9));
      t.straight(3).wallH(0.6).mat('ice').seg({ len: 10, turn: 120, dh: -2, bank: 25 }).seg({ len: 10, turn: -150, dh: -2, bank: -25 }).straight(1, { bank: 0 })
        .roof(true, 'icew').straight(5).roof(false).loop(2.0).seg({ len: 8, turn: 90, dh: -1.5, bank: 20 }).straight(1, { bank: 0 }).wallH(0.3)
        .mat('snow').straight(3).mat('snowpack').straight(4).capEnd();
      B.cup(t.here(-1.4));
    } },
  ],
  center: [{ type: 'chalet', p: [45, 0, 85] }, { type: 'snowpine', p: [20, 0, 90], s: 2 }, { type: 'snowpine', p: [70, 0, 78], s: 1.8 }],
};

/* =============================================================================
   9. FÊTE FORAINE — trampolines, bumpers et grand huit
   ============================================================================= */
const candy = {
  id: 'candy', name: 'Fête Foraine', sub: 'Trampolines, flipper et grand huit', diff: 2, theme: 'candy', groundY: 0, groundType: 'grass',
  holes: [
    { name: 'Le Flipper', par: 3, at: [0, 0, 0], skirt: 'skirtcandy', build(B) {
      const t = B.path({ y: 1.8, w: 5 }).capStart(); B.tee(t.here(0.9));
      t.straight(2).slope(14, -1.0, { ease: 'lin' }).straight(3, { w: 3 }).capEnd();
      B.cup(t.here(-1.3));
      for (const [d, l] of [[-15, 1.2], [-13.5, -1.0], [-12, 0.1], [-10, 1.6], [-9.5, -1.6], [-8, 0.6], [-6.5, -0.5], [-6, 1.5]]) B.cyl(t.here(d, l, 0), 0.24, 0.35, { mat: 'bumper', seg: 14 });
      const yaw = t.dir();
      for (const s of [1, -1]) B.box(t.here(-4.6, s * 1.6, 0.15), [1.3, 0.3, 0.25], { yaw: yaw + s * 0.5, mat: 'jelly' });
    } },
    { name: 'Les Trampolines', par: 4, at: [45, 0, 0], skirt: 'skirtcandy', build(B) {
      const t = B.path({ y: 2 }).capStart(); B.tee(t.here(0.9));
      t.straight(6);
      t.w = 3; t.wallH(0.5); t.gap(1.0, -1.4);
      t.mat('tramp').straight(3);
      t.wallH(0.3); t.w = 3.4; t.gap(1.6, 1.8);
      t.mat('candy').straight(7).capEnd(); B.cup(t.here(-1.5));
      B.deco('tent', B.L(-8, 0, 10));
    } },
    { name: 'La Grande Roue', par: 4, at: [90, 0, 0], skirt: 'skirtcandy', build(B) {
      const t = B.path({ y: 0.6, w: 2.4 }).capStart(); B.tee(t.here(0.9));
      t.straight(6); wheel(B, t, 0.8, { R: 1.6, speed: 0.9, look: 'arm', mat: 'candyw' }); t.straight(2);
      t.straight(3); wheel(B, t, 0.8, { R: 1.6, speed: -1.2, phase: 0.8, look: 'arm', mat: 'candyw' }); t.straight(2);
      t.straight(4).capEnd(); B.cup(t.here(-1.4));
      for (const [d, l] of [[-3, 0.6], [-2.2, -0.6]]) B.cyl(t.here(d, l, 0), 0.2, 0.35, { mat: 'bumper', seg: 14 });
      B.deco('ferris', B.L(-9, 0, 9), { yaw: B.Y(90), r: 7 });
    } },
    { name: 'Le Train Fantôme', par: 5, at: [90, 170, 180], skirt: 'skirtcandy', build(B) {
      const t = B.path({ y: 0.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).wallH(0.85).roof(true, 'candyw').straight(4);
      slider(B, t, -2, { amp: 1.1, period: 2.0, look: 'jelly', mat: 'jelly' });
      B.light(t.here(-2, 0, 0.6), 0xff3fa8, 4, 6);
      t.turn(-90, 3).straight(4);
      slider(B, t, -2, { amp: 1.1, period: 2.6, phase: 1, look: 'jelly', mat: 'jelly' });
      B.light(t.here(-2, 0, 0.6), 0x7a3cff, 4, 6);
      t.turn(90, 3).straight(3).roof(false).wallH(0.3).straight(4).capEnd();
      B.cup(t.here(-1.4));
    } },
    { name: 'Les Montagnes Russes', par: 5, at: [45, 170, 180], skirt: 'skirtcandy', build(B) {
      const t = B.path({ y: 0.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).mat('boost').flow(1).straight(1.6).flow(0).mat('candy').slope(6, 2.2).straight(1).slope(6, -2.2, { ease: 'in' }).straight(1)
        .loop(2.0).straight(1).slope(4, 1.0).slope(4, -1.0).turn(-120, 5, { bank: -18 }).straight(1, { bank: 0 }).straight(3).capEnd();
      B.cup(t.here(-1.4));
      B.deco('lollipop', t.here(0.5, 2, 0));
    } },
    { name: 'Le Grand Huit Final', par: 6, at: [0, 170, 180], skirt: 'skirtcandy', build(B) {
      const t = B.path({ y: 0.6 }).capStart(); B.tee(t.here(0.9));
      t.straight(3).mat('conveyor').flow(1).slope(6, 1.4).flow(0).mat('candy').straight(2).mat('boost').flow(1).straight(1.6).flow(0).mat('candy')
        .straight(1).loop(1.7).straight(2.5).loop(1.7).straight(2).slope(2, 0.45, { ease: 'in' });
      t.w = 3.6; t.gap(3, -0.45);
      t.straight(3).turn(90, 3).straight(0.4);
      const R = 3.4, c = t.here(R - 0.2, 0, 0); t.straight(0.2);
      const y = c[1];
      B.cup(B.bowl(c, R, 0.7, { floor: 'candy' }));
      const back = t.dir() + Math.PI, gapA = Math.asin(1.32 / R);
      B.wallLine(ring(c, R, back + gapA, back + 2 * Math.PI - gapA, 30), y, { center: c, mat: 'candyw' });
      B.cyl([c[0], 0, c[2]], R + 0.2, y, { mat: 'skirtcandy', phys: false, noTop: true, seg: 40 });
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; B.cyl([c[0] + Math.sin(a) * 1.8, y - 0.25, c[2] + Math.cos(a) * 1.8], 0.18, 0.5, { mat: 'bumper', seg: 12 }); }
    } },
  ],
  center: [{ type: 'ferris', p: [45, 0, 85], r: 10 }, { type: 'tent', p: [15, 0, 90] }, { type: 'tent', p: [75, 0, 80] }],
};

export const COURSES2 = [canyon, space, swamp, ice, candy];
export const THEME_MATS2 = {
  canyon: { floor: 'sandstone', wall: 'redrock', trim: 'stonecap', skirt: 'skirtrock' },
  space: { floor: 'metal', wall: 'metalw', trim: 'neon', skirt: 'skirtmetal' },
  swamp: { floor: 'logf', wall: 'logw', trim: 'woodtrim', skirt: 'skirtwood' },
  ice: { floor: 'snowpack', wall: 'icew', trim: 'snowcap', skirt: 'skirtice' },
  candy: { floor: 'candy', wall: 'candyw', trim: 'goldtrim', skirt: 'skirtcandy' },
};
void fwdOf; void leftOf;
