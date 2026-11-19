"""
tools/noirblanc_extras.py — Compléments pixel-art 2D Gen 5 (grille logique 2×2 nette, ombres sous avant-toit,
tuiles/pierres/planches 4 teintes, reflets diagonaux de vitres, zéro trait plat 1 px) pour tous les bâtiments
extérieurs spéciaux (étals, puits, chalets, auberges, maisons en L, villas, boulangerie, cabanes, grange, moulin,
phare, kiosque, maison de thé, Usine Poké Ball, Ligue Pokémon, Pagode, Pavillon, Tour Cendrée, Tour Mirage).
"""
import os
from PIL import Image, ImageDraw
from noirblanc_critiques import _canvas2x, _up2, _rect, _bricks_l, _glass_win, _auto_door, _wood_door


def _planks_l(dr, x0, y0, x1, y1, hi, sh, step=3):
    for idx, y in enumerate(range(y0 + step, y1, step)):
        dr.line([x0 + 1, y, x1 - 1, y], fill=sh)
        if y + 1 < y1:
            dr.line([x0 + 1, y + 1, x1 - 1, y + 1], fill=hi)
        off = 7 if (idx % 2) else 0
        for x in range(x0 + 5 + off, x1 - 2, 14):
            dr.line([x, y - step + 1, x, y - 1], fill=sh)
    # Poteaux d'angle sombres
    dr.rectangle([x0 + 1, y0 + 1, x0 + 2, y1 - 1], fill=sh)
    dr.rectangle([x1 - 2, y0 + 1, x1 - 1, y1 - 1], fill=sh)


