# TC002 年进度条 — 快速入门

5 分钟内让 TC002 显示今年的进度。

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
[mqtt_prefix]_[MAC后四位]/custom/year_progress
```

## 第三步：测试 MQTT 连接

```bash
mosquitto_pub -h <broker地址> -t <你的topic> -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

屏幕变绿 = 连接成功。

## 第四步：发布年进度条

```bash
cd apps/mqtt/year-progress-bar

# 生成并发布：
B64=$(python3 lab/render_year_progress.py) && mosquitto_pub -h <broker地址> -t <你的topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

TC002 应该显示年进度条（48%）。

## 第五步：定时更新（可选）

通过 Home Assistant Blueprint 可以每天自动更新进度条。导入 `blueprint.yaml` 即可。

## 常见问题

### Q1: 屏幕不显示

- 确认设备 IP 正确
- 确认 MQTT broker 地址正确
- 在设备上手动切换到 `year_progress` 这个 Custom App

### Q2: 进度不更新

- Blueprint 默认每天 8 点更新
- 可以手动运行脚本刷新

## 完成

现在 TC002 会显示今年的进度条，每天自动更新。
