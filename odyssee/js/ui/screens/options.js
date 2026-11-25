// odyssee/js/ui/screens/options.js — options
import { el } from '../ui.js';
import { screen } from './common.js';
import { storeGet, storeSet } from '../../core/safe.js';
import { SOLS_CHOIX, SPRITES_CHOIX, CREDITS, solChoix, spritesChoix, choisirSol, choisirSprites, marquerGfxChoisi } from '../../gfx.js';

/* ================= OPTIONS ================= */
export function optionsScreen(game) {
  const ui = game.ui, snd = game.sound;
  return new Promise((resolve) => {
    const s = screen(ui, 'opt-scr', 'OPTIONS');
    const box = el('div', 'box opts'); s.appendChild(box);
    const speeds = ['Lente', 'Normale', 'Rapide', 'Instantanée'];
    const runSpeeds = ['Normale (1×)', 'Rapide (1.7×)', 'Turbo (2.5×)'];
    const solInitial = solChoix();
    let i = 0, solChange = false;
    const natif = () => storeGet('odyssee-natif') === '1';
    const nom = (liste, id) => liste.find((c) => c.id === id)?.nom || id;
    const rows = () => [
      ['Vitesse du texte', speeds[ui.textSpeed]],
      ['Vitesse de course', runSpeeds[game.runSpeed ?? 1]],
      ['Volume', '■'.repeat(Math.round(snd.vol * 10)) + '□'.repeat(10 - Math.round(snd.vol * 10))],
      ['Son', snd.muted ? 'Coupé' : 'Activé'],
      ['Pokémon qui suit', game.followOff ? 'Non' : 'Oui'],
      ['Style musical', snd.style === 'retro' ? 'Rétro (8 bits)' : 'Moderne'],
      ['Barre Habitat (DexNav)', game.hud?.dexnavHidden ? 'Masquée' : 'Affichée'],
      ['HUD (touche U)', game.hud?.reglage?.() || 'Masqué'],
      ['Graphismes', nom(SOLS_CHOIX, solChoix())],
      ['Sprites des Pokémon', nom(SPRITES_CHOIX, spritesChoix())],
      ['Rendu', natif() ? 'Net (écrans 4K)' : 'Classique'],
      ['Crédits graphismes', ''],
      ['Retour', ''],
    ];
    const applyRow = (rowIdx, d) => {
      if (rowIdx === 0) { ui.textSpeed = (ui.textSpeed + d + 4) % 4; storeSet('odyssee-textspeed', ui.textSpeed); }
      else if (rowIdx === 1) {
        game.runSpeed = ((game.runSpeed ?? 1) + d + 3) % 3;
        storeSet('odyssee-runspeed', game.runSpeed);
        game.hud?.update(true);
        game.ui.updateRunKeyHint?.(game.autoRun, game.runSpeed);
      } else if (rowIdx === 2) snd.setVolume(Math.max(0, Math.min(1, Math.round(snd.vol * 10 + d) / 10)));
      else if (rowIdx === 3) snd.setMuted?.(!snd.muted);
      else if (rowIdx === 4) { game.followOff = !game.followOff; storeSet('odyssee-suiveur', game.followOff ? '0' : '1'); }
      else if (rowIdx === 5) snd.setStyle?.(snd.style === 'retro' ? 'moderne' : 'retro');
      else if (rowIdx === 6) game.hud?.setDexnavHidden?.(!game.hud.dexnavHidden);
      else if (rowIdx === 7) game.hud?.changerReglage?.(d);
      else if (rowIdx === 8) { const L = SOLS_CHOIX, j = (L.findIndex((c) => c.id === solChoix()) + d + L.length) % L.length; choisirSol(L[j].id); marquerGfxChoisi(); solChange = solChoix() !== solInitial; }
      else if (rowIdx === 9) { const L = SPRITES_CHOIX, j = (L.findIndex((c) => c.id === spritesChoix()) + d + L.length) % L.length; choisirSprites(L[j].id); }
      // rendu net : la géométrie (bâtiments, relief) est tracée à la résolution de l'écran ; appliqué tout de suite
      else if (rowIdx === 10) { storeSet('odyssee-natif', natif() ? '0' : '1'); dispatchEvent(new Event('resize')); }
    };
    const draw = () => {
      const msgReload = solChange
        ? (game?.state ? '<b>Graphismes modifiés : tu pourras les appliquer immédiatement en fermant les Options.</b><br>' : '<b>Les graphismes s\'appliquent dès la fermeture des Options.</b><br>')
        : '';
      box.innerHTML = rows().map(([a, b], k) => `<div class="list-row ${k === i ? 'on' : ''}" data-opt="${k}"><span class="cur">▶</span><span class="lbl">${a}</span><span class="rgt">${b ? '◀ ' + b + ' ▶' : ''}</span></div>`).join('') + '<div class="keys">' + msgReload + '<b>Commandes</b><br>Flèches ou ZQSD : se déplacer · Espace / Entrée : valider, parler<br>Échap : annuler, menu · Maj : sprint · R : basculer course rapide/turbo · C : carte</div>';
    };
    const updateHover = () => { box.querySelectorAll('.list-row').forEach((r, k) => r.classList.toggle('on', k === i)); };
    const close = () => { pop(); s.remove(); ui.sound.sfx('cancel'); resolve({ reload: solChange }); };
    draw();
    box.addEventListener('pointerover', (e) => {
      const row = e.target.closest('.list-row'); if (!row) return;
      const k = +row.dataset.opt;
      if (!Number.isNaN(k) && k !== i) { i = k; updateHover(); }
    });
    box.addEventListener('click', (e) => {
      e.stopPropagation();
      const row = e.target.closest('.list-row'); if (!row) return;
      const k = +row.dataset.opt; if (Number.isNaN(k)) return;
      i = k;
      if (k === 11) { ui.sound.sfx('select'); creditsScreen(ui, draw); return; }
      if (k === 12) { close(); return; }
      const rgt = row.querySelector('.rgt');
      let d = 1;
      if (rgt && e.clientX >= rgt.getBoundingClientRect().left) {
        const rr = rgt.getBoundingClientRect();
        d = e.clientX < rr.left + rr.width / 2 ? -1 : 1;
      } else if (k === 2) {
        d = Math.round(snd.vol * 10) >= 10 ? -10 : 1;
      }
      applyRow(k, d);
      ui.sound.sfx('blip'); draw();
    });
    const pop = ui.input.push((k) => {
      const nRows = 13;
      if (k === 'up') i = (i + nRows - 1) % nRows; else if (k === 'down') i = (i + 1) % nRows;
      else if ((k === 'left' || k === 'right' || k === 'a') && i <= 10) {
        const d = k === 'left' ? -1 : (k === 'a' && i === 2 && Math.round(snd.vol * 10) >= 10 ? -10 : 1);
        applyRow(i, d);
      } else if (k === 'a' && i === 11) { creditsScreen(ui, draw); return; }
      else if (k === 'b' || (k === 'a' && i === 12)) { close(); return; }
      else return;
      ui.sound.sfx('blip'); draw();
    });
  });
}

/** crédits des graphismes : touche ou clic ferme */
function creditsScreen(ui, apres) {
  const s = screen(ui, 'opt-scr', 'CRÉDITS GRAPHISMES');
  const box = el('div', 'box opts'); s.appendChild(box);
  box.innerHTML = CREDITS.map(([a, b]) => `<div style="padding:8px 16px;line-height:1.4;white-space:normal"><b style="color:#9ec1f0">${a}</b><br>${b}</div>`).join('') + '<div class="keys">Échap, Espace ou clic : retour</div>';
  let closed = false;
  const close = () => { if (closed) return; closed = true; pop(); s.remove(); ui.sound.sfx('cancel'); apres(); };
  s.addEventListener('click', close);
  const pop = ui.input.push(() => close());
}
