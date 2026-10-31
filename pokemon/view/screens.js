// pokemon/view/screens.js
// Écrans du tournoi Poké Duel hors combat : draft, tableau, aperçu des équipes, résumé de manche, podium.
// Chaque écran est redessiné à chaque état reçu de l'hôte ; les choix en cours (sélection du draft,
// Pokémon de tête) vivent dans ctx.local pour survivre à ces redessins.
// Les compte à rebours ([data-deadline]) sont animés par game.js.

import { getPokemonById, spriteUrls } from '../engine/data.js';
import { MOVES } from '../engine/moves.js';
import { ITEMS, itemsFor, cleanItems, suggestItems } from '../engine/items.js';
import { megasOf } from '../engine/megas.js';
import { ABILITIES, abilityOf } from '../engine/abilities.js';
import { TYPES, getEffectiveness, getShowdownTypeIcon } from '../engine/types.js';
import {
  getParticipant, currentMatch, sideOf, autoDraft, chooseLead, attackTypes, statTotal,
  nextPlayableMatch, tournamentMvp, TEAM_SIZE,
} from '../engine/tournament.js';

const TYPE_KEYS = Object.keys(TYPES);
const STAT_ROWS = [['hp', 'PV'], ['atk', 'ATQ'], ['def', 'DÉF'], ['spa', 'A.SP'], ['spd', 'D.SP'], ['spe', 'VIT']];

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[c]));

const same = (a, b) => a != null && b != null && String(a) === String(b);

// Portraits de dresseurs : sprites de Pokémon Showdown (les bots sont des dresseurs célèbres,
// chaque joueur reçoit un dresseur selon son nom). Si l'image ne charge pas, l'initiale reste visible.
const TRAINER_CDN = 'https://play.pokemonshowdown.com/sprites/trainers/';
// Plusieurs noms possibles par dresseur : on essaie le suivant si une image manque
const BOT_SPRITES = {
  901: ['red', 'red-gen1'], 902: ['blue', 'blue-gen1'], 903: ['cynthia', 'cynthia-gen4'], 904: ['lance', 'lance-gen3'],
  905: ['misty', 'misty-gen1'], 906: ['brock', 'brock-gen1'], 907: ['agatha-gen3', 'agatha-gen1', 'agatha-lgpe', 'agatha'],
};
const PLAYER_SPRITES = ['hilbert', 'hilda', 'nate', 'rosa', 'ethan', 'lyra', 'lucas', 'dawn', 'brendan', 'may', 'calem', 'serena'];

