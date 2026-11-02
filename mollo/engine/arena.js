// Mollo ! — les arènes : des boîtes alignées sur les axes, au-dessus du vide. Certaines bougent (leur position ne dépend
// que du temps de manche : l'hôte et les invités calculent la même chose), d'autres font avancer ce qui est posé dessus (tapis).
// Une boîte : { x, y, z, hx, hy, hz, mat, grip, move, belt, crush } ; y est son centre, hx/hy/hz ses demi-tailles.
// nodes / links : les points de passage des bots.

const B = (x, y, z, sx, sy, sz, mat, o = {}) => ({ x, y, z, hx: sx / 2, hy: sy / 2, hz: sz / 2, mat, grip: true, bx: x, by: y, bz: z, vx: 0, vy: 0, vz: 0, ...o });

export const ARENAS = {
  toits: {
    name: 'Les Toits', spawnY: 0.1,
    spawns: [[-7, -2], [-4.5, 2], [-7, 2.5], [-4.5, -2.5], [5, -2], [7.2, 2], [5, 2.5], [7.2, -2.5]],
    boxes: [
      B(-5.75, -1, 0, 8.5, 2, 9, 'tuile'), B(6, -1, 0, 7, 2, 9, 'zinc'),        // les deux toits
      B(0.1, -0.08, 0, 3.4, 0.16, 1.1, 'planche'),                               // la planche entre les deux
      B(-5.5, 0.55, -3.1, 1, 1.1, 1, 'brique'), B(-7.7, 0.35, 0.2, 1.1, 0.7, 1.1, 'brique'), // cheminée et bloc
      B(6.2, 0.5, 3.1, 1.6, 1, 1, 'metal'),                                      // climatiseur
      B(-5.75, 0.2, 4.6, 8.5, 0.4, 0.2, 'brique'), B(6, 0.2, -4.6, 7, 0.4, 0.2, 'zinc'), // petits parapets
      B(0.1, -0.1, 4.4, 2.2, 0.2, 1.5, 'metal', { move: { ax: 0, ay: 0, az: 2, w: 0.7, ph: 0 } }), // nacelle du laveur de vitres : s'arrête avant la planche, pour ne coincer personne
    ],
    nodes: [[-5.5, 0, 0], [-1.6, 0, 0], [1.8, 0, 0], [5.5, 0, 0]], links: [[0, 1], [1, 2], [2, 3]],
  },
  chantier: {
    name: 'Le Chantier', spawnY: 0.1,
    spawns: [[-5, -2], [-2.5, 2.2], [0, -2.5], [2.5, 2.2], [5, -2], [-5, 2.2], [5, 2.2], [0, 0.8]],
    boxes: [
      B(0, -0.5, 0, 14, 1, 7.5, 'beton'),                                         // la dalle
      B(-3.4, 0.5, -1.6, 0.4, 1, 3, 'beton'),                                     // un muret par-dessus lequel se hisser
      B(3.6, 0.3, 1.5, 1.6, 0.6, 1.6, 'palette'), B(5.2, 0.8, 1.5, 1.6, 1.6, 1.6, 'palette'), // des palettes en escalier
      B(0, 2.6, -2.9, 14, 0.24, 1.7, 'poutre'),                                   // la passerelle du fond
      B(-6.6, 1.25, -2.9, 0.3, 2.5, 0.3, 'poutre'), B(6.6, 1.25, -2.9, 0.3, 2.5, 0.3, 'poutre'), // ses poteaux
      B(0, -0.1, 6, 3, 0.2, 2.4, 'metal', { move: { ax: 5.5, ay: 0, az: 0, w: 0.55, ph: 0 } }), // le plateau de la grue, devant la dalle
    ],
    balls: [{ px: 0, py: 7.4, pz: 0, len: 6.1, amp: 0.85, w: 1.05, r: 0.72, ax: 1, az: 0 }], // le boulet qui balaie la dalle
    nodes: [[-5, 0, 0], [0, 0, 1], [5, 0, 0]], links: [[0, 1], [1, 2]],
  },
  usine: {
    name: 'L\'Usine à Pâte', spawnY: 0.1,
    spawns: [[-5.5, -2.5], [-3, 2.8], [0, -2.5], [3, 2.8], [5.5, -2.5], [-5.5, 2.8], [5.5, 2.8], [0, 0.2]],
    boxes: [
      B(-4.2, -0.5, 2.6, 6, 1, 3.6, 'metal', { belt: [-1.5, 0] }), B(4.2, -0.5, 2.6, 6, 1, 3.6, 'metal', { belt: [1.5, 0] }), // deux tapis vers les bords
      B(0, -0.5, 2.6, 2.4, 1, 3.6, 'beton'),                                      // le pilier du milieu
      B(0, -0.5, -2.5, 15, 1, 3.4, 'beton'),                                      // le quai du fond
      B(0, -0.08, 0, 1.5, 0.16, 1.8, 'planche'),                                  // la passerelle entre le quai et les tapis
      B(-4.6, 0.55, -3.5, 1.3, 1.1, 1.3, 'palette'), B(4.6, 0.55, -3.5, 1.3, 1.1, 1.3, 'palette'), // des caisses
      B(0, 3.2, -2.5, 2.4, 1.2, 2.4, 'danger', { move: { ax: 0, ay: 1.45, az: 0, w: 1.15, ph: 0 }, crush: true }), // le pilon
    ],
    nodes: [[-5, 0, -2.5], [0, 0, -2.5], [5, 0, -2.5], [0, 0, 2.2]], links: [[0, 1], [1, 2], [1, 3]],
  },
  rouleaux: {
    name: 'Les Rouleaux', spawnY: 0.1,
    spawns: [[-8, -3], [8, 3], [-8, 3], [8, -3], [-8, 0], [8, 0], [0, 0], [-3, 0]],
    boxes: [B(0, -0.5, 0, 18, 1, 9, 'beton')],
    // deux rouleaux à pointes, en sens contraires : on se sauve par l'allée du milieu ou tout au bout
    rollers: [
      { bx: 0, ax: 6, w: 0.62, ph: 0, cy: 0.95, r: 0.95, cz: -2.75, hz: 1.75 },
      { bx: 0, ax: 6, w: 0.62, ph: Math.PI, cy: 0.95, r: 0.95, cz: 2.75, hz: 1.75 },
    ],
    nodes: [[-8, 0, 0], [0, 0, 0], [8, 0, 0]], links: [[0, 1], [1, 2]],
  },
  four: {
    name: 'L\'Incinérateur', spawnY: 0.1,
    spawns: [[-7, -2], [7, 2.5], [-5, 2.5], [5, -2], [-1.5, -3.5], [1.5, 3.5], [1.5, -3.5], [-1.5, 3.5]],
    boxes: [
      B(-6, -1.5, 0, 7, 3, 10, 'metal', { belt: [1.1, 0] }), B(6, -1.5, 0, 7, 3, 10, 'metal', { belt: [-1.1, 0] }), // les tapis qui mènent au four
      B(0, -1.5, -3.5, 5, 3, 3, 'beton'), B(0, -1.5, 3.5, 5, 3, 3, 'beton'),       // les quais
      B(-1.25, -0.1, 0, 2.5, 0.16, 4, 'danger', { door: true, grip: false, move: { ax: -2.5, ay: 0, az: 0, w: 0.5, ph: -3, square: 1 } }), // les trappes
      B(1.25, -0.1, 0, 2.5, 0.16, 4, 'danger', { door: true, grip: false, move: { ax: 2.5, ay: 0, az: 0, w: 0.5, ph: -3, square: 1 } }),
      B(0, 0.8, -5.2, 19.8, 1.6, 0.4, 'brique'), B(-9.7, 0.8, 0, 0.4, 1.6, 10, 'brique'), B(9.7, 0.8, 0, 0.4, 1.6, 10, 'brique'), // les murs
      B(0, 0.15, 5.2, 19.8, 0.3, 0.4, 'metal'),                                    // le rebord de devant : on peut encore passer par-dessus
    ],
    burn: [{ x: 0, z: 0, hx: 2.5, hz: 2, y: -2.2 }],
    nodes: [[-6, 0, 0], [0, 0, -3.5], [6, 0, 0], [0, 0, 3.5]], links: [[0, 1], [1, 2], [2, 3], [3, 0]],
  },
  tri: {
    name: 'Le Tri Postal', spawnY: 0.1,
    spawns: [[-6, 0], [6, 0], [-2, 0], [2, 0], [-5, -3.6], [5, 3.6], [5, -1.8], [-5, 1.8]],
    boxes: [
      B(0, -0.5, -3.6, 16, 1, 1.8, 'metal', { belt: [2.2, 0] }), B(0, -0.5, -1.8, 16, 1, 1.8, 'metal', { belt: [-2.2, 0] }), // quatre tapis, sens alternés
      B(0, -0.5, 1.8, 16, 1, 1.8, 'metal', { belt: [2.2, 0] }), B(0, -0.5, 3.6, 16, 1, 1.8, 'metal', { belt: [-2.2, 0] }),
      B(0, -0.5, 0, 16, 1, 1.8, 'beton'),                                          // l'allée fixe du milieu
      B(-4, 0.45, 0, 1.1, 0.9, 1.1, 'palette'), B(4, 0.45, 0, 1.1, 0.9, 1.1, 'palette'), // des colis
      B(0, 0.6, -2.7, 0.5, 1.2, 3.6, 'danger', { knock: true, move: { ax: 7, ay: 0, az: 0, w: 0.62, ph: 0 } }), // les barres qui balaient
      B(0, 0.6, 2.7, 0.5, 1.2, 3.6, 'danger', { knock: true, move: { ax: 7, ay: 0, az: 0, w: 0.62, ph: Math.PI } }),
    ],
    nodes: [[-6, 0, 0], [0, 0, 0], [6, 0, 0]], links: [[0, 1], [1, 2]],
  },
};
export const ARENA_KEYS = Object.keys(ARENAS);
export const KILL_Y = -8;

