// Musique lo-fi du Hub (accueil et salon). Même moteur que DavidSimulator (david/view/music.js),
// mêmes réglages (on/off et volume partagés). Elle s'efface quand un jeu est ouvert : chaque jeu a sa musique.
import { createMusic } from '../david/view/music.js';

let ctx = null;
const getCtx = () => {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null; ctx = new AC(); }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};
const music = createMusic(getCtx);
music.setMood('calm');
let screen = 'home', unlocked = false;

const btn = document.getElementById('hubMusic'), vol = document.getElementById('hubVol');
const sync = () => { btn.classList.toggle('off', !music.on); btn.title = music.on ? 'Couper la musique' : 'Mettre la musique'; btn.setAttribute('aria-pressed', String(music.on)); };
function apply() {
  if (!unlocked) return;
  if (screen === 'play' || !music.on) music.stop(); else music.start();
}
btn.onclick = () => { unlocked = true; music.toggle(); apply(); sync(); };
vol.value = music.volume;
vol.oninput = (e) => { unlocked = true; music.setVolume(+e.target.value); if (music.on) apply(); };
// le navigateur exige un geste de l'utilisateur avant le son
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { unlocked = true; apply(); }, { once: true, capture: true });
document.addEventListener('hub:screen', (e) => { screen = e.detail; apply(); });
sync();
if (new URLSearchParams(location.search).has('debug')) window.__hubMusic = { music, get ctx() { return ctx; }, get screen() { return screen; } };
