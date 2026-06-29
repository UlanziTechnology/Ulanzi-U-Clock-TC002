# TC002 Claude Bot — 真机测试指南

本文说明如何在真实 TC002（U-Clock）设备上测试 `claude-bot`，验证真实 Claude Code 限额显示。

## 1. 基本概念

```text
Claude Code → statusLine hook → MQTT broker → TC002
```

## 2. MQTT broker

需要一个 TC002 和你的电脑都能访问的 MQTT broker。

Mac 本地测试：

```bash
brew install mosquitto
brew services start mosquitto
```

## 3. 配置 TC002 MQTT

在 TC002 的 MQTT 设置里填写：

```text
Broker host: <broker IP>
Broker port: 1883
MQTT prefix: ulanzi
```

查看 TC002 当前配置：

```bash
curl http://<TC002_IP>/getMqttConfig
```

## 4. Custom App topic

格式：

```text
[PREFIX]/custom/[APP_NAME]
```

示例：

```text
ulanzi_1bf6/custom/claude_bot
```

## 5. 测试 MQTT 连接

```bash
# 测试屏幕变绿（验证连接）
mosquitto_pub -h <BROKER_IP> -t ulanzi_1bf6/custom/claude_bot \
  -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

## 6. 配置 statusLine hook

1. 在 `~/.claude/settings.json` 中添加：

   ```json
   {
     "statusLine": {
       "type": "command",
       "command": "node /path/to/Ulanzi-U-Clock-TC002/apps/mqtt/claude-bot/lab/claude_statusline_bridge.js"
     }
   }
   ```

2. 重启 Claude Code，发送任意消息后自动触发 hook。

3. 查看状态文件验证：

   ```bash
   cat /tmp/claude-statusline-state.json
   ```

## 7. 测试真实用量显示

```bash
cd apps/mqtt/claude-bot

# 从状态文件读取并发布：
TC002_MQTT_HOST=<broker IP> bash lab/publish_usage.sh
```

TC002 应该显示 Claude Bot + 5H:XX% / 7d:XX%（真实限额数据）。

## 8. 分步调试

```bash
# 1. 手动渲染（不发布）
python3 lab/render_usage.py 50 30 --file /tmp/claude_bot_usage.gif

# 2. 用渲染出的 base64 手动发布
python3 lab/render_usage.py 50 30 | xargs -I{} mosquitto_pub \
  -h <BROKER_IP> -t ulanzi_1bf6/custom/claude_bot \
  -m '{"duration":31536000,"text":[],"image":[{"data":"data:image/gif;base64,{}","position":[0,0]}],"draw":[]}'
```

## 9. 轮询模式

```bash
TC002_MQTT_HOST=<broker IP> bash lab/publish_usage.sh --loop 300
```

## 10. 排障

### MQTT 发布成功但 TC002 不变化

- 确认 TC002 和 broker 在同一局域网
- 确认 topic 前缀匹配设备 MAC 后四位
- 手动在 TC002 上切换到目标 Custom App

### broker 正常但 TC002 收不到

- 检查 macOS 防火墙
- 检查路由器 AP 隔离
