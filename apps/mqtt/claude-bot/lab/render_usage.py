#!/usr/bin/env python3
"""渲染 TC002 Claude Bot 限额用量 GIF。

接收两个限额使用率百分比（5 小时窗口、7 天窗口），生成 52x16
动画 GIF，包含 Claude Bot 吉祥物和用量条。

用法：
  python3 lab/render_usage.py <五分钟限额百分比> <七天限额百分比>
  python3 lab/render_usage.py 75 42

输出（stdout）：
  单行 base64 编码的 GIF，可直接嵌入 TC002 Custom App JSON payload。

加 --file PATH 参数会同时将 GIF 写入磁盘。
"""

import sys
import base64
from io import BytesIO
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 52, 16

BG = (0, 0, 0)
BODY = (219, 116, 86)
PUP = (0, 0, 0)
BAR_FRAME = (88, 90, 96)
BAR_OK = (72, 214, 120)
BAR_WARN = (255, 198, 72)
BAR_DANGER = (255, 76, 88)
BAR_TEXT = (236, 242, 248)

TINY_FONT = {
    "0": ["111", "101", "101", "101", "111"],
    "1": ["010", "110", "010", "010", "111"],
    "2": ["110", "001", "010", "100", "111"],
    "3": ["110", "001", "010", "001", "110"],
    "4": ["101", "101", "111", "001", "001"],
    "5": ["111", "100", "110", "001", "110"],
    "6": ["011", "100", "111", "101", "111"],
    "7": ["111", "001", "010", "010", "010"],
    "8": ["111", "101", "111", "101", "111"],
    "9": ["111", "101", "111", "001", "110"],
    "D": ["111", "101", "101", "101", "110"],
    "H": ["101", "101", "111", "101", "101"],
    "K": ["101", "101", "110", "101", "101"],
    "W": ["10001", "10001", "10101", "11011", "10001"],
    "%": ["101", "001", "010", "100", "101"],
    " ": ["000", "000", "000", "000", "000"],
}

# ── Mascot body pixel art (52×16) ────────────────────────────
CLAYOUT = [
    "....................................................",
    ".................################...................",
    ".................################...................",
    ".................################...................",
    ".................################...................",
    ".................##.##########.##...................",
    ".................##.##########.##...................",
    "..............#####################.................",
    "..............#####################.................",
    "..............#####################.................",
    ".................################...................",
    ".................################...................",
    "..................#..#.....#..#.....................",
    "..................#..#.....#..#.....................",
    "..................#..#.....#..#.....................",
    "....................................................",
]

# ── Eye data ────────────────────────────────────────────────
# Left socket columns 18-19 rows 5-6, right socket columns 29-30 rows 5-6
def eyes(xl, xr):
    return ((xl, 5), (xl, 6), (xr, 5), (xr, 6))

EYE_RIGHT = eyes(19, 30)
EYE_LEFT = eyes(18, 29)
EYE_NONE = ()
SLEEP = ((18, 5), (29, 5))


def draw_frame(pupils=EYE_RIGHT, bob=0, ox=0, hide_legs=None):
    """Draw a single 52x16 mascot frame."""
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    for y in range(H):
        py = y + bob
        if not (0 <= py < H):
            continue
        for x in range(W):
            cx = x + ox
            if not (0 <= cx < W):
                continue
            if CLAYOUT[y][x] != "#":
                continue
            if hide_legs and (cx, py) in hide_legs:
                continue
            draw.point((cx, py), fill=BODY)

    # Fill eye sockets with body color
    for sx, sy in ((19, 5), (19, 6), (30, 5), (30, 6)):
        qx, qy = sx + ox, sy + bob
        if 0 <= qx < W and 0 <= qy < H:
            draw.point((qx, qy), fill=BODY)

    # Draw pupils
    for px, py in pupils:
        qx, qy = px + ox, py + bob
        if 0 <= qx < W and 0 <= qy < H:
            draw.point((qx, qy), fill=PUP)

    return img


def draw_tiny_text(img, text, x, y, fill=BAR_TEXT):
    draw = ImageDraw.Draw(img)
    cursor = x
    for char in text:
        glyph = TINY_FONT.get(char.upper(), TINY_FONT[" "])
        for gy, row in enumerate(glyph):
            for gx, value in enumerate(row):
                if value == "1":
                    px, py = cursor + gx, y + gy
                    if 0 <= px < W and 0 <= py < H:
                        draw.point((px, py), fill=fill)
        cursor += len(glyph[0]) + 1


