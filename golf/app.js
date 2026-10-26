// Birdie Party : démarrage, rôle (solo, hôte, invité), et tout ce que voit le joueur : survol de chaque trou,
// visée et swing quand c'est son tour, swing des autres en direct, vol de la balle, foule et jingles, cartes de score.
// La partie elle-même (règles, coups, bots) est tenue par la session (net/session.js) ; la vue rejoue ses
// événements dans l'ordre : un état, un coup, un état…
import { CLUBS, PUTTER } from './engine/clubs.js';
import { simulate, previewLanding } from './engine/physics.js';
import { suggestClub, suggestAim, clubReach, allowedClub, distToPin } from './engine/advice.js';
import { totals, ranking } from './engine/rules.js';
import { startHost, startClient, holeByNumber, currentHole, windOf, simBall } from './net/session.js';
import { createScene } from './view/scene.js';
import { HUD, titleHtml, loadingHtml, scorecardHtml, scoreName, fmtM, loadSetup, saveSetup, esc } from './view/hud.js';
import { Sfx } from './view/sfx.js';
import { Input, MAX_POWER } from './input.js';
import * as THREE from '../shared/vendor/three/three.module.min.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const INTRO = 5.5;          // s : survol du trou
const CARD_T = 5;           // s : carte de score entre deux trous

const hud = new HUD();
const sfx = new Sfx(new URL('./sounds/', import.meta.url).href);
let scene = null;
try { scene = createScene($('#stage'), { onLost: () => hud.toast('Affichage 3D interrompu : recharge la page', 6) }); }
catch (e) { console.error(e); $('#screen').innerHTML = '<div class="card panel"><h2>Oups</h2><p>Ton navigateur ne peut pas afficher la 3D (WebGL).</p></div>'; }

// ------------------------------------------------------------------ état de la vue
const V = {
  phase: 'title', role: 'solo', me: null, session: null, settings: {},
  R: null, hole: null, hi: -1, queue: [], busy: false, pars: [],
  cur: null, mine: false, ball: null, club: 0, aim: 0, power: 0, putt: 20, preview: null, dirty: true, view: false,
  golfers: new Map(), localSwing: null, poseT: 0,
  shot: null, playT: 0, evI: 0, timer: 0, oohed: false, introT: 0, outcome: null,
};
const golferOf = (p) => {
  if (!V.golfers.has(p.id)) V.golfers.set(p.id, scene.addGolfer({ shirt: p.color, skin: p.look % 5, hair: (p.look * 3 + 1) % 5 }));
  return V.golfers.get(p.id);
};

// ------------------------------------------------------------------ commandes
const input = new Input($('#stage'), {
  unlock: () => sfx.unlock(),
  canSwing: () => V.phase === 'aim' && V.mine && !V.view,
  back(p) {
    if (V.phase !== 'aim' && V.phase !== 'back') return;
    V.phase = 'back'; V.power = p; golferOf(V.cur).setBack(p); hud.gauge(p, true, MAX_POWER); sendPose();
  },
  cancel() { if (V.phase !== 'back') return; V.phase = 'aim'; V.power = 0; golferOf(V.cur).setBack(0); hud.gauge(0, true); sendPose(); },
  release: (r) => release(r),
  key: (k, down) => onKey(k, down),
});
input.listen($('#clubPrev'), 'click', () => changeClub(-1));
input.listen($('#clubNext'), 'click', () => changeClub(1));
input.listen($('#btnView'), 'click', () => toggleView());
input.listen($('#btnMute'), 'click', () => toggleMute());
input.listen($('#btnLeave'), 'click', () => leaveGame());
const aimHold = { l: false, r: false };
for (const [id, k] of [['#aimL', 'l'], ['#aimR', 'r']]) {
  input.listen($(id), 'pointerdown', (e) => { e.stopPropagation(); aimHold[k] = true; });
  input.listen($(id), 'pointerup', () => { aimHold[k] = false; });
  input.listen($(id), 'pointerleave', () => { aimHold[k] = false; });
}
$('#btnMute').textContent = sfx.muted ? '🔇' : '🔊';
// clic pendant le survol : on passe directement au jeu
input.listen($('#stage'), 'pointerdown', () => { if (V.phase === 'intro') endIntro(); });

