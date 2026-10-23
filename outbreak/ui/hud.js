// Interface (DOM) : HUD en jeu, choix d'améliorations, écrans de briefing, de menu et de fin.
import { WEAPONS, PERKS, ROOM_TYPES, CAMPAIGN_ROOMS, DIFFICULTY, WEAPON_IDS, CLASSES, CLASS_IDS, SECTORS, roomName } from '../engine/data.js';
import { weaponIcon } from '../render/sprites.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class HUD {
  constructor({ onPick }) {
    this.root = $('#hud'); this.onPick = onPick;
    this.cache = {};
    this.toastN = -1; this.offerKey = '';
    $('#offers').addEventListener('click', (e) => { const b = e.target.closest('.offer'); if (b) onPick(+b.dataset.i); });
  }
  show(on) { this.root.hidden = !on; }
  set(id, html) { if (this.cache[id] !== html) { this.cache[id] = html; $('#' + id).innerHTML = html; } }
  cls(id, c) { const k = id + ':cls'; if (this.cache[k] !== c) { this.cache[k] = c; $('#' + id).className = c; } }

  update(v, now) {
    const me = v.me; const s = v.snap;
    if (!s) return;
    // salle et statut
    const rm = s.rm;
    const camp = rm.mode !== 'survival';
    this.set('roomN', (SECTORS[rm.sec] ? SECTORS[rm.sec].short.toUpperCase() + ' · ' : '') + (camp ? `SALLE ${rm.i}/${CAMPAIGN_ROOMS}` : 'SURVIE'));
    this.set('roomName', esc(camp ? roomName(rm.ty, rm.sec).split(' — ')[0].replace('Chez Dédé, ferrailleur', 'Marchand') : `Vague ${Math.max(1, s.wv.n)}`));
    let st = '', sc = 'status card';
    if (s.ph === 'won') { st = '✔ Mission accomplie'; sc += ' clear'; }
    else if (s.ph === 'over') { st = '✖ Escouade décimée'; sc += ' lock'; }
    else if (s.rl) { st = `🚪 Départ dans <span class="pill">${Math.ceil(s.rl.t / (s.rl.a ? 5 : 1))}</span>${s.rl.a ? '' : ' · rejoignez la porte'}`; sc += ' rally'; }
    else if (rm.ty === 'shop' && !s.rl) { st = '🛒 Pas de zombies ici · dépensez votre ferraille'; sc += ' clear'; }
    else if (!s.rl && rm.ty === 'vault' && s.vt && s.vt[2] === 'closed') { st = '💰 Forcez le coffre… ou passez votre chemin'; sc += ' rally'; }
    else if (s.cl || (!camp && s.wv.left === 0 && s.wv.n > 0)) { st = camp ? '✔ Zone sécurisée · choisissez une porte' : '✔ Vague repoussée · préparez-vous'; sc += ' clear'; }
    else if (s.wv.n === 0) { st = camp ? '☣ Confinement · ils arrivent…' : '☣ Préparez-vous…'; sc += ' lock'; }
    else { st = `☣ ${camp ? 'Confinement' : 'Horde'}${s.wv.tot > 1 ? ` · vague ${s.wv.n}/${s.wv.tot}` : ''} · <span class="pill">${s.wv.left}</span> restants`; sc += ' lock'; }
    this.set('status', st); this.cls('status', sc);
    this.set('scrap', String(s.scr || 0));
    this.set('score', s.sc.toLocaleString('fr-FR')); this.set('kills', String(s.k)); this.set('clock', fmtTime(v.clock || 0));
    // boss
    const boss = $('#boss');
    if (s.bs >= 0) { boss.hidden = false; $('#bossBar').style.width = s.bs / 10 + '%'; this.set('bossName', '☣ ' + esc((s.bn || '').toUpperCase())); } else boss.hidden = true;
    // toast
    if (s.ts && s.ts.n !== this.toastN) {
      this.toastN = s.ts.n;
      const el = $('#toast'); el.textContent = s.ts.text; el.className = 'toast ' + (s.ts.kind || ''); void el.offsetWidth; el.classList.add('show');
    }
    // équipe
    const mates = v.players.filter((p) => p.id !== v.meId);
    this.set('team', mates.map((p) => {
      const st2 = p.state === 1 ? 'down' : p.state === 2 ? 'dead' : '';
      const info = p.state === 1 ? `✚ ${Math.ceil(p.bl)} s` : p.state === 2 ? '☠' : WEAPONS[p.weapon]?.short || '';
      return `<div class="mate ${st2}" style="--c:${p.color}"><div class="n"><span>${CLASSES[p.cls]?.icon || ''} ${esc(p.name)}${p.bot ? ' 🤖' : ''}</span><em>${info}</em></div><div class="hb"><i style="width:${Math.max(0, (p.h / p.H) * 100)}%"></i></div></div>`;
    }).join(''));
    if (!me) return;
    // moi
    this.set('meName', esc(me.name));
    const C = CLASSES[CLASS_IDS[me.cl]];
    if (C) {
      const ready = me.ab[0] <= 0, active = me.ab[1] > 0;
      const pct = active ? 100 : Math.round((1 - me.ab[0]) * 100);
      this.set('abil', `<span class="ico">${C.icon}</span><span class="nm"><b>${esc(C.active)}</b><small>${active ? 'actif · ' + Math.ceil(me.ab[1]) + ' s' : ready ? 'prête' : Math.ceil(me.ab[0] * C.cd) + ' s'}</small></span><kbd>${ready ? 'A' : ''}</kbd><i style="width:${pct}%"></i>`);
      this.cls('abil', 'abil' + (ready ? ' ready' : '') + (active ? ' on' : ''));
    }
    $('#hpBar').style.width = Math.max(0, (me.h / me.H) * 100) + '%';
    this.set('hpTxt', me.state === 1 ? `À TERRE · ${Math.ceil(me.bl)} s` : me.state === 2 ? 'K.O.' : `${Math.max(0, me.h)} / ${me.H}`);
    $('#hpBar').parentElement.className = 'bar hp' + (me.h < me.H * 0.3 || me.state ? ' low' : '');
    $('#arBar').style.width = Math.max(0, (me.r / me.R) * 100) + '%';
    this.set('arTxt', `${me.r} / ${me.R}`);
    this.set('dash', Array.from({ length: me.dm }, (_, i) => `<i class="${i < me.dc ? '' : 'off'}"></i>`).join(''));
    this.set('nades', '💣'.repeat(me.g) + `<span style="opacity:.25">${'💣'.repeat(Math.max(0, me.gm - me.g))}</span>`);
    this.set('perks', Object.entries(me.pk || {}).map(([id, l]) => PERKS[id] ? `<span class="perk" data-r="${PERKS[id].rar}" title="${esc(PERKS[id].name + ' — ' + PERKS[id].desc)}">${PERKS[id].icon}${l > 1 ? `<sup>${l}</sup>` : ''}</span>` : '').join(''));
    // armes
    const ws = me.w.map(([wi, mag, res], i) => {
      const id = WEAPON_IDS[wi], W = WEAPONS[id];
      const empty = mag === 0 && res === 0;
      return `<div class="wslot ${i === me.sl ? 'on' : ''} ${empty ? 'empty' : ''}"><kbd>${i + 1}</kbd><img src="${weaponIcon(id)}" alt="">${esc(W.short)}</div>`;
    }).join('');
    const cur = me.w[me.sl] || me.w[0];
    const W = WEAPONS[WEAPON_IDS[cur[0]]];
    const low = !W.melee && cur[1] <= Math.ceil(W.mag * 0.25);
    this.set('weapons', `<div class="wslots">${ws}</div><div class="card ammo"><small>${esc(W.name)}</small>${W.melee ? '<b>∞</b><span>mêlée</span>' : `<b class="${low ? 'low' : ''}">${cur[1]}</b><span>/ ${cur[2] < 0 ? '∞' : cur[2]}</span>`}</div>${me.rl > 0 ? `<div class="reload"><i style="width:${me.rl * 100}%"></i></div>` : ''}`);
    // améliorations proposées
    const key = me.of ? me.on + ':' + me.of.join(',') : '';
    if (key !== this.offerKey) {
      this.offerKey = key;
      const el = $('#offers');
      if (!me.of) { el.hidden = true; el.innerHTML = ''; }
      else {
        el.hidden = false;
        el.innerHTML = `<h3>Choisis une amélioration</h3><div class="cards">${me.of.map((id, i) => {
          const P = PERKS[id], l = (me.pk && me.pk[id]) || 0;
          return `<button class="card offer" data-i="${i}" data-r="${P.rar}"><kbd>${i + 1}</kbd><div class="ic">${P.icon}</div><b>${esc(P.name)}</b><p>${esc(P.desc)}</p>${P.max > 1 ? `<span class="lv">Niv. ${l + 1}/${P.max}</span>` : ''}</button>`;
        }).join('')}</div>`;
        v.sfx && v.sfx('offer');
      }
    }
    // invite contextuelle
    this.set('prompt', v.prompt || '');
    $('#prompt').hidden = !v.prompt;
  }
}

