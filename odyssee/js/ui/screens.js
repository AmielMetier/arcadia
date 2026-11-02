// odyssee/js/ui/screens.js — écrans plein cadre : équipe, résumé, sac, Pokédex, carte, carte de dresseur, boutique, PC, options
import { el, esc } from './ui.js';
import { SPECIES } from '../data/species.js';
import { ORIGINALES } from '../data/remplacants.js';
import { MOVES } from '../data/moves.js';
import { ITEMS, itemName, POCKETS, canUseOn } from '../core/items.js';
import { monName, expProgress, STAT_NAMES, levelCap, GYM_CAPS, NATURES, natureName, natureEffect, refreshStats } from '../core/mon.js';
import { BADGES, LEADERS } from '../world/region.js';
import { ASSETS } from '../assets.js';
import { SPRITES } from '../data/sprites.js';
import { T, walkable } from '../world/tiles.js';
import { getAllQuests, setTrackedQuest, getTrackedQuest, QUEST_CATEGORIES } from '../core/questsData.js';

export const TYPE_FR = { fairy: 'Fée', normal: 'Normal', fighting: 'Combat', flying: 'Vol', poison: 'Poison', ground: 'Sol', rock: 'Roche', bug: 'Insecte', ghost: 'Spectre', steel: 'Acier', fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Électrik', psychic: 'Psy', ice: 'Glace', dragon: 'Dragon', dark: 'Ténèbres' };
export const TYPE_COL = { fairy: '#ee99ac', normal: '#a8a878', fighting: '#c03028', flying: '#a890f0', poison: '#a040a0', ground: '#e0c068', rock: '#b8a038', bug: '#a8b820', ghost: '#705898', steel: '#b8b8d0', fire: '#f08030', water: '#6890f0', grass: '#78c850', electric: '#f8d030', psychic: '#f85888', ice: '#98d8d8', dragon: '#7038f8', dark: '#705848' };
export const STATUS_FR = { par: ['PAR', '#e8c020'], slp: ['SOM', '#8890a0'], psn: ['PSN', '#a050b0'], tox: ['PSN', '#7a3090'], brn: ['BRÛ', '#e86030'], frz: ['GEL', '#60c0e8'] };
export const typeTag = (t) => `<span class="type" style="background:${TYPE_COL[t]}">${TYPE_FR[t]}</span>`;
export const hpCol = (r) => (r > 0.5 ? '#48d058' : r > 0.2 ? '#f0c020' : '#f04838');
export function hpBar(m) { const r = m.hp / m.stats[0]; return `<div class="hp"><b>PV</b><i><u style="width:${Math.max(0, r * 100)}%;background:${hpCol(r)}"></u></i></div>`; }
export const statusTag = (m) => (m.hp <= 0 ? '<span class="st" style="background:#c03838">K.O.</span>' : m.status ? `<span class="st" style="background:${STATUS_FR[m.status][1]}">${STATUS_FR[m.status][0]}</span>` : '');
const gender = (m) => (m.gender === 'm' ? '<span class="g m">♂</span>' : m.gender === 'f' ? '<span class="g f">♀</span>' : '');
const iconImg = (m) => `<img class="ico" src="${ASSETS.icon(m.sp)}" alt="" onerror="this.src='${ASSETS.front(m.sp)}';this.classList.add('fallback')">`;

function screen(ui, cls, title) {
  const s = el('div', 'screen ' + cls);
  if (title) s.appendChild(el('div', 'scr-title', esc(title)));
  ui.root.appendChild(s);
  return s;
}

/* ================= ÉQUIPE (Style 5G Noir 2 / Blanc 2) ================= */
/**
 * o.mode : 'menu' | 'pick' | 'battle' ; o.prompt ; o.filter(m) → texte d'interdiction ou null
 * renvoie l'index choisi (-1 si annulé)
 */
export function partyScreen(game, o = {}) {
  const ui = game.ui, party = game.state.party;
  const cap = game.levelCap ? game.levelCap() : levelCap(game.state?.badges);
  const nextGymIdx = (game.state?.badges || []).findIndex((b) => !b);
  const nextLeader = nextGymIdx >= 0 ? LEADERS[nextGymIdx] : null;
  return new Promise((resolve) => {
    const s = screen(ui, 'party-scr');
    const hdr = el('div', 'scr-bar');
    hdr.innerHTML = `
      <div class="scr-bar-left">
        <img class="scr-bar-ico" src="img/hud/team.png" alt="">
        <span class="scr-bar-title">ÉQUIPE POKÉMON</span>
        <span class="scr-bar-sub">${party.length} / 6</span>
      </div>
      <div class="scr-bar-right">
        <span class="scr-cap-badge" title="${nextLeader ? `Prochaine Arène : ${nextLeader.name} (max N.${cap + 1})` : 'Toutes les Arènes vaincues'}">
          NIV. MAX AUTORISÉ : <b>N.${cap}</b>${nextLeader ? ` <i>(${esc(nextLeader.name)})</i>` : ''}
        </span>
      </div>`;
    s.appendChild(hdr);

    const layout = el('div', 'party-b2w2');
    const colLead = el('div', 'pcol-lead');
    const colSubs = el('div', 'pcol-subs');
    layout.append(colLead, colSubs);
    s.appendChild(layout);

    const foot = el('div', 'pfoot');
    const help = el('div', 'box phelp');
    const cancel = el('button', 'pcancel', 'RETOUR ✕');
    cancel.type = 'button';
    foot.append(help, cancel);
    s.appendChild(foot);

    let i = Math.min(o.start || 0, Math.max(0, party.length - 1)), swapFrom = -1, busy = false;

    const triggerSlot = async (idx) => {
      if (busy) return;
      const n = party.length;
      if (idx === n) {
        if (swapFrom >= 0) { swapFrom = -1; ui.sound.sfx('cancel'); draw(); return; }
        ui.sound.sfx('cancel'); close(-1); return;
      }
      if (idx < 0 || idx >= n) return;
      i = idx;
      draw();
      ui.sound.sfx('select');
      if (swapFrom >= 0) {
        if (swapFrom !== i) {
          [party[swapFrom], party[i]] = [party[i], party[swapFrom]];
          game.save?.(true);
        }
        swapFrom = -1;
        draw();
        return;
      }
      const why = o.filter ? o.filter(party[i], i) : null;
      if (o.mode === 'pick') {
        if (why) { ui.sound.sfx('bump'); return; }
        close(i);
        return;
      }
      busy = true;
      const opts = o.mode === 'battle' ? ['Envoyer', 'Résumé', 'Annuler'] : ['Résumé', 'Déplacer', 'Annuler'];
      const r = await ui.list({ items: opts.map((label) => ({ label })), cls: 'psub', cancel: opts.length - 1, parent: s });
      busy = false;
      const pick = opts[r];
      if (pick === 'Résumé') { busy = true; i = await summaryScreen(game, party, i); busy = false; }
      else if (pick === 'Déplacer') swapFrom = i;
      else if (pick === 'Envoyer') { if (why) { ui.sound.sfx('bump'); await ui.say(why); } else { close(i); return; } }
      draw();
    };

    const draw = () => {
      colLead.innerHTML = '';
      colSubs.innerHTML = '';

      party.forEach((m, k) => {
        const isKo = m.hp <= 0;
        const isCapped = m.lvl >= cap;
        const r = Math.max(0, Math.min(1, m.hp / m.stats[0]));
        const rawExp = expProgress(m, cap);
        const expPct = isNaN(rawExp) || rawExp == null ? '0' : Math.max(0, Math.min(100, rawExp * 100)).toFixed(0);
        const why = o.filter ? o.filter(m, k) : null;
        const spTypes = SPECIES[m.sp]?.t || ['normal'];
        const typesHtml = spTypes.map((t) => `<span class="pslot-type" style="--tc:${TYPE_COL[t] || '#888'}">${TYPE_FR[t] || t}</span>`).join('');
        const ballKey = (m.ball || 'poke-ball').replace('-', '_');

        if (k === 0) {
          // LEAD SLOT (Grand format gauche)
          const c = el('div', 'pslot-lead-card' + (isKo ? ' ko' : '') + (k === i ? ' on' : '') + (k === swapFrom ? ' swap' : '') + (why ? ' blocked' : ''));
          c.dataset.idx = 0;
          c.innerHTML = `
            <div class="pslot-lead-top">
              <div class="pslot-lead-badge-row">
                <span class="pslot-star-tag">★ 1 LEADER</span>
                <div class="pslot-socket">
                  <img class="pslot-ball-ico" src="img/battle/${ballKey}_32.png" onerror="this.src='img/battle/poke_ball_32.png'" alt="">
                </div>
              </div>
              <div class="pslot-lead-lvl-row">
                ${statusTag(m)}
                <span class="pl${isCapped ? ' capped' : ''}">Lv. ${m.lvl}${isCapped ? ' <i>MAX</i>' : ''}</span>
              </div>
            </div>
            <div class="pslot-lead-pedestal">
              <div class="pslot-ped-ring"></div>
              <img class="pslot-lead-spr${m.shadow ? ' shadowmon' : ''}" src="${ASSETS.front(m.sp, m.shiny)}" alt="" onerror="this.src='${ASSETS.icon(m.sp)}'">
            </div>
            <div class="pslot-lead-info">
              <div class="pslot-lead-name-row">
                <span class="pn">${esc(monName(m))}</span>
                ${gender(m)}
              </div>
              <div class="pslot-types">${typesHtml}</div>
              <div class="pslot-hp-box">
                <div class="hp-b2w2">
                  <span class="hp-tag">HP</span>
                  <div class="hp-track"><u style="width:${(r * 100).toFixed(1)}%;background:${hpCol(r)}"></u></div>
                </div>
                <div class="phpn">${m.hp} / ${m.stats[0]}</div>
              </div>
              <div class="pexp-b2w2">
                <span class="pexp-tag">EXP</span>
                <div class="pexp-track"><u style="width:${expPct}%"></u></div>
                <span class="pexp-val">${expPct}%</span>
              </div>
              ${why ? `<div class="pwhy">${esc(why)}</div>` : ''}
            </div>`;
          c.addEventListener('mouseenter', () => { if (!busy && i !== 0) { i = 0; ui.sound.sfx('blip'); draw(); } });
          c.addEventListener('click', (e) => { e.stopPropagation(); triggerSlot(0); });
          colLead.appendChild(c);
        } else {
          // SLOTS SECONDAIRES 1..5 (Fentes biseautées B2W2 droite)
          const c = el('div', 'pslot-sub' + (isKo ? ' ko' : '') + (k === i ? ' on' : '') + (k === swapFrom ? ' swap' : '') + (why ? ' blocked' : ''));
          c.dataset.idx = k;
          c.innerHTML = `
            <div class="pslot-sub-left">
              <div class="pslot-socket">
                <img class="pslot-ball-ico" src="img/battle/${ballKey}_32.png" onerror="this.src='img/battle/poke_ball_32.png'" alt="">
              </div>
              <span class="pslot-sub-num">#${k + 1}</span>
              <div class="pslot-sub-ped">
                <img class="pslot-sub-spr${m.shadow ? ' shadowmon' : ''}" src="${ASSETS.front(m.sp, m.shiny)}" alt="" onerror="this.src='${ASSETS.icon(m.sp)}'">
              </div>
            </div>
            <div class="pslot-sub-mid">
              <div class="pslot-sub-top">
                <span class="pn">${esc(monName(m))}</span>
                ${gender(m)}
              </div>
              <div class="pslot-sub-mid-row">
                <div class="pslot-types">${typesHtml}</div>
                <div class="pslot-sub-tags">
                  ${statusTag(m)}
                  <span class="pl${isCapped ? ' capped' : ''}">Lv. ${m.lvl}</span>
                </div>
              </div>
              ${why ? `<div class="pwhy">${esc(why)}</div>` : ''}
            </div>
            <div class="pslot-sub-right">
              <div class="hp-b2w2">
                <span class="hp-tag">HP</span>
                <div class="hp-track"><u style="width:${(r * 100).toFixed(1)}%;background:${hpCol(r)}"></u></div>
              </div>
              <div class="phpn">${m.hp} / ${m.stats[0]}</div>
              <div class="pexp-b2w2">
                <span class="pexp-tag">EXP</span>
                <div class="pexp-track"><u style="width:${expPct}%"></u></div>
              </div>
            </div>`;
          c.addEventListener('mouseenter', () => { if (!busy && i !== k) { i = k; ui.sound.sfx('blip'); draw(); } });
          c.addEventListener('click', (e) => { e.stopPropagation(); triggerSlot(k); });
          colSubs.appendChild(c);
        }
      });

      // Emplacements libres (au maximum 5 fentes secondaires)
      const startEmpty = Math.max(1, party.length);
      for (let k = startEmpty; k < 6; k++) {
        const emp = el('div', 'pslot-sub empty');
        emp.innerHTML = `
          <div class="pslot-sub-left">
            <div class="pslot-socket empty"></div>
            <span class="pslot-sub-num">#${k + 1}</span>
          </div>
          <div class="pslot-empty-lbl">EMPLACEMENT DISPONIBLE #${k + 1}</div>`;
        colSubs.appendChild(emp);
      }

      cancel.classList.toggle('on', i === party.length);
      help.textContent = swapFrom >= 0
        ? `Échanger la place de ${monName(party[swapFrom])} avec quel Pokémon ?`
        : o.prompt || 'Sélectionne un Pokémon (Clic ou Entrée · Échap pour quitter).';
    };

    cancel.addEventListener('mouseenter', () => {
      if (!busy && i !== party.length) { i = party.length; ui.sound.sfx('blip'); draw(); }
    });
    cancel.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerSlot(party.length);
    });

    draw();
    const close = (v) => { pop(); s.remove(); resolve(v); };
    const pop = ui.input.push(async (k) => {
      if (busy) return;
      const n = party.length;
      if (k === 'up') {
        if (i === n) i = n > 1 ? n - 1 : 0;
        else if (i === 0) i = n;
        else if (i === 1) i = 0;
        else i--;
      } else if (k === 'down') {
        if (i === n) i = 0;
        else if (i === 0) i = n > 1 ? 1 : n;
        else if (i === n - 1) i = n;
        else i++;
      } else if (k === 'left') {
        if (i > 0 && i < n) i = 0;
      } else if (k === 'right') {
        if (i === 0 && n > 1) i = 1;
      } else if (k === 'b') {
        if (swapFrom >= 0) { swapFrom = -1; draw(); return; }
        ui.sound.sfx('cancel'); close(-1); return;
      } else if (k === 'a') {
        await triggerSlot(i); return;
      } else return;
      ui.sound.sfx('blip'); draw();
    });
  });
}