function onKey(k, down) {
  if (!down) return;
  if (k === 'KeyM') return toggleMute();
  if (V.phase === 'intro' && (k === 'Enter' || k === 'Escape')) return endIntro();
  if (V.phase !== 'aim' || !V.mine) return;
  if (k === 'ArrowUp') changeClub(-1);
  else if (k === 'ArrowDown') changeClub(1);
  else if (k === 'KeyV') toggleView();
}
// quitter la partie en cours : retour au salon (l'hôte arrête la partie pour tout le monde) ou au menu
function leaveGame() {
  const msg = H.embedded ? (V.role === 'host' ? 'Arrêter la partie pour tout le monde et revenir au salon ?' : 'Quitter la partie et revenir au salon ?') : 'Abandonner la partie et revenir au menu ?';
  if (!confirm(msg)) return;
  sfx.ui('close');
  if (H.embedded) { teardown(); H.exit(); return; }
  V.session && V.session.stop(); V.session = null; V.queue = []; V.busy = false; V.hi = -1; V.R = null; V.hole = null;
  hud.show(false); showTitle();
}
function toggleMute() { sfx.setMuted(!sfx.muted); $('#btnMute').textContent = sfx.muted ? '🔇' : '🔊'; }
function toggleView() { if (V.phase !== 'aim' || !V.mine) return; V.view = !V.view; sfx.ui('switch'); aimCamera(false); }
function changeClub(d) {
  if (V.phase !== 'aim' || !V.mine) return;
  let i = V.club;
  for (let k = 0; k < CLUBS.length; k++) { i = (i + d + CLUBS.length) % CLUBS.length; if (allowedClub(i, V.ball.lie)) break; }
  V.club = i; V.dirty = true; sfx.ui('click');
  refreshShotHud(); scene.showGrid(V.club === PUTTER); sendPose();
}
function sendPose() {
  if (!V.mine || !V.session) return;
  V.session.pose({ aim: V.aim, club: V.club, back: V.power });
}

// ------------------------------------------------------------------ démarrage
function boot(info) {
  const role = H.embedded ? info.role : 'solo';
  const prof = window.DDProfile ? window.DDProfile.load() : { name: 'Moi', color: '#ff4b2b' };
  const meP = H.players.find((p) => p.id === info.myId);
  V.me = { id: H.embedded ? info.myId : 0, name: meP ? meP.name : prof.name || 'Moi', color: meP ? meP.color : prof.color };
  V.role = role;
  if (role === 'solo') { if (QS.has('play')) return quickPlay(); return showTitle(); }
  V.settings = info.settings || {};
  $('#screen').innerHTML = loadingHtml(role === 'host' ? 'Préparation du parcours' : 'On rejoint la partie');
  startSession(role);
  // l'hôte est parti et ce joueur reprend le salon : il devient l'hôte, à partir du dernier état reçu
  H.on('roster', () => {
    if (V.role === 'guest' && H.info.role === 'host') {
      V.role = 'host';
      const last = V.session && V.session.state;
      V.session && V.session.stop();
      V.session = startHost({ bridge: H, solo: false, settings: V.settings, me: V.me, emit: onEvent, initial: last });
      if (!last) V.session.begin();
      hud.toast('Tu reprends la partie en tant qu\'hôte', 3);
    }
  });
  H.signalReady();
}
function startSession(role) {
  if (role === 'guest') V.session = startClient({ bridge: H, me: V.me, emit: onEvent });
  else {
    V.session = startHost({ bridge: H, solo: role === 'solo', settings: V.settings, me: V.me, emit: onEvent });
    // laisse aux invités le temps d'ouvrir le jeu avant le survol du premier trou
    setTimeout(() => V.session && V.session.begin(), role === 'solo' ? 50 : 1500);
  }
}
// raccourci de test : ?play lance directement une partie solo (?course=mer&bots=2)
function quickPlay() {
  const s = loadSetup();
  V.settings = { ...s, course: QS.get('course') || s.course, bots: QS.has('bots') ? +QS.get('bots') : s.bots, startHole: +QS.get('hole') || 0 };
  $('#screen').innerHTML = loadingHtml();
  startSession('solo');
}
function showTitle() {
  V.phase = 'title';
  hud.show(false);
  const set = loadSetup();
  $('#screen').innerHTML = titleHtml(set);
  for (const g of document.querySelectorAll('.title [data-k]')) {
    for (const b of g.querySelectorAll('button')) b.onclick = () => {
      sfx.unlock(); sfx.ui('click');
      set[g.dataset.k] = isNaN(+b.dataset.v) ? b.dataset.v : +b.dataset.v;
      for (const o of g.querySelectorAll('button')) o.classList.toggle('on', o === b);
      saveSetup(set);
    };
  }
  $('#btnPlay').onclick = () => {
    sfx.unlock(); sfx.ui('confirm');
    V.settings = { ...set };
    $('#screen').innerHTML = loadingHtml();
    V.queue = []; V.busy = false; V.hi = -1; V.R = null;
    startSession('solo');
  };
}

// ------------------------------------------------------------------ événements de la session, traités dans l'ordre
function onEvent(e) {
  if (e.type === 'pose') return onPose(e);
  V.queue.push(e);
  pump();
}
function pump() {
  while (!V.busy && V.queue.length) {
    const e = V.queue.shift();
    if (e.type === 'state') applyState(e.R);
    else if (e.type === 'shot') playShot(e.ev);
  }
}
function unbusy() { V.busy = false; pump(); }

