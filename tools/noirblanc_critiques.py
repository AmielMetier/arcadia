"""
tools/noirblanc_critiques.py — Correctifs chirurgicaux 100 % fidèles aux sprites officiels Noir & Blanc (zéro dessin
procédural cartoony : uniquement des correctifs sur les pixels authentiques de kit_bw_set.png, ext_masterpiece.png,
centre_interieur.png et boutique_interieur.png) :
- Portes bouchées proprement DERRIÈRE les arches transparentes d'origine (b_centrale, b_mairie, b_serre, b_fonderie,
  b_gare, b_maison_desert_1) + jonction White-City authentique entre les 2 tours de b_bourse.png (via l'arche de b_mairie)
- Variantes 100 % kit_bw_set / ext_masterpiece : b_boutique_mode (b_boutique élargie & auvent bordeaux),
  b_maison_forge_p1 (b_maison_a_g reteintée brique/ardoise), b_tour_vitre_l (b_tour_vitre élargie à 9 cases)
- Raccourcissement sans couture + suppression ombres alpha=64 sur tour_vitre, tour_jaune, maison_forge_1/2
- Neige hivernale B2W2 généreuse sur b_boutique_neige_b & b_boutique_neige
- Décors authentiques : d_caisse / d_caisses tirés du vrai d_boxes.png Gen 5, d_squelette 4 cases, d_lamp nettoyé (s=0)
- Tuile officielle centre_interieur dans sol.png : x_shelf (rayonnage Poké Mart ; x_mat conservé symétrique pour les tapis rouges).
"""
import math
import os
import numpy as np
from PIL import Image, ImageDraw


def _strip_soft_shadow(im, thr=190):
    a = np.array(im.convert('RGBA'))
    a[a[..., 3] < thr] = 0
    return Image.fromarray(a, 'RGBA')


def _trim_bottom(im, thr=128):
    """Recadre le bas d'un sprite pour supprimer toute bande transparente laissée par un nettoyage d'ombre."""
    a = np.array(im.convert('RGBA'))
    ys = np.where(a[..., 3] >= thr)[0]
    if len(ys):
        return im.crop((0, 0, im.width, int(ys.max()) + 1))
    return im


