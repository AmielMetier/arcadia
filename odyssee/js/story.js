// odyssee/js/story.js — les scènes de l'histoire : la Team Éclipse, l'Éclipse, Lugia Obscur, les cadeaux et les quêtes.
// Les PNJ et les lieux sont posés par world/story.js ; ici on joue leurs dialogues et leurs combats.
import { T } from './world/tiles.js';
import { createMon, monName, healFull } from './core/mon.js';
import { SPECIES } from './data/species.js';
import { MOVES } from './data/moves.js';
import { itemName } from './core/items.js';
import { partyScreen } from './ui/screens.js';
import { ASSETS, loadImg } from './assets.js';
import { el, wait } from './ui/ui.js';
import { shadowCanvas } from './render/shadow.js';

const say = (g, lines, who) => g.ui.say(lines, who ? { speaker: who } : undefined);
const val = (v, st) => (typeof v === 'function' ? v(st) : v);
const give = (g, item, qty = 1) => { const b = g.state.bag; b[item] = (b[item] || 0) + qty; };
const LUGIA = 249, SHADOW_MOVE = 10001;

/** reçoit un Pokémon (équipe, ou PC si elle est pleine) */
async function receiveMon(g, mon, from) {
  const st = g.state;
  mon.ot = mon.ot || st.name; mon.met = mon.met || g.locationName();
  g.markCaught(mon.sp); g.sound.sfx('caught');
  await g.ui.say(`${st.name} reçoit ${monName(mon)}${from ? ' de la part de ' + from : ''} !`);
  if (st.party.length < 6) st.party.push(mon);
  else { st.box.push(mon); await g.ui.say(`L'équipe est pleine : ${monName(mon)} a été envoyé dans le PC.`); }
}

/* ======================================================================
   Dialogues des PNJ (renvoie true si le script est géré ici)
   ====================================================================== */
