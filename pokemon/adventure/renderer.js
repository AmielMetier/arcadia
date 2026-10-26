// pokemon/adventure/renderer.js
// Moteur de rendu PhaserJS 3 (WebGL / Canvas avec pixelArt: true, Arcade Physics & Camera Follow)
// pour le Monde 5G Unys (64x64 tuiles de 32x32px) utilisant les 3 packs d'assets officiels :
// 1. assets/graphics/tileset_global.png (Dirtywiggles - Unys 5G)
// 2. assets/graphics/tileset_buildings.png (WesleyFG - Bâtiments 5G)
// 3. assets/graphics/tileset_nature.png (Relic Castle / Paradigmi - Nature & Flore 5G)
// + Couche HUD 2D nette pour la Minimap 64x64, le Bandeau de Zone et les Boîtes de Dialogue.

import {
  TILE_SIZE,
  TILE,
  MAPS,
  WORLD_REGIONS,
  WORLD_BUILDINGS,
  WORLD_PROPS,
  SIGNPOSTS,
  isSolid
} from './map.js';

function globalIdx(origCol, origRow) {
  const strip = Math.floor(origRow / 96);
  const newCol = strip * 8 + origCol;
  const newRow = origRow % 96;
  return newRow * 64 + newCol;
}

function natureIdx(origCol, origRow) {
  const strip = Math.floor(origRow / 120);
  const newCol = strip * 8 + origCol;
  const newRow = origRow % 120;
  return newRow * 16 + newCol;
}

function buildingIdx(col, row) {
  return row * 20 + col;
}

export class AdventureRenderer {
  constructor(hudCanvas) {
    this.canvas = hudCanvas;
    this.ctx = hudCanvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.width = hudCanvas.width || window.innerWidth;
    this.height = hudCanvas.height || window.innerHeight;
    this.animTick = 0;

    // État courant transmis par adventure.js à chaque frame
    this.state = null;
    this.builtMapId = null;
    this.phaserReady = false;

    this._initPhaserInstance();
  }

  _initPhaserInstance() {
    if (typeof window === 'undefined' || !window.Phaser) {
      console.warn('PhaserJS non détecté sur window.Phaser');
      return;
    }

    const parentEl = this.canvas.parentElement;
    let phaserHost = parentEl.querySelector('#advPhaserHost');
    if (!phaserHost) {
      phaserHost = document.createElement('div');
      phaserHost.id = 'advPhaserHost';
      phaserHost.style.cssText = 'position:absolute;inset:0;z-index:1;overflow:hidden;';
      parentEl.insertBefore(phaserHost, this.canvas);
    }
    // Le canvas HUD 2D reste au-dessus du canvas Phaser (sans bloquer les clics)
    this.canvas.style.cssText = 'position:absolute;inset:0;z-index:5;pointer-events:none;width:100%;height:100%;';

    const self = this;

    class UnovaOverworldScene extends window.Phaser.Scene {
      constructor() {
        super({ key: 'UnovaOverworldScene' });
      }

      preload() {
        // 1. Les 3 Packs d'Assets 5G (Unys) en 32x32
        this.load.image('tileset_global', 'assets/graphics/tileset_global.png');
        this.load.image('tileset_buildings', 'assets/graphics/tileset_buildings.png');
        this.load.image('tileset_nature', 'assets/graphics/tileset_nature.png');

        // 2. Tuiles d'intérieurs et objets spéciaux
        const indoorTiles = [
          'floor_wood', 'floor_center', 'floor_mart', 'floor_gym',
          'wall_indoor', 'exit_mat', 'bookshelf', 'potted_plant',
          'pc_box', 'lemon_tree_ready', 'lemon_tree_empty', 'sign',
          'grass_tall_tips'
        ];
        for (const t of indoorTiles) {
          this.load.image(`tile_${t}`, `assets/tiles/${t}.png`);
        }

        // 3. Sprites Dresseurs & PNJ
        const trainers = {
          red: 'assets/trainers/red.png',
          green: 'assets/trainers/leaf.png',
          prof: 'assets/trainers/prof_oak.png',
          nurse: 'assets/trainers/nurse_joy.png',
          clerk: 'assets/trainers/super_nerd.png',
          youngster: 'assets/trainers/youngster.png',
          lass: 'assets/trainers/lass.png',
          sailor: 'assets/trainers/sailor.png',
          hiker: 'assets/trainers/hiker.png',
          cooltrainer_f: 'assets/trainers/korrina.png'
        };
        for (const [k, url] of Object.entries(trainers)) {
          this.load.image(`tr_${k}`, url);
        }
      }

      create() {
        self.scene = this;
        self.phaserReady = true;

        this.worldLayerGroup = this.add.group();
        this.solidBodies = this.physics.add.staticGroup();
        this.npcSprites = new Map();
        this.remoteSprites = new Map();
        this.berrySprites = new Map();

        // Créer le sprite du joueur avec Arcade Physics activé
        this.playerContainer = this.add.container(9 * TILE_SIZE + 16, 44 * TILE_SIZE + 16);
        this.playerContainer.setDepth(15);

        this.playerShadow = this.add.ellipse(0, 12, 22, 9, 0x000000, 0.38);
        this.playerSprite = this.add.image(0, -4, 'tr_red');
        this.playerSprite.setDisplaySize(38, 38);
        this.playerGrassOverlay = this.add.image(0, 4, 'tile_grass_tall_tips');
        this.playerGrassOverlay.setDisplaySize(32, 32);
        this.playerGrassOverlay.setVisible(false);

        this.playerContainer.add([this.playerShadow, this.playerSprite, this.playerGrassOverlay]);

        // Corps physique Arcade Physics pour bloquer le joueur contre les arbres et murs
        this.physics.world.enable(this.playerContainer);
        this.playerContainer.body.setSize(22, 22);
        this.playerContainer.body.setOffset(-11, -6);
        this.physics.add.collider(this.playerContainer, this.solidBodies);

        // Configuration de la caméra Phaser avec suivi fluide et zoom Pixel Art net
        this.cameras.main.setRoundPixels(true);
        this.cameras.main.setZoom(1.85);
        this.cameras.main.startFollow(this.playerContainer, true, 0.16, 0.16);

        if (self.state) {
          self._rebuildPhaserMap(this, self.state.mapId || 'outdoor', self.state.map);
        }
      }

      update() {
        if (!self.state) return;
        self._syncEntitiesInPhaser(this, self.state);
      }
    }

    this.game = new window.Phaser.Game({
      type: window.Phaser.AUTO,
      parent: phaserHost,
      width: this.width,
      height: this.height,
      backgroundColor: '#090e18',
      pixelArt: true,
      roundPixels: true,
      antialias: false,
      physics: {
        default: 'arcade',
        arcade: {
          gravity: { y: 0 },
          debug: false
        }
      },
      scale: {
        mode: window.Phaser.Scale.NONE,
        width: this.width,
        height: this.height
      },
      scene: [UnovaOverworldScene]
    });
  }

