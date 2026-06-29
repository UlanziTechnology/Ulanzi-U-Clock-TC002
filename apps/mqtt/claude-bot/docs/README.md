# TC002 Claude Bot

> **新用户？** 从 [快速入门指南](QUICKSTART.md) 开始，5 分钟内让 TC002 显示 Claude Code 真实剩余用量。

## 简介

众所周知，当 5H 7D 剩余用量还有 100% 时，我们就如同刚注射 V1 的 Homelander 一般，战力突破天际；当Claude Code 用量耗尽，Homelander 也只能跪地求 Butcher 饶命（“Plz! More Token!"）。本 App 把 Ulanzi U-Clock TC002（又名 U-Clock/Pixbar）变成了Claude Code 伴侣，右侧 Claude Bot 吉祥物陪你 Vibe Coding，左侧**实时显示 Claude Code 的 5H/7D 剩余用量**。

**作者**：王行知

### 显示效果

| 标签 | 含义 |
|---|---|
| `5H` | 5 小时窗口限额使用率 (%) |
| `7d` | 7 天窗口限额使用率 (%) |

颜色阈值：

| 范围 | 颜色 | 含义 |
|---|---|---|
| < 70% | 绿色 | 正常 |
| 70–90% | 黄色 | 注意 |
| > 90% | 红色 | 危险 |

## 预览

见 `preview/demo.gif`（循环动画）和 `preview/demo_usage.gif`（限额显示）。

## 依赖

- Python 3 + Pillow（`pip install pillow`）— 用于渲染 GIF
- mosquitto_pub（`brew install mosquitto`）— 用于 MQTT 发布
- MQTT broker（TC002 和你的电脑都能访问）
- TC002 设备已连接 Wi-Fi 并配置了 MQTT

## 安装

1. 在 `~/.claude/settings.json` 中添加：

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node /path/to/lab/claude_statusline_bridge.js"
     }
   }
   ```

2. 在 `~/.zshrc` 中添加环境变量：

   ```bash
   export TC002_MQTT_HOST=<你的MQTT broker地址>
   export TC002_MQTT_TOPIC=<你的设备topic>
   ```

3. 重启 Claude Code，每次响应后会自动更新 TC002 显示。

> **完整安装步骤**：见 [QUICKSTART.md](QUICKSTART.md) 或 [USAGE_INTEGRATION.md](USAGE_INTEGRATION.md)

## 真实用量接入

### 数据流

```text
Claude Code statusLine hook
  → claude_statusline_bridge.js（提取 5h/7d 限额百分比）
  → render_usage.py（渲染 52×16 GIF）
  → mosquitto_pub（MQTT 发布）
  → TC002 显示 Claude Bot + 真实限额使用率
```

### 手动测试

```bash
cd apps/mqtt/claude-bot

# 从状态文件读取并发布：
TC002_MQTT_HOST=<你的broker地址> bash lab/publish_usage.sh
```

### 脚本说明

| 脚本 | 职责 |
|---|---|
| `lab/claude_statusline_bridge.js` | 接收 statusLine JSON，提取限额，渲染并发布 |
| `lab/render_usage.py` | 接收百分比，渲染 base64 GIF |
| `lab/publish_usage.sh` | 从状态文件读取并发布到 MQTT |

## 工作原理

```text
Claude Code statusLine hook
  → claude_statusline_bridge.js
    → 提取 rate_limits.five_hour.used_percentage
    → 提取 rate_limits.seven_day.used_percentage
    → render_usage.py 渲染 52×16 GIF
    → mosquitto_pub 发布到 TC002
  → TC002 显示 Claude Bot + 真实限额使用率
```

## 配置项

| 配置项 | 说明 |
|---|---|
| `TC002_MQTT_HOST` | MQTT broker 地址 |
| `TC002_MQTT_TOPIC` | 设备 topic，格式：`[prefix]_[mac后四位]/custom/claude_bot` |
| `TC002_DURATION` | 显示时长（秒），默认 31536000（一年，保持常亮） |

## MQTT Payload

本应用发布 TC002 Custom App JSON payload。图片通过 `image` 字段以内嵌 base64 data URL 的方式发送，不需要单独上传图片，也不需要外部图床。

示例结构：

```json
{
  "duration": 86400,
  "text": [],
  "image": [
    {
      "data": "data:image/gif;base64,...",
      "position": [0, 0]
    }
  ],
  "draw": []
}
```

## 真机测试

详细步骤见 `HOME_ASSISTANT_TESTING.md`。

快速检查流程：

1. 查看 TC002 当前 IP 和 MQTT 配置：

   ```bash
   curl http://<TC002_IP>/getBase
   curl http://<TC002_IP>/getMqttConfig
   ```

2. 确认 topic。比如 MQTT 前缀为 `ulanzi`，设备 MAC 后四位为 `1bf6`，则 topic 为：

   ```text
   ulanzi_1bf6/custom/claude_bot
   ```

3. 确认 TC002 当前正在显示对应的 Custom App，例如 `claude_bot`。

4. 发布真实数据：

   ```bash
   cd apps/mqtt/claude-bot
   bash lab/publish_usage.sh
   ```

## 已知问题

- TC002 收到 Custom App 更新后，不一定会自动切换到该 App。测试时建议先在设备上手动切到目标 Custom App，或者发布到当前正在显示的 App 名。
- 用手机相机录制 TC002 时，视频里可能出现频闪或横向滚动暗纹。这通常是 LED 点阵扫描刷新 / PWM 调光与相机快门不同步导致的，不一定代表肉眼看到的画面也在闪。
- TC002 的 MQTT topic 规则可能随官方固件变化，topic 已做成可配置项。

## 许可证

GPL-3.0-or-later。
