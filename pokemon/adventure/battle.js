// pokemon/adventure/battle.js
// Système de combat sauvage et duel pour le Mode Aventure.
// Intègre le lancer de Poké Ball animé, la formule de capture officielle, le gain d'EXP,
// la montée de niveau et les effets sonores authentiques.

import { MOVES, spriteUrls, calculateCatchSuccess, checkLevelUp, ITEMS } from './data.js';
import { getEffectiveness } from '../engine/types.js';

export function startAdventureBattle(container, {
  player,
  opponentPokemon,
  isWild = true,
  onEnd
}) {
  let activePlayerPoke = player.party.find(p => !p.fainted && p.currentHp > 0);
  if (!activePlayerPoke) {
    onEnd({ result: 'lost' });
    return;
  }

  // Cloner pour le combat
  let wildPoke = {
    ...opponentPokemon,
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  };
  activePlayerPoke.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };

  let isAnimating = false;
  let menuState = 'main'; // 'main', 'moves', 'bag', 'switch'
  let battleOver = false;

  const bgm = new Audio('assets/bgm_trainer.mp3');
  bgm.loop = true;
  bgm.volume = 0.35;
  bgm.play().catch(() => {});

  function playSfx(src, vol = 0.5) {
    try {
      const sfx = new Audio(src);
      sfx.volume = vol;
      sfx.play().catch(() => {});
    } catch (e) {}
  }

  // Interface HTML du combat
  container.innerHTML = `
    <div class="adv-battle-screen">
      <div class="adv-battle-arena">
        <!-- Zone Sauvage / Adversaire (Haut Droite) -->
        <div class="adv-side top">
          <div class="adv-hud top">
            <div class="adv-hud-name">
              <span class="poke-name">${wildPoke.name}</span>
              <span class="poke-level">N.${wildPoke.level}</span>
            </div>
            <div class="adv-hp-bar-wrap">
              <div class="adv-hp-fill" id="oppHpFill" style="width: ${(wildPoke.currentHp / wildPoke.maxHp) * 100}%"></div>
            </div>
            <div class="adv-hud-status" id="oppStatus"></div>
          </div>
          <div class="adv-platform-opp">
            <img class="adv-poke-sprite front" id="oppSprite" src="${spriteUrls(wildPoke.id).front}" alt="${wildPoke.name}">
            <img class="adv-pokeball-throw" id="pokeballThrow" src="assets/poke-ball.png" alt="ball">
          </div>
        </div>

        <!-- Zone Joueur (Bas Gauche) -->
        <div class="adv-side bottom">
          <div class="adv-platform-player">
            <img class="adv-poke-sprite back" id="playerSprite" src="${spriteUrls(activePlayerPoke.id).back}" alt="${activePlayerPoke.name}">
          </div>
          <div class="adv-hud bottom">
            <div class="adv-hud-name">
              <span class="poke-name" id="playerName">${activePlayerPoke.name}</span>
              <span class="poke-level" id="playerLevel">N.${activePlayerPoke.level}</span>
            </div>
            <div class="adv-hp-bar-wrap">
              <div class="adv-hp-fill" id="playerHpFill" style="width: ${(activePlayerPoke.currentHp / activePlayerPoke.maxHp) * 100}%"></div>
            </div>
            <div class="adv-hp-text" id="playerHpText">${activePlayerPoke.currentHp} / ${activePlayerPoke.maxHp} PV</div>
            <div class="adv-exp-bar-wrap">
              <div class="adv-exp-fill" id="playerExpFill" style="width: ${Math.min(100, Math.max(0, ((activePlayerPoke.exp - Math.pow(activePlayerPoke.level, 3)) / (activePlayerPoke.expNext - Math.pow(activePlayerPoke.level, 3))) * 100))}%"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dialogue & Commandes en Bas -->
      <div class="adv-battle-bottom">
        <div class="adv-battle-dialogue" id="battleDialogue">
          Un ${wildPoke.name} sauvage apparaît !
        </div>
        <div class="adv-battle-menu" id="battleMenu"></div>
      </div>
    </div>
  `;

  const oppHpFill = container.querySelector('#oppHpFill');
  const playerHpFill = container.querySelector('#playerHpFill');
  const playerHpText = container.querySelector('#playerHpText');
  const playerExpFill = container.querySelector('#playerExpFill');
  const oppSprite = container.querySelector('#oppSprite');
  const playerSprite = container.querySelector('#playerSprite');
  const pokeballThrow = container.querySelector('#pokeballThrow');
  const dialogueEl = container.querySelector('#battleDialogue');
  const menuEl = container.querySelector('#battleMenu');

  function updateHUD() {
    // PV Adversaire
    const oppRatio = Math.max(0, wildPoke.currentHp / wildPoke.maxHp);
    oppHpFill.style.width = `${oppRatio * 100}%`;
    oppHpFill.className = `adv-hp-fill ${oppRatio < 0.2 ? 'danger' : oppRatio < 0.5 ? 'warn' : ''}`;

    // PV Joueur
    const playRatio = Math.max(0, activePlayerPoke.currentHp / activePlayerPoke.maxHp);
    playerHpFill.style.width = `${playRatio * 100}%`;
    playerHpFill.className = `adv-hp-fill ${playRatio < 0.2 ? 'danger' : playRatio < 0.5 ? 'warn' : ''}`;
    playerHpText.textContent = `${activePlayerPoke.currentHp} / ${activePlayerPoke.maxHp} PV`;

    // EXP Joueur
    const curBase = Math.pow(activePlayerPoke.level, 3);
    const expRatio = Math.min(1, Math.max(0, (activePlayerPoke.exp - curBase) / (activePlayerPoke.expNext - curBase)));
    playerExpFill.style.width = `${expRatio * 100}%`;

    container.querySelector('#playerName').textContent = activePlayerPoke.name;
    container.querySelector('#playerLevel').textContent = `N.${activePlayerPoke.level}`;
  }

  function setDialogue(msg) {
    dialogueEl.textContent = msg;
  }

  function renderMainMenu() {
    menuState = 'main';
    menuEl.innerHTML = `
      <div class="adv-menu-grid">
        <button class="adv-btn attack-btn" id="btnFight">ATTAQUE</button>
        <button class="adv-btn bag-btn" id="btnBag">SAC</button>
        <button class="adv-btn poke-btn" id="btnPoke">POKÉMON</button>
        <button class="adv-btn run-btn" id="btnRun">FUITE</button>
      </div>
    `;
    menuEl.querySelector('#btnFight').onclick = () => renderMovesMenu();
    menuEl.querySelector('#btnBag').onclick = () => renderBagMenu();
    menuEl.querySelector('#btnPoke').onclick = () => renderSwitchMenu();
    menuEl.querySelector('#btnRun').onclick = () => handleRun();
  }

  function renderMovesMenu() {
    menuState = 'moves';
    const moves = activePlayerPoke.moves.map(mKey => MOVES[mKey] || { name: mKey, type: 'normal', power: 40 });
    menuEl.innerHTML = `
      <div class="adv-moves-grid">
        ${moves.map((m, i) => `
          <button class="adv-move-card type-${m.type}" data-idx="${i}">
            <span class="m-name">${m.name}</span>
            <span class="m-info">${m.type.toUpperCase()} / PUIS ${m.power || '-'}</span>
          </button>
        `).join('')}
        <button class="adv-move-back" id="btnBack">RETOUR</button>
      </div>
    `;
    menuEl.querySelectorAll('.adv-move-card').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        executeTurn(activePlayerPoke.moves[idx]);
      };
    });
    menuEl.querySelector('#btnBack').onclick = () => renderMainMenu();
  }

  function renderBagMenu() {
    menuState = 'bag';
    const inv = player.inventory || {};
    const itemsList = Object.entries(inv).map(([key, count]) => {
      const def = ITEMS[key] || { name: key, desc: '' };
      return { key, count, ...def };
    }).filter(i => i.count > 0);

    menuEl.innerHTML = `
      <div class="adv-bag-list">
        ${itemsList.length === 0 ? '<div class="adv-empty-bag">Votre sac est vide !</div>' : ''}
        ${itemsList.map(it => `
          <button class="adv-item-row" data-key="${it.key}">
            <span class="it-name">${it.name} (x${it.count})</span>
            <span class="it-desc">${it.desc}</span>
          </button>
        `).join('')}
        <button class="adv-move-back" id="btnBack">RETOUR</button>
      </div>
    `;

    menuEl.querySelectorAll('.adv-item-row').forEach(btn => {
      btn.onclick = () => {
        useItemInBattle(btn.dataset.key);
      };
    });
    menuEl.querySelector('#btnBack').onclick = () => renderMainMenu();
  }

  function renderSwitchMenu() {
    menuState = 'switch';
    const party = player.party;
    menuEl.innerHTML = `
      <div class="adv-switch-list">
        ${party.map((p, i) => `
          <button class="adv-party-row ${p === activePlayerPoke ? 'active' : ''} ${p.fainted ? 'fainted' : ''}" data-idx="${i}" ${p.fainted || p === activePlayerPoke ? 'disabled' : ''}>
            <span class="pr-name">${p.name} (N.${p.level})</span>
            <span class="pr-hp">${p.currentHp}/${p.maxHp} PV</span>
          </button>
        `).join('')}
        <button class="adv-move-back" id="btnBack">RETOUR</button>
      </div>
    `;

    menuEl.querySelectorAll('.adv-party-row').forEach(btn => {
      btn.onclick = () => {
        const idx = parseInt(btn.dataset.idx, 10);
        switchPokemon(party[idx]);
      };
    });
    menuEl.querySelector('#btnBack').onclick = () => renderMainMenu();
  }

  // --- ACTIONS DU COMBAT ---
  async function executeTurn(playerMoveKey) {
    if (isAnimating || battleOver) return;
    isAnimating = true;
    menuEl.innerHTML = '';

    const pMove = MOVES[playerMoveKey] || { name: playerMoveKey, power: 40, type: 'normal', cat: 'physical' };

    // Vitesse relative
    const pSpe = activePlayerPoke.stats.spe;
    const oSpe = wildPoke.stats.spe;
    const playerFirst = pSpe >= oSpe;

    const first = playerFirst ? { side: 'player', move: pMove } : { side: 'opp' };
    const second = playerFirst ? { side: 'opp' } : { side: 'player', move: pMove };

    // 1ère attaque
    await performAttack(first.side, first.move);
    if (battleOver) return;

    // 2ème attaque si l'adversaire ou joueur est encore debout
    await wait(600);
    await performAttack(second.side, second.move);
    if (battleOver) return;

    isAnimating = false;
    renderMainMenu();
  }

  async function performAttack(side, move) {
    const isPlayer = side === 'player';
    const attacker = isPlayer ? activePlayerPoke : wildPoke;
    const defender = isPlayer ? wildPoke : activePlayerPoke;
    const atkSprite = isPlayer ? playerSprite : oppSprite;
    const defSprite = isPlayer ? oppSprite : playerSprite;

    // Si l'adversaire attaque, choisir un coup aléatoire
    const m = move || (() => {
      const mKeys = wildPoke.moves;
      const chosenKey = mKeys[Math.floor(Math.random() * mKeys.length)] || 'tackle';
      return MOVES[chosenKey] || { name: 'Charge', power: 40, type: 'normal', cat: 'physical' };
    })();

    setDialogue(`${attacker.name} utilise ${m.name} !`);
    atkSprite.classList.add(isPlayer ? 'anim-lunge-player' : 'anim-lunge-opponent');
    playSfx('assets/sfx_hit.wav');
    await wait(450);
    atkSprite.classList.remove('anim-lunge-player', 'anim-lunge-opponent');

    // Calcul des dégâts
    const isPhys = m.cat === 'physical';
    const atkVal = attacker.stats[isPhys ? 'atk' : 'spa'];
    const defVal = defender.stats[isPhys ? 'def' : 'spd'];
    const eff = getEffectiveness(m.type, defender.types);
    const stab = attacker.types.includes(m.type) ? 1.5 : 1.0;
    const rand = 0.85 + Math.random() * 0.15;
    const power = m.power || 35;

    // Formule officielle de base
    const base = (((2 * attacker.level / 5 + 2) * power * (atkVal / defVal)) / 50 + 2);
    const dmg = Math.max(1, Math.floor(base * eff * stab * rand));

    defender.currentHp = Math.max(0, defender.currentHp - dmg);

    // Animation de coup reçu
    defSprite.classList.add('anim-hit');
    if (eff >= 2) playSfx('assets/sfx_hit_strong.wav');
    else if (eff <= 0.5) playSfx('assets/sfx_hit_weak.wav');
    else playSfx('assets/sfx_hit.wav');

    updateHUD();
    await wait(500);
    defSprite.classList.remove('anim-hit');

    if (eff >= 2) setDialogue("C'est super efficace !");
    else if (eff <= 0.5) setDialogue("Ce n'est pas très efficace...");
    await wait(600);

    // K.O. check
    if (defender.currentHp <= 0) {
      defender.fainted = true;
      defSprite.classList.add('anim-faint');
      playSfx('assets/sfx_faint.wav');
      await wait(700);

      if (isPlayer) {
        // Le Pokémon adverse est K.O.
        await handleOpponentFaint();
      } else {
        // Notre Pokémon est K.O.
        await handlePlayerFaint();
      }
    }
  }

  async function handleOpponentFaint() {
    battleOver = true;
    bgm.pause();
    playSfx('assets/sfx_victory.wav');
    setDialogue(`${wildPoke.name} est K.O. !`);
    await wait(1200);

    // Gain d'expérience
    const expYield = Math.floor((wildPoke.baseExp * wildPoke.level) / 7);
    activePlayerPoke.exp += expYield;
    setDialogue(`${activePlayerPoke.name} gagne ${expYield} points d'expérience !`);
    updateHUD();
    await wait(1200);

    // Montée de niveau
    if (checkLevelUp(activePlayerPoke)) {
      setDialogue(`Incroyable ! ${activePlayerPoke.name} monte au Niveau ${activePlayerPoke.level} !`);
      updateHUD();
      await wait(1400);
    }

    const moneyWon = wildPoke.level * 40;
    player.money = (player.money || 0) + moneyWon;
    player.stats.battlesWon = (player.stats.battlesWon || 0) + 1;
    setDialogue(`Vous remportez ${moneyWon} ₽ !`);
    await wait(1200);

    finishBattle('won');
  }

  async function handlePlayerFaint() {
    setDialogue(`${activePlayerPoke.name} est K.O. !`);
    await wait(1200);

    const nextAlive = player.party.find(p => !p.fainted && p.currentHp > 0);
    if (nextAlive) {
      setDialogue(`Au combat, ${nextAlive.name} !`);
      await wait(800);
      switchPokemon(nextAlive);
      isAnimating = false;
      renderMainMenu();
    } else {
      battleOver = true;
      bgm.pause();
      setDialogue(`Tous vos Pokémon sont K.O. ! Vous retournez au Centre Pokémon de Menton...`);
      await wait(2200);
      finishBattle('lost');
    }
  }

  function switchPokemon(newPoke) {
    activePlayerPoke = newPoke;
    playerSprite.src = spriteUrls(newPoke.id).back;
    playerSprite.className = 'adv-poke-sprite back anim-enter';
    playSfx('assets/sfx_switch.wav');
    updateHUD();
    setDialogue(`À toi, ${newPoke.name} !`);
    setTimeout(() => {
      playerSprite.classList.remove('anim-enter');
      renderMainMenu();
    }, 600);
  }

  // --- CAPTURE & OBJETS ---
  async function useItemInBattle(itemKey) {
    if (isAnimating || battleOver) return;
    isAnimating = true;
    menuEl.innerHTML = '';

    const def = ITEMS[itemKey];
    player.inventory[itemKey] = (player.inventory[itemKey] || 1) - 1;
    if (player.inventory[itemKey] <= 0) delete player.inventory[itemKey];

    if (def.category === 'ball') {
      if (!isWild) {
        setDialogue("Impossible de capturer le Pokémon d'un autre dresseur !");
        await wait(1200);
        isAnimating = false;
        renderMainMenu();
        return;
      }

      setDialogue(`Vous lancez une ${def.name} !`);
      pokeballThrow.style.display = 'block';
      pokeballThrow.className = 'adv-pokeball-throw anim-ball-arc';
      playSfx('assets/sfx_switch.wav');
      await wait(700);

      // Le Pokémon sauvage est aspiré
      oppSprite.classList.add('anim-caught-shrink');
      await wait(500);

      pokeballThrow.className = 'adv-pokeball-throw landed';

      // Test de capture
      const catchResult = calculateCatchSuccess(wildPoke, def.rate || 1.0);

      // Shakes de la Poké Ball
      for (let s = 0; s < catchResult.shakes; s++) {
        await wait(600);
        pokeballThrow.classList.add('wobble');
        playSfx('assets/sfx_hit_weak.wav', 0.4);
        await wait(300);
        pokeballThrow.classList.remove('wobble');
      }

      await wait(600);

      if (catchResult.success) {
        // CAPTURÉ !
        battleOver = true;
        bgm.pause();
        playSfx('assets/sfx_victory.wav');
        pokeballThrow.classList.add('captured-stars');
        setDialogue(`Génial ! ${wildPoke.name} a été capturé !`);
        await wait(1800);
        finishBattle('caught', wildPoke);
        return;
      } else {
        // Libéré
        pokeballThrow.style.display = 'none';
        oppSprite.classList.remove('anim-caught-shrink');
        oppSprite.classList.add('anim-break-free');
        setDialogue(`Mince ! ${wildPoke.name} s'est libéré !`);
        await wait(1200);
        oppSprite.classList.remove('anim-break-free');

        // L'adversaire attaque en riposte
        await performAttack('opp');
        if (battleOver) return;
        isAnimating = false;
        renderMainMenu();
      }
    } else if (def.category === 'heal') {
      // Potion ou Citron de Menton
      const healAmount = def.heal || 20;
      activePlayerPoke.currentHp = Math.min(activePlayerPoke.maxHp, activePlayerPoke.currentHp + healAmount);
      if (def.cureStatus) activePlayerPoke.status = null;
      updateHUD();
      playSfx('assets/sfx_switch.wav');
      setDialogue(`Vous utilisez un ${def.name} sur ${activePlayerPoke.name} ! (+${healAmount} PV)`);
      await wait(1200);

      // Riposte adverse
      await performAttack('opp');
      if (battleOver) return;
      isAnimating = false;
      renderMainMenu();
    }
  }

  function handleRun() {
    if (isAnimating || battleOver) return;
    bgm.pause();
    setDialogue("Vous prenez la fuite en vitesse !");
    setTimeout(() => {
      finishBattle('fled');
    }, 800);
  }

  function finishBattle(result, caughtPoke = null) {
    bgm.pause();
    container.innerHTML = '';
    onEnd({
      result,
      caughtPokemon: caughtPoke,
      activePokemon: activePlayerPoke
    });
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Démarrer avec le menu principal
  renderMainMenu();
}
