# TC002 CI 状态看板

> **新用户？** 见 [QUICKSTART.md](QUICKSTART.md)

## 简介

在 TC002（U-Clock）上显示 GitHub Actions CI 状态。

- 绿色：通过
- 黄色：运行中
- 红色：失败

**作者**：王行知

## 预览

见 `preview/demo.gif`

## 依赖

- Python 3 + Pillow（`pip install pillow`）
- mosquitto_pub（`brew install mosquitto`）
- MQTT broker（TC002 和你的电脑都能访问）

## 安装

### 方式一：Home Assistant Blueprint（推荐）

1. 导入 `blueprint.yaml` 到 Home Assistant
2. 在 Blueprint 配置中填入：
   - **GitHub 仓库**：要监控的仓库，格式 `owner/repo`
   - **GitHub Token**（可选）：私有仓库需要
   - **TC002 MQTT topic**：你的设备 topic
3. Blueprint 会每 5 分钟自动检查并更新 CI 状态

### 方式二：手动脚本

1. 在 `~/.zshrc` 中添加环境变量：

   ```bash
   export TC002_MQTT_HOST=<你的MQTT broker地址>
   export TC002_MQTT_TOPIC=ulanzi_1bf6/custom/ci_status
   export GITHUB_REPO=<owner/repo>
   ```

2. 可选：设置 GitHub Token 获取私有仓库状态：

   ```bash
   export GITHUB_TOKEN=ghp_xxx
   ```

## 手动测试

```bash
cd apps/mqtt/ci-status-board

# 从 GitHub 获取真实状态：
B64=$(python3 lab/render_ci_status.py) && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"

# Demo 模式：
B64=$(python3 lab/render_ci_status.py --status success --message "Fix bug") && mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 参数说明

| 参数 | 说明 |
|------|------|
| `--repo <owner/repo>` | 指定 GitHub 仓库 |
| `--status <success/failure/running>` | 手动指定状态（Demo） |
| `--message <文字>` | 手动指定 commit message（Demo） |

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

- 需要手动配置要监控的仓库（`GITHUB_REPO`）。
- TC002 收到 Custom App 更新后，不一定会自动切换到该 App。

## 许可证

GPL-3.0-or-later。
