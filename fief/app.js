// Fief Maudit : démarrage et boucle de jeu. Étape 3 du développement (docs/FIEF-MAUDIT.md) : le jour on coupe du bois,
// la nuit tombe, la brume monte, les squelettes sortent du sol et marchent sur le village ; on les repousse avec un
// coéquipier IA en gardant les braseros allumés. Chacun joue dans sa propre vallée pour l'instant, même lancé depuis
// un salon : le jeu à plusieurs arrive avec l'étape 4.
// Adresse : ?seed=… (vallée), ?bots=0..2, ?debug (expose window.__fief), ?autostart, ?manual (images à la demande).
import { Sim, DT, GOALS, emptyInput, HP, WAREHOUSE_HP, CYCLE } from './engine/sim.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (s) => { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

const S = { me: 0, name: 'Toi', paused: true, started: false, acc: 0, last: 0, t: 0, goal: -1, stepDist: 0, bots: 1, ended: false, wallHitT: 0 };
const sfx = new Sfx();
const scene = createScene($('stage'), { onLost: () => location.reload() });
const canvas = scene.renderer.domElement;
const input = new Input(canvas, {
  gesture: () => sfx.start(),
  menu: () => (S.paused ? (S.started && !S.ended && resume()) : openMenu()),
  mute: () => toggleMute(),
  // Échap libère la souris sans que la page voie la touche : on ouvre le menu
  unlocked: () => { if (S.started && !S.paused && !input.free) openMenu(); },
});
input.bindTouch(document.querySelector('.tbtns'));
$('btnMenu').onclick = () => openMenu();
$('btnMute').onclick = () => toggleMute();
const toggleMute = () => { const m = sfx.toggleMute(); $('btnMute').classList.toggle('off', m); };
$('btnMute').classList.toggle('off', sfx.muted);

const seed = +(QS.get('seed') || 0) || 1;
let sim = null, startSnap = null;

// ------------------------------------------------------------------ démarrage
async function boot() {
  if (H.embedded) {
    await new Promise((res) => { if (H.initDone) res(); else H.on('init', () => res()); setTimeout(res, 2500); });
    S.me = H.info.myId ?? 0;
    const me = (H.players || []).find((p) => p.id === S.me);
    if (me && me.name) S.name = me.name;
    const b = H.info.settings && H.info.settings.bots;
    if (b !== undefined && b !== null) S.bots = +b;
    H.signalReady();
  }
  if (QS.has('bots')) S.bots = +QS.get('bots');
  sim = new Sim({ seed, players: [{ id: S.me, name: S.name, job: 'bucheron', color: '#e0a040' }], bots: S.bots });
  startSnap = sim.snapshot();
  try {
    await scene.load(sim.map, { onProgress: (k) => { $('loadBar').style.width = Math.round(k * 100) + '%'; } });
  } catch (e) {
    console.error(e); $('loadTxt').textContent = 'Le chargement a échoué. Recharge la page.'; return;
  }
  $('loadBar').style.width = '100%';
  scene.update(view(), 0, 0);
  $('loading').classList.add('out'); setTimeout(() => $('loading').remove(), 700);
  $('hud').hidden = false;
  setGoal(0);
  if (QS.has('autostart') || QS.has('debug')) { S.started = true; S.paused = false; }
  else intro();
  S.last = performance.now();
  requestAnimationFrame(frame);
}

