"""
tools/noirblanc_hauts.py — Corrections de priorité HAUTE en pixel-art Gen 5 (grille logique 2×2 nette, s=0) :
- #4 : 4 vraies maisons du désert Gen 5 (adobe/grès, poutres, auvents tissés, portes cintrées alignées sur Dunes d'Ocre)
- #7 : Maisons 4 cases Forge-Acier (b_maison_forge_p1 / p2), grande tour 9 cases Métropole (b_tour_metro),
       et raccourcissement propre sans couture + retrait d'ombre alpha=64 sur tour_vitre, tour_jaune, maison_forge_1/2.
"""
import os
import numpy as np
from PIL import Image, ImageDraw
from noirblanc_critiques import _canvas2x, _up2, _rect, _bricks_l, _glass_win, _auto_door, _wood_door, _strip_soft_shadow


# ================================================================== #4 MAISONS DU DÉSERT GEN 5
def _arch_door(dr, cx, yb, hw=7, h=17, wood=(126, 74, 42, 255), dark=(74, 40, 22, 255), frame=(176, 134, 88, 255)):
    """Porte cintrée en bois sculpté Gen 5 (100 % opaque) avec encadrement grès et seuil pierre."""
    x0, x1, y0 = cx - hw, cx + hw, yb - h
    out = (52, 34, 24, 255)
    # Cadre extérieur en pierre sculptée
    _rect(dr, x0 - 2, y0 + 2, x1 + 2, yb, frame, border=out, hi=(214, 174, 124, 255))
    dr.rectangle([x0 - 1, y0, x1 + 1, y0 + 3], fill=frame)
    dr.line([x0 - 1, y0, x1 + 1, y0], fill=out)
    # Intérieur porte bois sombre + battants cintrés
    _rect(dr, x0, y0 + 2, x1, yb - 1, wood, border=out)
    dr.rectangle([x0 + 1, y0 + 1, x1 - 1, y0 + 3], fill=wood)
    dr.line([x0 + 1, y0 + 1, x1 - 1, y0 + 1], fill=out)
    dr.line([cx, y0 + 2, cx, yb - 2], fill=dark)
    # Clous & moulures orientales
    for py in (y0 + 5, y0 + 10, yb - 4):
        dr.line([x0 + 1, py, x1 - 1, py], fill=dark)
    dr.point((cx - 2, y0 + 9), fill=(238, 198, 76, 255))
    dr.point((cx + 2, y0 + 9), fill=(238, 198, 76, 255))
    # Seuil en pierre sablée
    _rect(dr, x0 - 2, yb - 1, x1 + 2, yb, (198, 172, 132, 255), border=out)


def _desert_win(dr, x0, y0, x1, y1, shutter=(112, 72, 46, 255), glass=(68, 114, 146, 255)):
    """Fenêtre encastrée du désert avec moucharabieh / volets bois ombrés (zéro bleu fluo)."""
    out = (52, 34, 24, 255)
    _rect(dr, x0, y0, x1, y1, glass, border=out)
    # Ombre profonde sous le linteau
    dr.line([x0 + 1, y0 + 1, x1 - 1, y0 + 1], fill=(38, 56, 76, 255))
    dr.line([x0 + 1, y0 + 2, x1 - 1, y0 + 2], fill=(50, 80, 106, 255))
    # Croisillons bois chaud
    mx, my = (x0 + x1) // 2, (y0 + y1) // 2
    dr.line([mx, y0 + 1, mx, y1 - 1], fill=shutter)
    dr.line([x0 + 1, my, x1 - 1, my], fill=shutter)
    # Petit reflet discret
    dr.point((x0 + 2, y0 + 3), fill=(154, 196, 218, 255))
    # Linteau & appui pierre
    dr.line([x0 - 1, y0 - 1, x1 + 1, y0 - 1], fill=(142, 98, 62, 255))
    dr.line([x0 - 1, y1 + 1, x1 + 1, y1 + 1], fill=(166, 124, 80, 255))


