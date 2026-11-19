"""
tools/noirblanc_moyens.py — Corrections de priorité MOYENNE (#10 et #11) en pixel-art Gen 5 (grille 2×2, s=0) :
- #10A : Sols & mobilier-tuiles d'intérieur Gen 5 dans sol.png (x_counter, x_counterfront, x_martfront, x_shelf, x_mat,
         floor_wood, floor_white, floor_marble, floor_stone, floor_metal, floor_dark, floor_dark2, floor_blue2, tatami, carpet)
- #10B : Refonte pixel-art 2×2 Gen 5 de 14 décors plats/semi-transparents (lamp, deadtree, sofa, table, tv, bed, fridge,
         cloche, cristal, brasero, etai, lampe_mine, telescope, wagonnet) + ajout des 7 meubles intérieurs majeurs
         (machine_sous, table_balls, machine_labo, ecran_carte, sanctuaire, trone, livres)
- #11  : Vraie couche de neige hivernale B2W2 sur b_boutique_neige_b.png et b_boutique_neige.png.
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw
from noirblanc_critiques import _canvas2x, _up2, _rect, _bricks_l, _glass_win


# ================================================================== #10A TUILES D'INTÉRIEUR GEN 5 (16×16 -> sol.png)
def _tile16():
    return Image.new('RGBA', (16, 16), (0, 0, 0, 255))


def _mk_counter_top():
    """Plateau de comptoir Gen 5 crème-perle poli avec rebord clair & filet métallique."""
    im = _tile16()
    dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 15, 15], fill=(236, 232, 222, 255))
    dr.line([0, 0, 15, 0], fill=(168, 162, 154, 255))
    dr.line([0, 1, 15, 1], fill=(252, 250, 246, 255))
    dr.line([0, 2, 15, 2], fill=(246, 242, 236, 255))
    # Subtile brillance diagonale de comptoir laqué
    for x in (3, 4, 11, 12):
        dr.line([x, 4, x + 2, 10], fill=(246, 244, 238, 255))
    dr.line([0, 13, 15, 13], fill=(208, 202, 192, 255))
    dr.line([0, 14, 15, 14], fill=(154, 150, 146, 255))
    dr.line([0, 15, 15, 15], fill=(92, 90, 96, 255))
    return im


def _mk_counter_front(mart=False):
    """Façade de comptoir Centre Pokémon (corail-rouge/blanc B2W2) ou Boutique (bleu ciel/blanc B2W2)."""
    im = _tile16()
    dr = ImageDraw.Draw(im)
    if mart:
        hi, main, mid, sh, trim = (146, 198, 244, 255), (72, 136, 212, 255), (52, 108, 182, 255), (34, 72, 134, 255), (242, 248, 254, 255)
    else:
        hi, main, mid, sh, trim = (248, 166, 156, 255), (222, 92, 86, 255), (188, 66, 66, 255), (132, 42, 48, 255), (252, 246, 238, 255)
    dr.rectangle([0, 0, 15, 15], fill=main)
    dr.line([0, 0, 15, 0], fill=(64, 54, 60, 255))
    dr.line([0, 1, 15, 1], fill=trim)
    dr.line([0, 2, 15, 2], fill=hi)
    # Panneau en retrait Gen 5
    dr.rectangle([1, 4, 14, 10], fill=mid, outline=sh)
    dr.line([2, 5, 13, 5], fill=main)
    dr.line([0, 11, 15, 11], fill=trim)
    dr.line([0, 12, 15, 12], fill=(152, 156, 168, 255))
    dr.rectangle([0, 13, 15, 15], fill=(84, 88, 100, 255))
    dr.line([0, 15, 15, 15], fill=(52, 54, 64, 255))
    return im


def _mk_shelf():
    """Rayonnage de Boutique Pokémon Gen 5 (cadre gris-blanc, bandeau menthe, 2 niveaux de flacons/boîtes)."""
    im = _tile16()
    dr = ImageDraw.Draw(im)
    # Cadre extérieur métallique clair
    dr.rectangle([0, 0, 15, 15], fill=(198, 206, 214, 255), outline=(66, 74, 86, 255))
    # Bandeau supérieur vert menthe Poké Mart BW2
    dr.rectangle([1, 1, 14, 3], fill=(108, 206, 134, 255))
    dr.line([1, 1, 14, 1], fill=(166, 238, 182, 255))
    dr.line([1, 4, 14, 4], fill=(82, 92, 106, 255))
    # 2 niches d'articles colorés (Poké Balls, Potions, Rappels, Antidotes)
    items1 = [(228, 72, 68, 255), (242, 204, 72, 255), (76, 148, 224, 255), (168, 96, 218, 255)]
    items2 = [(84, 188, 102, 255), (236, 134, 62, 255), (228, 72, 68, 255), (76, 168, 224, 255)]
    for ry, row_items in ((5, items1), (10, items2)):
        dr.rectangle([1, ry, 14, ry + 3], fill=(62, 68, 80, 255))
        for i, c in enumerate(row_items):
            x0 = 2 + i * 3
            dr.rectangle([x0, ry + 1, x0 + 1, ry + 3], fill=c)
        dr.line([1, ry + 4, 14, ry + 4], fill=(156, 164, 176, 255))
    return im


def _mk_mat():
    """Tapis d'entrée rouge Gen 5 avec double bordure crème-dorée et ombre."""
    im = _tile16()
    dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 15, 15], fill=(152, 46, 48, 255))
    dr.rectangle([1, 1, 14, 14], fill=(208, 68, 66, 255), outline=(238, 222, 186, 255))
    dr.rectangle([3, 3, 12, 12], fill=(192, 56, 58, 255), outline=(164, 44, 48, 255))
    dr.line([1, 15, 14, 15], fill=(102, 30, 34, 255))
    return im