  _clearCurrentMap(scene) {
    if (this.activeTilemaps) {
      for (const tm of this.activeTilemaps) {
        tm.destroy();
      }
    }
    this.activeTilemaps = [];

    if (scene.worldLayerGroup) {
      scene.worldLayerGroup.clear(true, true);
    }
    if (scene.solidBodies) {
      scene.solidBodies.clear(true, true);
    }
    if (scene.npcSprites) {
      for (const sp of scene.npcSprites.values()) sp.destroy();
      scene.npcSprites.clear();
    }
    if (scene.remoteSprites) {
      for (const sp of scene.remoteSprites.values()) sp.destroy();
      scene.remoteSprites.clear();
    }
    if (scene.berrySprites) {
      for (const sp of scene.berrySprites.values()) sp.destroy();
      scene.berrySprites.clear();
    }
  }

  _rebuildPhaserMap(scene, mapId, grid) {
    if (!scene || !grid) return;
    this._clearCurrentMap(scene);
    this.builtMapId = mapId;

    const mapH = grid.length;
    const mapW = mapH > 0 ? grid[0].length : 0;

    if (mapId === 'outdoor') {
      this._buildOutdoorUnovaMap(scene, mapW, mapH, grid);
      scene.cameras.main.setZoom(1.85);
      scene.cameras.main.setBounds(0, 0, mapW * TILE_SIZE, mapH * TILE_SIZE);
      scene.cameras.main.setBackgroundColor('#2e6f28');
    } else {
      this._buildIndoorMap(scene, mapId, mapW, mapH, grid);
      scene.cameras.main.setZoom(2.15);
      // Permettre le centrage parfait des petites pièces intérieures
      const pad = 256;
      scene.cameras.main.setBounds(-pad, -pad, mapW * TILE_SIZE + pad * 2, mapH * TILE_SIZE + pad * 2);
      scene.cameras.main.setBackgroundColor('#090e18');
    }

    // Créer les corps physiques solides Arcade Physics pour les collisions
    this._buildArcadeCollisionBodies(scene, mapW, mapH, grid);
  }