async function applyState(R) {
  const prev = V.R;
  V.R = R;
  V.pars = R.holes.map((n) => holeByNumber(n).par);
  if (R.phase === 'over') {
    V.busy = true;
    if (prev && prev.phase !== 'over') await holeCard(R);
    finalCard(R);
    return;
  }
  if (R.hi !== V.hi) {
    V.busy = true;
    if (V.hi >= 0 && prev && prev.hi !== R.hi && R.hi > 0) await holeCard(R);
    await loadHole(R);
    V.busy = false;
  }
  setTurn();
  pump();
}

// ------------------------------------------------------------------ trous
async function loadHole(R) {
  const hole = currentHole(R);
  V.hi = R.hi; V.hole = hole;
  hud.show(false);
  $('#screen').innerHTML = loadingHtml(`Trou ${hole.n} · ${hole.name}`);
  await new Promise((r) => setTimeout(r, 40)); // laisse l'écran de chargement s'afficher
  const wind = windOf(R);
  await scene.loadHole(hole, { theme: hole.theme, wind });
  scene.setWind(wind);
  // mini-carte : photo aérienne du trou, prise une fois le décor posé
  const frame = hud.mapFrame(hole);
  hud.setMap(scene.renderMap(frame), frame);
  sfx.ambience(hole.theme);
  $('#screen').innerHTML = '';
  // survol du trou, depuis le départ jusqu'au green
  V.phase = 'intro'; V.introT = 0;
  hud.show(true); hud.controls(false); hud.gauge(0, false); $('#turn').hidden = true;
  scene.setMarker(null, false); scene.setAimDots(null, null, false); scene.showGrid(false); scene.showBall(false); scene.setTee(null, false); scene.setOthers([]);
  for (const g of V.golfers.values()) g.root.visible = false;
  hud.hole(hole, 1); hud.players(stripList()); hud.dist(hole.length); hud.lie('tee');
  hud.banner(`Trou ${hole.n}`, '', `Par ${hole.par} · ${hole.length} m · ${hole.name}`, INTRO - 0.6);
  sfx.holeStart();
  introCamera(0, true);
  await new Promise((r) => { V.introDone = r; });
}
function endIntro() {
  if (V.phase !== 'intro') return;
  hud.hideBanner();
  V.phase = 'cut';
  fadeCut(() => { const r = V.introDone; V.introDone = null; r && r(); });
}

// carte de score entre deux trous (ou après le dernier)
function holeCard(R) {
  return new Promise((res) => {
    V.phase = 'card';
    hud.controls(false); hud.gauge(0, false); $('#turn').hidden = true;
    const holes = R.holes.map((n) => holeByNumber(n));
    $('#screen').innerHTML = scorecardHtml(R, holes, { title: R.phase === 'over' ? 'Dernier trou joué !' : `Après le trou ${holes[R.hi - 1].n}` });
    sfx.ui('card');
    setTimeout(() => { $('#screen').innerHTML = ''; res(); }, CARD_T * 1000);
  });
}
function finalCard(R) {
  V.phase = 'over';
  hud.show(false);
  const holes = R.holes.map((n) => holeByNumber(n));
  const rk = ranking(R, V.pars);
  const canReplay = V.role !== 'guest';
  $('#screen').innerHTML = scorecardHtml(R, holes, { final: true, ranking: rk, canReplay, embedded: H.embedded, title: R.players.length > 1 ? `${rk[0].name} gagne la partie !` : 'Partie terminée !' });
  sfx.react(rk[0].id === V.me.id ? 'birdie' : 'par');
  const again = $('#btnAgain');
  if (again) again.onclick = () => { sfx.ui('confirm'); $('#screen').innerHTML = loadingHtml(); V.hi = -1; V.queue = []; V.busy = false; V.session.begin(); };
  $('#btnQuit').onclick = () => {
    sfx.ui('close');
    if (H.embedded) { teardown(); H.exit(); }
    else { V.session && V.session.stop(); V.session = null; V.queue = []; V.busy = false; V.hi = -1; V.R = null; showTitle(); }
  };
}

// ------------------------------------------------------------------ tour de jeu
function stripList() {
  const t = totals(V.R, V.pars);
  return V.R.players.map((p, i) => ({ name: p.name, color: p.color, toPar: t[i].toPar, cur: i === V.R.turn && V.phase !== 'intro', done: p.done && V.R.phase === 'play' }));
}

