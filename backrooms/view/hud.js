// The Backrooms - Interface façon caméscope (REC, signal, bande), jumpscare et écran de fin
import { ENTITY_IMG, ENTITY_ANIM } from './scene.js';
import { DEPART_T, PIPES_LEVEL } from '../engine/sim.js';

const GOAT_DEATH_IMG = new URL('../img/bouc.jpg', import.meta.url).href;
const GOAT_DEATH_FADE = 8; // secondes de montée de l'image

// nom affiché d'un niveau : le troisième, ce sont les Poolrooms (Level 37) ; le quatrième, les Tuyauteries (Level 2)
export const levelName = (lv) => (lv === 2 ? 37 : lv === PIPES_LEVEL ? 2 : lv);
// Poolrooms : le toboggan pris par l'équipe (ou null)
const slideOf = (sim) => (sim.map.slides && sim.slide >= 0 ? sim.map.slides[sim.slide] : null);
export const levelSub = (lv) => (lv === PIPES_LEVEL ? 'Pipe Dreams · the service tunnels' : lv === 2 ? 'The Poolrooms' : lv === 1 ? 'The industrial basement' : '');

export class BackroomsHUD {
  constructor(container, actions = {}) {
    this.el = container;
    this.actions = actions;
    this.el.innerHTML = `
      <div class="jumpscare-overlay" id="jumpscareOverlay" hidden><img id="scareImg" alt=""><div class="scare-anim" id="scareAnim" hidden></div></div>
      <div class="goat-death" id="goatDeath" hidden>
        <div class="gd-pic" id="gdImg">
          <img class="gd-img" src="${GOAT_DEATH_IMG}" alt="">
          <img class="gd-img gd-red" src="${GOAT_DEATH_IMG}" alt="">
          <img class="gd-img gd-cyan" src="${GOAT_DEATH_IMG}" alt="">
          <div class="gd-grain" id="gdGrain"></div>
        </div>
        <div class="gd-vignette"></div>
      </div>

      <!-- Incrustations du caméscope -->
      <div class="cam cam-tl">
        <div class="vhs-rec"><span class="rec-dot">●</span> REC</div>
        <div class="vhs-play">PLAY ▶ SP</div>
        <div class="vhs-level" id="levelTag">LEVEL 0</div>
        <div class="blackout-tag" id="blackoutTag" hidden>⚠ POWER OUTAGE</div>
      </div>
      <div class="cam cam-tr">
        <div class="battery" id="battery"><i></i></div>
        <div id="vhsTimer">00:00:00</div>
      </div>
      <div class="cam cam-bl">
        <div class="tape-date" id="tapeDate"></div>
        <div class="stamina"><span>STAMINA</span><div class="stamina-track"><div class="stamina-bar" id="staminaBar"></div></div></div>
      </div>
      <div class="cam cam-br">
        <div class="tapes"><span id="cassetteIcons"></span> <b id="cassetteText">0/5</b></div>
        <div class="signal"><span id="signalLabel">SIGNAL</span> <span id="signalBars"></span></div>
        <div class="flash-indicator" id="flashStatus">[1] FLASHLIGHT ON</div>
      </div>

      <!-- Inventaire : la case 1 est réservée à la lampe torche, les cases 2 et 3 aux piles et à l'eau d'amande -->
      <div class="inv" id="inv">${[0, 1, 2].map((i) => `<button class="slot" data-slot="${i}"><b>${i + 1}</b><span></span></button>`).join('')}</div>

      <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>
      <div class="crosshair"></div>

      <div class="objective-banner" id="objBanner"></div>
      <!-- Spectateur : à l'abri dans l'ascenseur, ou attrapé -->
      <div class="spectate" id="spectate" hidden><b id="specTitle"></b><span id="specSub"></span></div>
      <!-- Fondu : l'ascenseur descend, carte de l'étage -->
      <div class="fade" id="fade"><div><b id="fadeTitle"></b><span id="fadeSub"></span><div class="fade-bar" id="fadeBarBox" hidden><i id="fadeBar"></i></div></div></div>
      <div class="toast" id="toast" hidden></div>
      <!-- Ce que tu peux faire ici : ramasser, échanger, poser l'échelle ; la jauge d'équilibre sur une arête -->
      <div class="prompt" id="prompt" hidden><span id="promptText"></span><div class="beam" id="beamBar" hidden><b></b><i></i></div></div>

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
          <p id="endSubtitle">The entity caught you...</p>
          <div class="end-stats" id="endStats"></div>
          <button class="btn-restart" id="btnRestart">PLAY AGAIN</button>
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
    this.applyMonsters();

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

    // 2. Objectif de l'étage : 5 cassettes (Level 0) ou 3 fusibles à rapporter au monte-charge (Level 1)
    const L1 = sim.level === 1 || sim.level === 2; // Level 1 (fusibles) et Level 37 (volants de vanne) : 3 objets à rapporter
    const L37 = sim.level === 2;
    const PIPES = sim.level === PIPES_LEVEL; // le Level 2, les Tuyauteries : 4 vannes à fermer
    const got = PIPES ? sim.valves : L1 ? sim.fuses : sim.cassettes;
    const total = PIPES ? 4 : L1 ? 3 : 5;
    const objKey = `${sim.level}:${got}:${sim.open}:${sim.slide}`;
    if (objKey !== this.lastCount) {
      this.lastCount = objKey;
      this.$('#levelTag').textContent = `LEVEL ${levelName(sim.level)}`;
      this.floorShown = -1;
      this.$('#cassetteIcons').innerHTML = Array.from({ length: total }, (_, i) => `<i class="${i < got ? 'on' : ''}${L1 ? ' fuse' : ''}"></i>`).join('');
      this.$('#cassetteText').textContent = `${got}/${total}`;
      this.bannerT = 6;
      const banner = this.$('#objBanner');
      banner.classList.toggle('unlocked', sim.open);
      if (sim.open && L37) banner.textContent = slideOf(sim) ? `EVERYONE INTO THE ${slideOf(sim).name} SLIDE · THE OTHERS ARE SHUT` : 'THE PUMPS STOPPED · THE SLIDES ARE OPEN: RED, YELLOW OR BLUE, EACH ONE LEADS SOMEWHERE ELSE';
      else if (sim.open) banner.textContent = PIPES ? 'THE STEAM IS OFF: THE SERVICE ELEVATOR IS OPEN · EVERYONE GET IN' : L1 ? 'THE FREIGHT ELEVATOR HAS POWER: EVERYONE GET IN' : 'ONLY ONE OF THE TWO ELEVATORS OPENED… THE OTHER ONE IS JUST A WALL NOW';
      else if (L37) banner.textContent = got === 0 ? 'LEVEL 37 · FIND THE 3 VALVE WHEELS IN THE PUMP ROOMS' : `VALVE WHEEL ${got}/3 RECOVERED`;
      else if (PIPES) {
        const dark = (sim.map.breakers || []).some((b) => !b.done && (sim.map.valves[b.sector] || {}).power === 2);
        banner.textContent = got === 0 ? 'LEVEL 2 · CLOSE THE 4 STEAM VALVES IN THE BOILER ROOMS · STAY IN THE LIGHT' : `VALVE ${got}/4 CLOSED` + (dark ? ' · A SECTOR WENT DARK: RESET ITS BREAKER (ELECTRICAL)' : '');
      }
      else if (L1 && got >= total) banner.textContent = 'BRING THE FUSES TO THE FREIGHT ELEVATOR PANEL · FOLLOW THE SIGNAL';
      else if (L1) banner.textContent = got === 0 ? 'LEVEL 1 · FIND THE 3 FUSES IN THE AISLES' : `FUSE ${got}/3 RECOVERED`;
      else banner.textContent = got === 0 ? 'FIND THE 5 VHS TAPES · THE SIGNAL GETS STRONGER AS YOU GET CLOSER' : `TAPE ${got}/5 RECOVERED`;
    }
    this.bannerT -= dt;
    this.$('#objBanner').classList.toggle('hide', this.bannerT <= 0);
    this.$('#blackoutTag').hidden = !(sim.blackout > 0);

    // 2a. Trajet en ascenseur : barre de chargement ; à l'arrivée, la carte de l'étage (même si l'annonce s'est perdue)
    if (this.fadeRide) {
      const k = sim.departT > 0 ? 1 - sim.departT / DEPART_T : 1;
      this.$('#fadeBar').style.width = `${Math.round(k * 100)}%`;
      if (!(sim.departT > 0)) {
        this.fadeRide = false;
        if (sim.state === 'playing') this.fade(`LEVEL ${levelName(sim.level)}`, levelSub(sim.level), 2.2);
        else this.$('#fade').classList.remove('on');
      }
    }

    // 2b. Spectateur : dans l'ascenseur ou attrapé, on regarde ceux qui sont encore dehors
    const spec = P.status !== 'alive' && sim.state === 'playing';
    this.$('#spectate').hidden = !spec;
    if (spec) {
      const view = sim.viewPlayer(sim.spectate || 0);
      const inside = sim.players.filter((p) => p.status === 'elevator').length;
      const sl = slideOf(sim);
      this.$('#specTitle').textContent = sim.departT > 0 ? (sl ? 'DOWN THE SLIDE…' : 'THE DOORS ARE CLOSING…') : P.status === 'elevator' ? (sl ? `YOU'RE IN THE ${sl.name} SLIDE` : "YOU'RE IN THE ELEVATOR") : 'THE ENTITY GOT YOU';
      this.$('#specSub').textContent = sim.departT > 0 ? '' : `${inside}/${sim.players.length} safe · watching ${view.name}${view !== P ? ' · click or Space: switch' : ''}`;
    }

