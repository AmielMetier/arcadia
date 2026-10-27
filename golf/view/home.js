// Birdie Party — accueil (hors du Hub) : survol des trous en fond, logo, puis réglages de la partie.
// Le survol enchaîne les trous du parcours choisi (un mélange des trois décors sur l'écran titre), avec un
// fondu blanc entre deux trous ; la musique du menu démarre au premier geste du joueur.
import * as THREE from '../../shared/vendor/three/three.module.min.js';
import { COURSES, HOLES } from '../engine/course.js';
import { esc, loadSetup, saveSetup } from './hud.js';
import { icon } from './icons.js';

const FLY = 16;                       // s de survol par trou
const SHOWCASE = [11, 9, 4, 21, 25, 16, 14, 27, 2, 18];
const CALM = { speed: 1.5, dir: 0.6, x: Math.sin(0.6) * 1.5, z: Math.cos(0.6) * 1.5 };
const THEMES = { campagne: 'Campagne', mer: 'Bord de mer', montagne: 'Montagne', desert: 'Désert' };
const ORDER = ['campagne', 'mer', 'montagne', 'desert', 'aller', 'retour', 'complet', 'tour'];
const parOf = (k) => COURSES[k].holes.reduce((t, n) => t + HOLES.find((h) => h.n === n).par, 0);
// part de chaque décor dans un parcours : [[thème, nombre de trous], …]
const mixOf = (k) => Object.entries(COURSES[k].holes.reduce((m, n) => { const t = HOLES.find((h) => h.n === n).theme; m[t] = (m[t] || 0) + 1; return m; }, {}));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function html(set, musicOn) {
  const seg = (key, label, opts) => `<div class="opt"><span class="opt-l" id="l-${key}">${label}</span><div class="seg" role="radiogroup" aria-labelledby="l-${key}" data-k="${key}">${opts.map(([v, l]) => `<button role="radio" data-v="${v}" aria-checked="${String(set[key]) === String(v)}">${l}</button>`).join('')}</div></div>`;
  const card = (k) => `<button class="course" data-v="${k}" aria-pressed="${set.course === k}">
      <img src="img/c-${k}.jpg" alt="" draggable="false"><span class="c-txt"><b>${THEMES[k]}</b><small>${COURSES[k].holes.length} trous · par ${parOf(k)}</small></span>${icon('check', 'c-ok')}</button>`;
  const combo = (k, name) => `<button class="combo" data-v="${k}" aria-pressed="${set.course === k}"><span class="mix" aria-hidden="true">${mixOf(k).map(([t, n]) => `<i class="t-${t}" style="flex:${n}"></i>`).join('')}</span><b>${name}</b><small>${COURSES[k].holes.length} trous · par ${parOf(k)}</small></button>`;
  return `<div class="home" data-state="title">
    <div class="home-scrim"></div>
    <header class="home-title">
      <h1 class="logo">Birdie <span>Party</span></h1>
      <p class="tagline">Du golf en 3D entre potes · 30 trous · jusqu'à 6 joueurs</p>
    </header>
    <button class="press" id="homeStart"><span class="k-desk">Clique ou appuie sur <kbd>Entrée</kbd> pour jouer</span><span class="k-touch">Touche l'écran pour jouer</span></button>
    <section class="setup" aria-label="Nouvelle partie">
      <div class="setup-head"><div class="logo sm">Birdie <span>Party</span></div></div>
      <h2 class="sect">Parcours</h2>
      <div class="courses">${['campagne', 'mer', 'montagne', 'desert'].map(card).join('')}</div>
      <div class="combos">${combo('aller', 'Aller')}${combo('retour', 'Retour')}${combo('complet', 'Grand tour')}${combo('tour', 'Les quatre')}</div>
      <h2 class="sect">Partie</h2>
      <div class="opts">
        ${seg('teams', 'Équipes', [['solo', 'Chacun pour soi'], ['2v2', '2 contre 2'], ['3v3', '3 contre 3']])}
        ${seg('bots', 'Bots', [[0, 'Aucun'], [1, '1'], [2, '2'], [3, '3']])}
        ${seg('level', 'Niveau des bots', [['facile', 'Facile'], ['normal', 'Moyen'], ['expert', 'Difficile']])}
        ${seg('wind', 'Vent', [['calme', 'Calme'], ['normal', 'Normal'], ['fort', 'Fort']])}
        ${seg('time', 'Moment', [['jour', 'Jour'], ['crepuscule', 'Crépuscule'], ['soir', 'Soir']])}
      </div>
      <button class="btn primary big" id="btnPlay">Jouer <kbd>Entrée</kbd></button>
      <ul class="keys">
        <li><b>Frapper</b> clic maintenu, tirer vers le bas, relâcher (ou <kbd>Espace</kbd>)</li>
        <li><b>Viser</b> <kbd>←</kbd> <kbd>→</kbd> · <b>Club</b> <kbd>↑</kbd> <kbd>↓</kbd> · <b>Vue d'ensemble</b> <kbd>V</kbd></li>
        <li><b>Carte</b> molette ou <kbd>Z</kbd> pour zoomer · <kbd>R</kbd> relief</li>
      </ul>
      <button class="btn ghost" id="homeBack">${icon('back')}Écran titre</button>
    </section>
    <p class="now" id="homeNow" aria-live="polite"></p>
    <div class="home-tools"><button class="ico" id="homeMusic" aria-pressed="${musicOn}" aria-label="Musique" title="Musique (M)">${icon('music')}</button></div>
    <p class="credit">Musique : « Sunny Side Up », Alex McCulloch (CC0)</p>
  </div>`;
}