export function trainerSprites(p) {
  if (!p) return [];
  let names;
  if (p.bot && BOT_SPRITES[p.id]) names = BOT_SPRITES[p.id];
  else {
    let h = 0;
    for (const c of `${p.name}`.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    names = [PLAYER_SPRITES[h % PLAYER_SPRITES.length], PLAYER_SPRITES[(h + 1) % PLAYER_SPRITES.length]];
  }
  return names.map((n) => `${TRAINER_CDN}${n}.png`);
}

const NEXT_SPRITE = "var a=(this.dataset.alt||'').split('|').filter(Boolean);if(a.length){this.dataset.alt=a.slice(1).join('|');this.src=a[0];}else{this.remove();}";

export function trainerAvatar(p, size = 'md') {
  if (!p) return `<span class="tz-av ${size} empty"></span>`;
  const initial = esc((p.name || '?').trim().charAt(0).toUpperCase());
  const urls = trainerSprites(p);
  return `<span class="tz-av ${size} ${p.gone ? 'gone' : ''}" style="--pc:${p.color}"><b>${initial}</b><img src="${urls[0]}" data-alt="${urls.slice(1).join('|')}" alt="" referrerpolicy="no-referrer" onload="this.classList.add('ok')" onerror="${NEXT_SPRITE}"></span>`;
}

function typeChip(t, short = false) {
  const T = TYPES[t];
  if (!T) return '';
  return `<span class="tz-type" style="--tc:${T.color}"><img src="${getShowdownTypeIcon(t)}" alt="">${short ? T.name.slice(0, 4) : T.name}</span>`;
}

function trainerTag(p, extra = '') {
  if (!p) return '<span class="tz-trainer tbd">À déterminer</span>';
  return `<span class="tz-trainer ${extra}" style="--pc:${p.color}"><i></i><b>${esc(p.name)}</b>${p.bot ? `<em>${esc(p.title || 'BOT')}</em>` : ''}${p.gone ? '<em class="gone">PARTI</em>' : ''}</span>`;
}

function countdown(s, label = '') {
  if (!s.deadline) return '';
  return `<div class="tz-countdown"><span>${label}</span><b data-deadline="${s.deadline}">…</b></div>`;
}

function deadlineBar(s, total) {
  if (!s.deadline) return '';
  return `<div class="tz-timebar"><i data-deadline-bar="${s.deadline}" data-total="${total * 1000}"></i></div>`;
}

/** Meilleur multiplicateur des attaques de `att` contre `def`. */
function bestEff(attDex, defDex) {
  const a = getPokemonById(attDex);
  const d = getPokemonById(defDex);
  if (!a || !d) return 1;
  return Math.max(0, ...attackTypes(a).map((t) => getEffectiveness(t, d.types)));
}

function effBadge(eff) {
  if (eff >= 4) return '<span class="tz-eff x4">×4</span>';
  if (eff >= 2) return '<span class="tz-eff x2">×2</span>';
  if (eff === 0) return '<span class="tz-eff x0">×0</span>';
  if (eff < 1) return '<span class="tz-eff xh">×½</span>';
  return '<span class="tz-eff x1">×1</span>';
}

/** Analyse d'équipe : couverture offensive et faiblesses partagées. */
export function analyzeTeam(ids) {
  const bases = ids.map(getPokemonById).filter(Boolean);
  const mTypes = [...new Set(bases.flatMap(attackTypes))];
  const coverage = TYPE_KEYS.filter((def) => mTypes.some((mt) => getEffectiveness(mt, [def]) >= 2));
  const weak = bases.length >= 2
    ? TYPE_KEYS.filter((att) => bases.filter((b) => getEffectiveness(att, b.types) >= 2).length >= 2)
    : [];
  return { coverage, weak };
}

// ===========================================================================
// DRAFT
// ===========================================================================

export function renderDraft(stage, s, ctx) {
  const t = s.t;
  const meP = getParticipant(t, ctx.me.id);
  const humans = t.participants.filter((p) => !p.bot);
  const waiting = humans.filter((p) => !p.team && !p.gone);

  const statusRow = `
    <div class="dr-status">
      ${humans.map((p) => `<span class="dr-pill ${p.team ? 'done' : ''}" style="--pc:${p.color}"><i></i>${esc(p.name)}${p.team ? ' ✓' : ''}</span>`).join('')}
      ${t.participants.some((p) => p.bot) ? `<span class="dr-pill bot">+ ${t.participants.filter((p) => p.bot).length} bots</span>` : ''}
    </div>`;

  if (!meP) {
    stage.innerHTML = `
      <div class="tz-screen tz-center deal">
        <div class="tz-kicker">DRAFT EN COURS</div>
        <h2 class="tz-title">Les dresseurs composent leur équipe</h2>
        <p class="tz-sub">Tu regardes ce tournoi en spectateur ; tu pourras rejoindre le suivant.</p>
        ${countdown(s, 'Fin du draft dans')}
        ${statusRow}
      </div>`;
    return;
  }

  const locked = !!meP.team;
  const sel = locked ? meP.team : ctx.local.draft;
  const { coverage, weak } = analyzeTeam(sel);

  const cards = meP.offer.map((dex, i) => {
    const b = getPokemonById(dex);
    if (!b) return '';
    const order = sel.indexOf(dex);
    const moves = (b.cleanMoves || []).map((id) => MOVES[id]).filter(Boolean);
    return `
      <button class="dr-card ${order >= 0 ? 'picked' : ''}" data-dex="${dex}" ${locked ? 'disabled' : ''}
        style="--c1:${TYPES[b.types[0]].color};--c2:${TYPES[b.types[1] || b.types[0]].color}">
        <span class="dr-key">${i + 1}</span>
        ${order >= 0 ? `<span class="dr-order">${order + 1}</span>` : ''}
        <div class="dr-art"><img src="${spriteUrls(dex).artwork}" alt="" loading="lazy"></div>
        <b class="dr-name">${esc(b.name)}${megasOf(dex).length ? ' <span class="dr-mega" title="Peut méga-évoluer avec sa Méga-Gemme">MÉGA</span>' : ''}</b>
        <div class="dr-types">${b.types.map((ty) => typeChip(ty)).join('')}</div>
        ${ABILITIES[abilityOf(dex)] ? `<div class="dr-ability" title="${esc(ABILITIES[abilityOf(dex)].desc)}"><b>${esc(ABILITIES[abilityOf(dex)].name)}</b> ${esc(ABILITIES[abilityOf(dex)].desc)}</div>` : ''}
        <div class="dr-stats">
          ${STAT_ROWS.map(([k, l]) => `
            <div class="dr-stat"><span>${l}</span><i><u style="width:${Math.min(100, (b.stats[k] / 190) * 100)}%"></u></i><em>${b.stats[k]}</em></div>`).join('')}
          <div class="dr-total">Total <b>${statTotal(b)}</b></div>
        </div>
        <div class="dr-moves">
          ${moves.map((m) => `<span class="dr-move" style="--tc:${TYPES[m.type].color}" title="${esc(m.name)} · ${m.power || '—'} de puissance">${esc(m.name)}<em>${m.power || (m.cat === 'status' ? 'STA' : '—')}</em></span>`).join('')}
        </div>
      </button>`;
  }).join('');

  // objets tenus : ceux enregistrés, sinon tes choix complétés par les conseils (jamais deux fois le même)
  const held = locked ? (meP.items || suggestItems(sel)) : cleanItems(sel, ctx.local.items);
  const itemPick = (dex) => {
    const cur = held[dex];
    const it = ITEMS[cur];
    if (locked) return it ? `<div class="dr-item locked" title="${esc(it.desc)}"><img src="${it.icon}" alt=""><span>${esc(it.name)}</span></div>` : '';
    return `<label class="dr-item" title="${it ? esc(it.desc) : ''}">${it ? `<img src="${it.icon}" alt="">` : ''}
      <select data-item-for="${dex}" aria-label="Objet tenu">${itemsFor(dex).map((k) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${ITEMS[k].mega ? '✦ ' : ''}${esc(ITEMS[k].name)}</option>`).join('')}</select></label>`;
  };
  const slots = Array.from({ length: TEAM_SIZE }, (_, i) => {
    const b = sel[i] ? getPokemonById(sel[i]) : null;
    return b
      ? `<div class="dr-slot full"><img src="${spriteUrls(b.id).icon}" alt=""><div class="dr-slot-tx"><b>${esc(b.name)}</b>${itemPick(b.id)}</div></div>`
      : `<div class="dr-slot"><span>${i + 1}</span></div>`;
  }).join('');
  const heldDesc = sel.length ? `<div class="dr-items-help">${sel.map((d) => held[d] && ITEMS[held[d]] ? `<p><img src="${ITEMS[held[d]].icon}" alt=""><b>${esc(ITEMS[held[d]].name)}</b> ${esc(ITEMS[held[d]].desc)}</p>` : '').join('')}</div>` : '';

  stage.innerHTML = `
    <div class="tz-screen draft deal">
      <header class="tz-head">
        <div>
          <div class="tz-kicker">ÉTAPE 1 · DRAFT</div>
          <h2 class="tz-title">${locked ? 'Équipe validée' : 'Compose ton équipe'}</h2>
          <p class="tz-sub">${locked
            ? (waiting.length ? `En attente de ${waiting.map((p) => esc(p.name)).join(', ')}…` : 'Tout le monde est prêt, tirage du tableau…')
            : 'Garde 3 Pokémon sur les 6 proposés et donne un objet à chacun (un objet conseillé est déjà choisi). L\'équipe te suivra tout le tournoi.'}</p>
        </div>
        ${countdown(s, locked ? 'Fin du draft' : 'Temps restant')}
      </header>
      ${deadlineBar(s, 50)}
      <div class="dr-layout">
        <div class="dr-grid ${locked ? 'locked' : ''}">${cards}</div>
        <aside class="dr-side">
          <div class="dr-side-title">TON ÉQUIPE <span>${sel.length}/3</span></div>
          <div class="dr-slots">${slots}</div>
          ${heldDesc}
          <div class="dr-analysis">
            <div class="dr-an-row">
              <span>Couverture</span>
              <b class="${coverage.length >= 12 ? 'good' : coverage.length >= 8 ? 'mid' : 'low'}">${sel.length ? `${coverage.length} / ${TYPE_KEYS.length} types` : '—'}</b>
            </div>
            <div class="dr-an-row col">
              <span>Faiblesses communes</span>
              <div class="dr-weak">${sel.length < 2 ? '<em>Choisis au moins 2 Pokémon</em>' : weak.length ? weak.map((w) => typeChip(w, true)).join('') : '<em class="good">Aucune, bien joué</em>'}</div>
            </div>
          </div>
          ${locked ? '<div class="dr-locked">✓ Équipe enregistrée</div>' : `
            <button class="btn ghost dr-auto" id="drAuto">CHOIX CONSEILLÉ</button>
            <button class="btn big yellow dr-go" id="drGo" ${sel.length === TEAM_SIZE ? '' : 'disabled'}>VALIDER <small>Entrée</small></button>`}
          <p class="dr-hint">${locked ? '' : 'Touches 1 à 6 pour choisir'}</p>
        </aside>
      </div>
      ${statusRow}
    </div>`;

  if (locked) return;
  for (const btn of stage.querySelectorAll('.dr-card')) {
    btn.onclick = () => ctx.toggleDraft(Number(btn.dataset.dex));
  }
  stage.querySelector('#drAuto').onclick = () => {
    ctx.local.draft = autoDraft(meP.offer);
    ctx.sfx.play('switch');
    ctx.rerender();
  };
  stage.querySelector('#drGo').onclick = () => ctx.submitDraft();
  for (const sl of stage.querySelectorAll('select[data-item-for]')) {
    sl.onchange = () => ctx.setItem(Number(sl.dataset.itemFor), sl.value);
  }
}

// ===========================================================================
// TABLEAU
// ===========================================================================

function matchFlag(m, t) {
  if (m.status === 'live') return '<span class="br-flag live">EN DIRECT</span>';
  if (m.how === 'bye' && m.status === 'done') return '<span class="br-flag">QUALIFIÉ D\'OFFICE</span>';
  if (m.how === 'forfeit') return '<span class="br-flag ff">FORFAIT</span>';
  if (m.how === 'sim') return '<span class="br-flag sim">JOUÉ ENTRE BOTS</span>';
  const next = nextPlayableMatch(t);
  if (next && next.id === m.id) return '<span class="br-flag next">À SUIVRE</span>';
  return '';
}

function bracketRow(t, m, side) {
  const pid = side === 'A' ? m.a : m.b;
  const p = pid != null ? getParticipant(t, pid) : null;
  const won = m.status === 'done' && same(m.winner, pid);
  const lost = m.status === 'done' && pid != null && !won;
  const score = m.bestOf > 1 && (m.scoreA || m.scoreB) ? `<b class="br-score">${side === 'A' ? m.scoreA : m.scoreB}</b>` : (won ? '<b class="br-score win">✓</b>' : '');
  const empty = m.how === 'bye' && pid == null ? 'Exempt' : '—';
  return `
    <div class="br-row ${won ? 'win' : ''} ${lost ? 'lost' : ''} ${p && !p.bot ? 'human' : ''}" style="--pc:${p ? p.color : '#3b4e6d'}">
      ${p ? trainerAvatar(p, 'xs') : '<span class="tz-av xs empty"></span>'}<span class="br-name">${p ? esc(p.name) : `<em>${empty}</em>`}</span>
      ${p && p.bot ? '<span class="br-bot">BOT</span>' : ''}${score}
    </div>`;
}

export function bracketHtml(t, meId, compact = false) {
  return `
    <div class="br-tree ${compact ? 'compact' : ''}" style="--rounds:${t.rounds.length}">
      ${t.rounds.map((round) => `
        <div class="br-col">
          <div class="br-col-title">${esc(round[0].name)}${round[0].bestOf > 1 ? ' <small>2 manches gagnantes</small>' : ''}</div>
          <div class="br-col-body">
            ${round.map((m) => `
              <div class="br-cell">
                <div class="br-match ${m.status} ${sideOf(m, meId) ? 'mine' : ''}">
                  ${bracketRow(t, m, 'A')}
                  ${bracketRow(t, m, 'B')}
                  ${matchFlag(m, t)}
                </div>
              </div>`).join('')}
          </div>
        </div>`).join('')}
      <div class="br-col br-col-champ">
        <div class="br-col-title">Champion</div>
        <div class="br-col-body"><div class="br-cell"><div class="br-champ ${t.champion != null ? 'won' : ''}">${TROPHY_SVG}${t.champion != null ? trainerTag(getParticipant(t, t.champion)) : '<span class="br-champ-tbd">?</span>'}</div></div></div>
      </div>
    </div>`;
}

function recentLine(t, id) {
  const m = t.rounds.flat().find((x) => x.id === id);
  if (!m || m.winner == null) return '';
  const w = getParticipant(t, m.winner);
  const l = getParticipant(t, same(m.winner, m.a) ? m.b : m.a);
  if (m.how === 'bye') return `<li><b>${esc(w.name)}</b> est qualifié d'office</li>`;
  if (m.how === 'forfeit') return `<li><b>${esc(w.name)}</b> passe : ${esc(l ? l.name : '?')} a quitté le tournoi</li>`;
  const score = m.bestOf > 1 ? ` ${Math.max(m.scoreA, m.scoreB)}-${Math.min(m.scoreA, m.scoreB)}` : '';
  return `<li><b>${esc(w.name)}</b> bat ${esc(l ? l.name : '?')}${score}</li>`;
}

