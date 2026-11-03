// The Backrooms - Interface façon caméscope (REC, signal, bande), jumpscare et écran de fin
import { ENTITY_IMG } from './scene.js';

export class BackroomsHUD {
  constructor(container, actions = {}) {
    this.el = container;
    this.actions = actions;
    this.el.innerHTML = `
      <div class="jumpscare-overlay" id="jumpscareOverlay" hidden><img id="scareImg" alt=""></div>

      <!-- Incrustations du caméscope -->
      <div class="cam cam-tl">
        <div class="vhs-rec"><span class="rec-dot">●</span> REC</div>
        <div class="vhs-play">PLAY ▶ SP</div>
      </div>
      <div class="cam cam-tr">
        <div class="battery" id="battery"><i></i></div>
        <div id="vhsTimer">00:00:00</div>
      </div>
      <div class="cam cam-bl">
        <div class="tape-date" id="tapeDate"></div>
        <div class="stamina"><span>SOUFFLE</span><div class="stamina-track"><div class="stamina-bar" id="staminaBar"></div></div></div>
      </div>
      <div class="cam cam-br">
        <div class="tapes"><span id="cassetteIcons"></span> <b id="cassetteText">0/5</b></div>
        <div class="signal"><span id="signalLabel">SIGNAL</span> <span id="signalBars"></span></div>
        <div class="flash-indicator" id="flashStatus">[F] LAMPE ON</div>
      </div>

      <!-- Inventaire : trois cases pour les piles et l'eau d'amande -->
      <div class="inv" id="inv">${[0, 1, 2].map((i) => `<button class="slot" data-slot="${i}"><b>${i + 1}</b><span></span></button>`).join('')}</div>

      <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>
      <div class="crosshair"></div>

      <div class="objective-banner" id="objBanner"></div>
      <div class="toast" id="toast" hidden></div>

      <!-- Pause : prendre le contrôle et choisir ses commandes -->
      <div class="click-prompt" id="clickPrompt">
        <div class="pause-title">II PAUSE</div>
        <div class="pause-go" id="pauseGo"></div>
        <div class="ctrl-choice">
          <span>COMMANDES</span>
          <button data-kb="0">SOURIS</button>
          <button data-kb="1">SANS SOURIS</button>
        </div>
        <small id="pauseKeys"></small>
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
    this.invKey = '';
    this.$('#inv').addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.slot');
      if (!b) return;
      e.preventDefault();
      e.stopPropagation();
      this.actions.use?.(+b.dataset.slot);
    });
    this.$('#clickPrompt').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-kb]');
      if (b) this.actions.setKbMode?.(b.dataset.kb === '1');
      else this.actions.play?.();
    });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' && !this.$('#endScreen').hidden) this.$('#btnRestart').click();
    });
    const img = this.$('#scareImg');
    img.onerror = () => img.remove();
    img.src = ENTITY_IMG;

    // date du caméscope, figée en 1996 comme une vieille cassette retrouvée
    const d = new Date();
    this.$('#tapeDate').textContent = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.1996`;
    this.bannerT = 9;
    this.lastCount = -1;
    this.toastT = 0;
  }

  update(sim, time, dt = 1 / 60) {
    const P = sim.player;

    // 1. Compteur de bande
    const totalSec = Math.floor(time);
    const h = String(Math.floor(totalSec / 3600)).padStart(2, '0');
    const m = String(Math.floor(totalSec / 60) % 60).padStart(2, '0');
    const s = String(totalSec % 60).padStart(2, '0');
    this.$('#vhsTimer').textContent = `${h}:${m}:${s}`;
    // la batterie se vide doucement (purement décorative)
    // la batterie du caméscope, c'est la pile de la lampe
    const bat = P.battery ?? 100;
    this.$('#battery').style.setProperty('--b', Math.max(0.04, bat / 100).toFixed(3));
    this.$('#battery').classList.toggle('low', bat < 20);

    // 2. Cassettes
    if (P.cassettesCollected !== this.lastCount) {
      this.lastCount = P.cassettesCollected;
      this.$('#cassetteIcons').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < P.cassettesCollected ? 'on' : ''}"></i>`).join('');
      this.$('#cassetteText').textContent = `${P.cassettesCollected}/5`;
      this.bannerT = 6;
      const banner = this.$('#objBanner');
      if (P.cassettesCollected >= 5) {
        banner.textContent = 'LA SORTIE EST OUVERTE : SUIS LE SIGNAL JUSQU\'À LA PORTE EXIT';
        banner.classList.add('unlocked');
      } else {
        banner.textContent = P.cassettesCollected === 0
          ? 'RETROUVE LES 5 CASSETTES VHS · LE SIGNAL MONTE QUAND TU T\'EN APPROCHES'
          : `CASSETTE ${P.cassettesCollected}/5 RÉCUPÉRÉE`;
        banner.classList.remove('unlocked');
      }
    }
    this.bannerT -= dt;
    this.$('#objBanner').classList.toggle('hide', this.bannerT <= 0);

