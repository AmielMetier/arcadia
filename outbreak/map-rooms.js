// ============================================================================
// OUTBREAK : SECTEUR ZÉRO - MAP & ROOM GENERATOR (CARTOON EDITION)
// ============================================================================

import { CartoonGraphics } from './graphics.js';

export const SECTOR_TYPES = {
  decontamination: {
    id: 'decontamination',
    name: 'Sas de Décontamination',
    subtitle: 'Point d\'insertion Delta',
    colorTheme: '#00e5ff',
    ambientColor: 'rgba(10, 24, 32, 0.45)',
    description: 'Zone sécurisée préliminaire. Munitions et équipement de base.',
    barrelChance: 0.3
  },
  virology: {
    id: 'virology',
    name: 'Laboratoire de Virologie B',
    subtitle: 'Recherche biologique avancée',
    colorTheme: '#00e676',
    ambientColor: 'rgba(10, 32, 20, 0.5)',
    description: 'Cuves de culture brisées. Présence élevée de cracheurs d\'acide.',
    barrelChance: 0.7
  },
  armory: {
    id: 'armory',
    name: 'Dépôt d\'Armes Militaire',
    subtitle: 'Arsenal de sécurité Alpha',
    colorTheme: '#ffb300',
    ambientColor: 'rgba(32, 24, 10, 0.45)',
    description: 'Armurerie de garnison. Fournit armes lourdes et caisses de munitions.',
    barrelChance: 0.5
  },
  reactor: {
    id: 'reactor',
    name: 'Générateur de Secours',
    subtitle: 'Noyau énergétique réacteur',
    colorTheme: '#ff5252',
    ambientColor: 'rgba(36, 12, 12, 0.5)',
    description: 'Surtensions et condensateurs instables. Abominations massives détectées.',
    barrelChance: 0.8
  },
  medbay: {
    id: 'medbay',
    name: 'Baie Médicale d\'Urgence',
    subtitle: 'Quarantaine médicale avancée',
    colorTheme: '#29b6f6',
    ambientColor: 'rgba(12, 26, 40, 0.45)',
    description: 'Poste de secours avancé. Trousse de réanimation et gilets pare-balles.',
    barrelChance: 0.4
  },
  boss_core: {
    id: 'boss_core',
    name: 'Chambre de Stase Alpha',
    subtitle: 'Épicentre de l\'infection - Spécimen Zéro',
    colorTheme: '#e040fb',
    ambientColor: 'rgba(30, 10, 36, 0.55)',
    description: 'Immense enceinte de confinement blindée. Le nid de la créature originelle.',
    barrelChance: 0.9
  }
};

export class MapRoom {
  constructor(roomConfig = {}) {
    this.sectorId = roomConfig.sectorId || 'decontamination';
    this.sector = SECTOR_TYPES[this.sectorId] || SECTOR_TYPES.decontamination;
    this.roomIndex = roomConfig.roomIndex || 1;
    this.totalRooms = 5;

    // Dimensions de la salle en pixels
    this.width = roomConfig.width || 1400;
    this.height = roomConfig.height || 900;
    this.wallThickness = 48;

    // État du confinement
    this.isLockdown = true;
    this.lockdownAlarmTimer = 0;

    // Portes (N, S, E, O)
    this.doors = {
      north: { x: this.width / 2, y: this.wallThickness / 2, width: 140, height: this.wallThickness, open: false, destination: null },
      south: { x: this.width / 2, y: this.height - this.wallThickness / 2, width: 140, height: this.wallThickness, open: false, destination: null },
      east: { x: this.width - this.wallThickness / 2, y: this.height / 2, width: this.wallThickness, height: 140, open: false, destination: null },
      west: { x: this.wallThickness / 2, y: this.height / 2, width: this.wallThickness, height: 140, open: false, destination: null }
    };

    // Obstacles rectangulaires (caisses de matériel, pupitres de contrôle)
    this.obstacles = [];
    // Piliers et cuves circulaires
    this.pillars = [];
    // Barils explosifs
    this.barrels = [];
    // Points d'apparition des zombies (grilles d'aération, sas)
    this.spawners = [];

    this.generateLayout();
  }

