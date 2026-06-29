#!/usr/bin/env python3
"""渲染单词轮播 GIF 用于 TC002 MQTT 发布。

从 CSV/Excel 词表读取单词，用像素字体渲染英文，用系统字体渲染中文释义。

用法：
  python3 lab/render_vocabulary.py --word hello
  python3 lab/render_vocabulary.py --count 3
  python3 lab/render_vocabulary.py --all

输出：
  stdout 输出 base64 编码的 GIF
"""

import base64
import csv
import random
import re
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
FG = (238, 244, 255)
GOLD = (255, 210, 92)
ACCENT = (104, 225, 255)
WORD_HOLD_MS = 3200
MEANING_SCROLL_MS = 150
MEANING_SCROLL_STEP = 3

FONT_CANDIDATES = [
    "/System/Library/Fonts/STHeiti Medium.ttc",
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/Library/Fonts/Arial Unicode.ttf",
]

PIXEL_FONT = {
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "G": ["01111", "10000", "10000", "10011", "10001", "10001", "01111"],
    "H": ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "K": ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    "M": ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "Q": ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "V": ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
    "W": ["10001", "10001", "10001", "10101", "10101", "10101", "01010"],
    "X": ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
    "Y": ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    "Z": ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
    "a": ["00000", "00000", "01110", "00001", "01111", "10001", "01111"],
    "b": ["10000", "10000", "10110", "11001", "10001", "10001", "11110"],
    "c": ["00000", "00000", "01111", "10000", "10000", "10000", "01111"],
    "d": ["00001", "00001", "01101", "10011", "10001", "10001", "01111"],
    "e": ["00000", "00000", "01110", "10001", "11111", "10000", "01110"],
    "f": ["00110", "01000", "01000", "11100", "01000", "01000", "01000"],
    "g": ["00000", "00000", "01111", "10001", "01111", "00001", "01110"],
    "h": ["10000", "10000", "10110", "11001", "10001", "10001", "10001"],
    "i": ["00100", "00000", "01100", "00100", "00100", "00100", "01110"],
    "j": ["00010", "00000", "00110", "00010", "00010", "10010", "01100"],
    "k": ["10000", "10000", "10010", "10100", "11000", "10100", "10010"],
    "l": ["01100", "00100", "00100", "00100", "00100", "00100", "01110"],
    "m": ["00000", "00000", "11010", "10101", "10101", "10101", "10101"],
    "n": ["00000", "00000", "10110", "11001", "10001", "10001", "10001"],
    "o": ["00000", "00000", "01110", "10001", "10001", "10001", "01110"],
    "p": ["00000", "00000", "11110", "10001", "11110", "10000", "10000"],
    "q": ["00000", "00000", "01111", "10001", "01111", "00001", "00001"],
    "r": ["00000", "00000", "10110", "11001", "10000", "10000", "10000"],
    "s": ["00000", "00000", "01111", "10000", "01110", "00001", "11110"],
    "t": ["01000", "01000", "11100", "01000", "01000", "01000", "00110"],
    "u": ["00000", "00000", "10001", "10001", "10001", "10011", "01101"],
    "v": ["00000", "00000", "10001", "10001", "10001", "01010", "00100"],
    "w": ["00000", "00000", "10001", "10001", "10101", "10101", "01010"],
    "x": ["00000", "00000", "10001", "01010", "00100", "01010", "10001"],
    "y": ["00000", "00000", "10001", "10001", "01111", "00001", "01110"],
    "z": ["00000", "00000", "11111", "00010", "00100", "01000", "11111"],
    "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
    "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
    "2": ["01110", "10001", "00001", "00010", "00100", "01000", "11111"],
    "3": ["11110", "00001", "00001", "01110", "00001", "00001", "11110"],
    "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
    "5": ["11111", "10000", "10000", "11110", "00001", "00001", "11110"],
    "6": ["01110", "10000", "10000", "11110", "10001", "10001", "01110"],
    "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
    "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
    "9": ["01110", "10001", "10001", "01111", "00001", "00001", "01110"],
    "-": ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def load_font(size):
    for font_path in FONT_CANDIDATES:
        if Path(font_path).exists():
            return ImageFont.truetype(font_path, size)
    return ImageFont.load_default()


def pixel_glyph(char):
    return PIXEL_FONT.get(char) or PIXEL_FONT.get(char.lower()) or PIXEL_FONT[" "]


def pixel_text_width(text, spacing=1):
    width = 0
    for i, ch in enumerate(text):
        width += len(pixel_glyph(ch)[0])
        if i != len(text) - 1:
            width += spacing
    return width


def draw_pixel_text(img, text, x, y, fill=FG):
    draw = ImageDraw.Draw(img)
    cursor = x
    for ch in text:
        glyph = pixel_glyph(ch)
        for gy, row in enumerate(glyph):
            for gx, val in enumerate(row):
                if val == "1":
                    px, py = cursor + gx, y + gy
                    if 0 <= px < W and 0 <= py < H:
                        draw.point((px, py), fill=fill)
        cursor += len(glyph[0]) + 1


def clean_meaning(text):
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        if re.search(r"^(时\s*态|副\s*词|名\s*词|形容词|动词)\s*:", line):
            continue
        line = re.sub(r"^[-*•]\s*", "", line)
        line = re.sub(r"\s+", " ", line)
        lines.append(line)
    if not lines:
        return text.strip()
    return "；".join(lines[:2])[:42]


def parse_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_words(path, limit=None):
    if not path.exists():
        raise FileNotFoundError(f"词表文件不存在: {path}")
    if path.suffix.lower() == ".csv":
        records = parse_csv(path)
    else:
        raise ValueError("只支持 .csv 文件")

    if not records:
        raise ValueError("词表为空")

    headers = list(records[0].keys())
    word_col = None
    meaning_col = None
    for h in headers:
        hl = h.lower().strip()
        if hl in ("单词", "word", "english", "vocabulary", "term"):
            word_col = h
        if hl in ("解释", "释义", "中文", "meaning", "definition", "translation"):
            meaning_col = h

    if not word_col or not meaning_col:
        raise ValueError(f"找不到单词/释义列。表头: {headers}")

    words = []
    for record in records:
        word = record.get(word_col, "").strip()
        meaning = clean_meaning(record.get(meaning_col, "").strip())
        if word and meaning:
            words.append({"word": word, "meaning": meaning})
        if limit and len(words) >= limit:
            break

    if not words:
        raise ValueError("没有可用的单词")
    return words


def pick_words(words, count=1, show_all=False, seed=None, word=None):
    if word:
        needle = word.strip().lower()
        matches = [e for e in words if e["word"].strip().lower() == needle]
        if not matches:
            raise ValueError(f'单词未找到: "{word}"')
        return matches[:1]
    if show_all or count <= 0 or count >= len(words):
        return words
    rng = random.Random(seed) if seed is not None else random
    return rng.sample(words, count)


def render_word_card(entry):
    img = Image.new("RGB", (W, H), BG)
    width = pixel_text_width(entry["word"])
    x = max(0, (W - width) // 2)
    draw_pixel_text(img, entry["word"], x, 4, fill=FG)
    draw = ImageDraw.Draw(img)
    draw.point((0, 15), fill=ACCENT)
    draw.point((51, 15), fill=ACCENT)
    return img


def render_text_scroll(text, font, fill, hold_ms=130, scroll_step=2):
    measure = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    bbox = measure.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    strip_width = W * 2 + text_w
    strip = Image.new("RGB", (strip_width, H), BG)
    draw = ImageDraw.Draw(strip)
    y = max(-2, (H - text_h) // 2 - 1)
    draw.text((W, y), text, font=font, fill=fill)
    frames = []
    for offset in range(0, max(0, strip_width - W) + 1, scroll_step):
        frames.append((strip.crop((offset, 0, offset + W, H)), hold_ms))
    return frames


def render_vocabulary_gif(words):
    font = load_font(11)
    frames = []
    for entry in words:
        frames.append((render_word_card(entry), WORD_HOLD_MS))
        frames.extend(render_text_scroll(entry["meaning"], font, GOLD,
                                          hold_ms=MEANING_SCROLL_MS,
                                          scroll_step=MEANING_SCROLL_STEP))
    images = [f for f, _ in frames]
    durations = [d for _, d in frames]
    buf = BytesIO()
    images[0].save(buf, format="GIF", save_all=True,
                    append_images=images[1:], duration=durations,
                    loop=0, optimize=False)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="渲染单词轮播 GIF")
    parser.add_argument("--word", default=None, help="指定单个单词")
    parser.add_argument("--count", type=int, default=1, help="随机抽取数量")
    parser.add_argument("--all", action="store_true", help="显示全部单词")
    parser.add_argument("--seed", type=int, default=None, help="随机种子")
    parser.add_argument("--source", default=None, help="CSV 词表路径")
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    # 默认词表路径
    if args.source:
        source = Path(args.source)
    else:
        # 尝试多个可能的路径
        candidates = [
            Path(__file__).resolve().parent.parent / "word list.csv",
            Path.home() / "Documents" / "Try_projs" / "Ulanzi_Pixbar_TC002-Apps" / "Pixbar-TC002-Apps" / "apps" / "vocabulary-widget" / "word list.csv",
        ]
        source = None
        for c in candidates:
            if c.exists():
                source = c
                break
        if not source:
            print("错误: 找不到词表文件，请用 --source 指定", file=sys.stderr)
            sys.exit(1)

    all_words = load_words(source)
    words = pick_words(all_words, count=args.count, show_all=args.all,
                       seed=args.seed, word=args.word)
    b64 = render_vocabulary_gif(words)
    print(b64, end="")

    if args.output:
        raw = base64.b64decode(b64)
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_bytes(raw)
        print(f"\n# 写入 {args.output}", file=sys.stderr)

    print(f"\n# 词表: {len(all_words)} 词 选中: {[w['word'] for w in words]}", file=sys.stderr)


if __name__ == "__main__":
    main()
