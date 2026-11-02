// pokemon/view/doubles.js
// Écran de combat en double (format VGC) : 4 Pokémon sur le terrain, une action par Pokémon puis sa cible,
// remplacements par emplacement, et déroulé du tour événement par événement (même rythme que l'hôte : timing.js).
// Emplacements : A et C pour le dresseur A, B et D pour le dresseur B. Mes Pokémon sont en bas, de dos.

import { MOVES } from '../engine/moves.js';
import { TYPES } from '../engine/types.js';
import { spriteUrls } from '../engine/data.js';
import { ITEMS, CHOICE } from '../engine/items.js';
import { ABILITIES } from '../engine/abilities.js';
import { canMega, sidesOf, teamKey, getActivePokemon, activeIdxOf, foeSides } from '../engine/battle.js';
import { eventMs, damageText } from '../engine/timing.js';
import { describeMove, tipAttr, tipText } from './tips.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const STATUS = { burn: 'BRÛ', paralysis: 'PAR', poison: 'PSN', toxic: 'PSN+', sleep: 'SOM', freeze: 'GEL' };
const STAT = { atk: 'ATQ', def: 'DÉF', spa: 'A.SP', spd: 'D.SP', spe: 'VIT' };
const WEATHER = { rain: '🌧️ Pluie', sun: '☀️ Soleil', sand: '🌪️ Sable', wind: '🌬️ Vents', hail: '🌨️ Grêle' };
const sleep = (ms) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const hpCls = (pct) => (pct > 50 ? 'hp-green' : pct > 20 ? 'hp-yellow' : 'hp-red');

/** L'attaque se lance-t-elle sans choisir de cible ? (attaque de zone, sur soi, Abri, soin) */
function noTarget(m) {
  return !!(m.spread || (m.cat === 'status' && m.effect && (m.effect.target === 'self' || m.effect.type === 'heal' || m.effect.type === 'protect')));
}