def _patch_arch_door_behind(im, x0, y0, x1, y1, tint='glass'):
    """Place une porte coulissante Gen 5 sombre DERRIÈRE les pixels transparents d'une arche (ne touche aucun pixel opaque)."""
    im = im.convert('RGBA')
    w, h = im.size
    a = np.array(im)
    bg = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(bg)
    x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w - 1, x1), min(h - 1, y1)
    cx = (x0 + x1) // 2
    if tint == 'cyan_glass':
        # Porte coulissante vitrée bleu-ardoise sobre et symétrique (ombrage Gen 5 progressif sous l'arche, zéro trait crénelé)
        dr.rectangle([x0, y0, x1, y1], fill=(22, 42, 64, 255))
        pane_h = max(1, (y1 - 4) - (y0 + 2))
        for yy in range(y0 + 2, y1 - 3):
            t = (yy - (y0 + 2)) / pane_h
            # Dégradé doux sombre sous l'arche -> bleu-verre ardoise en bas (style Opelucid / Ville Noire)
            cr = int(28 + 26 * t)
            cg = int(58 + 50 * t)
            cb = int(90 + 62 * t)
            dr.line([(x0 + 3, yy), (cx - 2, yy)], fill=(cr, cg, cb, 255))
            dr.line([(cx + 2, yy), (x1 - 3, yy)], fill=(cr, cg, cb, 255))
        # Légers reflets verticaux symétriques sur chaque battant (discrets, 2 px de large)
        hl_top = y0 + max(6, pane_h // 4)
        hl_bot = y1 - 8
        if hl_bot > hl_top:
            for rx in (x0 + 6, cx + 5):
                if rx + 2 < x1 - 3:
                    dr.rectangle([rx, hl_top, rx + 1, hl_bot], fill=(92, 148, 188, 255))
        dr.rectangle([cx - 1, y0, cx + 1, y1], fill=(18, 34, 52, 255))
        dr.rectangle([x0, y1 - 3, x1, y1], fill=(78, 114, 142, 255))
        dr.line([(x0, y1 - 3), (x1, y1 - 3)], fill=(122, 162, 190, 255))
    elif tint == 'dark_wood':
        # Porte industrielle acier/bois sombre (b_maison_desert_1)
        dr.rectangle([x0, y0, x1, y1], fill=(38, 30, 26, 255))
        dr.rectangle([x0 + 2, y0 + 2, cx - 1, y1 - 2], fill=(64, 50, 42, 255))
        dr.rectangle([cx + 2, y0 + 2, x1 - 2, y1 - 2], fill=(64, 50, 42, 255))
        dr.rectangle([cx - 1, y0, cx + 1, y1], fill=(30, 24, 20, 255))
        dr.rectangle([x0, y1 - 2, x1, y1], fill=(92, 82, 74, 255))
    else:
        # Porte coulissante vitrée ardoise Gen 5
        dr.rectangle([x0, y0, x1, y1], fill=(34, 44, 58, 255))
        dr.rectangle([x0 + 3, y0 + 3, cx - 2, y1 - 4], fill=(62, 88, 118, 255))
        dr.rectangle([cx + 2, y0 + 3, x1 - 3, y1 - 4], fill=(62, 88, 118, 255))
        dr.rectangle([cx - 1, y0, cx + 1, y1], fill=(32, 40, 52, 255))
        dr.rectangle([x0, y1 - 4, x1, y1], fill=(156, 162, 172, 255))

    # Ne remplit QUE la cavité transparente située dans [x0..x1, y0..y1] (aucun débord à l'extérieur des bords arrondis !)
    bga = np.array(bg)
    opaque = a[..., 3] >= 180
    has_above = np.zeros((h, w), dtype=bool)
    seen = np.zeros(w, dtype=bool)
    for y in range(h):
        has_above[y] = seen
        seen |= opaque[y]
    fill_mask = (~opaque) & has_above & (bga[..., 3] > 0)
    out = a.copy()
    out[fill_mask] = bga[fill_mask]
    return Image.fromarray(out, 'RGBA')


def _fix_b_gare(orig_im):
    """Répare la vraie Gare Gen 5 de kit_bw_set : retire l'ombre alpha=64, nettoie le rebord gauche + porte vitrée sobre."""
    im = _strip_soft_shadow(orig_im, thr=180)
    im = im.crop((0, 0, im.width, 310)).copy()
    bg = Image.new('RGBA', im.size, (0, 0, 0, 0))
    bdr = ImageDraw.Draw(bg)
    bdr.rectangle([10, 242, 254, 309], fill=(56, 52, 58, 255))
    bdr.rectangle([10, 298, 254, 309], fill=(112, 108, 114, 255), outline=(42, 38, 44, 255))
    bg.alpha_composite(im, (0, 0))
    im = bg
    # Ferme le bord droit avec le pilier gauche authentique du même sprite
    im.alpha_composite(im.crop((10, 242, 20, 310)), (246, 242))
    # Nettoie la petite tache ocre résiduelle (x=34..43, y=282..290) sous la vitrine gauche avec la pierre propre de droite
    im.paste(im.crop((198, 281, 210, 291)), (33, 281))
    # Porte vitrée coulissante sobre (verre bleu-ardoise assorti aux fenêtres de la Gare, cadre pierre/bronze)
    dr = ImageDraw.Draw(im)
    dr.rectangle([110, 256, 177, 309], fill=(124, 128, 138, 255), outline=(42, 42, 48, 255))
    dr.rectangle([114, 260, 173, 306], fill=(38, 46, 58, 255))
    for yy in range(262, 305):
        t = (yy - 262) / 42.0
        col = (int(56 + 22 * t), int(78 + 28 * t), int(104 + 34 * t), 255)
        dr.line([(116, yy), (142, yy)], fill=col)
        dr.line([(146, yy), (171, yy)], fill=col)
    # Reflet doux et discret (tons bleu-gris Gen 5, sans blanc criard)
    for ox in (120, 150):
        for k in range(0, 16, 2):
            dr.rectangle([ox + k, 267 + k, ox + k + 2, 268 + k], fill=(122, 152, 182, 255))
    dr.rectangle([142, 260, 145, 306], fill=(44, 50, 62, 255))
    dr.rectangle([108, 305, 179, 309], fill=(168, 172, 180, 255), outline=(56, 58, 66, 255))
    return im, 144


def _fix_b_mairie(orig_im):
    """Garde 100 % du vrai sprite Gen 5 b_mairie, retire les 2 barres grises parasites et bouche la porte derrière l'arche."""
    im = _strip_soft_shadow(orig_im, thr=160)
    a = np.array(im)
    h, w = a.shape[:2]
    for side_xs in (range(0, 8), range(w - 8, w)):
        for x in side_xs:
            if int((a[:, x, 3] > 0).sum()) < 40:
                a[:, x] = 0
    im = _trim_bottom(Image.fromarray(a, 'RGBA'))
    im = _patch_arch_door_behind(im, 88, 270, 162, im.height - 1, tint='cyan_glass')
    return im, 125


def _fix_b_bourse(orig_bourse, fixed_mairie):
    """Aligne les 2 vraies tours Gen 5 de b_bourse.png au même niveau de sol (tour droite +12 px), fusionne la fente avec
    leur propre mur White-City, et pose UNIQUEMENT le capot d'arche détouré de b_mairie au centre (porte=179)."""
    im = _strip_soft_shadow(orig_bourse, thr=160).copy()
    w, h = im.size  # 358 x 277 ; tour gauche y=1..276 (x=0..178), tour droite y=13..264 (x=191..358) -> +12 px = y=276 exact !
    left_tower = im.crop((0, 0, 178, h))
    right_tower = im.crop((191, 0, w, 265))  # 167 x 265 -> posée à y=12 -> bas exactement à y=277 !

    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    # 1. Passerelle symétrique authentique (bande centrale de b_mairie) dans la fente x=177..192 entre les 2 tours
    bridge_col = fixed_mairie.crop((117, 176, 133, 272))  # 16 x 96 symétrique du même marbre/cyan White-City
    out.alpha_composite(bridge_col, (177, 132))
    out.alpha_composite(left_tower.crop((152, 200, 174, h)), (172, 200))
    # 2. Les deux vraies tours Gen 5 alignées sur exactement la même ligne de sol (y=276) !
    out.alpha_composite(left_tower, (0, 0))
    out.alpha_composite(right_tower, (191, 12))

    # 3. Extrait UNIQUEMENT l'arche cintrée + sa porte depuis fixed_mairie (x=85..165, y=262..338 -> 80 x 76 px), détourée au polygone exact
    arch_raw = fixed_mairie.crop((85, 262, 165, 338))  # 80 x 76, centre x=40
    mask = Image.new('L', arch_raw.size, 0)
    mdr = ImageDraw.Draw(mask)
    # Polygone épousant exactement le capot octogonal/arrondi de l'arche White-City (zéro morceau de mur rectangulaire !)
    mdr.polygon([
        (36, 1), (44, 1),     # sommet du capot
        (68, 12), (76, 22),   # épaule droite
        (79, 46), (76, 75),   # pilier droit
        (4, 75), (1, 46),     # pilier gauche
        (4, 22), (12, 12),    # épaule gauche
    ], fill=255)
    arch_a = np.array(arch_raw)
    arch_a[..., 3] = np.minimum(arch_a[..., 3], np.array(mask))
    arch_clean = Image.fromarray(arch_a, 'RGBA')
    out.alpha_composite(arch_clean, (179 - arch_clean.width // 2, h - arch_clean.height))
    return out, 179


def _fix_b_fonderie(orig_im):
    """Garde 100 % du vrai sprite industriel Gen 5 b_fonderie, retire l'ombre alpha=64 et intègre une vraie porte d'usine à porte=88."""
    im = _strip_soft_shadow(orig_im, thr=180)
    im = im.crop((0, 0, im.width, min(im.height, 272))).copy()
    # Remplit proprement le socle de brique sous la passerelle + double porte métallique sombre centrée à x=88 (porte=88)
    w, h = im.size  # 176 x 272
    bg = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    bdr = ImageDraw.Draw(bg)
    # Mur de fond brique sombre entre les deux piliers principaux (x=28..146, y=246..271) pour ne plus voir d'herbe sous les échafaudages
    bdr.rectangle([28, 246, 146, h - 1], fill=(70, 58, 46, 255))
    for yy in range(250, h - 2, 6):
        bdr.line([(28, yy), (146, yy)], fill=(54, 44, 34, 255))
    bdr.rectangle([28, h - 4, 146, h - 1], fill=(50, 44, 38, 255))
    bg.alpha_composite(im, (0, 0))
    im = bg
    # Double porte industrielle acier/bois sombre centrée exactement sur porte=88 (x=72..104, y=236..271)
    dr = ImageDraw.Draw(im)
    dr.rectangle([72, 236, 104, h - 1], fill=(42, 36, 32, 255), outline=(28, 22, 18, 255))
    dr.rectangle([75, 239, 87, h - 4], fill=(66, 56, 48, 255), outline=(48, 40, 34, 255))
    dr.rectangle([89, 239, 101, h - 4], fill=(66, 56, 48, 255), outline=(48, 40, 34, 255))
    # Petites lucarnes industrielles en haut de chaque battant
    dr.rectangle([77, 242, 85, 249], fill=(46, 54, 62, 255))
    dr.rectangle([91, 242, 99, 249], fill=(46, 54, 62, 255))
    # Seuil métallique bas
    dr.rectangle([70, h - 4, 106, h - 1], fill=(104, 96, 88, 255), outline=(40, 34, 30, 255))
    return im, 88


def _fix_b_boutique_mode(b_boutique):
    """Crée la Boutique de mode 6 cases (198×196, porte=112) 100 % sans couture depuis le vrai b_boutique.png !"""
    # b_boutique est 150×196 ; son auvent et ses vitrines ont une période exacte de 24 px.
    # On élargit de +48 px (2 × 24 px = 198 px = 6,19 cases) par bande horizontale pour 0 couture !
    src = b_boutique.convert('RGBA')
    w, h = src.size  # 150 x 196
    W = 198
    out = Image.new('RGBA', (W, h), (0, 0, 0, 0))

    # 1) Toit courbé (y=0..56) : étirement symétrique propre (pic centré à x=99, courbe continue)
    out.paste(src.crop((0, 0, w, 56)).resize((W, 56), Image.NEAREST), (0, 0))

    # 2) Étage briques brunes (y=56..94) : fenêtre centrale (60..92) centrée + 24 px de brique unie de chaque côté
    out.paste(src.crop((0, 56, 60, 94)), (0, 56))
    brick_l = src.crop((54, 56, 62, 94))  # 8 px de brique unie sans ombre verticale
    for k in range(3):
        out.paste(brick_l, (60 + k * 8, 56))
    out.paste(src.crop((60, 56, 92, 94)), (84, 56))  # fenêtre cintrée centrée à x=100
    brick_r = brick_l.transpose(Image.FLIP_LEFT_RIGHT)
    for k in range(3):
        out.paste(brick_r, (116 + k * 8, 56))
    out.paste(src.crop((92, 56, w, 94)), (140, 56))

    # 3) Auvent rayé (y=94..148) : période exacte 24 px (x=64..88 répétée 2 fois -> 0 rupture de rayure !)
    out.paste(src.crop((0, 94, 112, 148)), (0, 94))
    out.paste(src.crop((64, 94, 88, 148)), (112, 94))
    out.paste(src.crop((64, 94, 88, 148)), (136, 94))
    out.paste(src.crop((112, 94, w, 148)), (160, 94))

    # 4) Rez-de-chaussée (y=148..196) : vitrines à gauche (0..86) + porte bois à x=112 + vitrines/fleurs en miroir à droite
    out.paste(src.crop((0, 148, 86, h)), (0, 148))
    out.paste(src.crop((110, 148, 150, h)), (86, 148))      # pilier + porte bois (centre porte = 86 + 26 = 112 exact !)
    out.paste(src.crop((110, 148, 120, h)), (126, 148))     # pilier droit symétrique de la porte
    out.paste(src.crop((0, 148, 62, h)).transpose(Image.FLIP_LEFT_RIGHT), (136, 148))  # 2 vitrines + pot de fleurs miroir

    # Reteint l'auvent bleu Boutique Pokémon en bordeaux/rose chic « Boutique de mode » (ombrage Gen 5 intact)
    a = np.array(out)
    r, g, b, al = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float), a[..., 3]
    yy = np.arange(h)[:, None]
    m = (al > 0) & (yy >= 92) & (yy <= 160) & (b > r + 24) & (b > g + 8)
    a[m, 0] = np.clip(b[m] * 0.96 + 18, 0, 255).astype('uint8')
    a[m, 1] = np.clip(g[m] * 0.42 + 12, 0, 255).astype('uint8')
    a[m, 2] = np.clip(b[m] * 0.56 + 18, 0, 255).astype('uint8')
    return Image.fromarray(a, 'RGBA'), 112


def _fix_b_maison_forge_p1(b_maison_a_g):
    """Maison 4 cases pour Forge-Acier 100 % issue du vrai b_maison_a_g de kit_bw_set (toit ardoise + murs brique)."""
    a = np.array(b_maison_a_g.convert('RGBA')).copy()
    h, w = a.shape[:2]
    yy = np.arange(h)[:, None]
    r, g, b, al = a[..., 0].astype(float), a[..., 1].astype(float), a[..., 2].astype(float), a[..., 3]
    # Toit orange -> ardoise industrielle bleu-gris foncé (style Forge-Acier)
    toit = (al > 0) & (yy < 108) & (r > b + 24) & (g >= b + 2)
    lum = (r[toit] * 0.45 + g[toit] * 0.45 + b[toit] * 0.10) / 180.0
    a[toit, 0] = np.clip(lum * 86, 28, 138).astype('uint8')
    a[toit, 1] = np.clip(lum * 94, 30, 148).astype('uint8')
    a[toit, 2] = np.clip(lum * 110, 36, 168).astype('uint8')
    # Mur crème bas -> brique chaude ocre-terre
    mur = (al > 0) & (yy >= 100) & (r > 170) & (g > 155) & (b > 110) & (np.abs(r - g) < 42)
    a[mur, 0] = np.clip(r[mur] * 0.86, 0, 255).astype('uint8')
    a[mur, 1] = np.clip(g[mur] * 0.62, 0, 255).astype('uint8')
    a[mur, 2] = np.clip(b[mur] * 0.50, 0, 255).astype('uint8')
    return Image.fromarray(a, 'RGBA'), 48


def _trim_tall_clean(path, cut_y0, cut_y1, max_y=None):
    im = _strip_soft_shadow(Image.open(path), thr=180)
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


def _fix_b_tour_vitre_lobby(im, x0=72, x1=143):
    """Ajoute un hall vitré discret dans la fente noire au rez-de-chaussée de b_tour_vitre (100 % cohérent Gen 5)."""
    im = im.convert('RGBA').copy()
    h = im.height
    dr = ImageDraw.Draw(im)
    y0, y1 = h - 25, h - 1
    dr.rectangle([x0, y0, x1, y1], fill=(40, 52, 68, 255))
    dr.rectangle([x0 + 2, y0 + 1, x1 - 2, y1 - 2], fill=(74, 134, 184, 255), outline=(146, 158, 174, 255))
    span = x1 - x0 - 4
    n_panes = max(4, round(span / 18))
    step = span / n_panes
    for i in range(1, n_panes):
        mx = int(round(x0 + 2 + i * step))
        dr.rectangle([mx - 1, y0 + 1, mx, y1 - 2], fill=(44, 54, 70, 255))
    for i in range(n_panes):
        bx = int(round(x0 + 6 + i * step))
        for k in range(0, 10, 2):
            if bx + k + 1 < x1 - 3:
                dr.rectangle([bx + k, y0 + 3 + k, bx + k + 1, y0 + 4 + k], fill=(168, 222, 248, 255))
    dr.rectangle([x0, y1 - 3, x1, y1], fill=(180, 186, 196, 255), outline=(56, 62, 74, 255))
    return im


def _widen_tour_vitre(tv_raw):
    """Élargit le vrai b_tour_vitre Gen 5 (224 -> 300 px = 9,38 cases) sans aucune couture (2 travées exactes de 38 px)."""
    w, h = tv_raw.size  # 224 x 268
    W = w + 76  # 300 px
    out = Image.new('RGBA', (W, h), (0, 0, 0, 0))
    # 1) Toit arqué (y=0..48) : élargit uniquement la verrière plate centrale (x=98..117, 19 px × 4 = 76 px) -> arche 100 % lisse
    out.paste(tv_raw.crop((0, 0, 108, 48)), (0, 0))
    skylight = tv_raw.crop((98, 0, 117, 48))  # 19 px plats
    for k in range(4):
        out.paste(skylight, (108 + k * 19, 0))
    out.paste(tv_raw.crop((108, 0, w, 48)), (184, 0))

    # 2) Façade + 5 travées de fenêtres (y=48..214) : période exacte 38 px (x=89..127 répétée 2 fois -> 0 couture !)
    out.paste(tv_raw.crop((0, 48, 127, 214)), (0, 48))
    bay = tv_raw.crop((89, 48, 127, 214))  # 38 px
    out.paste(bay, (127, 48))
    out.paste(bay, (165, 48))
    out.paste(tv_raw.crop((127, 48, w, 214)), (203, 48))

    # 3) Auvent rouge + bas (y=214..h) : prolonge la zone rouge unie entre les 2 appliques orange (x=100..119 = 19 px × 4)
    out.paste(tv_raw.crop((0, 214, 110, h)), (0, 214))
    canopy = tv_raw.crop((100, 214, 119, h))  # 19 px rouges propres sans applique coupée
    for k in range(4):
        out.paste(canopy, (110 + k * 19, 214))
    out.paste(tv_raw.crop((110, 214, w, h)), (186, 214))

    # 4) Hall vitré propre centré sur toute l'entrée élargie (x=72..219 -> 8 travées vitrées nettes)
    out = _fix_b_tour_vitre_lobby(out, x0=72, x1=219)
    return out, None


def _snow_boutique_generous(im, awning_y_range=None):
    """Pose d'épaisses congères bleu-glace B2W2 sur tout le haut du toit + la corniche médiane + l'auvent."""
    im = im.convert('RGBA').copy()
    px = im.load()
    w, h = im.size
    top_ys = [next((y for y in range(h) if px[x, y][3] > 200), None) for x in range(w)]
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
    for x in range(4, w - 4):
        for y in range(52, min(h - 40, 88)):
            r, g, b, a = px[x, y]
            if a > 200 and r > 185 and g > 180 and b > 170:
                wave2 = 4 + ((x * 5) % 3)
                for dy in range(wave2):
                    if y + dy < h and px[x, y + dy][3] > 200:
                        px[x, y + dy] = (244, 250, 255, 255) if dy < 2 else ((210, 228, 246, 255) if dy < wave2 - 1 else (154, 182, 216, 255))
                break
    if awning_y_range:
        y0, y1, x0, x1 = awning_y_range
        for x in range(x0, min(w - 2, x1)):
            wave3 = 5 + ((x * 3) % 3)
            for dy in range(wave3):
                y = y0 + dy
                if y < y1 and px[x, y][3] > 200:
                    px[x, y] = (242, 248, 255, 255) if dy < 2 else ((206, 226, 246, 255) if dy < wave3 - 1 else (152, 180, 214, 255))
    return im


def _make_d_squelette(root):
    """Squelette de dragon préhistorique sur socle de musée (128×62 px = 4 cases exactes)."""
    src_path = os.path.join(root, 'odyssee', 'img', 'deco', 'squelette.png')
    if not os.path.exists(src_path):
        return None
    im = Image.open(src_path).convert('RGBA')
    a = np.array(im)
    r, g, b, al = a[..., 0].astype(int), a[..., 1].astype(int), a[..., 2].astype(int), a[..., 3]
    a[al < 140] = 0
    al = a[..., 3]
    a[al >= 140, 3] = 255
    purp = (al >= 140) & (r > g + 16) & (b > g + 12)
    a[purp, :3] = np.clip(np.stack([r[purp] * 0.55, g[purp] * 0.62, b[purp] * 0.45], axis=-1), 28, 72).astype('uint8')
    os_px = (al >= 140) & (r > 130) & (g > 115) & (b > 75) & (np.arange(a.shape[0])[:, None] < 22)
    a[os_px, 0] = np.clip(a[os_px, 0] * 1.08 + 10, 0, 248).astype('uint8')
    a[os_px, 1] = np.clip(a[os_px, 1] * 1.07 + 8, 0, 242).astype('uint8')
    a[os_px, 2] = np.clip(a[os_px, 2] * 1.04 + 6, 0, 218).astype('uint8')
    return Image.fromarray(a, 'RGBA').resize((im.width * 2, im.height * 2), Image.NEAREST)


def _strip_checker_crop(im, box, strip_dark_bg=False):
    """Détoure proprement un sprite de centre_bw_ultimo.png par flood-fill bord sur damier violet (111,49,152) / blanc."""
    sub = im.crop(box).convert('RGBA')
    a = np.array(sub)
    h, w = a.shape[:2]
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    is_bg = ((r == 111) & (g == 49) & (b == 152)) | ((r == 255) & (g == 255) & (b == 255))
    if strip_dark_bg:
        is_bg |= (r < 12) & (g < 12) & (b < 12)
    vis = np.zeros((h, w), dtype=bool)
    q = []
    for x in range(w):
        for y in (0, h - 1):
            if is_bg[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if is_bg[y, x] and not vis[y, x]:
                vis[y, x] = True
                q.append((y, x))
    for cy, cx in q:
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not vis[ny, nx] and is_bg[ny, nx]:
                vis[ny, nx] = True
                q.append((ny, nx))
    a[vis] = 0
    a[(a[..., 0] == 111) & (a[..., 1] == 49) & (a[..., 2] == 152)] = 0
    ys, xs = np.where(a[..., 3] > 0)
    if len(ys):
        a = a[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(a, 'RGBA')


def _extraire_centre_gen5(src_dir, out_dir, decos, extra_sol):
    """Intérieur 100 % authentique 5G (Pokémon Noir & Blanc) depuis centre_bw_ultimo.png (UltimoSpriter) et centre_bw_ditto.png (ditto209)."""
    u_path = os.path.join(src_dir, 'centre_bw_ultimo.png')
    d_path = os.path.join(src_dir, 'centre_bw_ditto.png')
    if not (os.path.exists(u_path) and os.path.exists(d_path)):
        return
    u = Image.open(u_path).convert('RGBA')
    d = Image.open(d_path).convert('RGBA')

    # 1) Sol parquet doré-abricot 5G (16×16 sans couture issu du motif 2×2 parquet Unys)
    extra_sol['floor_pink'] = d.crop((0, 0, 64, 64)).resize((16, 16), Image.NEAREST)

    # 2) Dalles lounge gris-clair à losanges 5G (miroir bas-droite propre pour zéro angle orange)
    lg = d.crop((32, 192, 64, 224)).convert('RGBA')
    lga = np.array(lg)
    # Remplace le petit coin haut-gauche orange (0..10, 0..10) par le miroir symétrique bas-droite
    lga[:12, :12] = lga[31:19:-1, 31:19:-1]
    extra_sol['x_clounge'] = Image.fromarray(lga, 'RGBA').resize((16, 16), Image.NEAREST)

    # 3) Comptoir Centre Pokémon 5G : dessus rouge-corail lisse (sans jointure verticale) + façade blanc-argenté métallique
    extra_sol['x_ccounter'] = u.crop((106, 228, 118, 237)).resize((16, 16), Image.NEAREST)
    extra_sol['x_ccounterfront'] = u.crop((106, 237, 118, 249)).resize((16, 16), Image.NEAREST)

    # 4) Mur du fond du Centre Pokémon 5G : blanc-argenté moderne + bande horizontale jaune-or + plinthe ardoise
    murh = u.crop((46, 30, 62, 46))  # chaperon ardoise sombre + haut blanc-argenté
    murb = Image.new('RGBA', (16, 16))
    murb.paste(u.crop((46, 46, 62, 59)), (0, 0))  # panneau argenté + bande jaune-or 5G
    # Plinthe gris-ardoise en bas (3 px, assortie aux murs de ref_centre_nb_official)
    dr_m = ImageDraw.Draw(murb)
    dr_m.rectangle([0, 13, 15, 13], fill=(116, 124, 142, 255))
    dr_m.rectangle([0, 14, 15, 15], fill=(64, 70, 86, 255))
    extra_sol['x_murh_center'] = murh
    extra_sol['x_murb_center'] = murb

    # 5) Allée centrale abricot + grand emblème Poké Ball 5G au sol (48×88 transparent RGBA)
    rr = np.array(d.crop((96, 0, 192, 176)).convert('RGBA'))
    rr[(rr[..., 3] > 0) & (rr[..., 0] < 20) & (rr[..., 1] < 20) & (rr[..., 2] < 20)] = 0
    runner = Image.fromarray(rr, 'RGBA').resize((48, 88), Image.NEAREST)
    runner.save(os.path.join(out_dir, 'd_center_runner.png'))
    decos['center_runner'] = runner

    # 6) Mobilier 100 % 5G (ombrage doux DS depuis centre_bw_ultimo.png) :
    # Machine de soin octogonale blanche/argentée avec moniteur (2 cases de large)
    healer = _strip_checker_crop(u, (130, 252, 178, 314))
    healer = healer.resize((60, round(60 * healer.height / healer.width)), Image.NEAREST)
    healer.save(os.path.join(out_dir, 'd_healer.png'))
    decos['healer'] = healer

    # PC Unys blanc/bleu-nuit à écran cyan et voyants roses/bleus
    pc = _strip_checker_crop(u, (140, 322, 166, 366))
    pc = pc.resize((34, round(34 * pc.height / pc.width)), Image.NEAREST)
    pc.save(os.path.join(out_dir, 'd_pc.png'))
    decos['pc'] = pc

    # Palmier tropical en pot crème du Centre Pokémon 5G (sans débord rouge à gauche)
    plant = _strip_checker_crop(u, (51, 316, 68, 352))
    plant = plant.resize((30, round(30 * plant.height / plant.width)), Image.NEAREST)
    plant.save(os.path.join(out_dir, 'd_plant.png'))
    decos['plant'] = plant

    # Coin salon 5G : table ovale blanche + 4 fauteuils rouges Unys (emprise 2 cases de d_bench)
    bench = _strip_checker_crop(u, (4, 318, 51, 356), strip_dark_bg=True)
    bench = bench.resize((72, round(72 * bench.height / bench.width)), Image.NEAREST)
    bench.save(os.path.join(out_dir, 'd_bench.png'))
    decos['bench'] = bench

    # Présentoir à brochures blanc coloré 5G (d_vase dans le coin droit du Centre)
    rack = _strip_checker_crop(u, (6, 362, 34, 402), strip_dark_bg=True)
    rack = rack.resize((36, round(36 * rack.height / rack.width)), Image.NEAREST)
    rack.save(os.path.join(out_dir, 'd_vase.png'))
    decos['vase'] = rack


def appliquer_critiques(root, out_dir, cols, noms, decos, bat_imgs, bat_dims):
    """Applique UNIQUEMENT les correctifs chirurgicaux 100 % authentiques Gen 5."""
    src_dir = os.path.join(root, 'assets', 'graphics', 'noirblanc')

    # 1. Décors authentiques : d_caisse & d_caisses tirés du vrai d_boxes.png Gen 5 + d_squelette 4 cases + nettoyage alpha d_lamp
    boxes_p = os.path.join(out_dir, 'd_boxes.png')
    if os.path.exists(boxes_p):
        bx = Image.open(boxes_p).convert('RGBA')  # 30x28 authentique Gen 5
        # Caisse simple : le carton bas-droite 100 % isolé (14,13..28,26 = 14x13) élargi en intérieur -> 20x18 (bord 1 px intact !)
        raw_box = bx.crop((14, 13, 28, 26))  # 14 x 13
        single = Image.new('RGBA', (20, 18), (0, 0, 0, 0))
        # Largeur 14 -> 20 (+6 px de corps central x=4..10)
        mid_w = Image.new('RGBA', (20, 13), (0, 0, 0, 0))
        mid_w.paste(raw_box.crop((0, 0, 7, 13)), (0, 0))
        mid_w.paste(raw_box.crop((4, 0, 10, 13)), (7, 0))
        mid_w.paste(raw_box.crop((7, 0, 14, 13)), (13, 0))
        # Hauteur 13 -> 18 (+5 px de face avant unie y=7..12)
        single.paste(mid_w.crop((0, 0, 20, 8)), (0, 0))
        single.paste(mid_w.crop((0, 6, 20, 11)), (0, 8))
        single.paste(mid_w.crop((0, 8, 20, 13)), (0, 13))
        single.save(os.path.join(out_dir, 'd_caisse.png'))
        decos['caisse'] = single
        # Pile de caisses : vrai d_boxes.png empilé sur lui-même (34x44 authentique Gen 5, plus de porte en bois !)
        stack = Image.new('RGBA', (34, 44), (0, 0, 0, 0))
        stack.alpha_composite(bx, (2, 16))
        stack.alpha_composite(bx.transpose(Image.FLIP_LEFT_RIGHT), (0, 0))
        stack.save(os.path.join(out_dir, 'd_caisses.png'))
        decos['caisses'] = stack

    d_sq = _make_d_squelette(root)
    if d_sq is not None:
        d_sq.save(os.path.join(out_dir, 'd_squelette.png'))
        decos['squelette'] = d_sq

    lamp_p = os.path.join(out_dir, 'd_lamp.png')
    if os.path.exists(lamp_p):
        lp = _strip_soft_shadow(Image.open(lamp_p), thr=140)
        lp.save(lamp_p)
        decos['lamp'] = lp

    # 2. Tuiles officielles 5G dans sol.png : x_shelf (rayonnage Poké Mart) + intérieur Centre Pokémon 5G authentique
    sol_path = os.path.join(out_dir, 'sol.png')
    sol = Image.open(sol_path).convert('RGBA')
    idx_of = {n: i for i, n in enumerate(noms)}
    centre_int = Image.open(os.path.join(src_dir, 'centre_interieur.png')).convert('RGBA')
    extra_sol = {
        'x_shelf': centre_int.crop((130, 1020, 190, 1080)).resize((16, 16), Image.NEAREST),
    }
    _extraire_centre_gen5(src_dir, out_dir, decos, extra_sol)
    for k in sorted(extra_sol):
        if k not in idx_of:
            idx_of[k] = len(noms)
            noms.append(k)
    need_rows = math.ceil(len(noms) / cols)
    new_sol = Image.new('RGBA', (cols * 16, need_rows * 16), (0, 0, 0, 0))
    new_sol.paste(sol, (0, 0))
    for k, tile in extra_sol.items():
        i = idx_of[k]
        new_sol.paste(tile, ((i % cols) * 16, (i // cols) * 16))
    new_sol.save(sol_path)

    # 3. Portes bouchées chirurgicalement DERRIÈRE les vrais sprites Gen 5 (99 % du sprite officiel intact !)
    centrale_p = os.path.join(out_dir, 'b_centrale.png')
    if os.path.exists(centrale_p):
        im = _trim_bottom(_strip_soft_shadow(Image.open(centrale_p), 160))
        im = _patch_arch_door_behind(im, 40, 146, 90, im.height - 1, tint='cyan_glass')
        im.save(centrale_p)
        bat_dims['centrale'] = [im.width, 64]

    mairie_p = os.path.join(out_dir, 'b_mairie.png')
    fixed_mairie = None
    if os.path.exists(mairie_p):
        fixed_mairie, mp = _fix_b_mairie(Image.open(mairie_p))
        fixed_mairie.save(mairie_p)
        bat_dims['mairie'] = [fixed_mairie.width, mp]

    bourse_p = os.path.join(out_dir, 'b_bourse.png')
    if os.path.exists(bourse_p) and fixed_mairie is not None:
        bi, bp = _fix_b_bourse(Image.open(bourse_p), fixed_mairie)
        bi.save(bourse_p)
        bat_dims['bourse'] = [bi.width, bp]

    serre_p = os.path.join(out_dir, 'b_serre.png')
    if os.path.exists(serre_p):
        im = _trim_bottom(_strip_soft_shadow(Image.open(serre_p), 160))
        im = _patch_arch_door_behind(im, 50, 162, 104, im.height - 1, tint='cyan_glass')
        im.save(serre_p)
        bat_dims['serre'] = [im.width, 77]

    fonderie_p = os.path.join(out_dir, 'b_fonderie.png')
    if os.path.exists(fonderie_p):
        fi, fp = _fix_b_fonderie(Image.open(fonderie_p))
        fi.save(fonderie_p)
        bat_dims['fonderie'] = [fi.width, fp]

    gare_p = os.path.join(out_dir, 'b_gare.png')
    if os.path.exists(gare_p):
        gi, gp = _fix_b_gare(Image.open(gare_p))
        gi.save(gare_p)
        bat_dims['gare'] = [gi.width, gp]

    # Nettoyage des franges semi-transparentes + recadrage bas (évite b_maison_desert_4 qui flottait de 12 px !) + porte b_maison_desert_1
    for i in range(1, 5):
        dp = os.path.join(out_dir, f'b_maison_desert_{i}.png')
        if os.path.exists(dp):
            im = _trim_bottom(_strip_soft_shadow(Image.open(dp), 160))
            if i == 1:
                im = _patch_arch_door_behind(im, 50, im.height - 38, 102, im.height - 1, tint='dark_wood')
            im.save(dp)

    # 4. Raccourcissement sans couture des tours Gen 5 (supprime le voile damier sur la rue + ombres alpha=64)
    tv_p = os.path.join(out_dir, 'b_tour_vitre.png')
    if os.path.exists(tv_p):
        tv_raw = _trim_tall_clean(tv_p, 214, 298, max_y=352)
        tv = _fix_b_tour_vitre_lobby(tv_raw)
        tv.save(tv_p)
        bat_dims['tour_vitre'] = [tv.width, None]
        # Version élargie 9 cases (300×268) 100 % issue du vrai b_tour_vitre Gen 5 (5 travées nettes, toit continu) !
        tvl, tvlp = _widen_tour_vitre(tv_raw)
        tvl.save(os.path.join(out_dir, 'b_tour_vitre_l.png'))
        bat_dims['tour_vitre_l'] = [tvl.width, tvlp]

    tj_p = os.path.join(out_dir, 'b_tour_jaune.png')
    if os.path.exists(tj_p):
        tj = _trim_tall_clean(tj_p, 188, 234, max_y=294)
        bat_dims['tour_jaune'] = [tj.width, None]

    for fn in ('maison_forge_1', 'maison_forge_2'):
        fp = os.path.join(out_dir, f'b_{fn}.png')
        if os.path.exists(fp):
            mf = _trim_tall_clean(fp, 40, 84, max_y=310)
            bat_dims[fn] = [mf.width, 88]

    # 5. Variantes 100 % issues du vrai kit_bw_set (Boutique de mode & maison 4 cases Forge-Acier)
    if 'boutique' in bat_imgs:
        bm, bmp = _fix_b_boutique_mode(bat_imgs['boutique'])
        bm.save(os.path.join(out_dir, 'b_boutique_mode.png'))
        bat_dims['boutique_mode'] = [bm.width, bmp]

    if 'maison_a_g' in bat_imgs:
        fp1, fp1p = _fix_b_maison_forge_p1(bat_imgs['maison_a_g'])
        fp1.save(os.path.join(out_dir, 'b_maison_forge_p1.png'))
        bat_dims['maison_forge_p1'] = [fp1.width, fp1p]

    # 6. Neige hivernale B2W2 généreuse sur les boutiques enneigées
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
