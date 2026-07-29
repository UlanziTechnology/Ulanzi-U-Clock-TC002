#!/usr/bin/env python3
"""Render the TC002 fire GIF using PixDeck's classic demoscene fire (ported from
plugins/fire/plugin.py). The bottom row generates heat with random cold gaps (which
become flame tongues); heat diffuses upward as (below*2 + left + right)//4 minus a
random 1..3 decay; heat is coloured through a smooth 37-level black->red->orange->
yellow->white palette. Seeded for a reproducible loop.
Usage: python3 render_fire.py   (writes ./build/fire.gif + ./build/base64.txt)
"""
import base64, os, random
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
W, H, FRAMES = 52, 16, 28
HMAX = 36


def palette():
    """0..36 heat -> RGB (black->dark red->red->orange->yellow->white), same stops as plugins/fire."""
    stops = [(0, (0, 0, 0)), (6, (60, 0, 0)), (12, (180, 30, 0)),
             (20, (255, 100, 0)), (28, (255, 200, 30)), (36, (255, 255, 220))]
    pal = []
    for i in range(HMAX + 1):
        for k in range(len(stops) - 1):
            a, ca = stops[k]
            b, cb = stops[k + 1]
            if a <= i <= b:
                t = (i - a) / (b - a)
                pal.append(tuple(int(ca[j] + (cb[j] - ca[j]) * t) for j in range(3)))
                break
    return pal


PAL = palette()


def step(heat):
    for x in range(W):
        heat[H - 1][x] = 0 if random.random() < 0.18 else HMAX
    for y in range(H - 1):
        for x in range(W):
            below = heat[y + 1][x]
            l = heat[y + 1][(x - 1) % W]
            r = heat[y + 1][(x + 1) % W]
            heat[y][x] = max(0, (below * 2 + l + r) // 4 - random.randint(1, 3))


def main():
    os.makedirs(BUILD, exist_ok=True)
    random.seed(7)
    heat = [[0] * W for _ in range(H)]
    for _ in range(24):                 # warm-up so the captured loop starts settled
        step(heat)
    flat = []
    for c in PAL:
        flat += list(c)
    flat += [0] * (768 - len(flat))
    frames = []
    for _ in range(FRAMES):
        step(heat)
        img = Image.new("P", (W, H))
        img.putpalette(flat)
        px = img.load()
        for y in range(H):
            row = heat[y]
            for x in range(W):
                px[x, y] = min(HMAX, row[x])
        frames.append(img)
    path = os.path.join(BUILD, "fire.gif")
    frames[0].save(path, save_all=True, append_images=frames[1:], loop=0, duration=80, disposal=2)
    raw = open(path, "rb").read()
    b64 = "data:image/gif;base64," + base64.b64encode(raw).decode()
    open(os.path.join(BUILD, "base64.txt"), "w").write("fire: " + b64 + "\n")
    print(f"fire.gif {W}x{H} {FRAMES}f {len(raw)} bytes")


if __name__ == "__main__":
    main()
