# TC002 应援灯牌

> **新用户？** 见 [QUICKSTART.md](QUICKSTART.md)

## 简介

把 TC002（U-Clock）变成表白神器 / 演唱会应援灯牌。

- 心跳动画
- 烟花绽放
- 流星划过
- 自定义滚动文字

**作者**：王行知

## 预览

见 `preview/` 目录下的 GIF

## 依赖

- Python 3 + Pillow（`pip install pillow`）
- mosquitto_pub（`brew install mosquitto`）
- MQTT broker（TC002 和你的电脑都能访问）

## 安装

1. 在 `~/.zshrc` 中添加环境变量：

   ```bash
   export TC002_MQTT_HOST=<你的MQTT broker地址>
   export TC002_MQTT_TOPIC=ulanzi_1bf6/custom/love_confession
   ```

## 手动测试

```bash
cd apps/mqtt/love-confession

# 心跳动画：
B64=$(python3 lab/render_confession.py heart) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 烟花动画：
B64=$(python3 lab/render_confession.py firework) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 流星动画：
B64=$(python3 lab/render_confession.py star) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 滚动文字：
B64=$(python3 lab/render_confession.py text "I LOVE YOU") && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## MQTT Payload

```json
{
  "duration": 31536000,
  "text": [],
  "image": [{"data": "data:image/gif;base64,...", "position": [0, 0]}],
  "draw": []
}
```

## 已知问题

- TC002 收到 Custom App 更新后，不一定会自动切换到该 App。

## 许可证

GPL-3.0-or-later。
