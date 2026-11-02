// The Backrooms - Interface utilisateur (HUD), filtre VHS et alertes

export class BackroomsHUD {
  constructor(container) {
    this.el = container;
    this.el.innerHTML = `
      <div class="vhs-overlay" id="vhsOverlay"></div>
      <div class="glitch-overlay" id="glitchOverlay"></div>
      <div class="jumpscare-overlay" id="jumpscareOverlay" hidden></div>

      <!-- Informations VHS en haut à gauche -->
      <div class="vhs-rec">
        <span class="rec-dot">●</span> REC <span id="vhsTimer">00:00:00</span>
      </div>
      <div class="vhs-play">PLAY ▶ SP</div>

      <!-- Viseur central discret -->
      <div class="crosshair"></div>

      <!-- Compteur de cassettes VHS -->
      <div class="cassette-counter" id="cassetteBox">
        <div class="cassette-title">CASSETTES VHS</div>
        <div class="cassette-icons" id="cassetteIcons">
          <span class="cas-slot">📼</span>
          <span class="cas-slot">📼</span>
          <span class="cas-slot">📼</span>
          <span class="cas-slot">📼</span>
          <span class="cas-slot">📼</span>
        </div>
        <div class="cassette-count" id="cassetteText">0 / 5</div>
      </div>

      <!-- Jauge d'endurance -->
      <div class="stamina-box">
        <div class="stamina-bar" id="staminaBar" style="width: 100%;"></div>
        <div class="stamina-label">ENDURANCE (SHIFT)</div>
      </div>

      <!-- Bannière d'objectif -->
      <div class="objective-banner" id="objBanner">
        Trouve les 5 cassettes VHS pour déverrouiller la porte de Sortie (EXIT)
      </div>

      <!-- Lampe torche -->
      <div class="flash-indicator" id="flashStatus">[F] LAMPE : ON</div>

      <!-- Message pour verrouiller le curseur -->
      <div class="click-prompt" id="clickPrompt">
        Clique sur l'écran pour prendre le contrôle
      </div>

      <!-- Écran de Fin (Mort ou Victoire) -->
      <div class="end-screen" id="endScreen" hidden>
        <div class="end-card">
          <h1 id="endTitle">MORT</h1>
          <p id="endSubtitle">L'entité t'a rattrapé...</p>
          <div class="end-stats" id="endStats"></div>
          <button class="btn-restart" id="btnRestart">REJOUER</button>
        </div>
      </div>
    `;

    this.$ = (s) => this.el.querySelector(s);
  }

  update(sim, time) {
    // 1. Minuteur VHS
    const totalSec = Math.floor(time);
    const m = String(Math.floor(totalSec / 60)).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    const ms = String(Math.floor((time % 1) * 100)).padStart(2, '0');
    this.$('#vhsTimer').textContent = `00:${m}:${s}.${ms}`;

    // 2. Compteur de cassettes
    this.$('#cassetteText').textContent = `${sim.player.cassettesCollected} / 5`;
    const slots = this.$('#cassetteIcons').querySelectorAll('.cas-slot');
    slots.forEach((slot, idx) => {
      if (idx < sim.player.cassettesCollected) {
        slot.classList.add('found');
      } else {
        slot.classList.remove('found');
      }
    });

    // 3. Jauge d'endurance
    const stamBar = this.$('#staminaBar');
    stamBar.style.width = `${sim.player.stamina}%`;
    if (sim.player.stamina < 20) {
      stamBar.style.background = '#ef4444'; // rouge critique
    } else if (sim.player.stamina < 50) {
      stamBar.style.background = '#f59e0b'; // orange
    } else {
      stamBar.style.background = '#22c55e'; // vert
    }

    // 4. Lampe torche
    this.$('#flashStatus').textContent = `[F] LAMPE : ${sim.player.flashlight ? 'ON' : 'OFF'}`;

    // 5. Objectif
    const banner = this.$('#objBanner');
    if (sim.player.cassettesCollected >= 5) {
      banner.textContent = '🚪 LA SORTIE EST DÉVERROUILLÉE ! FUIS VERS LE NÉON EXIT VERT !';
      banner.classList.add('unlocked');
    } else {
      banner.textContent = `Trouve les 5 cassettes VHS (${sim.player.cassettesCollected}/5) pour déverrouiller la porte de Sortie (EXIT)`;
      banner.classList.remove('unlocked');
    }

    // 6. Effet de distorsion / glitch VHS selon la proximité du monstre
    const glitch = this.$('#glitchOverlay');
    if (sim.monster.danger > 0.05) {
      glitch.style.opacity = Math.min(0.85, sim.monster.danger * 0.9);
      glitch.style.transform = `scale(${1 + (Math.random() - 0.5) * sim.monster.danger * 0.08})`;
    } else {
      glitch.style.opacity = 0;
    }
  }

  showJumpscare() {
    const j = this.$('#jumpscareOverlay');
    j.hidden = false;
    j.classList.add('flash');
    setTimeout(() => {
      j.hidden = true;
    }, 900);
  }

  showEnd(sim, onRestart) {
    const end = this.$('#endScreen');
    const title = this.$('#endTitle');
    const sub = this.$('#endSubtitle');
    const stats = this.$('#endStats');

    end.hidden = false;

    if (sim.state === 'won') {
      title.textContent = "TU T'ES ÉCHAPPÉ !";
      title.style.color = '#22c55e';
      sub.textContent = 'Tu as réussi à survivre aux Backrooms et à trouver la sortie.';
      stats.textContent = `Temps d'évasion : ${sim.time.toFixed(1)} secondes · 5/5 cassettes récupérées`;
    } else {
      title.textContent = 'TU AS PÉRI';
      title.style.color = '#ef4444';
      sub.textContent = "L'entité t'a rattrapé dans les couloirs infinis...";
      stats.textContent = `Cassettes trouvées : ${sim.player.cassettesCollected}/5 · Survécu pendant ${sim.time.toFixed(1)} s`;
    }

    this.$('#btnRestart').onclick = () => {
      end.hidden = true;
      if (onRestart) onRestart();
    };
  }

  setPromptVisible(visible) {
    this.$('#clickPrompt').style.display = visible ? 'block' : 'none';
  }
}
