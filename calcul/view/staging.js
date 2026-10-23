// The Candidate : la « mise en scène » (scène d'ouverture, Pierre Chartier qui réagit pendant les questions).
// Réglage propre à chaque joueur, coupé d'office quand le système demande des animations réduites.
import { store, save, prefersReducedMotion } from './util.js';

let on = store('calcul_show', !prefersReducedMotion());

export const staging = {
  get on() { return on; },
  toggle() { on = !on; save('calcul_show', on); return on; },
};