/* ================= ENREGISTREMENT POKÉDEX (Style 5G Noir 2 / Blanc 2) ================= */
export function pokedexRegisterScene(game, mon) {
  const ui = game.ui, sound = game.sound;
  const sp = mon.sp;
  const def = SPECIES[sp] || { n: 'Pokémon Inconnu', t: ['normal'], genus: 'Pokémon Mystère', h: 10, w: 100, dex: 'Données non répertoriées.' };
  const pdxNum = `N° ${String(sp).padStart(3, '0')}`;
  const hVal = (def.h != null ? (def.h / 10).toFixed(1) : '1.0');
  const wVal = (def.w != null ? (def.w / 10).toFixed(1) : '10.0');
  const typesHtml = (def.t || ['normal']).map((t) => `<span class="pdx-type-badge" style="--tc:${TYPE_COL[t] || '#888'}">${TYPE_FR[t] || t}</span>`).join('');
  const genderTag = mon.gender === 'm' ? '<span class="g m">♂</span>' : mon.gender === 'f' ? '<span class="g f">♀</span>' : '';

  return new Promise((resolve) => {
    const s = screen(ui, 'pokedex-reg-scr');
    s.innerHTML = `
      <div class="pdx-shell">
        <div class="pdx-topbar">
          <div class="pdx-lights">
            <span class="pdx-light blue pulse"></span>
            <span class="pdx-light red"></span>
            <span class="pdx-light yellow"></span>
            <span class="pdx-light green"></span>
          </div>
          <div class="pdx-title-zone">
            <span class="pdx-badge">POKÉDEX D'ODYSSÉE</span>
            <span class="pdx-header-txt">NOUVELLE ENTRÉE DÉTECTÉE</span>
          </div>
          <div class="pdx-decor-grid"></div>
        </div>

        <div class="pdx-body">
          <div class="pdx-left-col">
            <div class="pdx-num-banner">
              <span class="pdx-num-digital">${pdxNum}</span>
              <span class="pdx-stamp">✓ ENREGISTRÉ</span>
            </div>
            <div class="pdx-holo-frame">
              <div class="pdx-holo-lines"></div>
              <div class="pdx-scanner-beam"></div>
              <div class="pdx-pedestal"></div>
              <img class="pdx-mon-spr" src="${ASSETS.front(sp, mon.shiny)}" alt="${esc(def.n)}">
            </div>
            <div class="pdx-sensor-bar">
              <i class="pdx-wave-icon"></i>
              <span>SIGNAL BIO-ACOUSTIQUE IDENTIFIÉ</span>
            </div>
          </div>

          <div class="pdx-right-col">
            <div class="pdx-name-card">
              <div class="pdx-name-main">
                <span class="pdx-name-txt">${esc(def.n)}</span>
                ${genderTag}
              </div>
              <span class="pdx-genus-tag">${esc(def.genus || 'Pokémon')}</span>
            </div>

            <div class="pdx-specs-row">
              <div class="pdx-spec-cell">
                <span class="pdx-spec-lbl">TYPE(S)</span>
                <div class="pdx-types">${typesHtml}</div>
              </div>
              <div class="pdx-spec-cell">
                <span class="pdx-spec-lbl">TAILLE</span>
                <span class="pdx-spec-val"><b>${hVal}</b> m</span>
              </div>
              <div class="pdx-spec-cell">
                <span class="pdx-spec-lbl">POIDS</span>
                <span class="pdx-spec-val"><b>${wVal}</b> kg</span>
              </div>
            </div>

            <div class="pdx-desc-card">
              <div class="pdx-desc-bar">
                <span class="pdx-desc-title">RAPPORT DU POKÉDEX</span>
                <span class="pdx-desc-cur">■</span>
              </div>
              <div class="pdx-desc-viewport">
                <p class="pdx-desc-txt"></p>
              </div>
            </div>
          </div>
        </div>

        <div class="pdx-footbar">
          <span class="pdx-status-msg">✓ Données de ${esc(def.n)} inscrites dans le Pokédex !</span>
          <button class="pdx-btn-next ready" type="button">CONTINUER ▶</button>
        </div>
      </div>
    `;

    const descTxtEl = s.querySelector('.pdx-desc-txt');
    const nextBtn = s.querySelector('.pdx-btn-next');
    const fullDesc = def.dex || 'Aucune description disponible pour ce spécimen dans la base régionale.';

    let charIdx = 0, textTimer = null, typingDone = false;
    const typeSpeed = 18;

    const finishTyping = () => {
      if (typingDone) return;
      typingDone = true;
      if (textTimer) clearInterval(textTimer);
      descTxtEl.textContent = fullDesc;
      nextBtn.classList.add('ready');
    };

    sound.sfx('select');
    setTimeout(() => {
      sound.cry(ASSETS.cry(sp));
    }, 250);

    textTimer = setInterval(() => {
      if (charIdx < fullDesc.length) {
        charIdx++;
        descTxtEl.textContent = fullDesc.slice(0, charIdx);
        if (charIdx % 4 === 0) sound.sfx('blip');
      } else {
        finishTyping();
      }
    }, typeSpeed);

    let closed = false;
    const close = () => {
      if (closed) return;
      if (!typingDone) { finishTyping(); return; }
      closed = true;
      sound.sfx('select');
      pop();
      s.remove();
      resolve();
    };

    nextBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });
    s.addEventListener('click', () => {
      if (!typingDone) finishTyping();
      else close();
    });

    const pop = ui.input.push((k) => {
      if (k === 'a' || k === 'b' || k === 'start') {
        if (!typingDone) finishTyping();
        else close();
      }
    });
  });
}

