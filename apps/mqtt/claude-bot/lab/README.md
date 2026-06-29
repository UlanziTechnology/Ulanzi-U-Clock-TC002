# 本地测试工具

本目录包含本地测试和真实用量接入脚本，用于开发调试。

> **完整安装指南**：见 [docs/QUICKSTART.md](../docs/QUICKSTART.md)

## 真实 Claude Code 用量接入

本目录的脚本实现完整的实时限额显示，**只显示真实数据**：

```text
Claude Code statusLine hook
  → claude_statusline_bridge.js（接收 stdin JSON，提取限额百分比）
  → render_usage.py（渲染 52x16 限额用量 GIF）
  → mosquitto_pub（MQTT 发布到 TC002）
```

### 快速测试

```bash
cd apps/mqtt/claude-bot

# 从状态文件读取并发布：
TC002_MQTT_HOST=<你的broker地址> bash lab/publish_usage.sh

# 渲染 GIF 到磁盘：
python3 lab/render_usage.py 50 30 --file /tmp/claude_bot_usage.gif
```

### 实时模式（statusLine hook）

1. 配置 Claude Code statusLine hook（详见 `docs/USAGE_INTEGRATION.md`）：

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node /path/to/lab/claude_statusline_bridge.js"
     }
   }
   ```

2. bridge 脚本在每次 Claude Code 响应后自动运行：
   - 从 stdin 提取 `rate_limits.five_hour.used_percentage` 和 `seven_day.used_percentage`
   - 将状态写入 `/tmp/claude-statusline-state.json`
   - 渲染 52x16 GIF 并通过 MQTT 发布到 TC002

3. 轮询模式（每 300 秒读取一次状态文件）：

   ```bash
   bash lab/publish_usage.sh --loop 300
   ```

### 环境变量

| 变量 | 必填 | 默认值 | 说明 |
|---|---|---|---|
| `TC002_MQTT_HOST` | 否 | `127.0.0.1` | MQTT broker 地址 |
| `TC002_MQTT_PORT` | 否 | `1883` | MQTT broker 端口 |
| `TC002_MQTT_TOPIC` | 否 | `ulanzi_1bf6/custom/claude_bot` | Custom App topic |
| `TC002_DURATION` | 否 | `31536000` | 显示时长（秒），默认一年，保持常亮 |
| `TC002_STATE_FILE` | 否 | `/tmp/claude-statusline-state.json` | 状态文件路径 |

### 流程说明

| 步骤 | 脚本 | 功能 |
|---|---|---|
| 1. Hook | `claude_statusline_bridge.js` | 接收 Claude Code statusLine JSON，提取限额百分比，写入状态文件，渲染 GIF，发布 MQTT |
| 1a. 渲染 | `render_usage.py` | 接收两个百分比（0-100），生成 52×16 动画 GIF，输出 base64 |
| 1b. 发布 | `mosquitto_pub` | 将 base64 GIF 包装成 TC002 Custom App JSON payload，发布到 MQTT topic |
| 2. 状态 | `/tmp/claude-statusline-state.json` | bridge 写入限额数据；publish_usage.sh 可从中读取 |

### 用量条颜色编码

| 百分比 | 颜色 | 含义 |
|---|---|---|
| < 70% | 绿色 | 正常 |
| 70–90% | 黄色 | 注意 |
| > 90% | 红色 | 危险 |

### render_usage.py — 独立渲染器

```bash
# 输出 base64 到 stdout：
python3 lab/render_usage.py 50 30

# 同时写入 GIF 文件：
python3 lab/render_usage.py 50 30 --file /tmp/claude_bot_usage.gif
```

需要 Python 3 + Pillow（`pip install pillow`）。

### 旧版脚本（已弃用）

`claude_usage_snapshot.js` 是旧版脚本，通过 `ccusage` 读取 Codex 历史花费。已被 statusLine bridge 取代。

## 为什么用多个脚本

- `claude_statusline_bridge.js` — Claude Code hook，读取 stdin，写入状态文件 + 发布 MQTT
- `render_usage.py` — 纯渲染器，可被其他工具复用
- `publish_usage.sh` — 轻量编排器，从状态文件读取并发布到 MQTT
