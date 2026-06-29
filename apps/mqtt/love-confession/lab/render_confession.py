#!/usr/bin/env python3
"""渲染应援灯牌 GIF 用于 TC002 MQTT 发布。

支持动画：心跳、烟花、流星、滚动文字、组合。

用法：
  python3 lab/render_confession.py heart
  python3 lab/render_confession.py firework
  python3 lab/render_confession.py star
  python3 lab/render_confession.py text "I ❤ YOU"
  python3 lab/render_confession.py combo "LOVE"

输出：
  stdout 输出 base64 编码的 GIF
"""

import base64
import math
import random
import sys
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("需要安装 Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

W, H = 52, 16
BG = (0, 0, 0)
HEART_PINK = (255, 48, 110)
HEART_HI = (255, 140, 180)
FIRE_COLORS = [
    (255, 100, 150), (255, 190, 70), (255, 230, 130),
    (200, 100, 255), (80, 190, 255), (255, 160, 200),
]
TEXT_COLOR = (255, 225, 240)

HEART_RAW = [
    (3,0),(4,0),(5,0),(8,0),(9,0),(10,0),
    (2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),(11,1),
    (1,2),(2,2),(3,2),(4,2),(5,2),(6,2),(7,2),(8,2),(9,2),(10,2),(11,2),(12,2),
    (1,3),(2,3),(3,3),(4,3),(5,3),(6,3),(7,3),(8,3),(9,3),(10,3),(11,3),(12,3),
    (0,4),(1,4),(2,4),(3,4),(4,4),(5,4),(6,4),(7,4),(8,4),(9,4),(10,4),(11,4),(12,4),(13,4),
    (0,5),(1,5),(2,5),(3,5),(4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(10,5),(11,5),(12,5),(13,5),
    (1,6),(2,6),(3,6),(4,6),(5,6),(6,6),(7,6),(8,6),(9,6),(10,6),(11,6),(12,6),
    (2,7),(3,7),(4,7),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(11,7),
    (3,8),(4,8),(5,8),(6,8),(7,8),(8,8),(9,8),(10,8),
    (4,9),(5,9),(6,9),(7,9),(8,9),(9,9),
    (5,10),(6,10),(7,10),(8,10),
    (6,11),(7,11),
]
HEART_W, HEART_H = 14, 12


def clamp(v, lo, hi):
    return max(lo, min(hi, v))


def heart_pixels(scale=1.0, cx=26, cy=8):
    mx, my = HEART_W / 2.0, HEART_H / 2.0
    pts = set()
    for hx, hy in HEART_RAW:
        sx = int((hx - mx) * scale + cx)
        sy = int((hy - my) * scale + cy)
        if 0 <= sx < W and 0 <= sy < H:
            pts.add((sx, sy))
    return pts


def draw_heart_frame(scale):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    pts = heart_pixels(scale)
    hi_pts = heart_pixels(scale * 0.82)
    for x, y in pts:
        draw.point((x, y), fill=HEART_PINK)
    for x, y in hi_pts:
        if (x + y) % 2 == 0:
            draw.point((x, y), fill=HEART_HI)
    return img


def render_heart():
    """心跳动画"""
    scales = [0.7, 1.0, 1.15, 1.0]
    durations = [160, 140, 120, 140]
    frames = [draw_heart_frame(s) for s in scales]
    buf = BytesIO()
    frames[0].save(buf, format="GIF", save_all=True,
                    append_images=frames[1:], duration=durations, loop=0, optimize=False)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def render_firework():
    """烟花动画"""
    random.seed(42)
    cx, cy = 26, 8
    n_particles = 32
    particles = []
    for i in range(n_particles):
        angle = (i / n_particles) * 2 * math.pi + random.uniform(-0.15, 0.15)
        speed = random.uniform(1.2, 4.5)
        particles.append((angle, speed, random.choice(FIRE_COLORS)))

    frames = []
    n_frames = 16
    for fi in range(n_frames):
        img = Image.new("RGB", (W, H), BG)
        draw = ImageDraw.Draw(img)
        t = fi / (n_frames - 1)
        for angle, speed, color in particles:
            dist = speed * t * 20
            px = int(cx + math.cos(angle) * dist)
            py = int(cy + math.sin(angle) * dist)
            fade = max(0, 1.0 - t) * max(0, 1.0 - dist / 27)
            r, g, b = color
            cf = (clamp(int(r * fade), 0, 255), clamp(int(g * fade), 0, 255), clamp(int(b * fade), 0, 255))
            if 0 <= px < W and 0 <= py < H and fade > 0.04:
                draw.point((px, py), fill=cf)
        if t < 0.12:
            r = int(8 * (1 - t / 0.12))
            for dx in range(-r, r + 1):
                for dy in range(-r, r + 1):
                    if dx*dx + dy*dy <= r*r:
                        nx, ny = cx+dx, cy+dy
                        if 0 <= nx < W and 0 <= ny < H:
                            draw.point((nx, ny), fill=(255, 255, 245))
        frames.append(img)
    for _ in range(3):
        frames.append(Image.new("RGB", (W, H), BG))

    buf = BytesIO()
    frames[0].save(buf, format="GIF", save_all=True,
                    append_images=frames[1:], duration=75, loop=0, optimize=False)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def render_star():
    """流星动画"""
    random.seed(7)
    sx0, sy0 = 48, -1
    sx1, sy1 = -3, 16
    frames = []
    n_frames = 22
    for fi in range(n_frames):
        img = Image.new("RGB", (W, H), BG)
        draw = ImageDraw.Draw(img)
        t = fi / (n_frames - 1)
        hx = int(sx0 + (sx1 - sx0) * t)
        hy = int(sy0 + (sy1 - sy0) * t)
        for ti in range(14):
            tt = t - ti / (n_frames * 0.5)
            if tt < 0:
                continue
            tx = int(sx0 + (sx1 - sx0) * tt)
            ty = int(sy0 + (sy1 - sy0) * tt)
            if not (0 <= tx < W and 0 <= ty < H):
                continue
            b = max(0, 1.0 - ti / 14)
            if ti == 0:
                draw.point((tx, ty), fill=(255, 255, 245))
                for ddx, ddy in [(-1,0),(1,0),(0,-1),(0,1)]:
                    nx2, ny2 = tx+ddx, ty+ddy
                    if 0 <= nx2 < W and 0 <= ny2 < H:
                        draw.point((nx2, ny2), fill=(255, 255, 230))
            elif ti < 5:
                c = (clamp(int(255*b),0,255), clamp(int(240*b),0,255), clamp(int(180*b),0,255))
                draw.point((tx, ty), fill=c)
            else:
                if random.random() < 0.55:
                    c = (clamp(int(180*b),0,255), clamp(int(150*b),0,255), clamp(int(240*b),0,255))
                    draw.point((tx, ty), fill=c)
        for _ in range(4):
            twx, twy = random.randint(0, W-1), random.randint(0, H-1)
            if random.random() < 0.25:
                draw.point((twx, twy), fill=(90, 90, 170))
        frames.append(img)
    for _ in range(5):
        frames.append(Image.new("RGB", (W, H), BG))

    buf = BytesIO()
    frames[0].save(buf, format="GIF", save_all=True,
                    append_images=frames[1:], duration=55, loop=0, optimize=False)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _load_font(size=12):
    candidates = [
        "/System/Library/Fonts/AppleSDGothicNeo.ttc",
        "/System/Library/Fonts/Menlo.ttc",
        "/System/Library/Fonts/Courier.dfont",
    ]
    for p in candidates:
        if Path(p).exists():
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
    return ImageFont.load_default()


def _pick_font(text):
    for size in (16, 15, 14, 13, 12, 11, 10):
        font = _load_font(size)
        img_temp = Image.new("RGB", (1, 1), BG)
        bbox = ImageDraw.Draw(img_temp).textbbox((0, 0), text, font=font)
        tw = bbox[2] - bbox[0]
        th = bbox[3] - bbox[1]
        if th <= 16 and tw <= W:
            return font, tw, th
    font = _load_font(9)
    img_temp = Image.new("RGB", (1, 1), BG)
    bbox = ImageDraw.Draw(img_temp).textbbox((0, 0), text, font=font)
    return font, bbox[2] - bbox[0], bbox[3] - bbox[1]


def _sanitize_text(text):
    result = []
    for ch in text:
        cp = ord(ch)
        if 0x20 <= cp <= 0x7E or 0xA0 <= cp <= 0xFF:
            result.append(ch)
        elif cp in (0x2018, 0x2019, 0x201C, 0x201D):
            result.append(ch)
    return "".join(result)


def render_text(text):
    """滚动文字动画"""
    text = _sanitize_text(text)
    font, tw, th = _pick_font(text)
    strip_w = W * 2 + tw
    strip = Image.new("RGB", (strip_w, H), BG)
    sd = ImageDraw.Draw(strip)
    bbox = sd.textbbox((0, 0), text, font=font)
    text_offset_y = (H - (bbox[3] - bbox[1])) // 2 - bbox[1]
    sd.text((W, text_offset_y), text, fill=TEXT_COLOR, font=font)

    frames = []
    step = 2
    for offset in range(0, strip_w - W + step, step):
        crop = strip.crop((offset, 0, offset + W, H))
        frames.append(crop)
    gap = Image.new("RGB", (W, H), BG)
    for _ in range(6):
        frames.append(gap)

    buf = BytesIO()
    frames[0].save(buf, format="GIF", save_all=True,
                    append_images=frames[1:], duration=80, loop=0, optimize=False)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def render_combo(text):
    """组合：居中文字"""
    text = _sanitize_text(text)
    font, tw, th = _pick_font(text)
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    text_x = (W - tw) // 2
    text_y = (H - th) // 2
    draw.text((text_x, text_y), text, fill=TEXT_COLOR, font=font)
    buf = BytesIO()
    img.save(buf, format="GIF", loop=0)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="渲染应援灯牌 GIF")
    parser.add_argument("animation", choices=["heart", "firework", "star", "text", "combo"],
                        help="动画类型")
    parser.add_argument("message", nargs="?", default="I ❤ YOU",
                        help="文字内容（text/combo 模式）")
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    renderers = {
        "heart": lambda: render_heart(),
        "firework": lambda: render_firework(),
        "star": lambda: render_star(),
        "text": lambda: render_text(args.message),
        "combo": lambda: render_combo(args.message),
    }
    b64 = renderers[args.animation]()
    print(b64, end="")

    if args.output:
        raw = base64.b64decode(b64)
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_bytes(raw)
        print(f"\n# 写入 {args.output}", file=sys.stderr)

    print(f"\n# 动画: {args.animation}", file=sys.stderr)


if __name__ == "__main__":
    main()