/* ================= RÉSUMÉ (Style 5G Noir 2 / Blanc 2) ================= */
export function summaryScreen(game, list, idx) {
  const ui = game.ui;
  const cap = game.levelCap ? game.levelCap() : levelCap(game.state?.badges);
  return new Promise((resolve) => {
    const s = screen(ui, 'sum-scr');
    let page = 0;
    const close = () => { pop(); s.remove(); ui.sound.sfx('cancel'); resolve(idx); };
    const draw = () => {
      const m = list[idx], S = SPECIES[m.sp];
      const isCapped = m.lvl >= cap;
      const tabs = [
        ['INFOS DRESSEUR', 'Aperçu'],
        ['STATISTIQUES', 'Capacités'],
        ['ATTAQUES CONNUES', `${m.moves.length}/4`],
      ].map(([t, sub], k) => `<button type="button" class="sum-tab ${k === page ? 'on' : ''}" data-tab="${k}"><b>${t}</b><small>${sub}</small></button>`).join('');
      let body = '';
      if (page === 0) {
        body = `
          <table class="kv sum-kv">
            <tr><td>N° Pokédex</td><td>#${String(S.no || m.sp).padStart(3, '0')}</td></tr>
            <tr><td>Espèce</td><td>${esc(S.n)}</td></tr>
            <tr><td>Type</td><td>${S.t.map(typeTag).join(' ')}</td></tr>
            <tr><td>Dresseur Orig.</td><td>${esc(m.ot || game.state.name)}</td></tr>
            <tr><td>Rencontré à</td><td>${esc(m.met || '—')}</td></tr>
            <tr><td>Nature</td><td>${esc(natureName(m.nat ?? 0))}${(() => { const ne = natureEffect(m.nat ?? 0); return ne ? ` <small class="nat-fx">(+${STAT_NAMES[ne[0]]} / −${STAT_NAMES[ne[1]]})</small>` : ' <small class="nat-fx">(neutre)</small>'; })()}</td></tr>
            <tr><td>Points Exp.</td><td>${m.exp.toLocaleString('fr-FR')} pts</td></tr>
            <tr><td>Limite Arène</td><td>N.${cap} ${isCapped ? '<span class="sum-cap-tag">ATTEINTE</span>' : ''}</td></tr>
          </table>
          <div class="expline"><b>EXP</b><i><u style="width:${(expProgress(m, cap) * 100).toFixed(1)}%"></u></i></div>
          <div class="dexline">${esc(S.genus ? S.genus + ' — ' + (S.dex || '') : S.dex || '')}</div>`;
      } else if (page === 1) {
        // stats avec la nature (▲ +10 % en rouge, ▼ −10 % en bleu), les IV (0 à 31) et les EV (252 max, 510 en tout)
        const ne = natureEffect(m.nat ?? 0), ev = m.ev || [0, 0, 0, 0, 0, 0], evTot = ev.reduce((a, x) => a + x, 0);
        body = `<table class="kv stats sum-kv sum-stats"><tr class="sth"><td></td><td>Stat</td><td></td><td>IV</td><td>EV</td></tr>${STAT_NAMES.map((n, k) => `<tr><td class="${ne && ne[0] === k ? 'nat-up' : ne && ne[1] === k ? 'nat-down' : ''}">${n}${ne && ne[0] === k ? ' ▲' : ne && ne[1] === k ? ' ▼' : ''}</td><td><b>${k === 0 ? `${m.hp} / ${m.stats[0]}` : m.stats[k]}</b></td><td><i class="sbar"><u style="width:${Math.min(100, S.b[k] / 1.5)}%"></u></i></td><td class="iv${m.iv[k] === 31 ? ' max' : ''}">${m.iv[k]}</td><td class="evv">${ev[k]}</td></tr>`).join('')}</table>
          <div class="sum-natline">Nature <b>${esc(natureName(m.nat ?? 0))}</b> · EV ${evTot} / 510 · Les EV s'ajoutent aux stats au niveau suivant ou au Centre.</div>`;
      } else {
        body = `<div class="moves">${m.moves.map((mv) => {
          const M = MOVES[mv.id];
          return `<div class="mv" style="--tc:${TYPE_COL[M.t]}">
            <div class="mv-top"><span class="mvn">${esc(M.n)}</span>${typeTag(M.t)}<span class="mvpp">PP <b>${mv.pp}</b>/${M.pp}</span></div>
            <div class="mvd">${M.c === 'status' ? 'Catégorie : Statut' : `Puissance : ${M.p || '—'}`} · Précision : ${M.a ?? '—'}%</div>
          </div>`;
        }).join('')}</div>`;
      }
      s.innerHTML = `
        <div class="scr-bar">
          <div class="scr-bar-left">
            <img class="scr-bar-ico" src="img/hud/team.png" alt="">
            <span class="scr-bar-title">RÉSUMÉ POKÉMON</span>
            <span class="scr-bar-sub">${idx + 1} / ${list.length}</span>
          </div>
          <div class="scr-bar-right">
            <button type="button" class="scr-nav-btn" data-act="prev" title="Pokémon précédent (▲)">▲ PRÉC.</button>
            <button type="button" class="scr-nav-btn" data-act="next" title="Pokémon suivant (▼)">▼ SUIV.</button>
            <button type="button" class="scr-close-btn" data-act="close">RETOUR ✕</button>
          </div>
        </div>
        <div class="sum-body">
          <div class="sum-left">
            <div class="sum-head">
              <span class="sum-name">${esc(monName(m))}${gender(m)}</span>
              <span class="sum-lvl">N.${m.lvl}</span>
            </div>
            <div class="sum-stage">
              <img class="sum-spr${m.shadow ? ' shadowmon' : ''}" src="${ASSETS.front(m.sp, m.shiny)}" alt="">
            </div>
            <div class="sum-types-row">${S.t.map(typeTag).join(' ')} ${statusTag(m)}</div>
            ${hpBar(m)}
            <div class="phpn">${m.hp} / ${m.stats[0]} PV</div>
          </div>
          <div class="sum-right">
            <div class="tabs">${tabs}</div>
            <div class="sum-content">${body}</div>
          </div>
        </div>
        <div class="sum-help">◀ ▶ Changer d'onglet · ▲ ▼ Changer de Pokémon · Clic ou Échap pour fermer</div>`;

      s.querySelectorAll('[data-tab]').forEach((btn) => {
        btn.addEventListener('click', () => {
          page = +btn.dataset.tab;
          ui.sound.sfx('blip');
          draw();
        });
      });
      s.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
        idx = (idx - 1 + list.length) % list.length;
        ui.sound.sfx('blip');
        draw();
      });
      s.querySelector('[data-act="next"]')?.addEventListener('click', () => {
        idx = (idx + 1) % list.length;
        ui.sound.sfx('blip');
        draw();
      });
      s.querySelector('[data-act="close"]')?.addEventListener('click', close);
    };
    draw();
    const pop = ui.input.push((k) => {
      if (k === 'left') page = (page + 2) % 3;
      else if (k === 'right') page = (page + 1) % 3;
      else if (k === 'up') idx = (idx - 1 + list.length) % list.length;
      else if (k === 'down') idx = (idx + 1) % list.length;
      else if (k === 'b' || k === 'a') { close(); return; }
      else return;
      ui.sound.sfx('blip'); draw();
    });
  });
}

