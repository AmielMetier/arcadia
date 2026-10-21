// ============================================================================
// OUTBREAK : SECTEUR ZÉRO - MAIN GAME ENGINE & MULTIPLAYER CONTROLLER
// ============================================================================

import { SoundEngine } from './audio.js';
import { WEAPON_TYPES, PICKUP_TYPES } from './weapons.js';
import { SECTOR_TYPES, MapRoom } from './map-rooms.js';
import { ZOMBIE_TYPES, Zombie } from './zombies.js';
import { CartoonGraphics } from './graphics.js';

// Safe round rectangle fallback
function drawSafeRoundRect(ctx, x, y, w, h, r) {
  if (w <= 0 || h <= 0) return;
  if (r > w / 2) r = w / 2;
  if (r > h / 2) r = h / 2;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

export class OutbreakGame {
  constructor(canvas, uiContainer) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.ui = uiContainer;

    // Canvas hors-écran pour le sang persistant et les impacts sans baisse de framerate
    this.bloodCanvas = document.createElement('canvas');
    this.bloodCtx = this.bloodCanvas.getContext('2d');
    this.bloodCtx.imageSmoothingEnabled = false;

    // Moteur audio
    this.audio = new SoundEngine();

    // Dimensions
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.resize();

    // État de la caméra (centrée sur le joueur local)
    this.camera = { x: 0, y: 0, targetX: 0, targetY: 0, zoom: 1.0, shake: 0 };

    // État du jeu
    this.running = false;
    this.lastTime = performance.now();
    this.gameTime = 0;
    this.score = 0;
    this.totalKills = 0;
    this.roomsCleared = 0;
    this.gameOver = false;
    this.gameWon = false;

    // Salle actuelle
    this.currentSectorIndex = 1;
    this.mapRoom = new MapRoom({ sectorId: 'decontamination', roomIndex: 1 });
    this.initBloodCanvas();

    // Vagues de zombies
    this.wave = {
      active: true,
      phase: 1,
      totalToSpawn: 18,
      spawnedCount: 0,
      spawnTimer: 1.0,
      spawnInterval: 1.6,
      cleared: false
    };

    // Entités
    this.players = new Map(); // id -> Player
    this.localPlayerId = 'p_local_' + Math.random().toString(36).substr(2, 6);
    this.zombies = [];
    this.projectiles = [];
    this.pickups = [];
    this.particles = [];
    this.acidPuddles = [];

    // Joueur local
    this.initLocalPlayer();

    // Contrôles
    this.keys = {};
    this.mouse = { x: this.width / 2, y: this.height / 2, worldX: 0, worldY: 0, isDown: false, rightDown: false };

    // Réseau HubBridge
    this.bridge = window.HubBridge || null;
    this.isHost = true;
    this.lastNetSync = 0;

    this.bindEvents();
    this.setupNetwork();
    this.startRoom(1, 'decontamination');
  }

  initBloodCanvas() {
    this.bloodCanvas.width = this.mapRoom.width;
    this.bloodCanvas.height = this.mapRoom.height;
    this.bloodCtx.imageSmoothingEnabled = false;
    this.bloodCtx.clearRect(0, 0, this.bloodCanvas.width, this.bloodCanvas.height);
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx.imageSmoothingEnabled = false;
  }

  initLocalPlayer() {
    const playerColors = ['#00e5ff', '#ffb300', '#00e676', '#e040fb', '#ff5252'];
    const p = {
      id: this.localPlayerId,
      name: 'Agent Delta',
      color: playerColors[0],
      x: this.mapRoom.width / 2,
      y: this.mapRoom.height / 2 + 100,
      vx: 0,
      vy: 0,
      radius: 18,
      speed: 260,
      hp: 100,
      maxHp: 100,
      armor: 50,
      maxArmor: 100,
      stamina: 100,
      maxStamina: 100,
      isDowned: false,
      downedTimer: 30.0,
      reviveProgress: 0,
      isReviving: false,
      reviveTargetId: null,
      soloAdrenalineCharges: 1, // Réanimation automatique solo
      // Roulade d'esquive
      isDodging: false,
      dodgeTimer: 0,
      dodgeCooldown: 0,
      dodgeAngle: 0,
      // Arsenal
      weapons: ['pistol', 'shotgun'],
      activeWeaponIndex: 0,
      magAmmo: {
        pistol: WEAPON_TYPES.pistol.magSize,
        shotgun: WEAPON_TYPES.shotgun.magSize,
        smg: WEAPON_TYPES.smg.magSize,
        rifle: WEAPON_TYPES.rifle.magSize,
        grenade_launcher: WEAPON_TYPES.grenade_launcher.magSize
      },
      reserves: {
        pistol: 120,
        shotgun: 32,
        smg: 90,
        rifle: 60,
        grenade_launcher: 4
      },
      fireCooldown: 0,
      isReloading: false,
      reloadTimer: 0,
      reloadDuration: 1.0,
      muzzleFlashTimer: 0,
      aimAngle: 0
    };

    p.takeDamage = (amount, angle) => {
      if (p.isDodging || p.hp <= 0) return;
      this.camera.shake = Math.min(15, this.camera.shake + 6.0);
      this.audio.playHit();

      // L'armure absorbe 60% des dégâts
      if (p.armor > 0) {
        const absorbed = Math.min(p.armor, amount * 0.6);
        p.armor -= absorbed;
        amount -= absorbed;
      }
      p.hp -= amount;

      if (p.hp <= 0) {
        p.hp = 0;
        p.isDowned = true;
        p.downedTimer = 30.0;
        this.audio.playZombieGroan('titan');
        this.createBloodSplatter(p.x, p.y, 8);
      }
    };

    this.players.set(this.localPlayerId, p);
  }

  startRoom(roomIndex, sectorId) {
    this.currentSectorIndex = roomIndex;
    this.mapRoom = new MapRoom({ sectorId, roomIndex });
    this.initBloodCanvas();

    // Replacer tous les joueurs près du centre / sas d'entrée
    for (const p of this.players.values()) {
      p.x = this.mapRoom.width / 2 + (Math.random() - 0.5) * 60;
      p.y = this.mapRoom.height - this.mapRoom.wallThickness - 90;
      p.vx = 0;
      p.vy = 0;
      // Bonus de ravitaillement entre les salles
      if (p.isDowned) {
        p.isDowned = false;
        p.hp = 50;
      }
    }

    // Calcul du nombre de zombies selon la salle et les joueurs
    const playerCount = Math.max(1, this.players.size);
    const isBossRoom = sectorId === 'boss_core';
    const baseZombies = isBossRoom ? 1 : 16 + roomIndex * 6 + (playerCount - 1) * 8;

    this.wave = {
      active: true,
      phase: 1,
      totalToSpawn: baseZombies,
      spawnedCount: 0,
      spawnTimer: 1.5,
      spawnInterval: Math.max(0.7, 2.0 - roomIndex * 0.22),
      cleared: false,
      isBossRoom
    };

    this.zombies = [];
    this.projectiles = [];
    this.acidPuddles = [];
    this.pickups = [];

    // Si salle de Boss, instancier immédiatement Spécimen Zéro au centre
    if (isBossRoom) {
      const boss = new Zombie('boss', this.mapRoom.width / 2, this.mapRoom.height / 2 - 120, 1.0 + (playerCount - 1) * 0.4);
      this.zombies.push(boss);
      this.wave.spawnedCount = 1;
    } else {
      // Faire apparaître immédiatement des zombies visibles dès le départ en face du joueur !
      const p = this.players.get(this.localPlayerId);
      const py = p ? p.y : this.mapRoom.height - 140;
      this.spawnZombieWaveMember({ x: this.mapRoom.width / 2 - 110, y: py - 240 });
      this.spawnZombieWaveMember({ x: this.mapRoom.width / 2 + 110, y: py - 240 });
      this.spawnZombieWaveMember();
      this.spawnZombieWaveMember();
    }

    // Jouer alarme de confinement
    this.audio.playAlarm();

    // Générer quelques caisses de munitions de départ dans la pièce
    if (sectorId === 'armory') {
      this.spawnPickup('weapon_drop', this.mapRoom.width / 2, this.mapRoom.height / 2, 'rifle');
      this.spawnPickup('ammo_large', this.mapRoom.width / 2 - 80, this.mapRoom.height / 2);
    } else if (sectorId === 'medbay') {
      this.spawnPickup('medkit', this.mapRoom.width / 2 - 60, this.mapRoom.height / 2);
      this.spawnPickup('armor', this.mapRoom.width / 2 + 60, this.mapRoom.height / 2);
    } else {
      this.spawnPickup('ammo_small', this.mapRoom.width / 2, this.mapRoom.height / 2);
    }
  }

  spawnPickup(typeId, x, y, extraWeapon = null) {
    const config = PICKUP_TYPES[typeId] || PICKUP_TYPES.ammo_small;
    this.pickups.push({
      id: 'pk_' + Math.random().toString(36).substr(2, 8),
      typeId,
      x,
      y,
      radius: 16,
      config,
      extraWeapon,
      bobTimer: Math.random() * Math.PI * 2
    });
  }

  createBloodSplatter(x, y, count = 12, isAcid = false) {
    const palette = isAcid 
      ? ['#365314', '#4d7c0f', '#65a30d', '#84cc16', '#a3e635']
      : ['#450a0a', '#7f1d1d', '#991b1b', '#b91c1c', '#dc2626', '#ef4444'];

    // Tamponner des clusters de pixels carrés 16-bit (Dead Ahead & Nearly Dead style)
    this.bloodCtx.save();
    this.bloodCtx.imageSmoothingEnabled = false;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 46;
      // Alignement strict sur grille de pixels 4x4
      const px = Math.floor((x + Math.cos(angle) * dist) / 4) * 4;
      const py = Math.floor((y + Math.sin(angle) * dist) / 4) * 4;
      const size = (1 + Math.floor(Math.random() * 3)) * 4; // 4, 8 ou 12 px

      this.bloodCtx.fillStyle = palette[Math.floor(Math.random() * palette.length)];
      this.bloodCtx.fillRect(px, py, size, size);
      if (Math.random() < 0.5) {
        this.bloodCtx.fillRect(px + 4, py - 4, 4, 4);
      }
    }
    this.bloodCtx.restore();

    // Particules dynamiques éphémères de projection pixel 16-bit
    for (let i = 0; i < count * 2; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 80 + Math.random() * 220;
      this.particles.push({
        x: Math.floor(x),
        y: Math.floor(y),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: 2 + Math.floor(Math.random() * 3),
        color: palette[Math.floor(Math.random() * palette.length)],
        lifetime: 0.3 + Math.random() * 0.35,
        maxLife: 0.65
      });
    }
  }

  createExplosion(x, y, radius = 120, damage = 160, isToxic = false) {
    this.camera.shake = 14;
    this.audio.playExplosion();

    // Effet texte pixel "BOOM!"
    CartoonGraphics.addFloatingText('BOOM !', x, y, isToxic ? '#a3e635' : '#ef4444', 28);

    this.createBloodSplatter(x, y, 24, isToxic);

    // Dégâts de zone aux zombies
    for (const z of this.zombies) {
      if (z.isDead) continue;
      const dx = z.x - x;
      const dy = z.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius) {
        const falloff = 1 - dist / radius;
        const dealt = Math.round(damage * falloff);
        const dead = z.takeDamage(dealt, Math.atan2(dy, dx), 450 * falloff);
        if (dead) this.handleZombieDeath(z);
      }
    }

    // Dégâts aux joueurs proches
    for (const p of this.players.values()) {
      const dx = p.x - x;
      const dy = p.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < radius && !p.isDodging) {
        const falloff = 1 - dist / radius;
        p.takeDamage(Math.round(damage * 0.4 * falloff), Math.atan2(dy, dx));
      }
    }

    // Flaque d'acide si toxique
    if (isToxic) {
      this.acidPuddles.push({
        x,
        y,
        radius: 65,
        lifetime: 5.0,
        maxLife: 5.0
      });
    }
  }

  handleZombieDeath(zombie) {
    this.totalKills++;
    this.score += zombie.config.score;
    this.audio.playZombieGroan(zombie.typeId === 'titan' || zombie.isBoss ? 'titan' : 'death');
    this.createBloodSplatter(zombie.x, zombie.y, 16, zombie.typeId === 'spitter');

    // Textes comiques flottants cartoon
    CartoonGraphics.addFloatingText('+' + zombie.config.score, zombie.x, zombie.y - 12, '#fde047', 22);
    if (Math.random() < 0.35) {
      const fun = ['SPLAT !', 'POW !', 'BAM !', 'K.O. !'];
      CartoonGraphics.addFloatingText(fun[Math.floor(Math.random() * fun.length)], zombie.x, zombie.y + 14, '#f43f5e', 18);
    }

    // Chances de butin
    if (Math.random() < zombie.config.dropRate) {
      const roll = Math.random();
      if (roll < 0.5) {
        this.spawnPickup('ammo_small', zombie.x, zombie.y);
      } else if (roll < 0.75) {
        this.spawnPickup('medkit', zombie.x, zombie.y);
      } else if (roll < 0.9) {
        this.spawnPickup('armor', zombie.x, zombie.y);
      } else {
        // Drop d'arme puissante
        const weapons = ['shotgun', 'smg', 'rifle'];
        const chosen = weapons[Math.floor(Math.random() * weapons.length)];
        this.spawnPickup('weapon_drop', zombie.x, zombie.y, chosen);
      }
    }
  }

  bindEvents() {
    window.addEventListener('resize', () => this.resize());

    window.addEventListener('keydown', (e) => {
      const k = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase();
      this.keys[k] = true;
      this.keys[code] = true;

      // Rechargement manuel R
      if (k === 'r' || code === 'keyr') {
        this.triggerReload();
      }

      // Changement d'arme (1, 2, Q)
      if (k === '1' || code === 'digit1') this.switchWeapon(0);
      if (k === '2' || code === 'digit2') this.switchWeapon(1);
      if (k === 'q' || code === 'keyq') {
        const p = this.players.get(this.localPlayerId);
        if (p) this.switchWeapon((p.activeWeaponIndex + 1) % p.weapons.length);
      }

      // Roulade d'esquive Espace
      if (k === ' ' || code === 'space') {
        if (e.preventDefault) e.preventDefault();
        this.triggerDodge();
      }
    });

    window.addEventListener('keyup', (e) => {
      const k = (e.key || '').toLowerCase();
      const code = (e.code || '').toLowerCase();
      this.keys[k] = false;
      this.keys[code] = false;
    });

    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });

    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouse.isDown = true;
      } else if (e.button === 2) {
        if (e.preventDefault) e.preventDefault();
        this.mouse.rightDown = true;
        this.triggerDodge();
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.isDown = false;
      if (e.button === 2) this.mouse.rightDown = false;
    });

    window.addEventListener('contextmenu', (e) => {
      if (e.preventDefault) e.preventDefault();
    });

    window.addEventListener('wheel', (e) => {
      const p = this.players.get(this.localPlayerId);
      if (p && p.weapons.length > 1) {
        this.switchWeapon((p.activeWeaponIndex + 1) % p.weapons.length);
      }
    });
  }

  setupNetwork() {
    if (!this.bridge) {
      this.isHost = true;
      return;
    }

    // En solo ou si notre rôle n'est pas 'guest', on est l'HÔTE et on gère les spawns et la physique !
    const role = (this.bridge.info && this.bridge.info.role) ? this.bridge.info.role : 'solo';
    this.isHost = !this.bridge.embedded || role === 'host' || role === 'solo' || role !== 'guest';

    // Réception des événements réseau HubBridge
    this.bridge.on('msg', (from, m) => {
      if (!m) return;
      if (m.k === 'st' && !this.isHost) {
        this.applyAuthoritativeState(m.s);
      } else if (m.k === 'cmd' && this.isHost) {
        this.handleClientCommand(from, m.c);
      }
    });

    this.bridge.on('roster', (players) => {
      if (!Array.isArray(players)) return;
      for (const p of players) {
        if (p.id !== this.bridge.info.myId) {
          this.addRemotePlayer(p.id, p.name);
        }
      }
    });
  }

  addRemotePlayer(id, name) {
    if (this.players.has(id)) return;
    const colors = ['#ffb300', '#00e676', '#e040fb', '#ff5252', '#00e5ff'];
    const p = {
      id,
      name: name || 'Garde Allié',
      color: colors[this.players.size % colors.length],
      x: this.mapRoom.width / 2,
      y: this.mapRoom.height / 2 + 100,
      vx: 0,
      vy: 0,
      radius: 18,
      speed: 260,
      hp: 100,
      maxHp: 100,
      armor: 50,
      maxArmor: 100,
      stamina: 100,
      maxStamina: 100,
      isDowned: false,
      downedTimer: 30.0,
      isDodging: false,
      activeWeaponIndex: 0,
      weapons: ['pistol', 'shotgun'],
      aimAngle: 0,
      muzzleFlashTimer: 0
    };
    p.takeDamage = (amount, angle) => {
      p.hp = Math.max(0, p.hp - amount);
      if (p.hp <= 0) p.isDowned = true;
    };
    this.players.set(id, p);
  }

  switchWeapon(index) {
    const p = this.players.get(this.localPlayerId);
    if (!p || index >= p.weapons.length || p.isReloading) return;
    p.activeWeaponIndex = index;
    p.fireCooldown = 0.25;
    this.audio.playReload();
  }

  triggerReload() {
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isReloading || p.isDowned) return;

    const wType = p.weapons[p.activeWeaponIndex];
    const wConfig = WEAPON_TYPES[wType];
    const current = p.magAmmo[wType] || 0;
    const reserve = p.reserves[wType] || 0;

    if (current < wConfig.magSize && reserve > 0) {
      p.isReloading = true;
      p.reloadTimer = wConfig.reloadTime;
      p.reloadDuration = wConfig.reloadTime;
      this.audio.playReload();
    }
  }

  triggerDodge() {
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isDodging || p.isDowned || p.stamina < 30 || p.dodgeCooldown > 0) return;

    p.stamina -= 30;
    p.isDodging = true;
    p.dodgeTimer = 0.35;
    p.dodgeCooldown = 0.65;

    // Direction de l'esquive : mouvement actuel ou visée
    if (Math.abs(p.vx) > 10 || Math.abs(p.vy) > 10) {
      p.dodgeAngle = Math.atan2(p.vy, p.vx);
    } else {
      p.dodgeAngle = p.aimAngle;
    }

    this.audio.playDodge();
  }

  shootWeapon() {
    const p = this.players.get(this.localPlayerId);
    if (!p || p.isReloading || p.isDodging) return;

    const wType = p.weapons[p.activeWeaponIndex];
    const wConfig = WEAPON_TYPES[wType];

    if (p.magAmmo[wType] <= 0) {
      this.triggerReload();
      return;
    }

    if (p.fireCooldown > 0) return;

    // Consommer munition et déclencher tir
    p.magAmmo[wType]--;
    p.fireCooldown = 1.0 / wConfig.fireRate;
    p.muzzleFlashTimer = 0.06;

    // Recul & Screen Shake
    this.camera.shake = Math.min(18, this.camera.shake + wConfig.screenShake);
    p.vx -= Math.cos(p.aimAngle) * wConfig.recoilKick * 20;
    p.vy -= Math.sin(p.aimAngle) * wConfig.recoilKick * 20;

    // Son de tir
    this.audio.playShoot(wConfig.sound);

    // Tirer les plombs ou projectiles
    for (let i = 0; i < wConfig.pellets; i++) {
      const spread = (Math.random() - 0.5) * wConfig.spread;
      const angle = p.aimAngle + spread;
      const speed = wConfig.bulletSpeed * (0.95 + Math.random() * 0.1);

      this.projectiles.push({
        id: 'proj_' + Math.random().toString(36).substr(2, 8),
        ownerId: p.id,
        x: p.x + Math.cos(p.aimAngle) * 22,
        y: p.y + Math.sin(p.aimAngle) * 22,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        radius: wConfig.bulletWidth || 3,
        length: wConfig.bulletLength || 12,
        color: wConfig.color || '#ffe57f',
        damage: wConfig.damage,
        penetration: wConfig.penetration || 1,
        hitsLeft: wConfig.penetration || 1,
        rangeLeft: wConfig.range,
        knockback: wConfig.knockback || 90,
        isExplosive: !!wConfig.isExplosive,
        isAcid: false
      });
    }

    // Éjection de douille
    this.particles.push({
      x: p.x,
      y: p.y,
      vx: Math.cos(p.aimAngle - Math.PI / 2) * (80 + Math.random() * 60),
      vy: Math.sin(p.aimAngle - Math.PI / 2) * (80 + Math.random() * 60),
      radius: 2,
      color: '#ffd700',
      lifetime: 0.8,
      maxLife: 0.8,
      isCasing: true
    });
  }

  update(dt) {
    if (this.gameOver || this.gameWon) return;

    this.gameTime += dt;
    CartoonGraphics.update(dt);

    // Amortissement du shake caméra
    this.camera.shake *= 0.88;
    if (this.camera.shake < 0.1) this.camera.shake = 0;

    // 1. Mise à jour du joueur local
    const p = this.players.get(this.localPlayerId);
    if (p) {
      // Coordonnées souris vers coordonnées monde
      this.mouse.worldX = this.mouse.x - this.width / 2 + this.camera.x;
      this.mouse.worldY = this.mouse.y - this.height / 2 + this.camera.y;
      p.aimAngle = Math.atan2(this.mouse.worldY - p.y, this.mouse.worldX - p.x);

      // Régénération d'endurance
      if (p.stamina < p.maxStamina) {
        p.stamina = Math.min(p.maxStamina, p.stamina + 35 * dt);
      }
      if (p.dodgeCooldown > 0) p.dodgeCooldown -= dt;
      if (p.fireCooldown > 0) p.fireCooldown -= dt;
      if (p.muzzleFlashTimer > 0) p.muzzleFlashTimer -= dt;

      // Gestion du rechargement
      if (p.isReloading) {
        p.reloadTimer -= dt;
        if (p.reloadTimer <= 0) {
          p.isReloading = false;
          const wType = p.weapons[p.activeWeaponIndex];
          const wConfig = WEAPON_TYPES[wType];
          const needed = wConfig.magSize - (p.magAmmo[wType] || 0);
          const taken = Math.min(needed, p.reserves[wType] || 0);
          p.magAmmo[wType] = (p.magAmmo[wType] || 0) + taken;
          p.reserves[wType] -= taken;
        }
      }

      // Gestion de la roulade
      if (p.isDodging) {
        p.dodgeTimer -= dt;
        const dodgeSpeed = 520;
        p.vx = Math.cos(p.dodgeAngle) * dodgeSpeed;
        p.vy = Math.sin(p.dodgeAngle) * dodgeSpeed;

        if (p.dodgeTimer <= 0) {
          p.isDodging = false;
          p.vx *= 0.2;
          p.vy *= 0.2;
        }
      } else if (p.isDowned) {
        // Joueur à terre : rampe lentement
        p.downedTimer -= dt;
        p.vx *= 0.7;
        p.vy *= 0.7;

        // Auto-réanimation solo
        if (this.players.size === 1 && p.soloAdrenalineCharges > 0 && p.downedTimer < 25.0) {
          p.soloAdrenalineCharges--;
          p.isDowned = false;
          p.hp = 60;
          this.audio.playVictory();
        }

        if (p.downedTimer <= 0) {
          this.triggerGameOver();
        }
      } else {
        // Déplacement au clavier ZQSD / WASD
        let moveX = 0;
        let moveY = 0;
        if (this.keys['z'] || this.keys['w'] || this.keys['arrowup']) moveY -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) moveY += 1;
        if (this.keys['q'] || this.keys['a'] || this.keys['arrowleft']) moveX -= 1;
        if (this.keys['d'] || this.keys['arrowright']) moveX += 1;

        if (moveX !== 0 && moveY !== 0) {
          moveX *= 0.7071;
          moveY *= 0.7071;
        }

        const targetSpeed = p.speed;
        p.vx += (moveX * targetSpeed - p.vx) * 0.25;
        p.vy += (moveY * targetSpeed - p.vy) * 0.25;

        // Tir continu avec clic gauche
        if (this.mouse.isDown) {
          this.shootWeapon();
        }

        // Réanimation d'alliés à proximité avec touche E
        if (this.keys['e'] || this.keys['keye']) {
          for (const other of this.players.values()) {
            if (other.id !== p.id && other.isDowned) {
              const dx = other.x - p.x;
              const dy = other.y - p.y;
              if (dx * dx + dy * dy < 70 * 70) {
                other.reviveProgress = (other.reviveProgress || 0) + dt / 3.0;
                if (other.reviveProgress >= 1.0) {
                  other.isDowned = false;
                  other.hp = 50;
                  other.reviveProgress = 0;
                  this.audio.playVictory();
                }
              }
            }
          }
        }
      }

      // Appliquer mouvement
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Collisions joueur avec les murs et les obstacles
      this.mapRoom.collideWithWalls(p);
      this.mapRoom.resolveObstacleCollisions(p);

      // Ramassage de butin
      this.checkPickupCollisions(p);

      // Détection de transition de porte
      const doorTrigger = this.mapRoom.checkDoorTrigger(p);
      if (doorTrigger) {
        this.transitionToNextRoom(doorTrigger.destination);
      }
    }

    // Centrer caméra sur le joueur local (smooth lerp)
    if (p) {
      this.camera.targetX = p.x;
      this.camera.targetY = p.y;
      this.camera.x += (this.camera.targetX - this.camera.x) * 0.12;
      this.camera.y += (this.camera.targetY - this.camera.y) * 0.12;
    }

    // 2. Spawn et IA des Zombies (exécuté par l'Hôte en autorité)
    if (this.isHost) {
      this.updateWaveAndSpawns(dt);

      for (let i = this.zombies.length - 1; i >= 0; i--) {
        const z = this.zombies[i];
        z.update(dt, Array.from(this.players.values()), this.mapRoom, this.acidPuddles, this.projectiles, this.audio);
        if (z.isDead) {
          this.zombies.splice(i, 1);
        }
      }
    }

    // 3. Mise à jour des projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;

      // Distance parcourue
      const distTraveled = Math.sqrt(proj.vx * proj.vx + proj.vy * proj.vy) * dt;
      proj.rangeLeft -= distTraveled;

      // Projectiles acides d'ennemis vs joueurs
      if (proj.isAcid) {
        for (const player of this.players.values()) {
          const dx = player.x - proj.x;
          const dy = player.y - proj.y;
          if (dx * dx + dy * dy < (player.radius + proj.radius) ** 2) {
            player.takeDamage(proj.damage, Math.atan2(dy, dx));
            proj.rangeLeft = 0;
            break;
          }
        }
      } else {
        // Projectiles des joueurs vs zombies
        for (const z of this.zombies) {
          if (z.isDead) continue;
          const dx = z.x - proj.x;
          const dy = z.y - proj.y;
          if (dx * dx + dy * dy < (z.radius + proj.radius) ** 2) {
            const angle = Math.atan2(proj.vy, proj.vx);
            const isDead = z.takeDamage(proj.damage, angle, proj.knockback);
            this.audio.playFleshHit();
            CartoonGraphics.addFloatingText('-' + proj.damage, z.x, z.y - 12, '#f87171', 14);

            if (proj.isExplosive) {
              this.createExplosion(proj.x, proj.y, 130, proj.damage);
              proj.rangeLeft = 0;
              break;
            }

            if (isDead) this.handleZombieDeath(z);

            proj.hitsLeft--;
            if (proj.hitsLeft <= 0) {
              proj.rangeLeft = 0;
              break;
            }
          }
        }

        // Projectiles vs barils explosifs
        for (const b of this.mapRoom.barrels) {
          if (b.exploded) continue;
          const dx = b.x - proj.x;
          const dy = b.y - proj.y;
          if (dx * dx + dy * dy < (b.radius + proj.radius) ** 2) {
            b.hp -= proj.damage;
            proj.rangeLeft = 0;
            if (b.hp <= 0) {
              b.exploded = true;
              this.createExplosion(b.x, b.y, 140, 180, b.type === 'toxic');
            }
            break;
          }
        }
      }

      // Collision avec murs de la salle
      if (this.mapRoom.collideWithWalls(proj) || proj.rangeLeft <= 0) {
        if (proj.isExplosive) {
          this.createExplosion(proj.x, proj.y, 130, proj.damage);
        }
        this.projectiles.splice(i, 1);
      }
    }

    // 4. Flaques d'acide caustiques
    for (let i = this.acidPuddles.length - 1; i >= 0; i--) {
      const puddle = this.acidPuddles[i];
      puddle.lifetime -= dt;
      // Dégâts continus aux joueurs marchant dedans
      for (const player of this.players.values()) {
        const dx = player.x - puddle.x;
        const dy = player.y - puddle.y;
        if (dx * dx + dy * dy < puddle.radius * puddle.radius && !player.isDodging) {
          player.takeDamage(8 * dt, 0);
        }
      }
      if (puddle.lifetime <= 0) {
        this.acidPuddles.splice(i, 1);
      }
    }

    // 5. Particules éphémères
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const part = this.particles[i];
      part.x += part.vx * dt;
      part.y += part.vy * dt;
      part.lifetime -= dt;
      if (part.lifetime <= 0) {
        this.particles.splice(i, 1);
      }
    }

    // 6. Synchronisation réseau Peer-to-Peer
    if (this.bridge && this.isHost) {
      this.lastNetSync += dt;
      if (this.lastNetSync >= 0.05) { // 20 Hz
        this.lastNetSync = 0;
        this.broadcastGameState();
      }
    }
  }

  updateWaveAndSpawns(dt) {
    if (!this.wave.active) return;

    if (this.wave.spawnedCount < this.wave.totalToSpawn) {
      this.wave.spawnTimer -= dt;
      if (this.wave.spawnTimer <= 0) {
        this.wave.spawnTimer = this.wave.spawnInterval;
        this.spawnZombieWaveMember();
      }
    } else if (this.zombies.length === 0 && !this.wave.cleared) {
      // SALLE NETTOYÉE !
      this.wave.cleared = true;
      this.wave.active = false;
      this.roomsCleared++;
      this.score += 500 * this.currentSectorIndex;
      this.audio.playVictory();
      CartoonGraphics.addFloatingText('ZONE PURGÉE !', this.mapRoom.width / 2, this.mapRoom.height / 2 - 30, '#4ade80', 36);

      // Déverrouiller le confinement et ouvrir les portes
      this.mapRoom.unlockDoors();

      // Si c'était la salle 5 (Boss Core) -> VICTOIRE FINALE !
      if (this.mapRoom.sectorId === 'boss_core') {
        this.triggerGameVictory();
      }
    }
  }

  spawnZombieWaveMember(forcePos = null) {
    const spawners = this.mapRoom.spawners;
    const sp = forcePos || spawners[Math.floor(Math.random() * spawners.length)];
    const roll = Math.random();

    let type = 'walker';
    const room = this.currentSectorIndex;

    if (roll < 0.22) {
      type = 'crawler';
    } else if (room >= 2 && roll < 0.45) {
      type = 'runner';
    } else if (room >= 2 && roll < 0.65) {
      type = 'spitter';
    } else if (room >= 3 && roll < 0.82) {
      type = 'titan';
    }

    const scale = 1.0 + (this.currentSectorIndex - 1) * 0.18 + (this.players.size - 1) * 0.2;
    const zombie = new Zombie(type, sp.x, sp.y, scale);
    this.zombies.push(zombie);
    this.wave.spawnedCount++;
  }

  checkPickupCollisions(player) {
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      const dx = player.x - pk.x;
      const dy = player.y - pk.y;
      if (dx * dx + dy * dy < (player.radius + pk.radius) ** 2) {
        let picked = false;

        if (pk.typeId === 'medkit') {
          if (player.hp < player.maxHp) {
            player.hp = Math.min(player.maxHp, player.hp + pk.config.healAmount);
            picked = true;
          }
        } else if (pk.typeId === 'armor') {
          if (player.armor < player.maxArmor) {
            player.armor = Math.min(player.maxArmor, player.armor + pk.config.armorAmount);
            picked = true;
          }
        } else if (pk.typeId === 'ammo_small' || pk.typeId === 'ammo_large') {
          // Recharger les réserves
          for (const [wKey, amt] of Object.entries(pk.config.amount)) {
            if (player.reserves[wKey] !== undefined) {
              const maxRes = WEAPON_TYPES[wKey].reserveMax;
              player.reserves[wKey] = Math.min(maxRes, player.reserves[wKey] + amt);
            }
          }
          picked = true;
        } else if (pk.typeId === 'weapon_drop' && pk.extraWeapon) {
          // Ramasser une nouvelle arme si non possédée ou l'équiper
          if (!player.weapons.includes(pk.extraWeapon)) {
            player.weapons.push(pk.extraWeapon);
            player.activeWeaponIndex = player.weapons.length - 1;
            picked = true;
          } else {
            // Donner des munitions de cette arme
            const wKey = pk.extraWeapon;
            player.reserves[wKey] = Math.min(WEAPON_TYPES[wKey].reserveMax, player.reserves[wKey] + WEAPON_TYPES[wKey].magSize * 2);
            picked = true;
          }
        }

        if (picked) {
          this.audio.playReload();
          this.pickups.splice(i, 1);
        }
      }
    }
  }

  transitionToNextRoom(destination) {
    const nextRoomIndex = this.currentSectorIndex + 1;
    this.startRoom(nextRoomIndex, destination.sectorId);
    this.audio.playDoor();
  }

  triggerGameOver() {
    this.gameOver = true;
    this.audio.playZombieGroan('titan');
    this.recordMatchResults(false);
  }

  triggerGameVictory() {
    this.gameWon = true;
    this.audio.playVictory();
    this.recordMatchResults(true);
  }

  recordMatchResults(won) {
    const resultData = {
      gameId: 'outbreak',
      score: this.score,
      roomsCleared: this.roomsCleared,
      kills: this.totalKills,
      timeSurvived: Math.round(this.gameTime),
      victory: won
    };

    if (this.bridge && typeof this.bridge.recordResult === 'function') {
      this.bridge.recordResult(resultData);
    } else if (window.DuoResults && typeof window.DuoResults.record === 'function') {
      window.DuoResults.record(resultData);
    }
  }

  // Synchronisation P2P
  broadcastGameState() {
    if (!this.bridge || !this.bridge.embedded) return;
    const payload = {
      zombies: this.zombies.map(z => ({ id: z.id, x: z.x, y: z.y, hp: z.hp, maxHp: z.maxHp, angle: z.angle, typeId: z.typeId })),
      projectiles: this.projectiles.map(p => ({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, isAcid: p.isAcid, color: p.color })),
      pickups: this.pickups.map(pk => ({ id: pk.id, typeId: pk.typeId, x: pk.x, y: pk.y })),
      room: { sectorId: this.mapRoom.sectorId, roomIndex: this.mapRoom.roomIndex, isLockdown: this.mapRoom.isLockdown },
      score: this.score,
      wave: { cleared: this.wave.cleared, remaining: this.zombies.length + (this.wave.totalToSpawn - this.wave.spawnedCount) }
    };
    this.bridge.send('all', { k: 'st', s: payload });
  }

  applyAuthoritativeState(state) {
    if (!state) return;
    if (state.score !== undefined) this.score = state.score;
  }

  handleClientCommand(peerId, cmd) {
    const p = this.players.get(peerId);
    if (!p) return;
    if (cmd.aimAngle !== undefined) p.aimAngle = cmd.aimAngle;
    if (cmd.keys) {
      // Calcul mouvement du pair
      let mx = 0, my = 0;
      if (cmd.keys.up) my -= 1;
      if (cmd.keys.down) my += 1;
      if (cmd.keys.left) mx -= 1;
      if (cmd.keys.right) mx += 1;
      p.vx = mx * p.speed;
      p.vy = my * p.speed;
    }
  }

  // ==========================================================================
  // RENDU GRAPHIQUE DU JEU (CANVAS 2D)
  // ==========================================================================
  draw() {
    const ctx = this.ctx;
    const W = this.width;
    const H = this.height;

    // Reset transform & clear
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#080a0f';
    ctx.fillRect(0, 0, W, H);

    ctx.save();
    // Appliquer décalage caméra avec Screen Shake
    const shakeX = (Math.random() - 0.5) * this.camera.shake * 2;
    const shakeY = (Math.random() - 0.5) * this.camera.shake * 2;
    ctx.translate(W / 2 - this.camera.x + shakeX, H / 2 - this.camera.y + shakeY);

    // 1. Sol, murs et obstacles de la salle avec texture 16-bit Pixel
    this.mapRoom.draw(ctx, this.gameTime, CartoonGraphics.images.get('pixel_floor') || CartoonGraphics.images.get('cartoon_floor'));

    // 2. Taches de sang 16-bit persistantes et impacts
    ctx.drawImage(this.bloodCanvas, 0, 0);

    // 3. Flaques d'acide caustiques pixelisées
    for (const puddle of this.acidPuddles) {
      ctx.save();
      const alpha = Math.min(1.0, puddle.lifetime / puddle.maxLife);
      ctx.fillStyle = `rgba(101, 163, 13, ${0.55 * alpha})`;
      const pr = Math.floor(puddle.radius);
      ctx.fillRect(Math.floor(puddle.x - pr), Math.floor(puddle.y - pr * 0.7), pr * 2, pr * 1.4);
      ctx.fillStyle = `rgba(163, 230, 53, ${0.85 * alpha})`;
      ctx.fillRect(Math.floor(puddle.x - pr * 0.6), Math.floor(puddle.y - pr * 0.4), pr * 1.2, pr * 0.8);
      ctx.restore();
    }

    // 4. Caisses et ramassables au sol pixel 16-bit
    for (const pk of this.pickups) {
      CartoonGraphics.drawPickup(ctx, pk, this.gameTime);
    }

    // 5. Particules et douilles pixel 16-bit (carrés francs)
    for (const part of this.particles) {
      ctx.save();
      ctx.fillStyle = part.color;
      const pSize = Math.max(2, Math.floor(part.radius * 1.5));
      ctx.fillRect(Math.floor(part.x), Math.floor(part.y), pSize, pSize);
      ctx.restore();
    }

    // 6. Zombies (Bestiaire Pixel 16-bit Dead Ahead / Nearly Dead)
    for (const z of this.zombies) {
      CartoonGraphics.drawZombie(ctx, z, this.gameTime);
    }

    // 7. Joueurs (Chevaliers & Mercenaires Pixel 16-bit)
    for (const p of this.players.values()) {
      CartoonGraphics.drawSurvivor(ctx, p, this.gameTime);
    }

    // 8. Projectiles Pixel 16-bit (traçantes dorées, roquettes, boules d'acide)
    for (const proj of this.projectiles) {
      this.drawCartoonProjectile(ctx, proj);
    }

    // 9. Textes 16-bit flottants ("-9", "BOOM!", "CRIT!", "+100")
    CartoonGraphics.drawFloatingTexts(ctx);

    // 10. Ambiance lumineuse dynamique
    this.drawLightingAndFlashlight(ctx);

    ctx.restore();

    // 11. HUD & Interface joueur 16-bit
    this.drawHUD(ctx);

    // Modales de fin de mission
    if (this.gameOver) this.drawGameOverScreen(ctx);
    if (this.gameWon) this.drawVictoryScreen(ctx);
  }

  drawCartoonProjectile(ctx, proj) {
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(Math.floor(proj.x), Math.floor(proj.y));
    const angle = Math.atan2(proj.vy, proj.vx);
    ctx.rotate(angle);

    if (proj.isAcid) {
      // Bave d'acide pixelisée
      ctx.fillStyle = '#020617';
      ctx.fillRect(-proj.radius - 1, -proj.radius - 1, (proj.radius + 1) * 2, (proj.radius + 1) * 2);
      ctx.fillStyle = '#84cc16';
      ctx.fillRect(-proj.radius, -proj.radius, proj.radius * 2, proj.radius * 2);
      ctx.fillStyle = '#bef264';
      ctx.fillRect(-2, -2, 4, 4);
    } else if (proj.isExplosive) {
      // Roquette 16-bit avec traînée de feu
      ctx.fillStyle = '#020617';
      ctx.fillRect(-proj.length - 1, -proj.radius - 1, proj.length + 2, proj.radius * 2 + 2);
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(-proj.length, -proj.radius, proj.length, proj.radius * 2);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(0, -proj.radius + 1, 4, proj.radius * 2 - 2);
      // Flamme arrière pixelisée
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(-proj.length - 8, -2, 8, 4);
    } else {
      // Balle traçante 16-bit dorée
      ctx.fillStyle = '#020617';
      ctx.fillRect(-proj.length - 1, -2, proj.length + 2, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(-proj.length, -1, proj.length, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -1, 3, 2);
    }

    ctx.restore();
  }

  drawPlayer(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);

    // Si le joueur est en train d'esquiver (roulade), afficher une traînée fantôme
    if (p.isDodging) {
      ctx.fillStyle = 'rgba(0, 229, 255, 0.3)';
      ctx.beginPath();
      ctx.arc(-p.vx * 0.05, -p.vy * 0.05, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ombre portée
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(3, 4, p.radius, 0, Math.PI * 2);
    ctx.fill();

    // Rotation du corps vers le curseur
    ctx.rotate(p.aimAngle);

    // Corps du joueur (Casque / Épaules tactiques)
    ctx.fillStyle = p.isDowned ? '#546e7a' : p.color;
    ctx.beginPath();
    ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#102027';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Arme tenue en main
    const wType = p.weapons[p.activeWeaponIndex];
    ctx.fillStyle = '#263238';
    ctx.fillRect(p.radius * 0.4, -3, 20, 6);

    // Flash lumineux à la bouche du canon lors d'un tir
    if (p.muzzleFlashTimer > 0) {
      ctx.fillStyle = '#fff9c4';
      ctx.beginPath();
      ctx.arc(p.radius + 20, 0, 9, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // Barres de statut au-dessus de la tête
    const barW = 38;
    const barH = 4;
    const bx = p.x - barW / 2;
    const by = p.y - p.radius - 12;

    // Fond
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);

    // Barre de PV
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = p.isDowned ? '#ff1744' : '#00e676';
    ctx.fillRect(bx, by, barW * hpRatio, barH);

    // Nom du joueur
    ctx.font = 'bold 11px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.fillText(p.name, p.x, by - 4);

    // Indicateur d'état À TERRE
    if (p.isDowned) {
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#ff1744';
      ctx.fillText(`🚨 À TERRE (${Math.ceil(p.downedTimer)}s)`, p.x, by - 18);

      // Si un allié est en train de réanimer
      if (p.reviveProgress > 0) {
        ctx.strokeStyle = '#00e676';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius + 10, -Math.PI / 2, -Math.PI / 2 + p.reviveProgress * Math.PI * 2);
        ctx.stroke();
      }
    }
  }

  drawLightingAndFlashlight(ctx) {
    const p = this.players.get(this.localPlayerId);
    if (!p) return;

    // Ambiance de bunker : gyrophares d'alarme 16-bit
    CartoonGraphics.drawAtmosphericLighting(ctx, p, this.mapRoom, this.gameTime);

    // Cône lumineux subtil de la lampe torche projeté vers l'avant (sans masquer ni effacer le joueur !)
    ctx.save();
    const beamAngle = p.aimAngle;
    const beamSpread = 0.42; // ~24 degrés
    const beamRange = 480;

    const startAngle = beamAngle - beamSpread;
    const endAngle = beamAngle + beamSpread;

    // Halo lumineux doux projeté vers l'avant du fusil
    const lx = p.x + Math.cos(beamAngle) * 20;
    const ly = p.y + Math.sin(beamAngle) * 20;

    const grad = ctx.createRadialGradient(lx, ly, 10, lx, ly, beamRange);
    grad.addColorStop(0, 'rgba(254, 240, 138, 0.14)');
    grad.addColorStop(0.6, 'rgba(254, 240, 138, 0.04)');
    grad.addColorStop(1, 'rgba(254, 240, 138, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(lx, ly);
    ctx.arc(lx, ly, beamRange, startAngle, endAngle);
    ctx.closePath();
    ctx.fill();

    // Si flash de tir, lueur d'éclairage jaune douce devant le canon
    if (p.muzzleFlashTimer > 0) {
      const flashGrad = ctx.createRadialGradient(lx, ly, 5, lx, ly, 180);
      flashGrad.addColorStop(0, 'rgba(254, 240, 138, 0.25)');
      flashGrad.addColorStop(1, 'rgba(254, 240, 138, 0)');
      ctx.fillStyle = flashGrad;
      ctx.beginPath();
      ctx.arc(lx, ly, 180, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawHUD(ctx) {
    const p = this.players.get(this.localPlayerId);
    if (!p) return;

    const W = this.width;
    const H = this.height;

    // 0. Vignette d'angoisse / pulsation cardiaque si santé critique (< 40 PV)
    if (p.hp < 40) {
      const pulse = 0.5 + 0.5 * Math.sin(this.gameTime * 7);
      const intensity = ((40 - p.hp) / 40) * 0.45 * pulse;
      const vigGrad = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75);
      vigGrad.addColorStop(0, 'rgba(183, 28, 28, 0)');
      vigGrad.addColorStop(1, `rgba(183, 28, 28, ${intensity})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, W, H);
    }

    // 0. Coins tactiques HUD (esthétique sci-fi militaire)
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.45)';
    ctx.lineWidth = 2;
    const bLen = 24;
    ctx.beginPath();
    // Haut-Gauche
    ctx.moveTo(12, 12 + bLen); ctx.lineTo(12, 12); ctx.lineTo(12 + bLen, 12);
    // Haut-Droite
    ctx.moveTo(W - 12 - bLen, 12); ctx.lineTo(W - 12, 12); ctx.lineTo(W - 12, 12 + bLen);
    // Bas-Gauche
    ctx.moveTo(12, H - 12 - bLen); ctx.lineTo(12, H - 12); ctx.lineTo(12 + bLen, H - 12);
    // Bas-Droite
    ctx.moveTo(W - 12 - bLen, H - 12); ctx.lineTo(W - 12, H - 12); ctx.lineTo(W - 12, H - 12 - bLen);
    ctx.stroke();

    // 1. Panneau Supérieur : Secteur & Vague
    ctx.save();
    ctx.fillStyle = 'rgba(12, 16, 22, 0.88)';
    ctx.fillRect(W / 2 - 240, 16, 480, 54);
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W / 2 - 240, 16, 480, 54);

    // Titre du secteur
    ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = this.mapRoom.sector.colorTheme || '#00e5ff';
    ctx.textAlign = 'center';
    ctx.fillText(`${this.mapRoom.sector.name.toUpperCase()} (SALLE ${this.currentSectorIndex}/5)`, W / 2, 36);

    // État du confinement
    ctx.font = '13px monospace';
    if (this.mapRoom.isLockdown) {
      const remaining = this.zombies.length + Math.max(0, this.wave.totalToSpawn - this.wave.spawnedCount);
      ctx.fillStyle = '#ff5252';
      ctx.fillText(`🚨 CONFINEMENT ACTIF — CIBLES RESTANTES : ${remaining}`, W / 2, 56);
    } else {
      ctx.fillStyle = '#00e676';
      ctx.fillText('✅ CONFINEMENT LEVÉ — SAS DÉVERROUILLÉS', W / 2, 56);
    }
    ctx.restore();

    // 2. Score et Kills (Haut Droite)
    ctx.save();
    ctx.fillStyle = 'rgba(12, 16, 22, 0.88)';
    ctx.fillRect(W - 200, 16, 184, 54);
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(W - 200, 16, 184, 54);

    ctx.font = 'bold 13px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffca28';
    ctx.textAlign = 'left';
    ctx.fillText(`SCORE : ${this.score}`, W - 188, 36);
    ctx.fillStyle = '#eceff1';
    ctx.fillText(`ÉLIMINATIONS : ${this.totalKills}`, W - 188, 56);
    ctx.restore();

    // 3. Jauges Joueur Cartoon (Bas Gauche : Santé Candy, Armure, Endurance, EKG)
    ctx.save();
    const hudX = 24;
    const hudY = H - 105;
    const hudW = 270;
    const hudH = 85;

    // Fond cartoon
    ctx.fillStyle = '#1e293b';
    drawSafeRoundRect(ctx, hudX, hudY, hudW, hudH, 10);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0e1726';
    ctx.stroke();

    // Barre de Santé Cartoon (Verte éclatante avec reflet)
    const hpRatio = Math.max(0, p.hp / p.maxHp);
    ctx.font = '900 12px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`❤️ SANTÉ : ${Math.ceil(p.hp)} / ${p.maxHp}`, hudX + 14, hudY + 20);

    // Moniteur EKG cartoon
    ctx.strokeStyle = hpRatio > 0.3 ? '#22c55e' : '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const ekgX = hudX + 175;
    const ekgY = hudY + 16;
    const t = this.gameTime * 8;
    ctx.moveTo(ekgX, ekgY);
    ctx.lineTo(ekgX + 12, ekgY);
    ctx.lineTo(ekgX + 16, ekgY - 6 * Math.sin(t));
    ctx.lineTo(ekgX + 20, ekgY + 6 * Math.sin(t));
    ctx.lineTo(ekgX + 24, ekgY);
    ctx.lineTo(ekgX + 44, ekgY);
    ctx.stroke();

    // Jauge de PV
    ctx.fillStyle = '#0f172a';
    drawSafeRoundRect(ctx, hudX + 12, hudY + 26, 246, 12, 6);
    ctx.fill();
    if (hpRatio > 0) {
      ctx.fillStyle = hpRatio > 0.4 ? '#22c55e' : '#ef4444';
      drawSafeRoundRect(ctx, hudX + 12, hudY + 26, 246 * hpRatio, 12, 6);
      ctx.fill();
    }

    // Barre d'Armure Cartoon
    const armRatio = Math.max(0, p.armor / p.maxArmor);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`🛡️ ARMURE : ${Math.ceil(p.armor)} / ${p.maxArmor}`, hudX + 14, hudY + 52);
    ctx.fillStyle = '#0f172a';
    drawSafeRoundRect(ctx, hudX + 12, hudY + 56, 246, 8, 4);
    ctx.fill();
    if (armRatio > 0) {
      ctx.fillStyle = '#38bdf8';
      drawSafeRoundRect(ctx, hudX + 12, hudY + 56, 246 * armRatio, 8, 4);
      ctx.fill();
    }

    // Barre d'Endurance Cartoon (Dodge)
    ctx.fillStyle = '#eab308';
    drawSafeRoundRect(ctx, hudX + 12, hudY + 69, 246 * Math.max(0, p.stamina / p.maxStamina), 5, 2);
    ctx.fill();
    ctx.restore();

    // 4. Cartouche d'Arme & Munitions Cartoon (Bas Droite)
    ctx.save();
    const wType = p.weapons[p.activeWeaponIndex];
    const wConfig = WEAPON_TYPES[wType];
    const cardW = 250;
    const cardH = 85;
    const cardX = W - cardW - 24;
    const cardY = H - cardH - 20;

    // Fond carte
    ctx.fillStyle = '#1e293b';
    drawSafeRoundRect(ctx, cardX, cardY, cardW, cardH, 10);
    ctx.fill();
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = '#0e1726';
    ctx.stroke();

    ctx.font = '900 16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(wConfig.name, cardX + 16, cardY + 26);

    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`[1 / 2 / Q] ${wConfig.category}`, cardX + 16, cardY + 44);

    // Compteur de munitions géant cartoon
    ctx.font = '900 24px "Impact", "Segoe UI", sans-serif';
    const curMag = p.magAmmo[wType] || 0;
    const resMag = p.reserves[wType] || 0;
    ctx.fillStyle = curMag === 0 ? '#ef4444' : '#fde047';
    ctx.textAlign = 'right';
    ctx.fillText(`${curMag} / ${resMag}`, cardX + cardW - 16, cardY + 38);

    // Indicateur de rechargement cartoon
    if (p.isReloading) {
      const prog = 1.0 - p.reloadTimer / p.reloadDuration;
      ctx.fillStyle = '#f59e0b';
      drawSafeRoundRect(ctx, cardX + 16, cardY + 58, (cardW - 32) * prog, 8, 4);
      ctx.fill();
      ctx.font = '900 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fde047';
      ctx.fillText('⚡ RECHARGEMENT...', cardX + cardW / 2, cardY + 76);
    } else {
      ctx.font = 'bold 10px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'left';
      ctx.fillText('[R] Recharger  •  [Espace / Clic Droit] Esquive', cardX + 16, cardY + 70);
    }
    ctx.restore();
  }

  drawGameOverScreen(ctx) {
    const W = this.width;
    const H = this.height;

    ctx.save();
    ctx.fillStyle = 'rgba(8, 2, 4, 0.88)';
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#ff1744';
    ctx.textAlign = 'center';
    ctx.fillText('ÉCHEC DE LA MISSION', W / 2, H / 2 - 80);

    ctx.font = '18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#cfd8dc';
    ctx.fillText('L\'escouade a été submergée par la horde biologique.', W / 2, H / 2 - 30);

    ctx.font = 'bold 20px monospace';
    ctx.fillStyle = '#ffca28';
    ctx.fillText(`Score Final : ${this.score}  |  Salles Nettoyées : ${this.roomsCleared} / 5  |  Kills : ${this.totalKills}`, W / 2, H / 2 + 20);

    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#90a4ae';
    ctx.fillText('Appuyez sur ESPACE ou CLIQUEZ pour recommencer', W / 2, H / 2 + 70);
    ctx.restore();
  }

  drawVictoryScreen(ctx) {
    const W = this.width;
    const H = this.height;

    ctx.save();
    ctx.fillStyle = 'rgba(2, 18, 12, 0.9)';
    ctx.fillRect(0, 0, W, H);

    ctx.font = 'bold 52px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = '#00e676';
    ctx.textAlign = 'center';
    ctx.fillText('EXTRACTION RÉUSSIE !', W / 2, H / 2 - 80);

    ctx.font = '20px "Segoe UI", sans-serif';
    ctx.fillStyle = '#e0f2f1';
    ctx.fillText('Le Spécimen Zéro a été neutralisé. Le Secteur Zéro est purgé.', W / 2, H / 2 - 30);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = '#ffca28';
    ctx.fillText(`Score Épique : ${this.score}  |  Temps de survie : ${Math.round(this.gameTime)}s  |  Kills : ${this.totalKills}`, W / 2, H / 2 + 25);

    ctx.font = '16px "Segoe UI", sans-serif';
    ctx.fillStyle = '#80cbc4';
    ctx.fillText('Félicitations Gardien ! Cliquez pour retourner au Hub ou rejouer.', W / 2, H / 2 + 80);
    ctx.restore();
  }

  // Boucle de rendu
  start() {
    this.running = true;
    this.lastTime = performance.now();

    const loop = (currentTime) => {
      if (!this.running) return;
      const dt = Math.min(0.1, (currentTime - this.lastTime) / 1000);
      this.lastTime = currentTime;

      this.update(dt);
      this.draw();

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
  }
}
