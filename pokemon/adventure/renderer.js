// pokemon/adventure/renderer.js
// Moteur de rendu 2D Canvas pour l'Aventure Kalos-Sud (Menton).
// Rendu pixel-art GBA procédural haute fidélité : villas pastel, palmiers, citronniers,
// mer animée, sprites de dresseurs 4 directions, animations de pas et plaques de nom multijoueur.

import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TILE } from './map.js';

export class AdventureRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.time = 0;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  render({ grid, localPlayer, remotePlayers, interactiveTarget, dialogueBox, activeZoneName }) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.time += 0.03;

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Position de la caméra (centrée sur le joueur local)
    const targetCamX = localPlayer.visualX * TILE_SIZE + TILE_SIZE / 2 - w / 2;
    const targetCamY = localPlayer.visualY * TILE_SIZE + TILE_SIZE / 2 - h / 2;

    const maxCamX = Math.max(0, MAP_WIDTH * TILE_SIZE - w);
    const maxCamY = Math.max(0, MAP_HEIGHT * TILE_SIZE - h);

    const camX = Math.max(0, Math.min(maxCamX, targetCamX));
    const camY = Math.max(0, Math.min(maxCamY, targetCamY));

    ctx.save();
    ctx.translate(-Math.round(camX), -Math.round(camY));

    // Calcul de la zone visible de tuiles
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE));
    const endCol = Math.min(MAP_WIDTH - 1, Math.ceil((camX + w) / TILE_SIZE));
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE));
    const endRow = Math.min(MAP_HEIGHT - 1, Math.ceil((camY + h) / TILE_SIZE));

    // 1. Rendu du sol et tuiles de base
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tile = grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        this.drawBaseTile(ctx, tile, px, py, x, y);
      }
    }

    // 2. Entités triées en profondeur (Y-sort) pour occlusion correcte
    const entities = [];

    // Arbres, citronniers et éléments verticaux
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tile = grid[y][x];
        if (tile === TILE.TREE_PALM || tile === TILE.LEMON_TREE || tile === TILE.FOUNTAIN || tile === TILE.LAB_TABLE || tile === TILE.NURSE_DESK) {
          entities.push({
            type: 'prop',
            tile,
            x: x * TILE_SIZE,
            y: (y + 1) * TILE_SIZE, // Base de l'objet
            gridX: x,
            gridY: y
          });
        }
      }
    }

    // Joueurs distants (multijoueur en temps réel)
    for (const rp of remotePlayers) {
      entities.push({
        type: 'remote_player',
        player: rp,
        x: rp.visualX * TILE_SIZE,
        y: (rp.visualY + 1) * TILE_SIZE
      });
    }

    // Joueur local
    entities.push({
      type: 'local_player',
      player: localPlayer,
      x: localPlayer.visualX * TILE_SIZE,
      y: (localPlayer.visualY + 1) * TILE_SIZE
    });

    // Tri par position Y pour superposer correctement (devant/derrière)
    entities.sort((a, b) => a.y - b.y);

    for (const ent of entities) {
      if (ent.type === 'prop') {
        this.drawProp(ctx, ent.tile, ent.x, ent.y - TILE_SIZE, ent.gridX, ent.gridY, localPlayer.lemonCooldowns);
      } else if (ent.type === 'remote_player') {
        this.drawTrainer(ctx, ent.player, false);
      } else if (ent.type === 'local_player') {
        this.drawTrainer(ctx, ent.player, true);
      }
    }

    // 3. Dessiner la cime des hautes herbes qui dépasse par-dessus les pieds du joueur
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        if (grid[y][x] === TILE.GRASS_TALL) {
          this.drawTallGrassTips(ctx, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }

    // 4. Indicateur d'interaction au sol
    if (interactiveTarget) {
      this.drawInteractionIcon(ctx, interactiveTarget.x * TILE_SIZE + 16, interactiveTarget.y * TILE_SIZE - 6, interactiveTarget.label);
    }

    ctx.restore();

    // 5. Interface HUD (Zone, Dresseur, Citrons)
    this.drawHUD(ctx, w, h, localPlayer, activeZoneName);

    // 6. Boîte de dialogue si ouverte
    if (dialogueBox) {
      this.drawDialogueBox(ctx, w, h, dialogueBox);
    }
  }

  // --- RENDU DES TUILES DE FOND ---
  drawBaseTile(ctx, tile, px, py, x, y) {
    switch (tile) {
      case TILE.COBBLE: {
        // Pavés de Menton (pierre calcaire claire avec joints ocre)
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ded4c5' : '#d5c9b7';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#bfae99';
        ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
        ctx.fillRect(px + TILE_SIZE - 2, py, 2, TILE_SIZE);
        // Légère texture pavée
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(px + 4, py + 4, 10, 8);
        ctx.fillRect(px + 18, py + 16, 10, 8);
        break;
      }
      case TILE.DIRT_PATH: {
        // Chemin de terre Route 1
        ctx.fillStyle = '#d2ad7b';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#b7905c';
        // Petits cailloux
        if ((x * 13 + y * 7) % 5 === 0) {
          ctx.fillRect(px + 8, py + 12, 4, 3);
          ctx.fillRect(px + 20, py + 22, 3, 2);
        }
        break;
      }
      case TILE.GRASS_LAWN: {
        // Pelouse des jardins de Menton
        ctx.fillStyle = '#5fb846';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#4fa137';
        ctx.fillRect(px + 4, py + 8, 3, 4);
        ctx.fillRect(px + 20, py + 18, 3, 4);
        // Petites marguerites
        if ((x * 17 + y * 23) % 11 === 0) {
          ctx.fillStyle = '#fff466';
          ctx.fillRect(px + 14, py + 12, 3, 3);
        }
        break;
      }
      case TILE.GRASS_TALL: {
        // Hautes herbes de combat sauvage
        ctx.fillStyle = '#3c8f2b';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#2d6d20';
        ctx.fillRect(px + 2, py + 14, 28, 18);
        // Brins d'herbe denses
        ctx.fillStyle = '#4fae39';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(px + 4 + i * 7, py + 4, 4, 16);
        }
        break;
      }
      case TILE.SAND: {
        // Plage des Sablettes de Menton
        ctx.fillStyle = '#f6d799';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#e6c483';
        if ((x + y) % 3 === 0) {
          ctx.fillRect(px + 6, py + 10, 3, 2);
          ctx.fillRect(px + 18, py + 20, 2, 2);
        }
        break;
      }
      case TILE.WATER: {
        // Mer Méditerranée turquoise avec vaguelettes animées
        ctx.fillStyle = '#1ba8cc';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#1485a3';
        ctx.fillRect(px, py + 16, TILE_SIZE, 16);
        // Écume blanche ondulante
        const waveOffset = Math.sin(this.time * 2 + x * 0.8) * 4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(px, py + 12 + waveOffset, TILE_SIZE, 3);
        break;
      }
      case TILE.WALL_VILLA: {
        // Murs pastel pêche / ocre de Menton
        ctx.fillStyle = '#f09a65';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#db7e46';
        ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
        // Fenêtre avec volets persiennes verts
        ctx.fillStyle = '#2e6b48';
        ctx.fillRect(px + 6, py + 6, 20, 18);
        ctx.fillStyle = '#bfe3f7';
        ctx.fillRect(px + 10, py + 8, 12, 14);
        break;
      }
      case TILE.ROOF_TERRA: {
        // Tuiles canal romaines en terre cuite
        ctx.fillStyle = '#d45330';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#b53d1d';
        for (let i = 0; i < TILE_SIZE; i += 8) {
          ctx.fillRect(px + i, py, 3, TILE_SIZE);
        }
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
        break;
      }
      case TILE.FENCE: {
        // Garde-corps blanc de la Promenade
        ctx.fillStyle = '#5fb846';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(px + 4, py + 6, 24, 6);
        ctx.fillRect(px + 4, py + 18, 24, 6);
        ctx.fillRect(px + 6, py + 4, 6, 24);
        ctx.fillRect(px + 20, py + 4, 6, 24);
        break;
      }
      case TILE.DOOR: {
        // Entrée ouverte
        ctx.fillStyle = '#ded4c5';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(px + 4, py, 24, TILE_SIZE);
        ctx.fillStyle = '#ffcb05';
        ctx.fillRect(px + 6, py + 2, 20, 4);
        break;
      }
      default: {
        ctx.fillStyle = '#ded4c5';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // --- RENDU DES OBJETS VERTICAUX & PROPS ---
  drawProp(ctx, tile, px, py, gx, gy, lemonCooldowns) {
    if (tile === TILE.TREE_PALM) {
      // Tronc du palmier
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(px + 12, py + 10, 8, 22);
      ctx.fillStyle = '#5c3a1d';
      ctx.fillRect(px + 12, py + 14, 8, 3);
      ctx.fillRect(px + 12, py + 22, 8, 3);
      // Palmes vertes déployées
      ctx.fillStyle = '#227b32';
      ctx.beginPath();
      ctx.arc(px + 16, py + 8, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2da343';
      ctx.beginPath();
      ctx.arc(px + 16, py + 6, 14, 0, Math.PI * 2);
      ctx.fill();
      // Noix de coco
      ctx.fillStyle = '#4a301a';
      ctx.beginPath();
      ctx.arc(px + 13, py + 12, 3, 0, Math.PI * 2);
      ctx.arc(px + 19, py + 12, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile === TILE.LEMON_TREE) {
      // Citronnier de Menton
      // Tronc
      ctx.fillStyle = '#6b4f2c';
      ctx.fillRect(px + 13, py + 14, 6, 18);
      // Feuillage dense
      ctx.fillStyle = '#1e6627';
      ctx.beginPath();
      ctx.arc(px + 16, py + 12, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ea33c';
      ctx.beginPath();
      ctx.arc(px + 16, py + 10, 12, 0, Math.PI * 2);
      ctx.fill();

      // Citrons dorés de Menton
      const key = `${gx},${gy}`;
      const cd = lemonCooldowns ? lemonCooldowns[key] : 0;
      const isReady = !cd || Date.now() > cd;

      if (isReady) {
        ctx.fillStyle = '#ffd700';
        ctx.strokeStyle = '#b8860b';
        ctx.lineWidth = 1;
        const lemonSpots = [
          [px + 10, py + 6],
          [px + 22, py + 7],
          [px + 15, py + 12],
          [px + 8, py + 15],
          [px + 23, py + 15]
        ];
        for (const [lx, ly] of lemonSpots) {
          ctx.beginPath();
          ctx.ellipse(lx, ly, 4, 3, Math.PI / 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
        // Scintillement doré
        if (Math.sin(this.time * 4 + gx) > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + 16, py + 4, 3, 3);
        }
      }
    } else if (tile === TILE.FOUNTAIN) {
      // Fontaine de la Place aux Citrons
      ctx.fillStyle = '#788296';
      ctx.beginPath();
      ctx.arc(px + 16, py + 18, 15, 0, Math.PI * 2);
      ctx.fill();
      // Eau turquoise
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(px + 16, py + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      // Jet central animé
      const jetH = 8 + Math.sin(this.time * 6) * 3;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(px + 15, py + 18 - jetH, 2, jetH);
      ctx.beginPath();
      ctx.arc(px + 16, py + 18 - jetH, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile === TILE.LAB_TABLE) {
      // Table du Laboratoire avec 3 Poké Balls
      ctx.fillStyle = '#5c381d';
      ctx.fillRect(px + 2, py + 8, 28, 20);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(px + 4, py + 10, 24, 16);
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(px + 6, py + 12, 20, 12); // Tapis rouge velours

      // 3 Poké Balls étincelantes
      const balls = [px + 9, px + 16, px + 23];
      for (const bx of balls) {
        ctx.fillStyle = '#e11d48';
        ctx.beginPath();
        ctx.arc(bx, py + 17, 4, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(bx, py + 17, 4, 0, Math.PI);
        ctx.fill();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(bx - 4, py + 16, 8, 2);
        ctx.beginPath();
        ctx.arc(bx, py + 17, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (tile === TILE.NURSE_DESK) {
      // Comptoir Centre Pokémon
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(px + 2, py + 10, 28, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 14, py + 14, 4, 10);
      ctx.fillRect(px + 11, py + 17, 10, 4);
      // Infirmière Joëlle derrière le comptoir
      ctx.fillStyle = '#f472b6'; // Cheveux roses
      ctx.beginPath();
      ctx.arc(px + 16, py + 4, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fed7aa'; // Visage
      ctx.beginPath();
      ctx.arc(px + 16, py + 6, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Cime des hautes herbes (couvre le bas du dresseur qui marche dedans)
  drawTallGrassTips(ctx, px, py) {
    ctx.fillStyle = '#4fae39';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + 3 + i * 7, py + 22, 5, 8);
    }
  }

  // --- RENDU D'UN DRESSEUR (4 DIRECTIONS + CYCLE DE MARCHE) ---
  drawTrainer(ctx, p, isLocal) {
    const px = Math.round(p.visualX * TILE_SIZE);
    const py = Math.round(p.visualY * TILE_SIZE);

    // Ombre sous les pieds
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Calcul de l'animation de pas (0: repos, 1: pied gauche, 2: pied droit)
    let walkFrame = 0;
    if (p.moving) {
      const step = Math.floor((this.time * 14) % 4);
      if (step === 1) walkFrame = 1;
      else if (step === 3) walkFrame = 2;
    }

    const dir = p.dir || 'down';
    const mainColor = p.color || (isLocal ? '#ff4b2b' : '#3b82f6');

    // Corps / Veste du dresseur
    ctx.fillStyle = mainColor;
    ctx.fillRect(px + 10, py + 14, 12, 10);

    // Jambes / Pantalon
    ctx.fillStyle = '#1e293b';
    if (dir === 'left' || dir === 'right') {
      if (walkFrame === 1) {
        ctx.fillRect(px + 9, py + 22, 5, 8);
        ctx.fillRect(px + 16, py + 22, 5, 6);
      } else if (walkFrame === 2) {
        ctx.fillRect(px + 11, py + 22, 5, 6);
        ctx.fillRect(px + 18, py + 22, 5, 8);
      } else {
        ctx.fillRect(px + 11, py + 22, 10, 8);
      }
    } else {
      // Facing Down or Up
      const leftLegH = walkFrame === 1 ? 6 : 8;
      const rightLegH = walkFrame === 2 ? 6 : 8;
      ctx.fillRect(px + 10, py + 22, 5, leftLegH);
      ctx.fillRect(px + 17, py + 22, 5, rightLegH);
    }

    // Chaussures de sport
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 9, py + 28, 6, 3);
    ctx.fillRect(px + 17, py + 28, 6, 3);

    // Tête / Visage
    ctx.fillStyle = '#fed7aa'; // Peau
    ctx.fillRect(px + 10, py + 6, 12, 9);

    // Yeux selon direction
    ctx.fillStyle = '#0f172a';
    if (dir === 'down') {
      ctx.fillRect(px + 12, py + 10, 2, 3);
      ctx.fillRect(px + 18, py + 10, 2, 3);
    } else if (dir === 'left') {
      ctx.fillRect(px + 10, py + 10, 2, 3);
    } else if (dir === 'right') {
      ctx.fillRect(px + 20, py + 10, 2, 3);
    }

    // Casquette de dresseur rouge et blanche emblématique
    ctx.fillStyle = '#dc2626'; // Visière & dessus rouge
    ctx.fillRect(px + 9, py + 3, 14, 5);
    ctx.fillStyle = '#ffffff'; // Front blanc
    ctx.fillRect(px + 11, py + 5, 10, 3);
    if (dir === 'down') {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(px + 8, py + 7, 16, 2); // Visière vers l'avant
    } else if (dir === 'left') {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(px + 6, py + 7, 8, 2);
    } else if (dir === 'right') {
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(px + 18, py + 7, 8, 2);
    }

    // Sac à dos de voyageur
    ctx.fillStyle = '#eab308';
    if (dir === 'up') {
      ctx.fillRect(px + 11, py + 14, 10, 8);
    } else if (dir === 'left') {
      ctx.fillRect(px + 19, py + 15, 4, 7);
    } else if (dir === 'right') {
      ctx.fillRect(px + 9, py + 15, 4, 7);
    }

    // Plaque de nom multijoueur au-dessus de la tête
    this.drawNameTag(ctx, px + 16, py - 4, p.name || 'Dresseur', mainColor, isLocal);
  }

  drawNameTag(ctx, cx, cy, name, color, isLocal) {
    ctx.font = 'bold 11px sans-serif';
    const textWidth = ctx.measureText(name).width;
    const pad = 6;
    const h = 18;
    const w = textWidth + pad * 2 + (isLocal ? 14 : 0);
    const x = cx - w / 2;
    const y = cy - h;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Mini indicateur si local
    if (isLocal) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + 10, y + h / 2, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + (isLocal ? 18 : pad), y + h / 2);
  }

  drawInteractionIcon(ctx, cx, cy, label) {
    const bob = Math.sin(this.time * 6) * 3;
    ctx.font = 'bold 12px sans-serif';
    const txt = `[E] ${label}`;
    const tw = ctx.measureText(txt).width;
    const w = tw + 14;
    const h = 22;
    const x = cx - w / 2;
    const y = cy - h + bob;

    ctx.fillStyle = '#ffcb05';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx, y + h / 2);
  }

  // --- INTERFACE HUD ---
  drawHUD(ctx, w, h, player, zoneName) {
    // 1. Bannière de lieu en haut à gauche
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 260, 48, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('REGION KALOS-SUD', 30, 32);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(zoneName || 'Menton - La Cité des Citrons', 30, 52);

    // 2. Compteurs en haut à droite (Pokédollars & Citrons)
    const moneyTxt = `${player.money || 0} ₽`;
    const lemonsTxt = `${(player.inventory && player.inventory.citron_menton) || 0} Citrons`;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(w - 230, 16, 214, 48, 10);
    ctx.fill();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(moneyTxt, w - 30, 36);

    ctx.fillStyle = '#a3e635';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(lemonsTxt, w - 30, 52);

    // 3. Mini barres de vie de l'équipe en bas à gauche
    if (player.party && player.party.length > 0) {
      const partyW = Math.min(280, player.party.length * 46);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.beginPath();
      ctx.roundRect(16, h - 64, partyW, 48, 8);
      ctx.fill();

      for (let i = 0; i < player.party.length; i++) {
        const p = player.party[i];
        const bx = 26 + i * 44;
        const by = h - 54;

        // Balle ou pastille
        ctx.fillStyle = p.fainted ? '#ef4444' : '#22c55e';
        ctx.beginPath();
        ctx.arc(bx + 14, by + 12, 10, 0, Math.PI * 2);
        ctx.fill();

        // Mini jauge PV
        const hpRatio = Math.max(0, p.currentHp / p.maxHp);
        ctx.fillStyle = '#334155';
        ctx.fillRect(bx, by + 26, 28, 4);
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.2 ? '#eab308' : '#ef4444');
        ctx.fillRect(bx, by + 26, 28 * hpRatio, 4);
      }
    }
  }

  // --- BOÎTE DE DIALOGUE GBA ---
  drawDialogueBox(ctx, w, h, box) {
    const boxW = Math.min(680, w - 32);
    const boxH = 120;
    const boxX = (w - boxW) / 2;
    const boxY = h - boxH - 24;

    // Cadre sombre et bordure dorée style GBA
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();

    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Titre / Interlocuteur
    if (box.speaker) {
      ctx.fillStyle = '#ffcb05';
      ctx.font = 'bold 15px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(box.speaker, boxX + 24, boxY + 28);
    }

    // Message
    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = box.text ? box.text.split('\n') : [''];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], boxX + 24, boxY + (box.speaker ? 42 : 28) + i * 22);
    }

    // Indicateur "Appuyez sur [Entrée] ou [Espace]"
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Appuyez sur [ESPACE] ou [ENTRÉE] pour continuer', boxX + boxW - 20, boxY + boxH - 16);
  }
}
