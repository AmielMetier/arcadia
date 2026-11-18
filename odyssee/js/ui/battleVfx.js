// odyssee/js/ui/battleVfx.js — animations de combat riches pour les 18 types, attaques signatures et attaques de zone (1v1, 2v2, 3v3).
import { MOVES } from '../data/moves.js';
import { wait } from './ui.js';

const ease = (t) => t * t * (3 - 2 * t);

export const TYPE_FX = {
  normal: ['#ffffff', '#f0f0d0'], fighting: ['#ffffff', '#ff7048'], flying: ['#ffffff', '#b8dcff'],
  poison: ['#c058d8', '#ec98ff'], ground: ['#d4aa58', '#8a6230'], rock: ['#b8a888', '#685848'],
  bug: ['#a8d030', '#e4f888'], ghost: ['#7858a8', '#301e48'], steel: ['#e4e8f4', '#9aa4ba'],
  fire: ['#ff8828', '#ffe458'], water: ['#58a8ff', '#c8ecff'], grass: ['#58cc44', '#b8f888'],
  electric: ['#ffe438', '#ffffff'], psychic: ['#ff68b8', '#ffc8ea'], ice: ['#9ae8ff', '#ffffff'],
  dragon: ['#7850f8', '#c8a8ff'], dark: ['#4a3848', '#b888a8'], fairy: ['#ff98d4', '#fff0fa'],
};

function spawnAfterimage(view, side, slot, tint = null) {
  const o = view.spriteObj(side, slot);
  if (!o?.visible || !o.img) return;
  const pos = view.posFor(side, slot);
  const bs = view.scaleFor(side, slot);
  const w = o.img.width * o.scale * bs * (o.sx || 1);
  const h = o.img.height * o.scale * bs * (o.sy || 1);
  view.st.afterimages.push({
    img: o.img, tint,
    cx: pos.x + (side === 1 ? view.st.eSlide : view.st.pSlide) + o.dx,
    cy: pos.y + (side === 1 ? 8 : 18) + o.dy,
    w, h, alpha: 0.48, life: 0.22, max: 0.22,
  });
}

async function lungeAttacker(view, side, slot, { dist = 16, ms = 130, afterimages = true, tint = null, jump = 0 } = {}) {
  const o = view.spriteObj(side, slot), dir = side === 1 ? -1 : 1;
  if (!o) return;
  let lastGhost = 0;
  await view.tween(ms, (u) => {
    const p = Math.sin(u * Math.PI / 2);
    o.dx = dir * dist * p;
    o.dy = -dir * Math.round(dist * 0.4) * p - Math.sin(u * Math.PI) * jump;
    o.sx = 1 + 0.08 * p;
    o.sy = 1 - 0.06 * p;
    if (afterimages && performance.now() - lastGhost > 32) {
      lastGhost = performance.now();
      spawnAfterimage(view, side, slot, tint);
    }
  });
}

async function resetAttacker(view, side, slot, ms = 140) {
  const o = view.spriteObj(side, slot);
  if (!o) return;
  const dx0 = o.dx, dy0 = o.dy;
  await view.tween(ms, (u) => {
    const k = 1 - ease(u);
    o.dx = dx0 * k;
    o.dy = dy0 * k;
    o.sx = 1;
    o.sy = 1;
    o.rot = 0;
    o.white = 0;
  });
  o.dx = 0; o.dy = 0; o.sx = 1; o.sy = 1; o.rot = 0; o.white = 0;
}

function addPart(view, p) { view.st.parts.push(p); }