  generateLayout() {
    this.obstacles = [];
    this.pillars = [];
    this.barrels = [];
    this.spawners = [];

    const W = this.width;
    const H = this.height;
    const T = this.wallThickness;

    // Spawners de zombies aux 4 coins et près des grilles murales
    this.spawners.push(
      { x: T + 80, y: T + 80, label: 'Vent NW' },
      { x: W - T - 80, y: T + 80, label: 'Vent NE' },
      { x: T + 80, y: H - T - 80, label: 'Vent SW' },
      { x: W - T - 80, y: H - T - 80, label: 'Vent SE' }
    );

    if (this.sectorId === 'boss_core') {
      // Grande salle arène : 4 colonnes massives en losange et le coeur central
      const cx = W / 2;
      const cy = H / 2;
      const dist = 260;
      this.pillars.push(
        { x: cx - dist, y: cy - dist, radius: 46, color: '#37474f' },
        { x: cx + dist, y: cy - dist, radius: 46, color: '#37474f' },
        { x: cx - dist, y: cy + dist, radius: 46, color: '#37474f' },
        { x: cx + dist, y: cy + dist, radius: 46, color: '#37474f' }
      );

      // Barils explosifs disposés tactiquement
      this.barrels.push(
        { x: cx - 350, y: cy, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: cx + 350, y: cy, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: cx, y: cy - 250, radius: 18, hp: 35, exploded: false, type: 'toxic' },
        { x: cx, y: cy + 250, radius: 18, hp: 35, exploded: false, type: 'toxic' }
      );
      return;
    }

    if (this.sectorId === 'armory') {
      // Rangées de conteneurs et barricades
      const rows = [
        { x: 300, y: 260, w: 120, h: 60, type: 'crate' },
        { x: 300, y: 580, w: 120, h: 60, type: 'crate' },
        { x: W - 420, y: 260, w: 120, h: 60, type: 'barricade' },
        { x: W - 420, y: 580, w: 120, h: 60, type: 'barricade' },
        { x: W / 2 - 80, y: H / 2 - 40, w: 160, h: 80, type: 'crate' }
      ];
      rows.forEach(r => this.obstacles.push(r));

      // Barils explosifs et barils bleus iconiques Dead Ahead
      this.barrels.push(
        { x: 480, y: 290, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: 520, y: 310, radius: 18, hp: 40, exploded: false, type: 'blue' },
        { x: W - 480, y: 610, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: W - 520, y: 590, radius: 18, hp: 40, exploded: false, type: 'blue' }
      );
    } else if (this.sectorId === 'virology') {
      // Cuves de stase cylindriques
      this.pillars.push(
        { x: 360, y: 300, radius: 42, color: '#00e676', glow: true },
        { x: 360, y: 600, radius: 42, color: '#00e676', glow: true },
        { x: W - 360, y: 300, radius: 42, color: '#00e676', glow: true },
        { x: W - 360, y: 600, radius: 42, color: '#00e676', glow: true }
      );
      this.obstacles.push(
        { x: W / 2 - 140, y: H / 2 - 25, w: 280, h: 50, type: 'barricade' }
      );
      // Barils toxiques et barils bleus
      this.barrels.push(
        { x: W / 2 - 200, y: H / 2 - 150, radius: 18, hp: 35, exploded: false, type: 'toxic' },
        { x: W / 2 - 240, y: H / 2 - 170, radius: 18, hp: 40, exploded: false, type: 'blue' },
        { x: W / 2 + 200, y: H / 2 + 150, radius: 18, hp: 35, exploded: false, type: 'toxic' },
        { x: W / 2 + 240, y: H / 2 + 130, radius: 18, hp: 40, exploded: false, type: 'blue' }
      );
    } else if (this.sectorId === 'reactor') {
      // Générateurs et condensateurs
      this.obstacles.push(
        { x: 280, y: 220, w: 80, h: 220, type: 'crate' },
        { x: W - 360, y: 220, w: 80, h: 220, type: 'crate' },
        { x: 280, y: H - 440, w: 80, h: 220, type: 'barricade' },
        { x: W - 360, y: H - 440, w: 80, h: 220, type: 'barricade' }
      );
      this.pillars.push(
        { x: W / 2, y: H / 2, radius: 55, color: '#ff5252', glow: true }
      );
      this.barrels.push(
        { x: W / 2 - 120, y: H / 2, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: W / 2 - 160, y: H / 2 - 20, radius: 18, hp: 40, exploded: false, type: 'blue' },
        { x: W / 2 + 120, y: H / 2, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: W / 2 + 160, y: H / 2 + 20, radius: 18, hp: 40, exploded: false, type: 'blue' }
      );
    } else {
      // Décontamination ou Medbay : 2 blocs de barricades et 2 piliers
      this.obstacles.push(
        { x: 380, y: 320, w: 100, h: 260, type: 'barricade' },
        { x: W - 480, y: 320, w: 100, h: 260, type: 'barricade' }
      );
      this.pillars.push(
        { x: W / 2, y: 250, radius: 36, color: '#455a64' },
        { x: W / 2, y: H - 250, radius: 36, color: '#455a64' }
      );
      this.barrels.push(
        { x: W / 2 - 60, y: H / 2, radius: 18, hp: 35, exploded: false, type: 'red' },
        { x: W / 2 - 100, y: H / 2 - 20, radius: 18, hp: 40, exploded: false, type: 'blue' }
      );
    }
  }

