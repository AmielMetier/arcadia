// Interface de Bastion Clash (navigateur uniquement).
// Console de commandement et barre du haut.
'use strict';

/* ============================================================================
   CONSOLE RTS INFÉRIEURE STRICTE (AUCUNE ACTION SANS SÉLECTION D'UNITÉ/BÂTIMENT)
   ============================================================================ */
let lastCmdSig = '';
let lastSelSig = '';
let lastRosterSig = '';

function renderConsoleUI(force = false) {
  if (!state) return;
  cleanSelection();
  const me = state.players.find((p) => Number(p.id) === Number(myId));
  // Éliminé ou arrivé en cours de partie : tableau des joueurs et caméra libre
  if (!me || me.dead || me.spectator) { renderSpectatorPanel(force); return; }
  document.body.classList.remove('spectating');

  const myUnits = state.units.filter((u) => Number(u.owner) === Number(myId) && u.hp > 0);
  const scvs = myUnits.filter((u) => u.kind === 'scv');
  const armyCnt = myUnits.filter((u) => u.kind !== 'scv').length;
  $('#uiArmyCnt').textContent = armyCnt;

  const cgHtml = [];
  for (let g = 1; g <= 5; g++) {
    const grp = controlGroups[g];
    const cnt = (grp?.units?.length || 0) + (grp?.blds?.length || 0);
    if (cnt > 0) {
      cgHtml.push(`<button class="cg-pill" data-cg="${g}"><b>${g}</b><span>(${cnt})</span></button>`);
    }
  }
  const cgBar = $('#uiCgBar');
  if (cgBar.innerHTML !== cgHtml.join('')) {
    cgBar.innerHTML = cgHtml.join('');
    for (const btn of cgBar.querySelectorAll('[data-cg]')) {
      btn.onpointerdown = (ev) => {
        if (ev.button !== 0) return;
        ev.preventDefault();
        const g = Number(btn.dataset.cg);
        const grp = controlGroups[g];
        selectedUnits = new Set(grp.units || []);
        selectedBlds = new Set(grp.blds || []);
        cleanSelection();
        renderConsoleUI(true);
      };
    }
  }

  const selBody = $('#uiSelBody');
  const selU = state.units.filter((u) => selectedUnits.has(u.id));
  const selB = state.buildings.filter((b) => selectedBlds.has(b.id));

  let selSig = 'NONE';
  if (selB.length >= 1 && selU.length === 0) {
    const b0 = selB[0];
    selSig = `B:${selB.map((b) => b.id).join(',')}:${b0.constructing ? 1 : 0}:${(b0.queue || []).join(',')}`;
  } else if (selU.length === 1) {
    const u0 = selU[0];
    selSig = `U1:${u0.id}:${u0.kind}:${u0.sieged ? 1 : 0}:${u0.stimT > 0 ? 1 : 0}`;
  } else if (selU.length > 1) {
    selSig = `UM:${selU.map((u) => `${u.id}:${u.sieged ? 1 : 0}:${u.stimT > 0 ? 1 : 0}`).join(',')}`;
  }

  // PANNEAU CENTRAL / GAUCHE : ne reconstruit le DOM que si la structure de sélection change !
  if (!force && selSig === lastSelSig) {
    if (selB.length >= 1 && selU.length === 0) {
      const b = selB[0];
      const pct = Math.round((b.hp / b.maxHp) * 100);
      const qProg = b.qTotal > 0 ? Math.round((1 - b.qTimer / b.qTotal) * 100) : 0;
      const hpBar = $('#selHpBar'), hpSub = $('#selHpSub'), qBar = $('#selQBar'), qTxt = $('#selQTxt');
      if (hpBar) { hpBar.style.width = `${pct}%`; hpBar.style.background = pct > 45 ? '#2fbf71' : '#ff4b2b'; }
      if (hpSub) hpSub.textContent = `PV : ${Math.ceil(b.hp)} / ${b.maxHp} ${b.constructing ? `· Construction ${Math.round((b.buildProg || 0) * 100)}%` : ''}`;
      if (qBar) qBar.style.width = `${qProg}%`;
      if (qTxt) {
        const qItem = b.queue[0];
        const qDef = qItem ? (UNITS[qItem] || UPGRADES[qItem]) : null;
        qTxt.textContent = qDef ? `En cours : ${qDef.name} (${qProg}%)` : (b.kind === 'armory' ? 'Prêt à rechercher' : 'Prêt à produire');
      }
    } else if (selU.length === 1) {
      const u = selU[0];
      const def = UNITS[u.kind];
      const pct = Math.round((u.hp / u.maxHp) * 100);
      const hpBar = $('#selHpBar'), hpSub = $('#selHpSub');
      if (hpBar) { hpBar.style.width = `${pct}%`; hpBar.style.background = pct > 45 ? '#2fbf71' : '#ff4b2b'; }
      if (hpSub) hpSub.textContent = `PV : ${Math.ceil(u.hp)} / ${u.maxHp} · ${def.desc}`;
    } else if (selU.length > 1) {
      for (const u of selU.slice(0, 24)) {
        const bar = selBody.querySelector(`[data-u-hp="${u.id}"]`);
        if (bar) {
          const pct = Math.round((u.hp / u.maxHp) * 100);
          bar.style.width = `${pct}%`;
          bar.style.background = pct > 45 ? '#2fbf71' : '#ff4b2b';
        }
      }
    }
  } else {
    lastSelSig = selSig;
    if (selB.length >= 1 && selU.length === 0) {
      const b = selB[0];
      const def = BUILDINGS[b.kind];
      $('#uiSelHeader').textContent = selB.length > 1 ? `${selB.length} × ${def.name}` : def.name;
      $('#uiSelSubHint').textContent = b.constructing ? 'Chantier en construction…' : (def.trains || []).length ? 'Clic droit sur la carte ou la minimap = point de ralliement' : '';
      const pct = Math.round((b.hp / b.maxHp) * 100);
      const qSlotsHtml = [0, 1, 2, 3, 4].map((idx) => {
        const qKind = b.queue?.[idx];
        const uDef = qKind ? (UNITS[qKind] || UPGRADES[qKind]) : null;
        return `<div class="q-slot ${uDef ? 'filled' : ''}" data-cancel-bld="${b.id}" data-cancel-slot="${idx}" title="${uDef ? `Annuler ${uDef.name}` : 'Slot libre'}">
          <span class="num">#${idx + 1}</span>
          ${uDef ? `<span class="q-nm">${uDef.short || uDef.name}</span>` : '<span style="color:#b7ac95">—</span>'}
        </div>`;
      }).join('');
      const qProg = b.qTotal > 0 ? Math.round((1 - b.qTimer / b.qTotal) * 100) : 0;
      const qItem0 = b.queue?.[0];
      const qDef0 = qItem0 ? (UNITS[qItem0] || UPGRADES[qItem0]) : null;

      selBody.innerHTML = `
        <div class="portrait-box">
          <div class="portrait-name">${def.short}</div>
          <canvas width="98" height="86" id="portCvs"></canvas>
          <div class="portrait-hp"><i id="selHpBar" style="width:${pct}%;background:${pct > 45 ? '#2fbf71' : '#ff4b2b'}"></i></div>
        </div>
        <div class="sel-info">
          <div class="sel-title">${def.name}</div>
          <div class="sel-sub" id="selHpSub">PV : ${Math.ceil(b.hp)} / ${b.maxHp} ${b.constructing ? `· Construction ${Math.round((b.buildProg || 0) * 100)}%` : ''}</div>
          <div class="sel-stats">
            ${def.dmg ? `<span class="st-chip">⚔️ Dégâts : ${def.dmg}</span>` : ''}
            ${def.supply ? `<span class="st-chip">📦 Ravitaillement : +${def.supply}</span>` : ''}
            <span class="st-chip wide">${def.desc}</span>
          </div>
          ${(((def.trains && def.trains.length) || b.kind === 'armory') && !b.constructing) ? `
            <div class="prod-queue">
              <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700">
                <span>File ${b.kind === 'armory' ? 'de recherche' : 'de production'} (${b.queue.length}/5)</span>
                <span id="selQTxt">${qDef0 ? `En cours : ${qDef0.name} (${qProg}%)` : (b.kind === 'armory' ? 'Prêt à rechercher' : 'Prêt à produire')}</span>
              </div>
              <div class="q-bar-wrap"><i id="selQBar" style="width:${qProg}%"></i></div>
              <div class="q-slots">${qSlotsHtml}</div>
            </div>
          ` : ''}
        </div>
      `;
      drawThumbIcon($('#portCvs'), b.kind, pc(me));
      for (const sl of selBody.querySelectorAll('.q-slot.filled')) {
        sl.onpointerdown = (ev) => {
          if (ev.button !== 0) return;
          ev.preventDefault();
          sendCommand({ op: 'CANCEL_QUEUE', bldId: Number(sl.dataset.cancelBld), slot: Number(sl.dataset.cancelSlot) });
        };
      }
    } else if (selU.length === 1) {
      const u = selU[0];
      const def = UNITS[u.kind];
      $('#uiSelHeader').textContent = def.name;
      if (u.kind === 'scv') {
        $('#uiSelSubHint').textContent = 'Clic droit sur un cristal ou une raffinerie pour récolter';
      } else if (u.kind === 'dropship') {
        $('#uiSelSubHint').textContent = 'Navette : Clic Droit sur troupes pour embarquer [max 4] · V = Débarquer';
      } else if (u.kind === 'medivac') {
        $('#uiSelSubHint').textContent = 'Navette Médicale : Soigne automatiquement les unités alliées blessées en continu';
      } else {
        $('#uiSelSubHint').textContent = 'Clic droit = ordre · F + clic = attaque-déplacement';
      }
      const pct = Math.round((u.hp / u.maxHp) * 100);
      let statsHtml = '';
      if (u.kind === 'dropship') {
        statsHtml = `
          <span class="st-chip">📦 Passagers : ${u.cargo?.length || 0} / ${u.maxCargo || 4}</span>
          <span class="st-chip">💨 Vitesse : ${def.speed}</span>
          <span class="st-chip">🦅 Volant (franchit tout)</span>
        `;
      } else if (u.kind === 'medivac') {
        statsHtml = `
          <span class="st-chip">💚 Soins : ${def.healRate || 24}/s</span>
          <span class="st-chip">🎯 Portée : ${def.range}</span>
          <span class="st-chip">${u.healingTargetId ? '✨ Soins en cours' : '🟢 En veille'}</span>
        `;
      } else {
        statsHtml = `
          <span class="st-chip">⚔️ Dégâts : ${u.sieged ? def.siegeDmg : def.dmg}</span>
          <span class="st-chip">🎯 Portée : ${u.sieged ? def.siegeRange : def.range}</span>
          <span class="st-chip">💨 Vitesse : ${u.sieged ? 0 : def.speed}</span>
        `;
      }
      selBody.innerHTML = `
        <div class="portrait-box">
          <div class="portrait-name">${def.short}</div>
          <canvas width="98" height="86" id="portCvs"></canvas>
          <div class="portrait-hp"><i id="selHpBar" style="width:${pct}%;background:${pct > 45 ? '#2fbf71' : '#ff4b2b'}"></i></div>
        </div>
        <div class="sel-info">
          <div class="sel-title">${def.name} ${u.sieged ? '· [MODE SIÈGE]' : ''} ${u.stimT > 0 ? '· [STIMPACK ⚡]' : ''}</div>
          <div class="sel-sub" id="selHpSub">PV : ${Math.ceil(u.hp)} / ${u.maxHp} · ${def.desc}</div>
          <div class="sel-stats">${statsHtml}</div>
        </div>
      `;
      drawThumbIcon($('#portCvs'), u.kind, pc(me));
    } else if (selU.length > 1) {
      $('#uiSelHeader').textContent = `Escouade sélectionnée (${selU.length} unités)`;
      $('#uiSelSubHint').textContent = 'Clic = isoler · Ctrl+clic = même type';
      selBody.innerHTML = `<div class="multi-grid">${selU.slice(0, 24).map((u) => {
        const def = UNITS[u.kind];
        const pct = Math.round((u.hp / u.maxHp) * 100);
        return `<div class="u-card ${u.stimT > 0 ? 'stim' : ''} ${u.sieged ? 'siege' : ''}" data-pick-u="${u.id}" title="${def.name} (${Math.ceil(u.hp)}/${u.maxHp} PV)">
          <canvas class="u-thumb" width="68" height="38" data-u-thumb="${u.kind}"></canvas>
          <span class="u-nm">${def.short}</span>
          <div class="u-hp"><i data-u-hp="${u.id}" style="width:${pct}%;background:${pct > 45 ? '#2fbf71' : '#ff4b2b'}"></i></div>
        </div>`;
      }).join('')}</div>`;
      for (const c of selBody.querySelectorAll('canvas[data-u-thumb]')) {
        drawThumbIcon(c, c.dataset.uThumb, pc(me));
      }
      for (const card of selBody.querySelectorAll('[data-pick-u]')) {
        card.onpointerdown = (ev) => {
          if (ev.button !== 0) return;
          ev.preventDefault();
          const id = Number(card.dataset.pickU);
          const targetU = state.units.find((x) => x.id === id);
          if (ev.ctrlKey && targetU) {
            selectedUnits = new Set(selU.filter((x) => x.kind === targetU.kind).map((x) => x.id));
          } else {
            selectedUnits = new Set([id]);
          }
          renderConsoleUI(true);
        };
      }
    } else {
      $('#uiSelHeader').textContent = 'Aucune sélection';
      $('#uiSelSubHint').textContent = 'Clique sur un VCS ou un bâtiment sur la carte';
      selBody.innerHTML = `
        <div class="sel-info">
          <div class="sel-title">Sélectionne une unité ou un bâtiment</div>
          <div class="sel-sub">Fonctionnement StarCraft :</div>
          <div class="sel-stats">
            <span class="st-chip">👷 Clique sur un <b>Ouvrier VCS</b> pour construire un bâtiment</span>
            <span class="st-chip">🏰 Clique sur le <b>QG</b> pour créer un Ouvrier VCS</span>
            <span class="st-chip">🏭 Clique sur la <b>Caserne / Usine</b> pour créer des troupes</span>
          </div>
        </div>
      `;
    }
  }

  // PANNEAU DE DROITE : CARTE DE COMMANDE 4×3 (le DOM n'est reconstruit que si la sélection change)
  const hasScv = selU.some((u) => u.kind === 'scv');
  const firstB = selB[0] || null;
  let modeKey = 'NONE';
  if (selU.length > 0) {
    modeKey = hasScv ? 'SCV' : 'ARMY';
  } else if (firstB) {
    modeKey = firstB.constructing ? 'BLD_CONSTRUCT' : `BLD_${firstB.kind}`;
  }
  const armyAbil = modeKey === 'ARMY'
    ? `${selU.some((u) => UNITS[u.kind]?.canStim) ? 1 : 0}${selU.some((u) => UNITS[u.kind]?.canSiege) ? 1 : 0}${selU.some((u) => u.kind === 'dropship') ? 1 : 0}`
    : '';

  const grid = $('#uiCmdGrid');
  const sig = `${modeKey}|${armyAbil}|${buildMode}|${buildKeysArmed}|${orderCursor}|${pc(me)}|${BUILD_ORDER.map((k) => (isBuildLocked(me, k) ? 1 : 0)).join('')}`;
  if (!force && sig === lastCmdSig) {
    refreshCmdAffordability(grid, me, firstB);
    return;
  }
  lastCmdSig = sig;
  hideCmdTip();

  const cards = [];

  if (modeKey === 'SCV') {
    $('#uiCmdTitle').textContent = 'Construction';
    $('#uiCmdHint').textContent = buildKeysArmed ? 'Choisis : 1-0 ou R · Échap pour annuler' : 'B puis 1-0 ou R · Échap pour annuler';
    for (const k of BUILD_ORDER) {
      const def = BUILDINGS[k];
      const locked = isBuildLocked(me, k);
      const poor = me.minerals < def.min || me.gas < def.gas;
      cards.push(`<button class="cbtn ${buildMode === k ? 'sel' : ''} ${buildKeysArmed ? 'armed' : ''} ${locked ? 'locked' : poor ? 'cant' : ''}" data-cmd-build="${k}" data-tip-kind="bld" data-tip-id="${k}">
        <span class="key">${BUILD_KEYS[k]}</span>
        <canvas class="thumb" width="120" height="60" data-thumb="${k}"></canvas>
        <span class="lbl-b">${def.short}</span>
        ${locked ? `<span class="req">🔒 ${BUILDINGS[def.req].short}</span>` : costHtml(def.min, def.gas)}
      </button>`);
    }

  } else if (modeKey.startsWith('BLD_') && modeKey !== 'BLD_CONSTRUCT') {
    const bDef = BUILDINGS[firstB.kind];
    $('#uiCmdTitle').textContent = bDef.name;
    $('#uiCmdHint').textContent = firstB.kind === 'armory' ? 'Touches E R T Y U' : bDef.trains.length ? 'Touches E R T · Clic droit = ralliement' : 'Structure automatique';
    if (firstB.kind === 'armory') {
      const upgKeys = ['E', 'R', 'T', 'Y', 'U'];
      me.upgrades = me.upgrades || {};
      Object.values(UPGRADES).forEach((uDef, idx) => {
        // Paliers : le bouton montre le niveau acquis et le coût du suivant
        const c = upgCost(me, uDef.id);
        const lvl = upgLevel(me, uDef.id), max = uDef.maxLevel || 1;
        const isDone = c.maxed;
        const isQueued = state.buildings.some((b) => b.owner === me.id && (b.queue || []).includes(uDef.id));
        const poor = me.minerals < c.min || me.gas < c.gas;
        cards.push(`<button class="cbtn ${isDone ? 'done' : isQueued ? 'queued' : poor ? 'cant' : ''}" data-cmd-research="${uDef.id}" data-tip-kind="upg" data-tip-id="${uDef.id}">
          <span class="key">${upgKeys[idx] || ''}</span>
          <span class="ico-txt">${uDef.icon}</span>
          <span class="lbl-b">${uDef.short}${max > 1 ? ` <small class="lvl">${lvl}/${max}</small>` : ''}</span>
          ${isDone ? '<span class="req ok">✔ Maximum</span>' : isQueued ? `<span class="req q">⏳ Niv. ${c.level}</span>` : costHtml(c.min, c.gas)}
        </button>`);
      });
    } else {
      const keysMap = ['E', 'R', 'T', 'Y'];
      (bDef.trains || []).forEach((uKind, idx) => {
        const uDef = UNITS[uKind];
        const poor = me.minerals < uDef.min || me.gas < uDef.gas;
        cards.push(`<button class="cbtn ${poor ? 'cant' : ''}" data-cmd-train="${uKind}" data-tip-kind="unit" data-tip-id="${uKind}">
          <span class="key">${keysMap[idx]}</span>
          <canvas class="thumb" width="120" height="60" data-thumb="${uKind}"></canvas>
          <span class="lbl-b">${uDef.short}</span>
          ${costHtml(uDef.min, uDef.gas)}
        </button>`);
      });
      if (firstB.kind === 'hq') {
        cards.push(`<button class="cbtn ${orderCursor === 'scan' ? 'sel' : ''} ${me.minerals < 50 ? 'cant' : ''}" data-cmd-act="scan" data-tip-kind="act" data-tip-id="scan">
          <span class="key">C</span>
          <span class="ico-txt">📡</span>
          <span class="lbl-b">Scan <small class="cd">${me.scanCd > 0 ? Math.ceil(me.scanCd) + ' s' : ''}</small></span>
          ${costHtml(50, 0)}
        </button>`);
      }
    }
    if (!cards.length) {
      grid.innerHTML = `<div class="cmd-empty"><b>${bDef.name}</b><span>${bDef.desc}</span></div>`;
      return;
    }

  } else if (modeKey === 'BLD_CONSTRUCT') {
    $('#uiCmdTitle').textContent = 'Chantier';
    $('#uiCmdHint').textContent = 'En construction';
    grid.innerHTML = `<div class="cmd-empty"><b>Chantier en cours</b><span>Un VCS doit rester sur place pour terminer le bâtiment. Clic droit avec un VCS sur le chantier pour le reprendre.</span></div>`;
    return;

  } else if (modeKey === 'ARMY') {
    $('#uiCmdTitle').textContent = 'Capacités';
    $('#uiCmdHint').textContent = 'Clic droit = ordre · F = attaquer · X = stop';
    cards.push(`<button class="cbtn" data-cmd-act="hold" data-tip-kind="act" data-tip-id="hold">
      <span class="key">H</span><span class="ico-txt">🛡️</span><span class="lbl-b">Tenir position</span>
    </button>`);
    if (armyAbil[0] === '1') {
      cards.push(`<button class="cbtn" data-cmd-act="stim" data-tip-kind="act" data-tip-id="stim">
        <span class="key">T</span><span class="ico-txt">💉</span><span class="lbl-b">Stimpack</span><span class="cost"><i class="hp">−18 PV</i></span>
      </button>`);
    }
    if (armyAbil[1] === '1') {
      cards.push(`<button class="cbtn" data-cmd-act="siege" data-tip-kind="act" data-tip-id="siege">
        <span class="key">G</span><span class="ico-txt">💥</span><span class="lbl-b">Mode Siège</span>
      </button>`);
    }
    if (armyAbil[2] === '1') {
      cards.push(`<button class="cbtn" data-cmd-act="unload" data-tip-kind="act" data-tip-id="unload">
        <span class="key">V</span><span class="ico-txt">🪂</span><span class="lbl-b">Débarquer</span>
      </button>`);
    }

  } else {
    $('#uiCmdTitle').textContent = 'Ordres';
    $('#uiCmdHint').textContent = '';
    grid.innerHTML = `<div class="cmd-empty">
      <b>Rien de sélectionné</b>
      <span><kbd>F1</kbd> un VCS pour construire · clique un <b>bâtiment</b> pour produire · <kbd>F2</kbd> toute l'armée</span>
    </div>`;
    return;
  }

  grid.innerHTML = cards.join('');
  for (const c of grid.querySelectorAll('canvas[data-thumb]')) {
    drawThumbIcon(c, c.dataset.thumb, pc(me));
  }
  for (const b of grid.querySelectorAll('[data-tip-kind]')) {
    b.onpointerenter = () => showCmdTip(b);
    b.onpointerleave = hideCmdTip;
  }
  for (const b of grid.querySelectorAll('[data-cmd-build]')) {
    b.onpointerdown = (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      pickBuildMode(b.dataset.cmdBuild);
    };
  }
  for (const b of grid.querySelectorAll('[data-cmd-train]')) {
    b.onpointerdown = (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const uKind = b.dataset.cmdTrain;
      for (const bId of selectedBlds) {
        sendCommand({ op: 'TRAIN', unit: uKind, bldId: bId });
      }
    };
  }
  for (const b of grid.querySelectorAll('[data-cmd-research]')) {
    b.onpointerdown = (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      if (firstB) sendCommand({ op: 'RESEARCH', upgId: b.dataset.cmdResearch, bldId: firstB.id });
    };
  }
  for (const b of grid.querySelectorAll('[data-cmd-act]')) {
    b.onpointerdown = (ev) => {
      if (ev.button !== 0) return;
      ev.preventDefault();
      const act = b.dataset.cmdAct;
      if (act === 'scan') { buildMode = null; orderCursor = orderCursor === 'scan' ? null : 'scan'; updateCursorClass(); renderConsoleUI(true); }
      else if (act === 'hold') sendCommand({ op: 'UNIT_ORDER', mode: 'hold', unitIds: [...selectedUnits] });
      else if (act === 'stim') sendCommand({ op: 'STIM', unitIds: [...selectedUnits] });
      else if (act === 'siege') sendCommand({ op: 'SIEGE', unitIds: [...selectedUnits] });
      else if (act === 'unload') {
        for (const uId of selectedUnits) {
          const u = state.units.find((x) => x.id === uId);
          if (u && u.kind === 'dropship') sendCommand({ op: 'UNLOAD', dropshipId: u.id });
        }
      }
    };
  }
}

