/* Bandes-annonces du Hub : une courte vidéo muette en boucle par jeu (<jeu>/trailer.mp4), jouée dans la vitrine de l'accueil
   à la place de l'affiche, et au survol (ou au focus) d'une carte de jeu. L'affiche reste dessous : elle sert d'image
   d'attente, et de repli si la vidéo manque. Rien n'est chargé tant qu'un jeu n'est pas montré ; pas de vidéo si le
   joueur a demandé moins d'animations ou l'économie de données. */
(function () {
  'use strict';
  const calme = (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || (navigator.connection && navigator.connection.saveData);
  if (calme) return;
  const V = (document.currentScript && (document.currentScript.src.match(/[?&]v=([\d.]+)/) || [])[1]) || '';
  const manque = new Set();   // jeux sans bande-annonce : on ne redemande pas

  function poser(hote, id) {
    if (!id || manque.has(id) || hote.querySelector('video.trailer')) return null;
    const v = document.createElement('video');
    v.className = 'trailer'; v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
    v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1; v.disablePictureInPicture = true;
    v.src = `${id}/trailer.mp4${V ? '?v=' + V : ''}`;
    v.addEventListener('error', () => { manque.add(id); v.remove(); });
    v.addEventListener('playing', () => v.classList.add('in'), { once: true });
    hote.appendChild(v);
    const p = v.play(); if (p && p.catch) p.catch(() => {});
    return v;
  }
  const oter = (hote) => { for (const v of hote.querySelectorAll('video.trailer')) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); } };

  // cartes de jeu (accueil et salon) : au survol, après un court instant pour ne pas charger en passant
  let attente = 0, carte = null;
  const idDe = (c) => c.dataset.g || c.dataset.game || (c.querySelector('[data-play]') || {}).dataset?.play;
  function entrer(c) {
    if (carte === c) return; sortir();
    carte = c; attente = setTimeout(() => { const cv = c.querySelector('.cv'); if (cv) poser(cv, idDe(c)); }, 260);
  }
  function sortir() { clearTimeout(attente); if (carte) { const cv = carte.querySelector('.cv'); if (cv) oter(cv); } carte = null; }
  document.addEventListener('pointerover', (e) => { if (e.pointerType === 'touch') return; const c = e.target.closest && e.target.closest('.game'); if (c) entrer(c); else if (carte) sortir(); });
  document.addEventListener('focusin', (e) => { const c = e.target.closest && e.target.closest('.game'); if (c) entrer(c); else sortir(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) sortir(); });

  // vitrine de l'accueil : la diapositive affichée joue sa bande-annonce
  const spot = document.getElementById('spot');
  if (spot) {
    const maj = () => {
      for (const s of spot.querySelectorAll('.sp-slide')) {
        const on = s.classList.contains('on') && !document.hidden;
        if (on) poser(s, (s.querySelector('[data-play]') || {}).dataset?.play); else oter(s);
      }
    };
    new MutationObserver(maj).observe(spot, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    document.addEventListener('visibilitychange', maj);
    maj();
  }
})();