    // 3. Signal de la cassette (ou de la sortie) la plus proche
    const bars = Math.round(P.signal * 5);
    const flick = P.signal > 0 && Math.random() < 0.08 ? Math.max(0, bars - 1) : bars;
    this.$('#signalBars').innerHTML = Array.from({ length: 5 }, (_, i) => `<i class="${i < flick ? 'on' : ''}" style="height:${6 + i * 3}px"></i>`).join('');
    this.$('#signalLabel').textContent = P.sigTo === 'stairs' ? 'STAIRS' : L37 && sim.open ? 'SLIDE' : sim.open || (L1 && got >= total) ? (L1 && !L37 ? 'FREIGHT ELEVATOR' : 'ELEVATOR') : 'SIGNAL';
    // l'étage où l'on est (Level 0, sur deux étages)
    if (sim.floors.length > 1 && this.floorShown !== P.floor) {
      this.floorShown = P.floor;
      this.$('#levelTag').textContent = `LEVEL ${levelName(sim.level)} · ${P.floor ? 'LOWER' : 'UPPER'} FLOOR`;
    }

    // 4. Souffle (endurance)
    const stamBar = this.$('#staminaBar');
    stamBar.style.width = `${P.stamina}%`;
    stamBar.classList.toggle('low', P.stamina < 25);