// ---- Carte de commande : ordre, raccourcis, verrous, coûts et infobulles ----
const BUILD_ORDER = ['pylon', 'extractor', 'barracks', 'factory', 'starport', 'armory', 'turret', 'tesla', 'wall', 'hq', 'radar'];
const BUILD_KEYS = { pylon: '1', extractor: '2', barracks: '3', factory: '4', starport: '5', armory: '6', turret: '7', tesla: '8', wall: '9', hq: '0', radar: 'R' };
const KEY_TO_BUILD = Object.fromEntries(Object.entries(BUILD_KEYS).map(([k, v]) => [v.toLowerCase(), k]));

function isBuildLocked(me, kind) {
  const def = BUILDINGS[kind];
  return !!(def && def.req && state && !hasCompletedBuilding(state, me.id, def.req));
}

function costHtml(min, gas, supply = 0) {
  return `<span class="cost"><i class="m">${min}</i>${gas ? `<i class="g">${gas}</i>` : ''}${supply ? `<i class="s">${supply}</i>` : ''}</span>`;
}

function refreshCmdAffordability(grid, me, firstB) {
  for (const b of grid.querySelectorAll('[data-cmd-build]')) {
    const def = BUILDINGS[b.dataset.cmdBuild];
    b.classList.toggle('cant', !b.classList.contains('locked') && (me.minerals < def.min || me.gas < def.gas));
  }
  for (const b of grid.querySelectorAll('[data-cmd-train]')) {
    const uDef = UNITS[b.dataset.cmdTrain];
    b.classList.toggle('cant', me.minerals < uDef.min || me.gas < uDef.gas);
  }
  for (const b of grid.querySelectorAll('[data-cmd-research]')) {
    const id = b.dataset.cmdResearch;
    if (!UPGRADES[id]) continue;
    const c = upgCost(me, id);
    const isQueued = state.buildings.some((x) => x.owner === me.id && (x.queue || []).includes(id));
    const sig = `${upgLevel(me, id)}|${isQueued}`;
    if (b.dataset.sig && b.dataset.sig !== sig) { lastCmdSig = ''; return; }
    b.dataset.sig = sig;
    b.classList.toggle('cant', !c.maxed && !isQueued && (me.minerals < c.min || me.gas < c.gas));
  }
  const scan = grid.querySelector('[data-cmd-act="scan"]');
  if (scan) {
    const cd = Math.ceil(me.scanCd || 0);
    scan.classList.toggle('cant', me.minerals < 50 || cd > 0);
    const lbl = scan.querySelector('.cd');
    if (lbl) lbl.textContent = cd > 0 ? `${cd} s` : '';
  }
}