  _buildOutdoorUnovaMap(scene, mapW, mapH, grid) {
    // 1. Tilemap Global (Pack 1 : Dirtywiggles Unys 5G)
    const tmGlobal = scene.make.tilemap({ tileWidth: 32, tileHeight: 32, width: mapW, height: mapH });
    const tsGlobal = tmGlobal.addTilesetImage('tileset_global', 'tileset_global', 32, 32, 0, 0);
    const groundLayer = tmGlobal.createBlankLayer('Ground', tsGlobal, 0, 0).setDepth(0);
    const roadWaterLayer = tmGlobal.createBlankLayer('RoadWater', tsGlobal, 0, 0).setDepth(2);
    const globalPropsLayer = tmGlobal.createBlankLayer('GlobalProps', tsGlobal, 0, 0).setDepth(4);
    const globalOverheadLayer = tmGlobal.createBlankLayer('GlobalOverhead', tsGlobal, 0, 0).setDepth(25);

    // 2. Tilemap Nature (Pack 3 : Relic Castle / Paradigmi Nature 5G)
    const tmNature = scene.make.tilemap({ tileWidth: 32, tileHeight: 32, width: mapW, height: mapH });
    const tsNature = tmNature.addTilesetImage('tileset_nature', 'tileset_nature', 32, 32, 0, 0);
    const natureRouteLayer = tmNature.createBlankLayer('NatureRoute', tsNature, 0, 0).setDepth(2.5);
    const natureFloraLayer = tmNature.createBlankLayer('NatureFlora', tsNature, 0, 0).setDepth(4.2);
    const natureOverheadLayer = tmNature.createBlankLayer('NatureOverhead', tsNature, 0, 0).setDepth(24);

    // 3. Tilemap Buildings (Pack 2 : WesleyFG Bâtiments 5G)
    const tmBuildings = scene.make.tilemap({ tileWidth: 32, tileHeight: 32, width: mapW, height: mapH });
    const tsBuildings = tmBuildings.addTilesetImage('tileset_buildings', 'tileset_buildings', 32, 32, 0, 0);
    const buildingBaseLayer = tmBuildings.createBlankLayer('BuildingsBase', tsBuildings, 0, 0).setDepth(5);
    const buildingRoofLayer = tmBuildings.createBlankLayer('BuildingsRoof', tsBuildings, 0, 0).setDepth(26);

    this.activeTilemaps.push(tmGlobal, tmNature, tmBuildings);

    // --- A. Pelouse 5G Unys + Fleurs sauvages sur toute la carte 64x64 ---
    const g00 = globalIdx(0, 99);
    const g10 = globalIdx(1, 99);
    const g01 = globalIdx(0, 100);
    const g11 = globalIdx(1, 100);
    const flPink = globalIdx(5, 302);
    const flOrange = globalIdx(5, 307);

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const gTile = (y % 2 === 0)
          ? (x % 2 === 0 ? g00 : g10)
          : (x % 2 === 0 ? g01 : g11);
        groundLayer.putTileAt(gTile, x, y);

        if (grid[y][x] === TILE.GRASS && ((x * 11 + y * 17) % 23 === 0)) {
          globalPropsLayer.putTileAt((x + y) % 2 === 0 ? flPink : flOrange, x, y);
        }
      }
    }

    // Helper 9-slice pour les places pavées et plans d'eau
    const fill9SliceGlobal = (layer, rx, ry, rw, rh, c0, r0) => {
      for (let dy = 0; dy < rh; dy++) {
        for (let dx = 0; dx < rw; dx++) {
          const cx = dx === 0 ? c0 : (dx === rw - 1 ? c0 + 2 : c0 + 1);
          const cy = dy === 0 ? r0 : (dy === rh - 1 ? r0 + 2 : r0 + 1);
          layer.putTileAt(globalIdx(cx, cy), rx + dx, ry + dy);
        }
      }
    };

    // --- B. Places pavées du Village de départ et de la Cité d'Ogoesse ---
    for (const r of WORLD_REGIONS.cobblePlazas) {
      fill9SliceGlobal(roadWaterLayer, r.x, r.y, r.w, r.h, 3, 103);
    }
    for (const r of WORLD_REGIONS.brickPlazas) {
      fill9SliceGlobal(roadWaterLayer, r.x, r.y, r.w, r.h, 0, 123);
    }

    // --- C. Réseau connecté de la Grande Route 1 en terre battue (Pack 3 Nature C0..C2, R10..R12) ---
    const dirtMask = Array.from({ length: mapH }, () => new Uint8Array(mapW));
    for (const r of WORLD_REGIONS.dirtRoutes) {
      for (let y = r.y; y < r.y + r.h; y++) {
        for (let x = r.x; x < r.x + r.w; x++) {
          if (y >= 0 && y < mapH && x >= 0 && x < mapW) dirtMask[y][x] = 1;
        }
      }
    }
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (!dirtMask[y][x]) continue;
        const up = y > 0 && dirtMask[y - 1][x];
        const dn = y < mapH - 1 && dirtMask[y + 1][x];
        const lt = x > 0 && dirtMask[y][x - 1];
        const rt = x < mapW - 1 && dirtMask[y][x + 1];
        const cx = !lt ? 0 : (!rt ? 2 : 1);
        const cy = !up ? 10 : (!dn ? 12 : 11);
        natureRouteLayer.putTileAt(natureIdx(cx, cy), x, y);
      }
    }

    // --- D. Rivière d'Unys, Lac du Sud & Pont en bois 3x4 ---
    for (const w of WORLD_REGIONS.waterBodies) {
      fill9SliceGlobal(roadWaterLayer, w.x, w.y, w.w, w.h, 0, 161);
    }
    for (const b of WORLD_REGIONS.bridges) {
      for (let dy = 0; dy < b.h; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          natureFloraLayer.putTileAt(natureIdx(3 + dx, 38 + dy), b.x + dx, b.y + dy);
        }
      }
    }

    // --- E. Zones de Hautes Herbes 5G (combinant Pack 1 Global & Pack 3 Nature) ---
    for (const tg of WORLD_REGIONS.tallGrassZones) {
      for (let dy = 0; dy < tg.h; dy++) {
        for (let dx = 0; dx < tg.w; dx++) {
          const tx = tg.x + dx;
          const ty = tg.y + dy;
          if (grid[ty][tx] !== TILE.GRASS_TALL) continue;
          if (tg.style === 'nature') {
            natureFloraLayer.putTileAt(natureIdx(3 + (dx % 4), 12 + (dy % 4)), tx, ty);
          } else if (tg.style === 'unova_dark') {
            globalPropsLayer.putTileAt(globalIdx(dx % 4, 175 + (dy % 3)), tx, ty);
          } else {
            globalPropsLayer.putTileAt(globalIdx(dx % 4, 172 + (dy % 3)), tx, ty);
          }
        }
      }
    }

    // --- F. Fontaine d'Unys 4x4, Parterres de fleurs 3x3, Lampadaires & Clôtures ---
    for (const f of WORLD_PROPS.fountains) {
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 4; dx++) {
          const layer = dy === 0 ? globalOverheadLayer : globalPropsLayer;
          layer.putTileAt(globalIdx(4 + dx, 358 + dy), f.x + dx, f.y + dy);
        }
      }
    }
    for (const fb of WORLD_PROPS.flowerBeds) {
      for (let dy = 0; dy < 3; dy++) {
        for (let dx = 0; dx < 3; dx++) {
          globalPropsLayer.putTileAt(globalIdx(dx, 355 + dy), fb.x + dx, fb.y + dy);
        }
      }
    }
    for (const l of WORLD_PROPS.lamps) {
      // Lampadaire 1x3 (haut en overhead, pied au sol)
      globalOverheadLayer.putTileAt(globalIdx(3, 363), l.x, l.y - 2);
      globalOverheadLayer.putTileAt(globalIdx(3, 364), l.x, l.y - 1);
      globalPropsLayer.putTileAt(globalIdx(3, 365), l.x, l.y);
    }
    for (const fl of WORLD_PROPS.fenceLines) {
      for (let i = 0; i < fl.len; i++) {
        const fx = fl.dir === 'h' ? fl.x + i : fl.x;
        const fy = fl.dir === 'v' ? fl.y + i : fl.y;
        if (fl.style === 'white') {
          globalPropsLayer.putTileAt(globalIdx(1, 281), fx, fy);
        } else {
          globalPropsLayer.putTileAt(globalIdx(1, 285), fx, fy);
        }
      }
    }

    // Panneaux directionnels (Pack 3 Nature C7, R3)
    for (const coord of Object.keys(SIGNPOSTS)) {
      const [sx, sy] = coord.split(',').map(Number);
      natureFloraLayer.putTileAt(natureIdx(7, 3), sx, sy);
    }

    // --- G. Forêts denses et Arbres 5G (Pack 1 Global C1..C2, R253..R256 & Pack 3 Nature) ---
    const stampUnovaTree = (tx, ty, autumn = false) => {
      const r0 = autumn ? 243 : 253;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const mx = tx + dx;
          const my = ty + dy;
          if (mx < 0 || mx >= mapW || my < 0 || my >= mapH) continue;
          const layer = dy < 2 ? globalOverheadLayer : globalPropsLayer;
          layer.putTileAt(globalIdx(1 + dx, r0 + dy), mx, my);
        }
      }
    };

    // Bordures forestières tout autour de la carte 64x64
    for (let y = 0; y < 60; y += 3) {
      stampUnovaTree(0, y, false);
      stampUnovaTree(2, y, true);
      stampUnovaTree(60, y, true);
      stampUnovaTree(62, y, false);
    }
    for (let x = 4; x < 60; x += 2) {
      stampUnovaTree(x, 0, x % 6 === 0);
      stampUnovaTree(x, 60, x % 4 === 0);
    }

    // Bosquets forestiers structurant le monde entre Renouet, la Route 1 et Ogoesse
    for (let y = 20; y <= 31; y += 3) {
      for (let x = 4; x <= 16; x += 2) {
        stampUnovaTree(x, y, (x + y) % 5 === 0);
      }
    }
    for (let y = 4; y <= 16; y += 3) {
      for (let x = 4; x <= 6; x += 2) {
        stampUnovaTree(x, y, false);
      }
      for (let x = 52; x <= 58; x += 2) {
        stampUnovaTree(x, y, (x + y) % 4 === 0);
      }
    }
    for (let y = 36; y <= 57; y += 3) {
      for (let x = 56; x <= 58; x += 2) {
        stampUnovaTree(x, y, false);
      }
    }
    for (let y = 55; y <= 57; y += 3) {
      for (let x = 26; x <= 52; x += 2) {
        stampUnovaTree(x, y, x % 6 === 0);
      }
    }

    // --- H. Bâtiments 5G issus de tileset_buildings.png (Pack 2 : WesleyFG) ---
    for (const b of WORLD_BUILDINGS) {
      for (let dy = 0; dy < b.h; dy++) {
        for (let dx = 0; dx < b.w; dx++) {
          const layer = dy < 2 ? buildingRoofLayer : buildingBaseLayer;
          layer.putTileAt(buildingIdx(b.bCol + dx, b.bRow + dy), b.x + dx, b.y + dy);
        }
      }
    }

    // --- I. Arbres à Baies / Citronniers interactifs ---
    for (const bt of WORLD_PROPS.berryTrees) {
      const key = `${bt.x},${bt.y}`;
      const sp = scene.add.image(bt.x * TILE_SIZE + 16, bt.y * TILE_SIZE + 16, 'tile_lemon_tree_ready');
      sp.setDisplaySize(32, 32).setDepth(6);
      scene.berrySprites.set(key, sp);
    }
  }

  _buildIndoorMap(scene, mapId, mapW, mapH, grid) {
    const floorKey = mapId === 'pokecenter' ? 'tile_floor_center'
      : mapId === 'pokemart' ? 'tile_floor_mart'
      : mapId === 'gym' ? 'tile_floor_gym'
      : 'tile_floor_wood';

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const px = x * TILE_SIZE + 16;
        const py = y * TILE_SIZE + 16;
        const fl = scene.add.image(px, py, floorKey).setDisplaySize(32, 32).setDepth(0);
        scene.worldLayerGroup.add(fl);

        const tile = grid[y][x];
        if (tile === TILE.WALL_INDOOR) {
          const w = scene.add.image(px, py, 'tile_wall_indoor').setDisplaySize(32, 32).setDepth(2);
          scene.worldLayerGroup.add(w);
        } else if (tile === TILE.EXIT_MAT) {
          const m = scene.add.image(px, py, 'tile_exit_mat').setDisplaySize(32, 32).setDepth(1);
          scene.worldLayerGroup.add(m);
        } else if (tile === TILE.BOOKSHELF) {
          const b = scene.add.image(px, py, 'tile_bookshelf').setDisplaySize(32, 32).setDepth(4);
          scene.worldLayerGroup.add(b);
        } else if (tile === TILE.POTTED_PLANT) {
          const p = scene.add.image(px, py, 'tile_potted_plant').setDisplaySize(32, 32).setDepth(4);
          scene.worldLayerGroup.add(p);
        } else if (tile === TILE.PC_BOX) {
          const pc = scene.add.image(px, py, 'tile_pc_box').setDisplaySize(32, 32).setDepth(4);
          scene.worldLayerGroup.add(pc);
        } else if (tile === TILE.LEMON_TREE) {
          const lt = scene.add.image(px, py, 'tile_lemon_tree_ready').setDisplaySize(32, 32).setDepth(4);
          scene.worldLayerGroup.add(lt);
        } else if (tile === TILE.LAB_TABLE) {
          const g = scene.add.graphics().setDepth(4);
          g.fillStyle(0x8a5a2e, 1);
          g.fillRect(x * TILE_SIZE + 1, y * TILE_SIZE + 4, 30, 24);
          g.fillStyle(0xd8b078, 1);
          g.fillRect(x * TILE_SIZE + 3, y * TILE_SIZE + 6, 26, 16);
          for (let i = 0; i < 3; i++) {
            g.fillStyle(0xef4444, 1);
            g.fillCircle(x * TILE_SIZE + 8 + i * 8, y * TILE_SIZE + 13, 3.5);
            g.fillStyle(0xffffff, 1);
            g.fillCircle(x * TILE_SIZE + 8 + i * 8, y * TILE_SIZE + 14.5, 2);
          }
          scene.worldLayerGroup.add(g);
        } else if (tile === TILE.NURSE_DESK) {
          if (grid[y][x - 1] !== TILE.NURSE_DESK) {
            const tr = scene.add.image((x + 0.5) * TILE_SIZE + 16, (y - 0.65) * TILE_SIZE + 16, 'tr_nurse');
            tr.setDisplaySize(36, 36).setDepth(3);
            scene.worldLayerGroup.add(tr);
          }
          const g = scene.add.graphics().setDepth(4);
          g.fillStyle(0x9a2038, 1);
          g.fillRect(x * TILE_SIZE, y * TILE_SIZE + 6, 32, 22);
          g.fillStyle(0xff6b8b, 1);
          g.fillRect(x * TILE_SIZE + 1, y * TILE_SIZE + 8, 30, 14);
          scene.worldLayerGroup.add(g);
        } else if (tile === TILE.MART_DESK) {
          if (grid[y][x - 1] !== TILE.MART_DESK) {
            const tr = scene.add.image((x + 0.5) * TILE_SIZE + 16, (y - 0.65) * TILE_SIZE + 16, 'tr_clerk');
            tr.setDisplaySize(36, 36).setDepth(3);
            scene.worldLayerGroup.add(tr);
          }
          const g = scene.add.graphics().setDepth(4);
          g.fillStyle(0x1b4b8a, 1);
          g.fillRect(x * TILE_SIZE, y * TILE_SIZE + 6, 32, 22);
          g.fillStyle(0x4898f0, 1);
          g.fillRect(x * TILE_SIZE + 1, y * TILE_SIZE + 8, 30, 14);
          scene.worldLayerGroup.add(g);
        }
      }
    }
  }

  _buildArcadeCollisionBodies(scene, mapW, mapH, grid) {
    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        if (isSolid(grid, x, y)) {
          const zone = scene.add.zone(x * TILE_SIZE + 16, y * TILE_SIZE + 16, TILE_SIZE, TILE_SIZE);
          scene.physics.add.existing(zone, true);
          scene.solidBodies.add(zone);
        }
      }
    }
  }

  _syncEntitiesInPhaser(scene, state) {
    const {
      map,
      mapId = 'outdoor',
      player,
      moveProgress = 0,
      remotePlayers = [],
      npcs = [],
      staticNpcs = [],
      lemonCooldowns = {}
    } = state;

    if (this.builtMapId !== mapId && map) {
      this._rebuildPhaserMap(scene, mapId, map);
    }

    // Mettre à jour l'état des arbres à baies
    if (mapId === 'outdoor' && scene.berrySprites) {
      const now = Date.now();
      for (const [key, sp] of scene.berrySprites.entries()) {
        const ready = !lemonCooldowns[key] || now >= lemonCooldowns[key];
        sp.setTexture(ready ? 'tile_lemon_tree_ready' : 'tile_lemon_tree_empty');
      }
    }

    // 1. Synchroniser le joueur principal (position interpolée fluide + animation de pas)
    const pRenderX = player.moving
      ? player.prevX + (player.x - player.prevX) * moveProgress
      : player.x;
    const pRenderY = player.moving
      ? player.prevY + (player.y - player.prevY) * moveProgress
      : player.y;

    const px = pRenderX * TILE_SIZE + 16;
    const py = pRenderY * TILE_SIZE + 16;
    const bob = player.moving ? Math.abs(Math.sin(moveProgress * Math.PI * 2)) * 4 : 0;

    scene.playerContainer.setPosition(px, py);
    scene.playerContainer.setDepth(10 + pRenderY * 0.05);
    scene.playerSprite.setTexture(player.avatar === 'green' ? 'tr_green' : 'tr_red');
    scene.playerSprite.setY(-4 - bob);
    scene.playerSprite.setFlipX(player.dir === 'right');

    // Masquage authentique du bas des jambes dans les hautes herbes
    const curTile = map && map[player.y] ? map[player.y][player.x] : 0;
    scene.playerGrassOverlay.setVisible(curTile === TILE.GRASS_TALL);

    // 2. Synchroniser les PNJ (statiques + dresseurs)
    const allNpcs = [
      ...staticNpcs.map(s => ({ ...s, isStatic: true })),
      ...npcs
    ];
    const activeNpcIds = new Set();

    for (const npc of allNpcs) {
      const npcId = npc.id || `${npc.name}_${npc.x}_${npc.y}`;
      activeNpcIds.add(npcId);

      let cont = scene.npcSprites.get(npcId);
      if (!cont) {
        cont = scene.add.container(npc.x * TILE_SIZE + 16, npc.y * TILE_SIZE + 16);
        const shadow = scene.add.ellipse(0, 12, 22, 9, 0x000000, 0.35);
        const spKey = `tr_${npc.spriteKey || npc.sprite || 'youngster'}`;
        const sp = scene.add.image(0, -4, spKey).setDisplaySize(38, 38);
        const badge = scene.add.text(0, -30, '', {
          fontFamily: '"Chakra Petch", sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: 'rgba(11,17,28,0.85)',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5);
        cont.add([shadow, sp, badge]);
        cont._sp = sp;
        cont._badge = badge;
        scene.npcSprites.set(npcId, cont);
      }

      cont.setPosition(npc.x * TILE_SIZE + 16, npc.y * TILE_SIZE + 16);
      cont.setDepth(10 + npc.y * 0.05);
      const defeated = player.defeatedTrainers && player.defeatedTrainers.includes(npc.id);
      cont._badge.setText(npc.isStatic ? npc.name : (defeated ? `${npc.name} (Vaincu)` : `! ${npc.name}`));
      cont._badge.setColor(defeated ? '#94a3b8' : (npc.isGymLeader ? '#ffcb05' : '#ffffff'));
    }

    for (const [id, cont] of scene.npcSprites.entries()) {
      if (!activeNpcIds.has(id)) {
        cont.destroy();
        scene.npcSprites.delete(id);
      }
    }

    // 3. Synchroniser les joueurs multijoueurs distants présents dans la même carte
    const activeRemoteIds = new Set();
    for (const rp of remotePlayers) {
      if ((rp.mapId || 'outdoor') !== mapId) continue;
      activeRemoteIds.add(rp.id);

      let cont = scene.remoteSprites.get(rp.id);
      if (!cont) {
        cont = scene.add.container(rp.x * TILE_SIZE + 16, rp.y * TILE_SIZE + 16);
        const shadow = scene.add.ellipse(0, 12, 22, 9, 0x000000, 0.35);
        const sp = scene.add.image(0, -4, rp.avatar === 'green' ? 'tr_green' : 'tr_red').setDisplaySize(38, 38);
        const badge = scene.add.text(0, -30, rp.name || 'Joueur', {
          fontFamily: '"Chakra Petch", sans-serif',
          fontSize: '10px',
          fontStyle: 'bold',
          color: '#38bdf8',
          backgroundColor: 'rgba(11,17,28,0.85)',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5, 0.5);
        cont.add([shadow, sp, badge]);
        cont._sp = sp;
        cont._badge = badge;
        scene.remoteSprites.set(rp.id, cont);
      }

      const rx = (rp.renderX !== undefined ? rp.renderX : rp.x) * TILE_SIZE + 16;
      const ry = (rp.renderY !== undefined ? rp.renderY : rp.y) * TILE_SIZE + 16;
      cont.setPosition(rx, ry);
      cont.setDepth(10 + (rp.y || 0) * 0.05);
      cont._sp.setTexture(rp.avatar === 'green' ? 'tr_green' : 'tr_red');
      cont._sp.setFlipX(rp.dir === 'right');
      cont._badge.setText(rp.name || 'Joueur');
    }

    for (const [id, cont] of scene.remoteSprites.entries()) {
      if (!activeRemoteIds.has(id)) {
        cont.destroy();
        scene.remoteSprites.delete(id);
      }
    }
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.ctx.imageSmoothingEnabled = false;
    if (this.game && this.game.scale) {
      this.game.scale.resize(w, h);
    }
  }

  render(state) {
    this.animTick++;
    this.state = state;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const {
      map,
      mapId = 'outdoor',
      mapName = 'Région d\'Unys (5G)',
      player,
      remotePlayers = [],
      npcs = [],
      activeDialogue = null,
      interactionHint = null
    } = state;

    const sameMapRemotes = remotePlayers.filter(r => (r.mapId || 'outdoor') === mapId);

    this.drawZoneBanner(ctx, player, mapName, sameMapRemotes.length);
    if (mapId === 'outdoor' && map) {
      this.drawMinimap(ctx, map, player, sameMapRemotes, npcs);
    }
    this.drawControlsHelp(ctx);

    if (interactionHint && !activeDialogue) {
      this.drawInteractionHint(ctx, interactionHint);
    }
    if (activeDialogue) {
      this.drawDialogueBox(ctx, activeDialogue);
    }
  }

  drawZoneBanner(ctx, player, mapName, onlineCount) {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 28, 0.9)';
    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(16, 16, 330, 88, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffcb05';
    ctx.font = 'bold 13px "Bungee", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mapName.toUpperCase(), 28, 38);

    const badgeText = player.badges && player.badges.includes('citron_dor') ? ' • BADGE OBTENU' : '';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 12px "Chakra Petch", sans-serif';
    ctx.fillText(`Dresseur : ${player.name} • ${player.money} P$${badgeText}`, 28, 58);

    const aliveCount = player.party.filter(p => !p.fainted && p.currentHp > 0).length;
    const dexCount = player.pokedex ? player.pokedex.caught.length : 0;
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `Équipe : ${aliveCount}/${player.party.length} • Dex : ${dexCount} • En ligne : ${onlineCount + 1}`,
      28,
      78
    );

    for (let i = 0; i < 6; i++) {
      const bx = 225 + i * 16;
      const by = 92;
      ctx.beginPath();
      ctx.arc(bx, by, 5, 0, Math.PI * 2);
      if (i < player.party.length) {
        const poke = player.party[i];
        ctx.fillStyle = poke.currentHp > 0 ? '#ef4444' : '#64748b';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
      }
      ctx.fill();
    }
    ctx.restore();
  }

  drawMinimap(ctx, map, player, remotePlayers, npcs) {
    const scale = 2.6;
    const mapH = map.length;
    const mapW = map[0].length;
    const mw = mapW * scale;
    const mh = mapH * scale;
    const mx = this.width - mw - 16;
    const my = 16;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 28, 0.9)';
    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(mx - 6, my - 6, mw + 12, mh + 26, 8);
    ctx.fill();
    ctx.stroke();

    for (let y = 0; y < mapH; y++) {
      for (let x = 0; x < mapW; x++) {
        const t = map[y][x];
        if (t === TILE.WATER) ctx.fillStyle = '#2880d8';
        else if (t === TILE.SAND) ctx.fillStyle = '#e8d088';
        else if (t === TILE.PATH_COBBLESTONE || t === TILE.BRIDGE) ctx.fillStyle = '#c8c8d0';
        else if (t === TILE.GRASS_TALL) ctx.fillStyle = '#207828';
        else if (t === TILE.DOOR) ctx.fillStyle = '#ffffff';
        else if (t === TILE.WALL_VILLA) ctx.fillStyle = '#e05040';
        else if (t === TILE.TREE_PINE) ctx.fillStyle = '#185020';
        else ctx.fillStyle = '#48b848';
        ctx.fillRect(mx + x * scale, my + y * scale, Math.ceil(scale), Math.ceil(scale));
      }
    }

    for (const npc of npcs) {
      ctx.fillStyle = npc.isGymLeader ? '#facc15' : '#f97316';
      ctx.fillRect(mx + npc.x * scale - 1, my + npc.y * scale - 1, 4, 4);
    }

    for (const rp of remotePlayers) {
      ctx.fillStyle = rp.color || '#38bdf8';
      ctx.fillRect(mx + rp.x * scale - 1, my + rp.y * scale - 1, 4, 4);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx + player.x * scale - 2, my + player.y * scale - 2, 5, 5);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 10px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CARTE D\'UNYS 64×64 (LABO • CITÉ • ARÈNE)', mx + mw / 2, my + mh + 13);
    ctx.restore();
  }

  drawControlsHelp(ctx) {
    const w = 440;
    const h = 32;
    const x = 16;
    const y = this.height - h - 14;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 28, 0.86)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '600 12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Flèches / ZQSD : Marcher • [ESPACE / ENTRÉE] : Entrer / Parler • [B] : Sac', x + 12, y + 20);
    ctx.restore();
  }

  drawInteractionHint(ctx, text) {
    ctx.save();
    ctx.font = 'bold 14px "Chakra Petch", sans-serif';
    const tw = ctx.measureText(text).width + 36;
    const x = (this.width - tw) / 2;
    const y = this.height - 155;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, tw, 36, 18);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffcb05';
    ctx.textAlign = 'center';
    ctx.fillText(text, this.width / 2, y + 23);
    ctx.restore();
  }

  drawDialogueBox(ctx, dialogue) {
    const boxW = Math.min(720, this.width - 40);
    const boxH = 120;
    const boxX = (this.width - boxW) / 2;
    const boxY = this.height - boxH - 24;

    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 28, 0.96)';
    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 12);
    ctx.fill();
    ctx.stroke();

    if (dialogue.speaker) {
      ctx.fillStyle = '#ffcb05';
      ctx.font = 'bold 14px "Bungee", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(dialogue.speaker.toUpperCase(), boxX + 22, boxY + 28);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '500 16px "Chakra Petch", sans-serif';
    ctx.textAlign = 'left';

    const lines = this.wrapText(ctx, dialogue.text || '', boxW - 44);
    lines.forEach((line, i) => {
      ctx.fillText(line, boxX + 22, boxY + 56 + i * 22);
    });

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px "Chakra Petch", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('[ESPACE / CLIC] Continuer ▼', boxX + boxW - 20, boxY + boxH - 14);
    ctx.restore();
  }

  wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const w of words) {
      const test = current ? `${current} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth) {
        if (current) lines.push(current);
        current = w;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  }

  destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }
}
