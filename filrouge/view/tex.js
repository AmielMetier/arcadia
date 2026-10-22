// Textures dessinées dans des canevas : étiquettes, écrans, bois, plâtre, vue de nuit sur la Baie des Anges.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export const FONT = '"Chakra Petch", "Arial Narrow", Arial, sans-serif';
export const BUNG = 'Bungee, Impact, sans-serif';

// Canevas + texture liée ; redraw(fn) redessine et signale la mise à jour
export function canvasTex(w, h, draw, { repeat = null } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  const redraw = (fn) => { ctx.clearRect(0, 0, w, h); fn(ctx, w, h); tex.needsUpdate = true; };
  if (draw) redraw(draw);
  return { tex, canvas, ctx, redraw };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// Bruit léger pour casser les aplats
function grain(ctx, w, h, amount, n = 9000) {
  for (let k = 0; k < n; k++) {
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * amount})`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
  }
}

export function woodTex(base = '#7a4a2a', dark = '#5a3219', planks = 6, repeat = [1, 1]) {
  return canvasTex(1024, 1024, (ctx, w, h) => {
    const ph = h / planks;
    for (let p = 0; p < planks; p++) {
      const g = ctx.createLinearGradient(0, p * ph, 0, (p + 1) * ph);
      const shade = (Math.random() - 0.5) * 18;
      g.addColorStop(0, base); g.addColorStop(1, dark);
      ctx.fillStyle = g; ctx.fillRect(0, p * ph, w, ph);
      ctx.fillStyle = `rgba(${shade > 0 ? '255,230,200' : '0,0,0'},${Math.abs(shade) / 100})`; ctx.fillRect(0, p * ph, w, ph);
      // veines
      ctx.strokeStyle = 'rgba(40,20,8,.22)'; ctx.lineWidth = 1.4;
      for (let v = 0; v < 9; v++) {
        ctx.beginPath();
        const y0 = p * ph + Math.random() * ph;
        ctx.moveTo(0, y0);
        for (let x = 0; x <= w; x += 32) ctx.lineTo(x, y0 + Math.sin(x / (60 + v * 9) + v) * (3 + v * 0.6));
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(20,10,4,.55)'; ctx.fillRect(0, p * ph, w, 3);
      const cut = Math.random() * w;
      ctx.fillRect(cut, p * ph, 3, ph);
    }
    grain(ctx, w, h, 0.06);
  }, { repeat });
}

export function plasterTex(color = '#c9b79c') {
  return canvasTex(512, 512, (ctx, w, h) => {
    ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
    grain(ctx, w, h, 0.07, 30000);
    for (let k = 0; k < 40; k++) {
      ctx.fillStyle = `rgba(90,70,50,${Math.random() * 0.05})`;
      ctx.beginPath(); ctx.arc(Math.random() * w, Math.random() * h, 20 + Math.random() * 80, 0, 7); ctx.fill();
    }
  }, { repeat: [3, 2] });
}

export function matTex() {
  return canvasTex(1024, 640, (ctx, w, h) => {
    ctx.fillStyle = '#1f5a46'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(220,255,235,.22)'; ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(220,255,235,.45)'; ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 160) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
    for (let y = 0; y < h; y += 160) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
    ctx.fillStyle = 'rgba(220,255,235,.6)'; ctx.font = `600 22px ${FONT}`;
    for (let x = 160; x < w; x += 160) ctx.fillText(String(x / 32), x + 4, 22);
    grain(ctx, w, h, 0.05);
  });
}

// Vue de nuit : la Baie des Anges, ses lampadaires en arc et les collines
export function nightTex() {
  return canvasTex(1024, 640, (ctx, w, h) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.62);
    sky.addColorStop(0, '#060a1c'); sky.addColorStop(1, '#22305c');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 140; k++) { ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; ctx.fillRect(Math.random() * w, Math.random() * h * 0.45, 1.6, 1.6); }
    ctx.fillStyle = '#fff6d8'; ctx.beginPath(); ctx.arc(w * 0.8, h * 0.16, 26, 0, 7); ctx.fill();
    ctx.fillStyle = '#060a1c'; ctx.beginPath(); ctx.arc(w * 0.8 + 10, h * 0.16 - 6, 23, 0, 7); ctx.fill();
    // collines
    ctx.fillStyle = '#0f1630';
    ctx.beginPath(); ctx.moveTo(0, h * 0.52);
    for (let x = 0; x <= w; x += 16) ctx.lineTo(x, h * 0.5 - Math.sin(x / 140) * 30 - Math.sin(x / 47) * 8 - (x > w * 0.7 ? (x - w * 0.7) * 0.25 : 0));
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.fill();
    for (let k = 0; k < 260; k++) {
      const x = Math.random() * w, y = h * 0.42 + Math.random() * h * 0.16;
      ctx.fillStyle = `rgba(255,${190 + Math.random() * 60},120,${0.4 + Math.random() * 0.6})`; ctx.fillRect(x, y, 2, 2);
    }
    // mer
    const sea = ctx.createLinearGradient(0, h * 0.6, 0, h);
    sea.addColorStop(0, '#0b1838'); sea.addColorStop(1, '#040814');
    ctx.fillStyle = sea;
    ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, h * 0.62 + Math.pow((x - w * 0.55) / w, 2) * h * 0.5);
    ctx.lineTo(w, h); ctx.fill();
    // promenade éclairée en arc
    for (let x = 0; x <= w; x += 9) {
      const y = h * 0.62 + Math.pow((x - w * 0.55) / w, 2) * h * 0.5 - 3;
      ctx.fillStyle = 'rgba(255,214,120,.95)'; ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = 'rgba(255,200,90,.12)'; ctx.fillRect(x - 1, y + 4, 4, 40 + Math.random() * 30);
    }
  });
}

export function label(text, { w = 512, h = 128, bg = '#f3e9d2', fg = '#16181d', font = BUNG, size = 64, border = 0, radius = 0 } = {}) {
  return canvasTex(w, h, (ctx) => {
    if (bg) { ctx.fillStyle = bg; if (radius) { roundRect(ctx, 0, 0, w, h, radius); ctx.fill(); } else ctx.fillRect(0, 0, w, h); }
    if (border) { ctx.strokeStyle = fg; ctx.lineWidth = border; roundRect(ctx, border / 2, border / 2, w - border, h - border, radius); ctx.stroke(); }
    ctx.fillStyle = fg; ctx.font = `${size}px ${font}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2 + size * 0.06);
  });
}