/** Exécute l'animation visuelle complète d'une capacité vers une ou plusieurs cibles */
export async function playMoveVfx(view, { side, slot = 0, moveId, type, targets }) {
  const M = MOVES[moveId] || {}, mKey = M.key || '', mName = M.n || '';
  const fx = TYPE_FX[type] || TYPE_FX.normal;
  const from = view.sprCenter(side, slot);
  const tList = (targets && targets.length ? targets : [{ side: 1 - side, slot: 0 }])
    .map((t) => ({ side: t.side, slot: t.slot ?? 0, to: view.sprCenter(t.side, t.slot ?? 0) }));
  const firstTo = tList[0].to;

  if (moveId === 10001 || mKey === 'shadow-blast' || mName === 'Rafale Obscure') {
    return animShadowBlast(view, side, slot, from, tList);
  }
  if (['flamethrower', 'fire-blast', 'heat-wave', 'overheat', 'blast-burn', 'flare-blitz', 'eruption', 'incinerate'].includes(mKey) || ['Lance-Flammes', 'Déflagration', 'Canicule', 'Surchauffe', 'Rafale Feu', 'Boutefeu', 'Éruption'].includes(mName)) {
    return animFireWave(view, side, slot, from, tList, mKey === 'fire-blast' || mKey === 'eruption' || mName === 'Déflagration');
  }
  if (['hydro-pump', 'surf', 'waterfall', 'scald', 'muddy-water', 'hydro-cannon', 'aqua-jet', 'aqua-tail'].includes(mKey) || ['Hydrocanon', 'Surf', 'Cascade', 'Ébullition', 'Hydroblast', 'Aqua-Jet'].includes(mName)) {
    return mKey === 'aqua-jet' ? animDashBurst(view, side, slot, tList, TYPE_FX.water, '#68d8ff') : animHydroSurf(view, side, slot, from, tList, mKey === 'surf' || mKey === 'muddy-water');
  }
  if (['thunderbolt', 'thunder', 'discharge', 'zap-cannon', 'volt-switch', 'volt-tackle', 'wild-charge', 'spark'].includes(mKey) || ['Tonnerre', 'Fatal-Foudre', 'Coup d’Jus', 'Élecanon', 'Change-Éclair', 'Électacle'].includes(mName)) {
    return animThunder(view, side, slot, from, tList, mKey === 'thunder' || mKey === 'discharge' || mName === 'Fatal-Foudre');
  }
  if (['earthquake', 'earth-power', 'fissure', 'bulldoze', 'magnitude', 'lands-wrath'].includes(mKey) || ['Séisme', 'Telluriforce', 'Abîme', 'Piétisol', 'Ampleur', 'Force Chtonienne'].includes(mName)) {
    return animQuake(view, side, slot, tList);
  }
  if (['rock-slide', 'stone-edge', 'rock-tomb', 'rock-blast', 'power-gem', 'ancient-power'].includes(mKey) || ['Éboulement', 'Lame de Roc', 'Tomberoche', 'Rayon Gemme'].includes(mName)) {
    return animRockFall(view, side, slot, tList);
  }
  if (['ice-beam', 'blizzard', 'sheer-cold', 'freeze-dry', 'glaciate', 'icy-wind', 'ice-shard'].includes(mKey) || ['Laser Glace', 'Blizzard', 'Glaciation', 'Lyophilisation', 'Vent Glace'].includes(mName)) {
    return animIceStorm(view, side, slot, from, tList, mKey === 'blizzard' || mKey === 'icy-wind' || mKey === 'glaciate');
  }
  if (['psychic', 'psyshock', 'shadow-ball', 'dark-pulse', 'future-sight', 'aura-sphere', 'dragon-pulse'].includes(mKey) || ['Psyko', 'Choc Psy', 'Ball’Ombre', 'Vibrobscur', 'Aurasphère', 'Dracochoc'].includes(mName)) {
    return animEnergySphere(view, side, slot, from, tList, fx);
  }
  if (['razor-leaf', 'leaf-blade', 'leaf-storm', 'petal-dance', 'frenzy-plant', 'petal-blizzard', 'x-scissor', 'night-slash', 'slash', 'dragon-claw', 'aerial-ace', 'shadow-claw', 'air-slash'].includes(mKey) || ['Tranch’Herbe', 'Lame Feuille', 'Tempête Verte', 'Danse Fleurs', 'Végé-Attak', 'Plaie Croix', 'Tranche-Nuit', 'Tranche', 'Draco-Griffe', 'Griffe Ombre', 'Lame d’Air'].includes(mName)) {
    return animSlashStorm(view, side, slot, from, tList, fx, type === 'grass');
  }
  if (['hyper-beam', 'solar-beam', 'giga-impact', 'focus-blast', 'flash-cannon', 'moonblast'].includes(mKey) || ['Ultralaser', 'Lance-Soleil', 'Giga Impact', 'Exploforce', 'Luminocanon', 'Pouvoir Lunaire'].includes(mName)) {
    return animMegaBeam(view, side, slot, from, tList, fx);
  }
  if (['draco-meteor', 'meteor-mash', 'dazzling-gleam', 'swift'].includes(mKey) || ['Draco-Météore', 'Poing Météore', 'Éclat Magique', 'Météores'].includes(mName)) {
    return animMeteorShower(view, side, slot, tList, fx);
  }
  if (['crunch', 'bite', 'fire-fang', 'ice-fang', 'thunder-fang', 'poison-fang'].includes(mKey) || ['Mâchouille', 'Morsure', 'Crocs Feu', 'Crocs Givre', 'Crocs Éclair'].includes(mName)) {
    return animBite(view, side, slot, tList, fx);
  }
  if (['close-combat', 'brick-break', 'dynamic-punch', 'mach-punch', 'bullet-punch', 'double-kick', 'karate-chop', 'fury-swipes', 'double-slap'].includes(mKey)) {
    return animFlurry(view, side, slot, tList, fx);
  }
  if (['quick-attack', 'extreme-speed', 'flame-charge', 'brave-bird', 'u-turn', 'volt-switch'].includes(mKey)) {
    return animDashBurst(view, side, slot, tList, fx, fx[0]);
  }
  if (['reflect', 'light-screen', 'safeguard', 'mist'].includes(mKey)) {
    return animScreenBarrier(view, side, fx);
  }
  if (['swords-dance', 'dragon-dance', 'quiver-dance', 'calm-mind', 'nasty-plot', 'bulk-up', 'coil', 'shell-smash', 'growth', 'work-up'].includes(mKey)) {
    return animPowerDance(view, side, slot, from, fx);
  }
  if (['giga-drain', 'mega-drain', 'absorb', 'leech-life', 'drain-punch', 'parabolic-charge', 'oblivion-wing'].includes(mKey)) {
    return animDrainMove(view, side, slot, from, tList, fx);
  }
  if (M.c === 'physical') {
    await lungeAttacker(view, side, slot, { dist: 16, ms: 120, tint: fx[0] });
    for (const t of tList) {
      view.burst(t.to.x, t.to.y, fx, 16, { speed: 2.6, r: 2.2 });
      addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 4, grow: 1.5, shape: 'ring', c: fx[0], life: 0.3, max: 0.3 });
      if (['normal', 'fighting', 'dragon', 'bug', 'steel'].includes(type)) {
        addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, shape: 'slash', ang: (Math.random() - 0.5) * 1.4, len: 16, lw: 2.6, c: fx[1], life: 0.22, max: 0.22 });
      }
    }
    await resetAttacker(view, side, slot, 130);
    return;
  }
  if (M.c === 'special') {
    const o = view.spriteObj(side, slot);
    if (o) { o.sx = 1.1; o.sy = 0.9; }
    const n = 20, dur = 420;
    let emitted = 0;
    await view.tween(dur, (u) => {
      const k = Math.floor(u * n);
      while (emitted < k) {
        emitted++;
        const pr = emitted / n;
        for (const t of tList) {
          const px = from.x + (t.to.x - from.x) * pr;
          const py = from.y + (t.to.y - from.y) * pr - Math.sin(pr * Math.PI) * (type === 'water' || type === 'grass' || type === 'poison' ? 20 : 6);
          const shape = type === 'electric' ? 'bolt' : type === 'grass' ? 'leaf' : type === 'ice' ? 'crystal' : type === 'fire' ? 'flame' : type === 'psychic' || type === 'fairy' ? 'ring' : null;
          addPart(view, { x: px, y: py, vx: (Math.random() - 0.5) * 0.6, vy: (Math.random() - 0.5) * 0.6 - (type === 'fire' ? 0.5 : 0), r: shape === 'ring' ? 3 : 2 + Math.random() * 2, c: fx[emitted % 2], life: 0.32, max: 0.32, shape, grow: shape === 'ring' ? 0.5 : 0, a: Math.random() * 3 });
        }
      }
    });
    if (o) { o.sx = 1; o.sy = 1; }
    for (const t of tList) {
      view.burst(t.to.x, t.to.y, fx, 16, { speed: 2.2, r: 2.2 });
      addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 6, grow: 1.8, shape: 'ring', c: fx[0], life: 0.32, max: 0.32 });
    }
    if (type === 'ground' || type === 'rock' || type === 'dragon') await view.shakeScreen(4, 240);
    return;
  }
  // Statut : guérison, baisse ou aura
  const isHeal = M.m?.heal || M.m?.u === 'rest';
  const selfStatus = M.tg === 7 || M.tg === 4 || M.tg === 13 || isHeal;
  const centers = selfStatus ? [from] : tList.map((t) => t.to);
  for (const c of centers) {
    if (isHeal) {
      view.sound.sfx('heal');
      for (let k = 0; k < 14; k++) addPart(view, { x: c.x + (Math.random() - 0.5) * 32, y: c.y + 12 + Math.random() * 8, vx: 0, vy: -1.3 - Math.random() * 0.8, r: 2.2, c: k % 2 ? '#98ff98' : '#ffffff', life: 0.5, max: 0.5 });
    } else {
      for (let i = 0; i < 3; i++) addPart(view, { x: c.x, y: c.y, vx: 0, vy: 0, r: 4 + i * 5, grow: 0.9, shape: 'ring', c: fx[i % 2], life: 0.42, max: 0.42 });
      view.burst(c.x, c.y, fx, 10, { speed: 1.1, r: 1.6, up: 0.6 });
    }
  }
  await wait(240);
}

