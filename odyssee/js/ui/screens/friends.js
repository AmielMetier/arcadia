// odyssee/js/ui/screens/friends.js — amis et joueurs connectés
import { esc } from '../ui.js';
import { BADGES } from '../../world/region.js';
import { ASSETS } from '../../assets.js';
import { getFriendsManager, formatFid } from '../../net/friends.js';
import { screen, closer } from './common.js';
import { cardScreen } from './card.js';
import { creneau, RAID_PERIODE } from '../../raid-monde.js';

/* ================= REGISTRE AMI & CONNEXIONS C-GEAR 5G ================= */
export function friendsScreen(game) {
  const ui = game.ui;
  const mgr = getFriendsManager(game);

  return new Promise((resolve) => {
    const s = screen(ui, 'friends-scr');
    s.classList.add('b2w2-screen');

    let tab = 'online'; // 'online' | 'hub' | 'friends' | 'add'
    let notice = { text: '', type: 'info', ts: 0 };
    let addCodeInput = '';

    const setNotice = (text, type = 'info') => {
      notice = { text, type, ts: Date.now() };
      try {
        if (type === 'ok') ui.sound?.sfx('select');
        else if (type === 'err') ui.sound?.sfx('bump');
        else ui.sound?.sfx('blip');
      } catch (e) {}
      render();
    };

    const copyCode = async () => {
      const code = formatFid(mgr.getMyCode());
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          const ta = document.createElement('textarea');
          ta.value = code;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
        }
        setNotice(`Code ami ${code} copié dans le presse-papier !`, 'ok');
      } catch (e) {
        setNotice(`Code ami : ${code}`, 'info');
      }
    };

    const render = () => {
      // le champ du code ami garde le focus et le curseur quand l'écran se redessine
      const prevInput = s.querySelector('.fr-code-input');
      const hadFocus = !!prevInput && document.activeElement === prevInput;
      const caret = hadFocus ? prevInput.selectionStart : null;
      const myCode = mgr.getMyCode();
      const onlinePeers = mgr.getOnlinePeers();
      const onlineCount = mgr.getOnlineCount();
      // les autres dresseurs : le joueur lui-même ne compte pas
      const autres = Math.max(0, onlineCount - 1), autresVus = onlinePeers.filter((p) => !p.isSelf).length;
      const friendsList = mgr.getFriendsList();
      const requests = mgr.getRequests();

      // En-tête C-Gear
      const headerHtml = `
        <div class="fr-hdr">
          <div class="fr-hdr-left">
            <div class="fr-cgear-icon"></div>
            <div class="fr-hdr-titles">
              <span class="fr-hdr-main">AMIS</span>
              <span class="fr-hdr-sub">Joue avec les dresseurs connectés et retrouve tes amis</span>
            </div>
          </div>
          <div class="fr-hdr-right">
            <span class="fr-online-pill">
              <span class="fr-pulse-dot"></span>
              ${autres ? `<b>${autres}</b> AUTRE${autres > 1 ? 'S' : ''} DRESSEUR${autres > 1 ? 'S' : ''} CONNECTÉ${autres > 1 ? 'S' : ''}` : 'PERSONNE D\'AUTRE EN LIGNE'}
            </span>
            <button type="button" class="fr-close-btn" data-act="close" title="Fermer le Registre Ami (Échap)">FERMER ✕</button>
          </div>
        </div>
      `;

      // Bandeau Mon Code Ami
      const myCodeHtml = `
        <div class="fr-mycode-bar">
          <div class="fr-mycode-left">
            <span class="fr-mycode-lbl">VOTRE CODE AMI PERSONNEL :</span>
            <span class="fr-mycode-val">${formatFid(myCode)}</span>
            <button type="button" class="fr-copy-btn" data-act="copy-code" title="Copier mon code ami dans le presse-papier">📋 COPIER MON CODE</button>
          </div>
          <div class="fr-mycode-right">
            ${notice.text ? `<span class="fr-notice-pill ${notice.type}">${esc(notice.text)}</span>` : '<span class="fr-hint-txt">Partagez ce code pour recevoir des demandes d\'amis !</span>'}
          </div>
        </div>
      `;

      // Onglets
      const tabsHtml = `
        <div class="fr-tabs-bar">
          <button type="button" class="fr-tab${tab === 'online' ? ' active' : ''}" data-act="tab-online">
            🌐 DRESSEURS EN DIRECT (${autresVus})
          </button>
          <button type="button" class="fr-tab${tab === 'hub' ? ' active' : ''}" data-act="tab-hub">
            🎮 SALON MULTI
          </button>
          <button type="button" class="fr-tab${tab === 'friends' ? ' active' : ''}" data-act="tab-friends">
            👥 MES AMIS (${friendsList.length})
          </button>
          <button type="button" class="fr-tab${tab === 'add' ? ' active' : ''}" data-act="tab-add">
            ➕ AJOUTER UN AMI ${requests.length > 0 ? `<span class="fr-tab-badge">${requests.length}</span>` : ''}
          </button>
        </div>
      `;

      // Corps selon l'onglet
      let bodyHtml = '';

      if (tab === 'online') {
        const othersCount = onlinePeers.filter((p) => !p.isSelf).length;
        const peersCards = onlinePeers.map((p) => {
          const isSelf = p.isSelf;
          const sprSrc = ASSETS.trainer(p.gender === 'f' ? 'player_f' : 'player_m');
          let statusPill = '';
          if (isSelf) {
            statusPill = `<span class="fr-tag fr-tag-self">🟢 VOUS · ACTIF</span>`;
          } else if (p.pvp) {
            statusPill = `<span class="fr-tag fr-tag-pvp">⚔️ EN COMBAT PVP</span>`;
          } else if (p.busy) {
            statusPill = `<span class="fr-tag fr-tag-busy">⏳ OCCUPÉ</span>`;
          } else {
            statusPill = `<span class="fr-tag fr-tag-ready">🟢 DISPONIBLE</span>`;
          }

          return `
            <div class="fr-card${isSelf ? ' is-me' : ''}">
              <div class="fr-card-avatar-wrap">
                <img class="fr-card-avatar" src="${sprSrc}" alt="" onerror="this.style.display='none'">
                ${isSelf ? '<span class="fr-card-me-tag">MOI</span>' : ''}
              </div>
              <div class="fr-card-info">
                <div class="fr-card-head">
                  <span class="fr-card-name">${esc(p.name)}</span>
                  <span class="fr-card-gender ${p.gender || 'm'}">${p.gender === 'f' ? '♀' : '♂'}</span>
                  ${statusPill}
                  ${p.isFriend ? '<span class="fr-friend-badge">✓ AMI</span>' : ''}
                </div>
                <div class="fr-card-meta">
                  <span class="fr-card-loc">📍 <b>${esc(p.locName || 'Odyssée')}</b></span>
                </div>
              </div>
              <div class="fr-card-actions">
                ${isSelf ? `
                  <button type="button" class="fr-act-btn" data-act="my-card" title="Voir ma Carte de Dresseur">👁 MA FICHE</button>
                ` : p.pvp ? `
                  <button type="button" class="fr-act-btn fr-btn-observer" data-act="peer-spectate" data-peerid="${p.id}" title="Observer le combat en direct de ${esc(p.name)}">👁 OBSERVER</button>
                  <button type="button" class="fr-act-btn fr-btn-card" data-act="peer-card" data-peerid="${p.id}" title="Consulter la Carte de Dresseur de ${esc(p.name)}">👁 CARTE</button>
                ` : `
                  <button type="button" class="fr-act-btn fr-btn-card" data-act="peer-card" data-peerid="${p.id}" title="Consulter la Carte de Dresseur de ${esc(p.name)}">👁 CARTE</button>
                  <button type="button" class="fr-act-btn fr-btn-battle" data-act="peer-battle" data-peerid="${p.id}" title="Défier ${esc(p.name)} (1v1, 2v2, 3v3 ou 4J)">⚔️ COMBAT</button>
                  <button type="button" class="fr-act-btn fr-btn-trade" data-act="peer-trade" data-peerid="${p.id}" title="Proposer un échange Pokémon à ${esc(p.name)}">🔄 ÉCHANGE</button>
                  <button type="button" class="fr-act-btn fr-btn-domaine" data-act="peer-domaine" data-peerid="${p.id}" title="Visiter le Domaine de ${esc(p.name)}">🏡 DOMAINE</button>
                  ${p.isFriend ? '' : `
                    <button type="button" class="fr-act-btn fr-btn-add" data-act="peer-quick-add" data-peerid="${p.id}" title="Ajouter ${esc(p.name)} en ami">+ AMI</button>
                  `}
                `}
              </div>
            </div>
          `;
        }).join('');

        bodyHtml = `
          <div class="fr-tab-pane fr-pane-online">
            <div class="fr-pane-hdr">
              <span class="fr-pane-title">AUTRES DRESSEURS DANS CETTE SESSION D\'ODYSSÉE (${autresVus})</span>
              <span class="fr-pane-sub">Les dresseurs connectés au même salon se déplacent avec vous dans la région.</span>
            </div>
            <div class="fr-cards-grid">
              ${peersCards}
            </div>
            ${othersCount === 0 ? `
              <div class="fr-empty-callout">
                <div class="fr-empty-icon">📡</div>
                <div class="fr-empty-msg">
                  <b>Aucun autre dresseur dans ce salon pour le moment.</b>
                  <p>Partagez le lien de votre salon ou votre Code Ami (${formatFid(myCode)}) pour vous retrouver et explorer la région d\'Odyssée ensemble !</p>
                </div>
              </div>
            ` : ''}
          </div>
        `;
      } else if (tab === 'hub') {
        const freePeers = onlinePeers.filter((p) => !p.isSelf && !p.busy && !p.pvp).length;
        const allOthers = onlinePeers.filter((p) => !p.isSelf).length;
        const cards = [
          (() => {
            // le boss de raid de la région : rien à lancer d'ici, on va le trouver sur sa route
            const R = game.raidMonde?.courant;
            const c = creneau(), prochain = c.actif || Date.now() > c.fin ? creneau(c.k * RAID_PERIODE + RAID_PERIODE) : c;
            const h = new Date(prochain.debut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
            return {
              id: 'raid',
              icon: '💥',
              title: 'Boss de raid',
              req: 1,
              avail: R ? 1 : 0,
              badge: R ? `Là ! ${Math.max(1, Math.round((R.fin - Date.now()) / 60e3))} min` : `Prochain vers ${h}`,
              desc: R
                ? `${R.boss.title} est sur ${R.nom} ! Allez-y tous ensemble (de 2 à 4 joueurs) et parlez-lui pour lancer le raid en coop (5 essais).`
                : 'Un boss très fort, à l\'aura bleue, rouge ou dorée, surgit sur une route toutes les heures et demie quand des joueurs sont connectés, et repart au bout de 15 minutes. Il se bat en coop, de 2 à 4 joueurs.',
              reward: 'PDj · Super Bonbons · capture',
              btn: R ? 'Où est-il ?' : 'En attente',
            };
          })(),
          {
            id: 'multi4p',
            icon: '⚔️',
            title: 'Multi 2v2 (4 Joueurs)',
            req: 3,
            avail: freePeers,
            badge: freePeers >= 3 ? '✓ 4J prêts' : `${freePeers}/3 dispo`,
            desc: 'Vrai 2v2 à 4 humains connectés : 2 équipes de 2 dresseurs (1 actif + 1 réserve chacun).',
            reward: 'Match d\'équipe 2v2',
            btn: 'Créer le 2v2 (4J)',
          },
          {
            id: 'tournoi',
            icon: '🏆',
            title: 'Tournoi du Colisée',
            req: 0,
            avail: freePeers,
            badge: allOthers > 0 ? `✓ ${allOthers + 1}J + Champions` : '✓ Solo + Champions',
            desc: 'Arbre à 4 places (1v1 ou 2v2) complété par les Champions avec suivi en Mode Spectateur.',
            reward: 'Jusqu\'à 10 PDj · 15 000 ₽',
            btn: 'Ouvrir un Tournoi',
          },
          {
            id: 'dojo',
            icon: '🥋',
            title: 'Dojo de Mamadou Co-op',
            req: 1,
            avail: freePeers,
            badge: freePeers >= 1 ? `✓ ${freePeers} dispo` : '1-2 alliés requis',
            desc: 'Série tactique de 5 paliers en Duo (2v2) ou Trio (3v3) jusqu\'à Maître Mamadou (6e Badge requis).',
            reward: 'Points PDj · Boutique Dojo',
            btn: 'Lancer le Dojo',
          },
          {
            id: 'poker',
            icon: '🃏',
            title: 'Poker Hold\'em Multi',
            req: 1,
            avail: freePeers,
            badge: freePeers >= 1 ? `✓ ${freePeers} dispo` : '1-3 joueurs requis',
            desc: 'Table de Texas Hold\'em autour du tapis avec sièges rotatifs, IA en renfort et jetons de courtoisie.',
            reward: 'Jetons du Casino',
            btn: 'Ouvrir la Table',
          },
          {
            id: 'domaine',
            icon: '🏡',
            title: 'Visiter un Domaine Ami',
            req: 1,
            avail: allOthers,
            badge: allOthers >= 1 ? `✓ ${allOthers} connecté${allOthers > 1 ? 's' : ''}` : '1 ami requis',
            desc: 'Explorez le Domaine bâti d\'un ami, récupérez le Panier d\'accueil et défiez son Gardien.',
            reward: 'Baies Sitrus · Bois & Pierre',
            btn: 'Visiter un Domaine',
          },
        ];
        bodyHtml = `
          <div class="fr-tab-pane fr-pane-hub">
            <div class="fr-pane-hdr">
              <span class="fr-pane-title">SALON DES ACTIVITÉS MULTIJOUEURS (${freePeers} DRESSEUR${freePeers > 1 ? 'S' : ''} LIBRE${freePeers > 1 ? 'S' : ''})</span>
              <span class="fr-pane-sub">Lancez directement un 2v2 à 4 joueurs, un Tournoi, une partie de Poker ou une visite de Domaine.</span>
            </div>
            <div class="fr-hub-grid">
              ${cards.map((c) => {
                const ready = c.avail >= c.req;
                return `
                  <div class="fr-hub-card${ready ? ' is-ready' : ''}">
                    <div class="fr-hub-head">
                      <span class="fr-hub-title"><span>${c.icon}</span> ${esc(c.title)}</span>
                      <span class="fr-hub-badge ${ready ? 'ok' : 'wait'}">${esc(c.badge)}</span>
                    </div>
                    <p class="fr-hub-desc">${esc(c.desc)}</p>
                    <div class="fr-hub-foot">
                      <span class="fr-hub-reward">${esc(c.reward)}</span>
                      <button type="button" class="fr-hub-btn" data-act="hub-${c.id}">${esc(c.btn)}</button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      } else if (tab === 'friends') {
        const friendsCards = friendsList.map((f) => {
          const isOnline = f.isOnline;
          return `
            <div class="fr-card${isOnline ? ' is-online' : ' is-offline'}">
              <div class="fr-friend-avatar" style="--fc: ${f.color || '#3b82f6'};">
                <span>${esc((f.name || 'A')[0].toUpperCase())}</span>
              </div>
              <div class="fr-card-info">
                <div class="fr-card-head">
                  <span class="fr-card-name">${esc(f.name)}</span>
                  <span class="fr-friend-fid">${formatFid(f.fid)}</span>
                  <span class="fr-tag ${isOnline ? 'fr-tag-ready' : 'fr-tag-busy'}">
                    ${isOnline ? '🟢 EN LIGNE' : '⚪ HORS LIGNE'}
                  </span>
                </div>
                <div class="fr-card-meta">
                  <span class="fr-card-loc">
                    ${isOnline ? (f.roomCode ? `Connecté dans Odyssée · Salon #${esc(f.roomCode)}` : 'En ligne dans le Hub Arcadia') : 'Non connecté actuellement'}
                  </span>
                </div>
              </div>
              <div class="fr-card-actions">
                ${isOnline && f.roomCode ? `
                  <button type="button" class="fr-act-btn fr-btn-join" data-act="join-room" data-code="${esc(f.roomCode)}" title="Rejoindre le salon de ${esc(f.name)}">🚀 REJOINDRE</button>
                ` : ''}
                <button type="button" class="fr-act-btn fr-btn-invite" data-act="invite-friend" data-fid="${esc(f.fid)}" title="Envoyer une invitation de salon à ${esc(f.name)}">✉️ INVITER</button>
                <button type="button" class="fr-act-btn fr-btn-del" data-act="remove-friend" data-fid="${esc(f.fid)}" title="Supprimer ${esc(f.name)} de mes amis">🗑 RETIRER</button>
              </div>
            </div>
          `;
        }).join('');

        bodyHtml = `
          <div class="fr-tab-pane fr-pane-friends">
            <div class="fr-pane-hdr">
              <span class="fr-pane-title">MES AMIS ENREGISTRÉS (${friendsList.length})</span>
              <span class="fr-pane-sub">Voyez qui est connecté et rejoignez leur salon en un clic sans chercher de code.</span>
            </div>
            ${friendsList.length > 0 ? `
              <div class="fr-cards-grid">
                ${friendsCards}
              </div>
            ` : `
              <div class="fr-empty-callout">
                <div class="fr-empty-icon">👥</div>
                <div class="fr-empty-msg">
                  <b>Aucun ami enregistré pour le moment.</b>
                  <p>Allez dans l\'onglet <b>"AJOUTER UN AMI"</b> pour enregistrer le code ami de vos proches !</p>
                </div>
              </div>
            `}
          </div>
        `;
      } else if (tab === 'add') {
        const reqHtml = requests.map((r) => `
          <div class="fr-card is-req">
            <div class="fr-friend-avatar" style="--fc: ${r.color || '#eab308'};">
              <span>${esc((r.name || 'D')[0].toUpperCase())}</span>
            </div>
            <div class="fr-card-info">
              <div class="fr-card-head">
                <span class="fr-card-name">${esc(r.name)}</span>
                <span class="fr-friend-fid">${formatFid(r.fid)}</span>
                <span class="fr-tag fr-tag-pvp">DEMANDE REÇUE</span>
              </div>
              <div class="fr-card-meta">
                <span class="fr-card-loc">Ce dresseur vous a envoyé une demande d\'amitié !</span>
              </div>
            </div>
            <div class="fr-card-actions">
              <button type="button" class="fr-act-btn fr-btn-accept" data-act="accept-req" data-fid="${esc(r.fid)}" title="Accepter la demande">✓ ACCEPTER</button>
              <button type="button" class="fr-act-btn fr-btn-del" data-act="decline-req" data-fid="${esc(r.fid)}" title="Refuser la demande">✕ REFUSER</button>
            </div>
          </div>
        `).join('');

        bodyHtml = `
          <div class="fr-tab-pane fr-pane-add">
            <div class="fr-add-box">
              <div class="fr-pane-title">AJOUTER UN AMI PAR CODE</div>
              <div class="fr-pane-sub">Entrez le Code Ami à 8 caractères fourni par l\'autre joueur (ex: ABCD-1234).</div>
              <div class="fr-add-form">
                <input type="text" class="fr-code-input" placeholder="EX: A1B2-C3D4" maxlength="9" value="${esc(addCodeInput)}" autofocus>
                <button type="button" class="fr-submit-btn" data-act="submit-add">➕ ENVOYER LA DEMANDE</button>
              </div>
            </div>

            ${requests.length > 0 ? `
              <div class="fr-req-section">
                <div class="fr-pane-title">DEMANDES D\'AMIS EN ATTENTE (${requests.length})</div>
                <div class="fr-cards-grid">
                  ${reqHtml}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }

      // Pied de page
      const footHtml = `
        <div class="fr-foot">
          <div class="fr-foot-hints">
            <span class="fr-key-pill"><kbd>◄</kbd> <kbd>►</kbd> Changer d\'onglet</span>
            <span class="fr-key-pill"><kbd>▲</kbd> <kbd>▼</kbd> Naviguer</span>
            <span class="fr-key-pill"><kbd>Espace</kbd> / <kbd>Entrée</kbd> Valider l\'action</span>
            <span class="fr-key-pill"><kbd>Échap</kbd> Fermer</span>
          </div>
          <button type="button" class="fr-foot-close" data-act="close">Fermer</button>
        </div>
      `;

      s.innerHTML = `
        <div class="b2w2-friends-casing">
          <img class="fr-pixelart-bg" src="${ASSETS.carteBg}" alt="">
          <div class="fr-scanlines"></div>
          ${headerHtml}
          ${myCodeHtml}
          ${tabsHtml}
          <div class="fr-body-container">
            ${bodyHtml}
          </div>
          ${footHtml}
        </div>
      `;

      // Brancher événements souris / clics
      s.querySelectorAll('[data-act="close"]').forEach((b) => (b.onclick = close));

      s.querySelectorAll('[data-act="copy-code"]').forEach((b) => (b.onclick = copyCode));

      s.querySelector('[data-act="tab-online"]')?.addEventListener('click', () => {
        tab = 'online';
        focusIdx = -1;
        ui.sound?.sfx('select');
        render();
      });
      s.querySelector('[data-act="tab-hub"]')?.addEventListener('click', () => {
        tab = 'hub';
        focusIdx = -1;
        ui.sound?.sfx('select');
        render();
      });
      s.querySelector('[data-act="tab-friends"]')?.addEventListener('click', () => {
        tab = 'friends';
        focusIdx = -1;
        ui.sound?.sfx('select');
        render();
      });
      s.querySelector('[data-act="tab-add"]')?.addEventListener('click', () => {
        tab = 'add';
        focusIdx = -1;
        ui.sound?.sfx('select');
        render();
      });

      // Actions sur les pairs
      s.querySelectorAll('[data-act="my-card"]').forEach((b) => {
        b.onclick = async () => {
          try {
            await cardScreen(game, BADGES);
          } catch (e) {}
        };
      });

      s.querySelectorAll('[data-act="peer-card"]').forEach((b) => {
        b.onclick = async () => {
          const pid = b.dataset.peerid;
          const peer = onlinePeers.find((q) => String(q.id) === String(pid));
          if (!peer || !peer.peerObj) {
            setNotice('Dresseur introuvable ou déconnecté.', 'err');
            return;
          }
          try {
            if (game.showPeerCard) await game.showPeerCard(peer.peerObj);
            else setNotice(`Fiche de ${peer.name} inaccessible.`, 'err');
          } catch (e) {
            setNotice(`Erreur : ${e.message || e}`, 'err');
          }
        };
      });

      const launchDirect = async (fn) => {
        close();
        try { await fn(); } catch (e) { console.error(e); }
      };

      s.querySelectorAll('[data-act="peer-spectate"]').forEach((b) => {
        b.onclick = async () => {
          const pid = b.dataset.peerid;
          const peer = onlinePeers.find((q) => String(q.id) === String(pid));
          if (!peer?.pvp) return setNotice('Combat introuvable ou terminé.', 'err');
          await launchDirect(async () => {
            const { spectateSession } = await import('../../net/social.js');
            await spectateSession(game, peer.pvp.hostId || peer.id, peer.pvp.rid, peer.name, peer.pvp.foeName || 'Adversaire');
          });
        };
      });

      s.querySelectorAll('[data-act="peer-battle"], [data-act="peer-trade"], [data-act="peer-domaine"]').forEach((b) => {
        b.onclick = async () => {
          const pid = b.dataset.peerid;
          const act = b.dataset.act;
          const peer = onlinePeers.find((q) => String(q.id) === String(pid));
          if (!peer || !peer.peerObj) {
            setNotice('Dresseur introuvable ou déconnecté.', 'err');
            return;
          }
          if (act === 'peer-domaine') {
            await launchDirect(async () => (await import('../domaine.js')).visiterDomaineAmi(game, peer.peerObj));
          } else if (game.talkToPeer) {
            await launchDirect(async () => game.talkToPeer(peer.peerObj, act === 'peer-trade' ? 'trade' : 'battle'));
          } else {
            setNotice('Fonctionnalité réseau inactive dans ce mode.', 'err');
          }
        };
      });

      const hubActions = {
        'hub-raid': async () => { const R = game.raidMonde?.courant; if (R) await game.ui.say(`${R.boss.title} attend sur ${R.nom}. Il faut que tous les joueurs connectés le rejoignent pour lancer le raid !`); },
        'hub-multi4p': async () => (await import('../../multi-events.js')).lancerMulti4p(game),
        'hub-tournoi': async () => (await import('../../multi-events.js')).lancerTournoiSalon(game),
        'hub-dojo': async () => (await import('../../dojo-mamadou.js')).lancerDefiDojoCoop(game),
        'hub-poker': async () => (await import('../casino/poker.js')).pokerTableMulti(game),
        'hub-domaine': async () => (await import('../domaine.js')).visiterDomaineAmi(game),
      };
      for (const [act, handler] of Object.entries(hubActions)) {
        const btn = s.querySelector(`[data-act="${act}"]`);
        if (btn) btn.onclick = () => launchDirect(handler);
      }

      s.querySelectorAll('[data-act="peer-quick-add"]').forEach((b) => {
        b.onclick = async () => {
          const pid = b.dataset.peerid;
          const peer = onlinePeers.find((q) => String(q.id) === String(pid));
          if (!peer) return;
          try {
            const targetCode = peer.fid || peer.name;
            await mgr.addFriend(targetCode);
            setNotice(`Demande d\'ami envoyée à ${peer.name} !`, 'ok');
          } catch (e) {
            setNotice(`Erreur : ${e.message}`, 'err');
          }
        };
      });

      // Formulaire ajout
      const inputEl = s.querySelector('.fr-code-input');
      if (inputEl) {
        inputEl.oninput = (e) => {
          addCodeInput = e.target.value.toUpperCase();
        };
        if (hadFocus) { inputEl.focus(); try { inputEl.setSelectionRange(caret, caret); } catch (e) {} }
        inputEl.onkeydown = (e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            s.querySelector('[data-act="submit-add"]')?.click();
          } else if (e.key === 'Escape') {
            close();
          }
        };
      }

      s.querySelector('[data-act="submit-add"]')?.addEventListener('click', async () => {
        if (!addCodeInput.trim()) {
          setNotice('Veuillez entrer un code ami.', 'err');
          return;
        }
        try {
          await mgr.addFriend(addCodeInput);
          setNotice(`Demande envoyée pour le code ${formatFid(addCodeInput)} !`, 'ok');
          addCodeInput = '';
          render();
        } catch (e) {
          setNotice(`Erreur : ${e.message}`, 'err');
        }
      });

      // Actions demandes reçues
      s.querySelectorAll('[data-act="accept-req"]').forEach((b) => {
        b.onclick = async () => {
          const fid = b.dataset.fid;
          await mgr.acceptRequest(fid);
          setNotice('Ami accepté avec succès !', 'ok');
        };
      });
      s.querySelectorAll('[data-act="decline-req"]').forEach((b) => {
        b.onclick = async () => {
          const fid = b.dataset.fid;
          await mgr.declineRequest(fid);
          setNotice('Demande d\'ami refusée.', 'info');
        };
      });

      // Actions liste amis
      s.querySelectorAll('[data-act="remove-friend"]').forEach((b) => {
        b.onclick = async () => {
          const fid = b.dataset.fid;
          await mgr.removeFriend(fid);
          setNotice('Ami retiré de votre liste.', 'info');
        };
      });
      s.querySelectorAll('[data-act="invite-friend"]').forEach((b) => {
        b.onclick = async () => {
          const fid = b.dataset.fid;
          const ok = await mgr.inviteFriend(fid);
          if (ok) setNotice('Invitation de salon envoyée !', 'ok');
          else setNotice('Impossible d\'envoyer l\'invitation.', 'err');
        };
      });
      s.querySelectorAll('[data-act="join-room"]').forEach((b) => {
        b.onclick = () => {
          const code = b.dataset.code;
          if (code) {
            close();
            mgr.joinRoom(code);
          }
        };
      });
    };

    const close = closer(ui, s, () => pop, resolve, 'cancel', () => {
      clearInterval(heartbeatTimer);
      mgr.off('change', onMgrChange);
    });

    const onMgrChange = () => render();
    mgr.on('change', onMgrChange);
    // rafraîchit la liste des connectés, mais pas pendant qu'on tape un code
    const heartbeatTimer = setInterval(() => {
      if (document.activeElement?.classList?.contains('fr-code-input')) return;
      render();
    }, 3000);

    let focusIdx = -1;
    const focusables = () => [...s.querySelectorAll('.fr-hub-btn, .fr-act-btn, .fr-submit-btn, .fr-copy-btn')].filter((b) => !b.disabled);
    const syncFocus = () => {
      const items = focusables();
      items.forEach((b) => b.classList?.remove('fr-kb-focus'));
      if (!items.length) { focusIdx = -1; return null; }
      if (focusIdx >= items.length) focusIdx = items.length - 1;
      if (focusIdx < 0) return null;
      const cur = items[focusIdx];
      cur.classList?.add('fr-kb-focus');
      cur.scrollIntoView?.({ block: 'nearest' });
      return cur;
    };

    const tabsOrder = ['online', 'hub', 'friends', 'add'];
    const switchTab = (nextTab) => {
      tab = nextTab;
      focusIdx = -1;
      ui.sound?.sfx('select');
      render();
    };
    const pop = ui.input.push((k) => {
      if (k === 'b') {
        close();
      } else if (k === 'left') {
        const i = tabsOrder.indexOf(tab);
        if (i > 0) switchTab(tabsOrder[i - 1]);
      } else if (k === 'right') {
        const i = tabsOrder.indexOf(tab);
        if (i < tabsOrder.length - 1) switchTab(tabsOrder[i + 1]);
      } else if (k === 'up' || k === 'down') {
        const items = focusables();
        if (!items.length) return;
        focusIdx = focusIdx < 0
          ? (k === 'down' ? 0 : items.length - 1)
          : (focusIdx + (k === 'down' ? 1 : -1) + items.length) % items.length;
        ui.sound?.sfx('blip');
        syncFocus();
      } else if (k === 'a') {
        // NON-DESTRUCTIF : Espace / Entrée active l'élément ciblé sans fermer l'écran
        const items = focusables();
        const target = (focusIdx >= 0 && items[focusIdx]) || items[0] || s.querySelector('.fr-tab.active');
        if (target && target.dataset?.act !== 'close') {
          ui.sound?.sfx('select');
          if (items.length && (focusIdx >= 0 || target.dataset?.act !== 'copy-code')) {
            target.click?.();
          }
        }
      }
    });

    render();
  });
}
