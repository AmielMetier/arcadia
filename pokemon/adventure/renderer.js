// pokemon/adventure/renderer.js
// Moteur de rendu PhaserJS 3 (WebGL / Canvas avec pixelArt: true, Arcade Physics & Camera Follow)
// utilisant les vraies cartes Pokémon complètes assemblées sous Tiled (Bourg-Palette + Route 1 + Jadielle
// en monde ouvert continu 50x100 de 32x32px + 4 intérieurs authentiques) et les vrais spritesheets
// de marche 4 directions × 3 frames (chars_overworld.png).

import {
  TILE_SIZE,
  TILE,
  WORLD_PROPS,
  isSolid
} from './map.js';
import { ADVENTURE_TRAINERS } from './data.js';

const CHAR_ROW_MAP = {
  red: 0,
  green: 1,
  prof: 2,
  nurse: 3,
  clerk: 4,
  youngster: 5,
  lass: 6,
  sailor: 7,
  hiker: 8,
  cooltrainer_f: 9
};

const DIR_INDEX_MAP = {
  down: 0,
  left: 1,
  right: 2,
  up: 3
};

function computeCharFrame(spriteKey, dir = 'down', isMoving = false, phase = 0) {
  const row = CHAR_ROW_MAP[spriteKey] !== undefined ? CHAR_ROW_MAP[spriteKey] : 0;
  const dirIdx = DIR_INDEX_MAP[dir] !== undefined ? DIR_INDEX_MAP[dir] : 0;
  let stepCol = 1; // Posture arrêtée au centre
  if (isMoving) {
    const cycle = Math.floor(phase * 4) % 4;
    stepCol = cycle === 0 ? 0 : (cycle === 2 ? 2 : 1);
  }
  return row * 12 + dirIdx * 3 + stepCol;
}

export class AdventureRenderer {
  constructor(hudCanvas) {
    this.canvas = hudCanvas;
    this.ctx = hudCanvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;

    this.width = hudCanvas.width || window.innerWidth;
    this.height = hudCanvas.height || window.innerHeight;
    this.animTick = 0;

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
    this.canvas.style.cssText = 'position:absolute;inset:0;z-index:5;pointer-events:none;width:100%;height:100%;';

    const self = this;

    class PokemonWorldScene extends window.Phaser.Scene {
      constructor() {
        super({ key: 'PokemonWorldScene' });
      }

      preload() {
        // 1. Cartes complètes pré-assemblées sous Tiled (Extérieur 50x100 + Calque 2.5D Toits/Arbres + 4 Intérieurs)
        this.load.image('map_outdoor_base', 'assets/graphics/map_outdoor_base.png');
        this.load.image('map_outdoor_overhead', 'assets/graphics/map_outdoor_overhead.png');
        this.load.image('map_lab', 'assets/graphics/map_lab.png');
        this.load.image('map_pokecenter', 'assets/graphics/map_pokecenter.png');
        this.load.image('map_pokemart', 'assets/graphics/map_pokemart.png');
        this.load.image('map_gym', 'assets/graphics/map_gym.png');

        // 2. Spritesheet officiel 4 directions × 3 frames (24x32 par frame, 12 colonnes × 10 personnages)
        this.load.spritesheet('chars_overworld', 'assets/graphics/chars_overworld.png', {
          frameWidth: 24,
          frameHeight: 32
        });

        // 3. Sprites d'objets interactifs (Citronniers / Arbres à Baies & Hautes Herbes)
        this.load.image('tile_lemon_tree_ready', 'assets/tiles/lemon_tree_ready.png');
        this.load.image('tile_lemon_tree_empty', 'assets/tiles/lemon_tree_empty.png');
        this.load.image('tile_grass_tall_tips', 'assets/tiles/grass_tall_tips.png');
      }

      create() {
        self.scene = this;
        self.phaserReady = true;

        this.worldLayerGroup = this.add.group();
        this.solidBodies = this.physics.add.staticGroup();
        this.npcSprites = new Map();
        this.remoteSprites = new Map();
        this.berrySprites = new Map();

        // Créer le conteneur du joueur avec Arcade Physics et Spritesheet 4 directions
        this.playerContainer = this.add.container(28 * TILE_SIZE + 16, 94 * TILE_SIZE + 16);
        this.playerContainer.setDepth(15);

        this.playerShadow = this.add.ellipse(0, 12, 20, 8, 0x000000, 0.36);
        this.playerSprite = this.add.sprite(0, -4, 'chars_overworld', computeCharFrame('red', 'up', false));
        this.playerSprite.setDisplaySize(32, 42);

        this.playerGrassOverlay = this.add.image(0, 5, 'tile_grass_tall_tips');
        this.playerGrassOverlay.setDisplaySize(32, 32);
        this.playerGrassOverlay.setVisible(false);

        this.playerContainer.add([this.playerShadow, this.playerSprite, this.playerGrassOverlay]);

        // Activer Arcade Physics sur le joueur et collision avec les obstacles solides
        this.physics.world.enable(this.playerContainer);
        this.playerContainer.body.setSize(22, 22);
        this.playerContainer.body.setOffset(-11, -5);
        this.physics.add.collider(this.playerContainer, this.solidBodies);

        // Caméra Phaser fluide avec filtrage Nearest Neighbor strict
        this.cameras.main.setRoundPixels(true);
        this.cameras.main.setZoom(1.85);
        this.cameras.main.startFollow(this.playerContainer, true, 0.18, 0.18);

        if (self.state && self.state.map) {
          self._rebuildPhaserMap(this, self.state.mapId || 'outdoor', self.state.map);
        }
      }

      update() {
        if (!self.state || !self.state.player) return;
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
      scene: [PokemonWorldScene]
    });
  }