// scene, sfx : moteurs du jeu ; hole(n) : trou n construit ; onPlay(réglages)
export function createHome({ root, scene, sfx, hole: holeOf, onPlay }) {
  const set = loadSetup();
  let musicOn = true;
  try { musicOn = localStorage.getItem('golf_music') !== '0'; } catch (e) {}
  root.innerHTML = html(set, musicOn);
  const el = root.querySelector('.home'), $ = (s) => el.querySelector(s), $$ = (s) => [...el.querySelectorAll(s)];
  let state = 'title', alive = true, cur = null, loading = false, pending = null, t = 0, list = SHOWCASE, idx = 0, path = null;

  // ---------------------------------------------------------------- survol
  // trajectoire : on file au-dessus de l'axe du trou, en décrivant une large courbe, du départ jusqu'au green
  function makePath(h) {
    const pts = h.center, segs = []; let tot = 0;
    for (let i = 0; i < pts.length - 1; i++) { const L = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); segs.push(L); tot += L; }
    const at = (f) => {
      let d = clamp(f, 0, 1) * tot;
      for (let i = 0; i < segs.length; i++) {
        if (d <= segs[i] || i === segs.length - 1) { const k = clamp(d / segs[i], 0, 1); return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * k, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * k, dx: (pts[i + 1][0] - pts[i][0]) / segs[i], dz: (pts[i + 1][1] - pts[i][1]) / segs[i] }; }
        d -= segs[i];
      }
      return { x: pts[0][0], z: pts[0][1], dx: 0, dz: 1 };
    };
    const side = h.n % 2 ? 1 : -1;
    // vitesse constante, du premier au dernier instant : la caméra ne ralentit jamais avant le fondu vers le trou suivant
    return (u, snap) => {
      const e = u, p = at(-0.1 + e * 0.8), l = at(0.32 + e * 0.68);
      const off = Math.sin(u * Math.PI) * 24 * side, y = h.heightAt(p.x, p.z) + 24 - e * 8;
      const pos = new THREE.Vector3(p.x - p.dz * off, y, p.z + p.dx * off);
      scene.camTo(pos, new THREE.Vector3(l.x, h.heightAt(l.x, l.z) + 4, l.z), snap ? 1 : 2.2, snap);
    };
  }
  function caption(h) { $('#homeNow').innerHTML = `<b>Trou ${h.n}</b> ${esc(h.name)} <span>${THEMES[h.theme]} · par ${h.par} · ${h.length} m</span>`; }
  async function fly(n) {
    if (loading) { pending = n; return; }
    loading = true;
    try {
      const h = holeOf(n);
      await scene.loadHole(h, { theme: h.theme, wind: CALM, time: set.time, swap: () => scene.dissolve(0.9) });
      if (!alive) return;
      scene.setWind(CALM);
      scene.showBall(false); scene.setTee(null, false); scene.setMarker(null, false); scene.setAimDots(null, null, false); scene.showGrid(false);
      sfx.ambience(h.theme);
      cur = h; t = 0; path = makePath(h); path(0, true);
      caption(h);
    } catch (e) {
      console.warn('Erreur survol trou accueil', n, e);
      if (window.DDLogger) window.DDLogger.logCrash('CRASH_JS_ERROR', 'Erreur survol trou ' + n + ' (accueil) : ' + (e && e.message ? e.message : e), { stack: e && e.stack, game: 'golf' });
    } finally {
      loading = false;
      const p = pending; pending = null;
      if (p != null && p !== n) fly(p);
    }
  }
  function playlist(next) {
    list = next; idx = 0;
    if (!cur || !list.includes(cur.n)) fly(list[0]);
    else idx = list.indexOf(cur.n);
  }

  // ---------------------------------------------------------------- réglages
  function pick(k, v) {
    set[k] = isNaN(+v) ? v : +v; saveSetup(set);
    if (k === 'course') {
      for (const b of $$('.course,.combo')) b.setAttribute('aria-pressed', String(b.dataset.v === v));
      playlist(COURSES[v].holes);
    } else for (const b of $$(`[data-k="${k}"] button`)) b.setAttribute('aria-checked', String(b.dataset.v === String(v)));
    // en équipes, les bots complètent les équipes tout seuls
    const teams = set.teams && set.teams !== 'solo';
    $('[data-k="bots"]').classList.toggle('off', teams);
    for (const b of $$('[data-k="bots"] button')) b.disabled = teams;
    $('[data-k="level"]').classList.toggle('off', !set.bots && !teams);
    for (const b of $$('[data-k="level"] button')) b.disabled = !set.bots && !teams;
    // le survol passe au moment de la journée choisi
    if (k === 'time' && cur) fly(cur.n);
  }
  function toSetup() {
    if (state === 'setup') return;
    state = 'setup'; el.dataset.state = 'setup';
    sfx.unlock(); sfx.ui('open');
    if (musicOn) sfx.music('menu');
    playlist(COURSES[set.course].holes);
    setTimeout(() => $(`.course[aria-pressed="true"],.combo[aria-pressed="true"]`)?.focus({ preventScroll: true }), 50);
  }
  function toTitle() { state = 'title'; el.dataset.state = 'title'; sfx.ui('close'); playlist(SHOWCASE); }
  function play() { sfx.unlock(); sfx.ui('confirm'); sfx.music(null); onPlay({ ...set }); }
  function toggleMusic() {
    musicOn = !musicOn;
    try { localStorage.setItem('golf_music', musicOn ? '1' : '0'); } catch (e) {}
    $('#homeMusic').setAttribute('aria-pressed', String(musicOn));
    sfx.unlock(); sfx.music(musicOn ? 'menu' : null);
  }

  $('#homeStart').addEventListener('click', toSetup);
  el.addEventListener('pointerdown', (e) => { if (state === 'title' && !e.target.closest('.home-tools')) toSetup(); });
  for (const b of $$('.course,.combo')) b.addEventListener('click', () => { sfx.ui('select'); pick('course', b.dataset.v); });
  for (const g of $$('.seg')) for (const b of g.querySelectorAll('button')) b.addEventListener('click', () => { sfx.ui('click'); pick(g.dataset.k, b.dataset.v); });
  $('#btnPlay').addEventListener('click', play);
  $('#homeBack').addEventListener('click', toTitle);
  $('#homeMusic').addEventListener('click', (e) => { e.stopPropagation(); toggleMusic(); });
  const onKey = (e) => {
    if (e.code === 'KeyM') return toggleMusic();
    if (state === 'title') { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); toSetup(); } return; }
    if (e.code === 'Escape') return toTitle();
    if (e.code === 'Enter' && !e.target.closest?.('.seg,.course,.combo')) { e.preventDefault(); return play(); }
    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      if (e.target.closest?.('.seg')) return;
      e.preventDefault();
      const i = (ORDER.indexOf(set.course) + (e.code === 'ArrowRight' ? 1 : ORDER.length - 1)) % ORDER.length;
      sfx.ui('select'); pick('course', ORDER[i]); $(`[data-v="${ORDER[i]}"].course,[data-v="${ORDER[i]}"].combo`)?.focus({ preventScroll: true });
    }
  };
  addEventListener('keydown', onKey);
  pick('bots', set.bots);
  if (musicOn) sfx.music('menu'); // démarre au premier geste (contexte audio)
  fly(list[0]);

  return {
    update(dt) {
      if (!cur || !alive) return;
      t += dt;
      // le trou suivant est lancé avant la fin du survol (sa construction prend quelques secondes) ; d'ici là la
      // caméra continue d'avancer, sans jamais s'arrêter
      path(Math.min(1.3, t / FLY), false);
      if (t > FLY - 3 && !loading) { idx = (idx + 1) % list.length; fly(list[idx]); }
    },
    dispose() { alive = false; removeEventListener('keydown', onKey); root.innerHTML = ''; },
  };
}