def _shingle_roof_l(dr, x0, y0, w, h, main, hi, sh, border=(30, 32, 42, 255), curved=False):
    """Toit en bardeaux / tuiles Gen 5 (grille logique 2×2) avec faîtage clair, rangs décalés et ombre d'avant-toit."""
    for dy in range(h):
        y = y0 + dy
        if curved:
            # avant-toit japonais légèrement retroussé
            t = 1.0 - dy / max(1, h - 1)
            inset = max(0, int((t ** 1.35) * (w * 0.18)))
        else:
            inset = max(0, int((h - 1 - dy) * 0.28))
        lx, rx = x0 + inset, x0 + w - 1 - inset
        col = hi if dy <= 2 else (sh if dy >= h - 3 else main)
        dr.line([lx, y, rx, y], fill=col)
        if dy % 3 == 0 and 2 < dy < h - 2:
            dr.line([lx + 1, y, rx - 1, y], fill=sh)
            off = 2 if ((dy // 3) % 2) else 0
            for tx in range(lx + 2 + off, rx - 1, 4):
                dr.point((tx, y - 1), fill=hi)
                dr.point((tx + 1, y + 1 if y + 1 < y0 + h - 1 else y), fill=sh)
        dr.point((lx, y), fill=border)
        dr.point((rx, y), fill=border)
    top_in = max(0, int((w * 0.18) if curved else (h - 1) * 0.28))
    dr.line([x0 + top_in, y0, x0 + w - 1 - top_in, y0], fill=border)
    dr.line([x0 + top_in + 1, y0 + 1, x0 + w - 2 - top_in, y0 + 1], fill=hi)
    dr.line([x0, y0 + h - 1, x0 + w - 1, y0 + h - 1], fill=border)


def _eave_shadow(dr, x0, y, x1, col):
    dr.line([x0, y, x1, y], fill=col)
    dr.line([x0, y + 1, x1, y + 1], fill=col)


# ------------------------------------------------------------------ petits bâtiments (étal, puits)
def _etal():
    im = _canvas2x(32, 34)
    dr = ImageDraw.Draw(im)
    out = (40, 28, 22, 255)
    # Comptoir bois texturé + marchandises
    _rect(dr, 2, 19, 29, 33, (152, 98, 54, 255), border=out, hi=(202, 150, 94, 255), sh=(102, 62, 32, 255))
    dr.rectangle([4, 23, 27, 31], fill=(120, 76, 40, 255))
    for y in (26, 29):
        dr.line([4, y, 27, y], fill=(94, 58, 30, 255))
    for i, c in enumerate([(228, 72, 68, 255), (246, 202, 64, 255), (84, 186, 92, 255), (86, 152, 232, 255)]):
        _rect(dr, 5 + i * 6, 17, 9 + i * 6, 20, c, border=out)
    # Poteaux + auvent rayé rouge/crème avec festons ombrés
    _rect(dr, 3, 9, 4, 22, (132, 84, 44, 255), border=out)
    _rect(dr, 27, 9, 28, 22, (132, 84, 44, 255), border=out)
    _rect(dr, 1, 2, 30, 12, (216, 62, 54, 255), border=out, hi=(244, 102, 90, 255), sh=(162, 38, 34, 255))
    for bx in range(3, 29, 6):
        dr.rectangle([bx, 3, min(29, bx + 2), 11], fill=(246, 238, 220, 255))
    for bx in range(1, 30, 3):
        col = (182, 42, 36, 255) if (bx // 3) % 2 == 0 else (214, 204, 184, 255)
        _rect(dr, bx, 12, min(30, bx + 2), 14, col, border=out)
    return _up2(im)


def _puits():
    im = _canvas2x(32, 36)
    dr = ImageDraw.Draw(im)
    out = (36, 36, 44, 255)
    # Poteaux + treuil bois
    _rect(dr, 6, 11, 8, 22, (118, 76, 44, 255), border=out)
    _rect(dr, 23, 11, 25, 22, (118, 76, 44, 255), border=out)
    dr.line([8, 15, 23, 15], fill=(82, 52, 30, 255))
    dr.line([16, 15, 16, 21], fill=(192, 164, 118, 255))
    # Toit bardeaux texturés
    _shingle_roof_l(dr, 0, 1, 32, 11, (142, 92, 56, 255), (182, 128, 84, 255), (96, 60, 34, 255))
    # Margelle en pierre appareillée + eau turquoise
    _rect(dr, 4, 21, 27, 35, (152, 156, 166, 255), border=out, hi=(202, 206, 214, 255), sh=(102, 106, 118, 255))
    _bricks_l(dr, 4, 26, 27, 35, (104, 108, 120, 255), (184, 188, 198, 255), step_y=3, step_x=6)
    _rect(dr, 7, 22, 24, 26, (66, 148, 216, 255), border=(56, 60, 72, 255), hi=(136, 206, 246, 255))
    return _up2(im)


# ------------------------------------------------------------------ maisons & commerces spéciaux
def _chalet():
    im = _canvas2x(80, 83)
    dr = ImageDraw.Draw(im)
    out = (38, 26, 22, 255)
    # Cheminée pierre à droite
    _rect(dr, 63, 4, 71, 24, (134, 126, 122, 255), border=out, hi=(176, 168, 162, 255), sh=(88, 82, 80, 255))
    _bricks_l(dr, 63, 6, 71, 23, (90, 84, 82, 255), step_y=3, step_x=4)
    # Corps rondins chêne + soubassement pierre
    _rect(dr, 3, 36, 76, 82, (176, 124, 74, 255), border=out)
    _planks_l(dr, 3, 38, 76, 74, (206, 156, 102, 255), (124, 78, 42, 255), step=3)
    _rect(dr, 3, 74, 76, 82, (124, 122, 128, 255), border=out, hi=(164, 162, 168, 255))
    _bricks_l(dr, 3, 74, 76, 82, (86, 84, 92, 255), step_y=3, step_x=6)
    _eave_shadow(dr, 4, 41, 75, (108, 68, 36, 255))
    # Toit bardeaux sapin/ardoise
    _shingle_roof_l(dr, 0, 1, 80, 40, (62, 96, 78, 255), (92, 134, 110, 255), (38, 64, 52, 255))
    # Porte bois à cx=24 (= 48 px exact) + 2 fenêtres fleuries
    _wood_door(dr, 24, 82, hw=7, h=20, fill=(118, 70, 38, 255))
    for wx in (42, 59):
        _glass_win(dr, wx, 54, wx + 12, 66, frame=(76, 48, 28, 255))
        _rect(dr, wx - 1, 67, wx + 13, 70, (98, 64, 34, 255), border=out)
        for fx in range(wx + 1, wx + 12, 3):
            dr.point((fx, 66), fill=(68, 156, 76, 255))
            dr.point((fx + 1, 65), fill=(238, 92, 112, 255) if fx % 2 == 0 else (248, 212, 74, 255))
    return _up2(im)


def _auberge(bat_imgs):
    src = bat_imgs['maison_c']
    im = Image.new('RGBA', (192, max(206, src.height)), (0, 0, 0, 0))
    sub = src.resize((192, im.height), Image.NEAREST) if src.width != 192 else src
    im.alpha_composite(sub, (0, im.height - sub.height))
    # Double porte & enseigne en grille 2×2 nette
    ov = _canvas2x(96, im.height // 2)
    dr = ImageDraw.Draw(ov)
    lh = ov.height
    _rect(dr, 33, lh - 27, 63, lh - 1, (192, 152, 104, 255), border=(42, 32, 26, 255), hi=(224, 186, 136, 255))
    _auto_door(dr, 48, lh - 1, hw=10, h=21, frame=(76, 52, 34, 255), glass=(112, 174, 218, 255), mat=(168, 54, 48, 255))
    _rect(dr, 11, lh - 31, 24, lh - 23, (62, 128, 78, 255), border=(38, 28, 22, 255), hi=(106, 180, 122, 255))
    dr.rectangle([13, lh - 29, 22, lh - 25], fill=(244, 216, 118, 255))
    im.alpha_composite(_up2(ov), (0, 0))
    return im


def _maison_l(bat_imgs):
    # Maison en L (160×192, porte aile droite à x=80, y_bot=127 -> 63 en logique 2×2)
    im = _canvas2x(80, 96)
    dr = ImageDraw.Draw(im)
    out = (40, 38, 44, 255)
    # Aile droite arrière (x=27..78, y=6..63)
    _rect(dr, 27, 26, 78, 63, (226, 216, 194, 255), border=out, hi=(244, 236, 218, 255), sh=(186, 174, 150, 255))
    _bricks_l(dr, 27, 28, 78, 56, (206, 196, 174, 255), step_y=3, step_x=7)
    _rect(dr, 27, 56, 78, 63, (144, 138, 132, 255), border=out, hi=(178, 172, 166, 255))
    _bricks_l(dr, 27, 56, 78, 63, (104, 98, 94, 255), step_y=3, step_x=6)
    _eave_shadow(dr, 28, 30, 77, (176, 164, 140, 255))
    _shingle_roof_l(dr, 26, 6, 54, 24, (74, 118, 176, 255), (108, 156, 216, 255), (46, 80, 130, 255))
    _wood_door(dr, 40, 63, hw=6, h=19, fill=(138, 86, 48, 255))
    _glass_win(dr, 53, 37, 63, 48, frame=(72, 54, 42, 255))
    _glass_win(dr, 66, 37, 75, 48, frame=(72, 54, 42, 255))
    # Aile gauche avancée (x=1..31, y=13..95)
    _rect(dr, 1, 39, 31, 95, (236, 226, 204, 255), border=out, hi=(248, 240, 222, 255), sh=(192, 180, 156, 255))
    _bricks_l(dr, 1, 41, 31, 87, (214, 204, 182, 255), step_y=3, step_x=7)
    _rect(dr, 1, 87, 31, 95, (144, 138, 132, 255), border=out, hi=(178, 172, 166, 255))
    _bricks_l(dr, 1, 87, 31, 95, (104, 98, 94, 255), step_y=3, step_x=6)
    _eave_shadow(dr, 2, 41, 30, (182, 170, 146, 255))
    _shingle_roof_l(dr, 0, 13, 33, 28, (82, 128, 188, 255), (118, 168, 226, 255), (50, 86, 138, 255))
    _glass_win(dr, 8, 49, 22, 61, frame=(72, 54, 42, 255))
    _glass_win(dr, 8, 69, 22, 81, frame=(72, 54, 42, 255))
    return _up2(im)


def _maison_ext(bat_imgs):
    base = bat_imgs['maison_f_bleue']
    im = Image.new('RGBA', (224, base.height), (0, 0, 0, 0))
    im.alpha_composite(base, (0, 0))
    ext = base.crop((92, 0, 154, base.height))
    im.alpha_composite(ext, (150, 0))
    edge = base.crop((154, 0, 162, base.height))
    im.alpha_composite(edge, (212, 0))
    dr = ImageDraw.Draw(im)
    dr.line([219, 28, 219, base.height - 2], fill=(40, 42, 48, 255))
    return im


def _boulangerie(bat_imgs):
    base = bat_imgs['maison_a_g']
    im = base.copy()
    ov = _canvas2x(im.width // 2, im.height // 2)
    dr = ImageDraw.Draw(ov)
    lh = ov.height
    out = (44, 28, 20, 255)
    _rect(dr, 36, lh - 23, 69, lh - 7, (78, 52, 34, 255), border=out)
    _rect(dr, 38, lh - 21, 67, lh - 9, (252, 226, 156, 255), border=(116, 78, 42, 255), hi=(255, 246, 208, 255))
    for ry in (lh - 18, lh - 13):
        dr.line([39, ry + 3, 66, ry + 3], fill=(142, 92, 46, 255))
        for bx in range(40, 65, 6):
            _rect(dr, bx, ry, bx + 4, ry + 2, (214, 136, 54, 255), border=(136, 74, 26, 255), hi=(248, 202, 114, 255))
    _rect(dr, 8, lh - 30, 71, lh - 23, (214, 96, 42, 255), border=out, hi=(242, 134, 72, 255), sh=(152, 62, 24, 255))
    for bx in range(11, 69, 8):
        dr.rectangle([bx, lh - 29, min(70, bx + 3), lh - 24], fill=(248, 240, 224, 255))
    im.alpha_composite(_up2(ov), (0, 0))
    return im


def _maison_the(bat_imgs):
    im = _canvas2x(80, 91)
    dr = ImageDraw.Draw(im)
    out = (40, 30, 28, 255)
    _rect(dr, 4, 38, 75, 90, (238, 226, 202, 255), border=out, hi=(248, 240, 222, 255), sh=(196, 180, 152, 255))
    for y in range(44, 82, 8):
        dr.line([5, y, 74, y], fill=(214, 200, 174, 255))
    for cx_p in (6, 22, 57, 72):
        _rect(dr, cx_p, 38, cx_p + 2, 89, (112, 64, 38, 255), border=out)
    _rect(dr, 4, 82, 75, 90, (116, 112, 120, 255), border=out, hi=(152, 148, 156, 255))
    _bricks_l(dr, 4, 82, 75, 90, (76, 72, 82, 255), step_y=3, step_x=6)
    _eave_shadow(dr, 5, 40, 74, (176, 160, 134, 255))
    # Double toit japonais ardoise bleue retroussé
    _shingle_roof_l(dr, 0, 18, 80, 21, (58, 74, 96, 255), (88, 110, 140, 255), (36, 48, 68, 255), curved=True)
    _shingle_roof_l(dr, 8, 2, 64, 18, (64, 82, 108, 255), (96, 120, 152, 255), (40, 52, 74, 255), curved=True)
    # Porte coulissante shoji + lanternes rouges
    _wood_door(dr, 40, 90, hw=8, h=21, fill=(216, 200, 168, 255), dark=(132, 92, 56, 255))
    _glass_win(dr, 9, 57, 19, 70, frame=(102, 58, 34, 255), dark=(212, 184, 124, 255), mid=(248, 232, 184, 255), hi=(255, 248, 222, 255))
    _glass_win(dr, 60, 57, 70, 70, frame=(102, 58, 34, 255), dark=(212, 184, 124, 255), mid=(248, 232, 184, 255), hi=(255, 248, 222, 255))
    for lx in (28, 51):
        _rect(dr, lx - 2, 57, lx + 2, 65, (226, 68, 52, 255), border=(52, 20, 18, 255), hi=(252, 174, 102, 255))
    return _up2(im)


def _cabane(w=128, h=124, fisher=False):
    lw, lh = w // 2, h // 2
    im = _canvas2x(lw, lh)
    dr = ImageDraw.Draw(im)
    out = (36, 28, 24, 255)
    rh = 24
    base_c = (162, 114, 72, 255) if not fisher else (136, 152, 170, 255)
    hi_c = (192, 142, 94, 255) if not fisher else (168, 186, 204, 255)
    sh_c = (114, 74, 42, 255) if not fisher else (94, 108, 126, 255)
    _rect(dr, 3, rh - 2, lw - 4, lh - 1, base_c, border=out)
    _planks_l(dr, 3, rh, lw - 4, lh - 7, hi_c, sh_c, step=3)
    _rect(dr, 3, lh - 7, lw - 4, lh - 1, (118, 116, 122, 255), border=out, hi=(154, 152, 158, 255))
    _bricks_l(dr, 3, lh - 7, lw - 4, lh - 1, (82, 80, 88, 255), step_y=3, step_x=6)
    _eave_shadow(dr, 4, rh, lw - 5, sh_c)
    _shingle_roof_l(dr, 0, 0, lw, rh,
                    (128, 72, 46, 255) if not fisher else (62, 108, 166, 255),
                    (164, 100, 68, 255) if not fisher else (94, 148, 210, 255),
                    (84, 46, 28, 255) if not fisher else (40, 72, 118, 255))
    _wood_door(dr, lw // 2, lh - 1, hw=6, h=17, fill=(108, 64, 36, 255))
    _glass_win(dr, 8, rh + 8, 18, rh + 18, frame=(68, 46, 32, 255))
    _glass_win(dr, lw - 19, rh + 8, lw - 9, rh + 18, frame=(68, 46, 32, 255))
    if fisher:
        # Bouée rouge & blanche accrochée au mur
        _rect(dr, lw - 14, rh + 21, lw - 7, rh + 28, (226, 68, 56, 255), border=(44, 22, 22, 255), hi=(248, 244, 240, 255))
        dr.rectangle([lw - 12, rh + 23, lw - 9, rh + 26], fill=(136, 152, 170, 255))
    else:
        for bx in (6, 10, 14):
            _rect(dr, bx, lh - 10, bx + 3, lh - 5, (148, 96, 56, 255), border=out, hi=(184, 132, 82, 255))
    return _up2(im)


def _grange(bw):
    im = _canvas2x(96, 88)
    dr = ImageDraw.Draw(im)
    out = (40, 22, 22, 255)
    _rect(dr, 4, 36, 91, 87, (176, 58, 48, 255), border=out, hi=(212, 88, 74, 255), sh=(124, 36, 30, 255))
    for x in range(8, 88, 6):
        dr.line([x, 38, x, 85], fill=(134, 40, 34, 255))
        dr.line([x + 1, 38, x + 1, 85], fill=(196, 72, 60, 255))
    _eave_shadow(dr, 5, 39, 90, (112, 32, 28, 255))
    _shingle_roof_l(dr, 0, 1, 96, 38, (112, 98, 90, 255), (152, 136, 126, 255), (72, 62, 58, 255))
    # Grande double porte blanche en X + lucarne grenier
    _rect(dr, 33, 57, 62, 87, (238, 230, 214, 255), border=(48, 36, 32, 255))
    _rect(dr, 35, 59, 60, 86, (152, 46, 38, 255), border=(238, 230, 214, 255))
    dr.line([48, 58, 48, 86], fill=(238, 230, 214, 255))
    dr.line([36, 60, 47, 85], fill=(238, 230, 214, 255))
    dr.line([49, 60, 59, 85], fill=(238, 230, 214, 255))
    dr.line([47, 60, 36, 85], fill=(238, 230, 214, 255))
    dr.line([59, 60, 49, 85], fill=(238, 230, 214, 255))
    _rect(dr, 40, 41, 55, 53, (88, 58, 34, 255), border=(238, 230, 214, 255), hi=(132, 92, 54, 255))
    res = _up2(im)
    foin = bw.crop((0, 25388, 128, 25490)).resize((46, 36), Image.NEAREST)
    res.alpha_composite(foin, (140, 138))
    return res


def _moulin():
    im = _canvas2x(64, 104)
    dr = ImageDraw.Draw(im)
    out = (38, 36, 44, 255)
    cx = 32
    # Tour cylindrique pierre/crème avec vrai dégradé 4 teintes Gen 5
    for y in range(31, 103):
        hw = 17 + int((y - 31) * 0.14)
        base = (224, 214, 194, 255) if y < 88 else (138, 134, 140, 255)
        hi = (244, 236, 218, 255) if y < 88 else (172, 168, 174, 255)
        mid = (196, 186, 166, 255) if y < 88 else (112, 108, 114, 255)
        sh = (158, 148, 130, 255) if y < 88 else (84, 80, 88, 255)
        dr.line([cx - hw, y, cx + hw, y], fill=base)
        dr.line([cx - hw + 1, y, cx - hw + max(3, hw // 3), y], fill=hi)
        dr.line([cx + hw // 3, y, cx + hw - 3, y], fill=mid)
        dr.line([cx + hw - 3, y, cx + hw - 1, y], fill=sh)
        if y % 5 == 0 and y < 101:
            dr.line([cx - hw + 1, y, cx + hw - 1, y], fill=mid if y < 88 else sh)
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    dr.line([cx - 27, 103, cx + 27, 103], fill=out)
    # Toit conique ardoise bleue ombré
    for y in range(10, 32):
        hw = max(2, int((y - 9) * 0.92))
        dr.line([cx - hw, y, cx + hw, y], fill=(64, 102, 162, 255))
        dr.line([cx - hw + 1, y, cx - hw // 3, y], fill=(98, 142, 204, 255))
        dr.line([cx + hw // 2, y, cx + hw - 1, y], fill=(42, 68, 114, 255))
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    dr.line([cx - 20, 32, cx + 20, 32], fill=out)
    _wood_door(dr, cx, 103, hw=6, h=18, fill=(134, 84, 46, 255))
    # 4 grandes ailes bois + toile croisées
    cy = 39
    for sx, sy in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
        dr.line([cx, cy, cx + sx * 26, cy + sy * 26], fill=(92, 58, 34, 255), width=2)
        poly = [
            (cx + sx * 7, cy + sy * 7),
            (cx + sx * 26, cy + sy * 26),
            (cx + sx * 26 - sy * 7, cy + sy * 26 + sx * 7),
            (cx + sx * 7 - sy * 6, cy + sy * 7 + sx * 6),
        ]
        dr.polygon(poly, fill=(244, 236, 214, 255), outline=(124, 96, 66, 255))
    _rect(dr, cx - 3, cy - 3, cx + 3, cy + 3, (152, 98, 52, 255), border=out, hi=(196, 144, 86, 255))
    return _up2(im)


def _phare():
    """Phare Gen 5 (96×224, porte=48) avec ombrage cylindrique 4 teintes, rambarde fer forgé & lanterne dorée."""
    im = _canvas2x(48, 112)
    dr = ImageDraw.Draw(im)
    out = (34, 36, 46, 255)
    cx = 24
    # Corps cylindrique rayé blanc & rouge avec 4 niveaux d'ombrage volumétrique
    for y in range(31, 111):
        hw = 10 + int((y - 31) * 0.13)
        band = ((y - 31) // 16) % 2 == 0
        hi = (248, 250, 254, 255) if band else (244, 104, 88, 255)
        main = (224, 230, 238, 255) if band else (214, 64, 54, 255)
        mid = (186, 194, 208, 255) if band else (172, 46, 40, 255)
        sh = (142, 152, 170, 255) if band else (126, 32, 30, 255)
        dr.line([cx - hw, y, cx + hw, y], fill=main)
        dr.line([cx - hw + 1, y, cx - hw + max(2, hw // 3), y], fill=hi)
        dr.line([cx + hw // 3, y, cx + hw - 2, y], fill=mid)
        dr.line([cx + hw - 2, y, cx + hw - 1, y], fill=sh)
        if y % 6 == 0:
            dr.line([cx - hw + 1, y, cx + hw - 1, y], fill=mid)
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    # Soubassement pierre + seuil
    _rect(dr, cx - 21, 105, cx + 21, 111, (132, 138, 150, 255), border=out, hi=(172, 178, 190, 255))
    # Galerie métallique avec barreaux de rambarde
    _rect(dr, cx - 14, 28, cx + 14, 32, (82, 90, 108, 255), border=out, hi=(124, 134, 156, 255))
    for rx in range(cx - 12, cx + 13, 4):
        dr.line([rx, 24, rx, 28], fill=(56, 62, 76, 255))
    dr.line([cx - 13, 24, cx + 13, 24], fill=(42, 46, 58, 255))
    # Lanterne dorée brillante + montants
    _rect(dr, cx - 8, 14, cx + 8, 28, (254, 228, 104, 255), border=out, hi=(255, 252, 206, 255))
    dr.rectangle([cx - 4, 16, cx + 2, 24], fill=(255, 250, 202, 255))
    for mx in (cx - 4, cx + 4):
        dr.line([mx, 15, mx, 27], fill=(76, 82, 98, 255))
    # Coupole rouge ombrée + paratonnerre
    for y in range(4, 14):
        hw = max(1, int((y - 3) * 0.9))
        dr.line([cx - hw, y, cx + hw, y], fill=(208, 60, 52, 255))
        dr.line([cx - hw + 1, y, cx, y], fill=(240, 98, 84, 255))
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    dr.line([cx, 1, cx, 4], fill=(236, 198, 72, 255))
    # Porte + hublot marin
    _wood_door(dr, cx, 111, hw=6, h=17, fill=(76, 86, 104, 255), dark=(48, 56, 72, 255), hi=(112, 124, 146, 255))
    _glass_win(dr, cx - 4, 54, cx + 4, 64, frame=(44, 50, 64, 255))
    return _up2(im)


def _kiosque(bw):
    im = _canvas2x(64, 76)
    dr = ImageDraw.Draw(im)
    out = (44, 42, 48, 255)
    _rect(dr, 6, 62, 57, 75, (202, 196, 184, 255), border=out, hi=(236, 230, 220, 255), sh=(154, 148, 138, 255))
    _bricks_l(dr, 6, 63, 57, 75, (152, 146, 138, 255), step_y=3, step_x=6)
    for px_c in (8, 22, 40, 53):
        _rect(dr, px_c, 31, px_c + 2, 64, (234, 226, 208, 255), border=(62, 56, 52, 255))
    _rect(dr, 10, 55, 22, 62, (152, 104, 62, 255), border=(52, 36, 24, 255), hi=(188, 138, 86, 255))
    _rect(dr, 42, 55, 53, 62, (152, 104, 62, 255), border=(52, 36, 24, 255), hi=(188, 138, 86, 255))
    _shingle_roof_l(dr, 0, 3, 64, 30, (74, 148, 114, 255), (112, 192, 152, 255), (46, 100, 76, 255))
    _rect(dr, 31, 0, 32, 4, (242, 198, 68, 255), border=(78, 56, 22, 255))
    return _up2(im)


def _tour_mirage(bat_imgs):
    im = _canvas2x(64, 96)
    dr = ImageDraw.Draw(im)
    out = (60, 44, 32, 255)
    _rect(dr, 6, 18, 57, 95, (224, 196, 146, 255), border=out, hi=(244, 222, 176, 255), sh=(182, 152, 104, 255))
    _bricks_l(dr, 6, 20, 57, 94, (194, 164, 114, 255), (240, 218, 172, 255), step_y=4, step_x=8)
    for y in (26, 46, 67):
        _rect(dr, 5, y, 58, y + 4, (186, 150, 100, 255), border=out, hi=(224, 190, 138, 255))
    _shingle_roof_l(dr, 0, 1, 64, 18, (68, 146, 172, 255), (104, 188, 214, 255), (44, 100, 122, 255))
    _glass_win(dr, 12, 33, 21, 43, frame=(98, 68, 42, 255), mid=(114, 202, 224, 255))
    _glass_win(dr, 42, 33, 51, 43, frame=(98, 68, 42, 255), mid=(114, 202, 224, 255))
    _glass_win(dr, 27, 52, 36, 64, frame=(98, 68, 42, 255), mid=(114, 202, 224, 255))
    _wood_door(dr, 24, 95, hw=6, h=19, fill=(134, 82, 46, 255))
    return _up2(im)


# ------------------------------------------------------------------ grands monuments (Usine, Ligue, Pagode, Tour Cendrée, Pavillon)
def _usine_pokeball(bw):
    """Usine Poké Ball (1024×320, porte=512) en vrai pixel-art industriel 2×2 Gen 5."""
    lw, lh = 512, 160
    im = _canvas2x(lw, lh)
    dr = ImageDraw.Draw(im)
    out = (34, 36, 46, 255)
    cx = 256
    # Extracteurs & cheminées d'usine sur le toit
    for sx in (64, 156, 344, 436):
        _rect(dr, sx, 2, sx + 14, 18, (96, 102, 116, 255), border=out, hi=(138, 146, 164, 255))
        _rect(dr, sx - 2, 1, sx + 16, 5, (64, 70, 82, 255), border=out)

    # Façade panneaux acier clair + nervures verticales + soubassement béton
    _rect(dr, 8, 48, lw - 9, lh - 1, (222, 226, 234, 255), border=out, hi=(242, 245, 250, 255), sh=(176, 182, 194, 255))
    _bricks_l(dr, 8, 64, lw - 9, lh - 18, (202, 206, 216, 255), step_y=5, step_x=12)
    for px_c in range(18, lw - 20, 34):
        _rect(dr, px_c - 1, 63, px_c + 1, lh - 18, (176, 182, 196, 255))
    # Toit industriel rouge nervuré avec dégradé & ombre d'avant-toit
    _rect(dr, 4, 10, lw - 5, 52, (194, 52, 48, 255), border=out, hi=(232, 90, 80, 255), sh=(142, 34, 32, 255))
    for y in range(15, 50, 5):
        dr.line([7, y, lw - 8, y], fill=(156, 38, 36, 255))
        dr.line([7, y + 1, lw - 8, y + 1], fill=(214, 70, 62, 255))
    _rect(dr, 6, 52, lw - 7, 63, (56, 62, 76, 255), border=out, hi=(88, 96, 114, 255))
    _eave_shadow(dr, 9, 64, lw - 10, (164, 170, 184, 255))
    _rect(dr, 8, lh - 18, lw - 9, lh - 1, (142, 148, 162, 255), border=out, hi=(178, 184, 196, 255))
    _bricks_l(dr, 8, lh - 18, lw - 9, lh - 1, (104, 110, 124, 255), step_y=4, step_x=10)

    # Rangées de grandes verrières d'atelier
    for wx in range(22, lw - 48, 34):
        if 204 <= wx <= 284:
            continue
        _glass_win(dr, wx, 76, wx + 22, 104, frame=(46, 52, 66, 255), mid=(92, 158, 214, 255), sill=(152, 158, 172, 255))
        _glass_win(dr, wx, 112, wx + 22, 134, frame=(46, 52, 66, 255), mid=(82, 142, 196, 255), sill=(152, 158, 172, 255))

    # Avant-corps central + emblème Poké Ball 3D ombré + grande double porte vitrée à cx=256 (= 512 px)
    _rect(dr, cx - 38, 56, cx + 38, lh - 1, (206, 212, 224, 255), border=out, hi=(234, 238, 246, 255), sh=(164, 170, 186, 255))
    r = 18
    cy = 48
    dr.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(242, 244, 250, 255), outline=out)
    dr.pieslice([cx - r, cy - r, cx + r, cy + r], 180, 360, fill=(216, 52, 48, 255), outline=out)
    dr.pieslice([cx - r + 2, cy - r + 2, cx + r - 6, cy + r - 4], 195, 310, fill=(244, 96, 86, 255))
    dr.rectangle([cx - r, cy - 2, cx + r, cy + 2], fill=out)
    dr.ellipse([cx - 6, cy - 6, cx + 6, cy + 6], fill=(244, 246, 250, 255), outline=out)
    dr.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(196, 206, 222, 255), outline=(72, 78, 94, 255))
    _auto_door(dr, cx, lh - 1, hw=16, h=34, mat=(176, 52, 56, 255))
    return _up2(im)


def _ligue(bw):
    """Ligue Pokémon monumentale (960×380, porte=480) en vrai pixel-art marbre, dômes indigo & or Gen 5."""
    lw, lh = 480, 190
    im = _canvas2x(lw, lh)
    dr = ImageDraw.Draw(im)
    out = (34, 36, 52, 255)
    marble = (226, 228, 236, 255)
    m_hi = (246, 248, 254, 255)
    m_sh = (178, 184, 200, 255)
    ind = (64, 80, 142, 255)
    ind_hi = (106, 128, 198, 255)
    ind_sh = (42, 52, 98, 255)
    gold = (232, 194, 82, 255)
    g_hi = (252, 228, 134, 255)
    g_sh = (162, 122, 36, 255)
    cx = 240

    # Coupoles latérales arrondies avec ombrage en bandes Gen 5
    for dx in (52, lw - 52):
        for y in range(14, 42):
            t = (y - 14) / 28.0
            hw = max(6, int(30 * (t ** 0.52)))
            dr.line([dx - hw, y, dx + hw, y], fill=ind)
            dr.line([dx - hw + 2, y, dx - hw // 3, y], fill=ind_hi)
            dr.line([dx + hw // 2, y, dx + hw - 1, y], fill=ind_sh)
            dr.point((dx - hw, y), fill=out)
            dr.point((dx + hw, y), fill=out)
        _rect(dr, dx - 2, 7, dx + 2, 15, gold, border=out, hi=g_hi)

    # Grand dôme central royal indigo & or
    for y in range(6, 52):
        t = (y - 6) / 46.0
        hw = max(12, int(64 * (t ** 0.48)))
        dr.line([cx - hw, y, cx + hw, y], fill=ind)
        dr.line([cx - hw + 3, y, cx - hw // 4, y], fill=ind_hi)
        dr.line([cx + hw // 2, y, cx + hw - 2, y], fill=ind_sh)
        if y % 6 == 0:
            dr.line([cx - hw + 2, y, cx + hw - 2, y], fill=ind_sh)
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    _rect(dr, cx - 3, 1, cx + 3, 8, gold, border=out, hi=g_hi)

    # Façade marbre monumentale + appareillage pierre + entablement indigo & frise dorée
    _rect(dr, 12, 56, lw - 13, lh - 1, marble, border=out, hi=m_hi, sh=m_sh)
    _bricks_l(dr, 12, 68, lw - 13, lh - 16, (206, 210, 222, 255), step_y=5, step_x=12)
    _rect(dr, 6, 40, lw - 7, 59, ind, border=out, hi=ind_hi, sh=ind_sh)
    _rect(dr, 9, 58, lw - 10, 65, gold, border=(78, 58, 22, 255), hi=g_hi, sh=g_sh)
    _eave_shadow(dr, 13, 66, lw - 14, m_sh)
    # Soubassement granit noble
    _rect(dr, 12, lh - 16, lw - 13, lh - 1, (144, 148, 166, 255), border=out, hi=(184, 188, 206, 255))
    _bricks_l(dr, 12, lh - 16, lw - 13, lh - 1, (108, 112, 132, 255), step_y=4, step_x=10)

    # Grand fronton central + blason doré de la Ligue
    _rect(dr, cx - 62, 34, cx + 62, 66, ind, border=out, hi=ind_hi, sh=ind_sh)
    _rect(dr, cx - 64, 63, cx + 64, 68, gold, border=(78, 58, 22, 255), hi=g_hi)
    dr.ellipse([cx - 19, 16, cx + 19, 54], fill=gold, outline=(62, 46, 18, 255))
    dr.ellipse([cx - 14, 21, cx + 14, 49], fill=(86, 158, 232, 255), outline=g_sh)
    dr.ellipse([cx - 10, 24, cx - 2, 32], fill=(178, 228, 255, 255))

    # Colonnes cannelées de marbre + chapiteaux or + grandes baies vitrées sur 2 niveaux
    for px_c in range(22, lw - 28, 38):
        if abs(px_c - cx) < 42:
            continue
        _rect(dr, px_c, 68, px_c + 9, lh - 2, m_hi, border=(88, 92, 112, 255), sh=m_sh)
        dr.line([px_c + 3, 72, px_c + 3, lh - 6], fill=(208, 212, 226, 255))
        dr.line([px_c + 6, 72, px_c + 6, lh - 6], fill=m_sh)
        _rect(dr, px_c - 1, 67, px_c + 10, 71, gold, border=(78, 58, 22, 255), hi=g_hi)
        _rect(dr, px_c - 1, lh - 6, px_c + 10, lh - 1, (166, 170, 186, 255), border=out)
        if px_c + 32 < lw - 22 and abs(px_c + 20 - cx) >= 40:
            _glass_win(dr, px_c + 12, 80, px_c + 33, 114, frame=(46, 52, 74, 255), mid=(84, 148, 212, 255), sill=m_sh)
            _glass_win(dr, px_c + 12, 124, px_c + 33, 156, frame=(46, 52, 74, 255), mid=(76, 136, 198, 255), sill=m_sh)

    # Grand portique central : 4 colonnes d'honneur + escalier + double porte royale vitrée + tapis rouge bordé d'or
    for col_x in (cx - 46, cx - 32, cx + 23, cx + 37):
        _rect(dr, col_x, 68, col_x + 9, lh - 1, m_hi, border=(78, 82, 102, 255), sh=m_sh)
        _rect(dr, col_x - 1, 67, col_x + 10, 71, gold, border=(78, 58, 22, 255), hi=g_hi)
    _rect(dr, cx - 22, 70, cx + 22, lh - 1, (176, 182, 200, 255), border=out)
    _auto_door(dr, cx, lh - 6, hw=18, h=46, frame=(44, 50, 72, 255), glass=(88, 156, 224, 255))
    # Marches de marbre + tapis royal descendant jusqu'à lh-1 (aucune fente d'herbe !)
    _rect(dr, cx - 30, lh - 7, cx + 30, lh - 1, m_hi, border=out, sh=m_sh)
    _rect(dr, cx - 20, lh - 7, cx + 20, lh - 1, (176, 46, 56, 255), border=gold, hi=(216, 76, 84, 255))
    return _up2(im)


def _pagode():
    """Tour Dorée / Pagode 3 niveaux (352×384, porte=176) en pixel-art 2×2 Gen 5."""
    lw, lh = 176, 192
    im = _canvas2x(lw, lh)
    dr = ImageDraw.Draw(im)
    out = (40, 22, 18, 255)
    cx = 88
    for lvl, (y_top, bw, rh) in enumerate([(116, 146, 28), (68, 118, 26), (22, 92, 24)]):
        y_bot = min(lh - 1, y_top + (76 if lvl == 0 else 50))
        x0, x1 = cx - bw // 2 + 12, cx + bw // 2 - 12
        _rect(dr, x0, y_top + 14, x1, y_bot, (176, 56, 44, 255), border=out, hi=(214, 90, 72, 255), sh=(122, 34, 28, 255))
        _planks_l(dr, x0, y_top + 16, x1, y_bot - (6 if lvl == 0 else 0), (204, 82, 66, 255), (124, 36, 28, 255), step=5)
        # Balustrade dorée sur les étages supérieurs
        if lvl > 0:
            _rect(dr, x0 - 3, y_bot - 6, x1 + 3, y_bot, (226, 182, 70, 255), border=(74, 50, 18, 255), hi=(248, 218, 114, 255))
        _eave_shadow(dr, x0 + 1, y_top + rh, x1 - 1, (104, 28, 24, 255))
        _shingle_roof_l(dr, cx - bw // 2, y_top, bw, rh, (206, 162, 58, 255), (242, 208, 104, 255), (146, 106, 34, 255), curved=True)
    # Soubassement pierre + flèche dorée
    _rect(dr, cx - 61, lh - 8, cx + 61, lh - 1, (124, 120, 126, 255), border=out, hi=(162, 158, 166, 255))
    _rect(dr, cx - 2, 2, cx + 2, 24, (242, 208, 104, 255), border=(76, 52, 18, 255))
    _wood_door(dr, cx, lh - 1, hw=10, h=26, fill=(116, 62, 34, 255))
    _glass_win(dr, cx - 44, 150, cx - 28, 168, frame=(86, 42, 26, 255), mid=(244, 224, 166, 255), hi=(255, 248, 218, 255))
    _glass_win(dr, cx + 28, 150, cx + 44, 168, frame=(86, 42, 26, 255), mid=(244, 224, 166, 255), hi=(255, 248, 218, 255))
    return _up2(im)


def _tour_cendree():
    """Tour Cendrée calcinée (352×340, porte=176) : vraie pagode brûlée/ruinée Gen 5 (toit effondré, bois noirci, suie)."""
    lw, lh = 176, 170
    im = _canvas2x(lw, lh)
    dr = ImageDraw.Draw(im)
    out = (26, 22, 26, 255)
    char = (82, 74, 76, 255)
    char_hi = (114, 104, 106, 255)
    char_sh = (50, 44, 48, 255)
    ash = (64, 58, 62, 255)
    cx = 88

    # Niveau supérieur calciné + poutres brûlées dépassant du toit effondré
    _rect(dr, 38, 34, lw - 39, 86, (72, 64, 68, 255), border=out, hi=(98, 88, 92, 255), sh=char_sh)
    _bricks_l(dr, 38, 36, lw - 39, 84, char_sh, step_y=4, step_x=8)
    # Toit supérieur brisé irrégulièrement (côté droit écroulé, charpente calcinée visible !)
    _shingle_roof_l(dr, 22, 22, 68, 22, (58, 52, 58, 255), (86, 78, 86, 255), (36, 32, 38, 255), curved=True)
    _shingle_roof_l(dr, 108, 26, 46, 18, (54, 48, 54, 255), (80, 72, 80, 255), (34, 30, 36, 255), curved=True)
    # Poutres brisées carbonisées dressées dans la brèche du toit
    for bx, bh in ((76, 12), (86, 16), (95, 10), (104, 14)):
        _rect(dr, bx, bh, bx + 3, 38, (46, 38, 40, 255), border=out, hi=(76, 64, 66, 255))
    # Traces de suie & fissures sur l'étage supérieur
    _rect(dr, 66, 48, 108, 72, (36, 32, 38, 255), border=out)
    for fx in (74, 86, 98):
        dr.line([fx, 49, fx, 71], fill=(56, 48, 52, 255))

    # Niveau inférieur pierre cendrée + grand avant-toit noirci fissuré
    _rect(dr, 24, 86, lw - 25, lh - 1, char, border=out, hi=char_hi, sh=char_sh)
    _bricks_l(dr, 24, 90, lw - 25, lh - 12, char_sh, char_hi, step_y=4, step_x=8)
    _rect(dr, 24, lh - 12, lw - 25, lh - 1, ash, border=out, hi=(94, 88, 92, 255))
    _shingle_roof_l(dr, 10, 68, lw - 20, 24, (56, 50, 56, 255), (84, 76, 84, 255), (34, 30, 36, 255), curved=True)
    # Entaille calcinée sur l'avant-toit
    dr.polygon([(112, 68), (126, 68), (122, 76), (116, 74)], fill=(0, 0, 0, 0))
    _eave_shadow(dr, 25, 92, lw - 26, (40, 34, 38, 255))

    # Piliers carbonisés, fenêtres sombres éventrées & portail brûlé centré à cx=88 (= 176 px)
    for px_c in (28, 62, 110, 144):
        _rect(dr, px_c, 92, px_c + 4, lh - 12, (52, 44, 46, 255), border=out, hi=(82, 72, 74, 255))
    _glass_win(dr, 38, 106, 56, 130, frame=(36, 30, 34, 255), dark=(28, 24, 30, 255), mid=(46, 42, 52, 255), hi=(94, 76, 72, 255))
    _glass_win(dr, lw - 57, 106, lw - 39, 130, frame=(36, 30, 34, 255), dark=(28, 24, 30, 255), mid=(46, 42, 52, 255), hi=(94, 76, 72, 255))
    _wood_door(dr, cx, lh - 1, hw=11, h=30, fill=(48, 40, 42, 255), dark=(30, 24, 28, 255), hi=(76, 64, 66, 255))
    return _up2(im)


def _pavillon():
    """Temple Kagura / Pavillon (256×220, porte=128) en pixel-art 2×2 Gen 5."""
    lw, lh = 128, 110
    im = _canvas2x(lw, lh)
    dr = ImageDraw.Draw(im)
    out = (42, 28, 24, 255)
    _rect(dr, 9, 43, lw - 10, lh - 1, (238, 226, 200, 255), border=out, hi=(248, 240, 222, 255), sh=(196, 180, 152, 255))
    _rect(dr, 9, lh - 10, lw - 10, lh - 1, (132, 126, 124, 255), border=out, hi=(168, 162, 160, 255))
    _bricks_l(dr, 9, lh - 10, lw - 10, lh - 1, (92, 86, 86, 255), step_y=3, step_x=6)
    for px_c in (12, 34, lw - 38, lw - 16):
        _rect(dr, px_c, 44, px_c + 4, lh - 10, (186, 56, 46, 255), border=(48, 20, 18, 255), hi=(224, 92, 78, 255))
    _eave_shadow(dr, 10, 45, lw - 11, (176, 160, 132, 255))
    _shingle_roof_l(dr, 0, 2, lw, 43, (176, 58, 48, 255), (218, 94, 78, 255), (120, 38, 32, 255), curved=True)
    # Faîtage doré du temple
    _rect(dr, 22, 1, lw - 23, 5, (238, 198, 76, 255), border=(76, 54, 20, 255), hi=(254, 232, 134, 255))
    _wood_door(dr, 64, lh - 1, hw=11, h=25, fill=(116, 66, 36, 255))
    _glass_win(dr, 42, 66, 52, 79, frame=(104, 52, 32, 255), mid=(248, 232, 184, 255), hi=(255, 248, 224, 255))
    _glass_win(dr, 76, 66, 86, 79, frame=(104, 52, 32, 255), mid=(248, 232, 184, 255), hi=(255, 248, 224, 255))
    return _up2(im)


def ajouter_batiments_sup(out_dir, bw, bat_imgs, bat_dims):
    """Génère les sprites 2D Gen 5 (grille 2×2) pour tous les bâtiments spéciaux."""
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
