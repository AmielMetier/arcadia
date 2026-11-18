// odyssee/js/tour-combat.js — l'après-Ligue côté jeu :
//   - les revanches des Champions, du Conseil 4 et de la Maître (une par jour, équipes au niveau 70 à 86) ;
//   - la Tour de Combat (hall de la Ligue) : séries de 7 combats contre des équipes tirées au hasard, Pokémon soignés entre
//     chaque combat ; chaque série gagnée rapporte des Points Combat (PCo), échangés contre des objets rares.
import { SPECIES } from './data/species.js';
import { LEGENDAIRES } from './data/rencontres.js';
import { ITEMS, itemName } from './core/items.js';
import { healFull } from './core/mon.js';

const JOUR = 20 * 3600e3;
const tour = (st) => (st.tour ||= { serie: 0, record: 0, pco: 0, revanches: {} });

/* ================= revanches des Champions et de la Ligue ================= */
const estBoss = (d) => d.leader != null || d.champion || d.trainer?.cls === 'Conseil 4';
/** un Champion, un membre du Conseil 4 ou la Maître déjà battu, une fois Maître de la Ligue : une revanche par jour */
export function revancheBossPossible(game, n) {
  const d = n.def, st = game.state;
  if (!d.trainer || !estBoss(d) || !st.flags.champion || !st.flags['T:' + n.id]) return false;
  const t = tour(st).revanches[n.id];
  return t == null || Date.now() - t >= JOUR;
}
export async function revancheBoss(game, n) {
  const d = n.def, tr = d.trainer, st = game.state, ui = game.ui;
  const who = { speaker: tr.cls ? `${tr.cls} ${tr.name}` : tr.name, face: tr.bs || tr.ow || n.sprite };
  if (!(await ui.yesNo(['Le nouveau Maître de la Ligue en personne !', 'Mon équipe s\'est entraînée sans relâche depuis notre combat. Une revanche, à pleine puissance ?'], who))) { await ui.say('Quand tu veux. Je serai prêt.', who); return; }
  // à pleine puissance : niveaux 70 à 86, attaques choisies, IA forte (trainerBattle : d.boss)
  const team = tr.team.map((e) => { const [sp, lvl, item, moves, ab] = Array.isArray(e) ? e : [e.sp, e.lvl, e.item, e.moves, e.ability];
    return [sp, Math.min(100, Math.max(lvl + 5, 70 + Math.round(lvl / 8))), item, null, ab]; });
  const id = n.id + ':revanche';
  const fake = { ...n, id, def: { ...d, id, leader: undefined, champion: undefined, boss: true, onWin: undefined, winScript: undefined, beatenPos: undefined, vanish: undefined,
    trainer: { ...tr, team, ai: 'smart', prize: (tr.prize || 100) * 2, megaSp: tr.megaSp || 'auto', intro: ['Cette fois, je ne retiens rien !'] } } };
  tour(st).revanches[n.id] = Date.now();
  const res = await game.trainerBattle(fake, false);
  delete st.flags['T:' + id];
  if (res === 'win') {
    await ui.say(['Tu restes le Maître. Ça ne fait aucun doute.', 'Prends ça : tu l\'as bien mérité.'], who);
    await game.api().give(['rare-candy', 'full-restore', 'ultra-ball'][Math.floor(Math.random() * 3)], 1);
  }
}