/* ================= SAC (Style 5G Noir 2 / Blanc 2) ================= */
const POCKET_DESC = [
  'Potions, rappels et remèdes pour restaurer les PV et le statut.',
  'Poké Balls pour capturer les créatures sauvages.',
  'Pierres d\'évolution, Repousses, Super Bonbons et objets utiles.',
  'Capsules Secrètes (CS), Carte et reliques précieuses.',
];
/** renvoie { item } choisi pour « Utiliser », ou null */
export function bagScreen(game, o = {}) {
  const ui = game.ui, bag = game.state.bag;
  return new Promise((resolve) => {
    const s = screen(ui, 'bag-scr');
    let pocket = o.pocket || 0, i = 0, busy = false;
    const entriesFor = (p) => Object.keys(bag).filter((k) => ITEMS[k] && ITEMS[k].pocket === POCKETS[p][0] && bag[k] > 0).sort((a, b) => Object.keys(ITEMS).indexOf(a) - Object.keys(ITEMS).indexOf(b));
    const entries = () => entriesFor(pocket);

    const close = (v) => { pop(); s.remove(); resolve(v); };

    const triggerRow = async (idx) => {
      if (busy) return;
      const es = entries();
      if (idx === es.length) { ui.sound.sfx('cancel'); close(null); return; }
      if (idx < 0 || idx > es.length) return;
      i = idx;
      draw();
      ui.sound.sfx('select');
      const item = es[i], it = ITEMS[item];
      const opts = o.battle ? ['Utiliser', 'Annuler'] : it.key ? ['Utiliser', 'Annuler'] : ['Utiliser', 'Jeter', 'Annuler'];
      busy = true;
      const r = await ui.list({
        items: opts.map((label) => ({
          label,
          disabled: label === 'Utiliser' && (o.battle ? !(it.heal || it.cure || it.revive || it.ball || it.pp || it.ppAll) : it.key && !it.field && item !== 'town-map'),
        })),
        cls: 'psub',
        cancel: opts.length - 1,
        parent: s,
      });
      busy = false;
      if (opts[r] === 'Utiliser') { close({ item }); return; }
      if (opts[r] === 'Jeter') {
        busy = true;
        const q = await ui.quantity(bag[item]);
        if (q && await ui.yesNo(`Jeter ${q} ${itemName(item)} ?`)) { bag[item] -= q; if (bag[item] <= 0) delete bag[item]; }
        busy = false;
      }
      draw();
    };

    const draw = () => {
      const es = entries();
      if (i > es.length) i = es.length;
      const sel = es[i];
      const tabsHtml = POCKETS.map(([, label], idx) => {
        const cnt = entriesFor(idx).length;
        return `<button type="button" class="bag-tab ${idx === pocket ? 'on' : ''}" data-pocket="${idx}">
          <span class="bag-tab-dot b${idx}"></span>
          <span class="bag-tab-lbl">${esc(label)}</span>
          <span class="bag-tab-cnt">${cnt}</span>
        </button>`;
      }).join('');

      s.innerHTML = `
        <div class="scr-bar">
          <div class="scr-bar-left">
            <img class="scr-bar-ico" src="img/hud/bag.png" alt="">
            <span class="scr-bar-title">SAC D'OBJETS</span>
            <span class="scr-bar-sub">${esc(POCKETS[pocket][1].toUpperCase())}</span>
          </div>
          <div class="scr-bar-right">
            <span class="scr-money-pill"><img src="img/hud/coin.png" alt=""> ${(game.state?.money || 0).toLocaleString('fr-FR')} ₽</span>
            <button type="button" class="scr-close-btn" data-act="close">FERMER ✕</button>
          </div>
        </div>
        <div class="bag-tabs">${tabsHtml}</div>
        <div class="bag-body">
          <div class="bag-left">
            <div class="bag-pic">
              <div class="bag-icon-stage">
                <div class="bag-icon b${pocket}"></div>
              </div>
              <div class="bag-pocket-title">◀ ${esc(POCKETS[pocket][1])} ▶</div>
              <div class="bag-pocket-sub">${esc(POCKET_DESC[pocket] || '')}</div>
            </div>
            <div class="bag-desc">
              ${sel ? `
                <div class="bag-desc-top">
                  <div class="itm-big-wrap"><img class="itm-big" src="${ASSETS.item(sel)}" alt=""></div>
                  <div class="bag-desc-meta">
                    <div class="bag-desc-name">${esc(itemName(sel))}</div>
                    <div class="bag-desc-qty">${ITEMS[sel].key ? 'Objet rare' : `En sac : × ${bag[sel]}`}</div>
                  </div>
                </div>
                <div class="bag-desc-txt">${esc(ITEMS[sel].desc)}</div>
              ` : `
                <div class="bag-desc-empty">Fermer le Sac et revenir à l'aventure.</div>
              `}
            </div>
          </div>
          <div class="bag-list">
            <div class="list-items">
              ${es.length === 0 ? `<div class="bag-empty-msg">Cette poche est vide pour le moment.</div>` : ''}
              ${es.map((k, n) => `
                <div class="list-row bag-row ${n === i ? 'on' : ''}" data-row="${n}">
                  <span class="cur">▶</span>
                  <img class="itm" src="${ASSETS.item(k)}" alt="">
                  <span class="lbl">${esc(itemName(k))}</span>
                  <span class="rgt">${ITEMS[k].key ? 'CLÉ' : '× ' + bag[k]}</span>
                </div>`).join('')}
              <div class="list-row bag-row bag-close-row ${i === es.length ? 'on' : ''}" data-row="${es.length}">
                <span class="cur">▶</span>
                <span class="lbl">FERMER LE SAC</span>
                <span class="rgt">Échap</span>
              </div>
            </div>
          </div>
        </div>`;

      s.querySelector('.list-row.on')?.scrollIntoView({ block: 'nearest' });
      s.querySelector('[data-act="close"]')?.addEventListener('click', () => { ui.sound.sfx('cancel'); close(null); });
      s.querySelectorAll('[data-pocket]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (busy) return;
          pocket = +btn.dataset.pocket;
          i = 0;
          ui.sound.sfx('blip');
          draw();
        });
      });
      s.querySelectorAll('[data-row]').forEach((row) => {
        const idx = +row.dataset.row;
        row.addEventListener('mouseenter', () => {
          if (!busy && i !== idx) { i = idx; ui.sound.sfx('blip'); draw(); }
        });
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          triggerRow(idx);
        });
      });
    };
    draw();
    const pop = ui.input.push(async (k) => {
      if (busy) return;
      const es = entries();
      if (k === 'left' || k === 'right') { pocket = (pocket + (k === 'left' ? POCKETS.length - 1 : 1)) % POCKETS.length; i = 0; ui.sound.sfx('blip'); draw(); return; }
      if (k === 'up') { i = (i - 1 + es.length + 1) % (es.length + 1); ui.sound.sfx('blip'); draw(); return; }
      if (k === 'down') { i = (i + 1) % (es.length + 1); ui.sound.sfx('blip'); draw(); return; }
      if (k === 'b') { ui.sound.sfx('cancel'); close(null); return; }
      if (k !== 'a') return;
      await triggerRow(i);
    });
  });
}

/* ================= POKÉDEX ================= */
export function dexScreen(game) {
  const ui = game.ui, st = game.state;
  return new Promise((resolve) => {
    const s = screen(ui, 'dex-scr');
    // les créatures d'Odyssée d'abord (numéros 001 à 052), puis les Pokémon venus d'ailleurs ; tant qu'elles sont
    // remplacées par des Pokémon, seules celles déjà rencontrées (ancienne sauvegarde) restent dans la liste
    const ids = Object.keys(SPECIES).map(Number).filter((id) => ORIGINALES || id < 1000 || st.dex.seen.includes(id))
      .sort((a, b) => (a >= 1000) === (b >= 1000) ? a - b : a >= 1000 ? -1 : 1);
    const num = (id) => (SPECIES[id].no ? String(SPECIES[id].no).padStart(3, '0') : '#' + String(id).padStart(3, '0'));
    let i = 0;
    const seen = new Set(st.dex.seen), caught = new Set(st.dex.caught);
    s.innerHTML = `<div class="dex-left box"><img class="dex-spr" alt=""><div class="dex-info"></div></div><div class="dex-right box"><div class="dex-count">Vus : ${seen.size} · Capturés : ${caught.size}</div><div class="list-items dex-list"></div></div>`;
    const list = s.querySelector('.dex-list'), spr = s.querySelector('.dex-spr'), info = s.querySelector('.dex-info');
    list.innerHTML = ids.map((id) => `<div class="list-row" data-i="${id}"><span class="cur">▶</span><span class="dexn">${num(id)}</span><span class="lbl">${seen.has(id) ? esc(SPECIES[id].n) : '-----'}</span>${caught.has(id) ? '<span class="ball-mini"></span>' : ''}</div>`).join('');
    const rows = [...list.children];
    const draw = () => {
      rows.forEach((r, k) => r.classList.toggle('on', k === i)); rows[i].scrollIntoView({ block: 'nearest' });
      const id = ids[i], S = SPECIES[id];
      if (seen.has(id)) { spr.src = ASSETS.front(id); spr.style.visibility = ''; spr.classList.toggle('shadowed', !caught.has(id)); }
      else spr.style.visibility = 'hidden';
      info.innerHTML = caught.has(id) ? `<div class="dex-name">${num(id)} ${esc(S.n)}</div><div>${esc(S.genus || '')}</div><div>${S.t.map(typeTag).join(' ')}</div><div>Taille ${(S.h / 10).toLocaleString('fr-FR')} m · Poids ${(S.w / 10).toLocaleString('fr-FR')} kg</div><p>${esc(S.dex)}</p>` : seen.has(id) ? `<div class="dex-name">${num(id)} ${esc(S.n)}</div><p>Capture cette créature pour en savoir plus.</p>` : '<p>Créature inconnue.</p>';
    };
    draw();
    const pop = ui.input.push((k) => {
      if (k === 'up') i = (i - 1 + ids.length) % ids.length; else if (k === 'down') i = (i + 1) % ids.length;
      else if (k === 'left') i = Math.max(0, i - 10); else if (k === 'right') i = Math.min(ids.length - 1, i + 10);
      else if (k === 'b' || k === 'a') { pop(); s.remove(); ui.sound.sfx('cancel'); resolve(); return; }
      else return;
      ui.sound.sfx('blip'); draw();
    });
  });
}

/* ================= CARTE DE LA RÉGION ================= */
// La carte se dévoile au fil du voyage : seules les zones parcourues sont dessinées, le reste n'est qu'une étendue
// verte ; le cadre est zoomé sur ce qu'on connaît et s'élargit à mesure qu'on avance.
/** carte de la région, dessinée comme le Pokégear de HeartGold / SoulSilver : mer en trois bleus, côtes en falaises,
 *  plaines et forêts, montagnes en paliers, routes blanches cerclées de gris, villes en pastilles rouges.
 *  Un pixel = une case ; le relief est posé par blocs de 2 × 2 cases, comme les pixels doublés du DS. */
