// Point d'entrée principal pour Dogfight 3D : Bataille Aérienne.
// Initialisation de Three.js, génération de l'île, boucle de jeu et pont réseau HubBridge.
import { generateMap, ILE } from '../royale/engine/map.js';
import { createDogfightGame, tickDogfight, COLORS } from './engine/rules.js';
import { computeBotFlightInput } from './engine/ai.js';
import { DogfightScene } from './view/scene.js';
import { CockpitHUD } from './view/hud.js';
import { DogfightAudio } from './view/sfx.js';
import { FlightControls } from './view/controls.js';
import { preloadF16Model } from './view/plane.js';

const H = window.HubBridge;
const BOT_NAMES = ['Viper', 'Maverick', 'Iceman', 'Goose', 'Jester', 'Ghost'];

class DogfightApp {
  constructor() {
    this.stage = document.getElementById('stage');
    this.hudCanvas = document.getElementById('hudCanvas');
    this.btnSet = document.getElementById('btnSet');
    this.btnExit = document.getElementById('btnExit');
    this.loadingOverlay = document.getElementById('loadingOverlay');
    this.briefingModal = document.getElementById('briefingModal');
    this.btnStart = document.getElementById('btnStart');
    this.briefingDismissed = false;

    this.audio = new DogfightAudio();
    this.controls = new FlightControls({
      onFirstGesture: () => this.audio.unlock(),
    });

    this.map = null;
    this.scene = null;
    this.hud = null;

    this.role = 'solo';
    this.myId = 'p1';
    this.gameState = null;
    this.settings = {};
    this.players = [];
    this.reported = false;
    this.lastBroadcast = 0;
    this.lastInputSend = 0;

    this.setupUI();
    this.setupEndScreen();
    this.init();
  }

