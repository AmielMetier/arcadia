// pokemon/adventure/renderer.js
// Moteur de rendu 2D Canvas pour l'Aventure Kalos-Sud (Menton).
// Intègre les vrais spritesheets GBA FireRed (pret/pokefirered) 4 directions,
// le Pokémon suiveur (Follower Pokémon), les dresseurs PNJ, l'Arène de Menton,
// la Boutique, les Pokémon sauvages visibles et les portraits de dialogue officiels.

import { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, TILE, BUILDING_SIGNS } from './map.js';
import { ADVENTURE_TRAINERS, spriteUrls } from './data.js';

const OVERWORLD_SPRITE_FILES = {
  red: 'assets/overworld/red.png',
  green: 'assets/overworld/green.png',
  blue: 'assets/overworld/blue.png',
  prof: 'assets/overworld/prof.png',
  nurse: 'assets/overworld/nurse.png',
  clerk: 'assets/overworld/clerk.png',
  youngster: 'assets/overworld/youngster.png',
  lass: 'assets/overworld/lass.png',
  sailor: 'assets/overworld/sailor.png',
  hiker: 'assets/overworld/hiker.png',
  cooltrainer_f: 'assets/overworld/cooltrainer_f.png',
  item_ball: 'assets/overworld/item_ball.png',
};