const HG = {
  open: [81, 186, 218], far: [66, 181, 206], deep: [57, 165, 189], foam: [139, 219, 244],
  flat: [97, 195, 146], shadow: [81, 179, 128], cliff: [197, 145, 106],
  top: [242, 178, 130], vhigh: [220, 162, 114], high: [195, 146, 105], low: [162, 130, 89],
  ink: '#525252', road: '#ffffff', town: '#fa5263', townDark: '#a23047', special: '#72cb93', water: '#60b2fc',
};
let carteIcons = null;
function loadCarteIcons() {
  if (carteIcons) return carteIcons;
  carteIcons = {};
  for (const k of SPRITES.carte || []) { const im = new Image(); im.src = ASSETS.carte(k); carteIcons[k] = im; }
  return carteIcons;
}
function drawRegion(game, cv) {
  const W = game.world.maps.monde, ctx = cv.getContext('2d'), w = W.w, h = W.h, B = 2;
  const bw = Math.ceil(w / B), bh = Math.ceil(h / B);
  // nature de chaque bloc de 2 × 2 cases
  // 0 eau, 1 plaine, 2 forêt, 3 montagne, 4 pied de montagne (sol praticable des zones volcaniques et enneigées)
  const kind = new Uint8Array(bw * bh);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    let water = 0, walk = 0;
    for (let dy = 0; dy < B; dy++) for (let dx = 0; dx < B; dx++) {
      const t = W.get(bx * B + dx, by * B + dy);
      if (t === T.WATER) water++; else if (walkable(t) || t === T.DOOR) walk++;
    }
    const th = W.zoneAt(bx * B, by * B)?.theme, hill = th === 'volcanic' || th === 'snow';
    const i = by * bw + bx;
    kind[i] = water >= 2 ? 0 : walk ? (hill ? 4 : 1) : hill ? 3 : 2;
  }
  // distance de chaque bloc à la nature voisine (pour la mer : à la côte ; pour la montagne : au pied)
  const dist = (pred) => {
    const d = new Int16Array(bw * bh).fill(99), q = [];
    for (let i = 0; i < d.length; i++) if (pred(kind[i])) { d[i] = 0; q.push(i); }
    for (let k = 0; k < q.length; k++) {
      const i = q[k], x = i % bw, y = (i / bw) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= bw || ny >= bh) continue; const j = ny * bw + nx; if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); } }
    }
    return d;
  };
  const toLand = dist((k) => k !== 0), toFoot = dist((k) => k !== 3), toOpen = dist((k) => k === 1 || k === 4 || k === 0);
  const img = ctx.createImageData(w, h);
  for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) {
    const i = by * bw + bx, k = kind[i];
    let c;
    if (k === 0) c = toLand[i] <= 1 ? HG.deep : toLand[i] <= 3 ? HG.far : HG.open;
    else if (toLand.length && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => kind[(by + dy) * bw + bx + dx] === 0 && bx + dx >= 0 && by + dy >= 0 && bx + dx < bw && by + dy < bh)) c = HG.cliff;
    else if (k === 3) { const d = toFoot[i]; c = d <= 1 ? HG.low : d <= 2 ? HG.high : d <= 4 ? HG.vhigh : HG.top; }
    else if (k === 4) c = HG.low;
    else c = k === 2 && toOpen[i] >= 2 ? HG.shadow : HG.flat;
    for (let dy = 0; dy < B; dy++) for (let dx = 0; dx < B; dx++) {
      const x = bx * B + dx, y = by * B + dy; if (x >= w || y >= h) continue;
      const o = (y * w + x) * 4; img.data[o] = c[0]; img.data[o + 1] = c[1]; img.data[o + 2] = c[2]; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const I = loadCarteIcons();
  const icon = (k, x, y) => { const im = I[k]; if (im && im.complete && im.naturalWidth) ctx.drawImage(im, Math.round(x - im.width / 2), Math.round(y - im.height + 2)); };
  // arbres sur les forêts épaisses, montagnes sur les reliefs (une icône par carré de 22 cases, au hasard du lieu)
  for (let y = 10; y < h - 6; y += 22) for (let x = 10; x < w - 6; x += 22) {
    const jx = x + ((x * 7 + y * 13) % 9) - 4, jy = y + ((x * 11 + y * 5) % 9) - 4;
    const i = Math.floor(jy / B) * bw + Math.floor(jx / B), k = kind[i];
    if (k === 2 && toOpen[i] >= 4 && ((x + y - 20) / 22) % 2 === 0) icon((jx * 5 + jy) % 7 ? 'arbre_v' : 'arbre_o', jx, jy);
    else if (k === 3 && toFoot[i] >= 3) icon((jx * 3 + jy) % 2 ? 'montagne' : 'colline', jx, jy);
  }
  // routes : un trait blanc cerclé de gris
  ctx.lineJoin = 'miter'; ctx.lineCap = 'square';
  const roads = (game.world.routes || []).map((r) => r.pts);
  for (const [lw, col] of [[7, HG.ink], [4, HG.road]]) {
    ctx.strokeStyle = col; ctx.lineWidth = lw;
    for (const pts of roads) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x + 0.5, y + 0.5) : ctx.moveTo(x + 0.5, y + 0.5))); ctx.stroke(); }
  }
  // grottes et lieux à part (lac, jardin, forêt des torii) : icônes et pastilles vertes
  for (const b of W.buildings) if (b.kind === 'cave') icon('grotte_m', b.x + b.w / 2, b.y + b.d);
  const pill = (x, y, pw, ph, fill, dark) => {
    x = Math.round(x - pw / 2); y = Math.round(y - ph / 2);
    ctx.fillStyle = HG.ink; ctx.fillRect(x - 1, y, pw + 2, ph); ctx.fillRect(x, y - 1, pw, ph + 2);
    ctx.fillStyle = fill; ctx.fillRect(x, y, pw, ph);
    if (dark) { ctx.fillStyle = dark; ctx.fillRect(x, y + Math.ceil(ph * 0.55), pw, Math.floor(ph * 0.45)); }
  };
  for (const m of Object.values(game.world.maps)) if (m !== W && m.outdoor && m.outside?.map === 'monde' && m.id !== 'magma') pill(m.outside.x, m.outside.y, 6, 6, HG.special);
  // villes : pastilles rouges (grises tant qu'on n'y est pas allé)
  const visited = new Set(game.state.visited || []);
  for (const t of Object.values(game.world.towns)) {
    const big = t.gym != null || t.id === 'plateau';
    pill(t.x + t.w / 2, t.y + t.h / 2, big ? 16 : 12, big ? 12 : 9, visited.has(t.id) ? HG.town : '#b0b0b0', visited.has(t.id) ? HG.townDark : '#808080');
  }
  // brouillard sur ce qui n'a pas encore été exploré
  const seen = new Set(game.state.explored || []), C = 8, cw = Math.ceil(w / C);
  if (seen.size) {
    ctx.fillStyle = 'rgba(28, 36, 52, 0.62)';
    for (let y = 0; y < h; y += C) for (let x = 0; x < w; x += C) if (!seen.has(Math.floor(y / C) * cw + Math.floor(x / C))) ctx.fillRect(x, y, C, C);
  }
}
export function mapScreen(game) {
  const ui = game.ui, W = game.world.maps.monde, towns = game.world.towns, st = game.state;
  const allTowns = Object.values(towns);
  const visited = new Set(st.visited || []);
  return new Promise((resolve) => {
    const s = screen(ui, 'map-scr');
    const p = game.worldPos();
    const near = () => { let best = null, bd = 1e9; for (const r of game.world.routes || []) for (const [x, y] of r.pts) { const d = Math.hypot(x - p.x, y - p.y); if (d < bd) { bd = d; best = r.name; } } return best; };
    const here = game.mapObj === W && !W.zoneAt(p.x, p.y)?.name ? near() || game.locationName() : game.locationName();

    const spots = [{
      name: here,
      x: p.x,
      y: p.y,
      sub: 'Position actuelle du dresseur',
      tag: 'VOUS ÊTES ICI',
      tagCls: 'here',
    }].concat(
      allTowns.filter((t) => visited.has(t.id)).map((t) => {
        const gIdx = t.gym;
        const hasGym = gIdx != null && LEADERS[gIdx];
        const gotBadge = hasGym && st.badges?.[gIdx];
        const leader = hasGym ? LEADERS[gIdx] : null;
        const badge = hasGym ? BADGES[gIdx] : null;
        const capLvl = hasGym ? GYM_CAPS[gIdx] : null;
        return {
          id: t.id,
          name: t.name,
          x: t.x + t.w / 2,
          y: t.y + t.h / 2,
          sub: hasGym
            ? `Arène #${gIdx + 1} : ${leader.name} (${TYPE_FR[leader.type] || leader.type}) · ${gotBadge ? badge.name + ' obtenu ✓' : `Limite av. Arène : N.${capLvl}`}`
            : t.id === 'plateau'
              ? 'Siège du Conseil des 4 et du Maître de la Ligue'
              : 'Ville visitée · Centre Pokémon disponible',
          tag: hasGym ? (gotBadge ? 'BADGE OBTENU ✓' : `ARÈNE #${gIdx + 1} (CAP N.${capLvl})`) : t.id === 'plateau' ? 'LIGUE POKÉMON' : 'VILLE VISITÉE',
          tagCls: hasGym ? (gotBadge ? 'badge-ok' : 'gym') : 'town',
        };
      })
    );

    s.innerHTML = `
      <div class="scr-bar">
        <div class="scr-bar-left">
          <img class="scr-bar-ico" src="img/hud/map.png" alt="">
          <span class="scr-bar-title">CARTE DE LA RÉGION D'ODYSSÉE</span>
          <span class="scr-bar-sub">${visited.size} / ${allTowns.length} VILLES</span>
        </div>
        <div class="scr-bar-right">
          <span class="scr-cap-badge">NIV. MAX ACTUEL : <b>N.${game.levelCap ? game.levelCap() : levelCap(st.badges)}</b></span>
          <button type="button" class="scr-close-btn" data-act="close">FERMER ✕</button>
        </div>
      </div>
      <div class="map-stage">
        <div class="map-wrap" style="aspect-ratio:${W.w} / ${W.h}">
          <canvas class="mapcv" width="${W.w}" height="${W.h}"></canvas>
          <div class="map-labels"></div>
          <div class="map-corner tl"></div><div class="map-corner tr"></div>
          <div class="map-corner bl"></div><div class="map-corner br"></div>
        </div>
      </div>
      <div class="map-footer">
        <button type="button" class="map-nav-btn" data-act="prev" title="Lieu précédent (◀)">◀</button>
        <div class="map-info">
          <div class="map-info-top">
            <span class="map-where"></span>
            <span class="map-tag"></span>
          </div>
          <div class="map-sub"></div>
        </div>
        <button type="button" class="map-nav-btn" data-act="next" title="Lieu suivant (▶)">▶</button>
        <div class="map-legend">
          <span><i class="lg-dot me"></i> Vous</span>
          <span><i class="lg-dot town"></i> Ville</span>
          <span><i class="lg-dot gym"></i> Arène</span>
        </div>
      </div>`;

    const c = s.querySelector('.mapcv');
    const lab = s.querySelector('.map-labels');
    const whereEl = s.querySelector('.map-where');
    const tagEl = s.querySelector('.map-tag');
    const subEl = s.querySelector('.map-sub');

    const draw = () => drawRegion(game, c);
    draw();
    Object.values(loadCarteIcons()).forEach((im) => { if (!im.complete) im.onload = draw; });

    const me = el('div', 'map-me');
    me.style.left = (p.x / W.w * 100) + '%';
    me.style.top = (p.y / W.h * 100) + '%';
    lab.appendChild(me);

    // Interactive town pins on the map
    spots.forEach((sp, idx) => {
      if (idx === 0) return;
      const pin = el('button', 'map-pin ' + (sp.tagCls || ''));
      pin.type = 'button';
      pin.style.left = (sp.x / W.w * 100) + '%';
      pin.style.top = (sp.y / W.h * 100) + '%';
      pin.title = sp.name;
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        k = idx;
        ui.sound.sfx('blip');
        show();
      });
      lab.appendChild(pin);
    });

    const cur = el('div', 'map-cur');
    lab.appendChild(cur);

    let k = 0;
    const show = () => {
      const q = spots[k];
      cur.style.left = (q.x / W.w * 100) + '%';
      cur.style.top = (q.y / W.h * 100) + '%';
      whereEl.textContent = q.name;
      tagEl.textContent = q.tag || '';
      tagEl.className = 'map-tag ' + (q.tagCls || '');
      subEl.textContent = q.sub || '';
    };
    show();

    const close = () => { pop(); s.remove(); ui.sound.sfx('cancel'); resolve(); };
    s.querySelector('[data-act="close"]')?.addEventListener('click', close);
    s.querySelector('[data-act="prev"]')?.addEventListener('click', () => {
      k = (k + spots.length - 1) % spots.length;
      ui.sound.sfx('blip');
      show();
    });
    s.querySelector('[data-act="next"]')?.addEventListener('click', () => {
      k = (k + 1) % spots.length;
      ui.sound.sfx('blip');
      show();
    });

    const pop = ui.input.push((key) => {
      if (key === 'left' || key === 'up') { k = (k + spots.length - 1) % spots.length; ui.sound.sfx('blip'); show(); return; }
      if (key === 'right' || key === 'down') { k = (k + 1) % spots.length; ui.sound.sfx('blip'); show(); return; }
      if (key === 'a' || key === 'b' || key === 'map') close();
    });
  });
}

