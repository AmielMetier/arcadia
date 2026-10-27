// Island Rush — démarrage et boucle de jeu. L'île vient de sa graine (engine/map.js), le monde solide
// d'engine/world.js, la partie d'engine/sim.js (pas fixe de 1/60 s), les bots d'engine/ai.js ; la vue 3D de view/.
// En solo, la partie tourne ici. À plusieurs, l'hôte la fait tourner (bots compris) et envoie son état (engine/net.js) ;
// chaque invité tient une copie à jour, prédit son propre déplacement, dessine les autres un peu en retard et envoie
// ses commandes. Si l'hôte s'en va, le Hub en désigne un autre qui reprend la partie là où elle en était.
// Le jeu ne parle jamais au réseau directement : tout passe par HubBridge.
import { generateMap, ILE, GR, PROPS } from './engine/map.js';
import { buildWorld } from './engine/world.js';
import { MOVE } from './engine/player.js';
import { createSim, DT, SHOULDER, REVIVE, BLEED, DOWN_HP, PING_T } from './engine/sim.js';
import { WEAPONS, ITEMS, RARITY, itemLabel, MATERIALS } from './engine/items.js';
import { createBuild, slotFor, COST, PIECES } from './engine/build.js';
import { createAI } from './engine/ai.js';
import { makeTeams, TEAM_LABEL } from './engine/teams.js';
import { skillOf, botLevels, botMix, HIST_MAX } from './engine/skill.js';
import { snapshot, applySnapshot, mirrorEvent, fullState, applyFull, cleanInput, predictStep, MODES } from './engine/net.js';
import { createScene } from './view/scene.js';
import { createActors } from './view/actors.js';
import { createFx } from './view/fx.js';
import { createHud } from './view/hud.js';
import { createBuilds } from './view/builds.js';
import { createDrops } from './view/drops.js';
import { createSound } from './view/sound.js';
import { setKit, renderIcons } from './view/weapons.js';
import { CHARACTERS } from './view/kit.js';
import { renderPortraits } from './view/soldier.js';
import { Input } from './input.js';
import * as THREE from '../shared/vendor/three/three.module.min.js';

const H = window.HubBridge;
const QS = new URLSearchParams(location.search);
const DEBUG = QS.has('debug');
const $ = (s) => document.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const breathe = () => new Promise((r) => setTimeout(r, 0));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PALETTE = ['#ff4b2b', '#2b8cff', '#ffc531', '#2fbf71', '#b45cff', '#ff5fa2', '#1fc7c1', '#ff8a1f'];
const BOT_NAMES = ['Hugo', 'Léa', 'Malo', 'Inès', 'Noah', 'Zoé', 'Sacha', 'Lina', 'Timéo', 'Jade', 'Nino', 'Rose', 'Eliott', 'Mila', 'Gabin',
  'Alma', 'Robin', 'Nora', 'Basile', 'Lou', 'Oscar', 'Iris', 'Marius', 'Ambre', 'Félix', 'Clara', 'Jules', 'Anna', 'Paul', 'Elsa',
  'Arthur', 'Louise', 'Adam', 'Chloé', 'Victor', 'Margaux', 'Léon', 'Agathe', 'Raphaël', 'Capucine', 'Maël', 'Romane', 'Simon', 'Juliette', 'Axel',
  'Lison', 'Hector', 'Salomé', 'Ethan', 'Apolline', 'Milo', 'Céleste', 'Samuel', 'Olivia', 'Tom', 'Maëlys', 'Aaron', 'Héloïse', 'Lucas', 'Manon'];
