#!/usr/bin/env python3
"""Render original play/pause icons (8x16) and a marquee demo GIF for TC002 nowplaying.

The blueprint publishes a text frame ("TITLE - ARTIST") plus a play/pause icon image.
Icons are hand-drawn here (original pixels, no external asset). The demo GIF is only for
the preview folder; on-device the blueprint sends a single static frame per state change.
Usage: python3 render_nowplaying.py  (writes ./build/{play,pause}.png, demo.gif, base64.txt)
"""
import base64, os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
BUILD = os.path.join(HERE, "build")
GREEN = (62, 224, 138)


def play_icon():
    im = Image.new("RGBA", (8, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(1, 3), (1, 12), (7, 7)], fill=GREEN)     # right-pointing triangle
    return im


def pause_icon():
    im = Image.new("RGBA", (8, 16), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rectangle([1, 3, 2, 12], fill=GREEN)
    d.rectangle([5, 3, 6, 12], fill=GREEN)
    return im


def b64_png(im):
    p = os.path.join(BUILD, "tmp.png")
    im.save(p)
    raw = open(p, "rb").read()
    os.remove(p)
    return "data:image/png;base64," + base64.b64encode(raw).decode()


def main():
    os.makedirs(BUILD, exist_ok=True)
    play, pause = play_icon(), pause_icon()
    play.save(os.path.join(BUILD, "play.png"))
    pause.save(os.path.join(BUILD, "pause.png"))
    lines = [f"play: {b64_png(play)}", f"pause: {b64_png(pause)}"]
    open(os.path.join(BUILD, "base64.txt"), "w").write("\n".join(lines) + "\n")

    # marquee demo GIF (preview only): play icon + scrolling "MIDNIGHT CITY - M83"
    text = "MIDNIGHT CITY - M83   "
    font = ImageFont.load_default()
    tw = int(font.getlength(text))
    frames = []
    for off in range(0, tw, 2):
        f = Image.new("RGB", (52, 16), (0, 0, 0))
        f.paste(play.convert("RGB"), (0, 0), play)
        d = ImageDraw.Draw(f)
        d.text((10 - off, 3), text, fill=(230, 230, 235), font=font)
        d.text((10 - off + tw, 3), text, fill=(230, 230, 235), font=font)
        frames.append(f)
    frames[0].save(os.path.join(BUILD, "demo.gif"), save_all=True,
                   append_images=frames[1:], loop=0, duration=120, disposal=2)
    print("wrote play.png pause.png demo.gif base64.txt")


if __name__ == "__main__":
    main()