// Choisit le bâtiment à poser (bouton ou raccourci) ; refuse proprement s'il n'est pas débloqué
function pickBuildMode(kind) {
  const me = state && state.players.find((p) => Number(p.id) === Number(myId));
  if (!me || !BUILDINGS[kind]) return;
  const def = BUILDINGS[kind];
  if (isBuildLocked(me, kind)) {
    toast(`🔒 ${def.name} verrouillé — construis d'abord : ${BUILDINGS[def.req].name}`, 2200);
    Sfx.error();
    return;
  }
  orderCursor = null;
  buildMode = buildMode === kind ? null : kind;
  if (buildMode && (me.minerals < def.min || me.gas < def.gas)) {
    toast(`Il te manque ${Math.max(0, def.min - Math.floor(me.minerals))} minerai${def.gas ? ` et ${Math.max(0, def.gas - Math.floor(me.gas))} gaz` : ''} — tu peux déjà viser l'emplacement.`, 1800);
  }
  updateCursorClass();
  renderConsoleUI(true);
}

const ACT_TIPS = {
  scan: ['Scan Radar', 'Révèle une zone (même sur les plateaux) pendant quelques secondes. Clique ensuite sur la carte ou la minimap.'],
  hold: ['Tenir position', 'Les unités restent sur place et ne tirent que sur ce qui entre à portée.'],
  stim: ['Stimpack', '+50 % de vitesse de tir et de déplacement pendant 8 s. Coûte 18 PV par unité.'],
  siege: ['Mode Siège', 'Le Char de Siège se fixe au sol : portée et dégâts de zone énormes, mais immobile. Rappuie pour repartir.'],
  unload: ['Débarquer', 'La navette dépose toutes les troupes transportées.'],
};

