// Island Rush — les largages : une caisse renforcée sous un parachute rayé, qui descend en se balançant dans le
// prochain cercle ; posée, le parachute retombe et un faisceau violet la signale de loin jusqu'à ce qu'on l'ouvre
// (le couvercle se soulève). Suit sim.S.drops (engine/sim.js) : chez l'hôte comme chez les invités.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { dropY } from '../engine/sim.js';

const PURPLE = 0xb77dff;

export function createDrops(scene) {
  const group = new THREE.Group(); scene.add(group);
  const geo = {
    crate: new THREE.BoxGeometry(1.4, 1.0, 1.4).translate(0, 0.5, 0),
    band: new THREE.BoxGeometry(1.48, 0.14, 1.48),
    lid: new THREE.BoxGeometry(1.46, 0.18, 1.46).translate(0, 0.09, 0),
    // dôme du parachute, ses rayures dans les couleurs des sommets
    canopy: (() => {
      const g = new THREE.SphereGeometry(2.7, 16, 6, 0, Math.PI * 2, 0, Math.PI / 2.3).scale(1, 0.6, 1);
      const pos = g.attributes.position, col = new Float32Array(pos.count * 3), a = new THREE.Color(PURPLE), b = new THREE.Color(0xf4f0ff);
      for (let i = 0; i < pos.count; i++) { const k = Math.floor(((Math.atan2(pos.getZ(i), pos.getX(i)) + Math.PI) / (Math.PI * 2)) * 8) % 2 ? a : b; col.set([k.r, k.g, k.b], i * 3); }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      return g;
    })(),
    // suspentes : du bord du dôme aux coins de la caisse
    ropes: (() => {
      const pts = [];
      for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; pts.push(Math.cos(a) * 2.3, 4.4, Math.sin(a) * 2.3, Math.cos(a) * 0.95, 1.0, Math.sin(a) * 0.95); }
      return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    })(),
    beam: new THREE.CylinderGeometry(0.45, 0.45, 140, 14, 1, true).translate(0, 70, 0),
  };
  const mat = {
    crate: new THREE.MeshStandardMaterial({ color: 0x3e4a5e, roughness: 0.55, metalness: 0.35 }),
    band: new THREE.MeshStandardMaterial({ color: PURPLE, roughness: 0.4, emissive: PURPLE, emissiveIntensity: 0.6 }),
    canopy: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide, transparent: true }),
    ropes: new THREE.LineBasicMaterial({ color: 0xe8e2d0, transparent: true }),
    beam: new THREE.MeshBasicMaterial({ color: PURPLE, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  };
  const items = new Map(); // id → { root, crate, lid, chute, beam, fold }
  function make(d) {
    const root = new THREE.Group(), crate = new THREE.Group();
    const body = new THREE.Mesh(geo.crate, mat.crate); body.castShadow = true; body.receiveShadow = true;
    const b1 = new THREE.Mesh(geo.band, mat.band); b1.position.y = 0.32;
    const b2 = new THREE.Mesh(geo.band, mat.band); b2.position.y = 0.7;
    const lid = new THREE.Mesh(geo.lid, mat.crate); lid.position.y = 1.0; lid.castShadow = true;
    crate.add(body, b1, b2, lid);
    const chute = new THREE.Group();
    const canopy = new THREE.Mesh(geo.canopy, mat.canopy); canopy.position.y = 4.4;
    chute.add(canopy, new THREE.LineSegments(geo.ropes, mat.ropes));
    const beam = new THREE.Mesh(geo.beam, mat.beam); beam.visible = false; beam.renderOrder = 3;
    root.add(crate, chute, beam);
    group.add(root);
    const it = { root, crate, lid, chute, beam, fold: 0, ph: (d.x * 0.37 + d.z * 0.11) % 6.28 };
    items.set(d.id, it);
    return it;
  }
  function update(dt, t, S) {
    for (const [id, it] of items) if (!S.drops.has(id)) { group.remove(it.root); items.delete(id); }
    for (const d of S.drops.values()) {
      const it = items.get(d.id) || make(d), falling = !d.landed;
      it.root.position.set(d.x, falling ? dropY(d, S.t) : d.gy, d.z);
      // en l'air : la caisse se balance sous son parachute ; posée : le parachute s'affaisse sur le côté et s'efface
      const sway = falling ? Math.sin(t * 1.3 + it.ph) * 0.12 : 0;
      it.crate.rotation.set(sway * 0.5, t * 0.15 + it.ph, sway * 0.4);
      it.fold = Math.min(1, it.fold + (falling ? 0 : dt / 1.6));
      it.chute.visible = it.fold < 1;
      it.chute.rotation.set(sway, 0, it.fold * 1.3); it.chute.position.set(it.fold * 2.2, -it.fold * 2.4, 0);
      if (it.fold > 0) { it.chute.children[0].material = it.fadeMat || (it.fadeMat = mat.canopy.clone()); it.fadeMat.opacity = 1 - it.fold; }
      // ouverte : le couvercle se soulève et bascule, le faisceau s'éteint
      it.beam.visible = d.landed && !d.open;
      if (it.beam.visible) it.beam.scale.set(1 + Math.sin(t * 3 + it.ph) * 0.15, 1, 1 + Math.sin(t * 3 + it.ph) * 0.15);
      if (d.open) { it.lid.position.set(0, 1.05, -0.55); it.lid.rotation.x = -1.1; }
    }
    mat.band.emissiveIntensity = 0.45 + 0.35 * Math.sin(t * 4);
  }
  return {
    update,
    dispose() {
      for (const it of items.values()) if (it.fadeMat) it.fadeMat.dispose();
      for (const g of Object.values(geo)) g.dispose();
      for (const m of Object.values(mat)) m.dispose();
      scene.remove(group);
    },
  };
}