/* ================= CHORÉGRAPHIES SPÉCIALISÉES ================= */

async function animFireWave(view, side, slot, from, tList, isBlast) {
  const flameCols = ['#ffffff', '#fff340', '#ff9800', '#f44336', '#b71c1c'];
  view.sound.sfx('throw');
  await lungeAttacker(view, side, slot, { dist: 10, ms: 100, afterimages: false });
  view.sound.sfx('hitstrong');
  const dur = isBlast ? 500 : 420, count = isBlast ? 30 : 24;
  let emitted = 0;
  await view.tween(dur, (u) => {
    const e = Math.floor(u * count);
    while (emitted < e) {
      emitted++;
      const p = emitted / count;
      for (const t of tList) {
        const bx = from.x + (t.to.x - from.x) * p;
        const by = (from.y - 6) + (t.to.y - (from.y - 6)) * p + Math.sin(p * Math.PI * 3) * 10;
        addPart(view, { x: bx + (Math.random() - 0.5) * (6 + p * 14), y: by + (Math.random() - 0.5) * 8, vx: (t.to.x - from.x) * 0.03, vy: -0.6 - Math.random() * 0.8, r: 2.5 + p * 4, grow: 0.2, c: flameCols[emitted % flameCols.length], shape: 'flame', life: 0.36, max: 0.36 });
      }
    }
  });
  view.st.screenFlash = 0.3;
  view.shakeScreen(isBlast ? 6 : 4, 280);
  for (const t of tList) {
    view.burst(t.to.x, t.to.y, flameCols, isBlast ? 24 : 18, { speed: 3, r: 3.2 });
    if (isBlast) {
      addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, shape: 'slash', ang: Math.PI / 4, len: 22, lw: 3, c: '#ffe040', life: 0.32, max: 0.32 });
      addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, shape: 'slash', ang: -Math.PI / 4, len: 22, lw: 3, c: '#ff6020', life: 0.32, max: 0.32 });
    }
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 8, grow: 2.4, shape: 'ring', c: '#ff9800', life: 0.35, max: 0.35 });
  }
  await resetAttacker(view, side, slot, 110);
}

