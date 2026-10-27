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
import { HUD, loadingHtml, scorecardHtml, scoreName, fmtM, loadSetup, esc } from './view/hud.js';
import { createHome } from './view/home.js';
import { icon, fillIcons } from './view/icons.js';
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
const sfx = new Sfx(new URL('./sounds/', import.meta.url).href, new URL('./music/', import.meta.url).href);
fillIcons();
// ?mute : aucun son, sans toucher au réglage du joueur (tests automatiques)
if (QS.has('mute')) sfx.silent = true;
// le son est actif d'emblée : tout de suite si le navigateur le permet (partie lancée depuis le Hub, site déjà
// fréquenté), sinon dès le premier geste, quel qu'il soit
sfx.unlock();
for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, () => sfx.unlock(), { capture: true, passive: true });
// page cachée : personne ne m'attend pour avancer (et à mon tour, l'hôte jouera pour moi au bout de quelques secondes)
document.addEventListener('visibilitychange', () => { V.session && V.session.away(document.hidden); catchUp(); pump(); });
let home = null;
let scene = null;
try {
  scene = createScene($('#stage'), {
    onLost: () => {
      if (window.DDLogger) window.DDLogger.logCrash('CRASH_WEBGL_CONTEXT_LOST', 'Perte du contexte graphique WebGL dans Birdie Party', { game: 'golf' });
      hud.toast('Affichage 3D interrompu : recharge la page', 6);
    }
  });
} catch (e) {
  console.error(e);
  if (window.DDLogger) window.DDLogger.logCrash('CRASH_WEBGL_CONTEXT_LOST', 'Échec d\'initialisation WebGL dans Birdie Party : ' + (e && e.message ? e.message : e), { stack: e && e.stack, game: 'golf' });
  $('#screen').innerHTML = '<div class="sheet"><h2>Oups</h2><p>Ton navigateur ne peut pas afficher la 3D (WebGL).</p></div>';
}

// ------------------------------------------------------------------ état de la vue
const V = {
  phase: 'title', role: 'solo', me: null, session: null, settings: {},
  R: null, hole: null, hi: -1, queue: [], busy: false, pars: [],
  cur: null, mine: false, ball: null, club: 0, aim: 0, power: 0, putt: 20, preview: null, dirty: true, view: false,
  golfers: new Map(), localSwing: null, poseT: 0,
  shot: null, playT: 0, evI: 0, timer: 0, oohed: false, introT: 0, outcome: null,
};
const golferOf = (p) => {
  if (!V.golfers.has(p.id)) {
    const lk = (typeof p.look === 'number' && !isNaN(p.look)) ? Math.abs(p.look | 0) : ((typeof p.id === 'number' ? p.id : 0) + 1);
    V.golfers.set(p.id, scene.addGolfer({ shirt: p.color, skin: lk % 5, hair: (lk * 3 + 1) % 5 }));
  }
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
$('#btnMute').innerHTML = icon(sfx.muted ? 'soundOff' : 'soundOn');
// clic pendant le survol : on passe directement au jeu
input.listen($('#stage'), 'pointerdown', () => { if (V.phase === 'intro') endIntro(); else if (V.phase === 'replay') endReplay(); });

function onKey(k, down) {
  if (!down) return;
  if (k === 'KeyM' && V.phase !== 'title') return toggleMute();
  if (V.hole && k === 'KeyZ') return hud.cycleZoom();
  if (V.hole && k === 'KeyR') return hud.toggleRelief();
  if (V.phase === 'intro' && (k === 'Enter' || k === 'Escape')) return endIntro();
  if (V.phase === 'replay' && (k === 'Enter' || k === 'Escape' || k === 'Space')) return endReplay();
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
function toggleMute() { sfx.setMuted(!sfx.muted); $('#btnMute').innerHTML = icon(sfx.muted ? 'soundOff' : 'soundOn'); }
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
  // Si le jeu est ouvert en solo HORS du Hub, on affiche l'écran titre
  if (!H.embedded && role === 'solo') {
    if (QS.has('play')) return quickPlay();
    return showTitle();
  }
  // Lancé depuis le Hub (mode solo, hôte ou invité) : on démarre directement avec les réglages choisis dans le Hub
  V.settings = info.settings || {};
  $('#screen').innerHTML = loadingHtml(role === 'host' ? 'Préparation du parcours' : role === 'solo' ? 'Lancement du parcours' : 'On rejoint la partie');
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
    if (role === 'solo') {
      setTimeout(() => V.session && V.session.begin(), 50);
    } else {
      let started = false;
      const tryBegin = () => {
        if (started) return;
        started = true;
        if (V.session) V.session.begin();
      };
      // Démarre dès que les joueurs sont prêts dans le Hub, avec un filet de sécurité à 2500ms
      const checkReady = () => {
        const others = H.players.filter((p) => p.id !== H.info.myId);
        if (others.length && others.every((p) => H.readyMap[p.id] === 'golf')) tryBegin();
      };
      H.on('roster', checkReady);
      setTimeout(tryBegin, 2500);
    }
  }
}
// raccourci de test : ?play lance directement une partie solo (?course=mer&bots=2)
function quickPlay() {
  const s = loadSetup();
  V.settings = { ...s, course: QS.get('course') || s.course, bots: QS.has('bots') ? +QS.get('bots') : s.bots, startHole: +QS.get('hole') || 0, time: QS.get('time') || s.time, teams: QS.get('teams') || s.teams };
  $('#screen').innerHTML = loadingHtml();
  startSession('solo');
}
// accueil : survol des trous, logo, réglages ; « Jouer » lance une partie solo (avec bots)
function showTitle() {
  V.phase = 'title';
  hud.show(false);
  for (const g of V.golfers.values()) g.root.visible = false;
  home = createHome({
    root: $('#screen'), scene, sfx, hole: holeByNumber,
    onPlay: (set) => {
      home.dispose(); home = null;
      V.settings = set;
      $('#screen').innerHTML = loadingHtml();
      V.queue = []; V.busy = false; V.hi = -1; V.R = null;
      startSession('solo');
    },
  });
}