function showCmdTip(btn) {
  const tip = $('#uiTip');
  if (!tip || !state) return;
  const me = state.players.find((p) => Number(p.id) === Number(myId));
  const kind = btn.dataset.tipKind, id = btn.dataset.tipId;
  let html = '';
  const costRow = (min, gas, extra = '') => `<div class="cost">${min ? `<span class="m">${min}</span>` : ''}${gas ? `<span class="g">${gas}</span>` : ''}${extra}</div>`;
  if (kind === 'bld') {
    const d = BUILDINGS[id];
    html = `<b>${d.name} <kbd>${BUILD_KEYS[id]}</kbd></b>${d.desc}${costRow(d.min, d.gas, `<span class="t">⏱ ${d.buildTime}s</span>`)}`;
    if (me && isBuildLocked(me, id)) html += `<div class="lockmsg">🔒 Requiert : ${BUILDINGS[d.req].name}</div>`;
  } else if (kind === 'unit') {
    const d = UNITS[id];
    html = `<b>${d.name}</b>${d.desc}${costRow(d.min, d.gas, `<span class="s">${d.supply}</span><span class="t">⏱ ${d.trainTime}s</span>`)}`;
  } else if (kind === 'upg') {
    const d = UPGRADES[id];
    const c = upgCost(me, id);
    html = c.maxed
      ? `<b>${d.name}</b>${d.desc}<div class="tip-note">Niveau maximum atteint.</div>`
      : `<b>${d.name}${(d.maxLevel || 1) > 1 ? ` — niveau ${c.level}` : ''}</b>${d.desc}${costRow(c.min, c.gas, `<span class="t">⏱ ${c.time}s</span>`)}`;
  } else if (ACT_TIPS[id]) {
    html = `<b>${ACT_TIPS[id][0]}</b>${ACT_TIPS[id][1]}${id === 'scan' ? costRow(50, 0, `<span class="t">⏱ recharge ${SCAN_COOLDOWN}s</span>`) : ''}`;
  }
  if (!html) return;
  tip.innerHTML = html;
  tip.hidden = false;
  const r = btn.getBoundingClientRect();
  const tw = tip.offsetWidth, th = tip.offsetHeight;
  tip.style.left = `${clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8)}px`;
  tip.style.top = `${Math.max(8, r.top - th - 8)}px`;
}
function hideCmdTip() {
  const tip = $('#uiTip');
  if (tip) tip.hidden = true;
}

