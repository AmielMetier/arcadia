// pokemon/adventure/battle.js
// Système de combat complet pour le Mode Aventure (Rencontres Sauvages, Dresseurs PNJ,
// Championne d'Arène Solène et Duels JcJ).
// Inclut : statut/stages, précision, coups critiques, animations de capture Poké Ball,
// évolution en direct, cris Pokémon authentiques (PokéAPI) et décor de Menton.

import { MOVES, spriteUrls, calculateCatchSuccess, checkLevelUp, ITEMS } from './data.js';
import { getEffectiveness, TYPE_FR, TYPE_COLORS } from '../engine/types.js';
import { sfx } from '../view/sfx.js';
import { registerSeen } from './player.js';

function stageMult(stage = 0) {
  const s = Math.max(-6, Math.min(6, stage));
  return s >= 0 ? (2 + s) / 2 : 2 / (2 - s);
}

const STAT_NAMES_FR = {
  atk: 'Attaque',
  def: 'Défense',
  spa: 'Attaque Spé.',
  spd: 'Défense Spé.',
  spe: 'Vitesse'
};

export function startAdventureBattle(container, {
  player,
  opponentPokemon,
  opponentParty,
  trainerInfo = null,
  isWild = true,
  onEnd
}) {
  let activePlayerPoke = player.party.find(p => !p.fainted && p.currentHp > 0);
  if (!activePlayerPoke) {
    onEnd({ result: 'lost' });
    return;
  }

  // Préparer l'équipe adverse (1 Pokémon sauvage ou plusieurs pour un Dresseur/Champion)
  const rawEnemyList = Array.isArray(opponentParty) && opponentParty.length > 0
    ? opponentParty
    : [opponentPokemon];

  const enemyParty = rawEnemyList.map(p => ({
    ...p,
    currentHp: p.currentHp ?? p.maxHp,
    fainted: false,
    status: p.status || null,
    sleepTurns: 0,
    statStages: { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 }
  }));

  let enemyIndex = 0;
  let wildPoke = enemyParty[enemyIndex];
  registerSeen(player, wildPoke.id);

  for (const p of player.party) {
    p.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
    p.sleepTurns = 0;
  }

  let isAnimating = false;
  let battleOver = false;

  const hasTrainerIntro = !isWild && trainerInfo && trainerInfo.portrait;
  sfx.init();
  sfx.startBgm();
  if (!hasTrainerIntro) {
    setTimeout(() => sfx.playCry(wildPoke.id), 250);
  }

  function renderPokeballsTray(partyList) {
    return partyList.map(p => {
      const alive = !p.fainted && p.currentHp > 0;
      return `<span class="adv-tray-ball ${alive ? 'alive' : 'ko'}"></span>`;
    }).join('');
  }

  function renderStatusBadge(status) {
    if (!status) return '';
    const labels = {
      burn: 'BRÛL',
      paralysis: 'PARA',
      poison: 'PSN',
      toxic: 'TOX',
      sleep: 'SOM',
      freeze: 'GEL'
    };
    return `<span class="adv-status-pill st-${status}">${labels[status] || status.toUpperCase()}</span>`;
  }

  // Interface HTML du combat avec fond de Menton
  container.innerHTML = `
    <div class="adv-battle-screen">
      <div class="adv-battle-arena">
        <!-- Zone Sauvage / Adversaire (Haut Droite) -->
        <div class="adv-side top">
          <div class="adv-hud top">
            <div class="adv-hud-toprow">
              <span class="adv-combat-tag">${isWild ? 'POKÉMON SAUVAGE' : (trainerInfo ? trainerInfo.name.toUpperCase() : 'DRESSEUR')}</span>
              <div class="adv-tray" id="oppTray">${renderPokeballsTray(enemyParty)}</div>
            </div>
            <div class="adv-hud-name">
              <span class="poke-name" id="oppName">${wildPoke.name}</span>
              <div class="adv-hud-badges">
                <span id="oppStatus">${renderStatusBadge(wildPoke.status)}</span>
                <span class="poke-level" id="oppLevel">N.${wildPoke.level}</span>
              </div>
            </div>
            <div class="adv-hp-bar-wrap">
              <div class="adv-hp-fill" id="oppHpFill" style="width: ${(wildPoke.currentHp / wildPoke.maxHp) * 100}%"></div>
            </div>
            <div class="adv-hp-text" id="oppHpText">${wildPoke.currentHp} / ${wildPoke.maxHp} PV</div>
          </div>

          <div class="adv-platform-opp">
            ${hasTrainerIntro ? `<img class="adv-trainer-avatar" id="oppTrainerAvatar" src="${trainerInfo.portrait}" alt="${trainerInfo.name}">` : ''}
            <div class="damage-popup-anchor" id="oppPopupAnchor"></div>
            <img class="adv-poke-sprite front ${hasTrainerIntro ? '' : 'anim-enter'}" id="oppSprite" src="${spriteUrls(wildPoke.id).front}" alt="${wildPoke.name}" style="${hasTrainerIntro ? 'opacity:0;' : ''}">
            <img class="adv-pokeball-throw" id="pokeballThrow" src="assets/items/poke-ball.png" alt="ball">
          </div>
        </div>

        <!-- Zone Joueur (Bas Gauche) -->
        <div class="adv-side bottom">
          <div class="adv-platform-player">
            <div class="damage-popup-anchor" id="playerPopupAnchor"></div>
            <img class="adv-poke-sprite back anim-enter" id="playerSprite" src="${spriteUrls(activePlayerPoke.id).back}" alt="${activePlayerPoke.name}">
          </div>
          <div class="adv-hud bottom">
            <div class="adv-hud-toprow">
              <span class="adv-combat-tag">${player.name.toUpperCase()}</span>
              <div class="adv-tray" id="playerTray">${renderPokeballsTray(player.party)}</div>
            </div>
            <div class="adv-hud-name">
              <span class="poke-name" id="playerName">${activePlayerPoke.name}</span>
              <div class="adv-hud-badges">
                <span id="playerStatus">${renderStatusBadge(activePlayerPoke.status)}</span>
                <span class="poke-level" id="playerLevel">N.${activePlayerPoke.level}</span>
              </div>
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
          ${isWild ? `Un ${wildPoke.name} sauvage (N.${wildPoke.level}) apparaît !` : (hasTrainerIntro ? `${trainerInfo.name} veut se battre !` : `${trainerInfo ? trainerInfo.name : 'Le dresseur'} envoie ${wildPoke.name} !`)}
        </div>
        <div class="adv-battle-menu" id="battleMenu"></div>
      </div>
    </div>
  `;

  const oppHpFill = container.querySelector('#oppHpFill');
  const oppHpText = container.querySelector('#oppHpText');
  const playerHpFill = container.querySelector('#playerHpFill');
  const playerHpText = container.querySelector('#playerHpText');
  const playerExpFill = container.querySelector('#playerExpFill');
  const oppSprite = container.querySelector('#oppSprite');
  const playerSprite = container.querySelector('#playerSprite');
  const pokeballThrow = container.querySelector('#pokeballThrow');
  const dialogueEl = container.querySelector('#battleDialogue');
  const menuEl = container.querySelector('#battleMenu');

  function showPopup(side, text, isCrit = false, isHeal = false) {
    const anchor = container.querySelector(side === 'opp' ? '#oppPopupAnchor' : '#playerPopupAnchor');
    if (!anchor) return;
    const pop = document.createElement('div');
    pop.className = `damage-popup ${isCrit ? 'crit' : ''}`;
    if (isHeal) pop.style.color = '#4ade80';
    pop.textContent = text;
    anchor.appendChild(pop);
    setTimeout(() => pop.remove(), 1000);
  }

  function updateHUD() {
    const oppRatio = Math.max(0, wildPoke.currentHp / wildPoke.maxHp);
    oppHpFill.style.width = `${oppRatio * 100}%`;
    oppHpFill.className = `adv-hp-fill ${oppRatio < 0.2 ? 'danger' : oppRatio < 0.5 ? 'warn' : ''}`;
    oppHpText.textContent = `${wildPoke.currentHp} / ${wildPoke.maxHp} PV`;
    container.querySelector('#oppName').textContent = wildPoke.name;
    container.querySelector('#oppLevel').textContent = `N.${wildPoke.level}`;
    container.querySelector('#oppStatus').innerHTML = renderStatusBadge(wildPoke.status);
    container.querySelector('#oppTray').innerHTML = renderPokeballsTray(enemyParty);

    const playRatio = Math.max(0, activePlayerPoke.currentHp / activePlayerPoke.maxHp);
    playerHpFill.style.width = `${playRatio * 100}%`;
    playerHpFill.className = `adv-hp-fill ${playRatio < 0.2 ? 'danger' : playRatio < 0.5 ? 'warn' : ''}`;
    playerHpText.textContent = `${activePlayerPoke.currentHp} / ${activePlayerPoke.maxHp} PV`;

    const curBase = Math.pow(activePlayerPoke.level, 3);
    const expRatio = Math.min(1, Math.max(0, (activePlayerPoke.exp - curBase) / (activePlayerPoke.expNext - curBase)));
    playerExpFill.style.width = `${expRatio * 100}%`;

    container.querySelector('#playerName').textContent = activePlayerPoke.name;
    container.querySelector('#playerLevel').textContent = `N.${activePlayerPoke.level}`;
    container.querySelector('#playerStatus').innerHTML = renderStatusBadge(activePlayerPoke.status);
    container.querySelector('#playerTray').innerHTML = renderPokeballsTray(player.party);
  }

  function setDialogue(msg) {
    dialogueEl.textContent = msg;
  }

  function renderMainMenu() {
    if (battleOver) return;
    menuEl.innerHTML = `
      <div class="adv-menu-grid">
        <button class="adv-btn attack-btn" id="btnFight">ATTAQUE</button>
        <button class="adv-btn bag-btn" id="btnBag">SAC</button>
        <button class="adv-btn poke-btn" id="btnPoke">ÉQUIPE</button>
        <button class="adv-btn run-btn" id="btnRun">${isWild ? 'FUITE' : 'ABANDON'}</button>
      </div>
    `;
    menuEl.querySelector('#btnFight').onclick = () => { sfx.playClick(); renderMovesMenu(); };
    menuEl.querySelector('#btnBag').onclick = () => { sfx.playClick(); renderBagMenu(); };
    menuEl.querySelector('#btnPoke').onclick = () => { sfx.playClick(); renderSwitchMenu(false); };
    menuEl.querySelector('#btnRun').onclick = () => { sfx.playClick(); handleRun(); };
  }

  function renderMovesMenu() {
    const moves = activePlayerPoke.moves.map(mKey => MOVES[mKey] || { name: mKey, type: 'normal', power: 40, cat: 'physical' });
    menuEl.innerHTML = `
      <div class="adv-moves-grid">
        ${moves.map((m, i) => {
          const eff = m.cat === 'status' ? 1 : getEffectiveness(m.type, wildPoke.types);
          const effTag = m.cat === 'status'
            ? '<span class="adv-eff-pill st">STATUT</span>'
            : (eff >= 2
              ? `<span class="adv-eff-pill super">×${eff} SUPER</span>`
              : (eff === 0
                ? '<span class="adv-eff-pill zero">×0 IMMUN.</span>'
                : (eff < 1 ? `<span class="adv-eff-pill low">×${eff} PEU EFF.</span>` : '')));
          const bgCol = TYPE_COLORS[m.type] || '#475569';
          return `
            <button class="adv-move-card" data-idx="${i}" style="border-left: 4px solid ${bgCol}">
              <div class="m-top">
                <span class="m-name">${m.name}</span>
                ${effTag}
              </div>
              <span class="m-info">${(TYPE_FR[m.type] || m.type).toUpperCase()} • ${m.cat === 'status' ? 'STATUT' : `PUIS ${m.power || '-'}`}</span>
            </button>
          `;
        }).join('')}
        <button class="adv-move-back" id="btnBack">RETOUR</button>
      </div>
    `;
    menuEl.querySelectorAll('.adv-move-card').forEach(btn => {
      btn.onclick = () => {
        sfx.playSelect();
        const idx = parseInt(btn.dataset.idx, 10);
        executeTurn(activePlayerPoke.moves[idx]);
      };
    });
    menuEl.querySelector('#btnBack').onclick = () => { sfx.playClick(); renderMainMenu(); };
  }

  function renderBagMenu() {
    const inv = player.inventory || {};
    const itemsList = Object.entries(inv).map(([key, count]) => {
      const def = ITEMS[key] || { name: key, desc: '', icon: 'assets/items/poke-ball.png' };
      return { key, count, ...def };
    }).filter(i => i.count > 0);

    menuEl.innerHTML = `
      <div class="adv-bag-list">
        ${itemsList.length === 0 ? '<div class="adv-empty-bag">Votre sac est vide !</div>' : ''}
        ${itemsList.map(it => `
          <button class="adv-item-row" data-key="${it.key}">
            <div style="display:flex;align-items:center;gap:8px;">
              ${it.icon ? `<img src="${it.icon}" alt="" style="width:22px;height:22px;image-rendering:pixelated;">` : ''}
              <span class="it-name">${it.name} <b>x${it.count}</b></span>
            </div>
            <span class="it-desc">${it.desc}</span>
          </button>
        `).join('')}
        <button class="adv-move-back" id="btnBack">RETOUR</button>
      </div>
    `;

    menuEl.querySelectorAll('.adv-item-row').forEach(btn => {
      btn.onclick = () => {
        sfx.playSelect();
        useItemInBattle(btn.dataset.key);
      };
    });
    menuEl.querySelector('#btnBack').onclick = () => { sfx.playClick(); renderMainMenu(); };
  }

  function renderSwitchMenu(forced = false) {
    const party = player.party;
    menuEl.innerHTML = `
      <div class="adv-switch-list">
        ${party.map((p, i) => `
          <button class="adv-party-row ${p === activePlayerPoke ? 'active' : ''} ${p.fainted ? 'fainted' : ''}" data-idx="${i}" ${p.fainted || p === activePlayerPoke ? 'disabled' : ''}>
            <div style="display:flex;align-items:center;gap:8px;">
              <img src="${spriteUrls(p.id).icon}" alt="" style="width:28px;height:28px;image-rendering:pixelated;">
              <span class="pr-name">${p.name} (N.${p.level})</span>
            </div>
            <span class="pr-hp">${p.currentHp}/${p.maxHp} PV</span>
          </button>
        `).join('')}
        ${forced ? '' : '<button class="adv-move-back" id="btnBack">RETOUR</button>'}
      </div>
    `;

    menuEl.querySelectorAll('.adv-party-row').forEach(btn => {
      btn.onclick = async () => {
        sfx.playSelect();
        const idx = parseInt(btn.dataset.idx, 10);
        await switchPokemon(party[idx], !forced);
      };
    });
    const backBtn = menuEl.querySelector('#btnBack');
    if (backBtn) backBtn.onclick = () => { sfx.playClick(); renderMainMenu(); };
  }

  // --- ACTIONS DU COMBAT ---
  async function executeTurn(playerMoveKey) {
    if (isAnimating || battleOver) return;
    isAnimating = true;
    menuEl.innerHTML = '';

    const pMove = MOVES[playerMoveKey] || { name: playerMoveKey, power: 40, type: 'normal', cat: 'physical', priority: 0 };

    // Choix intelligent de l'attaque adverse
    const oppMoveKeys = wildPoke.moves && wildPoke.moves.length ? wildPoke.moves : ['tackle'];
    let bestKey = oppMoveKeys[Math.floor(Math.random() * oppMoveKeys.length)];
    if (!isWild && Math.random() < 0.7) {
      let bestScore = -1;
      for (const mk of oppMoveKeys) {
        const md = MOVES[mk];
        if (!md) continue;
        const eff = md.cat === 'status' ? 0.8 : getEffectiveness(md.type, activePlayerPoke.types);
        const score = (md.power || 40) * eff;
        if (score > bestScore) {
          bestScore = score;
          bestKey = mk;
        }
      }
    }
    const oMove = MOVES[bestKey] || { name: 'Charge', power: 40, type: 'normal', cat: 'physical', priority: 0 };

    const pPrio = pMove.priority || 0;
    const oPrio = oMove.priority || 0;
    const pSpe = activePlayerPoke.stats.spe * stageMult(activePlayerPoke.statStages?.spe || 0) * (activePlayerPoke.status === 'paralysis' ? 0.5 : 1);
    const oSpe = wildPoke.stats.spe * stageMult(wildPoke.statStages?.spe || 0) * (wildPoke.status === 'paralysis' ? 0.5 : 1);

    const playerFirst = pPrio !== oPrio ? pPrio > oPrio : pSpe >= oSpe;

    const first = playerFirst ? { side: 'player', move: pMove } : { side: 'opp', move: oMove };
    const second = playerFirst ? { side: 'opp', move: oMove } : { side: 'player', move: pMove };

    await performAttack(first.side, first.move);
    if (battleOver) return;

    await wait(550);
    // Vérifier que le second attaquant est toujours en vie
    const secPoke = second.side === 'player' ? activePlayerPoke : wildPoke;
    if (!secPoke.fainted && secPoke.currentHp > 0) {
      await performAttack(second.side, second.move);
      if (battleOver) return;
    }

    // Dégâts résiduels de fin de tour (Brûlure / Poison)
    await applyResidualDamage('player', activePlayerPoke);
    if (battleOver) return;
    await applyResidualDamage('opp', wildPoke);
    if (battleOver) return;

    isAnimating = false;
    renderMainMenu();
  }

  async function applyResidualDamage(side, poke) {
    if (poke.fainted || poke.currentHp <= 0 || !poke.status) return;
    if (poke.status === 'burn' || poke.status === 'poison' || poke.status === 'toxic') {
      const dmg = Math.max(1, Math.floor(poke.maxHp / 8));
      poke.currentHp = Math.max(0, poke.currentHp - dmg);
      const label = poke.status === 'burn' ? 'sa brûlure' : 'le poison';
      setDialogue(`${poke.name} souffre de ${label} ! (-${dmg} PV)`);
      showPopup(side, `-${dmg}`);
      updateHUD();
      await wait(700);
      if (poke.currentHp <= 0) {
        poke.fainted = true;
        const spr = side === 'player' ? playerSprite : oppSprite;
        spr.classList.add('anim-faint');
        sfx.playFaint();
        await wait(700);
        if (side === 'opp') await handleOpponentFaint();
        else await handlePlayerFaint();
      }
    }
  }

  async function performAttack(side, m) {
    if (battleOver) return;
    const isPlayer = side === 'player';
    const attacker = isPlayer ? activePlayerPoke : wildPoke;
    const defender = isPlayer ? wildPoke : activePlayerPoke;
    const atkSprite = isPlayer ? playerSprite : oppSprite;
    const defSprite = isPlayer ? oppSprite : playerSprite;
    const defSide = isPlayer ? 'opp' : 'player';

    if (attacker.fainted || attacker.currentHp <= 0) return;

    // Gestion Sommeil / Paralysie / Gel
    if (attacker.status === 'sleep') {
      attacker.sleepTurns = (attacker.sleepTurns || 0) + 1;
      if (attacker.sleepTurns >= 2 || Math.random() < 0.5) {
        attacker.status = null;
        attacker.sleepTurns = 0;
        updateHUD();
        setDialogue(`${attacker.name} se réveille !`);
        await wait(600);
      } else {
        setDialogue(`${attacker.name} dort profondément...`);
        await wait(700);
        return;
      }
    }
    if (attacker.status === 'freeze') {
      if (m.type === 'fire' || Math.random() < 0.25) {
        attacker.status = null;
        updateHUD();
        setDialogue(`${attacker.name} dégèle !`);
        await wait(600);
      } else {
        setDialogue(`${attacker.name} est gelé et ne peut pas bouger !`);
        await wait(700);
        return;
      }
    }
    if (attacker.status === 'paralysis' && Math.random() < 0.25) {
      setDialogue(`${attacker.name} est paralysé et ne peut pas attaquer !`);
      await wait(700);
      return;
    }

    setDialogue(`${attacker.name} utilise ${m.name} !`);
    atkSprite.classList.add(isPlayer ? 'anim-lunge-player' : 'anim-lunge-opponent');
    await wait(380);
    atkSprite.classList.remove('anim-lunge-player', 'anim-lunge-opponent');

    // Précision
    const acc = m.acc || 100;
    if (Math.random() * 100 > acc) {
      sfx.playMiss();
      setDialogue(`L'attaque de ${attacker.name} a échoué !`);
      await wait(700);
      return;
    }

    // --- CAPACITÉ DE STATUT (ex: Rugissement, Mimi-Queue, Trempette, Danse Draco, Soin) ---
    if (m.cat === 'status') {
      if (m.name === 'Trempette' || (!m.heal && !m.status && !m.stat && !m.stats)) {
        sfx.playHit(0.5);
        setDialogue(`Mais rien ne se passe !`);
        await wait(700);
        return;
      }

      if (m.heal) {
        const healAmt = Math.max(1, Math.floor(attacker.maxHp * m.heal));
        attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmt);
        sfx.playStatChange(1);
        showPopup(isPlayer ? 'player' : 'opp', `+${healAmt} PV`, false, true);
        updateHUD();
        setDialogue(`${attacker.name} restaure ses PV !`);
        await wait(700);
        return;
      }

      if (m.status) {
        if (defender.status) {
          setDialogue(`Mais cela échoue !`);
        } else {
          defender.status = m.status;
          sfx.playStatChange(-1);
          updateHUD();
          setDialogue(`${defender.name} subit une altération d'état !`);
        }
        await wait(700);
        return;
      }

      const statChanges = m.stats ? m.stats : (m.stat ? { [m.stat]: m.stage } : null);
      if (statChanges) {
        const isSelf = (m.stage && m.stage > 0) || Object.values(statChanges)[0] > 0;
        const target = isSelf ? attacker : defender;
        if (!target.statStages) target.statStages = { atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
        for (const [st, delta] of Object.entries(statChanges)) {
          target.statStages[st] = Math.max(-6, Math.min(6, (target.statStages[st] || 0) + delta));
          sfx.playStatChange(delta);
          const dirTxt = delta > 0 ? 'augmente' : 'diminue';
          setDialogue(`${STAT_NAMES_FR[st] || st} de ${target.name} ${dirTxt} !`);
          await wait(600);
        }
      }
      return;
    }

    // --- CAPACITÉ OFFENSIVE ---
    const eff = getEffectiveness(m.type, defender.types);
    if (eff === 0) {
      sfx.playMiss();
      setDialogue(`Ça n'affecte pas ${defender.name}...`);
      await wait(700);
      return;
    }

    const isPhys = m.cat === 'physical';
    const atkStage = attacker.statStages?.[isPhys ? 'atk' : 'spa'] || 0;
    const defStage = defender.statStages?.[isPhys ? 'def' : 'spd'] || 0;
    const atkVal = attacker.stats[isPhys ? 'atk' : 'spa'] * stageMult(atkStage) * (isPhys && attacker.status === 'burn' ? 0.5 : 1);
    const defVal = defender.stats[isPhys ? 'def' : 'spd'] * stageMult(defStage);
    const stab = attacker.types.includes(m.type) ? 1.5 : 1.0;
    const isCrit = Math.random() < (m.crit ? 0.25 : 0.0625);
    const critMult = isCrit ? 1.5 : 1.0;
    const rand = 0.85 + Math.random() * 0.15;
    const power = m.power || 40;

    const base = (((2 * attacker.level / 5 + 2) * power * (atkVal / defVal)) / 50 + 2);
    const dmg = Math.max(1, Math.floor(base * eff * stab * critMult * rand));

    defender.currentHp = Math.max(0, defender.currentHp - dmg);

    defSprite.classList.add('anim-hit');
    sfx.playHit(eff);
    showPopup(defSide, isCrit ? `-${dmg} CRIT!` : `-${dmg}`, isCrit);

    updateHUD();
    await wait(500);
    defSprite.classList.remove('anim-hit');

    if (isCrit) {
      setDialogue('Coup critique !');
      await wait(500);
    }
    if (eff >= 2) {
      setDialogue("C'est super efficace !");
      await wait(550);
    } else if (eff < 1) {
      setDialogue("Ce n'est pas très efficace...");
      await wait(550);
    }

    // Vol de vie (Giga-Sangsue)
    if (m.drain && dmg > 0) {
      const drained = Math.max(1, Math.floor(dmg * m.drain));
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + drained);
      showPopup(isPlayer ? 'player' : 'opp', `+${drained}`, false, true);
      updateHUD();
    }

    // Effet secondaire de statut
    if (defender.currentHp > 0 && m.status && !defender.status && Math.random() * 100 < (m.chance || 100)) {
      defender.status = m.status;
      updateHUD();
      setDialogue(`${defender.name} subit un effet secondaire !`);
      await wait(550);
    }

    // K.O. check
    if (defender.currentHp <= 0) {
      defender.fainted = true;
      defSprite.classList.add('anim-faint');
      sfx.playFaint();
      await wait(750);

      if (isPlayer) {
        await handleOpponentFaint();
      } else {
        await handlePlayerFaint();
      }
    }
  }

  async function handleOpponentFaint() {
    setDialogue(`${wildPoke.name} ennemi est K.O. !`);
    updateHUD();
    await wait(1000);

    // Gain d'expérience (bonus x1.5 si combat de dresseur)
    const trainerBonus = isWild ? 1 : 1.5;
    const expYield = Math.max(12, Math.floor((wildPoke.baseExp * wildPoke.level * trainerBonus) / 5));
    activePlayerPoke.exp += expYield;
    setDialogue(`${activePlayerPoke.name} gagne ${expYield} points d'EXP !`);
    updateHUD();
    await wait(1000);

    // Montée de niveau & Évolution !
    if (checkLevelUp(activePlayerPoke)) {
      sfx.playLevelUp();
      setDialogue(`Niveau supérieur ! ${activePlayerPoke.name} passe au Niveau ${activePlayerPoke.level} !`);
      updateHUD();
      await wait(1400);

      const info = activePlayerPoke.lastLevelUp;
      if (info) {
        if (info.evolvedFrom && info.evolvedTo) {
          sfx.playLevelUp();
          playerSprite.src = spriteUrls(activePlayerPoke.id).back;
          updateHUD();
          setDialogue(`Quoi ?! Votre ${info.evolvedFrom} évolue en ${info.evolvedTo} !`);
          await wait(1800);
        }
        if (info.newMoves && info.newMoves.length > 0) {
          for (const nm of info.newMoves) {
            setDialogue(`${activePlayerPoke.name} apprend la capacité ${nm} !`);
            await wait(1200);
          }
        }
        delete activePlayerPoke.lastLevelUp;
      }
    }

    // Vérifier s'il reste un Pokémon à l'adversaire (Dresseur / Championne)
    const nextEnemyIdx = enemyParty.findIndex(p => !p.fainted && p.currentHp > 0);
    if (nextEnemyIdx !== -1) {
      enemyIndex = nextEnemyIdx;
      wildPoke = enemyParty[enemyIndex];
      registerSeen(player, wildPoke.id);
      oppSprite.classList.remove('anim-faint');
      oppSprite.src = spriteUrls(wildPoke.id).front;
      oppSprite.classList.add('anim-enter');
      sfx.playSwitch();
      setTimeout(() => sfx.playCry(wildPoke.id), 200);
      updateHUD();
      setDialogue(`${trainerInfo ? trainerInfo.name : 'Le dresseur'} envoie ${wildPoke.name} (N.${wildPoke.level}) !`);
      await wait(1100);
      oppSprite.classList.remove('anim-enter');
      isAnimating = false;
      renderMainMenu();
      return;
    }

    // Victoire totale !
    battleOver = true;
    sfx.stopBgm();
    sfx.playVictory();

    const moneyWon = trainerInfo?.rewardMoney || (wildPoke.level * 45);
    player.money = (player.money || 0) + moneyWon;
    player.stats.battlesWon = (player.stats.battlesWon || 0) + 1;

    if (trainerInfo && trainerInfo.outro) {
      setDialogue(`${trainerInfo.name} : "${trainerInfo.outro}"`);
      await wait(1800);
    }

    setDialogue(`Vous remportez la victoire et gagnez ${moneyWon} ₽ !`);
    await wait(1300);

    finishBattle('won');
  }

  async function handlePlayerFaint() {
    setDialogue(`${activePlayerPoke.name} est K.O. !`);
    updateHUD();
    await wait(1000);

    const nextAlive = player.party.find(p => !p.fainted && p.currentHp > 0);
    if (nextAlive) {
      setDialogue(`Choisissez le prochain Pokémon à envoyer au combat :`);
      renderSwitchMenu(true);
    } else {
      battleOver = true;
      sfx.stopBgm();
      setDialogue(`Tous vos Pokémon sont K.O. ! Vous courez jusqu'au Centre Pokémon de Menton...`);
      await wait(2200);
      finishBattle('lost');
    }
  }

  async function switchPokemon(newPoke, costsTurn = false) {
    isAnimating = true;
    menuEl.innerHTML = '';
    activePlayerPoke = newPoke;
    playerSprite.classList.remove('anim-faint');
    playerSprite.src = spriteUrls(newPoke.id).back;
    playerSprite.className = 'adv-poke-sprite back anim-enter';
    sfx.playSwitch();
    setTimeout(() => sfx.playCry(newPoke.id), 180);
    updateHUD();
    setDialogue(`À toi, ${newPoke.name} !`);
    await wait(700);
    playerSprite.classList.remove('anim-enter');

    if (costsTurn && !battleOver) {
      const oppMoveKeys = wildPoke.moves && wildPoke.moves.length ? wildPoke.moves : ['tackle'];
      const chosenKey = oppMoveKeys[Math.floor(Math.random() * oppMoveKeys.length)];
      const oMove = MOVES[chosenKey] || { name: 'Charge', power: 40, type: 'normal', cat: 'physical' };
      await performAttack('opp', oMove);
      if (battleOver) return;
    }

    isAnimating = false;
    renderMainMenu();
  }

  // --- CAPTURE & OBJETS ---
  async function useItemInBattle(itemKey) {
    if (isAnimating || battleOver) return;
    const def = ITEMS[itemKey];
    if (!def) return;

    if (def.category === 'ball' && !isWild) {
      setDialogue("Impossible de capturer le Pokémon d'un autre dresseur !");
      return;
    }

    isAnimating = true;
    menuEl.innerHTML = '';

    player.inventory[itemKey] = (player.inventory[itemKey] || 1) - 1;
    if (player.inventory[itemKey] <= 0) delete player.inventory[itemKey];

    if (def.category === 'ball') {
      setDialogue(`Vous lancez une ${def.name} !`);
      pokeballThrow.src = def.icon || 'assets/items/poke-ball.png';
      pokeballThrow.style.display = 'block';
      pokeballThrow.className = 'adv-pokeball-throw anim-ball-arc';
      sfx.playSwitch();
      await wait(700);

      oppSprite.classList.add('anim-caught-shrink');
      await wait(500);

      pokeballThrow.className = 'adv-pokeball-throw landed';

      const catchResult = calculateCatchSuccess(wildPoke, def.rate || 1.0);

      for (let s = 0; s < catchResult.shakes; s++) {
        await wait(550);
        pokeballThrow.classList.add('wobble');
        sfx.playBallWobble(s);
        await wait(300);
        pokeballThrow.classList.remove('wobble');
      }

      await wait(550);

      if (catchResult.success) {
        battleOver = true;
        sfx.stopBgm();
        sfx.playVictory();
        pokeballThrow.classList.add('captured-stars');
        setDialogue(`Génial ! ${wildPoke.name} a été capturé !`);
        await wait(1800);
        finishBattle('caught', wildPoke);
        return;
      } else {
        pokeballThrow.style.display = 'none';
        oppSprite.classList.remove('anim-caught-shrink');
        oppSprite.classList.add('anim-break-free');
        sfx.playCry(wildPoke.id);
        setDialogue(`Mince ! ${wildPoke.name} s'est libéré !`);
        await wait(1100);
        oppSprite.classList.remove('anim-break-free');

        const oppMoveKeys = wildPoke.moves && wildPoke.moves.length ? wildPoke.moves : ['tackle'];
        const oMove = MOVES[oppMoveKeys[Math.floor(Math.random() * oppMoveKeys.length)]];
        await performAttack('opp', oMove);
        if (battleOver) return;
        isAnimating = false;
        renderMainMenu();
      }
    } else if (def.category === 'heal') {
      if (def.revive) {
        const faintedPoke = player.party.find(p => p.fainted || p.currentHp <= 0);
        if (!faintedPoke) {
          // Rembourser l'objet si aucun K.O.
          player.inventory[itemKey] = (player.inventory[itemKey] || 0) + 1;
          setDialogue('Aucun Pokémon de votre équipe n\'est K.O. !');
          await wait(900);
          isAnimating = false;
          renderMainMenu();
          return;
        }
        faintedPoke.fainted = false;
        faintedPoke.currentHp = Math.max(1, Math.floor(faintedPoke.maxHp / 2));
        faintedPoke.status = null;
        sfx.playItem();
        updateHUD();
        setDialogue(`${faintedPoke.name} revient au combat grâce au ${def.name} !`);
      } else {
        const healAmount = def.heal || 20;
        activePlayerPoke.currentHp = Math.min(activePlayerPoke.maxHp, activePlayerPoke.currentHp + healAmount);
        if (def.cureStatus) activePlayerPoke.status = null;
        sfx.playItem();
        showPopup('player', `+${healAmount} PV`, false, true);
        updateHUD();
        setDialogue(`Vous utilisez ${def.name} sur ${activePlayerPoke.name} !`);
      }
      await wait(1100);

      const oppMoveKeys = wildPoke.moves && wildPoke.moves.length ? wildPoke.moves : ['tackle'];
      const oMove = MOVES[oppMoveKeys[Math.floor(Math.random() * oppMoveKeys.length)]];
      await performAttack('opp', oMove);
      if (battleOver) return;
      isAnimating = false;
      renderMainMenu();
    }
  }

  function handleRun() {
    if (isAnimating || battleOver) return;
    if (!isWild) {
      setDialogue("On ne peut pas fuir un combat de dresseur !");
      return;
    }
    sfx.stopBgm();
    setDialogue("Vous prenez la fuite en sécurité !");
    setTimeout(() => {
      finishBattle('fled');
    }, 750);
  }

  function finishBattle(result, caughtPoke = null) {
    sfx.stopBgm();
    container.innerHTML = '';
    onEnd({
      result,
      caughtPokemon: caughtPoke,
      activePokemon: activePlayerPoke,
      trainerInfo
    });
  }

  function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  if (hasTrainerIntro) {
    isAnimating = true;
    menuEl.innerHTML = '';
    const trainerAvatarEl = container.querySelector('#oppTrainerAvatar');
    setTimeout(() => {
      if (trainerAvatarEl) trainerAvatarEl.classList.add('trainer-slide-out');
      setTimeout(() => {
        if (trainerAvatarEl) trainerAvatarEl.style.display = 'none';
        setDialogue(`${trainerInfo.name} envoie ${wildPoke.name} !`);
        oppSprite.style.opacity = '1';
        oppSprite.classList.remove('anim-enter');
        void oppSprite.offsetWidth;
        oppSprite.classList.add('anim-enter');
        sfx.playCry(wildPoke.id);
        isAnimating = false;
        renderMainMenu();
      }, 380);
    }, 1050);
  } else {
    renderMainMenu();
  }
}