export function createDoublesView({ stage, me, submitAction, sfx, now }) {
  let state = null;
  let resolving = false;
  const queue = [];
  let lastSeq = 0;
  let gen = 0;
  // choix du tour en cours
  let plan = {};          // emplacement -> action
  let step = 0;           // quel Pokémon choisit (0 puis 1)
  let pending = null;     // attaque qui attend sa cible : { moveId }
  let megaSlot = null;    // emplacement qui méga-évoluera
  let tab = 'moves';
  let turnKey = null;

  const $ = (sel) => stage.querySelector(sel);
  const mySideOf = (b) => (String(b.trainerA.id) === String(me.id) ? 'A' : String(b.trainerB.id) === String(me.id) ? 'B' : null);
  const myTeam = (b) => mySideOf(b) || 'A';
  const slotsOf = (b, tk) => sidesOf(b).filter((s) => teamKey(s) === tk);

  // --- Le terrain ---------------------------------------------------------------------------
  function slotHtml(b, side, mine) {
    const p = getActivePokemon(b, side);
    if (!p) return `<div class="vgc-slot empty" data-side="${side}"></div>`;
    const pct = Math.max(0, Math.min(100, Math.round((p.hp / p.maxHp) * 100)));
    const ab = ABILITIES[p.ability], it = ITEMS[p.item];
    const stages = Object.entries(p.statStages || {}).filter(([, v]) => v).map(([k, v]) => `<i class="${v > 0 ? 'up' : 'down'}">${STAT[k]} ${v > 0 ? '+' : ''}${v}</i>`).join('');
    const sprite = mine ? spriteUrls(p.spriteId || p.id).back : spriteUrls(p.spriteId || p.id).front;
    return `
      <div class="vgc-slot ${mine ? 'mine' : 'foe'} ${p.fainted ? 'fainted' : ''}" data-side="${side}">
        <div class="vgc-hud">
          <div class="vgc-hud-top"><b class="vgc-name">${esc(p.name)}</b><span class="vgc-lv">N.${p.level || 50}</span>
            <span class="vgc-st">${p.status ? `<span class="status-badge status-${p.status}">${STATUS[p.status]}</span>` : ''}</span></div>
          <div class="vgc-hp"><span class="hp-fill ${hpCls(pct)}" style="width:${pct}%"></span></div>
          <div class="vgc-hud-bot">
            <span class="vgc-hpnum">${mine ? `${p.hp}/${p.maxHp}` : `${pct} %`}</span>
            ${ab ? `<span class="vgc-ab" ${tipAttr(tipText(ab.name, ab.desc))}>${esc(ab.name)}</span>` : ''}
            ${it ? `<span class="vgc-it" ${tipAttr(tipText(it.name, it.desc + (p.itemUsed ? ' (déjà utilisé)' : '')))}><img src="${it.icon}" alt=""></span>` : ''}
          </div>
          <div class="vgc-stages">${stages}</div>
        </div>
        <div class="vgc-pop"></div>
        <img class="vgc-sprite" src="${sprite}" alt="${esc(p.name)}">
      </div>`;
  }

  function teamBalls(team) {
    return `<span class="vgc-balls">${team.map((p) => `<i class="${p.fainted ? 'ko' : ''}"></i>`).join('')}</span>`;
  }

  function arenaHtml(s) {
    const b = s.battle, mt = myTeam(b), ft = mt === 'A' ? 'B' : 'A';
    const trM = mt === 'A' ? b.trainerA : b.trainerB, trF = mt === 'A' ? b.trainerB : b.trainerA;
    return `
      <div class="vgc-arena ${s.isFinal ? 'final' : ''}">
        <div class="vgc-field">
          <div class="vgc-weather" id="vgcWeather">${b.weather && WEATHER[b.weather.type] ? `<span class="bw-weather w-${b.weather.type}">${WEATHER[b.weather.type]}${b.weather.type !== 'wind' ? ` · ${b.weather.turns} t.` : ''}</span>` : ''}</div>
          <div class="vgc-trainer top"><b>${esc(trF.name)}</b>${teamBalls(ft === 'A' ? b.teamA : b.teamB)}</div>
          <div class="vgc-row top">${slotsOf(b, ft).map((sd) => slotHtml(b, sd, false)).join('')}</div>
          <div class="vgc-row bottom">${slotsOf(b, mt).map((sd) => slotHtml(b, sd, true)).join('')}</div>
          <div class="vgc-trainer bottom"><b>${esc(trM.name)}</b>${teamBalls(mt === 'A' ? b.teamA : b.teamB)}</div>
        </div>
        <div class="vgc-msg" id="vgcMsg"></div>
        <div class="vgc-dash" id="vgcDash"></div>
      </div>`;
  }

  // --- Commandes ------------------------------------------------------------------------------
  function timerHtml(s) {
    const leftMs = s.turnEndsAt ? Math.max(0, s.turnEndsAt - now()) : 0;
    const w = s.turnEndsAt ? Math.max(0, Math.min(100, (leftMs / (s.timerSecs * 1000)) * 100)) : 100;
    return `<div class="dash-timer"><div class="dt-fill" id="timerFill" style="width:${w}%"></div><span class="dt-text" id="timerText">${s.turnEndsAt ? `${Math.ceil(leftMs / 1000)} s` : '—'}</span></div>`;
  }

  function benchHtml(b, tk, exclude, attr) {
    const team = tk === 'A' ? b.teamA : b.teamB, on = activeIdxOf(b, tk);
    return `<div class="vgc-bench">${team.map((p, i) => {
      const off = p.fainted || on.includes(i) || exclude.includes(i);
      const pct = Math.round((p.hp / p.maxHp) * 100);
      return `<button class="vgc-mon" ${attr}="${i}" ${off ? 'disabled' : ''}>
        <img src="${spriteUrls(p.spriteId || p.id).icon}" alt=""><b>${esc(p.name)}</b>
        <span class="vgc-mini"><span class="hp-fill ${hpCls(pct)}" style="width:${p.fainted ? 0 : pct}%"></span></span>
        <small>${p.fainted ? 'K.O.' : on.includes(i) ? 'Au combat' : `${p.hp}/${p.maxHp}`}</small></button>`;
    }).join('')}</div>`;
  }

  function moveBlocked(p, moveId) {
    const pp = p.ppMap && p.ppMap[moveId] !== undefined ? p.ppMap[moveId] : 1;
    if (pp <= 0) return true;
    if (p.disabled && p.disabled.move === moveId && p.disabled.turns > 0) return true;
    const lk = p.rampage || p.charging;
    if (lk && lk.move !== moveId) return true;
    if (CHOICE.has(p.item) && p.choiceLock && p.choiceLock !== moveId && p.moves.includes(p.choiceLock) && (p.ppMap[p.choiceLock] ?? 1) > 0) return true;
    return false;
  }

  function renderDash(s) {
    const dash = $('#vgcDash');
    if (!dash) return;
    const b = s.battle, my = mySideOf(b);
    if (!my) { dash.innerHTML = '<div class="vgc-wait"><span class="bw-live">EN DIRECT</span> Les dresseurs choisissent leurs actions…</div>'; return; }
    const submitted = my === 'A' ? s.submittedA : s.submittedB;

    // remplacements (K.O., Demi-Tour)
    if (b.phase === 'switch_forced') {
      const mine = (b.need || []).filter((x) => teamKey(x) === my);
      if (!mine.length) { dash.innerHTML = `${timerHtml(s)}<div class="vgc-wait"><span class="bw-foe-ball"></span> L'adversaire choisit son remplaçant…</div>`; return; }
      const slot = mine[0], out = getActivePokemon(b, slot);
      dash.innerHTML = `${timerHtml(s)}
        <div class="vgc-ask"><b>${out && !out.fainted ? `${esc(out.name)} revient` : `${esc(out ? out.name : 'Ton Pokémon')} est K.O.`}</b> : qui prend sa place ?</div>
        ${benchHtml(b, my, [], 'data-repl')}`;
      for (const btn of dash.querySelectorAll('[data-repl]')) btn.onclick = () => { sfx.play('switch'); submitAction({ type: 'switch', targetIndex: Number(btn.dataset.repl), slot }); dash.innerHTML = `${timerHtml(s)}<div class="vgc-wait">Remplaçant envoyé…</div>`; };
      return;
    }
    if (b.phase !== 'choose') { dash.innerHTML = ''; return; }
    if (submitted) { dash.innerHTML = `${timerHtml(s)}<div class="vgc-wait">✓ Actions envoyées. En attente de l'adversaire…</div>`; return; }
    if (!s.turnEndsAt) { dash.innerHTML = `${timerHtml(s)}<div class="vgc-wait">Les Pokémon entrent sur le terrain…</div>`; return; }

    // nouveau tour : on repart du premier Pokémon
    const key = `${b.turn}:${sidesOf(b).map((x) => b['active' + x]).join(',')}`;
    if (key !== turnKey) { turnKey = key; plan = {}; step = 0; pending = null; megaSlot = null; tab = 'moves'; }
    const slots = slotsOf(b, my).filter((x) => { const p = getActivePokemon(b, x); return p && !p.fainted; });
    if (step >= slots.length) { dash.innerHTML = `${timerHtml(s)}<div class="vgc-wait">Envoi…</div>`; return; }
    const slot = slots[step], p = getActivePokemon(b, slot);
    const foes = foeSides(b, slot).filter((x) => { const f = getActivePokemon(b, x); return f && !f.fainted; });
    const head = `<div class="vgc-ask">${slots.length > 1 ? `<span class="vgc-step">${step + 1}/${slots.length}</span>` : ''}
      ${pending ? `Qui doit subir <b>${esc(MOVES[pending.moveId].name)}</b> ?` : `Que doit faire <b>${esc(p.name)}</b> ?`}
      ${step > 0 || pending ? '<button class="vgc-back" id="vgcBack">← Retour</button>' : ''}</div>`;

    let body = '';
    if (pending) {
      body = `<div class="vgc-targets">${foes.map((x) => { const f = getActivePokemon(b, x); return `<button class="vgc-target" data-target="${x}"><img src="${spriteUrls(f.spriteId || f.id).icon}" alt=""><b>${esc(f.name)}</b><small>${Math.round((f.hp / f.maxHp) * 100)} %</small></button>`; }).join('')}</div>`;
    } else if (tab === 'moves') {
      const otherMega = megaSlot && megaSlot !== slot;
      const megaBtn = canMega(b, slot, p) && !otherMega ? `<button class="bw-mega ${megaSlot === slot ? 'on' : ''}" id="vgcMega" type="button"><img src="${ITEMS[p.item].icon}" alt=""><span>MÉGA-ÉVOLUTION</span><small>${megaSlot === slot ? 'activée' : 'une seule par combat'}</small></button>` : '';
      body = `${megaBtn}<div class="vgc-moves">${p.moves.map((moveId) => {
        const m = MOVES[moveId]; if (!m) return '';
        const max = m.pp || 15, cur = p.ppMap && p.ppMap[moveId] !== undefined ? p.ppMap[moveId] : max;
        const zone = m.spread === 'foes' ? 'Les 2 adversaires' : m.spread === 'all' ? 'Tous les autres' : '';
        return `<button class="bw-move vgc-move" data-move="${moveId}" style="--tc:${TYPES[m.type].color}" ${moveBlocked(p, moveId) ? 'disabled' : ''} ${tipAttr(describeMove(m) + (zone ? `<span>Combat en double : touche ${zone.toLowerCase()} (dégâts ×0,75).</span>` : ''))}>
          <span class="bw-move-name">${esc(m.name)}</span>
          <span class="bw-move-meta"><span class="tz-type" style="--tc:${TYPES[m.type].color}">${TYPES[m.type].name}</span>${zone ? `<span class="vgc-zone">${zone}</span>` : ''}<span class="bw-pp">PP ${cur}/${max}</span></span>
        </button>`;
      }).join('')}</div>`;
    } else {
      const taken = Object.values(plan).filter((a) => a && a.type === 'switch').map((a) => a.targetIndex);
      body = benchHtml(b, my, taken, 'data-sw');
    }
    const trapped = !!(p.rampage || p.charging) || foes.some((x) => getActivePokemon(b, x).ability === 'shadow-tag') && !p.types.includes('ghost');
    dash.innerHTML = `${timerHtml(s)}${head}
      ${pending ? '' : `<div class="vgc-tabs"><button class="${tab === 'moves' ? 'on' : ''}" id="vgcTabM">Attaque</button><button class="${tab === 'switch' ? 'on' : ''}" id="vgcTabS" ${trapped ? 'disabled' : ''}>Pokémon</button></div>`}
      ${body}`;

    const choose = (act) => {
      plan[slot] = megaSlot === slot && act.type === 'move' ? { ...act, mega: true } : act;
      pending = null; tab = 'moves'; step++;
      if (step >= slots.length) {
        submitAction({ type: 'pair', acts: { ...plan } });
        sfx.play('hit');
      } else sfx.play('switch');
      renderDash(state);
    };
    const back = $('#vgcBack');
    if (back) back.onclick = () => { if (pending) pending = null; else { step = Math.max(0, step - 1); delete plan[slots[step]]; if (megaSlot === slots[step]) megaSlot = null; } renderDash(state); };
    const tm = $('#vgcTabM'), ts = $('#vgcTabS');
    if (tm) tm.onclick = () => { tab = 'moves'; renderDash(state); };
    if (ts) ts.onclick = () => { tab = 'switch'; renderDash(state); };
    const mg = $('#vgcMega');
    if (mg) mg.onclick = () => { megaSlot = megaSlot === slot ? null : slot; sfx.play(megaSlot ? 'levelup' : 'switch'); renderDash(state); };
    for (const btn of dash.querySelectorAll('[data-move]')) btn.onclick = () => {
      const moveId = btn.dataset.move, m = MOVES[moveId];
      if (noTarget(m) || foes.length <= 1) choose({ type: 'move', moveId, target: foes[0] || null });
      else { pending = { moveId }; renderDash(state); }
    };
    for (const btn of dash.querySelectorAll('[data-target]')) btn.onclick = () => choose({ type: 'move', moveId: pending.moveId, target: btn.dataset.target });
    for (const btn of dash.querySelectorAll('[data-sw]')) btn.onclick = () => choose({ type: 'switch', targetIndex: Number(btn.dataset.sw) });
  }

  function render(s) {
    stage.innerHTML = arenaHtml(s);
    const msg = $('#vgcMsg');
    if (msg) {
      const b = s.battle;
      msg.textContent = b.phase === 'switch_forced' ? 'Remplacement…' : b.phase === 'choose' ? `Tour ${b.turn}` : '';
    }
    renderDash(s);
  }

  // --- Déroulé du tour ------------------------------------------------------------------------
  const slotEl = (side) => stage.querySelector(`.vgc-slot[data-side="${side}"]`);
  function setHp(side, hp, maxHp) {
    const el = slotEl(side); if (!el) return;
    const pct = Math.max(0, Math.min(100, Math.round((hp / maxHp) * 100)));
    const fill = el.querySelector('.vgc-hp .hp-fill');
    if (fill) { fill.style.width = `${pct}%`; fill.className = `hp-fill ${hpCls(pct)}`; }
    const num = el.querySelector('.vgc-hpnum');
    if (num) num.textContent = el.classList.contains('mine') ? `${hp}/${maxHp}` : `${pct} %`;
  }
  function pop(side, txt, cls = '') {
    const el = slotEl(side); if (!el) return;
    const p = el.querySelector('.vgc-pop'); if (!p) return;
    const d = document.createElement('span'); d.className = `vgc-popnum ${cls}`; d.textContent = txt;
    p.appendChild(d); setTimeout(() => d.remove(), 1200);
  }
  function flash(side, cls, ms = 450) {
    const el = slotEl(side); if (!el) return;
    el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), ms);
  }

  async function play(s) {
    resolving = true;
    const g = gen;
    const b = s.battle, mt = myTeam(b);
    if (!stage.querySelector('.vgc-arena')) render(s);
    const dash = $('#vgcDash'); if (dash) dash.innerHTML = '<div class="vgc-wait">Le tour se déroule…</div>';
    const msg = $('#vgcMsg');
    for (const ev of s.events) {
      if (g !== gen) return;
      const t0 = performance.now();
      const text = ev.type === 'damage' ? damageText(ev) : (ev.msg || ev.text || '');
      if (text && msg) msg.textContent = text;
      if (ev.type === 'switch') {
        const el = slotEl(ev.side);
        if (el) {
          el.classList.remove('fainted', 'empty');
          const mine = teamKey(ev.side) === mt;
          const sp = el.querySelector('.vgc-sprite');
          if (sp) sp.src = mine ? spriteUrls(ev.spriteId || ev.pokemonId).back : spriteUrls(ev.spriteId || ev.pokemonId).front;
          const nm = el.querySelector('.vgc-name'); if (nm) nm.textContent = ev.name;
          const st = el.querySelector('.vgc-st'); if (st) st.innerHTML = ev.status ? `<span class="status-badge status-${ev.status}">${STATUS[ev.status]}</span>` : '';
          const sg = el.querySelector('.vgc-stages'); if (sg) sg.innerHTML = '';
          setHp(ev.side, ev.hp, ev.maxHp);
          flash(ev.side, 'enter', 600);
        }
        sfx.play('switch');
        if (ev.pokemonId) sfx.playCry(ev.pokemonId);
      } else if (ev.type === 'attack_start') {
        flash(ev.side, 'attack', 500);
        sfx.play(ev.moveCat === 'special' ? 'beam' : ev.moveCat === 'physical' ? 'hit' : 'item');
      } else if (ev.type === 'damage') {
        if (ev.damage > 0) {
          sfx.playHit(ev.mult || 1);
          flash(ev.defSide, 'hurt', 500);
          pop(ev.defSide, `-${ev.damage}${ev.crit ? ' !' : ''}`, ev.crit ? 'crit' : ev.mult >= 2 ? 'super' : '');
          setHp(ev.defSide, ev.defHp, ev.defMaxHp);
        }
      } else if (ev.type === 'heal') {
        sfx.play('heal'); pop(ev.side, `+${ev.amount}`, 'heal'); setHp(ev.side, ev.hp, ev.maxHp);
      } else if (ev.type === 'recoil' || ev.type === 'status_damage') {
        flash(ev.side, 'hurt', 400); pop(ev.side, `-${ev.damage}`); setHp(ev.side, ev.hp, ev.maxHp);
      } else if (ev.type === 'status_applied') {
        const el = slotEl(ev.side), st = el && el.querySelector('.vgc-st');
        if (st) st.innerHTML = `<span class="status-badge status-${ev.status}">${STATUS[ev.status] || ''}</span>`;
      } else if (ev.type === 'status_cured') {
        const el = slotEl(ev.side), st = el && el.querySelector('.vgc-st'); if (st) st.innerHTML = '';
      } else if (ev.type === 'stat_change') {
        pop(ev.side, `${STAT[ev.stat] || ''} ${ev.val > 0 ? '▲' : '▼'}`, ev.val > 0 ? 'up' : 'down');
      } else if (ev.type === 'faint') {
        const el = slotEl(ev.side); if (el) el.classList.add('fainted');
        sfx.play('faint');
      } else if (ev.type === 'mega') {
        const el = slotEl(ev.side);
        if (el) {
          const sp = el.querySelector('.vgc-sprite');
          if (sp) sp.src = teamKey(ev.side) === mt ? spriteUrls(ev.spriteId).back : spriteUrls(ev.spriteId).front;
          const nm = el.querySelector('.vgc-name'); if (nm) nm.textContent = ev.name;
          flash(ev.side, 'mega', 900);
        }
        sfx.play('levelup');
      } else if (ev.type === 'ability') {
        const a = ABILITIES[ev.ability];
        if (a) pop(ev.side, a.name, 'ability');
        if (ev.weather) { const w = $('#vgcWeather'); if (w) w.innerHTML = `<span class="bw-weather w-${ev.weather}">${WEATHER[ev.weather]}</span>`; }
      } else if (ev.type === 'weather_end') {
        const w = $('#vgcWeather'); if (w) w.innerHTML = '';
      } else if (ev.type === 'item') {
        const it = ITEMS[ev.item]; if (it) pop(ev.side, it.name, 'item');
      }
      await sleep(eventMs(ev) - (performance.now() - t0));
    }
    if (g !== gen) return;
    resolving = false;
    if (queue.length) { play(queue.shift()); return; }
    if (state && state.phase === 'battle' && state.battle && state.battle.doubles) render(state);
  }

  return {
    update(s) {
      state = s;
      if (s.evSeq > lastSeq && s.events && s.events.length) queue.push(s);
      lastSeq = Math.max(lastSeq, s.evSeq || 0);
      if (resolving) return;
      if (queue.length) play(queue.shift());
      else render(s);
    },
    isResolving: () => resolving,
    reset() { gen++; resolving = false; queue.length = 0; plan = {}; step = 0; pending = null; megaSlot = null; turnKey = null; },
    syncSeq(n) { lastSeq = Math.max(lastSeq, n || 0); },
  };
}
