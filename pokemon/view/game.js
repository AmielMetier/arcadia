// pokemon/view/game.js
// Interface visuelle de Poké Duel : Arbre de tournoi, arène Showdown avec assets officiels Gen 5 animés,
// barres de PV progressives, paliers de stats en direct, PP réels, journal de combat et déroulement séquentiel.

import { spriteUrls, POKEBALL_SPRITE } from '../engine/data.js';
import { MOVES } from '../engine/moves.js';
import { STAGE_MULTS } from '../engine/battle.js';
import { TYPES, getEffectiveness, getShowdownTypeIcon, getCategoryIcon } from '../engine/types.js';
import { sfx } from './sfx.js';
import { battleMusic } from './music.js';

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

export function mountGame(root, { me, startMatch, restart, submitAction, switchMode, exit }) {
  root.className = 'poke-root';
  root.innerHTML = `
    <header class="poke-topbar">
      <div class="poke-brand">
        <span class="poke-badge">3v3</span>
        <b>POKÉ DUEL</b>
        <span id="pokeRoundTitle">Tournoi</span>
      </div>
      <div class="poke-tools">
        ${switchMode ? `<button class="poke-tool mode-switch-btn" id="btnSwitchAdv">MODE : <b>AVENTURE MENTON</b></button>` : ''}
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
    <div class="poke-toast" id="pokeToast" hidden></div>`;

  const $ = (s) => root.querySelector(s);
  const stage = $('#pokeStage');

  let state = null;
  let activeTab = 'moves'; // 'moves' | 'switch'
  let displayedHp = { bottom: null, top: null };
  let hpAnimRaf = { bottom: null, top: null };
  let isResolvingTurn = false;
  let queuedState = null;

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
    renderLogHistory();
  };
  $('#btnCloseLog').onclick = () => { logDrawer.hidden = true; };

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
        <span class="pld-txt">${item.text}</span>
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

  // --- Rendu du Bracket / Aperçu du Tournoi ---
  function renderBracket(s) {
    battleMusic.stop();
    displayedHp = { bottom: null, top: null };
    const round = s.rounds[s.currentRoundIdx];
    const match = round ? round[s.currentMatchIdx] : null;
    const roundTitle = match ? match.roundName : 'Arbre du Tournoi';
    $('#pokeRoundTitle').textContent = roundTitle;

    const matchCardHtml = match ? `
      <div class="match-card deal">
        <div class="match-badge">${match.roundName.toUpperCase()} · MATCH ${s.currentMatchIdx + 1}/${round.length}</div>
        <div class="versus-row">
          <div class="fighter-card ${String(match.playerA.id) === String(me.id) ? 'me' : ''}" style="--c:${match.playerA.color}">
            <div class="trainer-header">
              <i class="dot"></i>
              <b>${match.playerA.name.toUpperCase()}</b>
              ${match.playerA.bot ? '<span class="tag-bot">BOT</span>' : '<span class="tag-human">JOUEUR</span>'}
            </div>
            <div class="team-preview">
              ${match.playerA.team.map(p => `
                <div class="preview-slot" title="${p.name} (${p.types.map(t => TYPES[t].name).join('/')})">
                  <img class="preview-poke-icon" src="${spriteUrls(p.id).icon}" alt="${p.name}" loading="lazy">
                  <span class="preview-poke-name">${p.name.toUpperCase()}</span>
                  <div class="preview-types">
                    ${p.types.map(t => `
                      <span class="preview-type-chip" style="background:${TYPES[t].color}" title="${TYPES[t].name}">
                        <img class="preview-type-chip-img" src="${getShowdownTypeIcon(t)}" alt="${TYPES[t].name}">
                        <span>${TYPES[t].name.slice(0, 4).toUpperCase()}</span>
                      </span>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="versus-sep">VS</div>

          <div class="fighter-card ${String(match.playerB.id) === String(me.id) ? 'me' : ''}" style="--c:${match.playerB.color}">
            <div class="trainer-header">
              <i class="dot"></i>
              <b>${match.playerB.name.toUpperCase()}</b>
              ${match.playerB.bot ? '<span class="tag-bot">BOT</span>' : '<span class="tag-human">JOUEUR</span>'}
            </div>
            <div class="team-preview">
              ${match.playerB.team.map(p => `
                <div class="preview-slot" title="${p.name} (${p.types.map(t => TYPES[t].name).join('/')})">
                  <img class="preview-poke-icon" src="${spriteUrls(p.id).icon}" alt="${p.name}" loading="lazy">
                  <span class="preview-poke-name">${p.name.toUpperCase()}</span>
                  <div class="preview-types">
                    ${p.types.map(t => `
                      <span class="preview-type-chip" style="background:${TYPES[t].color}" title="${TYPES[t].name}">
                        <img class="preview-type-chip-img" src="${getShowdownTypeIcon(t)}" alt="${TYPES[t].name}">
                        <span>${TYPES[t].name.slice(0, 4).toUpperCase()}</span>
                      </span>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="match-action-row">
          <button class="btn big yellow btn-start-match" id="btnStartFight">LANCER LE COMBAT</button>
        </div>
      </div>` : '';

    stage.innerHTML = `
      <div class="bracket-screen">
        <h2 class="bracket-title">CHAMPIONNAT POKÉMON · TOURNOI 3v3</h2>
        <div class="bracket-tree">
          ${s.rounds.map((r, rIdx) => `
            <div class="bracket-round">
              <div class="round-header">${r[0] ? r[0].roundName.toUpperCase() : `TOUR ${rIdx + 1}`}</div>
              <div class="round-matches">
                ${r.map((m, mIdx) => {
                  const isCurrent = rIdx === s.currentRoundIdx && mIdx === s.currentMatchIdx;
                  return `
                    <div class="tree-match ${isCurrent ? 'current' : ''} ${m.status}">
                      <div class="tree-trainer ${m.winner && m.playerA && String(m.winner.id) === String(m.playerA.id) ? 'win' : ''}">
                        <span class="tree-name">${m.playerA ? m.playerA.name.toUpperCase() : '—'}</span>
                      </div>
                      <div class="tree-trainer ${m.winner && m.playerB && String(m.winner.id) === String(m.playerB.id) ? 'win' : ''}">
                        <span class="tree-name">${m.playerB ? m.playerB.name.toUpperCase() : '—'}</span>
                      </div>
                    </div>`;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        ${matchCardHtml}
      </div>`;

    const bStart = $('#btnStartFight');
    if (bStart) {
      bStart.onclick = () => {
        sfx.play('hit');
        startMatch();
      };
    }
  }

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
    isResolvingTurn = true;
    const b = s.battle;
    if (!b) {
      isResolvingTurn = false;
      return;
    }

    if (!$('#arenaCard')) {
      renderBattle(s);
    }

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

        await sleep(1500);

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
        await sleep(1400);

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

        await sleep(1550);

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

        await sleep(1500);

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
        await sleep(1350);

      } else if (ev.type === 'heal' || ev.type === 'recoil') {
        const isBottom = (ev.side === bottomSide);
        setDialogue(ev.msg, 'step-status');
        const sideKey = isBottom ? 'bottom' : 'top';
        const oldHp = displayedHp[sideKey] !== null ? displayedHp[sideKey] : ev.hp;
        animateHp(sideKey, oldHp, ev.hp, ev.maxHp);
        displayedHp[sideKey] = ev.hp;
        await sleep(1300);

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
        await sleep(1300);

      } else if (ev.type === 'victory') {
        setDialogue(ev.msg, 'step-victory');
        sfx.play('victory');
        await sleep(1600);
      }
    }

    isResolvingTurn = false;
    const nextQueued = queuedState;
    queuedState = null;
    if (nextQueued && nextQueued.events && nextQueued.events.length > 0) {
      playSequentialTurn(nextQueued);
      return;
    }
    const targetState = nextQueued || s;
    renderBattle(targetState);
    if (!logDrawer.hidden) renderLogHistory();
  }

  // --- Rendu du Combat (Arène Showdown avec Assets Authentiques Gen 5) ---
  function renderBattle(s) {
    const b = s.battle;
    if (!b) return;

    if (isResolvingTurn) return;

    const isFinalRound = s.rounds && s.currentRoundIdx === s.rounds.length - 1;
    const expectedTrack = isFinalRound ? 'cynthia' : 'sandstorm';
    if (!battleMusic.isPlaying() && battleMusic.musicEnabled) {
      battleMusic.start(expectedTrack);
    }

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

    const leftMs = Math.max(0, s.turnEndsAt - Date.now());
    const leftSec = Math.ceil(leftMs / 1000);
    const timerWidth = Math.max(0, Math.min(100, (leftMs / (s.timerSecs * 1000)) * 100));

    const existingArena = $('#arenaCard');
    if (!existingArena) {
      displayedHp.bottom = pBottom.hp;
      displayedHp.top = pTop.hp;

      stage.innerHTML = `
        <div class="arena-card deal" id="arenaCard">
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
                    <i class="trainer-dot"></i>${tTop.name.toUpperCase()}
                  </span>
                  <div id="ballsTop">${ballsHtml(teamTop)}</div>
                </div>
              </div>
            </div>

            <!-- Zone Combat Adversaire (Haut-Droite) -->
            <div class="fighter-zone fighter-top">
              <div class="platform platform-top">
                <img src="assets/plat_grass_enemy.png" class="plat-img" alt="platform">
                <img class="poke-sprite front ${pTop.fainted ? 'fainted' : ''}" id="spriteTop" src="${spriteUrls(pTop.id).front}" alt="${pTop.name}">
                <div class="damage-popup-anchor" id="popupAnchorTop"></div>
              </div>
            </div>

            <!-- Zone Combat Joueur (Bas-Gauche) -->
            <div class="fighter-zone fighter-bottom">
              <div class="platform platform-bottom">
                <img src="assets/plat_grass_enemy.png" class="plat-img" alt="platform">
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
          <span>MATCH EN COURS : <b>${tBottom.name.toUpperCase()}</b> CONTRE <b>${tTop.name.toUpperCase()}</b></span>
        </div>
      ` : `
        <div class="dash-top-row">
          <div class="dash-timer">
            <div class="dt-fill" id="timerFill" style="width:${timerWidth}%"></div>
            <span class="dt-text" id="timerText">${leftSec} s</span>
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

  // --- Rendu du Podium Final ---
  function renderPodium(s) {
    battleMusic.stop();
    sfx.play('victory');
    const champ = s.champion;

    stage.innerHTML = `
      <div class="podium-screen deal">
        <h1 class="podium-title">VAINQUEUR DE LA LIGUE POKÉMON</h1>
        <div class="champ-banner" style="--cc:${champ.color}">
          <div class="champ-crown-tag">MAÎTRE DU TOURNOI</div>
          <h2>${champ.name.toUpperCase()}</h2>
          <p>Champion Officiel de la Ligue Pokémon 3v3</p>
          <div class="champ-team">
            ${champ.team.map(p => `
              <div class="champ-poke-card">
                <img src="${spriteUrls(p.id).artwork}" alt="${p.name}">
                <b>${p.name.toUpperCase()}</b>
                <div class="champ-types">
                  ${p.types.map(t => `
                    <span class="preview-type-chip" style="background:${TYPES[t].color}">
                      <img class="preview-type-chip-img" src="${getShowdownTypeIcon(t)}" alt="${t}">
                      <span>${TYPES[t].name.toUpperCase()}</span>
                    </span>
                  `).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="podium-actions">
          <button class="btn big yellow" id="btnPlayAgain">NOUVEAU TOURNOI</button>
          <button class="btn big ghost" id="btnBackLobby">RETOUR AU SALON</button>
        </div>
      </div>`;

    $('#btnPlayAgain').onclick = () => restart();
    $('#btnBackLobby').onclick = () => { cleanup(); exit(); };
  }

  function onKeyDown(e) {
    if (isResolvingTurn) return;
    if (!state || state.phase !== 'battle' || !state.battle) return;
    const b = state.battle;
    const mySide = String(b.trainerA.id) === String(me.id) ? 'A' : String(b.trainerB.id) === String(me.id) ? 'B' : null;
    if (!mySide) return;

    const isSubmitted = mySide === 'A' ? state.submittedA : state.submittedB;
    if (isSubmitted) return;

    const p = mySide === 'A' ? b.teamA[b.activeA] : b.teamB[b.activeB];
    if (['1', '2', '3', '4'].includes(e.key)) {
      const idx = Number(e.key) - 1;
      if (p.moves[idx]) {
        const moveObj = MOVES[p.moves[idx]];
        if (moveObj && moveObj.cat === 'special') sfx.play('beam');
        else sfx.play('hit');
        submitAction({ type: 'move', moveId: p.moves[idx] });
      }
    }
  }

  window.addEventListener('keydown', onKeyDown);

  function cleanup() {
    window.removeEventListener('keydown', onKeyDown);
  }

  return {
    update(s, off) {
      state = s;
      if (s.phase === 'bracket_preview') {
        isResolvingTurn = false;
        renderBracket(s);
      } else if (s.phase === 'battle') {
        if (s.events && s.events.length > 0 && !isResolvingTurn) {
          playSequentialTurn(s);
        } else if (isResolvingTurn) {
          queuedState = s;
        } else {
          renderBattle(s);
        }
      } else if (s.phase === 'podium') {
        isResolvingTurn = false;
        renderPodium(s);
      }
    },
    toast,
    cleanup
  };
}
