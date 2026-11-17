// The Backrooms - Les poissons des Poolrooms (Level 37) : ils sautent hors des bassins, et celui qui s'accroche à un
// joueur trop bruyant (fishStep dans engine/sim.js) se tortille devant son visage, ou sur la poitrine d'un coéquipier.
// Le modèle n'a ni os ni animation (models/poolrooms/fish.glb, « Fish » d'ethem, CC-BY 4.0) : tout est fait ici.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { modelUrl } from './models.js';

const LEN = 0.42; // m : la longueur d'un poisson
const JUMP_T = 0.9; // s : un saut hors de l'eau
const LEAP_T = 0.4; // s : le bond du bassin jusqu'au joueur
const WATER_Y = -0.03;

// url : un autre modèle de la même forme (le poisson du mode VIP, déchiffré du coffre)
export function createFishView({ map, scene, loader, camera, onSplash, url = null }) {
  const group = new THREE.Group();
  scene.add(group);
  let proto = null;
  const idle = []; // un par poisson de la carte
  const held = new Map(); // id du joueur → le poisson qui le tient
  const leaps = new Map(); // id du joueur → { t, from } : le bond en cours
  const fwd = new THREE.Vector3();

  const spawn = () => {
    const o = proto.clone();
    o.visible = false;
    group.add(o);
    return o;
  };
  loader.load(url || modelUrl('fish'), (g) => {
    // mis aux normes : centré, long de LEN, le grand axe le long de z
    const box = new THREE.Box3().setFromObject(g.scene);
    const size = box.getSize(new THREE.Vector3());
    const c = box.getCenter(new THREE.Vector3());
    g.scene.position.sub(c);
    const inner = new THREE.Group();
    inner.add(g.scene);
    if (size.x >= size.y && size.x >= size.z) inner.rotation.y = Math.PI / 2;
    else if (size.y >= size.z) inner.rotation.x = Math.PI / 2;
    inner.scale.setScalar(LEN / Math.max(size.x, size.y, size.z));
    g.scene.traverse((o) => {
      if (!o.isMesh) return;
      // (sans éclairage : la lumière des Poolrooms est cuite dans les murs, un poisson éclairé par les lampes du jeu
      // sortait tout noir ; une teinte un peu éteinte le fond dans l'air laiteux)
      o.material = new THREE.MeshBasicMaterial({ map: o.material.map || null, color: o.material.map ? '#aeb8b6' : '#1a1c1c' });
      o.frustumCulled = false;
    });
    proto = new THREE.Group();
    proto.add(inner);
    for (let i = 0; i < map.fish.length; i++) idle.push({ o: spawn(), up: false });
  });

  return {
    // un poisson vient de sauter sur un joueur (événement fishOn) : son bond part du bassin
    leap(id, x, z) {
      leaps.set(id, { t: 0, x, z });
    },
    update(sim, V, time, dt) {
      if (!proto) return;
      // 1. les sauts : chaque poisson a sa cadence (7 à 14 s) ; un arc de 1,4 m, le nez en l'air puis vers l'eau
      map.fish.forEach((f, i) => {
        const it = idle[i];
        const every = 7 + ((i * 37) % 8);
        const u = (time + i * 3.7) % every;
        const up = u < JUMP_T && !(f.cd > 0);
        if (up !== it.up) {
          it.up = up;
          it.o.visible = up;
          if (onSplash) onSplash({ x: f.x, z: f.z });
        }
        if (!up) return;
        const t = u / JUMP_T;
        const dx = Math.sin(f.dir);
        const dz = Math.cos(f.dir);
        it.o.position.set(f.x + dx * (t - 0.5) * 1.4, WATER_Y - 0.12 + Math.sin(Math.PI * t) * 0.8, f.z + dz * (t - 0.5) * 1.4);
        it.o.rotation.set(-Math.cos(Math.PI * t) * 1.1, f.dir, Math.sin(time * 30 + i) * 0.25, 'YXZ');
      });
      // 2. celui qui tient un joueur : devant le visage de celui qu'on regarde, sur la poitrine des autres
      for (const Q of sim.players) {
        const on = !!Q.fishQ && Q.status === 'alive';
        let o = held.get(Q.id);
        if (!on) {
          if (o) o.visible = false;
          leaps.delete(Q.id);
          continue;
        }
        if (!o) held.set(Q.id, (o = spawn()));
        o.visible = true;
        const w = Math.sin(time * 26) * 0.5; // il se tortille
        let tx, ty, tz;
        if (Q === V) {
          camera.getWorldDirection(fwd);
          tx = camera.position.x + fwd.x * 0.42;
          ty = camera.position.y + fwd.y * 0.42 - 0.04 + Math.sin(time * 19) * 0.015;
          tz = camera.position.z + fwd.z * 0.42;
          // de face : le nez (+z du modèle) vers l'objectif, un peu de trois quarts pour qu'on voie ses yeux (sur les côtés de
          // la tête), au-dessus du mini-jeu ; il se tortille moins de côté pour rester lisible
          o.rotation.set(0.1 + Math.sin(time * 13) * 0.1, Q.yaw + 0.55 + w * 0.3, Math.sin(time * 31) * 0.25, 'YXZ');
        } else {
          tx = Q.x - Math.sin(Q.yaw) * 0.26;
          ty = 1.22;
          tz = Q.z - Math.cos(Q.yaw) * 0.26;
          o.rotation.set(Math.PI / 2, Q.yaw + w, 0, 'YXZ');
        }
        const L = leaps.get(Q.id);
        if (L && (L.t += dt) < LEAP_T) {
          // son bond : du bassin jusqu'au joueur, en cloche
          const t = L.t / LEAP_T;
          o.position.set(L.x + (tx - L.x) * t, WATER_Y + (ty - WATER_Y) * t + Math.sin(Math.PI * t) * 0.6, L.z + (tz - L.z) * t);
          o.rotation.set(-0.6, Math.atan2(tx - L.x, tz - L.z), w, 'YXZ');
        } else {
          leaps.delete(Q.id);
          o.position.set(tx, ty, tz);
        }
      }
    },
  };
}
