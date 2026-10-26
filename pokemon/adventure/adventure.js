// pokemon/adventure/adventure.js
// Contrôleur principal de l'Aventure Kalos-Sud (Menton).
// Boucle de jeu 60 FPS, entrées clavier / tactile, Pokémon suiveur, Pokémon sauvages visibles,
// dresseurs PNJ, Arène de Menton, Boutique Pokémon, PC interactif, Pokédex et duels JcJ.

import { createMentonMap, isSolid, getTile, TILE, SIGNPOSTS } from './map.js';
import {
  loadPlayerData,
  savePlayerData,
  giveStarter,
  healParty,
  addItem,
  buyItem,
  useItemOutsideBattle,
  setLeadPokemon,
  depositToBox,
  withdrawFromBox,
  addPokemonToPlayer,
  getFirstAlivePokemon,
  registerSeen
} from './player.js';
import { AdventureRenderer } from './renderer.js';
import {
  BASE_SPECIES,
  rollWildEncounter,
  STARTER_OPTIONS,
  ITEMS,
  ADVENTURE_TRAINERS,
  createTrainerParty,
  spriteUrls
} from './data.js';
import { startAdventureBattle } from './battle.js';
import { createAdventureNetwork } from './net.js';
import { sfx } from '../view/sfx.js';

