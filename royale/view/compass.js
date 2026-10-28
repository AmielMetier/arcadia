// Island Rush — la boussole en haut de l'écran. Les points cardinaux défilent avec le regard (le nord est le haut de la
// carte) ; chaque coup de feu entendu y laisse une marque à sa direction, plus grande quand il est proche, rouge vif
// quand il nous touche, avec ▲ ou ▼ s'il vient d'au-dessus ou d'en dessous ; elle s'efface en quelques secondes. Hors du
// champ de la boussole, une flèche au bord dit de quel côté se tourner. Les repères de l'équipe y ont leur losange.
const HALF = 90;  // degrés visibles de part et d'autre du centre
const LIFE = 3.5; // durée d'une marque de tir (s)
const NAMES = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SO', 270: 'O', 315: 'NO' };
const wrap = (a) => ((a % 360) + 540) % 360 - 180;

export function createCompass(root) {
  const cv = root.querySelector('canvas'), ctx = cv.getContext('2d'), readout = root.querySelector('b');
  const marks = new Map(); // tireur → { x, y, z, t, hit, mate, k }
  let W = 0, H = 0, D = 1, shown = '';
  function fit() {
    // (agrandie sur les grands écrans par --ui : on dessine à la taille affichée)
    const w = cv.clientWidth, h = cv.clientHeight, d = Math.min(3, (devicePixelRatio || 1) * (+document.documentElement.style.getPropertyValue('--ui') || 1));
    if (w === W && h === H && d === D) return;
    W = w; H = h; D = d; cv.width = Math.round(w * d); cv.height = Math.round(h * d);
  }
  // un tir entendu depuis (x, y, z), à la distance dist ; far : portée où on l'entend encore ; hit : il nous a touché
  function shot(id, x, y, z, dist, { hit = false, mate = false, far = 220 } = {}) {
    if (dist > far && !hit) return;
    const m = marks.get(id) || {};
    marks.set(id, { x, y, z, t: performance.now() / 1000, hit: hit || (m.hit && performance.now() / 1000 - m.t < 1.5), mate, k: Math.max(0.3, 1 - dist / far) });
  }
  // pos : la caméra ; yaw : son cap (0 = vers +z) ; pings : [{ rel (rad, comme yaw), color }]
  function update(pos, yaw, pings = []) {
    fit();
    if (!W) return;
    const now = performance.now() / 1000, head = ((180 - yaw * 180 / Math.PI) % 360 + 360) % 360;
    const deg = String(Math.round(head) % 360);
    if (deg !== shown) { shown = deg; readout.textContent = deg; }
    const px = W / 2 / HALF, X = (rel) => W / 2 + rel * px;
    ctx.setTransform(D, 0, 0, D, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // graduations : tous les 5°, plus longues tous les 15°, les points cardinaux en toutes lettres
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    const first = Math.ceil((head - HALF) / 5) * 5;
    for (let a = first; a <= head + HALF; a += 5) {
      const n = ((a % 360) + 360) % 360, x = X(a - head), name = NAMES[n];
      const big = n % 15 === 0, card = n % 90 === 0;
      ctx.fillStyle = `rgba(255,248,234,${card ? 0.95 : big ? 0.62 : 0.32})`;
      const len = card ? 9 : big ? 6 : 3.5;
      ctx.fillRect(x - (card ? 1 : 0.6), H - len - 2, card ? 2 : 1.2, len);
      if (name) {
        ctx.font = `${card ? 14 : 11}px Bungee, Impact, sans-serif`;
        ctx.fillStyle = n === 0 ? '#ffc531' : card ? '#fff8ea' : 'rgba(255,248,234,.8)';
        ctx.fillText(name, x, H - 15);
      } else if (big) {
        ctx.font = '600 9.5px "Chakra Petch", system-ui, sans-serif';
        ctx.fillStyle = 'rgba(255,248,234,.45)';
        ctx.fillText(String(n), x, H - 15);
      }
    }
    // repères de l'équipe : un losange de leur couleur (au bord s'ils sont hors champ)
    for (const p of pings) {
      const rel = wrap(-p.rel * 180 / Math.PI), x = Math.max(W * 0.1, Math.min(W * 0.9, X(rel))), r = 5;
      ctx.globalAlpha = (p.fade == null ? 1 : p.fade) * (Math.abs(rel) > HALF ? 0.6 : 1);
      ctx.beginPath(); ctx.moveTo(x, H / 2 - r - 3); ctx.lineTo(x + r, H / 2 - 3); ctx.lineTo(x, H / 2 + r - 3); ctx.lineTo(x - r, H / 2 - 3); ctx.closePath();
      ctx.fillStyle = p.color; ctx.strokeStyle = '#16181d'; ctx.lineWidth = 1.6; ctx.fill(); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    // coups de feu
    for (const [id, m] of marks) {
      const age = now - m.t;
      if (age > LIFE) { marks.delete(id); continue; }
      const bearing = Math.atan2(m.x - pos.x, -(m.z - pos.z)) * 180 / Math.PI, rel = wrap(bearing - head);
      const fade = Math.pow(1 - age / LIFE, 1.4), pulse = Math.max(0, 1 - age / 0.18);
      const col = m.hit ? '255,45,31' : m.mate ? '124,196,255' : '255,138,61';
      ctx.shadowColor = `rgba(${col},.9)`; ctx.shadowBlur = 6 + pulse * 8;
      ctx.fillStyle = `rgba(${col},${(fade * (0.55 + 0.45 * m.k)).toFixed(3)})`;
      if (Math.abs(rel) > HALF) {
        // derrière : une flèche au bord, du côté où se tourner
        // (pas tout au bord : il s'efface en fondu)
        const s = rel > 0 ? 1 : -1, x = s > 0 ? W * 0.9 : W * 0.1, h = 7 + 4 * m.k;
        ctx.beginPath(); ctx.moveTo(x, H / 2 - 2); ctx.lineTo(x - s * h, H / 2 - 2 - h * 0.75); ctx.lineTo(x - s * h, H / 2 - 2 + h * 0.75); ctx.closePath(); ctx.fill();
      } else {
        const x = X(rel), w = 3 + 4 * m.k + pulse * 3, top = 8 + (1 - m.k) * 8, bot = H - 9;
        ctx.beginPath(); ctx.roundRect(x - w / 2, top, w, bot - top, w / 2); ctx.fill();
        const dy = m.y - pos.y;
        if (Math.abs(dy) > 4) {
          // au-dessus (▲) ou en dessous (▼)
          const up = dy > 0, ty = up ? top - 1 : bot + 1, s = up ? -1 : 1;
          ctx.beginPath(); ctx.moveTo(x - 5, ty); ctx.lineTo(x + 5, ty); ctx.lineTo(x, ty + s * 6); ctx.closePath(); ctx.fill();
        }
      }
      ctx.shadowBlur = 0;
    }
  }
  return { shot, update, clear() { marks.clear(); } };
}
