// The Backrooms - Interface façon caméscope (REC, signal, bande), jumpscare et écran de fin
import { ENTITY_IMG, ENTITY_ANIM } from './scene.js';
import { DEPART_T, PIPES_LEVEL, HOTEL_LEVEL } from '../engine/sim.js';

const GOAT_DEATH_IMG = new URL('../img/bouc.jpg', import.meta.url).href;
const GOAT_DEATH_FADE = 8; // secondes de montée de l'image

// nom affiché d'un niveau : le troisième, ce sont les Poolrooms (Level 37) ; le quatrième, les Tuyauteries (Level 2)
export const levelName = (lv) => (lv === 2 ? 37 : lv === PIPES_LEVEL ? 2 : lv === HOTEL_LEVEL ? 5 : lv);
// Poolrooms : le toboggan pris par l'équipe (ou null)
const slideOf = (sim) => (sim.map.slides && sim.slide >= 0 ? sim.map.slides[sim.slide] : null);
export const levelSub = (lv) => (lv === HOTEL_LEVEL ? 'The Terror Hotel' : lv === PIPES_LEVEL ? 'Pipe Dreams · the service tunnels' : lv === 2 ? 'The Poolrooms' : lv === 1 ? 'The industrial basement' : 'The Lobby');

// Les cassettes du Level 0 racontent une histoire : dix enregistrements, cinq par partie (toujours d'autres, selon la
// graine). Ceux qu'on a déjà écoutés restent dans la collection (sur cet appareil).
export const LORE = [
  'Day three. The hum never stops. I counted the lights in this hallway: forty-one. Then forty. Nobody turned one off.',
  "If you hear it, don't run. Running is the loudest thing you can do down here. Crouch. Wait. Let it pass.",
  'The elevators lie. One of them is a wall. You only find out once every tape is in your bag.',
  'There are lockers further down. I sat in one for an hour. It stood right outside the door. Breathing with me.',
  'Kevin went to check the noise behind the shelves. The noise was Kevin. Kevin was standing next to me.',
  "Almond water. Drink it slowly. It doesn't fix you. It just buys you a minute.",
  "Something whistled my name tonight. In my voice. Don't answer a whistle you didn't hear coming.",
  "The goats hate the light. The big one, with the bell… the big one stopped caring.",
  'The pool rooms have three slides. Red, blue, yellow. Two of them take you home. Home is wrong now.',
  'If anyone finds this: the yellow one. Take the yellow one. It is the only way out that stays out.',
];
export const loreOf = (seed, id) => {
  // cinq enregistrements différents pour cette graine
  const order = LORE.map((_, i) => i).sort((a, b) => ((a * 7919 + seed * 104729) % 1009) - ((b * 7919 + seed * 104729) % 1009));
  return order[id % order.length];
};
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem(k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) {}
  },
};
export const tapesHeard = () => store.get('backrooms_lore', []);
export function hearTape(i) {
  const h = tapesHeard();
  if (!h.includes(i)) store.set('backrooms_lore', [...h, i]);
}
export { store };

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
        <div class="stamina" id="stamina"><span>STAMINA</span><div class="stamina-track"><div class="stamina-bar" id="staminaBar"></div></div></div>
        <div class="crouch-tag" id="crouchTag" hidden>▼ CROUCHED</div>
      </div>
      <div class="cam cam-br">
        <div class="tapes"><span id="cassetteIcons"></span> <b id="cassetteText">0/5</b></div>
        <div class="carry" id="carryTag" hidden></div>
        <div class="signal" id="signal"><span id="signalLabel">SIGNAL</span> <span id="signalBars">${'<i></i>'.repeat(5)}</span></div>
      </div>

      <!-- Dans un casier : les fentes de la porte, et le souffle retenu -->
      <div class="locker" id="locker" hidden><div class="locker-slits"></div><div class="locker-ui"><span id="lockerText">HOLD [SHIFT] TO HOLD YOUR BREATH · [F] GET OUT</span><div class="breath"><i id="breathBar"></i></div></div></div>
      <!-- Agrippé : se débattre -->
      <div class="grab" id="grab" hidden><b>BREAK FREE!</b><span id="grabText">MASH ANY KEY</span><div class="grab-bar"><i id="grabBar"></i></div></div>
      <div class="hurt" id="hurt"></div>
      <!-- Sous-titres (réglages) et enregistrements des cassettes -->
      <div class="captions" id="captions"></div>
      <div class="calib" id="calib" hidden><i></i><i></i><i></i><span>The left square should be barely visible</span></div>
      <div class="lore" id="lore" hidden><small id="loreTag"></small><p id="loreText"></p></div>

      <!-- Inventaire : la case 1 est réservée à la lampe torche, les cases 2 et 3 aux piles et à l'eau d'amande -->
      <div class="inv" id="inv">${[0, 1, 2].map((i) => `<button class="slot" data-slot="${i}"><b>${i + 1}</b><span></span></button>`).join('')}</div>

      <div class="corner c1"></div><div class="corner c2"></div><div class="corner c3"></div><div class="corner c4"></div>
      <div class="crosshair"></div>

      <div class="objective-banner" id="objBanner"></div>
      <!-- Level 5 : la jauge de détection, la vue depuis la cachette, le clavier de la porte de secours -->
      <div class="detect" id="detect" hidden><span>👁</span><div class="detect-track"><i id="detectBar"></i></div></div>
      <div class="hide-view" id="hideView" hidden></div>
      <div class="keypad" id="keypad" hidden>
        <div class="keypad-box">
          <div class="keypad-title">FIRE ESCAPE</div>
          <div class="keypad-screen" id="keypadScreen">····</div>
          <div class="keypad-keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'OK'].map((k) => `<button data-k="${k}">${k}</button>`).join('')}</div>
          <div class="keypad-help">Type the code · Enter to confirm · Esc to step back</div>
        </div>
      </div>
      <!-- Spectateur : à l'abri dans l'ascenseur, ou attrapé -->
      <div class="spectate" id="spectate" hidden><b id="specTitle"></b><span id="specSub"></span></div>
      <!-- Fondu : l'ascenseur descend, carte de l'étage -->
      <div class="fade" id="fade"><div><b id="fadeTitle"></b><span id="fadeSub"></span><div class="fade-bar" id="fadeBarBox" hidden><i id="fadeBar"></i></div></div></div>
      <div class="toast" id="toast" hidden></div>
      <!-- Ce que tu peux faire ici : ramasser, échanger, poser l'échelle ; la jauge d'équilibre sur une arête -->
      <div class="prompt" id="prompt" hidden><span id="promptText"></span><div class="beam" id="beamBar" hidden><b></b><i></i></div></div>

      <!-- Pause : prendre le contrôle et choisir ses commandes -->
      <div class="click-prompt" id="clickPrompt">
        <div class="title-card" id="titleCard" hidden>
          <div class="tc-label"><b>THE BACKROOMS</b><span>FOUND FOOTAGE · TAPE 1 OF ?</span></div>
          <button class="tc-continue" id="btnContinue" hidden></button>
          <p class="tc-warn" id="tcWarn">This tape contains flashing lights, loud sounds and screen distortion. Settings ⚙ can reduce flashes and camera motion.</p>
        </div>
        <div class="pause-title" id="pauseTitle">II PAUSE</div>
        <div class="pause-go" id="pauseGo"></div>
        <div class="ctrl-choice">
          <span>CONTROLS</span>
          <button data-kb="0">MOUSE</button>
          <button data-kb="1">NO MOUSE</button>
        </div>
        <small id="pauseKeys"></small>
      </div>

      <!-- Écran de Fin (Mort ou Victoire) -->
      <div class="end-screen" id="endScreen" hidden>
        <div class="end-card">
          <div class="end-label"><small id="endTape">TAPE 1996 · DO NOT ERASE</small><h1 id="endTitle">YOU DIED</h1></div>
          <p id="endSubtitle">The entity caught you...</p>
          <div class="end-stats" id="endStats"></div>
          <div class="end-lore" id="endLore"></div>
          <button class="btn-restart" id="btnRestart">PLAY AGAIN</button>
        </div>
      </div>
    `;

    this.$ = (s) => this.el.querySelector(s);
    // les éléments mis à jour à chaque image (on ne les recherche pas à chaque fois)
    this.E = {};
    for (const id of ['vhsTimer', 'battery', 'levelTag', 'cassetteIcons', 'cassetteText', 'objBanner', 'blackoutTag', 'fadeBar', 'spectate', 'specTitle', 'specSub', 'signal', 'signalBars', 'signalLabel', 'stamina', 'staminaBar', 'crouchTag', 'carryTag', 'inv', 'toast', 'locker', 'lockerText', 'breathBar', 'grab', 'grabBar', 'grabText', 'hurt', 'captions', 'lore', 'loreText', 'loreTag', 'prompt', 'promptText', 'beamBar']) this.E[id] = this.$('#' + id);
    this.barEls = [...this.E.signalBars.children];
    this.barEls.forEach((b, i) => (b.style.height = `${6 + i * 3}px`));
    this.sigShown = -1;
    this.sigT = 0;
    this.cache = {};
    this.invIdle = 0;
    this.$('#btnContinue').addEventListener('click', (e) => {
      e.stopPropagation();
      this.actions.resume?.();
    });
    // sauter l'écran de mort au bout de 3 s (clic ou touche)
    const skip = () => {
      if (this.endPending && performance.now() - this.endAt > 3000) this.endPending();
    };
    window.addEventListener('keydown', skip);
    window.addEventListener('pointerdown', skip);
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
      if (e.code === 'Enter' && !this.$('#endScreen').hidden && !e.repeat) this.$('#btnRestart').click();
    });
    this.applyMonsters();

    // date du caméscope, figée en 1996 comme une vieille cassette retrouvée
    const d = new Date();
    this.$('#tapeDate').textContent = `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.1996`;
    this.bannerT = 9;
    this.lastCount = -1;
    this.toastT = 0;
  }

  // le texte d'un élément, seulement s'il change
  text(id, v) {
    if (this.cache[id] === v) return;
    this.cache[id] = v;
    this.E[id].textContent = v;
  }

  // une classe d'un élément, seulement si elle change
  flag(id, cls, on) {
    const k = id + '.' + cls;
    if (this.cache[k] === on) return;
    this.cache[k] = on;
    this.E[id].classList.toggle(cls, on);
  }

  show(id, on) {
    const k = id + '!';
    if (this.cache[k] === on) return;
    this.cache[k] = on;
    this.E[id].hidden = !on;
  }

  update(sim, time, dt = 1 / 60) {
    const P = sim.player;
    const E = this.E;

    // 1. Compteur de bande, pile de la lampe (la batterie du caméscope)
    const totalSec = Math.floor(time);
    this.text('vhsTimer', `${String(Math.floor(totalSec / 3600)).padStart(2, '0')}:${String(Math.floor(totalSec / 60) % 60).padStart(2, '0')}:${String(totalSec % 60).padStart(2, '0')}`);
    const bat = Math.round(P.battery ?? 100);
    if (this.cache.bat !== bat) {
      this.cache.bat = bat;
      E.battery.style.setProperty('--b', Math.max(0.04, bat / 100).toFixed(3));
    }
    this.flag('battery', 'low', bat < 20);

    // 2. Objectif de l'étage : 5 cassettes (Level 0), 3 fusibles à rapporter au monte-charge (Level 1), 3 volants
    // (Level 37), 4 vannes (Level 2), 6 lettres à poster (Level 5)
    const L5 = sim.level === HOTEL_LEVEL;
    const L1 = sim.level === 1 || sim.level === 2;
    const L37 = sim.level === 2;
    const PIPES = sim.level === PIPES_LEVEL;
    const got = L5 ? sim.posted : PIPES ? sim.valves : L1 ? sim.fuses : sim.cassettes;
    const total = L5 ? 6 : PIPES ? 4 : L1 ? 3 : 5;
    const delivered = sim.delivered || 0;
    const objKey = `${sim.level}:${got}:${delivered}:${sim.open}:${sim.slide}:${sim.codeShown}:${(P.letters || []).length}:${sim.word}`;
    if (objKey !== this.lastCount) {
      this.lastCount = objKey;
      this.text('levelTag', `LEVEL ${levelName(sim.level)}`);
      this.floorShown = -1;
      // Level 5 : une case par lettre, dans l'ordre des chambres ; postée, sa lettre s'affiche
      E.cassetteIcons.innerHTML = L5
        ? (sim.map.letters || []).map((Lt) => `<i class="letter${Lt.posted ? ' on' : P.letters.includes(Lt.id) ? ' carry' : ''}">${Lt.posted ? sim.word[Lt.idx] || '?' : P.letters.includes(Lt.id) ? '✉' : ''}</i>`).join('')
        : Array.from({ length: total }, (_, i) => `<i class="${i < (sim.level === 1 ? delivered : got) ? 'on' : i < got ? 'half' : ''}${L1 ? ' fuse' : ''}"></i>`).join('');
      this.text('cassetteText', `${sim.level === 1 ? delivered : got}/${total}`);
      this.bannerT = 6;
      const banner = E.objBanner;
      banner.classList.toggle('unlocked', sim.open);
      let b;
      if (L5) {
        const carry = (P.letters || []).length;
        b = sim.open
          ? 'THE FIRE ESCAPE IS OPEN: EVERYONE GET OUT'
          : sim.codeShown
          ? 'LOOK UP AT THE LOBBY CEILING · TYPE THE CODE ON THE FIRE ESCAPE KEYPAD'
          : carry
          ? `${carry} LETTER${carry > 1 ? 'S' : ''} IN YOUR POCKET · POST ${carry > 1 ? 'THEM' : 'IT'} IN THE LOBBY MAILBOXES`
          : got === 0
          ? 'LEVEL 5 · 6 LETTERS ARE HIDDEN IN THE ROOMS · HIDE UNDER BEDS AND IN WARDROBES (E), CROUCH (C)'
          : `LETTER ${got}/6 POSTED`;
      } else if (sim.open && L37) b = slideOf(sim) ? `EVERYONE INTO THE ${slideOf(sim).name} SLIDE · THE OTHERS ARE SHUT` : 'THE PUMPS STOPPED · THE SLIDES ARE OPEN: RED, YELLOW OR BLUE, EACH ONE LEADS SOMEWHERE ELSE';
      else if (sim.open) b = PIPES ? 'THE STEAM IS OFF: THE SERVICE ELEVATOR IS OPEN · EVERYONE GET IN' : L1 ? 'THE FREIGHT ELEVATOR HAS POWER: EVERYONE GET IN' : 'ONLY ONE OF THE TWO ELEVATORS OPENED… THE OTHER ONE IS JUST A WALL NOW';
      else if (L37) b = got === 0 ? 'LEVEL 37 · FIND THE 3 VALVE WHEELS IN THE PUMP ROOMS' : `VALVE WHEEL ${got}/3 RECOVERED`;
      else if (PIPES) {
        const dark = (sim.map.breakers || []).some((x) => !x.done && (sim.map.valves[x.sector] || {}).power === 2);
        b = got === 0 ? 'LEVEL 2 · CLOSE THE 4 STEAM VALVES IN THE BOILER ROOMS · STAY IN THE LIGHT' : `VALVE ${got}/4 CLOSED` + (dark ? ' · A SECTOR WENT DARK: RESET ITS BREAKER (ELECTRICAL)' : '');
      } else if (L1 && delivered >= total) b = 'ALL FUSES IN · STAY AT THE PANEL TO RESTART THE FREIGHT ELEVATOR · IT WILL BE LOUD';
      else if (L1 && got > delivered) b = `FUSE IN YOUR POCKET · BRING IT TO THE FREIGHT ELEVATOR PANEL (${delivered}/3 IN)`;
      else if (L1) b = got === 0 ? 'LEVEL 1 · FIND THE 3 FUSES IN THE AISLES' : `FUSE ${got}/3 RECOVERED`;
      else b = got === 0 ? 'FIND THE 5 VHS TAPES · THE SIGNAL GETS STRONGER AS YOU GET CLOSER' : `TAPE ${got}/5 RECOVERED`;
      banner.textContent = b;
    }
    this.bannerT -= dt;
    this.flag('objBanner', 'hide', this.bannerT <= 0);
    this.show('blackoutTag', sim.blackout > 0);

    // 2a. Trajet en ascenseur : barre de chargement ; à l'arrivée, la carte de l'étage (même si l'annonce s'est perdue)
    if (this.fadeRide) {
      const k = sim.departT > 0 ? 1 - sim.departT / DEPART_T : 1;
      E.fadeBar.style.width = `${Math.round(k * 100)}%`;
      if (!(sim.departT > 0)) {
        this.fadeRide = false;
        if (sim.state === 'playing') this.fade(`LEVEL ${levelName(sim.level)}`, levelSub(sim.level), 2.2);
        else this.$('#fade').classList.remove('on');
      }
    }

    // 2b. Spectateur : dans l'ascenseur ou attrapé, on regarde ceux qui sont encore dehors
    const spec = P.status !== 'alive' && sim.state === 'playing';
    this.show('spectate', spec);
    if (spec) {
      const view = sim.viewPlayer(sim.spectate || 0);
      const inside = sim.players.filter((p) => p.status === 'elevator').length;
      const sl = slideOf(sim);
      this.text('specTitle', sim.departT > 0 ? (sl ? 'DOWN THE SLIDE…' : L5 ? 'DOWN THE STAIRS…' : 'THE DOORS ARE CLOSING…') : P.status === 'elevator' ? (sl ? `YOU'RE IN THE ${sl.name} SLIDE` : L5 ? 'YOU REACHED THE FIRE ESCAPE' : "YOU'RE IN THE ELEVATOR") : sim.goats ? 'THE HERD GOT YOU' : 'THE ENTITY GOT YOU');
      this.text('specSub', sim.departT > 0 ? '' : `${inside}/${sim.players.length} safe · watching ${view.name}${view !== P ? ' · click or Space: switch' : ''}`);
    }

    // 3. Signal de l'objectif le plus proche (25 m) : il tremble quatre fois par seconde, pas à chaque image ; rien
    // pendant une coupure
    this.sigT -= dt;
    if (this.sigT <= 0) {
      this.sigT = 0.25;
      const bars = Math.round((P.signal || 0) * 5);
      const shown = bars > 0 && Math.random() < 0.25 ? Math.max(0, bars - 1 + (Math.random() < 0.3 ? 2 : 0)) : bars;
      const n = Math.min(5, shown);
      if (n !== this.sigShown) {
        this.sigShown = n;
        this.barEls.forEach((b, i) => b.classList.toggle('on', i < n));
      }
    }
    const noSig = !(P.signal > 0);
    this.text('signalLabel', noSig ? 'NO SIGNAL' : L5 ? (sim.open ? 'FIRE ESCAPE' : P.sigTo === 'keypad' ? 'KEYPAD' : P.sigTo === 'mail' ? 'MAILBOXES' : 'LETTER') : P.sigTo === 'stairs' ? 'STAIRS' : L37 && sim.open ? 'SLIDE' : sim.open || (sim.level === 1 && delivered >= total) || (sim.level === 1 && !(sim.map.fuses || []).some((f) => !f.taken)) ? (sim.level === 1 ? 'FREIGHT ELEVATOR' : 'ELEVATOR') : 'SIGNAL');
    this.flag('signal', 'none', noSig);
    if (sim.floors.length > 1 && this.floorShown !== P.floor) {
      this.floorShown = P.floor;
      this.text('levelTag', `LEVEL ${levelName(sim.level)} · ${P.floor ? 'LOWER' : 'UPPER'} FLOOR`);
    }

    // 4. Souffle : la jauge n'apparaît que quand elle sert (HUD minimal)
    const st = Math.round(P.stamina);
    if (this.cache.st !== st) {
      this.cache.st = st;
      E.staminaBar.style.width = `${st}%`;
    }
    this.flag('staminaBar', 'low', st < 25);
    this.flag('stamina', 'idle', st >= 99 && !P.running);
    this.show('crouchTag', !!P.crouch && P.status === 'alive');
    // Level 1 : les fusibles en poche
    const carry = P.carry ? P.carry.length : P.carryN || 0;
    this.show('carryTag', carry > 0);
    if (carry > 0) this.text('carryTag', `${'▮'.repeat(carry)} FUSE${carry > 1 ? 'S' : ''} IN POCKET`);

    // 4b. Inventaire (il s'efface quand on ne s'en sert pas)
    const inv = P.inv || [];
    const slotsKey = `${inv.join(',')}|${P.hasLamp ? 1 : 0}${P.flashlight ? 1 : 0}|${P.sel}`;
    if (slotsKey !== this.invKey) {
      this.invKey = slotsKey;
      this.invIdle = 0;
      E.inv.querySelectorAll('.slot').forEach((b, i) => {
        if (i === 0) {
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
    this.invIdle += dt;
    this.flag('inv', 'idle', this.invIdle > 5 && !document.body.classList.contains('touch'));

    // 4c. Casier, prise, coup de chèvre
    const hidden = P.hidden >= 0 && P.status === 'alive';
    this.show('locker', hidden);
    if (hidden) {
      const br = Math.round(P.breath ?? 100);
      if (this.cache.br !== br) {
        this.cache.br = br;
        E.breathBar.style.width = `${br}%`;
      }
      this.flag('locker', 'holding', !!P.holding);
      this.text('lockerText', P.holding ? (br < 30 ? "YOU CAN'T HOLD IT MUCH LONGER…" : 'HOLDING YOUR BREATH…') : 'HOLD [SHIFT] TO HOLD YOUR BREATH · [F] GET OUT');
    }
    const grabbed = P.grabT > 0 && P.status === 'alive';
    this.show('grab', grabbed);
    if (grabbed) {
      const need = 8 + (sim.difficulty === 'hard' ? 3 : 0);
      E.grabBar.style.width = `${Math.min(100, ((P.struggle || 0) / need) * 100)}%`;
      this.text('grabText', document.body.classList.contains('touch') ? 'TAP THE SCREEN AS FAST AS YOU CAN' : 'MASH ANY KEY');
    }
    const hurt = (P.hurt || 0) > 0 && P.status === 'alive';
    this.flag('hurt', 'on', hurt);

    // 4d. Invite : ce que la touche fait ici
    this.prompt(sim, P);

    // 4d. Level 5 : jauge de détection, vue depuis la cachette
    const det = this.$('#detect');
    det.hidden = !L5 || P.status !== 'alive';
    if (!det.hidden) {
      const v = Math.max(0, Math.min(1, P.detect || 0));
      this.$('#detectBar').style.width = `${Math.round(v * 100)}%`;
      det.classList.toggle('hot', v > 0.6);
      det.classList.toggle('hidden-on', P.hidden >= 0);
    }
    const hv = this.$('#hideView');
    const sp = L5 && P.hidden >= 0 && sim.map.spots ? sim.map.spots[P.hidden] : null;
    hv.hidden = !sp || P.status !== 'alive';
    if (sp) hv.className = `hide-view ${sp.kind}`;
    if (this.keypadOpen && (!L5 || P.status !== 'alive' || sim.open)) this.closeKeypad();

    // 5. Messages passagers, sous-titres, enregistrement
    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) E.toast.hidden = true;
    }
    if (this.loreT > 0) {
      this.loreT -= dt;
      if (this.loreT <= 0) E.lore.hidden = true;
    }
    for (const c of [...E.captions.children]) {
      c.t -= dt;
      if (c.t <= 0) c.remove();
    }
  }

  // un sous-titre (réglage) : dir : 'left' | 'right' | 'behind' | 'ahead' | null
  caption(text, dir = null) {
    const box = this.E.captions;
    for (const c of box.children) if (c.dataset.text === text) {
      c.t = 2.6;
      return;
    }
    const el = document.createElement('div');
    el.dataset.text = text;
    const arrow = { left: '◀ ', right: '', behind: '▼ ', ahead: '▲ ' }[dir] || '';
    el.textContent = `${arrow}[${text}]${dir === 'right' ? ' ▶' : ''}`;
    el.t = 2.6;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
  }

  // l'enregistrement d'une cassette, en sous-titre de bande
  showLore(n, text, isNew) {
    this.E.loreTag.textContent = `TAPE #${String(n + 1).padStart(2, '0')}${isNew ? ' · NEW' : ''}`;
    this.E.loreText.textContent = `“${text}”`;
    this.E.lore.hidden = false;
    this.loreT = 3 + text.length / 16;
  }

  // calibrage de la luminosité : trois carrés presque noirs, éclaircis comme l'image du jeu
  calibrate(v) {
    const el = this.$('#calib');
    const lv = [4, 12, 26];
    el.querySelectorAll('i').forEach((sq, i) => {
      const c = Math.round(255 * Math.pow(lv[i] / 255, 1 / v));
      sq.style.background = `rgb(${c},${c},${c})`;
    });
    el.hidden = false;
    clearTimeout(this.calibT);
    this.calibT = setTimeout(() => (el.hidden = true), 2500);
  }

  // touche choisie par le joueur : ZQSD (AZERTY) ou WASD (QWERTY)
  keyNames(qwerty) {
    return qwerty ? { move: 'WASD', l: 'A', r: 'D', f: 'W' } : { move: 'ZQSD', l: 'Q', r: 'D', f: 'Z' };
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
        const h = P.hidden < 0 && sim.nearHide ? sim.nearHide(P) : null;
        const E1 = sim.level === 1 && sim.map.exit;
        const atPanel = E1 && !sim.powered && (sim.delivered || 0) >= 3 && Math.hypot(E1.x - P.x, E1.z - P.z) < 2.6;
        if (P.grabT > 0 || P.hidden >= 0) {
          // la prise et le casier ont leur propre affichage
        } else if (beam !== null) {
          // rien d'autre sur l'arête
        } else if (N && !N.ladder && sel === 'ladder' && Math.hypot(N.baseX - P.x, N.baseZ - P.z) < 2.2) text = '[E] PLACE THE LADDER UNDER THE TAPE';
        else if (it) text = P.inv.includes(null) ? `[F] PICK UP ${NAME[it.kind]}` : `[F] SWAP ${NAME[sel || 'bottle']} (SLOT ${P.sel + 1}) FOR ${NAME[it.kind]}`;
        else if (h) text = '[F] HIDE IN THE LOCKER';
        else if (atPanel) text = `RESTARTING THE FREIGHT ELEVATOR… ${Math.round((sim.panel || 0) * 100)}% · STAY HERE`;
        else if (N && !N.ladder && nicheCas && !nicheCas.collected && Math.hypot(N.baseX - P.x, N.baseZ - P.z) < 2.6) text = 'THE TAPE IS TOO HIGH: YOU NEED A LADDER';
        else if (sim.level === HOTEL_LEVEL) text = this.hotelPrompt(sim, P);
      }
    }
    if (this.qwerty) text = text.replace('Z TO MOVE FORWARD, Q / D', 'W TO MOVE FORWARD, A / D');
    this.show('prompt', !!text);
    if (text) this.text('promptText', text);
    this.show('beamBar', beam !== null);
    if (beam !== null) {
      const mark = this.E.beamBar.querySelector('i');
      mark.style.left = `${50 + beam * 50}%`;
      mark.classList.toggle('danger', Math.abs(beam) > 0.6);
    }
  }

  // Level 5 : ce que fait E ici (sortir de sa cachette, poster ses lettres, le clavier, se cacher)
  hotelPrompt(sim, P) {
    const m = sim.map;
    if (P.hidden >= 0) return m.spots[P.hidden].kind === 'bed' ? '[E] CRAWL OUT FROM UNDER THE BED' : '[E] STEP OUT OF THE WARDROBE';
    const mb = m.mailbox;
    if (Math.abs(P.x - mb.x) < 1.6 && P.z > mb.z0 - 0.6 && P.z < mb.z1 + 0.6) return P.letters.length ? `[E] POST ${P.letters.length > 1 ? `THE ${P.letters.length} LETTERS` : 'THE LETTER'}` : 'MAILBOXES · ONE PER ROOM';
    if (!sim.open && Math.hypot(P.x - m.keypad.x, P.z - m.keypad.z) < 1.5) return '[E] USE THE KEYPAD';
    for (const sp of m.spots) {
      const d = Math.min(Math.hypot(sp.out.x - P.x, sp.out.z - P.z), Math.hypot(sp.x - P.x, sp.z - P.z) - 0.6);
      if (d < 1.45) return sp.kind === 'bed' ? '[E] HIDE UNDER THE BED' : '[E] HIDE IN THE WARDROBE';
    }
    return '';
  }

  // Level 5 : le pavé numérique de la porte de secours (4 chiffres)
  openKeypad(onSubmit, onKey) {
    this.keypadOpen = true;
    this.keypadCode = '';
    this.keypadSubmit = onSubmit;
    this.keypadBeep = onKey;
    const el = this.$('#keypad');
    el.hidden = false;
    el.classList.remove('wrong');
    this.drawKeypad();
    if (!this.keypadBound) {
      this.keypadBound = true;
      el.querySelectorAll('button').forEach((b) => {
        b.onclick = (e) => {
          e.stopPropagation();
          this.keypadPress(b.dataset.k);
        };
      });
      el.onclick = (e) => {
        if (e.target === el) this.closeKeypad();
      };
    }
  }

  keypadKey(e) {
    if (/^(Digit|Numpad)\d$/.test(e.code)) this.keypadPress(e.code.slice(-1));
    else if (e.code === 'Backspace') this.keypadPress('C');
    else if (e.code === 'Enter' || e.code === 'NumpadEnter') this.keypadPress('OK');
    else if (e.code === 'Escape' || e.code === 'KeyE') this.closeKeypad();
  }

  keypadPress(k) {
    if (!this.keypadOpen) return;
    if (this.keypadBeep) this.keypadBeep();
    this.$('#keypad').classList.remove('wrong');
    if (k === 'C') this.keypadCode = this.keypadCode.slice(0, -1);
    else if (k === 'OK') {
      if (this.keypadCode.length === 4 && this.keypadSubmit) this.keypadSubmit(this.keypadCode);
      return;
    } else if (this.keypadCode.length < 4) this.keypadCode += k;
    this.drawKeypad();
  }

  drawKeypad() {
    this.$('#keypadScreen').textContent = (this.keypadCode + '····').slice(0, 4);
  }

  keypadWrong() {
    const el = this.$('#keypad');
    el.classList.add('wrong');
    this.keypadCode = '';
    this.$('#keypadScreen').textContent = 'ERR ';
  }

  closeKeypad() {
    if (!this.keypadOpen) return;
    this.keypadOpen = false;
    this.$('#keypad').hidden = true;
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
  showJumpscare(level = 0, goat = false, flat = false) {
    const j = this.$('#jumpscareOverlay');
    // l'entité surgit dans la scène (3D) : ici, seulement l'éclair rouge (sans éclair si on l'a demandé)
    j.classList.toggle('soft', !!this.reduceFlashes);
    j.classList.toggle('three', !flat && !goat);
    if (!flat && !goat) {
      const img = this.$('#scareImg');
      if (img) img.hidden = true;
      this.$('#scareAnim').hidden = true;
      j.hidden = false;
      j.classList.remove('flash');
      void j.offsetWidth;
      j.classList.add('flash');
      clearTimeout(this.scareHideT);
      this.scareHideT = setTimeout(() => (j.hidden = true), 1400);
      return;
    }
    const A = ENTITY_ANIM;
    const anim = this.$('#scareAnim');
    const img = this.$('#scareImg');
    anim.hidden = level !== 1 || goat;
    j.classList.toggle('goat', goat); // percuté : un éclair rouge par-dessus la scène, sans fond noir
    // Level 5 : le screamer est en 3D (la scène) ; l'écran ne fait qu'un éclair rouge et de la neige par-dessus
    j.classList.toggle('l5', level === HOTEL_LEVEL);
    if (img) img.hidden = level === 1 || goat || level === HOTEL_LEVEL;
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
    clearTimeout(this.scareHideT);
    this.scareHideT = setTimeout(() => {
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
    // la carte de fin arrive après le choc ; au bout de 3 s, un clic ou une touche la fait venir tout de suite
    clearTimeout(this.endT);
    const reveal = () => {
      clearTimeout(this.endT);
      this.endPending = null;
      end.hidden = false;
    };
    this.endAt = performance.now();
    this.endPending = reveal;
    this.endT = setTimeout(reveal, goat ? 12500 : sim.state === 'dead' ? 1300 : 300);

    const solo = sim.players.length === 1;
    const heard = tapesHeard().length;
    this.$('#endLore').textContent = `TAPES ARCHIVED · ${heard}/${LORE.length}`;
    const d = this.$('#tapeDate').textContent;
    if (sim.state === 'won') {
      const sl = slideOf(sim);
      if (sim.level === HOTEL_LEVEL) {
        // le Terror Hotel : par l'escalier de secours
        title.textContent = solo ? 'YOU ESCAPED' : 'YOU ALL ESCAPED';
        title.style.color = '#22c55e';
        sub.textContent = 'The fire escape spiralled down for hours, then opened onto daylight. The hotel let you go… this time.';
        stats.textContent = `HOTEL ENDING · ${formatTime(sim.time)} · Level 0, 1, 37 and 5 cleared`;
        this.$('#endTape').textContent = `${d} · CHECK-OUT`;
      } else if (sim.level === PIPES_LEVEL) {
        // la vraie fin : par le toboggan jaune et les tuyauteries
        title.textContent = solo ? 'YOU ESCAPED' : 'YOU ALL ESCAPED';
        title.style.color = '#22c55e';
        sub.textContent = 'The service elevator climbed for a long time. Then daylight, real daylight, through a crack in a door. Nobody is humming.';
        stats.textContent = `TRUE ENDING · ${formatTime(sim.time)} · Level 0, 1, 37 and 2 cleared`;
        this.$('#endTape').textContent = `${d} · FINAL TAPE · DO NOT ERASE`;
      } else {
        // la fausse sortie : rouge ou bleu… on se réveille sur la moquette du Level 0
        title.textContent = 'YOU WOKE UP';
        title.style.color = '#ffcf3a';
        sub.textContent = `The ${sl ? sl.name.toLowerCase() : ''} slide spat you out onto wet carpet. The lights hum. The wallpaper is yellow. Level 0, again. Maybe the yellow slide…`.replace('The  slide', 'The slide');
        stats.textContent = `LOOP ENDING · ${formatTime(sim.time)} · Level 0, 1 and 37 cleared`;
        this.$('#endTape').textContent = `${d} · TAPE ENDS · REWIND?`;
      }
    } else {
      title.textContent = solo ? 'YOU DIED' : 'NOBODY MADE IT OUT';
      title.style.color = '#ef4444';
      const PIPES = sim.level === PIPES_LEVEL;
      sub.textContent = sim.level === HOTEL_LEVEL ? 'Room service never knocks…' : PIPES ? 'The herd found you in the dark…' : sim.level === 1 ? 'The entity was waiting at the end of the shelves…' : 'The entity caught you in the endless hallways…';
      stats.textContent = `Level ${levelName(sim.level)} · ${sim.level === HOTEL_LEVEL ? `letters ${sim.posted}/6` : PIPES ? `valves ${sim.valves}/4` : sim.level === 2 ? `valves ${sim.fuses}/3` : sim.level === 1 ? `fuses ${sim.delivered || 0}/3` : `tapes ${sim.cassettes}/5`} · Survived for ${formatTime(sim.time)}`;
      this.$('#endTape').textContent = `${d} · RECORDING STOPPED`;
    }

    // un invité attend que l'hôte relance une partie
    const btn = this.$('#btnRestart');
    btn.disabled = !onRestart;
    btn.textContent = onRestart ? 'PLAY AGAIN' : 'WAITING FOR THE HOST…';
    this.$('#btnRestart').onclick = () => {
      if (!onRestart) return;
      this.endPending = null;
      clearTimeout(this.endT);
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

  // pause ; avant la toute première prise en main, c'est l'écran titre (et « Continuer » si une partie s'est arrêtée
  // plus loin, en solo)
  showPause(visible, kb, title = false, resume = null) {
    this.$('#clickPrompt').style.display = visible ? 'block' : 'none';
    this.$('#clickPrompt').classList.toggle('title', !!title);
    this.$('#titleCard').hidden = !title;
    this.$('#pauseTitle').hidden = !!title;
    const btn = this.$('#btnContinue');
    btn.hidden = !(title && resume);
    if (resume) btn.textContent = `▶▶ CONTINUE FROM LEVEL ${levelName(resume)}`;
    const tactile = document.body.classList.contains('touch') || matchMedia('(pointer: coarse)').matches;
    this.$('#pauseGo').textContent = tactile ? 'TAP THE SCREEN TO PLAY' : kb ? 'PRESS ENTER TO PLAY' : title ? 'CLICK TO PRESS PLAY' : 'CLICK TO TAKE CONTROL';
    const mv = this.qwerty ? 'WASD' : 'ZQSD';
    this.$('#pauseKeys').textContent = kb
      ? `${mv} move · Arrows look · Shift run · C crouch · 1 flashlight · 2 3 select · E use / hide (hotel) · F pick up / hide · T whistle · Esc pause`
      : `${mv} move · Mouse look · Shift run · C crouch · 1 flashlight · 2 3 select · E use / hide (hotel) · F pick up / hide · T whistle · Esc pause`;
    for (const b of this.el.querySelectorAll('button[data-kb]')) b.classList.toggle('on', (b.dataset.kb === '1') === kb);
  }
}

function formatTime(t) {
  const s = Math.floor(t);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}
