# TC002 年进度条

> **新用户？** 见 [QUICKSTART.md](QUICKSTART.md)

## 简介

在 TC002（U-Clock）上显示今年的进度，52 列 × 7 行日历点阵。

- 已过去日期：暗绿色
- 今天：亮绿色呼吸动画
- 右上角：进度百分比

**作者**：王行知

## 预览

见 `preview/demo.gif`

## 依赖

- Python 3 + Pillow（`pip install pillow`）
- mosquitto_pub（`brew install mosquitto`）
- MQTT broker（TC002 和你的电脑都能访问）

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
   export TC002_MQTT_TOPIC=ulanzi_1bf6/custom/year_progress
   ```

3. 重启 Claude Code，每次响应后自动更新 TC002 显示。

## 手动测试

```bash
cd apps/mqtt/year-progress-bar

# 生成并发布：
TC002_MQTT_HOST=<broker地址> python3 lab/render_year_progress.py | xargs -I{} mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m '{"duration":31536000,"text":[],"image":[{"data":"data:image/gif;base64,{}","position":[0,0]}],"draw":[]}'

# 指定日期测试：
python3 lab/render_year_progress.py --date 2026-06-25 --output preview/demo.gif
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
- 进度条每天自动更新一次（通过 Blueprint 定时触发）。

## 许可证

GPL-3.0-or-later。