// Statistiques de récolte du joueur local (pour l'affichage des limites de VCS)
function getMyHarvestStats() {
  const minCnt = new Map(), gasCnt = new Map();
  let minWorkers = 0, gasWorkers = 0, idle = 0, total = 0;
  for (const u of state.units) {
    if (Number(u.owner) !== Number(myId) || u.kind !== 'scv' || u.hp <= 0 || u.boardedIn) continue;
    total++;
    if (u.mode === 'harvest_min' && u.harvestId) { minWorkers++; minCnt.set(u.harvestId, (minCnt.get(u.harvestId) || 0) + 1); }
    else if (u.mode === 'harvest_gas' && u.harvestId) { gasWorkers++; gasCnt.set(u.harvestId, (gasCnt.get(u.harvestId) || 0) + 1); }
    else if (u.mode === 'idle') idle++;
  }
  const hqs = state.buildings.filter((b) => Number(b.owner) === Number(myId) && b.kind === 'hq' && b.hp > 0 && !b.constructing);
  const baseMins = MINERAL_NODES.filter((m) => mineralAlive(state, m) && hqs.some((h) => hypot(h.x, h.y, m.x, m.y) < 420));
  const refs = state.buildings.filter((b) => Number(b.owner) === Number(myId) && b.kind === 'extractor' && b.hp > 0 && !b.constructing);
  return {
    minCnt, gasCnt, baseMins, refs, idle, total,
    minWorkers, gasWorkers,
    minCap: baseMins.length * MAX_SCV_PER_MINERAL,
    gasCap: refs.length * MAX_SCV_PER_GAS,
  };
}

