// Indicateurs d'une partie et courbes du tableau de bord (une valeur par jour joué).
// Indicateurs gardés par partie (champ m) :
//   rt     temps de réponse des bonnes réponses (ms)
//   sw     Aiguillage : bonnes réponses juste après un changement de règle (ms) ; rep : les autres
//   lureN  leurres présentés ; lureOk : leurres laissés passer
//   beatN  temps à frapper ; beatSum : somme des parts de justesse (voir beatScore)
export function median(arr) {
  if (!arr || !arr.length) return null;
  const s = [...arr].sort((a, b) => a - b), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export const emptyMetrics = () => ({ rt: [], sw: [], rep: [], lureN: 0, lureOk: 0, beatN: 0, beatSum: 0 });

// Valeurs d'un groupe de parties (une partie ou une journée) ; null quand rien ne permet de calculer.
export function indicators(games) {
  const all = (k) => games.flatMap((g) => g.m[k]);
  const sum = (k) => games.reduce((a, g) => a + g.m[k], 0);
  const rt = median(all('rt'));
  const sw = median(all('sw')), rep = median(all('rep'));
  const lureN = sum('lureN'), beatN = sum('beatN');
  return {
    rt: rt == null ? null : Math.round(rt),
    lure: lureN ? Math.round(100 * sum('lureOk') / lureN) : null,
    switch: sw == null || rep == null ? null : Math.max(0, Math.round(sw - rep)),
    rhythm: beatN ? Math.round(100 * sum('beatSum') / beatN) : null,
  };
}

export const CURVES = [
  { key: 'rt', title: 'Temps de réaction', unit: 'ms' },
  { key: 'lure', title: 'Leurres évités', unit: '%' },
  { key: 'switch', title: 'Changement de règle', unit: 'ms' },
  { key: 'rhythm', title: 'Précision rythmique', unit: '%' },
];

// Courbe d'un indicateur : [{ day, v }] trié par jour, jours sans valeur exclus.
export function series(history, key) {
  const byDay = new Map();
  for (const g of history) {
    if (!byDay.has(g.day)) byDay.set(g.day, []);
    byDay.get(g.day).push(g);
  }
  return [...byDay.keys()].sort().map((day) => ({ day, v: indicators(byDay.get(day))[key] })).filter((p) => p.v != null);
}
