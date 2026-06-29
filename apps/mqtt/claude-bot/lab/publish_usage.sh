#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# TC002 Claude Bot — 限额用量发布脚本
# ─────────────────────────────────────────────────────────────
# 从 Claude Code statusLine 状态文件或手动输入读取限额百分比，
# 渲染 52x16 限额用量 GIF，并通过 MQTT 发布到 TC002 Custom App。
#
# 两种模式：
#   1. 从状态文件读取（由 claude_statusline_bridge.js 写入）
#   2. 手动传入两个百分比参数
#
# 依赖：
#   - Python 3 + Pillow（pip install pillow）
#   - mosquitto_pub（brew install mosquitto）
#
# 环境变量：
#   TC002_MQTT_HOST                MQTT broker 地址（默认：127.0.0.1）
#   TC002_MQTT_PORT                MQTT broker 端口（默认：1883）
#   TC002_MQTT_TOPIC               Custom App topic（默认：ulanzi_1bf6/custom/claude_bot）
#   TC002_DURATION                 payload 显示时长，单位秒（默认：86400）
#   TC002_STATE_FILE               状态文件路径（默认：/tmp/claude-statusline-state.json）
#
# 用法：
#   # 从状态文件读取（推荐）：
#   TC002_MQTT_HOST=10.19.1.58 bash lab/publish_usage.sh
#
#   # 手动传入百分比：
#   bash lab/publish_usage.sh 75 42
#
#   # 轮询模式（每 300 秒读取一次状态文件）：
#   bash lab/publish_usage.sh --loop 300
# ─────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# ── 配置项 ──────────────────────────────────────────────────
MQTT_HOST="${TC002_MQTT_HOST:-127.0.0.1}"
MQTT_PORT="${TC002_MQTT_PORT:-1883}"
MQTT_TOPIC="${TC002_MQTT_TOPIC:-ulanzi_1bf6/custom/claude_bot}"
DURATION="${TC002_DURATION:-31536000}"  # 默认一年，保持常亮
STATE_FILE="${TC002_STATE_FILE:-/tmp/claude-statusline-state.json}"

# ── 帮助信息 ────────────────────────────────────────────────
if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  cat <<EOF
用法: bash lab/publish_usage.sh [五分钟限额百分比 七天限额百分比] [--loop 秒数]

通过 MQTT 将 Claude Code 限额使用率发布到 TC002。

如果不传参数：从状态文件读取（由 claude_statusline_bridge.js 写入）。
如果传两个数字：直接作为五分钟和七天限额百分比。

可选环境变量：
  TC002_MQTT_HOST    （默认：127.0.0.1）
  TC002_MQTT_PORT    （默认：1883）
  TC002_MQTT_TOPIC   （默认：ulanzi_1bf6/custom/claude_bot）
  TC002_DURATION     （默认：86400）
  TC002_STATE_FILE   （默认：/tmp/claude-statusline-state.json）

选项：
  --loop 秒数        持续运行，每隔指定秒数发布一次
EOF
  exit 0
fi

# ── 检查依赖 ────────────────────────────────────────────────
for cmd in python3 mosquitto_pub; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ 缺少依赖：$cmd" >&2
    exit 1
  fi
done

# ── 从状态文件读取限额百分比 ─────────────────────────────────
read_from_state_file() {
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "⚠️  状态文件不存在：$STATE_FILE" >&2
    echo "   请先运行 claude_statusline_bridge.js，或手动传入百分比。" >&2
    return 1
  fi
  python3 -c "
import sys, json
with open('$STATE_FILE') as f:
    state = json.load(f)
rl = state.get('rate_limits', {})
print(rl.get('five_hour_pct', 0))
print(rl.get('seven_day_pct', 0))
"
}

# ── 渲染限额用量 GIF ────────────────────────────────────────
render_gif() {
  local five_hour_pct="$1"
  local seven_day_pct="$2"
  echo "🎨 渲染限额用量 GIF（5H:${five_hour_pct}% 7d:${seven_day_pct}%）..." >&2
  python3 "$SCRIPT_DIR/render_usage.py" "$five_hour_pct" "$seven_day_pct"
}

# ── 通过 MQTT 发布 ──────────────────────────────────────────
publish_mqtt() {
  local b64="$1"
  local payload
  payload=$(cat <<EOP
{"duration":$DURATION,"text":[],"image":[{"data":"data:image/gif;base64,$b64","position":[0,0]}],"draw":[]}
EOP
  )
  echo "📤 发布到 $MQTT_TOPIC..." >&2
  mosquitto_pub -h "$MQTT_HOST" -p "$MQTT_PORT" -t "$MQTT_TOPIC" -m "$payload"
  echo "✅ 已发布到 $MQTT_TOPIC" >&2
}

# ── 主流程 ──────────────────────────────────────────────────
run_once_manual() {
  local five_hour_pct="$1"
  local seven_day_pct="$2"
  local b64
  b64=$(render_gif "$five_hour_pct" "$seven_day_pct")
  publish_mqtt "$b64"
}

run_once_from_state() {
  local limits
  limits=$(read_from_state_file) || return 1
  local five_hour_pct seven_day_pct
  five_hour_pct=$(echo "$limits" | head -1)
  seven_day_pct=$(echo "$limits" | tail -1)
  echo "📊 限额使用率：5H=${five_hour_pct}% 7d=${seven_day_pct}%" >&2
  local b64
  b64=$(render_gif "$five_hour_pct" "$seven_day_pct")
  publish_mqtt "$b64"
}

# ── 入口 ────────────────────────────────────────────────────
if [[ $# -ge 2 && "$1" != "--loop" ]]; then
  run_once_manual "$1" "$2"
  shift 2
else
  run_once_from_state
fi

# 可选轮询模式
if [[ "${1:-}" == "--loop" ]]; then
  LOOP_SECONDS="${2:-300}"
  echo "🔁 每隔 ${LOOP_SECONDS} 秒轮询一次（Ctrl+C 停止）..." >&2
  while true; do
    sleep "$LOOP_SECONDS"
    run_once_from_state || echo "⚠️  本轮失败，下轮重试。" >&2
  done
fi
