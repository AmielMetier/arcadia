// Fief Maudit : démarrage et boucle de jeu. Étape 2 du développement (docs/FIEF-MAUDIT.md) : le village vide, un
// bûcheron qui abat des arbres et rentre le bois à l'entrepôt. Chacun joue dans sa propre vallée pour l'instant,
// même lancé depuis un salon : le jeu à plusieurs arrive avec l'étape 4.
// Adresse : ?seed=… (vallée), ?debug (expose window.__fief), ?autostart (passe l'écran d'accueil).
import { Sim, DT, GOALS, emptyInput } from './engine/sim.js';
import { createScene } from './view/scene.js';
import { Input } from './input.js';
import { Sfx } from './view/sfx.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const S = { me: 0, name: 'Toi', paused: true, started: false, acc: 0, last: 0, t: 0, goal: -1, stepDist: 0, lockWanted: false };
const sfx = new Sfx();
const scene = createScene($('stage'), { onLost: () => location.reload() });
const canvas = scene.renderer.domElement;
const input = new Input(canvas, {
  gesture: () => sfx.start(),
  menu: () => (S.paused ? (S.started && resume()) : openMenu()),
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
let sim = null;

// ------------------------------------------------------------------ démarrage
async function boot() {
  if (H.embedded) {
    await new Promise((res) => { if (H.initDone) res(); else H.on('init', () => res()); setTimeout(res, 2500); });
    S.me = H.info.myId ?? 0;
    const me = (H.players || []).find((p) => p.id === S.me);
    if (me && me.name) S.name = me.name;
    H.signalReady();
  }
  sim = new Sim({ seed, players: [{ id: S.me, name: S.name, job: 'bucheron', color: '#e0a040' }] });
  try {
    await scene.load(sim.map, { onProgress: (k) => { $('loadBar').style.width = Math.round(k * 100) + '%'; } });
  } catch (e) {
    console.error(e); $('loadTxt').textContent = 'Le chargement a échoué. Recharge la page.'; return;
  }
  $('loadBar').style.width = '100%';
  // une image pour que tout soit compilé avant de lever le rideau
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
  showScreen(`<div class="sheet">
    <h2>Jour 1 — Le bois</h2>
    <p class="sub">La malédiction a vidé la vallée. Il ne reste que vous, un feu de camp et un village en ruine.</p>
    <p>Avant de relever les maisons, il faut du bois. Abats les arbres autour du village, ramasse les bûches et range-les à l'entrepôt, la grande bâtisse au toit de tuiles.</p>
    <div class="keys">
      <span><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd></span><span>Se déplacer (la souris tourne la caméra)</span>
      <span><kbd>Clic</kbd></span><span>Coup de hache</span>
      <span><kbd>E</kbd></span><span>Ramasser, poser, ranger une bûche</span>
      <span><kbd>Espace</kbd> · <kbd>Ctrl</kbd></span><span>Sauter · marcher</span>
      <span><kbd>Molette</kbd> · <kbd>Échap</kbd></span><span>Zoom · menu</span>
    </div>
    ${shared ? '<p class="note">Version en construction : pour l\'instant chacun joue dans sa propre vallée. Le jeu à plusieurs arrive bientôt.</p>' : '<p class="note">Version en construction : la nuit, les squelettes et le jeu à plusieurs arrivent dans les prochaines étapes.</p>'}
    <div class="row"><button class="btn go" id="go">Prendre la hache</button></div>
  </div>`);
  $('go').onclick = () => { S.started = true; resume(); };
}
function openMenu() {
  if (!S.started) return;
  S.paused = true; input.unlock();
  showScreen(`<div class="sheet">
    <h2>Pause</h2>
    <p class="sub">${esc(S.name)} · Bûcheron · ${sim.stock.bois} bûche${sim.stock.bois > 1 ? 's' : ''} à l'entrepôt</p>
    <label>Sensibilité de la souris <input type="range" id="sens" min="0.3" max="3" step="0.1" value="${input.sens}"></label>
    <div class="row">
      ${H.embedded ? '<button class="btn" id="quit">Retour au salon</button>' : ''}
      <button class="btn go" id="back">Reprendre</button>
    </div>
  </div>`);
  $('sens').oninput = (e) => input.setSens(+e.target.value);
  $('back').onclick = () => resume();
  if ($('quit')) $('quit').onclick = () => H.exit();
}
function showScreen(html) { const s = $('screen'); s.innerHTML = html; s.hidden = false; }
function resume() {
  $('screen').hidden = true; S.paused = false; $('lockHint').hidden = true;
  sfx.start();
  if (!document.body.classList.contains('touch')) input.lock();
}
document.addEventListener('visibilitychange', () => { if (document.hidden && S.started && !S.paused && !QS.has('debug')) openMenu(); });

// ------------------------------------------------------------------ boucle
function view() {
  return { sim, me: S.me, camYaw: input.yaw, camPitch: input.pitch, zoom: input.zoom };
}
function stepOnce() {
  const k = input.sample(DT);
  // direction voulue : avant = vers où regarde la caméra
  const Y = input.yaw, fx = -Math.sin(Y), fz = -Math.cos(Y), rx = Math.cos(Y), rz = -Math.sin(Y);
  sim.setInput(S.me, { ...emptyInput(), wx: fx * k.my + rx * k.mx, wz: fz * k.my + rz * k.mx, walk: k.walk, jump: k.jump, fc: k.fc, uc: k.uc });
  sim.step();
  for (const e of sim.takeEvents()) onEvent(e);
}
const MANUAL = QS.has('manual');   // tests : une image seulement quand on la demande (__fief.frames)
function frame(now) {
  if (!MANUAL) requestAnimationFrame(frame);
  const dt = Math.max(0, Math.min(0.1, (now - S.last) / 1000)); S.last = now;
  if (!S.paused) {
    S.acc += dt;
    let n = 0;
    while (S.acc >= DT && n++ < 6) { stepOnce(); S.acc -= DT; }
    if (S.acc > DT) S.acc = 0;
  }
  S.t += dt;
  scene.update(view(), S.paused ? 0 : dt, S.t);
  hud();
}

// ------------------------------------------------------------------ événements : sons, arbres, interface
function distTo(x, z) { const c = scene.camera.position; return Math.hypot(c.x - x, c.z - z); }
function onEvent(e) {
  const p = e.pid !== undefined ? sim.player(e.pid) : null;
  const d = p ? distTo(p.x, p.z) : 0;
  switch (e.t) {
    case 'swing': sfx.play('souffle', { vol: 0.6, dist: d }); break;
    case 'hit': sfx.play('souffle', { vol: 0.4, dist: d }); sfx.play('hache', { vol: 1, dist: d }); break;
    case 'fall': {
      const t = sim.map.trees[e.tree];
      scene.treeFell(sim, e.tree, e.dir);
      sfx.play('craque', { vol: 0.8, dist: distTo(t.x, t.z), rate: 0.8 });
      sfx.play('arbre', { vol: 1, dist: distTo(t.x, t.z), delay: 0.9 });
      sfx.play('sol', { vol: 0.9, dist: distTo(t.x, t.z), delay: 1.45, rate: 0.7 });
      toast('Timber !');
      break;
    }
    case 'pick': sfx.play('tronc', { vol: 0.6, dist: d }); break;
    case 'drop': sfx.play('sol', { vol: 0.7, dist: d }); break;
    case 'store': sfx.play('tronc', { vol: 0.9, dist: d }); sfx.play('ui', { vol: 0.35, delay: 0.1 }); toast('+1 bûche'); bump('sBois'); break;
    case 'land': sfx.play('herbe', { vol: 0.8, dist: d }); break;
    case 'goal': setGoal(e.goal); sfx.play('ui', { vol: 0.5 }); break;
  }
}
function toast(t) { const el = $('toast'); el.textContent = t; el.classList.remove('on'); void el.offsetWidth; el.classList.add('on'); }
function bump(id) { const el = $(id); el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); }
function setGoal(g) {
  if (g === S.goal) return;
  S.goal = g;
  const G = GOALS[g], el = $('goal');
  $('goalTxt').textContent = G.text + (G.id === 'ten' ? ` (${sim.stock.bois}/10)` : '');
  $('goalHint').textContent = G.hint;
  el.classList.toggle('done', G.id === 'done');
  el.classList.remove('new'); void el.offsetWidth; el.classList.add('new');
}

let lastHud = '';
function hud() {
  if (!sim) return;
  const p = sim.player(S.me);
  // pas : un son tous les ~1,6 m parcourus au sol
  if (p && p.ground && p.speed > 0.5) {
    S.stepDist += p.speed * (1 / 60);
    if (S.stepDist > (p.speed > 3.6 ? 1.7 : 1.1)) { S.stepDist = 0; sfx.play(sim.map.pathDist(p.x, p.z) < 2 || Math.hypot(p.x, p.z - 1) < 7 ? 'gravier' : 'herbe', { vol: p.carry ? 0.5 : 0.35 }); }
  }
  const pr = sim.prompt(S.me);
  const key = [sim.stock.bois, p && p.carry, pr && pr.text, pr && pr.hp, sim.goal].join('|');
  if (key === lastHud) return;
  lastHud = key;
  $('sBois').querySelector('b').textContent = sim.stock.bois;
  if (GOALS[S.goal] && GOALS[S.goal].id === 'ten') $('goalTxt').textContent = `${GOALS[S.goal].text} (${Math.min(10, sim.stock.bois)}/10)`;
  $('prompt').hidden = !pr;
  if (pr) {
    $('pKey').textContent = pr.key; $('pTxt').textContent = pr.text;
    $('pHp').hidden = pr.hp === undefined;
    if (pr.hp !== undefined) $('pHp').firstElementChild.style.width = Math.round(pr.hp * 100) + '%';
  }
  $('carry').hidden = !(p && p.carry);
}

// ------------------------------------------------------------------ outils de test
if (QS.has('debug')) {
  window.__fief = {
    get sim() { return sim; }, scene, input,
    // avance le moteur de `sec` secondes sans dessiner
    ff(sec) { for (let i = 0; i < sec / DT; i++) stepOnce(); },
    // tient une touche pendant la suite (ZQSD : KeyW…)
    hold(code, on = true) { if (on) input.keys.add(code); else input.keys.delete(code); },
    tp(x, z, yaw) { const p = sim.player(S.me); p.x = x; p.z = z; p.y = sim.map.heightAt(x, z); if (yaw !== undefined) { p.yaw = yaw; input.yaw = yaw + Math.PI; } Object.assign(scene.cam, { tx: x, tz: z, ty: p.y + 1.55 }); },
    cam(yaw, pitch, zoom) { input.yaw = yaw; if (pitch !== undefined) input.pitch = pitch; if (zoom !== undefined) { input.zoom = zoom; scene.cam.dist = zoom; } },
    press(k) { input.c[k]++; },
    // fait avancer n images de dt secondes (mode ?manual)
    frames(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) { S.last = performance.now() - dt * 1000; frame(performance.now()); } },
  };
}
boot();