    // 4b. Inventaire
    const inv = P.inv || [];
    const key = inv.join(',');
    const slotsKey = `${inv.join(',')}|${P.hasLamp ? 1 : 0}${P.flashlight ? 1 : 0}|${P.sel}`;
    if (slotsKey !== this.invKey) {
      this.invKey = slotsKey;
      this.$('#inv').querySelectorAll('.slot').forEach((b, i) => {
        if (i === 0) {
          // case de la lampe (toujours là depuis le départ)
          b.classList.toggle('full', !!P.hasLamp);
          b.classList.toggle('lamp-on', !!P.flashlight);
          b.classList.add('lamp-slot');
          b.querySelector('span').innerHTML = P.hasLamp ? `<i class="ico-lamp"></i>${P.flashlight ? 'ON' : 'OFF'}` : 'LAMP';
          return;
        }
        const k = inv[i - 1];
        b.classList.toggle('full', !!k);
        b.classList.toggle('sel', P.sel === i);
        b.querySelector('span').innerHTML = k === 'battery' ? '<i class="ico-bat"></i>BATTERY' : k === 'bottle' ? '<i class="ico-bot"></i>WATER' : k === 'ladder' ? '<i class="ico-ladder"></i>LADDER' : '';
      });
    }

    // 4c. Invite : ce que la touche fait ici
    this.prompt(sim, P);

