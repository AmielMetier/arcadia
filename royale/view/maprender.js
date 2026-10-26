// La carte en 2D : le relief peint une fois dans une image (hauteurs, eau, plages, forêts, roche, neige, ombrage),
// puis tout le reste en vectoriel à chaque image (routes, bâtiments et leurs plans, décor, coffres, noms, grille,
// tempête, montgolfière). Sert à l'aperçu de la carte et servira de carte du jeu (touche M) et de minicarte.
import { CELL, SNOW, WATER, PROPS } from '../engine/map.js';

const ss = (a, b, x) => { let t = (x - a) / (b - a); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const rgb = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// palette reprise de Birdie Party (herbes, sable, eau), éclaircie pour une carte lisible
export const PAL = {
  deep: rgb(0x1f5f9e), shallow: rgb(0x5cc4c6), lakeDeep: rgb(0x23709e), lakeShallow: rgb(0x58b8c4), foam: rgb(0xd8f2ee),
  plain: rgb(0x8dbd52), plain2: rgb(0x7aae47), forest: rgb(0x4d8a36), sand: rgb(0xe9d9a6), rock: rgb(0xb0a796), rock2: rgb(0x958b7c), snow: rgb(0xf3f5f8),
  bank: rgb(0xb9b48a),
};
export const CAR_COLORS = ['#e8473a', '#f2c14e', '#3d7fd9', '#f4f2ea', '#3fae6a', '#7c5cc4', '#5d5a55'];
const CONT_COLORS = ['#c8553d', '#2f7fb5', '#3c9d5d', '#d9a441'];
const ROOF = {
  pente: { pierre: ['#c4593f', '#a5452f'], bois: ['#8f5d3b', '#76492c'], metal: ['#7d93a0', '#687e8b'] },
  plat: { pierre: ['#b3b2ad', '#9a9993'], bois: ['#a58560', '#8d7050'], metal: ['#95a8b3', '#7f939e'] },
};
export const POI_COLORS = {
  ville: '#e8473a', bourg: '#f08a3c', village: '#f2c14e', port: '#3d9fd9', phare: '#f4f2ea', chalet: '#8f5d3b', carriere: '#9a958c',
  ferme: '#d9a441', usine: '#7d93a0', camping: '#3fae6a', scierie: '#a5743f', manoir: '#7c5cc4', station: '#e85a8a',
};
const CROPS = { ble: ['#e4c65e', '#d6b54c'], mais: ['#c8cf5c', '#b5bd4c'], colza: ['#f0dc3c', '#e2cb2c'] };

// ------------------------------------------------------------------ l'image du relief (une fois par île)
export function terrainImage(map, { ppm = 1, contours = false } = {}) {
  const S = map.size, W = Math.round(S * ppm), N = map.n, HR = map.hres;
  const H = map.heights, WK = map.water, WL = map.waterLevel, E = map.inland, M = map.mountain;
  // champs auxiliaires sur la grille des hauteurs : profondeur d'eau (négative à sec) et densité de forêt
  const D = new Float32Array(N * N), F = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) {
    D[k] = WK[k] ? WL[k] - H[k] : -0.6;
    const i = k % N, j = (k - i) / N;
    F[k] = map.forestAt(i * HR, j * HR);
  }
  const bil = (A, x, z) => {
    let fx = x / HR, fz = z / HR;
    fx = fx < 0 ? 0 : fx > N - 1.001 ? N - 1.001 : fx; fz = fz < 0 ? 0 : fz > N - 1.001 ? N - 1.001 : fz;
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j, k = j * N + i;
    return (A[k] * (1 - tx) + A[k + 1] * tx) * (1 - tz) + (A[k + N] * (1 - tx) + A[k + N + 1] * tx) * tz;
  };
  const cv = makeCanvas(W, W), ctx = cv.getContext('2d'), img = ctx.createImageData(W, W), px = img.data;
  const L = [-0.55, 0.75, -0.42], ll = Math.hypot(...L);
  const step = 1 / ppm;
  for (let py = 0; py < W; py++) {
    const z = (py + 0.5) / ppm;
    for (let qx = 0; qx < W; qx++) {
      const x = (qx + 0.5) / ppm;
      const k = Math.min(N - 1, Math.round(z / HR)) * N + Math.min(N - 1, Math.round(x / HR));
      const dep = bil(D, x, z);
      let c;
      if (dep > 0) {
        const lake = WK[k] === WATER.LAC || WK[k] === WATER.RIVIERE;
        c = lake ? mixc(PAL.lakeShallow, PAL.lakeDeep, ss(0, 5, dep)) : mixc(PAL.shallow, PAL.deep, ss(0, 9, dep));
        if (dep < 0.45) c = mixc(PAL.foam, c, ss(0, 0.45, dep));
      } else {
        const h = bil(H, x, z), e = bil(E, x, z), m = bil(M, x, z), f = bil(F, x, z);
        const hx = bil(H, x + step, z) - bil(H, x - step, z), hz = bil(H, x, z + step) - bil(H, x, z - step);
        const g = Math.hypot(hx, hz) / (2 * step);
        // herbe : plaine, nuances, sous-bois
        c = mixc(PAL.plain, PAL.plain2, ss(-0.2, 0.6, Math.sin(x * 0.021) * Math.cos(z * 0.017) + Math.sin((x + z) * 0.008)) * 0.6);
        c = mixc(c, PAL.forest, ss(0.22, 0.62, f) * 0.85);
        // plage, berges du lac et de la rivière
        if (e < 18) c = mixc(c, PAL.sand, ss(2.6, 1.2, h) * ss(18, 8, e));
        if (dep > -0.6 && dep <= 0) c = mixc(c, PAL.bank, 0.5);
        // roche selon l'altitude et la pente, neige en haut
        const rk = Math.max(ss(30, 72, h) * ss(0.12, 0.4, m), ss(0.7, 1.2, g) * ss(0.05, 0.25, m));
        c = mixc(c, mixc(PAL.rock, PAL.rock2, ss(0.5, 1.3, g)), rk);
        c = mixc(c, PAL.snow, ss(SNOW - 6, SNOW + 2, h) * (1 - ss(1.1, 1.6, g) * 0.5));
        // ombrage (lumière du nord-ouest, relief exagéré)
        const nx = -hx / (2 * step) * 1.5, nz = -hz / (2 * step) * 1.5, nl = Math.hypot(nx, 1, nz);
        const sh = (nx * L[0] + L[1] + nz * L[2]) / (nl * ll);
        const lit = 0.72 + 0.42 * sh;
        c = [c[0] * lit, c[1] * lit, c[2] * lit];
        if (contours) {
          const fr = h / 10 - Math.floor(h / 10);
          if (h > 3 && (fr < 0.06 || fr > 0.94)) c = mixc(c, [40, 50, 40], 0.18);
        }
      }
      const o = (py * W + qx) * 4;
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2]; px[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return cv;
}

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}

// ------------------------------------------------------------------ le dessin vectoriel
// view : { x, z (centre, m), s (pixels par mètre), w, h (pixels CSS), dpr }
// opts : { layers: { relief, routes, batiments, vegetation, vehicules, coffres, butin, noms, grille, tempete, vol },
//          storm: [cercles], phase, flight, level (étage affiché dans les plans), sel, hover }
export function drawMap(ctx, map, terrain, view, opts) {
  const { x: vx, z: vz, s, w, h, dpr = 1 } = view;
  const L = opts.layers;
  const S = map.size;
  const toScreen = (x, z) => [(x - vx) * s + w / 2, (z - vz) * s + h / 2];
  const world = () => ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (w / 2 - vx * s), dpr * (h / 2 - vz * s));
  const screen = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const px = (n) => n / s; // n pixels à l'écran, en mètres
  // ce qui est visible (m), pour ne pas dessiner le reste
  const vis = { x0: vx - w / 2 / s - 20, x1: vx + w / 2 / s + 20, z0: vz - h / 2 / s - 20, z1: vz + h / 2 / s + 20 };
  const seen = (x, z, m = 0) => x > vis.x0 - m && x < vis.x1 + m && z > vis.z0 - m && z < vis.z1 + m;

  screen();
  ctx.fillStyle = '#1f5f9e';
  ctx.fillRect(0, 0, w, h);
  world();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  if (L.relief !== false) ctx.drawImage(terrain, 0, 0, S, S);

  // champs, places, rues, quais
  for (const f of map.fields) {
    const [a, b] = CROPS[f.crop];
    ctx.fillStyle = a; ctx.fillRect(f.x0, f.z0, f.x1 - f.x0, f.z1 - f.z0);
    ctx.fillStyle = b;
    if (f.alongX) for (let z = f.z0 + 1.5; z < f.z1; z += 4) ctx.fillRect(f.x0, z, f.x1 - f.x0, 1.3);
    else for (let x = f.x0 + 1.5; x < f.x1; x += 4) ctx.fillRect(x, f.z0, 1.3, f.z1 - f.z0);
  }
  if (L.routes !== false) {
    for (const p of map.plazas) { ctx.fillStyle = '#e8dfc9'; ctx.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0); }
    ctx.fillStyle = '#a99f8b';
    for (const st of map.streets) ctx.fillRect(st.x0 - 0.5, st.z0 - 0.5, st.x1 - st.x0 + 1, st.z1 - st.z0 + 1);
    ctx.fillStyle = '#ddd5c4';
    for (const st of map.streets) ctx.fillRect(st.x0, st.z0, st.x1 - st.x0, st.z1 - st.z0);
    // routes : bordure, chaussée, pointillés au centre quand on est assez près
    ctx.lineJoin = ctx.lineCap = 'round';
    const line = (r) => { ctx.beginPath(); r.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.z) : ctx.moveTo(p.x, p.z))); };
    for (const r of map.roads) { line(r); ctx.strokeStyle = r.kind === 'route' ? '#9a8f78' : '#97815a'; ctx.lineWidth = r.hw * 2 + Math.max(1, px(1.6)); ctx.stroke(); }
    for (const r of map.roads) { line(r); ctx.strokeStyle = r.kind === 'route' ? '#e4dbc4' : '#cdb487'; ctx.lineWidth = r.hw * 2; ctx.stroke(); }
    if (s > 1.4) {
      ctx.setLineDash([3, 4]); ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 0.35;
      for (const r of map.roads) if (r.kind === 'route') { line(r); ctx.stroke(); }
      ctx.setLineDash([]);
    }
    for (const b of map.bridges) {
      const dx = b.x1 - b.x0, dz = b.z1 - b.z0, l = Math.hypot(dx, dz) || 1, nx = -dz / l * b.hw, nz = dx / l * b.hw;
      ctx.beginPath(); ctx.moveTo(b.x0 + nx, b.z0 + nz); ctx.lineTo(b.x1 + nx, b.z1 + nz); ctx.lineTo(b.x1 - nx, b.z1 - nz); ctx.lineTo(b.x0 - nx, b.z0 - nz); ctx.closePath();
      ctx.fillStyle = '#b29a72'; ctx.fill(); ctx.strokeStyle = '#5e4a32'; ctx.lineWidth = Math.max(0.4, px(1.4)); ctx.stroke();
    }
    for (const d of map.docks) {
      ctx.fillStyle = '#a77b4f'; ctx.fillRect(d.x0, d.z0, d.x1 - d.x0, d.z1 - d.z0);
      ctx.strokeStyle = '#6e4e30'; ctx.lineWidth = Math.max(0.3, px(1)); ctx.strokeRect(d.x0, d.z0, d.x1 - d.x0, d.z1 - d.z0);
    }
  }

  // auvents et objets plats sous le reste
  const props = map.props;
  if (L.batiments !== false) for (const p of props) if (p.kind === 'auvent' && seen(p.x, p.z, 10)) {
    ctx.fillStyle = 'rgba(245,245,240,.85)'; ctx.strokeStyle = '#9b9b95'; ctx.lineWidth = Math.max(0.3, px(1));
    const W = p.dx ? 18 : 9, D = p.dx ? 9 : 18;
    ctx.fillRect(p.x - W / 2, p.z - D / 2, W, D); ctx.strokeRect(p.x - W / 2, p.z - D / 2, W, D);
  }

  // décor : ombres puis objets (arbres en dernier, ils recouvrent un peu les routes comme vus du ciel)
  const showVeg = L.vegetation !== false, showCars = L.vehicules !== false;
  const sh = 'rgba(14,30,10,.28)';
  if (showVeg) {
    ctx.fillStyle = sh;
    for (const p of props) {
      if ((p.kind !== 'arbre' && p.kind !== 'sapin') || !seen(p.x, p.z)) continue;
      const r = (p.kind === 'arbre' ? 3.1 : 2.4) * p.s;
      ctx.beginPath(); ctx.arc(p.x + r * 0.45, p.z + r * 0.45, r, 0, 6.283); ctx.fill();
    }
  }
  for (const p of props) {
    if (!seen(p.x, p.z, 8)) continue;
    const k = p.kind;
    if (k === 'arbre' || k === 'sapin' || k === 'auvent') continue;
    if (k === 'buisson') { if (!showVeg) continue; ctx.fillStyle = '#4f8a38'; ctx.beginPath(); ctx.arc(p.x, p.z, 1.2 * p.s, 0, 6.283); ctx.fill(); continue; }
    if (k === 'rocher') {
      if (!showVeg) continue;
      const r = 1.3 * p.s;
      ctx.fillStyle = 'rgba(20,20,20,.25)'; ctx.beginPath(); ctx.arc(p.x + r * 0.35, p.z + r * 0.35, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#9d988f'; ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#c4beb3'; ctx.beginPath(); ctx.arc(p.x - r * 0.3, p.z - r * 0.3, r * 0.45, 0, 6.283); ctx.fill();
      continue;
    }
    const veh = k === 'voiture' || k === 'camion' || k === 'tracteur' || k === 'engin';
    if (veh && !showCars) continue;
    if (!veh && L.batiments === false) continue;
    drawProp(ctx, p, s);
  }
  if (showVeg) {
    for (const p of props) {
      if ((p.kind !== 'arbre' && p.kind !== 'sapin') || !seen(p.x, p.z)) continue;
      const pine = p.kind === 'sapin', r = (pine ? 2.4 : 3.1) * p.s;
      ctx.fillStyle = pine ? '#2e6536' : '#3f7f31';
      ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 6.283); ctx.fill();
      ctx.fillStyle = pine ? '#3f7a45' : '#5c9c44';
      ctx.beginPath(); ctx.arc(p.x - r * 0.28, p.z - r * 0.28, r * (pine ? 0.45 : 0.55), 0, 6.283); ctx.fill();
    }
  }

  // bâtiments : toits de loin, plans de l'étage choisi de près
  if (L.batiments !== false) {
    const plan = s >= 2.2;
    for (const b of map.buildings) {
      const x0 = b.x0 * CELL, z0 = b.z0 * CELL, W = b.w * CELL, D = b.d * CELL;
      if (!seen(x0 + W / 2, z0 + D / 2, Math.max(W, D))) continue;
      const lv = opts.level ?? 0;
      if (plan && lv < b.floors) drawPlan(ctx, b, lv, px);
      else drawRoof(ctx, b, s, px);
      if (opts.hover === b || opts.sel === b) {
        ctx.strokeStyle = opts.sel === b ? '#ffd23f' : 'rgba(255,230,120,.9)'; ctx.lineWidth = px(opts.sel === b ? 3 : 2);
        ctx.strokeRect(x0 - px(2), z0 - px(2), W + px(4), D + px(4));
      }
    }
  }

  // tempête : dehors en violet, cercle actuel en blanc, prochain cercle en pointillés
  if (L.tempete && opts.storm) {
    const ph = opts.storm[Math.min(opts.phase || 0, opts.storm.length - 1)], next = opts.storm[(opts.phase || 0) + 1];
    ctx.beginPath(); ctx.rect(-S, -S, S * 3, S * 3); ctx.arc(ph.x, ph.z, Math.max(ph.r, 0.01), 0, 6.283, true);
    ctx.fillStyle = 'rgba(112,52,200,.34)'; ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = px(2.5);
    ctx.beginPath(); ctx.arc(ph.x, ph.z, Math.max(ph.r, 0.01), 0, 6.283); ctx.stroke();
    if (next) {
      ctx.setLineDash([px(7), px(6)]); ctx.lineWidth = px(1.8);
      ctx.beginPath(); ctx.arc(next.x, next.z, Math.max(next.r, px(4)), 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
    }
  }

  // ------------------------------------------------------------------ en pixels écran : marqueurs, noms, grille, vol
  screen();
  if (L.coffres !== false || L.butin) {
    if (L.butin && s > 0.9) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 1;
      for (const c of map.loot) {
        if ((c.k !== (opts.level ?? 0) && s >= 2.2) || !seen(c.x, c.z)) continue;
        const [a, b] = toScreen(c.x, c.z);
        ctx.beginPath(); ctx.moveTo(a, b - 3); ctx.lineTo(a + 3, b); ctx.lineTo(a, b + 3); ctx.lineTo(a - 3, b); ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      ctx.fillStyle = '#5fcf6a';
      for (const c of map.ammo) {
        if ((c.k !== (opts.level ?? 0) && s >= 2.2) || !seen(c.x, c.z)) continue;
        const [a, b] = toScreen(c.x, c.z);
        ctx.fillRect(a - 3, b - 3, 6, 6); ctx.strokeRect(a - 3, b - 3, 6, 6);
      }
    }
    if (L.coffres !== false) {
      const R = s > 1.5 ? 5 : s > 0.8 ? 4 : 3;
      for (const c of map.chests) {
        if ((s >= 2.2 && c.k >= 0 && c.k !== (opts.level ?? 0)) || !seen(c.x, c.z)) continue;
        const [a, b] = toScreen(c.x, c.z);
        ctx.fillStyle = '#ffcf33'; ctx.strokeStyle = '#3a2a00'; ctx.lineWidth = 1.5;
        roundRect(ctx, a - R, b - R * 0.8, R * 2, R * 1.6, 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(a - R, b - R * 0.1); ctx.lineTo(a + R, b - R * 0.1); ctx.stroke();
        if (c.k < 0) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(a, b, R + 3.5, 0, 6.283); ctx.stroke(); }
      }
    }
  }

  if (L.vol && opts.flight) {
    const f = opts.flight, [a, b] = toScreen(f.x0, f.z0), [c, d] = toScreen(f.x1, f.z1);
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, d); ctx.stroke(); ctx.setLineDash([]);
    const ang = Math.atan2(d - b, c - a);
    // flèche au milieu du trajet
    const mx = (a + c) / 2, my = (b + d) / 2;
    ctx.fillStyle = '#fff'; ctx.save(); ctx.translate(mx, my); ctx.rotate(ang);
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-6, -7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill(); ctx.restore();
    // montgolfière au départ visible
    const t = clampSeg(a, b, c, d, w, h);
    if (t) { balloon(ctx, t[0], t[1]); }
  }

  if (L.grille) {
    const step = S / 10;
    ctx.strokeStyle = 'rgba(255,255,255,.32)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 10; i++) {
      const [a] = toScreen(i * step, 0), [, b] = toScreen(0, i * step);
      ctx.moveTo(Math.round(a) + 0.5, 0); ctx.lineTo(Math.round(a) + 0.5, h);
      ctx.moveTo(0, Math.round(b) + 0.5); ctx.lineTo(w, Math.round(b) + 0.5);
    }
    ctx.stroke();
    ctx.font = '900 12px Nunito, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = 0; i < 10; i++) {
      const [a] = toScreen((i + 0.5) * step, 0), [, b] = toScreen(0, (i + 0.5) * step);
      // lettres en haut, chiffres à gauche, sans se marcher dessus dans le coin
      if (a > 22) outlined(ctx, 'ABCDEFGHIJ'[i], a, Math.max(10, toScreen(0, 0)[1] + 10), '#fff', 'rgba(10,30,50,.7)', 3);
      if (b > 22) outlined(ctx, String(i + 1), Math.max(10, toScreen(0, 0)[0] + 10), b, '#fff', 'rgba(10,30,50,.7)', 3);
    }
  }

  if (L.noms !== false) {
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const lb of map.labels) {
      const [a, b] = toScreen(lb.x, lb.z);
      if (a < -100 || b < -40 || a > w + 100 || b > h + 40) continue;
      if (lb.nature) {
        ctx.font = 'italic 800 12.5px Nunito, system-ui, sans-serif';
        const col = lb.kind === 'mont' ? 'rgba(70,45,20,.85)' : 'rgba(18,58,96,.85)';
        outlined(ctx, lb.alt ? `${lb.text} · ${lb.alt} m` : lb.text, a, b, '#fff', col, 3.2);
        continue;
      }
      const big = lb.kind === 'ville' ? 17 : lb.kind === 'bourg' ? 15 : lb.town ? 13 : 11.5;
      ctx.font = `900 ${big}px Nunito, system-ui, sans-serif`;
      const text = lb.town ? lb.text.toUpperCase() : lb.text;
      // pastille de couleur du type de lieu
      const tw = ctx.measureText(text).width;
      ctx.fillStyle = POI_COLORS[lb.kind] || '#fff'; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(a - tw / 2 - 9, b, lb.town ? 5 : 4, 0, 6.283); ctx.fill(); ctx.stroke();
      outlined(ctx, text, a, b, '#fff', '#16181d', lb.town ? 4 : 3.4);
    }
  }
}