// ------------------------------------------------------------------ événements de la session, traités dans l'ordre
function onEvent(e) {
  if (e.type === 'pose') return onPose(e);
  if (e.type === 'note') return hud.toast(e.text, 3.5);
  V.queue.push(e);
  if (e.type === 'shot') catchUp();
  pump();
}
// un nouveau coup arrive alors qu'on regarde encore le précédent (ou la page revient après une absence) : on finit
// tout de suite la présentation ou le coup en cours pour rattraper les autres
function catchUp() {
  if (document.hidden || !behind()) return;
  if (V.phase === 'intro') endIntro();
  else if (V.shot && ['down', 'fly', 'after', 'replay'].includes(V.phase)) {
    const r = V.shot.ev.res;
    document.body.classList.remove('replaying');
    if (r.kind === 'rest') scene.setBall(r.end.x, r.end.y, r.end.z);
    finishShot();
  }
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
    try {
      if (prev && prev.phase !== 'over') await holeCard(R);
      finalCard(R);
    } catch (e) {
      console.error(e);
      if (window.DDLogger) window.DDLogger.logCrash('CRASH_JS_ERROR', 'Erreur carte finale Birdie Party : ' + (e && e.message ? e.message : e), { stack: e && e.stack, game: 'golf' });
    } finally {
      V.busy = false;
    }
    return;
  }
  if (R.hi !== V.hi) {
    V.busy = true;
    try {
      if (V.hi >= 0 && prev && prev.hi !== R.hi && R.hi > 0) await holeCard(R);
      await loadHole(R);
    } catch (e) {
      console.error('Erreur chargement trou', e);
      if (window.DDLogger) window.DDLogger.logCrash('CRASH_JS_ERROR', 'Erreur chargement trou ' + (R.hi + 1) + ' (' + (currentHole(R)?.name || '') + ') : ' + (e && e.message ? e.message : e), { stack: e && e.stack, game: 'golf' });
      hud.toast('Erreur de chargement du trou, passage au suivant...', 4);
    } finally {
      V.busy = false;
    }
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
  // derrière l'écran de chargement, rien à dessiner : tout le temps va à la construction du trou
  V.loading = true;
  try { await scene.loadHole(hole, { theme: hole.theme, wind, time: R.time, slice: 45 }); } finally { V.loading = false; }
  scene.setWind(wind);
  // mini-carte : photo aérienne du trou, prise une fois le décor posé
  try {
    const frame = hud.mapFrame(hole), scale = hud.mapScale(frame);
    hud.setMap(frame, { photo: scene.renderMap(frame, { scale }), relief: () => scene.renderMap(frame, { relief: true, scale }) });
  } catch (e) {
    console.warn('Mini-carte non initialisée :', e);
  }
  sfx.ambience(hole.theme);
  // l'écran de chargement s'efface sur le survol qui commence
  const scr = $('#screen'), ld = scr.firstElementChild;
  if (ld) { ld.classList.add('out'); setTimeout(() => { if (scr.firstElementChild === ld) scr.innerHTML = ''; }, 600); }
  // survol du trou, depuis le départ jusqu'au green
  V.phase = 'intro'; V.introT = 0;
  hud.show(true); hud.controls(false); hud.gauge(0, false); $('#turn').hidden = true;
  scene.setMarker(null, false); scene.setAimDots(null, null, false); scene.showGrid(false); scene.showBall(false); scene.setTee(null, false); scene.setOthers([]);
  for (const g of V.golfers.values()) g.root.visible = false;
  hud.hole(hole, 1); hud.players(stripList(), V.R.teams); hud.dist(hole.length); hud.lie('tee');
  hud.banner(`Trou ${hole.n}`, '', `Par ${hole.par} · ${hole.length} m · ${hole.name}`, INTRO - 0.6);
  sfx.holeStart();
  introCamera(0, true);
  await new Promise((r) => {
    V.introDone = r;
    if (behind()) endIntro();
    setTimeout(() => { if (V.phase === 'intro') endIntro(); }, (INTRO + 1) * 1000);
  });
}
// en retard sur la partie (page restée cachée, machine lente) : des coups attendent déjà leur tour, ou personne ne
// regarde ; on saute les présentations et on joue les coups sans animation pour rattraper les autres
const behind = () => document.hidden || V.queue.some((e) => e.type === 'shot');
function endIntro() {
  if (V.phase !== 'intro') return;
  hud.hideBanner();
  V.phase = 'cut';
  const r = V.introDone; V.introDone = null; r && r();
}

