#!/usr/bin/env python3
"""tools/odyssee-pack-noirblanc.py — pack de graphismes « Noir & Blanc » d'Odyssée (Options → Graphismes).

Planches de fans au style Pokémon Noir / Blanc gardées dans assets/graphics/noirblanc/ (crédits : LISEZMOI.txt du pack) :
  printemps.png (BW Spring Tileset, thefloofypanthar), eau.png (B/W Water Tiles, UltimoSpriter),
  volcan.png (Alternate Volcano Tiles, Phyromatical), arbres.png (Taragonia Mix Special Trees, Phyromatical).
Sortie : odyssee/img/gfx/noirblanc/ — tuiles de sol de 16 px (noms du sol classique) et décor (arbres, rochers…) à densité 2.
"""
import os
import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'graphics', 'noirblanc')
OUT = os.path.join(ROOT, 'odyssee', 'img', 'gfx', 'noirblanc')
os.makedirs(OUT, exist_ok=True)
L = lambda n: Image.open(os.path.join(SRC, n)).convert('RGBA')
spring, eau, volc, arbres = L('printemps.png'), L('eau.png'), L('volcan.png'), L('arbres.png')
T = 16
tile = lambda im, cx, cy: im.crop((cx * T, cy * T, cx * T + T, cy * T + T))
flip = lambda t: t.transpose(Image.FLIP_LEFT_RIGHT)


def roll(t, dx):
    o = Image.new('RGBA', (T, T)); o.paste(t, (dx, 0)); o.paste(t, (dx - T, 0)); return o


def tone(t, b=1.0, s=1.0):
    r, g, bl, a = t.split(); rgb = Image.merge('RGB', (r, g, bl))
    rgb = ImageEnhance.Brightness(ImageEnhance.Color(rgb).enhance(s)).enhance(b)
    return Image.merge('RGBA', (*rgb.split(), a))


def over(base, sp):
    o = base.copy(); o.alpha_composite(sp); return o


def trim(im, box):
    c = im.crop(box); bb = c.getbbox(); return c.crop(bb) if bb else c


def verdir(t):
    a = np.array(t).astype(float); a[..., 0] *= 0.85; a[..., 1] *= 1.02; a[..., 2] *= 0.55
    return Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')


grass = [verdir(tile(spring, 0, 0)), verdir(tile(spring, 1, 0)), verdir(tile(spring, 2, 1))]   # herbe turquoise ramenée vers le vert
dirt, sand = tile(spring, 1, 2), tile(spring, 2, 7)
water = eau.crop((104, 616, 120, 632))
rockfloor, lava = tile(volc, 0, 0), [tile(volc, 5, 4), tile(volc, 11, 4)]
tuft, tuft2 = tile(volc, 2, 0), tile(volc, 2, 1)
files = {
    'grass0': grass[0], 'grass1': grass[1], 'grass2': grass[2],
    'forest0': tone(grass[0], 0.8), 'forest1': flip(tone(grass[1], 0.78)),
    'path0': dirt, 'sand0': sand, 'pave0': tone(rockfloor, 1.15, 0.3),
    'snow0': tone(sand, 1.18, 0.15), 'snow1': flip(tone(sand, 1.16, 0.15)),
    'ash0': tone(rockfloor, 0.7, 0.4), 'ash1': flip(tone(rockfloor, 0.66, 0.4)),
    'cave0': rockfloor, 'cave1': flip(rockfloor), 'lava0': lava[0], 'lava1': lava[1],
    'tall0': over(grass[0], tuft), 'tall1': over(grass[1], flip(tuft2)),
    'darktall0': over(tone(grass[0], 0.8), tone(tuft, 0.75)), 'darktall1': over(tone(grass[1], 0.78), flip(tone(tuft2, 0.75))),
    'snowtall0': over(tone(sand, 1.35, 0.1), tone(tuft, 1.2, 0.3)), 'snowtall1': over(tone(sand, 1.32, 0.1), flip(tone(tuft2, 1.2, 0.3))),
}
for f in range(4):
    files[f'water{f}'] = roll(water, 4 * f); files[f'deep{f}'] = roll(tone(water, 0.75), 4 * f)
