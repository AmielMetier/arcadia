#!/usr/bin/env python3
"""Sols d'Odyssée à 16 px (PixelLab) : découpe les jeux de tuiles Wang et les pièces dans odyssee/img/sol16/.

Sources : assets/graphics/pixellab/sols/<jeu>.png (feuilles 4 × 4 de tuiles de 16 px, coins « bas » / « haut »)
et pieces.png (une rangée de tuiles isolées).

Sortie : odyssee/img/sol16/<jeu>_<m>.png, m = coins du terrain « haut » (NO << 3 | NE << 2 | SO << 1 | SE).
  m = 0 : tuile pleine du terrain bas ; m = 15 : tuile pleine du terrain haut ; 1..14 : le terrain haut seul,
  le terrain bas rendu transparent (le jeu pose ces pièces par-dessus le sol, sur une grille décalée d'une
  demi-case : chaque coin de la pièce est le centre d'une case).
"""
import json, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/graphics/pixellab/sols')
OUT = os.path.join(ROOT, 'odyssee/img/sol16')

# jeu : couleur repère du terrain bas
JEUX = {
    'chemin': (105, 190, 55), 'sable': (105, 190, 55), 'pave': (105, 190, 55), 'herbes_bois': (105, 190, 55),
    'rivage': (40, 140, 230), 'berge': (40, 140, 230),
    'neige': (235, 250, 252), 'herbes_neige': (235, 250, 252), 'cendre': (105, 110, 112),
}
PIECES = ['fleur_r', 'fleur_y', 'fleur_w', 'fleur_p', 'rebord', 'pont_ns', 'pont_eo', 'ponton', 'escalier', 'falaise',
          'grotte', 'grotte_mur', 'profond', 'lave', 'parquet', 'cailloux']


def analyse(a, lower_rgb):
    tiles = [a[(i // 4) * 16:(i // 4) * 16 + 16, (i % 4) * 16:(i % 4) * 16 + 16] for i in range(16)]
    pos = [(0, 0), (0, 13), (13, 0), (13, 13)]
    flat = np.array([t[y:y + 3, x:x + 3, :3].reshape(-1, 3).mean(0) for t in tiles for (y, x) in pos])
    d = ((flat - np.array(lower_rgb)) ** 2).sum(1)
    c = np.array([flat[d.argmin()], flat[d.argmax()]])
    for _ in range(20):
        lab = ((flat[:, None] - c[None]) ** 2).sum(2).argmin(1)
        c = np.array([flat[lab == k].mean(0) for k in (0, 1)])
    lab = lab.reshape(16, 4)
    out = {}
    for i, t in enumerate(tiles):
        m = int(lab[i][0] << 3 | lab[i][1] << 2 | lab[i][2] << 1 | lab[i][3])
        out.setdefault(m, t.copy())
    return out


def detoure(t, low):
    """rend transparents les pixels du terrain bas (couleurs de la tuile pleine du bas, à 6 près)"""
    pal = np.unique(low[..., :3].reshape(-1, 3), axis=0).astype(int)
    px = t[..., :3].reshape(-1, 3).astype(int)
    near = (np.abs(px[:, None] - pal[None]).max(2) <= 6).any(1).reshape(16, 16)
    o = t.copy(); o[near, 3] = 0
    return o


def calme(t, eau=False):
    """adoucit une tuile pleine trop chargée : les points clairs isolés (cailloux beiges dans l'herbe, écume partout
    sur l'eau) reprennent la couleur dominante, sauf quelques-uns pour garder de la vie"""
    a = t.copy(); rgb = a[..., :3].astype(int)
    cols, n = np.unique(rgb.reshape(-1, 3), axis=0, return_counts=True); dom = cols[n.argmax()]
    lum = rgb.sum(2); clair = lum > dom.sum() + (150 if eau else 120)
    if not eau: clair |= (rgb[..., 0] > 170) & (rgb[..., 2] > 90)
    yy, xx = np.mgrid[0:16, 0:16]; garde = ((xx * 3 + yy * 5) % (6 if eau else 9)) == 0
    a[clair & ~garde, :3] = dom
    return a


def main():
    os.makedirs(OUT, exist_ok=True)
    rapport = {}
    for jeu, rgb in JEUX.items():
        p = os.path.join(SRC, jeu + '.png')
        if not os.path.exists(p): continue
        a = np.array(Image.open(p).convert('RGBA'))
        tiles = analyse(a, rgb)
        manque = [m for m in range(16) if m not in tiles]
        rapport[jeu] = manque
        for m, t in tiles.items():
            if m == 0 and rgb == (105, 190, 55): t = calme(t)
            if m == 15 and jeu == 'berge': t = calme(t)
            if m == 0 and jeu in ('rivage', 'berge'): t = calme(t, eau=True)
            im = t if m in (0, 15) else detoure(t, tiles.get(0, t))
            Image.fromarray(im).save(os.path.join(OUT, f'{jeu}_{m}.png'))
    pc = os.path.join(SRC, 'pieces.png')
    if os.path.exists(pc):
        a = Image.open(pc).convert('RGBA')
        for i, n in enumerate(PIECES):
            if (i + 1) * 16 <= a.width: a.crop((i * 16, 0, i * 16 + 16, 16)).save(os.path.join(OUT, n + '.png'))
    # eau animée : la tuile d'eau du rivage, décalée d'un pixel par image (la tuile se raccorde avec elle-même)
    w = os.path.join(OUT, 'rivage_0.png')
    if os.path.exists(w):
        a = np.array(Image.open(w))
        for f in range(4): Image.fromarray(np.roll(np.roll(a, f * 4, 1), f, 0)).save(os.path.join(OUT, f'eau{f}.png'))
    for f in os.listdir(SRC):
        if f.startswith('hautes_herbes') and f.endswith('.png'):
            Image.open(os.path.join(SRC, f)).convert('RGBA').save(os.path.join(OUT, f))
    print('sols 16 px :', {k: ('complet' if not v else f'manque {v}') for k, v in rapport.items()})


if __name__ == '__main__':
    main()