// carte de score entre deux trous (ou après le dernier)
function holeCard(R) {
  return new Promise((res) => {
    V.phase = 'card';
    hud.controls(false); hud.gauge(0, false); $('#turn').hidden = true;
    const holes = R.holes.map((n) => holeByNumber(n));
    $('#screen').innerHTML = scorecardHtml(R, holes, { title: R.phase === 'over' ? 'Dernier trou joué !' : `Après le trou ${holes[R.hi - 1].n}` });
    sfx.ui('card');
    setTimeout(() => { $('#screen').innerHTML = ''; res(); }, (behind() ? 0.8 : CARD_T) * 1000);
  });
}
function finalCard(R) {
  V.phase = 'over';
  hud.show(false);
  const holes = R.holes.map((n) => holeByNumber(n));
  let rk = ranking(R, V.pars), shown = R;
  if (R.teams) {
    // en équipes : une ligne par équipe (ses joueurs ont tous le même score)
    const lead = R.teams.map((t, k) => R.players.find((p) => p.team === k)).filter(Boolean);
    shown = { ...R, players: lead.map((p) => ({ ...p, name: R.teams[p.team].name, color: R.teams[p.team].color })) };
    const mine = R.players.find((p) => p.id === V.me.id);
    rk = ranking(shown, V.pars).map((x) => ({ ...x, id: x.team === mine?.team ? V.me.id : x.id }));
  }
  const canReplay = V.role !== 'guest';
  $('#screen').innerHTML = scorecardHtml(shown, holes, { final: true, ranking: rk, canReplay, embedded: H.embedded, title: shown.players.length > 1 ? `${rk[0].name} gagne la partie !` : 'Partie terminée !' });
  sfx.react(rk[0].id === V.me.id ? 'birdie' : 'par');
  const again = $('#btnAgain');
  if (again) again.onclick = () => { sfx.ui('confirm'); $('#screen').innerHTML = loadingHtml(); V.hi = -1; V.queue = []; V.busy = false; V.session.begin(); };
  $('#btnQuit').onclick = () => {
    sfx.ui('close');
    if (H.embedded) { teardown(); H.exit(); }
    else { V.session && V.session.stop(); V.session = null; V.queue = []; V.busy = false; V.hi = -1; V.R = null; V.hole = null; showTitle(); }
  };
}

