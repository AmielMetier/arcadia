// Interface de Bastion Clash (navigateur uniquement).
// Caméra sur le QG, messages, signaux de minimap et effets visuels des événements.
'use strict';

function centerOnMyHq() {
  if (!state) return;
  const hq = state.buildings.find((b) => b.owner === myId && b.kind === 'hq');
  if (hq) { cam.x = hq.x; cam.y = hq.y; }
}

let toastTimer = 0;
function toast(msg, ms = 2400) {
  const el = $('#uiToast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, ms);
}

// Fil d'alertes à gauche de l'écran (les erreurs restent dans le toast central)
let lastSaturatedMsg = 0;
let lastDepletedMsg = 0;
function notify(msg, type = 'info', ms = 4200) {
  const box = $('#uiAlerts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `alert ${type}`;
  el.textContent = msg;
  box.prepend(el);
  while (box.children.length > 5) box.lastChild.remove();
  setTimeout(() => el.classList.add('fade'), ms);
  setTimeout(() => el.remove(), ms + 450);
}

// Signaux affichés sur la minimap (ordres, alertes, détections)
let miniPings = [];
function addMiniPing(x, y, color = '#3ddc84', life = 1.2, big = false) {
  miniPings.push({ x, y, color, life, maxLife: life, big });
  if (miniPings.length > 24) miniPings.shift();
}

function handleFxEvents(list) {
  if (!Array.isArray(list)) return;
  for (const e of list) {
    if (e.k === 'SHOT' || e.k === 'ROCKET' || e.k === 'PLASMA') {
      const isPlasma = e.k === 'PLASMA', isRocket = e.k === 'ROCKET';
      projectiles.push({
        x: e.x1, y: e.y1, tx: e.x2, ty: e.y2,
        prog: 0, speed: isPlasma ? 4.8 : isRocket ? 5.5 : 9.0,
        color: isPlasma ? '#1fc7c1' : isRocket ? '#ff4b2b' : pc(e.color || '#ffc531'),
        r: isPlasma ? 6 : isRocket ? 5 : 3.2,
      });
      const dCam = hypot(e.x1, e.y1, cam.x, cam.y);
      if (dCam < 1300) Sfx.combat();
      if (dCam < 760 && Sfx.canShoot()) {
        if (isPlasma) Sfx.plasma(); else Sfx.shoot();
      }
    } else if (e.k === 'TESLA') {
      beams.push({ x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, color: '#1fc7c1', w: 4.5, life: 0.22, maxLife: 0.22, tesla: true });
      shockwaves.push({ x: e.x2, y: e.y2, r: 8, maxR: 48, color: '#1fc7c1', life: 0.22, maxLife: 0.22 });
      if (hypot(e.x2, e.y2, cam.x, cam.y) < 750) Sfx.plasma();
    } else if (e.k === 'MINE' || e.k === 'SPARK') {
      const a = Math.random() * TAU;
      particles.push({
        x: e.x, y: e.y, vx: Math.cos(a) * 35, vy: Math.sin(a) * 35,
        r: 2.8, color: pc(e.color || '#1fc7c1'), life: 0.18,
      });
      if (hypot(e.x, e.y, cam.x, cam.y) < 700) Sfx.mine();
    } else if (e.k === 'STIM') {
      shockwaves.push({ x: e.x, y: e.y, r: 4, maxR: 26, color: '#ff4b2b', life: 0.22, maxLife: 0.22 });
      if (hypot(e.x, e.y, cam.x, cam.y) < 750) Sfx.stim();
    } else if (e.k === 'SIEGE') {
      shockwaves.push({ x: e.x, y: e.y, r: 6, maxR: 32, color: '#ffc531', life: 0.25, maxLife: 0.25 });
      if (hypot(e.x, e.y, cam.x, cam.y) < 800) Sfx.siege();
    } else if (e.k === 'SCAN') {
      shockwaves.push({ x: e.x, y: e.y, r: 20, maxR: e.r || 380, color: '#1fc7c1', life: 0.55, maxLife: 0.55 });
      Sfx.scan();
    } else if (e.k === 'BOOM' || e.k === 'BOOM_BIG') {
      const big = e.k === 'BOOM_BIG';
      const cnt = Math.round((big ? 24 : 10) * gfxPreset().particles);
      flash3D(e.x, e.y, big ? '#ffb347' : '#ff7a3d', big ? 1.4 : 0.6);
      shockwaves.push({ x: e.x, y: e.y, r: 10, maxR: big ? 95 : 42, color: big ? '#ffc531' : '#ff4b2b', life: big ? 0.38 : 0.22, maxLife: big ? 0.38 : 0.22 });
      if (big) {
        craters.push({ x: e.x, y: e.y, r: e.r * 0.78 });
        if (craters.length > 45) craters.shift();
      }
      if (hypot(e.x, e.y, cam.x, cam.y) < 1100) {
        if (big && GFX.shake) cam.shake = Math.max(cam.shake, 12);
        if (big || Sfx.canBoom()) Sfx.boom(big);
        Sfx.combat();
      }
      for (let k = 0; k < cnt; k++) {
        const a = Math.random() * TAU, sp = (big ? 55 : 28) + Math.random() * (big ? 165 : 80);
        particles.push({
          x: e.x, y: e.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          r: (big ? 6 : 3.5) + Math.random() * 4,
          color: k % 3 === 0 ? '#fff8ea' : k % 2 === 0 ? '#ff4b2b' : '#ffc531',
          life: (big ? 0.45 : 0.26) + Math.random() * 0.15,
        });
      }
    } else if (e.k === 'BUILD' || e.k === 'SPAWN' || e.k === 'COMPLETE') {
      shockwaves.push({ x: e.x, y: e.y, r: 10, maxR: 52, color: pc(e.color || '#ffc531'), life: 0.28, maxLife: 0.28 });
      if (e.k === 'COMPLETE' && Number(e.owner) === Number(myId)) {
        const bd = BUILDINGS[e.kind];
        const fem = ['extractor', 'barracks', 'factory', 'tesla', 'armory', 'radar'].includes(e.kind);
        if (bd) { notify(`✅ ${bd.name} ${fem ? 'terminée' : 'terminé'}`, 'good'); Sfx.done(); }
        addMiniPing(e.x, e.y, '#3ddc84');
      } else if (e.k === 'COMPLETE' && hypot(e.x, e.y, cam.x, cam.y) < 850) Sfx.spawn();
    } else if (e.k === 'UPGRADE_DONE') {
      if (Number(e.ownerId) === Number(myId)) { notify(`🔬 Recherche terminée : ${e.name}`, 'good'); Sfx.done(); }
    } else if (e.k === 'DEPLETED' || e.k === 'GAS_DEPLETED') {
      if (Number(e.owner) === Number(myId)) {
        const now = performance.now();
        if (now - (lastDepletedMsg || 0) > 8000) {
          lastDepletedMsg = now;
          notify(e.k === 'DEPLETED' ? '⛏️ Un cristal est épuisé : pense à t’étendre vers une autre base.' : '🧪 Un geyser est épuisé : la Raffinerie ne donne plus qu’un peu de gaz.', 'warn', 5000);
        }
        addMiniPing(e.x, e.y, '#ffc531', 1.2, false);
      }
    } else if (e.k === 'SATURATED') {
      if (Number(e.owner) === Number(myId) && performance.now() - lastSaturatedMsg > 7000) {
        lastSaturatedMsg = performance.now();
        notify('⛏️ Gisements saturés : un VCS attend. Construis un nouveau QG près d’autres cristaux.', 'info');
      }
    } else if (e.k === 'AFK') {
      notify(`🔌 ${e.name} est parti : un bot garde sa base en attendant son retour.`, 'warn', 6000);
    } else if (e.k === 'BACK') {
      notify(`✅ ${e.name} est de retour et reprend sa base.`, 'good', 4200);
    } else if (e.k === 'HOST_CHANGE') {
      notify(`🛰️ L’hôte est parti : ${e.name} reprend la partie.`, 'info', 5000);
    } else if (e.k === 'ELIM') {
      notify(`💥 ${e.name} est éliminé !`, 'warn');
      if (Number(e.playerId) === Number(myId)) {
        toast('💀 Tu es éliminé : tu suis la fin de la partie en spectateur (toute la carte est visible).', 5200);
        selectedUnits.clear(); selectedBlds.clear(); buildMode = null; orderCursor = null;
        renderConsoleUI(true);
      }
      Sfx.alert();
    } else if (e.k === 'TEAM_CHANGE') {
      if (!e.silent) toast(`🛡️ ${e.name} a rejoint l’Équipe ${e.team === 0 ? 'A' : 'B'}${e.partnerId != null ? ' — bases échangées pour rester à côté de ton allié' : ''} !`, 3200);
      if (Number(e.playerId) === Number(myId) || Number(e.partnerId) === Number(myId)) {
        exploredGrid.fill(0);
        lastFogUpdate = 0;
        setTimeout(centerOnMyHq, 30);
      }
    } else if (e.k === 'PHASE') {
      const labels = {
        2: '💎 Phase 2 : Intensification des combats',
        3: '🤖 Phase 3 : Guerre Totale (Dégâts +20 %)',
        4: '🔥 MORT SUBITE : Tempête Magnétique & Dégâts ×1.85 !',
      };
      if (labels[e.phase]) toast(labels[e.phase], 3800);
    }
  }
}