// Tour de Détection : alerte dès qu'un ennemi entre dans sa zone (au plus une fois toutes les 20 s par tour)
const detectorAlertAt = new Map();
let lastDetectorCheck = 0;
function checkDetectorAlerts() {
  const now = performance.now();
  if (!state || now - lastDetectorCheck < 400) return;
  lastDetectorCheck = now;
  const me = state.players.find((p) => Number(p.id) === Number(myId));
  if (!me || me.dead) return;
  for (const b of state.buildings) {
    if (Number(b.owner) !== Number(myId) || b.hp <= 0 || b.constructing || !BUILDINGS[b.kind]?.detector) continue;
    const R = BUILDINGS[b.kind].sight;
    const foe = state.units.find((u) => u.hp > 0 && !u.boardedIn && u.team !== me.team && dist2(u.x, u.y, b.x, b.y) < R * R);
    if (!foe) continue;
    if (now - (detectorAlertAt.get(b.id) || -1e9) < 20000) continue;
    detectorAlertAt.set(b.id, now);
    const n = state.units.filter((u) => u.hp > 0 && !u.boardedIn && u.team !== me.team && dist2(u.x, u.y, b.x, b.y) < R * R).length;
    notify(`📡 Tour de Détection : ${n} ennemi${n > 1 ? 's' : ''} repéré${n > 1 ? 's' : ''} !`, 'warn', 5200);
    addMiniPing(foe.x, foe.y, '#ff5a45', 3, true);
    addMiniPing(b.x, b.y, '#ffc531', 1.6, false);
    Sfx.radar();
  }
}

