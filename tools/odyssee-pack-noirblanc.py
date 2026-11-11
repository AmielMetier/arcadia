#!/usr/bin/env python3
"""tools/odyssee-pack-noirblanc.py — graphismes « Noir & Blanc » d'Odyssée (Options → Graphismes), tout tiré d'un seul kit.

Source : kit « Pokémon Essentials BW » v3.1.1 de KleinStudio (graphismes de Pokémon Noir & Blanc 2, tuiles de 32 px, soit
pile une case du jeu à l'écran). Les planches utiles sont gardées dans assets/graphics/noirblanc/ :
  kit_bw_set.png (PkmnBlackWhiteSet), mer.png et mer_profonde.png (autotiles Sea / Sea deep), grotte.png (Brown cave floor),
  volcan.png (lave, Phyromatical), persos/ (personnages du monde : trchar000, BW0xx…), objets (Object rock / tree).

Sortie dans odyssee/img/gfx/noirblanc/ :
  sol.png        une planche de tuiles de sol de 16 px (herbe, chemins et leurs bords, eau et rivages, hautes herbes…)
  d_<nom>.png    décor (arbres, sapins, haies, lampadaires…), 32 px par case : dessiné pixel pour pixel
  b_<nom>.png    bâtiments entiers (positions et portes : kit_bw_batiments.json)
  chars.png      planche des personnages du jeu (même disposition) avec les personnages de Noir & Blanc 2
et odyssee/js/data/gfx-noirblanc.js (liste des tuiles, du décor et des bâtiments), lu par odyssee/js/gfx.js.

Usage : python3 tools/odyssee-pack-noirblanc.py
"""
import json
import os

import numpy as np
from PIL import Image, ImageEnhance

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SRC = os.path.join(ROOT, 'assets', 'graphics', 'noirblanc')
OUT = os.path.join(ROOT, 'odyssee', 'img', 'gfx', 'noirblanc')
os.makedirs(OUT, exist_ok=True)
L = lambda n: Image.open(os.path.join(SRC, n)).convert('RGBA')
BW, MER, MERP, GROTTE, VOLC = L('kit_bw_set.png'), L('mer.png'), L('mer_profonde.png'), L('grotte.png'), L('volcan.png')