function clampSeg(a, b, c, d, w, h) {
  // premier point du segment visible à l'écran (pour poser la montgolfière)
  for (let t = 0; t <= 1; t += 0.01) {
    const x = a + (c - a) * t, y = b + (d - b) * t;
    if (x > 24 && y > 24 && x < w - 24 && y < h - 24) return [x, y];
  }
  return null;
}
function balloon(ctx, x, y) {
  ctx.save(); ctx.translate(x, y - 14);
  ctx.strokeStyle = '#16181d'; ctx.lineWidth = 2;
  ctx.fillStyle = '#e8473a'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.ellipse(0, 0, 4, 10, 0, 0, 6.283); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-6, 8); ctx.lineTo(-3, 15); ctx.moveTo(6, 8); ctx.lineTo(3, 15); ctx.stroke();
  ctx.fillStyle = '#8f5d3b'; ctx.fillRect(-4, 15, 8, 6); ctx.strokeRect(-4, 15, 8, 6);
  ctx.restore();
}
function outlined(ctx, text, x, y, fill, stroke, lw) {
  ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeText(text, x, y);
  ctx.fillStyle = fill; ctx.fillText(text, x, y);
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// objets orientés (voitures, conteneurs…) : rectangle tourné selon (dx, dz)
function oriented(ctx, p, L, W, fill, stroke, lw) {
  const l = Math.hypot(p.dx, p.dz) || 1, ux = p.dx / l, uz = p.dz / l;
  ctx.save(); ctx.transform(ux, uz, -uz, ux, p.x, p.z);
  ctx.fillStyle = fill; ctx.fillRect(-L / 2, -W / 2, L, W);
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.strokeRect(-L / 2, -W / 2, L, W); }
  ctx.restore();
}
function drawProp(ctx, p, s) {
  const lw = Math.max(0.15, 1 / s);
  const circle = (r, fill, stroke) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.arc(p.x, p.z, r, 0, 6.283); ctx.fill(); if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } };
  switch (p.kind) {
    case 'voiture': oriented(ctx, p, 4.4, 2, p.epave ? '#6d5a4a' : CAR_COLORS[p.c % CAR_COLORS.length], '#1d1d1d', lw); if (s > 2) oriented(ctx, { ...p }, 1.6, 1.6, 'rgba(160,210,240,.85)'); break;
    case 'camion': oriented(ctx, p, 7.5, 2.6, '#d9d6cf', '#1d1d1d', lw); break;
    case 'tracteur': oriented(ctx, p, 3.6, 2.2, '#3f9d4a', '#1d1d1d', lw); break;
    case 'engin': oriented(ctx, p, 5.5, 3, '#f2b632', '#1d1d1d', lw); break;
    case 'conteneur': oriented(ctx, p, 6, 2.5, CONT_COLORS[p.c % CONT_COLORS.length], '#1d1d1d', lw); break;
    case 'bateau': ctx.save(); ctx.translate(p.x, p.z); ctx.rotate(Math.atan2(p.dz, p.dx)); ctx.fillStyle = '#9c6b3f'; ctx.strokeStyle = '#3b2715'; ctx.lineWidth = lw;
      ctx.beginPath(); ctx.ellipse(0, 0, 2.8, 1.1, 0, 0, 6.283); ctx.fill(); ctx.stroke(); ctx.restore(); break;
    case 'grume': oriented(ctx, p, 6, 2.6, '#9a6a3c', '#4a3018', lw); break;
    case 'silo': circle(3, '#d4d2cc', '#55524c'); circle(1.2, '#b9b6af'); break;
    case 'citerne': circle(2.4, '#e9e7e1', '#55524c'); break;
    case 'cheminee': circle(1.7, '#9a4a36', '#3b1a10'); circle(0.9, '#2a2a2a'); break;
    case 'botte': circle(1, '#e2c25a', '#8a6d1d'); break;
    case 'caisse': ctx.fillStyle = '#b07d48'; ctx.fillRect(p.x - 0.6, p.z - 0.6, 1.2, 1.2); ctx.strokeStyle = '#4a3018'; ctx.lineWidth = lw; ctx.strokeRect(p.x - 0.6, p.z - 0.6, 1.2, 1.2); break;
    case 'tente': ctx.fillStyle = '#ef8b3c'; ctx.beginPath(); ctx.moveTo(p.x, p.z - 1.6); ctx.lineTo(p.x + 1.5, p.z + 1.2); ctx.lineTo(p.x - 1.5, p.z + 1.2); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#6a3410'; ctx.lineWidth = lw; ctx.stroke(); break;
    case 'table': ctx.fillStyle = '#a5743f'; ctx.fillRect(p.x - 1, p.z - 0.5, 2, 1); break;
    case 'feu': circle(1.4, 'rgba(255,170,60,.35)'); circle(0.7, '#ff7a1a', '#7a2a00'); break;
    case 'fontaine': circle(3.2, '#cfc6b2', '#6d6455'); circle(2.4, '#5cc4d6'); circle(0.6, '#cfc6b2'); break;
    case 'pompe': ctx.fillStyle = '#e8473a'; ctx.fillRect(p.x - 0.5, p.z - 0.4, 1, 0.8); break;
    default: break;
  }
}

