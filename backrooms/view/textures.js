// The Backrooms - Textures du Level 0
// Motifs dessinés au canvas, salis par des photos CC0 de Poly Haven (backrooms/tex/) dès qu'elles sont chargées.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const TEX = new URL('../tex/', import.meta.url).href;

function canvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function tex(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  return t;
}

function loadImage(name) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = TEX + name;
  });
}

function noise(ctx, w, h, amount) {
  const d = ctx.getImageData(0, 0, w, h);
  for (let i = 0; i < d.data.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d.data[i] += n;
    d.data[i + 1] += n;
    d.data[i + 2] += n;
  }
  ctx.putImageData(d, 0, 0);
}

// Papier peint jaune à rayures et petits losanges, plinthe sombre en bas (une face de mur = 2,5 m × 3 m)
function drawWallpaper(ctx, S, grime) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#cbb45a';
  ctx.fillRect(0, 0, S, S);
  const band = S / 10;
  for (let x = 0; x < S; x += band) {
    ctx.fillStyle = '#c2aa4c';
    ctx.fillRect(x, 0, band * 0.42, S);
    ctx.fillStyle = 'rgba(120, 100, 30, 0.25)';
    ctx.fillRect(x + band * 0.42, 0, 2, S);
    // losanges du motif
    ctx.fillStyle = 'rgba(150, 128, 45, 0.45)';
    for (let y = band * 0.3; y < S; y += band * 0.6) {
      const cx = x + band * 0.72;
      ctx.beginPath();
      ctx.moveTo(cx, y - 5);
      ctx.lineTo(cx + 4, y);
      ctx.lineTo(cx, y + 5);
      ctx.lineTo(cx - 4, y);
      ctx.fill();
    }
  }
  if (grime) {
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(grime, 0, 0, S, S);
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.3;
    ctx.drawImage(grime, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // coulures d'humidité depuis le plafond
  for (let i = 0; i < 5; i++) {
    const x = Math.random() * S;
    const len = S * (0.15 + Math.random() * 0.4);
    const g = ctx.createLinearGradient(0, 0, 0, len);
    g.addColorStop(0, 'rgba(95, 75, 25, 0.35)');
    g.addColorStop(1, 'rgba(95, 75, 25, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, 0, 6 + Math.random() * 18, len);
  }
  // plinthe
  ctx.fillStyle = '#5a4a28';
  ctx.fillRect(0, S * 0.955, S, S * 0.045);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, S * 0.952, S, 3);
  noise(ctx, S, S, 14);
}

// Moquette humide jaunâtre : la photo est recolorée, sinon une trame de bruit
function drawCarpet(ctx, S, photo) {
  ctx.globalCompositeOperation = 'source-over';
  if (photo) {
    ctx.drawImage(photo, 0, 0, S, S);
    ctx.globalCompositeOperation = 'color';
    ctx.fillStyle = '#9c8a3c';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = '#5f5226';
    ctx.fillRect(0, 0, S, S);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    ctx.fillStyle = '#8f7d45';
    ctx.fillRect(0, 0, S, S);
    noise(ctx, S, S, 36);
  }
}

// Dalles de faux plafond (4 × 4 par case), salies par la photo
function drawCeiling(ctx, S, grime) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ddd6bd';
  ctx.fillRect(0, 0, S, S);
  if (grime) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.45;
    ctx.drawImage(grime, 0, 0, S, S);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // trous des dalles acoustiques
  ctx.fillStyle = 'rgba(90, 80, 60, 0.18)';
  for (let i = 0; i < 1400; i++) ctx.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5);
  // rails de la grille métallique
  const n = 4;
  ctx.fillStyle = '#9c957e';
  for (let i = 0; i <= n; i++) {
    const p = (i / n) * S;
    ctx.fillRect(p - 2, 0, 4, S);
    ctx.fillRect(0, p - 2, S, 4);
  }
}

