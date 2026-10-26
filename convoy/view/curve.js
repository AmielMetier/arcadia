// Convoy Storm — l'affichage enroule le monde sur la courbe de la voie.
// La simulation ne connaît qu'une voie droite (distance d, écart latéral x). Ici, chaque point est replacé sur la vraie
// courbe (engine/line.js), dans un repère local centré sur le convoi et tourné pour que le convoi file toujours vers -Z :
// la caméra, les commandes et le HUD gardent leurs repères, et c'est le paysage qui tourne autour du train.
import { WAGONS } from '../engine/world.js';

const ZC = WAGONS.map(([a, b]) => (a + b) / 2);

export function makeBend(line) {
  const a = { x: 0, z: 0, th: 0 }, b = { x: 0, z: 0, th: 0 };
  let c = 1, s = 0, D0 = 0;
  const wag = ZC.map(() => ({ x: 0, z: 0, yaw: 0 }));
  const B = {
    ZC,
    wag,
    get d0() { return D0; },
    get anchor() { return a; },          // point de la voie au centre du convoi (repère fixe)
    // nouvelle image : le convoi est en d0
    set(d0) {
      D0 = d0; line.atInto(d0, a); c = Math.cos(a.th); s = Math.sin(a.th);
      for (let i = 0; i < ZC.length; i++) B.train(0, ZC[i], wag[i]);
    },
    // point (d, x) de la voie → repère local { x, z, yaw }
    at(d, x, o) {
      line.atInto(d, b);
      const wx = b.x + x * Math.cos(b.th) - a.x, wz = b.z + x * Math.sin(b.th) - a.z;
      o.x = wx * c + wz * s; o.z = -wx * s + wz * c; o.yaw = -(b.th - a.th);
      return o;
    },
    // point fixe du monde (wx, wz, cap th) → repère local
    world(wx, wz, th, o) {
      const dx = wx - a.x, dz = wz - a.z;
      o.x = dx * c + dz * s; o.z = -dx * s + dz * c; o.yaw = -(th - a.th);
      return o;
    },
    ground(x, zw, o) { return B.at(-zw, x, o); },   // repère du sol (x, zw)
    train(x, z, o) { return B.at(D0 - z, x, o); },  // repère du train (x, z), au sol ou en l'air
    // sur le pont d'un wagon : il est rigide, on suit le wagon plutôt que la courbe
    deck(x, z, o) {
      const i = z < -5.8 ? 0 : z > 5.8 ? 2 : 1, W = wag[i], dz = z - ZC[i], cy = Math.cos(W.yaw), sy = Math.sin(W.yaw);
      o.x = W.x + x * cy + dz * sy; o.z = W.z - x * sy + dz * cy; o.yaw = W.yaw;
      return o;
    },
  };
  return B;
}