async function animHydroSurf(view, side, slot, from, tList, isWave) {
  const waterCols = ['#e0f7ff', '#80d8ff', '#00b0ff', '#0091ea', '#ffffff'];
  view.sound.sfx('splash');
  if (isWave) {
    // Vague montante puis déferlante sur toutes les cibles
    await view.tween(460, (u) => {
      for (const t of tList) {
        const wx = t.to.x + (u - 0.5) * 44;
        for (let k = 0; k < 2; k++) addPart(view, { x: wx + (Math.random() - 0.5) * 14, y: t.to.y + 12 - Math.sin(u * Math.PI) * 28, vx: (Math.random() - 0.5) * 1.2, vy: 0.6, r: 3.5 + Math.sin(u * Math.PI) * 3, c: waterCols[(k + Math.floor(u * 10)) % waterCols.length], shape: 'flame', life: 0.32, max: 0.32 });
      }
    });
  } else {
    let em = 0;
    await view.tween(450, (u) => {
      const e = Math.floor(u * 30);
      while (em < e) {
        em++;
        const p = em / 30;
        for (const t of tList) {
          const px = from.x + (t.to.x - from.x) * p, py = (from.y - 4) + (t.to.y - (from.y - 4)) * p - Math.sin(p * Math.PI) * 24;
          addPart(view, { x: px + (Math.random() - 0.5) * 8, y: py + (Math.random() - 0.5) * 6, vx: (t.to.x - from.x) * 0.03, vy: 0.8, r: 2 + p * 3.5, c: waterCols[em % waterCols.length], life: 0.34, max: 0.34 });
        }
      }
    });
  }
  view.sound.sfx('splash');
  view.shakeScreen(4.5, 300);
  for (const t of tList) {
    view.burst(t.to.x, t.to.y, waterCols, 20, { speed: 3.2, r: 2.8, up: 1.1 });
    addPart(view, { x: t.to.x, y: t.to.y + 8, vx: 0, vy: 0, r: 10, grow: 2.6, shape: 'ring', c: '#80d8ff', life: 0.36, max: 0.36 });
  }
  await wait(180);
}

