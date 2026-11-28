// odyssee/js/game/puzzles.js — mécaniques d'énigmes de terrain, d'arènes et de sanctuaires de légendaires.
import { T, walkable, DIRS } from '../world/tiles.js';
import { QUIZ } from '../world/arenes.js';
import { souffle as souffleSerre, stelesPleines, moitieDe } from '../world/arene-sylve.js';
import { wait } from '../ui/ui.js';

/** Fait glisser le joueur sur la glace et les dalles fléchées jusqu'au prochain obstacle. */
export async function glisse(g, dir) {
  const p = g.player, m = g.mapObj;
  for (let guard = 0; guard < 300; guard++) {
    const o = m.objectAt(p.x, p.y);
    if (o?.type === 'fleche') dir = o.dir; else if (o?.type !== 'glace') break;
    const [dx, dy] = DIRS[dir], tx = p.x + dx, ty = p.y + dy;
    if (!walkable(m.get(tx, ty)) || g.occupied(tx, ty)) break;
    p.dir = dir; p.walking = o?.type === 'fleche';
    p.move = { fx: p.x, fy: p.y, tx, ty, t: 0, dur: 0.1, scripted: true }; while (p.move) await wait(16);
  }
  p.walking = false;
}

/** Dalle : lève les barrières d'une couleur et baisse celles de l'autre (l'état est gardé avec la carte). */
export function dalle(g, o) {
  const m = g.mapObj, st = g.state, k = 'B:' + m.id, up = o.g;
  if (st.flags[k] === up) return;
  st.flags[k] = up; g.sound.sfx('select'); g.view.shake = 0.05;
  for (const [x, y, col] of m.barriers || []) {
    const raise = col === up;
    if (g.player.x === x && g.player.y === y) continue;
    g.setTile(x, y, raise ? (col === 'r' ? T.BARRIER_R : T.BARRIER_B) : T.FLOOR);
  }
}

/** Soufflerie de la Grande Serre : pousse le premier bloc de pollen dans son axe et ouvre le dôme si deux stèles sont pleines. */
export async function souffle(g, o) {
  const m = g.mapObj, s = m.serre?.souffleries[o.i]; if (!s) return;
  g.sound.sfx('select'); g.view.shake = 0.04;
  const r = souffleSerre(m, s, (x, y) => g.occupied(x, y) || (g.player.x === x && g.player.y === y));
  if (!r) { await g.ui.say('Fffffff... La soufflerie tourne, mais son souffle ne pousse rien.', { auto: 1300 }); return; }
  let [x, y] = r.de;
  for (const [nx, ny] of r.chemin) {
    g.setTile(x, y, T.FLOOR); g.setTile(nx, ny, T.BOULDER); [x, y] = [nx, ny];
    await wait(55);
  }
  g.sound.sfx('ledge'); g.view.shake = 0.06;
  if (!r.stele) return;
  await wait(150); g.sound.sfx('item'); g.view.shake = 0.12;
  await g.ui.say(`Le bloc de pollen tombe dans l'alvéole... La stèle de ${r.stele.cote} s'illumine !`);
  if (stelesPleines(m) && m.serre.portail.some(([px, py]) => m.get(px, py) !== T.FLOOR)) {
    for (const [px, py] of m.serre.portail) g.setTile(px, py, T.FLOOR);
    g.sound.sfx('door'); g.view.shake = 0.2;
    await g.ui.say(['Un long froissement de feuilles parcourt la serre...', 'Les lianes du portail du dôme se sont écartées !']);
  }
  g.save(true);
}

/** Remet en place les blocs d'une demi-serre (ou de toute la serre) : les cases changées reprennent leur état d'origine. */
export function remiseSerre(g, m, moitie = null) {
  const t = g.state.tiles?.[m.id]; if (!t) return 0;
  const portail = new Set((m.serre?.portail || []).map(([x, y]) => x + ',' + y));
  let n = 0;
  for (const k of Object.keys(t)) {
    const [x, y] = k.split(',').map(Number);
    if (portail.has(k) || (moitie && moitieDe(x) !== moitie)) continue;
    const v0 = m._orig?.get(k); delete t[k]; n++;
    if (v0 != null) { m.set(x, y, v0); m._orig.delete(k); }
    if (m === g.mapObj) g.view.rebuildAt(x, y);
  }
  return n;
}

/** Pupitre près d'une porte de la serre : remettre les blocs de cette demi-serre en place. */
export async function pupitreSerre(g, moitie) {
  const m = g.mapObj, ui = g.ui, cote = moitie === 'g' ? 'gauche' : 'droite';
  if (stelesPleines(m)) { await ui.say('Pupitre de la serre : « Les deux stèles sont allumées. Le dôme vous attend ! »'); return; }
  const pleine = (m.serre?.steles || []).find((s) => moitieDe(s.x) === moitie && m.get(s.x, s.y) === T.BOULDER);
  if (pleine) { await ui.say(`Pupitre de la serre : « La stèle de ${cote} est déjà allumée. Rien à remettre en place de ce côté. »`); return; }
  if (!(await ui.yesNo(`Pupitre de la serre : « Remettre les blocs de pollen de la demi-serre de ${cote} à leur place ? »`))) return;
  const n = remiseSerre(g, m, moitie);
  g.sound.sfx('door'); g.view.shake = 0.08;
  await ui.say(n ? 'Les souffleries ronronnent en sens inverse... Les blocs de pollen sont revenus à leur place.' : 'Les blocs de pollen sont déjà à leur place.');
  g.save(true);
}

