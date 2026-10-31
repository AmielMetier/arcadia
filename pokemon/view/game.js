// pokemon/view/game.js
// Interface du tournoi Poké Duel : enchaîne les écrans (draft, tableau, aperçu, combat, résumé, podium)
// selon l'état diffusé par l'hôte. L'arène de combat (sprites Showdown animés, barres de PV progressives,
// paliers de stats, PP réels, journal, déroulement séquentiel des tours) vit ici ; les autres écrans dans screens.js.

import { spriteUrls, POKEBALL_SPRITE } from '../engine/data.js';
import { MOVES } from '../engine/moves.js';
import { ITEMS, CHOICE, cleanItems } from '../engine/items.js';

/** Objet Choix : seule l'attaque bloquée reste disponible (tant qu'elle a des PP). */
function choiceBlocked(p, moveId) {
  if (!p || !CHOICE.has(p.item) || !p.choiceLock || p.choiceLock === moveId) return false;
  const pp = p.ppMap ? p.ppMap[p.choiceLock] : 1;
  return p.moves.includes(p.choiceLock) && pp > 0;
}

/** Petit badge de l'objet tenu (barré quand il a servi : baie mangée, Ceinture Force utilisée). */
function itemBadge(p) {
  const it = p && ITEMS[p.item];
  if (!it) return '';
  const lock = CHOICE.has(p.item) && p.choiceLock && MOVES[p.choiceLock] ? ` · bloqué sur ${MOVES[p.choiceLock].name}` : '';
  return `<span class="sc-item ${p.itemUsed ? 'used' : ''}" title="${it.name} : ${it.desc}${p.itemUsed ? ' (déjà utilisé)' : ''}${lock}"><img src="${it.icon}" alt="">${it.name}</span>`;
}
import { STAGE_MULTS } from '../engine/battle.js';
import { TYPES, getEffectiveness, getShowdownTypeIcon, getCategoryIcon } from '../engine/types.js';
import { getParticipant, currentMatch, TEAM_SIZE } from '../engine/tournament.js';
import { sfx } from './sfx.js';
import { createFx } from './fx.js';
import { eventMs, drainMs, damageText, typeMs, TYPE_MS } from '../engine/timing.js';
import { battleMusic } from './music.js';
import { renderDraft, renderBracket, renderPreview, renderSummary, renderPodium, bracketHtml, esc, trainerAvatar } from './screens.js';

const STATUS_LABELS = {
  burn: 'BRÛ',
  paralysis: 'PAR',
  poison: 'PSN',
  toxic: 'PSN',
  freeze: 'GEL',
  sleep: 'SOM'
};
const statusBadge = (st) => st ? `<span class="status-badge status-${st}">${STATUS_LABELS[st] || st.toUpperCase()}</span>` : '';

