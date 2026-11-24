// odyssee/js/game/follower-life.js — Pokémon suiveur vivant, Souvenirs uniques & Auras d'entrée en combat
import { SPECIES } from '../data/species.js';
import { ABILITIES, getAbility } from '../data/abilities.js';
import { ITEMS, formatFindItem } from '../core/items.js';
import { monName } from '../core/mon.js';
import { OPP } from '../world/tiles.js';
import { warnDev } from '../core/safe.js';

const TYPE_FR_LOCAL = { fairy: 'Fée', normal: 'Normal', fighting: 'Combat', flying: 'Vol', poison: 'Poison', ground: 'Sol', rock: 'Roche', bug: 'Insecte', ghost: 'Spectre', steel: 'Acier', fire: 'Feu', water: 'Eau', grass: 'Plante', electric: 'Électrik', psychic: 'Psy', ice: 'Glace', dragon: 'Dragon', dark: 'Ténèbres' };

export const MEMORIES = {
  first_walk: {
    id: 'first_walk',
    icon: '🐾',
    title: 'Premiers Pas Ensemble',
    desc: 'A marché joyeusement à tes côtés sur les routes d\'Odyssée.',
  },
  weather_bond: {
    id: 'weather_bond',
    icon: '🌦️',
    title: 'Sous Tous les Cieux',
    desc: 'A bravé la pluie, le vent, la neige ou les cendres avec toi.',
  },
  music_dance: {
    id: 'music_dance',
    icon: '🎵',
    title: 'Danseur de Rue',
    desc: 'S\'est laissé emporter par la mélodie d\'un musicien itinérant.',
  },
  gift_finder: {
    id: 'gift_finder',
    icon: '🎁',
    title: 'Fin Limier',
    desc: 'A déniché un petit trésor rien que pour toi en chemin.',
  },
  celestial: {
    id: 'celestial',
    icon: '🌠',
    title: 'Témoin des Étoiles',
    desc: 'A contemplé une aurore boréale ou une pluie d\'étoiles filantes.',
  },
  rift: {
    id: 'rift',
    icon: '🌀',
    title: 'Survivant des Failles',
    desc: 'A triomphé d\'une anomalie dans une faille spatio-temporelle.',
  },
  alpha: {
    id: 'alpha',
    icon: '🔥',
    title: 'Cœur de Colosse',
    desc: 'A affronté ou incarné la puissance écrasante d\'un Pokémon Alpha.',
  },
  clutch_1hp: {
    id: 'clutch_1hp',
    icon: '💥',
    title: 'Résistance Héroïque',
    desc: 'A tenu bon au bord du K.O. (≤ 5% PV) avant de renverser le combat.',
  },
  gym_victory: {
    id: 'gym_victory',
    icon: '🏅',
    title: 'Triomphe d\'Arène',
    desc: 'A contribué à conquérir un Badge officiel d\'Odyssée.',
  },
  champion: {
    id: 'champion',
    icon: '👑',
    title: 'Légende du Panthéon',
    desc: 'Est entré dans l\'histoire en conquérant la Ligue Céleste.',
  },
};

export function hasMemory(mon, id) {
  return Array.isArray(mon?.memories) && mon.memories.some((m) => m && m.id === id);
}

export const ENTRANCE_AURAS = [
  {
    id: 'petals',
    name: 'Tourbillon Serein',
    icon: '🌸',
    reqText: 'Premier pas + météo, danse ou trouvaille',
    colors: ['#ffb0d8', '#98f5c8', '#fff4b8', '#ffffff'],
    count: 24,
    speed: 2.3,
    check: (mon) => (hasMemory(mon, 'first_walk') && hasMemory(mon, 'weather_bond')) || hasMemory(mon, 'gift_finder') || hasMemory(mon, 'music_dance'),
  },
  {
    id: 'stars',
    name: 'Éclat Stellaire',
    icon: '✨',
    reqText: 'Témoin des Étoiles ou 2 souvenirs',
    colors: ['#fff280', '#80e8ff', '#d0a8ff', '#ffffff'],
    count: 26,
    speed: 2.5,
    check: (mon) => hasMemory(mon, 'celestial') || (mon?.memories?.length || 0) >= 2,
  },
  {
    id: 'sparks',
    name: 'Foudre Héroïque',
    icon: '⚡',
    reqText: 'Survie héroïque, Badge d\'Arène ou 4 souvenirs',
    colors: ['#ffe848', '#ff9830', '#70e8ff', '#ffffff'],
    count: 28,
    speed: 2.8,
    check: (mon) => hasMemory(mon, 'clutch_1hp') || hasMemory(mon, 'gym_victory') || (mon?.memories?.length || 0) >= 4,
  },
  {
    id: 'royal',
    name: 'Couronne Céleste',
    icon: '👑',
    reqText: 'Panthéon ou 6 souvenirs uniques',
    colors: ['#ffd700', '#ffea80', '#70b8ff', '#ffffff'],
    count: 32,
    speed: 2.9,
    check: (mon) => hasMemory(mon, 'champion') || (mon?.memories?.length || 0) >= 6,
  },
  {
    id: 'crimson',
    name: 'Flamme Alpha',
    icon: '🔥',
    reqText: 'Pokémon Alpha ou Cœur de Colosse',
    colors: ['#ff3850', '#ff8830', '#ffd060', '#ffffff'],
    count: 30,
    speed: 3.0,
    check: (mon) => !!mon?.alpha || hasMemory(mon, 'alpha'),
  },
];

