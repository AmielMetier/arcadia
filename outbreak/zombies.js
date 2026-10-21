// ============================================================================
// OUTBREAK : SECTEUR ZÉRO - ZOMBIE BESTIARY & AI LOGIC
// ============================================================================

export const ZOMBIE_TYPES = {
  walker: {
    id: 'walker',
    name: 'Contaminé Shambler',
    hp: 60,
    speed: 115,
    damage: 15,
    attackDelay: 0.8,
    radius: 17,
    color: '#4e6d58',
    score: 100,
    dropRate: 0.35
  },
  crawler: {
    id: 'crawler',
    name: 'Rampeur Déchiqueté',
    hp: 35,
    speed: 75,
    damage: 14,
    attackDelay: 0.9,
    radius: 14,
    color: '#5d8248',
    score: 90,
    dropRate: 0.25
  },
  runner: {
    id: 'runner',
    name: 'Écorcheur Furtif',
    hp: 40,
    speed: 235,
    damage: 12,
    attackDelay: 0.55,
    radius: 14,
    color: '#b71c1c',
    score: 150,
    dropRate: 0.45
  },
  spitter: {
    id: 'spitter',
    name: 'Cracheur Caustique',
    hp: 65,
    speed: 100,
    damage: 22,
    attackDelay: 2.2,
    attackRange: 380,
    radius: 16,
    color: '#64dd17',
    score: 220,
    dropRate: 0.5
  },
  titan: {
    id: 'titan',
    name: 'Béhémoth Blindé',
    hp: 360,
    speed: 75,
    damage: 38,
    attackDelay: 1.2,
    radius: 28,
    color: '#263238',
    score: 450,
    dropRate: 0.85
  },
  boss: {
    id: 'boss',
    name: 'Spécimen Zéro (Alpha)',
    hp: 1500,
    speed: 105,
    damage: 45,
    attackDelay: 1.0,
    radius: 40,
    color: '#4a148c',
    score: 3000,
    dropRate: 1.0
  }
};

export class Zombie {
  constructor(typeId = 'walker', x = 0, y = 0, waveScale = 1.0) {
    this.id = 'z_' + Math.random().toString(36).substr(2, 9);
    this.typeId = typeId;
    this.config = ZOMBIE_TYPES[typeId] || ZOMBIE_TYPES.walker;

    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = this.config.radius;

    // Échelle selon vague et difficulté
    this.maxHp = Math.round(this.config.hp * waveScale);
    this.hp = this.maxHp;
    this.speed = this.config.speed * (0.95 + Math.random() * 0.1);
    this.damage = Math.round(this.config.damage * (1 + (waveScale - 1) * 0.25));

    this.angle = Math.random() * Math.PI * 2;
    this.attackTimer = 0;
    this.hitFlashTimer = 0;
    this.isDead = false;

    // Boss special
    this.isBoss = typeId === 'boss';
    this.bossPhase = 1;
    this.bossSpecialTimer = 3.0;

    // Spitter cooldown
    this.spitCooldown = 1.5 + Math.random() * 1.5;
  }

  takeDamage(amount, knockbackAngle = 0, knockbackForce = 0) {
    if (this.isDead) return false;

    this.hp -= amount;
    this.hitFlashTimer = 0.12;

    if (knockbackForce > 0) {
      this.vx += Math.cos(knockbackAngle) * knockbackForce;
      this.vy += Math.sin(knockbackAngle) * knockbackForce;
    }

    if (this.hp <= 0) {
      this.isDead = true;
      return true; // Moribond / Mort
    }
    return false;
  }

