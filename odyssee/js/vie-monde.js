// odyssee/js/vie-monde.js — la vie autour du joueur, suite de vie.js :
//  colporteurs et marché du week-end, arbres à baies et parois à fouiller (une fois par jour), revanches des dresseurs
//  de route, habitants qui parlent de tes exploits, sons d'ambiance, papillons / lucioles / mouettes.
import { T } from './world/tiles.js';
import { ITEMS } from './core/items.js';
import { MEGA_FORMS, LEGEND } from './core/mega.js';
import { levelCap } from './core/mon.js';
import { shopScreen } from './ui/screens.js';

const jourDe = (d = new Date()) => d.toDateString();
const etat = (st) => (st.vie ||= { baies: {}, fouilles: {}, revanche: {} });
const nomObjet = (k) => ITEMS[k]?.name || k;

/* ================= colporteurs et marché ================= */
export async function colporteur(game, n) {
  await game.ui.say(['Hé, dresseur ! Une petite pause ?', 'Je vends de quoi tenir la route, et une pierre rare que j\'ai trouvée en chemin.'], { speaker: 'Colporteur' });
  await shopScreen(game, n.def.stock.filter((k) => ITEMS[k]));
  await game.ui.say('Bonne route ! On se recroisera peut-être plus loin.', { speaker: 'Colporteur' });
}
export async function marche(game, n) {
  await game.ui.say(['Bienvenue au marché du week-end !', 'Je ne passe que le samedi et le dimanche : profites-en, j\'ai des objets qu\'on ne trouve nulle part ailleurs.'], { speaker: 'Marchande' });
  await shopScreen(game, n.def.stock.filter((k) => ITEMS[k]));
}

/* ================= arbres à baies et fouilles ================= */
export async function cueillir(game, o) {
  const st = game.state, E = etat(st), ui = game.ui;
  if (E.baies[o.id] === jourDe()) { await ui.say('Cet arbre a déjà été cueilli aujourd\'hui.\nDe nouvelles baies pousseront demain.'); return; }
  const n = 1 + Math.floor(Math.random() * 3);
  E.baies[o.id] = jourDe(); game.give(o.baie, n); game.sound.sfx('item');
  game.vieMonde?.majObjet(o);
  await ui.say(`${st.name} cueille ${n} ${nomObjet(o.baie)}${n > 1 ? ' (×' + n + ')' : ''} !`);
}
const TRESORS = [['hard-stone', 22], ['ether', 18], ['revive', 12], ['prism-shard', 14], ['fire-stone', 4], ['water-stone', 4], ['thunder-stone', 4], ['leaf-stone', 4], ['moon-stone', 4], ['dusk-stone', 3], ['dawn-stone', 3], ['shiny-stone', 3], ['ice-stone', 3], ['rare-candy', 4], ['gemme', 3]];
export async function fouiller(game, o) {
  const st = game.state, E = etat(st), ui = game.ui;
  if (E.fouilles[o.id] === jourDe()) { await ui.say('Cette paroi a déjà été fouillée aujourd\'hui.'); return; }
  if (!(await ui.yesNo('La paroi scintille faiblement…\nGratter la roche ?'))) return;
  game.sound.sfx('hitweak'); await new Promise((r) => setTimeout(r, 250)); game.sound.sfx('hitweak'); await new Promise((r) => setTimeout(r, 250)); game.sound.sfx('hit');
  E.fouilles[o.id] = jourDe(); game.vieMonde?.majObjet(o);
  const tot = TRESORS.reduce((a, t) => a + t[1], 0); let r = Math.random() * tot, k = TRESORS[0][0];
  for (const [it, w] of TRESORS) { r -= w; if (r <= 0) { k = it; break; } }
  if (k === 'gemme') {   // une Méga-Gemme (jamais celle d'un légendaire)
    const g = Object.values(MEGA_FORMS).filter((f) => !f.fan && !LEGEND.has(f.base)).map((f) => f.stone).filter((s) => ITEMS[s]);
    k = g[Math.floor(Math.random() * g.length)];
  }
  if (!ITEMS[k]) k = 'hard-stone';
  game.give(k, 1); game.sound.sfx('item');
  await ui.say([`Quelque chose se détache de la roche…`, `${st.name} trouve : ${nomObjet(k)} !`]);
}