/* ================= CARTE DE DRESSEUR ================= */
/** fiche d'un dresseur (la sienne, ou celle d'un autre joueur reçue par le réseau : voir trainerCard) */
export function trainerCard(st) {
  return { name: st.name, id: st.id, gender: st.gender, money: st.money, dex: st.dex.caught.length, seen: st.dex.seen.length, time: st.time, badges: st.badges.map(Boolean),
    team: st.party.map((m) => ({ sp: m.sp, lvl: m.lvl, shiny: !!m.shiny, nick: m.nick || null })), champion: !!st.flags?.champion };
}
export function cardScreen(game, BADGES, other) {
  const ui = game.ui, c = other || trainerCard(game.state);
  return new Promise((resolve) => {
    const s = screen(ui, 'card-scr');
    const h = Math.floor((c.time || 0) / 3600), m = Math.floor((c.time || 0) / 60) % 60;
    const team = (c.team || []).slice(0, 6).map((q) => `<div class="tc-mon" title="${esc(q.nick || SPECIES[q.sp]?.n || '?')}"><img src="${ASSETS.icon(q.sp)}" alt=""><span>N.${q.lvl}</span></div>`).join('');
    s.innerHTML = `<div class="tcard box"><div class="tc-top"><span>${other ? 'CARTE DE ' + esc(String(c.name).toUpperCase()) : 'CARTE DRESSEUR'}</span><span>ID ${String(c.id || 0).padStart(5, '0')}</span></div><div class="tc-body"><table class="kv"><tr><td>Nom</td><td>${esc(c.name)}${c.champion ? ' ★' : ''}</td></tr>${other ? '' : `<tr><td>Argent</td><td>${(c.money || 0).toLocaleString('fr-FR')} ₽</td></tr>`}<tr><td>Pokédex</td><td>${c.dex}${c.seen != null ? ` (vus : ${c.seen})` : ''}</td></tr><tr><td>Temps de jeu</td><td>${h}:${String(m).padStart(2, '0')}</td></tr></table><div class="tc-photo"><div class="tc-char ${c.gender === 'f' ? 'f' : 'm'}"></div></div></div><div class="badges">${BADGES.map((b, k) => `<div class="badge ${c.badges?.[k] ? 'got' : ''}" style="--bc:${b.color}" title="${esc(b.name)}"><i></i></div>`).join('')}</div>${team ? `<div class="tc-team">${team}</div>` : ''}</div>`;
    const pop = ui.input.push((k) => { if (k === 'a' || k === 'b') { pop(); s.remove(); ui.sound.sfx('cancel'); resolve(); } });
  });
}

/* ================= BOUTIQUE ================= */
export async function shopScreen(game, stock) {
  const ui = game.ui, st = game.state;
  for (;;) {
    const r = await ui.ask('Bonjour ! Que puis-je faire pour toi ?', ['Acheter', 'Vendre', 'Au revoir'], { keep: true, speaker: 'Vendeur' });
    if (r === 1) {
      const sellable = Object.keys(st.bag).filter((k) => st.bag[k] > 0 && ITEMS[k] && !ITEMS[k].key && ITEMS[k].price > 0);
      if (!sellable.length) { await ui.say('Tu n\'as rien à vendre.', { keep: true }); continue; }
      const k = await ui.list({ title: 'Vendre', items: sellable.map((it) => ({ label: itemName(it), right: `× ${st.bag[it]}` })).concat([{ label: 'Annuler' }]), cls: 'shop', cancel: sellable.length });
      if (k < 0 || k >= sellable.length) continue;
      const it = sellable[k], price = Math.floor(ITEMS[it].price / 2);
      const q = await ui.quantity(st.bag[it], { price });
      if (!q) continue;
      if (await ui.yesNo(`Je peux t'en donner ${(q * price).toLocaleString('fr-FR')} ₽. D'accord ?`, { keep: true })) { st.bag[it] -= q; if (st.bag[it] <= 0) delete st.bag[it]; st.money += q * price; ui.sound.sfx('buy'); }
      continue;
    }
    if (r !== 0) break;
    const money = el('div', 'box money'); ui.root.appendChild(money);
    for (;;) {
      money.innerHTML = `Argent<br><b>${st.money.toLocaleString('fr-FR')} ₽</b>`;
      const k = await ui.list({ title: 'Acheter', items: stock.map((it) => ({ html: `<img class="itm" src="${ASSETS.item(it)}" alt="">${esc(itemName(it))}`, right: `${ITEMS[it].price.toLocaleString('fr-FR')} ₽` })).concat([{ label: 'Annuler' }]), cls: 'shop', cancel: stock.length, start: game._shopIdx || 0, onMove: (i) => { game._shopIdx = i; } });
      if (k < 0 || k >= stock.length) break;
      const it = stock[k], price = ITEMS[it].price, max = Math.min(99, Math.floor(st.money / price));
      if (max < 1) { await ui.say('Tu n\'as pas assez d\'argent.', { keep: true }); continue; }
      const q = await ui.quantity(max, { price });
      if (!q) continue;
      if (!(await ui.yesNo(`${itemName(it)} × ${q}, ça fera ${(q * price).toLocaleString('fr-FR')} ₽. D'accord ?`, { keep: true }))) continue;
      st.money -= q * price; st.bag[it] = (st.bag[it] || 0) + q; ui.sound.sfx('buy');
      money.innerHTML = `Argent<br><b>${st.money.toLocaleString('fr-FR')} ₽</b>`;
      if (q >= 10 && it === 'poke-ball') { st.bag['poke-ball']++; await ui.say('Voici une Poké Ball en cadeau pour ton achat !', { keep: true }); }
      else await ui.say('Et voilà ! Merci !', { keep: true });
    }
    money.remove();
  }
  await ui.say('Reviens quand tu veux !');
}