/* ================= Tour de Combat ================= */
const CLASSES = [['Topdresseur', 'topdresseur'], ['Topdresseuse', 'topdresseuse'], ['Karatéka', 'karateka'], ['Médium', 'medium'], ['Montagnard', 'montagnard'], ['Scientifique', 'scientifique'], ['Dresseur Dragon', 'topdresseur'], ['Ninja', 'gamin']];
const NOMS_F = ['Alix', 'Céleste', 'Élise', 'Gaëlle', 'Inès', 'Kenza', 'Maëlys', 'Olympe', 'Romane', 'Sacha', 'Théa', 'Wendy', 'Zoé'];
const NOMS_M = ['Basile', 'Dorian', 'Fabien', 'Hugo', 'Jules', 'Lucien', 'Noé', 'Pablo', 'Sacha', 'Ugo', 'Valère', 'Yanis', 'Alix'];
const OBJETS = ['leftovers', 'life-orb', 'choice-band', 'choice-specs', 'choice-scarf', 'focus-sash', 'assault-vest', 'expert-belt', 'sitrus-berry', 'lum-berry', 'rocky-helmet', 'white-herb', 'quick-claw', 'scope-lens'];
/** les Pokémon de la Tour : formes finales (ou sans évolution), sans légendaires, assez costauds */
let POOL = null;
function pool() {
  if (POOL) return POOL;
  const LEG = new Set(LEGENDAIRES);
  POOL = Object.entries(SPECIES).map(([id, S]) => [+id, S]).filter(([id, S]) => id < 10000 && !(id > 721 && id < 1001) && !LEG.has(id) && !S.legend && !(S.ev || []).length && S.b.reduce((a, b) => a + b, 0) >= 420).map(([id]) => id);
  return POOL;
}
function poolNiv(lvl) {
  const LEG = new Set(LEGENDAIRES);
  const maxBst = lvl < 20 ? 370 : lvl < 36 ? 485 : 640;
  const minBst = lvl < 20 ? 220 : lvl < 36 ? 310 : 400;
  const list = Object.entries(SPECIES).map(([id, S]) => [+id, S]).filter(([id, S]) => {
    if (id >= 10000 || (id > 721 && id < 1001) || LEG.has(id) || S.legend) return false;
    const bst = S.b.reduce((a, b) => a + b, 0);
    return bst >= minBst && bst <= maxBst && (lvl >= 36 ? !(S.ev || []).length : true);
  }).map(([id]) => id);
  return list.length ? list : pool();
}
/** l'équipe du n-ième adversaire d'une série (3, 4 ou 6 Pokémon selon le format) */
function adversaire(n, niveau, r, count = 3, customPool = null) {
  const P = customPool || pool(), team = [];
  let guard = 0;
  while (team.length < count && guard++ < 200) {
    const sp = P[Math.floor(r() * P.length)];
    if (!team.some((e) => e[0] === sp)) team.push([sp, niveau, niveau >= 35 ? OBJETS[Math.floor(r() * OBJETS.length)] : null]);
  }
  const [cls, ow] = CLASSES[Math.floor(r() * CLASSES.length)];
  const noms = /euse$|Médium/.test(cls) ? NOMS_F : NOMS_M;
  return { cls, name: noms[Math.floor(r() * noms.length)], team, ow, ai: n >= 3 ? 'smart' : 'normal', prize: 0, items: n >= 5 ? { 'hyper-potion': 1 } : {} };
}
/** la boutique des Points Combat : [objet, prix en PCo] */
const BOUTIQUE = [['rare-candy', 3], ['pp-up', 3], ['max-revive', 2], ['full-restore', 2], ['leftovers', 8], ['life-orb', 8], ['choice-band', 8], ['choice-specs', 8], ['choice-scarf', 8],
  ['assault-vest', 8], ['focus-sash', 6], ['expert-belt', 6], ['rocky-helmet', 6], ['eviolite', 6], ['master-ball', 30]].filter(([k]) => ITEMS[k]);