export async function storyTalk(g, name, n) {
  const st = g.state, f = st.flags, d = n?.def || {};
  switch (name) {
    case 'gift': {
      const q = d.gift;
      if (f[q.flag]) { await say(g, val(q.done, st), q.who); return true; }
      if (q.need && !q.need(st)) { await say(g, val(q.pre, st), q.who); return true; }
      await say(g, val(q.give, st), q.who);
      give(g, q.item); f[q.flag] = true; g.sound.sfx('item');
      await g.ui.say(`${st.name} reçoit ${itemName(q.item)} !\nVous rangez l'objet dans la poche Rares.`);
      await say(g, val(q.got, st), q.who);
      return true;
    }
    case 'show': {
      const q = d.show;
      if (f[q.flag]) { await say(g, q.done, q.who); return true; }
      await say(g, q.ask, q.who);
      if (!st.party.some(q.test)) return true;
      const i = await partyScreen(g, { mode: 'pick', prompt: 'Quel Pokémon montrer ?', filter: (m) => (q.test(m) ? null : 'Pas celui-là') });
      if (i < 0) return true;
      await say(g, q.thanks, q.who);
      for (const [it, k] of q.reward) { give(g, it, k); g.sound.sfx('item'); await g.ui.say(`${st.name} reçoit ${k > 1 ? k + ' × ' : ''}${itemName(it)} !`); }
      f[q.flag] = true;
      return true;
    }
    case 'deliver': {
      const q = d.deliver;
      if (f[q.flag]) { await say(g, q.done, q.who); return true; }
      if (!st.bag[q.item]) { await say(g, q.ask, q.who); return true; }
      await g.ui.say(`${st.name} rend le ${itemName(q.item)}.`);
      g.take(q.item); f[q.flag] = true;
      await say(g, q.thanks, q.who);
      for (const [it, k] of q.reward) { give(g, it, k); g.sound.sfx('item'); await g.ui.say(`${st.name} reçoit ${k > 1 ? k + ' × ' : ''}${itemName(it)} !`); }
      return true;
    }
    case 'trade': {
      const q = d.trade, want = SPECIES[q.want].n, got = SPECIES[q.give].n;
      if (f[q.flag]) { await say(g, q.done, q.who); return true; }
      await say(g, q.ask, q.who);
      if (!st.party.some((m) => m.sp === q.want)) { await say(g, `Reviens quand tu auras un ${want} dans ton équipe !`, q.who); return true; }
      if (!(await g.ui.yesNo(`Échanger un ${want} contre ${q.nick} (${got}) ?`))) return true;
      const i = await partyScreen(g, { mode: 'pick', prompt: `Quel ${want} échanger ?`, filter: (m) => (m.sp === q.want ? null : 'Pas celui-là') });
      if (i < 0) return true;
      if (st.party.length === 1) { await say(g, 'Tu ne peux pas te séparer de ton dernier Pokémon !', q.who); return true; }
      const [old] = st.party.splice(i, 1);
      const mon = createMon(q.give, q.lvl, { ot: q.who, met: g.locationName(), iv: Array(6).fill(24) }); mon.nick = q.nick;
      st.party.splice(i, 0, mon); g.markCaught(q.give); f[q.flag] = true;
      g.sound.sfx('caught');
      await g.ui.say(`${st.name} échange ${monName(old)} contre ${q.nick} !`);
      await say(g, q.thanks, q.who);
      return true;
    }
    case 'giftmon': {
      const q = d.giftmon;
      if (f[q.flag]) { await say(g, q.done, q.who); return true; }
      if (q.need && !q.need(st)) { await say(g, q.pre, q.who); return true; }
      await say(g, q.ask, q.who);
      if (!(await g.ui.yesNo(`Accepter ${SPECIES[q.sp].n} ?`))) { await say(g, 'Oh... Reviens si tu changes d\'avis.', q.who); return true; }
      f[q.flag] = true;
      await receiveMon(g, createMon(q.sp, q.lvl, { ot: q.who, met: g.locationName(), iv: Array(6).fill(26) }), q.who);
      await say(g, q.got, q.who);
      return true;
    }
    case 'dexq': {
      const q = d.dexq, n0 = st.dex.caught.length;
      const next = q.tiers.find(([k]) => !f['dex' + k]);
      if (!next) { await say(g, ['Ton Pokédex est impressionnant. Tu n\'as plus besoin de moi !', 'Le Prof. Saule doit être fier de toi.'], q.who); return true; }
      const [need, it, k] = next;
      if (n0 < need) { await say(g, [`J'étudie les Pokédex des dresseurs de passage. Le tien compte ${n0} Pokémon capturés.`, `Reviens quand tu en auras ${need} : je te donnerai ${k > 1 ? k + ' × ' : ''}${itemName(it)}.`], q.who); return true; }
      await say(g, [`${n0} Pokémon capturés ! Ça, c'est du beau travail.`, 'Voici ta récompense, comme promis.'], q.who);
      give(g, it, k); f['dex' + need] = true; g.sound.sfx('item');
      await g.ui.say(`${st.name} reçoit ${k > 1 ? k + ' × ' : ''}${itemName(it)} !`);
      return true;
    }
    case 'lumenBois': {
      const who = 'Dr Lumen';
      if (!f['T:ecl:bois1'] || !f['T:ecl:bois2']) { await say(g, ['Au secours ! Ces gens en uniforme sombre veulent mes recherches !', 'Ils se disent de la « Team Éclipse »... Je t\'en prie, chasse-les !'], who); return true; }
      if (!f.giftFlash) {
        await say(g, ['Merci, tu m\'as sauvé la mise ! Je suis le Dr Lumen. J\'étudie les Plumes Argent.', 'Ces plumes, c\'est Lugia, le gardien des marées, qui les laisse derrière lui. Il dort quelque part sous la mer, au sud.', 'La Team Éclipse prépare un « Prisme Noir », un appareil capable de fermer le cœur d\'un Pokémon. Si elle s\'en sert sur Lugia...', 'Ils parlaient aussi de la Grotte Lunaire. Elle est plongée dans le noir : prends ceci, ça t\'aidera.'], who);
        give(g, 'hm05'); f.giftFlash = true; g.sound.sfx('item');
        await g.ui.say(`${st.name} reçoit ${itemName('hm05')} !`);
        await say(g, ['Avec Flash, ton Pokémon éclairera les grottes sombres tout seul.', 'Fais attention à toi. Et si tu croises encore la Team Éclipse... méfie-toi.'], who);
        return true;
      }
      await say(g, ['Les Plumes Argent brillent comme la lune sur la mer...', 'Je vais continuer mes recherches. On se reverra, j\'en suis sûr !'], who);
      return true;
    }
    case 'lumenSanct': return lumenSanct(g, true);
    case 'victoireGate': {
      if (g.badgeCount() < 8) await say(g, 'Halte ! La Route Victoire est réservée aux dresseurs aux huit badges.', 'Garde');
      else await say(g, ['Huit badges... Mais je ne peux pas te laisser passer.', 'Tant que la nuit violette recouvre la région, la Ligue a fermé la Route Victoire.', 'Il paraît que tout vient du Sanctuaire des Marées, sur un îlot au sud du Pont des Marées.'], 'Garde');
      return true;
    }
  }
  return false;
}