/* ================= PC ================= */
export async function pcScreen(game) {
  const ui = game.ui, st = game.state;
  ui.sound.sfx('pc');
  await ui.say(`${st.name} allume le PC.\nAccès au système de stockage des créatures.`, { keep: true });
  for (;;) {
    const r = await ui.ask('Que veux-tu faire ?', ['Retirer une créature', 'Déposer une créature', 'Éteindre'], { keep: true });
    if (r === 0) {
      if (!st.box.length) { await ui.say('Il n\'y a aucune créature dans la boîte.', { keep: true }); continue; }
      if (st.party.length >= 6) { await ui.say('Ton équipe est complète !', { keep: true }); continue; }
      const k = await ui.list({ title: `Boîte (${st.box.length})`, items: st.box.map((m) => ({ label: monName(m), right: `N.${m.lvl}` })).concat([{ label: 'Annuler' }]), cls: 'shop pcbox', cancel: st.box.length });
      if (k < 0 || k >= st.box.length) continue;
      const m = st.box.splice(k, 1)[0]; st.party.push(m);
      await ui.say(`${monName(m)} a rejoint ton équipe.`, { keep: true });
    } else if (r === 1) {
      if (st.party.length <= 1) { await ui.say('C\'est ta dernière créature !', { keep: true }); continue; }
      ui.closeDialog();
      const k = await partyScreen(game, { mode: 'pick', prompt: 'Quelle créature déposer ?' });
      if (k < 0) continue;
      if (st.party.filter((m, j) => j !== k && m.hp > 0).length === 0) { await ui.say('Il te faut au moins une créature en forme dans ton équipe !', { keep: true }); continue; }
      const m = st.party.splice(k, 1)[0]; st.box.push(m);
      await ui.say(`${monName(m)} a été déposé dans la boîte.`, { keep: true });
    } else break;
  }
  ui.closeDialog();
}

/* ================= PC DES NATURES (Centre de soins) ================= */
export async function naturePcScreen(game) {
  const ui = game.ui, st = game.state;
  ui.sound.sfx('pc');
  await ui.say([`${st.name} allume le PC des Natures.`, 'Ce PC règle le caractère d\'un Pokémon : une stat monte de 10 %, une autre baisse de 10 %.'], { keep: true });
  for (;;) {
    if (!st.party.length) { await ui.say('Tu n\'as encore aucune créature.', { keep: true }); break; }
    ui.closeDialog();
    const k = await partyScreen(game, { mode: 'pick', prompt: 'Changer la nature de quel Pokémon ?' });
    if (k < 0) break;
    const m = st.party[k];
    const label = (n) => { const ne = natureEffect(n); return ne ? `+${STAT_NAMES[ne[0]]} −${STAT_NAMES[ne[1]]}` : 'neutre'; };
    const n = await ui.list({ title: `${monName(m)} : ${natureName(m.nat ?? 0)}`, items: NATURES.map((name, i) => ({ label: name + (i === m.nat ? ' ✓' : ''), right: label(i) })).concat([{ label: 'Annuler' }]), cls: 'shop natures', cancel: NATURES.length, start: m.nat ?? 0 });
    if (n < 0 || n >= NATURES.length || n === m.nat) continue;
    if (!(await ui.yesNo(`${monName(m)} devient ${natureName(n)} (${label(n)}) ?`, { keep: true }))) continue;
    m.nat = n; refreshStats(m, true); ui.sound.sfx('levelup');
    await ui.say(`${monName(m)} est maintenant de nature ${natureName(n)} !`, { keep: true });
  }
  ui.closeDialog();
}

/* ================= OPTIONS ================= */
export function optionsScreen(game) {
  const ui = game.ui, snd = game.sound;
  return new Promise((resolve) => {
    const s = screen(ui, 'opt-scr', 'OPTIONS');
    const box = el('div', 'box opts'); s.appendChild(box);
    const speeds = ['Lente', 'Normale', 'Rapide', 'Instantanée'];
    let i = 0;
    const rows = () => [
      ['Vitesse du texte', speeds[ui.textSpeed]],
      ['Volume', '■'.repeat(Math.round(snd.vol * 10)) + '□'.repeat(10 - Math.round(snd.vol * 10))],
      ['Retour', ''],
    ];
    const draw = () => { box.innerHTML = rows().map(([a, b], k) => `<div class="list-row ${k === i ? 'on' : ''}"><span class="cur">▶</span><span class="lbl">${a}</span><span class="rgt">${b ? '◀ ' + b + ' ▶' : ''}</span></div>`).join('') + '<div class="keys"><b>Commandes</b><br>Flèches ou ZQSD : se déplacer · Espace / Entrée : valider, parler<br>Échap : annuler, menu · Maj (maintenue) : courir · C : carte</div>'; };
    draw();
    const pop = ui.input.push((k) => {
      if (k === 'up') i = (i + 2) % 3; else if (k === 'down') i = (i + 1) % 3;
      else if (k === 'left' || k === 'right') {
        const d = k === 'left' ? -1 : 1;
        if (i === 0) { ui.textSpeed = (ui.textSpeed + d + 4) % 4; try { localStorage.setItem('odyssee-textspeed', ui.textSpeed); } catch (e) {} }
        if (i === 1) snd.setVolume(Math.max(0, Math.min(1, Math.round(snd.vol * 10 + d) / 10)));
      } else if (k === 'b' || (k === 'a' && i === 2)) { pop(); s.remove(); ui.sound.sfx('cancel'); resolve(); return; }
      else return;
      ui.sound.sfx('blip'); draw();
    });
  });
}
export { canUseOn };

/* ================= CODE DE SAUVEGARDE ================= */
/** Affiche le code de la partie, à copier pour la reprendre sur un autre appareil. */
export function saveCodeScreen(ui, code, summary) {
  return new Promise((resolve) => {
    const s = screen(ui, 'code-scr', 'CODE DE SAUVEGARDE');
    const box = el('div', 'box code-box');
    box.innerHTML = `<div class="code-sum">${esc(summary)}</div>
      <p>Copie ce code puis, sur l'autre appareil, choisis <b>Charger un code</b> sur l'écran titre. Ta partie y reprend là où tu l'as sauvegardée.</p>
      <textarea class="code-ta" readonly spellcheck="false"></textarea>
      <div class="code-row"><button class="code-btn" data-k="copy">Copier le code</button><button class="code-btn ghost" data-k="close">Fermer</button></div>
      <div class="code-msg"></div>`;
    s.appendChild(box);
    const ta = box.querySelector('textarea'), msg = box.querySelector('.code-msg');
    ta.value = code;
    const copy = async () => {
      ta.focus(); ta.select();
      let ok = false;
      try { await navigator.clipboard.writeText(code); ok = true; } catch (e) { try { ok = document.execCommand('copy'); } catch (e2) { ok = false; } }
      msg.textContent = ok ? 'Code copié !' : 'Le code est sélectionné : copie-le avec Ctrl+C (⌘+C sur Mac).';
      ui.sound.sfx(ok ? 'select' : 'blip');
    };
    const close = () => { pop(); s.remove(); ui.sound.sfx('cancel'); resolve(); };
    box.querySelector('[data-k=copy]').onclick = copy;
    box.querySelector('[data-k=close]').onclick = close;
    const pop = ui.input.push((k) => { if (k === 'b') close(); else if (k === 'a') copy(); });
    setTimeout(() => { ta.focus(); ta.select(); }, 30);
  });
}

/** Demande un code collé ; renvoie le texte, ou null si on annule. */
export function loadCodeScreen(ui, check) {
  return new Promise((resolve) => {
    const s = screen(ui, 'code-scr', 'CHARGER UN CODE');
    const box = el('div', 'box code-box');
    box.innerHTML = `<p>Sur ton autre appareil : menu (Échap) → <b>CODE</b>, copie le code, puis colle-le ici.</p>
      <textarea class="code-ta" spellcheck="false" placeholder="ODY1.…"></textarea>
      <div class="code-row"><button class="code-btn" data-k="ok">Charger cette partie</button><button class="code-btn ghost" data-k="close">Annuler</button></div>
      <div class="code-msg err"></div>`;
    s.appendChild(box);
    const ta = box.querySelector('textarea'), msg = box.querySelector('.code-msg');
    let busy = false;
    const done = (v) => { pop(); s.remove(); resolve(v); };
    const ok = async () => {
      if (busy) return; busy = true; msg.textContent = 'Vérification…';
      const r = await check(ta.value);
      busy = false;
      if (r.error) { msg.textContent = r.error; ui.sound.sfx('bump'); ta.focus(); return; }
      ui.sound.sfx('select'); done(r);
    };
    box.querySelector('[data-k=ok]').onclick = ok;
    box.querySelector('[data-k=close]').onclick = () => { ui.sound.sfx('cancel'); done(null); };
    // Échap ferme ; Entrée dans la zone de texte valide (Maj+Entrée pour aller à la ligne)
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); ui.sound.sfx('cancel'); done(null); }
      else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ok(); }
      e.stopPropagation();
    });
    const pop = ui.input.push((k) => { if (k === 'b') { ui.sound.sfx('cancel'); done(null); } });
    setTimeout(() => ta.focus(), 30);
  });
}

