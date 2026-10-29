// odyssee/js/game.js — le jeu : déplacements sur la grille, PNJ, dresseurs, rencontres, menus, histoire, sauvegarde
import { T, walkable, isGrassEnc, DIRS, OPP } from './world/tiles.js';
import { createMon, monName, healFull, levelEvolution, itemEvolution, evolve, setUidBase } from './core/mon.js';
import { Battle } from './core/battle.js';
import { ITEMS, itemName, applyItem, canUseOn, useCandy } from './core/items.js';
import { SPECIES } from './data/species.js';
import { MOVES } from './data/moves.js';
import { STARTERS, RIVAL_NAME, BADGES, LEADERS } from './world/region.js';
import { BattleView } from './ui/battleView.js';
import { partyScreen, bagScreen, dexScreen, mapScreen, cardScreen, shopScreen, pcScreen, optionsScreen, saveCodeScreen, TYPE_FR } from './ui/screens.js';
import { encodeSave, saveSummary } from './core/savecode.js';
import { installSocial, talkToPeer } from './net/social.js';
import { el, esc, wait } from './ui/ui.js';
import { ASSETS, loadImg } from './assets.js';
import { HPX } from './render/world3d.js';
import { storyTalk, storyTrigger, storyWin, lugiaBattle, placeLugia, purify, overlay } from './story.js';

const SAVE_KEY = 'odyssee-save-v1';
const WALK = 0.26, RUN = 0.135;
const key = (x, y) => x + ',' + y;
const RIVAL_TEAMS = {
  // selon le starter du joueur : le rival prend celui qui a l'avantage
  152: { s: [155, 156, 157] }, 155: { s: [158, 159, 160] }, 158: { s: [152, 153, 154] },
};
const GYM_HINTS = { bug: 'le Feu, le Vol et la Roche', rock: 'l\'Eau, la Plante, le Combat et le Sol', water: 'l\'Électrik et la Plante', electric: 'le Sol', grass: 'le Feu, la Glace, le Vol, le Poison et l\'Insecte', psychic: 'l\'Insecte et les Ténèbres', fire: 'l\'Eau, la Roche et le Sol', dragon: 'la Glace et le Dragon' };

export class Game {
  constructor({ view, ui, input, sound, world }) {
    Object.assign(this, { view, ui, input, sound, world });
    this.busy = false; this.player = null; this.npcs = []; this.items = [];
    this.bv = new BattleView(this);
    this.session = null; // échange ou combat en cours avec un autre joueur
    input.onFree = (k) => this.onKey(k);
    installSocial(this);
  }