// ------------------------------------------------------------------ tour de jeu
function stripList() {
  const t = totals(V.R, V.pars);
  return V.R.players.map((p, i) => ({ name: p.name, color: p.color, toPar: t[i].toPar, cur: i === V.R.turn && V.phase !== 'intro', done: p.done && V.R.phase === 'play', team: p.team, played: p.played }));
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
  // les balles des autres ; en équipes, celles que les coéquipiers viennent de jouer depuis le même endroit
  const others = R.teams
    ? R.players.filter((q) => q.pending && q.pending.ball && q.team === P.team).map((q) => ({ x: q.pending.ball.x, z: q.pending.ball.z, color: q.color }))
      .concat(R.players.filter((q) => q.team !== P.team && !q.done && q.ball && q.ball.lie !== 'tee').filter((q, k, a) => a.findIndex((o) => o.team === q.team) === k).map((q) => ({ x: q.ball.x, z: q.ball.z, color: R.teams[q.team].color })))
    : R.players.filter((q, k) => k !== i && !q.done && q.ball && !(q.ball.lie === 'tee' && V.ball.lie === 'tee')).map((q) => ({ x: q.ball.x, z: q.ball.z, color: q.color }));
  scene.setOthers(others);
  scene.showPole(!(V.club === PUTTER && distToPin(hole, V.ball) < 14));
  scene.showGrid(V.club === PUTTER);
  hud.hole(hole, P.strokes + 1); hud.lie(V.ball.lie);
  refreshShotHud();
  hud.controls(V.mine); hud.gauge(0, true);
  // annonce du tour
  const t = $('#turn');
  const team = R.teams && P.team >= 0 ? `<small>${esc(R.teams[P.team].name)}</small>` : '';
  const call = V.mine ? (R.players.length > 1 ? `<i style="background:${esc(P.color)}"></i>À toi de jouer !` : '') : `<i style="background:${esc(P.color)}"></i>Au tour de ${esc(P.name)}`;
  t.innerHTML = call ? call + team : '';
  t.hidden = !t.innerHTML; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(V.turnT); V.turnT = setTimeout(() => { t.hidden = true; }, 2200);
  if (R.players.length > 1) sfx.ui(V.mine ? 'confirm' : 'switch');
  V.phase = V.mine ? 'aim' : 'watch';
  hud.players(stripList(), V.R.teams);
  // fondu enchaîné vers la caméra posée derrière la balle du joueur suivant
  if (!document.hidden) scene.dissolve(0.6);
  aimCamera(true);
  sendPose();
  // je vois ce tour : l'hôte peut faire jouer un bot
  V.session && V.session.ready(R.shotNo);
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
  // en retard sur la partie : pas d'animation, la balle est posée là où elle s'arrête
  if (behind()) {
    const r = ev.res;
    if (r.kind === 'rest') scene.setBall(r.end.x, r.end.y, r.end.z);
    V.localSwing = null;
    finishShot();
    return;
  }
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
  V.phase = 'fly';
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
  const end = r.kind === 'water' ? ev.from : r.end, d = Math.hypot(end.x - hole.pin.x, end.z - hole.pin.z);
  const g = golferOf(P), trees = V.shot.sim.events.some((e) => e.type === 'tree' || e.type === 'trunk');
  const who = V.mine || V.R.players.length === 1 ? '' : `${P.name} · `;
  if (r.kind === 'holed') {
    const s = ev.strokes, diff = s - hole.par, name = scoreName(s, hole.par);
    hud.banner(name, s === 1 || diff <= -2 ? 'gold' : diff < 0 ? 'good' : diff === 0 ? '' : 'bad', s === 1 ? `${who}du premier coup !` : `${who}${s} coups`, 3);
    sfx.react(s === 1 ? 'holeinone' : diff <= -2 ? 'eagle' : diff === -1 ? 'birdie' : diff === 0 ? 'par' : diff === 1 ? 'bogey' : 'worse');
    g.cheer();
    V.shot.cam = null; // gros plan sur le trou à la place
    holeCamera(g);
    return 3.6;
  }
  if (r.kind === 'water') { hud.banner('Plouf !', 'bad', `${who}on rejoue du même endroit · +1`, 2.4); sfx.react('water'); g.sulk(); return 2.8; }
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
// ralenti des beaux coups : trou réussi hors du green (trou en un, chip, eagle), long putt rentré, approche collée au drapeau
function replayWorthy() {
  if (V.forceReplay) return true; // tests (?debug)
  const ev = V.shot.ev, r = ev.res, h = V.hole, club = CLUBS[ev.params.club];
  const d0 = Math.hypot(ev.from.x - h.pin.x, ev.from.z - h.pin.z);
  if (r.kind === 'holed') return !club.putter || d0 > 8;
  if (r.kind !== 'rest' || club.putter) return false;
  return Math.hypot(r.end.x - h.pin.x, r.end.z - h.pin.z) < 2.5 && d0 > 50;
}
function startReplay() {
  V.shot.replayed = true;
  V.phase = 'replay'; V.playT = 0; V.evI = 0; V.timer = 1.4;
  // le même plan que pendant le coup, mais depuis l'autre côté (si on y voit quelque chose)
  const from = V.shot.ev.from;
  V.replayCam = shotCamera(true);
  scene.trailClear();
  scene.dissolve(0.5);
  scene.camTo(V3(V.replayCam.pos.x, V.replayCam.pos.y, V.replayCam.pos.z), V3(from.x, ground(from.x, from.z), from.z), 3, true); document.body.classList.add('replaying');
}
function replayCamera(p, dt) { trackShot(V.replayCam, p, dt); }
function endReplay() {
  if (V.phase !== 'replay') return;
  scene.dissolve(0.5);
  document.body.classList.remove('replaying');
  const r = V.shot.ev.res;
  if (r.kind !== 'water') scene.setBall(r.end.x, r.end.y, r.end.z);
  finishShot();
}

function finishShot() {
  const ev = V.shot.ev;
  V.shot = null;
  sfx.duck(false);
  V.phase = 'wait';
  if (V.session) V.session.done(ev.no);
  unbusy();
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
// pendant un coup, comme à la télé : on voit la balle partir depuis derrière le golfeur, puis un fondu enchaîné passe
// sur une caméra posée près du point de chute, de côté, qui regarde la balle arriver et rouler (pour un putt ou une
// petite approche : au ras du green, près du trou). La caméra ne suit jamais la balle ; elle glisse lentement.
function flyCamera(p, dt) {
  const sh = V.shot, club = CLUBS[sh.ev.params.club];
  if (!sh.cam) {
    const long = sh.sim.n > 80 && (!club.putter || Math.hypot(sh.ev.from.x - V.hole.pin.x, sh.ev.from.z - V.hole.pin.z) > 6);
    if (long && V.playT > (club.putter ? 0.35 : 0.5)) {
      sh.cam = shotCamera(false);
      scene.dissolve(0.55);
      scene.camTo(V3(sh.cam.pos.x, sh.cam.pos.y, sh.cam.pos.z), V3(p.x, p.y, p.z), 6, true);
    } else {
      // le départ (ou un tout petit coup) : derrière le golfeur, on suit la balle des yeux
      scene.cam.tLook.lerp(V3(p.x, p.y, p.z), club.putter ? 0.08 : 0.25); scene.cam.k = 3;
      return;
    }
  }
  trackShot(sh.cam, p, dt);
}
// caméra d'un coup : près du point de chute (ou du trou), du côté le plus dégagé (relief, arbres) ; `other` prend
// l'autre côté, pour le ralenti, sauf s'il est bien plus bouché
function shotCamera(other) {
  const sim = V.shot.sim, h = V.hole, from = V.shot.ev.from, land = sim.carry || sim.end;
  const ax = land.x - from.x, az = land.z - from.z, L = Math.hypot(ax, az) || 1, A = { x: ax / L, z: az / L }, R = { x: -A.z, z: A.x };
  // putt ou petite approche vers le green : au ras du green, près du trou ; sinon près du point de chute
  const near = CLUBS[V.shot.ev.params.club].putter || (L < 30 && Math.hypot(land.x - h.pin.x, land.z - h.pin.z) < 35);
  const at = near ? { x: h.pin.x, z: h.pin.z } : { x: land.x, z: land.z }, side = near ? 3.2 : Math.min(17, 6 + L * 0.12), back = near ? 2.5 : Math.min(7, 2 + L * 0.05), up = near ? 0.7 : 4.5;
  const ty = ground(at.x, at.z) + 0.4;
  // de chaque côté, plus ou moins écartée, à hauteur d'homme ou un peu plus haut : on garde la position la plus dégagée
  const pose = (sd, lift) => {
    const x = at.x + R.x * sd + A.x * back, z = at.z + R.z * sd + A.z * back;
    let y = ground(x, z) + up + lift;
    if (h.coast) y = Math.max(y, h.coast.level + up + lift);
    for (const t of h.treesNear(x, z)) if (Math.hypot(t.x - x, t.z - z) < t.r + 1.5) y = Math.max(y, t.y + t.h + 1.5);
    // les arbres proches, devant la caméra, mangent une partie de l'image
    const vx = at.x - x, vz = at.z - z, vl = Math.hypot(vx, vz) || 1;
    let cost = sightCost(x, y, z, at, ty) + lift * 0.12 + (Math.abs(sd) < side ? 0.6 : 0), clutter = 0;
    for (const t of h.treesNear(x, z)) {
      const dx = t.x - x, dz = t.z - z, d = Math.hypot(dx, dz);
      if (d < 22 + t.r && (dx * vx + dz * vz) / (d * vl || 1) > 0.2 && t.y + t.h > y - 2) clutter++;
    }
    return { x, y, z, cost: cost + Math.min(6, clutter) };
  };
  const best = (sd) => [sd, sd * 0.55].flatMap((s) => [0, near ? 1.2 : 7].map((lift) => pose(s, lift))).sort((p, q) => p.cost - q.cost)[0];
  const [a, b] = [best(side), best(-side)].sort((p, q) => p.cost - q.cost);
  return { pos: other && b.cost <= a.cost + 1 ? b : a, at, near, t: 0, turn: other ? -1 : 1 };
}
// obstacles entre la caméra et le point filmé : relief au-dessus de la ligne de vue, houppiers qu'elle traverse
function sightCost(x0, y0, z0, at, ty) {
  let n = 0;
  for (let k = 1; k < 12; k++) {
    const f = k / 12, x = x0 + (at.x - x0) * f, z = z0 + (at.z - z0) * f, y = y0 + (ty - y0) * f;
    if (ground(x, z) > y - 0.2) n++;
    for (const t of V.hole.treesNear(x, z)) if (Math.hypot(t.x - x, t.z - z) < t.r * 0.9 && t.y + t.h * 0.95 > y && t.y + t.h * 0.25 < y) { n++; break; }
  }
  return n;
}
// la caméra regarde la balle et tourne très lentement autour du point filmé : l'image n'est jamais figée
function trackShot(c, p, dt) {
  c.t += dt;
  const a = c.t * (c.near ? 0.05 : 0.025) * c.turn, dx = c.pos.x - c.at.x, dz = c.pos.z - c.at.z;
  const x = c.at.x + dx * Math.cos(a) - dz * Math.sin(a), z = c.at.z + dx * Math.sin(a) + dz * Math.cos(a);
  scene.camTo(V3(x, Math.max(c.pos.y, ground(x, z) + (c.near ? 0.6 : 3)), z), V3(p.x, p.y, p.z), 6);
}
// gros plan quand la balle tombe : depuis l'autre côté du trou, on voit le golfeur sauter de joie
function holeCamera(g) {
  const h = V.hole, gp = g.root.position, ax = gp.x - h.pin.x, az = gp.z - h.pin.z, L = Math.hypot(ax, az) || 1;
  const far = Math.min(4, 1.6 + L * 0.25), py = h.heightAt(h.pin.x, h.pin.z);
  scene.camTo(V3(h.pin.x - ax / L * far, py + 0.9 + Math.min(L, 25) * 0.06, h.pin.z - az / L * far), L > 25 ? V3(h.pin.x, py, h.pin.z) : V3((h.pin.x + gp.x) / 2, py + 0.5, (h.pin.z + gp.z) / 2), 1.6);
}
// ligne de jeu du survol : rééchantillonnée tous les 2 m, prolongée avant le départ et après le green, puis lissée
// (les coudes deviennent des courbes, la caméra ne tourne jamais d'un coup)
function introPath(h) {
  if (V.introPath && V.introPath.hole === h) return V.introPath;
  const c = h.center, raw = [];
  for (let i = 0; i < c.length - 1; i++) {
    const [x0, z0] = c[i], [x1, z1] = c[i + 1], n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 2));
    for (let k = 0; k < n; k++) raw.push([x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n]);
  }
  raw.push(c[c.length - 1]);
  const ext = (a, b, k) => { const L = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1; return [a[0] + (a[0] - b[0]) / L * 2 * k, a[1] + (a[1] - b[1]) / L * 2 * k]; };
  const W = 22, M = 100, a = raw[0], b = raw[Math.min(3, raw.length - 1)], y = raw[raw.length - 1], z = raw[Math.max(0, raw.length - 4)];
  let P = [...Array.from({ length: M }, (_, k) => ext(a, b, M - k)), ...raw, ...Array.from({ length: M }, (_, k) => ext(y, z, k + 1))];
  for (let pass = 0; pass < 3; pass++) P = P.map((_, i) => { let x = 0, zz = 0, n = 0; for (let k = Math.max(0, i - W); k <= Math.min(P.length - 1, i + W); k++) { x += P[k][0]; zz += P[k][1]; n++; } return [x / n, zz / n]; });
  const S = [0]; for (let i = 1; i < P.length; i++) S.push(S[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const s0 = S[M], tot = S[M + raw.length - 1] - s0;
  const on = (s) => {
    const d = clamp(s + s0, 0, S[S.length - 1]);
    let i = 1; while (i < S.length - 1 && S[i] < d) i++;
    const k = (d - S[i - 1]) / ((S[i] - S[i - 1]) || 1), dx = P[i][0] - P[i - 1][0], dz = P[i][1] - P[i - 1][1], L = Math.hypot(dx, dz) || 1;
    return { x: P[i - 1][0] + dx * k, z: P[i - 1][1] + dz * k, dx: dx / L, dz: dz / L };
  };
  // trou en lacets (des virages qui repartent dans l'autre sens) : suivre chaque épingle donnerait le tournis ; on glisse
  // vers la ligne droite départ → green. Une grande courbe régulière (une baie, un croissant), elle, se suit très bien.
  let turn = 0, net = 0;
  for (let i = 1; i < c.length - 1; i++) {
    let d = Math.atan2(c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1]) - Math.atan2(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]);
    d = Math.atan2(Math.sin(d), Math.cos(d)); turn += Math.abs(d); net += d;
  }
  const A = on(0), B = on(tot), cx = B.x - A.x, cz = B.z - A.z, cl = Math.hypot(cx, cz) || 1, w = clamp(((turn - Math.abs(net)) * 180 / Math.PI - 130) / 60, 0, 1);
  // at(s) : point et direction à s mètres du départ (négatif = derrière le départ) ; on rejoint la ligne de jeu peu à
  // peu dans la seconde moitié, pour arriver au green par le fairway (et pas au milieu des arbres)
  const back = (s) => { const t = clamp((s - tot * 0.45) / (tot * 0.55 - 40), 0, 1); return t * t * (3 - 2 * t); };
  const at = (s) => {
    const p = on(s), k = w * (1 - back(s));
    if (!k) return p;
    const f = s / tot, dx = p.dx + (cx / cl - p.dx) * k, dz = p.dz + (cz / cl - p.dz) * k, L = Math.hypot(dx, dz) || 1;
    return { x: p.x + (A.x + cx * f - p.x) * k, z: p.z + (A.z + cz * f - p.z) * k, dx: dx / L, dz: dz / L };
  };
  return (V.introPath = { hole: h, at, tot, w, y0: h.heightAt(h.tee.x, h.tee.z), y1: h.heightAt(h.pin.x, h.pin.z) });
}
// présentation du trou : on part haut derrière le départ, on file le long du jeu en descendant, et on se pose face
// au drapeau ; le regard reste assez loin devant pour que le trou soit sous le bandeau « Trou n », jamais à la verticale
function introCamera(u, snap) {
  // départ déjà lancé, arrivée encore en mouvement : la caméra n'est jamais à l'arrêt avant le fondu vers le joueur
  const h = V.hole, P = introPath(h), tot = P.tot, e = (u ** 3 - 2 * u * u + u) * 0.5 + (3 * u * u - 2 * u ** 3) + (u ** 3 - u * u) * 0.2;
  const back = 30 + tot * 0.05, stop = clamp(tot * 0.2, 32, 60);
  const s = -back + (tot - stop + back) * e, c = P.at(s);
  // hauteur au-dessus d'une pente douce départ → green (pas du sol sous la caméra : on ne plonge pas dans les ravins)
  const base = (t) => P.y0 + (P.y1 - P.y0) * clamp(t / tot, 0, 1);
  const H = clamp(16 + tot * 0.07, 28, 52) * (1 - e) + 13 * e;
  const side = h.n % 2 ? 1 : -1, off = Math.sin(u * Math.PI) * Math.min(16, tot * 0.04) * side;
  const x = c.x - c.dz * off, z = c.z + c.dx * off;
  let gy = ground(x, z);
  for (const [dx, dz] of [[10, 0], [-10, 0], [0, 10], [0, -10]]) gy = Math.max(gy, ground(x + dx, z + dz));
  // et jamais dans les branches : chaque arbre proche repousse la caméra vers le haut (en cône, sans à-coup)
  for (const t of h.treesNear(x, z)) gy = Math.max(gy, t.y + t.h - 3 - Math.max(0, Math.hypot(t.x - x, t.z - z) - t.r) * 0.6);
  const y = Math.max(base(s) + H, gy + 9);
  // sujet du plan : le drapeau s'il est à portée de vue, sinon un point du fairway loin devant ; on le cadre un peu
  // sous le centre de l'image (le bandeau « Trou n » occupe le haut), de plus en plus bas en approchant
  const ss = Math.min(s + Math.max(120, (y - base(s)) * 3.4), tot), sp = P.at(ss), end = P.at(tot);
  const k = clamp(1 - (tot - ss) / 60, 0, 1), sx = sp.x + (h.pin.x - end.x) * k, sz = sp.z + (h.pin.z - end.z) * k;
  const D = Math.max(1, Math.hypot(sx - x, sz - z)), pitch = Math.atan2(y - base(ss), D) - (2.5 + 3.5 * e) * Math.PI / 180;
  scene.camTo(V3(x, y, z), V3(sx, y - D * Math.tan(pitch), sz), snap ? 1 : 4, snap);
}

