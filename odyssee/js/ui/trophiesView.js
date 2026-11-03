// odyssee/js/ui/trophiesView.js — Écran Journal des Trophées & Boîte à Médailles (Style 5G B2W2)
import { el, esc } from './ui.js';
import {
  TROPHIES_CATALOG,
  STREAK_RANKS,
  getStreakRank,
  ensurePvpState,
  claimTrophyReward,
  getPvpSummary,
  getHeadToHeadStatus
} from '../core/trophies.js';
import { itemName } from '../core/items.js';

function screen(ui, cls) {
  const s = el('div', 'screen ' + cls);
  ui.root.appendChild(s);
  return s;
}

function timeAgo(ts) {
  if (!ts) return 'Récemment';
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'À l\'instant';
  if (min < 60) return `Il y a ${min} min`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  return `Il y a ${days} j`;
}

/**
 * Affiche une bannière toast façon Pokémon Noir 2 / Blanc 2 lors du déblocage d'une médaille.
 */
export function showTrophyToast(game, trophy) {
  if (!game?.ui?.root || !trophy) return;
  const t = el('div', 'trophy-toast box');
  const iconSrc = `img/trophies/medal_${trophy.tier}_64.png`;
  t.innerHTML = `
    <div class="trophy-toast-icon">
      <img src="${iconSrc}" alt="" class="medal-pixel" onerror="this.src='img/trophies/box_120.png'">
    </div>
    <div class="trophy-toast-content">
      <div class="trophy-toast-tag">★ NOUVELLE MÉDAILLE DÉBLOQUÉE !</div>
      <div class="trophy-toast-title">${esc(trophy.title)}</div>
      <div class="trophy-toast-sub">${esc(trophy.reward?.label ? 'Récompense disponible : ' + trophy.reward.label : trophy.desc)}</div>
    </div>
  `;
  game.ui.root.appendChild(t);
  try { game.sound?.sfx('badge'); } catch (e) {}

  setTimeout(() => {
    t.classList.add('trophy-toast-leave');
    setTimeout(() => t.remove(), 400);
  }, 3600);
}

/**
 * Affiche l'écran complet du Journal des Trophées et Médailles B2W2.
 */
