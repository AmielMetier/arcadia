// Interface de Bastion Clash (navigateur uniquement).
// Texture du sol et badge de carte.
'use strict';

/* ---------- Texture du sol (canvas) ---------- */
let terrainCanvas = null;
let terrainTexScale = 1;
const THEMES = {
  vallee: { ground: '#3d7440', blotA: 'rgba(38,84,44,0.38)', blotB: 'rgba(96,150,80,0.26)', speckA: 'rgba(22,50,28,0.22)', speckB: 'rgba(150,200,115,0.2)',
    plateau: '#55804a', plateauB: '#6b9258', rock: [118, 108, 94], rock2: [84, 76, 66], snow: true, cliff: [70, 64, 56],
    road: ['#16181d', '#cbbf9f', '#4a4d55'], roadDash: 'rgba(255,248,234,0.45)', pad: '#5a5e69', padRing: '#ffc531' },
  magma: { ground: '#1b1115', blotA: 'rgba(28,18,24,0.45)', blotB: 'rgba(52,26,30,0.34)', speckA: 'rgba(22,10,14,0.3)', speckB: 'rgba(255,69,0,0.12)',
    plateau: '#2e2128', plateauB: '#3b2a32', rock: [58, 42, 46], rock2: [34, 24, 28], snow: false, cliff: [30, 20, 24],
    road: ['#0e0a0c', '#ff7b00', '#2d2732'], roadDash: 'rgba(255,140,0,0.6)', pad: '#2d252c', padRing: '#ff4500' },
  glace: { ground: '#1a3446', blotA: 'rgba(24,60,86,0.42)', blotB: 'rgba(120,180,210,0.18)', speckA: 'rgba(8,28,44,0.24)', speckB: 'rgba(200,245,255,0.22)',
    plateau: '#3d6580', plateauB: '#4c7896', rock: [150, 186, 206], rock2: [74, 108, 130], snow: true, cliff: [52, 84, 104],
    road: ['#0a1d2c', '#9be7ff', '#2b506b'], roadDash: 'rgba(255,255,255,0.7)', pad: '#344e60', padRing: '#00f0ff' },
  desert: { ground: '#c98a52', blotA: 'rgba(170,98,52,0.32)', blotB: 'rgba(236,184,120,0.3)', speckA: 'rgba(120,64,34,0.22)', speckB: 'rgba(255,226,170,0.24)',
    plateau: '#b0703f', plateauB: '#c27d48', rock: [168, 92, 58], rock2: [126, 66, 42], snow: false, cliff: [104, 54, 36],
    road: ['#3b2416', '#f2d6a2', '#6e4a30'], roadDash: 'rgba(255,240,210,0.55)', pad: '#7b5a44', padRing: '#ff9f1c',
    liq: [['#6b3d22', 38], ['#e2c08a', 22], ['#167f8f', 0], ['#1fb3c4', -24], ['#7fe6ee', -56]] },
  ruines: { ground: '#1b1d27', blotA: 'rgba(40,44,60,0.45)', blotB: 'rgba(12,14,22,0.5)', speckA: 'rgba(0,0,0,0.3)', speckB: 'rgba(120,130,170,0.12)',
    plateau: '#262a38', plateauB: '#2e3344', rock: [64, 70, 92], rock2: [40, 44, 60], snow: false, cliff: [34, 36, 50],
    road: ['#0b0c12', '#ff3df2', '#2a2d3d'], roadDash: 'rgba(61,242,255,0.6)', pad: '#2c3040', padRing: '#ff3df2',
    liq: [['#06140c', 36], ['#3a3f52', 18], ['#0f8f47', 0], ['#2fff8a', -26], ['#c8ffd9', -60]] },
};