async function animThunder(view, side, slot, from, tList, strong) {
  const elecCols = ['#ffffff', '#ffff76', '#ffea00', '#00e5ff'];
  const strikes = strong ? 3 : 2;
  for (let s = 0; s < strikes; s++) {
    view.sound.sfx('bang');
    view.st.screenFlash = 0.5;
    view.shakeScreen(strong ? 6 : 4.5, 200);
    for (const t of tList) {
      for (let k = 0; k < 2; k++) addPart(view, { x: t.to.x + (Math.random() - 0.5) * 16, y: -10, vx: 0, vy: 1.9, r: 3, lw: 2.8, shape: 'bolt', c: elecCols[(s + k) % elecCols.length], life: 0.26, max: 0.26 });
      view.burst(t.to.x, t.to.y, elecCols, 14, { speed: 3, r: 2.4 });
      addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 7, grow: 2.2, shape: 'ring', c: '#ffea00', life: 0.28, max: 0.28 });
    }
    await wait(110);
  }
  await wait(110);
}

async function animQuake(view, side, slot, tList) {
  const earthCols = ['#5d4037', '#8d6e63', '#a1887f', '#ffb74d', '#3e2723'];
  const o = view.spriteObj(side, slot);
  if (o) await view.tween(120, (u) => { o.dy = -14 * Math.sin(u * Math.PI); });
  view.sound.sfx('hitstrong');
  view.shakeScreen(8.5, 520);
  for (let i = 0; i < 3; i++) {
    for (const t of tList) addPart(view, { x: t.to.x, y: t.to.y + 14, vx: 0, vy: 0, r: 7 + i * 10, grow: 3.4, shape: 'ring', c: earthCols[i % earthCols.length], life: 0.44, max: 0.44 });
    await wait(75);
  }
  view.sound.sfx('bump');
  for (const t of tList) {
    for (let k = 0; k < 14; k++) addPart(view, { x: t.to.x + (Math.random() - 0.5) * 38, y: t.to.y + 14, vx: (Math.random() - 0.5) * 2.6, vy: -2.8 - Math.random() * 2.2, g: 0.22, r: 2 + Math.random() * 2.5, c: earthCols[k % earthCols.length], life: 0.44, max: 0.44 });
  }
  await wait(200);
}

async function animRockFall(view, side, slot, tList) {
  const cols = ['#8d7860', '#b8a088', '#5c4b3b', '#e0d0b8'];
  view.sound.sfx('bump');
  for (const t of tList) {
    for (let k = 0; k < 4; k++) {
      addPart(view, { x: t.to.x + (k - 1.5) * 11, y: t.to.y - 68 - k * 10, vx: (Math.random() - 0.5) * 0.4, vy: 4.5, g: 0.18, r: 4.5 + Math.random() * 2.5, shape: 'crystal', a: Math.random() * 2, va: 0.12, c: cols[k % cols.length], life: 0.34, max: 0.34 });
    }
  }
  await wait(240);
  view.sound.sfx('hitstrong');
  view.shakeScreen(5.5, 280);
  for (const t of tList) view.burst(t.to.x, t.to.y + 6, cols, 16, { speed: 2.8, r: 2.5 });
  await wait(160);
}

async function animIceStorm(view, side, slot, from, tList, blizzard) {
  const iceCols = ['#e1f5fe', '#b3e5fc', '#80deea', '#00e5ff', '#ffffff'];
  view.sound.sfx('stat');
  let em = 0;
  await view.tween(blizzard ? 480 : 400, (u) => {
    const e = Math.floor(u * (blizzard ? 34 : 24));
    while (em < e) {
      em++;
      const p = em / (blizzard ? 34 : 24);
      for (const t of tList) {
        const px = blizzard ? t.to.x - 40 + p * 70 : from.x + (t.to.x - from.x) * p;
        const py = blizzard ? t.to.y - 30 + (Math.random() - 0.5) * 32 : from.y + (t.to.y - from.y) * p + (Math.random() - 0.5) * 8;
        addPart(view, { x: px, y: py, vx: blizzard ? 2.2 : (t.to.x - from.x) * 0.035, vy: blizzard ? 0.6 : (Math.random() - 0.5) * 0.5, r: 2.5 + Math.random() * 2.5, a: Math.random() * Math.PI, va: 0.16, shape: 'crystal', c: iceCols[em % iceCols.length], life: 0.32, max: 0.32 });
      }
    }
  });
  view.sound.sfx('hitweak');
  for (const t of tList) {
    view.burst(t.to.x, t.to.y, iceCols, 20, { speed: 3, r: 2.6 });
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 10, grow: 2.2, shape: 'ring', c: '#80deea', life: 0.34, max: 0.34 });
  }
  await wait(160);
}