function drawRoof(ctx, b, s, px) {
  const x0 = b.x0 * CELL, z0 = b.z0 * CELL, W = b.w * CELL, D = b.d * CELL;
  const off = 0.8 + b.floors * 1.1 + (b.tall ? 1.5 : 0);
  ctx.fillStyle = 'rgba(10,20,10,.32)';
  ctx.fillRect(x0 + off, z0 + off, W, D);
  const lw = Math.max(0.25, px(1.2));
  if (b.roof === 'phare') {
    ctx.fillStyle = '#f4f2ea'; ctx.beginPath(); ctx.arc(x0 + W / 2, z0 + D / 2, W / 2, 0, 6.283); ctx.fill();
    ctx.strokeStyle = '#16181d'; ctx.lineWidth = lw; ctx.stroke();
    ctx.fillStyle = '#e8473a'; ctx.beginPath(); ctx.arc(x0 + W / 2, z0 + D / 2, W / 4, 0, 6.283); ctx.fill(); ctx.stroke();
    return;
  }
  const mat = b.abandoned ? 'bois' : b.mat;
  const [c1, c2] = (ROOF[b.roof] || ROOF.plat)[mat] || ROOF.plat.pierre;
  if (b.roof === 'pente') {
    // deux pans de part et d'autre du faîtage (le long du grand côté)
    const alongX = W >= D;
    ctx.fillStyle = c1;
    if (alongX) { ctx.fillRect(x0, z0, W, D / 2); ctx.fillStyle = c2; ctx.fillRect(x0, z0 + D / 2, W, D / 2); }
    else { ctx.fillRect(x0, z0, W / 2, D); ctx.fillStyle = c2; ctx.fillRect(x0 + W / 2, z0, W / 2, D); }
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = lw;
    ctx.beginPath();
    if (alongX) { ctx.moveTo(x0, z0 + D / 2); ctx.lineTo(x0 + W, z0 + D / 2); } else { ctx.moveTo(x0 + W / 2, z0); ctx.lineTo(x0 + W / 2, z0 + D); }
    ctx.stroke();
    if (b.abandoned) {
      // toit percé
      ctx.fillStyle = 'rgba(30,20,10,.55)';
      const hx = x0 + W * ((b.id * 37) % 60 + 20) / 100, hz = z0 + D * ((b.id * 53) % 60 + 20) / 100;
      ctx.beginPath(); ctx.ellipse(hx, hz, W * 0.12, D * 0.1, 0.5, 0, 6.283); ctx.fill();
    }
  } else {
    ctx.fillStyle = c2; ctx.fillRect(x0, z0, W, D);
    ctx.fillStyle = c1; ctx.fillRect(x0 + 0.8, z0 + 0.8, W - 1.6, D - 1.6);
    if (b.mat === 'metal' && s > 0.9) {
      ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = lw * 0.7; ctx.beginPath();
      for (let x = x0 + 1.5; x < x0 + W - 1; x += 1.6) { ctx.moveTo(x, z0 + 0.8); ctx.lineTo(x, z0 + D - 0.8); }
      ctx.stroke();
    }
    if (b.roofHatch) { ctx.fillStyle = '#5b5a55'; ctx.fillRect(b.roofHatch.x * CELL + 1, b.roofHatch.z * CELL + 1, 2, 2); }
  }
  ctx.strokeStyle = '#16181d'; ctx.lineWidth = lw;
  ctx.strokeRect(x0, z0, W, D);
}

