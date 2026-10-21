// ============================================================================
// OUTBREAK : SECTEUR ZÉRO - TOP-DOWN ZENITH 360° ACTION GRAPHICS ENGINE
// Vue zénithale authentique (360° overhead) & Rendu ultra-fluide 60 FPS
// ============================================================================

export class PixelArtGraphicsEngine {
  constructor() {
    this.images = new Map();
    this.floatingTexts = [];
    this.cachedFloorPatterns = new Map();
    this.loadAssets();
  }

  loadAssets() {
    if (typeof Image === 'undefined') return;

    // Planches de sprites zénithales 360° (Kenney CC0 Top-Down Shooter)
    const assetList = [
      { id: 'topdown_characters', path: 'assets/topdown_characters.png' },
      { id: 'tilesheet_complete', path: 'assets/tilesheet_complete.png' }
    ];

    assetList.forEach(({ id, path }) => {
      const img = new Image();
      img.src = path;
      img.onload = () => {
        this.images.set(id, img);
        if (id === 'tilesheet_complete') {
          this.buildCachedFloorTextures(img);
        }
      };
      img.onerror = () => {
        console.warn('Asset fallback procedural:', id);
      };
    });
  }

  // Pré-génération de dalles de sol 64x64 pour garantir 60 FPS sans lag
  buildCachedFloorTextures(tilesheet) {
    const sectors = {
      pixel_floor:    { x: 448, y: 64 },   // Dalles métalliques industrielles
      floor_virology: { x: 768, y: 768 },  // Dalles laboratoire virologique
      floor_armory:   { x: 640, y: 64 },   // Acier renforcé garnison
      floor_reactor:  { x: 256, y: 192 },  // Plaques techniques réacteur
      floor_boss:     { x: 0,   y: 384 }   // Enceinte de stase blindée
    };

    for (const [name, pos] of Object.entries(sectors)) {
      try {
        const c = document.createElement('canvas');
        c.width = 64;
        c.height = 64;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tilesheet, pos.x, pos.y, 64, 64, 0, 0, 64, 64);
        this.images.set(name, c);
      } catch (e) {
        console.warn('Erreur cache floor:', e);
      }
    }
  }

  // Textes flottants ("-15", "BOOM!", "CRIT!", "+100")
  addFloatingText(text, x, y, color = '#fde047', size = 15) {
    this.floatingTexts.push({
      text,
      x: Math.floor(x + (Math.random() - 0.5) * 16),
      y: Math.floor(y - 10),
      vy: -45 - Math.random() * 20,
      color,
      size,
      scale: 1.3,
      lifetime: 0.85
    });
  }

  update(dt) {
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const ft = this.floatingTexts[i];
      ft.y += ft.vy * dt;
      ft.vy *= 0.92;
      ft.lifetime -= dt;
      if (ft.scale > 1.0) {
        ft.scale -= dt * 3.5;
        if (ft.scale < 1.0) ft.scale = 1.0;
      }
      if (ft.lifetime <= 0) {
        this.floatingTexts.splice(i, 1);
      }
    }
  }

  // ==========================================================================
  // 1. SURVIVANT (PERSPECTIVE ZÉNITHALE 360° TOP-DOWN)
  // ==========================================================================
  drawSurvivor(ctx, player, time) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const px = Math.floor(player.x);
    const py = Math.floor(player.y);
    ctx.translate(px, py);

    // Ombre sous le personnage (vue de dessus : ellipse au sol)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, 17, 13, 0, 0, Math.PI * 2);
    ctx.fill();

    // Traînée en esquive / roulade
    if (player.isDodging) {
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = player.color || '#00e5ff';
      ctx.beginPath();
      ctx.arc(-player.vx * 0.04, -player.vy * 0.04, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    const sprSheet = this.images.get('topdown_characters');
    if (sprSheet && sprSheet.complete && sprSheet.naturalWidth > 0) {
      const isMoving = Math.hypot(player.vx, player.vy) > 10;
      const walkCycle = time * 13;
      const walkSway = isMoving ? Math.sin(walkCycle) * 0.07 : 0;
      const isShooting = player.muzzleFlashTimer > 0;
      const recoil = isShooting ? -4 : 0;

      // Rotation complète 360° vers la visée du joueur
      ctx.save();
      ctx.rotate(player.aimAngle + walkSway);

      // Pas des pieds sous les épaules (rendu zénithal dynamique)
      if (isMoving) {
        const step = Math.sin(walkCycle) * 6;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(-10, -13 + step, 7, 4);
        ctx.fillRect(-10, 9 - step, 7, 4);
      }

      // Choix du sprite selon l'arme active et l'identité joueur (Hôte vs Invité Coop)
      // Coordonnées exactes issues de topdown_characters.xml
      let sx = 110, sy = 176, sw = 51, sh = 43; // survivor1_machine
      let pivotX = 18, pivotY = 21.5;

      const isCoopPartner = player.id && !player.isHost;
      const curWeapon = player.weapons ? player.weapons[player.activeWeaponIndex] : 'pistol';

      if (!isCoopPartner) {
        // Joueur 1 : Survivant SWAT / Mercenaire (veste sombre & fusil)
        if (curWeapon === 'shotgun' || curWeapon === 'pistol') {
          // survivor1_gun
          sx = 112; sy = 88; sw = 51; sh = 43;
        } else if (curWeapon === 'rocket' || curWeapon === 'sniper') {
          // survivor1_silencer
          sx = 0; sy = 88; sw = 56; sh = 43;
        } else {
          // survivor1_machine (assault rifle / SMG)
          sx = 110; sy = 176; sw = 51; sh = 43;
        }
      } else {
        // Joueur 2 : Soldat tactique Camo / Blue (distinction visuelle nette en coop)
        if (curWeapon === 'shotgun' || curWeapon === 'pistol') {
          // soldier1_gun
          sx = 113; sy = 0; sw = 52; sh = 43;
        } else {
          // soldier1_machine
          sx = 110; sy = 132; sw = 52; sh = 43;
        }
      }

      // Rendu du sprite centré sur la tête et les épaules
      const drawX = Math.round(-pivotX + recoil);
      const drawY = Math.round(-pivotY);
      ctx.drawImage(sprSheet, sx, sy, sw, sh, drawX, drawY, sw, sh);

      // Patch d'armure / épaulette à la couleur du joueur (identifiant en coop)
      if (player.color) {
        ctx.fillStyle = player.color;
        ctx.fillRect(-pivotX + 8, -pivotY + 8, 4, 4);
        ctx.fillRect(-pivotX + 8, -pivotY + sh - 12, 4, 4);
      }

      // Flamme de tir à la bouche du canon (Muzzle Flash)
      if (isShooting) {
        const muzzleX = sw - pivotX + recoil;
        ctx.save();
        ctx.translate(muzzleX, 0);

        // Flamme vive
        ctx.fillStyle = '#fff9c4';
        ctx.beginPath();
        ctx.moveTo(0, -3);
        ctx.lineTo(14 + Math.random() * 8, 0);
        ctx.lineTo(0, 3);
        ctx.closePath();
        ctx.fill();

        // Étincelles orange
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(1, -5, 6, 10);
        ctx.restore();
      }

      // Viseur laser tactique vers la cible
      if (!player.isDowned && !player.isDodging) {
        ctx.save();
        const startX = sw - pivotX + recoil + 2;
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([8, 8]);
        ctx.beginPath();
        ctx.moveTo(startX, 0);
        ctx.lineTo(360, 0);
        ctx.stroke();

        // Réticule terminal
        ctx.setLineDash([]);
        ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
        ctx.strokeRect(355, -4, 8, 8);
        ctx.fillStyle = '#00e5ff';
        ctx.fillRect(358, -1, 2, 2);
        ctx.restore();
      }

      ctx.restore();
    } else {
      // Fallback si chargement en cours
      this.drawProceduralTopdownSurvivor(ctx, player);
    }

    ctx.restore();

    // Jauge de santé et statut au-dessus de la tête (espace monde)
    this.drawPlayerHUD(ctx, player);
  }

  // ==========================================================================
  // 2. ZOMBIES (PERSPECTIVE ZÉNITHALE 360° TOP-DOWN AVEC BRAS TENDUS)
  // ==========================================================================
  drawZombie(ctx, zombie, time) {
    if (zombie.isDead) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const zx = Math.floor(zombie.x);
    const zy = Math.floor(zombie.y);
    ctx.translate(zx, zy);

    // Ombre elliptique au sol
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, zombie.radius * 0.9, zombie.radius * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();

    const sprSheet = this.images.get('topdown_characters');
    if (sprSheet && sprSheet.complete && sprSheet.naturalWidth > 0) {
      const type = zombie.typeId;
      const isRunner = type === 'runner';
      const isTitan = type === 'titan';
      const isBoss = type === 'boss' || zombie.isBoss;

      // Démarche titubante & ondulation des bras
      const swaySpeed = isRunner ? 16 : 8;
      const sway = Math.sin(time * swaySpeed + zombie.x * 0.1) * 0.12;

      ctx.save();
      // Rotation 360° face au joueur poursuivi
      ctx.rotate(zombie.angle + sway);

      // Sprite : zoimbie1_hold (bras putréfiés tendus en avant vers la proie)
      // x="424" y="0" width="35" height="43"
      const sx = 424, sy = 0, sw = 35, sh = 43;
      const pivotX = 16, pivotY = 21.5;

      // Échelle selon l'archétype du monstre
      let scale = 1.0;
      if (isBoss) scale = 2.2;
      else if (isTitan) scale = 1.5;
      else if (type === 'crawler') scale = 0.85;
      else if (isRunner) scale = 0.95;

      const drawW = Math.round(sw * scale);
      const drawH = Math.round(sh * scale);
      const drawX = Math.round(-pivotX * scale);
      const drawY = Math.round(-pivotY * scale);

      // Traces de griffes / bave d'acide si spécifié
      if (type === 'crawler') {
        ctx.fillStyle = 'rgba(185, 28, 28, 0.7)';
        ctx.fillRect(-drawW, -4, drawW, 8);
      }

      // Rendu du zombie zénithal
      ctx.drawImage(sprSheet, sx, sy, sw, sh, drawX, drawY, drawW, drawH);

      // Détails visuels distinctifs selon le type
      if (isRunner) {
        // Écorcheur sanguinaire : griffes ensanglantées & yeux rouges
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(drawX + drawW - 3, -4, 4, 3);
        ctx.fillRect(drawX + drawW - 3, 2, 4, 3);
      } else if (type === 'spitter') {
        // Cracheur caustique : pustules d'acide vert fluo
        ctx.fillStyle = '#84cc16';
        ctx.beginPath();
        ctx.arc(drawX + 8, drawY + 8, 3.5, 0, Math.PI * 2);
        ctx.arc(drawX + 8, drawY + drawH - 8, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (isBoss) {
        // Boss Spécimen Zéro : aura d'énergie mutagène pourpre
        ctx.save();
        ctx.strokeStyle = `rgba(192, 132, 252, ${0.45 + Math.sin(time * 5) * 0.25})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, zombie.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // ======================================================================
      // FLASH D'IMPACT ULTRA-PERFORMANT (ZERO CTX.FILTER = ZERO LAG !)
      // Utilisation du mode de composition GPU 'lighter'
      // ======================================================================
      if (zombie.hitFlashTimer > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8;
        ctx.drawImage(sprSheet, sx, sy, sw, sh, drawX, drawY, drawW, drawH);
        ctx.restore();
      }

      ctx.restore();
    } else {
      this.drawProceduralTopdownZombie(ctx, zombie);
    }

    ctx.restore();

    // Barre de boss ou titan au-dessus
    if (zombie.isBoss || (zombie.typeId === 'titan' && zombie.hp < zombie.maxHp)) {
      this.drawBossBar(ctx, zombie);
    }
  }

  // ==========================================================================
  // 3. PROPS, BARILS & CAISSES ZÉNITHAUX (TILESHEET_COMPLETE 64x64)
  // ==========================================================================
  drawBarrel(ctx, b, time) {
    if (b.exploded) return;

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const bx = Math.floor(b.x);
    const by = Math.floor(b.y);
    ctx.translate(bx, by);

    // Ombre sous le baril
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.beginPath();
    ctx.ellipse(0, 2, b.radius * 1.05, b.radius * 0.8, 0, 0, Math.PI * 2);
    ctx.fill();

    const tilesheet = this.images.get('tilesheet_complete');
    if (tilesheet && tilesheet.complete && tilesheet.naturalWidth > 0) {
      // Coordonnées exactes des barils cylindriques en vue de dessus dans Kenney Tilesheet
      // Chaque tuile = 64x64
      let sx = 1152, sy = 704; // Baril rouge explosif (col:18, row:11)

      if (b.type === 'toxic') {
        sx = 1280; sy = 704;   // Baril toxique / rouillé (col:20, row:11) - AUCUN ctx.filter !
      } else if (b.type === 'blue') {
        sx = 1216; sy = 704;   // Baril bleu métal (col:19, row:11)
      }

      const size = Math.round(b.radius * 2.2);
      ctx.drawImage(tilesheet, sx, sy, 64, 64, -size / 2, -size / 2, size, size);
    } else {
      // Fallback
      ctx.fillStyle = b.type === 'red' ? '#dc2626' : (b.type === 'toxic' ? '#65a30d' : '#0284c7');
      ctx.beginPath();
      ctx.arc(0, 0, b.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawObstacle(ctx, ob) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    // Ombre portée de l'obstacle
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(ob.x + 4, ob.y + 6, ob.w, ob.h);

    const tilesheet = this.images.get('tilesheet_complete');
    if (tilesheet && tilesheet.complete && tilesheet.naturalWidth > 0) {
      if (ob.type === 'barricade') {
        // Sacs de sable / barricade de fortification (col:21, row:10, x:1344, y:640)
        ctx.drawImage(tilesheet, 1344, 640, 64, 64, ob.x, ob.y, ob.w, ob.h);
      } else {
        // Caisse de ravitaillement militaire en bois/métal (col:19, row:17, x:1216, y:1088)
        ctx.drawImage(tilesheet, 1216, 1088, 64, 64, ob.x, ob.y, ob.w, ob.h);
      }
    } else {
      ctx.fillStyle = ob.type === 'barricade' ? '#f97316' : '#1e293b';
      ctx.fillRect(ob.x, ob.y, ob.w, ob.h);
    }

    ctx.restore();
  }

  drawPickup(ctx, pk, time) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    const bob = Math.sin(time * 5 + (pk.bobTimer || 0)) * 3;
    const px = Math.floor(pk.x);
    const py = Math.floor(pk.y + bob);
    ctx.translate(px, py);

    // Ombre flottante
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 10 - bob, pk.radius * 0.9, pk.radius * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Halo d'interaction doux
    const pulse = 0.3 + Math.sin(time * 4) * 0.15;
    ctx.fillStyle = pk.typeId === 'medkit' ? `rgba(239, 68, 68, ${pulse})` : `rgba(234, 179, 8, ${pulse})`;
    ctx.beginPath();
    ctx.arc(0, 0, pk.radius + 6, 0, Math.PI * 2);
    ctx.fill();

    const tilesheet = this.images.get('tilesheet_complete');
    if (tilesheet && tilesheet.complete && tilesheet.naturalWidth > 0) {
      let sx = 1600, sy = 576; // Medkit (col:25, row:9)
      if (pk.typeId === 'ammo') {
        sx = 1280; sy = 640;   // Ammo box (col:20, row:10)
      } else if (pk.typeId === 'armor') {
        sx = 1600; sy = 576;
      }

      const size = 32;
      ctx.drawImage(tilesheet, sx, sy, 64, 64, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = pk.typeId === 'medkit' ? '#ef4444' : '#eab308';
      ctx.fillRect(-12, -10, 24, 20);
    }

    ctx.restore();
  }

  // ==========================================================================
  // 4. INTERFACE HUD AU-DESSUS DU JOUEUR & BOSS
  // ==========================================================================
  drawPlayerHUD(ctx, player) {
    const barW = 44;
    const barH = 5;
    const bx = Math.floor(player.x - barW / 2);
    const by = Math.floor(player.y - player.radius - 18);

    ctx.save();
    // Contour noir net
    ctx.fillStyle = '#020617';
    ctx.fillRect(bx - 2, by - 2, barW + 4, barH + 4);

    // Fond de barre
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, barW, barH);

    // Remplissage HP
    const hpRatio = Math.max(0, player.hp / player.maxHp);
    const hpColor = hpRatio > 0.45 ? '#22c55e' : (hpRatio > 0.2 ? '#f59e0b' : '#ef4444');
    ctx.fillStyle = player.isDowned ? '#ef4444' : hpColor;
    ctx.fillRect(bx, by, Math.floor(barW * hpRatio), barH);

    // Bouclier / Armure
    if (player.armor > 0) {
      const armRatio = Math.min(1, player.armor / player.maxArmor);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(bx, by - 4, Math.floor(barW * armRatio), 3);
    }

    // Nom du joueur
    ctx.font = 'bold 11px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#020617';
    ctx.fillText(player.name, player.x + 1, by - 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(player.name, player.x, by - 5);

    // Statut À TERRE
    if (player.isDowned) {
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.fillStyle = '#ef4444';
      ctx.fillText(`! A TERRE (${Math.ceil(player.downedTimer)}s) !`, player.x, by - 18);

      if (player.reviveProgress > 0) {
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(bx, by + barH + 2, Math.floor(barW * player.reviveProgress), 4);
      }
    }

    ctx.restore();
  }

  drawBossBar(ctx, zombie) {
    const isBoss = zombie.isBoss;
    const barW = isBoss ? 160 : 70;
    const barH = isBoss ? 11 : 7;
    const bx = Math.floor(zombie.x - barW / 2);
    const by = Math.floor(zombie.y - zombie.radius - 24);

    ctx.save();
    ctx.fillStyle = '#020617';
    ctx.fillRect(bx - 3, by - 3, barW + 6, barH + 6);
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(bx, by, barW, barH);

    const ratio = Math.max(0, zombie.hp / zombie.maxHp);
    ctx.fillStyle = isBoss ? '#c084fc' : '#fb923c';
    ctx.fillRect(bx, by, Math.floor(barW * ratio), barH);

    ctx.font = 'bold 12px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#020617';
    ctx.fillText(zombie.config.name.toUpperCase(), zombie.x + 1, by - 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(zombie.config.name.toUpperCase(), zombie.x, by - 5);

    ctx.restore();
  }

  // Textes flottants
  drawFloatingTexts(ctx) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const ft of this.floatingTexts) {
      const alpha = Math.min(1.0, ft.lifetime / 0.25);
      const px = Math.floor(ft.x);
      const py = Math.floor(ft.y);

      ctx.save();
      ctx.translate(px, py);
      ctx.scale(ft.scale, ft.scale);

      ctx.font = `900 ${ft.size}px "Courier New", "Consolas", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Ombre portée noire
      ctx.fillStyle = `rgba(2, 6, 23, ${alpha})`;
      ctx.fillText(ft.text, -2, 0);
      ctx.fillText(ft.text, 2, 0);
      ctx.fillText(ft.text, 0, -2);
      ctx.fillText(ft.text, 0, 2);

      // Texte coloré
      ctx.fillStyle = ft.color;
      ctx.fillText(ft.text, 0, 0);

      ctx.restore();
    }
    ctx.restore();
  }

  // Gyrophares d'alarme de confinement
  drawAtmosphericLighting(ctx, player, mapRoom, time) {
    if (mapRoom && mapRoom.isLockdown) {
      ctx.save();
      const rot = time * 3.5;
      const drawStrobe = (cx, cy) => {
        const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 260);
        grad.addColorStop(0, 'rgba(239, 68, 68, 0.35)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, 260, rot - 0.45, rot + 0.45);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#ef4444';
        ctx.fillRect(cx - 4, cy - 4, 8, 8);
      };
      drawStrobe(200, 200);
      drawStrobe(mapRoom.width - 200, mapRoom.height - 200);
      ctx.restore();
    }
  }

  // Procedural fallbacks
  drawProceduralTopdownSurvivor(ctx, player) {
    ctx.fillStyle = player.color || '#00e5ff';
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, -3, 20, 6);
  }

  drawProceduralTopdownZombie(ctx, zombie) {
    ctx.fillStyle = zombie.config ? zombie.config.color : '#5d8248';
    ctx.beginPath();
    ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

export const PixelArtGraphics = new PixelArtGraphicsEngine();
export const CartoonGraphics = PixelArtGraphics;
