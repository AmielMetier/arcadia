/* Sons d'interface communs à Arcadia (boutons, menus, lancement d'un jeu).
   Bruitages « Interface Sounds » de Kenney (kenney.nl), licence CC0 : assets/sfx/LICENSE-kenney.txt.
   Volume : le curseur « Effets » des réglages (DDVolume), à 0 plus rien.

   API : DDSfx.play(nom, volume?)   nom = click | confirm | open | close | back | toggle | drop | go | error | select */
(function () {
  if (window.DDSfx) return;
  const cur = document.currentScript && document.currentScript.src;
  const BASE = cur ? cur.replace(/shared\/uisfx\.js(?:\?.*)?$/, 'assets/sfx/') : 'assets/sfx/';
  const NAMES = ['click', 'confirm', 'open', 'close', 'back', 'toggle', 'drop', 'go', 'error', 'select'];
  let ctx = null; const bufs = {};
  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC();
    for (const n of NAMES) fetch(BASE + n + '.mp3').then((r) => r.arrayBuffer()).then((a) => ctx.decodeAudioData(a)).then((b) => { bufs[n] = b; }).catch(() => {});
  }
  // le navigateur n'autorise le son qu'après un geste : on prépare tout au premier clic ou à la première touche
  const arm = () => { ensure(); removeEventListener('pointerdown', arm, true); removeEventListener('keydown', arm, true); };
  addEventListener('pointerdown', arm, true); addEventListener('keydown', arm, true);
  function level() { try { return window.DDVolume ? window.DDVolume.get('fx') : 1; } catch (e) { return 1; } }
  window.DDSfx = {
    play(name, vol = 0.5) {
      ensure(); const b = bufs[name], L = level() * vol; if (!ctx || !b || L <= 0) return;
      const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = L; s.connect(g); g.connect(ctx.destination); s.start();
    },
  };
})();
