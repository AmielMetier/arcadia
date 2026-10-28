// pokemon/view/game.js
// Interface du tournoi Poké Duel : enchaîne les écrans (draft, tableau, aperçu, combat, résumé, podium)
// selon l'état diffusé par l'hôte. L'arène de combat (sprites Showdown animés, barres de PV progressives,
// paliers de stats, PP réels, journal, déroulement séquentiel des tours) vit ici ; les autres écrans dans screens.js.

import { spriteUrls, POKEBALL_SPRITE } from '../engine/data.js';
import { MOVES } from '../engine/moves.js';
import { STAGE_MULTS } from '../engine/battle.js';
import { TYPES, getEffectiveness, getShowdownTypeIcon, getCategoryIcon } from '../engine/types.js';
import { getParticipant, currentMatch, TEAM_SIZE } from '../engine/tournament.js';
import { sfx } from './sfx.js';
import { battleMusic } from './music.js';
import { renderDraft, renderBracket, renderPreview, renderSummary, renderPodium, bracketHtml, esc, trainerAvatar } from './screens.js';

const STATUS_LABELS = {
  burn: 'BRÛLURE',
  paralysis: 'PARALYSIE',
  poison: 'POISON',
  toxic: 'TOXIK',
  freeze: 'GEL',
  sleep: 'SOMMEIL'
};

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
        ${switchMode ? `<button class="poke-tool mode-switch-btn" id="btnSwitchAdv">MODE : <b>AVENTURE MENTON</b></button>` : ''}
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
  let hpAnimRaf = { bottom: null, top: null };
  let isResolvingTurn = false;
  let animGen = 0;          // change quand on quitte le combat : coupe une animation en cours
  const evQueue = [];       // tours reçus pendant qu'un autre se déroule à l'écran
  let lastEvSeq = 0;
  let clockOff = 0;         // décalage d'horloge avec l'hôte
  let lastPhase = null;
  const now = () => Date.now() + clockOff;

  // --- Outils & Audio : la musique et les effets se règlent dans le panneau Réglages (à 0 : coupés) ---
  DDVolume.panel($('#btnSet'), { accent: '#ffcb05' });
  $('#btnQuit').onclick = () => { battleMusic.stop(); cleanup(); exit(); };
  if ($('#btnSwitchAdv') && switchMode) {
    $('#btnSwitchAdv').onclick = () => {
      battleMusic.stop();
      cleanup();
      switchMode('adventure');
    };
  }

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
  const typeBadgesHtml = (types) => (types || []).map(t => `
    <span class="type-pill" style="background:${TYPES[t].color}" title="${TYPES[t].name}">
      <img class="type-pill-img" src="${getShowdownTypeIcon(t)}" alt="${TYPES[t].name}">
      <span class="type-pill-text">${TYPES[t].name.toUpperCase()}</span>
    </span>
  `).join('');

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


  // --- Animation progressive et fluide de la barre de PV ---
  function animateHp(side, fromHp, toHp, maxHp) {
    const isBottom = side === 'bottom';
    const fillEl = $(isBottom ? '#hpFillBottom' : '#hpFillTop');
    const numEl = $(isBottom ? '#hpNumBottom' : '#hpNumTop');
    const maxEl = isBottom ? $('#hpMaxBottom') : null;
    if (maxEl && maxHp) maxEl.textContent = `${maxHp}`;
    if (!fillEl) return;

    if (hpAnimRaf[side]) {
      cancelAnimationFrame(hpAnimRaf[side]);
      hpAnimRaf[side] = null;
    }

    const diff = toHp - fromHp;
    if (diff === 0) {
      const pct = Math.max(0, Math.min(100, Math.round((toHp / maxHp) * 100)));
      fillEl.style.width = `${pct}%`;
      const hpClass = pct > 50 ? 'hp-green' : pct > 20 ? 'hp-yellow' : 'hp-red';
      fillEl.className = `hp-fill ${hpClass} ${pct <= 20 ? 'critical' : ''}`;
      if (numEl) {
        numEl.textContent = `${toHp}`;
        numEl.className = hpClass;
      }
      displayedHp[side] = toHp;
      return;
    }

    const duration = Math.min(1100, Math.max(550, Math.abs(diff) * 11));
    const startTime = performance.now();

    function step(now) {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 2);
      const currHp = Math.round(fromHp + diff * eased);
      const pct = Math.max(0, Math.min(100, Math.round((currHp / maxHp) * 100)));

      fillEl.style.width = `${pct}%`;
      const hpClass = pct > 50 ? 'hp-green' : pct > 20 ? 'hp-yellow' : 'hp-red';
      fillEl.className = `hp-fill ${hpClass} ${pct <= 20 ? 'critical' : ''}`;

      if (numEl) {
        numEl.textContent = `${currHp}`;
        numEl.className = hpClass;
      }

      if (progress < 1) {
        hpAnimRaf[side] = requestAnimationFrame(step);
      } else {
        hpAnimRaf[side] = null;
        displayedHp[side] = toHp;
        if (pct <= 20 && pct > 0) {
          sfx.play('low_hp');
        }
      }
    }

    hpAnimRaf[side] = requestAnimationFrame(step);
  }

  // --- Déroulement séquentiel et authentique d'un tour de combat ---
  async function playSequentialTurn(s) {
    const b = s.battle;
    if (!b) return;
    if (!$('#arenaCard')) renderBattle(s);
    isResolvingTurn = true;
    const gen = animGen;
    const pause = async (ms) => { await sleep(ms); return gen !== animGen; };

    const mySide = String(b.trainerA.id) === String(me.id) ? 'A' : String(b.trainerB.id) === String(me.id) ? 'B' : null;
    const bottomSide = mySide === 'B' ? 'B' : 'A';
    const topSide = bottomSide === 'A' ? 'B' : 'A';

    const dash = $('#dashContainer');
    if (dash) {
      dash.innerHTML = `
        <div class="dash-resolving-view">
          <div class="dash-resolving-title">
            <span class="live-pill">DÉROULEMENT DU TOUR</span>
            <span id="liveTurnMainText">Préparation des actions...</span>
          </div>
          <div class="dash-resolving-steps" id="liveTurnSteps"></div>
        </div>`;
    }

    const setDialogue = (txt, tag = '') => {
      const dt = $('#dialogueText');
      if (dt) dt.textContent = txt;
      const mainEl = $('#liveTurnMainText');
      if (mainEl) mainEl.textContent = txt;
      const stepsEl = $('#liveTurnSteps');
      if (stepsEl && txt) {
        const line = document.createElement('div');
        line.className = `turn-step-item ${tag}`;
        line.textContent = `▸ ${txt}`;
        stepsEl.appendChild(line);
        stepsEl.scrollTop = stepsEl.scrollHeight;
      }
    };

    for (const ev of s.events) {
      if (ev.type === 'switch') {
        const isBottom = (ev.side === bottomSide);
        const sideKey = isBottom ? 'bottom' : 'top';
        setDialogue(ev.msg || `${ev.trainer} envoie ${ev.name} !`, 'step-switch');
        sfx.play('switch');
        if (ev.pokemonId) sfx.playCry(ev.pokemonId);

        const spriteEl = $(isBottom ? '#spriteBottom' : '#spriteTop');
        if (spriteEl) {
          spriteEl.src = isBottom ? spriteUrls(ev.pokemonId).back : spriteUrls(ev.pokemonId).front;
          spriteEl.className = `poke-sprite ${isBottom ? 'back' : 'front'} anim-enter`;
        }
        const nameEl = $(isBottom ? '#nameBottom' : '#nameTop');
        if (nameEl) nameEl.textContent = ev.name.toUpperCase();

        if (ev.types) {
          const typesEl = $(isBottom ? '#typesBottom' : '#typesTop');
          if (typesEl) typesEl.innerHTML = typeBadgesHtml(ev.types);
        }
        const stEl = $(isBottom ? '#statusBottom' : '#statusTop');
        if (stEl) {
          stEl.innerHTML = ev.status ? `<span class="status-badge status-${ev.status}">${STATUS_LABELS[ev.status] || ev.status.toUpperCase()}</span>` : '';
        }
        const stgEl = $(isBottom ? '#stagesBottom' : '#stagesTop');
        if (stgEl) stgEl.innerHTML = '';

        if (ev.hp !== undefined && ev.maxHp !== undefined) {
          displayedHp[sideKey] = ev.hp;
          animateHp(sideKey, ev.hp, ev.hp, ev.maxHp);
        }

        if (await pause(1500)) return;

      } else if (ev.type === 'attack_start') {
        const isBottom = (ev.side === bottomSide);
        setDialogue(ev.msg || `${ev.attName || ''} utilise ${ev.moveName} !`, 'step-attack');

        const move = Object.values(MOVES).find(m => m.name === ev.moveName);
        if (move && move.cat === 'special') sfx.play('beam');
        else sfx.play('hit');

        const spriteEl = $(isBottom ? '#spriteBottom' : '#spriteTop');
        if (spriteEl) {
          const animClass = isBottom ? 'anim-lunge-player' : 'anim-lunge-opponent';
          spriteEl.classList.remove(animClass);
          void spriteEl.offsetWidth;
          spriteEl.classList.add(animClass);
        }
        if (await pause(1400)) return;

      } else if (ev.type === 'damage') {
        const targetIsBottom = (ev.defSide === bottomSide);
        const spriteEl = $(targetIsBottom ? '#spriteBottom' : '#spriteTop');
        if (spriteEl) {
          spriteEl.classList.remove('anim-hit');
          void spriteEl.offsetWidth;
          spriteEl.classList.add('anim-hit');
        }

        sfx.playHit(ev.mult || 1);
        showDamagePopup(targetIsBottom ? 'bottom' : 'top', ev.damage, ev.crit);

        let effText = '';
        if (ev.msg) {
          effText = ev.msg;
        } else if (ev.crit && ev.mult > 1) {
          effText = "Coup critique ! C'est super efficace !";
        } else if (ev.crit) {
          effText = 'Coup critique !';
        } else if (ev.mult > 1) {
          effText = "C'est super efficace !";
        } else if (ev.mult > 0 && ev.mult < 1) {
          effText = "Ce n'est pas très efficace...";
        }

        const defLabel = ev.defName || (targetIsBottom ? ($('#nameBottom')?.textContent || 'Votre Pokémon') : ($('#nameTop')?.textContent || 'Le Pokémon adverse'));
        const dmgLine = `${defLabel} perd ${ev.damage} PV !${effText ? ' ' + effText : ''}`;
        setDialogue(dmgLine, ev.mult >= 2 ? 'step-super' : 'step-damage');

        const sideKey = targetIsBottom ? 'bottom' : 'top';
        const oldHp = displayedHp[sideKey] !== null ? displayedHp[sideKey] : (ev.defHp + ev.damage);
        animateHp(sideKey, oldHp, ev.defHp, ev.defMaxHp);
        displayedHp[sideKey] = ev.defHp;

        if (await pause(1550)) return;

      } else if (ev.type === 'faint') {
        const isBottom = (ev.side === bottomSide);
        setDialogue(ev.msg || `${ev.name} est K.O. !`, 'step-faint');
        sfx.play('faint');

        const spriteEl = $(isBottom ? '#spriteBottom' : '#spriteTop');
        if (spriteEl) {
          spriteEl.classList.remove('anim-hit', 'anim-lunge-player', 'anim-lunge-opponent');
          spriteEl.classList.add('anim-faint');
        }

        const ballsEl = $(isBottom ? '#ballsBottom' : '#ballsTop');
        const team = isBottom ? (bottomSide === 'A' ? b.teamA : b.teamB) : (topSide === 'A' ? b.teamA : b.teamB);
        if (ballsEl) ballsEl.innerHTML = ballsHtml(team);

        if (await pause(1500)) return;

      } else if (ev.type === 'status_damage') {
        const isBottom = (ev.side === bottomSide);
        setDialogue(ev.msg, 'step-damage');
        const spriteEl = $(isBottom ? '#spriteBottom' : '#spriteTop');
        if (spriteEl) {
          spriteEl.classList.remove('anim-hit');
          void spriteEl.offsetWidth;
          spriteEl.classList.add('anim-hit');
        }
        const sideKey = isBottom ? 'bottom' : 'top';
        const oldHp = displayedHp[sideKey] !== null ? displayedHp[sideKey] : (ev.hp + ev.damage);
        animateHp(sideKey, oldHp, ev.hp, ev.maxHp);
        displayedHp[sideKey] = ev.hp;
        if (await pause(1350)) return;

      } else if (ev.type === 'heal' || ev.type === 'recoil') {
        const isBottom = (ev.side === bottomSide);
        setDialogue(ev.msg, 'step-status');
        const sideKey = isBottom ? 'bottom' : 'top';
        const oldHp = displayedHp[sideKey] !== null ? displayedHp[sideKey] : ev.hp;
        animateHp(sideKey, oldHp, ev.hp, ev.maxHp);
        displayedHp[sideKey] = ev.hp;
        if (await pause(1300)) return;

      } else if (ev.type === 'stat_change' || ev.type === 'status_applied' || ev.type === 'status_cured' || ev.type === 'msg') {
        setDialogue(ev.msg || ev.text, 'step-status');
        if (ev.type === 'status_applied') {
          const isBottom = (ev.side === bottomSide);
          const stEl = $(isBottom ? '#statusBottom' : '#statusTop');
          if (stEl) {
            stEl.innerHTML = `<span class="status-badge status-${ev.status}">${STATUS_LABELS[ev.status] || ev.status.toUpperCase()}</span>`;
          }
        } else if (ev.type === 'status_cured') {
          const isBottom = (ev.side === bottomSide);
          const stEl = $(isBottom ? '#statusBottom' : '#statusTop');
          if (stEl) stEl.innerHTML = '';
        }
        if (await pause(1300)) return;

      } else if (ev.type === 'victory') {
        setDialogue(ev.msg, 'step-victory');
        sfx.play('victory');
        if (await pause(1600)) return;
      }
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

      stage.innerHTML = `
        <div class="arena-card deal ${s.isFinal ? 'final' : ''}" id="arenaCard">
          <div class="battlefield">
            <!-- HUD Adversaire (Haut-Gauche) -->
            <div class="hud-zone hud-top">
              <div class="status-card opponent-card">
                <div class="sc-head">
                  <div class="sc-name-row">
                    <b class="sc-name" id="nameTop">${pTop.name.toUpperCase()}</b>
                    <span class="sc-lvl">NV. ${pTop.level || 50}</span>
                  </div>
                  <div class="sc-types" id="typesTop">${typeBadgesHtml(pTop.types)}</div>
                  <span id="statusTop">${pTop.status ? `<span class="status-badge status-${pTop.status}">${STATUS_LABELS[pTop.status] || pTop.status.toUpperCase()}</span>` : ''}</span>
                  <div class="sc-stages" id="stagesTop">${statStagesHtml(pTop.statStages)}</div>
                </div>

                <div class="hp-gauge-row">
                  <span class="hp-tag">PV</span>
                  <div class="hp-track">
                    <div class="hp-fill ${hpClassTop} ${hpPctTop <= 20 ? 'critical' : ''}" id="hpFillTop" style="width:${hpPctTop}%"></div>
                    <div class="hp-gloss"></div>
                  </div>
                </div>

                <div class="sc-foot">
                  <span class="trainer-badge" style="--tc:${tTop.color}">
                    <i class="trainer-dot"></i>${esc(tTop.name.toUpperCase())}
                  </span>
                  <div id="ballsTop">${ballsHtml(teamTop)}</div>
                </div>
              </div>
            </div>

            <!-- Zone Combat Adversaire (Haut-Droite) -->
            <div class="fighter-zone fighter-top">
              <div class="platform platform-top">
                <img src="assets/plat_stone_enemy.png" class="plat-img" alt="">
                <img class="poke-sprite front ${pTop.fainted ? 'fainted' : ''}" id="spriteTop" src="${spriteUrls(pTop.id).front}" alt="${pTop.name}">
                <div class="damage-popup-anchor" id="popupAnchorTop"></div>
              </div>
            </div>

            <!-- Zone Combat Joueur (Bas-Gauche) -->
            <div class="fighter-zone fighter-bottom">
              <div class="platform platform-bottom">
                <img src="assets/plat_stone_enemy.png" class="plat-img" alt="">
                <img class="poke-sprite back ${pBottom.fainted ? 'fainted' : ''}" id="spriteBottom" src="${spriteUrls(pBottom.id).back}" alt="${pBottom.name}">
                <div class="damage-popup-anchor" id="popupAnchorBottom"></div>
              </div>
            </div>

            <!-- HUD Joueur (Bas-Droite) -->
            <div class="hud-zone hud-bottom">
              <div class="status-card player-card">
                <div class="sc-head">
                  <div class="sc-name-row">
                    <b class="sc-name" id="nameBottom">${pBottom.name.toUpperCase()}</b>
                    <span class="sc-lvl">NV. ${pBottom.level || 50}</span>
                  </div>
                  <div class="sc-types" id="typesBottom">${typeBadgesHtml(pBottom.types)}</div>
                  <span id="statusBottom">${pBottom.status ? `<span class="status-badge status-${pBottom.status}">${STATUS_LABELS[pBottom.status] || pBottom.status.toUpperCase()}</span>` : ''}</span>
                  <div class="sc-stages" id="stagesBottom">${statStagesHtml(pBottom.statStages)}</div>
                </div>

                <div class="hp-gauge-row">
                  <span class="hp-tag">PV</span>
                  <div class="hp-track">
                    <div class="hp-fill ${hpClassBottom} ${hpPctBottom <= 20 ? 'critical' : ''}" id="hpFillBottom" style="width:${hpPctBottom}%"></div>
                    <div class="hp-gloss"></div>
                  </div>
                </div>

                <div class="sc-foot">
                  <span class="hp-fraction"><b id="hpNumBottom" class="${hpClassBottom}">${pBottom.hp}</b> / <span id="hpMaxBottom">${pBottom.maxHp}</span> PV</span>
                  <div id="ballsBottom">${ballsHtml(teamBottom)}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bandeau de Dialogue Showdown -->
          <div class="battle-dialogue-bar">
            <span class="dialogue-tag" id="turnTag">TOUR ${b.turn || 1}</span>
            <span class="dialogue-text" id="dialogueText">${announcement}</span>
          </div>

          <!-- Pupitre de Commandes Tactiles Professionnel -->
          <div class="dashboard" id="dashContainer"></div>
        </div>`;
    } else {
      $('#nameTop').textContent = pTop.name.toUpperCase();
      $('#typesTop').innerHTML = typeBadgesHtml(pTop.types);
      $('#statusTop').innerHTML = pTop.status ? `<span class="status-badge status-${pTop.status}">${STATUS_LABELS[pTop.status] || pTop.status.toUpperCase()}</span>` : '';
      if ($('#stagesTop')) $('#stagesTop').innerHTML = statStagesHtml(pTop.statStages);
      $('#ballsTop').innerHTML = ballsHtml(teamTop);

      $('#nameBottom').textContent = pBottom.name.toUpperCase();
      $('#typesBottom').innerHTML = typeBadgesHtml(pBottom.types);
      $('#statusBottom').innerHTML = pBottom.status ? `<span class="status-badge status-${pBottom.status}">${STATUS_LABELS[pBottom.status] || pBottom.status.toUpperCase()}</span>` : '';
      if ($('#stagesBottom')) $('#stagesBottom').innerHTML = statStagesHtml(pBottom.statStages);
      $('#ballsBottom').innerHTML = ballsHtml(teamBottom);

      if ($('#turnTag')) $('#turnTag').textContent = `TOUR ${b.turn || 1}`;
      if ($('#hpMaxBottom')) $('#hpMaxBottom').textContent = `${pBottom.maxHp}`;
      $('#dialogueText').textContent = announcement;

      const sTop = $('#spriteTop');
      const topChanged = sTop && !sTop.src.includes(`/${pTop.id}.gif`);
      if (topChanged) {
        sTop.src = spriteUrls(pTop.id).front;
        sTop.className = `poke-sprite front ${pTop.fainted ? 'fainted' : 'anim-enter'}`;
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
        sBottom.className = `poke-sprite back ${pBottom.fainted ? 'fainted' : 'anim-enter'}`;
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
      dash.innerHTML = isSpectator ? `
        <div class="spectator-bar">
          <span class="live-pill">DIRECT</span>
          <span>MATCH EN COURS : <b>${esc(tBottom.name.toUpperCase())}</b> CONTRE <b>${esc(tTop.name.toUpperCase())}</b></span>
        </div>
      ` : `
        <div class="dash-top-row">
          <div class="dash-timer">
            <div class="dt-fill" id="timerFill" style="width:${timerWidth}%"></div>
            <span class="dt-text" id="timerText">${leftSec}</span>
          </div>
          ${isSubmitted ? '<span class="action-locked"><span class="lock-indicator"></span> ORDRE ENREGISTRÉ · EN ATTENTE</span>' : ''}
        </div>

        <div class="dash-tabs">
          <button class="dash-tab ${activeTab === 'moves' ? 'active' : ''}" id="tabMoves" ${isForcedSwitch ? 'disabled' : ''}>
            ATTAQUE
          </button>
          <button class="dash-tab ${activeTab === 'switch' ? 'active' : ''}" id="tabSwitch">
            ÉQUIPE (${teamBottom.filter(p => !p.fainted).length}/3)
          </button>
        </div>

        ${activeTab === 'moves' && !isForcedSwitch ? `
          <div class="moves-grid">
            ${pBottom.moves.map((moveId, mIdx) => {
              const m = MOVES[moveId];
              if (!m) return '';
              const maxPp = m.pp || 15;
              const curPp = pBottom.ppMap && pBottom.ppMap[moveId] !== undefined ? pBottom.ppMap[moveId] : maxPp;
              const eff = getEffectiveness(m.type, pTop.types);
              let matchupClass = '';
              let matchupLabel = '';
              let multiplierLabel = '';

              if (m.power > 0) {
                if (eff >= 2) {
                  matchupClass = 'eff-super';
                  matchupLabel = 'SUPER EFFICACE';
                  multiplierLabel = `×${eff}`;
                } else if (eff <= 0.5 && eff > 0) {
                  matchupClass = 'eff-low';
                  matchupLabel = 'PEU EFFICACE';
                  multiplierLabel = `×${eff}`;
                } else if (eff === 0) {
                  matchupClass = 'eff-zero';
                  matchupLabel = 'AUCUN EFFET';
                  multiplierLabel = '×0';
                } else {
                  matchupClass = 'eff-normal';
                  matchupLabel = 'EFFICACITÉ STANDARD';
                  multiplierLabel = '×1';
                }
              } else {
                matchupClass = 'eff-status';
                matchupLabel = 'CAPACITÉ DE STATUT';
                multiplierLabel = 'TACTIQUE';
              }

              return `
                <button class="pro-move-card" data-move="${moveId}" style="--mc:${TYPES[m.type].color};--mc-bg:${TYPES[m.type].bg}" ${isSubmitted || curPp <= 0 ? 'disabled' : ''}>
                  <div class="pm-top">
                    <span class="pm-key">${mIdx + 1}</span>
                    <span class="pm-name">${m.name}</span>
                    <img src="${getCategoryIcon(m.cat)}" class="pm-cat-img" alt="${m.cat}" title="${m.cat.toUpperCase()}">
                  </div>
                  <div class="pm-mid">
                    <img class="pm-type-img" src="${getShowdownTypeIcon(m.type)}" alt="${TYPES[m.type].name}">
                    <div class="pm-stats-group">
                      <div class="pm-stat-chip">
                        <span class="pm-stat-label">PUISS</span>
                        <span class="pm-stat-val">${m.power ? m.power : '—'}</span>
                      </div>
                      <div class="pm-stat-chip">
                        <span class="pm-stat-label">PRÉC</span>
                        <span class="pm-stat-val">${m.acc}%</span>
                      </div>
                      <div class="pm-stat-chip">
                        <span class="pm-stat-label">PP</span>
                        <span class="pm-stat-val">${curPp} / ${maxPp}</span>
                      </div>
                    </div>
                  </div>
                  <div class="pm-matchup ${matchupClass}">
                    <span class="pm-matchup-label">${matchupLabel}</span>
                    <span class="pm-matchup-factor">${multiplierLabel}</span>
                  </div>
                </button>`;
            }).join('')}
          </div>
        ` : `
          <div class="switch-grid">
            ${teamBottom.map((p, pIdx) => {
              const isCurrent = pIdx === (bottomSide === 'A' ? b.activeA : b.activeB);
              const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
              const hpCol = hpPct > 50 ? '#22c55e' : hpPct > 20 ? '#eab308' : '#ef4444';
              return `
                <button class="btn-switch ${isCurrent ? 'current' : ''} ${p.fainted ? 'fainted' : ''}" data-switch="${pIdx}" ${isCurrent || p.fainted || isSubmitted ? 'disabled' : ''}>
                  <div class="bs-avatar">
                    <img src="${spriteUrls(p.id).icon}" alt="${p.name}" class="bs-icon">
                    ${isCurrent ? '<span class="bs-tag-current">ACTIF</span>' : ''}
                    ${p.fainted ? '<span class="bs-tag-ko">K.O.</span>' : ''}
                  </div>
                  <div class="bs-details">
                    <div class="bs-title-row">
                      <b>${p.name.toUpperCase()}</b>
                      <span class="bs-lvl">NV. ${p.level || 50}</span>
                    </div>
                    <div class="bs-types">
                      ${p.types.map(t => `<img src="${getShowdownTypeIcon(t)}" alt="${TYPES[t].name}" class="bs-type-icon">`).join('')}
                    </div>
                    <div class="bs-hp-track">
                      <div class="bs-hp-fill" style="width:${hpPct}%;background:${hpCol}"></div>
                    </div>
                    <div class="bs-hp-num">${p.fainted ? 'HORS COMBAT' : `${p.hp} / ${p.maxHp} PV`}</div>
                  </div>
                </button>`;
            }).join('')}
          </div>
        `}`;

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

  const local = { draft: [], draftKey: null, lead: null, leadKey: null };
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
    submitDraft() {
      if (local.draft.length !== TEAM_SIZE) return;
      sfx.play('levelup');
      draft([...local.draft]);
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
    if (b.phase !== 'choose') return;
    const p = mySide === 'A' ? b.teamA[b.activeA] : b.teamB[b.activeB];
    if (['1', '2', '3', '4'].includes(e.key)) {
      const moveId = p.moves[Number(e.key) - 1];
      const curPp = p.ppMap && p.ppMap[moveId] !== undefined ? p.ppMap[moveId] : 1;
      if (moveId && curPp > 0) {
        const moveObj = MOVES[moveId];
        sfx.play(moveObj && moveObj.cat === 'special' ? 'beam' : 'hit');
        submitAction({ type: 'move', moveId });
      }
    }
  }

  window.addEventListener('keydown', onKeyDown);

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown);
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
