#!/usr/bin/env python3
"""Kits de façade d'Odyssée à 16 px (PixelLab) : assets/graphics/pixellab/kits/<kit>.png → odyssee/img/facades/<kit>.png.

Chaque source est une rangée de 16 tuiles de 16 px (les propositions de « Create Image (Pro) », dans l'ordre de la
grille des kits : mur, fenêtre, fenêtre de nuit, socle / porte, porte de nuit, linteau, côté / toit, rebord, faîte,
cheminée / enseigne gauche, enseigne droite, jardinière, lampe). L'outil :
- enlève le cadre que le générateur laisse parfois autour d'une pièce (le bord prend la couleur de la rangée voisine) ;
- détoure les objets (cheminée, enseignes, jardinière, lampe) : le fond uni touchant le bord devient transparent ;
- fusionne les couleurs presque identiques.
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'assets/graphics/pixellab/kits')
OUT = os.path.join(ROOT, 'odyssee/img/facades')
OBJETS = {11, 12, 13, 14, 15}
TOITS_LISSES = {'centre', 'boutique', 'arene', 'labo', 'ligue', 'base'}
COPIES = {'port': 'phare'}   # kits qui reprennent un autre
# pièces prises ailleurs quand le générateur ne les a pas rendues dans l'ordre : index de la source, (kit, index)
# pour emprunter à un autre kit, None pour une cellule vide
ORDRE = {
    'musee': [0, 1, 2, 3, 4, 5, 6, 7, ('phare', 8), ('phare', 9), ('phare', 10), None, None, None, None, None],
    'pagode': [0, 1, 2, 3, 4, 5, 6, 7, ('mirage', 12), ('mirage', 13), ('mirage', 14), None, None, None, None, None],
    'mirage': [0, 1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 11, None, None, None, 15],
    'phare': [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, None, None, None, None, 15],
}


def fond(tiles):
    """couleur du fond des propositions : la plus fréquente sur le bord des objets"""
    px = np.concatenate([np.concatenate([t[0], t[-1], t[:, 0], t[:, -1]]) for i, t in enumerate(tiles) if i in OBJETS])[:, :3]
    cols, n = np.unique(px, axis=0, return_counts=True)
    return cols[n.argmax()].astype(int)


def proche(a, c, tol): return np.abs(a[..., :3].astype(int) - c).max(-1) <= tol


def decadre(t, bg):
    """bord d'une case de la couleur du fond (cadre) : remplacé par la rangée / colonne voisine"""
    t = t.copy()
    for _ in range(2):
        ring = np.concatenate([t[0], t[-1], t[:, 0], t[:, -1]])
        if proche(ring, bg, 14).mean() < 0.6: break
        t[0] = t[1]; t[-1] = t[-2]; t[:, 0] = t[:, 1]; t[:, -1] = t[:, -2]
    # liseré sombre sur un bord (joint entre deux cases) : la rangée voisine le remplace
    L = t[..., :3].astype(int).sum(-1)
    for a, b in (((0, slice(None)), (1, slice(None))), ((-1, slice(None)), (-2, slice(None))),
                 ((slice(None), 0), (slice(None), 1)), ((slice(None), -1), (slice(None), -2))):
        if ((L[b] - L[a]) > 90).mean() > 0.75: t[a] = t[b]
    return t


def detoure(t, bg):
    t = t.copy(); m = proche(t, bg, 14)
    lab, n = ndimage.label(m)
    bord = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    t[np.isin(lab, list(bord)), 3] = 0
    return t


def fusion(k, tol=10):
    m = k[..., 3] > 0; px = k[m][:, :3].astype(int)
    cols, n = np.unique(px, axis=0, return_counts=True); pal = []
    for i in np.argsort(-n):
        if not any(np.abs(cols[i] - p).max() <= tol for p in pal): pal.append(cols[i])
    pal = np.array(pal); k = k.copy()
    k[m, :3] = pal[((px[:, None] - pal[None]) ** 2).sum(2).argmin(1)]
    return k, len(pal)


def kit(name):
    src = lambda k: np.array(Image.open(os.path.join(SRC, k + '.png')).convert('RGBA'))
    a = src(name)
    tiles = [a[0:16, i * 16:i * 16 + 16] for i in range(16)]
    bg = fond(tiles)
    if name in ORDRE:
        vide = np.zeros((16, 16, 4), np.uint8); vide[..., :3] = bg
        def pick(o):
            if o is None: return vide
            if isinstance(o, tuple): b = src(o[0]); return b[0:16, o[1] * 16:o[1] * 16 + 16]
            return tiles[o]
        tiles = [pick(o) for o in ORDRE[name]]
    out = np.zeros((64, 64, 4), np.uint8)
    for i, t in enumerate(tiles):
        t = detoure(t, bg) if i in OBJETS else decadre(t, bg)
        if i == 8 and name in TOITS_LISSES:
            # toit plat : la tuile se répète sur de grandes surfaces, son cadre ferait un quadrillage
            t = t.copy(); t[0] = t[2]; t[1] = t[2]; t[-1] = t[-3]; t[-2] = t[-3]; t[:, 0] = t[:, 2]; t[:, 1] = t[:, 2]; t[:, -1] = t[:, -3]; t[:, -2] = t[:, -3]
        out[(i // 4) * 16:(i // 4) * 16 + 16, (i % 4) * 16:(i % 4) * 16 + 16] = t
    out, n = fusion(out)
    Image.fromarray(out).save(os.path.join(OUT, name + '.png'))
    return n


if __name__ == '__main__':
    noms = sys.argv[1:] or sorted(f[:-4] for f in os.listdir(SRC) if f.endswith('.png'))
    for n in noms: print(n, kit(n), 'couleurs')
    for dst, src in COPIES.items():
        p = os.path.join(OUT, src + '.png')
        if os.path.exists(p): Image.open(p).save(os.path.join(OUT, dst + '.png'))