  _clearCurrentMap(scene) {
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
      // 1. Calque de base de la carte Tiled 50x100 (1600x3200px)
      const baseImg = scene.add.image(0, 0, 'map_outdoor_base').setOrigin(0, 0).setDepth(1);
      scene.worldLayerGroup.add(baseImg);

      // 2. Calque supérieur (Toits des bâtiments & cimes des arbres) au-dessus du joueur (depth 25)
      const overImg = scene.add.image(0, 0, 'map_outdoor_overhead').setOrigin(0, 0).setDepth(25);
      scene.worldLayerGroup.add(overImg);

      // 3. Arbres à Baies / Citronniers interactifs
      for (const bt of WORLD_PROPS.berryTrees) {
        const key = `${bt.x},${bt.y}`;
        const sp = scene.add.image(bt.x * TILE_SIZE + 16, bt.y * TILE_SIZE + 16, 'tile_lemon_tree_ready');
        sp.setDisplaySize(32, 32).setDepth(6);
        scene.berrySprites.set(key, sp);
      }

      scene.cameras.main.setZoom(1.85);
      scene.cameras.main.setBounds(0, 0, mapW * TILE_SIZE, mapH * TILE_SIZE);
      scene.cameras.main.setBackgroundColor('#1e4620');
    } else {
      // Intérieurs authentiques : lab, pokecenter, pokemart, gym
      const texKey = `map_${mapId}`;
      const roomImg = scene.add.image(0, 0, texKey).setOrigin(0, 0).setDepth(1);
      scene.worldLayerGroup.add(roomImg);

      // Ajouter les employés derrière leur comptoir avec le vrai spritesheet 4 directions
      if (mapId === 'pokecenter') {
        const nurse = scene.add.sprite(5.5 * TILE_SIZE + 16, 1.5 * TILE_SIZE + 4, 'chars_overworld', computeCharFrame('nurse', 'down', false));
        nurse.setDisplaySize(32, 42).setDepth(3);
        scene.worldLayerGroup.add(nurse);
      } else if (mapId === 'pokemart') {
        const clerk = scene.add.sprite(1.5 * TILE_SIZE + 12, 3 * TILE_SIZE + 8, 'chars_overworld', computeCharFrame('clerk', 'right', false));
        clerk.setDisplaySize(32, 42).setDepth(3);
        scene.worldLayerGroup.add(clerk);
      }

      scene.cameras.main.setZoom(2.15);
      const pad = 256;
      scene.cameras.main.setBounds(-pad, -pad, mapW * TILE_SIZE + pad * 2, mapH * TILE_SIZE + pad * 2);
      scene.cameras.main.setBackgroundColor('#090e18');
    }

