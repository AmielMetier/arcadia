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
deco.update({'b_' + k: v for k, v in bats.items()})
for n, im in {**files, **{('' if k.startswith('b_') else 'd_') + k: v for k, v in deco.items()}}.items():
    im.save(os.path.join(OUT, n + '.png'))
print(len(files), 'tuiles et', len(deco), 'décors dans', os.path.normpath(OUT))