def tiny_text_width(text):
    if not text:
        return 0
    total = 0
    for char in text:
        glyph = TINY_FONT.get(char.upper(), TINY_FONT[" "])
        total += len(glyph[0]) + 1
    return max(0, total - 1)


def bar_color_for_pct(pct):
    """根据限额使用率百分比返回进度条颜色。"""
    if pct >= 90:
        return BAR_DANGER
    if pct >= 70:
        return BAR_WARN
    return BAR_OK


def draw_pct_bar(draw, x, y, width, pct, fill):
    """绘制基于百分比（0-100）的用量进度条。"""
    pct = max(0, min(100, int(pct)))
    draw.rectangle((x, y, x + width - 1, y + 1), outline=BAR_FRAME)
    inner_w = max(0, round((width - 2) * pct / 100))
    if inner_w:
        draw.line((x + 1, y, x + inner_w, y), fill=fill)


def usage_frame(five_hour_pct, seven_day_pct, pupils=EYE_RIGHT, bob=0):
    """绘制一帧用量显示动画。
    five_hour_pct: 5 小时窗口限额使用率（0-100）
    seven_day_pct: 7 天窗口限额使用率（0-100）
    """
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    mascot = draw_frame(pupils, bob=bob, ox=13)
    img.paste(mascot.crop((25, 0, W, H)), (25, 0))

    five_hour_pct = max(0, min(100, int(five_hour_pct)))
    seven_day_pct = max(0, min(100, int(seven_day_pct)))

    day_label = f"{five_hour_pct}%"
    week_label = f"{seven_day_pct}%"

    draw_tiny_text(img, "5H", 1, 0)
    draw_tiny_text(img, day_label, 24 - tiny_text_width(day_label), 0)
    draw_pct_bar(draw, 1, 6, 23, five_hour_pct, bar_color_for_pct(five_hour_pct))

    draw_tiny_text(img, "7d", 1, 9)
    draw_tiny_text(img, week_label, 24 - tiny_text_width(week_label), 9)
    draw_pct_bar(draw, 1, 14, 23, seven_day_pct, bar_color_for_pct(seven_day_pct))
    return img


def render_usage_gif(five_hour_pct, seven_day_pct):
    """生成动画用量 GIF 并返回 base64 字符串。
    five_hour_pct: 5 小时窗口限额使用率（0-100）
    seven_day_pct: 7 天窗口限额使用率（0-100）
    """
    five_hour_pct = max(0, min(100, int(five_hour_pct)))
    seven_day_pct = max(0, min(100, int(seven_day_pct)))

    frames = [
        (usage_frame(five_hour_pct, seven_day_pct, EYE_RIGHT, 0), 700),
        (usage_frame(five_hour_pct, seven_day_pct, EYE_LEFT, 0), 520),
        (usage_frame(five_hour_pct, seven_day_pct, EYE_NONE, 0), 160),
        (usage_frame(five_hour_pct, seven_day_pct, EYE_RIGHT, -1), 520),
        (usage_frame(five_hour_pct, seven_day_pct, EYE_LEFT, 0), 620),
    ]

    buf = BytesIO()
    frames[0][0].save(
        buf,
        format="GIF",
        save_all=True,
        append_images=[frame for frame, _duration in frames[1:]],
        duration=[duration for _frame, duration in frames],
        loop=0,
        optimize=False,
    )
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--file")]
    file_path = None
    for a in sys.argv[1:]:
        if a.startswith("--file="):
            file_path = a.split("=", 1)[1]
        elif a == "--file":
            idx = sys.argv.index("--file")
            if idx + 1 < len(sys.argv):
                file_path = sys.argv[idx + 1]

    if len(args) < 2:
        print("Usage: python3 lab/render_usage.py <five_hour_pct> <seven_day_pct> [--file PATH]",
              file=sys.stderr)
        sys.exit(1)

    five_hour_pct = int(args[0])
    seven_day_pct = int(args[1])

    b64 = render_usage_gif(five_hour_pct, seven_day_pct)
    print(b64, end="")

    if file_path:
        raw = base64.b64decode(b64)
        Path(file_path).parent.mkdir(parents=True, exist_ok=True)
        Path(file_path).write_bytes(raw)
        print(f"\n# Wrote GIF to {file_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
