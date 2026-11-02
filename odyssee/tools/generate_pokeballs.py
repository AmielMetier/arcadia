"""
Générateur de sprites pixel-art haute qualité pour les Poké Balls d'Odyssée :
- poke-ball.png (32x32 et 48x48)
- great-ball.png (32x32 et 48x48)
- ultra-ball.png (32x32 et 48x48)
- poke-ball-open.png (32x32 et 48x48)
- poke-ball-tilt-l.png & poke-ball-tilt-r.png (frames de secousse au pixel près)
"""
import math
from PIL import Image, ImageDraw

def create_ball(kind="poke", size=32, tilt_deg=0, open_state=False):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    cx, cy = size / 2.0, size / 2.0
    r = (size / 2.0) - 2.5
    
    rad = math.radians(tilt_deg)
    cos_a = math.cos(rad)
    sin_a = math.sin(rad)
    
    # Palette
    c_out = (18, 22, 30, 255)       # Contour sombre
    c_band = (16, 20, 28, 255)      # Bande équatoriale
    
    # Base colors by kind
    if kind == "poke":
        top_base = (232, 44, 44, 255)
        top_light = (255, 120, 120, 255)
        top_high = (255, 255, 255, 255)
        top_dark = (156, 22, 22, 255)
        top_darker = (100, 12, 12, 255)
    elif kind == "great":
        top_base = (40, 96, 216, 255)
        top_light = (90, 150, 255, 255)
        top_high = (255, 255, 255, 255)
        top_dark = (22, 54, 140, 255)
        top_darker = (12, 30, 88, 255)
        red_strip = (235, 45, 45, 255)
    elif kind == "ultra":
        top_base = (42, 46, 56, 255)
        top_light = (78, 86, 102, 255)
        top_high = (180, 195, 215, 255)
        top_dark = (22, 24, 30, 255)
        top_darker = (12, 14, 18, 255)
        yellow_strip = (255, 208, 48, 255)
        yellow_dark = (210, 150, 20, 255)
    
    bot_base = (244, 246, 250, 255)
    bot_light = (255, 255, 255, 255)
    bot_dark = (195, 205, 220, 255)
    bot_darker = (140, 155, 175, 255)

    btn_out = (20, 24, 32, 255)
    btn_ring = (210, 220, 235, 255)
    btn_center = (255, 255, 255, 255)

    for py in range(size):
        for px in range(size):
            dx = px + 0.5 - cx
            dy = py + 0.5 - cy
            dist = math.hypot(dx, dy)
            
            if dist > r + 1.2:
                continue
            
            # Rotation
            rx = dx * cos_a + dy * sin_a
            ry = -dx * sin_a + dy * cos_a
            
            # Anti-aliased outer edge
            if dist > r:
                alpha = int(255 * max(0.0, min(1.0, (r + 1.2 - dist) / 1.2)))
                if alpha <= 0:
                    continue
                c_edge = (c_out[0], c_out[1], c_out[2], int(alpha * (c_out[3] / 255.0)))
                img.putpixel((px, py), c_edge)
                continue
            elif dist > r - 1.1:
                img.putpixel((px, py), c_out)
                continue
                
            # Inside the ball
            # Normalised sphere shading: z = sqrt(r^2 - x^2 - y^2)
            z2 = max(0.0, (r * r) - (dx * dx) - (dy * dy))
            z = math.sqrt(z2)
            # Light vector from top-left-front: (-0.45, -0.55, 0.70)
            norm_x, norm_y, norm_z = dx / r, dy / r, z / r
            light = -(norm_x * 0.42) - (norm_y * 0.58) + (norm_z * 0.69)
            
            # Is it central button?
            dist_center = math.hypot(rx, ry)
            btn_r = r * 0.32
            if dist_center <= btn_r:
                if dist_center > btn_r - 1.1:
                    img.putpixel((px, py), btn_out)
                elif dist_center > btn_r * 0.52:
                    img.putpixel((px, py), btn_ring)
                elif dist_center > btn_r * 0.52 - 0.9:
                    img.putpixel((px, py), btn_out)
                else:
                    img.putpixel((px, py), btn_center)
                continue
                
            # Is it the black equator band?
            band_half = r * 0.11
            if abs(ry) <= band_half:
                img.putpixel((px, py), c_band)
                continue

            # Upper hemisphere vs Lower hemisphere
            if ry < -band_half:
                # Top half
                col = top_base
                # Great ball red wing stripes
                if kind == "great" and (abs(rx) > r * 0.45 and ry > -r * 0.85):
                    col = red_strip
                # Ultra ball yellow bracket stripes
                elif kind == "ultra":
                    if (abs(abs(rx) - r * 0.42) < r * 0.16) or (ry < -r * 0.65 and abs(rx) < r * 0.42):
                        col = yellow_strip if light > 0.4 else yellow_dark
                
                if col == top_base:
                    # Specular highlight
                    if dx < -r * 0.2 and dy < -r * 0.25 and dist < r * 0.65 and light > 0.92:
                        col = top_high
                    elif light > 0.65:
                        col = top_light
                    elif light < -0.15:
                        col = top_darker
                    elif light < 0.2:
                        col = top_dark
                img.putpixel((px, py), col)
            else:
                # Bottom half
                col = bot_base
                if light > 0.75:
                    col = bot_light
                elif light < -0.25:
                    col = bot_darker
                elif light < 0.2:
                    col = bot_dark
                img.putpixel((px, py), col)

    return img