const AURA_PRIORITY = ['crimson', 'royal', 'sparks', 'stars', 'petals'];

export function unlockedAuras(mon) {
  if (!mon) return [];
  return ENTRANCE_AURAS.filter((a) => a.check(mon));
}

export function activeEntranceAura(mon) {
  if (!mon || mon.entranceAura === 'none') return null;
  const list = unlockedAuras(mon);
  if (!list.length) return null;
  if (mon.entranceAura && mon.entranceAura !== 'auto') {
    const picked = list.find((a) => a.id === mon.entranceAura);
    if (picked) return picked;
  }
  for (const id of AURA_PRIORITY) {
    const found = list.find((a) => a.id === id);
    if (found) return found;
  }
  return list[0];
}

export function auraBurstSpec(mon) {
  const aura = activeEntranceAura(mon);
  if (!aura) return null;
  return {
    id: aura.id,
    name: aura.name,
    colors: aura.colors,
    count: aura.count,
    speed: aura.speed,
  };
}

/** Ajoute un souvenir unique sur un Pokémon ; signale s'il est nouveau et quelles auras viennent d'être débloquées. */
export function addMemory(mon, id, place = '') {
  if (!mon || !MEMORIES[id]) return { added: false, newlyUnlockedAuras: [] };
  const beforeIds = new Set(unlockedAuras(mon).map((a) => a.id));
  mon.memories ||= [];
  if (mon.memories.some((m) => m && m.id === id)) {
    return { added: false, newlyUnlockedAuras: [] };
  }
  mon.memories.push({
    id,
    place: String(place || ''),
    at: Date.now(),
  });
  const newlyUnlockedAuras = unlockedAuras(mon).filter((a) => !beforeIds.has(a.id));
  return { added: true, memory: MEMORIES[id], newlyUnlockedAuras };
}

/** Enregistre les souvenirs gagnés à la fin d'un combat (survie <= 5% PV, faille, Alpha). */
export function recordBattleMemories(game, battle, result, opts = {}) {
  const recorded = [];
  if (!game?.state || !battle || (result !== 'win' && result !== 'caught')) return recorded;
  const loc = game.locationName ? game.locationName() : (opts.loc || 'Odyssée');
  const partUids = battle.participants instanceof Set && battle.participants.size
    ? battle.participants
    : new Set(game.state.party?.[0]?.uid ? [game.state.party[0].uid] : []);
  const checkAndPush = (mon, memId) => {
    const res = addMemory(mon, memId, loc);
    if (res.added) recorded.push({ mon, memory: res.memory, newAuras: res.newlyUnlockedAuras });
  };
  for (const mon of (game.state.party || [])) {
    if (!mon) continue;
    if (battle.clutchUids?.has(mon.uid) && mon.hp > 0) checkAndPush(mon, 'clutch_1hp');
    if (partUids.has(mon.uid)) {
      if (opts.rift) checkAndPush(mon, 'rift');
      if (opts.alpha) checkAndPush(mon, 'alpha');
    }
  }
  if (result === 'caught' && battle.caughtMon?.alpha) {
    checkAndPush(battle.caughtMon, 'alpha');
  }
  if (recorded.length) {
    try { game.checkTrophies?.(true); } catch (e) { warnDev('follower-trophies', e); }
  }
  return recorded;
}

