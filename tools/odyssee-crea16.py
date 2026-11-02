#!/usr/bin/env python3
"""Créatures originales d'Odyssée (PixelLab, 80 × 80) → odyssee/img/crea/<k>-f, -b, -fs, -bs, -i.png.

Sources : assets/graphics/pixellab/crea/<lot>.png, rangée de propositions de 80 × 80 (face puis dos de chaque
créature, dans l'ordre de <lot>.txt : un nom de fichier par ligne). Les chromatiques (s) ont la teinte tournée,
l'icône (i) est la face réduite dans 32 × 32.
"""
import colorsys, os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/graphics/pixellab/crea')
OUT = os.path.join(ROOT, 'odyssee/img/crea')


def chroma(im, deg=70):
    a = np.array(im.convert('RGBA')).astype(float) / 255
    out = a.copy()
    h, w = a.shape[:2]
    for y in range(h):
        for x in range(w):
            if a[y, x, 3] == 0: continue
            hh, ss, vv = colorsys.rgb_to_hsv(*a[y, x, :3])
            out[y, x, :3] = colorsys.hsv_to_rgb((hh + deg / 360) % 1, ss, vv)
    return Image.fromarray((out * 255).astype(np.uint8))


def icone(im):
    a = im.convert('RGBA'); bb = a.getbbox()
    if not bb: return Image.new('RGBA', (32, 32))
    c = a.crop(bb); k = 30 / max(c.size)
    c = c.resize((max(1, round(c.width * k)), max(1, round(c.height * k))), Image.BOX)
    al = np.array(c)[..., 3]; arr = np.array(c); arr[..., 3] = np.where(al > 110, 255, 0); c = Image.fromarray(arr)
    o = Image.new('RGBA', (32, 32)); o.alpha_composite(c, ((32 - c.width) // 2, 32 - c.height - 1)); return o


def sans_texte(im):
    """le générateur écrit parfois une légende sous le dessin (« FRONT », « BACK ») : les petits morceaux isolés du
    bas de l'image sont effacés"""
    from scipy import ndimage
    a = np.array(im.convert('RGBA')); m = a[..., 3] > 0
    lab, n = ndimage.label(m, structure=np.ones((3, 3)))
    for i in range(1, n + 1):
        ys, xs = np.nonzero(lab == i)
        if len(ys) < 60 and ys.min() >= 62: a[lab == i, 3] = 0
    return Image.fromarray(a)


def lot(name):
    a = Image.open(os.path.join(SRC, name + '.png')).convert('RGBA')
    noms = [l.strip() for l in open(os.path.join(SRC, name + '.txt')) if l.strip()]
    for i, k in enumerate(noms):
        f = a.crop((i * 2 * 80, 0, i * 2 * 80 + 80, 80)); b = a.crop(((i * 2 + 1) * 80, 0, (i * 2 + 1) * 80 + 80, 80))
        f, b = sans_texte(f), sans_texte(b)
        f.save(os.path.join(OUT, k + '-f.png')); b.save(os.path.join(OUT, k + '-b.png'))
        chroma(f).save(os.path.join(OUT, k + '-fs.png')); chroma(b).save(os.path.join(OUT, k + '-bs.png'))
        icone(f).save(os.path.join(OUT, k + '-i.png'))
    return noms


if __name__ == '__main__':
    lots = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png'))
    for l in lots: print(l, ', '.join(lot(l)))
