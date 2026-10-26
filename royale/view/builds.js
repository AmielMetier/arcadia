// Les constructions des joueurs en 3D (murs, sols, escaliers en bois, pierre ou métal) et le fantôme qui montre où
// la pièce va se poser (bleu : possible ; rouge : impossible). Une pièce neuve scintille pendant qu'elle durcit.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL, STOREY } from '../engine/buildings.js';
import { pieceBox } from '../engine/build.js';

function tex(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  draw(c.getContext('2d'));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  return t;
}
const TEX = {
  // planches clouées
  bois: () => tex((g) => {
    for (let y = 0; y < 128; y += 32) { g.fillStyle = `hsl(28,${45 + Math.random() * 10}%,${42 + Math.random() * 8}%)`; g.fillRect(0, y, 128, 30); g.fillStyle = '#4a2e18'; g.fillRect(0, y + 30, 128, 2); }
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 30, 1);
    g.fillStyle = '#2a2a2a'; for (let y = 6; y < 128; y += 32) { g.fillRect(6, y, 3, 3); g.fillRect(119, y, 3, 3); }
  }),
  // briques
  pierre: () => tex((g) => {
    g.fillStyle = '#6a6762'; g.fillRect(0, 0, 128, 128);
    for (let y = 0; y < 128; y += 16) for (let x = (y / 16) % 2 ? -16 : 0; x < 128; x += 32) { const v = 130 + Math.random() * 40; g.fillStyle = `rgb(${v},${v - 6},${v - 12})`; g.fillRect(x + 1, y + 1, 30, 14); }
  }),
  // tôle rivetée
  metal: () => tex((g) => {
    for (let x = 0; x < 128; x++) { const v = 120 + 40 * Math.sin(x / 128 * Math.PI * 16); g.fillStyle = `rgb(${v - 10},${v},${v + 12})`; g.fillRect(x, 0, 1, 128); }
    g.fillStyle = 'rgba(30,30,40,.6)'; g.fillRect(0, 0, 128, 3); g.fillRect(0, 125, 128, 3);
  }),
};

export function createBuilds(scene) {
  const group = new THREE.Group(); scene.add(group);
  const textures = Object.fromEntries(Object.keys(TEX).map((k) => [k, TEX[k]()]));
  const L = Math.hypot(CELL, STOREY), slope = Math.atan2(STOREY, CELL);
  const geos = {
    mur: new THREE.BoxGeometry(CELL, STOREY, 0.25).translate(CELL / 2, STOREY / 2, 0),
    sol: new THREE.BoxGeometry(CELL, 0.25, CELL).translate(CELL / 2, -0.1, CELL / 2),
    escalier: new THREE.BoxGeometry(CELL - 0.1, 0.22, L).rotateX(-slope).translate(0, STOREY / 2 - 0.1, 0),
  };
  // UV à l'échelle : 2 m par motif
  for (const g of Object.values(geos)) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 2, uv.getY(i) * 2); }
  const meshes = new Map();
  const place = (o, p) => {
    if (p.kind === 'mur') { o.position.set(p.x * CELL, p.y0, p.z * CELL); o.rotation.set(0, p.o === 'h' ? 0 : -Math.PI / 2, 0); }
    else if (p.kind === 'sol') { o.position.set(p.x * CELL, p.y0, p.z * CELL); o.rotation.set(0, 0, 0); }
    else { o.position.set((p.x + 0.5) * CELL, p.y0, (p.z + 0.5) * CELL); o.rotation.set(0, p.dz > 0 ? 0 : p.dz < 0 ? Math.PI : p.dx > 0 ? Math.PI / 2 : -Math.PI / 2, 0); }
  };
  function add(p) {
    if (meshes.has(p.id)) return;
    const m = new THREE.MeshStandardMaterial({ map: textures[p.mat], roughness: p.mat === 'metal' ? 0.5 : 0.85, metalness: p.mat === 'metal' ? 0.3 : 0, emissive: 0x3a8cff, emissiveIntensity: 0.8 });
    const o = new THREE.Mesh(geos[p.kind], m);
    o.castShadow = true; o.receiveShadow = true;
    place(o, p); o.userData = { piece: p, t: 0 };
    o.scale.setScalar(0.4);
    group.add(o); meshes.set(p.id, o);
  }
  function remove(id) { const o = meshes.get(id); if (!o) return; group.remove(o); o.material.dispose(); meshes.delete(id); }
  // fantôme
  const ghostMats = {
    ok: new THREE.MeshBasicMaterial({ color: 0x5ab0ff, transparent: true, opacity: 0.35, depthWrite: false }),
    no: new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.35, depthWrite: false }),
  };
  const ghosts = Object.fromEntries(Object.entries(geos).map(([k, g]) => { const o = new THREE.Mesh(g, ghostMats.ok); o.visible = false; o.renderOrder = 6; group.add(o); return [k, o]; }));
  function ghost(slot, ok) {
    for (const [k, o] of Object.entries(ghosts)) o.visible = !!slot && k === slot.kind;
    if (!slot) return;
    const o = ghosts[slot.kind];
    place(o, slot); o.material = ok ? ghostMats.ok : ghostMats.no;
  }
  function update(dt, pieces) {
    for (const [id, o] of meshes) {
      const p = pieces.get(id);
      if (!p) continue;
      o.userData.t += dt;
      o.scale.setScalar(Math.min(1, 0.4 + o.userData.t * 4));
      o.material.emissiveIntensity = 0.8 * (1 - p.t) + 0.12 * Math.sin(o.userData.t * 10) * (1 - p.t);
    }
  }
  return {
    group, add, remove, ghost, update,
    dispose() { for (const o of meshes.values()) o.material.dispose(); for (const g of Object.values(geos)) g.dispose(); for (const t of Object.values(textures)) t.dispose(); for (const m of Object.values(ghostMats)) m.dispose(); scene.remove(group); },
  };
}
export { pieceBox };
