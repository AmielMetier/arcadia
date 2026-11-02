// Effets visuels 3D pour Dogfight 3D : balles traçantes, explosions, fumée et traînées de condensation.
import * as THREE from '../../shared/vendor/three/three.module.min.js';

export class FxManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tracers = [];
    this.trails = new Map(); // Traînées de fumée par avion

    // Matériau pour les balles traçantes Vulcan
    this.tracerGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.8, 6);
    this.tracerGeo.rotateX(Math.PI / 2);
    this.tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffdd00, // Jaune incandescent
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });

    // Conteneur de particules
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);
  }

  // Crée un effet visuel d'explosion aérienne
  createExplosion(x, y, z) {
    // Boule de feu centrale
    const count = 35;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.8 + Math.random() * 1.5, 6, 6);
      const isFire = Math.random() > 0.35;
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? 0xff4800 : 0x222222,
        transparent: true,
        opacity: 0.9,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);

      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.5) * Math.PI;
      const speed = 25 + Math.random() * 75;

      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: Math.cos(elev) * Math.cos(angle) * speed,
        vy: Math.sin(elev) * speed,
        vz: Math.cos(elev) * Math.sin(angle) * speed,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.2,
      });
    }
  }

  // Ajoute de la fumée pour un avion endommagé
  emitDamageSmoke(plane) {
    const geo = new THREE.SphereGeometry(0.9, 5, 5);
    const mat = new THREE.MeshBasicMaterial({
      color: plane.health < 25 ? 0x111111 : 0x666666,
      transparent: true,
      opacity: 0.75,
    });
    const mesh = new THREE.Mesh(geo, mat);
    // Position légèrement en arrière de la tuyère moteur
    mesh.position.set(
      plane.x - plane.forwardX * 7.6,
      plane.y - plane.forwardY * 7.6,
      plane.z - plane.forwardZ * 7.6
    );

    this.particleGroup.add(mesh);
    this.particles.push({
      mesh,
      vx: (Math.random() - 0.5) * 5,
      vy: 2 + Math.random() * 4,
      vz: (Math.random() - 0.5) * 5,
      life: 0.7,
      maxLife: 0.7,
      expand: true,
    });
  }

  // Émet des traînées de condensation (vortices de bouts d'ailes)
  emitContrails(plane) {
    const rx = plane.rightX || 1;
    const ry = plane.rightY || 0;
    const rz = plane.rightZ || 0;
    const fx = plane.forwardX || 0;
    const fy = plane.forwardY || 0;
    const fz = plane.forwardZ || 1;
    const ux = plane.upX || 0;
    const uy = plane.upY || 1;
    const uz = plane.upZ || 0;

    const tips = [
      {
        x: plane.x - rx * 4.67 - ux * 0.15 - fx * 1.8,
        y: plane.y - ry * 4.67 - uy * 0.15 - fy * 1.8,
        z: plane.z - rz * 4.67 - uz * 0.15 - fz * 1.8,
      },
      {
        x: plane.x + rx * 4.67 - ux * 0.15 - fx * 1.8,
        y: plane.y + ry * 4.67 - uy * 0.15 - fy * 1.8,
        z: plane.z + rz * 4.67 - uz * 0.15 - fz * 1.8,
      },
    ];

    for (const pos of tips) {
      const geo = new THREE.SphereGeometry(0.35, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.55,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(pos.x, pos.y, pos.z);
      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0.65,
        maxLife: 0.65,
        expand: true,
      });
    }
  }

  // Synchronise les balles traçantes à partir de l'état des armes
  syncTracers(planes) {
    // Récupérer toutes les balles actives
    const activeBullets = [];
    for (const p of planes) {
      if (p.weapons && p.weapons.bullets) {
        for (const b of p.weapons.bullets) {
          activeBullets.push(b);
        }
      }
    }

    // Ajuster le nombre de meshes traçants
    while (this.tracers.length < activeBullets.length) {
      const mesh = new THREE.Mesh(this.tracerGeo, this.tracerMat);
      this.scene.add(mesh);
      this.tracers.push(mesh);
    }

    while (this.tracers.length > activeBullets.length) {
      const mesh = this.tracers.pop();
      this.scene.remove(mesh);
    }

    // Positionner et orienter les balles selon leur vecteur de vitesse
    for (let i = 0; i < activeBullets.length; i++) {
      const b = activeBullets[i];
      const m = this.tracers[i];
      m.position.set(b.x, b.y, b.z);
      m.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        new THREE.Vector3(b.vx, b.vy, b.vz).normalize()
      );
    }
  }

  update(dt, planes = []) {
    this.syncTracers(planes);

    // Émettre les traînées de condensation en virage serré ou postcombustion
    this.contrailTimer = (this.contrailTimer || 0) + dt;
    if (this.contrailTimer > 0.04) {
      this.contrailTimer = 0;
      for (const p of planes) {
        if (!p.alive) continue;
        const isTurning = Math.abs(p.roll || 0) > 0.45 || (p.input && (p.input.pitchUp || p.input.pitchDown));
        if (p.boosting || (p.flight && p.flight.boosting) || isTurning) {
          this.emitContrails(p);
        }
      }
    }

    // Émettre de la fumée pour les avions endommagés
    for (const p of planes) {
      if (p.alive && p.health < 45) {
        if (Math.random() < 0.4) {
          this.emitDamageSmoke(p);
        }
      }
    }

    // Mise à jour des particules d'explosion et de fumée
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.particleGroup.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;

      if (p.expand) {
        const s = 1.0 + (1.0 - p.life / p.maxLife) * 2.5;
        p.mesh.scale.set(s, s, s);
      }

      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife);
    }
  }

  dispose() {
    for (const t of this.tracers) {
      this.scene.remove(t);
    }
    this.tracers = [];
    for (const p of this.particles) {
      this.particleGroup.remove(p.mesh);
      p.mesh.geometry.dispose();
      p.mesh.material.dispose();
    }
    this.particles = [];
    this.scene.remove(this.particleGroup);
  }
}