    // 5. Lampe torche
    this.$('#flashStatus').textContent = P.hasLamp ? `[1] FLASHLIGHT ${P.flashlight ? 'ON' : 'OFF'}` : 'NO FLASHLIGHT';

    // 6. Message passager
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.$('#toast').hidden = true;
    }
  }

  prompt(sim, P) {
    const NAME = { bottle: 'ALMOND WATER', battery: 'BATTERIES', ladder: 'THE LADDER' };
    let text = '';
    let beam = null;
    if (P.status === 'alive' && sim.state === 'playing' && !(sim.departT > 0)) {
      const N = sim.fm(P.floor).niche;
      const nicheCas = N && sim.allCassettes.find((c) => c.id === N.cas);
      {
        if (P.onBeam) {
          // barre d'équilibre : le repère penche avec toi, Q et D le ramènent au milieu
          text = 'BALANCE · Z TO MOVE FORWARD, Q / D TO STEADY YOURSELF';
          beam = P.tilt || 0;
        }
        const it = sim.nearItem(P);
        const sel = P.inv[P.sel - 1];
        if (beam !== null) {
          // rien d'autre sur l'arête
        } else if (N && !N.ladder && sel === 'ladder' && Math.hypot(N.baseX - P.x, N.baseZ - P.z) < 2.2) text = '[E] PLACE THE LADDER UNDER THE TAPE';
        else if (it) text = P.inv.includes(null) ? `[F] PICK UP ${NAME[it.kind]}` : `[F] SWAP ${NAME[sel || 'bottle']} (SLOT ${P.sel + 1}) FOR ${NAME[it.kind]}`;
        else if (N && !N.ladder && nicheCas && !nicheCas.collected && Math.hypot(N.baseX - P.x, N.baseZ - P.z) < 2.6) text = 'THE TAPE IS TOO HIGH: YOU NEED A LADDER';
      }
    }
    const el = this.$('#prompt');
    el.hidden = !text;
    if (text) this.$('#promptText').textContent = text;
    this.$('#beamBar').hidden = beam === null;
    if (beam !== null) {
      const mark = this.$('#beamBar i');
      mark.style.left = `${50 + beam * 50}%`;
      mark.classList.toggle('danger', Math.abs(beam) > 0.6);
    }
  }

  toast(text) {
    const t = this.$('#toast');
    t.textContent = text;
    t.hidden = false;
    this.toastT = 2.5;
  }

  // images du screamer selon le mode (normal / VIP) : à rappeler quand l'hôte lance une partie
  applyMonsters() {
    const img = this.$('#scareImg');
    if (img) { img.onerror = () => (img.hidden = true); img.hidden = false; img.src = ENTITY_IMG; }
    // celle du Level 1 : sa vidéo, qui continue de gesticuler en plein écran
    const A = ENTITY_ANIM;
    const anim = this.$('#scareAnim');
    anim.style.backgroundImage = `url("${A.url}")`;
    anim.style.backgroundSize = `${A.cols * 100}% ${A.rows * 100}%`;
    anim.style.aspectRatio = String(A.aspect);
  }

  // level : le screamer est celui de l'entité du level en cours
  // goat : percuté par une chèvre (Level 2) : pas de visage, l'éclair seul (la chèvre est dans la scène)
  showJumpscare(level = 0, goat = false) {
    const j = this.$('#jumpscareOverlay');
    const A = ENTITY_ANIM;
    const anim = this.$('#scareAnim');
    const img = this.$('#scareImg');
    anim.hidden = level !== 1 || goat;
    j.classList.toggle('goat', goat); // percuté : un éclair rouge par-dessus la scène, sans fond noir
    if (img) img.hidden = level === 1 || goat;
    clearInterval(this.scareTimer);
    if (level === 1) {
      let f = 0;
      const show = () => {
        anim.style.backgroundPosition = `${((f % A.cols) / (A.cols - 1)) * 100}% ${(Math.floor(f / A.cols) / (A.rows - 1)) * 100}%`;
        f = (f + 1) % A.frames;
      };
      show();
      this.scareTimer = setInterval(show, 1000 / A.fps);
      setTimeout(() => clearInterval(this.scareTimer), 1500);
    }
    j.hidden = false;
    j.classList.remove('flash');
    void j.offsetWidth;
    j.classList.add('flash');
    setTimeout(() => {
      j.hidden = true;
    }, 1400);
  }

  // Level 2, attrapé par le troupeau : après le choc, l'image du bouc monte très lentement du noir, fixe, sombre et
  // rien d'autre à l'écran. Elle reste en fin de partie (gdHold) ; sinon elle s'efface et l'on devient spectateur.
  // delay : le temps du choc avant le noir
  showGoatDeath(delay = 0) {
    const el = this.$('#goatDeath');
    const img = this.$('#gdImg');
    const grain = this.$('#gdGrain');
    if (!grain.style.backgroundImage) {
      // un grain de bande, fixe (il ne bouge pas)
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d');
      const d = g.createImageData(256, 256);
      for (let i = 0; i < d.data.length; i += 4) {
        const v = 128 + (Math.random() - 0.5) * 255;
        d.data[i] = v;
        d.data[i + 1] = v * 0.95;
        d.data[i + 2] = v * 0.9;
        d.data[i + 3] = 255;
      }
      g.putImageData(d, 0, 0);
      grain.style.backgroundImage = `url(${c.toDataURL()})`;
    }
    for (const k of ['gdT1', 'gdT3', 'gdOutT']) clearTimeout(this[k]);
    this.gdHold = false;
    this.gdActive = true;
    el.classList.remove('out');
    img.style.transition = 'none';
    img.style.opacity = '0';
    el.hidden = true;
    this.gdT1 = setTimeout(() => {
      el.hidden = false;
      void img.offsetWidth;
      img.style.transition = `opacity ${GOAT_DEATH_FADE}s cubic-bezier(0.6, 0, 0.8, 1)`;
      img.style.opacity = '1';
    }, delay * 1000);
    this.gdT3 = setTimeout(() => {
      if (this.gdHold) return;
      el.classList.add('out');
      this.gdOutT = setTimeout(() => this.hideGoatDeath(), 1600);
    }, (delay + 14) * 1000);
  }

  hideGoatDeath() {
    for (const k of ['gdT1', 'gdT3', 'gdOutT']) clearTimeout(this[k]);
    this.gdActive = false;
    this.gdHold = false;
    const el = this.$('#goatDeath');
    if (el) el.hidden = true;
  }

  showEnd(sim, onRestart) {
    const end = this.$('#endScreen');
    const title = this.$('#endTitle');
    const sub = this.$('#endSubtitle');
    const stats = this.$('#endStats');

    // laisser le jumpscare à l'écran avant la carte de fin
    // au Level 2, l'image du bouc reste derrière la carte de fin
    const goat = sim.state === 'dead' && this.gdActive;
    if (goat) this.gdHold = true;
    end.classList.toggle('over-goat', goat);
    setTimeout(() => {
      end.hidden = false;
    }, goat ? 12500 : sim.state === 'dead' ? 1300 : 300);

    const solo = sim.players.length === 1;
    if (sim.state === 'won') {
      title.textContent = solo ? 'YOU ESCAPED!' : 'YOU ALL ESCAPED!';
      title.style.color = '#22c55e';
      const sl = slideOf(sim);
      if (sim.level === PIPES_LEVEL) {
        sub.textContent = 'The service elevator brought you up out of the pipes, away from the herd. The Backrooms let you go… this time.';
        stats.textContent = `Escape time: ${formatTime(sim.time)} · Level 0, Level 1, Level 37 and Level 2 cleared`;
      } else {
        sub.textContent = sl ? `The ${sl.name.toLowerCase()} slide spat you out somewhere else, soaked. The Backrooms let you go… this time.` : 'The elevator rose out of the Poolrooms, dripping. The Backrooms let you go… this time.';
        stats.textContent = `Escape time: ${formatTime(sim.time)} · Level 0, Level 1 and Level 37 cleared`;
      }
    } else {
      title.textContent = solo ? 'YOU DIED' : 'NOBODY MADE IT OUT';
      title.style.color = '#ef4444';
      const PIPES = sim.level === PIPES_LEVEL;
      sub.textContent = PIPES ? 'The herd found you in the dark…' : sim.level === 2 ? 'The water was too deep…' : sim.level === 1 ? 'The entity was waiting at the end of the shelves…' : 'The entity caught you in the endless hallways...';
      stats.textContent = `Level ${levelName(sim.level)} · ${PIPES ? `valves ${sim.valves}/4` : sim.level === 2 ? `valves ${sim.fuses}/3` : sim.level === 1 ? `fuses ${sim.fuses}/3` : `tapes ${sim.cassettes}/5`} · Survived for ${formatTime(sim.time)}`;
    }

    // un invité attend que l'hôte relance une partie
    const btn = this.$('#btnRestart');
    btn.disabled = !onRestart;
    btn.textContent = onRestart ? 'PLAY AGAIN' : 'WAITING FOR THE HOST…';
    this.$('#btnRestart').onclick = () => {
      if (!onRestart) return;
      end.hidden = true;
      this.hideGoatDeath();
      this.lastCount = -1;
      if (onRestart) onRestart();
    };
  }

  // Fondu au noir : l'ascenseur descend, puis la carte de l'étage
  fade(title, sub = '', hold = 0, ride = false) {
    const f = this.$('#fade');
    this.fadeRide = ride;
    this.$('#fadeBarBox').hidden = !ride;
    if (ride) this.$('#fadeBar').style.width = '0%';
    this.$('#fadeTitle').textContent = title;
    this.$('#fadeSub').textContent = sub;
    f.classList.add('on');
    clearTimeout(this.fadeTimer);
    if (hold > 0) this.fadeTimer = setTimeout(() => f.classList.remove('on'), hold * 1000);
  }

  showPause(visible, kb) {
    this.$('#clickPrompt').style.display = visible ? 'block' : 'none';
    const tactile = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
    this.$('#pauseGo').textContent = tactile ? 'TAP THE SCREEN TO PLAY' : kb ? 'PRESS ENTER TO PLAY' : 'CLICK TO TAKE CONTROL';
    this.$('#pauseKeys').textContent = kb
      ? 'ZQSD move · Arrows look · Shift run · 1 flashlight · 2 3 select · E use · F pick up · T whistle · Esc pause'
      : 'ZQSD move · Mouse look · Shift run · 1 flashlight · 2 3 select · E use · F pick up · T whistle · Esc pause';
    for (const b of this.el.querySelectorAll('button[data-kb]')) b.classList.toggle('on', (b.dataset.kb === '1') === kb);
  }
}

function formatTime(t) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
