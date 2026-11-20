"""
Compléments pixel-art 2D B2W2 pour tous les bâtiments extérieurs restants
(étals, puits, chalets, auberges, maisons en L, maisons étendues, boulangerie,
cabanes, grange, moulin, phare, kiosque, maison de thé, Usine Poké Ball, Ligue,
Pagode, Pavillon, Tour Cendrée, Tour Mirage).
"""
import os
import numpy as np
from PIL import Image, ImageDraw


def _px(w, h):
    return Image.new('RGBA', (w, h), (0, 0, 0, 0))


def _box(dr, x0, y0, x1, y1, fill, border=(32, 34, 42, 255), hi=None, sh=None):
    dr.rectangle([x0, y0, x1, y1], fill=fill)
    if border:
        dr.rectangle([x0, y0, x1, y1], outline=border)
    if hi:
        dr.line([x0 + 1, y0 + 1, x1 - 1, y0 + 1], fill=hi)
    if sh:
        dr.line([x0 + 1, y1 - 1, x1 - 1, y1 - 1], fill=sh)


def _tile_h(src, w):
    out = _px(w, src.height)
    for x in range(0, w, src.width):
        out.alpha_composite(src.crop((0, 0, min(src.width, w - x), src.height)), (x, 0))
    return out


def _win(dr, x0, y0, w=20, h=22, frame=(44, 48, 60, 255), glass=(112, 176, 224, 255), lit=(176, 224, 252, 255)):
    _box(dr, x0, y0, x0 + w, y0 + h, frame, border=(24, 26, 34, 255))
    dr.rectangle([x0 + 2, y0 + 2, x0 + w - 2, y0 + h - 2], fill=glass)
    dr.line([x0 + 3, y0 + 3, x0 + w - 3, y0 + 3], fill=lit)
    dr.line([x0 + 3, y0 + 4, x0 + 6, y0 + 4], fill=(236, 248, 255, 255))
    dr.line([x0 + w // 2, y0 + 2, x0 + w // 2, y0 + h - 2], fill=frame)
    dr.line([x0 + 2, y0 + h // 2, x0 + w - 2, y0 + h // 2], fill=frame)


def _door(dr, cx, yb, w=28, h=38, fill=(144, 92, 52, 255), glass=False):
    x0, x1 = cx - w // 2, cx + w // 2
    y0 = yb - h
    _box(dr, x0 - 2, y0 - 2, x1 + 2, yb, (76, 68, 64, 255), border=(28, 28, 34, 255), hi=(112, 102, 96, 255))
    _box(dr, x0, y0, x1, yb - 1, (76, 152, 214, 255) if glass else fill, border=(28, 24, 22, 255))
    if glass:
        dr.line([x0 + 2, y0 + 2, x1 - 2, y0 + 2], fill=(164, 220, 252, 255))
        dr.line([cx, y0 + 2, cx, yb - 2], fill=(40, 68, 102, 255))
    else:
        dr.rectangle([x0 + 4, y0 + 5, cx - 2, y0 + 16], fill=(110, 66, 34, 255))
        dr.rectangle([cx + 2, y0 + 5, x1 - 4, y0 + 16], fill=(110, 66, 34, 255))
        dr.rectangle([x1 - 7, y0 + h // 2, x1 - 5, y0 + h // 2 + 3], fill=(236, 198, 72, 255))
    dr.rectangle([x0 - 4, yb - 3, x1 + 4, yb], fill=(182, 178, 168, 255), outline=(48, 46, 52, 255))


def _pitched_roof(dr, w, h, c_main, c_hi, c_sh, border=(30, 32, 40, 255)):
    for y in range(h):
        inset = max(0, int((h - 1 - y) * 0.25))
        col = c_hi if y < 5 else (c_sh if y > h - 6 else c_main)
        dr.line([inset, y, w - 1 - inset, y], fill=col)
        if y % 6 == 0 and 4 < y < h - 4:
            dr.line([inset + 1, y, w - 2 - inset, y], fill=c_sh)
    dr.line([0, h - 1, w - 1, h - 1], fill=border)
    dr.line([0, h - 2, w - 1, h - 2], fill=c_sh)
    dr.line([max(0, int((h - 1) * 0.25)), 0, w - 1 - max(0, int((h - 1) * 0.25)), 0], fill=border)
    for y in range(h):
        inset = max(0, int((h - 1 - y) * 0.25))
        dr.point((inset, y), fill=border)
        dr.point((w - 1 - inset, y), fill=border)


def _etal():
    im = _px(64, 68)
    dr = ImageDraw.Draw(im)
    # Comptoir bois & marchandises colorées
    _box(dr, 4, 38, 59, 65, (148, 98, 54, 255), border=(34, 26, 22, 255), hi=(196, 146, 92, 255), sh=(104, 64, 32, 255))
    dr.rectangle([8, 46, 55, 62], fill=(116, 74, 38, 255))
    for i, c in enumerate([(228, 72, 68, 255), (244, 198, 62, 255), (86, 186, 92, 255), (88, 152, 232, 255)]):
        dr.rectangle([10 + i * 11, 34, 19 + i * 11, 41], fill=c, outline=(40, 28, 22, 255))
    # Poteaux & auvent rayé rouge/crème
    _box(dr, 6, 18, 9, 44, (132, 86, 46, 255), border=(34, 26, 22, 255))
    _box(dr, 54, 18, 57, 44, (132, 86, 46, 255), border=(34, 26, 22, 255))
    for y in range(4, 26):
        dr.line([2, y, 61, y], fill=(224, 68, 60, 255) if y < 14 else (204, 52, 46, 255))
    for bx in range(4, 60, 12):
        dr.rectangle([bx, 5, min(60, bx + 5), 25], fill=(246, 238, 220, 255))
    dr.rectangle([2, 4, 61, 25], outline=(38, 28, 30, 255))
    for bx in range(2, 60, 6):
        col = (196, 44, 38, 255) if (bx // 6) % 2 == 0 else (216, 206, 188, 255)
        dr.rectangle([bx, 25, min(61, bx + 5), 29], fill=col, outline=(38, 28, 30, 255))
    return im


def _puits():
    im = _px(64, 72)
    dr = ImageDraw.Draw(im)
    # Toit de bardeaux + poteaux
    _pitched_roof(dr, 64, 22, (136, 92, 56, 255), (172, 122, 78, 255), (96, 62, 34, 255))
    _box(dr, 12, 22, 16, 44, (112, 74, 42, 255))
    _box(dr, 47, 22, 51, 44, (112, 74, 42, 255))
    dr.line([16, 30, 47, 30], fill=(82, 54, 32, 255), width=2)
    dr.line([32, 30, 32, 40], fill=(180, 152, 110, 255))
    # Margelle de pierre + eau bleue
    _box(dr, 8, 42, 55, 69, (148, 152, 162, 255), border=(34, 36, 44, 255), hi=(196, 200, 208, 255), sh=(102, 106, 118, 255))
    _box(dr, 14, 44, 49, 54, (64, 148, 222, 255), border=(56, 60, 72, 255), hi=(132, 204, 246, 255))
    for y in range(57, 68, 4):
        dr.line([9, y, 54, y], fill=(102, 106, 118, 255))
        for x in range(12 + ((y // 4) % 2) * 5, 52, 10):
            dr.line([x, y, x, min(68, y + 3)], fill=(102, 106, 118, 255))
    return im


def _shingle_roof(dr, w, h, c_main, c_hi, c_sh, border=(30, 32, 40, 255)):
    """Toit pixel-art DS texturé par rangées de tuiles décalées."""
    _pitched_roof(dr, w, h, c_main, c_hi, c_sh, border=border)
    for y in range(4, h - 4, 4):
        inset = max(2, int((h - 1 - y) * 0.25) + 2)
        for x in range(inset + (((y // 4) % 2) * 4), w - 2 - inset, 8):
            dr.line([x, y, x, min(h - 3, y + 2)], fill=c_sh)
            if x + 1 < w - 2 - inset and y < h - 8:
                dr.point((x + 1, y + 1), fill=c_hi)


def _planks(dr, x0, y0, x1, y1, base, hi, sh, step=6):
    for y in range(y0 + step, y1, step):
        dr.line([x0 + 1, y, x1 - 1, y], fill=sh)
        if y + 1 < y1:
            dr.line([x0 + 1, y + 1, x1 - 1, y + 1], fill=hi)
        for x in range(x0 + 10 + (((y // step) % 2) * 14), x1 - 4, 28):
            dr.line([x, y - step + 1, x, y - 1], fill=sh)
    # Poteaux d'angle chêne sombre
    dr.rectangle([x0 + 1, y0 + 1, x0 + 4, y1 - 1], fill=sh)
    dr.rectangle([x1 - 4, y0 + 1, x1 - 1, y1 - 1], fill=sh)


def _bricks(dr, x0, y0, x1, y1, sh):
    for y in range(y0 + 6, y1, 6):
        dr.line([x0 + 1, y, x1 - 1, y], fill=sh)
        for x in range(x0 + 6 + (((y // 6) % 2) * 8), x1 - 3, 16):
            dr.line([x, y - 5, x, y - 1], fill=sh)


def _chalet():
    im = _px(160, 166)
    dr = ImageDraw.Draw(im)
    # Murs rondins texturés chêne chaud + soubassement pierre appareillée
    _box(dr, 4, 72, 155, 163, (176, 124, 76, 255), border=(38, 26, 20, 255))
    _planks(dr, 4, 74, 155, 150, (176, 124, 76, 255), (204, 154, 104, 255), (126, 80, 44, 255), step=6)
    _box(dr, 4, 150, 155, 163, (124, 122, 126, 255), border=(36, 36, 42, 255), hi=(164, 162, 166, 255))
    _bricks(dr, 4, 150, 155, 163, (90, 88, 94, 255))
    # Cheminée pierre droite
    _box(dr, 126, 10, 142, 48, (132, 124, 120, 255), border=(36, 32, 34, 255), hi=(174, 166, 160, 255))
    _bricks(dr, 126, 12, 142, 46, (96, 88, 86, 255))
    # Toit ardoise-sapin en bardeaux DS
    _shingle_roof(dr, 160, 82, (62, 92, 76, 255), (88, 128, 106, 255), (40, 64, 52, 255))
    _door(dr, 48, 163, w=28, h=40, fill=(116, 70, 38, 255))
    _win(dr, 86, 112, w=24, h=24, frame=(78, 52, 32, 255))
    _win(dr, 120, 112, w=24, h=24, frame=(78, 52, 32, 255))
    _box(dr, 84, 136, 112, 142, (92, 62, 34, 255))
    _box(dr, 118, 136, 146, 142, (92, 62, 34, 255))
    for fx in (88, 96, 104, 122, 130, 138):
        dr.rectangle([fx, 134, fx + 3, 136], fill=(236, 92, 112, 255) if fx % 2 == 0 else (246, 206, 72, 255))
    return im


def _auberge(bat_imgs):
    src = bat_imgs['maison_c']
    im = _px(192, max(206, src.height))
    sub = src.resize((192, im.height), Image.NEAREST) if src.width != 192 else src
    im.alpha_composite(sub, (0, im.height - sub.height))
    dr = ImageDraw.Draw(im)
    # Grande double porte centrée à x = 96 (door2X=[2,3] -> 3.0)
    _box(dr, 66, im.height - 54, 126, im.height - 1, (192, 152, 104, 255), border=(38, 30, 26, 255))
    _door(dr, 96, im.height, w=38, h=44, fill=(132, 76, 40, 255), glass=True)
    # Enseigne suspendue d'auberge décalée à gauche sur le mur (sans chevaucher la porte)
    _box(dr, 22, im.height - 62, 48, im.height - 46, (68, 132, 82, 255), border=(36, 28, 22, 255), hi=(112, 184, 126, 255))
    dr.rectangle([26, im.height - 58, 44, im.height - 50], fill=(242, 214, 118, 255))
    return im


def _maison_l(bat_imgs):
    # Vraie maison en L (160x192) : tuiles texturées & crépi DS issu du kit
    im = _px(160, 192)
    dr = ImageDraw.Draw(im)
    # Aile droite arrière (x=54..158, y=14..128)
    _box(dr, 54, 52, 158, 127, (226, 216, 194, 255), border=(38, 36, 40, 255), sh=(188, 176, 152, 255))
    _bricks(dr, 54, 54, 158, 114, (208, 198, 176, 255))
    _box(dr, 54, 114, 158, 127, (148, 140, 132, 255), border=(38, 36, 40, 255))
    _bricks(dr, 54, 114, 158, 127, (112, 104, 98, 255))
    roof_r = _px(108, 48)
    _shingle_roof(ImageDraw.Draw(roof_r), 108, 48, (74, 118, 176, 255), (104, 152, 212, 255), (48, 82, 132, 255))
    im.alpha_composite(roof_r, (52, 12))
    _door(dr, 80, 127, w=26, h=38, fill=(138, 86, 48, 255))
    _win(dr, 108, 76, w=20, h=22)
    _win(dr, 134, 76, w=20, h=22)
    # Aile gauche avancée (x=0..64, y=28..191)
    _box(dr, 2, 78, 63, 190, (236, 226, 204, 255), border=(38, 36, 40, 255), sh=(196, 184, 160, 255))
    _bricks(dr, 2, 80, 63, 176, (216, 206, 184, 255))
    _box(dr, 2, 176, 63, 190, (148, 140, 132, 255), border=(38, 36, 40, 255))
    _bricks(dr, 2, 176, 63, 190, (112, 104, 98, 255))
    roof_l = _px(66, 56)
    _shingle_roof(ImageDraw.Draw(roof_l), 66, 56, (82, 128, 188, 255), (114, 164, 222, 255), (52, 88, 140, 255))
    im.alpha_composite(roof_l, (0, 26))
    _win(dr, 16, 98, w=28, h=24)
    _win(dr, 16, 140, w=28, h=22)
    return im


def _maison_ext(bat_imgs):
    # Villa longue 7x4 (224x176) avec porte à gauche (x=48 -> door=1 exact)
    base = bat_imgs['maison_f_bleue']
    im = _px(224, base.height)
    im.alpha_composite(base, (0, 0))
    # Prolonge proprement la travée de droite (62 px) à partir des colonnes 96..158 de maison_f_bleue
    ext = base.crop((92, 0, 154, base.height))
    im.alpha_composite(ext, (150, 0))
    dr = ImageDraw.Draw(im)
    edge = base.crop((154, 0, 162, base.height))
    im.alpha_composite(edge, (212, 0))
    dr.line([219, 28, 219, base.height - 2], fill=(40, 42, 48, 255))
    return im


def _boulangerie(bat_imgs):
    # Boulangerie 4x4 (148x180) avec porte à 48 px : base maison_a_g + vitrine pains dorés + enseigne croissant
    base = bat_imgs['maison_a_g']
    im = base.copy()
    dr = ImageDraw.Draw(im)
    _box(dr, 72, im.height - 46, 138, im.height - 14, (78, 52, 34, 255), border=(38, 24, 18, 255))
    _box(dr, 75, im.height - 43, 135, im.height - 17, (252, 226, 156, 255), border=(112, 76, 42, 255), hi=(255, 246, 204, 255))
    # Pains et brioches dans l'étalage derrière la vitre
    for row_y in (im.height - 37, im.height - 27):
        dr.line([76, row_y + 7, 134, row_y + 7], fill=(142, 92, 46, 255))
        for bx in range(79, 130, 13):
            dr.rectangle([bx, row_y, bx + 9, row_y + 6], fill=(214, 136, 54, 255), outline=(138, 76, 26, 255))
            dr.line([bx + 2, row_y + 2, bx + 6, row_y + 2], fill=(246, 198, 108, 255))
    # Auvent rayé orange/crème au-dessus de la vitrine et porte
    for y in range(im.height - 60, im.height - 46):
        dr.line([16, y, 142, y], fill=(216, 98, 42, 255))
    for bx in range(20, 138, 16):
        dr.rectangle([bx, im.height - 59, min(140, bx + 7), im.height - 47], fill=(248, 240, 224, 255))
    dr.rectangle([16, im.height - 60, 142, im.height - 46], outline=(54, 34, 24, 255))
    return im


def _maison_the(bat_imgs):
    # Maison de thé traditionnelle 160x182, porte centrée à 80 px (door=2 exact)
    im = _px(160, 182)
    dr = ImageDraw.Draw(im)
    _box(dr, 8, 76, 151, 179, (238, 226, 202, 255), border=(44, 32, 28, 255), sh=(198, 182, 156, 255))
    for y in range(84, 162, 16):
        dr.line([10, y, 149, y], fill=(216, 202, 176, 255))
    for cx in (12, 44, 114, 146):
        dr.rectangle([cx - 2, 78, cx + 2, 178], fill=(116, 68, 42, 255))
    _box(dr, 8, 164, 151, 179, (112, 108, 114, 255), border=(44, 32, 28, 255))
    _bricks(dr, 8, 164, 151, 179, (76, 72, 80, 255))
    # Toit à deux pans foncé texturé tuiles Johto/Unys
    _shingle_roof(dr, 160, 56, (58, 72, 92, 255), (84, 102, 128, 255), (38, 48, 66, 255))
    dr.rectangle([0, 54, 159, 64], fill=(48, 60, 78, 255), outline=(28, 32, 40, 255))
    _shingle_roof(dr, 160, 26, (58, 72, 92, 255), (84, 102, 128, 255), (38, 48, 66, 255))
    _door(dr, 80, 179, w=32, h=42, fill=(214, 198, 168, 255))
    _win(dr, 18, 114, w=22, h=26, frame=(104, 62, 36, 255), glass=(248, 232, 186, 255), lit=(255, 248, 220, 255))
    _win(dr, 120, 114, w=22, h=26, frame=(104, 62, 36, 255), glass=(248, 232, 186, 255), lit=(255, 248, 220, 255))
    for lx in (56, 103):
        _box(dr, lx - 5, 114, lx + 5, 130, (226, 68, 52, 255), border=(48, 20, 18, 255), hi=(248, 164, 96, 255))
    return im


def _cabane(w=128, h=124, fisher=False):
    im = _px(w, h)
    dr = ImageDraw.Draw(im)
    rh = 48
    _box(dr, 6, rh - 4, w - 7, h - 2, (162, 114, 72, 255) if not fisher else (136, 152, 168, 255), border=(34, 28, 24, 255))
    _planks(dr, 6, rh, w - 7, h - 14,
            (162, 114, 72, 255) if not fisher else (136, 152, 168, 255),
            (186, 138, 92, 255) if not fisher else (162, 178, 196, 255),
            (116, 76, 44, 255) if not fisher else (98, 112, 128, 255), step=6)
    _box(dr, 6, h - 14, w - 7, h - 2, (116, 114, 118, 255), border=(34, 34, 40, 255))
    _bricks(dr, 6, h - 14, w - 7, h - 2, (84, 82, 88, 255))
    _shingle_roof(dr, w, rh, (124, 72, 46, 255) if not fisher else (62, 108, 164, 255),
                  (158, 98, 66, 255) if not fisher else (92, 144, 204, 255),
                  (86, 48, 30, 255) if not fisher else (42, 74, 118, 255))
    _door(dr, w // 2, h - 2, w=24, h=34, fill=(104, 62, 34, 255))
    _win(dr, 16, rh + 16, w=20, h=20)
    _win(dr, w - 37, rh + 16, w=20, h=20)
    if fisher:
        _box(dr, w - 26, rh + 42, w - 12, rh + 56, (224, 68, 56, 255), border=(38, 22, 22, 255), hi=(248, 244, 240, 255))
    else:
        for bx in (12, 19, 26):
            _box(dr, bx, h - 18, bx + 6, h - 8, (144, 96, 56, 255), border=(38, 26, 18, 255))
    return im


def _grange(bw):
    # Grange rurale B2W2 6x5 (192x176) + bottes de foin tirées de kit_bw_set.png
    im = _px(192, 176)
    dr = ImageDraw.Draw(im)
    _box(dr, 8, 72, 183, 173, (176, 58, 48, 255), border=(38, 20, 20, 255), hi=(208, 86, 72, 255), sh=(128, 38, 32, 255))
    for x in range(16, 176, 14):
        dr.line([x, 76, x, 168], fill=(138, 42, 34, 255))
    _pitched_roof(dr, 192, 78, (108, 96, 88, 255), (144, 130, 120, 255), (72, 62, 58, 255))
    # Grande double porte blanche X + grenier
    _box(dr, 66, 114, 125, 173, (236, 228, 212, 255), border=(46, 36, 32, 255))
    _box(dr, 70, 118, 121, 172, (156, 48, 40, 255), border=(236, 228, 212, 255))
    dr.line([96, 116, 96, 172], fill=(236, 228, 212, 255), width=2)
    dr.line([70, 120, 94, 170], fill=(236, 228, 212, 255), width=2)
    dr.line([98, 120, 120, 170], fill=(236, 228, 212, 255), width=2)
    _box(dr, 80, 82, 111, 106, (102, 70, 42, 255), border=(236, 228, 212, 255))
    # Botte de foin issue du kit BW
    foin = bw.crop((0, 25388, 128, 25490)).resize((46, 36), Image.NEAREST)
    im.alpha_composite(foin, (140, 138))
    return im


def _moulin():
    im = _px(128, 208)
    dr = ImageDraw.Draw(im)
    # Corps cylindrique pierre/crème + toit cône bleu
    for y in range(62, 206):
        hw = 34 + int((y - 62) * 0.14)
        cx = 64
        dr.line([cx - hw, y, cx + hw, y], fill=(224, 214, 194, 255) if y < 176 else (136, 132, 136, 255))
        dr.line([cx + hw - 8, y, cx + hw, y], fill=(186, 176, 156, 255))
        dr.point((cx - hw, y), fill=(40, 38, 44, 255))
        dr.point((cx + hw, y), fill=(40, 38, 44, 255))
    dr.line([20, 205, 108, 205], fill=(40, 38, 44, 255))
    for y in range(20, 64):
        hw = max(3, int((y - 18) * 0.9))
        dr.line([64 - hw, y, 64 + hw, y], fill=(64, 102, 162, 255) if y < 56 else (46, 74, 120, 255))
        dr.point((64 - hw, y), fill=(32, 36, 48, 255))
        dr.point((64 + hw, y), fill=(32, 36, 48, 255))
    _door(dr, 64, 205, w=26, h=36, fill=(134, 84, 46, 255))
    # 4 ailes de moulin croisées en X (centrées sur le moyeu y=78)
    cx, cy = 64, 78
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        dr.line([cx, cy, cx + sx * 52, cy + sy * 52], fill=(96, 62, 36, 255), width=4)
        poly = [
            (cx + sx * 14, cy + sy * 14),
            (cx + sx * 52, cy + sy * 52),
            (cx + sx * 52 - sy * 14, cy + sy * 52 + sx * 14),
            (cx + sx * 14 - sy * 12, cy + sy * 14 + sx * 12),
        ]
        dr.polygon(poly, fill=(244, 236, 214, 255), outline=(120, 96, 68, 255))
    _box(dr, cx - 5, cy - 5, cx + 5, cy + 5, (148, 98, 52, 255), border=(38, 28, 22, 255))
    return im


def _phare():
    im = _px(96, 224)
    dr = ImageDraw.Draw(im)
    cx = 48
    for y in range(62, 222):
        hw = 20 + int((y - 62) * 0.14)
        band = ((y - 62) // 32) % 2 == 0
        col = (224, 230, 238, 255) if band else (216, 68, 58, 255)
        sh = (182, 190, 204, 255) if band else (168, 46, 40, 255)
        dr.line([cx - hw, y, cx + hw, y], fill=col)
        dr.line([cx + hw - 7, y, cx + hw, y], fill=sh)
        dr.point((cx - hw, y), fill=(32, 34, 42, 255))
        dr.point((cx + hw, y), fill=(32, 34, 42, 255))
    dr.line([cx - 42, 221, cx + 42, 221], fill=(32, 34, 42, 255))
    # Galerie & lanterne lumineuse dorée en haut
    _box(dr, cx - 26, 56, cx + 26, 64, (84, 92, 110, 255), border=(32, 34, 42, 255))
    _box(dr, cx - 16, 28, cx + 16, 56, (254, 232, 118, 255), border=(42, 46, 58, 255), hi=(255, 250, 200, 255))
    for y in range(6, 28):
        hw = max(2, int((y - 6) * 0.9))
        dr.line([cx - hw, y, cx + hw, y], fill=(208, 62, 54, 255))
        dr.point((cx - hw, y), fill=(36, 24, 26, 255))
        dr.point((cx + hw, y), fill=(36, 24, 26, 255))
    _door(dr, cx, 221, w=24, h=34, fill=(78, 86, 102, 255))
    _win(dr, cx - 7, 112, w=14, h=18)
    return im


def _kiosque(bw):
    # Pavillon de parc B2W2 128x152 à bardeaux texturés & colonnes pierre
    im = _px(128, 152)
    dr = ImageDraw.Draw(im)
    _box(dr, 12, 124, 115, 149, (198, 192, 180, 255), border=(48, 46, 52, 255), hi=(234, 228, 218, 255))
    _bricks(dr, 12, 126, 115, 149, (152, 146, 138, 255))
    for px_c in (16, 44, 82, 108):
        _box(dr, px_c, 62, px_c + 4, 128, (232, 224, 206, 255), border=(62, 56, 52, 255))
    _box(dr, 18, 110, 44, 124, (148, 102, 60, 255), border=(48, 34, 24, 255))
    _box(dr, 82, 110, 108, 124, (148, 102, 60, 255), border=(48, 34, 24, 255))
    _shingle_roof(dr, 128, 64, (74, 146, 112, 255), (108, 186, 148, 255), (48, 102, 76, 255))
    _box(dr, 62, 0, 65, 8, (240, 196, 68, 255), border=(72, 54, 22, 255))
    return im


def _tour_mirage(bat_imgs):
    # Tour Mirage 128x192 : pierre sable texturée + porte centrée à 48 (door=1 exact)
    im = _px(128, 192)
    dr = ImageDraw.Draw(im)
    _box(dr, 12, 34, 115, 189, (222, 196, 146, 255), border=(68, 52, 38, 255), hi=(242, 220, 174, 255), sh=(184, 156, 108, 255))
    _bricks(dr, 12, 36, 115, 188, (194, 166, 118, 255))
    for y in (52, 92, 134):
        _box(dr, 10, y, 117, y + 8, (186, 152, 102, 255), border=(68, 52, 38, 255))
    _shingle_roof(dr, 128, 36, (72, 148, 172, 255), (104, 186, 210, 255), (48, 104, 124, 255))
    _win(dr, 24, 66, w=18, h=22, frame=(102, 72, 44, 255), glass=(120, 206, 226, 255))
    _win(dr, 86, 66, w=18, h=22, frame=(102, 72, 44, 255), glass=(120, 206, 226, 255))
    _win(dr, 55, 104, w=18, h=24, frame=(102, 72, 44, 255), glass=(120, 206, 226, 255))
    _door(dr, 48, 189, w=26, h=38, fill=(132, 82, 46, 255))
    return im


def _usine_pokeball(bw):
    # Grande Usine Poké Ball (1024x320, door centré = 496) composée en pixel-art B2W2 industriel
    W, H = 1024, 320
    im = _px(W, H)
    dr = ImageDraw.Draw(im)
    _box(dr, 16, 92, W - 17, H - 2, (226, 228, 234, 255), border=(34, 36, 44, 255), sh=(182, 186, 196, 255))
    _bricks(dr, 16, 128, W - 17, H - 36, (206, 210, 218, 255))
    for px_c in range(36, W - 40, 68):
        dr.rectangle([px_c - 2, 126, px_c + 2, H - 36], fill=(176, 182, 194, 255))
    # Bande rouge usine + toit acier rainuré
    _box(dr, 8, 12, W - 9, 104, (196, 52, 48, 255), border=(34, 24, 26, 255), hi=(228, 86, 78, 255), sh=(146, 36, 34, 255))
    for y in range(22, 98, 12):
        dr.line([14, y, W - 15, y], fill=(158, 38, 36, 255))
    _box(dr, 12, 108, W - 13, 126, (58, 64, 76, 255), border=(28, 30, 36, 255))
    # Soubassement industriel & rangée de grandes fenêtres
    _box(dr, 16, H - 36, W - 17, H - 2, (148, 154, 166, 255), border=(34, 36, 44, 255))
    for wx in range(44, W - 96, 68):
        if 420 <= wx <= 560:
            continue
        _win(dr, wx, 156, w=40, h=52, frame=(46, 52, 64, 255), glass=(98, 166, 218, 255), lit=(174, 226, 255, 255))
        _win(dr, wx, 228, w=40, h=42, frame=(46, 52, 64, 255), glass=(88, 148, 198, 255))
    # Emblème Poké Ball central + grande double porte vitrée à x=512 (door2X=[15,16] -> 16.0 cases)
    cx = 512
    _box(dr, cx - 72, 114, cx + 72, H - 2, (206, 212, 222, 255), border=(34, 36, 44, 255))
    r = 34
    dr.ellipse([cx - r, 96 - r, cx + r, 96 + r], fill=(244, 246, 250, 255), outline=(28, 30, 38, 255))
    dr.pieslice([cx - r, 96 - r, cx + r, 96 + r], 180, 360, fill=(218, 54, 48, 255), outline=(28, 30, 38, 255))
    dr.rectangle([cx - r, 93, cx + r, 99], fill=(28, 30, 38, 255))
    dr.ellipse([cx - 10, 96 - 10, cx + 10, 96 + 10], fill=(244, 246, 250, 255), outline=(28, 30, 38, 255))
    _door(dr, cx, H - 1, w=56, h=64, glass=True)
    return im


def _ligue(bw):
    # Ligue Pokémon monumentale 960x380, double porte d'honneur à x=480 (w=30, door2X=[14,15] -> 15.0)
    W, H = 960, 380
    im = _px(W, H)
    dr = ImageDraw.Draw(im)
    # Grande façade marbre & verre inspirée du kit BW (0,30672..256,30986)
    _box(dr, 24, 110, W - 25, H - 2, (226, 228, 236, 255), border=(36, 38, 50, 255), sh=(184, 188, 202, 255))
    _bricks(dr, 24, 130, W - 25, H - 4, (206, 210, 222, 255))
    _box(dr, 12, 76, W - 13, 122, (74, 88, 146, 255), border=(30, 34, 58, 255), hi=(118, 138, 204, 255))
    _box(dr, 18, 118, W - 19, 130, (228, 192, 86, 255), border=(78, 60, 26, 255))
    # Dômes latéraux & grand fronton central doré/indigo
    for dx in (96, W - 96):
        _box(dr, dx - 52, 28, dx + 52, 84, (84, 102, 166, 255), border=(30, 34, 58, 255), hi=(128, 148, 214, 255))
    cx = 480
    _box(dr, cx - 120, 12, cx + 120, 120, (66, 78, 136, 255), border=(28, 32, 54, 255), hi=(112, 132, 198, 255))
    dr.ellipse([cx - 38, 28, cx + 38, 104], fill=(242, 206, 94, 255), outline=(48, 38, 20, 255))
    dr.ellipse([cx - 26, 40, cx + 26, 92], fill=(92, 166, 236, 255), outline=(48, 38, 20, 255))
    # Colonnes de marbre & grandes baies bleues
    for px_c in range(46, W - 56, 76):
        if abs(px_c - cx) < 76:
            continue
        _box(dr, px_c, 130, px_c + 18, H - 2, (242, 244, 250, 255), border=(92, 96, 114, 255), sh=(198, 202, 216, 255))
        if px_c + 64 < W - 44 and abs(px_c + 40 - cx) >= 72:
            _win(dr, px_c + 24, 160, w=38, h=64, glass=(96, 164, 224, 255), lit=(176, 228, 255, 255))
            _win(dr, px_c + 24, 248, w=38, h=58, glass=(96, 164, 224, 255))
    _door(dr, cx, H - 1, w=72, h=86, glass=True)
    # Tapis royal devant la porte
    _box(dr, cx - 44, H - 14, cx + 44, H - 1, (176, 54, 62, 255), border=(228, 192, 86, 255))
    return im


def _pagode():
    # Tour Dorée / Pagode 352x384 (11x11, door=5 -> cx=176)
    W, H = 352, 384
    im = _px(W, H)
    dr = ImageDraw.Draw(im)
    cx = 176
    for lvl, (y_top, bw, rh) in enumerate([(236, 276, 56), (138, 224, 52), (46, 172, 48)]):
        y_bot = y_top + (144 if lvl == 0 else 98)
        _box(dr, cx - bw // 2 + 24, y_top + 28, cx + bw // 2 - 24, min(H - 2, y_bot),
             (176, 58, 46, 255), border=(38, 20, 18, 255), hi=(212, 92, 72, 255))
        _planks(dr, cx - bw // 2 + 24, y_top + 30, cx + bw // 2 - 24, min(H - 2, y_bot),
                (176, 58, 46, 255), (206, 86, 68, 255), (128, 38, 30, 255), step=10)
        rf = _px(bw, rh)
        _shingle_roof(ImageDraw.Draw(rf), bw, rh, (206, 164, 62, 255), (238, 204, 102, 255), (154, 114, 38, 255))
        im.alpha_composite(rf, (cx - bw // 2, y_top))
    _box(dr, cx - 4, 8, cx + 4, 48, (238, 204, 102, 255), border=(84, 58, 18, 255))
    _door(dr, cx, H - 1, w=40, h=52, fill=(116, 62, 34, 255))
    _win(dr, cx - 86, 296, w=28, h=30, frame=(92, 46, 28, 255))
    _win(dr, cx + 58, 296, w=28, h=30, frame=(92, 46, 28, 255))
    return im


def _tour_cendree():
    # Tour Cendrée 352x340 (11x11, door=5 -> cx=176) : pierre calcinée + toit ébréché
    W, H = 352, 340
    im = _px(W, H)
    dr = ImageDraw.Draw(im)
    cx = 176
    _box(dr, 44, 112, W - 45, H - 2, (98, 90, 88, 255), border=(28, 24, 24, 255), hi=(132, 122, 118, 255), sh=(68, 62, 60, 255))
    _bricks(dr, 44, 114, W - 45, H - 4, (70, 64, 62, 255))
    _box(dr, 24, 34, W - 25, 118, (64, 58, 60, 255), border=(26, 22, 24, 255), hi=(94, 86, 88, 255))
    dr.rectangle([136, 30, 216, 58], fill=(0, 0, 0, 0))
    _door(dr, cx, H - 1, w=42, h=56, fill=(42, 36, 38, 255))
    _win(dr, 76, 168, w=32, h=42, frame=(40, 36, 36, 255), glass=(48, 44, 52, 255), lit=(84, 72, 74, 255))
    _win(dr, W - 108, 168, w=32, h=42, frame=(40, 36, 36, 255), glass=(48, 44, 52, 255), lit=(84, 72, 74, 255))
    return im


def _pavillon():
    # Temple Kagura / Pavillon 256x220 (8x7, double porte -> cx=128)
    W, H = 256, 220
    im = _px(W, H)
    dr = ImageDraw.Draw(im)
    _box(dr, 18, 86, W - 19, H - 2, (236, 224, 200, 255), border=(42, 30, 26, 255))
    _box(dr, 18, H - 18, W - 19, H - 2, (132, 126, 122, 255), border=(42, 30, 26, 255))
    _bricks(dr, 18, H - 18, W - 19, H - 2, (94, 88, 86, 255))
    for px_c in (24, 68, W - 74, W - 30):
        _box(dr, px_c, 88, px_c + 8, H - 18, (186, 58, 48, 255), border=(48, 22, 20, 255))
    _shingle_roof(dr, W, 90, (176, 62, 52, 255), (212, 94, 80, 255), (124, 42, 36, 255))
    _door(dr, 128, H - 1, w=44, h=50, fill=(116, 66, 36, 255))
    _win(dr, 86, 134, w=20, h=24, frame=(104, 52, 32, 255))
    _win(dr, 150, 134, w=20, h=24, frame=(104, 52, 32, 255))
    return im


def ajouter_batiments_sup(out_dir, bw, bat_imgs, bat_dims):
    """Génère les sprites 2D B2W2 pour les bâtiments qui retombaient en 3D."""
    specs = {
        'etal': (_etal(), None),
        'puits': (_puits(), None),
        'chalet': (_chalet(), 48),
        'auberge': (_auberge(bat_imgs), 96),
        'maison_l': (_maison_l(bat_imgs), 80),
        'maison_ext': (_maison_ext(bat_imgs), 48),
        'boulangerie': (_boulangerie(bat_imgs), 48),
        'maison_the': (_maison_the(bat_imgs), 80),
        'cabane_chasseur': (_cabane(128, 124, fisher=False), None),
        'cabane_pecheur': (_cabane(160, 136, fisher=True), None),
        'grange': (_grange(bw), None),
        'moulin': (_moulin(), None),
        'phare': (_phare(), 48),
        'kiosque': (_kiosque(bw), None),
        'tour_mirage': (_tour_mirage(bat_imgs), 48),
        'usine_pokeball': (_usine_pokeball(bw), 512),
        'ligue': (_ligue(bw), 480),
        'pagode': (_pagode(), 176),
        'tour_cendree': (_tour_cendree(), 176),
        'pavillon': (_pavillon(), 128),
    }
    for nom, (im, porte) in specs.items():
        im.save(os.path.join(out_dir, f'b_{nom}.png'))
        bat_imgs[nom] = im
        bat_dims[nom] = [im.width, porte]