/** Téléporteur : on réapparaît sur l'autre dalle. */
export async function teleporte(g, o) {
  const p = g.player;
  g.sound.sfx('exit');
  await g.ui.fade(true, 140);
  p.x = o.to[0]; p.y = o.to[1]; p.dir = o.dir || p.dir; p.move = null;
  g.view.update(0, p.x, p.y); g.resetFollower?.();
  await g.view.solPret?.();
  await g.ui.fade(false, 140);
}

/** Gardien du savoir (arène Feu) : une bonne réponse et il s'écarte ; une mauvaise, et il faut le battre. */
export async function savoir(g, n) {
  const ui = g.ui, q = QUIZ[(n.def.quiz || 0) % QUIZ.length], sp = { speaker: 'Gardien du savoir' };
  await ui.say('Halte ! Seuls ceux qui connaissent le feu passent. Réponds à ma question.', { ...sp, keep: true });
  const k = await ui.list({ title: q.q, items: q.choix.map((label) => ({ label })), cls: 'shop quiz', cancel: null });
  if (k !== q.bonne) {
    g.sound.sfx('bump'); await ui.say(`Faux ! C'était « ${q.choix[q.bonne]} ». Prouve ta valeur au combat, alors !`, sp);
    const lvl = Math.max(20, g.levelCap() - 4), team = [[58, lvl], [126, lvl + 1]];
    const res = await g.api().fight({ cls: 'Gardien', name: 'du savoir', team, ow: 'scientifique', bs: 'scientifique', prize: 30, lose: 'Bien joué. Tu peux passer.' });
    if (res !== 'win') return;
  } else { g.sound.sfx('select'); await ui.say(`Exact ! Passe, ${g.state.gender === 'f' ? 'dresseuse' : 'dresseur'}.`, sp); }
  g.state.flags['QZ:' + n.id] = true; g.refreshNpcs();
}

/** Île Orageuse : les trois relais à rallumer pour ouvrir le Pic Tonnerre. */
export async function pylon(g, o) {
  const f = g.state.flags, ui = g.ui;
  if (f['P:' + o.n]) { await ui.say(`Le relais n°${o.n} ronronne doucement.`); return; }
  if (!f.orageQuest) { await ui.say(`Une borne électrique éteinte. Une plaque indique : « Relais n°${o.n} ».`); return; }
  if (!(await ui.yesNo(`Relais n°${o.n}.\nRemettre le courant ?`))) return;
  f['P:' + o.n] = true; g.sound.sfx('pc'); await ui.flash(1, '#fff6a0', 70);
  const n = [1, 2, 3].filter((k) => f['P:' + k]).length;
  await ui.say(`Le relais n°${o.n} se rallume ! (${n}/3)`);
  if (n === 3) {
    f.pylons = true; g.refreshGates(); g.spawnLegends();
    g.sound.sfx('bang'); g.view.shake = 0.2;
    await ui.say(['Au loin, le Pic Tonnerre se couvre d\'éclairs...', 'Le technicien libère le sentier du Pic !']);
  }
}

/** Côte des Ruines : trois stèles à lire pour réveiller l'autel de Mew. */
export async function stele(g, o) {
  const f = g.state.flags;
  await g.ui.say(o.text);
  if (f['S:' + o.n]) return;
  f['S:' + o.n] = true;
  if (f['S:1'] && f['S:2'] && f['S:3']) {
    if (g.badgeCount() >= 4) { g.spawnLegends(); await g.ui.say('Une lueur rose danse au loin, du côté de l\'autel...'); }
    else await g.ui.say('Les trois stèles sont lues... mais l\'autel reste silencieux. Il faudrait plus d\'expérience (4 badges).');
  }
}

/** Bois Murmure : l'autel de Celebi. */
export async function shrine(g) {
  const st = g.state, ui = g.ui;
  if (st.flags['L:celebi'] === 'caught') { await ui.say('Un vieil autel de bois. Les feuilles autour bruissent doucement.'); return; }
  if (st.flags.celebiCalled) { await ui.say('L\'autel est tiède. Celebi ne doit pas être loin...'); return; }
  if (!st.bag['gs-ball']) { await ui.say(['Un vieil autel de bois, couvert de mousse.', 'Il y a un creux au centre, de la taille d\'une Poké Ball...']); return; }
  if (!(await ui.yesNo('Un vieil autel de bois, couvert de mousse.\nPoser la GS Ball dans le creux ?'))) return;
  g.take('gs-ball'); st.flags.celebiCalled = true;
  await ui.say(['Tu poses la GS Ball sur l\'autel...', '... ... ...', 'La GS Ball s\'ouvre dans un éclat vert !']);
  await ui.flash(3, '#c8ffb0', 80);
  g.spawnLegends();
  const L = g.legends.find((q) => q.id === 'celebi');
  if (L) await g.legendBattle(L);
}