def _make_desert_4(variant=1):
    """Maison du désert 4 cases (128×152 ou 128×160, porte=48 alignée exacte sur door=1)."""
    lh = 76 if variant == 1 else 80
    im = _canvas2x(64, lh)
    dr = ImageDraw.Draw(im)
    out = (54, 36, 24, 255)
    if variant == 1:
        wall, hi, sh, mort = (224, 182, 132, 255), (242, 206, 158, 255), (182, 138, 92, 255), (202, 158, 110, 255)
        roof, rhi, rsh = (196, 146, 98, 255), (226, 178, 128, 255), (146, 102, 62, 255)
        awn1, awn2 = (176, 62, 54, 255), (240, 216, 168, 255)
    else:
        wall, hi, sh, mort = (232, 204, 162, 255), (248, 226, 188, 255), (188, 158, 118, 255), (210, 180, 138, 255)
        roof, rhi, rsh = (182, 152, 112, 255), (214, 186, 144, 255), (138, 110, 76, 255)
        awn1, awn2 = (58, 132, 136, 255), (242, 224, 182, 255)

    top_y = 18 if variant == 1 else 22
    # Corps en adobe/grès + texture de pierre sablée
    _rect(dr, 3, top_y, 60, lh - 1, wall, border=out, hi=hi, sh=sh)
    _bricks_l(dr, 3, top_y + 10, 60, lh - 10, mort, step_y=5, step_x=10)
    # Soubassement pierre chaude
    _rect(dr, 3, lh - 9, 60, lh - 1, sh, border=out, hi=wall)
    # Toit-terrasse plat entouré d'un parapet crénelé
    _rect(dr, 2, top_y - 10, 61, top_y + 2, roof, border=out, hi=rhi, sh=rsh)
    _rect(dr, 6, top_y - 7, 57, top_y - 2, (164, 126, 86, 255), border=rsh)
    # Créneaux d'adobe sur le parapet supérieur
    for cx_m in range(4, 58, 9):
        _rect(dr, cx_m, top_y - 13, cx_m + 5, top_y - 9, wall, border=out, hi=hi)
    # Poutres rondes en bois de cèdre dépassant sous la terrasse (signature architecturale adobe!)
    for bx in range(7, 58, 8):
        _rect(dr, bx, top_y + 2, bx + 2, top_y + 5, (112, 70, 40, 255), border=out)
    # Ombre portée sous la corniche
    dr.line([4, top_y + 6, 59, top_y + 6], fill=sh)

    if variant == 2:
        # Pergola / tente d'ombrage en bois + toile sur la terrasse
        for px_p in (12, 48):
            _rect(dr, px_p, 4, px_p + 2, top_y - 8, (116, 74, 42, 255), border=out)
        _rect(dr, 10, 3, 52, 8, awn1, border=out, hi=(92, 168, 172, 255))
        for sx in range(14, 50, 8):
            dr.rectangle([sx, 4, sx + 3, 7], fill=awn2)

    # Auvent tissé au-dessus de la porte (alignée à cx=24 -> 48 px = door=1!)
    _rect(dr, 12, lh - 30, 36, lh - 23, awn1, border=out, sh=(88, 36, 32, 255) if variant == 1 else (36, 84, 88, 255))
    for sx in range(15, 34, 6):
        dr.rectangle([sx, lh - 29, sx + 2, lh - 24], fill=awn2)
    # Porte cintrée en bois sculpté à cx=24 (= 48 px exact)
    _arch_door(dr, 24, lh - 1, hw=7, h=19, frame=rhi)
    # Fenêtre ombrée à droite + jarre en terre cuite au sol
    _desert_win(dr, 42, lh - 28, 54, lh - 16)
    # Petite fenêtre haute + jarre
    _desert_win(dr, 43, top_y + 11, 53, top_y + 20)
    if variant == 1:
        _desert_win(dr, 12, top_y + 11, 22, top_y + 20)
    else:
        _desert_win(dr, 14, top_y + 11, 24, top_y + 20)
    # Jarre terre cuite décorative à droite
    _rect(dr, 50, lh - 11, 56, lh - 2, (176, 94, 58, 255), border=out, hi=(216, 134, 88, 255))
    _rect(dr, 51, lh - 13, 55, lh - 11, (198, 114, 72, 255), border=out)
    return _up2(im), 48