export function trophiesScreen(game) {
  const ui = game.ui;
  const st = game.state;
  ensurePvpState(st);

  return new Promise((resolve) => {
    const s = screen(ui, 'trophies-scr');
    let tab = 'medals'; // 'medals' | 'history' | 'streaks'
    let medalFilter = 'all'; // 'all' | 'unlocked' | 'claimable' | 'bronze' | 'silver' | 'gold' | 'platinum'
    let selIdx = 0;

    const render = () => {
      const summary = getPvpSummary(st);
      const trophies = TROPHIES_CATALOG.map((t) => {
        const u = st.pvp.trophies[t.id] || {};
        const p = t.check(st);
        return {
          ...t,
          unlocked: !!u.unlocked,
          claimed: !!u.claimed,
          current: p.current,
          max: p.max,
          done: p.done
        };
      });

      // Filtrage des trophées
      const filteredTrophies = trophies.filter((t) => {
        if (medalFilter === 'unlocked') return t.unlocked;
        if (medalFilter === 'claimable') return t.unlocked && !t.claimed;
        if (medalFilter === 'bronze') return t.tier === 'bronze';
        if (medalFilter === 'silver') return t.tier === 'silver';
        if (medalFilter === 'gold') return t.tier === 'gold';
        if (medalFilter === 'platinum') return t.tier === 'platinum';
        return true;
      });

      s.innerHTML = `
        <div class="scr-bar">
          <div class="scr-bar-left">
            <img class="scr-bar-ico medal-box-ico" src="img/trophies/box_120.png" alt="Boîte à Médailles">
            <span class="scr-bar-title">JOURNAL DES TROPHÉES</span>
            <span class="scr-bar-sub">${summary.unlockedCount} / ${summary.trophiesTotal} Médailles · Série : ${summary.currentStreak} (Record : ${summary.bestStreak})</span>
          </div>
          <div class="trophies-tabs">
            <button type="button" class="ttab${tab === 'medals' ? ' on' : ''}" data-tab="medals">
              🏅 MÉDAILLES (${summary.unlockedCount}/${summary.trophiesTotal})
              ${summary.claimableCount > 0 ? `<span class="badge-notify">${summary.claimableCount}</span>` : ''}
            </button>
            <button type="button" class="ttab${tab === 'history' ? ' on' : ''}" data-tab="history">
              ⚔️ FACE-À-FACE (${summary.playersCount})
            </button>
            <button type="button" class="ttab${tab === 'streaks' ? ' on' : ''}" data-tab="streaks">
              👑 SÉRIES & RECORDS
            </button>
          </div>
          <div class="scr-bar-right">
            <button class="scr-btn-close" type="button" data-act="close" title="Fermer (Échap)">✕</button>
          </div>
        </div>

        <div class="trophies-body">
          ${tab === 'medals' ? renderMedalsTab(filteredTrophies, summary, medalFilter) : ''}
          ${tab === 'history' ? renderHistoryTab(summary) : ''}
          ${tab === 'streaks' ? renderStreaksTab(summary) : ''}
        </div>

        <div class="trophies-foot">
          <div class="trophies-foot-keys">
            <span><kbd>▲</kbd><kbd>▼</kbd> Naviguer</span>
            <span><kbd>◄</kbd><kbd>►</kbd> Changer d'onglet</span>
            <span><kbd>ESPACE</kbd> / <kbd>ENTRÉE</kbd> Réclamer la récompense</span>
            <span><kbd>ÉCHAP</kbd> Quitter</span>
          </div>
        </div>
      `;

      // Brancher les événements
      s.querySelectorAll('.ttab').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          tab = b.dataset.tab;
          selIdx = 0;
          ui.sound?.sfx('blip');
          render();
        });
      });

      s.querySelectorAll('.tfilter-btn').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          medalFilter = b.dataset.filter;
          selIdx = 0;
          ui.sound?.sfx('blip');
          render();
        });
      });

      s.querySelectorAll('[data-act="claim"]').forEach((b) => {
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          const tid = b.dataset.id;
          handleClaim(tid);
        });
      });

      s.querySelector('[data-act="close"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        close();
      });
    };

    const handleClaim = (trophyId) => {
      const res = claimTrophyReward(st, trophyId);
      if (res.ok) {
        try { game.sound?.sfx('item'); } catch (e) {}
        game.save(true);
        ui.toast(`Récompense obtenue : ${res.label} ajoutée au Sac !`, 2000);
        render();
      } else {
        ui.toast(res.message || 'Impossible de réclamer.', 1500);
      }
    };

    const close = () => {
      pop();
      s.remove();
      ui.sound?.sfx('cancel');
      resolve();
    };

    const pop = ui.input.push((k) => {
      if (k === 'left') {
        tab = tab === 'streaks' ? 'history' : tab === 'history' ? 'medals' : 'streaks';
        selIdx = 0;
        ui.sound?.sfx('blip');
        render();
      } else if (k === 'right') {
        tab = tab === 'medals' ? 'history' : tab === 'history' ? 'streaks' : 'medals';
        selIdx = 0;
        ui.sound?.sfx('blip');
        render();
      } else if (k === 'a' || k === 'space') {
        if (tab === 'medals') {
          // Chercher le premier trophée réclamable ou celui sélectionné
          const summary = getPvpSummary(st);
          const claimable = TROPHIES_CATALOG.find((t) => st.pvp.trophies[t.id]?.unlocked && !st.pvp.trophies[t.id]?.claimed);
          if (claimable) {
            handleClaim(claimable.id);
            return;
          }
        }
      } else if (k === 'b' || k === 'menu') {
        close();
      }
    });

    render();
  });
}

