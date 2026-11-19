// The Backrooms (Level 26) - L'eau du Bassin de rétention : une nappe noire et immobile sur toute la halle, à la hauteur
// que donne le moteur (map.water × WATER_MAX, elle baisse à chaque pompe). Pas de lumière à elle : elle ne renvoie que
// la lampe torche et les suspensions (reflets du Phong), avec une houle très lente dessinée dans une carte de relief.
// Opaque : on ne voit rien sous la surface (ni ses propres jambes, ni le corps de l'entité, seulement ce qui dépasse).
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { CELL_SIZE } from '../engine/map.js';
import { WATER_MAX } from '../engine/reservoir.js';

// une houle douce : quelques ondes superposées dans une petite toile, répétée sur la nappe
function swellTexture() {
  const N = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = N;
  const g = cv.getContext('2d');
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * Math.PI * 2;
      const v = (y / N) * Math.PI * 2;
      const h = Math.sin(u * 3 + v) * 0.35 + Math.sin(v * 4 - u * 2) * 0.3 + Math.sin(u * 7 + v * 5) * 0.15 + Math.sin(u * 2 - v * 6) * 0.2;
      const c = Math.round(128 + h * 70);
      const i = (y * N + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = c;
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function createBasinWater(map, scene) {
  const B = map.basin;
  const C = CELL_SIZE;
  const w = (B.x1 - B.x0 + 1) * C;
  const h = (B.z1 - B.z0 + 1) * C;
  const bump = swellTexture();
  bump.repeat.set(w / 6, h / 6);
  const mat = new THREE.MeshPhongMaterial({
    color: '#0b1a1c',
    emissive: '#020607',
    specular: '#9fb8b4',
    shininess: 90,
    bumpMap: bump,
    bumpScale: 0.6,
  });
  const water = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(B.x0 * C + w / 2, WATER_MAX, B.z0 * C + h / 2);
  scene.add(water);
  return {
    // la hauteur de la nappe suit le moteur ; à sec, elle disparaît
    update(time) {
      const y = map.water * WATER_MAX;
      water.visible = y > 0.02;
      water.position.y = y + 0.005;
      bump.offset.set(Math.sin(time * 0.05) * 0.3, time * 0.012);
    },
  };
}