  // Écran de fin : podium, classement et « Rejouer » (Entrée)
  setupEndScreen() {
    const el = document.createElement('div');
    el.id = 'endScreen';
    el.className = 'end-screen hidden';
    el.innerHTML = `<div class="end-card"><div class="end-badge">FIN DU COMBAT</div><h1 id="endTitle"></h1>
      <table class="end-table"><tbody id="endRows"></tbody></table>
      <button class="end-btn" id="btnAgain">🔁 REJOUER (Entrée)</button><div class="end-wait" id="endWait">En attente de l'hôte…</div></div>`;
    document.getElementById('app').appendChild(el);
    this.endScreen = el;
    el.querySelector('#btnAgain').addEventListener('click', () => this.restart());
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        if (this.hud) this.hud.showBoard = true;
      }
      if (e.code === 'Enter' && !this.endScreen.classList.contains('hidden')) this.restart();
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Tab' && this.hud) this.hud.showBoard = false;
    });
  }

  showEndScreen() {
    const st = this.gameState;
    if (!st || !this.endScreen) return;
    const ranking = [...st.planes].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    const me = st.planes.find((p) => p.id === this.myId);
    const won = st.winner && st.winner.id === this.myId;
    this.endScreen.querySelector('#endTitle').textContent = won ? '🏆 VICTOIRE !' : `${(st.winner && st.winner.name) || ranking[0].name} remporte le ciel`;
    this.endScreen.querySelector('#endRows').innerHTML = ranking.map((p, i) => `<tr class="${p.id === this.myId ? 'me' : ''}">
      <td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><i style="background:${p.color}"></i>${escapeHtml(p.name)}${p.bot ? ' <small>IA</small>' : ''}</td>
      <td><b>${p.kills}</b> élim.</td><td>${p.deaths} morts</td></tr>`).join('');
    const canRestart = this.role !== 'guest';
    this.endScreen.querySelector('#btnAgain').hidden = !canRestart;
    this.endScreen.querySelector('#endWait').hidden = canRestart;
    this.endScreen.classList.remove('hidden');
    if (me) this.audio.updateEngine(0, false, true);
  }

  // Nouvelle manche avec les mêmes pilotes (l'hôte la diffuse aux invités)
  restart() {
    if (this.role === 'guest' || !this.gameState || this.gameState.phase !== 'game_over') return;
    this.gameState = createDogfightGame({ settings: this.settings, players: this.players, map: this.map });
    this.reported = false;
    this.endScreen.classList.add('hidden');
    if (this.scene) this.scene.cameraInitialized = false;
  }

  setupUI() {
    if (window.DDVolume && this.btnSet) {
      this.btnSet.innerHTML = window.DDVolume.ICON || '⚙️';
      window.DDVolume.panel(this.btnSet, {
        accent: '#2563eb',
        kinds: ['fx', 'music'],
        hint: 'Touche <kbd>M</kbd> : couper le son.',
        test: () => this.audio.playVulcanShot(),
        sections: [
          {
            title: 'Pilotage & Armement',
            items: [
              {
                keys: [
                  ['Virer & Incliner (Clavier)', '<kbd>Q</kbd> / <kbd>D</kbd> ou <kbd>←</kbd> / <kbd>→</kbd>', 'Stick gauche (X)'],
                  ['Tangage (Clavier)', '<kbd>Z</kbd> (pique) / <kbd>S</kbd> (cabre) ou <kbd>↑</kbd> / <kbd>↓</kbd>', 'Stick gauche (Y)'],
                  ['Tirer au canon M61 Vulcan', '<kbd>Espace</kbd> ou <kbd>Clic gauche</kbd>', 'Bouton A / Gâchette'],
                  ['Postcombustion (Boost)', '<kbd>Maj</kbd> (Shift)', 'R1 / Gâchette haute'],
                  ['Aérofrein', '<kbd>Ctrl</kbd> ou <kbd>C</kbd> / <kbd>X</kbd>', 'L1'],
                  ['Vol en ligne droite', 'Relâcher les touches', 'Centrer le stick'],
                ],
              },
            ],
          },
        ],
      });
    }

    if (this.btnExit) {
      this.btnExit.addEventListener('click', () => {
        if (H && H.embedded) {
          H.exit();
        } else {
          location.reload();
        }
      });
    }
  }

  async init() {
    const statusEl = document.getElementById('loadStatus');
    if (statusEl) statusEl.textContent = 'Chargement des chasseurs F-16…';

    // 0. Préchargement du modèle 3D haute fidélité F-16
    try {
      await preloadF16Model();
    } catch (e) {
      console.warn('Impossible de charger f-16.glb, utilisation du modèle de secours:', e);
    }

    // 1. Génération de l'île 3D (1600m x 1600m)
    if (statusEl) statusEl.textContent = "Génération de l'île en cours…";
    await new Promise((resolve) => setTimeout(resolve, 50));
    this.map = generateMap(ILE);

    // 2. Initialisation du rendu Three.js et du HUD
    this.scene = new DogfightScene(this.stage, this.map);
    this.hud = new CockpitHUD(this.hudCanvas);

    this.resizeHud();
    window.addEventListener('resize', () => this.resizeHud());

    // 3. Masquer l'écran de chargement et afficher le briefing
    if (this.loadingOverlay) {
      this.loadingOverlay.classList.add('hidden');
    }
    this.showBriefing();

    if (H && H.embedded) {
      H.on('init', (info) => this.boot(info));
      H.on('msg', (from, m) => this.handleMessage(from, m));
      H.on('roster', () => this.handleRoster());
    } else {
      // Lancement autonome hors Hub (http://localhost:8000/dogfight/)
      const qs = new URLSearchParams(location.search);
      const bots = qs.get('bots') !== null ? Number(qs.get('bots')) : 3;
      const kills = Number(qs.get('kills') || 8);
      const level = qs.get('level') || 'normal';

      this.boot({
        role: 'solo',
        myId: 'local-p1',
        settings: {
          kills,
          bots,
          level,
        },
      });
    }
  }

  showBriefing() {
    if (!this.briefingModal) return;
    this.briefingModal.classList.remove('hidden');

    const onStart = () => {
      if (this.briefingDismissed) return;
      this.briefingDismissed = true;
      this.briefingModal.classList.add('hidden');
      this.audio.unlock();
      if (this.controls) this.controls.triggerGesture();
    };

    if (this.btnStart) {
      this.btnStart.addEventListener('click', onStart);
    }

    const onKey = (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        onStart();
        window.removeEventListener('keydown', onKey);
      }
    };
    window.addEventListener('keydown', onKey);
  }

  resizeHud() {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.hudCanvas.width = Math.floor(w * dpr);
    this.hudCanvas.height = Math.floor(h * dpr);
    const ctx = this.hudCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  boot(info) {
    this.role = info.role || 'solo';
    this.myId = info.myId || 'p1';
    this.settings = info.settings || { kills: 8, bots: 3, level: 'normal' };
    this.reported = false;

    if (this.role === 'solo') {
      const numBots = Number(this.settings.bots ?? 3);
      this.players = [
        { id: this.myId, name: 'As du Ciel', bot: false, color: COLORS[0] },
      ];
      for (let i = 0; i < numBots; i++) {
        this.players.push({
          id: `bot-${i + 1}`,
          name: BOT_NAMES[i % BOT_NAMES.length],
          bot: true,
          botLevel: this.settings.level || 'normal',
          color: COLORS[(i + 1) % COLORS.length],
        });
      }
    } else {
      const hubPlayers = H && H.players ? H.players : [];
      this.players = hubPlayers.map((p, idx) => ({
        id: p.id,
        name: p.name || `Pilote ${idx + 1}`,
        color: p.color || COLORS[idx % COLORS.length],
        bot: Boolean(p.bot),
        botLevel: this.settings.level || 'normal',
      }));

      const desiredBots = Number(this.settings.bots ?? 0);
      for (let b = 0; b < desiredBots && this.players.length < 6; b++) {
        this.players.push({
          id: `bot-${b + 1}`,
          name: BOT_NAMES[b % BOT_NAMES.length],
          bot: true,
          botLevel: this.settings.level || 'normal',
          color: COLORS[this.players.length % COLORS.length],
        });
      }
    }

    if (this.role === 'host' || this.role === 'solo') {
      this.gameState = createDogfightGame({
        settings: this.settings,
        players: this.players,
        map: this.map,
      });
    }

    if (H && H.signalReady) {
      H.signalReady();
      if (H.shown) H.shown();
    }

    this.startLoop();
  }

  handleMessage(from, m) {
    if (!m) return;

    if (m.t === 'inp' && (this.role === 'host' || this.role === 'solo')) {
      const plane = this.gameState.planes.find((p) => p.id === from);
      if (plane) plane.input = m.input;
    } else if (m.t === 'st' && this.role === 'guest') {
      const wasOver = this.gameState && this.gameState.phase === 'game_over';
      this.gameState = m.s;
      if (wasOver && m.s.phase !== 'game_over') this.endScreen.classList.add('hidden');
      if (!wasOver && m.s.phase === 'game_over') this.showEndScreen();
      if (this.gameState && this.gameState.events) {
        this.processAudioAndHudEvents(this.gameState.events);
      }
    }
  }

  handleRoster() {
    if (!H) return;
    if (H.info && H.info.role === 'host' && this.role !== 'host') {
      this.role = 'host';
    }
  }

  processAudioAndHudEvents(events) {
    for (const ev of events) {
      if (ev.type === 'fire') {
        if (ev.ownerId === this.myId) {
          this.audio.playVulcanShot();
        }
      } else if (ev.type === 'game_over') {
        if (this.role !== 'guest') this.showEndScreen();
      } else if (ev.type === 'hit') {
        if (ev.targetId !== this.myId) {
          this.hud.triggerHitMarker();
        }
        this.audio.playHit();
      } else if (ev.type === 'overheat') {
        if (ev.ownerId === this.myId) {
          this.audio.playOverheat();
        }
      } else if (ev.type === 'kill') {
        this.hud.addKillMessage(ev.killerName, ev.victimName);
        this.audio.playExplosion();
      } else if (ev.type === 'crash') {
        this.hud.addKillMessage('RELIEF', ev.victimName);
        this.audio.playExplosion();
      }
    }
  }

  startLoop() {
    let lastTime = performance.now();

    const loop = (time) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000);
      lastTime = time;

      this.update(dt);
      this.render(dt);

      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  update(dt) {
    if (!this.briefingDismissed) {
      return;
    }

    const myInput = this.controls.getInput();

    if (this.role === 'host' || this.role === 'solo') {
      if (!this.gameState) return;

      // 1. Commandes du joueur local
      const myPlane = this.gameState.planes.find((p) => p.id === this.myId);
      if (myPlane) {
        myPlane.input = myInput;
      }

      // 2. Commandes des bots
      for (const p of this.gameState.planes) {
        if (p.bot && p.alive) {
          p.input = computeBotFlightInput(p, this.gameState.planes, this.map, dt);
        }
      }

      // 3. Avancer la simulation
      tickDogfight(this.gameState, dt, this.map);

      // 4. Sons et retours
      if (this.gameState.events && this.gameState.events.length > 0) {
        this.processAudioAndHudEvents(this.gameState.events);
      }

      // Son du réacteur local
      if (myPlane && myPlane.alive) {
        this.audio.updateEngine(myPlane.speed, myPlane.flight.boosting, myPlane.flight.braking);
      }

      // 5. Diffusion réseau (30 Hz)
      const now = performance.now();
      if (this.role === 'host' && H && now - this.lastBroadcast > 33) {
        this.lastBroadcast = now;
        H.send('all', { t: 'st', s: this.gameState });
      }

      // 6. Fin de partie
      if (this.gameState.phase === 'game_over' && !this.reported) {
        this.reported = true;
        this.reportResult();
      }
    } else if (this.role === 'guest') {
      const now = performance.now();
      if (H && now - this.lastInputSend > 33) {
        this.lastInputSend = now;
        H.send('host', { t: 'inp', input: myInput });
      }

      const myPlane = this.gameState ? this.gameState.planes.find((p) => p.id === this.myId) : null;
      if (myPlane && myPlane.alive) {
        this.audio.updateEngine(myPlane.speed, myPlane.flight.boosting, myPlane.flight.braking);
      }
    }
  }

  reportResult() {
    if (!H || !H.embedded || !H.report || !this.gameState) return;
    const ranking = [...this.gameState.planes].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
    H.report({
      id: `dogfight-${Date.now()}-${ranking.map((p) => p.id).join('.')}`,
      mode: 'Bataille Aérienne',
      players: ranking.map((p, idx) => ({
        id: p.bot ? null : p.id,
        name: p.name,
        color: p.color,
        bot: p.bot,
        rank: idx + 1,
        score: p.kills,
      })),
    });
  }

  render(dt) {
    if (!this.gameState || !this.scene) return;

    // Rendu 3D
    this.scene.render(this.gameState, this.myId, dt);

    // Rendu HUD 2D
    const myPlane = this.gameState.planes.find((p) => p.id === this.myId);
    this.hud.render(myPlane, this.gameState.planes, this.scene.camera, dt, this.gameState);
  }
}

function escapeHtml(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function start() {
  if (window.__dogfight) return;
  try {
    window.__dogfight = new DogfightApp();
  } catch (err) {
    console.error('Erreur démarrage Dogfight 3D:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