export function renderBracket(stage, s, ctx) {
  const t = s.t;
  const next = nextPlayableMatch(t);
  const A = next && getParticipant(t, next.a);
  const B = next && getParticipant(t, next.b);
  const mine = next && sideOf(next, ctx.me.id);
  const humans = t.participants.filter((p) => !p.bot).length;
  const recent = (t.recent || []).map((id) => recentLine(t, id)).filter(Boolean);

  stage.innerHTML = `
    <div class="tz-screen bracket deal">
      <header class="tz-head">
        <div>
          <div class="tz-kicker">TABLEAU DU TOURNOI</div>
          <h2 class="tz-title">${t.rounds.flat().some((m) => m.status === 'done' && m.how !== 'bye') ? 'Le tableau avance' : 'Le tirage est fait'}</h2>
          <p class="tz-sub">${t.participants.length} dresseurs dont ${humans} joueur${humans > 1 ? 's' : ''} · élimination directe${t.finalBestOf > 1 ? ' · finale en 2 manches gagnantes' : ''}</p>
        </div>
      </header>
      ${bracketHtml(t, ctx.me.id)}
      ${recent.length ? `<div class="br-recent"><span>Pendant ce temps</span><ul>${recent.join('')}</ul></div>` : ''}
      ${next ? `
        <div class="br-next ${mine ? 'mine' : ''}">
          <div class="br-next-label">${mine ? 'TON MATCH ARRIVE' : 'PROCHAIN MATCH'} · ${esc(next.name.toUpperCase())}</div>
          <div class="br-next-vs">
            <div class="br-next-p">${trainerAvatar(A, 'lg')}${trainerTag(A)}</div>
            <span class="vs">VS</span>
            <div class="br-next-p right">${trainerTag(B)}${trainerAvatar(B, 'lg')}</div>
          </div>
          ${countdown(s, 'Présentation des équipes dans')}
          ${ctx.isHost() ? '<button class="btn yellow" id="brSkip">C\'EST PARTI</button>' : ''}
        </div>` : ''}
    </div>`;

  const skip = stage.querySelector('#brSkip');
  if (skip) skip.onclick = () => ctx.actions.skip();
}

