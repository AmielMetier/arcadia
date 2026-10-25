// pokemon/view/game.js
// Interface visuelle de Poké Duel : Arbre de tournoi, arène de combat Showdown, barres de PV, attaques et switchs.

import { spriteUrls, POKEBALL_SPRITE } from '../engine/data.js';
import { MOVES } from '../engine/moves.js';
import { TYPES, getEffectiveness, getTypeBadgeUrl } from '../engine/types.js';
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
  let timerTicker = null;

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
                  <div class="preview-types">
                    ${p.types.map(t => `<img class="preview-type-img" src="${getTypeBadgeUrl(t)}" alt="${t}">`).join('')}
                  </div>
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
                  <div class="preview-types">
                    ${p.types.map(t => `<img class="preview-type-img" src="${getTypeBadgeUrl(t)}" alt="${t}">`).join('')}
                  </div>
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

    // Déterminer qui est en bas (joueur local / allié) et en haut (adversaire)
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

    // Rendu des 3 Pokéballs d'équipe (PokeAPI item PNG)
    const ballsHtml = (team) => `
      <div class="team-pokeballs">
        ${team.map(p => `
          <div class="ball-slot ${p.fainted ? 'fainted' : 'alive'}" title="${p.name} (${p.hp}/${p.maxHp} PV)">
            <img src="${POKEBALL_SPRITE}" alt="ball" class="ball-img">
          </div>
        `).join('')}
      </div>`;

    // Rendu des types avec images officielles Gen 8
    const typeBadgesHtml = (types) => types.map(t => `
      <span class="type-pill" title="${TYPES[t].name}">
        <img class="type-pill-img" src="${getTypeBadgeUrl(t)}" alt="${TYPES[t].name}" loading="lazy">
      </span>
    `).join('');

    // Message d'annonce
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
          <!-- Ciel & Éclairage de stade -->
          <div class="stadium-sky">
            <div class="floodlight left-light"></div>
            <div class="floodlight right-light"></div>
            <div class="stadium-stands"></div>
          </div>

          <!-- Pelouse & Marquages officiels de Stade Pokémon -->
          <div class="stadium-turf">
            <div class="turf-ring-outer"></div>
            <div class="turf-pokeball-center"></div>
          </div>

          <!-- HUD Adversaire (Haut-Gauche) -->
          <div class="hud-zone hud-top">
            <div class="status-card opponent-card">
              <div class="sc-head">
                <div class="sc-name-row">
                  <b class="sc-name">${pTop.name}</b>
                  <span class="sc-lvl">Nv. 50</span>
                </div>
                <div class="sc-types">${typeBadgesHtml(pTop.types)}</div>
                ${pTop.status ? `<span class="status-badge status-${pTop.status}">${STATUS_LABELS[pTop.status] || pTop.status.toUpperCase()}</span>` : ''}
              </div>

              <div class="hp-gauge-row">
                <span class="hp-tag">PV</span>
                <div class="hp-track">
                  <div class="hp-fill ${hpPctTop <= 20 ? 'critical' : ''}" style="width:${hpPctTop}%;background:${hpColorTop}"></div>
                  <div class="hp-gloss"></div>
                </div>
              </div>

              <div class="sc-foot">
                <span class="trainer-badge" style="--tc:${tTop.color}">
                  <i class="trainer-dot"></i>${tTop.name}
                </span>
                ${ballsHtml(teamTop)}
              </div>
            </div>
          </div>

          <!-- Zone Combat Adversaire (Haut-Droite) : Plateforme 3D & Sprite avant sans coupure -->
          <div class="fighter-zone fighter-top">
            <div class="platform platform-top">
              <div class="plat-shadow"></div>
              <div class="plat-base"></div>
              <div class="plat-turf"></div>
              <div class="plat-ring"></div>
              <img class="poke-sprite front ${pTop.fainted ? 'fainted' : ''}" id="spriteTop" src="${spriteUrls(pTop.id).front}" alt="${pTop.name}">
              <div class="damage-popup-anchor" id="popupAnchorTop"></div>
            </div>
          </div>

          <!-- Zone Combat Joueur (Bas-Gauche) : Plateforme 3D & Sprite arrière -->
          <div class="fighter-zone fighter-bottom">
            <div class="platform platform-bottom">
              <div class="plat-shadow"></div>
              <div class="plat-base"></div>
              <div class="plat-turf"></div>
              <div class="plat-ring"></div>
              <img class="poke-sprite back ${pBottom.fainted ? 'fainted' : ''}" id="spriteBottom" src="${spriteUrls(pBottom.id).back}" alt="${pBottom.name}">
              <div class="damage-popup-anchor" id="popupAnchorBottom"></div>
            </div>
          </div>

          <!-- HUD Joueur (Bas-Droite) -->
          <div class="hud-zone hud-bottom">
            <div class="status-card player-card">
              <div class="sc-head">
                <div class="sc-name-row">
                  <b class="sc-name">${pBottom.name}</b>
                  <span class="sc-lvl">Nv. 50</span>
                </div>
                <div class="sc-types">${typeBadgesHtml(pBottom.types)}</div>
                ${pBottom.status ? `<span class="status-badge status-${pBottom.status}">${STATUS_LABELS[pBottom.status] || pBottom.status.toUpperCase()}</span>` : ''}
              </div>

              <div class="hp-gauge-row">
                <span class="hp-tag">PV</span>
                <div class="hp-track">
                  <div class="hp-fill ${hpPctBottom <= 20 ? 'critical' : ''}" style="width:${hpPctBottom}%;background:${hpColorBottom}"></div>
                  <div class="hp-gloss"></div>
                </div>
              </div>

              <div class="sc-foot">
                <span class="hp-fraction"><b style="color:${hpColorBottom}">${pBottom.hp}</b> / ${pBottom.maxHp} PV</span>
                ${ballsHtml(teamBottom)}
              </div>
            </div>
          </div>
        </div>

        <!-- Bandeau de Dialogue Showdown -->
        <div class="battle-dialogue-bar">
          <span class="dialogue-icon">💬</span>
          <span class="dialogue-text">${announcement}</span>
        </div>

        <!-- Pupitre de Commandes Tactiles -->
        <div class="dashboard">
          ${isSpectator ? `
            <div class="spectator-bar">
              <span>👁️ Match en Direct : <b>${tBottom.name}</b> affronte <b>${tTop.name}</b></span>
            </div>
          ` : `
            <div class="dash-top-row">
              <div class="dash-timer">
                <div class="dt-fill" id="timerFill" style="width:${timerWidth}%"></div>
                <span class="dt-text" id="timerText">${leftSec} s</span>
              </div>
              ${isSubmitted ? '<span class="action-locked">✔ Ordre validé · Attente de l\'adversaire…</span>' : ''}
            </div>

            <div class="dash-tabs">
              <button class="dash-tab ${activeTab === 'moves' ? 'active' : ''}" id="tabMoves" ${isForcedSwitch ? 'disabled' : ''}>
                ⚔️ Attaquer
              </button>
              <button class="dash-tab ${activeTab === 'switch' ? 'active' : ''}" id="tabSwitch">
                🔄 Changer de Pokémon (${teamBottom.filter(p => !p.fainted).length})
              </button>
            </div>

            ${activeTab === 'moves' && !isForcedSwitch ? `
              <div class="moves-grid">
                ${pBottom.moves.map((moveId, mIdx) => {
                  const m = MOVES[moveId];
                  if (!m) return '';
                  const eff = getEffectiveness(m.type, pTop.types);
                  let effTagHtml = '';
                  if (m.power > 0) {
                    if (eff >= 2) {
                      effTagHtml = `<div class="bm-eff-tag eff-super">💥 Super efficace (x${eff})</div>`;
                    } else if (eff <= 0.5 && eff > 0) {
                      effTagHtml = `<div class="bm-eff-tag eff-low">🛡️ Peu efficace (x${eff})</div>`;
                    } else if (eff === 0) {
                      effTagHtml = `<div class="bm-eff-tag eff-zero">🚫 Sans effet (x0)</div>`;
                    } else {
                      effTagHtml = `<div class="bm-eff-tag eff-normal">Efficace (x1)</div>`;
                    }
                  } else {
                    effTagHtml = `<div class="bm-eff-tag eff-status">Capacité Statut</div>`;
                  }

                  return `
                    <button class="btn-move" data-move="${moveId}" style="--mc:${TYPES[m.type].color}" ${isSubmitted ? 'disabled' : ''}>
                      <div class="bm-header">
                        <kbd class="bm-key">${mIdx + 1}</kbd>
                        <span class="bm-name">${m.name}</span>
                        <span class="bm-category ${m.cat}">
                          ${m.cat === 'physical' ? '⚔️ Phys' : m.cat === 'special' ? '🌀 Spé' : '✨ Stat'}
                        </span>
                      </div>
                      <div class="bm-body">
                        <div class="bm-type-badge">
                          <img src="${getTypeBadgeUrl(m.type)}" alt="${TYPES[m.type].name}" class="bm-type-icon" loading="lazy">
                        </div>
                        <div class="bm-stats">
                          <span class="bm-stat"><b>${m.power ? m.power : '—'}</b> Puiss</span>
                          <span class="bm-stat"><b>${m.acc}%</b> Préc</span>
                          <span class="bm-stat"><b>${m.pp}</b> PP</span>
                        </div>
                      </div>
                      ${effTagHtml}
                    </button>`;
                }).join('')}
              </div>
            ` : `
              <div class="switch-grid">
                ${teamBottom.map((p, pIdx) => {
                  const isCurrent = pIdx === (bottomSide === 'A' ? b.activeA : b.activeB);
                  const hpPct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
                  const hpCol = hpPct > 50 ? '#2fbf71' : hpPct > 20 ? '#ffc531' : '#ff4b2b';
                  return `
                    <button class="btn-switch ${isCurrent ? 'current' : ''} ${p.fainted ? 'fainted' : ''}" data-switch="${pIdx}" ${isCurrent || p.fainted || isSubmitted ? 'disabled' : ''}>
                      <div class="bs-avatar">
                        <img src="${spriteUrls(p.id).icon}" alt="${p.name}" class="bs-icon">
                        ${isCurrent ? '<span class="bs-active-tag">Actif</span>' : ''}
                        ${p.fainted ? '<span class="bs-ko-tag">K.O.</span>' : ''}
                      </div>
                      <div class="bs-details">
                        <div class="bs-title-row">
                          <b>${p.name}</b>
                          <span class="bs-lvl">Nv. 50</span>
                        </div>
                        <div class="bs-types">
                          ${p.types.map(t => `<img src="${getTypeBadgeUrl(t)}" alt="${TYPES[t].name}" class="bs-type-icon">`).join('')}
                        </div>
                        <div class="bs-hp-track">
                          <div class="bs-hp-fill" style="width:${hpPct}%;background:${hpCol}"></div>
                        </div>
                        <div class="bs-hp-num">${p.fainted ? 'K.O.' : `${p.hp} / ${p.maxHp} PV`}</div>
                      </div>
                    </button>`;
                }).join('')}
              </div>
            `}
          `}
        </div>
      </div>`;

    // Gestion des événements d'attaques et de switch
    if (!isSpectator && !isSubmitted) {
      const bMoves = $('#tabMoves');
      const bSwitch = $('#tabSwitch');
      if (bMoves) bMoves.onclick = () => { activeTab = 'moves'; renderBattle(state); };
      if (bSwitch) bSwitch.onclick = () => { activeTab = 'switch'; renderBattle(state); };

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

  // --- Animation visuelle d'un événement ---
  function triggerEventAnimation(ev, b) {
    if (!b) return;
    const mySide = b.trainerA.id === me.id ? 'A' : b.trainerB.id === me.id ? 'B' : null;
    const bottomSide = mySide === 'B' ? 'B' : 'A';

    if (ev.type === 'move') {
      const isBottom = (ev.side === bottomSide);
      const sprite = $(isBottom ? '#spriteBottom' : '#spriteTop');
      if (sprite) {
        const animClass = isBottom ? 'anim-lunge-player' : 'anim-lunge-opponent';
        sprite.classList.remove(animClass);
        void sprite.offsetWidth;
        sprite.classList.add(animClass);
      }
    } else if (ev.type === 'damage') {
      const targetIsBottom = (ev.side === bottomSide);
      const sprite = $(targetIsBottom ? '#spriteBottom' : '#spriteTop');
      if (sprite) {
        sprite.classList.remove('anim-hit');
        void sprite.offsetWidth;
        sprite.classList.add('anim-hit');
      }

      // Popup flottant de dégâts
      const anchor = $(targetIsBottom ? '#popupAnchorBottom' : '#popupAnchorTop');
      if (anchor && ev.dmg > 0) {
        const pop = document.createElement('div');
        pop.className = `damage-popup ${ev.crit ? 'crit' : ''}`;
        pop.textContent = `-${ev.dmg} PV${ev.crit ? ' !' : ''}`;
        anchor.appendChild(pop);
        setTimeout(() => pop.remove(), 1000);
      }
    } else if (ev.type === 'switch') {
      const isBottom = (ev.side === bottomSide);
      const sprite = $(isBottom ? '#spriteBottom' : '#spriteTop');
      if (sprite) {
        sprite.classList.remove('anim-enter');
        void sprite.offsetWidth;
        sprite.classList.add('anim-enter');
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
        <h1 class="podium-title">🏆 VAINQUEUR DU TOURNOI POKÉMON</h1>
        <div class="champ-banner" style="--cc:${champ.color}">
          <div class="champ-crown">👑</div>
          <h2>${champ.name}</h2>
          <p>Nouveau Maître de la Ligue Pokémon !</p>
          <div class="champ-team">
            ${champ.team.map(p => `
              <div class="champ-poke-card">
                <img src="${spriteUrls(p.id).artwork}" alt="${p.name}">
                <b>${p.name}</b>
                <div class="champ-types">
                  ${p.types.map(t => `<img class="champ-type-img" src="${getTypeBadgeUrl(t)}" alt="${t}">`).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>

        <div class="podium-actions">
          <button class="btn big yellow" id="btnPlayAgain">Nouveau Tournoi 🔄</button>
          <button class="btn big ghost" id="btnBackLobby">Retour au Salon</button>
        </div>
      </div>`;

    $('#btnPlayAgain').onclick = () => restart();
    $('#btnBackLobby').onclick = () => exit();
  }

  // Raccourcis clavier (1, 2, 3, 4 pour attaques)
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

      // Déclencher le rendu de phase
      if (s.phase === 'bracket_preview') {
        renderBracket(s);
      } else if (s.phase === 'battle') {
        renderBattle(s);

        // Déclencher les animations et effets audio des événements récents
        if (s.events && s.events.length) {
          s.events.forEach(ev => {
            triggerEventAnimation(ev, s.battle);
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
      } else if (s.phase === 'podium') {
        renderPodium(s);
      }
    },
    toast
  };
}
