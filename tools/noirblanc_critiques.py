"""
tools/noirblanc_critiques.py — Corrections pixel-art Gen 5 (grille logique 2×2 nette, zéro anti-aliasing, zéro trou de porte)
des assets critiques du pack Noir & Blanc :
- Décors : d_caisse, d_caisses, d_squelette (dragon fossile 4 cases pour le Musée)
- Bâtiments : b_gare (porte vitrée + mur de fond), b_bourse (façade unifiée), b_mairie (hôtel de ville Gen 5),
  b_centrale (centrale électrique Gen 5), b_fonderie & b_fonderie_b (fonderie brique/acier 7 cases),
  b_atelier_brique & b_tour_brique (façades Volucité symétriques complètes), b_serre (verrière botanique),
  b_boutique_mode (boutique chic de Métropole), b_tour_vitre (hall vitré au rez-de-chaussée).
"""
import os
import numpy as np
from PIL import Image, ImageDraw


def _canvas2x(lw, lh):
    """Crée un canvas logique (lw × lh) qui sera agrandi ×2 NEAREST en pixel-art Gen 5 net."""
    return Image.new('RGBA', (lw, lh), (0, 0, 0, 0))


def _up2(im):
    return im.resize((im.width * 2, im.height * 2), Image.NEAREST)


def _rect(dr, x0, y0, x1, y1, fill, border=None, hi=None, sh=None):
    dr.rectangle([x0, y0, x1, y1], fill=fill)
    if border:
        dr.rectangle([x0, y0, x1, y1], outline=border)
    if hi and x1 - x0 >= 2:
        dr.line([x0 + 1, y0 + 1, x1 - 1, y0 + 1], fill=hi)
    if sh and x1 - x0 >= 2:
        dr.line([x0 + 1, y1 - 1, x1 - 1, y1 - 1], fill=sh)


