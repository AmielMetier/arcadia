// The Backrooms (Level 5, le Terror Hotel) - Le hall en grand :
//  - un damier de marbre blanc et noir, poli, où se reflètent les lustres (le sol de la moquette s'arrête au seuil) ;
//  - un grand tapis sous la banquette ronde, et un chemin de moquette depuis l'entrée ;
//  - les colonnes en marbre noir veiné, à base et chapiteau dorés ;
//  - un plafond à caissons, un grand caisson au milieu (là où s'allume le code) ;
//  - des portes vitrées à double battant sur le mur ouest, qui ne donnent que sur le noir ;
//  - l'arrivée du toboggan : une trappe ouverte au plafond, un drap qui pend, le tas de linge où l'on atterrit ;
//  - une barre de pied en laiton au comptoir de la réception.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE, T } from '../engine/map.js';
import { makeBatch } from './hotelRooms.js';
import { drawRug } from './hotelTextures.js';

const C = CELL_SIZE;
const TEX = new URL('../tex/', import.meta.url).href;
const TILE = C / 4; // 62,5 cm

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
function tex(c, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
const loadImage = (name) =>
  new Promise((ok) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = () => ok(null);
    im.src = TEX + name;
  });
// un hasard fixe (le même damier chez tout le monde)
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// le damier : 4 × 4 carreaux par motif (2,5 m), chacun pris ailleurs dans la photo, tourné ; des joints fins
function drawMarbleTiles(ctx, S, white, black) {
  const n = 4;
  const t = S / n;
  const r = rng(91);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const dark = (i + j) % 2 === 1;
      const im = dark ? black : white;
      ctx.save();
      ctx.beginPath();
      ctx.rect(i * t, j * t, t, t);
      ctx.clip();
      if (im) {
        const k = 0.35 + r() * 0.3; // une part de la photo
        const sw = im.width * k;
        const sx = r() * (im.width - sw);
        const sy = r() * (im.height - sw);
        ctx.translate(i * t + t / 2, j * t + t / 2);
        ctx.rotate(Math.floor(r() * 4) * (Math.PI / 2));
        ctx.drawImage(im, sx, sy, sw, sw, -t / 2, -t / 2, t, t);
      } else {
        ctx.fillStyle = dark ? '#1b1a1a' : '#d8d2c6';
        ctx.fillRect(i * t, j * t, t, t);
      }
      ctx.restore();
      // le blanc un peu crème, le noir un peu chaud ; un voile d'usure
      ctx.fillStyle = dark ? 'rgba(30, 18, 10, 0.25)' : 'rgba(150, 132, 104, 0.32)';
      ctx.fillRect(i * t, j * t, t, t);
    }
  }
  ctx.strokeStyle = 'rgba(70, 62, 50, 0.95)';
  ctx.lineWidth = Math.max(2, S / 400);
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * t, 0);
    ctx.lineTo(i * t, S);
    ctx.moveTo(0, i * t);
    ctx.lineTo(S, i * t);
    ctx.stroke();
  }
}
// le relief (les joints creusés) et le poli (les joints mats, des rayures fines)
function drawMarbleRelief(ctx, S, spec) {
  const n = 4;
  const t = S / n;
  ctx.fillStyle = spec ? '#e6e6e6' : '#c8c8c8';
  ctx.fillRect(0, 0, S, S);
  if (spec) {
    const r = rng(17);
    ctx.strokeStyle = 'rgba(90, 90, 90, 0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 160; i++) {
      const x = r() * S;
      const y = r() * S;
      const a = r() * Math.PI;
      const l = 10 + r() * 50;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
    // des zones ternies, là où l'on passe
    for (let i = 0; i < 18; i++) {
      const g = ctx.createRadialGradient(r() * S, r() * S, 0, r() * S, r() * S, S * 0.25);
      g.addColorStop(0, 'rgba(110, 110, 110, 0.25)');
      g.addColorStop(1, 'rgba(110, 110, 110, 0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, S, S);
    }
  }
  ctx.strokeStyle = spec ? '#2a2a2a' : '#404040';
  ctx.lineWidth = Math.max(2, S / 256);
  for (let i = 0; i <= n; i++) {
    ctx.beginPath();
    ctx.moveTo(i * t, 0);
    ctx.lineTo(i * t, S);
    ctx.moveTo(0, i * t);
    ctx.lineTo(S, i * t);
    ctx.stroke();
  }
}
// le chemin de moquette : un champ rouge, une double bordure dorée, de petits fleurons
function drawRunner(ctx, w, h) {
  ctx.fillStyle = '#5e1414';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#b08a3e';
  ctx.lineWidth = w * 0.03;
  ctx.strokeRect(w * 0.06, -10, w * 0.88, h + 20);
  ctx.lineWidth = w * 0.012;
  ctx.strokeRect(w * 0.13, -10, w * 0.74, h + 20);
  ctx.fillStyle = '#9a7434';
  for (let y = w * 0.25; y < h; y += w * 0.5) {
    ctx.save();
    ctx.translate(w / 2, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-w * 0.07, -w * 0.07, w * 0.14, w * 0.14);
    ctx.restore();
  }
  // l'usure au milieu
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0.3, 'rgba(160, 120, 100, 0)');
  g.addColorStop(0.5, 'rgba(160, 120, 100, 0.22)');
  g.addColorStop(0.7, 'rgba(160, 120, 100, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function buildHotelLobby({ map, group, baked, CEIL }) {
  const L = map.lobby;
  if (!L) return { update() {} };
  const X0 = L.x0 * C;
  const X1 = (L.x1 + 1) * C;
  const Z0 = L.z0 * C;
  const Z1 = (L.z1 + 1) * C;
  const loader = new THREE.TextureLoader();
  const photo = (name) => {
    const t = loader.load(TEX + name);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    return t;
  };

  // --- 1. Le damier de marbre ---
  const [mc, mctx] = canvas(1024);
  const [bc, bctx] = canvas(512);
  const [sc, sctx] = canvas(512);
  drawMarbleTiles(mctx, 1024, null, null);
  drawMarbleRelief(bctx, 512, false);
  drawMarbleRelief(sctx, 512, true);
  const marbleTex = tex(mc);
  const floorMat = baked(
    new THREE.MeshPhongMaterial({ map: marbleTex, bumpMap: tex(bc, false), bumpScale: 0.6, specularMap: tex(sc, false), specular: '#cfc6b4', shininess: 120 }),
    { spec: 1.0, gloss: 240, mask: 0, hotel: 1, marble: 1 },
  );
  Promise.all([loadImage('l5_marbre_blanc.jpg'), loadImage('l5_marbre_noir.jpg')]).then(([w, b]) => {
    drawMarbleTiles(mctx, 1024, w, b);
    marbleTex.needsUpdate = true;
  });
  {
    const g = new THREE.PlaneGeometry(X1 - X0, Z1 - Z0);
    g.rotateX(-Math.PI / 2);
    g.translate((X0 + X1) / 2, 0, (Z0 + Z1) / 2);
    const p = g.attributes.position;
    const uv = g.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (4 * TILE), -p.getZ(i) / (4 * TILE));
    group.add(new THREE.Mesh(g, floorMat));
  }

  const B = makeBatch();
  const { add, setFrame, bx, cyl, ball, cached, local } = B;
  const lam = (o, opts) => baked(new THREE.MeshLambertMaterial(o), opts);
  const phong = (o, opts) => baked(new THREE.MeshPhongMaterial(o), opts);
  const M = {
    rug: lam({ map: (() => {
      const [c, x] = canvas(512, 384);
      drawRug(x, 512, 384);
      return tex(c);
    })(), color: '#b09c86', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    runner: lam({ map: (() => {
      const [c, x] = canvas(128, 512);
      drawRunner(x, 128, 512);
      return tex(c);
    })(), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    blackMarble: phong({ map: photo('l5_marbre_noir.jpg'), color: '#8a8580', specular: '#b8b0a0', shininess: 110 }, { spec: 0.3, gloss: 220, mask: 0 }),
    gold: phong({ color: '#c09a48', specular: '#ffe6a8', shininess: 80, emissive: '#2e2008', emissiveIntensity: 0.4 }, { spec: 0.6, gloss: 60, mask: 0 }),
    plaster: lam({ color: '#b3a17c' }, { hotel: 1 }),
    plasterDark: lam({ color: '#8c7a58' }, { hotel: 1 }),
    linen: lam({ color: '#ddd5c4' }),
    linen2: lam({ color: '#cbbfa8' }),
    towel: lam({ color: '#8f2a26' }),
    void: new THREE.MeshBasicMaterial({ color: '#020203' }),
    glass: new THREE.MeshPhongMaterial({ color: '#06080a', specular: '#2c3238', shininess: 400, transparent: true, opacity: 0.8, depthWrite: false }), // (sans lumière cuite : du noir, et l'éclat de la lampe torche)
    mat: lam({ color: '#2a2622' }),
    letters: new THREE.MeshBasicMaterial({ map: (() => {
      const [c, x] = canvas(512, 96);
      x.clearRect(0, 0, 512, 96);
      x.fillStyle = '#d6b066';
      x.font = 'bold 64px Georgia, serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('H  O  T  E  L', 256, 52);
      return tex(c);
    })(), transparent: true, depthWrite: false }),
  };

  // --- 2. Les tapis : le grand, sous la banquette ; le chemin, de l'entrée jusqu'à lui ---
  const cx = map.lobbyCenter.x;
  const cz = map.lobbyCenter.z;
  setFrame(cx, cz, 0);
  B.flat(5.6, 4.2, M.rug, 0, 0.006, 0);
  const rEnd = cz - 2.1;
  setFrame(cx, (Z0 + rEnd) / 2, 0);
  B.flat(1.8, rEnd - Z0, M.runner, 0, 0.005, 0);

  // --- 3. Les colonnes : marbre noir, base à gradins et chapiteau dorés ---
  const shaftGeo = new THREE.CylinderGeometry(0.27, 0.29, CEIL - 0.62, 28, 1, true);
  for (const s of map.solids) {
    if (!s.column) continue;
    setFrame(s.x, s.z, 0);
    add(shaftGeo, M.blackMarble, local(0, 0.3 + (CEIL - 0.62) / 2, 0));
    bx(0.74, 0.16, 0.74, M.blackMarble, 0, 0.08, 0);
    bx(0.66, 0.06, 0.66, M.gold, 0, 0.19, 0);
    cyl(0.32, 0.34, 0.08, M.gold, 0, 0.26, 0, 28);
    // le chapiteau Art déco : trois gradins dorés qui s'évasent, une frise
    cyl(0.31, 0.28, 0.06, M.gold, 0, CEIL - 0.29, 0, 28);
    bx(0.62, 0.08, 0.62, M.gold, 0, CEIL - 0.22, 0);
    bx(0.72, 0.07, 0.72, M.gold, 0, CEIL - 0.145, 0);
    bx(0.84, 0.08, 0.84, M.gold, 0, CEIL - 0.07, 0);
    for (const [ax, az] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) bx(az ? 0.36 : 0.02, 0.05, ax ? 0.36 : 0.02, M.blackMarble, ax * 0.32, CEIL - 0.22, az * 0.32);
  }

  // --- 4. Le plafond à caissons : des poutres sur les lignes des cases, filet doré dessous ; une rosace à chaque
  // croisement ; au milieu, un grand caisson encadré d'or (le code s'y allume) ---
  const BW = 0.24;
  const BD = 0.2;
  const inCenter = (x, z) => Math.abs(x - cx) < C - 0.01 && Math.abs(z - cz) < C / 2 - 0.01;
  const beam = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    if (len < 0.01) return;
    setFrame((x0 + x1) / 2, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0));
    bx(BW, BD, len, M.plaster, 0, CEIL - BD / 2, 0);
    for (const s of [-1, 1]) bx(0.02, 0.025, len, M.gold, s * (BW / 2 - 0.01), CEIL - BD - 0.0125, 0);
    bx(BW + 0.06, 0.03, len, M.plasterDark, 0, CEIL - 0.015, 0);
  };
  for (let gx = L.x0 + 1; gx <= L.x1; gx++) {
    const x = gx * C;
    // une poutre nord-sud, coupée là où elle traverserait le grand caisson
    if (Math.abs(x - cx) < C - 0.01) {
      beam(x, Z0, x, cz - C / 2);
      beam(x, cz + C / 2, x, Z1);
    } else beam(x, Z0, x, Z1);
  }
  for (let gz = L.z0 + 1; gz <= L.z1; gz++) beam(X0, gz * C, X1, gz * C);
  // au-dessus de l'entrée du hall (le passage depuis le couloir), un linteau
  {
    let a = -1;
    for (let gx = L.x0; gx <= L.x1 + 1; gx++) {
      const open = gx <= L.x1 && map.grid[(L.z0 - 1) * map.W + gx] !== T.WALL;
      if (open && a < 0) a = gx;
      if (!open && a >= 0) {
        beam(a * C, Z0, gx * C, Z0);
        a = -1;
      }
    }
  }
  for (let gx = L.x0 + 1; gx <= L.x1; gx++) {
    for (let gz = L.z0 + 1; gz <= L.z1; gz++) {
      if (inCenter(gx * C, gz * C)) continue;
      setFrame(gx * C, gz * C, 0);
      cyl(0.16, 0.13, 0.04, M.gold, 0, CEIL - BD - 0.02, 0, 16);
      ball(0.05, 0.035, 0.05, M.gold, 0, CEIL - BD - 0.045, 0);
    }
  }
  // le cadre doré du grand caisson
  setFrame(cx, cz, 0);
  for (const s of [-1, 1]) {
    bx(2 * C - BW, 0.05, 0.08, M.gold, 0, CEIL - BD - 0.02, s * (C / 2 - BW / 2 - 0.04));
    bx(0.08, 0.05, C - BW, M.gold, s * (C - BW / 2 - 0.04), CEIL - BD - 0.02, 0);
  }

  // --- 5. Les portes vitrées, sur le mur ouest : deux battants à cadre de laiton, poignées en barre, une imposte en
  // demi-lune où l'on lit HOTEL à l'envers ; derrière, le noir ---
  const mb = map.mailbox;
  const dz = mb ? Math.min(Z1 - 2.6, Math.max(mb.z1 + 2.2, (mb.z1 + Z1) / 2)) : cz + 3;
  setFrame(X0, dz, Math.PI / 2); // +z local : vers le hall (+x) ; x local : vers -z
  const DWH = 0.82; // largeur d'un battant
  const DHH = 2.4;
  add(cached('void', () => new THREE.PlaneGeometry(2 * DWH + 0.2, DHH + 0.75)), M.void, local(0, (DHH + 0.75) / 2, 0.045));
  for (const s of [-1, 1]) {
    const x = s * (DWH / 2 + 0.01);
    add(cached('pane', () => new THREE.PlaneGeometry(DWH - 0.1, DHH - 0.1)), M.glass, local(x, DHH / 2, 0.075));
    bx(0.05, DHH, 0.05, M.gold, x - DWH / 2 + 0.025, DHH / 2, 0.075);
    bx(0.05, DHH, 0.05, M.gold, x + DWH / 2 - 0.025, DHH / 2, 0.075);
    bx(DWH, 0.05, 0.05, M.gold, x, DHH - 0.025, 0.075);
    bx(DWH, 0.2, 0.05, M.gold, x, 0.1, 0.075);
    bx(DWH - 0.12, 0.035, 0.05, M.gold, x, 1.05, 0.12); // la barre de poussée
    for (const sx of [-1, 1]) cyl(0.012, 0.012, 0.05, M.gold, x + sx * (DWH / 2 - 0.12), 1.05, 0.095, 8, Math.PI / 2);
  }
  // le dormant, l'imposte, les lettres
  bx(2 * DWH + 0.2, 0.08, 0.08, M.gold, 0, DHH + 0.04, 0.05);
  for (const s of [-1, 1]) bx(0.08, DHH + 0.75, 0.08, M.gold, s * (DWH + 0.1), (DHH + 0.75) / 2, 0.05);
  bx(2 * DWH + 0.28, 0.08, 0.1, M.gold, 0, DHH + 0.75, 0.05);
  add(cached('transom', () => new THREE.PlaneGeometry(2 * DWH + 0.1, 0.62)), M.glass, local(0, DHH + 0.39, 0.06));
  add(cached('letters', () => {
    // lues depuis le hall, les lettres peintes sur la vitre sont à l'envers
    const g = new THREE.PlaneGeometry(1.4, 0.26);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, 1 - uv.getX(i));
    return g;
  }), M.letters, local(0, DHH + 0.4, 0.07));
  // le paillasson
  bx(2 * DWH, 0.012, 0.75, M.mat, 0, 0.006, 0.5);

  // --- 6. L'arrivée du toboggan : une trappe ouverte au plafond, au-dessus du point d'apparition, son battant qui
  // pend, un drap accroché au bord ; dessous, le tas de linge sale où l'on atterrit ---
  const sp = map.spawn || map.start;
  if (sp) {
    setFrame(sp.x, sp.z, 0.4);
    const HW = 0.38;
    add(cached('hole', () => new THREE.PlaneGeometry(2 * HW, 2 * HW).rotateX(Math.PI / 2)), M.void, local(0, CEIL - 0.004, 0));
    for (const s of [-1, 1]) {
      bx(2 * HW + 0.12, 0.05, 0.06, M.gold, 0, CEIL - 0.025, s * (HW + 0.03));
      bx(0.06, 0.05, 2 * HW, M.gold, s * (HW + 0.03), CEIL - 0.025, 0);
    }
    // le battant s'est ouvert vers le haut, dans le noir ; un drap a glissé et pend du bord de la trappe
    const sheet = new THREE.PlaneGeometry(0.55, 0.75, 1, 8);
    {
      const p = sheet.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const t = (0.375 - p.getY(i)) / 0.75;
        p.setZ(i, Math.sin(t * 2.4) * 0.1 * t + Math.sin(p.getX(i) * 9) * 0.025);
      }
      sheet.computeVertexNormals();
    }
    add(sheet, M.linen, local(-0.12, CEIL - 0.375 - 0.01, -HW + 0.05, 1, 1, 1, 0, 0.2, 0));
    add(sheet, M.linen2, local(-0.12, CEIL - 0.375 - 0.01, -HW + 0.045, 1, 1, 1, 0, 0.2 + Math.PI, 0));
    // le tas de linge : draps, taies, une serviette rouge
    const lumps = [[0, 0, 0.75, 0.22, 0.6, M.linen], [0.35, 0.2, 0.45, 0.16, 0.4, M.linen2], [-0.4, -0.15, 0.5, 0.15, 0.45, M.linen], [0.1, -0.45, 0.4, 0.12, 0.35, M.linen2], [-0.2, 0.4, 0.35, 0.1, 0.3, M.towel], [0.55, -0.25, 0.3, 0.09, 0.25, M.linen], [-0.6, 0.3, 0.3, 0.08, 0.28, M.linen2]];
    for (const [x, z, sx, sy, sz, m] of lumps) ball(sx, sy, sz, m, x, sy * 0.55, z);
  }

  // --- 7. Le comptoir de la réception : une barre de pied en laiton sur sa façade ---
  for (const s of map.solids) {
    if (!s.reception) continue;
    setFrame(s.x - s.hx - 0.12, s.z, 0);
    add(cached('footrail', () => new THREE.CylinderGeometry(0.025, 0.025, s.hz * 2 - 0.2, 12).rotateX(Math.PI / 2)), M.gold, local(0, 0.16, 0));
    for (let i = 0; i < 4; i++) {
      const z = -s.hz + 0.25 + (i * (s.hz * 2 - 0.5)) / 3;
      bx(0.12, 0.02, 0.02, M.gold, 0.06, 0.16, z);
    }
  }

  B.flush(group, (m) => (m === M.rug || m === M.runner ? 1 : m === M.glass ? 2 : m === M.letters ? 3 : 0));
  shaftGeo.dispose();
  return { update() {} };
}