def _make_desert_5(variant=3):
    """Grande maison du désert 5 cases (160×168 ou 160×160, porte=80 centrée exacte sur door=2)."""
    lh = 84 if variant == 3 else 80
    im = _canvas2x(80, lh)
    dr = ImageDraw.Draw(im)
    out = (52, 34, 24, 255)
    cx = 40
    if variant == 3:
        wall, hi, sh, mort = (218, 168, 118, 255), (238, 194, 146, 255), (174, 124, 80, 255), (196, 144, 98, 255)
        dome, dhi, dsh = (196, 112, 74, 255), (228, 146, 102, 255), (144, 76, 48, 255)
        awn1, awn2 = (182, 76, 52, 255), (244, 220, 170, 255)
    else:
        wall, hi, sh, mort = (234, 206, 162, 255), (250, 228, 190, 255), (188, 158, 116, 255), (212, 182, 138, 255)
        dome, dhi, dsh = (164, 138, 98, 255), (198, 172, 128, 255), (118, 96, 64, 255)
        awn1, awn2 = (66, 124, 146, 255), (244, 226, 186, 255)

    top_y = 26 if variant == 3 else 22
    if variant == 3:
        # Coupole / dôme en terre cuite sur le toit (emblématique des oasis Gen 5)
        for y in range(4, top_y - 6):
            t = (y - 4) / max(1, (top_y - 10))
            hw = max(3, int(20 * (t ** 0.55)))
            dr.line([cx - hw, y, cx + hw, y], fill=dome)
            dr.line([cx - hw + 1, y, cx - hw + max(2, hw // 2), y], fill=dhi)
            dr.line([cx + hw - max(2, hw // 3), y, cx + hw - 1, y], fill=dsh)
            dr.point((cx - hw, y), fill=out)
            dr.point((cx + hw, y), fill=out)
        _rect(dr, cx - 2, 1, cx + 2, 5, (232, 192, 82, 255), border=out)

    # Corps massif en grès / adobe
    _rect(dr, 3, top_y, 76, lh - 1, wall, border=out, hi=hi, sh=sh)
    _bricks_l(dr, 3, top_y + 8, 76, lh - 10, mort, step_y=5, step_x=10)
    _rect(dr, 3, lh - 10, 76, lh - 1, sh, border=out, hi=wall)
    # Corniche terrasse + créneaux + poutres cèdre
    _rect(dr, 2, top_y - 8, 77, top_y + 2, dome if variant == 4 else (194, 146, 98, 255), border=out, hi=dhi, sh=dsh)
    for cx_m in range(4, 74, 10):
        _rect(dr, cx_m, top_y - 11, cx_m + 5, top_y - 7, wall, border=out, hi=hi)
    for bx in range(7, 74, 8):
        _rect(dr, bx, top_y + 2, bx + 2, top_y + 5, (112, 70, 40, 255), border=out)
    dr.line([4, top_y + 6, 75, top_y + 6], fill=sh)

    # Avant-corps central encadrant la grande porte cintrée à cx=40 (= 80 px exact -> door=2!)
    _rect(dr, cx - 15, top_y + 8, cx + 15, lh - 1, hi, border=out, sh=sh)
    _rect(dr, cx - 14, lh - 31, cx + 14, lh - 24, awn1, border=out)
    for sx in range(cx - 12, cx + 12, 6):
        dr.rectangle([sx, lh - 30, sx + 2, lh - 25], fill=awn2)
    _arch_door(dr, cx, lh - 1, hw=8, h=20, frame=hi)
    # 2 fenêtres symétriques rez-de-chaussée + étage
    for wx in (9, 59):
        _desert_win(dr, wx, lh - 28, wx + 11, lh - 15)
        _desert_win(dr, wx, top_y + 11, wx + 11, top_y + 22)
    _desert_win(dr, cx - 6, top_y + 11, cx + 6, top_y + 20)
    return _up2(im), 80


# ================================================================== #7 FORGE-ACIER 4 CASES & TOUR MÉTROPOLE 9 CASES
def _make_forge_4(variant=1):
    """Maison de ville 4 cases pour Forge-Acier (136×176, porte=48 alignée exacte sur door=1)."""
    im = _canvas2x(68, 88)
    dr = ImageDraw.Draw(im)
    out = (36, 28, 30, 255)
    if variant == 1:
        brick, hi, sh = (146, 76, 58, 255), (176, 102, 78, 255), (98, 48, 36, 255)
        roof, rhi, rsh = (68, 76, 92, 255), (98, 110, 132, 255), (44, 50, 62, 255)
    else:
        brick, hi, sh = (118, 92, 76, 255), (148, 120, 100, 255), (78, 58, 48, 255)
        roof, rhi, rsh = (64, 96, 86, 255), (94, 134, 122, 255), (42, 66, 60, 255)

    # Petite cheminée de brique à droite
    _rect(dr, 50, 2, 58, 20, brick, border=out, hi=hi, sh=sh)
    _rect(dr, 49, 1, 59, 4, (74, 78, 88, 255), border=out)
    # Corps brique 2 étages
    _rect(dr, 3, 28, 64, 87, brick, border=out, hi=hi, sh=sh)
    _bricks_l(dr, 3, 30, 64, 76, sh, hi, step_y=4, step_x=8)
    _rect(dr, 3, 76, 64, 87, (108, 106, 114, 255), border=out, hi=(142, 140, 148, 255))
    _bricks_l(dr, 3, 76, 64, 87, (72, 70, 78, 255), step_y=4, step_x=8)
    # Toit mansardé ardoise / cuivre patiné
    for y in range(10, 30):
        inset = max(0, (29 - y) // 3)
        col = rhi if y < 14 else (rsh if y > 26 else roof)
        dr.line([1 + inset, y, 66 - inset, y], fill=col)
        if y % 4 == 0 and 12 < y < 27:
            dr.line([3 + inset, y, 64 - inset, y], fill=rsh)
        dr.point((1 + inset, y), fill=out)
        dr.point((66 - inset, y), fill=out)
    dr.line([7, 10, 60, 10], fill=out)
    _rect(dr, 2, 28, 65, 31, (176, 172, 166, 255), border=out, hi=(212, 208, 202, 255))
    # Fenêtres d'étage + fenêtre rez-de-chaussée à droite
    _glass_win(dr, 12, 37, 26, 52, frame=(56, 42, 38, 255), sill=(176, 172, 166, 255))
    _glass_win(dr, 42, 37, 56, 52, frame=(56, 42, 38, 255), sill=(176, 172, 166, 255))
    _glass_win(dr, 42, 61, 57, 74, frame=(56, 42, 38, 255), sill=(176, 172, 166, 255))
    # Porte bois solide alignée à cx=24 (= 48 px exact -> door=1 sur emprise 4×3 !)
    _wood_door(dr, 24, 87, hw=7, h=22, fill=(122, 74, 44, 255))
    return _up2(im), 48


def _make_tour_metro():
    """Grand immeuble de bureaux Gen 5 pour les emprises 9×5 / 9×6 de Métropole (288×248 = 9 cases exactes, porte=None)."""
    im = _canvas2x(144, 124)
    dr = ImageDraw.Draw(im)
    out = (32, 36, 48, 255)
    stone = (196, 200, 210, 255)
    stone_hi = (226, 230, 238, 255)
    stone_sh = (146, 152, 166, 255)
    steel = (74, 86, 108, 255)
    steel_hi = (108, 124, 152, 255)
    steel_sh = (46, 54, 72, 255)

    # Toit terrasse moderne avec blocs techniques & verrière centrale
    _rect(dr, 4, 8, 139, 22, (138, 144, 156, 255), border=out, hi=(178, 184, 196, 255), sh=(96, 102, 114, 255))
    _rect(dr, 12, 12, 131, 19, (112, 118, 132, 255), border=(76, 82, 94, 255))
    _rect(dr, 22, 3, 46, 15, steel, border=out, hi=steel_hi)
    _rect(dr, 98, 3, 122, 15, steel, border=out, hi=steel_hi)
    _rect(dr, 56, 5, 88, 16, (88, 146, 196, 255), border=out, hi=(164, 216, 246, 255))

    # Corps principal 9 cases de large (x=3..140, y=22..123) : deux ailes pierre + noyau mur-rideau verre
    _rect(dr, 3, 22, 140, 123, stone, border=out, hi=stone_hi, sh=stone_sh)
    _bricks_l(dr, 3, 24, 140, 98, (176, 180, 190, 255), step_y=4, step_x=8)
    # Pilastres verticaux + bandeaux d'étage
    for cx_p in (3, 42, 98, 137):
        _rect(dr, cx_p, 22, cx_p + 3, 123, stone_hi, border=out, sh=stone_sh)
    for cy in (22, 48, 74, 98):
        _rect(dr, 2, cy, 141, cy + 3, steel, border=out, hi=steel_hi, sh=steel_sh)

    # 3 étages de baies vitrées sur toute la largeur
    for wy in (29, 55, 80):
        # Aile gauche & droite
        for wx in (10, 25, 105, 120):
            _glass_win(dr, wx, wy, wx + 12, wy + 15, frame=steel_sh, mid=(78, 138, 192, 255))
        # Mur-rideau central bleu-acier (x=48..95)
        for wx in (49, 64, 79):
            _glass_win(dr, wx, wy, wx + 13, wy + 15, frame=(42, 56, 78, 255), mid=(66, 128, 186, 255))

    # Rez-de-chaussée granit + hall vitré élégant
    _rect(dr, 3, 101, 140, 123, (88, 94, 108, 255), border=out, hi=(124, 130, 146, 255))
    for wx in (10, 26, 104, 120):
        _glass_win(dr, wx, 105, wx + 13, 119, frame=(40, 44, 54, 255), mid=(96, 152, 198, 255))
    _auto_door(dr, 72, 123, hw=16, h=19)
    return _up2(im), None


def _trim_tall_clean(path, cut_y0, cut_y1, max_y=None):
    """Retire une bande répétitive d'étage [cut_y0:cut_y1] + ombre alpha<200 sans couture."""
    im = _strip_soft_shadow(Image.open(path))
    a = np.array(im)
    if max_y is not None:
        a = a[:max_y]
    else:
        ys = np.where(a[..., 3] > 0)[0]
        if len(ys):
            a = a[:int(ys.max()) + 1]
    if cut_y0 is not None and cut_y1 is not None and cut_y1 < a.shape[0]:
        a = np.concatenate([a[:cut_y0], a[cut_y1:]], axis=0)
    res = Image.fromarray(a, 'RGBA')
    res.save(path)
    return res


def appliquer_hauts(root, out_dir, decos, bat_dims):
    """Applique les correctifs #4 (désert) et #7 (Forge-Acier 4 cases, Tour Métropole 9 cases, hauteur des tours)."""
    # #4 — 4 maisons du désert Gen 5 propres (toutes utilisées à Dunes d'Ocre)
    deserts = {
        'maison_desert_1': _make_desert_4(1),
        'maison_desert_2': _make_desert_4(2),
        'maison_desert_3': _make_desert_5(3),
        'maison_desert_4': _make_desert_5(4),
    }
    for nom, (im, porte) in deserts.items():
        im.save(os.path.join(out_dir, f'b_{nom}.png'))
        bat_dims[nom] = [im.width, porte]

    # #7 — Nouvelles maisons 4 cases Forge-Acier + Grande Tour 9 cases Métropole
    extras_geo = {
        'maison_forge_p1': _make_forge_4(1),
        'maison_forge_p2': _make_forge_4(2),
        'tour_metro': _make_tour_metro(),
    }
    for nom, (im, porte) in extras_geo.items():
        im.save(os.path.join(out_dir, f'b_{nom}.png'))
        bat_dims[nom] = [im.width, porte]

    # #7 — Raccourcissement sans couture des tours trop hautes + retrait ombre alpha=64
    tv_p = os.path.join(out_dir, 'b_tour_vitre.png')
    if os.path.exists(tv_p):
        im = _trim_tall_clean(tv_p, 214, 298, max_y=352)
        bat_dims['tour_vitre'] = [im.width, None]

    tj_p = os.path.join(out_dir, 'b_tour_jaune.png')
    if os.path.exists(tj_p):
        im = _trim_tall_clean(tj_p, 188, 234, max_y=294)
        bat_dims['tour_jaune'] = [im.width, None]

    for fn in ('maison_forge_1', 'maison_forge_2'):
        fp = os.path.join(out_dir, f'b_{fn}.png')
        if os.path.exists(fp):
            im = _trim_tall_clean(fp, 40, 84, max_y=310)
            bat_dims[fn] = [im.width, 88]