/** zones déclencheuses propres à l'histoire */
export async function storyTrigger(g, name) {
  if (name === 'lumenSanct') return lumenSanct(g, false);
  return false;
}

async function lumenSanct(g, talked) {
  const st = g.state, f = st.flags, who = 'Dr Lumen';
  if (f.giftMaster) { if (talked) await say(g, f.lugia ? ['Lugia est apaisé... Tu as rendu le jour à la région. Merci.'] : ['Lugia dort au fond du Sanctuaire. Bonne chance !'], who); return talked; }
  g.busy = true;
  const n = g.npcs.find((q) => q.id === 'lumen-sanct'); if (n) n.dir = 'left';
  await say(g, [`${st.name} ! Toi aussi, tu as trouvé le chemin du Sanctuaire !`, 'La Team Éclipse est au fond, près de l\'autel. Le Prisme Noir a fermé le cœur de Lugia : c\'est devenu un Pokémon Obscur.', 'Si Lugia se réveille, il faudra le calmer. Le capturer, c\'est la seule façon de le libérer du Prisme.', 'Prends cette Master Ball. Elle capture n\'importe quel Pokémon, à coup sûr. Ne la gaspille pas !'], who);
  give(g, 'master-ball'); f.giftMaster = true; g.sound.sfx('item');
  await g.ui.say(`${st.name} reçoit une ${itemName('master-ball')} !`);
  g.busy = false;
  return true;
}

/* ======================================================================
   Après un combat gagné (dresseur avec winScript)
   ====================================================================== */
export async function storyWin(g, name) {
  const st = g.state, ui = g.ui;
  if (name === 'boss1') {
    await say(g, ['Le Prisme Noir est en route pour le Sanctuaire des Marées. Lugia y dort.', 'Quand son cœur sera fermé, il m\'obéira. Et la nuit ne finira plus jamais.', 'Regarde... Ça commence déjà.'], 'Nocturne');
    st.flags.eclipse = true;
    g.sound.sfx('encounter'); await ui.flash(2, '#40206a', 160);
    g.view.eclipse = true; g.view.setTimeOfDay(g.hour());
    await ui.say(['Un grondement sourd fait trembler le repaire...', 'Dehors, le ciel s\'éteint d\'un coup : une nuit violette recouvre toute la région !']);
    await ui.say(['Les sbires qui gardaient l\'entrée de Mirage ont dû filer.', 'Il faut trouver où se cache ce Sanctuaire des Marées.']);
    return;
  }
  if (name === 'boss2') {
    await say(g, ['Non... Le Prisme... Il se fissure !', 'Lugia ! Réveille-toi ! Obéis-moi !'], 'Nocturne');
    await lugiaWakes(g);
  }
}

/* ======================================================================
   Lugia Obscur
   ====================================================================== */
export function shadowLugia() {
  const m = createMon(LUGIA, 50, { moves: [SHADOW_MOVE, 56, 94, 105], iv: Array(6).fill(28), met: 'Sanctuaire des Marées' });
  m.shadow = true;
  return m;
}

async function lugiaWakes(g) {
  const st = g.state, ui = g.ui;
  g.view.shake = 0.5; g.sound.sfx('encounter');
  await ui.flash(3, '#6020a0', 120);
  g.sound.cry(ASSETS.cry(LUGIA));
  await ui.say(['Un cri immense résonne dans tout le Sanctuaire !', 'Les eaux de l\'autel bouillonnent... Lugia Obscur ouvre les yeux !']);
  await lugiaBattle(g);
}

