// Site Noir : l'interface par-dessus la 3D. Enquêteur : santé, souffle, lampe, cases, objectif, équipe. Monstre : énergie, griffes et pouvoirs, bruits autour du viseur.
// Et les écrans en HTML : accueil (choix du rôle), carte du rôle, pause, fin de partie.
import { ITEMS, FUSES, CD } from '../engine/sim.js';
import { T, Z, W, H, ZONE_NAMES, zoneAt } from '../engine/map.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const $ = (s) => document.querySelector(s);
const mmss = (t) => { const s = Math.max(0, Math.ceil(t)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const POWERS = [['lights', '1', '💡', 'Coupure', 'Éteint la zone où tu es'], ['jam', '2', '🔒', 'Blocage', 'Ferme et bloque la porte devant toi'], ['cam', '3', '📵', 'Casse-caméra', 'Détruit la caméra devant toi']];

export class HUD {
  constructor() {
    this.root = $('#hud');
    this.el = {};
    for (const id of ['banner', 'toast', 'feed', 'prompt', 'ptxt', 'ring', 'team', 'clock', 'goal', 'goal2', 'bars', 'slots', 'stick', 'flash', 'hurt', 'locker', 'cctv', 'cctvLabel', 'map', 'pings', 'hint', 'lockHint', 'spec', 'scan', 'card']) this.el[id] = $(`#${id}`);
    this.bannerT = 0; this.toastT = 0; this.flashT = 0; this.hurtT = 0; this.pingL = []; this.sigTeam = ''; this.sigSlots = ''; this.sigGoal = ''; this.cardT = 0;
    this.mapCtx = this.el.map.getContext('2d');
    this.mapBase = null;
  }
  show(on) { this.root.hidden = !on; }
  banner(html, dur = 1.8, cls = '') {
    const b = this.el.banner;
    b.innerHTML = html; b.className = 'banner ' + cls; b.hidden = false;
    void b.offsetWidth; b.classList.add('in');
    this.bannerT = dur;
  }
  toast(msg, dur = 2.5) { this.el.toast.textContent = msg; this.el.toast.hidden = false; this.toastT = dur; }
  feed(html) {
    const d = document.createElement('div'); d.className = 'fi'; d.innerHTML = html;
    this.el.feed.prepend(d);
    while (this.el.feed.children.length > 5) this.el.feed.lastChild.remove();
    setTimeout(() => d.classList.add('out'), 5200); setTimeout(() => d.remove(), 6000);
  }
  flash(v = 1) { this.flashT = v; }
  hurt(v = 1) { this.hurtT = v; }
  ping(x, z, r) { this.pingL.push({ x, z, r, t: 3.2 }); if (this.pingL.length > 10) this.pingL.shift(); }
  roleCard(role) { this.el.card.innerHTML = roleCardHtml(role); this.el.card.hidden = false; this.cardT = 9; }
  hideCard() { this.el.card.hidden = true; this.cardT = 0; }

  update(v, dt, { goal, input, real, cctv, mapOpen, M }) {
    const e = this.el, me = real, w = v.w, isM = me && me.role === 'm';
    this.root.dataset.role = isM ? 'm' : 's';
    if ((this.bannerT -= dt) <= 0 && !e.banner.hidden) { e.banner.classList.remove('in'); if (this.bannerT < -0.4) e.banner.hidden = true; }
    if ((this.toastT -= dt) <= 0) e.toast.hidden = true;
    if (this.cardT > 0 && (this.cardT -= dt) <= 0) this.hideCard();
    this.flashT = Math.max(0, this.flashT - dt * 1.6); e.flash.style.opacity = (this.flashT * this.flashT).toFixed(3);
    this.hurtT = Math.max(0, this.hurtT - dt * 1.3);
    const lowHp = me && me.role === 's' && me.st === 'ok' ? Math.max(0, 1 - me.hp / 60) * 0.5 : me && me.st === 'down' ? 0.85 : 0;
    e.hurt.style.opacity = Math.max(this.hurtT, lowHp).toFixed(3);

    // équipe
    const team = v.players.filter((p) => !p.spectator && p.role === 's');
    const sigTeam = team.map((p) => `${p.id}:${p.st}:${p.hide >= 0 ? (isM ? 0 : 1) : 0}:${p.name}:${Math.round(p.hp / 20)}:${p.proofs}`).join('|') + (isM ? 'm' : 's');
    if (sigTeam !== this.sigTeam) {
      this.sigTeam = sigTeam;
      e.team.innerHTML = team.map((p) => {
        const ico = p.st === 'dead' ? '💀' : p.st === 'out' ? '🚁' : p.st === 'down' ? '🩸' : !isM && p.hide >= 0 ? '🚪' : '';
        const hp = p.st === 'ok' && !isM ? `<span class="hp"><i style="width:${Math.max(0, Math.round(p.hp))}%"></i></span>` : '';
        return `<div class="chip ${p.st} ${me && p.id === me.id ? 'me' : ''}" style="--c:${esc(p.color)}"><b>${esc(p.name)}</b>${ico ? `<em>${ico}</em>` : ''}${hp}${!isM && p.proofs ? `<em class="pf">📷 ${p.proofs}</em>` : ''}</div>`;
      }).join('');
    }
    // chrono et objectif
    e.clock.textContent = mmss(w.tl); e.clock.classList.toggle('warn', w.tl < 60);
    const gs = goal.a + '\n' + goal.b;
    if (gs !== this.sigGoal) { this.sigGoal = gs; e.goal.textContent = goal.a; e.goal2.textContent = goal.b; e.goal2.hidden = !goal.b; }

    // barres
    if (me && me.st !== 'dead' && me.st !== 'out' && !me.spectator) {
      e.bars.hidden = false;
      if (isM) e.bars.innerHTML = bar('⚡', 'Élan', me.energy * 100, 'nrg', me.energy < 0.1);
      else e.bars.innerHTML = bar('❤️', 'Santé', me.hp, 'hpb', me.hp < 40) + bar('💨', 'Souffle', me.stam, 'stam', me.stam < 15) + bar('🔦', 'Lampe', me.batt, 'batt', me.batt < 20);
    } else e.bars.hidden = true;

    // cases ou pouvoirs
    if (isM) {
      const sig = 'm' + POWERS.map(([k]) => Math.ceil(me.cd[k] || 0)).join() + Math.ceil(me.sated || 0) + Math.ceil(me.cd.atk * 2);
      if (sig !== this.sigSlots) {
        this.sigSlots = sig;
        const claw = me.sated > 0 ? `<div class="slot pw off"><b>🩸</b><small>Repu · ${Math.ceil(me.sated)} s</small></div>` : `<div class="slot pw ${me.cd.atk > 0 ? 'off' : 'rdy'}"><kbd>Clic</kbd><b>🩸</b><small>Griffes</small></div>`;
        e.slots.innerHTML = claw + POWERS.map(([k, key, ico, name]) => {
          const c = me.cd[k] || 0;
          return `<div class="slot pw ${c > 0 ? 'off' : 'rdy'}" title="${name}"><kbd>${key}</kbd><b>${ico}</b><small>${c > 0 ? `${Math.ceil(c)} s` : name}</small>${c > 0 ? `<u style="height:${Math.round(c / CD[k] * 100)}%"></u>` : ''}</div>`;
        }).join('');
      }
    } else if (me && me.inv) {
      const sig = 's' + JSON.stringify(me.inv) + me.sel + me.torch;
      if (sig !== this.sigSlots) {
        this.sigSlots = sig;
        e.slots.innerHTML = `<div class="slot ${me.torch ? 'lit' : ''}"><kbd>F</kbd><b>🔦</b><small>${me.torch ? 'Allumée' : 'Éteinte'}</small></div>` + me.inv.map((s, i) => {
          const def = s && ITEMS[s.k];
          return `<div class="slot ${i === me.sel ? 'sel' : ''} ${s ? '' : 'none'}"><kbd>${i + 1}</kbd><b>${def ? def.icon : ''}</b><small>${def ? esc(def.name) : 'Vide'}</small>${s && s.n > 1 ? `<em>${s.n}</em>` : ''}</div>`;
        }).join('');
      }
    } else e.slots.innerHTML = '';

    // aide de l'objet tenu
    const held = me && me.role === 's' && me.st === 'ok' && me.inv?.[me.sel];
    const helpTxt = held && ITEMS[held.k] ? ITEMS[held.k].use : '';
    e.hint.textContent = helpTxt; e.hint.hidden = !helpTxt || cctv;

    // invite d'action
    const tg = v.target;
    if (tg && !cctv) {
      e.prompt.hidden = false;
      const key = tg.ok === false ? '' : `<kbd>E</kbd> `;
      const txt = `${tg.hold ? (key ? '<kbd>E</kbd> maintenir · ' : '') : key}${esc(tg.label)}`;
      if (txt !== e.prompt._t) { e.ptxt.innerHTML = txt; e.prompt._t = txt; }
      e.prompt.classList.toggle('no', tg.ok === false);
      const f = tg.hold ? Math.min(1, me.holdFrac || 0) : 0;
      e.ring.style.opacity = tg.hold && f > 0 ? 1 : 0;
      e.ring.style.setProperty('--f', `${(f * 360).toFixed(0)}deg`);
    } else { e.prompt.hidden = true; e.ring.style.opacity = 0; }
    // relevé EMF
    if (me && me.scan > 0 && me.role === 's') { e.scan.hidden = false; e.scan.style.setProperty('--f', `${(me.scan / 3 * 100).toFixed(0)}%`); } else e.scan.hidden = true;

    // cachette
    e.locker.hidden = !(me && me.hide >= 0) || !!cctv;
    // caméras
    e.cctv.hidden = !cctv;
    if (cctv) e.cctvLabel.textContent = cctv.label;
    // regarder par-dessus une épaule
    const spec = v.mine ? '' : v.me ? `Tu regardes ${esc(v.me.name)} · clic : suivant` : 'Spectateur';
    if (spec !== e.spec._t) { e.spec.innerHTML = spec; e.spec._t = spec; e.spec.hidden = !spec; }
    // joystick tactile
    const st = input.stick();
    e.stick.hidden = !st;
    if (st) { e.stick.style.left = st.ox + 'px'; e.stick.style.top = st.oy + 'px'; const dx = st.x - st.ox, dy = st.y - st.oy, d = Math.hypot(dx, dy) || 1, k = Math.min(1, 40 / d); e.stick.firstChild.style.transform = `translate(${dx * k}px,${dy * k}px)`; }
    // clic pour capturer la souris
    e.lockHint.hidden = input.locked || input.free || !!document.body.classList.contains('touch');

    // bruits autour du viseur (monstre)
    this.pingL = this.pingL.filter((p) => (p.t -= dt) > 0);
    if (isM && me) {
      const parts = this.pingL.map((p) => {
        const a = Math.atan2(p.x - me.x, -(p.z - me.z)) + v.yawFor, d = Math.hypot(p.x - me.x, p.z - me.z), R = 110 + Math.min(1, d / 40) * 55;
        return `<i style="transform:rotate(${a.toFixed(2)}rad) translateY(-${R.toFixed(0)}px);opacity:${Math.min(1, p.t).toFixed(2)};--s:${(p.r >= 25 ? 1.6 : p.r >= 12 ? 1.2 : 0.8)}"></i>`;
      });
      e.pings.innerHTML = parts.join('');
    } else if (e.pings.firstChild) e.pings.innerHTML = '';

    // plan
    e.map.hidden = !mapOpen;
    if (mapOpen) this.drawMap(M, v, me);
  }

  drawMap(M, v, me) {
    const c = this.el.map, g = this.mapCtx, S = 9;
    const w = v.w;
    if (!this.mapBase) {
      const b = document.createElement('canvas'); b.width = W * S; b.height = H * S;
      const x = b.getContext('2d');
      const COL = { [Z.OUTPOST]: '#36503a', [Z.PAD]: '#3b4d66', [Z.A]: '#5a5240', [Z.B]: '#3e5552', [Z.SOUS]: '#4c4640', [Z.CABINE]: '#696969' };
      for (let z = 0; z < H; z++) for (let i = 0; i < W; i++) { const t = M.t[z * W + i]; if (t === T.FLOOR || t === T.PROP) { x.fillStyle = t === T.PROP ? '#2c2a26' : (COL[M.zone[z * W + i]] || '#444'); x.fillRect(i * S, z * S, S, S); } }
      x.font = '700 11px Nunito, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.7)';
      for (const r of M.rooms) if (r.x1 - r.x0 >= 6) x.fillText(r.name, r.cx * S, r.cz * S + 4, (r.x1 - r.x0) * S);
      this.mapBase = b;
    }
    if (c.width !== W * S) { c.width = W * S; c.height = H * S; }
    g.clearRect(0, 0, c.width, c.height); g.drawImage(this.mapBase, 0, 0);
    M.doors.forEach((d, i) => {
      const st = w.doors[i], key = d.key && !st.unlocked;
      g.fillStyle = st.jam > 0 ? '#c040ff' : key ? (d.key === 'bleu' ? '#2d7ff0' : '#f08a1d') : st.open ? '#2fd46a' : '#d8d2c0';
      g.fillRect((d.x - (d.axis === 'x' ? d.cells.length / 2 : 0.3)) * S, (d.z - (d.axis === 'x' ? 0.3 : d.cells.length / 2)) * S, (d.axis === 'x' ? d.cells.length : 0.6) * S, (d.axis === 'x' ? 0.6 : d.cells.length) * S);
    });
    const mark = (x, z, t) => { g.font = '16px sans-serif'; g.textAlign = 'center'; g.fillText(t, x * S, z * S + 6); };
    mark(M.generator.x, M.generator.z, w.genOn ? '⚡' : '🔧');
    mark(M.liftCall.x, M.liftCall.z, '🛗');
    if (me.role === 's') { mark(M.padCenter.x, M.padCenter.z, '🚁'); for (const cam of w.cams) mark(cam.x, cam.z, '🎥'); }
    if (me.role === 'm') for (const p of this.pingL) { g.strokeStyle = `rgba(255,70,50,${Math.min(1, p.t)})`; g.lineWidth = 2; g.beginPath(); g.arc(p.x * S, p.z * S, (4 - p.t) * 6 + 3, 0, 7); g.stroke(); }
    for (const p of v.players) {
      if (p.spectator || p.st === 'dead' || p.st === 'out') continue;
      const self = p.id === me.id;
      if (!self && (me.role === 'm' || p.role === 'm')) continue;
      g.save(); g.translate(p.x * S, p.z * S); g.rotate(-p.yaw);
      g.fillStyle = p.color; g.strokeStyle = '#fff'; g.lineWidth = self ? 2 : 1;
      g.beginPath(); g.moveTo(0, -9); g.lineTo(6, 6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke();
      g.restore();
    }
  }
}
const bar = (ico, name, v, cls, low) => `<div class="bar ${cls} ${low ? 'low' : ''}" title="${name}"><span>${ico}</span><u><i style="width:${Math.max(0, Math.min(100, v)).toFixed(0)}%"></i></u></div>`;

// ------------------------------------------------------------------ objectif affiché, selon l'avancement
export function goalOf(M, w, me, teamProofs) {
  if (!me) return { a: '', b: '' };
  const pct = Math.floor(w.gen);
  if (me.role === 'm') {
    if (me.wake > 0) return { a: `En cage : tu sors dans ${Math.ceil(me.wake)} s`, b: 'Personne ne sait que tu es là' };
    if (me.st === 'ok' && me.stun > 0) return { a: 'Aveuglé !', b: '' };
    if (w.genOn) return { a: 'Le courant est revenu : ils remontent', b: 'Attrape-les dans le hall de l\'ascenseur' };
    return { a: 'Chasse-les : écoute, le bruit s\'affiche autour du viseur', b: w.parts >= FUSES ? `Générateur à ${pct} % : va le saboter` : `Fusibles branchés : ${w.parts}/${FUSES}` };
  }
  if (me.st === 'dead') return { a: 'Tu es mort', b: 'Regarde les autres finir' };
  if (me.st === 'out') return { a: 'Tu es sorti du site', b: '' };
  if (me.st === 'down') return { a: me.downs >= 2 ? `À terre : il te reste ${Math.ceil(me.downT)} s` : `À terre : tu te relèves dans ${Math.ceil(me.downT)} s`, b: me.downs >= 2 ? 'Un équipier peut te relever' : 'Rampe à l\'abri' };
  const blue = M.doors.findIndex((d) => d.key === 'bleu'), orange = M.doors.findIndex((d) => d.key === 'orange');
  const proofs = teamProofs ? `Preuves de l'équipe : ${teamProofs}` : 'Aucune preuve : photographie, ou scanne une trace au capteur EMF';
  if (w.t < 25) return { a: 'Équipe-toi dans les caisses, puis passe le sas', b: 'Appareil photo, capteur EMF, caméras, tablette, piles' };
  if (!w.doors[blue].unlocked) return { a: 'Aile A : fouille les meubles, trouve le badge bleu', b: proofs };
  if (!w.doors[orange].unlocked) return { a: 'Aile B : fouille les meubles, trouve la clé des machines', b: proofs };
  if (w.parts < FUSES) return { a: `Trouve des fusibles et branche-les au générateur : ${w.parts}/${FUSES}`, b: proofs };
  if (!w.genOn) return { a: `Répare le générateur : ${pct} %`, b: 'Ça fait du bruit. Il va venir.' };
  const L = w.lift;
  if (L.state === 'idle' && L.at === 'top' && L.calls === 0) return { a: 'Appelle l\'ascenseur depuis le hall du sous-sol', b: proofs };
  if (L.state === 'moving' && L.dir < 0) return { a: 'L\'ascenseur descend : tiens bon', b: proofs };
  if (zoneAt(M, me.x, me.z) === Z.OUTPOST || L.at === 'top' && me.y > -1) return { a: 'Cours à la zone d\'extraction', b: teamProofs ? proofs : 'Il vous faut au moins une preuve' };
  return { a: 'Monte dans l\'ascenseur et remonte', b: proofs };
}

// ------------------------------------------------------------------ écrans
const KEYS_S = [
  ['Avancer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Maj</kbd> courir · <kbd>C</kbd> accroupi'],
  ['Utiliser (maintenir pour fouiller, réparer, relever)', '<kbd>E</kbd> ou clic droit'],
  ['Objet tenu', 'clic gauche · <kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> changer · <kbd>G</kbd> lâcher'],
  ['Lampe · pile', '<kbd>F</kbd> · <kbd>R</kbd>'],
  ['Plan', '<kbd>Tab</kbd>'],
];
const KEYS_M = [
  ['Avancer', '<kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Maj</kbd> foncer'],
  ['Griffes', 'clic gauche'],
  ['Portes, casiers, sabotage, achever', '<kbd>E</kbd> ou clic droit'],
  ['Pouvoirs', '<kbd>1</kbd> coupure · <kbd>2</kbd> blocage · <kbd>3</kbd> caméra'],
  ['Plan', '<kbd>Tab</kbd>'],
];
export const settingsKeys = (touch) => [...KEYS_S.map(([a, b]) => [`Enquêteur · ${a}`, b]), ...KEYS_M.map(([a, b]) => [`Monstre · ${a}`, b])];
function roleCardHtml(role) {
  const m = role === 'm';
  return `<h3>${m ? 'Tu es le monstre' : 'Tu es enquêteur'}</h3><p>${m
    ? 'Personne ne doit remonter. Tu vois dans le noir, et les corps chauds brillent. Tu ne peux ni entrer dans l\'avant-poste ni prendre l\'ascenseur.'
    : 'Trouve le badge, la clé, les fusibles. Relance le générateur, prends l\'ascenseur, et remonte avec au moins une preuve.'}</p>${(m ? KEYS_M : KEYS_S).map(([a, b]) => `<div class="k"><span>${a}</span><span>${b}</span></div>`).join('')}`;
}
const seg = (k, label, opts, cur) => `<div class="seg"><span>${label}</span><div>${opts.map(([v, t]) => `<button data-k="${k}" data-v="${esc(v)}" class="${String(cur) === String(v) ? 'sel' : ''}">${esc(t)}</button>`).join('')}</div></div>`;
export function briefingHtml({ role, squad, cfg, embedded, investigators }) {
  const host = role !== 'guest';
  const humans = squad.filter((p) => p.ready);
  const alone = humans.length <= 1;
  const me = squad.find((p) => p.me);
  const monsterOpts = alone
    ? [['bot', 'Enquêteur'], [me ? me.id : 0, 'Monstre'], ['random', 'Au hasard']]
    : [['random', 'Au hasard'], ['bot', 'Un bot'], ...humans.map((p) => [p.id, p.name])];
  const cur = alone && cfg.monster === 'host' ? (me ? me.id : 0) : cfg.monster;
  return `<div class="brief">
    <h1 class="logo">SITE <span>NOIR</span></h1>
    <p class="sub">Une équipe entre dans un complexe abandonné pour en ramener une preuve. Quelque chose y est enfermé, et il se réveille dans une minute et demie.</p>
    <div class="cols">
      <div>
        <h3>Équipe</h3>
        <ul class="squad">${squad.map((p) => `<li class="${p.ready ? '' : 'wait'}" style="--c:${esc(p.color)}"><i></i>${esc(p.name)}${p.me ? ' <small>(toi)</small>' : ''}${p.ready ? '' : ' <small>arrive…</small>'}</li>`).join('')}${investigators > 0 ? `<li class="bot"><i></i>${investigators} enquêteur${investigators > 1 ? 's' : ''} bot${investigators > 1 ? 's' : ''}</li>` : ''}</ul>
        ${host ? `<div class="segs">
          ${seg('monster', alone ? 'Ton camp' : 'Le monstre', monsterOpts, cur)}
          ${seg('places', 'Enquêteurs', [[3, '3'], [4, '4']], cfg.places)}
          ${seg('level', 'Niveau des bots', [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']], cfg.level)}
          ${seg('duree', 'Durée', [[10, '10 min'], [15, '15 min'], [20, '20 min']], cfg.duree)}
        </div>` : '<p class="wait">Les rôles tombent au lancement. L\'hôte choisit le monstre.</p>'}
      </div>
      <div class="rules">
        <h3>Enquêteurs</h3>
        <p>Badge, clé, trois fusibles, générateur, ascenseur : remontez avec au moins une preuve. Une lampe, une batterie, trois cases.</p>
        <h3>Monstre</h3>
        <p>Il voit dans le noir, coupe les lumières, bloque les portes, casse les caméras. Il gagne si personne ne sort.</p>
      </div>
    </div>
    <div class="btns">
      ${host ? '<button class="btn go" id="btnGo">Entrer</button>' : '<p class="wait">En attente de l\'hôte…</p>'}
      ${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}
    </div>
  </div>`;
}
export function menuHtml({ solo, embedded }) {
  return `<div class="menu"><h2>${solo ? 'Pause' : 'Menu'}</h2>
    <button class="btn go" id="btnResume">Reprendre</button>
    <button class="btn" id="btnSettings">Réglages</button>
    <button class="btn ghost" id="btnQuit">${embedded ? 'Retour au salon' : 'Quitter'}</button>
    ${solo ? '' : '<p class="wait">La partie continue pendant ce temps.</p>'}</div>`;
}
const END_TXT = { dead: 'Mort', out: 'Sorti', ok: 'Resté', down: 'Resté' };
export function endHtml({ win, purge, ranking, myId, canReplay, embedded, reason }) {
  if (reason === 'host') return `<div class="end"><h2 class="logo small">Liaison perdue</h2><p class="sub">L'hôte a disparu.</p><div class="btns">${embedded ? '<button class="btn" id="btnExit">Retour au salon</button>' : ''}</div></div>`;
  const me = ranking.find((p) => p.id === myId);
  const won = me ? me.won : false;
  const title = win === 's' ? 'Ils sont sortis' : purge ? 'Site purgé' : 'Personne n\'est sorti';
  const sub = win === 's' ? 'Les preuves sont entre de bonnes mains. Le monstre reste enfermé, pour l\'instant.' : purge ? 'Le temps est écoulé : le site a été scellé, avec ceux qui étaient dedans.' : 'Le silence est revenu sur le site.';
  return `<div class="end ${won ? 'won' : 'lost'}">
    <h2 class="logo small">${title}</h2>
    <p class="sub">${me ? (won ? '<b>Victoire.</b> ' : '<b>Défaite.</b> ') : ''}${sub}</p>
    <table class="stats"><thead><tr><th>Joueur</th><th>Rôle</th><th>Fin</th><th>Preuves</th><th>Tués</th><th>Score</th></tr></thead><tbody>
    ${ranking.map((p) => `<tr class="${p.id === myId ? 'me' : ''}" style="--c:${esc(p.color)}"><td><i></i>${esc(p.name)}${p.bot ? ' <small>bot</small>' : ''}</td><td>${p.role === 'm' ? 'Monstre' : 'Enquêteur'}</td><td>${p.role === 'm' ? (p.won ? 'Vainqueur' : 'Enfermé') : END_TXT[p.st] || ''}</td><td>${p.role === 'm' ? '–' : p.proofs}</td><td>${p.role === 'm' ? p.kills : '–'}</td><td>${p.score}</td></tr>`).join('')}
    </tbody></table>
    <div class="btns">${canReplay ? '<button class="btn go" id="btnAgain">Rejouer</button>' : '<p class="wait">L\'hôte peut relancer une partie.</p>'}${embedded ? '<button class="btn ghost" id="btnExit">Retour au salon</button>' : ''}</div>
  </div>`;
}