    this._buildArcadeCollisionBodies(scene, mapW, mapH, grid);
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
      remotePlayers = [],
      npcs = [],
      staticNpcs = []
    } = state;

    if (!player) return;

    if (this.builtMapId !== mapId && map) {
      this._rebuildPhaserMap(scene, mapId, map);
    }

    const lemonCooldowns = player.lemonCooldowns || {};
    if (mapId === 'outdoor' && scene.berrySprites) {
      const now = Date.now();
      for (const [key, sp] of scene.berrySprites.entries()) {
        const ready = !lemonCooldowns[key] || now >= lemonCooldowns[key];
        sp.setTexture(ready ? 'tile_lemon_tree_ready' : 'tile_lemon_tree_empty');
      }
    }

    // 1. Synchroniser le joueur principal (spritesheet 4 directions × 3 frames de marche)
    const pRenderX = player.visualX !== undefined ? player.visualX : player.x;
    const pRenderY = player.visualY !== undefined ? player.visualY : player.y;

    const px = pRenderX * TILE_SIZE + 16;
    const py = pRenderY * TILE_SIZE + 16;
    const stepPhase = Math.abs(pRenderX + pRenderY);

    scene.playerContainer.setPosition(px, py);
    scene.playerContainer.setDepth(10 + pRenderY * 0.05);

    const avatarKey = player.avatar === 'green' ? 'green' : 'red';
    const pFrame = computeCharFrame(avatarKey, player.dir || 'down', !!player.moving, stepPhase);
    scene.playerSprite.setFrame(pFrame);

    const curTile = map && map[player.y] ? map[player.y][player.x] : 0;
    scene.playerGrassOverlay.setVisible(curTile === TILE.GRASS_TALL);

    // 2. Synchroniser les PNJ (statiques + dresseurs) avec leur orientation 4 directions
    const allNpcs = [
      ...staticNpcs.map(s => ({ ...s, isStatic: true })),
      ...npcs
    ];
    const activeNpcIds = new Set();

    for (const npc of allNpcs) {
      const npcId = npc.id || `${npc.name}_${npc.x}_${npc.y}`;
      activeNpcIds.add(npcId);

      const spKey = npc.spriteKey || npc.sprite || 'youngster';
      const nFrame = computeCharFrame(spKey, npc.dir || 'down', false, 0);

      let cont = scene.npcSprites.get(npcId);
      if (!cont) {
        cont = scene.add.container(npc.x * TILE_SIZE + 16, npc.y * TILE_SIZE + 16);
        const shadow = scene.add.ellipse(0, 12, 20, 8, 0x000000, 0.35);
        const sp = scene.add.sprite(0, -4, 'chars_overworld', nFrame).setDisplaySize(32, 42);
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
      cont._sp.setFrame(nFrame);
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

    // 3. Synchroniser les joueurs multijoueurs distants (4 directions + animation de marche)
    const activeRemoteIds = new Set();
    for (const rp of remotePlayers) {
      if ((rp.mapId || 'outdoor') !== mapId) continue;
      activeRemoteIds.add(rp.id);

      const rRenderX = rp.renderX !== undefined ? rp.renderX : rp.x;
      const rRenderY = rp.renderY !== undefined ? rp.renderY : rp.y;
      const rMoving = Math.hypot((rRenderX - rp.x), (rRenderY - rp.y)) > 0.04;
      const rKey = rp.avatar === 'green' ? 'green' : 'red';
      const rFrame = computeCharFrame(rKey, rp.dir || 'down', rMoving, Math.abs(rRenderX + rRenderY));

      let cont = scene.remoteSprites.get(rp.id);
      if (!cont) {
        cont = scene.add.container(rRenderX * TILE_SIZE + 16, rRenderY * TILE_SIZE + 16);
        const shadow = scene.add.ellipse(0, 12, 20, 8, 0x000000, 0.35);
        const sp = scene.add.sprite(0, -4, 'chars_overworld', rFrame).setDisplaySize(32, 42);
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

      cont.setPosition(rRenderX * TILE_SIZE + 16, rRenderY * TILE_SIZE + 16);
      cont.setDepth(10 + (rp.y || 0) * 0.05);
      cont._sp.setFrame(rFrame);
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

  render(rawState) {
    this.animTick++;
    if (!rawState) return;

    const mapId = rawState.mapId || 'outdoor';
    const map = rawState.grid || rawState.map;
    const player = rawState.localPlayer || rawState.player;
    if (!player) return;

    const mapName = rawState.activeZoneName || rawState.mapName || 'Bourg-Palette';
    const questText = rawState.questText || '';
    const remotePlayers = rawState.remotePlayers || [];
    const staticNpcs = rawState.staticNpcs || [];
    const npcs = rawState.npcs || ADVENTURE_TRAINERS.filter(tr => (tr.mapId || 'outdoor') === mapId);
    const activeDialogue = rawState.dialogueBox !== undefined ? rawState.dialogueBox : rawState.activeDialogue;
    const targetObj = rawState.interactiveTarget !== undefined ? rawState.interactiveTarget : rawState.interactionHint;
    const interactionHint = targetObj
      ? (typeof targetObj === 'string' ? targetObj : `[ESPACE] ${targetObj.label || 'Interagir'}`)
      : null;

    this.state = {
      mapId,
      map,
      player,
      mapName,
      questText,
      remotePlayers,
      staticNpcs,
      npcs,
      activeDialogue,
      interactionHint
    };

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    const sameMapRemotes = remotePlayers.filter(r => (r.mapId || 'outdoor') === mapId);

    this.drawZoneBanner(ctx, player, mapName, questText, sameMapRemotes.length);
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

  drawZoneBanner(ctx, player, mapName, questText, onlineCount) {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 17, 28, 0.9)';
    ctx.strokeStyle = '#ffcb05';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(16, 16, 360, 96, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffcb05';
    ctx.font = 'bold 13px "Bungee", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(mapName.toUpperCase(), 28, 38);

    const badgeText = player.badges && player.badges.includes('citron_dor') ? ' • BADGE OBTENU' : '';
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 12px "Chakra Petch", sans-serif';
    ctx.fillText(`Dresseur : ${player.name} • ${player.money} P$${badgeText}`, 28, 57);

    const party = player.party || [];
    const aliveCount = party.filter(p => !p.fainted && p.currentHp > 0).length;
    const dexCount = player.pokedex && player.pokedex.caught ? player.pokedex.caught.length : 0;
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(
      `Équipe : ${aliveCount}/${party.length} • Dex : ${dexCount} • En ligne : ${onlineCount + 1}`,
      28,
      75
    );

    if (questText) {
      ctx.fillStyle = '#fde047';
      ctx.font = '700 11px "Chakra Petch", sans-serif';
      ctx.fillText(questText, 28, 95);
    }

    for (let i = 0; i < 6; i++) {
      const bx = 278 + i * 14;
      const by = 34;
      ctx.beginPath();
      ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
      if (i < party.length) {
        const poke = party[i];
        ctx.fillStyle = poke.currentHp > 0 ? '#ef4444' : '#64748b';
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
      }
      ctx.fill();
    }
    ctx.restore();
  }

  drawMinimap(ctx, map, player, remotePlayers, npcs) {
    const scaleX = 2.4;
    const scaleY = 1.65;
    const mapH = map.length;
    const mapW = map[0].length;
    const mw = mapW * scaleX;
    const mh = mapH * scaleY;
    const mx = this.width - mw - 16;
    const my = 56;

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
        else if (t === TILE.PATH_COBBLESTONE || t === TILE.BRIDGE) ctx.fillStyle = '#d6c894';
        else if (t === TILE.GRASS_TALL) ctx.fillStyle = '#207828';
        else if (t === TILE.DOOR) ctx.fillStyle = '#ffffff';
        else if (t === TILE.WALL_VILLA) ctx.fillStyle = '#e05040';
        else if (t === TILE.TREE_PINE) ctx.fillStyle = '#185020';
        else ctx.fillStyle = '#58c058';
        ctx.fillRect(mx + x * scaleX, my + y * scaleY, Math.ceil(scaleX), Math.ceil(scaleY));
      }
    }

    for (const npc of npcs) {
      ctx.fillStyle = npc.isGymLeader ? '#facc15' : '#f97316';
      ctx.fillRect(mx + npc.x * scaleX - 1, my + npc.y * scaleY - 1, 4, 4);
    }

    for (const rp of remotePlayers) {
      ctx.fillStyle = rp.color || '#38bdf8';
      ctx.fillRect(mx + rp.x * scaleX - 1, my + rp.y * scaleY - 1, 4, 4);
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mx + player.x * scaleX - 2, my + player.y * scaleY - 2, 5, 5);

    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px "Chakra Petch", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('BOURG-PALETTE • ROUTE 1 • JADIELLE', mx + mw / 2, my + mh + 13);
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
    const paragraphs = String(text || '').split('\n');
    const lines = [];
    for (const para of paragraphs) {
      const words = para.split(' ');
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
    }
    return lines;
  }

  destroy() {
    if (this.game) {
      this.game.destroy(true);
      this.game = null;
    }
  }
}
