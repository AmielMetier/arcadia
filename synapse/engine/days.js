// Jours locaux AAAA-MM-JJ et série de jours consécutifs.
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// Jour précédent par le calendrier (pas par 86 400 000 ms, faux aux changements d'heure).
export function prevDay(key) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1));
}

// Série en cours : jours consécutifs joués, en partant d'aujourd'hui ou d'hier.
export function streak(keys, today) {
  const set = new Set(keys);
  let k = set.has(today) ? today : set.has(prevDay(today)) ? prevDay(today) : null;
  let n = 0;
  while (k && set.has(k)) { n++; k = prevDay(k); }
  return n;
}
