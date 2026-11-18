// odyssee/js/ui/screens/gfxPicker.js — écran de choix des graphismes au lancement de l'aventure (modifiable plus tard dans Options).
import { el, esc } from '../ui.js';
import { SOLS_CHOIX, SPRITES_CHOIX, solChoix, spritesChoix } from '../../gfx.js';

const CARDS = {
  odyssee: {
    tag: 'ORIGINAL · RELIEF 3D',
    sub: 'Les graphismes d\'origine d\'Odyssée : relief 3D, façades classiques et ambiance HeartGold / SoulSilver.',
    scene: `
      <img class="gfx-prev-tree" src="img/nature/tree.png" alt="">
      <img class="gfx-prev-bld" src="img/facades/centre.png" alt="">
      <img class="gfx-prev-mon" src="img/pokeapi/pokemon/versions/generation-iv/heartgold-soulsilver/25.png" alt="">
      <div class="gfx-prev-spr hgss"></div>
    `,
  },
  noirblanc: {
    tag: '5E GÉNÉRATION · UNYS',
    sub: 'Le monde de Pokémon Noir 2 & Blanc 2 : sols, mer, arbres, bâtiments, personnages et menus B2W2.',
    scene: `
      <img class="gfx-prev-tree" src="img/gfx/noirblanc/d_tree.png" alt="">
      <img class="gfx-prev-bld" src="img/gfx/noirblanc/b_centre.png" alt="">
      <img class="gfx-prev-mon" src="img/pokeapi/pokemon/versions/generation-v/black-white/25.png" alt="">
      <div class="gfx-prev-spr bw"></div>
    `,
  },
};

/**
 * Affiche le sélecteur de graphismes au premier lancement / nouvelle aventure.
 * Renvoie `{ sol, sprites }` à l'acceptation, ou `null` si annulé (`allowCancel`).
 */
export function gfxPickerScreen(uiOrGame, { allowCancel = true, sol = solChoix(), sprites = spritesChoix(), title = 'CHOISIS TES GRAPHISMES' } = {}) {
  const ui = uiOrGame?.ui || uiOrGame;
  return new Promise((resolve) => {
    let curSol = SOLS_CHOIX.some((s) => s.id === sol) ? sol : 'odyssee';
    let curSprites = SPRITES_CHOIX.some((s) => s.id === sprites) ? sprites : (curSol === 'noirblanc' ? 'bw' : 'hgss');
    let spritesTouched = false;
    let area = 0; // 0 : cartes monde, 1 : sprites de combat

    const s = el('div', 'screen intro-scr gfx-pick-scr', `
      <div class="intro-bg"></div>
      <div class="intro-beam"></div>
      <div class="intro-header"><i class="intro-header-dot"></i><span>STYLE DE L'AVENTURE</span></div>
      <div class="gfx-pick-wrap">
        <div class="gfx-pick-title">${esc(title)}</div>
        <div class="gfx-pick-sub">Choisis l'apparence de ta région. Tu pourras la changer plus tard à tout moment dans <b>Options → Graphismes</b>.</div>
        <div class="gfx-pick-cards">
          ${SOLS_CHOIX.map((c) => {
            const meta = CARDS[c.id] || CARDS.odyssee;
            return `
              <div class="gfx-pick-card" data-sol="${esc(c.id)}">
                <div class="gfx-pick-badge">${esc(meta.tag)}</div>
                <div class="gfx-pick-stage">${meta.scene}</div>
                <div class="gfx-pick-name">${esc(c.nom)}</div>
                <div class="gfx-pick-desc">${esc(meta.sub)}</div>
                <div class="gfx-pick-check">✓ Sélectionné</div>
              </div>
            `;
          }).join('')}
        </div>
        <div class="gfx-pick-sprites">
          <span class="gfx-pick-sp-lbl">Sprites Pokémon en combat :</span>
          <div class="gfx-pick-sp-pills">
            ${SPRITES_CHOIX.map((sp) => `<button type="button" class="gfx-pick-sp-btn" data-sp="${esc(sp.id)}">${esc(sp.nom)} <small>(${esc(sp.info)})</small></button>`).join('')}
          </div>
        </div>
        <div class="gfx-pick-foot">
          ${allowCancel ? '<button type="button" class="gfx-pick-back">Retour</button>' : '<span class="gfx-pick-hint">Flèches : choisir · Entrée : valider</span>'}
          <button type="button" class="gfx-pick-ok">C'est parti ! ▸</button>
        </div>
      </div>
    `);
    ui.root.appendChild(s);

    const cards = [...s.querySelectorAll('.gfx-pick-card')];
    const spRow = s.querySelector('.gfx-pick-sprites');
    const spBtns = [...s.querySelectorAll('.gfx-pick-sp-btn')];
    const okBtn = s.querySelector('.gfx-pick-ok');
    const backBtn = s.querySelector('.gfx-pick-back');

    const sync = () => {
      cards.forEach((c) => c.classList.toggle('on', c.dataset.sol === curSol));
      spBtns.forEach((b) => b.classList.toggle('on', b.dataset.sp === curSprites));
      spRow.classList.toggle('focus', area === 1);
    };
    const setSol = (id) => {
      curSol = id;
      if (!spritesTouched) curSprites = id === 'noirblanc' ? 'bw' : 'hgss';
      sync();
    };
    const setSprites = (id, manual = true) => {
      curSprites = id;
      if (manual) spritesTouched = true;
      sync();
    };
    sync();

    let closed = false;
    const close = (val) => {
      if (closed) return;
      closed = true;
      pop();
      s.remove();
      resolve(val);
    };

    cards.forEach((c) => {
      c.addEventListener('pointerenter', () => { area = 0; sync(); });
      c.addEventListener('click', (e) => {
        e.stopPropagation();
        area = 0;
        ui.sound.sfx('blip');
        setSol(c.dataset.sol);
      });
      c.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        setSol(c.dataset.sol);
        ui.sound.sfx('select');
        close({ sol: curSol, sprites: curSprites });
      });
    });

    spBtns.forEach((b) => {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        area = 1;
        ui.sound.sfx('blip');
        setSprites(b.dataset.sp, true);
      });
    });

    okBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      ui.sound.sfx('select');
      close({ sol: curSol, sprites: curSprites });
    });

    if (backBtn) {
      backBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        ui.sound.sfx('cancel');
        close(null);
      });
    }

    const pop = ui.input.push((k) => {
      if (k === 'up' || k === 'down') {
        area = area === 0 ? 1 : 0;
        ui.sound.sfx('blip');
        sync();
      } else if (k === 'left' || k === 'right') {
        const d = k === 'left' ? -1 : 1;
        if (area === 1) {
          const i = SPRITES_CHOIX.findIndex((x) => x.id === curSprites);
          setSprites(SPRITES_CHOIX[(i + d + SPRITES_CHOIX.length) % SPRITES_CHOIX.length].id, true);
        } else {
          const i = SOLS_CHOIX.findIndex((x) => x.id === curSol);
          setSol(SOLS_CHOIX[(i + d + SOLS_CHOIX.length) % SOLS_CHOIX.length].id);
        }
        ui.sound.sfx('blip');
      } else if (k === 'a') {
        ui.sound.sfx('select');
        close({ sol: curSol, sprites: curSprites });
      } else if (k === 'b' && allowCancel) {
        ui.sound.sfx('cancel');
        close(null);
      }
    });
  });
}
