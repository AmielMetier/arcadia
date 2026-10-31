// pokemon/engine/timing.js
// Rythme d'un tour de combat, partagé par l'hôte et l'affichage.
// Chaque événement (envoi, attaque, dégâts, K.O.…) a une durée calculée ici : l'écran déroule ses
// animations dans ce temps, et l'hôte attend la somme avant d'ouvrir le tour suivant.
// Le texte s'écrit lettre par lettre (TYPE_MS par lettre), puis reste lisible READ_MS.

export const TYPE_MS = 24;
export const READ_MS = 650;

export const STEP = {
  recall: 450,   // le Pokémon rentre dans sa Poké Ball
  ball: 1150,    // lancer de la Poké Ball et apparition
  lunge: 350,    // élan de l'attaquant
  fx: 700,       // projectile / impact de l'attaque
  hit: 450,      // clignotement de la cible touchée
  faint: 800,    // le Pokémon K.O. s'enfonce
  stat: 1300,    // flèches de hausse / baisse de stat (dans la silhouette du Pokémon)
  item: 700,     // icône de l'objet tenu qui surgit
  status: 750,   // effet de statut (brûlure, poison…)
  heal: 650,     // étincelles de soin
  gap: 150,
};

export const typeMs = (text) => Math.min(1500, String(text || '').length * TYPE_MS);
export const sayMs = (text) => (text ? typeMs(text) + READ_MS : 0);

/** Durée de la descente (ou remontée) d'une barre de PV, selon la part de PV en jeu. */
export function drainMs(amount, maxHp) {
  if (!amount || !maxHp) return 0;
  return Math.round(Math.min(1400, Math.max(450, (Math.abs(amount) / maxHp) * 1600)));
}

/** Texte affiché après un coup (efficacité, critique), s'il y en a un. */
export function damageText(ev) {
  if (ev.msg) return ev.msg;
  const parts = [];
  if (ev.mult > 1) parts.push("C'est super efficace !");
  else if (ev.mult > 0 && ev.mult < 1) parts.push("Ce n'est pas très efficace…");
  if (ev.crit) parts.push('Coup critique !');
  return parts.join(' ');
}

export function eventMs(ev) {
  const msg = ev.msg || ev.text || '';
  switch (ev.type) {
    case 'switch': return STEP.recall + Math.max(typeMs(msg), STEP.ball) + READ_MS;
    case 'attack_start': return typeMs(msg) + STEP.lunge + STEP.fx + STEP.gap;
    case 'damage': return (ev.damage > 0 ? STEP.hit + drainMs(ev.damage, ev.defMaxHp) : 0) + sayMs(damageText(ev)) + STEP.gap;
    case 'status_damage': return Math.max(typeMs(msg), STEP.status) + drainMs(ev.damage, ev.maxHp) + READ_MS;
    case 'heal': return typeMs(msg) + Math.max(STEP.heal, drainMs(ev.amount, ev.maxHp)) + READ_MS;
    case 'recoil': return typeMs(msg) + STEP.hit + drainMs(ev.damage, ev.maxHp) + READ_MS;
    case 'stat_change': return Math.max(typeMs(msg), STEP.stat) + READ_MS;
    case 'item': return Math.max(typeMs(msg), STEP.item) + READ_MS;
    case 'status_applied': return Math.max(typeMs(msg), STEP.status) + READ_MS;
    case 'faint': return STEP.faint + sayMs(msg);
    case 'victory': return sayMs(msg) + 800;
    default: return sayMs(msg) || 300;
  }
}

export function turnMs(events) {
  return (events || []).reduce((n, ev) => n + eventMs(ev), 0);
}
