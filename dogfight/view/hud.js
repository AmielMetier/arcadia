// Viseur tête haute (HUD militaire) pour Dogfight 3D :
// Vitesse, altitude, horizon artificiel, jauge de surchauffe Vulcan, réticule d'anticipation (Lead) et radar.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { computeLeadPosition, BULLET_SPEED } from '../engine/weapons.js';

export class CockpitHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.killFeed = []; // [{ text, timer }]
    this.hitMarkerTimer = 0;
  }

  triggerHitMarker() {
    this.hitMarkerTimer = 0.18;
  }

  addKillMessage(killerName, victimName) {
    this.killFeed.unshift({
      text: `${killerName.toUpperCase()} 💥 ${victimName.toUpperCase()}`,
      timer: 4.0,
    });
    if (this.killFeed.length > 5) this.killFeed.pop();
  }

  render(myPlane, allPlanes, camera, dt) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);
    if (!myPlane) return;

    // Mise à jour des minuteurs
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer -= dt;
    for (let i = this.killFeed.length - 1; i >= 0; i--) {
      this.killFeed[i].timer -= dt;
      if (this.killFeed[i].timer <= 0) this.killFeed.splice(i, 1);
    }

    const cx = w / 2;
    const cy = h / 2;

    // 1. HORIZON ARTIFICIEL & RÉTICULE CENTRAL (Boresight)
    ctx.save();
    ctx.strokeStyle = '#00ff66';
    ctx.fillStyle = '#00ff66';
    ctx.lineWidth = 1.8;

    // Réticule central du nez
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - 24, cy); ctx.lineTo(cx - 14, cy);
    ctx.moveTo(cx + 14, cy); ctx.lineTo(cx + 24, cy);
    ctx.moveTo(cx, cy - 24); ctx.lineTo(cx, cy - 14);
    ctx.moveTo(cx, cy + 14); ctx.lineTo(cx, cy + 24);
    ctx.stroke();

    // 2. INDICATEUR D'ANTICIPATION DE TIR (Lead Indicator)
    this.drawLeadIndicator(ctx, myPlane, allPlanes, camera, w, h);

    // 3. HIT MARKER (Croix rouge/blanche lors d'un tir réussi)
    if (this.hitMarkerTimer > 0) {
      ctx.strokeStyle = '#ff0033';
      ctx.lineWidth = 2.5;
      const hmSize = 10;
      ctx.beginPath();
      ctx.moveTo(cx - hmSize, cy - hmSize); ctx.lineTo(cx - 3, cy - 3);
      ctx.moveTo(cx + hmSize, cy - hmSize); ctx.lineTo(cx + 3, cy - 3);
      ctx.moveTo(cx - hmSize, cy + hmSize); ctx.lineTo(cx - 3, cy + 3);
      ctx.moveTo(cx + hmSize, cy + hmSize); ctx.lineTo(cx + 3, cy + 3);
      ctx.stroke();
    }

    // 4. ÉCHELLES DE VITESSE (Airspeed) ET D'ALTITUDE
    ctx.font = 'bold 15px monospace';
    const speedKmh = Math.round(myPlane.speed * 3.6);
    const altM = Math.max(0, Math.round(myPlane.y));

    // Vitesse à gauche
    ctx.textAlign = 'right';
    ctx.fillText(`${speedKmh} KM/H`, cx - 110, cy + 5);
    ctx.strokeRect(cx - 195, cy - 14, 80, 26);

    // Altitude à droite
    ctx.textAlign = 'left';
    ctx.fillText(`${altM} M`, cx + 120, cy + 5);
    ctx.strokeRect(cx + 115, cy - 14, 75, 26);

    // 5. JAUGE DE SURCHAUFFE DU CANON VULCAN
    const heat = myPlane.weapons ? myPlane.weapons.heat : 0;
    const isOverheated = myPlane.weapons ? myPlane.weapons.overheated : false;
    const barW = 160;
    const barH = 10;
    const barX = cx - barW / 2;
    const barY = cy + 140;

    ctx.strokeStyle = isOverheated ? '#ff0033' : '#00ff66';
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = isOverheated ? '#ff0033' : heat > 0.75 ? '#ffaa00' : '#00ff66';
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * heat, barH - 4);

    ctx.textAlign = 'center';
    ctx.font = 'bold 12px monospace';
    ctx.fillText(
      isOverheated ? '⚠ SURCHAUFFE VULCAN' : 'CANON M61 VULCAN',
      cx,
      barY + 24
    );

    // 6. BARRE DE VIE DE L'AVION
    const hpW = 200;
    const hpH = 12;
    const hpX = cx - hpW / 2;
    const hpY = h - 45;

    ctx.strokeStyle = '#00ff66';
    ctx.strokeRect(hpX, hpY, hpW, hpH);
    const hpRatio = Math.max(0, myPlane.health / 100);
    ctx.fillStyle = hpRatio < 0.3 ? '#ff0033' : hpRatio < 0.6 ? '#ffaa00' : '#00ff66';
    ctx.fillRect(hpX + 2, hpY + 2, (hpW - 4) * hpRatio, hpH - 4);

    ctx.textAlign = 'center';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`STRUCTURE : ${Math.round(myPlane.health)}%`, cx, hpY - 8);

    // 7. ALERTE DE PROXIMITÉ DU SOL (PULL UP)
    if (myPlane.y < 45 && !myPlane.crashed) {
      const flash = Math.sin(Date.now() * 0.015) > 0;
      if (flash) {
        ctx.fillStyle = '#ff0033';
        ctx.font = 'bold 28px sans-serif';
        ctx.fillText('⚠ PULL UP ! PULL UP !', cx, cy - 90);
      }
    }

    // 8. FIL DES ÉLIMINATIONS (Kill Feed)
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px sans-serif';
    let kfY = 35;
    for (const msg of this.killFeed) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, msg.timer)})`;
      ctx.fillText(msg.text, w - 25, kfY);
      kfY += 22;
    }

    // 9. TABLEAU DES SCORES EN HAUT À GAUCHE
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ÉLIMINATIONS : ${myPlane.kills}`, 25, 35);
    ctx.fillText(`MORTS : ${myPlane.deaths}`, 25, 55);

    ctx.restore();
  }

  // Réticule d'anticipation projeté en 3D sur l'écran
  drawLeadIndicator(ctx, myPlane, allPlanes, camera, w, h) {
    if (!camera) return;

    // Trouver l'ennemi le plus proche dans le cône avant
    let bestTarget = null;
    let minAngle = 0.6; // ~35 degrés
    let bestDist = 1200;

    for (const plane of allPlanes) {
      if (!plane.alive || plane.id === myPlane.id) continue;

      const dx = plane.x - myPlane.x;
      const dy = plane.y - myPlane.y;
      const dz = plane.z - myPlane.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > 1200) continue;

      const dirX = dx / dist;
      const dirY = dy / dist;
      const dirZ = dz / dist;

      // Produit scalaire avec le vecteur avant du tireur
      const dot = myPlane.forwardX * dirX + myPlane.forwardY * dirY + myPlane.forwardZ * dirZ;
      if (dot > 0.7 && dist < bestDist) {
        bestTarget = plane;
        bestDist = dist;
      }
    }

    if (!bestTarget) return;

    // Calcul du point d'anticipation
    const lead = computeLeadPosition(
      { x: myPlane.x, y: myPlane.y, z: myPlane.z },
      BULLET_SPEED,
      { x: bestTarget.x, y: bestTarget.y, z: bestTarget.z },
      { x: bestTarget.vx, y: bestTarget.vy, z: bestTarget.vz }
    );

    // Projection 3D vers 2D
    const pos3D = new THREE.Vector3(lead.x, lead.y, lead.z);
    pos3D.project(camera);

    // Vérifier si la cible est devant la caméra (z < 1)
    if (pos3D.z < 1) {
      const scrX = (pos3D.x * 0.5 + 0.5) * w;
      const scrY = (-pos3D.y * 0.5 + 0.5) * h;

      ctx.save();
      ctx.strokeStyle = '#ff0055';
      ctx.fillStyle = '#ff0055';
      ctx.lineWidth = 2;

      // Cercle d'anticipation
      ctx.beginPath();
      ctx.arc(scrX, scrY, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Point central
      ctx.beginPath();
      ctx.arc(scrX, scrY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Distance sous le cercle
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(lead.dist)}M`, scrX, scrY + 30);
      ctx.fillText(bestTarget.name.toUpperCase(), scrX, scrY - 24);

      ctx.restore();
    }
  }
}
