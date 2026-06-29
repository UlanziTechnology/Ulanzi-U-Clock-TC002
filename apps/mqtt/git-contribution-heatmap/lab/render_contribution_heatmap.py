#!/usr/bin/env python3
"""渲染 Git 贡献热力图 52×16 GIF 用于 TC002 MQTT 发布。

从 GitHub API 获取用户贡献数据，用 52×7 点阵显示本年度活跃度。

用法：
  python3 lab/render_contribution_heatmap.py --user castlewong
  python3 lab/render_contribution_heatmap.py --demo

输出：
  stdout 输出 base64 编码的 GIF
"""

import base64
import json
import os
import random
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("需要安装 Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

W, H = 52, 16
BG = (0, 0, 0)
GRID_Y = 9
GRID_ROWS = 7
LEVELS = [(0, 0, 0), (0, 58, 26), (0, 100, 44), (0, 154, 70), (42, 214, 126)]
LOGO = (42, 214, 126)

TINY_FONT = {
    "G": ["111", "100", "101", "101", "111"],
    "I": ["111", "010", "010", "010", "111"],
    "T": ["111", "010", "010", "010", "010"],
    "H": ["101", "101", "111", "101", "101"],
    "U": ["101", "101", "101", "101", "111"],
    "B": ["110", "101", "110", "101", "110"],
    " ": ["000", "000", "000", "000", "000"],
}


def tiny_text_width(text):
    total = 0
    for ch in text:
        glyph = TINY_FONT.get(ch.upper(), TINY_FONT[" "])
        total += len(glyph[0]) + 1
    return max(0, total - 1)


def draw_tiny_text(img, text, x, y, fill=LOGO):
    draw = ImageDraw.Draw(img)
    cursor = x
    for ch in text:
        glyph = TINY_FONT.get(ch.upper(), TINY_FONT[" "])
        for gy, row in enumerate(glyph):
            for gx, val in enumerate(row):
                if val == "1":
                    px, py = cursor + gx, y + gy
                    if 0 <= px < W and 0 <= py < H:
                        draw.point((px, py), fill=fill)
        cursor += len(glyph[0]) + 1


def draw_github_mark(draw, x, y):
    pixels = [
        "01010",
        "11111",
        "11111",
        "01110",
        "10101",
    ]
    for row, line in enumerate(pixels):
        for col, value in enumerate(line):
            if value == "1":
                draw.point((x + col, y + row), fill=LOGO)


def year_range(today=None):
    today = today or date.today()
    start = date(today.year, 1, 1)
    end = date(today.year, 12, 31)
    return start, end


def empty_year_values(today=None):
    start, end = year_range(today)
    days = (end - start).days + 1
    return [0 for _ in range(days)]


def github_json(url, token=None):
    import urllib.request
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "tc002-contribution-heatmap"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def github_graphql(query, variables, token):
    import urllib.request
    body = json.dumps({"query": query, "variables": variables}).encode("utf-8")
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "tc002-contribution-heatmap",
    }
    req = urllib.request.Request("https://api.github.com/graphql", data=body, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=10) as response:
        payload = json.loads(response.read().decode("utf-8"))
    if payload.get("errors"):
        raise RuntimeError(payload["errors"][0].get("message", "GitHub GraphQL error"))
    return payload["data"]


def fetch_contribution_calendar(user, token):
    start, end = year_range()
    query = """
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
    """
    data = github_graphql(query, {"login": user, "from": f"{start.isoformat()}T00:00:00Z", "to": f"{end.isoformat()}T23:59:59Z"}, token)
    counts = {}
    weeks = data["user"]["contributionsCollection"]["contributionCalendar"]["weeks"]
    for week in weeks:
        for day in week["contributionDays"]:
            counts[date.fromisoformat(day["date"])] = int(day["contributionCount"])
    values = []
    day = start
    while day <= end:
        values.append(counts.get(day, 0))
        day += timedelta(days=1)
    return values


def fetch_push_counts(user, token=None):
    import urllib.request
    events = github_json(f"https://api.github.com/users/{user}/events/public?per_page=100", token)
    today = datetime.now(timezone.utc).date()
    start, end = year_range(today)
    counts = Counter()
    for event in events:
        if event.get("type") != "PushEvent":
            continue
        created = datetime.fromisoformat(event["created_at"].replace("Z", "+00:00")).date()
        if start <= created <= end:
            counts[created] += len(event.get("payload", {}).get("commits", [])) or 1
    values = []
    day = start
    while day <= end:
        values.append(counts[day])
        day += timedelta(days=1)
    return values


def generate_demo_values():
    rng = random.Random(20260620)
    values = []
    for _ in range(len(empty_year_values())):
        roll = rng.random()
        if roll < 0.55:
            values.append(0)
        elif roll < 0.78:
            values.append(1)
        elif roll < 0.92:
            values.append(rng.randint(2, 4))
        else:
            values.append(rng.randint(5, 11))
    return values


def render(values):
    img = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)
    max_value = max(values) if values else 0
    # 左上角显示 GITHUB 字样
    draw_tiny_text(img, "GITHUB", 1, 1, fill=LOGO)
    for index, value in enumerate(values[:365]):
        x = min(51, index // GRID_ROWS)
        y = GRID_Y + (index % GRID_ROWS)
        if value <= 0:
            continue
        idx = min(4, 1 + int(value / max(1, max_value) * 3))
        draw.point((x, y), fill=LEVELS[idx])
    return img


def render_gif(values):
    img = render(values)
    buf = BytesIO()
    img.save(buf, format="GIF", loop=0)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="渲染 Git 贡献热力图 GIF")
    parser.add_argument("--user", default=os.environ.get("GITHUB_USER", "castlewong"))
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN", ""))
    parser.add_argument("--demo", action="store_true")
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    if args.demo or not args.user:
        values = generate_demo_values()
        source = "demo"
    else:
        try:
            if args.token:
                values = fetch_contribution_calendar(args.user, args.token)
                source = "graphql"
            else:
                values = fetch_push_counts(args.user)
                source = "public_events"
        except Exception as e:
            print(f"获取 GitHub 数据失败: {e}", file=sys.stderr)
            print("使用 demo 数据", file=sys.stderr)
            values = generate_demo_values()
            source = "demo"

    b64 = render_gif(values)
    print(b64, end="")

    if args.output:
        raw = base64.b64decode(b64)
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_bytes(raw)
        print(f"\n# 写入 {args.output}", file=sys.stderr)

    print(f"\n# 用户: {args.user} 年度总提交: {sum(values)} 来源: {source}", file=sys.stderr)


if __name__ == "__main__":
    main()