// ===========================================================================
// APERÇU DES ÉQUIPES ET CHOIX DU POKÉMON DE TÊTE
// ===========================================================================

function previewCard(dex, idx, oppTeam, { pickable, chosen, suggested, ready }) {
  const b = getPokemonById(dex);
  if (!b) return '';
  return `
    <button class="pv-card ${chosen ? 'chosen' : ''} ${pickable ? 'pickable' : ''}" data-lead="${idx}" ${pickable && !ready ? '' : 'disabled'}
      style="--c1:${TYPES[b.types[0]].color}">
      ${pickable ? `<span class="pv-key">${idx + 1}</span>` : ''}
      ${chosen ? '<span class="pv-lead">EN TÊTE</span>' : suggested && pickable ? '<span class="pv-sugg">CONSEILLÉ</span>' : ''}
      <img class="pv-sprite" src="${spriteUrls(dex).front}" alt="" loading="lazy">
      <div class="pv-info">
        <b>${esc(b.name)}</b>
        <div class="pv-types">${b.types.map((ty) => typeChip(ty)).join('')}</div>
        <div class="pv-vs" title="Efficacité de ses meilleures attaques contre l'équipe d'en face">
          ${oppTeam.map((o) => `<span><img src="${spriteUrls(o).icon}" alt="">${effBadge(bestEff(dex, o))}</span>`).join('')}
        </div>
      </div>
      <div class="pv-spe" title="Vitesse : le plus rapide attaque en premier">VIT <b>${b.stats.spe}</b></div>
    </button>`;
}

