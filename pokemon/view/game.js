// pokemon/view/game.js
// Interface visuelle de Poké Duel : Arbre de tournoi, arène de combat Showdown, barres de PV, attaques et switchs.

import { spriteUrls } from '../engine/data.js';
import { MOVES } from '../engine/moves.js';
import { TYPES, getEffectiveness } from '../engine/types.js';
import { sfx } from './sfx.js';
import { battleMusic } from './music.js';

export function mountGame(root, { me, startMatch, restart, submitAction, exit }) {
  root.className = 'poke-root';
  root.innerHTML = `
    <header class="poke-topbar">
      <div class="poke-brand">
        <span class="poke-badge">3v3</span>
        <b>POKÉ DUEL</b>
        <span id="pokeRoundTitle">Tournoi</span>
      </div>
      <div class="poke-tools">
        <button class="poke-tool" id="btnMus" title="Musique de combat">🎵</button>
        <button class="poke-tool" id="btnSnd" title="Bruitages">🔊</button>
        <button class="poke-tool quit" id="btnQuit">Quitter</button>
      </div>
    </header>
    <main class="poke-stage" id="pokeStage"></main>
    <div class="poke-toast" id="pokeToast" hidden></div>`;

  const $ = (s) => root.querySelector(s);
  const stage = $('#pokeStage');

  let state = null;
  let activeTab = 'moves'; // 'moves' | 'switch'
  let localActionSent = false;
  let lastPhase = '';
  let lastEventsLogged = new Set();

  // --- Sons & Outils ---
  const syncTools = () => {
    $('#btnSnd').textContent = sfx.enabled ? '🔊' : '🔇';
    $('#btnSnd').classList.toggle('off', !sfx.enabled);
    $('#btnMus').textContent = battleMusic.on ? '🎵' : '🔇';
    $('#btnMus').classList.toggle('off', !battleMusic.on);
  };
  syncTools();

  $('#btnSnd').onclick = () => { sfx.toggle(); syncTools(); };
  $('#btnMus').onclick = () => { battleMusic.toggle(); syncTools(); };
  $('#btnQuit').onclick = () => { battleMusic.stop(); exit(); };

  function toast(msg, ms = 2400) {
    const t = $('#pokeToast');
    if (!t) return;
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => { t.hidden = true; }, ms);
  }

  // --- Rendu du Bracket / Aperçu du Tournoi ---
  function renderBracket(s) {
    battleMusic.stop();
    const round = s.rounds[s.currentRoundIdx];
    const match = round ? round[s.currentMatchIdx] : null;
    const isHost = me.id === 0 || me.id === 1 || me.id === s.participants[0].id; // hôte
    const roundTitle = match ? match.roundName : 'Arbre du Tournoi';
    $('#pokeRoundTitle').textContent = roundTitle;

    const matchCardHtml = match ? `
      <div class="match-card deal">
        <div class="match-badge">${match.roundName} · Match ${s.currentMatchIdx + 1}/${round.length}</div>
        <div class="versus-row">
          <div class="fighter-card ${match.playerA.id === me.id ? 'me' : ''}" style="--c:${match.playerA.color}">
            <div class="trainer-header">
              <i class="dot"></i>
              <b>${match.playerA.name}</b>
              ${match.playerA.bot ? '<span class="tag-bot">BOT</span>' : ''}
            </div>
            <div class="team-preview">
              ${match.playerA.team.map(p => `
                <div class="preview-slot" title="${p.name} (${p.types.map(t => TYPES[t].name).join('/')})">
                  <img src="${spriteUrls(p.id).icon}" alt="${p.name}" loading="lazy">
                  <small>${p.name}</small>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="versus-sep">VS</div>

          <div class="fighter-card ${match.playerB.id === me.id ? 'me' : ''}" style="--c:${match.playerB.color}">
            <div class="trainer-header">
              <i class="dot"></i>
              <b>${match.playerB.name}</b>
              ${match.playerB.bot ? '<span class="tag-bot">BOT</span>' : ''}
            </div>
            <div class="team-preview">
              ${match.playerB.team.map(p => `
                <div class="preview-slot" title="${p.name} (${p.types.map(t => TYPES[t].name).join('/')})">
                  <img src="${spriteUrls(p.id).icon}" alt="${p.name}" loading="lazy">
                  <small>${p.name}</small>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="match-action-row">
          <button class="btn big yellow btn-start-match" id="btnStartFight">Entrer dans l'Arène ⚔️</button>
        </div>
      </div>` : '';

    stage.innerHTML = `
      <div class="bracket-screen">
        <h2 class="bracket-title">🏆 GRAND TOURNOI POKÉMON</h2>
        <div class="bracket-tree">
          ${s.rounds.map((r, rIdx) => `
            <div class="bracket-round">
              <div class="round-header">${r[0] ? r[0].roundName : `Tour ${rIdx + 1}`}</div>
              <div class="round-matches">
                ${r.map((m, mIdx) => {
                  const isCurrent = rIdx === s.currentRoundIdx && mIdx === s.currentMatchIdx;
                  return `
                    <div class="tree-match ${isCurrent ? 'current' : ''} ${m.status}">
                      <div class="tree-trainer ${m.winner && m.playerA && m.winner.id === m.playerA.id ? 'win' : ''}">
                        <span class="tree-name">${m.playerA ? m.playerA.name : '—'}</span>
                      </div>
                      <div class="tree-trainer ${m.winner && m.playerB && m.winner.id === m.playerB.id ? 'win' : ''}">
                        <span class="tree-name">${m.playerB ? m.playerB.name : '—'}</span>
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

  // --- Rendu du Combat (Arène Showdown) ---
  function renderBattle(s) {
    const b = s.battle;
    if (!b) return;

    if (!battleMusic.isPlaying && battleMusic.on) {
      battleMusic.start();
    }

    // Déterminer si le joueur local est un combattant
    const mySide = b.trainerA.id === me.id ? 'A' : b.trainerB.id === me.id ? 'B' : null;
    const isSpectator = !mySide;

    // Déterminer qui est en bas (allié/vue arrière) et qui est en haut (adversaire/vue avant)
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

    const hpColorBottom = hpPctBottom > 50 ? '#2fbf71' : hpPctBottom > 20 ? '#ffc531' : '#ff4b2b';
    const hpColorTop = hpPctTop > 50 ? '#2fbf71' : hpPctTop > 20 ? '#ffc531' : '#ff4b2b';

    const isSubmitted = mySide === 'A' ? s.submittedA : mySide === 'B' ? s.submittedB : false;
    const isForcedSwitch = (mySide === 'A' && b.phase === 'switch_forced_A') ||
                          (mySide === 'B' && b.phase === 'switch_forced_B') ||
                          b.phase === 'switch_forced_both';

    // Rendu des badges d'équipe (3 petites pokéballs par dresseur)
    const ballsHtml = (team) => `
      <div class="team-balls">
        ${team.map(p => `<span class="ball-dot ${p.fainted ? 'fainted' : 'alive'}" title="${p.name} (${p.hp}/${p.maxHp})"></span>`).join('')}
      </div>`;

    // Rendu du message de journal / log
    let announcement = '';
    if (b.log && b.log.length) {
      const last = b.log[b.log.length - 1];
      announcement = last.msg || '';
    } else {
      announcement = `Que doit faire ${pBottom.name} ?`;
    }

    // Calcul du temps restant
    const leftMs = Math.max(0, s.turnEndsAt - Date.now());
    const leftSec = Math.ceil(leftMs / 1000);
    const timerWidth = Math.max(0, Math.min(100, (leftMs / (s.timerSecs * 1000)) * 100));

    stage.innerHTML = `
      <div class="arena-card deal">
        <div class="battlefield">
          <!-- Zone Adversaire (Haut-Droit) -->
          <div class="side top-side">
            <div class="status-box">
              <div class="sb-header">
                <b>${pTop.name}</b>
                <span class="sb-lvl">N.50</span>
                ${pTop.types.map(t => `<span class="type-pill" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`).join('')}
                ${pTop.status ? `<span class="status-badge ${pTop.status}">${pTop.status.toUpperCase()}</span>` : ''}
              </div>
              <div class="hp-bar-track">
                <div class="hp-bar-fill" style="width:${hpPctTop}%;background:${hpColorTop}"></div>
              </div>
              <div class="sb-sub">
                <span class="trainer-tag" style="--tc:${tTop.color}">Dresseur : ${tTop.name}</span>
                ${ballsHtml(teamTop)}
              </div>
            </div>
            <div class="platform top-plat">
              <img class="poke-sprite front ${pTop.fainted ? 'fainted' : ''}" src="${spriteUrls(pTop.id).front}" alt="${pTop.name}">
            </div>
          </div>

          <!-- Zone Joueur / Allié (Bas-Gauche) -->
          <div class="side bottom-side">
            <div class="platform bottom-plat">
              <img class="poke-sprite back ${pBottom.fainted ? 'fainted' : ''}" src="${spriteUrls(pBottom.id).back}" alt="${pBottom.name}">
            </div>
            <div class="status-box">
              <div class="sb-header">
                <b>${pBottom.name}</b>
                <span class="sb-lvl">N.50</span>
                ${pBottom.types.map(t => `<span class="type-pill" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`).join('')}
                ${pBottom.status ? `<span class="status-badge ${pBottom.status}">${pBottom.status.toUpperCase()}</span>` : ''}
              </div>
              <div class="hp-bar-track">
                <div class="hp-bar-fill" style="width:${hpPctBottom}%;background:${hpColorBottom}"></div>
              </div>
              <div class="sb-sub">
                <span class="hp-text">${pBottom.hp} / ${pBottom.maxHp} PV</span>
                ${ballsHtml(teamBottom)}
              </div>
            </div>
          </div>

          <!-- Bandeau de combat au centre -->
          <div class="announcement-bar">${announcement}</div>
        </div>

        <!-- Pupitre de Commandes (Bas) -->
        <div class="dashboard">
          ${isSpectator ? `
            <div class="spectator-bar">
              <span>👁️ Mode Spectateur en Direct : <b>${tBottom.name}</b> contre <b>${tTop.name}</b></span>
            </div>
          ` : `
            <div class="dash-timer">
              <div class="dt-fill" style="width:${timerWidth}%"></div>
              <span class="dt-text">${leftSec} s</span>
            </div>

            <div class="dash-tabs">
              <button class="dash-tab ${activeTab === 'moves' ? 'active' : ''}" id="tabMoves" ${isForcedSwitch ? 'disabled' : ''}>Attaquer</button>
              <button class="dash-tab ${activeTab === 'switch' ? 'active' : ''}" id="tabSwitch">Changer de Pokémon (${teamBottom.filter(p => !p.fainted).length})</button>
              ${isSubmitted ? '<span class="action-locked">✔ Ordre validé · En attente de l\'adversaire…</span>' : ''}
            </div>

            ${activeTab === 'moves' && !isForcedSwitch ? `
              <div class="moves-grid">
                ${pBottom.moves.map((moveId, mIdx) => {
                  const m = MOVES[moveId];
                  if (!m) return '';
                  const eff = getEffectiveness(m.type, pTop.types);
                  const effLabel = eff >= 2 ? 'Super efficace !' : eff <= 0.5 && eff > 0 ? 'Peu efficace' : eff === 0 ? 'Aucun effet' : '';
                  return `
                    <button class="btn-move" data-move="${moveId}" style="--mc:${TYPES[m.type].color}" ${isSubmitted ? 'disabled' : ''}>
                      <div class="bm-head">
                        <kbd>${mIdx + 1}</kbd>
                        <b>${m.name}</b>
                        <span class="bm-cat">${m.cat === 'physical' ? '⚔️' : m.cat === 'special' ? '🔮' : '✨'}</span>
                      </div>
                      <div class="bm-sub">
                        <span class="bm-type" style="background:${TYPES[m.type].color}">${TYPES[m.type].name}</span>
                        <span class="bm-pow">${m.power ? `Puiss. ${m.power}` : 'Statut'}</span>
                        ${effLabel ? `<span class="bm-eff ${eff >= 2 ? 'eff-super' : 'eff-low'}">${effLabel}</span>` : ''}
                      </div>
                    </button>`;
                }).join('')}
              </div>
            ` : `
              <div class="switch-grid">
                ${teamBottom.map((p, pIdx) => {
                  const isCurrent = pIdx === (bottomSide === 'A' ? b.activeA : b.activeB);
                  return `
                    <button class="btn-switch ${isCurrent ? 'current' : ''} ${p.fainted ? 'fainted' : ''}" data-switch="${pIdx}" ${isCurrent || p.fainted || isSubmitted ? 'disabled' : ''}>
                      <img src="${spriteUrls(p.id).icon}" alt="${p.name}">
                      <div class="bs-info">
                        <b>${p.name} ${isCurrent ? '(Actif)' : ''}</b>
                        <div class="bs-types">${p.types.map(t => `<span class="type-pill" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`).join('')}</div>
                        <span class="bs-hp">${p.fainted ? 'K.O.' : `${p.hp} / ${p.maxHp} PV`}</span>
                      </div>
                    </button>`;
                }).join('')}
              </div>
            `}
          `}
        </div>
      </div>`;

    // Événements d'attaques
    if (!isSpectator && !isSubmitted) {
      $('#tabMoves').onclick = () => { activeTab = 'moves'; renderBattle(state); };
      $('#tabSwitch').onclick = () => { activeTab = 'switch'; renderBattle(state); };

      for (const btn of root.querySelectorAll('[data-move]')) {
        btn.onclick = () => {
          const moveId = btn.dataset.move;
          sfx.play('hit');
          localActionSent = true;
          submitAction({ type: 'move', moveId });
        };
      }

      for (const btn of root.querySelectorAll('[data-switch]')) {
        btn.onclick = () => {
          const targetIndex = Number(btn.dataset.switch);
          sfx.play('switch');
          localActionSent = true;
          submitAction({ type: 'switch', targetIndex });
        };
      }
    }
  }

  // --- Rendu du Podium Final ---
  function renderPodium(s) {
    battleMusic.stop();
    sfx.play('victory');
    const champ = s.champion;
    const podium = s.podium || [];

    stage.innerHTML = `
      <div class="podium-screen deal">
        <h1 class="podium-title">🏆 VAINQUEUR DU TOURNOI POKÉMON</h1>
        <div class="champ-banner" style="--cc:${champ.color}">
          <div class="champ-crown">👑</div>
          <h2>${champ.name}</h2>
          <p>Maître de la Ligue Pokémon !</p>
          <div class="champ-team">
            ${champ.team.map(p => `
              <div class="champ-poke-card">
                <img src="${spriteUrls(p.id).artwork}" alt="${p.name}">
                <b>${p.name}</b>
                <div class="champ-types">${p.types.map(t => `<span class="type-pill" style="background:${TYPES[t].color}">${TYPES[t].name}</span>`).join('')}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="podium-actions">
          <button class="btn big yellow" id="btnPlayAgain">Nouveau Tournoi 🔄</button>
          <button class="btn big ghost" id="btnBackLobby">Retour au salon</button>
        </div>
      </div>`;

    $('#btnPlayAgain').onclick = () => restart();
    $('#btnBackLobby').onclick = () => exit();
  }

  // Gestion des raccourcis clavier (1, 2, 3, 4 pour attaques)
  addEventListener('keydown', (e) => {
    if (!state || state.phase !== 'battle' || !state.battle) return;
    const b = state.battle;
    const mySide = b.trainerA.id === me.id ? 'A' : b.trainerB.id === me.id ? 'B' : null;
    if (!mySide) return;

    const isSubmitted = mySide === 'A' ? state.submittedA : state.submittedB;
    if (isSubmitted) return;

    const p = mySide === 'A' ? b.teamA[b.activeA] : b.teamB[b.activeB];
    if (['1', '2', '3', '4'].includes(e.key)) {
      const idx = Number(e.key) - 1;
      if (p.moves[idx]) {
        sfx.play('hit');
        submitAction({ type: 'move', moveId: p.moves[idx] });
      }
    }
  });

  return {
    update(s, off) {
      state = s;
      // Jouer les sons d'événements nouveaux
      if (s.events && s.events.length) {
        s.events.forEach(ev => {
          if (ev.type === 'damage' && ev.mult >= 2) sfx.play('supereffective');
          else if (ev.type === 'damage') sfx.play('hit');
          else if (ev.type === 'faint') sfx.play('faint');
          else if (ev.type === 'switch') {
            sfx.play('switch');
            if (ev.pokemonId) sfx.playCry(ev.pokemonId);
          }
          else if (ev.type === 'stat_change') sfx.play('stat');
          else if (ev.type === 'victory') sfx.play('victory');
        });
      }

      if (s.phase === 'bracket_preview') {
        renderBracket(s);
      } else if (s.phase === 'battle') {
        renderBattle(s);
      } else if (s.phase === 'podium') {
        renderPodium(s);
      }
    },
    toast
  };
}
