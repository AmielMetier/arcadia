// Salle d'avant-partie : chaque joueur choisit son pion, l'hôte lance la partie.
import { TOKENS, tokenSvg, tokenName } from './tokens.js';
import { esc, el, store, save } from './util.js';
import { sfx } from './sfx.js';

export function houseChips(h) {
  if (!h) return '';
  const list = [`${h.cash.toLocaleString('fr-FR')} € au départ`];
  if (h.jackpot) list.push('Cagnotte au Parc gratuit');
  if (h.doubleGo) list.push('Salaire doublé pile sur Départ');
  if (!h.auctions) list.push('Sans enchères');
  const custom = h.jackpot || h.doubleGo || !h.auctions || h.cash !== 1500;
  return `<div class="hrules">${custom ? '<b>Règles maison :</b>' : '<b>Règles officielles</b>'}${custom ? list.map((x) => `<span>${esc(x)}</span>`).join('') : ''}</div>`;
}

export function mountSetup(root, { me, pick, start, exit }) {
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
          <div><h1>Choisis ton pion</h1><p>${s.mode === 'express' ? 'Partie Express · 40 minutes' : 'Partie classique'}${s.bots ? ` · ${s.bots} bot${s.bots > 1 ? 's' : ''}` : ''}</p>
            ${houseChips(s.house)}</div>
          <button class="btn ghost small" id="suQuit">Quitter</button>
        </div>
        <div class="setup-body">
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
        </div>
        <div class="setup-foot">
          <div class="who">${s.players.map((p) => `<span class="${p.ready ? '' : 'wait'}"><i style="background:${p.color}"></i>${esc(p.name)}${p.id === me.id ? ' (toi)' : ''} · ${!p.ready ? 'charge le jeu…' : s.picks[p.id] ? esc(tokenName(s.picks[p.id])) : 'choisit…'}</span>`).join('')}</div>
          ${isHost
            ? `<button class="btn big" id="suGo" ${mine ? '' : 'disabled'}>${mine ? 'Lancer la partie' : 'Choisis d\'abord ton pion'}</button>`
            : `<span class="waithost"><i></i>L'hôte lance la partie…</span>`}
        </div>
        ${isHost && missing && mine ? `<p class="hint center">${missing} joueur${missing > 1 ? 's' : ''} n'${missing > 1 ? 'ont' : 'a'} pas encore choisi : un pion leur sera attribué au hasard.</p>` : ''}
      </div>`;
    for (const b of box.querySelectorAll('[data-tok]')) b.onclick = () => {
      if (b.classList.contains('taken')) { sfx.play('error'); return; }
      sfx.play('bid'); save('david_token', b.dataset.tok); pick(b.dataset.tok);
    };
    const go = box.querySelector('#suGo'); if (go) go.onclick = () => { sfx.play('turn'); start(); };
    box.querySelector('#suQuit').onclick = exit;
    // pion favori choisi automatiquement s'il est libre
    if (!mine && !autoPicked) {
      autoPicked = true;
      const fav = store('david_token', null);
      if (fav && !owner(fav)) pick(fav);
    }
  }

  return {
    render,
    hide() { if (!box.isConnected) return; box.classList.add('out'); setTimeout(() => box.remove(), 500); },
    get open() { return box.isConnected && !box.classList.contains('out'); },
  };
}
