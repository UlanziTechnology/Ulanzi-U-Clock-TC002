# TC002 单词轮播

> **新用户？** 见 [QUICKSTART.md](QUICKSTART.md)

## 简介

把 TC002（U-Clock）变成桌面背单词小屏幕。

- 从 CSV 词表读取单词
- 随机抽取或指定单词
- 英文用像素字体显示，中文用系统字体预渲染

**作者**：王行知

## 预览

见 `preview/demo.gif`

## 依赖

- Python 3 + Pillow（`pip install pillow`）
- mosquitto_pub（`brew install mosquitto`）
- MQTT broker（TC002 和你的电脑都能访问）

## 词表格式

支持 `.csv` 文件，推荐列名：

```text
单词,音标,解释,笔记
```

也支持：

```text
word,phonetic,definition
```

## 安装

1. 在 `~/.zshrc` 中添加环境变量：

   ```bash
   export TC002_MQTT_HOST=<你的MQTT broker地址>
   export TC002_MQTT_TOPIC=ulanzi_1bf6/custom/vocabulary
   ```

2. 准备你的 CSV 词表文件。

## 手动测试

```bash
cd apps/mqtt/vocabulary-widget

# 指定单词：
B64=$(python3 lab/render_vocabulary.py --word hello) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 随机抽取 3 个：
B64=$(python3 lab/render_vocabulary.py --count 3) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# 显示全部：
B64=$(python3 lab/render_vocabulary.py --all) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `--word <单词>` | 指定单个单词 |
| `--count <数量>` | 随机抽取 N 个 |
| `--all` | 显示全部单词 |
| `--seed <数字>` | 固定随机种子 |
| `--source <路径>` | 指定 CSV 词表 |

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

- 中文释义不能太长，脚本会取前两行并截短。
- 全量词表 GIF 较大，设备可能显示异常。
- TC002 收到 Custom App 更新后，不一定会自动切换到该 App。

## 许可证

GPL-3.0-or-later。