function setTurn() {
  const R = V.R, hole = V.hole;
  const i = R.turn, P = R.players[i];
  if (!P) return;
  V.cur = P; V.mine = P.id === V.me.id && !P.bot;
  V.ball = { ...P.ball }; V.ball.y = simBall(hole, V.ball).y;
  V.putt = clubReach(hole, V.ball, PUTTER);
  V.club = suggestClub(hole, V.ball);
  V.aim = suggestAim(hole, V.ball, V.club);
  V.view = false; V.dirty = true; V.power = 0; V.localSwing = null;
  // le joueur qui joue, et les autres qui regardent un peu en retrait
  for (const g of V.golfers.values()) g.root.visible = false;
  const g = golferOf(P); g.root.visible = true; g.reset();
  placeSpectators();
  scene.showBall(true); scene.setBall(V.ball.x, V.ball.y, V.ball.z); scene.trailClear();
  scene.setTee(V.ball, V.ball.lie === 'tee');
  scene.setOthers(R.players.filter((q, k) => k !== i && !q.done && q.ball && !(q.ball.lie === 'tee' && V.ball.lie === 'tee')).map((q) => ({ x: q.ball.x, z: q.ball.z, color: q.color })));
  scene.showPole(!(V.club === PUTTER && distToPin(hole, V.ball) < 14));
  scene.showGrid(V.club === PUTTER);
  hud.hole(hole, P.strokes + 1); hud.lie(V.ball.lie);
  refreshShotHud();
  hud.controls(V.mine); hud.gauge(0, true);
  // annonce du tour
  const t = $('#turn');
  t.innerHTML = V.mine ? (R.players.length > 1 ? `<i style="background:${esc(P.color)}"></i>À toi de jouer !` : '') : `<i style="background:${esc(P.color)}"></i>Au tour de ${esc(P.name)}`;
  t.hidden = !t.innerHTML; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(V.turnT); V.turnT = setTimeout(() => { t.hidden = true; }, 2200);
  if (R.players.length > 1) sfx.ui(V.mine ? 'confirm' : 'switch');
  const fromCut = V.phase === 'cut' || V.phase === 'intro';
  V.phase = V.mine ? 'aim' : 'watch';
  hud.players(stripList());
  // petit fondu au blanc entre deux joueurs, puis la caméra se pose derrière la balle
  if (fromCut) aimCamera(true);
  else fadeCut(() => aimCamera(true));
  sendPose();
}

function placeSpectators() {
  const R = V.R, hole = V.hole, A = { x: Math.sin(V.aim), z: Math.cos(V.aim) }, Rv = { x: -Math.cos(V.aim), z: Math.sin(V.aim) };
  let k = 0;
  for (const p of R.players) {
    if (p === V.cur || p.left) continue;
    const g = golferOf(p); g.root.visible = true; g.reset();
    // devant, du côté du golfeur : bien visibles depuis la caméra, sans gêner la visée
    const x = V.ball.x + A.x * (2.5 + k * 1.1) - Rv.x * (4.6 + k * 1.4), z = V.ball.z + A.z * (2.5 + k * 1.1) - Rv.z * (4.6 + k * 1.4);
    g.stand(x, hole.heightAt(x, z), z, V.ball.x, V.ball.z);
    k++;
  }
}
function placeGolfer() {
  const kind = V.club === PUTTER ? 'putter' : V.club <= 1 ? 'wood' : 'iron';
  const off = kind === 'putter' ? 0.56 : 0.86, rx = -Math.cos(V.aim), rz = Math.sin(V.aim);
  golferOf(V.cur).place(V.ball, V.aim, V.hole.heightAt(V.ball.x - rx * off, V.ball.z - rz * off), kind);
}
function refreshShotHud() {
  hud.club(V.club, V.club === PUTTER ? V.putt : clubReach(V.hole, V.ball, V.club));
  hud.hint(V.club === PUTTER ? 'Putt : tire vers le bas pour doser, relâche pour putter' : 'Tire vers le bas pour armer, relâche pour frapper');
  placeGolfer();
}

// posture d'un autre joueur (visée, club, armé) : on la montre en direct
function onPose(e) {
  if (!V.cur || e.id !== V.cur.id || V.mine || V.phase !== 'watch') return;
  const clubChanged = e.club !== V.club;
  V.aim = +e.aim || 0; V.club = clamp(e.club | 0, 0, PUTTER);
  if (clubChanged) { refreshShotHud(); scene.showGrid(V.club === PUTTER); }
  placeGolfer();
  golferOf(V.cur).setBack(clamp(+e.back || 0, 0, MAX_POWER));
  hud.gauge(+e.back || 0, true, MAX_POWER);
  V.dirty = true;
}

