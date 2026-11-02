// Plouf ! — les arènes : des radeaux en planches posés sur la mer, décrits case par case (T mètres de côté).
// Une case est solide (1), branlante (2 : elle va couler) ou partie à l'eau (0). L'hôte fait couler les cases du bord
// une à une ; les invités reçoivent l'état des cases dans chaque instantané (encode / decode).

export const T = 1.25;            // côté d'une case (m)
export const GRACE = 0.2;         // au bord, on tient encore debout tant qu'on dépasse de moins de ça (on vacille)
const SHAKE_T = 1.4;              // une case branlante coule au bout de ce temps (s)

// '#' : planche, '.' : eau. spawn : rayon du cercle de départ autour du centre des planches.
export const SHAPES = {
  radeau: {
    name: 'Le Radeau de la Prom\'', spawn: 2.6,
    rows: ['.#######.', '#########', '#########', '#########', '#########', '#########', '.#######.'],
  },
  ponton: {
    name: 'Le Ponton du Port', spawn: 2.4,
    rows: ['..#######..', '###########', '###########', '###########', '..#######..'],
  },
  plongeoir: {
    name: 'Le Plongeoir', spawn: 2.5,
    rows: ['...###...', '...###...', '#########', '#########', '#########', '...###...', '...###...'],
  },
  jumeaux: {
    name: 'Les Deux Radeaux', spawn: 3.3,
    rows: ['####...####', '####...####', '###########', '####...####', '####...####'],
  },
  bouee: {
    name: 'La Bouée Géante', spawn: 3.1,
    rows: ['.#####.', '#######', '##...##', '##...##', '##...##', '#######', '.#####.'],
  },
};
export const SHAPE_KEYS = Object.keys(SHAPES);

// À 6 joueurs ou plus, le radeau gagne une rangée de planches tout autour (les trous rétrécissent d'autant).
function grow(rows) {
  const W = rows[0].length, H = rows.length, at = (c, r) => c >= 0 && r >= 0 && c < W && r < H && rows[r][c] === '#';
  const out = [];
  for (let r = -1; r <= H; r++) {
    let line = '';
    for (let c = -1; c <= W; c++) line += at(c, r) || at(c - 1, r) || at(c + 1, r) || at(c, r - 1) || at(c, r + 1) ? '#' : '.';
    out.push(line);
  }
  return out;
}

export class Arena {
  constructor(key, tiles = null, big = false) {
    const s0 = SHAPES[key] || SHAPES.radeau;
    const s = big ? { ...s0, rows: grow(s0.rows), spawn: s0.spawn + 0.8 } : s0;
    this.key = SHAPES[key] ? key : 'radeau';
    this.big = big ? 1 : 0;
    this.cols = s.rows[0].length; this.rows = s.rows.length;
    this.x0 = -this.cols * T / 2; this.z0 = -this.rows * T / 2;
    this.hx = this.cols * T / 2; this.hz = this.rows * T / 2;
    const n = this.cols * this.rows;
    this.st = new Uint8Array(n);
    this.shk = new Float32Array(n);
    for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.st[r * this.cols + c] = s.rows[r][c] === '#' ? 1 : 0;
    // centre des planches de départ et cases protégées (les plus proches du centre : elles tiennent jusqu'à la fin)
    const solid = []; for (let i = 0; i < n; i++) if (this.st[i]) solid.push(i);
    let sx = 0, sz = 0;
    for (const i of solid) { const p = this.center(i); sx += p.x; sz += p.z; }
    this.cx = solid.length ? sx / solid.length : 0; this.cz = solid.length ? sz / solid.length : 0;
    this.spawnR = s.spawn;
    this.name = s.name;
    solid.sort((a, b) => this.d2(a, this.cx, this.cz) - this.d2(b, this.cx, this.cz));
    this.core = new Set(solid.slice(0, 4));
    if (tiles) this.decode(tiles);
  }

  center(i) { return { x: this.x0 + ((i % this.cols) + 0.5) * T, z: this.z0 + (((i / this.cols) | 0) + 0.5) * T }; }
  d2(i, x, z) { const p = this.center(i); return (p.x - x) ** 2 + (p.z - z) ** 2; }
  cellAt(x, z) {
    const c = Math.floor((x - this.x0) / T), r = Math.floor((z - this.z0) / T);
    return c < 0 || r < 0 || c >= this.cols || r >= this.rows ? -1 : r * this.cols + c;
  }
  solid(i) { return i >= 0 && this.st[i] > 0; }

  // 0 : dans l'eau · 1 : sur les planches · 2 : au bord, on vacille (encore porté)
  support(x, z) {
    if (this.solid(this.cellAt(x, z))) return 1;
    for (const [dx, dz] of [[GRACE, 0], [-GRACE, 0], [0, GRACE], [0, -GRACE], [GRACE * 0.7, GRACE * 0.7], [-GRACE * 0.7, GRACE * 0.7], [GRACE * 0.7, -GRACE * 0.7], [-GRACE * 0.7, -GRACE * 0.7]]) {
      if (this.solid(this.cellAt(x + dx, z + dz))) return 2;
    }
    return 0;
  }
  // case sous ce point en train de couler ?
  shaking(x, z) { const i = this.cellAt(x, z); return i >= 0 && this.st[i] === 2; }

  // cases solides au bord (au moins un côté sur l'eau), hors des cases protégées tant que `core` est vrai
  edges(core = true) {
    const out = [];
    for (let i = 0; i < this.st.length; i++) {
      if (this.st[i] !== 1 || (core && this.core.has(i))) continue;
      const c = i % this.cols, r = (i / this.cols) | 0;
      const open = (cc, rr) => cc < 0 || rr < 0 || cc >= this.cols || rr >= this.rows || this.st[rr * this.cols + cc] !== 1;
      if (open(c - 1, r) || open(c + 1, r) || open(c, r - 1) || open(c, r + 1)) out.push(i);
    }
    return out;
  }
  count() { let k = 0; for (const s of this.st) if (s) k++; return k; }

  shake(i, t = SHAKE_T) { if (this.st[i] === 1) { this.st[i] = 2; this.shk[i] = t; } }
  // les cases branlantes coulent ; renvoie les cases parties à l'eau
  step(dt) {
    const sunk = [];
    for (let i = 0; i < this.st.length; i++) {
      if (this.st[i] !== 2) continue;
      this.shk[i] -= dt;
      if (this.shk[i] <= 0) { this.st[i] = 0; sunk.push(i); }
    }
    return sunk;
  }

  // case solide (pas branlante) la plus proche : où remonter, où se mettre à l'abri
  safeSpot(x, z) {
    let best = -1, bd = Infinity;
    for (let i = 0; i < this.st.length; i++) if (this.st[i] === 1) { const d = this.d2(i, x, z); if (d < bd) { bd = d; best = i; } }
    if (best < 0) for (let i = 0; i < this.st.length; i++) if (this.st[i]) { const d = this.d2(i, x, z); if (d < bd) { bd = d; best = i; } }
    return best < 0 ? null : this.center(best);
  }

  encode() { return Array.from(this.st, (s) => s).join(''); }
  decode(str) {
    if (typeof str !== 'string' || str.length !== this.st.length) return;
    for (let i = 0; i < str.length; i++) { const s = str.charCodeAt(i) - 48; if (s === 0) this.st[i] = 0; else if (s === 2 && this.st[i] !== 2) { this.st[i] = 2; this.shk[i] = 0.8; } else if (s === 1) this.st[i] = 1; }
  }
}
