// pokemon/adventure/adventure.js
// Contrôleur principal de l'Aventure Kalos-Sud (Menton).
// Boucle de jeu 60 FPS, entrées clavier / tactile, interactions avec les lieux
// de Menton (Laboratoire, Citronniers, Centre Pokémon), transitions de combat sauvage.

import { createMentonMap, isSolid, getTile, TILE, MAP_WIDTH, MAP_HEIGHT } from './map.js';
import {
  loadPlayerData,
  savePlayerData,
  giveStarter,
  healParty,
  addItem,
  addPokemonToPlayer,
  getFirstAlivePokemon
} from './player.js';
import { AdventureRenderer } from './renderer.js';
import { rollWildEncounter, STARTER_OPTIONS, ITEMS, spriteUrls } from './data.js';
import { startAdventureBattle } from './battle.js';
import { createAdventureNetwork } from './net.js';

export function mountAdventure(root, { me, bridge, settings, exit }) {
  let player = loadPlayerData(me.name, me.color);
  me.x = player.x;
  me.y = player.y;
  me.dir = player.dir;

  const grid = createMentonMap();

  let state = 'overworld'; // 'overworld', 'battle', 'starter_modal', 'menu_bag', 'pc_modal'
  let activeDialogue = null;
  let dialogueCallback = null;

  // DOM de base pour l'aventure
  root.innerHTML = `
    <div class="adv-container">
      <canvas id="advCanvas" class="adv-canvas"></canvas>
      <div id="advBattleLayer" class="adv-battle-layer" style="display: none;"></div>
      <div id="advModalLayer" class="adv-modal-layer" style="display: none;"></div>

      <!-- Commandes tactiles mobiles (D-pad + boutons A & B) -->
      <div class="adv-touch-controls" id="touchControls">
        <div class="adv-dpad">
          <button class="adv-dpad-btn up" data-dir="up">▲</button>
          <div class="adv-dpad-mid">
            <button class="adv-dpad-btn left" data-dir="left">◀</button>
            <div class="adv-dpad-center"></div>
            <button class="adv-dpad-btn right" data-dir="right">▶</button>
          </div>
          <button class="adv-dpad-btn down" data-dir="down">▼</button>
        </div>
        <div class="adv-action-btns">
          <button class="adv-btn-circle btn-b" id="touchBtnB">SAC</button>
          <button class="adv-btn-circle btn-a" id="touchBtnA">A</button>
        </div>
      </div>

      <!-- Boutons rapides en haut à droite -->
      <div class="adv-top-actions">
        <button class="adv-top-btn" id="btnMenuBag">Sac & Équipe</button>
        <button class="adv-top-btn" id="btnExitHub">Quitter</button>
      </div>
    </div>
  `;

  const canvas = root.querySelector('#advCanvas');
  const battleLayer = root.querySelector('#advBattleLayer');
  const modalLayer = root.querySelector('#advModalLayer');
  const renderer = new AdventureRenderer(canvas);

  function resizeCanvas() {
    renderer.resize(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  // Position visuelle avec interpolation pour fluidité
  player.visualX = player.x;
  player.visualY = player.y;

  // Réseau multijoueur
  const net = createAdventureNetwork({
    bridge,
    me,
    onRemoteUpdate: () => {},
    onDuelRequest: ({ fromId, fromName }) => {
      if (confirm(`Le dresseur ${fromName} vous défie en duel Pokémon ! Accepter ?`)) {
        const alivePoke = getFirstAlivePokemon(player.party);
        if (!alivePoke) {
          alert('Tous vos Pokémon sont K.O. ! Allez d\'abord les soigner au Centre Pokémon.');
          net.sendDuelDecline(fromId);
          return;
        }
        net.sendDuelAccept(fromId, alivePoke);
      } else {
        net.sendDuelDecline(fromId);
      }
    },
    onDuelStart: ({ opponentId, opponentPokemon }) => {
      launchBattle(opponentPokemon, false);
    }
  });

  net.broadcastJoin(player);

  // Clavier & Contrôles
  const keysDown = new Set();
  let isMoving = false;
  let moveProgress = 0;
  let startTileX = player.x;
  let startTileY = player.y;
  let targetTileX = player.x;
  let targetTileY = player.y;

  window.addEventListener('keydown', (e) => {
    if (state !== 'overworld' && state !== 'dialogue') return;
    if (e.repeat) return;

    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleActionKey();
      return;
    }

    if (e.key.toLowerCase() === 'e') {
      e.preventDefault();
      handleActionKey();
      return;
    }

    if (e.key.toLowerCase() === 'b' || e.key === 'Escape') {
      e.preventDefault();
      if (modalLayer.style.display === 'block') {
        closeModal();
      } else {
        openBagModal();
      }
      return;
    }

    keysDown.add(e.key.toLowerCase());
  });

  window.addEventListener('keyup', (e) => {
    keysDown.delete(e.key.toLowerCase());
  });

  // Touch controls
  const touchBtns = root.querySelectorAll('.adv-dpad-btn');
  touchBtns.forEach(btn => {
    const dir = btn.dataset.dir;
    const start = (e) => { e.preventDefault(); keysDown.add(dir); };
    const end = (e) => { e.preventDefault(); keysDown.delete(dir); };
    btn.addEventListener('touchstart', start);
    btn.addEventListener('touchend', end);
    btn.addEventListener('mousedown', start);
    btn.addEventListener('mouseup', end);
  });

  root.querySelector('#touchBtnA').onclick = () => handleActionKey();
  root.querySelector('#touchBtnB').onclick = () => openBagModal();
  root.querySelector('#btnMenuBag').onclick = () => openBagModal();
  root.querySelector('#btnExitHub').onclick = () => {
    if (confirm('Voulez-vous retourner au Hub Duo-Drift ?')) {
      if (exit) exit();
      else location.reload();
    }
  };

  // Première visite : si pas de starter, dialogue d'accueil
  if (!player.hasStarter) {
    showDialogue(
      'Professeur Platane',
      'Bienvenue à Menton, la perle de la Côte d\'Azur !\nApproche-toi de la table du laboratoire pour choisir ton premier Pokémon !'
    );
  }

  // --- BOUCLE DE JEU 60 FPS ---
  let lastTime = performance.now();
  let encounterCooldown = 0;

  function gameLoop(now) {
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (state === 'overworld' || state === 'dialogue') {
      updateMovement(dt);
      net.updateInterpolation();

      // Détection de l'objet ou joueur interactif en face
      const frontPos = getFrontTile(player.x, player.y, player.dir);
      const target = getInteractiveTarget(frontPos.x, frontPos.y);

      // Nom de la zone actuelle
      const zoneName = player.y > 23 ? 'Plage des Sablettes (Bord de mer)' :
                       (player.x > 22 ? 'Route 1 Corniche (Hauts de Menton)' : 'Menton - La Cité des Citrons');

      renderer.render({
        grid,
        localPlayer: player,
        remotePlayers: net.getPlayersList(),
        interactiveTarget: target,
        dialogueBox: activeDialogue,
        activeZoneName: zoneName
      });
    }

    requestAnimationFrame(gameLoop);
  }

  requestAnimationFrame(gameLoop);

  // --- DÉPLACEMENTS CASE PAR CASE (STYLE GBA) ---
  function updateMovement(dt) {
    const isRunning = keysDown.has('shift');
    const moveSpeed = isRunning ? 6.5 : 4.2; // Cases par seconde

    if (isMoving) {
      moveProgress += dt * moveSpeed;
      if (moveProgress >= 1.0) {
        // Déplacement terminé sur la case cible
        player.x = targetTileX;
        player.y = targetTileY;
        player.visualX = player.x;
        player.visualY = player.y;
        player.moving = false;
        isMoving = false;
        moveProgress = 0;

        // Sauvegarder la position
        me.x = player.x;
        me.y = player.y;
        me.dir = player.dir;
        savePlayerData(player);
        net.broadcastPos(player);

        // Vérification de rencontre sauvage dans les hautes herbes
        checkWildEncounter();
      } else {
        // Interpolation de la position
        player.visualX = startTileX + (targetTileX - startTileX) * moveProgress;
        player.visualY = startTileY + (targetTileY - startTileY) * moveProgress;
        player.moving = true;
      }
    } else if (state === 'overworld') {
      // Vérifier les touches directionnelles
      let wantedDir = null;
      if (keysDown.has('arrowup') || keysDown.has('w') || keysDown.has('z') || keysDown.has('up')) wantedDir = 'up';
      else if (keysDown.has('arrowdown') || keysDown.has('s') || keysDown.has('down')) wantedDir = 'down';
      else if (keysDown.has('arrowleft') || keysDown.has('a') || keysDown.has('q') || keysDown.has('left')) wantedDir = 'left';
      else if (keysDown.has('arrowright') || keysDown.has('d') || keysDown.has('right')) wantedDir = 'right';

      if (wantedDir) {
        player.dir = wantedDir;
        me.dir = wantedDir;
        const target = getFrontTile(player.x, player.y, wantedDir);

        if (!isSolid(grid, target.x, target.y)) {
          // Case libre : début du mouvement
          startTileX = player.x;
          startTileY = player.y;
          targetTileX = target.x;
          targetTileY = target.y;
          isMoving = true;
          moveProgress = 0;
          player.moving = true;
          net.broadcastPos(player);
        } else {
          // Bloqué par un obstacle : on pivote simplement
          net.broadcastPos(player);
        }
      }
    }
  }

  function getFrontTile(x, y, dir) {
    if (dir === 'up') return { x, y: y - 1 };
    if (dir === 'down') return { x, y: y + 1 };
    if (dir === 'left') return { x: x - 1, y };
    if (dir === 'right') return { x: x + 1, y };
    return { x, y };
  }

  function getInteractiveTarget(fx, fy) {
    const tile = getTile(grid, fx, fy);
    if (tile === TILE.LEMON_TREE) return { x: fx, y: fy, label: 'Cueillir Citron' };
    if (tile === TILE.LAB_TABLE) return { x: fx, y: fy, label: player.hasStarter ? 'Examiner' : 'Choisir Starter' };
    if (tile === TILE.NURSE_DESK) return { x: fx, y: fy, label: 'Soigner l\'équipe' };
    if (tile === TILE.PC_BOX) return { x: fx, y: fy, label: 'Ouvrir PC' };

    // Joueur distant à portée
    const peer = net.getPlayersList().find(p => p.x === fx && p.y === fy);
    if (peer) return { x: fx, y: fy, label: `Duel contre ${peer.name}` };

    return null;
  }

  // --- RENCONTRES SAUVAGES ---
  function checkWildEncounter() {
    if (!player.hasStarter) return; // Pas de rencontre sans Pokémon
    if (encounterCooldown > 0) {
      encounterCooldown--;
      return;
    }

    const currentTile = getTile(grid, player.x, player.y);
    if (currentTile === TILE.GRASS_TALL) {
      // 15% de chance d'apparition par pas dans les hautes herbes
      if (Math.random() < 0.15) {
        encounterCooldown = 4;
        const wild = rollWildEncounter('grass');
        launchBattle(wild, true);
      }
    } else if (currentTile === TILE.SAND && player.y >= 26) {
      // 8% de chance au bord de l'eau
      if (Math.random() < 0.08) {
        encounterCooldown = 5;
        const wild = rollWildEncounter('water');
        launchBattle(wild, true);
      }
    }
  }

  function launchBattle(opponentPoke, isWild = true) {
    const alivePoke = getFirstAlivePokemon(player.party);
    if (!alivePoke) {
      showDialogue('Attention', 'Tous vos Pokémon sont K.O. ! Visitez le Centre Pokémon pour les remettre sur pied.');
      return;
    }

    state = 'battle';
    battleLayer.style.display = 'block';

    startAdventureBattle(battleLayer, {
      player,
      opponentPokemon: opponentPoke,
      isWild,
      onEnd: ({ result, caughtPokemon }) => {
        battleLayer.style.display = 'none';
        state = 'overworld';

        if (result === 'caught' && caughtPokemon) {
          const res = addPokemonToPlayer(player, caughtPokemon);
          showDialogue(
            'Félicitations !',
            `${caughtPokemon.name} a été ajouté à votre ${res.location === 'party' ? 'équipe' : 'boîte PC'} !`
          );
        } else if (result === 'lost') {
          // Téléportation devant le Centre Pokémon et soin complet
          player.x = 17;
          player.y = 8;
          player.dir = 'down';
          player.visualX = 17;
          player.visualY = 8;
          healParty(player);
          showDialogue('Infirmière Joëlle', 'Vous avez été rapatrié en urgence ! Vos Pokémon sont entièrement rétablis.');
        }

        savePlayerData(player);
      }
    });
  }

  // --- ACTIONS DU JOUEUR ---
  function handleActionKey() {
    if (activeDialogue) {
      activeDialogue = null;
      if (dialogueCallback) {
        const cb = dialogueCallback;
        dialogueCallback = null;
        cb();
      }
      return;
    }

    const front = getFrontTile(player.x, player.y, player.dir);
    const tile = getTile(grid, front.x, front.y);

    // 1. Cueillir un Citron de Menton
    if (tile === TILE.LEMON_TREE) {
      const key = `${front.x},${front.y}`;
      const cd = player.lemonCooldowns ? player.lemonCooldowns[key] : 0;
      if (!cd || Date.now() > cd) {
        if (!player.lemonCooldowns) player.lemonCooldowns = {};
        player.lemonCooldowns[key] = Date.now() + 30000; // 30 secondes de repousse
        addItem(player, 'citron_menton', 1);
        player.stats.lemonsPicked = (player.stats.lemonsPicked || 0) + 1;
        savePlayerData(player);
        showDialogue('Citronnier de Menton', 'Vous cueillez un magnifique Citron de Menton gorgé de soleil !\nIl soigne 30 PV et toutes les altérations d\'état.');
      } else {
        const remaining = Math.ceil((cd - Date.now()) / 1000);
        showDialogue('Citronnier de Menton', `De nouveaux citrons sont en train de mûrir... (Disponible dans ${remaining} s)`);
      }
      return;
    }

    // 2. Table du Laboratoire (Starters)
    if (tile === TILE.LAB_TABLE) {
      if (!player.hasStarter) {
        openStarterModal();
      } else {
        showDialogue('Laboratoire Pokémon', 'C\'est la table où tu as choisi ton tout premier compagnon d\'aventure !');
      }
      return;
    }

    // 3. Infirmière Joëlle au Centre Pokémon
    if (tile === TILE.NURSE_DESK) {
      const healed = healParty(player);
      showDialogue(
        'Infirmière Joëlle',
        `Bonjour ! Bienvenue au Centre Pokémon de Menton.\nVos Pokémon ont retrouvé toute leur énergie ! Bon voyage à Kalos-Sud !`
      );
      return;
    }

    // 4. Terminal PC
    if (tile === TILE.PC_BOX) {
      openPCModal();
      return;
    }

    // 5. Duel avec un joueur multijoueur
    const peer = net.getPlayersList().find(p => p.x === front.x && p.y === front.y);
    if (peer) {
      showDialogue(peer.name, `Vous proposez un duel Pokémon à ${peer.name} ! En attente de sa réponse...`);
      net.sendDuelRequest(peer.id);
      return;
    }
  }

  function showDialogue(speaker, text, callback = null) {
    activeDialogue = { speaker, text };
    dialogueCallback = callback;
  }

  // --- MODALES (STARTERS, SAC, PC) ---
  function openStarterModal() {
    state = 'starter_modal';
    modalLayer.style.display = 'block';
    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <h2>Choisissez votre Pokémon de départ</h2>
          <p>Le Professeur Platane vous confie un compagnon pour votre périple sur la Côte d'Azur !</p>
        </div>
        <div class="adv-starters-grid">
          ${STARTER_OPTIONS.map(st => `
            <div class="adv-starter-card" data-id="${st.id}">
              <img src="${spriteUrls(st.id).front}" alt="${st.name}" class="st-img">
              <div class="st-name">${st.name}</div>
              <div class="st-type type-${st.type}">${st.type.toUpperCase()}</div>
              <div class="st-desc">${st.desc}</div>
              <button class="adv-btn st-choose-btn">Choisir ${st.name}</button>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    modalLayer.querySelectorAll('.st-choose-btn').forEach(btn => {
      btn.onclick = (e) => {
        const card = e.target.closest('.adv-starter-card');
        const stId = parseInt(card.dataset.id, 10);
        const starter = giveStarter(player, stId);
        closeModal();
        showDialogue(
          'Professeur Platane',
          `Prends grand soin de ${starter.name} !\nTu as reçu 5 Poké Balls et des Potions pour commencer ton voyage !`
        );
      };
    });
  }

  function openBagModal() {
    state = 'menu_bag';
    modalLayer.style.display = 'block';
    const inv = player.inventory || {};
    const itemsList = Object.entries(inv).map(([key, count]) => {
      const def = ITEMS[key] || { name: key, desc: '' };
      return { key, count, ...def };
    });

    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <h2>Sac & Équipe Pokémon</h2>
          <p>Dresseur : <strong>${player.name}</strong> | Argent : <strong>${player.money || 0} ₽</strong></p>
        </div>

        <div class="adv-bag-sections">
          <!-- Équipe (max 6) -->
          <div class="adv-section-col">
            <h3>Mon Équipe (${player.party.length}/6)</h3>
            <div class="adv-party-cards">
              ${player.party.length === 0 ? '<div class="adv-empty">Aucun Pokémon pour le moment.</div>' : ''}
              ${player.party.map(p => `
                <div class="adv-poke-card ${p.fainted ? 'fainted' : ''}">
                  <img src="${spriteUrls(p.id).icon}" alt="${p.name}" class="poke-icon">
                  <div class="poke-info">
                    <div class="pi-title">${p.name} <span class="pi-lv">N.${p.level}</span></div>
                    <div class="pi-hp-bar">
                      <div class="pi-hp-fill" style="width: ${(p.currentHp / p.maxHp) * 100}%"></div>
                    </div>
                    <div class="pi-hp-val">${p.currentHp} / ${p.maxHp} PV</div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Inventaire -->
          <div class="adv-section-col">
            <h3>Mon Sac</h3>
            <div class="adv-inventory-cards">
              ${itemsList.length === 0 ? '<div class="adv-empty">Votre sac est vide.</div>' : ''}
              ${itemsList.map(it => `
                <div class="adv-item-row-card">
                  <div class="it-title">${it.name} <span class="it-qty">x${it.count}</span></div>
                  <div class="it-sub">${it.desc}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="adv-modal-footer">
          <button class="adv-btn btn-secondary" id="btnCloseModal">Fermer [Échap]</button>
        </div>
      </div>
    `;

    modalLayer.querySelector('#btnCloseModal').onclick = () => closeModal();
  }

  function openPCModal() {
    state = 'pc_modal';
    modalLayer.style.display = 'block';
    const box = player.box || [];

    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <h2>Système de Stockage PC de Menton</h2>
          <p>Pokémon stockés dans la boîte : <strong>${box.length}</strong></p>
        </div>
        <div class="adv-pc-grid">
          ${box.length === 0 ? '<div class="adv-empty">La boîte PC est vide. Capturez des Pokémon sauvages !</div>' : ''}
          ${box.map((p, i) => `
            <div class="adv-pc-slot" data-idx="${i}">
              <img src="${spriteUrls(p.id).icon}" alt="${p.name}">
              <div>${p.name}</div>
              <small>N.${p.level}</small>
            </div>
          `).join('')}
        </div>
        <div class="adv-modal-footer">
          <button class="adv-btn btn-secondary" id="btnClosePC">Quitter le PC</button>
        </div>
      </div>
    `;

    modalLayer.querySelector('#btnClosePC').onclick = () => closeModal();
  }

  function closeModal() {
    modalLayer.style.display = 'none';
    state = 'overworld';
  }

  return {
    destroy: () => {
      window.removeEventListener('resize', resizeCanvas);
    }
  };
}