def _mk_floor_wood():
    """Parquet chêne lumineux Gen 5 (maisons d'Unys)."""
    im = _tile16()
    px = im.load()
    pal = [(214, 174, 122, 255), (202, 160, 110, 255), (224, 186, 134, 255), (172, 130, 84, 255)]
    for y in range(16):
        plank = y // 4
        seam_y = (y % 4 == 3)
        jx = 5 if (plank % 2 == 0) else 12
        for x in range(16):
            if seam_y or x == jx:
                px[x, y] = pal[3]
            elif y % 4 == 0:
                px[x, y] = pal[2]
            else:
                px[x, y] = pal[(plank + (x > jx)) % 2]
    return im


def _mk_floor_grid(c_base, c_hi, c_sh, step=8, checker=None):
    im = _tile16()
    px = im.load()
    for y in range(16):
        for x in range(16):
            alt = checker and (((x // step) + (y // step)) % 2 == 1)
            base = checker if alt else c_base
            if x % step == 0 or y % step == 0:
                px[x, y] = c_sh
            elif x % step == 1 or y % step == 1:
                px[x, y] = c_hi
            else:
                px[x, y] = base
    return im


def _mk_tatami():
    im = _tile16()
    dr = ImageDraw.Draw(im)
    dr.rectangle([0, 0, 15, 15], fill=(194, 198, 134, 255))
    for y in range(1, 15, 2):
        dr.line([1, y, 14, y], fill=(178, 184, 118, 255))
    dr.line([0, 0, 15, 0], fill=(78, 92, 62, 255))
    dr.line([0, 15, 15, 15], fill=(64, 76, 52, 255))
    dr.line([0, 1, 15, 1], fill=(214, 218, 158, 255))
    return im


def _mk_carpet():
    im = _tile16()
    px = im.load()
    for y in range(16):
        for x in range(16):
            d = (x + y) % 4 == 0 and (x % 2 == 0)
            px[x, y] = (182, 54, 62, 255) if d else ((158, 42, 52, 255) if (x + y) % 2 else (166, 46, 56, 255))
    return im


def _mk_floor_metal():
    im = _mk_floor_grid((136, 144, 158, 255), (168, 176, 192, 255), (86, 92, 108, 255), step=8)
    dr = ImageDraw.Draw(im)
    for rx, ry in ((2, 2), (6, 2), (2, 6), (6, 6), (10, 10), (14, 10), (10, 14), (14, 14)):
        dr.point((rx, ry), fill=(198, 206, 220, 255))
    return im


# ================================================================== #10B DÉCORS & MEUBLES GEN 5 (grille 2×2, s=0)
def _d_lamp():
    """Lampadaire Gen 5 net (14×58, zéro pixel semi-transparent)."""
    im = _canvas2x(7, 29)
    dr = ImageDraw.Draw(im)
    out = (26, 36, 30, 255)
    # Globe verre lumineux + chapeau vert-bronze
    _rect(dr, 1, 0, 5, 1, (54, 78, 56, 255), border=out)
    _rect(dr, 0, 2, 6, 6, (242, 232, 178, 255), border=out, hi=(255, 252, 224, 255), sh=(198, 184, 124, 255))
    dr.rectangle([2, 3, 4, 4], fill=(255, 250, 218, 255))
    # Collerette + fût fonte vert foncé + socle mouluré
    _rect(dr, 1, 7, 5, 8, (58, 86, 60, 255), border=out)
    _rect(dr, 2, 9, 4, 25, (64, 96, 66, 255), border=out)
    dr.line([3, 9, 3, 25], fill=(98, 138, 96, 255))
    _rect(dr, 1, 25, 5, 28, (54, 82, 56, 255), border=out, hi=(88, 124, 88, 255))
    return _up2(im)


def _d_deadtree():
    """Arbre mort Gen 5 noueux et net en grille 2×2 (40×54, s=0)."""
    im = _canvas2x(20, 27)
    dr = ImageDraw.Draw(im)
    out = (44, 30, 22, 255)
    bark = (118, 84, 56, 255)
    hi = (156, 118, 82, 255)
    sh = (78, 52, 34, 255)
    # Racines & tronc tortueux
    _rect(dr, 8, 13, 12, 25, bark, border=out)
    dr.line([9, 14, 9, 24], fill=hi)
    dr.line([11, 14, 11, 24], fill=sh)
    _rect(dr, 6, 24, 14, 26, bark, border=out, hi=hi)
    # Grosses branches ramifiées nettes (style pixel-art Gen 5, plus de brindilles 1 px)
    branches = [
        [(9, 14), (5, 10), (3, 6)],
        [(6, 11), (2, 10)],
        [(10, 12), (10, 6), (8, 2)],
        [(10, 7), (13, 3)],
        [(11, 14), (15, 10), (17, 6)],
        [(14, 11), (18, 11)],
    ]
    for path in branches:
        for i in range(len(path) - 1):
            x0, y0 = path[i]; x1, y1 = path[i + 1]
            dr.line([x0, y0, x1, y1], fill=out, width=3)
    for path in branches:
        for i in range(len(path) - 1):
            x0, y0 = path[i]; x1, y1 = path[i + 1]
            dr.line([x0, y0, x1, y1], fill=bark, width=1)
            dr.point((x0, max(0, y0 - 1)), fill=hi)
    return _up2(im)


def _d_sofa():
    im = _canvas2x(20, 13)
    dr = ImageDraw.Draw(im)
    out = (52, 22, 24, 255)
    # Dossier rembourré + 2 coussins + accoudoirs arrondis
    _rect(dr, 2, 0, 17, 6, (212, 68, 68, 255), border=out, hi=(244, 118, 112, 255), sh=(156, 40, 44, 255))
    dr.line([10, 1, 10, 5], fill=(156, 40, 44, 255))
    _rect(dr, 0, 4, 3, 12, (192, 54, 56, 255), border=out, hi=(234, 104, 100, 255))
    _rect(dr, 16, 4, 19, 12, (192, 54, 56, 255), border=out, hi=(234, 104, 100, 255))
    _rect(dr, 3, 6, 16, 11, (226, 86, 82, 255), border=out, hi=(248, 136, 128, 255), sh=(166, 44, 48, 255))
    dr.line([10, 6, 10, 10], fill=(156, 40, 44, 255))
    _rect(dr, 2, 11, 17, 12, (112, 42, 38, 255), border=out)
    return _up2(im)


def _d_table():
    im = _canvas2x(19, 10)
    dr = ImageDraw.Draw(im)
    out = (56, 38, 24, 255)
    # Pieds bois ombrés
    _rect(dr, 1, 5, 3, 9, (152, 104, 58, 255), border=out)
    _rect(dr, 15, 5, 17, 9, (152, 104, 58, 255), border=out)
    # Plateau chêne clair + chemin de table + tasse
    _rect(dr, 0, 0, 18, 6, (228, 194, 138, 255), border=out, hi=(248, 224, 176, 255), sh=(176, 136, 84, 255))
    dr.rectangle([6, 1, 12, 5], fill=(242, 234, 214, 255))
    _rect(dr, 12, 2, 15, 4, (132, 178, 218, 255), border=(52, 64, 82, 255), hi=(224, 242, 255, 255))
    return _up2(im)


def _d_tv():
    im = _canvas2x(17, 14)
    dr = ImageDraw.Draw(im)
    out = (30, 34, 44, 255)
    # Meuble TV gris-blanc + console
    _rect(dr, 3, 10, 13, 13, (88, 94, 108, 255), border=out, hi=(134, 142, 158, 255))
    dr.rectangle([6, 11, 10, 12], fill=(224, 228, 236, 255))
    # Écran plat Gen 5 avec cadre sombre & reflet vif
    _rect(dr, 0, 0, 16, 10, (52, 58, 72, 255), border=out, hi=(104, 114, 132, 255))
    _glass_win(dr, 1, 1, 15, 8, frame=(34, 40, 52, 255), dark=(46, 108, 156, 255), mid=(92, 176, 228, 255), hi=(198, 240, 255, 255))
    dr.point((14, 9), fill=(92, 232, 124, 255))
    return _up2(im)


def _d_bed():
    im = _canvas2x(14, 22)
    dr = ImageDraw.Draw(im)
    out = (44, 30, 24, 255)
    # Tête de lit bois + cadre
    _rect(dr, 0, 0, 13, 3, (156, 102, 58, 255), border=out, hi=(198, 144, 92, 255))
    _rect(dr, 0, 3, 13, 21, (238, 240, 246, 255), border=out, sh=(186, 192, 206, 255))
    # Oreiller moelleux ombré
    _rect(dr, 2, 4, 11, 8, (250, 252, 255, 255), border=(146, 154, 172, 255), sh=(212, 218, 232, 255))
    # Couette bleue Gen 5 avec revers blanc plié
    _rect(dr, 1, 9, 12, 11, (242, 246, 254, 255), border=(136, 152, 184, 255))
    _rect(dr, 1, 11, 12, 19, (76, 128, 204, 255), border=(38, 60, 108, 255), hi=(124, 172, 236, 255), sh=(52, 92, 158, 255))
    dr.line([2, 15, 11, 15], fill=(62, 108, 178, 255))
    # Pied de lit bois
    _rect(dr, 0, 19, 13, 21, (142, 92, 52, 255), border=out, hi=(184, 132, 82, 255))
    return _up2(im)


def _d_fridge():
    im = _canvas2x(12, 24)
    dr = ImageDraw.Draw(im)
    out = (40, 48, 58, 255)
    _rect(dr, 0, 0, 11, 23, (216, 224, 232, 255), border=out, hi=(244, 248, 254, 255), sh=(156, 166, 180, 255))
    dr.line([1, 1, 1, 22], fill=(240, 246, 252, 255))
    dr.line([10, 2, 10, 22], fill=(172, 182, 196, 255))
    # Séparation congélateur / frigo + poignées chromées
    dr.line([1, 9, 10, 9], fill=(82, 92, 106, 255))
    dr.line([1, 10, 10, 10], fill=(244, 248, 254, 255))
    _rect(dr, 2, 4, 3, 7, (112, 122, 138, 255), border=out)
    _rect(dr, 2, 12, 3, 16, (112, 122, 138, 255), border=out)
    _rect(dr, 1, 21, 10, 22, (124, 134, 148, 255))
    return _up2(im)


def _d_cloche():
    im = _canvas2x(22, 23)
    dr = ImageDraw.Draw(im)
    out = (44, 28, 20, 255)
    # Portique bois vermillon/chêne
    _rect(dr, 0, 1, 21, 4, (148, 72, 44, 255), border=out, hi=(196, 114, 76, 255))
    _rect(dr, 1, 4, 3, 22, (128, 62, 38, 255), border=out, hi=(172, 96, 62, 255))
    _rect(dr, 18, 4, 20, 22, (128, 62, 38, 255), border=out, hi=(172, 96, 62, 255))
    # Cloche dorée volumétrique 4 teintes
    for y in range(6, 19):
        hw = 3 + int((y - 6) * 0.36)
        dr.line([11 - hw, y, 11 + hw, y], fill=(224, 182, 62, 255))
        dr.line([11 - hw + 1, y, 11 - hw // 3, y], fill=(252, 228, 124, 255))
        dr.line([11 + hw // 2, y, 11 + hw - 1, y], fill=(166, 124, 34, 255))
        dr.point((11 - hw, y), fill=out)
        dr.point((11 + hw, y), fill=out)
    dr.line([4, 19, 18, 19], fill=out)
    _rect(dr, 10, 19, 12, 21, (132, 94, 28, 255), border=out)
    return _up2(im)


def _d_cristal():
    im = _canvas2x(13, 20)
    dr = ImageDraw.Draw(im)
    out = (46, 28, 72, 255)
    for (cx, y0, yb, hw) in ((3, 9, 19, 2), (10, 10, 19, 2), (6, 1, 19, 3)):
        for y in range(y0, yb + 1):
            w = max(0, min(hw, (y - y0) // 2 + 1))
            dr.line([cx - w, y, cx + w, y], fill=(164, 106, 232, 255))
            if w >= 1:
                dr.line([cx - w + 1, y, cx, y], fill=(224, 188, 255, 255))
                dr.point((cx + w, y), fill=(112, 64, 178, 255))
            dr.point((cx - w, y), fill=out)
            dr.point((cx + w, y), fill=out)
        dr.line([cx - hw, yb, cx + hw, yb], fill=out)
    dr.point((5, 5), fill=(255, 255, 255, 255))
    dr.point((3, 12), fill=(255, 255, 255, 255))
    return _up2(im)


def _d_brasero():
    im = _canvas2x(13, 20)
    dr = ImageDraw.Draw(im)
    out = (38, 34, 44, 255)
    # Vasque pierre sculptée + socle
    _rect(dr, 2, 17, 10, 19, (124, 126, 138, 255), border=out, hi=(166, 170, 184, 255))
    _rect(dr, 4, 11, 8, 17, (112, 114, 128, 255), border=out, hi=(152, 156, 170, 255))
    _rect(dr, 1, 8, 11, 12, (134, 136, 150, 255), border=out, hi=(182, 186, 200, 255), sh=(82, 84, 98, 255))
    # Flamme vive Gen 5
    dr.polygon([(6, 0), (10, 5), (9, 9), (3, 9), (2, 5)], fill=(238, 92, 34, 255), outline=(126, 36, 18, 255))
    dr.polygon([(6, 2), (8, 6), (8, 9), (4, 9), (4, 6)], fill=(252, 174, 48, 255))
    dr.rectangle([5, 5, 7, 8], fill=(255, 242, 152, 255))
    return _up2(im)


def _d_etai():
    im = _canvas2x(12, 19)
    dr = ImageDraw.Draw(im)
    out = (44, 28, 20, 255)
    _rect(dr, 0, 0, 11, 3, (148, 96, 54, 255), border=out, hi=(192, 138, 86, 255))
    _rect(dr, 1, 3, 3, 18, (134, 84, 46, 255), border=out, hi=(174, 122, 74, 255))
    _rect(dr, 8, 3, 10, 18, (134, 84, 46, 255), border=out, hi=(174, 122, 74, 255))
    _rect(dr, 3, 8, 8, 10, (124, 78, 42, 255), border=out, hi=(164, 114, 68, 255))
    # Ferrures métalliques
    for fx, fy in ((1, 3), (8, 3), (1, 16), (8, 16)):
        dr.rectangle([fx + 1, fy, fx + 1, fy + 1], fill=(122, 128, 142, 255))
    return _up2(im)


def _d_lampe_mine():
    im = _canvas2x(12, 18)
    dr = ImageDraw.Draw(im)
    out = (36, 38, 46, 255)
    _rect(dr, 3, 16, 8, 17, (88, 94, 108, 255), border=out)
    _rect(dr, 5, 7, 6, 16, (98, 104, 118, 255), border=out)
    _rect(dr, 2, 1, 9, 8, (76, 82, 96, 255), border=out, hi=(118, 126, 142, 255))
    _rect(dr, 3, 2, 8, 7, (254, 226, 112, 255), hi=(255, 250, 206, 255))
    return _up2(im)


def _d_telescope():
    im = _canvas2x(12, 19)
    dr = ImageDraw.Draw(im)
    out = (36, 38, 48, 255)
    # Trépied métal
    dr.line([6, 9, 2, 18], fill=out, width=2)
    dr.line([6, 9, 10, 18], fill=out, width=2)
    dr.line([6, 9, 6, 18], fill=(124, 132, 148, 255))
    dr.line([6, 10, 3, 17], fill=(148, 156, 172, 255))
    dr.line([6, 10, 9, 17], fill=(116, 124, 140, 255))
    # Tube laiton doré + lentille bleue
    dr.line([2, 9, 10, 3], fill=out, width=4)
    dr.line([2, 9, 10, 3], fill=(216, 172, 68, 255), width=2)
    dr.line([3, 8, 9, 3], fill=(248, 218, 120, 255), width=1)
    dr.rectangle([9, 2, 11, 4], fill=(126, 198, 246, 255), outline=out)
    return _up2(im)


def _d_wagonnet():
    im = _canvas2x(18, 16)
    dr = ImageDraw.Draw(im)
    out = (34, 36, 44, 255)
    # Tas de minerai & pépites dorées
    dr.polygon([(3, 5), (6, 2), (11, 2), (14, 5)], fill=(76, 72, 82, 255), outline=out)
    for ox, oy, oc in ((6, 3, (242, 198, 72, 255)), (10, 4, (96, 206, 242, 255)), (8, 4, (242, 198, 72, 255))):
        dr.point((ox, oy), fill=oc)
    # Benne acier/bois renforcée
    _rect(dr, 1, 5, 16, 12, (116, 122, 136, 255), border=out, hi=(162, 170, 186, 255), sh=(72, 76, 90, 255))
    _rect(dr, 3, 7, 14, 11, (148, 104, 62, 255), border=(76, 52, 32, 255), hi=(184, 136, 86, 255))
    # Roues métalliques + rail
    for wx in (4, 13):
        dr.ellipse([wx - 2, 11, wx + 2, 15], fill=(92, 98, 112, 255), outline=out)
        dr.point((wx, 13), fill=(186, 194, 208, 255))
    return _up2(im)


# ================================================================== NOUVEAUX MEUBLES INTÉRIEURS GEN 5
def _d_machine_sous():
    """Borne machine à sous Gen 5 du Casino de Métropole (30×54)."""
    im = _canvas2x(15, 27)
    dr = ImageDraw.Draw(im)
    out = (40, 24, 34, 255)
    # Caisson rouge & or avec néons
    _rect(dr, 1, 2, 12, 26, (186, 42, 54, 255), border=out, hi=(234, 86, 92, 255), sh=(122, 24, 34, 255))
    _rect(dr, 2, 0, 11, 3, (242, 198, 68, 255), border=out, hi=(254, 236, 142, 255))
    # Écran 3 rouleaux lumineux « 7-7-7 »
    _rect(dr, 2, 5, 11, 13, (244, 246, 252, 255), border=(46, 48, 62, 255))
    for rx in (3, 6, 9):
        dr.rectangle([rx, 6, rx + 1, 12], fill=(236, 240, 248, 255))
        dr.rectangle([rx, 8, rx + 1, 10], fill=(224, 52, 56, 255) if rx != 6 else (68, 146, 224, 255))
        if rx < 9:
            dr.line([rx + 2, 6, rx + 2, 12], fill=(128, 134, 150, 255))
    # Boutons lumineux + bac à jetons métallique
    _rect(dr, 2, 14, 11, 17, (72, 76, 92, 255), border=out)
    for bx, bc in ((3, (246, 212, 72, 255)), (6, (86, 218, 124, 255)), (9, (238, 76, 82, 255))):
        dr.rectangle([bx, 15, bx + 1, 16], fill=bc)
    _rect(dr, 3, 20, 10, 25, (148, 156, 172, 255), border=out, hi=(198, 206, 220, 255))
    # Levier latéral à boule rouge
    dr.line([13, 12, 13, 7], fill=(166, 174, 190, 255))
    _rect(dr, 12, 5, 14, 7, (232, 62, 62, 255), border=out, hi=(252, 132, 126, 255))
    return _up2(im)


def _d_table_balls():
    """Table des 3 Poké Balls starters du Laboratoire Gen 5 (64×38)."""
    im = _canvas2x(32, 19)
    dr = ImageDraw.Draw(im)
    out = (38, 46, 62, 255)
    # Socle labo blanc/acier + plateau bleu-verre
    _rect(dr, 1, 4, 30, 18, (214, 222, 234, 255), border=out, hi=(244, 248, 254, 255), sh=(142, 154, 174, 255))
    _rect(dr, 3, 6, 28, 12, (124, 174, 218, 255), border=(56, 76, 104, 255), hi=(184, 222, 248, 255))
    _rect(dr, 2, 13, 29, 17, (176, 186, 202, 255), border=out)
    # 3 capsules Poké Balls posées sur leurs socles lumineux
    for cx in (7, 16, 25):
        _rect(dr, cx - 3, 7, cx + 3, 11, (76, 86, 104, 255), border=out)
        dr.ellipse([cx - 2, 2, cx + 2, 6], fill=(244, 246, 252, 255), outline=out)
        dr.pieslice([cx - 2, 2, cx + 2, 6], 180, 360, fill=(224, 58, 52, 255), outline=out)
        dr.line([cx - 2, 4, cx + 2, 4], fill=out)
        dr.point((cx, 4), fill=(252, 252, 255, 255))
    return _up2(im)


def _d_machine_labo():
    """Grand analyseur / ordinateur du Laboratoire Gen 5 (64×68)."""
    im = _canvas2x(32, 34)
    dr = ImageDraw.Draw(im)
    out = (34, 42, 56, 255)
    _rect(dr, 1, 2, 30, 33, (206, 214, 226, 255), border=out, hi=(242, 246, 252, 255), sh=(136, 148, 166, 255))
    _rect(dr, 2, 0, 29, 4, (98, 112, 132, 255), border=out, hi=(142, 158, 180, 255))
    # Double moniteur scientifique (graphique vert + courbe bleue)
    _rect(dr, 3, 6, 16, 16, (34, 52, 56, 255), border=out)
    for gx in range(5, 15, 2):
        dr.line([gx, 14, gx, 9 + ((gx * 3) % 4)], fill=(96, 232, 148, 255))
    _rect(dr, 18, 6, 28, 16, (36, 52, 78, 255), border=out)
    dr.line([20, 13, 23, 9], fill=(124, 212, 252, 255))
    dr.line([23, 9, 26, 12], fill=(124, 212, 252, 255))
    # Pupitre commandes + voyants LED + lecteur disques
    _rect(dr, 3, 18, 28, 25, (148, 158, 174, 255), border=out, hi=(188, 198, 214, 255))
    for i, c in enumerate([(238, 76, 72, 255), (246, 212, 76, 255), (92, 224, 126, 255), (92, 184, 246, 255)]):
        dr.rectangle([5 + i * 3, 20, 6 + i * 3, 21], fill=c)
    _rect(dr, 18, 20, 26, 23, (58, 66, 80, 255), border=out)
    _rect(dr, 3, 27, 28, 32, (112, 122, 138, 255), border=out)
    for y in (29, 31):
        dr.line([5, y, 26, y], fill=(72, 80, 96, 255))
    return _up2(im)


def _d_ecran_carte():
    """Grand écran mural carte de la région Gen 5 (64×54)."""
    im = _canvas2x(32, 27)
    dr = ImageDraw.Draw(im)
    out = (34, 42, 56, 255)
    _rect(dr, 1, 1, 30, 22, (74, 84, 102, 255), border=out, hi=(124, 136, 158, 255))
    _rect(dr, 3, 3, 28, 20, (76, 156, 214, 255), border=(38, 56, 82, 255))
    # Continent vert/sable/neige stylisé + points de villes
    dr.polygon([(6, 16), (9, 7), (18, 5), (25, 10), (24, 17), (14, 18)], fill=(116, 192, 104, 255), outline=(66, 126, 68, 255))
    dr.rectangle([18, 12, 23, 16], fill=(232, 206, 146, 255))
    dr.rectangle([10, 6, 17, 8], fill=(238, 246, 254, 255))
    for vx, vy in ((10, 14), (14, 11), (19, 9), (21, 14)):
        dr.point((vx, vy), fill=(242, 72, 68, 255))
    _rect(dr, 12, 22, 19, 26, (92, 102, 118, 255), border=out, hi=(142, 152, 170, 255))
    return _up2(im)


def _d_sanctuaire():
    """Sanctuaire / autel sacré pierre & or Gen 5 (64×74)."""
    im = _canvas2x(32, 37)
    dr = ImageDraw.Draw(im)
    out = (42, 38, 48, 255)
    # Marches + autel pierre sculptée + colonnettes + orbe doré
    _rect(dr, 1, 30, 30, 36, (164, 160, 156, 255), border=out, hi=(206, 202, 198, 255), sh=(112, 108, 106, 255))
    _rect(dr, 4, 22, 27, 30, (194, 188, 178, 255), border=out, hi=(228, 224, 214, 255))
    _rect(dr, 11, 24, 20, 29, (226, 186, 72, 255), border=(84, 62, 22, 255), hi=(250, 224, 124, 255))
    # Stèle centrale + colonnes
    for px_c in (5, 24):
        _rect(dr, px_c, 6, px_c + 3, 22, (214, 208, 198, 255), border=out, hi=(242, 238, 230, 255))
    _rect(dr, 10, 3, 21, 22, (176, 172, 168, 255), border=out, hi=(214, 210, 206, 255))
    dr.ellipse([12, 7, 19, 14], fill=(92, 182, 244, 255), outline=(228, 188, 72, 255))
    dr.point((14, 9), fill=(224, 248, 255, 255))
    return _up2(im)


def _d_trone():
    """Trône royal du Maître de la Ligue Gen 5 en or & velours pourpre (64×78)."""
    im = _canvas2x(32, 39)
    dr = ImageDraw.Draw(im)
    out = (44, 26, 38, 255)
    gold, ghi, gsh = (228, 186, 72, 255), (252, 228, 128, 255), (154, 114, 34, 255)
    vel, vhi, vsh = (156, 42, 68, 255), (206, 74, 102, 255), (96, 24, 42, 255)
    # Estrade de marbre + tapis
    _rect(dr, 1, 32, 30, 38, (214, 216, 228, 255), border=out, hi=(244, 246, 254, 255))
    _rect(dr, 8, 32, 23, 38, vel, border=gold)
    # Haut dossier sculpté or & velours
    _rect(dr, 7, 4, 24, 26, gold, border=out, hi=ghi, sh=gsh)
    _rect(dr, 10, 8, 21, 24, vel, border=vsh, hi=vhi)
    # Couronne dorée au sommet
    _rect(dr, 11, 1, 20, 5, gold, border=out, hi=ghi)
    dr.point((15, 2), fill=(112, 192, 252, 255)); dr.point((16, 2), fill=(112, 192, 252, 255))
    # Accoudoirs & assise
    _rect(dr, 4, 19, 8, 32, gold, border=out, hi=ghi)
    _rect(dr, 23, 19, 27, 32, gold, border=out, hi=ghi)
    _rect(dr, 8, 24, 23, 31, vel, border=gold, hi=vhi, sh=vsh)
    return _up2(im)


def _d_livres():
    """Bibliothèque en chêne Gen 5 remplie de livres colorés (32×40)."""
    im = _canvas2x(16, 20)
    dr = ImageDraw.Draw(im)
    out = (44, 28, 20, 255)
    _rect(dr, 0, 0, 15, 19, (152, 102, 58, 255), border=out, hi=(196, 146, 92, 255), sh=(104, 66, 34, 255))
    cols = [(216, 68, 64, 255), (72, 138, 212, 255), (84, 178, 92, 255), (236, 192, 68, 255), (168, 92, 204, 255)]
    for row_i, ry in enumerate((2, 8, 14)):
        dr.rectangle([2, ry, 13, ry + 4], fill=(74, 48, 28, 255))
        for b_i in range(6):
            c = cols[(b_i + row_i * 2) % len(cols)]
            bx = 2 + b_i * 2
            dr.rectangle([bx, ry + 1, bx + 1, ry + 4], fill=c)
        dr.line([1, ry + 5, 14, ry + 5], fill=(182, 132, 78, 255))
    return _up2(im)


# ================================================================== #11 NEIGE GÉNÉREUSE SUR BOUTIQUES ENNEIGÉES
def _snow_boutique_generous(im, awning_y_range=None):
    """Pose d'épaisses congères bleu-glace B2W2 sur tout le haut du toit + la corniche médiane + l'auvent."""
    im = im.convert('RGBA').copy()
    px = im.load()
    w, h = im.size
    top_ys = [next((y for y in range(h) if px[x, y][3] > 200), None) for x in range(w)]
    # 1. Grande congère ondulée sur le toit supérieur (16..22 px d'épaisseur, assortie à b_centre_neige !)
    for x in range(2, w - 2):
        ty = top_ys[x]
        if ty is None or ty > 60:
            continue
        wave = round(3.0 * math.sin(x * 0.16) + 2.0 * math.cos(x * 0.37))
        depth = 18 + wave
        for dy in range(depth):
            y = ty + dy
            if y >= h:
                break
            r, g, b, a = px[x, y]
            if a < 128:
                continue
            if dy == 0:
                px[x, y] = (54, 64, 88, a)
            elif dy == depth - 1:
                px[x, y] = (146, 174, 210, a)
            elif dy >= depth - 3:
                px[x, y] = (196, 218, 240, a)
            elif dy <= 2:
                px[x, y] = (246, 250, 255, a)
            else:
                px[x, y] = (226, 238, 252, a)
    # 2. Neige accumulée sur la corniche blanche/grise médiane (fronton au-dessus de la façade, y ~ 56..88)
    for x in range(4, w - 4):
        for y in range(52, min(h - 40, 88)):
            r, g, b, a = px[x, y]
            if a > 200 and r > 185 and g > 180 and b > 170:
                wave2 = 4 + ((x * 5) % 3)
                for dy in range(wave2):
                    if y + dy < h and px[x, y + dy][3] > 200:
                        px[x, y + dy] = (244, 250, 255, 255) if dy < 2 else ((210, 228, 246, 255) if dy < wave2 - 1 else (154, 182, 216, 255))
                break
    # 3. Couche de neige sur l'auvent d'entrée
    if awning_y_range:
        y0, y1, x0, x1 = awning_y_range
        for x in range(x0, min(w - 2, x1)):
            wave3 = 5 + ((x * 3) % 3)
            for dy in range(wave3):
                y = y0 + dy
                if y < y1 and px[x, y][3] > 200:
                    px[x, y] = (242, 248, 255, 255) if dy < 2 else ((206, 226, 246, 255) if dy < wave3 - 1 else (152, 180, 214, 255))
    return im


def appliquer_moyens(root, out_dir, cols, noms, decos, bat_dims):
    """Applique les correctifs #10 (tuiles intérieures + décors/meubles Gen 5) et #11 (neige boutiques)."""
    # 1. Mise à jour / extension de sol.png avec toutes les tuiles d'intérieur Gen 5
    sol_path = os.path.join(out_dir, 'sol.png')
    sol = Image.open(sol_path).convert('RGBA')
    idx_of = {n: i for i, n in enumerate(noms)}

    int_tiles = {
        'x_counter': _mk_counter_top(),
        'x_counterfront': _mk_counter_front(mart=False),
        'x_martfront': _mk_counter_front(mart=True),
        'x_shelf': _mk_shelf(),
        'x_mat': _mk_mat(),
        'floor_wood': _mk_floor_wood(),
        'floor_white': _mk_floor_grid((236, 240, 246, 255), (250, 252, 255, 255), (192, 202, 216, 255), step=8),
        'floor_marble': _mk_floor_grid((238, 232, 220, 255), (250, 246, 238, 255), (194, 186, 172, 255), step=8, checker=(222, 216, 204, 255)),
        'floor_stone': _mk_floor_grid((178, 172, 162, 255), (206, 200, 190, 255), (126, 120, 112, 255), step=8),
        'floor_metal': _mk_floor_metal(),
        'floor_dark': _mk_floor_grid((76, 72, 86, 255), (98, 94, 112, 255), (50, 46, 58, 255), step=8),
        'floor_dark2': _mk_floor_grid((88, 66, 62, 255), (114, 86, 80, 255), (58, 42, 40, 255), step=8),
        'floor_blue2': _mk_floor_grid((136, 192, 228, 255), (178, 222, 248, 255), (92, 144, 188, 255), step=8, checker=(122, 178, 216, 255)),
        'tatami': _mk_tatami(),
        'carpet': _mk_carpet(),
    }

    for k in sorted(int_tiles):
        if k not in idx_of:
            idx_of[k] = len(noms)
            noms.append(k)
    need_rows = math.ceil(len(noms) / cols)
    new_sol = Image.new('RGBA', (cols * 16, need_rows * 16), (0, 0, 0, 0))
    new_sol.paste(sol, (0, 0))
    for k, tile in int_tiles.items():
        i = idx_of[k]
        new_sol.paste(tile, ((i % cols) * 16, (i // cols) * 16))
    new_sol.save(sol_path)

    # 2. Refonte des 14 décors plats/semi-transparents + ajout des 7 meubles intérieurs majeurs
    new_decos = {
        'lamp': _d_lamp(),
        'deadtree': _d_deadtree(),
        'sofa': _d_sofa(),
        'table': _d_table(),
        'tv': _d_tv(),
        'bed': _d_bed(),
        'fridge': _d_fridge(),
        'cloche': _d_cloche(),
        'cristal': _d_cristal(),
        'brasero': _d_brasero(),
        'etai': _d_etai(),
        'lampe_mine': _d_lampe_mine(),
        'telescope': _d_telescope(),
        'wagonnet': _d_wagonnet(),
        'machine_sous': _d_machine_sous(),
        'table_balls': _d_table_balls(),
        'machine_labo': _d_machine_labo(),
        'ecran_carte': _d_ecran_carte(),
        'sanctuaire': _d_sanctuaire(),
        'trone': _d_trone(),
        'livres': _d_livres(),
    }
    for nom, im in new_decos.items():
        im.save(os.path.join(out_dir, f'd_{nom}.png'))
        decos[nom] = im

    # 3. Neige hivernale généreuse B2W2 sur b_boutique_neige_b et b_boutique_neige (#11)
    bb_path = os.path.join(out_dir, 'b_boutique_b.png')
    bnb_path = os.path.join(out_dir, 'b_boutique_neige_b.png')
    if os.path.exists(bb_path):
        im_nb = _snow_boutique_generous(Image.open(bb_path), awning_y_range=(112, 126, 20, 128))
        im_nb.save(bnb_path)
        bat_dims['boutique_neige_b'] = [im_nb.width, 75]

    bn_path = os.path.join(out_dir, 'b_boutique_neige.png')
    if os.path.exists(bn_path):
        im_n = _snow_boutique_generous(Image.open(bn_path), awning_y_range=(92, 108, 6, 144))
        im_n.save(bn_path)
        bat_dims['boutique_neige'] = [im_n.width, 116]