export async function tourCombat(game, n) {
  const st = game.state, ui = game.ui, T = tour(st), who = { speaker: 'Maître de la Tour', face: n.sprite };
  if (!st.flags.champion) { await ui.say(['Ici se tiendra la Tour de Combat.', 'Elle n\'accueille que les Maîtres de la Ligue. Reviens quand tu auras battu Célestine.'], who); return; }
  await ui.say([`Bienvenue à la Tour de Combat, ${st.name} !`, `Tu as ${T.pco} Point${T.pco > 1 ? 's' : ''} Combat. Ta meilleure série : ${T.record} victoire${T.record > 1 ? 's' : ''}.`], who);
  const c = await ui.ask('Que veux-tu faire ?', ['Relever le défi', 'Échanger des PCo', 'Les règles', 'Rien'], who);
  if (c === 2) { await ui.say(['Sept combats d\'affilée contre des dresseurs tirés au sort, en Solo (1v1 · 3 Pokémon), Duo (2v2 · 4 Pokémon) ou Trio (3v3 · 6 Pokémon).', 'Tes Pokémon sont soignés entre chaque combat. Une défaite, et la série s\'arrête.', 'Chaque série gagnée rapporte des Points Combat, d\'autant plus que ta série dure.', 'Tu ne perds ni argent ni rien d\'autre en cas de défaite.'], who); return; }
  if (c === 1) { await boutique(game, who); return; }
  if (c !== 0) return;
  const fmt = await ui.ask('Quel format de combat ?', ['Solo (1v1)', 'Duo (2v2)', 'Trio (3v3)', 'Annuler'], who);
  if (fmt < 0 || fmt > 2) return;
  const format = ['single', 'double', 'triple'][fmt];
  const minParty = fmt === 1 ? 2 : 3;
  const teamSize = fmt === 2 ? 6 : fmt === 1 ? 4 : 3;
  if (st.party.length < minParty) { await ui.say(`Il te faut au moins ${minParty} Pokémon dans ton équipe pour ce format.`, who); return; }
  // niveau des adversaires : celui du meilleur Pokémon de l'équipe, au moins 50
  const niveau = Math.max(50, ...st.party.map((m) => m.lvl));
  let graine = (Date.now() ^ (T.serie * 7919) ^ (fmt * 131)) >>> 0; const r = () => { graine = (graine * 1103515245 + 12345) >>> 0; return (graine >>> 8) / 16777216; };
  for (let k = 0; k < 7; k++) {
    for (const m of st.party) healFull(m);
    const adv = adversaire(k, niveau, r, teamSize);
    const fmtLabel = fmt === 2 ? 'Trio 3v3' : fmt === 1 ? 'Duo 2v2' : 'Solo 1v1';
    await ui.say(`Combat ${k + 1} sur 7 (${fmtLabel}). Série en cours : ${T.serie} victoire${T.serie > 1 ? 's' : ''}.`, who);
    const fake = { id: 'tour:' + k, x: n.x, y: n.y, dir: n.dir, sprite: adv.ow, def: { id: 'tour:' + k, boss: true, sprite: adv.ow, noWhiteout: true, format,
      trainer: { cls: adv.cls, name: adv.name, team: adv.team, ai: adv.ai, prize: 0, items: adv.items, format, intro: k === 6 ? 'Le dernier combat de la série. Donne tout !' : 'En garde !', lose: 'Bien joué…' } } };
    const res = await game.trainerBattle(fake, false);
    delete st.flags['T:tour:' + k];
    if (res !== 'win') {
      for (const m of st.party) healFull(m);
      await ui.say([`La série s'arrête à ${T.serie} victoire${T.serie > 1 ? 's' : ''}.`, 'Reviens quand tu veux tenter ta chance à nouveau !'], who);
      T.serie = 0; game.save(true); return;
    }
    T.serie++; T.record = Math.max(T.record, T.serie); game.save(true);
    if (k < 6 && !(await ui.yesNo('Continuer la série ?'))) {
      await ui.say('La série est mise en pause. Elle reprendra au prochain combat.', who); for (const m of st.party) healFull(m); return;
    }
  }
  for (const m of st.party) healFull(m);
  const gain = (3 + Math.min(7, Math.floor(T.serie / 7) - 1)) + (fmt > 0 ? 1 : 0);
  T.pco += gain; game.save(true);
  await ui.say([`Sept victoires de suite ! Ta série en est à ${T.serie}.`, `Tu gagnes ${gain} Points Combat.`], who);
}

