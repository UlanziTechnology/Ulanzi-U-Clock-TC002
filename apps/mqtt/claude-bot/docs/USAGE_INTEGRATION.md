# Claude Code 用量接入说明

本文说明 `claude-bot` 如何接入真实 Claude Code 限额数据。

> **完整安装指南**：见 [QUICKSTART.md](QUICKSTART.md)

## 数据流

```text
Claude Code statusLine hook
  → claude_statusline_bridge.js（从 stdin 读取 JSON，提取限额百分比）
  → render_usage.py（渲染 52x16 GIF）
  → mosquitto_pub（MQTT 发布到 TC002）
```

## 安装步骤

### 前置条件

- [x] 已安装 Claude Code
- [x] 已安装 Python 3 + Pillow
- [x] 已安装 mosquitto（MQTT 客户端）
- [x] TC002 设备已开机并连接 Wi-Fi
- [x] 知道设备 IP 和 MQTT broker 地址

### 1. 获取设备信息

```bash
# 获取设备基本信息（MAC 地址）
curl http://<设备IP>/getBase

# 获取 MQTT 配置（broker 地址、前缀）
curl http://<设备IP>/getMqttConfig
```

### 2. 计算 MQTT Topic

```
[mqtt_prefix]_[MAC后四位]/custom/claude_bot
```

示例：`ulanzi_1bf6/custom/claude_bot`

### 3. 克隆仓库

```bash
git clone https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002.git
cd Ulanzi-U-Clock-TC002
```

### 4. 配置环境变量

在 `~/.zshrc`（macOS）或 `~/.bashrc`（Linux）末尾添加：

```bash
# TC002 Claude Bot — MQTT 配置
export TC002_MQTT_HOST=<你的MQTT broker地址>
export TC002_MQTT_PORT=1883
export TC002_MQTT_TOPIC=<你的设备topic>
export TC002_DURATION=31536000
```

重新加载：
```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

### 5. 配置 Claude Code statusLine hook

编辑 `~/.claude/settings.json`，添加：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /你的仓库路径/apps/mqtt/claude-bot/lab/claude_statusline_bridge.js"
  }
}
```

### 6. 测试 MQTT 连接

```bash
mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

屏幕变绿 = 连接成功。

### 7. 重启 Claude Code 并验证

```bash
# 重启 Claude Code，发送任意消息，然后检查：
cat /tmp/claude-statusline-state.json
```

### 8. 手动触发一次发布

```bash
cd apps/mqtt/claude-bot
bash lab/publish_usage.sh
```

TC002 应该显示 Claude Bot + 5H:0% / 7d:0%。

## 显示内容

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

## 脚本分工

| 脚本 | 职责 | 可独立使用 |
|---|---|---|
| `claude_statusline_bridge.js` | 接收 statusLine JSON，提取限额，渲染 GIF，发布 MQTT | ✅ |
| `render_usage.py` | 接收百分比，渲染 52×16 动画 GIF，输出 base64 | ✅ |
| `publish_usage.sh` | 从状态文件或手动输入读取百分比，发布 MQTT | ✅ |

## 手动测试

```bash
cd apps/mqtt/claude-bot

# 从状态文件读取并发布（推荐）：
bash lab/publish_usage.sh

# 轮询模式（每 300 秒）：
bash lab/publish_usage.sh --loop 300
```

## MQTT Payload

Bridge 发布的是 TC002 Custom App JSON payload。图片通过 `image` 字段以内嵌 base64 data URL 的方式发送。

示例结构：

```json
{
  "duration": 31536000,
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

`duration` 默认为 31536000 秒（一年），确保画面持续显示不熄屏。

## 常见问题

### Q1: 状态文件显示 0%/0%

**可能原因**：
- Claude 订阅刚重置
- Claude Code 没有正确报告限额（取决于订阅类型）

**验证方法**：
```bash
echo '{"rate_limits":{"five_hour":{"used_percentage":50},"seven_day":{"used_percentage":30}},"model":{"display_name":"test"}}' | node apps/mqtt/claude-bot/lab/claude_statusline_bridge.js
```

### Q2: 屏幕不显示内容

**检查**：
1. 设备 IP 是否正确
2. MQTT broker 地址是否正确
3. Topic 格式是否正确
4. 设备是否切换到 `claude_bot` 这个 Custom App

## 许可证

GPL-3.0-or-later。