async function animEnergySphere(view, side, slot, from, tList, cols) {
  view.sound.sfx('stat');
  await view.tween(340, (u) => {
    const k = ease(u);
    for (const t of tList) {
      const px = from.x + (t.to.x - from.x) * k, py = from.y + (t.to.y - from.y) * k - Math.sin(u * Math.PI) * 14;
      addPart(view, { x: px + (Math.random() - 0.5) * 5, y: py + (Math.random() - 0.5) * 5, vx: (Math.random() - 0.5) * 0.7, vy: (Math.random() - 0.5) * 0.7, r: 3 + u * 4, c: cols[Math.floor(u * 10) % cols.length], life: 0.25, max: 0.25 });
    }
  });
  view.sound.sfx('poof');
  view.shakeScreen(4, 240);
  for (const t of tList) {
    view.burst(t.to.x, t.to.y, cols, 20, { speed: 2.8, r: 2.8 });
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 9, grow: 2.4, shape: 'ring', c: cols[0], life: 0.35, max: 0.35 });
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 15, grow: 3.0, shape: 'ring', c: cols[1], life: 0.38, max: 0.38 });
  }
  await wait(160);
}

async function animSlashStorm(view, side, slot, from, tList, cols, leaves = false) {
  view.sound.sfx('cut');
  if (leaves) {
    for (const t of tList) {
      for (let k = 0; k < 14; k++) {
        const p = k / 14;
        addPart(view, { x: from.x + (t.to.x - from.x) * p + (Math.random() - 0.5) * 12, y: from.y + (t.to.y - from.y) * p + Math.sin(p * Math.PI * 2) * 12, vx: (t.to.x - from.x) * 0.04, vy: -0.3 + Math.random() * 0.6, r: 3, a: Math.random() * Math.PI, va: 0.25, shape: 'leaf', c: cols[k % cols.length], life: 0.35, max: 0.35 });
      }
    }
    await wait(160);
  } else {
    await lungeAttacker(view, side, slot, { dist: 16, ms: 110, tint: cols[0] });
  }
  view.sound.sfx('cut');
  view.shakeScreen(3.5, 200);
  for (const t of tList) {
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, shape: 'slash', ang: Math.PI / 4, len: 20, lw: 3, c: cols[0], life: 0.26, max: 0.26 });
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, shape: 'slash', ang: -Math.PI / 4, len: 20, lw: 3, c: '#ffffff', life: 0.26, max: 0.26 });
    view.burst(t.to.x, t.to.y, cols, 14, { speed: 2.5, r: 2 });
  }
  if (!leaves) await resetAttacker(view, side, slot, 120);
  else await wait(150);
}

async function animMegaBeam(view, side, slot, from, tList, cols) {
  const o = view.spriteObj(side, slot);
  view.sound.sfx('throw');
  await view.tween(220, (u) => {
    if (o) { o.white = u * 0.55; o.sx = 1 - u * 0.1; o.sy = 1 + u * 0.12; }
    const ang = Math.random() * Math.PI * 2, dist = 18 * (1 - u);
    addPart(view, { x: from.x + Math.cos(ang) * dist, y: from.y + Math.sin(ang) * dist, vx: -Math.cos(ang) * 1.4, vy: -Math.sin(ang) * 1.4, r: 2, c: cols[0], life: 0.2, max: 0.2 });
  });
  view.sound.sfx('hitstrong');
  view.st.screenFlash = 0.55;
  view.shakeScreen(7.5, 420);
  for (const t of tList) {
    for (let i = 0; i < 24; i++) {
      const p = i / 24;
      addPart(view, { x: from.x + (t.to.x - from.x) * p, y: from.y + (t.to.y - from.y) * p, vx: 0, vy: 0, r: 4.5 + (1 - Math.abs(p - 0.5) * 2) * 3.5, c: i % 2 ? cols[0] : '#ffffff', shape: 'flame', life: 0.32, max: 0.32 });
    }
    view.burst(t.to.x, t.to.y, cols, 24, { speed: 3.8, r: 3.5 });
    for (let r = 0; r < 3; r++) addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 10 + r * 8, grow: 3.2, shape: 'ring', c: r === 0 ? '#ffffff' : cols[0], life: 0.38, max: 0.38 });
  }
  await resetAttacker(view, side, slot, 140);
}