export function renderPreview(stage, s, ctx) {
  const t = s.t;
  const m = currentMatch(t);
  if (!m) return;
  const mySide = sideOf(m, ctx.me.id);
  const left = mySide || 'A';
  const right = left === 'A' ? 'B' : 'A';
  const P = { A: getParticipant(t, m.a), B: getParticipant(t, m.b) };
  const team = { A: P.A.team, B: P.B.team };

  const key = `${m.id}:${t.gameNo}`;
  if (ctx.local.leadKey !== key) {
    ctx.local.leadKey = key;
    ctx.local.lead = mySide ? chooseLead(team[mySide], team[mySide === 'A' ? 'B' : 'A']) : null;
    if (mySide) ctx.actions.lead(ctx.local.lead);
  }
  const suggested = mySide ? chooseLead(team[mySide], team[mySide === 'A' ? 'B' : 'A']) : -1;
  const iAmReady = mySide ? t.ready[mySide] : false;

  const column = (side) => {
    const isMe = side === mySide;
    const p = P[side];
    const ready = t.ready[side];
    return `
      <section class="pv-col ${isMe ? 'me' : ''}" style="--pc:${p.color}">
        <div class="pv-col-head">
          ${trainerAvatar(p, 'md')}
          ${trainerTag(p)}
          <span class="pv-state ${ready ? 'ready' : ''}">${ready ? 'PRÊT' : isMe ? 'À TOI' : 'réfléchit…'}</span>
        </div>
        <div class="pv-team">
          ${team[side].map((dex, i) => previewCard(dex, i, team[side === 'A' ? 'B' : 'A'], {
            pickable: isMe,
            chosen: isMe && ctx.local.lead === i,
            suggested: i === suggested,
            ready: iAmReady,
          })).join('')}
        </div>
      </section>`;
  };

  const series = m.bestOf > 1
    ? `<div class="pv-series">${seriesPips(m, left, P[left].color)}<span>MANCHE ${t.gameNo}</span>${seriesPips(m, right, P[right].color)}</div>`
    : '';

  const leadName = mySide && ctx.local.lead != null ? getPokemonById(team[mySide][ctx.local.lead])?.name : '';
  stage.innerHTML = `
    <div class="tz-screen preview deal">
      <header class="tz-head">
        <div>
          <div class="tz-kicker">${esc(m.name.toUpperCase())}${m.bestOf > 1 ? ' · 2 MANCHES GAGNANTES' : ''}</div>
          <h2 class="tz-title">${mySide ? 'Choisis ton Pokémon de tête' : 'Présentation des équipes'}</h2>
          <p class="tz-sub">${mySide
            ? 'Il sera envoyé en premier. Ton adversaire ne le découvrira qu\'au lancement du combat.'
            : 'Les dresseurs choisissent en secret le Pokémon qu\'ils enverront en premier.'}</p>
        </div>
        ${countdown(s, 'Combat dans')}
      </header>
      ${deadlineBar(s, 25)}
      ${series}
      <div class="pv-board">
        ${column(left)}
        <div class="pv-versus">VS</div>
        ${column(right)}
      </div>
      <footer class="pv-foot">
        ${mySide
          ? (iAmReady
            ? `<div class="pv-wait">✓ ${esc(leadName)} est prêt. ${t.ready[mySide === 'A' ? 'B' : 'A'] ? 'Lancement…' : 'En attente de l\'adversaire…'}</div>`
            : `<button class="btn big yellow" id="pvGo">PRÊT · ENVOYER ${esc((leadName || '').toUpperCase())} <small>Entrée</small></button>
               <p class="pv-hint">Touches 1 à 3 pour changer de tête · les ×2 montrent qui frappe fort contre qui</p>`)
          : '<div class="pv-wait">Le combat commence dès que les deux dresseurs sont prêts.</div>'}
      </footer>
    </div>`;

  if (!mySide || iAmReady) return;
  for (const btn of stage.querySelectorAll('[data-lead]')) {
    btn.onclick = () => ctx.pickLead(Number(btn.dataset.lead));
  }
  stage.querySelector('#pvGo').onclick = () => ctx.sendReady();
}

