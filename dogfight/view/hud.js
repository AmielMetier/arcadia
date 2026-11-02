// Viseur tête haute (HUD militaire) pour Dogfight 3D :
// Vitesse, altitude, horizon artificiel, jauge de surchauffe Vulcan, réticule d'anticipation (Lead) et radar.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { computeLeadPosition, BULLET_SPEED } from '../engine/weapons.js';

// Le vecteur « right » du modèle de vol pointe vers la gauche de l'écran (voir controls.js) : le radar le retourne
const RADAR_SIDE = -1;

export class CockpitHUD {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.killFeed = []; // [{ text, timer }]
    this.hitMarkerTimer = 0;
    this.damageTimer = 0;
    this.lastHealth = null;
    this.showBoard = false;
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

  render(myPlane, allPlanes, camera, dt, state = null) {
    const ctx = this.ctx;
    // dimensions en pixels CSS : le contexte est déjà mis à l'échelle de l'écran (resizeHud)
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;

    ctx.clearRect(0, 0, w, h);
    if (!myPlane) return;

    // flash rouge quand on encaisse des balles
    if (this.lastHealth !== null && myPlane.health < this.lastHealth && myPlane.alive) this.damageTimer = 0.35;
    this.lastHealth = myPlane.health;
    if (this.damageTimer > 0) {
      this.damageTimer -= dt;
      const a = Math.max(0, this.damageTimer / 0.35) * 0.45;
      const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.25, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(255,0,40,0)');
      g.addColorStop(1, `rgba(255,0,40,${a})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }

    if (state) this.drawMatchInfo(ctx, state, myPlane, w, h);
    if (!myPlane.alive) {
      this.drawFeedAndScore(ctx, myPlane, w, dt);
      if (state && this.showBoard) this.drawBoard(ctx, state, myPlane, w, h);
      return;
    }
    this.drawRadar(ctx, myPlane, allPlanes, w, h);
    this.drawOffscreen(ctx, myPlane, allPlanes, camera, w, h);

    // Mise à jour des minuteurs
    if (this.hitMarkerTimer > 0) this.hitMarkerTimer -= dt;

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

    ctx.restore();
    this.drawFeedAndScore(ctx, myPlane, w, dt);
    if (state && this.showBoard) this.drawBoard(ctx, state, myPlane, w, h);
  }

  drawFeedAndScore(ctx, myPlane, w, dt) {
    if (dt) {
      for (let i = this.killFeed.length - 1; i >= 0; i--) {
        this.killFeed[i].timer -= dt;
        if (this.killFeed[i].timer <= 0) this.killFeed.splice(i, 1);
      }
    }
    ctx.save();
    // FIL DES ÉLIMINATIONS (Kill Feed), sous les boutons
    ctx.textAlign = 'right';
    ctx.font = 'bold 13px sans-serif';
    let kfY = 80;
    for (const msg of this.killFeed) {
      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(1, msg.timer)})`;
      ctx.fillText(msg.text, w - 25, kfY);
      kfY += 22;
    }

    // TABLEAU DES SCORES EN HAUT À GAUCHE
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`ÉLIMINATIONS : ${myPlane.kills}`, 25, 35);
    ctx.fillText(`MORTS : ${myPlane.deaths}`, 25, 55);
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('TAB : classement', 25, 75);
    ctx.restore();
  }

