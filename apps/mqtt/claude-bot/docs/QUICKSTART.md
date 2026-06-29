# Claude Bot 快速入门

本文档帮助你在 5 分钟内让 TC002（U-Clock）显示 Claude Code 真实限额使用率。

## 前置条件

- [x] 已安装 Claude Code
- [x] 已安装 Python 3（`python3 --version`）
- [x] 已安装 pip（`pip3 --version`）
- [x] TC002 设备已开机并连接 Wi-Fi

## 第一步：安装依赖

```bash
# 安装 Python Pillow 库（用于渲染 GIF）
pip3 install pillow

# 安装 mosquitto（MQTT 客户端）
# macOS：
brew install mosquitto

# Ubuntu/Debian：
sudo apt install mosquitto-clients
```

## 第二步：获取设备信息

```bash
# 查找你的 TC002 设备 IP
# 方法 1：在 TC002 菜单中查看
# 方法 2：查看路由器后台

# 假设设备 IP 是 10.19.1.128，获取设备信息：
curl http://10.19.1.128/getBase
```

输出示例：
```json
{
  "devSn": "B0D191008U3670007",
  "ssid": "你的Wi-Fi",
  "ip": "10.19.1.128",
  "mac": "ccc4b2441bf6",  ← 记住这个 MAC 地址
  "mcuVer": "T1.0.13",
  "appVer": "0.2.9"
}
```

```bash
# 获取 MQTT 配置：
curl http://10.19.1.128/getMqttConfig
```

输出示例：
```json
{
  "isMqtt": true,
  "ip": "10.19.1.58",      ← 这是你的 MQTT broker 地址
  "port": "1883",
  "mqtt_prefix": "ulanzi",  ← 记住这个前缀
  "mqtt_name": "",
  "mqtt_pwd": ""
}
```

## 第三步：计算你的 MQTT Topic

根据上面获取的信息，计算 topic：

```
[mqtt_prefix]_[MAC后四位]/custom/claude_bot
```

示例：
- MQTT 前缀：`ulanzi`
- MAC 后四位：`1bf6`
- Topic：`ulanzi_1bf6/custom/claude_bot`

## 第四步：克隆仓库

```bash
git clone https://github.com/UlanziTechnology/Ulanzi-U-Clock-TC002.git
cd Ulanzi-U-Clock-TC002
```

## 第五步：配置环境变量

在 `~/.zshrc`（macOS）或 `~/.bashrc`（Linux）末尾添加：

```bash
# TC002 Claude Bot — MQTT 配置
export TC002_MQTT_HOST=10.19.1.58        # 你的 MQTT broker 地址（从 getMqttConfig 获取）
export TC002_MQTT_PORT=1883              # MQTT 端口（默认 1883）
export TC002_MQTT_TOPIC=ulanzi_1bf6/custom/claude_bot  # 你的设备 topic（根据第三步计算）
export TC002_DURATION=31536000           # 显示时长（秒），默认一年，保持常亮
```

然后重新加载配置：

```bash
source ~/.zshrc  # 或 source ~/.bashrc
```

## 第六步：配置 Claude Code statusLine hook

编辑 `~/.claude/settings.json`，添加 `statusLine` 字段：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /你的仓库路径/apps/mqtt/claude-bot/lab/claude_statusline_bridge.js"
  }
}
```

**注意**：把 `/你的仓库路径/` 替换为实际路径，例如：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node /Users/yourname/Ulanzi-U-Clock-TC002/apps/mqtt/claude-bot/lab/claude_statusline_bridge.js"
  }
}
```

## 第七步：测试 MQTT 连接

```bash
# 测试能否连接到 MQTT broker
mosquitto_pub -h $TC002_MQTT_HOST -t $TC002_MQTT_TOPIC -m '{"duration":31536000,"text":[],"image":[],"draw":[{"df":[0,0,52,16,"#00FF00"]}]}'
```

如果 TC002 屏幕变绿，说明 MQTT 连接成功。

## 第八步：重启 Claude Code 并验证

```bash
# 重启 Claude Code
# 然后发送任意消息

# 检查状态文件是否生成：
cat /tmp/claude-statusline-state.json
```

应该看到类似：
```json
{
  "timestamp": "2026-06-25T...",
  "rate_limits": {
    "five_hour_pct": 0,
    "seven_day_pct": 0
  }
}
```

## 第九步：手动触发一次发布

```bash
cd apps/mqtt/claude-bot
bash lab/publish_usage.sh
```

TC002 应该显示 Claude Bot 吉祥物 + 5H:0% / 7d:0%。

## 常见问题

### Q1: TC002 屏幕不显示内容

**检查**：
1. 确认设备 IP 正确：`curl http://<设备IP>/getBase`
2. 确认 MQTT broker 地址正确：`curl http://<设备IP>/getMqttConfig`
3. 确认 topic 格式正确：`[prefix]_[mac后四位]/custom/claude_bot`
4. 在设备上手动切换到 `claude_bot` 这个 Custom App

### Q2: 状态文件显示 0%/0%

**可能原因**：
- Claude 订阅刚重置
- Claude Code 没有正确报告限额（取决于订阅类型）

**验证方法**：手动模拟数据测试链路：
```bash
echo '{"rate_limits":{"five_hour":{"used_percentage":50},"seven_day":{"used_percentage":30}},"model":{"display_name":"test"}}' | node apps/mqtt/claude-bot/lab/claude_statusline_bridge.js
```

### Q3: MQTT 发布失败

**检查**：
1. MQTT broker 是否运行：`mosquitto_pub -h $TC002_MQTT_HOST -t test -m "hello"`
2. 设备是否在同一局域网
3. 防火墙是否阻止连接

### Q4: 屏幕熄灭

**解决**：确保 `TC002_DURATION` 设置为足够大的值（默认 31536000 秒 = 一年）。

## 完成

现在每次你使用 Claude Code，TC002 都会实时显示你的 5 小时/7 天限额使用率。

- 绿色（< 70%）：正常
- 黄色（70-90%）：注意
- 红色（> 90%）：危险