function renderMedalsTab(trophies, summary, medalFilter) {
  const TIER_COLORS = {
    bronze: '#d48842',
    silver: '#cad2df',
    gold: '#fcd34d',
    platinum: '#67e8f9'
  };

  const TIER_LABELS = {
    bronze: 'BRONZE',
    silver: 'ARGENT',
    gold: 'OR',
    platinum: 'PLATINE'
  };

  return `
    <div class="tmedals-container">
      <div class="tfilter-bar">
        <button type="button" class="tfilter-btn${medalFilter === 'all' ? ' on' : ''}" data-filter="all">Toutes (${summary.trophiesTotal})</button>
        <button type="button" class="tfilter-btn${medalFilter === 'claimable' ? ' on' : ''}" data-filter="claimable">
          À Réclamer ${summary.claimableCount > 0 ? `(${summary.claimableCount})` : ''}
        </button>
        <button type="button" class="tfilter-btn${medalFilter === 'unlocked' ? ' on' : ''}" data-filter="unlocked">Débloquées (${summary.unlockedCount})</button>
        <span class="tfilter-sep">|</span>
        <button type="button" class="tfilter-btn tier-bronze${medalFilter === 'bronze' ? ' on' : ''}" data-filter="bronze">Bronze</button>
        <button type="button" class="tfilter-btn tier-silver${medalFilter === 'silver' ? ' on' : ''}" data-filter="silver">Argent</button>
        <button type="button" class="tfilter-btn tier-gold${medalFilter === 'gold' ? ' on' : ''}" data-filter="gold">Or</button>
        <button type="button" class="tfilter-btn tier-platinum${medalFilter === 'platinum' ? ' on' : ''}" data-filter="platinum">Platine</button>
      </div>

      <div class="tmedals-grid">
        ${trophies.length ? trophies.map((t) => {
          const pct = Math.min(100, Math.round((t.current / t.max) * 100));
          const iconSrc = `img/trophies/medal_${t.tier}_64.png`;
          const isDone = t.done || t.unlocked;
          const isClaimed = t.claimed;
          const isClaimable = isDone && !isClaimed;

          return `
            <div class="tmedal-card ${t.tier}${isDone ? ' unlocked' : ' locked'}${isClaimable ? ' claimable' : ''}">
              <div class="tmedal-icon-col">
                <div class="tmedal-glow-wrap">
                  <img src="${iconSrc}" alt="${TIER_LABELS[t.tier]}" class="tmedal-img${isDone ? '' : ' grayscale'}">
                  ${!isDone ? '<div class="tmedal-lock">🔒</div>' : ''}
                </div>
                <span class="tmedal-tier-tag" style="background:${TIER_COLORS[t.tier]}">${TIER_LABELS[t.tier]}</span>
              </div>

              <div class="tmedal-info-col">
                <div class="tmedal-title-row">
                  <span class="tmedal-title">${esc(t.title)}</span>
                  ${isClaimed ? '<span class="tmedal-claimed-badge">✔ Obtenu</span>' : isClaimable ? '<span class="tmedal-claimable-badge">★ Prêt !</span>' : ''}
                </div>
                <div class="tmedal-desc">${esc(t.desc)}</div>

                <div class="tmedal-progress-wrap">
                  <div class="tmedal-progress-bar">
                    <div class="tmedal-progress-fill" style="width: ${pct}%"></div>
                  </div>
                  <span class="tmedal-progress-text">${t.current} / ${t.max}</span>
                </div>

                <div class="tmedal-reward-row">
                  <div class="tmedal-reward-label">
                    <span class="reward-gift-ico">🎁</span>
                    <span>${esc(t.reward?.label || itemName(t.reward?.item))}</span>
                  </div>
                  ${isClaimable ? `
                    <button type="button" class="tbtn-claim animate-pulse" data-act="claim" data-id="${t.id}">RÉCLAMER</button>
                  ` : isClaimed ? `
                    <button type="button" class="tbtn-claimed" disabled>RÉCLAMÉ</button>
                  ` : `
                    <div class="tstatus-pending">${t.current}/${t.max}</div>
                  `}
                </div>
              </div>
            </div>
          `;
        }).join('') : '<div class="tempty-msg">Aucune médaille ne correspond à ce filtre.</div>'}
      </div>
    </div>
  `;
}