    // 3. Signal de la cassette (ou de la sortie) la plus proche
    const bars = Math.round(P.signal * 5);
    const flick = P.signal > 0 && Math.random() < 0.08 ? Math.max(0, bars - 1) : bars;
    this.$('#signalBars').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < flick ? 'on' : ''}" style="height:${6 + i * 3}px"></i>`).join('');
    this.$('#signalLabel').textContent = P.cassettesCollected >= 5 ? 'SORTIE' : 'SIGNAL';

    // 4. Souffle (endurance)
    const stamBar = this.$('#staminaBar');
    stamBar.style.width = `${P.stamina}%`;
    stamBar.classList.toggle('low', P.stamina < 25);

    // 4b. Inventaire
    const inv = P.inv || [];
    const key = inv.join(',');
    if (key !== this.invKey) {
      this.invKey = key;
      this.$('#inv').querySelectorAll('.slot').forEach((b, i) => {
        const k = inv[i];
        b.classList.toggle('full', !!k);
        b.querySelector('span').innerHTML = k === 'battery' ? '<i class="ico-bat"></i>PILE' : k === 'bottle' ? '<i class="ico-bot"></i>AMANDE' : '';
      });
    }

    // 5. Lampe torche
    this.$('#flashStatus').textContent = `[F] LAMPE ${P.flashlight ? 'ON' : 'OFF'}`;

    // 6. Message passager
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.$('#toast').hidden = true;
    }
  }

  toast(text) {
    const t = this.$('#toast');
    t.textContent = text;
    t.hidden = false;
    this.toastT = 2.5;
  }

  showJumpscare() {
    const j = this.$('#jumpscareOverlay');
    j.hidden = false;
    j.classList.remove('flash');
    void j.offsetWidth;
    j.classList.add('flash');
    setTimeout(() => {
      j.hidden = true;
    }, 1400);
  }

  showEnd(sim, onRestart) {
    const end = this.$('#endScreen');
    const title = this.$('#endTitle');
    const sub = this.$('#endSubtitle');
    const stats = this.$('#endStats');

    // laisser le jumpscare à l'écran avant la carte de fin
    setTimeout(() => {
      end.hidden = false;
    }, sim.state === 'dead' ? 1300 : 300);

    if (sim.state === 'won') {
      title.textContent = "TU T'ES ÉCHAPPÉ !";
      title.style.color = '#22c55e';
      sub.textContent = 'Tu as réussi à survivre aux Backrooms et à trouver la sortie.';
      stats.textContent = `Temps d'évasion : ${formatTime(sim.time)} · 5/5 cassettes récupérées`;
    } else {
      title.textContent = 'TU AS PÉRI';
      title.style.color = '#ef4444';
      sub.textContent = "L'entité t'a rattrapé dans les couloirs infinis...";
      stats.textContent = `Cassettes trouvées : ${sim.player.cassettesCollected}/5 · Survécu pendant ${formatTime(sim.time)}`;
    }

    this.$('#btnRestart').onclick = () => {
      end.hidden = true;
      this.lastCount = -1;
      if (onRestart) onRestart();
    };
  }

  showPause(visible, kb) {
    this.$('#clickPrompt').style.display = visible ? 'block' : 'none';
    const tactile = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
    this.$('#pauseGo').textContent = tactile ? "TOUCHE L'ÉCRAN POUR JOUER" : kb ? 'APPUIE SUR ENTRÉE POUR JOUER' : "CLIQUE POUR PRENDRE LE CONTRÔLE";
    this.$('#pauseKeys').textContent = kb
      ? 'ZQSD marcher · Flèches regarder · Maj courir · F lampe · Échap pause'
      : 'ZQSD marcher · Souris regarder · Maj courir · F lampe · Échap pause';
    for (const b of this.el.querySelectorAll('button[data-kb]')) b.classList.toggle('on', (b.dataset.kb === '1') === kb);
  }
}

function formatTime(t) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}
