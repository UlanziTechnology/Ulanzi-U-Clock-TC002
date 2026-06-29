#!/usr/bin/env python3
"""渲染 CI 状态看板 GIF 用于 TC002 MQTT 发布。

从 GitHub Actions API 获取最新运行状态，显示绿色/黄色/红色状态灯。

用法：
  python3 lab/render_ci_status.py --repo UlanziTechnology/Ulanzi-U-Clock-TC002
  python3 lab/render_ci_status.py --status success --message "Fix bug"

输出：
  stdout 输出 base64 编码的 GIF
"""

import base64
import json
import os
import sys
import urllib.request
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image, ImageDraw
except ImportError:
    print("需要安装 Pillow: pip install pillow", file=sys.stderr)
    sys.exit(1)

W, H = 52, 16
BG = (0, 0, 0)
FG = (238, 244, 255)
GREEN = (72, 214, 120)
YELLOW = (255, 198, 72)
RED = (255, 76, 88)

PIXEL_FONT = {
    "C": ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    "P": ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "S": ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "U": ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    "N": ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    "F": ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
}


def pixel_glyph(char):
    return PIXEL_FONT.get(char.upper()) or PIXEL_FONT[" "]


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


def github_json(url, token=None):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "tc002-ci-status-board"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=8) as response:
        return json.loads(response.read().decode("utf-8"))


def fetch_github(owner_repo, token=None):
    base = f"https://api.github.com/repos/{owner_repo}"
    runs = github_json(f"{base}/actions/runs?per_page=1", token).get("workflow_runs", [])
    commits = github_json(f"{base}/commits?per_page=1", token)
    run = runs[0] if runs else {}
    commit = commits[0] if commits else {}
    status = "unknown"
    if run:
        if run.get("status") != "completed":
            status = "running"
        elif run.get("conclusion") == "success":
            status = "success"
        else:
            status = "failure"
    message = commit.get("commit", {}).get("message", "No commit").splitlines()[0]
    return {"status": status, "message": message, "repo": owner_repo}


def color_for(status):
    return GREEN if status == "success" else YELLOW if status == "running" else RED


def render_status(data):
    img = Image.new("RGB", (W, H), BG)
    color = color_for(data["status"])
    draw = ImageDraw.Draw(img)
    # 左侧状态方块
    draw.rectangle((0, 0, 15, 15), fill=color)
    draw_pixel_text(img, "CI", 2, 4, fill=BG)
    # 右侧状态文字
    label = "PASS" if data["status"] == "success" else "RUN" if data["status"] == "running" else "FAIL"
    draw_pixel_text(img, label, 19, 4, fill=FG)
    return img


def render_gif(data):
    img = render_status(data)
    buf = BytesIO()
    img.save(buf, format="GIF", loop=0)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="渲染 CI 状态看板 GIF")
    parser.add_argument("--repo", default=os.environ.get("GITHUB_REPO", ""), help="owner/repo")
    parser.add_argument("--token", default=os.environ.get("GITHUB_TOKEN", ""))
    parser.add_argument("--status", choices=["success", "failure", "running"], default=None)
    parser.add_argument("--message", default=None)
    parser.add_argument("--output", default=None)
    args = parser.parse_args()

    if args.status:
        data = {"status": args.status, "message": args.message or "Demo", "repo": "demo"}
    elif args.repo:
        try:
            data = fetch_github(args.repo, token=args.token or None)
        except Exception as e:
            print(f"获取 GitHub 数据失败: {e}", file=sys.stderr)
            data = {"status": "unknown", "message": str(e), "repo": args.repo}
    else:
        data = {"status": "running", "message": "Set GITHUB_REPO=owner/repo", "repo": "not configured"}

    b64 = render_gif(data)
    print(b64, end="")

    if args.output:
        raw = base64.b64decode(b64)
        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        Path(args.output).write_bytes(raw)
        print(f"\n# 写入 {args.output}", file=sys.stderr)

    print(f"\n# 仓库: {data['repo']} 状态: {data['status']} 信息: {data['message'][:50]}", file=sys.stderr)


if __name__ == "__main__":
    main()