/* ================= Emote flottante et réactions temps réel ================= */
let emoteCanvas = null;
function paintEmote(emote) {
  if (typeof document === 'undefined') return null;
  if (!emoteCanvas) {
    emoteCanvas = document.createElement('canvas');
    emoteCanvas.width = 16;
    emoteCanvas.height = 16;
  }
  const x = emoteCanvas.getContext('2d');
  x.clearRect(0, 0, 16, 16);
  // Petite bulle blanche pixel-art avec bordure sombre
  x.fillStyle = '#080c14';
  x.fillRect(2, 1, 12, 12);
  x.fillRect(1, 2, 14, 10);
  x.fillRect(6, 13, 3, 2);
  x.fillStyle = '#ffffff';
  x.fillRect(2, 2, 12, 10);
  x.fillRect(7, 12, 2, 2);
  if (emote === 'music') {
    x.fillStyle = '#2078e8';
    x.fillRect(6, 4, 2, 5);
    x.fillRect(6, 4, 5, 2);
    x.fillRect(10, 5, 2, 5);
    x.fillRect(4, 8, 3, 2);
    x.fillRect(8, 9, 3, 2);
  } else if (emote === 'star') {
    x.fillStyle = '#f0a800';
    x.fillRect(7, 3, 2, 8);
    x.fillRect(4, 6, 8, 2);
    x.fillStyle = '#fff080';
    x.fillRect(6, 5, 4, 4);
  } else if (emote === 'heart') {
    x.fillStyle = '#e83058';
    x.fillRect(4, 4, 3, 3);
    x.fillRect(9, 4, 3, 3);
    x.fillRect(5, 5, 6, 4);
    x.fillRect(6, 9, 4, 1);
    x.fillRect(7, 10, 2, 1);
  } else if (emote === 'alert') {
    x.fillStyle = '#d82828';
    x.fillRect(7, 3, 2, 5);
    x.fillRect(7, 9, 2, 2);
  }
  return emoteCanvas;
}

/** annonce discrète des souvenirs gagnés en marchant, au combat ou à la fin d'une Arène */
export function annoncerSouvenirs(game, gagnes) {
  if (!gagnes?.length || !game?.ui?.toast) return;
  const [a] = gagnes, reste = gagnes.length - 1;
  game.sound?.sfx?.('memory_unlock');
  game.ui.toast(`${a.memory.icon} Souvenir de ${monName(a.mon)} : « ${a.memory.title} »${reste > 0 ? ` (et ${reste} autre${reste > 1 ? 's' : ''})` : ''}`, 3200);
  const aura = gagnes.find((g) => g.newAuras?.length);
  if (aura) setTimeout(() => game.ui.toast(`${aura.newAuras[0].icon} Aura d'entrée de ${monName(aura.mon)} : ${aura.newAuras[0].name} !`, 3200), 3400);
}

function nearbySpecialNpc(game, f) {
  let musician = false;
  let goat = false;
  for (const n of (game.npcs || [])) {
    if (!n) continue;
    const dist = Math.abs(n.x - f.x) + Math.abs(n.y - f.y);
    if (dist > 6) continue;
    const id = String(n.id || '');
    const scr = String(n.def?.script || '');
    if ((scr === 'musicien' || /musicien/i.test(id)) && dist <= 6) musician = true;
    if ((scr === 'dojoMascotte' || n.sprite === 'bouc') && dist <= 4) goat = true;
  }
  return { musician, goat };
}

export function followerDanceHop(fol) {
  return fol?._dancing ? Math.abs(Math.sin((fol._danceT || 0) * 8.5)) * 0.16 : 0;
}