export class AdventureRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.time = 0;

    // Cache d'images overworld GBA, portraits et sprites Pokémon
    this.overworldImgs = new Map();
    this.pokeImgs = new Map();
    this.portraitImgs = new Map();

    this.preloadAssets();
  }

  preloadAssets() {
    if (typeof Image === 'undefined') return;
    for (const [key, src] of Object.entries(OVERWORLD_SPRITE_FILES)) {
      const img = new Image();
      img.src = src;
      this.overworldImgs.set(key, img);
    }
  }

  getPokeImage(pokeId) {
    if (!pokeId || typeof Image === 'undefined') return null;
    if (this.pokeImgs.has(pokeId)) return this.pokeImgs.get(pokeId);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = spriteUrls(pokeId).icon;
    this.pokeImgs.set(pokeId, img);
    return img;
  }

  getPortraitImage(src) {
    if (!src || typeof Image === 'undefined') return null;
    if (this.portraitImgs.has(src)) return this.portraitImgs.get(src);
    const img = new Image();
    img.src = src;
    this.portraitImgs.set(src, img);
    return img;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
  }

  render({
    grid,
    localPlayer,
    remotePlayers,
    roamingWilds = [],
    interactiveTarget,
    dialogueBox,
    activeZoneName,
    questText
  }) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    this.time += 0.03;
    ctx.imageSmoothingEnabled = false;

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
    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol = Math.min(MAP_WIDTH - 1, Math.ceil((camX + w) / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endRow = Math.min(MAP_HEIGHT - 1, Math.ceil((camY + h) / TILE_SIZE) + 1);

    // 1. Rendu du sol et tuiles de base
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tile = grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        this.drawBaseTile(ctx, tile, px, py, x, y);
      }
    }

    // 2. Entités triées en profondeur (Y-sort) pour occlusion 3/4 correcte
    const entities = [];

    // Arbres, citronniers et éléments verticaux
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tile = grid[y][x];
        if (
          tile === TILE.TREE_PALM ||
          tile === TILE.LEMON_TREE ||
          tile === TILE.FOUNTAIN ||
          tile === TILE.LAB_TABLE ||
          tile === TILE.NURSE_DESK ||
          tile === TILE.MART_DESK ||
          tile === TILE.PC_BOX ||
          tile === TILE.SIGN
        ) {
          entities.push({
            type: 'prop',
            tile,
            x: x * TILE_SIZE,
            y: (y + 1) * TILE_SIZE,
            gridX: x,
            gridY: y
          });
        }
      }
    }

    // Professeur Platane au Laboratoire (en x:5, y:6)
    entities.push({
      type: 'static_npc',
      spriteKey: 'prof',
      name: 'Prof. Platane',
      dir: 'down',
      x: 5 * TILE_SIZE,
      y: 7 * TILE_SIZE
    });

    // Dresseurs PNJ sur la carte et Championne Solène
    const defeatedSet = new Set(localPlayer.defeatedTrainers || []);
    for (const tr of ADVENTURE_TRAINERS) {
      entities.push({
        type: 'npc_trainer',
        trainer: tr,
        defeated: defeatedSet.has(tr.id),
        x: tr.x * TILE_SIZE,
        y: (tr.y + 1) * TILE_SIZE
      });
    }

    // Pokémon sauvages visibles dans les herbes / plage
    for (const rw of roamingWilds) {
      entities.push({
        type: 'roaming_wild',
        wild: rw,
        x: rw.x * TILE_SIZE,
        y: (rw.y + 1) * TILE_SIZE
      });
    }

    // Joueurs distants + leur Pokémon suiveur
    for (const rp of remotePlayers) {
      const rpLead = rp.leadPokeId;
      if (rpLead) {
        const fx = rp.prevX !== undefined ? rp.prevX : rp.x;
        const fy = rp.prevY !== undefined ? rp.prevY : rp.y - 1;
        entities.push({
          type: 'follower',
          pokeId: rpLead,
          visualX: fx,
          visualY: fy,
          moving: rp.moving,
          y: (fy + 0.95) * TILE_SIZE
        });
      }
      entities.push({
        type: 'remote_player',
        player: rp,
        x: rp.visualX * TILE_SIZE,
        y: (rp.visualY + 1) * TILE_SIZE
      });
    }

    // Pokémon suiveur du joueur local
    const localLead = localPlayer.party && localPlayer.party[0] ? localPlayer.party[0] : null;
    if (localLead && !localLead.fainted) {
      const fx = localPlayer.followerX !== undefined ? localPlayer.followerX : localPlayer.x;
      const fy = localPlayer.followerY !== undefined ? localPlayer.followerY : localPlayer.y;
      if (Math.hypot(fx - localPlayer.visualX, fy - localPlayer.visualY) > 0.15) {
        entities.push({
          type: 'follower',
          pokeId: localLead.id,
          visualX: fx,
          visualY: fy,
          moving: localPlayer.moving,
          y: (fy + 0.95) * TILE_SIZE
        });
      }
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
      } else if (ent.type === 'static_npc') {
        this.drawGbaCharacter(ctx, ent.spriteKey, ent.x, ent.y - TILE_SIZE, ent.dir, false);
        this.drawNameTag(ctx, ent.x + 16, ent.y - TILE_SIZE - 8, ent.name, '#38bdf8', false);
      } else if (ent.type === 'npc_trainer') {
        const tr = ent.trainer;
        this.drawGbaCharacter(ctx, tr.sprite, ent.x, ent.y - TILE_SIZE, tr.dir, false);
        const tagColor = tr.isGymLeader ? '#facc15' : (ent.defeated ? '#64748b' : '#ef4444');
        const prefix = ent.defeated ? '[VAINCU] ' : (tr.isGymLeader ? '[CHAMPIONNE] ' : '[DRESSEUR] ');
        this.drawNameTag(ctx, ent.x + 16, ent.y - TILE_SIZE - 8, prefix + tr.name.split(' ').pop(), tagColor, false);
      } else if (ent.type === 'roaming_wild') {
        this.drawRoamingWild(ctx, ent.wild);
      } else if (ent.type === 'follower') {
        this.drawFollowerPokemon(ctx, ent.pokeId, ent.visualX, ent.visualY, ent.moving);
      } else if (ent.type === 'remote_player') {
        this.drawTrainer(ctx, ent.player, false);
      } else if (ent.type === 'local_player') {
        this.drawTrainer(ctx, ent.player, true);
      }
    }

    // 3. Dessiner la cime des hautes herbes qui dépasse par-dessus les pieds
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        if (grid[y][x] === TILE.GRASS_TALL) {
          this.drawTallGrassTips(ctx, x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }

    // 4. Enseignes des bâtiments sur les toits
    for (const sign of BUILDING_SIGNS) {
      this.drawBuildingSign(ctx, sign.x * TILE_SIZE + 16, sign.y * TILE_SIZE, sign.text, sign.bg, sign.border);
    }

    // 5. Indicateur d'interaction au sol
    if (interactiveTarget) {
      this.drawInteractionIcon(
        ctx,
        interactiveTarget.x * TILE_SIZE + 16,
        interactiveTarget.y * TILE_SIZE - 10,
        interactiveTarget.label
      );
    }

    ctx.restore();

    // 6. Interface HUD (Zone, Quête, Dresseur, Équipe, Citrons, Badges)
    this.drawHUD(ctx, w, h, localPlayer, activeZoneName, questText);

    // 7. Boîte de dialogue si ouverte
    if (dialogueBox) {
      this.drawDialogueBox(ctx, w, h, dialogueBox);
    }
  }

  // --- RENDU DES TUILES DE FOND ---
  drawBaseTile(ctx, tile, px, py, x, y) {
    switch (tile) {
      case TILE.COBBLE: {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ded4c5' : '#d5c9b7';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#bfae99';
        ctx.fillRect(px, py + TILE_SIZE - 2, TILE_SIZE, 2);
        ctx.fillRect(px + TILE_SIZE - 2, py, 2, TILE_SIZE);
        ctx.fillStyle = 'rgba(0,0,0,0.04)';
        ctx.fillRect(px + 4, py + 4, 10, 8);
        ctx.fillRect(px + 18, py + 16, 10, 8);
        break;
      }
      case TILE.DIRT_PATH: {
        ctx.fillStyle = '#d2ad7b';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#b7905c';
        if ((x * 13 + y * 7) % 5 === 0) {
          ctx.fillRect(px + 8, py + 12, 4, 3);
          ctx.fillRect(px + 20, py + 22, 3, 2);
        }
        break;
      }
      case TILE.GRASS_LAWN: {
        ctx.fillStyle = '#5fb846';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#4fa137';
        ctx.fillRect(px + 4, py + 8, 3, 4);
        ctx.fillRect(px + 20, py + 18, 3, 4);
        if ((x * 17 + y * 23) % 11 === 0) {
          ctx.fillStyle = '#fff466';
          ctx.fillRect(px + 14, py + 12, 3, 3);
        }
        break;
      }
      case TILE.GRASS_TALL: {
        ctx.fillStyle = '#3c8f2b';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#2d6d20';
        ctx.fillRect(px + 2, py + 14, 28, 18);
        ctx.fillStyle = '#4fae39';
        for (let i = 0; i < 4; i++) {
          ctx.fillRect(px + 4 + i * 7, py + 4, 4, 16);
        }
        break;
      }
      case TILE.SAND: {
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
        ctx.fillStyle = '#1ba8cc';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#1485a3';
        ctx.fillRect(px, py + 16, TILE_SIZE, 16);
        const waveOffset = Math.sin(this.time * 2 + x * 0.8) * 4;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(px, py + 12 + waveOffset, TILE_SIZE, 3);
        break;
      }
      case TILE.WALL_VILLA: {
        ctx.fillStyle = '#f09a65';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#db7e46';
        ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
        ctx.fillStyle = '#2e6b48';
        ctx.fillRect(px + 6, py + 6, 20, 18);
        ctx.fillStyle = '#bfe3f7';
        ctx.fillRect(px + 10, py + 8, 12, 14);
        break;
      }
      case TILE.ROOF_TERRA: {
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
      case TILE.GYM_WALL: {
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#eab308';
        ctx.fillRect(px + 4, py, 6, TILE_SIZE);
        ctx.fillRect(px + 22, py, 6, TILE_SIZE);
        ctx.fillStyle = '#ca8a04';
        ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
        break;
      }
      case TILE.GYM_ROOF: {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        ctx.fillStyle = '#eab308';
        for (let i = 0; i < TILE_SIZE; i += 8) {
          ctx.fillRect(px + i, py, 3, TILE_SIZE);
        }
        ctx.fillStyle = '#facc15';
        ctx.fillRect(px, py + TILE_SIZE - 4, TILE_SIZE, 4);
        break;
      }
      case TILE.FENCE: {
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
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(px + 12, py + 10, 8, 22);
      ctx.fillStyle = '#5c3a1d';
      ctx.fillRect(px + 12, py + 14, 8, 3);
      ctx.fillRect(px + 12, py + 22, 8, 3);
      ctx.fillStyle = '#227b32';
      ctx.beginPath();
      ctx.arc(px + 16, py + 8, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2da343';
      ctx.beginPath();
      ctx.arc(px + 16, py + 6, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4a301a';
      ctx.beginPath();
      ctx.arc(px + 13, py + 12, 3, 0, Math.PI * 2);
      ctx.arc(px + 19, py + 12, 3, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile === TILE.LEMON_TREE) {
      ctx.fillStyle = '#6b4f2c';
      ctx.fillRect(px + 13, py + 14, 6, 18);
      ctx.fillStyle = '#1e6627';
      ctx.beginPath();
      ctx.arc(px + 16, py + 12, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2ea33c';
      ctx.beginPath();
      ctx.arc(px + 16, py + 10, 12, 0, Math.PI * 2);
      ctx.fill();

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
        if (Math.sin(this.time * 4 + gx) > 0.4) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(px + 16, py + 4, 3, 3);
        }
      }
    } else if (tile === TILE.FOUNTAIN) {
      ctx.fillStyle = '#788296';
      ctx.beginPath();
      ctx.arc(px + 16, py + 18, 15, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(px + 16, py + 18, 12, 0, Math.PI * 2);
      ctx.fill();
      const jetH = 8 + Math.sin(this.time * 6) * 3;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(px + 15, py + 18 - jetH, 2, jetH);
      ctx.beginPath();
      ctx.arc(px + 16, py + 18 - jetH, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (tile === TILE.LAB_TABLE) {
      ctx.fillStyle = '#5c381d';
      ctx.fillRect(px + 2, py + 8, 28, 20);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(px + 4, py + 10, 24, 16);
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(px + 6, py + 12, 20, 12);

      const ballImg = this.overworldImgs.get('item_ball');
      const balls = [px + 5, px + 12, px + 19];
      for (const bx of balls) {
        if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
          ctx.drawImage(ballImg, bx, py + 11, 10, 10);
        } else {
          ctx.fillStyle = '#e11d48';
          ctx.beginPath();
          ctx.arc(bx + 4, py + 17, 4, Math.PI, 0);
          ctx.fill();
        }
      }
    } else if (tile === TILE.NURSE_DESK) {
      // Infirmière Joëlle derrière le comptoir
      this.drawGbaCharacter(ctx, 'nurse', px, py - 10, 'down', false);
      // Comptoir Centre Pokémon
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(px + 2, py + 12, 28, 18);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px + 14, py + 16, 4, 10);
      ctx.fillRect(px + 11, py + 19, 10, 4);
    } else if (tile === TILE.MART_DESK) {
      // Vendeur Boutique derrière le comptoir
      this.drawGbaCharacter(ctx, 'clerk', px, py - 10, 'down', false);
      // Comptoir bleu Boutique Pokémon
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(px + 2, py + 12, 28, 18);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(px + 4, py + 14, 24, 3);
    } else if (tile === TILE.PC_BOX) {
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 4, py + 2, 24, 28);
      ctx.fillStyle = '#0ea5e9';
      ctx.fillRect(px + 7, py + 5, 18, 14);
      ctx.fillStyle = '#bae6fd';
      ctx.fillRect(px + 9, py + 7, 6, 4);
    } else if (tile === TILE.SIGN) {
      ctx.fillStyle = '#5fb846';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#78350f';
      ctx.fillRect(px + 14, py + 18, 4, 12);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(px + 4, py + 6, 24, 14);
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(px + 6, py + 9, 20, 2);
      ctx.fillRect(px + 6, py + 13, 16, 2);
    }
  }

  // --- RENDU AUTHENTIQUE SPRITESHEET GBA FIRERED (pret/pokefirered) ---
  drawGbaCharacter(ctx, spriteKey, px, py, dir = 'down', moving = false) {
    // Ombre sous les pieds
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 10, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    const img = this.overworldImgs.get(spriteKey) || this.overworldImgs.get('red');
    if (img && img.complete && img.naturalWidth >= 64) {
      const totalFrames = Math.floor(img.naturalWidth / 16);
      let frameIdx = 0;
      let flipX = false;

      let step = 0;
      if (moving && totalFrames >= 9) {
        const cycle = Math.floor((this.time * 14) % 4);
        if (cycle === 1) step = 1;
        else if (cycle === 3) step = 2;
      }

      if (dir === 'down') {
        frameIdx = step === 0 ? 0 : (step === 1 ? 3 : 4);
      } else if (dir === 'up') {
        frameIdx = step === 0 ? 1 : (step === 1 ? 5 : 6);
      } else if (dir === 'left') {
        frameIdx = step === 0 ? 2 : (step === 1 ? 7 : 8);
      } else if (dir === 'right') {
        frameIdx = step === 0 ? 2 : (step === 1 ? 7 : 8);
        flipX = true;
      }

      if (frameIdx >= totalFrames) frameIdx = 0;

      ctx.save();
      if (flipX) {
        ctx.translate(px + 32, py - 14);
        ctx.scale(-1, 1);
        ctx.drawImage(img, frameIdx * 16, 0, 16, 32, 0, 0, 32, 46);
      } else {
        ctx.drawImage(img, frameIdx * 16, 0, 16, 32, px, py - 14, 32, 46);
      }
      ctx.restore();
      return true;
    }
    return false;
  }

  // --- RENDU D'UN POKÉMON SUIVEUR (FOLLOWER POKÉMON) ---
  drawFollowerPokemon(ctx, pokeId, vx, vy, moving) {
    const px = Math.round(vx * TILE_SIZE);
    const py = Math.round(vy * TILE_SIZE);
    const bob = moving ? Math.abs(Math.sin(this.time * 14)) * 4 : Math.sin(this.time * 4) * 1.5;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 28, 8, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    const img = this.getPokeImage(pokeId);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, px - 2, py - 6 - bob, 36, 36);
    }
  }

  // --- RENDU D'UN POKÉMON SAUVAGE VISIBLE SUR LA CARTE ---
  drawRoamingWild(ctx, wild) {
    const px = Math.round(wild.x * TILE_SIZE);
    const py = Math.round(wild.y * TILE_SIZE);
    const hop = Math.abs(Math.sin(this.time * 5 + wild.x)) * 5;

    ctx.fillStyle = 'rgba(250, 204, 21, 0.35)';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 27, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    const img = this.getPokeImage(wild.id);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, px - 2, py - 6 - hop, 36, 36);
    }
  }

  // Cime des hautes herbes (couvre le bas du dresseur qui marche dedans)
  drawTallGrassTips(ctx, px, py) {
    ctx.fillStyle = '#4fae39';
    for (let i = 0; i < 4; i++) {
      ctx.fillRect(px + 3 + i * 7, py + 22, 5, 8);
    }
  }

  // --- RENDU D'UN DRESSEUR JOUEUR (LOCAL OU DISTANT) ---
  drawTrainer(ctx, p, isLocal) {
    const px = Math.round(p.visualX * TILE_SIZE);
    const py = Math.round(p.visualY * TILE_SIZE);
    const mainColor = p.color || (isLocal ? '#ff4b2b' : '#3b82f6');
    const spriteKey = p.avatar || (isLocal ? 'red' : 'blue');

    this.drawGbaCharacter(ctx, spriteKey, px, py, p.dir || 'down', !!p.moving);
    this.drawNameTag(ctx, px + 16, py - 14, p.name || 'Dresseur', mainColor, isLocal);
  }

  drawBuildingSign(ctx, cx, cy, text, bg, border) {
    ctx.font = 'bold 10px sans-serif';
    const tw = ctx.measureText(text).width;
    const w = tw + 14;
    const h = 18;
    const x = cx - w / 2;
    const y = cy - h / 2;

    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();

    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y + h / 2);
  }

  drawNameTag(ctx, cx, cy, name, color, isLocal) {
    ctx.font = 'bold 11px sans-serif';
    const textWidth = ctx.measureText(name).width;
    const pad = 6;
    const h = 18;
    const w = textWidth + pad * 2 + (isLocal ? 14 : 0);
    const x = cx - w / 2;
    const y = cy - h;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 6);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

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
  drawHUD(ctx, w, h, player, zoneName, questText) {
    // 1. Bannière de lieu & Objectif en haut à gauche
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 310, 68, 10);
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('KALOS-SUD • CÔTE D\'AZUR', 28, 32);

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(zoneName || 'Menton - La Cité des Citrons', 28, 50);

    ctx.fillStyle = '#facc15';
    ctx.font = '12px sans-serif';
    ctx.fillText(questText || 'Explorez Menton et la Route 1', 28, 70);

    // 2. Compteurs en haut à droite (Pokédollars, Citrons, Badges, Pokédex)
    const moneyTxt = `${player.money || 0} ₽`;
    const lemonsTxt = `${(player.inventory && player.inventory.citron_menton) || 0} Citrons`;
    const badgeCount = (player.badges && player.badges.length) || 0;
    const dexCaught = (player.pokedex && player.pokedex.caught && player.pokedex.caught.length) || 0;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.beginPath();
    ctx.roundRect(w - 240, 16, 224, 68, 10);
    ctx.fill();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(moneyTxt, w - 28, 35);

    ctx.fillStyle = '#a3e635';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText(lemonsTxt, w - 28, 53);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`BADGES: ${badgeCount}/1  •  DEX: ${dexCaught}/28`, w - 28, 71);

    // 3. Mini barres de vie et icônes de l'équipe en bas à gauche
    if (player.party && player.party.length > 0) {
      const slotW = 54;
      const partyW = player.party.length * slotW + 16;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.beginPath();
      ctx.roundRect(16, h - 72, partyW, 56, 10);
      ctx.fill();
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      for (let i = 0; i < player.party.length; i++) {
        const p = player.party[i];
        const bx = 24 + i * slotW;
        const by = h - 66;

        const pImg = this.getPokeImage(p.id);
        if (pImg && pImg.complete && pImg.naturalWidth > 0) {
          ctx.save();
          if (p.fainted) ctx.filter = 'grayscale(1) opacity(0.5)';
          ctx.drawImage(pImg, bx + 4, by - 2, 36, 36);
          ctx.restore();
        } else {
          ctx.fillStyle = p.fainted ? '#ef4444' : '#22c55e';
          ctx.beginPath();
          ctx.arc(bx + 22, by + 14, 10, 0, Math.PI * 2);
          ctx.fill();
        }

        // Niveau
        ctx.fillStyle = '#ffcb05';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`N.${p.level}`, bx + 22, by + 35);

        // Mini jauge PV
        const hpRatio = Math.max(0, p.currentHp / p.maxHp);
        ctx.fillStyle = '#334155';
        ctx.fillRect(bx + 4, by + 40, 36, 4);
        ctx.fillStyle = hpRatio > 0.5 ? '#22c55e' : (hpRatio > 0.2 ? '#eab308' : '#ef4444');
        ctx.fillRect(bx + 4, by + 40, 36 * hpRatio, 4);
      }
    }
  }

  // --- BOÎTE DE DIALOGUE GBA AVEC PORTRAIT OFFICIEL ---
  drawDialogueBox(ctx, w, h, box) {
    const boxW = Math.min(720, w - 32);
    const boxH = 128;
    const boxX = (w - boxW) / 2;
    const boxY = h - boxH - 24;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.96)';
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();

    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 3;
    ctx.stroke();

    let textLeft = boxX + 24;

    if (box.portrait) {
      const pImg = this.getPortraitImage(box.portrait);
      if (pImg && pImg.complete && pImg.naturalWidth > 0) {
        ctx.fillStyle = 'rgba(30, 41, 59, 0.9)';
        ctx.beginPath();
        ctx.roundRect(boxX + 16, boxY + 16, 92, 96, 8);
        ctx.fill();
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.drawImage(pImg, boxX + 20, boxY + 20, 84, 84);
        textLeft = boxX + 124;
      }
    }

    if (box.speaker) {
      ctx.fillStyle = '#ffcb05';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(box.speaker, textLeft, boxY + 20);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    const lines = box.text ? box.text.split('\n') : [''];
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i], textLeft, boxY + (box.speaker ? 46 : 24) + i * 22);
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('Appuyez sur [ESPACE] ou [E] pour continuer ▶', boxX + boxW - 20, boxY + boxH - 18);
  }
}
