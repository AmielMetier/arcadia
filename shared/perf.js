/* Arcadia — résolution d'affichage adaptée à chaque PC, commune aux jeux.

   1. Un budget de pixels : sur un grand écran (1440p, 4K) ou un portable zoomé à 150 %, le jeu ne calcule pas plus
      de ~3,2 millions de pixels par image (une image 1080p en fait 2). Au-delà, la différence ne se voit pas mais la
      carte graphique d'un portable s'écroule.
   2. Un régulateur : on mesure l'écart entre deux images. Si le jeu passe sous ~45 images/s pendant 2 s, la résolution
      baisse d'un cran (jusqu'à 0,75 pixel par point) ; s'il retrouve de la marge (> 58 i/s pendant 8 s), elle remonte.

   API (window.DDPerf) :
     DDPerf.pr(cap)                         rapport pixels/point conseillé (≤ cap, ≤ budget, ≤ écran)
     DDPerf.auto(renderer, { cap, onChange }) applique pr(cap) puis régule ; onChange(pr) pour redimensionner
                                            (composer, canvas…) ; renvoie { stop() }
     DDPerf.fps                             images par seconde mesurées (moyenne glissante) */
(function () {
  if (window.DDPerf) return;
  const BUDGET = 3.2e6, FLOOR = 0.75;
  const pr = (cap = 1.75) => {
    const d = window.devicePixelRatio || 1, px = Math.max(1, innerWidth * innerHeight);
    return Math.max(Math.min(1, d), Math.min(d, cap, Math.sqrt(BUDGET / px)));
  };
  let ema = 16.7, last = 0, running = false;
  const subs = new Set();
  function loop(t) {
    if (!subs.size) { running = false; return; }
    requestAnimationFrame(loop);
    if (document.hidden) { last = 0; return; }
    if (last) { const dt = t - last; if (dt > 0 && dt < 250) ema += (dt - ema) * 0.06; }
    last = t;
    for (const s of subs) s(ema, t);
  }
  const P = {
    pr,
    get fps() { return Math.round(1000 / ema); },
    auto(renderer, o = {}) {
      const cap = o.cap ?? 1.75;
      let cur = pr(cap), slow = 0, fast = 0, prevT = 0, maxNow = cur;
      const apply = (v, quiet) => { cur = v; try { renderer.setPixelRatio(v); } catch (e) {} if (!quiet && o.onChange) o.onChange(v); };
      apply(cur, true);   // au démarrage, sans rappel : la scène n'est pas encore construite
      const onResize = () => { maxNow = pr(cap); if (cur > maxNow + 0.01) apply(maxNow); };
      addEventListener('resize', onResize);
      const sub = (frameMs, t) => {
        const dt = prevT ? (t - prevT) / 1000 : 0; prevT = t; if (!(dt > 0) || dt > 0.25) return;
        if (frameMs > 22) { slow += dt; fast = 0; } else if (frameMs < 17.3) { fast += dt; slow = Math.max(0, slow - dt); } else { slow = Math.max(0, slow - dt * 0.5); fast = 0; }
        if (slow > 2 && cur > FLOOR + 0.01) { slow = 0; apply(Math.max(FLOOR, +(cur * 0.85).toFixed(3))); }
        else if (fast > 8 && cur < maxNow - 0.01) { fast = 0; apply(Math.min(maxNow, +(cur / 0.85).toFixed(3))); }
      };
      subs.add(sub); if (!running) { running = true; requestAnimationFrame(loop); }
      return { stop() { subs.delete(sub); removeEventListener('resize', onResize); }, get pr() { return cur; } };
    },
  };
  window.DDPerf = P;
})();