function intro() {
  S.paused = true;
  const shared = H.embedded && (H.players || []).length > 1;
  const mate = sim.players.find((p) => p.bot);
  showScreen(`<div class="sheet">
    <h2>Jour 1 — Le bois</h2>
    <p class="sub">La malédiction a vidé la vallée. Il ne reste que vous, un feu de camp et un village en ruine.</p>
    <p>Le jour, abats les arbres et rentre le bois à l'entrepôt, la grande bâtisse au toit de tuiles. Avant la nuit, charge les braseros : quand la brume monte, les morts sortent du sol, et seuls ceux qui tombent dans la lumière restent à terre.${mate ? ` ${esc(mate.name)}, ton chevalier, se bat à tes côtés.` : ''}</p>
    <div class="keys">
      <span><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Se déplacer (la souris tourne la caméra)</span>
      <span><kbd>Clic</kbd></span><span>Coup de hache (arbre ou squelette)</span>
      <span><kbd>E</kbd></span><span>Ramasser, ranger, charger un brasero · <b>tenir</b> pour relever un équipier</span>
      <span><kbd>Espace</kbd> · <kbd>Ctrl</kbd></span><span>Sauter · marcher</span>
      <span><kbd>Molette</kbd> · <kbd>Échap</kbd></span><span>Zoom · menu</span>
    </div>
    ${shared ? '<p class="note">Version en construction : pour l\'instant chacun joue dans sa propre vallée. Le jeu à plusieurs arrive bientôt.</p>' : '<p class="note">Version en construction : le jeu à plusieurs, les métiers et la construction arrivent dans les prochaines étapes.</p>'}
    <div class="row"><button class="btn go" id="go">Prendre la hache</button></div>
  </div>`);
  $('go').onclick = () => { S.started = true; resume(); };
}
function openMenu() {
  if (!S.started || S.ended) return;
  S.paused = true; input.unlock();
  const canSkip = sim.clock.phase === 'jour' && sim.clock.t < CYCLE.day - CYCLE.dusk;
  showScreen(`<div class="sheet">
    <h2>Pause</h2>
    <p class="sub">${esc(S.name)} · Bûcheron · Jour ${sim.clock.day} · ${sim.stock.bois} bûche${sim.stock.bois > 1 ? 's' : ''} à l'entrepôt</p>
    <label>Sensibilité de la souris <input type="range" id="sens" min="0.3" max="3" step="0.1" value="${input.sens}"></label>
    <div class="row">
      ${canSkip ? '<button class="btn" id="skip">Avancer jusqu\'au soir</button>' : ''}
      ${H.embedded ? '<button class="btn" id="quit">Retour au salon</button>' : ''}
      <button class="btn go" id="back">Reprendre</button>
    </div>
  </div>`);
  $('sens').oninput = (e) => input.setSens(+e.target.value);
  $('back').onclick = () => resume();
  if ($('skip')) $('skip').onclick = () => { sim.skipToDusk(); resume(); };
  if ($('quit')) $('quit').onclick = () => H.exit();
}
function showScreen(html) { const s = $('screen'); s.innerHTML = html; s.hidden = false; }
function resume() {
  $('screen').hidden = true; S.paused = false; $('lockHint').hidden = true;
  sfx.start();
  if (!document.body.classList.contains('touch')) input.lock();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && S.started && !S.paused && !QS.has('debug')) openMenu(); });

// fin de partie : l'entrepôt est tombé, ou toute l'équipe est à terre
function gameOver(reason) {
  S.ended = true; S.paused = true; input.unlock();
  sfx.play('sol', { vol: 1, rate: 0.5 });
  const why = reason === 'entrepot' ? 'Les morts ont enfoncé l\'entrepôt : le bois du village est perdu.' : 'Toute l\'équipe est à terre. Personne pour rallumer les braseros.';
  showScreen(`<div class="sheet">
    <h2>Le village est tombé</h2>
    <p class="sub">Nuit ${sim.clock.day} · ${sim.stats.kills} squelette${sim.stats.kills > 1 ? 's' : ''} abattu${sim.stats.kills > 1 ? 's' : ''}</p>
    <p>${why}</p>
    <div class="row">
      <button class="btn" id="restart">Recommencer du début</button>
      ${sim.duskSnap ? '<button class="btn go" id="retry">Rejouer la nuit</button>' : ''}
    </div>
  </div>`);
  const back = (snap) => {
    // les arbres déjà abattus le restent (ils ne repoussent pas à l'écran)
    const s = structuredClone(snap); s.trees = sim.trees;
    sim.restore(s); scene.actors.reset();
    S.ended = false; S.goal = -1; setGoal(sim.goal); lastHud = '';
    resume();
  };
  if ($('retry')) $('retry').onclick = () => back(sim.duskSnap);
  $('restart').onclick = () => back(startSnap);
}

// ------------------------------------------------------------------ boucle
function view() { return { sim, me: S.me, camYaw: input.yaw, camPitch: input.pitch, zoom: input.zoom }; }
function stepOnce() {
  const k = input.sample(DT);
  const Y = input.yaw, fx = -Math.sin(Y), fz = -Math.cos(Y), rx = Math.cos(Y), rz = -Math.sin(Y);
  sim.setInput(S.me, { ...emptyInput(), wx: fx * k.my + rx * k.mx, wz: fz * k.my + rz * k.mx, walk: k.walk, jump: k.jump, hold: k.hold, fc: k.fc, uc: k.uc });
  sim.step();
  for (const e of sim.takeEvents()) onEvent(e);
}
const MANUAL = QS.has('manual');
function frame(now) {
  if (!MANUAL) requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - S.last) / 1000)); S.last = now;
  if (!S.paused) {
    S.acc += dt;
    let n = 0;
    while (S.acc >= DT && n++ < 6 && !S.ended) { stepOnce(); S.acc -= DT; }
    if (S.acc > DT) S.acc = 0;
  }
  S.t += dt;
  scene.update(view(), S.paused ? 0 : dt, S.t);
  hud(dt);
}

