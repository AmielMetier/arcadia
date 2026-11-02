// Plouf ! — le baigneur : le « Beach Character » de Quaternius (CC0), animé par ses clips (repos, marche, course, coups
// de poing et de pied, encaisse, chute) et rendu mou par-dessus : le buste penche avec l'élan, la tête suit en retard,
// les bras battent l'air au bord, le corps pend quand on est suspendu ou soulevé, s'étale quand on est KO.
// Maillot à la couleur du joueur, peau et cheveux variés. Repère : pieds à l'origine, regard vers +z.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { cloneSkinned } from './models.js';
import { ST, CHARGE_MAX } from '../engine/sim.js';

const SKINS = [0xf2c6a0, 0xe0a87c, 0xc68b59, 0x8d5a3b, 0xf7d7b5, 0xa8724a];
const HAIRS = [0x2b1a10, 0x6b3e1f, 0xd9b26a, 0x111111, 0xb5651d, 0xe8e2d0];
const HASH = (n) => { let x = (n | 0) * 2654435761; x ^= x >>> 15; return (x >>> 0) % 997; };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const CLIP = (name) => 'CharacterArmature|' + name;

let facingFix = null; // rotation du modèle pour qu'il regarde +z (mesurée une fois sur le squelette)

export class Baigneur {
  constructor(tmpl, { id, color }) {
    this.root = new THREE.Group();            // posé par le jeu (position, lacet)
    this.body = new THREE.Group();            // ce qui penche, tourne et s'écrase
    this.root.add(this.body);
    const m = cloneSkinned(tmpl.scene);
    this.model = m;
    this.body.add(m);
    // matériaux propres à ce joueur
    const h = HASH(id + 31);
    m.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((mat) => {
        const c = mat.clone();
        if (/Red_Dark/i.test(mat.name)) c.color.set(color);
        else if (/^Skin/i.test(mat.name)) c.color.setHex(SKINS[h % SKINS.length]);
        else if (/^Hair/i.test(mat.name)) c.color.setHex(HAIRS[(h >> 3) % HAIRS.length]);
        else if (/^White/i.test(mat.name)) c.color.setHex(0xf4f4f4);
        c.roughness = 0.75; c.metalness = 0;
        return c;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      o.castShadow = true;
    });
    // os utiles
    const bone = (n) => m.getObjectByName(n) || m.getObjectByName(n.replace('.', ''));
    this.b = {
      hips: bone('Hips'), abd: bone('Abdomen'), torso: bone('Torso'), chest: bone('Chest'), neck: bone('Neck'), head: bone('Head'),
      uaL: bone('UpperArm.L'), uaR: bone('UpperArm.R'), laL: bone('LowerArm.L'), laR: bone('LowerArm.R'),
      ulL: bone('UpperLeg.L'), ulR: bone('UpperLeg.R'), llL: bone('LowerLeg.L'), llR: bone('LowerLeg.R'),
    };
    if (facingFix == null) facingFix = measureFacing(m, this.b);
    m.rotation.y = facingFix;
    // animations
    this.mixer = new THREE.AnimationMixer(m);
    this.act = {};
    for (const name of ['Idle', 'Walk', 'Run', 'Punch_Left', 'Punch_Right', 'Kick_Right', 'HitRecieve', 'HitRecieve_2', 'Death', 'Roll', 'Wave', 'Interact', 'Run_Back']) {
      const clip = THREE.AnimationClip.findByName(tmpl.clips, CLIP(name)) || THREE.AnimationClip.findByName(tmpl.clips, name);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.enabled = true; a.setEffectiveWeight(0); a.play();
      this.act[name] = a;
    }
    for (const n of ['Punch_Left', 'Punch_Right', 'Kick_Right', 'HitRecieve', 'Death', 'Interact']) if (this.act[n]) { this.act[n].setLoop(THREE.LoopOnce, 1); this.act[n].clampWhenFinished = true; }
    this.w = { Idle: 1 };                      // poids visés de chaque clip (fondu)
    this.one = null;                           // clip joué une fois en ce moment
    this.st = -1; this.punch = 0;
    this.lean = new THREE.Vector2(); this.leanV = new THREE.Vector2(); this.headLag = new THREE.Vector2();
    this.pvx = 0; this.pvz = 0; this.spin = 0; this.squash = 1; this.dangle = 0; this.flail = 0; this.hangK = 0;
    this.seed = (h % 100) / 100;
  }

