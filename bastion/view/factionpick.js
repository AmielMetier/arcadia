// Interface de Bastion Clash (navigateur uniquement).
// Choix de la faction en début de partie (réglage « au choix de chacun »), mémorisé pour les parties suivantes.
'use strict';

const FACTION_PREF_KEY = 'bastion_faction';
let factionAutoSent = false;
let factionChosen = false; // le joueur a cliqué : on referme le panneau

function prefFaction() {
  try { return localStorage.getItem(FACTION_PREF_KEY); } catch (e) { return null; }
}

function chooseFaction(id) {
  try { localStorage.setItem(FACTION_PREF_KEY, id); } catch (e) { /* ignoré */ }
  sendCommand({ op: 'SET_FACTION', faction: id });
  factionChosen = true;
  renderFactionPick(true);
}

function renderFactionPick(force = false) {
  const box = $('#uiFactionPick');
  if (!box || !state) return;
  const me = state.players.find((p) => Number(p.id) === Number(myId));
  const open = me && !me.dead && !factionChosen && state.factionRule === 'libre' && state.time < FACTION_PICK_TIME && !state.waves?.n;
  if (!open) { box.hidden = true; return; }
  // Le choix de la partie précédente est appliqué d'office (on peut encore changer pendant le décompte)
  if (!factionAutoSent) {
    factionAutoSent = true;
    const pref = prefFaction();
    if (pref && FACTIONS[pref] && pref !== factionOf(me).id) sendCommand({ op: 'SET_FACTION', faction: pref });
  }
  box.hidden = false;
  $('#uiFactionTimer').textContent = `${Math.ceil(FACTION_PICK_TIME - state.time)} s`;
  const sig = factionOf(me).id;
  if (!force && box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  $('#uiFactionCards').innerHTML = Object.values(FACTIONS).map((f) => `<button class="fp-card ${f.id === sig ? 'on' : ''}" data-faction="${f.id}">
      <span class="fp-ico">${f.icon}</span><b>${f.name}</b><small>${f.desc}</small>
    </button>`).join('');
  for (const b of $('#uiFactionCards').querySelectorAll('[data-faction]')) {
    b.onclick = (e) => { e.stopPropagation(); chooseFaction(b.dataset.faction); };
    b.onpointerdown = (e) => e.stopPropagation();
  }
}
