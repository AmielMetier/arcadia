# -*- coding: utf-8 -*-
"""Arbres et décors des biomes des routes d'Odyssée (world/biomes.js) : python3 tools/odyssee-biomes.py

Tout est dessiné par ce script (32 pixels par case), ou reteint à partir des arbres du jeu (odyssee/img/nature). Écrit
odyssee/img/biomes/planche.png et odyssee/js/data/biomes-sprites.js (rectangles de la planche, ne pas modifier à la main).
"""
import json, math, os, random
from PIL import Image

RACINE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'odyssee')
NAT = os.path.join(RACINE, 'img', 'nature')


def rgb(h):
    return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))


def ramp(stops, n):
    c = [rgb(h) for h in stops]
    out = []
    for i in range(n):
        f = i / (n - 1) * (len(c) - 1)
        k = min(len(c) - 2, int(f))
        t = f - k
        out.append(tuple(round(c[k][j] + (c[k + 1][j] - c[k][j]) * t) for j in range(3)))
    return out


class S:
    """une image en cours de dessin"""
    def __init__(self, w, h, graine=1):
        self.w, self.h, self.p, self.r = w, h, {}, random.Random(graine)

    def put(self, x, y, c, dessous=False):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h and not (dessous and (x, y) in self.p):
            self.p[(x, y)] = c if len(c) == 4 else c + (255,)

    def get(self, x, y):
        return self.p.get((x, y))

    def ell(self, cx, cy, rx, ry, R, grain=0.0, bas=1.0):
        """une boule éclairée d'en haut à gauche, dans les teintes R"""
        n = len(R) - 1
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / ry
                if u * u + v * v > 1:
                    continue
                l = .62 - .42 * v * bas - .22 * u - .25 * (u * u + v * v) + self.r.uniform(-grain, grain)
                self.put(x, y, R[max(0, min(n, int(l * n + .5)))])

    def poly(self, pts, c):
        ys = [p[1] for p in pts]
        for y in range(int(min(ys)), int(max(ys)) + 1):
            xs = []
            for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]):
                if (y0 <= y + .5) != (y1 <= y + .5):
                    xs.append(x0 + (y + .5 - y0) / (y1 - y0) * (x1 - x0))
            xs.sort()
            for a, b in zip(xs[::2], xs[1::2]):
                for x in range(round(a), round(b)):
                    self.put(x, y, c(x, y) if callable(c) else c)

    def ligne(self, x0, y0, x1, y1, c, ep=1):
        n = int(max(abs(x1 - x0), abs(y1 - y0), 1))
        for i in range(n + 1):
            x, y = x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n
            for k in range(ep):
                self.put(round(x) + k - ep // 2, round(y), c)

    def tronc(self, x0, y0, x1, y1, l0, l1, R):
        """un fût de (x0, y0) en haut à (x1, y1) en bas, largeurs l0 → l1"""
        n = int(y1 - y0)
        for i in range(n + 1):
            t = i / max(1, n)
            cx, l = x0 + (x1 - x0) * t, l0 + (l1 - l0) * t
            a, b = round(cx - l / 2), round(cx + l / 2)
            for x in range(a, b + 1):
                u = (x - a) / max(1, b - a)
                k = 1 - abs(u - .34) * 1.5
                if (i * 7 + x * 3) % 11 == 0:
                    k -= .3
                self.put(x, y0 + i, R[max(0, min(len(R) - 1, int(k * (len(R) - 1) + .5)))])

    def feuillage(self, cx, cy, rx, ry, R, pas=4, larg=5, haut=5):
        """un étage de feuilles retombantes, comme les arbres du jeu : rangées de touffes, claires en haut, sombres en bas"""
        n = len(R) - 1
        # le fond sombre
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if ((x + .5 - cx) / rx) ** 2 + ((y + .5 - cy) / ry) ** 2 <= .9:
                    self.put(x, y, R[1])
        y = cy - ry
        rang = 0
        while y < cy + ry:
            v = (y - cy) / ry
            demi = rx * math.sqrt(max(0, 1 - v * v))
            x = cx - demi + (rang % 2) * pas / 2
            while x <= cx + demi:
                u = (x - cx) / rx
                l = .80 - .52 * (v + 1) / 2 * 1.15 - .16 * u + self.r.uniform(-.09, .09)
                k = l * n
                # une touffe : pointe en bas
                for j in range(haut):
                    d = larg * (1 - j / haut) / 2
                    for i in range(int(-d), int(d) + 1):
                        s = k + (1 if j == 0 else 0) - (1.2 if j >= haut - 2 else 0) - (.5 if i > 0 else 0)
                        self.put(round(x) + i, round(y) + j, R[max(0, min(n, int(s + .5)))])
                x += pas
            y += haut - 2
            rang += 1

    def contour(self, c, bas=True):
        pts = set(self.p)
        for (x, y) in pts:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if not bas and dy == 1:
                    continue
                if (x + dx, y + dy) not in pts:
                    self.put(x + dx, y + dy, c)

    def image(self):
        im = Image.new('RGBA', (self.w, self.h), (0, 0, 0, 0))
        for (x, y), c in self.p.items():
            im.putpixel((x, y), c)
        return im.crop(im.getbbox())


BOIS = ramp(['#2a1a12', '#6a4428', '#b07c48'], 5)
BOIS_GRIS = ramp(['#24201e', '#5c524a', '#a0948a'], 5)
BLANC = ramp(['#5c5c5c', '#c8c4b8', '#fbf8ee'], 5)
PIERRE = ramp(['#2c2c34', '#70707c', '#b4b4be', '#e0e0e4'], 6)
OUT = {}


def garde(k, s, c='#141a16', bas=True):
    if isinstance(s, S):
        if c:
            s.contour(rgb(c), bas)
        s = s.image()
    OUT[k] = s


def nature(k):
    return Image.open(os.path.join(NAT, k + '.png')).convert('RGBA')


def reteint(src, stops, tronc=None, sombre=None):
    """le feuillage d'un arbre du jeu dans d'autres teintes (selon sa lumière) ; tronc : teintes du bois"""
    im = nature(src) if isinstance(src, str) else src.copy()
    R = ramp(stops, 64)
    L = [(0.3 * r + 0.59 * g + 0.11 * b) for r, g, b, a in im.getdata() if a > 127]
    lo, hi = min(L), max(L)
    T = ramp(tronc, 64) if tronc else None
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a < 128:
                continue
            l = (0.3 * r + 0.59 * g + 0.11 * b - lo) / (hi - lo)
            bois = r > g + 12 and y > im.height * .72
            if bois and not T:
                continue
            im.putpixel((x, y), (T if bois else R)[max(0, min(63, int(l * 63)))] + (255,))
    return im


def fruits(im, c, n, graine, t=2):
    r = random.Random(graine)
    im = im.copy()
    k = 0
    while k < n:
        x, y = r.randrange(5, im.width - 5), r.randrange(6, int(im.height * .78))
        if im.getpixel((x, y))[3] < 128:
            continue
        for dx in range(t):
            for dy in range(t):
                im.putpixel((x + dx, y + dy), rgb(c[0] if (dx, dy) == (0, 0) else c[1]) + (255,))
        im.putpixel((x + t - 1, y + t), rgb(c[2]) + (255,))
        k += 1
    return im


def retaille(im, w, h):
    """autre taille, sans flou ; le contour reste d'un pixel"""
    return im.resize((w, h), Image.NEAREST)


def pencher(im, d):
    """penché par le vent : le haut décalé de d pixels"""
    out = Image.new('RGBA', (im.width + abs(d), im.height), (0, 0, 0, 0))
    for y in range(im.height):
        s = round(d * (1 - y / im.height) ** 1.3)
        out.paste(im.crop((0, y, im.width, y + 1)), (s + (abs(d) if d < 0 else 0), y))
    return out.crop(out.getbbox())


# ---------------------------------------------------------------- arbres reteints
garde('b_pommier', fruits(nature('tree'), ('#ff6a5a', '#d82c30', '#7a1018'), 11, 3))
garde('b_oranger', fruits(reteint('tree', ['#0e2c1c', '#2c7a3c', '#8cd058']), ('#ffd078', '#f89a20', '#a85410'), 12, 5))
garde('b_olivier', retaille(reteint('tree', ['#2c3428', '#748460', '#c8d0a0']), 41, 42))
garde('b_peuplier', retaille(reteint('tree', ['#1c3416', '#5c9434', '#c0e060']), 27, 70))
garde('b_peuplier_or', retaille(reteint('tree', ['#4a2408', '#d08c1c', '#ffe878']), 27, 70))
garde('b_cypres', retaille(reteint('tree', ['#0a1e18', '#1e5038', '#5c9a5c']), 22, 74))
garde('b_meleze', reteint('pine', ['#3a2a10', '#a88a30', '#f0dc74']))
garde('b_cerisier_blanc', reteint('tree', ['#7a5468', '#ecc0d0', '#fffafa']))
garde('b_opale', reteint('tree', ['#3c2c6c', '#c084d8', '#fff0fc'], ['#34304c', '#7c74a0', '#d8d0f0']))
garde('b_opale2', reteint('pine', ['#1c3c6c', '#5cc0d0', '#f0fffc'], ['#34304c', '#7c74a0', '#d8d0f0']))
garde('b_or', reteint('tree', ['#6a3c0c', '#e0ac34', '#fffcc8'], ['#54586c', '#a8acc0', '#f4f6ff']))
garde('b_hante', reteint('tree2', ['#0c0a1c', '#322a54', '#7c6cac'], ['#18141c', '#443c48', '#7c747c']))
garde('b_mort', reteint('deadtree', ['#100c1a', '#4a4058', '#948ca8'], ['#100c1a', '#4a4058', '#948ca8']))
garde('b_braise', reteint('deadtree', ['#0c0808', '#2c2220', '#584844'], ['#0c0808', '#2c2220', '#584844']))
garde('b_foudroye', reteint('deadtree', ['#100e16', '#383444', '#746c84'], ['#100e16', '#383444', '#746c84']))
garde('b_givre', reteint('deadtree', ['#3c5c84', '#9cc4e4', '#ffffff'], ['#3c5c84', '#9cc4e4', '#ffffff']))
garde('b_pin_tordu', pencher(reteint('pine', ['#141c1c', '#38544c', '#8ca088'], ['#1c1814', '#4c4038', '#8c7c6c']), 13))


def braises(k, c):
    """des fentes rougeoyantes (ou électriques) dans le bois mort"""
    im = OUT[k].copy()
    r = random.Random(9)
    for x in range(1, im.width - 1):
        for y in range(1, im.height - 1):
            if all(im.getpixel((x + a, y + b))[3] > 127 for a, b in ((1, 0), (-1, 0))) and r.random() < .16:
                im.putpixel((x, y), rgb(r.choice(c)) + (255,))
    OUT[k] = im


braises('b_braise', ['#ff7a20', '#ffc040', '#d8380c'])
braises('b_foudroye', ['#ffe84c', '#8cc8ff', '#fff8c0'])


def grand(stops, graine, w=78, h=92, bois=BOIS, lianes=None):
    """un arbre immense : fût à contreforts, trois étages de feuillage"""
    s = S(w + 8, h + 8, graine)
    cx = (w + 8) / 2
    R = ramp(stops, 8)
    s.tronc(cx, h * .45, cx, h + 2, w * .16, w * .2, bois)
    for d in (-1, 1):
        for i in range(12):
            for k in range(3):
                s.put(cx + d * (w * .1 + i * .55) + k * d, h - 8 + i - k // 2, bois[1 if d > 0 else 2])
    s.feuillage(cx, h * .44, w * .48, h * .25, R, 5, 6, 6)
    s.feuillage(cx - 2, h * .31, w * .40, h * .2, R, 5, 6, 6)
    s.feuillage(cx + 1, h * .19, w * .28, h * .15, R, 5, 6, 6)
    if lianes:
        L = ramp(lianes, 4)
        for i in range(7):
            x = cx + s.r.uniform(-.42, .42) * w
            y0 = h * (.52 + .12 * (1 - abs(x - cx) / (w * .45)))
            for j in range(s.r.randrange(8, 22)):
                s.put(x + round(math.sin(j * .5 + i)), y0 + j, L[1 + (j % 3 == 0) + (j % 5 == 0)])
    return s


garde('b_geant', grand(['#06181c', '#12444c', '#2c8478', '#8ce0c0'], 4, bois=ramp(['#14121c', '#3c3440', '#7c7078'], 5)))
garde('b_fromager', grand(['#06240e', '#14622c', '#34a040', '#b0ec70'], 7, 74, 90, lianes=['#0c3818', '#2c7c30', '#8cd058']))


def parasol(stops, graine, w, h, bois, plat=.16, tordu=0):
    """un tronc nu et une ombrelle de feuillage (acacia, pin parasol)"""
    s = S(w + 8, h + 8, graine)
    cx = (w + 8) / 2
    R = ramp(stops, 7)
    s.tronc(cx + tordu, h * .28, cx, h + 2, 4, 6, bois)
    for d in (-1, 1):
        for i in range(int(h * .22)):
            for e in range(2):
                s.put(cx + tordu * .6 + d * i * .85 + e, h * .52 - i, bois[2 if d < 0 else 1])
    s.feuillage(cx + tordu, h * .28, w * .49, h * plat, R, 5, 6, 5)
    s.feuillage(cx + tordu - 2, h * .18, w * .33, h * plat * .72, R, 5, 6, 5)
    return s


garde('b_acacia', parasol(['#22300e', '#5c7824', '#a8b43c', '#e8e078'], 3, 66, 56, BOIS, .14, 3))
garde('b_pin_parasol', parasol(['#0c2a1c', '#1c5c38', '#4c9448', '#a8d078'], 5, 58, 66, ramp(['#3a2018', '#8a5438', '#d09868'], 5), .17))


def baobab():
    s = S(84, 92, 2)
    B = ramp(['#3c2820', '#8c6450', '#d0a888'], 6)
    s.tronc(42, 34, 42, 86, 18, 30, B)
    for a, l in ((-70, 30), (-42, 32), (-12, 26), (16, 27), (46, 32), (72, 29)):
        x, y = 42 + a * .1, 38
        for i in range(l):
            t = i / l
            px, py = x + math.sin(math.radians(a)) * i, y - math.cos(math.radians(a)) * i * .9
            for k in range(max(1, int(6 * (1 - t)))):
                s.put(px + k - 2, py, B[4 - (k > 2) * 2])
    R = ramp(['#22380e', '#5c8424', '#b4cc50'], 6)
    for x, y, w in ((14, 22, 13), (30, 12, 14), (46, 9, 14), (62, 14, 14), (72, 25, 11), (42, 20, 14)):
        s.feuillage(x, y, w, 7, R, 4, 5, 5)
    return s


garde('b_baobab', baobab())


def saule(stops, graine, bois=BOIS):
    s = S(70, 78, graine)
    R = ramp(stops, 8)
    s.tronc(35, 26, 35, 70, 7, 10, bois)
    # les rameaux qui pleurent : du fond vers l'avant
    for couche in range(3):
        for i in range(15):
            u = (i + couche * .33) / 14 * 2 - 1
            x0 = 35 + u * (27 - couche * 4)
            y0 = 26 - math.sqrt(max(0, 1 - u * u)) * (20 - couche * 3) + couche * 3
            L = 24 + s.r.randrange(0, 16) - couche * 6 + abs(u) * 10
            for j in range(int(L)):
                t = j / L
                k = 6.2 - couche * -.4 - t * 4.4 - u * .8
                x = x0 + math.sin(j * .22 + i * 2) * 1.2 + u * t * 4
                for e in range(3 if t < .8 else 2):
                    s.put(x + e, y0 + j, R[max(1, min(7, int(k - (e == 2) * 1.5)))])
    s.feuillage(34, 18, 24, 11, R, 5, 6, 6)
    return s


garde('b_saule', saule(['#12381c', '#3c8434', '#9cd054', '#e0f490'], 3))
garde('b_saule_gris', saule(['#181c14', '#3c4830', '#7c8858', '#b4b888'], 6, BOIS_GRIS))


def bouleau():
    s = S(54, 74, 4)
    s.tronc(27, 18, 27, 68, 4, 5, BLANC)
    for y in range(22, 67, 5):
        x = 25 + s.r.randrange(0, 4)
        s.put(x, y, rgb('#2c2824')); s.put(x + 1, y, rgb('#2c2824'))
    R = ramp(['#1c4418', '#5ca43c', '#b4e064', '#f0fcb0'], 8)
    s.feuillage(27, 36, 17, 11, R, 4, 5, 5); s.feuillage(26, 25, 19, 13, R, 4, 5, 5); s.feuillage(28, 14, 13, 10, R, 4, 5, 5)
    return s


garde('b_bouleau', bouleau())


def bambou(graine):
    s = S(52, 92, graine)
    V = [ramp(['#1c4416', '#5c9c2c', '#b0dc60', '#e8fca0'], 6), ramp(['#16380f', '#3c7c24', '#8cbc48'], 6)]
    F = ramp(['#143c14', '#347c28', '#80c444', '#c8f078'], 6)
    tiges = [(9, 24), (18, 8), (27, 16), (35, 4), (43, 20)]
    for i, (x, y0) in enumerate(tiges):
        R = V[i % 2]
        c = s.r.choice((-2, 0, 2))
        for y in range(y0, 88):
            t = (88 - y) / 84
            xx = x + c * t * t
            nd = (y + i * 5) % 13
            for k in range(4):
                col = R[0] if nd == 0 else R[5 if nd == 1 else (4, 3, 2, 1)[k] if len(R) > 4 else 2]
                s.put(xx + k, y, col)
    for i, (x, y0) in enumerate(tiges):
        for k in range(9):
            y = y0 + k * 4 + s.r.randrange(0, 5) - 3
            d = s.r.choice((-1, 1))
            l = s.r.randrange(7, 13)
            c = F[2 + s.r.randrange(0, 4) - (k > 5)]
            for j in range(l):
                e = 1 if j in (0, l - 1) else 2
                for q in range(e):
                    s.put(x + 2 + d * j, y + j * .55 + q, c if q == 0 else F[1])
    return s


garde('b_bambou', bambou(3))


def champi(graine, ch, pied, w=46, h=56, lueur=True):
    s = S(w + 8, h + 8, graine)
    cx = (w + 8) / 2
    P, C = ramp(pied, 6), ramp(ch, 8)
    s.tronc(cx, h * .4, cx, h + 2, w * .2, w * .28, P)
    # lamelles sous le chapeau
    for x in range(int(cx - w * .4), int(cx + w * .4)):
        for y in range(int(h * .40), int(h * .50)):
            if ((x - cx) / (w * .42)) ** 2 + ((y - h * .40) / (h * .11)) ** 2 < 1:
                s.put(x, y, C[6] if x % 3 == 0 else C[2])
    for y in range(0, int(h * .44)):
        for x in range(int(cx - w / 2), int(cx + w / 2) + 1):
            v = (y - h * .40) / (h * .38)
            u = (x - cx) / (w * .5)
            if u * u + v * v <= 1:
                l = .55 - v * .42 - u * .2 - (u * u) * .3
                s.put(x, y, C[max(0, min(7, int(l * 7)))])
    for i in range(7):
        a, b = s.r.uniform(-.75, .75), s.r.uniform(-.8, -.1)
        if a * a + b * b < .8:
            s.ell(cx + a * w * .46, h * .40 + b * h * .35, 2 + s.r.random() * 2.4, 1.6 + s.r.random() * 1.4, C[5:] + [rgb('#ffffff')])
    return s


garde('b_champi_bleu', champi(5, ['#0c2c5c', '#1c78b8', '#4ce0f8', '#e0ffff'], ['#2c3c54', '#8ca8c0', '#e8fbff']), '#081420')
garde('champi_rouge', champi(8, ['#5c0c14', '#c82c2c', '#f87050', '#ffe0c8'], ['#5c4c40', '#c8b8a0', '#fff8e8'], 34, 40))
garde('champi_violet', champi(11, ['#2c0c4c', '#7c30b8', '#d080ff', '#fce8ff'], ['#3c2c4c', '#8c7ca8', '#e0d0f0'], 30, 38))


def fougere():
    s = S(54, 50, 6)
    R = ramp(['#0c3014', '#207434', '#60b848', '#c0f080'], 7)
    s.tronc(27, 22, 27, 46, 4, 6, BOIS)
    for a in (-80, 80, -58, 58, -34, 34, -10, 12):
        L = 25
        for j in range(L):
            t = j / L
            x = 27 + math.sin(math.radians(a)) * j
            y = 22 - math.cos(math.radians(a)) * j * .8 + t * t * 14 * abs(math.sin(math.radians(a)))
            for q in range(-3, 4):
                if abs(q) <= 3.4 * (1 - t) + .6:
                    s.put(x + q * .3, y + q, R[max(1, min(6, int(5.2 - abs(q) * .8 - t + (q < 0))))])
    return s


garde('b_fougere', fougere())


def cristal(cs, graine, w=40, h=52):
    s = S(w + 6, h + 6, graine)
    R = ramp(cs, 6)
    for x, b, l, hh in ((w * .24, h, 9, h * .5), (w * .78, h, 9, h * .56), (w * .52, h, 14, h * .98), (w * .38, h + 1, 8, h * .36), (w * .66, h + 1, 7, h * .3)):
        x += 3
        top = b - hh
        def c(X, Y, x=x, l=l, top=top):
            u = (X - (x - l / 2)) / l
            k = 5 if u < .18 else 4 if u < .4 else 2 if u < .72 else 1
            if (Y - top) < l * .5 and u < .5:
                k = 5
            return R[k]
        s.poly([(x, top), (x + l / 2, top + l * .6), (x + l / 2, b), (x - l / 2, b), (x - l / 2, top + l * .6)], c)
    return s


garde('b_cristal', cristal(['#2c2c7c', '#7c6cd8', '#b8d0ff', '#ffffff'], 2), '#1c1840')
garde('cristal_rose', cristal(['#5c1c5c', '#d060c0', '#ffc8f4', '#ffffff'], 4, 28, 34), '#2c1030')
garde('cristal_glace', cristal(['#1c4c84', '#60b0e0', '#c8f0ff', '#ffffff'], 6, 34, 46), '#16304c')


def paletuvier():
    s = S(66, 70, 8)
    B = ramp(['#1c1610', '#54402c', '#94785c'], 5)
    for d in (-1, 1):
        for k, e in ((16, 3), (10, 2), (5, 2)):
            for i in range(26):
                t = i / 26
                for q in range(e):
                    s.put(33 + d * (k * math.sin(t * 1.57)) + q, 42 + i, B[2 if d < 0 else 1])
    s.tronc(33, 24, 33, 48, 8, 9, B)
    R = ramp(['#10200c', '#2c4c20', '#608038', '#a8b860'], 7)
    s.feuillage(33, 26, 28, 13, R, 5, 6, 6); s.feuillage(31, 16, 21, 11, R, 5, 6, 6)
    for i in range(10):
        x = 33 + s.r.uniform(-24, 24)
        for j in range(s.r.randrange(6, 16)):
            s.put(x, 34 + j, rgb('#6c7c50') if j % 3 else rgb('#8c9c68'))
    return s


garde('b_paletuvier', paletuvier())


def rosier(fl, graine):
    im = retaille(reteint('bush', ['#0c2c18', '#286c34', '#78c058']), 38, 36)
    r = random.Random(graine)
    n = 0
    while n < 15:
        x, y = r.randrange(4, im.width - 5), r.randrange(3, im.height - 6)
        if im.getpixel((x, y))[3] < 128:
            continue
        for dx, dy, k in ((0, 0, 2), (1, 0, 1), (2, 0, 1), (0, 1, 1), (1, 1, 0), (2, 1, 0), (1, -1, 2), (1, 2, 0)):
            if im.getpixel((x + dx, y + dy))[3] > 127:
                im.putpixel((x + dx, y + dy), rgb(fl[k]) + (255,))
        n += 1
    return im


garde('b_rosier', rosier(['#9c1038', '#f0386c', '#ffc0d0'], 2))
garde('rosier_blanc', rosier(['#c8b8c0', '#fff0f4', '#ffffff'], 5))
garde('hortensia', rosier(['#3c3ca8', '#7c8cf8', '#d8e0ff'], 7))

# ---------------------------------------------------------------- décors posés
def gerbe():
    s = S(40, 34, 3)
    R = ramp(['#6a4010', '#c88c24', '#f8d860', '#fff4b0'], 7)
    s.ell(20, 17, 17, 13, R, .12)
    for k in range(4):
        a = 12 - k * 3
        for i in range(60):
            t = i / 60 * 6.28
            s.put(20 + math.cos(t) * a * 1.25, 17 + math.sin(t) * a * .95, R[2 + k % 2])
    return s


garde('gerbe', gerbe(), '#3c2408')


def tournesol():
    s = S(40, 48, 4)
    V = ramp(['#1c4c1c', '#4c9434', '#a0d060'], 4)
    for x, y, r in ((11, 16, 6), (28, 10, 7), (20, 22, 6)):
        for j in range(44 - y):
            s.put(x, y + j, V[2]); s.put(x + 1, y + j, V[1])
        for d in (-1, 1):
            for i in range(6):
                for q in range(3 - i // 2):
                    s.put(x + d * i, y + 14 + i // 2 + q + (d > 0) * 4, V[3 if q == 0 else 1])
        for i in range(60):
            a = i / 60 * 6.28
            for q in range(r):
                if q > r * .45 or True:
                    s.put(x + math.cos(a) * q, y + math.sin(a) * q * .95, rgb('#ffd838') if (i // 4) % 2 else rgb('#f0a818'))
        s.ell(x + .5, y + .5, r * .5, r * .48, ramp(['#3c1c08', '#6c3c14', '#a0682c'], 4))
    return s


garde('tournesol', tournesol(), '#1c2c10')


def epouvantail():
    s = S(44, 60, 2)
    s.ligne(22, 14, 22, 56, rgb('#6a4428'), 3); s.ligne(4, 24, 40, 24, rgb('#8a5c38'), 1); s.ligne(4, 25, 40, 25, rgb('#6a4428'), 1)
    s.poly([(13, 22), (31, 22), (30, 44), (14, 44)], lambda x, y: rgb('#a83c34') if (x // 4 + y // 4) % 2 else rgb('#c85c48'))
    s.poly([(4, 22), (14, 22), (14, 29), (4, 28)], rgb('#b84c3c')); s.poly([(30, 22), (40, 22), (40, 28), (30, 29)], rgb('#983430'))
    s.ell(22, 14, 7, 7, ramp(['#a07838', '#e0c078', '#fff0b8'], 5))
    s.put(19, 13, rgb('#2c1c10')); s.put(24, 13, rgb('#2c1c10')); s.ligne(19, 17, 25, 17, rgb('#6c3c1c'))
    s.poly([(10, 9), (34, 9), (34, 11), (10, 11)], rgb('#c89030')); s.poly([(15, 9), (18, 2), (26, 2), (29, 9)], rgb('#e0b04c'))
    for x in (3, 5, 38, 41):
        s.ligne(x, 27, x, 31, rgb('#f0d060'))
    return s


garde('epouvantail', epouvantail(), '#241408')


def ruche():
    s = S(30, 36, 2)
    R = ramp(['#7c4c10', '#d89c2c', '#ffe078'], 6)
    s.poly([(4, 28), (26, 28), (26, 31), (4, 31)], rgb('#8a5c38'))
    for x in (6, 22):
        s.ligne(x, 31, x, 34, rgb('#6a4428'), 2)
    s.ell(15, 17, 11, 12, R)
    for y in (8, 13, 18, 23):
        for x in range(4, 27):
            if s.get(x, y):
                s.put(x, y, R[1])
    s.ell(15, 23, 2.5, 2.5, [rgb('#2c1808')] * 2)
    return s


garde('ruche', ruche(), '#2c1808')


def vigne():
    s = S(40, 38, 3)
    for x in (5, 33):
        s.ligne(x, 8, x, 36, rgb('#6a4428'), 3)
    R = ramp(['#3c2008', '#8c4c18', '#d08c2c', '#f8d058'], 7)
    s.feuillage(19.5, 17, 18, 8, R, 4, 5, 5)
    for x, y in ((8, 23), (19, 25), (29, 22)):
        for a, b in ((0, 0), (2, 0), (1, 2), (-1, 2), (3, 2), (0, 4), (2, 4), (1, 6)):
            s.put(x + a, y + b, rgb('#8c4cc0')); s.put(x + a + 1, y + b, rgb('#5c2888')); s.put(x + a, y + b + 1, rgb('#4c1c70'))
    return s


garde('vigne', vigne(), '#241008')


def menhir(graine, w, h, R=PIERRE, mousse='#5c7c3c', runes=None):
    s = S(w + 6, h + 6, graine)
    cx = (w + 6) / 2
    for y in range(3, h + 3):
        t = (y - 3) / h
        l = w * (.30 + .20 * min(1, t * 2.2)) + math.sin(y * .5 + graine) * 1.1
        a, b = round(cx - l - math.sin(t * 3) * 1.5), round(cx + l)
        for x in range(a, b + 1):
            u = (x - a) / max(1, b - a)
            k = 4.4 - u * 3.4 - t * .6 + s.r.uniform(-.45, .45)
            s.put(x, y, R[max(0, min(5, int(k)))])
            if mousse and t > .72 and s.r.random() < (t - .7) * 2.2:
                s.put(x, y, rgb(mousse))
    if runes:
        for i, y in enumerate(range(int(h * .25), int(h * .75), 9)):
            for dx, dy in ((0, 0), (0, 1), (0, 2), (0, 3), (0, 4), (1, i % 3), (2, i % 3), (-1, 4 - i % 2)):
                s.put(cx - 1 + dx, y + dy, rgb(runes))
    return s


garde('menhir', menhir(3, 22, 52)); garde('menhir2', menhir(6, 28, 36)); garde('menhir_rune', menhir(9, 22, 50, ramp(['#1c1c34', '#50507c', '#a0a0c8'], 6), None, '#8cf0ff'))
garde('menhir_orage', menhir(12, 20, 48, ramp(['#16161f', '#3c3c4c', '#7c7c90'], 6), None, '#ffe84c'))


def cairn():
    s = S(30, 40, 2)
    for x, y, rx, ry in ((15, 33, 12, 5), (14, 25, 9, 4.5), (16, 18, 8, 4), (15, 12, 5.5, 3.2), (15, 7, 3.5, 2.6)):
        s.ell(x, y, rx, ry, PIERRE, .06)
    return s


garde('cairn', cairn())


def fanions():
    """drapeaux de prière tendus entre deux perches (3 cases de large)"""
    s = S(150, 62, 2)
    for x in (10, 138):
        s.ligne(x, 4, x, 55, rgb('#6a4428'), 3); s.ell(x, 4, 3, 3, ramp(['#8c6c1c', '#e0b838', '#fff0a0'], 4))
    C = ['#e04838', '#f0c038', '#3c9c5c', '#3c7cd0', '#f8f8f0']
    for i in range(129):
        y = 8 + math.sin(i / 128 * 3.14) * 13
        s.put(10 + i, y, rgb('#4c4038'))
        if i % 10 < 7 and 2 < i < 126:
            c = rgb(C[(i // 10) % 5])
            for j in range(1, 9):
                if j < 8 or i % 10 in (1, 2, 4, 5):
                    s.put(10 + i, y + j, tuple(int(v * (.82 if i % 10 > 4 else 1)) for v in c))
    return s


garde('fanions', fanions(), '#2c2420')


def tombe(k):
    s = S(30, 36, k)
    R = ramp(['#24242e', '#5c5c6c', '#9c9cac'], 6)
    if k == 1:
        s.poly([(7, 32), (7, 12), (10, 7), (15, 5), (20, 7), (23, 12), (23, 32)], lambda x, y: R[max(1, 5 - (x - 7) // 4 - (y > 24))])
        s.ligne(15, 11, 15, 20, R[1], 2); s.ligne(11, 14, 19, 14, R[1])
    else:
        s.poly([(12, 4), (18, 4), (18, 32), (12, 32)], lambda x, y: R[4 if x < 15 else 2]); s.poly([(5, 10), (25, 10), (25, 15), (5, 15)], lambda x, y: R[4 if y < 12 else 2])
    for x in range(4, 27):
        s.ell(x, 32, 1.6, 1.6, ramp(['#1c2430', '#3c4a5a', '#6c7c90'], 3))
    return s


garde('tombe', tombe(1), '#0c0c14'); garde('tombe2', tombe(2), '#0c0c14')


def lampadaire_feu(c, pierre=PIERRE):
    s = S(24, 48, 2)
    s.poly([(10, 18), (14, 18), (15, 43), (9, 43)], lambda x, y: pierre[4 if x < 12 else 2]); s.poly([(5, 42), (19, 42), (20, 46), (4, 46)], pierre[2])
    s.poly([(5, 14), (19, 14), (17, 19), (7, 19)], pierre[3])
    F = ramp(c, 5)
    s.poly([(7, 14), (17, 14), (15, 7), (12, 1), (10, 6)], F[2]); s.poly([(9, 14), (15, 14), (13, 8), (12, 5)], F[4])
    return s


garde('feu_follet', lampadaire_feu(['#2c1470', '#8c50f0', '#e8d0ff'], ramp(['#16141e', '#44404e', '#7c788a'], 6)), '#0c0a14')
garde('brasero_r', lampadaire_feu(['#a02008', '#ff8020', '#fff0a0'], ramp(['#181414', '#443c3c', '#7c7470'], 6)), '#140c0a')


def nenuphar(f):
    s = S(30, 20, 2)
    R = ramp(['#0e4028', '#2c8c48', '#80cc68'], 5)
    for cx, cy, rx in ((9, 12, 8), (21, 8, 7), (20, 16, 6)):
        for y in range(20):
            for x in range(30):
                u, v = (x + .5 - cx) / rx, (y + .5 - cy) / (rx * .55)
                if u * u + v * v <= 1 and not (u > 0 and abs(v) < u * .35):
                    s.put(x, y, R[4 if v < -.3 else 3 if u < 0 else 2])
    if f:
        for x, y in ((20, 7), (9, 11)):
            for dx, dy in ((0, 0), (-2, 0), (2, 0), (-1, -1), (1, -1), (0, -2)):
                s.put(x + dx, y + dy, rgb('#ff9cc8') if dy else rgb('#fff0f8'))
    return s


garde('nenuphar', nenuphar(False), '#0c3020'); garde('nenuphar_f', nenuphar(True), '#0c3020')


def roseaux():
    s = S(34, 46, 5)
    V = ramp(['#2c3c18', '#6c7c34', '#b8b860'], 4)
    for i in range(12):
        x, h, d = 4 + i * 2.3 + s.r.uniform(-1, 1), s.r.randrange(22, 42), s.r.uniform(-4, 4)
        for j in range(h):
            s.put(x + d * (j / h) ** 2, 43 - j, V[min(3, 1 + (j * 3) // h)])
        if i % 3 == 1:
            for j in range(8):
                for q in range(3):
                    s.put(x + d + q - 1, 43 - h - 2 + j, rgb('#8a5428') if q < 2 else rgb('#5c3418'))
    return s


garde('roseaux_b', roseaux(), None)


def cotes():
    """les côtes d'un géant : une arche d'os sous laquelle on passe (3 cases de large)"""
    s = S(150, 92, 2)
    R = ramp(['#8c7c60', '#d8ccb0', '#fffcf0'], 5)
    for k, (w, dy) in enumerate(((66, 0), (61, 8))):
        for i in range(260):
            t = i / 259 * 3.1416
            ep = 8 - 3.5 * abs(math.cos(t))
            x, y = 74 - math.cos(t) * w, 86 - dy - math.sin(t) * (78 - dy)
            for q in range(int(ep)):
                s.put(x + q - ep / 2, y, R[4 - min(3, q * 4 // int(ep))] if k else R[1])
                s.put(x + q - ep / 2, y + 1, R[3 - min(3, q * 3 // int(ep))] if k else R[0])
    return s


garde('arche_os', cotes(), '#4c4030')


def crane():
    s = S(46, 38, 3)
    R = ramp(['#8c7c60', '#d8ccb0', '#fffcf0'], 6)
    s.ell(23, 16, 19, 13, R, .03); s.poly([(10, 22), (36, 22), (33, 34), (13, 34)], R[3])
    for x in (13, 29):
        s.ell(x + 1.5, 18, 4.5, 5, [rgb('#2c2018')] * 2)
    s.poly([(21, 25), (25, 25), (23, 20)], rgb('#3c2c20'))
    for x in range(14, 33, 4):
        s.ligne(x, 29, x, 34, R[0])
    for d in (-1, 1):
        for i in range(12):
            for q in range(4 - i // 4):
                s.put(23 + d * (17 + i * .45), 10 - i + q, R[4 if d < 0 else 2])
    return s


garde('crane', crane(), '#4c4030')


def geyser():
    s = S(40, 50, 3)
    R = ramp(['#7a4010', '#d89c2c', '#fff0a4'], 5)
    s.ell(20, 42, 17, 6, R, .08); s.ell(20, 40, 10, 3, ramp(['#0a5c64', '#1cc0ac', '#c8fff0'], 4))
    W = ramp(['#8cd0d8', '#d8f8f8', '#ffffff'], 4)
    for i in range(34):
        y = 40 - i
        l = 2 + i * .14 + math.sin(i * .9) * 1.2
        for x in range(int(20 - l), int(20 + l) + 1):
            if s.r.random() < .9 - i * .012:
                s.put(x, y, W[min(3, 1 + int(s.r.random() * 3))] + (230 - i * 4,))
    return s


garde('geyser', geyser(), None)


def arche(feu, fl, poteau):
    """une arche fleurie (3 cases de large, on passe dessous)"""
    s = S(150, 84, 6)
    for x in (10, 138):
        s.ligne(x, 30, x, 80, rgb(poteau[0]), 4); s.ligne(x - 2, 30, x - 2, 80, rgb(poteau[1]))
    R = ramp(feu, 7)
    for i in range(37):
        t = i / 36 * 3.1416
        s.feuillage(74 - math.cos(t) * 64, 40 - math.sin(t) * 30, 8, 6, R, 4, 5, 5)
    for d in (10, 138):
        for y in range(40, 78, 7):
            s.feuillage(d + s.r.uniform(-2, 2), y, 6, 5, R, 4, 5, 5)
    pts = [p for p in s.p]
    for i in range(64):
        x, y = s.r.choice(pts)
        if s.r.random() < .25 and 36 < y:
            continue
        for dx, dy, k in ((0, 0, 2), (1, 0, 1), (0, 1, 1), (1, 1, 0), (2, 0, 0), (0, -1, 1)):
            if s.get(x + dx, y + dy):
                s.put(x + dx, y + dy, rgb(fl[k]))
    return s


garde('arche_rose', arche(['#0c2c18', '#286c34', '#78c058'], ['#9c1038', '#f0386c', '#ffd0dc'], ['#d8d0d0', '#ffffff']), '#12201a')
garde('arche_glycine', arche(['#1c2c3c', '#5c50a8', '#b09cf0'], ['#6c48c0', '#b08cff', '#f0e0ff'], ['#8a5c38', '#b88458']), '#141830')


def portique():
    s = S(150, 72, 3)
    V = ramp(['#1c4416', '#6ca834', '#d8f090'], 5)
    for x in (11, 138):
        for y in range(10, 69):
            for k in range(6):
                s.put(x - 3 + k, y, V[0] if (y % 14) == 0 else V[4 - min(3, k * 4 // 6)])
    for y0, l in ((8, 0), (20, 5)):
        for x in range(1 + l, 149 - l):
            for k in range(5):
                s.put(x, y0 + k, V[0] if (x % 17) == 0 else V[4 - min(3, k)])
    for x in (42, 75, 108):
        s.ligne(x, 25, x, 29, rgb('#3c2c20')); s.ell(x, 35, 5, 6, ramp(['#8c1c14', '#e84830', '#ffc070'], 5))
        s.ligne(x - 3, 29, x + 3, 29, rgb('#2c1c14')); s.ligne(x - 3, 41, x + 3, 41, rgb('#2c1c14'))
    return s


garde('arche_bambou', portique(), '#16240c')


def colonne_c(brisee):
    s = S(28, 64, 3 + brisee)
    R = ramp(['#8088a0', '#c8d0e4', '#ffffff'], 6)
    top = 30 if brisee else 8
    for y in range(top, 58):
        for x in range(8, 20):
            if brisee and y < top + 6 and (x * 5 + y * 3) % 7 > y - top + 1:
                continue
            s.put(x, y, R[(5, 5, 4, 3, 5, 4, 3, 2, 4, 3, 2, 1)[x - 8]])
    s.poly([(5, 57), (23, 57), (24, 62), (4, 62)], lambda x, y: R[4 if y < 59 else 2])
    if not brisee:
        s.poly([(3, 3), (25, 3), (22, 9), (6, 9)], lambda x, y: R[5 if y < 5 else 3])
    else:
        s.ell(22, 59, 4, 3, R)
    for i in range(14):
        x, y = s.r.randrange(6, 20), s.r.randrange(top + 4, 60)
        if s.get(x, y):
            s.put(x, y, rgb('#e8c458')); s.put(x, y + 1, rgb('#b08c2c'))
    return s


garde('colonne_c', colonne_c(0), '#4c5470'); garde('colonne_b', colonne_c(1), '#4c5470')


def paratonnerre():
    s = S(30, 76, 2)
    s.ligne(15, 6, 15, 70, rgb('#6c6c7c'), 3); s.ligne(14, 6, 14, 70, rgb('#b4b4c4'))
    for y in (16, 26, 36):
        s.poly([(9, y), (21, y), (21, y + 4), (9, y + 4)], lambda x, y: rgb('#c87840') if x < 14 else rgb('#8c4c24'))
    s.ell(15, 5, 4, 4, ramp(['#b08810', '#ffe84c', '#ffffff'], 4))
    s.poly([(6, 69), (24, 69), (25, 74), (5, 74)], rgb('#44444c'))
    for pts in (((15, 5), (21, 10), (19, 13), (25, 19)), ((15, 5), (8, 9), (10, 13), (4, 17))):
        for a, b in zip(pts, pts[1:]):
            s.ligne(*a, *b, rgb('#fff8b0'))
    return s


garde('paratonnerre', paratonnerre(), '#16161e')


def totem():
    s = S(34, 64, 2)
    B = ramp(['#3a2418', '#8a5c38', '#d0a068'], 5)
    s.poly([(7, 8), (27, 8), (27, 60), (7, 60)], lambda x, y: B[4 if x < 11 else 3 if x < 18 else 2 if x < 24 else 1])
    for y, c in ((10, '#e04838'), (27, '#3c9c8c'), (44, '#f0b838')):
        for x in (10, 20):
            s.poly([(x, y + 3), (x + 4, y + 3), (x + 4, y + 7), (x, y + 7)], rgb('#fff8e0')); s.put(x + 2, y + 5, rgb('#1c1008')); s.put(x + 1, y + 5, rgb('#1c1008'))
        s.poly([(9, y + 10), (25, y + 10), (23, y + 14), (11, y + 14)], rgb(c)); s.ligne(7, y, 27, y, rgb(c)); s.ligne(7, y + 1, 27, y + 1, B[0])
    s.poly([(2, 4), (14, 8), (8, 14)], rgb('#e04838')); s.poly([(32, 4), (20, 8), (26, 14)], rgb('#b03028'))
    return s


garde('totem', totem(), '#24140c')


def fleur_geante():
    s = S(56, 44, 3)
    V = ramp(['#0c3014', '#207434', '#70c050'], 5)
    for a in (200, 340, 170, 10):
        for j in range(22):
            t = j / 22
            for q in range(-4, 5):
                if abs(q) < 5 * math.sin(t * 3.1):
                    s.put(28 + math.cos(math.radians(a)) * j, 34 + math.sin(math.radians(a)) * j * .4 + q * .7, V[3 if q < 0 else 1])
    R = ramp(['#6c0c24', '#d02c40', '#ff8070'], 6)
    for a in range(0, 360, 60):
        x, y = 28 + math.cos(math.radians(a + 30)) * 13, 22 + math.sin(math.radians(a + 30)) * 8
        s.ell(x, y, 10, 7, R)
        for i in range(5):
            s.put(x + s.r.uniform(-6, 6), y + s.r.uniform(-4, 4), rgb('#ffe0c8'))
    s.ell(28, 22, 7, 5, ramp(['#3c0810', '#8c1c24', '#e8a030'], 5))
    return s


garde('fleur_geante', fleur_geante(), '#1c0c10')


def barque():
    s = S(62, 34, 2)
    B = ramp(['#3a2418', '#8a5c38', '#d0a068'], 5)
    s.poly([(2, 12), (60, 12), (52, 28), (10, 28)], lambda x, y: B[3 if (y // 4) % 2 else 2]); s.poly([(6, 10), (56, 10), (52, 16), (10, 16)], B[1])
    s.ligne(2, 11, 60, 11, B[4]); s.ligne(22, 13, 22, 15, B[3], 4); s.ligne(40, 13, 40, 15, B[3], 4); s.ligne(14, 6, 50, 14, B[4])
    return s


garde('barque', barque(), '#24140c')


def ponton_lampe():
    s = S(20, 46, 2)
    s.ligne(10, 8, 10, 42, rgb('#6a4428'), 4); s.ligne(8, 8, 8, 42, rgb('#9a6c44'))
    s.poly([(5, 6), (15, 6), (15, 17), (5, 17)], rgb('#3c2c20')); s.poly([(7, 8), (13, 8), (13, 15), (7, 15)], rgb('#ffe890')); s.poly([(3, 6), (17, 6), (10, 1)], rgb('#5c4030'))
    return s


garde('lanterne_bois', ponton_lampe(), '#1c120c')


def souche():
    s = S(36, 28, 2)
    s.tronc(18, 8, 18, 24, 22, 26, BOIS)
    s.ell(18, 9, 12, 5, ramp(['#a0683c', '#d8a46c', '#f4d4a0'], 4))
    for r in (3, 6, 9):
        for i in range(60):
            a = i / 60 * 6.28
            s.put(18 + math.cos(a) * r, 9 + math.sin(a) * r * .42, rgb('#8a5430'))
    s.ell(9, 22, 4, 2.5, ramp(['#2c5c24', '#5c9c3c', '#a0d060'], 4))
    return s


garde('souche_m', souche(), '#24140c')


def riz(graine, stops):
    s = S(34, 26, graine)
    V = ramp(stops, 5)
    for x in (4, 12, 20, 28):
        for y in (10, 22):
            for i in range(6):
                d = (i - 2.5) * 1.5
                L = s.r.randrange(6, 10)
                for j in range(L):
                    s.put(x + d * (j / L) ** 1.4, y - j, V[min(4, 1 + j * 4 // L)])
    return s


garde('riz', riz(2, ['#2c6c1c', '#78c030', '#e4fc8c']), None); garde('riz2', riz(5, ['#5c6c1c', '#b0b030', '#f8e878']), None)


def drap():
    """un petit autel moussu"""
    s = S(34, 44, 2)
    s.poly([(3, 30), (31, 30), (33, 41), (1, 41)], lambda x, y: PIERRE[4 if y < 33 else 3 if x < 17 else 2])
    s.poly([(8, 14), (26, 14), (26, 30), (8, 30)], lambda x, y: PIERRE[4 if x < 12 else 3 if x < 20 else 2])
    s.poly([(3, 14), (17, 3), (31, 14)], lambda x, y: PIERRE[5 if x < 17 else 3])
    s.poly([(13, 18), (21, 18), (21, 29), (13, 29)], rgb('#241c24')); s.ell(17, 25, 3, 3, ramp(['#e08020', '#ffd860', '#fffbe0'], 4))
    for i in range(50):
        x, y = s.r.randrange(2, 32), s.r.randrange(6, 41)
        if s.get(x, y) and s.r.random() < .5:
            s.put(x, y, rgb('#5c8c3c'))
    return s


garde('autel', drap())

# ---------------------------------------------------------------- la planche
OUT = {k: v for k, v in OUT.items() if v is not None}
W, x, y, rh, R = 512, 0, 0, 0, {}
ordre = sorted(OUT, key=lambda k: (-OUT[k].height, k))
pos = []
for k in ordre:
    im = OUT[k]
    if x + im.width > W:
        x, y, rh = 0, y + rh + 1, 0
    R[k] = [x, y, im.width, im.height]
    pos.append((k, x, y))
    x += im.width + 1
    rh = max(rh, im.height)
planche = Image.new('RGBA', (W, y + rh), (0, 0, 0, 0))
for k, a, b in pos:
    planche.paste(OUT[k], (a, b))
os.makedirs(os.path.join(RACINE, 'img', 'biomes'), exist_ok=True)
planche.save(os.path.join(RACINE, 'img', 'biomes', 'planche.png'), optimize=True)
with open(os.path.join(RACINE, 'js', 'data', 'biomes-sprites.js'), 'w', encoding='utf8', newline='\n') as f:
    f.write('// odyssee/js/data/biomes-sprites.js — écrit par tools/odyssee-biomes.py, ne pas modifier à la main.\n')
    f.write('// Arbres et décors des biomes : clé → [x, y, largeur, hauteur] dans odyssee/img/biomes/planche.png (32 px par case).\n')
    f.write('export const BIOMES_SPRITES = ' + json.dumps({k: R[k] for k in sorted(R)}, separators=(',', ':')) + ';\n')
print(len(R), 'dessins', planche.size)