function seriesPips(m, side, color) {
  const need = Math.ceil(m.bestOf / 2);
  const won = side === 'A' ? m.scoreA : m.scoreB;
  return `<span class="pips" style="--pc:${color}">${Array.from({ length: need }, (_, i) => `<i class="${i < won ? 'on' : ''}"></i>`).join('')}</span>`;
}

// ===========================================================================
// RÉSUMÉ DE MANCHE
// ===========================================================================

export function renderSummary(stage, s, ctx) {
  const t = s.t;
  const m = currentMatch(t);
  const last = t.last;
  if (!m || !last) return;
  const mySide = sideOf(m, ctx.me.id);
  const P = { A: getParticipant(t, m.a), B: getParticipant(t, m.b) };
  const game = last.forfeit ? null : m.games[m.games.length - 1];
  const w = last.winner;
  const winner = w ? P[w] : null;

  let headline;
  let tone;
  if (!w) { headline = 'Manche nulle'; tone = 'draw'; }
  else if (mySide) { headline = mySide === w ? 'Victoire !' : 'Défaite'; tone = mySide === w ? 'win' : 'loss'; }
  else { headline = `${esc(winner.name)} l'emporte`; tone = 'neutral'; }

  let sub;
  if (last.forfeit) sub = `${esc(P[w === 'A' ? 'B' : 'A'].name)} a quitté le tournoi : victoire par forfait.`;
  else if (!w) sub = 'Les deux derniers Pokémon sont tombés en même temps. La manche se rejoue.';
  else if (m.bestOf > 1 && m.status !== 'done') sub = `${esc(winner.name)} prend l'avantage dans la ${esc(m.name.toLowerCase())}.`;
  else if (m.bestOf > 1) sub = `${esc(winner.name)} remporte la ${esc(m.name.toLowerCase())} ${Math.max(m.scoreA, m.scoreB)} manches à ${Math.min(m.scoreA, m.scoreB)}.`;
  else sub = `${esc(winner.name)} se qualifie${game ? ` en ${game.turns} tour${game.turns > 1 ? 's' : ''}` : ''}.`;
  if (mySide && w && mySide !== w && m.status === 'done') sub += ' Tu es éliminé : reste pour suivre la suite du tournoi.';

  // Pokémon du match : celui qui a mis le plus de K.O.
  let star = null;
  if (game) {
    for (const side of ['A', 'B']) {
      for (const [dex, k] of Object.entries(game.koBy[side] || {})) {
        if (!star || k > star.k) star = { side, dex: Number(dex), k };
      }
    }
  }

  const teamCol = (side) => {
    const team = game ? game[side === 'A' ? 'teamA' : 'teamB'] : P[side].team.map((dex) => ({ dex, hp: 1, maxHp: 1, fainted: false }));
    const ko = game ? game.koBy[side] || {} : {};
    return `
      <section class="sm-col ${w === side ? 'won' : ''}" style="--pc:${P[side].color}">
        <div class="sm-col-head">${trainerAvatar(P[side], 'sm')}${trainerTag(P[side])}${m.bestOf > 1 ? `<b class="sm-score">${side === 'A' ? m.scoreA : m.scoreB}</b>` : ''}</div>
        ${team.map((p) => {
          const b = getPokemonById(p.dex);
          const pct = Math.max(0, Math.round((p.hp / p.maxHp) * 100));
          return `
            <div class="sm-mon ${p.fainted ? 'ko' : ''}">
              <img src="${spriteUrls(p.dex).icon}" alt="">
              <div class="sm-mon-main">
                <b>${esc(b ? b.name : '?')}</b>
                <div class="sm-hp"><i style="width:${pct}%;background:${pct > 50 ? '#22c55e' : pct > 20 ? '#eab308' : '#ef4444'}"></i></div>
              </div>
              <span class="sm-ko">${p.fainted ? 'K.O.' : game ? `${pct}%` : ''}</span>
              ${ko[p.dex] ? `<span class="sm-kills" title="K.O. infligés">${'★'.repeat(ko[p.dex])}</span>` : ''}
            </div>`;
        }).join('')}
      </section>`;
  };

  let nextLabel;
  if (m.status !== 'done') nextLabel = `Manche ${m.games.filter((g) => g.winner).length + 1} dans`;
  else if (t.champion != null) nextLabel = 'Remise du trophée dans';
  else nextLabel = 'Retour au tableau dans';

  const iCont = mySide && s.cont && s.cont[mySide];
  stage.innerHTML = `
    <div class="tz-screen summary tone-${tone} deal">
      <div class="sm-banner">
        ${winner ? trainerAvatar(winner, 'xl') : ''}
        <div class="tz-kicker">${esc(m.name.toUpperCase())}${m.bestOf > 1 ? ` · MANCHE ${last.game}` : ''}</div>
        <h2 class="sm-headline">${headline}</h2>
        <p class="tz-sub">${sub}</p>
        ${m.bestOf > 1 ? (() => {
          const [l, r] = mySide === 'B' ? ['B', 'A'] : ['A', 'B'];
          const sc = (x) => (x === 'A' ? m.scoreA : m.scoreB);
          return `<div class="pv-series">${seriesPips(m, l, P[l].color)}<span>${sc(l)} - ${sc(r)}</span>${seriesPips(m, r, P[r].color)}</div>`;
        })() : ''}
      </div>
      <div class="sm-board">${mySide === 'B' ? teamCol('B') + teamCol('A') : teamCol('A') + teamCol('B')}</div>
      ${star ? `
        <div class="sm-star">
          <img src="${spriteUrls(star.dex).artwork}" alt="">
          <div><span>POKÉMON DU MATCH</span><b>${esc(getPokemonById(star.dex)?.name)}</b><em>${star.k} K.O. pour ${esc(P[star.side].name)}</em></div>
        </div>` : ''}
      <footer class="sm-foot">
        ${countdown(s, nextLabel)}
        ${mySide ? `<button class="btn yellow" id="smGo" ${iCont ? 'disabled' : ''}>${iCont ? 'EN ATTENTE…' : 'CONTINUER'}</button>` : ''}
      </footer>
    </div>`;

  const go = stage.querySelector('#smGo');
  if (go && !iCont) go.onclick = () => { go.disabled = true; ctx.actions.cont(); };
}