/** Coach Duo / Trio disponible dès les Centres Pokémon pour pratiquer le 2v2 et le 3v3 à tout moment */
export async function clubCombat(game, n) {
  const st = game.state, ui = game.ui, who = { speaker: 'Coach Tactique', face: n.sprite };
  await ui.say(['Bienvenue au Club Tactique Duo & Trio !', 'Ici, tu peux t\'entraîner en combat Duo (2v2) ou Trio (3v3) face à des équipes adaptées à ton niveau, sans risque.'], who);
  const choice = await ui.ask('Quel entraînement ou événement veux-tu lancer ?', ['Duo (2v2)', 'Trio (3v3)', 'Solo (1v1)', 'Tournoi en direct (4p)', 'Multi 2v2 (4 joueurs)', 'Règles Duo/Trio', 'Plus tard'], who);
  if (choice === 3) { const m = await import('./multi-events.js'); return m.lancerTournoiSalon(game); }
  if (choice === 4) { const m = await import('./multi-events.js'); return m.lancerMulti4p(game); }
  if (choice === 5) {
    await ui.say([
      'En Duo (2v2), deux Pokémon combattent côte à côte : attention aux capacités de zone comme Séisme ou Surf qui peuvent toucher ton allié !',
      'En Trio (3v3), trois Pokémon entrent en scène. Les attaques de mêlée ne visent que les adversaires en face ou voisins ; les capacités spéciales, de type Vol ou les rayons atteignent tout le terrain.',
      'Tu peux revenir sur le choix du Pokémon précédent avec Retour pendant la phase d\'ordres !'
    ], who);
    return;
  }
  if (choice < 0 || choice > 2) return;
  const format = choice === 0 ? 'double' : choice === 1 ? 'triple' : 'single';
  const minParty = choice === 0 ? 2 : choice === 1 ? 3 : 1;
  const aliveCount = st.party.filter((m) => m && m.hp > 0).length;
  if (aliveCount < minParty) {
    await ui.say(`Il te faut au moins ${minParty} Pokémon en forme dans ton équipe pour un combat en ${choice === 0 ? 'Duo (2v2)' : 'Trio (3v3)'}.`, who);
    return;
  }
  const avgLvl = Math.max(8, Math.round(st.party.reduce((s, m) => s + (m.lvl || 5), 0) / st.party.length));
  const teamSize = choice === 0 ? 4 : choice === 1 ? 6 : 3;
  let graine = (Date.now() ^ (avgLvl * 997)) >>> 0;
  const r = () => { graine = (graine * 1103515245 + 12345) >>> 0; return (graine >>> 8) / 16777216; };
  const adv = adversaire(avgLvl >= 35 ? 3 : 1, avgLvl, r, teamSize, poolNiv(avgLvl));
  for (const m of st.party) healFull(m);
  const fake = {
    id: 'club:' + format, x: n.x, y: n.y, dir: n.dir, sprite: adv.ow,
    def: {
      id: 'club:' + format, sprite: adv.ow, noWhiteout: true, format,
      trainer: {
        cls: adv.cls, name: adv.name, team: adv.team, ai: 'smart', prize: 0, items: {}, friendly: true, format,
        intro: choice === 1 ? 'Trois contre trois ! Coordonne bien tes attaques et la portée de ton équipe !' : choice === 0 ? 'Combat Duo ! Montre-moi ta synergie !' : 'Un duel classique pour affûter tes réflexes !',
        lose: 'Superbe maîtrise tactique !'
      }
    }
  };
  const res = await game.trainerBattle(fake, false);
  delete st.flags['T:club:' + format];
  for (const m of st.party) healFull(m);
  if (res === 'win') await ui.say('Bien joué ! Reviens quand tu veux pour perfectionner tes stratégies Duo et Trio.', who);
  else await ui.say('Beau match d\'entraînement ! J\'ai soigné ton équipe, tu peux réessayer dès que tu veux.', who);
}
async function boutique(game, who) {
  const st = game.state, ui = game.ui, T = tour(st);
  for (;;) {
    const i = await ui.list({ title: `Échanger des PCo (tu en as ${T.pco})`, items: BOUTIQUE.map(([k, p]) => ({ label: itemName(k), right: `${p} PCo` })).concat([{ label: 'Quitter' }]), cancel: BOUTIQUE.length });
    if (i < 0 || i >= BOUTIQUE.length) return;
    const [k, p] = BOUTIQUE[i];
    if (T.pco < p) { await ui.say('Tu n\'as pas assez de Points Combat.', who); continue; }
    if (!(await ui.yesNo(`Échanger ${p} PCo contre ${itemName(k)} ?`))) continue;
    T.pco -= p; game.give(k, 1); game.sound.sfx('item'); game.save(true);
    await ui.say(`Tu obtiens ${itemName(k)} !`);
  }
}
