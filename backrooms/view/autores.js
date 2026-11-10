// Définition automatique de l'image (qualité « Auto ») : moins de lignes quand l'image peine, plus quand elle est à
// l'aise. Sans DOM ni three : testé par tools/test-backrooms.mjs.
//
// « À l'aise », c'est tenir la cadence de l'écran. Un écran à 60 Hz ne livre jamais une image en moins de 16,7 ms :
// avec l'ancien seuil fixe (15 ms), la définition une fois baissée (un passage chargé, un à-coup au chargement, le
// caméscope levé puis rangé) ne remontait plus de la partie.
export const RES_MIN = 360; // lignes : on ne descend pas plus bas
const SLOW_MS = 24; // au-delà (moins de 42 images par seconde), on baisse tout de suite…
const DOWN = 0.03; // … de 3 % par image
const UP = 0.05; // la remontée : une marche de 5 %…
const UP_EVERY = 1; // … par seconde (le temps que le filtre retaille l'image et que la mesure suive)
const AFTER_DOWN = 4; // après une baisse, on attend avant de retenter plus haut
const PROBE_T = 6; // une marche montée qui fait perdre la cadence dans les 6 s est redescendue…
const BACKOFF = 15; // … et on ne la retente pas avant 15 s, puis 30, 60, 120
const BACKOFF_MAX = 120;

export function autoRes(start = 2880) {
  let lines = start; // ce que la machine tient (borné ensuite par ce que la vue permet : le caméscope, l'écran)
  let avg = 16; // la durée moyenne d'une image (ms)
  let screen = 16.7; // la cadence de l'écran (ms) : la durée des images qui ne sont pas en retard
  let waitT = 0; // pas de remontée avant cette heure
  let upAt = -1e9; // l'heure de la dernière marche montée…
  let upFrom = 0; // … et d'où l'on venait (là, la cadence tenait)
  let backoff = BACKOFF;
  return {
    get lines() {
      return lines;
    },
    get avg() {
      return avg;
    },
    get screen() {
      return screen;
    },
    // ms : la durée de l'image ; time : l'heure (s) ; top : le plus de lignes que la vue permet en ce moment.
    // Rend le nombre de lignes à demander au filtre.
    step(ms, time, top) {
      avg += (ms - avg) * 0.05;
      // la cadence de l'écran : la moyenne des images à l'heure (celles en retard d'un balayage ou plus ne comptent
      // pas). Si plus aucune image n'est à l'heure (la fenêtre est passée sur un écran plus lent), elle remonte
      // doucement jusqu'à les retrouver. Jamais plus lente que 60 Hz.
      if (ms > 3 && ms < screen * 1.3) screen += (Math.min(ms, 17.5) - screen) * 0.02;
      else if (ms >= screen * 1.3) screen = Math.min(17.5, screen + 0.004);
      const cap = Math.max(RES_MIN, top);
      const cur = Math.min(lines, cap);
      const easy = Math.max(15, screen * 1.1); // à l'aise : moins d'une image sur dix en retard
      // une marche montée il y a peu, et la cadence est perdue : c'était la marche de trop (on le sait au bout d'une
      // seconde, ou tout de suite si l'image s'effondre)
      const probing = cur > upFrom && time - upAt < PROBE_T;
      if (probing && avg > easy * 1.03 && (avg > SLOW_MS || time - upAt >= UP_EVERY)) {
        // on revient là où la cadence tenait, et on attend de plus en plus avant de réessayer. La mesure repart de
        // zéro : sinon la moyenne, encore haute, ferait baisser une définition qui tenait
        lines = upFrom;
        waitT = time + backoff;
        backoff = Math.min(BACKOFF_MAX, backoff * 2);
        upAt = -1e9;
        avg = screen;
      } else if (avg > SLOW_MS && cur > RES_MIN) {
        lines = Math.max(RES_MIN, cur - Math.max(8, Math.round(cur * DOWN)));
        waitT = time + AFTER_DOWN;
        upAt = -1e9;
        backoff = BACKOFF;
      } else if (avg < easy && cur < cap && time >= waitT) {
        // (la marche d'avant a tenu : la prochaine qui casse repartira d'une attente courte)
        if (time - upAt < PROBE_T) backoff = BACKOFF;
        upFrom = cur;
        lines = Math.min(cap, cur + Math.max(8, Math.round(cur * UP)));
        upAt = time;
        waitT = time + UP_EVERY;
      }
      return Math.min(lines, cap);
    },
  };
}