// ===========================================================================
// PODIUM
// ===========================================================================

export function renderPodium(stage, s, ctx) {
  const t = s.t;
  const rows = (t.standings || []).map((st) => ({ ...st, p: getParticipant(t, st.id) })).filter((r) => r.p);
  const first = rows.find((r) => r.place === 1);
  const second = rows.find((r) => r.place === 2);
  const thirds = rows.filter((r) => r.place === 3);
  const mvp = tournamentMvp(t);
  const mvpOwner = mvp ? getParticipant(t, mvp.pid) : null;
  const iWon = first && same(first.id, ctx.me.id);

  const step = (r, cls, label) => r ? `
    <div class="pd-step ${cls}" style="--pc:${r.p.color}">
      <div class="pd-who">
        ${trainerAvatar(r.p, cls === 'first' ? 'xl' : 'lg')}
        ${trainerTag(r.p)}
        <div class="pd-team">${r.p.team.map((dex) => `<img src="${spriteUrls(dex).icon}" alt="">`).join('')}</div>
      </div>
      <div class="pd-block"><span>${label}</span></div>
    </div>` : `<div class="pd-step ${cls} empty"><div class="pd-block"><span>${label}</span></div></div>`;

  stage.innerHTML = `
    <div class="tz-screen podium deal">
      <canvas class="pd-confetti" id="pdConfetti"></canvas>
      <div class="pd-head">
        <div class="pd-trophy">${TROPHY_SVG}</div>
        <div class="tz-kicker">FIN DU TOURNOI</div>
        <h1 class="pd-title">${iWon ? 'Tu es champion !' : first ? `${esc(first.p.name)} est champion !` : 'Tournoi terminé'}</h1>
      </div>
      <div class="pd-champ">
        ${first ? first.p.team.map((dex) => `
          <div class="pd-mon">
            <img src="${spriteUrls(dex).artwork}" alt="">
            <b>${esc(getPokemonById(dex)?.name)}</b>
          </div>`).join('') : ''}
      </div>
      <div class="pd-steps">
        ${step(second, 'second', '2')}
        ${step(first, 'first', '1')}
        ${thirds.length > 1
          ? `<div class="pd-thirds">${thirds.map((r) => step(r, 'third', '3')).join('')}</div>`
          : step(thirds[0], 'third', '3')}
      </div>
      <div class="pd-bottom">
        <table class="pd-table">
          <thead><tr><th>#</th><th>Dresseur</th><th>Matchs</th><th>Manches</th><th>K.O.</th><th>Pertes</th></tr></thead>
          <tbody>
            ${rows.map((r) => `
              <tr class="${same(r.id, ctx.me.id) ? 'me' : ''}">
                <td>${r.place}</td><td>${trainerTag(r.p)}</td>
                <td>${r.p.stats.matchW}</td><td>${r.p.stats.gameW} - ${r.p.stats.gameL}</td>
                <td>${r.p.stats.ko}</td><td>${r.p.stats.lost}</td>
              </tr>`).join('')}
          </tbody>
        </table>
        ${mvp && mvp.ko > 0 ? `
          <div class="sm-star pd-mvp">
            <img src="${spriteUrls(mvp.dex).artwork}" alt="">
            <div><span>POKÉMON DU TOURNOI</span><b>${esc(getPokemonById(mvp.dex)?.name)}</b><em>${mvp.ko} K.O. en ${mvp.games} manche${mvp.games > 1 ? 's' : ''} · ${esc(mvpOwner ? mvpOwner.name : '')}</em></div>
          </div>` : ''}
      </div>
      <div class="pd-actions">
        ${ctx.isHost() ? '<button class="btn big yellow" id="pdAgain">NOUVEAU TOURNOI</button>' : '<span class="pd-wait">L\'hôte peut lancer une revanche</span>'}
        <button class="btn big ghost" id="pdLobby">RETOUR AU SALON</button>
      </div>
    </div>`;

  launchConfetti(stage.querySelector('#pdConfetti'), first ? first.p.color : '#ffcb05');
  const again = stage.querySelector('#pdAgain');
  if (again) again.onclick = () => ctx.actions.restart();
  stage.querySelector('#pdLobby').onclick = () => ctx.exit();
}

