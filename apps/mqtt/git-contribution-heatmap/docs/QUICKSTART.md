# TC002 Git 贡献热力图 — 快速入门

5 分钟内让 TC002 显示你的 GitHub 贡献热力图。

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
[mqtt_prefix]_[MAC后四位]/custom/git_heatmap
```

## 第三步：测试 MQTT 连接

```bash
mosquitto_pub -h <broker地址> -t <你的topic> -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

## 第四步：发布热力图

```bash
cd apps/mqtt/git-contribution-heatmap

# 设置 GitHub 用户名
export GITHUB_USER=你的用户名

# 生成并发布：
B64=$(python3 lab/render_contribution_heatmap.py) && mosquitto_pub -h <broker地址> -t <你的topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 第五步：定时更新（可选）

通过 Home Assistant Blueprint 可以每天自动更新。导入 `blueprint.yaml` 即可。

或者用 cron：
```bash
# 每天早上 9 点更新
0 9 * * * cd /path/to/apps/mqtt/git-contribution-heatmap && B64=$(python3 lab/render_contribution_heatmap.py) && mosquitto_pub -h <broker> -t <topic> -m "{\"duration\":31536000,\"text\":[],\"image\":[{\"data\":\"data:image/gif;base64,$B64\",\"position\":[0,0]}],\"draw\":[]}"
```

## 常见问题

### Q1: 获取不到数据

- 确认 GitHub 用户名正确
- 可以先用 `--demo` 模式测试
- 设置 `GITHUB_TOKEN` 获取更完整的数据

### Q2: 屏幕不显示

- 确认设备 IP 和 MQTT broker 正确
- 在设备上手动切换到 `git_heatmap` 这个 App
