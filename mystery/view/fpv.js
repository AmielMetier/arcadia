// Mystère Mystère : l'arme vue à la première personne. Une manche à la couleur du joueur, une main, et le couteau ou le
// revolver. Balancement à la marche, sortie et rangement, coup de couteau en arc, lancer, recul du tir.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { revolver, mat } from './models.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (x) => x * x * (3 - 2 * x);

export class FirstPerson {
  constructor(camera) {
    this.cam = camera;
    this.root = new THREE.Group(); camera.add(this.root);
    this.arm = new THREE.Group(); this.root.add(this.arm);
    this.sleeveMat = new THREE.MeshLambertMaterial({ color: '#4aa3df' });
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.4, 10), this.sleeveMat); sleeve.rotation.x = Math.PI / 2; sleeve.position.set(0.01, -0.03, 0.2); this.arm.add(sleeve);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 10), mat('#f4f1ea')); cuff.rotation.x = Math.PI / 2; cuff.position.set(0.005, -0.025, 0.0); this.arm.add(cuff);
    this.skinMat = new THREE.MeshLambertMaterial({ color: '#f3c9a8' });
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.075, 0.08), this.skinMat); hand.position.set(0, -0.02, -0.045); this.arm.add(hand);
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, 0.05), this.skinMat); thumb.position.set(-0.035, 0.012, -0.06); this.arm.add(thumb);
    this.grip = new THREE.Group(); this.grip.position.set(0, 0.0, -0.07); this.arm.add(this.grip);
    this.knife = new THREE.Group(); this.grip.add(this.knife);
    this.gun = revolver(); this.gun.scale.setScalar(1.1); this.gun.position.set(0, -0.005, 0.03); this.grip.add(this.gun);
    this.root.position.set(0.2, -0.19, -0.36);
    this.held = null; this.k = 0; this.bob = 0; this.slashT = 0; this.throwT = 0; this.recoilT = 0; this.color = null;
    this.root.visible = false;
    this.root.traverse((o) => { if (o.isMesh) { o.renderOrder = 10; } });
  }
  setModels(models) {
    const k = models.knife(); k.scale.setScalar(1.25); k.rotation.set(0.5, 0, 0); k.position.set(0, 0.03, -0.1);
    this.knife.add(k);
  }
  muzzle() { if (!this.root.visible || this.held !== 'gun') return null; const v = new THREE.Vector3(0, 0.07, -0.3); this.gun.localToWorld(v); return v; }
  slash() { this.slashT = 0.38; }
  throwAnim() { this.throwT = 0.5; }
  recoil() { this.recoilT = 0.3; }
  draw() {}
  update(dt, v) {
    const r = v.real;
    const want = v.camMode === 'fps' && r && !r.dead && r.held && v.mine ? r.held : null;
    if (r && r.color && r.color !== this.color) { this.color = r.color; this.sleeveMat.color.set(r.color); }
    if (want !== this.held && this.k <= 0.02) { this.held = want; }
    const target = want && want === this.held ? 1 : 0;
    this.k = clamp(this.k + (target - this.k) * Math.min(1, dt * 14), 0, 1);
    this.root.visible = this.k > 0.02 && !!this.held;
    if (!this.root.visible) return;
    this.knife.visible = this.held === 'knife'; this.gun.visible = this.held === 'gun';
    // balancement
    if (r.moving) this.bob += dt * (r.run ? 12 : 8.5);
    const amp = r.moving ? (r.run ? 0.022 : 0.013) : 0.003;
    const bx = Math.sin(this.bob) * amp, by = -Math.abs(Math.cos(this.bob)) * amp + Math.sin(performance.now() / 900) * 0.003;
    const e = ease(this.k);
    this.root.position.set(0.2 + bx, -0.19 + by - (1 - e) * 0.3, -0.36);
    this.root.rotation.set(-(1 - e) * 0.9, 0, 0);
    this.arm.rotation.set(0, 0, 0); this.arm.position.set(0, 0, 0);
    if (this.held === 'knife') {
      this.grip.rotation.set(0.15, 0.35, -0.35);
      if (this.slashT > 0) {
        this.slashT = Math.max(0, this.slashT - dt);
        const p = 1 - this.slashT / 0.38, s = Math.sin(p * Math.PI);
        this.arm.rotation.set(-0.4 * s, 0.9 * s - 0.2 * p, 0.6 * s);
        this.arm.position.set(-0.18 * s, 0.06 * s, -0.12 * s);
      }
      if (this.throwT > 0) {
        this.throwT = Math.max(0, this.throwT - dt);
        const p = 1 - this.throwT / 0.5;
        const wind = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
        this.arm.rotation.set(-1.2 * wind + (p > 0.4 ? 0.5 * (p - 0.4) : 0), 0, 0);
        this.arm.position.set(0, 0.12 * wind, 0.1 * wind);
        this.knife.visible = p < 0.45;
      }
    } else {
      this.grip.rotation.set(0.05, 0.12, 0.05);
      if (this.recoilT > 0) {
        this.recoilT = Math.max(0, this.recoilT - dt);
        const p = this.recoilT / 0.3;
        this.arm.rotation.set(0.45 * p * p, 0, 0); this.arm.position.set(0, 0.02 * p, 0.07 * p);
      }
      // rechargement : on voit le barillet tourner
      if (r.cdGun > 0) this.gun.children[1].rotation.y += dt * 8 * Math.min(1, r.cdGun);
    }
  }
}