export function mountAdventure(root, { me, bridge, settings, exit, onSwitchMode }) {
  let player = loadPlayerData(me.name, me.color);
  if (player.prevX === undefined) {
    player.prevX = player.x;
    player.prevY = player.y - 1;
  }
  player.followerX = player.prevX;
  player.followerY = player.prevY;

  me.x = player.x;
  me.y = player.y;
  me.prevX = player.prevX;
  me.prevY = player.prevY;
  me.dir = player.dir;
  me.avatar = player.avatar || 'red';
  me.leadPokeId = player.party && player.party[0] ? player.party[0].id : null;

  const grid = createMentonMap();

  let state = 'overworld'; // 'overworld', 'battle', 'starter_modal', 'menu_bag', 'pc_modal', 'mart_modal', 'dex_modal', 'transition'
  let activeDialogue = null;
  let dialogueCallback = null;
  let destroyed = false;
  let rafId = null;

  // Pokémon sauvages visibles sur la carte
  let roamingWilds = [];
  function spawnRoamingWilds() {
    const spots = [
      { x: 32, y: 7, zone: 'grass' },
      { x: 25, y: 8, zone: 'grass' },
      { x: 29, y: 15, zone: 'grass' },
      { x: 20, y: 26, zone: 'water' }
    ];
    roamingWilds = spots.map(sp => {
      const poke = rollWildEncounter(sp.zone);
      return {
        x: sp.x,
        y: sp.y,
        zone: sp.zone,
        id: poke.id,
        pokemon: poke
      };
    });
  }
  spawnRoamingWilds();

  // DOM de base pour l'aventure
  root.innerHTML = `
    <div class="adv-container">
      <canvas id="advCanvas" class="adv-canvas"></canvas>
      <div id="advTransitionLayer" class="adv-transition-layer" style="display: none;"></div>
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

      <!-- Boutons rapides en haut -->
      <div class="adv-top-actions">
        <button class="adv-top-btn" id="btnMenuBag">Sac & Équipe [B]</button>
        <button class="adv-top-btn" id="btnMenuDex">Pokédex & Badges</button>
        <button class="adv-top-btn adv-mode-btn" id="btnSwitchTournament">Mode : Tournoi 3v3</button>
        <button class="adv-top-btn" id="btnExitHub">Hub</button>
      </div>
    </div>
  `;

  const canvas = root.querySelector('#advCanvas');
  const transitionLayer = root.querySelector('#advTransitionLayer');
  const battleLayer = root.querySelector('#advBattleLayer');
  const modalLayer = root.querySelector('#advModalLayer');
  const renderer = new AdventureRenderer(canvas);

  function resizeCanvas() {
    renderer.resize(root.clientWidth || window.innerWidth, root.clientHeight || window.innerHeight);
  }
  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();

  player.visualX = player.x;
  player.visualY = player.y;

  // Réseau multijoueur
  const net = createAdventureNetwork({
    bridge,
    me,
    onRemoteUpdate: () => {},
    onDuelRequest: ({ fromId, fromName }) => {
      if (state !== 'overworld') {
        net.sendDuelDecline(fromId);
        return;
      }
      const alivePoke = getFirstAlivePokemon(player.party);
      if (!alivePoke) {
        net.sendDuelDecline(fromId);
        return;
      }
      openDuelRequestModal(fromId, fromName);
    },
    onDuelStart: ({ opponentId, opponentName, opponentParty }) => {
      launchBattle({
        opponentParty,
        trainerInfo: {
          id: `pvp_${opponentId}`,
          name: `Dresseur ${opponentName}`,
          portrait: 'assets/trainers/calem.png',
          rewardMoney: 500,
          outro: 'Quel duel intense ! Bien joué !'
        },
        isWild: false
      });
    },
    onDuelDeclined: ({ fromName }) => {
      showDialogue(fromName, `${fromName} est occupé et a décliné votre défi pour le moment.`);
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

  function onKeyDown(e) {
    if (destroyed) return;
    if (e.repeat) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      if (modalLayer.style.display === 'flex' || modalLayer.style.display === 'block') {
        closeModal();
      } else if (state === 'overworld') {
        openBagModal();
      }
      return;
    }

    if (state !== 'overworld' && state !== 'dialogue') return;

    if (e.key === ' ' || e.key === 'Enter' || e.key.toLowerCase() === 'e') {
      e.preventDefault();
      handleActionKey();
      return;
    }

    if (e.key.toLowerCase() === 'b') {
      e.preventDefault();
      openBagModal();
      return;
    }

    keysDown.add(e.key.toLowerCase());
  }

  function onKeyUp(e) {
    keysDown.delete(e.key.toLowerCase());
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

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
  root.querySelector('#btnMenuBag').onclick = () => { sfx.playClick(); openBagModal(); };
  root.querySelector('#btnMenuDex').onclick = () => { sfx.playClick(); openPokedexModal(); };
  root.querySelector('#btnSwitchTournament').onclick = () => {
    sfx.playClick();
    if (onSwitchMode) {
      onSwitchMode('tournament');
    } else {
      const url = new URL(location.href);
      url.searchParams.set('mode', 'tournament');
      location.href = url.toString();
    }
  };
  root.querySelector('#btnExitHub').onclick = () => {
    sfx.playClick();
    if (exit) exit();
    else location.reload();
  };

  // Première visite : si pas de starter, dialogue d'accueil avec portrait du Prof. Platane
  if (!player.hasStarter) {
    showDialogue(
      'Professeur Platane',
      'Bienvenue à Menton, la perle de Kalos-Sud !\nApproche-toi de la table du laboratoire au Nord et appuie sur [E] pour choisir ton Pokémon !',
      null,
      'assets/trainers/sycamore.png'
    );
  }

  function getActiveQuest() {
    if (!player.hasStarter) {
      return 'Objectif : Choisir un Starter au Labo (6,7)';
    }
    const defCount = (player.defeatedTrainers || []).length;
    if (defCount < 2) {
      return `Objectif : Vaincre les Dresseurs (${defCount}/4) sur la Route 1`;
    }
    if (!(player.badges || []).includes('citron_dor')) {
      return 'Objectif : Défier la Championne Solène à l\'Arène (Nord-Est)';
    }
    const caughtCount = (player.pokedex && player.pokedex.caught && player.pokedex.caught.length) || 0;
    return `Maître de Menton • Pokédex : ${caughtCount}/28 espèces`;
  }

  // --- BOUCLE DE JEU 60 FPS ---
  let lastTime = performance.now();
  let encounterCooldown = 0;

  function gameLoop(now) {
    if (destroyed) return;
    const dt = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;

    if (state === 'overworld' || state === 'dialogue') {
      updateMovement(dt);
      net.updateInterpolation();

      // Interpolation douce du Pokémon suiveur
      player.followerX += (player.prevX - player.followerX) * 0.22;
      player.followerY += (player.prevY - player.followerY) * 0.22;

      const frontPos = getFrontTile(player.x, player.y, player.dir);
      const target = getInteractiveTarget(frontPos.x, frontPos.y);

      const zoneName = player.y > 23 ? 'Plage des Sablettes (Bord de mer)' :
                       (player.x >= 35 && player.y <= 7 ? 'Parvis de l\'Arène de Menton' :
                       (player.x > 22 ? 'Route 1 Corniche (Hauts de Menton)' : 'Menton - La Cité des Citrons'));

      renderer.render({
        grid,
        localPlayer: player,
        remotePlayers: net.getPlayersList(),
        roamingWilds,
        interactiveTarget: target,
        dialogueBox: activeDialogue,
        activeZoneName: zoneName,
        questText: getActiveQuest()
      });
    }

    rafId = requestAnimationFrame(gameLoop);
  }

  rafId = requestAnimationFrame(gameLoop);

  // --- COLLISIONS AVEC PNJ ET OBSTACLES ---
  function isBlocked(tx, ty) {
    if (isSolid(grid, tx, ty)) return true;
    // Professeur Platane en (5,6)
    if (tx === 5 && ty === 6) return true;
    // Dresseurs PNJ
    if (ADVENTURE_TRAINERS.some(tr => tr.x === tx && tr.y === ty)) return true;
    return false;
  }

  // --- DÉPLACEMENTS CASE PAR CASE (STYLE GBA) ---
  function updateMovement(dt) {
    const isRunning = keysDown.has('shift');
    const moveSpeed = isRunning ? 6.8 : 4.4;

    if (isMoving) {
      moveProgress += dt * moveSpeed;
      if (moveProgress >= 1.0) {
        player.prevX = startTileX;
        player.prevY = startTileY;
        player.x = targetTileX;
        player.y = targetTileY;
        player.visualX = player.x;
        player.visualY = player.y;
        player.moving = false;
        isMoving = false;
        moveProgress = 0;

        me.x = player.x;
        me.y = player.y;
        me.prevX = player.prevX;
        me.prevY = player.prevY;
        me.dir = player.dir;
        me.leadPokeId = player.party && player.party[0] ? player.party[0].id : null;
        savePlayerData(player);
        net.broadcastPos(player);

        checkWildEncounter();
      } else {
        player.visualX = startTileX + (targetTileX - startTileX) * moveProgress;
        player.visualY = startTileY + (targetTileY - startTileY) * moveProgress;
        player.moving = true;
      }
    } else if (state === 'overworld' && !activeDialogue) {
      let wantedDir = null;
      if (keysDown.has('arrowup') || keysDown.has('w') || keysDown.has('z') || keysDown.has('up')) wantedDir = 'up';
      else if (keysDown.has('arrowdown') || keysDown.has('s') || keysDown.has('down')) wantedDir = 'down';
      else if (keysDown.has('arrowleft') || keysDown.has('a') || keysDown.has('q') || keysDown.has('left')) wantedDir = 'left';
      else if (keysDown.has('arrowright') || keysDown.has('d') || keysDown.has('right')) wantedDir = 'right';

      if (wantedDir) {
        player.dir = wantedDir;
        me.dir = wantedDir;
        const target = getFrontTile(player.x, player.y, wantedDir);

        if (!isBlocked(target.x, target.y)) {
          startTileX = player.x;
          startTileY = player.y;
          targetTileX = target.x;
          targetTileY = target.y;
          isMoving = true;
          moveProgress = 0;
          player.moving = true;
          net.broadcastPos(player);
        } else {
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
    if (tile === TILE.MART_DESK) return { x: fx, y: fy, label: 'Boutique Pokémon' };
    if (tile === TILE.PC_BOX) return { x: fx, y: fy, label: 'Ouvrir PC' };
    if (tile === TILE.SIGN) return { x: fx, y: fy, label: 'Lire Panneau' };

    if (fx === 5 && fy === 6) return { x: fx, y: fy, label: 'Parler au Prof. Platane' };

    const npcTrainer = ADVENTURE_TRAINERS.find(tr => tr.x === fx && tr.y === fy);
    if (npcTrainer) {
      const defeated = (player.defeatedTrainers || []).includes(npcTrainer.id);
      return {
        x: fx,
        y: fy,
        label: defeated ? `Revanche : ${npcTrainer.name}` : `Défier ${npcTrainer.name}`
      };
    }

    const wildOnTile = roamingWilds.find(rw => rw.x === fx && rw.y === fy);
    if (wildOnTile) {
      return { x: fx, y: fy, label: `Affronter ${wildOnTile.pokemon.name}` };
    }

    const peer = net.getPlayersList().find(p => p.x === fx && p.y === fy);
    if (peer) return { x: fx, y: fy, label: `Duel JcJ : ${peer.name}` };

    return null;
  }

  // --- RENCONTRES SAUVAGES ---
  function checkWildEncounter() {
    if (!player.hasStarter) return;

    // 1. Contact direct avec un Pokémon sauvage visible sur la carte
    const touchedIdx = roamingWilds.findIndex(rw => rw.x === player.x && rw.y === player.y);
    if (touchedIdx !== -1) {
      const rw = roamingWilds[touchedIdx];
      roamingWilds.splice(touchedIdx, 1);
      setTimeout(() => {
        if (!destroyed && roamingWilds.length < 4) spawnRoamingWilds();
      }, 15000);
      launchBattle({ opponentPokemon: rw.pokemon, isWild: true });
      return;
    }

    if (encounterCooldown > 0) {
      encounterCooldown--;
      return;
    }

    const currentTile = getTile(grid, player.x, player.y);
    if (currentTile === TILE.GRASS_TALL) {
      if (Math.random() < 0.15) {
        encounterCooldown = 4;
        const wild = rollWildEncounter('grass');
        launchBattle({ opponentPokemon: wild, isWild: true });
      }
    } else if (currentTile === TILE.SAND && player.y >= 26) {
      if (Math.random() < 0.09) {
        encounterCooldown = 5;
        const wild = rollWildEncounter('water');
        launchBattle({ opponentPokemon: wild, isWild: true });
      }
    }
  }

  function launchBattle({ opponentPokemon, opponentParty, trainerInfo = null, isWild = true }) {
    const alivePoke = getFirstAlivePokemon(player.party);
    if (!alivePoke) {
      showDialogue(
        'Infirmière Joëlle',
        'Tous vos Pokémon sont K.O. ! Passez d\'abord au Centre Pokémon pour les remettre sur pied.',
        null,
        'assets/trainers/pokemoncenterlady.png'
      );
      return;
    }

    // Transition visuelle et sonore façon GBA
    state = 'transition';
    sfx.init();
    sfx.playEncounter();
    transitionLayer.style.display = 'block';
    transitionLayer.className = 'adv-transition-layer active';

    setTimeout(() => {
      transitionLayer.style.display = 'none';
      transitionLayer.className = 'adv-transition-layer';
      state = 'battle';
      battleLayer.style.display = 'block';

      startAdventureBattle(battleLayer, {
        player,
        opponentPokemon,
        opponentParty,
        trainerInfo,
        isWild,
        onEnd: ({ result, caughtPokemon }) => {
          battleLayer.style.display = 'none';
          state = 'overworld';
          me.leadPokeId = player.party && player.party[0] ? player.party[0].id : null;
          net.broadcastPos(player);

          if (result === 'caught' && caughtPokemon) {
            const res = addPokemonToPlayer(player, caughtPokemon);
            showDialogue(
              'Pokédex de Kalos-Sud',
              `Les données de ${caughtPokemon.name} sont enregistrées dans le Pokédex !\nIl rejoint votre ${res.location === 'party' ? 'équipe' : 'Boîte PC'} !`
            );
          } else if (result === 'won' && trainerInfo) {
            if (!player.defeatedTrainers) player.defeatedTrainers = [];
            if (!player.defeatedTrainers.includes(trainerInfo.id)) {
              player.defeatedTrainers.push(trainerInfo.id);
            }
            if (trainerInfo.badge && !(player.badges || []).includes(trainerInfo.badge)) {
              if (!player.badges) player.badges = [];
              player.badges.push(trainerInfo.badge);
              sfx.playLevelUp();
              showDialogue(
                trainerInfo.name,
                `Félicitations ! Tu remportes l'emblématique Badge Citron d'Or de l'Arène de Menton !\nTous les dresseurs de la Côte d'Azur reconnaissent désormais ta valeur !`,
                null,
                trainerInfo.portrait
              );
            }
          } else if (result === 'lost') {
            player.x = 17;
            player.y = 9;
            player.prevX = 17;
            player.prevY = 8;
            player.dir = 'down';
            player.visualX = 17;
            player.visualY = 9;
            healParty(player);
            sfx.playHeal();
            showDialogue(
              'Infirmière Joëlle',
              'Vous avez été rapatrié au Centre Pokémon de Menton.\nVos compagnons sont entièrement rétablis !',
              null,
              'assets/trainers/pokemoncenterlady.png'
            );
          }

          savePlayerData(player);
        }
      });
    }, 650);
  }

  // --- ACTIONS DU JOUEUR ([E] / [ESPACE]) ---
  function handleActionKey() {
    if (activeDialogue) {
      sfx.playClick();
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

    // 1. Parler au Professeur Platane en (5,6)
    if (front.x === 5 && front.y === 6) {
      if (!player.hasStarter) {
        openStarterModal();
      } else {
        const caughtCount = (player.pokedex && player.pokedex.caught && player.pokedex.caught.length) || 0;
        showDialogue(
          'Professeur Platane',
          `Voyons ton Pokédex... Tu as déjà capturé ${caughtCount} espèce(s) sur 28 à Menton !\nN'oublie pas que tes Pokémon évoluent en montant de niveau face aux dresseurs de la Route 1 !`,
          null,
          'assets/trainers/sycamore.png'
        );
      }
      return;
    }

    // 2. Table du Laboratoire (Starters)
    if (tile === TILE.LAB_TABLE) {
      if (!player.hasStarter) {
        openStarterModal();
      } else {
        showDialogue(
          'Laboratoire Pokémon',
          'Il reste des Poké Balls d\'étude sur la table du Professeur Platane.',
          null,
          'assets/trainers/sycamore.png'
        );
      }
      return;
    }

    // 3. Cueillir un Citron de Menton
    if (tile === TILE.LEMON_TREE) {
      const key = `${front.x},${front.y}`;
      const cd = player.lemonCooldowns ? player.lemonCooldowns[key] : 0;
      if (!cd || Date.now() > cd) {
        if (!player.lemonCooldowns) player.lemonCooldowns = {};
        player.lemonCooldowns[key] = Date.now() + 30000;
        addItem(player, 'citron_menton', 1);
        player.stats.lemonsPicked = (player.stats.lemonsPicked || 0) + 1;
        savePlayerData(player);
        sfx.playItem();
        showDialogue(
          'Citronnier de Menton IGP',
          'Vous cueillez un Citron de Menton gorgé de soleil !\nIl restaure 35 PV et guérit toutes les altérations de statut.'
        );
      } else {
        const remaining = Math.ceil((cd - Date.now()) / 1000);
        showDialogue('Citronnier de Menton', `De nouveaux citrons mûrissent au soleil... (Prêt dans ${remaining} s)`);
      }
      return;
    }

    // 4. Infirmière Joëlle au Centre Pokémon
    if (tile === TILE.NURSE_DESK) {
      healParty(player);
      sfx.playHeal();
      showDialogue(
        'Infirmière Joëlle',
        'Bienvenue au Centre Pokémon de Menton !\n♪ Tut-tut-tut-tulut ! Vos Pokémon ont retrouvé toute leur énergie et leurs PP !',
        null,
        'assets/trainers/pokemoncenterlady.png'
      );
      return;
    }

    // 5. Boutique Pokémon de Menton
    if (tile === TILE.MART_DESK) {
      sfx.playClick();
      openMartModal();
      return;
    }

    // 6. Terminal PC
    if (tile === TILE.PC_BOX) {
      sfx.playClick();
      openPCModal();
      return;
    }

    // 7. Panneaux d'information
    if (tile === TILE.SIGN) {
      const signData = SIGNPOSTS[`${front.x},${front.y}`] || {
        title: 'Panneau de Menton',
        text: 'Bienvenue sur la Côte d\'Azur de Kalos-Sud !'
      };
      sfx.playClick();
      showDialogue(signData.title, signData.text);
      return;
    }

    // 8. Dresseur PNJ ou Championne d'Arène Solène
    const npcTrainer = ADVENTURE_TRAINERS.find(tr => tr.x === front.x && tr.y === front.y);
    if (npcTrainer) {
      if (!player.hasStarter) {
        showDialogue(npcTrainer.name, 'Choisis d\'abord ton premier Pokémon au Laboratoire du Prof. Platane !', null, npcTrainer.portrait);
        return;
      }
      sfx.playClick();
      showDialogue(
        npcTrainer.name,
        npcTrainer.intro,
        () => {
          const tParty = createTrainerParty(npcTrainer);
          launchBattle({
            opponentParty: tParty,
            trainerInfo: npcTrainer,
            isWild: false
          });
        },
        npcTrainer.portrait
      );
      return;
    }

    // 9. Pokémon sauvage visible en face
    const wildIdx = roamingWilds.findIndex(rw => rw.x === front.x && rw.y === front.y);
    if (wildIdx !== -1 && player.hasStarter) {
      const rw = roamingWilds[wildIdx];
      roamingWilds.splice(wildIdx, 1);
      launchBattle({ opponentPokemon: rw.pokemon, isWild: true });
      return;
    }

    // 10. Duel avec un joueur multijoueur
    const peer = net.getPlayersList().find(p => p.x === front.x && p.y === front.y);
    if (peer) {
      showDialogue(peer.name, `Vous lancez un défi Pokémon à ${peer.name} ! En attente de sa réponse...`);
      net.sendDuelRequest(peer.id);
      return;
    }
  }

  function showDialogue(speaker, text, callback = null, portrait = null) {
    activeDialogue = { speaker, text, portrait };
    dialogueCallback = callback;
  }

  // --- MODALE 1 : CHOIX DU STARTER (KANTO & KALOS) + AVATAR ---
  function openStarterModal() {
    state = 'starter_modal';
    modalLayer.style.display = 'flex';
    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header" style="display:flex;align-items:center;gap:16px;">
          <img src="assets/trainers/sycamore.png" alt="Platane" style="width:64px;height:64px;border-radius:10px;border:2px solid #ffcb05;background:#1e293b;">
          <div>
            <h2>Laboratoire du Professeur Platane</h2>
            <p>Choisissez votre tenue de dresseur et votre premier partenaire Pokémon pour explorer Menton !</p>
          </div>
        </div>

        <div class="adv-avatar-picker">
          <span>Tenue de Dresseur :</span>
          <button class="adv-avatar-btn ${player.avatar !== 'green' ? 'active' : ''}" data-av="red">
            <img src="assets/trainers/red.png" alt="Red"> Red / Kalem
          </button>
          <button class="adv-avatar-btn ${player.avatar === 'green' ? 'active' : ''}" data-av="green">
            <img src="assets/trainers/serena.png" alt="Leaf"> Leaf / Serena
          </button>
        </div>

        <div class="adv-starters-grid">
          ${STARTER_OPTIONS.map(st => `
            <div class="adv-starter-card" data-id="${st.id}">
              <span class="st-region-badge">${st.region}</span>
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

    modalLayer.querySelectorAll('.adv-avatar-btn').forEach(btn => {
      btn.onclick = () => {
        sfx.playClick();
        player.avatar = btn.dataset.av;
        me.avatar = player.avatar;
        savePlayerData(player);
        modalLayer.querySelectorAll('.adv-avatar-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      };
    });

    modalLayer.querySelectorAll('.st-choose-btn').forEach(btn => {
      btn.onclick = (e) => {
        const card = e.target.closest('.adv-starter-card');
        const stId = parseInt(card.dataset.id, 10);
        const starter = giveStarter(player, stId);
        me.leadPokeId = starter.id;
        sfx.playLevelUp();
        setTimeout(() => sfx.playCry(starter.id), 300);
        closeModal();
        net.broadcastPos(player);
        showDialogue(
          'Professeur Platane',
          `Excellent choix ! ${starter.name} marche désormais derrière toi sur la carte !\nVa défier les dresseurs de la Route 1 à l'Est avant d'affronter la Championne Solène !`,
          null,
          'assets/trainers/sycamore.png'
        );
      };
    });
  }

  // --- MODALE 2 : SAC INTERACTIF & GESTION D'ÉQUIPE ---
  let selectedBagItem = null;

  function openBagModal(statusMessage = '') {
    state = 'menu_bag';
    modalLayer.style.display = 'flex';
    const inv = player.inventory || {};
    const itemsList = Object.entries(inv).map(([key, count]) => {
      const def = ITEMS[key] || { name: key, desc: '', icon: 'assets/items/poke-ball.png' };
      return { key, count, ...def };
    }).filter(i => i.count > 0);

    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <h2>Sac & Équipe Pokémon</h2>
              <p>Dresseur : <strong>${player.name}</strong> • Argent : <strong style="color:#ffd700">${player.money || 0} ₽</strong> • Victoires : <strong>${player.stats?.battlesWon || 0}</strong></p>
            </div>
            ${statusMessage ? `<div class="adv-bag-feedback">${statusMessage}</div>` : ''}
          </div>
        </div>

        <div class="adv-bag-sections">
          <!-- Équipe (max 6) -->
          <div class="adv-section-col">
            <h3>Mon Équipe (${player.party.length}/6) ${selectedBagItem ? `<span style="color:#facc15;font-size:12px;">— Cliquez sur un Pokémon pour utiliser ${ITEMS[selectedBagItem]?.name}</span>` : ''}</h3>
            <div class="adv-party-cards">
              ${player.party.length === 0 ? '<div class="adv-empty">Aucun Pokémon. Allez au Laboratoire !</div>' : ''}
              ${player.party.map((p, idx) => `
                <div class="adv-poke-card ${p.fainted ? 'fainted' : ''} ${selectedBagItem ? 'selectable-target' : ''}" data-idx="${idx}">
                  <img src="${spriteUrls(p.id).icon}" alt="${p.name}" class="poke-icon">
                  <div class="poke-info">
                    <div class="pi-title">
                      ${p.name} <span class="pi-lv">N.${p.level}</span>
                      ${idx === 0 ? '<span class="adv-lead-tag">SUIVEUR</span>' : ''}
                    </div>
                    <div class="pi-hp-bar">
                      <div class="pi-hp-fill" style="width: ${(p.currentHp / p.maxHp) * 100}%"></div>
                    </div>
                    <div class="pi-hp-val">${p.currentHp} / ${p.maxHp} PV • EXP ${p.exp}/${p.expNext}</div>
                  </div>
                  <div class="adv-poke-actions">
                    ${selectedBagItem ? `<button class="adv-mini-btn use-here" data-idx="${idx}">Soigner</button>` : (idx > 0 ? `<button class="adv-mini-btn lead-btn" data-idx="${idx}">En tête</button>` : '')}
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Inventaire -->
          <div class="adv-section-col">
            <h3>Mon Sac</h3>
            <div class="adv-inventory-cards">
              ${itemsList.length === 0 ? '<div class="adv-empty">Votre sac est vide. Visitez la Boutique !</div>' : ''}
              ${itemsList.map(it => `
                <div class="adv-item-row-card ${selectedBagItem === it.key ? 'selected' : ''}">
                  <div style="display:flex;align-items:center;gap:10px;">
                    ${it.icon ? `<img src="${it.icon}" alt="" style="width:28px;height:28px;image-rendering:pixelated;">` : ''}
                    <div style="flex:1;">
                      <div class="it-title">${it.name} <span class="it-qty">x${it.count}</span></div>
                      <div class="it-sub">${it.desc}</div>
                    </div>
                    ${it.category === 'heal' ? `
                      <button class="adv-mini-btn use-item-btn" data-key="${it.key}">
                        ${selectedBagItem === it.key ? 'Annuler' : 'Utiliser'}
                      </button>
                    ` : ''}
                  </div>
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

    modalLayer.querySelectorAll('.lead-btn').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const idx = parseInt(btn.dataset.idx, 10);
        if (setLeadPokemon(player, idx)) {
          sfx.playSwitch();
          me.leadPokeId = player.party[0].id;
          net.broadcastPos(player);
          openBagModal(`${player.party[0].name} marche désormais à vos côtés !`);
        }
      };
    });

    modalLayer.querySelectorAll('.use-item-btn').forEach(btn => {
      btn.onclick = () => {
        sfx.playClick();
        const key = btn.dataset.key;
        selectedBagItem = selectedBagItem === key ? null : key;
        openBagModal(selectedBagItem ? `Sélectionnez le Pokémon à soigner avec ${ITEMS[key].name}.` : '');
      };
    });

    modalLayer.querySelectorAll('.adv-poke-card').forEach(card => {
      card.onclick = () => {
        if (!selectedBagItem) return;
        const idx = parseInt(card.dataset.idx, 10);
        const res = useItemOutsideBattle(player, selectedBagItem, idx);
        if (res.ok) sfx.playItem();
        else sfx.playMiss();
        if (!player.inventory[selectedBagItem]) selectedBagItem = null;
        openBagModal(res.msg);
      };
    });

    modalLayer.querySelector('#btnCloseModal').onclick = () => {
      selectedBagItem = null;
      closeModal();
    };
  }

  // --- MODALE 3 : BOUTIQUE POKÉMON DE MENTON ---
  function openMartModal(feedback = '') {
    state = 'mart_modal';
    modalLayer.style.display = 'flex';
    const shopKeys = ['poke_ball', 'super_ball', 'hyper_ball', 'potion', 'super_potion', 'citron_menton', 'rappel'];

    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <h2>Boutique Pokémon & Marché de Menton</h2>
              <p>Votre portefeuille : <strong style="color:#ffd700;font-size:16px;">${player.money || 0} ₽</strong></p>
            </div>
            ${feedback ? `<div class="adv-bag-feedback">${feedback}</div>` : ''}
          </div>
        </div>

        <div class="adv-mart-grid">
          ${shopKeys.map(k => {
            const it = ITEMS[k];
            const owned = (player.inventory && player.inventory[k]) || 0;
            return `
              <div class="adv-mart-card">
                <img src="${it.icon}" alt="${it.name}" class="mart-icon">
                <div class="mart-info">
                  <div class="mart-name">${it.name} <span class="mart-owned">(Sac: ${owned})</span></div>
                  <div class="mart-desc">${it.desc}</div>
                </div>
                <button class="adv-btn mart-buy-btn" data-key="${k}" ${(player.money || 0) < it.price ? 'disabled' : ''}>
                  Acheter ${it.price} ₽
                </button>
              </div>
            `;
          }).join('')}
        </div>

        <div class="adv-modal-footer">
          <button class="adv-btn btn-secondary" id="btnCloseMart">Quitter la Boutique</button>
        </div>
      </div>
    `;

    modalLayer.querySelectorAll('.mart-buy-btn').forEach(btn => {
      btn.onclick = () => {
        const key = btn.dataset.key;
        const res = buyItem(player, key, 1);
        if (res.ok) {
          sfx.playItem();
          openMartModal(`Vous avez acheté 1 ${res.item.name} (-${res.totalCost} ₽) !`);
        } else {
          sfx.playMiss();
          openMartModal(res.reason);
        }
      };
    });

    modalLayer.querySelector('#btnCloseMart').onclick = () => closeModal();
  }

  // --- MODALE 4 : SYSTÈME DE STOCKAGE PC INTERACTIF ---
  function openPCModal(feedback = '') {
    state = 'pc_modal';
    modalLayer.style.display = 'flex';
    const box = player.box || [];

    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">
            <div>
              <h2>Système de Stockage PC de Menton</h2>
              <p>Cliquez sur un Pokémon pour le transférer entre votre Équipe et la Boîte PC.</p>
            </div>
            ${feedback ? `<div class="adv-bag-feedback">${feedback}</div>` : ''}
          </div>
        </div>

        <div class="adv-bag-sections">
          <div class="adv-section-col">
            <h3>Mon Équipe (${player.party.length}/6) — Cliquer pour Déposer</h3>
            <div class="adv-party-cards">
              ${player.party.map((p, i) => `
                <div class="adv-poke-card selectable-target pc-party-slot" data-idx="${i}">
                  <img src="${spriteUrls(p.id).icon}" alt="${p.name}" class="poke-icon">
                  <div class="poke-info">
                    <div class="pi-title">${p.name} <span class="pi-lv">N.${p.level}</span></div>
                    <div class="pi-hp-val">${p.currentHp}/${p.maxHp} PV</div>
                  </div>
                  <button class="adv-mini-btn">Déposer →</button>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="adv-section-col">
            <h3>Boîte PC (${box.length}) — Cliquer pour Retirer</h3>
            <div class="adv-pc-grid">
              ${box.length === 0 ? '<div class="adv-empty">La Boîte PC est vide.</div>' : ''}
              ${box.map((p, i) => `
                <div class="adv-pc-slot selectable-target" data-idx="${i}">
                  <img src="${spriteUrls(p.id).icon}" alt="${p.name}">
                  <div>${p.name}</div>
                  <small>N.${p.level}</small>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="adv-modal-footer">
          <button class="adv-btn btn-secondary" id="btnClosePC">Quitter le PC</button>
        </div>
      </div>
    `;

    modalLayer.querySelectorAll('.pc-party-slot').forEach(slot => {
      slot.onclick = () => {
        const idx = parseInt(slot.dataset.idx, 10);
        const res = depositToBox(player, idx);
        if (res.ok) sfx.playSwitch();
        else sfx.playMiss();
        me.leadPokeId = player.party[0]?.id || null;
        openPCModal(res.msg);
      };
    });

    modalLayer.querySelectorAll('.adv-pc-slot').forEach(slot => {
      slot.onclick = () => {
        const idx = parseInt(slot.dataset.idx, 10);
        const res = withdrawFromBox(player, idx);
        if (res.ok) sfx.playSwitch();
        else sfx.playMiss();
        openPCModal(res.msg);
      };
    });

    modalLayer.querySelector('#btnClosePC').onclick = () => closeModal();
  }

  // --- MODALE 5 : POKÉDEX DE KALOS-SUD & BADGES D'ARÈNE ---
  function openPokedexModal() {
    state = 'dex_modal';
    modalLayer.style.display = 'flex';
    const seenSet = new Set((player.pokedex && player.pokedex.seen) || []);
    const caughtSet = new Set((player.pokedex && player.pokedex.caught) || []);
    const allIds = Object.keys(BASE_SPECIES).map(Number).sort((a, b) => a - b);
    const hasGymBadge = (player.badges || []).includes('citron_dor');

    modalLayer.innerHTML = `
      <div class="adv-modal-box">
        <div class="adv-modal-header">
          <h2>Pokédex Régional de Kalos-Sud & Badges</h2>
          <p>Vus : <strong>${seenSet.size}/${allIds.length}</strong> • Capturés : <strong style="color:#4ade80">${caughtSet.size}/${allIds.length}</strong></p>
        </div>

        <div class="adv-badge-showcase ${hasGymBadge ? 'earned' : 'locked'}">
          <div class="badge-medal">${hasGymBadge ? '★' : '?'}</div>
          <div>
            <div class="badge-title">Badge Citron d'Or — Arène de Menton</div>
            <div class="badge-desc">${hasGymBadge ? 'Obtenu en triomphant de la Championne Solène !' : 'Vainquez la Championne Solène à l\'Arène de Menton (Nord-Est) pour l\'obtenir.'}</div>
          </div>
        </div>

        <div class="adv-dex-grid">
          ${allIds.map(id => {
            const sp = BASE_SPECIES[id];
            const isCaught = caughtSet.has(id);
            const isSeen = seenSet.has(id) || isCaught;
            return `
              <div class="adv-dex-card ${isCaught ? 'caught' : (isSeen ? 'seen' : 'unknown')}">
                <div class="dex-num">#${String(id).padStart(3, '0')}</div>
                <img src="${spriteUrls(id).icon}" alt="${sp.name}" class="dex-img">
                <div class="dex-name">${isSeen ? sp.name : '???'}</div>
                <div class="dex-status">${isCaught ? 'CAPTURÉ' : (isSeen ? 'VU' : 'INCONNU')}</div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="adv-modal-footer">
          <button class="adv-btn btn-secondary" id="btnCloseDex">Fermer</button>
        </div>
      </div>
    `;

    modalLayer.querySelector('#btnCloseDex').onclick = () => closeModal();
  }

  // --- MODALE 6 : INVITATION DUEL MULTIJOUEUR ---
  function openDuelRequestModal(fromId, fromName) {
    state = 'duel_modal';
    modalLayer.style.display = 'flex';
    modalLayer.innerHTML = `
      <div class="adv-modal-box" style="max-width:460px;text-align:center;">
        <div class="adv-modal-header">
          <h2>Défi JcJ en Direct !</h2>
          <p>Le dresseur <strong>${fromName}</strong> vous défie en combat Pokémon à Menton !</p>
        </div>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button class="adv-btn attack-btn" id="btnAcceptDuel">Accepter le Duel</button>
          <button class="adv-btn btn-secondary" id="btnDeclineDuel">Décliner</button>
        </div>
      </div>
    `;

    modalLayer.querySelector('#btnAcceptDuel').onclick = () => {
      closeModal();
      net.sendDuelAccept(fromId, player.party);
    };
    modalLayer.querySelector('#btnDeclineDuel').onclick = () => {
      closeModal();
      net.sendDuelDecline(fromId);
    };
  }

  function closeModal() {
    modalLayer.style.display = 'none';
    state = 'overworld';
  }

  return {
    destroy: () => {
      destroyed = true;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    }
  };
}
