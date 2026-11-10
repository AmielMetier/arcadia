// The Backrooms (Level 5, le Terror Hotel) - Les chambres : lit à tête de lit sculptée, matelas, draps et couvre-lit en
// velours qui retombe sur les côtés, oreillers ; armoire à panneaux et à miroir ; bureau et sa lampe ; tables de nuit
// (un téléphone en bakélite sur l'une) ; tapis d'Orient sous le lit ; fenêtre aux rideaux de velours tirés, avec un
// filet de lumière froide entre eux, et son radiateur en fonte ; plafonnier en verre dépoli ; ombres de contact sous
// les meubles. Les modèles (fauteuil, commode, miroirs, tableau, valise) sont dans map.props (engine/hotel.js).
//
// Tout ce qui ne bouge pas est fusionné par matière (quelques appels de dessin pour les 21 chambres) ; seuls les
// abat-jour, qui grésillent chacun à leur rythme, restent à part.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { mergeGeometries } from '../../shared/vendor/three/BufferGeometryUtils.js';
import { FURNITURE } from '../engine/hotel.js';
import { drawRug, drawContactShadow } from './hotelTextures.js';

const TEX = new URL('../tex/', import.meta.url).href;

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// un rectangle aux coins arrondis, centré
function roundedRect(w, d, r) {
  const s = new THREE.Shape();
  const x0 = -w / 2;
  const y0 = -d / 2;
  s.moveTo(x0 + r, y0);
  s.lineTo(x0 + w - r, y0);
  s.quadraticCurveTo(x0 + w, y0, x0 + w, y0 + r);
  s.lineTo(x0 + w, y0 + d - r);
  s.quadraticCurveTo(x0 + w, y0 + d, x0 + w - r, y0 + d);
  s.lineTo(x0 + r, y0 + d);
  s.quadraticCurveTo(x0, y0 + d, x0, y0 + d - r);
  s.lineTo(x0, y0 + r);
  s.quadraticCurveTo(x0, y0, x0 + r, y0);
  return s;
}
// une dalle moelleuse (matelas, assise) : w × d au sol, t d'épaisseur, bords arrondis ; posée sur y = 0
function softSlab(w, d, t, bevel) {
  const g = new THREE.ExtrudeGeometry(roundedRect(w - 2 * bevel, d - 2 * bevel, 0.04), { depth: Math.max(0.001, t - 2 * bevel), bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 4 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, bevel, 0);
  return g;
}
// une planche découpée : le contour (x, y) en mètres, extrudé de t vers +z (centré sur z = 0)
function board(points, t) {
  const s = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 8 });
  g.translate(0, 0, -t / 2);
  return g;
}

