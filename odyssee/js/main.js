// odyssee/js/main.js — démarrage : rendu basse résolution, écran titre, nouvelle partie / continuer
import * as THREE from 'three';
import { WorldView } from './render/world3d.js';
import { buildWorld } from './world/region.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { UI, el, esc, wait } from './ui/ui.js';
import { optionsScreen, loadCodeScreen } from './ui/screens.js';
import { decodeSave, saveSummary } from './core/savecode.js';
import { Game } from './game.js';
import { ASSETS, loadImg } from './assets.js';
import { SPECIES } from './data/species.js';

const H = window.HubBridge;
const canvas = document.getElementById('gl'), uiRoot = document.getElementById('ui'), loading = document.getElementById('loading');

function fatal(e) {
  console.error(e);
  loading.style.display = 'flex'; loading.innerHTML = `<div>Oups, le jeu a rencontré un problème.<br><small>${esc(e && e.message ? e.message : e)}</small></div>`;
  if (H && H.logCrash) H.logCrash('CRASH_JS_ERROR', 'Odyssée : ' + (e && e.message ? e.message : e), { stack: e && e.stack });
}
addEventListener('error', (e) => fatal(e.error || e.message));
addEventListener('unhandledrejection', (e) => fatal(e.reason));

async function boot() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.outputColorSpace = THREE.SRGBColorSpace;
  const input = new Input(), sound = new Sound(), ui = new UI(uiRoot, input, sound);
  const world = buildWorld();
  const chars = await loadImg(ASSETS.chars);
  const view = new WorldView(renderer, chars);
  const game = new Game({ view, ui, input, sound, world });
  window.__ody = { game, world, view, ui, sound };

  // rendu en basse résolution, agrandi sans lissage : chaque « pixel » du jeu fait --px pixels d'écran
  const resize = () => {
    const scale = Math.max(2, Math.round(innerHeight / 270));
    const iw = Math.ceil(innerWidth / scale), ih = Math.ceil(innerHeight / scale);
    renderer.setSize(iw, ih, false); view.resize(iw, ih);
    document.documentElement.style.setProperty('--px', scale + 'px');
    document.documentElement.style.setProperty('--bp', (innerHeight / 192) + 'px');
  };
  addEventListener('resize', resize); resize();
  // le premier appui débloque le son
  const unlock = () => sound.init();
  addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);

  let mode = 'title', t = 0, last = performance.now();
  const loop = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now; t += dt;
    if (mode === 'game') game.tick(dt);
    else if (mode === 'title') { const k = (t * 0.6) % 160; view.update(dt, 168 + k, 123 + Math.sin(t * 0.1) * 4); view.render(); }
    requestAnimationFrame(loop);
  };
  view.setMap(world.maps.monde); view.setTimeOfDay(new Date().getHours() + new Date().getMinutes() / 60);
  loading.style.display = 'none';
  requestAnimationFrame(loop);
  ui.fade(false, 500);
  if (H && H.embedded) H.signalReady();
  // outil de test : démarrer directement une partie depuis la console
  window.__ody.play = async (state) => { document.querySelector('.title-scr')?.remove(); input.handlers.length = 0; ui.closeDialog(); mode = 'game'; await game.start(state); };

  /* ---------------- écran titre ---------------- */
  for (;;) {
    sound.play('title');
    const title = el('div', 'title-scr', `<div class="logo"><div class="logo-main">ODYSSÉE</div><div class="logo-sub">Version Argent</div></div><div class="press">Appuie sur Entrée</div><div class="title-foot">Flèches / ZQSD : marcher · Espace : parler · Échap : menu · Maj : courir</div>`);
    uiRoot.appendChild(title);
    await new Promise((res) => { const pop = input.push((k) => { if (k === 'a') { pop(); sound.init(); sound.sfx('select'); res(); } }); });
    title.querySelector('.press').remove();
    const has = Game.hasSave();
    let info = null;
    if (has) { try { const s = JSON.parse(localStorage.getItem('odyssee-save-v1')); info = s; } catch (e) {} }
    const opts = (has ? ['Continuer'] : []).concat(['Nouvelle partie', 'Charger un code', 'Options'], H && H.embedded ? ['Retour au salon'] : []);
    const card = info ? el('div', 'box save-info', `<b>${esc(info.name)}</b><br>Badges : ${info.badges.filter(Boolean).length} · Pokédex : ${info.dex.caught.length}<br>Temps : ${Math.floor(info.time / 3600)}:${String(Math.floor(info.time / 60) % 60).padStart(2, '0')}`) : null;
    if (card) title.appendChild(card);
    const r = await ui.list({ items: opts.map((label) => ({ label })), cls: 'title-menu', cancel: null, parent: title });
    const pick = opts[r];
    if (pick === 'Options') { title.remove(); await optionsScreen(game); continue; }
    if (pick === 'Charger un code') {
      title.remove();
      const r = await loadCodeScreen(ui, decodeSave);
      if (!r) continue;
      if (has && !(await ui.yesNo(`Remplacer la partie de cet appareil par celle de ${r.state.name} ? (${saveSummary(r.state)})`))) continue;
      try { localStorage.setItem('odyssee-save-v1', JSON.stringify(r.state)); } catch (e) { await ui.say('Impossible d\'enregistrer la partie sur cet appareil.'); continue; }
      sound.sfx('save');
      await ui.say(`Partie de ${r.state.name} chargée ! Choisis « Continuer » pour la reprendre.`);
      continue;
    }
    if (pick === 'Retour au salon') { H.exit(); title.remove(); continue; }
    if (pick === 'Nouvelle partie' && has && !(await ui.yesNo('Une sauvegarde existe déjà. Commencer une nouvelle partie l\'effacera. Continuer ?'))) { title.remove(); continue; }
    title.remove();
    let state;
    if (pick === 'Continuer') state = game.load();
    else state = await intro(game, ui, sound, input);
    await ui.fade(true, 300);
    mode = 'game';
    await game.start(state);
    break;
  }
}