def create_open_ball(size=32):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = size / 2.0, size / 2.0
    r = (size / 2.0) - 4.0
    
    # Top lid angled up
    top_lid = create_ball("poke", size=size, tilt_deg=0)
    # We create bottom dome and top hinged dome
    for y in range(size):
        for x in range(size):
            # bottom half intact
            if y >= cy:
                img.putpixel((x, y), top_lid.getpixel((x, y)))
            # top half shifted up and rotated
            ty = int(y + r * 0.5)
            if 0 <= ty < size and ty < cy:
                p = top_lid.getpixel((x, ty))
                if p[3] > 0:
                    img.putpixel((x, max(0, y - int(r * 0.35))), p)
                    
    # Energy flare in center
    flare_y = int(cy - 2)
    for fx in range(int(cx - r * 0.5), int(cx + r * 0.5 + 1)):
        draw.line([(fx, flare_y), (int(cx), int(flare_y - r * 0.5))], fill=(255, 255, 200, 220), width=1)
    draw.ellipse([cx - 4, flare_y - 4, cx + 4, flare_y + 4], fill=(255, 255, 255, 255))
    return img

out_dir = "arcadia/odyssee/img/battle"
import os
os.makedirs(out_dir, exist_ok=True)

# Generate 32x32 and 48x48
for kind in ["poke", "great", "ultra"]:
    b32 = create_ball(kind, size=32)
    b32.save(f"{out_dir}/{kind}_ball_32.png")
    b48 = create_ball(kind, size=48)
    b48.save(f"{out_dir}/{kind}_ball_48.png")

# Tilts for shaking animation (-24 deg, +24 deg)
t_l = create_ball("poke", size=32, tilt_deg=-24)
t_l.save(f"{out_dir}/poke_ball_tilt_l.png")
t_r = create_ball("poke", size=32, tilt_deg=24)
t_r.save(f"{out_dir}/poke_ball_tilt_r.png")

# Open ball
open_ball = create_open_ball(size=32)
open_ball.save(f"{out_dir}/poke_ball_open.png")

# Also copy high-res poke-ball to img/items and img/nature for intro
b32.save("arcadia/odyssee/img/items/poke-ball.png")
b48.save("arcadia/odyssee/img/items/poke-ball-hd.png")
b48.save("arcadia/odyssee/img/nature/itemball.png")

print("Pokéball sprites generated successfully!")
