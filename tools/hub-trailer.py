#!/usr/bin/env python3
"""tools/hub-trailer.py — monte la bande-annonce d'un jeu pour le Hub (<jeu>/trailer.mp4, lue par hub/trailers.js).

Un montage de vraies captures du jeu : chaque plan bouge lentement (zoom ou travelling), porte une accroche en grosses
lettres, et s'enchaîne au suivant par une transition ; l'affiche du jeu ferme la boucle. Vidéo muette de 960 × 540,
30 images par seconde, pensée pour tourner en boucle (moins de 1 Mo).

Usage :
  python3 tools/hub-trailer.py <jeu> <couleur #rrggbb> <police.ttf> "ACCROCHE 1|ACCROCHE 2|…" capture1.png capture2.png …
(l'affiche <jeu>/img/affiche.jpg est ajoutée à la fin ; une accroche vide laisse le plan sans texte)
"""
import os
import subprocess
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
jeu, coul, police, accroches, *plans = sys.argv[1:]
accroches = accroches.split('|')
W, H, FPS, D, X = 960, 540, 30, 2.1, 0.35          # taille, images/s, durée d'un plan, durée d'une transition
FIN = 2.4                                           # l'affiche
N = int(D * FPS)
MOUV = [   # zoom avant, travelling à droite, zoom arrière, travelling à gauche
    "z='1+0.14*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    "z='1.14':x='(iw-iw/zoom)*on/{n}':y='ih/2-(ih/zoom/2)'",
    "z='1.16-0.14*on/{n}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    "z='1.14':x='(iw-iw/zoom)*(1-on/{n})':y='(ih-ih/zoom)*0.35'",
]
TRANS = ['slideleft', 'fade', 'wipeleft', 'slideup', 'circleopen', 'fadewhite']
esc = lambda t: t.replace('\\', '\\\\').replace(':', '\\:').replace("'", "’").replace(',', '\\,').replace('%', '\\%')
c = coul.lstrip('#')

entrees, filtres = [], []
for i, p in enumerate(plans):
    entrees += ['-loop', '1', '-t', str(D), '-i', p]
    f = (f"[{i}:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop={W * 2}:{H * 2},"
         f"zoompan={MOUV[i % len(MOUV)].format(n=N)}:d={N}:s={W}x{H}:fps={FPS},setsar=1,eq=saturation=1.12:contrast=1.04")
    t = accroches[i] if i < len(accroches) else ''
    if t:
        # l'accroche glisse depuis la gauche : une barre à la couleur du jeu, puis le texte, sur un dégradé sombre
        g = "max(0\\,1-t/0.28)"
        f += (f",drawbox=x=0:y={H - 150}:w={W}:h=150:color=black@0.38:t=fill"
              f",drawbox=x=36:y={H - 108}:w=10:h=62:color=0x{c}:t=fill:enable='gte(t\\,0.16)'"
              f",drawtext=fontfile={police}:text='{esc(t)}':fontsize=50:fontcolor=white:borderw=4:bordercolor=black@0.9"
              f":x='62-260*{g}':y={H - 104}:alpha='min(1\\,t/0.22)'")
    filtres.append(f + f",format=yuv420p[v{i}]")
k = len(plans)
entrees += ['-loop', '1', '-t', str(FIN), '-i', os.path.join(ROOT, jeu, 'img', 'affiche.jpg')]
nf = int(FIN * FPS)
filtres.append(f"[{k}:v]scale={W * 2}:{H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop={W * 2}:{H * 2},"
               f"zoompan=z='1.10-0.10*on/{nf}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d={nf}:s={W}x{H}:fps={FPS},setsar=1,format=yuv420p[v{k}]")
prec, t0 = 'v0', D
for i in range(1, k + 1):
    tr = 'fadewhite' if i == k else TRANS[(i - 1) % 5]
    filtres.append(f"[{prec}][v{i}]xfade=transition={tr}:duration={X}:offset={t0 - X:.3f}[x{i}]")
    prec, t0 = f'x{i}', t0 - X + (FIN if i == k else D)
# la fin se fond au noir une fraction de seconde : la boucle repart sans à-coup
filtres.append(f"[{prec}]fade=t=out:st={t0 - 0.3:.3f}:d=0.3,fade=t=in:st=0:d=0.25[v]")
sortie = os.path.join(ROOT, jeu, 'trailer.mp4')
subprocess.run(['ffmpeg', '-v', 'error', '-y', *entrees, '-filter_complex', ';'.join(filtres), '-map', '[v]', '-an',
                '-c:v', 'libx264', '-preset', 'slow', '-crf', '27', '-maxrate', '900k', '-bufsize', '1800k', '-pix_fmt', 'yuv420p',
                '-movflags', '+faststart', sortie], check=True)
print(jeu, f'{t0:.1f} s', os.path.getsize(sortie) // 1024, 'Ko')