  // joue un clip une fois, par-dessus la locomotion
  once(name, speed = 1) {
    const a = this.act[name]; if (!a) return;
    a.reset(); a.timeScale = speed; a.setEffectiveWeight(1); a.play();
    this.one = { name, a };
  }
  fade(target, dt, k = 10) {
    for (const [n, a] of Object.entries(this.act)) {
      if (this.one && this.one.name === n) continue;
      const w = damp(a.getEffectiveWeight(), target[n] || 0, k, dt);
      a.setEffectiveWeight(w < 0.001 ? 0 : w);
    }
  }

  update(p, dt, time) {
    const B = this.b, st = p.st, speed = Math.hypot(p.vx, p.vz);
    const entered = st !== this.st; this.st = st;
    // ---------------------------------------------------------------- clips
    const tgt = {};
    if (st === ST.RUN) {
      if (p.ck === 2 && !p.lift) { tgt.Run_Back = clamp(speed / 2.4, 0, 1); tgt.Idle = 1 - tgt.Run_Back; } // on traîne quelqu'un : à reculons
      else { const k = clamp(speed / 4, 0, 1); tgt.Walk = k < 0.55 ? k / 0.55 : (1 - k) / 0.45; tgt.Run = k > 0.55 ? (k - 0.55) / 0.45 : 0; tgt.Idle = 1 - clamp(speed / 1.2, 0, 1); }
      if (p.lun > 0 && !this.one) { if (p.lk < 0) { this.once(this.punch++ % 2 ? 'Punch_Left' : 'Punch_Right', 2.2); } else this.once('Kick_Right', 1.8); }
    } else if (st === ST.DOWN) { if (entered) this.once('Death', 1.9); else if (this.one && this.one.name === 'Death' && this.one.a.time >= this.one.a.getClip().duration - 0.05) { /* à plat */ } }
    else if (st === ST.HELD) { if (p.lift) tgt.HitRecieve_2 = 1; else { tgt.Run_Back = 0.6; tgt.Idle = 0.4; } }
    else if (st === ST.HANG) tgt.Idle = 1;
    else if (st === ST.AIR || st === ST.FALL) tgt.Roll = 1;
    else tgt.Idle = 1;
    if (entered && st !== ST.DOWN && this.one && this.one.name === 'Death') { this.one.a.setEffectiveWeight(0); this.one = null; }
    if (this.one && this.one.name !== 'Death') {
      const a = this.one.a;
      if (!a.isRunning() || a.time >= a.getClip().duration - 0.02) { a.setEffectiveWeight(0); this.one = null; }
    }
    if (this.one && this.one.name === 'Death' && st === ST.DOWN) { this.act.Death.setEffectiveWeight(1); }
    this.fade(tgt, dt, this.one ? 14 : 9);
    if (this.act.Run) this.act.Run.timeScale = 0.9 + speed * 0.12;
    if (this.act.Walk) this.act.Walk.timeScale = 0.8 + speed * 0.25;
    this.mixer.update(dt);

    // ---------------------------------------------------------------- mou : élan, étourdissement, bord, suspension
    const ax = (p.vx - this.pvx) / Math.max(dt, 1e-3), az = (p.vz - this.pvz) / Math.max(dt, 1e-3);
    this.pvx = p.vx; this.pvz = p.vz;
    // dans le repère du personnage : avant = +z local (sens du lacet)
    const c = Math.cos(p.yaw), s = Math.sin(p.yaw);
    const fwdV = p.vx * s + p.vz * c, sideV = p.vx * c - p.vz * s;
    const fwdA = ax * s + az * c, sideA = ax * c - az * s;
    // le buste : penche dans l'élan (ressort amorti), et recule sous un coup
    const want = new THREE.Vector2(clamp(fwdV * 0.07 + fwdA * 0.012, -0.5, 0.5), clamp(-sideV * 0.05 - sideA * 0.01, -0.4, 0.4));
    if (p.chg > 0) want.x -= 0.35 * Math.min(1, p.chg / CHARGE_MAX);
    if (p.lun > 0) want.x += 0.5;
    const K = 60, D = 9;
    this.leanV.x += ((want.x - this.lean.x) * K - this.leanV.x * D) * dt; this.leanV.y += ((want.y - this.lean.y) * K - this.leanV.y * D) * dt;
    this.lean.x += this.leanV.x * dt; this.lean.y += this.leanV.y * dt;
    // la tête suit en retard, et tourne quand on est étourdi
    this.headLag.x = damp(this.headLag.x, -this.lean.x * 0.8, 14, dt); this.headLag.y = damp(this.headLag.y, -this.lean.y * 0.8, 14, dt);
    const dizzy = clamp(p.dz || 0, 0, 1);
    // bras qui moulinent : au bord, ou quand on titube
    this.flail = damp(this.flail, p.tee ? 1 : dizzy > 0.6 && st === ST.RUN ? 0.35 : 0, 8, dt);
    this.hangK = damp(this.hangK, st === ST.HANG ? 1 : 0, 12, dt);
    this.dangle = damp(this.dangle, st === ST.HELD && p.lift ? 1 : 0, 10, dt);
    // atterrir / se relever : écrasement
    if (entered && (st === ST.RUN || st === ST.DOWN) && (this.pst === ST.AIR || this.pst === ST.HANG)) this.squash = 0.72;
    this.squash = damp(this.squash, 1, 9, dt);
    this.pst = st;

    const bend = (bone, x, y, z) => { if (bone) { bone.rotation.x += x; bone.rotation.y += y; bone.rotation.z += z; } };
    if (st === ST.RUN || st === ST.HELD && !p.lift) {
      bend(B.abd, this.lean.x * 0.55, 0, this.lean.y * 0.5);
      bend(B.torso, this.lean.x * 0.45, 0, this.lean.y * 0.4);
      bend(B.head, this.headLag.x * 0.6 + Math.sin(time * 9 + this.seed * 6) * dizzy * 0.25, Math.sin(time * 5.3) * dizzy * 0.5, this.headLag.y * 0.6 + Math.cos(time * 7) * dizzy * 0.2);
      if (this.flail > 0) {
        const f = this.flail, w = Math.sin(time * 19) * 1.3 * f, w2 = Math.cos(time * 17) * 1.3 * f;
        bend(B.uaL, w, 0, 2.4 * f); bend(B.uaR, w2, 0, -2.4 * f); bend(B.laL, -0.6 * f, 0, 0); bend(B.laR, -0.6 * f, 0, 0);
        bend(B.torso, -0.25 * f, 0, Math.sin(time * 11) * 0.2 * f);
      }
      if (p.chg > 0) { // on arme : les bras en arrière, poings serrés
        const k = Math.min(1, p.chg / CHARGE_MAX);
        bend(B.uaL, 1.1 * k, 0, 0.3 * k); bend(B.uaR, 1.1 * k, 0, -0.3 * k); bend(B.laL, -1.6 * k, 0, 0); bend(B.laR, -1.6 * k, 0, 0);
      }
      if (p.ck === 1 || (p.ck === 2 && p.lift)) { bend(B.uaL, -2.6, 0, 0.4); bend(B.uaR, -2.6, 0, -0.4); bend(B.laL, -0.4, 0, 0); bend(B.laR, -0.4, 0, 0); } // porté à bout de bras
      else if (p.ck === 2) { bend(B.uaR, -1.4, 0, -0.3); bend(B.laR, -0.3, 0, 0); } // un bras tendu vers celui qu'on traîne
      if (st === ST.HELD) { bend(B.torso, 0.35, 0, 0); bend(B.uaL, -1.3, 0, 0.2); } // traîné : penché en arrière, un bras tiré
    } else if (st === ST.HANG) {
      // suspendu d'une main, l'autre cherche l'appui ; le corps se balance ; on se hisse à mesure que cl monte
      const sw = Math.sin(time * 2.6 + this.seed * 5) * 0.18, k = clamp(p.cl || 0, 0, 1);
      bend(B.uaL, -3.0, 0, 0.25); bend(B.laL, -0.2, 0, 0);
      bend(B.uaR, -2.6 + k * 0.8 + Math.sin(time * 6) * 0.3 * (1 - k), 0, -0.6 + k * 0.3); bend(B.laR, -0.8, 0, 0);
      bend(B.torso, 0.25 - k * 0.5, 0, sw); bend(B.abd, 0.15, 0, sw * 0.6);
      bend(B.ulL, 0.4 + Math.sin(time * 8) * 0.25 * (1 - k) + k * 1.2, 0, 0); bend(B.ulR, 0.2 + Math.cos(time * 7) * 0.25 * (1 - k), 0, 0);
      bend(B.llL, 0.6, 0, 0); bend(B.llR, 0.5, 0, 0);
      bend(B.head, -0.5 + k * 0.3, 0, 0);
    } else if (st === ST.HELD && p.lift) {
      // soulevé au-dessus de la tête : couché, bras et jambes qui gigotent
      const g = Math.sin(time * 16), g2 = Math.cos(time * 13);
      bend(B.uaL, g * 0.9, 0, 1.4); bend(B.uaR, g2 * 0.9, 0, -1.4); bend(B.ulL, g2 * 0.7, 0, 0); bend(B.ulR, g * 0.7, 0, 0);
      bend(B.torso, 0, 0, g * 0.15);
    } else if (st === ST.AIR || st === ST.FALL) {
      bend(B.uaL, -1.2, 0, 1.0); bend(B.uaR, -1.2, 0, -1.0);
    }

    // ---------------------------------------------------------------- le corps entier : couché, tourné, écrasé
    const body = this.body;
    let rx = 0, rz = 0, y = 0;
    if (st === ST.HELD && p.lift) { rz = Math.PI / 2 * this.dangle; y = 0.9 * this.dangle; } // couché à bout de bras, au-dessus de la tête du porteur
    else if (st === ST.AIR) { this.spin += dt * (p.thr ? 7 : 4); rx = this.spin; }
    else if (st === ST.FALL) { this.spin += dt * 3; rx = this.spin; }
    else this.spin = damp(this.spin, Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2, 10, dt), rx = this.spin;
    if (st === ST.DOWN) {
      // à plat : la chute est dans le clip ; pendant les derniers dixièmes, on se tortille pour se relever
      const left = p.ko || 0;
      if (left < 0.35) { body.rotation.x = damp(body.rotation.x, 0, 10, dt); y = Math.sin(left * 20) * 0.03; }
    }
    body.rotation.x = st === ST.DOWN ? body.rotation.x : damp(body.rotation.x, rx, st === ST.AIR || st === ST.FALL ? 30 : 12, dt);
    body.rotation.z = damp(body.rotation.z, rz, 12, dt);
    body.position.y = damp(body.position.y, y, 12, dt);
    this.model.position.y = -0.92 * this.dangle; // soulevé : on tourne le corps autour de son milieu, pas de ses pieds
    body.scale.set(1 / Math.sqrt(this.squash), this.squash, 1 / Math.sqrt(this.squash));
  }

  dispose() {
    this.mixer.stopAllAction();
    this.model.traverse((o) => { if (o.isMesh) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); });
  }
}

// le modèle regarde-t-il +z ? sinon, de combien le tourner (pied gauche du côté +x quand on regarde +z)
function measureFacing(m, B) {
  if (!B.ulL || !B.ulR) return 0;
  m.updateMatrixWorld(true);
  const l = new THREE.Vector3(), r = new THREE.Vector3();
  B.ulL.getWorldPosition(l); B.ulR.getWorldPosition(r);
  const d = r.sub(l); // gauche → droite
  // regarde +z ⇒ la droite du personnage est en -x
  const a = Math.atan2(d.z, -d.x);
  return -a;
}
