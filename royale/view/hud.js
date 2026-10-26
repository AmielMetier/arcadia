// L'interface en jeu : minicarte (nord en haut, flèche du joueur), nom du lieu, viseur, aide des touches, compteur
// d'images, et la grande carte (touche M) où l'on peut cliquer pour s'y rendre pendant l'exploration.
// Les deux cartes sont dessinées par view/maprender.js, comme l'aperçu de l'île.
import { terrainImage, drawMap, gridRef } from './maprender.js';
import { GROUND } from '../engine/map.js';

const MINI_S = 1.15; // pixels par mètre sur la minicarte
const $ = (s) => document.querySelector(s);

export function createHud(map, { onTeleport } = {}) {
  const img = terrainImage(map, { ppm: 0.5 });
  const mini = $('#mini'), mctx = mini.getContext('2d');
  const big = $('#bigmap'), bcv = big.querySelector('canvas'), bctx = bcv.getContext('2d');
  const place = $('#place'), fps = $('#fps'), promptEl = $('#prompt');
  const dpr = () => Math.min(2, devicePixelRatio || 1);
  const LAY_MINI = { relief: true, routes: true, batiments: true, vegetation: true, vehicules: false, coffres: false, noms: false, grille: false };
  const LAY_BIG = { relief: true, routes: true, batiments: true, vegetation: true, vehicules: true, coffres: false, noms: true, grille: true };
  let last = 0, bigView = null;

  // flèche du joueur : pointe dans la direction du regard (nord en haut)
  const arrow = (ctx, x, y, yaw, r = 9) => {
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.atan2(Math.cos(yaw), Math.sin(yaw)));
    ctx.beginPath(); ctx.moveTo(r, 0); ctx.lineTo(-r * 0.7, -r * 0.65); ctx.lineTo(-r * 0.35, 0); ctx.lineTo(-r * 0.7, r * 0.65); ctx.closePath();
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 2.2; ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  function update(t, p, yaw, frameMs) {
    if (t - last > 0.12) {
      last = t;
      const W = mini.clientWidth, H = mini.clientHeight, d = dpr();
      if (mini.width !== Math.round(W * d)) { mini.width = Math.round(W * d); mini.height = Math.round(H * d); }
      drawMap(mctx, map, img, { x: p.x, z: p.z, s: MINI_S, w: W, h: H, dpr: d }, { layers: LAY_MINI, level: 0 });
      mctx.setTransform(d, 0, 0, d, 0, 0);
      arrow(mctx, W / 2, H / 2, yaw);
      const poi = map.poiAt(p.x, p.z);
      place.textContent = `${gridRef(map, p.x, p.z)} · ${poi ? poi.name : GROUND[map.groundAt(p.x, p.z)]}`;
      if (!fps.hidden) fps.textContent = `${Math.round(1000 / Math.max(1, frameMs))} i/s · ${frameMs.toFixed(1)} ms`;
    }
    if (!big.hidden) drawBig(p, yaw);
  }

  function drawBig(p, yaw) {
    const W = bcv.clientWidth, H = bcv.clientHeight, d = dpr();
    if (bcv.width !== Math.round(W * d) || bcv.height !== Math.round(H * d)) { bcv.width = Math.round(W * d); bcv.height = Math.round(H * d); }
    if (!bigView) {
      // vue sur toute l'île
      const s = Math.min(W, H) / (map.stats.spanM + 120);
      bigView = { x: map.center, z: map.center, s };
    }
    drawMap(bctx, map, img, { ...bigView, w: W, h: H, dpr: d }, { layers: LAY_BIG, level: 0 });
    bctx.setTransform(d, 0, 0, d, 0, 0);
    arrow(bctx, (p.x - bigView.x) * bigView.s + W / 2, (p.z - bigView.z) * bigView.s + H / 2, yaw, 12);
  }
  bcv.addEventListener('click', (e) => {
    if (!bigView || !onTeleport) return;
    const r = bcv.getBoundingClientRect();
    const x = bigView.x + (e.clientX - r.left - r.width / 2) / bigView.s, z = bigView.z + (e.clientY - r.top - r.height / 2) / bigView.s;
    if (x > 0 && z > 0 && x < map.size && z < map.size) onTeleport(x, z);
  });
  addEventListener('resize', () => { bigView = null; });

  return {
    update,
    get mapOpen() { return !big.hidden; },
    toggleMap(on = big.hidden) { big.hidden = !on; bigView = null; },
    showFps(on) { fps.hidden = !on; },
    prompt(txt) { if (promptEl.dataset.t === txt) return; promptEl.dataset.t = txt; promptEl.hidden = !txt; promptEl.innerHTML = txt ? `<kbd>E</kbd> ${txt}` : ''; },
  };
}
