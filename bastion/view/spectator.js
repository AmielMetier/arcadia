// Interface de Bastion Clash (navigateur uniquement).
// Mode spectateur : joueur éliminé ou arrivé dans le salon pendant la partie.
'use strict';

/* ============================================================================
   MODE SPECTATEUR
   - Vision totale de la carte (l'hôte envoie l'état complet aux spectateurs).
   - Tableau des joueurs : ressources, ravitaillement, armée, bases, améliorations.
   - Caméra : clic sur un joueur pour aller à sa base, Tab pour passer au suivant,
     « Action » pour aller là où les combats sont les plus nombreux.
   ============================================================================ */
let lastSpecRender = 0;
let specFocus = -1;

function isSpectatorView() {
  if (!state) return false;
  const me = state.players.find((p) => Number(p.id) === Number(myId));
  return !me || me.dead || !!me.spectator;
}

function specStats(p) {
  const units = state.units.filter((u) => u.owner === p.id && u.hp > 0);
  const blds = state.buildings.filter((b) => b.owner === p.id && b.hp > 0);
  const sup = computeSupply(state, p.id);
  return {
    scv: units.filter((u) => u.kind === 'scv').length,
    army: units.filter((u) => u.kind !== 'scv').reduce((a, u) => a + (UNITS[u.kind]?.supply || 1), 0),
    bases: blds.filter((b) => b.kind === 'hq' && !b.constructing).length,
    sup,
    upg: Object.values(p.upgrades || {}).reduce((a, v) => a + (v === true ? 1 : Number(v) || 0), 0),
  };
}

// Point le plus disputé : là où des unités d'équipes différentes sont au contact
function hottestFight() {
  let best = null, bestN = 0;
  const pts = state.units.filter((u) => u.hp > 0 && !u.boardedIn && u.kind !== 'scv');
  for (let i = 0; i < pts.length; i += 3) {
    const a = pts[i];
    let n = 0, foes = 0;
    for (const b of pts) {
      if (dist2(a.x, a.y, b.x, b.y) < 420 * 420) { n++; if (b.team !== a.team) foes++; }
    }
    if (foes > 0 && n > bestN) { bestN = n; best = a; }
  }
  return best;
}

function focusPlayer(p) {
  const hq = state.buildings.find((b) => b.owner === p.id && b.kind === 'hq' && b.hp > 0);
  const army = state.units.filter((u) => u.owner === p.id && u.kind !== 'scv' && u.hp > 0 && !u.boardedIn);
  const at = hq || army[0];
  if (at) { cam.x = at.x; cam.y = at.y; }
}

function cycleSpectatorFocus() {
  const alive = state.players.filter((p) => !p.dead && !p.spectator);
  if (!alive.length) return;
  specFocus = (specFocus + 1) % alive.length;
  focusPlayer(alive[specFocus]);
  toast(`👁 Caméra : ${alive[specFocus].name}`, 1200);
}

function renderSpectatorPanel(force = false) {
  const now = performance.now();
  if (!force && now - lastSpecRender < 500) return;
  lastSpecRender = now;
  document.body.classList.add('spectating');
  $('#uiSelHeader').textContent = '👁 Vue spectateur';
  $('#uiSelSubHint').textContent = 'Tu vois toute la carte';
  const rows = state.players.filter((p) => !p.spectator).map((p) => {
    const s = specStats(p);
    return `<tr class="${p.dead ? 'dead' : ''}" data-spec-player="${p.id}">
      <td><span class="dot" style="background:${pc(p)}"></span>${escHtml(p.name)}${p.bot ? ' 🤖' : ''}${p.dead ? ' 💀' : ''}</td>
      <td class="m">${Math.floor(p.minerals)}</td><td class="g">${Math.floor(p.gas)}</td>
      <td>${s.sup.used}/${s.sup.max}</td><td>${s.army}</td><td>${s.scv}</td><td>${s.bases}</td><td>${s.upg}</td>
    </tr>`;
  }).join('');
  $('#uiSelBody').innerHTML = `<table class="spec-table">
    <thead><tr><th>Joueur</th><th>💎</th><th>🧪</th><th>📦</th><th title="Ravitaillement de l'armée">⚔️</th><th title="VCS">⛏️</th><th title="Bases">🏰</th><th title="Paliers d'amélioration">🔬</th></tr></thead>
    <tbody>${rows}</tbody></table>`;
  for (const tr of $('#uiSelBody').querySelectorAll('[data-spec-player]')) {
    tr.onclick = () => { const p = state.players.find((q) => String(q.id) === tr.dataset.specPlayer); if (p) focusPlayer(p); };
  }
  $('#uiCmdTitle').textContent = 'Caméra';
  $('#uiCmdHint').textContent = 'Tab : joueur suivant';
  const grid = $('#uiCmdGrid');
  if (force || !grid.querySelector('[data-spec-act]')) {
    grid.innerHTML = `<button class="cbtn" data-spec-act="next"><span class="key">Tab</span><span class="ico-txt">🎥</span><span class="lbl-b">Joueur suivant</span></button>
      <button class="cbtn" data-spec-act="fight"><span class="ico-txt">💥</span><span class="lbl-b">Action</span></button>
      <button class="cbtn" data-spec-act="center"><span class="ico-txt">🗺️</span><span class="lbl-b">Centre</span></button>`;
    grid.querySelector('[data-spec-act="next"]').onclick = cycleSpectatorFocus;
    grid.querySelector('[data-spec-act="fight"]').onclick = () => {
      const f = hottestFight();
      if (f) { cam.x = f.x; cam.y = f.y; } else toast('Aucun combat en cours.', 1400);
    };
    grid.querySelector('[data-spec-act="center"]').onclick = () => { cam.x = HALF_W; cam.y = HALF_W; cam.z = 0.5; };
  }
}