half = lambda im: im.resize((im.width // 2, im.height // 2), Image.NEAREST)   # le kit est du pixel art doublé : sans perte
cell = lambda cx, cy, im=BW: im.crop((cx * 32, cy * 32, cx * 32 + 32, cy * 32 + 32))
flip = lambda t: t.transpose(Image.FLIP_LEFT_RIGHT)


def tone(t, b=1.0, s=1.0):
    r, g, bl, a = t.split(); rgb = Image.merge('RGB', (r, g, bl))
    rgb = ImageEnhance.Brightness(ImageEnhance.Color(rgb).enhance(s)).enhance(b)
    return Image.merge('RGBA', (*rgb.split(), a))


def hue(t, dr, dg, db):
    a = np.array(t).astype(float); a[..., 0] *= dr; a[..., 1] *= dg; a[..., 2] *= db
    return Image.fromarray(a.clip(0, 255).astype('uint8'), 'RGBA')


def over(base, sp):
    o = base.copy(); o.alpha_composite(sp); return o


def sans(im, coul):
    """rend transparent tout pixel de la couleur donnée (l'herbe unie peinte autour des bords du kit)"""
    a = np.array(im); m = (a[..., :3] == np.array(coul[:3])).all(-1); a[m, 3] = 0
    return Image.fromarray(a, 'RGBA')


def net(im):
    """ne garde que les pixels pleins (les ombres à moitié transparentes du kit deviendraient des pâtés)"""
    a = np.array(im); a[a[..., 3] < 250, 3] = 0
    return Image.fromarray(a, 'RGBA')


def auto16(bloc, fond=None):
    """les 16 pièces d'un terrain selon ses voisins (haut 1, droite 2, bas 4, gauche 8 = même terrain), assemblées par
    quarts à partir d'un bloc 3 × 3 de tuiles de 32 px (coins, bords, plein)"""
    out = []
    for m in range(16):
        t = Image.new('RGBA', (32, 32))
        for qy in range(2):
            for qx in range(2):
                col = 1 if (m & (8 if qx == 0 else 2)) else (0 if qx == 0 else 2)
                row = 1 if (m & (1 if qy == 0 else 4)) else (0 if qy == 0 else 2)
                q = bloc.crop((col * 32 + qx * 16, row * 32 + qy * 16, col * 32 + qx * 16 + 16, row * 32 + qy * 16 + 16))
                t.paste(q, (qx * 16, qy * 16))
        out.append(over(fond, t) if fond else t)
    return out


# ------------------------------------------------------------------ sols
T = {}   # nom → tuile de 16 px
HERBE_UNIE = BW.getpixel((6 * 32 + 16, 4 * 32 + 16))   # l'herbe sans motif peinte autour des chemins du kit
herbe = [[cell(i, j) for j in range(2)] for i in range(3)]   # l'herbe de Noir & Blanc : un motif de 3 × 2 cases
for i in range(3):
    for j in range(2):
        T[f'pg_{i}_{j}'] = herbe[i][j]
G0 = herbe[0][0]
T['grass0'] = T['grass1'] = T['grass2'] = G0
T['forest0'] = T['forest1'] = G0
def pieces(auto, cle=None):
    """les cinq tuiles d'un terrain du kit (autotile de 96 × 128 : coins rentrants en haut à droite, bloc 3 × 3 dessous),
    fond transparent : « 0 » coins sortants, « v » bords gauche et droit, « h » bords haut et bas, « f » plein,
    « i » coins rentrants. Le jeu assemble chaque case par quarts selon ses huit voisins (groundCell de world3d.js)."""
    if cle:
        auto = sans(auto, cle)
    # les pixels à moitié transparents de la frange : posés sur l'herbe unie du kit, puis opaques
    a = np.array(auto).astype(float); al = a[..., 3:4] / 255.0; semi = (a[..., 3] > 0) & (a[..., 3] < 255)
    mix = a[..., :3] * al + np.array(HERBE_UNIE[:3]) * (1 - al)
    a[..., :3][semi] = mix[semi]; a[..., 3][semi] = 255
    auto = Image.fromarray(a.astype('uint8'), 'RGBA')
    m = auto16(auto.crop((0, 32, 96, 128)))
    return {'0': m[0], 'v': m[5], 'h': m[10], 'f': m[15], 'i': auto.crop((64, 0, 96, 32))}


SABLE, PAVES = L('auto_sable.png'), L('auto_paves.png')
for nom, P in [('path', pieces(SABLE)), ('sand', pieces(tone(SABLE, 1.12, 0.55))), ('pave', pieces(PAVES, PAVES.getpixel((2, 34))))]:
    for k, t in P.items():
        T[f'q_{nom}_{k}'] = t
    T[nom + '0'] = P['f']
sable = T['sand0']
T['snow0'] = tone(sable, 1.06, 0.12); T['snow1'] = flip(T['snow0'])
T['cave0'] = GROTTE.crop((32, 64, 64, 96)); T['cave1'] = flip(T['cave0'])
T['ash0'] = tone(T['cave0'], 0.72, 0.25); T['ash1'] = flip(T['ash0'])
lave = lambda cx, cy: VOLC.crop((cx * 16, cy * 16, cx * 16 + 16, cy * 16 + 16)).resize((32, 32), Image.NEAREST)
T['lava0'], T['lava1'] = lave(5, 5), lave(4, 5)
touffe, touffe_s = cell(4, 11), cell(5, 11)
# hautes herbes : la touffe seule, posée par le jeu sur l'herbe de la case
T['q_tall0'], T['q_tall1'] = touffe, flip(touffe)
T['q_darktall0'], T['q_darktall1'] = touffe_s, flip(touffe_s)
T['tall0'] = over(G0, touffe); T['tall1'] = over(G0, flip(touffe))
T['darktall0'] = over(G0, touffe_s); T['darktall1'] = over(G0, flip(touffe_s))
T['snowtall0'] = over(T['snow0'], touffe_s); T['snowtall1'] = over(T['snow1'], flip(touffe_s))
# mer : 4 images d'animation, rivage de rochers ; mêmes cinq tuiles que les chemins
for f in range(4):
    fr = MER.crop((f * 192, 0, f * 192 + 96, 128))
    for k, t in pieces(fr).items():
        T[f'q_water_{k}_f{f}'] = t
    T[f'water{f}'] = fr.crop((32, 64, 64, 96))
    T[f'deep{f}'] = MERP.crop((f * 192 + 32, 64, f * 192 + 64, 96))
# rebord à sauter (vers le sud) et intérieurs : sol du Centre Pokémon et de la Boutique, comptoirs aux couleurs du kit
T['ledge'] = over(G0, BW.crop((112, 960, 144, 992)))
CENTRE, BOUTIQUE = L('centre_interieur.png'), L('boutique_interieur.png')
T['floor_pink'] = cell(1, 10, CENTRE); T['floor_blue'] = cell(0, 5, BOUTIQUE)


def uni(haut, milieu, bas, h=4, b=6):
    t = Image.new('RGBA', (32, 32), milieu); t.paste(haut, (0, 0, 32, h)); t.paste(bas, (0, 32 - b, 32, 32)); return t


T['x_counter'] = uni((240, 248, 250, 255), (206, 224, 230, 255), (150, 176, 186, 255))
T['x_counterfront'] = uni((120, 178, 190, 255), (62, 128, 146, 255), (36, 84, 100, 255))
noms = sorted(T)
COLS = 32
planche = Image.new('RGBA', (COLS * 16, ((len(noms) + COLS - 1) // COLS) * 16))
for i, n in enumerate(noms):
    planche.paste(half(T[n]), ((i % COLS) * 16, (i // COLS) * 16))
planche.save(os.path.join(OUT, 'sol.png'))

# ------------------------------------------------------------------ décor (pixel pour pixel, ancré aux pieds)
def trim(im):
    bb = im.getbbox(); return im.crop(bb) if bb else im


def arbre(x0, y0, x1, y1, pas=64):
    """un arbre seul dans une pile de deux : la silhouette du haut (complète) sert à détourer celui du bas"""
    haut = np.array(BW.crop((x0, y0 - pas, x1, y1 - pas))); bas = np.array(BW.crop((x0, y0, x1, y1)))
    libre = np.arange(bas.shape[0])[:, None] >= pas   # sous l'arbre du haut, plus rien ne dépasse
    garde = (haut[..., 3] > 0) | libre
    bas[~garde, 3] = 0
    return trim(Image.fromarray(bas, 'RGBA'))


feuillu = arbre(96, 848, 160, 968); sapin = arbre(136, 1836, 216, 1960)


def feuilles(im, coul):
    """le feuillage (pixels verts) reteint, tronc et ombre gardés"""
    a = np.array(im).astype(float); r, g, b = a[..., 0], a[..., 1], a[..., 2]
    vert = (g > r * 1.25) & (g > b * 1.02) & (a[..., 3] > 0)
    vert[-30:] = False   # l'ombre au pied reste comme elle est
    lum = g[vert] / 200.0
    for k in range(3):
        a[..., k][vert] = np.clip(lum * coul[k], 0, 255)
    return Image.fromarray(a.astype('uint8'), 'RGBA')


D = {
    'tree': feuillu, 'tree2': flip(feuillu), 'tree3': feuillu, 'pine': sapin,
    'snowpine': feuilles(sapin, (215, 235, 250)),
    'arbre_automne': feuilles(feuillu, (235, 150, 40)), 'erable': feuilles(feuillu, (220, 70, 45)), 'cerisier': feuilles(feuillu, (250, 165, 195)),
    'bush': net(trim(BW.crop((0, 632, 32, 672)))), 'lamp': net(trim(BW.crop((224, 608, 256, 736)))),
    'rock': trim(L('objet_rocher.png').crop((0, 0, 32, 32))), 'cuttree': trim(L('objet_arbuste.png').crop((0, 0, 32, 32))),
}
# mobilier du Centre Pokémon et panneau de bois des routes
D['plant'] = net(trim(CENTRE.crop((192, 1096, 224, 1170)))); D['pc'] = net(trim(CENTRE.crop((192, 1010, 224, 1090))))
D['healer'] = net(trim(CENTRE.crop((130, 1012, 192, 1090)))); D['bench'] = net(trim(CENTRE.crop((64, 960, 160, 992))))
D['sign'] = net(trim(BW.crop((176, 98 * 32, 256, 100 * 32))))
# devant les jambes de qui marche dans les hautes herbes : le bas de la touffe
bas = lambda t: t.crop((0, 16, 32, 32))
D['grassfront'], D['grassfront2'] = bas(touffe), bas(flip(touffe))
D['darkfront'], D['darkfront2'] = bas(touffe_s), bas(flip(touffe_s))
D['snowfront'], D['snowfront2'] = bas(touffe_s), bas(flip(touffe_s))
for i, c in enumerate([(235, 150, 40), (220, 70, 45), (240, 190, 50), (200, 95, 40), (225, 120, 50), (190, 60, 50)]):
    D[f'automne{i}'] = feuilles(feuillu if i % 2 == 0 else flip(feuillu), c)
for n, im in D.items():
    im.save(os.path.join(OUT, f'd_{n}.png'))

# ------------------------------------------------------------------ bâtiments entiers
BATS = json.load(open(os.path.join(SRC, 'kit_bw_batiments.json')))
for nom, (x0, y0, x1, y1, porte) in BATS.items():
    BW.crop((x0, y0, x1, y1)).save(os.path.join(OUT, f'b_{nom}.png'))

# ------------------------------------------------------------------ personnages
# planche du jeu : une rangée de 12 cases de 64 px par personnage (bas, gauche, droite, haut ; pas, arrêt, pas)
PERSOS = json.load(open(os.path.join(SRC, 'persos.json')))
chars = Image.open(os.path.join(ROOT, 'odyssee', 'img', 'chars.png')).convert('RGBA')
rows = json.load(open(os.path.join(SRC, 'rangees.json')))   # nom → rangée (odyssee/js/data/sprites.js, SPRITES.chars.rows)
faits = 0
for nom, fichier in PERSOS.items():
    if nom not in rows:
        continue
    src = L(os.path.join('persos', fichier + '.png')); fw, fh = src.width // 4, src.height // 4
    y = rows[nom] * 64
    chars.paste((0, 0, 0, 0), (0, y, 768, y + 64))
    for d in range(4):
        for k, f in enumerate((1, 0, 3)):
            fr = src.crop((f * fw, d * fh, f * fw + fw, d * fh + fh))
            # centrée, les pieds au même endroit que dans la planche du jeu (4 px au-dessus du bas de la case)
            c = Image.new('RGBA', (64, 64)); c.alpha_composite(fr, ((64 - fw) // 2, 64 - fh - (4 if fh <= 60 else 0)) if fh <= 64 else (0, 0), (0, 0) if fh <= 64 else ((fw - 64) // 2, fh - 64))
            chars.alpha_composite(c, ((d * 3 + k) * 64, y))
    faits += 1
chars.save(os.path.join(OUT, 'chars.png'))

# ------------------------------------------------------------------ liste pour le jeu
js = ("// odyssee/js/data/gfx-noirblanc.js — écrit par tools/odyssee-pack-noirblanc.py (ne pas modifier à la main)\n"
      f"export const NB_TUILES = {json.dumps(noms)};\nexport const NB_COLS = {COLS};\n"
      f"export const NB_DECOR = {json.dumps(sorted(D))};\n"
      "// bâtiments : nom → [largeur en px, colonne du milieu de la porte (ou null)]\n"
      f"export const NB_BATIMENTS = {json.dumps({n: [v[2] - v[0], v[4]] for n, v in BATS.items()})};\n")
open(os.path.join(ROOT, 'odyssee', 'js', 'data', 'gfx-noirblanc.js'), 'w', encoding='utf-8').write(js)
print(len(noms), 'tuiles,', len(D), 'décors,', len(BATS), 'bâtiments,', faits, 'personnages →', os.path.normpath(OUT))
