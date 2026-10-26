// pokemon/adventure/renderer.js
// Moteur de rendu 2D Canvas pour l'Aventure Kalos-Sud (Menton).
// Intègre un zoom caméra GBA/DS authentique (2.25x), un tileset pixel-art 16x16 (upscalé 2x en 32x32),
// les vrais spritesheets GBA FireRed (pret/pokefirered) 4 directions, les intérieurs de bâtiments
// (Laboratoire, Centre Pokémon, Boutique, Arène) et zéro Pokémon visible sur l'overworld (fidèle aux jeux classiques).

import { TILE_SIZE, TILE, BUILDING_SIGNS } from './map.js';
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

const TILE_FILES = {
  grass_lawn: 'assets/tiles/grass_lawn.png',
  grass_flower: 'assets/tiles/grass_flower.png',
  grass_tall: 'assets/tiles/grass_tall.png',
  grass_tall_tips: 'assets/tiles/grass_tall_tips.png',
  cobble: 'assets/tiles/cobble.png',
  dirt_path: 'assets/tiles/dirt_path.png',
  sand: 'assets/tiles/sand.png',
  water_0: 'assets/tiles/water_0.png',
  water_1: 'assets/tiles/water_1.png',
  wall_villa: 'assets/tiles/wall_villa.png',
  roof_terra: 'assets/tiles/roof_terra.png',
  roof_center: 'assets/tiles/roof_center.png',
  roof_mart: 'assets/tiles/roof_mart.png',
  roof_gym: 'assets/tiles/roof_gym.png',
  gym_wall: 'assets/tiles/gym_wall.png',
  door: 'assets/tiles/door.png',
  fence: 'assets/tiles/fence.png',
  sign: 'assets/tiles/sign.png',
  tree_palm: 'assets/tiles/tree_palm.png',
  lemon_tree_ready: 'assets/tiles/lemon_tree_ready.png',
  lemon_tree_empty: 'assets/tiles/lemon_tree_empty.png',
  floor_wood: 'assets/tiles/floor_wood.png',
  floor_center: 'assets/tiles/floor_center.png',
  floor_mart: 'assets/tiles/floor_mart.png',
  floor_gym: 'assets/tiles/floor_gym.png',
  wall_indoor: 'assets/tiles/wall_indoor.png',
  exit_mat: 'assets/tiles/exit_mat.png',
  bookshelf: 'assets/tiles/bookshelf.png',
  potted_plant: 'assets/tiles/potted_plant.png',
  pc_box: 'assets/tiles/pc_box.png',
};