/** présentation du professeur, choix du personnage et du nom */
async function intro(game, ui, sound, input) {
  sound.play('lab');
  const s = el('div', 'screen intro-scr', '<div class="intro-stage"><img class="intro-prof" alt=""><img class="intro-mon" alt=""><div class="intro-kid"></div></div>');
  uiRoot.appendChild(s);
  const prof = s.querySelector('.intro-prof'), mon = s.querySelector('.intro-mon'), kid = s.querySelector('.intro-kid');
  prof.src = ASSETS.trainer('sycamore');
  await wait(400); prof.classList.add('in');
  await ui.say(['Bonjour ! Bienvenue dans le monde des Pokémon !', 'Je m\'appelle Saule. Les gens d\'ici m\'appellent le Professeur Pokémon.']);
  mon.src = ASSETS.front(183); mon.classList.add('in'); sound.cry(ASSETS.cry(183));
  await ui.say(['Ce monde est peuplé de créatures appelées Pokémon.', 'Certains les adoptent comme compagnons, d\'autres les entraînent pour le combat.', 'Moi, j\'étudie le lien qui unit les dresseurs à leurs Pokémon.']);
  mon.classList.remove('in'); prof.classList.remove('in');
  await wait(300);
  const g = await ui.ask('Mais parle-moi un peu de toi. Es-tu un garçon ou une fille ?', ['Garçon', 'Fille'], { cancel: null });
  const gender = g === 1 ? 'f' : 'm';
  kid.className = 'intro-kid in ' + gender;
  const name = await ui.nameEntry('Quel est ton prénom ?', gender === 'f' ? 'Lyra' : 'Ethan');
  await ui.say([`${name}... C'est un joli prénom !`, `Ton voisin Théo est déjà en route pour mon laboratoire, à Bourg-Aube.`, `Alors, ${name}, prêt${gender === 'f' ? 'e' : ''} ? Ta propre aventure Pokémon commence maintenant !`]);
  s.classList.add('out'); await wait(500); s.remove();
  void SPECIES; void input;
  return game.newState(name, gender);
}

boot().catch(fatal);