# décor (sprites ancrés aux pieds, densité 2 : pixel pour pixel à l'écran)
deco = {
    'tree': trim(arbres, (79, 4, 113, 64)), 'tree2': trim(arbres, (143, 4, 177, 64)),
    'pine': trim(arbres, (16, 127, 49, 209)), 'snowpine': trim(arbres, (527, 127, 561, 209)),
    'palm': trim(arbres, (73, 70, 119, 129)), 'bush': trim(arbres, (79, 304, 97, 326)),
    'rock': trim(volc, (256, 32, 288, 64)), 'deadtree': trim(volc, (330, 0, 368, 64)),
}
# bâtiments entiers (maisons_bw2.png, Phyromatical) : posés devant l'emprise du bâtiment du jeu
mais = L('maisons_bw2.png')
bats = {'center': trim(mais, (16, 15, 160, 159)), 'house': trim(mais, (175, 36, 268, 159)),
        'house2': trim(mais, (188, 186, 283, 287)), 'gym': trim(mais, (22, 178, 170, 383))}
def sans_ombre(im):   # l'ombre (pixels à moitié transparents) sous le bâtiment : coupée, le pied de l'image = le bas du mur
    a = np.array(im); rows = np.where((a[..., 3] > 128).any(1))[0]
    return im.crop((0, 0, im.width, rows.max() + 1))


deco.update({'b_' + k: sans_ombre(v) for k, v in bats.items()})
# kits de façade (4 × 4 cellules de 16 px, rôles de odyssee/js/data/regles.js) découpés dans les bâtiments Noir & Blanc 2 :
# le jeu assemble avec eux des bâtiments de n'importe quelle taille, à l'échelle de tout le reste
GRILLE = [['mur', 'fenetre', 'fenetre_nuit', 'socle'], ['porte', 'porte_nuit', 'linteau', 'cote'],
          ['toit', 'rebord', 'faite', 'cheminee'], ['enseigne_g', 'enseigne_d', 'fleurs', 'lampe']]
ODY = os.path.join(ROOT, 'odyssee', 'img', 'facades')


def nuit(t):
    a = np.array(t).astype(float); vitre = (a[..., 2] > a[..., 0] + 45) & (a[..., 2] > a[..., 1]) & (a[..., 3] > 0)
    a[vitre, 0] = 255; a[vitre, 1] = 225; a[vitre, 2] = 140
    return Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')


def kit(src, cases, base):
    old = Image.open(os.path.join(ODY, base + '.png')).convert('RGBA')
    k = Image.new('RGBA', (64, 64))
    for j, row in enumerate(GRILLE):
        for i, role in enumerate(row):
            if role in cases:
                x, y = cases[role]; c = src.crop((x, y, x + 16, y + 16))
            elif role == 'fenetre_nuit':
                x, y = cases['fenetre']; c = nuit(src.crop((x, y, x + 16, y + 16)))
            elif role == 'porte_nuit':
                x, y = cases['porte']; c = src.crop((x, y, x + 16, y + 16))
            else:
                c = old.crop((i * 16, j * 16, i * 16 + 16, j * 16 + 16))   # enseignes, fleurs, lampe : ceux du jeu
            k.paste(c, (i * 16, j * 16))
    return k


h, c = bats['house'], bats['center']
deco['kit_maison'] = kit(h, {'mur': (4, 80), 'fenetre': (32, 64), 'socle': (4, 92), 'porte': (32, 90), 'linteau': (32, 76),
                             'cote': (60, 82), 'toit': (12, 30), 'rebord': (4, 64), 'faite': (12, 30), 'cheminee': (52, 12)}, 'maison')
deco['kit_centre'] = kit(c, {'mur': (24, 104), 'fenetre': (100, 66), 'socle': (24, 116), 'porte': (62, 114), 'linteau': (62, 98),
                             'cote': (8, 104), 'toit': (30, 40), 'rebord': (30, 84), 'faite': (30, 40), 'cheminee': (30, 40)}, 'centre')
for n, im in {**files, **{('' if k.startswith('kit_') else 'd_') + k: v for k, v in deco.items() if not k.startswith('b_')}}.items():
    im.save(os.path.join(OUT, n + '.png'))
print(len(files), 'tuiles et', len(deco), 'décors dans', os.path.normpath(OUT))