function renderHistoryTab(summary) {
  const players = summary.players || [];

  return `
    <div class="thistory-container">
      <div class="tpvp-banner box">
        <div class="tpvp-stat-item">
          <span class="tpvp-stat-label">VICTOIRES</span>
          <span class="tpvp-stat-val win">${summary.totalWins}</span>
        </div>
        <div class="tpvp-stat-item">
          <span class="tpvp-stat-label">DÉFAITES</span>
          <span class="tpvp-stat-val lose">${summary.totalLosses}</span>
        </div>
        <div class="tpvp-stat-item">
          <span class="tpvp-stat-label">ÉGALITÉS</span>
          <span class="tpvp-stat-val tie">${summary.totalDraws}</span>
        </div>
        <div class="tpvp-stat-item">
          <span class="tpvp-stat-label">TOTAL MATCHS</span>
          <span class="tpvp-stat-val">${summary.totalMatches}</span>
        </div>
        <div class="tpvp-stat-item highlight">
          <span class="tpvp-stat-label">TAUX DE VICTOIRE</span>
          <span class="tpvp-stat-val rate">${summary.winRate}</span>
        </div>
        <div class="tpvp-stat-item highlight">
          <span class="tpvp-stat-label">SÉRIE EN COURS</span>
          <span class="tpvp-stat-val streak">🔥 ${summary.currentStreak}</span>
        </div>
      </div>

      <div class="thistory-head">
        <div class="thistory-title">HISTORIQUE PAR DRESSEUR AFFRONTÉ</div>
        <div class="thistory-sub">${players.length} dresseur${players.length > 1 ? 's' : ''} enregistré${players.length > 1 ? 's' : ''}</div>
      </div>

      <div class="thistory-list">
        ${players.length ? players.map((p) => {
          const tot = p.wins + p.losses + (p.draws || 0);
          const rate = tot > 0 ? ((p.wins / tot) * 100).toFixed(0) : '0';
          const h2h = getHeadToHeadStatus(p);

          return `
            <div class="th2h-card box">
              <div class="th2h-avatar-col">
                <div class="th2h-avatar-circle">
                  <span>${esc(p.name[0]?.toUpperCase() || '?')}</span>
                </div>
              </div>
              <div class="th2h-info-col">
                <div class="th2h-top-row">
                  <span class="th2h-name">${esc(p.name)}</span>
                  <span class="th2h-status-badge ${h2h.cls}">${esc(h2h.label)}</span>
                </div>
                <div class="th2h-desc">${esc(h2h.desc)}</div>
                <div class="th2h-meta-row">
                  <span class="th2h-record"><b>${p.wins}</b>V — <b>${p.losses}</b>D — <b>${p.draws || 0}</b>N</span>
                  <span class="th2h-ratio">Ratio : <b>${rate}%</b></span>
                  <span class="th2h-streak">Série vs joueur : <b>${p.streakAgainst || 0}</b></span>
                  <span class="th2h-time">${esc(timeAgo(p.lastDate))}</span>
                </div>
              </div>
            </div>
          `;
        }).join('') : `
          <div class="tempty-msg box">
            <div class="tempty-ico">⚔️</div>
            <div class="tempty-title">Aucun match PvP enregistré</div>
            <div class="tempty-sub">Défiez un autre dresseur dans le mode multijoueur pour enregistrer vos statistiques, vos bilans face-à-face et débloquer des trophées !</div>
          </div>
        `}
      </div>
    </div>
  `;
}

function renderStreaksTab(summary) {
  const rank = summary.rank;

  return `
    <div class="tstreaks-container">
      <div class="tstreak-hero box">
        <div class="tstreak-hero-left">
          <img src="img/trophies/streak_crown_48.png" alt="" class="tstreak-crown-img medal-pixel">
          <div class="tstreak-hero-rank">
            <div class="tstreak-hero-tag">RANG DE PRÉSTIGE ACTUEL</div>
            <div class="tstreak-hero-title">${esc(rank.title)}</div>
            <div class="tstreak-hero-sub">${esc(rank.desc)}</div>
          </div>
        </div>
        <div class="tstreak-hero-stats">
          <div class="tstreak-box current">
            <span class="tstreak-box-lbl">SÉRIE ACTUELLE</span>
            <span class="tstreak-box-num">🔥 ${summary.currentStreak}</span>
            <span class="tstreak-box-sub">victoire${summary.currentStreak > 1 ? 's' : ''} d'affilée</span>
          </div>
          <div class="tstreak-box best">
            <span class="tstreak-box-lbl">RECORD HISTORIQUE</span>
            <span class="tstreak-box-num">👑 ${summary.bestStreak}</span>
            <span class="tstreak-box-sub">meilleure série jamais atteinte</span>
          </div>
        </div>
      </div>

      <div class="tranks-table-wrap box">
        <div class="tranks-title">TABLEAU DES RANGS DE SÉRIE B2W2</div>
        <div class="tranks-list">
          ${STREAK_RANKS.map((r) => {
            const isCurrent = rank.title === r.title;
            const reached = summary.bestStreak >= r.min;

            return `
              <div class="trank-row${isCurrent ? ' current-rank' : ''}${reached ? ' reached' : ''}">
                <div class="trank-min-col">
                  <span class="trank-min-badge">${r.min > 0 ? `${r.min}+ Victoires` : '0+'}</span>
                </div>
                <div class="trank-title-col">
                  <span class="trank-title-text">${esc(r.title)}</span>
                  <span class="trank-sub-text">${esc(r.desc)}</span>
                </div>
                <div class="trank-status-col">
                  ${isCurrent ? '<span class="trank-tag current">★ RANG ACTUEL</span>' : reached ? '<span class="trank-tag done">✔ ATTEINT</span>' : '<span class="trank-tag locked">À débloquer</span>'}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}