const FLOORS = { bois: '#e6d1a8', pierre: '#ece5d6', metal: '#d8dcdf' };
function drawPlan(ctx, b, k, px) {
  const lv = b.levels[k], x0 = b.x0 * CELL, z0 = b.z0 * CELL, W = b.w * CELL, D = b.d * CELL;
  ctx.fillStyle = 'rgba(10,20,10,.25)'; ctx.fillRect(x0 + 0.6, z0 + 0.6, W, D);
  ctx.fillStyle = FLOORS[b.mat] || FLOORS.pierre; ctx.fillRect(x0, z0, W, D);
  // quadrillage discret des cases de 4 m
  ctx.strokeStyle = 'rgba(0,0,0,.07)'; ctx.lineWidth = px(1); ctx.beginPath();
  for (let i = 1; i < b.w; i++) { ctx.moveTo(x0 + i * CELL, z0); ctx.lineTo(x0 + i * CELL, z0 + D); }
  for (let j = 1; j < b.d; j++) { ctx.moveTo(x0, z0 + j * CELL); ctx.lineTo(x0 + W, z0 + j * CELL); }
  ctx.stroke();
  // trémie (l'escalier du dessous arrive ici) et escalier qui monte
  if (lv.hole) { ctx.fillStyle = 'rgba(40,35,30,.45)'; ctx.fillRect(lv.hole.x * CELL, lv.hole.z * CELL, CELL, CELL); }
  if (lv.stairs) {
    const st = lv.stairs, sx = st.x * CELL, sz = st.z * CELL;
    ctx.fillStyle = '#c9b48f'; ctx.fillRect(sx + 0.3, sz + 0.3, CELL - 0.6, CELL - 0.6);
    ctx.strokeStyle = '#6b5a3e'; ctx.lineWidth = px(1); ctx.beginPath();
    for (let t = 0.5; t < CELL; t += 0.5) {
      if (st.dx) { ctx.moveTo(sx + t, sz + 0.4); ctx.lineTo(sx + t, sz + CELL - 0.4); } else { ctx.moveTo(sx + 0.4, sz + t); ctx.lineTo(sx + CELL - 0.4, sz + t); }
    }
    ctx.stroke();
    // flèche : sens de la montée
    const cx = sx + CELL / 2, cz = sz + CELL / 2;
    ctx.strokeStyle = '#3b2f1d'; ctx.lineWidth = px(2); ctx.beginPath();
    ctx.moveTo(cx - st.dx * 1.4, cz - st.dz * 1.4); ctx.lineTo(cx + st.dx * 1.4, cz + st.dz * 1.4);
    ctx.lineTo(cx + st.dx * 0.6 - st.dz * 0.7, cz + st.dz * 0.6 + st.dx * 0.7);
    ctx.moveTo(cx + st.dx * 1.4, cz + st.dz * 1.4); ctx.lineTo(cx + st.dx * 0.6 + st.dz * 0.7, cz + st.dz * 0.6 - st.dx * 0.7);
    ctx.stroke();
  }
  // pans : murs, fenêtres, portes, portails, trous
  const T = 0.42;
  for (const e of lv.walls) {
    const ax = e.x * CELL, az = e.z * CELL, bx = e.o === 'h' ? ax + CELL : ax, bz = e.o === 'h' ? az : az + CELL;
    const seg = (t0, t1, col, wd) => {
      ctx.strokeStyle = col; ctx.lineWidth = wd; ctx.beginPath();
      ctx.moveTo(ax + (bx - ax) * t0, az + (bz - az) * t0); ctx.lineTo(ax + (bx - ax) * t1, az + (bz - az) * t1); ctx.stroke();
    };
    ctx.lineCap = 'square';
    const wall = e.ext ? (b.mat === 'bois' ? '#5a3b22' : b.mat === 'metal' ? '#4a5560' : '#3b3530') : '#6d655b';
    const wd = e.ext ? T : T * 0.7;
    if (e.k === 'mur') seg(0, 1, wall, wd);
    else if (e.k === 'fenetre') { seg(0, 0.2, wall, wd); seg(0.8, 1, wall, wd); seg(0.2, 0.8, '#7fcbef', wd * 0.6); }
    else if (e.k === 'porte') {
      seg(0, 0.3, wall, wd); seg(0.7, 1, wall, wd);
      // battant de porte
      ctx.lineCap = 'butt'; seg(0.3, 0.7, '#b07d48', wd * 0.35);
    } else if (e.k === 'portail') { ctx.lineCap = 'butt'; ctx.setLineDash([0.6, 0.5]); seg(0.05, 0.95, '#d9a441', wd * 0.6); ctx.setLineDash([]); }
    else if (e.k === 'casse') { seg(0, 0.15, wall, wd); seg(0.85, 1, wall, wd); }
  }
  ctx.lineCap = 'butt';
  if (k === b.floors - 1 && b.roofHatch) {
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.setLineDash([px(3), px(3)]); ctx.lineWidth = px(1);
    ctx.strokeRect(b.roofHatch.x * CELL + 0.6, b.roofHatch.z * CELL + 0.6, CELL - 1.2, CELL - 1.2); ctx.setLineDash([]);
  }
}

// infos de survol : case de la grille (A1…J10)
export function gridRef(map, x, z) {
  const step = map.size / 10, i = Math.floor(x / step), j = Math.floor(z / step);
  if (i < 0 || j < 0 || i > 9 || j > 9) return '';
  return 'ABCDEFGHIJ'[i] + (j + 1);
}
export function buildingAt(map, x, z) {
  for (const b of map.buildings) if (x >= b.x0 * CELL && x <= (b.x0 + b.w) * CELL && z >= b.z0 * CELL && z <= (b.z0 + b.d) * CELL) return b;
  return null;
}
export { PROPS };