const STAT_SHORT = {
  atk: 'ATQ',
  def: 'DÉF',
  spa: 'ASP',
  spd: 'DSP',
  spe: 'VIT'
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function mountGame(root, { me, draft, lead, ready, cont, skip, restart, submitAction, isHost, switchMode, exit }) {
  root.className = 'poke-root tz-root';
  root.innerHTML = `
    <div class="tz-backdrop" aria-hidden="true"><i class="beam b1"></i><i class="beam b2"></i><i class="beam b3"></i></div>
    <header class="poke-topbar">
      <div class="poke-brand">
        <svg class="tz-logo" viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="16" r="14" fill="#fff" stroke="#000" stroke-width="2.5"/><path d="M2 16a14 14 0 0 1 28 0z" fill="#ee1515" stroke="#000" stroke-width="2.5"/><circle cx="16" cy="16" r="4.5" fill="#fff" stroke="#000" stroke-width="2.5"/></svg>
        <b>POKÉ DUEL</b>
        <span class="poke-badge">TOURNOI 3v3</span>
        <span id="pokeRoundTitle">Tournoi</span>
      </div>
      <div class="poke-tools">
        <button class="poke-tool" id="btnTree">TABLEAU</button>
        <button class="poke-tool" id="btnLog">JOURNAL</button>
        <button class="poke-tool" id="btnSet" aria-label="Réglages">RÉGLAGES</button>
        <button class="poke-tool quit" id="btnQuit">QUITTER</button>
      </div>
    </header>
    <main class="poke-stage" id="pokeStage"></main>
    <div class="poke-log-drawer" id="pokeLogDrawer" hidden>
      <div class="pld-head">
        <b>JOURNAL DE COMBAT</b>
        <button class="pld-close" id="btnCloseLog">FERMER</button>
      </div>
      <div class="pld-list" id="pokeLogList"></div>
    </div>
    <div class="tz-tree-drawer" id="pokeTreeDrawer" hidden>
      <div class="pld-head">
        <b>TABLEAU DU TOURNOI</b>
        <button class="pld-close" id="btnCloseTree">FERMER</button>
      </div>
      <div class="tz-tree-body" id="pokeTreeBody"></div>
    </div>
    <div class="tz-splash" id="pokeSplash" hidden></div>
    <div class="poke-toast" id="pokeToast" hidden></div>`;

  const $ = (s) => root.querySelector(s);
  const stage = $('#pokeStage');

  let state = null;
  let activeTab = 'moves'; // 'moves' | 'switch'
  let displayedHp = { bottom: null, top: null };
  let shownMon = { bottom: null, top: null }; // Pokémon visible de chaque côté (null : rien sur le terrain)
  let hpAnimRaf = { bottom: null, top: null };
  let isResolvingTurn = false;
  let animGen = 0;          // change quand on quitte le combat : coupe une animation en cours
  const evQueue = [];       // tours reçus pendant qu'un autre se déroule à l'écran
  let lastEvSeq = 0;
  let clockOff = 0;         // décalage d'horloge avec l'hôte
  let lastPhase = null;
  const now = () => Date.now() + clockOff;

  // Taille de l'interface selon la fenêtre (écrans hors combat, message et commandes du combat)
  function setUiZoom() {
    const z = Math.max(0.8, Math.min(1.6, Math.min(window.innerWidth / 1280, window.innerHeight / 820)));
    root.style.setProperty('--ui-zoom', window.innerWidth < 760 ? 1 : z.toFixed(3));
  }
  setUiZoom();
  window.addEventListener('resize', setUiZoom);

  // --- Outils & Audio : la musique et les effets se règlent dans le panneau Réglages (à 0 : coupés) ---
  DDVolume.panel($('#btnSet'), { accent: '#ffcb05' });
  $('#btnQuit').onclick = () => { battleMusic.stop(); cleanup(); exit(); };

  const logDrawer = $('#pokeLogDrawer');
  const logList = $('#pokeLogList');
  $('#btnLog').onclick = () => {
    logDrawer.hidden = !logDrawer.hidden;
    treeDrawer.hidden = true;
    renderLogHistory();
  };
  $('#btnCloseLog').onclick = () => { logDrawer.hidden = true; };

  const treeDrawer = $('#pokeTreeDrawer');
  $('#btnTree').onclick = () => {
    treeDrawer.hidden = !treeDrawer.hidden;
    logDrawer.hidden = true;
    renderTreeDrawer();
  };
  $('#btnCloseTree').onclick = () => { treeDrawer.hidden = true; };

  function renderTreeDrawer() {
    if (treeDrawer.hidden || !state || !state.t) return;
    $('#pokeTreeBody').innerHTML = bracketHtml(state.t, me.id, true);
  }

  function renderLogHistory() {
    if (!logList) return;
    const hist = state && state.battle && state.battle.history ? state.battle.history : [];
    if (hist.length === 0) {
      logList.innerHTML = `<div class="pld-empty">Aucune action enregistrée pour le moment.</div>`;
      return;
    }
    logList.innerHTML = hist.map(item => `
      <div class="pld-row type-${item.type || 'msg'}">
        <span class="pld-turn">T${item.turn || 1}</span>
        <span class="pld-txt">${esc(item.text)}</span>
      </div>
    `).join('');
    logList.scrollTop = logList.scrollHeight;
  }

  function toast(msg, ms = 2400) {
    const t = $('#pokeToast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.hidden = true; }, ms);
  }


  // --- Rendu des Popups de dégâts flottants ---
  function showDamagePopup(side, damage, isCrit) {
    const anchor = $(side === 'bottom' ? '#popupAnchorBottom' : '#popupAnchorTop');
    if (!anchor || !damage) return;
    const pop = document.createElement('div');
    pop.className = `damage-popup ${isCrit ? 'crit' : ''}`;
    pop.textContent = isCrit ? `-${damage} CRITIQUE !` : `-${damage}`;
    anchor.appendChild(pop);
    setTimeout(() => pop.remove(), 1150);
  }

  // --- Rendu des 3 Pokéballs d'équipe ---
  const ballsHtml = (team) => `
    <div class="team-pokeballs">
      ${team.map(p => `
        <div class="ball-slot ${p.fainted ? 'fainted' : 'alive'}" title="${p.name} (${p.hp}/${p.maxHp} PV)">
          <img src="${POKEBALL_SPRITE}" alt="ball" class="ball-img">
        </div>
      `).join('')}
    </div>`;

  // --- Rendu des badges de types officiels Showdown ---
  const typeBadgesHtml = (types) => (types || []).map(t => `<span class="tz-type" style="--tc:${TYPES[t].color}">${TYPES[t].name}</span>`).join('');

  // --- Rendu des paliers de statistiques (+1 ATQ, -1 DÉF, etc.) ---
  const statStagesHtml = (statStages) => {
    if (!statStages) return '';
    const entries = Object.entries(statStages).filter(([, val]) => val !== 0);
    if (entries.length === 0) return '';
    return entries.map(([k, val]) => {
      const mult = STAGE_MULTS[val] || 1;
      const multStr = Number.isInteger(mult) ? `${mult}` : mult.toFixed(1);
      const cls = val > 0 ? 'up' : 'down';
      return `<span class="sc-stage-pill ${cls}">${STAT_SHORT[k] || k.toUpperCase()} ×${multStr}</span>`;
    }).join('');
  };


  // --- Barre de PV qui descend (ou remonte) à vitesse réglée par timing.js ---
  function animateHp(side, fromHp, toHp, maxHp, duration = 0) {
    const isBottom = side === 'bottom';
    const fillEl = $(isBottom ? '#hpFillBottom' : '#hpFillTop');
    const numEl = $(isBottom ? '#hpNumBottom' : '#hpNumTop');
    const maxEl = isBottom ? $('#hpMaxBottom') : null;
    if (maxEl && maxHp) maxEl.textContent = `${maxHp}`;
    if (!fillEl) return Promise.resolve();

    if (hpAnimRaf[side]) {
      cancelAnimationFrame(hpAnimRaf[side]);
      hpAnimRaf[side] = null;
    }
    const paint = (hp) => {
      const pct = Math.max(0, Math.min(100, (hp / maxHp) * 100));
      fillEl.style.width = `${pct}%`;
      const hpClass = pct > 50 ? 'hp-green' : pct > 20 ? 'hp-yellow' : 'hp-red';
      fillEl.className = `hp-fill ${hpClass}`;
      if (numEl) {
        numEl.textContent = `${Math.round(hp)}`;
        numEl.className = hpClass;
      }
      return pct;
    };

    const diff = toHp - fromHp;
    if (diff === 0 || !duration) {
      paint(toHp);
      displayedHp[side] = toHp;
      return Promise.resolve();
    }
    const startTime = performance.now();
    return new Promise((resolve) => {
      function step(now) {
        const progress = Math.min(1, (now - startTime) / duration);
        const pct = paint(fromHp + diff * progress);
        if (progress < 1) {
          hpAnimRaf[side] = requestAnimationFrame(step);
        } else {
          hpAnimRaf[side] = null;
          displayedHp[side] = toHp;
          if (pct <= 20 && pct > 0 && diff < 0) sfx.play('low_hp');
          resolve();
        }
      }
      hpAnimRaf[side] = requestAnimationFrame(step);
    });
  }

  // --- Mise à l'échelle de l'arène : la scène est dessinée à taille fixe puis ajustée à la fenêtre ---
  const SCENE = { wide: [960, 420], narrow: [600, 470] };
  let sceneK = 1;
  let sceneObserver = null;
  function fitScene() {
    const card = $('#arenaCard');
    const field = card && card.querySelector('.battlefield');
    const inner = $('#bfInner');
    if (!field || !inner) return;
    const narrow = card.clientWidth < 680;
    card.classList.toggle('narrow', narrow);
    const [w, h] = narrow ? SCENE.narrow : SCENE.wide;
    inner.style.width = `${w}px`;
    inner.style.height = `${h}px`;
    sceneK = field.clientWidth / w;
    inner.style.transform = `scale(${sceneK})`;
  }
  function watchScene() {
    if (sceneObserver) sceneObserver.disconnect();
    const card = $('#arenaCard');
    if (!card || typeof ResizeObserver === 'undefined') { fitScene(); return; }
    sceneObserver = new ResizeObserver(() => fitScene());
    sceneObserver.observe(card);
    fitScene();
  }

  // --- Texte qui s'écrit lettre par lettre dans la fenêtre de message ---
  function typeText(txt, gen) {
    const el = $('#dialogueText');
    if (!el) return Promise.resolve();
    const full = String(txt || '');
    const total = typeMs(full);
    el.textContent = '';
    if (!full) return Promise.resolve();
    const start = performance.now();
    return new Promise((resolve) => {
      const tickType = () => {
        if (gen !== animGen) return resolve();
        const n = total ? Math.ceil((full.length * (performance.now() - start)) / total) : full.length;
        el.textContent = full.slice(0, n);
        if (n >= full.length) return resolve();
        setTimeout(tickType, TYPE_MS);
      };
      tickType();
    });
  }

  // --- Déroulement d'un tour, événement par événement, au rythme de timing.js ---
  async function playSequentialTurn(s) {
    const b = s.battle;
    if (!b) return;
    if (!$('#arenaCard')) renderBattle(s);
    isResolvingTurn = true;
    const gen = animGen;
    const stale = () => gen !== animGen;
    const pause = async (ms) => { if (ms > 0) await sleep(ms); return stale(); };
    const fx = createFx({ inner: $('#bfInner'), layer: $('#fxLayer'), scale: () => sceneK });

    const mySide = String(b.trainerA.id) === String(me.id) ? 'A' : String(b.trainerB.id) === String(me.id) ? 'B' : null;
    const bottomSide = mySide === 'B' ? 'B' : 'A';
    const keyOf = (side) => (side === bottomSide ? 'bottom' : 'top');
    const spriteOf = (side) => $(side === bottomSide ? '#spriteBottom' : '#spriteTop');
    const boxOf = (side) => $(side === bottomSide ? '.hud-bottom' : '.hud-top');
    const teamOf = (side) => (side === 'A' ? b.teamA : b.teamB);

    const dash = $('#dashContainer');
    if (dash) {
      dash.innerHTML = `
        <div class="dash-resolving-view">
          <div class="dash-resolving-title">
            <span class="live-pill">TOUR ${b.turn > 1 ? b.turn - 1 : 1}</span>
            <span id="liveTurnMainText">Le tour se déroule…</span>
          </div>
          <div class="dash-resolving-steps" id="liveTurnSteps"></div>
        </div>`;
    }
    const logStep = (txt, tag = '') => {
      const stepsEl = $('#liveTurnSteps');
      if (!stepsEl || !txt) return;
      const line = document.createElement('div');
      line.className = `turn-step-item ${tag}`;
      line.textContent = txt;
      stepsEl.appendChild(line);
      stepsEl.scrollTop = stepsEl.scrollHeight;
    };
    const say = (txt, tag) => { logStep(txt, tag); return typeText(txt, gen); };

    for (const ev of s.events) {
      const t0 = performance.now();
      const budget = eventMs(ev);
      const msg = ev.msg || ev.text || '';

      if (ev.type === 'switch') {
        const key = keyOf(ev.side);
        const sprite = spriteOf(ev.side);
        if (sprite && !sprite.classList.contains('fx-hidden') && shownMon[key] && shownMon[key] !== ev.pokemonId) {
          sfx.play('switch');
          await fx.recall(sprite);
          if (stale()) return;
        }
        // Le cadre se met à jour pour le nouveau Pokémon
        const nameEl = $(key === 'bottom' ? '#nameBottom' : '#nameTop');
        if (nameEl) nameEl.textContent = ev.name;
        const typesEl = $(key === 'bottom' ? '#typesBottom' : '#typesTop');
        if (typesEl && ev.types) typesEl.innerHTML = typeBadgesHtml(ev.types);
        const stEl = $(key === 'bottom' ? '#statusBottom' : '#statusTop');
        if (stEl) stEl.innerHTML = statusBadge(ev.status);
        const stgEl = $(key === 'bottom' ? '#stagesBottom' : '#stagesTop');
        if (stgEl) stgEl.innerHTML = '';
        const itEl = $(key === 'bottom' ? '#itemBottom' : '#itemTop');
        if (itEl) itEl.innerHTML = itemBadge(teamOf(ev.side).find((p) => p.id === ev.pokemonId));
        if (ev.hp !== undefined) animateHp(key, ev.hp, ev.hp, ev.maxHp);
        const box = boxOf(ev.side);
        if (box && box.classList.contains('hud-out')) {
          box.classList.remove('hud-out');
          box.animate([{ transform: `translateX(${key === 'bottom' ? 110 : -110}%)` }, { transform: 'none' }], { duration: 300, easing: 'ease-out' });
        }
        if (sprite) {
          sprite.classList.add('fx-hidden');
          sprite.src = key === 'bottom' ? spriteUrls(ev.pokemonId).back : spriteUrls(ev.pokemonId).front;
        }
        const talk = say(msg, 'step-switch');
        if (sprite) {
          await fx.throwBall(sprite, key === 'bottom');
          if (stale()) return;
          sfx.play('switch');
          if (ev.pokemonId) sfx.playCry(ev.pokemonId);
          await fx.appear(sprite);
        }
        await talk;
        shownMon[key] = ev.pokemonId;

      } else if (ev.type === 'attack_start') {
        await say(msg, 'step-attack');
        if (stale()) return;
        const att = spriteOf(ev.side);
        const def = spriteOf(ev.side === 'A' ? 'B' : 'A');
        const color = (TYPES[ev.moveType] || TYPES.normal).color;
        const towardsTop = ev.side === bottomSide;
        if (ev.moveCat === 'special') {
          sfx.play('beam');
          await fx.lunge(att, towardsTop);
          if (def) await fx.projectile(att, def, color);
          if (def) fx.impact(def, color);
        } else if (ev.moveCat === 'physical') {
          sfx.play('hit');
          await fx.lunge(att, towardsTop);
          if (def) fx.impact(def, color, true);
        } else {
          sfx.play('item');
          if (att) fx.sparkles(att, color);
        }

      } else if (ev.type === 'damage') {
        const key = keyOf(ev.defSide);
        const target = spriteOf(ev.defSide);
        if (ev.damage > 0) {
          sfx.playHit(ev.mult || 1);
          if (ev.crit || ev.mult >= 2) fx.shake(ev.crit ? 9 : 6);
          showDamagePopup(key, ev.damage, ev.crit);
          if (target) await fx.blink(target);
          if (stale()) return;
          const oldHp = displayedHp[key] !== null ? displayedHp[key] : ev.defHp + ev.damage;
          await animateHp(key, oldHp, ev.defHp, ev.defMaxHp, drainMs(ev.damage, ev.defMaxHp));
          if (stale()) return;
          logStep(`${ev.defName || ''} perd ${ev.damage} PV`, ev.mult >= 2 ? 'step-super' : 'step-damage');
        }
        const eff = damageText(ev);
        if (eff) await say(eff, ev.mult >= 2 ? 'step-super' : 'step-damage');

      } else if (ev.type === 'status_damage') {
        const key = keyOf(ev.side);
        const sprite = spriteOf(ev.side);
        const st = teamOf(ev.side)[ev.side === 'A' ? b.activeA : b.activeB];
        const talk = say(msg, 'step-damage');
        if (sprite) await fx.statusPulse(sprite, st && st.status);
        await talk;
        if (stale()) return;
        const oldHp = displayedHp[key] !== null ? displayedHp[key] : ev.hp + ev.damage;
        await animateHp(key, oldHp, ev.hp, ev.maxHp, drainMs(ev.damage, ev.maxHp));

      } else if (ev.type === 'heal' || ev.type === 'recoil') {
        const key = keyOf(ev.side);
        const sprite = spriteOf(ev.side);
        if (ev.item && sprite && ITEMS[ev.item]) fx.itemPop(sprite, ITEMS[ev.item].icon);
        await say(msg, 'step-status');
        if (stale()) return;
        if (ev.type === 'heal') {
          sfx.play('heal');
          if (sprite) fx.sparkles(sprite, '#78e070');
        } else if (sprite) {
          await fx.blink(sprite);
        }
        const amount = ev.type === 'heal' ? ev.amount : ev.damage;
        const oldHp = displayedHp[key] !== null ? displayedHp[key] : (ev.type === 'heal' ? ev.hp - amount : ev.hp + amount);
        await animateHp(key, oldHp, ev.hp, ev.maxHp, drainMs(amount, ev.maxHp));

      } else if (ev.type === 'item') {
        // l'objet entre en jeu : son icône surgit au-dessus du Pokémon
        const key = keyOf(ev.side);
        const sprite = spriteOf(ev.side);
        const it = ITEMS[ev.item];
        sfx.play(ev.item === 'focussash' ? 'hit' : 'heal');
        if (sprite && it) fx.itemPop(sprite, it.icon);
        const itEl = $(key === 'bottom' ? '#itemBottom' : '#itemTop');
        if (itEl && ev.item !== 'leftovers') { const sp = itEl.querySelector('.sc-item'); if (sp) sp.classList.add('used'); }
        await say(msg, 'step-status');

      } else if (ev.type === 'stat_change') {
        const sprite = spriteOf(ev.side);
        sfx.play(ev.val > 0 ? 'levelup' : 'wobble');
        // le message attend la fin de l'animation : on voit bien la stat monter ou baisser
        await Promise.all([sprite ? fx.statArrows(sprite, ev.val > 0) : null, say(msg, 'step-status')]);

      } else if (ev.type === 'status_applied') {
        const key = keyOf(ev.side);
        const sprite = spriteOf(ev.side);
        const stEl = $(key === 'bottom' ? '#statusBottom' : '#statusTop');
        if (stEl) stEl.innerHTML = statusBadge(ev.status);
        const talk = say(msg, 'step-status');
        if (sprite) fx.statusPulse(sprite, ev.status);
        await talk;

      } else if (ev.type === 'status_cured') {
        const key = keyOf(ev.side);
        const stEl = $(key === 'bottom' ? '#statusBottom' : '#statusTop');
        if (stEl) stEl.innerHTML = '';
        await say(msg, 'step-status');

      } else if (ev.type === 'faint') {
        const key = keyOf(ev.side);
        const sprite = spriteOf(ev.side);
        if (ev.pokemonId) sfx.playCry(ev.pokemonId);
        sfx.play('faint');
        if (sprite) await fx.faint(sprite);
        if (stale()) return;
        shownMon[key] = null;
        const ballsEl = $(key === 'bottom' ? '#ballsBottom' : '#ballsTop');
        if (ballsEl) ballsEl.innerHTML = ballsHtml(teamOf(ev.side));
        await say(msg, 'step-faint');

      } else if (ev.type === 'victory') {
        sfx.play('victory');
        await say(msg, 'step-victory');

      } else {
        await say(msg, 'step-status');
      }

      if (stale()) return;
      // On tient le rythme de l'hôte : chaque événement dure exactement eventMs
      if (await pause(budget - (performance.now() - t0))) return;
    }

    isResolvingTurn = false;
    if (evQueue.length) {
      playSequentialTurn(evQueue.shift());
      return;
    }
    if (state && state.phase === 'battle') renderBattle(state);
    if (!logDrawer.hidden) renderLogHistory();
  }

  // --- Rendu du Combat (Arène Showdown avec Assets Authentiques Gen 5) ---
  function renderBattle(s) {
    const b = s.battle;
    if (!b) return;

    if (isResolvingTurn) return;

    if (battleMusic.musicEnabled) battleMusic.start(s.isFinal ? 'cynthia' : 'sandstorm');

    const mySide = String(b.trainerA.id) === String(me.id) ? 'A' : String(b.trainerB.id) === String(me.id) ? 'B' : null;
    const isSpectator = !mySide;

    const bottomSide = mySide === 'B' ? 'B' : 'A';
    const topSide = bottomSide === 'A' ? 'B' : 'A';

    const pBottom = bottomSide === 'A' ? b.teamA[b.activeA] : b.teamB[b.activeB];
    const pTop = topSide === 'A' ? b.teamA[b.activeA] : b.teamB[b.activeB];
    const tBottom = bottomSide === 'A' ? b.trainerA : b.trainerB;
    const tTop = topSide === 'A' ? b.trainerA : b.trainerB;
    const teamBottom = bottomSide === 'A' ? b.teamA : b.teamB;
    const teamTop = topSide === 'A' ? b.teamA : b.teamB;

    const hpPctBottom = Math.max(0, Math.min(100, Math.round((pBottom.hp / pBottom.maxHp) * 100)));
    const hpPctTop = Math.max(0, Math.min(100, Math.round((pTop.hp / pTop.maxHp) * 100)));

    const hpClassBottom = hpPctBottom > 50 ? 'hp-green' : hpPctBottom > 20 ? 'hp-yellow' : 'hp-red';
    const hpClassTop = hpPctTop > 50 ? 'hp-green' : hpPctTop > 20 ? 'hp-yellow' : 'hp-red';

    const isSubmitted = mySide === 'A' ? s.submittedA : mySide === 'B' ? s.submittedB : false;
    const isForcedSwitch = (mySide === 'A' && b.phase === 'switch_forced_A') ||
                           (mySide === 'B' && b.phase === 'switch_forced_B') ||
                           b.phase === 'switch_forced_both';

    if (isForcedSwitch) {
      activeTab = 'switch';
    }

    let announcement = '';
    if (isForcedSwitch) {
      announcement = 'Votre Pokémon est K.O. ! Choisissez un remplaçant !';
    } else if (b.phase === 'switch_forced_A' || b.phase === 'switch_forced_B') {
      announcement = "En attente du Pokémon de l'adversaire...";
    } else if (isSubmitted) {
      announcement = "Attaque enregistrée ! En attente de l'adversaire...";
    } else {
      announcement = `Tour ${b.turn || 1} — Que doit faire ${pBottom.name} ?`;
    }

    const leftMs = s.turnEndsAt ? Math.max(0, s.turnEndsAt - now()) : 0;
    const leftSec = s.turnEndsAt ? `${Math.ceil(leftMs / 1000)} s` : '—';
    const timerWidth = s.turnEndsAt ? Math.max(0, Math.min(100, (leftMs / (s.timerSecs * 1000)) * 100)) : 100;

    const existingArena = $('#arenaCard');
    if (!existingArena) {
      displayedHp.bottom = pBottom.hp;
      displayedHp.top = pTop.hp;
      shownMon = s.intro ? { bottom: null, top: null } : { bottom: pBottom.fainted ? null : pBottom.id, top: pTop.fainted ? null : pTop.id };

      stage.innerHTML = `
        <div class="arena-card deal ${s.isFinal ? 'final' : ''}" id="arenaCard">
          <div class="battlefield"><div class="bf-inner" id="bfInner">
            <div class="fx-layer" id="fxLayer"></div>
            <!-- Cadre de l'adversaire (Haut-Gauche), cadre Noir & Blanc -->
            <div class="hud-zone hud-top ${s.intro ? 'hud-out' : ''}">
              <div class="bw-trainer-row"><span class="bw-trainer" style="--tc:${tTop.color}">${esc(tTop.name)}</span><div id="ballsTop" class="bw-balls">${ballsHtml(teamTop)}</div></div>
              <div class="bw-box enemy">
                <b class="bw-name" id="nameTop">${esc(pTop.name)}</b>
                <span class="bw-lv">N.${pTop.level || 50}</span>
                <span class="bw-status" id="statusTop">${statusBadge(pTop.status)}</span>
                <div class="bw-hp"><div class="hp-fill ${hpClassTop}" id="hpFillTop" style="width:${hpPctTop}%"></div></div>
              </div>
              <div class="bw-extra"><span class="sc-types" id="typesTop">${typeBadgesHtml(pTop.types)}</span><span id="itemTop">${itemBadge(pTop)}</span><span class="sc-stages" id="stagesTop">${statStagesHtml(pTop.statStages)}</span></div>
            </div>

            <!-- Zone Combat Adversaire (Haut-Droite) -->
            <div class="fighter-zone fighter-top">
              <div class="platform platform-top">
                <img src="assets/plat_stone_enemy.png" class="plat-img" alt="">
                <img class="poke-sprite front ${pTop.fainted || s.intro ? 'fx-hidden' : ''}" id="spriteTop" src="${spriteUrls(pTop.id).front}" alt="${pTop.name}">
                <div class="damage-popup-anchor" id="popupAnchorTop"></div>
              </div>
            </div>

            <!-- Zone Combat Joueur (Bas-Gauche) -->
            <div class="fighter-zone fighter-bottom">
              <div class="platform platform-bottom">
                <img src="assets/plat_stone_enemy.png" class="plat-img" alt="">
                <img class="poke-sprite back ${pBottom.fainted || s.intro ? 'fx-hidden' : ''}" id="spriteBottom" src="${spriteUrls(pBottom.id).back}" alt="${pBottom.name}">
                <div class="damage-popup-anchor" id="popupAnchorBottom"></div>
              </div>
            </div>

            <!-- Cadre du joueur (Bas-Droite), cadre Noir & Blanc -->
            <div class="hud-zone hud-bottom ${s.intro ? 'hud-out' : ''}">
              <div class="bw-extra"><span class="sc-types" id="typesBottom">${typeBadgesHtml(pBottom.types)}</span><span id="itemBottom">${itemBadge(pBottom)}</span><span class="sc-stages" id="stagesBottom">${statStagesHtml(pBottom.statStages)}</span></div>
              <div class="bw-box player">
                <b class="bw-name" id="nameBottom">${esc(pBottom.name)}</b>
                <span class="bw-lv">N.${pBottom.level || 50}</span>
                <span class="bw-status" id="statusBottom">${statusBadge(pBottom.status)}</span>
                <div class="bw-hp"><div class="hp-fill ${hpClassBottom}" id="hpFillBottom" style="width:${hpPctBottom}%"></div></div>
                <span class="bw-hpnum"><b id="hpNumBottom" class="${hpClassBottom}">${pBottom.hp}</b>/<span id="hpMaxBottom">${pBottom.maxHp}</span></span>
              </div>
              <div class="bw-trainer-row right"><div id="ballsBottom" class="bw-balls">${ballsHtml(teamBottom)}</div><span class="bw-trainer" style="--tc:${tBottom.color}">${esc(tBottom.name)}</span></div>
            </div>
          </div>

          </div>
          <!-- Fenêtre de message -->
          <div class="battle-dialogue-bar">
            <span class="dialogue-tag" id="turnTag">TOUR ${b.turn || 1}</span>
            <span class="dialogue-text" id="dialogueText">${announcement}</span>
          </div>

          <!-- Pupitre de Commandes Tactiles Professionnel -->
          <div class="dashboard" id="dashContainer"></div>
        </div>`;
      watchScene();
    } else {
      $('#nameTop').textContent = pTop.name;
      $('#typesTop').innerHTML = typeBadgesHtml(pTop.types);
      $('#statusTop').innerHTML = statusBadge(pTop.status);
      if ($('#stagesTop')) $('#stagesTop').innerHTML = statStagesHtml(pTop.statStages);
      $('#ballsTop').innerHTML = ballsHtml(teamTop);
      if ($('#itemTop')) $('#itemTop').innerHTML = itemBadge(pTop);

      $('#nameBottom').textContent = pBottom.name;
      $('#typesBottom').innerHTML = typeBadgesHtml(pBottom.types);
      $('#statusBottom').innerHTML = statusBadge(pBottom.status);
      if ($('#stagesBottom')) $('#stagesBottom').innerHTML = statStagesHtml(pBottom.statStages);
      $('#ballsBottom').innerHTML = ballsHtml(teamBottom);
      if ($('#itemBottom')) $('#itemBottom').innerHTML = itemBadge(pBottom);

      if ($('#turnTag')) $('#turnTag').textContent = `TOUR ${b.turn || 1}`;
      if ($('#hpMaxBottom')) $('#hpMaxBottom').textContent = `${pBottom.maxHp}`;
      $('#dialogueText').textContent = announcement;

      const sTop = $('#spriteTop');
      const topChanged = sTop && !sTop.src.includes(`/${pTop.id}.gif`);
      if (topChanged) {
        sTop.src = spriteUrls(pTop.id).front;
        sTop.className = `poke-sprite front ${pTop.fainted ? 'fx-hidden' : 'anim-enter'}`;
        displayedHp.top = pTop.hp;
        animateHp('top', pTop.hp, pTop.hp, pTop.maxHp);
      } else if (displayedHp.top !== null && displayedHp.top !== pTop.hp) {
        animateHp('top', displayedHp.top, pTop.hp, pTop.maxHp);
      } else {
        animateHp('top', pTop.hp, pTop.hp, pTop.maxHp);
      }

      const sBottom = $('#spriteBottom');
      const bottomChanged = sBottom && !sBottom.src.includes(`/${pBottom.id}.gif`);
      if (bottomChanged) {
        sBottom.src = spriteUrls(pBottom.id).back;
        sBottom.className = `poke-sprite back ${pBottom.fainted ? 'fx-hidden' : 'anim-enter'}`;
        displayedHp.bottom = pBottom.hp;
        animateHp('bottom', pBottom.hp, pBottom.hp, pBottom.maxHp);
      } else if (displayedHp.bottom !== null && displayedHp.bottom !== pBottom.hp) {
        animateHp('bottom', displayedHp.bottom, pBottom.hp, pBottom.maxHp);
      } else {
        animateHp('bottom', pBottom.hp, pBottom.hp, pBottom.maxHp);
      }
    }

    // Rendu du Pupitre de Commandes
    const dash = $('#dashContainer');
    if (dash) {
      const effTag = (m) => {
        if (!(m.power > 0)) return '';
        const eff = getEffectiveness(m.type, pTop.types);
        if (eff === 0) return '<span class="bw-eff zero">Aucun effet</span>';
        if (eff >= 2) return `<span class="bw-eff super">Super efficace${eff >= 4 ? ' ×4' : ''}</span>`;
        if (eff < 1) return '<span class="bw-eff low">Pas très efficace</span>';
        return '';
      };
      const aliveCount = teamBottom.filter(p => !p.fainted).length;
      // Pas encore de chrono (écran VS, envoi des Pokémon) : les choix ne sont pas encore ouverts
      const notYet = !s.turnEndsAt;
      dash.innerHTML = isSpectator ? `
        <div class="bw-spect">
          <span class="bw-live">EN DIRECT</span>
          <span><b>${esc(tBottom.name)}</b> contre <b>${esc(tTop.name)}</b></span>
        </div>
      ` : `
        <div class="bw-dash-head">
          <div class="dash-timer">
            <div class="dt-fill" id="timerFill" style="width:${timerWidth}%"></div>
            <span class="dt-text" id="timerText">${leftSec}</span>
          </div>
          ${isSubmitted ? '<span class="action-locked">Choix envoyé. En attente…</span>' : ''}
        </div>
        <div class="bw-dash-body">
          ${activeTab === 'moves' && !isForcedSwitch ? `
            <div class="moves-grid">
              ${pBottom.moves.map((moveId, mIdx) => {
                const m = MOVES[moveId];
                if (!m) return '';
                const maxPp = m.pp || 15;
                const curPp = pBottom.ppMap && pBottom.ppMap[moveId] !== undefined ? pBottom.ppMap[moveId] : maxPp;
                return `
                  <button class="bw-move ${choiceBlocked(pBottom, moveId) ? 'choice-locked' : ''}" data-move="${moveId}" style="--tc:${TYPES[m.type].color}" ${isSubmitted || notYet || curPp <= 0 || choiceBlocked(pBottom, moveId) ? 'disabled' : ''}
                    title="${esc(m.name)} · puissance ${m.power || '—'} · précision ${m.acc}%">
                    <span class="pm-key">${mIdx + 1}</span>
                    <span class="bw-move-name">${esc(m.name)}</span>
                    <span class="bw-move-meta">
                      <span class="tz-type" style="--tc:${TYPES[m.type].color}">${TYPES[m.type].name}</span>
                      <img src="${getCategoryIcon(m.cat)}" class="bw-cat" alt="">
                      <span class="bw-pp ${curPp <= Math.ceil(maxPp / 4) ? 'low' : ''}">PP ${curPp}/${maxPp}</span>
                    </span>
                    ${effTag(m)}
                  </button>`;
              }).join('')}
            </div>
          ` : `
            <div class="switch-grid">
              ${teamBottom.map((p, pIdx) => {
                const isCurrent = pIdx === (bottomSide === 'A' ? b.activeA : b.activeB);
                const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
                const hpCls = hpPct > 50 ? 'hp-green' : hpPct > 20 ? 'hp-yellow' : 'hp-red';
                return `
                  <button class="bw-party ${isCurrent ? 'current' : ''} ${p.fainted ? 'fainted' : ''}" data-switch="${pIdx}" ${isCurrent || p.fainted || isSubmitted || notYet ? 'disabled' : ''}>
                    <img src="${spriteUrls(p.id).icon}" alt="" class="bw-party-icon">
                    <b class="bw-party-name">${esc(p.name)}</b>
                    <span class="bw-party-lv">N.${p.level || 50}</span>
                    <span class="bw-party-hp"><span class="bw-hp mini"><span class="hp-fill ${hpCls}" style="width:${hpPct}%"></span></span></span>
                    <span class="bw-party-num">${p.fainted ? 'K.O.' : isCurrent ? 'Au combat' : `${p.hp}/${p.maxHp}`}</span>
                  </button>`;
              }).join('')}
            </div>
          `}
          <div class="bw-menu">
            <button class="bw-menu-btn fight ${activeTab === 'moves' && !isForcedSwitch ? 'on' : ''}" id="tabMoves" ${isForcedSwitch ? 'disabled' : ''}>Attaque</button>
            <button class="bw-menu-btn party ${activeTab === 'switch' || isForcedSwitch ? 'on' : ''}" id="tabSwitch">Pokémon <small>${aliveCount}/3</small></button>
          </div>
        </div>`;

      if (!isSpectator && !isSubmitted) {
        const bMoves = $('#tabMoves');
        const bSwitch = $('#tabSwitch');
        if (bMoves) bMoves.onclick = () => { activeTab = 'moves'; renderBattle(state); };
        if (bSwitch) bSwitch.onclick = () => { activeTab = 'switch'; renderBattle(state); };

        for (const btn of root.querySelectorAll('[data-move]')) {
          btn.onclick = () => {
            const moveId = btn.dataset.move;
            const moveObj = MOVES[moveId];
            if (moveObj && moveObj.cat === 'special') sfx.play('beam');
            else sfx.play('hit');
            submitAction({ type: 'move', moveId });
          };
        }

        for (const btn of root.querySelectorAll('[data-switch]')) {
          btn.onclick = () => {
            const targetIndex = Number(btn.dataset.switch);
            sfx.play('switch');
            submitAction({ type: 'switch', targetIndex });
          };
        }
      }
    }
  }

  // ==========================================================================
  // Écrans hors combat
  // ==========================================================================

  const local = { draft: [], items: {}, draftKey: null, lead: null, leadKey: null };
  const ctx = {
    me,
    local,
    sfx,
    isHost,
    actions: { skip, cont, restart, lead },
    exit: () => { battleMusic.stop(); cleanup(); exit(); },
    rerender: () => { if (state) renderPhase(state); },
    toggleDraft(dex) {
      const i = local.draft.indexOf(dex);
      if (i >= 0) local.draft.splice(i, 1);
      else if (local.draft.length < TEAM_SIZE) local.draft.push(dex);
      else { local.draft.shift(); local.draft.push(dex); }
      sfx.play('switch');
      ctx.rerender();
    },
    setItem(dex, key) {
      // un objet déjà tenu par un autre Pokémon de l'équipe lui est retiré (il en recevra un autre conseillé)
      for (const d of Object.keys(local.items)) if (local.items[d] === key && Number(d) !== dex) delete local.items[d];
      local.items[dex] = key;
      sfx.play('switch');
      ctx.rerender();
    },
    submitDraft() {
      if (local.draft.length !== TEAM_SIZE) return;
      sfx.play('levelup');
      draft([...local.draft], cleanItems(local.draft, local.items));
    },
    pickLead(idx) {
      local.lead = idx;
      lead(idx);
      sfx.play('switch');
      ctx.rerender();
    },
    sendReady() {
      sfx.play('hit');
      ready(local.lead);
    },
  };

  // --- Écran « VS » façon combat de dresseurs, à l'entrée de chaque manche ---
  let splashTimer = null;
  function showSplash(s) {
    const m = currentMatch(s.t);
    const el = $('#pokeSplash');
    if (!m || !el) return;
    const mine = String(m.b) === String(me.id);
    const L = getParticipant(s.t, mine ? m.b : m.a);
    const R = getParticipant(s.t, mine ? m.a : m.b);
    if (!L || !R) return;
    const sub = m.bestOf > 1 ? `MANCHE ${s.t.gameNo} · ${mine ? `${m.scoreB}-${m.scoreA}` : `${m.scoreA}-${m.scoreB}`}` : 'UNE SEULE MANCHE';
    el.innerHTML = `
      <div class="sp-half left" style="--pc:${L.color}">${trainerAvatar(L, 'splash')}<b>${esc(L.name)}</b></div>
      <div class="sp-half right" style="--pc:${R.color}">${trainerAvatar(R, 'splash')}<b>${esc(R.name)}</b></div>
      <div class="sp-center"><span class="sp-round">${esc(m.name.toUpperCase())}</span><span class="sp-vs">VS</span><span class="sp-sub">${sub}</span></div>`;
    el.hidden = false;
    el.classList.remove('out');
    void el.offsetWidth;
    el.classList.add('in');
    sfx.play('encounter');
    clearTimeout(splashTimer);
    splashTimer = setTimeout(() => {
      el.classList.add('out');
      splashTimer = setTimeout(() => { el.hidden = true; el.classList.remove('in', 'out'); }, 450);
    }, 1900);
  }

  function headerTitle(s) {
    const t = s.t;
    const m = currentMatch(t);
    const el = $('#pokeRoundTitle');
    if (!el) return;
    if (s.phase === 'draft') el.textContent = 'Draft';
    else if (s.phase === 'bracket') el.textContent = 'Tableau';
    else if (s.phase === 'podium') el.textContent = 'Podium';
    else if (m) {
      const mine = String(m.b) === String(me.id);
      el.textContent = m.bestOf > 1 ? `${m.name} · ${mine ? `${m.scoreB}-${m.scoreA}` : `${m.scoreA}-${m.scoreB}`}` : m.name;
    }
  }

  let lastRenderKey = null;
  function renderPhase(s) {
    headerTitle(s);
    const renderKey = `${s.phase}:${s.t.cur || ''}:${s.t.gameNo || 0}`;
    const fresh = renderKey !== lastRenderKey;
    lastRenderKey = renderKey;
    if (s.phase === 'draft') {
      const meP = getParticipant(s.t, me.id);
      const key = meP ? meP.offer.join(',') : '';
      if (local.draftKey !== key) { local.draftKey = key; local.draft = []; }
      renderDraft(stage, s, ctx);
    } else if (s.phase === 'bracket') renderBracket(stage, s, ctx);
    else if (s.phase === 'preview') renderPreview(stage, s, ctx);
    else if (s.phase === 'summary') renderSummary(stage, s, ctx);
    else if (s.phase === 'podium') renderPodium(stage, s, ctx);
    // Même écran redessiné (un joueur valide, l'adversaire est prêt…) : pas de nouvelle animation d'entrée
    if (!fresh && stage.firstElementChild) stage.firstElementChild.classList.add('still');
    tick();
  }

  function music(s) {
    if (s.phase === 'draft' || s.phase === 'bracket' || s.phase === 'preview') {
      if (battleMusic.musicEnabled) battleMusic.start('trainer');
    } else if (s.phase === 'summary') {
      battleMusic.stop();
    } else if (s.phase === 'podium') {
      battleMusic.stop();
      if (lastPhase !== 'podium') sfx.play('victory');
    }
  }

  // --- Comptes à rebours (draft, aperçu, résumé…) et chrono de combat ---
  function tick() {
    for (const el of root.querySelectorAll('[data-deadline]')) {
      const left = Math.max(0, Math.ceil((Number(el.dataset.deadline) - now()) / 1000));
      el.textContent = `${left} s`;
      el.classList.toggle('urgent', left <= 5);
    }
    for (const el of root.querySelectorAll('[data-deadline-bar]')) {
      const left = Math.max(0, Number(el.dataset.deadlineBar) - now());
      el.style.width = `${Math.min(100, (left / Number(el.dataset.total)) * 100)}%`;
    }
    if (state && state.phase === 'battle') {
      const fill = $('#timerFill');
      const txt = $('#timerText');
      if (fill && txt) {
        if (!state.turnEndsAt || isResolvingTurn) {
          fill.style.width = '100%';
          txt.textContent = '—';
          fill.parentElement.classList.remove('urgent');
        } else {
          const leftMs = Math.max(0, state.turnEndsAt - now());
          const sec = Math.ceil(leftMs / 1000);
          fill.style.width = `${Math.min(100, (leftMs / (state.timerSecs * 1000)) * 100)}%`;
          txt.textContent = `${sec} s`;
          fill.parentElement.classList.toggle('urgent', sec <= 5);
        }
      }
    }
  }
  const tickTimer = setInterval(tick, 200);

  // --- Raccourcis clavier ---
  function onKeyDown(e) {
    if (!state || !state.t || e.target.closest('input, textarea')) return;
    const s = state;
    if (s.phase === 'draft') {
      const meP = getParticipant(s.t, me.id);
      if (!meP || meP.team) return;
      const n = Number(e.key);
      if (n >= 1 && n <= meP.offer.length) ctx.toggleDraft(meP.offer[n - 1]);
      else if (e.key === 'Enter') ctx.submitDraft();
      return;
    }
    if (s.phase === 'preview') {
      const m = currentMatch(s.t);
      const side = m && (String(m.a) === String(me.id) ? 'A' : String(m.b) === String(me.id) ? 'B' : null);
      if (!side || s.t.ready[side]) return;
      const n = Number(e.key);
      if (n >= 1 && n <= TEAM_SIZE) ctx.pickLead(n - 1);
      else if (e.key === 'Enter') ctx.sendReady();
      return;
    }
    if (s.phase === 'summary') {
      if (e.key === 'Enter') { const b = $('#smGo'); if (b && !b.disabled) b.click(); }
      return;
    }
    if (s.phase !== 'battle' || !s.battle || isResolvingTurn) return;
    const b = s.battle;
    const mySide = String(b.trainerA.id) === String(me.id) ? 'A' : String(b.trainerB.id) === String(me.id) ? 'B' : null;
    if (!mySide) return;
    if (mySide === 'A' ? s.submittedA : s.submittedB) return;
    if (b.phase !== 'choose' || !s.turnEndsAt) return;
    const p = mySide === 'A' ? b.teamA[b.activeA] : b.teamB[b.activeB];
    if (['1', '2', '3', '4'].includes(e.key)) {
      const moveId = p.moves[Number(e.key) - 1];
      const curPp = p.ppMap && p.ppMap[moveId] !== undefined ? p.ppMap[moveId] : 1;
      if (moveId && curPp > 0 && !choiceBlocked(p, moveId)) {
        const moveObj = MOVES[moveId];
        sfx.play(moveObj && moveObj.cat === 'special' ? 'beam' : 'hit');
        submitAction({ type: 'move', moveId });
      }
    }
  }

  window.addEventListener('keydown', onKeyDown);

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('resize', setUiZoom);
    if (sceneObserver) sceneObserver.disconnect();
    clearInterval(tickTimer);
    animGen++;
  }

  return {
    update(s, off) {
      if (!s || !s.t) return;
      clockOff = off || 0;
      state = s;
      music(s);

      if (s.phase === 'battle') {
        if (lastPhase && lastPhase !== 'battle') showSplash(s);
        if (s.evSeq > lastEvSeq && s.events && s.events.length) evQueue.push(s);
        lastEvSeq = Math.max(lastEvSeq, s.evSeq || 0);
        headerTitle(s);
        if (!isResolvingTurn) {
          if (evQueue.length) playSequentialTurn(evQueue.shift());
          else renderBattle(s);
        }
      } else {
        if (lastPhase === 'battle') {
          // On quitte l'arène : on coupe une animation en cours et on remet l'arène à zéro
          animGen++;
          isResolvingTurn = false;
          evQueue.length = 0;
          displayedHp = { bottom: null, top: null };
          shownMon = { bottom: null, top: null };
          if (sceneObserver) { sceneObserver.disconnect(); sceneObserver = null; }
          activeTab = 'moves';
          logDrawer.hidden = true;
        }
        lastEvSeq = Math.max(lastEvSeq, s.evSeq || 0);
        renderPhase(s);
      }
      lastPhase = s.phase;
      renderTreeDrawer();
    },
    toast,
    cleanup
  };
}