export class Arena {
  constructor(key) {
    const a = ARENAS[key] || ARENAS.toits;
    this.key = ARENAS[key] ? key : 'toits';
    this.name = a.name;
    this.boxes = a.boxes.map((b) => ({ ...b }));
    this.balls = (a.balls || []).map((b) => ({ ...b, x: b.px, y: b.py - b.len, z: b.pz, vx: 0, vy: 0, vz: 0 }));
    this.rollers = (a.rollers || []).map((r) => ({ ...r, x: r.bx, vx: 0, spin: 0 }));
    this.burn = a.burn || [];
    this.spawns = a.spawns; this.nodes = a.nodes; this.links = a.links;
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const b of this.boxes) { x0 = Math.min(x0, b.bx - b.hx); x1 = Math.max(x1, b.bx + b.hx); z0 = Math.min(z0, b.bz - b.hz); z1 = Math.max(z1, b.bz + b.hz); }
    this.x0 = x0; this.x1 = x1; this.z0 = z0; this.z1 = z1;
    this.t = 0;
    this.update(0, 0);
  }

  // place ce qui bouge au temps t (dt > 0 : vitesses en plus)
  update(t, dt = 0) {
    this.t = t;
    for (const b of this.boxes) {
      const m = b.move; if (!m) continue;
      let s = Math.sin(m.w * t + m.ph), c = Math.cos(m.w * t + m.ph) * m.w;
      if (m.square) { const e = (s - 0.25) * 4; if (e <= 0 || e >= 1) c = 0; else c *= 4; s = e < 0 ? 0 : e > 1 ? 1 : e; } // ouvert ou fermé, avec un court passage
      b.x = b.bx + m.ax * s; b.y = b.by + m.ay * s; b.z = b.bz + m.az * s;
      if (b.door) { b.open = s; continue; } // une trappe se dérobe sans emporter ce qui est dessus
      b.vx = m.ax * c; b.vy = m.ay * c; b.vz = m.az * c;
    }
    for (const q of this.balls) {
      const a = q.amp * Math.sin(q.w * t), da = q.amp * Math.cos(q.w * t) * q.w;
      q.x = q.px + q.ax * Math.sin(a) * q.len; q.z = q.pz + q.az * Math.sin(a) * q.len; q.y = q.py - Math.cos(a) * q.len;
      q.vx = q.ax * Math.cos(a) * da * q.len; q.vz = q.az * Math.cos(a) * da * q.len; q.vy = Math.sin(a) * da * q.len;
    }
    for (const r of this.rollers) { r.x = r.bx + r.ax * Math.sin(r.w * t + r.ph); r.vx = r.ax * r.w * Math.cos(r.w * t + r.ph); r.spin = (r.x - r.bx) / r.r; }
    void dt;
  }
  // sans les pièges du décor : plus de boulet, de rouleau ni de pilon, les trappes restent fermées
  disableHazards() {
    this.balls = []; this.rollers = [];
    for (const b of this.boxes) { if (b.crush || b.knock) { b.move = null; b.y = 40; b.by = 40; b.vx = 0; } else if (b.door) { b.move = null; b.x = b.bx; b.open = 0; } }
  }
  // les trappes vont-elles s'ouvrir ? (annonce environ 1,4 s avant)
  alarm(t) { for (const b of this.boxes) if (b.door && b.move) { const m = b.move; if (Math.sin(m.w * t + m.ph) > -0.4 && Math.sin(m.w * t + m.ph) <= 0.25 && Math.cos(m.w * t + m.ph) > 0) return true; } return false; }
  // le rouleau est un cylindre couché et solide : il écarte ce qu'il touche
  rollerPush(q) {
    for (const r of this.rollers) {
      if (Math.abs(q.z - r.cz) > r.hz + q.r) continue;
      const ex = q.x - r.x, ey = q.y - r.cy, R = r.r + q.r, e2 = ex * ex + ey * ey;
      if (e2 >= R * R || e2 < 1e-8) continue;
      const e = Math.sqrt(e2), k = (R - e) / e; q.x += ex * k; q.y += ey * k; q.px = q.x - r.vx / 60;
    }
  }
  // le boulet est solide : il pousse au lieu de traverser
  ballPush(t) {
    for (const q of this.balls) {
      const ex = t.x - q.x, ey = t.y - q.y, ez = t.z - q.z, r = q.r + t.r, e2 = ex * ex + ey * ey + ez * ez;
      if (e2 >= r * r || e2 < 1e-8) continue;
      const e = Math.sqrt(e2), k = (r - e) / e;
      t.x += ex * k; t.y += ey * k; t.z += ez * k; t.px = t.x - q.vx / 60 * 0.8; t.pz = t.z - q.vz / 60 * 0.8;
    }
  }
  // un point est-il dans le feu ?
  inFire(x, y, z) { for (const f of this.burn) if (y < f.y && Math.abs(x - f.x) < f.hx && Math.abs(z - f.z) < f.hz) return true; return false; }

  // la plus haute surface sous ce point (jusqu'à yMax) : { y, box } ou null
  groundAt(x, z, yMax) {
    let best = null, by = -Infinity;
    for (const b of this.boxes) {
      if (Math.abs(x - b.x) > b.hx || Math.abs(z - b.z) > b.hz) continue;
      const top = b.y + b.hy;
      if (top <= yMax && top > by) { by = top; best = b; }
    }
    return best ? { y: by, box: best } : null;
  }
  // écarte une sphère des boîtes (sauf skip) ; renvoie la boîte sur laquelle elle s'appuie par le dessus
  collide(p, friction, skip = null) {
    let on = null;
    for (const b of this.boxes) {
      if (b === skip) continue;
      const dx = p.x - b.x, dy = p.y - b.y, dz = p.z - b.z;
      const ox = b.hx + p.r - Math.abs(dx); if (ox <= 0) continue;
      const oy = b.hy + p.r - Math.abs(dy); if (oy <= 0) continue;
      const oz = b.hz + p.r - Math.abs(dz); if (oz <= 0) continue;
      // venait-on du dessus ? (une sphère qui tombe vite ne ressort pas par le côté)
      const fromTop = p.py - p.r >= b.y + b.hy - 0.08 - Math.max(0, b.vy) / 60;
      if (fromTop || (oy <= ox && oy <= oz)) {
        const up = dy > 0 || fromTop;
        p.y += up ? oy : -oy;
        if (up) {
          on = b;
          const bx = b.vx / 60 + (b.belt ? b.belt[0] / 60 : 0), bz = b.vz / 60 + (b.belt ? b.belt[1] / 60 : 0);
          // frottement : la vitesse le long de la surface rejoint celle de la boîte
          p.px = p.x - bx - (p.x - p.px - bx) * (1 - friction);
          p.pz = p.z - bz - (p.z - p.pz - bz) * (1 - friction);
          if (p.y - p.py < b.vy / 60) p.py = p.y - b.vy / 60;
        } else if (p.y - p.py > b.vy / 60) p.py = p.y - b.vy / 60;
      } else if (ox <= oz) { p.x += dx > 0 ? ox : -ox; if (Math.sign(p.x - p.px) === -Math.sign(dx)) p.px = p.x - b.vx / 60; }
      else { p.z += dz > 0 ? oz : -oz; if (Math.sign(p.z - p.pz) === -Math.sign(dz)) p.pz = p.z - b.vz / 60; }
    }
    return on;
  }
  // ce qui va vite ne traverse pas une boîte fixe en un pas : si le trajet la franchit de part en part, le point s'arrête à l'entrée
  sweep(p, fx, fy, fz, skip = null) {
    const sx = p.x - fx, sy = p.y - fy, sz = p.z - fz;
    if (sx * sx + sy * sy + sz * sz > 1.44) return false; // un saut de plus de 1,2 m n'est pas un mouvement : remise en place
    let best = 2;
    for (const b of this.boxes) {
      if (b === skip || b.move) continue;
      let t0 = 0, t1 = 1, ok = true;
      for (const [o, d, c, h] of [[fx, sx, b.x, b.hx], [fy, sy, b.y, b.hy], [fz, sz, b.z, b.hz]]) {
        if (Math.abs(d) < 1e-7) { if (Math.abs(o - c) >= h) ok = false; continue; }
        let a = (c - h - o) / d, e = (c + h - o) / d; if (a > e) { const t = a; a = e; e = t; }
        t0 = Math.max(t0, a); t1 = Math.min(t1, e); if (t0 > t1) ok = false;
      }
      if (ok && t0 > 0 && t1 < 1 && t0 < best) best = t0; // le centre entre, puis ressort de l'autre côté
    }
    if (best > 1) return false;
    const k = Math.max(0, best - p.r / Math.max(1e-4, Math.hypot(sx, sy, sz)));
    p.x = fx + sx * k; p.y = fy + sy * k; p.z = fz + sz * k; p.px = p.x; p.py = p.y; p.pz = p.z;
    return true;
  }
  // point de boîte le plus proche (pour viser une prise) ; above : hauteur minimale du point, reach : portée
  nearestGrip(x, y, z, reach, above) {
    let best = null, bd = reach * reach;
    for (const b of this.boxes) {
      if (!b.grip) continue;
      const qx = Math.max(b.x - b.hx, Math.min(x, b.x + b.hx)), qy = Math.max(b.y - b.hy, Math.min(y, b.y + b.hy)), qz = Math.max(b.z - b.hz, Math.min(z, b.z + b.hz));
      if (qy < above) continue;
      const d = (qx - x) ** 2 + (qy - y) ** 2 + (qz - z) ** 2;
      if (d < bd) { bd = d; best = { x: qx, y: qy, z: qz, box: b }; }
    }
    return best;
  }
  // loin du vide ? (bots) : la distance au vide dans cette direction, jusqu'à max
  floorAhead(x, y, z, dx, dz, max = 3) {
    for (let r = 0.3; r <= max; r += 0.3) {
      const X = x + dx * r, Z = z + dz * r;
      if (this.boxes.some((b) => !b.move && Math.abs(X - b.x) < b.hx && Math.abs(Z - b.z) < b.hz && b.y + b.hy > y + 0.5 && b.y - b.hy < y + 1.2)) return max + 1; // un mur : pas de vide de ce côté
      const g = this.groundAt(X, Z, y + 0.5); if (!g || g.y < y - 0.7) return r;
    }
    return max + 1;
  }
}