// ------------------------------------------------------------------ swing local
function release({ power, curve }) {
  if (V.phase !== 'back') return;
  if (power < 0.03) { V.phase = 'aim'; V.power = 0; golferOf(V.cur).setBack(0); hud.gauge(0, true); sendPose(); return; }
  let p = Math.min(1, power), c = curve;
  const over = Math.max(0, power - 1);
  if (over > 0) { p += over * 0.3; c -= over * 3.2; hud.toast('Trop armé : la balle tourne !', 2); } // trop armé : un peu plus loin, mais ça hooke
  let aim = V.aim;
  if (V.club === PUTTER) { aim += c * 0.035; c = 0; }
  V.phase = 'down';
  V.localSwing = { t0: performance.now(), impact: golferOf(V.cur).release() };
  if (V.club !== PUTTER) sfx.whoosh(Math.min(1, power));
  scene.setMarker(null, false); scene.setAimDots(null, null, false);
  hud.controls(false); hud.gauge(power, true, MAX_POWER);
  V.session.shot({ club: V.club, aim, power: p, curve: c });
}

// ------------------------------------------------------------------ un coup joué (le mien ou celui d'un autre)
function playShot(ev) {
  V.busy = true;
  const hole = V.hole, P = V.R.players[ev.i];
  V.cur = P; V.mine = P.id === V.me.id && !P.bot;
  const from = simBall(hole, ev.from);
  V.ball = { ...ev.from, y: from.y };
  V.club = ev.params.club; V.aim = ev.params.aim;
  // trajectoire recalculée ici avec les mêmes données ; le résultat de l'hôte fait foi à l'arrivée
  const sim = simulate(hole, from, ev.params, windOf(V.R), { putt: ev.putt });
  V.shot = { ev, sim, launched: false };
  V.playT = 0; V.evI = 0; V.oohed = false; V.outcome = null;
  const g = golferOf(P);
  scene.setMarker(null, false); scene.setAimDots(null, null, false); hud.controls(false);
  $('#turn').hidden = true;
  if (V.localSwing && ev.pid === V.me.id) {
    V.timer = Math.max(0, V.localSwing.impact - (performance.now() - V.localSwing.t0) / 1000);
  } else {
    placeGolfer();
    g.setBack(clamp(ev.params.power, 0.05, MAX_POWER));
    V.timer = g.release();
    if (V.club !== PUTTER) sfx.whoosh(Math.min(1, ev.params.power));
  }
  V.localSwing = null;
  V.phase = 'down';
}
function launch() {
  const ev = V.shot.ev, c = CLUBS[ev.params.club];
  V.shot.launched = true;
  V.phase = 'fly'; V.flyAim = ev.params.aim;
  sfx.hit(c.putter ? 'putter' : ev.params.club <= 1 ? 'wood' : ev.params.club >= 5 ? 'wedge' : 'iron', ev.params.power);
  sfx.duck(true);
  hud.gauge(0, false);
  hud.hole(V.hole, ev.before + 1);
  scene.setTee(null, false);
  scene.trailClear();
}