  // Chrono, compte à rebours, réapparition
  drawMatchInfo(ctx, state, myPlane, w, h) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    const t = Math.max(0, Math.ceil(state.matchTimer));
    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = t <= 30 ? '#ff4060' : '#ffffff';
    ctx.fillText(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`, w / 2, 32);
    ctx.font = 'bold 12px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`PREMIER À ${state.settings.targetKills} VICTOIRES`, w / 2, 50);

    if (state.phase === 'countdown') {
      const n = Math.ceil(state.phaseTimer);
      ctx.font = 'bold 96px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(n > 0 ? String(n) : 'GO', w / 2, h / 2 - 60);
      ctx.font = 'bold 18px sans-serif';
      ctx.fillText('PRÉPAREZ-VOUS AU COMBAT', w / 2, h / 2 - 20);
    }
    if (!myPlane.alive && state.phase === 'playing') {
      ctx.font = 'bold 34px sans-serif';
      ctx.fillStyle = '#ff4060';
      ctx.fillText('ABATTU !', w / 2, h / 2 - 20);
      ctx.font = 'bold 18px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Réapparition dans ${Math.max(0, myPlane.respawnTimer).toFixed(1)} s`, w / 2, h / 2 + 14);
    }
    ctx.restore();
  }

  // Radar circulaire : le nez de l'avion pointe vers le haut
  drawRadar(ctx, me, planes, w, h) {
    const R = 62;
    const cx = w - R - 22;
    const cy = h - R - 22;
    const range = 1400;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 30, 15, 0.45)';
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, R / 2, 0, Math.PI * 2);
    ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy);
    ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R);
    ctx.strokeStyle = 'rgba(0, 255, 102, 0.25)';
    ctx.stroke();
    // cap de l'avion sur le plan horizontal
    const fl = Math.hypot(me.forwardX, me.forwardZ) || 1;
    const fx = me.forwardX / fl;
    const fz = me.forwardZ / fl;
    ctx.textAlign = 'center';
    ctx.font = 'bold 9px sans-serif';
    for (const p of planes) {
      if (!p.alive || p.id === me.id) continue;
      const dx = p.x - me.x;
      const dz = p.z - me.z;
      // repère de l'avion : devant = haut de l'écran
      const ahead = dx * fx + dz * fz;
      const side = dx * fz - dz * fx;
      let rx = (side / range) * R * RADAR_SIDE;
      let ry = (-ahead / range) * R;
      const d = Math.hypot(rx, ry);
      if (d > R - 4) { rx *= (R - 4) / d; ry *= (R - 4) / d; }
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(cx + rx, cy + ry, 4, 0, Math.PI * 2);
      ctx.fill();
      const dy = p.y - me.y;
      if (Math.abs(dy) > 60) {
        ctx.fillStyle = '#ffffff';
        ctx.fillText(dy > 0 ? '▲' : '▼', cx + rx, cy + ry - 6);
      }
    }
    ctx.fillStyle = '#00ff66';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 6); ctx.lineTo(cx - 4, cy + 4); ctx.lineTo(cx + 4, cy + 4);
    ctx.fill();
    ctx.restore();
  }

  // Flèches au bord de l'écran vers les ennemis hors champ, losange au-dessus des ennemis visibles
  drawOffscreen(ctx, me, planes, camera, w, h) {
    if (!camera) return;
    const v = new THREE.Vector3();
    for (const p of planes) {
      if (!p.alive || p.id === me.id) continue;
      const dist = Math.hypot(p.x - me.x, p.y - me.y, p.z - me.z);
      if (dist > 2000) continue;
      v.set(p.x, p.y, p.z).project(camera);
      const behind = v.z > 1;
      let sx = v.x;
      let sy = v.y;
      if (behind) { sx = -sx; sy = -sy; }
      ctx.save();
      if (!behind && Math.abs(sx) < 0.95 && Math.abs(sy) < 0.95) {
        const px = (sx * 0.5 + 0.5) * w;
        const py = (-sy * 0.5 + 0.5) * h;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px, py - 30); ctx.lineTo(px + 6, py - 24); ctx.lineTo(px, py - 18); ctx.lineTo(px - 6, py - 24); ctx.closePath();
        ctx.stroke();
        ctx.restore();
        continue;
      }
      const k = 0.9 / Math.max(Math.abs(sx), Math.abs(sy), 0.001);
      const ex = (sx * k * 0.5 + 0.5) * w;
      const ey = (-sy * k * 0.5 + 0.5) * h;
      const ang = Math.atan2(-sy, sx);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${Math.round(dist)} M`, ex - Math.cos(ang) * 24, ey - Math.sin(ang) * 24 + 4);
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(14, 0); ctx.lineTo(-6, -9); ctx.lineTo(-6, 9);
      ctx.fill();
      ctx.restore();
    }
  }

  // Classement (Tab)
  drawBoard(ctx, state, me, w, h) {
    const rows = [...state.planes].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const bw = 320;
    const bh = 50 + rows.length * 26;
    const x = (w - bw) / 2;
    const y = (h - bh) / 2;
    ctx.save();
    ctx.fillStyle = 'rgba(5, 12, 28, 0.85)';
    ctx.fillRect(x, y, bw, bh);
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
    ctx.strokeRect(x, y, bw, bh);
    ctx.font = 'bold 14px sans-serif';
    ctx.fillStyle = '#93c5fd';
    ctx.textAlign = 'left';
    ctx.fillText('PILOTE', x + 16, y + 28);
    ctx.textAlign = 'right';
    ctx.fillText('ÉLIM.   MORTS', x + bw - 16, y + 28);
    rows.forEach((p, i) => {
      const ry = y + 54 + i * 26;
      ctx.fillStyle = p.color;
      ctx.fillRect(x + 6, ry - 11, 4, 13);
      ctx.fillStyle = p.id === me.id ? '#fde047' : '#ffffff';
      ctx.textAlign = 'left';
      ctx.fillText(`${i + 1}. ${p.name}${p.bot ? ' (IA)' : ''}`, x + 16, ry);
      ctx.textAlign = 'right';
      ctx.fillText(`${p.kills}        ${p.deaths}`, x + bw - 22, ry);
    });
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
