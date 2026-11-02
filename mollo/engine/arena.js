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
      B(0.1, -0.1, 3.4, 2.2, 0.2, 1.5, 'metal', { move: { ax: 0, ay: 0, az: 2.6, w: 0.7, ph: 0 } }), // nacelle du laveur de vitres
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
      const s = Math.sin(m.w * t + m.ph), c = Math.cos(m.w * t + m.ph) * m.w;
      b.x = b.bx + m.ax * s; b.y = b.by + m.ay * s; b.z = b.bz + m.az * s;
      b.vx = m.ax * c; b.vy = m.ay * c; b.vz = m.az * c;
    }
    for (const q of this.balls) {
      const a = q.amp * Math.sin(q.w * t), da = q.amp * Math.cos(q.w * t) * q.w;
      q.x = q.px + q.ax * Math.sin(a) * q.len; q.z = q.pz + q.az * Math.sin(a) * q.len; q.y = q.py - Math.cos(a) * q.len;
      q.vx = q.ax * Math.cos(a) * da * q.len; q.vz = q.az * Math.cos(a) * da * q.len; q.vy = Math.sin(a) * da * q.len;
    }
    void dt;
  }

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
  // écarte une sphère des boîtes ; renvoie la boîte sur laquelle elle s'appuie par le dessus
  collide(p, friction) {
    let on = null;
    for (const b of this.boxes) {
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
    for (let r = 0.3; r <= max; r += 0.3) { const g = this.groundAt(x + dx * r, z + dz * r, y + 0.5); if (!g || g.y < y - 0.7) return r; }
    return max + 1;
  }
}
