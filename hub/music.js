// Musique lo-fi du Hub (accueil et salon). Même moteur que DavidSimulator (david/view/music.js), avec son propre
// volume : le curseur « Musique » du panneau Réglages (à 0, elle est coupée). Elle s'efface quand un jeu est ouvert :
// chaque jeu a sa musique.
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

function apply() {
  if (!unlocked) return;
  if (screen === 'play') music.stop(); else music.start();
}
DDVolume.panel(document.getElementById('hubSet'), { kinds: ['music'], accent: '#ff4b2b' });
// le navigateur exige un geste de l'utilisateur avant le son
for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, () => { unlocked = true; apply(); }, { once: true, capture: true });
document.addEventListener('hub:screen', (e) => { screen = e.detail; apply(); });
if (new URLSearchParams(location.search).has('debug')) window.__hubMusic = { music, get ctx() { return ctx; }, get screen() { return screen; } };
