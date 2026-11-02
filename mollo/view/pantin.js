// Mollo ! — dessine les mollassons : un seul InstancedMesh de cylindres et de sphères pour tous les corps, teintés par joueur.
// Rien n'est animé ici : chaque image, on habille les sept points de la physique. Coudes et genoux se déduisent (IK à deux segments).
// Le personnage : tête de pâte crème, salopette à la couleur du joueur, gros gants, bottes, un chapeau différent pour chacun.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

const MAX = 8;
const UP = new THREE.Vector3(0, 1, 0);
const v = () => new THREE.Vector3();
const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s3 = v(), p3 = v(), d3 = v();
const P = v(), C = v(), H = v(), LH = v(), RH = v(), LF = v(), RF = v(), up = v(), fw = v(), rg = v(), sh = v(), hip = v(), el = v(), hu = v(), hf = v(), hr = v(), tmp = v(), pole = v();
const CREAM = new THREE.Color('#ffdcb5'), CHEEK = new THREE.Color('#ff8d8d'), BOOT = new THREE.Color('#3b2a22'), WHITE = new THREE.Color('#ffffff'), BLACK = new THREE.Color('#1c1420'), STAR = new THREE.Color('#ffe066');

function mesh(geo, count, mat, shadow = true) {
  const m = new THREE.InstancedMesh(geo, mat, count);
  m.frustumCulled = false; m.castShadow = shadow; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  m.setColorAt(0, WHITE); return m;
}

// coude ou genou : où plier entre root et tip, du côté de pole
function ik(root, tip, l1, l2, pl, out) {
  d3.subVectors(tip, root); let d = d3.length();
  const max = (l1 + l2) * 0.999, min = Math.abs(l1 - l2) + 0.02;
  if (d < 1e-4) { d3.set(0, -1, 0); d = 1e-4; } else d3.multiplyScalar(1 / d);
  const dd = Math.min(max, Math.max(min, d));
  const a = (l1 * l1 - l2 * l2 + dd * dd) / (2 * dd), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
  tmp.copy(pl).addScaledVector(d3, -pl.dot(d3));
  if (tmp.lengthSq() < 1e-5) tmp.set(d3.y, -d3.x, 0.01);
  tmp.normalize();
  out.copy(root).addScaledVector(d3, a).addScaledVector(tmp, h);
  return out;
}

const HATS = [
  (g, c) => { add(g, new THREE.SphereGeometry(0.31, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#ffc531', 0, 0.09, 0); add(g, new THREE.CylinderGeometry(0.37, 0.37, 0.03, 18), '#f0a800', 0, 0.09, 0.02); void c; }, // casque de chantier
  (g, c) => { add(g, new THREE.SphereGeometry(0.31, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0.1, 0); add(g, new THREE.SphereGeometry(0.1, 10, 8), '#fff', 0, 0.45, 0); }, // bonnet à pompon
  (g, c) => { add(g, new THREE.SphereGeometry(0.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), c, 0, 0.12, 0); add(g, new THREE.BoxGeometry(0.34, 0.03, 0.26), c, 0, 0.14, 0.34); }, // casquette
  (g) => { add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.34, 16), '#23232b', 0, 0.42, 0); add(g, new THREE.CylinderGeometry(0.31, 0.31, 0.03, 18), '#23232b', 0, 0.25, 0); add(g, new THREE.CylinderGeometry(0.205, 0.205, 0.06, 16), '#c9304a', 0, 0.28, 0); }, // haut-de-forme
  (g) => { add(g, new THREE.CylinderGeometry(0.25, 0.2, 0.2, 16), '#fff', 0, 0.33, 0); add(g, new THREE.SphereGeometry(0.26, 12, 8), '#fff', 0, 0.5, 0, 1, 0.55, 1); }, // toque
  (g, c) => { add(g, new THREE.SphereGeometry(0.11, 10, 8), c, -0.23, 0.29, 0, 1, 1.5, 0.5); add(g, new THREE.SphereGeometry(0.11, 10, 8), c, 0.23, 0.29, 0, 1, 1.5, 0.5); }, // oreilles
  (g, c) => { add(g, new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), '#555', 0, 0.42, 0); add(g, new THREE.SphereGeometry(0.06, 10, 8), c, 0, 0.58, 0); }, // antenne
  (g, c) => { add(g, new THREE.ConeGeometry(0.1, 0.34, 8), c, 0, 0.42, -0.02); add(g, new THREE.ConeGeometry(0.08, 0.26, 8), c, -0.1, 0.36, 0.04); add(g, new THREE.ConeGeometry(0.08, 0.26, 8), c, 0.1, 0.36, 0.04); }, // mèche
];
function add(g, geo, color, x, y, z, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color })); m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = true; g.add(m);
}