async function animMeteorShower(view, side, slot, tList, cols) {
  view.sound.sfx('throw');
  for (let w = 0; w < 3; w++) {
    for (const t of tList) {
      addPart(view, { x: t.to.x - 28 + Math.random() * 14, y: -12, vx: 1.6, vy: 4.8, g: 0.14, r: 4.5, shape: 'flame', c: w % 2 ? cols[0] : '#ffe458', life: 0.34, max: 0.34 });
    }
    await wait(95);
    view.sound.sfx('hitstrong');
    view.shakeScreen(4.5, 180);
    for (const t of tList) view.burst(t.to.x + (Math.random() - 0.5) * 14, t.to.y, cols, 12, { speed: 2.8, r: 2.6 });
  }
  await wait(140);
}

async function animBite(view, side, slot, tList, cols) {
  await lungeAttacker(view, side, slot, { dist: 14, ms: 100 });
  view.sound.sfx('cut');
  for (const t of tList) {
    // Crocs supérieur et inférieur qui se referment
    for (let k = -1; k <= 1; k++) {
      addPart(view, { x: t.to.x + k * 9, y: t.to.y - 16, vx: 0, vy: 2.6, r: 3, shape: 'crystal', c: '#ffffff', life: 0.22, max: 0.22 });
      addPart(view, { x: t.to.x + k * 9, y: t.to.y + 16, vx: 0, vy: -2.6, r: 3, shape: 'crystal', c: cols[0], life: 0.22, max: 0.22 });
    }
    view.burst(t.to.x, t.to.y, cols, 14, { speed: 2.4, r: 2.2 });
  }
  view.shakeScreen(4, 200);
  await resetAttacker(view, side, slot, 120);
}

async function animFlurry(view, side, slot, tList, cols) {
  for (let k = 0; k < 4; k++) {
    await lungeAttacker(view, side, slot, { dist: 12, ms: 55, afterimages: true, tint: cols[0] });
    view.sound.sfx(k === 3 ? 'hitstrong' : 'hit');
    for (const t of tList) {
      const ox = (Math.random() - 0.5) * 18, oy = (Math.random() - 0.5) * 16;
      view.burst(t.to.x + ox, t.to.y + oy, cols, 8, { speed: 2.6, r: 2 });
      addPart(view, { x: t.to.x + ox, y: t.to.y + oy, vx: 0, vy: 0, r: 4, grow: 1.8, shape: 'ring', c: '#ffffff', life: 0.2, max: 0.2 });
    }
    if (k === 3) view.shakeScreen(5, 220);
  }
  await resetAttacker(view, side, slot, 100);
}

async function animDashBurst(view, side, slot, tList, cols, tint) {
  view.sound.sfx('throw');
  await lungeAttacker(view, side, slot, { dist: 24, ms: 140, afterimages: true, tint, jump: 8 });
  view.sound.sfx('hitstrong');
  view.shakeScreen(4.5, 220);
  for (const t of tList) {
    view.burst(t.to.x, t.to.y, cols, 20, { speed: 3.4, r: 2.6 });
    addPart(view, { x: t.to.x, y: t.to.y, vx: 0, vy: 0, r: 8, grow: 2.8, shape: 'ring', c: tint, life: 0.3, max: 0.3 });
  }
  await resetAttacker(view, side, slot, 120);
}

async function animScreenBarrier(view, side, cols) {
  view.sound.sfx('stat');
  const slots = view.battle.aliveSlots(side);
  for (const sl of slots) {
    const c = view.sprCenter(side, sl);
    for (let k = 0; k < 3; k++) addPart(view, { x: c.x + (side === 1 ? -10 : 12), y: c.y, vx: 0, vy: 0, r: 10 + k * 6, grow: 1.1, shape: 'ring', c: cols[k % cols.length], life: 0.48, max: 0.48 });
  }
  await wait(320);
}