export function followerTickLife(game, dt) {
  const v = game.view, f = game.fol, sp = game.followerSp?.();
  if (!f || f.hidden || !sp || !v?.actors) {
    if (f) { f._dancing = false; f._emote = null; }
    if (v?.actors?.has('fol:emote')) v.removeActor('fol:emote');
    return;
  }
  // les gens autour sont regardés quatre fois par seconde (la région en compte plus d'un millier)
  f._vieT = (f._vieT ?? 0) - dt;
  if (f._vieT <= 0 || !f._autour) { f._vieT = 0.25; f._autour = nearbySpecialNpc(game, f); }
  const { musician, goat } = f._autour;
  f._dancing = musician;
  if (musician) {
    f._danceT = (f._danceT || 0) + dt;
    const tete = game.state?.party?.[0];
    if (f._danceT >= 1.5 && tete && !hasMemory(tete, 'music_dance') && !game.busy) {
      const res = addMemory(tete, 'music_dance', game.locationName?.() || '');
      if (res.added) annoncerSouvenirs(game, [{ mon: tete, memory: res.memory, newAuras: res.newlyUnlockedAuras }]);
    }
  } else {
    f._danceT = 0;
  }

  const riftDist = game.rifts?.distToPlayer?.() ?? Infinity;
  const cel = game.celestial?.activeKind || 'none';
  let emote = null;
  if (musician) emote = 'music';
  else if (riftDist <= 8) emote = 'alert';
  else if (cel !== 'none') emote = 'star';
  else if (goat) emote = 'heart';
  // émerveillé ou attendri : la bulle va et vient, elle ne reste pas tout le temps au-dessus de lui
  f._emoteT = (f._emoteT || 0) + dt;
  if ((emote === 'star' || emote === 'heart') && f._emoteT % 7 > 2.4) emote = null;

  f._emote = emote;
  if (!emote || typeof document === 'undefined') {
    if (v.actors.has('fol:emote')) v.removeActor('fol:emote');
    return;
  }
  const canvas = paintEmote(emote);
  if (!canvas) return;
  const a = v.imageActor('fol:emote', canvas, 0.7, { lumineux: true });
  if (f._drawnEmote !== emote || f._emoteActeur !== a) {
    f._emoteActeur = a;
    f._drawnEmote = emote;
    if (a.mesh?.material?.map) a.mesh.material.map.needsUpdate = true;
  }
  const bob = Math.sin(performance.now() / 240) * 0.08;
  // la bulle suit le Pokémon pendant son pas, au-dessus de sa tête
  const u = f.move ? Math.min(1, f.move.t) : 1;
  const ex = f.move ? f.move.fx + (f.move.tx - f.move.fx) * u : f.x, ey = f.move ? f.move.fy + (f.move.ty - f.move.fy) * u : f.y;
  // le dresseur juste derrière lui : la bulle se décale pour ne pas lui couvrir le dos
  const p = game.player, cote = p && Math.abs(p.x - ex) < 0.6 && ey - p.y > 0.4 && ey - p.y < 1.6 ? 0.7 : 0;
  v.place(a, ex + cote, ey, 1.05 + bob + followerDanceHop(f) - (cote ? 0.25 : 0), true);
  if (a.shadow) a.shadow.visible = false;
}

/* ================= Dialogue contextuel riche & trouvailles ================= */
const GIFT_POOL = ['oran-berry', 'sitrus-berry', 'lum-berry', 'heart-scale'];

function typeLines(mon, spData, weather, h, outdoor, mapName) {
  const n = monName(mon);
  const types = spData?.t || ['normal'];
  const lines = [];
  if (types.includes('fire')) {
    lines.push(weather === 'rain' ? `${n} secoue les gouttes de pluie en soufflant une petite flammèche.` : weather === 'sun' ? `${n} s'étire avec délice sous les rayons brûlants du soleil !` : `${n} diffuse une douce chaleur rassurante autour de lui.`);
  }
  if (types.includes('water')) {
    lines.push(weather === 'rain' ? `${n} danse joyeusement sous l'averse ! La pluie le revigore.` : `${n} scrute les reflets d'eau alentour avec entrain.`);
  }
  if (types.includes('electric')) {
    lines.push(`${n} fait crépiter de minuscules étincelles d'enthousiasme !`);
  }
  if (types.includes('grass')) {
    lines.push(outdoor && (h >= 7 && h < 19) ? `${n} profite pleinement de la lumière pour faire le plein de chlorophylle !` : `${n} caresse doucement le sol de ses feuilles.`);
  }
  if (types.includes('ice')) {
    lines.push(weather === 'hail' ? `${n} adore cette neige fraîche ! Il tourbillonne dans les flocons.` : `${n} laisse échapper une petite brume glacée.`);
  }
  if (types.includes('ghost') || types.includes('dark')) {
    lines.push(h >= 20 || h < 6 ? `${n} semble particulièrement vif et malicieux sous la voûte nocturne !` : `${n} suit attentivement l'allongement de ton ombre.`);
  }
  if (types.includes('psychic') || types.includes('fairy')) {
    lines.push(`${n} semble deviner tes pensées et incline gentiment la tête vers toi.`);
  }
  if (types.includes('dragon')) {
    lines.push(`${n} redresse fièrement le menton et observe l'horizon comme un gardien.`);
  }
  if (types.includes('steel') || types.includes('rock')) {
    lines.push(`${n} se plante fermement sur ses appuis, prêt à encaisser n'importe quel choc !`);
  }
  if (!lines.length) {
    const ab = getAbility(mon);
    const tLabel = types.map((t) => TYPE_FR_LOCAL[t] || t).join('/');
    lines.push(`${n} (${tLabel}) reste fidèlement à tes côtés à ${mapName || 'Odyssée'}.`);
    if (ab?.id && ABILITIES[ab.id]) lines.push(`${n} garde tous ses sens en éveil grâce à ${ABILITIES[ab.id].name}.`);
  }
  return lines;
}