export function buildHotelRooms({ map, group, baked, brass, lampShades, CEIL }) {
  const loader = new THREE.TextureLoader();
  const photo = (name, rep = 1) => {
    const t = loader.load(TEX + name);
    t.colorSpace = THREE.SRGBColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    t.anisotropy = 4;
    return t;
  };
  const walnutTex = photo('l5_noyer.jpg');
  const velvetTex = photo('l5_velours.jpg', 2);
  const rugTex = canvasTex(256, 384, (c, w, h) => drawRug(c, w, h));
  const shadowTex = canvasTex(64, 64, (c, s) => drawContactShadow(c, s));
  const phong = (o) => baked(new THREE.MeshPhongMaterial(o));
  const lam = (o) => baked(new THREE.MeshLambertMaterial(o));
  const M = {
    walnut: phong({ map: walnutTex, color: '#8a5434', specular: '#2b2018', shininess: 45 }),
    darkWalnut: phong({ map: walnutTex, color: '#55301c', specular: '#241a12', shininess: 40 }),
    velvet: lam({ map: velvetTex, color: '#8c1d22' }),
    upholstery: lam({ map: velvetTex, color: '#5e1216' }),
    curtain: lam({ map: velvetTex, color: '#3f644b', side: THREE.DoubleSide }),
    linen: lam({ color: '#ded4c0' }),
    pillow: lam({ color: '#ebe3d1' }),
    blotter: lam({ color: '#2b4734' }),
    bakelite: phong({ color: '#15110e', specular: '#5a544a', shininess: 80 }),
    book: lam({ color: '#5b2a1d' }),
    iron: phong({ color: '#77716a', specular: '#3a3630', shininess: 30 }),
    mirror: phong({ color: '#1b1d20', specular: '#c9d1d8', shininess: 140 }),
    paint: lam({ color: '#c4b593' }),
    rug: lam({ map: rugTex, color: '#a3927c', polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    night: new THREE.MeshBasicMaterial({ color: '#141c27' }),
    leak: new THREE.MeshBasicMaterial({ color: '#6f87a2' }),
    streak: new THREE.MeshBasicMaterial({ color: '#7f9bc0', transparent: true, opacity: 0.1, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    shadow: new THREE.MeshBasicMaterial({ color: '#000000', map: shadowTex, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    bowl: new THREE.MeshLambertMaterial({ color: '#e9dcc4', emissive: '#ffe2b4', emissiveIntensity: 0.9 }),
    brass,
  };

  // --- le lot : chaque pièce est copiée dans le repère du monde, puis fusionnée avec celles de même matière ---
  const bins = new Map();
  const add = (geo, mat, m) => {
    const g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(m);
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    g.clearGroups();
    if (!bins.has(mat)) bins.set(mat, []);
    bins.get(mat).push(g);
  };
  const base = new THREE.Matrix4();
  const setFrame = (x, z, ry, y = 0) => base.makeRotationY(ry).setPosition(x, y, z);
  const E = new THREE.Euler();
  const Q = new THREE.Quaternion();
  const local = (x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => new THREE.Matrix4().multiplyMatrices(base, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), new THREE.Vector3(sx, sy, sz)));
  const UNIT = new THREE.BoxGeometry(1, 1, 1);
  const bx = (w, h, d, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(UNIT, mat, local(x, y, z, w, h, d, rx, ry, rz));
  const geoCache = new Map();
  const cached = (key, make) => {
    if (!geoCache.has(key)) geoCache.set(key, make());
    return geoCache.get(key);
  };
  const cyl = (rt, rb, h, mat, x, y, z, seg = 10, rx = 0, rz = 0) => add(cached(`c${rt}/${rb}/${h}/${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)), mat, local(x, y, z, 1, 1, 1, rx, 0, rz));
  const ball = (sx, sy, sz, mat, x, y, z) => add(cached('ball', () => new THREE.SphereGeometry(1, 14, 10)), mat, local(x, y, z, sx, sy, sz));
  const flat = (w, d, mat, x, y, z, ry = 0) => add(cached('flat', () => new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), mat, local(x, y, z, w, 1, d, 0, ry, 0));
  const shadow = (w, d, x = 0, z = 0, ry = 0, y = 0.004) => flat(w, d, M.shadow, x, y, z, ry); // dans le repère courant

  const roomOf = new Map(map.rooms.map((r) => [r.id, r]));

  // --- 1. Les lits ---
  const BED = FURNITURE.bed;
  const mattressGeo = softSlab(BED.hw * 2 - 0.05, BED.hd * 2 - 0.06, 0.2, 0.035);
  const W2 = BED.hw * 2;
  const L = BED.hd * 2;
  // la tête de lit : deux montants, un fronton en arc, et entre eux un panneau capitonné de velours
  const headGeo = board([[-W2 / 2 - 0.05, 0], [W2 / 2 + 0.05, 0], [W2 / 2 + 0.05, 1.16], [W2 / 2 - 0.12, 1.2], [W2 * 0.25, 1.3], [0, 1.36], [-W2 * 0.25, 1.3], [-W2 / 2 + 0.12, 1.2], [-W2 / 2 - 0.05, 1.16]], 0.05);
  const footGeo = board([[-W2 / 2 - 0.05, 0.3], [W2 / 2 + 0.05, 0.3], [W2 / 2 + 0.05, 0.6], [W2 * 0.3, 0.64], [0, 0.66], [-W2 * 0.3, 0.64], [-W2 / 2 - 0.05, 0.6]], 0.045);
  for (const f of map.furniture) {
    if (f.kind !== 'bed') continue;
    const r = roomOf.get(f.room);
    const mess = r && r.mess;
    setFrame(f.x, f.z, f.rot);
    // pieds tournés, longerons, tête et pied de lit
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) cyl(0.03, 0.022, 0.32, M.darkWalnut, sx * (BED.hw - 0.03), 0.16, sz * (BED.hd - 0.03));
      bx(0.045, 0.14, L - 0.06, M.darkWalnut, sx * (BED.hw - 0.02), 0.37, 0);
      ball(0.035, 0.035, 0.035, M.brass, sx * (BED.hw + 0.02), 1.2, -BED.hd - 0.02);
    }
    add(headGeo, M.walnut, local(0, 0, -BED.hd - 0.02));
    bx(W2 - 0.3, 0.5, 0.03, M.upholstery, 0, 0.88, -BED.hd + 0.01);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) ball(0.012, 0.012, 0.008, M.brass, -0.4 + i * 0.4, 0.76 + j * 0.24, -BED.hd + 0.028);
    add(footGeo, M.walnut, local(0, 0, BED.hd + 0.0));
    // le matelas, ses draps et les oreillers
    bx(W2 - 0.08, 0.02, L - 0.08, M.darkWalnut, 0, 0.4, 0); // le sommier : vu de dessous, des lattes sombres
    add(mattressGeo, M.linen, local(0, 0.41, 0));
    for (const sx of [-0.42, 0.42]) ball(0.34, 0.085, 0.2, M.pillow, sx, 0.66, -BED.hd + 0.3);
    // le couvre-lit en velours : il couvre les deux tiers du lit et retombe sur les côtés ; le drap rabattu au-dessus
    const sl = L * 0.68;
    const sz0 = BED.hd - sl / 2;
    if (!mess) {
      bx(W2 + 0.05, 0.022, sl, M.velvet, 0, 0.615, sz0);
      for (const sx of [-1, 1]) bx(0.018, 0.36, sl, M.velvet, sx * (BED.hw + 0.035), 0.44, sz0, 0, 0, sx * 0.05);
      bx(W2 + 0.06, 0.026, 0.16, M.linen, 0, 0.62, sz0 - sl / 2 + 0.06);
    } else {
      // défait : le couvre-lit tiré de travers, à moitié par terre, le drap froissé
      bx(W2 * 0.8, 0.022, sl * 0.8, M.velvet, 0.25, 0.615, sz0 + 0.1, 0, 0.35, 0);
      bx(0.018, 0.4, sl * 0.6, M.velvet, BED.hw + 0.06, 0.42, sz0 + 0.2, 0, 0.3, 0.15);
      ball(0.2, 0.11, 0.34, M.velvet, BED.hw + 0.2, 0.07, sz0 + 0.35); // le bas du couvre-lit, en tas contre le lit
      ball(0.15, 0.08, 0.2, M.upholstery, BED.hw + 0.3, 0.05, sz0 + 0.7);
      ball(0.5, 0.05, 0.6, M.linen, -0.1, 0.6, 0.05);
    }
    // le tapis d'Orient, sous le lit et devant ; l'ombre sous le lit
    flat(2.3, 3.0, M.rug, 0, 0.006, 0.35, f.room % 2 ? Math.PI : 0);
    shadow(W2 + 0.35, L + 0.3, 0, 0, 0, 0.009);
    shadow(W2 - 0.1, L - 0.2, 0, 0, 0, 0.01); // et le noir, juste dessous
  }

  // --- 2. Les armoires : carcasse, socle, corniche à gradins, deux portes à panneaux (un miroir sur celle de gauche),
  // poignées en laiton. Entre les deux portes, la fente par laquelle on voit dehors quand on s'y cache ---
  const WD = FURNITURE.wardrobe;
  for (const f of map.furniture) {
    if (f.kind !== 'wardrobe') continue;
    setFrame(f.x, f.z, f.rot);
    const w = WD.hw * 2;
    const d = WD.hd * 2;
    const h = WD.h;
    bx(w, h - 0.2, d - 0.03, M.walnut, 0, 0.1 + (h - 0.2) / 2, -0.015);
    bx(w + 0.04, 0.1, d + 0.03, M.darkWalnut, 0, 0.05, 0);
    bx(w + 0.08, 0.05, d + 0.06, M.darkWalnut, 0, h - 0.025, 0.01);
    bx(w + 0.04, 0.06, d + 0.03, M.walnut, 0, h - 0.08, 0);
    const dw = WD.hw - 0.015;
    for (const sx of [-1, 1]) {
      const cx = sx * (0.015 + dw / 2);
      bx(dw, h - 0.32, 0.03, M.walnut, cx, 0.12 + (h - 0.32) / 2, WD.hd);
      // les panneaux : en haut (un miroir terni sur la porte de gauche), en bas
      bx(dw - 0.12, 0.95, 0.014, sx < 0 ? M.mirror : M.darkWalnut, cx, 1.32, WD.hd + 0.02);
      bx(dw - 0.12, 0.5, 0.014, M.darkWalnut, cx, 0.5, WD.hd + 0.02);
      cyl(0.008, 0.008, 0.13, M.brass, sx * 0.05, 1.08, WD.hd + 0.04);
    }
    bx(0.02, 0.04, 0.01, M.brass, 0.05, 0.98, WD.hd + 0.02);
    shadow(w + 0.4, d + 0.4);
  }

  // --- 3. Les bureaux : plateau débordant, ceinture et tiroir, pieds fuselés, sous-main de cuir vert, la lampe ---
  const DK = FURNITURE.desk;
  for (const f of map.furniture) {
    if (f.kind !== 'desk') continue;
    const r = roomOf.get(f.room);
    setFrame(f.x, f.z, f.rot);
    const h = DK.h;
    bx(DK.hw * 2 + 0.04, 0.035, DK.hd * 2 + 0.04, M.walnut, 0, h - 0.0175, 0);
    bx(DK.hw * 2 - 0.06, 0.11, DK.hd * 2 - 0.06, M.darkWalnut, 0, h - 0.09, 0);
    const out = r && r.mess ? 0.24 : 0; // fouillé : le tiroir est resté ouvert
    bx(0.5, 0.085, 0.02, M.walnut, 0, h - 0.09, DK.hd - 0.02 + out);
    if (out) {
      for (const sx of [-1, 1]) bx(0.012, 0.07, out, M.walnut, sx * 0.24, h - 0.09, DK.hd - 0.03 + out / 2);
      bx(0.48, 0.008, out, M.darkWalnut, 0, h - 0.125, DK.hd - 0.03 + out / 2);
    }
    ball(0.014, 0.014, 0.014, M.brass, 0, h - 0.09, DK.hd + out);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.024, 0.016, h - 0.15, M.darkWalnut, sx * (DK.hw - 0.05), (h - 0.15) / 2, sz * (DK.hd - 0.05));
    bx(0.55, 0.006, 0.36, M.blotter, -0.18, h + 0.003, 0.02);
    // la lampe de chevet : socle et tige en laiton, abat-jour de soie (à part : il grésille)
    cyl(0.07, 0.08, 0.02, M.brass, 0.32, h + 0.01, -0.05, 16);
    cyl(0.012, 0.012, 0.32, M.brass, 0.32, h + 0.18, -0.05);
    const l = map.lights.find((q) => q.lamp && Math.hypot(q.x - f.x, q.z - f.z) < 0.1);
    const shadeMat = new THREE.MeshLambertMaterial({ color: '#d9b67a', emissive: '#ffb860', emissiveIntensity: 0, side: THREE.DoubleSide });
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.2, 16, 1, true), shadeMat);
    shade.position.set(0.32, h + 0.4, -0.05).applyMatrix4(base);
    shade.rotation.y = f.rot;
    group.add(shade);
    if (l) lampShades.push({ l, mat: shadeMat, k: 1.2 });
    shadow(DK.hw * 2 + 0.4, DK.hd * 2 + 0.4);
  }

  // --- 4. Les tables de nuit, les radiateurs (map.solids) ---
  for (const s of map.solids) {
    if (s.nightstand) {
      setFrame(s.x, s.z, s.rot);
      bx(0.44, 0.52, 0.38, M.walnut, 0, 0.32, -0.01);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) cyl(0.018, 0.014, 0.08, M.darkWalnut, sx * 0.19, 0.04, sz * 0.16);
      bx(0.47, 0.025, 0.41, M.darkWalnut, 0, 0.595, 0);
      bx(0.38, 0.13, 0.014, M.darkWalnut, 0, 0.47, 0.185);
      ball(0.013, 0.013, 0.013, M.brass, 0, 0.47, 0.197);
      bx(0.38, 0.22, 0.01, M.book, 0, 0.23, 0.18); // le fond de la niche, dans l'ombre
      if (s.phone) {
        // le téléphone en bakélite : le corps, le cadran, le combiné couché sur sa fourche
        bx(0.16, 0.07, 0.19, M.bakelite, 0, 0.645, 0.01, -0.12, 0, 0);
        cyl(0.045, 0.045, 0.012, M.brass, 0, 0.66, 0.08, 16, Math.PI / 2 - 0.5, 0);
        cyl(0.018, 0.018, 0.2, M.bakelite, 0, 0.71, -0.01, 8, 0, Math.PI / 2);
        for (const sx of [-1, 1]) ball(0.035, 0.025, 0.035, M.bakelite, sx * 0.1, 0.7, -0.01);
      } else {
        bx(0.17, 0.035, 0.24, M.book, -0.04, 0.625, 0.02, 0, 0.2, 0);
        bx(0.16, 0.03, 0.22, M.blotter, -0.03, 0.657, 0.02, 0, 0.12, 0);
      }
      shadow(0.75, 0.7);
    } else if (s.radiator) {
      setFrame(s.x, s.z, Math.atan2(s.nx, s.nz));
      const n = 12;
      for (let i = 0; i < n; i++) bx(0.052, 0.58, 0.12, M.iron, -0.41 + (i * 0.82) / (n - 1), 0.4, 0);
      for (const y of [0.13, 0.67]) bx(0.88, 0.045, 0.06, M.iron, 0, y, -0.01);
      for (const sx of [-1, 1]) bx(0.05, 0.1, 0.13, M.iron, sx * 0.36, 0.05, 0);
      cyl(0.016, 0.016, 0.14, M.iron, 0.48, 0.07, -0.02);
      cyl(0.03, 0.03, 0.05, M.brass, 0.48, 0.17, -0.02, 10);
      shadow(1.2, 0.5, 0, 0.1);
    }
  }

  // --- 5. Les fenêtres : vitres sur la nuit, croisillons, rideaux de velours tirés à plis, cantonnière, et le filet de
  // lumière froide entre les deux rideaux, jusque sur le tapis ---
  const curtainGeo = cached('curtain', () => {
    const g = new THREE.PlaneGeometry(0.86, 2.74, 30, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const u = (x + 0.43) / 0.86;
      p.setZ(i, 0.045 * Math.sin(u * Math.PI * 11) + 0.015 * Math.sin(u * Math.PI * 23 + 1.3));
    }
    g.computeVertexNormals();
    return g;
  });
  for (const r of map.rooms) {
    const w = r.win;
    if (!w) continue;
    setFrame(w.x, w.z, Math.atan2(w.nx, w.nz)); // +z local : vers la chambre ; le mur en z = 0
    add(cached('night', () => new THREE.PlaneGeometry(1.4, 1.6)), M.night, local(0, 1.62, 0.004));
    bx(1.52, 0.08, 0.06, M.paint, 0, 2.46, 0.02);
    bx(1.6, 0.06, 0.16, M.paint, 0, 0.8, 0.06);
    for (const sx of [-1, 1]) bx(0.07, 1.68, 0.06, M.paint, sx * 0.725, 1.62, 0.02);
    bx(0.04, 1.6, 0.04, M.paint, 0, 1.62, 0.03);
    bx(1.4, 0.035, 0.04, M.paint, 0, 1.95, 0.03);
    // le filet de lumière : sur la vitre, entre les rideaux, et sa trace sur le sol
    // (les rideaux pendent devant l'appui et le radiateur, qu'on devine entre eux)
    add(cached('leak', () => new THREE.PlaneGeometry(0.15, 1.5)), M.leak, local(0, 1.62, 0.012));
    flat(0.3, 1.8, M.streak, 0, 0.01, 1.2);
    for (const sx of [-1, 1]) add(curtainGeo, M.curtain, local(sx * (0.08 + 0.43), 0.03 + 1.37, 0.27));
    bx(2.1, 0.3, 0.13, M.curtain, 0, 2.86, 0.31);
    bx(2.12, 0.03, 0.135, M.brass, 0, 2.72, 0.31);
  }

  // --- 6. Les plafonniers des chambres : une vasque de verre dépoli sous un cache en laiton ---
  const bowlGeo = new THREE.LatheGeometry([[0.001, -0.13], [0.06, -0.125], [0.12, -0.105], [0.17, -0.07], [0.205, -0.03], [0.22, 0]].map(([x, y]) => new THREE.Vector2(x, y)), 20);
  for (const l of map.lights) {
    if (l.sconce || l.lamp || l.chandelier || !(l.fy > CEIL - 0.2)) continue;
    setFrame(l.x, l.z, 0);
    cyl(0.07, 0.09, 0.03, M.brass, 0, CEIL - 0.015, 0, 16);
    for (let k = 0; k < 3; k++) cyl(0.004, 0.004, 0.14, M.brass, Math.cos((k * Math.PI * 2) / 3) * 0.16, CEIL - 0.08, Math.sin((k * Math.PI * 2) / 3) * 0.16, 4);
    add(bowlGeo, M.bowl, local(0, CEIL - 0.16, 0));
    ball(0.018, 0.03, 0.018, M.brass, 0, CEIL - 0.3, 0);
  }

  // --- 7. Les ombres de contact sous les modèles qu'on heurte (fauteuils, commodes, valises) ---
  for (const p of map.props) {
    if (!(p.r > 0) || p.y) continue;
    setFrame(p.x, p.z, p.rot || 0);
    shadow(p.r * 2.6, p.r * 2.6);
  }

  for (const [mat, list] of bins) {
    const mesh = new THREE.Mesh(mergeGeometries(list), mat);
    if (mat === M.shadow || mat === M.streak) mesh.renderOrder = 1;
    group.add(mesh);
  }
  for (const g of geoCache.values()) if (g) g.dispose();

  return {
    update(sim) {
      M.bowl.emissiveIntensity = sim.blackout > 0 ? 0 : 0.9;
    },
  };
}
