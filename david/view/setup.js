// Salle d'avant-partie : chaque joueur choisit son pion, l'hôte lance la partie.
import { TOKENS, tokenSvg, tokenName } from './tokens.js';
import { esc, el, store, save } from './util.js';
import { sfx } from './sfx.js';

const LEVEL_WORDS = { facile: ['facile', 'faciles'], normal: ['normal', 'normaux'], expert: ['expert', 'experts'] };
export function botsLabel(n, level) {
  const w = LEVEL_WORDS[level] || LEVEL_WORDS.normal;
  return `${n} bot${n > 1 ? 's' : ''} ${n > 1 ? w[1] : w[0]}`;
}

export function houseChips(h) {
  if (!h) return '';
  const list = [`${h.cash.toLocaleString('fr-FR')} € au départ`];
  if (h.jackpot) list.push('Cagnotte au Parc gratuit');
  if (h.doubleGo) list.push('Salaire doublé pile sur Départ');
  if (!h.auctions) list.push('Sans enchères');
  const custom = h.jackpot || h.doubleGo || !h.auctions || h.cash !== 1500;
  return `<div class="hrules">${custom ? '<b>Règles maison :</b>' : '<b>Règles officielles</b>'}${custom ? list.map((x) => `<span>${esc(x)}</span>`).join('') : ''}</div>`;
}

const ago = (at) => {
  const m = Math.round((Date.now() - at) / 60000);
  if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  const d = Math.round(h / 24); return `il y a ${d} jour${d > 1 ? 's' : ''}`;
};

const TEAM_NAMES = ['Équipe A', 'Équipe B'];
function teamsHtml(s, me) {
  const humans = s.players.filter((p) => p.ready);
  const mine = s.teams.of[me.id];
  const col = (t) => {
    const mem = humans.filter((p) => s.teams.of[p.id] === t);
    const slots = mem.map((p) => `<li style="--c:${p.color}"><span class="tsv">${s.picks[p.id] ? tokenSvg(s.picks[p.id], p.color) : ''}</span><b>${esc(p.name)}</b>${p.id === me.id ? '<small>toi</small>' : ''}</li>`);
    while (slots.length < 2) slots.push('<li class="botslot"><span class="tsv">🤖</span><b>Bot</b><small>complète l\'équipe</small></li>');
    const canJoin = mine !== t && mem.length < 2 && !s.teams.tooMany;
    return `<div class="tcol t${t}${mine === t ? ' mine' : ''}"><h3>${TEAM_NAMES[t]}</h3><ul>${slots.join('')}</ul>
      ${canJoin ? `<button class="btn ghost small" data-team="${t}">Rejoindre</button>` : mine === t ? '<span class="tme">Ton équipe</span>' : ''}</div>`;
  };
  return `<div class="teams2">${col(0)}<div class="vs">VS</div>${col(1)}</div>
    ${s.teams.tooMany ? '<p class="hint center warn">Le 2 contre 2 se joue à 4 : il y a trop de joueurs dans le salon.</p>' : '<p class="hint center">Pas de loyer chez son coéquipier, échanges entre coéquipiers pour regrouper les couleurs. L\'équipe au plus gros patrimoine cumulé l\'emporte.</p>'}`;
}