  // Déverrouille les portes et assigne les choix d'itinéraires une fois la salle nettoyée
  unlockDoors() {
    this.isLockdown = false;

    if (this.roomIndex >= this.totalRooms - 1) {
      // Prochaine salle = Boss fight direct !
      this.doors.north.open = true;
      this.doors.north.destination = { sectorId: 'boss_core', label: 'Sas Alpha (BOSS - Spécimen Zéro)', icon: '💀' };
      return;
    }

    // Proposer 2 embranchements
    const choices = [
      { sectorId: 'armory', label: 'Armurerie (+Armes & Munitions)', icon: '🔫' },
      { sectorId: 'medbay', label: 'Baie Médicale (+Soins & Armure)', icon: '💉' },
      { sectorId: 'virology', label: 'Labo Virologie (Bonus Score x1.5)', icon: '☣️' },
      { sectorId: 'reactor', label: 'Générateur Énergétique (Défis & Butin)', icon: '⚡' }
    ];

    // Tirer 2 choix distincts du secteur actuel
    const validChoices = choices.filter(c => c.sectorId !== this.sectorId);
    const choice1 = validChoices[Math.floor(Math.random() * validChoices.length)];
    const choice2 = validChoices.find(c => c.sectorId !== choice1.sectorId) || validChoices[0];

    this.doors.north.open = true;
    this.doors.north.destination = choice1;

    this.doors.east.open = true;
    this.doors.east.destination = choice2;
  }

  // Teste si un cercle (joueur, zombie, projectile) entre en collision avec les murs extérieurs
  collideWithWalls(circle) {
    const r = circle.radius || 16;
    const T = this.wallThickness;
    let collided = false;

    // Mur Nord
    if (circle.y - r < T) {
      // Vérifier si la porte Nord est ouverte et si le cercle est dans le sas
      const door = this.doors.north;
      if (!(door.open && Math.abs(circle.x - door.x) < door.width / 2 - r)) {
        circle.y = T + r;
        collided = true;
      }
    }
    // Mur Sud
    if (circle.y + r > this.height - T) {
      const door = this.doors.south;
      if (!(door.open && Math.abs(circle.x - door.x) < door.width / 2 - r)) {
        circle.y = this.height - T - r;
        collided = true;
      }
    }
    // Mur Ouest
    if (circle.x - r < T) {
      const door = this.doors.west;
      if (!(door.open && Math.abs(circle.y - door.y) < door.height / 2 - r)) {
        circle.x = T + r;
        collided = true;
      }
    }
    // Mur Est
    if (circle.x + r > this.width - T) {
      const door = this.doors.east;
      if (!(door.open && Math.abs(circle.y - door.y) < door.height / 2 - r)) {
        circle.x = this.width - T - r;
        collided = true;
      }
    }

    return collided;
  }