// ------------------------------------------------------------------ écrans
const KEYS = [
  ['ZQSD / WASD', 'Se déplacer'], ['Souris', 'Viser · clic gauche : tirer'], ['Espace / Maj', 'Roulade (invulnérable)'], ['Clic droit / G', 'Lancer une grenade'],
  ['A · Q', 'Capacité de classe (A en AZERTY, Q en QWERTY)'], ['R', 'Recharger'], ['1 2 3 · molette', 'Changer d\'arme'], ['E', 'Maintenir : relever un allié · prendre une arme'], ['Échap · M', 'Menu · son'],
];
const PAD = 'Manette : stick gauche bouger, stick droit viser, RT tirer, A roulade, LB grenade, X recharger, B relever, Y capacité, RB arme.';

export function keysHtml() {
  return `<div class="keys">${KEYS.map(([k, d]) => `<div><kbd>${k}</kbd>${d}</div>`).join('')}</div><p class="tagline" style="font-size:13px">${PAD}</p>`;
}

export function classPickerHtml(myClass) {
  return `<div class="classes">${CLASS_IDS.map((id) => { const C = CLASSES[id]; return `<button class="cls ${id === myClass ? 'sel' : ''}" data-c="${id}" style="--c:${C.color}">
    <span class="ci">${C.icon}</span><b>${esc(C.name)}</b><span class="ca">⭐ ${esc(C.active)}</span><small>${esc(C.activeDesc)}</small><small class="cp">${esc(C.passive)}</small></button>`; }).join('')}</div>`;
}