export class Pantins {
  constructor(scene) {
    this.scene = scene;
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }), face = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.cyl = mesh(new THREE.CylinderGeometry(1, 1, 1, 12), MAX * 9, mat);
    this.ball = mesh(new THREE.SphereGeometry(1, 16, 12), MAX * 16, mat);
    this.face = mesh(new THREE.SphereGeometry(1, 10, 8), MAX * 7, face, false);
    scene.add(this.cyl, this.ball, this.face);
    this.hats = new Map(); this.cols = new Map(); this.knees = new Map(); this.hurtT = new Map(); this.t = 0;
  }
  hurt(id) { this.hurtT.set(id, 0.35); }
  seg(a, b, r, col) {
    d3.subVectors(b, a); const l = d3.length(); if (l < 1e-4) return;
    d3.multiplyScalar(1 / l); q4.setFromUnitVectors(UP, d3); p3.addVectors(a, b).multiplyScalar(0.5); s3.set(r, l, r);
    m4.compose(p3, q4, s3);
    const i = this.cyl.count++; this.cyl.setMatrixAt(i, m4); this.cyl.setColorAt(i, col);
  }
  sph(p, r, col) { m4.makeScale(r, r, r).setPosition(p); const i = this.ball.count++; this.ball.setMatrixAt(i, m4); this.ball.setColorAt(i, col); }
  // un élément du visage, dans le repère de la tête
  fc(x, y, z, sx, sy, sz, col) {
    m4.makeBasis(hr, hu, hf); p3.copy(H).addScaledVector(hr, x).addScaledVector(hu, y).addScaledVector(hf, z);
    m4.setPosition(p3); m4.scale(s3.set(sx, sy, sz));
    const i = this.face.count++; this.face.setMatrixAt(i, m4); this.face.setColorAt(i, col);
  }
  colors(p) {
    let c = this.cols.get(p.id);
    if (!c || c.src !== p.color) { const s = new THREE.Color(p.color); c = { src: p.color, suit: s, glove: s.clone().multiplyScalar(0.62), sleeve: s.clone().lerp(WHITE, 0.25) }; this.cols.set(p.id, c); }
    return c;
  }
  hat(p, k) {
    let g = this.hats.get(p.id);
    if (!g) { g = new THREE.Group(); g.matrixAutoUpdate = false; HATS[k % HATS.length](g, p.color); this.scene.add(g); this.hats.set(p.id, g); }
    return g;
  }
  knee(id, i, cur) { // lissé : un genou ne saute jamais d'un côté à l'autre d'une image à la suivante
    const key = id * 4 + i; let k = this.knees.get(key);
    if (!k) { k = cur.clone(); this.knees.set(key, k); }
    k.lerp(cur, 0.55); return k;
  }

  draw(players, dt) {
    this.t += dt; this.cyl.count = this.ball.count = this.face.count = 0;
    const seen = new Set();
    players.forEach((p, k) => {
      if (!p.pos) return;
      seen.add(p.id);
      const q = p.pos, c = this.colors(p);
      P.set(q[0], q[1], q[2]); C.set(q[3], q[4], q[5]); H.set(q[6], q[7], q[8]); LH.set(q[9], q[10], q[11]); RH.set(q[12], q[13], q[14]); LF.set(q[15], q[16], q[17]); RF.set(q[18], q[19], q[20]);
      up.subVectors(C, P); if (up.lengthSq() < 1e-4) up.set(0, 1, 0); up.normalize();
      fw.set(Math.sin(p.yaw), 0, Math.cos(p.yaw)); rg.crossVectors(up, fw); if (rg.lengthSq() < 0.01) rg.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw)); rg.normalize();
      // tronc dodu
      this.sph(P, 0.28, c.suit); this.sph(C, 0.3, c.suit); this.seg(P, C, 0.28, c.suit);
      // jambes et bottes
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, foot = i ? RF : LF;
        hip.copy(P).addScaledVector(rg, side * 0.14).addScaledVector(up, -0.05);
        pole.copy(fw).addScaledVector(rg, side * 0.2);
        const kn = this.knee(p.id, i, ik(hip, foot, 0.47, 0.47, pole, el));
        this.seg(hip, kn, 0.125, c.suit); this.seg(kn, foot, 0.105, c.suit); this.sph(kn, 0.11, c.suit);
        tmp.copy(foot).addScaledVector(fw, 0.06); m4.compose(tmp, q4.setFromAxisAngle(UP, p.yaw), s3.set(0.14, 0.1, 0.22)); const j = this.ball.count++; this.ball.setMatrixAt(j, m4); this.ball.setColorAt(j, BOOT);
      }
      // bras et gros gants
      for (let i = 0; i < 2; i++) {
        const side = i ? 1 : -1, hand = i ? RH : LH;
        sh.copy(C).addScaledVector(rg, side * 0.28).addScaledVector(up, 0.08);
        pole.copy(fw).multiplyScalar(-0.6).addScaledVector(rg, side * 0.7).addScaledVector(up, -0.3);
        const e = this.knee(p.id, i + 2, ik(sh, hand, 0.37, 0.37, pole, el));
        this.seg(sh, e, 0.09, c.sleeve); this.seg(e, hand, 0.08, c.sleeve); this.sph(sh, 0.105, c.sleeve); this.sph(e, 0.085, c.sleeve); this.sph(hand, 0.135, c.glove);
      }
      // tête : grosse boule de pâte, légèrement écrasée
      hu.subVectors(H, C); if (hu.lengthSq() < 1e-4) hu.copy(up); hu.normalize();
      hf.copy(fw).addScaledVector(hu, -fw.dot(hu)); if (hf.lengthSq() < 1e-3) hf.copy(rg).cross(hu); hf.normalize(); hr.crossVectors(hu, hf);
      this.seg(C, H, 0.13, CREAM);
      m4.makeBasis(hr, hu, hf).setPosition(H); m4.scale(s3.set(0.31, 0.29, 0.3)); { const j = this.ball.count++; this.ball.setMatrixAt(j, m4); this.ball.setColorAt(j, CREAM); }
      // le visage dit l'état : assommé, sonné, frappé
      const ko = p.st === 1, hurt = this.hurtT.get(p.id) || 0, blink = Math.sin(this.t * 0.9 + k * 2) > 0.995;
      if (hurt > 0) this.hurtT.set(p.id, hurt - dt);
      if (ko || blink) { this.fc(-0.12, 0.05, 0.27, 0.07, 0.014, 0.02, BLACK); this.fc(0.12, 0.05, 0.27, 0.07, 0.014, 0.02, BLACK); }
      else {
        const big = hurt > 0 ? 1.3 : 1;
        this.fc(-0.115, 0.05, 0.255, 0.075 * big, 0.085 * big, 0.04, WHITE); this.fc(0.115, 0.05, 0.255, 0.075 * big, 0.085 * big, 0.04, WHITE);
        const look = p.dz > 0.55 ? Math.sin(this.t * 9) * 0.02 : 0;
        this.fc(-0.115 + look, 0.05, 0.292, 0.036, 0.04, 0.012, BLACK); this.fc(0.115 - look, 0.05, 0.292, 0.036, 0.04, 0.012, BLACK);
      }
      this.fc(-0.2, -0.05, 0.215, 0.055, 0.032, 0.02, CHEEK); this.fc(0.2, -0.05, 0.215, 0.055, 0.032, 0.02, CHEEK);
      const open = ko ? 0.045 : hurt > 0 ? 0.06 : p.fl & 8 ? 0.025 : 0.012;
      this.fc(0, -0.09, 0.275, ko ? 0.05 : 0.065, open, 0.02, BLACK);
      // des étoiles quand on est assommé ou sonné
      if (ko || p.dz > 0.7) for (let i = 0; i < (ko ? 4 : 2); i++) { const a = this.t * 5 + i * Math.PI * 2 / (ko ? 4 : 2); tmp.set(H.x + Math.cos(a) * 0.4, H.y + 0.4 + Math.sin(a * 2) * 0.04, H.z + Math.sin(a) * 0.4); this.sph(tmp, 0.05, STAR); }
      // chapeau
      const g = this.hat(p, k); g.visible = true;
      g.matrix.makeBasis(hr, hu, hf).setPosition(H); g.matrixWorldNeedsUpdate = true;
    });
    for (const [id, g] of this.hats) if (!seen.has(id)) g.visible = false;
    for (const m of [this.cyl, this.ball, this.face]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
  }
  dispose() { this.cyl.geometry.dispose(); this.ball.geometry.dispose(); this.face.geometry.dispose(); this.cyl.material.dispose(); this.face.material.dispose(); for (const g of this.hats.values()) g.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } }); }
}