/** combat contre Lugia Obscur (au réveil, ou en lui parlant plus tard s'il n'a pas été capturé) */
export async function lugiaBattle(g) {
  const st = g.state, ui = g.ui;
  if (!g.lead()) return;
  const res = await g.runBattle({ wild: shadowLugia(), music: 'legend' });
  if (res === 'caught') {
    st.flags.lugiaCaught = true;
    g.setTile(12, 4, T.CAVE); g.view.removeActor('lugia');
    await ui.say(['Le Prisme Noir se brise en mille éclats !', 'Lugia est libéré de son emprise... mais son cœur reste encore fermé. Le Prof. Saule saura peut-être l\'ouvrir.']);
    give(g, 'prism-shard');
  } else if (res === 'win') {
    await ui.say(['Lugia Obscur s\'effondre sur l\'autel... Le Prisme Noir vole en éclats.', 'Épuisé, il replonge dans un profond sommeil. Il est toujours là, sur l\'autel.']);
  } else if (res === 'lose') return;
  else { await ui.say('Lugia Obscur te fixe de ses yeux sombres, toujours sur l\'autel...'); }
  if (!st.flags.lugia && res !== 'run' && res !== 'lose') await endEclipse(g);
}

async function endEclipse(g) {
  const st = g.state, ui = g.ui;
  st.flags.lugia = true;
  await ui.flash(2, '#fff0c0', 160);
  g.view.eclipse = false; g.view.setTimeOfDay(g.hour());
  await ui.say(['Une lueur dorée traverse les fissures de la grotte...', 'La nuit violette se déchire : le jour revient sur toute la région !', 'La Team Éclipse est vaincue. La Route Victoire va rouvrir.']);
  g.refreshNpcs();
  g.save(true);
}

/** sprite de Lugia Obscur posé sur l'autel */
export async function placeLugia(g) {
  if (g.mapObj.id !== 'sanctuaire' || g.state.flags.lugiaCaught) return;
  const img = await loadImg(ASSETS.front(LUGIA));
  if (g.mapObj.id !== 'sanctuaire') return;
  const c = shadowCanvas(img, 80, 80);
  const a = g.view.imageActor('lugia', c, 110, 110);
  a.mesh.position.set(12.5, 0.2, 4.6); a.shadow.position.set(12.5, 0.02, 4.7);
  a.base = 0.2;
}

/** le Prof. Saule ouvre le cœur d'un Pokémon Obscur */
export async function purify(g) {
  const st = g.state, i = st.party.findIndex((m) => m.shadow);
  if (i < 0) return false;
  const m = st.party[i], who = 'Prof. Saule';
  await say(g, [`Ce ${SPECIES[m.sp].n}... Son cœur est fermé. C'est donc ça, un Pokémon Obscur.`, 'Le lien entre un dresseur et son Pokémon peut tout réparer. Laisse-moi t\'aider.'], who);
  if (!(await g.ui.yesNo(`Ouvrir le cœur de ${monName(m)} ?`))) return true;
  g.sound.sfx('evolve'); await g.ui.flash(3, '#ffffff', 120);
  m.shadow = false;
  for (const mv of m.moves) if (mv.id === SHADOW_MOVE) { mv.id = 177; mv.pp = MOVES[177].pp; }
  healFull(m);
  g.sound.cry(ASSETS.cry(m.sp)); g.sound.sfx('levelup');
  await g.ui.say([`Le cœur de ${monName(m)} s'est ouvert !`, `${monName(m)} oublie Rafale Obscure... et apprend Aéroblast !`]);
  await say(g, ['Regarde comme il te regarde, maintenant. Vous êtes faits pour voyager ensemble.'], who);
  return true;
}

/** halo de l'Éclipse et obscurité des grottes : calque HTML au-dessus du rendu */
export function overlay(g) {
  let ov = g._ov;
  if (!ov) { ov = g._ov = el('div', 'dark-ov'); g.ui.root.prepend(ov); }
  const m = g.mapObj, dark = !!m?.dark, flash = !!g.state?.bag?.hm05;
  ov.className = 'dark-ov' + (dark ? (flash ? ' cave flash' : ' cave') : '') + (g.view.eclipse && m?.outdoor ? ' eclipse' : '');
}
export { wait };
