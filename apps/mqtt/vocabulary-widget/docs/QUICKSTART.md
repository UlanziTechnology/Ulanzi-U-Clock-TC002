# TC002 单词轮播 — 快速入门

5 分钟内让 TC002 显示英文单词。

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
[mqtt_prefix]_[MAC后四位]/custom/vocabulary
```

## 第三步：测试 MQTT 连接

```bash
mosquitto_pub -h <broker地址> -t <你的topic> -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

## 第四步：发送单词

```bash
cd apps/mqtt/vocabulary-widget

# 指定单词：
B64=$(python3 lab/render_vocabulary.py --word hello) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 第五步：使用自己的词表

```bash
# 准备 CSV 文件，然后：
B64=$(python3 lab/render_vocabulary.py --source /path/to/words.csv --count 3) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 常见问题

### Q1: 屏幕不显示

- 确认设备 IP 和 MQTT broker 正确
- 在设备上手动切换到 `vocabulary` 这个 App

### Q2: 中文显示不全

- 中文释义会自动截短到前两行
- 保持释义简洁