// ------------------------------------------------------------------ événements : sons, arbres, interface
function distTo(x, z) { const c = scene.camera.position; return Math.hypot(c.x - x, c.z - z); }
function banner(html, cls = '') { const el = $('banner'); el.innerHTML = html; el.className = 'banner ' + cls; el.hidden = false; clearTimeout(banner.t); banner.t = setTimeout(() => { el.hidden = true; }, 3300); }
function onEvent(e) {
  const p = e.pid !== undefined && e.pid !== null ? sim.player(e.pid) : null;
  const d = p ? distTo(p.x, p.z) : 0;
  const fd = e.x !== undefined ? distTo(e.x, e.z) : d;
  const mine = p && p.id === S.me;
  switch (e.t) {
    case 'swing': sfx.play('souffle', { vol: 0.6, dist: d }); break;
    case 'hit': sfx.play('souffle', { vol: 0.4, dist: d }); sfx.play('hache', { vol: 1, dist: d }); break;
    case 'strike': sfx.play('souffle', { vol: 0.4, dist: d }); sfx.play('os', { vol: 1, dist: fd }); break;
    case 'block': sfx.play('bouclier', { vol: 0.9, dist: fd }); break;
    case 'fall': {
      const t = sim.map.trees[e.tree];
      scene.treeFell(sim, e.tree, e.dir);
      sfx.play('craque', { vol: 0.8, dist: distTo(t.x, t.z), rate: 0.8 });
      sfx.play('arbre', { vol: 1, dist: distTo(t.x, t.z), delay: 0.9 });
      sfx.play('sol', { vol: 0.9, dist: distTo(t.x, t.z), delay: 1.45, rate: 0.7 });
      if (mine) toast('Timber !');
      break;
    }
    case 'pick': case 'take': sfx.play('tronc', { vol: 0.6, dist: d }); break;
    case 'drop': sfx.play('sol', { vol: 0.7, dist: d }); break;
    case 'store': sfx.play('tronc', { vol: 0.9, dist: d }); if (mine) { sfx.play('ui', { vol: 0.35, delay: 0.1 }); toast('+1 bûche'); } bump('sBois'); break;
    case 'feed': sfx.play('feu', { vol: 0.9, dist: d }); if (mine) toast('Le brasero flambe'); break;
    case 'land': sfx.play('herbe', { vol: 0.8, dist: d }); break;
    case 'goal': setGoal(e.goal); sfx.play('ui', { vol: 0.5 }); break;
    case 'dusk': banner('Le soleil se couche<small>Charge les braseros : la nuit arrive</small>'); sfx.play('cloche', { vol: 0.8 }); break;
    case 'night': banner(`Nuit ${e.n}<small>La brume monte. Les morts se lèvent.</small>`, 'night'); sfx.play('cloche', { vol: 1, rate: 0.8 }); sfx.night(true); break;
    case 'dawn': banner(`L'aube !<small>Nuit ${e.n} tenue · les morts retournent à la poussière</small>`); sfx.play('aube', { vol: 0.8 }); sfx.night(false); break;
    case 'spawn': sfx.play('terre', { vol: 0.9, dist: fd, rate: 0.8 }); break;
    case 'rise': { const f = sim.foe(e.foe); sfx.play('craque', { vol: 0.7, dist: f ? distTo(f.x, f.z) : 30, rate: 1.3 }); break; }
    case 'kill': { const f = sim.foe(e.foe); sfx.play('os', { vol: 0.8, dist: f ? distTo(f.x, f.z) : 20, rate: 0.7 }); if (e.pid === S.me && !e.lit) toast('Il se relèvera dans la brume…'); break; }
    case 'hurt': sfx.play('coup', { vol: mine ? 1 : 0.6, dist: d }); if (mine) { document.body.classList.add('hurt'); clearTimeout(onEvent.h); onEvent.h = setTimeout(() => document.body.classList.remove('hurt'), 250); } break;
    case 'down': if (mine) sfx.play('sol', { vol: 1, rate: 0.6 }); else banner(`${esc(p.name)} est à terre<small>Tiens E près de lui pour le relever</small>`); break;
    case 'up': sfx.play('ui', { vol: 0.5 }); if (mine) toast('Debout !'); break;
    case 'dead': if (mine) banner('Tu es tombé<small>Tu reviendras au feu de camp à l\'aube</small>', 'night'); break;
    case 'brazierHit': sfx.play('bouclier', { vol: 0.5, dist: distTo(sim.map.braziers[e.brazier].x, sim.map.braziers[e.brazier].z), rate: 0.7 }); break;
    case 'wallHit': S.wallHitT = 0.4; sfx.play('hache', { vol: 0.5, dist: distTo(sim.map.warehouse.x, sim.map.warehouse.z), rate: 0.6 }); break;
    case 'over': gameOver(e.reason); break;
  }
}
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function setGoal(g) {
  if (g === S.goal) return;
  S.goal = g;
  const G = GOALS[g], el = $('goal');
  $('goalTxt').textContent = G.text; $('goalHint').textContent = G.hint;
  el.classList.remove('new'); void el.offsetWidth; el.classList.add('new');
}

