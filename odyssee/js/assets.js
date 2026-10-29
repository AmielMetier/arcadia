// odyssee/js/assets.js — adresses des images : sprites HeartGold/SoulSilver de PokeAPI, cris de PokeAPI
const params = new URLSearchParams(location.search);
const BASE = params.get('sprites') || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites';
const CRIES = 'https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest';
const ICONS = { medaillon: 'soothe-bell', 'prism-shard': 'shoal-shell' };
const HG = BASE + '/pokemon/versions/generation-iv/heartgold-soulsilver';
export const ASSETS = {
  front: (id, shiny) => `${HG}${shiny ? '/shiny' : ''}/${id}.png`,
  back: (id, shiny) => `${HG}/back${shiny ? '/shiny' : ''}/${id}.png`,
  icon: (id) => `${BASE}/pokemon/versions/generation-vii/icons/${id}.png`,
  item: (k) => `${BASE}/items/${ICONS[k] || k}.png`,
  cry: (id) => (params.has('sprites') ? null : `${CRIES}/${id}.ogg`),
  trainer: (k) => `../pokemon/assets/trainers/${k}.png`,
  chars: '../pokemon/assets/graphics/chars_overworld.png',
};
/** précharge une image (résout même en cas d'échec) */
export function loadImg(src) {
  return new Promise((res) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
}
