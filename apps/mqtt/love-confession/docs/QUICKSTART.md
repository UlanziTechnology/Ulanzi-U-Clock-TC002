# TC002 应援灯牌 — 快速入门

5 分钟内让 TC002 显示心跳/烟花/流星动画。

## 前置条件

- [x] 已安装 Python 3 + Pillow
- [x] 已安装 mosquitto
- [x] TC002 设备已开机并连接 Wi-Fi

## 第一步：获取设备信息

```bash
curl http://<设备IP>/getBase
curl http://<设备IP>/getMqttConfig
```

## 第二步：计算 MQTT Topic

```
[mqtt_prefix]_[MAC后四位]/custom/love_confession
```

## 第三步：测试 MQTT 连接

```bash
mosquitto_pub -h <broker地址> -t <你的topic> -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#FF306E"]}]}'
```

屏幕变粉红 = 连接成功。

## 第四步：发送动画

```bash
cd apps/mqtt/love-confession

# 心跳：
B64=$(python3 lab/render_confession.py heart) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 烟花：
B64=$(python3 lab/render_confession.py firework) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 流星：
B64=$(python3 lab/render_confession.py star) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 滚动文字：
B64=$(python3 lab/render_confession.py text "I LOVE YOU") && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 常见问题

### Q1: 屏幕不显示

- 确认设备 IP 和 MQTT broker 正确
- 在设备上手动切换到 `love_confession` 这个 App