let lastHud = '';
function hud(dt) {
  if (!sim) return;
  const p = sim.player(S.me);
  if (p && p.ground && p.speed > 0.5 && !S.paused) {
    S.stepDist += p.speed * dt;
    if (S.stepDist > (p.speed > 3.6 ? 1.7 : 1.1)) { S.stepDist = 0; sfx.play(sim.map.pathDist(p.x, p.z) < 2 || Math.hypot(p.x, p.z - 1) < 7 ? 'gravier' : 'herbe', { vol: p.carry ? 0.5 : 0.35 }); }
  }
  S.wallHitT = Math.max(0, S.wallHitT - dt);
  const c = sim.clock, night = c.phase === 'nuit';
  const pr = sim.prompt(S.me);
  const key = [sim.stock.bois, p && p.carry, pr && pr.text, pr && Math.round((pr.hp || 0) * 50), sim.goal, c.day, night, Math.ceil(sim.timeLeft), Math.round(p ? p.hp : 0), p && p.down, p && Math.round(p.revive * 10), p && Math.round(p.downT), p && p.dead, Math.round(sim.village.hp), S.wallHitT > 0].join('|');
  if (key === lastHud) return;
  lastHud = key;
  // horloge
  $('day').textContent = `${night ? 'Nuit' : 'Jour'} ${c.day}`;
  $('clock').textContent = night ? `aube dans ${fmt(sim.timeLeft)}` : `nuit dans ${fmt(sim.timeLeft)}`;
  $('dayChip').classList.toggle('night', night);
  $('dayIco').className = 'ico ' + (night ? 'moon' : 'sun');
  $('sBois').querySelector('b').textContent = sim.stock.bois;
  if (GOALS[S.goal] && GOALS[S.goal].id === 'ten') $('goalTxt').textContent = `${GOALS[S.goal].text} (${Math.min(10, sim.stock.bois)}/10)`;
  // vie
  if (p) {
    $('hpBar').firstElementChild.style.width = (p.hp / HP.player * 100) + '%';
    $('hpTxt').textContent = Math.ceil(p.hp);
    $('hpBar').classList.toggle('low', p.hp < 30 && !p.down);
    document.body.classList.toggle('down', !!(p.down || p.dead));
    $('downBox').hidden = !p.down;
    if (p.down) {
      const mate = sim.players.find((o) => o.reviving === p.id);
      $('downTxt').textContent = mate ? `${mate.name} te relève…` : `Un équipier peut te relever · ${fmt(HP.bleed - p.downT)}`;
      $('downRing').style.width = (p.revive / HP.revive * 100) + '%';
    }
  }
  $('wallBar').hidden = !(night || sim.village.hp < WAREHOUSE_HP);
  $('wallBar').querySelector('b').style.width = (sim.village.hp / WAREHOUSE_HP * 100) + '%';
  $('wallBar').classList.toggle('hit', S.wallHitT > 0);
  $('prompt').hidden = !pr;
  if (pr) {
    $('pKey').textContent = pr.key; $('pKey').hidden = !pr.key; $('pTxt').textContent = pr.text;
    $('pHp').hidden = pr.hp === undefined;
    if (pr.hp !== undefined) $('pHp').firstElementChild.style.width = Math.round(Math.min(1, pr.hp) * 100) + '%';
  }
  $('carry').hidden = !(p && p.carry);
}

// ------------------------------------------------------------------ outils de test
if (QS.has('debug')) {
  window.__fief = {
    get sim() { return sim; }, scene, input,
    ff(sec) { for (let i = 0; i < sec / DT; i++) stepOnce(); },
    hold(code, on = true) { if (on) input.keys.add(code); else input.keys.delete(code); },
    tp(x, z, yaw) { const p = sim.player(S.me); p.x = x; p.z = z; p.y = sim.map.heightAt(x, z); if (yaw !== undefined) { p.yaw = yaw; input.yaw = yaw + Math.PI; } Object.assign(scene.cam, { tx: x, tz: z, ty: p.y + 1.55 }); },
    cam(yaw, pitch, zoom) { input.yaw = yaw; if (pitch !== undefined) input.pitch = pitch; if (zoom !== undefined) { input.zoom = zoom; scene.cam.dist = zoom; } },
    press(k) { input.c[k]++; },
    frames(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { S.last = performance.now() - dt * 1000; frame(performance.now()); } },
  };
}
boot();