/* ================= JOURNAL DES QUÊTES (Style 5G Noir 2 / Blanc 2) ================= */
export function questsScreen(game) {
  const ui = game.ui;
  return new Promise((resolve) => {
    const s = screen(ui, 'quests-scr');
    let currentTab = 'active'; // 'active' | 'done' | 'all'
    let selectedIdx = 0;

    const render = () => {
      const allQuests = getAllQuests(game);
      const activeCount = allQuests.filter((q) => q.status !== 'done').length;
      const doneCount = allQuests.filter((q) => q.status === 'done').length;
      const allCount = allQuests.length;

      let filtered = allQuests;
      if (currentTab === 'active') {
        filtered = allQuests.filter((q) => q.status !== 'done');
        if (!filtered.length) filtered = allQuests;
      } else if (currentTab === 'done') {
        filtered = allQuests.filter((q) => q.status === 'done');
      }

      if (selectedIdx >= filtered.length) {
        selectedIdx = Math.max(0, filtered.length - 1);
      }

      const selQuest = filtered[selectedIdx] || allQuests[0];
      const tracked = getTrackedQuest(game);

      s.innerHTML = `
        <div class="scr-bar">
          <div class="scr-bar-left">
            <img class="scr-bar-ico" src="img/items/notebook.png" alt="">
            <span class="scr-bar-title">JOURNAL DES QUÊTES</span>
            <span class="scr-bar-sub">${activeCount} actives · ${doneCount} terminées</span>
          </div>
          <div class="quests-tabs">
            <button type="button" class="qtab${currentTab === 'active' ? ' on' : ''}" data-tab="active">EN COURS (${activeCount})</button>
            <button type="button" class="qtab${currentTab === 'done' ? ' on' : ''}" data-tab="done">TERMINÉES (${doneCount})</button>
            <button type="button" class="qtab${currentTab === 'all' ? ' on' : ''}" data-tab="all">TOUTES (${allCount})</button>
          </div>
          <div class="scr-bar-right">
            <button class="scr-btn-close" type="button" data-act="close" title="Fermer (Échap)">✕</button>
          </div>
        </div>

        <div class="quests-body">
          <!-- Colonne gauche: Liste des quêtes -->
          <div class="qcol-list">
            <div class="qlist-head">
              <span>MISSIONS D'ODYSSÉE</span>
              <span class="qlist-cnt">${filtered.length} quête${filtered.length > 1 ? 's' : ''}</span>
            </div>
            <div class="qlist-scroll">
              ${filtered.length === 0 ? '<div style="padding:15px;color:#8aa0be;font-size:13px;text-align:center;">Aucune quête dans cette catégorie.</div>' : ''}
              ${filtered.map((q, idx) => `
                <div class="qcard ${q.status}${idx === selectedIdx ? ' on' : ''}${q.isTracked ? ' tracked' : ''}" data-idx="${idx}">
                  <span class="cur">▶</span>
                  <div class="qcard-top">
                    <span class="qcat-tag qcat-${q.cat}">${esc(q.cat === 'main' ? 'PRINCIPALE' : q.cat === 'side' ? 'AVENTURE' : 'HABITANT')}</span>
                    ${q.isTracked ? '<span class="qtracked-tag">★ SUIVIE</span>' : ''}
                  </div>
                  <div class="qcard-name">${esc(q.name)}</div>
                  <div class="qcard-sub">
                    <span class="qcard-step">${q.status === 'done' ? '✔ Terminée' : `Étape ${q.step}/${q.totalSteps}`}</span>
                    <span class="qcard-loc">📍 ${esc(q.where)}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Colonne droite: Fiche détaillée -->
          <div class="qcol-detail">
            ${selQuest ? `
              <div class="qdet-head">
                <div class="qdet-head-left">
                  <div class="qdet-title-row">
                    <span class="qcat-tag qcat-${selQuest.cat}">${esc(selQuest.cat === 'main' ? 'QUÊTE PRINCIPALE' : selQuest.cat === 'side' ? 'AVENTURE' : 'HABITANT')}</span>
                    ${selQuest.status === 'done' ? '<span class="qcat-tag" style="background:#208038">✔ TERMINÉE</span>' : '<span class="qcat-tag" style="background:#0088cc">EN COURS</span>'}
                    ${selQuest.isTracked ? '<span class="qtracked-tag">★ QUÊTE ACTUELLEMENT SUIVIE</span>' : ''}
                  </div>
                  <div class="qdet-title">${esc(selQuest.name)}</div>
                  <div class="qdet-giver">Donneur : <b>${esc(selQuest.giver)}</b> · 📍 <i>${esc(selQuest.where)}</i></div>
                </div>
                ${selQuest.status !== 'done' ? `
                  <button type="button" class="qbtn-track${selQuest.isTracked ? ' tracked' : ''}" data-act="track">
                    ${selQuest.isTracked ? '★ NE PLUS SUIVRE' : '★ SUIVRE CETTE QUÊTE'}
                  </button>
                ` : ''}
              </div>

              <!-- Grand Boîtier OÙ ALLER -->
              <div class="qbox-destination">
                <div class="qdest-head">
                  <span class="qdest-pin">📍</span>
                  <span>OÙ ALLER / PROCHAINE DESTINATION :</span>
                </div>
                <div class="qdest-place">${esc(selQuest.destination)}</div>
                <div class="qdest-hint">${esc(selQuest.direction)}</div>
              </div>

              <!-- Étapes de la quête -->
              <div class="qsteps-box">
                <div class="qsteps-title">ÉTAPES DE LA QUÊTE (${selQuest.step} / ${selQuest.totalSteps})</div>
                ${selQuest.steps.map((st) => `
                  <div class="qstep-item${st.done ? ' done' : ''}${st.current ? ' current' : ''}">
                    <div class="qstep-mark">${st.done ? '☑' : st.current ? '▶' : '◻'}</div>
                    <div class="qstep-body">
                      <div class="qstep-txt">${esc(st.desc)}</div>
                      <div class="qstep-loc">📍 Destination : ${esc(st.destination)}</div>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Récompenses -->
              <div class="qreward-box">
                <span class="qreward-ico">🎁</span>
                <div><b>RÉCOMPENSE :</b> ${esc(selQuest.reward)}</div>
              </div>
            ` : '<div style="padding:30px;color:#8aa0be;text-align:center;">Sélectionne une quête dans la liste de gauche.</div>'}
          </div>
        </div>

        <div class="quests-foot">
          <div class="quests-foot-keys">
            <span><kbd>▲</kbd><kbd>▼</kbd> Naviguer</span>
            <span><kbd>◄</kbd><kbd>►</kbd> Changer d'onglet</span>
            <span><kbd>ESPACE</kbd> / <kbd>ENTRÉE</kbd> Suivre la quête</span>
            <span><kbd>X</kbd> / <kbd>ÉCHAP</kbd> Fermer</span>
          </div>
          <div class="quests-foot-tracked">
            <span class="qft-label">OBJECTIF SUIVI :</span>
            <span class="qft-val">${tracked ? `★ ${esc(tracked.name)} (📍 ${esc(tracked.destination)})` : 'Aucun'}</span>
          </div>
        </div>
      `;

      // Clics sur les cartes
      s.querySelectorAll('.qcard').forEach((card) => {
        card.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = +card.dataset.idx;
          if (selectedIdx !== idx) {
            selectedIdx = idx;
            ui.sound.sfx('blip');
            render();
          }
        });
      });

      // Clics sur les onglets
      s.querySelectorAll('.qtab').forEach((tab) => {
        tab.addEventListener('click', (e) => {
          e.stopPropagation();
          const t = tab.dataset.tab;
          if (currentTab !== t) {
            currentTab = t;
            selectedIdx = 0;
            ui.sound.sfx('blip');
            render();
          }
        });
      });

      // Clic bouton Suivre
      const trackBtn = s.querySelector('[data-act="track"]');
      if (trackBtn && selQuest) {
        trackBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          setTrackedQuest(game, selQuest.id);
          ui.sound.sfx('select');
          game.hud?.update(true);
          render();
        });
      }

      // Bouton fermeture
      const closeBtn = s.querySelector('[data-act="close"]');
      if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          closeScreen();
        });
      }
    };

    const closeScreen = () => {
      pop();
      s.remove();
      ui.sound.sfx('cancel');
      resolve();
    };

    const pop = ui.input.push((k) => {
      const allQuests = getAllQuests(game);
      let filtered = allQuests;
      if (currentTab === 'active') filtered = allQuests.filter((q) => q.status === 'active');
      else if (currentTab === 'done') filtered = allQuests.filter((q) => q.status === 'done');
      if (!filtered.length) filtered = allQuests;

      if (k === 'up') {
        selectedIdx = (selectedIdx - 1 + filtered.length) % filtered.length;
        ui.sound.sfx('blip');
        render();
      } else if (k === 'down') {
        selectedIdx = (selectedIdx + 1) % filtered.length;
        ui.sound.sfx('blip');
        render();
      } else if (k === 'left') {
        currentTab = currentTab === 'all' ? 'done' : currentTab === 'done' ? 'active' : 'all';
        selectedIdx = 0;
        ui.sound.sfx('blip');
        render();
      } else if (k === 'right') {
        currentTab = currentTab === 'active' ? 'done' : currentTab === 'done' ? 'all' : 'active';
        selectedIdx = 0;
        ui.sound.sfx('blip');
        render();
      } else if (k === 'a') {
        const selQuest = filtered[selectedIdx];
        if (selQuest && selQuest.status !== 'done') {
          setTrackedQuest(game, selQuest.id);
          ui.sound.sfx('select');
          game.hud?.update(true);
          render();
        }
      } else if (k === 'b') {
        closeScreen();
      }
    });

    render();
  });
}