/* ================= revanches ================= */
const DELAI_REVANCHE = 20 * 3600e3;   // 20 heures
/** un dresseur de route déjà battu peut-il redemander un combat ? */
export function revanchePossible(game, n) {
  const d = n.def, st = game.state;
  if (!d.trainer || d.leader != null || d.champion || d.rival || d.vanish || d.winScript || d.onWin || game.mapObj?.id !== 'monde') return false;
  if (!st.flags['T:' + n.id]) return false;
  const t = etat(st).revanche[n.id];
  return t == null || Date.now() - t >= DELAI_REVANCHE;
}
export function noteCombat(game, n) { if (n.def.trainer && game.mapObj?.id === 'monde') etat(game.state).revanche[n.id] = Date.now(); }
export async function revanche(game, n) {
  const d = n.def, tr = d.trainer, st = game.state, ui = game.ui;
  const who = { speaker: tr.cls ? `${tr.cls} ${tr.name}` : tr.name, face: tr.bs || tr.ow || n.sprite };
  if (!(await ui.yesNo(`Te revoilà ! Mon équipe s'est entraînée depuis la dernière fois.\nUne revanche ?`, who))) { await ui.say('Une autre fois, alors !', who); return; }
  // l'équipe a progressé : près du niveau maximal du moment, sans jamais redescendre
  const cap = Math.min(100, levelCap(st.badges));
  const team = tr.team.map((e) => { const [sp, lvl, item, moves] = Array.isArray(e) ? e : [e.sp, e.lvl, e.item, e.moves]; return [sp, Math.max(lvl, cap - 3 - Math.floor(Math.random() * 3)), item, moves]; });
  const fake = { ...n, id: n.id + ':revanche', def: { ...d, id: n.id + ':revanche', trainer: { ...tr, team, intro: ['Cette fois, je ne vais pas me laisser faire !'] } } };
  etat(st).revanche[n.id] = Date.now();
  const res = await game.trainerBattle(fake, false);
  delete st.flags['T:' + n.id + ':revanche'];
  if (res === 'win') { await ui.say(['Toujours aussi fort…', 'Tiens, pour la peine.'], who); await game.api().give(['great-ball', 'super-potion', 'ultra-ball', 'hyper-potion'][Math.floor(Math.random() * 4)], 1); }
}

/* ================= les habitants parlent de toi ================= */
export function ragot(game) {
  const st = game.state, b = game.badgeCount(), N = st.name, f = st.flags;
  const L = [];
  if (f.champion) L.push([`C'est toi, ${N}, le Maître de la Ligue ? Je peux avoir un autographe ?`], ['Depuis que tu es Maître de la Ligue, les gamins du quartier ne parlent que de toi.']);
  else if (b >= 8) L.push(['Huit badges ! Il ne te reste plus que la Ligue Céleste.', 'Toute la région va suivre ton combat, tu sais.'], ['On dit que Célestine n\'a jamais perdu. Jamais. Bonne chance !']);
  else if (b >= 5) L.push([`${b} badges… On commence à entendre ton nom jusqu'ici.`], ['La Team Éclipse rôde encore. Fais attention à toi, sur les routes.'], ['Les dresseurs des routes se sont tous mis à s\'entraîner depuis que tu passes. Tu leur donnes envie !']);
  else if (b >= 2) L.push([`Tiens, tu as déjà ${b} badges ? Pas mal du tout !`], ['Mon fils veut devenir dresseur depuis qu\'il t\'a vu combattre.'], ['Il paraît que des gens en noir traînent du côté des ports. Bizarre…']);
  else if (b === 1) L.push(['Ton premier badge ! Ça se fête, ça.'], ['Le premier badge, c\'est le plus beau. Moi, je l\'ai encore dans un tiroir.']);
  else L.push(['Un nouveau dresseur ! Ça se voit, tu as encore l\'air tout neuf.'], ['Tu pars à la conquête des badges ? Commence par bien connaître ton Pokémon.']);
  const h = game.hour();
  if (h >= 19 || h < 6) L.push(['Bonsoir ! Il se fait tard, tu ne rentres pas ?']); else if (h < 10) L.push(['Bonjour ! Belle journée pour voyager, non ?']);
  const d = new Date().getDay(); if (d === 0 || d === 6) L.push(['C\'est le week-end ! Le marché s\'est installé près du centre de la ville.']);
  return L[Math.floor(Math.random() * L.length)];
}

