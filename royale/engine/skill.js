// Island Rush — niveau des bots « Auto » : il suit les résultats des joueurs. Chaque navigateur garde ses dernières
// parties (place, nombre d'équipes en lice, éliminations) ; on en tire un niveau entre 0 (débute) et 1 (gagne
// souvent), et l'on compose les bots en conséquence : plus de bots faciles pour qui débute, plus de coriaces pour qui
// gagne. Sans historique : des bots normaux. Moteur PUR (testé hors navigateur).

export const HIST_MAX = 10;

// hist : [{ place, n, kills }], la plus récente d'abord → { s (0 à 1), games, place, kills } ; les parties récentes
// comptent plus
export function skillOf(hist) {
  const list = (Array.isArray(hist) ? hist : []).filter((h) => h && h.n > 1 && h.place >= 1).slice(0, 8);
  if (!list.length) return { s: 0.5, games: 0, place: null, kills: null };
  let sum = 0, w = 0, place = 0, kills = 0;
  list.forEach((h, i) => {
    const k = 1 / (1 + i * 0.25);
    const p = 1 - (Math.min(h.place, h.n) - 1) / (h.n - 1);
    sum += k * (0.75 * p + 0.25 * Math.min(1, (h.kills || 0) / 5)); w += k;
    place += h.place; kills += h.kills || 0;
  });
  return { s: sum / w, games: list.length, place: place / list.length, kills: kills / list.length };
}

// part de bots faciles, normaux et coriaces pour un niveau s
export function botMix(s) {
  const tough = Math.max(0, Math.min(0.75, (s - 0.5) * 1.8)), easy = Math.max(0, Math.min(0.75, (0.5 - s) * 1.8));
  return { facile: easy, normal: 1 - easy - tough, difficile: tough };
}

// niveaux de n bots, mélangés (rnd : 0 ≤ x < 1)
export function botLevels(n, s, rnd = Math.random) {
  const mix = botMix(s), out = [];
  const nEasy = Math.round(n * mix.facile), nTough = Math.round(n * mix.difficile);
  for (let i = 0; i < n; i++) out.push(i < nEasy ? 'facile' : i < nEasy + nTough ? 'difficile' : 'normal');
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}
