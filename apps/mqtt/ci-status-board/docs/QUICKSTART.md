# TC002 CI 状态看板 — 快速入门

5 分钟内让 TC002 显示 GitHub Actions CI 状态。

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
[mqtt_prefix]_[MAC后四位]/custom/ci_status
```

## 第三步：测试 MQTT 连接

```bash
mosquitto_pub -h <broker地址> -t <你的topic> -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

## 第四步：发送 CI 状态

```bash
cd apps/mqtt/ci-status-board

# 设置要监控的 GitHub 仓库
export GITHUB_REPO=owner/repo

# 获取真实状态：
B64=$(python3 lab/render_ci_status.py) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 第五步：使用 Home Assistant 自动化（推荐）

导入 `blueprint.yaml`，在配置中填入：
- **GitHub 仓库**：`owner/repo`
- **GitHub Token**（可选）：私有仓库需要

Blueprint 会每 5 分钟自动检查并更新 CI 状态。

## 常见问题

### Q1: 屏幕不显示

- 确认设备 IP 和 MQTT broker 正确
- 在设备上手动切换到 `ci_status` 这个 App

### Q2: 获取不到数据

- 确认 `GITHUB_REPO` 格式正确（owner/repo）
- 私有仓库需要设置 `GITHUB_TOKEN`