/* ================= affichage : baies, paroi qui brille, petites bêtes, sons ================= */
function dessinBaies(couleur) {
  const c = document.createElement('canvas'); c.width = 30; c.height = 24; const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  for (const [x, y] of [[7, 8], [16, 5], [24, 10], [11, 16], [21, 18]]) {
    g.fillStyle = '#23461f'; g.fillRect(x, y - 5, 2, 3);
    g.fillStyle = '#141414'; g.beginPath(); g.arc(x + 0.5, y + 0.5, 3.6, 0, 7); g.fill();
    g.fillStyle = couleur; g.beginPath(); g.arc(x + 0.5, y + 0.5, 2.6, 0, 7); g.fill();
    g.fillStyle = 'rgba(255,255,255,.9)'; g.fillRect(x - 1, y - 1, 2, 1);
  }
  return c;
}
function dessinEclat() {
  const c = document.createElement('canvas'); c.width = 30; c.height = 22; const g = c.getContext('2d');
  const etoile = (cx, cy, r, col) => { g.fillStyle = col; g.fillRect(cx, cy - r, 1, 2 * r + 1); g.fillRect(cx - r, cy, 2 * r + 1, 1); g.fillRect(cx - 1, cy - (r >> 1), 3, r + 1); g.fillRect(cx - (r >> 1), cy - 1, r + 1, 3); g.fillStyle = '#fff'; g.fillRect(cx - 1, cy - 1, 3, 3); };
  etoile(9, 11, 7, '#9fe2ff'); etoile(22, 6, 4, '#ffe28a'); etoile(23, 17, 3, '#c9a8ff');
  return c;
}
const COULEUR_BAIE = { 'oran-berry': '#3f7fe0', 'sitrus-berry': '#f2c13a', 'lum-berry': '#7fd14a' };

export class VieMonde {
  constructor(game) { this.game = game; this.actors = []; this.betes = []; this.tSon = 3; this.overlay = null; }

  onMap(m) {
    const v = this.game.view;
    for (const a of this.actors) v.removeActor(a.id);
    this.actors = []; this.betes = [];
    for (const [k, o] of m.objects) {
      if (o.type !== 'baies' && o.type !== 'fouille') continue;
      const [x, y] = k.split(',').map(Number);
      this.actors.push({ id: 'vie:' + o.id, o, x, y });
    }
    this.actors.forEach((e) => this.majObjet(e.o));
    if (m.outdoor && !this.overlay) {
      const host = v.renderer?.domElement; const c = this.overlay = document.createElement('canvas'); c.className = 'ow-betes';
      if (host?.parentNode) host.insertAdjacentElement('afterend', c); else document.body.appendChild(c);
    }
    if (!m.outdoor && this.overlay) { this.overlay.remove(); this.overlay = null; }
  }

