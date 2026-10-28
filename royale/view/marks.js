// Island Rush — les traces qui restent : impacts de balles sur les murs, le décor et le sol, fissures qui s'étendent
// sur ce qu'on abîme (mur, construction, voiture…), brûlures au sol après une explosion. Des carrés plaqués sur la
// surface touchée (sa normale vient d'un court lancer de rayon dans le monde solide), tous dessinés d'un coup ; ils
// s'effacent avec le temps, et tout de suite quand l'objet qui les porte est détruit.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const CAP = 360;
// atlas 2 × 2 : impact, fissure, fissure (autre dessin), brûlure
const CELL = { trou: 0, fissure: 1, fissure2: 2, brulure: 3 };

function atlas() {
  const S = 512, H = S / 2, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  let s = 4242;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  // impact : trou sombre, auréole d'éclats, quelques rayures
  {
    const cx = H / 2, cy = H / 2;
    let grd = g.createRadialGradient(cx, cy, 0, cx, cy, H * 0.45);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(0.5, 'rgba(0,0,0,0.22)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, H, H);
    g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4;
    for (let i = 0; i < 9; i++) { const a = r() * Math.PI * 2, l = H * (0.18 + r() * 0.22); g.beginPath(); g.moveTo(cx + Math.cos(a) * H * 0.08, cy + Math.sin(a) * H * 0.08); g.lineTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l); g.stroke(); }
    grd = g.createRadialGradient(cx, cy, 0, cx, cy, H * 0.13);
    grd.addColorStop(0, 'rgba(0,0,0,1)'); grd.addColorStop(0.7, 'rgba(10,8,6,0.95)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, H * 0.13, 0, Math.PI * 2); g.fill();
  }
  // fissures : un éclat au centre d'où partent quelques lézardes anguleuses, qui s'amincissent et se ramifient peu
  const crack = (ox, oy, n) => {
    g.save(); g.beginPath(); g.rect(ox, oy, H, H); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'miter';
    const cx = ox + H / 2, cy = oy + H / 2;
    const branch = (x, y, a, len, w, depth) => {
      const pts = [[x, y]], seg = 6;
      for (let k = 0; k < seg; k++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * len / seg; y += Math.sin(a) * len / seg; pts.push([x, y]); }
      // trait par trait, de plus en plus fin
      for (let k = 1; k < pts.length; k++) {
        const ww = Math.max(0.8, w * (1 - (k - 1) / seg));
        g.strokeStyle = `rgba(0,0,0,${0.85 - 0.4 * (k / seg)})`; g.lineWidth = ww;
        g.beginPath(); g.moveTo(pts[k - 1][0], pts[k - 1][1]); g.lineTo(pts[k][0], pts[k][1]); g.stroke();
        // bord clair à côté (l'enduit éclaté)
        g.strokeStyle = 'rgba(255,255,255,0.18)'; g.lineWidth = ww * 0.6;
        g.beginPath(); g.moveTo(pts[k - 1][0] + 1.5, pts[k - 1][1] + 1.5); g.lineTo(pts[k][0] + 1.5, pts[k][1] + 1.5); g.stroke();
      }
      if (depth < 1) for (let k = 2; k < pts.length - 1; k++) if (r() < 0.3) branch(pts[k][0], pts[k][1], a + (r() < 0.5 ? -1 : 1) * (0.6 + r() * 0.5), len * 0.4, w * 0.5, depth + 1);
    };
    for (let i = 0; i < n; i++) branch(cx, cy, (i / n) * Math.PI * 2 + r() * 0.8, H * (0.3 + r() * 0.16), 6, 0);
    // éclat : enduit arraché au centre
    g.fillStyle = 'rgba(0,0,0,0.45)';
    g.beginPath();
    for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2, d = H * (0.04 + r() * 0.05); k ? g.lineTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d) : g.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); }
    g.closePath(); g.fill();
    g.restore();
  };
  crack(H, 0, 5); crack(0, H, 4);
  // brûlure : suie en taches irrégulières, plus noire au centre
  for (let i = 0; i < 26; i++) {
    const a = r() * Math.PI * 2, d = Math.pow(r(), 1.5) * H * 0.3, x = H + H / 2 + Math.cos(a) * d, y = H + H / 2 + Math.sin(a) * d, rr = H * (0.08 + r() * 0.16);
    const grd = g.createRadialGradient(x, y, 0, x, y, rr);
    grd.addColorStop(0, `rgba(8,6,5,${0.35 + r() * 0.3})`); grd.addColorStop(1, 'rgba(8,6,5,0)');
    g.fillStyle = grd; g.fillRect(H, H, H, H);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

export function createMarks(scene, world, map) {
  const tex = atlas();
  const geo = new THREE.PlaneGeometry(1, 1);
  const aCell = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1), aAlpha = new THREE.InstancedBufferAttribute(new Float32Array(CAP), 1);
  aAlpha.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aCell', aCell); geo.setAttribute('aAlpha', aAlpha);
  // décalées vers la caméra dans la profondeur : jamais de scintillement avec la surface qu'elles recouvrent
  const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, metalness: 0, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  mat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aCell; attribute float aAlpha; varying float vAlpha;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMapUv = uv * 0.5 + vec2(mod(aCell, 2.0), 1.0 - floor(aCell / 2.0)) * 0.5; vAlpha = aAlpha;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vAlpha;')
      .replace('#include <map_fragment>', '#include <map_fragment>\ndiffuseColor.a *= vAlpha;');
  };
  mat.customProgramCacheKey = () => 'royale-marks';
  const mesh = new THREE.InstancedMesh(geo, mat, CAP);
  mesh.frustumCulled = false; mesh.receiveShadow = true; mesh.renderOrder = 1;
  const zero = new THREE.Matrix4().makeScale(0, 0, 0), col = new THREE.Color();
  for (let i = 0; i < CAP; i++) { mesh.setMatrixAt(i, zero); mesh.setColorAt(i, col.setRGB(1, 1, 1)); }
  scene.add(mesh);

  const slots = new Array(CAP).fill(null);
  let next = 0, busy = 0;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), qr = new THREE.Quaternion(), p = new THREE.Vector3(), n = new THREE.Vector3(), s = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);

  // surface touchée en (x, y, z) par un trait de direction (dx, dy, dz) : normale et clé de l'objet (null : le sol)
  // (reach : jusqu'où chercher au-delà du point)
  function surface(x, y, z, dx, dy, dz, reach = 0.4) {
    const h = world.raycast(x - dx * 0.3, y - dy * 0.3, z - dz * 0.3, dx, dy, dz, 0.3 + reach);
    if (h.t >= 0.3 + reach) return null;
    const hx = x - dx * 0.3 + dx * h.t, hy = y - dy * 0.3 + dy * h.t, hz = z - dz * 0.3 + dz * h.t, o = h.s;
    if (!o) {
      const e = 0.4, gx = map.heightAt(hx + e, hz) - map.heightAt(hx - e, hz), gz = map.heightAt(hx, hz + e) - map.heightAt(hx, hz - e);
      // (routes, trottoirs et places sont dessinés 7 cm au-dessus du relief : la trace passe par-dessus)
      return { x: hx, y: hy, z: hz, n: n.set(-gx / (2 * e), 1, -gz / (2 * e)).normalize(), key: null, lift: 0.1 };
    }
    const key = o.key || null;
    if (key && key[0] === 'd') return null; // une porte bouge : pas de trace dessus
    if (o.t == null) {
      // rampe (escalier) : sa pente
      const L = Math.max(0.01, Math.abs(o.dx) ? o.x1 - o.x0 : o.z1 - o.z0), k = (o.y1 - o.y0) / L;
      n.set(-o.dx * k, 1, -o.dz * k).normalize();
    } else if (o.t === 0) {
      const f = [[hx - o.x0, -1, 0, 0], [o.x1 - hx, 1, 0, 0], [hy - o.y0, 0, -1, 0], [o.y1 - hy, 0, 1, 0], [hz - o.z0, 0, 0, -1], [o.z1 - hz, 0, 0, 1]];
      let b = f[0]; for (const c of f) if (Math.abs(c[0]) < Math.abs(b[0])) b = c;
      n.set(b[1], b[2], b[3]);
    } else if (o.t === 1) {
      if (o.y1 - hy < 0.05) n.set(0, 1, 0); else n.set(hx - o.cx, 0, hz - o.cz).normalize();
    } else {
      const ex = hx - o.cx, ez = hz - o.cz, u = ex * o.ux + ez * o.uz, v = -ex * o.uz + ez * o.ux;
      const du = o.hx - Math.abs(u), dv = o.hz - Math.abs(v), dt = o.y1 - hy;
      if (dt < du && dt < dv) n.set(0, 1, 0);
      else if (du < dv) n.set(o.ux * Math.sign(u), 0, o.uz * Math.sign(u));
      else n.set(-o.uz * Math.sign(v), 0, o.ux * Math.sign(v));
    }
    return { x: hx, y: hy, z: hz, n, key };
  }
  function put(sf, cell, size, life, alpha, rgb = 0xffffff) {
    const i = next; next = (next + 1) % CAP;
    if (!slots[i]) busy++;
    slots[i] = { t: 0, life, alpha, key: sf.key };
    q.setFromUnitVectors(Z, sf.n).multiply(qr.setFromAxisAngle(Z, Math.random() * Math.PI * 2));
    p.set(sf.x, sf.y, sf.z).addScaledVector(sf.n, sf.lift || 0.012);
    mesh.setMatrixAt(i, m4.compose(p, q, s.set(size, size, size)));
    mesh.setColorAt(i, col.setHex(rgb));
    aCell.setX(i, cell); aAlpha.setX(i, alpha);
    mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; aCell.needsUpdate = true; aAlpha.needsUpdate = true;
  }
  const cracked = new Map(); // clé → paliers de fissure déjà dessinés
  return {
    mesh,
    // balle arrivée en `to` depuis `from` ; pellet : un plomb du fusil à pompe (plus petit)
    impact(from, to, w, pellet = false) {
      let dx = to[0] - from[0], dy = to[1] - from[1], dz = to[2] - from[2];
      const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      const sf = surface(to[0], to[1], to[2], dx, dy, dz);
      if (!sf) return;
      const size = pellet ? 0.1 : w === 'sniper' ? 0.24 : 0.15 + Math.random() * 0.04;
      put(sf, CELL.trou, size, 28, 0.95);
    },
    // coup sur un objet (balle, pioche) : une fissure de plus à chaque quart de ses points de vie perdu
    hit(key, x, y, z, hp, max, from) {
      if (!key || !from || key[0] === 'd' || max <= 0) return;
      const lost = 1 - Math.max(0, hp) / max, step = Math.floor(lost * 4), had = cracked.get(key) || 0;
      if (step <= had || step >= 4) return;
      cracked.set(key, step);
      let dx = x - from[0], dy = y - from[1], dz = z - from[2];
      const L = Math.hypot(dx, dy, dz) || 1; dx /= L; dy /= L; dz /= L;
      const sf = surface(x, y, z, dx, dy, dz);
      if (!sf) return;
      const big = key[0] === 'w' || key[0] === 'b' || key[0] === 's';
      put(sf, step % 2 ? CELL.fissure : CELL.fissure2, (big ? 0.9 : 0.45) + lost * (big ? 1.4 : 0.6), 120, 0.9);
    },
    // brûlure au sol sous une explosion de rayon r
    scorch(x, y, z, r) {
      const sf = surface(x, y, z, 0, -1, 0, 2);
      if (!sf) return;
      put(sf, CELL.brulure, r * 1.5, 45, 0.9);
    },
    // l'objet est détruit : ses traces partent avec lui
    broken(key) {
      cracked.delete(key);
      let any = false;
      for (let i = 0; i < CAP; i++) if (slots[i] && slots[i].key === key) { slots[i] = null; busy--; mesh.setMatrixAt(i, zero); any = true; }
      if (any) mesh.instanceMatrix.needsUpdate = true;
    },
    update(dt) {
      if (!busy) return;
      let moved = false;
      for (let i = 0; i < CAP; i++) {
        const sl = slots[i];
        if (!sl) continue;
        sl.t += dt;
        if (sl.t >= sl.life) { slots[i] = null; busy--; mesh.setMatrixAt(i, zero); moved = true; continue; }
        // effacement sur les 3 dernières secondes
        const a = sl.alpha * Math.min(1, (sl.life - sl.t) / 3);
        if (a !== aAlpha.getX(i)) { aAlpha.setX(i, a); aAlpha.needsUpdate = true; }
      }
      if (moved) mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() { scene.remove(mesh); geo.dispose(); mat.dispose(); tex.dispose(); },
  };
}