export function briefingHtml({ role, squad, cfg, embedded, canStart, solo, myClass }) {
  const D = DIFFICULTY[cfg.difficulty] || DIFFICULTY.normal;
  const opt = (key, label, options, val) => `<div class="opt"><div class="lbl">${label}</div><div class="seg">${options.map(([v, l]) => `<button data-k="${key}" data-v="${v}" class="${String(val) === String(v) ? 'sel' : ''}">${l}</button>`).join('')}</div></div>`;
  const settings = !embedded ? `<h2>Réglages</h2><div class="opts">
      ${opt('mode', 'Mode', [['campaign', 'Campagne'], ['survival', 'Survie']], cfg.mode)}
      ${opt('difficulty', 'Difficulté', [['arcade', 'Arcade'], ['normal', 'Normale'], ['hardcore', 'Cauchemar']], cfg.difficulty)}
      ${opt('bots', 'Équipiers IA', [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']], cfg.bots)}
      ${opt('startWeapon', 'Arme de départ', [['pistol', 'Pistolet'], ['shotgun', 'Pompe'], ['smg', 'Mitraillette']], cfg.startWeapon)}
      ${opt('sector', 'Secteur', [['random', '🎲 Au hasard'], ...Object.entries(SECTORS).map(([k, S2]) => [k, S2.icon + ' ' + S2.short])], cfg.sector)}
    </div>` : `<div class="chips"><span class="chip">${cfg.mode === 'survival' ? '♾ Survie' : '🗺 Campagne · 7 salles'}</span><span class="chip">☣ ${D.name}</span><span class="chip">${cfg.sector === 'random' || !SECTORS[cfg.sector] ? '🎲 Secteur au hasard' : SECTORS[cfg.sector].icon + ' ' + SECTORS[cfg.sector].name}</span><span class="chip">🔫 Départ : ${WEAPONS[cfg.startWeapon]?.name || 'Pistolet'}</span>${cfg.bots ? `<span class="chip">🤖 ${cfg.bots} équipier${cfg.bots > 1 ? 's' : ''} IA</span>` : ''}</div>`;
  return `<div class="card panel">
    <h1 class="logo">OUTBREAK<small>SECTEUR ZÉRO</small></h1>
    <p class="tagline">${cfg.mode === 'survival'
      ? 'Hangar de quarantaine. Les vagues ne s\'arrêtent jamais : tenez le plus longtemps possible, ensemble.'
      : 'Le laboratoire est tombé. Traversez 6 salles en choisissant votre chemin, puis neutralisez le Spécimen Zéro au cœur du complexe.'}</p>
    ${settings}
    <h2>Ta classe</h2>${classPickerHtml(myClass)}
    <h2>Escouade</h2>
    <div class="squad">${squad.map((p) => `<div class="sq" style="--c:${p.color}"><i></i>${CLASSES[p.cls]?.icon || ''} ${esc(p.name)}<small>${p.bot ? 'IA' : p.me ? 'toi' : p.ready ? 'prêt' : 'connexion…'}</small></div>`).join('')}</div>
    <h2>Commandes</h2>${keysHtml()}
    ${canStart ? `<div class="btnrow"><button class="btn" id="btnGo">Déployer l'escouade</button>${embedded ? '<button class="btn alt" id="btnExit">Retour au salon</button>' : ''}</div>`
      : `<div class="wait"><i></i>${role === 'guest' ? "En attente de l'hôte…" : 'Préparation…'}</div>${embedded ? '<div class="btnrow"><button class="btn alt" id="btnExit">Retour au salon</button></div>' : ''}`}
  </div>`;
}

export function menuHtml({ muted, canQuit, solo }) {
  return `<div class="card panel" style="width:min(560px,100%)">
    <h2 style="margin-top:6px">${solo ? 'Pause' : 'Menu'}</h2>
    ${keysHtml()}
    <div class="btnrow"><button class="btn" id="btnResume">Reprendre</button><button class="btn alt" id="btnSound">${muted ? '🔇 Son coupé' : '🔊 Son activé'}</button></div>
    ${canQuit ? '<div class="btnrow"><button class="btn alt" id="btnQuit">Quitter la partie</button></div>' : ''}
  </div>`;
}

export function endHtml({ won, snap, clock, canReplay, embedded }) {
  const rows = snap.P.slice().sort((a, b) => b.st[1] - a.st[1]);
  const camp = snap.rm.mode !== 'survival';
  const title = won ? 'MISSION ACCOMPLIE' : 'ESCOUADE DÉCIMÉE';
  const sub = won ? 'Le Spécimen Zéro est neutralisé. Le secteur est sauvé… pour l\'instant.'
    : camp ? `Tombés dans la salle ${snap.rm.i} (${ROOM_TYPES[snap.rm.ty].name.split(' — ')[0]}).` : `Vous avez tenu jusqu'à la vague ${snap.wv.n}.`;
  return `<div class="card panel">
    <div class="res-title ${won ? 'win' : 'lose'}">${title}</div>
    <p class="tagline">${esc(sub)}</p>
    <div class="big3">
      <div><small>Score</small><b>${snap.sc.toLocaleString('fr-FR')}</b></div>
      <div><small>${camp ? 'Salles' : 'Vagues'}</small><b>${camp ? snap.rc : snap.wv.n}</b></div>
      <div><small>Éliminés</small><b>${snap.k}</b></div>
      <div><small>Temps</small><b>${fmtTime(clock)}</b></div>
    </div>
    <table class="res"><thead><tr><th>Survivant</th><th>Score</th><th>Éliminés</th><th>Dégâts</th><th>Relevés</th><th>À terre</th></tr></thead><tbody>
    ${rows.map((p, i) => `<tr class="${i === 0 ? 'mvp' : ''}"><td><span class="dot" style="--c:${p.c}"></span>${esc(p.n)}${p.b ? ' 🤖' : ''}${i === 0 ? ' ⭐' : ''}</td><td>${p.st[1].toLocaleString('fr-FR')}</td><td>${p.st[0]}</td><td>${p.st[4].toLocaleString('fr-FR')}</td><td>${p.st[2]}</td><td>${p.st[3]}</td></tr>`).join('')}
    </tbody></table>
    <div class="btnrow">${canReplay ? '<button class="btn" id="btnAgain">Rejouer</button>' : '<div class="wait" style="margin:0"><i></i>L\'hôte peut relancer une partie</div>'}
    ${embedded ? '<button class="btn alt" id="btnExit">Retour au salon</button>' : ''}</div>
  </div>`;
}