export async function talkFollowerRich(game) {
  const m = game.state?.party?.[0];
  if (!m) return;
  const n = monName(m), h = game.hour(), ui = game.ui;
  const loc = game.locationName ? game.locationName() : (game.mapObj?.name || 'Odyssée');
  const wx = game.getMapWeather ? game.getMapWeather() : 'none';
  const spData = SPECIES[m.sp];
  if (game.fol) game.fol.dir = OPP[game.player.dir];

  const unlockedNames = [];
  const tryUnlock = (id) => {
    const res = addMemory(m, id, loc);
    if (res.added) unlockedNames.push({ mem: res.memory, auras: res.newlyUnlockedAuras });
  };

  tryUnlock('first_walk');
  if (wx !== 'none') tryUnlock('weather_bond');

  const f = game.fol || { x: game.player.x, y: game.player.y };
  const { musician, goat } = nearbySpecialNpc(game, f);
  const cel = game.celestial?.activeKind || 'none';
  const riftDist = game.rifts?.distToPlayer?.() ?? Infinity;

  let chosenLine = null;
  if (riftDist <= 10) {
    chosenLine = `${n} frissonne légèrement et fixe une distorsion étrange non loin d'ici... Une faille spatio-temporelle est ouverte !`;
  } else if (cel === 'aurora') {
    tryUnlock('celestial');
    chosenLine = `${n} contemple l'aurore boréale émeraude avec des yeux pleins d'étoiles !`;
  } else if (cel === 'meteor') {
    tryUnlock('celestial');
    chosenLine = `${n} lève la tête vers les étoiles filantes ! Des éclats brillent sûrement au sol.`;
  } else if (musician) {
    tryUnlock('music_dance');
    chosenLine = `♪ ${n} marque le rythme de la musique avec enthousiasme !`;
  } else if (goat) {
    chosenLine = `${n} observe le Bouc du Dojo avec une pointe d'admiration... et un brin de jalousie amicale !`;
  }

  // Petite trouvaille ponctuelle d'objet (cooldown 3 minutes)
  let foundItem = null;
  const now = Date.now();
  const lastGift = game.state.flags?.lastFollowerGiftAt || 0;
  if (!chosenLine && game.mapObj?.outdoor && now - lastGift > 180_000 && Math.random() < 0.28) {
    game.state.flags ||= {};
    game.state.flags.lastFollowerGiftAt = now;
    game.state.flags.followerGifts = (game.state.flags.followerGifts || 0) + 1;
    foundItem = GIFT_POOL[Math.floor(Math.random() * GIFT_POOL.length)];
    game.give?.(foundItem, 1);
    tryUnlock('gift_finder');
  }

  if (foundItem && ITEMS[foundItem]) {
    game.sound.sfx('item');
    await ui.say([
      `${n} gratte joyeusement le sol et te rapporte quelque chose !`,
      formatFindItem(game.state.name, foundItem, 1),
    ]);
  } else {
    if (!chosenLine) {
      const pool = [
        ...typeLines(m, spData, wx, h, game.mapObj?.outdoor, loc),
        m.hp < m.stats[0] * 0.45 ? `${n} a l'air un peu fatigué... Un petit tour au Centre de soins lui ferait du bien.` : `${n} rayonne d'énergie à tes côtés !`,
        m.alpha ? `${n} dégage une aura imposante de Pokémon Alpha, mais se montre tout doux avec toi.` : `${n} te regarde droit dans les yeux. La confiance est totale.`,
      ];
      chosenLine = pool[Math.floor(Math.random() * pool.length)];
    }
    if (musician) game.sound?.sfx?.('amb_musician');
    else if (cel === 'aurora') game.sound?.sfx?.('amb_aurora');
    else if (cel === 'meteor') game.sound?.sfx?.('amb_shooting_star');
    else if (riftDist <= 10) game.sound?.sfx?.('amb_rift_hum');
    else if (m.hp >= m.stats[0] * 0.45) game.sound?.sfx?.('follower_happy');
    await ui.say(chosenLine);
  }

  if (unlockedNames.length) {
    const notes = [];
    for (const u of unlockedNames) {
      notes.push(`${u.mem.icon} Nouveau souvenir gravé pour ${n} : « ${u.mem.title} » !`);
      for (const a of u.auras) {
        notes.push(`${a.icon} Aura d'entrée débloquée pour ${n} : ${a.name} ! (Consulte l'onglet Souvenirs du Résumé)`);
      }
    }
    try { game.sound.sfx('memory_unlock'); } catch (e) { warnDev('follower-sfx', e); }
    try { game.checkTrophies?.(true); } catch (e) { warnDev('follower-trophies', e); }
    game.save?.(true);
    await ui.say(notes);
  }
}