// résultat du coup, une fois la balle arrêtée : bannière, foule, jingle, réaction du golfeur
function outcome() {
  const ev = V.shot.ev, r = ev.res, hole = V.hole, P = V.R.players[ev.i], club = CLUBS[ev.params.club];
  const end = r.kind === 'water' ? r.drop : r.end, d = Math.hypot(end.x - hole.pin.x, end.z - hole.pin.z);
  const g = golferOf(P), trees = V.shot.sim.events.some((e) => e.type === 'tree' || e.type === 'trunk');
  const who = V.mine || V.R.players.length === 1 ? '' : `${P.name} · `;
  if (r.kind === 'holed') {
    const s = ev.strokes, diff = s - hole.par, name = scoreName(s, hole.par);
    hud.banner(name, s === 1 || diff <= -2 ? 'gold' : diff < 0 ? 'good' : diff === 0 ? '' : 'bad', s === 1 ? `${who}du premier coup !` : `${who}${s} coups`, 3);
    sfx.react(s === 1 ? 'holeinone' : diff <= -2 ? 'eagle' : diff === -1 ? 'birdie' : diff === 0 ? 'par' : diff === 1 ? 'bogey' : 'worse');
    g.cheer();
    holeCamera(g);
    return 3.6;
  }
  if (r.kind === 'water') { hud.banner('Plouf !', 'bad', `${who}dans l'eau · 1 coup de pénalité`, 2.4); sfx.react('water'); g.sulk(); return 2.8; }
  if (r.kind === 'ob') { hud.banner('Hors limites !', 'bad', `${who}on rejoue du même endroit · +1`, 2.4); sfx.react('ob'); g.sulk(); return 2.8; }
  if (ev.out.pickedUp) { hud.banner('Balle ramassée', 'bad', `${who}${ev.strokes} coups`, 2.4); sfx.react('worse'); return 2.8; }
  if (club.putter) {
    if (V.shot.sim.events.some((e) => e.type === 'lip')) { hud.banner('Il a léché le bord !', 'bad', `Encore ${fmtM(d)}`, 1.9); sfx.react('lip'); g.sulk(); }
    else { hud.banner(d < 1 ? 'Tout près !' : `Encore ${fmtM(d)}`, d < 1 ? 'good' : '', who.replace(' · ', ''), 1.7); sfx.react(d < 1.2 ? 'close' : 'miss'); }
    return 2.1;
  }
  const lie = r.surf;
  const great = !trees && r.dist >= club.dist * 0.93 && Math.abs(V.shot.sim.curve) < 0.25 && (lie === 'fairway' || lie === 'green' || lie === 'fringe');
  if ((lie === 'green' || lie === 'fringe') && d < 3) { hud.banner('Superbe approche !', 'gold', `${who}reste ${fmtM(d)}`, 2.3); sfx.react('close'); g.cheer(); return 2.6; }
  const msg = {
    green: ['Sur le green !', 'good', 'green'], fringe: ['Avant-green', 'good', 'green'], fairway: [great ? 'Superbe coup !' : 'Fairway', great ? 'good' : '', great ? 'great' : 'fairway'],
    rough: ['Dans le rough', '', 'rough'], bunker: ['Dans le bunker…', 'bad', 'bunker'], beach: ['Sur la plage…', 'bad', 'bunker'], tee: ['Fairway', '', 'fairway'],
  }[lie] || ['Dans le rough', '', 'rough'];
  const treeHit = trees && lie !== 'green' && lie !== 'fairway';
  hud.banner(treeHit ? 'Dans les arbres !' : msg[0], treeHit ? 'bad' : msg[1], `${who}${fmtM(r.dist)} · reste ${fmtM(d)}`, 2.1);
  sfx.react(treeHit ? 'trees' : msg[2]);
  if (msg[2] === 'bunker' || treeHit) g.sulk(); else if (great) g.cheer();
  return 2.4;
}
function finishShot() {
  const ev = V.shot.ev;
  V.shot = null;
  sfx.duck(false);
  V.phase = 'wait';
  if (V.session && V.session.isHost) V.session.done(ev.no);
  unbusy();
}

function fadeCut(fn) {
  const f = $('#fade');
  f.classList.add('on');
  setTimeout(() => { fn(); f.classList.remove('on'); }, 360);
}

// ------------------------------------------------------------------ caméras
const ground = (x, z) => V.hole.heightAt(x, z);
function aimCamera(snap) {
  const b = V.ball, A = { x: Math.sin(V.aim), z: Math.cos(V.aim) }, R = { x: -Math.cos(V.aim), z: Math.sin(V.aim) };
  if (V.view) {
    // vue d'ensemble : au-dessus de la ligne balle → cible
    const t = V.preview || V.hole.pin, mx = (b.x + t.x) / 2, mz = (b.z + t.z) / 2, d = Math.hypot(t.x - b.x, t.z - b.z);
    scene.camTo(V3(mx - A.x * d * 0.45, ground(mx, mz) + d * 0.75 + 25, mz - A.z * d * 0.45), V3(mx + A.x * d * 0.1, ground(mx, mz), mz + A.z * d * 0.1), 2.2, snap);
    return;
  }
  if (V.club === PUTTER) {
    // putt : dans l'axe de la ligne, décalé côté balle pour que le golfeur ne cache pas le trou
    const px = b.x - A.x * 3.6 + R.x * 0.45, pz = b.z - A.z * 3.6 + R.z * 0.45;
    scene.camTo(V3(px, Math.max(ground(px, pz), b.y) + 1.55, pz), V3(b.x + A.x * 4, b.y - 0.15, b.z + A.z * 4), 5, snap);
    return;
  }
  // derrière la balle, un peu côté balle : le golfeur à gauche de l'image, le parcours bien visible
  const cx = b.x - R.x * 0.2, cz = b.z - R.z * 0.2;
  const px = cx - A.x * 5.6, pz = cz - A.z * 5.6;
  scene.camTo(V3(px, Math.max(ground(px, pz), b.y) + 1.95, pz), V3(b.x + A.x * 26, b.y + 1.1, b.z + A.z * 26), 5, snap);
}
function flyCamera(p, t, rolling) {
  const A = { x: Math.sin(V.flyAim), z: Math.cos(V.flyAim) };
  if (CLUBS[V.shot.ev.params.club].putter) {
    // putt : la caméra reste derrière le golfeur et suit la balle des yeux
    scene.cam.tLook.lerp(V3(p.x, p.y, p.z), 0.08); scene.cam.k = 3;
    return;
  }
  if (t < 0.55) { scene.cam.tLook.lerp(V3(p.x, p.y, p.z), 0.25); return; }
  const back = rolling ? 9 : 15, up = rolling ? 4.2 : 6.5;
  const px = p.x - A.x * back, pz = p.z - A.z * back;
  scene.camTo(V3(px, Math.max(p.y + up, ground(px, pz) + 2), pz), V3(p.x + A.x * 4, p.y, p.z + A.z * 4), rolling ? 2.4 : 1.7);
}
// gros plan quand la balle tombe : depuis l'autre côté du trou, on voit le golfeur sauter de joie
function holeCamera(g) {
  const h = V.hole, gp = g.root.position, ax = gp.x - h.pin.x, az = gp.z - h.pin.z, L = Math.hypot(ax, az) || 1;
  const far = Math.min(4, 1.6 + L * 0.25), py = h.heightAt(h.pin.x, h.pin.z);
  scene.camTo(V3(h.pin.x - ax / L * far, py + 0.9 + Math.min(L, 25) * 0.06, h.pin.z - az / L * far), L > 25 ? V3(h.pin.x, py, h.pin.z) : V3((h.pin.x + gp.x) / 2, py + 0.5, (h.pin.z + gp.z) / 2), 1.6);
}
// survol : on file au-dessus de la ligne de jeu, du départ vers le green
function introCamera(u, snap) {
  const pts = V.hole.center, segs = []; let tot = 0;
  for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); tot += L; }
  const at = (f) => {
    let d = clamp(f, 0, 1) * tot;
    for (let i = 0; i < segs.length; i++) { if (d <= segs[i] || i === segs.length - 1) { const k = clamp(d / segs[i], 0, 1); return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k }; } d -= segs[i]; }
    return { x: pts[0][0], z: pts[0][1] };
  };
  const e = u * u * (3 - 2 * u);
  const p = at(-0.05 + e * 0.88), l = at(0.12 + e * 0.88);
  scene.camTo(V3(p.x, ground(p.x, p.z) + 34 - e * 12, p.z), V3(l.x, ground(l.x, l.z), l.z), snap ? 1 : 6, snap);
}