def _bricks_l(dr, x0, y0, x1, y1, col_m, col_hi=None, step_y=3, step_x=6):
    for idx, y in enumerate(range(y0 + step_y, y1, step_y)):
        dr.line([x0 + 1, y, x1 - 1, y], fill=col_m)
        off = (step_x // 2) if (idx % 2) else 0
        for x in range(x0 + 2 + off, x1 - 1, step_x):
            dr.line([x, y - step_y + 1, x, y - 1], fill=col_m)
            if col_hi and x + 1 < x1 - 1 and y - step_y + 1 <= y - 1:
                dr.point((x + 1, y - step_y + 1), fill=col_hi)


def _glass_win(dr, x0, y0, x1, y1, frame=(46, 52, 66, 255), dark=(48, 86, 128, 255),
               mid=(82, 140, 194, 255), hi=(164, 214, 246, 255), sill=None):
    _rect(dr, x0, y0, x1, y1, mid, border=frame)
    if x1 - x0 >= 3 and y1 - y0 >= 3:
        dr.rectangle([x0 + 1, y0 + 1, x1 - 1, y0 + 2], fill=dark)
        # reflet diagonal Gen 5
        for k in range(min(x1 - x0 - 2, y1 - y0 - 2)):
            px, py = x0 + 2 + k, y0 + 2 + (k // 2)
            if px < x1 and py < y1:
                dr.point((px, py), fill=hi)
        if x1 - x0 >= 6:
            mx = (x0 + x1) // 2
            dr.line([mx, y0 + 1, mx, y1 - 1], fill=frame)
        if y1 - y0 >= 6:
            my = (y0 + y1) // 2
            dr.line([x0 + 1, my, x1 - 1, my], fill=frame)
    if sill:
        dr.line([x0 - 1, y1 + 1, x1 + 1, y1 + 1], fill=sill)


def _auto_door(dr, cx, yb, hw=10, h=18, frame=(52, 58, 72, 255), glass=(68, 128, 178, 255),
               dark=(30, 44, 62, 255), hi=(164, 220, 248, 255), mat=None):
    """Double porte coulissante vitrée Gen 5 (100 % opaque, zéro trou transparent)."""
    x0, x1, y0 = cx - hw, cx + hw, yb - h
    # Encadrement métallique extérieur
    _rect(dr, x0 - 2, y0 - 2, x1 + 2, yb, (142, 150, 166, 255), border=(34, 38, 48, 255), hi=(198, 206, 220, 255))
    # Fond intérieur sombre derrière la vitre
    _rect(dr, x0, y0, x1, yb - 1, dark, border=frame)
    # Panneaux vitrés gauche & droite
    dr.rectangle([x0 + 1, y0 + 2, cx - 1, yb - 3], fill=glass)
    dr.rectangle([cx + 1, y0 + 2, x1 - 1, yb - 3], fill=glass)
    # Reflets obliques
    for off in (0, cx - x0):
        for k in range(min(hw - 3, h - 6)):
            dr.point((x0 + 2 + off + k, y0 + 3 + k), fill=hi)
            if y0 + 4 + k < yb - 3:
                dr.point((x0 + 2 + off + k, y0 + 4 + k), fill=(120, 184, 226, 255))
    # Montant central + traverses
    dr.line([cx, y0 + 1, cx, yb - 2], fill=(38, 44, 56, 255))
    dr.line([x0 + 1, yb - 4, x1 - 1, yb - 4], fill=(96, 108, 126, 255))
    dr.line([x0 + 1, y0 + 1, x1 - 1, y0 + 1], fill=(110, 122, 140, 255))
    # Seuil pierre / tapis
    if mat:
        _rect(dr, x0 - 2, yb - 2, x1 + 2, yb, mat, border=(48, 34, 34, 255))
    else:
        _rect(dr, x0 - 3, yb - 1, x1 + 3, yb, (176, 180, 188, 255), border=(56, 60, 70, 255))


def _wood_door(dr, cx, yb, hw=8, h=17, fill=(134, 82, 46, 255), dark=(88, 50, 26, 255), hi=(174, 118, 72, 255)):
    x0, x1, y0 = cx - hw, cx + hw, yb - h
    _rect(dr, x0 - 2, y0 - 2, x1 + 2, yb, (92, 82, 74, 255), border=(34, 28, 26, 255), hi=(134, 122, 112, 255))
    _rect(dr, x0, y0, x1, yb - 1, fill, border=(36, 24, 18, 255), hi=hi)
    # Double vantail + moulures
    dr.line([cx, y0 + 1, cx, yb - 2], fill=(42, 26, 18, 255))
    dr.rectangle([x0 + 2, y0 + 3, cx - 2, y0 + 8], fill=dark)
    dr.rectangle([cx + 2, y0 + 3, x1 - 2, y0 + 8], fill=dark)
    dr.rectangle([x0 + 2, y0 + 10, cx - 2, yb - 4], fill=dark)
    dr.rectangle([cx + 2, y0 + 10, x1 - 2, yb - 4], fill=dark)
    dr.point((cx - 2, y0 + 9), fill=(238, 198, 76, 255))
    dr.point((cx + 2, y0 + 9), fill=(238, 198, 76, 255))
    _rect(dr, x0 - 2, yb - 1, x1 + 2, yb, (176, 172, 162, 255), border=(52, 48, 46, 255))


def _strip_soft_shadow(im):
    """Supprime les ombres portées RPG Maker semi-transparentes (alpha < 200) coupées net par alphaTest."""
    a = np.array(im.convert('RGBA'))
    a[a[..., 3] < 200] = 0
    return Image.fromarray(a, 'RGBA')


# ================================================================== DÉCORS CRITIQUES
def _draw_crate_l(dr, x0, y0, w=14, h=15):
    """Dessine une caisse en bois 3/4 pixel-art Gen 5 dans un rectangle logique (w × h)."""
    out = (44, 28, 18, 255)
    top_hi = (224, 178, 114, 255)
    top_mid = (198, 148, 86, 255)
    top_sh = (164, 114, 62, 255)
    fr_hi = (182, 130, 74, 255)
    fr_mid = (154, 104, 56, 255)
    fr_in = (122, 78, 40, 255)
    fr_sh = (92, 56, 28, 255)
    nail = (68, 44, 28, 255)
    x1, y1 = x0 + w - 1, y0 + h - 1
    top_h = max(4, h // 3)
    # Face supérieure (perspective 3/4)
    _rect(dr, x0, y0, x1, y0 + top_h, top_mid, border=out, hi=top_hi, sh=top_sh)
    for y in range(y0 + 2, y0 + top_h, 2):
        dr.line([x0 + 1, y, x1 - 1, y], fill=top_sh)
    # Face avant encadrée + traverse diagonale
    fy0 = y0 + top_h
    _rect(dr, x0, fy0, x1, y1, fr_mid, border=out, hi=fr_hi, sh=fr_sh)
    _rect(dr, x0 + 2, fy0 + 2, x1 - 2, y1 - 2, fr_in, border=fr_sh)
    # Planches intérieures verticales
    for x in range(x0 + 4, x1 - 2, 3):
        dr.line([x, fy0 + 3, x, y1 - 3], fill=fr_sh)
    # Traverse diagonale en bois clair
    span = min(x1 - x0 - 4, y1 - fy0 - 4)
    for k in range(span + 1):
        px = x0 + 2 + k
        py = y1 - 2 - int(k * (y1 - fy0 - 4) / max(1, span))
        dr.point((px, py), fill=fr_hi)
        if px + 1 <= x1 - 2:
            dr.point((px + 1, py), fill=fr_mid)
    # Clous d'angle
    for nx, ny in ((x0 + 1, fy0 + 1), (x1 - 1, fy0 + 1), (x0 + 1, y1 - 1), (x1 - 1, y1 - 1)):
        dr.point((nx, ny), fill=nail)


def make_d_caisse():
    im = _canvas2x(15, 16)
    _draw_crate_l(ImageDraw.Draw(im), 0, 0, 15, 16)
    return _up2(im)


def make_d_caisses():
    """Pile de 3 caisses en bois Gen 5 (36×50 px) — clairement lisible comme des caisses empilées."""
    im = _canvas2x(18, 25)
    dr = ImageDraw.Draw(im)
    # Caisse arrière gauche (base)
    _draw_crate_l(dr, 0, 10, 12, 14)
    # Caisse avant droite légèrement avancée
    _draw_crate_l(dr, 6, 11, 12, 14)
    # Caisse empilée au sommet (légèrement décalée)
    _draw_crate_l(dr, 3, 0, 12, 13)
    return _up2(im)


def make_d_squelette(root):
    """Squelette de dragon préhistorique sur socle de musée (128×62 px = 4 cases exactes, style Gen 5 net)."""
    src_path = os.path.join(root, 'odyssee', 'img', 'deco', 'squelette.png')
    if not os.path.exists(src_path):
        return None
    im = Image.open(src_path).convert('RGBA')
    a = np.array(im)
    # Nettoie les franges violet/magenta résiduelles et normalise le trait sur le gris-brun foncé Gen 5
    r, g, b, al = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int), a[..., 3]
    a[al < 140] = 0
    al = a[..., 3]
    a[al >= 140, 3] = 255
    # Pixels à dominante magenta/pourpre -> contour os/bois sombre propre
    purp = (al >= 140) & (r > g + 16) & (b > g + 12)
    a[purp, :3] = np.clip(np.stack([r[purp] * 0.55, g[purp] * 0.62, b[purp] * 0.45], axis=-1), 28, 72).astype('uint8')
    # Éclaircit légèrement l'ivoire des os pour coller à la palette lumineuse BW2
    os_px = (al >= 140) & (r > 130) & (g > 115) & (b > 75) & (np.arange(a.shape[0])[:, None] < 22)
    a[os_px, 0] = np.clip(a[os_px, 0] * 1.08 + 10, 0, 248).astype('uint8')
    a[os_px, 1] = np.clip(a[os_px, 1] * 1.07 + 8, 0, 242).astype('uint8')
    a[os_px, 2] = np.clip(a[os_px, 2] * 1.04 + 6, 0, 218).astype('uint8')
    return Image.fromarray(a, 'RGBA').resize((im.width * 2, im.height * 2), Image.NEAREST)


# ================================================================== BÂTIMENTS CRITIQUES
def make_b_gare(orig_im):
    """Répare la vraie Gare Gen 5 de kit_bw_set : supprime l'ombre alpha=64, ajoute mur de fond + double porte vitrée."""
    im = _strip_soft_shadow(orig_im)
    # Coupe sous y=310 (lignes 310..331 = ombre RPG Maker vide)
    im = im.crop((0, 0, im.width, 310)).copy()
    dr = ImageDraw.Draw(im)
    # 1. Mur de fond sombre derrière les piliers & stands (zéro fuite de trottoir/herbe)
    bg = Image.new('RGBA', im.size, (0, 0, 0, 0))
    bdr = ImageDraw.Draw(bg)
    # Arrière-plan de la galerie (x=10..254, y=242..309)
    bdr.rectangle([10, 242, 254, 309], fill=(56, 52, 58, 255))
    for x in range(12, 254, 16):
        bdr.line([x, 244, x, 300], fill=(46, 42, 48, 255))
    # Plinthe pierre grise en bas sous les vitrines
    bdr.rectangle([10, 298, 254, 309], fill=(112, 108, 114, 255), outline=(42, 38, 44, 255))
    bdr.line([11, 299, 253, 299], fill=(148, 144, 150, 255))
    # Compose l'original par-dessus le mur de fond (les piliers et stands restent intacts devant !)
    bg.alpha_composite(im, (0, 0))
    im = bg
    # 2. Copie le pilier gauche (x=10..19) sur le bord droit (x=246..255) pour refermer proprement la façade
    pilier = im.crop((10, 242, 20, 310))
    im.alpha_composite(pilier, (246, 242))
    # 3. Grande double porte vitrée coulissante Gen 5 dans l'arche centrale (x=108..179, centre = 144)
    dr = ImageDraw.Draw(im)
    # Panneau supérieur métallique au-dessus des portes
    dr.rectangle([108, 242, 179, 256], fill=(74, 62, 56, 255))
    dr.rectangle([112, 245, 175, 253], fill=(176, 116, 62, 255), outline=(48, 34, 26, 255))
    # Bandeau « GARE » doré / bleu
    dr.rectangle([120, 247, 167, 251], fill=(236, 224, 186, 255))
    # Double porte vitrée coulissante (x=114..173, y=256..308, centre 144)
    # Cadre métal gris-bleu
    dr.rectangle([110, 256, 177, 309], fill=(138, 146, 160, 255), outline=(36, 40, 48, 255))
    dr.rectangle([114, 260, 173, 306], fill=(32, 46, 64, 255), outline=(48, 56, 70, 255))
    # Vantaux vitrés gauche & droit
    dr.rectangle([116, 262, 142, 304], fill=(78, 142, 192, 255))
    dr.rectangle([146, 262, 171, 304], fill=(78, 142, 192, 255))
    # Reflets diagonaux pixel-art (par blocs 2×2)
    for ox in (118, 148):
        for k in range(0, 20, 2):
            dr.rectangle([ox + k, 264 + k, ox + k + 3, 265 + k], fill=(166, 220, 248, 255))
            if k < 14:
                dr.rectangle([ox + k + 4, 264 + k, ox + k + 5, 265 + k], fill=(120, 184, 226, 255))
    # Montant central & poignée + bande de sécurité
    dr.rectangle([142, 260, 145, 306], fill=(42, 48, 60, 255))
    dr.rectangle([116, 284, 141, 287], fill=(182, 194, 208, 255))
    dr.rectangle([146, 284, 171, 287], fill=(182, 194, 208, 255))
    # Marche de seuil en pierre
    dr.rectangle([108, 305, 179, 309], fill=(184, 188, 196, 255), outline=(54, 58, 66, 255))
    return im, 144


def make_b_tour_vitre(orig_im):
    """Ajoute un hall vitré Gen 5 dans le rectangle noir vide au pied de b_tour_vitre (x=71..144, y=327..351)."""
    im = orig_im.convert('RGBA').copy()
    dr = ImageDraw.Draw(im)
    # Cadre aluminium + double porte vitrée de hall de gratte-ciel (x=72..143, y=327..351)
    dr.rectangle([72, 327, 143, 351], fill=(40, 52, 68, 255))
    dr.rectangle([74, 328, 141, 349], fill=(74, 134, 184, 255), outline=(146, 158, 174, 255))
    # 3 montants verticaux (porte double au centre + 2 vitrines latérales)
    for mx in (92, 108, 124):
        dr.rectangle([mx - 1, 328, mx, 349], fill=(44, 54, 70, 255))
    # Reflets diagonaux 2×2
    for bx in (78, 96, 112, 128):
        for k in range(0, 10, 2):
            dr.rectangle([bx + k, 330 + k, bx + k + 1, 331 + k], fill=(168, 222, 248, 255))
    # Seuil pierre claire
    dr.rectangle([72, 348, 143, 351], fill=(180, 186, 196, 255), outline=(56, 62, 74, 255))
    return im, None


def make_b_bourse():
    """Bourse de Métropole unifiée Gen 5 (384×272 = 12 cases, porte double centrée à x=192)."""
    im = _canvas2x(192, 136)
    dr = ImageDraw.Draw(im)
    out = (34, 38, 50, 255)
    stone = (214, 212, 204, 255)
    stone_hi = (238, 236, 228, 255)
    stone_sh = (172, 170, 162, 255)
    slate = (62, 74, 104, 255)
    slate_hi = (94, 112, 152, 255)
    slate_sh = (42, 50, 74, 255)
    gold = (224, 184, 76, 255)
    gold_hi = (248, 222, 126, 255)
    gold_sh = (156, 118, 38, 255)

    # Ailes gauche & droite (x=4..54 et x=137..187) — pierre + baies vitrées
    for ax0, ax1 in ((4, 58), (133, 187)):
        _rect(dr, ax0, 34, ax1, 135, stone, border=out, hi=stone_hi, sh=stone_sh)
        _bricks_l(dr, ax0, 40, ax1, 124, (194, 192, 184, 255), step_y=4, step_x=8)
        # Toit terrasse bleu-ardoise + corniche dorée
        _rect(dr, ax0 - 2, 22, ax1 + 2, 35, slate, border=out, hi=slate_hi, sh=slate_sh)
        for y in range(25, 34, 3):
            dr.line([ax0, y, ax1, y], fill=slate_sh)
        _rect(dr, ax0 - 1, 35, ax1 + 1, 38, gold, border=(68, 54, 24, 255), hi=gold_hi)
        # Soubassement granit
        _rect(dr, ax0, 122, ax1, 135, (124, 128, 138, 255), border=out, hi=(156, 160, 170, 255))
        # 3 étages × 3 baies vitrées Gen 5
        for wy in (44, 68, 94):
            for wx in (ax0 + 6, ax0 + 21, ax0 + 36):
                _glass_win(dr, wx, wy, wx + 11, wy + 16, sill=(150, 148, 142, 255))

    # Corps central monumental (x=50..141) — colonnade, horloge/emblème Bourse, grand hall d'entrée
    _rect(dr, 50, 20, 141, 135, stone_hi, border=out, sh=stone_sh)
    _bricks_l(dr, 50, 36, 141, 122, (204, 202, 194, 255), step_y=4, step_x=8)
    # Grande verrière d'étage centrale (panneau boursier / verrière bleue)
    _rect(dr, 56, 38, 135, 92, (46, 62, 86, 255), border=out)
    for gx in range(60, 132, 12):
        _glass_win(dr, gx, 42, gx + 9, 64, frame=(40, 50, 68, 255), mid=(76, 138, 194, 255))
        _glass_win(dr, gx, 68, gx + 9, 88, frame=(40, 50, 68, 255), mid=(66, 122, 176, 255))
    # Bandeau LED boursier lumineux (cours vert/or) au-dessus du porche
    _rect(dr, 56, 94, 135, 102, (28, 36, 48, 255), border=out)
    for tx in range(60, 131, 6):
        col_t = (84, 218, 136, 255) if (tx // 6) % 3 != 0 else (246, 208, 84, 255)
        dr.rectangle([tx, 97, tx + 3, 99], fill=col_t)

    # Grand toit mansardé + fronton central doré
    _rect(dr, 46, 6, 145, 22, slate, border=out, hi=slate_hi, sh=slate_sh)
    for x in range(52, 140, 8):
        dr.line([x, 8, x, 20], fill=slate_sh)
    _rect(dr, 48, 21, 143, 25, gold, border=(68, 54, 24, 255), hi=gold_hi, sh=gold_sh)
    # Médaillon doré central (symbole Poké-Yen / Bourse)
    cx = 96
    _rect(dr, cx - 18, 2, cx + 18, 24, slate_hi, border=out, hi=(132, 152, 196, 255))
    dr.ellipse([cx - 9, 5, cx + 9, 21], fill=gold, outline=(62, 46, 18, 255))
    dr.ellipse([cx - 6, 8, cx + 6, 18], fill=gold_hi, outline=gold_sh)
    # Petit symbole « P » boursier au centre
    dr.line([cx - 2, 10, cx - 2, 16], fill=(72, 52, 20, 255))
    dr.rectangle([cx - 2, 10, cx + 2, 13], outline=(72, 52, 20, 255))

    # Colonnes de marbre encadrant le porche
    for col_x in (54, 70, 118, 134):
        _rect(dr, col_x, 103, col_x + 5, 135, stone_hi, border=(74, 76, 86, 255), sh=stone_sh)
        dr.line([col_x + 1, 104, col_x + 1, 134], fill=(250, 248, 242, 255))
    # Porche et grande double porte vitrée centrée à cx=96 (= 192 px en 2× !)
    _rect(dr, 76, 104, 116, 135, (148, 150, 158, 255), border=out)
    _auto_door(dr, cx, 135, hw=13, h=24, mat=(168, 52, 58, 255))
    return _up2(im), 192


def make_b_mairie():
    """Mairie Gen 5 (288×256 = 9 cases, porte civique centrée à x=144) — pierre crème, toit ardoise, horloge."""
    im = _canvas2x(144, 128)
    dr = ImageDraw.Draw(im)
    out = (38, 36, 44, 255)
    wall = (228, 218, 196, 255)
    wall_hi = (244, 236, 218, 255)
    wall_sh = (188, 176, 152, 255)
    roof = (64, 86, 126, 255)
    roof_hi = (98, 126, 174, 255)
    roof_sh = (42, 58, 90, 255)
    trim = (198, 186, 162, 255)
    cx = 72

    # Corps principal pierre crème
    _rect(dr, 4, 46, 139, 127, wall, border=out, hi=wall_hi, sh=wall_sh)
    _bricks_l(dr, 4, 48, 139, 114, (206, 196, 174, 255), step_y=4, step_x=8)
    # Soubassement granit
    _rect(dr, 4, 114, 139, 127, (134, 132, 136, 255), border=out, hi=(168, 166, 170, 255))
    _bricks_l(dr, 4, 114, 139, 127, (98, 96, 102, 255), step_y=4, step_x=8)
    # Toit mansardé ardoise bleue avec rangées d'ardoises
    for y in range(24, 48):
        inset = max(0, (47 - y) // 4)
        col = roof_hi if y < 27 else (roof_sh if y > 44 else roof)
        dr.line([2 + inset, y, 141 - inset, y], fill=col)
        if y % 4 == 0 and 26 < y < 45:
            dr.line([4 + inset, y, 139 - inset, y], fill=roof_sh)
        dr.point((2 + inset, y), fill=out)
        dr.point((141 - inset, y), fill=out)
    dr.line([8, 24, 135, 24], fill=out)
    _rect(dr, 2, 46, 141, 49, trim, border=out, hi=wall_hi)

    # Avant-corps central + beffroi d'horloge civique
    _rect(dr, cx - 24, 34, cx + 24, 127, wall_hi, border=out, sh=wall_sh)
    _bricks_l(dr, cx - 24, 48, cx + 24, 114, (214, 204, 182, 255), step_y=4, step_x=8)
    # Clocheton / Fronton horloge
    _rect(dr, cx - 18, 10, cx + 18, 36, wall_hi, border=out, sh=wall_sh)
    for y in range(2, 11):
        hw = 2 + (y - 2) * 2
        dr.line([cx - hw, y, cx + hw, y], fill=roof_hi if y < 5 else roof)
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    dr.line([cx - 19, 11, cx + 19, 11], fill=out)
    # Cadran d'horloge doré
    dr.ellipse([cx - 8, 15, cx + 8, 31], fill=(248, 246, 236, 255), outline=(176, 138, 48, 255))
    dr.line([cx, 23, cx, 18], fill=(38, 40, 50, 255))
    dr.line([cx, 23, cx + 4, 23], fill=(38, 40, 50, 255))

    # Fenêtres symétriques sur 2 étages
    for wy in (58, 86):
        for wx in (12, 28, 104, 120):
            _glass_win(dr, wx, wy, wx + 11, wy + 18, frame=(76, 62, 48, 255), sill=wall_sh)
    # 2 fenêtres hautes sur l'avant-corps + drapeau tricolore / bannière municipale
    _glass_win(dr, cx - 16, 54, cx - 6, 70, frame=(76, 62, 48, 255))
    _glass_win(dr, cx + 6, 54, cx + 16, 70, frame=(76, 62, 48, 255))
    # Fronton triangulaire du porche + 4 colonnes
    _rect(dr, cx - 22, 82, cx + 22, 87, trim, border=out, hi=wall_hi)
    for col_x in (cx - 21, cx - 14, cx + 10, cx + 17):
        _rect(dr, col_x, 87, col_x + 4, 127, wall_hi, border=(78, 72, 66, 255), sh=wall_sh)
    # Double porte civique bois massif pleine + perron de 2 marches (centrée à cx=72 -> 144 px)
    _wood_door(dr, cx, 124, hw=10, h=26)
    _rect(dr, cx - 16, 124, cx + 16, 127, (188, 184, 176, 255), border=out, hi=(220, 216, 208, 255))
    return _up2(im), 144


def make_b_centrale():
    """Centrale Électrique de Voltacité Gen 5 (128×192 = 4 cases exactes, porte blindée alignée sur door=1 -> 48 px)."""
    im = _canvas2x(64, 96)
    dr = ImageDraw.Draw(im)
    out = (30, 34, 42, 255)
    steel = (118, 128, 144, 255)
    steel_hi = (158, 170, 186, 255)
    steel_sh = (78, 86, 102, 255)
    dark = (52, 58, 70, 255)
    yel = (238, 198, 52, 255)
    yel_hi = (254, 232, 118, 255)

    # Bobines / isolateurs haute tension sur le toit
    for bx in (10, 24, 46):
        _rect(dr, bx, 6, bx + 7, 26, (94, 104, 118, 255), border=out, hi=steel_hi)
        for ry in (9, 14, 19):
            _rect(dr, bx - 2, ry, bx + 9, ry + 2, (164, 196, 224, 255), border=out)
        dr.ellipse([bx + 1, 2, bx + 6, 7], fill=yel, outline=out)

    # Corps principal acier/béton industriel
    _rect(dr, 3, 28, 60, 95, steel, border=out, hi=steel_hi, sh=steel_sh)
    # Toit technique plat gris foncé
    _rect(dr, 1, 22, 62, 31, dark, border=out, hi=(84, 92, 108, 255))
    # Panneaux verticaux d'acier + rivets
    for px_c in (18, 34, 48):
        dr.line([px_c, 32, px_c, 94], fill=steel_sh)
    # Bandeau jaune & noir haute tension (style Unys industriel)
    _rect(dr, 3, 56, 60, 62, yel, border=out)
    for sx in range(5, 58, 6):
        dr.polygon([(sx, 57), (sx + 3, 57), (sx + 1, 61), (sx - 2, 61)], fill=(34, 36, 42, 255))

    # Fenêtres de salle de contrôle (haut) + grille de ventilation (droite)
    _glass_win(dr, 8, 36, 28, 49, frame=dark, mid=(86, 162, 214, 255), hi=(196, 238, 255, 255))
    _glass_win(dr, 36, 36, 55, 49, frame=dark, mid=(86, 162, 214, 255), hi=(196, 238, 255, 255))
    # Emblème éclair jaune sur plaque sombre à droite de la porte
    _rect(dr, 40, 68, 56, 86, dark, border=out, hi=(82, 90, 106, 255))
    dr.polygon([(49, 70), (44, 78), (48, 78), (46, 84), (53, 75), (49, 75)], fill=yel_hi, outline=(128, 92, 20, 255))
    # Porte blindée coulissante pleine centrée à cx=24 (= 48 px en 2× -> door=1 exact !)
    _rect(dr, 12, 66, 36, 95, (74, 82, 96, 255), border=out, hi=steel_hi)
    _auto_door(dr, 24, 95, hw=9, h=22, frame=dark, glass=(92, 146, 184, 255))
    return _up2(im), 48


def make_b_fonderie(variant_b=False):
    """Fonderie industrielle Gen 5 (224×248 = 7 cases exactes de Forge-Acier, porte acier centrée à x=112)."""
    im = _canvas2x(112, 124)
    dr = ImageDraw.Draw(im)
    out = (34, 28, 28, 255)
    brick = (128, 72, 56, 255) if not variant_b else (106, 86, 74, 255)
    brick_hi = (158, 96, 76, 255) if not variant_b else (136, 114, 98, 255)
    brick_sh = (86, 46, 36, 255) if not variant_b else (72, 56, 48, 255)
    roof = (64, 96, 86, 255) if not variant_b else (76, 82, 94, 255)
    roof_hi = (94, 134, 122, 255) if not variant_b else (108, 116, 132, 255)
    roof_sh = (42, 66, 60, 255) if not variant_b else (48, 52, 62, 255)
    cx = 56

    # Deux grandes cheminées de haut-fourneau en brique & acier au fond
    for sx in (16, 84):
        _rect(dr, sx, 4, sx + 12, 42, (92, 66, 58, 255), border=out, hi=(126, 94, 82, 255), sh=(58, 42, 38, 255))
        _bricks_l(dr, sx, 6, sx + 12, 38, (64, 44, 38, 255), step_y=4, step_x=6)
        _rect(dr, sx - 2, 2, sx + 14, 7, (58, 62, 72, 255), border=out, hi=(96, 102, 116, 255))
        _rect(dr, sx - 1, 16, sx + 13, 19, (68, 72, 82, 255), border=out)

    # Corps de brique massif (x=4..107, y=44..123)
    _rect(dr, 4, 46, 107, 123, brick, border=out, hi=brick_hi, sh=brick_sh)
    _bricks_l(dr, 4, 48, 107, 110, brick_sh, brick_hi, step_y=4, step_x=8)
    # Contreforts acier verticaux + soubassement pierre sombre
    for px_c in (4, 32, 76, 103):
        _rect(dr, px_c, 46, px_c + 4, 123, (78, 82, 92, 255), border=out, hi=(112, 118, 130, 255))
    _rect(dr, 4, 110, 107, 123, (88, 86, 92, 255), border=out, hi=(118, 116, 124, 255))
    _bricks_l(dr, 4, 110, 107, 123, (58, 56, 62, 255), step_y=4, step_x=8)

    # Toit industriel cuivre patiné / ardoise + verrière zénithale (lanterneau)
    for y in range(28, 48):
        inset = max(0, (47 - y) // 3)
        col = roof_hi if y < 32 else (roof_sh if y > 44 else roof)
        dr.line([2 + inset, y, 109 - inset, y], fill=col)
        if y % 4 == 0 and 30 < y < 45:
            dr.line([4 + inset, y, 107 - inset, y], fill=roof_sh)
        dr.point((2 + inset, y), fill=out)
        dr.point((109 - inset, y), fill=out)
    dr.line([8, 28, 103, 28], fill=out)
    # Lanterneau central avec lueur chaude de forge
    _rect(dr, 34, 18, 77, 30, (62, 66, 76, 255), border=out, hi=(96, 102, 116, 255))
    for wx in range(38, 72, 11):
        _glass_win(dr, wx, 21, wx + 8, 28, frame=(40, 42, 50, 255), dark=(168, 76, 32, 255),
                   mid=(232, 134, 48, 255), hi=(254, 218, 116, 255))

    # Fenêtres industrielles à lueur de fournaise
    for wx in (12, 84):
        _glass_win(dr, wx, 58, wx + 15, 76, frame=(44, 46, 54, 255), dark=(148, 62, 28, 255),
                   mid=(224, 126, 46, 255), hi=(254, 212, 108, 255), sill=(68, 72, 82, 255))
        _glass_win(dr, wx, 86, wx + 15, 102, frame=(44, 46, 54, 255), dark=(58, 72, 92, 255),
                   mid=(92, 126, 158, 255), hi=(164, 198, 224, 255), sill=(68, 72, 82, 255))
    # Bandeau industriel jaune/noir au-dessus du portail
    _rect(dr, 38, 78, 73, 84, (232, 188, 52, 255), border=out)
    for sx in range(40, 71, 6):
        dr.rectangle([sx, 79, sx + 2, 83], fill=(38, 36, 40, 255))
    # Grand portail industriel double en acier (100 % opaque, centré à cx=56 -> 112 px)
    _rect(dr, 40, 84, 71, 123, (64, 70, 82, 255), border=out, hi=(104, 112, 126, 255))
    _rect(dr, 43, 87, 68, 122, (88, 96, 110, 255), border=(34, 38, 46, 255))
    dr.line([cx, 87, cx, 122], fill=(34, 38, 46, 255))
    for gy in range(92, 120, 5):
        dr.line([45, gy, cx - 2, gy], fill=(64, 70, 82, 255))
        dr.line([cx + 2, gy, 66, gy], fill=(64, 70, 82, 255))
    # Hublots chauds sur le portail
    _rect(dr, 46, 93, 53, 100, (234, 144, 56, 255), border=(42, 46, 54, 255), hi=(254, 218, 120, 255))
    _rect(dr, 59, 93, 66, 100, (234, 144, 56, 255), border=(42, 46, 54, 255), hi=(254, 218, 120, 255))
    _rect(dr, 38, 121, 73, 123, (152, 156, 164, 255), border=(48, 50, 58, 255))
    return _up2(im), 112


def make_b_atelier_brique():
    """Atelier de briques Volucité Gen 5 symétrique et complet (192×228 = 6 cases, porte à x=96)."""
    im = _canvas2x(96, 114)
    dr = ImageDraw.Draw(im)
    out = (38, 28, 26, 255)
    brick = (144, 76, 56, 255)
    brick_hi = (176, 102, 76, 255)
    brick_sh = (98, 48, 36, 255)
    roof = (64, 54, 58, 255)
    roof_hi = (98, 86, 92, 255)
    roof_sh = (42, 34, 38, 255)
    cx = 48

    # Corps de brique rouge-brun complet (zéro coupe sur les fenêtres !)
    _rect(dr, 3, 28, 92, 113, brick, border=out, hi=brick_hi, sh=brick_sh)
    _bricks_l(dr, 3, 30, 92, 102, brick_sh, brick_hi, step_y=4, step_x=8)
    # Toit mansardé ardoise sombre + lucarnes + corniche pierre
    for y in range(10, 29):
        inset = max(0, (28 - y) // 3)
        col = roof_hi if y < 14 else (roof_sh if y > 25 else roof)
        dr.line([1 + inset, y, 94 - inset, y], fill=col)
        if y % 4 == 0 and 12 < y < 26:
            dr.line([3 + inset, y, 92 - inset, y], fill=roof_sh)
        dr.point((1 + inset, y), fill=out)
        dr.point((94 - inset, y), fill=out)
    dr.line([7, 10, 88, 10], fill=out)
    _rect(dr, 2, 27, 93, 31, (192, 182, 168, 255), border=out, hi=(224, 214, 200, 255))

    # 3 fenêtres d'étage symétriques
    for wx in (11, 41, 71):
        _glass_win(dr, wx, 38, wx + 13, 56, frame=(68, 44, 36, 255), sill=(192, 182, 168, 255))
    # Bandeau pierre + auvent rayé rouge bordeaux & crème au-dessus de la boutique/atelier
    _rect(dr, 4, 66, 91, 76, (182, 42, 42, 255), border=out, hi=(214, 72, 66, 255), sh=(126, 26, 28, 255))
    for bx in range(8, 88, 8):
        dr.rectangle([bx, 67, min(90, bx + 3), 75], fill=(242, 232, 212, 255))
    # Rez-de-chaussée pierre sombre + vitrines + porte centrale pleine (cx=48 -> 96 px)
    _rect(dr, 4, 77, 91, 113, (88, 82, 84, 255), border=out, hi=(118, 112, 114, 255))
    _glass_win(dr, 9, 82, 31, 104, frame=(46, 40, 42, 255), mid=(106, 164, 206, 255))
    _glass_win(dr, 64, 82, 86, 104, frame=(46, 40, 42, 255), mid=(106, 164, 206, 255))
    # Jardinières fleuries sous les vitrines
    for jx in (9, 64):
        _rect(dr, jx, 104, jx + 22, 110, (124, 76, 44, 255), border=out)
        for fx in range(jx + 2, jx + 20, 4):
            dr.rectangle([fx, 101, fx + 2, 104], fill=(64, 152, 74, 255))
            dr.point((fx + 1, 101), fill=(242, 92, 88, 255) if (fx % 8 == 0) else (248, 212, 72, 255))
    _wood_door(dr, cx, 113, hw=9, h=28, fill=(138, 76, 44, 255))
    return _up2(im), 96


def make_b_tour_brique():
    """Tour de briques Volucité Gen 5 symétrique et complète (208×268 = 6,5 cases, porte=None)."""
    im = _canvas2x(104, 134)
    dr = ImageDraw.Draw(im)
    out = (34, 28, 30, 255)
    brick = (118, 68, 56, 255)
    brick_hi = (148, 92, 76, 255)
    brick_sh = (78, 44, 36, 255)
    stone = (156, 152, 148, 255)

    # Toit terrasse plat + bloc climatisation / cage d'escalier
    _rect(dr, 4, 8, 99, 24, (132, 134, 140, 255), border=out, hi=(168, 170, 178, 255), sh=(92, 94, 102, 255))
    _rect(dr, 12, 12, 91, 20, (108, 112, 120, 255), border=(74, 78, 86, 255))
    _rect(dr, 20, 4, 42, 16, (94, 100, 112, 255), border=out, hi=(132, 138, 150, 255))
    _rect(dr, 66, 6, 82, 16, (104, 110, 120, 255), border=out, hi=(138, 144, 154, 255))

    # Corps de brique de 3 étages + pilastres d'angle pierre
    _rect(dr, 4, 24, 99, 133, brick, border=out, hi=brick_hi, sh=brick_sh)
    _bricks_l(dr, 4, 26, 99, 110, brick_sh, brick_hi, step_y=4, step_x=8)
    _rect(dr, 4, 24, 9, 133, stone, border=out, hi=(196, 192, 188, 255))
    _rect(dr, 94, 24, 99, 133, stone, border=out, hi=(196, 192, 188, 255))
    # Corniches horizontales
    for cy in (24, 52, 80, 108):
        _rect(dr, 3, cy, 100, cy + 3, stone, border=out, hi=(200, 196, 192, 255))

    # 3 étages × 4 fenêtres symétriques intactes
    for wy in (31, 59, 87):
        for wx in (14, 34, 56, 76):
            _glass_win(dr, wx, wy, wx + 13, wy + 17, frame=(56, 44, 42, 255), sill=stone)
    # Rez-de-chaussée pierre + grand porche vitré décoratif
    _rect(dr, 4, 111, 99, 133, (96, 94, 100, 255), border=out, hi=(128, 126, 134, 255))
    _glass_win(dr, 12, 115, 32, 129, frame=(44, 44, 52, 255))
    _glass_win(dr, 71, 115, 91, 129, frame=(44, 44, 52, 255))
    _auto_door(dr, 52, 133, hw=12, h=19)
    return _up2(im), None


def make_b_serre():
    """Serre botanique Gen 5 (160×184 = 5 cases, porte vitrée pleine à x=80)."""
    im = _canvas2x(80, 92)
    dr = ImageDraw.Draw(im)
    out = (42, 54, 64, 255)
    iron = (232, 238, 244, 255)
    iron_sh = (162, 176, 190, 255)
    glass = (166, 220, 236, 255)
    glass_hi = (218, 246, 254, 255)
    foliage = (64, 152, 84, 255)
    fol_hi = (108, 196, 112, 255)
    cx = 40

    # Verrière arrondie en dôme + feuillage visible à travers la vitre
    for y in range(6, 46):
        hw = min(36, int(10 + ((y - 6) ** 0.68) * 3.8))
        dr.line([cx - hw, y, cx + hw, y], fill=glass_hi if y < 16 else glass)
        dr.point((cx - hw, y), fill=out)
        dr.point((cx + hw, y), fill=out)
    # Verrière basse rectangulaire + muret pierre blanche
    _rect(dr, 4, 44, 75, 91, glass, border=out)
    # Plantes luxuriantes derrière les vitres
    for px_f, py_f, rad in ((16, 62, 10), (30, 56, 9), (52, 58, 10), (64, 64, 9)):
        dr.ellipse([px_f - rad, py_f - rad, px_f + rad, py_f + rad], fill=foliage)
        dr.ellipse([px_f - rad + 2, py_f - rad + 1, px_f + rad - 4, py_f + rad - 5], fill=fol_hi)
    # Armatures blanches en fer forgé
    for ax in (14, 26, 40, 54, 66):
        dr.line([ax, 12 if 20 < ax < 60 else 28, ax, 80], fill=iron)
        dr.line([ax + 1, 12 if 20 < ax < 60 else 28, ax + 1, 80], fill=iron_sh)
    for ay in (26, 44, 62):
        dr.line([5, ay, 74, ay], fill=iron)
        dr.line([5, ay + 1, 74, ay + 1], fill=iron_sh)
    # Muret bas en brique claire
    _rect(dr, 4, 78, 75, 91, (206, 198, 184, 255), border=out, hi=(234, 228, 216, 255))
    _bricks_l(dr, 4, 79, 75, 91, (168, 160, 146, 255), step_y=4, step_x=8)
    # Double porte vitrée centrale pleine (cx=40 -> 80 px)
    _auto_door(dr, cx, 91, hw=10, h=24, frame=(72, 86, 98, 255), glass=(112, 188, 212, 255))
    return _up2(im), 80


def make_b_boutique_mode():
    """Boutique de mode chic de Métropole Gen 5 (192×216 = 6 cases exactes, porte vitrée alignée sur door=3 -> 112 px)."""
    im = _canvas2x(96, 108)
    dr = ImageDraw.Draw(im)
    out = (40, 32, 42, 255)
    wall = (242, 232, 222, 255)
    wall_hi = (252, 246, 238, 255)
    wall_sh = (206, 190, 178, 255)
    plum = (146, 48, 82, 255)
    plum_hi = (188, 76, 114, 255)
    plum_sh = (98, 28, 54, 255)
    gold = (232, 192, 88, 255)

    # Façade crème élégante style boutique parisienne / Volucité
    _rect(dr, 3, 24, 92, 107, wall, border=out, hi=wall_hi, sh=wall_sh)
    _bricks_l(dr, 3, 26, 92, 66, (224, 212, 200, 255), step_y=4, step_x=8)
    # Toit mansardé prune/bordeaux + corniche dorée
    for y in range(6, 25):
        inset = max(0, (24 - y) // 3)
        col = plum_hi if y < 10 else (plum_sh if y > 21 else plum)
        dr.line([1 + inset, y, 94 - inset, y], fill=col)
        if y % 4 == 0 and 9 < y < 22:
            dr.line([3 + inset, y, 92 - inset, y], fill=plum_sh)
        dr.point((1 + inset, y), fill=out)
        dr.point((94 - inset, y), fill=out)
    dr.line([7, 6, 88, 6], fill=out)
    _rect(dr, 2, 23, 93, 27, gold, border=out, hi=(252, 228, 138, 255))

    # Fenêtres d'étage avec balcons fer forgé
    for wx in (11, 41, 71):
        _glass_win(dr, wx, 33, wx + 13, 51, frame=(76, 52, 64, 255), mid=(124, 176, 222, 255))
        _rect(dr, wx - 1, 50, wx + 14, 55, (52, 46, 56, 255), border=(32, 28, 36, 255))
        for bx in range(wx + 1, wx + 13, 3):
            dr.line([bx, 51, bx, 54], fill=(224, 212, 200, 255))

    # Enseigne chic « MODE » + auvent rayé bordeaux & crème
    _rect(dr, 26, 57, 70, 65, plum, border=out, hi=plum_hi)
    _rect(dr, 28, 59, 68, 63, gold)
    _rect(dr, 3, 66, 92, 75, plum, border=out, hi=plum_hi, sh=plum_sh)
    for bx in range(7, 89, 8):
        dr.rectangle([bx, 67, min(91, bx + 3), 74], fill=(250, 242, 232, 255))

    # Rez-de-chaussée pierre claire + grande vitrine de vêtements à gauche (x=8..38) + vitrine droite (x=72..88)
    _rect(dr, 3, 76, 92, 107, (218, 208, 200, 255), border=out, sh=(176, 166, 158, 255))
    # Vitrine mannequins à gauche
    _rect(dr, 8, 79, 39, 103, (238, 234, 244, 255), border=(66, 48, 58, 255))
    dr.rectangle([9, 80, 38, 92], fill=(214, 228, 246, 255))
    # 2 silhouettes de tenues colorées (robe rose & veste bleue)
    dr.rectangle([14, 86, 20, 99], fill=(224, 92, 136, 255), outline=(88, 36, 56, 255))
    dr.rectangle([16, 83, 18, 86], fill=(232, 192, 88, 255))
    dr.rectangle([26, 86, 33, 99], fill=(78, 128, 206, 255), outline=(38, 58, 96, 255))
    dr.rectangle([28, 83, 30, 86], fill=(232, 192, 88, 255))
    # Petite vitrine chapeau à droite
    _rect(dr, 73, 79, 88, 103, (238, 234, 244, 255), border=(66, 48, 58, 255))
    dr.rectangle([77, 88, 84, 95], fill=(236, 178, 66, 255), outline=(92, 62, 26, 255))
    # Double porte vitrée boutique centrée à cx=56 (= 112 px en 2× -> door=3 sur w=6, doorRel=3.5 exact !)
    _auto_door(dr, 56, 107, hw=11, h=27, frame=(72, 46, 58, 255), glass=(114, 178, 224, 255), mat=plum)
    return _up2(im), 112


def appliquer_critiques(root, out_dir, decos, bat_dims):
    """Applique toutes les corrections critiques décors + bâtiments dans out_dir et met à jour decos/bat_dims."""
    # 1. Décors critiques
    d_caisse = make_d_caisse()
    d_caisse.save(os.path.join(out_dir, 'd_caisse.png'))
    decos['caisse'] = d_caisse

    d_caisses = make_d_caisses()
    d_caisses.save(os.path.join(out_dir, 'd_caisses.png'))
    decos['caisses'] = d_caisses

    d_sq = make_d_squelette(root)
    if d_sq is not None:
        d_sq.save(os.path.join(out_dir, 'd_squelette.png'))
        decos['squelette'] = d_sq

    # 2. Bâtiments critiques
    gare_p = os.path.join(out_dir, 'b_gare.png')
    if os.path.exists(gare_p):
        g_im, g_porte = make_b_gare(Image.open(gare_p))
        g_im.save(gare_p)
        bat_dims['gare'] = [g_im.width, g_porte]

    tv_p = os.path.join(out_dir, 'b_tour_vitre.png')
    if os.path.exists(tv_p):
        tv_im, tv_porte = make_b_tour_vitre(Image.open(tv_p))
        tv_im.save(tv_p)
        bat_dims['tour_vitre'] = [tv_im.width, tv_porte]

    fixes = {
        'bourse': make_b_bourse(),
        'mairie': make_b_mairie(),
        'centrale': make_b_centrale(),
        'fonderie': make_b_fonderie(variant_b=False),
        'fonderie_b': make_b_fonderie(variant_b=True),
        'atelier_brique': make_b_atelier_brique(),
        'tour_brique': make_b_tour_brique(),
        'serre': make_b_serre(),
        'boutique_mode': make_b_boutique_mode(),
    }
    for nom, (im, porte) in fixes.items():
        im.save(os.path.join(out_dir, f'b_{nom}.png'))
        bat_dims[nom] = [im.width, porte]