// ------------------------------------------------------------------ boucle
let last = performance.now(), raf = 0, alive = true;
function loop(now) {
  if (!alive) return;
  raf = requestAnimationFrame(loop);
  const ms = Math.max(0, now - last), dt = Math.min(0.05, ms / 1000); last = Math.max(last, now);
  input.update();
  hud.tick(dt);
  if (!scene) return;
  if (!V.hole) { home && home.update(dt); scene.frame(dt); return; }
  if (V.loading) return;
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
    // mon coup n'est jamais revenu de l'hôte (perdu en route, ou refusé) : on rend la main et on redemande l'état
    else if (!V.shot && V.localSwing && performance.now() - V.localSwing.t0 > 7000) {
      V.localSwing = null; V.session && V.session.resync();
      hud.toast('Le coup n\'est pas parti : rejoue', 2.5);
      setTurn();
    }
  } else if (V.phase === 'fly') {
    const sim = V.shot.sim, P = sim.path, putter = CLUBS[V.shot.ev.params.club].putter;
    // une fois au sol, la balle d'un coup roule en accéléré et la toute fin, quand elle se traîne loin du trou, est
    // sautée : le résultat est connu, personne n'attend pour rien. Un putt garde son suspense jusqu'au bout.
    const f0 = V.playT * 60, landed = !putter && sim.events.some((e) => e.type === 'bounce' && e.i <= f0);
    V.playT += dt * (landed ? 1.7 : 1);
    if (landed) {
      const e = (sim.n - 1) * 3, c = Math.min(sim.n - 1, Math.floor(V.playT * 60)) * 3;
      if (Math.hypot(P[e] - P[c], P[e + 2] - P[c + 2]) < 1.2 && Math.hypot(P[e] - V.hole.pin.x, P[e + 2] - V.hole.pin.z) > 4) V.playT = (sim.n - 1) / 60;
    }
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
    V.shot.last = p;
    flyCamera(p, dt);
    hud.dist(dp);
    if (f >= sim.n - 1) {
      // arrivée : on se cale sur le résultat de l'hôte
      const r = V.shot.ev.res;
      if (r.kind !== 'water') scene.setBall(r.end.x, r.end.y, r.end.z);
      V.phase = 'after'; V.timer = 0.55;
    }
  } else if (V.phase === 'after') {
    scene.trailFade(dt);
    if (V.shot.cam && V.shot.last) trackShot(V.shot.cam, V.shot.last, dt);
    V.timer -= dt;
    if (V.timer <= 0 && !V.outcome) {
      V.outcome = true; V.timer = outcome(); hud.players(stripList(), V.R.teams);
      const o = V.shot.ev.out;
      if (o.resolved && o.best >= 0 && !o.holed && V.R.teams) { const b = V.R.players[o.best]; hud.toast(`Meilleure balle : ${b.name}`, 2.4); }
    }
    else if (V.timer <= 0 && V.outcome) { if (!V.shot.replayed && replayWorthy()) startReplay(); else finishShot(); }
  } else if (V.phase === 'replay') {
    // le ralenti : la balle refait son vol, filmée depuis le point de chute
    const sim = V.shot.sim, P = sim.path;
    V.playT += dt * 0.55;
    const f = Math.min(sim.n - 1, V.playT * 60), i = Math.floor(f), k = f - i, j = Math.min(sim.n - 1, i + 1);
    const p = { x: P[i * 3] + (P[j * 3] - P[i * 3]) * k, y: P[i * 3 + 1] + (P[j * 3 + 1] - P[i * 3 + 1]) * k, z: P[i * 3 + 2] + (P[j * 3 + 2] - P[i * 3 + 2]) * k };
    scene.showBall(true); scene.setBall(p.x, p.y, p.z); scene.trailPush(p.x, p.y + 0.03, p.z);
    while (V.evI < sim.events.length && sim.events[V.evI].i <= f) {
      const e = sim.events[V.evI++];
      if (e.type === 'bounce') sfx.bounce(e.surf, e.v * 0.7);
      else if (e.type === 'cup') { sfx.cup(); sfx.react('par'); }
    }
    replayCamera(p, dt * 0.55);
    if (f >= sim.n - 1 && (V.timer -= dt) <= 0) endReplay();
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
  window.__golf = { V, scene, hud, sfx, step, introCamera, get session() { return V.session; } };
}
if (scene) {
  raf = requestAnimationFrame(loop);
  if (H.embedded) H.on('init', boot);
  else boot({ role: 'solo', myId: 0 });
}