// ------------------------------------------------------------------ boucle
let last = performance.now(), raf = 0, alive = true;
function loop(now) {
  if (!alive) return;
  raf = requestAnimationFrame(loop);
  const ms = now - last, dt = Math.min(0.05, ms / 1000); last = now;
  input.update();
  hud.tick(dt);
  if (!scene) return;
  if (!V.hole) { scene.frame(dt); return; }
  autoQuality(now, ms);
  sfx.wind(windOf(V.R).speed, dt);

  if (V.phase === 'intro') {
    V.introT += dt;
    introCamera(clamp(V.introT / INTRO, 0, 1), false);
    if (V.introT >= INTRO) endIntro();
  } else if (V.phase === 'aim' || V.phase === 'back' || V.phase === 'watch') {
    if (V.phase === 'aim') {
      const l = input.held('ArrowLeft') || aimHold.l, r = input.held('ArrowRight') || aimHold.r;
      if (l || r) {
        const rate = (V.club === PUTTER ? 0.22 : 0.55) * (input.held('ShiftLeft') || input.held('ShiftRight') ? 0.3 : 1);
        V.aim += (l ? 1 : -1) * rate * dt; V.dirty = true; placeGolfer();
        V.poseT += dt; if (V.poseT > 0.1) { V.poseT = 0; sendPose(); }
      }
    }
    if (V.dirty) {
      V.dirty = false;
      V.preview = previewLanding(V.hole, V.ball, V.club, 'mid', V.aim, V.putt);
      // points de chute aux repères 1/3 et 2/3 de la jauge, reportés sur la mini-carte
      V.marks = [1 / 3, 2 / 3].map((p) => previewLanding(V.hole, V.ball, V.club, 'mid', V.aim, V.putt, p));
      const d = Math.hypot(V.preview.x - V.ball.x, V.preview.z - V.ball.z);
      scene.setMarker(V.preview, true, V.club === PUTTER ? 0.3 : clamp(d * 0.012, 0.6, 3.2), V.club !== PUTTER);
      scene.setAimDots(V.ball, V.preview, true);
    }
    aimCamera(false);
  } else if (V.phase === 'down') {
    V.timer -= dt;
    if (V.timer <= 0 && V.shot && !V.shot.launched) launch();
  } else if (V.phase === 'fly') {
    const sim = V.shot.sim, P = sim.path;
    V.playT += dt;
    const f = Math.min(sim.n - 1, V.playT * 60), i = Math.floor(f), k = f - i, j = Math.min(sim.n - 1, i + 1);
    const p = { x: P[i * 3] + (P[j * 3] - P[i * 3]) * k, y: P[i * 3 + 1] + (P[j * 3 + 1] - P[i * 3 + 1]) * k, z: P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * k };
    scene.setBall(p.x, p.y, p.z);
    scene.trailPush(p.x, p.y + 0.03, p.z);
    while (V.evI < sim.events.length && sim.events[V.evI].i <= f) {
      const e = sim.events[V.evI++];
      if (e.type === 'bounce') sfx.bounce(e.surf, e.v);
      else if (e.type === 'tree') sfx.play('tree', { vol: 0.8 });
      else if (e.type === 'trunk') sfx.play('trunk', { vol: 0.8 });
      else if (e.type === 'cup') sfx.cup();
      else if (e.type === 'lip') sfx.lip();
      else if (e.type === 'splash') { sfx.splash(); scene.showBall(false); }
    }
    let rolling = false;
    for (const e of sim.events) if (e.type === 'roll' && e.i <= f) { rolling = true; break; }
    // la foule retient son souffle quand la balle file vers le trou
    const dp = Math.hypot(p.x - V.hole.pin.x, p.z - V.hole.pin.z);
    if (!V.oohed && dp < 2.2 && (rolling || CLUBS[V.shot.ev.params.club].putter) && sim.kind !== 'holed' && f < sim.n - 20) { V.oohed = true; sfx.ooh(); }
    flyCamera(p, V.playT, rolling);
    hud.dist(dp);
    if (f >= sim.n - 1) {
      // arrivée : on se cale sur le résultat de l'hôte
      const r = V.shot.ev.res;
      if (r.kind !== 'water') scene.setBall(r.end.x, r.end.y, r.end.z);
      V.phase = 'after'; V.timer = 0.55;
    }
  } else if (V.phase === 'after') {
    scene.trailFade(dt);
    V.timer -= dt;
    if (V.timer <= 0 && !V.outcome) { V.outcome = true; V.timer = outcome(); hud.players(stripList()); }
    else if (V.timer <= 0 && V.outcome) finishShot();
  }

  // drapeau à l'écran, distance et vent
  if (V.phase === 'aim' || V.phase === 'back' || V.phase === 'watch' || V.phase === 'intro') {
    const h = V.hole;
    const b = V.phase === 'intro' ? h.tee : V.ball;
    hud.pinTag(scene.project(h.pin.x, h.heightAt(h.pin.x, h.pin.z) + 3, h.pin.z), distToPin(h, b));
    hud.dist(distToPin(h, b));
    hud.wind(windOf(V.R), V.phase === 'intro' ? 0 : V.aim);
    hud.drawMap(h, b, V.phase === 'intro' ? null : V.preview, V.aim, V.R.players.filter((q) => q !== V.cur && !q.done && q.ball).map((q) => ({ x: q.ball.x, z: q.ball.z, color: q.color })), V.phase === 'intro' ? [] : V.marks);
  } else hud.pinTag(null);
  scene.frame(dt);
}