function buildTerrainCanvas(mapId = activeMapId) {
  if (!MAP_DEFS[mapId]) mapId = 'vallee';
  const F = MAP_FEATURES;
  const T = THEMES[mapId] || THEMES.vallee;
  const W = WORLD_SIZE;
  const texSize = Math.min(W, 3600);
  terrainTexScale = texSize / W;
  const c = document.createElement('canvas');
  c.width = texSize;
  c.height = texSize;
  const g = c.getContext('2d');
  g.scale(terrainTexScale, terrainTexScale);
  const rnd = mulberry({ magma: 9021, glace: 9022, desert: 9023, ruines: 9024 }[mapId] || 9019);
  const area = (W / BASE_WORLD) ** 2;

  g.fillStyle = T.ground;
  g.fillRect(0, 0, W, W);
  for (let k = 0; k < 70 * area; k++) {
    const bx = rnd() * W, by = rnd() * W, br = 90 + rnd() * 210;
    g.fillStyle = rnd() < 0.5 ? T.blotA : T.blotB;
    g.beginPath(); g.arc(bx, by, br, 0, TAU); g.fill();
  }
  for (let k = 0; k < 11000 * area; k++) {
    g.fillStyle = rnd() < 0.55 ? T.speckA : T.speckB;
    g.fillRect(rnd() * W, rnd() * W, 2 + rnd() * 3.5, 2 + rnd() * 3.5);
  }
  // Détail du sol : brins d'herbe (Vallée), cendres (Magma), congères et craquelures (Glacier)
  if (mapId === 'vallee') {
    // Surtout des brins plus sombres que le sol (relief et profondeur), quelques reflets clairs
    const blades = ['rgba(22,62,28,0.30)', 'rgba(34,82,36,0.26)', 'rgba(18,52,24,0.22)', 'rgba(150,196,104,0.12)'];
    g.lineCap = 'round';
    for (let k = 0; k < 26000 * area; k++) {
      const x = rnd() * W, y = rnd() * W, a = -Math.PI / 2 + (rnd() - 0.5) * 0.9, l = 3 + rnd() * 6;
      g.strokeStyle = blades[(rnd() * blades.length) | 0]; g.lineWidth = 1 + rnd() * 1.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // Petites touffes de fleurs
    for (let k = 0; k < 420 * area; k++) {
      const x = rnd() * W, y = rnd() * W;
      g.fillStyle = ['#f4e3a1', '#e8b4d4', '#fff8ea'][(rnd() * 3) | 0];
      for (let f = 0; f < 5; f++) g.fillRect(x + (rnd() - 0.5) * 18, y + (rnd() - 0.5) * 18, 2.2, 2.2);
    }
  } else if (mapId === 'magma') {
    for (let k = 0; k < 9000 * area; k++) {
      g.fillStyle = rnd() < 0.7 ? 'rgba(70,58,62,0.35)' : 'rgba(255,120,40,0.16)';
      g.beginPath(); g.arc(rnd() * W, rnd() * W, 1 + rnd() * 2.5, 0, TAU); g.fill();
    }
  } else if (mapId === 'glace') {
    for (let k = 0; k < 90 * area; k++) {
      const x = rnd() * W, y = rnd() * W, r = 60 + rnd() * 150;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(235,248,255,0.22)'); gr.addColorStop(1, 'rgba(235,248,255,0)');
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    g.strokeStyle = 'rgba(190,240,255,0.22)';
    for (let k = 0; k < 160 * area; k++) {
      let x = rnd() * W, y = rnd() * W;
      g.lineWidth = 1 + rnd() * 1.5;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) { x += (rnd() - 0.5) * 70; y += (rnd() - 0.5) * 70; g.lineTo(x, y); }
      g.stroke();
    }
  }
  if (mapId === 'desert') {
    // Ondulations des dunes et cailloux
    g.lineCap = 'round';
    for (let k = 0; k < 900 * area; k++) {
      const x = rnd() * W, y = rnd() * W, l = 30 + rnd() * 70;
      g.strokeStyle = rnd() < 0.6 ? 'rgba(150,84,44,0.22)' : 'rgba(255,230,180,0.2)';
      g.lineWidth = 2 + rnd() * 2.5;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 8 - rnd() * 8, x + l, y); g.stroke();
    }
    for (let k = 0; k < 2600 * area; k++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(110,62,38,0.45)' : 'rgba(80,46,30,0.4)';
      g.beginPath(); g.arc(rnd() * W, rnd() * W, 1.5 + rnd() * 3, 0, TAU); g.fill();
    }
  } else if (mapId === 'ruines') {
    // Dalles de béton fissurées, quadrillage de rues et flaques de néon
    g.strokeStyle = 'rgba(80,88,120,0.18)'; g.lineWidth = 2;
    for (let x = 0; x < W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, W); g.stroke(); }
    for (let y = 0; y < W; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    for (let k = 0; k < 220 * area; k++) {
      let x = rnd() * W, y = rnd() * W;
      g.lineWidth = 1 + rnd() * 2;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; g.lineTo(x, y); }
      g.stroke();
    }
    for (let k = 0; k < 70 * area; k++) {
      const x = rnd() * W, y = rnd() * W, r = 20 + rnd() * 50;
      const col = ['255,61,242', '61,242,255', '255,210,61'][(rnd() * 3) | 0];
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(${col},0.22)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }
  if (mapId === 'magma') {
    for (let k = 0; k < 30 * area; k++) {
      const fx = rnd() * W, fy = rnd() * W;
      g.strokeStyle = 'rgba(255, 80, 0, 0.2)';
      g.lineWidth = 3 + rnd() * 6;
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx + (rnd() - 0.5) * 260, fy + (rnd() - 0.5) * 260); g.stroke();
    }
  }

  // Eau / lave / crevasses
  const half = F.liquidHalf;
  const liqStyles = mapId === 'magma'
    ? [['#2b0704', half * 2 + 38], ['#7c1305', half * 2 + 18], ['#d62c00', half * 2 - 6], ['#ff6200', half * 2 - 32], ['#ffea66', half * 2 - 64]]
    : mapId === 'glace'
      ? [['#051018', half * 2 + 36], ['#0a3d54', half * 2 + 16], ['#00c7db', half * 2 - 12], ['#5eead4', half * 2 - 36], ['#e0faff', half * 2 - 62]]
      : T.liq ? T.liq.map(([col, d]) => [col, half * 2 + d])
        : [['#2e3a2c', half * 2 + 38], ['#c8ba9b', half * 2 + 22], ['#1d5f88', half * 2], ['#2b7fb5', half * 2 - 24], ['#4aa3d6', half * 2 - 56]];
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [col, w] of liqStyles) {
    g.strokeStyle = col; g.lineWidth = Math.max(4, w);
    for (const c4 of F.liquids) {
      g.beginPath(); g.moveTo(c4[0], c4[1]); g.bezierCurveTo(c4[2], c4[3], c4[4], c4[5], c4[6], c4[7]); g.stroke();
    }
    g.fillStyle = col;
    for (const p of F.pools) {
      const r = p.r + (w - half * 2) / 2;
      if (r <= 4) continue;
      g.beginPath();
      for (let s = 0; s <= 40; s++) {
        const a = (s / 40) * TAU;
        const rr = r * (1 + 0.12 * Math.sin(a * 5 + p.x));
        const px = p.x + Math.cos(a) * rr, py = p.y + Math.sin(a) * rr;
        if (s === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.fill();
    }
  }

  // Routes et ponts
  for (const [col, extra] of [[T.road[0], 16], [T.road[1], 8], [T.road[2], -4]]) {
    g.strokeStyle = col;
    for (const r of F.roads) {
      g.lineWidth = r[4] * 2 + extra;
      g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); g.stroke();
    }
  }
  g.save();
  g.strokeStyle = T.roadDash; g.lineWidth = 3; g.setLineDash([20, 20]); g.lineCap = 'butt';
  for (const r of F.roads) { g.beginPath(); g.moveTo(r[0], r[1]); g.lineTo(r[2], r[3]); g.stroke(); }
  g.restore();

  // Plateaux, rampes
  for (const P of F.plateaus) {
    g.save();
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.beginPath(); g.arc(P.x + 10, P.y + 14, P.r + CLIFF_W + 6, 0, TAU); g.fill();
    const grad = g.createRadialGradient(P.x, P.y, P.r * 0.2, P.x, P.y, P.r);
    grad.addColorStop(0, T.plateauB); grad.addColorStop(1, T.plateau);
    g.fillStyle = grad;
    g.beginPath(); g.arc(P.x, P.y, P.r + 2, 0, TAU); g.fill();
    for (let k = 0; k < 900 * (P.r / 330) ** 2; k++) {
      const a = rnd() * TAU, rr = Math.sqrt(rnd()) * P.r;
      g.fillStyle = rnd() < 0.5 ? T.speckA : T.speckB;
      g.fillRect(P.x + Math.cos(a) * rr, P.y + Math.sin(a) * rr, 2 + rnd() * 3, 2 + rnd() * 3);
    }
    for (const a of P.ramps) {
      g.save();
      g.translate(P.x, P.y); g.rotate(a);
      const rg = g.createLinearGradient(P.r - 10, 0, P.r + RAMP_LEN, 0);
      rg.addColorStop(0, T.plateau); rg.addColorStop(1, T.road[2]);
      g.fillStyle = rg;
      g.fillRect(P.r - 30, -RAMP_HALF, RAMP_LEN + 34, RAMP_HALF * 2);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 3;
      for (let s = 0; s < 7; s++) {
        const x = P.r + 8 + s * (RAMP_LEN / 7);
        g.beginPath(); g.moveTo(x, -RAMP_HALF + 8); g.lineTo(x, RAMP_HALF - 8); g.stroke();
      }
      g.fillStyle = T.padRing;
      for (const sgn of [-1, 1]) g.fillRect(P.r - 4, sgn * (RAMP_HALF - 4) - 3, RAMP_LEN * 0.85, 6);
      g.restore();
    }
    // Dalle de base (QG) ou anneau central
    g.setLineDash([18, 14]);
    g.strokeStyle = T.padRing; g.lineWidth = 4;
    if (P.main) {
      g.fillStyle = T.pad;
      g.beginPath(); g.arc(P.x, P.y, 96, 0, TAU); g.fill();
      g.beginPath(); g.arc(P.x, P.y, 106, 0, TAU); g.stroke();
    } else {
      g.beginPath(); g.arc(P.x, P.y, 112, 0, TAU); g.stroke();
      g.beginPath(); g.arc(P.x, P.y, P.r - 26, 0, TAU); g.stroke();
    }
    g.restore();
  }

  // Ombrage du relief + roche des montagnes et falaises (calculé depuis la grille de hauteur)
  const N = TER_N;
  const sh = document.createElement('canvas');
  sh.width = N; sh.height = N;
  const sg = sh.getContext('2d');
  const img = sg.createImageData(N, N);
  const d = img.data;
  const H = (x, y) => terH[clamp(y, 0, N - 1) * N + clamp(x, 0, N - 1)];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, o = i * 4;
    const nx = (H(x - 1, y) - H(x + 1, y)) / (2 * TER_CELL), ny = (H(x, y - 1) - H(x, y + 1)) / (2 * TER_CELL);
    const len = Math.hypot(nx, ny, 1);
    const light = (nx * -0.55 + ny * -0.62 + 0.56) / len;     // lumière venant du nord-ouest
    const t = terType[i];
    if (t === T_MOUNT || t === T_CLIFF) {
      const hgt = terH[i];
      const base = t === T_CLIFF ? T.cliff : (hgt > 82 ? T.rock : T.rock2);
      let [r, gg, b] = base;
      const k2 = clamp(0.55 + light * 0.75, 0.25, 1.35);
      r *= k2; gg *= k2; b *= k2;
      if (T.snow && t === T_MOUNT && hgt > 104) { const s = smooth01((hgt - 104) / 22); r = lerp(r, 236, s); gg = lerp(gg, 242, s); b = lerp(b, 248, s); }
      if (mapId === 'magma' && t === T_MOUNT && hgt > 110) { const s = smooth01((hgt - 110) / 18); r = lerp(r, 255, s * 0.8); gg = lerp(gg, 90, s * 0.8); b = lerp(b, 10, s * 0.8); }
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
    } else {
      // Occlusion ambiante : le sol s'assombrit au pied des falaises et des montagnes
      let occ = 0;
      for (let oy = -3; oy <= 3; oy++) for (let ox = -3; ox <= 3; ox++) {
        const tt = terType[clamp(y + oy, 0, N - 1) * N + clamp(x + ox, 0, N - 1)];
        if ((tt === T_CLIFF || tt === T_MOUNT) && (t === T_LOW || t === T_RAMP)) occ += 1 / (1 + ox * ox + oy * oy);
      }
      const shade = clamp(0.62 - light + Math.min(0.35, occ * 0.09), -0.4, 0.75);
      if (shade > 0) { d[o] = 0; d[o + 1] = 0; d[o + 2] = 0; d[o + 3] = Math.round(shade * 230); }
      else { d[o] = 255; d[o + 1] = 248; d[o + 2] = 220; d[o + 3] = Math.round(-shade * 70); }
    }
  }
  sg.putImageData(img, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(sh, 0, 0, N * TER_CELL, N * TER_CELL);

  g.strokeStyle = '#0b0e12';
  g.lineWidth = 18;
  g.strokeRect(9, 9, W - 18, W - 18);
  terrainCanvas = c;
}


function onMapInitView(mapId) {
  buildTerrainCanvas(mapId);
  updateMapUI();
  if (typeof setupThreeMapScenery === 'function' && threeReady && threeScene) {
    setupThreeMapScenery(mapId);
  }
}

function updateMapUI() {
  const def = MAP_DEFS[activeMapId] || MAP_DEFS.vallee;
  const badgeEl = $('#uiMapBadgeTxt'), badgeWrap = $('#uiMapBadge');
  if (badgeEl) badgeEl.innerHTML = `${def.icon} <span class="mtxt">${def.name}${activeLayout === '2v2' ? ' · 2v2 (carte XL)' : activeLayout === '1v1' ? ' · Duel' : ''}</span>`;
  if (badgeWrap) badgeWrap.title = `${def.name} : ${def.desc}\nSpécificité : ${def.badgeDesc}`;
}