  /** l'arbre a-t-il ses baies, la paroi brille-t-elle encore aujourd'hui ? */
  majObjet(o) {
    const e = this.actors.find((a) => a.o === o); if (!e) return;
    const v = this.game.view, E = etat(this.game.state);
    const fait = (o.type === 'baies' ? E.baies : E.fouilles)[o.id] === jourDe();
    if (fait) { v.removeActor(e.id); e.a = null; return; }
    if (e.a) return;
    e.a = v.imageActor(e.id, o.type === 'baies' ? dessinBaies(COULEUR_BAIE[o.baie] || '#e04848') : dessinEclat(), o.type === 'baies' ? 1 : 1);
    if (e.a.shadow) e.a.shadow.visible = false;
    if (o.type === 'baies') v.place(e.a, e.x, e.y + 0.42, 0.18, true); else v.place(e.a, e.x, e.y + 0.45, 0.55, true);
  }

  tick(dt) {
    const g = this.game, m = g.mapObj; if (!m) return;
    // la paroi qui brille clignote doucement
    const t = performance.now() / 1000;
    for (const e of this.actors) if (e.a && e.o.type === 'fouille') e.a.mesh.visible = Math.sin(t * 3 + e.x) > -0.3;
    if (g.bv?.alive || g.ui.root.querySelector('.screen')) { if (this.overlay) this.overlay.getContext('2d').clearRect(0, 0, this.overlay.width, this.overlay.height); return; }
    this.sons(dt);
    if (this.overlay) this.petitesBetes(dt);
  }

  /** ce qui entoure le joueur (dans un rayon de 7 cases) */
  autour() {
    const g = this.game, m = g.mapObj, p = g.player; let eau = 0, fleurs = 0, herbe = 0;
    for (let dy = -7; dy <= 7; dy += 2) for (let dx = -7; dx <= 7; dx += 2) {
      const t = m.get(p.x + dx, p.y + dy);
      if (t === T.WATER) eau++; else if (t === T.FLOWER) fleurs++; else if (t === T.TALL || t === T.GRASS || t === T.TREE) herbe++;
    }
    const z = m.outdoor ? m.zoneAt(p.x, p.y) : null;
    return { eau, fleurs, herbe, theme: z?.theme || '', ville: !!z?.town };
  }

  sons(dt) {
    const g = this.game, m = g.mapObj;
    if (!m.outdoor || g.busy) return;
    this.tSon -= dt; if (this.tSon > 0) return;
    this.tSon = 3 + Math.random() * 5;
    const A = this.autour(), h = g.hour(), soir = h >= 20 || h < 6;
    if (A.theme === 'snow' || A.theme === 'cime') g.sound.sfx('vent');
    else if (A.eau >= 12) g.sound.sfx('vague');
    else if (soir && A.herbe > 10) g.sound.sfx('grillon');
    else if (!soir && A.herbe > 8 && !['volcanic', 'cendre', 'forge', 'desert', 'dunes'].includes(A.theme)) g.sound.sfx('oiseau');
    else if (A.eau >= 4 && !soir && Math.random() < 0.5) g.sound.sfx('mouette');
  }