// qualité automatique : durée médiane d'une image sur 2 s, sans les à-coups isolés (chargement d'un trou, onglet
// en arrière-plan). Deux mesures de suite sous 50 images/s : la scène baisse d'un cran (résolution, puis effets).
const AQ = { t0: 0, ms: [], bad: 0 };
function autoQuality(now, ms) {
  if (document.hidden || V.phase === 'title' || V.phase === 'card') { AQ.t0 = 0; AQ.bad = 0; return; }
  if (!AQ.t0) { AQ.t0 = now; AQ.ms = []; return; }
  if (ms < 400) AQ.ms.push(ms);
  if (now - AQ.t0 < 2000) return;
  const s = AQ.ms.sort((a, b) => a - b), med = s[s.length >> 1];
  AQ.t0 = now; AQ.ms = [];
  if (s.length < 8 || med < 20) { AQ.bad = 0; return; }
  if (++AQ.bad < 2) return;
  AQ.bad = 0;
  const k = scene.lowerQuality();
  if (k && QS.has('debug')) console.info('qualité réduite :', k, Math.round(1000 / med) + ' i/s');
}

function teardown() {
  if (!alive) return;
  alive = false;
  cancelAnimationFrame(raf);
  V.session && V.session.stop();
  input.dispose(); scene && scene.dispose(); sfx.dispose();
  removeEventListener('pagehide', teardown);
}
addEventListener('pagehide', teardown);

if (QS.has('debug')) {
  // step(n) : avance de n images à 60 i/s, même quand la page est en arrière-plan (tests)
  const step = (n = 1) => { for (let i = 0; i < n; i++) loop(last + 1000 / 60); };
  window.__golf = { V, scene, hud, sfx, step, get session() { return V.session; } };
}
if (scene) {
  raf = requestAnimationFrame(loop);
  if (H.embedded) H.on('init', boot);
  else boot({ role: 'solo', myId: 0 });
}
