#!/usr/bin/env python3
"""Build the TC002 pixel-pet GIFs from Shepardskin's CC0 "Cat Sprites".

Source: https://opengameart.org/content/cat-sprites  (CC0 / public domain, by Shepardskin)
We downscale the shipped x2 GIFs to native size, key out the background, recolor to a
light-grey tabby (gray1), and compose each frame onto a 52x16 black canvas (cat at x=2,
bottom-aligned). Produces idle (2-frame breathing), walk (6f), run (6f) as 52x16 GIFs
quantized to a fixed 5-colour palette (clean animation), and writes their base64 for
embedding in blueprint.yaml.

Usage: python3 build_pet.py    (writes ./build/*.gif and ./build/base64.txt)
Deps: Pillow, internet (downloads the CC0 zip once).
"""
import base64, io, os, urllib.request, zipfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
ZIP_URL = "https://opengameart.org/sites/default/files/cat%20sprite.zip"
UA = "Mozilla/5.0"

# gray1 recolor (light tabby); eye + ear-accent kept
RECOLOR = {
    (56, 56, 56): (168, 168, 174),   # body -> light grey
    (28, 28, 28): (96, 96, 102),     # outline -> mid grey
    (95, 160, 48): (95, 160, 48),    # green eye (kept)
    (143, 52, 160): (143, 52, 160),  # accent (kept)
}
# fixed palette for clean GIF animation: bg + the recolored colours
PALETTE = [(0, 0, 0), (168, 168, 174), (96, 96, 102), (95, 160, 48), (143, 52, 160)]


def _fetch_zip():
    req = urllib.request.Request(ZIP_URL, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=30) as r:
        return zipfile.ZipFile(io.BytesIO(r.read()))


def _native_frames(zf, name, div):
    """Load an x{div} gif, downscale to native, key bg transparent, recolor to gray1."""
    inner = next(n for n in zf.namelist() if n.endswith(name))
    im = Image.open(io.BytesIO(zf.read(inner)))
    out = []
    for i in range(getattr(im, "n_frames", 1)):
        im.seek(i)
        f = im.convert("RGBA").resize((im.width // div, im.height // div), Image.NEAREST)
        px = f.load()
        bg = px[0, 0]
        for y in range(f.height):
            for x in range(f.width):
                r, g, b, a = px[x, y]
                if a == 0 or (bg[3] == 255 and (r, g, b) == bg[:3]):
                    px[x, y] = (0, 0, 0, 0)
                elif (r, g, b) in RECOLOR:
                    px[x, y] = RECOLOR[(r, g, b)] + (255,)
        out.append(f)
    return out


def _palette_image():
    p = Image.new("P", (1, 1))
    flat = []
    for c in PALETTE:
        flat += list(c)
    p.putpalette(flat + [0] * (768 - len(flat)))
    return p


def _on_canvas(frame, palimg):
    """Place a native cat frame on a 52x16 black canvas (horizontally centered, bottom-aligned) -> P (fixed palette)."""
    c = Image.new("RGBA", (52, 16), (0, 0, 0, 255))
    c.alpha_composite(frame, ((52 - frame.width) // 2, 16 - frame.height))
    return c.convert("RGB").quantize(palette=palimg, dither=Image.NONE)


def _save_gif(frames, path, durations, palimg):
    imgs = [_on_canvas(f, palimg) for f in frames]
    imgs[0].save(path, save_all=True, append_images=imgs[1:], loop=0,
                 duration=durations, disposal=2, optimize=False)


def _breathing_idle(walk0):
    """2-frame idle: stand still + a 1px vertical bob, from walk frame 0."""
    up = Image.new("RGBA", walk0.size, (0, 0, 0, 0))
    up.alpha_composite(walk0.crop((0, 1, walk0.width, walk0.height)), (0, 0))  # shift up 1px
    return [walk0, up]


def main():
    os.makedirs(BUILD, exist_ok=True)
    zf = _fetch_zip()
    walk = _native_frames(zf, "catwalkx2.gif", 2)
    run = _native_frames(zf, "catrunx2.gif", 2)
    idle = _breathing_idle(walk[0])
    palimg = _palette_image()

    _save_gif(idle, os.path.join(BUILD, "idle.gif"), [900, 900], palimg)
    _save_gif(walk, os.path.join(BUILD, "walk.gif"), 120, palimg)
    _save_gif(run, os.path.join(BUILD, "run.gif"), 90, palimg)

    lines = []
    for name in ("idle", "walk", "run"):
        raw = open(os.path.join(BUILD, f"{name}.gif"), "rb").read()
        b64 = base64.b64encode(raw).decode()
        lines.append(f"{name}: data:image/gif;base64,{b64}")
        print(f"{name}.gif  {len(raw)} bytes  -> {len(b64)} b64 chars")
    open(os.path.join(BUILD, "base64.txt"), "w").write("\n".join(lines) + "\n")
    print("wrote", BUILD)


if __name__ == "__main__":
    main()