function updateHudUI() {
  if (!state) return;
  const me = state.players.find((p) => Number(p.id) === Number(myId));
  if (me) {
    $('#uiMin').textContent = Math.floor(me.minerals);
    $('#uiGas').textContent = Math.floor(me.gas);
    // Limites de VCS affichées : ouvriers au travail / places disponibles (2 par cristal, 3 par Raffinerie)
    const hs = getMyHarvestStats();
    const wEl = $('#uiWorkers'), gEl = $('#uiRefineries');
    wEl.innerHTML = `<b>${hs.minWorkers}</b>/${hs.minCap} VCS`;
    wEl.className = `res-sub cap ${hs.minCap && hs.minWorkers >= hs.minCap ? 'full' : ''}`;
    gEl.innerHTML = hs.refs.length ? `<b>${hs.gasWorkers}</b>/${hs.gasCap} VCS` : 'aucune raff.';
    gEl.className = `res-sub cap ${hs.gasCap && hs.gasWorkers >= hs.gasCap ? 'full' : ''}`;
    $('#resMin').title = `Minéraux — ${hs.minWorkers} VCS sur les cristaux de tes bases, ${hs.minCap} places (2 VCS max par cristal). Au-delà, construis un QG près d'autres cristaux.`;
    $('#resGas').title = `Gaz Plasma — ${hs.gasWorkers} VCS sur ${hs.refs.length} Raffinerie(s), ${hs.gasCap} places (3 VCS max par Raffinerie).`;
    const idleBtn = $('#btnIdleScv');
    if (idleBtn) idleBtn.classList.toggle('idle-warn', hs.idle > 0);
    const idleCnt = $('#uiIdleCnt');
    if (idleCnt) idleCnt.textContent = hs.idle > 0 ? `${hs.idle} inactif${hs.idle > 1 ? 's' : ''}` : hs.total;
    const sup = computeSupply(state, myId);
    const supEl = $('#uiSupply');
    supEl.textContent = `${sup.used}/${sup.max}`;
    supEl.classList.toggle('blocked', sup.used >= sup.max);
  }

  const sec = Math.floor(state.time);
  const mm = String(Math.floor(sec / 60)).padStart(2, '0');
  const ss = String(sec % 60).padStart(2, '0');
  $('#uiClock').textContent = `${mm}:${ss}`;
  const phaseNames = {
    1: 'Phase 1 · Expansion & Scouting',
    2: 'Phase 2 · Escarmouches Tactiques',
    3: 'Phase 3 · Guerre Mécanisée (+20% Dégâts)',
    4: 'MORT SUBITE · Tempête & Dégâts ×1.85',
  };
  $('#uiPhaseName').textContent = phaseNames[state.phase] || '';
  $('#uiPhase').classList.toggle('sd', state.phase === 4);

  const rosterSig = state.players.map((p) => `${p.id}:${p.name}:${p.team}:${p.dead ? 1 : 0}:${p.afk ? 1 : 0}:${p.bot ? 'bot' : getPlayerPing(p)}`).join('|');
  if (rosterSig !== lastRosterSig) {
    lastRosterSig = rosterSig;
    $('#uiRoster').innerHTML = state.players.map((p) => {
      const isMe = Number(p.id) === Number(myId);
      let pingHtml = '';
      if (p.bot) {
        pingHtml = `<span class="ping-tag bot">🤖 IA</span>`;
      } else if (p.afk) {
        pingHtml = `<span class="ping-tag bad" title="Parti : un bot garde sa base jusqu’à son retour">🔌 bot</span>`;
      } else {
        const ms = getPlayerPing(p);
        const cls = ms > 150 ? 'bad' : ms > 80 ? 'warn' : '';
        pingHtml = `<span class="ping-tag ${cls}">📶 ${ms} ms</span>`;
      }
      let teamHtml = '';
      if (state.is2v2) {
        const tName = p.team === 0 ? 'Équipe A' : 'Équipe B';
        const canSwitch = state.time < 45 && (isMe || role !== 'guest');
        teamHtml = `<button class="team-tag t${p.team}" data-toggle-team="${p.id}" ${canSwitch ? 'title="Changer d’équipe"' : 'disabled'} style="border:none;cursor:${canSwitch ? 'pointer' : 'default'}">${tName}</button>`;
      }
      return `<div class="p-chip ${p.dead ? 'dead' : ''} ${isMe ? 'me' : ''}">
        <span class="dot" style="background:${pc(p)}"></span>
        <span>${escHtml(p.name)}${isMe ? ' <small>(Toi)</small>' : ''}</span>
        ${teamHtml}
        ${pingHtml}
      </div>`;
    }).join('');

    for (const btn of $('#uiRoster').querySelectorAll('[data-toggle-team]')) {
      btn.onclick = (e) => {
        e.stopPropagation();
        const targetPid = Number(btn.dataset.toggleTeam);
        sendCommand({ op: 'TOGGLE_TEAM', targetId: targetPid });
      };
    }
  }

  renderConsoleUI(false);
  checkDetectorAlerts();

  const modal = $('#endModal');
  if (state.over && modal.hidden) {
    modal.hidden = false;
    const draw = state.winnerTeam == null;
    const won = !draw && me && !me.dead && me.team === state.winnerTeam;
    const winners = state.players.filter((p) => !draw && p.team === state.winnerTeam).map((p) => escHtml(p.name)).join(' et ');
    $('#endTitle').textContent = draw ? '🤝 Égalité' : !me ? '🏁 Fin de partie' : won ? '🏆 Victoire !' : '💥 Défaite';
    $('#endSub').innerHTML = draw
      ? 'Les dernières bases sont tombées en même temps : personne ne l’emporte.'
      : !me ? `Victoire de ${winners}.` : won ? 'Tes forces ont conquis le secteur !' : `Tous tes Centres de Commandement ont été détruits. Victoire de ${winners}.`;
    const ordered = state.ranking.map((id) => state.players.find((p) => p.id === id)).filter(Boolean);
    $('#endRanks').innerHTML = ordered.map((p, idx) => `<li>
      <span class="rk">${idx < 3 ? ['🥇', '🥈', '🥉'][idx] : idx + 1}</span>
      <span class="dot" style="background:${pc(p)}"></span>
      <span>${escHtml(p.name)}${p.bot ? ' 🤖' : ''}</span>
      <span class="sc">${p.score} pts</span>
    </li>`).join('');

    if (!reportedResult && (role === 'host' || role === 'solo') && window.HubBridge && HubBridge.embedded) {
      reportedResult = true;
      HubBridge.report({
        id: `bastion-${Date.now()}`,
        mode: state.mode === '2v2' ? '2v2' : 'RTS',
        players: ordered.map((p, idx) => ({
          id: p.bot ? null : p.id,
          name: p.name,
          color: p.color,
          bot: !!p.bot,
          rank: idx + 1,
          score: p.score,
        })),
      });
    }
  } else if (!state.over && !modal.hidden) {
    modal.hidden = true;
  }
}