export function createBackroomsTextures() {
  const S = 512;
  const [wallCanvas, wctx] = canvas(S);
  const [carpetCanvas, cctx] = canvas(S);
  const [ceilCanvas, clctx] = canvas(S);
  drawWallpaper(wctx, S, null);
  drawCarpet(cctx, S, null);
  drawCeiling(clctx, S, null);

  const wall = tex(wallCanvas);
  const carpet = tex(carpetCanvas);
  const ceiling = tex(ceilCanvas);

  // les photos arrivent un peu plus tard : on redessine par-dessus
  const ready = Promise.all([loadImage('papier.jpg'), loadImage('moquette.jpg'), loadImage('plafond.jpg')]).then(([pap, moq, pla]) => {
    if (pap) { drawWallpaper(wctx, S, pap); wall.needsUpdate = true; }
    if (moq) { drawCarpet(cctx, S, moq); carpet.needsUpdate = true; }
    if (pla) { drawCeiling(clctx, S, pla); ceiling.needsUpdate = true; }
  });

  // Cassette VHS
  const [vhsCanvas, vctx] = canvas(256, 160);
  vctx.fillStyle = '#1c1b18';
  vctx.fillRect(0, 0, 256, 160);
  vctx.fillStyle = '#e5dfcc';
  vctx.fillRect(20, 20, 216, 65);
  vctx.fillStyle = '#0a0a09';
  vctx.fillRect(40, 100, 176, 40);
  vctx.fillStyle = '#555';
  vctx.beginPath();
  vctx.arc(80, 120, 14, 0, Math.PI * 2);
  vctx.arc(176, 120, 14, 0, Math.PI * 2);
  vctx.fill();
  vctx.fillStyle = '#9b1c1c';
  vctx.font = 'bold 20px monospace';
  vctx.fillText('BACKROOMS // TAPE', 30, 48);
  vctx.fillStyle = '#333';
  vctx.font = '16px monospace';
  vctx.fillText('NE PAS EFFACER', 30, 72);
  const vhs = tex(vhsCanvas);
  vhs.wrapS = vhs.wrapT = THREE.ClampToEdgeWrapping;

  // Porte de sortie métallique (sans le panneau, posé à part)
  const [exitCanvas, ectx] = canvas(256, 512);
  ectx.fillStyle = '#3b3f45';
  ectx.fillRect(0, 0, 256, 512);
  ectx.strokeStyle = '#25282c';
  ectx.lineWidth = 6;
  ectx.strokeRect(24, 24, 208, 200);
  ectx.strokeRect(24, 260, 208, 220);
  ectx.fillStyle = '#9aa0a8';
  ectx.fillRect(196, 250, 40, 14); // barre anti-panique
  ectx.fillStyle = '#d97706';
  ectx.fillRect(0, 488, 256, 24);
  ectx.fillStyle = '#000';
  for (let x = -24; x < 256; x += 32) {
    ectx.beginPath();
    ectx.moveTo(x, 512);
    ectx.lineTo(x + 16, 512);
    ectx.lineTo(x + 40, 488);
    ectx.lineTo(x + 24, 488);
    ectx.fill();
  }
  noise(ectx, 256, 512, 18);
  const exit = tex(exitCanvas);
  exit.wrapS = exit.wrapT = THREE.ClampToEdgeWrapping;

  // Panneau EXIT lumineux
  const [signCanvas, sctx] = canvas(256, 96);
  sctx.fillStyle = '#0b0b0b';
  sctx.fillRect(0, 0, 256, 96);
  sctx.fillStyle = '#fff';
  sctx.font = 'bold 64px sans-serif';
  sctx.textAlign = 'center';
  sctx.textBaseline = 'middle';
  sctx.fillText('EXIT', 128, 50);
  const sign = tex(signCanvas);
  sign.wrapS = sign.wrapT = THREE.ClampToEdgeWrapping;

  // Étiquette de l'eau d'amande
  const [labelCanvas, lctx] = canvas(128, 64);
  lctx.fillStyle = '#f1e7c9';
  lctx.fillRect(0, 0, 128, 64);
  lctx.fillStyle = '#7a4a1a';
  lctx.font = 'bold 15px sans-serif';
  lctx.textAlign = 'center';
  lctx.fillText("EAU", 64, 26);
  lctx.fillText("D'AMANDE", 64, 46);
  const label = tex(labelCanvas);

  return { wall, carpet, ceiling, vhs, exit, sign, label, ready };
}