// ===========================================================================
// Décor
// ===========================================================================

const TROPHY_SVG = `<svg class="tz-trophy" viewBox="0 0 64 64" aria-hidden="true">
  <defs>
    <linearGradient id="tzGold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff3b0"/><stop offset=".45" stop-color="#ffcb05"/><stop offset="1" stop-color="#b7791f"/></linearGradient>
  </defs>
  <path d="M18 8h28v10c0 10-6 17-14 17S18 28 18 18z" fill="url(#tzGold)" stroke="#000" stroke-width="2.5"/>
  <path d="M18 12H9c0 9 4 14 11 15M46 12h9c0 9-4 14-11 15" fill="none" stroke="#000" stroke-width="2.5"/>
  <path d="M18 12H9c0 9 4 14 11 15M46 12h9c0 9-4 14-11 15" fill="none" stroke="#ffcb05" stroke-width="1.2"/>
  <path d="M28 35h8l2 10H26z" fill="url(#tzGold)" stroke="#000" stroke-width="2.5"/>
  <rect x="19" y="45" width="26" height="9" rx="2" fill="#2a3a52" stroke="#000" stroke-width="2.5"/>
  <circle cx="32" cy="19" r="5" fill="#fff" stroke="#000" stroke-width="2"/><path d="M27 19h10" stroke="#000" stroke-width="2"/>
  <path d="M23 12c1 6 3 10 6 12" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".6" fill="none"/>
</svg>`;

/** Pluie de confettis aux couleurs du champion (s'arrête d'elle-même). */
function launchConfetti(canvas, color) {
  if (!canvas || !canvas.getContext || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const ctx = canvas.getContext('2d');
  const W = (canvas.width = canvas.offsetWidth * devicePixelRatio);
  const H = (canvas.height = canvas.offsetHeight * devicePixelRatio);
  const colors = [color, '#ffcb05', '#ffffff', '#2a75bb', '#ee1515'];
  const parts = Array.from({ length: 160 }, () => ({
    x: Math.random() * W, y: -Math.random() * H * 0.8,
    w: (6 + Math.random() * 6) * devicePixelRatio, h: (3 + Math.random() * 4) * devicePixelRatio,
    vy: (1.5 + Math.random() * 2.5) * devicePixelRatio, vx: (Math.random() - 0.5) * 1.6 * devicePixelRatio,
    r: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const t0 = performance.now();
  const frame = (now) => {
    if (!canvas.isConnected) return;
    const age = now - t0;
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = age > 5000 ? Math.max(0, 1 - (age - 5000) / 1500) : 1;
    for (const p of parts) {
      p.x += p.vx + Math.sin((now + p.y) / 400) * 0.6; p.y += p.vy; p.r += p.vr;
      if (p.y > H && age < 3500) { p.y = -10; p.x = Math.random() * W; }
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, Math.abs(Math.cos(p.r * 2)) * p.h + 1);
      ctx.restore();
    }
    if (age < 6500) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
