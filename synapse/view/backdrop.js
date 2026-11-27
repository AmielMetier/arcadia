// Fond : un semis discret de points reliés par des lignes fines ; quelques liaisons s'éclairent avec la série.
import { createRng } from '../engine/rng.js';
import { rgba } from './shapes.js';

export function fitCanvas(cv) {
  const dpr = Math.min((window.devicePixelRatio || 1) * (cv.currentCSSZoom || 1), 3); // net aussi quand l'interface est agrandie
  const w = cv.clientWidth, h = cv.clientHeight;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
  const g = cv.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { g, w, h };
}

export function createBackdrop(cv) {
  const rng = createRng(20261127);
  const pts = Array.from({ length: 72 }, () => ({ x: rng.next(), y: rng.next(), ph: rng.next() * 6.28, sp: 0.2 + rng.next() * 0.3 }));
  const links = [];
  pts.forEach((p, i) => pts.forEach((q, j) => { if (j > i && Math.hypot(p.x - q.x, (p.y - q.y) * 0.6) < 0.13) links.push({ i, j, glow: 0, order: rng.next() }); }));
  links.sort((a, b) => a.order - b.order);
  let lit = 0;
  return {
    // color : couleur de l'épreuve en cours (liaisons et halo derrière le jeu), sinon le bleu du jeu.
    draw(t, streak, calm, color) {
      const c = color || '#38BDF8';
      const { g, w, h } = fitCanvas(cv);
      g.fillStyle = '#0F172A'; g.fillRect(0, 0, w, h);
      const halo = g.createRadialGradient(w / 2, h * 0.56, 0, w / 2, h * 0.56, Math.max(w, h) * 0.55);
      halo.addColorStop(0, rgba(c, color ? 0.13 : 0.07)); halo.addColorStop(1, rgba(c, 0));
      g.fillStyle = halo; g.fillRect(0, 0, w, h);
      const want = Math.min(links.length, Math.floor(streak / 2) * 2);
      lit += (want - lit) * 0.04;
      const pos = pts.map((p) => {
        const d = calm ? 0 : 6;
        return [p.x * w + Math.sin(t * p.sp + p.ph) * d, p.y * h + Math.cos(t * p.sp * 0.8 + p.ph) * d];
      });
      g.lineWidth = 1;
      links.forEach((l, k) => {
        const target = k < lit ? 1 : 0;
        l.glow += (target - l.glow) * 0.03;
        const [a, b] = [pos[l.i], pos[l.j]];
        g.strokeStyle = rgba(c, 0.07 + l.glow * 0.4);
        g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
      });
      g.fillStyle = 'rgba(248,250,252,0.22)';
      for (const [x, y] of pos) { g.beginPath(); g.arc(x, y, 1.6, 0, 6.283); g.fill(); }
    },
  };
}