  /** papillons le jour près des fleurs, lucioles le soir dans la verdure, mouettes au-dessus de la mer */
  petitesBetes(dt) {
    const g = this.game, v = g.view, p = g.player, c = this.overlay, W = c.clientWidth || innerWidth, H = c.clientHeight || innerHeight;
    if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
    const x = c.getContext('2d'); x.clearRect(0, 0, W, H);
    const h = g.hour(), soir = h >= 20 || h < 6, now = performance.now() / 1000;
    this.tBete = (this.tBete ?? 0) - dt;
    if (this.tBete <= 0) {
      this.tBete = 0.6;
      const A = this.autour(), max = 10;
      const n = (k) => this.betes.filter((b) => b.k === k).length;
      const pres = () => [p.x + (Math.random() * 2 - 1) * 9, p.y + (Math.random() * 2 - 1) * 6];
      if (!soir && A.fleurs + A.herbe > 6 && n('papillon') < (A.fleurs > 3 ? 5 : 2) && this.betes.length < max) { const [bx, by] = pres(); this.betes.push({ k: 'papillon', x: bx, y: by, ph: Math.random() * 6, col: ['#ffd84a', '#ffffff', '#ff9ad5', '#9ad0ff'][Math.floor(Math.random() * 4)], vie: 20 }); }
      if (soir && A.herbe > 6 && n('luciole') < 9 && this.betes.length < max + 4) { const [bx, by] = pres(); this.betes.push({ k: 'luciole', x: bx, y: by, ph: Math.random() * 6, vie: 14 }); }
      if (!soir && A.eau >= 8 && n('mouette') < 2) { const g2 = Math.random() < 0.5; this.betes.push({ k: 'mouette', x: p.x + (g2 ? -14 : 14), y: p.y - 3 + Math.random() * 6, vx: g2 ? 3.2 : -3.2, ph: Math.random() * 6, vie: 12 }); }
    }
    for (const b of this.betes) {
      b.vie -= dt;
      if (b.k === 'papillon') { b.x += Math.sin(now * 0.9 + b.ph) * dt * 1.2; b.y += Math.cos(now * 0.7 + b.ph * 2) * dt * 0.9; }
      else if (b.k === 'luciole') { b.x += Math.sin(now * 0.5 + b.ph) * dt * 0.5; b.y += Math.cos(now * 0.4 + b.ph) * dt * 0.4; }
      else b.x += b.vx * dt;
      const s = v.screenPos(b.x, b.y, b.k === 'mouette' ? 120 : b.k === 'papillon' ? 26 + Math.sin(now * 3 + b.ph) * 6 : 18 + Math.sin(now + b.ph) * 8);
      if (!s) continue;
      const r = c.getBoundingClientRect(), sx = s.left - r.left, sy = s.top - r.top;
      if (b.k === 'papillon') {
        const ail = Math.abs(Math.sin(now * 14 + b.ph)) * 5 + 1;
        x.globalAlpha = Math.min(1, b.vie); x.fillStyle = b.col;
        x.fillRect(sx - ail - 1, sy - 3, ail, 4); x.fillRect(sx + 1, sy - 3, ail, 4); x.fillStyle = '#2a1a10'; x.fillRect(sx - 0.5, sy - 3, 1.5, 5);
      } else if (b.k === 'luciole') {
        const a = Math.max(0, Math.sin(now * 2.2 + b.ph)) * Math.min(1, b.vie);
        if (a < 0.05) continue;
        x.globalAlpha = a * 0.3; x.fillStyle = '#d8ff6a'; x.beginPath(); x.arc(sx, sy, 12, 0, 7); x.fill();
        x.globalAlpha = a * 0.6; x.beginPath(); x.arc(sx, sy, 5, 0, 7); x.fill();
        x.globalAlpha = a; x.fillStyle = '#fbffd8'; x.fillRect(sx - 2, sy - 2, 4, 4);
      } else {
        const ail = Math.sin(now * 5 + b.ph) * 4;
        x.globalAlpha = 0.25; x.fillStyle = '#000'; x.beginPath(); x.ellipse(sx + 10, sy + 70, 9, 3, 0, 0, 7); x.fill();
        x.globalAlpha = 1; x.strokeStyle = '#ffffff'; x.lineWidth = 2.5; x.beginPath();
        x.moveTo(sx - 11, sy - 2 - ail); x.quadraticCurveTo(sx - 5, sy - 6, sx, sy); x.quadraticCurveTo(sx + 5, sy - 6, sx + 11, sy - 2 - ail); x.stroke();
        x.strokeStyle = '#3a3a3a'; x.lineWidth = 1; x.beginPath(); x.moveTo(sx - 11, sy - 2 - ail); x.lineTo(sx - 8, sy - 3 - ail); x.stroke();
      }
    }
    x.globalAlpha = 1;
    this.betes = this.betes.filter((b) => b.vie > 0 && Math.abs(b.x - p.x) < 18 && Math.abs(b.y - p.y) < 13);
  }
}