export function mountSetup(root, { me, pick, start, exit, chooseSave, deleteSave, team = () => {} }) {
  const box = el('div', 'setup');
  root.appendChild(box);
  let last = '', autoPicked = false, S = null;

  function render(s) {
    S = s;
    const key = JSON.stringify(s);
    if (key === last) return;
    last = key;
    const mine = s.picks[me.id];
    const owner = (tk) => { const e = Object.entries(s.picks).find(([, v]) => v === tk); return e ? s.players.find((p) => p.id === +e[0]) : null; };
    const isHost = s.hostId === me.id;
    const meP = s.players.find((p) => p.id === me.id) || { color: me.color };
    const humans = s.players.filter((p) => p.ready);
    const missing = humans.filter((p) => !s.picks[p.id]).length;
    box.innerHTML = `
      <div class="setup-card">
        <div class="setup-head">
          ${s.resume ? '<div><h1>Reprendre la partie</h1></div>' : `<div><h1>Choisis ton pion</h1><p>${s.mode === 'express' ? 'Partie Express · 40 minutes' : 'Partie classique'}${s.teams ? ' · 2 contre 2' : ''}${s.bots ? ` · ${botsLabel(s.bots, s.level)}` : ''}</p>
            ${houseChips(s.house)}</div>`}
          <button class="btn ghost small" id="suQuit">Quitter</button>
        </div>
        ${s.resume ? resumeHtml(s.resume, isHost) : `<div class="setup-body">
          <div class="showcase">
            <div class="pedestal"><div class="spin">${tokenSvg(mine || TOKENS[0].id, meP.color)}</div></div>
            <b>${mine ? esc(tokenName(mine)) : 'À toi de choisir'}</b>
          </div>
          <div class="tokgrid" role="radiogroup" aria-label="Pions">
            ${TOKENS.map((t) => {
              const o = owner(t.id), taken = o && o.id !== me.id, sel = mine === t.id;
              return `<button class="tok${sel ? ' sel' : ''}${taken ? ' taken' : ''}" role="radio" aria-checked="${sel}" data-tok="${t.id}" ${taken ? 'aria-disabled="true"' : ''}>
                <span class="tsv">${tokenSvg(t.id, o ? o.color : '#c9c0ad')}</span><b>${esc(t.name)}</b>${o ? `<small style="--c:${o.color}">${o.id === me.id ? 'toi' : esc(o.name)}</small>` : ''}</button>`;
            }).join('')}
          </div>
        </div>${s.teams ? teamsHtml(s, me) : ''}`}
        ${isHost && !s.resume && s.saves && s.saves.length ? savesHtml(s.saves) : ''}
        <div class="setup-foot">
          <div class="who">${s.players.map((p) => `<span class="${p.ready ? '' : 'wait'}"><i style="background:${p.color}"></i>${esc(p.name)}${p.id === me.id ? ' (toi)' : ''} · ${!p.ready ? 'charge le jeu…' : s.resume ? 'prêt' : s.picks[p.id] ? esc(tokenName(s.picks[p.id])) : 'choisit…'}</span>`).join('')}</div>
          ${isHost
            ? (s.resume
              ? `<span class="row"><button class="btn ghost" id="suNew">Nouvelle partie</button><button class="btn big" id="suGo">Reprendre la partie</button></span>`
              : `<button class="btn big" id="suGo" ${mine && !(s.teams && s.teams.tooMany) ? '' : 'disabled'}>${mine ? 'Lancer la partie' : 'Choisis d\'abord ton pion'}</button>`)
            : `<span class="waithost"><i></i>${s.resume ? 'L\'hôte reprend une partie sauvegardée…' : 'L\'hôte lance la partie…'}</span>`}
        </div>
        ${isHost && missing && mine && !s.resume ? `<p class="hint center">${missing} joueur${missing > 1 ? 's' : ''} n'${missing > 1 ? 'ont' : 'a'} pas encore choisi : un pion leur sera attribué au hasard.</p>` : ''}
      </div>`;
    for (const b of box.querySelectorAll('[data-tok]')) b.onclick = () => {
      if (b.classList.contains('taken')) { sfx.play('error'); return; }
      sfx.play('bid'); save('david_token', b.dataset.tok); pick(b.dataset.tok);
    };
    for (const b of box.querySelectorAll('[data-team]')) b.onclick = () => { sfx.play('bid'); team(+b.dataset.team); };
    const go = box.querySelector('#suGo'); if (go) go.onclick = () => { sfx.play('turn'); start(); };
    box.querySelector('#suQuit').onclick = exit;
    for (const b of box.querySelectorAll('[data-resume]')) b.onclick = () => { sfx.play('bid'); chooseSave(b.dataset.resume); };
    for (const b of box.querySelectorAll('[data-delsave]')) b.onclick = (e) => { e.stopPropagation(); if (confirm('Supprimer cette sauvegarde ?')) deleteSave(b.dataset.delsave); };
    const nw = box.querySelector('#suNew'); if (nw) nw.onclick = () => chooseSave(null);
    // pion favori choisi automatiquement s'il est libre
    if (!mine && !autoPicked) {
      autoPicked = true;
      const fav = store('david_token', null);
      if (fav && !owner(fav)) pick(fav);
    }
  }

  function savesHtml(list) {
    return `<div class="saves"><h3>Reprendre une partie sauvegardée</h3><div class="savelist">${list.map((sv) => `
      <div class="save"><button class="saveb" data-resume="${esc(sv.id)}">
        <b>${sv.mode === 'express' ? 'Express' : 'Classique'} · tour ${sv.round}</b><small>${ago(sv.at)}</small>
        <span class="minitoks">${sv.players.map((p) => `<span class="mt${p.bankrupt ? ' out' : ''}" title="${esc(p.name)}">${tokenSvg(p.token, p.color)}</span>`).join('')}</span>
        <span class="names">${sv.players.map((p) => esc(p.name)).join(', ')}</span></button>
        <button class="del" data-delsave="${esc(sv.id)}" aria-label="Supprimer la sauvegarde">×</button></div>`).join('')}</div></div>`;
  }
  function resumeHtml(r, isHost) {
    return `<div class="resume"><h3>Partie ${r.mode === 'express' ? 'Express' : 'classique'} · tour ${r.round} <small>(sauvegardée ${ago(r.at)})</small></h3>
      ${houseChips(r.house)}
      <div class="seats">${r.seats.map((p) => `<div class="seat${p.bankrupt ? ' out' : ''}"><span class="tsv">${tokenSvg(p.token, p.color)}</span>
        <div><b>${esc(p.name)}</b><small>${p.bankrupt ? 'en faillite' : (p.cash ?? 0).toLocaleString('fr-FR') + ' €'}</small></div>
        <span class="arrow">→</span><span class="to${p.to ? '' : ' bot'}">${p.to ? esc(p.to) : 'bot'}</span></div>`).join('')}</div>
      <p class="hint">${isHost ? 'Les places sont attribuées par nom, puis dans l\'ordre ; les joueurs absents sont joués par un bot.' : 'Chaque joueur retrouve son pion, son argent et ses propriétés.'}</p></div>`;
  }

  return {
    render,
    hide() { if (!box.isConnected) return; box.classList.add('out'); setTimeout(() => box.remove(), 500); },
    get open() { return box.isConnected && !box.classList.contains('out'); },
  };
}
