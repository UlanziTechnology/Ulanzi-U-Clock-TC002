#!/usr/bin/env python3
"""Render an original 52x16 procedural fire GIF for TC002 (Pillow, deterministic).

Bottom-up flame: a flickering hot base row, diffused upward with cooling so the fire
fades to black near the top. Heat maps through a dark->red->orange->yellow->white
palette. No external assets; deterministic (seeded LCG) so the loop is reproducible.
Usage: python3 render_fire.py   (writes ./build/fire.gif + ./build/base64.txt)
"""
import base64, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
W, H, FRAMES = 52, 16, 28

# 12-level flame palette: mostly dark, only the top couple are bright.
PAL = [
    (0, 0, 0), (0, 0, 0), (48, 0, 0), (100, 12, 0), (150, 28, 0), (198, 50, 0),
    (230, 85, 0), (248, 120, 12), (255, 155, 30), (255, 195, 60), (255, 225, 110), (255, 248, 200),
]
MAXH = len(PAL) - 1                     # 11


def _lcg(seed):
    x = seed & 0xFFFFFFFF
    while True:
        x = (1103515245 * x + 12345) & 0x7FFFFFFF
        yield x / 0x7FFFFFFF


def render():
    rnd = _lcg(97)
    heat = [[0] * W for _ in range(H)]

    def step():
        # flickering base: mostly max, occasional cool gaps -> separate tongues
        heat[H - 1] = [MAXH if next(rnd) > 0.18 else 3 for _ in range(W)]
        for y in range(H - 2, -1, -1):
            for x in range(W):
                a = heat[y + 1][x] + heat[y + 1][(x - 1) % W] + heat[y + 1][(x + 1) % W]
                r = next(rnd)
                decay = 0 if r > 0.72 else (1 if r > 0.22 else 2)   # sometimes a tongue shoots up
                heat[y][x] = max(0, a // 3 - decay)

    for _ in range(24):                 # warm-up so the loop starts settled
        step()

    flat = []
    for c in PAL:
        flat += list(c)
    flat += [0] * (768 - len(flat))
    frames = []
    for _ in range(FRAMES):
        step()
        img = Image.new("P", (W, H))
        img.putpalette(flat)
        px = img.load()
        for y in range(H):
            row = heat[y]
            for x in range(W):
                px[x, y] = min(MAXH, row[x])
        frames.append(img)
    return frames


def main():
    os.makedirs(BUILD, exist_ok=True)
    frames = render()
    path = os.path.join(BUILD, "fire.gif")
    frames[0].save(path, save_all=True, append_images=frames[1:], loop=0, duration=80, disposal=2)
    raw = open(path, "rb").read()
    b64 = "data:image/gif;base64," + base64.b64encode(raw).decode()
    open(os.path.join(BUILD, "base64.txt"), "w").write("fire: " + b64 + "\n")
    print(f"fire.gif {W}x{H} {len(frames)}f {len(raw)} bytes")


if __name__ == "__main__":
    main()