async function animPowerDance(view, side, slot, from, cols) {
  view.sound.sfx('stat');
  const o = view.spriteObj(side, slot);
  await view.tween(420, (u) => {
    if (o) { o.sx = 1 + Math.sin(u * Math.PI * 4) * 0.08; o.sy = 1 - Math.sin(u * Math.PI * 4) * 0.08; }
    const ang = u * Math.PI * 6;
    for (let k = 0; k < 2; k++) {
      const a = ang + k * Math.PI;
      addPart(view, { x: from.x + Math.cos(a) * 18, y: from.y + Math.sin(a) * 8 - u * 16, vx: 0, vy: -0.6, r: 2.5, c: cols[k % cols.length], shape: 'crystal', a, life: 0.3, max: 0.3 });
    }
  });
  await resetAttacker(view, side, slot, 80);
}

async function animDrainMove(view, side, slot, from, tList, cols) {
  view.sound.sfx('stat');
  for (const t of tList) view.burst(t.to.x, t.to.y, cols, 12, { speed: 1.8, r: 2.2 });
  await view.tween(420, (u) => {
    if (Math.random() < 0.7) {
      for (const t of tList) {
        const px = t.to.x + (from.x - t.to.x) * ease(u), py = t.to.y + (from.y - t.to.y) * ease(u) - Math.sin(u * Math.PI) * 16;
        addPart(view, { x: px, y: py, vx: 0, vy: 0, r: 2.6, shape: 'flame', c: cols[0], life: 0.25, max: 0.25 });
      }
    }
  });
  view.sound.sfx('heal');
  addPart(view, { x: from.x, y: from.y, vx: 0, vy: 0, r: 8, grow: 1.5, shape: 'ring', c: '#90ff88', life: 0.35, max: 0.35 });
  await wait(140);
}

async function animShadowBlast(view, side, slot, from, tList) {
  const o = view.spriteObj(side, slot);
  const shadowCols = ['#1a052e', '#4a148c', '#7b1fa2', '#00e5ff', '#ffffff'];
  view.sound.sfx('throw');
  await view.tween(300, (u) => {
    if (o) { o.dy = -16 * ease(u); o.white = 0.45 * u; }
    if (Math.random() < 0.75) {
      const ang = Math.random() * Math.PI * 2, dist = 24 + Math.random() * 16;
      addPart(view, { x: from.x + Math.cos(ang) * dist, y: from.y - 14 + Math.sin(ang) * dist, vx: -Math.cos(ang) * 1.9, vy: -Math.sin(ang) * 1.9, r: 2, c: shadowCols[Math.floor(Math.random() * shadowCols.length)], life: 0.3, max: 0.3 });
    }
  });
  view.sound.sfx('throw');
  await view.tween(140, (u) => {
    for (const t of tList) addPart(view, { x: from.x + (t.to.x - from.x) * u, y: (from.y - 14) + (t.to.y - (from.y - 14)) * u, vx: 0, vy: 0, r: 3, c: shadowCols[3], shape: Math.random() < 0.35 ? 'bolt' : null, life: 0.22, max: 0.22 });
  });
  view.shakeScreen(4, 580);
  let lastRing = 0; const t0 = performance.now();
  await view.tween(560, () => {
    const el = performance.now() - t0;
    if (el - lastRing > 65) {
      lastRing = el;
      for (const t of tList) addPart(view, { x: t.to.x, y: t.to.y + 12, vx: 0, vy: -2.4, r: 6, grow: 0.7, tilt: (Math.random() - 0.5) * 0.25, lw: 2.2, shape: 'tornado', c: shadowCols[Math.floor(Math.random() * shadowCols.length)], life: 0.5, max: 0.5 });
    }
    for (const t of tList) addPart(view, { cx: t.to.x, x: t.to.x, y: t.to.y + 12, spiral: true, spiralAngle: Math.random() * 6.28, spiralR: 5, spiralRGrow: 0.4, spiralSpd: 0.25, vx: 0, vy: -2.2, r: 2, c: shadowCols[Math.floor(Math.random() * shadowCols.length)], life: 0.42, max: 0.42 });
  });
  view.sound.sfx('hitstrong');
  view.st.screenFlash = 0.75;
  for (const t of tList) {
    addPart(view, { x: t.to.x, y: t.to.y - 4, vx: 0, vy: 0, r: 10, grow: 3.4, shape: 'ring', c: '#ffffff', life: 0.36, max: 0.36 });
    addPart(view, { x: t.to.x, y: t.to.y - 4, vx: 0, vy: 0, r: 16, grow: 2.6, shape: 'ring', c: '#00e5ff', life: 0.42, max: 0.42 });
    view.burst(t.to.x, t.to.y - 4, shadowCols, 30, { speed: 3.4, r: 2.6 });
  }
  await view.shakeScreen(7, 420);
  await resetAttacker(view, side, slot, 180);
}