  update(dt, players, mapRoom, acidPuddles, projectiles, soundEngine) {
    if (this.isDead) return;

    if (this.hitFlashTimer > 0) {
      this.hitFlashTimer -= dt;
    }
    if (this.attackTimer > 0) {
      this.attackTimer -= dt;
    }

    // Amortissement du knockback
    this.vx *= 0.88;
    this.vy *= 0.88;

    // 1. Trouver la cible la plus proche (joueur vivant)
    let target = null;
    let minDistSq = Infinity;

    for (const p of players) {
      if (!p || p.hp <= 0) continue;
      const dx = p.x - this.x;
      const dy = p.y - this.y;
      const distSq = dx * dx + dy * dy;

      // Préférer les joueurs actifs aux joueurs à terre
      const weightedDist = p.isDowned ? distSq * 2.5 : distSq;
      if (weightedDist < minDistSq) {
        minDistSq = weightedDist;
        target = p;
      }
    }

    if (target) {
      const dx = target.x - this.x;
      const dy = target.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.angle = Math.atan2(dy, dx);

      // Comportement selon le type
      if (this.typeId === 'spitter') {
        // Le cracheur garde ses distances (280-350 px)
        this.spitCooldown -= dt;
        if (dist < 260) {
          // Reculer pour fuir
          this.vx -= (dx / dist) * this.speed * dt * 3.5;
          this.vy -= (dy / dist) * this.speed * dt * 3.5;
        } else if (dist > 360) {
          // Avancer
          this.vx += (dx / dist) * this.speed * dt * 3.5;
          this.vy += (dy / dist) * this.speed * dt * 3.5;
        }

        // Cracher un projectile d'acide
        if (this.spitCooldown <= 0 && dist <= 420) {
          this.spitCooldown = this.config.attackDelay;
          if (projectiles) {
            projectiles.push({
              x: this.x,
              y: this.y,
              vx: (dx / dist) * 450,
              vy: (dy / dist) * 450,
              radius: 7,
              damage: this.damage,
              color: '#76ff03',
              isAcid: true,
              lifetime: 1.5
            });
            if (soundEngine) soundEngine.playFleshHit();
          }
        }
      } else if (this.isBoss) {
        // Comportement Boss (Spécimen Zéro)
        this.bossSpecialTimer -= dt;
        this.vx += (dx / dist) * this.speed * dt * 4.0;
        this.vy += (dy / dist) * this.speed * dt * 4.0;

        if (this.bossSpecialTimer <= 0) {
          this.bossSpecialTimer = 4.0;
          // Tir radial de 6 épines toxiques
          if (projectiles) {
            const count = 8;
            for (let i = 0; i < count; i++) {
              const a = this.angle + (i / count) * Math.PI * 2;
              projectiles.push({
                x: this.x,
                y: this.y,
                vx: Math.cos(a) * 380,
                vy: Math.sin(a) * 380,
                radius: 6,
                damage: 18,
                color: '#d500f9',
                isAcid: true,
                lifetime: 2.2
              });
            }
          }
          if (soundEngine) soundEngine.playAlarm();
        }
      } else {
        // Shambler, Runner, Titan, Crawler : fonce directement sur le joueur
        let actualSpeed = this.speed;
        // Titan enragé à moins de 35% de vie
        if (this.typeId === 'titan' && this.hp < this.maxHp * 0.35) {
          actualSpeed *= 1.45;
        }

        const dirX = dx / dist;
        const dirY = dy / dist;
        this.vx += (dirX * actualSpeed - this.vx) * 0.32;
        this.vy += (dirY * actualSpeed - this.vy) * 0.32;
      }

      // Attaque au corps à corps
      const attackDist = this.radius + target.radius + 6;
      if (dist < attackDist && this.attackTimer <= 0) {
        this.attackTimer = this.config.attackDelay;
        target.takeDamage(this.damage, this.angle);
        if (soundEngine) {
          soundEngine.playZombieGroan(this.typeId === 'titan' ? 'titan' : 'attack');
        }
      }
    }

    // Appliquer déplacement en px/s
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Collisions avec les murs et les obstacles
    if (mapRoom) {
      mapRoom.collideWithWalls(this);
      mapRoom.resolveObstacleCollisions(this);
    }
  }

  draw(ctx) {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Ombre sous le zombie
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.arc(3, 4, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Flash blanc en cas de tir reçu
    if (this.hitFlashTimer > 0) {
      ctx.fillStyle = '#ffffff';
    } else {
      ctx.fillStyle = this.config.color;
    }

    // Corps du zombie
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#1a2327';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Bras tendus en avant
    ctx.fillStyle = this.hitFlashTimer > 0 ? '#ffffff' : this.config.color;
    ctx.fillRect(this.radius * 0.3, -this.radius * 0.7, this.radius * 0.9, this.radius * 0.4);
    ctx.fillRect(this.radius * 0.3, this.radius * 0.3, this.radius * 0.9, this.radius * 0.4);

    // Yeux luisants (effrayants dans la pénombre)
    ctx.fillStyle = this.typeId === 'spitter' ? '#00e676' : this.isBoss ? '#ea80fc' : '#ff1744';
    ctx.beginPath();
    ctx.arc(this.radius * 0.5, -this.radius * 0.35, 2.5, 0, Math.PI * 2);
    ctx.arc(this.radius * 0.5, this.radius * 0.35, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Jauge de vie au-dessus de la tête (pour les Titans et le Boss)
    ctx.restore();

    if (this.isBoss || (this.typeId === 'titan' && this.hp < this.maxHp)) {
      ctx.save();
      const barW = this.isBoss ? 80 : 44;
      const barH = this.isBoss ? 8 : 5;
      const barX = this.x - barW / 2;
      const barY = this.y - this.radius - 14;

      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);

      const ratio = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = this.isBoss ? '#e040fb' : '#ff9100';
      ctx.fillRect(barX, barY, barW * ratio, barH);
      ctx.restore();
    }
  }
}