  /* ================= sauvegarde ================= */
  static hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
  newState(name, gender) {
    return {
      v: 1, name, gender, id: Math.floor(Math.random() * 65536), money: 3000, badges: Array(8).fill(false), flags: {},
      party: [], box: [], bag: { potion: 1 }, dex: { seen: [], caught: [] }, time: 0, visited: ['aube'], repel: 0,
      lastCenter: { map: 'aube:maison', x: 4, y: 5, dir: 'up' }, ...this.world.start,
    };
  }
  save(silent = false) {
    const s = this.state; const p = this.player;
    s.map = this.mapObj.id; s.x = p.x; s.y = p.y; s.dir = p.dir; s.surf = !!this.surfing;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); if (!silent) this.sound.sfx('save'); } catch (e) { return false; }
    this.onSaved?.(silent);
    return true;
  }
  load(from) {
    const s = from ? JSON.parse(JSON.stringify(from)) : JSON.parse(localStorage.getItem(SAVE_KEY));
    let maxUid = 0; for (const m of s.party.concat(s.box)) maxUid = Math.max(maxUid, m.uid || 0);
    setUidBase(maxUid + 1);
    return s;
  }

  async start(state) {
    this.state = state; this.busy = false;
    this.player = { x: state.x, y: state.y, dir: state.dir || 'down', move: null, step: 0, turnLock: 0, bumpT: 0 };
    this.surfing = false;
    this.setMap(state.map);
    if (state.surf && this.mapObj.get(state.x, state.y) === T.WATER) await this.startSurf(false);
    this.view.setTimeOfDay(this.hour());
    this.link.hello();
    await this.ui.fade(false, 400);
    if (!state.flags.intro) { state.flags.intro = true; this.busy = true; await this.ui.say(['Une douce lumière filtre à travers les rideaux...', `Aujourd'hui, ${state.name}, ton aventure commence !`]); this.busy = false; }
  }
  hour() { if (this.eclipseOn()) return 0.5; const d = new Date(); return d.getHours() + d.getMinutes() / 60; }
  /** la nuit violette, entre la victoire contre Nocturne au repaire et le réveil de Lugia */
  eclipseOn() { const f = this.state?.flags || {}; return !!f.eclipse && !f.lugia; }

  /* ================= cartes ================= */
  setMap(id) {
    const m = this.world.maps[id] || this.world.maps.monde;
    this.mapObj = m;
    const st = this.state;
    this.applyTiles(m);
    if (!m.outdoor || m.get(this.player.x, this.player.y) !== T.WATER) this.surfing = false;
    if (this.strengthOn !== m.id) this.strengthOn = null;
    this.view.eclipse = this.eclipseOn();
    this.view.setMap(m);
    this.npcs = m.npcs.filter((n) => this.npcVisible(n)).map((n) => {
      const beaten = n.beatenPos && st.flags['T:' + n.id], x = beaten ? n.beatenPos[0] : n.x, y = beaten ? n.beatenPos[1] : n.y;
      return { def: n, id: n.id, x, y, dir: n.dir || 'down', sprite: n.sprite, home: [x, y], timer: 1 + Math.random() * 3, move: null, step: 0 };
    });
    // le rival attend au labo tant que le premier combat n'a pas eu lieu
    if (id === 'aube:labo' && !st.flags.rival1) this.npcs.push({ def: { id: 'rival-lab', script: 'rivalLab' }, id: 'rival-lab', x: 8, y: 6, dir: 'left', sprite: 'clerk', home: [8, 6], timer: 99, move: null, step: 0 });
    this.items = m.items.filter((it) => !st.flags['I:' + it.id]).map((it) => ({ ...it }));
    for (const it of this.items) { const a = this.view.actor('item:' + it.id, { kind: 'item' }); this.view.place(a, it.x, it.y - 0.15); }
    this.gateBlock = new Set();
    for (const g of m.gates) if (this.gateOn(g)) for (const [x, y] of g.tiles) this.gateBlock.add(key(x, y));
    this.view.setTimeOfDay(this.hour());
    overlay(this);
    placeLugia(this);
    this.zone = null; this.updateZone();
  }
  /** un garde (ou un sbire) bloque-t-il encore le passage ? */
  gateOn(g) { return this.badgeCount() < (g.badges || 0) || (!!g.until && !this.state.flags[g.until]); }
  npcVisible(n) {
    const f = this.state.flags;
    if (n.gate) return this.gateOn(n.gate);
    if (n.vanish && f['T:' + n.id]) return false;
    if (n.showIf && !f[n.showIf]) return false;
    if (n.hideIf && f[n.hideIf]) return false;
    return true;
  }
  /** modifications durables du terrain (arbres coupés, rochers poussés), rejouées à chaque entrée sur la carte */
  applyTiles(m) {
    if (m._orig) for (const [k, v] of m._orig) { const [x, y] = k.split(',').map(Number); m.set(x, y, v); }
    m._orig = new Map();
    const t = this.state.tiles?.[m.id]; if (!t) return;
    for (const [k, v] of Object.entries(t)) { const [x, y] = k.split(',').map(Number); m._orig.set(k, m.get(x, y)); m.set(x, y, v); }
  }
  setTile(x, y, v) {
    const m = this.mapObj, st = this.state, k = key(x, y);
    st.tiles = st.tiles || {}; (st.tiles[m.id] = st.tiles[m.id] || {})[k] = v;
    if (!m._orig) m._orig = new Map();
    if (!m._orig.has(k)) m._orig.set(k, m.get(x, y));
    m.set(x, y, v);
    this.view.refreshTiles([[x, y]]);
  }
  badgeCount() { return this.state.badges.filter(Boolean).length; }
  worldPos() {
    if (this.mapObj.id === 'monde') return { x: this.player.x, y: this.player.y };
    const o = this.mapObj.outside || this.state.lastOutdoor; return o ? { x: o.x, y: o.y } : { x: 0, y: 0 };
  }
  locationName() { const z = this.mapObj.outdoor ? this.mapObj.zoneAt(this.player.x, this.player.y) : null; return z?.name || this.mapObj.name || 'Odyssée'; }

  updateZone() {
    const m = this.mapObj, p = this.player;
    const z = m.outdoor ? m.zoneAt(p.x, p.y) : (m.zones.length && m.zoneAt(p.x, p.y)) || { name: m.name, music: m.music };
    const name = z?.name || m.name;
    // bandeau du lieu : en extérieur et dans les grottes (pas en sortant d'une maison)
    if ((m.outdoor || m.floor === 'cave') && name !== this.zoneName) { this.zoneName = name; this.ui.banner(name); }
    if (z?.town && !this.state.visited.includes(z.town)) this.state.visited.push(z.town);
    if (!this.musicLock) this.sound.play((z && z.music) || m.music);
    this.zone = z;
  }

  async warp(to, sfx = 'door') {
    this.busy = true;
    this.sound.sfx(sfx);
    await this.ui.fade(true, 220);
    if (this.mapObj.id === 'monde' && to.map !== 'monde') this.state.lastOutdoor = { x: this.player.x, y: this.player.y + 1, map: 'monde' };
    this.player.x = to.x; this.player.y = to.y; this.player.dir = to.dir || this.player.dir; this.player.move = null;
    this.setMap(to.map);
    this.view.update(0, this.player.x, this.player.y);
    this.save(true);
    await this.ui.fade(false, 220);
    if (this.mapObj.dark && this.state.bag.hm05 && this.lead()) await this.ui.say(`${monName(this.lead())} utilise Flash !\nLa grotte s'éclaire.`);
    this.busy = false;
  }

  /* ================= boucle ================= */
  tick(dt) {
    const st = this.state; if (!st) return;
    st.time += dt;
    const p = this.player;
    // déplacement du joueur
    if (p.move) {
      p.move.t += dt / p.move.dur;
      if (p.move.t >= 1) { const mv = p.move; p.x = mv.tx; p.y = mv.ty; p.move = null; p.step++; if (!mv.scripted) this.onStep(mv); }
    }
    if (p.turnLock > 0) p.turnLock -= dt;
    if (p.bumpT > 0) p.bumpT -= dt;
    if (!p.move && !this.busy && this.input.free) {
      const tap = this.input.takeTap();
      const d = this.input.dir() || tap;
      if (d) {
        if (p.dir !== d && !p.walking) { p.dir = d; p.turnLock = 0.1; }
        else if (p.turnLock <= 0 || (tap && !this.input.dir())) this.tryStep(d);
      } else p.walking = false;
    }
    // PNJ et autres joueurs
    for (const n of this.npcs) this.npcTick(n, dt);
    this.peersTick(dt);
    // la carte n'est pas redessinée sous un combat ou un écran plein cadre
    if (this.bv.alive || this.ui.root.querySelector('.screen')) { this.drawTags(false); return; }
    this.draw(dt);
  }

  draw(dt) {
    const p = this.player, v = this.view;
    let px = p.x, py = p.y, hop = 0, stepFrame = 0;
    if (p.move) {
      const u = Math.min(1, p.move.t);
      px = p.move.fx + (p.move.tx - p.move.fx) * u; py = p.move.fy + (p.move.ty - p.move.fy) * u;
      if (p.move.jump) hop = Math.sin(u * Math.PI) * 0.55;
      stepFrame = u < 0.5 ? (p.step % 2 ? 1 : 2) : 0;
    } else if (p.bumpT > 0) stepFrame = p.bumpT > 0.15 ? (p.step % 2 ? 1 : 2) : 0;
    const a = v.actor('player', {});
    v.setFrame(a, this.state.gender === 'f' ? 'green' : 'red', p.dir, stepFrame);
    const t = this.mapObj.get(Math.round(px), Math.round(py));
    if (this.surfing) {
      // sur le dos de son Pokémon, qui tangue doucement
      const bob = Math.sin(performance.now() / 260) * 0.04;
      if (this.surfImg) { const s = v.actors.get('surf') || v.imageActor('surf', this.surfImg, 40, 30); s.mesh.position.set(px + 0.5, -0.1 + bob, py + 0.45); s.shadow.visible = false; }
      v.place(a, px, py, 0.3 + bob, true);
    } else { if (v.actors.has('surf')) v.removeActor('surf'); v.place(a, px, py, hop, isGrassEnc(t) && !p.move); }
    const lg = v.actors.get('lugia'); if (lg) lg.mesh.position.y = lg.base + Math.sin(performance.now() / 700) * 0.12;
    for (const n of this.npcs) {
      let nx = n.x, ny = n.y, sf = 0;
      if (n.move) { const u = Math.min(1, n.move.t); nx = n.move.fx + (n.x - n.move.fx) * u; ny = n.move.fy + (n.y - n.move.fy) * u; sf = u < 0.5 ? (n.step % 2 ? 1 : 2) : 0; }
      const na = v.actor('npc:' + n.id, {});
      v.setFrame(na, n.sprite, n.dir, sf); v.place(na, nx, ny, 0, isGrassEnc(this.mapObj.get(n.x, n.y)) && !n.move);
      if (n.bang) { const b = v.actor('bang:' + n.id, { kind: 'bang' }); b.mesh.position.set(nx + 0.5, 34 * HPX, ny + 0.56); }
      else if (v.actors.has('bang:' + n.id)) v.removeActor('bang:' + n.id);
    }
    this.drawPeers();
    v.update(dt, px, py);
    v.render();
    this.drawTags(true);
  }

  occupied(x, y, except) {
    if (this.player && this.player.x === x && this.player.y === y && except !== this.player) return true;
    for (const n of this.npcs) if (n !== except && ((n.x === x && n.y === y) || (n.move && n.move.fx === x && n.move.fy === y))) return true;
    for (const it of this.items) if (it.x === x && it.y === y) return true;
    return this.gateBlock.has(key(x, y));
  }

  tryStep(d) {
    const p = this.player, m = this.mapObj, [dx, dy] = DIRS[d];
    p.dir = d;
    const tx = p.x + dx, ty = p.y + dy, t = m.get(tx, ty);
    // sortie par le tapis
    if (m.get(p.x, p.y) === T.MAT && d === 'down') { const w = m.warpAt(p.x, p.y); if (w) { this.warp(w, 'exit'); return; } }
    const run = this.input.isDown('run');
    if (this.surfing) {
      const ok = !this.occupied(tx, ty) && m.in(tx, ty) && ((t === T.WATER && this.surfAt(tx, ty)) || (walkable(t) && t !== T.DOOR));
      if (ok) { p.move = { fx: p.x, fy: p.y, tx, ty, t: 0, dur: run ? RUN : WALK * 0.9 }; p.walking = true; return; }
      p.walking = false; if (p.bumpT <= 0) { this.sound.sfx('bump'); p.bumpT = 0.3; }
      return;
    }
    // Force : pousser un rocher
    if (t === T.BOULDER && this.strengthOn === m.id) {
      const bx = tx + dx, by = ty + dy, bt = m.get(bx, by);
      if (walkable(bt) && bt !== T.DOOR && bt !== T.MAT && bt !== T.CAVEDOOR && !this.occupied(bx, by) && !m.warpAt(bx, by)) {
        this.setTile(tx, ty, m.outdoor ? T.GRASS : T.CAVE); this.setTile(bx, by, T.BOULDER);
        this.sound.sfx('ledge'); this.view.shake = 0.08; p.bumpT = 0.3; p.walking = false;
        return;
      }
    }
    // rebords
    if ((t === T.LEDGE && d === 'down') || (t === T.LEDGE_E && d === 'right') || (t === T.LEDGE_W && d === 'left')) {
      const lx = tx + dx, ly = ty + dy;
      if (walkable(m.get(lx, ly)) && !this.occupied(lx, ly)) { p.move = { fx: p.x, fy: p.y, tx: lx, ty: ly, t: 0, dur: 0.42, jump: true }; p.walking = true; this.sound.sfx('ledge'); return; }
    }
    if (m.in(tx, ty) && walkable(t) && !this.occupied(tx, ty) && m.height(tx, ty) === m.height(p.x, p.y)) {
      p.move = { fx: p.x, fy: p.y, tx, ty, t: 0, dur: run ? RUN : WALK }; p.walking = true;
      return;
    }
    if (this.gateBlock.has(key(tx, ty))) { const g = m.gates.find((q) => q.tiles.some(([x, y]) => x === tx && y === ty)); if (g) { const n = this.npcs.find((q) => q.id === g.npc); if (n) { this.talk(n); return; } } }
    // bute contre l'obstacle
    p.walking = false;
    if (p.bumpT <= 0) { this.sound.sfx('bump'); p.bumpT = 0.3; }
  }

  async onStep(mv) {
    const p = this.player, m = this.mapObj, t = m.get(p.x, p.y);
    if (mv.jump) this.view.shake = 0.06;
    if (this.surfing && t !== T.WATER) this.surfing = false;
    if (isGrassEnc(t)) this.view.rustle(p.x, p.y);
    const w = m.warpAt(p.x, p.y);
    if (w && (t === T.DOOR || t === T.CAVEDOOR)) {
      if (w.need && !this.state.bag[w.need]) {
        this.busy = true;
        await this.ui.say(['Une force mystérieuse bloque l\'entrée...', 'Il faudrait un objet lié à ce lieu pour l\'ouvrir.']);
        await this.playerWalk('down', 1); this.busy = false; return;
      }
      await this.warp(w, t === T.CAVEDOOR ? 'exit' : 'door'); return;
    }
    this.updateZone();
    if (this.state.repel > 0) { this.state.repel--; if (this.state.repel === 0) { this.busy = true; await this.ui.say('L\'effet du Repousse s\'est dissipé...'); this.busy = false; } }
    const z = this.zone;
    if (z?.trigger && await this.trigger(z.trigger)) return;
    if (await this.checkTrainers()) return;
    // rencontres sauvages (sur l'eau, en surfant)
    if (this.surfing) { const sz = this.surfAt(p.x, p.y); if (sz?.enc && Math.random() < 0.075) await this.wildBattle(sz.enc); return; }
    const enc = m.outdoor ? z?.enc : m.encounter;
    if (enc && (isGrassEnc(t) || (!m.outdoor && t === T.CAVE))) {
      const rate = isGrassEnc(t) ? (t === T.DARKTALL ? 0.12 : 0.1) : 0.065;
      if (Math.random() < rate) await this.wildBattle(enc);
    }
  }

  /* ================= PNJ ================= */
  npcTick(n, dt) {
    if (n.move) { if (n.move.scripted) return; n.move.t += dt / n.move.dur; if (n.move.t >= 1) { n.move = null; n.step++; } return; }
    if (this.busy || n.def.trainer || n.frozen) return;
    if (n.def.move !== 'wander' && n.def.move !== 'turn') return;
    n.timer -= dt; if (n.timer > 0) return;
    n.timer = 1.5 + Math.random() * 3;
    const dirs = ['up', 'down', 'left', 'right'], d = dirs[Math.floor(Math.random() * 4)];
    n.dir = d;
    if (n.def.move === 'wander' && Math.random() < 0.6) {
      const [dx, dy] = DIRS[d], tx = n.x + dx, ty = n.y + dy;
      if (Math.abs(tx - n.home[0]) <= 2 && Math.abs(ty - n.home[1]) <= 2 && walkable(this.mapObj.get(tx, ty)) && !this.occupied(tx, ty, n) && this.mapObj.get(tx, ty) !== T.DOOR && this.mapObj.get(tx, ty) !== T.MAT) {
        n.move = { fx: n.x, fy: n.y, t: 0, dur: 0.32 }; n.x = tx; n.y = ty;
      }
    }
  }
  /** marche scriptée d'un PNJ (avance elle-même, même si le PNJ n'est plus sur la carte) */
  npcWalk(n, d, steps) {
    return new Promise(async (res) => {
      for (let i = 0; i < steps; i++) {
        const [dx, dy] = DIRS[d]; n.dir = d;
        const mv = { fx: n.x, fy: n.y, t: 0, dur: 0.26, scripted: true }; n.move = mv; n.x += dx; n.y += dy;
        const t0 = performance.now();
        while (mv.t < 1) { await wait(16); mv.t = (performance.now() - t0) / (mv.dur * 1000); }
        n.move = null; n.step++;
      }
      res();
    });
  }
  playerWalk(d, steps) {
    return new Promise(async (res) => {
      const p = this.player;
      for (let i = 0; i < steps; i++) { const [dx, dy] = DIRS[d]; p.dir = d; p.move = { fx: p.x, fy: p.y, tx: p.x + dx, ty: p.y + dy, t: 0, dur: WALK, scripted: true }; while (p.move) await wait(16); }
      res();
    });
  }

  /* ================= touches ================= */
  async onKey(k) {
    if (this.busy || !this.state || this.player.move) return;
    if (k === 'a') await this.interact();
    else if (k === 'b' || k === 'menu') await this.startMenu();
    else if (k === 'map') { this.busy = true; await mapScreen(this); this.busy = false; }
  }
  async interact() {
    const p = this.player, m = this.mapObj, [dx, dy] = DIRS[p.dir];
    let fx = p.x + dx, fy = p.y + dy;
    const peer = this.peerAt(fx, fy);
    if (peer) { this.busy = true; try { await talkToPeer(this, peer); } finally { this.busy = false; } return; }
    let n = this.npcs.find((q) => q.x === fx && q.y === fy && !q.move);
    if (!n && m.get(fx, fy) === T.BLOCK && this.view.decoAt.get(key(fx, fy))?.k === 'counter') n = this.npcs.find((q) => q.x === fx + dx && q.y === fy + dy);
    this.busy = true;
    try {
      if (n) await this.talk(n);
      else if (m.get(fx, fy) === T.SIGN) await this.ui.say(m.signs.get(key(fx, fy)) || '...');
      else {
        const it = this.items.find((q) => q.x === fx && q.y === fy);
        if (it) await this.pickItem(it);
        else {
          const o = m.objectAt(fx, fy);
          const ft = m.get(fx, fy);
          if (o?.type === 'pc') await pcScreen(this);
          else if (o?.type === 'starter') await this.chooseStarter(o.sp);
          else if (o?.type === 'lugia') { if (!this.state.flags.lugiaCaught) { await this.ui.say('Lugia Obscur repose sur l\'autel. Ses yeux sombres s\'ouvrent lentement...'); await lugiaBattle(this); } }
          else if (ft === T.BUSH) await this.useCut(fx, fy);
          else if (ft === T.BOULDER) await this.useStrength();
          else if (ft === T.WATER && m.outdoor && !this.surfing) await this.useSurf();
        }
      }
    } finally { this.busy = false; }
  }
  async talk(n) {
    const was = this.busy; this.busy = true;
    n.dir = OPP[this.player.dir];
    const d = n.def, st = this.state;
    try {
      if (d.trainer) { if (!st.flags['T:' + n.id]) await this.trainerBattle(n, false); else await this.ui.say(d.trainer.after || 'Quel combat !', { speaker: d.speaker || d.trainer.name }); }
      else if (d.role === 'nurse') await this.nurse();
      else if (d.role === 'shop') await shopScreen(this, d.stock);
      else if (d.script && await storyTalk(this, d.script, n)) { /* géré par story.js */ }
      else if (d.script) await this.script(d.script, n);
      else if (d.text) await this.ui.say(d.text);
    } finally { this.busy = was; }
  }
  async pickItem(it) {
    this.sound.sfx('item');
    this.state.bag[it.item] = (this.state.bag[it.item] || 0) + it.qty;
    this.state.flags['I:' + it.id] = true;
    this.items = this.items.filter((q) => q !== it); this.view.removeActor('item:' + it.id);
    await this.ui.say(`${this.state.name} trouve ${it.qty > 1 ? it.qty + ' × ' : ''}${itemName(it.item)} !\nVous rangez l'objet dans le Sac.`);
  }

  /* ================= menu principal ================= */
  async startMenu() {
    this.busy = true;
    const st = this.state;
    const opts = [];
    if (st.flags.dex) opts.push(['POKéDEX', 'dex']);
    if (st.party.length) opts.push(['POKéMON', 'party']);
    opts.push(['SAC', 'bag'], [st.name.toUpperCase(), 'card'], ['CARTE', 'map'], ['SAUVER', 'save'], ['CODE', 'code'], ['OPTIONS', 'opt'], ['FERMER', 'close']);
    let idx = this._menuIdx || 0;
    for (;;) {
      const r = await this.ui.list({ items: opts.map(([l]) => ({ label: l })), cls: 'startmenu', cancel: -1, start: idx, onMove: (i) => { this._menuIdx = i; } });
      if (r < 0 || opts[r][1] === 'close') break;
      idx = r;
      const k = opts[r][1];
      if (k === 'dex') await dexScreen(this);
      else if (k === 'party') await partyScreen(this, { mode: 'menu' });
      else if (k === 'bag') await this.fieldBag();
      else if (k === 'card') await cardScreen(this, BADGES);
      else if (k === 'map') await mapScreen(this);
      else if (k === 'opt') await optionsScreen(this);
      else if (k === 'code') {
        // le code reprend la partie telle qu'elle est maintenant : on sauvegarde d'abord
        this.save(true);
        await saveCodeScreen(this.ui, await encodeSave(this.state), saveSummary(this.state));
      }
      else if (k === 'save') {
        if (await this.ui.yesNo('Sauvegarder la partie ?')) {
          this.save();
          if (!this.cloud?.on) await this.ui.say(`${st.name} a sauvegardé la partie.`);
          else {
            this.ui.say("Envoi de la sauvegarde en ligne…", { keep: true, noWaitLast: true });
            const okOnline = await Promise.race([this.cloud.queue(st, true), wait(12000).then(() => null)]);
            this.ui.closeDialog();
            await this.ui.say(okOnline ? `${st.name} a sauvegardé la partie.\nElle est aussi enregistrée en ligne, sur ton compte du Hub.` : okOnline === null ? `${st.name} a sauvegardé la partie.\nLe serveur se réveille : l'envoi en ligne continue en arrière-plan.` : `${st.name} a sauvegardé la partie sur cet appareil.\nLe serveur en ligne ne répond pas : nouvel essai à la prochaine sauvegarde.`);
          }
        }
        break;
      }
    }
    this.busy = false;
  }
  async fieldBag() {
    for (;;) {
      const r = await bagScreen(this, {}); if (!r) return;
      const it = ITEMS[r.item], st = this.state;
      if (it.ball) { await this.ui.say('Ce n\'est pas le moment d\'utiliser ça !'); continue; }
      if (it.repel) { st.repel = it.repel; this.take(r.item); this.sound.sfx('item'); await this.ui.say(`${st.name} utilise ${itemName(r.item)}.\nLes Pokémon sauvages faibles fuiront pendant ${it.repel} pas.`); return; }
      if (r.item === 'escape-rope') {
        if (this.mapObj.floor === 'cave' && st.lastOutdoor) { this.take(r.item); await this.ui.say(`${st.name} utilise la Corde Sortie !`); await this.warp({ map: 'monde', x: st.lastOutdoor.x, y: st.lastOutdoor.y, dir: 'down' }, 'exit'); return; }
        await this.ui.say('Ce n\'est pas le moment d\'utiliser ça !'); continue;
      }
      const target = await partyScreen(this, { mode: 'pick', prompt: `Utiliser ${itemName(r.item)} sur quel Pokémon ?`, filter: (m) => (canUseOn(r.item, m) ? null : 'Pas d\'effet') });
      if (target < 0) continue;
      const m = st.party[target];
      if (it.stone) { this.take(r.item); await this.evolveScene(m, itemEvolution(m, r.item)); return; }
      if (it.candy) {
        this.take(r.item); const steps = useCandy(m); this.sound.sfx('levelup');
        await this.ui.say(`${monName(m)} monte au niveau ${m.lvl} !`);
        for (const s of steps) { for (const id of s.learned) await this.ui.say(`${monName(m)} apprend ${MOVES[id].n} !`); for (const id of s.ask) await this.askLearn(m, id); }
        const to = levelEvolution(m); if (to) await this.evolveScene(m, to);
        continue;
      }
      let moveIdx = -1;
      if (it.pp) { moveIdx = await this.ui.list({ title: 'Quelle attaque ?', items: m.moves.map((x) => ({ label: MOVES[x.id].n, right: `${x.pp}/${MOVES[x.id].pp}` })), cls: 'psub', cancel: -1 }); if (moveIdx < 0) continue; }
      const msg = applyItem(r.item, m, moveIdx);
      if (msg) { this.take(r.item); this.sound.sfx('heal'); await this.ui.say(msg); }
    }
  }
  take(item, n = 1) { const b = this.state.bag; b[item] = (b[item] || 0) - n; if (b[item] <= 0) delete b[item]; }

  /* ================= combats ================= */
  markSeen(sp) { if (!this.state.dex.seen.includes(sp)) this.state.dex.seen.push(sp); }
  markCaught(sp) { this.markSeen(sp); if (!this.state.dex.caught.includes(sp)) this.state.dex.caught.push(sp); }
  lead() { return this.state.party.find((m) => m.hp > 0); }

  async encounterIntro(kind) {
    this.sound.sfx('encounter');
    this.sound.play(kind);
    await this.ui.flash(3, '#ffffff', 70);
    // rideau qui se referme, comme un passage en combat
    const c = el('div', 'wipe'); this.ui.root.appendChild(c);
    await wait(30); c.classList.add('on'); await wait(450);
    return c;
  }

  async wildBattle(enc) {
    const tot = enc.reduce((a, e) => a + e[3], 0); let r = Math.random() * tot, e = enc[0];
    for (const x of enc) { r -= x[3]; if (r <= 0) { e = x; break; } }
    const lvl = e[1] + Math.floor(Math.random() * (e[2] - e[1] + 1));
    const lead = this.lead(); if (!lead) return;
    if (this.state.repel > 0 && lead.lvl >= lvl) return;
    this.busy = true;
    const wild = createMon(e[0], lvl, { met: this.locationName() });
    const res = await this.runBattle({ wild });
    this.busy = false;
    return res;
  }

  async trainerBattle(n, spotted) {
    const d = n.def, tr = d.trainer, st = this.state;
    this.busy = true;
    const music = d.music || (d.leader != null ? 'leader' : d.champion ? 'champion' : d.rival ? 'rival' : 'trainer');
    if (spotted) {
      this.musicLock = true; this.sound.play(music === 'trainer' ? 'trainer' : music);
      n.bang = true; this.sound.sfx('bang'); await wait(650); n.bang = false;
      // le dresseur s'approche
      const p = this.player; const [dx, dy] = DIRS[n.dir];
      let steps = Math.abs(p.x - n.x) + Math.abs(p.y - n.y) - 1;
      if (steps > 0) await this.npcWalk(n, n.dir, steps);
      p.dir = OPP[n.dir]; void dx; void dy;
    }
    this.musicLock = true; this.sound.play(music);
    await this.ui.say(tr.intro, { speaker: d.speaker || tr.name });
    const party = tr.team.map(([sp, lvl]) => createMon(sp, lvl, { iv: Array(6).fill(Math.min(31, 8 + lvl / 2 | 0)) }));
    const res = await this.runBattle({ trainer: { ...tr, items: { ...(tr.items || {}) } }, party, music, id: n.id, leader: d.leader, champion: d.champion, rival: d.rival });
    this.musicLock = false;
    if (res === 'win') {
      st.flags['T:' + n.id] = true;
      if (d.leader != null) {
        st.badges[d.leader] = true;
        this.sound.sfx('badge');
        await this.ui.say(`${st.name} reçoit le ${BADGES[d.leader].name} de la part de ${tr.name} !`);
        await this.ui.say([`Avec ce badge, tu prouves ta valeur de dresseur.`, `Les gardes de la région te laisseront désormais passer.`], { speaker: tr.name });
        this.refreshGates();
      }
      if (d.beatenPos) { await this.npcWalk(n, 'right', d.beatenPos[0] - n.x); n.dir = 'down'; n.home = [n.x, n.y]; }
      if (d.vanish) { await this.ui.fade(true, 200); this.npcs = this.npcs.filter((q) => q !== n); this.view.removeActor('npc:' + n.id); await this.ui.fade(false, 200); }
      if (d.winScript) await storyWin(this, d.winScript, n);
      this.refreshNpcs();
      if (d.champion) await this.ending();
    }
    this.updateZone();
    this.busy = false;
    return res;
  }
  refreshGates() { this.refreshNpcs(); }
  /** les gardes s'écartent, les sbires vaincus s'en vont, les PNJ liés à l'histoire apparaissent ou disparaissent */
  refreshNpcs() {
    const m = this.mapObj;
    this.gateBlock = new Set();
    for (const g of m.gates) if (this.gateOn(g)) for (const [x, y] of g.tiles) this.gateBlock.add(key(x, y));
    this.npcs = this.npcs.filter((n) => { if (n.def.id && m.npcs.includes(n.def) && !this.npcVisible(n.def)) { this.view.removeActor('npc:' + n.id); return false; } return true; });
    overlay(this);
  }

  /* ================= CS sur le terrain ================= */
  surfAt(x, y) { const m = this.mapObj; if (!m.outdoor || m.get(x, y) !== T.WATER) return null; return (m.surf || []).find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1) || null; }
  async useCut(x, y) {
    const lead = this.lead();
    if (!this.state.bag.hm01 || !lead) { await this.ui.say('Ce petit arbre a l\'air de pouvoir être coupé...'); return; }
    if (!(await this.ui.yesNo('Ce petit arbre peut être coupé. Utiliser Coupe ?'))) return;
    this.sound.sfx('hit');
    await this.ui.say(`${monName(lead)} utilise Coupe !`);
    this.setTile(x, y, T.GRASS); this.view.rustle(x, y);
  }
  async useStrength() {
    const lead = this.lead();
    if (!this.state.bag.hm04 || !lead) { await this.ui.say('C\'est un gros rocher. Un Pokémon très costaud pourrait le pousser.'); return; }
    if (this.strengthOn === this.mapObj.id) { await this.ui.say('Force est active : marche contre le rocher pour le pousser.'); return; }
    if (!(await this.ui.yesNo('Un gros rocher bloque le passage. Utiliser Force ?'))) return;
    this.strengthOn = this.mapObj.id; this.sound.sfx('ledge');
    await this.ui.say(`${monName(lead)} utilise Force !\nIl peut désormais pousser les rochers.`);
  }
  async useSurf() {
    const p = this.player, [dx, dy] = DIRS[p.dir];
    if (!this.surfAt(p.x + dx, p.y + dy)) { await this.ui.say('L\'eau est d\'un bleu profond...'); return; }
    if (!this.state.bag.hm03 || !this.lead()) { await this.ui.say('L\'eau est calme et d\'un bleu profond... Un Pokémon pourrait te porter dessus.'); return; }
    if (this.occupied(p.x + dx, p.y + dy)) return;
    if (!(await this.ui.yesNo('L\'eau est calme. Utiliser Surf ?'))) return;
    await this.ui.say(`${monName(this.lead())} utilise Surf !`);
    await this.startSurf(true);
  }
  async startSurf(walk) {
    const lead = this.lead(); if (!lead) return;
    const img = await loadImg(ASSETS.icon(lead.sp));
    const c = document.createElement('canvas'); c.width = 40; c.height = 30;
    if (img) c.getContext('2d').drawImage(img, 0, 0, 40, 30); else { const x = c.getContext('2d'); x.fillStyle = '#4a80d0'; x.beginPath(); x.ellipse(20, 22, 16, 7, 0, 0, 7); x.fill(); }
    this.view.removeActor('surf'); this.surfImg = c;
    this.surfing = true; this.sound.sfx('ledge');
    if (walk) await this.playerWalk(this.player.dir, 1);
  }

  async checkTrainers() {
    const p = this.player, m = this.mapObj;
    for (const n of this.npcs) {
      const tr = n.def.trainer; if (!tr || !tr.sight || this.state.flags['T:' + n.id]) continue;
      const [dx, dy] = DIRS[n.dir];
      for (let k = 1; k <= tr.sight; k++) {
        const x = n.x + dx * k, y = n.y + dy * k;
        if (x === p.x && y === p.y) { await this.trainerBattle(n, true); return true; }
        if (!walkable(m.get(x, y)) || this.npcs.some((q) => q !== n && q.x === x && q.y === y)) break;
      }
    }
    return false;
  }

  /** combat générique ; o.wild (mon) ou o.trainer + o.party */
  async runBattle(o) {
    const st = this.state;
    const kind = o.music || (o.wild ? 'wild' : 'trainer');
    const curtain = await this.encounterIntro(kind);
    const m = this.mapObj, z = this.zone;
    const bg = !m.outdoor ? (m.floor === 'cave' ? 'cave' : m.battleBg) : z?.theme === 'volcanic' ? 'volcanic' : z?.route === 'r8' || z?.town === 'azur' ? 'water' : 'grass';
    const battle = new Battle({ player: { name: st.name, party: st.party, bag: st.bag }, foe: o.wild ? { name: 'sauvage', party: [o.wild] } : { name: o.trainer.name, party: o.party, trainer: o.trainer } });
    const foeMons = o.wild ? [o.wild] : o.party;
    const h = this.hour();
    curtain.remove();
    const result = await this.bv.run(battle, { bg, night: m.outdoor && (h >= 20 || h < 5.5) });
    // argent
    if (result === 'win' && battle.prizeMoney) st.money += battle.prizeMoney;
    if (result === 'caught') {
      const mon = foeMons[0]; mon.ot = st.name; mon.met = this.locationName();
      const isNew = !st.dex.caught.includes(mon.sp);
      this.markCaught(mon.sp);
      if (isNew) await this.bv.msg(`Les données de ${SPECIES[mon.sp].n} ont été ajoutées au Pokédex !`, { wait: true });
      this.bv.close();
      if (await this.ui.yesNo(`Donner un surnom à ${SPECIES[mon.sp].n} ?`)) { const nick = await this.ui.nameEntry(`Surnom de ${SPECIES[mon.sp].n}`, SPECIES[mon.sp].n); if (nick && nick !== SPECIES[mon.sp].n) mon.nick = nick; }
      mon.status = mon.status === 'frz' ? null : mon.status;
      if (st.party.length < 6) st.party.push(mon);
      else { st.box.push(mon); await this.ui.say(`${monName(mon)} a été envoyé dans le PC.`); }
    } else this.bv.close();
    this.sound.stopMusic(0.1);
    // évolutions après le combat
    if (result !== 'lose') for (const mon of st.party) if (battle.levelUps.has(mon.uid) && mon.hp > 0) { const to = levelEvolution(mon); if (to) await this.evolveScene(mon, to); }
    if (result === 'lose' && o.noWhiteout) for (const mon of st.party) healFull(mon);
    else if (result === 'lose') await this.whiteout();
    this.sound.current = null;
    this.updateZone();
    return result;
  }

  async whiteout() {
    const st = this.state;
    const lost = Math.min(st.money, Math.floor(st.money / 2));
    st.money -= lost;
    await this.ui.fade(true, 400);
    for (const m of st.party) healFull(m);
    const c = st.lastCenter;
    this.player.x = c.x; this.player.y = c.y; this.player.dir = c.dir || 'up';
    this.setMap(c.map);
    this.view.update(0, this.player.x, this.player.y); this.view.render();
    await this.ui.fade(false, 400);
    await this.ui.say([`${st.name} a perdu ${lost.toLocaleString('fr-FR')} ₽ dans la panique...`, '... ... ...', `${st.name} reprend ses esprits. Ses Pokémon ont été soignés.`]);
  }

  async askLearn(m, moveId) {
    const mv = MOVES[moveId], name = monName(m);
    for (;;) {
      await this.ui.say([`${name} veut apprendre ${mv.n}.`, `Mais ${name} connaît déjà quatre attaques.`], { keep: true });
      if (await this.ui.yesNo(`Oublier une attaque pour apprendre ${mv.n} ?`, { keep: true })) {
        const k = await this.ui.list({ title: `Oublier quelle attaque ?`, items: m.moves.map((x) => ({ label: MOVES[x.id].n, right: `PP ${x.pp}/${MOVES[x.id].pp}` })).concat([{ label: mv.n + ' (nouvelle)' }]), cls: 'psub learn', cancel: 4 });
        if (k >= 0 && k < 4) {
          const old = MOVES[m.moves[k].id].n;
          m.moves[k] = { id: moveId, pp: mv.pp };
          this.sound.sfx('learn');
          await this.ui.say(['1, 2 et... Tadaaa !', `${name} oublie ${old}...`, `Et ${name} apprend ${mv.n} !`]);
          return;
        }
      }
      if (await this.ui.yesNo(`Abandonner l'apprentissage de ${mv.n} ?`, { keep: true })) { await this.ui.say(`${name} n'a pas appris ${mv.n}.`); return; }
    }
  }

  async evolveScene(m, to) {
    if (!to) return;
    const ui = this.ui, oldName = monName(m), fromSp = m.sp;
    const s = el('div', 'screen evo-scr'); s.innerHTML = '<canvas class="evo-cv" width="256" height="192"></canvas>'; ui.root.appendChild(s);
    const cv = s.querySelector('canvas'), x = cv.getContext('2d'); x.imageSmoothingEnabled = false;
    const [a, b] = await Promise.all([loadImg(ASSETS.front(fromSp, m.shiny)), loadImg(ASSETS.front(to, m.shiny))]);
    const white = (img) => { if (!img) return null; const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const q = c.getContext('2d'); q.drawImage(img, 0, 0); q.globalCompositeOperation = 'source-atop'; q.fillStyle = '#fff'; q.fillRect(0, 0, c.width, c.height); return c; };
    const wa = white(a), wb = white(b);
    let mode = 'old', scale = 1, flashA = 0, cancelled = false;
    const drawBg = (t) => { const g = x.createRadialGradient(128, 96, 10, 128, 96, 160); g.addColorStop(0, '#406090'); g.addColorStop(1, '#101830'); x.fillStyle = g; x.fillRect(0, 0, 256, 192); x.fillStyle = 'rgba(255,255,255,0.5)'; for (let i = 0; i < 30; i++) { const ang = i * 0.7 + t * 0.002, r = (t * 0.05 + i * 17) % 140; x.fillRect(128 + Math.cos(ang) * r, 96 + Math.sin(ang) * r * 0.7, 2, 2); } };
    let alive = true; const t0 = performance.now();
    const loop = () => { if (!alive) return; const t = performance.now() - t0; drawBg(t); const img = mode === 'old' ? a : mode === 'new' ? b : mode === 'wa' ? wa : wb; if (img) { const w = 80 * scale * 1.6, h = 80 * scale * 1.6; x.drawImage(img, 128 - w / 2, 120 - h, w, h); } if (flashA > 0) { x.fillStyle = `rgba(255,255,255,${flashA})`; x.fillRect(0, 0, 256, 192); } requestAnimationFrame(loop); };
    loop();
    this.sound.stopMusic(0.2); this.sound.play('evolution');
    await ui.say(`Quoi ? ${oldName} évolue !`, { keep: true });
    this.sound.cry(ASSETS.cry(fromSp));
    const pop = this.input.push((k) => { if (k === 'b') cancelled = true; });
    mode = 'wa'; await wait(500);
    this.sound.sfx('evolve');
    for (let i = 0; i < 14 && !cancelled; i++) { mode = i % 2 ? 'wb' : 'wa'; scale = i % 2 ? 1.05 : 0.95; await wait(Math.max(70, 360 - i * 22)); }
    pop();
    if (cancelled) { mode = 'old'; scale = 1; await ui.say(`Hein ? ${oldName} n'a pas évolué !`); }
    else {
      flashA = 1; mode = 'new'; scale = 1; for (let i = 0; i < 20; i++) { flashA = 1 - i / 20; await wait(30); } flashA = 0;
      const res = evolve(m, to); this.markCaught(to);
      this.sound.cry(ASSETS.cry(to)); this.sound.sfx('levelup');
      await ui.say(`Félicitations ! Votre ${oldName} a évolué en ${SPECIES[to].n} !`);
      for (const id of res.learned) await ui.say(`${monName(m)} apprend ${MOVES[id].n} !`);
      for (const id of res.ask) await this.askLearn(m, id);
    }
    alive = false; s.remove(); this.sound.current = null; this.updateZone();
  }

  async nurse() {
    const ui = this.ui, st = this.state;
    await ui.say('Bienvenue au Centre Pokémon !', { keep: true, speaker: 'Infirmière' });
    if (await ui.yesNo('Voulez-vous que je soigne vos Pokémon ?', { keep: true, speaker: 'Infirmière' })) {
      await ui.say('Très bien. Confiez-moi vos Pokémon quelques instants.', { keep: true, speaker: 'Infirmière' });
      this.sound.sfx('heal'); await wait(2400);
      for (const m of st.party) healFull(m);
      st.lastCenter = { map: this.mapObj.id, x: 6, y: 5, dir: 'up' };
      await ui.say(['Merci d\'avoir attendu.', 'Vos Pokémon sont en pleine forme !'], { keep: true, speaker: 'Infirmière' });
    }
    await ui.say('À bientôt !', { speaker: 'Infirmière' });
  }

  /* ================= histoire ================= */
  async script(name, n) {
    const st = this.state, ui = this.ui;
    if (name === 'mom') {
      if (!st.flags.starter) { await ui.say([`Ah, ${st.name}, tu es enfin réveillé !`, 'Le Professeur Saule est passé ce matin. Il t\'attend à son laboratoire, juste au sud.', 'Théo y est déjà, bien sûr... Allez, file !'], { speaker: 'Maman' }); return; }
      await ui.say(`${st.name} ! Tu as l'air épuisé. Repose-toi un peu.`, { keep: true, speaker: 'Maman' });
      this.sound.sfx('heal'); await wait(2000);
      for (const m of st.party) healFull(m);
      st.lastCenter = { map: 'aube:maison', x: 4, y: 5, dir: 'up' };
      await ui.say(['Voilà, tes Pokémon sont en pleine forme !', 'Je suis fière de toi. Reviens quand tu veux !'], { speaker: 'Maman' });
    } else if (name === 'prof') {
      if (!st.flags.starter) { await ui.say([`Ah, ${st.name} ! Te voilà enfin.`, 'J\'ai trois Pokémon ici, sur la table. Ils n\'attendent qu\'un dresseur.', 'Approche-toi et choisis celui qui te plaît !'], { speaker: 'Prof. Saule' }); return; }
      if (await purify(this)) return;
      if (st.flags.lugia) { await ui.say(['On ne parle que de toi dans toute la région ! Tu as rendu le jour à Odyssée.', st.flags.lugiaCaught ? 'Et Lugia voyage avec toi... Prends-en soin.' : 'Lugia dort de nouveau en paix, au fond du Sanctuaire.'], { speaker: 'Prof. Saule' }); return; }
      if (st.flags.eclipse) { await ui.say(['Cette nuit violette... C\'est l\'œuvre de la Team Éclipse, n\'est-ce pas ?', 'Si Lugia se réveille avec un cœur fermé, la nuit ne finira jamais. Il faut trouver le Sanctuaire des Marées !'], { speaker: 'Prof. Saule' }); return; }
      await ui.say(['Chaque Pokémon que tu rencontreras remplira ton Pokédex.', 'Les huit Champions d\'Arène t\'attendent aux quatre coins de la région.', 'Et au bout du chemin : la Ligue Céleste !', 'Ah, et méfie-toi de la Team Éclipse. Ces gens en noir s\'intéressent beaucoup trop à Lugia.'], { speaker: 'Prof. Saule' });
    } else if (name === 'rivalLab') {
      await ui.say(st.flags.starter ? 'Hé, ne traîne pas !' : ['Yo ! Le prof m\'a fait attendre pour que tu choisisses en premier.', 'Vas-y, prends-en un. Je prendrai le meilleur des deux restants !'], { speaker: RIVAL_NAME });
    } else if (name === 'gymguide') {
      const L = LEADERS[n.def.gym];
      if (st.badges[n.def.gym]) { await ui.say(['Bravo, champion en devenir !', 'Tu as battu ' + L.name + ' ! Continue comme ça !'], { speaker: 'Guide' }); return; }
      await ui.say(['Yo, futur Maître ! Bienvenue dans l\'Arène.', `${L.name} utilise des Pokémon de type ${TYPE_FR[L.type]}.`, `Pour en venir à bout, mise sur ${GYM_HINTS[L.type]} !`], { speaker: 'Guide' });
    }
  }

  async chooseStarter(sp) {
    const st = this.state, ui = this.ui;
    if (st.flags.starter) { await ui.say('C\'est une Poké Ball vide.'); return; }
    const S = SPECIES[sp];
    const pic = el('div', 'box starter-pic', `<img src="${ASSETS.front(sp)}" alt="">`); ui.root.appendChild(pic);
    this.sound.cry(ASSETS.cry(sp));
    const ok = await ui.yesNo(`Tu veux ${S.n}, le Pokémon ${TYPE_FR[S.t[0]]} ?`, { speaker: 'Prof. Saule' });
    pic.remove();
    if (!ok) return;
    const mon = createMon(sp, 5, { ot: st.name, met: 'Bourg-Aube' });
    st.party.push(mon); st.flags.starter = sp; this.markCaught(sp);
    this.sound.sfx('caught');
    await ui.say(`${st.name} reçoit ${S.n} !`);
    if (await ui.yesNo(`Donner un surnom à ${S.n} ?`)) { const nick = await ui.nameEntry(`Surnom de ${S.n}`, S.n); if (nick && nick !== S.n) mon.nick = nick; }
    // le rival choisit le Pokémon qui a l'avantage
    const rs = RIVAL_TEAMS[sp].s[0];
    st.flags.rivalSp = sp;
    const rival = this.npcs.find((q) => q.id === 'rival-lab');
    await ui.say([`Alors je prends celui-là !`, `${SPECIES[rs].n} ! Il a une tête de gagnant, comme moi.`], { speaker: RIVAL_NAME });
    if (rival) rival.dir = 'left';
    await ui.say(['Hé, ' + st.name + ' ! On a nos Pokémon, alors...', 'On se fait un petit combat ? Allez !'], { speaker: RIVAL_NAME });
    const res = await this.runBattle({ trainer: { cls: 'Rival', name: RIVAL_NAME, prize: 30, bs: 'blue', ai: 'normal', lose: 'Quoi ?! J\'aurais dû choisir l\'autre !' }, party: [createMon(rs, 5)], music: 'rival', rival: true, noWhiteout: true });
    for (const m of st.party) healFull(m);
    st.flags.rival1 = true;
    await ui.say(res === 'win' ? 'Pfff... Bon, c\'était juste un échauffement !' : 'Ha ha ! Je suis trop fort ! Mais t\'inquiète, tu t\'améliores déjà.', { speaker: RIVAL_NAME });
    await ui.say(['Bien joué, tous les deux ! Vos Pokémon ont déjà l\'air de vous adorer.', `${st.name}, prends aussi ceci.`], { speaker: 'Prof. Saule' });
    this.sound.sfx('item');
    st.flags.dex = true; st.bag['poke-ball'] = (st.bag['poke-ball'] || 0) + 5; st.bag.potion = (st.bag.potion || 0) + 2;
    await ui.say([`${st.name} reçoit le Pokédex, 5 Poké Balls et 2 Potions !`, 'Le Pokédex enregistre chaque Pokémon que tu vois ou captures.', 'Quand tes Pokémon sont fatigués, reviens voir ta mère ou passe au Centre Pokémon.', 'La première Arène se trouve à Sylvebourg, au nord. Bonne route !'], { speaker: 'Prof. Saule' });
    await ui.say(['Une dernière chose... Une vieille légende raconte que Lugia, le gardien des marées, dort sous la mer, au sud.', 'Ces temps-ci, des gens en uniforme sombre posent beaucoup de questions à son sujet. Sois prudent.'], { speaker: 'Prof. Saule' });
    await ui.say('Je file ! À plus, ' + st.name + ' !', { speaker: RIVAL_NAME });
    if (rival) { await this.npcWalk(rival, 'down', 2); this.npcs = this.npcs.filter((q) => q !== rival); this.view.removeActor('npc:rival-lab'); }
    this.save(true);
  }

  async trigger(name) {
    const st = this.state, p = this.player, ui = this.ui;
    if (await storyTrigger(this, name)) return true;
    if (name === 'needStarter' && !st.flags.starter) {
      this.busy = true;
      await ui.say(['Hé ! Attends !', 'Les hautes herbes sont pleines de Pokémon sauvages. Sans Pokémon, c\'est bien trop dangereux !', 'Va d\'abord voir le Professeur Saule, à son labo.'], { speaker: '???' });
      await this.playerWalk('down', 1);
      this.busy = false; return true;
    }
    const rivalFight = async (flag, team, lvlText, lines, after) => {
      if (st.flags[flag] || !st.flags.rival1) return false;
      this.busy = true; st.flags[flag] = true;
      const sp = st.flags.rivalSp || 155, R = RIVAL_TEAMS[sp].s;
      const rival = { def: { id: 'rival-' + flag }, id: 'rival-' + flag, x: p.x, y: p.y - 4, dir: 'down', sprite: 'clerk', home: [p.x, p.y - 4], timer: 99, move: null, step: 0 };
      if (!walkable(this.mapObj.get(rival.x, rival.y))) rival.y = p.y - 3;
      this.npcs.push(rival);
      this.musicLock = true; this.sound.play('rival');
      p.dir = 'up';
      await this.npcWalk(rival, 'down', Math.max(0, p.y - rival.y - 1));
      await ui.say(lines, { speaker: RIVAL_NAME });
      const party = team(R).map(([s, l]) => createMon(s, l, { iv: Array(6).fill(20) }));
      const res = await this.runBattle({ trainer: { cls: 'Rival', name: RIVAL_NAME, prize: 40, bs: 'blue', ai: 'smart', items: { 'super-potion': 1 }, lose: lvlText }, party, music: 'rival', rival: true });
      this.musicLock = false;
      if (res !== 'lose') await ui.say(after, { speaker: RIVAL_NAME });
      await this.npcWalk(rival, 'up', 4);
      this.npcs = this.npcs.filter((q) => q !== rival); this.view.removeActor('npc:' + rival.id);
      this.updateZone();
      this.busy = false; return true;
    };
    if (name === 'rival2') return rivalFight('rival2', (R) => [[16, 11], [R[0], 13]], 'Grr... Tu as eu de la chance !', [`${st.name} ! Tu as déjà ton premier badge ?`, 'Moi aussi, évidemment. Voyons qui a le plus progressé !'], ['Je vais m\'entraîner dans le Bois Murmure.', 'La prochaine fois, je ne perdrai pas !']);
    if (name === 'rival3') return rivalFight('rival3', (R) => [[17, 27], [93, 26], [64, 26], [R[1], 29]], 'Encore ?! Tes Pokémon sont devenus sacrément forts...', ['Tiens, tiens... Le grand voyageur !', 'Floralia, c\'est ma ville porte-bonheur. Prépare-toi !'], ['Flora t\'attend à l\'Arène. Moi, je file vers l\'est.', 'On se retrouvera tout en haut, à la Ligue !']);
    if (name === 'rival4') return rivalFight('rival4', (R) => [[18, 44], [94, 44], [65, 45], [130, 45], [R[2], 47]], 'Incroyable... Tu mérites d\'aller jusqu\'au bout.', [`${st.name}... Je savais que tu viendrais.`, 'Avant la Ligue, il y a moi. Donne tout ce que tu as !'], ['Va. La Maître de la Ligue t\'attend.', 'Et bats-la, sinon c\'est moi qui m\'en chargerai !']);
    return false;
  }

  async ending() {
    const st = this.state, ui = this.ui;
    st.flags.champion = true;
    this.sound.play('victory');
    await ui.say(['Félicitations !', `${st.name}, tu es le nouveau Maître de la Ligue Céleste !`, 'Ton équipe et toi entrez au Panthéon des dresseurs.'], { speaker: 'Célestine' });
    const s = el('div', 'screen hof-scr'); s.innerHTML = `<div class="scr-title">PANTHÉON</div><div class="hof">${st.party.map((m) => `<div class="hof-m box"><img src="${ASSETS.front(m.sp, m.shiny)}" alt=""><div>${esc(monName(m))}</div><div>N.${m.lvl}</div></div>`).join('')}</div><div class="box hof-txt">${esc(st.name)} — Maître de la Ligue · ${st.dex.caught.length} Pokémon capturés<br>Merci d'avoir joué à Odyssée !</div>`;
    ui.root.appendChild(s);
    await new Promise((res) => { const pop = this.input.push((k) => { if (k === 'a' || k === 'b') { pop(); res(); } }); });
    s.remove();
    for (const m of st.party) healFull(m);
    const out = this.world.maps['plateau:ligue'].outside;
    if (out) await this.warp({ map: 'monde', x: out.x, y: out.y, dir: 'down' });
    this.save(true);
  }
}