export class AdventureRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.time = 0;

    this.overworldImgs = new Map();
    this.tileImgs = new Map();
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
    for (const [key, src] of Object.entries(TILE_FILES)) {
      const img = new Image();
      img.src = src;
      this.tileImgs.set(key, img);
    }
  }

  getTileImg(key) {
    const img = this.tileImgs.get(key);
    return (img && img.complete && img.naturalWidth > 0) ? img : null;
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
    mapId = 'outdoor',
    grid,
    staticNpcs = [],
    localPlayer,
    remotePlayers = [],
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

    const mapH = grid.length;
    const mapW = mapH > 0 ? grid[0].length : 0;

    // Fond sombre (particulièrement élégant autour des pièces intérieures)
    ctx.fillStyle = mapId === 'outdoor' ? '#14532d' : '#090d16';
    ctx.fillRect(0, 0, w, h);

    // Zoom caméra authentique GBA / DS (2.25x sur bureau, 1.75x sur mobile)
    const zoom = w < 700 ? 1.75 : 2.25;
    const viewW = w / zoom;
    const viewH = h / zoom;

    const worldPixelW = mapW * TILE_SIZE;
    const worldPixelH = mapH * TILE_SIZE;

    let camX, camY;
    if (worldPixelW <= viewW) {
      camX = -(viewW - worldPixelW) / 2;
    } else {
      const targetCamX = localPlayer.visualX * TILE_SIZE + TILE_SIZE / 2 - viewW / 2;
      camX = Math.max(0, Math.min(worldPixelW - viewW, targetCamX));
    }

    if (worldPixelH <= viewH) {
      camY = -(viewH - worldPixelH) / 2;
    } else {
      const targetCamY = localPlayer.visualY * TILE_SIZE + TILE_SIZE / 2 - viewH / 2;
      camY = Math.max(0, Math.min(worldPixelH - viewH, targetCamY));
    }

    ctx.save();
    ctx.scale(zoom, zoom);
    ctx.translate(-Math.round(camX), -Math.round(camY));

    // Cadre extérieur pour les pièces intérieures
    if (mapId !== 'outdoor') {
      ctx.fillStyle = '#050811';
      ctx.fillRect(-8, -8, worldPixelW + 16, worldPixelH + 16);
      ctx.strokeStyle = '#ffcb05';
      ctx.lineWidth = 2;
      ctx.strokeRect(-2, -2, worldPixelW + 4, worldPixelH + 4);
    }

    const startCol = Math.max(0, Math.floor(camX / TILE_SIZE) - 1);
    const endCol = Math.min(mapW - 1, Math.ceil((camX + viewW) / TILE_SIZE) + 1);
    const startRow = Math.max(0, Math.floor(camY / TILE_SIZE) - 1);
    const endRow = Math.min(mapH - 1, Math.ceil((camY + viewH) / TILE_SIZE) + 1);

    // 1. Rendu du sol et tuiles de base
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        const tile = grid[y][x];
        const px = x * TILE_SIZE;
        const py = y * TILE_SIZE;
        this.drawBaseTile(ctx, tile, px, py, x, y, mapId);
      }
    }

    // Emblème Poké Ball central au sol du Centre Pokémon et de l'Arène
    if (mapId === 'pokecenter') {
      this.drawFloorPokeballEmblem(ctx, 6 * TILE_SIZE, 6 * TILE_SIZE, 'rgba(239, 68, 68, 0.22)');
    } else if (mapId === 'gym') {
      this.drawFloorPokeballEmblem(ctx, 7 * TILE_SIZE, 6.5 * TILE_SIZE, 'rgba(250, 204, 21, 0.28)');
    }

    // 2. Entités triées en profondeur (Y-sort) pour occlusion 3/4 correcte
    const entities = [];

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
          tile === TILE.SIGN ||
          tile === TILE.BOOKSHELF ||
          tile === TILE.POTTED_PLANT
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

    // PNJ statiques de la pièce courante (ex: Prof. Platane dans le Labo)
    for (const npc of staticNpcs) {
      entities.push({
        type: 'static_npc',
        spriteKey: npc.spriteKey,
        name: npc.name,
        dir: npc.dir || 'down',
        x: npc.x * TILE_SIZE,
        y: (npc.y + 1) * TILE_SIZE
      });
    }

    // Dresseurs PNJ sur la carte courante (Route 1 ou Championne Solène dans l'Arène)
    const defeatedSet = new Set(localPlayer.defeatedTrainers || []);
    for (const tr of ADVENTURE_TRAINERS) {
      if ((tr.mapId || 'outdoor') !== mapId) continue;
      entities.push({
        type: 'npc_trainer',
        trainer: tr,
        defeated: defeatedSet.has(tr.id),
        x: tr.x * TILE_SIZE,
        y: (tr.y + 1) * TILE_SIZE
      });
    }

    // Joueurs distants présents dans la même carte / pièce (sans Pokémon suiveur visible)
    for (const rp of remotePlayers) {
      if ((rp.mapId || 'outdoor') !== mapId) continue;
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

    entities.sort((a, b) => a.y - b.y);

    for (const ent of entities) {
      if (ent.type === 'prop') {
        this.drawProp(ctx, ent.tile, ent.x, ent.y - TILE_SIZE, ent.gridX, ent.gridY, localPlayer.lemonCooldowns, mapId);
      } else if (ent.type === 'static_npc') {
        this.drawGbaCharacter(ctx, ent.spriteKey, ent.x, ent.y - TILE_SIZE, ent.dir, false);
        this.drawNameTag(ctx, ent.x + 16, ent.y - TILE_SIZE - 10, ent.name, '#38bdf8', false);
      } else if (ent.type === 'npc_trainer') {
        const tr = ent.trainer;
        this.drawGbaCharacter(ctx, tr.sprite, ent.x, ent.y - TILE_SIZE, tr.dir, false);
        const tagColor = tr.isGymLeader ? '#facc15' : (ent.defeated ? '#64748b' : '#ef4444');
        const prefix = ent.defeated ? '[VAINCU] ' : (tr.isGymLeader ? '[CHAMPIONNE] ' : '');
        this.drawNameTag(ctx, ent.x + 16, ent.y - TILE_SIZE - 10, prefix + tr.name, tagColor, false);
      } else if (ent.type === 'remote_player') {
        this.drawTrainer(ctx, ent.player, false);
      } else if (ent.type === 'local_player') {
        this.drawTrainer(ctx, ent.player, true);
      }
    }

    // 3. Cime des hautes herbes qui dépasse par-dessus les pieds du joueur (effet GBA classique)
    const tipsImg = this.getTileImg('grass_tall_tips');
    for (let y = startRow; y <= endRow; y++) {
      for (let x = startCol; x <= endCol; x++) {
        if (grid[y][x] === TILE.GRASS_TALL) {
          if (tipsImg) {
            ctx.drawImage(tipsImg, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
          }
        }
      }
    }

    // 4. Enseignes des bâtiments sur la carte extérieure
    if (mapId === 'outdoor') {
      for (const sign of BUILDING_SIGNS) {
        this.drawBuildingSign(ctx, sign.x * TILE_SIZE + 16, sign.y * TILE_SIZE, sign.text, sign.bg, sign.border);
      }
    }

    // 5. Indicateur d'interaction au sol
    if (interactiveTarget) {
      this.drawInteractionIcon(
        ctx,
        interactiveTarget.x * TILE_SIZE + 16,
        interactiveTarget.y * TILE_SIZE - 8,
        interactiveTarget.label
      );
    }

    ctx.restore();

    // 6. Interface HUD écran (Zone, Quête, Dresseur, Équipe, Citrons, Badges)
    this.drawHUD(ctx, w, h, localPlayer, activeZoneName, questText);

    // 7. Boîte de dialogue GBA si ouverte
    if (dialogueBox) {
      this.drawDialogueBox(ctx, w, h, dialogueBox);
    }
  }

  drawFloorPokeballEmblem(ctx, cx, cy, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, 34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 34, cy);
    ctx.lineTo(cx - 10, cy);
    ctx.moveTo(cx + 10, cy);
    ctx.lineTo(cx + 34, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // --- RENDU PIXEL-ART DES TUILES DE FOND ---
  drawBaseTile(ctx, tile, px, py, x, y, mapId) {
    const drawT = (key) => {
      const img = this.getTileImg(key);
      if (img) {
        ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
        return true;
      }
      return false;
    };

    switch (tile) {
      case TILE.COBBLE:
        if (!drawT('cobble')) {
          ctx.fillStyle = '#e2d8c8';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.DIRT_PATH:
        if (!drawT('dirt_path')) {
          ctx.fillStyle = '#d8b480';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.GRASS_LAWN: {
        const isFlower = ((x * 17 + y * 23) % 13 === 0);
        if (!drawT(isFlower ? 'grass_flower' : 'grass_lawn')) {
          ctx.fillStyle = '#70c850';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      }
      case TILE.GRASS_TALL:
        drawT('grass_lawn');
        if (!drawT('grass_tall')) {
          ctx.fillStyle = '#308830';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.SAND:
        if (!drawT('sand')) {
          ctx.fillStyle = '#f6da9c';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.WATER: {
        const frame = Math.floor(this.time * 1.8) % 2;
        if (!drawT(frame === 0 ? 'water_0' : 'water_1')) {
          ctx.fillStyle = '#28a0d8';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      }
      case TILE.WALL_VILLA:
        if (!drawT('wall_villa')) {
          ctx.fillStyle = '#f4e8d4';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.ROOF_TERRA:
        if (!drawT('roof_terra')) {
          ctx.fillStyle = '#d85838';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.ROOF_CENTER:
        if (!drawT('roof_center')) {
          ctx.fillStyle = '#e03838';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.ROOF_MART:
        if (!drawT('roof_mart')) {
          ctx.fillStyle = '#2880d8';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.GYM_ROOF:
        if (!drawT('roof_gym')) {
          ctx.fillStyle = '#eab308';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.GYM_WALL:
        if (!drawT('gym_wall')) {
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.FENCE:
        drawT('grass_lawn');
        drawT('fence');
        break;
      case TILE.DOOR:
        drawT('cobble');
        drawT('door');
        break;
      case TILE.FLOOR_WOOD:
        if (!drawT('floor_wood')) {
          ctx.fillStyle = '#dab07c';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.FLOOR_CENTER:
        if (!drawT('floor_center')) {
          ctx.fillStyle = '#fceee4';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.FLOOR_MART:
        if (!drawT('floor_mart')) {
          ctx.fillStyle = '#ecf6ff';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.FLOOR_GYM:
        if (!drawT('floor_gym')) {
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.WALL_INDOOR:
        if (!drawT('wall_indoor')) {
          ctx.fillStyle = '#334155';
          ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
        }
        break;
      case TILE.EXIT_MAT:
        drawT(mapId === 'pokecenter' ? 'floor_center' : mapId === 'pokemart' ? 'floor_mart' : mapId === 'gym' ? 'floor_gym' : 'floor_wood');
        drawT('exit_mat');
        break;
      default: {
        // Pour les tuiles avec prop par-dessus (arbres, tables, comptoirs, panneaux), dessiner le sol adapté dessous
        if (mapId === 'lab') drawT('floor_wood');
        else if (mapId === 'pokecenter') drawT('floor_center');
        else if (mapId === 'pokemart') drawT('floor_mart');
        else if (mapId === 'gym') drawT('floor_gym');
        else if (x >= 2 && x <= 22 && y >= 9 && y <= 23) drawT('cobble');
        else drawT('grass_lawn');
        break;
      }
    }
  }

  // --- RENDU PIXEL-ART DES OBJETS VERTICAUX & PROPS ---
  drawProp(ctx, tile, px, py, gx, gy, lemonCooldowns, mapId) {
    if (tile === TILE.TREE_PALM) {
      const img = this.getTileImg('tree_palm');
      if (img) {
        ctx.drawImage(img, px, py - 16, 32, 48);
      }
    } else if (tile === TILE.LEMON_TREE) {
      const key = `${gx},${gy}`;
      const cd = lemonCooldowns ? lemonCooldowns[key] : 0;
      const isReady = !cd || Date.now() > cd;
      const img = this.getTileImg(isReady ? 'lemon_tree_ready' : 'lemon_tree_empty');
      if (img) {
        ctx.drawImage(img, px, py - 16, 32, 48);
      }
    } else if (tile === TILE.FOUNTAIN) {
      // Bassin en pierre pixel-art + jet d'eau animé
      ctx.fillStyle = '#334155';
      ctx.fillRect(px + 2, py + 6, 28, 24);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px + 4, py + 8, 24, 20);
      ctx.fillStyle = '#28a0d8';
      ctx.fillRect(px + 6, py + 10, 20, 16);
      const jetH = 6 + Math.round(Math.sin(this.time * 5) * 2) * 2;
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(px + 14, py + 16 - jetH, 4, jetH + 2);
      ctx.fillRect(px + 10, py + 16 - jetH, 12, 4);
    } else if (tile === TILE.LAB_TABLE) {
      ctx.fillStyle = '#271c15';
      ctx.fillRect(px, py + 6, 32, 22);
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(px + 2, py + 8, 28, 18);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(px + 4, py + 10, 24, 12);

      const ballImg = this.overworldImgs.get('item_ball');
      const balls = gx === 6 ? [px + 4, px + 18] : [px + 10];
      for (const bx of balls) {
        if (ballImg && ballImg.complete && ballImg.naturalWidth > 0) {
          ctx.drawImage(ballImg, bx, py + 9, 12, 12);
        }
      }
    } else if (tile === TILE.NURSE_DESK) {
      if (gx === 5 || mapId === 'outdoor') {
        this.drawGbaCharacter(ctx, 'nurse', px + 14, py - 12, 'down', false);
        this.drawNameTag(ctx, px + 30, py - 20, 'Infirmière Joëlle', '#f43f5e', false);
      }
      ctx.fillStyle = '#881337';
      ctx.fillRect(px, py + 10, 32, 20);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(px, py + 12, 32, 16);
      ctx.fillStyle = '#ffe4e6';
      ctx.fillRect(px, py + 12, 32, 4);
    } else if (tile === TILE.MART_DESK) {
      if (gx === 4 || mapId === 'outdoor') {
        this.drawGbaCharacter(ctx, 'clerk', px + 14, py - 12, 'down', false);
        this.drawNameTag(ctx, px + 30, py - 20, 'Marchand', '#38bdf8', false);
      }
      ctx.fillStyle = '#0c4a6e';
      ctx.fillRect(px, py + 10, 32, 20);
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(px, py + 12, 32, 16);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(px, py + 12, 32, 4);
    } else if (tile === TILE.PC_BOX) {
      const img = this.getTileImg('pc_box');
      if (img) ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
    } else if (tile === TILE.SIGN) {
      const img = this.getTileImg('sign');
      if (img) ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
    } else if (tile === TILE.BOOKSHELF) {
      const img = this.getTileImg('bookshelf');
      if (img) ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
    } else if (tile === TILE.POTTED_PLANT) {
      const img = this.getTileImg('potted_plant');
      if (img) ctx.drawImage(img, px, py, TILE_SIZE, TILE_SIZE);
    }
  }

  // --- RENDU AUTHENTIQUE SPRITESHEET GBA FIRERED (pret/pokefirered) ---
  drawGbaCharacter(ctx, spriteKey, px, py, dir = 'down', moving = false) {
    // Ombre pixelisée sous les pieds
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(px + 6, py + 26, 20, 4);
    ctx.fillRect(px + 8, py + 24, 16, 8);

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
        ctx.translate(px + 32, py - 12);
        ctx.scale(-1, 1);
        ctx.drawImage(img, frameIdx * 16, 0, 16, 32, 0, 0, 32, 44);
      } else {
        ctx.drawImage(img, frameIdx * 16, 0, 16, 32, px, py - 12, 32, 44);
      }
      ctx.restore();
      return true;
    }
    return false;
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
    ctx.font = 'bold 8px sans-serif';
    const tw = ctx.measureText(text).width;
    const w = tw + 10;
    const h = 14;
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h / 2);

    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = border;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cx, y + h / 2);
  }

  drawNameTag(ctx, cx, cy, name, color, isLocal) {
    ctx.font = 'bold 8px sans-serif';
    const textWidth = ctx.measureText(name).width;
    const pad = 5;
    const h = 13;
    const w = textWidth + pad * 2 + (isLocal ? 10 : 0);
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h);

    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);

    if (isLocal) {
      ctx.fillStyle = color;
      ctx.fillRect(x + 4, y + 4, 5, 5);
    }

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + (isLocal ? 12 : pad), y + h / 2 + 0.5);
  }

  drawInteractionIcon(ctx, cx, cy, label) {
    const bob = Math.round(Math.sin(this.time * 6) * 2);
    ctx.font = 'bold 9px sans-serif';
    const txt = `[E] ${label}`;
    const tw = ctx.measureText(txt).width;
    const w = tw + 10;
    const h = 16;
    const x = Math.round(cx - w / 2);
    const y = Math.round(cy - h + bob);

    ctx.fillStyle = '#ffcb05';
    ctx.fillRect(x, y, w, h);

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(txt, cx, y + h / 2 + 0.5);
  }

  // --- INTERFACE HUD ---
  drawHUD(ctx, w, h, player, zoneName, questText) {
    // 1. Bannière de lieu & Objectif en haut à gauche
    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(16, 16, 330, 68, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 2;
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
    const moneyTxt = `${player.money || 0} P$`;
    const lemonsTxt = `${(player.inventory && player.inventory.citron_menton) || 0} Citrons`;
    const badgeCount = (player.badges && player.badges.length) || 0;
    const dexCaught = (player.pokedex && player.pokedex.caught && player.pokedex.caught.length) || 0;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.beginPath();
    ctx.roundRect(w - 240, 16, 224, 68, 8);
    ctx.fill();
    ctx.strokeStyle = '#eab308';
    ctx.lineWidth = 2;
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
      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.beginPath();
      ctx.roundRect(16, h - 72, partyW, 56, 8);
      ctx.fill();
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
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
          ctx.fillRect(bx + 14, by + 8, 16, 16);
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
    ctx.roundRect(boxX, boxY, boxW, boxH, 10);
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
