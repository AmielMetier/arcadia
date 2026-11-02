"""
Générateur et gestionnaire des sprites de Poké Balls rétro pixel-art pour Odyssée :
- img/items/poke-ball.png (Poké Ball officielle 32x32)
- img/items/great-ball.png (Super Ball officielle 32x32)
- img/items/ultra-ball.png (Hyper Ball officielle 32x32)
- img/items/master-ball.png (Master Ball officielle 32x32)
- img/nature/itemball.png (Sprite de terrain 15x15 d'origine)
- img/battle/poke_ball_32.png, great_ball_32.png, ultra_ball_32.png, master_ball_32.png
- img/battle/poke_ball_48.png, great_ball_48.png, ultra_ball_48.png (Intro Prof Saule)
- img/battle/poke_ball_tilt_l.png, poke_ball_tilt_r.png, poke_ball_open.png (Animation combat)
"""
import os
from PIL import Image

def generate():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    items_dir = os.path.join(root, "img", "items")
    battle_dir = os.path.join(root, "img", "battle")
    nature_dir = os.path.join(root, "img", "nature")
    os.makedirs(battle_dir, exist_ok=True)
    os.makedirs(items_dir, exist_ok=True)
    os.makedirs(nature_dir, exist_ok=True)

    # 1. Base authentic sprites
    pb = Image.open(os.path.join(items_dir, "poke-ball.png")).convert("RGBA")
    gb = Image.open(os.path.join(items_dir, "great-ball.png")).convert("RGBA")
    ub = Image.open(os.path.join(items_dir, "ultra-ball.png")).convert("RGBA")

    # 2. Master Ball creation
    mb = pb.copy()
    red_map = {
        (233, 59, 48, 255): (138, 43, 178, 255),
        (172, 43, 49, 255): (92, 24, 128, 255),
        (72, 14, 22, 255): (54, 12, 80, 255),
        (41, 16, 19, 255): (28, 8, 44, 255),
        (231, 180, 170, 255): (200, 150, 230, 255),
    }
    for y in range(18):
        for x in range(32):
            c = mb.getpixel((x, y))
            if c in red_map:
                mb.putpixel((x, y), red_map[c])

    pink_main = (235, 55, 125, 255)
    for (px, py) in [(8,10),(9,10),(10,10),(7,11),(8,11),(9,11),(10,11),(11,11),(8,12),(9,12),(10,12)]:
        if mb.getpixel((px, py))[3] > 100: mb.putpixel((px, py), pink_main)
    for (px, py) in [(21,10),(22,10),(23,10),(20,11),(21,11),(22,11),(23,11),(24,11),(21,12),(22,12),(23,12)]:
        if mb.getpixel((px, py))[3] > 100: mb.putpixel((px, py), pink_main)

    m_col = (255, 255, 255, 255)
    for pt in [(14,9),(14,10),(14,11),(18,9),(18,10),(18,11),(15,10),(17,10),(16,11)]:
        mb.putpixel(pt, m_col)

    # 3. Save 32x32 battle balls
    pb.save(os.path.join(battle_dir, "poke_ball_32.png"))
    gb.save(os.path.join(battle_dir, "great_ball_32.png"))
    ub.save(os.path.join(battle_dir, "ultra_ball_32.png"))
    mb.save(os.path.join(items_dir, "master-ball.png"))
    mb.save(os.path.join(battle_dir, "master_ball_32.png"))

    # 4. Save 48x48 upscaled pixel-art versions
    def make_48(ball32):
        crop = ball32.crop(ball32.getbbox()) # 22x23
        up = crop.resize((crop.width * 2, crop.height * 2), Image.NEAREST)
        res = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
        res.paste(up, (2, 1))
        return res

    pb48 = make_48(pb)
    gb48 = make_48(gb)
    ub48 = make_48(ub)
    mb48 = make_48(mb)

    pb48.save(os.path.join(battle_dir, "poke_ball_48.png"))
    pb48.save(os.path.join(items_dir, "poke-ball-hd.png"))
    gb48.save(os.path.join(battle_dir, "great_ball_48.png"))
    ub48.save(os.path.join(battle_dir, "ultra_ball_48.png"))
    mb48.save(os.path.join(battle_dir, "master_ball_48.png"))

    # 5. Tilts for battle shaking
    def rotate_at_pivot(im, angle_deg, pivot=(16, 26)):
        w, h = im.size
        canvas = Image.new("RGBA", (w * 2, h * 2), (0, 0, 0, 0))
        ox = w - pivot[0]
        oy = h - pivot[1]
        canvas.paste(im, (ox, oy))
        rot = canvas.rotate(angle_deg, resample=Image.NEAREST, center=(w, h))
        res = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        res.paste(rot, (-ox, -oy))
        return res

    t_l = rotate_at_pivot(pb, -18)
    t_r = rotate_at_pivot(pb, 18)
    t_l.save(os.path.join(battle_dir, "poke_ball_tilt_l.png"))
    t_r.save(os.path.join(battle_dir, "poke_ball_tilt_r.png"))

    # 6. Open ball
    open_im = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y in range(18, 32):
        for x in range(32):
            open_im.putpixel((x, y), pb.getpixel((x, y)))

    top_half = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    for y in range(18):
        for x in range(32):
            top_half.putpixel((x, y), pb.getpixel((x, y)))

    top_tilted = rotate_at_pivot(top_half, -14, pivot=(6, 17))
    open_im.paste(top_tilted, (0, -4), mask=top_tilted)

    for px in range(11, 22):
        open_im.putpixel((px, 14), (255, 255, 220, 255))
        open_im.putpixel((px, 15), (255, 255, 255, 255))
        open_im.putpixel((px, 16), (255, 255, 240, 255))
    for px in range(13, 20):
        open_im.putpixel((px, 13), (255, 240, 180, 255))
        open_im.putpixel((px, 17), (255, 240, 180, 255))

    open_im.save(os.path.join(battle_dir, "poke_ball_open.png"))
    print("Tous les sprites de Poké Balls ont été générés avec succès !")

if __name__ == "__main__":
    generate()