const MAX_PLACES = 60;       // joueurs sur l'île, bots compris
const LOOKS = Object.keys(CHARACTERS);
const cleanLook = (l) => ({ char: LOOKS.includes(l && l.char) ? l.char : 'soldat', color: /^#[0-9a-f]{6}$/i.test(l && l.color) ? l.color : null });
const LEVEL_LABEL = { facile: 'faciles', normal: 'normaux', difficile: 'coriaces', auto: 'au niveau auto' };
// sons des pas : le sol naturel, le plancher de chaque type de bâtiment
const GROUND_SURF = { [GR.PLAGE]: 'neige', [GR.PLAINE]: 'herbe', [GR.FORET]: 'herbe', [GR.MONTAGNE]: 'gravier', [GR.ROCHE]: 'gravier', [GR.NEIGE]: 'neige',
  [GR.ROUTE]: 'beton', [GR.VILLE]: 'beton', [GR.BATI]: 'bois', [GR.CHAMP]: 'herbe', [GR.LIEU]: 'gravier' };
const FLOOR_SURF = { immeuble: 'carrelage', tour: 'carrelage', boutique: 'carrelage', mairie: 'carrelage', bureaux: 'carrelage', station: 'carrelage',
  garage: 'beton', hangar: 'beton', phare: 'beton', abri: 'metal' };
const MAT_SURF = { bois: 'bois', pierre: 'beton', metal: 'metal' };
// recul de chaque arme : [saut de la vue vers le haut (rad), écart de côté, secousse]
const KICK = { fusil: [0.011, 0.006, 0.05], smg: [0.007, 0.006, 0.03], pistolet: [0.016, 0.005, 0.04], pompe: [0.05, 0.012, 0.28], sniper: [0.075, 0.01, 0.32], roquette: [0.045, 0.01, 0.35] };
const INTERP = 0.1;          // invités : les autres sont dessinés un dixième de seconde en arrière
const HOST_SILENCE = 3, HOST_GIVEUP = 15;
const MATS = ['bois', 'pierre', 'metal'];

const S = {
  role: 'solo', me: 'moi', settings: {}, map: null, world: null, sim: null, scene: null, actors: null, fx: null, hud: null, input: null, sfx: null,
  yaw: 0, pitch: -0.1, camD: 3.6, camDist: 3.6, camSide: SHOULDER, sel: 0, cnt: { jump: 0, use: 0, reload: 0, drop: 0 }, mv: [0, 0, 0], prev: new Map(),
  acc: 0, last: 0, t: 0, ms: 16, slow: 0, running: false, spect: null, shake: 0, fov: 72, ended: false, reported: false, startedAt: 0,
  look: { char: 'soldat', color: null }, looks: new Map(), portraits: null,
  picks: new Map(), // équipes choisies sur l'écran d'accueil : id du joueur → numéro d'équipe
  skills: new Map(), mySkill: { s: 0.5, games: 0 }, // niveau « Auto » : celui de chaque joueur du salon (engine/skill.js)
  cam: { x: 0, y: 0, z: 0 }, loaded: false,
  build: null, mat: 'bois', // mode construction : pièce choisie (mur, sol, escalier) et matériau
  // réseau
  run: 0, seed: 0, roster: [], netEv: [], tick: 0, lastSend: -99, snapN: 0,
  gotHost: false, hiT: 0, snapAt: 0, off: null, buf: [], hist: [], seq: 0, sendN: 0, predJump: 0, po: { x: 0, y: 0, z: 0 }, warned: false, evq: [],
};

function progress(label, f) {
  const t = $('#loadTxt'), b = $('#loadBar');
  if (t) t.textContent = label;
  if (b) b.style.width = Math.round(f * 100) + '%';
}
const net = () => H.embedded && H.players.length > 1;

async function boot(info) {
  S.role = H.embedded ? (info.role === 'guest' ? 'guest' : 'host') : 'solo';
  S.me = H.embedded ? info.myId : 'moi';
  const prof = window.DDProfile ? window.DDProfile.load() : { name: 'Moi', color: '#ff4b2b' };
  const meP = H.embedded ? H.players.find((p) => p.id === info.myId) : null;
  const set = info.settings || {};
  S.settings = {
    time: QS.get('time') || set.time || 'jour',
    mode: QS.get('mode') || set.mode || 'partie',
    places: +(QS.get('places') || set.places || 45),
    level: QS.get('level') || set.level || 'auto',
    teams: clamp(+(QS.get('equipes') || set.teams || 1) | 0, 1, 3),
  };
  S.meInfo = { id: S.me, name: meP ? meP.name : prof.name || 'Moi', color: meP ? meP.color : prof.color };
  try { S.look = cleanLook(JSON.parse(localStorage.getItem('royale_look') || 'null')); } catch (e) { /* pas de stockage */ }
  S.mySkill = skillOf(loadHist());
  H.on('msg', onMsg);
  H.on('roster', onRoster);

  progress('Génération de l\'île', 0.05); await breathe(); await breathe();
  S.map = generateMap(+QS.get('graine') || ILE);
  progress('Murs, meubles et escaliers', 0.2); await breathe();
  S.world = buildWorld(S.map);
  try {
    S.scene = await createScene($('#stage'), S.map, { time: S.settings.time, progress, onLost: () => toast('Affichage 3D interrompu : recharge la page', 8) });
  } catch (e) {
    console.error(e);
    progress('Impossible de lancer la 3D sur cet appareil', 1);
    return;
  }
  progress('Carte', 0.95); await breathe();
  S.hud = createHud(S.map, { onTeleport: S.settings.mode === 'exploration' && S.role !== 'guest' ? teleport : null, project });
  // armes et objets du kit : modèles au sol et en main, icônes de l'inventaire
  setKit(S.scene.kit);
  try { S.hud.setIcons(renderIcons()); } catch (e) { console.warn('icônes', e); }
  S.hud.showFps(DEBUG);
  S.sfx = createSound();
  S.sfx.island(S.map.center, S.map.islandR);
  S.input = new Input(S.scene.canvas, { key: onKey, lock: onLock, wheel: onWheel, ping: () => { if (S.input.playing) sendPing(); } });
  loadOpts();
  try { if (localStorage.getItem('royale_hints') === '0') $('#hints').classList.add('off'); } catch (e) { /* pas de stockage */ }
  $('#phaseTxt').textContent = S.settings.mode === 'exploration' ? 'Exploration, sans combat' : `${S.settings.places} joueurs · tempête`;
  S.loaded = true;
  if (H.embedded) H.signalReady();
  showScreen(S.role === 'guest' ? 'attente' : 'start');
  S.running = true;
  S.last = performance.now();
  requestAnimationFrame(loop);
  if (DEBUG) {
    window.__royale = S;
    // débogage : faire avancer le jeu de n images de 1/60 s (utile quand l'onglet est caché et ne dessine plus)
    S.advance = (n = 1) => { for (let i = 0; i < n; i++) { const t = S.last + 1000 / 60; loop(t); } };
    S.start = startMatch;
  }
}

// ------------------------------------------------------------------ une partie
// chaque joueur : son personnage et sa couleur (choisis sur l'écran d'accueil, envoyés à l'hôte)
function humans() {
  const withLook = (h) => { const l = h.id === S.me ? S.look : S.looks.get(h.id); return l ? { ...h, look: l.char, color: l.color || h.color } : h; };
  if (!H.embedded) return [withLook({ ...S.meInfo })];
  return H.players.map((p, i) => withLook({ id: p.id, name: p.name, color: /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : PALETTE[i % PALETTE.length] }));
}
function setLook(l) {
  S.look = cleanLook(l);
  try { localStorage.setItem('royale_look', JSON.stringify(S.look)); } catch (e) { /* pas de stockage */ }
  if (H.embedded) H.send('all', { t: 'look', look: S.look });
}
// hôte (ou solo) : on remplit la montgolfière (les joueurs du salon, puis des bots jusqu'au nombre de places)
function startMatch() {
  if (S.role === 'guest' || S.sim) return;
  const hs = humans(), expl = S.settings.mode === 'exploration';
  const size = expl ? 1 : S.settings.teams;
  // équipes : les choix de l'écran d'accueil, les autres répartis, puis des bots (coéquipiers d'abord)
  const T = makeTeams(hs, S.picks, expl ? hs.length : clamp(S.settings.places, 2, MAX_PLACES), size);
  const roster = hs.map((h) => ({ ...h, bot: false, team: T.humans.get(h.id) }));
  const names = [...BOT_NAMES].sort(() => Math.random() - 0.5);
  // niveau « Auto » : composé d'après les résultats des joueurs du salon
  const levels = S.settings.level === 'auto' ? botLevels(T.bots.length, roomSkill()) : T.bots.map(() => S.settings.level);
  T.bots.forEach((team, i) => roster.push({ id: 'bot' + i, name: names[i % names.length], color: PALETTE[(i + hs.length) % PALETTE.length], look: LOOKS[Math.floor(Math.random() * LOOKS.length)], bot: true, level: levels[i], team }));
  newMatch({ run: Date.now(), seed: (Math.random() * 1e9) | 0, roster, mode: S.settings.mode, teams: size });
  if (H.embedded) H.send('all', { t: 'go', ...matchInfo() });
  showScreen(null);
  S.input.lock();
}
// nouvelle partie sans recharger la page : on démonte la partie finie (personnages, effets, constructions, bots), la
// scène reprend son état de départ (murs, meubles, décor, portes) et le monde solide est reconstruit (≈ 65 ms)
function resetMatch() {
  if (!S.sim) return;
  try { S.actors.dispose(); S.fx.dispose(); S.builds.dispose(); S.drops3d.dispose(); } catch (e) { console.warn(e); }
  S.scene.reset();
  S.world = buildWorld(S.map);
  S.sim = null; S.ai = null; S.actors = null; S.fx = null; S.builds = null; S.buildApi = null;
  S.prev.clear(); S.bilan = null; S.ended = false; S.reported = false; S.spect = null; S.lastSnap = null; S.gotHost = S.role !== 'guest';
  S.hud.downed(null); S.hud.team([]); S.hud.tags([]); S.hud.pings([]); S.hud.prompt('');
  $('#hud').hidden = true; $('#feed').innerHTML = '';
}
const matchInfo = () => ({ run: S.run, seed: S.seed, roster: S.roster, mode: S.sim.S.mode, teams: S.sim.S.teams });
function newMatch({ run, seed, roster, mode, teams = 1, mirror = false }) {
  S.run = run; S.seed = seed; S.roster = roster;
  const city = S.map.pois.find((p) => p.kind === 'ville');
  const pl = city && S.map.plazas.find((q) => q.x0 >= city.rect.x0 && q.x1 <= city.rect.x1 && q.z0 >= city.rect.z0 && q.z1 <= city.rect.z1);
  const start = pl ? { x: (pl.x0 + pl.x1) / 2 + 6, z: (pl.z0 + pl.z1) / 2 + 6 } : null;
  S.sim = createSim({ map: S.map, world: S.world, seed, roster, mode, start, teams });
  S.startedAt = Date.now();
  S.actors = createActors(S.scene.scene, S.sim, S.scene.kit);
  S.actors.onBurn = (p) => S.sfx.at('bruleur', p.x, p.y + 4, p.z, 1, 140);
  S.fx = createFx(S.scene.scene, { floor: (x, z, y) => S.world.support(x, z, y), chimneys: S.scene.structures.chimneys || [] });
  S.buildApi = createBuild(S.sim, S.map, S.world);
  S.builds = createBuilds(S.scene.scene);
  S.drops3d = createDrops(S.scene.scene);
  // les bots ne réfléchissent que là où la partie tourne
  S.ai = !mirror && mode !== 'exploration' ? createAI(S.sim, S.map, S.world) : null;
  for (const P of S.sim.S.players.values()) S.prev.set(P.id, { x: P.x, y: P.y, z: P.z, yaw: P.yaw });
  if (S.sim.S.flight) S.yaw = Math.atan2(S.sim.S.flight.ux, S.sim.S.flight.uz);
  S.sel = 0; S.ended = false; S.reported = false; S.spect = null; S.build = null;
  S.cnt = { jump: 0, use: 0, reload: 0, drop: 0 };
  S.netEv = []; S.tick = 0; S.lastSend = -99; S.buf = []; S.hist = []; S.seq = 0; S.predJump = 0; S.po = { x: 0, y: 0, z: 0 }; S.off = null; S.evq = [];
  const P = me();
  if (P) { P.netInit = true; P.last = { ...P.last, jump: 0, use: 0, reload: 0, drop: 0, shoot: S.input.shots }; }
  $('#hud').hidden = false;
  buildBar();
}
function teleport(x, z) {
  const P = me();
  if (!P) return;
  Object.assign(P, { x, z, y: S.world.support(x, z, 400) + 0.05, vx: 0, vy: 0, vz: 0, mode: 'sol' });
  S.prev.set(P.id, { x: P.x, y: P.y, z: P.z, yaw: P.yaw });
  S.hud.toggleMap(false);
}
function project(x, y, z) {
  const v = new THREE.Vector3(x, y, z).project(S.scene.camera);
  const c = S.scene.canvas;
  return { x: (v.x * 0.5 + 0.5) * c.clientWidth, y: (-v.y * 0.5 + 0.5) * c.clientHeight, on: v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1 };
}

// ------------------------------------------------------------------ commandes
function me() { return S.sim ? S.sim.player(S.me) : null; }
function onKey(code, key) {
  if (!S.sim) return;
  const P = me();
  if (code === 'Tab') { toggleBag(); return; }
  // Échap ferme le sac ou la carte, et rien d'autre (un clic sur l'image reprend la souris)
  if (code === 'Escape' && (S.hud.bagOpen || S.hud.mapOpen)) {
    if (S.hud.bagOpen) { S.hud.closeBag(); S.bagLock = false; }
    S.hud.toggleMap(false);
    toast('Clique pour reprendre', 1.5);
    return;
  }
  if (key === 'm' || code === 'KeyM') { if (S.hud.bagOpen) toggleBag(false); S.hud.toggleMap(); if (S.hud.mapOpen) S.input.unlock(); return; }
  if (key === 'h') { const h = $('#hints'); h.classList.toggle('off'); try { localStorage.setItem('royale_hints', h.classList.contains('off') ? '0' : '1'); } catch (e) { /* pas de stockage */ } return; }
  if (!S.input.playing) return;
  if ((!P || !P.alive) && code === 'Space') { nextSpectate(); return; }
  if (key === 'e') S.cnt.use++;
  else if (key === 'r') S.cnt.reload++;
  else if (key === 'g') S.cnt.drop++;
  else if (key === 'b') sendPing();
  // construction : F mur, V sol, C escalier (encore une fois pour sortir), T matériau
  else if (key === 'f' || key === 'v' || key === 'c') { const k = { f: 'mur', v: 'sol', c: 'escalier' }[key]; S.build = S.build === k ? null : k; buildBar(); S.sfx.play('clic'); }
  else if (key === 't') { S.mat = MATS[(MATS.indexOf(S.mat) + 1) % MATS.length]; buildBar(); S.sfx.play('clic'); }
  else if (/^Digit[1-5]$/.test(code)) { S.sel = +code.slice(5); S.build = null; buildBar(); }
  else if (code === 'Digit0' || code === 'Backquote' || key === 'x' || key === '²') { S.sel = 0; S.build = null; buildBar(); }
}
// le sac : la souris est libérée pour glisser les objets ; Tab pour revenir au jeu
function toggleBag(open = !S.hud.bagOpen) {
  const P = me();
  if (open && (!P || !P.alive)) return;
  if (open) {
    S.bagLock = true;
    S.input.unlock();
    S.hud.openBag(P, (a, b) => { S.mv = [S.mv[0] + 1, a, b]; S.sfx.play('clic'); });
    S.sfx.play('clic');
  } else {
    S.hud.closeBag();
    S.bagLock = false;
    if (!S.ended) S.input.lock();
  }
}
function buildBar() {
  const el = $('#buildbar');
  el.hidden = !S.build;
  if (!S.build) return;
  const P = me();
  el.innerHTML = Object.entries(PIECES).map(([k, l]) => `<span class="${k === S.build ? 'on' : ''}"><kbd>${{ mur: 'F', sol: 'V', escalier: 'C' }[k]}</kbd>${l}</span>`).join('')
    + `<span class="mat" style="--c:${MATERIALS[S.mat].color}"><kbd>T</kbd><i></i>${MATERIALS[S.mat].label} · ${P ? P.mats[S.mat] : 0}</span>`;
}
function onWheel(dir) {
  const P = me();
  if (!P) return;
  if (S.build) { const ks = Object.keys(PIECES); S.build = ks[(ks.indexOf(S.build) + dir + ks.length) % ks.length]; buildBar(); return; }
  // on passe d'un objet tenu au suivant (l'outil et les cases occupées)
  const occupied = [0, ...P.inv.map((s, i) => (s ? i + 1 : -1)).filter((i) => i > 0)];
  const i = occupied.indexOf(S.sel);
  S.sel = occupied[(i + dir + occupied.length) % occupied.length];
}
function onLock(locked) {
  if (locked) {
    showScreen(null); S.hud.toggleMap(false); S.sfx.unlock();
    if (S.hud.bagOpen) { S.hud.closeBag(); S.bagLock = false; }
    return;
  }
  if (S.bagLock || S.hud.mapOpen || S.ended || !S.sim) return;
  showScreen('pause');
}
function myInput(on, ax) {
  const inp = S.input;
  return { mx: ax.mx, mz: ax.mz, yaw: S.yaw, pitch: S.pitch, fire: !!(on && inp.fire), aim: !!(on && inp.aim), sprint: !!(on && inp.sprint), crouch: !!(on && inp.crouch),
    jump: S.cnt.jump, use: S.cnt.use, reload: S.cnt.reload, shoot: inp.shots, drop: S.cnt.drop, sel: S.sel, build: on ? S.build : null, mat: S.mat, mv: S.mv };
}

// ------------------------------------------------------------------ boucle
function loop(now) {
  if (!S.running) return;
  requestAnimationFrame(loop);
  const dt = clamp((now - S.last) / 1000, 0, 0.1);
  S.last = Math.max(S.last, now); S.t += dt;
  S.ms = S.ms * 0.95 + dt * 1000 * 0.05;
  if (S.role === 'guest') guestNet(dt);
  if (!S.sim) { idleFrame(dt); return; }
  const inp = S.input, P = me();
  const [mx, my] = inp.takeMouse(dt);
  const scoped = isScoped(P);
  const sens = scoped ? 0.25 : inp.aim ? 0.6 : 1;
  S.yaw -= mx * sens; S.pitch = clamp(S.pitch - my * sens, -1.35, 1.25);
  const on = !!(inp.playing && !S.hud.mapOpen && !S.hud.bagOpen && P && P.alive);
  if (on && inp.takeJump()) S.cnt.jump++;
  const ax = on ? inp.axes() : { mx: 0, mz: 0 };
  const events = S.role === 'guest' ? guestSteps(dt, on, ax) : hostSteps(dt, on, ax);
  const a = S.acc / DT;
  const rt = S.role === 'guest' && S.off != null ? performance.now() / 1000 - S.off - INTERP : 0;
  const disp = (Q) => {
    if (S.role === 'guest' && Q.id !== S.me) return remotePos(Q, rt);
    const pr = S.prev.get(Q.id) || Q, po = Q.id === S.me ? S.po : null;
    return { x: pr.x + (Q.x - pr.x) * a + (po ? po.x : 0), y: pr.y + (Q.y - pr.y) * a + (po ? po.y : 0), z: pr.z + (Q.z - pr.z) * a + (po ? po.z : 0), yaw: Q.id === S.me && Q.alive ? S.yaw : Q.yaw };
  };
  handleEvents(events);
  // caméra
  const view = cameraFor(P, disp, dt);
  S.actors.update(dt, S.t, view.pos, disp, scoped || S.camClose ? S.me : null, seeFrom(view.focus));
  S.fx.update(dt, S.t, S.sim, S.sim.S.storm && S.sim.S.storm.cur, view.pos);
  // fantôme de la pièce à construire
  if (S.build && P && P.alive && P.mode === 'sol') {
    const slot = slotFor(P.x, P.y, P.z, S.yaw, S.pitch, S.build, S.buildApi.pieces);
    S.builds.ghost(slot, S.buildApi.canPlace(slot) && P.mats[S.mat] >= COST);
  } else S.builds.ghost(null);
  S.builds.update(dt, S.buildApi.pieces);
  S.drops3d.update(dt, S.t, S.sim.S);
  // chute libre : la vue s'élargit avec la vitesse, des traits de vitesse filent sur les bords
  const fall = P && P.alive && P.mode === 'chute' ? Math.min(1, Math.hypot(P.vx, P.vy, P.vz) / 34) : 0;
  S.fall = (S.fall || 0) + (fall - (S.fall || 0)) * (1 - Math.exp(-4 * dt));
  $('#speedlines').style.opacity = (S.fall * 0.85).toFixed(3);
  const cam = S.scene.camera, fov = scoped ? 72 / 4 : inp.aim && P && P.alive && heldWeapon(P) ? 72 / (WEAPONS[heldWeapon(P).w].zoom || 1.2) : 72 + S.fall * 14;
  S.fov += (fov - S.fov) * (1 - Math.exp(-14 * dt));
  if (Math.abs(cam.fov - S.fov) > 0.01) { cam.fov = S.fov; cam.updateProjectionMatrix(); }
  S.scene.frame(dt, view, view.focus);
  // interface
  const focusP = P && P.alive ? P : S.sim.player(S.spect) || P;
  if (focusP) {
    const fp = disp(focusP);
    const team = S.sim.S.teams > 1 ? [...S.sim.S.players.values()].filter((Q) => S.sim.mates(focusP, Q)) : [];
    const pg = pingsOf(focusP, fp, view);
    S.hud.pings(pg);
    const drops = [...S.sim.S.drops.values()].filter((d) => !d.open).map((d) => ({ x: d.x, z: d.z, color: '#b77dff', big: true }));
    S.hud.maps(S.t, fp, focusP === P ? S.yaw : focusP.yaw, S.ms, team.filter((Q) => Q.alive && Q.mode !== 'ballon').map((Q) => { const d = disp(Q); return { x: d.x, z: d.z, color: Q.color, down: !!Q.down }; }), [...drops, ...pg.map((m) => ({ x: m.x, z: m.z, color: m.color }))]);
    const rv = focusP.revive && S.sim.player(focusP.revive.id);
    S.hud.player(focusP, { alive: S.sim.alive().length, build: focusP === P ? S.build : null, mat: S.mat, revive: rv ? { f: focusP.revive.t / REVIVE, name: rv.name } : null });
    if ((S.tick3 = (S.tick3 || 0) + 1) % 5 === 0) S.hud.team(team.map((Q) => ({ id: Q.id, name: Q.name, color: Q.color, hp: Q.hp, sh: Q.sh, down: Q.down ? Q.down.hp : null, alive: Q.alive })));
    S.hud.tags(team.filter((Q) => Q.alive && Q.mode === 'sol').map((Q) => { const d = disp(Q); return { id: Q.id, name: Q.name, color: Q.color, x: d.x, y: d.y + 2.3, z: d.z, down: !!Q.down }; }));
    // à terre : ce qu'il reste, et le coéquipier qui relève
    const helper = focusP.down && [...S.sim.S.players.values()].find((Q) => Q.revive && Q.revive.id === focusP.id);
    S.hud.downed(focusP.alive && focusP.down ? { left: focusP.down.hp / DOWN_HP * BLEED, by: helper ? helper.name : null, f: helper ? helper.revive.t / REVIVE : 0 } : null);
    S.hud.storm(S.sim.S.storm, fp);
  }
  S.hud.flight(S.sim.S.phase === 'vol' && S.sim.S.flight ? flightLine() : null);
  // en l'air (montgolfière, chute, planeur) ou éliminé : le rappel des touches s'efface, la vue reste dégagée
  const air = !P || !P.alive || P.mode !== 'sol';
  if (air !== S.hintsAir) { S.hintsAir = air; $('#hints').classList.toggle('air', air); }
  S.hud.frame(dt);
  S.hud.crosshair(P ? spreadOf(P) : 0, scoped);
  S.hud.spectate(P && P.alive ? null : S.sim.player(S.spect) && !S.ended ? S.sim.player(S.spect).name : null);
  if ((S.tick2 = (S.tick2 || 0) + 1) % 6 === 0) showPrompt();
  if (S.hud.bagOpen) { if (P && P.alive) S.hud.bag(P); else toggleBag(false); }
  // écho de pièce quand la tête du joueur suivi est sous un toit
  const fp = view.focus, roof = fp ? S.world.ceiling(fp.x, fp.z, fp.y + 0.2) - fp.y : 99;
  S.indoor = (S.indoor || 0) + ((roof < 9 ? 1 : 0) - (S.indoor || 0)) * Math.min(1, dt * 4);
  S.sfx.update(dt, { cam: view.pos, yaw: view.look ? Math.atan2(view.look.x - view.pos.x, view.look.z - view.pos.z) : S.yaw, sim: S.sim, me: P, disp, storm: stormGap(focusP), surface, indoor: S.indoor });
  // qualité automatique : si l'image prend plus de 24 ms pendant 3 s, on allège
  if (S.ms > 24 && S.t > 6) { S.slow += dt; if (S.slow > 3) { S.slow = 0; const w = S.scene.lowerQuality(); if (w && DEBUG) toast('Qualité baissée : ' + w, 2); } }
  else S.slow = Math.max(0, S.slow - dt);
}
function savePrev(Q) { const pr = S.prev.get(Q.id); if (pr) { pr.x = Q.x; pr.y = Q.y; pr.z = Q.z; pr.yaw = Q.yaw; } else S.prev.set(Q.id, { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw }); }
// hôte et solo : la partie avance ici ; vingt fois par seconde, son état part chez les invités
function hostSteps(dt, on, ax) {
  const out = [];
  S.acc += dt;
  let steps = 0;
  while (S.acc >= DT && steps < 6) {
    for (const Q of S.sim.S.players.values()) savePrev(Q);
    if (me()) S.sim.input(S.me, myInput(on, ax));
    S.sim.step(DT);
    const ev = S.sim.takeEvents();
    out.push(...ev);
    if (net()) S.netEv.push(...ev);
    S.acc -= DT; steps++; S.tick++;
  }
  if (S.acc > DT) S.acc = 0;
  if (net() && (S.tick - S.lastSend >= 3 || (S.sim.S.phase === 'fin' && S.netEv.length))) {
    S.lastSend = S.tick;
    // volatil quand il ne transporte pas d'événements : sauté si la connexion sature
    H.send('all', { t: 's', run: S.run, s: snapshot(S.sim, S.snapN++ % 20 === 0 ? 'tous' : 'humains'), e: S.netEv }, { volatile: !S.netEv.length });
    S.netEv = [];
  }
  return out;
}
// invité : son joueur avance tout de suite (prédiction), le reste vient de l'hôte
function guestSteps(dt, on, ax) {
  S.acc += dt;
  let steps = 0;
  const P = me();
  while (S.acc >= DT && steps < 6) {
    const h = myInput(on, ax);
    const jump = h.jump !== S.predJump; S.predJump = h.jump;
    S.seq++;
    if (P) { savePrev(P); predictStep(P, { ...h, jump }, S.world, DT); }
    S.hist.push({ q: S.seq, mx: h.mx, mz: h.mz, yaw: h.yaw, pitch: h.pitch, sprint: h.sprint, crouch: h.crouch, aim: h.aim, jump });
    if (S.hist.length > 180) S.hist.shift();
    if (++S.sendN >= 2 && P) {
      S.sendN = 0;
      const pings = H.pings || {}, lag = INTERP + ((pings[S.me] || 60) + (pings[H.info.hostId] || 60)) / 2000;
      H.send('host', { t: 'i', q: S.seq, lag: Math.min(0.3, lag), ...h });
    }
    S.acc -= DT; steps++;
  }
  if (S.acc > DT) S.acc = 0;
  // entre deux instantanés : la montgolfière avance, les constructions durcissent, l'écart de prédiction se résorbe
  const SS = S.sim.S;
  if (SS.flight && S.lastSnap) SS.flight.t = S.lastSnap.ft + Math.max(0, performance.now() / 1000 - S.snapAt);
  if (SS.hooks.step) SS.hooks.step(dt);
  const k = Math.exp(-dt * 10); S.po.x *= k; S.po.y *= k; S.po.z *= k;
  const out = S.evq; S.evq = [];
  return out;
}
// invités : position affichée d'un autre joueur, interpolée entre deux instantanés
function remotePos(Q, rt) {
  const b = S.buf;
  if (!b.length) return { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw };
  let A = b[b.length - 1], B = A;
  for (let i = 0; i < b.length - 1; i++) if (b[i].t <= rt && b[i + 1].t >= rt) { A = b[i]; B = b[i + 1]; break; }
  const pa = A.P.get(Q.id), pb = B.P.get(Q.id);
  if (!pa || !pb) return { x: Q.x, y: Q.y, z: Q.z, yaw: Q.yaw };
  const f = A === B ? 0 : clamp((rt - A.t) / (B.t - A.t), 0, 1);
  let dy = pb[3] - pa[3]; while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
  return { x: pa[0] + (pb[0] - pa[0]) * f, y: pa[1] + (pb[1] - pa[1]) * f, z: pa[2] + (pb[2] - pa[2]) * f, yaw: pa[3] + dy * f };
}
// salon (pas encore de partie) : la caméra tourne lentement au-dessus de l'île
function idleFrame(dt) {
  const C = S.map.center, a = S.t * 0.04, R = S.map.islandR * 0.9;
  const pos = { x: C + Math.cos(a) * R, y: 190, z: C + Math.sin(a) * R };
  const focus = { x: C, y: 20, z: C };
  S.scene.frame(dt, { pos, look: focus, focus }, focus);
}
function heldWeapon(P) { const it = P.sel > 0 ? P.inv[P.sel - 1] : null; return it && it.t === 'arme' ? it : null; }
function isScoped(P) { const w = P && P.alive && heldWeapon(P); return !!(w && w.w === 'sniper' && S.input && S.input.aim && P.mode === 'sol'); }
function spreadOf(P) {
  const it = heldWeapon(P);
  if (!it) return 0.01;
  const W = WEAPONS[it.w], moving = Math.hypot(P.vx, P.vz) > 1;
  return (S.input.aim ? W.spread[1] : W.spread[0]) * (moving ? 1.5 : 1) * (P.crouch ? 0.75 : 1) * (P.ground ? 1 : 2) + (P.bloom || 0);
}
function flightLine() {
  const f = S.sim.S.flight;
  return { x0: f.x0, z0: f.z0, x1: f.x0 + f.ux * f.len, z1: f.z0 + f.uz * f.len };
}
// distance au bord de la tempête (négative : dehors), pour le son
function stormGap(P) {
  const st = S.sim.S.storm;
  if (!st || !st.cur || !P) return 999;
  return st.cur.r - Math.hypot(P.x - st.cur.x, P.z - st.cur.z);
}

// ce que voit le joueur : rien entre sa tête et le point (mur, plancher) ; sert à ne pas montrer les lueurs du
// butin et des coffres à travers les murs
function seeFrom(f) {
  const ox = f.x, oy = f.y + 1.5, oz = f.z;
  return (x, y, z) => {
    const dx = x - ox, dy = y - oy, dz = z - oz, L = Math.hypot(dx, dy, dz);
    if (L < 1) return true;
    return S.world.raycast(ox, oy, oz, dx / L, dy / L, dz / L, L).t >= L - 0.45;
  };
}
// caméra : par-dessus l'épaule droite (au sol), loin derrière (montgolfière, chute libre), à l'œil (lunette)
function cameraFor(P, disp, dt) {
  const W = S.world;
  let target = P;
  if (!P || !P.alive) {
    if (!S.sim.player(S.spect) || !S.sim.player(S.spect).alive) S.spect = pickSpectate();
    target = S.sim.player(S.spect) || P;
  }
  if (!target) { const C = S.map.center; return { pos: { x: C, y: 200, z: C + 300 }, look: { x: C, y: 0, z: C }, focus: { x: C, y: 0, z: C } }; }
  const d = disp(target);
  // le recul retombe vite (il ne touche que la vue, pas la visée)
  S.kick = (S.kick || 0) * Math.exp(-11 * dt); S.kickYaw = (S.kickYaw || 0) * Math.exp(-13 * dt);
  const yaw = target === P ? S.yaw + S.kickYaw : d.yaw, pitch = target === P ? S.pitch + S.kick : clamp(target.pitch || 0, -0.6, 0.6);
  const cp = Math.cos(pitch), fx = Math.sin(yaw) * cp, fy = Math.sin(pitch), fz = Math.cos(yaw) * cp;
  const rx = -Math.cos(yaw), rz = Math.sin(yaw);
  let dist = S.camD, sh = SHOULDER, headY;
  if (target.mode === 'ballon') {
    // autour de la montgolfière, à la souris, en regardant l'île
    const b = S.sim.balloonPos(), pp = Math.min(S.pitch, -0.15), cy2 = Math.cos(pp), D = 42;
    const ox = Math.sin(S.yaw) * cy2, oy = Math.sin(pp), oz = Math.cos(S.yaw) * cy2;
    return look(b.x - ox * D, b.y + 14 - oy * D, b.z - oz * D, ox, oy, oz, b);
  }
  if (target.mode === 'chute' || target.mode === 'planeur') { dist = 7.5; sh = 0; headY = d.y + 1.6; }
  else headY = target.swim ? d.y + MOVE.swimDepth + 0.6 : d.y + (target.crouch ? MOVE.hc : MOVE.h) - 0.25;
  if (target === P && S.input.aim && heldWeapon(P)) dist = 2.1;
  if (isScoped(P) && target === P) dist = 0;
  // distance voulue : elle change pour viser (ou en l'air) ; les murs la raccourcissent plus bas
  S.camDist = dist === 0 ? 0 : S.camDist + (dist - S.camDist) * (1 - Math.exp(-12 * dt));
  // épaule droite (même axe que les tirs) ; un mur collé à droite la fait glisser doucement vers le centre
  const wantSide = sh ? Math.max(0, W.ray(d.x, headY, d.z, rx, 0, rz, sh, 0.2)) : 0;
  // (vers le centre tout de suite, sinon l'épaule entrerait dans le mur ; vers l'épaule en douceur)
  S.camSide = wantSide < S.camSide ? wantSide : S.camSide + (wantSide - S.camSide) * (1 - Math.exp(-8 * dt));
  let px = d.x + rx * S.camSide, pz = d.z + rz * S.camSide;
  const py = headY;
  // la caméra ne traverse ni mur, ni porte, ni plafond, ni le sol : un obstacle derrière le joueur la rapproche aussitôt,
  // elle recule doucement quand la voie se libère ; collée au mur, elle se recentre sur la tête du joueur
  let D = S.camDist;
  if (D > 0.3) {
    let free = W.ray(px, py, pz, -fx, -fy, -fz, D, 0.24);
    if (free < 0.5) { px = d.x; pz = d.z; S.camSide = 0; free = W.ray(px, py, pz, -fx, -fy, -fz, D, 0.24); }
    const want = Math.max(0, free - 0.12);
    const pull = S.camPull == null ? D : S.camPull;
    S.camPull = want < pull ? want : pull + (want - pull) * (1 - Math.exp(-5 * dt));
    D = Math.min(D, S.camPull);
  } else S.camPull = null;
  // tout contre le joueur, on ne dessine pas son personnage (sinon on voit l'intérieur de sa tête)
  S.camClose = target === P && D > 0 && D < 0.75;
  let cx = px - fx * D, cy = py - fy * D, cz = pz - fz * D;
  const wl = W.waterLevel(cx, cz);
  if (cy < wl + 0.35) cy = wl + 0.35;
  const gh = S.map.heightAt(cx, cz);
  if (cy < gh + 0.3) cy = gh + 0.3;
  // plan proche court : la caméra reste dans le vide, rien n'est découpé devant elle
  const near = 0.1;
  // secousse des explosions proches (moindre quand la caméra est collée à un mur, pour ne pas y entrer)
  if (S.shake > 0) { S.shake = Math.max(0, S.shake - dt * 2.5); const k = S.shake * 0.4 * Math.min(1, D / 2); cx += (Math.random() - 0.5) * k; cy += (Math.random() - 0.5) * k; cz += (Math.random() - 0.5) * k; }
  return look(cx, cy, cz, fx, fy, fz, d, near);
  function look(x, y, z, a, b, c, focus, nearP = 0.15) {
    S.cam = { x, y, z };
    return { pos: { x, y, z }, look: { x: x + a * 30, y: y + b * 30, z: z + c * 30 }, focus: { x: focus.x, y: focus.y, z: focus.z }, near: nearP };
  }
}
function pickSpectate() {
  const P = me();
  const mate = P && [...S.sim.S.players.values()].find((Q) => Q.alive && S.sim.mates(P, Q));
  if (mate) return mate.id;
  const killer = P && P.hitBy != null && S.sim.player(P.hitBy);
  if (killer && killer.alive) return killer.id;
  const live = S.sim.alive();
  return live.length ? live[0].id : null;
}
function nextSpectate() {
  const live = S.sim.alive();
  if (!live.length) return;
  const i = live.findIndex((p) => p.id === S.spect);
  S.spect = live[(i + 1) % live.length].id;
}

// ------------------------------------------------------------------ réseau : messages
function onMsg(from, m) {
  if (!S.loaded || !m || typeof m !== 'object') return;
  if (m.t === 'look') { S.looks.set(from, cleanLook(m.look)); return; }
  if (m.t === 'skill') { if (Number.isFinite(m.s)) S.skills.set(from, Math.max(0, Math.min(1, m.s))); refreshLobby(); return; }
  if (m.t === 'team') { S.picks.set(from, Number.isInteger(m.k) && m.k >= 0 && m.k < 30 ? m.k : -1); refreshLobby(); return; }
  if (S.role !== 'guest') {
    if (m.t === 'hi') {
      if (m.look) S.looks.set(from, cleanLook(m.look));
      if (Number.isInteger(m.team)) S.picks.set(from, m.team);
      if (Number.isFinite(m.skill)) S.skills.set(from, Math.max(0, Math.min(1, m.skill)));
      // un invité arrive (ou revient) : la partie en cours et tout ce qui a changé depuis le début
      if (S.sim && !S.ended) H.send(from, { t: 'go', ...matchInfo(), full: fullState(S.sim, S.world, S.buildApi) });
      else H.send(from, { t: 'salon', picks: [...S.picks] });
    } else if (m.t === 'repere' && S.sim) {
      const P = S.sim.player(from); // `from` vient du Hub : seule identité fiable
      if (P && !P.bot) S.sim.ping(P, String(m.kind), +m.x, +m.y, +m.z, m.target != null && S.sim.player(m.target) ? m.target : null, String(m.what || ''));
    } else if (m.t === 'i' && S.sim) {
      const P = S.sim.player(from); // `from` vient du Hub : seule identité fiable
      if (!P || P.bot) return;
      const inp = cleanInput(m);
      // premier message : ses compteurs d'appuis deviennent la référence (pas de tir fantôme)
      if (!P.netInit) { P.netInit = true; for (const k of ['jump', 'use', 'reload', 'shoot', 'drop']) P.last[k] = inp[k]; }
      S.sim.input(from, inp);
      P.q = m.q | 0; P.lag = clamp(+m.lag || 0, 0, 0.3);
    }
    return;
  }
  if (from !== H.info.hostId) return; // invité : seul l'hôte fait foi
  S.gotHost = true;
  if (m.t === 'salon') {
    if (Array.isArray(m.picks)) for (const [id, k] of m.picks) if (id !== S.me && Number.isInteger(k)) S.picks.set(id, k);
    if (!S.sim) showScreen('attente');
    return;
  }
  if (m.t === 'go') {
    if (S.sim && m.run !== S.run) resetMatch(); // nouvelle partie : l'île revient comme au départ
    if (S.sim) return;
    newMatch({ run: m.run, seed: m.seed, roster: m.roster, mode: m.mode, teams: m.teams | 0 || 1, mirror: true });
    if (m.full) {
      applyFull(S.sim, S.world, S.buildApi, m.full);
      for (const k of m.full.broken) hideBroken(k);
      for (const p of S.buildApi.pieces.values()) S.builds.add(p);
      for (const d of S.world.doors.values()) if (d.open && !d.dead) S.scene.interior.setDoor(d.id, true);
    }
    S.snapAt = performance.now() / 1000;
    showScreen(me() ? 'rejoint' : 'spectateur');
    return;
  }
  if (m.t === 's' && S.sim && m.run === S.run && m.s) receiveSnap(m.s, m.e || []);
  if (m.t === 'bilan' && m.run === S.run && Array.isArray(m.res)) S.bilan = m.res;
}
function receiveSnap(s, events) {
  const now = performance.now() / 1000;
  const o = now - s.t;
  if (S.off == null || o < S.off || Math.abs(o - S.off) > 1) S.off = o; else S.off += (o - S.off) * 0.02;
  S.snapAt = now; S.lastSnap = s;
  // le monde de la copie d'abord (portes, butin, constructions), puis l'état des joueurs
  for (const e of events) mirrorEvent(S.sim, S.world, S.buildApi, e);
  const meP = me(), wasMode = meP && meP.mode;
  applySnapshot(S.sim, s, S.me);
  S.buf.push({ t: s.t, P: new Map(s.P.map((r) => [r[0], [r[1], r[2], r[3], r[4]]])) });
  if (S.buf.length > 12) S.buf.shift();
  reconcile(s, wasMode);
  S.evq.push(...events);
}
// prédiction : on repart de l'état de l'hôte et on rejoue les commandes qu'il n'a pas encore appliquées
function reconcile(s, wasMode) {
  const P = me(), row = P && s.P.find((r) => r[0] === S.me);
  if (!row) return;
  const old = { x: P.x + S.po.x, y: P.y + S.po.y, z: P.z + S.po.z };
  Object.assign(P, { x: row[1], y: row[2], z: row[3], vx: row[6], vy: row[7], vz: row[8], mode: MODES[row[10]] });
  S.hist = S.hist.filter((h) => h.q > row[18]);
  for (const h of S.hist) predictStep(P, h, S.world, DT);
  // petit écart : résorbé en douceur ; grand écart (téléportation, saut de la montgolfière) : on suit l'hôte
  const dx = old.x - P.x, dy = old.y - P.y, dz = old.z - P.z;
  if (wasMode === P.mode && Math.hypot(dx, dy, dz) < 3) S.po = { x: dx, y: dy, z: dz };
  else { S.po = { x: 0, y: 0, z: 0 }; savePrev(P); }
}
// invité : on redemande l'état tant que l'hôte n'a rien envoyé ; hôte muet trop longtemps : on prévient, puis on arrête
function guestNet(dt) {
  if (!S.loaded) return;
  S.hiT -= dt;
  if (!S.gotHost && S.hiT <= 0) { S.hiT = 1.5; H.send('host', { t: 'hi', look: S.look, team: S.picks.get(S.me), skill: S.mySkill.s }); }
  if (!S.sim || S.ended) return;
  const silent = performance.now() / 1000 - S.snapAt;
  if (silent > HOST_SILENCE) {
    if (!S.warned) { S.warned = true; toast('Liaison avec l\'hôte interrompue…', 4); }
    if (silent > HOST_GIVEUP) { S.ended = true; S.input.unlock(); showScreen('perdu'); }
  } else S.warned = false;
}
function onRoster() {
  if (!S.loaded) return;
  // le Hub m'a désigné comme nouvel hôte : la partie repart de ma copie
  if (S.role === 'guest' && H.info.role === 'host') { becomeHost(); return; }
  if (S.role !== 'host') { if (!S.sim && !$('#screen').hidden) showScreen('attente'); return; }
  if (!S.sim) { if (!$('#screen').hidden) showScreen('start'); return; }
  // départ (onglet fermé, retour au salon) : éliminé, son sac tombe
  const ids = new Set(H.players.map((p) => p.id));
  for (const P of S.sim.S.players.values()) if (!P.bot && P.id !== S.me && !ids.has(P.id) && P.alive) S.sim.leave(P.id);
}
function becomeHost() {
  S.role = 'host';
  if (!S.sim || S.ended) { if (S.sim) location.reload(); else showScreen('start'); return; }
  const SS = S.sim.S;
  SS.nextItem = Math.max(SS.nextItem, ...[...SS.items.keys()].map((k) => k + 1));
  SS.nextProj = Math.max(SS.nextProj, ...SS.pads.map((p) => p.id + 1)) + 1000;
  SS.projectiles = [];
  for (const P of SS.players.values()) {
    P.netInit = false; P.ai = null; P.use = null; P.trail = [];
    if (P.id === S.me) { P.netInit = true; P.last = { ...P.last, jump: S.cnt.jump, use: S.cnt.use, reload: S.cnt.reload, drop: S.cnt.drop, shoot: S.input.shots }; }
  }
  S.ai = SS.mode !== 'exploration' ? createAI(S.sim, S.map, S.world) : null;
  S.acc = 0; S.hist = []; S.po = { x: 0, y: 0, z: 0 }; S.lastSend = -99;
  toast('L\'hôte est parti : tu reprends la partie', 4);
  onRoster();
}

// ------------------------------------------------------------------ événements de la partie
function nameOf(id) { const p = S.sim.player(id); return p ? p.name : '?'; }
const CAUSES = { fusil: 'au fusil d\'assaut', pompe: 'au fusil à pompe', pistolet: 'au pistolet', smg: 'au pistolet-mitrailleur', sniper: 'au fusil de précision', roquette: 'au lance-roquettes',
  grenade: 'à la grenade', tempete: 'par la tempête', chute: 'par une chute', pioche: 'à la pioche', depart: '(parti)' };
function hideBroken(k) {
  const rest = k.slice(2);
  if (k[0] === 'p') { S.scene.props.hide(+rest); S.scene.forest.hide(+rest); if (S.scene.lights) S.scene.lights.hide(+rest); }
  else if (k[0] === 'w') S.scene.structures.hideWall(rest);
  else if (k[0] === 's') S.scene.structures.hideWall(k);
  else if (k[0] === 'f') S.scene.interior.hideFurn(+rest);
  else if (k[0] === 'd') S.scene.interior.hideDoor(+rest);
  else if (k[0] === 'b') S.builds.remove(+rest);
}
// ce qu'il y a sous les pieds (pour le son des pas)
function surface(Q) {
  if (S.world.waterLevel(Q.x, Q.z) > Q.y + 0.08) return 'eau';
  if (Q.y - S.map.heightAt(Q.x, Q.z) < 0.12) return GROUND_SURF[S.map.groundAt(Q.x, Q.z)] || 'herbe';
  let best = null;
  S.world.near(Q.x, Q.z, 4.5, (s) => { if (Math.abs(s.y1 - Q.y) < 0.25 && S.world.over(s, Q.x, Q.z, 0.1)) best = s; });
  return best ? surfOf(best) : 'bois';
}
function surfOf(s) {
  const r = s.ref || {};
  if (r.part === 'pont') return 'beton';
  if (r.part === 'quai') return 'bois';
  if (r.prop != null) { const m = (PROPS[S.map.props[r.prop].kind] || {}).mat; return m === 'metal' ? 'metal' : m === 'pierre' ? 'gravier' : 'bois'; }
  if (r.b != null) { const b = S.map.buildings[r.b]; return r.part === 'toit' ? 'beton' : FLOOR_SURF[b.type] || 'bois'; }
  if (s.key && s.key[0] === 'b') { const pc = S.sim.S.build && S.sim.S.build.pieces.get(+s.key.slice(2)); return MAT_SURF[pc && pc.mat] || 'bois'; }
  return 'beton';
}
// matière touchée par une balle (pour le son de l'impact)
function impactAt(x, y, z) {
  if (y < S.map.heightAt(x, z) + 0.3) return 'impact-sol';
  let found = null;
  S.world.near(x, z, 4.5, (s) => { if (!found && y >= s.y0 - 0.25 && y <= s.y1 + 0.25 && S.world.over(s, x, z, 0.25)) found = s; });
  if (!found) return 'impact-sol';
  const m = surfOf(found);
  return m === 'metal' ? 'impact-metal' : m === 'bois' ? 'impact-bois' : 'impact-pierre';
}
function handleEvents(list) {
  const P = me();
  for (const e of list) {
    switch (e.e) {
      case 'feu': {
        const h = S.actors.heroOf(e.p), Q = S.sim.player(e.p);
        if (h && Q) {
          h.shot();
          if (h.held) { const v = new THREE.Vector3(); h.held.getWorldPosition(v); S.fx.casing(v, Q.yaw, e.w); v.x += Math.sin(Q.yaw) * 0.5; v.z += Math.cos(Q.yaw) * 0.5; S.fx.muzzleFlash(v, e.w); }
        }
        if (Q) S.sfx.shot(e.w, Q, e.p === S.me);
        // recul : la vue saute un peu vers le haut et revient, l'image tremble pour les grosses armes
        if (e.p === S.me) { const k = KICK[e.w] || KICK.fusil; S.kick += k[0]; S.kickYaw += (Math.random() - 0.5) * k[1]; S.shake = Math.max(S.shake, k[2]); }
        break;
      }
      case 'tir': {
        const h = S.actors.heroOf(e.p);
        let muzzle = null;
        if (h && h.held && e.p !== S.me) { muzzle = new THREE.Vector3(); h.held.getWorldPosition(muzzle); }
        S.fx.shot(e.from, e.to, e.w, e.hit, muzzle, !!e.late);
        if (e.hit === 1 && e.k < 3) S.sfx.at(impactAt(e.to[0], e.to[1], e.to[2]), e.to[0], e.to[1], e.to[2], 0.7, 45);
        if (e.p !== S.me && e.k === 0) S.sfx.whiz(e.from, e.to);
        break;
      }
      case 'degat': {
        S.fx.hitSpark(e.x, e.y - 0.2, e.z, e.head ? 'tete' : e.sh ? 'bouclier' : 'vie', e.n > 40 ? 12 : 7);
        if (e.by === S.me && e.to !== S.me) {
          const Q = S.sim.player(e.to);
          S.hud.hitMarker(e.head, Q && !Q.alive);
          S.hud.damageNumber(e.x, e.y, e.z, e.n, e.head, e.sh);
          S.sfx.play(e.head ? 'tete' : e.sh ? 'bouclier' : 'touche');
          if (e.sh && Q && Q.sh <= 0) S.sfx.play('bouclier-casse');
        }
        if (e.to === S.me) {
          const A = e.by != null ? S.sim.player(e.by) : null;
          S.hud.hurtFrom(A && P ? -(Math.atan2(A.x - P.x, A.z - P.z) - S.yaw) : null, e.n);
          S.shake = Math.max(S.shake, Math.min(0.5, 0.12 + e.n / 120));
          S.sfx.play(e.cause === 'tempete' ? 'tempete' : 'aie');
        }
        break;
      }
      case 'elim': {
        const killer = e.by != null ? `<b>${esc(nameOf(e.by))}</b>` : '';
        const icon = (id) => (S.sim.player(id) && S.sim.player(id).bot ? ' 🤖' : '');
        S.hud.feedLine(e.by != null ? `${killer}${icon(e.by)} a éliminé <b>${esc(nameOf(e.to))}</b>${icon(e.to)} ${CAUSES[e.cause] || ''}` : `<b>${esc(nameOf(e.to))}</b>${icon(e.to)} éliminé ${CAUSES[e.cause] || ''}`, e.by === S.me || e.to === S.me);
        if (e.to === S.me) {
          // en équipe, la place n'est connue qu'à la sortie du dernier coéquipier
          S.hud.say(`Éliminé${e.by != null ? ' par ' + esc(nameOf(e.by)) : ''}<small>${!e.place ? 'Ton équipe continue · <kbd>Espace</kbd> : suivre un autre joueur' : `${e.place}${e.place === 1 ? 'er' : 'e'} sur ${S.sim.S.teams > 1 ? new Set([...S.sim.S.players.values()].map((Q) => Q.team)).size + ' équipes' : S.sim.S.players.size} · <kbd>Espace</kbd> : regarder un autre joueur`}</small>`, 5);
          S.spect = e.by != null && S.sim.player(e.by) && S.sim.player(e.by).alive ? e.by : pickSpectate();
          S.sfx.play('elimine');
        } else if (e.by === S.me) { S.hud.say(`Tu as éliminé <b>${esc(nameOf(e.to))}</b><small>${e.left} encore en vie</small>`, 2.5); S.sfx.play('elimination'); }
        break;
      }
      case 'abattu': {
        S.hud.feedLine(`${e.by != null ? `<b>${esc(nameOf(e.by))}</b> a mis` : ''} <b>${esc(nameOf(e.to))}</b> à terre ${CAUSES[e.cause] || ''}`, e.to === S.me || e.by === S.me);
        if (e.to === S.me) { S.hud.say('À terre !<small>Rampe vers tes coéquipiers : ils peuvent te relever</small>', 3); S.sfx.play('aie'); }
        else if (e.by === S.me) { S.hud.say(`<b>${esc(nameOf(e.to))}</b> est à terre<small>Ses coéquipiers peuvent le relever</small>`, 2); S.sfx.play('elimination'); }
        break;
      }
      case 'releve': {
        const mine = P && (e.to === S.me || e.by === S.me || S.sim.mates(P, S.sim.player(e.to) || {}));
        S.hud.feedLine(`<b>${esc(nameOf(e.by))}</b> a relevé <b>${esc(nameOf(e.to))}</b>`, mine);
        if (e.to === S.me) { S.hud.say(`Relevé par <b>${esc(nameOf(e.by))}</b> !<small>Soigne-toi vite</small>`, 2.5); S.sfx.play('soigne'); }
        else if (e.by === S.me) { S.hud.say(`Tu as relevé <b>${esc(nameOf(e.to))}</b>`, 2); S.sfx.play('soigne'); }
        break;
      }
      case 'releve…': if (e.p === S.me) S.sfx.play('bandage'); break;
      case 'largage': {
        S.hud.say('Largage en approche !<small>Une caisse de butin épique descend dans le cercle (losange violet sur la carte)</small>', 3.5);
        S.hud.feedLine('📦 Un largage descend dans le cercle');
        S.sfx.play('largage');
        break;
      }
      case 'largage-pose': S.fx.dust(e.x, e.y, e.z, { n: 14, r: 0.8, speed: 3 }); S.sfx.at('atterrit', e.x, e.y + 1, e.z, 1, 90); break;
      case 'largage-ouvert': {
        const d = S.sim.S.drops.get(e.id);
        if (d) { S.fx.puff(d.x, d.gy + 1, d.z, { color: 0xb77dff, size: 0.8, grow: 3, life: 0.8, add: true, op: 0.9 }); S.sfx.at('coffre', d.x, d.gy + 0.5, d.z, 1); }
        if (e.p !== S.me) S.hud.feedLine(`<b>${esc(nameOf(e.p))}</b> a ouvert un largage`, P && S.sim.mates(P, S.sim.player(e.p) || {}));
        break;
      }
      case 'repere': { const Q = P && S.sim.player(e.p); if (Q && (e.p === S.me || S.sim.mates(P, Q))) S.sfx.play('repere'); break; }
      case 'releve-': if (e.p === S.me) toast('Relevé interrompu : il faut rester à côté sans bouger ni tirer', 2.5); break;
      case 'boum': {
        S.fx.boom(e.x, e.y, e.z, e.r, e.kind);
        const d = Math.hypot(e.x - S.cam.x, e.y - S.cam.y, e.z - S.cam.z);
        if (d < 30) S.shake = Math.max(S.shake, (1 - d / 30) * 1.2);
        S.sfx.at(e.kind === 'souffle' ? 'souffle' : 'boum', e.x, e.y, e.z, 1);
        break;
      }
      case 'porte': {
        S.scene.interior.setDoor(e.id, e.open);
        const d = S.world.doors.get(e.id);
        if (d) S.sfx.at(e.open ? 'porte' : 'porteF', d.cx, d.y + 1, d.cz, 0.8);
        break;
      }
      case 'coffre': {
        const c = S.sim.S.chests.get(e.id);
        if (c) { S.fx.puff(c.x, c.y + 0.8, c.z, { color: 0xffd060, size: 0.6, grow: 2.5, life: 0.6, add: true, op: 0.9 }); S.sfx.at(c.kind === 'coffre' ? 'coffre' : 'caisse', c.x, c.y, c.z, 1); }
        break;
      }
      case 'ramasse': if (e.p === S.me) { toast(itemLabel(e.it), 1.6); S.sfx.play(e.it.t === 'arme' ? 'arme' : 'ramasse'); } break;
      case 'vide': if (e.p === S.me) { toast('Plus de munitions pour cette arme', 1.6); S.sfx.play('vide'); } break;
      case 'inutile': if (e.p === S.me) toast(ITEMS[e.c].heal ? 'Ta vie est déjà au maximum' : 'Ton bouclier est déjà au maximum', 1.6); break;
      case 'recharge': {
        const Q = S.sim.player(e.p);
        if (e.p === S.me && P) { const it = P.inv[P.sel - 1], W = it && WEAPONS[it.w]; S.sfx.reload(e.w, e.T || 2, null, W ? Math.max(1, Math.min(W.mag - it.mag, P.ammo[W.ammo])) : 3); }
        else if (Q) S.sfx.reload(e.w, e.T || 2, Q);
        break;
      }
      case 'arme': { const Q = S.sim.player(e.p); if (e.p === S.me) S.sfx.play('change'); else if (Q) S.sfx.at('change', Q.x, Q.y + 1, Q.z, 0.5, 18); break; }
      case 'soigne': if (e.p === S.me) S.sfx.play(ITEMS[e.c] && ITEMS[e.c].shield ? 'potion' : 'bandage'); break;
      case 'soin': if (e.p === S.me) S.sfx.play('soigne'); break;
      case 'lance': { const Q = S.sim.player(e.p), h = S.actors.heroOf(e.p); if (h && h.gesture) h.gesture('lancer'); if (Q) S.sfx.at('lance', Q.x, Q.y + 1.4, Q.z, 0.7); break; }
      case 'tremplin': { const h = e.p != null && S.actors.heroOf(e.p); if (h && h.gesture) h.gesture('pose'); S.sfx.at('pose', e.x, e.y, e.z, 0.8); break; }
      case 'propulse': S.sfx.at('tremplin', e.x, e.y, e.z, 1); break;
      case 'saut': if (e.p === S.me) S.sfx.play('saut'); break;
      case 'atterrit': {
        const Q = S.sim.player(e.p); if (Q) S.fx.dust(Q.x, Q.y, Q.z, { n: 8, r: 0.35, speed: 2.2 });
        if (e.p === S.me) {
          S.sfx.play('atterrit');
          // le rappel des touches se replie en une pastille peu après l'atterrissage (H le rouvre)
          if (!S.hintsFolded) { S.hintsFolded = true; setTimeout(() => $('#hints').classList.add('off'), 20000); }
        }
        break;
      }
      case 'tempete': if (e.state === 'fermeture' || e.k > 0) { S.hud.say('La tempête se referme !<small>Rejoins le cercle blanc</small>', 3); S.sfx.play('alerte'); } break;
      case 'fin': endMatch(e.winner); break;
      case 'construit': { const h = S.actors.heroOf(e.piece.owner); if (h && h.gesture) h.gesture('pose'); }
        S.builds.add(e.piece); if (e.piece.owner === S.me) buildBar(); S.sfx.at('construit', (e.piece.x + 0.5) * 4, e.piece.y0 + 1, (e.piece.z + 0.5) * 4, 0.9); break;
      case 'coup': {
        const col = { bois: 0xb08a5a, pierre: 0xa9a49a, metal: 0xc8ccd0 }[e.mat] || 0xcfc6b5;
        S.fx.puff(e.x, e.y, e.z, { color: col, size: 0.3, grow: 1.6, life: 0.4, op: 0.8 });
        S.fx.debris(e.x, e.y, e.z, e.mat, { n: 3, spread: 0.2, power: 2.5 });
        if (e.by === S.me) { S.hud.structure(e.hp, e.max); S.sfx.play('coup-' + (e.mat || 'bois')); }
        break;
      }
      case 'casse': {
        hideBroken(e.key);
        const col = { bois: 0x9a6a3a, pierre: 0x8a857c, metal: 0xaab2b8 }[e.mat] || 0x9a8a78;
        for (let i = 0; i < 4; i++) S.fx.puff(e.x + (Math.random() - 0.5) * 2, e.y + (Math.random() - 0.5) * 2, e.z + (Math.random() - 0.5) * 2, { color: col, size: 0.6, grow: 2.2, life: 0.9, op: 0.75, rise: 0.4 });
        S.fx.debris(e.x, e.y, e.z, e.mat, { n: 16, spread: 1.6, power: 4.5 });
        S.sfx.at('casse', e.x, e.y, e.z, 0.9);
        break;
      }
      case 'recolte': if (e.p === S.me) { S.hud.gain(`+${e.n} ${MATERIALS[e.m].label.toLowerCase()}`, MATERIALS[e.m].color); buildBar(); } break;
      case 'pioche': { const h = S.actors.heroOf(e.p); if (h) h.shot(); if (e.p === S.me) S.sfx.play('pioche'); break; }
      case 'manque': if (e.p === S.me) toast(`Pas assez de ${MATERIALS[e.m].label.toLowerCase()} (${COST} par pièce)`, 1.6); break;
      default: break;
    }
  }
}

// ------------------------------------------------------------------ fin de partie
// a-t-on gagné ? (en équipe : son équipe est la dernière debout)
function iWon(winner) {
  const P = me();
  return S.sim.S.teams > 1 ? !!P && P.team != null && P.team === S.sim.S.winTeam : winner === S.me;
}
function endMatch(winner) {
  if (S.ended) return;
  S.ended = true;
  S.hud.downed(null);
  const res = S.sim.results(), mine = res.find((r) => r.id === S.me);
  if (mine && S.sim.S.mode !== 'exploration') {
    const n = S.sim.S.teams > 1 ? new Set(res.map((r) => r.team)).size : res.length;
    saveHist({ place: iWon(winner) ? 1 : mine.place || n, n, kills: mine.kills });
  }
  if (iWon(winner)) { S.hud.say(S.sim.S.teams > 1 ? 'Dernière équipe debout !<small>Ton équipe a gagné la partie</small>' : 'Dernier debout !<small>Tu as gagné la partie</small>', 0, 'win'); S.sfx.play('victoire'); }
  report(res);
  // l'hôte fait foi : son bilan (tirs, distance, relevés…) part chez les invités
  if (S.role === 'host' && H.embedded) H.send('all', { t: 'bilan', run: S.run, res });
  const run = S.run;
  setTimeout(() => {
    if (S.run !== run || !S.sim) return;
    const all = S.bilan || res;
    S.input.unlock(); showScreen('fin', { res: all, mine: all.find((r) => r.id === S.me), winner });
  }, 3500);
}
function report(res) {
  if (S.reported || S.role === 'guest') return;
  S.reported = true;
  if (!H.embedded) return;
  try {
    H.report({
      id: `royale-${S.run}-${res.length}`, mode: S.sim.S.teams > 1 ? 'Battle royale · ' + TEAM_LABEL[S.sim.S.teams].toLowerCase() : 'Battle royale',
      players: res.map((r) => ({ id: r.bot ? null : r.id, name: r.name, color: r.color, bot: r.bot, rank: r.place, score: r.kills })),
    });
  } catch (e) { console.warn(e); }
}

// ------------------------------------------------------------------ interactions affichées sous le viseur
function showPrompt() {
  const P = me();
  if (P && P.alive && P.mode === 'ballon') { S.hud.prompt('Sauter', '', '', 'Espace'); return; }
  if (P && P.alive && P.mode === 'chute') { S.hud.prompt('Ouvrir le deltaplane', '', '', 'Espace'); return; }
  if (!P || !P.alive || P.mode !== 'sol' || P.down) { S.hud.prompt(''); return; }
  if (P.revive) { S.hud.prompt('Ne bouge pas, tu relèves', (S.sim.player(P.revive.id) || {}).name || '', '#4ade80', '…'); return; }
  const tg = S.sim.target(P);
  if (!tg) { S.hud.prompt(''); return; }
  if (tg.kind === 'releve') { S.hud.prompt('Relever', tg.o.name, '#4ade80'); return; }
  if (tg.kind === 'porte') S.hud.prompt((tg.o.open ? 'Fermer' : 'Ouvrir') + (tg.o.kind === 'portail' ? ' le portail' : ' la porte'));
  else if (tg.kind === 'coffre') S.hud.prompt(tg.o.kind === 'coffre' ? 'Ouvrir le coffre' : 'Ouvrir la caisse de munitions');
  else if (tg.kind === 'largage') S.hud.prompt('Ouvrir le largage', 'butin épique', '#b77dff');
  else {
    const it = tg.o.it, full = P.inv.every(Boolean) && !(it.t === 'objet' && P.inv.some((q) => q && q.t === 'objet' && q.c === it.c));
    S.hud.prompt(!full ? 'Ramasser' : P.sel === 0 ? 'Sac plein : prends en main ce que tu veux échanger' : 'Échanger contre', full && P.sel === 0 ? '' : itemLabel(it), RARITY[it.r].color);
  }
}

// ------------------------------------------------------------------ écrans
const icon = (n) => `<img class="ic" src="img/icons/${n}.png" alt="">`;
function lobbyList() {
  const hs = humans(), bots = Math.max(0, clamp(S.settings.places, 2, MAX_PLACES) - hs.length);
  const rows = hs.map((p) => {
    const ready = !H.embedded || p.id === S.me || H.readyMap[p.id] === 'royale';
    return `<span class="${ready ? '' : 'wait'}"><i style="--c:${esc(p.color || '#ff4b2b')}"></i>${esc(p.name)}${p.id === S.me ? ' <em>toi</em>' : ready ? '' : ' <em>charge…</em>'}</span>`;
  }).join('');
  let lvl = LEVEL_LABEL[S.settings.level] || '';
  if (S.settings.level === 'auto') {
    const mix = botMix(roomSkill()), parts = [['facile', 'faciles'], ['normal', 'normaux'], ['difficile', 'coriaces']].map(([k, l]) => [Math.round(bots * mix[k]), l]).filter(([v]) => v > 0);
    lvl = `au niveau auto : ${parts.map(([v, l]) => `${v} ${l}`).join(', ')}`;
  }
  return `<div class="squad">${rows}${S.settings.mode !== 'exploration' && bots ? `<span class="bots"><i></i>${bots} bots ${lvl}</span>` : ''}</div>`;
}
// équipes (duos, trios) : chacun clique sur une équipe ; les places libres sont prises par des bots coéquipiers
function teamPicker() {
  const size = S.settings.teams;
  if (S.settings.mode === 'exploration' || size <= 1) return '';
  const hs = humans(), label = TEAM_LABEL[size].toLowerCase(), s = size > 2 ? 's' : '';
  if (hs.length <= 1) return `<h2>Ton équipe</h2><p class="hint">Tu joues en ${label} avec ${size - 1} bot${s} coéquipier${s} : ils sautent avec toi, te suivent et te relèvent.</p>`;
  const K = Math.min(hs.length, Math.ceil(clamp(S.settings.places, 2, MAX_PLACES) / size)), mine = S.picks.get(S.me);
  const cards = Array.from({ length: K }, (_, k) => {
    const mem = hs.filter((h) => S.picks.get(h.id) === k), full = mem.length >= size && mine !== k;
    return `<button class="teamc${mine === k ? ' on' : ''}" data-team="${k}" ${full ? 'disabled' : ''}><b>Équipe ${k + 1}</b>${mem.map((h) => `<span><i style="--c:${esc(h.color || '#888')}"></i>${esc(h.name)}${h.id === S.me ? ' <em>toi</em>' : ''}</span>`).join('')}${mem.length < size ? `<span class="free">${size - mem.length} place${size - mem.length > 1 ? 's' : ''} : bots si personne</span>` : ''}</button>`;
  }).join('');
  const loose = hs.filter((h) => { const k = S.picks.get(h.id); return !(Number.isInteger(k) && k >= 0 && k < K); });
  return `<h2>Ton équipe · ${TEAM_LABEL[size]}</h2><div class="teams">${cards}</div><p class="hint">${loose.length ? `Pas encore choisi : ${loose.map((h) => esc(h.name)).join(', ')} (réparti${loose.length > 1 ? 's' : ''} au lancement). ` : ''}Les places libres sont prises par des bots coéquipiers.</p>`;
}
// un choix d'équipe a changé : on rafraîchit l'écran d'accueil s'il est affiché
// ------------------------------------------------------------------ repères d'équipe
// ce que vise le réticule : un ennemi près du rayon (avant le premier obstacle), sinon, au point visé, un largage, le
// butin le plus rare, un coffre fermé, ou simplement l'endroit (« Ici »)
function aimPing() {
  const P = me();
  if (!P || !P.alive || P.mode === 'ballon') return null;
  const c = S.cam, cp = Math.cos(S.pitch), d = [Math.sin(S.yaw) * cp, Math.sin(S.pitch), Math.cos(S.yaw) * cp];
  const hit = S.world.raycast(c.x, c.y, c.z, d[0], d[1], d[2], 400), L = hit.t < 400 ? hit.t : null;
  let foe = null, fd = Infinity;
  for (const Q of S.sim.S.players.values()) {
    if (Q === P || !Q.alive || Q.mode === 'ballon' || S.sim.mates(P, Q)) continue;
    const ox = Q.x - c.x, oy = Q.y + 1 - c.y, oz = Q.z - c.z, t = ox * d[0] + oy * d[1] + oz * d[2];
    if (t < 0 || t > 400 || (L != null && t > L + 1)) continue;
    const off = Math.hypot(ox - d[0] * t, oy - d[1] * t, oz - d[2] * t);
    if (off < Math.max(1.3, t * 0.025) && t < fd) { fd = t; foe = Q; }
  }
  if (foe) return { kind: 'ennemi', x: foe.x, y: foe.y + 1.3, z: foe.z, target: foe.id };
  if (L == null) return null;
  const x = c.x + d[0] * L, y = c.y + d[1] * L, z = c.z + d[2] * L, SS = S.sim.S;
  for (const dr of (SS.drops || new Map()).values()) if (!dr.open && Math.hypot(dr.x - x, dr.z - z) < 5) return { kind: 'largage', x: dr.x, y: dr.gy + 1.6, z: dr.z, what: 'Largage' };
  let g = null;
  for (const it of SS.items.values()) if ((it.it.t === 'arme' || it.it.t === 'objet') && Math.hypot(it.x - x, it.z - z) < 2.5 && Math.abs(it.y - y) < 2.5 && (!g || it.it.r > g.it.r)) g = it;
  if (g) return { kind: 'butin', x: g.x, y: g.y + 0.9, z: g.z, what: itemLabel(g.it) };
  for (const ch of SS.chests.values()) if (!ch.open && Math.hypot(ch.x - x, ch.z - z) < 3 && Math.abs(ch.y - y) < 2.5) return { kind: 'butin', x: ch.x, y: ch.y + 1.1, z: ch.z, what: ch.kind === 'coffre' ? 'Coffre' : 'Caisse de munitions' };
  return { kind: 'ici', x, y: y + 0.3, z };
}
function sendPing() {
  const pg = aimPing();
  if (!pg) return;
  if (S.role === 'guest') H.send('host', { t: 'repere', ...pg });
  else S.sim.ping(me(), pg.kind, pg.x, pg.y, pg.z, pg.target, pg.what);
}
// repères visibles par le joueur suivi : les siens et (en équipe) ceux de ses coéquipiers, encore frais
const PING_LABEL = { ici: 'Ici', ennemi: 'Ennemi', butin: 'Butin', largage: 'Largage' };
function pingsOf(F, fp, view) {
  const SS = S.sim.S, out = [];
  const camYaw = view.look ? Math.atan2(view.look.x - view.pos.x, view.look.z - view.pos.z) : S.yaw;
  for (const pg of SS.pings.values()) {
    const age = SS.t - pg.t, Q = SS.players.get(pg.p);
    if (age > PING_T || !Q || !(pg.p === F.id || (SS.teams > 1 && pg.team === F.team))) continue;
    const color = pg.kind === 'ennemi' ? '#ff5a4a' : pg.kind === 'largage' ? '#b77dff' : pg.kind === 'butin' ? '#ffc531' : Q.color || '#ffd23f';
    const dist = Math.round(Math.hypot(pg.x - fp.x, pg.z - fp.z));
    out.push({ key: pg.p, x: pg.x, y: pg.y, z: pg.z, color, label: pg.what || PING_LABEL[pg.kind] || 'Ici',
      sub: `${pg.p === F.id ? '' : Q.name + ' · '}${dist} m`, fade: Math.min(1, (PING_T - age) / 2),
      rel: Math.atan2(pg.x - view.pos.x, pg.z - view.pos.z) - camYaw });
  }
  return out;
}
// historique des parties de ce navigateur (niveau « Auto ») ; niveau moyen des joueurs du salon
function loadHist() { try { const h = JSON.parse(localStorage.getItem('royale_hist') || '[]'); return Array.isArray(h) ? h : []; } catch (e) { return []; } }
function saveHist(r) {
  const h = [r, ...loadHist()].slice(0, HIST_MAX);
  try { localStorage.setItem('royale_hist', JSON.stringify(h)); } catch (e) { /* pas de stockage */ }
  S.mySkill = skillOf(h);
  if (H.embedded && S.role === 'guest') H.send('host', { t: 'skill', s: S.mySkill.s });
}
function roomSkill() {
  const hs = humans();
  const v = hs.map((h) => (h.id === S.me ? S.mySkill.s : S.skills.has(h.id) ? S.skills.get(h.id) : 0.5));
  return v.reduce((a, b) => a + b, 0) / Math.max(1, v.length);
}
function refreshLobby() { if (!S.sim && (S.screen === 'start' || S.screen === 'attente')) showScreen(S.screen, S.screenData); }
const KEYS = `<div class="keylist"><span><kbd>B</kbd> ou <kbd>Clic molette</kbd> repère pour l'équipe</span><span><kbd>Z</kbd><kbd>Q</kbd><kbd>S</kbd><kbd>D</kbd> ou <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> se déplacer</span><span><kbd>Souris</kbd> regarder · <kbd>Clic</kbd> tirer · <kbd>Clic droit</kbd> viser</span>
  <span><kbd>Espace</kbd> sauter, ouvrir le deltaplane</span><span><kbd>Maj</kbd> sprinter · <kbd>Ctrl</kbd> s'accroupir</span>
  <span><kbd>1</kbd>…<kbd>5</kbd> ou molette : objets · <kbd>X</kbd> pioche</span><span><kbd>E</kbd> ouvrir, ramasser · <kbd>R</kbd> recharger · <kbd>G</kbd> lâcher</span>
  <span><kbd>Tab</kbd> sac (ranger ses objets) · <kbd>M</kbd> carte</span><span><kbd>F</kbd> mur · <kbd>V</kbd> sol · <kbd>C</kbd> escalier · <kbd>T</kbd> matériau</span></div>`;
// modèles 3D sous licence CC BY : l'attribution doit rester visible
const CREDITS = '<p class="hint credits">Modèles 3D : Quaternius, Kenney (CC0) · J-Toastie, Zsky, Danni Bittman, Jens Kull, Poly by Google (CC BY 3.0, via poly.pizza) · Textures : Poly Haven (CC0) · Sons : Free Firearm Sound Library, Kenney, SpringySpringo, BMacZero, zer0_sol, Emma_MA (CC0) · Pas : congusbongus, swuing, Eelke, EminYILDIRIM, ceberation (CC BY 3.0)</p>';
function showScreen(kind, data) {
  const el = $('#screen');
  el.hidden = !kind;
  S.screen = kind; S.screenData = data;
  if (!kind) return;
  const expl = S.settings.mode === 'exploration';
  const play = (label) => `<button class="btn big" id="go">${label}</button>`;
  const back = `<button class="btn ghost" id="quit">${H.embedded ? 'Retour au salon' : 'Quitter'}</button>`;
  const touch = matchMedia('(pointer: coarse)').matches ? '<p class="lead">Pour l\'instant, Island Rush se joue au clavier et à la souris.</p>' : '';
  const opts = '<div class="opts"><button class="btn ghost" id="settings" type="button">⚙️ Réglages</button></div>';
  const title = '<h1>Island <span>Rush</span></h1>';
  const n = clamp(S.settings.places, 2, MAX_PLACES);
  const rules = expl
    ? [['compass', 'Explore', 'Une ville, un bourg, des villages, un port et des lieux-dits, sans combat.'], ['structure_house', 'Entre partout', 'Portes (E), escaliers jusqu\'aux toits plats, pièces meublées.'], ['flag', 'Voyage', 'Clique sur la carte (M) pour t\'y rendre.']]
    : [['flag', 'Saute', 'Quitte la montgolfière quand tu veux (Espace), puis plane jusqu\'au sol.'], ['pouch', 'Fouille', 'Coffres dorés, caisses de munitions et butin au sol, dans les maisons comme en pleine nature.'],
      ['hourglass', 'Reste dans le cercle', 'La tempête se referme en sept phases et fait mal dehors.'], ['structure_house', 'Casse et construis', 'La pioche (X) récolte bois, pierre et métal ; F, V, C posent murs, sols et escaliers.'],
      S.settings.teams > 1
        ? ['crown_a', 'Dernière équipe debout', `${n} joueurs en ${TEAM_LABEL[S.settings.teams].toLowerCase()} : à 0 PV, on tombe à terre et un coéquipier relève (E, 5 s sans bouger).`]
        : ['crown_a', 'Dernier debout', `${n} joueurs sur l'île : le dernier en vie gagne.`]];
  // son personnage et sa couleur
  const col = S.look.color || (S.meInfo && S.meInfo.color) || PALETTE[0];
  if (!S.portraits || S.portraits.col !== col) S.portraits = { col, img: renderPortraits(S.scene.kit, col) };
  const lookHtml = LOOKS.length > 1 && S.portraits.img.soldat ? `<h2>Ton personnage</h2><div class="looks">${LOOKS.map((k) => `<button class="look${k === S.look.char ? ' on' : ''}" data-char="${k}"><img src="${S.portraits.img[k] || ''}" alt=""><span>${CHARACTERS[k].label}</span></button>`).join('')}</div>
    <div class="swatches">${PALETTE.map((c) => `<button class="sw${c === col ? ' on' : ''}" data-color="${c}" style="--c:${c}" aria-label="Couleur ${c}"></button>`).join('')}</div>` : '';
  const rulesHtml = `<div class="rules">${rules.map(([i, b, t]) => `<div>${icon(i)}<span><b>${b}</b>${t}</span></div>`).join('')}</div>`;
  let html;
  if (kind === 'start') {
    html = `<p class="eyebrow">${expl ? 'Exploration' : 'Battle royale'}</p>${title}<p class="lead">${expl ? 'Promène-toi sur l\'île, entre dans chaque bâtiment.' : 'Saute, fouille, survis à la tempête : sois le dernier debout.'}</p>
      ${lookHtml}${teamPicker()}${rulesHtml}${H.embedded ? lobbyList() : ''}${touch}<h2>Commandes</h2>${KEYS}${opts}
      <div class="row end">${back}${play(expl ? 'Explorer l\'île' : net() ? 'Lancer la partie' : 'Monter à bord')}</div>${CREDITS}`;
  } else if (kind === 'attente') {
    html = `<p class="eyebrow">Battle royale</p>${title}<p class="lead"><span class="wait"><i></i>L'hôte va lancer la partie</span></p>${lookHtml}${teamPicker()}${lobbyList()}${rulesHtml}${touch}<h2>Commandes</h2>${KEYS}${opts}<div class="row end">${back}</div>`;
  } else if (kind === 'rejoint') {
    html = `<p class="eyebrow">C'est parti</p>${title}<p class="lead">${S.sim.S.phase === 'vol' ? 'Tu es dans la montgolfière : saute quand tu veux (Espace).' : 'La partie a commencé.'}</p><h2>Commandes</h2>${KEYS}${opts}<div class="row end">${back}${play('Jouer')}</div>`;
  } else if (kind === 'spectateur') {
    html = `<p class="eyebrow">Partie en cours</p>${title}<p class="lead">Tu es arrivé après le départ de la montgolfière : tu regardes les autres jouer (<kbd>Espace</kbd> pour changer de joueur). Tu joueras à la prochaine partie.</p>${opts}<div class="row end">${back}${play('Regarder')}</div>`;
  } else if (kind === 'perdu') {
    html = `<p class="eyebrow">Liaison perdue</p>${title}<p class="lead">L'hôte ne répond plus.</p><div class="row end">${back}</div>`;
  } else if (kind === 'pause') {
    html = `<p class="eyebrow">Pause</p><h1>En pause</h1><p class="lead">La partie continue pendant la pause.</p><h2>Commandes</h2>${KEYS}${opts}<div class="row end">${back}${play('Reprendre')}</div>`;
  } else {
    const { res, mine, winner } = data;
    const won = iWon(winner), tm = S.sim.S.teams > 1, nTeams = tm ? new Set(res.map((r) => r.team)).size : res.length;
    const rows = res.map((r) => `<tr class="${r.id === S.me ? 'me' : mine && tm && r.team === mine.team ? 'mate' : ''}"><td>${r.place}</td>${tm ? `<td>${r.team + 1}</td>` : ''}<td><i style="background:${esc(r.color || '#888')}"></i>${esc(r.name)}${r.bot ? ' 🤖' : ''}</td><td>${r.kills}</td><td>${r.dealt}</td></tr>`).join('');
    const head = mine ? `<div class="big-num">${won ? 'Victoire' : `${mine.place}<small>e sur ${nTeams}${tm ? ' équipes' : ''}</small>`}</div>` : `<div class="big-num">${winner != null ? esc(nameOf(winner)) : 'Fin'}<small> gagne</small></div>`;
    const tags = mine ? bilanHtml(mine, res) : '';
    const wait = S.role === 'guest' ? '<p class="hint">L\'hôte peut relancer une partie.</p>' : '';
    html = `<p class="eyebrow">Fin de partie</p><h1>${won ? (tm ? 'Dernière équipe <span>debout</span> !' : 'Dernier <span>debout</span> !') : 'Island <span>Rush</span>'}</h1>${head}${tags}
      <h2>Classement</h2><div class="resbox"><table class="res"><thead><tr><th>#</th>${tm ? '<th>Éq.</th>' : ''}<th>Joueur</th><th>Élim.</th><th>Dégâts</th></tr></thead><tbody>${rows}</tbody></table></div>${wait}
      <div class="row end">${back}${S.role !== 'guest' ? '<button class="btn big" id="again">Rejouer</button>' : ''}</div>`;
    el.querySelector('.panel').classList.toggle('win', won);
  }
  el.querySelector('.panel').innerHTML = html;
  const go = $('#go'); if (go) go.onclick = () => { S.sfx.unlock(); if (kind === 'start') startMatch(); else S.input.lock(); };
  el.querySelectorAll('.look').forEach((b) => { b.onclick = () => { setLook({ ...S.look, char: b.dataset.char }); showScreen(kind, data); }; });
  el.querySelectorAll('.sw').forEach((b) => { b.onclick = () => { setLook({ ...S.look, color: b.dataset.color }); showScreen(kind, data); }; });
  el.querySelectorAll('.teamc').forEach((b) => { b.onclick = () => { const k = +b.dataset.team; S.picks.set(S.me, k); if (H.embedded) H.send('all', { t: 'team', k }); showScreen(kind, data); }; });
  // rejouer : tout de suite, sur l'île remise à neuf (les invités suivent quand la partie part)
  const again = $('#again'); if (again) again.onclick = () => { S.sfx.unlock(); resetMatch(); startMatch(); };
  $('#quit').onclick = quit;
  const set = $('#settings'); if (set) DDVolume.panel(set, SETTINGS);
}
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
// bilan personnel : éliminations, dégâts, précision, distance, temps de survie, relevés, et qui nous a éliminés
function bilanHtml(r, res) {
  const time = r.out != null ? r.out : S.sim ? S.sim.S.t : (Date.now() - S.startedAt) / 1000;
  const acc = r.shots ? Math.round(r.hits / r.shots * 100) + ' %' : '–';
  const killer = r.by != null && res.find((q) => q.id === r.by);
  const cards = [
    ['skull', r.kills, `élimination${r.kills > 1 ? 's' : ''}`], ['sword', r.dealt, 'dégâts'], ['target', acc, `précision (${r.hits || 0}/${r.shots || 0} tirs)`],
    ['hourglass', fmtTime(time), r.out != null ? 'de survie' : 'jusqu\'au bout'], ['compass', r.dist >= 1000 ? (r.dist / 1000).toFixed(1).replace('.', ',') + ' km' : (r.dist || 0) + ' m', 'parcourus'],
  ];
  if (S.sim && S.sim.S.teams > 1) cards.push(['hand', r.revives || 0, `coéquipier${r.revives > 1 ? 's' : ''} relevé${r.revives > 1 ? 's' : ''}`]);
  return `<div class="bilan">${cards.map(([i, v, l]) => `<span>${icon(i)}<b>${v}</b><small>${l}</small></span>`).join('')}</div>`
    + (killer ? `<p class="hint">Éliminé par <b>${esc(killer.name)}</b>${killer.bot ? ' 🤖' : ''} ${CAUSES[r.how] || ''} · ${killer.kills} élimination${killer.kills > 1 ? 's' : ''} dans la partie</p>` : r.how ? `<p class="hint">Éliminé ${CAUSES[r.how] || ''}</p>` : '');
}
// panneau Réglages (commun à tous les jeux) : la musique (montgolfière et descente) et les effets, puis la sensibilité
const SETTINGS = {
  kinds: ['music', 'fx'], accent: '#3d9fd9',
  sections: [{ title: 'Jeu', items: [{ label: 'Sensibilité', range: [0.4, 2.2, 0.1], get: () => +(S.input.sens / 0.0024).toFixed(1),
    set: (v) => { S.input.sens = 0.0024 * v; saveOpts(); }, format: (v) => '× ' + (+v).toFixed(1) }] }],
};
function saveOpts() { try { localStorage.setItem('royale_opts', JSON.stringify({ sens: S.input.sens })); } catch (e) { /* pas de stockage */ } }
function loadOpts() {
  // l'ancien curseur « Volume » (0,8 par défaut) devient le point de départ du curseur « Effets »
  try { const o = JSON.parse(localStorage.getItem('royale_opts') || '{}'); if (o.sens) S.input.sens = clamp(+o.sens, 0.0005, 0.008); if (o.vol != null) DDVolume.migrate('fx', clamp(+o.vol, 0, 1) / 0.8); } catch (e) { /* pas de stockage */ }
}
function quit() {
  S.running = false;
  try { S.input && S.input.dispose(); S.actors && S.actors.dispose(); S.fx && S.fx.dispose(); S.scene && S.scene.dispose(); S.sfx && S.sfx.dispose(); } catch (e) { console.error(e); }
  if (H.embedded) H.exit(); else location.reload();
}
let toastT = 0;
function toast(msg, sec = 3) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, sec * 1000);
}

if (H.embedded) H.on('init', boot);
else boot({ role: 'solo', myId: 0 });
