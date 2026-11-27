// Appuis : filtre des doubles appuis et jugement par rapport aux temps.
export const GAPS = [0, 80, 120, 160, 200];

// t en ms. Un appui refusé ne déplace pas la référence : seul un appui accepté la remet à jour.
export function filterPress(last, t, gap, repeat) {
  if (repeat) return { ok: false, last };
  if (last != null && t - last < gap) return { ok: false, last };
  return { ok: true, last: t };
}

// beats : [{ t, tol, lure, done }] en secondes. Renvoie le temps le plus proche, l'écart et le verdict :
// 'hit' (dans la fenêtre d'un signal valide), 'lure' (sur un leurre), 'early' / 'late' (hors fenêtre ou temps déjà joué).
export function judge(t, beats) {
  let best = -1, dist = Infinity;
  for (let i = 0; i < beats.length; i++) {
    const d = Math.abs(t - beats[i].t);
    if (d < dist) { dist = d; best = i; }
  }
  if (best < 0) return { i: -1, off: 0, verdict: 'early' };
  const b = beats[best], off = t - b.t;
  if (Math.abs(off) <= b.tol + 1e-9 && !b.done) return { i: best, off, verdict: b.lure ? 'lure' : 'hit' };
  return { i: best, off, verdict: off < 0 ? 'early' : 'late' };
}

// Part de justesse d'un temps : 1 pile dessus, 0 à un quart d'intervalle ou plus, 0 pour un temps manqué.
export const beatScore = (off, interval) => (off == null ? 0 : Math.max(0, 1 - Math.abs(off) / (interval / 4)));

// Décalage médian du calage (en ms), sur au moins 5 frappes ; null sinon.
export function calibrate(offsetsMs) {
  const v = offsetsMs.filter(Number.isFinite);
  if (v.length < 5) return null;
  const s = [...v].sort((a, b) => a - b), m = s.length >> 1;
  const med = s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  return Math.max(-300, Math.min(300, Math.round(med)));
}