  // Teste et résout la collision avec les obstacles intérieurs
  resolveObstacleCollisions(circle) {
    const r = circle.radius || 16;

    // Obstacles rectangulaires
    for (const ob of this.obstacles) {
      // Trouver le point le plus proche du rectangle
      const closestX = Math.max(ob.x, Math.min(circle.x, ob.x + ob.w));
      const closestY = Math.max(ob.y, Math.min(circle.y, ob.y + ob.h));
      const dx = circle.x - closestX;
      const dy = circle.y - closestY;
      const distSq = dx * dx + dy * dy;

      if (distSq < r * r && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = r - dist;
        circle.x += (dx / dist) * overlap;
        circle.y += (dy / dist) * overlap;
      }
    }

    // Piliers cylindriques
    for (const p of this.pillars) {
      const dx = circle.x - p.x;
      const dy = circle.y - p.y;
      const minDist = r + p.radius;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        circle.x += (dx / dist) * overlap;
        circle.y += (dy / dist) * overlap;
      }
    }

    // Barils intacts
    for (const b of this.barrels) {
      if (b.exploded) continue;
      const dx = circle.x - b.x;
      const dy = circle.y - b.y;
      const minDist = r + b.radius;
      const distSq = dx * dx + dy * dy;

      if (distSq < minDist * minDist && distSq > 0.0001) {
        const dist = Math.sqrt(distSq);
        const overlap = minDist - dist;
        circle.x += (dx / dist) * overlap;
        circle.y += (dy / dist) * overlap;
      }
    }
  }

  // Vérifie si un joueur franchit une porte déverrouillée
  checkDoorTrigger(player) {
    if (this.isLockdown) return null;

    const r = player.radius || 18;
    for (const [key, door] of Object.entries(this.doors)) {
      if (!door.open || !door.destination) continue;
      // Zone d'activation au seuil
      let inside = false;
      if (key === 'north' && player.y <= this.wallThickness + 10 && Math.abs(player.x - door.x) < door.width / 2) inside = true;
      if (key === 'south' && player.y >= this.height - this.wallThickness - 10 && Math.abs(player.x - door.x) < door.width / 2) inside = true;
      if (key === 'east' && player.x >= this.width - this.wallThickness - 10 && Math.abs(player.y - door.y) < door.height / 2) inside = true;
      if (key === 'west' && player.x <= this.wallThickness + 10 && Math.abs(player.y - door.y) < door.height / 2) inside = true;

      if (inside) {
        return { door: key, destination: door.destination };
      }
    }
    return null;
  }

  // Rendu de la salle : sol carrelé texturé, murs métalliques, rayures de danger, portes
  draw(ctx, time, floorImage) {
    const W = this.width;
    const H = this.height;
    const T = this.wallThickness;

    // 1. Fond sombre de base
    ctx.fillStyle = '#0a0d12';
    ctx.fillRect(0, 0, W, H);

    // Dalles de sol industrielles ou texture militaire HD
    const isValidFloor = floorImage && (
      (floorImage.complete && floorImage.naturalWidth > 0) ||
      (floorImage.width > 0 && floorImage.height > 0)
    );

    if (isValidFloor) {
      if (!this.floorPattern || this.lastFloorSource !== floorImage) {
        this.floorPattern = ctx.createPattern(floorImage, 'repeat');
        this.lastFloorSource = floorImage;
      }
      ctx.save();
      ctx.fillStyle = this.floorPattern;
      ctx.fillRect(T, T, W - T * 2, H - T * 2);

      // Teinte d'ambiance du secteur par-dessus la texture
      ctx.fillStyle = this.sector.ambientColor || 'rgba(10, 24, 32, 0.45)';
      ctx.fillRect(T, T, W - T * 2, H - T * 2);
      ctx.restore();
    } else {
      // Sol procédural haute précision
      ctx.fillStyle = '#161b22';
      ctx.fillRect(T, T, W - T * 2, H - T * 2);

      // Dalles métalliques 64x64
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let x = T; x <= W - T; x += 64) {
        ctx.moveTo(x, T);
        ctx.lineTo(x, H - T);
      }
      for (let y = T; y <= H - T; y += 64) {
        ctx.moveTo(T, y);
        ctx.lineTo(W - T, y);
      }
      ctx.stroke();
    }

    // Bandes de sécurité jaunes et noires de danger le long des murs périmétriques
    ctx.save();
    const stripeW = 16;
    ctx.fillStyle = '#ffb300';
    for (let x = T; x < W - T; x += 32) {
      ctx.fillRect(x, T, stripeW, 6);
      ctx.fillRect(x, H - T - 6, stripeW, 6);
    }
    for (let y = T; y < H - T; y += 32) {
      ctx.fillRect(T, y, 6, stripeW);
      ctx.fillRect(W - T - 6, y, 6, stripeW);
    }
    ctx.restore();

    // Numéro de secteur géant gravé au sol en pochoir militaire
    ctx.save();
    ctx.font = '900 120px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`SECTEUR 0${this.roomIndex}`, W / 2, H / 2 - 20);

    ctx.font = 'bold 22px monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.045)';
    ctx.letterSpacing = '6px';
    ctx.fillText('NIVEAU DE CONFINEMENT 4 // BIO-HAZARD', W / 2, H / 2 + 65);
    ctx.restore();

    // 2. Grilles d'aération (points d'apparition des zombies)
    for (const sp of this.spawners) {
      ctx.save();
      ctx.fillStyle = '#0a0d11';
      ctx.fillRect(sp.x - 30, sp.y - 30, 60, 60);
      ctx.strokeStyle = '#263238';
      ctx.lineWidth = 2;
      ctx.strokeRect(sp.x - 30, sp.y - 30, 60, 60);
      // Fentes d'aération
      ctx.strokeStyle = '#37474f';
      ctx.beginPath();
      for (let i = -20; i <= 20; i += 8) {
        ctx.moveTo(sp.x - 22, sp.y + i);
        ctx.lineTo(sp.x + 22, sp.y + i);
      }
      ctx.stroke();
      ctx.restore();
    }

    // 3. Obstacles rectangulaires (Barricades & Caisses 16-bit de pixel_props)
    for (const ob of this.obstacles) {
      CartoonGraphics.drawObstacle(ctx, ob);
    }

    // 4. Piliers et cuves de stase cartoon
    for (const p of this.pillars) {
      ctx.save();
      // Ombre
      ctx.fillStyle = 'rgba(10, 15, 25, 0.45)';
      ctx.beginPath();
      ctx.arc(p.x + 4, p.y + 6, p.radius, 0, Math.PI * 2);
      ctx.fill();

      // Cuve cartoon
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = '#0e1726';
      ctx.stroke();

      if (p.glow) {
        // Liquide visqueux radioactif cartoon
        const pulse = 0.7 + 0.3 * Math.sin(time * 4);
        ctx.fillStyle = p.color || `rgba(132, 204, 22, ${pulse})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Bulles cartoon qui montent
        const b1 = Math.sin(time * 5 + p.x) * 8;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(p.x + b1, p.y - 6, 3, 0, Math.PI * 2);
        ctx.arc(p.x - b1 * 0.5, p.y + 8, 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // 5. Barils explosifs et toxiques cartoon
    for (const b of this.barrels) {
      CartoonGraphics.drawBarrel(ctx, b, time);
    }

    // 6. Murs périmétriques et Sas
    this.drawPerimeterWalls(ctx, time);
  }

  drawPerimeterWalls(ctx, time) {
    const W = this.width;
    const H = this.height;
    const T = this.wallThickness;

    ctx.save();
    ctx.fillStyle = '#1e242b';
    ctx.strokeStyle = '#37474f';
    ctx.lineWidth = 3;

    // Mur Nord (gauche et droite du sas)
    const dN = this.doors.north;
    ctx.fillRect(0, 0, dN.x - dN.width / 2, T);
    ctx.strokeRect(0, 0, dN.x - dN.width / 2, T);
    ctx.fillRect(dN.x + dN.width / 2, 0, W - (dN.x + dN.width / 2), T);
    ctx.strokeRect(dN.x + dN.width / 2, 0, W - (dN.x + dN.width / 2), T);

    // Mur Sud
    const dS = this.doors.south;
    ctx.fillRect(0, H - T, dS.x - dS.width / 2, T);
    ctx.strokeRect(0, H - T, dS.x - dS.width / 2, T);
    ctx.fillRect(dS.x + dS.width / 2, H - T, W - (dS.x + dS.width / 2), T);
    ctx.strokeRect(dS.x + dS.width / 2, H - T, W - (dS.x + dS.width / 2), T);

    // Mur Ouest
    const dW = this.doors.west;
    ctx.fillRect(0, T, T, dW.y - dW.height / 2 - T);
    ctx.strokeRect(0, T, T, dW.y - dW.height / 2 - T);
    ctx.fillRect(0, dW.y + dW.height / 2, T, H - (dW.y + dW.height / 2) - T);
    ctx.strokeRect(0, dW.y + dW.height / 2, T, H - (dW.y + dW.height / 2) - T);

    // Mur Est
    const dE = this.doors.east;
    ctx.fillRect(W - T, T, T, dE.y - dE.height / 2 - T);
    ctx.strokeRect(W - T, T, T, dE.y - dE.height / 2 - T);
    ctx.fillRect(W - T, dE.y + dE.height / 2, T, H - (dE.y + dE.height / 2) - T);
    ctx.strokeRect(W - T, dE.y + dE.height / 2, T, H - (dE.y + dE.height / 2) - T);

    // Rendu des Portes / Sas
    for (const [key, door] of Object.entries(this.doors)) {
      this.drawAirlock(ctx, key, door, time);
    }

    ctx.restore();
  }

  drawAirlock(ctx, key, door, time) {
    ctx.save();
    const isOpen = door.open;

    if (isOpen) {
      // Porte ouverte : lueur verte / cyan d'extraction
      ctx.fillStyle = 'rgba(0, 230, 118, 0.2)';
      if (key === 'north' || key === 'south') {
        ctx.fillRect(door.x - door.width / 2, door.y - door.height / 2, door.width, door.height);
      } else {
        ctx.fillRect(door.x - door.width / 2, door.y - door.height / 2, door.width, door.height);
      }

      // Balise holographique de destination
      if (door.destination) {
        ctx.save();
        ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#00e676';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#00e676';
        ctx.shadowBlur = 8;

        const floatY = Math.sin(time * 4) * 4;
        let tx = door.x;
        let ty = door.y;
        if (key === 'north') ty += 45 + floatY;
        if (key === 'south') ty -= 45 + floatY;
        if (key === 'east') tx -= 75;
        if (key === 'west') tx += 75;

        ctx.fillText(`▲ ${door.destination.label}`, tx, ty);
        ctx.restore();
      }
    } else {
      // Porte fermée sous confinement : rayures de danger et voyant rouge
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.fillStyle = '#212121';
      ctx.fillRect(door.x - door.width / 2, door.y - door.height / 2, door.width, door.height);

      // Voyant rouge
      ctx.fillStyle = `rgba(255, 23, 68, ${pulse})`;
      ctx.beginPath();
      ctx.arc(door.x, door.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // Texte CONFINEMENT
      ctx.save();
      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = '#ff5252';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let tx = door.x;
      let ty = door.y + (key === 'north' ? 22 : key === 'south' ? -22 : 0);
      if (key === 'east') tx -= 35;
      if (key === 'west') tx += 35;
      ctx.fillText('VERROUILLÉ', tx, ty);
      ctx.restore();
    }

    ctx.restore();
  }
}
